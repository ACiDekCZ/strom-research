// The person's confirmation against the scan from the Strom app (spec 065; the app's ZADANI_VYZKUM_spolehlivost.md,
// "Odpověď výzkumu na Dotazy" 6 and "Odpověď aplikace" 1–3): strom sync and the adoption of a tree read
// `2 _STROM_CONFIRMED YYYY-MM-DD` of an app of the gate APP_SHOWS_VERIFY alone — added since _STROM_HEAD the user's
// confirmation with its day, gone the confirmation taken back, without a head every one a confirmation; never below the
// gate; never under a name; dropped with a value the same file changes. And what waits after a write of the app: a fact
// given an original is queued for its verification (K6.2), the bulk verification never past the archives' limits (K3.3).
// Made-up people (Lhoták, Lhota), diacritics in NFD as typed on a Mac, a place in Cyrillic.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { rankTasks } from "../../src/core/queue.ts";
import { verifyState } from "../../src/core/verify.ts";
import { encodeImage } from "../../src/image/index.ts";
import type { Event, Family, Person, Task } from "../../src/core/model.ts";

const opts = { skip: !hasGit };
const BETA = "https://beta.stromapp.info/run/";
/** A write of the Strom app's through the bridge (the person's), from its beta copy. */
const APP = { STROM_FOR_APP: "1", STROM_APP_URL: BETA };
/** The export the beta of the app is given (the verification's marks in it). */
const BETA_APP = { STROM_APP_URL: BETA, STROM_APP_VERSION: "3.26.0-beta.2" };
const AGENT = { CLAUDECODE: "1", STROM_APP_URL: BETA };
const PERMISSION_HOST = "digi.lhota.example.net";

const open = (w: World) => Tree.open(w.cwd, w.env);
const fact = (w: World, id: string): Event => {
  const tree = open(w);
  for (const o of [...tree.list<Person>("person"), ...tree.list<Family>("family")]) {
    const e = o.events.find((x) => x.id === id);
    if (e) return e;
  }
  throw new Error(`no fact ${id}`);
};
const verifyTasks = (w: World) => open(w).list<Task>("task").filter((t) => t.origin?.startsWith("verify") && (t.state === "open" || t.state === "doing" || t.state === "waiting"));
const queued = (w: World, id: string) => verifyTasks(w).some((t) => t.where.includes(id));
const media = (w: World) => open(w).list("media").length;

/** A fact added; its ID. */
async function add(w: World, owner: string, kind: string, ...more: string[]): Promise<string> {
  return (await w.ok(["event", "add", owner, kind, ...more, "--json"])).json.event.id as string;
}

/** A folder of grey scans (s0001.jpg …). */
function scans(w: World, n: number): string {
  const dir = fs.mkdtempSync(path.join(w.dir, "skeny-"));
  for (let i = 0; i < n; i++) fs.writeFileSync(path.join(dir, `s${String(i + 1).padStart(4, "0")}.jpg`), encodeImage({ width: 300, height: 400, channels: 1, data: new Uint8Array(300 * 400).fill(180) }, "jpeg"));
  return dir;
}

/**
 * Jan Lhoták (P1) and his parents Josef (P2, his name in NFD) and Marie (P3), family F1; the registers of Lhota (B0001),
 * with their scans here unless `images: false`; Josef's baptism, death (a place in Cyrillic) and the marriage cite their
 * originals (S1–S3), Jan's birth only an index (S4). The sweep queued what cites an original.
 */
