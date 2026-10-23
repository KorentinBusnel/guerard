/**
 * Section parcours, côté carte : puck maillot jaune, panneaux kilométriques, flamme
 * rouge, et bascule de la caméra selon la scène (orbite / poursuite / pause).
 */
import * as maplibregl from "maplibre-gl";
import type { PaddingOptions } from "maplibre-gl";
import { route } from "../data/route";
import { bearingAt, positionAt } from "../lib/routeMath";
import { subscribe, type Scene } from "../state";
import type { ForestMap } from "./forestMap";
import type { HeliCamera } from "./camera";

/** Fenêtre d'apparition d'un panneau : avant d'y arriver, puis juste après. */
const PANEL_AHEAD_M = 650;
const PANEL_BEHIND_M = 120;

function el(className: string, html = "") {
  const node = document.createElement("div");
  node.className = className;
  node.innerHTML = html;
  return node;
}

/**
 * Élément de marqueur : MapLibre écrit `style.opacity` sur l'élément racine (occlusion
 * par le relief), on stylise donc un enfant pour garder la main sur l'apparition.
 */
function markerEl(inner: HTMLElement) {
  const root = el("map-marker");
  root.append(inner);
  return root;
}

export interface CourseOptions {
  mobile: boolean;
  reducedMotion: boolean;
  /** Le dessin d'intro du hero est-il terminé ? */
  introDone: () => boolean;
}

export function initCourseMap(fm: ForestMap, camera: HeliCamera, opts: CourseOptions) {
  const { map } = fm;

  const puckEl = el("puck", '<span class="puck__halo"></span><span class="puck__dot"></span>');
  const puck = new maplibregl.Marker({ element: markerEl(puckEl), pitchAlignment: "viewport", rotationAlignment: "viewport" })
    .setLngLat(route.coords[0])
    .addTo(map);

  const panels = route.kmMarkers.map((m) => {
    const flamme = m.remainingKm === route.flammeRouge?.remainingKm;
    const node = el(
      `km-panel${flamme ? " km-panel--flamme" : ""}`,
      flamme
        ? '<span class="km-panel__flag" aria-hidden="true"></span><span class="km-panel__text">1 KM</span>'
        : `<span class="km-panel__text">${m.label}</span>`,
    );
    const marker = new maplibregl.Marker({ element: markerEl(node), anchor: "bottom", pitchAlignment: "viewport" })
      .setLngLat(m.coord)
      .addTo(map);
    return { distM: m.distM, node, marker };
  });
  const startNode = el("km-panel km-panel--start", '<span class="km-panel__text">Départ · arrivée</span>');
  new maplibregl.Marker({ element: markerEl(startNode), anchor: "bottom", pitchAlignment: "viewport" })
    .setLngLat(route.coords[0])
    .addTo(map);

  let d = 0;
  const vh = () => window.innerHeight;
  // Le coureur dans le tiers bas de l'écran, la route devant lui (vue hélico).
  const followView = (): { pitch: number; zoom: number; padding: PaddingOptions } =>
    opts.mobile
      ? { pitch: 45, zoom: 15.1, padding: { top: Math.round(vh() * 0.34), bottom: 0, left: 0, right: 0 } }
      : { pitch: 62, zoom: 15.6, padding: { top: Math.round(vh() * 0.36), bottom: 0, left: 0, right: 0 } };

  let scene: Scene | undefined;
  const applyScene = (next: Scene) => {
    scene = next;
    const course = next === "course";
    map.getContainer().classList.toggle("is-course", course);
    if (course) {
      if (opts.reducedMotion) {
        // Pas de caméra qui suit : la boucle entière, figée.
        // la carte d'intro occupe la gauche (desktop) ou le haut (mobile)
        camera.overview(
          opts.mobile
            ? { top: Math.round(vh() * 0.5), bottom: 130, left: 24, right: 24 }
            : { top: 120, bottom: 190, left: Math.round(window.innerWidth * 0.46), right: 170 },
          opts.mobile ? 35 : 50,
        );
      } else {
        camera.followTarget(() => ({ center: positionAt(d), bearing: bearingAt(d) }), followView());
      }
    } else if (next === "hero") {
      camera.orbit();
    } else {
      // Sections opaques : la carte est recouverte, on arrête de dessiner.
      camera.stop();
    }
    updateTrack();
  };

  const updateTrack = () => {
    if (scene === "course") {
      fm.setTrack({ drawn: 1, travelled: opts.reducedMotion ? 1 : d / route.totalM, remaining: !opts.reducedMotion });
    } else if (opts.introDone()) {
      fm.setTrack({ drawn: 1, travelled: 1, remaining: false });
    }
  };

  const updateRunner = () => {
    puck.setLngLat(positionAt(d));
    for (const p of panels) {
      const near = d >= p.distM - PANEL_AHEAD_M && d <= p.distM + PANEL_BEHIND_M;
      p.node.classList.toggle("is-near", near);
      p.node.classList.toggle("is-passed", d > p.distM);
    }
    startNode.classList.toggle("is-near", d < 250 || d > route.totalM - PANEL_AHEAD_M);
  };

  subscribe((s, changed) => {
    if (changed.has("courseD")) {
      d = s.courseD;
      updateRunner();
      if (scene === "course") updateTrack();
    }
    if (changed.has("scene")) applyScene(s.scene);
  });
}
