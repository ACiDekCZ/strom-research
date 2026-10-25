// An open conflict where no agent works (an archive, a research waiting for its agent) is found and decided by the
// person: the overview and status say how many and how to go through them, the menu's What waits lists them and
// decides one — the app's value or the archive's, why — as the app's link conflict&do=decide&take= does (strom conflict
// resolve --take), the help of an archive names strom conflict, and the link decides in an archive and a waiting
// research alike (found: X0001 open in an archive, "strom help conflict: not in an archive", nothing in the menu).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import type { Conflict } from "../../src/core/model.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const NO_AI = /agent|\bAI\b|umělá inteligence|Claude|Codex|OpenCode|Grok|Antigravity|\bmodel|úkol|fronta/i;

function noAgent(w: World): void {
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
}

const treeId = (root: string) => (readJsonFile(path.join(root, "strom.json")) as { id: string }).id;
const conflict = async (w: World, id: string): Promise<Conflict> => (await w.ok(["conflict", "show", id, "--json"])).json.conflict;
const baptism = async (w: World): Promise<string[]> =>
  ((await w.ok(["person", "show", "P1", "--json"])).json.person.events as { kind: string; date?: string; retracted?: unknown }[]).filter((e) => e.kind === "CHR" && !e.retracted).map((e) => e.date ?? "");

/**
 * Josef's baptism from a record (S1); the app sends it a day later — X0001, the user's edit against the research — and a
 * conflict of two records (X0002). Then, as `how` says: an archive (the person's choice), or a research waiting for its
 * agent (none on this computer).
 */
async function world(how: "archive" | "waiting"): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Křest Josefa Nováka 1885", "--kind", "baptism", "--transcript", "Josef, syn Jana Nováka."]); // S1
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M", "--cite", "S1"]); // P1
  await w.ok(["event", "add", "P1", "CHR", "--date", "3 MAR 1885", "--place", "Kamenice", "--cite", "S1"]);
  const given = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  const sent = path.join(w.dir, "app.ged");
  fs.writeFileSync(sent, fs.readFileSync(given, "utf8").replace("2 DATE 3 MAR 1885", "2 DATE 4 MAR 1885"));
  await w.ok(["sync", sent, "--apply"]); // X0001
  await w.ok(["conflict", "add", "Rok narození Josefa", "--about", "P1", "--fact", "BIRT", "--claim", "S1: 1885", "--claim", "S1: 1884"]); // X0002
  noAgent(w);
  if (how === "archive") await w.ok(["mode", "archive"], { tty: true, answers: ["", "", ""] });
  return w;
}

test("an archive's open conflicts: the overview and status say them and how to go through them; --json too", opts, async () => {
  const w = await world("archive");
  const o = await w.ok([]);
  assert.match(o.out, /^ {2}rozpory k rozhodnutí: 2 \(X0001 X0002\) \(menu: Co čeká · strom conflict show <ID>\)$/m, o.out);
  assert.doesNotMatch(o.out, NO_AI, o.out);
  assert.deepEqual((await w.ok(["--json"])).json.conflicts, { open: 2, ids: ["X0001", "X0002"], command: "strom conflict show X0001" });
  const s = await w.ok(["status"]);
  assert.match(s.out, /rozpory k rozhodnutí: 2 \(X0001 X0002\)/, s.out);
  w.cleanup();
});

test("an archive's menu: What waits lists the open conflicts; one of the app's edits decided there — the app's value, why — as the link decides it", opts, async () => {
  const w = await world("archive");
  // 3 What waits · 1 the conflicts · 1 X0001 · 1 the app's value holds · why · (none of it left: X0002) 0 · 0 · 0
  const r = await w.ok([], { tty: true, answers: ["3", "1", "1", "1", "Křestní list to tak uvádí", "0", "0", "0"] });
  assert.match(r.out, / 3 {2}Co čeká \(2\)\n/, r.out);
  assert.match(r.out, /K rozhodnutí – rozpory · 2/, r.out);
  assert.match(r.out, /^ X0001 · rozpor · od /m, r.out);
  assert.match(r.out, /^ {4}v aplikaci Strom: 4\. 3\. 1885, Kamenice$/m, r.out);
  assert.match(r.out, /^ {4}v Archivu Stromu: 3\. 3\. 1885, Kamenice$/m, r.out);
  assert.match(r.out, /^ {3}1 {2}Platí hodnota z aplikace Strom$/m, r.out);
  assert.match(r.out, /^ {3}2 {2}Platí hodnota v Archivu Stromu$/m, r.out);
  assert.match(r.out, /^ {3}0 {2}Nechat otevřený$/m, r.out);
  assert.match(r.out, /✓ Rozpor je rozhodnutý\./, r.out);
  assert.doesNotMatch(r.out, NO_AI, r.out);
  const c = await conflict(w, "X0001");
  assert.equal(c.state, "resolved");
  assert.equal(c.taken, "user");
  assert.equal(c.decidedBy, "user");
  assert.equal(c.reasoning, "Křestní list to tak uvádí (rozhodnutí uživatele)");
  assert.deepEqual(await baptism(w), ["4 MAR 1885"]);
  // one left: the overview says one
  assert.match((await w.ok([])).out, /rozpory k rozhodnutí: 1 \(X0002\)/);
  w.cleanup();
});

