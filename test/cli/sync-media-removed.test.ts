// The Strom app's files taken off (spec 108 P3, P4): a send that says it carries every file of its tree (POST
// /sync?media=app) takes off a place of a file it was given with the files (the head the bridge gave with media=app,
// and what its own sends wrote since) and no longer has — a portrait, a couple's photo, an attachment, a file of an
// event or a source; a record with no place left is out of the tree, its file stays; sync undo puts it back. A send
// without that word, one against a head the app was not given with the files, never takes anything off, nor what
// another window added since; the title, kind, date and note three-way. A couple's photo is the one marked _PRIM Y
// where its files say _PRIM (the return marks its attachments N); an adopted tree's files become records.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { awaitAdoption, receiveAdopted, restoreTakenOff } from "../../src/core/sync.ts";
import { servedWithMedia } from "../../src/core/treemedia.ts";
import { create, update } from "../../src/core/records.ts";
import type { Input } from "../../src/core/model.ts";
import { execFileSync } from "node:child_process";

const opts = { skip: !hasGit || process.platform === "win32" };
const APP = "https://beta.stromapp.info";
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const img = (name: string) => fs.readFileSync(path.join(fixtures, name));
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

const PORTRAIT = img("s0001.jpg");
const SHARED = img("grey.jpg");
const DEATH = img("png-rgb.png");
const COUPLE = img("base420.jpg");
const COUPLE_MORE = img("base444.jpg");
const PAGE = img("png-pal.png");
const LATER = img("s0003.jpg");

type Link = { type: string; ref: string; event?: string; input?: string; retracted?: { reason: string; input?: string } };
type Rec = { id: string; sha?: string; name: string; title?: string; titled?: { by: string }; date?: string; retracted?: unknown; working?: { sha: string }; links?: Link[] };

function noAgent(w: World): void {
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
}

/** Václav Lhoták (P1, died 1960 in Lhota citing S1) and Eva Lhotáková (P2), married in Lhota (F1); the file the app was given. */
async function world(state: "research" | "archive" | "waiting" = "research"): Promise<{ w: World; given: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1890"]);
  await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F", "--born", "1893"]);
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]);
  await w.ok(["event", "add", "F1", "MARR", "--date", "1915", "--place", "Lhota"]);
  await w.ok(["source", "add", "Matrika zemřelých Lhota", "--kind", "burial"]);
  await w.ok(["event", "add", "P1", "DEAT", "--date", "1960", "--place", "Lhota", "--cite", "S0001"]);
  if (state === "archive") await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
  if (state === "waiting") noAgent(w);
  const given = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  return { w, given };
}

function obje(level: number, o: { data: Buffer; mime?: string; form?: string; titl: string; name?: string; kind?: string; prim?: "Y" | "N"; date?: string }): string[] {
  const l = (n: number, s: string) => `${level + n} ${s}`;
  const url = `data:${o.mime ?? "image/jpeg"};base64,${o.data.toString("base64")}`;
  const parts = url.match(/.{1,180}/gs)!;
  return [
    `${level} OBJE`,
    l(1, `FILE ${parts[0]}`),
    ...parts.slice(1).map((p) => l(2, `CONC ${p}`)),
    l(1, `FORM ${o.form ?? "jpg"}`),
    l(1, `TITL ${o.titl}`),
    ...(o.name ? [l(1, `_STROM_NAME ${o.name}`)] : []),
    ...(o.kind ? [l(1, `_STROM_KIND ${o.kind}`)] : []),
    ...(o.prim ? [l(1, `_PRIM ${o.prim}`)] : []),
    ...(o.date ? [l(1, `_DATE ${o.date}`)] : []),
  ];
}

const isRecord = (r: string, which: string) => new RegExp(`\\n1 REFN ${which}\\n`).test(`${r}\n`) || r.startsWith(`0 ${which}`);
const splitRecords = (t: string) => t.split(/\n(?=0 )/);

function under(t: string, which: string, lines: string[]): string {
  return splitRecords(t)
    .map((r) => (isRecord(r, which) ? `${r.replace(/\n+$/, "")}\n${lines.join("\n")}` : r))
    .join("\n");
}

