// A smaller brief that keeps what identifies people (K5/P3), the premise of the task's places and years (K11), the
// lessons of the task's families and places (P3), the commands of its level with their limits (K2/P5), and all the
// method sends the agent for (K6).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, fakeConnector, readJsonFile } from "../helpers.ts";
import "../../src/commands/index.ts";
import { commands, WRITE_OPTIONS } from "../../src/cli/registry.ts";
import { commandSheet } from "../../src/brief/sheet.ts";
import { PROFILES, SELF_READING } from "../../src/agents/profiles.ts";

const opts = { skip: !hasGit };

/** The lines of one section of a brief. */
function section(brief: string, heading: string): string {
  const at = brief.indexOf(heading);
  assert.ok(at >= 0, `no section ${heading}`);
  const rest = brief.slice(at);
  const end = rest.slice(1).search(/\n#{1,2} /u);
  return end < 0 ? rest : rest.slice(0, end + 1);
}

async function family(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "1905"]); // P1
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Svobodová/", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]); // F1
  await w.ok(["person", "add", "Václav /Novák/", "--sex", "M"]); // P4
  await w.ok(["family", "add", "--partner", "P4", "--child", "P2"]); // F2
  await w.ok(["person", "add", "Anna /Nováková/", "--sex", "F"]); // P5
  await w.ok(["family", "child", "F1", "P5"]);
  await w.ok(["person", "add", "Karel /Dvořák/", "--sex", "M"]); // P6, another family of the tree
  await w.ok(["person", "add", "Іван /Шевчук/", "--sex", "M"]); // P7, and one in another script
  await w.ok(["event", "add", "P2", "RESI", "--place", "Lhota", "--house", "12", "--date", "1900"]);
  await w.ok(["event", "add", "P2", "OCCU", "--value", "mlynář", "--date", "1905"]);
  await w.ok(["event", "add", "P4", "OCCU", "--value", "sedlák"]);
  await w.ok(["event", "add", "P4", "RESI", "--place", "Lhota", "--house", "3"]);
  await w.ok(["event", "add", "P3", "RESI", "--place", "Ves"]);
  for (const n of ["první", "druhá", "třetí"]) await w.ok(["note", "add", "P2", `${n}: ${"Josef je mlynář z Lhoty čp. 12, ne jmenovec z Vsi. ".repeat(8)}`]);
  await w.ok(["recordset", "add", "Lhota N 1900-1910", "--places", "Lhota", "--years", "1900-1910", "--access", "online-free"]); // B1
  await w.ok(["task", "add", "Křest Jana Nováka", "--level", "link", "--where", "B1", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]);
  return w;
}

test("brief: the task's person whole, the parents with what identifies them, the others a line each (K5)", opts, async () => {
  const w = await family();
  const people = section((await w.ok(["brief", "T1"])).out, "## People concerned");
  assert.match(people, /\n {2}P0001 Jan Novák \(\*1905\) M\n/);
  // a parent: houses, occupation, parents — and the notes cut short, the rest pointed to
  assert.match(people, /\n {2}P0002 Josef Novák M — father of P0001\n {4}lived: Lhota 12 1900 · occupation: mlynář 1905\n {4}parents: P0004 Václav Novák\n/);
  assert.match(people, /note: druhá: Josef je mlynář[^\n]{250,}…\n/);
  assert.match(people, /\(1 older note: strom person show P0002\)/);
  assert.match(people, /P0003 Marie Svobodová F — mother of P0001\n {4}lived: Ves\n/, "a residence without a house is where she lived");
  // a grandparent and a sister: one line, what tells a namesake apart kept
  assert.match(people, /\n {2}· P0004 Václav Novák M — father of P0002 · lived: Lhota 3 · occupation: sedlák\n/);
  assert.match(people, /\n {2}· P0005 Anna Nováková F — sibling of P0001\n/);
  assert.match(people, /strom person show P… · their life with its records: strom person card P…/);
  assert.doesNotMatch(people, /Karel Dvořák/);
  w.cleanup();
});

