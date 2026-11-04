/**
 * La scène 3D en fond de la page 1 (chunk chargé après le premier affichage) : la boucle en
 * grand sur le relief, son mur d'altitude, le coureur qui l'allume tour après tour,
 * l'orbite lente. On la fait tourner en la glissant.
 */
import { createForestMap } from "./forestMap";
import { HeliCamera } from "./camera";
import { Runner } from "./runner";

export interface BootOptions {
  mobile: boolean;
  reducedMotion: boolean;
  /** Vue figée pour les images statiques (OG, fallback). */
  capture: "og" | "fallback" | null;
  /** La page 1, devant la carte : la scène ne tourne que si elle est à l'écran. */
  page: HTMLElement;
  /** État du bouton Pause au moment où la carte arrive. */
  userPaused: boolean;
}

export interface Scene {
  setUserPaused(paused: boolean): void;
  /** Bascule vue de dessus / vue 3D ; renvoie `true` si on est maintenant vu de dessus. */
  toggleTopDown(): boolean;
}

/** Durée du dessin de la boucle à son apparition (brief : ~4 s). */
const DRAW_MS = 4000;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Glisser sur la carte : tourner autour de la boucle (et l'incliner, à la souris). */
function enableDragRotate(el: HTMLElement, camera: HeliCamera) {
  let active: number | null = null;
  let lastX = 0;
  let lastY = 0;
  el.addEventListener("pointerdown", (e) => {
    if (active !== null || (e.pointerType === "mouse" && e.button !== 0)) return;
    active = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
    el.classList.add("is-dragging");
  });
  el.addEventListener("pointermove", (e) => {
    if (e.pointerId !== active) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    // au doigt, le vertical reste au défilement de la page (touch-action: pan-y)
    camera.rotateBy(-dx * 0.3, e.pointerType === "mouse" ? -dy * 0.2 : 0);
  });
  const end = (e: PointerEvent) => {
    if (e.pointerId !== active) return;
    active = null;
    el.classList.remove("is-dragging");
  };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

export async function bootMap({ mobile, reducedMotion, capture, page, userPaused }: BootOptions): Promise<Scene> {
  const container = document.getElementById("map")!;
  const fm = await createForestMap({ container, mobile });
  const still = reducedMotion || !!capture;
  const camera = new HeliCamera(fm.map, { mobile, reducedMotion: still });
  camera.orbit();
  camera.setSpin(!userPaused);

  // Les tuiles du premier cadrage d'abord, puis on dévoile la carte.
  await fm.mm.whenReady();
  document.documentElement.classList.add("map-ready");

  const runner = new Runner(fm, { readout: document.querySelector<HTMLElement>("[data-readout]") });
  if (still) {
    fm.setDrawn(1);
    runner.showStatic();
  } else {
    runner.setPaused("drawing", true);
    if (userPaused) runner.setPaused("user", true);
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - t0) / DRAW_MS, 1);
      fm.setDrawn(easeInOut(t));
      if (t < 1) requestAnimationFrame(step);
      else runner.setPaused("drawing", false);
    };
    requestAnimationFrame(step);
    enableDragRotate(container, camera);
  }

  // Tout s'arrête quand la page 1 quitte l'écran ou que l'onglet passe en arrière-plan.
  new IntersectionObserver(
    ([entry]) => {
      camera.setPaused("page-hidden", !entry.isIntersecting);
      runner.setPaused("page-hidden", !entry.isIntersecting);
    },
    { threshold: 0.15 },
  ).observe(page);
  document.addEventListener("visibilitychange", () => runner.setPaused("hidden", document.hidden));
  // Rotation d'écran, fenêtre redimensionnée : on recadre la boucle.
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => camera.orbit(), 200);
  });

  document.body.setAttribute("data-map-ready", "");
  if (import.meta.env.DEV) Object.assign(window, { __map: fm.map, __fm: fm, __camera: camera, __runner: runner });

  return {
    setUserPaused(paused) {
      camera.setSpin(!paused);
      runner.setPaused("user", paused);
    },
    toggleTopDown() {
      camera.setTopDown(!camera.topDown);
      return camera.topDown;
    },
  };
}
