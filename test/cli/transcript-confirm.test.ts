// The user confirming the research's transcript of a source in the Strom app (spec 022 P2, K2.2, K2.3, K2.6, O1–O7):
// only through the bridge (POST <token>/sources/confirm), as the person's in the app — the user's reading of that
// wording, with its day; taken back the same way; a source the user confirmed is offered to no second reading. The Strom
// file says it under 1 _STROM_READ (2 _CONF, 2 _TXT) for an app that confirms (APP_CONFIRMS_TRANSCRIPTS); a file never
// confirms (a stale one undoes no taking back, another program's makes no reader). A confirmation makes a fact proven
// only on the original record with primary information, else at most probable — and the changes line says so.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { World, hasGit } from "../helpers.ts";
import { now, Tree } from "../../src/core/tree.ts";
import { changeLines } from "../../src/core/changelog.ts";
import { confirmedOn, localDayOf, transcriptMark, userReading } from "../../src/core/readers.ts";
import { readByOthers, readersOf } from "../../src/core/review.ts";
import { BRIDGE_FEATURES } from "../../src/core/live.ts";
import { Settings } from "../../src/core/config.ts";
import { APP_CONFIRMS_TRANSCRIPTS, APP_CONFIRMS_TRANSCRIPTS_BETA, appConfirmsTranscripts } from "../../src/core/stromapp.ts";
import type { Source } from "../../src/core/model.ts";

const APP = "https://beta.stromapp.info";
const BETA_APP = { STROM_APP_URL: "https://beta.stromapp.info/run/" };
const bridgeOpts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };

type Answer = { status: number; body: any; headers: http.IncomingHttpHeaders };
function request(url: string, method = "GET", body?: unknown, headers: Record<string, string> = { Origin: APP }): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf8");
    const req = http.request(url, { agent: false, method, headers: { ...headers, ...(data ? { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": String(data.length) } : {}) } }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (d) => (text += d));
      res.on("end", () => {
        let parsed: any = text;
        try {
          parsed = JSON.parse(text);
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body: parsed, headers: res.headers });
      });
    });
    req.on("error", reject);
    req.end(data);
  });
}

const sourceOf = (w: World, id: string) => Tree.open(w.cwd, w.env).get<Source>(id)!;
const readers = (w: World, id: string) => readersOf(Tree.open(w.cwd, w.env)).get(id);

/** A source the research read (a session's write: a reader of a model nobody recorded). */
function readByResearch(w: World, s: { title: string; transcript?: string; form?: Source["form"]; information?: Source["information"] }): string {
  const tree = Tree.open(w.cwd, w.env);
  tree.actor = "N0001";
  let id = "";
  tree.withTreeLock(() => {
    id = tree.allocate("S");
    const at = now();
    tree.put({ id, type: "source", title: s.title, kind: "baptism", form: s.form ?? "original", information: s.information ?? "primary", ...(s.transcript ? { transcript: s.transcript.normalize("NFC") } : {}), notes: [], created: at, updated: at } as unknown as Source, {
      op: "source.add",
      targets: [id],
      summary: `${id} ${s.title}`,
    });
    tree.commit(`${id} read by the research`);
  });
  return id;
}

/** A source changed as strom would write it (taken out, merged), with its commit. */
function change(w: World, id: string, how: (s: Source) => Source, summary: string): void {
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    tree.put({ ...how(structuredClone(tree.get<Source>(id)!)), updated: now() }, { op: "source.retract", targets: [id], summary });
    tree.commit(summary);
  });
}

async function lhotaci(): Promise<World> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]); // P1
  return w;
}

const S1_TEXT = "Křest Vojtěcha Lhotáka, syn Jiřího a Ludmily.".normalize("NFD");
const S2_TEXT = "Войтех Лхотак, сын Иржи.";

