/**
 * Palette « field guide » (référence de design San Rita). Miroir TypeScript des tokens
 * CSS de `app.css` (`@theme`) : la carte et les scripts en ont besoin hors CSS.
 *
 * Règle : Highlighter Mint est la SEULE couleur de marque ; le reste est la gamme de
 * cinq neutres (topo → sage → charcoal → carbon → noir).
 */
export const palette = {
  mint: "#e2ffcc",
  sage: "#84907f",
  carbon: "#161b13",
  charcoal: "#2d3329",
  topo: "#dde2e4",
  black: "#000000",
} as const;
