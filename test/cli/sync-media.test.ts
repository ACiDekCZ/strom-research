// The Strom app's files in the tree it sends (spec 108 U7, 102 U3): a portrait, a couple's photo, attachments of a
// person, a couple, an event and a source — each one record of the material (data/inputs), known by its original's hash
// (_STROM_SHA) or its bytes', its working copy kept exactly as it came in the shared store, its places links of the
// record. Only added (a record, a place, a portrait's new version, the user's title, kind, date, note), never a conflict,
// never a task, the same in a research, an archive and one waiting for its agent; sync undo takes it all back, the bytes
// stay. The bridge's answer says what came of each file (`media`).

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const img = (name: string) => fs.readFileSync(path.join(fixtures, name));
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

const PORTRAIT = img("s0001.jpg");
const PORTRAIT2 = img("s0003.jpg");
const ORIGINAL = img("s0002.jpg");
const WORKING = img("grey.jpg");
const DEATH = img("png-rgb.png");
const ENTRY = img("png-grey.png");
const COUPLE = img("base420.jpg");
const COUPLE_MORE = img("base444.jpg");
const PAGE = img("png-pal.png");
const LETTER_SHA = "c".repeat(64);

type Rec = { id: string; sha?: string; file?: string; name: string; title?: string; titled?: { by: string }; materialKind?: string; date?: string; origin?: string; working?: { sha: string; width?: number; height?: number }; notes: { text: string; by?: string }[]; persons?: string[]; retracted?: unknown; links?: { type: string; ref: string; event?: string; input?: string; retracted?: { reason: string } }[] };

/** No agent on this computer: the research waits for it. */
function noAgent(w: World): void {
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
}

/** Václav Lhoták (P1, died 1960 in Lhota citing S1) and Eva Lhotáková (P2), married in Lhota (F1); the file the app was given. */
async function world(state: "research" | "archive" | "waiting" = "research"): Promise<{ w: World; given: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1890"]); // P1
  await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F", "--born", "1893"]); // P2
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F1
  await w.ok(["event", "add", "F1", "MARR", "--date", "1915", "--place", "Lhota"]);
  await w.ok(["source", "add", "Matrika zemřelých Lhota", "--kind", "burial"]); // S1
  await w.ok(["event", "add", "P1", "DEAT", "--date", "1960", "--place", "Lhota", "--cite", "S0001"]);
  if (state === "archive") await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
  if (state === "waiting") noAgent(w);
  const given = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  return { w, given };
}

/** A file's lines as the app writes them: its data URL in pieces (CONC), its fields under it. */
function obje(level: number, o: { data?: Buffer; mime?: string; file?: string; sha?: string; name?: string; titl?: string; form?: string; type?: string; date?: string; note?: string; kind?: string; prim?: boolean; sour?: string; orient?: number; ref?: string }): string[] {
  if (o.ref) return [`${level} OBJE ${o.ref}`];
  const l = (n: number, s: string) => `${level + n} ${s}`;
  const out = [`${level} OBJE`];
  if (o.data) {
    const url = `data:${o.mime ?? "image/jpeg"};base64,${o.data.toString("base64")}`;
    const parts = url.match(/.{1,180}/gs)!;
    out.push(l(1, `FILE ${parts[0]}`), ...parts.slice(1).map((p) => l(2, `CONC ${p}`)));
  } else if (o.file) out.push(l(1, `FILE ${o.file}`));
  if (o.form) out.push(l(1, `FORM ${o.form}`), ...(o.type ? [l(2, `TYPE ${o.type}`)] : []));
  if (o.titl) out.push(l(1, `TITL ${o.titl}`));
  if (o.name) out.push(l(1, `_STROM_NAME ${o.name}`));
  if (o.kind) out.push(l(1, `_STROM_KIND ${o.kind}`));
  if (o.sha) out.push(l(1, `_STROM_SHA ${o.sha}`));
  if (o.orient) out.push(l(1, `_STROM_ORIENT ${o.orient}`));
  if (o.date) out.push(l(1, `_DATE ${o.date}`));
  if (o.note) out.push(l(1, `NOTE ${o.note}`));
  if (o.prim) out.push(l(1, "_PRIM Y"));
  if (o.sour) out.push(l(1, `_SOUR ${o.sour}`));
  return out;
}

/** A record of the file: by its REFN (a person), or its xref and tag ("@F0001@ FAM"). */
const isRecord = (r: string, which: string) => new RegExp(`\\n1 REFN ${which}\\n`).test(`${r}\n`) || r.startsWith(`0 ${which}`);

