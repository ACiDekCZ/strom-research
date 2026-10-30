// Two seal keys of one person on one computer: Claude's desktop app on Windows is packaged (MSIX), and every file a
// strom it started made in %APPDATA%\strom went to the app's private copy — a strom of the app and a strom of the
// terminal each had their own key for one research, each refusing the other's writes as made outside strom (found
// 2026-10-30). The settings are outside AppData now; the old folders are read (STROM_TEST_OLD_SETTINGS stands for
// them): the key that sealed the last commit is taken by itself, else the person unites the keys in a terminal — every
// operation and record checked, nothing lost, a record changed outside strom still refused, never by an agent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit };

/**
 * A research split as 1.22.1 split it: the app's strom (its settings P) made it, the terminal's (T) took it over and
 * wrote last — the last commit sealed with T's key. Then the environments of today: the terminal sees both old
 * folders, the app sees only its own copy (twice: %APPDATA%\strom and the copy read by its path).
 */
async function split() {
  const w = new World();
  const P = path.join(w.dir, "old-app");
  const T = path.join(w.dir, "old-terminal");
  const N = path.join(w.dir, "settings");
  await w.ok(["setup", "--yes"], { env: { STROM_CONFIG_DIR: P } });
  w.historyAsked({ STROM_CONFIG_DIR: P });
  await w.ok(["init", "Lhotákovi"], { env: { STROM_CONFIG_DIR: P } });
  w.cwd = w.treeDir("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"], { env: { STROM_CONFIG_DIR: P } });
  await w.ok(["setup", "--yes"], { env: { STROM_CONFIG_DIR: T } });
  w.historyAsked({ STROM_CONFIG_DIR: T });
  await w.ok(["seal", "adopt"], { env: { STROM_CONFIG_DIR: T }, tty: true, answers: [""] });
  await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F"], { env: { STROM_CONFIG_DIR: T } });
  // as 1.22.1 left it: the app's side refuses (the last commit is not its)
  assert.equal((await w.run(["person", "add", "Ota /Lhoták/", "--sex", "M"], { env: { STROM_CONFIG_DIR: P } })).code, 1);
  const id = readJsonFile(path.join(w.cwd, "strom.json")).id as string;
  const key = (dir: string) => fs.readFileSync(path.join(dir, "keys", `${id}.key`), "utf8");
  const terminal = { STROM_CONFIG_DIR: N, STROM_TEST_OLD_SETTINGS: [T, P].join(path.delimiter) };
  const app = { STROM_CONFIG_DIR: N, STROM_TEST_OLD_SETTINGS: [P, P].join(path.delimiter), STROM_TEST_PACKAGED: "1" };
  return { w, P, T, N, key, terminal, app, before: { P: key(P), T: key(T) } };
}

test("the terminal first after the update: the key of the last commit taken, both sides write, nothing lost", opts, async () => {
  const { w, P, T, N, key, terminal, app, before } = await split();
  assert.equal((await w.run(["check"], { env: terminal })).code, 0);
  assert.equal(key(N), before.T, "the key that sealed the last commit, kept in today's folder");
  await w.ok(["person", "add", "Petr /Lhoták/", "--sex", "M"], { env: terminal });
  await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F"], { env: app });
  await w.ok(["verify"], { env: app });
  await w.ok(["verify"], { env: terminal });
  const people = (await w.ok(["person", "list", "--json"], { env: terminal })).json.persons.map((p: { name: string }) => p.name).sort();
  assert.deepEqual(people, ["Anna Lhotáková", "Eva Lhotáková", "Jan Lhoták", "Petr Lhoták"]);
  // the old folders as they were: an older strom reads them still
  assert.equal(key(P), before.P);
  assert.equal(key(T), before.T);
  // the settings taken over from the terminal's old folder
  assert.ok(fs.existsSync(path.join(N, "config.json")));
  w.cleanup();
});

