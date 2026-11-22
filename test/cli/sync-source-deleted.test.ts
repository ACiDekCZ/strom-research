// A source the person deleted in the Strom app (spec 117 K1.4, J6): the file says so in its HEAD
// (`1 _STROM_SOURCE_DELETED S…`) and the research deletes it too — only on the person's own send of a whole file the
// research gave the app, the source nowhere in it; anything else is said (source.retract-skipped, why), nothing deleted.
// A source the person deleted never comes back with a file: neither by its ID nor as an import's source (source.retracted).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { create, update } from "../../src/core/records.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { applySync, deletedSourcesOf, notWrittenList, planSync, readGedcom, undoSync, type Snapshot, type SyncInput } from "../../src/core/sync.ts";
import { deletedSource, retractSources } from "../../src/core/sourceretract.ts";
import { importSourceFor } from "../../src/core/origin.ts";
import type { Event, Person, Source } from "../../src/core/model.ts";
import { get, post } from "./sync.helpers.ts";

const opts = { skip: !hasGit };
const open = (w: World) => Tree.open(w.cwd, w.env);
const gitHead = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
const birth = (w: World): Event => open(w).get<Person>("P0001")!.events.find((e) => e.kind === "BIRT" && !e.retracted)!;
const shown = (plan: { changes: { kind: string; action: string; code?: string; sourceId?: string; retractWhy?: string }[] }) =>
  plan.changes.map((c) => [c.kind, c.action, c.code ?? "", c.sourceId ?? "", c.retractWhy ?? ""].filter(Boolean).join(" "));

/** Lhotákovi: Prokop's birth cited by his death entry (S0001) and his baptism (S0002); Marta and Vojtěch beside him. */
async function research(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["source", "add", "Úmrtí Prokopa Lhotáka", "--kind", "death", "--date", "12 MAR 1911"]); // S0001
  await w.ok(["source", "add", "Křest Prokopa Lhotáka", "--kind", "baptism", "--date", "3 FEB 1850"]); // S0002
  await w.ok(["person", "add", "Prokop /Lhoták/", "--sex", "M"]); // P0001
  await w.ok(["event", "add", "P0001", "BIRT", "--date", "1 FEB 1850", "--place", "Lhota", "--cite", "S0001", "--locator", "fol. 3"]); // E0001
  await w.ok(["cite", "E0001", "S0002", "--locator", "fol. 7"]);
  await w.ok(["person", "add", "Marta /Lhotáková/", "--sex", "F"]); // P0002
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P0003
  return w;
}

