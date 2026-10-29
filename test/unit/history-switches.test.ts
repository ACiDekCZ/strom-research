// The two switches of the history (spec 020 K8): the regions' (experiments.history) and the places'
// (experiments.placeHistory) — a tree's own value wins both ways; a layer whose places have no switch of their own
// follows its experiments.history, so what an older strom wrote holds as it did (K8.7).

import { test } from "node:test";
import assert from "node:assert/strict";
import { historySwitches, type UserConfig } from "../../src/core/config.ts";
import type { TreeConfig } from "../../src/core/model.ts";

const user = (c: Partial<UserConfig>) => c as UserConfig;
const tree = (c: Partial<TreeConfig>) => c as TreeConfig;

test("history switches: unset is off; the history on before the two were apart means both, off both (K8.7)", () => {
  assert.deepEqual(historySwitches(user({}), undefined), { regions: false, places: false });
  assert.deepEqual(historySwitches(user({ experimentsHistory: "on" }), undefined), { regions: true, places: true });
  assert.deepEqual(historySwitches(user({ experimentsHistory: "on" }), tree({})), { regions: true, places: true });
  assert.deepEqual(historySwitches(user({ experimentsHistory: "on" }), tree({ experimentsHistory: "off" })), { regions: false, places: false }, "a tree's old off: both");
  assert.deepEqual(historySwitches(user({ experimentsHistory: "off" }), tree({ experimentsHistory: "on" })), { regions: true, places: true });
});

test("history switches: each its own — the places' switch apart from the regions' in a layer; a tree's own wins both ways", () => {
  assert.deepEqual(historySwitches(user({ experimentsHistory: "on", experimentsPlaceHistory: "off" }), undefined), { regions: true, places: false });
  assert.deepEqual(historySwitches(user({ experimentsPlaceHistory: "on" }), undefined), { regions: false, places: true });
  const on = user({ experimentsHistory: "on" });
  assert.deepEqual(historySwitches(on, tree({ experimentsPlaceHistory: "off" })), { regions: true, places: false });
  assert.deepEqual(historySwitches(on, tree({ experimentsHistory: "off", experimentsPlaceHistory: "on" })), { regions: false, places: true });
  // the tree on while this computer's is off
  assert.deepEqual(historySwitches(user({ experimentsHistory: "off" }), tree({ experimentsPlaceHistory: "on" })), { regions: false, places: true });
  // the tree's regions set, its places unset: they follow the tree's regions, not the user's places
  assert.deepEqual(historySwitches(user({ experimentsHistory: "on", experimentsPlaceHistory: "on" }), tree({ experimentsHistory: "off" })), { regions: false, places: false });
});
