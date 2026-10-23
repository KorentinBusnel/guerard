/**
 * Le peloton : classement prévisionnel des inscrits selon leur objectif annoncé (yards),
 * paliers, « le peloton s'égrène » (combien prennent encore le départ du yard n).
 * Calculs purs + blocs HTML générés au build (gabarit `{{html:…}}`), réutilisés au runtime.
 */
import { inscrits, type Runner } from "../data/inscrits.ts";
import { route } from "../data/route.ts";
import { km, num } from "../lib/format.ts";
import { escapeHtml } from "../lib/html.ts";
import { milestones, yardsFor } from "./milestones.ts";
import { tbc } from "./event.ts";

export interface RankedRunner extends Runner {
  /** Rang prévisionnel (ex æquo partagés : 1, 2, 2, 4) ; null sans objectif. */
  rank: number | null;
  tie: boolean;
  /** Plus haut objectif du peloton : maillot jaune virtuel. */
  leader: boolean;
  palier: string | null;
}

/** Palier le plus haut atteint par un objectif (« 100 miles », « Marathon »…). */
export function palierFor(goal: number | null): string | null {
  if (goal === null) return null;
  return [...milestones].reverse().find((m) => goal >= yardsFor(m.km))?.short ?? null;
}

export function rankedRunners(runners: Runner[] = inscrits.runners): RankedRunner[] {
  const bibNum = (b: string) => (Number.isFinite(Number(b)) ? Number(b) : Infinity);
  const sorted = [...runners].sort(
    (a, b) => (b.goal ?? -1) - (a.goal ?? -1) || bibNum(a.bib) - bibNum(b.bib) || a.bib.localeCompare(b.bib),
  );
  const top = sorted[0]?.goal ?? null;
  return sorted.map((r) => {
    if (r.goal === null) return { ...r, rank: null, tie: false, leader: false, palier: null };
    const first = sorted.findIndex((o) => o.goal === r.goal);
    const tie = sorted.filter((o) => o.goal === r.goal).length > 1;
    return { ...r, rank: first + 1, tie, leader: r.goal === top, palier: palierFor(r.goal) };
  });
}

export function pelotonStats(runners: Runner[] = inscrits.runners) {
  const goals = runners.map((r) => r.goal).filter((g): g is number => g !== null).sort((a, b) => a - b);
  const n = goals.length;
  const median = n ? (n % 2 ? goals[(n - 1) / 2] : (goals[n / 2 - 1] + goals[n / 2]) / 2) : null;
  const max = n ? goals[n - 1] : null;
  return {
    count: runners.length,
    withGoal: n,
    median,
    max,
    /** Distance cumulée visée par tout le peloton, en mètres. */
    totalM: goals.reduce((s, g) => s + g * route.totalM, 0),
  };
}

/** `atStart[y]` = nombre d'inscrits dont l'objectif atteint le yard y (y = 1…max). */
export function survival(runners: Runner[] = inscrits.runners): number[] {
  const goals = runners.map((r) => r.goal).filter((g): g is number => g !== null);
  const max = goals.length ? Math.max(...goals) : 0;
  return Array.from({ length: max + 1 }, (_, y) => goals.filter((g) => g >= y).length);
}

/** Part des objectifs annoncés strictement inférieurs à `yards` (0–1). */
export function shareBelow(yards: number, runners: Runner[] = inscrits.runners): number {
  const goals = runners.map((r) => r.goal).filter((g): g is number => g !== null);
  return goals.length ? goals.filter((g) => g < yards).length / goals.length : 0;
}

export const runnerLabel = (r: Runner) => `${r.name} (n° ${r.bib})`;

// ---------------------------------------------------------------------------
// Blocs HTML (build)

/** Maillot jaune (pictogramme), seul élément saturé du classement. */
export const JERSEY_SVG =
  '<svg class="jersey" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3l-5 3 2 5 2-1v11h10V10l2 1 2-5-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z"/></svg>';

function statsHtml(): string {
  const s = pelotonStats();
  if (!s.count) return "";
  const cells = [
    { value: num(s.count), unit: s.count > 1 ? "inscrits" : "inscrit" },
    { value: s.median === null ? "—" : num(s.median, s.median % 1 ? 1 : 0), unit: "yards · objectif médian" },
    { value: s.max === null ? "—" : num(s.max), unit: "yards · objectif le plus haut" },
    { value: km(s.totalM, 0), unit: "km visés à tout le peloton" },
  ];
  return cells
    .map((c) => `<li class="peloton-stat"><p class="tv peloton-stat__value">${c.value}</p><p class="peloton-stat__unit">${c.unit}</p></li>`)
    .join("");
}