async function lhotaci(o: { images?: boolean; sweep?: boolean } = {}) {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["research", "new", "Předci Jana", "--new-person", "Jan /Lhoták/", "--sex", "M"]); // P1
  await w.ok(["person", "add", "Josef /Lhoták/".normalize("NFD"), "--sex", "M"]); // P2
  await w.ok(["person", "add", "Marie /Lhotová/", "--sex", "F"]); // P3
  await w.ok(["family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1"]); // F1
  await w.ok(["repo", "add", "Archiv Lhota", "--automation", "manual"]);
  await w.ok(["recordset", "add", "Lhota 1, N O Z 1840-1910", "--repo", "R1", "--kinds", "baptism,marriage,death", "--places", "Lhota", "--years", "1840-1910", "--access", "online-free"]); // B1
  const original = (title: string, kind: string) => ["source", "add", title, "--kind", kind, "--recordset", "B0001", "--locator", "fol. 1", "--information", "primary"];
  await w.ok(original("Křest Josefa Lhotáka 1850", "baptism")); // S1
  await w.ok(original("Úmrtí Josefa Lhotáka 1910", "death")); // S2
  await w.ok(original("Oddavky Josefa a Marie 1875", "marriage")); // S3
  await w.ok(["source", "add", "Index křtů Lhota", "--kind", "index", "--information", "primary"]); // S4, no original
  const cite = (s: string) => ["--cite", s, "--locator", "fol. 1"];
  const f = {
    josefBirth: await add(w, "P2", "BIRT", "--date", "1850", "--place", "Lhota", ...cite("S0001")),
    josefDeath: await add(w, "P2", "DEAT", "--date", "1910", "--place", "Лхота", ...cite("S0002")),
    marriage: await add(w, "F1", "MARR", "--date", "1875", "--place", "Lhota", ...cite("S0003")),
    janBirth: await add(w, "P1", "BIRT", "--date", "1880", "--place", "Lhota", "--cite", "S0004"),
  };
  if (o.images !== false) await w.ok(["media", "add", scans(w, 3), "--recordset", "B0001"]);
  if (o.sweep !== false) await w.ok(["frontier", "--research", "G0001", "--apply"]); // the sweep: Josef's facts, the marriage
  return { w, f };
}

/**
 * The research's Strom file as the app sends it back: the research's export for the app's beta (its marks in it), its
 * header the app's — of this version ("" none said: an unknown version).
 */
async function appFile(w: World, version: string): Promise<string> {
  const out = path.join(w.dir, `export-${Date.now()}.ged`);
  await w.ok(["export", "gedcom", "--for", "strom", "--out", out], { env: BETA_APP });
  const text = fs.readFileSync(out, "utf8").replace(/\r\n?/g, "\n");
  const head = /^1 SOUR STROM_RESEARCH\n2 VERS .*\n2 NAME .*\n/m;
  assert.match(text, head);
  assert.match(text, /^1 _STROM_HEAD /m, "the file says what the app was given");
  return text.replace(head, `1 SOUR STROM\n${version ? `2 VERS ${version}\n` : ""}2 NAME Strom\n`);
}

/** The file with a confirmation of the fact added (right after its ID, as the app writes it). */
const confirm = (text: string, id: string, day: string) => {
  assert.ok(text.includes(`2 _STROM_EID ${id}\n`), id);
  return text.replace(`2 _STROM_EID ${id}\n`, `2 _STROM_EID ${id}\n2 _STROM_CONFIRMED ${day}\n`);
};

/** The file with the fact's confirmation taken off (the app's "taken back": the tag missing). */
function unconfirm(text: string, id: string): string {
  const lines = text.split("\n");
  let at = lines.indexOf(`2 _STROM_EID ${id}`);
  assert.ok(at > 0, id);
  while (at + 1 < lines.length && !/^[01] /.test(lines[at + 1]!)) {
    if (lines[at + 1]!.startsWith("2 _STROM_CONFIRMED ")) {
      lines.splice(at + 1, 1);
      return lines.join("\n");
    }
    at++;
  }
  assert.fail(`${id} has no confirmation in the file`);
}

function write(w: World, text: string, name = "z-aplikace.ged"): string {
  const file = path.join(w.dir, name);
  fs.writeFileSync(file, text);
  return file;
}

