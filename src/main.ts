import "./styles.css";
import { CATEGORIES, CATEGORY, PLANETS, PLANET_ORDER } from "./model/catalog.ts";
import type { CategoryId, DetailNode, Entity, Planet, PlanetId, WorldModel } from "./model/types.ts";
import { World } from "./scene/world.ts";
import { altitudeText, append, fmtInt, fmtMeters, h, latLon, planetOrb, store, surfaceDistance, treeNode } from "./ui/dom.ts";
import { icon } from "./ui/icons.ts";
import { renderBrowser } from "./ui/browser.ts";
import { renderJourney } from "./ui/journey.ts";
import type { WorkerRequest, WorkerResponse } from "./worker.ts";

const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
const post = (m: WorkerRequest, transfer: Transferable[] = []) => worker.postMessage(m, transfer);

const MY_STUFF: CategoryId[] = ["player", "start", "base", "power", "tether", "vehicle", "beacon"];

interface State {
  model?: WorldModel;
  planet: PlanetId;
  layers: Set<CategoryId>;
  selected: Entity | null;
  hovered: Entity | null;
  query: string;
  scope: "planet" | "all";
  xray: boolean;
  openGroups: Set<string>;
}

const state: State = {
  planet: "Terran",
  layers: new Set(store.get<CategoryId[]>("atlas.layers.v3", MY_STUFF)),
  selected: null,
  hovered: null,
  query: "",
  scope: "planet",
  xray: false,
  openGroups: new Set(),
};

const app = document.getElementById("app")!;
const stage = h("div", { class: "stage" });
const labels = h("div", { class: "labels", "aria-hidden": "true" });
const fileInput = h("input", { type: "file", accept: ".savegame,.sav,.gvas", hidden: true });
const planetChip = h("button", { class: "planet-chip", type: "button", title: "Choose another world", hidden: true });
const searchInput = h("input", {
  type: "search",
  class: "search-input",
  placeholder: "Search or choose what the map shows",
  "aria-label": "Search and layers",
  autocomplete: "off",
});
const searchPop = h("div", { class: "search-pop", hidden: true });
const searchWrap = h("div", { class: "search-wrap", hidden: true }, h("span", { class: "search-icon" }, icon("search")), searchInput, searchPop);
const iconBtn = (name: Parameters<typeof icon>[0], label: string, onclick: () => void, extra: Record<string, string> = {}) =>
  h("button", { class: "ibtn", type: "button", title: label, "aria-label": label, onclick, ...extra }, icon(name));
const journeyBtn = iconBtn("journey", "Your journey", () => openJourney(), { disabled: "" });
const openBtn = iconBtn("folder", "Open another save", () => fileInput.click());
const topbar = h("header", { class: "topbar" }, planetChip, searchWrap, h("div", { class: "top-actions" }, journeyBtn, openBtn, fileInput));
const drawer = h("aside", { class: "panel drawer", "aria-label": "Selected object", hidden: true });
const system = h("section", { class: "system", "aria-label": "Choose a world", hidden: true });
const xrayBtn = iconBtn("xray", "X-ray: see underground (x)", () => toggleXray(), { "aria-pressed": "false" });
const tools = h(
  "div",
  { class: "tools" },
  iconBtn("plus", "Zoom in", () => globe.zoomBy(0.7)),
  iconBtn("minus", "Zoom out", () => globe.zoomBy(1.4)),
  iconBtn("orbit", "Back to orbit", () => globe.resetView()),
  xrayBtn,
);
const tooltip = h("div", { class: "tooltip", role: "status", hidden: true });
const journey = h("section", { class: "journey", "aria-label": "Your journey", hidden: true });
const browser = h("section", { class: "journey browser", "aria-label": "Save data", hidden: true });
const veil = h("div", { class: "veil" });
const dropHint = h("div", { class: "drop-hint", hidden: true }, h("p", {}, "Drop your .savegame to explore it"));

