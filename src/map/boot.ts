/**
 * Démarrage de la carte (chunk chargé à part) : création, dessin du tracé, orbite.
 */
import { gsap } from "gsap";
import { createForestMap } from "./forestMap";
import { HeliCamera } from "./camera";

export interface BootOptions {
  mobile: boolean;
  reducedMotion: boolean;
  badge: (text: string, tone: "flamme" | "muted") => void;
}

/** Durée du dessin du tracé à l'arrivée (brief : ~4 s). */
const DRAW_S = 4;

export async function bootMap({ mobile, reducedMotion, badge }: BootOptions) {
  const container = document.getElementById("map")!;
  const fm = await createForestMap({ container, mobile });
  if (fm.styleMode === "sdk-dev" && import.meta.env.DEV) badge("Style : repli SDK (dev)", "muted");

  const camera = new HeliCamera(fm.map, { mobile, reducedMotion });
  camera.orbit();

  // Les tuiles du cadrage d'orbite d'abord, puis on dévoile la carte et on dessine.
  await new Promise<void>((resolve) => {
    if (fm.map.loaded()) resolve();
    else fm.map.once("idle", () => resolve());
  });
  document.documentElement.classList.add("map-ready");

  if (reducedMotion) {
    fm.setTrack({ drawn: 1, travelled: 1, remaining: false });
  } else {
    const draw = { p: 0 };
    gsap.to(draw, {
      p: 1,
      duration: DRAW_S,
      delay: 0.4,
      ease: "power2.inOut",
      onUpdate: () => fm.setTrack({ drawn: draw.p, travelled: draw.p, remaining: false }),
    });
  }

  // Orbite en pause quand le hero sort de l'écran.
  const hero = document.getElementById("hero")!;
  new IntersectionObserver(([entry]) => camera.setPaused("hero-offscreen", !entry.isIntersecting), {
    threshold: 0.05,
  }).observe(hero);

  document.body.setAttribute("data-map-ready", "");
  if (import.meta.env.DEV) Object.assign(window, { __map: fm.map, __fm: fm, __camera: camera, __gsap: gsap });
  return { fm, camera };
}
