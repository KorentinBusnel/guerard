/**
 * Blocs HTML générés au build (gabarit `{{html:clé}}` de index.html). Données :
 * event.ts + route.json.
 */
import { event } from "./event.ts";
import { escapeHtml } from "../lib/html.ts";
import { palette } from "../styles/tokens.ts";
import { profilePaths, profileSegmentArea, RELIEF, yPercent } from "../sections/profileSvg.ts";
import { route } from "../data/route.ts";
import { km, num } from "../lib/format.ts";

/** Titre découpé en lettres : chacune part et revient à son tour (`--i` = rang). */
function titleLetters(): string {
  const text = event.edition ?? event.name;
  let i = 0;
  return text
    .split(" ")
    .map(
      (word) =>
        `<span class="title-loop__word">` +
        [...word].map((ch) => `<span class="title-loop__letter" style="--i:${i++}">${escapeHtml(ch)}</span>`).join("") +
        `</span>`,
    )
    .join(" ");
}

/** Le relief de la boucle, en grand au bas de la page 2 (cadre SVG étiré, étiquettes HTML). */
function reliefProfile(): string {
  const { ridge, area } = profilePaths(RELIEF);
  const { totalM, profile } = route;
  const xPct = (d: number) => `${((d / totalM) * 100).toFixed(2)}%`;
  const yPct = (e: number) => `${yPercent(RELIEF, e).toFixed(2)}%`;
  const label = (cls: string, d: number, e: number, text: string) =>
    `<span class="relief__label ${cls}" style="--x:${xPct(d)};--y:${yPct(e)}">${escapeHtml(text)}</span>`;

  const climbs = route.climbs.map((c) => profileSegmentArea(RELIEF, c.startM, c.endM));
  const climbLabels = route.climbs.map((c, i) => {
    // étiquette au-dessus du point le plus haut de la montée
    let e = -Infinity;
    profile.distM.forEach((d, k) => {
      if (d >= c.startM && d <= c.endM) e = Math.max(e, profile.ele[k]);
    });
    return label("relief__label--climb", (c.startM + c.endM) / 2, e, `Montée ${i + 1} · ${num(c.lengthM)} m à ${num(c.avgGrade, 1)} %`);
  });
  const lowIdx = profile.ele.indexOf(Math.min(...profile.ele));
  const kms = Array.from({ length: Math.floor(totalM / 1000) }, (_, i) => (i + 1) * 1000);

  return (
    `<svg class="relief__svg" viewBox="0 0 ${RELIEF.width} ${RELIEF.height}" preserveAspectRatio="none" aria-hidden="true">` +
    `<path d="${area}" fill="${palette.sage}" fill-opacity="0.2"/>` +
    climbs.map((d) => `<path d="${d}" fill="${palette.mint}" fill-opacity="0.16"/>`).join("") +
    `<path d="${ridge}" fill="none" stroke="${palette.mint}" stroke-width="2" vector-effect="non-scaling-stroke"/>` +
    `</svg>` +
    `<div class="relief__marks" aria-hidden="true">` +
    kms.map((d) => `<span class="relief__km" style="--x:${xPct(d)}"><span class="caption">km ${d / 1000}</span></span>`).join("") +
    climbLabels.join("") +
    label("relief__label--high", route.highPoint.distM, route.highPoint.ele, `${num(route.eleMax)} m`) +
    label("relief__label--low", profile.distM[lowIdx], profile.ele[lowIdx], `${num(route.eleMin)} m`) +
    `<span class="relief__end relief__end--start caption">Départ</span>` +
    `<span class="relief__end relief__end--finish caption">${escapeHtml(km(totalM, 3))} km · retour au départ</span>` +
    `</div>`
  );
}

export function viewHtml(): Record<string, string> {
  return {
    titleLetters: titleLetters(),
    reliefProfile: reliefProfile(),
  };
}
