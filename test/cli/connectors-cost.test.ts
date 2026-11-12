// What building a connector is told before it costs an archive hours: an image of many requests (tiles) said by its
// test with what a book takes at the archive's pace — from the test's own measure, nothing asked for it — and the
// archive's terms strom's list knows, quoted where the connector is started and tested. A local server plays the
// archive; the pauses are recorded, not slept.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, pluginDir } from "../helpers.ts";
import { opts, world, tiled } from "./connectors.helpers.ts";

test("connector test: an image of many requests (tiles) is said with what a book takes at the archive's pace — nothing more asked of it", opts, async () => {
  const { w, a, dir } = await world();
  try {
    // one request an image: nothing said
    tiled(dir, a.base, 12);
    const whole = await w.ok(["connector", "test", "zkusebni", "--fetch", "whole", "--images", "1-2"]);
    assert.doesNotMatch(whole.out, /requests \(tiles, most likely\)|DISCOVERY\.md, step 2/);
    // twelve tiles an image: the cost, the time an image and a book takes, and what to look for first
    a.hits.length = 0;
    const t = await w.ok(["connector", "test", "zkusebni", "--fetch", "5359", "--images", "1-2", "--max", "30"]);
    assert.match(t.out, /images \(2\)/);
    assert.match(t.out, /⚠ one image cost 12 requests \(tiles, most likely\) — at its pace \(at least 2 s apart, no hourly cap\) about 24 s an image, 80 min for a book of 200 images/);
    assert.match(t.out, /before tiles look again for one request an image \(DISCOVERY\.md, step 2\): the portal's own link to the full image, a download of the whole book/);
    assert.equal(a.hits.filter((h) => h.startsWith("/tile/")).length, 24, "the test's own requests");
    assert.deepEqual(a.hits.filter((h) => !h.startsWith("/tile/") && h !== "/robots.txt"), [], "nothing asked for the measure");
    const json = await w.ok(["connector", "test", "zkusebni", "--fetch", "5359", "--images", "1", "--max", "30", "--json"]);
    assert.equal(json.json.heavy.perImage, 12);
    assert.equal(json.json.heavy.bookImages, undefined);
    // the book's own number of images, as the connector gave it: the time of that book
    tiled(dir, a.base, 12, 254);
    const known = await w.ok(["connector", "test", "zkusebni", "--fetch", "5359", "--images", "1", "--max", "30", "--json"]);
    assert.equal(known.json.heavy.bookImages, 254);
    assert.match((await w.ok(["connector", "test", "zkusebni", "--fetch", "5359", "--images", "1", "--max", "30"])).out, /about 24 s an image, 1\.7 h for this book's 254 images/);
    // the first test at its default cap gets no image whole: said too, with how to see the cost
    tiled(dir, a.base, 12);
    const capped = await w.run(["connector", "test", "zkusebni", "--fetch", "5359", "--images", "1"]);
    assert.match(capped.out, /⚠ not one image whole within 10 requests: one costs more \(--max up to 50 to see how many\) \(tiles, most likely\) — at its pace \(at least 2 s apart, no hourly cap\) at least 20 s an image/);
    // ten requests an image is not past it
    tiled(dir, a.base, 10);
    assert.doesNotMatch((await w.ok(["connector", "test", "zkusebni", "--fetch", "5359", "--images", "1", "--max", "30"])).out, /tiles, most likely/);
  } finally {
    w.cleanup();
    await a.close();
  }
});

/** A test's own known terms (STROM_ARCHIVES_FILE, with settings of its own) — a quote with diacritics and a "$&". */
function knownPack(w: World, host: string): string {
  const quote = "Lze prohlížet a stahovat jednotlivé snímky i celé sady ($& bez omezení).";
  const file = path.join(w.dir, "archives.json");
  fs.writeFileSync(file, JSON.stringify({ archives: [{ host, name: "Archiv Lhota", level: "restricted", terms: "https://archiv.example.org/napoveda", quote, scope: "the catalogue by itself; images with the person's permission", checked: "2026-11-04" }] }));
  w.env.STROM_ARCHIVES_FILE = file;
  return quote;
}

test("connector new and test: the archive's terms strom knows are quoted for the agent, with what they cover and where from", opts, async () => {
  const w = new World();
  try {
    await w.ok(["setup", "--yes"]);
    const quote = knownPack(w, "archiv.example.org");
    const r = await w.ok(["connector", "new", "lhota", "--url", "https://digi.archiv.example.org/portal", "--title", "Archiv Lhota"]);
    assert.ok(r.out.includes(`strom knows the terms of Archiv Lhota: restricted (checked 2026-11-04)\n  "${quote}" — its terms: https://archiv.example.org/napoveda\n  what it covers: the catalogue by itself; images with the person's permission`), r.out);
    assert.match(r.out, /start connector\.json's policy from them \(terms, termsSummary, automation\)/);
    const discovery = fs.readFileSync(path.join(pluginDir(w, "lhota"), "DISCOVERY.md"), "utf8");
    assert.ok(discovery.includes(`## What strom knows of this archive\n\nstrom knows the terms of Archiv Lhota: restricted (checked 2026-11-04)\n- "${quote}"`), discovery);
    assert.match(discovery, /## What strom knows of this archive[\s\S]*## 1\. What does the portal allow\?/);
    const json = await w.ok(["connector", "new", "lhota-2", "--url", "https://archiv.example.org", "--json"]);
    assert.deepEqual(json.json.knownTerms, [{ host: "archiv.example.org", name: "Archiv Lhota", level: "restricted", quote, from: "terms", terms: "https://archiv.example.org/napoveda", scope: "the catalogue by itself; images with the person's permission", checked: "2026-11-04" }]);
    // a portal strom knows nothing of: nothing said, the brief as it was
    const other = await w.ok(["connector", "new", "jinde", "--url", "https://jinde.example.net"]);
    assert.doesNotMatch(other.out, /strom knows the terms/);
    assert.doesNotMatch(fs.readFileSync(path.join(pluginDir(w, "jinde"), "DISCOVERY.md"), "utf8"), /What strom knows of this archive/);
  } finally {
    w.cleanup();
  }
});

test("connector test: the known terms said while connector.json does not give them, not once it does", opts, async () => {
  const { w, a, dir } = await world();
  try {
    const quote = knownPack(w, "127.0.0.1");
    const found = await w.ok(["connector", "test", "zkusebni", "--find", "Lhota"]);
    assert.ok(found.out.includes(`strom knows the terms of Archiv Lhota: restricted (checked 2026-11-04)\n  "${quote}"`), found.out);
    const manifest = path.join(dir, "connector.json");
    const m = JSON.parse(fs.readFileSync(manifest, "utf8"));
    fs.writeFileSync(manifest, JSON.stringify({ ...m, policy: { ...m.policy, automation: "restricted", terms: "https://archiv.example.org/napoveda", termsSummary: quote } }, null, 2));
    assert.doesNotMatch((await w.ok(["connector", "test", "zkusebni", "--find", "Lhota"])).out, /strom knows the terms/);
  } finally {
    w.cleanup();
    await a.close();
  }
});
