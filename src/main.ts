import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/900.css";
import "@fontsource-variable/inter";
import "./styles/app.css";
import { route } from "./data/route";
import { daysToGo } from "./content/view";

/** `?capture=og|fallback` : vue figée pour générer les images statiques (scripts/capture-images.mjs). */
const capture = new URLSearchParams(location.search).get("capture") as "og" | "fallback" | null;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || !!capture;
const mobile = window.matchMedia("(max-width: 640px)").matches;
if (capture) document.documentElement.classList.add("capture", `capture-${capture}`);

function badge(text: string, tone: "flamme" | "muted") {
  const el = document.createElement("span");
  el.className = tone === "flamme" ? "bg-flamme px-2 py-1 text-white" : "bg-black/70 px-2 py-1 text-brume/80";
  el.textContent = text;
  document.getElementById("dev-badges")?.append(el);
}

function renderCountdown() {
  const days = daysToGo();
  if (days === null) return; // date non fournie : « J-? » reste affiché
  const value = document.querySelector<HTMLElement>("[data-countdown]")!;
  const sr = document.querySelector<HTMLElement>("[data-countdown-sr]")!;
  value.textContent = days > 0 ? `J-${days}` : days === 0 ? "Jour J" : "C'est parti";
  sr.textContent = days > 0 ? `Départ dans ${days} jours.` : "";
}

/** Sans WebGL 2 (exigé par MapLibre 6) : image statique de la carte sous l'affiche du tracé. */
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

// Test d'API sans créer de contexte (créer un contexte WebGL coûte cher au chargement) ;
// un vrai échec à la création de la carte bascule aussi sur l'image statique.
const webgl = typeof WebGL2RenderingContext !== "undefined";
/** Mouvement réduit ou pas de WebGL : section parcours en vue statique, sans défilement piloté. */
const staticCourse = reducedMotion || !webgl;

const onIdle = (fn: () => void) =>
  "requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 0);

/** Une tâche par étape, quand le navigateur est libre : pas de longue tâche au chargement. */
function idleSteps(steps: (() => void)[]) {
  const next = () => {
    const step = steps.shift();
    if (!step) return;
    step();
    onIdle(next);
  };
  onIdle(next);
}

renderCountdown();
document.documentElement.classList.toggle("reduced-motion", reducedMotion);
document.documentElement.classList.toggle("static-course", staticCourse);
// HUD, profil, compteur et défilement ne servent qu'en dessous du hero : chunk séparé,
// initialisé après le premier rendu.
import("./sections/belowFold")
  .then(({ initCourse, initContent, initPeloton, initScenes }) =>
    idleSteps([
      () => initCourse({ staticCourse }),
      () => initContent({ reducedMotion }),
      () => initPeloton(),
      () => initScenes({ staticCourse }),
    ]),
  )
  .catch((err) => console.error("[guerard] sections indisponibles", err));
if (route.meta.mock && !capture) badge("Tracé MOCK — boucle fictive", "flamme");

/**
 * Lance `start` à la première interaction, ou à défaut quand la page est calme après le
 * chargement (l'affiche du tracé a fini de se dessiner). La carte WebGL est le plus gros
 * coût de la page : elle ne doit pas concurrencer le premier affichage.
 */
function whenEngagedOrIdle(start: () => void, idleDelayMs: number) {
  const events = ["pointerdown", "pointermove", "touchstart", "wheel", "keydown", "scroll"] as const;
  let started = false;
  const go = () => {
    if (started) return;
    started = true;
    for (const e of events) removeEventListener(e, go);
    start();
  };
  for (const e of events) addEventListener(e, go, { passive: true, once: true });
  const onLoad = () =>
    setTimeout(() => ("requestIdleCallback" in window ? requestIdleCallback(go, { timeout: 1500 }) : go()), idleDelayMs);
  if (document.readyState === "complete") onLoad();
  else addEventListener("load", onLoad, { once: true });
}

if (webgl) {
  // Chunk séparé (MapLibre + SDK, ~1 Mo) : le hero s'affiche sans l'attendre.
  const startMap = () =>
    import("./map/boot")
      .then(({ bootMap }) => bootMap({ mobile, reducedMotion, badge, capture }))
      .catch((err) => {
        console.error("[guerard] carte indisponible", err);
        showMapFallback();
      });
  if (capture) startMap();
  else whenEngagedOrIdle(startMap, 3500);
} else {
  showMapFallback();
}