test("brief: a search of the surname elsewhere and long before is counted, not listed; lessons of other families stay out (K11, P3)", opts, async () => {
  const w = await family();
  await w.ok(["search", "add", "Křty Novák v Lhotě", "--surname", "Novák", "--place", "Lhota", "--years", "1880-1890", "--method", "index", "--result", "negative"]);
  // a woman's form, decomposed: still the family's (C8), but in another place and two hundred years earlier
  await w.ok(["search", "add", "Oddaní v Brně", "--surname", "Nováková".normalize("NFD"), "--place", "Brno", "--years", "1700-1720", "--method", "index", "--result", "negative"]);
  await w.ok(["lesson", "add", "Novákovi psali jméno i Nowak"]);
  await w.ok(["lesson", "add", "Dvořákovi ze Vsi jsou jiný rod než ti z Lhoty u mlýna"]);
  await w.ok(["lesson", "add", "Шевчуки з Києва — інший рід"]);
  await w.ok(["lesson", "add", "Rejstříky té doby jsou psány latinsky"]);
  const known = section((await w.ok(["brief", "T1"])).out, "## Already known");
  assert.match(known, /Q0001 \[negative\] Křty Novák v Lhotě/);
  assert.doesNotMatch(known, /Oddaní v Brně/);
  assert.match(known, /\+1 search of Novák in other places and years: strom searched Novák/);
  assert.match(known, /Novákovi psali jméno i Nowak/);
  assert.match(known, /Rejstříky té doby jsou psány latinsky/, "a lesson naming no family or place of the tree is for every task");
  // the Dvořák lesson names Lhota too — the task's place: it stays; the Cyrillic family's goes
  assert.match(known, /Dvořákovi ze Vsi/);
  assert.doesNotMatch(known, /Шевчуки/);
  assert.match(known, /lessons about other families and places: 1 — strom lesson list --scope project/);
  w.cleanup();
});

