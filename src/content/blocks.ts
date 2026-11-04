/**
 * Blocs HTML générés au build (gabarit `{{html:clé}}` de index.html). Données :
 * event.ts + route.json.
 */
import { event, tbc } from "./event.ts";
import { escapeHtml } from "../lib/html.ts";
import { palette } from "../styles/tokens.ts";
import { profilePaths } from "../sections/profileSvg.ts";

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

/** Profil de la boucle, en ligne fine sur une aire sage (page 2). */
function miniProfile(): string {
  const { ridge, area } = profilePaths({ width: 1000, height: 100, padTop: 6 });
  return (
    `<svg class="profile__svg" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">` +
    `<path d="${area}" fill="${palette.sage}" fill-opacity="0.22"/>` +
    `<path d="${ridge}" fill="none" stroke="${palette.mint}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>` +
    `</svg>`
  );
}

function legalLink(): string {
  return event.legalUrl
    ? `<a class="link-serif" href="${escapeHtml(event.legalUrl)}">mentions légales</a>`
    : escapeHtml(tbc("mentions légales"));
}

function footerCredits(): string {
  const items = [
    event.organizer ? escapeHtml(event.organizer) : escapeHtml(tbc("organisateur")),
    event.contactEmail
      ? `<a class="link-serif" href="mailto:${escapeHtml(event.contactEmail)}">${escapeHtml(event.contactEmail)}</a>`
      : escapeHtml(tbc("contact")),
    legalLink(),
  ];
  return items.map((i) => `<li>${i}</li>`).join("");
}

export function viewHtml(): Record<string, string> {
  return {
    titleLetters: titleLetters(),
    miniProfile: miniProfile(),
    legalLink: legalLink(),
    footerCredits: footerCredits(),
  };
}