app.append(h("div", { class: "sky", "aria-hidden": "true" }), stage, labels, topbar, drawer, tools, tooltip, system, journey, browser, veil, dropHint);

const globe = new World(stage, {
  onHover(e, x, y) {
    state.hovered = e;
    if (!e) {
      tooltip.hidden = true;
      return;
    }
    tooltip.replaceChildren(
      h("span", { class: "chip-dot", style: `--c:${CATEGORY[e.cat].color}` }),
      h("strong", {}, e.name),
      h(
        "span",
        { class: "muted" },
        [e.interesting ?? CATEGORY[e.cat].label, e.alt < -1500 && e.planet !== "Space" ? altitudeText(e).toLowerCase() : null].filter(Boolean).join(", "),
      ),
    );
    tooltip.hidden = false;
    const pad = 16;
    const w = tooltip.offsetWidth;
    tooltip.style.left = `${Math.min(window.innerWidth - w - pad, x + 14)}px`;
    tooltip.style.top = `${y + 18}px`;
  },
  onPick(e) {
    select(e, false);
  },
});

const labelPool: HTMLElement[] = [];
const clusterPool: HTMLElement[] = [];
let shownLabelIds = new Set<number>();
function tickLabels() {
  requestAnimationFrame(tickLabels);
  if (!state.model || !system.hidden) {
    for (const l of labelPool) l.hidden = true;
    for (const c of clusterPool) c.hidden = true;
    return;
  }
  globe.setKeep([state.selected?.id, state.hovered?.id]);
  const clusters = globe.clusters();
  while (clusterPool.length < clusters.length) {
    const el = h("button", { class: "cluster", type: "button", title: "Zoom in to see these" });
    el.addEventListener("click", () => {
      const c = globe.clusters()[Number(el.dataset.i)];
      if (c) globe.zoomToCluster(c);
    });
    labels.append(el);
    clusterPool.push(el);
  }
  clusterPool.forEach((el, i) => {
    const c = clusters[i];
    if (!c) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.dataset.i = String(i);
    if (el.textContent !== String(c.count)) el.textContent = String(c.count);
    el.style.setProperty("--c", c.color);
    const size = c.count >= 50 ? 46 : c.count >= 10 ? 40 : 34;
    el.style.width = el.style.height = `${size}px`;
    el.style.transform = `translate(${Math.round(c.x)}px, ${Math.round(c.y)}px) translate(-50%, -50%)`;
  });
  const limit = matchMedia("(max-width: 760px)").matches ? 10 : 26;
  const raw = globe.labelTargets(limit * 3, [state.selected, state.hovered], globe.cam.distance < 1.5);
  const sticky = raw.filter((t) => shownLabelIds.has(t.entity.id));
  const fresh = raw.filter((t) => !shownLabelIds.has(t.entity.id));
  const targets = [...sticky, ...fresh].slice(0, limit);
  while (labelPool.length < targets.length) {
    const el = h("button", { class: "pin-label", type: "button" });
    el.addEventListener("click", () => {
      const id = Number(el.dataset.id);
      const e = state.model?.entities.find((x) => x.id === id);
      if (e) select(e, true);
    });
    labels.append(el);
    labelPool.push(el);
  }
  const placed: { x: number; y: number; w: number; text: string }[] = [];
  const kept = targets.filter((t) => {
    const w = Math.min(220, 24 + t.entity.name.length * 6.6);
    const y = t.y - 76;
    const forced = t.entity === state.selected || t.entity === state.hovered;
    if (!forced && placed.some((p) => Math.abs(p.y - y) < 22 && Math.abs(p.x - t.x) < (p.w + w) / 2 + 6)) return false;
    if (!forced && placed.some((p) => p.text === t.entity.name && Math.hypot(p.x - t.x, p.y - y) < 220)) return false;
    placed.push({ x: t.x, y, w, text: t.entity.name });
    return true;
  });
  shownLabelIds = new Set(kept.map((t) => t.entity.id));
  labelPool.forEach((el, i) => {
    const t = kept[i];
    if (!t) {
      el.hidden = true;
      return;
    }
    const sel = t.entity === state.selected;
    if (el.dataset.id !== String(t.entity.id) || el.dataset.sel !== String(sel)) {
      el.dataset.id = String(t.entity.id);
      el.dataset.sel = String(sel);
      el.textContent = t.entity.name;
      el.style.setProperty("--c", CATEGORY[t.entity.cat].color);
      el.classList.toggle("selected", sel);
    }
    el.hidden = false;
    el.style.transform = `translate(${Math.round(t.x)}px, ${Math.round(t.y - 62)}px) translate(-50%, -100%)`;
  });
}
tickLabels();
labels.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    globe.renderer.domElement.dispatchEvent(
      new WheelEvent("wheel", { deltaY: e.deltaY, deltaX: e.deltaX, clientX: e.clientX, clientY: e.clientY, bubbles: false, cancelable: true }),
    );
  },
  { passive: false },
);
for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"] as const) {
  labels.addEventListener(type, (e) => {
    const copy = new PointerEvent(type, e);
    (copy as PointerEvent & { forwarded?: boolean }).forwarded = true;
    globe.renderer.domElement.dispatchEvent(copy);
  });
}

worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
  const msg = ev.data;
  if (msg.kind === "model") onModel(msg.model);
  else if (msg.kind === "error") showVeil("error", msg.message);
  else if (msg.kind === "details") onDetails(msg.id, msg.nodes);
  else if (msg.kind === "query") {
    pending.get(msg.seq)?.(msg.result);
    pending.delete(msg.seq);
  }
};

const pending = new Map<number, (v: unknown) => void>();
let querySeq = 0;
function query<T>(req: Record<string, unknown>): Promise<T> {
  const seq = ++querySeq;
  return new Promise<T>((resolve) => {
    pending.set(seq, resolve as (v: unknown) => void);
    worker.postMessage({ kind: "query", seq, ...req });
  });
}

function openRawData() {
  if (!state.model) return;
  journey.hidden = true;
  browser.hidden = false;
  void renderBrowser(browser, {
    catalog: () => query({ op: "catalog" }),
    objects: (chunk, type) => query({ op: "objects", chunk, type }),
    object: (chunk, index) => query({ op: "object", chunk, index }),
    showOnMap: (id) => {
      const e = state.model?.entities.find((x) => x.id === id);
      browser.hidden = true;
      if (e) select(e, true);
    },
    close: () => (browser.hidden = true),
  }).then(
    () => browser.querySelector<HTMLElement>("button.close")?.focus(),
    () => undefined,
  );
}

function loadFile(name: string, bytes: ArrayBuffer) {
  showVeil("loading", name);
  post({ kind: "parse", name, bytes }, [bytes]);
}

const SAVE_LOCATIONS: { icon: Parameters<typeof icon>[0]; title: string; path: string; note?: string }[] = [
  { icon: "windows", title: "Steam on Windows", path: "%LocalAppData%\\Astro\\Saved\\SaveGames" },
  {
    icon: "linux",
    title: "Steam on Linux (Proton)",
    path: "~/.steam/steam/steamapps/compatdata/361420/pfx/drive_c/users/steamuser/AppData/Local/Astro/Saved/SaveGames",
  },
  {
    icon: "deck",
    title: "Steam Deck",
    path: "/home/deck/.local/share/Steam/steamapps/compatdata/361420/pfx/drive_c/users/steamuser/AppData/Local/Astro/Saved/SaveGames",
    note: "Switch to Desktop mode, or copy the folder with Warpinator or a USB stick.",
  },
  {
    icon: "xbox",
    title: "Microsoft Store / Game Pass",
    path: "%LocalAppData%\\Packages\\SystemEraSoftworks.29415440E1269_ftk5pbg2rayv2\\SystemAppData\\wgs",
    note: "These saves are in a container format; convert them with AstroSaveConverter first.",
  },
];

