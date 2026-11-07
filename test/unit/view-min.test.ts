// How much a small crop is enlarged for a reader: as before for Claude (800 px), to about 2000 px for a GPT reader
// (Codex, OpenCode on an OpenAI model) — at most 3×, never above what the model takes; whether the scan holds little
// detail there is judged as before (View.lifted).
import "../helpers.ts"; // run alone too: never the person's home and settings
import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { imageMin, VIEW_MIN } from "../../src/agents/images.ts";
import { makeView, viewSize } from "../../src/core/views.ts";
import { defaultViewSizes, viewSizes } from "../../src/core/viewsizes.ts";
import { Tree } from "../../src/core/tree.ts";

function folder(t: TestContext): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "strom-viewmin-"));
  t.after(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
}

test("the long side a small crop is enlarged to: 800 for Claude and every other agent, about 2000 for a GPT reader", () => {
  assert.equal(VIEW_MIN, 800);
  for (const m of [undefined, "opus", "claude-opus-5-5", "haiku", "sonnet"]) assert.equal(imageMin("claude", m), 800, String(m));
  for (const m of [undefined, "gpt-5.5", "gpt-5.4-mini"]) assert.equal(imageMin("codex", m), 2000, String(m));
  for (const m of ["openai/gpt-5.5", "OpenAI/GPT-5"]) assert.equal(imageMin("opencode", m), 2000, m);
  for (const m of [undefined, "anthropic/claude-sonnet-5-5", "google/gemini-3-pro"]) assert.equal(imageMin("opencode", m), 800, String(m));
  for (const a of ["grok", "antigravity", "script", undefined]) assert.equal(imageMin(a, "gpt-5"), 800, String(a));
  // the defaults and a calibration: never above the reading size
  assert.equal(defaultViewSizes("claude", "opus").min, 800);
  assert.equal(defaultViewSizes("codex", undefined).min, 2000);
  const cal = { viewSizes: { "codex gpt-5.5": { find: 1000, read: 1200, at: "2026-11-01", sample: 4, sizes: [1200, 2000], clear: { find: true, read: true } } } };
  const s = viewSizes(cal, "codex", "gpt-5.5");
  assert.equal(s.read, 1200);
  // N2: a calibration measures whole images and halves reduced, never a small crop enlarged — a GPT reader's
  // enlargement goes by what its model takes; the default one (800) stays within a calibrated read as before
  assert.equal(s.min, 2000, "a calibrated reading size no cap of a GPT reader's enlargement");
  assert.equal(s.max, 2000);
  const claude = (read: number) => viewSizes({ viewSizes: { "claude opus": { find: 1000, read, at: "2026-11-01", sample: 4, sizes: [600, 2000], clear: { find: true, read: true } } } }, "claude", "opus");
  assert.equal(claude(1400).min, 800, "Claude as before");
  assert.equal(claude(600).min, 600, "Claude as before: a calibrated read below 800 caps it");
});

test("a crop enlarged to its reader's min, at most 3× and never above max; a whole image as before; the scan judged as before", (t) => {
  const root = path.join(folder(t), "Lhotákovi");
  const tree = Tree.create(root, "Lhotákovi", "cs", process.env);
  const W = 3000;
  const H = 2000;
  const data = new Uint8Array(W * H);
  for (let i = 0; i < data.length; i++) data[i] = i % 7 === 0 ? 30 : 220;
  const file = path.join(root, "scan.jpg");
  fs.writeFileSync(file, encodeJpeg({ width: W, height: H, channels: 1, data }));
  const long = (v: { width: number; height: number }) => Math.max(v.width, v.height);
  // Claude, as before: a 600 px crop to 800, a 900 px crop as it is
  const a = makeView(tree, file, "scan", { crop: "0,0,600,400", max: 2000 });
  assert.equal(long(a), 800);
  assert.equal(a.lifted, undefined);
  assert.equal(viewSize(a), "enlarged");
  const b = makeView(tree, file, "scan", { crop: "0,0,900,600", max: 2000 });
  assert.equal(long(b), 900);
  assert.equal(viewSize(b), undefined);
  // a GPT reader: the 600 px crop 3× (1800), the 900 px one to 2000 — judged as the default would have shown them
  const c = makeView(tree, file, "scan", { crop: "0,0,600,400", max: 2000, min: 2000 });
  assert.equal(long(c), 1800);
  assert.equal(viewSize(c), "enlarged");
  const d = makeView(tree, file, "scan", { crop: "0,0,900,600", max: 2000, min: 2000 });
  assert.equal(long(d), 2000);
  assert.equal(d.lifted, 1);
  assert.equal(viewSize(d), undefined, "the scan holds as much detail there as before: no sharper scan asked for");
  assert.notEqual(d.file, b.file, "a view of another size is another file");
  // never above max; a whole image and a big crop as before
  assert.equal(long(makeView(tree, file, "scan", { crop: "0,0,900,600", max: 1568, min: 2000 })), 1568);
  assert.equal(long(makeView(tree, file, "scan", { max: 2000, min: 2000 })), 2000);
  assert.equal(long(makeView(tree, file, "scan", { crop: "0,0,2400,1600", max: 2000, min: 2000 })), 2000);
  assert.equal(long(makeView(tree, file, "scan", { crop: "0,0,1500,1000", max: 2000, min: 2000 })), 2000);
  assert.equal(long(makeView(tree, file, "scan", { crop: "0,0,1500,1000", max: 2000 })), 1500, "Claude: a crop above 800 as it is");
});

