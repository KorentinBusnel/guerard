/**
 * Caméra de la scène 3D (fond fixe des deux pages) : la boucle en grand, en orbite lente.
 *
 * - Deux cadrages : sous le titre de la page 1, puis (grand écran) dans l'espace libre de
 *   la page 2, entre les chiffres, le formulaire et le relief ; on passe de l'un à l'autre
 *   au fil du défilement.
 * - On peut la faire tourner à la main (glisser) : l'orbite reprend après une pause.
 * - « Vue de dessus » / « Vue 3D » : transition d'inclinaison, animée dans la même boucle
 *   que l'orbite (un easeTo serait coupé par le jumpTo de l'orbite à l'image suivante).
 * - Arrêt complet quand la scène est cachée (onglet en arrière-plan, pied de page).
 */
import type * as maplibregl from "maplibre-gl";
import type { PaddingOptions } from "maplibre-gl";
import { routeBounds } from "../data/route";

const ORBIT_DEG_PER_S = 4;
/** Zoom laissé à l'utilisateur, autour du cadrage (en niveaux de zoom). */
const ZOOM_RANGE = { min: -1.5, max: 2.5 } as const;
/** Après un glisser, l'orbite attend un peu avant de repartir. */
const HOLD_AFTER_DRAG_MS = 2500;
export const PITCH = { desktop: 60, mobile: 52, min: 0, max: 72 } as const;

interface Frame {
  zoom: number;
  padding: { top: number; bottom: number; left: number; right: number };
}

export class HeliCamera {
  private raf = 0;
  private lastT = 0;
  private bearing = -20;
  private pitch: number;
  private targetPitch: number;
  /** Orbite automatique voulue (bouton Pause, reduced motion). */
  private spin: boolean;
  private holdUntil = 0;
  /** Raisons d'arrêt complet (onglet caché, scène hors écran…). */
  private readonly pausedBy = new Set<string>();
  private frames: [Frame, Frame] = [
    { zoom: 13.5, padding: { top: 0, bottom: 0, left: 0, right: 0 } },
    { zoom: 13.5, padding: { top: 0, bottom: 0, left: 0, right: 0 } },
  ];
  private progress = 0;
  private zoomOffset = 0;
  private targetZoomOffset = 0;
  /** Vitesse de rotation laissée par un glisser (°/s), amortie : l'inertie. */
  private spinVelocity = 0;

  constructor(
    private readonly map: maplibregl.Map,
    private readonly opts: { mobile: boolean; reducedMotion: boolean },
  ) {
    this.pitch = this.targetPitch = opts.mobile ? PITCH.mobile : PITCH.desktop;
    this.spin = !opts.reducedMotion;
    document.addEventListener("visibilitychange", () => this.setPaused("hidden", document.hidden));
  }

  /**
   * Cadrage : la boucle occupe l'espace libre d'une page. Le zoom est calculé pour que le
   * cercle englobant de la boucle (elle reste dans le cadre pendant toute l'orbite) tienne
   * dans cet espace ; inclinée, elle s'écrase en hauteur, d'où le facteur `squash`.
   */
  private frameIn(padding: Required<Pick<PaddingOptions, "top" | "bottom" | "left" | "right">>): Frame {
    const [[w, s], [e, n]] = routeBounds();
    const cosLat = Math.cos((((s + n) / 2) * Math.PI) / 180);
    const rM = Math.hypot(((e - w) / 2) * cosLat * 111_320, ((n - s) / 2) * 111_320);
    const freeW = window.innerWidth - padding.left - padding.right;
    const freeH = window.innerHeight - padding.top - padding.bottom;
    const squash = 0.56;
    const diamPx = Math.max(Math.min(freeW, freeH / squash), 160);
    // tuiles de 512 px : mètres par pixel = C · cos(lat) / (512 · 2^z)
    const zoom = Math.log2((40_075_016.686 * cosLat * diamPx) / (512 * 2 * rM));
    return { zoom, padding };
  }

  /** Page 1 : sous le titre, à côté du compte à rebours. Page 2 : à gauche du formulaire. */
  private computeFrames() {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    if (this.opts.mobile) {
      const f = this.frameIn({ top: Math.round(vh * 0.33), bottom: Math.round(vh * 0.3), left: 8, right: 8 });
      this.frames = [f, f];
      return;
    }
    this.frames = [
      this.frameIn({ top: Math.round(vh * 0.32), bottom: Math.round(vh * 0.08), left: Math.round(vw * 0.28), right: Math.round(vw * 0.02) }),
      // colonne du formulaire (30rem + gouttières) à droite, relief en bas
      this.frameIn({ top: Math.round(vh * 0.27), bottom: Math.round(vh * 0.31), left: Math.round(vw * 0.03), right: Math.min(Math.round(vw * 0.45), 600) }),
    ];
  }

