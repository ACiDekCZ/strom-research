// Who read a source, and when a fact is proven (spec 022 K1, K2b): a write of "user" alone is no reading of the user's
// — only a transcript typed by hand at the person's own terminal (or one the Strom app says counts) is; proven needs
// the original record itself with primary information. A research an older strom wrote is set right once by itself
// (readers, proven-originals: one commit each, put back by strom fixes undo); a fact the user made proven stays and
// waits in What waits; a file of another program never makes the user a reader or a fact proven, and an old file of
// the research brings no proven back.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "./../helpers.ts";
import { NEW_TREE_SETTLED, now, Tree } from "../../src/core/tree.ts";
import { changeLines } from "../../src/core/changelog.ts";
import { READERS_SETTLED, transcriptMark, typedByHand, userReading } from "../../src/core/readers.ts";
import { PROVEN_SETTLED, provenToReview, settleProven } from "../../src/core/provenfix.ts";
import { settleReaders } from "../../src/core/readerfix.ts";
import { readByOthers, readersOf } from "../../src/core/review.ts";
import { readGedcom } from "../../src/core/sync.ts";
import { waitingFor } from "../../src/core/waiting.ts";
import { ui } from "../../src/cli/ui.ts";
import type { Event, Person, Source } from "../../src/core/model.ts";

const opts = { skip: !hasGit };

const commits = (w: World) => Number(execFileSync("git", ["rev-list", "--count", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim());
const sourceOf = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Source>(id)!;
const eventOf = (w: World, person: string, id: string) => Tree.open(w.cwd, w.env).get<Person>(person)!.events.find((e) => e.id === id)!;
const readers = (w: World, id: string) => [...(readersOf(Tree.open(w.cwd, w.env)).get(id) ?? [])].sort();

/** A research as an older strom left it: none of the markers a new one is settled with. */
function older(w: World): void {
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    tree.updateConfig((c) => {
      c.settled = (c.settled ?? []).filter((x) => x !== READERS_SETTLED && x !== PROVEN_SETTLED);
      if (!c.settled.length) delete c.settled;
    }, { op: "tree.settle", summary: "as an older strom left it" });
    tree.commit("As an older strom left it");
  });
}

/** The conversion of an old research: many sources written as "user" at once (one run of writes). */
function converted(w: World, titles: string[]): string[] {
  const tree = Tree.open(w.cwd, w.env);
  const ids: string[] = [];
  tree.withTreeLock(() => {
    for (const title of titles) {
      const id = tree.allocate("S");
      const at = now();
      tree.put({ id, type: "source", title, kind: "baptism", form: "original", information: "primary", transcript: `${title}: zápis`, notes: [], created: at, updated: at } as unknown as Source, {
        op: "source.add",
        targets: [id],
        summary: `${id} ${title}`,
      });
      ids.push(id);
    }
    tree.commit("An old research converted");
  });
  return ids;
}

/** A fact made proven as an older strom let it: on a copy (no original), by whom `by` says ("user" or a session). */
function oldProven(w: World, person: string, source: string, by: string): string {
  const tree = Tree.open(w.cwd, w.env);
  tree.actor = by;
  let id = "";
  tree.withTreeLock(() => {
    const p = tree.get<Person>(person)!;
    id = tree.allocate("E");
    const e: Event = { id, kind: "BIRT", date: "1850", status: "proven", citations: [{ source }] } as Event;
    tree.put({ ...p, events: [...p.events, e], updated: now() }, { op: "event.add", targets: [id, person], summary: `${id} BIRT of ${person} proven` });
    tree.commit(`${id} proven`);
  });
  return id;
}

async function lhotaci(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  return w;
}

