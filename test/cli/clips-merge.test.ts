// Clips of one image that overlap are one entry cut twice (core/clipmerge.ts): the research's joined into one when it
// writes them (strom source add/edit --clip, a batch), a person's never; a research an older strom wrote has them joined
// once (settleClips: one commit, logged, the marker in strom.json), a person's clips left as they are.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { now, Tree } from "../../src/core/tree.ts";
import { CLIPS_SETTLED, settleClips } from "../../src/core/clipmerge.ts";
import { transcriptMark } from "../../src/core/readers.ts";
import type { Clip, Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const AGENT = { CLAUDECODE: "1" };

// one entry cut twice: the first cuts off its bottom lines, the second its right part
const FIRST = "0.04,0.74,0.42,0.12";
const SECOND = "0.06,0.78,0.3,0.15";
const BOTH = { x: 0.04, y: 0.74, w: 0.42, h: 0.19 };

const clipsOf = (w: World, id: string): Clip[] | undefined => Tree.open(w.cwd, w.env).get<Source>(id)!.clips;
const sourceOf = (w: World, id: string): Source => Tree.open(w.cwd, w.env).get<Source>(id)!;
// decomposed (NFD) on the way in, a reading the user confirmed in the Strom app on it
const TEXT = "Křest Jiřího Lhotáka, syn Vojtěcha a Ludmily".normalize("NFD");
const commits = (w: World) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim());

/** A research with a book of three scans (M0001–M0003). */
async function world(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["recordset", "add", "Matrika N Lhota 1850-1870", "--kinds", "baptism", "--places", "Lhota", "--years", "1850-1870"]);
  const scans = path.join(w.dir, "kniha");
  fs.mkdirSync(scans);
  for (const f of ["s0001.jpg", "s0002.jpg", "s0003.jpg"]) fs.copyFileSync(path.join(fixtures, f), path.join(scans, f));
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  return w;
}

