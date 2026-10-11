// strom readings: what earlier readers reported, without reading their reports whole.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "readings");

test("strom readings: finds, unclear entries, possible matches in what was illegible and the gaps — a fraction of the reports", opts, async () => {
  const w = new World();
  await w.withTree();
  assert.match((await w.ok(["readings"])).out, /^no readings yet/);
  await w.ok(["recordset", "add", "Matrika zemřelých 1848–1856"]); // B0001
  const dir = path.join(w.cwd, "notes", "readings");
  fs.mkdirSync(dir, { recursive: true });
  let raw = 0;
  for (const f of fs.readdirSync(fixtures)) {
    fs.copyFileSync(path.join(fixtures, f), path.join(dir, f));
    raw += fs.statSync(path.join(fixtures, f)).size;
  }
  // the reports of strom clips are no readings
  fs.writeFileSync(path.join(dir, "2026-01-20-clips-find-1.md"), "# Where the entries are\n\n## S0001 · M0040\nresult: found\nregion: 0.1,0.2,0.5,0.1\n");

  const r = await w.ok(["readings"]);
  const out = r.out;
  assert.match(out, /^2026-01-15-B0001-31-60 · 3 report\(s\) · B0001 · images 31–60 · found 33, 55 · unclear 46 · nothing 27\nquestion: Každé úmrtí s příjmením Dvořák/);
  assert.match(out, /^context: Rodina Dvořák z Horní Vsi/m);
  assert.match(out, /^ {2}33 \[found\] M0033 · p\. 65–66\n {4}levá strana, 3\. zápis shora: 14\. März 1849/m);
  assert.match(out, /^ {2}37 \[nothing\] illegible: pravá strana, 2\. zápis: muž, 67 let, dům N° 12 \(\?\), příjmení nečitelné/m, "a possible match in a block with nothing found");
  assert.match(out, /^ {2}46 \[unclear\] M0046/m);
  assert.match(out, /^ {4}levá strana, 2\. zápis: 9\. Junii 1854/m, "an old report's entries");
  assert.match(out, /^gaps in the book \(by image\): 44: strany 87–94 chybí/m);
  assert.match(out, /^one image's whole block: strom readings B0001 --image <n>$/m);
  assert.doesNotMatch(out, /^ {2}31 /m);
  assert.doesNotMatch(out, /Prošel jsem/, "no list of what was checked");
  assert.doesNotMatch(out, /clips|S0001/);
  // a fraction of the reports
  assert.ok(Buffer.byteLength(out) * 5 < raw, `${Buffer.byteLength(out)} of ${raw}`);

  // one image whole, word for word
  const one = await w.ok(["readings", "B1", "--image", "37"]);
  assert.match(one.out, /^2026-01-15-B0001-31-60-1 · B0001 · question: /);
  assert.match(one.out, /\n## Image 37 · M0037\nresult: nothing\nentries: žádný zápis Dvořák s jistotou\. Prošel jsem 9 zápisů/);
  assert.match(one.out, /\nhand: kurent, německy\ncertainty: —\npages: 73–74\n?$/);
  assert.match((await w.ok(["readings", "--image", "99"])).out, /^no reader reported image 99/);
  // a few images' blocks: a range, as typed (35-38, 35..38)
  for (const range of ["36-37", "36..37", "36–37"]) {
    const few = await w.ok(["readings", "B1", "--image", range, "--json"]);
    assert.deepEqual([...new Set(few.json.blocks.map((b: { image: number }) => b.image))], [36, 37], range);
  }
  // a range from the higher number or of hundreds of images: said, never guessed
  const back = await w.run(["readings", "B1", "--image", "38..35"]);
  assert.equal(back.code, 2);
  assert.match(back.err, /--image 38\.\.35: a range from the lower number\n→ --image 35-38/);
  const huge = await w.run(["readings", "B1", "--image", "1-5000"]);
  assert.match(huge.err, /--image 1-5000: 5000 images — at most 200 in a range/);
  assert.match((await w.run(["readings", "--image", "abc"])).err, /invalid --image "abc"/);

  // words in any spelling of accents, typed decomposed
  const m = await w.ok(["readings", "--match", "kolar".normalize("NFD"), "--match", "DOLNÍ VES".normalize("NFD"), "--images", "31-35,48-60"]);
  assert.match(m.out, /^2026-01-15-B0001-31-60 · 3 report\(s\) · B0001 · images 31–35, 48–60 · found 33, 55 · nothing 16/);
  assert.match(m.out, /^ {2}32 \[nothing\] entries: .*Joannes Kolář/m);
  assert.match(m.out, /^ {2}48 \[nothing\] section: od levé strany nová část: Dolní Ves, rok 1853$/m);
  assert.match(m.out, /^ {2}55 \[found\]/m);
  assert.doesNotMatch(m.out, /^ {2}4[0-7] /m);

  // one report, a day, a list; --json
  assert.match((await w.ok(["readings", "2026-01-15-B0001-31-60-2.md"])).out, /^2026-01-15-B0001-31-60 · 1 report\(s\) · B0001 · images 41–50 · found none · unclear 46 · nothing 9/);
  assert.match((await w.ok(["readings", "--list"])).out, /^2026-01-15-B0001-31-60 · 3 report\(s\) · B0001 · images 31–60 .* · "Každé úmrtí/);
  const bad = await w.run(["readings", "2025-12"]);
  assert.equal(bad.code, 2);
  assert.match(bad.out + bad.err, /strom readings --list/);
  const j = (await w.ok(["readings", "--json"])).json;
  const reading = j.readings[0];
  assert.deepEqual(reading.found.map((b: { image: number }) => b.image), [33, 55]);
  assert.deepEqual(reading.unclear.map((b: { image: number }) => b.image), [46]);
  assert.ok(reading.nothing.some((b: { image: number; said: string[] }) => b.image === 37 && /60 %/.test(b.said[0]!)));
  assert.deepEqual(reading.gaps, [{ image: 44, text: "strany 87–94 chybí: po straně 86 (snímek 43) následuje 95, vazba bez stop vytržení" }]);
  w.cleanup();
});

test("strom readings: a report whose head the reader wrote in the research language is a reading; an unknown one names the newest", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Matrika oddaných 1800–1810"]); // B0001
  const dir = path.join(w.cwd, "notes", "readings");
  fs.mkdirSync(dir, { recursive: true });
  // written whole by a reader: no "# Reading" head, decomposed accents
  fs.writeFileSync(path.join(dir, "2026-01-21-M0004-1.md"), "# Čtení M0004 · snímek 5\n\nOtázka: úplný přepis\n\n## Image 5 · M0004\nresult: found\nentries: Иван · 7. Mayi · dům 19\n".normalize("NFD"));
  // a reader of strom transcripts: no reading, whatever its blocks
  fs.writeFileSync(path.join(dir, "2026-01-21-transcripts-read-1.md"), "# Transcripts\n\n## Image 6 · M0006\nresult: found\n");
  const r = await w.ok(["readings", "2026-01-21-M0004"]);
  assert.match(r.out, /^2026-01-21-M0004 · 1 report\(s\) · images 5 · found 5/);
  assert.match(r.out.normalize("NFC"), /Иван · 7\. Mayi · dům 19/);
  assert.doesNotMatch((await w.ok(["readings", "--list"])).out, /transcripts/);
  // the start of a name that is none: the newest readings named, each a command to run
  const none = await w.run(["readings", "2026-01-21-M0099"], { env: { AI_AGENT: "1" } });
  assert.equal(none.code, 2);
  assert.match(none.err, /the newest: strom readings 2026-01-21-M0004 — all: strom readings --list/);
  w.cleanup();
});
