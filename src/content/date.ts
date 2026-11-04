/**
 * Date et heure du départ. Module léger (sans les données du parcours) : le compte à
 * rebours de la page 1 l'utilise au runtime.
 */
import { event, tbc } from "./event.ts";

const TZ = "Europe/Paris";

/** Instant visé par le compte à rebours : le premier départ, ou le début du jour J si l'heure manque. */
export function startDate(): Date | null {
  if (!event.date) return null;
  const time = event.startTime ?? "00:00";
  // Décalage de Paris à cette date (hiver +01:00, été +02:00)
  const probe = new Date(`${event.date}T12:00:00Z`);
  const offset =
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
      .formatToParts(probe)
      .find((p) => p.type === "timeZoneName")!
      .value.replace("GMT", "") || "+00:00";
  return new Date(`${event.date}T${time}:00${offset}`);
}

export function dateLabel(): string {
  if (!event.date) return tbc("date");
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${event.date}T12:00:00Z`),
  );
}

export function startTimeLabel(): string {
  if (!event.startTime) return tbc("heure de départ");
  const [h, m] = event.startTime.split(":");
  return m === "00" ? `${Number(h)} h` : `${Number(h)} h ${m}`;
}
