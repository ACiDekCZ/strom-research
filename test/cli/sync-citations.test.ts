// A fact's citations and the Strom app (spec 095): the research gives them in one order (K1.1, K1.3 — the baptism of a
// birth before a later death entry), the user's main citation chosen or cancelled in the app comes with a send (K2.2,
// of an app that reads it: APP_READS_MAIN_CITATION, open here through planSync's readsMain) and no agent changes it
// (K2.3); a citation the user removed from a fact in the app is removed — only against what the app was given
// (_STROM_HEAD), only of an app whose file says it (APP_SENDS_UNCITE, planSync's sendsUncite) — and stays removed (K3.1–
// K3.3); what is not written is said with a stable code and its params (K3.4).

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { create, update } from "../../src/core/records.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { applySync, notWrittenList, planSync, readGedcom, type Snapshot, type SyncInput } from "../../src/core/sync.ts";
import { APP_DATA_MAIN_CITATION, APP_READS_MAIN_CITATION, APP_READS_MAIN_CITATION_BETA, APP_SENDS_UNCITE, appDataMainCitation, appReadsMainCitation, appSendsUncite } from "../../src/core/stromapp.ts";
import { BRIDGE_FEATURES, bridgeFeatures } from "../../src/core/live.ts";
import { Settings } from "../../src/core/config.ts";
import { changeLines } from "../../src/core/changelog.ts";
import type { Event, Person, Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

const open = (w: World) => Tree.open(w.cwd, w.env);
const gitHead = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
const birth = (w: World): Event => open(w).get<Person>("P0001")!.events.find((e) => e.kind === "BIRT" && !e.retracted)!;
const shown = (plan: { changes: { kind: string; action: string; code?: string; sourceId?: string; mainOff?: true }[] }) =>
  plan.changes.map((c) => [c.kind, c.action, c.code ?? "", c.sourceId ?? "", c.mainOff ? "off" : ""].filter(Boolean).join(" "));

/**
 * Lhotákovi: Prokop's birth of 1850 cited first by his death entry of 1911 (S0001, fol. 3 — the record the e-mail of
 * spec 095 found shown for a birth), then by his baptism (S0002, fol. 7); an index of births (S0003). Information
 * nobody assessed, as an agent's source has it by default.
 */
async function research(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["source", "add", "Úmrtí Prokopa Lhotáka", "--kind", "death", "--date", "12 MAR 1911"]); // S0001
  await w.ok(["source", "add", "Křest Prokopa Lhotáka", "--kind", "baptism", "--date", "3 FEB 1850"]); // S0002
  await w.ok(["source", "add", "Index narozených Lhota", "--kind", "index", "--date", "1900"]); // S0003
  await w.ok(["person", "add", "Prokop /Lhoták/", "--sex", "M"]); // P0001
  await w.ok(["event", "add", "P0001", "BIRT", "--date", "1 FEB 1850", "--place", "Lhota", "--cite", "S0001", "--locator", "fol. 3"]); // E0001
  await w.ok(["cite", "E0001", "S0002", "--locator", "fol. 7"]);
  return w;
}

/** What the research gives the Strom app (of an app that reads the main citation unless `main` is false), as the app sends it back. */
function appFile(w: World, main = true): string {
  return exportGedcom(open(w), { for: "strom", head: gitHead(w), ...(main ? { mainCitations: true } : {}) }).text.replace("1 SOUR STROM_RESEARCH", "1 SOUR STROM");
}

