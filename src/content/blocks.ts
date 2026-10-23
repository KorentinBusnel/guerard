/**
 * Blocs HTML générés au build (gabarit `{{html:clé}}` de index.html) : road-book,
 * infos pratiques, FAQ, paliers du compteur. Données : event.ts + route.json.
 */
import { event, faq, format, tbc } from "./event.ts";
import { dateLabel, startTimeLabel } from "./view.ts";
import { route } from "../data/route.ts";
import { km, num } from "../lib/format.ts";
import { escapeHtml } from "../lib/html.ts";
import { gradeBins, palette } from "../styles/tokens.ts";
import { profilePaths, profileScales, type ProfileBox } from "../sections/profileSvg.ts";
import { milestones, yardsFor } from "./milestones.ts";

const orTbc = (v: string | null, label: string) => v ?? tbc(label);

function roadbook(): string {
  const W = 1200;
  const H = 440;
  const pad = { top: 92, right: 36, bottom: 52, left: 64 };
  const lo = Math.floor((route.eleMin - 12) / 20) * 20;
  const hi = Math.ceil((route.eleMax + 18) / 20) * 20;
  const box: ProfileBox = { width: W, height: H, pad, eleRange: [lo, hi] };
  const { x, y, baseline } = profileScales(box);
  const { areas, ridge } = profilePaths(box);
  const f = (v: number) => v.toFixed(1);
  const parts: string[] = [];

  // Grille d'altitude
  for (let e = lo; e <= hi; e += 20) {
    parts.push(
      `<line x1="${pad.left}" x2="${W - pad.right}" y1="${f(y(e))}" y2="${f(y(e))}" class="rb-grid"/>`,
      `<text x="${pad.left - 10}" y="${f(y(e) + 4)}" class="rb-axis" text-anchor="end">${e}</text>`,
    );
  }
  parts.push(`<text x="${pad.left - 10}" y="${pad.top - 14}" class="rb-axis" text-anchor="end">m</text>`);

  // Aires par pente + crête
  parts.push(...areas.map((a) => `<path d="${a.d}" fill="${a.color}"/>`));
  parts.push(`<path d="${ridge}" fill="none" stroke="${palette.brume}" stroke-width="2"/>`);

  // Axe des km
  const kms = Math.floor(route.totalM / 1000);
  for (let k = 0; k <= kms; k++) {
    const xx = f(x(k * 1000));
    parts.push(
      `<line x1="${xx}" x2="${xx}" y1="${f(baseline)}" y2="${f(baseline + 7)}" class="rb-tick"/>`,
      `<text x="${xx}" y="${f(baseline + 26)}" class="rb-axis" text-anchor="middle">${k}</text>`,
    );
  }
  parts.push(
    `<text x="${f(x(route.totalM))}" y="${f(baseline + 26)}" class="rb-axis rb-axis--end" text-anchor="middle">${km(route.totalM)}</text>`,
    `<text x="${W - pad.right}" y="${f(baseline + 46)}" class="rb-axis" text-anchor="end">km</text>`,
  );

  // Montées : accolade + pente moyenne
  for (const c of route.climbs) {
    const x1 = x(c.startM);
    const x2 = x(c.endM);
    const top = Math.min(...route.profile.ele.filter((_, i) => route.profile.distM[i] >= c.startM && route.profile.distM[i] <= c.endM));
    const peak = route.profile.ele.reduce((m, e, i) => (route.profile.distM[i] >= c.startM && route.profile.distM[i] <= c.endM ? Math.max(m, e) : m), top);
    const yy = y(peak) - 16;
    parts.push(
      `<path d="M${f(x1)} ${f(yy + 6)}V${f(yy)}H${f(x2)}V${f(yy + 6)}" class="rb-bracket"/>`,
      `<text x="${f((x1 + x2) / 2)}" y="${f(yy - 8)}" class="rb-label" text-anchor="middle">${num(c.avgGrade, 1)} %</text>`,
      `<text x="${f((x1 + x2) / 2)}" y="${f(yy - 26)}" class="rb-sub" text-anchor="middle">${num(c.lengthM)} m</text>`,
    );
  }

  // Point culminant
  const hx = x(route.highPoint.distM);
  const hy = y(route.highPoint.ele);
  parts.push(
    `<circle cx="${f(hx)}" cy="${f(hy)}" r="5" fill="${palette.brume}" stroke="${palette.sapin}" stroke-width="2"/>`,
    `<line x1="${f(hx)}" x2="${f(hx)}" y1="${f(hy - 8)}" y2="${pad.top - 30}" class="rb-leader"/>`,
    `<text x="${f(hx)}" y="${pad.top - 38}" class="rb-label" text-anchor="middle">${num(route.highPoint.ele)} m</text>`,
  );

  // Flamme rouge
  if (route.flammeRouge) {
    const fx = x(route.flammeRouge.distM);
    parts.push(
      `<line x1="${f(fx)}" x2="${f(fx)}" y1="${f(baseline)}" y2="${pad.top - 52}" class="rb-flamme-pole"/>`,
      `<path d="M${f(fx)} ${pad.top - 52}l22 9l-22 9z" fill="${palette.flamme}"/>`,
      `<text x="${f(fx + 28)}" y="${pad.top - 38}" class="rb-label rb-label--flamme">Flamme rouge</text>`,
    );
  }

  // POI fournis
  for (const p of route.poi) {
    const px = x(p.distM);
    parts.push(
      `<line x1="${f(px)}" x2="${f(px)}" y1="${f(baseline)}" y2="${f(baseline - 14)}" class="rb-tick"/>`,
      `<text x="${f(px)}" y="${f(baseline - 20)}" class="rb-sub" text-anchor="middle">${escapeHtml(p.name)}</text>`,
    );
  }

  // Départ / arrivée
  parts.push(
    `<text x="${pad.left}" y="${f(baseline - 10)}" class="rb-sub rb-sub--start" dx="8">Départ</text>`,
    `<text x="${W - pad.right}" y="${f(baseline - 10)}" class="rb-sub rb-sub--start" text-anchor="end" dx="-8">Arrivée</text>`,
  );

  const desc =
    `Profil de la boucle : ${km(route.totalM, 3)} km, ${num(route.dPlus)} m de dénivelé positif, ` +
    `de ${num(route.eleMin)} à ${num(route.eleMax)} m d'altitude.`;
  return (
    `<svg class="roadbook__svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="rb-title rb-desc">` +
    `<title id="rb-title">Profil de l'étape</title><desc id="rb-desc">${escapeHtml(desc)}</desc>` +
    parts.join("") +
    `</svg>`
  );
}

