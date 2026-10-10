// strom media calibrate: the size of scan views tuned for the research's agent and model on the research's own known
// records — started by a person only (the cost said first; a window when an agent asks; nobody to ask: exit 4), too
// few known records said with how many more, a smaller size kept only on a clear result, the stored sizes used by
// strom media view and strom read, --reset, offered again after another agent or model, nothing of it in an archive.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { encodeImage, imageSize } from "../../src/image/index.ts";
import { blank } from "../../src/image/image.ts";
import { decide, foldKey, hasKey, parseCalibration, type SizeScore } from "../../src/core/viewsample.ts";

const opts = { skip: !hasGit };
const agent = path.join(import.meta.dirname, "..", "fixtures", "calibrate-agent.ts");
const config = (w: World) => readJsonFile(path.join(w.env.STROM_CONFIG_DIR!, "config.json"));

/** The records: the child (named in the question), its father, a godparent, the house, the day, the place. */
const RECORDS = [
  { child: "Václav /Dvořák/", father: "Josef /Dvořák/", godparent: "Marie Šťastná", house: 17, day: 15, place: "Týnec" },
  { child: "Matěj /Hanžl/".normalize("NFD"), father: "Jan /Hanžl/".normalize("NFD"), godparent: "Anna Bártová", house: 170, day: 22, place: "Bučkov" },
  { child: "Иван /Петров/", father: "Пётр /Петров/", godparent: "Мария Смирнова", house: 31, day: 8, place: "Луга" },
  { child: "Kateřina /Nováková/", father: "Tomáš /Novák/", godparent: "Ludmila Zábranská", house: 44, day: 3, place: "Zájezd" },
  { child: "Franz /Weller/", father: "Georg /Weller/", godparent: "Theresia Schwarzová", house: 9, day: 27, place: "Lidice" },
  { child: "Bohumil /Kučera/", father: "Karel /Kučera/", godparent: "Rosalie Fraisová", house: 66, day: 12, place: "Chrášťany" },
];

/** A research with `n` known records on scans of two books (a spread 1700×1100 each, a neighbour image after each). */
async function world(n: number): Promise<{ w: World; truth: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["recordset", "add", "Kniha N 1850-1870", "--kinds", "baptism", "--places", "Týnec", "--years", "1850-1870"]); // B0001
  await w.ok(["recordset", "add", "Kniha N 1871-1890", "--kinds", "baptism", "--places", "Zájezd", "--years", "1871-1890"]); // B0002
  for (const book of [1, 2]) {
    const scans = path.join(w.dir, `kniha${book}`);
    fs.mkdirSync(scans);
    // every scan its own content (the store keeps each content once)
    for (let i = 1; i <= 6; i++) fs.writeFileSync(path.join(scans, `s${String(i).padStart(4, "0")}.jpg`), encodeImage(blank(1700, 1100, 1, 100 + book * 20 + i), "jpeg"));
    await w.ok(["media", "add", scans, "--recordset", `B000${book}`]);
  }
  const truth: Record<string, string> = {};
  for (const [i, r] of RECORDS.slice(0, n).entries()) {
    const book = (i % 2) + 1;
    const image = Math.floor(i / 2) * 2 + 1; // 1, 3, 5: the image after each is its neighbour
    const year = 1855 + i;
    const p = (await w.ok(["person", "add", r.child, "--sex", "M", "--json"])).json.person.id;
    const f = (await w.ok(["person", "add", r.father, "--sex", "M", "--json"])).json.person.id;
    await w.ok(["family", "add", "--partner", f, "--child", p]);
    const words = `${r.child.replace(/\//g, "")} | ${r.day} | domus ${r.house} | pater ${r.father.replace(/\//g, "")} | patrina ${r.godparent} | ${r.place}`;
    const s = (await w.ok(["source", "add", `Křest ${i + 1}`, "--kind", "baptism", "--recordset", `B000${book}`, "--clip", `B000${book}:${image}@0.1,0.4,0.5,0.1`, "--transcript", words, "--information", "primary", "--json"])).json.source.id;
    await w.ok(["event", "add", p, "CHR", "--date", `${r.day} MAR ${year}`, "--place", r.place, "--house", String(r.house), "--cite", s, "--status", "proven", "--with", `godparent:${r.godparent}`]);
    truth[r.child.split(" ")[0]!.normalize("NFC")] = words.normalize("NFC");
  }
  const file = path.join(w.dir, "truth.json");
  fs.writeFileSync(file, JSON.stringify(truth));
  w.env.STROM_RUNNER_SCRIPT = agent;
  w.env.CAL_TRUTH = file;
  return { w, truth: file };
}

