// The name of a person's identity verified and confirmed as a fact (spec 066 P5, the app's ZADANI_VYZKUM_stav-jmena.md
// and ZADANI_DEV_stav-jmena.md): its id P0012.N — strom verify confirm P….N (the person's, the status as it is, tasks
// of verification leave it, --txt the mark of the name seen), a birth's or baptism's task of verification takes the
// name citing the same original along (never one confirmed, proven or of another record), strom verify facts --fact
// P….N, strom verify done P….N, _STROM_VERIFY under NAME, the bridge's /facts/confirm and /verify with the name's id,
// the feature name-status behind APP_READS_NAME_STATUS, and the tree sent back unedited after a confirmation.
// Made-up people (Lhoták, Lhota), a name typed in NFD as on a Mac, a place in Cyrillic.

import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { bridgeFeatures } from "../../src/core/live.ts";
import { verifyMarks } from "../../src/core/verify.ts";
import { nameMark } from "../../src/core/readers.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { planSync, readGedcom } from "../../src/core/sync.ts";
import type { Name, Person, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const bridgeOpts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const AGENT = { CLAUDECODE: "1" };
const APP = { STROM_FOR_APP: "1" };
const ORIGIN = "https://beta.stromapp.info";

const open = (w: World) => Tree.open(w.cwd, w.env);
const nameOf = (w: World, id: string): Name => open(w).get<Person>(id)!.names[0]!;
const verifyTasks = (w: World) => open(w).list<Task>("task").filter((t) => t.origin?.startsWith("verify:"));
const commits = (w: World) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim());
const gitHead = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();

async function add(w: World, owner: string, kind: string, ...more: string[]): Promise<string> {
  return (await w.ok(["event", "add", owner, kind, ...more, "--json"])).json.event.id as string;
}

/**
 * The ancestors of Jan Lhoták (G0001): Jan (P1), his parents Josef (P2, his name typed in NFD) and Marie (P3), Josef's
 * father Václav (P4). The registers of Lhota (B0001), each baptism an original with primary information; each name
 * cites a record as the research read it: Josef's and Jan's their baptism, Václav's his baptism proven, Marie's her
 * marriage (not her baptism).
 */
async function lhotaci() {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Josef /Lhoták/".normalize("NFD"), "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P3
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]); // P4
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]); // F1
  await w.ok(["family", "add", "--partner", "P4", "--child", "P2"]); // F2
  await w.ok(["repo", "add", "Archiv Lhota", "--automation", "manual"]);
  await w.ok(["recordset", "add", "Lhota 1, N O Z 1800-1910", "--repo", "R1", "--kinds", "baptism,marriage,death", "--places", "Lhota", "--years", "1800-1910", "--access", "online-free"]); // B1
  const original = (title: string, kind: string) => ["source", "add", title, "--kind", kind, "--recordset", "B0001", "--locator", "fol. 1", "--information", "primary"];
  await w.ok(original("Křest Josefa Lhotáka 1850", "baptism")); // S1
  await w.ok(original("Oddavky Josefa a Marie 1875", "marriage")); // S2
  await w.ok(original("Křest Marie Lhotové 1852", "baptism")); // S3
  await w.ok(original("Křest Jana Lhotáka 1880", "baptism")); // S4
  await w.ok(original("Křest Václava Lhotáka 1820", "baptism")); // S5
  const cite = (s: string) => ["--cite", s, "--locator", "fol. 1"];
  const f = {
    janBirth: await add(w, "P1", "BIRT", "--date", "1880", "--place", "Lhota", ...cite("S0004")),
    josefBirth: await add(w, "P2", "BIRT", "--date", "1850", "--place", "Лхота", ...cite("S0001")),
    marieBirth: await add(w, "P3", "BIRT", "--date", "1852", "--place", "Lhota", ...cite("S0003")),
    vaclavBirth: await add(w, "P4", "CHR", "--date", "1820", "--place", "Lhota", ...cite("S0005")),
  };
  await w.ok(["cite", "P0001", "S0004", "--locator", "fol. 1", "--quote", "Joannes Lhoták"], { env: AGENT });
  await w.ok(["cite", "P0002", "S0001", "--locator", "fol. 1", "--quote", "Josephus Lhoták".normalize("NFD")], { env: AGENT });
  await w.ok(["cite", "P0003", "S0002", "--locator", "fol. 1", "--quote", "Maria Lhotová"], { env: AGENT });
  await w.ok(["cite", "P0004", "S0005", "--locator", "fol. 1", "--quote", "Wenceslaus Lhoták", "--status", "proven"], { env: AGENT });
  return { w, f };
}

