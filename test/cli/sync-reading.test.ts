// strom sync of an entry of a reading of a document the Strom app sends back (_STROM_READING): checked to be the
// research's reading (it exists, read to an end, the picture is its file, the transcript is its entry's), a source of
// it with the picture and the entry's excerpt, the facts as sure as their readers make them (one reader: possible and
// a task to look; two alike: probable; two apart or the words changed: a lead with both); a mark that does not check
// out is the app's source as any; an older app with no mark the same as before.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { halves, jpegWithOrientation } from "../image-samples.ts";
import { Tree } from "../../src/core/tree.ts";
import type { Input, Media, Person, Source, Task } from "../../src/core/model.ts";
import { READ_VERIFY_ORIGIN } from "../../src/core/sync.ts";
import { readersOf } from "../../src/core/review.ts";
import { listedReads, ReadingsSeen } from "../../src/core/live-read.ts";
import { get, post } from "./sync.helpers.ts";

const opts = { skip: !hasGit };

const READER = `import fs from "node:fs";
const p = process.env.STROM_PROMPT ?? "";
const report = /Write your report to (.+) AS YOU GO/.exec(p)[1];
const blind = p.includes("This is a BLIND reading");
const body = fs.readFileSync(blind ? process.env.DOC_BLIND : process.env.DOC_FIRST, "utf8");
const was = fs.readFileSync(report, "utf8");
fs.writeFileSync(report, was.replace("<!-- next block -->", body.trim() + "\\n<!-- next block -->"));
console.log("cost: 0.25");
`;

const entry = (day: number) => `## Entry e1 · page 1
region: 0.05,0.30,0.90,0.20
transcript: ${day}. Aprilis 1846 | Joannes filius | Josephi Nowák agricolae | et Mariae Dvořák | in Lhota
translation: ${day}. dubna 1846 Jan, syn Josefa Nowáka, rolníka, a Marie Dvořákové
person: p1 | child | dítě | written=Joannes | given=Jan | sex=M
person: p2 | father | otec | written=Josephi Nowák | given=Josef | surname=Nowák | sex=M | occupation=agricola
person: p3 | mother | matka | written=Mariae Dvořák | given=Marie | surname=Dvořáková | sex=F
event: BAPM | date=${day}.4.1846 | place=Lhota | persons=p1:principal,p2:father,p3:mother
relation: parent p2 p1
relation: parent p3 p1`;

const FIRST = `## Document
kind: register.baptism
language: la
date: 1846
legible: yes

${entry(3)}

## Context
context: Zápis křtu z matriky.

done: 1 entries`;

interface Read {
  id: string;
  sha: string;
  transcript: string;
}

async function setUp(): Promise<{ w: World; dir: string; photo: string }> {
  const w = new World();
  await w.withTree();
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Josef /Nowák/", "--sex", "M", "--born", "1815"]); // P0001
  await w.ok(["place", "add", "Lhota", "--kind", "village", "--unlocated", "test"]);
  const dir = path.join(w.dir, "doklady ř");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "reader.mjs"), READER);
  fs.writeFileSync(path.join(dir, "first.md"), FIRST);
  fs.writeFileSync(path.join(dir, "blind-same.md"), entry(3));
  fs.writeFileSync(path.join(dir, "blind-other.md"), entry(4));
  const photo = path.join(dir, "křest.jpg");
  fs.writeFileSync(photo, jpegWithOrientation(halves(1600, 1200), 1));
  Object.assign(w.env, {
    STROM_RUNNER_SCRIPT: path.join(dir, "reader.mjs"),
    DOC_FIRST: path.join(dir, "first.md"),
    DOC_BLIND: path.join(dir, "blind-same.md"),
    STROM_NO_CONVERT: "1",
  });
  return { w, dir, photo };
}

async function read(w: World, file: string, readers = 1): Promise<Read> {
  const d = (await w.ok(["document", "read", file, "--readers", String(readers), "--agent", "script", "--json"])).json;
  assert.equal(d.state, "done");
  const input = (await w.ok(["input", "show", d.pages[0].file, "--json"])).json.input as Input;
  return { id: d.id, sha: input.sha!, transcript: d.entries[0].transcript };
}

