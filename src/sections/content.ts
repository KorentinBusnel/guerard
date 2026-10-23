/**
 * Sections de contenu : horloge-boucle du principe, compteur de yards.
 */
import { route } from "../data/route";
import { milestones, yardsFor } from "../content/milestones";
import { km, num } from "../lib/format";

/** Une boucle = un tour d'horloge (6 s), en pause hors écran. */
function initClockLoop(reducedMotion: boolean) {
  const hand = document.querySelector<SVGPathElement>("[data-clock-hand]");
  const path = document.querySelector<SVGPathElement>("[data-loop-path]");
  const dot = document.querySelector<SVGCircleElement>("[data-loop-dot]");
  if (!hand || !path || !dot) return;
  const length = path.getTotalLength();
  const draw = (t: number) => {
    hand.setAttribute("transform", `rotate(${(t * 360).toFixed(2)})`);
    const pt = path.getPointAtLength(t * length);
    dot.setAttribute("cx", pt.x.toFixed(2));
    dot.setAttribute("cy", pt.y.toFixed(2));
  };
  if (reducedMotion) {
    // Figé à l'allure de référence : 50 min, la boucle presque bouclée.
    draw(50 / 60);
    return;
  }
  const PERIOD_MS = 6000;
  let raf = 0;
  let t0 = 0;
  const tick = (now: number) => {
    if (!t0) t0 = now;
    draw(((now - t0) % PERIOD_MS) / PERIOD_MS);
    raf = requestAnimationFrame(tick);
  };
  draw(0);
  new IntersectionObserver(([entry]) => {
    cancelAnimationFrame(raf);
    if (entry.isIntersecting) raf = requestAnimationFrame(tick);
  }).observe(path.ownerSVGElement!);
}

function initYards() {
  const input = document.querySelector<HTMLInputElement>("#yards-input");
  if (!input) return;
  const out = document.querySelector<HTMLOutputElement>("#yards-count")!;
  const kmEl = document.querySelector<HTMLElement>("[data-yards-km]")!;
  const timeEl = document.querySelector<HTMLElement>("[data-yards-time]")!;
  const dplusEl = document.querySelector<HTMLElement>("[data-yards-dplus]")!;
  const equiv = document.querySelector<HTMLElement>("[data-yards-equiv]")!;
  const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-yards]")];

  const update = () => {
    const n = Number(input.value);
    const distM = n * route.totalM;
    out.value = String(n);
    kmEl.textContent = km(distM, 1);
    timeEl.textContent = String(n);
    dplusEl.textContent = num(n * route.dPlus);
    const passed = [...milestones].reverse().find((m) => n >= yardsFor(m.km));
    const label = `${n} yard${n > 1 ? "s" : ""} = ${km(distM, 1)} km`;
    equiv.textContent = passed ? `${label}, soit plus ${passed.than}.` : `${label}.`;
    input.setAttribute("aria-valuetext", `${n} yards, ${km(distM, 1)} kilomètres, ${n} heures`);
    const pct = ((n - Number(input.min)) / (Number(input.max) - Number(input.min))) * 100;
    input.style.setProperty("--fill", `${pct}%`);
    for (const b of buttons) b.setAttribute("aria-pressed", String(Number(b.dataset.yards) === n));
  };
  input.addEventListener("input", update);
  for (const b of buttons) {
    b.addEventListener("click", () => {
      input.value = b.dataset.yards!;
      update();
    });
  }
  update();
}

export function initContent({ reducedMotion }: { reducedMotion: boolean }) {
  initClockLoop(reducedMotion);
  initYards();
}
