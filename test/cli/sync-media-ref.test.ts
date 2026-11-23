// The Strom app's files by reference (spec 133 §1): a file the research has comes as `_STROM_DATA <sha>` where its
// `FILE data:…` would be, the research's excerpt with no FILE at all. The same tree once with the data, once by
// reference, gives the same plan, the same count in the inbox, the same research written (records, history) and the
// same material files — also against a kept send of the other kind (_STROM_SINCE). The bridge's check finds the hashes
// the research does not have (never an excerpt's); a file by reference nobody has is never written as a record.
// Through a real bridge: a send naming a file the research cannot find is refused whole (409 sync.media-ref-unknown),
// nothing kept; the same send by reference writes what it writes with the data; POST /media/known knows a working copy.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { post, get } from "./sync.helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { Settings } from "../../src/core/config.ts";
import { receiveTree } from "../../src/core/sync.ts";
import { checkMediaRefs, mediaRefsOf, storedBytes } from "../../src/core/appmedia.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const img = (name: string) => fs.readFileSync(path.join(fixtures, name));
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

const PORTRAIT = img("s0001.jpg");
const ORIGINAL = img("s0002.jpg");
const WORKING = img("grey.jpg");
const DEATH = img("png-rgb.png");
const COUPLE = img("base420.jpg");
const PAGE = img("png-pal.png");
const CLIP = img("proggrey.jpg");
const LATER = img("s0003.jpg");
const RECORD = img("png-grey.png");

/** Václav Lhoták (P1, died 1960 in Lhota citing S1) and Eva Lhotáková (P2), married in Lhota (F1); the original of an attachment; the file the app was given. */
async function world(): Promise<{ w: World; given: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1890"]);
  await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F", "--born", "1893"]);
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]);
  await w.ok(["event", "add", "F1", "MARR", "--date", "1915", "--place", "Lhota"]);
  await w.ok(["source", "add", "Matrika zemřelých Lhota", "--kind", "burial"]);
  await w.ok(["event", "add", "P1", "DEAT", "--date", "1960", "--place", "Lhota", "--cite", "S0001"]);
  const f = path.join(w.dir, "prijato.jpg");
  fs.writeFileSync(f, ORIGINAL);
  await w.ok(["media", "original", f, "--sha", sha(ORIGINAL), "--name", "svatba-1915.jpg", "--person", "P0001", "--json"]);
  const given = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  return { w, given };
}

type How = "data" | "ref";

/** A file's lines as the app writes them: its data URL (CONC pieces) — or, by reference, `_STROM_DATA <sha>` in its place (an excerpt: nothing). */
function obje(level: number, how: How, o: { data: Buffer; mime?: string; form: string; type?: string; titl?: string; name?: string; kind?: string; sha?: string; clip?: string; prim?: "Y" | "N"; date?: string; record?: true }): string[] {
  const l = (n: number, s: string) => `${level + n} ${s}`;
  const url = `data:${o.mime ?? "image/jpeg"};base64,${o.data.toString("base64")}`;
  const parts = url.match(/.{1,180}/gs)!;
  const file = how === "data" ? [l(1, `FILE ${parts[0]}`), ...parts.slice(1).map((p) => l(2, `CONC ${p}`))] : o.kind === "excerpt" ? [] : [l(1, `_STROM_DATA ${sha(o.data)}`)];
  return [
    `${level} ${o.record ? "@M1@ OBJE" : "OBJE"}`,
    ...(o.record ? [] : file),
    l(1, `FORM ${o.form}`),
    ...(o.type ? [l(2, `TYPE ${o.type}`)] : []),
    ...(o.titl ? [l(1, `TITL ${o.titl}`)] : []),
    ...(o.name ? [l(1, `_STROM_NAME ${o.name}`)] : []),
    ...(o.kind ? [l(1, `_STROM_KIND ${o.kind}`)] : []),
    ...(o.clip ? [l(1, `_STROM_CLIP ${o.clip}`)] : []),
    ...(o.sha ? [l(1, `_STROM_SHA ${o.sha}`)] : []),
    ...(o.prim ? [l(1, `_PRIM ${o.prim}`)] : []),
    ...(o.date ? [l(1, `_DATE ${o.date}`)] : []),
    // the record of a file at many places: its data (or reference) first, its FORM, TITL under the record
    ...(o.record ? file : []),
  ];
}

