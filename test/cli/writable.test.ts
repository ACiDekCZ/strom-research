// A research strom may not write into (found on Windows, 2026-10-22: an agent ran strom in its sandbox, which refused
// the lock in .strom or anything in .git; strom said "no permission" and "a folder with the right to write in it", the
// agent told the person it had no access to the family tree; doctor and check said all was fine). Under an agent the
// refusal is said as its sandbox's, with what the agent does; a person reads it in the research's language; a refused
// write into .git is never said as git itself; doctor and check say it; a failed init leaves nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { linkForTests } from "../../src/core/lock.ts";
import { researchOf } from "../../src/core/writable.ts";

// chmod refuses nobody on Windows (its ACLs) nor root
const opts = { skip: !hasGit || process.platform === "win32" || process.getuid?.() === 0 };
const AGENT = { CODEX_SANDBOX: "seatbelt" };

/** The research's .strom (or .git) made read-only while fn runs. */
async function readOnly<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  fs.mkdirSync(dir, { recursive: true });
  fs.chmodSync(dir, 0o555);
  try {
    return await fn();
  } finally {
    fs.chmodSync(dir, 0o755);
  }
}

test("no right to write the lock: a person reads it in the research's language, the place without ': ' before it; nothing written", opts, async () => {
  const w = new World();
  const tree = await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/"]);
  await readOnly(path.join(tree, ".strom"), async () => {
    const r = await w.run(["person", "add", "Žofie /Nováková/"], { cwd: tree });
    assert.equal(r.code, 2);
    assert.match(r.err, /^chyba: chybí oprávnění: .*tree\.lock\.\d+\.\w+\.tmp\n/);
    assert.match(r.err, /→ vybrat složku, do které lze zapisovat/);
    assert.doesNotMatch(r.err, /sandbox/);
    const j = await w.run(["person", "add", "Žofie /Nováková/", "--json"], { cwd: tree });
    assert.equal(j.json.code, "fs.no-permission");
    assert.ok(j.json.params.where.startsWith(path.join(tree, ".strom")), j.json.params.where);
    assert.doesNotMatch(j.json.params.where, /^: /);
  });
  assert.doesNotMatch((await w.ok(["person", "list"], { cwd: tree })).out, /Žofie/);
  w.cleanup();
});

