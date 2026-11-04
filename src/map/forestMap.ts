/**
 * La scène MapMap (fond des deux pages) : le relief ombré, la forêt, l'eau, les routes et
 * les villages ; la boucle en menthe.
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
import { forestTheme, HILLSHADE, sdkCompatibleTheme, TERRAIN_EXAGGERATION } from "./theme";
import { palette } from "../styles/tokens";
import { route } from "../data/route";

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
  /** Traînée lumineuse derrière le coureur, en `p` (fraction du tour) ; `null` l'éteint. */
  setTrail(p: number | null): void;
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
  // Deux lumières (nord-ouest rasante + ouest douce) : un modelé plus fin qu'une seule
  // source, sans écraser les fonds de vallée.
  map.setPaintProperty(SDK_HILLSHADE_LAYER, "hillshade-method", "multidirectional");
  map.setPaintProperty(SDK_HILLSHADE_LAYER, "hillshade-illumination-direction", [HILLSHADE.direction, 255]);
  map.setPaintProperty(SDK_HILLSHADE_LAYER, "hillshade-illumination-altitude", [35, 55]);
  map.setPaintProperty(SDK_HILLSHADE_LAYER, "hillshade-highlight-color", [mix(ground, "#ffffff", 0.42), mix(ground, "#ffffff", 0.18)]);
  map.setPaintProperty(SDK_HILLSHADE_LAYER, "hillshade-shadow-color", [mix(ground, "#000000", 0.6), mix(ground, "#000000", 0.3)]);
  map.setPaintProperty(SDK_HILLSHADE_LAYER, "hillshade-accent-color", mix(ground, "#000000", 0.2));
  map.setPaintProperty(SDK_HILLSHADE_LAYER, "hillshade-exaggeration", HILLSHADE.intensity);
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

/** Nos couches (la boucle, le départ) : toujours visibles. */
const OWN_LAYERS = new Set(["route-glow", "route-casing", "route-line", "route-trail", "route-start"]);

/**
 * Ce qu'on garde du fond de carte, sur le relief : la forêt, l'eau et les rivières, les
 * routes (sans les chemins ni le rail) et les noms de villes et villages. Le reste
 * (bâti, points d'intérêt, noms de rues, cartouches, limites) est masqué ; MapLibre ne
 * télécharge pas les tuiles d'une couche masquée.
 */
const BASEMAP_KEEP = new Set([
  "landcover",
  "water",
  "waterway",
  "road-minor-casing",
  "road-major-casing",
  "road-minor",
  "road-major",
  "road-bridge-casing",
  "road-bridge",
  "place-labels",
]);

/** La forêt : seule couverture du sol affichée, un ton plus vert que le fond. */
const FOREST_COLOR = mix(palette.charcoal, palette.sage, 0.22);

function trimBasemap(map: maplibregl.Map) {
  for (const layer of map.getStyle().layers ?? []) {
    const keep = OWN_LAYERS.has(layer.id) || BASEMAP_KEEP.has(layer.id) || layer.type === "background" || layer.type === "hillshade";
    const visibility = keep ? "visible" : "none";
    if (map.getLayoutProperty(layer.id, "visibility") !== visibility) map.setLayoutProperty(layer.id, "visibility", visibility);
  }
  if (map.getLayer("landcover")) {
    map.setFilter("landcover", ["==", ["get", "class"], "wood"]);
    map.setPaintProperty("landcover", "fill-color", FOREST_COLOR);
    map.setPaintProperty("landcover", "fill-opacity", 0.8);
  }
}

/** Dégradé « coupé » à `p` le long de la ligne (source en `lineMetrics`). */
function cutAt(p: number, color: string): ExpressionSpecification {
  return ["step", ["line-progress"], color, Math.min(Math.max(p, 0), 1.0001), TRANSPARENT];
}

const MINT_RGB = "226, 255, 204";
const mintA = (a: number) => `rgba(${MINT_RGB}, ${Math.round(Math.min(Math.max(a, 0), 1) * 1000) / 1000})`;
/** Longueur de la traînée du coureur (fraction du tour). */
const TRAIL = 0.07;

/**
 * Traînée lumineuse derrière le coureur, en `p` (fraction du tour) : opaque au coureur,
 * transparente `TRAIL` plus loin. Elle passe la ligne de départ sans couture.
 */
