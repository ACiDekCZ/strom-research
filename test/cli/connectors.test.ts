// Connectors: plugins in the plugins folder (<shared>/plugins/connectors/<name>/
// — copy a folder in and it is there), run by strom — every request paced by
// strom's limiter, a refusal stopping everything, the images checked, what was
// fetched registered with its provenance. The user's consent (on a terminal,
// never an agent's) is needed when they ask for it (connectors.consent on), and
// always for code that goes round strom. A local server plays the archive; the
// pauses are recorded, not slept.

import { readEntry, readZip, unzipTo, ZipWriter } from "../../src/core/zip.ts";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { World, hasGit, fakeConnector, pluginDir, readJsonFile } from "../helpers.ts";
import { testHooks, DEFAULT_PACE } from "../../src/core/net.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { decodeJpeg } from "../../src/image/jpeg-decode.ts";
import { blank } from "../../src/image/image.ts";
import { opts, scans, pauses, TILE, archive, world, program, runInTab } from "./connectors.helpers.ts";
import type { Archive } from "./connectors.helpers.ts";

test("connector new: in the plugins folder, next to the contract, kept out of every repository", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]); // no tree needed: a connector serves them all
  const r = await w.ok(["connector", "new", "statni-archiv", "--url", "https://digi.example.org/portal", "--title", "Státní archiv Čížkov"]);
  const dir = pluginDir(w, "statni-archiv");
  assert.deepEqual(fs.readdirSync(dir).sort(), ["DISCOVERY.md", "README.md", "connector.json", "connector.ts", "package.json", "sdk.ts"]);
  const m = readJsonFile(path.join(dir, "connector.json"));
  assert.equal(m.interface, 1);
  assert.equal(m.name, undefined, "the folder's name is its name");
  assert.deepEqual(m.hosts, ["digi.example.org"]);
  assert.equal(m.policy.automation, "unknown", "nobody knows yet what the portal allows");
  assert.match(fs.readFileSync(path.join(dir, "DISCOVERY.md"), "utf8"), /Building the connector for Státní archiv Čížkov[\s\S]*`\.\.\/README\.md`[\s\S]*Terms of use[\s\S]*strom connector test statni-archiv/);
  assert.match(r.out, /finds out what the portal allows — before any code/);
  assert.doesNotMatch(r.out, /consent/, "it runs once it is written");
  // the plugins folder explains itself, and carries the contract
  const plugins = path.join(w.home, "shared", "plugins");
  assert.match(fs.readFileSync(path.join(plugins, "README.md"), "utf8"), /copying its folder in/);
  assert.match(fs.readFileSync(path.join(plugins, "connectors", "README.md"), "utf8"), /# Connectors — interface 1[\s\S]*version 1 and it does not change[\s\S]*"http":\{"url"/);
  // …and no plugin ends up in a repository by accident: only strom's READMEs are seen by git
  const shared = path.join(w.home, "shared");
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: shared }).status, 0);
  fs.writeFileSync(path.join(plugins, "connectors", "stray.zip"), "x");
  const seen = spawnSync("git", ["status", "--porcelain", "--untracked-files=all", "plugins"], { cwd: shared, encoding: "utf8" }).stdout;
  assert.deepEqual(seen.trim().split("\n").map((l) => l.slice(3)).sort(), ["plugins/.gitignore", "plugins/README.md", "plugins/connectors/README.md", "plugins/gates/README.md", "plugins/hooks/README.md"]);
  assert.equal((await w.run(["connector", "new", "Velká Písmena", "--url", "https://x.org"])).code, 2);
  assert.equal((await w.run(["connector", "new", "bez-url"])).code, 2);
  assert.equal((await w.run(["connector", "new", "statni-archiv", "--url", "https://x.org"])).code, 2, "exists already");
  const list = await w.ok(["connector", "list"]);
  assert.match(list.out, /statni-archiv\s+Státní archiv Čížkov\s+find,list,fetch\s+automation unknown\s+ready/);
  assert.match(list.out, /folder: .*plugins\/connectors — copy a connector's folder in to install it/);
  // an agent's sandbox may not write here (found with Codex): strom's own copies stay as they are, reading still works
  if (process.platform !== "win32" && process.getuid?.() !== 0) {
    const folder = path.join(plugins, "connectors");
    const contract = path.join(folder, "README.md");
    fs.writeFileSync(contract, "an older contract");
    fs.chmodSync(contract, 0o444);
    fs.chmodSync(folder, 0o555);
    try {
      assert.match((await w.ok(["connector", "list"])).out, /statni-archiv\s+Státní archiv Čížkov/);
      assert.match((await w.ok(["connector", "show", "statni-archiv"])).out, /statni-archiv/);
    } finally {
      fs.chmodSync(folder, 0o755);
      fs.chmodSync(contract, 0o644);
    }
    assert.equal(fs.readFileSync(contract, "utf8"), "an older contract");
  }
  w.cleanup();
});