test("a new research is settled from the start: the markers are the fixes' own", opts, async () => {
  assert.deepEqual([...NEW_TREE_SETTLED], [READERS_SETTLED, PROVEN_SETTLED]);
  const w = await lhotaci();
  try {
    const c = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8"));
    assert.deepEqual(c.settled, [READERS_SETTLED, PROVEN_SETTLED]);
    const n = commits(w);
    assert.equal(settleReaders(Tree.open(w.cwd, w.env)), undefined, "nothing to settle in a new research");
    assert.equal(settleProven(Tree.open(w.cwd, w.env)), undefined);
    assert.equal(commits(w), n, "no commit");
  } finally {
    w.cleanup();
  }
});

test("K1.2: a transcript is the user's reading only when typed by hand at the person's terminal — no agent, no app, no batch, no session", opts, async () => {
  assert.equal(typedByHand({}, { tty: true }), true);
  assert.equal(typedByHand({}, { tty: false }), false, "no terminal: an agent strom does not know");
  assert.equal(typedByHand({ CLAUDECODE: "1" }, { tty: true }), false, "an agent strom knows");
  assert.equal(typedByHand({ STROM_SESSION: "N0001" }, { tty: true }), false, "a run of strom's");
  assert.equal(typedByHand({ STROM_FOR_APP: "1" }, { tty: true }), false, "the Strom app");
  assert.equal(typedByHand({ STROM_NONINTERACTIVE: "1" }, { tty: true }), false);
  assert.equal(typedByHand({}, { tty: true, batch: true }), false, "a batch");
  const w = await lhotaci();
  try {
    // decomposed input (NFD) and a non-Latin script: the mark is of the transcript as kept (NFC)
    const nfd = "Křest Vojtěcha Lhotáka, syn Jiřího.".normalize("NFD");
    await w.ok(["source", "add", "Křest Vojtěcha Lhotáka 1850", "--kind", "baptism", "--transcript", nfd], { tty: true }); // S1
    const s1 = sourceOf(w, "S0001");
    assert.equal(s1.transcript, nfd.normalize("NFC"));
    assert.equal(s1.read?.user?.how, "hand");
    assert.equal(s1.read?.user?.txt, transcriptMark(nfd.normalize("NFC")));
    assert.equal(transcriptMark(nfd), transcriptMark(nfd.normalize("NFC")), "the mark of the words, however composed");
    await w.ok(["source", "add", "Крещение Лхотака", "--kind", "baptism", "--transcript", "Войтех, сын Иржи."], { tty: true }); // S2
    assert.equal(sourceOf(w, "S0002").read?.user?.how, "hand");
    // not typed by hand: no reading of the user's
    await w.ok(["source", "add", "Křest Jiřího Lhotáka 1822", "--kind", "baptism", "--transcript", "Jiří, syn Václava."]); // S3, no terminal
    await w.ok(["source", "add", "Křest Anny Lhotákové 1852", "--kind", "baptism", "--transcript", "Anna, dcera Jiřího."], { tty: true, env: { CLAUDECODE: "1" } }); // S4
    await w.ok(["batch", 'source add "Křest Marie Lhotákové 1854" --kind baptism --transcript "Marie, dcera Jiřího."'], { tty: true }); // S5
    for (const id of ["S0003", "S0004", "S0005"]) {
      assert.equal(sourceOf(w, id).read?.user, undefined, id);
      assert.ok(!readers(w, id).includes("user"), `${id}: no reading of the user's`);
    }
    assert.deepEqual(readers(w, "S0001"), ["user"]);
    // without a terminal (an agent's): the person's reading is never changed — the new wording proposed to them (K2.3)
    await w.ok(["source", "edit", "S1", "--transcript", "Křest Vojtěcha Lhotáka, syn Jiřího a Ludmily.", "--reason", "čteno znovu"]);
    assert.equal(userReading(sourceOf(w, "S0001"))?.how, "hand");
    // the person's own batch changes it, typed by nobody: the reading was of other words, it counts no more
    await w.ok(["batch", 'source edit S1 --transcript "Křest Vojtěcha Lhotáka, syn Jiřího a Ludmily." --reason "čteno znovu"'], { tty: true });
    assert.equal(userReading(sourceOf(w, "S0001")), undefined);
    assert.deepEqual(readers(w, "S0001"), []);
  } finally {
    w.cleanup();
  }
});

