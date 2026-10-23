import raw from "./inscrits.json" with { type: "json" };

/** Sortie de `npm run prepare:inscrits` (scripts/prepare-inscrits.ts). */
export interface Runner {
  bib: string;
  name: string;
  club: string | null;
  /** Objectif annoncé, en yards ; null si non renseigné. */
  goal: number | null;
}

export interface InscritsData {
  meta: { mock: boolean; source: string; generatedAt: string };
  runners: Runner[];
}

export const inscrits = raw as InscritsData;