test("comparing a reading with a record: accents, decomposed letters and another script fold alike; numbers whole", () => {
  const answer = foldKey("Joannes | 15 | domus 170 | pater Josephus Dvořák | Иван Петров".normalize("NFD"));
  assert.ok(hasKey(answer, foldKey("Dvořák")));
  assert.ok(hasKey(answer, foldKey("ИВАН")), "another script, another case");
  assert.ok(hasKey(answer, "#170") && hasKey(answer, "#15"));
  assert.ok(!hasKey(answer, "#17"), "17 is not in 170");
  assert.ok(hasKey(foldKey("Wenzel Dworak"), foldKey("Dvorak")), "w read as v");
  const parsed = parseCalibration("# head\n\n## C1\nfound: yes\nwhere: from 0.38 to 0.52\n\n## N1\nfound: no\n\n## C2\nfound: yes\ntranscript:\nJan | 3\nHanžl\nillegible: —\n");
  assert.deepEqual(parsed.map((a) => [a.id, a.found, a.band, a.transcript, a.illegible]), [
    ["C1", true, [0.38, 0.52], undefined, undefined],
    ["N1", false, undefined, undefined, undefined],
    ["C2", true, undefined, "Jan | 3\nHanžl", undefined],
  ]);
});

const score = (kind: "find" | "read", size: number, o: Partial<SizeScore>): SizeScore => ({
  kind, size, cases: 5, answered: 5, found: 5, located: 5, negatives: 0, falseFinds: 0, keys: 40, keysTotal: 50, unsure: 2, perCase: { C1: 8, C2: 8, C3: 8, C4: 8, C5: 8 }, partial: false, failed: 0, ...o,
});

test("the decision: a smaller size only when it loses nothing against the largest — else the default stands", () => {
  // as good: the smallest
  assert.deepEqual(decide([score("read", 1400, {}), score("read", 2000, {})], 2000), { size: 1400, clear: true, why: "decided" });
  // one thing fewer in all: the largest
  assert.equal(decide([score("read", 1400, { keys: 39, perCase: { C1: 7, C2: 8, C3: 8, C4: 8, C5: 8 } }), score("read", 2000, {})], 2000).size, 2000);
  // as much in all, but one entry two fewer: not clear that it holds
  assert.equal(decide([score("read", 1400, { perCase: { C1: 6, C2: 10, C3: 8, C4: 8, C5: 8 } }), score("read", 2000, {})], 2000).size, 2000);
  // more unsure places: the largest
  assert.equal(decide([score("read", 1400, { unsure: 3 }), score("read", 2000, {})], 2000).size, 2000);
  // a reader that did not finish, a case unanswered: the default, not clear
  assert.deepEqual(decide([score("read", 1400, { failed: 1 }), score("read", 2000, {})], 2000), { size: 2000, clear: false, why: "failed" });
  assert.deepEqual(decide([score("read", 1400, {}), score("read", 2000, { answered: 4 })], 1568), { size: 1568, clear: false, why: "failed" });
  // the largest itself read little: nothing to go by
  assert.deepEqual(decide([score("read", 1400, { keys: 20 }), score("read", 2000, { keys: 20 })], 2000), { size: 2000, clear: false, why: "uninformative" });
  // finding: an entry found in place at the largest and not at the smaller one, or a false find more: the next size up
  const f = (size: number, located: Record<string, number>, falseFinds = 0) => score("find", size, { cases: 7, answered: 7, negatives: 2, falseFinds, perCase: located, located: Object.values(located).filter(Boolean).length });
  const all = { C1: 1, C2: 1, C3: 1, C4: 1, C5: 1 };
  assert.equal(decide([f(1400, { ...all, C3: 0 }), f(1568, all), f(2000, all)], 1400).size, 1568, "bigger than the default when the default loses");
  assert.equal(decide([f(1400, all, 1), f(2000, all)], 1400).size, 2000);
  assert.equal(decide([f(1400, all), f(2000, all)], 1400).size, 1400);
});

