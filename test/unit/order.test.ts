// The order of work of the lines of a research (core/order.ts): by their place, a research of an older strom by
// priority and age; the order wanted with lines left out and IDs no line has; one line moved.

import { test } from "node:test";
import assert from "node:assert/strict";
import { arranged, moved, orderMode, orderNumbers, workOrder } from "../../src/core/order.ts";
import type { Research } from "../../src/core/model.ts";

const line = (id: string, more: Partial<Research> = {}): Research =>
  ({ id, type: "research", name: id, direction: "ancestors", focus: "P0001", state: "active", priority: 3, notes: [], created: "2026-01-01T00:00:00.000Z", updated: "2026-01-01T00:00:00.000Z", ...more }) as Research;

test("the order of work: by place; without one (an older strom) by priority, then the older first; placed before unplaced", () => {
  const old = [line("G0001", { priority: 2 }), line("G0002", { priority: 5 }), line("G0003", { priority: 2, created: "2025-12-01T00:00:00.000Z" })];
  assert.deepEqual(workOrder(old).map((r) => r.id), ["G0002", "G0003", "G0001"]);
  const placed = [line("G0001", { order: 2 }), line("G0002", { order: 1 }), line("G0003", { order: 3, state: "paused" })];
  assert.deepEqual(workOrder(placed).map((r) => r.id), ["G0002", "G0001", "G0003"], "a paused line keeps its place");
  const mixed = [line("G0004", { priority: 5 }), line("G0001", { order: 2 }), line("G0002", { order: 1 })];
  assert.deepEqual(workOrder(mixed).map((r) => r.id), ["G0002", "G0001", "G0004"]);
  assert.deepEqual([...orderNumbers(mixed)], [["G0002", 1], ["G0001", 2], ["G0004", 3]]);
  assert.deepEqual([orderMode("balanced"), orderMode("depth"), orderMode("priority")], ["weight", "weight", "strict"]);
});

test("the order wanted: those named first, the rest after them as they were; unknown IDs ignored, a repeated one once", () => {
  const lines = [line("G0001", { order: 1 }), line("G0002", { order: 2 }), line("G0003", { order: 3 }), line("G0004", { order: 4 })];
  const r = arranged(lines, ["g0003", "G0009", "G0001", "G0003", "Лгота"]);
  assert.deepEqual(r.lines.map((x) => x.id), ["G0003", "G0001", "G0002", "G0004"]);
  assert.deepEqual(r.ignored, ["G0009", "Лгота"]);
  assert.deepEqual(arranged(lines, []).lines.map((x) => x.id), ["G0001", "G0002", "G0003", "G0004"]);
});

test("one line moved: up, down, first, to a place (kept within the list); the first up and the last down stay", () => {
  const lines = [line("G0001", { order: 1 }), line("G0002", { order: 2 }), line("G0003", { order: 3 })];
  assert.deepEqual(moved(lines, "G0003", { up: true }), ["G0001", "G0003", "G0002"]);
  assert.deepEqual(moved(lines, "G0001", { down: true }), ["G0002", "G0001", "G0003"]);
  assert.deepEqual(moved(lines, "G0003", { first: true }), ["G0003", "G0001", "G0002"]);
  assert.deepEqual(moved(lines, "G0001", { to: 2 }), ["G0002", "G0001", "G0003"]);
  assert.deepEqual(moved(lines, "G0001", { to: 99 }), ["G0002", "G0003", "G0001"]);
  assert.deepEqual(moved(lines, "G0001", { up: true }), ["G0001", "G0002", "G0003"]);
  assert.deepEqual(moved(lines, "G0003", { down: true }), ["G0001", "G0002", "G0003"]);
});
