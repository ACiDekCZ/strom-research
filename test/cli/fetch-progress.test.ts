// A long strom fetch counts its images as they come, where it said nothing until its summary: at a terminal one line
// written over, where nobody watches a line at each tenth (never one per image), none for a fetch of a few images;
// on stderr, so --json keeps stdout pure JSON; the summary as before. A local archive: nothing is slept.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { opts, scans } from "./connectors.helpers.ts";
import { World, fakeConnector } from "../helpers.ts";

/** An archive whose book has as many images as asked, each its own file (a comment of its number in the JPEG). */
async function bigArchive(): Promise<{ base: string; hits: string[]; close: () => Promise<void> }> {
  const scan = fs.readFileSync(path.join(scans, "s0001.jpg"));
  const hits: string[] = [];
  const s = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    hits.push(u.pathname);
    const img = /^\/img\/5359\/(\d+)\.jpg$/.exec(u.pathname);
    if (!img) return res.writeHead(404).end();
    const note = Buffer.from(`image ${img[1]}`);
    const com = Buffer.from([0xff, 0xfe, 0, note.length + 2]);
    return res.writeHead(200, { "content-type": "image/jpeg" }).end(Buffer.concat([scan.subarray(0, 2), com, note, scan.subarray(2)]));
  });
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  s.unref();
  return { base: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, hits, close: () => new Promise<void>((r) => s.close(() => r())) };
}

const counted = (err: string) => err.split("\n").filter((l) => /\d+\/\d+ (images|snímků|Bilder)/.test(l));

test("fetch of many images: counted at each tenth where nobody watches, at a terminal written over, stdout as before", opts, async () => {
  const w = new World();
  await w.withTree();
  w.env.STROM_LANG = "en"; // the test's tree speaks Czech: English unless a run says otherwise
  const a = await bigArchive();
  await fakeConnector(w, "zkusebni", a.base);
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001: one book, its images a run after another

  // nobody watches (an agent): 40 images, a line at each tenth — 9, never the 40th, never one per image
  const plain = await w.ok(["fetch", "zkusebni", "5359", "--images", "1-40", "--recordset", "B1"]);
  assert.deepEqual(counted(plain.err), [4, 8, 12, 16, 20, 24, 28, 32, 36].map((n) => `  · ${n}/40 images`));
  assert.ok(!plain.out.includes("/40 images"), "the count stays off stdout");
  // the summary as before
  assert.match(plain.out, /^40 image\(s\) of B0001 \(images 1–40\) fetched and registered · \d+ s$/m);
  assert.equal(a.hits.filter((h) => h.startsWith("/img/")).length, 40, "the count asks the archive nothing");

  // --json: stdout is the JSON alone, the count on stderr
  const json = await w.ok(["fetch", "zkusebni", "5359", "--images", "41-65", "--recordset", "B1", "--json"]);
  assert.ok(json.json, `stdout is JSON: ${json.out.slice(0, 200)}`);
  assert.equal(json.json.added.length, 25);
  assert.equal(counted(json.err).length, 9);
  assert.equal(counted(json.err)[0], "  · 3/25 images");

  // in the research language
  const cs = await w.ok(["fetch", "zkusebni", "5359", "--images", "66-85", "--recordset", "B1"], { env: { STROM_LANG: "cs" } });
  assert.deepEqual(counted(cs.err), [2, 4, 6, 8, 10, 12, 14, 16, 18].map((n) => `  · ${n}/20 snímků`));
  const de = await w.ok(["fetch", "zkusebni", "5359", "--images", "86-105", "--recordset", "B1"], { env: { STROM_LANG: "de" } });
  assert.equal(counted(de.err)[0], "  · 2/20 Bilder");

  // a few images: nothing counted
  const few = await w.ok(["fetch", "zkusebni", "5359", "--images", "106-108", "--recordset", "B1"]);
  assert.deepEqual(counted(few.err), []);
  assert.match(few.out, /^3 image\(s\) of B0001 \(images 106–108\) fetched and registered/m);

  // at a terminal: one line written over after each image, cleared before the summary — no line of it left
  const tty = await w.ok(["fetch", "zkusebni", "5359", "--images", "109-120", "--recordset", "B1"], { tty: true });
  for (let n = 1; n < 12; n++) assert.ok(tty.err.includes(`\r${n}/12 images`), `${n}/12 written over: ${JSON.stringify(tty.err.slice(-300))}`);
  assert.ok(!tty.err.includes("12/12"), "the last image says nothing: the summary follows");
  const after = tty.err.slice(tty.err.lastIndexOf("/12 images"));
  assert.match(after, /^\/12 images *\r +\r$/, "the line cleared at the end");
  assert.equal(counted(tty.err.replace(/\r/g, "\n")).filter((l) => !l.startsWith("  · ")).length, 11);
  assert.match(tty.out, /^12 image\(s\) of B0001 \(images 109–120\) fetched and registered/m);
  w.cleanup();
  await a.close();
});