/** What the research gives the Strom app, as the app sends it back. */
const appFile = (w: World) => exportGedcom(open(w), { for: "strom", head: gitHead(w), mainCitations: true }).text.replace("1 SOUR STROM_RESEARCH", "1 SOUR STROM");
const records = (t: string) => t.split(/(?=^0 )/mu);
/** The file with the source taken out of it as the app deletes one: its record and every citation of it, with its lines. */
function without(t: string, id: string): string {
  const out: string[] = [];
  let skip = -1;
  for (const line of t.split(/\r?\n/u)) {
    const level = Number(/^(\d+) /u.exec(line)?.[1] ?? -1);
    if (skip >= 0 && level > skip) continue;
    skip = -1;
    if (line === `0 @${id}@ SOUR` || new RegExp(`^\\d+ SOUR @${id}@$`, "u").test(line)) {
      skip = level;
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

/** The HEAD's lines of the sources the person deleted. */
const saying = (t: string, ...ids: string[]) => t.replace(/^(1 _STROM_HEAD .*\r?\n)/mu, `$1${ids.map((id) => `1 _STROM_SOURCE_DELETED ${id}\n`).join("")}`);

/** A sync written straight, with its input and the day's source as `strom sync` makes them, committed. */
function apply(w: World, incoming: Snapshot, person = true) {
  const tree = open(w);
  tree.personWrites = person;
  return tree.withTreeLock(() => {
    const plan = planSync(tree, incoming, "conflict", { readsMain: true, sendsUncite: true });
    const made = create<SyncInput>(tree, "input", { name: "app.ged", sha: "0", size: 1, mime: "text/plain", from: "app.ged", kind: "tree", state: "processed" } as never, (i) => `+${i} input tree "app.ged" (sync)`);
    const source = create<Source>(tree, "source", { kind: "family-tree", title: "Strom", input: made.id, information: "secondary", form: "authored" } as never, (s) => `+${s} source "app.ged" (sync)`);
    const r = applySync(tree, plan, incoming, source, undefined, { decidePerson: false, input: made.id });
    update<SyncInput>(tree, made.id, "input", (i) => ({ ...i, source: source.id, sync: { ...(incoming.head ? { head: incoming.head } : {}), edits: "conflict", applied: r.applied } }), { op: "input.sync", summary: `${made.id} synced` });
    tree.commit(`sync ${made.id}`);
    return { plan, input: made.id, ...r };
  });
}

/** The plan of a file, as the person's sync (or not) plans it. */
function plan(w: World, t: string, person = true) {
  const tree = open(w);
  tree.personWrites = person;
  return planSync(tree, readGedcom(t), "conflict", { readsMain: true, sendsUncite: true });
}

test("the lines of the sources deleted: an ID each, S42 → S0042, each once — anything else no source", () => {
  assert.deepEqual(deletedSourcesOf(["S0001", " s42 ", "S0001", "P0001", "S", "Sx1", ""]), ["S0001", "S0042"]);
  const t = "0 HEAD\n1 _STROM_HEAD abc\n1 _STROM_SOURCE_DELETED S0007\n1 _STROM_SOURCE_DELETED S0008\n0 TRLR\n";
  assert.deepEqual(readGedcom(t).sourcesDeleted, ["S0007", "S0008"]);
  assert.equal(readGedcom("0 HEAD\n1 _STROM_HEAD abc\n0 TRLR\n").sourcesDeleted, undefined, "no line: nothing");
});

test("K1.4: a source the person deleted in the app is deleted in the research with the send — its citations, those added since too, kept in it; no cite.sourceRemoved; sync undo puts it back", opts, async () => {
  const w = await research();
  try {
    const given = appFile(w);
    // the research cites it once more after it gave the app the file: deleted with it all the same
    await w.ok(["cite", "P0002", "S0001", "--locator", "fol. 9"]);
    const t = saying(without(given, "S0001"), "S0001");
    // without the line, as before (R1): only said, nothing deleted
    assert.deepEqual(shown(plan(w, without(given, "S0001"))), ["fact.uncite report cite.sourceRemoved S0001"]);
    assert.deepEqual(shown(plan(w, t)), ["source.retract user S0001"]);
    const r = apply(w, readGedcom(t));
    assert.deepEqual(r.retracted, ["S0001"]);
    assert.deepEqual(notWrittenList(r.plan.changes), []);
    const s = open(w).get<Source>("S0001")!;
    assert.ok(deletedSource(s), JSON.stringify(s.retracted));
    assert.deepEqual(birth(w).citations.map((c) => c.source), ["S0002"]);
    assert.equal(open(w).get<Person>("P0002")!.names[0]!.citations?.some((c) => c.source === "S0001") ?? false, false);
    assert.equal(s.deleted!.cites.length, 2, "the birth's and Marta's, kept in the source");
    assert.ok(r.applied.some((a) => a.do === "source.retract" && a.id === "S0001"));
    // the same send again: deleted already — said, nothing more
    const again = plan(w, t);
    assert.deepEqual(shown(again), ["source.retract report source.retract-skipped S0001 retracted"]);
    assert.deepEqual(notWrittenList(again.changes).map((x) => [x.kind, x.code, x.params]), [["source.retract", "source.retract-skipped", { source: "S0001", why: "retracted" }]]);
    // the sync taken back: the source back, its citations where they were
    const tree = open(w);
    tree.withTreeLock(() => {
      undoSync(tree, tree.get<SyncInput>(r.input)!);
      tree.commit("undo");
    });
    assert.equal(open(w).get<Source>("S0001")!.retracted, undefined);
    assert.deepEqual(birth(w).citations.map((c) => c.source).sort(), ["S0001", "S0002"]);
  } finally {
    w.cleanup();
  }
});

test("R4/J7: nothing deleted but on the person's send of a whole file the research gave, the source nowhere in it — stillCited, noHead, partial, unknown, notPerson", opts, async () => {
  const w = await research();
  try {
    const given = appFile(w);
    const why = (p: ReturnType<typeof plan>) => notWrittenList(p.changes).filter((x) => x.kind === "source.retract").map((x) => x.params.why);
    // the file still has the source
    assert.deepEqual(why(plan(w, saying(given, "S0001"))), ["stillCited"]);
    // a file the research never gave (no _STROM_HEAD)
    assert.deepEqual(why(plan(w, saying(without(given, "S0001"), "S0001").replace(/^1 _STROM_HEAD .*\r?\n/mu, ""))), ["noHead"]);
    // a part of the tree (fewer than half of its people)
    const part = records(without(given, "S0001"))
      .filter((r) => !/^1 REFN P000[23]\r?$/mu.test(r))
      .join("");
    assert.deepEqual(why(plan(w, saying(part, "S0001"))), ["partial"]);
    // a source the research has not; not the person's sync (an agent's)
    assert.deepEqual(why(plan(w, saying(given, "S0099"))), ["unknown"]);
    const t = saying(without(given, "S0001"), "S0001");
    assert.deepEqual(why(plan(w, t, false)), ["notPerson"]);
    const r = apply(w, readGedcom(t), false);
    assert.equal(r.retracted, undefined);
    assert.equal(open(w).get<Source>("S0001")!.retracted, undefined);
    assert.deepEqual(birth(w).citations.map((c) => c.source), ["S0001", "S0002"]);
  } finally {
    w.cleanup();
  }
});

test("J6: a source the person deleted never comes back with a file — its ID's record and citations said (source.retracted), an import's source never made again", opts, async () => {
  const w = await research();
  try {
    const given = appFile(w);
    const tree = open(w);
    tree.personWrites = true;
    tree.withTreeLock(() => {
      retractSources(tree, ["S0001"], { via: "terminal" });
      tree.commit("deleted");
    });
    // a file of before the deletion (the app had not loaded the tree since): the source and its citation not written
    const p = plan(w, given);
    const said = notWrittenList(p.changes).filter((x) => x.code === "source.retracted");
    assert.deepEqual(said.map((x) => [x.kind, x.params.source]), [
      ["source.new", "S0001"],
      ["fact.cite", "S0001"],
    ]);
    assert.equal(p.changes.some((c) => c.kind === "source.new" && c.action !== "report"), false);
    apply(w, readGedcom(given));
    assert.ok(deletedSource(open(w).get<Source>("S0001")));
    assert.deepEqual(birth(w).citations.map((c) => c.source), ["S0002"]);

    // an import's source the person deleted: the app's value marked with it written with its origin, never citing it
    const imp = { key: "I1", program: "Lhota Rodokmen", date: "1 JAN 2020", file: "lhota.ged" };
    const t2 = open(w);
    let importId = "";
    t2.withTreeLock(() => {
      importId = importSourceFor(t2, imp, undefined).source.id;
      t2.commit("import source");
    });
    const t3 = open(w);
    t3.withTreeLock(() => {
      retractSources(t3, [importId], { via: "terminal" });
      t3.commit("import source deleted");
    });
    assert.equal(importSourceFor(open(w), imp, undefined).deleted, true);
    const head = `1 _STROM_IMPORT I1\n2 SOUR Lhota Rodokmen\n2 DATE 1 JAN 2020\n2 FILE lhota.ged\n`;
    const withDeath = appFile(w)
      .replace(/^(1 _STROM_HEAD .*\r?\n)/mu, `$1${head}`)
      .replace(/^(1 REFN P0003\r?\n)/mu, "$11 DEAT\n2 DATE 4 APR 1920\n2 _STROM_IMPORT I1\n");
    const incoming = readGedcom(withDeath);
    assert.ok(incoming.imports?.get("I1"), "the file names the import");
    const r = apply(w, incoming);
    assert.ok(notWrittenList(r.plan.changes).some((x) => x.code === "source.retracted" && x.params.source === importId));
    const death = open(w).get<Person>("P0003")!.events.find((e) => e.kind === "DEAT" && !e.retracted)!;
    assert.ok(death, "the value written");
    assert.equal(death.citations.some((c) => c.source === importId), false, "never citing the deleted source");
    assert.equal(death.origin?.by, "import");
    assert.equal(death.origin?.source, importId);
    assert.equal(open(w).list<Source>("source").filter((s) => s.imported && !s.retracted).length, 0, "no new source of the import");
  } finally {
    w.cleanup();
  }
});

test("from the Strom app: the bridge deletes the source with the send — retracted in its reply and in /status.sends; with sync.review on it waits in the inbox and goes with the person's write", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = await research();
  const app = { Origin: "https://beta.stromapp.info" };
  const info = (await w.ok(["live", "start", "--json"])).json;
  const status = async () => JSON.parse((await get(`${info.url}/status?poll=1`)).body);
  try {
    const ged = path.join(w.dir, "strom.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
    const given = fs.readFileSync(ged, "utf8");
    const sent = await post(`${info.url}/sync`, saying(without(given, "S0001"), "S0001"), app);
    assert.equal(sent.status, 200, sent.body);
    const r = JSON.parse(sent.body);
    assert.deepEqual(r.retracted, ["S0001"]);
    assert.ok(deletedSource(open(w).get<Source>("S0001")));
    assert.equal(open(w).get<Source>("S0001")!.deleted!.via, "bridge");
    const send = (await status()).sends.find((x: { intake: string }) => x.intake === r.intake);
    assert.deepEqual([send.state, send.retracted], ["written", ["S0001"]]);

    // sync.review on: it waits with the rest of the send — nothing deleted until the person writes it
    await w.ok(["config", "set", "sync.review", "on"]);
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
    const waits = JSON.parse((await post(`${info.url}/sync`, saying(without(fs.readFileSync(ged, "utf8"), "S0002"), "S0002"), app)).body);
    assert.equal(waits.inbox, true);
    assert.equal(open(w).get<Source>("S0002")!.retracted, undefined);
    const file = fs.readdirSync(path.join(w.cwd, ".strom", "sync")).find((f) => f.endsWith(".ged") && !f.startsWith("kept"));
    assert.ok(file);
    const written = await w.ok(["sync", path.join(w.cwd, ".strom", "sync", file!), "--apply", "--json"], { env: { STROM_FOR_APP: "1" } });
    assert.deepEqual(written.json.retracted, ["S0002"]);
    assert.ok(deletedSource(open(w).get<Source>("S0002")));
    const st = (await status()).sends.find((x: { intake: string }) => x.intake === waits.intake);
    assert.deepEqual([st.state, st.retracted], ["written", ["S0002"]]);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});
