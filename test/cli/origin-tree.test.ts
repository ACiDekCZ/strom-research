// The user's family tree unchanged (spec 066 U3, the app's Dotazy 3, decision A): a value the Strom app's file or tree
// gave the research and no person changed since is the user's family tree's (`tree: true`, `_STROM_ORIGIN tree`) —
// guarded as the user's, looked for by the bulk verification as a lead; a person's change, a value put back, a proposal
// the person took, an edit the app sends make it the user's own (`_STROM_ORIGIN user`, the app's ✓). A research an
// earlier beta marked (every value of the app plain `user`) is relabelled once by its history (origins-tree-1): only
// what is still as the app's file gave it; undone by strom fixes undo origins.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { ORIGINS_SETTLED, ORIGINS_TREE_SETTLED, settleOrigins } from "../../src/core/originfix.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { children, parseGedcomText, val } from "../../src/gedcom/parse.ts";
import { planSync, readGedcom } from "../../src/core/sync.ts";
import { verifyBulk } from "../../src/core/verify.ts";
import { Settings } from "../../src/core/config.ts";
import { APP_SHOWS_ORIGIN_BETA, appShowsOrigin } from "../../src/core/stromapp.ts";
import type { Event, Family, Person, ValueOrigin } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const AGENT = { env: { CLAUDECODE: "1" } };
const PERSON = { tty: true };
const FROM_APP = { env: { STROM_FOR_APP: "1" } };

/** The Strom app's own file: Marie (her surname typed decomposed, NFD), Olga in Cyrillic, their marriage-less family. */
const APP_GED = [
  "0 HEAD", "1 SOUR STROM", "2 VERS 3.25.0", "1 CHAR UTF-8",
  "0 @I1@ INDI", `1 NAME Marie /${"Kroutilová".normalize("NFD")}/`, "1 SEX F", "1 BIRT", "2 DATE 1850", "2 PLAC Čáslav", "1 DEAT", "2 DATE 1920", "2 PLAC Lhota", "1 FAMS @F1@",
  "0 @I2@ INDI", "1 NAME Ольга /Кроутилова/", "1 SEX F", "1 BIRT", "2 DATE 1852", "2 PLAC Лгота", "1 DEAT", "2 DATE 1921", "1 FAMS @F1@",
  "0 @F1@ FAM", "1 HUSB @I1@", "1 MARR", "2 DATE 1872", "2 PLAC Lhota",
  "0 TRLR", "",
].join("\n");

const TREE: ValueOrigin<string> = { by: "user", tree: true };
const USER: ValueOrigin<string> = { by: "user" };

const open = (w: World) => Tree.open(w.cwd, w.env);
const named = (w: World, given: string) => open(w).list<Person>("person").find((p) => p.names.some((n) => n.given === given))!;
const fact = (w: World, given: string, kind: string) => named(w, given).events.find((e) => e.kind === kind && !e.retracted)!;
const marr = (w: World) => open(w).list<Family>("family").flatMap((f) => f.events).find((e) => e.kind === "MARR")!;
const gitHead = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();
const commits = (w: World) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim());

/** Kroutilovi with the Strom app's file taken in. */
async function fromApp(): Promise<World> {
  const w = new World();
  await w.withTree("Kroutilovi");
  const file = path.join(w.dir, "strom.ged");
  fs.writeFileSync(file, APP_GED);
  await w.ok(["intake", file], AGENT);
  return w;
}

/** A send of the Strom app: the research's own file as the app gives it back, `edit` applied to its text. */
async function send(w: World, edit: (t: string) => string): Promise<void> {
  const t = exportGedcom(open(w), { for: "strom", head: gitHead(w) }).text.replace("1 SOUR STROM_RESEARCH", "1 SOUR STROM");
  const file = path.join(w.dir, `send-${commits(w)}.ged`);
  fs.writeFileSync(file, edit(t));
  await w.ok(["sync", file, "--apply"], FROM_APP);
}

/** The research as an earlier beta left it: the app's values plain `user`, the relabel's marker not set. */
function earlierBeta(w: World): void {
  const tree = open(w);
  tree.withTreeLock(() => {
    const plain = (o: unknown) => (o && typeof o === "object" && (o as ValueOrigin<string>).tree ? { by: "user" } : o);
    const all = [...tree.list<Person>("person"), ...tree.list<Family>("family")].map((r) => {
      const c = structuredClone(r);
      c.events = c.events.map((e) => ({ ...e, origin: plain(e.origin) as Event["origin"] }));
      if (c.type === "person") {
        c.names = c.names.map((n) => ({ ...n, origin: plain(n.origin) as typeof n.origin }));
        if (c.sexOrigin) c.sexOrigin = plain(c.sexOrigin) as typeof c.sexOrigin;
      }
      return c;
    });
    tree.putMany(all, [], { op: "tree.settle", targets: all.map((r) => r.id), summary: "as an earlier beta left it" }, (c) => {
      c.settled = [...(c.settled ?? []).filter((x) => x !== ORIGINS_TREE_SETTLED), ...((c.settled ?? []).includes(ORIGINS_SETTLED) ? [] : [ORIGINS_SETTLED])];
    });
    tree.commit("As an earlier beta left it");
  });
}

