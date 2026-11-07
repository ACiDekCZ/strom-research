// A source read again from its original as well as can be (spec 059 P6, K6.2, K6.3, K6.6, K6.10): its readers told what
// the research knows of the record — never its transcript nor a name — and a GPT reader that the entry is the one in
// the middle of the excerpt and to keep its spelling letter by letter; the reading held against the transcript only with
// the entry that is the source's (source.entries: the one its reader marked, else the one most within the excerpt),
// with no noise (a column's label, a note of the research's own, nothing against a mark it cannot be read, words
// outside what both read); the blind reader's own text in the result (blind), the kinds of record the two read where
// they differ (readers.kinds), and a comparison that could not be written said (source.failed), never hidden.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World } from "../helpers.ts";
import { opts, world } from "./excerpts.helpers.ts";
import { now, Tree } from "../../src/core/tree.ts";
import { compareWithSource } from "../../src/core/sourceread.ts";
import { aboutFor, compareReadings, docPrompt, parseDocReport, type DocEntry } from "../../src/core/document.ts";
import { locatorOf } from "../../src/commands/document.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import { gptReader } from "../../src/agents/images.ts";
import type { Source } from "../../src/core/model.ts";

const FIXTURE = path.join(import.meta.dirname, "..", "fixtures", "readings", "document-source-neighbours.md");

// the research's transcript of the entry in the middle (a made-up one): column labels, a note of its own in brackets,
// letters added within a word, the year and month of the page's heading above the excerpt
const TRANSCRIPT = "Anno 1850 Mense Majo | Dies: 3. | Kind: Vojtěch Lhoták [Taufe daheim] | Vater: Jiří Lhoták, Häusler in Lhota Nr. 5 | Mutter: Ludmila geb. Lhot[a] | Gevatter: Petr Lhota, Müller";

const r = (...xs: string[]) => ({ entries: xs.map((transcript, i) => ({ id: `e${i + 1}`, transcript })) }) as never;
const CLIPS = [{ media: "M0001", region: { x: 0.1, y: 0.4, w: 0.6, h: 0.2 } }];

test("K6.2: the readers of a source told what the research knows of it — no transcript, no name — the entry in the middle, the spelling kept; the mark parsed", () => {
  const p = docPrompt({ pages: [], report: "r.md", lang: "cs", source: { kind: "baptism", language: "de", date: "1850", locator: "Buch 5, fol. 12", cut: true, spelling: true } });
  for (const line of ["THIS RECORD", "- kind: baptism", "- language: de", "- date: 1850", "- where it stands: Buch 5, fol. 12", "the entry to transcribe is the one in the middle of the view", 'add the line "this: yes"', "Keep the original spelling letter by letter"]) assert.ok(p.includes(line), line);
  assert.match(p, /^this: yes — only on the entry in the middle of the view/mu);
  // the whole image read (no excerpt): nothing of a middle, nor of the mark
  const whole = docPrompt({ pages: [], report: "r.md", lang: "cs", source: { kind: "baptism", spelling: true } });
  assert.ok(whole.includes("Keep the original spelling") && !whole.includes("this: yes") && !whole.includes("in the middle"));
  // the entry in the middle and the spelling kept letter by letter told a GPT reader alone: Claude read worse with them
  // (a long s, the marks of abbreviations it wrote where the transcript has neither); what is known of the record told all
  const about = { kind: "baptism", language: "de", date: "1850", locator: "Buch 5, fol. 12", cut: true };
  assert.deepEqual(aboutFor(about, "codex", "gpt-6-astra"), { ...about, spelling: true });
  assert.deepEqual(aboutFor(about, "opencode", "openai/gpt-6"), { ...about, spelling: true });
  for (const [a, m] of [["claude", "opus"], ["claude", undefined], ["opencode", "anthropic/claude-opus"], ["grok", undefined], ["script", undefined]] as const) assert.deepEqual(aboutFor({ ...about, spelling: true }, a, m), { kind: "baptism", language: "de", date: "1850", locator: "Buch 5, fol. 12" }, a);
  const claude = docPrompt({ pages: [], report: "r.md", lang: "cs", source: aboutFor(about, "claude", "opus") });
  for (const line of ["THIS RECORD", "- kind: baptism", "- language: de", "- date: 1850", "- where it stands: Buch 5, fol. 12"]) assert.ok(claude.includes(line), line);
  assert.ok(!claude.includes("Keep the original spelling") && !claude.includes("a long s") && !claude.includes("in the middle") && !claude.includes("this: yes"));
  assert.match(claude, /its own language and spelling, abbreviations as written/u, "the format says it as ever");
  assert.deepEqual(
    [["codex", undefined], ["codex", "gpt-6-astra"], ["opencode", "openai/gpt-6"], ["opencode", "GPT-6"], ["opencode", "anthropic/claude-opus"], ["claude", "opus"], ["claude", undefined], ["grok", "grok-5"], ["agy", undefined], [undefined, undefined]].map(([a, m]) => gptReader(a, m)),
    [true, true, true, true, false, false, false, false, false, false],
  );
  // a document read for itself: as before
  const plain = docPrompt({ pages: [], report: "r.md", lang: "cs" });
  assert.ok(!plain.includes("THIS RECORD") && !plain.includes("Keep the original spelling") && !plain.includes("this: yes"));
  // the mark as a reader writes it
  const read = parseDocReport(fs.readFileSync(FIXTURE, "utf8"));
  assert.deepEqual(read.entries.map((e) => !!e.this), [false, true, false]);
  // a locator repeats no word of the transcript (a name), however composed, any script; numbers stay
  assert.equal(locatorOf({ locator: "Kniha 5, fol. 12, Vojtěch Lhoták".normalize("NFD"), transcript: "Vojtěch Lhoták z Lhoty" }), "Kniha 5, fol. 12, …");
  assert.equal(locatorOf({ locator: "Книга 3, л. 7 — Лхотак", transcript: "Войтех Лхотак" }), "Книга 3, л. 7 — …");
  assert.equal(locatorOf({ locator: "Lhoták", transcript: "Lhoták" }), undefined);
  assert.equal(locatorOf({ locator: "  ", transcript: "x" }), undefined);
});

