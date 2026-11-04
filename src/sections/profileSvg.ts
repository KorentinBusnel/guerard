/**
 * Profil altimétrique de la boucle : aire + ligne de crête (chaînes SVG, au build).
 */
import { route } from "../data/route.ts";

export interface ProfileBox {
  width: number;
  height: number;
  /** Marge haute (le relief ne touche pas le bord). */
  padTop?: number;
}

/** Échelle verticale du profil : socle sous le point bas, petite marge au-dessus du haut. */
function eleRange() {
  const { eleMin, eleMax } = route;
  const span = eleMax - eleMin || 1;
  return { lo: eleMin - span * 0.35, hi: eleMax + span * 0.05 };
}

export function profilePaths({ width, height, padTop = 0 }: ProfileBox) {
  const { totalM } = route;
  const { lo, hi } = eleRange();
  const x = (d: number) => (d / totalM) * width;
  const y = (e: number) => padTop + (1 - (e - lo) / (hi - lo)) * (height - padTop);
  const f = (v: number) => v.toFixed(1);
  const { distM, ele } = route.profile;
  const ridge = distM.map((d, k) => `${k ? "L" : "M"}${f(x(d))} ${f(y(ele[k]))}`).join("");
  const area = `${ridge}L${f(width)} ${height}L0 ${height}Z`;
  return { ridge, area };
}

/**
 * Aire du profil entre les distances `a` et `b` (mètres) : surligne une montée.
 */
export function profileSegmentArea({ width, height, padTop = 0 }: ProfileBox, a: number, b: number): string {
  const { totalM } = route;
  const { lo, hi } = eleRange();
  const x = (d: number) => (d / totalM) * width;
  const y = (e: number) => padTop + (1 - (e - lo) / (hi - lo)) * (height - padTop);
  const f = (v: number) => v.toFixed(1);
  const { distM, ele } = route.profile;
  const pts = distM.map((d, k) => [d, ele[k]] as const).filter(([d]) => d >= a && d <= b);
  if (pts.length < 2) return "";
  const top = pts.map(([d, e], k) => `${k ? "L" : "M"}${f(x(d))} ${f(y(e))}`).join("");
  return `${top}L${f(x(pts[pts.length - 1][0]))} ${height}L${f(x(pts[0][0]))} ${height}Z`;
}

/** Ordonnée (en % de la hauteur) de l'altitude `e` dans un cadre quelconque. */
export function yPercent({ height, padTop = 0 }: ProfileBox, e: number): number {
  const { lo, hi } = eleRange();
  return ((padTop + (1 - (e - lo) / (hi - lo)) * (height - padTop)) / height) * 100;
}
