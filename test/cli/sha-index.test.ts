// Which records name a file by its content (core/shaindex.ts): whether the research has an original already is asked
// for each file the app sends, and a long research has tens of thousands of image records. The index answers exactly
// what reading every record answers — after commits of another strom (git diff), files not committed (git status),
// a send taken back, strom repair, a damaged or outdated index — without reading them all; a second file of the same
// content in one hold of the lock is the first one's. The bridge's tree to read from (core/readtree.ts) is kept while
// nothing of the research changed. git's HEAD read from its files (core/git.ts headCommit) is what git says.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree, now } from "../../src/core/tree.ts";
import { knownOriginal, takeOriginal } from "../../src/core/originals.ts";
import { workingCopyOf } from "../../src/core/material.ts";
import { mimeOf } from "../../src/core/media.ts";
import { workingRel } from "../../src/core/treemedia.ts";
import { forgetShaIndexes, recordsBySha, shaIndexFile } from "../../src/core/shaindex.ts";
import { forgetReadTrees, readTree } from "../../src/core/readtree.ts";
import { headCommit } from "../../src/core/git.ts";
import { Settings } from "../../src/core/config.ts";
import type { Input, Media, Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const shaOf = (b: Buffer | string) => crypto.createHash("sha256").update(b).digest("hex");
const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/** What the research had of a content the way it was found before the index: every record read. */
function plainKnown(tree: Tree, shared: string | undefined, sha: string) {
  const m = tree.list<Media>("media").find((x) => !x.retracted && x.sha === sha);
  if (m) return { id: m.id, kind: "media" as const, mime: m.mime, bytes: m.size, ...(m.from ? { name: m.from } : {}), ...(shared ? { file: path.join(shared, m.file) } : {}) };
  const i = tree.list<Input>("input").find((x) => x.sha === sha && x.file && x.retracted?.reason !== "deleted");
  if (!i) return undefined;
  const file = i.file!.startsWith("inputs/") ? path.join(tree.root, i.file!) : shared && i.file!.startsWith("media:") ? path.join(shared, i.file!.slice(6)) : undefined;
  return { id: i.id, kind: "input" as const, mime: i.mime ?? mimeOf(i.name), bytes: i.size ?? 0, name: i.name, ...(file ? { file } : {}) };
}

function plainWorking(tree: Tree, shared: string | undefined, sha: string) {
  const i = tree.list<Input>("input").find((x) => !x.retracted && x.sha === sha && !x.file && x.working);
  if (!i) return undefined;
  return { id: i.id, kind: "input" as const, mime: i.working!.mime, bytes: i.working!.bytes, name: i.name, ...(shared ? { file: path.join(shared, workingRel(shared, i.working!)) } : {}) };
}

/** Each content asked through the index (a tree of its own, whose records are not all read) and the way before: the same. */
function same(w: World, shas: string[]): void {
  const shared = new Settings(w.env, {}).shared()?.value;
  for (const sha of shas) {
    const plain = Tree.open(w.cwd, w.env);
    const want = { known: plainKnown(plain, shared, sha), working: plainWorking(plain, shared, sha) };
    // asked as the bridge asks (only reading, the index in memory) and as a strom that takes an original (the tree's
    // lock held: the index kept in .strom/cache)
    for (const locked of [false, true]) {
      const fast = Tree.open(w.cwd, w.env);
      const ask = () => ({ known: knownOriginal(fast, shared, sha), working: workingCopyOf(fast, shared, sha) });
      const got = locked ? fast.withTreeLock(ask) : ask();
      assert.equal(fast.loaded("media"), false, "the image records not all read");
      assert.equal(fast.loaded("input"), false, "the inputs not all read");
      assert.deepEqual(got.known, want.known, `known ${sha.slice(0, 8)}${locked ? " (locked)" : ""}`);
      assert.deepEqual(got.working, want.working, `working copy ${sha.slice(0, 8)}${locked ? " (locked)" : ""}`);
    }
  }
}

/** The records' folders as if they changed a while ago (a folder changed a moment ago is trusted to no stamp). */
const PAST = new Date(Date.now() - 120_000);
function settle(root: string): void {
  for (const d of ["images", "inputs"]) fs.utimesSync(path.join(root, "data", d), PAST, PAST);
}

const fakeSha = (n: number) => shaOf(`image ${n}`);

/** A research with 2 000 image records and inputs of every kind the lookups tell apart, committed. */
async function big() {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]); // P0001
  const tree = Tree.open(w.cwd, w.env);
  const shas = {
    image: fakeSha(1234),
    gone: fakeSha(7),
    input: shaOf("input file"),
    deleted: shaOf("deleted input"),
    hidden: shaOf("withdrawn input"),
    waiting: shaOf("waiting original"),
    both: shaOf("image and input"),
  };
  tree.withTreeLock(() => {
    const at = now();
    for (let n = 1; n <= 2000; n++) {
      const id = tree.allocate("M");
      const m: Media = { id, type: "media", created: at, updated: at, sha: n === 1999 ? shas.both : fakeSha(n), file: `${fakeSha(n).slice(0, 2)}/${fakeSha(n)}.jpg`, mime: "image/jpeg", size: n, notes: [] } as Media;
      if (n === 7) m.retracted = { at, reason: "jiná kniha" };
      tree.put(m, { op: "media.add", targets: [id], summary: `image ${id}` });
    }
    const input = (fields: Partial<Input>) => {
      const id = tree.allocate("I");
      const i = { id, type: "input", created: at, updated: at, name: "Žďár.jpg", kind: "document", state: "new", notes: [], ...fields } as Input;
      tree.put(i, { op: "input.add", targets: [id], summary: `input ${id}` });
      return id;
    };
    input({ sha: shas.input, file: "inputs/Žďár.jpg", size: 10, mime: "image/jpeg" });
    input({ sha: shas.deleted, file: "media:aa/deleted.jpg", retracted: { at, reason: "deleted" } });
    input({ sha: shas.hidden, file: "media:aa/hidden.jpg", retracted: { at, reason: "duplicate" } });
    input({ sha: shas.waiting, working: { sha: shaOf("working"), mime: "image/jpeg", bytes: 5 } });
    input({ sha: shas.both, file: "media:aa/both.jpg" });
  });
  tree.commit("images and inputs");
  settle(w.cwd);
  return { w, shas };
}

