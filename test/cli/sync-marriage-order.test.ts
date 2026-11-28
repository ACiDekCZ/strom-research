// The order of a person's marriages between the research and the Strom app (spec 152 K3.2): the research gives the
// app FAMS in the person's order (the families' records in their own), with 1 _STROM_FAMS_ORDER MANUAL where the user
// set it by hand; the app's file (its GEDCOM by FAMS and the mark, its JSON by partnerships and marriageOrderManual)
// brings an order set by hand as the person's, round-trips with no change, and the mark taken off in an app that keeps
// it as the user's "by the dates" (the families' order kept). An older app's file without the mark changes nothing.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { familiesInOrder, marriagesOf, marriedInOrder } from "../../src/core/married.ts";
import { readGedcom, readStromJson } from "../../src/core/sync.ts";
import { importStromJson } from "../../src/core/import.ts";
import { Tree } from "../../src/core/tree.ts";
import { APP_KNOWS_FAMS_ORDER, APP_KNOWS_FAMS_ORDER_BETA } from "../../src/core/stromapp.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import type { Family, Name, Person } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const AGENT = { env: { CLAUDECODE: "1" } };
/** The person's own sync: the bridge writing what the app sent (forApp). */
const FROM_APP = { env: { STROM_FOR_APP: "1" } };

type Change = { kind: string; action: string; person?: string; text?: string };

/** Jan Lhoták married three times (F1 1900, F2 1910, F3 1920); the third wife's name in another script, decomposed. */
async function thrice(): Promise<{ w: World; given: (env?: Record<string, string>) => Promise<string> }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M", "--born", "1875"]); // P1
  await w.ok(["person", "add", "Anna /Lhotová/", "--sex", "F", "--born", "1878"]); // P2
  await w.ok(["person", "add", "Božena /Lhotová/".normalize("NFD"), "--sex", "F", "--born", "1885"]); // P3
  await w.ok(["person", "add", "Ελένη /Λότα/", "--sex", "F", "--born", "1890"]); // P4
  await w.ok(["family", "add", "--partner", "P0001", "--partner", "P0002", "--married", "1900"]); // F1
  await w.ok(["family", "add", "--partner", "P0001", "--partner", "P0003", "--married", "1910"]); // F2
  await w.ok(["family", "add", "--partner", "P0001", "--partner", "P0004", "--married", "1920"]); // F3
  let n = 0;
  const given = async (env: Record<string, string> = {}) => {
    const out = path.join(w.dir, `given-${++n}.ged`);
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out], { env });
    return fs.readFileSync(out, "utf8");
  };
  return { w, given };
}

const records = (text: string) => text.split(/\n(?=0 )/u);
/** A person's record in a file by their REFN. */
const indi = (text: string, id: string) => records(text).find((r) => r.startsWith("0 @") && / INDI\r?\n/u.test(r) && new RegExp(`\\n1 REFN ${id}\\r?\\n`, "u").test(r))!;
/** The families a person's FAMS name (the research's IDs: the file's xrefs), in their order. */
const famsOf = (text: string, id: string) => [...indi(text, id).matchAll(/\n1 FAMS @([^@]+)@/gu)].map((m) => m[1]!);
/** The file as the app writes it with a person's FAMS in another order, the mark by hand or without it. */
const reordered = (text: string, id: string, order: string[], manual: boolean) =>
  records(text).map((r) => {
    if (r !== indi(text, id)) return r;
    const lines = r.split("\n").filter((l) => !/^1 FAMS /u.test(l) && !/^1 _STROM_FAMS_ORDER /u.test(l));
    const at = lines.findIndex((l) => /^1 (?:FAMC|NOTE|OBJE|CHAN|_|RESN)/u.test(l));
    lines.splice(at < 0 ? lines.length : at, 0, ...(manual ? ["1 _STROM_FAMS_ORDER MANUAL"] : []), ...order.map((f) => `1 FAMS @${f}@`));
    return lines.join("\n");
  }).join("\n");
const send = (w: World, text: string, name: string) => {
  const file = path.join(w.dir, name);
  fs.writeFileSync(file, text);
  return file;
};
const plan = async (w: World, file: string, o = {}) => ((await w.ok(["sync", file, "--json"], o)).json.changes as Change[]).map((c) => [c.kind, c.action, c.person ?? "", c.text ?? ""]);
const order = async (w: World) => (await w.ok(["person", "show", "P0001", "--json"])).json.person.marriageOrder as Person["marriageOrder"];

