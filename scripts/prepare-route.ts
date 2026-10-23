/**
 * Pipeline de données du parcours (build-time) : `npm run prepare:route`.
 *
 * GPX → GeoJSON → distances cumulées → altitude → pente lissée, D+, point haut,
 * panneaux km, flamme rouge → `src/data/route.json`. Exécuté une fois : le profil
 * est figé dans le repo, zéro appel élévation au runtime.
 *
 * Altitude, par ordre de préférence :
 *   1. l'`ele` du GPX s'il est propre ;
 *   2. `POST /elevation/along` (MapMap) si `MAPMAP_API_KEY` est défini ;
 *   3. sinon, lecture directe des tuiles DEM publiques que la carte affiche
 *      (`https://mapmap.ai/terrain/{z}/{x}/{y}.png`, Mapzen terrarium) : c'est le
 *      même jeu de données que `/elevation`, donc carte et profil concordent.
 */
import fs from "node:fs";
import path from "node:path";
import { DOMParser } from "@xmldom/xmldom";
import { gpx as gpxToGeoJSON } from "@tmcw/togeojson";
import turfLength from "@turf/length";
import turfBearing from "@turf/bearing";
import { PNG } from "pngjs";
import type { Feature, FeatureCollection, LineString, MultiLineString, Position } from "geojson";

const ROOT = path.resolve(import.meta.dirname, "..");
const GPX_REAL = path.join(ROOT, "data/boucle.gpx");
const GPX_MOCK = path.join(ROOT, "data/boucle.mock.gpx");
const POI_FILE = path.join(ROOT, "data/poi.json");
const OUT = path.join(ROOT, "src/data/route.json");

/** Longueur officielle d'une boucle de backyard ultra. */
const EXPECTED_M = 6706;
const LENGTH_TOLERANCE = 0.01;
/** Pas de rééchantillonnage du profil (HUD, profil d'étape). */
const STEP_M = 10;
/** Fenêtre de lissage de l'altitude, puis de la pente. */
const ELE_SMOOTH_M = 40;
const GRADE_WINDOW_M = 50;
/** Fenêtre du cap de la caméra (moyenne glissante, brief : ~150 m). */
const BEARING_WINDOW_M = 150;
/** Détection des montées : pente moyenne et longueur minimales. */
const CLIMB_MIN_GRADE = 4;
const CLIMB_MIN_M = 150;
const DEM_ZOOM = 13;
const DEM_URL = "https://mapmap.ai/terrain/{z}/{x}/{y}.png";
const API_BASE = process.env.MAPMAP_BASE_URL ?? "https://api.mapmap.ai";

try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  // pas de .env : on garde l'environnement tel quel
}

// ---------------------------------------------------------------------------
// Géométrie

const R_EARTH = 6371008.8; // même rayon que turf

function haversine(a: Position, b: Position): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(s));
}

function cumulative(coords: Position[]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) out.push(out[i - 1] + haversine(coords[i - 1], coords[i]));
  return out;
}

/** Point (et altitude GPX éventuelle) à la distance `d` le long de la ligne. */
function pointAt(coords: Position[], distM: number[], d: number): Position {
  if (d <= 0) return coords[0];
  const last = distM.length - 1;
  if (d >= distM[last]) return coords[last];
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (distM[mid] <= d) lo = mid;
    else hi = mid;
  }
  const t = (d - distM[lo]) / (distM[hi] - distM[lo] || 1);
  return coords[lo].map((v, k) => v + (coords[hi][k] - v) * t);
}

/** Interpolation linéaire d'une série échantillonnée (xs croissants). */
function interp(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  const last = xs.length - 1;
  if (x >= xs[last]) return ys[last];
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo] || 1);
  return ys[lo] + (ys[hi] - ys[lo]) * t;
}