/** The app's GEDCOM: the research's tree and a new person baptised on an entry of the reading, cited as the app does. */
async function sent(w: World, name: string, mark: { reading?: string; sha?: string; text: string; date?: string }): Promise<string> {
  const ged = path.join(w.dir, `${name}.ged`);
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", ged]);
  const text = mark.text.split("\n");
  const source = [
    "0 @X9@ SOUR",
    "1 TITL Křest Jana 1846",
    `1 TEXT ${text[0]}`,
    ...text.slice(1).map((l) => `2 CONT ${l}`),
    ...(mark.reading ? [`1 _STROM_READING ${mark.reading}`, "2 _STROM_ENTRY e1"] : []),
    ...(mark.sha ? ["1 OBJE", "2 _STROM_KIND excerpt", `2 _STROM_SHA ${mark.sha}`] : []),
  ];
  const person = ["0 @X1@ INDI", "1 NAME Jan /Nowák/", "1 SEX M", "1 BAPM", `2 DATE ${mark.date ?? "3 APR 1846"}`, "2 PLAC Lhota", "2 SOUR @X9@"];
  const t = fs.readFileSync(ged, "utf8").replace(/^0 TRLR/m, [...person, ...source, "0 TRLR"].join("\n"));
  fs.writeFileSync(ged, t);
  return ged;
}

/** GET /reads of the bridge as it would answer now and in so many days: [id, inSource] of each reading listed. */
const listed = (w: World, days = 0) => listedReads(Tree.open(w.cwd, w.env), new ReadingsSeen(w.cwd, w.env), Date.now() + days * 24 * 3600_000).map((r) => [r.id, r.inSource]);

/** The input the last sync came as: what strom sync undo takes. */
const lastSync = (w: World) => Tree.open(w.cwd, w.env).list<Input>("input").filter((i) => i.id !== "I0001").at(-1)!.id;

const baptism = (w: World) => {
  const tree = Tree.open(w.cwd, w.env);
  const jan = tree.list<Person>("person").find((p) => !p.retracted && p.names[0]?.given === "Jan")!;
  return { tree, jan, bapm: jan.events.find((e) => !e.retracted && e.kind === "BAPM")! };
};

test("one reader: the entry a source of the reading with the picture and its excerpt, the baptism possible, a task to look; undone", opts, async () => {
  const { w, photo } = await setUp();
  try {
    const r = await read(w, photo);
    // the app sends the reading's " | " as new lines: the same transcript, not the person's
    const ged = await sent(w, "jeden", { reading: r.id, sha: r.sha, text: r.transcript.split(" | ").join("\n") });
    const said = (await w.ok(["sync", ged])).out;
    assert.match(said, /pramen: „Křest Jana 1846“ → pramen výzkumu z jeho vlastního čtení dokumentu/);
    assert.match(said, /křest 3\. 4\. 1846, Lhota → přidá se tak jistý, jak ho čtenáři dokumentu přečetli/);
    const plan = (await w.ok(["sync", ged, "--json"])).json;
    const src = plan.changes.find((c: { kind: string }) => c.kind === "source.new");
    assert.deepEqual(src.reading, { id: r.id, ok: true, entry: "e1" });
    await w.ok(["sync", ged, "--apply"]);
    const { tree, jan, bapm } = baptism(w);
    assert.equal(bapm.status, "possible");
    assert.match((bapm.note ?? ""), new RegExp(`${r.id}`));
    const s = tree.get<Source>(bapm.citations[0]!.source)!;
    assert.equal(s.reading, r.id);
    assert.equal(s.readingEntry, "e1");
    assert.equal(s.kind, "baptism");
    assert.equal(s.information, "primary");
    assert.equal(s.app, undefined, "the research's reading, not the user's words");
    assert.match(s.transcript!, /Joannes filius/);
    assert.equal(s.input, "I0001");
    // the picture and the entry's excerpt
    const media = (s.media ?? []).map((m) => tree.get<Media>(m)!);
    assert.ok(media.length >= 1);
    assert.ok(media.some((m) => m.sha === r.sha));
    // the photo sorted into the source
    const input = tree.get<Input>("I0001")!;
    assert.equal(input.state, "processed");
    assert.equal(input.sorted?.source, s.id);
    // one reader: a task to look at it
    const tasks = tree.list<Task>("task").filter((t) => t.origin === READ_VERIFY_ORIGIN);
    assert.equal(tasks.length, 1);
    assert.ok(tasks[0]!.subject.includes(jan.id));
    assert.ok(tasks[0]!.where.includes(s.id));
    // the research's readers read it, not the user
    assert.ok(!readersOf(tree).get(s.id)?.has("user"));
    // the app's history of readings (GET /reads): in a source of this tree; after 90 days no more listed
    assert.deepEqual(listed(w), [[r.id, true]]);
    assert.deepEqual(listed(w, 91), []);
    // back to the app: the source says its reading only to an app that shows it (APP_SHOWS_READINGS)
    const out = path.join(w.dir, "zpet.ged");
    const reading = new RegExp(`\\n1 _STROM_READING ${r.id}\\n2 _STROM_ENTRY e1\\n`);
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out], { env: { STROM_APP_VERSION: "3.13.1" } });
    assert.doesNotMatch(fs.readFileSync(out, "utf8"), /_STROM_READING/);
    for (const version of ["3.14.0", undefined]) {
      await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out], version ? { env: { STROM_APP_VERSION: version } } : {});
      assert.match(fs.readFileSync(out, "utf8"), reading, String(version));
    }
    await w.ok(["config", "set", "strom.app.url", "https://beta.stromapp.info/run/"]);
    await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", out], { env: { STROM_APP_VERSION: "3.13.1" } });
    assert.match(fs.readFileSync(out, "utf8"), reading);
    await w.ok(["config", "unset", "strom.app.url"]);
    // taken in already: nothing new, no second task
    await w.ok(["sync", ged, "--apply"]);
    assert.equal(Tree.open(w.cwd, w.env).list<Task>("task").filter((t) => t.origin === READ_VERIFY_ORIGIN).length, 1);
    // undone: the source gone, the photo as it was
    await w.ok(["sync", "undo", lastSync(w)]);
    const back = Tree.open(w.cwd, w.env);
    assert.equal(back.get<Input>("I0001")!.state, "new");
    assert.ok(back.get<Source>(s.id)!.retracted);
    // its source retracted: the reading to be come back to again, however old
    assert.deepEqual(listed(w), [[r.id, false]]);
    assert.deepEqual(listed(w, 91), [[r.id, false]]);
  } finally {
    w.cleanup();
  }
});

