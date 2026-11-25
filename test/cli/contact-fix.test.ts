// A person's contact shown apart from the facts (strom person show, strom person card), never in an agent's brief
// (no e-mail, no residence of it); residences an older strom made of contacts (spec 134 U11) set right by strom fixes
// contact-residences — the Strom app's note "E-mail: …", an empty residence of another program's 1 RESI / 2 EMAIL (the
// e-mail read again from the file kept in inputs/), the house "Email" — on a person's word alone; one with a record
// cited or a note of its own left; undone exactly.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { changeLines } from "../../src/core/changelog.ts";
import type { Event, Person, Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit, timeout: 180_000 };
const AGENT = { env: { CLAUDECODE: "1" } };

const commits = (w: World) => Number(execFileSync("git", ["-C", w.cwd, "rev-list", "--count", "HEAD"], { encoding: "utf8" }).trim());
const open = (w: World) => Tree.open(w.cwd, w.env);
const personOf = (w: World, id: string) => open(w).get<Person>(id)!;
const eventOf = (w: World, id: string) => open(w).list<Person>("person").flatMap((p) => p.events).find((e) => e.id === id)!;

/** A person and their facts as an older strom wrote them (inside one commit). */
function asOlder(w: World, id: string, change: (p: Person) => void): void {
  const tree = open(w);
  tree.withTreeLock(() => {
    const p = structuredClone(tree.get<Person>(id)!);
    change(p);
    tree.put(p, { op: "person.update", targets: [id], summary: `${id}: as an older strom wrote it` });
    tree.commit("As an older strom wrote it");
  });
}

/** A residence as an older strom left it: nothing of it but what `keep` says. */
const bare = (e: Event, keep: Partial<Event>) => {
  for (const k of ["date", "place", "house", "value", "note"] as const) delete e[k];
  Object.assign(e, keep);
};

const MH = [
  "0 HEAD",
  "1 SOUR MYHERITAGE",
  "2 NAME MyHeritage Family Tree Builder",
  "1 GEDC",
  "2 VERS 5.5.1",
  "2 FORM LINEAGE-LINKED",
  "1 CHAR UTF-8",
  "0 @I1@ INDI",
  "1 NAME Hromoslav /Ozubec/",
  "1 SEX M",
  "1 BIRT",
  "2 DATE 1950",
  "2 PLAC Lhota",
  "1 RESI",
  "2 EMAIL hromoslav@example.org",
  "0 @I2@ INDI",
  "1 NAME Mlhoslava /Lhotáková/",
  "1 SEX F",
  "1 BIRT",
  "2 DATE 1952",
  "2 PLAC Lhota",
  "1 RESI",
  "2 ADDR",
  "3 ADR1 Email",
  "2 EMAIL mlhoslava@example.org",
  "0 @I3@ INDI",
  "1 NAME Kapradin /Lhoták/",
  "1 SEX M",
  "1 BIRT",
  "2 DATE 1930",
  "2 PLAC Lhota",
  "0 TRLR",
  "",
].join("\n");

/**
 * The research of the Ozubecs as an older strom left it: an import of MyHeritage's file (Hromoslav's residence of the
 * e-mail empty, Mlhoslava's with the house "Email", Kapradin's empty though the file has no e-mail of his), Lumíra's
 * residence noted by the Strom app ("E-mail: …", its send cited), Heliodora's noted so with a baptism cited, Hubomír's
 * with a note of his own beside the e-mail.
 */
