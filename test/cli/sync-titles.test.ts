// The titles of a name (the tester's T07): "Ing." before it, "ml." after it — kept apart from the name, never a change
// of the name itself. The research writes them in the NAME line (any app shows them) and spells them out below it
// (NPFX, GIVN, SURN, NSFX: the Strom app from 3.10 reads them); an app that reads none keeps them in the name and sends
// them back so — the title stays, nothing renamed. A title the user changed in the app is their edit: one the name
// lacks added, a lead's corrected, a record's name the user's to decide; undone, as it was.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

type Name = { given: string; surname: string; prefix?: string; suffix?: string; citations?: unknown[] };

const shown = async (w: World, id = "P0001"): Promise<Name> => (await w.ok(["person", "show", id, "--json"])).json.person.names[0];
const plan = async (w: World, file: string) => ((await w.ok(["sync", file, "--json"])).json.changes as { kind: string; action: string; text?: string; title?: { part: string; was: string } }[]).map((c) => [c.kind, c.action, c.title?.part ?? "", c.text ?? ""]);

/** A research of one titled person (a lead: no record gives the name); given() = the file the app is given now. */
async function titled(): Promise<{ w: World; given: () => Promise<string> }> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M", "--born", "1901", "--prefix", "Ing.", "--suffix", "ml."]); // P1
  let n = 0;
  const given = async () => {
    const out = path.join(w.dir, `given-${++n}.ged`);
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
    return fs.readFileSync(out, "utf8");
  };
  return { w, given };
}

/** The person's NAME and its parts in a file, as an app writes them. */
const named = (text: string, lines: string[]) => text.replace(/1 NAME .*\r?\n(?:2 (?:NPFX|GIVN|SURN|NSFX) .*\r?\n)*/, `${lines.join("\n")}\n`);

const send = (w: World, text: string, name: string) => {
  const file = path.join(w.dir, name);
  fs.writeFileSync(file, text);
  return file;
};

test("titles go to the app in the NAME line and spelled out below it; they come back as they went — no change, no rename", opts, async () => {
  const { w, given } = await titled();
  assert.deepEqual(await shown(w), { given: "Jan", surname: "Novák", prefix: "Ing.", suffix: "ml." });
  const text = await given();
  assert.match(text, /\n1 NAME Ing\. Jan \/Novák\/ ml\.\r?\n2 NPFX Ing\.\r?\n2 GIVN Jan\r?\n2 SURN Novák\r?\n2 NSFX ml\.\r?\n/);
  // the app of titles sends it back as it was given
  assert.deepEqual(await plan(w, send(w, text, "same.ged")), []);
  // an app that reads no titles (before 3.10) keeps them in the name: "Ing. Jan" and "Novák ml." — the same person
  const older = named(text, ["1 NAME Ing. Jan /Novák ml./"]);
  assert.deepEqual(await plan(w, send(w, older, "older.ged")), [], "an older app's copy: nothing changed, nothing taken away");
  // …and an older app's rename: the name changed, the titles kept and never part of it
  const renamed = send(w, named(text, ["1 NAME Ing. Josef /Novák ml./"]), "renamed.ged");
  const changes = (await w.ok(["sync", renamed, "--json"])).json.changes as { kind: string; action: string; text: string }[];
  assert.deepEqual(changes.map((c) => [c.kind, c.action, c.text]), [["name.changed", "correct", "Josef /Novák/"]]);
  await w.ok(["sync", renamed, "--apply"]);
  const now = await shown(w);
  assert.deepEqual([now.given, now.surname, now.prefix, now.suffix], ["Josef", "Novák", "Ing.", "ml."]);
  w.cleanup();
});

