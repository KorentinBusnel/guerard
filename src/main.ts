import "@fontsource/bebas-neue/400.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/700.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./styles/app.css";
import { initCountdown, initTitleLoop } from "./sections/hero";
import { initInscription } from "./sections/inscription";
import type { Scene } from "./map/boot";

/** `?capture=og|fallback` : vue figée pour générer les images statiques (scripts/capture-images.mjs). */
const capture = new URLSearchParams(location.search).get("capture") as "og" | "fallback" | null;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || !!capture;
const mobile = window.matchMedia("(max-width: 640px)").matches;
if (capture) document.documentElement.classList.add("capture", `capture-${capture}`);
document.documentElement.classList.toggle("reduced-motion", reducedMotion);

/** Sans WebGL 2 (exigé par MapLibre 6) : image statique de la scène derrière la page 1. */
function showMapFallback() {
  document.documentElement.classList.add("no-webgl");
  const poster = document.getElementById("map-poster")!;
  if (poster.querySelector(".map-poster__img")) return;
  const img = new Image();
  img.className = "map-poster__img";
  img.alt = "";
  img.decoding = "async";
  img.onload = () => poster.classList.add("has-image");
  img.src = `${import.meta.env.BASE_URL}img/carte-fallback.webp`;
  poster.prepend(img);
}

initCountdown();
const title = initTitleLoop({ reducedMotion });
initInscription();

// ---------- Commandes de la scène : Pause (tout ce qui bouge), vue de dessus / 3D ----------
const pauseBtn = document.querySelector<HTMLButtonElement>("[data-pause]")!;
const viewBtn = document.querySelector<HTMLButtonElement>("[data-view]")!;
let scene: Scene | null = null;
let userPaused = false;
if (reducedMotion) pauseBtn.hidden = true;
pauseBtn.addEventListener("click", () => {
  userPaused = !userPaused;
  pauseBtn.setAttribute("aria-pressed", String(userPaused));
  pauseBtn.textContent = userPaused ? "Lecture" : "Pause";
  title.setPaused("user", userPaused);
  scene?.setUserPaused(userPaused);
});
viewBtn.addEventListener("click", () => {
  if (!scene) return;
  const topDown = scene.toggleTopDown();
  viewBtn.textContent = topDown ? "Vue 3D" : "Vue de dessus";
});

// Test d'API sans créer de contexte (créer un contexte WebGL coûte cher au chargement) ;
// un vrai échec à la création de la carte bascule aussi sur l'image statique.
const webgl = typeof WebGL2RenderingContext !== "undefined";
const accueil = document.getElementById("accueil")!;

if (!webgl) {
  showMapFallback();
} else {
  // La scène 3D (MapLibre + SDK, ~1 Mo, chunk séparé) démarre après le premier affichage :
  // à la première interaction, ou peu après le chargement. Le titre et le compte à rebours
  // s'affichent tout de suite, devant le tracé dessiné en SVG.
  const INTERACTIONS = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "wheel"] as const;
  let started = false;
  const startMap = () => {
    if (started) return;
    started = true;
    for (const type of INTERACTIONS) window.removeEventListener(type, startMap);
    import("./map/boot")
      .then(({ bootMap }) => bootMap({ mobile, reducedMotion, capture, page: accueil, userPaused }))
      .then((s) => {
        scene = s;
        viewBtn.hidden = false;
        if (!reducedMotion) document.querySelector<HTMLElement>("[data-hint]")!.hidden = false;
        document.querySelector<HTMLElement>("[data-readout]")!.hidden = reducedMotion;
      })
      .catch((err) => {
        console.error("[guerard] carte indisponible", err);
        showMapFallback();
      });
  };
  if (capture) startMap();
  else {
    for (const type of INTERACTIONS) window.addEventListener(type, startMap, { once: true, passive: true });
    const idle = () => window.setTimeout(startMap, 3500);
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
  }
}
