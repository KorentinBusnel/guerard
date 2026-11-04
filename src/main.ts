import "@fontsource/bebas-neue/400.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/700.css";
import "./styles/app.css";
import { initCountdown, initLoopArt } from "./sections/hero";
import { initInscription } from "./sections/inscription";

/** `?capture=og|fallback` : vue figée pour générer les images statiques (scripts/capture-images.mjs). */
const capture = new URLSearchParams(location.search).get("capture") as "og" | "fallback" | null;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || !!capture;
const mobile = window.matchMedia("(max-width: 640px)").matches;
if (capture) document.documentElement.classList.add("capture", `capture-${capture}`);
document.documentElement.classList.toggle("reduced-motion", reducedMotion);

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

initCountdown();
initLoopArt({ reducedMotion });
initInscription();

// Test d'API sans créer de contexte (créer un contexte WebGL coûte cher au chargement) ;
// un vrai échec à la création de la carte bascule aussi sur l'image statique.
const webgl = typeof WebGL2RenderingContext !== "undefined";
const boucle = document.getElementById("boucle")!;

if (!webgl) {
  showMapFallback();
} else {
  // La carte (MapLibre + SDK, ~1 Mo, chunk séparé) ne sert qu'à la page 2 : on la charge
  // quand on s'en approche, pas au premier affichage.
  let started = false;
  const startMap = () => {
    if (started) return;
    started = true;
    import("./map/boot")
      .then(({ bootMap }) => bootMap({ mobile, reducedMotion, capture, page: boucle }))
      .catch((err) => {
        console.error("[guerard] carte indisponible", err);
        showMapFallback();
      });
  };
  if (capture) startMap();
  else {
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          io.disconnect();
          startMap();
        }
      },
      { rootMargin: "60% 0px" },
    );
    // Sur grand écran la page 2 commence juste sous la ligne de flottaison : l'observateur
    // seul lancerait la carte au chargement. On attend donc le premier défilement (ou une
    // arrivée déjà défilée / sur #boucle) avant de guetter son approche.
    const arm = () => io.observe(boucle);
    if (window.scrollY > 0 || location.hash) arm();
    else window.addEventListener("scroll", arm, { once: true, passive: true });
  }
}