/** The file's records (split at level 0); one of them with lines added at its end. */
function under(t: string, which: string, lines: string[]): string {
  return t
    .split(/\n(?=0 )/)
    .map((r) => (isRecord(r, which) ? `${r.replace(/\n+$/, "")}\n${lines.join("\n")}` : r))
    .join("\n");
}

/** Lines added under a fact of a record (its first line of that tag), after what it has. */
function underFact(t: string, refn: string, tag: string, lines: string[]): string {
  return t
    .split(/\n(?=0 )/)
    .map((r) => {
      if (!isRecord(r, refn)) return r;
      const rows = r.split("\n");
      const at = rows.findIndex((x) => x === `1 ${tag}` || x.startsWith(`1 ${tag} `));
      assert.ok(at >= 0, `no ${tag} in ${refn}`);
      let end = at + 1;
      while (end < rows.length && !/^[01] /.test(rows[end]!)) end++;
      return [...rows.slice(0, end), ...lines, ...rows.slice(end)].join("\n");
    })
    .join("\n");
}

/** The xref the file gives a source of the research (by its REFN). */
const sourceXref = (t: string, id: string) => new RegExp(`0 (@[^@]+@) SOUR\\n(?:[1-9].*\\n)*?1 REFN ${id}\\n`).exec(t)?.[1] ?? assert.fail(`no ${id} in the file`);

/** The file as the app 3.31 sends it: every kind of place a file has. */
function withFiles(t: string): string {
  let out = t.replace(/^1 SOUR STROM_RESEARCH$/m, "1 SOUR STROM\n2 VERS 3.31.0");
  const s1 = sourceXref(out, "S0001");
  out = under(out, "P0001", [
    ...obje(1, { data: PORTRAIT, form: "jpg", titl: "Václav.jpg", kind: "photo" }),
    // an attachment whose original the research keeps: its working copy and the user's title, kind, date, note
    ...obje(1, { data: WORKING, form: "jpg", type: "photo", titl: "Svatba v Lhotě", name: "svatba-1915.jpg", sha: sha(ORIGINAL), date: "1915", note: "Na schodech kostela", orient: 6 }),
    // the original alone (no image the app could show): known by its hash
    ...obje(1, { file: "dopis.pdf", form: "pdf", type: "document", sha: LETTER_SHA }),
    // an attachment that belongs to a source too
    ...obje(1, { data: ENTRY, mime: "image/png", form: "png", titl: "zapis.png", sour: s1 }),
  ]);
  out = underFact(out, "P0001", "DEAT", obje(2, { data: DEATH, mime: "image/png", form: "png", titl: "parte.png" }));
  out = under(out, "@F0001@ FAM", [...obje(1, { data: COUPLE, form: "jpg", titl: "svatba.jpg" }), ...obje(1, { data: COUPLE_MORE, form: "jpg", titl: "pozvanka.jpg" })]);
  out = under(out, `${s1} SOUR`, obje(1, { data: PAGE, mime: "image/png", form: "png", titl: "strana-12.png" }));
  return out;
}

const records = (w: World): Rec[] =>
  fs
    .readdirSync(path.join(w.cwd, "data", "inputs"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "inputs", f), "utf8")) as Rec);
/** The record of a file by its hash or its working copy's. */
const recordOf = (w: World, h: string): Rec | undefined => records(w).find((r) => !r.retracted && (r.sha === h || r.working?.sha === h));
const live = (r: Rec | undefined) => (r?.links ?? []).filter((l) => !l.retracted).map((l) => `${l.type}:${l.ref}${l.event ? `:${l.event}` : ""}`);

/** Where the shared store keeps bytes of this hash (media/ab/cd/<sha>.<ext>), anywhere in the world. */
function stored(w: World, h: string): string | undefined {
  const walk = (dir: string): string | undefined => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && e.name !== ".git") {
        const got = walk(p);
        if (got) return got;
      } else if (e.isFile() && e.name.startsWith(`${h}.`) && p.includes(`${path.sep}media${path.sep}${h.slice(0, 2)}${path.sep}${h.slice(2, 4)}${path.sep}`)) return p;
    }
    return undefined;
  };
  return walk(w.dir);
}

const tasks = async (w: World): Promise<string[]> => ((await w.ok(["task", "list", "--all", "--json"])).json.tasks as { id: string }[]).map((t) => t.id);
const headOf = (w: World) => execFileSync("git", ["rev-parse", "HEAD"], { cwd: w.cwd, encoding: "utf8" }).trim();