async function older(w: World) {
  await w.withTree("Ozubcovi");
  const file = path.join(w.dir, "ozubcovi.ged");
  fs.writeFileSync(file, MH);
  await w.ok(["intake", file]);
  const tree = open(w);
  const people = tree.list<Person>("person");
  const by = (given: string) => people.find((p) => p.names[0]!.given === given)!.id;
  const imported = tree.list<Source>("source").find((s) => s.kind === "family-tree")!.id;
  const ids = { hromoslav: by("Hromoslav"), mlhoslava: by("Mlhoslava"), kapradin: by("Kapradin") } as Record<string, string>;
  ids.zdislava = (await w.ok(["person", "add", "Lumíra /Ozubcová/", "--sex", "F", "--born", "1955", "--json"])).json.person.id;
  ids.radmila = (await w.ok(["person", "add", "Heliodora /Ozubcová/", "--sex", "F", "--born", "1957", "--json"])).json.person.id;
  ids.vlastimil = (await w.ok(["person", "add", "Hubomír /Ozubec/", "--sex", "M", "--born", "1959", "--json"])).json.person.id;
  const app = (await w.ok(["source", "add", "Úpravy v aplikaci Strom", "--kind", "family-tree", "--json"])).json.source.id as string;
  const baptism = (await w.ok(["source", "add", "Křest Heliodory", "--kind", "baptism", "--json"])).json.source.id as string;
  const resi = async (who: string, cite: string) => (await w.ok(["event", "add", ids[who]!, "RESI", "--date", "1990", "--place", "Lhota", "--cite", cite, "--json"])).json.event.id as string;
  const ev = {
    hromoslav: await resi("hromoslav", imported),
    mlhoslava: await resi("mlhoslava", imported),
    kapradin: await resi("kapradin", imported),
    zdislava: await resi("zdislava", app),
    radmila: await resi("radmila", baptism),
    vlastimil: await resi("vlastimil", app),
  };
  // as an older strom took them: no contact, the residences of nothing (or of a label, a note)
  const older = (who: keyof typeof ev, keep: Partial<Event>) =>
    asOlder(w, ids[who]!, (p) => {
      delete p.contact;
      bare(p.events.find((e) => e.id === ev[who])!, { status: "lead", ...keep });
    });
  older("hromoslav", {});
  older("mlhoslava", { house: "Email" });
  older("kapradin", {});
  older("zdislava", { note: "E-mail: zdislava@example.org\nE-mail: Lumíra.Ozubcova@example.org".normalize("NFD") });
  older("radmila", { note: "E-mail: radmila@example.org" });
  older("vlastimil", { note: "Bydlel u bratra.\nE-mail: vlastimil@example.org" });
  // Lumíra's contact has one of them already (letter case aside)
  asOlder(w, ids.zdislava!, (p) => {
    p.contact = { emails: ["zdislava@EXAMPLE.org"] };
  });
  return { ids, ev, imported };
}