const isRecord = (r: string, which: string) => new RegExp(`\\n1 REFN ${which}\\n`).test(`${r}\n`) || r.startsWith(`0 ${which}`);
function under(t: string, which: string, lines: string[]): string {
  return t
    .split(/\n(?=0 )/)
    .map((r) => (isRecord(r, which) ? `${r.replace(/\n+$/, "")}\n${lines.join("\n")}` : r))
    .join("\n");
}
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
const sourceXref = (t: string, id: string) => new RegExp(`0 (@[^@]+@) SOUR\\n(?:[1-9].*\\n)*?1 REFN ${id}\\n`).exec(t)?.[1] ?? assert.fail(`no ${id} in the file`);

/**
 * The app's tree at a step: 0 — its first files; 1 — the same files at more places, a title of the user's, a record of
 * a file at many places, one new image (always with its data), an edit of a fact; 2 — another title, another fact.
 * Files the research has go `how` (by reference or with data); the excerpt of the research always as `how`.
 */
function send(given: string, step: 0 | 1 | 2, how: How, o: { since?: string | undefined; known?: true } = {}): string {
  let t = fs
    .readFileSync(given, "utf8")
    .replace(/^1 SOUR STROM_RESEARCH$/m, "1 SOUR STROM\n2 VERS 3.31.0")
    .replace(/^0 HEAD$/m, `0 HEAD\n1 _STROM_APP_TREE t1${o.since ? `\n1 _STROM_SINCE ${o.since}` : ""}`);
  // the first send: none of its files known to the research yet (`known`: as if they were)
  const known: How = step === 0 && !o.known ? "data" : how;
  const s1 = sourceXref(t, "S0001");
  const title = step === 0 ? "Svatba v Lhotě" : step === 1 ? "Svatba v Lhotě 1915" : "Svatba Václava a Evy";
  t = under(t, "P0001", [
    ...obje(1, known, { data: PORTRAIT, form: "jpeg", titl: "Václav.jpg", kind: "photo" }),
    // a working copy of an original the research keeps
    ...obje(1, known, { data: WORKING, form: "jpeg", type: "photo", titl: title, name: "svatba-1915.jpg", sha: sha(ORIGINAL), date: "1915" }),
    ...(step > 0 ? ["1 OBJE @M1@"] : []),
  ]);
  if (step > 0) t = under(t, "P0002", [...obje(1, known, { data: PORTRAIT, form: "jpeg", titl: "Václav.jpg" }), ...obje(1, "data", { data: LATER, form: "jpeg", titl: "Eva na zahradě.jpg" })]);
  t = underFact(t, "P0001", "DEAT", obje(2, known, { data: DEATH, mime: "image/png", form: "png", titl: "parte.png" }));
  t = under(t, "@F0001@ FAM", obje(1, known, { data: COUPLE, form: "jpeg", titl: "svatba.jpg", prim: "Y" }));
  t = under(t, `${s1} SOUR`, [
    ...obje(1, known, { data: PAGE, mime: "image/png", form: "png", titl: "strana-12.png" }),
    // the research's excerpt of the original: its data never read — by reference no FILE at all
    ...obje(1, how, { data: CLIP, form: "jpeg", titl: "Zápis úmrtí", kind: "excerpt", clip: "k-1", sha: sha(ORIGINAL) }),
  ]);
  if (step > 0) t = t.replace(/\n0 TRLR/, `\n${obje(0, step === 1 ? "data" : how, { data: RECORD, mime: "image/png", form: "png", type: "document", titl: "Oddací list", name: "oddaci-list.png", record: true }).join("\n")}\n0 TRLR`);
  if (step === 1) t = t.replace(/(1 NAME Eva \/Lhotáková\/[\s\S]*?1 BIRT\n2 DATE )1893/, "$11894");
  if (step === 2) t = t.replace(/(1 NAME Václav \/Lhoták\/[\s\S]*?1 BIRT\n2 DATE )1890/, "$11891");
  return t;
}

const shared = (w: World) => new Settings(w.env, {}).shared()!.value;

/** Every file under a folder (relative path → its hash). */
function files(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(dir, p)] = sha(fs.readFileSync(p));
    }
  };
  walk(dir);
  return out;
}

/**
 * The research as written: its records (times left out; a send's own record without its file's hash and size, the
 * inbox's names of sends), its history op by op (what, of which records, which files — never their hashes, signatures,
 * times), the files the research holds (inputs/).
 */
