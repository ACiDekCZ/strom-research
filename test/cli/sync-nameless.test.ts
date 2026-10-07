// A person of no name and no surname from the Strom app (the tester's T08b): the app writes them "? /Unknown/" (its
// exporter before 3.10; "? //" after) and its stand-in for an unknown parent "//". The research reads "? /Unknown/" of
// the app as "?" with no surname — never the surname Unknown — and "? //" as a person, not a stand-in; another
// program's "? /Unknown/" is its own (a surname). App → research → app: back as "?" with no surname, no change.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const plan = async (w: World, file: string) => ((await w.ok(["sync", file, "--json"])).json.changes as { kind: string; action: string; name?: string; text?: string }[]).map((c) => [c.kind, c.action, c.name ?? "", c.text ?? ""]);
const people = async (w: World) => ((await w.ok(["person", "list", "--json"])).json.persons as { id: string; name: string }[]).map((p) => p.name);
const shown = async (w: World, id: string) => ((await w.ok(["person", "show", id, "--json"])).json.person.names as { given: string; surname: string }[]).map(({ given, surname }) => ({ given, surname }));

/** A research of one person; given() = the file the app is given now. */
async function research(): Promise<{ w: World; given: () => Promise<string> }> {
  const w = new World();
  await w.withTree();
  await w.ok(["person", "add", "Jan /Novák/", "--sex", "M", "--born", "1901"]); // P1
  let n = 0;
  const given = async () => {
    const out = path.join(w.dir, `given-${++n}.ged`);
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out]);
    return out;
  };
  return { w, given };
}

/** A person the user added in the app, of no name and no surname: as the app's exporter writes them. */
const withNameless = (text: string, name: string, head = "STROM") =>
  text.replace(/^1 SOUR .*$/m, `1 SOUR ${head}`).replace(/^0 TRLR/m, `0 @I99@ INDI\n1 NAME ${name}\n2 GIVN ?\n1 SEX F\n1 BIRT\n2 DATE 1930\n0 TRLR`);

for (const name of ["? /Unknown/", "? //"])
  test(`the Strom app's nameless person (${name}): "?" with no surname, never Unknown; given back, no change`, { skip: !hasGit }, async () => {
    const { w, given } = await research();
    const file = path.join(w.dir, "from-app.ged");
    fs.writeFileSync(file, withNameless(fs.readFileSync(await given(), "utf8"), name));
    const changes = await plan(w, file);
    assert.ok(changes.some(([k]) => k === "person.new"), JSON.stringify(changes));
    assert.ok(!JSON.stringify(changes).includes("Unknown"), JSON.stringify(changes));
    await w.ok(["sync", file, "--apply"]);
    assert.deepEqual(await people(w), ["Jan Novák", "?"]);
    assert.deepEqual(await shown(w, "P0002"), [{ given: "?", surname: "" }]);
    // the research gives it to the app as "? //"; the same file sent again: nothing
    assert.match(fs.readFileSync(await given(), "utf8"), /\n1 NAME \? \/\/\r?\n/);
    assert.deepEqual(await plan(w, file), []);
    w.cleanup();
  });

test("another program's \"? /Unknown/\" is its own: the surname Unknown (only the Strom app's file means no surname)", { skip: !hasGit }, async () => {
  const { w, given } = await research();
  const file = path.join(w.dir, "other.ged");
  fs.writeFileSync(file, withNameless(fs.readFileSync(await given(), "utf8"), "? /Unknown/", "OTHER_PROGRAM"));
  assert.ok(JSON.stringify(await plan(w, file)).includes("Unknown"));
  w.cleanup();
});