const records = (t: string) => t.split(/(?=^0 )/mu);
/** Prokop's birth as the file has it. */
const birthBlock = (t: string) => /^1 BIRT\r?\n(?:[2-9] .*\r?\n)*/mu.exec(records(t).find((r) => /^1 REFN P0001\r?$/mu.test(r))!)![0];
/** The file with Prokop's birth changed. */
const inBirth = (t: string, fn: (b: string) => string) => t.replace(birthBlock(t), (b) => fn(b));
/** The citation of the source under the birth, with its lines. */
const citeRe = (s: string) => new RegExp(`^2 SOUR @${s}@\\r?\\n(?:[3-9] .*\\r?\\n)*`, "mu");
/** The sources the birth cites in the file's order. */
const order = (t: string) => [...birthBlock(t).matchAll(/^2 SOUR @(S\d+)@/gmu)].map((m) => m[1]);

/**
 * A sync written straight (the gates open as the test needs them), with its input and the day's source as `strom sync`
 * makes them, committed. `day`: the day's source of an earlier send — the app's sends of one day share it, as they do.
 */
function apply(w: World, incoming: Snapshot, gates: { readsMain?: boolean; sendsUncite?: boolean }, person = true, day?: string) {
  const tree = open(w);
  tree.personWrites = person;
  return tree.withTreeLock(() => {
    const plan = planSync(tree, incoming, "conflict", gates);
    const made = create<SyncInput>(tree, "input", { name: "app.ged", sha: "0", size: 1, mime: "text/plain", from: "app.ged", kind: "tree", state: "processed" } as never, (i) => `+${i} input tree "app.ged" (sync)`);
    const source = day ? tree.get<Source>(day)! : create<Source>(tree, "source", { kind: "family-tree", title: "Strom", input: made.id, information: "secondary", form: "authored" } as never, (s) => `+${s} source "app.ged" (sync)`);
    const r = applySync(tree, plan, incoming, source, undefined, { decidePerson: false, input: made.id });
    update<SyncInput>(tree, made.id, "input", (i) => ({ ...i, source: source.id, sync: { ...(incoming.head ? { head: incoming.head } : {}), edits: "conflict", applied: r.applied } }), { op: "input.sync", summary: `${made.id} synced` });
    tree.commit(`sync ${made.id}`);
    return { plan, input: made.id, source: source.id, ...r };
  });
}

