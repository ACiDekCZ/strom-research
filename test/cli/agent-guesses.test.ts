// What agents guess (§6 of the logs, 2026-10-16): strom book … for strom recordset …, the registered images of a
// book in recordset show (--images), media view --whole, searched --surname/--task, story list, the list filters as
// --find/--search — and a "similar option" only where it is near (--whole is no --home).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { blank } from "../../src/image/image.ts";
import { suggest } from "../../src/cli/execute.ts";

const opts = { skip: !hasGit };

async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  w.env.STROM_LANG = "en";
  await w.ok(["repo", "add", "Zemský archiv"]);
  await w.ok(["recordset", "add", "Matrika Dolní Lhota N 1850–1870", "--repo", "R0001", "--kinds", "baptism", "--places", "Dolní Lhota", "--years", "1850-1870", "--images", "40"]); // B0001
  return w;
}

/** Images of B0001 with these numbers, each of its own content (a grey of its own). */
async function images(w: World, nums: number[], shade = 0): Promise<void> {
  const dir = fs.mkdtempSync(path.join(w.dir, "snímky-"));
  for (const n of nums) fs.writeFileSync(path.join(dir, `obr-${String(n).padStart(3, "0")}.jpg`), encodeJpeg(blank(60 + shade, 40, 1, (n * 7 + shade) % 250), 85));
  await w.ok(["media", "add", dir, "--recordset", "B1"]);
}

test("strom book … is strom recordset …: taken, said in recordset's help, never a command of its own", opts, async () => {
  const w = await world();
  try {
    assert.equal((await w.ok(["book", "show", "B0001"])).out, (await w.ok(["recordset", "show", "B0001"])).out);
    assert.match((await w.ok(["book", "list", "lhota"])).out, /B0001 +Matrika Dolní Lhota/);
    // the group alone: recordset's commands
    const group = (await w.ok(["book"])).out;
    assert.match(group, /^strom recordset <command>/);
    assert.match(group, /recordset show/);
    assert.match(group, /Also: strom book <command>/);
    assert.match((await w.ok(["help", "book"])).out, /^strom recordset <command>/);
    assert.match((await w.ok(["help", "book", "show"])).out, /^strom recordset show <recordset>/);
    assert.match((await w.ok(["help", "recordset", "show"])).out, /Also: strom book show/);
    assert.match((await w.ok(["help", "recordset"])).out, /Also: strom book <command>/);
    // a typo after it: recordset's commands offered
    const typo = await w.run(["book", "shwo", "B0001"]);
    assert.equal(typo.code, 2);
    assert.match(typo.err, /unknown command "strom book shwo"[\s\S]*similar command: strom book show/);
    // no subcommand, a book's ID: said as typed, its show offered (never "strom recordset B0001")
    const bare = await w.run(["book", "B0001"]);
    assert.equal(bare.code, 2);
    assert.match(bare.err, /unknown command "strom book B0001"[\s\S]*similar command: strom book show B0001/);
    assert.doesNotMatch(bare.err, /strom recordset B0001/);
    // the overview and the catalog: no command of its own, an alias of each
    assert.doesNotMatch((await w.ok(["help"])).out, /\bbook (show|list)/);
    const cat = (await w.ok(["commands", "--json"])).json;
    const list: any[] = cat.commands ?? cat;
    assert.equal(list.filter((c) => String(c.command).startsWith("book")).length, 0);
    assert.deepEqual(list.find((c) => c.command === "recordset show").aliases, ["book show"]);
    assert.deepEqual(list.find((c) => c.command === "recordset add").aliases, ["book add"]);
  } finally {
    w.cleanup();
  }
});

