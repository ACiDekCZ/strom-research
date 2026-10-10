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
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { World, hasGit, fakeConnector, pluginDir, readJsonFile } from "../helpers.ts";
import { testHooks, DEFAULT_PACE } from "../../src/core/net.ts";
import { fenceKeepsNetOff, sandboxedRun } from "../../src/core/connector.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { decodeJpeg } from "../../src/image/jpeg-decode.ts";
import { blank } from "../../src/image/image.ts";
import { removeLogin, saveLogin } from "../../src/core/logins.ts";
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
  // the SDK and the template a connector is built from are MIT, their whole notice in each copy: a connector is its author's to license
  const mit = /^\/\/ SPDX-License-Identifier: MIT\n\/\/ Copyright \(c\) 2026 Milan Víšek\n\/\/\n\/\/ Permission is hereby granted, free of charge, [\s\S]*\/\/ The above copyright notice and this permission notice shall be included in\n\/\/ all copies or substantial portions of the Software\.\n[\s\S]*\/\/ OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\n\/\/ SOFTWARE\.\n\n\/\/ /;
  for (const file of [path.join(dir, "sdk.ts"), path.join(dir, "connector.ts"), path.join(w.home, "shared", "plugins", "connectors", "sdk.ts")]) assert.match(fs.readFileSync(file, "utf8"), mit, file);
  assert.match(fs.readFileSync(path.join(dir, "connector.ts"), "utf8"), /SOFTWARE\.\n\n\/\/ A strom connector for Státní archiv Čížkov \(https:\/\/digi\.example\.org\)/, "the template filled in below its notice");
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