test("the families in their own order: FAMS so, no mark; sent back unedited, nothing (152)", opts, async () => {
  const { w, given } = await thrice();
  const text = await given();
  assert.deepEqual(famsOf(text, "P0001"), ["F0001", "F0002", "F0003"]);
  assert.doesNotMatch(text, /_STROM_FAMS_ORDER/u);
  assert.deepEqual(await plan(w, send(w, text, "same.ged")), []);
  // an older app that writes FAMS in another order of its own (by the dates it sorts), no mark: nothing
  assert.deepEqual(await plan(w, send(w, reordered(text, "P0001", ["F0002", "F0001", "F0003"], false), "older.ged")), [], "an order without the mark is no edit");
  w.cleanup();
});

test("GEDCOM: the order set by hand in the app (FAMS + _STROM_FAMS_ORDER MANUAL) is the person's — written, given back in it, round-trips with no change, undone (152)", opts, async () => {
  const { w, given } = await thrice();
  const app = send(w, reordered(await given(), "P0001", ["F0003", "F0001", "F0002"], true), "hand.ged");
  const changes = await plan(w, app);
  assert.equal(changes.length, 1, JSON.stringify(changes));
  assert.deepEqual(changes[0]!.slice(0, 3), ["marriage.order", "user", "P0001"]);
  assert.match(changes[0]![3]!, /^1\. Ελένη Λότα · 2\. Anna Lhotová · 3\. Božena Lhotová$/u, "the spouses in that order, in NFC");
  assert.match((await w.ok(["sync", app], AGENT)).out, /sňatky v pořadí zadaném ručně — 1\. Ελένη Λότα/u);
  const input = (await w.ok(["sync", app, "--apply", "--json"])).json.input as string;
  assert.deepEqual(await order(w), { families: ["F0003", "F0001", "F0002"], manual: true });
  const back = await given();
  assert.deepEqual(famsOf(back, "P0001"), ["F0003", "F0001", "F0002"], "FAMS in the person's order");
  assert.match(indi(back, "P0001"), /\n1 _STROM_FAMS_ORDER MANUAL\r?\n/u);
  assert.doesNotMatch(indi(back, "P0002"), /_STROM_FAMS_ORDER/u, "one marriage: no mark");
  // the research's own tag: its check of the file says nothing of it (found in the verification of 152)
  assert.deepEqual(validateGedcom(back).filter((f) => /_STROM_FAMS_ORDER/u.test(f.message)), []);
  const told = await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", path.join(w.dir, "told.ged")]);
  assert.doesNotMatch(told.out + told.err, /_STROM_FAMS_ORDER/u);
  assert.deepEqual(records(back).flatMap((r) => /^0 @(F\d+)@ FAM/u.exec(r)?.[1] ?? []), ["F0001", "F0002", "F0003"], "the families' records in their own order");
  assert.deepEqual(await plan(w, send(w, back, "again.ged")), [], "sent back: nothing");
  assert.deepEqual(await plan(w, app), [], "the same file again: nothing");
  // the standard GEDCOM for another program: FAMS in the person's order too, never the mark
  const out = path.join(w.dir, "standard.ged");
  await w.ok(["export", "gedcom", "--out", out]);
  const std = fs.readFileSync(out, "utf8");
  assert.doesNotMatch(std, /_STROM_FAMS_ORDER/u);
  await w.ok(["sync", "undo", input]);
  assert.equal(await order(w), undefined, "undone: as it was");
  assert.deepEqual(famsOf(await given(), "P0001"), ["F0001", "F0002", "F0003"]);
  w.cleanup();
});