/** The original the app sends first (PUT /media, as the bridge takes it): material of Václav. */
async function original(w: World): Promise<string> {
  const f = path.join(w.dir, "prijato.jpg");
  fs.writeFileSync(f, ORIGINAL);
  const r = (await w.ok(["media", "original", f, "--sha", sha(ORIGINAL), "--name", "svatba-1915.jpg", "--person", "P0001", "--json"])).json;
  return (r.input ?? r.known) as string;
}

for (const state of ["research", "archive", "waiting"] as const)
  test(`spec 108 (${state}): a portrait, attachments with an original, of the original alone, of a source, of an event, a couple's photo and its attachment, a source's file — records and places, the bytes kept as they came, no task`, opts, async () => {
    const { w, given } = await world(state);
    const orig = await original(w);
    const before = await tasks(w);
    const file = path.join(w.dir, "app.ged");
    fs.writeFileSync(file, withFiles(fs.readFileSync(given, "utf8")));
    // shown first: a line for each file, nothing written yet
    const shown = await w.run(["sync", file], { tty: true });
    assert.equal(shown.code, 0, shown.out + shown.err);
    assert.match(shown.out, /Václav Lhoták \[P0001\]: portrét — Václav\.jpg → uloží se do materiálu výzkumu/, shown.out);
    assert.match(shown.out, /fotka páru — svatba\.jpg/, shown.out);
    assert.match(shown.out, /soubor k údaji .+ — parte\.png/, shown.out);
    assert.equal(recordOf(w, sha(PORTRAIT)), undefined, "nothing written before --apply");
    const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
    assert.ok(r.input, JSON.stringify(r));
    assert.deepEqual(r.skipped ?? [], []);
    assert.deepEqual((r.changes as { action: string; code?: string }[]).filter((c) => c.action === "report"), [], "nothing left unwritten");
    const sync = r.input as string;

    // the portrait: a record of its own, the bytes in the shared store exactly as sent
    const portrait = recordOf(w, sha(PORTRAIT))!;
    assert.ok(portrait, "the portrait's record");
    assert.deepEqual([portrait.origin, live(portrait), portrait.name], ["portrait", ["personPortrait:P0001"], "Václav.jpg"]);
    assert.ok(portrait.file?.startsWith("media:"), portrait.file);
    assert.equal(portrait.links![0]!.input, sync, "the place says which send gave it");
    for (const b of [PORTRAIT, WORKING, DEATH, ENTRY, COUPLE, COUPLE_MORE, PAGE]) {
      const at = stored(w, sha(b));
      assert.ok(at, "kept in the shared store");
      assert.equal(sha(fs.readFileSync(at)), sha(b), "exactly as it came");
    }
    // the attachment whose original came first: that record, never a second one
    const att = recordOf(w, sha(ORIGINAL))!;
    assert.equal(att.id, orig, "the original's record");
    assert.equal(records(w).filter((x) => x.sha === sha(ORIGINAL)).length, 1, "the original not doubled");
    assert.deepEqual([att.working?.sha, att.working?.width, att.working?.height], [sha(WORKING), 61, 39]);
    assert.deepEqual([att.title, att.titled?.by, att.materialKind, att.date, att.name], ["Svatba v Lhotě", "user", "photo", "1915", "svatba-1915.jpg"]);
    assert.ok(att.notes.some((n) => n.text === "Na schodech kostela" && n.by === "user"), JSON.stringify(att.notes));
    assert.deepEqual(live(att), ["person:P0001"]);
    assert.deepEqual(att.persons, ["P0001"], "its people as before");
    // the original alone: a record by its hash, no file yet, no working copy
    const letter = recordOf(w, LETTER_SHA)!;
    assert.deepEqual([letter.file, letter.working, letter.materialKind, letter.name, live(letter)], [undefined, undefined, "document", "dopis.pdf", ["person:P0001"]]);
    // a person's file that belongs to a source too, the source's own file, the event's file
    assert.deepEqual(live(recordOf(w, sha(ENTRY))).sort(), ["person:P0001", "source:S0001"]);
    assert.deepEqual(live(recordOf(w, sha(PAGE))), ["source:S0001"]);
    const death = (await w.ok(["person", "show", "P1", "--json"])).json.person.events.find((e: { kind: string }) => e.kind === "DEAT").id as string;
    assert.deepEqual(live(recordOf(w, sha(DEATH))), [`event:P0001:${death}`]);
    // the couple's photo and its other file
    assert.deepEqual([recordOf(w, sha(COUPLE))?.origin, live(recordOf(w, sha(COUPLE)))], ["couple", ["familyPhoto:F0001"]]);
    assert.deepEqual(live(recordOf(w, sha(COUPLE_MORE))), ["family:F0001"]);
    // no task of a file, in every state
    assert.deepEqual(await tasks(w), before, "no task");

    // the same tree again: nothing new — no input, no commit
    const head = headOf(w);
    fs.writeFileSync(file, `${fs.readFileSync(file, "utf8")}\n`);
    const again = (await w.ok(["sync", file, "--apply", "--json"])).json;
    assert.deepEqual([again.input ?? null, again.changes], [null, []], JSON.stringify(again.changes));
    assert.equal(headOf(w), head, "no commit");
    w.cleanup();
  });