test("the Strom app's file: every value the user's family tree's (NFD and Cyrillic too); a person's change, a proposal the person took, an edit the app sends: the user's own", opts, async () => {
  const w = await fromApp();
  try {
    const marie = named(w, "Marie");
    assert.equal(marie.names[0]!.surname, "Kroutilová".normalize("NFC"), "kept in NFC");
    assert.deepEqual(marie.names[0]!.origin, TREE);
    assert.deepEqual(marie.sexOrigin, TREE);
    assert.deepEqual(fact(w, "Marie", "BIRT").origin, TREE);
    assert.deepEqual(named(w, "Ольга").names[0]!.origin, TREE);
    assert.deepEqual(fact(w, "Ольга", "BIRT").origin, TREE);
    assert.deepEqual(marr(w).origin, TREE);
    // an agent: proposes only, the value stays the family tree's
    const birt = fact(w, "Marie", "BIRT").id;
    const p = await w.ok(["event", "edit", birt, "--date", "1851", "--reason", "věk při sňatku", "--json"], AGENT);
    assert.match(p.json.proposed, /^X\d+$/);
    assert.deepEqual(fact(w, "Marie", "BIRT").origin, TREE);
    // the person takes the proposal: theirs
    await w.ok(["conflict", "resolve", p.json.proposed, "--take", "research", "--reasoning", "souhlasím"], PERSON);
    assert.equal(fact(w, "Marie", "BIRT").date, "1851");
    assert.deepEqual(fact(w, "Marie", "BIRT").origin, USER);
    // the person at their terminal: a fact, a name
    await w.ok(["event", "edit", fact(w, "Ольга", "DEAT").id, "--date", "1922", "--reason", "rodinná bible"], PERSON);
    assert.deepEqual(fact(w, "Ольга", "DEAT").origin, USER);
    await w.ok(["person", "edit", named(w, "Ольга").id, "--name", "Ольга /Кроутилова-Лготская/", "--reason", "pravopis"], PERSON);
    assert.deepEqual(named(w, "Ольга").names[0]!.origin, USER);
    assert.deepEqual(fact(w, "Ольга", "BIRT").origin, TREE, "what the person left: still the family tree's");
    // an edit the app sends: the user's
    await send(w, (t) => t.replace("2 DATE 1920", "2 DATE 1919"));
    assert.equal(fact(w, "Marie", "DEAT").date, "1919");
    assert.deepEqual(fact(w, "Marie", "DEAT").origin, USER);
    assert.deepEqual(marr(w).origin, TREE, "what the send did not change: still the family tree's");
  } finally {
    w.cleanup();
  }
});

test("a value put back by the person is the user's own, never the family tree's", opts, async () => {
  const w = new World();
  try {
    await w.withTree("Kroutilovi");
    const other = path.join(w.dir, "kroutilovi.ged");
    fs.writeFileSync(other, ["0 HEAD", "1 SOUR MyHeritage", "2 NAME MyHeritage Family Tree Builder", "1 CHAR UTF-8", "0 @I1@ INDI", "1 NAME Jan /Kroutil/", "1 SEX M", "1 BIRT", "2 DATE 1841", "2 PLAC Čáslav", "0 TRLR", ""].join("\n"));
    await w.ok(["intake", other], AGENT);
    const birt = fact(w, "Jan", "BIRT").id;
    await w.ok(["event", "edit", birt, "--date", "1842", "--reason", "rodinná bible"], PERSON);
    await w.ok(["event", "revert", birt], PERSON);
    assert.equal(fact(w, "Jan", "BIRT").date, "1841");
    assert.deepEqual(fact(w, "Jan", "BIRT").origin, USER);
  } finally {
    w.cleanup();
  }
});

test("the Strom file: _STROM_ORIGIN tree for the family tree's unchanged, user for the person's change — only for an app that shows origins; read back, nothing changes", opts, async () => {
  const w = await fromApp();
  try {
    await w.ok(["event", "edit", fact(w, "Ольга", "DEAT").id, "--date", "1922", "--reason", "rodinná bible"], PERSON);
    const beta = new Settings({ STROM_APP_URL: "https://beta.stromapp.info/run/" }, {});
    const head = gitHead(w);
    const versions = ["3.25.0", ...(APP_SHOWS_ORIGIN_BETA ? [APP_SHOWS_ORIGIN_BETA] : [])];
    for (const v of versions) {
      const on = appShowsOrigin(beta, v);
      const t = exportGedcom(open(w), { for: "strom", head, origins: on }).text;
      if (!on) {
        assert.doesNotMatch(t, /_STROM_(ORIGIN|SEX_ORIGIN)/u, v);
        continue;
      }
      const indi = (given: string) => parseGedcomText(t).records.find((r) => r.tag === "INDI" && children(r, "NAME").some((n) => n.value.startsWith(given)))!;
      const olga = indi("Ольга");
      assert.equal(val(children(olga, "BIRT")[0]!, "_STROM_ORIGIN"), "tree");
      assert.equal(val(children(olga, "DEAT")[0]!, "_STROM_ORIGIN"), "user");
      assert.equal(val(children(olga, "NAME")[0]!, "_STROM_ORIGIN"), "tree");
      assert.equal(val(olga, "_STROM_SEX_ORIGIN"), "tree");
      assert.equal(children(children(olga, "BIRT")[0]!, "_STROM_WAS").length, 0, "nothing changed: nothing to put back");
      const fam = parseGedcomText(t).records.find((r) => r.tag === "FAM")!;
      assert.equal(val(children(fam, "MARR")[0]!, "_STROM_ORIGIN"), "tree");
      // read back as it is: nothing changes
      assert.deepEqual(planSync(open(w), readGedcom(t), "conflict").changes, []);
    }
    assert.doesNotMatch(exportGedcom(open(w), { for: "standard", origins: true }).text, /_STROM_/u, "never the standard file");
  } finally {
    w.cleanup();
  }
});

