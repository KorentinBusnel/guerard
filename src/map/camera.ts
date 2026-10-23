/**
 * Caméra « hélico » : orbite lente autour de la boucle (hero) ou poursuite du coureur
 * (section parcours). Une seule boucle rAF, mise en pause quand la carte est cachée.
 */
import type * as maplibregl from "maplibre-gl";
import type { PaddingOptions } from "maplibre-gl";
import { routeBounds } from "../data/route";
import { lerpAngle } from "../lib/routeMath";

export type CameraMode = "orbit" | "follow" | "still";

export interface FollowTarget {
  center: [number, number];
  bearing: number;
}

const ORBIT_DEG_PER_S = 3;

export class HeliCamera {
  private mode: CameraMode = "still";
  private raf = 0;
  private lastT = 0;
  private bearing = -25;
  /** Raisons de pause en cours (onglet caché, carte hors écran…). */
  private readonly pausedBy = new Set<string>();
  private follow?: () => FollowTarget;
  private followPitch = 60;
  private followZoom = 15.5;
  private followPadding: PaddingOptions = { top: 0, bottom: 0, left: 0, right: 0 };
  private lastCenter: [number, number] = [0, 0];

  constructor(
    private readonly map: maplibregl.Map,
    private readonly opts: { mobile: boolean; reducedMotion: boolean },
  ) {
    document.addEventListener("visibilitychange", () => this.setPaused("hidden", document.hidden));
  }

  /** Cadrage de l'orbite : la boucle entière tient dans le cercle qui tourne. */
  orbitFrame(): { center: [number, number]; zoom: number; pitch: number; padding: PaddingOptions } {
    const [[w, s], [e, n]] = routeBounds();
    const center: [number, number] = [(w + e) / 2, (s + n) / 2];
    const kx = Math.cos((center[1] * Math.PI) / 180);
    const r = Math.hypot(((e - w) / 2) * kx, (n - s) / 2) * 1.04;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Desktop : texte à gauche, boucle à droite. Mobile : boucle en haut, texte en bas.
    const padding: PaddingOptions = this.opts.mobile
      ? { top: 80, bottom: Math.round(vh * 0.42), left: 12, right: 12 }
      : { top: 70, bottom: 50, left: Math.round(vw * 0.44), right: 40 };
    const cam = this.map.cameraForBounds(
      [
        [center[0] - r / kx, center[1] - r],
        [center[0] + r / kx, center[1] + r],
      ],
      { padding, pitch: 0 },
    );
    // vue inclinée : la boucle est raccourcie en profondeur, on resserre le cadrage
    const pitch = this.opts.mobile ? 40 : 60;
    return { center, zoom: (cam?.zoom ?? 13.5) + (this.opts.mobile ? 0.3 : 0.2), pitch, padding };
  }

  /** Orbite lente (fixe si prefers-reduced-motion). */
  orbit() {
    const frame = this.orbitFrame();
    this.map.jumpTo({ ...frame, bearing: this.bearing });
    this.setMode(this.opts.reducedMotion ? "still" : "orbit");
  }

  /**
   * Poursuite : `target()` est relu à chaque image. Le centre suit le coureur au mètre
   * près (le puck ne glisse pas à l'écran) ; le cap, déjà moyenné sur ~150 m dans les
   * données, est en plus amorti dans le temps pour absorber les lacets serrés.
   */
  followTarget(target: () => FollowTarget, view: { pitch: number; zoom: number; padding: PaddingOptions }) {
    this.follow = target;
    this.followPitch = view.pitch;
    this.followZoom = view.zoom;
    this.followPadding = view.padding;
    this.bearing = target().bearing;
    this.applyFollow(0, true);
    this.setMode(this.opts.reducedMotion ? "still" : "follow");
  }

  /** Vue figée sur la boucle entière. */
  overview(padding: PaddingOptions, pitch: number, bearing = -25) {
    this.setMode("still");
    const cam = this.map.cameraForBounds(routeBounds(), { padding, pitch: 0 });
    this.map.jumpTo({ center: cam?.center, zoom: cam?.zoom, pitch, bearing, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
  }

  stop() {
    this.setMode("still");
  }

  setPaused(reason: string, paused: boolean) {
    if (paused) this.pausedBy.add(reason);
    else this.pausedBy.delete(reason);
    this.loop();
  }

  private setMode(mode: CameraMode) {
    this.mode = mode;
    this.loop();
  }

  private applyFollow(dt: number, force = false) {
    if (!this.follow) return;
    const { center, bearing } = this.follow();
    const next = force ? bearing : lerpAngle(this.bearing, bearing, 1 - Math.exp(-dt * 4));
    const moved = Math.abs(center[0] - this.lastCenter[0]) + Math.abs(center[1] - this.lastCenter[1]) > 1e-9;
    if (!force && !moved && Math.abs(((next - this.bearing + 540) % 360) - 180) < 0.01) return; // rien à redessiner
    this.bearing = next;
    this.lastCenter = center;
    this.map.jumpTo({
      center,
      bearing: this.bearing,
      pitch: this.followPitch,
      zoom: this.followZoom,
      padding: this.followPadding,
    });
  }

  private loop() {
    const running = this.pausedBy.size === 0 && this.mode !== "still";
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
      if (this.mode === "orbit") {
        this.bearing = (this.bearing + dt * ORBIT_DEG_PER_S) % 360;
        this.map.jumpTo({ bearing: this.bearing });
      } else if (this.mode === "follow") {
        this.applyFollow(dt);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
}
