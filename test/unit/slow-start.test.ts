// A research on a slow drive (found on Windows, a research on OneDrive: five minutes before the menu showed, five and a
// half for strom doctor): what each step took said in one line (strom --timing), the images' orientation read once
// and remembered by their content, the sizes of a research measured only when asked for, and a network drive or a
// cloud's folder told by what Windows says of it — its files' attributes only, nothing opened or downloaded.

import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { startTiming, stopTiming, noteSpawn, timed, timingLine, timingReport, timingOn } from "../../src/core/timing.ts";
import { forgetOrients, keepOrients, knownOrient, rememberOrient } from "../../src/core/orients.ts";
import { mediaOrient } from "../../src/core/views.ts";
import { cloudOf, factsOf, ONLINE_ONLY, placeOf, sampleFiles, type DriveFacts } from "../../src/core/clouddrive.ts";
import { sharedMedia, tidyPlan } from "../../src/core/tidy.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Media } from "../../src/core/model.ts";

function folder(t: TestContext): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-slow-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("timing: each step's own time, the disk's calls and the programs it started; nothing measured while off", (t) => {
  const dir = folder(t);
  const file = path.join(dir, "zápis Lhoták.txt");
  fs.writeFileSync(file, "x");
  // off: nothing counted, the step runs all the same
  assert.equal(timingOn(), false);
  assert.equal(timed("off", () => 1), 1);
  startTiming();
  t.after(stopTiming);
  timed("outer", () => {
    for (let i = 0; i < 3; i++) fs.readFileSync(file);
    timed("inner", () => {
      fs.statSync(file);
      fs.existsSync(file);
      noteSpawn();
    });
  });
  timed("inner", () => fs.readdirSync(dir));
  const r = timingReport();
  const of = (label: string) => r.steps.find((s) => s.label === label)!;
  assert.equal(r.steps.some((s) => s.label === "off"), false);
  assert.deepEqual(of("outer").calls, { readFileSync: 3 });
  assert.deepEqual(of("inner").calls, { statSync: 1, existsSync: 1, git: 1, readdirSync: 1 });
  assert.equal(of("inner").runs, 2);
  assert.ok(of("outer").total >= of("outer").ms, "its own time leaves the inner step out");
  // the line to send: the whole first, a step with its calls, the quick ones left out
  timed("slow", () => {
    const until = Date.now() + 30;
    while (Date.now() < until) fs.statSync(file);
  });
  const line = timingLine();
  assert.match(line, /^total \d+\.\d\d s · /);
  assert.match(line, /slow 0\.\d\d s \[stat \d+\]/);
  assert.doesNotMatch(line, /outer|inner/);
  stopTiming();
  assert.equal(timingReport().steps.length, 0);
});

test("orientation of an image: read from its file once, remembered by its content — kept only where the shared folder keeps its caches", (t) => {
  const shared = folder(t);
  const sha = "ab".repeat(32);
  t.after(forgetOrients);
  forgetOrients();
  rememberOrient(shared, sha.toUpperCase(), 6);
  assert.equal(knownOrient(shared, sha), 6);
  // no cache folder: nothing made for it
  keepOrients();
  assert.equal(fs.existsSync(path.join(shared, "cache")), false);
  fs.mkdirSync(path.join(shared, "cache"));
  rememberOrient(shared, "cd".repeat(32), 1);
  keepOrients();
  forgetOrients();
  assert.equal(knownOrient(shared, sha), 6);
  assert.equal(knownOrient(shared, "cd".repeat(32)), 1);
  // the image's file gone (kept only online, on a drive not here): its orientation known all the same, nothing opened
  const m = { id: "M0001", type: "media", mime: "image/jpeg", file: "media/ab/ab/missing.jpg", sha } as unknown as Media;
  assert.equal(mediaOrient(shared, m), 6);
  assert.equal(mediaOrient(shared, { ...m, sha: "cd".repeat(32) }), undefined);
  // unknown and its file not here: not remembered (read when it comes)
  assert.equal(mediaOrient(shared, { ...m, sha: "ef".repeat(32) }), undefined);
  assert.equal(knownOrient(shared, "ef".repeat(32)), undefined);
});

test("tidyPlan: the sizes of the research measured only when asked for — what can go said without walking .git, data/, inputs/", (t) => {
  const root = path.join(folder(t), "Lhotákovi");
  const tree = Tree.create(root, "Lhotákovi", "cs", process.env);
  for (let i = 0; i < 40; i++) fs.writeFileSync(path.join(root, "data", `x${i}.json`), "{}");
  startTiming();
  t.after(stopTiming);
  const plan = timed("plan", () => tidyPlan(tree));
  const walked = (label: string) => {
    const c = timingReport().steps.find((s) => s.label === label)?.calls ?? {};
    return (c.lstatSync ?? 0) + (c.statSync ?? 0);
  };
  const before = walked("plan");
  assert.ok(before < 40, `the plan alone walked ${before}`);
  const size = timed("size", () => plan.size.research);
  assert.ok(walked("size") >= 40, "asked for: the research measured");
  assert.ok(size > 0);
  // measured once; said with the rest (strom tidy --json)
  timed("again", () => plan.size.strom);
  assert.equal(walked("again"), 0);
  assert.ok("research" in JSON.parse(JSON.stringify(plan)).size);
  assert.equal(typeof JSON.parse(JSON.stringify(plan)).quarantine, "number");
});

