import type { DetailNode, Entity, Planet } from "../model/types.ts";
type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | undefined | null>;
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = String(v);
    else if (k === "style") el.setAttribute("style", String(v));
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}
export function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
}
export function svg(markup: string): SVGElement {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as SVGElement;
}
export const fmtInt = (n: number) => Math.round(n).toLocaleString("en-US");
export function fmtMeters(cm: number): string {
  const m = Math.abs(cm) / 100;
  if (m >= 1000) return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km`;
  return `${Math.round(m)} m`;
}
export function altitudeText(e: Entity): string {
  if (e.planet === "Space") return "In orbit, aboard or near the station";
  if (e.alt < -1500) return `About ${fmtMeters(e.alt)} underground`;
  if (e.alt > 1500) return `About ${fmtMeters(e.alt)} above the surface`;
  return "On the surface";
}
export function surfaceDistance(a: Entity, b: Entity, planet: Planet): number {
  const la = Math.hypot(...a.pos) || 1;
  const lb = Math.hypot(...b.pos) || 1;
  const dot = (a.pos[0] * b.pos[0] + a.pos[1] * b.pos[1] + a.pos[2] * b.pos[2]) / (la * lb);
  return Math.acos(Math.min(1, Math.max(-1, dot))) * planet.radius;
}
export function latLon(e: Entity): string {
  const [x, y, z] = e.pos;
  const r = Math.hypot(x, y, z) || 1;
  const lat = (Math.asin(z / r) * 180) / Math.PI;
  const lon = (Math.atan2(y, x) * 180) / Math.PI;
  return `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
}
export function fmtDate(ms?: number): string {
  if (!ms) return "unknown date";
  return new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function planetOrb(colors: readonly string[], size = 28): HTMLElement {
  return h("span", {
    class: "orb",
    "aria-hidden": "true",
    style: `--s:${size}px;background:radial-gradient(circle at 32% 30%, ${colors[2]} 0%, ${colors[1]} 38%, ${colors[0]} 78%);box-shadow:0 0 ${size / 2.4}px -2px ${colors[3]}`,
  });
}
export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      return;
    }
  },
};
export function treeNode(n: DetailNode, depth: number): HTMLElement {
  if (!n.children) return h("div", { class: "leaf" }, h("span", { class: "k" }, n.label), h("span", { class: "v" }, n.value ?? ""));
  return h(
    "details",
    { class: "branch", open: depth === 0 && n.label === "Properties" },
    h("summary", {}, n.label),
    ...n.children.map((c) => treeNode(c, depth + 1)),
  );
}