test("a title edited in the app: a lead's name corrected (the name untouched), undone as it was; taken off in the app, taken off", opts, async () => {
  const { w, given } = await titled();
  const text = await given();
  const file = send(w, named(text, ["1 NAME Dr. Jan /Novák/ ml.", "2 NPFX Dr.", "2 GIVN Jan", "2 SURN Novák", "2 NSFX ml."]), "dr.ged");
  assert.deepEqual(await plan(w, file), [["name.title", "correct", "before", "Dr."]]);
  assert.match((await w.ok(["sync", file], { tty: true })).out, /1\. Jan Novák \[P0001\]: titul před jménem — Ing\. → Dr\. → opraví vodítko výzkumu/);
  const input = (await w.ok(["sync", file, "--apply", "--json"])).json.input as string;
  let now = await shown(w);
  assert.deepEqual([now.given, now.surname, now.prefix, now.suffix], ["Jan", "Novák", "Dr.", "ml."]);
  assert.equal((now.citations ?? []).length, 1, "the name cites the tree sent");
  assert.deepEqual(await plan(w, send(w, await given(), "again.ged")), [], "sent back: nothing new");
  await w.ok(["sync", "undo", input]);
  now = await shown(w);
  assert.deepEqual([now.prefix, now.suffix, now.citations], ["Ing.", "ml.", undefined], "as it was, the citation gone");
  // taken off in the app (an app of titles: no NPFX, the line without it)
  const off = send(w, named(await given(), ["1 NAME Jan /Novák/ ml.", "2 GIVN Jan", "2 SURN Novák", "2 NSFX ml."]), "off.ged");
  assert.deepEqual(await plan(w, off), [["name.title", "correct", "before", ""]]);
  await w.ok(["sync", off, "--apply"]);
  now = await shown(w);
  assert.equal(now.prefix, undefined);
  assert.equal(now.suffix, "ml.");
  w.cleanup();
});

test("a title the research's name lacks, added in the app: added; a record's name with its title changed: the user's to decide, asked once", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["source", "add", "Křest Jana Nováka 1901", "--kind", "baptism", "--locator", "fol. 3"]); // S1
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M", "--suffix", "st.", "--cite", "S0001"]); // P1, the name from the record
  const out = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
  const text = fs.readFileSync(out, "utf8");
  const file = send(w, named(text, ["1 NAME MUDr. Jan /Novák/ ml.", "2 NPFX MUDr.", "2 GIVN Jan", "2 SURN Novák", "2 NSFX ml."]), "app.ged");
  assert.deepEqual(await plan(w, file), [
    ["name.title", "add", "before", "MUDr."],
    ["name.title", "conflict", "after", "ml."],
  ]);
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.deepEqual(r.conflicts.map((c: { person: string; fact: string }) => [c.person, c.fact]), [["P0001", "NSFX"]]);
  let now = await shown(w);
  assert.deepEqual([now.given, now.surname, now.prefix, now.suffix], ["Jan", "Novák", "MUDr.", "st."], "the record's title kept until the user decides");
  assert.deepEqual(await plan(w, send(w, named(fs.readFileSync(file, "utf8"), ["1 NAME MUDr. Jan /Novák/ ml.", "2 NPFX MUDr.", "2 NSFX ml."]), "again.ged")), [], "asked once");
  const x = (await w.ok(["conflict", "list", "--json"])).json.conflicts[0];
  assert.match(x.title, /Jan Novák: Titul za jménem — st\. × ml\./);
  await w.ok(["conflict", "resolve", x.id, "--take", "user", "--reasoning", "the user knows him"]);
  now = await shown(w);
  assert.equal(now.suffix, "ml.");
  w.cleanup();
});

