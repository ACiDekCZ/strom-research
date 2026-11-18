// What the Strom app was given (_STROM_HEAD) holds only what the research gave it — no change is said that the user did
// not make (found with the app's 3.30.0-beta.3: "written 0, not written 11" after a photo alone):
// - a family of one parent with brothers and sisters comes from an app before 3.30.0-beta.4 with a bare `1 MARR`
//   carrying the family's citations: they are the family's own, as the app's JSON has them — no cite.notCarried;
// - a source of a sync ("edits in the Strom app") is never given to the app: a base rebuilt from the history (the
//   research went on since) leaves it out as the export did — no cite.sourceRemoved.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { create, update } from "../../src/core/records.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { applySync, planSync, readGedcom, type Snapshot, type SyncInput } from "../../src/core/sync.ts";
import type { Family, Person, Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

const open = (w: World) => Tree.open(w.cwd, w.env);
const gitHead = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
const shown = (plan: { changes: { kind: string; action: string; code?: string; sourceId?: string }[] }) =>
  plan.changes.map((c) => [c.kind, c.action, c.code ?? "", c.sourceId ?? ""].filter(Boolean).join(" "));

/** What the research gives the Strom app (one that reads the main citation), as the app sends it back. */
const appFile = (w: World) => exportGedcom(open(w), { for: "strom", head: gitHead(w), mainCitations: true }).text.replace("1 SOUR STROM_RESEARCH", "1 SOUR STROM");

const records = (t: string) => t.split(/(?=^0 )/mu);
/** The file with one record changed. */
const inRecord = (t: string, start: RegExp, fn: (r: string) => string) => records(t).map((r) => (start.test(r) ? fn(r) : r)).join("");

/** A sync written straight, with its input and the day's source as `strom sync` makes them, committed. */
function apply(w: World, incoming: Snapshot) {
  const tree = open(w);
  tree.personWrites = true;
  return tree.withTreeLock(() => {
    const plan = planSync(tree, incoming, "conflict", { readsMain: true, sendsUncite: true });
    const made = create<SyncInput>(tree, "input", { name: "app.ged", sha: "0", size: 1, mime: "text/plain", from: "app.ged", kind: "tree", state: "processed" } as never, (i) => `+${i} input tree "app.ged" (sync)`);
    const source = create<Source>(tree, "source", { kind: "family-tree", title: "Strom", input: made.id, information: "secondary", form: "authored" } as never, (s) => `+${s} source "app.ged" (sync)`);
    const r = applySync(tree, plan, incoming, source, undefined, { decidePerson: false, input: made.id });
    update<SyncInput>(tree, made.id, "input", (i) => ({ ...i, source: source.id, sync: { ...(incoming.head ? { head: incoming.head } : {}), edits: "conflict", applied: r.applied } }), { op: "input.sync", summary: `${made.id} synced` });
    tree.commit(`sync ${made.id}`);
    return { plan, source: source.id, ...r };
  });
}

test("a family of one parent with two children whose citations come under a bare MARR (the app before 3.30.0-beta.4): the family's own, nothing said; a source new there is the family's", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    await w.ok(["source", "add", "Křest Václava Lhotáka", "--kind", "baptism", "--date", "3 FEB 1880"]); // S0001
    await w.ok(["source", "add", "Křest Anny Lhotákové", "--kind", "baptism", "--date", "9 MAY 1882"]); // S0002
    await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]); // P0001
    await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]); // P0002
    await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F"]); // P0003
    await w.ok(["family", "add", "--partner", "P0001", "--child", "P0002", "--child", "P0003"]); // F0001
    await w.ok(["cite", "F0001", "S0001", "--locator", "fol. 3"]);
    // married to somebody unknown, as the app's family of one parent with more children is (its bare MARR)
    const tree = open(w);
    tree.withTreeLock(() => {
      update<Family>(tree, "F0001", "family", (f) => ({ ...f, union: "married" }), { op: "family.edit", summary: "F0001 married" });
      tree.commit("F0001 married");
    });
    const given = appFile(w);
    assert.match(records(given).find((r) => r.startsWith("0 @F0001@ FAM"))!, /^1 SOUR @S0001@$/mu);
    // the app's way before 3.30.0-beta.4: the family's citations under a bare MARR (one parent, more children)
    const bare = (also: string) =>
      inRecord(given, /^0 @F0001@ FAM/u, (r) => {
        const cites = (r.match(/^1 SOUR [\s\S]*?(?=^1 |(?![\s\S]))/gmu) ?? []).join("") + also;
        const rest = r.replace(/^1 SOUR [\s\S]*?(?=^1 |(?![\s\S]))/gmu, "");
        return `${rest}1 MARR\n${cites.replace(/^(\d) /gmu, (_m, n: string) => `${Number(n) + 1} `)}`;
      });
    const sent = bare("");
    assert.match(sent, /^1 MARR\r?\n2 SOUR @S0001@$/mu);
    const incoming = readGedcom(sent);
    assert.deepEqual(incoming.families.find((f) => f.partners.length === 1)?.cites?.map((c) => c.source), ["S0001"]);
    assert.deepEqual(shown(planSync(open(w), incoming, "conflict", { readsMain: true, sendsUncite: true })), []);
    // a source the user cited there in the app: the family's citation, as the app's JSON gives it
    const added = bare("1 SOUR @S0002@\n2 PAGE fol. 9\n");
    assert.deepEqual(shown(planSync(open(w), readGedcom(added), "conflict", { readsMain: true, sendsUncite: true })), ["family.cite add"]);
    // a MARR that says something stays a marriage, its citations its own
    const married = inRecord(given, /^0 @F0001@ FAM/u, (r) => `${r}1 MARR\n2 DATE 1879\n2 SOUR @S0002@\n`);
    assert.deepEqual(readGedcom(married).families.find((f) => f.partners.length === 1)?.facts.map((f) => [f.kind, (f.cites ?? []).map((c) => c.source).join(" ")]), [["MARR", "S0002"]]);
  } finally {
    w.cleanup();
  }
});

