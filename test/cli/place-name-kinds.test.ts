// The names of a place record, what each is (the app's ZADANI_VYZKUM_ztotozneni-mist.md, query 1102): after today's
// name a form the facts write that was identified as the place (kind "form") or another name of it — another language,
// an old name (kind "alt"); a name given both ways kept once, as the other name (it says more); a name written before
// kinds were kept has none and stays as it was. The bridge's GET /places (feature places.nameKinds), the Strom file's
// 2 TYPE under each 1 NAME of a place record, place list and show. Any script, any accent, decomposed input.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import type { Place } from "../../src/core/model.ts";
import { Tree } from "../../src/core/tree.ts";
import { addPlaceName, otherNames } from "../../src/core/placeid.ts";
import { placeView } from "../../src/core/placesview.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";

const opts = { skip: !hasGit, timeout: 120_000 };
const agent = { env: { CLAUDECODE: "1" } };

function place(w: World, id: string): Place {
  return JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "places", `${id}.json`), "utf8")) as Place;
}

const bare = (names: Place["names"]): Place => ({ id: "L0001", type: "place", names, jurisdictions: [], notes: [], created: "", updated: "" });

test("a name added: a form once, another name in place of the same form, an old name of no kind given its kind, today's never changed", () => {
  // the form first, then the same name in German: one name, the German one
  const a = bare([{ name: "Velká Lhota" }]);
  addPlaceName(a, "Lhötz", "form");
  addPlaceName(a, "Lhötz".normalize("NFD"), "alt", { lang: "de", from: 1850, to: 1918 });
  assert.deepEqual(a.names, [{ name: "Velká Lhota" }, { name: "Lhötz", lang: "de", from: 1850, to: 1918, kind: "alt" }]);
  // the other way round: the form adds nothing
  const b = bare([{ name: "Velká Lhota" }]);
  addPlaceName(b, "Lhötz", "alt", { lang: "de" });
  addPlaceName(b, "Lhötz".normalize("NFD"), "form");
  assert.deepEqual(b.names, [{ name: "Velká Lhota" }, { name: "Lhötz", lang: "de", kind: "alt" }]);
  // a name of no kind (before kinds were kept): a form changes nothing, another name gives it its kind and years
  const c = bare([{ name: "Лгота" }, { name: "Ober Lhota" }]);
  addPlaceName(c, "Ober Lhota", "form");
  assert.deepEqual(c.names[1], { name: "Ober Lhota" });
  addPlaceName(c, "Ober Lhota", "alt", { to: 1945 });
  assert.deepEqual(c.names[1], { name: "Ober Lhota", to: 1945, kind: "alt" });
  // today's name: neither a form nor another name of the same spelling touches it
  addPlaceName(c, "лгота", "form");
  addPlaceName(c, "Лгота", "alt");
  assert.deepEqual(c.names, [{ name: "Лгота" }, { name: "Ober Lhota", to: 1945, kind: "alt" }]);
  // a form of other words than the other name (no accent) stays the facts' spelling beside it
  const d = bare([{ name: "Velká Lhota" }]);
  addPlaceName(d, "Lhotz", "form");
  addPlaceName(d, "Lhötz", "alt", { lang: "de" });
  assert.deepEqual(d.names, [{ name: "Velká Lhota" }, { name: "Lhotz", kind: "form" }, { name: "Lhötz", lang: "de", kind: "alt" }]);
  // two languages of one spelling stay two names
  addPlaceName(c, "Ober Lhota", "alt", { lang: "de" });
  assert.equal(c.names.length, 3);
});

test("each name once in what is shown: a plain name that is another name too is that name alone (a record written before)", () => {
  const old = bare([{ name: "Velká Lhota" }, { name: "Lhötz" }, { name: "Lhötz", lang: "de" }, { name: "Lhota Magna", lang: "la" }, { name: "Lhotecko" }]);
  assert.deepEqual(otherNames(old), [{ name: "Lhötz", lang: "de" }, { name: "Lhota Magna", lang: "la" }, { name: "Lhotecko" }]);
  assert.deepEqual(otherNames(bare([{ name: "Velká Lhota" }, { name: "Lhötz", kind: "form" }, { name: "Lhötz", kind: "alt", from: 1850 }])), [{ name: "Lhötz", kind: "alt", from: 1850 }]);
});