test("an app's file without a base, its JSON, another program's NPFX/NSFX: titles in any script, NFD or not — never part of the name", opts, async () => {
  const w = new World();
  await w.withTree();
  // the Strom app's JSON (3.10): titleBefore / titleAfter of a new person
  const json = path.join(w.dir, "app.json");
  fs.writeFileSync(json, JSON.stringify({ version: 11, persons: { a: { id: "a", firstName: "Jan", lastName: "Novák", titleBefore: "Ing.", titleAfter: "Ph.D.", gender: "male" } }, partnerships: {} }));
  await w.ok(["sync", json, "--apply", "--force"]);
  assert.deepEqual(await shown(w), { given: "Jan", surname: "Novák", prefix: "Ing.", suffix: "Ph.D.", citations: (await shown(w)).citations });
  // another program's file: a title in Cyrillic, a decomposed (NFD) one — kept in NFC, the line without them
  const nfd = "hrabě";
  const ged = path.join(w.dir, "other.ged");
  fs.writeFileSync(
    ged,
    ["0 HEAD", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Доц. Иван /Петров/", "2 NPFX Доц.", "1 SEX M", "0 @I2@ INDI", `1 NAME ${nfd} Josef /Kinský/`, `2 NPFX ${nfd}`, "1 SEX M", "0 TRLR", ""].join("\n"),
  );
  await w.ok(["intake", ged]);
  const people = (await w.ok(["person", "list", "--json", "--full"])).json.persons as { names: Name[] }[];
  const ivan = people.find((p) => p.names[0]!.surname === "Петров")!.names[0]!;
  assert.deepEqual([ivan.prefix, ivan.given], ["Доц.", "Иван"]);
  const josef = people.find((p) => p.names[0]!.given === "Josef")!.names[0]!;
  assert.equal(josef.prefix, "hrabě".normalize("NFC"));
  assert.equal(josef.prefix!.normalize("NFC"), josef.prefix, "kept in NFC");
  // found by the name, never by the title
  assert.equal((await w.ok(["person", "list", "Иван Петров", "--json"])).json.total, 1);
  assert.equal((await w.ok(["person", "list", "Доц.", "--json"])).json.total, 0);
  w.cleanup();
});

test("the agent sets the titles: person add / name add / person edit --prefix --suffix; a title changed needs a reason; the card shows it", opts, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Marie /Dvořáková/", "--sex", "F"]);
  await w.ok(["person", "edit", "P0001", "--prefix", "MUDr."]);
  assert.equal((await shown(w)).prefix, "MUDr.");
  const r = await w.run(["person", "edit", "P0001", "--prefix", "PhDr."]);
  assert.notEqual(r.code, 0, "another title: a reason");
  await w.ok(["person", "edit", "P0001", "--prefix", "", "--suffix", "Ph.D.", "--reason", "the register has no title before her name"]);
  let now = await shown(w);
  assert.deepEqual([now.prefix, now.suffix, now.given], [undefined, "Ph.D.", "Marie"]);
  assert.match((await w.ok(["person", "card", "P0001"])).out, /^Marie Dvořáková Ph\.D\. \[P0001\]/);
  assert.notEqual((await w.run(["person", "edit", "P0001", "--suffix", "a/b", "--reason", "x"])).code, 0, "no slash in a title");
  await w.ok(["name", "add", "P0001", "Marie /Dvořáková/", "--prefix", "Ing."]);
  now = await shown(w);
  assert.deepEqual([now.prefix, now.suffix], ["Ing.", "Ph.D."]);
  // the standard file spells them out for any program
  const out = path.join(w.dir, "std.ged");
  await w.ok(["export", "gedcom", "--for", "standard", "--out", out]);
  assert.match(fs.readFileSync(out, "utf8"), /1 NAME Ing\. Marie \/Dvořáková\/ Ph\.D\.\r?\n2 NPFX Ing\.\r?\n2 GIVN Marie\r?\n2 SURN Dvořáková\r?\n2 NSFX Ph\.D\./);
  w.cleanup();
});

