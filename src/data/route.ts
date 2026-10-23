import raw from "./route.json";

/** Sortie de `npm run prepare:route` (scripts/prepare-route.ts). */
export interface RouteData {
  meta: {
    mock: boolean;
    source: string;
    generatedAt: string;
    elevationSource: "gpx" | "mapmap-elevation-along" | "mapmap-dem-tiles";
    stepM: number;
    expectedM: number;
    closed: boolean;
  };
  totalM: number;
  dPlus: number;
  dMinus: number;
  eleMin: number;
  eleMax: number;
  highPoint: { distM: number; ele: number; coord: [number, number] };
  coords: [number, number][];
  distM: number[];
  profile: { distM: number[]; ele: number[]; grade: number[] };
  kmMarkers: { remainingKm: number; label: string; distM: number; coord: [number, number] }[];
  flammeRouge: { remainingKm: number; label: string; distM: number; coord: [number, number] } | null;
  poi: { id: string; type: string; name: string; description?: string; distM: number; lengthM?: number }[];
}

export const route = raw as unknown as RouteData;

export function routeBounds(r: RouteData = route): [[number, number], [number, number]] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [lng, lat] of r.coords) {
    w = Math.min(w, lng);
    e = Math.max(e, lng);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return [[w, s], [e, n]];
}
