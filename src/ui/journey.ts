import { CATEGORY, PLANETS } from "../model/catalog.ts";
import type { CategoryId, Mission, PlanetId, WorldModel } from "../model/types.ts";
import { fmtDate, fmtInt, h, planetOrb, svg } from "./dom.ts";
interface Actions {
  close(): void;
  goToPlanet(id: PlanetId): void;
  showEntities(cat: CategoryId): void;
  openRawData(): void;
}
export function renderJourney(root: HTMLElement, m: WorldModel, act: Actions): void {
  const count = (cat: CategoryId) => m.entities.filter((e) => e.cat === cat).length;
  const realWorlds = m.planets.filter((p) => p.id !== "Space");
  const visited = realWorlds.filter((p) => p.visited);
  const done = m.missions.filter((x) => x.done);
  const active = m.missions.filter((x) => !x.done);
  const r = m.research;
  const lead = h(
    "p",
    { class: "lead" },
    `You've earned ${fmtInt(r.totalPoints)} research bytes and have ${fmtInt(r.balance)} to spend, with ${r.unlocked.length} blueprints unlocked. `,
    r.unclaimedPoints > 0
      ? `Another ${fmtInt(r.unclaimedPoints)} bytes are waiting in ${fmtInt(r.unclaimedSources)} research items you haven't collected. `
      : "",
    `You've landed on ${visited.length} of ${realWorlds.length} worlds, finished ${done.length} missions and found ${fmtInt(count("death"))} lost astroneers.`,
  );
  root.replaceChildren(
    h(
      "div",
      { class: "journey-inner" },
      h(
        "div",
        { class: "journey-head" },
        h("h2", {}, "Your journey"),
        h("button", { type: "button", class: "close", "aria-label": "Close journey", onclick: () => act.close() }, "×"),
      ),
      lead,
      section("Your worlds", worlds(m, act)),
      section("Missions", missions(active, done)),
      section(
        "Research and blueprints",
        h(
          "dl",
          { class: "facts wide" },
          fact("Bytes earned", fmtInt(r.totalPoints)),
          fact("Bytes to spend", fmtInt(r.balance)),
          fact("Waiting to collect", `${fmtInt(r.unclaimedPoints)} in ${fmtInt(r.unclaimedSources)} items`),
          fact("Samples not researched", fmtInt(r.unresearchedSamples)),
          fact("Blueprints unlocked", String(r.unlocked.length)),
          fact("Items discovered", String(r.known.length)),
        ),
        h("button", { type: "button", class: "btn", onclick: () => act.showEntities("research") }, "Show research samples on the map"),
        h("h4", {}, "Unlocked blueprints"),
        h("ul", { class: "chips" }, ...r.unlocked.map((n) => h("li", {}, n))),
        r.known.length
          ? h(
              "details",
              { class: "branch" },
              h("summary", {}, `All ${r.known.length} discovered item types`),
              h("ul", { class: "chips quiet" }, ...r.known.map((n) => h("li", {}, n))),
            )
          : null,
      ),
      section(
        "Lost astroneers",
        h(
          "dl",
          { class: "facts wide" },
          fact("Lost astroneers found", fmtInt(count("death"))),
          fact("Lost backpacks", fmtInt(count("backpack"))),
          m.player.respawnTokens !== undefined ? fact("Respawn tokens", String(m.player.respawnTokens)) : null,
        ),
        h(
          "div",
          { class: "row-actions" },
          h("button", { type: "button", class: "btn", onclick: () => act.showEntities("death") }, "Show lost astroneers"),
          h("button", { type: "button", class: "btn", onclick: () => act.showEntities("backpack") }, "Show lost backpacks"),
        ),
      ),
      section(
        "What you're carrying",
        m.player.inventory.length
          ? h("ul", { class: "inventory" }, ...m.player.inventory.map((i) => h("li", {}, h("span", {}, i.name), h("span", { class: "count" }, `×${i.count}`))))
          : h("p", { class: "muted" }, "The save has no items attached to your astroneer."),
        m.player.dataLogs.length
          ? h("p", { class: "muted small" }, `${m.player.dataLogs.length} data ${m.player.dataLogs.length === 1 ? "log" : "logs"} read so far`)
          : null,
      ),
      section(
        "Game settings",
        h("dl", { class: "facts wide" }, ...m.settings.map((s) => fact(s.label, s.value))),
        m.creative.some((c) => c.on && c.label === "Mode Active")
          ? h("dl", { class: "facts wide" }, ...m.creative.map((c) => fact(c.label, c.on ? "on" : "off", c.on ? "good" : "muted")))
          : null,
      ),
      h(
        "details",
        { class: "branch advanced" },
        h("summary", {}, "Advanced"),
        h(
          "dl",
          { class: "facts wide" },
          fact("File", m.fileName),
          fact("Saved", fmtDate(m.savedAt)),
          fact("Game version", `Unreal ${m.header.engine}, save v${m.header.saveGameVersion}`),
          fact("Objects in save", fmtInt(m.stats.objects)),
          fact("Read in", `${Math.round(m.stats.parseMs)} ms`),
          fact("Unreadable values", fmtInt(m.stats.decodeErrors), m.stats.decodeErrors ? "warn" : "good"),
        ),
        h("button", { type: "button", class: "btn", onclick: () => act.openRawData() }, "Browse every object in the save"),
      ),
    ),
  );
}
function section(title: string, ...body: (Node | null)[]): HTMLElement {
  return h("section", { class: "j-section" }, h("h3", { class: "section-title" }, title), ...body);
}
function fact(label: string, value: string, tone?: string): HTMLElement {
  return h("div", { class: `fact${tone ? ` tone-${tone}` : ""}` }, h("dt", {}, label), h("dd", {}, value));
}
function worlds(m: WorldModel, act: Actions): HTMLElement {
  return h(
    "ul",
    { class: "worlds" },
    ...m.planets.map((p) => {
      const meta = PLANETS[p.id];
      const yours = (["base", "beacon", "vehicle", "death"] as CategoryId[])
        .filter((c) => p.counts[c])
        .map((c) => `${fmtInt(p.counts[c]!)} ${CATEGORY[c].label.toLowerCase()}`)
        .filter(() => p.visited);
      const status = m.player.entity?.planet === p.id ? "You are here" : p.visited ? "Visited" : "Not visited yet";
      const gate = p.gate
        ? p.gate.engineActivated
          ? "Gateway engine active"
          : p.gate.chambersActivated
            ? `${p.gate.chambersActivated} gateway chambers active`
            : "Gateway dormant"
        : "";
      return h(
        "li",
        {},
        h(
          "button",
          { type: "button", class: "world", onclick: () => act.goToPlanet(p.id) },
          planetOrb(meta.colors, 40),
          h(
            "span",
            { class: "world-text" },
            h("span", { class: "world-name" }, p.name, h("span", { class: `badge ${status === "Not visited yet" ? "muted" : ""}` }, status)),
            h("span", { class: "muted" }, meta.tagline),
            h("span", { class: "small" }, [yours.join(", "), gate].filter(Boolean).join(". ") || "Nothing of yours here yet"),
          ),
        ),
      );
    }),
  );
}
function missions(active: Mission[], done: Mission[]): HTMLElement {
  const wrap = h("div", { class: "missions" });
  if (active.length) {
    wrap.append(
      h("h4", {}, "In progress"),
      h(
        "ul",
        { class: "mission-list" },
        ...active.map((mi) =>
          h(
            "li",
            {},
            h(
              "span",
              { class: "mission-title" },
              mi.objectives[0] && mi.objectives[0].type !== "Custom" ? mi.objectives[0].label : mi.title,
              h("span", { class: "muted small" }, mi.title),
            ),
            ...mi.objectives.map((o) => {
              const pct = o.goal > 0 ? Math.min(100, (o.progress / o.goal) * 100) : 0;
              return h(
                "div",
                { class: "objective" },
                h("span", { class: "small" }, o.type === "Custom" ? "Special objective" : o.label),
                h(
                  "span",
                  { class: "bar", role: "progressbar", "aria-valuenow": String(o.progress), "aria-valuemax": String(o.goal), "aria-label": o.label },
                  h("span", { style: `width:${pct}%` }),
                ),
                h("span", { class: "small count" }, `${fmtInt(o.progress)} / ${fmtInt(o.goal)}`),
              );
            }),
          ),
        ),
      ),
    );
  }
  const timed = done.filter((d) => d.completed).sort((a, b) => a.completed! - b.completed!);
  if (timed.length >= 2) wrap.append(h("h4", {}, "Missions completed over time"), timeline(timed));
  if (done.length) {
    wrap.append(
      h(
        "details",
        { class: "branch" },
        h("summary", {}, `All ${done.length} completed missions`),
        h(
          "table",
          { class: "table" },
          h("thead", {}, h("tr", {}, h("th", {}, "Mission"), h("th", {}, "Completed"))),
          h(
            "tbody",
            {},
            ...[...done]
              .sort((a, b) => (b.completed ?? 0) - (a.completed ?? 0))
              .map((d) => h("tr", {}, h("td", {}, d.title), h("td", {}, fmtDate(d.completed)))),
          ),
        ),
      ),
    );
  }
  return wrap;
}
function timeline(list: Mission[]): HTMLElement {
  const W = 560,
    H = 170,
    L = 34,
    Rr = 12,
    T = 14,
    B = 26;
  const t0 = list[0].completed!;
  const t1 = list[list.length - 1].completed!;
  const span = Math.max(1, t1 - t0);
  const x = (t: number) => L + ((t - t0) / span) * (W - L - Rr);
  const y = (n: number) => T + (1 - n / list.length) * (H - T - B);
  let d = `M${x(t0)},${y(0)}`;
  list.forEach((mi, i) => {
    d += ` H${x(mi.completed!)} V${y(i + 1)}`;
  });
  const area = `${d} V${y(0)} Z`;
  const fmtDay = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const chart = svg(`
    <svg viewBox="0 0 ${W} ${H}" class="timeline" role="img" aria-label="${list.length} missions completed between ${fmtDay(t0)} and ${fmtDay(t1)}">
      <line x1="${L}" x2="${W - Rr}" y1="${y(0)}" y2="${y(0)}" class="axis"/>
      <line x1="${L}" x2="${W - Rr}" y1="${y(list.length)}" y2="${y(list.length)}" class="grid"/>
      <text x="${L - 6}" y="${y(list.length) + 4}" text-anchor="end" class="tick">${list.length}</text>
      <text x="${L - 6}" y="${y(0) + 4}" text-anchor="end" class="tick">0</text>
      <text x="${L}" y="${H - 6}" class="tick">${fmtDay(t0)}</text>
      <text x="${W - Rr}" y="${H - 6}" text-anchor="end" class="tick">${fmtDay(t1)}</text>
      <path d="${area}" class="area"/>
      <path d="${d}" class="line"/>
      <line class="cross" y1="${T}" y2="${y(0)}" x1="0" x2="0" visibility="hidden"/>
      <circle class="dot" r="5" visibility="hidden"/>
    </svg>`);
  const tip = h("div", { class: "chart-tip", hidden: true });
  const box = h("div", { class: "chart" }, chart, tip);
  const cross = chart.querySelector(".cross")!;
  const dot = chart.querySelector(".dot")!;
  chart.addEventListener("pointermove", (ev) => {
    const rect = chart.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    let best = 0;
    list.forEach((mi, i) => {
      if (Math.abs(x(mi.completed!) - px) < Math.abs(x(list[best].completed!) - px)) best = i;
    });
    const mi = list[best];
    const cx = x(mi.completed!),
      cy = y(best + 1);
    cross.setAttribute("x1", String(cx));
    cross.setAttribute("x2", String(cx));
    cross.setAttribute("visibility", "visible");
    dot.setAttribute("cx", String(cx));
    dot.setAttribute("cy", String(cy));
    dot.setAttribute("visibility", "visible");
    tip.replaceChildren(h("strong", {}, `${best + 1} completed`), h("span", {}, mi.title), h("span", { class: "muted" }, fmtDate(mi.completed)));
    tip.hidden = false;
    const left = (cx / W) * rect.width;
    tip.style.left = `${Math.min(rect.width - 180, Math.max(0, left - 90))}px`;
  });
  chart.addEventListener("pointerleave", () => {
    tip.hidden = true;
    cross.setAttribute("visibility", "hidden");
    dot.setAttribute("visibility", "hidden");
  });
  return box;
}