test("recordset show: how many images are registered and which — holes, parts only, copies; --images in full", opts, async () => {
  const w = await world();
  try {
    assert.match((await w.ok(["recordset", "show", "B1"])).out, /^images +none registered whole$/m);
    await images(w, [4, 5, 6, 8, 9]);
    // image 5 again, sharper (another copy); image 7 only a half of it
    const copy = path.join(w.dir, "kopie 5.jpg");
    fs.writeFileSync(copy, encodeJpeg(blank(120, 80, 1, 33), 85));
    await w.ok(["media", "add", copy, "--recordset", "B1", "--image", "5"]);
    const half = path.join(w.dir, "půlka 7.jpg");
    fs.writeFileSync(half, encodeJpeg(blank(30, 40, 1, 66), 85));
    await w.ok(["media", "add", half, "--recordset", "B1", "--image", "7", "--half", "left"]);
    const out = (await w.ok(["recordset", "show", "B1"])).out;
    assert.match(out, /^images +5 of 40 registered — 4–6, 8–9$/m);
    assert.match(out, /^ +only in parts \(no whole image to read\): 1 — 7$/m);
    assert.match(out, /^ +in several copies \(the sharpest is the image\): 1 — 5$/m);
    const j = (await w.ok(["recordset", "show", "B1", "--json"])).json;
    assert.deepEqual(j.images, { registered: 5, ranges: [[4, 6], [8, 9]], partsOnly: [[7, 7]], copies: [[5, 5]], unnumbered: 0 });
    // what agents typed for it: taken
    assert.match((await w.ok(["book", "show", "B1", "--images"])).out, /^images +5 of 40 registered — 4–6, 8–9$/m);
    // many holes: the first ranges, the rest with --images
    await images(w, [11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31], 3);
    const cut = (await w.ok(["recordset", "show", "B1"])).out;
    assert.match(cut, /^images +16 of 40 registered — 4–6, 8–9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, … \(13 ranges: strom recordset show B0001 --images\)$/m);
    assert.match((await w.ok(["recordset", "show", "B1", "--images"])).out, /registered — 4–6, 8–9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31$/m);
  } finally {
    w.cleanup();
  }
});

test("media view --whole: the image whole, as without a part; with a part of it said", opts, async () => {
  const w = await world();
  try {
    await images(w, [4]);
    const plain = await w.ok(["media", "view", "B1:4"]);
    const whole = await w.ok(["media", "view", "B1:4", "--whole"]);
    assert.equal(whole.out.replace(/\S*\.strom\S*/g, "<view>"), plain.out.replace(/\S*\.strom\S*/g, "<view>"));
    const both = await w.run(["media", "view", "B1:4", "--whole", "--half", "left"]);
    assert.equal(both.code, 2);
    assert.match(both.err, /--whole is the image whole: no --half with it/);
    assert.match((await w.ok(["help", "media", "view"])).out, /--whole +the image whole/);
  } finally {
    w.cleanup();
  }
});

test("searched --surname / --task: only those searches — any script, accents and NFD optional; without a what", opts, async () => {
  const w = await world();
  try {
    await w.ok(["person", "add", "Řehoř /Šťastný/", "--sex", "M", "--born", "1855"]); // P0001
    await w.ok(["task", "add", "Křest Řehoře", "--level", "link", "--where", "B0001", "--why", "rodiče", "--done-when", "nalezen", "--about", "P0001"]); // T0001
    await w.ok(["task", "add", "Křest Петров", "--level", "link", "--where", "B0001", "--why", "rodiče", "--done-when", "nalezen", "--about", "P0001"]); // T0002
    await w.ok(["search", "add", "Křty Šťastný 1850–1860", "--recordset", "B0001", "--years", "1850-1860", "--surname", "Šťastný", "--method", "index", "--result", "negative", "--task", "T0001"]);
    await w.ok(["search", "add", "Křty Петров 1850–1860", "--recordset", "B0001", "--years", "1850-1860", "--surname", "Петров", "--method", "index", "--result", "negative", "--task", "T0002"]);
    await w.ok(["search", "add", "Křty Šťastný 1861–1870", "--recordset", "B0001", "--years", "1861-1870", "--surname", "Šťastný", "--method", "page-by-page", "--result", "negative", "--task", "T0002"]);
    const ids = async (args: string[]) => (await w.ok(["searched", ...args, "--json"])).json.searches.map((s: any) => s.id);
    const all = (await w.ok(["searched", "B0001", "--json"])).json.searches.map((s: any) => s.id);
    assert.equal(all.length, 3);
    const [a, b, c] = all;
    assert.deepEqual(await ids(["B0001", "--surname", "stastny"]), [a, c]);
    assert.deepEqual(await ids(["B0001", "--surname", "Šťastný".normalize("NFD")]), [a, c]);
    assert.deepEqual(await ids(["B0001", "--surname", "ПЕТРОВ"]), [b]);
    assert.deepEqual(await ids(["--surname", "Šťastný"]), [a, c], "no what: all searches for the surname");
    assert.deepEqual(await ids(["--task", "T2"]), [b, c]);
    assert.deepEqual(await ids(["T0002"]), [b, c], "a task as the what");
    assert.deepEqual(await ids(["B0001", "--surname", "Šťastný", "--task", "T0002", "--years", "1865"]), [c]);
    assert.match((await w.ok(["searched", "--surname", "Šťastný", "--task", "T0001"])).out, /^1 search\(es\) for Šťastný · T0001 — 1 negative/);
    assert.match((await w.ok(["searched", "B0001", "--surnames", "Петров"])).out, /^1 search\(es\) for B0001 · surname Петров/);
    assert.equal((await w.run(["searched", "--task", "T0099"])).code, 2);
    const none = await w.run(["searched"]);
    assert.equal(none.code, 2);
    assert.match(none.err, /missing <what>/);
  } finally {
    w.cleanup();
  }
});

