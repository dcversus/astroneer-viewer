import { readFileSync } from "node:fs";
import { inflate, parseContainer } from "../src/save/container.ts";
import { buildWorld } from "../src/model/extract.ts";
const f = process.argv[2];
const t = performance.now();
const raw = parseContainer(await inflate(new Uint8Array(readFileSync(f))));
const w = buildWorld(raw, f.split("/").pop()!, performance.now() - t);
const m = w.model;
console.log("parse+build ms", (performance.now() - t).toFixed(0), m.stats);
for (const p of m.planets) console.log(p.name, p.id, "r", p.radius.toFixed(0), "visited", p.visited, JSON.stringify(p.counts), p.gate, p.stormAge?.toFixed(0));
const byCat = new Map<string, Map<string, number>>();
for (const e of m.entities) {
  const c = byCat.get(e.cat) ?? new Map<string, number>();
  byCat.set(e.cat, c);
  c.set(e.name, (c.get(e.name) ?? 0) + 1);
}
for (const [c, names] of byCat)
  console.log(
    c.padEnd(9),
    [...names]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([n, k]) => `${n}×${k}`)
      .join(" | "),
  );
console.log(
  "research",
  { ...m.research, unlocked: m.research.unlocked.length, known: m.research.known.length, hacked: m.research.hacked.length },
  m.research.unlocked.slice(0, 12),
);
console.log("player", m.player.entity?.planet, m.player.entity?.alt.toFixed(0), m.player.inventory, m.player.dataLogs, m.player.respawnTokens);
console.log(
  "missions",
  m.missions.length,
  m.missions.filter((x) => !x.done).map((x) => x.title + " " + JSON.stringify(x.objectives)),
);
console.log(m.settings, m.creative, new Date(m.savedAt!).toISOString());
console.log("interesting", m.entities.filter((e) => e.interesting).length, [
  ...new Set(
    m.entities
      .map((e) => e.interesting)
      .filter(Boolean)
      .map((s) => s!.replace(/\d[\d,]* bytes/, "N bytes")),
  ),
]);
console.log("links", m.entities.filter((e) => e.link).length, JSON.stringify(m.entities.find((e) => e.cat === "start")));
console.log("json size", (JSON.stringify(m).length / 1e6).toFixed(2), "MB");
const d = w.details(m.entities.find((e) => e.cat === "vehicle")!.id);
console.log(JSON.stringify(d).slice(0, 800));