test("K6.3: the transcript against the reading of its entry — no label alone, no note of the research's, nothing against a mark, nothing outside what both read", () => {
  const read = parseDocReport(fs.readFileSync(FIXTURE, "utf8"));
  const entries = read.entries.map((e, i) => ({ id: `e${i + 1}`, transcript: e.transcript }));
  // the entry of the source alone: one place differs, however composed
  const mine = { entries, source: { entries: ["e2"] } } as never;
  assert.deepEqual(compareWithSource({ transcript: TRANSCRIPT.normalize("NFD"), clips: CLIPS }, mine), { agree: "differ", variants: [{ at: "Ludmila", other: "Lidmila" }] });
  // all entries of the excerpt together (a reading before strom told them apart): its neighbours count
  assert.ok(compareWithSource({ transcript: TRANSCRIPT, clips: CLIPS }, { entries } as never).variants.length > 1);
  // a label, a note, a mark: one at a time, any script
  const same = (t: string, x: string, clips = true) => compareWithSource({ transcript: t, ...(clips ? { clips: CLIPS } : {}) }, r(x)).variants;
  assert.deepEqual(same("Отец: Иржи Лхотак", "Иржи Лхотак", false), []);
  assert.deepEqual(same("Иржи Лхотак", "Hat getauft: Иржи Лхотак", false), [], "a label of the reader's alone");
  assert.deepEqual(same("Vater: Jiří Lhoták", "Vater Jiří Lhoták", false), [], "a label both wrote");
  assert.deepEqual(same("Jiří Lhoták (viz fol. 3) z Lhoty", "Jiří Lhoták z Lhoty", false), [], "a note in parentheses");
  assert.deepEqual(same("Jiří Lhoták (Häusler) z Lhoty", "Jiří Lhoták Häusler z Lhoty", false), [], "parentheses the reading has the words of");
  assert.deepEqual(same("Jiří Lhoták z Lhoty", "Jiří Lhoták [...] z Lhoty", false), [], "nothing against a mark");
  assert.deepEqual(same("Jiří Lhoták [?] z Lhoty", "Jiří Lhoták z Lhoty", false), [], "an unsure mark is no word");
  assert.deepEqual(same("Lhotá[ka] Jiří", "Lhotá Jiří", false), [{ at: "Lhotá[ka]", other: "Lhotá" }], "letters added within a word stay");
  assert.deepEqual(same("Jiří Lhoták [Lhota] z Lhoty", "Jiří Lhoták z Lhoty", false), [], "a note in brackets");
  assert.deepEqual(same("Jiří Lhoták z Lhoty", "[col. 2:] Jiří Lhoták [col. 3, the line „Lhota“:] z Lhoty", false), [], "a reader's own notes");
  assert.deepEqual(same("Joſef Lhoták 1ª", "Josef Lhoták 1a", false), [], "a letter's other shape is the letter");
  // a label the reading wrote as one word, the transcript apart in its running text (æ as ae too): no label without its
  // counterpart, no difference — however composed, any script
  assert.deepEqual(same("ambo Lhotenses. In præsent: Petri Lhoták ex Lhota", "ambo Lhotenses: | Inpraesent: Petri Lhoták ex Lhota", false), [], "a label written together");
  assert.deepEqual(same("ambo Lhotenses: | Inpraesent: Petri Lhoták".normalize("NFD"), "ambo Lhotenses. In præsent: Petri Lhoták".normalize("NFD"), false), [], "the other way round, decomposed");
  assert.deepEqual(same("при Петре Лхотаке: Иржи", "| ПриПетре Лхотаке: Иржи", false), [], "any script");
  assert.deepEqual(same("ambo In præsent Petri Lhoták", "ambo Inpraesentia Petri Lhoták", false), [{ at: "In præsent", other: "Inpraesentia" }], "other letters still differ");
  assert.deepEqual(same("Petri Lhoták ex Lhota", "| Testes: Petri Lhoták ex Lhota", false), [], "a label alone still goes");
  assert.deepEqual(same("Jiří Lhoták z Lhoty", "Jiří Lhoták z Lhoty Nr.", false), [{ at: "", other: "Nr." }], "read from the whole image: a word at the end counts");
  // at the edge of an excerpt: as many words of each, those nearest what both read — alike written shorter, else they differ
  assert.deepEqual(same("Anno 1850 Mense Majo Lhoták", "Mens. Majo Lhoták"), []);
  assert.deepEqual(same("Anno 1850 Mense Majo Lhoták", "Junio Majo Lhoták"), [{ at: "Mense", other: "Junio" }]);
  assert.deepEqual(same("Lhoták z Lhoty Nr. 5", "Lhoták z Lhoty Nr. 6 Anna Lhotová"), [{ at: "5", other: "6" }]);
  assert.deepEqual(same("Войтех Лхотак", "Войтех Лготак"), [{ at: "Лхотак", other: "Лготак" }], "both sides at the edge differ: read, never outside");
  // the research's own heading of the record (its first line, mostly its locator): its words the reading has not are no difference
  const head = (t: string, x: string, locator?: string) => compareWithSource({ transcript: t, ...(locator ? { locator } : {}) }, r(x)).variants;
  const heading = "Kn. Lhota 12, oddaní, fol. 31 (sn. 64 pravá), Mense Majo [1850], 1. zápis května (3. na straně)\nDies: 8. Jiří Lhoták z Lhoty";
  const loc = "kn. Lhota 12, oddaní fol. 31 (sn. 64 pravá), Mense Majo 1850, 3. zápis strany";
  assert.deepEqual(head(heading, "Mense Majo 8. Jiří Lhoták z Lhoty", loc), [], "a heading: none of its words count");
  assert.deepEqual(head(heading.normalize("NFD"), "Mense Majo 8. Jiří Lhoták z Lhoty", loc.normalize("NFD")), [], "composed or not");
  assert.deepEqual(head(heading, "Mense Majo 8. Jiří Lhoták z Lhoty"), [{ at: "Kn. Lhota 12, oddaní, fol. 31", other: "" }, { at: "1. zápis května", other: "" }], "no locator: as before");
  assert.deepEqual(head("Kn. Лхота 12 fol. 31 зápis\nИржи Лхотак", "Иржи Лхотак", "Kn. Лхота 12, fol. 31"), [], "any script");
  // a first line of the record itself, though it has words of the locator: read as ever
  assert.deepEqual(head("Mense Majo 8. Jiří Lhoták\nz Lhoty", "Mense Majo 9. Jiří Lhoták z Lhoty", loc), [{ at: "8.", other: "9." }]);
  assert.deepEqual(head("Mense Majo 8. Jiří Lhoták z Lhoty Nr. 5\nAnna", "Mense Majo 8. Jiří Lhoták z Lhoty Nr. 6 Anna", loc), [{ at: "5", other: "6" }]);
});