  private current() {
    const [a, b] = this.frames;
    const t = this.progress;
    const mix = (x: number, y: number) => x + (y - x) * t;
    const [[w, s], [e, n]] = routeBounds();
    return {
      center: [(w + e) / 2, (s + n) / 2] as [number, number],
      zoom: mix(a.zoom, b.zoom) + this.zoomOffset,
      padding: {
        top: mix(a.padding.top, b.padding.top),
        bottom: mix(a.padding.bottom, b.padding.bottom),
        left: mix(a.padding.left, b.padding.left),
        right: mix(a.padding.right, b.padding.right),
      },
      bearing: this.bearing,
      pitch: this.pitch,
    };
  }

  private apply() {
    this.map.jumpTo(this.current());
  }

  /** Place la caméra sur la boucle (et recadre après un redimensionnement). */
  orbit() {
    this.computeFrames();
    this.apply();
    this.kick();
  }

  /** Défilement : 0 = page 1 à l'écran, 1 = page 2. */
  setProgress(t: number) {
    const p = Math.min(Math.max(t, 0), 1);
    if (Math.abs(p - this.progress) < 0.001) return;
    this.progress = p;
    // si la boucle d'animation tourne, elle appliquera le cadrage à l'image suivante
    if (!this.raf) this.apply();
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
      this.apply();
    }
    this.kick();
  }

  /** Glisser : tourner (horizontal) et incliner (vertical, souris seulement). */
  rotateBy(dBearing: number, dPitch = 0) {
    this.spinVelocity = 0;
    this.bearing = (this.bearing + dBearing) % 360;
    if (dPitch) {
      this.pitch = Math.min(Math.max(this.pitch + dPitch, PITCH.min), PITCH.max);
      this.targetPitch = this.pitch;
    }
    this.holdUntil = performance.now() + HOLD_AFTER_DRAG_MS;
    this.apply();
    this.kick();
  }

  /** Fin de glisser : la vue continue sur sa lancée (°/s), puis ralentit. */
  fling(velocity: number) {
    if (this.opts.reducedMotion) return;
    this.spinVelocity = Math.max(Math.min(velocity, 240), -240);
    this.holdUntil = performance.now() + HOLD_AFTER_DRAG_MS;
    this.kick();
  }

  /** Zoom (+ rapproche), autour du cadrage ; borné. `smooth` : transition douce. */
  zoomBy(dz: number, smooth = true) {
    this.targetZoomOffset = Math.min(Math.max(this.targetZoomOffset + dz, ZOOM_RANGE.min), ZOOM_RANGE.max);
    if (!smooth || this.opts.reducedMotion) {
      this.zoomOffset = this.targetZoomOffset;
      this.apply();
    }
    this.kick();
  }

  get canZoomIn() {
    return this.targetZoomOffset < ZOOM_RANGE.max - 0.01;
  }

  get canZoomOut() {
    return this.targetZoomOffset > ZOOM_RANGE.min + 0.01;
  }

  /** Retour au cadrage de départ (zoom, inclinaison). */
  reset() {
    this.targetZoomOffset = 0;
    this.targetPitch = this.opts.mobile ? PITCH.mobile : PITCH.desktop;
    this.spinVelocity = 0;
    if (this.opts.reducedMotion) {
      this.zoomOffset = 0;
      this.pitch = this.targetPitch;
      this.apply();
    }
    this.kick();
  }

  setPaused(reason: string, paused: boolean) {
    if (paused) this.pausedBy.add(reason);
    else this.pausedBy.delete(reason);
    this.kick();
  }

  private needsFrame() {
    return (
      this.spin ||
      Math.abs(this.spinVelocity) > 0.5 ||
      Math.abs(this.targetPitch - this.pitch) > 0.05 ||
      Math.abs(this.targetZoomOffset - this.zoomOffset) > 0.002
    );
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
      if (Math.abs(this.spinVelocity) > 0.5) {
        this.bearing = (this.bearing + this.spinVelocity * dt) % 360;
        this.spinVelocity *= Math.exp(-dt * 2.2);
      } else {
        this.spinVelocity = 0;
        if (this.spin && t > this.holdUntil) this.bearing = (this.bearing + dt * ORBIT_DEG_PER_S) % 360;
      }
      const k = 1 - Math.exp(-dt * 3.5);
      if (this.pitch !== this.targetPitch) {
        this.pitch += (this.targetPitch - this.pitch) * k;
        if (Math.abs(this.targetPitch - this.pitch) <= 0.05) this.pitch = this.targetPitch;
      }
      if (this.zoomOffset !== this.targetZoomOffset) {
        this.zoomOffset += (this.targetZoomOffset - this.zoomOffset) * (1 - Math.exp(-dt * 6));
        if (Math.abs(this.targetZoomOffset - this.zoomOffset) <= 0.002) this.zoomOffset = this.targetZoomOffset;
      }
      this.apply();
      if (this.pausedBy.size === 0 && this.needsFrame()) this.raf = requestAnimationFrame(tick);
      else this.raf = 0;
    };
    this.raf = requestAnimationFrame(tick);
  }
}
