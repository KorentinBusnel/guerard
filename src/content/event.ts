/**
 * Infos événement : la page n'affiche RIEN qui ne vienne d'ici (ou du GPX).
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
  /** Camp de base : lieu, adresse. */
  baseCamp: null as string | null,
  /** Ravitaillement : où, quoi. */
  ravito: null as string | null,
  /** Accès : gare, parking. */
  access: { train: null as string | null, parking: null as string | null },
  /** Règlement complet (lien). */
  rulesUrl: null as string | null,
  /** Matériel obligatoire ou conseillé. */
  gear: null as string | null,
  /** Organisateur, contact, mentions légales. */
  organizer: null as string | null,
  contactEmail: null as string | null,
  legalUrl: null as string | null,
} as const;

/** Règles du format backyard (brief). La distance AFFICHÉE vient toujours du GPX. */
export const format = {
  loopMinutes: 60,
  finishers: 1,
  /** Allure de référence du chrono simulé de la section parcours (brief : ~50 min/boucle). */
  referenceLoopMinutes: 50,
} as const;

export const tbc = (label: string) => `[${label.toUpperCase()} À CONFIRMER]`;

/**
 * FAQ. `{loopKm}` est remplacé par la longueur réelle de la boucle (GPX).
 * Une réponse `null` s'affiche en placeholder : à compléter par l'organisation.
 */
export const faq: { q: string; a: string | null; tbcLabel?: string }[] = [
  {
    q: "C'est quoi, un backyard ultra ?",
    a: "Une boucle de {loopKm} km à parcourir en moins d'une heure. Un départ toutes les heures, à l'heure pile. On recommence jusqu'à ce qu'il ne reste qu'un coureur debout : le seul finisher.",
  },
  {
    q: "Je boucle en 45 minutes : je fais quoi ?",
    a: "Le reste de l'heure est à toi : repos, ravito, change. Tu repars avec tout le monde au départ suivant.",
  },
  {
    q: "Et si je ne boucle pas dans l'heure ?",
    a: "Le départ suivant part sans toi : pour toi, la course s'arrête là.",
  },
  { q: "Combien de dossards ?", a: null, tbcLabel: "nombre de dossards" },
  { q: "Y a-t-il un ravitaillement ?", a: null, tbcLabel: "ravitaillement" },
  { q: "Comment venir ?", a: null, tbcLabel: "accès" },
  { q: "Quel matériel prévoir ?", a: null, tbcLabel: "matériel" },
];
