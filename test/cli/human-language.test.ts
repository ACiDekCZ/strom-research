// What a person reads in a Czech or German research is Czech or German: the results of what they decide, the errors
// of what they typed, the commands strom suggests with their placeholders — no English line among them (found on Mac:
// "X0001 resolved — the user's edit taken", "error: no person P0099", "chybí <input>", "<research name>" in Czech).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

// English words no Czech or German text of strom's has (their own — was, die, Name, Person, Option, argument — left out)
const ENGLISH = new Set(
  ("the is are of and or not no with without missing required unexpected resolved taken written error quote values " +
    "spaces given surname research input nothing unknown found matches needs takes value folder file setting merged " +
    "into conflict family source task still open close them first next yet you your this that there here which " +
    "when options edit user").split(" "),
);
const ENGLISH_IN = { cs: new Set([...ENGLISH, "name", "person", "option"]), de: ENGLISH };

const words = (s: string) => s.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);

/** The English of a line a person reads: its placeholders whole, the rest with the commands it names left out. */
function english(line: string, lang: "cs" | "de"): string[] {
  const known = ENGLISH_IN[lang];
  const said = [...line.matchAll(/<([^<>]+)>/g)].flatMap((m) => words(m[1]!)).filter((w) => known.has(w));
  const prose = line
    .replace(/<[^<>]+>/g, " ")
    .replace(/\bstrom\b[^—·();]*?(?= — | · | \(|\)|;|$)/g, " ")
    .replace(/--[\p{L}\p{N}-]+/gu, " ")
    .replace(/\b[A-Z]\d{4,}\b/g, " ");
  return [...said, ...words(prose).filter((w) => known.has(w))];
}

/** Every line of what a person read with English in it, the command it came from before it. */
function englishLines(said: { cmd: string; text: string }[], lang: "cs" | "de"): string[] {
  return said.flatMap(({ cmd, text }) =>
    text
      .split("\n")
      .filter((l) => english(l, lang).length)
      .map((l) => `${lang} strom ${cmd}: ${l}  [${english(l, lang).join(", ")}]`),
  );
}