function trailAt(p: number | null): ExpressionSpecification {
  if (p === null) return ["step", ["line-progress"], TRANSPARENT, 0, TRANSPARENT];
  const e = 0.0005;
  const stops: [number, string][] =
    p >= TRAIL
      ? [
          [0, TRANSPARENT],
          [p - TRAIL, TRANSPARENT],
          [p, mintA(1)],
          [Math.min(p + e, 1), TRANSPARENT],
          [1, TRANSPARENT],
        ]
      : [
          [0, mintA(1 - p / TRAIL)],
          [p, mintA(1)],
          [p + e, TRANSPARENT],
          [1 - (TRAIL - p), TRANSPARENT],
          [1, mintA(1 - p / TRAIL)],
        ];
  const flat: (number | string)[] = [];
  let last = -1;
  for (const [x, c] of stops) {
    if (x <= last) continue;
    flat.push(x, c);
    last = x;
  }
  return ["interpolate", ["linear"], ["line-progress"], ...flat] as unknown as ExpressionSpecification;
}

const lineWidth = (base: number) =>
  ["interpolate", ["exponential", 1.6], ["zoom"], 12, base * 0.6, 15, base * 1.4, 17, base * 3] as unknown as number;

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
  // halo : la boucle se lit de loin, sur le relief comme sur la forêt
  mm.addPersistentLayer(
    {
      id: "route-glow",
      type: "line",
      source: "route",
      layout: round,
      paint: { "line-gradient": cutAt(1, mintA(0.22)), "line-width": lineWidth(16), "line-blur": lineWidth(12) },
    },
    { slot: "top" },
  );
  mm.addPersistentLayer(
    {
      id: "route-casing",
      type: "line",
      source: "route",
      layout: round,
      paint: { "line-gradient": cutAt(1, palette.black), "line-width": lineWidth(8), "line-opacity": 0.8 },
    },
    { slot: "top" },
  );
  mm.addPersistentLayer(
    {
      id: "route-line",
      type: "line",
      source: "route",
      layout: round,
      paint: { "line-gradient": cutAt(1, palette.mint), "line-width": lineWidth(3.6) },
    },
    { slot: "top" },
  );
  mm.addPersistentLayer(
    {
      id: "route-trail",
      type: "line",
      source: "route",
      layout: round,
      paint: { "line-gradient": trailAt(null), "line-width": lineWidth(7), "line-blur": lineWidth(1.5) },
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
        "circle-opacity": 1,
        "circle-stroke-opacity": 1,
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
      // Rendu net : anticrénelage (arêtes du relief, tracé) et densité de pixels au moins
      // 1,5 (suréchantillonnage sur les écrans standard), plafonnée pour le GPU mobile.
      canvasContextAttributes: { antialias: true },
      pixelRatio: Math.min(Math.max(window.devicePixelRatio || 1, mobile ? 1 : 1.5), mobile ? 2.5 : 2),
      // Gestes gérés par l'app (src/map/interact.ts) : la molette et le glisser vertical
      // restent au défilement de la page.
      interactive: false,
      maxPitch: 75,
      pitch: mobile ? 52 : 60,
      fadeDuration: 150,
    },
  });
  const map = mm.map;

  const onStyle = () => {
    applySky(map);
    trimBasemap(map);
    if (styleMode === "sdk-dev") tuneDevHillshade(map);
  };
  map.on("style.load", onStyle);
  addRoute(mm);

  // Pas d'attente ici : la caméra se place tout de suite, avant les premières tuiles
  // (sinon on chargerait d'abord celles d'une vue qu'on quitte aussitôt). whenReady peut
  // arriver après le premier style.load : on réapplique, c'est idempotent.
  void mm.whenReady().then(onStyle);

  let last = -1;
  const setDrawn = (p: number) => {
    const q = Math.round(Math.min(Math.max(p, 0), 1) * 10_000) / 10_000;
    if (q === last || !map.getLayer("route-line")) return;
    last = q;
    map.setPaintProperty("route-glow", "line-gradient", cutAt(q, mintA(0.22)));
    map.setPaintProperty("route-casing", "line-gradient", cutAt(q, palette.black));
    map.setPaintProperty("route-line", "line-gradient", cutAt(q, palette.mint));
    const startVisible = q >= 1 ? 1 : 0;
    map.setPaintProperty("route-start", "circle-opacity", startVisible);
    map.setPaintProperty("route-start", "circle-stroke-opacity", startVisible);
  };

  let lastTrail = -1;
  const setTrail = (p: number | null) => {
    const q = p === null ? -1 : Math.round(p * 4000) / 4000;
    if (q === lastTrail || !map.getLayer("route-trail")) return;
    lastTrail = q;
    map.setPaintProperty("route-trail", "line-gradient", trailAt(p === null ? null : q));
  };

  return { mm, map, styleMode, setDrawn, setTrail };
}
