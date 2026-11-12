// The older sources' locators split into folio and image at once (spec 075 P4, strom source split, core/sourcesplit.ts):
// a preview anybody may see (nothing written), the split and its undo the person's alone, one step each; what nothing
// is recognised in stays as it is; the PAGE never says two numbers after it; a source with no part to take the same
// byte for byte in the GEDCOM.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { encodeJpeg } from "../../src/image/jpeg-encode.ts";
import { blank } from "../../src/image/image.ts";
import type { Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const agent = { env: { CLAUDECODE: "1" } };
const place = (w: World, id: string) => {
  const s = Tree.open(w.cwd, w.env).get<Source>(id)!;
  return [s.locator, s.folio, s.image];
};
const record = (text: string, id: string) => text.match(new RegExp(`^0 @${id}@ SOUR\\r?\\n(?:[1-9].*\\r?\\n)*`, "m"))![0];

test("source split: a preview by anybody (nothing written), the split the person's as one step — folio, image and the locator's rest in cs, de, en, decomposed; nothing recognised, a field given, the scans' image stay; the PAGE one number; undone whole", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["lang", "cs"]);
    await w.ok(["recordset", "add", "Matrika Lhota N 1880–1900", "--kinds", "baptism"]); // B1
    await w.ok(["source", "add", "Křest Jana Lhotáka 1881", "--kind", "baptism", "--locator", "fol. 12, č. 5, snímek 3"]); // S1
    await w.ok(["source", "add", "Taufe Anna Lhotak 1882", "--kind", "baptism", "--locator", "S. 15, Eintrag 3, Bild 7"]); // S2
    await w.ok(["source", "add", "Baptism of Karel Lhoták 1883", "--kind", "baptism", "--locator", "p. 4, entry 2, image 9"]); // S3
    await w.ok(["source", "add", "Křest Marie Lhotákové 1884", "--kind", "baptism", "--locator", "č. 8"]); // S4: nothing to take
    await w.ok(["source", "add", "Křest Pavla Lhotáka 1885", "--kind", "baptism", "--locator", "fol. 3, snímek 2", "--image", "4"]); // S5: an image given
    await w.ok(["source", "add", "Křest Evy Lhotákové 1886", "--kind", "baptism", "--locator", "Snímek č. 6".normalize("NFD")]); // S6
    const dir = fs.mkdtempSync(path.join(w.dir, "snímky-"));
    fs.writeFileSync(path.join(dir, "obr-060.jpg"), encodeJpeg(blank(60, 40, 1, 120), 85));
    await w.ok(["media", "add", dir, "--recordset", "B0001"]); // M1, image 60
    await w.ok(["source", "add", "Křest Josefa Lhotáka 1887", "--kind", "baptism", "--recordset", "B0001", "--clip", "M0001@0.05,0.40,0.45,0.18", "--locator", "fol. 20, snímek 60"]); // S7: the scans' image
    // nothing recognised in them (another script, one twice): S8–S11
    for (const [i, locator] of ["č. 8", "kolonka 3", "запись 4", "Eintrag 9"].entries()) await w.ok(["source", "add", `Křest Lhotáka ${1890 + i}`, "--kind", "baptism", "--locator", locator]);
    const before = exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", research: true }).text;
    const ops = Tree.open(w.cwd, w.env).readOps().length;

    // the preview, an agent's too: nothing written
    const preview = await w.ok(["source", "split"], agent);
    assert.match(preview.out, /^would split the locator of 6 sources into folio and image \(nothing written\):$/m);
    assert.match(preview.out, /^ {2}S0001 {2}"fol\. 12, č\. 5, snímek 3" → --folio "fol\. 12" --image 3 --locator "č\. 5"$/m);
    assert.match(preview.out, /^ {2}S0006 {2}"Snímek č\. 6" → --image 6 --locator \(none\)$/m);
    assert.match(preview.out, /^unrecognised, stay as they are: 5 sources — "č\. 8", "kolonka 3", "запись 4", …$/m);
    assert.match(preview.out, /^to write it: strom source split --apply — the person's, in their terminal/m);
    const plan = (await w.ok(["source", "split", "--json"], agent)).json;
    assert.deepEqual(
      plan.split.map((o: { source: string; after: unknown }) => [o.source, o.after]),
      [
        ["S0001", { locator: "č. 5", folio: "fol. 12", image: "3" }],
        ["S0002", { locator: "Eintrag 3", folio: "S. 15", image: "7" }],
        ["S0003", { locator: "entry 2", folio: "p. 4", image: "9" }],
        ["S0005", { locator: "snímek 2", folio: "fol. 3", image: "4" }],
        ["S0006", { image: "6" }],
        ["S0007", { locator: "snímek 60", folio: "fol. 20" }],
      ],
    );
    assert.equal(plan.unrecognized, 5);
    assert.deepEqual(plan.unrecognizedExamples, ["č. 8", "kolonka 3", "запись 4"], "three, each once, the location's text alone");
    assert.equal(Tree.open(w.cwd, w.env).readOps().length, ops, "the preview writes nothing");

    // the split and its undo: the person's alone
    assert.equal((await w.run(["source", "split", "--apply"], agent)).code, 4);
    assert.equal((await w.run(["source", "split", "--undo", "20261111101500-a1b2c3"], agent)).code, 4);
    assert.deepEqual(place(w, "S0001"), ["fol. 12, č. 5, snímek 3", undefined, undefined], "refused: nothing written");

    const done = (await w.ok(["source", "split", "--apply", "--json"])).json;
    assert.equal(done.split.length, 6);
    assert.match(done.undo, /^\d{14}-[0-9a-f]{6}$/);
    assert.deepEqual(place(w, "S0001"), ["č. 5", "fol. 12", "3"]);
    assert.deepEqual(place(w, "S0004"), ["č. 8", undefined, undefined], "nothing recognised: as it was");
    assert.deepEqual(place(w, "S0005"), ["snímek 2", "fol. 3", "4"], "an image given stays, the locator's other number with it");
    assert.deepEqual(place(w, "S0006"), [undefined, undefined, "6"]);
    assert.equal(Tree.open(w.cwd, w.env).readOps().length, ops + 1, "one step");
    assert.match((await w.ok(["source", "split"])).out, /^nothing to split/m);
    // a split one's rest ("č. 5") is no unrecognised locator: its folio and image are fields
    const rest = (await w.ok(["source", "split", "--json"])).json;
    assert.deepEqual([rest.unrecognized, rest.unrecognizedExamples, rest.nothing], [5, ["č. 8", "kolonka 3", "запись 4"], 5]);

    // the PAGE: one number each, as before where the locator said them
    const after = exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", research: true }).text;
    assert.match(record(after, "S0001"), /^1 PAGE fol\. 12, č\. 5, snímek 3\r?\n/m);
    assert.match(record(after, "S0002"), /^1 PAGE S\. 15, Eintrag 3, snímek 7\r?\n/m);
    assert.match(record(after, "S0005"), /^1 PAGE fol\. 3, snímek 4\r?\n/m, "never two image numbers");
    assert.match(record(after, "S0007"), /^1 PAGE fol\. 20, snímek 60\r?\n/m);
    assert.equal(record(after, "S0004"), record(before, "S0004"), "a source with nothing to take: byte for byte");

    // undone whole: every source as it was, the GEDCOM as before
    const listed = (await w.ok(["source", "split", "--json"])).json.undos;
    assert.deepEqual(listed.map((u: { id: string; sources: number }) => [u.id, u.sources]), [[done.undo, 6]]);
    await w.ok(["source", "split", "--undo", done.undo]);
    assert.deepEqual(place(w, "S0001"), ["fol. 12, č. 5, snímek 3", undefined, undefined]);
    assert.deepEqual(place(w, "S0005"), ["fol. 3, snímek 2", undefined, "4"]);
    assert.deepEqual(place(w, "S0006"), ["Snímek č. 6", undefined, undefined], "the person's text as it was (given decomposed, kept in NFC)");
    const back = exportGedcom(Tree.open(w.cwd, w.env), { for: "strom", research: true }).text;
    for (const id of ["S0001", "S0002", "S0003", "S0004", "S0006", "S0007"]) assert.equal(record(back, id), record(before, id), id);
    assert.equal((await w.run(["source", "split", "--undo", done.undo])).code, 2, "undone once");

    // a source changed after a split: its undo refused whole, nothing put back
    const again = (await w.ok(["source", "split", "--apply", "--json"])).json;
    await w.ok(["source", "edit", "S0002", "--locator", "Eintrag 4", "--reason", "re-read"]);
    const refused = await w.run(["source", "split", "--undo", again.undo]);
    assert.equal(refused.code, 2);
    assert.match(refused.out + refused.err, /changed since: S0002/);
    assert.deepEqual(place(w, "S0001"), ["č. 5", "fol. 12", "3"]);
  } finally {
    w.cleanup();
  }
});

