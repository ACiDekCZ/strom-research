// The verification of facts against their originals through the Strom app's bridge (spec 065; the app's
// ZADANI_VYZKUM_spolehlivost.md, "Odpověď výzkumu" and "Odpověď výzkumu na Dotazy"): POST /verify (dry, the record of
// each fact, the place in the queue), /verify/bulk, /verify/stop (strom verify stop), /facts/confirm, /status verify and
// the features — each refusal, the research busy, an archive (the person's confirmation works there, nothing else).
// Made-up people (Lhoták, Lhota), diacritics in NFD as typed on a Mac.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import { verifyCandidates } from "../../src/core/verify.ts";
import { encodeImage } from "../../src/image/index.ts";
import type { Event, Family, Person, Task } from "../../src/core/model.ts";

const bridgeOpts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const ORIGIN = "https://beta.stromapp.info";

const open = (w: World) => Tree.open(w.cwd, w.env);
const fact = (w: World, id: string): Event => {
  const tree = open(w);
  for (const o of [...tree.list<Person>("person"), ...tree.list<Family>("family")]) {
    const e = o.events.find((x) => x.id === id);
    if (e) return e;
  }
  throw new Error(`no fact ${id}`);
};
const verifyTasks = (w: World) => open(w).list<Task>("task").filter((t) => t.level === "verify");

async function add(w: World, owner: string, kind: string, ...more: string[]): Promise<string> {
  return (await w.ok(["event", "add", owner, kind, ...more, "--json"])).json.event.id as string;
}

/** Jan Lhoták (P1), his parents Josef (P2) and Marie (P3) in F1, Petr (P4, born 1990); the registers of Lhota with scans. */
async function lhotaci() {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Josef /Lhoták/".normalize("NFD"), "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]); // F1
  await w.ok(["person", "add", "Petr /Lhoták/", "--sex", "M"]); // P4
  await w.ok(["repo", "add", "Archiv Lhota", "--automation", "manual"]);
  await w.ok(["recordset", "add", "Lhota 1, N O Z 1840-1910", "--repo", "R1", "--kinds", "baptism,marriage,death", "--places", "Lhota", "--years", "1840-1910", "--access", "online-free"]);
  const original = (title: string, kind: string) => ["source", "add", title, "--kind", kind, "--recordset", "B0001", "--locator", "fol. 1", "--information", "primary"];
  await w.ok(original("Křest Josefa Lhotáka 1850".normalize("NFD"), "baptism")); // S1
  await w.ok(original("Úmrtí Josefa Lhotáka 1910", "death")); // S2
  await w.ok(original("Oddavky Josefa a Marie 1875", "marriage")); // S3
  await w.ok(["source", "add", "Index křtů Lhota", "--kind", "index", "--information", "primary"]); // S4, no original
  const cite = (s: string) => ["--cite", s, "--locator", "fol. 1"];
  const f = {
    josefBirth: await add(w, "P2", "BIRT", "--date", "1850", "--place", "Lhota", ...cite("S0001")),
    josefDeath: await add(w, "P2", "DEAT", "--date", "1910", "--place", "Лхота", ...cite("S0002")),
    marriage: await add(w, "F1", "MARR", "--date", "1875", "--place", "Lhota", ...cite("S0003")),
    janBirth: await add(w, "P1", "BIRT", "--date", "1880", "--place", "Lhota", "--cite", "S0004"),
    petrBirth: await add(w, "P4", "BIRT", "--date", "1990", "--place", "Lhota", "--cite", "S0004"),
  };
  const dir = fs.mkdtempSync(path.join(w.dir, "skeny-"));
  for (let i = 0; i < 3; i++) fs.writeFileSync(path.join(dir, `s000${i + 1}.jpg`), encodeImage({ width: 300, height: 400, channels: 1, data: new Uint8Array(300 * 400).fill(180) }, "jpeg"));
  await w.ok(["media", "add", dir, "--recordset", "B0001"]);
  return { w, f };
}

interface Answer {
  status: number;
  body: any;
  headers: http.IncomingHttpHeaders;
}

function request(url: string, method = "GET", body?: unknown, headers: Record<string, string> = { Origin: ORIGIN }): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf8");
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
        resolve({ status: res.statusCode ?? 0, body: parsed, headers: res.headers });
      });
    });
    req.on("error", reject);
    req.end(data);
  });
}