test("sha index: the same answers as every record read, without reading them; another strom's commit, files not committed, a damaged or outdated index", opts, async () => {
  const { w, shas } = await big();
  const all = [...Object.values(shas), fakeSha(1), fakeSha(2000), shaOf("nothing")];
  // only reading (the bridge): the index in memory, nothing written into the research — nor .strom made again
  const t0 = Tree.open(w.cwd, w.env);
  assert.equal(knownOriginal(t0, undefined, shas.image)!.id, "M1234");
  assert.equal(fs.existsSync(shaIndexFile(w.cwd)), false, "a reader keeps nothing in .strom/cache");
  forgetShaIndexes();
  // first: made from the records (once), then from .strom/cache/sha-index.json (kept by the lock's holder)
  same(w, all);
  assert.ok(fs.existsSync(shaIndexFile(w.cwd)));
  forgetShaIndexes();
  const t = Tree.open(w.cwd, w.env);
  const known = knownOriginal(t, undefined, shas.image)!;
  assert.equal(known.id, "M1234");
  assert.equal(t.loaded("media"), false, "2 000 image records, none read whole");
  assert.equal(knownOriginal(t, undefined, shas.both)!.id, "M1999", "an image first, as before");
  assert.equal(knownOriginal(t, undefined, shas.gone), undefined, "a withdrawn image is none");
  assert.equal(knownOriginal(t, undefined, shas.deleted), undefined, "an input deleted for good is none");
  assert.equal(knownOriginal(t, undefined, shas.hidden)!.kind, "input", "an input withdrawn otherwise stays known, as before");
  assert.equal(workingCopyOf(t, undefined, shas.waiting)!.id, "I0004");

  // another strom's commit, the folders' stamps as they were: found by what the commit changed
  const fresh = shaOf("committed by another");
  const other = Tree.open(w.cwd, w.env);
  other.withTreeLock(() => {
    const at = now();
    const m = { id: other.allocate("M"), type: "media", created: at, updated: at, sha: fresh, file: "bb/new.jpg", mime: "image/jpeg", size: 1, notes: [] } as Media;
    other.put(m, { op: "media.add", targets: [m.id], summary: "image" });
    // an image whose content changed (a part of it cut again): its sha before is none any more
    const old = other.get<Media>("M0002")!;
    other.put({ ...old, sha: shaOf("recut") }, { op: "media.edit", targets: [old.id], summary: "image" });
  });
  other.commit("another strom");
  settle(w.cwd);
  same(w, [fresh, fakeSha(2), shaOf("recut")]);
  assert.equal(knownOriginal(Tree.open(w.cwd, w.env), undefined, fresh)!.id, "M2001");

  // not committed (a strom at work, or one that failed before its commit): found by git status, and gone when it goes
  const loose = shaOf("not committed");
  const third = Tree.open(w.cwd, w.env);
  third.withTreeLock(() => {
    const at = now();
    third.put({ id: third.allocate("I"), type: "input", created: at, updated: at, name: "Лист.pdf", file: "media:cc/list.pdf", sha: loose, kind: "document", state: "new", notes: [] } as Input, { op: "input.add", targets: [], summary: "input" });
  });
  same(w, [loose]);
  assert.equal(knownOriginal(Tree.open(w.cwd, w.env), undefined, loose)!.name, "Лист.pdf");
  third.rollback();
  same(w, [loose]);
  assert.equal(knownOriginal(Tree.open(w.cwd, w.env), undefined, loose), undefined, "taken back: none");

  // a damaged index, one of a commit git does not have (a reset, a gc), one of another format: made again, right
  fs.writeFileSync(shaIndexFile(w.cwd), "{ not json");
  forgetShaIndexes();
  same(w, [shas.image, fresh]);
  const stored = JSON.parse(fs.readFileSync(shaIndexFile(w.cwd), "utf8"));
  assert.equal(stored.head, headCommit(w.cwd));
  fs.writeFileSync(shaIndexFile(w.cwd), JSON.stringify({ ...stored, head: "0".repeat(40), entries: {} }));
  forgetShaIndexes();
  same(w, [shas.image, fresh, shas.input]);
  fs.writeFileSync(shaIndexFile(w.cwd), JSON.stringify({ ...stored, v: 99, entries: {} }));
  forgetShaIndexes();
  same(w, [shas.image]);
  // the history set back (a reset to the commit before): what the later commit added is none
  git(w.cwd, "reset", "-q", "--hard", "HEAD~1");
  same(w, [fresh, fakeSha(2), shaOf("recut")]);
  assert.equal(knownOriginal(Tree.open(w.cwd, w.env), undefined, fresh), undefined);
  w.cleanup();
});

