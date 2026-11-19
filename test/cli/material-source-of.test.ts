// The sources a file of the family's material is the source of (spec 102 K1.14, the research's answer V1, feature
// material.sourceOf): GET /material and GET /material/<I…>/uses say each — made from the file (source.input), cut out of
// an image of its content (an excerpt), with an image of its content (media) — with its title, the people citing it
// (named in `people`) and whether the app's tree has it. A file a sort left without a proposal is said so until a later
// sort proposes something of it (V2b, material.left); a file of the same content as an older one says which (V2c,
// material.sameAs).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const APP = "https://beta.stromapp.info";
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const img = (name: string) => fs.readFileSync(path.join(fixtures, name));
const PAGE = img("png-pal.png");
const LETTER = img("base420.jpg");

function ask(url: string): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, headers: { Origin: APP } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end();
  });
}

type Of = { source: string; via: string; title: string; cited: string[]; citedCount: number; inTree: boolean };
type File = { id: string; name: string; sha: string; uses: { excerpts: number; sources: string[]; tasks: number; of: Of[] }; left?: { at: string; sort: string; why: string; said?: string }; sameAs?: string };

/** A sort kept beside the research as its strom keeps one done (only what GET /material reads of it). */
function sortDone(root: string, id: string, since: string, files: string[], unproposed: { id: string; why: string; said?: string }[], proposals: { id: string }[] = []): void {
  const dir = path.join(root, ".strom", "sorts");
  fs.mkdirSync(dir, { recursive: true });
  const s = { id, state: "done", files, text: "", lang: "cs", at: since, since, proposals: proposals.map((p) => ({ ...p, why: "x", sure: "high", title: "Dopis" })), ...(unproposed.length ? { unproposed } : {}) };
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(s));
}

test("spec 102 K1.14, V1, V2b, V2c: the sources a file is the source of, a file a sort left, a file of the same content", opts, async () => {
  const w = new World();
  const root = await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1890"]);
  await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F", "--born", "1893"]);
  // files of the family's material: a page, a letter (NFD name) — and the same page again under another name, as two
  // sends of the Strom app can give it (intake skips a file it has: the record is written here as such a send leaves it)
  const given = path.join(w.dir, "given");
  fs.mkdirSync(given);
  fs.writeFileSync(path.join(given, "strana.png"), PAGE);
  fs.writeFileSync(path.join(given, "dopis-Lhotáková.jpg".normalize("NFD")), LETTER);
  await w.ok(["intake", path.join(given, "strana.png")]);
  await w.ok(["intake", path.join(given, "dopis-Lhotáková.jpg".normalize("NFD"))]);
  // a source made from the letter (source.input), cited by Eva's birth
  const fromLetter = (await w.ok(["source", "add", "Matrika narozených Lhota 1890–1900", "--kind", "baptism", "--input", "I0002", "--json"])).json.source.id as string;
  await w.ok(["event", "add", "P2", "BIRT", "--date", "1893", "--place", "Lhota", "--cite", fromLetter]);
  // a book whose image is the page's content: one source with an image of it, one cut out of it, cited by Václav
  const scans = path.join(w.dir, "scany");
  fs.mkdirSync(scans);
  fs.writeFileSync(path.join(scans, "001.png"), PAGE);
  await w.ok(["recordset", "add", "Lhota Z 1950-1970", "--kinds", "burial", "--places", "Lhota", "--years", "1950-1970"]);
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  const withImage = (await w.ok(["source", "add", "Kniha zemřelých Lhota", "--kind", "burial", "--media", "B1:1", "--json"])).json.source.id as string;
  const cut = (await w.ok(["source", "add", "Pohřeb Václava Lhotáka", "--kind", "burial", "--clip", "B1:1@0.1,0.1,0.5,0.2", "--json"])).json.source.id as string;
  await w.ok(["event", "add", "P1", "DEAT", "--date", "1960", "--place", "Lhota", "--cite", cut]);

  // a sort that left the letter (its reader said nothing of it), and one whose reader ended without a word of the page
  sortDone(root, "sort-20261101100000-aaaa", "2026-11-01T10:05:00.000Z", ["I0001", "I0002"], [
    { id: "I0001", why: "left-out" },
    { id: "I0002", why: "nothing-said", said: "Nečitelné." },
  ]);
  // the page again (written last: nothing of strom writes after it, only the bridge reads)
  const inputs = path.join(root, "data", "inputs");
  const first = JSON.parse(fs.readFileSync(path.join(inputs, "I0001.json"), "utf8"));
  fs.writeFileSync(path.join(inputs, "I0003.json"), JSON.stringify({ ...first, id: "I0003", name: "Lhota – strana znovu.png", created: "2099-01-01T00:00:00.000Z" }));
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  try {
    const status = JSON.parse((await ask(`${info.url}/status`)).text);
    for (const f of ["material.sourceOf", "material.left", "material.sameAs", "material.sortRun", "material.delete"]) assert.ok(status.features.includes(f), f);
    const got = await ask(`${info.url}/material`);
    assert.equal(got.status, 200, got.text);
    const m = JSON.parse(got.text) as { files: File[]; people: Record<string, string> };
    const byId = (id: string) => m.files.find((f) => f.id === id) ?? assert.fail(`no ${id}`);
    const page = byId("I0001");
    const letter = byId("I0002");
    const again = byId("I0003");

    // V1: made from the letter
    assert.deepEqual(letter.uses.of, [{ source: fromLetter, via: "input", title: "Matrika narozených Lhota 1890–1900", cited: ["P0002"], citedCount: 1, inTree: true }]);
    assert.deepEqual(letter.uses.sources, [fromLetter], "uses.sources means what it meant");
    // V1: the page's content is an image of the book: one source with it, one cut out of it (the most direct way)
    assert.deepEqual(
      page.uses.of.map((o) => [o.source, o.via, o.citedCount]),
      [
        [withImage, "media", 0],
        [cut, "excerpt", 1],
      ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
    assert.deepEqual(page.uses.of.find((o) => o.source === cut)!.cited, ["P0001"]);
    // the people citing them are named for the app
    assert.match(m.people.P0001 ?? "", /Lhoták/u);
    assert.match(m.people.P0002 ?? "", /Lhotáková/u);
    // V2c: the same page again is the same as the first; the first is the same as none
    assert.equal(again.sameAs, "I0001");
    assert.equal(page.sameAs, undefined);
    assert.equal(letter.name.normalize("NFC"), "dopis-Lhotáková.jpg");
    // V2b: the letter left (its reader said nothing of it); the page not (its reader ended without a word: sent again)
    assert.deepEqual(letter.left, { at: "2026-11-01T10:05:00.000Z", sort: "sort-20261101100000-aaaa", why: "nothing-said", said: "Nečitelné." });
    assert.equal(page.left, undefined);
    // GET /material/<I…>/uses: the same sources
    const uses = JSON.parse((await ask(`${info.url}/material/I0001/uses`)).text) as { of: Of[] };
    assert.deepEqual(uses.of, page.uses.of);

    // a later sort proposed something of the letter: no longer left
    sortDone(root, "sort-20261102100000-bbbb", "2026-11-02T10:05:00.000Z", ["I0002"], [], [{ id: "I0002" }]);
    const later = JSON.parse((await ask(`${info.url}/material`)).text) as { files: File[] };
    assert.equal(later.files.find((f) => f.id === "I0002")!.left, undefined);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});
