// The research on the desktop of a Mac (the Strom Widget): each tree's overview written by its bridge into a file the
// widget reads — the shape the widget was built for (schemaVersion 1), each text that names a person also without the
// names, what waits counted as the Strom app counts it, each file written whole, `running: false` when the bridge ends,
// nothing written but on macOS and Windows (%USERPROFILE%\.config\strom\widget, never AppData: Claude's desktop app is
// MSIX), a reader holding a file on Windows never holding the bridge, index.json as the mark of this strom from its first
// run on, and a test's research never in the person's own ~/Library or profile.

import { mock, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { treeOverview } from "../../src/core/phone-watch.ts";
import { treeFinds } from "../../src/core/phone-finds.ts";
import { foldText } from "../../src/core/text.ts";
import { Tree, VERSION } from "../../src/core/tree.ts";
import { uninstallPlan } from "../../src/core/uninstall.ts";
import type { Task } from "../../src/core/model.ts";
import { appSlug, dropWidgetTree, isoSecond, markWidget, personUrl, treeUrl, waitingUrl, widgetDir, widgetTree, widgetWriter, writeWidgetTree, stemsOfNames, withoutNames, WIDGET_SCHEMA, type WidgetIndex, type WidgetTree } from "../../src/core/widget.ts";

const AGENT = { env: { AI_AGENT: "1" } };
const ID = /(?<![\p{L}\p{N}])[PFSEXHTMRB]\d{4,}(?![\p{L}\p{N}])/u;
const SECOND = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
// (the bridge's own test below runs on macOS alone; the rest on Windows too)
const skip = !hasGit;
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
    // a record's ID only in a link to one person (the app's &person=), never in a text
    assert.doesNotMatch(JSON.stringify(t, (k, v) => (k === "openUrl" ? undefined : v)), ID, said);
    for (const u of [t.openUrl, ...t.now.lines.map((l) => l.openUrl), ...t.findings.items.map((f) => f.openUrl), t.pending.openUrl])
      assert.deepEqual([...new URL(u).searchParams.keys()].filter((k) => k !== "person" && k !== "show"), ["tree", "research"], u);
    // the phone's page gets none of it (the person's ID is a symbol's key there, JSON leaves it out)
    assert.doesNotMatch(JSON.stringify(treeOverview(w.cwd, w.env)), ID);
    assert.doesNotMatch(JSON.stringify(treeFinds(w.cwd, w.env)), ID);
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
    assert.deepEqual([line.dir, line.title, line.titleNoNames, line.since, line.pausedUntil, line.openUrl], ["up", "Předci Kryštofa Lhotáka", "Předci osoby (*1784)", isoSecond(since), null, `${t.openUrl}&person=P0001`]);
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
    // a find of one person opens that person (the app's &person=<its REFN>), any other the tree
    const person = (u: string) => new URL(u).searchParams.get("person");
    assert.deepEqual(
      items.map((f) => [f.kind, f.text, person(f.openUrl)]).sort(),
      [
        ["child", "Matěj Lhoták", "P0003"],
        ["fact", "Kryštof Lhoták, sládek", "P0001"],
        ["fact", "Žofie Lhotáková, 1762, Třeboň", "P0002"],
        ["fact", "Žofie Lhotáková, 1820, Třeboň", "P0002"],
        ["family_new", items.find((f) => f.kind === "family_new")!.text, null],
        ["person_new", "Matěj Lhoták", "P0003"],
        ["person_new", "Žofie Lhotáková (1762–1820)", "P0002"],
        ["resolved", "Rok narození Žofie Lhotákové", null],
        ["source_new", "Matrika N Třeboň 1780–1790", null],
      ].sort(),
      said,
    );
    for (const f of items) assert.equal(f.openUrl, person(f.openUrl) ? `${t.openUrl}&person=${person(f.openUrl)}` : t.openUrl);

    // what waits: as the Strom app counts it (its /status waiting, only what is to do) — the sent letter waits for a
    // reply, it is not counted; the terminal's own neither
    assert.equal(treeOverview(w.cwd, w.env).waiting.n, 2, "the phone counts both");
    assert.equal(t.pending.count, 1);
    assert.equal(t.pending.items.length, 1);
    assert.match(t.pending.items[0]!.text, /Matěj/u);
    // what waits opens the app's "Waiting" of this research
    assert.equal(t.pending.openUrl, `${t.openUrl}&show=waiting`);
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
    assert.equal(index.strom, VERSION, "the strom that wrote it");
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

test("only on macOS and Windows, never the person's own ~/Library or profile from a test: the HOME strom runs with, on Windows the profile's own folder, an isolated installation its own settings folder", () => {
  const home = path.join(os.tmpdir(), "strom-widget-home");
  const env = { HOME: home, STROM_CONFIG_DIR: path.join(home, "config") };
  assert.equal(widgetDir(env, "linux"), undefined);
  assert.equal(widgetWriter(home, env, "linux"), undefined, "no writer: nothing written");
  assert.equal(widgetDir(env, "darwin"), path.join(home, "Library", "Application Support", "Strom", "widget"));
  const iso = widgetDir({ ...env, STROM_ISOLATED: "1" }, "darwin")!;
  assert.equal(iso, path.join(home, "config", "widget"));
  assert.ok(!iso.includes(path.join("Library", "Application Support")));
  assert.equal(widgetDir({ ...env, STROM_WIDGET_DIR: path.join(home, "w") }, "darwin"), path.join(home, "w"));
  // Windows: %USERPROFILE%\.config\strom\widget — the profile's own folder, not Git Bash's HOME, also with settings
  // elsewhere (STROM_CONFIG_DIR), never under AppData (an MSIX app's private copy)
  const profile = path.join(os.tmpdir(), "strom-widget-Jiří");
  const win = { ...env, USERPROFILE: profile, APPDATA: path.join(profile, "AppData", "Roaming"), LOCALAPPDATA: path.join(profile, "AppData", "Local") };
  assert.equal(widgetDir(win, "win32"), path.join(profile, ".config", "strom", "widget"));
  assert.ok(!widgetDir(win, "win32")!.includes("AppData"));
  assert.equal(widgetDir({ HOME: home }, "win32"), path.join(home, ".config", "strom", "widget"), "no USERPROFILE: the HOME");
  assert.equal(widgetDir({ ...win, STROM_ISOLATED: "1" }, "win32"), path.join(home, "config", "widget"), "an isolated installation: its own settings folder");
  assert.equal(widgetDir({ ...win, STROM_WIDGET_DIR: path.join(home, "w") }, "win32"), path.join(home, "w"));
  assert.equal(appSlug("Rodina Fíšek–Łódź"), "rodina-fisek-lodz");
  assert.equal(appSlug("Жуковы"), "");
});

test("the mark of this strom: index.json (no tree, the version that wrote it) on macOS and Windows, none elsewhere — written again only by another strom", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "strom-widget-mark-"));
  try {
    const profile = path.join(home, "Lhoták Ondřej".normalize("NFD"));
    const env = { HOME: path.join(home, "git-bash"), USERPROFILE: profile, STROM_CONFIG_DIR: path.join(home, "config") };
    markWidget(env, "linux");
    assert.deepEqual(fs.readdirSync(home), [], "nothing on Linux");
    markWidget(env, "win32");
    const file = path.join(profile, ".config", "strom", "widget", "index.json");
    const index = JSON.parse(fs.readFileSync(file, "utf8")) as WidgetIndex;
    assert.deepEqual([index.schemaVersion, index.strom, index.trees], [1, VERSION, []]);
    assert.match(index.generatedAt, SECOND);
    assert.ok(!fs.existsSync(path.join(home, "git-bash")), "not Git Bash's HOME");
    // the same strom again: untouched; an older strom's index (no strom in it): this one's
    const was = fs.readFileSync(file, "utf8");
    fs.utimesSync(file, new Date(0), new Date(0));
    markWidget(env, "win32");
    assert.equal(fs.statSync(file).mtimeMs, 0, "nothing new to say");
    fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, generatedAt: index.generatedAt, trees: [] }));
    markWidget(env, "win32");
    assert.equal(fs.readFileSync(file, "utf8"), was);
    markWidget(env, "darwin");
    assert.ok(fs.existsSync(path.join(home, "git-bash", "Library", "Application Support", "Strom", "widget", "index.json")));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("strom's first run and its setup write the mark: index.json in the widget's folder of the HOME the test runs with, before any bridge ran", { skip: skip || process.platform !== "darwin" }, async () => {
  const w = new World();
  try {
    await w.ok(["setup", "--yes"]);
    const file = path.join(w.env.HOME!, "Library", "Application Support", "Strom", "widget", "index.json");
    const index = JSON.parse(fs.readFileSync(file, "utf8")) as WidgetIndex;
    assert.deepEqual([index.schemaVersion, index.strom, index.trees], [1, VERSION, []]);
    // the first run of another version writes it again (the settings say an older strom ran last)
    fs.rmSync(file);
    const config = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
    const settings = JSON.parse(fs.readFileSync(config, "utf8")) as Record<string, unknown>;
    fs.writeFileSync(config, JSON.stringify({ ...settings, lastVersion: "1.0.0" }));
    await w.ok(["config", "where"]);
    assert.equal((JSON.parse(fs.readFileSync(file, "utf8")) as WidgetIndex).strom, VERSION);
  } finally {
    w.cleanup();
  }
});