test("the app first after the update: never git used directly, never strom repair — the person unites the keys in a terminal", opts, async () => {
  const { w, N, key, terminal, app, before } = await split();
  // the app's agent: refused, what the person does, never strom repair
  const write = await w.run(["person", "add", "Petr /Lhoták/", "--sex", "M", "--json"], { env: { ...app, CLAUDECODE: "1" } });
  assert.equal(write.code, 4, write.out + write.err);
  assert.equal(write.json.code, "seal.other-key");
  assert.match(JSON.stringify(write.json), /strom seal adopt/);
  assert.equal(key(N), before.P, "the one key the app saw");
  const appCheck = await w.run(["check"], { env: app, tty: true });
  assert.match(appCheck.out, /other-key/, appCheck.out);
  assert.doesNotMatch(appCheck.out, /foreign-commit|forged-op|→ strom repair/, appCheck.out);
  // the terminal: the same, in the research's language
  const check = await w.run(["check"], { env: terminal, tty: true });
  assert.match(check.out, /other-key +zapečetěno dvěma klíči stromu na tomto počítači/, check.out);
  assert.match(check.out, /→ sjednotit ve vlastním terminálu: strom seal adopt – nikdy strom repair/, check.out);
  assert.doesNotMatch(check.out, /foreign-commit|forged-op/, check.out);
  // never united by an agent, nor without a terminal
  assert.equal((await w.run(["seal", "adopt", "--json"], { env: { ...terminal, CLAUDECODE: "1" } })).code, 4);
  assert.equal((await w.run(["seal", "adopt"], { env: terminal })).code, 4);
  // said no: nothing changes
  const no = await w.run(["seal", "adopt"], { env: terminal, tty: true, answers: ["n"] });
  assert.notEqual((await w.run(["check"], { env: terminal })).code, 0, no.out);
  // the person's yes
  const yes = await w.ok(["seal", "adopt"], { env: terminal, tty: true, answers: [""] });
  assert.match(yes.out, /jedním klíčem/, yes.out);
  for (const env of [terminal, app]) await w.ok(["check"], { env });
  await w.ok(["person", "add", "Petr /Lhoták/", "--sex", "M"], { env: app });
  await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F"], { env: terminal });
  for (const env of [terminal, app]) await w.ok(["verify"], { env });
  // asked again: nothing more to unite
  assert.match((await w.ok(["seal", "adopt"], { env: terminal, tty: true })).out, /zapečetěný už|already/, "already");
  w.cleanup();
});

test("uniting refuses a record changed outside strom: the seal stays as it was", opts, async () => {
  const { w, terminal, app } = await split();
  await w.run(["check"], { env: app });
  const people = fs.readdirSync(path.join(w.cwd, "data", "persons"));
  const file = path.join(w.cwd, "data", "persons", people[0]!);
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Lhoták", "Lhota"));
  const r = await w.run(["seal", "adopt"], { env: terminal, tty: true, answers: [""] });
  assert.notEqual(r.code, 0, r.out + r.err);
  assert.match(r.out + r.err, /manual-edit +P0001/, r.out + r.err);
  const check = await w.run(["check"], { env: terminal });
  assert.notEqual(check.code, 0);
  assert.doesNotMatch(execFileSync("git", ["log", "--format=%s"], { cwd: w.cwd, encoding: "utf8" }), /keys of this computer united/);
  w.cleanup();
});

test("the menu offers uniting once, at a terminal", opts, async () => {
  const { w, terminal, app } = await split();
  await w.run(["check"], { env: app });
  const menu = await w.run([], { env: terminal, tty: true, answers: ["", "0"] });
  assert.match(menu.out, /dvěma klíči stromu/, menu.out);
  await w.ok(["check"], { env: terminal });
  w.cleanup();
});

