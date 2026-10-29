// The research on the desktop of a Mac (the Strom Widget): each tree's overview written by its bridge into a file the
// widget reads — the shape the widget was built for (schemaVersion 1), each text that names a person also without the
// names, what waits counted as the Strom app counts it, each file written whole, `running: false` when the bridge ends,
// nothing written but on macOS, and a test's research never in the person's own ~/Library.

import { mock, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { treeOverview } from "../../src/core/phone-watch.ts";
import { foldText } from "../../src/core/text.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Task } from "../../src/core/model.ts";
import { appSlug, isoSecond, treeUrl, widgetDir, widgetTree, widgetWriter, stemsOfNames, withoutNames, WIDGET_SCHEMA, type WidgetIndex, type WidgetTree } from "../../src/core/widget.ts";

const AGENT = { env: { AI_AGENT: "1" } };
const ID = /(?<![\p{L}\p{N}])[PFSEXHTMRB]\d{4,}(?![\p{L}\p{N}])/u;
const SECOND = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
const skip = !hasGit || process.platform === "win32";
const NAMES = ["Kryštof", "Lhoták", "Žofie", "Matěj"].map(foldText);
const named = (s: string) => NAMES.some((n) => foldText(s).includes(n.slice(0, 5)));

/** Every text without names says none of them — anywhere in it, in any form of the word. */
function noNamesIn(t: WidgetTree): void {
  const all = [...t.now.lines.flatMap((l) => [l.titleNoNames, l.taskNoNames ?? ""]), ...t.findings.items.map((f) => f.textNoNames ?? ""), ...t.pending.items.map((p) => p.textNoNames ?? "")];
  for (const s of all) assert.ok(!named(s), `a name in "${s}"`);
}

async function smallTree(w: World): Promise<void> {
  await w.withTree("Lhotákovi ze Lhoty");
  await w.ok(["lang", "cs"]);
  // the person's own beginning: no find
  await w.ok(["research", "new", "Předci Kryštofa Lhotáka", "--new-person", "Kryštof /Lhoták/", "--sex", "M"]); // P0001, R0001
  await w.ok(["event", "add", "P1", "BIRT", "--date", "3 MAY 1784", "--place", "Třeboň"]);
  // the agent's finds
  await w.ok(["source", "add", "Matrika N Třeboň 1780–1790", "--kind", "birth"], AGENT); // S0001
  await w.ok(["person", "add", "Žofie /Lhotáková/", "--sex", "F"], AGENT); // P0002
  await w.ok(["event", "add", "P2", "BIRT", "--date", "1762", "--place", "Třeboň", "--cite", "S1"], AGENT);
  await w.ok(["event", "add", "P2", "DEAT", "--date", "1820", "--place", "Třeboň"], AGENT);
  await w.ok(["event", "add", "P1", "OCCU", "--value", "sládek"], AGENT);
  await w.ok(["person", "add", "Matěj /Lhoták/", "--sex", "M"], AGENT); // P0003
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"], AGENT); // F0001
  await w.ok(["family", "child", "F1", "P3"], AGENT);
  await w.ok(["conflict", "add", "Rok narození Žofie Lhotákové", "--about", "P2", "--claim", "S1: 1762", "--claim", "S1: 1763"], AGENT);
  await w.ok(["conflict", "resolve", "X1", "--resolution", "1762", "--reasoning", "zápis křtu"], AGENT);
  // what waits: one to do, one sent (waits for a reply: the app counts it not)
  await w.ok(["task", "add", "Hledat křest Kryštofa Lhotáka v matrice Třeboň", "--level", "locate", "--where", "farnost Třeboň", "--why", "rodiče", "--done-when", "zápis", "--about", "P1"]); // T0001
  await w.ok(["task", "add", "Opis zápisu Matěje", "--level", "locate", "--where", "SOA Třeboň", "--why", "otec", "--done-when", "opis", "--about", "P3"]); // T0002
  await w.ok(["task", "add", "Úmrtí Žofie", "--level", "locate", "--where", "farnost Třeboň", "--why", "data", "--done-when", "zápis", "--about", "P2"]); // T0003
  await w.ok(["task", "wait", "T2", "--on", "Odpověď farnosti o zápisu Matěje"]);
  await w.ok(["task", "wait", "T3", "--kind", "letter", "--to", "SOA Třeboň", "--on", "Odpověď archivu o Žofii."]);
  await w.ok(["task", "sent", "T3"]);
}

/** An agent at work on T0001 in the tree (a conversation: its session open, its worker present). */
async function atWork(w: World): Promise<string> {
  await w.ok(["session", "start", "T1"], { env: { CLAUDECODE: "1", STROM_WORKER: "chat-1" } });
  const workers = path.join(w.cwd, ".strom", "workers");
  fs.mkdirSync(workers, { recursive: true });
  const since = new Date(Date.now() - 3_600_000).toISOString();
  fs.writeFileSync(path.join(workers, "chat-1.json"), JSON.stringify({ pid: process.pid, host: os.hostname(), at: since, owner: "Claude Code conversation" }));
  return since;
}

test("the widget's file: the shape it reads (schemaVersion 1), now, the finds of 24 h, what waits as the app counts it, the day — no ID, no path, each moment to the second", { skip }, async () => {
  const w = new World();
  try {
    await smallTree(w);
    const since = await atWork(w);
    const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
    await until("the day worked out", () => treeOverview(w.cwd, w.env).day !== undefined, { ms: 20_000 });
    const t = widgetTree(w.cwd, w.env, { running: true })!;
    const said = JSON.stringify(t);
    assert.doesNotMatch(said, ID, said);
    assert.ok(!said.includes(w.env.HOME!), "no path of this computer");
    assert.doesNotMatch(said, /\$|USD|claude-|opus|sonnet/iu, "no spend, no model");

    assert.equal(t.schemaVersion, WIDGET_SCHEMA);
    assert.equal(t.schemaVersion, 1);
    assert.equal(t.treeKey, id, "the tree's ID: the same after it is renamed");
    assert.equal(t.treeName, "Lhotákovi ze Lhoty");
    assert.equal(t.lang, "cs");
    assert.equal(t.running, true);
    for (const at of [t.generatedAt, t.lastActiveAt, t.findings.windowStart, ...t.now.lines.map((l) => l.since), ...t.findings.items.map((f) => f.at)]) assert.match(at, SECOND);
    // the tree in the Strom app strom uses: ?tree=<the app's slug of its name>&research=<the tree's ID, as _STROM_TREE>
    assert.equal(new URL(t.openUrl).searchParams.get("tree"), "lhotakovi-ze-lhoty");
    assert.equal(new URL(t.openUrl).searchParams.get("research"), id.toLowerCase(), "the ID the GEDCOM's _STROM_TREE carries");
    assert.match(new URL(t.openUrl).origin, /^https:\/\/(beta\.)?stromapp\.info$/u);

    // now: the line of the agent at work, its direction, task and since when
    assert.equal(t.now.lines.length, 1);
    const line = t.now.lines[0]!;
    assert.deepEqual([line.dir, line.title, line.titleNoNames, line.since, line.pausedUntil, line.openUrl], ["up", "Předci Kryštofa Lhotáka", "Předci osoby (*1784)", isoSecond(since), null, t.openUrl]);
    assert.match(line.task!, /Kryštofa Lhotáka/u);
    assert.equal(line.taskNoNames, "Hledat křest … v matrice Třeboň", "the place stays, the names go");
    assert.equal(t.now.lastWorkedAt, undefined, "somebody works on it now");

    // the finds of 24 hours, newest first, each kind as the widget names it
    const items = t.findings.items;
    assert.deepEqual(items.map((f) => f.at), [...items.map((f) => f.at)].sort().reverse());
    const find = (kind: string, text: RegExp) => items.find((f) => f.kind === kind && text.test(f.text));
    assert.deepEqual(find("person_new", /^Žofie/u) && { text: find("person_new", /^Žofie/u)!.text, none: find("person_new", /^Žofie/u)!.textNoNames }, { text: "Žofie Lhotáková (1762–1820)", none: "osoba (1762–1820)" });
    const birth = items.find((f) => f.kind === "fact" && f.fact === "birth")!;
    assert.deepEqual([birth.text, birth.textNoNames, birth.label], ["Žofie Lhotáková, 1762, Třeboň", "osoba, 1762, Třeboň", null]);
    assert.ok(items.some((f) => f.kind === "fact" && f.fact === "death" && f.text === "Žofie Lhotáková, 1820, Třeboň"), said);
    const occupation = items.find((f) => f.kind === "fact" && f.fact === "other")!;
    assert.deepEqual([occupation.label, occupation.text, occupation.textNoNames], ["Povolání", "Kryštof Lhoták, sládek", "osoba, sládek"]);
    assert.ok(!items.some((f) => f.kind === "fact" && /3\. 5\. 1784/u.test(f.text)), "the person's own fact is no find");
    assert.ok(find("family_new", /Kryštof Lhoták/u), said);
    assert.equal(find("family_new", /Kryštof Lhoták/u)!.textNoNames, "rodina");
    assert.deepEqual([find("child", /^Matěj/u)?.text, find("child", /^Matěj/u)?.textNoNames], ["Matěj Lhoták", "osoba"]);
    assert.deepEqual([find("source_new", /Matrika/u)?.text, find("source_new", /Matrika/u)?.textNoNames], ["Matrika N Třeboň 1780–1790", "Matrika N Třeboň 1780–1790"]);
    const resolved = items.find((f) => f.kind === "resolved")!;
    assert.deepEqual([resolved.resolved, resolved.text, resolved.textNoNames], ["conflict", "Rok narození Žofie Lhotákové", "Rok narození …"]);
    for (const f of items) assert.equal(f.openUrl, t.openUrl);

    // what waits: as the Strom app counts it (its /status waiting, only what is to do) — the sent letter waits for a
    // reply, it is not counted; the terminal's own neither
    assert.equal(treeOverview(w.cwd, w.env).waiting.n, 2, "the phone counts both");
    assert.equal(t.pending.count, 1);
    assert.equal(t.pending.items.length, 1);
    assert.match(t.pending.items[0]!.text, /Matěj/u);
    assert.equal(t.pending.openUrl, t.openUrl);
    // the day, as the phone's
    assert.deepEqual(t.stats24h, treeOverview(w.cwd, w.env).day);
    assert.equal(t.stats24h!.persons, 3);
    noNamesIn(t);
  } finally {
    w.cleanup();
  }
});

test("texts without names: every name of the tree's people in any of its forms (Czech cases, a woman's surname said of the man), any script, decomposed — each run of them one …", () => {
  const stems = stemsOfNames(["Kryštof", "Lhotáková", "Anna", "Ольга", "Жукова", "Jan"]);
  assert.equal(withoutNames("Hledat křest Kryštofa Lhotáka v matrice Třeboň", stems), "Hledat křest … v matrice Třeboň");
  assert.equal(withoutNames("Lhotákovi v Třeboni 1784", stems), "… v Třeboni 1784");
  assert.equal(withoutNames("Křest Anny Lhotákové a Jana".normalize("NFD"), stems).normalize("NFC"), "Křest … a …");
  assert.equal(withoutNames("Крещение Ольги Жуковой, 1842", stems), "Крещение …, 1842");
  assert.equal(withoutNames("Kryštof Lhoták", stems), "", "nothing but names: nothing");
  assert.equal(withoutNames("Matrika N Třeboň 1780–1790", stems), "Matrika N Třeboň 1780–1790");
});

test("texts without names: a name that drops its e in the other cases (Karel → Karla, Cvrlek → Cvrlková, Žvanec → Žvance) and a woman's surname of such a name — the common words stay", () => {
  const stems = stemsOfNames(["Karel", "Cvrlek", "Pavel", "Žvanec", "Marek", "Brzel", "Němec"]);
  assert.equal(withoutNames("Rok narození Karla Cvrlka a Pavla Žvance", stems), "Rok narození … a …");
  assert.equal(withoutNames("Cvrlková nebo Žvancová, sestra Marka Brzla", stems), "… nebo …, sestra …");
  assert.equal(withoutNames("Cvrlkovi a Žvancovi u Brzlových, Karle, Pavle, Marku, Žvanče".normalize("NFD"), stems).normalize("NFC"), "… a … u …, …, …, …, …");
  assert.equal(withoutNames("Karel Cvrlek", stems), "", "nothing but names: nothing");
  // what only starts like such a name stays: "neměl" not Němec, "karta" not Karel
  assert.equal(withoutNames("Psal to sám za sebe, neměl svědky, karta farnosti", stems), "Psal to sám za sebe, neměl svědky, karta farnosti");
  // only her surname in the tree: the man and the family too
  const hers = stemsOfNames(["Cvrlková", "Žvancová"]);
  assert.equal(withoutNames("Křest Cvrlka, syna Žvance; Cvrlkovi", hers), "Křest …, syna …; …");
  assert.equal(withoutNames("Psal to za sebe, neměl svědky", hers), "Psal to za sebe, neměl svědky");
});

test("texts without names in the overview: names that drop their e gone from what was found, what waits and the work now", { skip, timeout: 120_000 }, async () => {
  const w = new World();
  try {
    await w.withTree("Cvrlkovi z Lhoty");
    await w.ok(["lang", "cs"]);
    await w.ok(["research", "new", "Předci Karla Cvrlka", "--new-person", "Karel /Cvrlek/", "--sex", "M"]); // P0001
    await w.ok(["person", "add", "Pavel /Žvanec/", "--sex", "M"], AGENT); // P0002
    await w.ok(["person", "add", "Marek /Brzel/", "--sex", "M"], AGENT); // P0003
    await w.ok(["conflict", "add", "Rok narození Karla Cvrlka a Pavla Žvance", "--about", "P1", "--claim", "x: 1", "--claim", "x: 2"], AGENT);
    await w.ok(["conflict", "resolve", "X1", "--resolution", "1", "--reasoning", "r"], AGENT);
    await w.ok(["conflict", "add", "Cvrlková nebo Žvancová, sestra Marka Brzla", "--about", "P2", "--claim", "x: 1", "--claim", "x: 2"], AGENT);
    await w.ok(["conflict", "resolve", "X2", "--resolution", "1", "--reasoning", "r"], AGENT);
    await w.ok(["task", "add", "Hledat křest Karla Cvrlka, syna Pavla Žvance", "--level", "locate", "--where", "farnost Lhota", "--why", "x", "--done-when", "y", "--about", "P1"]);
    await w.ok(["task", "wait", "T1", "--on", "Odpověď farnosti o Žvancovi"]);
    await until("the day", () => treeOverview(w.cwd, w.env).day !== undefined, { ms: 20_000 });
    const t = widgetTree(w.cwd, w.env, { running: true })!;
    const resolved = t.findings.items.filter((f) => f.kind === "resolved").map((f) => f.textNoNames).sort();
    assert.deepEqual(resolved, ["Rok narození … a …", "… nebo …, sestra …"]);
    assert.deepEqual(t.pending.items.map((p) => p.textNoNames), ["Hledat křest …, syna …"]);
    const names = /karl|cvrlk|cvrlek|pavl|zvanc|zvanec|mark|brzl|brzel/u;
    const all = [...t.now.lines.flatMap((l) => [l.titleNoNames, l.taskNoNames ?? ""]), ...t.findings.items.map((f) => f.textNoNames ?? ""), ...t.pending.items.map((p) => p.textNoNames ?? "")];
    for (const s of all) assert.ok(!names.test(foldText(s)), `a name in "${s}"`);
  } finally {
    w.cleanup();
  }
});

test("a task strom wrote of material from the app (\"Karel Němec [P0001]\"): each name once in what waits — the widget's text and its text without names, the phone's", { skip, timeout: 120_000 }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi z Lhoty");
    await w.ok(["lang", "cs"]);
    await w.ok(["research", "new", "Předci Karla Němce", "--new-person", "Karel /Němec/", "--sex", "M"]); // P0001
    await w.ok(["person", "add", "Marie /Němcová/", "--sex", "F"], AGENT); // P0002
    const photo = path.join(w.env.HOME!, "fotka.png");
    fs.writeFileSync(photo, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    await w.ok(["media", "original", photo, "--name", "fotka.png", "--person", "P0001", "--person", "P0002"]); // as the bridge takes it from the app
    const task = Tree.open(w.cwd, w.env).list<Task>("task").find((t) => t.where.includes("I0001"))!;
    assert.match(task.what, /Karel Němec \[P0001\], Marie Němcová \[P0002\]/u, "the task as strom writes it");
    await w.ok(["task", "wait", task.id, "--on", "Odpověď o souboru Karla Němce"]);
    await until("the day", () => treeOverview(w.cwd, w.env).day !== undefined, { ms: 20_000 });
    const t = widgetTree(w.cwd, w.env, { running: true })!;
    const what = t.pending.items.find((p) => /aplikace Strom/u.test(p.text));
    assert.ok(what, JSON.stringify(t.pending.items));
    assert.equal(what.text, "Rozebrat 1 soubor poslaný z aplikace Strom – Karel Němec, Marie Němcová");
    assert.equal(what.textNoNames, "Rozebrat 1 soubor poslaný z aplikace Strom – …, …");
    const phone = treeOverview(w.cwd, w.env).waiting.items.find((x) => /aplikace Strom/u.test(x.what));
    assert.ok(phone);
    assert.deepEqual(phone, { what: "Rozebrat 1 soubor poslaný z aplikace Strom – Karel Němec, Marie Němcová", on: "Odpověď o souboru Karla Němce" });
  } finally {
    w.cleanup();
  }
});