test("too few known records: nothing runs, it says how many there are, how many are needed and how they come", opts, async () => {
  const { w } = await world(3);
  // a source without a proven fact, one without words: not known truth
  await w.ok(["source", "add", "Křest bez slov", "--clip", "B0001:2@0.1,0.4,0.5,0.1"]);
  const r = await w.ok(["media", "calibrate", "--agent", "script"]);
  assert.match(r.out, /málo snímků se známou pravdou: 3 z potřebných 5\..*chybí ještě 2 — vzniknou běžnou prací agenta/s);
  const j = await w.ok(["media", "calibrate", "--agent", "script", "--json"]);
  assert.deepEqual([j.json.ran, j.json.eligible, j.json.needed], [false, 3, 5]);
  assert.ok(!fs.existsSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json")) || !config(w).viewSizes);
  w.cleanup();
});

test("only a person starts it: the cost said first and no suggested yes; no terminal and no window: exit 4; an agent: a window", opts, async () => {
  const { w } = await world(6);
  const est = await w.ok(["media", "calibrate", "--agent", "script", "--estimate", "--json"]);
  assert.equal(est.json.cases.length, 6);
  assert.deepEqual([...new Set(est.json.cases.map((c: { book: string }) => c.book))].sort(), ["B0001", "B0002"], "both books");
  assert.ok(est.json.negatives.length >= 1 && est.json.negatives.length <= 4);
  assert.ok(est.json.estimateUsd > 0);
  // nobody to ask (no terminal, no window): needs consent, nothing run
  const none = await w.run(["media", "calibrate", "--agent", "script", "--json"]);
  assert.equal(none.code, 4, none.out + none.err);
  assert.equal(JSON.parse(none.out.trim() || none.err.trim()).status, "needs-consent", none.out + none.err);
  // the person's terminal: the cost in the question, Enter (no answer) says no
  const no = await w.run(["media", "calibrate", "--agent", "script"], { tty: true, answers: [""] });
  assert.match(no.out, /Vyladit čtení snímků pro script · vlastní model agenta: \d+ placených čtení 6 snímků tohoto výzkumu ve velikostech 1400 \/ 1568 px, asi \$\d+\.\d\d .*Spustit\? \(a\/n\) \[n\]/s);
  assert.match(no.out, /Nic se nespustilo/);
  assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "calibrate")), "no reader started");
  // an agent asks: the window answers; no in the window: nothing
  const refused = await w.run(["media", "calibrate", "--agent", "script"], { dialog: false, env: { CLAUDECODE: "1" } });
  assert.notEqual(refused.code, 0);
  assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "calibrate")));
  const yes = await w.run(["media", "calibrate", "--agent", "script", "--json"], { dialog: true, env: { CLAUDECODE: "1" } });
  assert.equal(yes.code, 0, yes.out + yes.err);
  assert.equal(yes.json.ran, true);
  assert.equal(spawnSync("git", ["status", "--porcelain"], { cwd: w.cwd, encoding: "utf8" }).stdout, "", "nothing of the research changed");
  w.cleanup();
});