test("two readers alike: probable, no task; two apart: a lead with both readings beside it", opts, async () => {
  const { w, dir, photo } = await setUp();
  try {
    const same = await read(w, photo, 2);
    await w.ok(["sync", await sent(w, "shoda", { reading: same.id, sha: same.sha, text: same.transcript }), "--apply"]);
    const one = baptism(w);
    assert.equal(one.bapm.status, "probable");
    assert.equal(one.tree.list<Task>("task").filter((t) => t.origin === READ_VERIFY_ORIGIN).length, 0);
  } finally {
    w.cleanup();
  }
  const other = await setUp();
  try {
    other.w.env.DOC_BLIND = path.join(other.dir, "blind-other.md");
    const apart = await read(other.w, other.photo, 2);
    await other.w.ok(["sync", await sent(other.w, "rozdil", { reading: apart.id, sha: apart.sha, text: apart.transcript }), "--apply"]);
    const { bapm } = baptism(other.w);
    assert.equal(bapm.status, "lead");
    const note = (bapm.note ?? "");
    assert.match(note, /3\.4\.1846/);
    assert.match(note, /4\.4\.1846/);
  } finally {
    other.w.cleanup();
  }
  void dir;
});

test("the transcript changed by hand: the user's words in the source (the reading's beside them), the baptism a lead", opts, async () => {
  const { w, photo } = await setUp();
  try {
    const r = await read(w, photo, 2);
    const mine = r.transcript.replace("Joannes filius", "Joannes Baptista filius");
    const ged = await sent(w, "upraveno", { reading: r.id, sha: r.sha, text: mine });
    const plan = (await w.ok(["sync", ged, "--json"])).json;
    assert.equal(plan.changes.find((c: { kind: string }) => c.kind === "source.new").reading.edited, true);
    await w.ok(["sync", ged, "--apply"]);
    const { tree, bapm } = baptism(w);
    assert.equal(bapm.status, "lead");
    const s = tree.get<Source>(bapm.citations[0]!.source)!;
    assert.equal(s.reading, r.id);
    assert.deepEqual(s.app, { read: false });
    assert.match(s.transcript!, /Joannes Baptista filius/);
    assert.match(s.notes.map((n) => n.text).join(" "), /Joannes filius/);
  } finally {
    w.cleanup();
  }
});

