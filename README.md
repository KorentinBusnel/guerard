# Again and Again — Backyard de Guérard

Landing de la backyard ultra de Guérard (77), édition « Again and Again », le
28 novembre 2026. Deux pages :

1. **Accueil** : le titre qui part et revient en boucle, le compte à rebours jusqu'au
   premier départ, l'inscription **seul ou avec un ami**.
2. **La boucle** (en scrollant) : le tracé GPX officiel sur une carte 3D MapMap en orbite
   lente, avec D+, altitudes, montées et profil.

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
En production, une clé navigateur est obligatoire (sinon tuiles 403 et carte vide).

## Variables d'environnement

Copier `.env.example` en `.env` (en prod : variables du projet Vercel).

| Variable | Où | Rôle |
|---|---|---|
| `VITE_INSCRIPTION_ENDPOINT` | navigateur | Adresse qui reçoit les inscriptions (ci-dessous). Vide → bouton désactivé. |
| `VITE_MAPMAP_KEY` | navigateur | Clé MapMap restreinte à l'origine du site. **Obligatoire en prod.** |
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
- **Typo** : Bebas Neue (titres, interligne 0,9), IBM Plex Mono en capitales 10/12/16 px
  (légendes, boutons, formulaire), Times pour les liens de texte.
- Angles droits, aucune ombre, boutons en contour 1 px, gouttière 24/40 px.
- **Titre en boucle** : chaque lettre sort par le haut et revient par le bas, en vague,
  à chaque tour du coureur sur la petite boucle (`src/sections/hero.ts`, 7 s par tour,
  compteur « Yard NN »).

## Carte

- Calque fixe (`#map-layer`) sous la page 2 ; la page 1 est opaque et la recouvre.
- MapLibre + SDK (~1 Mo) sont un chunk séparé, chargé au premier défilement, quand on
  approche de la page 2 : aucun contexte WebGL n'est créé au chargement (sur grand écran
  la page 2 commence juste sous la ligne de flottaison, d'où l'attente du défilement).
  L'orbite tourne seulement quand la page 2 est à l'écran ; le tracé se dessine à la
  première arrivée.
- Thème dans `src/map/theme.ts`. Sans `VITE_MAPMAP_STYLE_URL`, repli sur le compilateur
  réduit du SDK (qui refuse le bloc `terrain`) : relief et ombrage demandés au SDK.
- Logo MapMap (bas droite) et attribution (bas gauche) : jamais masqués ni recouverts
  (voile de lisibilité placé sous les coins de contrôle).

## Accessibilité, mouvement, fallback

- `prefers-reduced-motion` : titre et petite boucle figés (tracé complet), carte fixe
  sans orbite, tracé affiché d'emblée.
- Sans WebGL 2 ou si MapLibre échoue : image statique de la carte (`carte-fallback.webp`).
- Titre animé en `aria-hidden`, doublé d'un texte pour les lecteurs d'écran ; compte à
  rebours étiqueté ; statut du formulaire en `role="status"`.

## Lighthouse (build prod, Chromium headless sans GPU)

Mobile (3 passes) et desktop : performance 100, accessibilité 100, bonnes pratiques 100,
SEO 100 (TBT 0 ms, CLS 0). Les deux polices du premier écran sont préchargées au build
(`vite.config.ts`) : sans cela leur arrivée décalait le formulaire (CLS 0,28).

## Pièges traités

- **Carte blanche sous Vite** : worker MapLibre 6 copié dans `public/vendor/maplibre/`
  avant chaque `dev`/`build` + `setWorkerUrl`.
- **Tailwind v4 vs `maplibre-gl.css`** : CSS MapLibre dans le layer `vendor`, entre
  `base` et `utilities`, chargé avec le chunk carte (`src/map/vendor.css`) ; `#map`
  positionné en style inline.
- **`cameraForBounds`** : padding remis à zéro avant le calcul (sinon il s'additionne au
  padding posé sur la carte et dézoome).
- **Double ombrage** : avec le style hébergé, `hillshade: false` côté SDK.

## Outils agents

- Skills MapMap dans `.claude/skills/` (`npx skills add Mapmapai/mapmap-agent-skills`).
  `mapmap-web-maps-integration` est copié à la main : son frontmatter YAML est invalide en
  amont et le CLI `skills` le saute.
- MCP MapMap hébergé déclaré dans `.mcp.json` (`https://mcp.mapmap.ai/mcp`, sans clé).