const confirms = (changes: { kind: string; action: string; was?: { id?: string }; confirm?: { on: boolean; day: string } }[]) =>
  changes.filter((c) => c.kind === "fact.confirm").map((c) => `${c.was?.id ?? "?"} ${c.action} ${c.confirm?.on ? "on" : "off"}${c.confirm?.day ? ` ${c.confirm.day}` : ""}`);

test("an app of the gate (3.26.0-beta.2): a confirmation added since its head is the person's with its day, one gone is taken back; its tasks of verification follow; strom sync undo puts all back", opts, async () => {
  // Criterion (Dotazy 6, Odpověď aplikace 1): added since _STROM_HEAD = the user's confirmation with that day (by: user),
  // removed = taken back; the fact leaves its task of verification (one left with no fact dropped); undo restores both.
  const { w, f } = await lhotaci();
  try {
    await w.ok(["verify", "confirm", f.marriage], { env: APP });
    const marriageWas = fact(w, f.marriage).confirmed!;
    assert.ok(queued(w, f.josefBirth), "the sweep queued Josef's baptism");
    let text = await appFile(w, "3.26.0-beta.2");
    text = unconfirm(confirm(text, f.josefBirth, "2026-01-15"), f.marriage);
    const file = write(w, text);
    const plan = (await w.ok(["sync", file, "--json"], { env: APP })).json;
    assert.equal(plan.base, true);
    assert.deepEqual(confirms(plan.changes).sort(), [`${f.josefBirth} user on 2026-01-15`, `${f.marriage} user off`].sort());
    assert.equal(plan.changes.filter((c: { kind: string }) => c.kind !== "fact.confirm").length, 0, "nothing else is an edit");
    // said to the person in the research's language
    const shown = await w.ok(["sync", file], { env: APP });
    assert.match(shown.out, /potvrzeno podle skenu/u);
    assert.match(shown.out, /potvrzení podle skenu vzato zpět/u);

    const r = (await w.ok(["sync", file, "--apply", "--json"], { env: APP })).json;
    const birth = fact(w, f.josefBirth);
    assert.deepEqual([birth.confirmed?.at.slice(0, 10), birth.confirmed?.by], ["2026-01-15", "user"], "the day the app says");
    assert.equal(birth.status, "probable", "the status as it is");
    assert.ok(!queued(w, f.josefBirth), "the confirmed fact left its task");
    assert.equal(fact(w, f.marriage).confirmed, undefined, "taken back");
    assert.equal(fact(w, f.josefDeath).confirmed, undefined, "nothing else confirmed");
    const again = (await w.ok(["sync", file, "--json"], { env: APP })).json;
    assert.deepEqual(confirms(again.changes), [], "the same file again: nothing more");

    await w.ok(["sync", "undo", r.input as string], { tty: true });
    assert.equal(fact(w, f.josefBirth).confirmed, undefined, "undone: not confirmed");
    assert.ok(queued(w, f.josefBirth), "undone: back in its task of verification");
    assert.deepEqual(fact(w, f.marriage).confirmed, marriageWas, "undone: the confirmation as it was, its day too");
  } finally {
    w.cleanup();
  }
});

