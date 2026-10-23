/**
 * Images statiques de la carte (build-time) : `npm run static:map`.
 *
 * - public/img/og.jpg            image de partage (1200 × 630)
 * - public/img/carte-fallback.webp  fond de carte sans WebGL (1280 × 800)
 *
 * API Static Map de MapMap, style `outdoor`, boucle passée en polyline **précision 6**
 * (notre encodeur ; `precision=6` explicite, cf. le piège 5 vs 6 de la doc).
 * Avec MAPMAP_API_KEY : endpoint clé `/v1/static-map` ; sinon l'endpoint public du
 * site (`mapmap.ai/api/static-map`, sans clé, limité en débit).
 * Le logo MapMap et l'attribution sont incrustés par le rendu : ne pas les rogner.
 */
import fs from "node:fs";
import path from "node:path";
import { route } from "../src/data/route.ts";
import { palette } from "../src/styles/tokens.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public/img");

try {
  process.loadEnvFile(path.join(ROOT, ".env"));
} catch {
  // pas de .env
}

function encodePolyline6(coords: [number, number][]): string {
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

async function render(file: string, params: Record<string, string>) {
  const key = process.env.MAPMAP_API_KEY;
  const base = key ? `${process.env.MAPMAP_BASE_URL ?? "https://api.mapmap.ai"}/v1/static-map` : "https://mapmap.ai/api/static-map";
  const query = new URLSearchParams({
    style: process.env.STATIC_MAP_STYLE ?? "outdoor",
    route: encodePolyline6(route.coords),
    precision: "6",
    route_colour: palette.maillot,
    route_width: "6",
    pois: "false",
    ...params,
  });
  const url = `${base}?${query}`;
  if (url.length > 8000) throw new Error(`requête trop longue (${url.length} o > 8 000) : simplifier le tracé ou passer en POST`);
  const res = await fetch(url, { headers: key ? { Authorization: `Bearer ${key}` } : {} });
  if (!res.ok) throw new Error(`${file} : HTTP ${res.status} ${await res.text()}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, file), Buffer.from(await res.arrayBuffer()));
  console.log(`✔ public/img/${file} (${key ? "clé" : "endpoint public"})`);
}

async function main() {
  const lons = route.coords.map((c) => c[0]);
  const lats = route.coords.map((c) => c[1]);
  const [w, e, s, n] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  // marge autour de la boucle : la carte respire, le tracé reste au centre
  const mx = (e - w) * 0.35;
  const my = (n - s) * 0.45;
  const bbox = [w - mx, s - my, e + mx, n + my].map((v) => v.toFixed(5)).join(",");
  await render("og.jpg", { bbox, size: "1200x630", format: "jpeg", quality: "86" });
  await render("carte-fallback.webp", { bbox, size: "1280x800", format: "webp", quality: "80" });
  if (route.meta.mock) console.warn("⚠️  Images générées sur la boucle MOCK : relancer après `npm run prepare:route` avec le vrai GPX.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
