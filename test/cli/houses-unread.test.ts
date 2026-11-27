// A house's claims taken over unread (spec 145 T7): a claim on a source with a web address nobody of the research read
// is named in the brief of a house's task (and of a municipality's skeleton) and holds its done until it is read —
// written in the claim's place (--replaces, its ID kept, the person's never) — or said unavailable, each one line of
// what was gone through; nothing raised besides. And the research's own "no more of its look automatically" gone once
// another check or material given after says otherwise (N5). Synthetic data only (made-up names), with diacritics,
// decomposed input and a source in Cyrillic.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { houseDoneLacks } from "../../src/core/houseauto.ts";
import { forHouse, houseWork } from "../../src/core/houses.ts";
import { unreadWebClaims } from "../../src/core/houseunread.ts";
import type { House, Task } from "../../src/core/model.ts";
import { validateRecord } from "../../src/core/validate.ts";

const opts = { skip: !hasGit, timeout: 240_000 };
const AGENT = { env: { CLAUDECODE: "1" } };
const open = (w: World) => Tree.open(w.cwd, w.env);
const houseTasks = (w: World) => open(w).list<Task>("task").filter((t) => forHouse(t) && !t.retracted);
const record = (w: World, id: string) => open(w).get<House>(id)!;
const PDF = "https://lhota.example.org/historie-hasicu.pdf";
const RU = "https://lhota.example.org/история.pdf";

/** Lhota (L0001) 9: the Lhotáks, two generations — its house's task raised with the houses on. Its record A…. */
async function village(w: World): Promise<string> {
  await w.withTree("Lhotákovi");
  await w.ok(["place", "add", "Lhota", "--kind", "village"]);
  const person = async (name: string) => (await w.ok(["person", "add", name, "--json"])).json.person.id as string;
  const child = await person("Kapradin /Lhoták/");
  const father = await person("Mlhoslav /Lhoták/");
  await w.ok(["family", "add", "--partner", father, "--child", child]);
  await w.ok(["config", "set", "main.person", child, "--for-tree"]);
  await w.ok(["event", "add", child, "BIRT", "--date", "1900", "--place", "Lhota", "--house", "9"]);
  await w.ok(["event", "add", father, "BIRT", "--date", "1870", "--place", "Lhota", "--house", "9"]);
  await w.ok(["config", "set", "houses", "on", "--for-tree"], { tty: true });
  const h = open(w).list<House>("house").find((x) => !x.retracted && !x.town && x.place === "L0001" && x.house === "9");
  assert.ok(h);
  return h.id;
}

/** What an agent writes of a house's list before it closes its task (spec 145 T5, T1). */
async function goneThrough(w: World, a: string) {
  for (const q of ["adresní místo", "pomístní jména", "ortofoto"]) await w.ok(["search", "add", q, "--method", "web", "--result", "negative"], AGENT);
  await w.ok(["house", "add", "passed", a, "--checklist", "--what", "prošlo: adresní místo, pomístní jména, ortofoto"], AGENT);
  await w.ok(["house", "add", "look", a, "--text", "přízemní chalupa", "--certainty", "guess"], AGENT);
  await w.ok(["house", "add", "look-check", a, "--next", "none", "--text", "obrázek domu nikde"], AGENT);
}

