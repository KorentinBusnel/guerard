# Again and Again — Backyard de Guérard

Landing de la backyard ultra de Guérard (77), édition « Again and Again », le
28 novembre 2026. Deux pages :

1. **Accueil** : le titre (ses lettres filent et reviennent toutes les 4 s) et le compte
   à rebours, devant la **boucle GPX en 3D** : le tracé en grand sur le relief, la
   forêt, les rivières, les routes et les villages, un coureur qui en fait le tour
   (« Yard 01, 02… »), en orbite lente. Le dénivelé est au bas de la page 2. On la fait
   tourner en la glissant, on zoome ; boutons Pause, Vue de dessus / Vue 3D, − / +.
2. **La boucle et l'inscription** (en scrollant ; page opaque, la scène 3D n'y est pas,
   illisible derrière un formulaire) : distance, D+, altitudes, montées ; l'inscription
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
En production, la clé navigateur MapMap est dans `.env.production` (versionné) ; sans
elle, la scène n'afficherait que le relief (ni forêt, ni routes, ni rivières, ni
villages).

## Variables d'environnement

Copier `.env.example` en `.env` (en prod : variables du projet Vercel, qui priment sur
les fichiers). `.env.production` est versionné : il ne contient que des valeurs
**publiques** du build de prod (la clé MapMap navigateur, de toute façon lisible dans le
JS du site), jamais de secret.

| Variable | Où | Rôle |
|---|---|---|
| `VITE_INSCRIPTION_ENDPOINT` | navigateur | URL de l'application Web Apps Script qui écrit dans le Google Sheet (ci-dessous). Vide → bouton désactivé. |
| `VITE_MAPMAP_KEY` | navigateur | Clé MapMap `snk_…` (dans `.env.production`). **Nécessaire en prod** pour la forêt, les routes, les rivières et les villages (sans elle : relief seul). Clé émise par `POST https://api.mapmap.ai/v1/keys` ; provisoire (1 000 appels, 72 h) tant que l'e-mail de confirmation n'est pas validé. |
| `VITE_MAPMAP_STYLE_URL` | navigateur | Style hébergé, écrit dans `.env.local` par `npm run create:style`. |
| `SITE_URL` | build | URL publique (rend `og:image` absolue). |
| `MAPMAP_API_KEY` | scripts uniquement | `prepare:route`, `create:style`, `static:map`. Jamais dans le bundle : Vite n'expose que `VITE_*`. |

## Inscription → Google Sheet

Chaque inscription est une ligne de la feuille Google **« Inscriptions — Again and
Again (Backyard de Guérard) »** (Drive de l'organisateur) : Horodatage, Formule, Nom et
prénom, E-mail, Binôme, Édition. Un duo donne deux lignes (chaque coureur a son
dossard), chacune avec le nom de l'autre en « Binôme ».

Le pont entre le site et la feuille est un script Apps Script lié à la feuille,
`scripts/google-sheet/inscriptions.gs` (en tête du fichier : la mise en place) :

- `POST` : enregistre le ou les coureurs ; refuse un e-mail déjà inscrit
  (`deja-inscrit`), des champs invalides (`invalide`) et tout dépassement des
  50 dossards (`complet`) ; ignore les robots (pot de miel `_gotcha`) ; neutralise un
  texte qui commencerait par `=`, `+`, `-` ou `@` (sinon lu comme une formule).
- `GET` : le nombre de dossards restants, affiché sous le formulaire.

L'URL de l'application Web (`https://script.google.com/macros/s/…/exec`) va dans
`VITE_INSCRIPTION_ENDPOINT` (`.env.production`, valeur publique). Le site envoie le JSON
en `text/plain` (`src/sections/inscription.ts`) : une requête « simple », sans pré-vol
CORS, qu'Apps Script accepte et dont la réponse se lit depuis le site. Sans URL, le
bouton est désactivé (« Les inscriptions ouvrent très bientôt »).

## Contenu

| Fichier | Statut |
|---|---|
| `src/content/event.ts` | Nom, édition, lieu, date, heure de départ, tarif, dossards. `null` = placeholder `[… À CONFIRMER]` à l'écran. |
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

## Scène 3D (fond de la page 1)

- Calque `#map-layer` en haut de page, sous la page 1 (transparente) ; il défile avec
  elle et la page 2, opaque, vient ensuite.
- **Boucle** : ligne menthe sur un halo flou, affichée d'emblée (le tracé SVG qui
  attend la carte est à la même place) ;
  le coureur (`src/map/runner.ts`, un tour en 26 s, position par `src/map/track.ts`) en
  fait le tour, encore et encore, suivi d'une traînée lumineuse (`line-gradient`
  recalculé à chaque image).
