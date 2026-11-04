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

export function profilePaths({ width, height, padTop = 0 }: ProfileBox) {
  const { eleMin, eleMax, totalM } = route;
  const span = eleMax - eleMin || 1;
  const lo = eleMin - span * 0.35;
  const hi = eleMax + span * 0.05;
  const x = (d: number) => (d / totalM) * width;
  const y = (e: number) => padTop + (1 - (e - lo) / (hi - lo)) * (height - padTop);
  const f = (v: number) => v.toFixed(1);
  const { distM, ele } = route.profile;
  const ridge = distM.map((d, k) => `${k ? "L" : "M"}${f(x(d))} ${f(y(ele[k]))}`).join("");
  const area = `${ridge}L${f(width)} ${height}L0 ${height}Z`;
  return { ridge, area };
}
