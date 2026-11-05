/**
 * La scène 3D en fond de la page 1 (chunk chargé juste après le premier affichage) : la
 * boucle en grand sur le relief, le coureur qui en fait le tour, encore et encore,
 * l'orbite lente. On la fait tourner, on zoome, on lit le km et l'altitude du tracé
 * (src/map/interact.ts). La page 2, opaque, la recouvre.
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
  /** La page 1, devant la scène : elle ne tourne que si cette page est à l'écran. */
  page: HTMLElement;
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

/**
 * On dévoile la carte quand les tuiles du cadrage sont là, mais sans faire attendre :
 * au plus tard après ce délai, le relief finit d'arriver sous les yeux.
 */
const REVEAL_MAX_MS = 2500;

export async function bootMap({ mobile, reducedMotion, capture, page, userPaused, onZoomChange }: BootOptions): Promise<Scene> {
  const container = document.getElementById("map")!;
  const fm = await createForestMap({ container, mobile });
  const still = reducedMotion || !!capture;
  const camera = new HeliCamera(fm.map, { mobile, reducedMotion: still });
  camera.orbit();
  camera.setSpin(!userPaused);

  // Les tuiles du cadrage, puis on dévoile la carte (les captures attendent tout).
  const ready = fm.mm.whenReady();
  await (capture ? ready : Promise.race([ready, new Promise((r) => setTimeout(r, REVEAL_MAX_MS))]));
  document.documentElement.classList.add("map-ready");

  const runner = new Runner(fm, { readout: document.querySelector<HTMLElement>("[data-readout]") });
  if (still) runner.showStatic();
  else if (userPaused) runner.setPaused("user", true);
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

  // Tout s'arrête quand la page 1 quitte l'écran (la page 2 recouvre la scène) ou que
  // l'onglet passe en arrière-plan.
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
    zoomBy(dz) {
      camera.zoomBy(dz);
      zoomChanged();
    },
  };
}