test("sha index: the same file twice in one hold of the lock is one input; a file taken in by its name in another script", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]); // P0001
  const shared = new Settings(w.env, {}).shared()!.value;
  const jpg = fs.readFileSync(path.join(fixtures, "s0001.jpg"));
  const sha = shaOf(jpg);
  const incoming = path.join(shared, "media", ".incoming");
  fs.mkdirSync(incoming, { recursive: true });
  const copy = (n: number) => {
    const f = path.join(incoming, `${sha}-${n}.part`);
    fs.writeFileSync(f, jpg);
    return f;
  };
  const tree = Tree.open(w.cwd, w.env);
  // the index made before (as a bridge has it): the first file is not in it
  assert.equal(knownOriginal(tree, shared, sha), undefined);
  const [first, second] = tree.withTreeLock(() => {
    const name = "Šťáva u Žďáru.jpg".normalize("NFD");
    return [takeOriginal(tree, shared, copy(1), sha, { name, persons: ["P0001"] }), takeOriginal(tree, shared, copy(2), sha, { name, persons: ["P0001"] })];
  });
  tree.commit("originals");
  assert.ok(first.input, JSON.stringify(first));
  assert.equal(second.known, first.input, "the second is the first one's");
  assert.equal(recordsBySha<Input>(Tree.open(w.cwd, w.env), "input", sha).length, 1, "one input");
  const input = Tree.open(w.cwd, w.env).get<Input>(first.input!)!;
  assert.equal(input.name, "Šťáva u Žďáru.jpg".normalize("NFC"), "its name composed");
  // a strom of its own (as the bridge runs): the same content only said
  const again = copy(3);
  const r = await w.ok(["media", "original", again, "--sha", sha, "--name", "Šťáva.jpg", "--json"]);
  assert.equal(r.json.known, first.input);
  same(w, [sha]);
  w.cleanup();
});

