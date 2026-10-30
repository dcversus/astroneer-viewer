import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { inflate, parseContainer } from "../src/save/container.ts";
import { buildWorld } from "../src/model/extract.ts";
import { MODELS, appearanceFor } from "../src/scene/models.ts";
const file = process.env.ASTRO_SAVE ?? "public/sample.savegame";
void test("decodes the whole save without property errors", { skip: !existsSync(file) && `no save at ${file}` }, async () => {
  const raw = parseContainer(await inflate(new Uint8Array(readFileSync(file))));
  assert.equal(raw.header.saveClass, "AstroSave");
  assert.ok(raw.level.objects.length > 0);
  const world = buildWorld(raw, "test.savegame", 0);
  const model = world.model;
  assert.equal(model.stats.decodeErrors, 0);
  assert.equal(model.planets.filter((p) => p.id !== "Space").length, 7);
  for (const p of model.planets) assert.ok(p.radius > 0, `${p.name} has a radius`);
  assert.ok(model.entities.every((e) => Number.isFinite(e.dist) && Number.isFinite(e.alt)));
  assert.ok(model.player.entity, "player position found");
  assert.ok(model.missions.length > 0);
  const start = model.entities.find((e) => e.cat === "start");
  assert.ok(start, "starting point found");
  assert.ok(world.details(start.id).some((n) => n.label === "Properties"));
  for (const e of model.entities) {
    const a = appearanceFor(e);
    assert.ok(MODELS[a.model], `${e.cls} -> ${a.model}`);
  }
  const catalog = world.catalog();
  const expected = raw.level.objects.length + raw.remotePlayers.reduce((a, p) => a + p.chunk.objects.length, 0);
  assert.equal(
    catalog.reduce((a, c) => a + c.count, 0),
    expected,
  );
  for (const c of catalog) {
    const rows = world.objects(c.chunk, c.type);
    assert.equal(rows.length, c.count, c.type);
    assert.ok(
      world.object(c.chunk, rows[0].index).some((n) => n.label === "Properties"),
      c.type,
    );
  }
});
