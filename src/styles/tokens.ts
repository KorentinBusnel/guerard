/**
 * Palette du brief. Miroir TypeScript des tokens CSS de `app.css` (`@theme`) :
 * la carte et les scripts en ont besoin hors CSS. Garder les deux synchronisés.
 *
 * Règle : le jaune maillot est la SEULE couleur saturée à l'écran.
 */
export const palette = {
  sapin: "#14281D",
  sousBois: "#1F3A2B",
  mousse: "#4F6B3A",
  fougere: "#8BA35A",
  ecorce: "#5A4632",
  brume: "#EDEAE0",
  maillot: "#F2C230",
  flamme: "#C8302B",
} as const;

/**
 * Pentes du profil d'étape (codes du Tour : vert < 3 %, jaune 3–6 %, orange 6–9 %,
 * rouge > 9 %), désaturées pour que le jaune maillot reste seul saturé à l'écran.
 */
export const gradeBins = [
  { max: 3, color: "#7E9452", label: "< 3 %" },
  { max: 6, color: "#B39E52", label: "3–6 %" },
  { max: 9, color: "#B26E3E", label: "6–9 %" },
  { max: Infinity, color: palette.flamme, label: "> 9 %" },
] as const;

export const gradeBin = (grade: number) => gradeBins.findIndex((b) => grade < b.max);