test("a smaller size kept only on a clear result; the sizes used by strom media view and strom read; config shows them; --reset", opts, async () => {
  const { w } = await world(6);
  // a reader that reads as well at every size: the smaller sizes kept
  const r = await w.run(["media", "calibrate", "--agent", "script", "--sizes", "1000,1400", "--json"], { dialog: true });
  assert.equal(r.code, 0, r.out + r.err);
  const j = r.json;
  assert.deepEqual([j.stored.find, j.stored.read, j.stored.clear], [1000, 1000, { find: true, read: true }]);
  const read = j.scores.filter((s: SizeScore) => s.kind === "read");
  assert.ok(read.every((s: SizeScore) => s.keys >= 4 * 6 && s.keys === s.keysTotal), JSON.stringify(read));
  assert.deepEqual(config(w).viewSizes.script.find, 1000);
  const get = await w.ok(["config", "get", "views.size", "--agent", "script", "--json"]);
  assert.equal(get.json.value, "find 1000 · read 1000 px");
  assert.match(get.json.source, /^calibrated \(\d{4}-\d\d-\d\d\)$/);
  // strom media view: a whole image at the size found for finding, a half at the one for reading
  const whole = await w.ok(["media", "view", "B0001:2", "--agent", "script", "--json"]);
  assert.equal(Math.max(whole.json.width ?? whole.json.views?.[0]?.width ?? 0, whole.json.height ?? whole.json.views?.[0]?.height ?? 0), 1000, JSON.stringify(whole.json));
  // strom read: its readers' views at the size found for reading
  const prompts = path.join(w.dir, "prompts.txt");
  w.env.STROM_RUNNER_SCRIPT = path.join(import.meta.dirname, "..", "fixtures", "agent.ts");
  await w.ok(["read", "B0001:2", "--agent", "script", "--question", "Every baptism"], { env: { READER_PROMPT_OUT: prompts } });
  const view = /^- M\d{4} · image 2[^:]*: (.+)$/m.exec(fs.readFileSync(prompts, "utf8"))![1]!;
  const size = imageSize(new Uint8Array(fs.readFileSync(view)))!;
  assert.equal(Math.max(size.width, size.height), 1000);
  w.env.STROM_RUNNER_SCRIPT = agent;
  // a reader that loses the names below 1200 px: reading stays at the largest, finding goes down
  const again = await w.run(["media", "calibrate", "--agent", "script", "--sizes", "1000,1400", "--json"], { dialog: true, env: { CAL_SMALL: "1200" } });
  const k = again.json;
  assert.deepEqual([k.stored.find, k.stored.read], [1000, 1400]);
  // the person's words: the table and what was kept, in the research language
  const said = await w.run(["media", "calibrate", "--agent", "script", "--sizes", "1000,1400"], { tty: true, answers: ["a"], env: { CAL_SMALL: "1200" } });
  assert.match(said.out, /Nalezení zápisu na celém snímku:\n {2}1000 px {2}na místě 6 z 6 · na snímku bez něj 0 z \d · \$\d+\.\d\d\n/);
  assert.match(said.out, /Přečtení zápisu z poloviny nebo strany:\n {2}1000 px {2}přečteno \d+ z \d+ · nejistých míst \d+/);
  assert.match(said.out, /Čtení stála \$\d+\.\d\d\./);
  assert.match(said.out, /Uloženo pro script · vlastní model agenta \(\d{4}-\d\d-\d\d\): hledání 1000 px · čtení 1400 px/);
  // a reader that finds nothing at the largest size: no clear result for finding, its default stays
  // back to the defaults: --reset, and config unset
  const reset = await w.ok(["media", "calibrate", "--agent", "script", "--reset"]);
  assert.match(reset.out, /Vyladění pro script · vlastní model agenta zapomenuto: platí výchozí velikosti \(hledání 1400 px · čtení 1568 px\)/);
  assert.equal((await w.ok(["config", "get", "views.size", "--agent", "script", "--json"])).json.source, "default");
  assert.equal(config(w).viewSizes, undefined);
  await w.run(["media", "calibrate", "--agent", "script", "--sizes", "1000,1400"], { tty: true, answers: ["a"] });
  await w.ok(["config", "unset", "views.size", "--agent", "script"]);
  assert.equal((await w.ok(["config", "get", "views.size", "--agent", "script", "--json"])).json.value, "find 1400 · read 1568 px");
  assert.match((await w.run(["config", "set", "views.size", "1000"])).err, /measured, not set: strom media calibrate/);
  w.cleanup();
});