const de = (id: string, page: number, transcript: string, region?: [number, number, number, number]): DocEntry => ({ id, page, transcript, persons: [], events: [], relations: [], ...(region ? { region } : {}) });

test("K6.6: two readers' entries paired by their place where one read the entries beside it too; of each blind entry, the first one's", () => {
  const first = [de("e1", 1, "Petr Lhoták", [0.1, 0.4, 0.6, 0.03]), de("e2", 1, "Vojtěch Lhoták", [0.1, 0.45, 0.6, 0.1]), de("e3", 1, "Anna Lhotová", [0.1, 0.57, 0.6, 0.03])];
  const blind = [de("e1", 1, "Vojtěch Lhoták", [0.1, 0.44, 0.6, 0.11])];
  const c = compareReadings(first, blind);
  assert.deepEqual([...c.of], [[0, "e2"]]);
  assert.deepEqual(c.entries.map((e) => e.agree), ["differ", "same", "differ"]);
  // as many of a page, or a place missing: in their order, as before
  const plain = compareReadings([de("e1", 1, "Petr"), de("e2", 1, "Anna")], [de("e1", 1, "Anna")]);
  assert.deepEqual([...plain.of], [[0, "e1"]]);
  assert.equal(compareReadings([de("e1", 1, "Petr")], [de("e1", 1, "Petr"), de("e2", 1, "Anna")]).agree, "differ", "an entry only the blind one has");
});

