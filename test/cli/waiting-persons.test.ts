// Every person a waiting task is about, for the Strom app's badge and count on each (spec 150 U1, K2.1, K2.4): the
// bridge's What waits items carry `persons` [P…] of the task's subject besides `person` (the one, when it is one) —
// a person taken back left out, none no field; feature waiting.persons. Nothing else of the research changes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { fixedClock } from "../fixed-clock.ts";
import { Tree } from "../../src/core/tree.ts";
import { waitingFor } from "../../src/core/waiting.ts";
import { get } from "./sync.helpers.ts";

const opts = { skip: !hasGit };
const bridged = { skip: !hasGit || process.platform === "win32" };

/** Ondřej Lhoták (P1), his wife Marie (P2), his father Vojtěch (P3); T1 about P1 and P2, T2 about P1, T3 about none, T4 about P3. */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "Předci Lhotáka", "--new-person", "Ondřej /Lhoták/", "--sex", "M", "--born", "1902"]);
  await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]);
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]);
  const add = (what: string, about: string[]) => w.ok(["task", "add", what, "--level", "request", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "odpověď", ...about.flatMap((a) => ["--about", a]), "--anyway"]);
  await add("Opis sňatku Ondřeje a Marie", ["P1", "P2"]);
  await add("Opis křtu Ondřeje", ["P1"]);
  await add("Vzpomínky rodiny na Lhotu", []);
  await add("Opis křtu Vojtěcha", ["P3"]);
  for (const id of ["T1", "T2", "T3", "T4"]) await w.ok(["task", "wait", id, "--on", "Odpověď matriky v Lhotě.", "--kind", "letter", "--to", "Matriční úřad Lhota"]);
  return w;
}

const persons = (w: World) => Object.fromEntries(waitingFor(Tree.open(w.cwd, w.env)).filter((i) => i.task).map((i) => [i.task!.id, [(i.item as { person?: string }).person, (i.item as { persons?: string[] }).persons]]));

test("What waits: each task's people in persons, besides the one person; none, no field; a person taken back left out", opts, async () => {
  const clock = fixedClock(new Date(2026, 10, 27, 12, 0, 0).getTime());
  const w = await world();
  try {
    assert.deepEqual(persons(w), {
      T0001: [undefined, ["P0001", "P0002"]],
      T0002: ["P0001", ["P0001"]],
      T0003: [undefined, undefined],
      T0004: ["P0003", ["P0003"]],
    });
    await w.ok(["person", "retract", "P3", "--reason", "zapsán omylem"]);
    assert.deepEqual(persons(w).T0004?.[1], undefined, "taken back: not among them");
  } finally {
    clock.stop();
    w.cleanup();
  }
});

test("the bridge: /status waiting items carry persons, feature waiting.persons", bridged, async () => {
  const clock = fixedClock(new Date(2026, 10, 27, 12, 0, 0).getTime());
  const w = await world();
  Object.assign(w.env, clock.env);
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = JSON.parse((await get(`${info.url}/status?poll=1`)).body);
    assert.ok(status.features.includes("waiting.persons"));
    const items = status.waiting as { id: string; person?: string; persons?: string[] }[];
    assert.deepEqual(items.filter((i) => /^T/u.test(i.id)).map((i) => [i.id, i.person, i.persons]).sort(), [
      ["T0001", undefined, ["P0001", "P0002"]],
      ["T0002", "P0001", ["P0001"]],
      ["T0003", undefined, undefined],
      ["T0004", "P0003", ["P0003"]],
    ]);
  } finally {
    await w.ok(["live", "stop"]);
    clock.stop();
    w.cleanup();
  }
});