test("K1.5, K1.6: a source nobody read may be offered for a reading; looking at it changes no reader", opts, async () => {
  assert.equal(readByOthers(undefined, "opus"), true, "nobody read it: worth a reading");
  assert.equal(readByOthers(new Set(), "opus", false), false, "only when readings of unknown models are asked");
  assert.equal(readByOthers(new Set(["user"]), "opus"), false, "the user read it");
  const w = await lhotaci();
  try {
    await w.ok(["source", "add", "Křest Vojtěcha Lhotáka 1850", "--kind", "baptism", "--transcript", "Vojtěch, syn Jiřího."]);
    const before = Tree.open(w.cwd, w.env).readOps().length;
    const n = commits(w);
    await w.ok(["source", "show", "S1"]);
    await w.ok(["source", "show", "S1", "--json"]);
    assert.equal(Tree.open(w.cwd, w.env).readOps().length, before, "nothing written");
    assert.equal(commits(w), n);
    assert.deepEqual(readers(w, "S0001"), []);
  } finally {
    w.cleanup();
  }
});

test("K1.1, K1.4: an older research set right once — the sources only a conversion wrote lose the user's reading, one written by hand keeps it; the changes line; undo", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["source", "add", "Oddací list Lhotákových", "--kind", "marriage", "--transcript", "Jiří Lhoták a Ludmila Lhotová."]); // S1, a person's command
    const bulk = converted(w, ["Křest Jiřího Lhotáka", "Křest Ludmily Lhotové", "Křest Václava Lhotáka", "Pohřeb Václava Lhotáka", "Křest Anny Lhotákové", "Křest Marie Lhotákové"]);
    older(w);
    // as an older strom counted it: every write of "user" a reading
    assert.deepEqual(readers(w, "S0001"), ["user"]);
    assert.deepEqual(readers(w, bulk[0]!), ["user"]);
    const shown = await w.ok(["fixes", "show", "readers", "--lang", "en"]);
    assert.match(shown.out, /Found: 7 sources counted as read by the user — 6 written only by a run of many writes to lose it, 1 written by hand to keep it/);
    const n = commits(w);
    const done = settleReaders(Tree.open(w.cwd, w.env));
    assert.deepEqual(done, { changed: 6, kept: 1 });
    assert.equal(commits(w), n + 1, "one commit");
    assert.equal(settleReaders(Tree.open(w.cwd, w.env)), undefined, "once");
    for (const id of bulk) assert.deepEqual(readers(w, id), [], `${id}: no reader — may be read`);
    assert.equal(sourceOf(w, "S0001").read?.user?.how, "earlier");
    assert.deepEqual(readers(w, "S0001"), ["user"]);
    const tree = Tree.open(w.cwd, w.env);
    const ops = tree.readOps().filter((o) => o.op === "readers.fix");
    assert.equal(ops.length, 1);
    assert.deepEqual(changeLines(tree, ops, "", "cs").map((l) => l.text), ["Čtenář opraven u 6 pramenů: samotný zápis uživatele není čtení"]);
    assert.deepEqual(changeLines(tree, ops, "", "en").map((l) => l.text), ["Reader set right on 6 sources: a write of the user alone is no reading"]);
    assert.equal((await w.ok(["fixes", "--json"])).json.checks.find((c: { id: string }) => c.id === "readers").state, "fixed");
    assert.equal((await w.run(["verify", "--json"])).code, 0, "sealed");
    // put back: the person's alone
    assert.equal((await w.run(["fixes", "undo", "readers"], { env: { CLAUDECODE: "1" } })).code, 4);
    const u = await w.ok(["fixes", "undo", "readers", "--lang", "en"], { tty: true });
    assert.match(u.out, /Read by the user again: 6 sources/);
    for (const id of bulk) assert.deepEqual(readers(w, id), ["user"], id);
    const back = Tree.open(w.cwd, w.env);
    assert.deepEqual(changeLines(back, back.readOps().filter((o) => o.op === "readers.unfix"), "", "cs").map((l) => l.text), ["Znovu přečteno uživatelem: 6 pramenů"]);
  } finally {
    w.cleanup();
  }
});