test("Windows with a terminal only: the key of before goes on, nothing moved; back on the older strom everything is found", opts, async () => {
  const w = new World();
  const T = path.join(w.dir, "old-terminal");
  const N = path.join(w.dir, "settings");
  // 1.22.1 in a terminal: the research made and written
  await w.ok(["setup", "--yes"], { env: { STROM_CONFIG_DIR: T } });
  w.historyAsked({ STROM_CONFIG_DIR: T });
  await w.ok(["init", "Lhotákovi"], { env: { STROM_CONFIG_DIR: T } });
  w.cwd = w.treeDir("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"], { env: { STROM_CONFIG_DIR: T } });
  const id = readJsonFile(path.join(w.cwd, "strom.json")).id as string;
  const key = (dir: string, of = id) => fs.readFileSync(path.join(dir, "keys", `${of}.key`), "utf8");
  const before = key(T);
  // the update: the same key, the old one left where it was
  const now = { STROM_CONFIG_DIR: N, STROM_TEST_OLD_SETTINGS: T };
  await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F"], { env: now });
  await w.ok(["verify"], { env: now });
  assert.equal(key(N), before);
  assert.equal(key(T), before);
  // a research made after the update: its key also where the older strom looks
  await w.ok(["init", "Lhotovi"], { env: now });
  const second = readJsonFile(path.join(w.treeDir("Lhotovi"), "strom.json")).id as string;
  assert.equal(key(T, second), key(N, second));
  // back on the older strom (its settings folder alone): both researches written on, nothing refused
  await w.ok(["person", "add", "Petr /Lhoták/", "--sex", "M"], { env: { STROM_CONFIG_DIR: T } });
  await w.ok(["verify"], { env: { STROM_CONFIG_DIR: T } });
  await w.ok(["person", "add", "Ota /Lhota/", "--sex", "M"], { env: { STROM_CONFIG_DIR: T }, cwd: w.treeDir("Lhotovi") });
  await w.ok(["verify"], { env: { STROM_CONFIG_DIR: T }, cwd: w.treeDir("Lhotovi") });
  // and up again
  await w.ok(["check"], { env: now });
  w.cleanup();
});

test("strom doctor names two keys of this computer and unites them on the person's yes, never strom repair", opts, async () => {
  const { w, terminal, app } = await split();
  await w.run(["check"], { env: app });
  const doc = await w.run(["doctor"], { env: terminal, tty: true });
  assert.match(doc.out, /Lhotákovi: zapečetěno dvěma klíči stromu na tomto počítači.+→ strom seal adopt/, doc.out);
  assert.doesNotMatch(doc.out, /strom repair/, doc.out);
  // an agent: said, nothing done
  await w.run(["doctor", "--fix"], { env: { ...terminal, CLAUDECODE: "1" } });
  assert.notEqual((await w.run(["check"], { env: terminal })).code, 0);
  await w.run(["doctor", "--fix"], { env: terminal, tty: true, answers: Array(12).fill("") });
  await w.ok(["check"], { env: terminal });
  await w.ok(["check"], { env: app });
  w.cleanup();
});

test("a key taken from a packaged app's copy goes also where the terminal's older strom looks, nothing there replaced", opts, async () => {
  const w = new World();
  const P = path.join(w.dir, "old-app");
  const T = path.join(w.dir, "old-terminal");
  const N = path.join(w.dir, "settings");
  // 1.22.1: the research made in the app (its key in the app's copy alone), the terminal's own settings without that key
  await w.ok(["setup", "--yes"], { env: { STROM_CONFIG_DIR: P } });
  w.historyAsked({ STROM_CONFIG_DIR: P });
  await w.ok(["init", "Lhotákovi"], { env: { STROM_CONFIG_DIR: P } });
  w.cwd = w.treeDir("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"], { env: { STROM_CONFIG_DIR: P } });
  await w.ok(["setup", "--yes"], { env: { STROM_CONFIG_DIR: T } });
  const id = readJsonFile(path.join(w.cwd, "strom.json")).id as string;
  const keyOf = (dir: string) => path.join(dir, "keys", `${id}.key`);
  assert.equal(fs.existsSync(keyOf(T)), false);
  // the terminal after the update: the app's key taken, and put where 1.22.1 of the terminal reads
  const terminal = { STROM_CONFIG_DIR: N, STROM_TEST_OLD_SETTINGS: [T, P].join(path.delimiter) };
  await w.ok(["check"], { env: terminal });
  assert.equal(fs.readFileSync(keyOf(N), "utf8"), fs.readFileSync(keyOf(P), "utf8"));
  assert.equal(fs.readFileSync(keyOf(T), "utf8"), fs.readFileSync(keyOf(P), "utf8"));
  // taken over by an update before this one (today's folder has it, the old one not): put there by the next command
  fs.rmSync(keyOf(T));
  await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F"], { env: terminal });
  assert.equal(fs.readFileSync(keyOf(T), "utf8"), fs.readFileSync(keyOf(N), "utf8"));
  // back on the older strom of the terminal: written on, nothing refused
  await w.ok(["person", "add", "Petr /Lhoták/", "--sex", "M"], { env: { STROM_CONFIG_DIR: T } });
  await w.ok(["verify"], { env: { STROM_CONFIG_DIR: T } });
  // a key of its own there stays
  fs.writeFileSync(keyOf(T), "ab".repeat(32) + "\n");
  await w.run(["check"], { env: terminal });
  assert.equal(fs.readFileSync(keyOf(T), "utf8"), "ab".repeat(32) + "\n");
  w.cleanup();
});

