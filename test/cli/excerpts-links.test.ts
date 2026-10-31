// The page of each scan in the online archive, in the file for the Strom app: _URL on each excerpt, WWW on the source
// (the excerpts the file leaves out, the sources of no excerpt); the standard file keeps the address in the note.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { hasGit } from "../helpers.ts";
import { opts, world, stromRepo, tsx } from "./excerpts.helpers.ts";

/** The SOUR record of one source in a GEDCOM text. */
const record = (ged: string, id: string) => ged.split(/\n(?=0 )/u).find((r) => r.startsWith(`0 @${id}@ SOUR`)) ?? "";

test("the Strom file links the page of each scan: _URL on the excerpt, WWW on the source; nothing made up, nothing unsafe", opts, async () => {
  const w = await world(); // the book's images at https://archive.example.org/book/1
  await w.ok(["source", "add", "Křest Jana", "--kind", "baptism", "--recordset", "B1", "--clip", "B1:4@0.1,0.4,0.8,0.08"]);
  // the source says the page more exactly than its image (a portal's book against its page): the source's
  await w.ok(["source", "add", "Křest Anny", "--kind", "baptism", "--recordset", "B1", "--clip", "B1:2@0.1,0.1,0.5,0.1", "--url", "https://archive.example.org/book/1/2"]);
  await w.ok(["source", "add", "Pohřeb Václava", "--kind", "burial", "--recordset", "B1", "--media", "B1:1"]); // on an image, no clip
  await w.ok(["source", "add", "Věstník z Lhoty", "--kind", "newspaper", "--url", "https://news.example.org/1890/4"]); // no image
  await w.ok(["source", "add", "Soubor Lhota", "--kind", "other", "--url", "file:///C:/Users/x/lhota.pdf"]); // not a page anyone opens
  await w.ok(["export", "gedcom", "--images", "--images-for", "all"]);
  const ged = fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  assert.match(record(ged, "S0001"), /\n1 WWW https:\/\/archive\.example\.org\/book\/1\n[\s\S]*\n2 _STROM_KIND excerpt\n2 _STROM_CLIP c[0-9a-f]{10}\n2 _URL https:\/\/archive\.example\.org\/book\/1\n/);
  assert.match(record(ged, "S0002"), /\n1 WWW https:\/\/archive\.example\.org\/book\/1\/2\n[\s\S]*\n2 _URL https:\/\/archive\.example\.org\/book\/1\/2\n/);
  assert.match(record(ged, "S0003"), /\n1 WWW https:\/\/archive\.example\.org\/book\/1\n/);
  assert.doesNotMatch(record(ged, "S0003"), /OBJE/);
  assert.match(record(ged, "S0004"), /\n1 WWW https:\/\/news\.example\.org\/1890\/4\n/);
  assert.doesNotMatch(record(ged, "S0005"), /\n1 WWW /);
  // an excerpt left out (over the limit): the source's page still goes
  await w.ok(["export", "gedcom", "--images-max-mb", "0.001"]);
  const small = fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  assert.doesNotMatch(record(small, "S0001"), /_URL/);
  assert.match(record(small, "S0001"), /\n1 WWW https:\/\/archive\.example\.org\/book\/1\n/);
  // the standard file: GEDCOM 5.5.1 has no WWW on a source — the address in its note, as before
  const standard = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  assert.doesNotMatch(standard, /\n1 WWW /);
  assert.match(record(standard, "S0004"), /https:\/\/news\.example\.org\/1890\/4/);
  w.cleanup();
});

test("the Strom app reads the pages: each excerpt's pageUrl, the source's url", { skip: !hasGit || !fs.existsSync(tsx) }, async () => {
  const w = await world();
  await w.ok(["source", "add", "Křest Jana", "--kind", "baptism", "--recordset", "B1", "--clip", "B1:4@0.1,0.4,0.8,0.08", "--url", "https://archive.example.org/book/1/4"]);
  await w.ok(["source", "add", "Pohřeb Václava", "--kind", "burial", "--recordset", "B1", "--media", "B1:1"]);
  await w.ok(["export", "gedcom", "--images", "--images-for", "all"]);
  const script = path.join(w.dir, "rt.ts");
  fs.writeFileSync(
    script,
    `import fs from "node:fs";
import { parseGedcom } from ${JSON.stringify(path.join(stromRepo, "src", "ged-parser.ts"))};
const parsed = parseGedcom(fs.readFileSync(process.argv[2], "utf8")) as any;
const sources = [...(parsed.sources?.values?.() ?? Object.values(parsed.sources ?? {}))] as any[];
console.log(JSON.stringify(sources.map((s) => ({ title: s.title, url: s.url, pages: (s.media ?? []).map((m: any) => m.pageUrl) }))));
`,
  );
  const r = spawnSync(tsx, [script, path.join(w.cwd, "output", "tree-strom.ged")], { cwd: stromRepo, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const got = JSON.parse(r.stdout.trim().split("\n").pop()!) as { title: string; url?: string; pages: string[] }[];
  const jan = got.find((s) => s.title === "Křest Jana")!;
  assert.equal(jan.url, "https://archive.example.org/book/1/4");
  assert.deepEqual(jan.pages, ["https://archive.example.org/book/1/4"]);
  assert.equal(got.find((s) => s.title === "Pohřeb Václava")?.url, "https://archive.example.org/book/1");
  w.cleanup();
});
