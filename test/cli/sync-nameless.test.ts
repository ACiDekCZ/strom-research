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
import { APP_WRITES_NO_SURNAME_EMPTY, appUnknownIsNoSurname } from "../../src/core/stromapp.ts";
import { stampAppVersion } from "../../src/core/sync.ts";

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

/**
 * A person the user added in the app, of no name and no surname: as the app's exporter writes them — its HEAD's
 * 1 SOUR (and the version under it: none by default, as a file that says none).
 */
const withNameless = (text: string, name: string, head = "STROM", vers?: string) =>
  text
    .replace(/^1 SOUR .*\r?\n(?:2 (?:VERS|NAME) .*\r?\n)*/m, `1 SOUR ${head}\n${vers ? `2 VERS ${vers}\n` : ""}`)
    .replace(/^0 TRLR/m, `0 @I99@ INDI\n1 NAME ${name}\n2 GIVN ?\n1 SEX F\n1 BIRT\n2 DATE 1930\n0 TRLR`);

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

// T08b by the app's version (the app's N13): from 3.10.0-beta.7 the app writes a person of no name and no surname
// "? //", so its "? /Unknown/" is the surname Unknown the user typed; before it, or where the file says no version of the
// app (the app writes "2 VERS 1.0" under "1 SOUR STROM"), no surname. "? //" is no surname in every version.
const OLD = [undefined, "1.0", "3.9.1", "3.10.0-beta.6"] as const;
const NEW = ["3.10.0-beta.7", "3.10.0-beta.10", "3.10.0-rc.1", "3.10.0", "3.10.1", "3.10.0+a1b2"] as const;

test("T08b by version: which app means \"? /Unknown/\" as no surname — before 3.10.0-beta.7 or no version of it; semver order of its pre-releases", () => {
  assert.equal(APP_WRITES_NO_SURNAME_EMPTY, "3.10.0-beta.7");
  for (const v of OLD) assert.equal(appUnknownIsNoSurname(v), true, String(v));
  for (const v of ["", " ", "3.10", "3.9.0", "3.10.0-beta.1", "3.10.0-beta.6", "3.10.0-alpha.9"]) assert.equal(appUnknownIsNoSurname(v), true, v);
  for (const v of NEW) assert.equal(appUnknownIsNoSurname(v), false, v);
  assert.equal(appUnknownIsNoSurname("4.0.0-beta.1"), false);
});

test("T08b by version: the bridge writes the version the app says with a send into the file's HEAD where the file says none of the app", () => {
  const app = "0 HEAD\n1 SOUR STROM\n2 VERS 1.0\n2 NAME Strom Family Tree\n1 GEDC\n2 VERS 5.5.1\n0 @I1@ INDI\n1 NAME Jan /Novák/\n0 TRLR\n";
  assert.equal(stampAppVersion(app, "3.10.0-beta.7"), app.replace("2 VERS 1.0", "2 VERS 3.10.0-beta.7"));
  assert.equal(stampAppVersion(app.replace(/\n/g, "\r\n"), "3.10.0"), app.replace("2 VERS 1.0", "2 VERS 3.10.0").replace(/\n/g, "\r\n"), "CRLF kept");
  const none = app.replace("2 VERS 1.0\n", "");
  assert.equal(stampAppVersion(none, "3.10.0"), app.replace("2 VERS 1.0", "2 VERS 3.10.0"), "none: added under 1 SOUR STROM");
  const said = app.replace("2 VERS 1.0", "2 VERS 3.10.0-beta.6");
  assert.equal(stampAppVersion(said, "3.10.0"), said, "a version of the app the file says: its own");
  assert.equal(stampAppVersion(app, undefined), app, "no version said with it");
  assert.equal(stampAppVersion(app, "1.0"), app, "no version of the app");
  const other = app.replace("1 SOUR STROM", "1 SOUR OTHER_PROGRAM");
  assert.equal(stampAppVersion(other, "3.10.0"), other, "another program's file");
});

