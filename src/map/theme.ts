/**
 * Thème MapMap « backyard-guerard-foret » : forêt de Brie à l'aube.
 *
 * Source unique du style : `npm run create:style` le publie tel quel comme style
 * hébergé (compilateur canonique : relief, ombrage, fontes par type de label), et
 * la carte le passe au compilateur réduit du SDK en repli de développement tant
 * qu'aucune `VITE_MAPMAP_STYLE_URL` n'est définie.
 */
import { palette } from "../styles/tokens";

/** Exagération du relief : le relief de Guérard est doux (≈ 50–150 m). */
export const TERRAIN_EXAGGERATION = { desktop: 1.6, mobile: 1.2 } as const;

export const HILLSHADE = { intensity: 0.55, direction: 335 } as const;

export const forestTheme = {
  name: "backyard-guerard-foret",
  base: "dark",
  palette: {
    background: palette.sapin,
    landcover: palette.sousBois,
    park: "#2B4A33",
    wood: "#2F5236",
    grass: "#3A5A3A",
    farmland: "#2A3A2A",
    water: "#1E3A44",
    path: "#8A7458",
    road: "#3A4A3E",
    roadMajor: "#4F5E50",
    building: "#2C3A30",
    textPrimary: palette.brume,
    textSecondary: "#A8B39A",
    textHalo: palette.sapin,
  },
  fonts: {
    regular: "Barlow Regular",
    // ignoré par le compilateur réduit du SDK, honoré par le style hébergé
    labels: { place: "Barlow Bold", city: "Barlow Bold" },
  },
  terrain: {
    hillshade: true,
    exaggeration: TERRAIN_EXAGGERATION.desktop,
    shading: { intensity: HILLSHADE.intensity, direction: HILLSHADE.direction },
  },
  layers: { building: { visible: false } },
  // Les cartouches des routes départementales françaises sont jaunes : or le jaune
  // maillot doit rester la seule couleur saturée à l'écran.
  territories: { planet: { road_shields: { visible: false } } },
} as const;

/** Couches de cartouches routiers (même règle, appliquée aussi au runtime). */
export const ROAD_SHIELD_LAYERS = ["road-shields", "road-shields-street"] as const;

export type ForestTheme = typeof forestTheme;

/**
 * Le thème amputé de ce que le compilateur réduit du SDK refuse (il lève une erreur
 * sur `terrain` et `territories`, et ne connaît que `fonts.regular`) : repli DEV uniquement.
 */
export function sdkCompatibleTheme() {
  const { terrain: _terrain, territories: _territories, fonts, ...rest } = forestTheme;
  return { ...rest, fonts: { regular: fonts.regular } };
}