// a reader that writes the report it is given
const READER = `import fs from "node:fs";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
const blind = p.includes("This is a BLIND reading");
const body = fs.readFileSync(blind ? process.env.DOC_BLIND : process.env.DOC_FIRST, "utf8");
const was = fs.readFileSync(report, "utf8");
fs.writeFileSync(report, was.replace("<!-- next block -->", body.trim() + "\\n<!-- next block -->"));
fs.appendFileSync(process.env.DOC_PROMPTS, p + "\\n=====\\n");
console.log("cost: 0.10");
`;

async function setUp(): Promise<{ w: World; dir: string; prompts: () => string }> {
  const w = await world();
  const dir = path.join(w.dir, "čtenáři ř");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "reader.mjs"), READER);
  fs.copyFileSync(FIXTURE, path.join(dir, "first.md"));
  fs.copyFileSync(FIXTURE, path.join(dir, "blind.md"));
  const log = path.join(dir, "prompts.log");
  Object.assign(w.env, { STROM_RUNNER_SCRIPT: path.join(dir, "reader.mjs"), DOC_FIRST: path.join(dir, "first.md"), DOC_BLIND: path.join(dir, "blind.md"), DOC_PROMPTS: log, STROM_NO_CONVERT: "1" });
  // the source: an excerpt of image 2, its transcript and where it stands as the research wrote them
  await w.ok(["source", "add", "Křest Vojtěcha Lhotáka 1850", "--kind", "baptism", "--recordset", "B1", "--clip", "B1:2@0.1,0.4,0.6,0.2", "--locator", "Kniha N, fol. 12, Vojtěch Lhoták", "--date", "1850"]); // S0001
  const tree = Tree.open(w.cwd, w.env);
  tree.actor = "N0001";
  tree.withTreeLock(() => {
    tree.put({ ...tree.get<Source>("S0001")!, transcript: TRANSCRIPT.normalize("NFC"), updated: now() }, { op: "source.edit", targets: ["S0001"], summary: "S0001 read by the research" });
    tree.commit("S0001 read by the research");
  });
  return { w, dir, prompts: () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "") };
}

