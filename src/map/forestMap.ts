/**
 * La carte MapMap de la page 2 : papier topo de nuit, relief, la boucle en menthe.
 *
 * Deux modes de style :
 * - `VITE_MAPMAP_STYLE_URL` défini → style hébergé (compilateur canonique : il porte
 *   déjà son ombrage de relief, le SDK ne gère que le maillage 3D) ;
 * - sinon, repli DEV : le thème passe par le compilateur réduit du SDK, qui refuse le
 *   bloc `terrain` ; on demande alors le relief + ombrage au SDK et on recolore
 *   l'ombrage comme le ferait le compilateur canonique.
 */
import * as maplibregl from "maplibre-gl";
import { createMap, type MapMapMap, type Theme } from "@mapmap/maps";
import type { ExpressionSpecification } from "maplibre-gl";
import type { FeatureCollection, LineString, Point } from "geojson";
import { forestTheme, HILLSHADE, ROAD_SHIELD_LAYERS, sdkCompatibleTheme, TERRAIN_EXAGGERATION } from "./theme";
import { palette } from "../styles/tokens";
import { route } from "../data/route";
import { buildWall, WALL_H_MAX, WALL_H_MIN, type WallSegment } from "./wall";

// CSS MapLibre dans le layer `vendor` (vendor.css). Ne jamais importer
// maplibre-gl.css directement : une copie hors layer battrait les utilitaires Tailwind.
import "./vendor.css";

/** Le SDK nomme ainsi la couche d'ombrage qu'il ajoute (repli DEV uniquement). */
const SDK_HILLSHADE_LAYER = "mapmap-hillshade";
const TRANSPARENT = "rgba(0, 0, 0, 0)";

export type StyleMode = "hosted" | "sdk-dev";

export interface ForestMap {
  mm: MapMapMap;
  map: maplibregl.Map;
  styleMode: StyleMode;
  /** Dessine la boucle jusqu'à la fraction `p` (0–1) de sa longueur. */
  setDrawn(p: number): void;
  /** Tronçons du mur d'altitude, dans l'ordre du parcours. */
  wall: WallSegment[];
  /** Allume (ou éteint) un tronçon du mur. */
  setWallRun(id: number, run: boolean): void;
  /** Éteint tout le mur (nouveau tour). */
  resetWall(): void;
}

export interface ForestMapOptions {
  container: HTMLElement;
  mobile: boolean;
}

/** Mélange deux couleurs hex (`t` = part de `to`). */
export function mix(from: string, to: string, t: number): string {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = rgb(from);
  const b = rgb(to);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Ombrage du repli DEV, dérivé de `landcover` avec les règles du compilateur
 * canonique (docs « terrain.shading ») : ombre = 50 % vers le noir, lumière = 50 %
 * vers le blanc, arêtes = 20 % vers le noir ; lumière fixée à la carte.
 */
function tuneDevHillshade(map: maplibregl.Map) {
  if (!map.getLayer(SDK_HILLSHADE_LAYER)) return;
  const ground = forestTheme.palette.landcover;
  map.setPaintProperty(SDK_HILLSHADE_LAYER, "hillshade-shadow-color", mix(ground, "#000000", 0.5));
  map.setPaintProperty(SDK_HILLSHADE_LAYER, "hillshade-highlight-color", mix(ground, "#ffffff", 0.5));
  map.setPaintProperty(SDK_HILLSHADE_LAYER, "hillshade-accent-color", mix(ground, "#000000", 0.2));
  map.setPaintProperty(SDK_HILLSHADE_LAYER, "hillshade-exaggeration", HILLSHADE.intensity);
  map.setPaintProperty(SDK_HILLSHADE_LAYER, "hillshade-illumination-direction", HILLSHADE.direction);
  map.setPaintProperty(SDK_HILLSHADE_LAYER, "hillshade-illumination-anchor", "map");
}

/** Ciel et brume : sans ciel, l'horizon d'une vue inclinée reste vide. */
function applySky(map: maplibregl.Map) {
  map.setSky({
    "sky-color": palette.carbon,
    "horizon-color": mix(palette.sage, palette.carbon, 0.55),
    "fog-color": mix(palette.carbon, palette.sage, 0.2),
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.6,
    // où la brume COMMENCE (0 = à la caméra) : on la garde au loin
    "fog-ground-blend": 0.75,
    "atmosphere-blend": 0,
  });
}

function hideRoadShields(map: maplibregl.Map) {
  for (const id of ROAD_SHIELD_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
}

/** Dégradé « coupé » à `p` le long de la ligne (source en `lineMetrics`). */
function cutAt(p: number, color: string): ExpressionSpecification {
  return ["step", ["line-progress"], color, Math.min(Math.max(p, 0), 1.0001), TRANSPARENT];
}

const lineWidth = (base: number) =>
  ["interpolate", ["exponential", 1.6], ["zoom"], 12, base * 0.6, 15, base * 1.4, 17, base * 3] as unknown as number;

/** Mur éteint : du charbon au sauge selon la hauteur ; allumé : du sauge à la menthe. */
function wallColor(): ExpressionSpecification {
  const ramp = (lo: string, hi: string): ExpressionSpecification => [
    "interpolate",
    ["linear"],
    ["get", "h"],
    WALL_H_MIN,
    lo,
    WALL_H_MAX,
    hi,
  ];
  return [
    "case",
    ["boolean", ["feature-state", "run"], false],
    ramp(mix(palette.sage, palette.mint, 0.7), palette.mint),
    ramp(mix(palette.carbon, palette.charcoal, 0.6), mix(palette.charcoal, palette.sage, 0.55)),
  ];
}

function addWall(mm: MapMapMap, mobile: boolean): WallSegment[] {
  const { data, segments } = buildWall(mobile ? 6 : 4.5);
  mm.addPersistentSource("route-wall", { type: "geojson", data });
  mm.addPersistentLayer(
    {
      id: "route-wall",
      type: "fill-extrusion",
      source: "route-wall",
      paint: {
        "fill-extrusion-color": wallColor(),
        "fill-extrusion-height": ["get", "h"],
        "fill-extrusion-base": 0,
        "fill-extrusion-opacity": 0.88,
        "fill-extrusion-vertical-gradient": true,
      },
    },
    { slot: "top" },
  );
  return segments;
}

function addRoute(mm: MapMapMap) {
  const line: FeatureCollection<LineString> = {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.coords } }],
  };
  const start: FeatureCollection<Point> = {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: route.coords[0] } }],
  };
  // lineMetrics : indispensable à line-gradient / line-progress (dessin progressif)
  mm.addPersistentSource("route", { type: "geojson", data: line, lineMetrics: true });
  mm.addPersistentSource("route-start", { type: "geojson", data: start });
  const round = { "line-join": "round", "line-cap": "round" } as const;
  mm.addPersistentLayer(
    {
      id: "route-casing",
      type: "line",
      source: "route",
      layout: round,
      paint: { "line-gradient": cutAt(0, palette.black), "line-width": lineWidth(6), "line-opacity": 0.8 },
    },
    { slot: "top" },
  );
  mm.addPersistentLayer(
    {
      id: "route-line",
      type: "line",
      source: "route",
      layout: round,
      paint: { "line-gradient": cutAt(0, palette.mint), "line-width": lineWidth(2.6) },
    },
    { slot: "top" },
  );
  mm.addPersistentLayer(
    {
      id: "route-start",
      type: "circle",
      source: "route-start",
      paint: {
        "circle-radius": lineWidth(3.4),
        "circle-color": palette.carbon,
        "circle-stroke-color": palette.mint,
        "circle-stroke-width": 1.5,
        "circle-pitch-alignment": "map",
        "circle-opacity": 0,
        "circle-stroke-opacity": 0,
      },
    },
    { slot: "top" },
  );
}