test("a confirmation is taken back only of a fact whose 2 _STROM_EID the file carries: a copy of an older app sent by the beta (no IDs, no marks) loses none; a confirmation given needs no ID", opts, async () => {
  // Criterion (Dotazy 2 of the app, 4; Odpověď výzkumu na Dotazy 2, 4): `_STROM_CONFIRMED` missing against the head takes
  // the confirmation back only where the fact carries `2 _STROM_EID` of the research's fact of that person or family —
  // an ID of another fact means nothing; adding a confirmation needs no ID; the IDs pair nothing.
  const { w, f } = await lhotaci();
  try {
    await w.ok(["verify", "confirm", f.marriage], { env: APP });
    await w.ok(["verify", "confirm", f.josefDeath], { env: APP });
    // as an older app kept the tree (never given the IDs or the marks), sent by the beta: Josef's baptism confirmed there
    const older = unconfirm(unconfirm(confirm(await appFile(w, "3.26.0-beta.2"), f.josefBirth, "2026-01-15"), f.marriage), f.josefDeath).replace(/^2 _STROM_EID .*\n/gmu, "");
    assert.doesNotMatch(older, /_STROM_EID/u);
    const file = write(w, older, "starsi-kopie.ged");
    const plan = (await w.ok(["sync", file, "--json"], { env: APP })).json;
    assert.deepEqual(confirms(plan.changes), [`${f.josefBirth} user on 2026-01-15`], "the one given counts, nothing taken back");
    await w.ok(["sync", file, "--apply", "--json"], { env: APP });
    assert.ok(fact(w, f.marriage).confirmed, "the marriage's confirmation kept");
    assert.ok(fact(w, f.josefDeath).confirmed, "the death's confirmation kept");
    assert.equal(fact(w, f.josefBirth).confirmed?.at.slice(0, 10), "2026-01-15");

    // the app saw the marriage (its ID there) and took its confirmation back; the death's ID gone, the baptism's of
    // another fact: nothing of them
    let text = unconfirm(unconfirm(unconfirm(await appFile(w, "3.26.0-beta.2"), f.marriage), f.josefDeath), f.josefBirth);
    text = text.replace(`2 _STROM_EID ${f.josefDeath}\n`, "").replace(`2 _STROM_EID ${f.josefBirth}\n`, `2 _STROM_EID ${f.janBirth}\n`);
    const seen = write(w, text, "videno.ged");
    const plan2 = (await w.ok(["sync", seen, "--json"], { env: APP })).json;
    assert.deepEqual(confirms(plan2.changes), [`${f.marriage} user off`], JSON.stringify(plan2.changes));
    await w.ok(["sync", seen, "--apply", "--json"], { env: APP });
    assert.equal(fact(w, f.marriage).confirmed, undefined, "taken back: the app saw it");
    assert.ok(fact(w, f.josefDeath).confirmed, "no ID: kept");
    assert.ok(fact(w, f.josefBirth).confirmed, "another fact's ID: kept");
  } finally {
    w.cleanup();
  }
});

test("below the gate (3.26.0-beta.1, 3.25.0, a version unknown) or the production app before its release: the tag means nothing — a file without the marks never takes a confirmation back, one with them never confirms", opts, async () => {
  // Criterion (Odpověď aplikace 1): read only from an app above APP_SHOWS_VERIFY(_BETA); below it or unknown the
  // tag's presence or absence is ignored entirely — never "taken back" because the head had it and the file has not.
  const { w, f } = await lhotaci();
  try {
    await w.ok(["verify", "confirm", f.marriage], { env: APP });
    const base = await appFile(w, "3.26.0-beta.2");
    // an older app was never given the marks: it sends none — and one that sends a confirmation still is not read
    const older = confirm(unconfirm(base, f.marriage), f.josefBirth, "2026-01-15");
    for (const [version, env] of [
      ["3.26.0-beta.1", APP],
      ["3.25.0", APP],
      ["", APP],
      ["3.26.0-beta.2", { STROM_FOR_APP: "1", STROM_APP_URL: "https://stromapp.info/run/" }],
    ] as const) {
      const text = version === "3.26.0-beta.2" ? older : older.replace(/^2 VERS 3\.26\.0-beta\.2\n/m, version ? `2 VERS ${version}\n` : "");
      const file = write(w, text, `starsi-${version || "neznama"}.ged`);
      const plan = (await w.ok(["sync", file, "--json"], { env })).json;
      assert.deepEqual(confirms(plan.changes), [], `${version || "unknown"}: nothing of the confirmations`);
      await w.ok(["sync", file, "--apply", "--json"], { env });
      assert.ok(fact(w, f.marriage).confirmed, `${version || "unknown"}: no confirmation lost`);
      assert.equal(fact(w, f.josefBirth).confirmed, undefined, `${version || "unknown"}: none made`);
    }
  } finally {
    w.cleanup();
  }
});

