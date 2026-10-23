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
npm run prepare:route   # data/*.gpx → src/data/route.json (déjà commité)
npm run dev             # http://localhost:5173
npm run build           # typecheck + build prod dans dist/
```

En local, la carte fonctionne **sans clé** (les tuiles sans clé servent localhost).
En production, une clé navigateur est obligatoire (sinon tuiles 403).

## Clés et style

Copier `.env.example` en `.env` :

| Variable | Où | Rôle |
|---|---|---|
| `MAPMAP_API_KEY` | scripts uniquement | `prepare:route` (`/elevation/along`), `create:style` (`POST /styles`). Jamais dans le bundle : Vite n'expose que `VITE_*`. |
| `VITE_MAPMAP_KEY` | navigateur | Clé restreinte à l'origine du site. |
| `VITE_MAPMAP_STYLE_URL` | navigateur | Style hébergé, écrit dans `.env.local` par `npm run create:style`. |

Sans `VITE_MAPMAP_STYLE_URL`, la carte se rabat sur le **compilateur réduit du SDK**
(badge « Style : repli SDK (dev) ») : il ignore le bloc `terrain` du thème, donc le relief
et l'ombrage sont demandés au SDK et l'ombrage est recoloré à la main selon les règles du
compilateur canonique. Le rendu de référence reste le style hébergé :

```sh
npm run create:style    # crée le style (v1), ou publie la version suivante
```

Le thème vit dans `src/map/theme.ts` (source unique pour le style hébergé et le repli).

## Données

| Fichier | Statut |
|---|---|
| `data/boucle.gpx` | **À fournir.** Absent → `data/boucle.mock.gpx` (boucle **MOCK** fictive, badge rouge à l'écran). |
| `data/poi.json` | **À fournir.** Format : `data/poi.example.json`. |
| `src/content/event.ts` | Nom, date, heure, tarif, lien, dossards. `null` = placeholder `[… À CONFIRMER]`. |
| `public/img/` | Logo, photos : à fournir. |

`prepare:route` prend l'altitude dans l'`ele` du GPX s'il est propre, sinon via
`POST /elevation/along` (clé serveur), sinon dans les tuiles DEM publiques que la carte
affiche (même jeu de données Mapzen que `/elevation`). Il vérifie la longueur (≈ 6 706 m)
et calcule pente lissée, D+, point haut, panneaux km et flamme rouge.

## Pièges traités

- **Carte blanche sous Vite** : le worker MapLibre 6 est copié dans `public/vendor/maplibre/`
  avant chaque `dev`/`build` (`scripts/copy-maplibre-worker.mjs`) et déclaré par
  `setWorkerUrl` avant la création de la carte.
- **Tailwind v4 vs `maplibre-gl.css`** : le CSS MapLibre est importé dans le layer `vendor`
  (`src/styles/app.css`), et le conteneur `#map` est positionné en style inline.
- **Double ombrage** : avec le style hébergé, `hillshade: false` côté SDK (le style porte
  déjà le sien) ; le SDK ne gère que le maillage 3D et son exagération.
- Logo MapMap (bas droite) et attribution OSM/OpenMapTiles/Mapzen (bas gauche) : visibles,
  jamais masqués.

## Outils agents

- Skills MapMap dans `.claude/skills/` (`npx skills add Mapmapai/mapmap-agent-skills`).
  `mapmap-web-maps-integration` est copié à la main : son frontmatter YAML est invalide en
  amont et le CLI `skills` le saute.
- MCP MapMap hébergé déclaré dans `.mcp.json` (`https://mcp.mapmap.ai/mcp`, sans clé).