function legend(): string {
  return gradeBins
    .map((b) => `<li><span class="legend__swatch" style="background:${b.color}"></span>${escapeHtml(b.label)}</li>`)
    .join("");
}

function infos(): string {
  const cards: { title: string; lines: string[] }[] = [
    {
      title: "Date & horaires",
      lines: [dateLabel(), `Premier départ : ${startTimeLabel()}`, "Puis un départ toutes les heures, à l'heure pile."],
    },
    { title: "Camp de base", lines: [orTbc(event.baseCamp, "camp de base")] },
    { title: "Ravitaillement", lines: [orTbc(event.ravito, "ravitaillement")] },
    {
      title: "Accès",
      lines: [`Gare : ${orTbc(event.access.train, "gare")}`, `Parking : ${orTbc(event.access.parking, "parking")}`],
    },
    {
      title: "Règlement",
      lines: [
        `Boucle de ${km(route.totalM, 3)} km à boucler en moins de ${format.loopMinutes} minutes.`,
        "Départ toutes les heures. Le dernier coureur debout gagne.",
        event.rulesUrl ? "" : tbc("règlement complet"),
      ].filter(Boolean),
    },
    { title: "Matériel", lines: [orTbc(event.gear, "matériel")] },
  ];
  return cards
    .map(
      (c) =>
        `<article class="info-card"><h3 class="tv info-card__title">${escapeHtml(c.title)}</h3>` +
        c.lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("") +
        (c.title === "Règlement" && event.rulesUrl
          ? `<p><a class="link" href="${escapeHtml(event.rulesUrl)}">Lire le règlement complet</a></p>`
          : "") +
        `</article>`,
    )
    .join("");
}

function faqHtml(): string {
  return faq
    .map((item) => {
      const answer = item.a ? item.a.replace("{loopKm}", km(route.totalM, 3)) : tbc(item.tbcLabel ?? "réponse");
      return (
        `<details class="faq__item"><summary class="faq__q">${escapeHtml(item.q)}</summary>` +
        `<div class="faq__a"><p>${escapeHtml(answer)}</p></div></details>`
      );
    })
    .join("");
}

function milestonesHtml(): string {
  return milestones
    .map((m) => {
      const n = yardsFor(m.km);
      return (
        `<li class="milestone"><button type="button" class="milestone__btn" data-yards="${n}">` +
        `<span class="tv milestone__yards">${n} yards</span>` +
        `<span class="milestone__label">${escapeHtml(m.label)}</span></button></li>`
      );
    })
    .join("");
}

function footerCredits(): string {
  const items = [
    event.organizer ? escapeHtml(event.organizer) : escapeHtml(tbc("organisateur")),
    event.contactEmail
      ? `<a class="link" href="mailto:${escapeHtml(event.contactEmail)}">${escapeHtml(event.contactEmail)}</a>`
      : escapeHtml(tbc("contact")),
    event.legalUrl ? `<a class="link" href="${escapeHtml(event.legalUrl)}">Mentions légales</a>` : escapeHtml(tbc("mentions légales")),
  ];
  return items.map((i) => `<li>${i}</li>`).join("");
}

function registerCta(): string {
  return event.registrationUrl
    ? `<a class="cta cta--xl tv" href="${escapeHtml(event.registrationUrl)}">S'inscrire</a>`
    : `<span class="cta cta--xl cta--disabled tv" aria-disabled="true">${escapeHtml(tbc("lien d'inscription"))}</span>`;
}

function clockTicks(): string {
  return Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const r1 = i % 3 === 0 ? 40 : 44;
    const p = (r: number) => `${(Math.sin(a) * r).toFixed(2)} ${(-Math.cos(a) * r).toFixed(2)}`;
    return `<path d="M${p(r1)}L${p(49)}" class="clock__tick${i % 3 === 0 ? " clock__tick--major" : ""}"/>`;
  }).join("");
}

function mockNote(): string {
  return route.meta.mock
    ? `<p class="credits credits--mock">Tracé MOCK : boucle fictive de développement, en attente du GPX officiel.</p>`
    : "";
}

export function viewHtml(): Record<string, string> {
  return {
    registerCta: registerCta(),
    clockTicks: clockTicks(),
    mockNote: mockNote(),
    roadbook: roadbook(),
    legend: legend(),
    infos: infos(),
    faq: faqHtml(),
    milestones: milestonesHtml(),
    footerCredits: footerCredits(),
  };
}
