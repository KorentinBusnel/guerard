/**
 * Tout ce qui sert sous le hero (HUD, profil, compteur, défilement GSAP) : chunk
 * chargé après le premier rendu, pour ne pas alourdir l'affichage initial.
 */
export { initCourse } from "./course";
export { initContent } from "./content";
export { initPeloton } from "./peloton";
export { initScenes } from "../scroll/scenes";
