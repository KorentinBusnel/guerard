/**
 * La scène 3D en fond de la page 1 (chunk chargé juste après le premier affichage) : la
 * boucle en grand sur le relief, le coureur qui en fait le tour, encore et encore,
 * l'orbite lente. On la fait tourner, on zoome, on lit le km et l'altitude du tracé
 * (src/map/interact.ts). La page 2, opaque, la recouvre.
 */
import { createForestMap } from "./forestMap";
import { HeliCamera, type FreeArea } from "./camera";
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

/**
 * L'espace libre de la page 1, mesuré dans le DOM (en coordonnées de page : la page 1
 * est en haut du document). Compte à rebours et commandes côte à côte (grand écran,
 * téléphone à l'horizontale) : la boucle à droite du compte à rebours, sous le titre.
 * Empilés (téléphone, tablette) : entre le titre et le compte à rebours, ou à droite
 * de celui-ci s'il ne reste pas assez de hauteur (téléphone à l'horizontale).
 */
function measureFreeArea(): FreeArea | null {
  const rect = (sel: string) => document.querySelector(sel)?.getBoundingClientRect();
  const title = rect(".title-loop");
  const countdown = rect(".countdown");
  const ui = rect(".scene-ui");
  if (!title || !countdown || !ui) return null;
  const sy = window.scrollY;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const top = Math.round(title.bottom + sy + 14);
  const stacked = ui.top >= countdown.bottom - 1;
  if (stacked) {
    const bottom = Math.max(Math.round(vh - (countdown.top + sy) + 12), 0);
    // Assez de hauteur entre le titre et le compte à rebours : la boucle s'y loge.
    // Sinon (téléphone à l'horizontale), elle passe à droite du compte à rebours.
    if (vh - top - bottom >= 140 || vw - countdown.right < 280) return { top, bottom, left: 8, right: 8 };
  }
  return { top, bottom: Math.round(vh * 0.04), left: Math.round(countdown.right + 24), right: Math.round(vw * 0.02) };
}

export async function bootMap({ mobile, reducedMotion, capture, page, userPaused, onZoomChange }: BootOptions): Promise<Scene> {
  const container = document.getElementById("map")!;
  const fm = await createForestMap({ container, mobile });
  const still = reducedMotion || !!capture;
  const camera = new HeliCamera(fm.map, { mobile, reducedMotion: still, freeArea: measureFreeArea });
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
  // Rotation d'écran, fenêtre redimensionnée, ou mise en page de la page 1 qui change
  // (boutons de la scène qui apparaissent, retour à la ligne) : on recadre la boucle.
  let resizeTimer = 0;
  const reframe = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => camera.orbit(), 150);
  };
  window.addEventListener("resize", reframe);
  const layout = new ResizeObserver(reframe);
  for (const sel of [".accueil__title", ".accueil__bottom"]) {
    const el = document.querySelector(sel);
    if (el) layout.observe(el);
  }

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