function showVeil(mode: "landing" | "loading" | "error" | "none", text = "") {
  veil.hidden = mode === "none";
  app.classList.toggle("empty", !state.model);
  if (!state.model && mode !== "loading")
    globe.setPlanet({ id: "Terran", name: "Sylva", tagline: "", center: [0, 0, 0], radius: 120000, seed: 2399841, visited: false, counts: {} }, []);
  veil.dataset.mode = mode;
  if (mode === "none") return;
  if (mode === "loading") {
    veil.replaceChildren(
      h("div", { class: "veil-card" }, h("div", { class: "spinner", "aria-hidden": "true" }), h("p", {}, "Reading ", h("strong", {}, text), " …")),
    );
    return;
  }
  const pick = h("button", { class: "btn btn-primary big", type: "button", onclick: () => fileInput.click() }, icon("upload"), "Choose a save file");
  veil.replaceChildren(
    h(
      "div",
      { class: "veil-card landing" },
      h("h1", {}, mode === "error" ? "That file didn't open" : "Astroneer Viewer"),
      mode === "error"
        ? h("p", { class: "error" }, text, ". Pick an Astroneer .savegame file and try again.")
        : h(
            "p",
            {},
            "Open a save to see your worlds in 3D: your bases, vehicles, tethers and beacons, where you died, research still waiting, and how far your missions have come.",
          ),
      pick,
      h("p", { class: "muted small" }, "Or drop the file anywhere on this page. Everything stays in your browser; nothing is uploaded."),
      h(
        "div",
        { class: "where-list" },
        h("h2", {}, "Where saves live"),
        ...SAVE_LOCATIONS.map((l) =>
          h(
            "div",
            { class: "where-row" },
            h("span", { class: "where-icon" }, icon(l.icon)),
            h("div", {}, h("strong", {}, l.title), h("code", {}, l.path), l.note ? h("span", { class: "muted small" }, l.note) : null),
          ),
        ),
      ),
    ),
  );
}

async function readPicked(file: File) {
  loadFile(file.name, await file.arrayBuffer());
}
fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (f) void readPicked(f);
  fileInput.value = "";
});

let dragDepth = 0;
window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragDepth++;
  dropHint.hidden = false;
});
window.addEventListener("dragleave", () => {
  if (--dragDepth <= 0) dropHint.hidden = true;
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropHint.hidden = true;
  const f = e.dataTransfer?.files?.[0];
  if (f) void readPicked(f);
});

function onModel(model: WorldModel) {
  state.model = model;
  state.selected = null;
  journeyBtn.removeAttribute("disabled");
  browser.hidden = true;
  searchWrap.hidden = false;
  const stored = store.get<PlanetId | null>("atlas.planet", null);
  const playerPlanet = model.player.entity?.planet;
  state.planet = stored && model.planets.some((p) => p.id === stored) ? stored : playerPlanet && playerPlanet !== "Space" ? playerPlanet : model.startPlanet;
  showVeil("none");
  setPlanet(state.planet, true);
  journey.hidden = true;
  showSystem(true);
}

function planetOf(id: PlanetId): Planet | undefined {
  return state.model?.planets.find((p) => p.id === id);
}

function setPlanet(id: PlanetId, initial = false) {
  const model = state.model;
  const planet = planetOf(id);
  if (!model || !planet) return;
  state.planet = id;
  store.set("atlas.planet", id);
  state.selected = null;
  drawer.hidden = true;
  globe.setPlanet(planet, model.entities, undefined, model.links);
  globe.setLayers(state.layers);
  document.documentElement.style.setProperty("--planet-glow", PLANETS[planet.id].colors[3]);
  planetChip.hidden = false;
  planetChip.replaceChildren(planetOrb(PLANETS[planet.id].colors, 22), h("span", {}, planet.name), h("span", { class: "chev" }, icon("chevron")));
  renderSearch();
  if (!initial) globe.resetView();
}