/** Moyenne glissante centrée sur une série au pas régulier ; circulaire si la boucle est fermée. */
function smooth(values: number[], windowSamples: number, circular: boolean): number[] {
  const half = Math.max(1, Math.round(windowSamples / 2));
  const n = values.length;
  return values.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let k = -half; k <= half; k++) {
      let j = i + k;
      if (circular) j = ((j % (n - 1)) + (n - 1)) % (n - 1);
      else if (j < 0 || j >= n) continue;
      sum += values[j];
      count++;
    }
    return sum / count;
  });
}

// ---------------------------------------------------------------------------
// Polyline6 (format attendu par /elevation/along)

function encodePolyline6(coords: Position[]): string {
  let out = "";
  let pLat = 0;
  let pLon = 0;
  const enc = (v: number) => {
    let s = v < 0 ? ~(v << 1) : v << 1;
    while (s >= 0x20) {
      out += String.fromCharCode((0x20 | (s & 0x1f)) + 63);
      s >>= 5;
    }
    out += String.fromCharCode(s + 63);
  };
  for (const [lon, lat] of coords) {
    const iLat = Math.round(lat * 1e6);
    const iLon = Math.round(lon * 1e6);
    enc(iLat - pLat);
    enc(iLon - pLon);
    pLat = iLat;
    pLon = iLon;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sources d'altitude

type ElevationSource = "gpx" | "mapmap-elevation-along" | "mapmap-dem-tiles";

/** L'`ele` du GPX est-il exploitable ? Complet, plausible, sans pics. */
function gpxElevationIsClean(ele: (number | undefined)[], distM: number[]): ele is number[] {
  if (ele.some((e) => e === undefined || !Number.isFinite(e))) return false;
  const vals = ele as number[];
  if (vals.some((e) => e < -50 || e > 1000)) return false;
  for (let i = 1; i < vals.length; i++) {
    const run = Math.max(distM[i] - distM[i - 1], 1);
    // > 40 % sur un segment = bruit GPS barométrique ou point aberrant
    if (Math.abs(vals[i] - vals[i - 1]) / run > 0.4 && Math.abs(vals[i] - vals[i - 1]) > 4) return false;
  }
  return true;
}

async function elevationFromApi(coords: Position[], key: string): Promise<{ xs: number[]; ele: number[] }> {
  const res = await fetch(`${API_BASE}/elevation/along`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ geometry_polyline6: encodePolyline6(coords), interval_m: STEP_M }),
  });
  if (!res.ok) throw new Error(`/elevation/along → HTTP ${res.status} : ${await res.text()}`);
  const body = (await res.json()) as {
    samples: { distance_m: number; elevation_m: number | null }[];
    coverage_fraction: number;
    total_ascent_m: number | null;
  };
  if (body.coverage_fraction < 1) throw new Error(`couverture DEM incomplète (${body.coverage_fraction})`);
  console.log(`  /elevation/along : ${body.samples.length} échantillons, D+ API ${body.total_ascent_m} m`);
  return {
    xs: body.samples.map((s) => s.distance_m),
    ele: body.samples.map((s) => s.elevation_m as number),
  };
}

async function elevationFromDemTiles(points: Position[]): Promise<number[]> {
  const n = 2 ** DEM_ZOOM;
  const cache = new Map<string, Promise<PNG>>();
  const tile = (x: number, y: number) => {
    const k = `${x}/${y}`;
    if (!cache.has(k)) {
      const url = DEM_URL.replace("{z}", String(DEM_ZOOM)).replace("{x}", String(x)).replace("{y}", String(y));
      cache.set(
        k,
        fetch(url).then(async (r) => {
          if (!r.ok) throw new Error(`DEM ${url} → HTTP ${r.status}`);
          return PNG.sync.read(Buffer.from(await r.arrayBuffer()));
        }),
      );
    }
    return cache.get(k)!;
  };
  const sample = async (px: number, py: number) => {
    const tx = Math.floor(px / 256);
    const ty = Math.floor(py / 256);
    const png = await tile(tx, ty);
    const ix = Math.floor(px) - tx * 256;
    const iy = Math.floor(py) - ty * 256;
    const o = (iy * png.width + ix) * 4;
    // terrarium : (R * 256 + G + B / 256) - 32768
    return png.data[o] * 256 + png.data[o + 1] + png.data[o + 2] / 256 - 32768;
  };
  const out: number[] = [];
  for (const [lon, lat] of points) {
    const rad = (lat * Math.PI) / 180;
    // coordonnées pixel globales, centrées sur le pixel (bilinéaire)
    const px = ((lon + 180) / 360) * n * 256 - 0.5;
    const py = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n * 256 - 0.5;
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const fx = px - x0;
    const fy = py - y0;
    const [a, b, c, d] = await Promise.all([sample(x0, y0), sample(x0 + 1, y0), sample(x0, y0 + 1), sample(x0 + 1, y0 + 1)]);
    out.push(a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy);
  }
  return out;
}