test("strom verify confirm P….N: the person's — the status as it is, tasks leave it, the same again nothing, --undo, --txt of a name changed since refused", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    assert.equal(nameOf(w, "P0002").status, "probable", "a name citing a record of the research's");
    const asked = (await w.ok(["verify", "facts", "--fact", f.josefBirth, "--json"])).json;
    assert.deepEqual(asked.facts.map((x: { fact: string }) => x.fact), ["P0002.N", f.josefBirth], "the name read with its baptism");
    const task = verifyTasks(w).find((t) => t.where.includes(f.josefBirth))!;
    assert.ok(task.where.includes("P0002.N"), task.where.join(" "));

    // an agent never confirms
    assert.notEqual((await w.run(["verify", "confirm", "P0002.N"], { env: AGENT })).code, 0);
    assert.equal(nameOf(w, "P0002").confirmed, undefined);

    // the mark of a name the person saw before it changed: refused, nothing written
    const seen = nameMark(nameOf(w, "P0002"));
    await w.ok(["person", "edit", "P0002", "--name", "Josef Václav /Lhoták/", "--reason", "zápis: Josephus Wenceslaus"], { env: AGENT });
    const before = commits(w);
    const stale = await w.run(["verify", "confirm", "p2.n", "--txt", seen, "--json"], { env: APP });
    assert.notEqual(stale.code, 0);
    assert.match(stale.out + stale.err, /confirm\.changed/u);
    assert.match(stale.out + stale.err, /Josef Václav/u);
    assert.equal(commits(w), before, "nothing written");

    const status = nameOf(w, "P0002").status;
    const r = (await w.ok(["verify", "confirm", "P0002.N", "--txt", nameMark(nameOf(w, "P0002")), "--json"], { env: APP })).json.results[0];
    assert.deepEqual([r.fact, r.owner], ["P0002.N", "P0002"]);
    const n = nameOf(w, "P0002");
    assert.equal(n.confirmed?.by, "user");
    assert.equal(n.status, status, "the status as it is");
    const left = open(w).get<Task>(task.id)!;
    assert.ok(!left.where.includes("P0002.N"), "the task left the name");
    assert.ok(left.where.includes(f.josefBirth));
    const at = commits(w);
    assert.equal((await w.ok(["verify", "confirm", "P0002.N", "--json"], { env: APP })).json.results[0].same, true);
    assert.equal(commits(w), at, "the same again: nothing written");
    // a confirmed name is the person's: not verified by an agent
    const s = (await w.ok(["session", "start", task.id, "--json"])).json.session.id as string;
    const done = await w.run(["verify", "done", "P0002.N", "--kept", "--reason", "nejisté", "--json"], { env: { STROM_SESSION: s } });
    assert.notEqual(done.code, 0);
    assert.match(done.out + done.err, /verify\.confirmed/u);
    await w.ok(["session", "close", "--summary", "nic", "--next", "nic", "--continue"], { env: { STROM_SESSION: s } });

    await w.ok(["verify", "confirm", "P0002.N", "--undo"], { env: APP });
    assert.equal(nameOf(w, "P0002").confirmed, undefined, "taken back");
    assert.equal(nameOf(w, "P0002").status, status);
    // no such person, no such name
    const unknown = await w.run(["verify", "confirm", "P0099.N", "--json"], { env: APP });
    assert.notEqual(unknown.code, 0);
    assert.match(unknown.out + unknown.err, /factconfirm\.unknown/u);
  } finally {
    w.cleanup();
  }
});

