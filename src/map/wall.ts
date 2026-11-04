/**
 * Le « mur » d'altitude de la page 2 : sous le tracé, un ruban extrudé dont la hauteur
 * suit l'altitude de la boucle (le profil dressé en 3D sur le relief).
 *
 * Un tronçon = un quadrilatère fin (fill-extrusion) le long du tracé, ~15 m de long.
 * MapLibre pose chaque extrusion sur le relief à son centroïde : le mur suit le terrain.
 * L'état `run` (feature-state) l'allume au passage du coureur sans relancer le découpage
 * des tuiles (un changement de propriété data-driven, lui, rechargerait la source).
 */
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { route } from "../data/route";

/** Hauteur du mur : socle + altitude au-dessus du point bas × échelle (mètres). */
export const WALL = { baseM: 14, scale: 2.4, segmentM: 15 } as const;

export interface WallSegment {
  id: number;
  /** Distance (m) à la fin du tronçon : le coureur l'a passé au-delà. */
  d1: number;
}

/** Altitude à la distance `d` (profil rééchantillonné tous les `stepM` mètres). */
export function eleAt(d: number): number {
  const { distM, ele } = route.profile;
  const step = route.meta.stepM || distM[1] - distM[0];
  const i = Math.min(Math.max(d / step, 0), ele.length - 1);
  const i0 = Math.floor(i);
  const i1 = Math.min(i0 + 1, ele.length - 1);
  return ele[i0] + (ele[i1] - ele[i0]) * (i - i0);
}

export const wallHeight = (ele: number) => WALL.baseM + (ele - route.eleMin) * WALL.scale;
export const WALL_H_MIN = wallHeight(route.eleMin);
export const WALL_H_MAX = wallHeight(route.eleMax);

const M_PER_DEG = 111_320;

export function buildWall(widthM: number): { data: FeatureCollection<Polygon>; segments: WallSegment[] } {
  const { coords, distM } = route;
  const features: Feature<Polygon>[] = [];
  const segments: WallSegment[] = [];
  const half = widthM / 2;
  let i0 = 0;
  for (let i = 1; i < coords.length; i++) {
    if (distM[i] - distM[i0] < WALL.segmentM && i < coords.length - 1) continue;
    const [x0, y0] = coords[i0];
    const [x1, y1] = coords[i];
    const kx = M_PER_DEG * Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
    // vecteur du tronçon en mètres, normale unitaire, petit débord pour fermer les joints
    const dx = (x1 - x0) * kx;
    const dy = (y1 - y0) * M_PER_DEG;
    const len = Math.hypot(dx, dy) || 1;
    const [ux, uy] = [dx / len, dy / len];
    const [nx, ny] = [-uy * half, ux * half];
    const [ex, ey] = [ux * half, uy * half];
    const p = (x: number, y: number, ox: number, oy: number): [number, number] => [x + ox / kx, y + oy / M_PER_DEG];
    const ring: [number, number][] = [
      p(x0, y0, nx - ex, ny - ey),
      p(x1, y1, nx + ex, ny + ey),
      p(x1, y1, -nx + ex, -ny + ey),
      p(x0, y0, -nx - ex, -ny - ey),
    ];
    ring.push(ring[0]);
    const id = features.length;
    features.push({
      type: "Feature",
      id,
      properties: { h: Math.round(wallHeight(eleAt((distM[i0] + distM[i]) / 2)) * 10) / 10 },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
    segments.push({ id, d1: distM[i] });
    i0 = i;
  }
  return { data: { type: "FeatureCollection", features }, segments };
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