// ---------------------------------------------------------------------------
// POI

interface PoiInput {
  id: string;
  type: string;
  name: string;
  description?: string;
  /** Position le long de la boucle, ou coordonnées à projeter sur le tracé. */
  distM?: number;
  lngLat?: [number, number];
  /** Longueur de la section concernée (montée…), en mètres. */
  lengthM?: number;
}

function snapToRoute(coords: Position[], distM: number[], p: Position): number {
  let best = Infinity;
  let bestD = 0;
  for (let i = 1; i < coords.length; i++) {
    // projection approchée sur le segment, en équirectangulaire local
    const a = coords[i - 1];
    const b = coords[i];
    const kx = Math.cos((a[1] * Math.PI) / 180);
    const ax = a[0] * kx, ay = a[1], bx = b[0] * kx, by = b[1], px = p[0] * kx, py = p[1];
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1e-18;
    const t = Math.min(1, Math.max(0, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2));
    const q: Position = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const dd = haversine(q, p);
    if (dd < best) {
      best = dd;
      bestD = distM[i - 1] + (distM[i] - distM[i - 1]) * t;
    }
  }
  return bestD;
}

// ---------------------------------------------------------------------------

const round = (v: number, k = 1) => Math.round(v * 10 ** k) / 10 ** k;

async function main() {
  const mock = !fs.existsSync(GPX_REAL);
  const gpxPath = mock ? GPX_MOCK : GPX_REAL;
  if (mock) {
    console.warn("⚠️  data/boucle.gpx absent → utilisation de la boucle MOCK (data/boucle.mock.gpx).");
  }
  console.log(`Lecture ${path.relative(ROOT, gpxPath)}`);

  const xml = new DOMParser().parseFromString(fs.readFileSync(gpxPath, "utf8"), "text/xml");
  const fc = gpxToGeoJSON(xml as unknown as Document) as FeatureCollection;
  const lines = fc.features.filter(
    (f): f is Feature<LineString | MultiLineString> =>
      f.geometry?.type === "LineString" || f.geometry?.type === "MultiLineString",
  );
  if (lines.length === 0) throw new Error("aucune trace (trk/rte) dans le GPX");
  const raw: Position[] = lines.flatMap((f) =>
    f.geometry.type === "LineString" ? f.geometry.coordinates : f.geometry.coordinates.flat(),
  );
  // dédoublonnage des points consécutifs identiques
  const coords3 = raw.filter((p, i) => i === 0 || haversine(p, raw[i - 1]) > 0.05);
  const coords: Position[] = coords3.map(([lon, lat]) => [round(lon, 6), round(lat, 6)]);
  const gpxEle = coords3.map((p) => p[2]);

  const distM = cumulative(coords);
  const totalM = distM[distM.length - 1];
  const turfTotal = turfLength({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }, { units: "meters" });
  const closed = haversine(coords[0], coords[coords.length - 1]) < 30;
  console.log(`  ${coords.length} points, longueur ${round(totalM)} m (turf ${round(turfTotal)} m), boucle fermée : ${closed}`);
  if (Math.abs(totalM - EXPECTED_M) / EXPECTED_M > LENGTH_TOLERANCE) {
    console.warn(`⚠️  Longueur ${round(totalM)} m ≠ ${EXPECTED_M} m attendus (écart ${round(totalM - EXPECTED_M)} m).`);
  }
  if (!closed) console.warn("⚠️  Le tracé n'est pas fermé (départ et arrivée à plus de 30 m).");

  // Échantillons réguliers : base commune du HUD, du profil et du puck
  const count = Math.floor(totalM / STEP_M);
  const sampleD = Array.from({ length: count + 1 }, (_, i) => i * STEP_M);
  if (sampleD[sampleD.length - 1] < totalM) sampleD.push(totalM);

  let source: ElevationSource;
  let sampleEle: number[];
  if (gpxElevationIsClean(gpxEle, distM)) {
    source = "gpx";
    sampleEle = sampleD.map((d) => interp(distM, gpxEle, d));
  } else if (process.env.MAPMAP_API_KEY) {
    source = "mapmap-elevation-along";
    const { xs, ele } = await elevationFromApi(coords, process.env.MAPMAP_API_KEY);
    // l'API mesure sa propre distance : on la remet à l'échelle de la nôtre
    const scale = totalM / xs[xs.length - 1];
    sampleEle = sampleD.map((d) => interp(xs.map((x) => x * scale), ele, d));
  } else {
    source = "mapmap-dem-tiles";
    console.log("  pas de MAPMAP_API_KEY : altitude lue dans les tuiles DEM publiques (même jeu que /elevation)");
    sampleEle = await elevationFromDemTiles(sampleD.map((d) => pointAt(coords, distM, d)));
  }
  console.log(`  altitude : ${source}`);

  const circular = closed;
  const eleSmooth = smooth(sampleEle, ELE_SMOOTH_M / STEP_M, circular);
  const half = Math.round(GRADE_WINDOW_M / STEP_M / 2);
  const last = eleSmooth.length - 1;
  const gradeRaw = eleSmooth.map((_, i) => {
    const a = circular ? (i - half + last) % last : Math.max(0, i - half);
    const b = circular ? (i + half) % last : Math.min(last, i + half);
    const run = circular ? 2 * half * STEP_M : sampleD[b] - sampleD[a];
    return run > 0 ? ((eleSmooth[b] - eleSmooth[a]) / run) * 100 : 0;
  });
  const grade = smooth(gradeRaw, 2, circular);

  let dPlus = 0;
  let dMinus = 0;
  for (let i = 1; i < eleSmooth.length; i++) {
    const dz = eleSmooth[i] - eleSmooth[i - 1];
    if (dz > 0) dPlus += dz;
    else dMinus -= dz;
  }
  const hi = eleSmooth.reduce((best, e, i) => (e > eleSmooth[best] ? i : best), 0);
  const lo = eleSmooth.reduce((best, e, i) => (e < eleSmooth[best] ? i : best), 0);

  // Cap de la caméra : moyenne circulaire (vecteurs unitaires pondérés par la longueur)
  // des caps des segments sur ±75 m, pour une caméra sans à-coups dans les lacets.
  const segBearing = coords.slice(1).map((c, i) => (turfBearing(coords[i], c) * Math.PI) / 180);
  const bearing = sampleD.map((d) => {
    let x = 0;
    let y = 0;
    const from = d - BEARING_WINDOW_M / 2;
    const to = d + BEARING_WINDOW_M / 2;
    const span = closed ? [[from, to]] : [[Math.max(0, from), Math.min(totalM, to)]];
    // boucle fermée : la fenêtre déborde sur l'autre bout
    const ranges = closed
      ? span.flatMap(([a, b]) => (a < 0 ? [[a + totalM, totalM], [0, b]] : b > totalM ? [[a, totalM], [0, b - totalM]] : [[a, b]]))
      : span;
    for (const [a, b] of ranges) {
      for (let i = 1; i < distM.length; i++) {
        const overlap = Math.min(b, distM[i]) - Math.max(a, distM[i - 1]);
        if (overlap <= 0) continue;
        x += Math.sin(segBearing[i - 1]) * overlap;
        y += Math.cos(segBearing[i - 1]) * overlap;
      }
    }
    return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  });

  // Montées : tronçons où la pente tient au-dessus du seuil (fiches étape, road-book)
  const climbs: { startM: number; endM: number; lengthM: number; avgGrade: number; maxGrade: number; gainM: number }[] = [];
  let runStart = -1;
  const closeRun = (end: number) => {
    const lengthM = sampleD[end] - sampleD[runStart];
    const gainM = eleSmooth[end] - eleSmooth[runStart];
    const avgGrade = (gainM / lengthM) * 100;
    if (lengthM >= CLIMB_MIN_M && avgGrade >= CLIMB_MIN_GRADE) {
      climbs.push({
        startM: round(sampleD[runStart]),
        endM: round(sampleD[end]),
        lengthM: round(lengthM, 0),
        avgGrade: round(avgGrade),
        maxGrade: round(Math.max(...grade.slice(runStart, end + 1))),
        gainM: round(gainM, 0),
      });
    }
  };
  grade.forEach((g, i) => {
    if (g >= CLIMB_MIN_GRADE / 2 && runStart < 0) runStart = i;
    else if (g < CLIMB_MIN_GRADE / 2 && runStart >= 0) {
      closeRun(i - 1);
      runStart = -1;
    }
  });
  if (runStart >= 0) closeRun(grade.length - 1);

  // Panneaux kilométriques façon Tour : distance RESTANTE (« 5 KM », « 4 KM »…)
  const kmMarkers = [];
  for (let k = Math.floor(totalM / 1000); k >= 1; k--) {
    const d = totalM - k * 1000;
    if (d <= 50) continue;
    kmMarkers.push({ remainingKm: k, label: `${k} KM`, distM: round(d), coord: pointAt(coords, distM, d).map((v) => round(v, 6)) });
  }
  const flammeRouge = kmMarkers.find((m) => m.remainingKm === 1) ?? null;

  let poi: (PoiInput & { distM: number })[] = [];
  if (fs.existsSync(POI_FILE)) {
    const input = JSON.parse(fs.readFileSync(POI_FILE, "utf8")) as PoiInput[];
    poi = input.map((p) => ({ ...p, distM: round(p.distM ?? snapToRoute(coords, distM, p.lngLat!)) }));
    console.log(`  ${poi.length} POI`);
  } else {
    console.warn("⚠️  data/poi.json absent → aucun POI (voir data/poi.example.json).");
  }

  const out = {
    meta: {
      mock,
      source: path.relative(ROOT, gpxPath),
      generatedAt: new Date().toISOString(),
      elevationSource: source,
      stepM: STEP_M,
      expectedM: EXPECTED_M,
      closed,
    },
    totalM: round(totalM),
    dPlus: round(dPlus, 0),
    dMinus: round(dMinus, 0),
    eleMin: round(eleSmooth[lo]),
    eleMax: round(eleSmooth[hi]),
    highPoint: { distM: round(sampleD[hi]), ele: round(eleSmooth[hi]), coord: pointAt(coords, distM, sampleD[hi]).map((v) => round(v, 6)) },
    coords,
    distM: distM.map((d) => round(d)),
    /** Profil au pas régulier `meta.stepM` : altitude lissée (m) et pente (%). */
    profile: {
      distM: sampleD.map((d) => round(d)),
      ele: eleSmooth.map((e) => round(e)),
      grade: grade.map((g) => round(g)),
      /** Cap lissé de la caméra (degrés, 0 = nord). */
      bearing: bearing.map((b) => round(b)),
    },
    climbs,
    kmMarkers,
    flammeRouge,
    poi,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  const maxGrade = Math.max(...grade.map(Math.abs));
  console.log(
    `✔ ${path.relative(ROOT, OUT)} : ${round(totalM)} m, D+ ${round(dPlus, 0)} m, alt ${round(eleSmooth[lo])}–${round(eleSmooth[hi])} m, pente max ${round(maxGrade)} %, ${climbs.length} montée(s)${mock ? " [MOCK]" : ""}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