test("JSON: partnerships in the order by hand with marriageOrderManual is the person's; the mark taken off (data version 28) is \"by the dates\" — by the person's sync alone, the families' order kept; an older app's JSON changes nothing (152)", opts, async () => {
  const { w } = await thrice();
  const json = (o: { partnerships: string[]; manual?: boolean; version?: number }) => {
    const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
    const at = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    const person = (id: string, firstName: string, lastName: string, gender: string, partnerships: string[], more: Record<string, unknown> = {}) => ({ id, firstName, lastName, gender, refn: id, refnType: "strom-research", parentIds: [], childIds: [], partnerships, ...more });
    const out = path.join(w.dir, `app-${o.partnerships.join("")}-${o.manual ? "m" : "d"}-${o.version ?? 28}.json`);
    fs.writeFileSync(out, JSON.stringify({
      version: o.version ?? 28,
      research: { id: tree, head: at },
      persons: {
        P0001: person("P0001", "Jan", "Lhoták", "male", o.partnerships, { birthDate: "1875", ...(o.manual ? { marriageOrderManual: true } : {}) }),
        P0002: person("P0002", "Anna", "Lhotová", "female", ["u1"], { birthDate: "1878" }),
        P0003: person("P0003", "Božena", "Lhotová", "female", ["u2"], { birthDate: "1885" }),
        P0004: person("P0004", "Ελένη", "Λότα", "female", ["u3"], { birthDate: "1890" }),
      },
      partnerships: {
        u1: { id: "u1", person1Id: "P0001", person2Id: "P0002", childIds: [], status: "married", startDate: "1900", refn: "F0001", refnType: "strom-research" },
        u2: { id: "u2", person1Id: "P0001", person2Id: "P0003", childIds: [], status: "married", startDate: "1910", refn: "F0002", refnType: "strom-research" },
        u3: { id: "u3", person1Id: "P0004", person2Id: "P0001", childIds: [], status: "married", startDate: "1920", refn: "F0003", refnType: "strom-research" },
      },
    }));
    return out;
  };
  const snap = readStromJson(JSON.parse(fs.readFileSync(json({ partnerships: ["u3", "u1", "u2"], manual: true }), "utf8")), "cs");
  const jan = snap.persons.get("P0001")!;
  assert.equal(jan.fams?.length, 3);
  assert.equal(jan.famsManual, true);
  // the order of the app without the mark: no edit
  assert.deepEqual((await plan(w, json({ partnerships: ["u2", "u1", "u3"] }))).filter((c) => c[0] === "marriage.order"), []);
  const hand = json({ partnerships: ["u3", "u1", "u2"], manual: true });
  assert.deepEqual((await plan(w, hand)).filter((c) => c[0] === "marriage.order").map((c) => c.slice(0, 3)), [["marriage.order", "user", "P0001"]]);
  await w.ok(["sync", hand, "--apply"]);
  assert.deepEqual(await order(w), { families: ["F0003", "F0001", "F0002"], manual: true });
  assert.deepEqual((await plan(w, json({ partnerships: ["u3", "u1", "u2"], manual: true }))).filter((c) => c[0] === "marriage.order"), [], "the same again: nothing");
  // an older app (data version 27) sends no mark: nothing taken off
  assert.deepEqual((await plan(w, json({ partnerships: ["u1", "u2", "u3"], version: 27 }))).filter((c) => c[0] === "marriage.order"), []);
  // "by the dates" in an app that keeps the mark: off by the person's sync; an agent's sync leaves it, said
  const dates = json({ partnerships: ["u1", "u2", "u3"] });
  assert.deepEqual((await plan(w, dates)).filter((c) => c[0] === "marriage.order").map((c) => c.slice(0, 3)), [["marriage.order", "remove", "P0001"]]);
  assert.match((await w.ok(["sync", dates], AGENT)).out, /nezapsáno: zpět na pořadí podle dat vrací jen uživatel/u);
  await w.ok(["sync", dates, "--apply"], AGENT);
  assert.deepEqual(await order(w), { families: ["F0003", "F0001", "F0002"], manual: true }, "an agent's sync: kept");
  const input = (await w.ok(["sync", json({ partnerships: ["u1", "u2", "u3"] }), "--apply", "--json"], FROM_APP)).json.input as string;
  assert.deepEqual(await order(w), { families: ["F0003", "F0001", "F0002"] }, "by the dates: the mark off, the families' order kept");
  await w.ok(["sync", "undo", input]);
  assert.deepEqual(await order(w), { families: ["F0003", "F0001", "F0002"], manual: true });
  w.cleanup();
});