function underFact(t: string, refn: string, tag: string, lines: string[]): string {
  return splitRecords(t)
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

/** A record's OBJE (any level) whose lines say `mark`, taken out of the file — as the app's user removed it. */
function drop(t: string, which: string, mark: string): string {
  let found = false;
  const out = splitRecords(t).map((r) => {
    if (!isRecord(r, which)) return r;
    const rows = r.split("\n");
    for (let i = 0; i < rows.length; i++) {
      const m = /^(\d+) OBJE$/u.exec(rows[i]!);
      if (!m) continue;
      const level = Number(m[1]);
      let end = i + 1;
      while (end < rows.length && Number(rows[end]!.split(" ")[0]) > level) end++;
      if (rows.slice(i + 1, end).some((x) => x.endsWith(mark))) {
        found = true;
        return [...rows.slice(0, i), ...rows.slice(end)].join("\n");
      }
    }
    return r;
  });
  assert.ok(found, `no OBJE of ${which} saying ${mark}`);
  return out.join("\n");
}

/** A record's OBJE whose lines say `mark`: a line of it changed (`from` → `to`; to nothing: taken out). */
function edit(t: string, which: string, mark: string, from: RegExp, to: string): string {
  return splitRecords(t)
    .map((r) => {
      if (!isRecord(r, which)) return r;
      const rows = r.split("\n");
      for (let i = 0; i < rows.length; i++) {
        const m = /^(\d+) OBJE$/u.exec(rows[i]!);
        if (!m) continue;
        let end = i + 1;
        while (end < rows.length && Number(rows[end]!.split(" ")[0]) > Number(m[1])) end++;
        if (rows.slice(i + 1, end).some((x) => x.endsWith(mark)))
          return [...rows.slice(0, i + 1), ...rows.slice(i + 1, end).map((x) => x.replace(from, to)).filter((x) => x !== ""), ...rows.slice(end)].join("\n");
      }
      return r;
    })
    .join("\n");
}

const sourceXref = (t: string, id: string) => new RegExp(`0 (@[^@]+@) SOUR\\n(?:[1-9].*\\n)*?1 REFN ${id}\\n`).exec(t)?.[1] ?? assert.fail(`no ${id} in the file`);

/** The app's file: as the app 3.31 writes it, of its own tree (_STROM_APP_TREE). */
const asApp = (t: string, appTree = "T1") => t.replace(/^0 HEAD\n/u, `0 HEAD\n1 _STROM_APP_TREE ${appTree}\n`).replace(/^1 SOUR STROM_RESEARCH$/mu, "1 SOUR STROM\n2 VERS 3.31.0");

/** The files the app's tree has first: a portrait, one file at both partners, an event's, a couple's photo and attachment, a source's page. */
function withFiles(t: string): string {
  let out = asApp(t);
  const s1 = sourceXref(out, "S0001");
  out = under(out, "P0001", [...obje(1, { data: PORTRAIT, titl: "Václav.jpg", kind: "photo" }), ...obje(1, { data: SHARED, titl: "Rodina", name: "rodina.jpg" })]);
  out = under(out, "P0002", obje(1, { data: SHARED, titl: "Rodina", name: "rodina.jpg" }));
  out = underFact(out, "P0001", "DEAT", obje(2, { data: DEATH, mime: "image/png", form: "png", titl: "parte.png" }));
  out = under(out, "@F0001@ FAM", [...obje(1, { data: COUPLE, titl: "svatba.jpg" }), ...obje(1, { data: COUPLE_MORE, titl: "pozvanka.jpg" })]);
  out = under(out, `${s1} SOUR`, obje(1, { data: PAGE, mime: "image/png", form: "png", titl: "strana-12.png" }));
  return out;
}

const records = (w: World): Rec[] =>
  fs
    .readdirSync(path.join(w.cwd, "data", "inputs"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "inputs", f), "utf8")) as Rec);
const recordOf = (w: World, h: string): Rec => records(w).find((r) => !r.retracted && (r.sha === h || r.working?.sha === h)) ?? assert.fail(`no record of ${h.slice(0, 8)}`);
const live = (r: Rec) => (r.links ?? []).filter((l) => !l.retracted).map((l) => `${l.type}:${l.ref}${l.event ? `:${l.event}` : ""}`).sort();

function stored(w: World, h: string): boolean {
  const walk = (dir: string): boolean =>
    fs.readdirSync(dir, { withFileTypes: true }).some((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return e.name !== ".git" && walk(p);
      return e.name.startsWith(`${h}.`) && p.includes(`${path.sep}media${path.sep}${h.slice(0, 2)}${path.sep}`);
    });
  return walk(w.dir);
}

