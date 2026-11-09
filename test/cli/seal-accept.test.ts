// strom seal accept: a research whose oldest logs a cloud drive took away and whose git history it damaged (found
// 2026-11-09: a research once in iCloud Drive, objects of .git missing, copies "… 2.lock" beside strom's files). strom
// repair has nothing to put back there; the person accepts the records as they are — one signed operation, a sealed
// commit, the damaged history moved aside whole, no record's content changed, nothing deleted. Never by an agent, never
// without a terminal; looking it over changes nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/** Every file of the folder with its hash: what looking it over must leave as it was. */
function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out.set(path.relative(dir, p), crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex"));
    }
  };
  walk(dir);
  return out;
}

function logs(root: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.name.endsWith(".jsonl")) out.push(path.join(d, e.name));
    }
  };
  walk(path.join(root, "data", "ops"));
  return out.sort();
}

/** One object of the git history gone (as a cloud drive leaves it). */
function dropObject(cwd: string, sha: string): void {
  const file = path.join(cwd, ".git", "objects", sha.slice(0, 2), sha.slice(2));
  assert.ok(fs.existsSync(file), `object ${sha} loose`);
  fs.chmodSync(file, 0o666);
  fs.rmSync(file);
}

/** Lhotákovi, written over several commits; then the oldest logs gone. */
async function research(w: World): Promise<string> {
  const root = await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1850"]);
  await w.ok(["person", "add", "Žofie /Lhotáková/", "--sex", "F", "--born", "1855"]);
  await w.ok(["person", "add", "Ота /Лхотак/", "--sex", "M"]);
  await w.ok(["note", "add", "P0001", "Narozen v Lhotě."]);
  await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F"]);
  // the oldest logs taken away: those of the first persons and of the note
  const all = logs(root);
  assert.ok(all.length >= 5, all.join("\n"));
  for (const f of [...all.slice(0, 3), all[3]!]) fs.rmSync(f);
  return root;
}

test("a damaged git history and lost logs: verify says the way, looking over changes nothing, the person accepts, nothing lost", opts, async () => {
  const w = new World();
  const root = await research(w);
  // the history damaged: the tree of the last commit and of one before it gone
  dropObject(root, git(root, "rev-parse", "HEAD^{tree}"));
  dropObject(root, git(root, "rev-parse", "HEAD~2^{tree}"));
  // iCloud's copies
  fs.writeFileSync(path.join(root, ".strom", "tree 2.lock"), "{}");
  fs.writeFileSync(path.join(root, ".strom", "live 2.json"), "{}");
  fs.mkdirSync(path.join(root, "output"), { recursive: true });
  fs.writeFileSync(path.join(root, "output", "tree 2.ged"), "0 HEAD\n");
  fs.copyFileSync(path.join(root, "data", "persons", "P0002.json"), path.join(root, "data", "persons", "P0002 2.json"));
  const records = snapshot(path.join(root, "data", "persons"));
  records.delete("P0002 2.json");

  // the check says what happened and the one way: the person's strom seal accept, never strom repair
  const verify = await w.run(["verify"], { tty: true });
  assert.equal(verify.code, 1, verify.out + verify.err);
  assert.match(verify.out, /git-damaged/, verify.out);
  assert.match(verify.out, /unsealed/, verify.out);
  assert.match(verify.out, /strom seal accept/, verify.out);
  assert.doesNotMatch(verify.out, /→ strom repair/, verify.out);
  const agentVerify = await w.run(["verify", "--json"], { env: { CLAUDECODE: "1" } });
  assert.match(JSON.stringify(agentVerify.json), /an agent never runs it/, agentVerify.out);
  // check reports instead of failing on git
  const check = await w.run(["check"]);
  assert.equal(check.code, 1, check.out + check.err);
  assert.match(check.out, /git-damaged/, check.out);
  // a write is refused, saying why
  const write = await w.run(["person", "add", "Petr /Lhoták/", "--sex", "M", "--json"]);
  assert.notEqual(write.code, 0);
  assert.equal(write.json.code, "tree.git-damaged", write.out);
  assert.match(write.json.hint, /strom seal accept/);

  // looking it over: counts only, nothing changed — the person, the agent's preview, the agent, no terminal
  const before = snapshot(root);
  const look = await w.run(["seal", "accept"]);
  assert.equal(look.code, 4, look.out + look.err);
  assert.match(look.out, /Lhotákovi/, look.out);
  const preview = await w.ok(["seal", "accept", "--preview", "--json"], { env: { CLAUDECODE: "1" } });
  assert.equal(preview.json.accepted, false);
  assert.equal(preview.json.git, "damaged");
  assert.ok(preview.json.unsealed + preview.json.edited >= 3, preview.out);
  assert.equal((await w.run(["seal", "accept", "--json"], { env: { CLAUDECODE: "1" } })).code, 4);
  assert.equal((await w.run(["seal", "accept", "--yes"], { tty: true })).code, 4, "--yes never accepts");
  const no = await w.run(["seal", "accept"], { tty: true, answers: ["n"] });
  assert.equal(no.code, 0, no.out + no.err);
  assert.deepEqual(snapshot(root), before, "nothing changed by looking over or saying no");

  // the person's yes
  const yes = await w.ok(["seal", "accept"], { tty: true, answers: ["a"] });
  assert.match(yes.out, /\.git-damaged-/, yes.out);
  assert.match(yes.out, /\.strom\/accepted-/, yes.out);
  await w.ok(["verify"]);
  await w.ok(["check"]);
  // no record's content changed, nothing deleted; the damaged history and the copies kept aside
  assert.deepEqual(snapshot(path.join(root, "data", "persons")), records);
  const aside = fs.readdirSync(root).filter((n) => n.startsWith(".git-damaged-"));
  assert.equal(aside.length, 1);
  assert.ok(fs.existsSync(path.join(root, aside[0]!, "HEAD")));
  const accepted = fs.readdirSync(path.join(root, ".strom")).find((n) => n.startsWith("accepted-"))!;
  assert.ok(fs.existsSync(path.join(root, ".strom", accepted, "data", "persons", "P0002 2.json")));
  assert.ok(fs.existsSync(path.join(root, ".strom", accepted, ".strom", "tree 2.lock")));
  assert.ok(fs.existsSync(path.join(root, ".strom", "live 2.json")), "copies outside what strom seals only said");
  // the new history: one sealed commit of the accepted research, the damaged one never in it
  assert.match(git(root, "log", "--format=%s"), /^Seal: the research accepted as it is/);
  assert.doesNotMatch(git(root, "ls-files"), /\.git-damaged-/);
  assert.equal(git(root, "status", "--porcelain", "--", "data"), "");

  // strom goes on as before, the seal stays clean
  await w.ok(["person", "add", "Petr /Lhoták/", "--sex", "M"]);
  await w.ok(["verify"]);
  // asked again: nothing to accept, nothing changed
  const head = git(root, "rev-parse", "HEAD");
  assert.match((await w.ok(["seal", "accept"], { tty: true, answers: ["a"] })).out, /není co přijímat/u);
  assert.equal(git(root, "rev-parse", "HEAD"), head);
  w.cleanup();
});