const ged = (lines: string[]) => [...lines, "0 TRLR", ""].join("\n");
const head0 = ["0 HEAD", "1 SOUR STROM", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8"];
const people = (sex: string) => [
  "0 @I1@ INDI", "1 NAME Karel /Dvořák/", `1 SEX ${sex}`, "1 BIRT", "2 DATE 1870", "1 FAMS @F1@",
  "0 @I2@ INDI", "1 NAME Marie /Dvořáková/", "1 SEX F", "1 FAMS @F1@",
  "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@",
];

for (const lang of ["cs", "de"] as const) {
  test(`a person reads ${lang === "cs" ? "Czech" : "German"}: results, errors and the commands suggested, no English line`, opts, async () => {
    const w = new World();
    w.env.LANG = lang === "cs" ? "cs_CZ.UTF-8" : "de_DE.UTF-8";
    const said: { cmd: string; text: string }[] = [];
    const run = async (args: string[], env?: Record<string, string>, tty = false, answers?: string[]) => {
      const r = await w.run(args, { ...(env ? { env } : {}), tty, ...(answers ? { answers } : {}) });
      said.push({ cmd: args.join(" "), text: r.out + r.err });
      return r;
    };
    await w.ok(["setup", "--yes"]);
    w.historyAsked();
    await run(["init", "Dvořákovi"]);
    w.cwd = w.treeDir("Dvořákovi");
    await run([]);
    // the tree the Strom app gave, a record proving Karel's facts, the app's copy with another sex: a conflict
    const file = path.join(w.dir, "adopt.ged");
    fs.writeFileSync(file, ged([...head0, ...people("M")]));
    await w.ok(["sync", file, "--apply", "--force"]);
    const s = (await w.ok(["source", "add", "Křest Karla Dvořáka 1870", "--kind", "baptism", "--locator", "fol. 3", "--json"])).json;
    await w.ok(["event", "add", "P0001", "CHR", "--date", "1870", "--cite", (s.id ?? s.source?.id) as string, "--status", "probable"]);
    const tree = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
    const headNow = execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
    const refn = people("F").flatMap((l) => {
      const m = /^0 @I(\d+)@ INDI$/.exec(l);
      return m ? [l, `1 REFN P000${m[1]}`, "2 TYPE strom-research"] : [l];
    });
    const send = path.join(w.dir, "send.ged");
    fs.writeFileSync(send, ged([...head0, `1 _STROM_TREE ${tree}`, `1 _STROM_HEAD ${headNow}`, ...refn]));
    const sent = await run(["sync", send, "--apply"]);
    assert.equal(sent.code, 0, sent.err);
    const x = (await w.ok(["conflict", "list", "--json"])).json.conflicts[0].id as string;
    await run(["conflict", "list"]);
    await run(["conflict", "show", x]);
    // what is missing said exactly, then the user's side taken
    await run(["conflict", "resolve", x]);
    const noWhy = await run(["conflict", "resolve", x, "--take", "user"]);
    assert.match(noWhy.err, /--reasoning/);
    assert.doesNotMatch(noWhy.err, /--resolution/, "the side taken gives the resolution: only --reasoning is missing");
    await run(["conflict", "resolve", x, "--reasoning", "rodina"]);
    // decided through the agent of the conversation: the user's decision, said in their language all the same
    const took = await run(["conflict", "resolve", x, "--take", "user", "--reasoning", "rodina to ví"], { CLAUDECODE: "1" });
    assert.equal(took.code, 0, took.err);
    // a conflict of no edit of the app
    const y = (await w.ok(["conflict", "add", "Dvě data křtu", "--about", "P0001", "--claim", `${(s.id ?? s.source?.id) as string}: 1870`, "--claim", `${(s.id ?? s.source?.id) as string}: 1871`, "--json"])).json.conflict.id as string;
    await run(["conflict", "resolve", y, "--take", "user", "--reasoning", "rodina"]);
    await run(["conflict", "resolve", y, "--reasoning", "rodina"]);
    // a person and a family looked at in the terminal: their headings, facts, roles and relations in the language
    // (found on Mac: "names", "facts", "family" in a Czech research)
    const e = (await w.ok(["person", "show", "P0001", "--json"])).json.person.events.find((x: { kind: string }) => x.kind === "CHR").id as string;
    await w.ok(["event", "edit", e, "--age", "3 dny", "--with", "godparent:Jan Kmotr", "--house", "12", "--place", "Kamenice"]);
    await w.ok(["name", "add", "P0001", "Carolus /Dvořák/", "--kind", "religious"]);
    const shown = await run(["person", "show", "P0001"], undefined, true);
    assert.equal(shown.code, 0, shown.err);
    assert.match(shown.out, lang === "cs" ? /^údaje$/m : /^Angaben$/m);
    assert.equal((await run(["family", "show", "F0001"], undefined, true)).code, 0);
    // an agent reads the English it knows
    assert.match((await w.ok(["person", "show", "P0001"], { tty: true, env: { CLAUDECODE: "1" } })).out, /^facts$/m);
    // Ctrl-C at a question: stopped, nothing changed — calmly, in the language, never "that did not work" (found on Mac:
    // "Tohle se nepovedlo: Aborted with Ctrl+C")
    const calm = lang === "cs" ? /Zrušeno, nic se nezměnilo\./ : /Abgebrochen, nichts wurde geändert\./;
    const failed = lang === "cs" ? /nepovedlo/ : /ging nicht/;
    await w.ok(["mode", "archive"], { tty: true });
    const atItem = await run(["menu"], undefined, true, ["1", "\u0003", "0"]);
    assert.match(atItem.out, calm, atItem.out);
    assert.doesNotMatch(atItem.out + atItem.err, failed);
    assert.equal(JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).mode, "archive", "nothing changed");
    const atMenu = await run(["menu"], undefined, true, ["\u0003"]);
    assert.equal(atMenu.code, 130, atMenu.out + atMenu.err);
    assert.match(atMenu.err, calm);
    await w.ok(["mode", "research"], { tty: true });
    const inSubmenu = await run(["menu"], undefined, true, ["4", "1", "\u0003", "0", "0"]);
    assert.match(inSubmenu.out, calm);
    assert.doesNotMatch(inSubmenu.out + inSubmenu.err, failed);
    // a command strom does not know, typed at a terminal: said in the language, the person's help or the menu offered
    // (found on Mac: "error: unknown command … → strom help (all commands)"); an agent pointed at its catalog
    const typo = await run(["nesmysl"], undefined, true);
    assert.equal(typo.code, 2);
    assert.match(typo.err, /strom help --human/);
    const typoAgent = await w.run(["nesmysl"], { tty: true, env: { CLAUDECODE: "1" } });
    assert.match(typoAgent.err, /→ strom help {3}\(/);
    assert.doesNotMatch(typoAgent.err, /--human/);
    // the agent's help at a person's terminal ends with one line of theirs: how to get their own
    const help = (await w.run(["help"], { tty: true })).out;
    assert.match(help, lang === "cs" ? /\nNápověda výše je pro agenta\. Nápověda pro člověka v češtině: strom help --human\n$/ : /\nDie Hilfe oben liest ein Agent\. Hilfe für Menschen auf Deutsch: strom help --human\n$/);
    assert.doesNotMatch((await w.run(["help"], { tty: true, env: { CLAUDECODE: "1" } })).out, /--human/, "an agent: none");
    // what a person may mistype
    for (const args of [["person", "show", "P0099"], ["person", "show", "Nikdo"], ["conflict", "show", "X0099"], ["family", "show", "F0099"], ["task", "show", "T0099"], ["source", "show", "S0099"], ["person", "card", "P0099"], ["person", "show"], ["live", "status"], ["sync", "undo"], ["sync", "undo", "I0099"], ["event", "edit", e, "--date", "1871"], ["event", "edit", e, "--status", "possible", "--place", "Lhota"], ["event", "retract", e], ["person", "edit", "P0001", "--sex", "M"], ["person", "retract", "P0002"], ["person", "merge", "P0001", "P0002"], ["person", "add", "--name", "Jan"], ["person", "list", "--bogus"], ["person", "list", "--full=1"], ["person", "list", "--research"], ["conflict", "list", "--al"]])
      assert.notEqual((await run(args)).code, 0, args.join(" "));
    assert.deepEqual(englishLines(said, lang), []);
    w.cleanup();
  });
}

test("an unknown option of strom itself (strom --bogus) is said in the research language, with the help to read — English for the agent's --json as ever", opts, async () => {
  const w = new World();
  for (const [lang, said] of [["cs", /^chyba: neznámá volba --bogus u strom\n→ strom help\n$/], ["de", /^Fehler: unbekannte Option --bogus für strom\n→ strom help\n$/], ["en", /^error: unknown option --bogus for strom\n→ strom help\n$/]] as const) {
    const r = await w.run(["--bogus"], { env: { STROM_LANG: lang } });
    assert.equal(r.code, 2);
    assert.match(r.err, said, `${lang}: ${r.err}`);
  }
  const j = await w.run(["--bogus", "--json"], { env: { STROM_LANG: "cs" } });
  assert.equal(j.json.code, "option.unknown.none");
  assert.equal(j.json.message, "unknown option --bogus for strom");
});

test("an error an agent reads is English whatever the research's language; a person reads it in the research's", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Týnec N 1784–1820", "--kinds", "baptism"]); // B0001
  // the mistakes found in an agent's session of a Czech research (an option a command has not, a second argument)
  const mistakes = [
    { args: ["recordset", "show", "B0001", "--bogus"], en: /^error: unknown option --bogus for strom recordset show\n→ options: /m, cs: /^chyba: neznámá volba --bogus u strom recordset show\n→ volby: /m },
    { args: ["conflict", "list", "P0021"], en: /^error: unexpected argument "P0021"/m, cs: /^chyba: nečekaný argument „P0021“/m },
    { args: ["person", "show", "P0099"], en: /^error: (no person|not found)/m, cs: /^chyba: /m },
  ];
  for (const agent of [{ CLAUDECODE: "1" }, { STROM_SESSION: "N0001" }, { CODEX_SANDBOX: "seatbelt" }] as Record<string, string>[]) {
    for (const m of mistakes) {
      const r = await w.run(m.args, { env: { STROM_LANG: "cs", ...agent } });
      assert.notEqual(r.code, 0, m.args.join(" "));
      assert.match(r.err, m.en, `${JSON.stringify(agent)} ${m.args.join(" ")}: ${r.err}`);
      assert.doesNotMatch(r.err, /chyba|neznámá|nečekaný|→ .*[ěščřžýáíéůú]/u, `${JSON.stringify(agent)}: ${r.err}`);
    }
  }
  // a person without an agent: the research's language, as ever (a terminal or not)
  for (const tty of [false, true]) {
    for (const m of mistakes) {
      const r = await w.run(m.args, { env: { STROM_LANG: "cs" }, tty });
      assert.match(r.err, m.cs, `tty ${tty} ${m.args.join(" ")}: ${r.err}`);
    }
  }
  // a dry run's last line: English for an agent, the research's language for a person
  const dry = ["person", "add", "Jan /Dvořák/", "--dry-run"];
  assert.match((await w.ok(dry, { env: { STROM_LANG: "cs", CLAUDECODE: "1" } })).out, /^Dry run \(--dry-run\): nothing was written/m);
  assert.match((await w.ok(dry, { env: { STROM_LANG: "cs" } })).out, /^Nanečisto \(--dry-run\): nic se nezapsalo/m);
  // a program reads the English and the code, agent or not
  const j = await w.run(["recordset", "show", "B0001", "--bogus", "--json"], { env: { STROM_LANG: "cs" } });
  assert.equal(j.json.message, "unknown option --bogus for strom recordset show");
  w.cleanup();
});