/** A PATH with git and a fake Claude Code (found here, never started). */
function fakeClaude(w: World): void {
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const git = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  if (git) fs.symlinkSync(git, path.join(bin, "git"));
  fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  w.env.PATH = `${bin}${path.delimiter}/bin${path.delimiter}/usr/bin`;
}

test("tuned before for another model: offered again in the orientation, the menu and doctor — never run; an archive says nothing of it", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  fakeClaude(w);
  await w.withTree();
  // tuned for Claude Code with Sonnet; the research reads with its default (Opus)
  const cfg = config(w);
  cfg.viewSizes = { "claude sonnet": { find: 1400, read: 1568, at: "2026-10-01", sample: 6, sizes: [1400, 1568, 2000], clear: { find: true, read: true } } };
  fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), JSON.stringify(cfg));
  const offer = /čtení snímků bylo vyladěno pro Claude Code · sonnet, pro Claude Code · opus zatím ne: strom media calibrate/i;
  const o = await w.ok([]);
  assert.match(o.out, offer);
  assert.deepEqual((await w.ok(["--json"])).json.views, { now: "claude opus", before: ["claude sonnet"] });
  const doc = await w.run(["doctor"]);
  assert.match(doc.out, /! +čtení snímků +čtení snímků bylo vyladěno pro Claude Code · sonnet/);
  // the menu: the line above it, the settings' item (8 settings · 0 · 0)
  const menu = await w.ok([], { tty: true, answers: ["8", "0", "0"] });
  assert.match(menu.out, /Čtení snímků bylo vyladěno pro Claude Code · sonnet/);
  // after Remote Control (8), so the numbers a person knows stay
  assert.match(menu.out, / 7 {2}Model výzkumu \(Claude Code\): vlastní model agenta\n {3}8 {2}Sledovat agenta z telefonu[^\n]*\n {3}9 {2}Vyladit čtení snímků \(zatím vyladěno pro jiný model\)\n/);
  assert.ok(!fs.existsSync(path.join(w.cwd, ".strom", "calibrate")), "offered, never run");
  // once tuned for the model of the research: no offer, the date said
  cfg.viewSizes["claude opus"] = { find: 1400, read: 2000, at: "2026-10-09", sample: 6, sizes: [1400, 1568, 2000], clear: { find: true, read: true } };
  fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), JSON.stringify(cfg));
  assert.doesNotMatch((await w.ok([])).out, offer);
  assert.match((await w.ok([], { tty: true, answers: ["8", "0", "0"] })).out, /Vyladit čtení snímků \(vyladěno 2026-10-09\)/);
  assert.match((await w.run(["doctor"])).out, /✓ +čtení snímků +vyladěno 2026-10-09: hledání 1400 px · čtení 2000 px/);
  // an archive: nothing of it anywhere
  delete cfg.viewSizes["claude opus"];
  fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), JSON.stringify(cfg));
  await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
  for (const out of [(await w.ok([])).out, (await w.run(["doctor"])).out, (await w.ok([], { tty: true, answers: ["8", "0", "0"] })).out])
    assert.doesNotMatch(out, /čtení snímků|calibrate/i, out);
  assert.match((await w.run(["media", "calibrate"])).err, /archive/);
  w.cleanup();
});