test("the contact apart: person show (text and --json), person card in the research's language; the brief says no e-mail and no residence of it", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Ozubcovi");
    await w.ok(["lang", "cs"]);
    const p = (await w.ok(["person", "add", "Hromoslav /Ozubec/", "--sex", "M", "--born", "1950", "--json"])).json.person.id as string;
    const child = (await w.ok(["person", "add", "Kapradin /Ozubec/", "--sex", "M", "--born", "1980", "--json"])).json.person.id as string;
    await w.ok(["family", "add", "--partner", p, "--child", child]);
    const e = (await w.ok(["event", "add", p, "RESI", "--date", "1990", "--place", "Lhota", "--json"])).json.event.id as string;
    asOlder(w, p, (x) => {
      x.contact = { emails: ["hromoslav@example.org", "h.ozubec@example.org"] };
      // a residence of the contact an older strom left: the label of an address, the e-mail noted
      bare(x.events.find((y) => y.id === e)!, { house: "Email", note: "E-mail: hromoslav@example.org" });
    });
    const show = await w.ok(["person", "show", p, "--lang", "en"]);
    assert.match(show.out, /\ncontact: hromoslav@example\.org, h\.ozubec@example\.org\n/u);
    assert.match((await w.ok(["person", "show", p], { tty: true })).out, /kontakt: hromoslav@example\.org/u, "the person's language at their terminal");
    const j = await w.ok(["person", "show", p, "--json"]);
    assert.deepEqual(j.json.person.contact.emails, ["hromoslav@example.org", "h.ozubec@example.org"]);
    const card = await w.ok(["person", "card", p]);
    assert.match(card.out, /\n {2}E-mail: hromoslav@example\.org, h\.ozubec@example\.org\n/u);
    assert.deepEqual((await w.ok(["person", "card", p, "--json"])).json.contact, { emails: ["hromoslav@example.org", "h.ozubec@example.org"] });
    assert.match((await w.ok(["person", "card", p, "--lang", "de"])).out, /E-Mail: hromoslav@example\.org/u);
    assert.doesNotMatch((await w.ok(["person", "card", child])).out, /E-mail/u, "none: no line");
    // the agent's brief: of the person and of the child (the father a relative) — no e-mail, no residence, no house "Email"
    await w.ok(["recordset", "add", "Lhota N 1940-1990", "--places", "Lhota", "--years", "1940-1990", "--access", "online-free"]);
    await w.ok(["task", "add", "Hromoslav", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", p]);
    await w.ok(["task", "add", "Kapradin", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", child]);
    for (const task of ["T1", "T2"]) {
      const brief = (await w.ok(["brief", task], AGENT)).out;
      assert.doesNotMatch(brief, /example\.org|house Email|E-mail:/u, task);
      assert.doesNotMatch(brief, new RegExp(`${e.replace(/\./gu, "\\.")}|lived:|more fact`, "u"), task);
    }
    // no task, check or proposal to fill in the place of a residence that is a contact
    const check = (await w.run(["check", "--json"], AGENT)).json;
    assert.doesNotMatch(JSON.stringify(check.findings ?? []), new RegExp(e.replace(/\./gu, "\\."), "u"));
    const tasks = (await w.ok(["task", "list", "--json"], AGENT)).json;
    assert.doesNotMatch(JSON.stringify(tasks), /RESI|residence|bydliště|example\.org/iu);
  } finally {
    w.cleanup();
  }
});

test("strom fixes contact-residences: found (the app's note, both MyHeritage forms read again from the file), left with why; nothing without the person; set right, idempotent, undone exactly", opts, async () => {
  const w = new World();
  try {
    const { ids, ev } = await older(w);
    const before = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, personOf(w, id)]));
    const j = await w.ok(["fixes", "show", "contact-residences", "--json"]);
    assert.equal(j.json.remedy, "rewrite");
    assert.equal(j.json.paid, false);
    const items = Object.fromEntries(j.json.items.map((i: { event: string }) => [i.event, i]));
    assert.deepEqual(Object.keys(items).sort(), [ev.hromoslav, ev.mlhoslava, ev.zdislava].sort(), "Kapradin's file has no e-mail of his: not offered");
    assert.deepEqual(items[ev.hromoslav], { owner: ids.hromoslav, event: ev.hromoslav, how: "retract", from: "input", input: items[ev.hromoslav].input, emails: ["hromoslav@example.org"] });
    assert.match(items[ev.hromoslav].input, /^I\d+$/u);
    assert.deepEqual(items[ev.mlhoslava].emails, ["mlhoslava@example.org"]);
    assert.equal(items[ev.mlhoslava].house, "Email");
    assert.equal(items[ev.mlhoslava].how, "retract");
    assert.equal(items[ev.zdislava].from, "note");
    assert.deepEqual(items[ev.zdislava].emails, ["zdislava@example.org", "Lumíra.Ozubcova@example.org"], "NFC, each once");
    assert.deepEqual(
      j.json.left.map((l: { event: string; why: string }) => [l.event, l.why]).sort(),
      [
        [ev.radmila, "record"],
        [ev.vlastimil, "note"],
      ].sort(),
    );
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((c: { id: string }) => c.id === "contact-residences").state, "pending");
    const show = await w.ok(["fixes", "show", "contact-residences", "--lang", "en"]);
    assert.match(show.out, /Found: 5 residences of a contact — 3 to be set right by rules, 2 to stay as they are/u);
    assert.match(show.out, new RegExp(`${ids.mlhoslava} · ${ev.mlhoslava.replace(/\./gu, "\\.")} → contact mlhoslava@example\\.org, the residence withdrawn`, "u"));
    assert.match(show.out, new RegExp(`${ids.radmila} · ${ev.radmila.replace(/\./gu, "\\.")}: a record cited — stays as it is`, "u"));
    assert.match((await w.ok(["fixes", "show", "contact-residences", "--lang", "cs"])).out, /Nalezeno: 5 bydlišť s kontaktem/u);
    // never without the person: an agent, a run nobody watches, --yes
    for (const env of [{ CLAUDECODE: "1" }, { STROM_NONINTERACTIVE: "1" }] as Record<string, string>[])
      assert.equal((await w.run(["fixes", "run", "contact-residences"], { env })).code, 4, JSON.stringify(env));
    assert.notEqual((await w.run(["fixes", "run", "contact-residences", "--yes"], { tty: true, answers: ["1"] })).code, 0);
    for (const [k, id] of Object.entries(ids)) assert.deepEqual(personOf(w, id), before[k], `${k}: nothing changed`);

    const n0 = commits(w);
    const r = await w.ok(["fixes", "run", "contact-residences", "--lang", "en"], { tty: true, answers: ["1"] });
    assert.match(r.out, /Set right: 3 residences in 3 records\./u);
    assert.equal(commits(w), n0 + 1, "one commit");
    const tree = open(w);
    const ops = tree.readOps().filter((o) => o.op === "contact.fix");
    assert.equal(ops.length, 1, "one operation");
    assert.ok(ops[0]!.files.some((f) => f.path === "quality/contact-residences.json"));
    assert.ok(ops[0]!.files.some((f) => f.path === "strom.json"), "the decision in the same operation");
    assert.deepEqual(changeLines(tree, ops, "", "cs").map((l) => l.text), ["E-maily z bydlišť přesunuty do kontaktů osob: 3"]);
    assert.deepEqual(personOf(w, ids.hromoslav!).contact, { emails: ["hromoslav@example.org"] });
    assert.deepEqual(personOf(w, ids.mlhoslava!).contact, { emails: ["mlhoslava@example.org"] });
    assert.deepEqual(personOf(w, ids.zdislava!).contact, { emails: ["zdislava@EXAMPLE.org", "Lumíra.Ozubcova@example.org"] }, "one there already kept as it is");
    for (const k of ["hromoslav", "mlhoslava", "zdislava"] as const) {
      const e = eventOf(w, ev[k]);
      assert.equal(e.status, "retracted", k);
      assert.match(e.retracted!.reason, /contact-residences/u);
      assert.equal(e.house, undefined, `${k}: no label`);
    }
    assert.equal(eventOf(w, ev.zdislava).note?.normalize("NFC"), "E-mail: zdislava@example.org\nE-mail: Lumíra.Ozubcova@example.org", "the note kept");
    for (const k of ["kapradin", "radmila", "vlastimil"] as const) assert.deepEqual(personOf(w, ids[k]!), before[k], `${k}: left`);
    assert.equal((await w.run(["verify", "--json"])).code, 0, "sealed");
    const g = (await w.run(["guard", "--json"])).json;
    assert.ok(!(g.findings ?? []).some((f: { level: string }) => f.level === "error"), JSON.stringify(g.findings));
    // idempotent: nothing more to set right
    const again = await w.ok(["fixes", "show", "contact-residences", "--json"]);
    assert.deepEqual(again.json.items, []);
    assert.equal(again.json.state, "fixed");
    // undo: the person's, back exactly
    assert.equal((await w.run(["fixes", "undo", "contact-residences"], AGENT)).code, 4);
    const n1 = commits(w);
    const u = await w.ok(["fixes", "undo", "contact-residences", "--lang", "en"], { tty: true });
    assert.match(u.out, /Put back as they were: 3 residences/u);
    assert.equal(commits(w), n1 + 1);
    assert.equal(open(w).readOps().filter((o) => o.op === "contact.unfix").length, 1);
    for (const [k, id] of Object.entries(ids)) assert.deepEqual(personOf(w, id), before[k], `${k}: back exactly`);
    assert.match((await w.ok(["fixes", "undo", "contact-residences", "--lang", "en"], { tty: true })).out, /Nothing to put back/u);
  } finally {
    w.cleanup();
  }
});