test("an archive's menu: a conflict of two records decided by which claim holds; Enter and 0 leave it open", opts, async () => {
  const w = await world("archive");
  // 3 What waits · 1 the conflicts · 2 X0002 · Enter: left open · 2 X0002 · 1 the first claim · why · 0 · 0 · 0
  const r = await w.ok([], { tty: true, answers: ["3", "1", "2", "", "2", "1", "Starší záznam", "0", "0", "0"] });
  assert.match(r.out, /Rok narození Josefa/, r.out);
  assert.match(r.out, /^ {3}0 {2}Nechat otevřený$/m, r.out);
  const c = await conflict(w, "X0002");
  assert.equal(c.state, "resolved");
  assert.match(c.resolution ?? "", /^1885/);
  assert.equal((await conflict(w, "X0001")).state, "open");
  w.cleanup();
});

test("an archive's help names strom conflict: the group, resolve with --take, the person's help — nothing of an agent", opts, async () => {
  const w = await world("archive");
  const g = await w.ok(["help", "conflict"]);
  assert.doesNotMatch(g.out, /not in an archive/, g.out);
  for (const sub of ["conflict list", "conflict show", "conflict resolve"]) assert.match(g.out, new RegExp(`^ {2}${sub} `, "m"), g.out);
  assert.doesNotMatch(g.out, /conflict add/, g.out);
  const r = await w.ok(["help", "conflict", "resolve"]);
  assert.match(r.out, /--take <user\|research>/, r.out);
  assert.doesNotMatch(r.out, /\bagents?\b|\bAI\b/i, r.out);
  const h = await w.ok(["help", "--human"]);
  assert.match(h.out, /strom conflict list +K rozhodnutí – rozpory/, h.out);
  assert.match(h.out, /strom conflict resolve +Rozhodnout rozpor/, h.out);
  assert.doesNotMatch(h.out, NO_AI, h.out);
  // what it shows: no tasks
  assert.doesNotMatch((await w.ok(["conflict", "show", "X0001"])).out, /^tasks/m);
  w.cleanup();
});

test("the app's link decides a conflict in an archive and in a research waiting for its agent alike — never refused there", opts, async () => {
  for (const [how, take, date] of [
    ["archive", "user", "4 MAR 1885"],
    ["waiting", "research", "3 MAR 1885"],
  ] as const) {
    const w = await world(how);
    // a waiting research says its conflicts too, and lists them in What waits
    if (how === "waiting") {
      assert.match((await w.ok([])).out, /rozpory k rozhodnutí: 2 \(X0001 X0002\)/);
      assert.match((await w.ok([], { tty: true, answers: ["0"] })).out, /Co čeká \(2\)/);
    }
    const link = `strom-research://conflict?tree=${treeId(w.cwd)}&id=X0001&do=decide&take=${take}`;
    const r = await w.ok(["link", "open", link], { tty: true, answers: ["", "Podle matriky"] });
    assert.doesNotMatch(r.out, /Archiv Stromu: data přicházejí z aplikace Strom a nic se nezkoumá|čeká na AI agenta/, `${how}\n${r.out}`);
    assert.match(r.out, /✓ Rozpor je rozhodnutý\./, `${how}\n${r.out}\n${r.err}`);
    const c = await conflict(w, "X0001");
    assert.equal(c.state, "resolved", how);
    assert.equal(c.taken, take, how);
    assert.deepEqual(await baptism(w), [date], how);
    w.cleanup();
  }
});

test("a decided conflict reads in the history as decided, with why — first, the fact it took back after it", opts, async () => {
  const w = await world("archive");
  const link = `strom-research://conflict?tree=${treeId(w.cwd)}&id=X0001&do=decide&take=user`;
  await w.ok(["link", "open", link], { tty: true, answers: ["", "Podle matriky"] });
  const h = await w.ok(["history"]);
  const decided = h.out.split("\n").find((l) => /Rozpor rozhodnut/.test(l)) ?? "";
  assert.match(decided, /Rozpor rozhodnut: Josef Novák: .+ – Podle matriky\b.* \(a další změny: \d+\)$/, h.out);
  assert.doesNotMatch(h.out.split("\n")[0]!, /Odvoláno/, h.out);
  // the person's other languages alike
  await w.ok(["lang", "en"]);
  assert.match((await w.ok(["history"])).out, /Disagreement decided: Josef .+ – Podle matriky/);
  await w.ok(["lang", "de"]);
  assert.match((await w.ok(["history"])).out, /Widerspruch entschieden: Josef .+ – Podle matriky/);
  w.cleanup();
});

test("research with its agent: the person's own edits waiting for a decision are said and listed; a conflict of records is the research's", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Křest Josefa Nováka 1885", "--kind", "baptism", "--transcript", "Josef, syn Jana Nováka."]);
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M", "--cite", "S1"]);
  await w.ok(["event", "add", "P1", "CHR", "--date", "3 MAR 1885", "--place", "Kamenice", "--cite", "S1"]);
  const given = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  const sent = path.join(w.dir, "app.ged");
  fs.writeFileSync(sent, fs.readFileSync(given, "utf8").replace("2 DATE 3 MAR 1885", "2 DATE 4 MAR 1885"));
  await w.ok(["sync", sent, "--apply"]);
  await w.ok(["conflict", "add", "Rok narození Josefa", "--about", "P1", "--fact", "BIRT", "--claim", "S1: 1885", "--claim", "S1: 1884"]);
  assert.match((await w.ok(["status"])).out, /rozpory k rozhodnutí: 1 \(X0001\)/);
  w.cleanup();
});