export async function createForestMap({ container, mobile }: ForestMapOptions): Promise<ForestMap> {
  // Avant toute carte : sous Vite, le worker de MapLibre 6 doit être servi par l'app.
  maplibregl.setWorkerUrl(`${import.meta.env.BASE_URL}vendor/maplibre/maplibre-gl-worker.mjs`);

  const styleUrl = import.meta.env.VITE_MAPMAP_STYLE_URL as string | undefined;
  const styleMode: StyleMode = styleUrl ? "hosted" : "sdk-dev";
  if (styleMode === "sdk-dev") {
    console.warn(
      "[guerard] VITE_MAPMAP_STYLE_URL absent : repli DEV sur le compilateur réduit du SDK. " +
        "Lancer `npm run create:style` (clé MAPMAP_API_KEY requise) pour le style hébergé.",
    );
  }

  const exaggeration = mobile ? TERRAIN_EXAGGERATION.mobile : TERRAIN_EXAGGERATION.desktop;
  const [lng0, lat0] = route.coords[0];
  const mm = createMap({
    container,
    apiKey: (import.meta.env.VITE_MAPMAP_KEY as string | undefined) || undefined,
    style: styleUrl || (sdkCompatibleTheme() as unknown as Theme),
    center: [lng0, lat0],
    zoom: 13.5,
    // Style hébergé : il porte déjà son ombrage → hillshade SDK off (sinon double ombrage).
    terrain: { exaggeration, hillshade: styleMode === "sdk-dev" },
    // Logo et attribution : non supprimables, dans deux coins différents.
    logo: { position: "bottom-right" },
    attributionPosition: "bottom-left",
    mapOptions: {
      // Carte de fond : pas de zoom molette ni de glisser qui détourneraient le défilement.
      interactive: false,
      maxPitch: 75,
      pitch: mobile ? 52 : 60,
      fadeDuration: 150,
    },
  });
  const map = mm.map;

  const onStyle = () => {
    applySky(map);
    hideRoadShields(map);
    if (styleMode === "sdk-dev") tuneDevHillshade(map);
  };
  map.on("style.load", onStyle);
  const wall = addWall(mm, mobile);
  addRoute(mm);

  await mm.whenReady();
  // whenReady peut arriver après le premier style.load : on réapplique, c'est idempotent
  onStyle();

  let last = -1;
  const setDrawn = (p: number) => {
    const q = Math.round(Math.min(Math.max(p, 0), 1) * 10_000) / 10_000;
    if (q === last || !map.getLayer("route-line")) return;
    last = q;
    map.setPaintProperty("route-casing", "line-gradient", cutAt(q, palette.black));
    map.setPaintProperty("route-line", "line-gradient", cutAt(q, palette.mint));
    const startVisible = q >= 1 ? 1 : 0;
    map.setPaintProperty("route-start", "circle-opacity", startVisible);
    map.setPaintProperty("route-start", "circle-stroke-opacity", startVisible);
  };

  const setWallRun = (id: number, run: boolean) => {
    if (map.getSource("route-wall")) map.setFeatureState({ source: "route-wall", id }, { run });
  };
  const resetWall = () => {
    if (map.getSource("route-wall")) map.removeFeatureState({ source: "route-wall" });
  };

  return { mm, map, styleMode, setDrawn, wall, setWallRun, resetWall };
}
