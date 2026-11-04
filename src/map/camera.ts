/**
 * Caméra « hélico » : orbite lente autour de la boucle, mise en pause quand la carte est
 * cachée (page 1 à l'écran, onglet en arrière-plan).
 */
import type * as maplibregl from "maplibre-gl";
import type { PaddingOptions } from "maplibre-gl";
import { routeBounds } from "../data/route";

const ORBIT_DEG_PER_S = 3;

export class HeliCamera {
  private orbiting = false;
  private raf = 0;
  private lastT = 0;
  private bearing = -20;
  /** Raisons de pause en cours (onglet caché, page 2 hors écran…). */
  private readonly pausedBy = new Set<string>();

  constructor(
    private readonly map: maplibregl.Map,
    private readonly opts: { mobile: boolean; reducedMotion: boolean },
  ) {
    document.addEventListener("visibilitychange", () => this.setPaused("hidden", document.hidden));
  }

  /**
   * `cameraForBounds` en partant d'un padding nul : sinon MapLibre ajoute au padding
   * demandé celui déjà posé sur la carte et dézoome à tort.
   */
  private fit(bounds: [[number, number], [number, number]], padding: PaddingOptions) {
    this.map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    return this.map.cameraForBounds(bounds, { padding, pitch: 0 });
  }

  /** Cadrage de la page 2 : la boucle entière dans le haut de l'écran, au-dessus du titre. */
  private frame(): { center: [number, number]; zoom: number; pitch: number; padding: PaddingOptions } {
    const [[w, s], [e, n]] = routeBounds();
    const center: [number, number] = [(w + e) / 2, (s + n) / 2];
    const kx = Math.cos((center[1] * Math.PI) / 180);
    // cercle englobant : la boucle reste dans le cadre pendant toute l'orbite
    const r = Math.hypot(((e - w) / 2) * kx, (n - s) / 2) * 1.04;
    const vh = window.innerHeight;
    const padding: PaddingOptions = this.opts.mobile
      ? { top: Math.round(vh * 0.2), bottom: Math.round(vh * 0.32), left: 12, right: 12 }
      : { top: Math.round(vh * 0.12), bottom: Math.round(vh * 0.36), left: 60, right: 60 };
    const cam = this.fit(
      [
        [center[0] - r / kx, center[1] - r],
        [center[0] + r / kx, center[1] + r],
      ],
      padding,
    );
    const pitch = this.opts.mobile ? 40 : 55;
    return { center, zoom: (cam?.zoom ?? 13.5) + (this.opts.mobile ? 0.25 : 0.15), pitch, padding };
  }

  /** Orbite lente ; vue fixe si prefers-reduced-motion. */
  orbit() {
    this.map.jumpTo({ ...this.frame(), bearing: this.bearing });
    this.orbiting = !this.opts.reducedMotion;
    this.loop();
  }

  /** Vue figée sur la boucle entière (images statiques). */
  overview(padding: PaddingOptions, pitch: number, bearing = -20) {
    this.orbiting = false;
    this.loop();
    const cam = this.fit(routeBounds(), padding);
    this.map.jumpTo({ center: cam?.center, zoom: cam?.zoom, pitch, bearing, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
  }

  setPaused(reason: string, paused: boolean) {
    if (paused) this.pausedBy.add(reason);
    else this.pausedBy.delete(reason);
    this.loop();
  }

  private loop() {
    const running = this.pausedBy.size === 0 && this.orbiting;
    if (!running) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    if (this.raf) return;
    this.lastT = performance.now();
    const tick = (t: number) => {
      const dt = Math.min((t - this.lastT) / 1000, 0.1);
      this.lastT = t;
      this.bearing = (this.bearing + dt * ORBIT_DEG_PER_S) % 360;
      this.map.jumpTo({ bearing: this.bearing });
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
}
