/**
 * Lecture du parcours à une distance donnée. Tout (puck, HUD, profil, caméra) passe par
 * la même distance `d` = p × totalM : c'est ce qui garantit la synchro à ±10 m.
 */
import along from "@turf/along";
import type { Feature, LineString } from "geojson";
import { route, type RouteData } from "../data/route";

const line: Feature<LineString> = {
  type: "Feature",
  properties: {},
  geometry: { type: "LineString", coordinates: route.coords },
};

/** Position sur le tracé à `d` mètres du départ. */
export function positionAt(d: number): [number, number] {
  const clamped = Math.min(Math.max(d, 0), route.totalM);
  return along(line, clamped, { units: "meters" }).geometry.coordinates as [number, number];
}

/** Valeur interpolée d'une série du profil (pas régulier `meta.stepM`). */
export function profileAt(series: keyof Pick<RouteData["profile"], "ele" | "grade">, d: number): number {
  const { distM } = route.profile;
  const values = route.profile[series];
  const i = Math.min(Math.max(Math.floor(d / route.meta.stepM), 0), distM.length - 2);
  const t = Math.min(Math.max((d - distM[i]) / (distM[i + 1] - distM[i] || 1), 0), 1);
  return values[i] + (values[i + 1] - values[i]) * t;
}

/** Cap lissé (degrés) à `d`, interpolé par le plus court chemin angulaire. */
export function bearingAt(d: number): number {
  const { distM, bearing } = route.profile;
  const i = Math.min(Math.max(Math.floor(d / route.meta.stepM), 0), distM.length - 2);
  const t = Math.min(Math.max((d - distM[i]) / (distM[i + 1] - distM[i] || 1), 0), 1);
  return lerpAngle(bearing[i], bearing[i + 1], t);
}

/** Interpolation d'angle (degrés) par le plus court chemin. */
export function lerpAngle(a: number, b: number, t: number): number {
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  return a + delta * t;
}
