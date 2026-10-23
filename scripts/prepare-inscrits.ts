/**
 * Liste des inscrits (build-time) : `npm run prepare:inscrits`.
 *
 * Entrée : data/inscrits.csv (export de la plateforme d'inscription, séparateur `,` ou
 * `;`) ou data/inscrits.json. Colonnes reconnues (insensible à la casse) :
 *   dossard | bib | numero      → numéro de dossard
 *   nom | name | coureur        → nom affiché (ou `prenom` + `nom` séparés)
 *   club | team                 → facultatif
 *   objectif | yards | tours    → objectif annoncé, en yards (facultatif)
 *
 * Sortie : src/data/inscrits.json. Par défaut les noms sont réduits à « Prénom N. »
 * (publier une liste nominative suppose le consentement des inscrits) ;
 * INSCRITS_NOMS_COMPLETS=1 garde les noms tels quels.
 *
 * Sans fichier : liste MOCK fictive (« Coureur·se 01 »…), signalée comme telle.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CSV = path.join(ROOT, "data/inscrits.csv");
const JSON_IN = path.join(ROOT, "data/inscrits.json");
const OUT = path.join(ROOT, "src/data/inscrits.json");
const MOCK_COUNT = 48;
const MAX_YARDS = 200;

interface Runner {
  bib: string;
  name: string;
  club: string | null;
  /** Objectif annoncé, en yards ; null si non renseigné. */
  goal: number | null;
}

/** CSV minimal (guillemets, séparateur détecté sur l'en-tête). */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const split = (line: string) => {
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === sep) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    return cells.map((c) => c.trim());
  };
  const header = split(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [header[i], v])));
}

const pick = (row: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
};

/** « Prénom Nom » → « Prénom N. » */
function shortName(full: string): string {
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return full;
  const last = parts[parts.length - 1];
  return `${parts.slice(0, -1).join(" ")} ${last[0].toUpperCase()}.`;
}

function normalise(rows: Record<string, unknown>[]): Runner[] {
  const full = process.env.INSCRITS_NOMS_COMPLETS === "1";
  const runners: Runner[] = [];
  rows.forEach((row, i) => {
    const lower = Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
    const first = pick(lower, "prenom", "prénom", "firstname");
    const last = pick(lower, "nom_famille", "lastname");
    const raw = pick(lower, "nom", "name", "coureur") ?? [first, last].filter(Boolean).join(" ");
    if (!raw) {
      console.warn(`⚠️  ligne ${i + 2} : pas de nom, ignorée`);
      return;
    }
    const goalRaw = pick(lower, "objectif", "objectif_yards", "yards", "tours");
    const goal = goalRaw === null ? null : Number(goalRaw.replace(",", "."));
    if (goal !== null && (!Number.isInteger(goal) || goal < 1 || goal > MAX_YARDS)) {
      console.warn(`⚠️  ligne ${i + 2} : objectif « ${goalRaw} » invalide (entier 1–${MAX_YARDS}), ignoré`);
    }
    runners.push({
      bib: pick(lower, "dossard", "bib", "numero", "numéro") ?? String(i + 1),
      name: full ? raw : shortName(raw),
      club: pick(lower, "club", "team"),
      goal: goal !== null && Number.isInteger(goal) && goal >= 1 && goal <= MAX_YARDS ? goal : null,
    });
  });
  return runners;
}

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** MOCK : objectifs plausibles (beaucoup entre 6 et 15, quelques 24 « 100 miles », rares au-delà). */
function mockRunners(): Runner[] {
  const r = rng(77580);
  return Array.from({ length: MOCK_COUNT }, (_, i) => {
    const x = r();
    let goal: number | null = Math.round(4 + 26 * x ** 2.1);
    if (r() < 0.1) goal = 24;
    if (r() < 0.05) goal = 30 + Math.round(r() * 15);
    if (r() < 0.06) goal = null;
    const n = String(i + 1).padStart(2, "0");
    return { bib: String(i + 1).padStart(3, "0"), name: `Coureur·se ${n}`, club: null, goal };
  });
}

function main() {
  let source: string;
  let runners: Runner[];
  if (fs.existsSync(CSV)) {
    source = "data/inscrits.csv";
    runners = normalise(parseCsv(fs.readFileSync(CSV, "utf8")));
  } else if (fs.existsSync(JSON_IN)) {
    source = "data/inscrits.json";
    runners = normalise(JSON.parse(fs.readFileSync(JSON_IN, "utf8")));
  } else {
    source = "MOCK";
    runners = mockRunners();
    console.warn("⚠️  data/inscrits.csv absent → liste MOCK fictive.");
  }
  const bibs = new Set<string>();
  for (const r of runners) {
    if (bibs.has(r.bib)) console.warn(`⚠️  dossard ${r.bib} en double`);
    bibs.add(r.bib);
  }
  const out = { meta: { mock: source === "MOCK", source, generatedAt: new Date().toISOString() }, runners };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  const withGoal = runners.filter((r) => r.goal !== null).length;
  console.log(`✔ src/data/inscrits.json : ${runners.length} inscrits, ${withGoal} objectifs annoncés${source === "MOCK" ? " [MOCK]" : ""}`);
}

main();