test("the gates of the main citation and of a removed one: the app 3.29.0 (its beta 3.29.0-beta.3); the JSON's from data version 21", () => {
  assert.equal(APP_READS_MAIN_CITATION, "3.29.0");
  assert.equal(APP_READS_MAIN_CITATION_BETA, "3.29.0-beta.3");
  assert.equal(APP_SENDS_UNCITE, "3.29.0");
  assert.equal(APP_DATA_MAIN_CITATION, 21);
  const production = new Settings({ STROM_APP_URL: "https://stromapp.info/run/" }, {});
  const beta = new Settings({ STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
  for (const v of ["3.29.0", "9.0.0"]) assert.equal(appReadsMainCitation(production, v), true, String(v));
  for (const v of ["3.28.9", "3.29.0-beta.3", undefined]) assert.equal(appReadsMainCitation(production, v), false, String(v));
  assert.equal(appReadsMainCitation(beta, "3.29.0-beta.3"), true, "another copy from its beta");
  assert.equal(appReadsMainCitation(beta, "3.29.0-beta.2"), false);
  assert.equal(appReadsMainCitation(production, "3.28.9", "3.29.0"), false);
  for (const v of ["3.29.0", "3.29.1"]) assert.equal(appSendsUncite(v), true, String(v));
  for (const v of ["3.28.0", undefined]) assert.equal(appSendsUncite(v), false, String(v));
  assert.equal(appSendsUncite(undefined, "3.29.0"), false, "no version said: no");
  for (const v of [21, 30]) assert.equal(appDataMainCitation(v), true, String(v));
  for (const v of [20, undefined]) assert.equal(appDataMainCitation(v), false, String(v));
  // the bridge: the order and the codes to every app, the main citation and a removal only past their gates
  assert.ok(BRIDGE_FEATURES.includes("citations.order") && BRIDGE_FEATURES.includes("sync.notWritten.codes"));
  const now = bridgeFeatures(production, "3.29.0");
  assert.ok(now.includes("citations.order") && now.includes("sync.notWritten.codes"));
  assert.ok(now.includes("citations.main") && now.includes("citations.remove"), now.join(" "));
  const older = bridgeFeatures(production, "3.28.0");
  assert.ok(older.includes("citations.order") && older.includes("sync.notWritten.codes"));
  assert.ok(!older.includes("citations.main") && !older.includes("citations.remove"), older.join(" "));
});

test("K1.1, K1.3, V1: the baptism of a birth before the later death entry in every file; QUAY 2 for the death entry at a birth; the events a source records", opts, async () => {
  const w = await research();
  try {
    const strom = exportGedcom(open(w), { for: "strom" }).text;
    assert.deepEqual(order(strom), ["S0002", "S0001"]);
    const standard = exportGedcom(open(w), { for: "standard" }).text;
    assert.deepEqual(order(standard), ["S0002", "S0001"]);
    assert.deepEqual(birth(w).citations.map((c) => c.source), ["S0001", "S0002"], "the stored order left as it is");
    // the death entry's citation at a birth: QUAY 2 (its source is an original, its information nobody assessed)
    assert.match(citeRe("S0001").exec(birthBlock(standard))![0], /^3 QUAY 2$/mu);
    // GEDCOM 5.5.1 EVENTS_RECORDED in the file for other programs, never in an older app's
    assert.match(records(standard).find((r) => r.startsWith("0 @S0001@ SOUR"))!, /^1 DATA\r?\n2 EVEN DEAT$/mu);
    assert.match(records(standard).find((r) => r.startsWith("0 @S0002@ SOUR"))!, /^1 DATA\r?\n2 EVEN CHR$/mu);
    assert.doesNotMatch(records(standard).find((r) => r.startsWith("0 @S0003@ SOUR"))!, /^2 EVEN/mu, "an index records no event of its own");
    assert.doesNotMatch(strom, /^2 EVEN (?:DEAT|CHR)$/mu);
    assert.match(appFile(w), /^1 DATA\r?\n2 EVEN DEAT$/mu, "the app that reads the main citation gets them");
    // the brief shows the order too
    const brief = (await w.ok(["person", "show", "P0001"])).out;
    assert.ok(brief.indexOf("S0002") < brief.indexOf("S0001"), brief);
  } finally {
    w.cleanup();
  }
});

test("K2.2, K2.3: the user's main citation chosen in the app is written, given back first, cancelled with a send; no agent's sync or cite changes it; undone with the sync", opts, async () => {
  const w = await research();
  try {
    // the user chose the death entry as the birth's main citation after all
    const chosen = inBirth(appFile(w), (b) => b.replace(/^2 SOUR @S0001@\r?\n/mu, (m) => `${m}3 _STROM_MAIN Y\n`));
    assert.deepEqual(shown(planSync(open(w), readGedcom(chosen), "conflict")), [], "an app before the gate: never a main citation");
    assert.deepEqual(shown(planSync(open(w), readGedcom(chosen), "conflict", { readsMain: true })), ["fact.main user S0001"]);
    // an agent's sync: only kept for the user
    const agent = apply(w, readGedcom(chosen), { readsMain: true }, false);
    assert.deepEqual(agent.skipped.map((s) => s.code), ["sync.origin"]);
    assert.equal(birth(w).citations.some((c) => c.main), false);
    // the person's: written, logged, given back first and marked
    const set = apply(w, readGedcom(chosen), { readsMain: true });
    assert.deepEqual(set.applied.map((a) => a.do), ["event.main"]);
    const main = birth(w).citations.find((c) => c.main)!;
    assert.equal(main.source, "S0001");
    assert.equal(main.main!.by, "user");
    const back = appFile(w);
    assert.deepEqual(order(back), ["S0001", "S0002"]);
    assert.match(citeRe("S0001").exec(birthBlock(back))![0], /^3 _STROM_MAIN Y$/mu);
    assert.doesNotMatch(appFile(w, false), /_STROM_MAIN/u, "an older app is never given it");
    assert.doesNotMatch(exportGedcom(open(w), { for: "standard" }).text, /_STROM_MAIN/u, "nor another program");
    assert.deepEqual(order(exportGedcom(open(w), { for: "standard" }).text), ["S0001", "S0002"], "the main citation first there too");
    // an unedited tree round-trips with no change
    assert.deepEqual(shown(planSync(open(w), readGedcom(back), "conflict", { readsMain: true })), []);
    // an agent cites a better record: the user's main citation stays first (K2.3)
    await w.ok(["cite", "E0001", "S0003"]);
    assert.equal(birth(w).citations.filter((c) => c.main).map((c) => c.source).join(), "S0001");
    assert.deepEqual(order(appFile(w)), ["S0001", "S0002", "S0003"]);
    assert.match((await w.ok(["person", "show", "P0001"])).out, /S0001[^\n]*\(main, the user's\)/u);
    // the history says it in the research's language
    const tree = open(w);
    const said = changeLines(tree, tree.readOps().filter((o) => o.op === "event.main"), "", tree.lang).map((l) => l.text);
    assert.deepEqual(said, ["Zvolen hlavní doklad údaje: Prokop Lhoták (*1850) [P0001] – narození: 1. 2. 1850, Lhota"], JSON.stringify(said));
    // cancelled in the app: no main citation, the order the rule's again
    const cancelled = inBirth(appFile(w), (b) => b.replace(/^3 _STROM_MAIN Y\r?\n/mu, ""));
    const off = apply(w, readGedcom(cancelled), { readsMain: true });
    assert.deepEqual(shown(off.plan), ["fact.main user S0001 off"]);
    assert.equal(birth(w).citations.some((c) => c.main), false);
    assert.deepEqual(order(appFile(w)), ["S0002", "S0001", "S0003"]);
    // the cancel undone: the user's choice back as it was
    await w.ok(["sync", "undo", off.input]);
    assert.deepEqual(birth(w).citations.find((c) => c.main), main);
    await w.ok(["sync", "undo", set.input]);
    assert.equal(birth(w).citations.some((c) => c.main), false, "the choice undone: none");
  } finally {
    w.cleanup();
  }
});

test("K3.1–K3.3: a citation the user removed in the app is removed against what the app was given, stays removed, no agent cites it there again without a reason; undone with the sync", opts, async () => {
  const w = await research();
  try {
    const given = appFile(w);
    const removed = inBirth(given, (b) => b.replace(citeRe("S0001"), ""));
    // never without the state the app was given, never of an app that does not say it
    assert.deepEqual(shown(planSync(open(w), readGedcom(removed.replace(/^1 _STROM_HEAD .*\r?\n/mu, "")), "conflict", { readsMain: true, sendsUncite: true })), []);
    assert.deepEqual(shown(planSync(open(w), readGedcom(removed), "conflict")), [], "an app before the gates: nothing, not even said");
    assert.deepEqual(shown(planSync(open(w), readGedcom(removed), "conflict", { readsMain: true })), ["fact.uncite report cite.olderApp S0001"]);
    // the research cited the source again since (another place in it): only the citation the app was given goes
    await w.ok(["cite", "E0001", "S0001", "--locator", "fol. 4"]);
    const plan = planSync(open(w), readGedcom(removed), "conflict", { readsMain: true, sendsUncite: true });
    assert.deepEqual(shown(plan), ["fact.uncite user S0001"]);
    assert.deepEqual(plan.changes[0]!.locators, ["fol. 3"]);
    const r = apply(w, readGedcom(removed), { readsMain: true, sendsUncite: true });
    assert.deepEqual(r.applied.map((a) => a.do), ["event.uncite"]);
    const e = birth(w);
    assert.deepEqual(e.citations.map((c) => `${c.source} ${c.locator}`), ["S0002 fol. 7", "S0001 fol. 4"]);
    assert.equal(e.uncited?.length, 1);
    assert.deepEqual({ ...e.uncited![0]!, at: "" }, { source: "S0001", locator: "fol. 3", at: "", by: "user", sync: r.input });
    assert.ok(open(w).get<Source>("S0001") && !open(w).get<Source>("S0001")!.retracted, "the source itself stays");
    // the brief says it to the agent; the history in the research's language
    assert.match((await w.ok(["person", "show", "P0001"])).out, /removed by the user: S0001/u);
    const tree = open(w);
    const said = changeLines(tree, tree.readOps().filter((o) => o.op === "event.cite" && / cites no more /u.test(o.summary)), "", tree.lang).map((l) => l.text);
    assert.deepEqual(said, ["Doklad odebrán: Prokop Lhoták (*1850) [P0001] – narození: 1. 2. 1850, Lhota"], JSON.stringify(said));
    // loaded again: nothing comes back, nothing new
    assert.deepEqual(shown(planSync(open(w), readGedcom(appFile(w)), "conflict", { readsMain: true, sendsUncite: true })), []);
    // an agent's citation of it there again: refused with its code, unless with a reason — which closes the removal
    const refused = await w.run(["cite", "E0001", "S0001", "--locator", "fol. 3", "--json"]);
    assert.notEqual(refused.code, 0);
    assert.match(refused.out + refused.err, /cite\.removedByUser/u);
    assert.match(refused.out + refused.err, /--reason/u);
    const refusedEdit = await w.run(["event", "edit", "E0001", "--date", "2 FEB 1850", "--cite", "S0001", "--reason", "x"]);
    assert.notEqual(refusedEdit.code, 0, "a changed value on the removed record neither");
    await w.ok(["cite", "E0001", "S0001", "--locator", "fol. 3", "--reason", "zápis jmenuje Prokopa i s datem křtu".normalize("NFD")]);
    assert.ok(birth(w).uncited![0]!.cleared, "closed");
    assert.equal(birth(w).citations.filter((c) => c.source === "S0001").length, 2);
  } finally {
    w.cleanup();
  }
});

test("K3.1: the removal undone with the sync — the citation and its status back, the removal gone", opts, async () => {
  const w = await research();
  try {
    await w.ok(["event", "edit", "E0001", "--status", "probable"]);
    const removed = inBirth(appFile(w), (b) => b.replace(citeRe("S0001"), "").replace(citeRe("S0002"), ""));
    const r = apply(w, readGedcom(removed), { readsMain: true, sendsUncite: true });
    assert.deepEqual(r.applied.map((a) => a.do), ["event.uncite", "event.uncite"]);
    assert.deepEqual(birth(w).citations, []);
    assert.equal(birth(w).status, "lead", "no citation: no more than a lead");
    await w.ok(["sync", "undo", r.input]);
    const e = birth(w);
    assert.deepEqual(e.citations.map((c) => c.source).sort(), ["S0001", "S0002"]);
    assert.equal(e.status, "probable");
    assert.equal(e.uncited, undefined);
  } finally {
    w.cleanup();
  }
});

test("K3.1: a removal in a later send of the day undone with its sync — not with the day's first send, whose source it shares", opts, async () => {
  for (const undo of ["second", "first"] as const) {
    const w = await research();
    try {
      // the day's first send: the user's main citation; the second, on the same day's source: a citation removed
      const chosen = inBirth(appFile(w), (b) => b.replace(/^2 SOUR @S0002@\r?\n/mu, (m) => `${m}3 _STROM_MAIN Y\n`));
      const first = apply(w, readGedcom(chosen), { readsMain: true, sendsUncite: true });
      assert.deepEqual(first.applied.map((a) => a.do), ["event.main"]);
      const removed = inBirth(appFile(w), (b) => b.replace(citeRe("S0001"), ""));
      const second = apply(w, readGedcom(removed), { readsMain: true, sendsUncite: true }, true, first.source);
      assert.deepEqual(second.applied.map((a) => a.do), ["event.uncite"]);
      assert.equal(second.source, first.source, "one source of the day");
      assert.deepEqual(birth(w).uncited?.map((u) => `${u.source} ${u.locator} ${u.sync}`), [`S0001 fol. 3 ${second.input}`], "the removal names its own sync");
      if (undo === "second") {
        await w.ok(["sync", "undo", second.input]);
        const e = birth(w);
        assert.deepEqual(e.citations.map((c) => `${c.source} ${c.locator}`).sort(), ["S0001 fol. 3", "S0002 fol. 7"]);
        assert.equal(e.uncited, undefined, "the removal gone with it");
        assert.doesNotMatch((await w.ok(["person", "show", "P0001"])).out, /removed by the user/u);
        assert.equal(e.citations.find((c) => c.main)?.source, "S0002", "the first send's choice stays");
      } else {
        await w.ok(["sync", "undo", first.input]);
        const e = birth(w);
        assert.equal(e.citations.some((c) => c.main), false, "the first send's choice undone");
        assert.deepEqual(e.citations.map((c) => c.source), ["S0002"], "the second send's removal stays");
        assert.deepEqual(e.uncited?.map((u) => `${u.source} ${u.sync}`), [`S0001 ${second.input}`]);
      }
    } finally {
      w.cleanup();
    }
  }
});

test("K3.4: what is not written says why by a stable code with its params — a source gone from the file, a main citation of a fact the research has not", opts, async () => {
  const w = await research();
  try {
    let t = appFile(w);
    // the user removed the death entry from the tree in the app altogether: the research keeps it, the app is told
    t = records(t)
      .filter((r) => !r.startsWith("0 @S0001@ SOUR"))
      .join("");
    t = inBirth(t, (b) => b.replace(citeRe("S0001"), ""));
    const plan = planSync(open(w), readGedcom(t), "conflict", { readsMain: true, sendsUncite: true });
    assert.deepEqual(shown(plan), ["fact.uncite report cite.sourceRemoved S0001"]);
    const said = notWrittenList(plan.changes);
    assert.deepEqual(said.map((x) => [x.kind, x.code, x.params]), [["fact.uncite", "cite.sourceRemoved", { person: "P0001", fact: "BIRT", event: "E0001", source: "S0001" }]]);
    assert.equal(apply(w, readGedcom(t), { readsMain: true, sendsUncite: true }).applied.length, 0);
    assert.deepEqual(birth(w).citations.map((c) => c.source), ["S0001", "S0002"]);
    // a main citation marked on a fact the research does not have (a date the user changed with it): reported
    const other = inBirth(appFile(w), (b) => b.replace(/^2 DATE .*$/mu, "2 DATE 9 SEP 1851").replace(/^2 SOUR @S0002@\r?\n/mu, (m) => `${m}3 _STROM_MAIN Y\n`));
    const codes = planSync(open(w), readGedcom(other), "conflict", { readsMain: true })
      .changes.map((c) => `${c.kind} ${c.code ?? ""}`.trim());
    // the changed date is the user's change (its own way); the main citation marked with it is said, never lost silently
    assert.deepEqual(codes, ["fact.changed", "fact.main fact.noMatch"]);
  } finally {
    w.cleanup();
  }
});

test("K3.4: what the user changed in the app of a fact the research took back since is said with its code, never in silence — nothing written; the bridge and /status say it too", opts, async () => {
  const w = await research();
  try {
    const given = appFile(w);
    await w.ok(["event", "retract", "E0001", "--reason", "zápis patří jinému Prokopovi"]);
    const gates = { readsMain: true, sendsUncite: true };
    const plan = (fn: (b: string) => string, g: { readsMain?: boolean; sendsUncite?: boolean } = gates) => planSync(open(w), readGedcom(inBirth(given, fn)), "conflict", g);
    // the citation removed (found with the app's 3.29.0-beta.1: "changes 0", nothing said, the citation kept)
    const uncite = plan((b) => b.replace(citeRe("S0001"), ""));
    assert.deepEqual(shown(uncite), ["fact.uncite report event.retracted S0001"]);
    assert.deepEqual(notWrittenList(uncite.changes).map((x) => [x.kind, x.code, x.params]), [["fact.uncite", "event.retracted", { person: "P0001", fact: "BIRT", event: "E0001", source: "S0001" }]]);
    assert.deepEqual(shown(plan((b) => b.replace(citeRe("S0001"), ""), { readsMain: true })), [], "of an app that does not say a removal: nothing removed, nothing to say");
    // the main citation chosen there: the same code, never fact.noMatch beside it
    assert.deepEqual(shown(plan((b) => b.replace(/^2 SOUR @S0002@\r?\n/mu, (m) => `${m}3 _STROM_MAIN Y\n`))), ["fact.main report event.retracted S0002"]);
    // a source cited there, a note, a detail: each said
    const cited = plan((b) => `${b}2 SOUR @S0003@\n`);
    assert.deepEqual(shown(cited), ["fact.cite report event.retracted"]);
    assert.deepEqual(notWrittenList(cited.changes)[0]!.cites, ["S0003"]);
    assert.deepEqual(shown(plan((b) => `${b}2 NOTE Porodní bába Lhotáková\n`.normalize("NFD"))), ["fact.note report event.retracted"]);
    assert.deepEqual(shown(plan((b) => `${b}2 AGE 0d\n`)), ["fact.detail report event.retracted"]);
    // as given: nothing to say (the research's own retraction is no change of the user's)
    assert.deepEqual(shown(plan((b) => b)), []);
    // nothing written: the fact stays taken back with its citations
    const r = apply(w, readGedcom(inBirth(given, (b) => `${b.replace(citeRe("S0001"), "")}2 SOUR @S0003@\n`)), gates);
    assert.equal(r.applied.length, 0);
    const back = open(w).get<Person>("P0001")!.events.find((e) => e.id === "E0001")!;
    assert.ok(back.retracted);
    assert.deepEqual(back.citations.map((c) => c.source), ["S0001", "S0002"]);
    assert.equal(back.uncited, undefined);
    // said so to a person, in the research's language
    const file = `${w.dir}/app.ged`;
    (await import("node:fs")).writeFileSync(file, inBirth(given, (b) => `${b}2 NOTE Porodní bába\n`));
    assert.match((await w.ok(["sync", file], { tty: true })).out, /nezapíše se: výzkum tento údaj mezitím stáhl/u);
    // through the bridge (no gate needed for a note): named in the answer and in /status, never a silent nothing
    const info = (await w.ok(["live", "start", "--json"])).json;
    try {
      const res = await fetch(`${info.url}/sync`, { method: "POST", body: inBirth(given, (b) => `${b}2 NOTE Porodní bába\n`), headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
      const sent = (await res.json()) as Record<string, any>;
      assert.equal(res.status, 200, JSON.stringify(sent));
      assert.equal(sent.applied, 0, JSON.stringify(sent));
      assert.deepEqual(sent.notWritten?.map((x: { kind: string; code: string; params: unknown }) => [x.kind, x.code, x.params]), [["fact.note", "event.retracted", { person: "P0001", fact: "BIRT", event: "E0001" }]], JSON.stringify(sent));
      const status = (await (await fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } })).json()) as { sends: { intake: string; notWritten?: unknown[]; notWrittenCount?: number }[] };
      const kept = status.sends.find((x) => x.intake === sent.intake) as { state?: string; notWritten?: unknown[]; notWrittenCount?: number } | undefined;
      assert.equal(kept?.state, "nothing", JSON.stringify(status.sends));
      assert.deepEqual(kept?.notWritten, sent.notWritten, JSON.stringify(status.sends));
      assert.equal(kept?.notWrittenCount, 1);
    } finally {
      await w.ok(["live", "stop"]);
    }
  } finally {
    w.cleanup();
  }
});

test("K3.4: a later send of the app (_STROM_SINCE: its copy of the send before, no IDs of facts) says a change of a fact the research took back since by its code too — the bridge and /status alike (found with the app's 3.29.0-beta.1: \"changes 0\")", opts, async () => {
  const w = await research();
  const fs = await import("node:fs");
  try {
    const info = (await w.ok(["live", "start", "--json"])).json;
    const headers = { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" };
    const post = async (body: string) => {
      const res = await fetch(`${info.url}/sync`, { method: "POST", body, headers });
      const sent = (await res.json()) as Record<string, any>;
      assert.equal(res.status, 200, JSON.stringify(sent));
      return sent;
    };
    try {
      // the app's first send: a note of the birth, written
      const given = appFile(w);
      const first = inBirth(given, (b) => `${b}2 NOTE Porodní bába Lhotáková\n`);
      const one = await post(first);
      assert.equal(one.applied, 1, JSON.stringify(one));
      // the research takes the birth back; the app goes on from its copy of that send
      await w.ok(["event", "retract", birth(w).id, "--reason", "zápis patří jinému Prokopovi"]);
      const next = (fn: (b: string) => string) => inBirth(first, fn).replace(/^1 _STROM_HEAD .*$/mu, (m) => `${m}\n1 _STROM_SINCE ${one.intake}`);
      assert.match(next((b) => b), /^1 _STROM_SINCE R/mu);
      // the citation removed, the main one chosen there (the gates open as the app's that sends them)
      const gates = { readsMain: true, sendsUncite: true };
      const plan = (fn: (b: string) => string) => planSync(open(w), readGedcom(next(fn)), "conflict", gates);
      assert.deepEqual(shown(plan((b) => b.replace(citeRe("S0001"), ""))), ["fact.uncite report event.retracted S0001"]);
      assert.deepEqual(shown(plan((b) => b.replace(/^2 SOUR @S0002@\r?\n/mu, (m) => `${m}3 _STROM_MAIN Y\n`))), ["fact.main report event.retracted S0002"]);
      assert.deepEqual(shown(plan((b) => b)), [], "as the send before left it: nothing to say");
      // through the bridge: the note changed again — named in the answer and in /status, nothing written
      const two = await post(next((b) => b.replace("Porodní bába Lhotáková", "Porodní bába Lhotáková z Lhoty")));
      assert.equal(two.applied, 0, JSON.stringify(two));
      assert.deepEqual(two.notWritten?.map((x: { kind: string; code: string; params: unknown }) => [x.kind, x.code, x.params]), [["fact.note", "event.retracted", { person: "P0001", fact: "BIRT", event: birthOf(w) }]], JSON.stringify(two));
      const status = (await (await fetch(`${info.url}/status`, { headers: { Origin: "https://beta.stromapp.info" } })).json()) as { sends: { intake: string; state?: string; notWritten?: unknown[]; notWrittenCount?: number }[] };
      const kept = status.sends.find((x) => x.intake === two.intake);
      assert.equal(kept?.state, "nothing", JSON.stringify(status.sends));
      assert.deepEqual(kept?.notWritten, two.notWritten, JSON.stringify(status.sends));
      assert.equal(kept?.notWrittenCount, 1);
    } finally {
      await w.ok(["live", "stop"]);
    }
  } finally {
    w.cleanup();
  }
});

/** Prokop's birth the research took back (its ID). */
const birthOf = (w: World): string => open(w).get<Person>("P0001")!.events.find((e) => e.kind === "BIRT" && e.retracted)!.id;
