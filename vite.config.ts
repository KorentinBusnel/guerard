import { defineConfig, loadEnv, type HtmlTagDescriptor, type Plugin } from "vite";
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
function contentTemplate(siteUrl: string): Plugin {
  return {
    name: "guerard-content",
    transformIndexHtml(html) {
      // URL publique du site : og:image et og:url doivent être absolues, sinon WhatsApp,
      // Facebook, LinkedIn ou iMessage n'affichent pas l'aperçu du lien.
      const site = siteUrl.replace(/\/$/, "");
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
const CRITICAL_FONTS = [
  /archivo-black-expanded-caps-[\w-]+\.woff2$/,
  /bebas-neue-latin-400-normal-[\w-]+\.woff2$/,
  /ibm-plex-mono-latin-400-normal-[\w-]+\.woff2$/,
];

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
        const bundle = ctx.bundle ?? {};
        const files = Object.keys(bundle).filter((f) => CRITICAL_FONTS.some((re) => re.test(f)));
        if (files.length !== CRITICAL_FONTS.length) throw new Error(`polices critiques introuvables dans le bundle : ${files.join(", ")}`);
        const tags: HtmlTagDescriptor[] = files.map((f) => ({
          tag: "link",
          attrs: { rel: "preload", as: "font", type: "font/woff2", href: `${base}${f}`, crossorigin: "" },
          injectTo: "head",
        }));
        // Pas de préchargement de la scène 3D ici : ses 370 Ko (gzip) prendraient la bande
        // passante des polices et retarderaient le premier affichage (LCP). main.ts la
        // télécharge dès la fin du chargement.
        return tags;
      },
    },
  };
}

/**
 * URL publique : SITE_URL (.env.production ou environnement), sinon le domaine de
 * production que Vercel expose au build.
 */
function siteUrlFor(mode: string): string {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.SITE_URL) return env.SITE_URL;
  return env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : "";
}

export default defineConfig(({ mode }) => ({
  plugins: [tailwindcss(), contentTemplate(siteUrlFor(mode)), preloadFonts()],
  // Seules les variables VITE_* atteignent le bundle : MAPMAP_API_KEY (serveur) reste hors du navigateur.
  envPrefix: "VITE_",
  build: {
    target: "es2022",
    // MapLibre + SDK forment un chunk à part, chargé après le premier rendu
    chunkSizeWarningLimit: 1400,
  },
}));