test("copying a folder in is installing it; the user who asked to be asked allows it the first time they use it", opts, async () => {
  const { w, a, dir } = await world();
  // someone gives the user a connector: they copy its folder in
  fs.cpSync(dir, pluginDir(w, "kopie"), { recursive: true });
  // two copies that cannot run, and say why
  fs.cpSync(dir, pluginDir(w, "Archiv Čížkov"), { recursive: true });
  fs.cpSync(dir, pluginDir(w, "stary"), { recursive: true });
  const old = readJsonFile(path.join(pluginDir(w, "stary"), "connector.json"));
  delete old.interface;
  fs.writeFileSync(path.join(pluginDir(w, "stary"), "connector.json"), JSON.stringify(old));
  fs.cpSync(dir, pluginDir(w, "_odlozeny"), { recursive: true }); // put aside: ignored
  const list = (await w.ok(["connector", "list"])).out;
  assert.match(list, /kopie\s+Testovací archiv[\s\S]*zkusebni\s+Testovací archiv/);
  assert.match(list, /Archiv Čížkov {2}⚠ cannot run: the folder's name is the connector's name: .* rename it \(e\.g\. archiv-cizkov\)/);
  assert.match(list, /stary {2}⚠ cannot run: connector\.json: interface: 1/);
  assert.doesNotMatch(list, /_odlozeny/);
  assert.equal((await w.run(["fetch", "stary", "--find", "x"])).code, 2);
  // it runs at once
  assert.match((await w.ok(["connector", "test", "kopie", "--find", "Týnec"])).out, /Týnec N 1784–1820/);
  a.hits.length = 0;
  // the user wants to be asked first: an agent (or a script) gets the question for the user, and nothing is sent
  assert.match((await w.ok(["config", "set", "connectors.consent", "on"])).out, /connectors\.consent = on/);
  assert.match((await w.ok(["connector", "list"])).out, /kopie\s+Testovací archiv\s+find,list,fetch\s+automation allowed\s+needs a consent; hosts not allowed: 127\.0\.0\.1/);
  const t = await w.run(["connector", "test", "kopie", "--find", "Týnec"]);
  assert.equal(t.code, 4);
  assert.match(t.err, /^chyba: tady je potřeba souhlas – Povolit stahovači „Testovací archiv“[\s\S]*\n→ spustit ve vlastním terminálu: strom allow connector kopie$/m);
  // the same for a program: the English it goes by
  assert.match((await w.run(["connector", "test", "kopie", "--find", "Týnec", "--json"])).out, /"question":"Run connector kopie \(Testovací archiv\), with automated access to 127\.0\.0\.1\?"/);
  const agent = new World();
  Object.assign(agent.env, w.env, { CLAUDECODE: "1" });
  agent.cwd = w.cwd;
  assert.equal((await agent.run(["connector", "test", "kopie", "--find", "Týnec"], { tty: true, answers: ["y", "y"] })).code, 4, "an agent's terminal is not the user's");
  assert.deepEqual(a.hits, [], "nothing was sent");
  // the user, in their terminal: the warning, the question, and on it goes
  const r = await w.run(["connector", "test", "kopie", "--find", "Týnec"], { tty: true, answers: ["y", "y"] });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /Connector kopie [\d.]+ — Testovací archiv[\s\S]*its code uses no network of its own \(checked\); the agent may go on improving it/);
  assert.match(r.out, /Automated access to 127\.0\.0\.1[\s\S]*gets this computer.s address blocked/);
  assert.match(r.out, /Týnec N 1784–1820/);
  assert.match((await w.ok(["connector", "list"])).out, /kopie\s+Testovací archiv\s+find,list,fetch\s+automation allowed\s+allowed\n/);
  assert.equal((await w.ok(["connector", "test", "kopie", "--find", "Týnec"])).code, 0, "allowed: no more questions");
  w.cleanup();
  agent.cleanup();
  await a.close();
});