// The Strom app's own parser and exporter (../strom: the app released, ../strom-beta: the one coming): a person the user
// added there with no name and no surname comes to the research as "?" with no surname, goes back to the app so, and
// comes back from it with no change.
for (const dir of ["strom", "strom-beta"]) {
  const repo = path.resolve(import.meta.dirname, "..", "..", "..", dir);
  const tsx = path.join(repo, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
  const version = fs.existsSync(path.join(repo, "package.json")) ? (JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8")).version as string) : "";
  test(`the Strom app ${version || dir} (its own parser and exporter): a nameless person of no surname, app → research → app → research: "?" with no surname, never Unknown, no change`, { skip: !hasGit || !fs.existsSync(tsx) }, async () => {
    const { w, given } = await research();
    const script = path.join(w.dir, "app.ts");
    fs.writeFileSync(
      script,
      `import fs from "node:fs";
import { parseGedcom, convertToStrom } from ${JSON.stringify(path.join(repo, "src", "ged-parser.ts"))};
import { exportToGedcom } from ${JSON.stringify(path.join(repo, "src", "ged-exporter.ts"))};
const text = fs.readFileSync(process.argv[2]!, "utf8");
const [tree, head] = [/^1 _STROM_TREE (.+)$/m.exec(text)![1]!, /^1 _STROM_HEAD (.+)$/m.exec(text)![1]!];
const data = convertToStrom(parseGedcom(text)).data;
if (process.argv[4] === "add") {
  // the user adds a person of no name and no surname (not a stand-in: one they mean)
  const id = "p_nameless";
  data.persons[id] = { id, firstName: "?", lastName: "", gender: "female", isPlaceholder: false, partnerships: [], parentIds: [], childIds: [], birthDate: "1930" };
}
fs.writeFileSync(process.argv[3]!, exportToGedcom(data, "Novákovi", { research: { id: tree, head } }).content);
console.log(JSON.stringify((Object.values(data.persons) as any[]).map((p) => [p.firstName, p.lastName])));
`,
    );
    const app = (from: string, name: string, add = false) => {
      const out = path.join(w.dir, name);
      const r = spawnSync(tsx, [script, from, out, add ? "add" : ""], { cwd: repo, encoding: "utf8" });
      assert.equal(r.status, 0, r.stderr);
      return { file: out, read: JSON.parse(r.stdout.trim().split("\n").pop()!) as [string, string][] };
    };
    const added = app(await given(), "added.ged", true);
    assert.match(fs.readFileSync(added.file, "utf8"), /\n1 NAME \? (\/Unknown\/|\/\/)\r?\n/, "the app's own way of writing it");
    const changes = await plan(w, added.file);
    assert.ok(changes.some(([k, , n]) => k === "person.new" && n === "? //"), JSON.stringify(changes));
    assert.ok(!JSON.stringify(changes).includes("Unknown"), JSON.stringify(changes));
    await w.ok(["sync", added.file, "--apply"]);
    assert.deepEqual(await people(w), ["Jan Novák", "?"]);
    assert.deepEqual(await shown(w, "P0002"), [{ given: "?", surname: "" }]);
    // to the app and back, unedited: "?" with no surname there, nothing changed here
    const back = app(await given(), "back.ged");
    assert.deepEqual(back.read.find(([f, l]) => f === "?" || l === "Unknown"), ["?", ""]);
    assert.deepEqual(await plan(w, back.file), [], "unedited: nothing");
    assert.deepEqual(await people(w), ["Jan Novák", "?"]);
    w.cleanup();
  });
}

test("a family tree of the Strom app taken in (strom intake): its \"? /Unknown/\" is \"?\" with no surname; another program's keeps its surname", { skip: !hasGit }, async () => {
  const w = new World();
  await w.withTree();
  const tree = (head: string, name: string) => `0 HEAD\n1 SOUR ${head}\n1 GEDC\n2 VERS 5.5.1\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME ${name}\n2 GIVN ?\n1 SEX F\n1 BIRT\n2 DATE 1930\n0 TRLR\n`;
  fs.writeFileSync(path.join(w.dir, "app.ged"), tree("STROM", "? /Unknown/"));
  await w.ok(["intake", path.join(w.dir, "app.ged")]);
  assert.deepEqual(await shown(w, "P0001"), [{ given: "?", surname: "" }]);
  fs.writeFileSync(path.join(w.dir, "other.ged"), tree("OTHER_PROGRAM", "? /Unknown/"));
  await w.ok(["intake", path.join(w.dir, "other.ged")]);
  assert.deepEqual(await shown(w, "P0002"), [{ given: "?", surname: "Unknown" }]);
  w.cleanup();
});