test("the research's clips of one image that overlap are written as one; apart, on other images, or a person's stay as given", opts, async () => {
  const w = await world();
  try {
    // an agent: one clip covering both, and it is told so
    const add = await w.ok(["source", "add", "Křest Vojtěcha Lhotáka 1850", "--kind", "baptism", "--recordset", "B1", "--clip", `B1:2@${FIRST}`, "--clip", `B1:2@${SECOND}`], { env: AGENT }); // S0001
    assert.deepEqual(clipsOf(w, "S0001"), [{ media: "M0002", region: BOTH }]);
    assert.match(add.out, /clips that overlap on one image joined into one/);
    assert.match(add.out, /M0002@0\.04,0\.74,0\.42,0\.12 \+ M0002@0\.06,0\.78,0\.3,0\.15 → M0002@0\.04,0\.74,0\.42,0\.19/);
    // an agent's edit: the clip it adds to its own joins the one there
    await w.ok(["source", "add", "Křest Jiřího Lhotáka 1852", "--kind", "baptism", "--recordset", "B1", "--clip", `B1:3@${FIRST}`, "--transcript", TEXT], { env: AGENT }); // S0002
    await w.ok(["source", "confirm", "S0002", "--txt", transcriptMark(TEXT.normalize("NFC"))], { env: { STROM_FOR_APP: "1" } });
    const confirmed = sourceOf(w, "S0002");
    assert.equal(confirmed.read?.user?.how, "confirm");
    await w.ok(["source", "edit", "S2", "--clip", `B1:3@${SECOND}`], { env: AGENT });
    assert.deepEqual(clipsOf(w, "S0002"), [{ media: "M0003", region: BOTH }]);
    // the clips alone: the transcript and the user's confirmation of it stay as they were
    assert.equal(sourceOf(w, "S0002").transcript, TEXT.normalize("NFC"));
    assert.deepEqual(sourceOf(w, "S0002").read, confirmed.read);
    // apart on one image, and over a page break: as given
    await w.ok(["source", "add", "Křest Anny Lhotákové 1854", "--kind", "baptism", "--recordset", "B1", "--clip", "B1:1@0.1,0.1,0.3,0.2", "--clip", "B1:1@0.5,0.1,0.3,0.2"], { env: AGENT }); // S0003
    assert.equal(clipsOf(w, "S0003")!.length, 2);
    await w.ok(["source", "add", "Křest Marie Lhotákové 1856", "--kind", "baptism", "--recordset", "B1", "--clip", `B1:1@${FIRST}`, "--clip", `B1:2@${SECOND}`], { env: AGENT }); // S0004
    assert.deepEqual(clipsOf(w, "S0004")!.map((c) => c.media), ["M0001", "M0002"]);
    // a batch of an agent's: joined as well
    await w.ok(["batch", `source add "Крещение Лхотака 1858" --kind baptism --recordset B1 --clip B1:2@${FIRST} --clip B1:2@${SECOND}`], { env: AGENT }); // S0005
    assert.deepEqual(clipsOf(w, "S0005"), [{ media: "M0002", region: BOTH }]);
    // run without a terminal by something strom does not know: the research's now (an agent strom does not recognise)
    await w.ok(["source", "add", "Křest Karla Lhotáka 1859", "--kind", "baptism", "--recordset", "B1", "--clip", `B1:2@${FIRST}`, "--clip", `B1:2@${SECOND}`]); // S0006
    assert.deepEqual(clipsOf(w, "S0006"), [{ media: "M0002", region: BOTH }]);
    // a person at their terminal (a batch of theirs too), and the Strom app (its bridge runs strom as the user's): as given
    await w.ok(["source", "add", "Křest Václava Lhotáka 1860", "--kind", "baptism", "--recordset", "B1", "--clip", `B1:2@${FIRST}`, "--clip", `B1:2@${SECOND}`], { tty: true }); // S0007
    assert.equal(clipsOf(w, "S0007")!.length, 2);
    await w.ok(["batch", `source add "Křest Františka Lhotáka 1861" --kind baptism --recordset B1 --clip B1:2@${FIRST} --clip B1:2@${SECOND}`], { tty: true }); // S0008
    assert.equal(clipsOf(w, "S0008")!.length, 2);
    await w.ok(["source", "add", "Křest Ludmily Lhotákové 1862", "--kind", "baptism", "--recordset", "B1", "--clip", `B1:2@${FIRST}`, "--clip", `B1:2@${SECOND}`], { env: { ...AGENT, STROM_FOR_APP: "1" } }); // S0009
    assert.equal(clipsOf(w, "S0009")!.length, 2);
    // a person's clip, and an agent's that overlaps it: the person's stays where it is, as it is
    await w.ok(["source", "add", "Křest Josefa Lhotáka 1864", "--kind", "baptism", "--recordset", "B1", "--clip", `B1:3@${FIRST}`], { tty: true }); // S0010
    await w.ok(["source", "edit", "S10", "--clip", `B1:3@${SECOND}`], { env: AGENT });
    assert.deepEqual(clipsOf(w, "S0010"), [
      { media: "M0003", region: { x: 0.04, y: 0.74, w: 0.42, h: 0.12 } },
      { media: "M0003", region: { x: 0.06, y: 0.78, w: 0.3, h: 0.15 } },
    ]);
    await w.ok(["check"]);
  } finally {
    w.cleanup();
  }
});

/** Sources as an older strom left them: two overlapping clips each, written by `by` ("agent", a session, or "user"). */
function older(w: World, by: string, title: string, clips: Clip[], extra: Partial<Source> = {}, op = "source.add"): string {
  const tree = Tree.open(w.cwd, w.env);
  tree.actor = by;
  let id = "";
  tree.withTreeLock(() => {
    id = tree.allocate("S");
    const at = now();
    const media = [...new Set(clips.map((c) => c.media))];
    tree.put({ id, type: "source", title, kind: "baptism", form: "original", information: "primary", recordset: "B0001", media, clips, notes: [], created: at, updated: at, ...extra } as unknown as Source, {
      op,
      targets: [id],
      summary: `+${id} source "${title}" on ${media.join(" ")}`,
    });
    tree.commit(`${id} as an older strom wrote it`);
  });
  return id;
}