// The Strom app's own parser and exporter (../strom: the app released, ../strom-beta: the one coming), each as its
// version reads the file it is given: the titled person back with no change; a title or a name edited in it, that edit.
for (const dir of ["strom", "strom-beta"]) {
  const repo = path.resolve(import.meta.dirname, "..", "..", "..", dir);
  const tsx = path.join(repo, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  const version = fs.existsSync(path.join(repo, "package.json")) ? (JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8")).version as string) : "";
  test(`the Strom app ${version || dir} (its own parser and exporter): a titled name back as it went; its edit of the title or the name, that edit only`, { skip: !hasGit || !fs.existsSync(tsx) }, async () => {
    const { appReadsTitles } = await import("../../src/core/stromapp.ts");
    const { Settings } = await import("../../src/core/config.ts");
    const { w } = await titled();
    const reads = appReadsTitles(new Settings({ ...w.env, STROM_APP_URL: "https://stromapp.info/run/" }, {}), version);
    const given = path.join(w.dir, "given.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given], { env: { STROM_APP_VERSION: version } });
    const text = fs.readFileSync(given, "utf8");
    assert.equal(/\n2 NPFX Ing\./.test(text), reads, "spelled out for an app that reads it only");
    assert.match(text, /\n1 NAME Ing\. Jan \/Novák\/ ml\./, "the line says them for every app");
    const [tree, head] = [/^1 _STROM_TREE (.+)$/m.exec(text)![1]!, /^1 _STROM_HEAD (.+)$/m.exec(text)![1]!];
    const script = path.join(w.dir, "app.ts");
    fs.writeFileSync(
      script,
      `import fs from "node:fs";
import { parseGedcom, convertToStrom } from ${JSON.stringify(path.join(repo, "src", "ged-parser.ts"))};
import { exportToGedcom } from ${JSON.stringify(path.join(repo, "src", "ged-exporter.ts"))};
const data = convertToStrom(parseGedcom(fs.readFileSync(process.argv[2]!, "utf8"))).data;
const p = (Object.values(data.persons) as any[]).find((x) => x.refn === "P0001");
const edit = JSON.parse(process.argv[4]!);
Object.assign(p, edit);
fs.writeFileSync(process.argv[3]!, exportToGedcom(data, "Novákovi", { research: { id: ${JSON.stringify(tree)}, head: ${JSON.stringify(head)} } }).content);
console.log(JSON.stringify({ firstName: p.firstName, lastName: p.lastName, titleBefore: p.titleBefore, titleAfter: p.titleAfter }));
`,
    );
    const app = (name: string, edit: Record<string, string> = {}) => {
      const out = path.join(w.dir, name);
      const r = spawnSync(tsx, [script, given, out, JSON.stringify(edit)], { cwd: repo, encoding: "utf8" });
      assert.equal(r.status, 0, r.stderr);
      return { file: out, read: JSON.parse(r.stdout.trim().split("\n").pop()!) as Record<string, string | undefined> };
    };
    const back = app("back.ged");
    assert.deepEqual(back.read, reads ? { firstName: "Jan", lastName: "Novák", titleBefore: "Ing.", titleAfter: "ml." } : { firstName: "Ing. Jan", lastName: "Novák ml." });
    assert.deepEqual(await plan(w, back.file), [], "unedited: nothing");
    if (reads) assert.deepEqual(await plan(w, app("dr.ged", { titleBefore: "Dr." }).file), [["name.title", "correct", "before", "Dr."]]);
    const renamed = app("josef.ged", { firstName: reads ? "Josef" : "Ing. Josef" });
    assert.deepEqual(await plan(w, renamed.file), [["name.changed", "correct", "", "Josef /Novák/"]], "the name changed, never its titles");
    w.cleanup();
  });
}

test("T07b: the app's version with a pre-release (3.10.0-beta.6) in strom.version / STROM_APP_VERSION as in its header to the bridge — a beta reads what its release does: the titles spelled out", opts, async () => {
  const { appVersionOf } = await import("../../src/core/live.ts");
  const { appReadsTitles, isAppVersion } = await import("../../src/core/stromapp.ts");
  const { Settings } = await import("../../src/core/config.ts");
  for (const v of ["3.10.0", "3.10.0-beta.6", "3.9.0-beta.10", "3.10.0+a1b2", "3.10.0-rc.1+a1b2"]) assert.ok(isAppVersion(v), v);
  for (const v of ["3.9", "3.10.0-", "beta", "3.10.0 beta", "3.10.0-beta/6", "v3.10.0"]) assert.ok(!isAppVersion(v), v);
  const { w, given } = await titled();
  const prod = { ...w.env, STROM_APP_URL: "https://stromapp.info/run/" };
  // the header and the setting: the same version, the same gate
  const fromHeader = appVersionOf({ url: "/status", headers: { "x-strom-app-version": "3.10.0-beta.6" } }, new Settings(prod, {}));
  const fromSetting = appVersionOf({ url: "/status", headers: {} }, new Settings({ ...prod, STROM_APP_VERSION: "3.10.0-beta.6" }, {}));
  assert.deepEqual([fromHeader, fromSetting], ["3.10.0-beta.6", "3.10.0-beta.6"]);
  const settings = new Settings(prod, {});
  assert.equal(appReadsTitles(settings, "3.10.0-beta.6"), true, "a beta of the release that reads titles reads them");
  assert.equal(appReadsTitles(settings, "3.9.1-beta.4"), false);
  // the setting takes it (it refused it: invalid strom.version) and the file goes by it
  await w.ok(["config", "set", "strom.version", "3.10.0-beta.6", "--for-tree"]);
  assert.equal((await w.ok(["config", "get", "strom.version"])).out.trim(), "3.10.0-beta.6");
  assert.match(await given(), /\n2 NPFX Ing\./);
  await w.ok(["config", "set", "strom.version", "3.9.1-beta.4", "--for-tree"]);
  assert.doesNotMatch(await given(), /\n2 NPFX Ing\./);
  await w.ok(["config", "unset", "strom.version", "--for-tree"]);
  assert.match((await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", path.join(w.dir, "env.ged")], { env: { STROM_APP_VERSION: "3.10.0-beta.6" } })).out, /env\.ged/);
  assert.match(fs.readFileSync(path.join(w.dir, "env.ged"), "utf8"), /\n2 NPFX Ing\./);
  assert.match((await w.run(["config", "set", "strom.version", "3.10.0-beta/6"])).err, /invalid strom\.version/);
  w.cleanup();
});