test("taken over unread (spec 145 T7): named in the brief of a house's task, its done held until read in its place or said unavailable; the person's never replaced; nothing raised", opts, async () => {
  const w = new World();
  try {
    const a = await village(w);
    const t = houseTasks(w).find((x) => x.origin === `house:${a}`)!;
    // sources of an older research, written at the terminal (no reading of the research's): one with an address, one
    // with an address and a transcript (read), one with none; one in Cyrillic with an address of the citation
    const src = async (title: string, ...more: string[]) => (await w.ok(["source", "add", title, "--kind", "other", "--form", "authored", ...more, "--json"])).json.source.id as string;
    const s1 = await src("Historie sboru dobrovolných hasičů v Lhotě".normalize("NFD"), "--url", PDF);
    const s2 = await src("Kronika obce Lhota", "--url", "https://lhota.example.org/kronika", "--transcript", "Roku 1868 vyhořelo stavení č. 9.");
    const s3 = await src("Paměti rodu Lhotáků", "--note", "jen papírově");
    const s4 = await src("История пожарной команды");
    // the claims, as an earlier research wrote them: the fire 1905 on s1 (and its address), 1868 on s2 (read), a
    // transfer on s3 (no address), a renumbering on s4 with the address of the citation; the person's holder on s1
    await w.ok(["house", "add", "event", a, "--kind", "fire", "--date", "1905-11", "--text", "Převzato ze starého výzkumu, dokument znovu nečten.".normalize("NFD"), "--certainty", "guess", "--source", s1, "--url", PDF], AGENT);
    await w.ok(["house", "add", "event", a, "--kind", "fire", "--date", "1868", "--text", "vyhořelo", "--source", s2], AGENT);
    await w.ok(["house", "add", "event", a, "--kind", "transfer", "--date", "1781", "--text", "koupě", "--source", s3], AGENT);
    await w.ok(["house", "add", "number", a, "--number", "7", "--until", "1850", "--source", s4, "--url", RU], AGENT);
    await w.ok(["house", "add", "holder", a, "--name", "Ozubec Lhoták", "--since", "1880", "--until", "1905", "--how", "inheritance", "--source", s1]);

    const claims = () => unreadWebClaims(open(w), [record(w, a)]).map((c) => `${c.item} ${c.source} ${c.url} ${c.origin}`);
    assert.deepEqual(claims(), [`e1 ${s1} ${PDF} research`, `h1 ${s1} ${PDF} user`, `n1 ${s4} ${RU} research`]);

    // the brief of its task names each: read it, in its place (the person's beside), or one line unavailable
    const brief = (await w.ok(["brief", t.id], AGENT)).out;
    assert.match(brief, /## Taken over, never read/u);
    assert.match(brief, /taken over unread \(its source on the web/u);
    assert.ok(brief.includes(`${a} e1 (fire 1905-11) on ${s1} <${PDF}>: read it, then strom house add event ${a} --replaces e1`), brief);
    assert.ok(brief.includes(`${a} h1 (holder Ozubec Lhoták 1880–1905) on ${s1} <${PDF}>: read it, then the person's item stays`), brief);
    assert.ok(brief.includes(`${a} n1 (number 7 –1850) on ${s4} <${RU}>`), brief);
    assert.ok(brief.includes(`strom house add passed ${a} --source ${s1} --url ${PDF} --found no`), brief);
    assert.doesNotMatch(brief, new RegExp(`on ${s2}|on ${s3}`, "u"));

    // the list gone through, its look and its check: still refused for the claims taken over unread
    const before = houseTasks(w).map((x) => x.id).sort();
    await w.ok(["session", "start", t.id], AGENT);
    await goneThrough(w, a);
    // a source the session itself writes with its address: read by the research, never named
    const s5 = (await w.ok(["source", "add", "Obecní web Lhoty", "--kind", "other", "--url", "https://lhota.example.org/", "--json"], AGENT)).json.source.id as string;
    await w.ok(["house", "add", "event", a, "--kind", "rebuilt", "--date", "1910", "--text", "přestavba", "--source", s5], AGENT);
    const early = await w.run(["session", "close", "--done", "dům prošel", "--next", "další dům"], AGENT);
    assert.notEqual(early.code, 0);
    const said = early.out + early.err;
    assert.match(said, new RegExp(`${a}: taken over unread — ${a} e1 \\(fire 1905-11\\) on ${s1}`, "u"));
    assert.match(said, new RegExp(`${a} n1 \\(number 7 –1850\\) on ${s4}`, "u"));
    assert.doesNotMatch(said, new RegExp(`on ${s5}`, "u"));
    assert.equal(open(w).get<Task>(t.id)!.state, "doing");

    // the person's holder is never replaced: refused, what to do said
    const theirs = await w.run(["house", "add", "holder", a, "--replaces", "h1", "--name", "Ozubec Lhoták", "--source", s1], AGENT);
    assert.notEqual(theirs.code, 0);
    assert.match(theirs.err, /h1 is the person's word: it stays/u);
    assert.match(theirs.out + theirs.err, /as an item of its own \(without --replaces\)/u);
    const nothing = await w.run(["house", "add", "event", a, "--replaces", "e9", "--kind", "fire", "--text", "x"], AGENT);
    assert.notEqual(nothing.code, 0);
    assert.match(nothing.err, /no e9 in the timeline of/u);

    // read: what it says in the place of e1 (its ID kept, the page of the source), one line gone through
    await w.ok(["house", "add", "event", a, "--replaces", "e1", "--kind", "fire", "--date", "1905-11", "--text", "Oheň přešel ze sousedního stavení na č. 9.".normalize("NFD"), "--certainty", "medium", "--source", s1, "--locator", "s. 4", "--url", PDF], AGENT);
    await w.ok(["house", "add", "passed", a, "--source", s1, "--url", PDF, "--found", "yes", "--what", "přečteno: požár 1905 potvrzen, oheň od souseda"], AGENT);
    const h = record(w, a);
    const e1 = h.timeline.find((e) => e.id === "e1")!;
    assert.equal(e1.text, "Oheň přešel ze sousedního stavení na č. 9.".normalize("NFC"));
    assert.equal(e1.certainty, "medium");
    assert.deepEqual(e1.sources, [{ source: s1, page: "s. 4" }, { url: PDF }]);
    assert.equal(h.timeline.filter((e) => e.kind === "fire").length, 2);
    assert.equal(h.holders.find((x) => x.id === "h1")!.origin, "user");
    assert.deepEqual(validateRecord(h), []);
    // n1's address does not open: one line, the claim stays as it is
    await w.ok(["house", "add", "passed", a, "--url", RU, "--found", "no", "--what", `nedostupné: ${RU}, 2026-11-27`], AGENT);
    assert.equal(record(w, a).numbers.find((n) => n.id === "n1")!.certainty, "medium");
    assert.deepEqual(claims(), []);
    assert.deepEqual(houseDoneLacks(open(w), open(w).get<Task>(t.id)!), []);
    await w.ok(["session", "close", "--done", "dům prošel", "--next", "další dům"], AGENT);
    assert.equal(open(w).get<Task>(t.id)!.state, "done");
    // nothing raised besides: no task, no question (its look none: no task of its look either)
    assert.deepEqual(houseTasks(w).map((x) => x.id).sort(), before);
    assert.ok(!open(w).list<Task>("task").some((x) => x.state === "waiting"));
  } finally {
    w.cleanup();
  }
});

test("no more of its look automatically gone once it holds no more (N5): another check, or material given after; the person's word stays", opts, async () => {
  const w = new World();
  try {
    const a = await village(w);
    const t = houseTasks(w).find((x) => x.origin === `house:${a}`)!;
    const looks = () => record(w, a).unknown.filter((u) => u.about === "look").map((u) => [u.text, u.origin]);
    // no more automatically, the house's research done; material given after: a task of its look, its check says so,
    // the research's "no more" gone
    await w.ok(["house", "add", "unknown", a, "--look", "--text", "podoba nezjištěna"], AGENT);
    await w.ok(["house", "add", "look-check", a, "--next", "none", "--text", "keine"], AGENT);
    assert.deepEqual(looks(), [["podoba: víc automaticky nejde – keine", "research"]]);
    await w.ok(["house", "add", "passed", a, "--checklist", "--what", "prošlo: ortofoto"], AGENT);
    await w.ok(["task", "done", t.id, "--result", "dům prošel"], AGENT);
    const given = (await w.ok(["house", "add", "material", a, "--memory", "Fotka statku z roku 1930.", "--json"])).json;
    assert.equal(houseWork(open(w).get<Task>(given.task)!), "look");
    const h = record(w, a);
    assert.deepEqual(looks(), []);
    assert.equal(h.lookCheck?.next, "material");
    assert.deepEqual(validateRecord(h), []);
    const shown = (await w.ok(["house", "show", a, "--lang", "cs"])).out;
    assert.doesNotMatch(shown, /víc automaticky nejde/u);
    assert.match(shown, /k domu přibyl materiál po jeho rešerši/u);

    // none again; then a picture seems to show it after all: the research's "no more" gone, the person's word kept
    await w.ok(["house", "add", "look-check", a, "--next", "none", "--text", "nic dalšího"], AGENT);
    await w.ok(["house", "add", "unknown", a, "--look", "--text", "fotka u tety Lhotákové".normalize("NFD")]);
    assert.deepEqual(looks(), [["podoba: víc automaticky nejde – nic dalšího", "research"], ["fotka u tety Lhotákové", "user"]]);
    await w.ok(["house", "add", "look-check", a, "--next", "picture", "--text", "obrázek návsi ukazuje č. 9"], AGENT);
    assert.deepEqual(looks(), [["fotka u tety Lhotákové", "user"]]);
    const cs = (await w.ok(["house", "show", a, "--lang", "cs"])).out;
    assert.doesNotMatch(cs, /víc automaticky nejde/u);
    assert.match(cs, /Další o podobě\n {2}obrázek obce: obrázek návsi ukazuje č\. 9/u);
  } finally {
    w.cleanup();
  }
});
