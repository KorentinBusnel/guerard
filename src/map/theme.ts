/**
 * Thème MapMap « again-and-again-topo » : la forêt de Guérard en papier topo de nuit.
 *
 * Source unique du style : `npm run create:style` le publie tel quel comme style
 * hébergé (compilateur canonique : relief, ombrage, fontes par type de label), et
 * la carte le passe au compilateur réduit du SDK en repli de développement tant
 * qu'aucune `VITE_MAPMAP_STYLE_URL` n'est définie.
 */
import { palette } from "../styles/tokens";

/** Exagération du relief : le relief de Guérard est doux (≈ 50–150 m). */
export const TERRAIN_EXAGGERATION = { desktop: 2.2, mobile: 1.8 } as const;

export const HILLSHADE = { intensity: 0.55, direction: 335 } as const;

export const forestTheme = {
  name: "again-and-again-topo",
  base: "dark",
  // Carte « papier topo de nuit » : la gamme de neutres du design, le tracé seul en menthe.
  palette: {
    background: palette.carbon,
    landcover: palette.carbon,
    landuse: palette.carbon,
    park: palette.charcoal,
    wood: palette.charcoal,
    grass: "#20261c",
    farmland: "#1b2117",
    water: palette.black,
    waterway: palette.black,
    path: palette.sage,
    road: palette.charcoal,
    roadMajor: "#4a5245",
    building: palette.charcoal,
    textPrimary: palette.topo,
    textSecondary: palette.sage,
    textHalo: palette.carbon,
  },
  fonts: {
    regular: "IBM Plex Sans Regular",
    // ignoré par le compilateur réduit du SDK, honoré par le style hébergé
    labels: { place: "IBM Plex Sans Bold", city: "IBM Plex Sans Bold" },
  },
  terrain: {
    hillshade: true,
    exaggeration: TERRAIN_EXAGGERATION.desktop,
    shading: { intensity: HILLSHADE.intensity, direction: HILLSHADE.direction },
  },
  layers: { building: { visible: false } },
  // Les cartouches routiers sont colorés : la menthe doit rester la seule couleur à l'écran.
  territories: { planet: { road_shields: { visible: false } } },
} as const;

export type ForestTheme = typeof forestTheme;

/**
 * Le thème amputé de ce que le compilateur réduit du SDK refuse (il lève une erreur
 * sur `terrain` et `territories`, et ne connaît que `fonts.regular`) : repli DEV uniquement.
 */
export function sdkCompatibleTheme() {
  const { terrain: _terrain, territories: _territories, fonts, ...rest } = forestTheme;
  return { ...rest, fonts: { regular: fonts.regular } };
}