/**
 * One key, the research made in the app (its strom sees its own copy only, the terminal's key out of its sight), then the
 * same research seen from the terminal: what the app's strom and the terminal's both see.
 */
async function oneKey() {
  const w = new World();
  const P = path.join(w.dir, "old-app");
  const N = path.join(w.dir, "settings");
  const app = { STROM_CONFIG_DIR: N, STROM_TEST_OLD_SETTINGS: [P, P].join(path.delimiter), STROM_TEST_PACKAGED: "1" };
  const terminal = { STROM_CONFIG_DIR: N, STROM_TEST_OLD_SETTINGS: P };
  await w.ok(["setup", "--yes"], { env: app });
  w.historyAsked(app);
  await w.ok(["init", "Lhotákovi"], { env: app });
  w.cwd = w.treeDir("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"], { env: app });
  await w.ok(["check"], { env: app });
  return { w, app, terminal };
}

const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=Lhoták", "-c", "user.email=l@example.org", ...args], { cwd, encoding: "utf8" });

test("a commit made with git in the packaged app's research is git used directly on both sides, never two keys", opts, async () => {
  const { w, app, terminal } = await oneKey();
  git(w.cwd, "commit", "--allow-empty", "-m", "x");
  for (const env of [app, terminal]) {
    const check = await w.run(["check"], { env, tty: true });
    assert.notEqual(check.code, 0);
    assert.match(check.out, /foreign-commit/, check.out);
    assert.doesNotMatch(check.out, /other-key|seal adopt/, check.out);
  }
  // the app's agent: refused as written outside strom, never sent to uniting
  const write = await w.run(["person", "add", "Petr /Lhoták/", "--sex", "M", "--json"], { env: { ...app, CLAUDECODE: "1" } });
  assert.notEqual(write.code, 0);
  assert.notEqual(write.code, 4, write.out + write.err);
  assert.doesNotMatch(write.out + write.err, /seal\.other-key|seal adopt/, write.out + write.err);
  // and what both advise does it: back to the last sealed state, both sides write on — said as it is: sealed again
  const repair = await w.ok(["repair", "--json"], { env: terminal });
  assert.equal(repair.json.resealed, true);
  assert.match((await w.run(["repair"], { env: terminal })).out, /není co opravit/, "sealed already: nothing more");
  for (const env of [app, terminal]) await w.ok(["check"], { env });
  await w.ok(["person", "add", "Petr /Lhoták/", "--sex", "M"], { env: app });
  await w.ok(["verify"], { env: terminal });
  w.cleanup();
});

test("a record changed and committed with git in the packaged app's research: changed outside strom, never two keys", opts, async () => {
  const { w, app } = await oneKey();
  const people = fs.readdirSync(path.join(w.cwd, "data", "persons"));
  const file = path.join(w.cwd, "data", "persons", people[0]!);
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Lhoták", "Lhota"));
  git(w.cwd, "commit", "-am", "x");
  const check = await w.run(["check"], { env: app, tty: true });
  assert.match(check.out, /foreign-commit/, check.out);
  assert.doesNotMatch(check.out, /other-key/, check.out);
  const write = await w.run(["person", "add", "Petr /Lhoták/", "--sex", "M", "--json"], { env: { ...app, CLAUDECODE: "1" } });
  assert.notEqual(write.code, 0);
  assert.doesNotMatch(write.out + write.err, /seal\.other-key/, write.out + write.err);
  w.cleanup();
});