function showSystem(on: boolean) {
  system.hidden = !on;
  app.classList.toggle("choosing", on);
  if (!on) return;
  const model = state.model!;
  const cards = PLANET_ORDER.map((id) => {
    const p = model.planets.find((x) => x.id === id);
    if (!p) return null;
    const meta = PLANETS[id];
    const youHere = model.player.entity?.planet === id;
    const total = Object.values(p.counts).reduce((a, b) => a + (b ?? 0), 0);
    const status = youHere ? "You are here" : p.visited ? "Visited" : "Not visited yet";
    const stats = (p.visited ? (["base", "vehicle", "beacon", "tether", "power"] as CategoryId[]) : [])
      .filter((c) => p.counts[c])
      .slice(0, 4)
      .map((c) => `${fmtInt(p.counts[c]!)} ${CATEGORY[c].label.toLowerCase()}`);
    return h(
      "button",
      {
        type: "button",
        class: `world-card${id === state.planet ? " current" : ""}${youHere ? " here" : ""}`,
        "data-planet": id,
        onclick: () => enterPlanet(id),
      },
      h("span", { class: "world-orb" }, planetOrb(meta.colors, 132)),
      h("span", { class: "world-name" }, p.name),
      h("span", { class: "world-tag" }, meta.tagline),
      h("span", { class: `badge${youHere ? " here" : p.visited ? "" : " muted"}` }, status),
      h("span", { class: "world-stats" }, stats.length ? stats.join(" · ") : p.visited ? `${fmtInt(total)} things here` : "Nothing of yours here yet"),
      h("span", { class: "world-enter" }, "Open map"),
    );
  });
  system.replaceChildren(
    h("div", { class: "system-head" }, h("h2", {}, "Choose a world"), h("p", { class: "muted" }, "Tap a planet to open its map. Swipe on a phone.")),
    h("div", { class: "world-grid" }, ...cards.filter((c): c is HTMLButtonElement => !!c)),
  );
  queueMicrotask(() => system.querySelector<HTMLElement>(".world-card.current")?.scrollIntoView({ inline: "center", block: "nearest" }));
}

function enterPlanet(id: PlanetId) {
  showSystem(false);
  if (id !== state.planet) setPlanet(id);
  else globe.resetView();
}
planetChip.addEventListener("click", () => showSystem(true));

function planetEntities(): Entity[] {
  return state.model?.entities.filter((e) => e.planet === state.planet) ?? [];
}

function reference(planetId = state.planet): Entity | undefined {
  const m = state.model;
  if (!m) return undefined;
  if (m.player.entity?.planet === planetId) return m.player.entity;
  return m.entities.find((e) => e.cat === "start" && e.planet === planetId);
}

function distanceText(e: Entity): string | undefined {
  const ref = reference(e.planet);
  const planet = planetOf(e.planet);
  if (!ref || !planet || ref === e) return undefined;
  return `${fmtMeters(surfaceDistance(ref, e, planet))} from ${ref.cat === "player" ? "you" : "your start"}`;
}

function byDistance(list: Entity[]): Entity[] {
  const cache = new Map<Entity, number>();
  const d = (e: Entity) => {
    let v = cache.get(e);
    if (v === undefined) {
      const ref = reference(e.planet);
      const planet = planetOf(e.planet);
      v = ref && planet ? surfaceDistance(ref, e, planet) : Infinity;
      cache.set(e, v);
    }
    return v;
  };
  return [...list].sort((a, b) => (a.planet === state.planet ? 0 : 1) - (b.planet === state.planet ? 0 : 1) || d(a) - d(b));
}

function setLayers(next: Set<CategoryId>) {
  state.layers = next;
  store.set("atlas.layers.v3", [...next]);
  globe.setLayers(next);
  renderSearch();
}

