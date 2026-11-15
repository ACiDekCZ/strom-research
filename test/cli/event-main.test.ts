// The main citation of a fact chosen at the person's terminal (spec 095 P2, K2.1–K2.3): `strom event main` marks it as
// the user's, `--clear` takes the mark off; person/family/event show give the order with the main one marked, --json
// too; no agent chooses, changes or cancels it — refused with what to tell the user; the history says it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { changeLines } from "../../src/core/changelog.ts";
import type { Event, Family, Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const open = (w: World) => Tree.open(w.cwd, w.env);
const birth = (w: World): Event => open(w).get<Person>("P0001")!.events.find((e) => e.kind === "BIRT")!;
const mains = (e: Event) => e.citations.filter((c) => c.main).map((c) => `${c.source} ${c.locator ?? ""}`.trim());
const person = { tty: true };

/**
 * Lhotákovi: Prokop's birth cited by his death entry (S0001, fol. 3), his baptism (S0002, fol. 7 and, as a second
 * entry of the same register, fol. 8); Prokop and Anežka's marriage cited by the banns and the marriage register.
 */
async function research(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["source", "add", "Úmrtí Prokopa Lhotáka", "--kind", "death", "--date", "12 MAR 1911"]); // S0001
  await w.ok(["source", "add", "Křest Prokopa Lhotáka", "--kind", "baptism", "--date", "3 FEB 1850"]); // S0002
  await w.ok(["source", "add", "Oddací matrika Lhota", "--kind", "marriage", "--date", "1875"]); // S0003
  await w.ok(["person", "add", "Prokop /Lhoták/", "--sex", "M"]); // P0001
  await w.ok(["person", "add", "Anežka /Lhotová/", "--sex", "F"]); // P0002
  await w.ok(["event", "add", "P0001", "BIRT", "--date", "1 FEB 1850", "--place", "Lhota", "--cite", "S0001", "--locator", "fol. 3"]); // E0001
  await w.ok(["cite", "E0001", "S0002", "--locator", "fol. 7"]);
  await w.ok(["family", "add", "--partner", "P0001", "--partner", "P0002", "--married", "1875", "--cite", "S0003", "--locator", "fol. 2"]);
  return w;
}