test("a mark that does not check out — a reading nobody made, another picture — and an older app with none: the app's source as any", opts, async () => {
  const { w, dir, photo } = await setUp();
  try {
    const r = await read(w, photo);
    const today = async (name: string, mark: Parameters<typeof sent>[2], code?: string) => {
      const ged = await sent(w, name, mark);
      const plan = (await w.ok(["sync", ged, "--json"])).json;
      const src = plan.changes.find((c: { kind: string }) => c.kind === "source.new");
      if (code) assert.deepEqual({ ok: src.reading.ok, code: src.reading.code }, { ok: false, code });
      else assert.equal(src.reading, undefined);
      await w.ok(["sync", ged, "--apply"]);
      const { tree, bapm } = baptism(w);
      const s = tree.get<Source>(bapm.citations[0]!.source)!;
      assert.equal(s.reading, undefined, name);
      assert.ok(s.app, name);
      assert.equal(bapm.status, "lead", name);
      assert.equal(tree.get<Input>("I0001")!.state, "new", name);
      await w.ok(["sync", "undo", lastSync(w)]);
    };
    await today("podvrh", { reading: "D20990101000000-abcd", sha: r.sha, text: r.transcript }, "reading.none");
    await today("cizi", { reading: r.id, sha: "0".repeat(64), text: r.transcript }, "reading.sha");
    await today("starsi", { text: r.transcript });
    void dir;
  } finally {
    w.cleanup();
  }
});

test("the photo read already: input list, input show, the brief and strom readings say so, the file not read again", opts, async () => {
  const { w, photo } = await setUp();
  try {
    const r = await read(w, photo);
    const list = await w.ok(["input", "list"]);
    assert.match(list.out, new RegExp(`I0001 .*read ${r.id} \\(strom readings ${r.id}\\)`));
    assert.deepEqual((await w.ok(["input", "list", "--json"])).json.inputs[0].read, [r.id]);
    const show = await w.ok(["input", "show", "I0001"]);
    assert.match(show.out, new RegExp(`read   ${r.id} done — read already: strom readings ${r.id}; not read again`));
    assert.deepEqual((await w.ok(["input", "show", "I0001", "--json"])).json.readings, [{ id: r.id, state: "done" }]);
    const said = await w.ok(["readings", r.id]);
    assert.match(said.out, /Joannes filius/);
    assert.match((await w.ok(["readings", "--list"])).out, new RegExp(`${r.id} · document · done`));
    // an intake task of it: the brief says it is read
    await w.ok(["task", "add", "Zpracovat fotku křtu", "--level", "intake", "--where", "I0001", "--why", "fotka", "--done-when", "zapsáno", "--about", "P0001"]);
    const brief = await w.ok(["brief"]);
    assert.match(brief.out, new RegExp(`read: ${r.id} done — read already: strom readings ${r.id}; not read again`));
    assert.doesNotMatch(brief.out, /křest\.jpg — open it and read it yourself/);
  } finally {
    w.cleanup();
  }
});

test("through the bridge: /status says it takes readings back, POST /sync says of each source whether it is the research's reading", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { w, photo } = await setUp();
  try {
    const r = await read(w, photo);
    const info = (await w.ok(["live", "start", "--json"])).json;
    try {
      const app = { Origin: "https://beta.stromapp.info" };
      const status = JSON.parse((await get(`${info.url}/status`)).body);
      assert.ok(status.features.includes("read.sync"));
      // another picture than the reading's: the app's source as any
      const forged = fs.readFileSync(await sent(w, "most-cizi", { reading: r.id, sha: "f".repeat(64), text: r.transcript }), "utf8");
      const no = JSON.parse((await post(`${info.url}/sync`, forged, app)).body);
      assert.deepEqual(no.readings, [{ source: "@X9@", read: r.id, ok: false, code: "reading.sha" }]);
      assert.equal(baptism(w).bapm.status, "lead");
      await w.ok(["sync", "undo", lastSync(w)]);
      const good = fs.readFileSync(await sent(w, "most", { reading: r.id, sha: r.sha, text: r.transcript }), "utf8");
      const ok = JSON.parse((await post(`${info.url}/sync`, good, app)).body);
      assert.deepEqual(ok.readings, [{ source: "@X9@", read: r.id, ok: true, entry: "e1" }]);
      assert.equal(baptism(w).bapm.status, "possible");
    } finally {
      await w.run(["live", "stop"]);
    }
  } finally {
    w.cleanup();
  }
});