test("Windows: the bridge's writer into %USERPROFILE%\\.config\\strom\\widget, settings elsewhere all the same — a file the widget holds is written at the next tick, never waited for; the bridge goes on", { skip }, async () => {
  const w = new World();
  const now = { ms: Date.now() };
  try {
    await w.withTree("Lhotákovi z Lhoty");
    await w.ok(["lang", "cs"]);
    await w.ok(["person", "add", "Ondřej /Lhoták/", "--sex", "M"], AGENT);
    const profile = path.join(w.env.HOME!, "Profil Ondřej");
    const env = { ...w.env, USERPROFILE: profile };
    const dir = path.join(profile, ".config", "strom", "widget");
    const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
    const file = path.join(dir, `${id}.json`);
    const writer = widgetWriter(w.cwd, env, "win32", () => now.ms)!;
    assert.ok(writer, "a writer on Windows");
    writer.tick(true);
    assert.equal((JSON.parse(fs.readFileSync(file, "utf8")) as WidgetTree).running, true);
    assert.ok(!fs.existsSync(path.join(w.env.STROM_CONFIG_DIR!, "widget")), "not into the settings folder");

    // the widget reads the file this moment (Windows: the rename over it fails): tried once, the bridge's tick goes on
    await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F"], AGENT);
    const real = fs.renameSync;
    let tries = 0;
    const held = mock.method(fs, "renameSync", (from: fs.PathLike, to: fs.PathLike) => {
      if (String(to) === file) {
        tries++;
        throw Object.assign(new Error("EPERM: operation not permitted, rename"), { code: "EPERM" });
      }
      return real(from, to);
    });
    try {
      now.ms += 16_000;
      const t0 = Date.now();
      writer.tick();
      assert.ok(Date.now() - t0 < 1000, "never waited for the reader");
    } finally {
      held.mock.restore();
    }
    assert.equal(tries, 1, "tried once");
    assert.deepEqual(fs.readdirSync(dir).filter((n) => n.endsWith(".tmp")), [], "nothing left beside it");
    assert.ok(!(JSON.parse(fs.readFileSync(file, "utf8")) as WidgetTree).findings.items.some((f) => /Anna/u.test(f.text)));
    // the next tick (2 s later, before the next look) writes it
    now.ms += 2000;
    writer.tick();
    const t = JSON.parse(fs.readFileSync(file, "utf8")) as WidgetTree;
    assert.ok(t.findings.items.some((f) => f.kind === "person_new" && f.text === "Anna Lhotáková"), JSON.stringify(t.findings.items));
    assert.equal(t.generatedAt, isoSecond(now.ms));

    // the research gone while the widget holds its file without letting it go: it says at least running: false
    const rm = fs.rmSync;
    const holds = mock.method(fs, "rmSync", (p: fs.PathLike, o?: fs.RmOptions) => {
      if (String(p) === file) throw Object.assign(new Error("EBUSY: resource busy or locked, unlink"), { code: "EBUSY" });
      return rm(p, o);
    });
    try {
      writer.end(true);
    } finally {
      holds.mock.restore();
    }
    assert.equal((JSON.parse(fs.readFileSync(file, "utf8")) as WidgetTree).running, false);
    const index = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as WidgetIndex;
    assert.deepEqual(index.trees.map((x) => [x.treeKey, x.running]), [[id, false]]);
    // let go: taken away
    dropWidgetTree(dir, id);
    assert.ok(!fs.existsSync(file));
    assert.deepEqual((JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as WidgetIndex).trees, []);
  } finally {
    w.cleanup();
  }
});

