import test from "node:test";
import assert from "node:assert/strict";
import { HOP_CARD_SNAPSHOT, cardModel, hopUrl } from "./hop-card.js";

test("snapshot is three real steps and writes nothing", () => {
  assert.equal(HOP_CARD_SNAPSHOT.steps.length, 3);
  assert.equal(HOP_CARD_SNAPSHOT.writes_heads, false);
  assert.equal(HOP_CARD_SNAPSHOT.live, false);
  assert.match(HOP_CARD_SNAPSHOT.steps[0].stone, /^0b9b8b4e/);
  assert.match(HOP_CARD_SNAPSHOT.steps[1].stone, /^9c858614/);
  assert.equal(HOP_CARD_SNAPSHOT.steps[1].thread_id, "thread:hop-card-skill-20261006");
});

test("carousel centers on now", () => {
  const model = cardModel();
  assert.equal(model.step.id, "now");
  assert.equal(model.before.id, "before");
  assert.equal(model.after.id, "after");
});

test("prefill stays off unless asked", () => {
  const hop = HOP_CARD_SNAPSHOT.hops[1];
  assert.equal(hopUrl(hop, "thread:hop-card-skill-20261006", false), "https://claude.ai/code/new");
  assert.match(hopUrl(hop, "thread:hop-card-skill-20261006", true), /q=thread%3Ahop-card-skill-20261006/);
});