function written(w: World): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const norm = (text: string) =>
    text
      .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z/g, "<t>")
      .replace(/strom-app-[^"\s]*?\.ged/g, "<send>")
      .replace(/R\d{17}-[0-9a-f]{4}/g, "<R>")
      // the research's commits (each twin its own)
      .replace(/\b[0-9a-f]{40}\b/g, "<commit>")
      .replace(/against [0-9a-f]{7,12}\b/g, "against <commit>");
  const ops: unknown[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".jsonl"))
        for (const line of fs.readFileSync(p, "utf8").split("\n").filter(Boolean)) {
          const op = JSON.parse(line) as { by: string; op: string; summary: string; targets?: string[]; files?: { path: string }[] };
          ops.push({ by: op.by, op: op.op, summary: norm(op.summary), targets: op.targets, files: op.files?.map((f) => f.path) });
        }
      else {
        let text = norm(fs.readFileSync(p, "utf8"));
        // a send's own record (kind tree): its file differs, by design
        if (/"kind": ?"tree"/.test(text)) text = text.replace(/"(sha|size)": ?("[0-9a-f]+"|\d+)/g, '"$1": "<file>"');
        out[path.relative(w.cwd, p)] = text;
      }
    }
  };
  walk(path.join(w.cwd, "data"));
  out.ops = ops;
  out.inputs = files(path.join(w.cwd, "inputs"));
  return out;
}

/** The send through the inbox as the bridge takes it (media=app), its plan shown, then written: what each step says. */
async function through(w: World, text: string): Promise<{ inbox: number; intake: string; plan: unknown; applied: unknown }> {
  const got = receiveTree(w.cwd, w.env, text, { mediaApp: true });
  const plan = (await w.ok(["sync", got.file, "--json"])).json.changes;
  const r = (await w.ok(["sync", got.file, "--apply", "--json"])).json;
  return { inbox: got.changes, intake: got.intake, plan, applied: { changes: r.changes, skipped: r.skipped ?? [] } };
}

test("spec 133 K1.3: the same tree with data and by reference (_STROM_DATA, an excerpt without FILE) — the same plan, inbox count, research written and material files; against a kept send of the other kind too (_STROM_SINCE)", opts, async () => {
  // twin A: data, data, by reference; twin B: data, by reference, data — each send 2 against send 1 of the other kind
  const [a, b] = [await world(), await world()];
  try {
    const plans: unknown[][] = [[], []];
    const intakes: string[][] = [[], []];
    const steps: [How, How][] = [
      ["data", "data"],
      ["data", "ref"],
      ["ref", "data"],
    ];
    for (const [step, [howA, howB]] of steps.entries()) {
      const s = step as 0 | 1 | 2;
      const ta = send(a.given, s, howA, { since: intakes[0]![1] });
      const tb = send(b.given, s, howB, { since: intakes[1]![1] });
      const [ra, rb] = [await through(a.w, ta), await through(b.w, tb)];
      intakes[0]!.push(ra.intake);
      intakes[1]!.push(rb.intake);
      assert.equal(rb.inbox, ra.inbox, `step ${step}: the same count in the inbox`);
      assert.ok(ra.inbox > 0, `step ${step} brings something`);
      assert.deepEqual(rb.plan, ra.plan, `step ${step}: the same plan`);
      assert.deepEqual(rb.applied, ra.applied, `step ${step}: the same written`);
      plans[0]!.push(ra.plan);
      plans[1]!.push(rb.plan);
      assert.deepEqual(written(b.w), written(a.w), `step ${step}: the same research`);
      assert.deepEqual(files(path.join(shared(b.w), "media")), files(path.join(shared(a.w), "media")), `step ${step}: the same material in the shared store`);
    }
    // what was compared counts: the files' new places and the user's edits were written
    const kinds = (plans[0]!.slice(1).flat() as { kind: string }[]).map((c) => c.kind);
    assert.ok(kinds.includes("media.attachment") && kinds.includes("fact.changed"), kinds.join(" "));
    // the sends by reference were what they say: no data of a file the research has, the excerpt without FILE
    const ref = mediaRefsOf(send(b.given, 1, "ref"));
    assert.deepEqual([ref.excerptsWithoutFile, ref.withData, ref.dataRefs], [1, 2, 6]);
    assert.deepEqual(mediaRefsOf(send(b.given, 1, "data")).dataRefs, 0);
  } finally {
    a.w.cleanup();
    b.w.cleanup();
  }
});