test("K1.1, K2b.5 a: another program's GEDCOM — no reader \"user\", nothing proven; its marks of the app's readings are not taken", opts, async () => {
  const w = await lhotaci();
  try {
    const ged = path.join(w.dir, "cizi.ged");
    fs.writeFileSync(
      ged,
      [
        "0 HEAD",
        "1 SOUR OTHER_PROGRAM",
        "1 _STROM_TRANSCRIPTS evidence",
        "1 CHAR UTF-8",
        "0 @I1@ INDI",
        "1 NAME Vojtěch /Lhoták/",
        "1 SEX M",
        "1 BIRT",
        "2 DATE 3 MAR 1850",
        "2 PLAC Lhota",
        "2 SOUR @S1@",
        "3 QUAY 3",
        "0 @I2@ INDI",
        "1 NAME Войтех /Лхотак/",
        "1 BIRT",
        "2 DATE 1852",
        "0 @S1@ SOUR",
        "1 TITL Matrika Lhota",
        "1 TEXT Vojtěch, syn Jiřího.",
        "1 _STROM_VERIFIED Y",
        "0 TRLR",
        "",
      ].join("\n"),
    );
    // the file read as the sync reads it: no transcript that counts, nothing verified
    const snap = readGedcom(fs.readFileSync(ged, "utf8"));
    assert.equal(snap.transcripts, "lead");
    assert.ok([...(snap.sources?.values() ?? [])].every((s) => !s.verified));
    // the Strom app's own file: its words are taken (K1.3)
    const app = readGedcom(fs.readFileSync(ged, "utf8").replace("1 SOUR OTHER_PROGRAM", "1 SOUR STROM"));
    assert.equal(app.transcripts, "evidence");
    assert.ok([...(app.sources?.values() ?? [])].some((s) => s.verified));
    await w.ok(["intake", ged]);
    const tree = Tree.open(w.cwd, w.env);
    const facts = [...tree.list<Person>("person")].flatMap((p) => p.events);
    assert.ok(facts.length >= 2);
    assert.ok(facts.every((e) => e.status === "lead"), "every fact a lead");
    const by = readersOf(tree);
    for (const s of tree.list<Source>("source")) {
      assert.equal(s.read?.user, undefined, s.id);
      assert.ok(!by.get(s.id)?.has("user"), `${s.id}: no reader "user"`);
    }
  } finally {
    w.cleanup();
  }
});

test("K2b.1: proven only on the original record with primary information; a copy or an index at most probable", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P1
    await w.ok(["source", "add", "Křest Vojtěcha Lhotáka 1850", "--kind", "baptism", "--information", "primary", "--transcript", "Vojtěch, syn Jiřího."]); // S1, original
    await w.ok(["source", "add", "Opis křtu Vojtěcha Lhotáka", "--kind", "baptism", "--form", "derivative", "--information", "primary"]); // S2, a copy
    await w.ok(["source", "add", "Křest Vojtěcha Lhotáka (pozdější zápis)", "--kind", "baptism", "--information", "secondary"]); // S3
    const copy = await w.run(["event", "add", "P1", "BIRT", "--date", "1850", "--cite", "S2", "--status", "proven", "--json"]);
    assert.notEqual(copy.code, 0);
    assert.match(copy.out + copy.err, /proven needs the original record itself/);
    const secondary = await w.run(["event", "add", "P1", "BIRT", "--date", "1850", "--cite", "S3", "--status", "proven"]);
    assert.notEqual(secondary.code, 0);
    assert.match(secondary.out + secondary.err, /primary information/);
    await w.ok(["event", "add", "P1", "BIRT", "--date", "1850", "--cite", "S2", "--status", "probable"]); // E1
    await w.ok(["event", "add", "P1", "CHR", "--date", "1850", "--cite", "S1", "--status", "proven"]); // E2
    assert.equal(eventOf(w, "P0001", "E0002").status, "proven");
  } finally {
    w.cleanup();
  }
});