test("the gate: the marks only for an app that confirms — not released yet; its beta and development copies at once; an unknown version once released", () => {
  const prod = new Settings({}, {});
  const beta = new Settings(BETA_APP, {});
  assert.equal(APP_CONFIRMS_TRANSCRIPTS, "3.25.0", "set from the app's release that confirms, never a beta's");
  assert.equal(APP_CONFIRMS_TRANSCRIPTS_BETA, undefined);
  assert.equal(appConfirmsTranscripts(prod, "3.25.0"), true);
  assert.equal(appConfirmsTranscripts(prod, "3.24.0"), false);
  assert.equal(appConfirmsTranscripts(prod), true, "unknown version once released: today's");
  assert.equal(appConfirmsTranscripts(beta, "3.25.0"), true, "another copy of the app at once");
  assert.equal(appConfirmsTranscripts(beta), true);
  assert.equal(appConfirmsTranscripts(prod, "3.26.0", "3.26.0"), true);
  assert.equal(appConfirmsTranscripts(prod, "3.25.9", "3.26.0"), false);
  assert.equal(appConfirmsTranscripts(prod, "3.26.0-beta.3", "3.26.0"), false, "a pre-release before the release");
  assert.equal(appConfirmsTranscripts(prod, undefined, "3.26.0"), true, "an unknown version once released: an older app skips the tags");
  assert.equal(appConfirmsTranscripts(beta, "3.26.0-beta.1", undefined, "3.26.0-beta.2"), false);
  assert.equal(appConfirmsTranscripts(beta, "3.26.0-beta.2", undefined, "3.26.0-beta.2"), true);
});