function entityRow(e: Entity, showPlanet: boolean): HTMLElement {
  const dist = distanceText(e);
  const parts = [
    showPlanet || e.planet !== state.planet ? (planetOf(e.planet)?.name ?? e.planet) : null,
    dist,
    e.alt < -1500 && e.planet !== "Space" ? "underground" : null,
  ].filter(Boolean);
  return h(
    "li",
    {},
    h(
      "button",
      { type: "button", class: "row", onclick: () => pickResult(e) },
      h("span", { class: "glyph sm", style: `--c:${CATEGORY[e.cat].color}` }, CATEGORY[e.cat].glyph),
      h("span", { class: "row-text" }, h("span", {}, e.name), h("span", { class: "muted" }, parts.join(", ") || CATEGORY[e.cat].label)),
    ),
  );
}

function pickResult(e: Entity) {
  closeSearch();
  showSystem(false);
  select(e, true);
}

function pagedRows(list: Entity[], showPlanet: boolean, page = 60): HTMLElement {
  const ul = h("ul", { class: "rows" });
  const more = h("button", { type: "button", class: "link more" });
  let shown = 0;
  const next = () => {
    ul.append(...list.slice(shown, shown + page).map((e) => entityRow(e, showPlanet)));
    shown = Math.min(list.length, shown + page);
    more.textContent = `Show ${Math.min(page, list.length - shown)} more of ${fmtInt(list.length - shown)}`;
    more.hidden = shown >= list.length;
  };
  more.addEventListener("click", next);
  next();
  return h("div", {}, ul, more);
}

let searchOpen = false;
function openSearch() {
  searchOpen = true;
  searchPop.hidden = false;
  searchWrap.classList.add("open");
  renderSearch();
}
function closeSearch() {
  searchOpen = false;
  searchPop.hidden = true;
  searchWrap.classList.remove("open");
  searchInput.blur();
}
searchInput.addEventListener("focus", openSearch);
searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  if (!searchOpen) openSearch();
  else renderSearch();
});
document.addEventListener("pointerdown", (e) => {
  if (searchOpen && !searchWrap.contains(e.target as Node)) closeSearch();
});

