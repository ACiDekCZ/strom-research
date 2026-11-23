// What the app sends is planned once: by the strom that writes it (the bridge leaves the count to it), again under the
// lock only when the research changed meanwhile. The send is written as a sync of the same file is; refused as the
// bridge refuses one; where its time went is one line of live.log, without a name.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { post, get } from "./sync.helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { receiveTree } from "../../src/core/sync.ts";
import { waitingFor } from "../../src/core/waiting.ts";

const skip = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info" };

async function lhota(): Promise<{ w: World; ged: string }> {
  const w = new World();
  await w.withTree("Test");
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Křest Vojtěcha Lhotáka 1885", "--kind", "baptism", "--transcript", "Vojtěch, syn Jana Lhotáka."]); // S1
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["event", "add", "P1", "CHR", "--date", "3 MAR 1885", "--place", "Lhota", "--cite", "S1"]);
  await w.ok(["person", "add", "Žofie /Lhotová/", "--sex", "F", "--born", "1888"]); // P2
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F1
  const ged = path.join(w.dir, "strom.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  return { w, ged };
}

/** The user's edits in the app: a recorded date changed (a conflict), a death added, a daughter added. */
function lhotaEdited(ged: string, out: string): string {
  let t = fs.readFileSync(ged, "utf8");
  t = t.replace("2 DATE 3 MAR 1885", "2 DATE 4 MAR 1885");
  t = t.replace(/(1 REFN P0002\r?\n2 TYPE strom-research\r?\n)/, "$11 DEAT\n2 DATE 1960\n2 PLAC Lhota\n");
  t = t.replace(/(0 @[^@]+@ FAM\r?\n)/, "0 @X1@ INDI\n1 NAME Ludmila /Lhotáková/\n1 SEX F\n1 BIRT\n2 DATE 1910\n2 PLAC Lhota\n$1");
  t = t.replace(/(0 @[^@]+@ FAM\r?\n(?:[1-9].*\r?\n)*)/, "$11 CHIL @X1@\n");
  fs.writeFileSync(out, t);
  return out;
}

const liveLog = (w: World) => {
  try {
    return fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
  } catch {
    return "";
  }
};

/** What a research holds, as it can be compared with another's (its own IDs and times aside). */
async function holds(w: World): Promise<unknown> {
  const ged = path.join(w.dir, "after.ged");
  await w.ok(["export", "gedcom", "--for", "standard", "--out", ged]);
  // the records alone: the header says when and of which research
  const records = fs.readFileSync(ged, "utf8").split(/\r?\n(?=0 @)/).slice(1).join("\n");
  const out = [records, ...(await Promise.all([["person", "list", "--json"], ["conflict", "list", "--json"]].map(async (a) => (await w.ok(a)).out)))];
  // the one difference by design: the app's sends of a day are one source titled by the day, a file's by its name too
  return out.map((o) => o.replace(/\(z-aplikace\.ged, /g, "(").replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, "T").replace(/\b[0-9a-f]{40}\b/g, "H").replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "U"));
}

test("strom sync <file> --apply plans once: nothing written meanwhile, the plan made holds under the lock (plans 1, its phases said)", skip, async () => {
  const { w, ged } = await lhota();
  try {
    const file = lhotaEdited(ged, path.join(w.dir, "z-aplikace.ged"));
    // only shown: one plan, nothing written
    const shown = await w.ok(["sync", file, "--json"]);
    assert.equal(shown.json.plans, 1);
    const r = await w.ok(["sync", file, "--apply", "--json"]);
    assert.equal(r.json.plans, 1, r.out);
    assert.match(r.json.input, /^I\d+$/);
    for (const k of ["read", "plan", "lock", "apply", "settle"]) assert.equal(typeof r.json.phases[k], "number", k);
    assert.equal(typeof r.json.planParts.ours, "number");
  } finally {
    w.cleanup();
  }
});

