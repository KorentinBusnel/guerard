import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { routeSvgPath, viewStrings } from "./src/content/view.ts";
import { viewHtml } from "./src/content/blocks.ts";
import { escapeHtml } from "./src/lib/html.ts";

/**
 * Gabarit statique de index.html : `{{clé}}` (texte échappé), `{{html:clé}}` (blocs
 * générés par src/content/blocks.ts) et `{{svg:route}}`.
 * Les textes viennent de src/content (event.ts + route.json) et sont écrits dans le HTML
 * au build : lisibles sans JS, indexables, sans saut de mise en page.
 */
function contentTemplate(): Plugin {
  return {
    name: "guerard-content",
    transformIndexHtml(html) {
      // URL publique du site (SITE_URL au build) : og:image doit être absolue pour la
      // plupart des aperçus de liens.
      const site = (process.env.SITE_URL ?? "").replace(/\/$/, "");
      const strings: Record<string, string> = {
        ...viewStrings(),
        ogImage: `${site}/img/og.jpg`,
        siteUrl: `${site}/`,
      };
      const blocks = viewHtml();
      return html
        .replace(/\{\{svg:route\}\}/g, routeSvgPath())
        .replace(/\{\{html:(\w+)\}\}/g, (match, key: string) => {
          if (!(key in blocks)) throw new Error(`index.html : bloc inconnu ${match}`);
          return blocks[key];
        })
        .replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
          if (!(key in strings)) throw new Error(`index.html : clé de contenu inconnue ${match}`);
          return escapeHtml(strings[key]);
        });
    },
  };
}

/**
 * Précharge les polices du premier écran (titre, compte à rebours, légendes) : sans cela
 * elles ne sont découvertes qu'après le CSS et leur arrivée décale la mise en page.
 */
const CRITICAL_FONTS = [/bebas-neue-latin-400-normal-[\w-]+\.woff2$/, /ibm-plex-mono-latin-400-normal-[\w-]+\.woff2$/];

function preloadFonts(): Plugin {
  let base = "/";
  return {
    name: "guerard-preload-fonts",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const files = Object.keys(ctx.bundle ?? {}).filter((f) => CRITICAL_FONTS.some((re) => re.test(f)));
        if (files.length !== CRITICAL_FONTS.length) throw new Error(`polices critiques introuvables dans le bundle : ${files.join(", ")}`);
        return files.map((f) => ({
          tag: "link",
          attrs: { rel: "preload", as: "font", type: "font/woff2", href: `${base}${f}`, crossorigin: "" },
          injectTo: "head" as const,
        }));
      },
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), contentTemplate(), preloadFonts()],
  // Seules les variables VITE_* atteignent le bundle : MAPMAP_API_KEY (serveur) reste hors du navigateur.
  envPrefix: "VITE_",
  build: {
    target: "es2022",
    // MapLibre + SDK forment un chunk à part, chargé après le premier rendu
    chunkSizeWarningLimit: 1400,
  },
});
