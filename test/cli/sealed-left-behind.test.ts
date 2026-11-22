// Records strom wrote whose operation reached the history (git) while their files did not (found on Windows, 1.31:
// every write refused — "the history is older than the research, strom repair would remove 4 records" — while strom
// verify and strom check were content and strom seal accept had nothing to accept). The check before a write judges
// such a file as strom verify does — by the newest operation of every log — and the next write commits it.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { verifyFast, verifyFull } from "../../src/core/integrity.ts";
import { guard } from "../../src/core/guard.ts";
import type { Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" });
const errors = <T extends { level: string }>(f: T[]): T[] => f.filter((x) => x.level === "error");

/**
 * Lhotákovi: two people committed; then strom writes — one of them edited, a note of the other taken back with its
 * reason, a third person added (Cyrillic, decomposed diacritics) — and a commit takes the log of those operations alone.
 */
async function leftBehind(w: World): Promise<{ root: string; files: string[]; between: string }> {
  const root = await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1850"]);
  await w.ok(["person", "add", "Žofie /Lhotáková/", "--sex", "F", "--born", "1855"]);
  await w.ok(["note", "add", "P0002", "Narozena ve Lhotě."]);
  const tree = Tree.open(root, w.env);
  let between = "";
  tree.withTreeLock(() => {
    const jan = tree.get<Person>("P0001")!;
    tree.put({ ...jan, names: jan.names.map((n) => ({ ...n, given: "Jan Křtitel" })) }, { op: "person.edit", targets: [jan.id], summary: "P0001 given name" });
    between = fs.readFileSync(path.join(root, "data", "persons", "P0001.json"), "utf8");
    tree.put({ ...jan, names: jan.names.map((n) => ({ ...n, given: "Jan Nepomuk" })) }, { op: "person.edit", targets: [jan.id], summary: "P0001 given name again" });
    const zofie = tree.get<Person>("P0002")!;
    tree.put({ ...zofie, notes: [] }, { op: "person.edit", targets: [zofie.id], summary: "P0002 note taken back", reason: "a note of another Žofie" });
    const id = tree.allocate("P");
    tree.put({ ...jan, id, sex: "M", names: [{ given: "Ота", surname: "Лхотак" }, { given: "Václav".normalize("NFD"), surname: "Lhoták".normalize("NFD") }], events: [], notes: [] } as Person, { op: "person.add", targets: [id], summary: `${id} added` });
  });
  // the commit holds the log of the operations, not the files they wrote
  tree.withTreeLock(() => tree.commit("a commit of the log alone", tree.opsFilesTouched()));
  const files = git(root, "status", "--porcelain=v1", "--untracked-files=all", "--", "data/persons").split("\n").filter(Boolean).map((l) => l.slice(3)).sort();
  return { root, files, between };
}

test("an operation in the history, its record not: verify, check and the next write agree — the write commits it", opts, async () => {
  const w = new World();
  try {
    const { root, files } = await leftBehind(w);
    assert.deepEqual(files, ["data/persons/P0001.json", "data/persons/P0002.json", "data/persons/P0003.json"], "the state of the report");
    const tree = Tree.open(root, w.env);
    assert.deepEqual(errors(verifyFull(tree).findings), [], "strom verify: every record as sealed");
    const fast = verifyFast(tree);
    assert.deepEqual(errors(fast.findings), [], "the check before a write says the same");
    assert.deepEqual(fast.sealedBefore, files, "strom's own files the next commit takes");
    assert.deepEqual(errors(guard(tree)), [], "nothing lost: the note was taken back by an operation with its reason");
    for (const args of [["verify"], ["verify", "--fast"], ["check"]]) {
      const said = await w.run(args);
      assert.equal(said.code, 0, `strom ${args.join(" ")}: ${said.out}${said.err}`);
    }
    // the next write goes through and commits what was left behind
    const r = await w.run(["person", "add", "Eva /Lhotáková/", "--sex", "F", "--born", "1880"]);
    assert.equal(r.code, 0, r.out + r.err);
    assert.equal(git(root, "status", "--porcelain=v1", "--untracked-files=all", "--", "data").trim(), "", "the research whole in git again");
    assert.equal(errors(verifyFast(Tree.open(root, w.env)).findings).length, 0);
    assert.equal((await w.run(["verify"])).code, 0);
  } finally {
    w.cleanup();
  }
});

test("an operation in the history, its record not, and a record edited by hand: the write still refused", opts, async () => {
  const w = new World();
  try {
    const { root, between } = await leftBehind(w);
    // a record put back by hand to what an older operation wrote is no record of strom's: the newest operation judges
    fs.writeFileSync(path.join(root, "data", "persons", "P0001.json"), between);
    const tree = Tree.open(root, w.env);
    assert.ok(errors(verifyFull(tree).findings).some((f) => f.file === "data/persons/P0001.json"), "strom verify says it");
    assert.ok(errors(verifyFast(tree).findings).some((f) => f.file === "data/persons/P0001.json"), "the check before a write too");
    const r = await w.run(["person", "add", "Eva /Lhotáková/", "--sex", "F"]);
    assert.notEqual(r.code, 0);
    assert.doesNotMatch(r.err + r.out, /history \(git\) is older/);
    assert.ok(fs.existsSync(path.join(root, "data", "persons", "P0003.json")), "nothing of strom's removed");
  } finally {
    w.cleanup();
  }
});

const AGENT = { CLAUDECODE: "1" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");

test("a session started on a task whose images were saved: woken in the agent's log, taken up in the session's — committed", opts, async () => {
  const w = new World();
  try {
    const root = await w.withTree("Lhotákovi");
    await w.ok(["research", "new", "Lhoták", "--new-person", "Jan /Lhoták/"]);
    await w.ok(["recordset", "add", "Lhota N 1784–1820", "--url", "https://www.archiv-lhota.example/kniha/11"]);
    await w.ok(["task", "add", "Křest Jana", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "křest nalezen"]);
    await w.ok(["task", "wait", "T1", "--images", "B1:5-6", "--on", "Snímky 5–6 k uložení."], { env: AGENT });
    const folder = (await w.ok(["task", "show", "T1", "--json"])).json.task.awaits.folder;
    const inbox = path.join(w.home, "shared", "inbox", folder);
    fs.mkdirSync(inbox, { recursive: true });
    for (const [n, from] of [["5", "grey.jpg"], ["6", "base420.jpg"]] as const) {
      const f = path.join(inbox, `${n}.jpg`);
      fs.copyFileSync(path.join(fixtures, from), f);
      const at = new Date(Date.now() - 60_000);
      fs.utimesSync(f, at, at);
    }
    const s = await w.run(["session", "start", "T1"], { env: AGENT });
    assert.equal(s.code, 0, s.out + s.err);
    assert.equal(git(root, "status", "--porcelain=v1", "--untracked-files=all", "--", "data").trim(), "", "the start committed whole");
    const next = await w.run(["session", "note", "Kniha otevřena."], { env: AGENT });
    assert.equal(next.code, 0, next.out + next.err);
  } finally {
    w.cleanup();
  }
});

test("the operations added since the last commit judged by their time, never by the order of their logs' names", opts, async () => {
  const w = new World();
  try {
    const root = await w.withTree("Lhotákovi");
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
    const tree = Tree.open(root, w.env);
    tree.withTreeLock(() => {
      const jan = tree.get<Person>("P0001")!;
      // the agent's log first, a session's own after it — "N0001.…" named before "agent-…"
      tree.actor = "agent";
      tree.put({ ...jan, names: jan.names.map((n) => ({ ...n, given: "Jan Křtitel" })) }, { op: "person.edit", targets: [jan.id], summary: "P0001 given name" });
      tree.actor = "N0001";
      tree.put({ ...jan, names: jan.names.map((n) => ({ ...n, given: "Jan Nepomuk" })) }, { op: "person.edit", targets: [jan.id], summary: "P0001 given name again" });
    });
    const logs = git(root, "status", "--porcelain=v1", "--untracked-files=all", "--", "data/ops").split("\n").filter(Boolean).map((l) => path.posix.basename(l.slice(3)));
    assert.ok(logs[0]!.startsWith("N0001.") && logs[1]!.startsWith("agent-"), logs.join(", "));
    const fast = verifyFast(Tree.open(root, w.env));
    assert.deepEqual(errors(fast.findings), []);
    assert.equal(fast.sealedBefore, undefined, "judged by the fast check itself, not set right by the full one");
  } finally {
    w.cleanup();
  }
});

test("two Trees of one process writing in the same millisecond: the later operation the later time, its file the last word — no change outside strom", opts, async () => {
  const w = new World();
  const real = Date.now;
  try {
    const root = await w.withTree("Lhotákovi");
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
    const one = Tree.open(root, w.env);
    const two = Tree.open(root, w.env);
    const at = real() + 60_000;
    Date.now = () => at;
    const jan = one.get<Person>("P0001")!;
    one.withTreeLock(() => one.put({ ...jan, names: jan.names.map((n) => ({ ...n, given: "Jan Křtitel" })) }, { op: "person.edit", targets: [jan.id], summary: "P0001 given name" }));
    two.withTreeLock(() => two.put({ ...jan, names: [{ given: "Ян".normalize("NFD"), surname: "Лхотак" }] }, { op: "person.edit", targets: [jan.id], summary: "P0001 given name again" }));
    Date.now = real;
    const stamps = git(root, "status", "--porcelain=v1", "--untracked-files=all", "--", "data/ops").split("\n").filter(Boolean)
      .flatMap((l) => fs.readFileSync(path.join(root, l.slice(3)), "utf8").trim().split("\n").map((x) => (JSON.parse(x) as { at: string; summary: string })))
      .sort((a, b) => a.summary.length - b.summary.length);
    assert.equal(stamps.length, 2, JSON.stringify(stamps));
    assert.ok(stamps[1]!.at > stamps[0]!.at, `the later write the later time: ${JSON.stringify(stamps)}`);
    assert.deepEqual(errors(verifyFast(Tree.open(root, w.env)).findings), []);
  } finally {
    Date.now = real;
    w.cleanup();
  }
});

test("a write whose commit never came: the next write takes it once its log lay untouched for long — never one at work", opts, async () => {
  const w = new World();
  try {
    const root = await w.withTree("Lhotákovi");
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]);
    // as a session's start refused by 1.31 left it: the agent's log and the session's, records written, nothing committed
    const tree = Tree.open(root, w.env);
    tree.withTreeLock(() => {
      const jan = tree.get<Person>("P0001")!;
      tree.actor = "agent";
      tree.put({ ...jan, sex: "U" }, { op: "person.edit", targets: [jan.id], summary: "P0001 sex unknown" });
      tree.actor = "N0001";
      const id = tree.allocate("P");
      tree.put({ ...jan, id, names: [{ given: "Ота", surname: "Лхотак" }], events: [], notes: [] } as Person, { op: "person.add", targets: [id], summary: `${id} added` });
    });
    const left = () => git(root, "status", "--porcelain=v1", "--untracked-files=all", "--", "data").split("\n").filter(Boolean).map((l) => l.slice(3)).filter((p) => !p.endsWith("_counters.json"));
    const before = left();
    assert.equal(before.length, 4, before.join(", "));
    // just written: another strom's at work, never taken into this commit
    await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F"]);
    assert.deepEqual(left(), before);
    // untouched for long: a write left behind, taken by the next commit
    const long = new Date(Date.now() - 60 * 60_000);
    for (const p of before.filter((x) => x.startsWith("data/ops/"))) fs.utimesSync(path.join(root, p), long, long);
    await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]);
    assert.deepEqual(left(), []);
    await w.ok(["verify"]);
  } finally {
    w.cleanup();
  }
});
