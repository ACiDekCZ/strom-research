// A religion as a record writes it (core/religion.ts): its clear forms in Czech, German, Latin and Polish (and a few
// Cyrillic ones), each a faith; never a word that only begins so, a name, or the faith of a parish, a church, a rite,
// a register or a street. Made-up texts only.

import { test } from "node:test";
import assert from "node:assert/strict";
import { religionKey, religionsIn, sameReligion } from "../../src/core/religion.ts";

const keys = (text: string) => religionsIn(text).map((r) => r.key);
const texts = (text: string) => religionsIn(text).map((r) => r.text);

test("the clear forms of each faith, as the record writes them", () => {
  const cases: [string, string, string][] = [
    ["Náboženství: katolické", "catholic", "katolické"],
    ["náb. katol.", "catholic", "katol."],
    ["řím.-kat.", "catholic", "řím.-kat."],
    ["římskokatolického", "catholic", "římskokatolického"],
    ["Religion: kath.", "catholic", "kath."],
    ["röm. kath.", "catholic", "röm. kath."],
    ["katholisch", "catholic", "katholisch"],
    ["religionis catholicae", "catholic", "catholicae"],
    ["wyznania rzymskokatolickiego", "catholic", "rzymskokatolickiego"],
    ["evang. a. v.", "evangelical-ac", "evang. a. v."],
    ["ev. a. v.", "evangelical-ac", "ev. a. v."],
    ["evangelisch A. B.", "evangelical-ac", "evangelisch A. B."],
    ["evangelické augsburského vyznání", "evangelical-ac", "evangelické augsburského"],
    ["evang. h. v.", "evangelical-hc", "evang. h. v."],
    ["evangelisch H.B.", "evangelical-hc", "evangelisch H.B."],
    ["helvetského vyznání", "evangelical-hc", "helvetského"],
    ["evang.", "evangelical", "evang."],
    ["evangelická", "evangelical", "evangelická"],
    ["Religion: israel.", "jewish", "israel."],
    ["israelitisch", "jewish", "israelitisch"],
    ["izraelské", "jewish", "izraelské"],
    ["Náboženství: žid.", "jewish", "žid."],
    ["Náboženství: Žid", "jewish", "Žid"],
    ["Religion: mos.", "jewish", "mos."],
    ["Konfession: Jud.", "jewish", "Jud."],
    ["Religion: Kath.", "catholic", "Kath."],
    ["Náboženství otce: žid.", "jewish", "žid."],
    ["jüd.", "jewish", "jüd."],
    ["gr.-kath.", "greek-catholic", "gr.-kath."],
    ["řeckokatolické", "greek-catholic", "řeckokatolické"],
    ["altkatholisch", "old-catholic", "altkatholisch"],
    ["pravoslavné", "orthodox", "pravoslavné"],
    ["akatholisch", "non-catholic", "akatholisch"],
    ["protestantisch", "protestant", "protestantisch"],
    ["bez vyznání", "none", "bez vyznání"],
    ["konfessionslos", "none", "konfessionslos"],
    ["církve československé", "czechoslovak", "církve československé"],
    ["вероисповедание: православное", "orthodox", "православное"],
  ];
  for (const [text, key, found] of cases) {
    assert.deepEqual(keys(text), [key], text);
    assert.deepEqual(texts(text), [found], text);
  }
});

test("a form that is a name too counts only under a label of a religion or its column (finding 1)", () => {
  for (const text of [
    "Jan, syn Josefa Žida, rolníka v Lhotě. Kmotr Václav Žid.",
    "Jan Žid, sedlák",
    "JAN ŽID, SEDLÁK",
    "Mos. Kohn, Händler",
    "Jud. Lhota, Inwohnerin",
    "kath.",
    "Anna, kath., ledig",
    "israel.",
    "Johann Orth.",
    "Hebr. psáno",
    "Jan Židovský, rolník",
    "Žid Jan",
    // a column of names: the surname's, never a religion
    "| Jméno | Příjmení | Náboženství |\n|---|---|---|\n| Jan | Žid | katol. |",
  ])
    assert.deepEqual(keys(text).filter((k) => k !== "catholic" || !text.includes("katol.")), [], text);
  // under its column: the faith of the row
  assert.deepEqual(keys("| Jméno | Náboženství |\n|---|---|\n| Jan Lhoták | žid. |"), ["jewish"]);
  assert.deepEqual(keys("Name\tReligion\nJohann\tkath."), ["catholic"]);
  assert.deepEqual(keys("| Jméno | Příjmení | Náboženství |\n|---|---|---|\n| Jan | Žid | katol. |"), ["catholic"]);
  // a value of a RELI fact is its own label
  assert.equal(religionKey("žid."), "jewish");
  assert.equal(religionKey("Kath."), "catholic");
});

test("a reading not sure is no religion (finding 3)", () => {
  for (const text of [
    "Eva, náboženství katol. (?)",
    "Náboženství: katol.?",
    "Náboženství: katol? nečitelné",
    "Náboženství: katol. [?]",
    "Náboženství: ? katol.",
    "Náboženství: snad katol.",
    "Náboženství: asi evang. a. v.",
    "Religion: kath. (unsicher)",
    "Religion: wohl evangelisch",
    "Náboženství: katolické, nejisté",
    "Religio: catholica, incerta",
    "Wyznanie: katolickie (niepewne)",
  ])
    assert.deepEqual(keys(text), [], text);
  // a "?" of another column is not this one's
  assert.deepEqual(keys("| katol. | ? |"), ["catholic"]);
});

