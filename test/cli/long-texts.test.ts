// A text over a limit is kept whole and said, never an error the agent answers by cutting it short (K3/P6): a long
// note becomes several notes, a long rule of a lesson its start with the rest in its detail, a long result of a task
// its start with the rest in the task's notes. Any script, accents composed or not.

import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { splitText } from "../../src/core/actions.ts";

const opts = { skip: !hasGit };

const sentence = (i: number) => `Ročník ${1800 + i} prohledán stránku po stránce, žádný zápis příjmení Ševčík ani Шевчик. `;
const long = (n: number) => Array.from({ length: n }, (_, i) => sentence(i)).join("").trim();
/** The words of a text, marks of parts and the ellipses of a cut aside. */
const words = (t: string) => t.normalize("NFC").replace(/\(\d+\/\d+\)|…/gu, " ").split(/\s+/u).filter(Boolean);

async function world(): Promise<World> {
  const w = new World();
  await w.withTree();
  w.env.STROM_LANG = "en";
  await w.ok(["person", "add", "Šimon /Ševčík/", "--sex", "M"]);
  await w.ok(["repo", "add", "Archiv"]);
  await w.ok(["recordset", "add", "Matrika", "--repo", "R0001", "--kinds", "baptism", "--places", "Týnec", "--years", "1784-1850"]);
  await w.ok(["task", "add", "Křest Šimona", "--level", "link", "--where", "B0001", "--why", "rodiče", "--done-when", "nalezen", "--about", "P0001"]);
  return w;
}

test("a long note of a search is kept whole as several notes, said", opts, async () => {
  const w = await world();
  const text = long(14); // about 1 200 characters, decomposed accents
  assert.ok(text.length > 1000);
  const r = await w.ok(["search", "add", "Křest Šimona", "--recordset", "B0001", "--method", "page-by-page", "--result", "negative", "--note", text.normalize("NFD")]);
  assert.match(r.out, /note: the note was \d+ characters \(one note holds 500\): kept whole as 3 notes/);
  const q = readJsonFile(path.join(w.cwd, "data", "searches", "Q0001.json"));
  assert.equal(q.notes.length, 3);
  assert.ok(q.notes.every((n: any) => n.text.length <= 500));
  assert.match(q.notes[0].text, /^\(1\/3\) Ročník 1800/);
  assert.match(q.notes[2].text, /^\(3\/3\) /);
  // cut after a sentence, nothing lost, stored composed
  assert.match(q.notes[0].text, /Шевчик\.$/u);
  assert.deepEqual(words(q.notes.map((n: any) => n.text).join(" ")), words(text));
  assert.equal(q.notes[0].text, q.notes[0].text.normalize("NFC"));
  // the same through a batch, and note add on a person
  await w.ok(["batch", `search add "Sňatek" --recordset B0001 --method index --result negative --note "${long(9)}"`]);
  assert.ok(readJsonFile(path.join(w.cwd, "data", "searches", "Q0002.json")).notes.length >= 2);
  const n = await w.ok(["note", "add", "P0001", long(7)]);
  assert.match(n.out, /kept whole as 2 notes/);
  // a short note stays one, no notice
  const short = await w.ok(["note", "add", "P0001", "krátká poznámka"]);
  assert.doesNotMatch(short.out, /kept whole/);
  assert.equal((await w.ok(["check"])).code, 0);
  w.cleanup();
});

test("a long rule of a lesson: its start is the rule, the rest goes before its detail", opts, async () => {
  const w = await world();
  const rule = `${"Folio = 2 × snímek + 1 ověřeno na šesti místech knihy. ".repeat(4)}Шесть мест проверено.`;
  assert.ok([...rule].length > 200);
  const r = await w.ok(["lesson", "add", rule, "--on", "B0001", "--detail", "anchors 12, 40, 77", "--json"]);
  const l = r.json.lesson;
  assert.ok([...l.rule].length <= 200);
  assert.match(l.rule, / …$/);
  assert.match(l.detail, /^… /);
  assert.match(l.detail, /anchors 12, 40, 77$/);
  assert.deepEqual(words(`${l.rule} ${l.detail}`), words(`${rule} anchors 12, 40, 77`));
  assert.match(r.json.notices[0], /the rule was \d+ characters/);
  w.cleanup();
});

test("a long result of a task: its start is the result, the rest in its notes; a long what likewise", opts, async () => {
  const w = await world();
  await w.ok(["session", "start", "T0001"]);
  const result = long(16);
  assert.ok(result.length > 1000);
  const d = await w.ok(["task", "done", "T0001", "--result", result]);
  assert.match(d.out, /note: the result was \d+ characters \(a result holds 1000\)/);
  const t = readJsonFile(path.join(w.cwd, "data", "tasks", "T0001.json"));
  assert.ok(t.result.length <= 1000);
  assert.ok(t.notes.length >= 1);
  assert.deepEqual(words([t.result, ...t.notes.map((n: any) => n.text)].join(" ")), words(result));
  const what = `Křest Šimona Ševčíka a jeho sourozenců ${"v knihách farnosti a v knihách sousedních far, ".repeat(5)}konec`;
  const a = await w.ok(["task", "add", what, "--level", "link", "--where", "B0001", "--why", "rodiče", "--done-when", "nalezen", "--about", "P0001", "--anyway", "--json"]);
  assert.ok(a.json.task.what.length <= 200);
  assert.match(a.json.task.notes[0].text, /^… /);
  assert.deepEqual(words([a.json.task.what, ...a.json.task.notes.map((n: any) => n.text)].join(" ")), words(what));
  w.cleanup();
});

test("splitText: after a sentence, else a word; never inside a character", () => {
  assert.deepEqual(splitText("Jedna věta. Druhá věta je delší.", 20), { head: "Jedna věta.", rest: "Druhá věta je delší." });
  assert.deepEqual(splitText("слово слово слово слово", 12), { head: "слово слово", rest: "слово слово" });
  const emoji = `${"a".repeat(9)}😀b`;
  const { head } = splitText(emoji, 10);
  assert.equal(head, "a".repeat(9));
});