- **Rendu HD** : anticrénelage du canevas (`canvasContextAttributes.antialias`),
  densité de pixels au moins 1,5 sur ordinateur (suréchantillonnage des écrans
  standard, plafonnée à 2 ; 2,5 sur mobile) ; ombrage du relief à deux lumières
  (`hillshade-method: multidirectional`).
- **Interactions** (`src/map/interact.ts`) : glisser pour tourner (et incliner à la
  souris), avec inertie ; deux doigts pour zoomer et pivoter ; Ctrl / ⌘ + molette (ou
  pincement du pavé tactile) pour zoomer, la molette seule faisant défiler la page ;
  boutons − / + ; double-clic pour revenir au cadrage. Survoler (ou toucher) le tracé
  affiche le kilomètre et l'altitude du point, repérés aussi sur le grand profil de la
  page 2 ; survoler le profil affiche le kilomètre et l'altitude sur le profil.
- **Caméra** (`src/map/camera.ts`) : la boucle occupe l'espace libre sous le titre, à
  côté du compte à rebours ; orbite lente, glisser pour tourner (au doigt : horizontal seulement, le vertical reste
  au défilement), transition vue de dessus / 3D. Relief exagéré ×2,2 (×1,8 mobile).
- **Chargement** : MapLibre + SDK (~1 Mo, 370 Ko gzip) sont un chunk séparé, téléchargé
  dès la fin du chargement de la page (`requestIdleCallback`, ou première interaction)
  ; la caméra se place avant les premières tuiles, et la carte se dévoile quand celles
  du cadrage sont là, au plus tard 2,5 s après sa création (le relief finit d'arriver
  sous les yeux). Avant, le tracé est dessiné en SVG à la même place. Pas de
  préchargement dans le HTML : il prendrait la bande passante des polices (LCP).
  Tout s'arrête quand la page 1 quitte l'écran ou que l'onglet est caché.
- **Fond épuré** (`trimBasemap`, `src/map/forestMap.ts`) : sur le relief ombré, on ne
  garde que la forêt (seule couverture du sol affichée), l'eau et les rivières, les
  routes (sans chemins ni rail) et les noms de villes et villages ; bâti, points
  d'intérêt, noms de rues, cartouches et limites sont masqués (leurs tuiles ne sont pas
  téléchargées).
- Thème dans `src/map/theme.ts`. Sans `VITE_MAPMAP_STYLE_URL`, repli sur le compilateur
  réduit du SDK (qui refuse le bloc `terrain`) : relief et ombrage demandés au SDK.
- Sans clé (`VITE_MAPMAP_KEY`) hors localhost, le fond vectoriel est refusé (403) :
  forêt, routes, rivières et villages disparaissent, il reste le relief et la boucle.
- Logo MapMap (bas droite) et attribution (bas gauche) : jamais masqués ni recouverts
  (voile de lisibilité placé sous les coins de contrôle, bas des pages laissé libre).

## Accessibilité, mouvement, fallback

- Bouton **Pause** : arrête tout ce qui bouge (titre, orbite,
  coureur).
- `prefers-reduced-motion` : titre figé, scène fixe sans orbite ni coureur, boucle
  dessinée d'emblée.
- Sans WebGL 2 ou si MapLibre échoue : image statique de la scène (`carte-fallback.webp`).
- Titre animé en `aria-hidden`, doublé d'un texte pour les lecteurs d'écran ; compte à
  rebours étiqueté ; relief décrit par sa légende ; statut du formulaire en
  `role="status"`.

## Lighthouse (build prod, Chromium headless sans GPU)

Mobile : accessibilité 100, bonnes pratiques 100, SEO 100 ; premier affichage 0,9 s,
LCP 1,2 s, CLS 0,007. Performance 60 : la scène 3D démarre désormais juste après le
chargement, et Lighthouse, sans GPU, la rend en WebGL logiciel (chaque image de carte
devient une longue tâche, TBT ≈ 90 s). Sur un vrai appareil (GPU), ce coût n'existe pas.
Le démarrage à la première interaction ou après 3,5 s donnait 100, mais la carte
arrivait trop tard. Les trois polices du premier écran sont préchargées au build
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
- **Orbite et transitions** : le `jumpTo` de l'orbite couperait un `easeTo` à l'image
  suivante ; l'inclinaison (vue de dessus / 3D) est donc animée dans la même boucle.

## Outils agents

- Skills MapMap dans `.claude/skills/` (`npx skills add Mapmapai/mapmap-agent-skills`).
  `mapmap-web-maps-integration` est copié à la main : son frontmatter YAML est invalide en
  amont et le CLI `skills` le saute.
- MCP MapMap hébergé déclaré dans `.mcp.json` (`https://mcp.mapmap.ai/mcp`, sans clé).