test("a send written at once is counted by its writer: /status says no count while it is counted; written in between, planned again under the lock (plans 2); its line in live.log, no name in it", skip, async () => {
  const { w, ged } = await lhota();
  const hold = path.join(w.dir, "held");
  w.env.STROM_TEST_SYNC_PLANNED = hold;
  const info = (await w.ok(["live", "start", "--json"])).json;
  delete w.env.STROM_TEST_SYNC_PLANNED;
  try {
    const sending = post(`${info.url}/sync`, fs.readFileSync(lhotaEdited(ged, path.join(w.dir, "z-aplikace.ged")), "utf8"), app);
    await until("the writer planned", () => fs.existsSync(hold));
    const st = JSON.parse((await get(`${info.url}/status?poll=1`)).body);
    const send = st.sends.find((s: { state: string }) => s.state === "pending");
    assert.ok(send, JSON.stringify(st.sends));
    assert.equal("changes" in send, false, "not counted yet: no number, never 0");
    for (const t of st.inbox.trees) assert.equal("changes" in t, false, JSON.stringify(t));
    // another write meanwhile: the plan does not hold
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
    fs.rmSync(hold);
    const r = await sending;
    assert.equal(r.status, 200, r.body);
    const got = JSON.parse(r.body);
    assert.equal(got.inbox, false);
    assert.match(got.input, /^I\d+$/);
    assert.ok(got.changes > 0);
    let log = "";
    await until("its line", () => /send R\S+ [\d.]+ MB: /.test((log = liveLog(w))));
    const line = log.split("\n").find((l) => /send R\S+ [\d.]+ MB: /.test(l))!;
    assert.match(line, /body [\d.]+ s, decode [\d.]+ s, undone [\d.]+ s, known ids\+file [\d.]+ s, writer [\d.]+ s \(read [\d.]+ s, plan [\d.]+ s \(ours [\d.]+ s.*\), plans 2, lock [\d.]+ s, apply [\d.]+ s, settle [\d.]+ s\), files by reference 0, excerpts without FILE 0, with data 0, answered 200 at [\d.]+ s$/, line);
    for (const name of ["Lhot", "Vojtěch", "Žofie", "Ludmila", "P000"]) assert.ok(!log.includes(name), `${name} in live.log`);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("a send written at once writes what a sync of the same file writes (a twin research)", skip, async () => {
  const a = await lhota();
  const b = await lhota();
  const info = (await a.w.ok(["live", "start", "--json"])).json;
  try {
    const r = await post(`${info.url}/sync`, fs.readFileSync(lhotaEdited(a.ged, path.join(a.w.dir, "z-aplikace.ged")), "utf8"), app);
    assert.equal(r.status, 200, r.body);
    const sent = JSON.parse(r.body);
    const plain = await b.w.ok(["sync", lhotaEdited(b.ged, path.join(b.w.dir, "z-aplikace.ged")), "--apply", "--json"]);
    assert.equal(sent.changes, plain.json.changes.length);
    assert.equal(sent.conflicts.length, plain.json.conflicts.length);
    assert.deepEqual(await holds(a.w), await holds(b.w));
  } finally {
    await a.w.ok(["live", "stop"]);
    a.w.cleanup();
    b.w.cleanup();
  }
});

test("a send its writer refuses as it reads it: 400 as the bridge refuses one, kept aside, no record left; nothing new: today's answer", skip, async () => {
  const { w, ged } = await lhota();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    // no people in it: refused by the strom that reads it
    const r = await post(`${info.url}/sync`, "0 HEAD\n1 SOUR STROM\n1 GEDC\n2 VERS 5.5.1\n1 CHAR UTF-8\n0 TRLR\n", app);
    assert.equal(r.status, 400, r.body);
    const got = JSON.parse(r.body);
    assert.equal(got.code, "tree.empty", r.body);
    assert.match(got.keptAs, /^kept\/refused-strom-app-.*\.ged$/);
    assert.ok(fs.existsSync(path.join(w.cwd, ".strom", "sync", got.keptAs)));
    assert.deepEqual(fs.readdirSync(path.join(w.cwd, ".strom", "sync")).filter((f) => f.startsWith("received-")), [], "no record of it");
    // the research as it was given: nothing new, answered as ever
    const same = await post(`${info.url}/sync`, fs.readFileSync(ged, "utf8"), app);
    assert.equal(same.status, 200, same.body);
    const nothing = JSON.parse(same.body);
    assert.deepEqual(Object.keys(nothing).sort(), ["changes", "conflicts", "file", "head", "inbox", "intake", "ok"]);
    assert.deepEqual({ ok: nothing.ok, changes: nothing.changes, inbox: nothing.inbox, conflicts: nothing.conflicts }, { ok: true, changes: 0, inbox: false, conflicts: [] });
    assert.match(nothing.file, /^strom-app-.*\.ged$/);
    const st = JSON.parse((await get(`${info.url}/status?poll=1`)).body);
    assert.equal(st.sends[0].state, "nothing");
    assert.equal(st.sends[0].changes, 0);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("what waits: a send its writer counts says no number (never 0 changes); counted, its changes", skip, async () => {
  const { w, ged } = await lhota();
  try {
    const got = receiveTree(w.cwd, w.env, fs.readFileSync(lhotaEdited(ged, path.join(w.dir, "z-aplikace.ged")), "utf8"), { plan: false });
    assert.equal(got.counting, true);
    const said = () => waitingFor(Tree.open(w.cwd, w.env), { sends: true }).filter((x) => x.send).map((x) => x.item.what);
    const counting = said();
    assert.equal(counting.length, 1);
    assert.doesNotMatch(counting[0]!, /0 změn/u, counting[0]);
    assert.match(counting[0]!, /nespočítané/u, counting[0]);
    // counted by a plan of the inbox: its number
    await w.ok(["sync", got.file, "--json"]);
    const r = receiveTree(w.cwd, w.env, fs.readFileSync(lhotaEdited(ged, path.join(w.dir, "z-aplikace-2.ged")), "utf8"));
    assert.ok(r.changes > 0);
    assert.ok(said().some((t) => t.includes(`${r.changes} změn`)), said().join(" | "));
  } finally {
    w.cleanup();
  }
});