test("a research an older strom wrote: the research's overlapping clips joined once, logged and marked; a person's untouched", opts, async () => {
  const w = await world();
  try {
    const two = (media: string): Clip[] => [
      { media, region: { x: 0.04, y: 0.74, w: 0.42, h: 0.12 } },
      { media, region: { x: 0.06, y: 0.78, w: 0.3, h: 0.15 } },
    ];
    const text = TEXT.normalize("NFC");
    const read = { user: { how: "confirm" as const, at: "2026-10-01T10:00:00.000Z", txt: transcriptMark(text) } };
    const agents = older(w, "N0001", "Křest Vojtěcha Lhotáka 1850", [...two("M0002"), { media: "M0001", region: { x: 0.1, y: 0.1, w: 0.3, h: 0.2 } }], { transcript: text, read });
    const persons = older(w, "user", "Křest Jiřího Lhotáka 1852", two("M0003"));
    // written by no write the history says carries clips: whose they are is not told — left as they are
    const unknown = older(w, "N0001", "Крещение Лхотака 1856", two("M0001"), {}, "source.changed");
    const apart = older(w, "agent", "Křest Anny Lhotákové 1854", [
      { media: "M0001", region: { x: 0.1, y: 0.1, w: 0.3, h: 0.2 } },
      { media: "M0001", region: { x: 0.5, y: 0.1, w: 0.3, h: 0.2 } },
    ]);
    const before = commits(w);
    const done = settleClips(Tree.open(w.cwd, w.env));
    assert.ok(done);
    assert.deepEqual(done.joined.map((j) => j.source), [agents]);
    assert.deepEqual(done.left, [persons, unknown]);
    assert.equal(commits(w), before + 1, "one commit");
    // the joined one in the place of the first, the other image's clip after it
    assert.deepEqual(clipsOf(w, agents), [
      { media: "M0002", region: BOTH },
      { media: "M0001", region: { x: 0.1, y: 0.1, w: 0.3, h: 0.2 } },
    ]);
    assert.deepEqual(clipsOf(w, persons), two("M0003"));
    assert.deepEqual(clipsOf(w, unknown), two("M0001"));
    // the clips alone: the transcript and the user's confirmation of it stay as they were
    assert.equal(sourceOf(w, agents).transcript, text);
    assert.deepEqual(sourceOf(w, agents).read, read);
    assert.equal(clipsOf(w, apart)!.length, 2);
    // logged: what was joined into what, in the history
    const op = Tree.open(w.cwd, w.env).readOps().find((o) => o.op === "source.clips");
    assert.ok(op);
    assert.deepEqual(op.targets, [agents]);
    assert.match(op.summary, /M0002@0\.04,0\.74,0\.42,0\.12 \+ M0002@0\.06,0\.78,0\.3,0\.15 → M0002@0\.04,0\.74,0\.42,0\.19/);
    assert.ok((readJsonFile(path.join(w.cwd, "strom.json")).settled as string[]).includes(CLIPS_SETTLED));
    // once: the next start changes nothing
    assert.equal(settleClips(Tree.open(w.cwd, w.env)), undefined);
    assert.equal(commits(w), before + 1);
    // the seal holds: the history and the files agree — strom check (schema, references, seals) finds nothing wrong
    const check = await w.ok(["check", "--json"]);
    assert.ok(check.json, check.out);
    assert.doesNotMatch(JSON.stringify(check.json), /"level":"error"/);
  } finally {
    w.cleanup();
  }
});

test("nothing joined in a dry run, nor in a research with nothing to join; at the first start of a newer strom by itself", opts, async () => {
  const w = await world();
  try {
    // nothing to join: nothing written, no marker
    const n = commits(w);
    assert.equal(settleClips(Tree.open(w.cwd, w.env)), undefined);
    assert.equal(commits(w), n);
    const id = older(w, "agent", "Křest Vojtěcha Lhotáka 1850", [
      { media: "M0002", region: { x: 0.04, y: 0.74, w: 0.42, h: 0.12 } },
      { media: "M0002", region: { x: 0.06, y: 0.78, w: 0.3, h: 0.15 } },
    ]);
    const dry = Tree.open(w.cwd, w.env);
    dry.dryRun = true;
    assert.equal(settleClips(dry), undefined);
    assert.equal(clipsOf(w, id)!.length, 2);
    // as after an update: an older strom ran here last
    const cfg = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
    fs.writeFileSync(cfg, JSON.stringify({ ...readJsonFile(cfg), lastVersion: "1.0.0" }));
    await w.ok(["status"]);
    assert.deepEqual(clipsOf(w, id), [{ media: "M0002", region: BOTH }]);
    assert.ok((readJsonFile(path.join(w.cwd, "strom.json")).settled as string[]).includes(CLIPS_SETTLED));
  } finally {
    w.cleanup();
  }
});
