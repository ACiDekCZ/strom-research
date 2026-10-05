// strom sync: a family tree coming back from the Strom app (or another
// program), compared with what the research gave it — the user's edits taken
// in without losing what the research rests on; a wrong file refused; a sync
// undone.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Family, Person } from "../../src/core/model.ts";
import { opts, world, edited, post, get, marked, withSources } from "./sync.helpers.ts";

test("straight from the Strom app: it sends the tree to the bridge — only its pages, only a tree of this research, kept to be shown; strom sync --app waits for it", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, ged } = await world();
  const file = edited(ged, path.join(w.dir, "z-aplikace.ged"));
  const text = fs.readFileSync(file, "utf8");
  // the user reviews each send (sync.review on): it waits for their word
  await w.ok(["config", "set", "sync.review", "on"]);
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const app = { Origin: "https://beta.stromapp.info" };
    assert.equal((await post(`${info.url}/sync`, text)).status, 403, "not from the app's pages");
    assert.equal((await post(`http://127.0.0.1:${info.port}/${"0".repeat(32)}/sync`, text, app)).status, 404, "without the secret");
    const other = await post(`${info.url}/sync`, text.replace(/^1 _STROM_TREE .*$/m, "1 _STROM_TREE 11111111-2222-3333-4444-555555555555"), app);
    assert.equal(other.status, 400);
    assert.match(JSON.parse(other.body).error, /tento strom patří jinému výzkumu/, "said in the research's language");
    // …and as a program reads it: the app says it in its own language
    assert.equal(JSON.parse(other.body).code, "tree.other-research");
    assert.equal(JSON.parse(other.body).text, "this tree is of another research");
    assert.equal(JSON.parse((await post(`${info.url}/sync`, "hello", app)).body).error, "strom přišel prázdný nebo nečitelný");
    const pre = await new Promise<http.IncomingHttpHeaders>((resolve, reject) => {
      const req = http.request(`${info.url}/sync`, { method: "OPTIONS", headers: { ...app, "Access-Control-Request-Method": "POST", "Access-Control-Request-Private-Network": "true" } }, (res) => resolve(res.headers));
      req.on("error", reject);
      req.end();
    });
    assert.match(String(pre["access-control-allow-methods"]), /POST/);
    assert.equal(pre["access-control-allow-private-network"], "true");
    const ok = await post(`${info.url}/sync`, text, app);
    assert.equal(ok.status, 200);
    const sent = JSON.parse(ok.body);
    assert.match(sent.intake, /^R\d{17}-[0-9a-f]{4}$/);
    assert.deepEqual({ ...sent, file: undefined, intake: undefined }, { ok: true, changes: 8, file: undefined, inbox: true, intake: undefined });
    assert.equal((await w.ok(["person", "list", "--json"])).json.total, 3, "nothing written by sending");
    assert.match((await w.ok(["check"])).out, /^ok/);

    // strom sync --app: the app opened with ?send= (a copy of it that can: its beta, its development), the tree waited for
    await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
    w.env.STROM_SYNC_WAIT_MS = "20000";
    const waiting = w.run(["sync", "--app"]);
    await new Promise((r) => setTimeout(r, 700));
    await post(`${info.url}/sync`, text, app);
    const r = await waiting;
    assert.equal(r.code, 0, r.err);
    assert.match(r.err, /https:\/\/beta\.stromapp\.info\/run\/\?send=http%3A%2F%2F127\.0\.0\.1/, "no browser here: the address to open");
    assert.match(r.out, /^Aplikace Strom strom poslala\.\nstrom-app-.*\.ged: změn proti výzkumu: 8/);
    const got = r.out.match(/strom sync "?([^"\n]*strom-app-[^"\n]*\.ged)"? --apply/)?.[1];
    assert.ok(got, r.out);
    await w.ok(["sync", got!, "--apply"]);
    assert.equal((await w.ok(["person", "list", "--json"])).json.total, 4);
    // the app sends nothing (unchanged, cancelled): said at once, not after the whole wait
    w.env.STROM_SYNC_WAIT_MS = "20000";
    const said = w.run(["sync", "--app"]);
    await new Promise((r) => setTimeout(r, 700));
    assert.equal((await post(`${info.url}/cancel`, JSON.stringify({ reason: "unchanged" }))).status, 403, "only the app's pages");
    assert.equal((await post(`${info.url}/cancel`, JSON.stringify({ reason: "unchanged" }), app)).status, 200);
    const started = Date.now();
    const unchanged = await said;
    assert.ok(Date.now() - started < 5000, "not the whole wait");
    assert.equal(unchanged.code, 0);
    assert.match(unchanged.out, /Aplikace Strom nic neposlala: strom se od posledního načtení z výzkumu nezměnil\./);
    // nobody sends: said what to do instead; the production app cannot send yet
    w.env.STROM_SYNC_WAIT_MS = "600";
    const none = await w.run(["sync", "--app"]);
    assert.equal(none.code, 3);
    assert.match(none.out, /Aplikace Strom strom do 1 min neposlala/);
    // stromapp.info sends since its 3.3.0 (APP_SENDS_CHANGES): the app opened there
    await w.ok(["config", "unset", "strom.app.url"]);
    assert.match((await w.run(["sync", "--app"])).err, /https:\/\/stromapp\.info\/run\/\?send=/);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("the app sends on its own: the send waits in the inbox (/status inbox, sends), a newer send of the same tree of the app replaces it, another's stays; thrown away or written, the app hears it", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, ged } = await world();
  const text = fs.readFileSync(edited(ged, path.join(w.dir, "z-aplikace.ged")), "utf8");
  await w.ok(["config", "set", "sync.review", "on"]);
  const info = (await w.ok(["live", "start", "--json"])).json;
  const app = { Origin: "https://beta.stromapp.info" };
  const status = async () => JSON.parse((await get(`${info.url}/status?poll=1`)).body);
  try {
    const { media, ...accepts } = (await status()).accepts;
    assert.deepEqual(accepts, { mode: "research", sync: { auto: "off" }, sources: true, verified: true });
    assert.equal(media.max, 500 * 1024 * 1024, "originals through PUT /media");
    assert.deepEqual((await status()).inbox, { trees: [], material: 0 });
    const first = JSON.parse((await post(`${info.url}/sync`, marked(text, "app-tree-a", "v2-aaa"), app)).body);
    let st = await status();
    assert.deepEqual(st.inbox.trees, [{ tree: "app-tree-a", intake: first.intake, at: st.inbox.trees[0].at, changes: 8, sent: "v2-aaa" }]);
    assert.equal(st.sends[0].state, "pending");
    // the same tree of the app again: the newer send replaces it; another tree of the app (a copy elsewhere) waits beside it
    const second = JSON.parse((await post(`${info.url}/sync`, marked(text, "app-tree-a", "v2-bbb"), app)).body);
    const other = JSON.parse((await post(`${info.url}/sync`, marked(text, "app-tree-b", "v2-ccc"), app)).body);
    st = await status();
    assert.deepEqual(st.inbox.trees.map((t: { intake: string }) => t.intake).sort(), [second.intake, other.intake].sort());
    assert.equal(st.sends.find((x: { intake: string }) => x.intake === first.intake).state, "replaced");
    const listed = (await w.ok(["sync", "--inbox", "--json"])).json.inbox;
    assert.equal(listed.length, 2);
    assert.match((await w.ok(["sync", "--inbox"])).out, /Stromy z aplikace Strom, které čekají na rozhodnutí: 2/);
    // the orientation tells the agent: the user decides
    assert.match((await w.ok([])).out, /strom poslaný z aplikace Strom \(2, změn: 16\)/);
    // thrown away: the app hears it, with the user's words; nothing written
    await w.ok(["sync", "discard", other.intake, "--reason", "poslal jsem omylem"]);
    st = await status();
    assert.deepEqual(st.inbox.trees.map((t: { intake: string }) => t.intake), [second.intake]);
    assert.deepEqual({ ...st.sends.find((x: { intake: string }) => x.intake === other.intake), at: undefined, decidedAt: undefined }, { intake: other.intake, at: undefined, state: "discarded", changes: 8, tree: "app-tree-b", sent: "v2-ccc", decidedAt: undefined, reason: "poslal jsem omylem" });
    assert.equal((await w.ok(["person", "list", "--json"])).json.total, 3);
    // written: gone from the inbox, the send says which input it became, lastIntake says which send it was
    const file = listed.find((r: { intake: string }) => r.intake === second.intake).file;
    const done = (await w.ok(["sync", file, "--apply", "--json"])).json;
    st = await status();
    assert.deepEqual(st.inbox.trees, []);
    assert.equal(st.sends.find((x: { intake: string }) => x.intake === second.intake).state, "written");
    assert.equal(st.sends.find((x: { intake: string }) => x.intake === second.intake).input, done.input);
    assert.deepEqual({ ...st.lastIntake, at: undefined }, { id: done.input, at: undefined, state: "written", received: second.intake });
    assert.ok(!fs.existsSync(file), "its file goes once it is written");
    assert.match((await w.run(["sync", "discard", second.intake])).err, /no tree of the app waits as/);
    // the browser asks first only every ten minutes
    const pre = await new Promise<http.IncomingHttpHeaders>((resolve, reject) => {
      const req = http.request(`${info.url}/status`, { method: "OPTIONS", headers: { ...app, "Access-Control-Request-Method": "GET", "Access-Control-Request-Private-Network": "true" } }, (res) => resolve(res.headers));
      req.on("error", reject);
      req.end();
    });
    assert.equal(pre["access-control-max-age"], "600");
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("the menu shows a tree the app sent among what waits: what it brings, then thrown away (the app hears why) or written", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, ged } = await world();
  const text = fs.readFileSync(edited(ged, path.join(w.dir, "z-aplikace.ged")), "utf8");
  const { receiveTree } = await import("../../src/core/sync.ts");
  const root = w.cwd;
  const first = receiveTree(root, w.env, marked(text, "app-tree-a", "v2-aaa"));
  // 3 what waits · 1 the tree from the app · 3 throw it away · why · Enter · 0 · 0
  const menu = await w.run(["menu"], { tty: true, answers: ["3", "1", "3", "omylem", "", "0", "0"] });
  assert.match(menu.out, /Co čeká \(1\)/);
  assert.match(menu.out, /1\. Aplikace Strom poslala strom \([^)]*\): změn k zapsání do výzkumu nebo k zahození: 8/);
  assert.match(menu.out, /z-aplikace|strom-app-.*\.ged: změn proti výzkumu: 8/);
  assert.match(menu.out, /Zahozeno: stromů z aplikace Strom 1/);
  const { receivedAll } = await import("../../src/core/sync.ts");
  assert.deepEqual(receivedAll(root).map((r) => [r.intake, r.state, r.reason]), [[first.intake, "discarded", "omylem"]]);
  // again, written this time: 3 · 1 · 1 all · Enter · 0 · 0
  receiveTree(root, w.env, marked(text, "app-tree-a", "v2-bbb"));
  const again = await w.run(["menu"], { tty: true, answers: ["3", "1", "1", "", "0", "0"] });
  assert.match(again.out, /Zapsáno změn z strom-app-.*\.ged: 7/);
  assert.equal((await w.ok(["person", "list", "--json"])).json.total, 4);
  w.cleanup();
});