test("consent: only the user, on a terminal — never --yes, --json or an agent's session", opts, async () => {
  const { w, a, dir } = await world();
  await w.ok(["config", "set", "connectors.consent", "on"]);
  for (const flags of [[], ["--yes"], ["--json"]]) assert.equal((await w.run(["allow", "connector", "zkusebni", ...flags])).code, 4, flags.join(" "));
  const agent = new World();
  Object.assign(agent.env, w.env, { STROM_SESSION: "S0001" });
  agent.cwd = w.cwd;
  const refused = await agent.run(["allow", "connector", "zkusebni"], { tty: true, answers: ["y", "y"] });
  assert.equal(refused.code, 4, "inside an agent's session");
  assert.match(refused.err, /an agent cannot answer this/);
  assert.equal((await w.run(["allow", "host", "127.0.0.1"], { tty: true, answers: [] })).code, 0, "no answer is a no");
  assert.equal(fs.existsSync(path.join(w.env.STROM_CONFIG_DIR!, "consents.json")), false);
  // the user reads the warning and says yes to the connector, and to its host
  const r = await w.run(["allow", "connector", "zkusebni"], { tty: true, answers: ["y", "y"] });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /Automated access to 127\.0\.0\.1[\s\S]*gets this computer.s address blocked[\s\S]*at least 2 s apart, no hourly cap/);
  assert.match(r.out, /connector zkusebni allowed\nhosts allowed: 127\.0\.0\.1/);
  const c = readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "consents.json"));
  assert.equal(c.connectors.zkusebni.dir, dir);
  assert.match(c.connectors.zkusebni.hash, /^[0-9a-f]{64}$/);
  assert.ok(c.hosts["127.0.0.1"]);
  assert.match((await w.ok(["allow", "connector", "zkusebni"], { tty: true })).out, /allowed already/);
  assert.match((await w.ok(["consents"])).out, /connectors\n  zkusebni[\s\S]*hosts \(automated access\)\n  127\.0\.0\.1/);
  // taking it back
  assert.match((await w.ok(["allow", "host", "127.0.0.1", "--revoke"], { tty: true })).out, /consent taken back/);
  assert.equal((await w.run(["connector", "test", "zkusebni", "--find", "Týnec"])).code, 4);
  assert.match((await w.ok(["allow", "connector", "zkusebni", "--revoke"], { tty: true })).out, /consent taken back — it does not run now/);
  assert.match((await w.ok(["connector", "list"])).out, /zkusebni\s.*needs a consent/);
  assert.deepEqual(a.hits, []);
  w.cleanup();
  agent.cleanup();
  await a.close();
});

