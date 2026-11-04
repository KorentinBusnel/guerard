/**
 * Les gestes de la scène 3D, et le lien entre la boucle et son profil.
 *
 * - Glisser : tourner autour de la boucle (et l'incliner, à la souris) ; lâché, la vue
 *   continue sur sa lancée. Au doigt, seul l'horizontal tourne : le vertical reste au
 *   défilement de la page (`touch-action: pan-y` sur la carte).
 * - Deux doigts : pincer pour zoomer, pivoter pour tourner. Ctrl / ⌘ + molette (et le
 *   pincement des pavés tactiles) : zoom. La molette seule fait défiler la page.
 * - Double-clic : retour au cadrage de départ.
 * - Survoler le tracé (toucher, au doigt) : kilomètre et altitude du point, repérés aussi
 *   sur le grand profil de la page 2 ; survoler le profil place le point sur la boucle.
 */
import * as maplibregl from "maplibre-gl";
import { route } from "../data/route";
import { km } from "../lib/format";
import { RELIEF, yPercent } from "../sections/profileSvg";
import type { HeliCamera } from "./camera";
import { eleAt, pointAt } from "./track";

interface Options {
  map: maplibregl.Map;
  camera: HeliCamera;
  container: HTMLElement;
  /** Le grand profil de la page 2 (zone survolable). */
  relief: HTMLElement | null;
  /** Appelé après un zoom (état des boutons + / −). */
  onZoom?: () => void;
}

const DEG = 180 / Math.PI;
const label = (d: number) => `km ${km(d, 2)} · ${Math.round(eleAt(d))} m`;

/** Point de la boucle le plus proche d'un point de l'écran, s'il est assez près. */
function nearestOnRoute(map: maplibregl.Map, x: number, y: number, radius: number): number | null {
  const { coords, distM } = route;
  let best = radius * radius;
  let bestD: number | null = null;
  for (let i = 0; i < coords.length; i += 2) {
    const p = map.project(coords[i]);
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d2 < best) {
      best = d2;
      bestD = distM[i];
    }
  }
  return bestD;
}

export function enableInteractions({ map, camera, container, relief, onZoom }: Options) {
  // ---------- Le point repéré : sur la boucle (marqueur) et sur le profil (curseur) ----------
  const probeEl = document.createElement("div");
  probeEl.className = "probe";
  probeEl.setAttribute("aria-hidden", "true");
  probeEl.innerHTML = '<span class="probe__dot"></span><span class="probe__label caption"></span>';
  const probeLabel = probeEl.querySelector<HTMLElement>(".probe__label")!;
  const probe = new maplibregl.Marker({ element: probeEl });
  let probeOn = false;

  const cursor = document.createElement("div");
  cursor.className = "relief__cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.hidden = true;
  cursor.innerHTML = '<span class="relief__cursor-dot"></span><span class="relief__cursor-label caption"></span>';
  const cursorLabel = cursor.querySelector<HTMLElement>(".relief__cursor-label")!;
  relief?.append(cursor);

  const show = (d: number) => {
    const text = label(d);
    probe.setLngLat(pointAt(d));
    probeLabel.textContent = text;
    if (!probeOn) {
      probe.addTo(map);
      probeOn = true;
    }
    cursor.hidden = false;
    cursor.classList.toggle("is-flipped", d / route.totalM > 0.7);
    cursor.style.setProperty("--x", `${(d / route.totalM) * 100}%`);
    cursor.style.setProperty("--y", `${yPercent(RELIEF, eleAt(d))}%`);
    cursorLabel.textContent = text;
  };
  const hide = () => {
    if (probeOn) probe.remove();
    probeOn = false;
    cursor.hidden = true;
  };

  // ---------- Gestes sur la carte ----------
  const pointers = new Map<number, { x: number; y: number }>();
  let last = { x: 0, y: 0, t: 0 };
  let velocity = 0;
  let downAt = { x: 0, y: 0, t: 0 };
  let pinch: { dist: number; angle: number } | null = null;
  let hoverRaf = 0;

  const pinchState = () => {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) * DEG };
  };
  const local = (e: PointerEvent | MouseEvent) => {
    const r = container.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  container.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    container.setPointerCapture(e.pointerId);
    if (pointers.size === 1) {
      last = downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
      velocity = 0;
      container.classList.add("is-dragging");
    } else if (pointers.size === 2) {
      pinch = pinchState();
    }
  });

  container.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) {
      // survol à la souris (aucun bouton) : le point le plus proche sur la boucle
      if (e.pointerType === "mouse" && !hoverRaf) {
        hoverRaf = requestAnimationFrame(() => {
          hoverRaf = 0;
          const { x, y } = local(e);
          const d = nearestOnRoute(map, x, y, 22);
          if (d === null) hide();
          else show(d);
        });
      }
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinch) {
      const now = pinchState();
      camera.zoomBy(Math.log2(now.dist / pinch.dist), false);
      camera.rotateBy(-(now.angle - pinch.angle));
      pinch = now;
      onZoom?.();
      return;
    }
    if (pointers.size !== 1) return;
    const t = performance.now();
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    const dBearing = -dx * 0.3;
    camera.rotateBy(dBearing, e.pointerType === "mouse" ? -dy * 0.2 : 0);
    const dt = Math.max((t - last.t) / 1000, 1 / 120);
    velocity = velocity * 0.6 + (dBearing / dt) * 0.4;
    last = { x: e.clientX, y: e.clientY, t };
    hide();
  });

  const end = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    const wasSingle = pointers.size === 1;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) container.classList.remove("is-dragging");
    if (!wasSingle || e.type === "pointercancel") return;
    const t = performance.now();
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    if (moved < 6 && t - downAt.t < 350) {
      // toucher / clic bref : le point de la boucle sous le doigt, ou rien
      const { x, y } = local(e);
      const d = nearestOnRoute(map, x, y, e.pointerType === "mouse" ? 22 : 34);
      if (d === null) hide();
      else show(d);
      return;
    }
    if (t - last.t < 80) camera.fling(velocity);
  };
  container.addEventListener("pointerup", end);
  container.addEventListener("pointercancel", end);
  container.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse" && !pointers.size) hide();
  });

  container.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return; // la molette seule fait défiler la page
      e.preventDefault();
      camera.zoomBy(-e.deltaY * (e.deltaMode === 1 ? 0.12 : 0.0045), false);
      onZoom?.();
    },
    { passive: false },
  );

  container.addEventListener("dblclick", () => {
    camera.reset();
    onZoom?.();
  });

  // ---------- Le grand profil de la page 2 → le point sur la boucle ----------
  if (relief) {
    const fromProfile = (e: PointerEvent) => {
      const r = relief.getBoundingClientRect();
      const f = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
      show(f * route.totalM);
    };
    relief.addEventListener("pointermove", fromProfile);
    relief.addEventListener("pointerdown", fromProfile);
    relief.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "mouse") hide();
    });
  }
}