type Got = { status: number; headers: http.IncomingHttpHeaders; text: string };
function ask(url: string, method = "GET", body?: string): Promise<Got> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, method, headers: { Origin: APP, ...(body ? { "Content-Type": "text/plain; charset=utf-8" } : {}) } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, text: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    req.end(body);
  });
}

type Answer = { changes: number; input?: string; media?: Record<string, unknown>[] };
async function send(url: string, text: string, media = true): Promise<Answer> {
  const res = await ask(`${url}/sync${media ? "?media=app" : ""}`, "POST", text);
  assert.equal(res.status, 200, res.text);
  return JSON.parse(res.text) as Answer;
}

/** The tree with its files as the bridge gives the app (media=app, the images in it), its head kept as given with them. */
async function given(w: World, url: string): Promise<string> {
  const got = await ask(`${url}/tree.ged?media=app`);
  assert.equal(got.status, 200, got.text);
  assert.ok(servedWithMedia(w.cwd, String(got.headers["x-strom-head"])), "the head given with the files is kept");
  return asApp(got.text.replace(/\r\n/g, "\n"));
}

/** A research with the app's files written (the first send), its bridge running. */
async function started(state: "research" | "archive" | "waiting" = "research"): Promise<{ w: World; url: string }> {
  const { w, given: g } = await world(state);
  const file = path.join(w.dir, "app.ged");
  fs.writeFileSync(file, withFiles(fs.readFileSync(g, "utf8")));
  await w.ok(["sync", file, "--apply", "--json"]);
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  return { w, url: info.url };
}

for (const state of ["research", "archive", "waiting"] as const)
  test(`spec 108 (${state}): a send with media=app that no longer has an attachment takes its place off; sync undo puts it back; the file stays`, opts, async () => {
    const { w, url } = await started(state);
    try {
      const t = await given(w, url);
      const before = records(w).length;
      const got = await send(url, drop(t, "@F0001@ FAM", "TITL pozvanka.jpg"));
      const rec = recordOf(w, sha(COUPLE_MORE));
      assert.deepEqual(got.media, [{ kind: "media.attachment.removed", family: "F0001", record: rec.id }], JSON.stringify(got));
      assert.deepEqual(live(rec), [], "out of the tree");
      const off = rec.links!.find((l) => l.type === "family")!;
      assert.deepEqual([off.retracted?.reason, off.retracted?.input], ["app", got.input]);
      assert.equal(records(w).length, before + 1, "the send's input, no record made or dropped");
      assert.ok(stored(w, sha(COUPLE_MORE)), "the file stays in the shared store");
      assert.deepEqual(live(recordOf(w, sha(COUPLE))), ["familyPhoto:F0001"], "the couple's photo stays");
      await w.ok(["sync", "undo", got.input!, "--reason", "omyl"]);
      assert.deepEqual(live(recordOf(w, sha(COUPLE_MORE))), ["family:F0001"], "back");
    } finally {
      await w.ok(["live", "stop"]);
    }
    w.cleanup();
  });

