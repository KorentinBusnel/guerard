import { route } from "../data/route.ts";

/** Paliers de distance (compteur de yards, paliers du peloton). */
export const milestones = [
  { label: "Semi-marathon", short: "Semi", km: 21.0975, than: "qu'un semi-marathon" },
  { label: "Marathon", short: "Marathon", km: 42.195, than: "qu'un marathon" },
  { label: "100 km", short: "100 km", km: 100, than: "de 100 km" },
  { label: "100 miles", short: "100 miles", km: 160.934, than: "de 100 miles" },
] as const;

/** Nombre de yards pour atteindre un palier, sur la boucle réelle. */
export const yardsFor = (milestoneKm: number) => Math.ceil((milestoneKm * 1000) / route.totalM);