test("spec 108: one file at two people is one record with two places; the app's 0 @M1@ OBJE with its places pointing at it is the same", opts, async () => {
  const { w, given } = await world();
  let t = fs.readFileSync(given, "utf8").replace(/^1 SOUR STROM_RESEARCH$/m, "1 SOUR STROM\n2 VERS 3.31.0");
  // inline, at both
  const inline = obje(1, { data: COUPLE, form: "jpg", titl: "Rodina", name: "rodina.jpg" });
  t = under(under(t, "P0001", inline), "P0002", inline);
  // a record of its own, pointed at from both and from the marriage
  t = under(under(t, "P0001", obje(1, { ref: "@M1@" })), "P0002", obje(1, { ref: "@M1@" }));
  t = underFact(t, "@F0001@ FAM", "MARR", obje(2, { ref: "@M1@" }));
  t = t.replace(/\n0 TRLR/, `\n${["0 @M1@ OBJE", ...obje(0, { data: PAGE, mime: "image/png", form: "png", type: "document", titl: "Oddací list", name: "oddaci-list.png" }).slice(1)].join("\n")}\n0 TRLR`);
  const file = path.join(w.dir, "app.ged");
  fs.writeFileSync(file, t);
  await w.ok(["sync", file, "--apply", "--json"]);
  assert.equal(records(w).filter((r) => r.sha === sha(COUPLE)).length, 1, "one record");
  assert.deepEqual(live(recordOf(w, sha(COUPLE))).sort(), ["person:P0001", "person:P0002"]);
  const m1 = recordOf(w, sha(PAGE))!;
  assert.equal(records(w).filter((r) => r.sha === sha(PAGE)).length, 1);
  const marr = (await w.ok(["family", "show", "F1", "--json"])).json.family.events.find((e: { kind: string }) => e.kind === "MARR").id as string;
  assert.deepEqual(live(m1).sort(), [`event:F0001:${marr}`, "person:P0001", "person:P0002"]);
  assert.deepEqual([m1.title, m1.name, m1.materialKind], ["Oddací list", "oddaci-list.png", "document"]);
  w.cleanup();
});

test("spec 108: the title with its name (_STROM_NAME) in any script and NFD kept NFC; an older app's file (TITL alone, no TYPE) only named; a character that cannot be read kept and said", opts, async () => {
  const { w, given } = await world();
  let t = fs.readFileSync(given, "utf8").replace(/^1 SOUR STROM_RESEARCH$/m, "1 SOUR STROM\n2 VERS 3.31.0");
  t = under(t, "P0001", [
    ...obje(1, { data: COUPLE, form: "jpg", type: "record", titl: "Babička u studny".normalize("NFD"), name: "Ščípek.jpg".normalize("NFD"), date: "ABT 1924" }),
    ...obje(1, { data: COUPLE_MORE, form: "jpg", type: "photo", titl: "Бабушка у колодца", name: "Колодец.jpg" }),
    // the app before 3.31: the file's name as its TITL, no kind
    ...obje(1, { data: PAGE, mime: "image/png", form: "png", titl: "stary-sken.png" }),
    // another program's word for a kind: none
    ...obje(1, { data: ENTRY, mime: "image/png", form: "png", type: "picture", titl: "Lhota � náves", name: "naves.png" }),
  ]);
  const file = path.join(w.dir, "app.ged");
  fs.writeFileSync(file, t);
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  const a = recordOf(w, sha(COUPLE))!;
  assert.deepEqual([a.title, a.name, a.materialKind, a.date], ["Babička u studny", "Ščípek.jpg", "record", "ABT 1924"]);
  assert.equal(a.title, a.title!.normalize("NFC"));
  const b = recordOf(w, sha(COUPLE_MORE))!;
  assert.deepEqual([b.title, b.name, b.materialKind], ["Бабушка у колодца", "Колодец.jpg", "photo"]);
  const old = recordOf(w, sha(PAGE))!;
  assert.deepEqual([old.title, old.name, old.materialKind], [undefined, "stary-sken.png", undefined]);
  // kept as it came, said — never renamed quietly
  const g = recordOf(w, sha(ENTRY))!;
  assert.deepEqual([g.title, g.materialKind], ["Lhota � náves", undefined]);
  const said = (r.changes as { code?: string; action: string; media?: { record?: string } }[]).filter((c) => c.code === "media.unreadable");
  assert.equal(said.length, 1, JSON.stringify(r.changes));
  assert.equal(said[0]!.media?.record, g.id);
  w.cleanup();
});

