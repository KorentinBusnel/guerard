# Again and Again — Backyard de Guérard

Landing de la backyard ultra de Guérard (77), édition « Again and Again », le
28 novembre 2026. Deux pages :

1. **Accueil** : le titre (ses lettres filent et reviennent toutes les 4 s) et le compte
   à rebours, devant la **boucle GPX en 3D** : le tracé en grand sur le relief, dressé
   d'un « mur » d'altitude, un coureur qui fait le tour et allume le mur sur son passage
   (« Yard 01, 02… »), en orbite lente. On la fait tourner en la glissant ; boutons
   Pause et Vue de dessus / Vue 3D.
2. **La boucle et l'inscription** (en scrollant, devant la même scène 3D, que la caméra
   recadre dans l'espace libre) : distance, D+, altitudes, montées ; l'inscription
   **seul ou avec un ami** ; au bas, le **relief en grand** (profil d'altitude avec
   kilomètres, montées et points haut et bas).

**Stack** : Vite + TypeScript vanilla, Tailwind v4, carte MapMap (`@mapmap/maps` sur
MapLibre GL 6). Pas de framework : une page courte, l'essentiel est impératif (rAF,
MapLibre).

## Démarrer

```sh
npm install
npm run dev             # http://localhost:5173
npm run build           # typecheck + build prod dans dist/
npm run preview         # sert dist/
```

En local, la carte fonctionne **sans clé** (les tuiles sans clé servent localhost).
En production, sans `VITE_MAPMAP_KEY`, la scène n'affiche que le relief (ni forêt, ni
routes, ni rivières, ni villages).

## Variables d'environnement

Copier `.env.example` en `.env` (en prod : variables du projet Vercel).

| Variable | Où | Rôle |
|---|---|---|
| `VITE_INSCRIPTION_ENDPOINT` | navigateur | Adresse qui reçoit les inscriptions (ci-dessous). Vide → bouton désactivé. |
| `VITE_MAPMAP_KEY` | navigateur | Clé MapMap restreinte à l'origine du site. **Nécessaire en prod** pour la forêt, les routes, les rivières et les villages (sans elle : relief seul). |
| `VITE_MAPMAP_STYLE_URL` | navigateur | Style hébergé, écrit dans `.env.local` par `npm run create:style`. |
| `SITE_URL` | build | URL publique (rend `og:image` absolue). |
| `MAPMAP_API_KEY` | scripts uniquement | `prepare:route`, `create:style`, `static:map`. Jamais dans le bundle : Vite n'expose que `VITE_*`. |

## Inscription

Le formulaire (`src/sections/inscription.ts`) envoie un `POST` JSON à
`VITE_INSCRIPTION_ENDPOINT` avec `Accept: application/json` :

```json
{ "formule": "solo|duo", "nom": "…", "email": "…", "ami_nom": "…", "ami_email": "…",
  "consentement": true, "edition": "Again and Again",
  "_subject": "Inscription Again and Again — duo", "_replyto": "…" }
```

C'est le format de **Formspree** : créer un formulaire sur formspree.io, coller son URL
(`https://formspree.io/f/xxxxxxxx`) dans `VITE_INSCRIPTION_ENDPOINT`, redéployer. Chaque
inscription arrive par e-mail à l'organisateur et reste exportable en CSV. Tout autre
service qui accepte un POST JSON convient. Anti-spam : champ pot de miel `_gotcha`.
Case de consentement obligatoire ; le lien vers les mentions légales vient de
`event.legalUrl`.

## Contenu

| Fichier | Statut |
|---|---|
| `src/content/event.ts` | Nom, édition, date, heure de départ, tarif, dossards, organisateur, contact, mentions légales. `null` = placeholder `[… À CONFIRMER]` à l'écran. |
| `data/boucle.gpx` | Tracé officiel (lat/lon/ele uniquement : heure et fréquence cardiaque retirées). |

Le compte à rebours vise `event.date` à `event.startTime` (heure de Paris) ; tant que
l'heure n'est pas connue, il vise minuit.

Les textes sont écrits dans `index.html` **au build** (gabarit `{{clé}}` / `{{html:bloc}}`
/ `{{svg:route}}`, cf. `vite.config.ts`, `src/content/view.ts`, `src/content/blocks.ts`) :
la page se lit sans JS.

## Scripts de données (build-time, résultats commités)

| Script | Rôle |
|---|---|
| `npm run prepare:route` | `data/boucle.gpx` → `src/data/route.json` : distances, altitude, pente lissée, D+, montées. |
| `npm run create:style` | Publie le thème carte comme style hébergé MapMap et écrit l'URL dans `.env.local`. Clé serveur requise. |
| `npm run capture:images` | Après `npm run build` : capture `public/img/og.jpg` et `public/img/carte-fallback.webp` depuis la page (`?capture=og|fallback`). Navigateur : `CHROME_PATH`, sinon Chrome installé. |
| `npm run static:map` | Mêmes images via l'API Static Map de MapMap. À ce jour son rendu ne couvre pas la France (fond vide) : d'où `capture:images`. |

Nouveau tracé : `npm run prepare:route && npm run build && npm run capture:images`.

## Design

Référence « San Rita » (guide de terrain sur papier sauge), adaptée en nuit pour la
carte :

- **Couleurs** : un seul accent, Highlighter Mint `#e2ffcc` (titre, tracé, chiffres) ;
  neutres Carbon Ink `#161b13`, Forest Charcoal `#2d3329`, Sage Stone `#84907f`,
  Topo Gray `#dde2e4`. Tokens dans `src/styles/app.css` (`@theme`) et
  `src/styles/tokens.ts` (carte, SVG).
