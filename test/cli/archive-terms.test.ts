// What an archive's terms let strom do (core/terms.ts): one level for every way to an archive, the person's permission
// for a restricted one — asked in a window or waiting in the menu, never given by an agent — a person's pace for its
// images, and connectors that worked before working on after the person's yes, their files untouched. A person's
// answer is simulated only in each test's own settings (R8).

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { archive, opts } from "./connectors.helpers.ts";
import { World, fakeConnector, pluginDir, readJsonFile } from "../helpers.ts";
import { testHooks, hostPace, HUMAN_PACE } from "../../src/core/net.ts";
import { humanPace, latchedPace, strictest, allows } from "../../src/core/terms.ts";
import { readManifest } from "../../src/core/connector.ts";
import type { ChoiceText } from "../../src/core/dialog.ts";

const pauses: number[] = [];
testHooks.sleep = async (ms) => void pauses.push(ms);
after(() => (testHooks.sleep = undefined));

const sha = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const store = (w: World) => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "archives.json"));
const imgHits = (hits: string[]) => hits.filter((h) => h.startsWith("/img/"));

/** A test's own known terms (STROM_ARCHIVES_FILE, with settings of its own): 127.0.0.1 restricted, as strom knows MZA's. */
function restrictedPack(w: World): void {
  const file = path.join(w.dir, "archives.json");
  fs.writeFileSync(file, JSON.stringify({ archives: [{ host: "127.0.0.1", name: "Zkušební archiv", level: "restricted", terms: "https://archive.example.org/napoveda", quote: "pouze standardními prostředky webových prohlížečů" }] }));
  w.env.STROM_ARCHIVES_FILE = file;
}

/** As after an update: the connectors there before, taken over by this strom's first run (its settings say an older one ran). */
async function updatedFrom(w: World, version = "1.13.0"): Promise<void> {
  const config = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  fs.writeFileSync(config, JSON.stringify({ ...readJsonFile(config), lastVersion: version }));
  fs.rmSync(path.join(w.env.STROM_CONFIG_DIR!, "archives.json"), { force: true });
  await w.ok(["consents"]); // any command: the first run of this version
}

