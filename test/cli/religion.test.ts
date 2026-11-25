// A religion the record writes (RELI): written with its record, one faith one fact (another record cites it, a changed
// faith is a fact of its own), out in the GEDCOM as RELI with its citation and back from the Strom app with no change;
// the brief says a religion the person's own record names in its transcript and the research has no fact of — never
// one of a parent's or a child's record, the parish, the book or a word not read for sure. Made-up data only.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana Lhotáka", "--new-person", "Jan /Lhoták/", "--sex", "M", "--born", "24 JUN 1885"]); // P1, E1
  await w.ok(["repo", "add", "Archiv Lhota", "--country", "cz", "--automation", "manual"]);
  // the book of a Catholic parish: never the person's religion by itself
  await w.ok(["recordset", "add", "Římskokatolická farnost Lhota, N 1880-1950", "--repo", "R1", "--kinds", "baptism,death", "--places", "Lhota", "--years", "1880-1950", "--access", "online-free"]);
  await w.ok(["source", "add", "Křest Jana Lhotáka 1885", "--kind", "baptism", "--recordset", "B1", "--locator", "fol. 12", "--information", "primary",
    "--transcript", "Jan, syn Josefa Lhotáka, rolníka v Lhotě č. 7. Náboženství: katol. Pohlaví: chlapec"]); // S1
  await w.ok(["cite", "E1", "S1", "--locator", "fol. 12"]);
  return w;
}

const religionLine = (text: string, id: string) => text.split("\n").find((l) => l.includes("religion:") && l.includes(`RELI --value`) && l.includes(` ${id} RELI`));

test("the brief says a religion the person's own record names; never a parent's, the parish's or a word not read", opts, async () => {
  const w = await world();
  // the father: named in his son's baptism, cited secondary — the son's religion is not his
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]); // P2
  await w.ok(["family", "add", "--partner", "P2", "--child", "P1", "--cite", "S1", "--information", "secondary"]);
  await w.ok(["event", "add", "P2", "OCCU", "--value", "rolník", "--cite", "S1", "--information", "secondary"]);
  await w.ok(["event", "add", "P2", "BIRT", "--date", "ABT 1850", "--cite", "S1", "--information", "secondary"]);
  // a brother: his own death record names the parish alone, its religion column not read for sure
  await w.ok(["source", "add", "Úmrtí Václava Lhotáka 1890", "--kind", "death", "--recordset", "B1", "--locator", "fol. 3", "--information", "primary",
    "--transcript", "Matrika římskokatolické farnosti Lhota. Václav Lhoták, syn Josefa, pohřben katolickým obřadem. Náboženství: [nečitelné]"]); // S2
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--died", "1890", "--cite", "S2"]); // P3
  await w.ok(["family", "child", "F1", "P3"]);
  await w.ok(["task", "add", "Rodina Josefa", "--level", "enrich", "--where", "Lhota", "--why", "a", "--done-when", "b", "--about", "P1", "--about", "P2", "--about", "P3"]);
  const brief = (await w.ok(["brief", "T1", "--budget", "1000000"])).out;
  const line = religionLine(brief, "P0001");
  assert.ok(line, brief);
  assert.match(line!, /the transcript of S0001 says "katol\." — no RELI fact; if the record says it of P0001 clearly: strom event add P0001 RELI --value "katol\." --date <the record's> --cite S0001/u);
  assert.equal(religionLine(brief, "P0002"), undefined, "the son's record is not the father's religion");
  assert.equal(religionLine(brief, "P0003"), undefined, "the parish, the rite and an unread column are no religion");
  // the guide the agent reads with the task: the rule beside the occupation
  assert.match(brief, /a religion only as\s+written of them, a column.s mark too \(`RELI --value "katolické"`\)/u);
  // written down: the line is gone, also once the fact is taken back (decided)
  const e = (await w.ok(["event", "add", "P1", "RELI", "--value", "katol.", "--date", "25 JUN 1885", "--cite", "S1", "--locator", "fol. 12", "--json"])).json.event;
  assert.equal(e.kind, "RELI");
  assert.equal(e.status, "probable");
  assert.equal(religionLine((await w.ok(["brief", "T1", "--budget", "1000000"])).out, "P0001"), undefined);
  await w.ok(["event", "retract", e.id, "--reason", "jiný zápis"]);
  assert.equal(religionLine((await w.ok(["brief", "T1", "--budget", "1000000"])).out, "P0001"), undefined);
  w.cleanup();
});