test("consents off (the default): a connector runs at once — code that goes round strom needs the user's yes, and only the user turns asking off", opts, async () => {
  const { w, a, dir } = await world();
  assert.deepEqual((await w.ok(["config", "get", "connectors.consent", "--json"])).json, { key: "connectors.consent", value: "off", source: "default" });
  assert.match((await w.ok(["connector", "test", "zkusebni", "--find", "Týnec"])).out, /Týnec N 1784–1820/);
  assert.match((await w.ok(["connector", "list"])).out, /zkusebni\s.*automation allowed\s+ready\n/);
  assert.match((await w.ok(["consents"])).out, /^consents: off — connectors run without asking \(paced by strom, only to their hosts\)/);
  assert.match((await w.ok(["allow", "connector", "zkusebni"])).out, /consents are off: connector zkusebni runs without asking — paced by strom, only to 127\.0\.0\.1/);
  // code that reaches the network itself: the user's yes, for exactly this code
  fs.appendFileSync(path.join(dir, "connector.ts"), "\nconst sneak = await fetch('https://elsewhere.example/');\n");
  const hits = a.hits.length;
  const t = await w.run(["connector", "test", "zkusebni", "--find", "Týnec"]);
  assert.equal(t.code, 4);
  assert.match(t.err, /tady je potřeba souhlas – [\s\S]*mimo omezovač stromu/);
  assert.match((await w.run(["connector", "test", "zkusebni", "--find", "Týnec", "--json"])).out, /"question":"Connector zkusebni \(Testovací archiv\) reaches the network itself, past strom's limiter — run it\?"/);
  assert.match((await w.ok(["connector", "list"])).out, /zkusebni\s.*needs a consent\n/);
  const yes = await w.run(["allow", "connector", "zkusebni"], { tty: true, answers: ["y"] });
  assert.equal(yes.code, 0, yes.err);
  assert.match(yes.out, /⚠ its code reaches the network or other programs directly[\s\S]*connector zkusebni allowed\nhosts allowed: 127\.0\.0\.1/);
  assert.match((await w.ok(["connector", "list"])).out, /zkusebni\s.*ready\n/);
  fs.appendFileSync(path.join(dir, "connector.ts"), "\n// one more line\n");
  assert.match((await w.run(["connector", "test", "zkusebni", "--find", "Týnec", "--json"])).out, /and its code changed since it was allowed — run it\?/);
  assert.equal(a.hits.length, hits, "nothing was sent");
  // being asked first: anyone may turn it on, only the user turns it off again
  await w.ok(["config", "set", "connectors.consent", "on"]);
  const agent = new World();
  Object.assign(agent.env, w.env, { CLAUDECODE: "1" });
  agent.cwd = w.cwd;
  for (const cmd of [["config", "set", "connectors.consent", "off"], ["config", "unset", "connectors.consent"]]) {
    const r = await agent.run(cmd, { tty: true, answers: ["y"] });
    assert.equal(r.code, 4, cmd.join(" "));
    assert.match(r.err, /Let connectors run without asking first\? \(an agent cannot answer this\)/);
  }
  assert.equal((await w.run(["config", "set", "connectors.consent", "off"])).code, 4, "not without a terminal");
  assert.equal((await w.ok(["config", "get", "connectors.consent"])).out.trim(), "on");
  assert.equal((await w.run(["config", "set", "connectors.consent", "off"], { tty: true })).code, 0, "the user, in their terminal");
  assert.equal((await w.ok(["config", "get", "connectors.consent"])).out.trim(), "off");
  w.cleanup();
  agent.cleanup();
  await a.close();
});

