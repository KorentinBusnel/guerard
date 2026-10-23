/**
 * Textes de la page, dérivés UNIQUEMENT de `event.ts` et des données du parcours.
 * Utilisé au build (gabarit `{{clé}}` de index.html, cf. vite.config.ts) et au runtime.
 */
import { event, format, tbc } from "./event.ts";
import { route } from "../data/route.ts";
import { km, num } from "../lib/format.ts";

const TZ = "Europe/Paris";

/** Date de départ (ISO) en objet Date, heure de Paris, ou null si non fournie. */
export function startDate(): Date | null {
  if (!event.date) return null;
  const time = event.startTime ?? "00:00";
  // Décalage de Paris à cette date (hiver +01:00, été +02:00)
  const probe = new Date(`${event.date}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(probe)
    .find((p) => p.type === "timeZoneName")!
    .value.replace("GMT", "") || "+00:00";
  return new Date(`${event.date}T${time}:00${offset}`);
}

export function dateLabel(): string {
  if (!event.date) return tbc("date");
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${event.date}T12:00:00Z`),
  );
}

export function startTimeLabel(): string {
  return event.startTime ? event.startTime.replace(":", " h ") : tbc("heure de départ");
}

/** Jours restants avant le départ (arrondi supérieur), ou null. */
export function daysToGo(now = new Date()): number | null {
  const d = startDate();
  if (!d) return null;
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

export function viewStrings(): Record<string, string> {
  return {
    name: event.name,
    place: `${event.place.commune} · ${event.place.departement}`,
    commune: event.place.commune,
    date: dateLabel(),
    startTime: startTimeLabel(),
    loopKm3: km(route.totalM, 3),
    loopKm1: km(route.totalM, 1),
    dPlus: num(route.dPlus),
    eleMax: num(route.eleMax),
    loopMinutes: String(format.loopMinutes),
    finishers: String(format.finishers),
    price: event.priceEur !== null ? `${num(event.priceEur)} €` : tbc("tarif"),
    bibs: event.bibs !== null ? num(event.bibs) : tbc("nombre de dossards"),
    registrationHref: event.registrationUrl ?? "#inscription",
  };
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
  return xs
    .map((x, i) => `${i ? "L" : "M"}${(offX + (x - minX) * scale).toFixed(2)} ${(offY + (ys[i] - minY) * scale).toFixed(2)}`)
    .join("");
}