test("K6.2–K6.10: a source read again — its entry among its neighbours, held against its transcript alone, the blind reader's text, the kinds; a comparison not written said", opts, async () => {
  const { w, dir, prompts } = await setUp();
  try {
    // the blind reader read the entry in the middle alone, and took it for a marriage
    const blindText = fs.readFileSync(FIXTURE, "utf8").replace("kind: register.baptism", "kind: register.marriage");
    const [, mid] = /(## Entry e2 · page 1[\s\S]*?)\n## Entry e3/u.exec(blindText)!;
    fs.writeFileSync(path.join(dir, "blind.md"), `${blindText.split("## Entry e1")[0]!.trim()}\n\n${mid!.replace("e2", "e1").replace("this: yes\n", "").replace("Lidmila", "Ludmila")}\ndone: 1 entries\n`);
    const d = (await w.ok(["document", "read", "--source", "S0001", "--readers", "2", "--agent", "script", "--json"])).json;
    assert.equal(d.state, "done", JSON.stringify(d.checks));
    // what the readers were told: the record's kind, date and where it stands — no transcript, no name, no title
    const p = prompts();
    assert.ok(p.includes("- kind: baptism") && p.includes("- date: 1850") && p.includes("- where it stands: Kniha N, fol. 12, …"), p);
    // no GPT reader: nothing of the entry in the middle nor of the spelling (the format says it), as before
    assert.ok(!p.includes("the entry to transcribe is the one in the middle of the view") && !p.includes("this: yes") && !p.includes("Keep the original spelling"), p);
    for (const secret of ["Ludmila", "Vojtěch", "Lhoták", "Křest", "Häusler"]) assert.ok(!p.includes(secret), secret);
    // the entry its reader marked is the source's; only it held against the transcript
    assert.deepEqual(d.source.entries, ["e2"]);
    assert.deepEqual(d.source.variants, [{ at: "Ludmila", other: "Lidmila", sure: false }]);
    assert.equal(d.source.agree, "differ");
    // the blind reader read as the transcript: the readers disagree there, uncertainty — no task of it
    assert.equal(d.source.task, undefined);
    assert.equal(d.source.failed, undefined);
    // the blind reader's text: its document, its entry, the first one's it was held against
    assert.deepEqual(d.blind.doc.kind, "register.marriage");
    assert.equal(d.blind.entries.length, 1);
    assert.deepEqual([d.blind.entries[0].id, d.blind.entries[0].page, d.blind.entries[0].of], ["b1", 1, "e2"]);
    assert.match(d.blind.entries[0].transcript, /Ludmila geb\. Lhota/u);
    assert.equal(d.blind.entries[0].region.length, 4, "of the whole page");
    assert.deepEqual(d.readers.kinds, { first: "register.baptism", blind: "register.marriage" });
    assert.deepEqual(d.entries.map((e: DocEntry) => e.agree), ["differ", "differ", "differ"]);
    // kept: shown again the same
    const shown = (await w.ok(["document", "show", d.id, "--json"])).json;
    assert.deepEqual([shown.source, shown.blind, shown.readers.kinds], [d.source, d.blind, d.readers.kinds]);
    assert.match((await w.ok(["document", "show", d.id])).out, /^source: S0001 read again from its original \(its entry e2\) — differs from its transcript/mu);
    // the bridge says it knows them; read.lines it does not
    for (const f of ["read.sourceEntry", "read.blindText", "read.kinds"]) assert.ok((BRIDGE_FEATURES as readonly string[]).includes(f), f);
    assert.ok(!(BRIDGE_FEATURES as readonly string[]).includes("read.lines"));

    // no mark: the entry most within the excerpt (its margin left out); one reader, nothing of a blind one
    fs.writeFileSync(path.join(dir, "first.md"), fs.readFileSync(FIXTURE, "utf8").replace("this: yes\n", ""));
    const unmarked = (await w.ok(["document", "read", "--source", "S0001", "--agent", "script", "--json"])).json;
    assert.deepEqual(unmarked.source.entries, ["e2"]);
    assert.deepEqual(unmarked.source.variants, [{ at: "Ludmila", other: "Lidmila" }]);
    assert.equal(unmarked.blind, undefined);
    assert.equal(unmarked.readers.kinds, undefined);

    // the research sealed on another computer this one has not taken over: held against the transcript all the
    // same, said not written — never a reading that looks as if it needed no comparison
    // (this computer's settings and shared images, without the research's seal key)
    const elsewhere = { ...w.env, STROM_CONFIG_DIR: path.join(w.dir, "jiný počítač") };
    fs.cpSync(w.env.STROM_CONFIG_DIR!, elsewhere.STROM_CONFIG_DIR, { recursive: true });
    fs.rmSync(path.join(elsewhere.STROM_CONFIG_DIR, "keys"), { recursive: true, force: true });
    const reads = () => fs.readdirSync(path.join(w.cwd, ".strom", "reads")).filter((f) => f.endsWith(".json"));
    const had = new Set(reads());
    const run = await w.run(["document", "read", "--source", "S0001", "--agent", "script", "--json"], { env: elsewhere });
    // the reading ended; the command says what stops writing it (the person's: strom seal adopt)
    assert.equal(run.json.code, "seal.foreign", run.out);
    const id = reads().find((f) => !had.has(f))!.replace(/\.json$/u, "");
    const failed = JSON.parse(fs.readFileSync(path.join(w.cwd, ".strom", "reads", `${id}.json`), "utf8"));
    assert.equal(failed.state, "done");
    assert.equal(failed.source.failed?.code, "write", JSON.stringify(failed.source));
    assert.match(failed.source.failed.why, /sealed on another computer/u);
    assert.deepEqual([failed.source.agree, failed.source.variants, failed.source.entries, failed.source.task], ["differ", [{ at: "Ludmila", other: "Lidmila" }], ["e2"], undefined]);
    const text = (await w.ok(["document", "show", id])).out;
    assert.match(text, /— NOT written to the research: .*sealed on another computer/u, text);
    assert.match(text, /^next: tell the person the reading again of S0001 is not written to the research/mu);
  } finally {
    w.cleanup();
  }
});
