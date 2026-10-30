import { test } from "node:test";
import assert from "node:assert/strict";
import { MODELS, modelSize } from "../src/scene/models.ts";
void test("every miniature has geometry, colours and a size", () => {
  for (const [name, def] of Object.entries(MODELS)) {
    const pos = def.geometry.getAttribute("position");
    assert.ok(pos && pos.count > 0, `${name} has vertices`);
    assert.ok(def.geometry.getAttribute("color"), `${name} has vertex colours`);
    assert.ok(def.geometry.boundingSphere, `${name} has a bounding sphere`);
    assert.ok(modelSize(def) > 0 && modelSize(def) < 40, `${name} size is sane (${modelSize(def)} m)`);
    if (def.glow) assert.ok(def.glow.getAttribute("color"), `${name} glow has colours`);
    let minY = Infinity;
    for (let i = 0; i < pos.count; i++) minY = Math.min(minY, pos.getY(i));
    assert.ok(minY > -0.6, `${name} sits on the ground (min y ${minY.toFixed(2)})`);
  }
});