test("?poll=1 keeps no bridge running: the app asking now and then lets it end when idle", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w } = await world();
  w.env.STROM_LIVE_IDLE_MS = "1500";
  w.env.STROM_LIVE_POLL_MS = "200";
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const until = Date.now() + 4000;
    let ended = false;
    while (Date.now() < until && !ended) {
      ended = await get(`${info.url}/status?poll=1`).then(() => false, () => true);
      await new Promise((r) => setTimeout(r, 300));
    }
    assert.ok(ended, "the bridge ended though the app kept asking with ?poll=1");
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("one bridge, one lasting address: started again it takes its secret; strom live stop --forget gives the next one a new one", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w } = await world();
  try {
    const first = (await w.ok(["live", "start", "--json"])).json;
    await w.ok(["live", "stop"]);
    const again = (await w.ok(["live", "start", "--json"])).json;
    const log = () => fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
    assert.equal(again.token, first.token, `the same secret: the app goes on by itself\n${log()}`);
    assert.match((await w.ok(["live", "stop", "--forget"])).out, /jeho adresa je zapomenutá: další most dostane novou/);
    const fresh = (await w.ok(["live", "start", "--json"])).json;
    assert.notEqual(fresh.token, first.token);
  } finally {
    await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("what the app sends is written at once (the default): additions, a lead corrected, a record's fact a conflict — the app hears what was written; the same again writes nothing, no commit", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, ged } = await world();
  const text = fs.readFileSync(edited(ged, path.join(w.dir, "z-aplikace.ged")), "utf8");
  const info = (await w.ok(["live", "start", "--json"])).json;
  const app = { Origin: "https://beta.stromapp.info" };
  const status = async () => JSON.parse((await get(`${info.url}/status?poll=1`)).body);
  try {
    const { media, ...accepts } = (await status()).accepts;
    assert.deepEqual(accepts, { mode: "research", sync: { auto: "write" }, sources: true, verified: true });
    assert.equal(media.max, 500 * 1024 * 1024, "originals through PUT /media");
    const r = await post(`${info.url}/sync`, marked(text, "app-tree-a", "v2-1"), app);
    assert.equal(r.status, 200, r.body);
    const sent = JSON.parse(r.body);
    assert.equal(sent.inbox, false);
    assert.match(sent.input, /^I\d+$/);
    assert.equal(sent.applied, 7);
    assert.equal(sent.head, (await w.ok(["history", "--json"])).json[0]?.commit ?? sent.head);
    assert.equal((await w.ok(["person", "list", "--json"])).json.total, 4);
    assert.match((await w.ok(["conflict", "list"])).out, /X0001\s+otevřený/, "the record's fact changed: a conflict for the user, the rest written");
    // the app says whose edit waits for a decision, without comparing the trees
    assert.equal(sent.conflicts.length, 1, r.body);
    assert.equal(sent.conflicts[0].id, "X0001");
    assert.match(sent.conflicts[0].person, /^P\d+$/);
    assert.match(sent.conflicts[0].fact, /^[A-Z]+$/);
    let st = await status();
    assert.deepEqual(st.inbox.trees, [], "nothing waits");
    assert.equal(st.sends[0].state, "written");
    assert.deepEqual(st.sends[0].conflicts, sent.conflicts);
    // what the app sent is kept aside once written (the last ones), named on its record
    const rec = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "sync", `received-${st.sends[0].intake}.json`), "utf8"));
    assert.match(rec.keptAs, /^kept\/strom-app-.*\.ged$/);
    assert.ok(fs.existsSync(path.join(w.cwd, ".strom", "sync", rec.keptAs)));
    // the app sends the same again (before it had the tree back): nothing new written — no input, no commit
    const commits = (await w.ok(["history", "--json"])).json.length;
    const again = JSON.parse((await post(`${info.url}/sync`, marked(text, "app-tree-a", "v2-2"), app)).body);
    assert.equal(again.inbox, false);
    assert.ok(!again.input, JSON.stringify(again));
    assert.equal((await w.ok(["history", "--json"])).json.length, commits);
    st = await status();
    assert.equal(st.sends[0].state, "nothing");
    assert.equal(st.sends[0].conflicts, undefined);
    assert.equal((await w.ok(["input", "list", "--json"])).json.inputs.filter((i: { kind: string }) => i.kind === "tree").length, 1);
    // undone as any sync: the app hears its edits are no longer the research's
    await w.ok(["sync", "undo", sent.input]);
    assert.equal((await w.ok(["person", "list", "--json"])).json.total, 3);
    st = await status();
    const undone = st.sends.find((x: { intake: string }) => x.intake === sent.intake);
    assert.equal(undone.state, "undone");
    assert.ok(undone.decidedAt);
    assert.equal(undone.conflicts, undefined);
    assert.equal(st.lastIntake, undefined);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("strom sync --app (the menu's straight from the Strom app) with sends written at once: what came of it said — written, what waits for a decision — never shown to write again", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, ged } = await world();
  const text = fs.readFileSync(edited(ged, path.join(w.dir, "z-aplikace.ged")), "utf8");
  const info = (await w.ok(["live", "start", "--json"])).json;
  const app = { Origin: "https://beta.stromapp.info" };
  try {
    await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
    w.env.STROM_SYNC_WAIT_MS = "30000";
    const waiting = w.run(["sync", "--app", "--json"]);
    await new Promise((r) => setTimeout(r, 700));
    assert.equal((await post(`${info.url}/sync`, text, app)).status, 200);
    const r = await waiting;
    assert.equal(r.code, 0, r.err);
    const data = JSON.parse(r.out);
    assert.equal(data.received, null);
    assert.equal(data.written.state, "written");
    assert.match(data.written.input, /^I\d+$/);
    assert.equal(data.written.conflicts.length, 1);
    assert.equal((await w.ok(["person", "list", "--json"])).json.total, 4);
    // in words, in the research's language; the same again: nothing new
    const again = w.run(["sync", "--app"]);
    await new Promise((r) => setTimeout(r, 700));
    await post(`${info.url}/sync`, text, app);
    const said = await again;
    assert.equal(said.code, 0, said.err);
    assert.match(said.out, /Aplikace Strom strom poslala; nepřinesl nic, co by výzkum neměl\./);
    assert.doesNotMatch(said.out, /--apply/);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("a send written longer than the bridge waits: 202 pending, then written (the app follows it in sends)", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, ged } = await world();
  const text = fs.readFileSync(edited(ged, path.join(w.dir, "z-aplikace.ged")), "utf8");
  w.env.STROM_SYNC_ANSWER_MS = "0";
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const r = await post(`${info.url}/sync`, text, { Origin: "https://beta.stromapp.info" });
    assert.equal(r.status, 202);
    const sent = JSON.parse(r.body);
    assert.deepEqual({ ok: sent.ok, inbox: sent.inbox, pending: sent.pending }, { ok: true, inbox: false, pending: true });
    let state = "";
    for (let i = 0; i < 60 && state !== "written"; i++) {
      await new Promise((res) => setTimeout(res, 250));
      state = JSON.parse((await get(`${info.url}/status?poll=1`)).body).sends.find((x: { intake: string }) => x.intake === sent.intake)?.state ?? "";
    }
    assert.equal(state, "written");
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("an archive: switched by the person, its tasks put aside and back; no agent works on it; what the app sends mirrored — the user's word wins, what the app no longer has withdrawn with the reason, undone back", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, ged } = await world();
  await w.ok(["intake", "--text", "Děda Josef byl mlynář"]);
  const open = () => Tree.open(w.cwd, w.env).list<import("../../src/core/model.ts").Task>("task");
  assert.ok(open().some((t) => t.state === "open"));
  // the person's decision: an agent (no terminal) cannot make it
  assert.equal((await w.run(["mode", "archive"], {})).code, 4);
  const sw = await w.ok(["mode", "archive"], { tty: true });
  assert.match(sw.out, /Výzkum je teď archiv\. Odložených úkolů: 1/);
  assert.ok(open().every((t) => t.state !== "open"));
  assert.ok(open().some((t) => t.heldBy === "archive"));
  assert.match((await w.ok(["mode"])).out, /Tento výzkum je archiv/);
  // no agent works on it
  for (const cmd of [["chat", "--print"], ["session", "start"], ["run"]]) assert.match((await w.run(cmd)).err, /this research is an archive/);
  // a new task waits put aside
  await w.ok(["intake", "--text", "Babička Anna pekla"]);
  assert.ok(open().every((t) => t.state !== "open"));
  // the orientation says so
  assert.match((await w.ok([])).out, /archiv — data přicházejí z aplikace Strom/);

  // what the app sends: mirrored at once
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const st = JSON.parse((await get(`${info.url}/status?poll=1`)).body);
    assert.deepEqual({ mode: st.accepts.mode, auto: st.accepts.sync.auto }, { mode: "archive", auto: "mirror" });
    const text = fs.readFileSync(edited(ged, path.join(w.dir, "z-aplikace.ged")), "utf8");
    const sent = JSON.parse((await post(`${info.url}/sync`, text, { Origin: "https://beta.stromapp.info" })).body);
    assert.equal(sent.inbox, false);
    const tree = Tree.open(w.cwd, w.env);
    const karel = tree.list<Person>("person").find((p) => p.names[0]?.given === "Karel")!;
    assert.match(karel.retracted?.reason ?? "", /odebráno v aplikaci Strom/, "what the app no longer has: withdrawn with the reason");
    const p1 = (await w.ok(["person", "show", "P1"])).out;
    assert.match(p1, /CHR\s+3 MAR 1885\s+Kamenice\s+\[retracted\]/, "the user's word wins");
    assert.match(p1, /(CHR|BAPM)\s+4 MAR 1885\s+Kamenice\s+\[possible\]/);
    assert.equal((await w.ok(["conflict", "list", "--json"])).json.length ?? 0, 0);
    assert.match((await w.ok(["check"])).out, /^ok/);
    // undone: back as it was
    await w.ok(["sync", "undo", sent.input]);
    assert.ok(!Tree.open(w.cwd, w.env).get<Person>(karel.id)!.retracted);
    assert.match((await w.ok(["person", "show", "P1"])).out, /CHR\s+3 MAR 1885\s+Kamenice\s+\[probable\]/);
    // the app that knows an archive is told in the file too (its beta at once)
    await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
    const out = path.join(w.dir, "a.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
    assert.match(fs.readFileSync(out, "utf8"), /^1 _STROM_MODE archive$/m);
  } finally {
    await w.ok(["live", "stop"]);
  }

  // back to work with an agent: the tasks put aside come back
  await w.ok(["mode", "research"], { tty: true });
  assert.equal(open().filter((t) => t.state === "open").length, 2);
  assert.ok(open().every((t) => !t.heldBy));
  w.cleanup();
});

