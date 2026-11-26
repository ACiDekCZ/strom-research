// The tasks of the houses raised by themselves (spec 030 part 2, core/houses.ts): which are, which houses a task works
// on (its own and its neighbours), a municipality's skeleton task, and what is held while the history of the houses is
// off — never one at work, parked by the person, asked for, a takeover, nor one the person gave material to.

import { test } from "node:test";
import assert from "node:assert/strict";
import { houseAutoTask, houseHeld, houseOrigin, housesOfTask, houseWork, townOfTask, townOrigin } from "../../src/core/houses.ts";
import type { Task } from "../../src/core/model.ts";

const task = (over: Partial<Task>): Task =>
  ({ id: "T0001", type: "task", level: "enrich", priority: 1, subject: [], state: "open", what: "x", where: [], why: "x", doneWhen: "x", origin: houseOrigin("A0001"), created: "2026-01-01T00:00:00Z", updated: "2026-01-01T00:00:00Z", notes: [], ...over }) as Task;

test("the origins: a house's research, a municipality's skeleton, a takeover; the houses a task works on", () => {
  const house = task({ houses: ["A0002", "A0003"] });
  assert.equal(houseWork(house), "house");
  assert.deepEqual(housesOfTask(house), ["A0001", "A0002", "A0003"]);
  const town = task({ origin: townOrigin("L0002") });
  assert.equal(houseWork(town), "town");
  assert.equal(townOfTask(town), "L0002");
  assert.deepEqual(housesOfTask(town), []);
  const takeover = task({ origin: "house:import:A0004", houses: ["A0009"] });
  assert.deepEqual(housesOfTask(takeover), ["A0004"], "a takeover's own house alone");
  assert.equal(townOfTask(house), undefined);
});

test("raised by itself: a house's research and a municipality's skeleton not asked for; a takeover never", () => {
  assert.equal(houseAutoTask(task({})), true);
  assert.equal(houseAutoTask(task({ origin: townOrigin("L0001") })), true);
  assert.equal(houseAutoTask(task({ asked: "2026-11-26T08:00:00Z" })), false);
  assert.equal(houseAutoTask(task({ origin: "house:import:A0001" })), false);
  assert.equal(houseAutoTask(task({ origin: "census:1890" })), false);
});

test("held while off: open, waiting, parked until a day gone by — never at work, parked by the person, asked, with material; nothing while on", () => {
  const day = "2026-11-26";
  assert.equal(houseHeld(task({}), false, day), true);
  assert.equal(houseHeld(task({}), true, day), false, "on: nothing held");
  assert.equal(houseHeld(task({ state: "waiting" }), false, day), true);
  assert.equal(houseHeld(task({ state: "doing" }), false, day), false);
  assert.equal(houseHeld(task({ state: "parked" }), false, day), false, "parked by the person");
  assert.equal(houseHeld(task({ state: "parked", parkedUntil: "2026-11-01" }), false, day), true);
  assert.equal(houseHeld(task({ state: "parked", parkedUntil: "2026-12-24" }), false, day), false);
  assert.equal(houseHeld(task({ state: "done" }), false, day), false);
  assert.equal(houseHeld(task({ asked: "2026-11-20T10:00:00Z" }), false, day), false);
  assert.equal(houseHeld(task({ origin: "house:import:A0001" }), false, day), false);
  assert.equal(houseHeld(task({ files: [{}] } as unknown as Partial<Task>), false, day), false);
  assert.equal(houseHeld(task({}), false, day, () => true), false, "material given to its house");
  assert.equal(houseHeld(task({ origin: townOrigin("L0001") }), false, day), true);
});