test("spec 133 §1.4: the bridge's check — a hash the research has (a working copy, an original, the record of a file) is known, one it lacks is not, an excerpt without FILE never; a file by reference nobody has is said, never a record", opts, async () => {
  const { w, given } = await world();
  try {
    await through(w, send(given, 0, "data"));
    const store = shared(w);
    const unknown = "e".repeat(64);
    const text = send(given, 0, "ref", { known: true }).replace(/_STROM_DATA [0-9a-f]{64}(\n3 FORM png\n3 TITL parte\.png)/, `_STROM_DATA ${unknown}$1`);
    assert.ok(text.includes(unknown));
    // an original the research keeps, sent as it is (no working copy of its own)
    const withOriginal = under(text, "P0002", ["1 OBJE", `2 _STROM_DATA ${sha(ORIGINAL)}`, "2 FORM jpeg", "2 TITL svatba-1915.jpg", `2 _STROM_SHA ${sha(ORIGINAL)}`]);
    let opened = 0;
    const got = checkMediaRefs(withOriginal, {
      tree: () => {
        opened++;
        return Tree.open(w.cwd, w.env);
      },
      store,
    });
    assert.deepEqual(got, { unknown: [unknown], dataRefs: 6, excerptsWithoutFile: 1, withData: 0 });
    assert.equal(opened, 1, "the research opened once, for what the store does not have");
    // all known: nothing unknown, the research never opened
    const none = checkMediaRefs(send(given, 0, "ref", { known: true }), { tree: () => assert.fail("not opened"), store });
    assert.deepEqual(none, { unknown: [], dataRefs: 5, excerptsWithoutFile: 1, withData: 0 });
    // with data: nothing by reference
    assert.deepEqual(checkMediaRefs(send(given, 0, "data"), { store }), { unknown: [], dataRefs: 0, excerptsWithoutFile: 0, withData: 6 });
    // CRLF, a BOM: the same
    assert.deepEqual(checkMediaRefs(`\uFEFF${withOriginal.replace(/\n/g, "\r\n")}`, { tree: () => Tree.open(w.cwd, w.env), store }), got);

    // written by hand all the same (no bridge to refuse it): the file nobody has is said, never a record of nothing
    const file = path.join(w.dir, "odkazem.ged");
    fs.writeFileSync(file, under(text, "P0002", ["1 OBJE", `2 _STROM_DATA ${"f".repeat(64)}`, "2 FORM jpeg", "2 TITL Ztracená fotka.jpg"]));
    const r = (await w.ok(["sync", file, "--apply", "--json"])).json;
    const said = (r.changes as { code?: string; text?: string }[]).filter((c) => c.code === "media.unreadable").map((c) => c.text);
    assert.deepEqual(said.sort(), ["Ztracená fotka.jpg", "parte.png"].sort(), JSON.stringify(r.changes));
    const recs = fs.readdirSync(path.join(w.cwd, "data", "inputs")).map((f) => fs.readFileSync(path.join(w.cwd, "data", "inputs", f), "utf8"));
    assert.ok(!recs.some((x) => x.includes(unknown) || x.includes("f".repeat(64))), "no record of bytes nobody has");
  } finally {
    w.cleanup();
  }
});

const app = { Origin: "https://beta.stromapp.info" };
const liveLog = (w: World) => {
  try {
    return fs.readFileSync(path.join(w.cwd, ".strom", "live.log"), "utf8");
  } catch {
    return "";
  }
};
/** What the bridge kept of sends: their records, the inbox's files, the sends set aside. */
const sendsKept = (w: World) => {
  const dir = path.join(w.cwd, ".strom", "sync");
  const all = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  return { records: all.filter((f) => f.startsWith("received-")).length, inbox: all.filter((f) => f.startsWith("strom-app-")).length, kept: fs.existsSync(path.join(dir, "kept")) ? fs.readdirSync(path.join(dir, "kept")).length : 0 };
};
/** A send to the bridge, written at once: its answer. */
async function sent(url: string, text: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const r = await post(`${url}/sync?media=app`, text, app);
  return { status: r.status, body: JSON.parse(r.body) as Record<string, unknown> };
}