test("K2b.3: an older research's proven without the original — an agent's made probable, the user's waits in What waits; the changes line; review and undo", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P1
    await w.ok(["person", "add", "Ludmila /Lhotová/", "--sex", "F"]); // P2
    await w.ok(["source", "add", "Opis křtu Vojtěcha Lhotáka", "--kind", "baptism", "--form", "derivative", "--information", "primary"]); // S1
    await w.ok(["source", "add", "Křest Ludmily Lhotové 1852", "--kind", "baptism", "--information", "primary"]); // S2, the original
    const agents = oldProven(w, "P0001", "S0001", "N0001"); // an agent's, on a copy
    const users = oldProven(w, "P0002", "S0001", "user"); // the user's own, on a copy
    const backed = oldProven(w, "P0002", "S0002", "N0001"); // on the original: stays
    older(w);
    const n = commits(w);
    const done = settleProven(Tree.open(w.cwd, w.env));
    assert.deepEqual(done, { changed: 1, left: 1 });
    assert.equal(commits(w), n + 1, "one commit");
    assert.equal(eventOf(w, "P0001", agents).status, "probable");
    assert.equal(eventOf(w, "P0002", users).status, "proven", "the user's word never lowered unasked");
    assert.equal(eventOf(w, "P0002", backed).status, "proven");
    const tree = Tree.open(w.cwd, w.env);
    const fix = tree.readOps().filter((o) => o.op === "proven.fix");
    assert.equal(fix.length, 1);
    assert.match(fix[0]!.reason ?? "", /original record/);
    assert.deepEqual(changeLines(tree, fix, "", "cs").map((l) => l.text), ["Doloženo bez originálu → Pravděpodobné: 1 údaj", "Doloženo uživatelem bez originálu, k prověření: 1 údaj"]);
    // What waits: one item with the count, in the shape of the others
    const items = waitingFor(tree).filter((x) => x.item.kind === "proven");
    assert.equal(items.length, 1);
    const it = items[0]!.item;
    assert.equal(it.id, "W-proven");
    assert.equal(it.section, "decide");
    assert.equal(it.count, 1);
    assert.deepEqual(it.facts, [users]);
    assert.ok(it.at, "since when");
    assert.match(it.what, /^1 údaj doložený uživatelem bez originálu záznamu/);
    // the person's answer alone
    assert.equal((await w.run(["fixes", "review", "proven-originals", "keep"], { env: { CLAUDECODE: "1" } })).code, 4);
    const kept = await w.ok(["fixes", "review", "proven-originals", "keep", "--lang", "en"], { tty: true });
    assert.match(kept.out, /Kept proven: 1 fact/);
    assert.equal(eventOf(w, "P0002", users).status, "proven");
    assert.deepEqual(provenToReview(Tree.open(w.cwd, w.env)), [], "not asked again");
    assert.equal(waitingFor(Tree.open(w.cwd, w.env)).filter((x) => x.item.kind === "proven").length, 0);
    // undo: proven again
    const u = await w.ok(["fixes", "undo", "proven-originals", "--lang", "en"], { tty: true });
    assert.match(u.out, /Proven again: 1 fact/);
    assert.equal(eventOf(w, "P0001", agents).status, "proven");
  } finally {
    w.cleanup();
  }
});

