/**
 * Défilement → état de la page. Une ScrollTrigger par rôle :
 * - scène active (hero, parcours, contenu opaque) : pilote la caméra et les calques ;
 * - progression du coureur dans la section parcours (scrub : lissée, sans à-coups).
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { route } from "../data/route";
import { setState } from "../state";

gsap.registerPlugin(ScrollTrigger);

/** Part du défilement de la section avant le départ, et après l'arrivée (YARD). */
const LEAD_IN = 0.04;
const RUN_END = 0.9;
const YARD_AT = 0.95;

export function initScenes({ staticCourse }: { staticCourse: boolean }) {
  // Scène = qui occupe l'écran. Hero et parcours sont transparents (carte visible) ;
  // la carte doit déjà suivre le coureur quand le parcours entre par le bas de l'écran.
  let hero: ScrollTrigger | undefined;
  let course: ScrollTrigger | undefined;
  const updateScene = () => {
    if (!hero || !course) return;
    setState({ scene: course.isActive ? "course" : hero.isActive ? "hero" : "content" });
  };
  hero = ScrollTrigger.create({ trigger: "#hero", start: "top bottom", end: "bottom top", onToggle: updateScene, onRefresh: updateScene });
  course = ScrollTrigger.create({ trigger: "#parcours", start: "top bottom", end: "bottom top", onToggle: updateScene, onRefresh: updateScene });
  updateScene();
  // Les polices (swap) peuvent changer la hauteur des sections au-dessus du parcours.
  void document.fonts?.ready.then(() => ScrollTrigger.refresh());

  if (staticCourse) {
    // Pas de course pilotée au défilement : boucle entière affichée.
    setState({ courseD: 0 });
    return;
  }

  const progress = { v: 0 };
  gsap.to(progress, {
    v: 1,
    ease: "none",
    scrollTrigger: { trigger: "#parcours", start: "top top", end: "bottom bottom", scrub: 0.6 },
    onUpdate: () => {
      const run = Math.min(Math.max((progress.v - LEAD_IN) / (RUN_END - LEAD_IN), 0), 1);
      setState({ courseD: run * route.totalM, yardDone: progress.v >= YARD_AT });
    },
  });
}