test("strom event main: chosen, changed and cancelled by the person; shown first everywhere, --json too; nothing to change writes nothing", opts, async () => {
  const w = await research();
  try {
    // the research's order: the baptism first
    const before = (await w.ok(["--json", "show", "E0001"])).json;
    assert.deepEqual(before.citationOrder, [{ source: "S0002", locator: "fol. 7" }, { source: "S0001", locator: "fol. 3" }]);
    // chosen: the death entry first after all, marked as the user's with the time
    const set = await w.ok(["event", "main", "E0001", "S0001"], person);
    assert.match(set.out, /^hlavní záznam údaje zvolen: E0001 /u, set.out);
    assert.match(set.out, /S0001 fol\. 3 \(hlavní, volba uživatele\), S0002/u, set.out);
    const marked = birth(w).citations.find((c) => c.main)!;
    assert.equal(marked.source, "S0001");
    assert.equal(marked.main!.by, "user");
    assert.ok(Date.parse(marked.main!.at) > 0);
    assert.deepEqual(birth(w).citations.map((c) => c.source), ["S0001", "S0002"], "the stored order left as it is");
    // shown first: person show, event show, --json of both
    assert.match((await w.ok(["person", "show", "P0001"])).out, /S0001 fol\. 3 \(main, the user's\), S0002/u);
    const card = (await w.ok(["--json", "person", "show", "P0001"])).json;
    assert.deepEqual(card.citationOrder.E0001, [{ source: "S0001", locator: "fol. 3", main: true }, { source: "S0002", locator: "fol. 7" }]);
    assert.deepEqual((await w.ok(["--json", "show", "E0001"])).json.citationOrder[0], { source: "S0001", locator: "fol. 3", main: true });
    // the file the app reads it from (behind its gate, open here) and the one for other programs give it first
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    const app = exportGedcom(open(w), { for: "strom", head, mainCitations: true }).text;
    assert.match(app, /^2 SOUR @S0001@\r?\n(?:[3-9] .*\r?\n)*3 _STROM_MAIN Y$/mu);
    assert.doesNotMatch(exportGedcom(open(w), { for: "strom", head }).text, /_STROM_MAIN/u, "an app before the gate is never given it");
    const standard = exportGedcom(open(w), { for: "standard" }).text;
    assert.ok(standard.indexOf("2 SOUR @S0001@") < standard.indexOf("2 SOUR @S0002@"), "first for other programs too");
    // the same again: nothing written
    const commits = execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    const same = await w.ok(["event", "main", "E0001", "S0001"], person);
    assert.match(same.out, /^není co měnit: /u, same.out);
    assert.equal(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim(), commits);
    // changed: one main citation only
    await w.ok(["event", "main", "E0001", "S0002"], person);
    assert.deepEqual(mains(birth(w)), ["S0002 fol. 7"]);
    // put back as it was
    await w.ok(["event", "main", "E0001", "S0001", "--locator", "fol. 3"], person);
    assert.deepEqual(mains(birth(w)), ["S0001 fol. 3"]);
    // cancelled: the research's order again
    const off = await w.ok(["event", "main", "E0001", "--clear"], person);
    assert.match(off.out, /^údaj bez hlavního záznamu \(pořadí výzkumu\): /u, off.out);
    assert.deepEqual(mains(birth(w)), []);
    assert.deepEqual((await w.ok(["--json", "show", "E0001"])).json.citationOrder.map((c: { source: string }) => c.source), ["S0002", "S0001"]);
    // a family's fact: family show --json gives the order too
    const fam = open(w).get<Family>("F0001")!;
    const marr = fam.events.find((e) => e.kind === "MARR")!;
    await w.ok(["event", "main", marr.id, "S0003"], person);
    assert.deepEqual((await w.ok(["--json", "family", "show", "F0001"])).json.citationOrder[marr.id], [{ source: "S0003", locator: "fol. 2", main: true }]);
    // the history in the research's language: chosen, cancelled
    const tree = open(w);
    const said = changeLines(tree, tree.readOps().filter((o) => o.op === "event.main" && o.targets?.includes("E0001")), "", tree.lang).map((l) => l.text);
    assert.ok(said.length >= 2, JSON.stringify(said));
    assert.match(said[0]!, /^Zvolen hlavní doklad údaje: Prokop Lhoták/u);
    assert.match(said.at(-1)!, /^Údaj bez hlavního dokladu: Prokop Lhoták/u, JSON.stringify(said));
    const ops = tree.readOps().filter((o) => o.op === "event.main");
    assert.ok(ops.every((o) => o.by === "user"), JSON.stringify(ops.map((o) => o.by)));
  } finally {
    w.cleanup();
  }
});

test("strom event main: a source the fact does not cite, a place not given among several, a source and --clear together — refused with what to run", opts, async () => {
  const w = await research();
  try {
    await w.ok(["cite", "E0001", "S0002", "--locator", "fol. 8"]);
    const none = await w.run(["event", "main", "E0001", "S0003"], person);
    assert.notEqual(none.code, 0);
    assert.match(none.out + none.err, /E0001 does not cite S0003[^]*strom cite E0001 S0003/u, none.out + none.err);
    const which = await w.run(["event", "main", "E0001", "S0002"], person);
    assert.notEqual(which.code, 0);
    assert.match(which.out + which.err, /--locator/u);
    await w.ok(["event", "main", "E0001", "S0002", "--locator", "fol. 8"], person);
    assert.deepEqual(mains(birth(w)), ["S0002 fol. 8"]);
    assert.notEqual((await w.run(["event", "main", "E0001", "S0002", "--clear"], person)).code, 0);
    assert.notEqual((await w.run(["event", "main", "E0001"], person)).code, 0);
  } finally {
    w.cleanup();
  }
});

test("K2.3: no agent chooses, changes or cancels the main citation — refused before anything is written, with what to tell the user", opts, async () => {
  const w = await research();
  try {
    await w.ok(["event", "main", "E0001", "S0001"], person);
    const marked = birth(w).citations.find((c) => c.main)!.main;
    for (const env of [{ CLAUDECODE: "1" }, { CODEX_THREAD_ID: "019a-test" }] as Record<string, string>[])
      for (const args of [["event", "main", "E0001", "S0002"], ["event", "main", "E0001", "--clear"]]) {
        const r = await w.run(["--json", ...args], { env });
        assert.equal(r.code, 4, `${JSON.stringify(env)} ${args.join(" ")}: ${r.out}${r.err}`);
        assert.match(r.json.needs[0].question, /main citation of a fact is the user's choice.*\(an agent cannot answer this\)/u, r.out);
      }
    // nor a strom nobody sits at (a script, a session's run): not the person
    const script = await w.run(["--json", "event", "main", "E0001", "S0002"]);
    assert.notEqual(script.code, 0);
    assert.equal(script.json.code, "main.person", script.out);
    assert.deepEqual(birth(w).citations.find((c) => c.main)!.main, marked, "the user's choice as it was");
    // on a fact the user chose nothing at, as well (spec 095 V3: only the user sets it)
    await w.ok(["event", "main", "E0001", "--clear"], person);
    assert.equal((await w.run(["--json", "event", "main", "E0001", "S0001"], { env: { CLAUDECODE: "1" } })).code, 4);
    assert.deepEqual(mains(birth(w)), []);
    // the catalog says it is the user's
    const catalog = (await w.ok(["commands", "--json"])).json;
    const all = (catalog.commands ?? catalog) as { command: string; userOnly?: boolean }[];
    assert.equal(all.find((c) => c.command === "event main")?.userOnly, true);
  } finally {
    w.cleanup();
  }
});
