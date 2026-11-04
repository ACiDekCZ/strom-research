// A task parked until a date is offered again on that day itself — as `strom task park --until` says.

import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveState } from "../../src/core/queue.ts";
import type { Task } from "../../src/core/model.ts";

const parked = { id: "T0001", state: "parked", parkedUntil: "2027-01-15" } as unknown as Task;

test("park --until: still parked the day before, open on the day and after", () => {
  assert.equal(effectiveState(parked, "2027-01-14"), "parked");
  assert.equal(effectiveState(parked, "2027-01-15"), "open");
  assert.equal(effectiveState(parked, "2027-01-16"), "open");
  assert.equal(effectiveState({ ...parked, parkedUntil: undefined } as Task, "2099-01-01"), "parked");
});

test("park --until: the option says the day itself is included", async () => {
  await import("../../src/commands/index.ts");
  const { match } = await import("../../src/cli/registry.ts");
  const until = match(["task", "park"])?.def.options?.find((o) => o.name === "until");
  assert.match(String(until?.description), /from this date on/);
});