/** A file's lines as the app writes them (its data URL in pieces). */
function obje(o: { data: Buffer; titl: string; kind?: string; sha?: string; name?: string }): string[] {
  const parts = `data:image/jpeg;base64,${o.data.toString("base64")}`.match(/.{1,180}/gs)!;
  return ["1 OBJE", `2 FILE ${parts[0]}`, ...parts.slice(1).map((p) => `3 CONC ${p}`), "2 FORM jpg", `2 TITL ${o.titl}`, ...(o.name ? [`2 _STROM_NAME ${o.name}`] : []), ...(o.kind ? [`2 _STROM_KIND ${o.kind}`] : []), ...(o.sha ? [`2 _STROM_SHA ${o.sha}`] : [])];
}

test("sha index: a send of the app taken back (sync undo) and strom repair leave it saying what the records say", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1890"]); // P1
  const given = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  const portrait = fs.readFileSync(path.join(fixtures, "s0001.jpg"));
  const working = fs.readFileSync(path.join(fixtures, "grey.jpg"));
  const original = shaOf("the original the app keeps");
  const text = fs
    .readFileSync(given, "utf8")
    .replace(/^1 SOUR STROM_RESEARCH$/m, "1 SOUR STROM\n2 VERS 3.31.0")
    .split(/\n(?=0 )/)
    .map((r) => (/\n1 REFN P0001\n/.test(`${r}\n`) ? `${r.replace(/\n+$/, "")}\n${[...obje({ data: portrait, titl: "portrét.jpg", kind: "photo" }), ...obje({ data: working, titl: "Svatba", name: "svatba-1915.jpg".normalize("NFD"), sha: original })].join("\n")}` : r))
    .join("\n");
  const file = path.join(w.dir, "app.ged");
  fs.writeFileSync(file, text);
  const shas = [shaOf(portrait), original, shaOf(working)];
  same(w, shas);
  const sent = (await w.ok(["sync", file, "--apply", "--json"])).json;
  same(w, shas);
  assert.ok(knownOriginal(Tree.open(w.cwd, w.env), undefined, shaOf(portrait)), "the portrait known");
  assert.ok(workingCopyOf(Tree.open(w.cwd, w.env), undefined, original), "the file whose original is not here: its working copy");
  await w.ok(["sync", "undo", sent.input]);
  same(w, shas);
  assert.equal(workingCopyOf(Tree.open(w.cwd, w.env), undefined, original), undefined, "taken back");

  // a record removed and one made outside strom: as the files say, and as they are again after strom repair
  const rec = recordsBySha<Input>(Tree.open(w.cwd, w.env), "input", shaOf(portrait))[0]!;
  const recFile = path.join(w.cwd, "data", "inputs", `${rec.id}.json`);
  const saved = fs.readFileSync(recFile, "utf8");
  fs.rmSync(recFile);
  const made = path.join(w.cwd, "data", "inputs", "I0090.json");
  const madeSha = shaOf("made by hand");
  fs.writeFileSync(made, saved.replace(new RegExp(rec.id, "g"), "I0090").replaceAll(`"sha": "${shaOf(portrait)}"`, `"sha": "${madeSha}"`));
  same(w, [shaOf(portrait), madeSha]);
  assert.equal(recordsBySha(Tree.open(w.cwd, w.env), "input", madeSha).length, 1);
  await w.ok(["repair"]);
  same(w, [shaOf(portrait), madeSha]);
  assert.equal(recordsBySha(Tree.open(w.cwd, w.env), "input", shaOf(portrait))[0]?.id, rec.id, "put back");
  assert.equal(recordsBySha(Tree.open(w.cwd, w.env), "input", madeSha).length, 0, "the one made by hand taken out");
  w.cleanup();
});

