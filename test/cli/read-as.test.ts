// Options agents guess (a long run of 21 November 2026: eight of them, a turn each): where the name means exactly an
// option or the command's argument — the same thing, the same unit — it is taken and said in a line on stderr,
// "(--parish read as --place)"; where it does not (--timeout is no --minutes, a --name no surname of itself) the
// unknown option still says what was meant. Made-up names only (Lhoták, Lhota); any script, any accent.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };
// an agent at work: the errors in English (a person reads them in the research language)
const AGENT = { env: { AI_AGENT: "1" } };

test("guessed options that mean exactly another: taken, each said in a line (never in --json's answer); the others still end with meant:", opts, async () => {
  const w = new World();
  try {
    await w.withTree();
    await w.ok(["recordset", "add", "Matrika Lhota 1840–1860", "--places", "Lhota"]); // B0001
    await w.ok(["recordset", "add", "Matrika Dolní Ves 1840–1860", "--places", "Dolní Ves"]); // B0002
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P0001
    await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]); // P0002
    await w.ok(["person", "add", "Иван /Петров/", "--sex", "M"]); // P0003

    // recordset list --parish: its books' places (the parish is the place of the book)
    const parish = await w.ok(["recordset", "list", "--parish", "lhota"]);
    assert.equal(parish.err.trim(), "(--parish read as --place)");
    assert.match(parish.out, /B0001/);
    assert.doesNotMatch(parish.out, /B0002/);
    const j = await w.ok(["recordset", "list", "--parish=Lhota", "--json"]);
    assert.equal(j.err.trim(), "(--parish read as --place)");
    assert.deepEqual(j.json.recordsets.map((b: { id: string }) => b.id), ["B0001"], "--json's answer untouched");

    // media list --image 5: that one image, as --images 5-5
    const image = await w.ok(["media", "list", "B0001", "--image", "5"]);
    assert.equal(image.err.trim(), "(--image 5 read as --images 5-5)");
    const range = await w.ok(["media", "list", "B0001", "--image=3-4"]);
    assert.equal(range.err.trim(), "(--image 3-4 read as --images 3-4)");

    // readings --recordset B0001: its argument
    const dir = path.join(w.cwd, "notes", "readings");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "2026-02-01-B0001-1-2-1.md"), "# Reading B0001-1-2\nQuestion: Lhoták\n\n## Image 1\nresult: found\nentries: Jan Lhoták, Lhota N° 3\npages: 1–2\n");
    const readings = await w.ok(["readings", "--recordset", "B0001"]);
    assert.equal(readings.err.trim(), "(--recordset read as <which>)");
    assert.match(readings.out, /Lhota N° 3/);

    // search add --query "…": its question
    const search = await w.ok(["search", "add", "--query", "Křty Lhoták 1840–1860", "--recordset", "B0001", "--years", "1840-1860", "--method", "index", "--result", "inconclusive", "--json"]);
    assert.equal(search.err.trim(), "(--query read as <question>)");
    assert.equal((await w.ok(["searched", "B0001", "--json"])).json.searches[0].question, "Křty Lhoták 1840–1860");

    // person list --surname: the same as strom query's, with its forms (Lhotáková); NFD typed too
    const people = await w.ok(["person", "list", "--surname", "Lhoták".normalize("NFD")]);
    assert.equal(people.err, "");
    assert.match(people.out, /P0001/);
    assert.match(people.out, /P0002/);
    assert.doesNotMatch(people.out, /P0003/);
    assert.match((await w.ok(["person", "list", "--surname", "Петров"])).out, /P0003/);

    // not the same meaning: still an error saying what was meant
    const name = await w.run(["query", "--name", "Lhoták"], AGENT);
    assert.equal(name.code, 2);
    assert.match(name.err, /unknown option --name for strom query/);
    assert.match(name.err, /--surname <surname>/);
    const timeout = await w.run(["read", "B0001", "--images", "1-2", "--timeout", "600"], AGENT);
    assert.equal(timeout.code, 2);
    assert.match(timeout.err, /--minutes <n>/);
    // a name none of them takes: as before
    assert.match((await w.run(["recordset", "list", "--diocese", "x"], AGENT)).err, /unknown option --diocese/);
  } finally {
    w.cleanup();
  }
});