test("a new research as an archive: strom init --mode archive, or the setup wizard's default when no agent is here", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  const r = await w.ok(["init", "Archiv", "--mode", "archive"]);
  assert.match(r.out, /archiv: data přicházejí z aplikace Strom/);
  w.cwd = w.treeDir("Archiv");
  assert.match((await w.ok(["mode"])).out, /archive|archiv/);
  await w.ok(["config", "set", "mode", "archive"]);
  await w.ok(["init", "Druhý"]);
  w.cwd = w.treeDir("Druhý");
  assert.equal((await w.ok(["mode", "--json"])).json.mode, "archive");
  w.cleanup();
});

test("the app says its version to the bridge (X-Strom-App-Version, or ?app= where it sends no header): what the bridge writes goes by it — an older app, an unknown version and a bad one keep today's", opts, async () => {
  const { w } = await world();
  await w.ok(["event", "add", "P1", "BIRT", "--date", "1888"]);
  const info = (await w.ok(["live", "start", "--json"])).json;
  const ask = (url: string, headers: Record<string, string> = {}, method = "GET") =>
    new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
      http
        .request(url, { method, headers: { Origin: "https://stromapp.info", ...headers } }, (res) => {
          let b = "";
          res.on("data", (d) => (b += d));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: b }));
        })
        .on("error", reject)
        .end();
    });
  try {
    // stromapp.info (the tests' app): how sure a fact is as _STROM_STATUS only for an app that says it reads it
    const status = /2 _STROM_STATUS lead/;
    assert.doesNotMatch((await ask(`${info.url}/tree.ged`)).body, status, "an app of unknown version keeps the note");
    assert.match((await ask(`${info.url}/tree.ged`, { "X-Strom-App-Version": "3.9.0" })).body, status);
    assert.match((await ask(`${info.url}/tree.ged`, { "X-Strom-App-Version": "3.9.0-beta.10" })).body, status, "a pre-release of 3.9.0");
    assert.doesNotMatch((await ask(`${info.url}/tree.ged`, { "X-Strom-App-Version": "3.8.2" })).body, status, "an older app: the note (made again for it, not the last one's)");
    assert.match((await ask(`${info.url}/tree.ged?app=3.9.1`)).body, status, "?app= too");
    assert.doesNotMatch((await ask(`${info.url}/tree.ged?app=3.9`)).body, status, "not a version: unknown");
    assert.doesNotMatch((await ask(`${info.url}/tree.ged`, { "X-Strom-App-Version": "<script>" })).body, status);
    assert.match((await ask(`${info.url}/tree.ged`)).body, /Vodítko|Lead/);
    // the browser asks first whether it may send the header: yes, for the app's pages
    const pre = await ask(`${info.url}/tree.ged`, { "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "x-strom-app-version" }, "OPTIONS");
    assert.equal(pre.status, 204);
    assert.match(String(pre.headers["access-control-allow-headers"]), /x-strom-app-version/i);
    // /status and the events take it too; it says where the research is and the agent that works on it
    const st = await ask(`${info.url}/status?app=3.9.0`);
    assert.equal(st.status, 200);
    const s = JSON.parse(st.body);
    assert.equal(fs.realpathSync(s.path), fs.realpathSync(w.cwd));
    assert.deepEqual({ id: s.agent.id, name: s.agent.name }, { id: "claude", name: "Claude Code" });
    // an archive: no agent
    await w.ok(["mode", "archive"], { tty: true });
    assert.equal(JSON.parse((await ask(`${info.url}/status`)).body).agent, undefined);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("a send the research cannot write: the app hears a sentence it can show as it is (an app of 3.8 shows a refusal's error), what went wrong beside it", { skip: opts.skip || process.getuid?.() === 0 }, async () => {
  const { w, ged } = await world();
  const text = fs.readFileSync(edited(ged, path.join(w.dir, "z-aplikace.ged")), "utf8");
  w.env.STROM_SYNC_ANSWER_MS = "15000";
  const info = (await w.ok(["live", "start", "--json"])).json;
  const objects = path.join(w.cwd, ".git", "objects");
  try {
    // nothing can be saved: the send is kept, writing it fails
    fs.chmodSync(objects, 0o555);
    const r = await post(`${info.url}/sync`, text, { Origin: "https://stromapp.info" });
    assert.equal(r.status, 500, r.body);
    const got = JSON.parse(r.body);
    assert.match(got.error, /^výzkum úpravy nezapsal — poslat je za chvíli znovu/);
    assert.equal(got.code, "send.failed");
    assert.ok(got.reason, "what went wrong, for the log");
  } finally {
    fs.chmodSync(objects, 0o755);
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});
