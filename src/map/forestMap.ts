/**
 * La carte MapMap : style forêt, relief, boucle.
 *
 * Deux modes de style :
 * - `VITE_MAPMAP_STYLE_URL` défini → style hébergé (compilateur canonique : il porte
 *   déjà son ombrage de relief, le SDK ne gère que le maillage 3D) ;
 * - sinon, repli DEV : le thème passe par le compilateur réduit du SDK, qui ignore le
 *   bloc `terrain` ; on demande alors le relief + ombrage au SDK et on recolore
 *   l'ombrage comme le ferait le compilateur canonique.
 */
import * as maplibregl from "maplibre-gl";
import { createMap, type MapMapMap, type Theme } from "@mapmap/maps";
import type { FeatureCollection, LineString, Point } from "geojson";
import { forestTheme, HILLSHADE, ROAD_SHIELD_LAYERS, sdkCompatibleTheme, TERRAIN_EXAGGERATION } from "./theme";
import { palette } from "../styles/tokens";
import { route, routeBounds } from "../data/route";

// NB : maplibre-gl.css est importé dans app.css, dans le layer `vendor`. Ne pas le
// réimporter ici : une copie hors layer battrait les utilitaires Tailwind.

/** Le SDK nomme ainsi la couche d'ombrage qu'il ajoute (repli DEV uniquement). */
const SDK_HILLSHADE_LAYER = "mapmap-hillshade";

export type StyleMode = "hosted" | "sdk-dev";

export interface ForestMap {
  mm: MapMapMap;
  map: maplibregl.Map;
  styleMode: StyleMode;
}

export interface ForestMapOptions {
  container: HTMLElement;
  mobile: boolean;
}

/** Mélange deux couleurs hex (`t` = part de `to`). */
function mix(from: string, to: string, t: number): string {
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

/** Ciel et brume d'aube : sans ciel, l'horizon d'une vue inclinée reste vide. */
function applySky(map: maplibregl.Map) {
  map.setSky({
    "sky-color": "#0d1c14",
    "horizon-color": mix(palette.brume, palette.sapin, 0.55),
    "fog-color": mix(palette.sousBois, palette.brume, 0.18),
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

function addRoute(mm: MapMapMap) {
  const line: FeatureCollection<LineString> = {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.coords } }],
  };
  const start: FeatureCollection<Point> = {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: route.coords[0] } }],
  };
  // lineMetrics : prépare le dessin progressif (line-gradient sur line-progress, phase 1)
  mm.addPersistentSource("route", { type: "geojson", data: line, lineMetrics: true });
  mm.addPersistentSource("route-start", { type: "geojson", data: start });
  const width = (base: number) =>
    ["interpolate", ["exponential", 1.6], ["zoom"], 12, base * 0.6, 15, base * 1.4, 17, base * 3] as unknown as number;
  mm.addPersistentLayer(
    {
      id: "route-casing",
      type: "line",
      source: "route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": palette.sapin, "line-width": width(6), "line-opacity": 0.85 },
    },
    { slot: "top" },
  );
  mm.addPersistentLayer(
    {
      id: "route-line",
      type: "line",
      source: "route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": palette.maillot, "line-width": width(3) },
    },
    { slot: "top" },
  );
  mm.addPersistentLayer(
    {
      id: "route-start",
      type: "circle",
      source: "route-start",
      paint: {
        "circle-radius": width(4),
        "circle-color": palette.maillot,
        "circle-stroke-color": palette.sapin,
        "circle-stroke-width": 2,
        "circle-pitch-alignment": "map",
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
  const bounds = routeBounds();
  const mm = createMap({
    container,
    apiKey: (import.meta.env.VITE_MAPMAP_KEY as string | undefined) || undefined,
    style: styleUrl || (sdkCompatibleTheme() as unknown as Theme),
    center: [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2],
    zoom: 13.5,
    // Style hébergé : il porte déjà son ombrage → hillshade SDK off (sinon double ombrage).
    terrain: { exaggeration, hillshade: styleMode === "sdk-dev" },
    // Logo et attribution : non supprimables, dans deux coins différents.
    logo: { position: "bottom-right" },
    attributionPosition: "bottom-left",
    mapOptions: { maxPitch: 75, pitch: mobile ? 40 : 58, bearing: -25 },
  });
  const map = mm.map;

  const onStyle = () => {
    applySky(map);
    hideRoadShields(map);
    if (styleMode === "sdk-dev") tuneDevHillshade(map);
  };
  map.on("style.load", onStyle);
  addRoute(mm);

  await mm.whenReady();
  // whenReady peut arriver après le premier style.load : on réapplique, c'est idempotent
  onStyle();

  map.fitBounds(bounds, {
    padding: mobile ? { top: 90, bottom: 60, left: 24, right: 24 } : { top: 120, bottom: 80, left: 80, right: 80 },
    pitch: mobile ? 40 : 58,
    bearing: -25,
    duration: 0,
  });

  return { mm, map, styleMode };
}