test("a baptism's task of verification takes its name along — never a name confirmed, proven, or citing another record; verify done P….N proven by a look, kept with a reason; _STROM_VERIFY under NAME", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    await w.ok(["verify", "confirm", "P0001.N"], { env: APP });
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    const tasks = verifyTasks(w).filter((t) => t.origin === "verify:auto");
    const of = (fact: string) => tasks.find((t) => t.where.includes(fact));
    assert.ok(of(f.josefBirth)?.where.includes("P0002.N"), "Josef's name: his baptism's record");
    assert.ok(!of(f.janBirth)?.where.includes("P0001.N"), "Jan's name: confirmed by the person");
    assert.ok(!of(f.marieBirth)?.where.includes("P0003.N"), "Marie's name: cites her marriage");
    assert.ok(!tasks.some((t) => t.where.includes("P0004.N")), "Václav's name: proven");
    assert.equal(tasks.filter((t) => t.where.includes("P0002.N")).length, 1, "once");

    // the brief lists the name and says how to compare it
    const josef = of(f.josefBirth)!;
    const brief = (await w.ok(["brief", josef.id], { env: AGENT })).out;
    assert.match(brief, /P0002\.N NAME "Josef Lhoták" \[probable\]/u, brief);
    assert.match(brief, /strom verify done P0002\.N --proven --image/u);
    assert.match(brief, /Latin/u);

    // the Strom file: the name waits for its verification, under its NAME
    const ged = exportGedcom(open(w), { for: "strom", factStatus: true, verify: verifyMarks(open(w)), nameStatus: true }).text;
    assert.match(ged, /2 _STROM_EID P0002\.N\n3 _TXT [0-9a-f]{16}\n2 _STROM_VERIFY (?:images|wait\n3 _POS \d+)\n/u, ged);
    assert.doesNotMatch(ged, /_STROM_EID P0003\.N\n3 _TXT [0-9a-f]{16}\n2 _STROM_VERIFY/u);
    const closed = exportGedcom(open(w), { for: "strom", factStatus: true, verify: verifyMarks(open(w)), nameStatus: false }).text;
    assert.doesNotMatch(closed, /P0002\.N/u, "behind the gate: nothing under NAME");

    // the agent's result
    const s = (await w.ok(["session", "start", josef.id, "--json"], { env: { STROM_MODEL: "claude-opus-x" } })).json.session.id as string;
    const inSession = { STROM_SESSION: s, STROM_MODEL: "claude-opus-x" };
    const kept = await w.run(["verify", "done", "P0002.N", "--kept", "--json"], { env: inSession });
    assert.notEqual(kept.code, 0);
    assert.match(kept.out + kept.err, /verify\.reason/u);
    const noLook = await w.run(["verify", "done", "P0002.N", "--proven", "--json"], { env: inSession });
    assert.match(noLook.out + noLook.err, /verify\.image/u);
    const done = (await w.ok(["verify", "done", "P0002.N", "--proven", "--image", "B0001:3", "--json"], { env: inSession })).json.results[0];
    assert.deepEqual([done.fact, done.owner, done.result, done.status], ["P0002.N", "P0002", "proven", "proven"]);
    const n = nameOf(w, "P0002");
    assert.equal(n.status, "proven");
    assert.deepEqual([n.verified?.result, n.verified?.model, n.verified?.task], ["proven", "claude-opus-x", josef.id]);
    assert.deepEqual([n.given, n.surname], ["Josef", "Lhoták"], "the name itself never changed");
    assert.equal(open(w).get<Task>(josef.id)!.state, "doing", "the baptism still to do");
    await w.ok(["verify", "done", f.josefBirth, "--proven", "--image", "B0001:3"], { env: inSession });
    assert.equal(open(w).get<Task>(josef.id)!.state, "done");
    const after = exportGedcom(open(w), { for: "strom", factStatus: true, verify: verifyMarks(open(w)), nameStatus: true }).text;
    assert.match(after, /2 _STROM_EID P0002\.N\n3 _TXT [0-9a-f]{16}\n2 _STROM_CHECKED proven\n/u, after);
  } finally {
    w.cleanup();
  }
});

test("strom verify facts <person> and verify bulk take the name along with its baptism, as the sweep does", opts, async () => {
  const { w, f } = await lhotaci();
  try {
    const facts = async (who: string) => ((await w.ok(["verify", "facts", who, "--dry-run", "--json"])).json.facts as { fact: string }[]).map((x) => x.fact);
    assert.deepEqual(await facts("P0002"), ["P0002.N", f.josefBirth]);
    assert.deepEqual(await facts("P0003"), [f.marieBirth], "her name cites her marriage");
    assert.deepEqual(await facts("P0004"), [f.vaclavBirth], "his name proven");
    const r = (await w.ok(["verify", "bulk", "--scope", "tree", "--json"], { tty: true })).json;
    assert.ok(r.tasks.length >= 1, JSON.stringify(r));
    const made = verifyTasks(w).filter((t) => t.origin === "verify:bulk");
    const of = (fact: string) => made.find((t) => t.where.includes(fact));
    assert.ok(of(f.josefBirth)?.where.includes("P0002.N"));
    assert.ok(of(f.janBirth)?.where.includes("P0001.N"));
    assert.ok(!made.some((t) => t.where.includes("P0003.N") || t.where.includes("P0004.N")));
  } finally {
    w.cleanup();
  }
});

