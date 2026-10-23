import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/900.css";
import "@fontsource-variable/inter";
import "./styles/app.css";
import { route } from "./data/route";
import { daysToGo } from "./content/view";
import { initCourse } from "./sections/course";
import { initContent } from "./sections/content";
import { initScenes } from "./scroll/scenes";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobile = window.matchMedia("(max-width: 640px)").matches;

function badge(text: string, tone: "flamme" | "muted") {
  const el = document.createElement("span");
  el.className = tone === "flamme" ? "bg-flamme px-2 py-1 text-brume" : "bg-black/70 px-2 py-1 text-brume/80";
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

/** MapLibre 6 exige WebGL 2 : sans lui, l'affiche du tracé reste en place. */
function webgl2Available() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

renderCountdown();
if (reducedMotion) document.documentElement.classList.add("reduced-motion");
initCourse();
initContent({ reducedMotion });
initScenes({ reducedMotion });
if (route.meta.mock) badge("Tracé MOCK — boucle fictive", "flamme");

if (webgl2Available()) {
  // Chunk séparé (MapLibre + SDK, ~1 Mo) : le hero s'affiche sans l'attendre.
  import("./map/boot")
    .then(({ bootMap }) => bootMap({ mobile, reducedMotion, badge }))
    .catch((err) => console.error("[guerard] carte indisponible", err));
} else {
  document.documentElement.classList.add("no-webgl");
}