test("strom fixes contact-residences: a house label on a residence of its own taken off alone; in an archive shown and set right, nothing of an agent; an undo never over a change since", opts, async () => {
  const w = new World();
  try {
    const { ids, ev } = await older(w);
    const lived = (await w.ok(["event", "add", ids.kapradin!, "RESI", "--date", "1970", "--place", "Lhota", "--json"])).json.event.id as string;
    asOlder(w, ids.kapradin!, (p) => {
      p.events.find((e) => e.id === lived)!.house = "Email";
    });
    await w.ok(["mode", "archive"], { tty: true, answers: ["y"] });
    assert.ok((await w.ok(["fixes", "--json"])).json.checks.some((c: { id: string }) => c.id === "contact-residences"));
    const show = await w.ok(["fixes", "show", "contact-residences"]);
    assert.doesNotMatch(show.out, /agent|\bAI\b|umělá inteligence|Claude|Codex|\bmodel/iu);
    const r = await w.ok(["fixes", "run", "contact-residences"], { tty: true, answers: ["1"] });
    assert.doesNotMatch(r.out, /agent|\bAI\b|umělá inteligence|Claude|Codex|\bmodel/iu);
    const e = eventOf(w, lived);
    assert.deepEqual([e.place, e.house, e.status !== "retracted"], ["Lhota", undefined, true], "a residence of its own stays, the label off");
    await w.ok(["mode", "research"], { tty: true, answers: ["y"] });
    // a change since: kept by the undo
    asOlder(w, ids.hromoslav!, (p) => {
      const x = p.events.find((y) => y.id === ev.hromoslav)!;
      delete x.retracted;
      x.status = "possible";
    });
    const u = await w.ok(["fixes", "undo", "contact-residences", "--lang", "en"], { tty: true });
    assert.match(u.out, /Put back as they were: 3 residences · 1 changed since, left as it is/u);
    assert.equal(eventOf(w, lived).house, "Email");
    assert.equal(eventOf(w, ev.hromoslav).status, "possible");
    assert.equal(personOf(w, ids.hromoslav!).contact, undefined, "the e-mail the fix added taken off");
  } finally {
    w.cleanup();
  }
});
