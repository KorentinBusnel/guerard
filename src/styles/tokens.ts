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
