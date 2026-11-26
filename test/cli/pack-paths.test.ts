// A package names no folder of the computer it was made on — not in a file, not in any object of its history: the
// agents' files (the tree's permissions and hooks, which name this computer's folders) are left out of the tree and of
// every commit; unpacking writes them for the computer it goes to. The last commit is sealed again: a backup unpacked
// on the same computer is the tree as it was, never taken over.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { readZip, unzipTo } from "../../src/core/zip.ts";
import { MACHINE_AGENT_FILES } from "../../src/agents/files.ts";
import { filterExport, unquotePath } from "../../src/core/historyfilter.ts";

const opts = { skip: !hasGit || process.platform === "win32" };

function gitOut(dir: string, args: string[]): Buffer {
  const r = spawnSync("git", args, { cwd: dir, maxBuffer: 512 * 1024 * 1024 });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

/** Every file under a folder, .git too. */
function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

/** What would name the world's computer: its folder (as given and as the system names it), without the leading slash too. */
function machine(w: World): string[] {
  const all = new Set<string>();
  for (const d of [...w.dirs(), w.env.HOME!]) {
    all.add(d);
    all.add(d.replace(/^\/+/u, ""));
    all.add(path.basename(w.dir));
  }
  return [...all];
}

function leaks(bytes: Buffer, needles: string[]): string[] {
  return needles.filter((n) => bytes.includes(Buffer.from(n, "utf8")) || bytes.includes(Buffer.from(n.normalize("NFD"), "utf8")));
}

test("pack: no folder of this computer in the package — the agents' files out of the tree and its whole history, the rest byte for byte; unpacked elsewhere and back here", opts, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Lhotákovi z Lhoty", "--lang", "cs"]);
  const root = w.treeDir("Lhotákovi z Lhoty");
  const cwd = { cwd: root };
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M", "--born", "1805"], cwd);
  await w.ok(["person", "add", "Žofie /Lhotáková/", "--sex", "F"], cwd);
  await w.ok(["person", "add", "Їржі /Лотак/", "--sex", "M"], cwd);

  // the tree here: its agents' files name this computer's folders, in the history too
  const needles = machine(w);
  const tracked = gitOut(root, ["ls-files"]).toString("utf8").split("\n");
  for (const f of [".claude/settings.json", "opencode.json"]) assert.ok(tracked.includes(f), `${f} kept in the tree`);
  assert.ok(leaks(gitOut(root, ["log", "-p", "--all"]), needles).length, "the history here names this computer's folders");

  const zip = path.join(w.dir, "balík ěš.zip");
  await w.ok(["pack", "--out", zip], cwd);
  const names = readZip(zip).map((e) => e.name);
  const folder = names.find((n) => n.endsWith("/strom.json") && n.split("/").length === 2)!.split("/")[0]!;
  for (const f of MACHINE_AGENT_FILES) assert.ok(!names.includes(`${folder}/${f}`), `${f} left out`);
  assert.ok(names.includes(`${folder}/AGENTS.md`), "the instructions go along");
  assert.ok(!names.some((n) => leaks(Buffer.from(n), needles).length), "no name of an entry");

  // nothing in the package names this computer: no file, no object of the history (reachable or not), no log
  const out = path.join(w.dir, "rozbaleno");
  unzipTo(zip, out);
  for (const f of files(out)) assert.deepEqual(leaks(fs.readFileSync(f), needles), [], path.relative(out, f));
  const repo = path.join(out, folder);
  assert.deepEqual(leaks(gitOut(repo, ["cat-file", "--batch-all-objects", "--batch"]), needles), [], "every object of the history");
  assert.deepEqual(leaks(gitOut(repo, ["log", "-p", "--all"]), needles), [], "git log -p");
  assert.equal(gitOut(repo, ["log", "--all", "--format=%H", "--", ...MACHINE_AGENT_FILES]).toString().trim(), "", "in no commit");
  assert.ok(!fs.existsSync(path.join(repo, ".git", "logs")), "no reflog");
  assert.equal(gitOut(repo, ["status", "--porcelain"]).toString(), "", "the working copy is the last commit");

  // the same commits: count, messages (the last one's seal made again), authors and dates
  const commits = (dir: string) =>
    gitOut(dir, ["log", "--format=%an%x00%ae%x00%ad%x00%cd%x00%B%x01"])
      .toString("utf8")
      .replace(/^Strom-Seal: [0-9a-f]{32}$/gmu, "Strom-Seal")
      .split("\x01");
  assert.deepEqual(commits(repo), commits(root));
  assert.ok(commits(root).length > 4);
  // every other file of the last commit byte for byte, the records with their accents and scripts
  const lastFiles = gitOut(root, ["ls-tree", "-r", "--name-only", "HEAD"]).toString("utf8").split("\n").filter(Boolean);
  const kept = lastFiles.filter((f) => !MACHINE_AGENT_FILES.includes(f));
  assert.ok(kept.some((f) => f.startsWith("data/")));
  assert.deepEqual(gitOut(repo, ["ls-tree", "-r", "--name-only", "HEAD"]).toString("utf8").split("\n").filter(Boolean), kept);
  for (const f of kept) assert.ok(gitOut(repo, ["show", `HEAD:${f}`]).equals(gitOut(root, ["show", `HEAD:${f}`])), f);
  const people = kept.filter((f) => f.startsWith("data/") && gitOut(root, ["show", `HEAD:${f}`]).toString("utf8").includes("Лотак"));
  assert.ok(people.length >= 1, "the record in Cyrillic is there, byte for byte");

  // unpacked on another computer: whole, taken over, the agents' files written for its folders
  const b = new World();
  const u = await b.ok(["unpack", zip], { answers: ["cs", "", "", "", "n", "a"] });
  assert.match(u.out, /převzato na tento počítač/);
  const there = b.treeDir("Lhotákovi z Lhoty");
  assert.match((await b.ok(["check"], { cwd: there })).out, /^ok/);
  const settings = fs.readFileSync(path.join(there, ".claude", "settings.json"), "utf8");
  assert.ok(settings.includes(b.home), "the permissions name this computer's folders");
  assert.deepEqual(leaks(Buffer.from(settings), needles), [], "and none of the other one");
  for (const f of MACHINE_AGENT_FILES.filter((f) => !f.startsWith(".codex/config"))) assert.ok(fs.existsSync(path.join(there, f)), f);
  assert.match((await b.ok(["person", "list"], { cwd: there })).out, /Vojtěch Lhoták[\s\S]*Žofie Lhotáková[\s\S]*Їржі Лотак/);

  // a backup back on this computer (the tree gone from the folder of the trees): its seal holds, nothing taken over
  fs.renameSync(root, path.join(w.dir, "pryč"));
  const back = await w.ok(["unpack", zip], { answers: ["a"] });
  assert.doesNotMatch(back.out, /převzato na tento počítač/);
  assert.match((await w.ok(["check"], cwd)).out, /^ok/);
  await w.ok(["person", "add", "Anežka /Lhotáková/"], cwd);
  assert.match((await w.ok(["check"], cwd)).out, /^ok/);
  for (const x of [w, b]) x.cleanup();
});

