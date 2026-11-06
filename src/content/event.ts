/**
 * Infos événement : la page n'affiche RIEN qui ne vienne d'ici (ou du GPX).
 *
 * Une valeur `null` = pas encore fournie : elle s'affiche comme placeholder
 * explicite via `tbc()` (« [TARIF À CONFIRMER] »). Ne jamais inventer de valeur.
 */
export const event = {
  /** Nom de la série (nom de travail du brief). */
  name: "Backyard de Guérard",
  /** Nom de l'édition (trace officielle « 28 novembre, again and again.. »). */
  edition: "Again and Again" as string | null,
  place: { commune: "Guérard", departement: "Seine-et-Marne (77)" },
  /** Date du départ, ISO `YYYY-MM-DD` (le 28 novembre, d'après le nom de la trace officielle). */
  date: "2026-11-28" as string | null,
  /** Heure du premier départ, `HH:MM`, heure de Paris. Le compte à rebours la vise dès qu'elle est connue. */
  startTime: "10:00" as string | null,
  /** Tarif d'inscription, en euros, et ce qu'il comprend. */
  priceEur: 35 as number | null,
  priceIncludes: "nourriture comprise" as string | null,
  /** Nombre de dossards (le script du Google Sheet refuse au-delà : scripts/google-sheet). */
  bibs: 40 as number | null,
} as const;

/** Règles du format backyard (brief). La distance AFFICHÉE vient toujours du GPX. */
export const format = {
  loopMinutes: 60,
} as const;

export const tbc = (label: string) => `[${label.toUpperCase()} À CONFIRMER]`;