test("a source of a sync is not what the app was given in a base rebuilt from the history: its citations are not said removed", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  try {
    await w.ok(["source", "add", "Křest Prokopa Lhotáka", "--kind", "baptism", "--date", "3 FEB 1850"]); // S0001
    await w.ok(["person", "add", "Prokop /Lhoták/", "--sex", "M"]); // P0001
    await w.ok(["event", "add", "P0001", "BIRT", "--date", "1 FEB 1850", "--place", "Lhota", "--cite", "S0001", "--locator", "fol. 7"]);
    // the user added where Prokop lived in the app: written, citing the sync's source
    const lived = inRecord(appFile(w), /^0 @P0001@ INDI/u, (r) => `${r}1 RESI\n2 PLAC Lhota 5\n`);
    const r = apply(w, readGedcom(lived));
    assert.ok(r.applied.length > 0, JSON.stringify(r.plan.changes));
    const resi = open(w).get<Person>("P0001")!.events.find((e) => e.kind === "RESI" && !e.retracted)!;
    assert.deepEqual(resi.citations.map((c) => c.source), [r.source]);
    // the app is given the research (no source of the sync), then the research goes on (a commit since)
    const given = appFile(w);
    assert.doesNotMatch(given, new RegExp(`@${r.source}@`, "u"));
    await w.ok(["source", "add", "Index narozených Lhota", "--kind", "index", "--date", "1900"]);
    // the app sends what it was given back (a photo added: nothing the research reads)
    const plan = planSync(open(w), readGedcom(given), "conflict", { readsMain: true, sendsUncite: true });
    assert.deepEqual(shown(plan), []);
  } finally {
    w.cleanup();
  }
});
