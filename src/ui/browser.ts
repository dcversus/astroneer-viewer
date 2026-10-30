import type { CatalogEntry, ChunkId, DetailNode, ObjectRow } from "../model/types.ts";
import { fmtInt, h, treeNode } from "./dom.ts";
export interface BrowserApi {
  catalog(): Promise<CatalogEntry[]>;
  objects(chunk: ChunkId, type: string): Promise<ObjectRow[]>;
  object(chunk: ChunkId, index: number): Promise<DetailNode[]>;
  showOnMap(entityId: number): void;
  close(): void;
}
const PAGE = 150;
export async function renderBrowser(root: HTMLElement, api: BrowserApi): Promise<void> {
  const body = h("div", { class: "browser-body" }, h("p", { class: "muted" }, "Indexing every object in the save…"));
  root.replaceChildren(
    h(
      "div",
      { class: "journey-inner" },
      h(
        "div",
        { class: "journey-head" },
        h("h2", {}, "Save data"),
        h("button", { type: "button", class: "close", "aria-label": "Close save data", onclick: () => api.close() }, "×"),
      ),
      body,
    ),
  );
  const catalog = await api.catalog();
  const total = catalog.reduce((a, c) => a + c.count, 0);
  const onMap = catalog.reduce((a, c) => a + c.onMap, 0);
  const search = h("input", {
    type: "search",
    class: "search",
    placeholder: "Filter by type: rover, mission, research, voxel…",
    "aria-label": "Filter object types",
  });
  const groups = h("div", {});
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    groups.replaceChildren();
    for (const [chunk, label] of [
      ["level", "World"],
      ["player", "Your astroneer and backpack"],
    ] as const) {
      const list = catalog.filter((c) => c.chunk === chunk && (!q || c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)));
      if (!list.length) continue;
      groups.append(
        h("h3", { class: "section-title" }, `${label} (${fmtInt(list.reduce((a, c) => a + c.count, 0))} objects, ${list.length} types)`),
        h("ul", { class: "types" }, ...list.slice(0, q ? 400 : 1000).map((c) => h("li", {}, typeRow(c, api)))),
      );
    }
    if (!groups.childElementCount) groups.append(h("p", { class: "empty" }, "No object type matches that filter."));
  };
  search.addEventListener("input", draw);
  draw();
  body.replaceChildren(
    h(
      "p",
      { class: "lead" },
      `Every one of the ${fmtInt(total)} objects stored in this save, grouped into ${fmtInt(catalog.length)} types. `,
      `${fmtInt(onMap)} of them are placed on the map; the rest are managers, components and system records. Open any object to see every value it stores.`,
    ),
    search,
    groups,
  );
}
function typeRow(c: CatalogEntry, api: BrowserApi): HTMLElement {
  const list = h("div", { class: "instances" });
  const d = h(
    "details",
    { class: "type" },
    h(
      "summary",
      {},
      h("span", { class: "type-text" }, h("span", { class: "type-name" }, c.name), h("span", { class: "type-path" }, c.type)),
      c.onMap ? h("span", { class: "badge" }, `${fmtInt(c.onMap)} on map`) : null,
      h("span", { class: "count" }, fmtInt(c.count)),
    ),
    list,
  );
  let loaded = false;
  d.addEventListener("toggle", () => {
    void (async () => {
      if (!d.open || loaded) return;
      loaded = true;
      list.append(h("p", { class: "muted small" }, "Loading…"));
      const rows = await api.objects(c.chunk, c.type);
      list.replaceChildren();
      let shown = 0;
      const more = h("button", { type: "button", class: "link more" }, "");
      const page = () => {
        const next = rows.slice(shown, shown + PAGE);
        shown += next.length;
        more.before(...next.map((r) => instanceRow(r, api)));
        more.textContent = `Show ${Math.min(PAGE, rows.length - shown)} more of ${fmtInt(rows.length - shown)}`;
        more.hidden = shown >= rows.length;
      };
      more.addEventListener("click", page);
      list.append(more);
      page();
    })();
  });
  return d;
}
function instanceRow(r: ObjectRow, api: BrowserApi): HTMLElement {
  const tree = h("div", { class: "tree" });
  const d = h(
    "details",
    { class: "instance" },
    h(
      "summary",
      {},
      h(
        "span",
        { class: "type-text" },
        h("span", {}, r.name),
        h("span", { class: "type-path" }, [r.owner ? `part of ${r.owner}` : null, `${fmtInt(r.bytes)} bytes`].filter(Boolean).join(", ")),
      ),
    ),
    tree,
  );
  let loaded = false;
  d.addEventListener("toggle", () => {
    void (async () => {
      if (!d.open || loaded) return;
      loaded = true;
      const nodes = await api.object(r.chunk, r.index);
      tree.replaceChildren(...nodes.map((n) => treeNode(n, 0)));
      if (r.entity !== undefined) tree.prepend(h("button", { type: "button", class: "btn small-btn", onclick: () => api.showOnMap(r.entity!) }, "Show on map"));
    })();
  });
  return d;
}