test("the widget's files: written whole (renamed over), index.json of the trees there, again only when it says something new or a minute went by, running: false at the end, taken away with the research", { skip }, async () => {
  const w = new World();
  const dir = path.join(w.env.HOME!, "widget-dir");
  const now = { ms: Date.now() };
  try {
    await smallTree(w);
    const env = { ...w.env, STROM_WIDGET_DIR: dir };
    // the day worked out in the background before: once there, the file says it (a change written at once)
    await until("the day worked out", () => treeOverview(w.cwd, env).day !== undefined, { ms: 20_000 });
    const writer = widgetWriter(w.cwd, env, "darwin", () => now.ms)!;
    assert.ok(writer);
    const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
    const file = path.join(dir, `${id}.json`);
    // each file renamed over the one before, whole at that moment
    const renames: { from: string; to: string }[] = [];
    const real = fs.renameSync;
    const spy = mock.method(fs, "renameSync", (from: fs.PathLike, to: fs.PathLike) => {
      JSON.parse(fs.readFileSync(from, "utf8"));
      renames.push({ from: String(from), to: String(to) });
      return real(from, to);
    });
    try {
      writer.tick(true);
    } finally {
      spy.mock.restore();
    }
    assert.deepEqual(renames.map((r) => path.basename(r.to)), [`${id}.json`, "index.json"]);
    for (const r of renames) {
      assert.equal(path.dirname(r.from), dir, "beside it: renamed on the same disk");
      assert.match(path.basename(r.from), /^\..*\.tmp$/u, "a hidden .tmp the widget never reads");
    }
    assert.deepEqual(fs.readdirSync(dir).sort(), [`${id}.json`, "index.json"].sort(), "nothing left beside them");
    const first = JSON.parse(fs.readFileSync(file, "utf8")) as WidgetTree;
    assert.equal(first.running, true);
    const index = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as WidgetIndex;
    assert.equal(index.schemaVersion, 1);
    assert.deepEqual(index.trees.map((t) => [t.treeKey, t.treeName, t.lang, t.running]), [[id, "Lhotákovi ze Lhoty", "cs", true]]);

    // looked at again soon: nothing; after the check, the same: not written before the minute
    const mtime = () => fs.statSync(file).mtimeMs;
    const was = mtime();
    now.ms += 1000;
    writer.tick();
    now.ms += 20_000;
    writer.tick();
    assert.equal(mtime(), was);
    assert.equal((JSON.parse(fs.readFileSync(file, "utf8")) as WidgetTree).generatedAt, first.generatedAt);
    // a new find: written at the next look
    await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F"], AGENT);
    now.ms += 16_000;
    writer.tick();
    const found = JSON.parse(fs.readFileSync(file, "utf8")) as WidgetTree;
    assert.equal(found.findings.items.find((f) => f.kind === "person_new")?.text, "Anna Lhotáková");
    // nothing new for a minute: written all the same (the widget sees the bridge alive)
    now.ms += 61_000;
    writer.tick();
    assert.notEqual((JSON.parse(fs.readFileSync(file, "utf8")) as WidgetTree).generatedAt, found.generatedAt);

    // the bridge ends as it should: running false, since when
    now.ms += 5000;
    writer.end(false);
    const ended = JSON.parse(fs.readFileSync(file, "utf8")) as WidgetTree;
    assert.deepEqual([ended.running, ended.lastActiveAt], [false, isoSecond(now.ms)]);
    assert.equal((JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as WidgetIndex).trees[0]!.running, false);
    // its research gone: its file away, the index without it
    writer.end(true);
    assert.ok(!fs.existsSync(file));
    assert.deepEqual((JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as WidgetIndex).trees, []);

    // an archive: nothing of it on the desktop
    writer.tick(true);
    assert.ok(fs.existsSync(file));
    await w.ok(["mode", "archive"], { tty: true, answers: ["y"] });
    now.ms += 20_000;
    writer.tick();
    assert.ok(!fs.existsSync(file), "an archive says nothing of an agent");
  } finally {
    w.cleanup();
  }
});

