import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { routeSvgPath, viewStrings } from "./src/content/view";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Gabarit statique de index.html : `{{clé}}` (texte échappé) et `{{svg:route}}`.
 * Les textes viennent de src/content (event.ts + route.json) et sont écrits dans le HTML
 * au build : lisibles sans JS, indexables, sans saut de mise en page.
 */
function contentTemplate(): Plugin {
  return {
    name: "guerard-content",
    transformIndexHtml(html) {
      const strings = viewStrings();
      return html
        .replace(/\{\{svg:route\}\}/g, routeSvgPath())
        .replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
          if (!(key in strings)) throw new Error(`index.html : clé de contenu inconnue ${match}`);
          return escapeHtml(strings[key]);
        });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), contentTemplate()],
  // Seules les variables VITE_* atteignent le bundle : MAPMAP_API_KEY (serveur) reste hors du navigateur.
  envPrefix: "VITE_",
  build: {
    target: "es2022",
    // MapLibre + SDK forment un chunk à part, chargé après le premier rendu
    chunkSizeWarningLimit: 1400,
  },
});