test("GEDCOM of an app of a known version: the mark written from APP_KNOWS_FAMS_ORDER(_BETA) (beta and development copies), its absence the user's \"by the dates\" only there (152)", opts, async () => {
  assert.equal(APP_KNOWS_FAMS_ORDER, undefined, "production: until the app's 3.33.0 is out");
  assert.equal(APP_KNOWS_FAMS_ORDER_BETA, "3.33.0-beta.8", "the shared beta of the app is 3.33.0-beta.8");
  const { w, given } = await thrice();
  const beta = { STROM_APP_URL: "https://beta.stromapp.info/run/" };
  await w.ok(["sync", send(w, reordered(await given(), "P0001", ["F0002", "F0003", "F0001"], true), "hand.ged"), "--apply"]);
  assert.match(indi(await given({ ...beta, STROM_APP_VERSION: "3.33.0-beta.8" }), "P0001"), /_STROM_FAMS_ORDER MANUAL/u);
  assert.doesNotMatch(indi(await given({ ...beta, STROM_APP_VERSION: "3.33.0-beta.7" }), "P0001"), /_STROM_FAMS_ORDER/u, "an older app: no mark");
  assert.deepEqual(famsOf(await given({ ...beta, STROM_APP_VERSION: "3.33.0-beta.7" }), "P0001"), ["F0002", "F0003", "F0001"], "FAMS in the person's order to every app");
  // the app's file of its version (HEAD 2 VERS) without the mark: the older one nothing, the one that keeps it "by the dates"
  const asApp = (text: string, vers: string) => text.replace(/^1 SOUR STROM_RESEARCH\r?\n2 VERS .*\r?\n2 NAME .*$/mu, ["1 SOUR STROM", `2 VERS ${vers}`, "2 NAME Strom Family Tree"].join("\n"));
  const text = await given(beta);
  const off = reordered(text, "P0001", ["F0002", "F0003", "F0001"], false);
  assert.deepEqual((await plan(w, send(w, asApp(off, "3.33.0-beta.7"), "older.ged"), { env: beta })).filter((c) => c[0] === "marriage.order"), []);
  assert.deepEqual((await plan(w, send(w, asApp(off, "3.33.0-beta.8"), "dates.ged"), { env: beta })).filter((c) => c[0] === "marriage.order").map((c) => c.slice(0, 3)), [["marriage.order", "remove", "P0001"]]);
  w.cleanup();
});

test("marriagesOf and familiesInOrder take the person's order; by hand, the name now is the last marriage of that order, not the latest by date (152)", () => {
  const fam = (id: string, partner: string, date: string) => ({ id, type: "family", partners: ["P0001", partner], children: [], events: [{ id: `${id}.E1`, kind: "MARR", date, citations: [] }] }) as unknown as Family;
  const fs3 = [fam("F0001", "P0002", "1900"), fam("F0002", "P0003", "1910"), fam("F0003", "P0004", "1920")];
  const surname = { P0002: "Lhoták", P0003: "Lhota", P0004: "Hromada" } as Record<string, string>;
  const person = (id: string) => (surname[id] ? ({ id, type: "person", names: [{ given: "Jan", surname: surname[id] }], events: [] } as unknown as Person) : undefined);
  const p = { marriageOrder: { families: ["F0003", "F0001"], manual: true as const } };
  assert.deepEqual(familiesInOrder(p, fs3).map((f) => f.id), ["F0003", "F0001", "F0002"], "the named first, the rest as given");
  assert.deepEqual(familiesInOrder(undefined, fs3).map((f) => f.id), ["F0001", "F0002", "F0003"]);
  const names = [{ given: "Marie", surname: "Lhotáková", kind: "married" }, { given: "Marie", surname: "Lhotová", kind: "married" }, { given: "Marie", surname: "Hromadová", kind: "married" }] as Name[];
  const now = (m: ReturnType<typeof marriagesOf>) => marriedInOrder(names, m).at(-1)!.surname;
  assert.equal(now(marriagesOf("P0001", fs3, person)), "Hromadová", "by the dates: the latest wedding");
  const hand = marriagesOf("P0001", familiesInOrder(p, fs3), person, true);
  assert.ok(hand.every((m) => m.manual));
  assert.equal(now(hand), "Lhotová", "by hand: the last of the order (F0002)");
  // a file of another program (no mark): the order kept, never the person's by hand
  const other = ["0 HEAD", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Jan /Lhoták/", "1 _STROM_FAMS_ORDER MANUAL", "1 FAMS @F2@", "1 FAMS @F1@", "0 @I2@ INDI", "1 NAME Anna /Lhotová/", "1 FAMS @F1@", "0 @I3@ INDI", "1 NAME Eva /Lhotová/", "1 FAMS @F2@", "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "0 @F2@ FAM", "1 HUSB @I1@", "1 WIFE @I3@", "0 TRLR", ""].join("\n");
  const s = readGedcom(other);
  const jan = [...s.persons.values()].find((x) => x.names[0]?.includes("Jan"))!;
  assert.equal(jan.fams?.length, 2);
  assert.equal(jan.famsManual, undefined, "the mark only of the app's or the research's file");
});