test("K2.2, K2.3, K2.6: POST /sources/confirm — confirmed as the user's reading with its day, taken back, every refusal; offered to no second reading; the Strom file, the changes line, proven only on the original (O6)", bridgeOpts, async () => {
  const w = await lhotaci();
  Object.assign(w.env, { STROM_LOCK_WAIT_MS: "1500" });
  let started = false;
  try {
    const s1 = readByResearch(w, { title: "Křest Vojtěcha Lhotáka 1850", transcript: S1_TEXT }); // original, primary
    const s2 = readByResearch(w, { title: "Index křtů Lhota 1850", transcript: S2_TEXT, form: "derivative" });
    await w.ok(["source", "add", "Křest Jiřího Lhotáka 1822", "--kind", "baptism", "--transcript", "Jiří, syn Václava."], { tty: true }); // S3, typed by hand
    const s4 = readByResearch(w, { title: "Oddací kniha Lhota" }); // no transcript
    const s5 = readByResearch(w, { title: "Opis křtu Vojtěcha", transcript: "Vojtěch, syn Jiřího." });
    const s6 = readByResearch(w, { title: "Křest Anny Lhotákové 1852", transcript: "Anna, dcera Jiřího." });
    await w.ok(["source", "add", "Křest Marie Lhotákové 1854", "--kind", "baptism", "--transcript", "Marie, dcera Jiřího."]); // S7, nobody read it
    change(w, s5, (s) => ({ ...s, retracted: { at: now(), reason: `merged into ${s1}` }, mergedInto: s1 }), `${s5} merged into ${s1}`);
    const m1 = transcriptMark(S1_TEXT.normalize("NFC"));
    const m2 = transcriptMark(S2_TEXT);
    assert.equal(m1, transcriptMark(S1_TEXT), "the mark of the words, however composed (O1)");
    assert.match(m1, /^[0-9a-f]{16}$/);
    // before: the research's reading alone, worth a second reading by another model
    assert.equal(readByOthers(readers(w, s1), "opus"), true);

    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    started = true;
    const url = `${info.url}/sources/confirm`;
    const post = (body: unknown) => request(url, "POST", body);
    assert.ok(BRIDGE_FEATURES.includes("sources.confirm"));
    assert.ok((await request(`${info.url}/status`)).body.features.includes("sources.confirm"));

    // only the app's page writes
    const foreign = await request(url, "POST", { source: s1, txt: m1, confirm: true }, {});
    assert.deepEqual([foreign.status, foreign.body.code], [403, "app.only"]);
    for (const bad of [{}, { source: s1, txt: m1 }, { source: s1, txt: m1, confirm: "yes" }, { source: "P0001", txt: m1, confirm: true }, { source: s1, txt: "není značka", confirm: true }, { source: s1, txt: m1, confirm: true, at: "x" }, "x"]) {
      const r = await post(bad);
      assert.deepEqual([r.status, r.body.code], [400, "confirm.invalid"], JSON.stringify(bad));
    }
    const none = await post({ source: "S0099", txt: m1, confirm: true });
    assert.deepEqual([none.status, none.body.code], [404, "confirm.none"]);
    const changed = await post({ source: s1, txt: m2, confirm: true });
    assert.deepEqual([changed.status, changed.body.code, changed.body.txt], [409, "confirm.changed", m1], "the wording now goes with it");
    for (const id of ["S0003", s4, "S0007"]) {
      const r = await post({ source: id, txt: transcriptMark(sourceOf(w, id).transcript ?? "x"), confirm: true });
      assert.deepEqual([r.status, r.body.code], [409, "confirm.reader"], `${id}: not the research's reading alone`);
    }
    const merged = await post({ source: s5, txt: transcriptMark("Vojtěch, syn Jiřího."), confirm: false });
    assert.deepEqual([merged.status, merged.body.code, merged.body.into], [409, "confirm.merged", s1]);

    // confirmed: the user's reading of this wording, with its day
    const ok = await post({ source: s1, txt: m1, confirm: true });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    const u = sourceOf(w, s1).read?.user;
    assert.equal(u?.how, "confirm");
    assert.equal(u?.txt, m1);
    // its day: the day of the moment kept, on this computer's calendar (never the clock read again)
    const day = localDayOf(u!.at);
    assert.ok(Math.abs(Date.parse(u!.at) - Date.now()) < 120_000, "the moment of the confirmation");
    assert.deepEqual([ok.body.ok, ok.body.source, ok.body.read, ok.body.conf, ok.body.txt], [true, s1, "both", day, m1]);
    assert.notEqual(ok.body.head, ok.body.parent, "written");
    // K2.6: the user read it now — no second reading by another model
    assert.ok(readers(w, s1)?.has("user"));
    assert.equal(readByOthers(readers(w, s1), "opus"), false);
    // the same again: nothing written
    const again = await post({ source: s1, txt: m1, confirm: true });
    assert.equal(again.status, 200);
    assert.equal(again.body.head, again.body.parent);
    assert.equal(again.body.conf, day);

    // the index confirmed too; the changes lines say what it does to how sure a fact may be (O6)
    assert.equal((await post({ source: s2, txt: m2, confirm: true })).status, 200);
    const t = Tree.open(w.cwd, w.env);
    const lines = (op: string) => changeLines(t, t.readOps().filter((o) => o.op === op), "", "cs").map((l) => l.text);
    assert.deepEqual(lines("source.confirm"), [
      "Přepis potvrdil uživatel: Křest Vojtěcha Lhotáka 1850 – originál záznamu s primární informací, údaj z něj smí být doložený",
      "Přepis potvrdil uživatel: Index křtů Lhota 1850 – není originál záznamu s primární informací, údaje z něj nejvýš pravděpodobné",
    ]);
    assert.ok(!lines("source.confirm").some((l) => /source\.confirm|confirmed by/u.test(l)), "no raw key, no English");
    assert.match(changeLines(t, t.readOps().filter((o) => o.op === "source.confirm"), "", "en")[0]!.text, /^Transcript confirmed by the user: /u);
    // O6: proven on the original with primary information; the index confirmed at most probable
    await w.ok(["event", "add", "P1", "CHR", "--date", "1850", "--cite", s1, "--status", "proven"]);
    const index = await w.run(["event", "add", "P1", "BIRT", "--date", "1850", "--cite", s2, "--status", "proven", "--json"]);
    assert.notEqual(index.code, 0);
    assert.match(index.out + index.err, /status\.original/u);
    await w.ok(["event", "add", "P1", "BIRT", "--date", "1850", "--cite", s2, "--status", "probable"]);

    // the Strom file for an app that confirms: the day and the wording under _STROM_READ; for one that does not: neither
    const file = path.join(w.dir, "strom.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", file], { env: BETA_APP });
    const ged = fs.readFileSync(file, "utf8");
    assert.match(ged, new RegExp(`1 REFN ${s1}\\r?\\n(?:1 (?!_STROM_READ).*\\r?\\n)*1 _STROM_READ both\\r?\\n2 _CONF ${day}\\r?\\n2 _TXT ${m1}\\r?\\n`, "u"));
    assert.match(ged, new RegExp(`1 REFN ${s6}\\r?\\n(?:1 (?!_STROM_READ).*\\r?\\n)*1 _STROM_READ research\\r?\\n2 _TXT ${transcriptMark("Anna, dcera Jiřího.")}\\r?\\n`, "u"), "the research's reading: its wording, no day");
    assert.match(ged, /1 REFN S0003\r?\n(?:1 (?!_STROM_READ).*\r?\n)*1 _STROM_READ user\r?\n2 _TXT /u, "the user's own: the wording, no day");
    assert.match(ged, new RegExp(`1 REFN ${s4}\\r?\\n(?:1 (?!_STROM_READ).*\\r?\\n)*1 _STROM_READ research\\r?\\n(?!2 _TXT)`, "u"), "no transcript: no wording");
    const old = path.join(w.dir, "old.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", old], { env: { STROM_APP_VERSION: "3.24.0" } });
    const older = fs.readFileSync(old, "utf8");
    assert.match(older, /1 _STROM_READ both/u);
    assert.doesNotMatch(older, /_CONF|_TXT/u, "an app released before the gate: neither");
    // the bridge's own file for the app
    const live = (await request(`${info.url}/tree.ged?app=3.24.0`)).body as string;
    assert.doesNotMatch(live, /_TXT/u);

    // the research reads S1 anew: the confirmed transcript is never changed by it — the new wording proposed (K2.3)
    await w.ok(["source", "edit", s1, "--transcript", "Křest Vojtěcha Lhotáka, syn Jiřího a Ludmily rozené Lhotové.", "--reason", "čteno znovu"]);
    assert.ok(confirmedOn(sourceOf(w, s1)), "still confirmed");
    // changed by the person's own batch (no reading typed): the confirmation was of other words — gone, the history keeps it
    await w.ok(["batch", `source edit ${s1} --transcript "Křest Vojtěcha Lhotáka, syn Jiřího a Ludmily rozené Lhotové." --reason "čteno znovu"`], { tty: true });
    assert.equal(confirmedOn(sourceOf(w, s1)), undefined);
    assert.equal(userReading(sourceOf(w, s1)), undefined);
    const m1b = transcriptMark("Křest Vojtěcha Lhotáka, syn Jiřího a Ludmily rozené Lhotové.");
    for (const confirm of [true, false]) {
      const r = await post({ source: s1, txt: m1, confirm });
      assert.deepEqual([r.status, r.body.code, r.body.txt], [409, "confirm.changed", m1b], `confirm ${confirm}`);
    }
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", file], { env: BETA_APP });
    assert.match(fs.readFileSync(file, "utf8"), new RegExp(`1 _STROM_READ research\\r?\\n2 _TXT ${m1b}\\r?\\n`, "u"));

    // K2.3: taken back the same way; again: nothing written
    const back = await post({ source: s2, txt: m2, confirm: false });
    assert.equal(back.status, 200, JSON.stringify(back.body));
    assert.deepEqual([back.body.read, back.body.conf, back.body.txt], ["research", undefined, m2]);
    assert.notEqual(back.body.head, back.body.parent);
    assert.equal(sourceOf(w, s2).read, undefined);
    assert.equal(readByOthers(readers(w, s2), "opus"), true, "worth a reading again");
    const backAgain = await post({ source: s2, txt: m2, confirm: false });
    assert.deepEqual([backAgain.status, backAgain.body.head === backAgain.body.parent], [200, true]);
    const t2 = Tree.open(w.cwd, w.env);
    assert.deepEqual(changeLines(t2, t2.readOps().filter((o) => o.op === "source.unconfirm"), "", "cs").map((l) => l.text), ["Potvrzení přepisu zrušeno: Index křtů Lhota 1850"]);

    // a source taken out: not confirmed; a confirmation it had is taken back still (O3), and the file gives no wording
    const m6 = transcriptMark("Anna, dcera Jiřího.");
    assert.equal((await post({ source: s6, txt: m6, confirm: true })).status, 200);
    change(w, s6, (s) => ({ ...s, retracted: { at: now(), reason: "not of this family" } }), `${s6} retracted: not of this family`);
    const retracted = await post({ source: s6, txt: m6, confirm: true });
    assert.deepEqual([retracted.status, retracted.body.code], [409, "confirm.retracted"]);
    const retractedBack = await post({ source: s6, txt: m6, confirm: false });
    assert.equal(retractedBack.status, 200, JSON.stringify(retractedBack.body));
    assert.equal(retractedBack.body.conf, undefined);
    assert.equal(sourceOf(w, s6).read, undefined);

    // the research held by another strom: busy, nothing written
    const lock = path.join(w.cwd, ".strom", "tree.lock");
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), at: new Date().toISOString(), owner: "a test" }));
    const busy = await post({ source: s2, txt: m2, confirm: true });
    fs.rmSync(lock);
    assert.deepEqual([busy.status, busy.body.code, busy.headers["retry-after"] !== undefined], [503, "research.busy", true]);
    assert.equal(sourceOf(w, s2).read, undefined);

    // no public command: hidden from the catalog, refused to anyone but the app's bridge (an agent never confirms)
    assert.doesNotMatch((await w.ok(["commands", "--json"])).out, /"source confirm"|source confirm/u);
    assert.doesNotMatch((await w.ok(["help", "source"])).out, /source confirm/u);
    for (const env of [{}, { STROM_FOR_APP: "1", CLAUDECODE: "1" }] as Record<string, string>[]) {
      const r = await w.run(["source", "confirm", s2, "--txt", m2, "--json"], { env });
      assert.notEqual(r.code, 0);
      assert.match(r.out + r.err, /confirm\.app/u);
    }
    assert.equal(sourceOf(w, s2).read, undefined);

    // an archive: nothing confirmed
    await w.ok(["mode", "archive"], { tty: true, answers: ["", "", ""] });
    const arch = await post({ source: s2, txt: m2, confirm: true });
    assert.deepEqual([arch.status, arch.body.code], [409, "confirm.archive"]);
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    if (started) await w.run(["live", "stop"]);
    w.cleanup();
  }
});