test("the word before an error is in the language of the words after it: an error strom says only in English keeps \"error:\" in a Czech or German research, never \"chyba:\" before English", opts, async () => {
  const w = new World();
  await w.withTree();
  for (const lang of ["cs", "de", "en"] as const) {
    const r = await w.run(["hypothesis", "add", "Kdo byl otcem Šárky?", "--variant", "A: Jiří Dvořák"], { env: { STROM_LANG: lang } });
    assert.equal(r.code, 2, `${lang}: ${r.err}`);
    assert.match(r.err, /^error: a hypothesis needs at least two --variant$/m, `${lang}: ${r.err}`);
    assert.doesNotMatch(r.err, /^(chyba|Fehler):/m, `${lang}: ${r.err}`);
  }
  // an error said in the research language: its word too
  const cs = await w.run(["person", "show", "P0099"], { env: { STROM_LANG: "cs" } });
  assert.match(cs.err, /^chyba: /, cs.err);
  assert.doesNotMatch(cs.err.split("\n")[0]!, /no person|not found/, cs.err);
  w.cleanup();
});

test("person list --unproven, the summary of export gedcom and check's counter warning: the research's language for a person, English for an agent; English counts 1 source, 2 sources (found on Windows in a Czech research)", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jiří /Dvořák/", "--sex", "M"]); // P1, no record
  await w.ok(["person", "add", "Анна /Иванова/", "--sex", "F"]); // P2
  const s = (await w.ok(["source", "add", "Křest Anny 1870", "--kind", "baptism", "--locator", "fol. 3", "--json"])).json;
  await w.ok(["event", "add", "P2", "CHR", "--date", "1870", "--cite", (s.id ?? s.source?.id) as string]);
  const agent = { CLAUDECODE: "1" };
  const said: { cmd: string; text: string }[] = [];
  const person = async (args: string[]) => {
    const r = await w.ok(args);
    said.push({ cmd: args.join(" "), text: r.out });
    return r.out;
  };

  // the list strom check points a person to
  const list = await person(["person", "list", "--unproven"]);
  assert.match(list, /^Bez vlastního záznamu: 1 — jmenuje je jiný záznam: 0 · jen vodítka: 0 · bez záznamu: 1\n/, list);
  assert.match(list, /P0001 +Jiří Dvořák +bez záznamu +bez poznámky, odkud je/);
  assert.match(list, /\núkoly pro ně: strom review --unproven/);
  const listAgent = (await w.ok(["person", "list", "--unproven"], { env: agent })).out;
  assert.match(listAgent, /^1 without a record of their own — named in a record: 0 · leads only: 0 · no record: 1\n/, listAgent);
  assert.match(listAgent, /P0001 +Jiří Dvořák +no record +no note where from/);
  assert.match(listAgent, /\ntasks for them: strom review --unproven/);

  // what an export wrote, its counts in the language's forms
  const ged = await person(["export", "gedcom", "--for", "standard"]);
  assert.match(ged, /\(standardní, pro jakýkoli program\) — 2 osoby · 0 rodin · 1 údaj · 1 pramen\n {2}platný GEDCOM 5\.5\.1/, ged);
  const gedAgent = (await w.ok(["export", "gedcom", "--for", "standard"], { env: agent })).out;
  assert.match(gedAgent, /\(standard, any program\) — 2 persons · 0 families · 1 fact · 1 source\n {2}valid GEDCOM 5\.5\.1/, gedAgent);
  // the research written since: committed
  await w.ok(["person", "add", "Marie /Dvořáková/", "--sex", "F"]);
  assert.match(await person(["export", "gedcom", "--for", "standard"]), /\nzapsáno do historie$/m);
  await w.ok(["person", "add", "Petr /Dvořák/", "--sex", "M"]);
  assert.match((await w.ok(["export", "gedcom", "--for", "standard"], { env: agent })).out, /\ncommitted$/m);

  // a counter behind the IDs on disk (a write a held file stopped on Windows): a warning, said in the language
  const counters = path.join(w.cwd, "data", "_counters.json");
  fs.writeFileSync(counters, JSON.stringify({ ...JSON.parse(fs.readFileSync(counters, "utf8")), P: 1 }));
  const check = (await w.run(["check"])).out;
  said.push({ cmd: "check", text: check });
  assert.match(check, /counter +P0002 +počítadlo P zaostává za existujícími čísly \(srovná se samo při příštím zápisu\)/, check);
  const checkAgent = (await w.run(["check"], { env: agent })).out;
  assert.match(checkAgent, /counter +P0002 +counter P is behind existing IDs \(it self-heals on next write\)/, checkAgent);
  const json = (await w.run(["check", "--json"])).json;
  assert.equal(json.findings.find((f: { code: string }) => f.code === "counter").message, "counter P is behind existing IDs (it self-heals on next write)");
  assert.deepEqual(englishLines(said, "cs"), []);

  // English: 1 source, 2 sources — never "1 sources"
  await w.ok(["lang", "en"]);
  assert.match((await w.ok(["export", "gedcom", "--for", "standard"])).out, / — 4 persons · 0 families · 1 fact · 1 source\n/);
  await w.ok(["source", "add", "Křest Jiřího 1868", "--kind", "baptism", "--locator", "fol. 2"]);
  assert.match((await w.ok(["export", "gedcom", "--for", "standard"])).out, / — 4 persons · 0 families · 1 fact · 2 sources\n/);
  w.cleanup();
});
