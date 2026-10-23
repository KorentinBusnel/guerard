import "@fontsource/barlow-condensed/700.css";
import "@fontsource/barlow-condensed/900.css";
import "@fontsource-variable/inter";
import "./styles/app.css";
import { createForestMap } from "./map/forestMap";
import { route } from "./data/route";
import { event } from "./content/event";

const km = (m: number, digits = 1) =>
  (m / 1000).toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function renderBanner() {
  const name = document.querySelector<HTMLElement>('[data-tv="name"]')!;
  const stats = document.querySelector<HTMLElement>('[data-tv="stats"]')!;
  name.textContent = event.name;
  // distance réelle du GPX, jamais codée en dur
  stats.textContent = `${km(route.totalM)} KM · D+ ${route.dPlus} M`;
  document.getElementById("tv-banner-text")!.textContent =
    `${event.name} : boucle de ${km(route.totalM, 3)} km, ${route.dPlus} m de dénivelé positif.`;
}

function badge(text: string, tone: "flamme" | "muted") {
  const el = document.createElement("span");
  el.className =
    tone === "flamme" ? "bg-flamme px-2 py-1 text-brume" : "bg-black/70 px-2 py-1 font-semibold text-brume/80";
  el.textContent = text;
  document.getElementById("dev-badges")!.append(el);
}

async function boot() {
  renderBanner();
  if (route.meta.mock) badge("Tracé MOCK — boucle fictive", "flamme");

  const mobile = window.matchMedia("(max-width: 640px)").matches;
  const { map, styleMode } = await createForestMap({ container: document.getElementById("map")!, mobile });
  if (styleMode === "sdk-dev") badge("Style : repli SDK (dev)", "muted");

  map.once("idle", () => document.body.setAttribute("data-map-ready", ""));
  if (import.meta.env.DEV) Object.assign(window, { __map: map });
}

boot().catch((err) => {
  console.error(err);
});
