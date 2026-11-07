// A source read again from its original (spec 059 P6): a part of its image registered sharper that holds all of the
// source's excerpt is read from, though the place read (the excerpt with its margin) runs a little past it — the margin
// alone is left out, the readers' regions placed on the page by what the view showed. A part that holds only some of the
// excerpt is not read from; with no sharper part the view is the whole image's, as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { encodeImage } from "../../src/image/index.ts";
import { now, Tree } from "../../src/core/tree.ts";
import type { Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

// a reader that writes one entry over all of its view and keeps the prompt it was given
const READER = `import fs from "node:fs";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
const was = fs.readFileSync(report, "utf8");
const body = "## Document\\nkind: register.baptism\\nlanguage: cs\\nscript: latin\\nlegible: yes\\n\\n## Entry e1 · page 1\\nregion: 0,0,1,1\\ntranscript: Vojtěch Lhoták z Lhoty\\nperson: p1 | child | dítě | written=Vojtěch Lhoták | given=Vojtěch | surname=Lhoták | sex=M\\n\\ndone: 1 entries";
fs.writeFileSync(report, was.replace("<!-- next block -->", body + "\\n<!-- next block -->"));
fs.appendFileSync(process.env.DOC_PROMPTS, p + "\\n=====\\n");
console.log("cost: 0.10");
`;

const CLIP = { x: 0.1, y: 0.4, w: 0.6, h: 0.15 };

/** Image 1 of B0001 (1708×1331, a scan reduced), a source with its excerpt; `part`: a part of image 1 at 2000 px across (M0003). */
async function setUp(part?: string): Promise<{ w: World; prompts: () => string; views: () => { key: string; kind?: string }[] }> {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Kniha N 1850–1870", "--kinds", "baptism"]);
  const dir = path.join(w.dir, "skeny ř");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "s0001.jpg"), encodeImage({ width: 1708, height: 1331, channels: 3, data: new Uint8Array(1708 * 1331 * 3).fill(200) }, "jpeg"));
  fs.writeFileSync(path.join(dir, "s0002.jpg"), encodeImage({ width: 1708, height: 1331, channels: 3, data: new Uint8Array(1708 * 1331 * 3).fill(180) }, "jpeg"));
  await w.ok(["media", "add", dir, "--recordset", "B1"]);
  if (part) {
    const [, , pw, ph] = part.split(",").map(Number);
    const h = Math.round((2000 / pw!) * ph! * (1331 / 1708));
    const file = path.join(w.dir, "výřez ř.jpg");
    fs.writeFileSync(file, encodeImage({ width: 2000, height: h, channels: 3, data: new Uint8Array(2000 * h * 3).fill(120) }, "jpeg"));
    await w.ok(["media", "add", file, "--recordset", "B1", "--image", "1", "--crop", part]);
  }
  await w.ok(["source", "add", "Křest Vojtěcha Lhotáka 1850", "--kind", "baptism", "--recordset", "B1", "--clip", `B1:1@${CLIP.x},${CLIP.y},${CLIP.w},${CLIP.h}`, "--date", "1850"]); // S0001
  const tree = Tree.open(w.cwd, w.env);
  tree.actor = "N0001";
  tree.withTreeLock(() => {
    tree.put({ ...tree.get<Source>("S0001")!, transcript: "Vojtěch Lhoták z Lhoty", updated: now() }, { op: "source.edit", targets: ["S0001"], summary: "S0001 read by the research" });
    tree.commit("S0001 read by the research");
  });
  const rdir = path.join(w.dir, "čtenář");
  fs.mkdirSync(rdir);
  fs.writeFileSync(path.join(rdir, "reader.mjs"), READER);
  const log = path.join(rdir, "prompts.log");
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: path.join(rdir, "reader.mjs"), DOC_PROMPTS: log, STROM_NO_CONVERT: "1" });
  const journal = path.join(w.cwd, ".strom", "views", "views.jsonl");
  return {
    w,
    prompts: () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8") : ""),
    views: () => (fs.existsSync(journal) ? fs.readFileSync(journal, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((v) => v.reader) : []),
  };
}

const near = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]!) < 0.003);

test("E1: a sharper part that holds all of the source's excerpt is read from, its margin alone left out; the reader's regions placed on the page", opts, async () => {
  // the part fetched exactly on the excerpt: the place read (the excerpt with its margin) runs past it on every side
  const { w, views } = await setUp(`${CLIP.x},${CLIP.y},${CLIP.w},${CLIP.h}`);
  try {
    const d = (await w.ok(["document", "read", "--source", "S0001", "--agent", "script", "--json"])).json;
    assert.equal(d.state, "done", JSON.stringify(d));
    assert.deepEqual(views().map((v) => v.key), ["M0003"], "the view made of the sharper part, not of the whole image reduced");
    // the reader's region (all of its view) is the excerpt on the page, not the place with its margin
    assert.ok(near(d.entries[0].region, [CLIP.x, CLIP.y, CLIP.w, CLIP.h]), JSON.stringify(d.entries[0].region));
    // the state keeps what the view showed
    const state = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "reads", `${d.id}.json`), "utf8"));
    assert.ok(near(state.pages[0].shows, [CLIP.x, CLIP.y, CLIP.w, CLIP.h]), JSON.stringify(state.pages[0]));
    // read again: the same view, nothing of a sharper crop from the archive offered
    const again = await w.ok(["document", "again", d.id, "--agent", "script"]);
    assert.ok(!/sharper: the place is small/u.test(again.out), again.out);
    assert.deepEqual([...new Set(views().map((v) => v.key))], ["M0003"]);
    // an image read with a place of its own (no source): a part that shows nearly all of it (0.9 or more) is read from too
    const before = views().length;
    const own = (await w.ok(["document", "read", "M0001", "--region", "1:0.1,0.4,0.62,0.155", "--agent", "script", "--json"])).json;
    assert.equal(own.state, "done", JSON.stringify(own));
    assert.deepEqual(views().slice(before).map((v) => v.key), ["M0003"]);
    assert.ok(near(own.entries[0].region, [CLIP.x, CLIP.y, CLIP.w, CLIP.h]), JSON.stringify(own.entries[0].region));
    // less than that of it: from the whole image
    const less = (await w.ok(["document", "read", "M0001", "--region", "1:0.05,0.35,0.7,0.25", "--agent", "script", "--json"])).json;
    assert.deepEqual(views().slice(before + 1).map((v) => v.key), ["M0001"]);
    assert.ok(near(less.entries[0].region, [0.05, 0.35, 0.7, 0.25]), JSON.stringify(less.entries[0].region));
  } finally {
    w.cleanup();
  }
});

test("E1: a sharper part that holds only some of the excerpt is not read from; no sharper part: the whole image's view, as before", opts, async () => {
  for (const part of ["0.1,0.4,0.3,0.15", undefined]) {
    const { w, views } = await setUp(part);
    try {
      const d = (await w.ok(["document", "read", "--source", "S0001", "--agent", "script", "--json"])).json;
      assert.equal(d.state, "done", JSON.stringify(d));
      assert.deepEqual(views().map((v) => v.key), ["M0001"], part ?? "no part");
      const state = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "reads", `${d.id}.json`), "utf8"));
      assert.equal(state.pages[0].shows, undefined, "nothing of a view cut");
      // the reader's region is of the place read: the excerpt with its margin (3 % of its longer side)
      assert.ok(near(d.entries[0].region, [0.082, 0.382, 0.636, 0.186]), JSON.stringify(d.entries[0].region));
    } finally {
      w.cleanup();
    }
  }
});