function renderSearch() {
  if (!state.model || !searchOpen) return;
  const q = state.query.trim().toLowerCase();
  const scope = state.scope;
  const pool = scope === "all" ? state.model.entities : planetEntities();
  const counts = new Map<CategoryId, number>();
  for (const e of pool) counts.set(e.cat, (counts.get(e.cat) ?? 0) + 1);
  const isDefault = state.layers.size === MY_STUFF.length && MY_STUFF.every((c) => state.layers.has(c));
  const head = h(
    "div",
    { class: "filters" },
    h(
      "div",
      { class: "filter-row" },
      h(
        "div",
        { class: "scope", role: "group", "aria-label": "Where to search" },
        ...(["planet", "all"] as const).map((sc) =>
          h(
            "button",
            { type: "button", class: "chip", "aria-pressed": String(scope === sc), onclick: () => ((state.scope = sc), renderSearch()) },
            icon(sc === "planet" ? "globe" : "orbit"),
            sc === "planet" ? (planetOf(state.planet)?.name ?? "This world") : "All worlds",
          ),
        ),
      ),
      h(
        "button",
        {
          type: "button",
          class: "chip reset",
          "aria-pressed": String(isDefault),
          title: "Show only you, your home and what you built",
          onclick: () => setLayers(new Set(MY_STUFF)),
        },
        icon("home"),
        "My stuff only",
      ),
      h("button", { type: "button", class: "chip", onclick: () => setLayers(new Set(CATEGORIES.map((c) => c.id))) }, icon("layers"), "Everything"),
    ),
    h(
      "div",
      { class: "cat-chips", role: "group", "aria-label": "Layers shown on the map" },
      ...CATEGORIES.filter((c) => counts.get(c.id)).map((c) =>
        h(
          "button",
          {
            type: "button",
            class: "chip layer-chip",
            style: `--c:${c.color}`,
            role: "switch",
            "aria-checked": String(state.layers.has(c.id)),
            title: `${c.hint}. ${state.layers.has(c.id) ? "Shown" : "Hidden"} on the map`,
            onclick: () => {
              const next = new Set(state.layers);
              if (next.has(c.id)) next.delete(c.id);
              else next.add(c.id);
              setLayers(next);
            },
          },
          h("span", { class: "glyph xs", style: `--c:${c.color}` }, c.glyph),
          c.label,
          h("span", { class: "chip-count" }, fmtInt(counts.get(c.id)!)),
        ),
      ),
    ),
  );
  const visible = pool.filter((e) => state.layers.has(e.cat));
  const hiddenCount = pool.length - visible.length;
  let body: HTMLElement;
  if (q) {
    const hits = byDistance(
      visible.filter((e) => e.name.toLowerCase().includes(q) || e.cls.toLowerCase().includes(q) || CATEGORY[e.cat].label.toLowerCase().includes(q)),
    );
    const hiddenHits = pool.filter(
      (e) => !state.layers.has(e.cat) && (e.name.toLowerCase().includes(q) || CATEGORY[e.cat].label.toLowerCase().includes(q)),
    ).length;
    body = h(
      "div",
      { class: "results" },
      h(
        "p",
        { class: "muted small" },
        hits.length ? `${fmtInt(hits.length)} ${hits.length === 1 ? "match" : "matches"}, nearest first` : "Nothing matches in the layers that are on.",
        hiddenHits ? ` ${fmtInt(hiddenHits)} more in hidden layers.` : "",
      ),
      pagedRows(hits, scope === "all"),
    );
  } else {
    const groups = new Map<string, Entity[]>();
    for (const e of visible) {
      if (!e.interesting) continue;
      const list = groups.get(e.interesting) ?? [];
      list.push(e);
      groups.set(e.interesting, list);
    }
    const order = [
      "Your last saved position",
      "Where your journey began",
      "Gateway chamber waiting to be activated",
      "Locked puzzle with a reward inside",
      "Unclaimed research bytes",
      "Lost backpack that may still hold items",
      "A lost astroneer rests here",
      "Not researched yet",
      "Salvage with scrap and parts",
    ];
    const sorted = [...groups].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]));
    body = h(
      "div",
      { class: "results" },
      h("h3", { class: "section-title" }, "Worth a visit"),
      sorted.length
        ? h(
            "div",
            { class: "groups" },
            ...sorted.map(([reason, list]) => {
              const d = h(
                "details",
                { class: "group", open: state.openGroups.has(reason) },
                h(
                  "summary",
                  {},
                  h("span", { class: "glyph sm", style: `--c:${CATEGORY[list[0].cat].color}` }, CATEGORY[list[0].cat].glyph),
                  h("span", { class: "group-name" }, reason),
                  h("span", { class: "count" }, fmtInt(list.length)),
                ),
                pagedRows(byDistance(list), scope === "all"),
              );
              d.addEventListener("toggle", () => (d.open ? state.openGroups.add(reason) : state.openGroups.delete(reason)));
              return d;
            }),
          )
        : h("p", { class: "empty" }, "Nothing to suggest in the layers that are on."),
      hiddenCount ? h("p", { class: "muted small" }, `${fmtInt(hiddenCount)} things are in hidden layers. Turn layers on above to discover more.`) : null,
    );
  }
  searchPop.replaceChildren(head, body);
}

let detailSeq = 0;

function select(e: Entity | null, fly: boolean) {
  if (e && e.planet !== state.planet) setPlanet(e.planet);
  state.selected = e;
  globe.setSelected(e);
  if (!e) {
    drawer.hidden = true;
    return;
  }
  if (!state.layers.has(e.cat)) setLayers(new Set([...state.layers, e.cat]));
  if (fly) globe.flyTo(e);
  renderDrawer(e);
  post({ kind: "details", id: e.id, seq: ++detailSeq });
}