test("a cloud's folder told by its path: OneDrive (its own folders too), iCloud, Dropbox, the Mac's CloudStorage — any accent", () => {
  assert.equal(cloudOf("Z:\\OneDrive\\Documents\\Strom"), "OneDrive");
  assert.equal(cloudOf("C:\\Users\\lhotak\\OneDrive - Lhota s.r.o\\Dokumenty\\Rodokmen"), "OneDrive");
  assert.equal(cloudOf("D:\\Rodokmeny\\Lhotákovi", { OneDrive: "d:\\rodokmeny" }), "OneDrive");
  assert.equal(cloudOf("D:\\Rodokmeny2\\Lhotákovi", { OneDrive: "D:\\Rodokmeny" }), undefined);
  assert.equal(cloudOf("/Users/lhotak/Library/CloudStorage/OneDrive-Personal/Strom"), "OneDrive");
  assert.equal(cloudOf("/Users/lhotak/Library/CloudStorage/GoogleDrive-lhotak/Můj disk/Strom"), "Google Drive");
  assert.equal(cloudOf("/Users/lhotak/Library/Mobile Documents/com~apple~CloudDocs/Strom"), "iCloud");
  assert.equal(cloudOf("/home/лхотак/Dropbox/Родословная"), "Dropbox");
  assert.equal(cloudOf("C:\\Users\\lhotak\\Documents\\Strom"), undefined);
  assert.equal(cloudOf("/Users/lhotak/Documents/Strom/OneDrivePlány"), undefined);
});

test("a network drive or files kept only online (Windows): told by the drive's kind, subst and the files' attributes — never elsewhere", () => {
  const facts = (f: DriveFacts) => () => f;
  const win = (dir: string, f: DriveFacts | undefined, env = {}) => placeOf(dir, ["a.jpg"], env, { platform: "win32", read: () => f });
  // the report: Z: is a subst of a OneDrive folder, most of the scans only online
  const online = ONLINE_ONLY.RECALL_ON_DATA_ACCESS | 0x20;
  assert.deepEqual(win("Z:\\Documents\\Strom", { driveType: "Fixed", subst: "C:\\Users\\lhotak\\OneDrive", attrs: [online, online, 0x20, ONLINE_ONLY.OFFLINE] }), {
    kind: "cloud",
    what: "OneDrive",
    looked: 4,
    online: 3,
  });
  assert.deepEqual(win("Z:\\Strom", { driveType: "Network", attrs: [0x20] }), { kind: "network", what: "Z:", looked: 1, online: 0 });
  assert.deepEqual(win("\\\\nas\\rodina\\Strom", undefined), { kind: "network", what: "\\\\nas\\rodina", looked: 0, online: 0 });
  // files only online where no name tells the cloud: a cloud all the same
  assert.deepEqual(win("E:\\Strom", { driveType: "Fixed", attrs: [ONLINE_ONLY.RECALL_ON_OPEN] }), { kind: "cloud", what: "E:", looked: 1, online: 1 });
  // a disk of this computer, every file here: nothing said
  assert.equal(win("C:\\Users\\lhotak\\Documents\\Strom", { driveType: "Fixed", attrs: [0x20, 0x21] }), undefined);
  // Windows could not be asked: by the path alone
  assert.equal(win("C:\\Strom", undefined), undefined);
  // not Windows: nothing asked of the system
  let asked = 0;
  assert.equal(placeOf("/Users/lhotak/Strom", [], {}, { platform: "darwin", read: () => (asked++, facts({ attrs: [] })()) }), undefined);
  assert.equal(asked, 0);
  // what PowerShell answers, read
  assert.deepEqual(factsOf("type Network\r\nsubst C:\\Users\\Lhoták\\OneDrive\r\nattr 4194336\r\nattr 32\r\nnoise\r\n"), {
    driveType: "Network",
    subst: "C:\\Users\\Lhoták\\OneDrive",
    attrs: [4194336, 32],
  });
});

test("sampleFiles: the first files found, at most so many, a few folders deep, nothing hidden", (t) => {
  const dir = folder(t);
  for (const sub of ["ab/cd", "ef/01", ".git/objects"]) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  for (let i = 0; i < 5; i++) fs.writeFileSync(path.join(dir, "ab", "cd", `${i}.jpg`), "x");
  fs.writeFileSync(path.join(dir, "ef", "01", "š.jpg"), "x");
  fs.writeFileSync(path.join(dir, ".git", "objects", "o"), "x");
  fs.writeFileSync(path.join(dir, ".DS_Store"), "x");
  assert.equal(sampleFiles([dir]).length, 6);
  assert.equal(sampleFiles([dir], 3).length, 3);
  assert.equal(sampleFiles([dir, path.join(dir, "missing")]).filter((f) => f.includes(".git") || f.endsWith(".DS_Store")).length, 0);
});

test("sharedMedia: counted until its time at most — what was counted by then said as the least", (t) => {
  const shared = folder(t);
  const dir = path.join(shared, "media", "ab", "cd");
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 4; i++) fs.writeFileSync(path.join(dir, `${String(i).repeat(64)}.jpg`), "xx");
  const whole = sharedMedia(shared, new Set());
  assert.equal(whole.files, 4);
  assert.equal(whole.partial, undefined);
  const cut = sharedMedia(shared, new Set(), Date.now() - 1);
  assert.equal(cut.partial, true);
  assert.equal(cut.files, 0);
});
