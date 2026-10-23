/**
 * Démarrage de la carte (chunk chargé à part) : création, dessin du tracé, scènes.
 */
import { gsap } from "gsap";
import { createForestMap } from "./forestMap";
import { HeliCamera } from "./camera";
import { initCourseMap } from "./course";
import { state } from "../state";

export interface BootOptions {
  mobile: boolean;
  reducedMotion: boolean;
  badge: (text: string, tone: "flamme" | "muted") => void;
  /** Vue figée pour les images statiques (OG, fallback). */
  capture: "og" | "fallback" | null;
}

/** Durée du dessin du tracé à l'arrivée (brief : ~4 s). */
const DRAW_S = 4;

export async function bootMap({ mobile, reducedMotion, badge, capture }: BootOptions) {
  const container = document.getElementById("map")!;
  const fm = await createForestMap({ container, mobile });
  if (fm.styleMode === "sdk-dev" && import.meta.env.DEV && !capture) badge("Style : repli SDK (dev)", "muted");

  const camera = new HeliCamera(fm.map, { mobile, reducedMotion });
  let introDone = reducedMotion;
  // Applique tout de suite la scène courante (orbite, poursuite ou pause).
  initCourseMap(fm, camera, { mobile, reducedMotion, introDone: () => introDone });
  if (capture === "og") camera.overview({ top: 110, bottom: 50, left: 60, right: 60 }, 52, -20);
  if (capture === "fallback") camera.overview({ top: 70, bottom: 70, left: 70, right: 70 }, 0, 0);

  // Les tuiles du premier cadrage d'abord, puis on dévoile la carte et on dessine.
  await new Promise<void>((resolve) => {
    if (fm.map.loaded()) resolve();
    else fm.map.once("idle", () => resolve());
  });
  document.documentElement.classList.add("map-ready");

  if (!introDone) {
    const draw = { p: 0 };
    gsap.to(draw, {
      p: 1,
      duration: DRAW_S,
      delay: 0.4,
      ease: "power2.inOut",
      onUpdate: () => {
        // si l'on a déjà quitté le hero, la scène gère le tracé elle-même
        if (state.scene === "hero") fm.setTrack({ drawn: draw.p, travelled: draw.p, remaining: false });
      },
      onComplete: () => {
        introDone = true;
      },
    });
  } else if (state.scene !== "course") {
    fm.setTrack({ drawn: 1, travelled: 1, remaining: false });
  }

  document.body.setAttribute("data-map-ready", "");
  if (import.meta.env.DEV) Object.assign(window, { __map: fm.map, __fm: fm, __camera: camera, __gsap: gsap });
  return { fm, camera };
}