test("a connector that worked before keeps working after the person's yes: a restricted archive asks once, then the same fetch gets the same images at a person's pace — connector.json untouched", opts, async () => {
  const w = new World();
  await w.withTree();
  const a = await archive();
  try {
    const dir = await fakeConnector(w, "zkusebni", a.base, { automation: "allowed", terms: `${a.base}/terms`, termsSummary: "The owner decided the images may be saved only by a browser's own means.", pace: { minIntervalMs: 5000, perHour: 120 } }, { confirm: false });
    const manifest = path.join(dir, "connector.json");
    const before = sha(manifest);
    await updatedFrom(w);
    // taken over as it was: one question for the person to confirm it, it runs as before meanwhile
    assert.deepEqual(store(w).pending.find((p: { kind: string }) => p.kind === "takeover").connectors, ["zkusebni"]);
    assert.equal(store(w).archives["127.0.0.1"].seen.zkusebni.by, "takeover");
    await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
    // strom's known terms say the archive restricts automation (a test's own, as MZA's ship with strom)
    restrictedPack(w);
    const found = await w.ok(["fetch", "zkusebni", "--find", "Týnec"]);
    assert.match(found.out, /5359/, "the catalogue by itself");
    a.hits.length = 0;
    const asked = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1", "--json"]);
    assert.equal(asked.code, 4, asked.out + asked.err);
    assert.equal(asked.json.status, "needs-permission");
    assert.equal(asked.json.needs, "permission");
    assert.deepEqual(asked.json.hosts, ["127.0.0.1"]);
    assert.deepEqual(imgHits(a.hits), [], "no image asked for");
    const q = store(w).pending.find((p: { kind: string }) => p.kind === "permission");
    assert.equal(q.host, "127.0.0.1");
    assert.equal(q.way, "slow");
    assert.match(q.quote, /standardními prostředky/);
    // an agent reads the English it goes by (a person their language: archive-decide.test.ts)
    const text = await w.run(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"], { env: { CLAUDECODE: "1" }, choice: null });
    assert.match(text.err, /needs the person's decision for 127\.0\.0\.1[\s\S]*another source now[\s\S]*strom task wait T… --images B…:1-2/);

    // the person allows it slowly, in their own terminal (a test's own settings — R8)
    const yes = await w.ok(["allow", "archive", "127.0.0.1", "--way", "slow"], { tty: true });
    assert.match(yes.out, /Zkušební archiv: snímky pomalu, lidským tempem/);
    assert.equal(store(w).pending.filter((p: { kind: string }) => p.kind === "permission").length, 0, "its question gone");
    pauses.length = 0;
    const got = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-2", "--recordset", "B1"]);
    assert.match(got.out, /2 image\(s\) of B0001 \(images 1–2\) fetched and registered/);
    assert.deepEqual(imgHits(a.hits), ["/img/5359/1.jpg", "/img/5359/2.jpg"]);
    // a pause is the pace less the time since the request before it (real time passes, the sleep is the test's): slower
    // than the service's 5 s by far, with room for a slow machine
    assert.ok(pauses.some((ms) => ms >= HUMAN_PACE.minIntervalMs - 3000), `a person's pace between the images: ${pauses.join(", ")}`);
    assert.ok(!pauses.some((ms) => ms > 0 && ms < 5000 - 50), "never faster than the service");
    assert.equal(sha(manifest), before, "connector.json untouched");

    // the person's own pace for the host comes before strom's 10 s (the service's stays the slowest)
    await w.ok(["allow", "host", "127.0.0.1", "--pace", "5", "--per-hour", "120"], { tty: true });
    const consents = await w.ok(["consents", "--json"]);
    const row = consents.json.archives.find((r: { host: string }) => r.host === "127.0.0.1");
    assert.equal(row.level, "restricted");
    assert.equal(row.way, "slow");
    assert.deepEqual(row.pace, { minIntervalMs: 5000, perHour: 120 });
    // an older strom rewriting consents.json loses none of it: the archives are a file of their own (S6)
    await w.ok(["allow", "host", "127.0.0.1", "--revoke"], { tty: true });
    assert.equal(store(w).archives["127.0.0.1"].way, "slow");
    // taken back by the person: asked again at the next need
    await w.ok(["allow", "archive", "zkusebni", "--revoke"], { tty: true });
    assert.equal((await w.run(["fetch", "zkusebni", "5359", "--images", "3", "--recordset", "B1"])).code, 4);
    // the takeover's question asks nothing of a host strom's known terms have: their level is a confirmed one
    assert.equal(store(w).pending.some((p: { kind: string }) => p.kind === "takeover"), true, "kept in the file");
    assert.equal((await w.ok(["allow", "archive", "--json"])).json.pending.some((p: { kind: string }) => p.kind === "takeover"), false, "not asked");
    assert.match((await w.ok(["allow", "archive", "--accept"])).out, /nothing to accept/);
    // the person confirms a connector as it is (an agent cannot)
    assert.equal((await w.run(["allow", "archive", "zkusebni", "--accept"], { env: { CLAUDECODE: "1" } })).code, 4);
    await w.ok(["allow", "archive", "zkusebni", "--accept"], { tty: true });
    assert.equal(store(w).pending.some((p: { kind: string }) => p.kind === "takeover"), false);
    assert.equal(store(w).archives["127.0.0.1"].seen.zkusebni.by, "person");
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("only the person decides: an agent gives no permission, no milder level, no faster pace — a window asks the person, Esc or no answer decides nothing", opts, async () => {
  const w = new World();
  await w.withTree();
  const a = await archive();
  try {
    await fakeConnector(w, "zkusebni", a.base, { automation: "restricted", terms: `${a.base}/terms`, termsSummary: "single images only" });
    await w.ok(["recordset", "add", "Týnec N 1784–1820"]); // B0001
    const agent = { CLAUDECODE: "1" };
    for (const args of [
      ["allow", "archive", "zkusebni", "--way", "slow"],
      ["allow", "archive", "zkusebni", "--level", "allowed"],
      ["allow", "archive", "zkusebni", "--accept"],
      ["allow", "host", "127.0.0.1", "--pace", "1"],
      ["config", "set", "archive.pace", "1 1000"],
    ]) {
      const r = await w.run(args, { env: agent });
      assert.equal(r.code, 4, `${args.join(" ")}: ${r.out}${r.err}`);
    }
    assert.equal(store(w).archives["127.0.0.1"]?.way, undefined);
    // stricter is anybody's, an agent's too
    await w.ok(["allow", "archive", "zkusebni", "--level", "manual"], { env: agent });
    assert.match((await w.run(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1"], { env: agent })).err, /does not allow automated download/);
    await w.ok(["allow", "archive", "zkusebni", "--level", "restricted"], { tty: true }); // milder: the person's

    // a conversation: the window asks the person; no answer (Esc, later, time out) decides nothing — the question waits
    a.hits.length = 0;
    const none = await w.run(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1", "--json"], { env: agent, choice: null });
    assert.equal(none.code, 4, none.out + none.err);
    assert.equal(none.json.asked, "window");
    assert.ok(store(w).pending.find((p: { kind: string }) => p.kind === "permission").window, "the window said");
    assert.equal(store(w).archives["127.0.0.1"].way, undefined, "nothing stored");
    // …and no second window for it: the menu has it
    const again = await w.run(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1", "--json"], { env: agent, choice: "slow" });
    assert.equal(again.code, 4);
    assert.equal(again.json.asked, "menu");
    assert.deepEqual(imgHits(a.hits), []);
    // the person's yes in the window (once the question is new again)
    await w.ok(["allow", "archive", "zkusebni", "--revoke"], { tty: true });
    const s = store(w);
    s.pending = [];
    fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "archives.json"), JSON.stringify(s));
    const yes = await w.ok(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1"], { env: agent, choice: "slow" });
    assert.match(yes.out, /fetched and registered/);
    assert.equal(store(w).archives["127.0.0.1"].by, "window");
    // "by hand only" in the window: kept, the images by hand
    await w.ok(["allow", "archive", "zkusebni", "--revoke"], { tty: true });
    const manual = await w.run(["fetch", "zkusebni", "5359", "--images", "2", "--recordset", "B1"], { env: agent, choice: "manual" });
    assert.equal(manual.code, 2, manual.out + manual.err);
    assert.match(manual.err, /the user chose: images by hand[\s\S]*strom task wait/);
    assert.equal(store(w).archives["127.0.0.1"].way, "manual");
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("a new connector's allowed waits for the person at its first image; the catalogue goes on; a tree's archive of unknown terms asks nothing; a milder reading later is kept as before until accepted", opts, async () => {
  const w = new World();
  await w.withTree();
  const a = await archive();
  try {
    const dir = await fakeConnector(w, "novy", a.base, { automation: "allowed" }, { confirm: false });
    await w.ok(["recordset", "add", "Týnec N 1784–1820", "--url", `${a.base}/book/5359`]); // B0001
    assert.match((await w.ok(["fetch", "novy", "--find", "Týnec"])).out, /5359/);
    const first = await w.run(["fetch", "novy", "5359", "--images", "1", "--recordset", "B1", "--json"]);
    assert.equal(first.code, 4);
    assert.match(first.json.message, /a connector the user has not confirmed yet/);
    assert.match(first.json.message, /nobody has confirmed its connector's reading of the terms yet/);
    assert.doesNotMatch(first.json.message, /its terms restrict/);
    // the person reads it so too: nobody confirmed the downloader's reading — not that the archive's terms restrict
    const said = await w.run(["fetch", "novy", "5359", "--images", "1", "--recordset", "B1"]);
    assert.equal(said.code, 4);
    assert.match(said.err, /čeká na rozhodnutí – čtení podmínek stahovačem zatím nikdo nepotvrdil; z archivu se nic nestahovalo/);
    assert.doesNotMatch(said.err, /podmínky archivu automatické stahování omezují/);
    await w.ok(["allow", "archive", "novy", "--accept"], { tty: true });
    // the tree's archive with terms not known (as the app makes them): no information, no question (S7)
    await w.ok(["repo", "add", "Zkušební archiv", "--url", `${a.base}/`, "--automation", "unknown"]);
    await w.ok(["recordset", "edit", "B1", "--repo", "R0001"]);
    assert.match((await w.ok(["fetch", "novy", "5359", "--images", "1", "--recordset", "B1"])).out, /fetched and registered/);
    assert.deepEqual(store(w).pending, []);
    // the tree's archive recorded as forbidden (by its site): nothing at all, the catalogue neither
    await w.ok(["repo", "edit", "R0001", "--automation", "forbidden"]);
    assert.match((await w.run(["fetch", "novy", "--find", "Týnec"])).err, /R0001 Zkušební archiv is marked automation forbidden in this tree — no requests through a connector/);
    // recorded milder again: the person's word (an agent's edit is refused)
    assert.equal((await w.run(["repo", "edit", "R0001", "--automation", "unknown"], { env: { CLAUDECODE: "1" } })).code, 4);
    // the window says the levels in words, never their codes
    const milder = await w.run(["repo", "edit", "R0001", "--automation", "unknown"], { env: { CLAUDECODE: "1" }, dialog: false });
    assert.match(milder.err, /na „podmínky nejsou známé – snímky jen se svolením“ – mírněji než nynější „žádný automatický přístup/);
    assert.doesNotMatch(milder.err, /„unknown“|„forbidden“/);
    await w.ok(["repo", "edit", "R0001", "--automation", "unknown"], { tty: true });
    // …which strom keeps as the strictest it saw: the person lifts it
    assert.equal((await w.run(["fetch", "novy", "--find", "Týnec"])).code, 2);
    await w.ok(["allow", "archive", "novy", "--level", "allowed"], { tty: true });
    assert.match((await w.ok(["fetch", "novy", "--find", "Týnec"])).out, /5359/);
    // the connector reads its archive stricter: at once; milder again: kept as before, asked
    const manifest = path.join(dir, "connector.json");
    const m = readJsonFile(manifest);
    fs.writeFileSync(manifest, JSON.stringify({ ...m, policy: { ...m.policy, automation: "restricted" } }));
    assert.equal((await w.run(["fetch", "novy", "5359", "--images", "2", "--recordset", "B1"])).code, 4);
    fs.writeFileSync(manifest, JSON.stringify({ ...m, policy: { ...m.policy, automation: "allowed" } }));
    const kept = await w.run(["fetch", "novy", "5359", "--images", "2", "--recordset", "B1", "--json"]);
    assert.equal(kept.code, 4, "kept as before");
    assert.ok(store(w).pending.some((p: { kind: string; to?: string }) => p.kind === "milder" && p.to === "allowed"));
    await w.ok(["allow", "archive", "novy", "--accept"], { tty: true });
    assert.match((await w.ok(["fetch", "novy", "5359", "--images", "2", "--recordset", "B1"])).out, /fetched and registered/);
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("forbidden: nothing goes to the archive but its robots.txt; manual: no image kept by a probe; a pack's level cannot be taken away by a test's own", opts, async () => {
  const w = new World();
  await w.withTree();
  const a = await archive();
  try {
    await fakeConnector(w, "zakaz", a.base, { automation: "forbidden" });
    const dir = pluginDir(w, "zakaz");
    const m = readJsonFile(path.join(dir, "connector.json"));
    fs.writeFileSync(path.join(dir, "connector.json"), JSON.stringify({ ...m, can: ["find", "list"] }));
    a.hits.length = 0;
    assert.match((await w.run(["fetch", "zakaz", "--find", "Týnec"])).err, /allows no automated access at all/);
    assert.match((await w.run(["connector", "test", "zakaz", "--find", "Týnec"])).err, /allows no automated access at all/);
    assert.match((await w.run(["connector", "probe", "zakaz", `${a.base}/book/5359`])).err, /only its \/robots\.txt/);
    assert.deepEqual(a.hits, []);
    await w.run(["connector", "probe", "zakaz", `${a.base}/robots.txt`]);
    assert.deepEqual(a.hits, ["/robots.txt"]);
    // manual: a probe that gets an image does not keep it
    fs.writeFileSync(path.join(dir, "connector.json"), JSON.stringify({ ...m, can: ["find", "list"], policy: { automation: "manual" } }));
    await w.ok(["allow", "archive", "zakaz", "--level", "manual"], { tty: true });
    const probe = await w.ok(["connector", "probe", "zakaz", `${a.base}/img/5359/1.jpg`]);
    assert.match(probe.out, /not kept: an image/);
    assert.ok(!fs.existsSync(path.join(dir, ".test", "probe", "1.jpg")));
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("an agent's settings not the person's stop nothing, give nothing: no permission taken from them, what restricts taken from the person's own too; a folder the person ran strom with is theirs", opts, async () => {
  const w = new World();
  await w.withTree();
  const a = await archive();
  try {
    await fakeConnector(w, "zkusebni", a.base, { automation: "restricted", terms: `${a.base}/terms`, termsSummary: "single images only" });
    await w.ok(["recordset", "add", "Týnec N 1784–1820"]); // B0001
    // the person allows it slowly (their terminal, the test's settings — R8)
    await w.ok(["allow", "archive", "zkusebni", "--way", "slow"], { tty: true });
    // the check as an installation does it: the real home elsewhere, so this test's settings are not its default
    const realHome = path.join(w.dir, "real home");
    const checked = { STROM_TEST_V2: "1", STROM_TEST_REAL_HOME: realHome, STROM_TEST_ANCESTRY: "" };
    const agent = { ...checked, CLAUDECODE: "1" };
    a.hits.length = 0;
    // the catalogue goes on (nothing stops); the images ask again — the permission there is not taken as the person's
    assert.match((await w.ok(["fetch", "zkusebni", "--find", "Týnec"], { env: agent })).out, /5359/);
    const asked = await w.run(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1", "--json"], { env: agent, choice: null });
    assert.equal(asked.code, 4, asked.out + asked.err);
    assert.match(asked.err, /note: this command reads the settings in .* not the person's/);
    assert.deepEqual(imgHits(a.hits), []);
    // an agent seen among the parent processes, without its marks: the same
    const parent = await w.run(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1", "--json"], { env: { ...checked, STROM_TEST_ANCESTRY: "zsh,claude" }, choice: null });
    assert.equal(parent.code, 4, parent.out + parent.err);
    assert.deepEqual(imgHits(a.hits), []);
    // …and it reads the agent's English, not the person's language (the same detection as the settings' check)
    const text = await w.run(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1"], { env: { ...checked, STROM_TEST_ANCESTRY: "zsh,claude" }, choice: null });
    assert.equal(text.code, 4);
    assert.match(text.err, /^error: needs the person's decision for 127\.0\.0\.1/m);
    assert.doesNotMatch(text.err, /chyba:|čeká na rozhodnutí/);
    assert.ok(!fs.existsSync(path.join(realHome, ".config", "strom", "settings-folders.json")), "an agent lists nothing as the person's");
    // the person runs strom with these settings themselves: listed as theirs in their default folder
    await w.ok(["consents"], { env: checked });
    const listed = readJsonFile(path.join(realHome, ".config", "strom", "settings-folders.json")).folders.map((f: { path: string }) => f.path);
    assert.deepEqual(listed, [w.env.STROM_CONFIG_DIR]);
    const got = await w.ok(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1"], { env: agent });
    assert.match(got.out, /fetched and registered/);
    assert.doesNotMatch(got.err, /note:/);
    // what restricts in the person's default folder counts here too: their "by hand", a floor
    const dflt = path.join(realHome, ".config", "strom", "archives.json");
    fs.writeFileSync(dflt, JSON.stringify({ archives: { "127.0.0.1": { floor: "manual", floorBy: "person", floorAt: "" } }, pending: [] }));
    assert.match((await w.run(["fetch", "zkusebni", "5359", "--images", "2", "--recordset", "B1"], { env: agent })).err, /does not allow automated download/);
    fs.writeFileSync(dflt, JSON.stringify({ archives: { "127.0.0.1": { way: "manual" } }, pending: [] }));
    assert.match((await w.run(["fetch", "zkusebni", "5359", "--images", "2", "--recordset", "B1"], { env: agent })).err, /the user chose: images by hand/);
    // a person (no agent) reads their own settings, whatever they are
    fs.rmSync(dflt);
    assert.match((await w.ok(["fetch", "zkusebni", "5359", "--images", "2", "--recordset", "B1"], { env: checked })).out, /fetched and registered/);
  } finally {
    w.cleanup();
    await a.close();
  }
});

test("a person's pace: 10 s and 120 an hour by default, the person's own before it, the service's the slowest; a manifest faster than the person saw counts only once accepted", () => {
  const service = { minIntervalMs: 5000, perHour: 120 };
  assert.deepEqual(hostPace({ recent: [] }, service, HUMAN_PACE), { minIntervalMs: 10_000, perHour: 120 });
  assert.deepEqual(hostPace({ recent: [], own: { minIntervalMs: 5000, perHour: 120, at: "" } }, service, HUMAN_PACE), { minIntervalMs: 5000, perHour: 120 });
  assert.deepEqual(hostPace({ recent: [], own: { minIntervalMs: 1000, at: "" } }, service, HUMAN_PACE), { minIntervalMs: 5000, perHour: 120 }, "never faster than the service");
  assert.deepEqual(hostPace({ recent: [] }, { minIntervalMs: 30_000, perHour: 60 }, HUMAN_PACE), { minIntervalMs: 30_000, perHour: 60 });
  // the latch: the pace the person saw holds while the manifest says a faster one
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "strom-pace-"));
  const env = { STROM_CONFIG_DIR: dir };
  fs.writeFileSync(path.join(dir, "archives.json"), JSON.stringify({ archives: { "archive.example.org": { seen: { c: { level: "restricted", pace: { minIntervalMs: 10_000, perHour: 60 }, at: "", by: "person" } } } }, pending: [] }));
  const c = { name: "c", manifest: { title: "C", hosts: ["archive.example.org"], policy: { automation: "restricted" as const, pace: { minIntervalMs: 2000, perHour: 500 } } } };
  assert.deepEqual(latchedPace(env, c, "archive.example.org"), { minIntervalMs: 10_000, perHour: 60 });
  const slower = { ...c, manifest: { ...c.manifest, policy: { ...c.manifest.policy, pace: { minIntervalMs: 20_000, perHour: 30 } } } };
  assert.deepEqual(latchedPace(env, slower, "archive.example.org"), { minIntervalMs: 20_000, perHour: 30 }, "slower at once");
  // the person's default (archive.pace), and a test's short one only from the sources
  fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ archivePace: "15 90" }));
  assert.deepEqual(humanPace(env, { kind: "installed" }), { minIntervalMs: 15_000, perHour: 90 });
  assert.deepEqual(humanPace({ ...env, STROM_TEST_HUMAN_PACE_MS: "300" }, { kind: "installed" }), { minIntervalMs: 15_000, perHour: 90 }, "not in an installation");
  assert.deepEqual(humanPace({ ...env, STROM_TEST_HUMAN_PACE_MS: "300" }, { kind: "source" }), { minIntervalMs: 300, perHour: 120 });
  fs.rmSync(dir, { recursive: true, force: true });
});

test("levels: one order, unknown as restricted; what each activity may do; a connector names hosts, not addresses", () => {
  assert.equal(strictest("allowed", "unknown"), "unknown");
  assert.equal(strictest("unknown", "restricted"), "restricted");
  assert.equal(strictest("restricted", "manual", "allowed"), "manual");
  assert.equal(strictest(undefined, "forbidden", "manual"), "forbidden");
  assert.deepEqual(allows({ level: "restricted" }, "catalogue"), { ok: true, human: false });
  assert.deepEqual(allows({ level: "restricted" }, "images"), { ok: false, why: "permission", needs: "slow" });
  assert.deepEqual(allows({ level: "unknown", permission: "slow" }, "images"), { ok: true, human: true });
  assert.deepEqual(allows({ level: "restricted", permission: "slow" }, "images", "browser"), { ok: false, why: "permission", needs: "browser" });
  assert.deepEqual(allows({ level: "restricted", permission: "browser" }, "pages"), { ok: true, human: false });
  assert.deepEqual(allows({ level: "manual", permission: "slow" }, "images"), { ok: false, why: "manual" });
  assert.deepEqual(allows({ level: "manual" }, "catalogue"), { ok: true, human: false });
  assert.deepEqual(allows({ level: "forbidden" }, "catalogue"), { ok: false, why: "forbidden" });
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "strom-manifest-"));
  const write = (m: Record<string, unknown>) => fs.writeFileSync(path.join(dir, "connector.json"), JSON.stringify({ interface: 1, title: "T", run: ["node", "c.ts"], can: ["find", "list", "fetch"], policy: { automation: "allowed" }, ...m }));
  write({ hosts: ["127.0.0.1"] });
  assert.throws(() => readManifest(dir, {}), /not addresses/);
  assert.equal(readManifest(dir, { STROM_TEST_HOSTS: "1" }).hosts[0], "127.0.0.1", "a test's own server");
  write({ hosts: ["10.0.0.7"] });
  assert.throws(() => readManifest(dir, { STROM_TEST_HOSTS: "1" }), /not addresses/);
  write({ hosts: ["archive.example.org"], policy: { automation: "restricted" } });
  assert.equal(readManifest(dir, {}).policy.automation, "restricted");
  write({ hosts: ["archive.example.org"], policy: { automation: "manual" } });
  const manual = readManifest(dir, {});
  assert.deepEqual(manual.can, ["find", "list"], "no images through it");
  assert.deepEqual(manual.withheld, ["fetch"]);
  write({ hosts: ["archive.example.org"], policy: { automation: "rude" } });
  assert.throws(() => readManifest(dir, {}), /allowed, restricted, manual, forbidden or unknown/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the window: two or three sentences — the terms with their address, the way at the pace in force, where to change it; Enter the recommended way; later shown again after a day; never in a run", opts, async () => {
  const w = new World();
  await w.withTree();
  const a = await archive();
  try {
    await fakeConnector(w, "zkusebni", a.base, { automation: "allowed" });
    restrictedPack(w);
    await w.ok(["recordset", "add", "Týnec N 1784–1820"]); // B0001
    const agent = { CLAUDECODE: "1" };
    const shown: ChoiceText[] = [];
    const later = (t: ChoiceText) => (shown.push(t), null);
    const fetchOne = (choice: ((t: ChoiceText) => string | null) | string | null, env: Record<string, string> = agent) => w.run(["fetch", "zkusebni", "5359", "--images", "1", "--recordset", "B1", "--json"], { env, choice });
    assert.equal((await fetchOne(later)).code, 4);
    assert.equal(shown.length, 1);
    assert.equal(shown[0]!.question, "Zkušební archiv omezuje ve svých podmínkách automatické ukládání snímků (https://archive.example.org/napoveda).\n\nStahovat pomalu, jeden snímek za 10 s, jen co úkol potřebuje? Změnit: nastavení → Archivy.");
    assert.deepEqual(shown[0]!.choices.map((c) => c.key), ["slow", "manual"], "the recommended way first: Enter takes it");
    assert.equal(shown[0]!.later, "Později");
    assert.equal(store(w).archives["127.0.0.1"]?.way, undefined, "later: nothing stored");
    // within a day: no other window — the question waits in the menu
    assert.equal((await fetchOne(later)).json.asked, "menu");
    assert.equal(shown.length, 1);
    // a day later: the window again, with the person's own pace for the host
    await w.ok(["allow", "host", "127.0.0.1", "--pace", "5", "--per-hour", "120"], { tty: true });
    const dayLater = () => {
      const s = store(w);
      for (const p of s.pending) if (p.window) p.window = new Date(Date.now() - 25 * 3600_000).toISOString();
      fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "archives.json"), JSON.stringify(s));
    };
    dayLater();
    // …never in a run nobody watches
    assert.equal((await fetchOne(later, { ...agent, STROM_NONINTERACTIVE: "1", STROM_SESSION: "N0001" })).code, 4);
    assert.equal(shown.length, 1, "no window in a run");
    assert.equal((await fetchOne(later)).json.asked, "window");
    assert.equal(shown.length, 2);
    assert.match(shown[1]!.question, /jeden snímek za 5 s/);
    // Enter: the recommended way
    dayLater();
    const yes = await fetchOne((t) => (shown.push(t), t.choices[0]!.key));
    assert.equal(yes.code, 0, yes.out + yes.err);
    assert.equal(store(w).archives["127.0.0.1"].way, "slow");
  } finally {
    w.cleanup();
    await a.close();
  }
});