test("under an agent the refusal is said as its sandbox's, with what the agent does (English, its code)", opts, async () => {
  const w = new World();
  const tree = await w.withTree();
  await readOnly(path.join(tree, ".strom"), async () => {
    // an agent strom knows no sandbox of: the general words
    const r = await w.run(["person", "add", "Žofie /Nováková/"], { cwd: tree, env: { OPENCODE: "1" } });
    assert.equal(r.code, 2);
    assert.match(r.err, /^error: no permission to use: .*tree\.lock.* — strom runs under an agent, and most likely its sandbox forbids it\n/);
    assert.match(r.err, /→ run this strom command outside the agent's sandbox \(the user approves it\), or work with the research's folder — its \.git and \.strom too — as the writable working folder; never another folder, never strom's settings changed/);
    const j = await w.run(["person", "add", "Žofie /Nováková/", "--json"], { cwd: tree, env: AGENT });
    assert.equal(j.json.code, "fs.sandboxed");
    assert.ok(j.json.params.where.startsWith(path.join(tree, ".strom")));
  });
  w.cleanup();
});

test("the advice as the sandbox is here: Codex by hand, Codex strom started, Claude Code — the level never changed for the person", opts, async () => {
  const w = new World();
  const tree = await w.withTree();
  await readOnly(path.join(tree, ".git"), async () => {
    const hint = async (env: Record<string, string>) => (await w.run(["person", "add", "Žofie /Nováková/", "--json"], { cwd: tree, env })).json.hint as string;
    const hand = await hint(AGENT);
    assert.match(hand, /^Codex was started without strom: strom run on its own \(no pipe, no redirection like 2>&1, no cd before it\): the research's \.codex\/rules\/strom\.rules lets that run outside Codex's sandbox when Codex runs in the research's folder and trusts it\. Else, the user's choice: the conversation started through strom \(strom chat/);
    assert.doesNotMatch(hand, /writable_roots/);
    const started = await hint({ ...AGENT, STROM_WORKER: "codex-1" });
    assert.match(started, /^strom run on its own \(no pipe, no redirection like 2>&1, no cd before it\): the research's \.codex\/rules\/strom\.rules lets that run outside Codex's sandbox\. Run so and refused all the same \(Codex does not trust the research's folder, or its rules are older than this strom: strom agents sync\): ask the user to approve this command outside the sandbox/);
    assert.doesNotMatch(started, /writable_roots/);
    assert.match(started, /the user's choice alone/);
    assert.match(await hint({ CLAUDECODE: "1" }), /^Claude Code's sandbox writes in the folder Claude Code was started in: the user starts it in the research's folder \(strom chat does\), or approves this command outside the sandbox/);
    for (const h of [hand, started]) assert.match(h, /never another folder, never strom's settings changed$/);
    // doctor the agent runs: the same situation, in the research's language
    const fix = async (env: Record<string, string>) => (await w.run(["doctor", "--json"], { cwd: tree, env })).json.checks.find((c: { name: string }) => c.name === "write").fix as string;
    assert.match(await fix(AGENT), /^spustit Codex ve složce výzkumu a důvěřovat jí \(pravidla \.codex v ní pustí strom ze sandboxu\), nebo ho spustit přes strom/);
    assert.match(await fix({ ...AGENT, STROM_SESSION: "S1" }), /^spouštět strom samotný, bez roury a cd \(pravidla \.codex/);
    assert.match(await fix({ CLAUDECODE: "1" }), /^spustit Claude Code ve složce výzkumu/);
    assert.match(await fix({ OPENCODE: "1" }), /^spustit příkaz mimo sandbox agenta/);
  });
  w.cleanup();
});

test("no mark of an agent, one among strom's parent processes: its sandbox named first as the likely cause, for a person; the table unreadable: an agent's sandbox as maybe", opts, async () => {
  const w = new World();
  const tree = await w.withTree();
  await readOnly(path.join(tree, ".strom"), async () => {
    const run = (ancestry: string, json = false) =>
      w.run(["person", "add", "Žofie /Nováková/", ...(json ? ["--json"] : [])], { cwd: tree, env: { STROM_TEST_ANCESTRY: ancestry } });
    const r = await run("zsh,codex");
    assert.equal(r.code, 2);
    assert.match(r.err, /^chyba: chybí oprávnění: .*tree\.lock/);
    assert.match(r.err, /→ strom spustil OpenAI Codex CLI a zápis nejspíš zakazuje jeho sandbox: příkaz schválit mimo sandbox/);
    const j = (await run("zsh,codex", true)).json;
    assert.equal(j.code, "fs.no-permission", "not certain: never said as the sandbox's");
    assert.match(j.hint, /^strom was started by OpenAI Codex CLI, and most likely its sandbox forbids it/);
    assert.match((await run("!")).err, /→ strom nevidí programy, které ho spustily, jako v sandboxu agenta/);
    const plain = (await run("")).err;
    assert.match(plain, /→ vybrat složku, do které lze zapisovat/);
    assert.doesNotMatch(plain, /sandbox|agent/);
  });
  w.cleanup();
});

test("researchOf: the folder above a refused file's .strom or .git — any script, a space", () => {
  const root = path.resolve("Výzkum Иванов");
  assert.equal(researchOf(path.join(root, ".strom", "tree.lock.1.a.tmp")), root);
  assert.equal(researchOf(path.join(root, ".git", "index.lock")), root);
  assert.equal(researchOf(path.join(root, "data", "x.json")), undefined);
});

test("git refused writing into .git: said as the research's .git — never as git itself, never a folder to choose; nothing kept", opts, async () => {
  const w = new World();
  const tree = await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/"]);
  await readOnly(path.join(tree, ".git"), async () => {
    const r = await w.run(["person", "add", "Žofie /Nováková/"], { cwd: tree });
    assert.notEqual(r.code, 0);
    assert.match(r.err, /git nemůže zapisovat do výzkumu: .*\.git/);
    assert.doesNotMatch(r.err, /git(\.exe)?: |no permission to use|chybí oprávnění/);
    const j = await w.run(["person", "add", "Žofie /Nováková/", "--json"], { cwd: tree });
    assert.equal(j.json.code, "git.unwritable");
    const a = await w.run(["person", "add", "Žofie /Nováková/", "--json"], { cwd: tree, env: AGENT });
    assert.equal(a.json.code, "fs.sandboxed");
    assert.match(a.json.params.where, /\.git/);
  });
  assert.doesNotMatch((await w.ok(["person", "list"], { cwd: tree })).out, /Žofie/, "taken back");
  w.cleanup();
});

test("doctor tries writing into the research: .strom refused is a problem with its cause (a person; an agent's sandbox), not 'ok'", opts, async () => {
  const w = new World();
  const tree = await w.withTree();
  const fine = await w.run(["doctor", "--json"], { cwd: tree });
  assert.equal(fine.json.checks.find((c: { name: string }) => c.name === "write").status, "ok");
  await readOnly(path.join(tree, ".strom"), async () => {
    const r = await w.run(["doctor"], { cwd: tree });
    assert.equal(r.code, 1);
    assert.match(r.out, /✗ +zápis do rodokmenu +.*\.strom: zápis odepřen – chybí právo zápisu {2}→ složka, do které lze zapisovat/);
    const j = await w.run(["doctor", "--json"], { cwd: tree });
    const write = j.json.checks.find((c: { name: string }) => c.name === "write");
    assert.deepEqual([write.status, write.code], ["fail", "write.refused"]);
    const a = await w.run(["doctor", "--json"], { cwd: tree, env: AGENT });
    const sb = a.json.checks.find((c: { name: string }) => c.name === "write");
    assert.deepEqual([sb.status, sb.code], ["fail", "write.sandbox"]);
    assert.match(sb.detail, /zápis odepřen – strom běží pod agentem, nejspíš to zakazuje jeho sandbox/);
    // no mark, an agent among the parent processes: still a person's refusal, its sandbox named as the likely cause
    const p = (await w.run(["doctor", "--json"], { cwd: tree, env: { STROM_TEST_ANCESTRY: "zsh,codex" } })).json.checks.find((c: { name: string }) => c.name === "write");
    assert.equal(p.code, "write.refused");
    assert.match(p.fix, /^strom spustil OpenAI Codex CLI: nejspíš jeho sandbox – příkaz schválit mimo něj/);
  });
  w.cleanup();
});

test("doctor on a disk without hard links: a warning that the lock goes another way — and writing goes on", opts, async () => {
  const w = new World();
  const tree = await w.withTree();
  linkForTests(() => {
    throw Object.assign(new Error("EISDIR: link refused"), { code: "EISDIR" });
  });
  try {
    const j = await w.run(["doctor", "--json"], { cwd: tree });
    const write = j.json.checks.find((c: { name: string }) => c.name === "write");
    assert.deepEqual([write.status, write.code], ["warn", "write.nolink"]);
    assert.match(write.detail, /disk neumí pevné odkazy – zámek jede náhradní cestou/);
    await w.ok(["person", "add", "Žofie /Nováková/"], { cwd: tree });
    assert.match((await w.ok(["person", "list"], { cwd: tree })).out, /Žofie/);
  } finally {
    linkForTests();
  }
  w.cleanup();
});

test("check is no 'ok' where the research cannot be written: it says so and points to doctor", opts, async () => {
  const w = new World();
  const tree = await w.withTree();
  await readOnly(path.join(tree, ".git"), async () => {
    const r = await w.run(["check"], { cwd: tree });
    assert.equal(r.code, 1);
    assert.match(r.out, /ERROR +unwritable +\.git +zápis sem je odepřen – proč, řekne strom doctor +→ strom doctor/);
    const j = await w.run(["check", "--json"], { cwd: tree });
    assert.equal(j.json.ok, false);
    assert.deepEqual(j.json.findings.map((f: { code: string; file: string }) => [f.code, f.file]), [["unwritable", ".git"]]);
  });
  assert.equal((await w.run(["check"], { cwd: tree })).code, 0);
  w.cleanup();
});

test("check where .strom cannot even be listed (as Windows denies a folder): its finding and exit 1, no 'no permission' error", opts, async () => {
  const w = new World();
  const tree = await w.withTree();
  const strom = path.join(tree, ".strom");
  fs.chmodSync(strom, 0o111);
  try {
    const r = await w.run(["check"], { cwd: tree });
    assert.equal(r.code, 1, r.err);
    assert.match(r.out, /ERROR +unwritable +\.strom +zápis sem je odepřen/);
    assert.doesNotMatch(r.err, /chybí oprávnění/);
  } finally {
    fs.chmodSync(strom, 0o755);
  }
  w.cleanup();
});

test("an init git cannot finish (a drive refusing the history) leaves no half a family tree, said in the research's language", opts, async () => {
  const w = new World();
  await w.withTree();
  const real = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
  const fake = path.join(w.dir, "fake git");
  fs.writeFileSync(fake, `#!/bin/sh\nif [ "$1" = "init" ]; then echo "fatal: unable to access '$PWD/.git/config': Permission denied" >&2; exit 128; fi\nexec "${real}" "$@"\n`, { mode: 0o755 });
  const before = process.env.STROM_GIT;
  process.env.STROM_GIT = fake;
  try {
    const empty = path.join(w.dir, "prázdná");
    fs.mkdirSync(empty);
    const r = await w.run(["init", "Dvořákovi", "--dir", empty]);
    assert.equal(r.code, 2);
    assert.match(r.err, /^chyba: rodokmen nejde založit v .*prázdná: zápis tam je odepřen – nic z něj tam nezůstalo\n→ vybrat složku, do které lze zapisovat\n/);
    assert.deepEqual(fs.readdirSync(empty), [], "the empty folder given stays empty");
    const fresh = path.join(w.dir, "nová");
    const j = await w.run(["init", "Dvořákovi", "--dir", fresh, "--json"]);
    assert.equal(j.json.code, "init.unwritable");
    assert.equal(fs.existsSync(fresh), false, "the folder it made is gone");
    // the person's folder with files is never touched (refused before anything)
    const full = path.join(w.dir, "plná");
    fs.mkdirSync(full);
    fs.writeFileSync(path.join(full, "dopis.txt"), "x");
    assert.notEqual((await w.run(["init", "Dvořákovi", "--dir", full])).code, 0);
    assert.deepEqual(fs.readdirSync(full), ["dopis.txt"]);
  } finally {
    if (before === undefined) delete process.env.STROM_GIT;
    else process.env.STROM_GIT = before;
  }
  w.cleanup();
});