test("no religion line from a child's record for a parent cited with no --information, a surname, an unsure reading or a parish a word off", opts, async () => {
  const w = await world();
  // the child's own record says the father's religion: neither the father's (not his record) nor the child's (his father's)
  await w.ok(["source", "add", "Křest Hany Lhotákové 1888", "--kind", "baptism", "--recordset", "B1", "--locator", "fol. 20", "--date", "3 MAR 1888",
    "--transcript", "Hana, dcera Josefa Lhotáka, rolníka v Lhotě; náboženství otce: katol."]); // S2
  await w.ok(["person", "add", "Hana /Lhotáková/", "--sex", "F", "--born", "2 MAR 1888", "--cite", "S2"]); // P2, E2
  await w.ok(["person", "add", "Josef /Lhoták/", "--sex", "M"]); // P3
  await w.ok(["family", "add", "--partner", "P3", "--child", "P2", "--cite", "S2"]);
  await w.ok(["event", "add", "P3", "BIRT", "--date", "ABT 1860", "--cite", "S2"]);
  await w.ok(["event", "add", "P3", "OCCU", "--value", "rolník", "--date", "3 MAR 1888", "--cite", "S2"]);
  // a surname, an unsure reading, the parish two words off: no religion of the person's own record
  for (const [n, name, transcript] of [
    [3, "Jan /Žid/", "Jan, syn Josefa Žida, rolníka v Lhotě. Kmotr Václav Žid."],
    [4, "Eva /Lhotáková/", "Eva, náboženství katol. (?)"],
    [5, "Anna /Lhotáková/", "Pfarre Lhota, kath."],
    [6, "Marie /Lhotáková/", "Kostel sv. Jakuba, katolický"],
  ] as const) {
    await w.ok(["source", "add", `Křest ${n}`, "--kind", "baptism", "--recordset", "B1", "--locator", `fol. ${n}`, "--transcript", transcript]);
    await w.ok(["person", "add", name, "--sex", "F", "--born", `${n} MAY 1890`, "--cite", `S${n}`]);
  }
  await w.ok(["task", "add", "Rodina", "--level", "enrich", "--where", "Lhota", "--why", "a", "--done-when", "b", ...["P2", "P3", "P4", "P5", "P6", "P7"].flatMap((p) => ["--about", p])]);
  const brief = (await w.ok(["brief", "T1", "--budget", "1000000"])).out;
  for (const id of ["P0002", "P0003", "P0004", "P0005", "P0006", "P0007"]) assert.equal(religionLine(brief, id), undefined, `${id}\n${brief}`);
  w.cleanup();
});

test("a marriage's record: the groom's religion the man's, the bride's the woman's", opts, async () => {
  const w = await world();
  await w.ok(["source", "add", "Sňatek 1910", "--kind", "marriage", "--recordset", "B1", "--locator", "fol. 9", "--date", "5 FEB 1910",
    "--transcript", "Ženich: Jan Lhoták, katol. Nevěsta: Marie Lhotáková, evang. a. v."]); // S2
  await w.ok(["person", "add", "Marie /Lhotáková/", "--sex", "F"]); // P2
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F1
  await w.ok(["event", "add", "F1", "MARR", "--date", "5 FEB 1910", "--cite", "S2"]);
  await w.ok(["task", "add", "Sňatek", "--level", "enrich", "--where", "Lhota", "--why", "a", "--done-when", "b", "--about", "P1", "--about", "P2"]);
  const brief = (await w.ok(["brief", "T1", "--budget", "1000000"])).out;
  assert.match(religionLine(brief, "P0001") ?? "", /S0002 says "katol\."/u, brief);
  assert.match(religionLine(brief, "P0002") ?? "", /S0002 says "evang\. a\. v\."/u, brief);
  w.cleanup();
});

