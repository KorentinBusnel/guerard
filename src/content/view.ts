/**
 * Textes de la page, dérivés UNIQUEMENT de `event.ts` et des données du parcours.
 * Utilisé au build (gabarit `{{clé}}` de index.html, cf. vite.config.ts).
 */
import { event, format, tbc } from "./event.ts";
import { dateLabel, startTimeLabel } from "./date.ts";
import { route } from "../data/route.ts";
import { km, num } from "../lib/format.ts";

export function viewStrings(): Record<string, string> {
  const [lng, lat] = route.coords[0];
  const dms = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v);
    return `${Math.floor(a)}°${String(Math.round((a % 1) * 60)).padStart(2, "0")}′${v >= 0 ? pos : neg}`;
  };
  return {
    name: event.name,
    /** Titre principal : l'édition si elle est nommée, sinon la série. */
    headline: event.edition ?? event.name,
    /** « Again and Again — Backyard de Guérard » (titre de page, partage, pied de page). */
    fullName: event.edition ? `${event.edition} — ${event.name}` : event.name,
    place: `${event.place.commune} · ${event.place.departement}`,
    commune: event.place.commune,
    departement: event.place.departement,
    date: dateLabel(),
    startTime: startTimeLabel(),
    startCoords: `${dms(lat, "N", "S")} ${dms(lng, "E", "O")}`,
    loopKm3: km(route.totalM, 3),
    loopKm1: km(route.totalM, 1),
    dPlus: num(route.dPlus),
    eleMin: num(route.eleMin),
    eleMax: num(route.eleMax),
    climbsCount: String(route.climbs.length),
    climbs: route.climbs.map((c) => `${num(c.lengthM)} m à ${num(c.avgGrade, 1)} %`).join(" · "),
    loopMinutes: String(format.loopMinutes),
    price: event.priceEur !== null ? `${num(event.priceEur)} € par coureur` : tbc("tarif"),
    bibs: event.bibs !== null ? num(event.bibs) : tbc("nombre de dossards"),
  };
}

/** Ramer–Douglas–Peucker : le tracé SVG n'a pas besoin des 1 200 points du GPX. */
function simplify(pts: [number, number][], tol: number): [number, number][] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1e-9;
  let max = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max <= tol) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}

/** Tracé de la boucle en chemin SVG, dans une boîte `size` × `size` (projection locale). */
export function routeSvgPath(size = 100, pad = 4, coords = route.coords): string {
  const lat0 = (coords.reduce((a, c) => a + c[1], 0) / coords.length) * (Math.PI / 180);
  const xs = coords.map((c) => c[0] * Math.cos(lat0));
  const ys = coords.map((c) => -c[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = (size - 2 * pad) / Math.max(maxX - minX, maxY - minY);
  const offX = pad + (size - 2 * pad - (maxX - minX) * scale) / 2;
  const offY = pad + (size - 2 * pad - (maxY - minY) * scale) / 2;
  const pts = xs.map((x, i) => [offX + (x - minX) * scale, offY + (ys[i] - minY) * scale] as [number, number]);
  // boucle fermée : on découpe en deux moitiés pour que RDP garde la forme
  const mid = Math.floor(pts.length / 2);
  const simple = [...simplify(pts.slice(0, mid + 1), size / 800).slice(0, -1), ...simplify(pts.slice(mid), size / 800)];
  return simple.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");
}