test("the bridge: /verify (dry, records, the place in the queue), /verify/bulk, /verify/stop, /facts/confirm, /status verify — each refusal, busy, an archive", bridgeOpts, async () => {
  const { w, f } = await lhotaci();
  Object.assign(w.env, { STROM_LOCK_WAIT_MS: "1500", STROM_APP_URL: "https://beta.stromapp.info/run/" });
  let started = false;
  try {
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    started = true;
    const post = (what: string, body: unknown) => request(`${info.url}/${what}`, "POST", body);

    // the features, appended (nothing taken away), and the counts
    const at = BRIDGE_FEATURES.indexOf("verify");
    assert.deepEqual(BRIDGE_FEATURES.slice(at, at + 4), ["verify", "verify.bulk", "facts.confirm", "verify.stop"]);
    const st = (await request(`${info.url}/status`)).body;
    for (const x of ["verify", "verify.bulk", "facts.confirm", "verify.stop"]) assert.ok(st.features.includes(x), x);
    assert.deepEqual(st.verify, { waiting: 0, asked: 0, images: 0, permission: 0, kept: 0, confirmed: 0 });

    // only the app's page writes
    for (const what of ["verify", "verify/bulk", "verify/stop", "facts/confirm"]) {
      const r = await request(`${info.url}/${what}`, "POST", {}, {});
      assert.deepEqual([r.status, r.body.code], [403, "app.only"], what);
    }

    // —— /verify/bulk ——
    for (const bad of [{}, { scope: "branch" }, { scope: "tree", try: 0 }, { scope: "tree", try: 1.5 }, { scope: "tree", budget: -1 }, { scope: "tree", order: "newest" }, { scope: "line", of: "S0001" }, { scope: "tree", dry: "yes" }, { scope: "tree", at: 1 }, "x"]) {
      const r = await post("verify/bulk", bad);
      assert.deepEqual([r.status, r.body.code], [400, "verify.invalid"], JSON.stringify(bad));
    }
    const noLine = await post("verify/bulk", { scope: "line", of: "G0099" });
    assert.deepEqual([noLine.status, noLine.body.code], [404, "verify.unknown"]);
    const bulkDry = await post("verify/bulk", { scope: "tree", dry: true });
    assert.equal(bulkDry.status, 200, JSON.stringify(bulkDry.body));
    assert.equal(bulkDry.body.ok, true);
    assert.deepEqual([bulkDry.body.people, bulkDry.body.facts, bulkDry.body.left], [1, 3, 0], "Josef with his marriage (Jan's birth cites no original, Petr is alive)");
    assert.deepEqual(bulkDry.body.how, { read: 3, search: 0 }, "each read against its original; no family tree imported, nothing looked for");
    assert.equal(bulkDry.body.tasks, undefined, "a dry run: no tasks");
    assert.equal(bulkDry.body.head, bulkDry.body.parent, "nothing written");
    assert.equal(typeof bulkDry.body.estimate.sessions, "number");
    assert.equal(verifyTasks(w).length, 0);
    const bulk = await post("verify/bulk", { scope: "tree", order: "weakest", try: 1 });
    assert.equal(bulk.status, 200, JSON.stringify(bulk.body));
    assert.equal(bulk.body.people, 1);
    assert.ok(bulk.body.tasks.length >= 1 && bulk.body.left === 0, JSON.stringify(bulk.body));
    assert.notEqual(bulk.body.head, bulk.body.parent);
    assert.ok(verifyTasks(w).every((t) => t.origin === "verify:bulk" && t.state === "open"));

    // —— /verify/stop: the bulk's tasks dropped, their facts not queued again by themselves ——
    for (const bad of [{ scope: "some" }, { bulk: true }]) assert.deepEqual([(await post("verify/stop", bad)).status], [400], JSON.stringify(bad));
    const held = verifyTasks(w).flatMap((t) => t.where);
    const stop = await post("verify/stop", { scope: "bulk" });
    assert.equal(stop.status, 200, JSON.stringify(stop.body));
    assert.deepEqual([stop.body.ok, stop.body.dropped, stop.body.facts], [true, bulk.body.tasks.length, held.length]);
    assert.notEqual(stop.body.head, stop.body.parent);
    assert.ok(verifyTasks(w).every((t) => t.state === "dropped"));
    const candidates = verifyCandidates(open(w)).map((i) => i.event);
    for (const id of held) assert.ok(!candidates.includes(id), `${id} not queued again by the sweep`);
    const none = await post("verify/stop", {});
    assert.deepEqual([none.status, none.body.dropped, none.body.facts, none.body.head === none.body.parent], [200, 0, 0, true]);

    // —— /verify ——
    for (const bad of [{}, { person: "S0001" }, { person: "P0001", fact: f.janBirth }, { family: "P0001" }, { fact: "E1x" }, { person: "P0001", dry: "yes" }, { dry: true }, { person: 1 }, "x"]) {
      const r = await post("verify", bad);
      assert.deepEqual([r.status, r.body.code], [400, "verify.invalid"], JSON.stringify(bad));
    }
    for (const unknown of [{ person: "P0099" }, { family: "F0099" }, { fact: "E0999" }]) {
      const r = await post("verify", unknown);
      assert.deepEqual([r.status, r.body.code], [404, "verify.unknown"], JSON.stringify(unknown));
    }
    // dry: the records, nothing written
    const dry = await post("verify", { person: "P0002", dry: true });
    assert.equal(dry.status, 200, JSON.stringify(dry.body));
    assert.equal(dry.body.task, null);
    assert.equal(dry.body.position, undefined);
    assert.equal(dry.body.head, dry.body.parent);
    const birth = dry.body.facts.find((x: { fact: string }) => x.fact === f.josefBirth);
    assert.deepEqual(birth, { fact: f.josefBirth, kind: "BIRT", how: "read", record: { source: "S0001", title: "Křest Josefa Lhotáka 1850".normalize("NFC"), page: "fol. 1" } });
    assert.equal(dry.body.facts.length, 3, "his own and his marriage's");
    const search = await post("verify", { fact: f.janBirth.toLowerCase(), dry: true });
    assert.equal(search.status, 200, JSON.stringify(search.body));
    assert.deepEqual(search.body.facts, [{ fact: f.janBirth, kind: "BIRT", how: "search", record: { source: "S0004", title: "Index křtů Lhota" } }]);
    assert.equal(verifyTasks(w).filter((t) => t.state === "open").length, 0);
    // someone most likely alive: the person asks, so it goes
    const alive = await post("verify", { person: "P0004", dry: true });
    assert.equal(alive.status, 200, JSON.stringify(alive.body));
    // asked: first in the queue, with its place
    const asked = await post("verify", { person: "P0002" });
    assert.equal(asked.status, 200, JSON.stringify(asked.body));
    assert.match(asked.body.task, /^T\d+$/u);
    assert.equal(asked.body.position, 1);
    assert.notEqual(asked.body.head, asked.body.parent);
    // a person with a marriage: two tasks, his own and the family's, in the queue's order, the first on top (Dotazy 2
    // of the app, 1–2) — as the Strom file's 3 _POS says them
    assert.equal(asked.body.state, "asked");
    assert.equal(asked.body.tasks.length, 2, JSON.stringify(asked.body.tasks));
    assert.deepEqual(asked.body.tasks.map((t: { state: string; position: number }) => [t.state, t.position]), [["asked", 1], ["asked", 2]]);
    assert.equal(asked.body.tasks[0].task, asked.body.task);
    const ofTask = (id: string) => open(w).get<Task>(id)!;
    assert.deepEqual(asked.body.tasks.map((t: { task: string }) => ofTask(t.task).subject[0]).sort(), ["F0001", "P0002"]);
    const byFamily = asked.body.tasks.find((t: { task: string }) => ofTask(t.task).subject[0] === "F0001");
    assert.deepEqual(byFamily.facts, [f.marriage]);
    const ged = path.join(w.dir, "pos.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--out", ged], { env: { STROM_APP_VERSION: "3.26.0-beta.2" } });
    const pos = fs.readFileSync(ged, "utf8").replace(/\r\n?/g, "\n");
    assert.ok(pos.includes(`2 _STROM_EID ${f.marriage}\n`), "the file says the marriage's ID");
    assert.match(pos.slice(pos.indexOf(`2 _STROM_EID ${f.marriage}\n`)).split(/\n1 /u)[0]!, new RegExp(`2 _STROM_VERIFY asked\n3 _POS ${byFamily.position}\n`, "u"));
    const made = open(w).get<Task>(asked.body.task)!;
    assert.equal(made.origin, "verify:asked");
    const count = verifyTasks(w).filter((t) => t.state === "open").length;
    const again = await post("verify", { fact: f.josefBirth });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.equal(again.body.task, asked.body.task, "the task holding it first, nothing doubled");
    assert.equal(verifyTasks(w).filter((t) => t.state === "open").length, count);
    assert.equal((await request(`${info.url}/status`)).body.verify.asked, 3);

    // —— /facts/confirm ——
    for (const bad of [{}, { fact: f.marriage }, { fact: "X1", confirm: true }, { fact: f.marriage, confirm: "yes" }, { fact: f.marriage, confirm: true, at: 1 }, "x"]) {
      const r = await post("facts/confirm", bad);
      assert.deepEqual([r.status, r.body.code], [400, "factconfirm.invalid"], JSON.stringify(bad));
    }
    const noFact = await post("facts/confirm", { fact: "E0999", confirm: true });
    assert.deepEqual([noFact.status, noFact.body.code], [404, "factconfirm.unknown"]);
    const conf = await post("facts/confirm", { fact: f.marriage, confirm: true });
    assert.equal(conf.status, 200, JSON.stringify(conf.body));
    assert.deepEqual([conf.body.ok, conf.body.fact, conf.body.owner, conf.body.confirmed], [true, f.marriage, "F0001", new Date().toISOString().slice(0, 10)]);
    assert.notEqual(conf.body.head, conf.body.parent);
    assert.equal(fact(w, f.marriage).confirmed?.by, "user");
    const same = await post("facts/confirm", { fact: f.marriage, confirm: true });
    assert.deepEqual([same.status, same.body.head === same.body.parent], [200, true], "the same state: nothing written");
    // the family's one fact confirmed: nothing left to verify
    const nothing = await post("verify", { family: "F0001" });
    assert.deepEqual([nothing.status, nothing.body.code], [409, "verify.nothing"]);
    const back = await post("facts/confirm", { fact: f.marriage, confirm: false });
    assert.equal(back.status, 200, JSON.stringify(back.body));
    assert.equal(back.body.confirmed, undefined);
    assert.equal(fact(w, f.marriage).confirmed, undefined);
    await w.ok(["event", "retract", f.josefDeath, "--reason", "omyl"], { tty: true });
    const gone = await post("facts/confirm", { fact: f.josefDeath, confirm: true });
    assert.deepEqual([gone.status, gone.body.code], [409, "factconfirm.retracted"]);
    const goneV = await post("verify", { fact: f.josefDeath });
    assert.deepEqual([goneV.status, goneV.body.code], [409, "verify.retracted"]);

    // the research held by another strom: busy, nothing written
    const lock = path.join(w.cwd, ".strom", "tree.lock");
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "a test" }));
    for (const [what, body] of [["verify", { person: "P0001" }], ["verify/stop", {}], ["facts/confirm", { fact: f.josefBirth, confirm: true }]] as const) {
      const busy = await post(what, body);
      assert.deepEqual([busy.status, busy.body.code, busy.headers["retry-after"] !== undefined], [503, "research.busy", true], what);
    }
    fs.rmSync(lock);
    assert.equal(fact(w, f.josefBirth).confirmed, undefined);

    // —— stop all: the person's asked tasks too ——
    const all = await post("verify/stop", { scope: "all" });
    assert.equal(all.status, 200, JSON.stringify(all.body));
    assert.ok(all.body.dropped >= 1);
    assert.equal(verifyTasks(w).filter((t) => t.state === "open").length, 0);
    assert.equal((await request(`${info.url}/status`)).body.verify.waiting, 0);

    // —— an archive: nobody verifies; the person's confirmation works ——
    await w.ok(["mode", "archive"], { tty: true });
    for (const [what, body] of [["verify", { person: "P0002" }], ["verify/bulk", { scope: "tree", dry: true }], ["verify/stop", {}]] as const) {
      const r = await post(what, body);
      assert.deepEqual([r.status, r.body.code], [409, "verify.archive"], what);
    }
    const inArchive = await post("facts/confirm", { fact: f.josefBirth, confirm: true });
    assert.equal(inArchive.status, 200, JSON.stringify(inArchive.body));
    assert.ok(fact(w, f.josefBirth).confirmed);
    const archived = (await request(`${info.url}/status`)).body;
    assert.equal(archived.verify, undefined, "no verification in an archive");
    assert.ok(archived.features.includes("facts.confirm"));
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    if (started) await w.run(["live", "stop"]);
    w.cleanup();
  }
});