test("K2b.3: the user's proven made probable at their word (lower)", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P1
    await w.ok(["source", "add", "Opis křtu Vojtěcha Lhotáka", "--kind", "baptism", "--form", "derivative", "--information", "primary"]); // S1
    const users = oldProven(w, "P0001", "S0001", "user");
    older(w);
    settleProven(Tree.open(w.cwd, w.env));
    const r = await w.ok(["fixes", "review", "proven-originals", "lower", users, "--lang", "en"], { tty: true });
    assert.match(r.out, /Made probable: 1 fact/);
    assert.equal(eventOf(w, "P0001", users).status, "probable");
    const tree = Tree.open(w.cwd, w.env);
    assert.deepEqual(changeLines(tree, tree.readOps().filter((o) => o.op === "proven.lower"), "", "cs").map((l) => l.text), ["Uživatel převedl doložené bez originálu na pravděpodobné: 1 údaj"]);
  } finally {
    w.cleanup();
  }
});

test("K2b.5 b, c: the research's own Strom file keeps each certainty and reader as it is; an old file of before the fix brings no proven back", opts, async () => {
  const w = await lhotaci();
  try {
    await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P1
    await w.ok(["source", "add", "Opis křtu Vojtěcha Lhotáka", "--kind", "baptism", "--form", "derivative", "--information", "primary"]); // S1
    await w.ok(["source", "add", "Křest Vojtěcha Lhotáka 1850", "--kind", "baptism", "--information", "primary", "--transcript", "Vojtěch, syn Jiřího."], { tty: true }); // S2, read by hand
    await w.ok(["event", "add", "P1", "CHR", "--date", "1850", "--cite", "S2", "--status", "proven"]); // E1, on the original
    const agents = oldProven(w, "P0001", "S0001", "N0001"); // E2, proven on a copy by an older strom
    const old = path.join(w.dir, "old.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", old], { env: { STROM_APP_VERSION: "3.24.0" } });
    assert.match(fs.readFileSync(old, "utf8"), /_STROM_STATUS proven/);
    older(w);
    settleProven(Tree.open(w.cwd, w.env));
    assert.equal(eventOf(w, "P0001", agents).status, "probable");
    const before = JSON.stringify(Tree.open(w.cwd, w.env).get<Person>("P0001")!.events.map((e) => [e.id, e.status]));
    const s2 = JSON.stringify(sourceOf(w, "S0002").read);
    // the old file of this research imported again: its people are ours, nothing of theirs changes
    await w.ok(["intake", old]);
    assert.equal(JSON.stringify(Tree.open(w.cwd, w.env).get<Person>("P0001")!.events.filter((e) => e.id === "E0001" || e.id === agents).map((e) => [e.id, e.status])), before);
    assert.equal(JSON.stringify(sourceOf(w, "S0002").read), s2, "the reader kept exactly");
    // …and synced: no proven back either
    const synced = await w.run(["sync", old, "--yes", "--json"]);
    assert.equal(synced.code, 0, synced.out + synced.err);
    assert.equal(eventOf(w, "P0001", agents).status, "probable", "no old proven back without the original");
    assert.equal(eventOf(w, "P0001", "E0001").status, "proven");
    assert.equal(JSON.stringify(sourceOf(w, "S0002").read), s2);
  } finally {
    w.cleanup();
  }
});

test("K2b.2: accepting the app's reading says what the sync writes — probable; proven only on the original with primary information", () => {
  for (const key of ["ui.sync.do.source.verified", "ui.sync.do.source.verified.read"] as const) {
    assert.match(ui("en", key), /become probable — proven only on the original record with primary information/);
    assert.match(ui("cs", key), /se stanou pravděpodobnými – doloženými až s originálem záznamu s primární informací/);
    assert.match(ui("de", key), /werden wahrscheinlich – belegt erst mit dem Originaleintrag/);
    assert.match(ui("pl", key), /staną się prawdopodobne – udokumentowane dopiero z oryginałem/);
  }
});