test("K2.2 by the file: the app's file back through strom sync keeps the research's confirmation; a file never confirms — a stale one undoes no taking back, another program's makes no reader", { skip: !hasGit }, async () => {
  const w = await lhotaci();
  try {
    const s1 = readByResearch(w, { title: "Křest Vojtěcha Lhotáka 1850", transcript: S1_TEXT });
    const s2 = readByResearch(w, { title: "Křest Jiřího Lhotáka 1822", transcript: S2_TEXT });
    const s3 = readByResearch(w, { title: "Křest Anny Lhotákové 1852", transcript: "Anna, dcera Jiřího." });
    await w.ok(["event", "add", "P1", "CHR", "--date", "1850", "--cite", s1, "--status", "probable"]);
    const m1 = transcriptMark(S1_TEXT.normalize("NFC"));
    const m2 = transcriptMark(S2_TEXT);
    const APP_RUN = { STROM_FOR_APP: "1" };
    // as the bridge runs it for the app
    assert.equal((await w.ok(["source", "confirm", s1, "--txt", m1, "--json"], { env: APP_RUN })).json.read, "both");
    assert.equal((await w.ok(["source", "confirm", s2, "--txt", m2, "--json"], { env: APP_RUN })).json.conf, localDayOf(new Date().toISOString()));
    const file = path.join(w.dir, "app.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", file], { env: BETA_APP });
    const text = fs.readFileSync(file, "utf8");
    assert.match(text, new RegExp(`2 _CONF \\d{4}-\\d\\d-\\d\\d\\r?\\n2 _TXT ${m2}`, "u"));
    // the user takes S2's back in the app; the file from before comes back
    await w.ok(["source", "confirm", s2, "--txt", m2, "--undo"], { env: APP_RUN });
    const kept = JSON.stringify(sourceOf(w, s1).read);
    const synced = await w.run(["sync", file, "--yes", "--json"], { env: BETA_APP });
    assert.equal(synced.code, 0, synced.out + synced.err);
    assert.equal(JSON.stringify(sourceOf(w, s1).read), kept, "the confirmation kept as it is");
    assert.ok(confirmedOn(sourceOf(w, s1)), "still confirmed");
    assert.equal(sourceOf(w, s2).read, undefined, "a file confirms nothing: the stale _CONF undoes no taking back");
    assert.ok(!readersOf(Tree.open(w.cwd, w.env)).get(s2)?.has("user"));

    // another program's file with the marks of S3's wording: no reader "user" from it
    const m3 = transcriptMark("Anna, dcera Jiřího.");
    const foreign = path.join(w.dir, "foreign.ged");
    fs.writeFileSync(
      foreign,
      [
        "0 HEAD", "1 SOUR OTHERPROG", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8",
        "0 @I1@ INDI", "1 NAME Anna /Lhotáková/", "1 SEX F", "1 BIRT", "2 DATE 1852", "2 SOUR @S1@", "3 QUAY 3",
        "0 @S1@ SOUR", "1 TITL Křest Anny Lhotákové 1852", `1 REFN ${s3}`, "1 TEXT Anna, dcera Jiřího.", "1 _STROM_READ both", "2 _CONF 2026-11-06", `2 _TXT ${m3}`,
        "0 TRLR", "",
      ].join("\n"),
    );
    await w.ok(["intake", foreign]);
    assert.equal(sourceOf(w, s3).read, undefined);
    assert.ok(!readersOf(Tree.open(w.cwd, w.env)).get(s3)?.has("user"));
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    w.cleanup();
  }
});

