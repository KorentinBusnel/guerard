/**
 * Profil altimétrique façon profil d'étape du Tour : aires colorées par pente.
 * Géométrie pure (chaînes SVG), partagée par le mini-profil et le road-book.
 */
import { route } from "../data/route";
import { gradeBin, gradeBins } from "../styles/tokens";

export interface ProfileBox {
  width: number;
  height: number;
  /** Marges intérieures (axes, annotations). */
  pad?: { top: number; right: number; bottom: number; left: number };
  /** Plage d'altitude affichée ; par défaut min/max du profil avec un peu d'air. */
  eleRange?: [number, number];
}

export function profileScales({ width, height, pad = { top: 0, right: 0, bottom: 0, left: 0 }, eleRange }: ProfileBox) {
  const { eleMin, eleMax, totalM } = route;
  const span = eleMax - eleMin || 1;
  const [lo, hi] = eleRange ?? [eleMin - span * 0.35, eleMax + span * 0.12];
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  return {
    lo,
    hi,
    x: (d: number) => pad.left + (d / totalM) * innerW,
    y: (ele: number) => pad.top + (1 - (ele - lo) / (hi - lo)) * innerH,
    baseline: pad.top + innerH,
  };
}

/** Aires colorées par classe de pente + ligne de crête. */
export function profilePaths(box: ProfileBox) {
  const { x, y, baseline } = profileScales(box);
  const { distM, ele, grade } = route.profile;
  const f = (v: number) => v.toFixed(1);
  const areas: { color: string; d: string }[] = [];
  let start = 0;
  for (let i = 1; i <= distM.length; i++) {
    const bin = gradeBin(grade[start]);
    if (i < distM.length && gradeBin(grade[i]) === bin) continue;
    const end = Math.min(i, distM.length - 1); // recouvrement d'un échantillon : pas de jour entre aires
    let d = `M${f(x(distM[start]))} ${f(baseline)}`;
    for (let k = start; k <= end; k++) d += `L${f(x(distM[k]))} ${f(y(ele[k]))}`;
    d += `L${f(x(distM[end]))} ${f(baseline)}Z`;
    areas.push({ color: gradeBins[bin].color, d });
    start = i;
  }
  const ridge = distM.map((dd, k) => `${k ? "L" : "M"}${f(x(dd))} ${f(y(ele[k]))}`).join("");
  return { areas, ridge };
}
