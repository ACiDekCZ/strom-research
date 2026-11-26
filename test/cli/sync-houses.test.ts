// The houses the Strom app keeps (`0 @Hn@ _HOUSE`, its data version 27) read back by strom sync (spec 030 part 2,
// §4.1 answer 8): the name after the family is the person's (over the research's), a number the research lacks is
// added as theirs, two houses joined are kept on both records, a house of a municipality the research has no place of
// is only said — nothing ever taken away, the same file again writes nothing, the bridge's send goes the same way.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import type { House, Place } from "../../src/core/model.ts";
import { validateRecord } from "../../src/core/validate.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const AGENT = { env: { CLAUDECODE: "1" } };
const PERSON = { env: { STROM_FOR_APP: "1" } };

const ged = (lines: string[]) => [...lines, "0 TRLR", ""].join("\n");
const head0 = ["0 HEAD", "1 SOUR STROM", "2 VERS 3.40.0", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
const people = [
  "0 @I1@ INDI", "1 REFN P0001", "2 TYPE strom-research", "1 NAME Kapradin /Lhoták/", "1 SEX M",
  "1 BIRT", "2 DATE 1850", "2 PLAC Dolní Lhota", "2 ADDR čp. 12",
  "0 @I2@ INDI", "1 REFN P0002", "2 TYPE strom-research", "1 NAME Mlhoslav /Lhoták/", "1 SEX M",
  "1 RESI", "2 DATE 1880", "2 PLAC Dolní Lhota", "2 ADDR čp. 9",
  "0 @I3@ INDI", "1 REFN P0003", "2 TYPE strom-research", "1 NAME Остап /Лготак/", "1 SEX M",
  "1 BIRT", "2 DATE 1861", "2 PLAC Нижня Липа", "2 ADDR 5",
];
// the name of the mill decomposed (NFD), as a Mac may write it
const MILL = "Mlýn".normalize("NFD");
const houses = (name9 = "Na Kopci") => [
  "0 @H1@ _HOUSE", "1 PLAC Dolní Lhota", "1 _NUM 9", "2 DATE FROM 1770 TO 1838", "1 _NUM 12", "2 DATE FROM 1838", `1 NAME ${MILL}`, "1 _SAME @H2@",
  "0 @H2@ _HOUSE", "1 PLAC Dolní Lhota", "1 _NUM 9", `1 NAME ${name9}`, "1 _STROM_KEY dolni lhota|9",
  "0 @H3@ _HOUSE", "1 PLAC Horní Lhota", "1 _NUM 5", "1 NAME U Lhotáků",
  "0 @H4@ _HOUSE", "1 PLAC Нижня Липа", "1 _NUM 5", "1 NAME Хата",
];

const open = (w: World) => Tree.open(w.cwd, w.env);
const live = (w: World) => open(w).list<House>("house").filter((h) => !h.retracted && !h.town);
const byNumber = (w: World, n: string) => live(w).find((h) => h.house === n || h.house === `čp. ${n}`);

async function village(w: World): Promise<string> {
  await w.withTree("Lhotákovi");
  await w.ok(["place", "add", "Dolní Lhota", "--kind", "village"]); // L0001
  await w.ok(["place", "add", "Нижня Липа", "--kind", "village"]); // L0002
  await w.ok(["person", "add", "Kapradin /Lhoták/"]); // P0001
  await w.ok(["person", "add", "Mlhoslav /Lhoták/"]); // P0002
  await w.ok(["person", "add", "Остап /Лготак/"]); // P0003
  await w.ok(["event", "add", "P0001", "BIRT", "--date", "1850", "--place", "Dolní Lhota", "--house", "12"]);
  await w.ok(["event", "add", "P0002", "RESI", "--date", "1880", "--place", "Dolní Lhota", "--house", "9"]);
  await w.ok(["event", "add", "P0003", "BIRT", "--date", "1861", "--place", "Нижня Липа", "--house", "5"]);
  // the research named house no. 9 itself (an agent): the person's name wins over it
  await w.ok(["house", "add", "name", "Dolní Lhota 9", "--name", "U Kovárny"], AGENT);
  return JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
}

test("the app's _HOUSE: the person's name wins, numbers added, houses joined, an unknown municipality said, nothing taken away", opts, async () => {
  const w = new World();
  const id = await village(w);
  const file = path.join(w.dir, "app.ged");
  fs.writeFileSync(file, ged([...head0, `1 _STROM_TREE ${id}`, ...people, ...houses()]));

  // shown first: what each house brings
  const shown = (await w.ok(["sync", file, "--json"])).json;
  const kinds = (shown.changes as { kind: string; action: string }[]).filter((c) => c.kind.startsWith("house.")).map((c) => `${c.kind}:${c.action}`);
  assert.deepEqual(kinds.sort(), ["house.name:user", "house.name:user", "house.name:user", "house.number:add", "house.number:add", "house.same:add", "house.town:report"].sort(), JSON.stringify(shown.changes));
  const town = (shown.changes as { kind: string; code?: string; house?: { town: string; house: string } }[]).find((c) => c.kind === "house.town");
  assert.deepEqual(town && { code: town.code, town: town.house?.town, number: town.house?.house }, { code: "house.town", town: "Horní Lhota", number: "5" });
  // as a person reads it, in the research's language
  await w.ok(["lang", "cs"]);
  const said = (await w.ok(["sync", file])).out;
  for (const line of ["Dolní Lhota čp. 12: jméno „Mlýn“ → zapíše se k domu", "Dolní Lhota čp. 9: jméno „U Kovárny“ → „Na Kopci“", "Dolní Lhota čp. 12: číslo čp. 9 (1770–1838)", "Dolní Lhota čp. 12: tentýž dům jako čp. 9", "Horní Lhota čp. 5: taková obec ve výzkumu není → nic se nezapíše"])
    assert.ok(said.normalize("NFC").includes(line), `${line}\n${said}`);

  // the person's sync (as the app's bridge writes it)
  const r = (await w.ok(["sync", file, "--apply", "--json"], PERSON)).json;
  assert.ok(r.input, JSON.stringify(r));
  const mill = byNumber(w, "12")!;
  assert.equal(mill.name, "Mlýn".normalize("NFC"), "NFC");
  assert.equal(mill.nameBy, "user");
  assert.deepEqual(
    mill.numbers.map((n) => ({ number: n.number, from: n.from, to: n.to, origin: n.origin })),
    [
      { number: "9", from: "1770", to: "1838", origin: "user" },
      { number: "12", from: "1838", to: undefined, origin: "user" },
    ],
  );
  const nine = byNumber(w, "9")!;
  assert.equal(nine.name, "Na Kopci", "the person's name over the research's");
  assert.equal(nine.nameBy, "user");
  assert.deepEqual(mill.same, [nine.id]);
  assert.deepEqual(nine.same, [mill.id]);
  const lipa = byNumber(w, "5")!;
  assert.equal(lipa.name, "Хата");
  assert.equal(open(w).get<Place>(lipa.place)?.names[0]?.name, "Нижня Липа");
  // nothing of Horní Lhota made: no place, no house
  assert.equal(open(w).list<Place>("place").filter((p) => !p.retracted).length, 2);
  assert.equal(live(w).length, 3);
  for (const h of live(w)) assert.deepEqual(validateRecord(h), [], h.id);
  // the bridge's view: the name, the numbers, the join
  const show = (await w.ok(["house", "show", mill.id, "--json"])).json.house;
  assert.equal(show.name, "Mlýn");
  assert.deepEqual(show.same, [{ id: nine.id, key: "dolni lhota|9" }]);

  // the same file again: nothing
  assert.deepEqual((await w.ok(["sync", file, "--json"])).json.changes, []);
  // a file with no houses, or a name the app no longer gives: nothing taken away
  const bare = path.join(w.dir, "bare.ged");
  fs.writeFileSync(bare, ged([...head0, `1 _STROM_TREE ${id}`, ...people]));
  await w.ok(["sync", bare, "--apply"]);
  const noName = path.join(w.dir, "noname.ged");
  fs.writeFileSync(noName, ged([...head0, `1 _STROM_TREE ${id}`, ...people, ...houses().filter((l) => !l.startsWith("1 NAME") && !l.startsWith("1 _SAME"))]));
  assert.deepEqual((await w.ok(["sync", noName, "--json"])).json.changes.filter((c: { kind: string }) => c.kind.startsWith("house.") && c.kind !== "house.town"), []);
  assert.equal(byNumber(w, "12")!.name, "Mlýn");
  assert.deepEqual(byNumber(w, "12")!.same, [nine.id]);
  // an agent's sync never changes the person's name
  const other = path.join(w.dir, "other.ged");
  fs.writeFileSync(other, ged([...head0, `1 _STROM_TREE ${id}`, ...people, ...houses("Pod Lipou")]));
  await w.ok(["sync", other, "--apply"], AGENT);
  assert.deepEqual({ name: byNumber(w, "9")!.name, nameBy: byNumber(w, "9")!.nameBy }, { name: "Na Kopci", nameBy: "user" });

  // undone: the research's name back, the numbers and the join taken off, the records the sync made retracted
  await w.ok(["sync", "undo", r.input]);
  const after = open(w).list<House>("house").filter((h) => !h.town);
  const nineAfter = after.find((h) => h.id === nine.id)!;
  assert.deepEqual({ name: nineAfter.name, nameBy: nineAfter.nameBy, same: nineAfter.same }, { name: "U Kovárny", nameBy: "research", same: undefined });
  assert.ok(after.find((h) => h.id === mill.id)?.retracted, "made by the sync: retracted");
  assert.ok(after.find((h) => h.id === lipa.id)?.retracted);
  w.cleanup();
});

test("the app's _HOUSE through the bridge: written as the person's, the same send again writes nothing", opts, async () => {
  const w = new World();
  const id = await village(w);
  const info = (await w.ok(["live", "start", "--json"])).json;
  const post = async (body: string) => {
    const res = await fetch(`${info.url}/sync`, { method: "POST", body, headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } });
    return { status: res.status, json: (await res.json()) as Record<string, any> };
  };
  try {
    const sent = await post(ged([...head0, `1 _STROM_TREE ${id}`, ...people, ...houses("Lhotákovic")]));
    assert.equal(sent.status, 200, JSON.stringify(sent.json));
    // a house of a municipality the research has no place of: only said, with its code for the app
    const town = (sent.json.notWritten as { kind: string; code: string; params: Record<string, string> }[]).find((c) => c.kind === "house.town");
    assert.deepEqual(town && { code: town.code, params: town.params }, { code: "house.town", params: { town: "Horní Lhota", number: "5" } }, "no empty key of the house");
    assert.equal(byNumber(w, "9")!.name, "Lhotákovic");
    assert.equal(byNumber(w, "9")!.nameBy, "user");
    assert.equal(byNumber(w, "12")!.name, "Mlýn");
    const res = await fetch(`${info.url}/houses/${encodeURIComponent("dolni lhota|12")}`, { headers: { Origin: "https://beta.stromapp.info" } });
    const house = (await res.json()) as { name: string; nameBy: string; numbers: { number: string; origin: string }[] };
    assert.deepEqual({ name: house.name, nameBy: house.nameBy, numbers: house.numbers.map((n) => `${n.number}:${n.origin}`) }, { name: "Mlýn", nameBy: "user", numbers: ["9:user", "12:user"] });
    const again = await post(ged([...head0, `1 _STROM_TREE ${id}`, ...people, ...houses("Lhotákovic")]));
    assert.equal(again.status, 200, JSON.stringify(again.json));
    assert.equal(again.json.changes, 0, JSON.stringify(again.json));
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});
