# Backyard de Guérard — landing page

« L'étape qui ne finit jamais » : les codes TV du Tour de France (profil d'étape,
incrustations, flamme rouge, maillot jaune, caméra hélico) dans un sous-bois de Brie.

**Stack** : Vite + TypeScript **vanilla** (pas de React : une seule page dont l'essentiel
est impératif, piloté par GSAP et MapLibre à 60 fps ; un framework n'ajouterait que du
poids et des re-rendus), Tailwind v4, carte MapMap (`@mapmap/maps` sur MapLibre GL 6),
GSAP + ScrollTrigger, turf.

## Démarrer

```sh
npm install
npm run dev             # http://localhost:5173
npm run build           # typecheck + build prod dans dist/
npm run preview         # sert dist/
```

En local, la carte fonctionne **sans clé** (les tuiles sans clé servent localhost).
En production, une clé navigateur est obligatoire (sinon tuiles 403).

## Scripts de données (build-time, résultats commités)

| Script | Rôle |
|---|---|
| `npm run prepare:route` | `data/boucle.gpx` (ou la boucle MOCK) → `src/data/route.json` : distances, altitude, pente lissée, D+, cap caméra lissé (150 m), montées, panneaux km, flamme rouge, POI. |
| `npm run create:style` | Publie le thème forêt comme style hébergé MapMap (`POST /styles`, puis versions suivantes) et écrit l'URL dans `.env.local`. Clé serveur requise. |
| `npm run capture:images` | Après `npm run build` : capture `public/img/og.jpg` et `public/img/carte-fallback.webp` depuis la page (`?capture=og|fallback`). Navigateur : `CHROME_PATH`, sinon Chrome installé. |
| `npm run static:map` | Même images via l'API Static Map de MapMap (`style=outdoor`, tracé en polyline **précision 6**). **À ce jour, le rendu Static Map ne couvre pas la France** (fond vide, relief seul) : d'où `capture:images` en attendant. |

Après réception du vrai GPX : `npm run prepare:route && npm run build && npm run capture:images`.

## Clés et style

Copier `.env.example` en `.env` :

| Variable | Où | Rôle |
|---|---|---|
| `MAPMAP_API_KEY` | scripts uniquement | `prepare:route` (`/elevation/along`), `create:style`, `static:map`. Jamais dans le bundle : Vite n'expose que `VITE_*`. |
| `VITE_MAPMAP_KEY` | navigateur | Clé restreinte à l'origine du site. |
| `VITE_MAPMAP_STYLE_URL` | navigateur | Style hébergé, écrit dans `.env.local` par `npm run create:style`. |
| `SITE_URL` | build | URL publique (rend `og:image` absolue). |

Sans `VITE_MAPMAP_STYLE_URL`, la carte se rabat sur le **compilateur réduit du SDK**
(badge « Style : repli SDK (dev) » en dev) : il refuse le bloc `terrain`, donc relief et
ombrage sont demandés au SDK et l'ombrage est recoloré selon les règles du compilateur
canonique. Le rendu de référence reste le style hébergé. Le thème vit dans
`src/map/theme.ts` (source unique).

## Contenu et données

| Fichier | Statut |
|---|---|
| `src/content/event.ts` | Nom, date, heure, tarif, lien, dossards, camp de base, ravito, accès, règlement, matériel, organisateur, FAQ. `null` = placeholder `[… À CONFIRMER]`. |
| `data/boucle.gpx` | **À fournir.** Absent → `data/boucle.mock.gpx` (boucle **MOCK** fictive, badge rouge à l'écran, note en pied de page). |
| `data/poi.json` | **À fournir.** Format : `data/poi.example.json`. |
| `public/img/` | Logo, photos : à fournir (AVIF/WebP). |

Les textes sont écrits dans `index.html` **au build** (gabarit `{{clé}}` / `{{html:bloc}}`,
cf. `vite.config.ts`, `src/content/view.ts`, `src/content/blocks.ts`) : lisibles sans JS.

## Architecture de la page

- **Carte fixe en fond** (`#map-layer`), visible à travers le hero et la section
  parcours ; les sections opaques la recouvrent (la caméra s'arrête alors).
- **État partagé** (`src/state.ts`) : scène + distance du coureur. ScrollTrigger l'alimente
  (`src/scroll/scenes.ts`) ; HUD et profil (`src/sections/course.ts`) et carte
  (`src/map/course.ts`) s'y abonnent. Tout dérive de la même distance `d` : puck, HUD,
  profil et caméra sont synchronisés.
- **Chargement** : le hero (texte + affiche SVG du tracé) s'affiche seul ; les sections
  sous le hero sont un chunk différé ; la carte WebGL (~1 Mo) démarre à la première
  interaction ou ~3,5 s après le chargement, et la page ne crée aucun contexte WebGL
  avant.

## Accessibilité, mouvement, fallback

- `prefers-reduced-motion` : pas d'orbite ni de caméra qui suit, tracé complet, section
  parcours en vue statique (fiches étape listées), animations CSS coupées.
- Sans WebGL 2 : image statique de la carte (`carte-fallback.webp`) et parcours statique.
- Mobile : pitch 40–45°, exagération 1,2, HUD réduit à KM + ALT, profil pleine largeur.
- HUD et incrustations `aria-hidden`, infos clés dupliquées en texte.

## Lighthouse (build prod, Chromium headless sans GPU)

Mobile : performance 98 (5 passes), accessibilité 100, bonnes pratiques 100, SEO 100.
Desktop : 100 / 100 / 100 / 100. Ces mesures portent sur la page **avant** le démarrage
de la carte WebGL (différé, cf. ci-dessus) ; sans GPU, WebGL tourne en logiciel et chaque
image de carte serait une longue tâche.

## Pièges traités

- **Carte blanche sous Vite** : worker MapLibre 6 copié dans `public/vendor/maplibre/`
  avant chaque `dev`/`build` + `setWorkerUrl`.
- **Tailwind v4 vs `maplibre-gl.css`** : CSS MapLibre dans le layer `vendor`, placé entre
  `base` et `utilities` (tout en bas, le preflight Tailwind réaffiche le bouton (i) de
  l'attribution par-dessus le crédit OSM) ; chargé avec le chunk carte
  (`src/map/vendor.css`) ; `#map` positionné en style inline.
- **Marqueurs MapLibre** : l'occlusion par le relief écrit `style.opacity` sur l'élément
  racine → on stylise un enfant.
- **Double ombrage** : avec le style hébergé, `hillshade: false` côté SDK.
- **Jaune unique** : cartouches routiers (D20 jaunes) masqués ; teintes de pente du
  profil désaturées.
- Logo MapMap (bas droite) et attribution (bas gauche) : jamais masqués ni recouverts
  (voile du hero placé sous les coins de contrôle, mini-profil au-dessus).

## Outils agents

- Skills MapMap dans `.claude/skills/` (`npx skills add Mapmapai/mapmap-agent-skills`).
  `mapmap-web-maps-integration` est copié à la main : son frontmatter YAML est invalide en
  amont et le CLI `skills` le saute.
- MCP MapMap hébergé déclaré dans `.mcp.json` (`https://mcp.mapmap.ai/mcp`, sans clé).