test("brief: a lesson of a family goes with a task that names its names, a look-alike of its person's surname, its book or the material it takes in", opts, async () => {
  const w = await family();
  await w.ok(["person", "add", "Josef /Hrabálek/", "--sex", "M"]); // P8
  await w.ok(["person", "add", "Anna /Hrabánková/".normalize("NFD"), "--sex", "F"]); // P9, decomposed
  await w.ok(["person", "add", "Петро /Кравчук/", "--sex", "M"]); // P10
  await w.ok(["lesson", "add", "Hrabálek a Kraválek se v knize pletou"]);
  await w.ok(["lesson", "add", "Rod Hrabálek z Hájku je jiný než ten z mlýna"]);
  await w.ok(["lesson", "add", "Кравчук пишеться також Krawczuk", "--detail", "Видно в B0001, знімок 4."]);
  await w.ok(["lesson", "add", "Кравчук у книгах буває Кровчук"]);
  await w.ok(["task", "add", "Svědek Kraválek, nebo Novák?", "--level", "verify", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P1"]); // T2
  await w.ok(["task", "add", "Křest Anny", "--level", "link", "--where", "B1", "--why", "a", "--done-when", "b", "--about", "P9"]); // T3
  await w.ok(["task", "add", "Свідок Кровчук чи Кравчик?", "--level", "verify", "--where", "метричні книги", "--why", "a", "--done-when", "b", "--about", "P7"]); // T4
  const known = async (t: string) => section((await w.ok(["brief", t])).out, "## Already known");
  // a name of the lesson the task's own text gives — the family itself not named there
  const t2 = await known("T2");
  assert.match(t2, /Hrabálek a Kraválek se v knize pletou/u);
  assert.doesNotMatch(t2, /Rod Hrabálek z Hájku/u);
  // a look-alike of the surname of the task's person, written decomposed: the same name read otherwise
  const t3 = await known("T3");
  assert.match(t3, /Rod Hrabálek z Hájku/u);
  assert.doesNotMatch(t3, /Kraválek/u, "a name two letters off a short one is another family");
  // the lesson's detail names the task's book
  assert.match(t2, /Кравчук пишеться також Krawczuk/u);
  // another script: the name in the task's text
  const t4 = await known("T4");
  assert.match(t4, /Кравчук у книгах буває Кровчук/u);
  assert.doesNotMatch(t4, /Hrabálek/u);
  // none of it for a task that names none of it
  const t1 = await known("T1");
  assert.doesNotMatch(t1, /Hrabálek|Кравчук у книгах/u);
  // the material an intake task takes in names the family
  const file = path.join(w.home, "pameti.txt");
  fs.writeFileSync(file, "Paměti: rod Hrabálek z Hájku, mlynáři.\n".normalize("NFD"));
  await w.ok(["intake", file]);
  const intake = (await w.ok(["task", "list", "--json"])).json.tasks.find((t: any) => t.level === "intake");
  assert.match(await known(intake.id), /Rod Hrabálek z Hájku/u);
  w.cleanup();
});

test("brief: a connector of the book's archive that only finds books, keeps to the archive's terms or goes through the browser is said as it is — never as none to build", opts, async () => {
  const w = await family();
  const dir = await fakeConnector(w, "hledac");
  const manifest = path.join(dir, "connector.json");
  const m = readJsonFile(manifest);
  const set = (x: Record<string, unknown>) => fs.writeFileSync(manifest, JSON.stringify({ ...m, ...x }, null, 2));
  await w.ok(["recordset", "add", "Hájek N 1780-1800", "--places", "Hájek", "--url", "https://archive.example.org/book/77", "--access", "online-free"]); // B2
  await w.ok(["recordset", "add", "Ves N 1780-1800", "--places", "Ves", "--url", "https://other.example.net/b/1", "--access", "online-free"]); // B3
  await w.ok(["task", "add", "Křest v Hájku", "--level", "link", "--where", "B2", "--why", "a", "--done-when", "b", "--about", "P1"]); // T2
  await w.ok(["task", "add", "Křest ve Vsi", "--level", "link", "--where", "B3", "--why", "a", "--done-when", "b", "--about", "P1"]); // T3
  // it only finds books: the images come by hand
  set({ can: ["find", "list"] });
  let brief = (await w.ok(["brief", "T2"])).out;
  assert.match(section(brief, "## Record sets"), /no images here yet — its connector hledac only finds books and fetches no images — the user saves the images by hand: strom task wait <T…> --images B0002:<numbers>/u);
  assert.doesNotMatch(brief, /no connector for this archive|build one — now, you/u);
  assert.match(brief, /where its connector only finds books[\s\S]*Write `--on` for the user/u);
  // the archive's terms allow no automation
  set({ policy: { automation: "manual" } });
  brief = (await w.ok(["brief", "T2"])).out;
  assert.match(brief, /the archive's terms allow no automation: its connector hledac finds books and gives their links — the user saves the images by hand: strom task wait/u);
  assert.doesNotMatch(brief, /no connector for this archive|build one — now, you/u);
  // through the user's browser: strom fetch plans it, by hand without browser tools
  set({ can: ["find", "list", "locate"], routes: ["browser"] });
  brief = (await w.ok(["brief", "T2"])).out;
  assert.match(section(brief, "## Record sets"), /\n {4}fetch: hledac <book[^\n]*\n {4}through the user's browser: strom plans the requests, an agent's browser tools get the images \(without them the user saves them by hand: strom task wait <T…> --images B0002:<numbers> --on "…"\)/u);
  assert.match(brief, /\*\*No images here yet:\*\* the book's connector fetches them/u);
  assert.doesNotMatch(brief, /no connector for this archive|build one — now, you/u);
  // an archive with none: build one
  const none = (await w.ok(["brief", "T3"])).out;
  assert.match(none, /no images here yet, and no connector for this archive — build one now/u);
  assert.match(none, /The archive has no connector yet: build one — now, you\./u);
  w.cleanup();
});

test("brief: a relative's other names, the day of a birth and a baptism, the start of the last note — namesakes told apart (K5)", opts, async () => {
  const w = await family();
  // the mother's other forms: a spelling with an accent of its own, decomposed, and her married name
  await w.ok(["name", "add", "P3", "Marie /Swobodová/".normalize("NFD")]);
  await w.ok(["name", "add", "P3", "Marie /Nováková/", "--kind", "married"]);
  // the grandfather in one line: another script, the day of his birth and his place
  await w.ok(["name", "add", "P4", "Вацлав /Новак/"]);
  await w.ok(["event", "add", "P4", "BIRT", "--date", "3 MAR 1850", "--place", "Lhota", "--house", "3"]);
  // two sisters of one name: only the day tells them apart, and a short note (the first died young)
  await w.ok(["event", "add", "P5", "BIRT", "--date", "2 FEB 1900", "--place", "Lhota"]);
  await w.ok(["event", "add", "P5", "CHR", "--date", "4 FEB 1900", "--place", "Lhota"]);
  await w.ok(["person", "add", "Anna /Nováková/", "--sex", "F"]); // P8
  await w.ok(["family", "child", "F1", "P8"]);
  await w.ok(["event", "add", "P8", "BIRT", "--date", "9 SEP 1902", "--place", "Lhota"]);
  await w.ok(["note", "add", "P8", `námořník; ${"druhá Anna, ta první zemřela malá. ".repeat(6)}`]);
  const people = section((await w.ok(["brief", "T1"])).out, "## People concerned");
  assert.match(people, /P0003 Marie Svobodová F — mother of P0001\n {4}names: Marie Svobodová; Marie Swobodová; Marie Nováková \(married\)\n/u);
  assert.match(people, /· P0004 Václav Novák \(\*1850\) M — father of P0002 · BIRT 3 MAR 1850 Lhota 3 · also: Вацлав Новак · lived: Lhota 3 · occupation: sedlák\n/u);
  assert.match(people, /· P0005 Anna Nováková \(\*1900\) F — sibling of P0001 · BIRT 2 FEB 1900 Lhota · CHR 4 FEB 1900\n/u, "the baptism's place said once");
  assert.match(people, /· P0008 Anna Nováková \(\*1902\) F — sibling of P0001 · BIRT 9 SEP 1902 Lhota · note: námořník; druhá Anna[^\n]{60,100}…\n/u);
  w.cleanup();
});

test("brief: a task about a family has its partners whole, its children a line each and the records that show it", opts, async () => {
  const w = await family();
  await w.ok(["source", "add", "Oddací zápis Josefa a Marie", "--kind", "marriage"]); // S1
  await w.ok(["cite", "F1", "S1", "--locator", "fol. 7"]);
  await w.ok(["event", "add", "F1", "MARR", "--date", "5 MAY 1899", "--place", "Lhota", "--cite", "S1"]);
  await w.ok(["event", "add", "P1", "CHR", "--date", "1 JAN 1905", "--place", "Lhota"]);
  await w.ok(["task", "add", "Další děti Josefa a Marie", "--level", "enrich", "--where", "B1", "--why", "sourozenci", "--done-when", "kniha prošlá", "--about", "F1"]); // T2
  const people = section((await w.ok(["brief", "T2"])).out, "## People concerned");
  assert.match(people, /\n {2}F0001 family of P0002 Josef Novák & P0003 Marie Svobodová · 2 children\n {4}E\d+ MARR 5 MAY 1899 Lhota \[\w+\] ← S0001\n {4}sources: S0001 fol\. 7\n/u);
  assert.match(people, /\n {2}P0002 Josef Novák M\n {4}E\d+ RESI/u, "a partner whole");
  assert.match(people, /\n {2}P0003 Marie Svobodová F\n/u);
  assert.match(people, /· P0001 Jan Novák \(\*1905\) M — child of F0001 · CHR 1 JAN 1905 Lhota\n/u);
  assert.match(people, /· P0005 Anna Nováková F — child of F0001\n/u);
  assert.match(people, /P0004 Václav Novák M — father of P0002/u, "the partners' parents as for any person");
  w.cleanup();
});

test("brief: a search of the surname in the task's parish is kept whatever its years (K11)", opts, async () => {
  const w = await family();
  await w.ok(["place", "add", "Lhota", "--kind", "village", "--unlocated", "test"]); // L1
  await w.ok(["place", "jurisdiction", "L1", "--kind", "parish", "--name", "Ves"]);
  await w.ok(["search", "add", "Pohřby Nováků ve Vsi", "--surname", "Novák", "--place", "Ves", "--years", "1690-1700", "--method", "index", "--result", "partial"]);
  await w.ok(["search", "add", "Pohřby Nováků v Brně", "--surname", "Novák", "--place", "Brno", "--years", "1690-1700", "--method", "index", "--result", "negative"]);
  const known = section((await w.ok(["brief", "T1"])).out, "## Already known");
  assert.match(known, /Q0001 \[partial\] Pohřby Nováků ve Vsi/u);
  assert.doesNotMatch(known, /Pohřby Nováků v Brně/u);
  assert.match(known, /\+1 search of Novák in other places and years/u);
  w.cleanup();
});

test("brief: the commands of the task's level, every option and limit from the registry (K2/P5)", opts, async () => {
  const w = await family();
  const brief = (await w.ok(["brief", "T1"])).out;
  const sheet = section(brief, "## Commands for this task");
  assert.match(sheet, /strom search add <question ≤300> [^\n]*--result found\|negative\|partial\|inconclusive --found <S…>… \(with --result found\)[^\n]*--note <text ≤500>/);
  assert.match(sheet, /strom task add <what ≤200> --level intake\|locate\|link\|[^\n]*--done-when <text ≤500>/);
  assert.match(sheet, /strom lesson add <rule ≤200>/);
  assert.match(sheet, /strom note add <id> <text ≤500>/);
  // the mistakes that cost a turn most, said once; a command's own, after it
  assert.match(sheet, /^ {2}values with spaces in quotes \(--note "two words"\); a repeatable option once per value \(--found S0001 --found S0002\); a batch file in notes\/: change it with your file-editing tool, not sed$/m);
  // a status: a fact's only, proven only with primary information (N0190, N0191)
  assert.match(sheet, /^ {2}--status is a fact's \(E…\) only, never a name's or a family's; proven only with a record of the time read directly \(--information primary\), else probable$/m);
  assert.match(sheet, /--note <text ≤500> — found: the source first \(in a batch source add … #s, then --found @s\)$/m);
  // every line names a command and only its options
  for (const line of sheet.split("\n").slice(1).filter((l) => l.trim().startsWith("strom "))) {
    const words = line.trim().split(" ");
    const def = commands().find((c) => c.path.every((p, i) => words[i + 1] === p) && words[c.path.length + 1] !== undefined && !/^[a-z]+$/u.test(words[c.path.length + 1]!));
    assert.ok(def, `no command: ${line}`);
    // (what an edit shares with its add is said in brackets, as the add's)
    for (const o of line.replace(/\[[^\]]*'s options[^\]]*\]/u, "").matchAll(/ --([\p{L}-]+)/gu)) {
      if (/^\(with$/u.test(line.slice(0, o.index).split(" ").at(-1) ?? "")) continue;
      assert.ok([...(def.options ?? []), ...WRITE_OPTIONS].some((x) => x.name === o[1]), `${def.path.join(" ")} has no --${o[1]}`);
    }
  }
  // a story task gets its own command, a link task not
  assert.doesNotMatch(sheet, /story set/);
  // a task that writes no facts from records is not told of their status
  assert.doesNotMatch(commandSheet("narrate"), /--status is/);
  assert.match(commandSheet("verify"), /--status is a fact's/);
  w.cleanup();
});

test("brief: what the method used to fetch separately is in it — the task's notes counted, the material whole (K6)", opts, async () => {
  const w = await family();
  for (const n of ["jedna", "dvě", "tři", "čtyři"]) await w.ok(["task", "edit", "T1", "--note", n]);
  const brief = (await w.ok(["brief", "T1"])).out;
  assert.match(brief, /\(notes: the last 3 of 4 — all: strom task show T0001\)/);
  // the method takes the premise from the brief
  assert.doesNotMatch(brief, /Premise:\*\* `strom searched/);
  assert.doesNotMatch(brief, /`strom task show T…`/);
  assert.match(brief, /Check the premise first\.\*\* Before opening anything, read the brief's/);
  // a small text file of the user: its words in the brief, as strom input show gives them
  const file = path.join(w.home, "vzpominky.txt");
  fs.writeFileSync(file, "Děda Jan Novák byl mlynář v Lhotě.\n");
  await w.ok(["intake", file]);
  await w.ok(["input", "amend", "I1", "--person", "P0001", "--note", "od tety"]);
  const task = (await w.ok(["task", "list", "--json"])).json.tasks.find((t: any) => t.level === "intake");
  const material = section((await w.ok(["brief", task.id])).out, "## The material");
  assert.match(material, /text:\nDěda Jan Novák byl mlynář v Lhotě\./);
  assert.match(material, /of: P0001/);
  assert.match(material, /note: od tety/);
  assert.match((await w.ok(["brief", task.id])).out, /The brief's \*The material\* says what each input is/);
  w.cleanup();
});

test("brief: the estimate is real, so the budget holds the brief to its tokens (P3)", opts, async () => {
  const w = await family();
  for (let i = 0; i < 30; i++) await w.ok(["search", "add", `Křty Nováků v Lhotě, ročník ${1900 + (i % 10)}: žádný zápis — přečteno celé`, "--recordset", "B1", "--method", "page-by-page", "--result", "negative"]);
  const b = (await w.ok(["brief", "T1", "--json"])).json;
  const big = (await w.ok(["brief", "T1", "--budget", "1000000", "--json"])).json;
  // Czech text costs more than characters / 3.5
  assert.ok(big.total > Math.ceil(big.text.length / 3.5) * 1.2, `${big.total} for ${big.text.length} characters`);
  // the books to work in are kept before the long list of searches
  const lists = big.sections.filter((s: any) => ["premise", "handover", "people", "open questions"].includes(s.name)).reduce((n: number, s: any) => n + s.tokens, 0);
  const small = (await w.ok(["brief", "T1", "--budget", String(big.total - lists + 60), "--json"])).json;
  assert.deepEqual(small.sections.filter((s: any) => ["premise", "record sets"].includes(s.name)).map((s: any) => [s.name, s.cut]), [["premise", true], ["record sets", false]]);
  assert.ok(b.total <= b.budget);
  w.cleanup();
});

test("brief: a long list of what is already known is cut before the task's people, its last sessions and open questions (P3)", opts, async () => {
  const w = await family();
  for (let i = 0; i < 60; i++) await w.ok(["search", "add", `Křty Nováků v Lhotě, ročník ${1900 + (i % 10)}: žádný zápis — přečteno celé, i rejstřík`, "--recordset", "B1", "--method", "page-by-page", "--result", "negative"]);
  await w.ok(["hypothesis", "add", "Je Josef syn Václava?", "--about", "P1", "--variant", "A: ano", "--variant", "B: ne"]);
  const big = (await w.ok(["brief", "T1", "--budget", "1000000", "--json"])).json;
  const premise = big.sections.find((s: any) => s.name === "premise");
  assert.ok(premise.tokens > 1500, `premise ${premise.tokens}`);
  assert.ok(big.sections.some((s: any) => s.name === "open questions"));
  // room for everything but half of the searches
  const b = (await w.ok(["brief", "T1", "--budget", String(big.total - Math.round(premise.tokens / 2)), "--json"])).json;
  const cut = Object.fromEntries(b.sections.map((s: any) => [s.name, s.cut]));
  assert.equal(cut.premise, true);
  for (const name of ["people", "open questions", "record sets", "method", "commands"]) assert.equal(cut[name], false, `${name} cut`);
  assert.match(section(b.text, "## People concerned"), /\n {2}P0001 Jan Novák \(\*1905\) M\n/);
  // the premise keeps the searches that fit, still where it stands, and points to the rest
  assert.ok(b.text.indexOf("## Already known") < b.text.indexOf("## People concerned"));
  assert.match(section(b.text, "## Already known"), /Q0001 \[negative\][\s\S]*  … cut to fit the brief — see: strom searched B0001\n/);
  assert.ok(b.total <= b.budget, `${b.total} > ${b.budget}`);
  w.cleanup();
});

test("brief: the default budget holds what the old one did, in real tokens (P3)", async () => {
  const { DEFAULT_BUDGET, tokens } = await import("../../src/brief/brief.ts");
  // 25 000 tokens counted as 3.5 characters each: a brief of that size in Czech (its lists Czech, its method English)
  // is not cut now
  const cz = "Křest Jana Nováka v Lhotě čp. 12, otec Josef mlynář, matka Marie Svobodová; Q0001 [negative] B0001 1900–1910\n";
  const en = "- Read the whole entry before recording anything; cite the image and the page: strom search add … --result negative\n";
  const part = cz + cz + en;
  const brief = part.repeat(Math.floor((25_000 * 3.5) / part.length));
  assert.ok(brief.length <= 25_000 * 3.5 && brief.length > 25_000 * 3.4);
  assert.ok(tokens(brief) <= DEFAULT_BUDGET, `${tokens(brief)} > ${DEFAULT_BUDGET}`);
});

test("delegation: about ten scans to a delegate, stopped at about 80 views; an agent reading alone writes down after 80", () => {
  const claude = PROFILES.claude!.instructions({});
  assert.match(claude, /About ten scans \(images B…:n\) per delegate, never more than twelve; it opens\n {2}as many halves and crops of them as reading needs, but tell it to stop at\n {2}about 80 views and return what it has: every view stays in its context to\n {2}the end\./);
  assert.doesNotMatch(claude, /paid for again on every turn/);
  assert.match(SELF_READING, /after about 80\nviews, write down what you found and go on/);
  for (const id of ["codex", "antigravity", "opencode", "grok"]) assert.match(PROFILES[id]!.instructions({}), /after about 80/);
});