test("the day of a confirmation is this computer's: shortly after midnight the new day, never the day before by UTC (8 November 2026) — nothing written changes", () => {
  const txt = "Kateřina, dcera Jiřího Lhotáka z Lhoty č. 7.";
  const kept = process.env.TZ;
  try {
    const on = (tz: string, at: string) => {
      process.env.TZ = tz;
      return confirmedOn({ transcript: txt, read: { user: { how: "confirm", at, txt: transcriptMark(txt) } } } as Parameters<typeof confirmedOn>[0]);
    };
    // 00:30 in Prague is 23:30 UTC the day before
    assert.equal(on("Europe/Prague", "2026-11-07T23:30:00.000Z"), "2026-11-08");
    // 22:30 in New York is 03:30 UTC the next day
    assert.equal(on("America/New_York", "2026-11-08T03:30:00.000Z"), "2026-11-07");
    // the same moment where UTC is the calendar
    assert.equal(on("UTC", "2026-11-07T23:30:00.000Z"), "2026-11-07");
    // summer time
    assert.equal(on("Europe/Prague", "2026-06-30T22:15:00.000Z"), "2026-07-01");
    assert.equal(localDayOf("2026-11-08"), "2026-11-08", "a day alone stays itself");
    assert.equal(localDayOf("not a moment"), "not a mome");
    // taken back or another wording: no day
    assert.equal(confirmedOn({ transcript: txt + " x", read: { user: { how: "confirm", at: "2026-11-07T23:30:00.000Z", txt: transcriptMark(txt) } } } as Parameters<typeof confirmedOn>[0]), undefined);
  } finally {
    if (kept === undefined) delete process.env.TZ;
    else process.env.TZ = kept;
  }
});