test("the bridge's tree to read from: the same while nothing changed, another after a write or a commit", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M"]);
  forgetReadTrees();
  const settleAll = () => {
    for (const d of fs.readdirSync(path.join(w.cwd, "data"), { withFileTypes: true })) if (d.isDirectory()) fs.utimesSync(path.join(w.cwd, "data", d.name), PAST, PAST);
    fs.utimesSync(path.join(w.cwd, "data"), PAST, PAST);
    fs.utimesSync(path.join(w.cwd, "strom.json"), PAST, PAST);
  };
  // changed a moment ago: opened afresh each time
  assert.notEqual(readTree(w.cwd, w.env), readTree(w.cwd, w.env));
  settleAll();
  const a = readTree(w.cwd, w.env);
  assert.equal(readTree(w.cwd, w.env), a, "kept while nothing changed");
  assert.equal(a.get<Person>("P0001")!.names[0]!.given, "Václav");
  await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F"]);
  settleAll();
  const b = readTree(w.cwd, w.env);
  assert.notEqual(b, a, "a commit: another");
  assert.ok(b.get("P0002"));
  // a change not committed, the folder's stamp moved
  fs.writeFileSync(path.join(w.cwd, "data", "persons", "P0002.json"), fs.readFileSync(path.join(w.cwd, "data", "persons", "P0002.json")));
  fs.renameSync(path.join(w.cwd, "data", "persons", "P0002.json"), path.join(w.cwd, "data", "persons", "P0003.json"));
  fs.renameSync(path.join(w.cwd, "data", "persons", "P0003.json"), path.join(w.cwd, "data", "persons", "P0002.json"));
  assert.notEqual(readTree(w.cwd, w.env), b, "a folder changed: another");
  w.cleanup();
});

test("HEAD read from git's files: as git says — a branch, packed refs, a detached HEAD, a worktree, no commit", opts, () => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR ?? "/tmp"), "strom head ěš "));
  try {
    const repo = path.join(dir, "výzkum");
    fs.mkdirSync(repo);
    git(repo, "init", "-q");
    git(repo, "config", "user.email", "t@example.org");
    git(repo, "config", "user.name", "T");
    assert.equal(headCommit(repo), undefined, "no commit yet");
    fs.writeFileSync(path.join(repo, "a.txt"), "a");
    git(repo, "add", ".");
    git(repo, "commit", "-q", "-m", "a");
    assert.equal(headCommit(repo), git(repo, "rev-parse", "HEAD"));
    git(repo, "pack-refs", "--all");
    assert.equal(headCommit(repo), git(repo, "rev-parse", "HEAD"), "packed refs");
    fs.writeFileSync(path.join(repo, "a.txt"), "b");
    git(repo, "commit", "-q", "-am", "b");
    git(repo, "checkout", "-q", "--detach", "HEAD~1");
    assert.equal(headCommit(repo), git(repo, "rev-parse", "HEAD"), "detached");
    git(repo, "checkout", "-q", "-");
    const wt = path.join(dir, "druhý strom");
    git(repo, "worktree", "add", "-q", "-b", "jiná", wt);
    fs.writeFileSync(path.join(wt, "c.txt"), "c");
    git(wt, "add", ".");
    git(wt, "commit", "-q", "-m", "c");
    assert.equal(headCommit(wt), git(wt, "rev-parse", "HEAD"), "a worktree's own branch");
    assert.equal(headCommit(repo), git(repo, "rev-parse", "HEAD"));
    assert.notEqual(headCommit(wt), headCommit(repo));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