test("the feature name-status: only for an app of APP_READS_NAME_STATUS (its beta's for another copy), in an archive too", () => {
  const prod = new Settings({ STROM_APP_URL: "https://stromapp.info/run/" }, {});
  const beta = new Settings({ STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
  assert.ok(!bridgeFeatures(prod, "3.40.0").includes("name-status"), "no gate set: not offered");
  assert.ok(bridgeFeatures(prod, "3.40.0", undefined, undefined, "3.32.0", "3.32.0-beta.1").includes("name-status"));
  assert.ok(!bridgeFeatures(prod, "3.31.0", undefined, undefined, "3.32.0", "3.32.0-beta.1").includes("name-status"));
  assert.ok(!bridgeFeatures(prod, undefined, undefined, undefined, "3.32.0", "3.32.0-beta.1").includes("name-status"), "an app of unknown version");
  assert.ok(bridgeFeatures(beta, "3.32.0-beta.2", undefined, undefined, "3.32.0", "3.32.0-beta.1").includes("name-status"));
  assert.ok(!bridgeFeatures(prod, "3.40.0", undefined, undefined, "", "").includes("name-status"));
});

interface Answer {
  status: number;
  body: any;
}

function request(url: string, method = "GET", body?: unknown, headers: Record<string, string> = { Origin: ORIGIN }): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(JSON.stringify(body), "utf8");
    const req = http.request(url, { agent: false, method, headers: { ...headers, ...(data ? { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": String(data.length) } : {}) } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let parsed: any = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });
    });
    req.on("error", reject);
    req.end(data);
  });
}

test("the bridge: /facts/confirm and /verify with the name's id — 200, 409 changed, 404, 400; the tree sent back unedited after a confirmation changes nothing", bridgeOpts, async () => {
  const { w, f } = await lhotaci();
  Object.assign(w.env, { STROM_LOCK_WAIT_MS: "1500", STROM_APP_URL: "https://beta.stromapp.info/run/" });
  let started = false;
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    started = true;
    const post = (what: string, body: unknown) => request(`${info.url}/${what}`, "POST", body);

    // /verify: the name asked for alone brings its baptism along, the name first
    const dry = await post("verify", { fact: "P0002.N", dry: true });
    assert.equal(dry.status, 200, JSON.stringify(dry.body));
    assert.deepEqual(
      dry.body.facts.map((x: { fact: string; kind: string; how: string; with?: string }) => [x.fact, x.kind, x.how, x.with]),
      [
        ["P0002.N", "NAME", "read", f.josefBirth],
        [f.josefBirth, "BIRT", "read", "P0002.N"],
      ],
    );
    assert.equal(dry.body.head, dry.body.parent, "dry: nothing written");
    for (const bad of [{ fact: "P0002" }, { fact: "P0002.X" }, { fact: "N0002" }]) {
      const r = await post("verify", bad);
      assert.deepEqual([r.status, r.body.code], [400, "verify.invalid"], JSON.stringify(bad));
    }

    // /facts/confirm
    for (const bad of [{ fact: "P0002", confirm: true }, { fact: "P0002.n.x", confirm: true }, { fact: "Ж0002.N", confirm: true }, { fact: "P0002.N", confirm: "yes" }, { fact: "P0002.N", confirm: true, txt: "x" }]) {
      const r = await post("facts/confirm", bad);
      assert.deepEqual([r.status, r.body.code], [400, "factconfirm.invalid"], JSON.stringify(bad));
    }
    const unknown = await post("facts/confirm", { fact: "P0099.N", confirm: true });
    assert.deepEqual([unknown.status, unknown.body.code], [404, "factconfirm.unknown"]);
    const changed = await post("facts/confirm", { fact: "P0002.N", confirm: true, txt: "0000000000000000" });
    assert.deepEqual([changed.status, changed.body.code, changed.body.txt], [409, "confirm.changed", nameMark(nameOf(w, "P0002"))]);
    assert.deepEqual(changed.body.now, { given: "Josef", surname: "Lhoták" });
    assert.equal(nameOf(w, "P0002").confirmed, undefined, "nothing written");
    const ok = await post("facts/confirm", { fact: "p2.n", confirm: true, txt: nameMark(nameOf(w, "P0002")) });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.deepEqual([ok.body.ok, ok.body.fact, ok.body.owner, typeof ok.body.confirmed], [true, "P0002.N", "P0002", "string"]);
    assert.notEqual(ok.body.head, ok.body.parent);
    assert.equal(nameOf(w, "P0002").confirmed?.by, "user");
    const again = await post("facts/confirm", { fact: "P0002.N", confirm: true });
    assert.deepEqual([again.status, again.body.head], [200, again.body.parent], "the same again: nothing written");

    // the tree as the app of the gate has it, sent back unedited: no change
    const text = exportGedcom(open(w), { for: "strom", head: gitHead(w), factStatus: true, verify: verifyMarks(open(w)), nameStatus: true, origins: true }).text.replace(/^1 SOUR STROM_RESEARCH\n2 VERS .*\n/mu, "1 SOUR STROM\n2 VERS 3.32.0\n");
    assert.match(text, /2 _STROM_EID P0002\.N\n3 _TXT [0-9a-f]{16}\n2 _STROM_CONFIRMED /u);
    assert.deepEqual(planSync(open(w), readGedcom(text), "conflict", { readsNameStatus: true }).changes, []);

    const undo = await post("facts/confirm", { fact: "P0002.N", confirm: false });
    assert.equal(undo.status, 200, JSON.stringify(undo.body));
    assert.equal(undo.body.confirmed, undefined);
    assert.equal(nameOf(w, "P0002").confirmed, undefined);
  } finally {
    if (started) await w.run(["live", "stop"]);
    w.cleanup();
  }
});