test("an app's tree taken in (its GEDCOM, its JSON) keeps the order by hand; another program's file its FAMS, the person by the dates (152)", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotové");
    const head = (sour: string) => ["0 HEAD", `1 SOUR ${sour}`, "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
    const body = ["0 @I1@ INDI", "1 NAME Jan /Lhoták/", "1 SEX M", "1 _STROM_FAMS_ORDER MANUAL", "1 FAMS @F2@", "1 FAMS @F1@", "0 @I2@ INDI", "1 NAME Anna /Lhotová/", "1 SEX F", "1 FAMS @F1@", "0 @I3@ INDI", "1 NAME Eva /Lhotová/", "1 SEX F", "1 FAMS @F2@", "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 MARR", "2 DATE 1900", "0 @F2@ FAM", "1 HUSB @I1@", "1 WIFE @I3@", "1 MARR", "2 DATE 1910", "0 TRLR", ""];
    await w.ok(["intake", send(w, [...head("STROM"), ...body].join("\n"), "app.ged")]);
    const people = () => Tree.open(w.cwd, w.env).list<Person>("person");
    const jan = people().find((p) => p.names[0]!.given === "Jan")!;
    const fam = (wife: string) => Tree.open(w.cwd, w.env).list<Family>("family").find((f) => f.partners.includes(jan.id) && f.partners.includes(people().find((p) => p.names[0]!.given === wife)!.id))!.id;
    assert.deepEqual(jan.marriageOrder, { families: [fam("Eva"), fam("Anna")], manual: true });
    await w.ok(["intake", send(w, [...head("OTHER"), ...body].join("\n").replace(/Lhot/gu, "Hromad"), "other.ged")]);
    assert.equal(people().find((p) => p.names[0]!.surname === "Hromadák")?.marriageOrder, undefined, "another program's file: the dates");
    const t = Tree.open(w.cwd, w.env);
    importStromJson(t, {
      version: 28,
      persons: {
        a: { id: "a", firstName: "Karel", lastName: "Lhota", gender: "male", partnerships: ["u2", "u1"], marriageOrderManual: true },
        b: { id: "b", firstName: "Marie", lastName: "Lhotová", gender: "female", partnerships: ["u1"] },
        c: { id: "c", firstName: "Ελένη", lastName: "Λότα", gender: "female", partnerships: ["u2"] },
      },
      partnerships: { u1: { id: "u1", person1Id: "a", person2Id: "b", childIds: [], status: "married", startDate: "1900" }, u2: { id: "u2", person1Id: "a", person2Id: "c", childIds: [], status: "married", startDate: "1910" } },
    } as unknown as Parameters<typeof importStromJson>[1], { input: "I0009", name: "lhota.json" });
    const t2 = Tree.open(w.cwd, w.env);
    const karel = t2.list<Person>("person").find((p) => p.names[0]!.given === "Karel")!;
    const of = (given: string) => t2.list<Family>("family").find((f) => f.partners.includes(karel.id) && f.partners.includes(t2.list<Person>("person").find((p) => p.names[0]!.given === given)!.id))!.id;
    assert.deepEqual(karel.marriageOrder, { families: [of("Ελένη"), of("Marie")], manual: true });
  } finally {
    w.cleanup();
  }
});

test("the bridge says it keeps the order of marriages (person.marriageOrder)", async () => {
  const { BRIDGE_FEATURES } = await import("../../src/core/live.ts");
  assert.ok((BRIDGE_FEATURES as readonly string[]).includes("person.marriageOrder"));
});