- **Typo** : le titre « Again and Again » en Archivo Black étendu (capitales larges,
  droites, « rapides ») ; Bebas Neue pour le nom, les chiffres et les titres
  (interligne 0,9) ; IBM Plex Mono en capitales 12–16 px (légendes, boutons,
  formulaire) ; Times pour les liens de texte. La police du titre est une instance
  statique 900/125 de la police variable Archivo réduite aux capitales (5 Ko,
  `src/assets/fonts/`, licence OFL jointe), faite avec fonttools :
  `fonttools varLib.instancer archivo-latin-wdth-normal.woff2 wght=900 wdth=125` puis
  `pyftsubset … --unicodes="U+0020-005A,U+00C0-00DE,U+0152,U+2019,U+2013,U+2014,U+00B7" --flavor=woff2`
  (source : `@fontsource-variable/archivo`, en dépendance de dev).
- Angles droits, aucune ombre, boutons en contour 1 px, gouttière 24/40 px.
- **Titre en boucle** : toutes les 4 s, les lettres filent vers la droite en traînée
  floue et reviennent par la gauche, en vague (`src/sections/hero.ts`).

## Scène 3D (fond des deux pages)

- Calque `#map-layer` fixe, sous les deux pages (transparentes) ; le pied de page,
  opaque, le recouvre.
- **Mur d'altitude** (`src/map/wall.ts`) : le tracé découpé en tronçons de ~15 m,
  extrudés (`fill-extrusion`) à une hauteur qui suit l'altitude ; MapLibre pose chaque
  tronçon sur le relief. Le coureur (`src/map/runner.ts`, un tour en 26 s) les allume
  par `feature-state`, sans relancer le découpage des tuiles.
- **Caméra** (`src/map/camera.ts`) : la boucle occupe l'espace libre sous le titre, puis
  (grand écran) à gauche du formulaire de la page 2, au fil du défilement ; orbite lente, glisser pour tourner (au doigt : horizontal seulement, le vertical reste
  au défilement), transition vue de dessus / 3D. Relief exagéré ×2,2 (×1,8 mobile).
- MapLibre + SDK (~1 Mo) sont un chunk séparé, chargé à la première interaction ou
  3,5 s après le chargement ; avant, le tracé est dessiné en SVG à la même place.
  Tout s'arrête quand aucune des deux pages n'est à l'écran ou que l'onglet est caché.
- **Fond épuré** (`trimBasemap`, `src/map/forestMap.ts`) : sur le relief ombré, on ne
  garde que la forêt (seule couverture du sol affichée), l'eau et les rivières, les
  routes (sans chemins ni rail) et les noms de villes et villages ; bâti, points
  d'intérêt, noms de rues, cartouches et limites sont masqués (leurs tuiles ne sont pas
  téléchargées).
- Thème dans `src/map/theme.ts`. Sans `VITE_MAPMAP_STYLE_URL`, repli sur le compilateur
  réduit du SDK (qui refuse le bloc `terrain`) : relief et ombrage demandés au SDK.
- Sans clé (`VITE_MAPMAP_KEY`) hors localhost, le fond vectoriel est refusé (403) :
  forêt, routes, rivières et villages disparaissent, il reste le relief, la boucle et
  son mur.
- Logo MapMap (bas droite) et attribution (bas gauche) : jamais masqués ni recouverts
  (voile de lisibilité placé sous les coins de contrôle, bas des pages laissé libre).

## Accessibilité, mouvement, fallback

- Bouton **Pause** (page 1 et page 2) : arrête tout ce qui bouge (titre, orbite,
  coureur).
- `prefers-reduced-motion` : titre figé, scène fixe sans orbite ni coureur, mur
  entièrement allumé.
- Sans WebGL 2 ou si MapLibre échoue : image statique de la scène (`carte-fallback.webp`).
- Titre animé en `aria-hidden`, doublé d'un texte pour les lecteurs d'écran ; compte à
  rebours étiqueté ; relief décrit par sa légende ; statut du formulaire en
  `role="status"`.

## Lighthouse (build prod, Chromium headless sans GPU)

Mobile (3 passes) et desktop : performance 100, accessibilité 100, bonnes pratiques 100,
SEO 100 (TBT 0 ms, CLS 0). Les trois polices du premier écran sont préchargées au build
(`vite.config.ts`) : sans cela leur arrivée décalait la mise en page (CLS 0,28).

## Pièges traités

- **Carte blanche sous Vite** : worker MapLibre 6 copié dans `public/vendor/maplibre/`
  avant chaque `dev`/`build` + `setWorkerUrl`.
- **Tailwind v4 vs `maplibre-gl.css`** : CSS MapLibre dans le layer `vendor`, entre
  `base` et `utilities`, chargé avec le chunk carte (`src/map/vendor.css`) ; `#map`
  positionné en style inline.
- **`cameraForBounds`** : padding remis à zéro avant le calcul (sinon il s'additionne au
  padding posé sur la carte et dézoome).
- **Double ombrage** : avec le style hébergé, `hillshade: false` côté SDK.
- **Mur qui s'allume** : changer une propriété *data-driven* (couleur par expression)
  relance le découpage de toute la source ; `feature-state` ne met à jour que la
  peinture des tronçons touchés.
- **Orbite et transitions** : le `jumpTo` de l'orbite couperait un `easeTo` à l'image
  suivante ; l'inclinaison (vue de dessus / 3D) est donc animée dans la même boucle.

## Outils agents

- Skills MapMap dans `.claude/skills/` (`npx skills add Mapmapai/mapmap-agent-skills`).
  `mapmap-web-maps-integration` est copié à la main : son frontmatter YAML est invalide en
  amont et le CLI `skills` le saute.
- MCP MapMap hébergé déclaré dans `.mcp.json` (`https://mcp.mapmap.ai/mcp`, sans clé).