test("a confirmation under a name is only passed by, never an error; a fact whose value the same file changes loses its confirmation, the edit taken as ever", opts, async () => {
  // Criteria (Odpověď aplikace 2, 3): `_STROM_CONFIRMED` under NAME ignored without an error; a changed date with the
  // tag: the edit applied as before, the confirmation dropped (it belonged to another value).
  const { w, f } = await lhotaci();
  try {
    let text = await appFile(w, "3.26.0-beta.2");
    // Jan's name confirmed in the app (no research offers it there): passed by
    text = text.replace(/^(0 @[^@]+@ INDI\n(?:[1-9] .*\n)*?1 NAME Jan \/Lhoták\/\n)/mu, "$12 _STROM_CONFIRMED 2026-01-15\n");
    assert.match(text, /1 NAME Jan \/Lhoták\/\n2 _STROM_CONFIRMED 2026-01-15\n/u);
    const named = (await w.ok(["sync", write(w, text, "jmeno.ged"), "--json"], { env: APP })).json;
    assert.deepEqual(named.changes, [], "a name's confirmation: no change, no error");
    // Josef's baptism dated 1851 in the app and confirmed there: the date an edit, the confirmation gone with the old value
    const changed = confirm(text, f.josefBirth, "2026-01-15").replace(`2 _STROM_EID ${f.josefBirth}\n2 _STROM_CONFIRMED 2026-01-15\n2 DATE 1850\n`, `2 _STROM_EID ${f.josefBirth}\n2 _STROM_CONFIRMED 2026-01-15\n2 DATE 1851\n`);
    assert.ok(changed.includes("2 DATE 1851\n"));
    const file = write(w, changed, "zmena.ged");
    const plan = (await w.ok(["sync", file, "--json"], { env: APP })).json;
    assert.deepEqual(confirms(plan.changes), [], "no confirmation of a value changed");
    assert.ok(plan.changes.some((c: { kind: string }) => c.kind.startsWith("fact.")), `the date's edit is there: ${JSON.stringify(plan.changes.map((c: { kind: string }) => c.kind))}`);
    await w.ok(["sync", file, "--apply", "--edits", "user", "--json"], { env: APP });
    const births = open(w).get<Person>("P0002")!.events.filter((e) => e.kind === "BIRT" && !e.retracted);
    assert.ok(births.some((e) => e.date === "1851"), "the edit taken");
    assert.ok(births.every((e) => !e.confirmed), "nothing confirmed");
  } finally {
    w.cleanup();
  }
});

test("a confirmation of a fact the research changed since it was given is only said; an agent's sync never confirms", opts, async () => {
  // Criterion (Dotazy 6): a confirmation of a fact the research changed or withdrew since is only reported; the user's
  // confirmation is the person's alone — an agent running strom sync is told, nothing written.
  const { w, f } = await lhotaci();
  try {
    const text = confirm(confirm(await appFile(w, "3.26.0-beta.2"), f.josefBirth, "2026-01-15"), f.josefDeath, "2026-01-16");
    await w.ok(["event", "edit", f.josefBirth, "--date", "1849", "--reason", "nové čtení zápisu"]); // the research's since
    const file = write(w, text);
    const plan = (await w.ok(["sync", file, "--json"], { env: AGENT })).json;
    assert.deepEqual(confirms(plan.changes).sort(), [`? report on 2026-01-15`, `${f.josefDeath} user on 2026-01-16`].sort());
    const r = (await w.ok(["sync", file, "--apply", "--json"], { env: AGENT })).json;
    assert.equal(fact(w, f.josefDeath).confirmed, undefined, "an agent's sync confirms nothing");
    assert.equal(fact(w, f.josefBirth).confirmed, undefined, "a changed fact: only said");
    assert.ok((r.skipped ?? []).some((s: { kind: string }) => s.kind === "fact.confirm"), "the agent is told to tell the user");
  } finally {
    w.cleanup();
  }
});