test("a commit the terminal's strom sealed is still another key in the app, a commit with git on top of it is not", opts, async () => {
  const { w, app } = await split();
  assert.match((await w.run(["check"], { env: app, tty: true })).out, /other-key/);
  git(w.cwd, "commit", "--allow-empty", "-m", "x");
  const check = await w.run(["check"], { env: app, tty: true });
  assert.match(check.out, /foreign-commit/, check.out);
  w.cleanup();
});

test("the agents are kept from every packaged app's copy of strom's settings, one made after their rules too", opts, async () => {
  const w = new World();
  const N = path.join(w.dir, "settings");
  const packages = path.join(w.dir, "Packages");
  const env = { STROM_CONFIG_DIR: N, STROM_TEST_PACKAGES: packages };
  await w.ok(["setup", "--yes"], { env });
  w.historyAsked(env);
  await w.ok(["init", "Lhotákovi"], { env });
  w.cwd = w.treeDir("Lhotákovi");
  const fwd = (p: string) => p.replace(/\\/g, "/");
  const copies = `${fwd(path.join(packages, "*", "LocalCache", "Roaming", "strom"))}`;
  const deny = (readJsonFile(path.join(w.cwd, ".claude", "settings.json")) as { permissions: { deny: string[] } }).permissions.deny.map(fwd);
  for (const tool of ["Read", "Edit"]) assert.ok(deny.some((d) => d.startsWith(`${tool}(`) && d.endsWith(`${copies}/**)`)), `${tool}: ${deny.join("\n")}`);
  const grok = fs.readFileSync(path.join(w.cwd, ".grok", "config.toml"), "utf8");
  assert.ok(grok.includes(`${copies}/**`), grok);
  const opencode = readJsonFile(path.join(w.cwd, "opencode.json")) as { permission: { external_directory: Record<string, string> } };
  assert.equal(opencode.permission.external_directory[`${copies}/*`], "deny");
  w.cleanup();
});

const names = async (w: World, env: Record<string, string>) =>
  (await w.ok(["person", "list", "--json"], { env })).json.persons.map((p: { name: string }) => p.name).sort();