test("only on macOS, never the person's own ~/Library from a test: the HOME strom runs with, an isolated installation its own settings folder", () => {
  const home = path.join(os.tmpdir(), "strom-widget-home");
  const env = { HOME: home, STROM_CONFIG_DIR: path.join(home, "config") };
  for (const platform of ["linux", "win32"] as const) {
    assert.equal(widgetDir(env, platform), undefined);
    assert.equal(widgetWriter(home, env, platform), undefined, "no writer: nothing written");
  }
  assert.equal(widgetDir(env, "darwin"), path.join(home, "Library", "Application Support", "Strom", "widget"));
  const iso = widgetDir({ ...env, STROM_ISOLATED: "1" }, "darwin")!;
  assert.equal(iso, path.join(home, "config", "widget"));
  assert.ok(!iso.includes(path.join("Library", "Application Support")));
  assert.equal(widgetDir({ ...env, STROM_WIDGET_DIR: path.join(home, "w") }, "darwin"), path.join(home, "w"));
  assert.equal(appSlug("Rodina Fíšek–Łódź"), "rodina-fisek-lodz");
  assert.equal(appSlug("Жуковы"), "");
});

test("the widget's address of a tree: ?tree=<slug> for an older app, &research=<the tree's UUID, lowercase> — an ID that is no UUID: the name alone", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "strom-widget-url-"));
  try {
    const env = { HOME: home, STROM_CONFIG_DIR: path.join(home, "config"), STROM_APP_URL: "https://beta.stromapp.info/run/" };
    const id = "0F8FAD5B-D9CB-469F-A165-70867728950E";
    const u = new URL(treeUrl(env, "Lhotákovi ze Lhoty", id));
    assert.equal(`${u.origin}${u.pathname}`, "https://beta.stromapp.info/run/");
    assert.deepEqual([...u.searchParams], [["tree", "lhotakovi-ze-lhoty"], ["research", id.toLowerCase()]]);
    for (const bad of ["", "lhotakovi", "0f8fad5b-d9cb-469f-a165", "0f8fad5b-d9cb-469f-a165-70867728950e&tree=x", "../0f8fad5b-d9cb-469f-a165-70867728950e"])
      assert.deepEqual([...new URL(treeUrl(env, "Lhotákovi ze Lhoty", bad)).searchParams], [["tree", "lhotakovi-ze-lhoty"]], bad);
    // a name without Latin letters: the app finds it by its ID alone
    assert.deepEqual([...new URL(treeUrl(env, "Жуковы", id)).searchParams], [["research", id.toLowerCase()]]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("the bridge writes the widget's file while it runs and running: false when it ends — into the HOME it runs with, never the person's own ~/Library", { skip: skip || process.platform !== "darwin" }, async () => {
  const w = new World();
  const real = path.join(os.userInfo().homedir, "Library", "Application Support", "Strom", "widget");
  try {
    await smallTree(w);
    const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
    const file = path.join(w.env.HOME!, "Library", "Application Support", "Strom", "widget", `${id}.json`);
    const env = { STROM_LIVE_POLL_MS: "100", STROM_WIDGET_CHECK_MS: "100" };
    await w.ok(["live", "start", "--json"], { env });
    await until("the widget's file", async () => fs.existsSync(file), { ms: 20_000 });
    assert.equal((JSON.parse(fs.readFileSync(file, "utf8")) as WidgetTree).running, true);
    await w.ok(["live", "stop"], { env });
    await until("running: false", async () => (JSON.parse(fs.readFileSync(file, "utf8")) as WidgetTree).running === false, { ms: 20_000 });
    assert.ok(!fs.existsSync(path.join(real, `${id}.json`)), "never the person's own widget");

    // an isolated installation: its own settings folder, not even the HOME's Library
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
    const iso = { ...env, STROM_ISOLATED: "1" };
    await w.ok(["live", "start", "--json"], { env: iso });
    const own = path.join(w.env.STROM_CONFIG_DIR!, "widget", `${id}.json`);
    await until("the isolated widget's file", async () => fs.existsSync(own), { ms: 20_000 });
    await w.ok(["live", "stop"], { env: iso });
    assert.ok(!fs.existsSync(file), "nothing in the HOME's Library");
    assert.ok(!fs.existsSync(path.join(real, `${id}.json`)));
  } finally {
    w.cleanup();
  }
});
