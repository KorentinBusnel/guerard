/**
 * Page 1 : le coureur fait le tour de la boucle (silhouette du vrai GPX) ; à chaque retour
 * au départ, le compteur de yards avance et les lettres du titre partent et reviennent.
 * Et le compte à rebours jusqu'au premier départ.
 */
import { startDate } from "../content/date";
import { pad2 } from "../lib/format";

/** Durée d'un tour d'animation (une « heure » de backyard, en accéléré). */
const LAP_MS = 7000;

export function initLoopArt({ reducedMotion }: { reducedMotion: boolean }) {
  const trail = document.querySelector<SVGPathElement>("[data-loop-trail]");
  const runner = document.querySelector<SVGCircleElement>("[data-loop-runner]");
  const yardEl = document.querySelector<HTMLElement>("[data-yard]");
  const title = document.querySelector<HTMLElement>("[data-title-loop]");
  if (!trail || !runner || !yardEl || !title) return;

  const length = trail.getTotalLength();
  const place = (t: number) => {
    const pt = trail.getPointAtLength(t * length);
    runner.setAttribute("cx", pt.x.toFixed(2));
    runner.setAttribute("cy", pt.y.toFixed(2));
    trail.style.strokeDashoffset = String(1 - t);
  };

  if (reducedMotion) {
    // Pas d'animation : la boucle entière, le coureur au départ.
    place(0);
    trail.style.strokeDashoffset = "0";
    return;
  }

  let yard = 1;
  let raf = 0;
  let t0 = 0;
  let lastLap = 0;
  const again = () => {
    yard += 1;
    yardEl.textContent = `Yard ${pad2(yard)}`;
    // relance l'animation CSS des lettres
    title.classList.remove("is-again");
    void title.offsetWidth;
    title.classList.add("is-again");
  };
  const tick = (now: number) => {
    if (!t0) t0 = now - lastLap * LAP_MS;
    const elapsed = now - t0;
    const lap = Math.floor(elapsed / LAP_MS);
    if (lap > lastLap) {
      lastLap = lap;
      again();
    }
    place((elapsed % LAP_MS) / LAP_MS);
    raf = requestAnimationFrame(tick);
  };
  place(0);
  // Seulement quand la page 1 est à l'écran (et l'onglet visible).
  new IntersectionObserver(([entry]) => {
    cancelAnimationFrame(raf);
    t0 = 0;
    if (entry.isIntersecting) raf = requestAnimationFrame(tick);
  }).observe(trail.ownerSVGElement!);
}

export function initCountdown() {
  const target = startDate();
  const els = {
    d: document.querySelector<HTMLElement>('[data-cd="d"]'),
    h: document.querySelector<HTMLElement>('[data-cd="h"]'),
    m: document.querySelector<HTMLElement>('[data-cd="m"]'),
    s: document.querySelector<HTMLElement>('[data-cd="s"]'),
  };
  const box = document.querySelector<HTMLElement>("[data-countdown]");
  if (!target || !box || !els.d || !els.h || !els.m || !els.s) return;

  let timer = 0;
  const render = () => {
    const left = Math.max(0, target.getTime() - Date.now());
    const total = Math.floor(left / 1000);
    els.d!.textContent = pad2(Math.floor(total / 86_400));
    els.h!.textContent = pad2(Math.floor((total % 86_400) / 3600));
    els.m!.textContent = pad2(Math.floor((total % 3600) / 60));
    els.s!.textContent = pad2(total % 60);
    if (left === 0) {
      box.textContent = "C'est parti";
      window.clearInterval(timer);
    }
  };
  render();
  timer = window.setInterval(render, 1000);
}