test("the adoption of a tree from the app without the research (no head): every confirmation the person's", opts, async () => {
  // Criterion (Dotazy 6): a tree taken over from the app without a head — every `_STROM_CONFIRMED` is the user's
  // confirmation with its day; one under a name passed by.
  const w = new World();
  try {
    await w.withTree("Lhotákovi");
    const ged = [
      "0 HEAD", "1 SOUR STROM", "2 VERS 3.26.0-beta.2", "2 NAME Strom", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8",
      "0 @I1@ INDI", "1 NAME Josef /Lhoták/".normalize("NFD"), "2 _STROM_CONFIRMED 2026-01-10", "1 SEX M", "1 BIRT", "2 _STROM_CONFIRMED 2026-01-12", "2 DATE 1850", "2 PLAC Lhota", "1 DEAT", "2 DATE 1910", "2 PLAC Лхота", "1 FAMS @F1@",
      "0 @I2@ INDI", "1 NAME Marie /Lhotová/", "1 SEX F", "1 FAMS @F1@",
      "0 @F1@ FAM", "1 HUSB @I1@", "1 WIFE @I2@", "1 MARR", "2 DATE 1875", "2 _STROM_CONFIRMED 2026-01-14",
      "0 TRLR", "",
    ].join("\n");
    const file = write(w, ged, "prevzeti.ged");
    await w.ok(["sync", file, "--apply", "--force", "--json"], { env: APP });
    const tree = open(w);
    const josef = tree.list<Person>("person").find((p) => p.names.some((n) => n.given === "Josef"))!;
    const fam = tree.list<Family>("family")[0]!;
    const of = (o: Person | Family, kind: string) => o.events.find((e) => e.kind === kind)!;
    assert.deepEqual([of(josef, "BIRT").confirmed?.at.slice(0, 10), of(josef, "BIRT").confirmed?.by], ["2026-01-12", "user"]);
    assert.equal(of(josef, "DEAT").confirmed, undefined);
    assert.equal(of(fam, "MARR").confirmed?.at.slice(0, 10), "2026-01-14");
    // the same tree adopted from an app below the gate: nothing confirmed
    const w2 = new World();
    try {
      await w2.withTree("Lhotákovi");
      await w2.ok(["sync", write(w2, ged.replace("2 VERS 3.26.0-beta.2\n", "2 VERS 3.25.0\n"), "prevzeti.ged"), "--apply", "--force", "--json"], { env: APP });
      const t2 = open(w2);
      assert.ok([...t2.list<Person>("person"), ...t2.list<Family>("family")].every((o) => o.events.every((e) => !e.confirmed)));
    } finally {
      w2.cleanup();
    }
  } finally {
    w.cleanup();
  }
});

test("K6.2: a source of an original the user gave a fact in the app — by strom sync, or by a write of the app through the bridge — queues the fact for its verification at once", opts, async () => {
  // Criterion (spec 065 K6.2): a fact newly citing an original is in a task of verification right after the
  // sync, and right after a forApp write (in the same commit); an ordinary write waits for the sweep.
  const { w, f } = await lhotaci();
  try {
    await w.ok(["event", "edit", f.janBirth, "--status", "possible", "--reason", "jen index"]); // possible on the index
    assert.ok(!queued(w, f.janBirth), "an index alone: nothing to verify");
    // the app's file: Jan's birth given the baptism's original (S1) as the user's source
    let text = await appFile(w, "3.26.0-beta.2");
    const xref = /^0 (@[^@]+@) SOUR\n(?:[1-9] .*\n)*?1 REFN S0001\n/mu.exec(text)?.[1];
    assert.ok(xref, "the original's record in the file");
    text = text.replace(`2 _STROM_EID ${f.janBirth}\n`, `2 _STROM_EID ${f.janBirth}\n2 SOUR ${xref}\n3 PAGE fol. 2\n`);
    const r = (await w.ok(["sync", write(w, text), "--apply", "--json"], { env: APP })).json;
    assert.ok(r.changes.some((c: { kind: string }) => c.kind === "fact.cite"), JSON.stringify(r.changes.map((c: { kind: string }) => c.kind)));
    assert.ok(queued(w, f.janBirth), "queued by the sync");

    // a write of the app's through the bridge (forApp): Marie's birth cited of an original → queued in the same commit
    const marie = await add(w, "P3", "BIRT", "--date", "1855", "--place", "Lhota", "--cite", "S0004", "--status", "possible");
    await w.ok(["cite", marie, "S0001", "--locator", "fol. 3"], { env: APP });
    assert.ok(queued(w, marie), "queued by the app's write");
    assert.equal(execFileSync("git", ["status", "--porcelain", "data"], { cwd: w.cwd, encoding: "utf8" }), "", "in the write's own commit");
    // the same write by an agent: the sweep queues it, not the write
    const other = await add(w, "P3", "DEAT", "--date", "1920", "--place", "Lhota", "--cite", "S0004", "--status", "possible");
    await w.ok(["cite", other, "S0002", "--locator", "fol. 4"], { env: { CLAUDECODE: "1" } });
    assert.ok(!queued(w, other), "an ordinary write: not queued by it");
  } finally {
    w.cleanup();
  }
});

