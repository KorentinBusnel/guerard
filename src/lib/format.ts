/**
 * Formats français : virgule décimale, espace fine insécable (U+202F) entre milliers,
 * comme Intl fr-FR. Fait main : le premier Intl.NumberFormat d'une page charge les
 * données de locale (~15 ms sur mobile), et le HUD formate à chaque image.
 */
function fr(v: number, digits: number): string {
  const [int, dec] = Math.abs(v).toFixed(digits).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
  const neg = v < 0 && Number(Math.abs(v).toFixed(digits)) !== 0;
  return `${neg ? "-" : ""}${grouped}${dec ? `,${dec}` : ""}`;
}

export const km = (m: number, digits = 1) => fr(m / 1000, digits);
export const num = (v: number, digits = 0) => fr(v, digits);
export const signed = (v: number, digits = 0) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${fr(Math.abs(v), digits)}`;
export const pad2 = (v: number) => String(Math.floor(v)).padStart(2, "0");

/** Durée en `h:mm:ss` ou `mm:ss`. */
export function clock(seconds: number, withHours = false) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return withHours || h > 0 ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${pad2(m)}:${pad2(s % 60)}`;
}