test("the bulk verification looks for the family tree's unchanged values as leads; never for the person's own", opts, async () => {
  const w = await fromApp();
  try {
    const before = verifyBulk(open(w), { scope: "tree", dry: true });
    assert.ok(before.how.search >= 5, JSON.stringify(before));
    await w.ok(["event", "edit", fact(w, "Marie", "DEAT").id, "--date", "1919", "--reason", "rodinná bible"], PERSON);
    const after = verifyBulk(open(w), { scope: "tree", dry: true });
    assert.equal(after.how.search, before.how.search - 1, "the person's own value: theirs, not looked for");
    earlierBeta(w);
    assert.throws(() => verifyBulk(open(w), { scope: "tree", dry: true }), { code: "verify.nothing" }, "an earlier beta's plain user: nothing to look for");
  } finally {
    w.cleanup();
  }
});

test("origins-tree-1: an earlier beta's research relabelled once by its history — only the app's values unchanged since; the person's and the sent stay theirs; undone by strom fixes undo origins", opts, async () => {
  const w = await fromApp();
  try {
    // the person's change, a fact the person added, an edit the app sent, a person the app sent
    await w.ok(["event", "edit", fact(w, "Ольга", "DEAT").id, "--date", "1922", "--reason", "rodinná bible"], PERSON);
    await w.ok(["event", "add", named(w, "Marie").id, "BURI", "--date", "1920", "--place", "Lhota"], PERSON);
    await send(w, (t) => t.replace("2 DATE 1872", "2 DATE 1873").replace("0 TRLR", "0 @I900@ INDI\n1 NAME Josef /Kroutil/\n1 SEX M\n1 BIRT\n2 DATE 1874\n2 PLAC Čáslav\n0 TRLR"));
    earlierBeta(w);
    assert.deepEqual(fact(w, "Marie", "BIRT").origin, USER, "the beta's mark");
    const n = commits(w);
    const done = settleOrigins(open(w));
    assert.ok(done && done.changed > 0, JSON.stringify(done));
    assert.equal(commits(w), n + 1, "one commit");
    // the app's file unchanged since: the family tree's
    const marie = named(w, "Marie");
    assert.deepEqual(marie.names[0]!.origin, TREE);
    assert.deepEqual(marie.sexOrigin, TREE);
    assert.deepEqual(fact(w, "Marie", "BIRT").origin, TREE);
    assert.deepEqual(fact(w, "Marie", "DEAT").origin, TREE);
    assert.deepEqual(named(w, "Ольга").names[0]!.origin, TREE, "Cyrillic: the same by its value");
    assert.deepEqual(fact(w, "Ольга", "BIRT").origin, TREE);
    // a person's change, an added fact, a sent edit, a sent person: the user's own
    assert.deepEqual(fact(w, "Ольга", "DEAT").origin, USER);
    assert.deepEqual(fact(w, "Marie", "BURI").origin, USER);
    assert.equal(marr(w).date, "1873");
    assert.deepEqual(marr(w).origin, USER);
    const josef = named(w, "Josef");
    assert.deepEqual([josef.names[0]!.origin, josef.sexOrigin, josef.events[0]!.origin], [USER, USER, USER]);
    // once: a second run changes nothing
    assert.equal(settleOrigins(open(w)), undefined);
    assert.equal(commits(w), n + 1);
    // an agent's change of a relabelled value: still only proposed
    const p = await w.ok(["event", "edit", fact(w, "Marie", "BIRT").id, "--date", "1849", "--reason", "jinak", "--json"], AGENT);
    assert.match(p.json.proposed, /^X\d+$/);
    // undo: the beta's marks back, every value as it was
    await w.ok(["fixes", "undo", "origins", "--lang", "en"], PERSON);
    assert.deepEqual(fact(w, "Marie", "BIRT").origin, USER);
    assert.deepEqual(named(w, "Marie").sexOrigin, USER);
    assert.deepEqual(fact(w, "Ольга", "DEAT").origin, USER);
    assert.equal(fact(w, "Ольга", "DEAT").date, "1922");
  } finally {
    w.cleanup();
  }
});
