/**
 * Démarrage de la carte (chunk chargé à l'approche de la page 2) : création, dessin de la
 * boucle à sa première apparition, orbite tant que la page 2 est à l'écran.
 */
import { createForestMap } from "./forestMap";
import { HeliCamera } from "./camera";

export interface BootOptions {
  mobile: boolean;
  reducedMotion: boolean;
  /** Vue figée pour les images statiques (OG, fallback). */
  capture: "og" | "fallback" | null;
  /** La page 2, qui laisse voir la carte. */
  page: HTMLElement;
}

/** Durée du dessin de la boucle (brief : ~4 s). */
const DRAW_MS = 4000;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export async function bootMap({ mobile, reducedMotion, capture, page }: BootOptions) {
  const container = document.getElementById("map")!;
  const fm = await createForestMap({ container, mobile });
  const camera = new HeliCamera(fm.map, { mobile, reducedMotion });

  if (capture === "og") camera.overview({ top: 60, bottom: 230, left: 80, right: 80 }, 50);
  else if (capture === "fallback") camera.overview({ top: 70, bottom: 70, left: 70, right: 70 }, 0, 0);
  else camera.orbit();

  // Les tuiles du premier cadrage d'abord, puis on dévoile la carte.
  await new Promise<void>((resolve) => {
    if (fm.map.loaded()) resolve();
    else fm.map.once("idle", () => resolve());
  });
  document.documentElement.classList.add("map-ready");

  let drawn = reducedMotion;
  if (drawn) fm.setDrawn(1);
  const draw = () => {
    drawn = true;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - t0) / DRAW_MS, 1);
      fm.setDrawn(easeInOut(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // Orbite et premier dessin seulement quand la page 2 est à l'écran.
  new IntersectionObserver(
    ([entry]) => {
      camera.setPaused("page-hidden", !entry.isIntersecting);
      if (entry.isIntersecting && !drawn) draw();
    },
    { threshold: 0.15 },
  ).observe(page);

  document.body.setAttribute("data-map-ready", "");
  if (import.meta.env.DEV) Object.assign(window, { __map: fm.map, __fm: fm, __camera: camera });
  return { fm, camera };
}