// A live run left a connector that downloads nothing (the portal guards its files with a token) in the plugins folder.
test("connector discard: one started in the session at work that serves nothing is taken away by its agent; any other stays the user's", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  await w.ok(["research", "new", "Předci Kryštofa", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1802"]);
  await w.ok(["task", "add", "Kde jsou matriky Žďáru", "--level", "locate", "--where", "archiv", "--why", "křest", "--done-when", "odkaz"]);
  // one made before the session: not this session's
  await w.ok(["connector", "new", "drivejsi", "--url", "https://old.example.org"]);
  await w.ok(["session", "start", "T1"]);
  await w.ok(["connector", "new", "zdarsky-archiv", "--url", "https://digi.example.org", "--title", "Archiv Žďár"]);
  const before = await w.run(["connector", "discard", "drivejsi"]);
  assert.equal(before.code, 2);
  assert.match(before.err, /drivejsi was not started in the session at work — taking it away is the user's[\s\S]*strom connector remove drivejsi/);
  assert.ok(fs.existsSync(pluginDir(w, "drivejsi")));
  assert.equal((await w.run(["connector", "discard", "nic-takoveho"])).code, 2);
  // the user's login for it: theirs to take away
  saveLogin(w.env, "zdarsky-archiv", { dir: pluginDir(w, "zdarsky-archiv"), hosts: ["digi.example.org"], values: { user: "u", password: "p" }, at: new Date().toISOString() });
  const login = await w.run(["connector", "discard", "zdarsky-archiv"]);
  assert.equal(login.code, 2);
  assert.match(login.err, /the user saved a login for zdarsky-archiv — taking it away is theirs/);
  removeLogin(w.env, "zdarsky-archiv");
  const r = await w.ok(["connector", "discard", "zdarsky-archiv"]);
  assert.match(r.out, /connector zdarsky-archiv taken away[\s\S]*strom lesson add "…" --on R…/);
  assert.ok(!fs.existsSync(pluginDir(w, "zdarsky-archiv")));
  assert.doesNotMatch((await w.ok(["connector", "list"])).out, /zdarsky-archiv/);
  // a connector of an earlier session: after it closed, its agent no longer takes it away
  await w.ok(["connector", "new", "dalsi", "--url", "https://next.example.org"]);
  await w.ok(["session", "close", "--continue", "--summary", "hledáno", "--next", "dál"]);
  await w.ok(["session", "start", "T1"]);
  assert.equal((await w.run(["connector", "discard", "dalsi"])).code, 2);
  assert.ok(fs.existsSync(pluginDir(w, "dalsi")));
  // the agent knows when: the discovery brief and the guide
  assert.match(fs.readFileSync(path.join(pluginDir(w, "dalsi"), "DISCOVERY.md"), "utf8"), /can neither fetch nor find anything[\s\S]*does not stay in the plugins folder[\s\S]*strom lesson add[\s\S]*strom connector discard dalsi[\s\S]*One that finds books but fetches no images stays/);
  assert.match((await w.ok(["guide"])).out, /strom connector discard <name> {7}one you started this session that can neither fetch nor find/);
  w.cleanup();
});

// A marker of strom connector new must never point at somebody else's or an older folder of the same name.
test("connector new takes over nothing in the plugins folder: a folder without a connector, a file, a link, the same name in other capitals", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  await w.ok(["research", "new", "Předci Kryštofa", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1802"]);
  await w.ok(["task", "add", "Kde jsou matriky Žďáru", "--level", "locate", "--where", "archiv", "--why", "křest", "--done-when", "odkaz"]);
  await w.ok(["session", "start", "T1"]);
  await w.ok(["connector", "list"]); // the plugins folder made
  const plugins = path.join(w.home, "shared", "plugins", "connectors");
  const elsewhere = path.join(w.dir, "jinde");
  fs.mkdirSync(elsewhere);
  fs.writeFileSync(path.join(elsewhere, "cizi.txt"), "x");
  fs.mkdirSync(path.join(plugins, "prazdna")); // copied in half, or somebody's notes: no connector.json
  fs.writeFileSync(path.join(plugins, "soubor"), "x");
  fs.mkdirSync(path.join(plugins, "Velka"));
  const links = process.platform !== "win32";
  if (links) {
    fs.symlinkSync(elsewhere, path.join(plugins, "odkaz"));
    fs.symlinkSync(path.join(w.dir, "nikde"), path.join(plugins, "mrtvy")); // a link to nothing
  }
  for (const name of ["prazdna", "soubor", "velka", ...(links ? ["odkaz", "mrtvy"] : [])]) {
    const r = await w.run(["connector", "new", name, "--url", "https://digi.example.org"]);
    assert.equal(r.code, 2, `${name}: ${r.out}${r.err}`);
    assert.match(r.err, new RegExp(`is there already — a new connector never takes over what is in the plugins folder[\\s\\S]*another name: strom connector new ${name}-2 --url https://digi.example.org/`), name);
    assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "connectors-made", `${name}.json`)), `${name}: no marker`);
  }
  assert.deepEqual(fs.readdirSync(plugins).filter((n) => !/\./.test(n)).sort(), ["Velka", "prazdna", "soubor", ...(links ? ["mrtvy", "odkaz"] : [])].sort(), "nothing made beside them");
  assert.deepEqual(fs.readdirSync(path.join(plugins, "prazdna")), []);
  assert.deepEqual(fs.readdirSync(elsewhere), ["cizi.txt"]);
  if (links) assert.equal(fs.readlinkSync(path.join(plugins, "mrtvy")), path.join(w.dir, "nikde"));
  // a name with accents is no connector's name, in either form of its letters: the one to use is said
  for (const name of ["státní".normalize("NFC"), "státní".normalize("NFD")]) {
    const r = await w.run(["connector", "new", name, "--url", "https://digi.example.org"]);
    assert.equal(r.code, 2);
    assert.match(r.err, /lowercase letters, digits and dashes[\s\S]*e\.g\. statni/);
  }
  // another name is fine
  await w.ok(["connector", "new", "prazdna-2", "--url", "https://digi.example.org"]);
  assert.ok(fs.existsSync(path.join(w.cwd, ".strom", "connectors-made", "prazdna-2.json")));
  w.cleanup();
});

