/**
 * Infos événement : la page n'affiche RIEN qui ne vienne d'ici.
 *
 * Une valeur `null` = pas encore fournie : elle s'affiche comme placeholder
 * explicite via `tbc()` (« [DATE À CONFIRMER] »). Ne jamais inventer de valeur.
 */
export const event = {
  /** Nom de travail du brief, en attendant le nom officiel. */
  name: "Backyard de Guérard",
  nameIsOfficial: false,
  place: { commune: "Guérard", departement: "Seine-et-Marne (77)" },
  /** Date du départ, ISO `YYYY-MM-DD`. */
  date: null as string | null,
  /** Heure du premier départ, `HH:MM`, heure de Paris. */
  startTime: null as string | null,
  /** Tarif d'inscription, en euros. */
  priceEur: null as number | null,
  registrationUrl: null as string | null,
  bibs: null as number | null,
} as const;

/** Règles du format backyard (brief). La distance AFFICHÉE vient toujours du GPX. */
export const format = {
  loopMinutes: 60,
  finishers: 1,
} as const;

export const tbc = (label: string) => `[${label.toUpperCase()} À CONFIRMER]`;