test("T08b by version: a file of the Strom app (strom sync, strom intake) — \"? /Unknown/\" no surname before 3.10.0-beta.7 or with no version of the app, the surname Unknown from it on; \"? //\" no surname in every version", { skip: !hasGit }, async () => {
  const { w, given } = await research();
  const base = fs.readFileSync(await given(), "utf8");
  const file = path.join(w.dir, "from-app.ged");
  const planned = async (name: string, vers: string | undefined) => {
    fs.writeFileSync(file, withNameless(base, name, "STROM", vers));
    return plan(w, file);
  };
  for (const vers of OLD) {
    const changes = await planned("? /Unknown/", vers);
    assert.ok(changes.some(([k, , n]) => k === "person.new" && n === "? //"), `${vers}: ${JSON.stringify(changes)}`);
    assert.ok(!JSON.stringify(changes).includes("Unknown"), `${vers}: ${JSON.stringify(changes)}`);
  }
  for (const vers of NEW) {
    const changes = await planned("? /Unknown/", vers);
    assert.ok(changes.some(([k, , n]) => k === "person.new" && n === "? /Unknown/"), `${vers}: ${JSON.stringify(changes)}`);
  }
  for (const vers of [...OLD, ...NEW]) {
    const changes = await planned("? //", vers);
    assert.ok(changes.some(([k, , n]) => k === "person.new" && n === "? //"), `${vers}: ${JSON.stringify(changes)}`);
    assert.ok(!JSON.stringify(changes).includes("Unknown"), `${vers}: ${JSON.stringify(changes)}`);
  }
  // written: the app from 3.10.0-beta.7 — "?" with the surname Unknown
  fs.writeFileSync(file, withNameless(base, "? /Unknown/", "STROM", "3.10.0-beta.7"));
  await w.ok(["sync", file, "--apply"]);
  assert.deepEqual(await shown(w, "P0002"), [{ given: "?", surname: "Unknown" }]);
  // strom intake of a family tree of the app: the same
  const tree = (vers: string | undefined, name: string) =>
    `0 HEAD\n1 SOUR STROM\n${vers ? `2 VERS ${vers}\n` : ""}1 GEDC\n2 VERS 5.5.1\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME ${name}\n2 GIVN ?\n1 SEX F\n1 BIRT\n2 DATE 1930\n0 TRLR\n`;
  const cases: [string | undefined, string, string][] = [
    ["3.10.0-beta.6", "? /Unknown/", ""],
    [undefined, "? /Unknown/", ""],
    ["1.0", "? /Unknown/", ""],
    ["3.10.0-beta.7", "? /Unknown/", "Unknown"],
    ["3.10.0", "? /Unknown/", "Unknown"],
    ["3.10.0-beta.6", "? //", ""],
    ["3.10.0", "? //", ""],
  ];
  for (const [i, [vers, name, surname]] of cases.entries()) {
    const f = path.join(w.dir, `intake-${i}.ged`);
    fs.writeFileSync(f, tree(vers, name));
    await w.ok(["intake", f]);
    assert.deepEqual(await shown(w, `P${String(i + 3).padStart(4, "0")}`), [{ given: "?", surname }], `${vers} ${name}`);
  }
  w.cleanup();
});

test("T08b by version: a send through the bridge is read by the version the app says with it (?app=, X-Strom-App-Version) — its file says \"2 VERS 1.0\"", { skip: !hasGit }, async () => {
  const { w, given } = await research();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const send = async (version: string, how: "query" | "header") => {
      const text = withNameless(fs.readFileSync(await given(), "utf8"), "? /Unknown/", "STROM", "1.0");
      const res = await fetch(`${info.url}/sync${how === "query" ? `?app=${version}` : ""}`, {
        method: "POST",
        body: text,
        headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8", ...(how === "header" ? { "X-Strom-App-Version": version } : {}) },
      });
      const json = (await res.json()) as Record<string, any>;
      assert.equal(res.status, 200, JSON.stringify(json));
      return json;
    };
    await send("3.10.0-beta.6", "query");
    assert.deepEqual(await shown(w, "P0002"), [{ given: "?", surname: "" }], "an app before 3.10.0-beta.7: no surname");
    await send("3.10.0", "query");
    assert.deepEqual(await shown(w, "P0003"), [{ given: "?", surname: "Unknown" }], "the app 3.10.0: the surname Unknown");
    await send("3.10.0-beta.7", "header");
    assert.deepEqual(await shown(w, "P0004"), [{ given: "?", surname: "Unknown" }], "its version in the header");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});