test("spec 108: a new portrait is a new version — the place taken from the one before (replaced), never doubled; sync undo puts it all back and the bytes stay", opts, async () => {
  const { w, given } = await world();
  const app = (bytes: Buffer, extra: string[] = []) => under(fs.readFileSync(given, "utf8").replace(/^1 SOUR STROM_RESEARCH$/m, "1 SOUR STROM\n2 VERS 3.31.0"), "P0001", [...obje(1, { data: bytes, form: "jpg", titl: "portret.jpg", kind: "photo" }), ...extra]);
  const send = async (name: string, text: string) => {
    const file = path.join(w.dir, name);
    fs.writeFileSync(file, text);
    return (await w.ok(["sync", file, "--apply", "--json"])).json;
  };
  const first = await send("a.ged", app(PORTRAIT));
  const one = recordOf(w, sha(PORTRAIT))!;
  // a new portrait, and an attachment, and the original of a file the app gives later
  const orig = await original(w);
  const second = await send("b.ged", app(PORTRAIT2, obje(1, { data: WORKING, form: "jpg", titl: "Svatba", name: "svatba-1915.jpg", sha: sha(ORIGINAL) })));
  const two = recordOf(w, sha(PORTRAIT2))!;
  assert.notEqual(two.id, one.id);
  assert.deepEqual(live(two), ["personPortrait:P0001"]);
  const was = records(w).find((r) => r.id === one.id)!;
  assert.deepEqual(live(was), [], "the version before gave up its place");
  assert.deepEqual(was.links!.map((l) => [l.type, l.retracted?.reason]), [["personPortrait", "replaced"]]);
  assert.ok(stored(w, sha(PORTRAIT)), "the version before kept");
  const v = (second.changes as { kind: string; media?: { replaces?: string } }[]).find((c) => c.kind === "media.photo")!;
  assert.equal(v.media?.replaces, one.id);
  // the same again: the place not doubled
  await send("c.ged", `${app(PORTRAIT2, obje(1, { data: WORKING, form: "jpg", titl: "Svatba", name: "svatba-1915.jpg", sha: sha(ORIGINAL) }))}\n`);
  assert.equal(records(w).find((r) => r.id === two.id)!.links!.length, 1);
  assert.equal(recordOf(w, sha(ORIGINAL))!.links!.length, 1);

  // undone: the new version withdrawn, the one before in its place again, the original's record as it was
  await w.ok(["sync", "undo", second.input]);
  assert.ok(records(w).find((r) => r.id === two.id)!.retracted, "the record the send made withdrawn");
  assert.deepEqual(live(records(w).find((r) => r.id === one.id)), ["personPortrait:P0001"]);
  const o = records(w).find((r) => r.id === orig)!;
  assert.deepEqual([o.links, o.working, o.title, o.origin], [undefined, undefined, undefined, undefined], "the original's record as before the send");
  assert.ok(stored(w, sha(PORTRAIT2)) && stored(w, sha(WORKING)), "the bytes stay in the shared store");
  await w.ok(["sync", "undo", first.input]);
  assert.ok(records(w).find((r) => r.id === one.id)!.retracted);
  w.cleanup();
});

