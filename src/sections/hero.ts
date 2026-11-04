/**
 * Page 1 : les lettres du titre partent et reviennent, encore et encore ; et le compte à
 * rebours jusqu'au premier départ. La boucle elle-même tourne en 3D derrière (src/map).
 */
import { startDate } from "../content/date";
import { pad2 } from "../lib/format";

/** Intervalle entre deux passages du titre. */
const AGAIN_MS = 4000;

export interface TitleLoop {
  /** Arrêt (bouton Pause, page 1 hors écran, onglet caché). */
  setPaused(reason: string, paused: boolean): void;
}

export function initTitleLoop({ reducedMotion }: { reducedMotion: boolean }): TitleLoop {
  const title = document.querySelector<HTMLElement>("[data-title-loop]");
  const pausedBy = new Set<string>();
  let timer = 0;
  const again = () => {
    if (!title) return;
    // relance l'animation CSS des lettres
    title.classList.remove("is-again");
    void title.offsetWidth;
    title.classList.add("is-again");
  };
  const sync = () => {
    window.clearInterval(timer);
    timer = 0;
    if (!reducedMotion && title && pausedBy.size === 0) timer = window.setInterval(again, AGAIN_MS);
  };
  const setPaused = (reason: string, paused: boolean) => {
    if (paused) pausedBy.add(reason);
    else pausedBy.delete(reason);
    sync();
  };
  if (title) {
    new IntersectionObserver(([entry]) => setPaused("offscreen", !entry.isIntersecting)).observe(title);
    document.addEventListener("visibilitychange", () => setPaused("hidden", document.hidden));
  }
  sync();
  return { setPaused };
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