test("strom uninstall takes the widget's files (macOS, Windows) — only what strom wrote there, the folder when nothing else is in it", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "strom-widget-uninstall-"));
  try {
    const profile = path.join(home, "Lhota");
    const env = { HOME: path.join(home, "git-bash"), USERPROFILE: profile, STROM_CONFIG_DIR: path.join(home, "config") };
    const dir = path.join(profile, ".config", "strom", "widget");
    const install = { kind: "npm" as const };
    assert.ok(!uninstallPlan(env, [], { platform: "win32", install }).remove.some((r) => r.kind === "widget"), "nothing there: nothing to take");
    const key = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const at = isoSecond(Date.now());
    const data: WidgetTree = {
      schemaVersion: 1, treeKey: key, treeName: "Lhotákovi", lang: "cs", generatedAt: at, running: false, lastActiveAt: at, openUrl: "https://stromapp.info/",
      now: { lines: [] }, findings: { windowStart: at, items: [] }, pending: { count: 0, items: [], openUrl: "https://stromapp.info/" },
    };
    assert.ok(writeWidgetTree(dir, data));
    fs.writeFileSync(path.join(dir, `.${key}.json.123.abcd1234.tmp`), "{");
    const plan = uninstallPlan(env, [], { platform: "win32", install });
    const widget = plan.remove.find((r) => r.kind === "widget");
    assert.equal(widget?.path, dir);
    // a file strom did not write stays, and so does its folder
    fs.writeFileSync(path.join(dir, "poznámka.txt"), "x");
    assert.equal(widget!.remove(), true);
    assert.deepEqual(fs.readdirSync(dir), ["poznámka.txt"]);
    fs.rmSync(path.join(dir, "poznámka.txt"));
    writeWidgetTree(dir, data);
    assert.equal(uninstallPlan(env, [], { platform: "win32", install }).remove.find((r) => r.kind === "widget")!.remove(), true);
    assert.ok(!fs.existsSync(dir), "the folder too: nothing else in it");
    assert.ok(fs.existsSync(path.dirname(dir)), "the settings folder stays");
    // macOS: its own folder; Linux: none
    const mac = path.join(home, "git-bash", "Library", "Application Support", "Strom", "widget");
    writeWidgetTree(mac, data);
    assert.equal(uninstallPlan(env, [], { platform: "darwin", install }).remove.find((r) => r.kind === "widget")?.path, mac);
    assert.ok(!uninstallPlan(env, [], { platform: "linux", install }).remove.some((r) => r.kind === "widget"));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("strom uninstall in a widget folder of the person's own (STROM_WIDGET_DIR): only index.json and the trees' files that say so, never another .json", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "strom-widget-own-"));
  try {
    const dir = path.join(home, "Lhotín složka");
    const env = { HOME: home, STROM_CONFIG_DIR: path.join(home, "config"), STROM_WIDGET_DIR: dir };
    const install = { kind: "npm" as const };
    const key = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const at = isoSecond(Date.now());
    const data: WidgetTree = {
      schemaVersion: 1, treeKey: key, treeName: "Lhotákovi", lang: "cs", generatedAt: at, running: false, lastActiveAt: at, openUrl: "https://stromapp.info/",
      now: { lines: [] }, findings: { windowStart: at, items: [] }, pending: { count: 0, items: [], openUrl: "https://stromapp.info/" },
    };
    assert.ok(writeWidgetTree(dir, data));
    fs.writeFileSync(path.join(dir, `.${key}.json.123.abcd1234.tmp`), "{");
    // the person's own files: a .json of another program (a name strom could have written too), a broken one, one being written of no tree
    fs.writeFileSync(path.join(dir, "settings.json"), '{"theme":"dark"}');
    fs.writeFileSync(path.join(dir, "Lhota-1.json"), '{"treeKey":"Lhota-2"}');
    fs.writeFileSync(path.join(dir, "broken.json"), "{");
    fs.writeFileSync(path.join(dir, ".notes.json.9.ff.tmp"), "x");
    const widget = uninstallPlan(env, [], { platform: "darwin", install }).remove.find((r) => r.kind === "widget");
    assert.equal(widget?.path, dir);
    assert.equal(widget!.remove(), true);
    assert.deepEqual(fs.readdirSync(dir).sort(), [".notes.json.9.ff.tmp", "Lhota-1.json", "broken.json", "settings.json"], "only strom's files taken");
    assert.ok(!uninstallPlan(env, [], { platform: "darwin", install }).remove.some((r) => r.kind === "widget"), "nothing of strom's left: nothing to take");
    // an index.json that is not strom's stays too
    fs.writeFileSync(path.join(dir, "index.json"), '{"pages":[]}');
    assert.ok(!uninstallPlan(env, [], { platform: "darwin", install }).remove.some((r) => r.kind === "widget"));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
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

test("the widget's address of one person (&person=<its REFN>) and of what waits (&show=waiting): beside the tree's own — no person's ID, a wrong one or a tree without a UUID as before", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "strom-widget-person-"));
  try {
    const env = { HOME: home, STROM_CONFIG_DIR: path.join(home, "config"), STROM_APP_URL: "https://beta.stromapp.info/run/" };
    const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const tree = treeUrl(env, "Lhotákovi ze Lhoty", id);
    assert.equal(personUrl(tree, "P0012"), `https://beta.stromapp.info/run/?tree=lhotakovi-ze-lhoty&research=${id}&person=P0012`);
    assert.equal(personUrl(tree, "P1234567"), `${tree}&person=P1234567`);
    assert.equal(waitingUrl(tree), `https://beta.stromapp.info/run/?tree=lhotakovi-ze-lhoty&research=${id}&show=waiting`);
    for (const bad of [undefined, "", "F0001", "P", "P12345678", "p0012", "P0012&show=waiting", "P٠١٢", " P0012"]) assert.equal(personUrl(tree, bad), tree, String(bad));
    // a tree whose ID is no UUID: its name alone, as before, and the person or what waits beside it
    const named = treeUrl(env, "Lhotákovi ze Lhoty", "lhotakovi");
    assert.deepEqual([...new URL(personUrl(named, "P0003")).searchParams], [["tree", "lhotakovi-ze-lhoty"], ["person", "P0003"]]);
    assert.deepEqual([...new URL(waitingUrl(named)).searchParams], [["tree", "lhotakovi-ze-lhoty"], ["show", "waiting"]]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("the widget's links of one person: a line of a person's research opens the person, a question the tree; a family's fact the tree, a fact of a person the person", { skip, timeout: 120_000 }, async () => {
  const w = new World();
  try {
    await w.withTree("Lhotákovi ze Lhoty");
    await w.ok(["lang", "cs"]);
    await w.ok(["research", "new", "Bořivoj Lhoták", "--new-person", "Bořivoj /Lhoták/", "--sex", "M", "--direction", "person"]); // P0001, G0001
    await w.ok(["person", "add", "Dobromila /Lhotáková/", "--sex", "F"]); // P0002
    await w.ok(["research", "new", "Kdo byl otec Dobromily?", "--person", "P2", "--direction", "question", "--question", "Kdo byl její otec?"]); // G0002
    await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"], AGENT); // F0001
    await w.ok(["event", "add", "F1", "MARR", "--date", "1810", "--place", "Lhota"], AGENT);
    await w.ok(["event", "add", "P2", "DEAT", "--date", "1850", "--place", "Lhota"], AGENT);
    await w.ok(["task", "add", "Oddací zápis v matrice Lhota", "--level", "locate", "--where", "farnost Lhota", "--why", "sňatek", "--done-when", "zápis", "--about", "P1", "--research", "G1"]); // T0001
    await w.ok(["task", "add", "Otec Dobromily v matrice Lhota", "--level", "locate", "--where", "farnost Lhota", "--why", "otec", "--done-when", "zápis", "--about", "P2", "--research", "G2"]); // T0002
    await w.ok(["session", "start", "T1"], { env: { CLAUDECODE: "1", STROM_WORKER: "chat-1" } });
    await w.ok(["session", "start", "T2"], { env: { CLAUDECODE: "1", STROM_WORKER: "chat-2" } });
    const workers = path.join(w.cwd, ".strom", "workers");
    fs.mkdirSync(workers, { recursive: true });
    const since = new Date(Date.now() - 3_600_000).toISOString();
    for (const n of ["chat-1", "chat-2"]) fs.writeFileSync(path.join(workers, `${n}.json`), JSON.stringify({ pid: process.pid, host: os.hostname(), at: since, owner: "Claude Code conversation" }));
    const t = widgetTree(w.cwd, w.env, { running: true })!;
    const person = (u: string) => new URL(u).searchParams.get("person");
    assert.deepEqual(t.now.lines.map((l) => [l.title, person(l.openUrl)]).sort(), [["Bořivoj Lhoták", "P0001"], ["Kdo byl otec Dobromily?", null]].sort(), JSON.stringify(t.now.lines));
    for (const l of t.now.lines) assert.ok(l.openUrl.startsWith(t.openUrl), l.openUrl);
    const facts = t.findings.items.filter((f) => f.kind === "fact").map((f) => [f.fact, person(f.openUrl)]).sort();
    assert.deepEqual(facts, [["death", "P0002"], ["marriage", null]], JSON.stringify(t.findings.items));
    assert.equal(t.findings.items.find((f) => f.fact === "marriage")!.openUrl, t.openUrl, "a family's fact: the tree");
  } finally {
    w.cleanup();
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