test("the history's filter: the paths left out line by line, a data section copied by its bytes whatever is in it", () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "strom filtr ěš "));
  try {
    const blob = Buffer.concat([Buffer.from("M 100644 :1 opencode.json\nD opencode.json\n"), Buffer.from([0, 0xff, 0x0a, 0xc3])]);
    const msg = Buffer.from("Zpráva – Žofie\nD opencode.json\n", "utf8");
    const stream = Buffer.concat([
      Buffer.from(`feature done\nblob\nmark :1\ndata ${blob.length}\n`),
      blob,
      Buffer.from(`\ncommit refs/heads/main\nmark :2\nauthor A <a@b> 1 +0000\ncommitter A <a@b> 1 +0000\ndata ${msg.length}\n`),
      msg,
      Buffer.from('M 100644 :1 opencode.json\nM 100644 :1 "data/lid\\303\\251.json"\nM 100644 inline .claude/settings.json\ndata 3\nabc\nM 100644 :1 "opencode.json"\nD .grok/config.toml\nD AGENTS.md\n\ndone\n'),
    ]);
    const a = path.join(dir, "a");
    const b = path.join(dir, "b");
    fs.writeFileSync(a, stream);
    filterExport(a, b, new Set(MACHINE_AGENT_FILES));
    const want = Buffer.concat([
      Buffer.from(`feature done\nblob\nmark :1\ndata ${blob.length}\n`),
      blob,
      Buffer.from(`\ncommit refs/heads/main\nmark :2\nauthor A <a@b> 1 +0000\ncommitter A <a@b> 1 +0000\ndata ${msg.length}\n`),
      msg,
      Buffer.from('M 100644 :1 "data/lid\\303\\251.json"\nD AGENTS.md\n\ndone\n'),
    ]);
    assert.ok(fs.readFileSync(b).equals(want), fs.readFileSync(b).toString("latin1"));
    assert.equal(unquotePath(Buffer.from('"data/lid\\303\\251 \\"x\\".json"')), 'data/lidé "x".json');
    assert.equal(unquotePath(Buffer.from("data/lidé.json")), "data/lidé.json");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