function renderDrawer(e: Entity, nodes?: DetailNode[]) {
  const c = CATEGORY[e.cat];
  const dist = distanceText(e);
  drawer.hidden = false;
  drawer.replaceChildren();
  append(drawer, [
    h(
      "div",
      { class: "drawer-head" },
      h("span", { class: "glyph lg", style: `--c:${c.color}` }, c.glyph),
      h("div", {}, h("h2", {}, e.name), h("p", { class: "muted" }, `${c.label} · ${planetOf(e.planet)?.name ?? e.planet}`)),
      h("button", { type: "button", class: "close", "aria-label": "Close details", onclick: () => select(null, false) }, icon("close")),
    ),
    e.interesting ? h("p", { class: "callout" }, e.interesting) : null,
    h(
      "dl",
      { class: "facts" },
      fact("Where", altitudeText(e)),
      dist ? fact("Distance", dist) : null,
      ...e.facts.filter((f) => f.label !== "Color").map((f) => fact(f.label, f.value, f.tone)),
    ),
    h(
      "div",
      { class: "drawer-actions" },
      h("button", { type: "button", class: "btn", onclick: () => globe.flyTo(e) }, icon("fly"), "Fly here"),
      e.alt < -1500 && e.planet !== "Space" && !state.xray
        ? h("button", { type: "button", class: "btn", onclick: () => toggleXray() }, icon("xray"), "See it with X-ray")
        : null,
      h(
        "button",
        {
          type: "button",
          class: "btn",
          onclick: (ev: Event) => {
            navigator.clipboard?.writeText(`${e.name} — ${planetOf(e.planet)?.name ?? e.planet} ${latLon(e)}`).then(
              () => ((ev.currentTarget as HTMLButtonElement).lastChild!.textContent = "Copied"),
              () => ((ev.currentTarget as HTMLButtonElement).lastChild!.textContent = "Copy failed"),
            );
          },
        },
        icon("copy"),
        "Copy location",
      ),
    ),
    h(
      "details",
      { class: "branch advanced" },
      h("summary", {}, "Advanced: raw save data"),
      h("p", { class: "muted small" }, `Position ${latLon(e)}`),
      nodes ? h("div", { class: "tree" }, ...nodes.map((n) => treeNode(n, 0))) : h("p", { class: "muted small" }, "Loading save data…"),
    ),
  ]);
}

function fact(label: string, value: string, tone?: string): HTMLElement {
  return h("div", { class: `fact${tone ? ` tone-${tone}` : ""}` }, h("dt", {}, label), h("dd", {}, value));
}

function onDetails(id: number, nodes: DetailNode[]) {
  if (state.selected?.id === id) renderDrawer(state.selected, nodes);
}

function toggleXray() {
  state.xray = !state.xray;
  xrayBtn.setAttribute("aria-pressed", String(state.xray));
  globe.setXray(state.xray);
  if (state.selected && !drawer.hidden) post({ kind: "details", id: state.selected.id, seq: ++detailSeq });
}

function openJourney() {
  if (!state.model) return;
  browser.hidden = true;
  renderJourney(journey, state.model, {
    close: () => (journey.hidden = true),
    goToPlanet: (id) => {
      journey.hidden = true;
      enterPlanet(id);
    },
    showEntities: (cat) => {
      journey.hidden = true;
      showSystem(false);
      setLayers(new Set([...state.layers, cat]));
      state.query = CATEGORY[cat].label;
      searchInput.value = state.query;
      openSearch();
    },
    openRawData,
  });
  journey.hidden = false;
  journey.querySelector<HTMLElement>("button.close")?.focus();
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (searchOpen) closeSearch();
    else if (!browser.hidden) browser.hidden = true;
    else if (!journey.hidden) journey.hidden = true;
    else if (!system.hidden && state.model) showSystem(false);
    else if (state.selected) select(null, false);
  }
  if ((e.target as HTMLElement).tagName === "INPUT") return;
  if (e.key === "x" && state.model) toggleXray();
  if (e.key === "/" && state.model) {
    e.preventDefault();
    searchInput.focus();
  }
});

showVeil("landing");

if (import.meta.env.DEV) Object.assign(window, { atlas: { globe, state, showSystem } });