test("identified: each name says what it is — on the record, through the bridge, in the Strom file, in place list and show", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1850", "--born-place", "H. Lhota"]); // P0001
    await w.ok(["event", "add", "P0001", "RESI", "--date", "1870", "--place", "Lhota Horní"]);
    await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F", "--born", "1852", "--born-place", "Lhötz"]); // P0002
    await w.ok(["event", "add", "P0002", "RESI", "--date", "1880", "--place", "Velká Lhota"]);
    await w.ok(["event", "add", "P0002", "DEAT", "--date", "1920", "--place", "Lhotkowitz"]);
    await w.ok(
      ["place", "identify", "H. Lhota", "--lat", "49.61", "--lon", "15.23", "--name", "Horní Lhota", "--alt", "Ober Lhota@de:-1945", "--form", "Lhota Horní", "--why", "fara Lhotov v matrikách"],
      agent,
    ); // L0001
    assert.deepEqual(place(w, "L0001").names, [
      { name: "Horní Lhota" },
      { name: "H. Lhota", kind: "form" },
      { name: "Ober Lhota", lang: "de", to: 1945, kind: "alt" },
      { name: "Lhota Horní", kind: "form" },
    ]);
    // Lhötz given both ways (decomposed too): once, the German name
    await w.ok(["place", "identify", "Velká Lhota", "--lat", "49.3", "--lon", "15.9", "--form", "Lhötz", "--alt", "Lhötz@de".normalize("NFD"), "--why", "fara Lhotov v matrikách"], agent); // L0002
    assert.deepEqual(place(w, "L0002").names, [{ name: "Velká Lhota" }, { name: "Lhötz", lang: "de", kind: "alt" }]);
    // the years given later by an edit: still one name, the years filled in
    await w.ok(["place", "edit", "L0002", "--alt", "Lhötz@de:1850-1918"]);
    assert.deepEqual(place(w, "L0002").names, [{ name: "Velká Lhota" }, { name: "Lhötz", lang: "de", from: 1850, to: 1918, kind: "alt" }]);
    // a form first, the same words as a German name later: one name, the German one (the history keeps the step)
    await w.ok(["place", "identify", "Lhotkowitz", "--lat", "49.5", "--lon", "15.6", "--name", "Lhotkovice", "--why", "fara Lhotov v matrikách"], agent); // L0003
    assert.deepEqual(place(w, "L0003").names, [{ name: "Lhotkovice" }, { name: "Lhotkowitz", kind: "form" }]);
    await w.ok(["place", "edit", "L0003", "--alt", "Lhotkowitz@de"]);
    assert.deepEqual(place(w, "L0003").names, [{ name: "Lhotkovice" }, { name: "Lhotkowitz", lang: "de", kind: "alt" }]);
    await w.ok(["check"]);
    await w.ok(["place", "add", "Lhotov", "--alt", "Lhotow@de:1850-1918"]); // L0004
    assert.deepEqual(place(w, "L0004").names, [{ name: "Lhotov" }, { name: "Lhotow", lang: "de", from: 1850, to: 1918, kind: "alt" }]);

    // place list: Lhötz once
    const list = (await w.ok(["place", "list"])).out;
    assert.equal(list.match(/Lhötz/gu)?.length, 1, list);
    // the facts' form made today's name and given as a German name too (decomposed): place list says it once, place show
    // keeps the language apart
    await w.ok(["event", "add", "P0002", "BURI", "--date", "1920", "--place", "Lhotín"]);
    await w.ok(["place", "identify", "Lhotín", "--lat", "49.7", "--lon", "15.1", "--form", "Lhotín", "--alt", "Lhotín@de".normalize("NFD"), "--why", "fara Lhotov v matrikách"], agent); // L0005
    assert.deepEqual(place(w, "L0005").names, [{ name: "Lhotín" }, { name: "Lhotín", lang: "de", kind: "alt" }]);
    assert.match((await w.ok(["place", "list"])).out, /^L0005 +Lhotín *$/mu);
    assert.match((await w.ok(["place", "show", "L0005"])).out, /^names {2}Lhotín · Lhotín@de$/mu);
    const show = (await w.ok(["place", "show", "L0001"])).out;
    assert.match(show, /^names {2}Horní Lhota · Ober Lhota@de \(–1945\)$/mu);
    assert.match(show, /^forms {2}H\. Lhota · Lhota Horní$/mu);

    // the bridge
    const tree = Tree.open(w.cwd, w.env);
    assert.ok((BRIDGE_FEATURES as readonly string[]).includes("places.nameKinds"));
    assert.deepEqual(placeView(tree, "L0001")!.names, [
      { name: "H. Lhota", kind: "form" },
      { name: "Ober Lhota", lang: "de", to: 1945, kind: "alt" },
      { name: "Lhota Horní", kind: "form" },
    ]);
    assert.deepEqual(placeView(tree, "L0002")!.names, [{ name: "Lhötz", lang: "de", from: 1850, to: 1918, kind: "alt" }]);

    // the Strom file: 2 TYPE under each name after today's, valid
    const t = exportGedcom(tree, { for: "strom", placeRecords: true }).text;
    assert.deepEqual(validateGedcom(t).filter((f) => f.level === "error"), []);
    assert.match(t, /0 @L0001@ _STROM_PLACE\n1 NAME Horní Lhota\n1 NAME H\. Lhota\n2 TYPE form\n1 NAME Ober Lhota\n2 LANG de\n2 DATE TO 1945\n2 TYPE alt\n1 NAME Lhota Horní\n2 TYPE form\n/u);
    assert.match(t, /0 @L0002@ _STROM_PLACE\n1 NAME Velká Lhota\n1 NAME Lhötz\n2 LANG de\n2 DATE FROM 1850 TO 1918\n2 TYPE alt\n1 MAP\n/u);
  } finally {
    w.cleanup();
  }
});