test("a commit made with git on top of the terminal's work: one way, strom repair then strom seal adopt, nothing lost", opts, async () => {
  const { w, terminal, app } = await split();
  git(w.cwd, "commit", "--allow-empty", "-m", "x");
  // both sides say the same way, in one order, never "never strom repair" beside "strom repair"
  for (const env of [app, terminal]) {
    const check = await w.run(["check"], { env, tty: true });
    assert.notEqual(check.code, 0);
    assert.match(check.out, /foreign-commit.+strom repair .+then strom seal adopt/, check.out);
    assert.match(check.out, /other-key.+po strom repair sjednotit ve vlastním terminálu: strom seal adopt/, check.out);
    assert.doesNotMatch(check.out, /nikdy strom repair|never strom repair/, check.out);
  }
  // in the app, the terminal's key is out of sight: the agent never comes to strom repair there with the agent's English
  const agentCheck = await w.run(["check", "--json"], { env: { ...app, CLAUDECODE: "1" } });
  const hints = agentCheck.json.findings.map((f: { hint?: string }) => f.hint ?? "").join("\n");
  assert.match(hints, /the user runs in their terminal: strom repair/, hints);
  assert.doesNotMatch(hints, /never strom repair/, hints);
  // the app's agent refused to write: the same way, never first the app's strom repair, which refuses
  const write = await w.run(["person", "add", "Petr /Lhoták/", "--sex", "M", "--json"], { env: { ...app, CLAUDECODE: "1" } });
  assert.equal(write.code, 1, write.out + write.err);
  assert.match(write.json.hint, /the user runs in their terminal: strom repair.+then strom seal adopt/, write.json.hint);
  assert.doesNotMatch(write.json.hint, /^strom repair/m, write.json.hint);
  // the terminal's agent: its own strom repair, which says what next (strom seal adopt)
  const there = await w.run(["person", "add", "Petr /Lhoták/", "--sex", "M", "--json"], { env: { ...terminal, CLAUDECODE: "1" } });
  assert.match(there.json.hint, /^strom repair/m, there.json.hint);
  assert.doesNotMatch(there.json.hint, /in their terminal/, there.json.hint);
  // uniting first refused (a change outside strom), saying the same way
  const unite = await w.run(["seal", "adopt"], { env: terminal, tty: true, answers: [""] });
  assert.notEqual(unite.code, 0, unite.out);
  assert.match(unite.out, /strom repair .+then strom seal adopt/, unite.out);
  // strom repair from the app: refused, nothing undone
  const fromApp = await w.run(["repair", "--json"], { env: app });
  assert.equal(fromApp.code, 1, fromApp.out + fromApp.err);
  assert.equal(fromApp.json.code, "seal.repair-in-terminal");
  assert.match((await w.run(["repair"], { env: app, tty: true })).out + (await w.run(["repair"], { env: app, tty: true })).err, /ve vlastním terminálu: strom repair, pak strom seal adopt/);
  assert.deepEqual(await names(w, terminal), ["Eva Lhotáková", "Jan Lhoták"]);
  // from the terminal: only the commit outside strom undone, the terminal's work kept, then the keys united
  const repair = await w.ok(["repair"], { env: terminal, tty: true });
  assert.match(repair.out, /znovu zapečetěno – commit udělaný mimo strom nezměnil žádný záznam/, repair.out);
  assert.match(repair.out, /strom seal adopt/, repair.out);
  assert.deepEqual(await names(w, terminal), ["Eva Lhotáková", "Jan Lhoták"]);
  assert.deepEqual(fs.readdirSync(path.join(w.cwd, ".strom")).filter((d) => d === "quarantine"), []);
  await w.ok(["seal", "adopt"], { env: terminal, tty: true, answers: [""] });
  for (const env of [terminal, app]) await w.ok(["check"], { env });
  await w.ok(["person", "add", "Petr /Lhoták/", "--sex", "M"], { env: app });
  await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F"], { env: terminal });
  for (const env of [terminal, app]) await w.ok(["verify"], { env });
  assert.deepEqual(await names(w, terminal), ["Anna Lhotáková", "Eva Lhotáková", "Jan Lhoták", "Petr Lhoták"]);
  w.cleanup();
});

test("a record changed and committed with git on top of the terminal's work: strom repair restores the record alone", opts, async () => {
  const { w, terminal, app } = await split();
  await w.run(["check"], { env: app });
  const people = fs.readdirSync(path.join(w.cwd, "data", "persons")).sort();
  const file = path.join(w.cwd, "data", "persons", people[0]!);
  const was = fs.readFileSync(file, "utf8");
  fs.writeFileSync(file, was.replace("Lhoták", "Lhota"));
  git(w.cwd, "commit", "-am", "x");
  const repair = await w.ok(["repair", "--json"], { env: terminal });
  assert.deepEqual(repair.json.restored, [`data/persons/${people[0]}`]);
  assert.deepEqual(repair.json.quarantined, []);
  assert.equal(repair.json.unite, "strom seal adopt");
  assert.equal(fs.readFileSync(file, "utf8"), was);
  assert.deepEqual(await names(w, terminal), ["Eva Lhotáková", "Jan Lhoták"]);
  await w.ok(["seal", "adopt"], { env: terminal, tty: true, answers: [""] });
  for (const env of [terminal, app]) await w.ok(["check"], { env });
  w.cleanup();
});

test("strom repair on two keys of this computer alone undoes nothing: the keys united after", opts, async () => {
  const { w, terminal, app } = await split();
  await w.run(["check"], { env: app });
  const head = git(w.cwd, "rev-parse", "HEAD");
  const repair = await w.ok(["repair"], { env: terminal, tty: true });
  assert.match(repair.out, /^není co opravit – každý záznam odpovídá své pečeti\ndál: .+strom seal adopt$/m, repair.out);
  assert.equal(git(w.cwd, "rev-parse", "HEAD"), head, "no commit of its own");
  assert.deepEqual(await names(w, terminal), ["Eva Lhotáková", "Jan Lhoták"]);
  w.cleanup();
});