// N2: a GPT reader's small crop where a calibration set the reading size below what the model takes: enlarged by the
// model (liftMax), never above an explicit --max (no liftMax); Claude's views the same files as before.
test("N2: a GPT reader's small crop enlarged up to what the model takes above a calibrated read; --max asked holds; Claude the same view", (t) => {
  const root = path.join(folder(t), "Lhotákovi");
  const tree = Tree.create(root, "Lhotákovi", "cs", process.env);
  const W = 3000;
  const H = 2000;
  const data = new Uint8Array(W * H);
  for (let i = 0; i < data.length; i++) data[i] = i % 5 === 0 ? 40 : 210;
  const file = path.join(root, "scan.jpg");
  fs.writeFileSync(file, encodeJpeg({ width: W, height: H, channels: 1, data }));
  const long = (v: { width: number; height: number }) => Math.max(v.width, v.height);
  // calibrated read 1400, the model takes 2000
  const g = makeView(tree, file, "scan", { crop: "0,0,700,400", max: 1400, min: 2000, liftMax: 2000 });
  assert.equal(long(g), 2000);
  assert.equal(g.lifted, 800 / 700);
  assert.equal(long(makeView(tree, file, "scan", { crop: "0,0,700,400", max: 1400, min: 2000 })), 1400, "an explicit --max: never above it");
  // a part above the calibrated read: reduced to it as the calibration found (liftMax enlarges, never reduces less)
  assert.equal(long(makeView(tree, file, "scan", { crop: "0,0,1800,1200", max: 1400, min: 2000, liftMax: 2000 })), 1400);
  // a half (what a calibration measures): within the calibrated read, as before
  assert.equal(long(makeView(tree, file, "scan", { crop: "0,0,1000,1300", max: 1400, min: 2000, liftMax: 2000 }, { kind: "half" })), 1400);
  // Claude: the same view, the same file, with or without liftMax
  const a = makeView(tree, file, "scan", { crop: "0,0,600,400", max: 1400, min: 800 });
  const b = makeView(tree, file, "scan", { crop: "0,0,600,400", max: 1400, min: 800, liftMax: 2000 });
  assert.equal(a.file, b.file);
  assert.deepEqual([b.width, b.height, b.scale, b.lifted], [a.width, a.height, a.scale, undefined]);
  const c = makeView(tree, file, "scan", { crop: "0,0,500,300", max: 600, min: 600 });
  const d = makeView(tree, file, "scan", { crop: "0,0,500,300", max: 600, min: 600, liftMax: 2000 });
  assert.deepEqual([d.file, d.width, d.scale], [c.file, c.width, c.scale], "a Claude calibration below 800 as before");
});

// N1: the views' record keeps the scale a GPT reader's view would have at the default enlargement (lifted), what the
// measure of the reading judges it by (core/readstats.ts M6, M9); Claude's line as before, nothing added.
test("N1: the views' record keeps lifted of a GPT reader's enlarged crop; Claude's line has the fields it had", (t) => {
  const root = path.join(folder(t), "Lhotákovi");
  const tree = Tree.create(root, "Lhotákovi", "cs", process.env);
  const data = new Uint8Array(3000 * 2000).fill(200);
  const file = path.join(root, "scan.jpg");
  fs.writeFileSync(file, encodeJpeg({ width: 3000, height: 2000, channels: 1, data }));
  const journal = path.join(root, ".strom", "views", "views.jsonl");
  const last = () => JSON.parse(fs.readFileSync(journal, "utf8").trim().split("\n").at(-1)!) as Record<string, unknown>;
  makeView(tree, file, "scan", { crop: "0,0,900,600", max: 2000, min: 2000 }, { reader: true });
  assert.equal(last().scale, 2000 / 900);
  assert.equal(last().lifted, 1);
  makeView(tree, file, "scan", { crop: "0,0,500,300", max: 2000, min: 2000 }, { reader: true });
  assert.equal(last().lifted, 1.6);
  makeView(tree, file, "scan", { crop: "0,0,500,300", max: 2000 }, { reader: true });
  assert.deepEqual(Object.keys(last()), ["at", "key", "by", "view", "region", "scale", "w", "h", "W", "H", "kind", "cap", "cached", "reader"]);
  assert.equal(last().scale, 1.6);
});