test("connector test: a few requests, the books found, what to register them with — files in its .test folder", opts, async () => {
  const { w, a, dir } = await world();
  const r = await w.ok(["connector", "test", "zkusebni", "--find", "Týnec nad Labem", "--years", "1780-1850"]);
  assert.match(r.out, /test find: 1 request\(s\)/);
  assert.match(r.out, /Týnec nad Labem N 1784–1820 \(17\) · 1784-1820 · baptism · 3 images/);
  assert.match(r.out, /strom recordset add "Týnec nad Labem N 1784–1820" --call-number 17 --kinds baptism --places "Týnec nad Labem" --years 1784-1820 --url https:\/\/archive\.example\.org\/5359 --access online-free/);
  assert.match(r.out, /then: strom fetch zkusebni 5359 --images <from-to> --recordset B…/);
  const f = await w.ok(["connector", "test", "zkusebni", "--fetch", "5359", "--images", "1-3", "--max", "2"]);
  assert.match(f.out, /test fetch: 2 request\(s\) · stopped: the run's limit of 2 requests/);
  assert.match(f.out, /images \(2\): 1=s0001\.jpg \d+ B 400×300 px, 2=s0002\.jpg/);
  assert.deepEqual(fs.readdirSync(path.join(dir, ".test")).sort(), ["s0001.jpg", "s0002.jpg"]);
  // many books: one line each, the first 30 — the rest in --json
  const many = await w.ok(["connector", "test", "zkusebni", "--find", "Velké Město"]);
  assert.match(many.out, /books \(40\):\n {2}k1 {2}Velké Město N 1700 · 200 images\n/);
  assert.match(many.out, /k30 {2}Velké Město N 1729 · 200 images\n {2}… 10 more — narrow it with --years, or read them all with --json\n {2}one of them, with the command to register it: strom connector test zkusebni --list <id>/);
  assert.doesNotMatch(many.out, /k31 |recordset add/);
  assert.equal((await w.ok(["connector", "test", "zkusebni", "--find", "Velké Město", "--json"])).json.books.length, 40);
  assert.equal((await w.run(["connector", "test", "zkusebni", "--max", "99", "--find", "x"])).code, 2);
  assert.equal((await w.run(["connector", "test", "zkusebni"])).code, 2, "what to try");
  assert.equal((await w.run(["connector", "test", dir, "--find", "x"])).code, 2, "by its name, not a path");
  // nothing of it is in the research
  assert.equal((await w.ok(["media", "list", "--json"])).json.total, 0);
  w.cleanup();
  await a.close();
});

test("fetch: paced, estimated, registered with where each image came from, and the tasks waiting for them wake up", opts, async () => {
  const { w, a } = await world();
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
  await w.ok(["research", "new", "X", "--new-person", "Jan /Novák/"]);
  await w.ok(["task", "add", "Křest", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b"]); // T1
  // the brief knows the book's archive has a connector the user allowed
  assert.match((await w.ok(["brief", "T1"])).out, /no images here yet — connector zkusebni fetches the ones you need: strom fetch zkusebni <book> --images <from-to> --recordset B0001/);
  await w.ok(["task", "wait", "T1", "--on", "images 1–3 of B0001"]);
  const dry = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1", "--dry-run"]);
  assert.match(dry.out, /dry run: would fetch images 1–3 of book 5359 as images of B0001 through zkusebni — nothing was fetched/);
  assert.deepEqual(a.hits, [], "a dry run never contacts the archive");
  pauses.length = 0;
  const r = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1"]);
  assert.match(r.err, /3 image\(s\) through zkusebni: at least 4 s at its pace \(one request per image, ≥2 s apart\)/);
  assert.match(r.out, /fetch: 3 request\(s\)/);
  assert.match(r.out, /3 image\(s\) of B0001 \(images 1–3\) fetched and registered/);
  assert.match(r.out, /back in the queue \(they waited for these images\): T0001/);
  assert.equal(pauses.length, 2, "no pause before the first request, one before each next");
  assert.ok(pauses.every((p) => p > DEFAULT_PACE.minIntervalMs - 500), pauses.join(","));
  const m = (await w.ok(["media", "show", "B1:2", "--json"])).json.media;
  assert.equal(m.url, `${a.base}/img/5359/2.jpg`);
  assert.equal(m.from, "connector zkusebni · s0002.jpg");
  assert.equal(m.image, 2);
  assert.equal((await w.ok(["task", "show", "T1", "--json"])).json.task.state, "open");
  assert.deepEqual(fs.readdirSync(path.join(w.cwd, ".strom", "fetch")), [], "the work folder is gone");
  // again: nothing new
  const hits = a.hits.length;
  assert.match((await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1"])).out, /images 1–3 of B0001 are registered already — nothing fetched/);
  assert.equal(a.hits.length, hits, "not asked for again");
  // a research handed over without its images: the view says how to get the scan, fetching puts it back
  fs.rmSync(path.join(w.home, "shared", m.file));
  const gone = await w.run(["media", "view", "B1:2"]);
  assert.match(gone.err, /the image file is missing[\s\S]*fetch it again from the archive \(checked: the same scan\): strom fetch zkusebni 5359 --recordset B0001 --images 2/);
  const back = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1"]);
  assert.match(back.out, /1 image\(s\) of B0001 fetched again and put back \(their file was not here; the same scan\): M0002/);
  assert.doesNotMatch(back.out, /fetched and registered/);
  assert.equal(a.hits.length, hits + 1, "only the missing image asked for");
  assert.ok(fs.existsSync(path.join(w.home, "shared", m.file)));
  await w.ok(["media", "view", "B1:2"]);
  assert.match((await w.ok(["check"])).out, /^ok/);
  // without a record set: into the inbox, a folder for the book
  const inbox = await w.ok(["fetch", "zkusebni", "5359", "--images", "2-3"]);
  assert.match(inbox.out, /2 image\(s\) fetched into the inbox: zkusebni 5359\/[\s\S]*strom media add --inbox "zkusebni 5359" --recordset B…/);
  assert.deepEqual(fs.readdirSync(path.join(w.home, "shared", "inbox", "zkusebni 5359")).sort(), ["s0002.jpg", "s0003.jpg"]);
  // finding books writes nothing
  assert.match((await w.ok(["fetch", "zkusebni", "--find", "Týnec"])).out, /Týnec N 1784–1820/);
  assert.equal((await w.run(["fetch", "zkusebni", "5359"])).code, 2, "which images?");
  assert.equal((await w.run(["fetch", "zkusebni", "5359", "--images", "1-1001"])).code, 2, "not more than a thousand at once");
  w.cleanup();
  await a.close();
});
