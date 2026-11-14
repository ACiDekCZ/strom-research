// The mistakes agents make most in calling strom (a live run's findings): several values after a repeatable option,
// values with spaces not quoted, a found search written before its source. Beyond doubt: taken as meant; else the
// error shows the line as it is meant — never a command's argument taken into an option.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";

const opts = { skip: !hasGit };
const AGENT = { env: { AI_AGENT: "1" } };

test("several IDs after a repeatable option of IDs: each its value — the command's arguments kept", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["source", "add", "Křest první", "--kind", "baptism"]);
  await w.ok(["source", "add", "Křest druhý", "--kind", "baptism"]);
  await w.ok(["source", "add", "Крещение", "--kind", "baptism"]);
  const r = await w.ok(["search", "add", "Křty Nováků", "--method", "index", "--result", "found", "--found", "S0001", "S0002", "s3", "--json"], AGENT);
  assert.deepEqual([...r.json.search.findings].sort(), ["S0001", "S0002", "S0003"]);
  assert.equal(r.json.search.question, "Křty Nováků");
  // the question after the IDs: still the question
  const q = await w.ok(["search", "add", "--found", "S0001", "S0002", "Pohřby", "--method", "index", "--result", "found", "--json"], AGENT);
  assert.equal(q.json.search.question, "Pohřby");
  assert.equal(q.json.search.findings.length, 2);

  // an ID of another kind is never taken: the line as it is meant, nothing written
  const other = await w.run(["search", "add", "Křty", "--found", "S0001", "P0001", "--method", "index", "--result", "found"], AGENT);
  assert.equal(other.code, 2);
  assert.match(other.err, /„P0001“|"P0001"/);
});

test("values with spaces not quoted: the error shows the line as it is meant, quoted", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M"]);
  const t = await w.run(["task", "add", "Najít", "křest", "Jana", "--level", "verify"], AGENT);
  assert.equal(t.code, 2);
  // (an agent reads it in English, a Czech research too — the line is the same in any)
  assert.match(t.err, /^error: unexpected argument "křest"$/m);
  assert.match(t.err, /→ as meant: strom task add "Najít křest Jana" --level verify/);
  // the last argument takes the run of words; the ones before it stay
  const n = await w.run(["name", "add", "P0001", "Иван", "/Новак/", "--kind", "birth"], AGENT);
  assert.match(n.err, /→ as meant: strom name add P0001 "Иван \/Новак\/" --kind birth/);
  // words after an option of text: its value
  const s = await w.run(["search", "add", "Křty", "--note", "dvě", "slova", "--method", "index", "--result", "negative"], AGENT);
  assert.match(s.err, /→ as meant: strom search add Křty --note "dvě slova" --method index --result negative/);
  // IDs and words at once: each ID its option, the words quoted (decomposed accents too)
  const d = await w.run(["search", "add", "Křty".normalize("NFD"), "Nováků", "--found", "S0001", "S0002", "--method", "index", "--result", "found"], AGENT);
  assert.match(d.err.normalize("NFC"), /→ as meant: strom search add "Křty Nováků" --found S0001 --found S0002 --method index --result found/u);
  // a program reads the English, and the line
  const en = await w.run(["task", "add", "Najít", "křest", "--json"], AGENT);
  assert.equal(en.json.hint, 'as meant: strom task add "Najít křest" --json');
  // in a batch: the line without strom, said with its line number
  const b = await w.run(["batch", "task add Najít křest --level verify"], AGENT);
  assert.match(b.err, /line 1 \(task add\): unexpected argument "křest"/);
  assert.match(b.err, /→ as meant: task add "Najít křest" --level verify/);
});

test("a found search names its sources: in a batch --found @label of a source of the same batch, the order said", opts, async () => {
  const w = new World();
  await w.withTree();
  const ok = await w.ok(["batch", "--json", 'source add "Pohřeb první" --kind burial #a', 'source add "Pohřeb druhý" --kind burial #b', 'search add "Pohřby Nováků" --method index --result found --found @a @b'], AGENT);
  const search = ok.json.lines.at(-1);
  assert.match(search.created, /^Q\d+$/);
  const shown = readJsonFile(path.join(w.cwd, "data", "searches", `${search.created}.json`));
  assert.deepEqual(shown.findings, ["S0001", "S0002"]);
  // the search first: the error names the order
  const r = await w.run(["batch", 'search add "Pohřby" --method index --result found', 'source add "Pohřeb třetí" --kind burial #c'], AGENT);
  assert.match(r.err, /result found needs --found/);
  assert.match(r.err, /the source add line first, ending #s, then search add … --found @s/);
});

test("a found search without --found: the order said, and the command itself again with --found (1114 C10)", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Lhota 3", "--kinds", "baptism"]); // B0001
  const r = await w.run(["search", "add", "Křty Lhoták 1880–1885", "--recordset", "B1", "--years", "1880-1885", "--surname", "Lhoták", "--method", "page-by-page", "--result", "found"], AGENT);
  assert.equal(r.code, 2);
  assert.match(r.err, /result found needs --found <S…>: the source it found is recorded first/);
  assert.match(r.err, /→ 1\. strom source add "…" --kind … --recordset … --locator …/);
  assert.match(r.err, /→ 2\. strom search add "Křty Lhoták 1880–1885" --recordset B1 --years 1880-1885 --surname Lhoták --method page-by-page --result found --found <S…>/u);
  assert.equal((await w.ok(["search", "list", "--json"])).json.total, 0, "nothing written");
  // the help says the order, both commands in its examples
  const help = (await w.ok(["help", "search", "add"])).out;
  assert.match(help, /1\. strom source add .*\n {2}2\. strom search add .*--result found --found <S…>/u);
  assert.match(help, /strom source add "[^"]+" --kind baptism[^\n]*\n {2}strom search add [^\n]*--result found --found S0001/u);
});

test("an ID of another kind where one kind is asked for: what it is and strom show for it", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["search", "add", "Křty", "--method", "index", "--result", "negative"]); // Q0001
  const research = await w.run(["research", "show", "Q0001"], AGENT);
  assert.equal(research.code, 2);
  assert.match(research.err, /→ Q0001 is a search: strom show Q0001/);
  assert.match((await w.run(["person", "show", "q1"], AGENT)).err, /→ Q0001 is a search: strom show Q0001/);
  assert.match((await w.run(["task", "show", "Q0001"], AGENT)).err, /Q0001 is not a task ID \(T0001\)\n→ Q0001 is a search: strom show Q0001/);
  // a name stays a name: no ID of any kind
  assert.doesNotMatch((await w.run(["person", "show", "Новак"], AGENT)).err, /strom show/);
  assert.match((await w.ok(["show", "Q0001"], AGENT)).out, /Křty/);
});