test("lost logs with a readable git history: strom repair is the way said; accepting makes a sealed commit and keeps git", opts, async () => {
  const w = new World();
  const root = await research(w);
  const verify = await w.run(["verify"], { tty: true });
  assert.equal(verify.code, 1);
  assert.doesNotMatch(verify.out, /git-damaged|strom seal accept/, verify.out);
  const commits = Number(git(root, "rev-list", "--count", "HEAD"));
  await w.ok(["seal", "accept"], { tty: true, answers: ["a"] });
  await w.ok(["verify"]);
  await w.ok(["check"]);
  assert.equal(Number(git(root, "rev-list", "--count", "HEAD")), commits + 1, "the history kept, one commit on top");
  assert.equal(fs.readdirSync(root).filter((n) => n.startsWith(".git-damaged-")).length, 0);
  w.cleanup();
});

test("accepting never settles what the check finds of another kind: a log rewritten is refused, nothing written", opts, async () => {
  const w = new World();
  const root = await research(w);
  const last = logs(root).at(-1)!;
  fs.writeFileSync(last, fs.readFileSync(last, "utf8").replace("Eva", "Ema"));
  const head = git(root, "rev-parse", "HEAD");
  const r = await w.run(["seal", "accept"], { tty: true, answers: ["a"] });
  assert.equal(r.code, 1, r.out + r.err);
  assert.equal(git(root, "rev-parse", "HEAD"), head);
  w.cleanup();
});

test("an agent's own edit of a record is never accepted by an agent", opts, async () => {
  const w = new World();
  const root = await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
  const file = path.join(root, "data", "persons", "P0001.json");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("Lhoták", "Lhota"));
  const agent = { CLAUDECODE: "1" };
  const r = await w.run(["seal", "accept", "--json"], { env: agent, tty: true, answers: ["a"] });
  assert.equal(r.code, 4, r.out + r.err);
  assert.equal((await w.run(["verify"], { env: agent })).code, 1);
  // a readable history: the hint stays strom repair, never accept
  assert.doesNotMatch((await w.run(["verify", "--json"], { env: agent })).out, /seal accept/);
  // the person looking it over is told it was changed outside strom — not a history lost
  const look = await w.ok(["seal", "accept", "--preview"]);
  assert.match(look.out, /změněné mimo strom.+strom repair je vrátí.+přijetím se změna stane základem výzkumu\): 1/u, look.out);
  assert.doesNotMatch(look.out, /novější|chybí historie/u, look.out);
  const data = (await w.ok(["seal", "accept", "--preview", "--json"])).json;
  assert.equal(data.outside, 1);
  assert.equal(data.edited + data.unsealed, 0);
  w.cleanup();
});