/** Someone with a birth, a death and 16 residences, each dated and placed (as a family tree from another program has it). */
const MANY_FACTS = [
  "0 HEAD", "1 SOUR MyHeritage", "1 CHAR UTF-8",
  "0 @I1@ INDI", "1 NAME Jan Křtitel /Lhoták/".normalize("NFD"), "1 SEX M", "1 BIRT", "2 DATE 12 MAR 1841", "2 PLAC Lhota u Kutné Hory", "1 DEAT", "2 DATE 28 NOV 1919", "2 PLAC Лхота",
  ...Array.from({ length: 16 }, (_, i) => ["1 RESI", `2 DATE ${i + 1} SEP ${1860 + i * 3}`, `2 PLAC ${["Dolní Lhota", "Lhotka nad Labem", "Лхота", "Horní Lhota"][i % 4]}`]).flat(),
  "0 TRLR", "",
].join("\n");

test("N1, P2: the bridge's /verify of someone with many facts — the tasks made, each what within 200 characters; asked for again, nothing written", bridgeOpts, async () => {
  const w = new World();
  Object.assign(w.env, { STROM_LOCK_WAIT_MS: "1500", STROM_APP_URL: "https://beta.stromapp.info/run/" });
  let started = false;
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    fs.writeFileSync(path.join(w.dir, "lhotak.ged"), MANY_FACTS);
    await w.ok(["intake", path.join(w.dir, "lhotak.ged")], { env: { CLAUDECODE: "1" } });
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    started = true;
    const post = (what: string, body: unknown) => request(`${info.url}/${what}`, "POST", body);
    const dry = await post("verify", { person: "P0001", dry: true });
    assert.equal(dry.status, 200, JSON.stringify(dry.body));
    assert.equal(dry.body.facts.length, 18);
    const asked = await post("verify", { person: "P0001" });
    assert.equal(asked.status, 200, JSON.stringify(asked.body));
    assert.notEqual(asked.body.head, asked.body.parent);
    const made = (asked.body.tasks as { task: string }[]).map((t) => open(w).get<Task>(t.task)!);
    assert.equal(made.flatMap((t) => t.where).length, 18, "every fact in a task");
    for (const t of made) assert.ok([...t.what].length <= 200, t.what);
    // P2: asked for again (a double click): nothing written, the same answer
    const again = await post("verify", { person: "P0001" });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.equal(again.body.head, again.body.parent, "no commit");
    assert.equal(again.body.head, asked.body.head);
    assert.deepEqual([again.body.task, again.body.state, again.body.position, again.body.tasks], [asked.body.task, asked.body.state, asked.body.position, asked.body.tasks]);
  } finally {
    if (started) await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("strom verify stop: the person's alone — an agent is refused; the sweep's tasks dropped, one at work goes on", { skip: !hasGit }, async () => {
  const { w } = await lhotaci();
  try {
    await w.ok(["frontier", "--research", "G0001", "--apply"]);
    const sweep = verifyTasks(w).filter((t) => t.state === "open");
    assert.ok(sweep.length >= 2, "the sweep queued Josef's facts and the marriage");
    const agent = await w.run(["verify", "stop", "--json"], { env: { CLAUDECODE: "1" } });
    assert.notEqual(agent.code, 0);
    assert.equal(verifyTasks(w).filter((t) => t.state === "open").length, sweep.length, "nothing dropped by an agent");
    // a task at work: it goes on
    const tree = open(w);
    tree.withTreeLock(() => {
      tree.put({ ...sweep[0]!, state: "doing" }, { op: "task.start", targets: [sweep[0]!.id], summary: "at work" });
      tree.commit("At work");
    });
    const r = (await w.ok(["verify", "stop", "--json"], { tty: true })).json;
    assert.equal(r.dropped, sweep.length - 1);
    assert.equal(open(w).get<Task>(sweep[0]!.id)!.state, "doing");
    const bulkOnly = (await w.ok(["verify", "stop", "--bulk", "--json"], { tty: true })).json;
    assert.equal(bulkOnly.dropped, 0);
    assert.match((await w.ok(["verify", "stop"], { tty: true })).out, /Není co zastavit/u);
  } finally {
    w.cleanup();
  }
});