test("spec 108: every kind of place taken off — a portrait, a couple's photo (its attachment stays one, _PRIM N), a file at one of two people, an event's, a source's; back in the tree by restoreTakenOff", opts, async () => {
  const { w, url } = await started();
  try {
    const t = await given(w, url);
    // the return marks the couple's photo Y and its attachment N
    assert.match(t, /2 TITL svatba\.jpg\n2 _PRIM Y\n/u);
    assert.match(t, /2 TITL pozvanka\.jpg\n2 _PRIM N\n/u);
    let edited = drop(t, "P0001", "_STROM_KIND photo");
    edited = drop(edited, "P0001", "TITL Rodina");
    edited = drop(edited, "P0001", "TITL parte.png");
    edited = drop(edited, "@F0001@ FAM", "TITL svatba.jpg");
    edited = drop(edited, `${sourceXref(edited, "S0001")} SOUR`, "TITL strana-12.png");
    const got = await send(url, edited);
    const id = (b: Buffer) => recordOf(w, sha(b)).id;
    const death = (await w.ok(["person", "show", "P1", "--json"])).json.person.events.find((e: { kind: string }) => e.kind === "DEAT").id as string;
    const want = [
      { kind: "media.photo.removed", person: "P0001", record: id(PORTRAIT) },
      { kind: "media.attachment.removed", person: "P0001", record: id(SHARED) },
      { kind: "media.unlink", person: "P0001", event: death, record: id(DEATH) },
      { kind: "media.couplePhoto.removed", family: "F0001", record: id(COUPLE) },
      { kind: "media.unlink", source: "S0001", record: id(PAGE) },
    ];
    assert.deepEqual(got.media!.map((m) => JSON.stringify(m)).sort(), want.map((m) => JSON.stringify(m)).sort(), JSON.stringify(got));
    assert.deepEqual(live(recordOf(w, sha(SHARED))), ["person:P0002"], "the other person's place stays: in the tree");
    assert.deepEqual(live(recordOf(w, sha(COUPLE_MORE))), ["family:F0001"], "the attachment stays an attachment");
    for (const b of [PORTRAIT, DEATH, COUPLE, PAGE]) {
      assert.deepEqual(live(recordOf(w, sha(b))), [], "out of the tree");
      assert.ok(stored(w, sha(b)), "its file stays");
    }
    // the return has none of them now; sent back unchanged it changes nothing
    const again = await given(w, url);
    assert.doesNotMatch(again, /TITL (Václav\.jpg|parte\.png|svatba\.jpg|strana-12\.png)/u);
    assert.equal((await send(url, again)).changes, 0);
    // "Vrátit" (spec 102 M3): the places the last send took, back
    const tree = Tree.open(w.cwd, w.env);
    const back = restoreTakenOff(tree, id(PORTRAIT), "the user's word");
    assert.deepEqual(back?.map((l) => `${l.type}:${l.ref}`), ["personPortrait:P0001"]);
    assert.deepEqual(live(recordOf(w, sha(PORTRAIT))), ["personPortrait:P0001"]);
    assert.equal(restoreTakenOff(tree, id(PORTRAIT), "again"), undefined, "in the tree: nothing to give back");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("spec 108 P4: nothing is taken off by a send without media=app, nor against a head the app was not given with the files", opts, async () => {
  const { w, url } = await started();
  try {
    // without the word: the files only add
    const t = await given(w, url);
    const without = await send(url, drop(t, "P0001", "_STROM_KIND photo"), false);
    assert.equal(without.changes, 0, JSON.stringify(without));
    assert.deepEqual(live(recordOf(w, sha(PORTRAIT))), ["personPortrait:P0001"]);
    // a head the bridge gave without the files (the export, an older app's return): nothing taken off
    await w.ok(["note", "add", "P1", "Kovář v Lhotě"]);
    const plain = path.join(w.dir, "plain.ged");
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", plain]);
    const head = /^1 _STROM_HEAD (\S+)$/mu.exec(fs.readFileSync(plain, "utf8"))?.[1] ?? assert.fail("no head");
    assert.equal(servedWithMedia(w.cwd, head), false);
    const old = await send(url, drop(asApp(fs.readFileSync(plain, "utf8")), "P0001", "_STROM_KIND photo"));
    assert.equal(old.changes, 0, JSON.stringify(old));
    assert.deepEqual(live(recordOf(w, sha(PORTRAIT))), ["personPortrait:P0001"]);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("spec 108 P4: a file another window added after this window's head is never taken off by it; one this window's own send added since is", opts, async () => {
  const { w, url } = await started();
  try {
    const t = await given(w, url);
    // another window (T2) adds a file at Eva
    const other = await send(url, under(t.replace(/_STROM_APP_TREE T1/u, "_STROM_APP_TREE T2"), "P0002", obje(1, { data: LATER, titl: "Eva.jpg", name: "eva.jpg" })));
    assert.equal(other.media?.[0]?.kind, "media.attachment");
    // this window (T1) sends its copy (no such file): nothing taken off
    const mine = await send(url, t);
    assert.equal(mine.changes, 0, JSON.stringify(mine));
    assert.deepEqual(live(recordOf(w, sha(LATER))), ["person:P0002"]);
    // this window adds a file at Václav (its own send, no new return), then removes it again: taken off
    const added = under(t, "P0001", obje(1, { data: LATER, titl: "Václav mladý", name: "vaclav.jpg" }));
    const first = await send(url, added);
    assert.ok(first.input && first.media?.some((m) => m.kind === "media.attachment" && m.person === "P0001"), JSON.stringify(first));
    assert.deepEqual(live(recordOf(w, sha(LATER))), ["person:P0001", "person:P0002"]);
    const removed = await send(url, t);
    assert.deepEqual(removed.media, [{ kind: "media.attachment.removed", person: "P0001", record: recordOf(w, sha(LATER)).id }], JSON.stringify(removed));
    assert.deepEqual(live(recordOf(w, sha(LATER))), ["person:P0002"], "the other window's place stays");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("spec 108: a title changed in the app is written (media.edit), one removed taken off, one changed only in the research stays; the same in any script", opts, async () => {
  const { w, url } = await started();
  try {
    const shared = recordOf(w, sha(SHARED));
    const couple = recordOf(w, sha(COUPLE));
    // the research titles the couple's photo after the app was given it… (the agent's sorting)
    const t = await given(w, url);
    await w.ok(["input", "sort", couple.id, "--as", "photo", "--title", "Svatba v Lhotě"]);
    // …the app: a new title in another script and in NFD, and one removed (its name alone)
    let edited = edit(t, "P0001", "_STROM_NAME rodina.jpg", /^2 TITL Rodina$/u, "2 TITL Семья Лхотаковых");
    edited = edit(edited, "P0002", "_STROM_NAME rodina.jpg", /^2 TITL Rodina$/u, "2 TITL Семья Лхотаковых");
    edited = edit(edited, "P0001", "_STROM_KIND photo", /^2 TITL .*$/u, "2 TITL Václav.jpg".normalize("NFD"));
    const got = await send(url, edited);
    const edits = (got.media ?? []).filter((m) => m.kind === "media.edit");
    assert.deepEqual(edits.map((m) => [m.record, m.fields]), [[shared.id, ["title"]]], JSON.stringify(got));
    assert.equal(recordOf(w, sha(SHARED)).title, "Семья Лхотаковых");
    assert.equal(recordOf(w, sha(COUPLE)).title, "Svatba v Lhotě", "the research's title stays");
    const t2 = await given(w, url);
    // the title taken off in the app: TITL is its name alone, no _STROM_NAME
    const untitled = (x: string, who: string) => edit(edit(x, who, "_STROM_NAME rodina.jpg", /^2 TITL .*$/u, "2 TITL rodina.jpg"), who, "TITL rodina.jpg", /^2 _STROM_NAME .*$/u, "");
    const off = await send(url, untitled(untitled(t2, "P0001"), "P0002"));
    assert.deepEqual((off.media ?? []).map((m) => [m.kind, m.fields]), [["media.edit", ["title"]]], JSON.stringify(off));
    const after = recordOf(w, sha(SHARED));
    assert.deepEqual([after.title, after.titled, after.name], [undefined, undefined, "rodina.jpg"]);
    await w.ok(["sync", "undo", off.input!, "--reason", "omyl"]);
    assert.equal(recordOf(w, sha(SHARED)).title, "Семья Лхотаковых", "sync undo puts the title back");
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("spec 108: a couple with attachments alone — read with no couple's photo where its files say _PRIM; the round trip gives none", opts, async () => {
  const { w, given: g } = await world();
  // an app that marks _PRIM: N on both — no photo of the couple
  let t = asApp(fs.readFileSync(g, "utf8"));
  t = under(t, "@F0001@ FAM", [...obje(1, { data: COUPLE, titl: "pozvanka.jpg", prim: "N" }), ...obje(1, { data: COUPLE_MORE, titl: "oznameni.jpg", prim: "N" })]);
  const file = path.join(w.dir, "app.ged");
  fs.writeFileSync(file, t);
  await w.ok(["sync", file, "--apply", "--json"]);
  assert.deepEqual([live(recordOf(w, sha(COUPLE))), live(recordOf(w, sha(COUPLE_MORE)))], [["family:F0001"], ["family:F0001"]]);
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  try {
    const back = await given(w, info.url);
    assert.doesNotMatch(back, /_PRIM Y/u);
    assert.equal((back.match(/2 _PRIM N/gu) ?? []).length, 2);
    const got = await send(info.url, back);
    assert.equal(got.changes, 0, JSON.stringify(got));
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("spec 108: an adopted tree's files become records with their places; nothing taken off; the copy kept in the research has no image", opts, async () => {
  const w = new World();
  await w.withTree("Lhotákovi");
  const ged = [
    "0 HEAD", "1 SOUR STROM", "2 VERS 3.31.0", "1 GEDC", "2 VERS 5.5.1", "1 CHAR UTF-8",
    "0 @I1@ INDI", "1 NAME Václav /Lhoták/", "1 SEX M", "1 BIRT", "2 DATE 1890",
    ...obje(1, { data: PORTRAIT, titl: "Václav.jpg", kind: "photo" }),
    ...obje(1, { data: SHARED, titl: "Rodina", name: "rodina.jpg", date: "1925" }),
    "0 TRLR", "",
  ].join("\n");
  awaitAdoption(w.cwd, "C".repeat(43));
  const kept = receiveAdopted(w.cwd, ged);
  const r = (await w.ok(["sync", kept, "--apply", "--force", "--json"])).json;
  assert.ok(r.input, JSON.stringify(r));
  const p = (await w.ok(["person", "list", "--json"])).json.persons[0].id as string;
  assert.deepEqual([recordOf(w, sha(PORTRAIT)).links?.map((l) => `${l.type}:${l.ref}`), recordOf(w, sha(SHARED)).links?.map((l) => `${l.type}:${l.ref}`)], [[`personPortrait:${p}`], [`person:${p}`]]);
  assert.deepEqual([recordOf(w, sha(SHARED)).title, recordOf(w, sha(SHARED)).date], ["Rodina", "1925"]);
  assert.ok(stored(w, sha(PORTRAIT)) && stored(w, sha(SHARED)), "the bytes in the shared store");
  const input = records(w).find((x) => x.id === r.input) as Rec & { file?: string };
  assert.ok(input.file, "the tree kept as the source's document");
  assert.doesNotMatch(fs.readFileSync(path.join(w.cwd, input.file!), "utf8"), /data:image/u, "without its images");
  w.cleanup();
});

const clean = (w: World) => execFileSync("git", ["-C", w.cwd, "status", "--porcelain", "--", "data"], { encoding: "utf8" }).trim();
const NOTE = { text: "od babičky z Lhoty — Семья".normalize("NFD"), at: "2026-11-21T16:33:01.860Z", by: "user" as const };

/** The user's note on a record of the material, committed (as the person wrote it in the research's material). */
function noted(w: World, id: string): void {
  const tree = Tree.open(w.cwd, w.env);
  tree.withTreeLock(() => {
    update<Input>(tree, id, "input", (r) => ({ ...r, notes: [...(r.notes ?? []), NOTE] }), { op: "input.note", summary: `${id} the user's note` });
    tree.commit("the user's note");
  });
}

test("a file of the research's material the app was never given (no place in the tree), its note the user's: the app's send that puts it at a person without NOTE keeps the note, the send written and committed", opts, async () => {
  const { w, url } = await started();
  try {
    const tree = Tree.open(w.cwd, w.env);
    let id = "";
    tree.withTreeLock(() => {
      id = create<Input>(tree, "input", { name: "lhota.jpg", file: "inputs/lhota.jpg", sha: sha(LATER), kind: "photo", state: "new", from: "the Strom app" } as never, (x) => `+${x}`).id;
      tree.commit("a file of the material");
    });
    noted(w, id);
    const t = await given(w, url);
    assert.ok(!t.includes("lhota.jpg"), "never given to the app");
    const got = await send(url, under(t, "P0002", obje(1, { data: LATER, titl: "lhota.jpg" })));
    assert.ok(got.input, JSON.stringify(got));
    const rec = recordOf(w, sha(LATER)) as Rec & { notes?: { text: string }[] };
    assert.equal(rec.id, id);
    assert.deepEqual(live(rec), ["person:P0002"]);
    assert.deepEqual(rec.notes?.map((n) => n.text), [NOTE.text.normalize("NFC")], "the note stays");
    assert.equal(clean(w), "", "committed");
    assert.equal((await w.run(["check"])).out.includes("item-removed"), false);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("a note the user took off in the app, of a file the app was given with it: taken off with a reason, committed", opts, async () => {
  const { w, url } = await started();
  try {
    const shared = recordOf(w, sha(SHARED));
    noted(w, shared.id);
    const t = await given(w, url);
    const said = (x: string, who: string) => edit(x, who, "_STROM_NAME rodina.jpg", /^2 NOTE .*$/u, "");
    assert.match(t, /\n2 NOTE od babičky/u, "given with its note");
    const got = await send(url, said(said(t, "P0001"), "P0002"));
    assert.deepEqual((got.media ?? []).filter((m) => m.kind === "media.edit").map((m) => [m.record, m.fields]), [[shared.id, ["note"]]], JSON.stringify(got));
    const rec = recordOf(w, sha(SHARED)) as Rec & { notes?: unknown[] };
    assert.deepEqual(rec.notes ?? [], []);
    assert.equal(clean(w), "", "committed");
    const ops = execFileSync("git", ["-C", w.cwd, "show", "HEAD", "--", "data/ops"], { encoding: "utf8" });
    assert.match(ops, /"op":"input\.media"[^\n]*"reason":"its note taken off in the Strom app"/u);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});
