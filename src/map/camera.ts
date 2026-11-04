/**
 * Caméra de la page 2 : la boucle en grand, en orbite lente.
 *
 * - On peut la faire tourner à la main (glisser) : l'orbite reprend après une pause.
 * - « Vue de dessus » / « Vue 3D » : transition d'inclinaison, animée dans la même boucle
 *   que l'orbite (un easeTo serait coupé par le jumpTo de l'orbite à l'image suivante).
 * - Arrêt complet quand la carte est cachée (page 1 à l'écran, onglet en arrière-plan).
 */
import type * as maplibregl from "maplibre-gl";
import type { PaddingOptions } from "maplibre-gl";
import { routeBounds } from "../data/route";

const ORBIT_DEG_PER_S = 4;
/** Après un glisser, l'orbite attend un peu avant de repartir. */
const HOLD_AFTER_DRAG_MS = 2500;
export const PITCH = { desktop: 60, mobile: 52, min: 0, max: 72 } as const;

export class HeliCamera {
  private raf = 0;
  private lastT = 0;
  private bearing = -20;
  private pitch: number;
  private targetPitch: number;
  /** Orbite automatique voulue (bouton Pause, reduced motion). */
  private spin: boolean;
  private holdUntil = 0;
  /** Raisons d'arrêt complet (onglet caché, page 2 hors écran…). */
  private readonly pausedBy = new Set<string>();

  constructor(
    private readonly map: maplibregl.Map,
    private readonly opts: { mobile: boolean; reducedMotion: boolean },
  ) {
    this.pitch = this.targetPitch = opts.mobile ? PITCH.mobile : PITCH.desktop;
    this.spin = !opts.reducedMotion;
    document.addEventListener("visibilitychange", () => this.setPaused("hidden", document.hidden));
  }

  /**
   * Cadrage de la page 1 : la boucle occupe l'espace libre sous le titre, à côté du compte
   * à rebours. Le zoom est calculé pour que le cercle englobant de la boucle (elle reste
   * dans le cadre pendant toute l'orbite) tienne dans cet espace ; inclinée, elle s'écrase
   * en hauteur, d'où le facteur `squash`.
   */
  private frame(): { center: [number, number]; zoom: number; padding: PaddingOptions } {
    const [[w, s], [e, n]] = routeBounds();
    const center: [number, number] = [(w + e) / 2, (s + n) / 2];
    const cosLat = Math.cos((center[1] * Math.PI) / 180);
    const rM = Math.hypot(((e - w) / 2) * cosLat * 111_320, ((n - s) / 2) * 111_320);
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const padding: PaddingOptions = this.opts.mobile
      ? { top: Math.round(vh * 0.33), bottom: Math.round(vh * 0.3), left: 8, right: 8 }
      : { top: Math.round(vh * 0.4), bottom: Math.round(vh * 0.08), left: Math.round(vw * 0.28), right: Math.round(vw * 0.02) };
    const freeW = vw - (padding.left ?? 0) - (padding.right ?? 0);
    const freeH = vh - (padding.top ?? 0) - (padding.bottom ?? 0);
    const squash = 0.56;
    const diamPx = Math.max(Math.min(freeW, freeH / squash), 160);
    // tuiles de 512 px : mètres par pixel = C · cos(lat) / (512 · 2^z)
    const zoom = Math.log2((40_075_016.686 * cosLat * diamPx) / (512 * 2 * rM));
    return { center, zoom, padding };
  }

  /** Place la caméra sur la boucle ; l'orbite démarre si elle est voulue (setSpin). */
  orbit() {
    this.map.jumpTo({ ...this.frame(), bearing: this.bearing, pitch: this.pitch });
    this.kick();
  }

  get spinning() {
    return this.spin;
  }

  /** Bouton Pause / Lecture. */
  setSpin(on: boolean) {
    this.spin = on && !this.opts.reducedMotion;
    this.kick();
  }

  get topDown() {
    return this.targetPitch === 0;
  }

  /** Bouton « Vue de dessus » / « Vue 3D ». */
  setTopDown(on: boolean) {
    this.targetPitch = on ? 0 : this.opts.mobile ? PITCH.mobile : PITCH.desktop;
    if (this.opts.reducedMotion) {
      this.pitch = this.targetPitch;
      this.map.jumpTo({ pitch: this.pitch });
    }
    this.kick();
  }

  /** Glisser : tourner (horizontal) et incliner (vertical, souris seulement). */
  rotateBy(dBearing: number, dPitch = 0) {
    this.bearing = (this.bearing + dBearing) % 360;
    if (dPitch) {
      this.pitch = Math.min(Math.max(this.pitch + dPitch, PITCH.min), PITCH.max);
      this.targetPitch = this.pitch;
    }
    this.holdUntil = performance.now() + HOLD_AFTER_DRAG_MS;
    this.map.jumpTo({ bearing: this.bearing, pitch: this.pitch });
    this.kick();
  }

  setPaused(reason: string, paused: boolean) {
    if (paused) this.pausedBy.add(reason);
    else this.pausedBy.delete(reason);
    this.kick();
  }

  private needsFrame() {
    return this.spin || Math.abs(this.targetPitch - this.pitch) > 0.05;
  }

  /** (Re)lance la boucle d'animation si elle a quelque chose à faire. */
  private kick() {
    const run = this.pausedBy.size === 0 && this.needsFrame();
    if (!run) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    if (this.raf) return;
    this.lastT = performance.now();
    const tick = (t: number) => {
      const dt = Math.min((t - this.lastT) / 1000, 0.1);
      this.lastT = t;
      if (this.spin && t > this.holdUntil) this.bearing = (this.bearing + dt * ORBIT_DEG_PER_S) % 360;
      if (this.pitch !== this.targetPitch) {
        const k = 1 - Math.exp(-dt * 3.5);
        this.pitch += (this.targetPitch - this.pitch) * k;
        if (Math.abs(this.targetPitch - this.pitch) <= 0.05) this.pitch = this.targetPitch;
      }
      this.map.jumpTo({ bearing: this.bearing, pitch: this.pitch });
      if (this.pausedBy.size === 0 && this.needsFrame()) this.raf = requestAnimationFrame(tick);
      else this.raf = 0;
    };
    this.raf = requestAnimationFrame(tick);
  }
}
