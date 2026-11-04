/**
 * Suivre la boucle : position et altitude à une distance donnée (coureur de la scène 3D).
 */
import { route } from "../data/route";

/** Altitude à la distance `d` (profil rééchantillonné tous les `stepM` mètres). */
export function eleAt(d: number): number {
  const { distM, ele } = route.profile;
  const step = route.meta.stepM || distM[1] - distM[0];
  const i = Math.min(Math.max(d / step, 0), ele.length - 1);
  const i0 = Math.floor(i);
  const i1 = Math.min(i0 + 1, ele.length - 1);
  return ele[i0] + (ele[i1] - ele[i0]) * (i - i0);
}

/** Position sur le tracé à la distance `d` (recherche dichotomique + interpolation). */
export function pointAt(d: number): [number, number] {
  const { coords, distM } = route;
  let lo = 0;
  let hi = distM.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (distM[mid] <= d) lo = mid;
    else hi = mid;
  }
  const t = Math.min(Math.max((d - distM[lo]) / (distM[hi] - distM[lo] || 1), 0), 1);
  return [coords[lo][0] + (coords[hi][0] - coords[lo][0]) * t, coords[lo][1] + (coords[hi][1] - coords[lo][1]) * t];
}
