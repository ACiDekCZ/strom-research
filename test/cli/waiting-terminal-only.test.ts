// What waits only here in the terminal, apart from what the Strom app shows too: the menu's line says how many of the
// count the app does not show (an own edit's conflict, a send of the app, …) and how many wait for a reply, so what is
// left is the app's number (/status `waiting`, phase todo); What waits shows the terminal's own places first, under a
// heading of their own, the app's after them under theirs; the plan says the same split. Nothing of the bridge changes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { update } from "../../src/core/records.ts";
import { Settings } from "../../src/core/config.ts";
import { waitingFor, waitingSplit } from "../../src/core/waiting.ts";
import type { Conflict } from "../../src/core/model.ts";

const unix = { skip: !hasGit || process.platform === "win32" };

/**
 * A research in Czech where four things wait: a letter to do and the family to ask (the app shows them), a letter sent
 * (the app shows it, waiting for a reply), and a conflict of the user's own edit (only the terminal).
 */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Dvořákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Kryštof /Žďárský/", "--sex", "M", "--born", "1902"]); // P1
  const add = async (what: string, ...wait: string[]) => {
    const r = (await w.ok(["task", "add", what, "--level", "request", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "odpověď", "--about", "P1", "--anyway", "--json"])).json;
    const id = String(r.id ?? r.task?.id);
    await w.ok(["task", "wait", id, ...wait]);
    return id;
  };
  await add("Opis křtu Kryštofa", "--kind", "letter", "--to", "MěÚ Třeboň", "--on", "Odpověď matriky.");
  await add("Vzpomínky na Kryštofa", "--kind", "family", "--on", "Vzpomínky rodiny.");
  const sent = await add("Opis oddavek", "--kind", "letter", "--to", "SOA Třeboň", "--on", "Odpověď archivu.");
  await w.ok(["task", "sent", sent]);
  await w.ok(["conflict", "add", "Jméno Kryštofa", "--about", "P1", "--fact", "BIRT", "--claim", "výzkum: 1902", "--claim", "aplikace: 1903"]); // X1
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    // the user's own edit in the Strom app: decided by the person, in the terminal alone
    update<Conflict>(tree, "X0001", "conflict", (c) => ({ ...c, edit: { event: "E0001", date: "1903" } }), { op: "conflict.edit", summary: "X0001 the user's edit" });
    tree.commit("a conflict of the user's edit");
  });
  return w;
}

test("the menu: how many of what waits are only here in the terminal and wait for a reply — the rest is the app's number; What waits shows the terminal's own apart", unix, async () => {
  const w = await world();
  const shared = new Settings(w.env, {}).shared()?.value;
  const here = waitingFor(Tree.open(w.cwd, w.env), { shared, sends: true, milder: true, conflicts: true });
  assert.deepEqual(waitingSplit(here), { all: 4, here: 1, sent: 1, app: 2 });
  assert.deepEqual(here.filter((x) => x.terminalOnly).map((x) => x.item.kind), ["conflict"]);
  // the app's number: what /status gives with phase todo — the same as what the menu leaves for the app
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = (await fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } }).then((r) => r.json())) as { waiting: { id: string; kind: string; phase: string }[] };
    assert.equal(status.waiting.filter((i) => i.phase === "todo").length, waitingSplit(here).app);
    assert.ok(!status.waiting.some((i) => i.kind === "conflict"), "the app never gets the terminal's own");
    assert.deepEqual(
      status.waiting.map((i) => i.id),
      here.filter((x) => !x.terminalOnly).map((x) => x.item.id),
      "the app's items: those the menu shows as the app's",
    );
  } finally {
    await w.ok(["live", "stop"]);
  }

  // the menu, What waits (Enter: back), 0 quit
  const r = await w.ok([], { tty: true, answers: ["3", "", "0"] });
  assert.match(r.out, /^Čeká: 4 \(z toho 1 jen tady v terminálu, 1 čeká na odpověď\)$/mu);
  const screen = r.out.slice(r.out.search(/^Co čeká · /mu));
  assert.match(screen, /^Co čeká · k vyřízení 3 · čeká na odpověď 1\n/u);
  // the terminal's own first, under its heading; the app's after it, under theirs — the numbers go on
  assert.match(screen, /\n {2}Jen tady v terminálu \(v aplikaci Strom nejsou\) · 1\n 1 {2}K rozhodnutí – rozpory[^\n]*\n {2}I v aplikaci Strom · 2\n 2 {2}MěÚ Třeboň[^\n]*\n 3 {2}Rodina/u);
  // the plan: the same split
  assert.match((await w.ok(["plan"])).out, /^Čeká: 4 \(z toho 1 jen tady v terminálu, 1 čeká na odpověď\) · v menu: Co čeká$/mu);
  w.cleanup();
});

test("the menu: everything that waits the app shows too — the line says what waits for a reply, What waits as it was, no headings", unix, async () => {
  const w = await world();
  await w.ok(["conflict", "resolve", "X0001", "--resolution", "1902", "--reasoning", "zkouška"]);
  const r = await w.ok([], { tty: true, answers: ["3", "", "0"] });
  // nothing only here, one letter sent: said on its own, so 3 − 1 is the app's number
  assert.match(r.out, /^Čeká: 3 \(z toho 1 čeká na odpověď\)$/mu);
  const screen = r.out.slice(r.out.search(/^Co čeká · /mu));
  assert.doesNotMatch(screen, /Jen tady v terminálu|I v aplikaci Strom/u);
  assert.match(screen, /^ 1 {2}MěÚ Třeboň/mu);
  assert.match((await w.ok(["plan"])).out, /^Čeká: 3 \(z toho 1 čeká na odpověď\) · v menu: Co čeká$/mu);
  w.cleanup();
});