test("source split: the preview on a research sealed on another computer reads as any read (rc 0, nothing written); writing it (--apply) asks for it to be taken over first", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["source", "add", "Křest Jana Lhotáka 1881", "--kind", "baptism", "--locator", "fol. 12, č. 5, snímek 3"]); // S1
    const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
    fs.rmSync(path.join(w.env.STROM_CONFIG_DIR!, "keys", `${id}.key`));
    const files = () => fs.readdirSync(w.cwd, { recursive: true, encoding: "utf8" }).filter((f) => !f.split(path.sep).includes(".git") && !f.split(path.sep).includes(".strom")).sort().map((f) => [f, fs.statSync(path.join(w.cwd, f)).isFile() ? fs.readFileSync(path.join(w.cwd, f), "utf8") : ""]);
    const before = files();
    const head = fs.readFileSync(path.join(w.cwd, ".git", "HEAD"), "utf8");

    for (const env of [agent.env, {}]) {
      const preview = await w.run(["source", "split", "--json"], { env });
      assert.equal(preview.code, 0, preview.out + preview.err);
      assert.equal(preview.json.count, 1);
      assert.deepEqual(preview.json.split[0].after, { locator: "č. 5", folio: "fol. 12", image: "3" });
    }
    assert.match((await w.ok(["source", "split"])).out, /would split the locator of 1 source/);
    assert.deepEqual(files(), before, "the preview writes nothing");
    assert.equal(fs.readFileSync(path.join(w.cwd, ".git", "HEAD"), "utf8"), head);

    // writing it waits for the research taken over here
    const apply = await w.run(["source", "split", "--apply", "--json"]);
    assert.equal(apply.code, 4, apply.out + apply.err);
    assert.equal(apply.json.code, "seal.foreign");
    assert.equal(apply.json.status, "needs-consent");
    assert.deepEqual(place(w, "S0001"), ["fol. 12, č. 5, snímek 3", undefined, undefined]);
    assert.deepEqual(files(), before);
  } finally {
    w.cleanup();
  }
});