test("connector discard takes away only the very folder its session made, of this research", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  await w.ok(["research", "new", "Předci Kryštofa", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1802"]);
  await w.ok(["task", "add", "Kde jsou matriky Žďáru", "--level", "locate", "--where", "archiv", "--why", "křest", "--done-when", "odkaz"]);
  await w.ok(["session", "start", "T1"]);
  // a name is a folder's name and nothing more
  for (const name of ["../connectors", "a/b", "a\\b", ".", "..", ".skryty", "Velka"]) {
    const r = await w.run(["connector", "discard", name]);
    assert.equal(r.code, 2, name);
    assert.match(r.err, /is not a connector's name: lowercase letters, digits and dashes/, name);
  }
  assert.ok(fs.existsSync(path.join(w.home, "shared", "plugins", "connectors", "README.md")));
  const made = (name: string) => path.join(w.cwd, ".strom", "connectors-made", `${name}.json`);
  // a folder put in the place of the one it made (removed by the user, another one copied in)
  await w.ok(["connector", "new", "nahrazeny", "--url", "https://a.example.org"]);
  fs.rmSync(pluginDir(w, "nahrazeny"), { recursive: true });
  fs.mkdirSync(pluginDir(w, "nahrazeny"));
  fs.writeFileSync(path.join(pluginDir(w, "nahrazeny"), "connector.json"), "{}");
  const replaced = await w.run(["connector", "discard", "nahrazeny"]);
  assert.equal(replaced.code, 2);
  assert.match(replaced.err, /the folder of nahrazeny is not the one this session made — taking it away is the user's[\s\S]*strom connector remove nahrazeny/);
  assert.ok(fs.existsSync(path.join(pluginDir(w, "nahrazeny"), "connector.json")));
  // its folder moved out and a link left in its place: what the link leads to is never taken
  if (process.platform !== "win32") {
    await w.ok(["connector", "new", "odkazany", "--url", "https://b.example.org"]);
    const out = path.join(w.dir, "venku");
    fs.renameSync(pluginDir(w, "odkazany"), out);
    fs.symlinkSync(out, pluginDir(w, "odkazany"));
    const link = await w.run(["connector", "discard", "odkazany"]);
    assert.equal(link.code, 2);
    assert.match(link.err, /the folder of odkazany is not the one this session made/);
    assert.ok(fs.existsSync(path.join(out, "connector.json")) && fs.lstatSync(pluginDir(w, "odkazany")).isSymbolicLink());
  }
  // a marker of another research (its .strom copied over), or of another direction of this one, names no session here
  await w.ok(["connector", "new", "cizi-znacka", "--url", "https://c.example.org"]);
  const mark = readJsonFile(made("cizi-znacka"));
  assert.equal(mark.session, "N0001");
  assert.equal(mark.research, "G0001");
  assert.equal(mark.tree, readJsonFile(path.join(w.cwd, "strom.json")).id);
  fs.writeFileSync(made("cizi-znacka"), JSON.stringify({ ...mark, tree: "jiny-strom" }));
  assert.equal((await w.run(["connector", "discard", "cizi-znacka"])).code, 2);
  fs.writeFileSync(made("cizi-znacka"), JSON.stringify({ ...mark, research: "G0009" }));
  assert.equal((await w.run(["connector", "discard", "cizi-znacka"])).code, 2);
  fs.writeFileSync(made("cizi-znacka"), JSON.stringify({ session: mark.session, at: mark.at })); // a marker that says no folder
  assert.equal((await w.run(["connector", "discard", "cizi-znacka"])).code, 2);
  assert.ok(fs.existsSync(pluginDir(w, "cizi-znacka")));
  fs.writeFileSync(made("cizi-znacka"), JSON.stringify(mark));
  await w.ok(["connector", "discard", "cizi-znacka"]);
  assert.ok(!fs.existsSync(pluginDir(w, "cizi-znacka")) && !fs.existsSync(made("cizi-znacka")));
  // made outside a session, the name of one made in it before: the old marker goes with it
  await w.ok(["connector", "new", "znovu", "--url", "https://d.example.org"]);
  await w.ok(["session", "close", "--continue", "--summary", "hledáno", "--next", "dál"]);
  fs.rmSync(pluginDir(w, "znovu"), { recursive: true });
  await w.ok(["connector", "new", "znovu", "--url", "https://d.example.org"]);
  assert.ok(!fs.existsSync(made("znovu")));
  w.cleanup();
});

test("connector discard: one used meanwhile by another session or another research stays the user's", opts, async () => {
  const w = new World();
  await w.withTree("Dvořákovi");
  const a = await archive();
  await w.ok(["research", "new", "Předci Kryštofa", "--new-person", "Kryštof /Žďárský/", "--sex", "M", "--born", "1802"]);
  for (const what of ["Kde jsou matriky Žďáru", "Kde jsou matriky Týnce"]) await w.ok(["task", "add", what, "--level", "locate", "--where", "archiv", "--why", "křest", "--done-when", "odkaz"]);
  const A = { STROM_WORKER: "claude-a" };
  const B = { STROM_WORKER: "codex-b" };
  await w.ok(["session", "start", "T1"], { env: A }); // N0001
  w.env.STROM_WORKER = A.STROM_WORKER;
  const names = ["jen-moje", "stahuje-jiny", "zkouseny-jinym", "citovany-jinym", "v-jinem-vyzkumu", "merene-jinde"];
  for (const name of names) await fakeConnector(w, name, a.base);
  delete w.env.STROM_WORKER;
  for (const name of names) assert.equal(readJsonFile(path.join(w.cwd, ".strom", "connectors-made", `${name}.json`)).session, "N0001");
  // the session's own use takes nothing from it
  await w.ok(["connector", "test", "jen-moje", "--find", "Týnec"], { env: A });
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`], { env: A }); // B0001
  await w.ok(["fetch", "citovany-jinym", "5359", "--images", "2", "--recordset", "B1"], { env: A });
  // another session of this research: images fetched with it, a run of it, a source citing what it fetched
  await w.ok(["session", "start", "T2"], { env: B }); // N0002
  await w.ok(["fetch", "stahuje-jiny", "5359", "--images", "1", "--recordset", "B1"], { env: B });
  await w.ok(["connector", "test", "zkouseny-jinym", "--find", "Týnec"], { env: B });
  await w.ok(["source", "add", "Křest Jana", "--kind", "baptism", "--recordset", "B1", "--media", "B1:2"], { env: B });
  // another research on this computer: images fetched with it, a run of it
  await w.ok(["init", "Druzí"]);
  const other = w.treeDir("Druzí");
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`], { cwd: other });
  await w.ok(["fetch", "v-jinem-vyzkumu", "5359", "--images", "3", "--recordset", "B1"], { cwd: other });
  await w.ok(["connector", "test", "merene-jinde", "--find", "Týnec"], { cwd: other });
  const refused: [string, RegExp][] = [
    ["stahuje-jiny", /session N0002 of this research \(media\.\S+ M\d+\)/],
    ["zkouseny-jinym", /session N0002 of this research \(a run of it measured/],
    ["citovany-jinym", /session N0002 of this research \(source\.\S+ S\d+\)/],
    ["v-jinem-vyzkumu", /the research "Druzí" \(1 image fetched\)/],
    ["merene-jinde", /the research "Druzí" \(1 run of it measured\)/],
  ];
  for (const [name, why] of refused) {
    const r = await w.run(["connector", "discard", name], { env: A });
    assert.equal(r.code, 2, `${name}: ${r.out}`);
    assert.match(r.err, new RegExp(`${name} was used meanwhile by [\\s\\S]*${why.source}[\\s\\S]*taking it away is the user's[\\s\\S]*the user, in their terminal: strom connector remove ${name}`), name);
    assert.ok(fs.existsSync(path.join(pluginDir(w, name), "connector.json")), name);
  }
  await w.ok(["connector", "discard", "jen-moje"], { env: A });
  assert.ok(!fs.existsSync(pluginDir(w, "jen-moje")));
  await a.close();
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
  assert.match(r.out, /Connector kopie [\d.]+ — Testovací archiv[\s\S]*its code seems to use no network of its own \(a check of its words, not a guarantee\); it runs in Node.s permission model, so the agent may go on improving it/);
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

/** Change what the manifest runs (the rest stays). */
function runs(dir: string, run: string[]): void {
  const f = path.join(dir, "connector.json");
  fs.writeFileSync(f, JSON.stringify({ ...readJsonFile(f), run }, null, 2));
}

test("sandboxedRun: only node and files of the connector's own folder run fenced in", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-sandbox-"));
  fs.writeFileSync(path.join(dir, "connector.ts"), "");
  fs.mkdirSync(path.join(dir, "lib"));
  fs.writeFileSync(path.join(dir, "lib", "část.ts"), "");
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "strom-outside-"));
  fs.writeFileSync(path.join(outside, "x.ts"), "");
  fs.symlinkSync(path.join(outside, "x.ts"), path.join(dir, "link.ts"));
  const fenced = (run: string[]) => sandboxedRun({ dir, manifest: { run } });
  assert.equal(fenced(["node", "connector.ts"]), true);
  assert.equal(fenced(["node", "lib/část.ts".normalize("NFD")]) || fenced(["node", "lib/část.ts"]), true, "a file of a folder in it");
  for (const run of [
    ["node"],
    ["node", "--allow-child-process", "connector.ts"],
    ["node", "connector.ts", "--allow-fs-read=/"],
    ["node", "-e", "1"],
    ["node", "--eval=1"],
    ["node", "missing.ts"],
    ["node", "../connector.ts"],
    ["node", "lib/../connector.ts"],
    ["node", path.join(dir, "connector.ts")],
    ["node", "C:\\x\\connector.ts"],
    ["node", "link.ts"],
    ["node", "lib"],
    ["node.exe", "connector.ts"],
    [process.execPath, "connector.ts"],
    ["/bin/sh", "-c", "whoami"],
    ["cmd", "/c", "whoami"],
    ["python3", "main.py"],
    ["env", "node", "connector.ts"],
  ])
    assert.equal(fenced(run), false, run.join(" "));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

test("a program strom does not fence in runs only with the person's yes to its code as it is — consents off or on, whatever the check of its words finds", opts, async () => {
  const { w, a, dir } = await world();
  const ran = path.join(dir, ".test", "ran.txt");
  const shell = process.platform === "win32" ? ["cmd", "/c", "echo ran> .test\\ran.txt"] : ["/bin/sh", "-c", "echo ran > .test/ran.txt"];
  // a fenced connector: no window, run in Node's permission model, no switch of the manifest's in it
  const code = fs.readFileSync(path.join(dir, "connector.ts"), "utf8").replace("const req = await request();", 'log("argv " + JSON.stringify(process.execArgv));\nconst req = await request();');
  program(dir, code);
  const clean = await w.ok(["connector", "test", "zkusebni", "--find", "Týnec"]);
  assert.match(clean.out, /Týnec N 1784–1820/);
  assert.match(clean.out, /argv \[[^\n]*"--permission"/);
  assert.doesNotMatch(clean.out, /allow-child-process/);
  // another program, a shell: refused without the person, whatever its words
  runs(dir, shell);
  const sh = await w.run(["connector", "test", "zkusebni", "--find", "Týnec", "--json"]);
  assert.equal(sh.code, 4);
  assert.match(sh.out, /runs a program strom does not fence in/);
  assert.equal(fs.existsSync(ran), false, "nothing ran");
  assert.match((await w.ok(["connector", "list"])).out, /zkusebni\s.*needs a consent\n/);
  assert.equal((await w.run(["allow", "connector", "zkusebni"])).code, 4, "consents off: still the person's yes");
  const yes = await w.run(["allow", "connector", "zkusebni"], { tty: true, answers: ["y"] });
  assert.equal(yes.code, 0, yes.err);
  assert.match(yes.out, /not in Node's permission model/);
  assert.doesNotMatch(yes.out, /no network of its own/);
  await w.run(["connector", "test", "zkusebni", "--find", "Týnec"]); // it ends without a word of the contract: only that it ran counts
  assert.equal(fs.existsSync(ran), true, "the person allowed it");
  fs.appendFileSync(path.join(dir, "connector.ts"), "\n// one more line\n");
  const changed = await w.run(["connector", "test", "zkusebni", "--find", "Týnec", "--json"]);
  assert.equal(changed.code, 4, "every change: asked again");
  assert.match(changed.out, /its code changed since it was allowed/);
  // Python naming a function the check of words does not know: not fenced in, so asked all the same
  fs.writeFileSync(path.join(dir, "main.py"), 'from os import system\nsystem("whoami")\n');
  runs(dir, ["python3", "main.py"]);
  assert.equal((await w.run(["connector", "test", "zkusebni", "--find", "Týnec"])).code, 4);
  fs.rmSync(path.join(dir, "main.py"));
  // node opening its own fence: asked; with the yes it runs as the person saw it
  runs(dir, ["node", "--allow-child-process", "connector.ts"]);
  assert.equal((await w.run(["connector", "test", "zkusebni", "--find", "Týnec"])).code, 4);
  assert.equal((await w.run(["allow", "connector", "zkusebni"], { tty: true, answers: ["y"] })).code, 0);
  assert.match((await w.ok(["connector", "test", "zkusebni", "--find", "Týnec"])).out, /argv [^\n]*allow-child-process/);
  // back to the fenced shape: no window again
  runs(dir, ["node", "connector.ts"]);
  assert.match((await w.ok(["connector", "test", "zkusebni", "--find", "Týnec"])).out, /Týnec N 1784–1820/);
  // consents on: the folder allowed once — a fenced connector improved goes on, a shell put in its place does not
  await w.ok(["config", "set", "connectors.consent", "on"]);
  assert.equal((await w.run(["allow", "connector", "zkusebni"], { tty: true, answers: ["y", "y"] })).code, 0);
  fs.appendFileSync(path.join(dir, "connector.ts"), "\n// improved\n");
  assert.match((await w.ok(["connector", "test", "zkusebni", "--find", "Týnec"])).out, /Týnec N 1784–1820/);
  fs.rmSync(ran, { force: true });
  runs(dir, shell);
  const on = await w.run(["connector", "test", "zkusebni", "--find", "Týnec", "--json"]);
  assert.equal(on.code, 4, "consents on: the code compared all the same");
  assert.match(on.out, /changed since it was allowed/);
  assert.equal(fs.existsSync(ran), false);
  w.cleanup();
  await a.close();
});

test("the fence keeps a connector off the network from Node 25 on; doctor says so where the Node is the person's own", opts, async () => {
  for (const [v, off] of [["v24.21.0", false], ["v22.18.0", false], ["v25.0.0", true], ["v26.9.0", true], ["26.1.0", true]] as const) assert.equal(fenceKeepsNetOff(v), off, v);
  const { w, a } = await world();
  const doc = await w.run(["doctor", "--json"]);
  const fence = (doc.json?.checks ?? []).find((c: { name: string }) => c.name === "fence");
  if (fenceKeepsNetOff(process.version)) assert.equal(fence, undefined, "a Node that fences the network: nothing to say");
  else assert.match(fence?.detail ?? "", /only Node 25 or newer also keeps them off the network/);
  w.cleanup();
  await a.close();
});

test("an agent outside the research's folder: reading goes on, a connector and the agent working alone only with the person's yes", opts, async () => {
  const { w, a, dir } = await world();
  const agent = new World();
  Object.assign(agent.env, w.env, { CLAUDECODE: "1" });
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "strom jiný repozitář ž-"));
  agent.cwd = elsewhere;
  assert.equal((await agent.run(["person", "list"])).code, 0, "reading: as before");
  const t = await agent.run(["connector", "test", "zkusebni", "--find", "Týnec", "--json"]);
  assert.equal(t.code, 4);
  assert.match(t.out, /asked by an agent outside the research's folder\? \(an agent cannot answer this\)/);
  const f = await agent.run(["fetch", "zkusebni", "5359", "--images", "1", "--json"]);
  assert.equal(f.code, 4);
  assert.match(f.out, /Run connector zkusebni \(Testovací archiv\) — asked by an agent outside/);
  const run = await agent.run(["run", "--agent", "script", "--json"]);
  assert.equal(run.code, 4);
  assert.match(run.out, /Start the agent working alone on this research/);
  // in the research's folder, in strom's own shared folder (where its connectors are built), or started by strom: no window
  agent.cwd = w.cwd;
  assert.match((await agent.ok(["connector", "test", "zkusebni", "--find", "Týnec"])).out, /Týnec N 1784–1820/);
  agent.cwd = dir;
  assert.match((await agent.ok(["connector", "test", "zkusebni", "--find", "Týnec"])).out, /Týnec N 1784–1820/);
  agent.cwd = elsewhere;
  agent.env.STROM_WORKER = "w-test";
  assert.match((await agent.ok(["connector", "test", "zkusebni", "--find", "Týnec"])).out, /Týnec N 1784–1820/);
  // the person in their own terminal anywhere: as before
  w.cwd = elsewhere;
  assert.match((await w.ok(["connector", "test", "zkusebni", "--find", "Týnec"])).out, /Týnec N 1784–1820/);
  fs.rmSync(elsewhere, { recursive: true, force: true });
  w.cleanup();
  agent.cleanup();
  await a.close();
});

test("fetch --images takes a list (a book sampled): only those images asked for and registered", opts, async () => {
  const { w, a } = await world();
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism", "--url", `${a.base}/book/5359`]); // B0001
  const dry = await w.ok(["fetch", "zkusebni", "5359", "--images", "3,1", "--recordset", "B1", "--dry-run"]);
  assert.match(dry.out, /would fetch images 1, 3 of book 5359/);
  const r = await w.ok(["fetch", "zkusebni", "5359", "--images", "1,3", "--recordset", "B1"]);
  assert.match(r.out, /2 image\(s\) of B0001 \(images 1, 3\) fetched and registered/);
  assert.deepEqual(a.hits.filter((h) => h.includes("/img/")).sort(), ["/img/5359/1.jpg", "/img/5359/3.jpg"]);
  // what strom says back is taken as it is said (an en dash, a space after the comma); nothing new here
  assert.match((await w.ok(["fetch", "zkusebni", "5359", "--images", "1–1, 3", "--recordset", "B1"])).out, /registered already — nothing fetched/);
  assert.equal((await w.run(["fetch", "zkusebni", "5359", "--images", "1,x"])).code, 2);
  w.cleanup();
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
  // (its book unknown yet: how to find it)
  assert.match((await w.ok(["brief", "T1"])).out, /no images here yet — the connector fetches the ones you need\n {4}fetch: zkusebni <book: its ID on the portal — strom fetch zkusebni --find "<place>" lists them> — strom fetch zkusebni <book> --images <from-to> --recordset B0001\n/);
  await w.ok(["task", "wait", "T1", "--on", "images 1–3 of B0001"]);
  const dry = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1", "--dry-run"]);
  assert.match(dry.out, /dry run: would fetch images 1–3 of book 5359 as images of B0001 through zkusebni — nothing was fetched/);
  assert.deepEqual(a.hits, [], "a dry run never contacts the archive");
  pauses.length = 0;
  const r = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-3", "--recordset", "B1"]);
  assert.match(r.err, /3 image\(s\) through zkusebni: at least 3 request\(s\) to 127\.0\.0\.1, about 4 s at its pace \(≥2 s apart\)\n/);
  assert.doesNotMatch(r.err, /hourly cap/, "no cap: none said");
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
  // the brief: the book known from its images, in the form fetch takes it; another book of the archive by its address
  assert.match((await w.ok(["brief", "T1"])).out, /\n {4}images registered \(3\): 1–3 · [^\n]*\n {4}weak scans \(long side 400 px\): a negative on them is weak — [^\n]*\n {4}fetch: zkusebni 5359 — strom fetch zkusebni 5359 --images <from-to> --recordset B0001\n/);
  await w.ok(["recordset", "add", "Týnec Z 1784–1820", "--kinds", "burial", "--url", `${a.base}/book/6012`]); // B0002
  await w.ok(["recordset", "add", "Týnec, katalog", "--kinds", "index", "--url", `${a.base}/catalog?place=T%C3%BDnec`]); // B0003
  await w.ok(["task", "add", "Pohřeb", "--level", "link", "--where", "B2", "--where", "B3", "--why", "a", "--done-when", "b"]); // T2
  const t2 = (await w.ok(["brief", "T2"])).out;
  assert.match(t2, /\n {4}no images here yet — the connector fetches the ones you need\n {4}fetch: zkusebni 6012 — strom fetch zkusebni 6012 --images <from-to> --recordset B0002\n/);
  // an address of another shape: no book guessed — and the whole command said once
  assert.match(t2, /\n {4}fetch: zkusebni <book: its ID on the portal — strom fetch zkusebni --find "<place>" lists them>\n/);
  // the sheet names the connector of the task's books
  assert.match(t2, /\n {2}connectors of these places: zkusebni — books of a place: strom fetch <connector> --find "<place>" --years <from-to>\n/);
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
