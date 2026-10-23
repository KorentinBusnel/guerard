/** Formats français (virgule décimale, espace fine insécable des milliers). */
const nf = (digits: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const km = (m: number, digits = 1) => nf(digits).format(m / 1000);
export const num = (v: number, digits = 0) => nf(digits).format(v);
export const signed = (v: number, digits = 0) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(digits).format(Math.abs(v))}`;
export const pad2 = (v: number) => String(Math.floor(v)).padStart(2, "0");

/** Durée en `h:mm:ss` ou `mm:ss`. */
export function clock(seconds: number, withHours = false) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return withHours || h > 0 ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${pad2(m)}:${pad2(s % 60)}`;
}
