/**
 * Le coureur de la scène 3D : il fait le tour de la boucle, encore et encore ; au bout du
 * tour, le yard suivant part. La lecture « Yard · km · altitude » suit le même point.
 */
import * as maplibregl from "maplibre-gl";
import { route } from "../data/route";
import { eleAt, pointAt } from "./track";
import { km, pad2 } from "../lib/format";
import type { ForestMap } from "./forestMap";

/** Durée d'un tour à l'écran (une « heure » de backyard, en accéléré). */
const LAP_MS = 26_000;

export interface RunnerUi {
  /** Lecture « Yard · km · altitude » (texte décoratif, aria-hidden). */
  readout: HTMLElement | null;
}

export class Runner {
  private readonly marker: maplibregl.Marker;
  private raf = 0;
  /** Temps de course accumulé dans le tour (ms) : la pause le fige. */
  private elapsed = 0;
  private lastT = 0;
  private yard = 1;
  private lastText = "";
  private readonly pausedBy = new Set<string>();

  constructor(
    fm: ForestMap,
    private readonly ui: RunnerUi,
  ) {
    // L'occultation par le relief écrit `style.opacity` sur l'élément racine du marqueur :
    // le style visuel est porté par un enfant.
    const el = document.createElement("div");
    el.className = "runner-marker";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<span class="runner-marker__dot"></span>';
    this.marker = new maplibregl.Marker({ element: el }).setLngLat(route.coords[0]).addTo(fm.map);
    this.render(0);
  }

  /** Arrêt (bouton Pause, page hors écran, onglet caché). */
  setPaused(reason: string, paused: boolean) {
    if (paused) this.pausedBy.add(reason);
    else this.pausedBy.delete(reason);
    if (this.pausedBy.size) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    } else if (!this.raf) {
      this.lastT = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  /** Pas de coureur (reduced motion, captures). */
  showStatic() {
    this.marker.remove();
    if (this.ui.readout) this.ui.readout.hidden = true;
  }

  private readonly tick = (t: number) => {
    this.elapsed += Math.min(t - this.lastT, 100);
    this.lastT = t;
    if (this.elapsed >= LAP_MS) {
      this.elapsed %= LAP_MS;
      this.yard++;
    }
    this.render((this.elapsed / LAP_MS) * route.totalM);
    this.raf = requestAnimationFrame(this.tick);
  };

  private render(d: number) {
    this.marker.setLngLat(pointAt(d));
    const ele = eleAt(d);
    const text = `Yard ${pad2(this.yard)} · km ${km(d, 2)} · ${Math.round(ele)} m`;
    if (this.ui.readout && text !== this.lastText) this.ui.readout.textContent = this.lastText = text;
  }
}