test("spec 108: a file of an event the research does not have — at its person, said (media.eventMissing); a send of files alone is a sync of its own; the original that comes later completes the record", opts, async () => {
  const { w, given } = await world();
  const death = (await w.ok(["person", "show", "P1", "--json"])).json.person.events.find((e: { kind: string }) => e.kind === "DEAT").id as string;
  await w.ok(["event", "retract", death, "--reason", "Jiný Václav"]);
  let t = fs.readFileSync(given, "utf8").replace(/^1 SOUR STROM_RESEARCH$/m, "1 SOUR STROM\n2 VERS 3.31.0");
  t = underFact(t, "P0001", "DEAT", obje(2, { data: DEATH, mime: "image/png", form: "png", titl: "parte.png" }));
  // a file whose original the research has not got yet
  t = under(t, "P0001", obje(1, { data: WORKING, form: "jpg", titl: "Svatba", name: "svatba-1915.jpg", sha: sha(ORIGINAL) }));
  const file = path.join(w.dir, "app.ged");
  fs.writeFileSync(file, t);
  const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
  assert.ok(r.input, "a send of files alone is written: its input, its commit");
  const rec = recordOf(w, sha(DEATH))!;
  assert.deepEqual(live(rec), ["person:P0001"], "the file at its person");
  const missing = (r.changes as { code?: string; person?: string; fact?: { kind: string }; media?: { record?: string } }[]).find((c) => c.code === "media.eventMissing")!;
  assert.ok(missing, JSON.stringify(r.changes));
  assert.deepEqual([missing.person, missing.fact?.kind, missing.media?.record], ["P0001", "DEAT", rec.id]);
  // the original comes afterwards (PUT /media): that record's file now, no second record
  const waiting = recordOf(w, sha(ORIGINAL))!;
  assert.equal(waiting.file, undefined);
  const got = await original(w);
  assert.equal(got, waiting.id);
  const done = recordOf(w, sha(ORIGINAL))!;
  assert.ok(done.file?.startsWith("media:"), JSON.stringify(done));
  assert.equal(records(w).filter((x) => x.sha === sha(ORIGINAL)).length, 1);
  assert.deepEqual(live(done), ["person:P0001"]);
  w.cleanup();
});

function post(url: string, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "POST", headers: { Origin: "https://beta.stromapp.info", "Content-Type": "text/plain; charset=utf-8" } }, (res) => {
      let b = "";
      res.on("data", (d) => (b += d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: b }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

test("spec 108: the bridge's answer to POST /sync says what came of each file (media: kind, person|family|source, event, record, title) — counted in changes and applied, the same on its sends[] item", opts, async () => {
  const { w, given } = await world();
  await original(w);
  const text = withFiles(fs.readFileSync(given, "utf8"));
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  try {
    const res = await post(`${info.url}/sync`, text);
    assert.equal(res.status, 200, res.body);
    const got = JSON.parse(res.body) as { changes: number; applied: number; media: Record<string, string>[]; input: string };
    const death = (await w.ok(["person", "show", "P1", "--json"])).json.person.events.find((e: { kind: string }) => e.kind === "DEAT").id as string;
    const by = (h: string) => recordOf(w, h)!.id;
    const media = got.media.map((m) => JSON.stringify(m)).sort();
    const want = [
      { kind: "media.photo", person: "P0001", record: by(sha(PORTRAIT)) },
      { kind: "media.attachment", person: "P0001", record: by(sha(ORIGINAL)), title: "Svatba v Lhotě" },
      { kind: "media.attachment", person: "P0001", record: by(LETTER_SHA) },
      { kind: "media.attachment", person: "P0001", record: by(sha(ENTRY)) },
      { kind: "media.link", source: "S0001", record: by(sha(ENTRY)) },
      { kind: "media.link", person: "P0001", event: death, record: by(sha(DEATH)) },
      { kind: "media.couplePhoto", family: "F0001", record: by(sha(COUPLE)) },
      { kind: "media.attachment", family: "F0001", record: by(sha(COUPLE_MORE)) },
      { kind: "media.link", source: "S0001", record: by(sha(PAGE)) },
      // the record the research had of the original: what the user gave it
      { kind: "media.edit", person: "P0001", record: by(sha(ORIGINAL)), title: "Svatba v Lhotě", fields: ["title", "kind", "date", "note"] },
    ];
    assert.deepEqual(media, want.map((m) => JSON.stringify(m)).sort(), res.body);
    assert.ok(got.changes >= want.length && got.applied >= want.length, res.body);
    const status = JSON.parse(await (await fetch(`${info.url}/status`)).text()) as { sends: { state: string; media?: unknown[]; mediaCount?: number }[] };
    assert.equal(status.sends[0]!.state, "written");
    assert.deepEqual(status.sends[0]!.media, got.media);
    assert.equal(status.sends[0]!.mediaCount, want.length);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

