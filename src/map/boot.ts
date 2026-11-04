/**
 * La scène 3D en fond fixe des deux pages (chunk chargé après le premier affichage) : la
 * boucle en grand sur le relief, le coureur qui en fait le tour, encore et encore,
 * l'orbite lente. On la fait tourner, on zoome, on lit le km et l'altitude du tracé
 * (src/map/interact.ts).
 */
import { createForestMap } from "./forestMap";
import { HeliCamera } from "./camera";
import { Runner } from "./runner";
import { enableInteractions } from "./interact";

export interface BootOptions {
  mobile: boolean;
  reducedMotion: boolean;
  /** Vue figée pour les images statiques (OG, fallback). */
  capture: "og" | "fallback" | null;
  /** Les pages devant la scène : elle ne tourne que si l'une d'elles est à l'écran. */
  pages: HTMLElement[];
  /** État du bouton Pause au moment où la carte arrive. */
  userPaused: boolean;
  /** Après chaque zoom : peut-on encore rapprocher / éloigner (boutons + / −) ? */
  onZoomChange?: (canIn: boolean, canOut: boolean) => void;
}

export interface Scene {
  setUserPaused(paused: boolean): void;
  /** Bascule vue de dessus / vue 3D ; renvoie `true` si on est maintenant vu de dessus. */
  toggleTopDown(): boolean;
  /** Boutons + / − : un cran de zoom. */
  zoomBy(dz: number): void;
}

/** Durée du dessin de la boucle à son apparition (brief : ~4 s). */
const DRAW_MS = 4000;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export async function bootMap({ mobile, reducedMotion, capture, pages, userPaused, onZoomChange }: BootOptions): Promise<Scene> {
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
  }
  const zoomChanged = () => onZoomChange?.(camera.canZoomIn, camera.canZoomOut);
  // Les gestes restent permis en mouvement réduit : c'est l'utilisateur qui bouge la vue.
  if (!capture) {
    enableInteractions({
      map: fm.map,
      camera,
      container,
      relief: document.querySelector<HTMLElement>(".relief__plot"),
      onZoom: zoomChanged,
    });
  }

  // Tout s'arrête quand aucune des deux pages n'est à l'écran (pied de page) ou que
  // l'onglet passe en arrière-plan.
  const visible = new Set<Element>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
      camera.setPaused("page-hidden", visible.size === 0);
      runner.setPaused("page-hidden", visible.size === 0);
    },
    { threshold: 0.15 },
  );
  for (const p of pages) io.observe(p);

  // La caméra suit le défilement : cadrage de la page 1, puis de la page 2.
  let scrollRaf = 0;
  const onScroll = () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      camera.setProgress(window.scrollY / window.innerHeight);
    });
  };
  if (!capture) {
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
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
    zoomBy(dz) {
      camera.zoomBy(dz);
      zoomChanged();
    },
  };
}