test("story list: whose stories there are, a draft, a new version waiting", opts, async () => {
  const w = await world();
  try {
    assert.equal((await w.ok(["story", "list"])).out.trim(), "no stories yet");
    await w.ok(["person", "add", "Řehoř /Šťastný/", "--sex", "M", "--born", "1855"]); // P0001
    await w.ok(["person", "add", "Анна /Петрова/", "--sex", "F", "--born", "1860"]); // P0002
    await w.ok(["story", "set", "P1", "--text", "Řehoř se narodil v Dolní Lhotě.", "--title", "Syn chalupníka"]);
    await w.ok(["story", "set", "P2", "--text", "Анна родилась в 1860 году.", "--final"]);
    const out = (await w.ok(["story", "list"])).out;
    assert.match(out, /^P0001 +Řehoř Šťastný.* +draft +\d{4}-\d\d-\d\d +Syn chalupníka$/m);
    assert.match(out, /^P0002 +Анна Петрова.* +final +\d{4}-\d\d-\d\d/m);
    assert.match(out, /strom story show <P…\|F…>/);
    await w.ok(["story", "set", "P2", "--text", "Анна родилась в 1860 году в деревне."]);
    const waiting = (await w.ok(["story", "list", "--draft", "--json"])).json.stories;
    assert.deepEqual(waiting.map((s: any) => [s.id, s.status, !!s.draft]), [["P0001", "draft", false], ["P0002", "final", true]]);
    assert.match((await w.ok(["story", "list"])).out, /^P0002 .*final .*new version waits/m);
  } finally {
    w.cleanup();
  }
});

test("a list's filter typed as --find or --search: its argument said", opts, async () => {
  const w = await world();
  try {
    const find = await w.run(["recordset", "list", "--find", "lhota"]);
    assert.equal(find.code, 2);
    assert.match(find.err, /--find is no option of strom recordset list: <filter> is its argument\n→ strom recordset list <filter>/);
    assert.match((await w.run(["source", "list", "--search", "křest"])).err, /--search is no option of strom source list: <filter> is its argument/);
    // the argument by its own name, as before
    assert.match((await w.run(["recordset", "list", "--filter", "lhota"])).err, /filter is an argument of strom recordset list, not an option/);
  } finally {
    w.cleanup();
  }
});

test("a similar option only where it is near: --whole is no --home, a typo still found", opts, async () => {
  assert.deepEqual(suggest("--whole", ["--home", "--help", "--json"]), []);
  assert.deepEqual(suggest("--imgaes", ["--images", "--image", "--json"]).slice(0, 1), ["--images"]);
  assert.deepEqual(suggest("--bron", ["--born", "--sex"]), ["--born"]);
  assert.deepEqual(suggest("--surnamez", ["--surname", "--years"]), ["--surname"]);
  assert.deepEqual(suggest("person ad", ["person add", "person list"]), ["person add"]);
  assert.deepEqual(suggest("recordset shwo", ["recordset show", "recordset list"]), ["recordset show"]);
  // a prefix of one or two letters is no near word
  assert.deepEqual(suggest("--xy", ["--x-ray-of-everything"]), []);
  const w = await world();
  try {
    const whole = await w.run(["person", "add", "Řehoř /Šťastný/", "--whole"]);
    assert.equal(whole.code, 2);
    assert.match(whole.err, /unknown option --whole for strom person add/);
    assert.doesNotMatch(whole.err, /similar option: --home/);
    assert.match((await w.run(["recordset", "show", "B0001", "--imgaes"])).err, /similar option: --images/);
  } finally {
    w.cleanup();
  }
});
