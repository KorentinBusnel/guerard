/**
 * Section parcours, côté DOM : HUD TV, mini-profil, fiches étape, flamme rouge, YARD.
 * Tout est piloté par `state.courseD` (mètres) : même source que le puck et la caméra.
 */
import { route } from "../data/route";
import { format } from "../content/event";
import { clock, km, num, signed } from "../lib/format";
import { profileAt } from "../lib/routeMath";
import { subscribe } from "../state";
import { palette } from "../styles/tokens";
import { profilePaths } from "./profileSvg";
import { escapeHtml } from "../lib/html";

interface StageItem {
  from: number;
  to: number;
  kicker: string;
  title: string;
  stats: string;
}

const POI_LABELS: Record<string, string> = {
  montee: "Montée",
  descente: "Descente",
  ravito: "Ravito",
  camp: "Camp de base",
  passage: "Passage",
};

/** Fiches étape : montées détectées dans le profil, point culminant, POI fournis. */
export function stageItems(): StageItem[] {
  const items: StageItem[] = route.climbs.map((c) => {
    const named = route.poi.find((p) => p.type === "montee" && p.distM >= c.startM - 100 && p.distM <= c.endM);
    return {
      from: Math.max(0, c.startM - 80),
      to: c.endM,
      kicker: "Montée",
      title: named?.name ?? `Km ${km(c.startM)} → ${km(c.endM)}`,
      stats: `${num(c.lengthM)} m à ${num(c.avgGrade, 1)} % · max ${num(c.maxGrade, 0)} % · +${num(c.gainM)} m`,
    };
  });
  items.push({
    from: route.highPoint.distM - 150,
    to: route.highPoint.distM + 150,
    kicker: "Point culminant",
    title: `${num(route.highPoint.ele)} m`,
    stats: `Km ${km(route.highPoint.distM)} · D+ de la boucle ${num(route.dPlus)} m`,
  });
  for (const p of route.poi) {
    if (p.type === "montee" && route.climbs.some((c) => p.distM >= c.startM - 100 && p.distM <= c.endM)) continue;
    const span = p.lengthM ?? 0;
    items.push({
      from: p.distM - 150,
      to: p.distM + Math.max(span, 150),
      kicker: POI_LABELS[p.type] ?? p.type,
      title: p.name,
      stats: [`Km ${km(p.distM)}`, p.description].filter(Boolean).join(" · "),
    });
  }
  return items.sort((a, b) => a.from - b.from);
}

export function courseSummary(): string {
  const climbs = route.climbs
    .map((c) => `montée de ${num(c.lengthM)} m à ${num(c.avgGrade, 1)} % au km ${km(c.startM)}`)
    .join(", ");
  return (
    `Le parcours : une boucle de ${km(route.totalM, 3)} km, ${num(route.dPlus)} m de dénivelé positif, ` +
    `altitude de ${num(route.eleMin)} à ${num(route.eleMax)} m. ` +
    (climbs ? `Principales difficultés : ${climbs}. ` : "") +
    (route.flammeRouge ? `Le dernier kilomètre commence au km ${km(route.flammeRouge.distM)}.` : "")
  );
}

export function initCourse({ staticCourse }: { staticCourse: boolean }) {
  const root = document.getElementById("parcours")!;
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T & Element>(sel)!;
  const hud = {
    km: $("[data-hud=km]"),
    alt: $("[data-hud=alt]"),
    grade: $("[data-hud=grade]"),
    yard: $("[data-hud=yard]"),
    clock: $("[data-hud=clock]"),
  };
  const intro = $("[data-course-intro]");
  const card = $("[data-stage-card]");
  const flamme = $("[data-flamme]");
  const yardFlip = $("[data-yard-flip]");
  const cursor = $<HTMLElement>("[data-mini-cursor]");
  $("[data-course-summary]").textContent = courseSummary();

  // Mini-profil : aires atténuées (reste à courir) + mêmes aires pleines, découpées à la
  // position du coureur (parcouru).
  const svg = $<SVGSVGElement>("[data-mini-profile]");
  const { areas, ridge } = profilePaths({ width: 1000, height: 100, pad: { top: 6, right: 0, bottom: 0, left: 0 } });
  const fills = areas.map((a) => `<path d="${a.d}" fill="${a.color}"/>`).join("");
  svg.innerHTML =
    `<defs><clipPath id="mini-done"><rect data-mini-clip x="0" y="0" width="0" height="100"/></clipPath></defs>` +
    `<g opacity="0.32">${fills}</g>` +
    `<g clip-path="url(#mini-done)">${fills}</g>` +
    `<path d="${ridge}" fill="none" stroke="${palette.brume}" stroke-opacity="0.55" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
  const clip = svg.querySelector("[data-mini-clip]")!;

  const items = stageItems();

  if (staticCourse) {
    // Vue statique : profil entièrement « parcouru », fiches étape listées en clair.
    clip.setAttribute("width", "1000");
    const list = $("[data-course-list]");
    list.innerHTML = items
      .map((it) => `<li><span class="tv">${escapeHtml(`${it.kicker} · ${it.title}`)}</span><br>${escapeHtml(it.stats)}</li>`)
      .join("");
    list.hidden = false;
    return;
  }
  let activeItem: StageItem | undefined;
  let lastFlamme = false;
  let lastYard = false;

  subscribe((s, changed) => {
    if (!changed.has("courseD") && !changed.has("yardDone")) return;
    const d = s.courseD;
    const p = d / route.totalM;

    hud.km.textContent = km(d);
    hud.alt.textContent = num(profileAt("ele", d));
    hud.grade.textContent = signed(Math.round(profileAt("grade", d)));
    hud.clock.textContent = clock(p * format.referenceLoopMinutes * 60, true);
    hud.yard.textContent = s.yardDone ? "02" : "01";

    clip.setAttribute("width", (p * 1000).toFixed(1));
    cursor.style.transform = `translateX(${(p * 100).toFixed(3)}cqw)`;

    intro.classList.toggle("is-gone", d > 60);

    const item = items.find((it) => d >= it.from && d <= it.to);
    if (item !== activeItem) {
      activeItem = item;
      if (item) {
        $("[data-stage-kicker]").textContent = item.kicker;
        $("[data-stage-title]").textContent = item.title;
        $("[data-stage-stats]").textContent = item.stats;
      }
      card.classList.toggle("is-visible", !!item);
    }

    const inFlamme = !!route.flammeRouge && d >= route.flammeRouge.distM && d < route.flammeRouge.distM + 400;
    if (inFlamme !== lastFlamme) {
      lastFlamme = inFlamme;
      flamme.classList.toggle("is-visible", inFlamme);
    }

    if (s.yardDone !== lastYard) {
      lastYard = s.yardDone;
      yardFlip.classList.toggle("is-visible", s.yardDone);
    }
  });
}