test("spec 133 through the bridge: the same tree by reference writes what it writes with the data (a twin research); /status says sync.mediaRef", opts, async () => {
  const [a, b] = [await world(), await world()];
  const ia = (await a.w.ok(["live", "start", "--json"])).json;
  const ib = (await b.w.ok(["live", "start", "--json"])).json;
  try {
    const st = JSON.parse((await get(`${ib.url}/status`)).body);
    assert.ok(st.features.includes("sync.mediaRef"), "the feature");
    const first = [await sent(ia.url, send(a.given, 0, "data")), await sent(ib.url, send(b.given, 0, "data"))];
    for (const r of first) assert.equal(r.status, 200, JSON.stringify(r.body));
    const ra = await sent(ia.url, send(a.given, 1, "data", { since: first[0]!.body.intake as string }));
    const rb = await sent(ib.url, send(b.given, 1, "ref", { since: first[1]!.body.intake as string }));
    assert.equal(rb.status, 200, JSON.stringify(rb.body));
    assert.equal(ra.status, 200, JSON.stringify(ra.body));
    assert.match(String(rb.body.input), /^I\d+$/);
    assert.equal(rb.body.changes, ra.body.changes);
    assert.deepEqual(written(b.w), written(a.w), "the same research");
    assert.deepEqual(files(path.join(shared(b.w), "media")), files(path.join(shared(a.w), "media")), "the same material in the shared store");
    // the send's line says what it carried of its files, no name in it
    let log = "";
    await until("its line", () => /files by reference 6, excerpts without FILE 1, with data 2/.test((log = liveLog(b.w))));
    assert.match(liveLog(a.w), /files by reference 0, excerpts without FILE 0, with data 9/);
    for (const name of ["Lhot", "Václav", "Eva", "svatba", "parte", "P000"]) assert.ok(!log.includes(name), `${name} in live.log`);
  } finally {
    await a.w.ok(["live", "stop"]);
    await b.w.ok(["live", "stop"]);
    a.w.cleanup();
    b.w.cleanup();
  }
});

test("spec 133 §1.4 through the bridge: a file by reference the research cannot find refuses the whole send (409 sync.media-ref-unknown, shas) — nothing kept, no record; with the data it is written; POST /media/known knows a working copy by its own hash; a file only in the research's inputs/ is read at apply", opts, async () => {
  const { w, given } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const first = await sent(info.url, send(given, 0, "data"));
    assert.equal(first.status, 200, JSON.stringify(first.body));
    // the working copy of the original the research keeps: known by its own hash (the app names it by reference then)
    const k = await post(`${info.url}/media/known`, JSON.stringify({ shas: [sha(WORKING), "d".repeat(64)] }), app);
    assert.equal(k.status, 200, k.body);
    const known = JSON.parse(k.body).known;
    assert.match(known[sha(WORKING)].id, /^I\d+$/, k.body);
    assert.deepEqual({ kind: known[sha(WORKING)].kind, mime: known[sha(WORKING)].mime, bytes: known[sha(WORKING)].bytes, here: known[sha(WORKING)].here }, { kind: "input", mime: "image/jpeg", bytes: WORKING.length, here: true });
    assert.equal(known["d".repeat(64)], null);

    const before = sendsKept(w);
    const unknown = "e".repeat(64);
    const since = { since: first.body.intake as string };
    const refused = await sent(info.url, send(given, 1, "ref", since).replace(/_STROM_DATA [0-9a-f]{64}(\n3 FORM png\n3 TITL parte\.png)/, `_STROM_DATA ${unknown}$1`));
    assert.equal(refused.status, 409, JSON.stringify(refused.body));
    assert.deepEqual({ ok: refused.body.ok, code: refused.body.code, shas: refused.body.shas }, { ok: false, code: "sync.media-ref-unknown", shas: [unknown] });
    assert.equal(typeof refused.body.error, "string");
    assert.deepEqual(sendsKept(w), before, "nothing kept, no record, nothing in the inbox");
    assert.match(liveLog(w), /send refused: sync\.media-ref-unknown \(1 file by reference not here\)/);
    // the app sends it again with the data: written
    const again = await sent(info.url, send(given, 1, "data", since));
    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.match(String(again.body.input), /^I\d+$/);

    // a file the research keeps in its own inputs/ only (not in the shared store), named by reference: read at apply
    const own = path.join(w.dir, "Lhotákovi-dům.png");
    const HOUSE = img("png-rgba.png");
    fs.writeFileSync(own, HOUSE);
    await w.ok(["intake", own]);
    assert.equal(storedBytes(shared(w), sha(HOUSE)), undefined, "not in the shared store");
    const withOwn = under(send(given, 2, "ref", { since: again.body.intake as string }), "P0002", ["1 OBJE", `2 _STROM_DATA ${sha(HOUSE)}`, "2 FORM png", "2 TITL Dům v Lhotě"]);
    const r = await sent(info.url, withOwn);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const inputs = fs.readdirSync(path.join(w.cwd, "data", "inputs")).map((f) => JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "inputs", f), "utf8")) as { id: string; working?: { sha: string }; sha?: string; links?: { ref: string }[] });
    const at = inputs.filter((x) => (x.working?.sha === sha(HOUSE) || x.sha === sha(HOUSE)) && x.links?.some((l) => l.ref === "P0002"));
    assert.equal(at.length, 1, JSON.stringify(inputs));
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});