function standingsHtml(): string {
  const rows = rankedRunners();
  if (!rows.length) {
    return `<tr><td colspan="5" class="standings__empty">${escapeHtml(tbc("liste des inscrits"))}</td></tr>`;
  }
  return rows
    .map((r) => {
      const rank = r.rank === null ? "—" : `${r.tie ? "=" : ""}${r.rank}`;
      const search = `${r.name} ${r.bib} ${r.club ?? ""}`.toLowerCase();
      return (
        `<tr class="standings__row${r.leader ? " is-leader" : ""}" data-bib="${escapeHtml(r.bib)}" data-search="${escapeHtml(search)}">` +
        `<td class="tv standings__rank">${rank}</td>` +
        `<td class="standings__name"><span class="tv standings__bib">${escapeHtml(r.bib)}</span> ` +
        `${r.leader ? JERSEY_SVG : ""}<span>${escapeHtml(r.name)}</span>` +
        (r.club ? `<span class="standings__club">${escapeHtml(r.club)}</span>` : "") +
        `</td>` +
        `<td class="tv standings__goal">${r.goal === null ? "—" : num(r.goal)}</td>` +
        `<td class="tv standings__dist">${r.goal === null ? "—" : `${km(r.goal * route.totalM, 1)} km`}</td>` +
        `<td class="standings__palier">${r.palier ? `<span class="palier">${escapeHtml(r.palier)}</span>` : ""}</td>` +
        `</tr>`
      );
    })
    .join("");
}

/** « Le peloton s'égrène » : une barre par yard, hauteur = inscrits encore au départ. */
function survivalSvg(): string {
  const counts = survival();
  const max = counts.length - 1;
  if (max < 1) return "";
  const W = 720;
  const H = 280;
  const pad = { top: 18, right: 12, bottom: 38, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const n0 = counts[1];
  const step = innerW / max;
  const bw = Math.max(step * 0.72, 1);
  const y = (c: number) => pad.top + innerH * (1 - c / n0);
  const f = (v: number) => v.toFixed(1);
  const parts: string[] = [];
  const yTicks = n0 <= 10 ? 1 : n0 <= 40 ? 5 : n0 <= 100 ? 10 : 50;
  for (let c = 0; c <= n0; c += yTicks) {
    parts.push(
      `<line x1="${pad.left}" x2="${W - pad.right}" y1="${f(y(c))}" y2="${f(y(c))}" class="sv-grid"/>`,
      `<text x="${pad.left - 8}" y="${f(y(c) + 4)}" class="sv-axis" text-anchor="end">${c}</text>`,
    );
  }
  for (let k = 1; k <= max; k++) {
    const x = pad.left + (k - 1) * step + (step - bw) / 2;
    parts.push(
      `<rect class="sv-bar" data-yard="${k}" x="${f(x)}" y="${f(y(counts[k]))}" width="${f(bw)}" height="${f(y(0) - y(counts[k]))}"><title>Yard ${k} : ${counts[k]} au départ</title></rect>`,
    );
  }
  const xTicks = max <= 12 ? 1 : max <= 36 ? 6 : 12;
  for (let k = 1; k <= max; k++) {
    if (k !== 1 && k % xTicks !== 0) continue;
    parts.push(`<text x="${f(pad.left + (k - 0.5) * step)}" y="${H - pad.bottom + 20}" class="sv-axis" text-anchor="middle">${k}</text>`);
  }
  // paliers sous l'axe
  for (const m of milestones) {
    const k = yardsFor(m.km);
    if (k > max) continue;
    const x = f(pad.left + (k - 1) * step);
    parts.push(`<line x1="${x}" x2="${x}" y1="${pad.top}" y2="${f(y(0))}" class="sv-milestone"/>`);
    parts.push(`<text x="${x}" y="${pad.top - 4}" class="sv-milestone-label" dx="3">${escapeHtml(m.short)}</text>`);
  }
  parts.push(`<text x="${W - pad.right}" y="${H - 4}" class="sv-axis" text-anchor="end">yards</text>`);
  const desc = `Nombre d'inscrits au départ de chaque yard selon les objectifs annoncés : ${counts[1]} au yard 1, ${counts[max]} au yard ${max}.`;
  return (
    `<svg class="survival__svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="sv-title sv-desc">` +
    `<title id="sv-title">Le peloton s'égrène</title><desc id="sv-desc">${escapeHtml(desc)}</desc>${parts.join("")}</svg>`
  );
}

function pronoOptions(): string {
  const bibNum = (b: string) => (Number.isFinite(Number(b)) ? Number(b) : Infinity);
  return [...inscrits.runners]
    .sort((a, b) => bibNum(a.bib) - bibNum(b.bib) || a.bib.localeCompare(b.bib))
    .map((r) => `<option value="${escapeHtml(r.bib)}">${escapeHtml(runnerLabel(r))}</option>`)
    .join("");
}

function mockNote(): string {
  return inscrits.meta.mock
    ? `<p class="peloton__mock tv">Liste MOCK : inscrits fictifs de développement, en attente de la vraie liste.</p>`
    : "";
}

export function pelotonHtml(): Record<string, string> {
  return {
    pelotonStats: statsHtml(),
    pelotonStandings: standingsHtml(),
    pelotonSurvival: survivalSvg(),
    pelotonOptions: pronoOptions(),
    pelotonMock: mockNote(),
  };
}

export function pelotonStrings(): Record<string, string> {
  const s = pelotonStats();
  const max = s.max ?? 1;
  return {
    pelotonCount: num(s.count),
    pelotonYardMax: String(max),
    pelotonYardDefault: String(Math.min(yardsFor(160.934), max)),
    pelotonPronoDefault: String(max),
  };
}
