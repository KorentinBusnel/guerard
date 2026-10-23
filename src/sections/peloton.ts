/**
 * Le peloton, côté interactif : curseur « le peloton s'égrène », recherche et
 * dépliage du classement, prono du visiteur (mémorisé localement, partageable par lien).
 */
import { inscrits } from "../data/inscrits";
import { route } from "../data/route";
import { pelotonStats, rankedRunners, runnerLabel, shareBelow, survival } from "../content/peloton";
import { km, num } from "../lib/format";

const STORAGE_KEY = "guerard:prono";
/** Espace insécable avant « : », « ? », « % » (typographie française). */
const NB = "\u00a0";
const TOP_ROWS = 10;

interface Prono {
  bib: string;
  yards: number;
}

function readStored(): Prono | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return v && typeof v.bib === "string" && Number.isInteger(v.yards) ? v : null;
  } catch {
    return null;
  }
}

function store(p: Prono) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // navigation privée : le prono reste valable pour la session
  }
}

/** `?prono=012-31` → { bib: "012", yards: 31 } (le dossard peut contenir des tirets). */
function readShared(): Prono | null {
  const raw = new URLSearchParams(location.search).get("prono");
  const m = raw?.match(/^(.+)-(\d{1,3})$/);
  if (!m) return null;
  const yards = Number(m[2]);
  return inscrits.runners.some((r) => r.bib === m[1]) && yards >= 1 && yards <= 200 ? { bib: m[1], yards } : null;
}

function initSurvival() {
  const input = document.querySelector<HTMLInputElement>("#survival-yard");
  const readout = document.querySelector<HTMLElement>("[data-survival-readout]");
  if (!input || !readout) return;
  const counts = survival();
  const bars = [...document.querySelectorAll<SVGRectElement>(".sv-bar")];
  const leaders = rankedRunners().filter((r) => r.leader);
  const { withGoal } = pelotonStats();

  const update = () => {
    const k = Number(input.value);
    const n = counts[k] ?? 0;
    for (const b of bars) {
      const y = Number(b.dataset.yard);
      b.classList.toggle("is-current", y === k);
      b.classList.toggle("is-after", y > k);
    }
    const pct = ((k - Number(input.min)) / (Number(input.max) - Number(input.min) || 1)) * 100;
    input.style.setProperty("--fill", `${pct}%`);
    const lead =
      k === counts.length - 1 && leaders.length
        ? ` Dernier${leaders.length > 1 ? "s" : ""} debout prévisionnel${leaders.length > 1 ? "s" : ""}${NB}: ${leaders.map(runnerLabel).join(", ")}.`
        : "";
    readout.textContent =
      `Au départ du yard ${k}${NB}: ${num(n)} inscrit${n > 1 ? "s" : ""} sur ${num(withGoal)}. ` +
      `Le boucler, c'est ${km(k * route.totalM, 1)} km dans les jambes.${lead}`;
    input.setAttribute("aria-valuetext", `Yard ${k}, ${n} inscrits au départ`);
  };
  input.addEventListener("input", update);
  update();
}

function initStandings(highlight: () => string | null) {
  const tbody = document.querySelector<HTMLElement>("[data-standings]");
  const search = document.querySelector<HTMLInputElement>("#standings-search");
  const more = document.querySelector<HTMLButtonElement>("[data-standings-more]");
  if (!tbody || !search || !more) return () => {};
  const rows = [...tbody.querySelectorAll<HTMLTableRowElement>("tr[data-search]")];
  let expanded = rows.length <= TOP_ROWS + 2;
  more.hidden = expanded;

  const apply = () => {
    const q = search.value.trim().toLowerCase();
    const bib = highlight();
    rows.forEach((row, i) => {
      const match = q ? row.dataset.search!.includes(q) : expanded || i < TOP_ROWS;
      row.hidden = !match;
      row.classList.toggle("is-picked", !!bib && row.dataset.bib === bib);
    });
    more.hidden = expanded || !!q;
  };
  search.addEventListener("input", apply);
  more.addEventListener("click", () => {
    expanded = true;
    apply();
  });
  apply();
  return apply;
}

function initProno(onChange: () => void) {
  const form = document.querySelector<HTMLFormElement>("[data-prono]");
  if (!form || !inscrits.runners.length) return { current: () => null as string | null };
  const select = form.elements.namedItem("bib") as HTMLSelectElement;
  const yardsInput = form.elements.namedItem("yards") as HTMLInputElement;
  const result = form.querySelector<HTMLElement>("[data-prono-result]")!;
  const text = form.querySelector<HTMLElement>("[data-prono-text]")!;
  const shareBtn = form.querySelector<HTMLButtonElement>("[data-prono-share]")!;
  const copied = form.querySelector<HTMLElement>("[data-prono-copied]")!;
  const sharedNote = form.querySelector<HTMLElement>("[data-prono-shared]")!;
  let current: Prono | null = null;

  const describe = (p: Prono) => {
    const runner = inscrits.runners.find((r) => r.bib === p.bib)!;
    const optimism = Math.round(shareBelow(p.yards) * 100);
    const vsGoal =
      runner.goal === null
        ? ""
        : p.yards > runner.goal
          ? ` Plus loin que son propre objectif (${num(runner.goal)} yards).`
          : p.yards < runner.goal
            ? ` Moins loin que son propre objectif (${num(runner.goal)} yards).`
            : " Pile son objectif annoncé.";
    return {
      runner,
      sentence:
        `${runnerLabel(runner)} dernier debout après ${num(p.yards)} yards, soit ${km(p.yards * route.totalM, 1)} km. ` +
        `Plus optimiste que ${optimism}${NB}% des objectifs annoncés.${vsGoal}`,
    };
  };

  const show = (p: Prono) => {
    current = p;
    select.value = p.bib;
    yardsInput.value = String(p.yards);
    text.textContent = `Ton prono${NB}: ${describe(p).sentence}`;
    result.hidden = false;
    copied.hidden = true;
    onChange();
  };

  const shared = readShared();
  if (shared) {
    sharedNote.textContent = `Prono reçu${NB}: ${describe(shared).sentence} Et toi${NB}?`;
    sharedNote.hidden = false;
    select.value = shared.bib;
    yardsInput.value = String(shared.yards);
  }
  const stored = readStored();
  if (stored && inscrits.runners.some((r) => r.bib === stored.bib)) show(stored);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const yards = Math.round(Number(yardsInput.value));
    if (!select.value || !(yards >= 1 && yards <= 200)) return;
    const p = { bib: select.value, yards };
    store(p);
    show(p);
  });

  shareBtn.addEventListener("click", async () => {
    if (!current) return;
    const url = new URL(location.href);
    url.search = `?prono=${encodeURIComponent(current.bib)}-${current.yards}`;
    url.hash = "peloton";
    const title = document.title;
    const body = `Mon prono${NB}: ${describe(current).sentence}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: body, url: url.toString() });
        return;
      }
      await navigator.clipboard.writeText(`${body} ${url}`);
      copied.hidden = false;
    } catch {
      // partage annulé ou presse-papiers refusé : rien à faire
    }
  });

  return { current: () => current?.bib ?? null };
}

export function initPeloton() {
  if (!document.getElementById("peloton")) return;
  initSurvival();
  let refresh = () => {};
  const prono = initProno(() => refresh());
  refresh = initStandings(() => prono.current());
}