test("K3.3: the bulk verification never goes past an archive's limits — low priority, a task whose originals are not here waits for the person to download them, one on an archive the person has not decided waits for that decision; nothing is fetched", opts, async () => {
  // Criterion (spec 065 K3.3): verify bulk makes tasks of low priority; without the originals' images they are
  // blocked (images, ranked last, nothing fetched); on a host whose permission waits they leave the queue (permission).
  const { w, f } = await lhotaci({ images: false, sweep: false });
  try {
    const before = media(w);
    const bulk = (await w.ok(["verify", "bulk", "--scope", "tree", "--json"], { tty: true })).json;
    assert.ok(bulk.tasks.length > 0, JSON.stringify(bulk));
    const tasks = open(w).list<Task>("task").filter((t) => t.origin === "verify:bulk" || t.origin === "verify:auto");
    assert.ok(tasks.filter((t) => t.origin === "verify:bulk").every((t) => (t.priority ?? 0) <= 1), "low priority");
    // no images of the registers here: each fact waits for the person to download them
    let state = verifyState(open(w));
    for (const id of [f.josefBirth, f.josefDeath, f.marriage]) assert.equal(state.get(id), "images", id);
    const tree = open(w);
    const ranked = rankTasks(tree, tree.list<Task>("task"), new Settings(tree.env, {}).strategy(tree.config));
    const mine = ranked.filter((r) => tasks.some((t) => t.id === r.task.id));
    assert.ok(mine.length > 0 && mine.every((r) => /download/u.test(r.why)), `blocked: ${mine.map((r) => r.why).join(" | ")}`);
    assert.equal(media(w), before, "nothing fetched");
    // the registers on an archive whose permission waits for the person: the tasks out of the queue
    await w.ok(["recordset", "edit", "B0001", "--url", `https://${PERMISSION_HOST}/book/4`]);
    fs.writeFileSync(
      path.join(w.env.STROM_CONFIG_DIR!, "archives.json"),
      JSON.stringify({ archives: {}, pending: [{ kind: "permission", key: `permission:${PERMISSION_HOST}`, at: new Date().toISOString(), host: PERMISSION_HOST, title: "Digitální archiv Lhota" }] }),
    );
    state = verifyState(open(w));
    for (const id of [f.josefBirth, f.josefDeath, f.marriage]) assert.equal(state.get(id), "permission", id);
    const t2 = open(w);
    const left = rankTasks(t2, t2.list<Task>("task"), new Settings(t2.env, {}).strategy(t2.config)).filter((r) => tasks.some((t) => t.id === r.task.id));
    assert.deepEqual(left, [], "nothing of them in the queue while the archive's permission waits");
    assert.equal(media(w), before, "nothing fetched");
  } finally {
    w.cleanup();
  }
});