test("a parish, a church or a place a word or two off is no religion either (finding 4)", () => {
  for (const text of [
    "Pfarre Lhota, kath.",
    "Kostel sv. Jakuba, katolický",
    "Evangelisch-Lutherische Kirche",
    "Katholisch Lhotendorf",
    "katholische Volksschule",
    "Lhota, katolická fara sv. Jakuba",
    "Lhota č. 7, farnost Lhota, katol.",
    "katolický filiální kostel",
    "evangelická Pfarrkirche",
  ])
    assert.deepEqual(keys(text), [], text);
  // a column of its own is not the parish's
  assert.deepEqual(keys("Religion: kath. | Pfarre: Lhota"), ["catholic"]);
  assert.deepEqual(keys("Pfarre: Lhota | Religion: katholisch"), ["catholic"]);
});

test("whose a faith is: a father's, a godparent's, a groom's or a bride's where the record says so", () => {
  const of = (text: string) => religionsIn(text).map((r) => `${r.key}:${r.of ?? "own"}`);
  assert.deepEqual(of("Náboženství: katol."), ["catholic:own"]);
  assert.deepEqual(of("Hana, dcera Josefa Lhotáka; náboženství otce: katol."), ["catholic:other"]);
  assert.deepEqual(of("Jan, syn Josefa Lhotáka, katol."), ["catholic:other"]);
  assert.deepEqual(of("Jan, syn Josefa Lhotáka, rolníka v Lhotě č. 7. Náboženství: katol."), ["catholic:own"]);
  assert.deepEqual(of("Otec: Josef Lhoták, rolník, katol. | Matka: Marie, evang."), ["catholic:other", "evangelical:other"]);
  assert.deepEqual(of("Ženich: Jan Lhoták, katol. Nevěsta: Marie Lhotová, evang. a. v."), ["catholic:groom", "evangelical-ac:bride"]);
  assert.deepEqual(of("| Dítě | Náboženství | Otec |\n|---|---|---|\n| Jan | katol. | Josef, evang. |"), ["catholic:own", "evangelical:other"]);
  assert.deepEqual(of("Vater: Johann, katholisch"), ["catholic:other"]);
});

test("decomposed (NFD) input is found and given back composed", () => {
  const nfd = "Náboženství: římskokatolické".normalize("NFD");
  assert.deepEqual(religionsIn(nfd), [{ key: "catholic", text: "římskokatolické" }]);
});

test("words that only begin like a faith, and names, are no religion", () => {
  for (const text of [
    "Katharina Lhoták",
    "Kateřina Lhotáková",
    "Jan Evangelista Lhoták",
    "Evangelium sv. Jana",
    "Kath. Lhoták, Inwohnerin",
    "Cath. Lhotak filia",
    "Kohn Israel. Lhota",
    "Israel Kohn",
    "Augsburg",
    "evidenční číslo ev. č. 12",
    "a. v. h. v.",
    "Židlochovice",
    "kat. území Lhota",
    "Moses",
    "Hebrejsky psáno",
  ])
    assert.deepEqual(keys(text), [], text);
});

test("the faith of a parish, a church, a rite, a register or a street is never the person's", () => {
  for (const text of [
    "Římskokatolická farnost Lhota",
    "Matrika římskokatolické fary v Lhotě",
    "katolický křest",
    "pokřtěn podle katolického obřadu",
    "ritu catholico baptizatus",
    "Evangelische Pfarrgemeinde Lhota",
    "evang. Kirche",
    "Evangelický sbor v Lhotě",
    "Židovská ulice",
    "Židovské Město",
    "israelitische Kultusgemeinde",
    "katholischer Friedhof",
    "katholischer Pfarrer",
    "kaplan katolický",
  ])
    assert.deepEqual(keys(text), [], text);
});

test("a column with its faith and a register's header: each named one found, in order", () => {
  assert.deepEqual(keys("Náboženství katolické | protestantské: — | 1"), ["catholic", "protestant"]);
  assert.deepEqual(keys("Ženich: katol. Nevěsta: evang. a. v."), ["catholic", "evangelical-ac"]);
});

test("one faith of two writings, never two faiths", () => {
  assert.equal(religionKey("katol."), "catholic");
  assert.equal(religionKey("katolické"), "catholic");
  assert.equal(religionKey("Lhota"), undefined);
  assert.ok(sameReligion("katol.", "římskokatolické"));
  assert.ok(sameReligion("evang. a. v.", "evangelisch A. B."));
  assert.ok(!sameReligion("evang. a. v.", "evang. h. v."));
  assert.ok(!sameReligion("katol.", "řeckokatolické"));
  assert.ok(!sameReligion("evang.", "evang. a. v."));
  // a value no form of the list says: the same words alone
  assert.ok(sameReligion("Herrnhuter", "herrnhuter"));
  assert.ok(!sameReligion("Herrnhuter", "katol."));
});
