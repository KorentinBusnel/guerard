/**
 * État partagé entre le chunk principal (défilement, HUD, profil) et le chunk carte.
 * Le chunk carte, chargé dynamiquement, importe ce même module : même instance.
 */
export type Scene = "hero" | "course" | "content";

export interface PageState {
  scene: Scene;
  /** Distance du coureur sur la boucle, en mètres (section parcours). */
  courseD: number;
  /** Le tour est bouclé : compteur YARD incrémenté. */
  yardDone: boolean;
}

export const state: PageState = { scene: "hero", courseD: 0, yardDone: false };

type Listener = (s: PageState, changed: Set<keyof PageState>) => void;
const listeners = new Set<Listener>();

export function setState(patch: Partial<PageState>) {
  const changed = new Set<keyof PageState>();
  for (const [k, v] of Object.entries(patch) as [keyof PageState, never][]) {
    if (state[k] !== v) {
      (state as unknown as Record<string, unknown>)[k] = v;
      changed.add(k);
    }
  }
  if (changed.has("scene")) document.documentElement.dataset.scene = state.scene;
  if (changed.size) for (const fn of listeners) fn(state, changed);
}

export function subscribe(fn: Listener) {
  listeners.add(fn);
  fn(state, new Set(Object.keys(state) as (keyof PageState)[]));
  return () => listeners.delete(fn);
}

document.documentElement.dataset.scene = state.scene;