test("one faith one fact: another record of it cites the fact; a changed faith is a fact of its own", opts, async () => {
  const w = await world();
  const reli = async () => (await w.ok(["person", "show", "P1", "--json"])).json.person.events.filter((e: { kind: string; retracted?: unknown }) => e.kind === "RELI" && !e.retracted);
  const first = (await w.ok(["event", "add", "P1", "religion", "--value", "katol.", "--date", "25 JUN 1885", "--cite", "S1", "--json"])).json.event;
  await w.ok(["source", "add", "Úmrtí Jana Lhotáka 1950", "--kind", "death", "--recordset", "B1", "--locator", "fol. 40", "--information", "primary", "--transcript", "Jan Lhoták, římskokatolické"]); // S2
  // the same faith written otherwise (decomposed too): the record cited there, nothing new
  const again = await w.ok(["event", "add", "P1", "RELI", "--value", "římskokatolické".normalize("NFD"), "--date", "3 MAR 1950", "--cite", "S2", "--json"]);
  assert.equal(again.json.event.id, first.id);
  assert.equal(again.json.cited, true);
  assert.deepEqual(again.json.event.citations.map((c: { source: string }) => c.source), ["S0001", "S0002"]);
  assert.equal((await reli()).length, 1);
  // the same record once more, or none: nothing written
  assert.match((await w.ok(["event", "add", "P1", "RELI", "--value", "katolické", "--cite", "S2"])).out, /already has RELI E\d+ "katol\." .*citing S0002 there already: nothing written/u);
  // without its record an agent writes no religion at all (finding 6)
  const none = await w.run(["event", "add", "P1", "RELI", "--value", "katolické", "--json"]);
  assert.notEqual(none.code, 0);
  assert.match(none.out + none.err, /event\.religion-uncited/u);
  assert.equal((await reli()).length, 1);
  // a changed faith: its own fact — and the first faith again after it, its own again
  await w.ok(["source", "add", "Sňatek Jana Lhotáka 1920", "--kind", "marriage", "--recordset", "B1", "--locator", "fol. 9", "--information", "primary", "--transcript", "ženich evang. a. v."]); // S3
  const changed = (await w.ok(["event", "add", "P1", "RELI", "--value", "evang. a. v.", "--date", "1920", "--cite", "S3", "--json"])).json.event;
  assert.notEqual(changed.id, first.id);
  await w.ok(["source", "add", "Pohřeb Jana Lhotáka 1951", "--kind", "burial", "--recordset", "B1", "--locator", "fol. 41", "--information", "primary", "--transcript", "katol."]); // S4
  const back = (await w.ok(["event", "add", "P1", "RELI", "--value", "katol.", "--date", "1951", "--cite", "S4", "--json"])).json;
  assert.notEqual(back.event.id, first.id);
  assert.equal(back.cited, undefined);
  assert.equal((await reli()).length, 3);
  w.cleanup();
});

test("RELI goes out in the GEDCOM with its value, date and citation, and back from the Strom app with no change", opts, async () => {
  const w = await world();
  await w.ok(["event", "add", "P1", "RELI", "--value", "katolické", "--date", "25 JUN 1885", "--cite", "S1", "--locator", "fol. 12"]);
  const file = path.join(w.dir, "tree.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", file]);
  const ged = fs.readFileSync(file, "utf8");
  assert.match(ged, /\n1 RELI katolické\n2 DATE 25 JUN 1885\n(?:[2-9] .*\n)*?2 SOUR @S0*1@\n3 PAGE fol\. 12\n/u);
  // the app's file as it was given: nothing changed, the fact kept
  assert.deepEqual((await w.ok(["sync", file, "--json"])).json.changes, []);
  w.cleanup();
});
