// The files of the Strom app's tree in the family's material (spec 102 M1–M5, the research's answer V1, V10, V11): GET
// /material lists them with their origin, their places (links) and the kind the user said, never a portrait alone, and
// finds a person by a place too; where the research uses a file (uses, GET /material/<I…>/uses); a file with no place
// left is hidden as removed and shown again gets its places back; a person added to a file in the tree is a place at
// them, taken off their place is; the title, kind and date of files edited (POST /material/edit, strom input edit), with
// what they had before to take it back. A file of a batch the app attached is the same record.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { servedWithMedia } from "../../src/core/treemedia.ts";

const opts = { skip: !hasGit || process.platform === "win32" };
const APP = "https://beta.stromapp.info";
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const img = (name: string) => fs.readFileSync(path.join(fixtures, name));
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");
const gitHead = (dir: string) => execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const PORTRAIT = img("s0001.jpg");
const SHARED = img("grey.jpg");
const DEATH = img("png-rgb.png");
const COUPLE = img("base420.jpg");
const COUPLE_MORE = img("base444.jpg");
const PAGE = img("png-pal.png");
const ORIGINAL = img("prog420.jpg");
const WORKING = img("proggrey.jpg");
const FAR = img("s0003.jpg");
const FAR_WORKING = img("restart.jpg");

type Link = { type: string; ref: string; event?: string; retracted?: { reason: string } };
type File = { id: string; sha: string; name: string; title?: string; kind?: string; date?: string; origin?: string; links?: Link[]; persons: string[]; batch?: string; hidden?: { reason?: string; by: string; at: string }; uses: { excerpts: number; sources: string[]; tasks: number }; here: boolean };

function noAgent(w: World): void {
  w.env.PATH = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(path.delimiter);
}

/** Václav Lhoták (P1, died 1960 in Lhota citing S1), Eva Lhotáková (P2), married (F1), their daughter Anna (P3). */
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
  await w.ok(["person", "add", "Anna /Lhotáková/", "--sex", "F", "--born", "1920"]);
  if (state === "archive") await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
  if (state === "waiting") noAgent(w);
  const given = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  return { w, given };
}

function obje(level: number, o: { data: Buffer; mime?: string; form?: string; type?: string; titl: string; name?: string; kind?: string; original?: string }): string[] {
  const l = (n: number, s: string) => `${level + n} ${s}`;
  const url = `data:${o.mime ?? "image/jpeg"};base64,${o.data.toString("base64")}`;
  const parts = url.match(/.{1,180}/gs)!;
  return [
    `${level} OBJE`,
    l(1, `FILE ${parts[0]}`),
    ...parts.slice(1).map((p) => l(2, `CONC ${p}`)),
    l(1, `FORM ${o.form ?? "jpg"}`),
    ...(o.type ? [l(2, `TYPE ${o.type}`)] : []),
    l(1, `TITL ${o.titl}`),
    ...(o.name ? [l(1, `_STROM_NAME ${o.name}`)] : []),
    ...(o.kind ? [l(1, `_STROM_KIND ${o.kind}`)] : []),
    ...(o.original ? [l(1, `_STROM_SHA ${o.original}`)] : []),
  ];
}

const isRecord = (r: string, which: string) => new RegExp(`\\n1 REFN ${which}\\n`).test(`${r}\n`) || r.startsWith(`0 ${which}`);
const splitRecords = (t: string) => t.split(/\n(?=0 )/);
const under = (t: string, which: string, lines: string[]) =>
  splitRecords(t)
    .map((r) => (isRecord(r, which) ? `${r.replace(/\n+$/, "")}\n${lines.join("\n")}` : r))
    .join("\n");

function underFact(t: string, refn: string, tag: string, lines: string[]): string {
  return splitRecords(t)
    .map((r) => {
      if (!isRecord(r, refn)) return r;
      const rows = r.split("\n");
      const at = rows.findIndex((x) => x === `1 ${tag}` || x.startsWith(`1 ${tag} `));
      let end = at + 1;
      while (end < rows.length && !/^[01] /.test(rows[end]!)) end++;
      return [...rows.slice(0, end), ...lines, ...rows.slice(end)].join("\n");
    })
    .join("\n");
}

/** A record's OBJE whose lines say `mark`, taken out of the file — as the app's user removed it. */
function drop(t: string, which: string, mark: string): string {
  return splitRecords(t)
    .map((r) => {
      if (!isRecord(r, which)) return r;
      const rows = r.split("\n");
      for (let i = 0; i < rows.length; i++) {
        const m = /^(\d+) OBJE$/u.exec(rows[i]!);
        if (!m) continue;
        let end = i + 1;
        while (end < rows.length && Number(rows[end]!.split(" ")[0]) > Number(m[1])) end++;
        if (rows.slice(i + 1, end).some((x) => x.endsWith(mark))) return [...rows.slice(0, i), ...rows.slice(end)].join("\n");
      }
      return r;
    })
    .join("\n");
}

const sourceXref = (t: string, id: string) => new RegExp(`0 (@[^@]+@) SOUR\\n(?:[1-9].*\\n)*?1 REFN ${id}\\n`).exec(t)?.[1] ?? assert.fail(`no ${id} in the file`);
const asApp = (t: string) => t.replace(/^0 HEAD\n/u, "0 HEAD\n1 _STROM_APP_TREE T1\n").replace(/^1 SOUR STROM_RESEARCH$/mu, "1 SOUR STROM\n2 VERS 3.31.0");

/** The app's tree's files: a portrait, one file at both partners, an event's, a couple's photo and attachment, a source's page (a document). */
function withFiles(t: string): string {
  let out = asApp(t);
  const s1 = sourceXref(out, "S0001");
  out = under(out, "P0001", [...obje(1, { data: PORTRAIT, titl: "Václav.jpg", kind: "photo" }), ...obje(1, { data: SHARED, titl: "Rodina", name: "rodina.jpg" })]);
  out = under(out, "P0002", obje(1, { data: SHARED, titl: "Rodina", name: "rodina.jpg" }));
  out = underFact(out, "P0001", "DEAT", obje(2, { data: DEATH, mime: "image/png", form: "png", titl: "parte.png" }));
  out = under(out, "@F0001@ FAM", [...obje(1, { data: COUPLE, titl: "svatba.jpg" }), ...obje(1, { data: COUPLE_MORE, titl: "pozvanka.jpg" })]);
  out = under(out, `${s1} SOUR`, obje(1, { data: PAGE, mime: "image/png", form: "png", type: "document", titl: "strana-12.png" }));
  return out;
}

type Got = { status: number; headers: http.IncomingHttpHeaders; body: Buffer; text: string };
function ask(url: string, method = "GET", body?: string, type = "application/json"): Promise<Got> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, method, headers: { Origin: APP, ...(body !== undefined ? { "Content-Type": type } : {}) } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => {
        const all = Buffer.concat(chunks);
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: all, text: all.toString("utf8") });
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}
const json = (g: Got) => JSON.parse(g.text);
const post = (url: string, body: unknown) => ask(url, "POST", typeof body === "string" ? body : JSON.stringify(body));

async function send(url: string, text: string, media = true): Promise<{ changes: number; input?: string }> {
  const res = await ask(`${url}/sync${media ? "?media=app" : ""}`, "POST", text, "text/plain; charset=utf-8");
  assert.equal(res.status, 200, res.text);
  return json(res);
}

/** The tree with its files as the bridge gives the app (media=app), its head kept as given with them. */
async function given(w: World, url: string): Promise<string> {
  const got = await ask(`${url}/tree.ged?media=app`);
  assert.equal(got.status, 200, got.text);
  assert.ok(servedWithMedia(w.cwd, String(got.headers["x-strom-head"])));
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

const list = async (url: string, q = ""): Promise<File[]> => {
  const got = await ask(`${url}/material${q}`);
  assert.equal(got.status, 200, got.text);
  return json(got).files;
};
const fileOf = (files: File[], b: Buffer): File => files.find((f) => f.sha === sha(b)) ?? assert.fail(`no file ${sha(b).slice(0, 8)} in ${JSON.stringify(files.map((f) => f.name))}`);
const places = (f: File) => (f.links ?? []).map((l) => `${l.type}:${l.ref}${l.event ? `:${l.event}` : ""}`).sort();
const block = (t: string, refn: string) => splitRecords(t).find((r) => isRecord(r, refn)) ?? "";

test("spec 102 M1, M2, V10: the app's files in the material with their origin, places and kind — a portrait alone none; a person found by a place; where the research uses a file", opts, async () => {
  const { w, url } = await started();
  try {
    const status = json(await ask(`${url}/status`));
    assert.ok(status.features.includes("material.edit") && status.features.includes("material.uses"), JSON.stringify(status.features));
    const files = await list(url);
    assert.ok(!files.some((f) => f.sha === sha(PORTRAIT)), "a person's portrait alone is not material");
    const shared = fileOf(files, SHARED);
    assert.deepEqual([shared.origin, shared.name, shared.title, places(shared), shared.persons, shared.here, shared.hidden], ["app", "rodina.jpg", "Rodina", ["person:P0001", "person:P0002"], ["P0001", "P0002"], true, undefined]);
    assert.deepEqual(shared.uses, { excerpts: 0, sources: [], tasks: 0 });
    const death = fileOf(files, DEATH);
    assert.equal(places(death).length, 1);
    assert.match(places(death)[0]!, /^event:P0001:E\d{4}$/u);
    assert.deepEqual(death.persons, ["P0001"], "an event's file is of its person");
    assert.deepEqual(places(fileOf(files, COUPLE)), ["familyPhoto:F0001"]);
    assert.deepEqual(places(fileOf(files, COUPLE_MORE)), ["family:F0001"]);
    const page = fileOf(files, PAGE);
    assert.deepEqual([places(page), page.kind], [["source:S0001"], "document"], "the kind as the user said it");
    // ?person= finds a file by its places too
    assert.deepEqual((await list(url, "?person=P0002")).map((f) => f.sha), [sha(SHARED)]);
    assert.deepEqual((await list(url, "?person=P0001")).map((f) => f.sha).sort(), [sha(SHARED), sha(DEATH)].sort());

    // the research uses the page: an image of a book of the same content, an entry cut from it, a task at it
    const scans = path.join(w.dir, "scany");
    fs.mkdirSync(scans);
    fs.writeFileSync(path.join(scans, "001.png"), PAGE);
    await w.ok(["recordset", "add", "Lhota Z 1950-1970", "--kinds", "burial", "--places", "Lhota", "--years", "1950-1970"]);
    await w.ok(["media", "add", scans, "--recordset", "B1"]);
    const entry = (await w.ok(["source", "add", "Pohřeb Václava Lhotáka", "--kind", "burial", "--folio", "fol. 12", "--clip", "B1:1@0.1,0.1,0.5,0.2", "--json"])).json.source.id as string;
    await w.ok(["task", "add", "Přečíst stranu", "--level", "verify", "--where", page.id, "--why", "úmrtí", "--done-when", "přečteno"]);
    const used = fileOf(await list(url), PAGE);
    assert.deepEqual(used.uses, { excerpts: 1, sources: [entry], tasks: 1 });
    const detail = await ask(`${url}/material/${page.id}/uses`);
    assert.equal(detail.status, 200, detail.text);
    const d = json(detail);
    assert.deepEqual(d.excerpts, [{ source: entry, recordset: "B0001", page: "fol. 12", sha: sha(PAGE) }]);
    assert.deepEqual(d.sources, [{ id: entry, title: "Pohřeb Václava Lhotáka" }]);
    assert.equal(d.tasks.length, 1);
    assert.deepEqual([d.tasks[0].title, d.tasks[0].state], ["Přečíst stranu", "open"]);
    assert.deepEqual(json(await ask(`${url}/material/${shared.id}/uses`)), { excerpts: [], sources: [], tasks: [] });
    const none = await ask(`${url}/material/I0999/uses`);
    assert.deepEqual([none.status, json(none).code], [404, "material.file"]);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("spec 108 §10 (8): a file of a batch the app attached (its working copy, _STROM_SHA of the batch's file) is the same record with its place; a file whose original is not here is listed and given by its working copy", opts, async () => {
  const { w, given: g } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  const url = info.url;
  try {
    const batch = "1a2b3c4d-5e6f-7a8b";
    const sent = await new Promise<Got>((resolve, reject) => {
      const req = http.request(`${url}/media/${sha(ORIGINAL)}`, { agent: false, method: "PUT", headers: { Origin: APP, "X-Strom-Name": encodeURIComponent("Lhota.jpg"), "X-Strom-Batch": batch, "X-Strom-Path": encodeURIComponent("Krabice/Lhota.jpg") } }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks), text: Buffer.concat(chunks).toString("utf8") }));
      });
      req.on("error", reject);
      req.end(ORIGINAL);
    });
    assert.equal(sent.status, 200, sent.text);
    const material = json(sent).input as string;
    let text = asApp(fs.readFileSync(g, "utf8"));
    text = under(text, "P0002", obje(1, { data: WORKING, titl: "Lhota.jpg", original: sha(ORIGINAL) }));
    text = under(text, "P0003", obje(1, { data: FAR_WORKING, titl: "Daleko", name: "daleko.jpg", original: sha(FAR) }));
    await send(url, text);
    const files = await list(url);
    const att = files.filter((f) => f.sha === sha(ORIGINAL));
    assert.equal(att.length, 1, "no duplicate");
    assert.equal(att[0]!.id, material, "the batch's record");
    assert.deepEqual([att[0]!.origin, places(att[0]!), att[0]!.batch], ["app", ["person:P0002"], batch]);
    assert.ok(!files.some((f) => f.sha === sha(WORKING)), "its working copy is no file of its own");
    // the original not here: listed, its working copy given in its place
    const far = fileOf(files, FAR);
    assert.deepEqual([far.origin, places(far), far.title, far.here], ["app", ["person:P0003"], "Daleko", true]);
    const got = await ask(`${url}/media/${sha(FAR)}?file=1`);
    assert.equal(got.status, 200, got.text);
    assert.equal(sha(got.body), sha(FAR_WORKING));
    const thumb = await ask(`${url}/media/${sha(FAR)}?thumb=128`);
    assert.deepEqual([thumb.status, thumb.headers["content-type"]], [200, "image/jpeg"]);

    // the research's own material edited at the terminal too: its was, and "" takes a value off
    const cli = (await w.ok(["input", "edit", material, "--title", "Krabice z Lhoty", "--kind", "photo", "--date", "1932", "--json"])).json;
    assert.deepEqual([cli.changed, cli.was], [[material], { [material]: { title: "", kind: "", date: "" } }]);
    const off = (await w.ok(["input", "edit", material, "--date", "", "--json"])).json;
    assert.deepEqual(off.was, { [material]: { date: "1932" } });
    const now = fileOf(await list(url), ORIGINAL);
    assert.deepEqual([now.title, now.kind, now.date], ["Krabice z Lhoty", "photo", undefined]);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

for (const state of ["research", "archive"] as const)
  test(`spec 102 M3 (${state}): a file the app removed from the tree is hidden as removed; shown again its places come back and the app's next file of the tree has it`, opts, async () => {
    const { w, url } = await started(state);
    try {
      const t = await given(w, url);
      await send(url, drop(t, "@F0001@ FAM", "TITL pozvanka.jpg"));
      const gone = fileOf(await list(url), COUPLE_MORE);
      assert.deepEqual([gone.hidden?.reason, gone.hidden?.by, places(gone)], ["removed", "user", []]);
      assert.match(gone.hidden!.at, /^\d{4}-\d\d-\d\dT/u);
      const head = gitHead(w.cwd);
      const back = await post(`${url}/material/hide`, { files: [gone.id], hidden: false });
      assert.equal(back.status, 200, back.text);
      const f = json(back).files[0] as File;
      assert.deepEqual([f.hidden, places(f)], [undefined, ["family:F0001"]]);
      assert.notEqual(gitHead(w.cwd), head, "written and committed");
      const ops = execFileSync("git", ["-C", w.cwd, "show", "--stat", "--format=%s", "HEAD"], { encoding: "utf8" });
      assert.match(ops, /data\/inputs\//u);
      const again = await given(w, url);
      assert.match(block(again, "@F0001@ FAM"), /TITL pozvanka\.jpg/u, "back in the app's tree");
      assert.equal((await send(url, again)).changes, 0, "the round trip changes nothing");
      // shown again once more: nothing to give back, nothing written
      const twice = gitHead(w.cwd);
      assert.equal((await post(`${url}/material/hide`, { files: [gone.id], hidden: false })).status, 200);
      assert.equal(gitHead(w.cwd), twice);
    } finally {
      await w.ok(["live", "stop"]);
    }
    w.cleanup();
  });

test("spec 102 M4, V1: a person added to a file in the tree is a place at them (back as their attachment); taken off, their place is; all taken off, hidden as removed and shown again", opts, async () => {
  const { w, url } = await started();
  try {
    const id = fileOf(await list(url), SHARED).id;
    const added = await post(`${url}/material/assign`, { files: [id], add: ["P0003"] });
    assert.equal(added.status, 200, added.text);
    const f = json(added).files[0] as File;
    assert.deepEqual([places(f), f.persons], [["person:P0001", "person:P0002", "person:P0003"], ["P0001", "P0002", "P0003"]]);
    const rec = (await w.ok(["input", "show", id, "--json"])).json.input;
    assert.equal(rec.persons, undefined, "a place, not the material's people");
    assert.deepEqual([rec.links.at(-1).type, rec.links.at(-1).ref, rec.links.at(-1).input], ["person", "P0003", undefined]);
    let t = await given(w, url);
    assert.match(block(t, "P0003"), /TITL Rodina\n/u, "her attachment in the app's tree");
    // taken off one: that place, as the user removed it
    const off = json(await post(`${url}/material/assign`, { files: [id], remove: ["P0001"] })).files[0] as File;
    assert.deepEqual(places(off), ["person:P0002", "person:P0003"]);
    const taken = (await w.ok(["input", "show", id, "--json"])).json.input.links.find((l: Link) => l.ref === "P0001");
    assert.equal(taken.retracted.reason, "removed");
    t = await given(w, url);
    assert.doesNotMatch(block(t, "P0001"), /TITL Rodina\n/u);
    assert.equal((await send(url, t)).changes, 0);
    // the event's file taken off its person: out of the tree, hidden as removed
    const death = fileOf(await list(url), DEATH);
    const out = json(await post(`${url}/material/assign`, { files: [death.id], remove: ["P0001"] })).files[0] as File;
    assert.deepEqual([places(out), out.hidden?.reason], [[], "removed"]);
    const shown = json(await post(`${url}/material/hide`, { files: [death.id], hidden: false })).files[0] as File;
    assert.equal(places(shown).length, 1);
    assert.match(places(shown)[0]!, /^event:P0001:E\d{4}$/u);
    // a file not in the tree: the material's people, as ever
    const page = fileOf(await list(url), PAGE);
    await send(url, drop(await given(w, url), `${sourceXref(t, "S0001")} SOUR`, "TITL strana-12.png"));
    const assigned = json(await post(`${url}/material/assign`, { files: [page.id], add: ["P0001"] })).files[0] as File;
    assert.deepEqual([places(assigned), assigned.persons, assigned.hidden?.reason], [[], ["P0001"], "removed"]);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

for (const state of ["research", "archive"] as const)
  test(`spec 102 M5, V11 (${state}): titles, kinds and dates edited one and many at once, was to take it back, refusals write nothing; any script`, opts, async () => {
    const { w, url } = await started(state);
    try {
      const files = await list(url);
      const shared = fileOf(files, SHARED).id;
      const page = fileOf(files, PAGE).id;
      const edit = (body: unknown) => post(`${url}/material/edit`, body);
      const many = await edit({ ids: [shared, page], title: "Lhota – rodina", date: "abt 1930" });
      assert.equal(many.status, 200, many.text);
      const got = json(many);
      assert.deepEqual(got.changed, [shared, page]);
      assert.deepEqual(got.was, { [shared]: { title: "Rodina", date: "" }, [page]: { title: "", date: "" } });
      assert.deepEqual(got.files.map((f: File) => [f.title, f.date]), [["Lhota – rodina", "ABT 1930"], ["Lhota – rodina", "ABT 1930"]]);
      assert.match(got.head, /^[0-9a-f]{7,}$/u);
      assert.deepEqual((await w.ok(["input", "show", shared, "--json"])).json.input.titled.by, "user");
      // the app's next file of the tree has it
      const t = await given(w, url);
      assert.match(block(t, "P0002"), /TITL Lhota – rodina\n2 _STROM_NAME rodina\.jpg\n/u);
      assert.match(block(t, "P0002"), /2 _DATE ABT 1930\n/u);
      assert.equal((await send(url, t)).changes, 0);
      // taken back: the same edit with what it had
      for (const [id, was] of Object.entries(got.was)) assert.equal((await edit({ ids: [id], ...(was as object) })).status, 200);
      const back = await list(url);
      assert.deepEqual([fileOf(back, SHARED).title, fileOf(back, SHARED).date, fileOf(back, PAGE).title], ["Rodina", undefined, undefined]);
      // a kind, and "" takes it off (what sorting found shows again)
      assert.equal(json(await edit({ ids: [page], kind: "photo" })).files[0].kind, "photo");
      assert.equal(json(await edit({ ids: [page], kind: "" })).files[0].kind, undefined);
      // any script, decomposed input kept composed; U+FFFD written as it came and said
      const nfd = json(await edit({ ids: [shared], title: "Žofie a Иван u studny".normalize("NFD") }));
      assert.equal(nfd.files[0].title, "Žofie a Иван u studny".normalize("NFC"));
      const odd = json(await edit({ ids: [shared], title: "Lhota � 1930" }));
      assert.deepEqual([odd.files[0].title, odd.warnings], ["Lhota � 1930", [{ code: "material.unreadable", params: { field: "title" } }]]);
      // refused whole, nothing written
      const head = gitHead(w.cwd);
      for (const [body, status, code] of [
        [{ ids: [shared], date: "kdysi dávno" }, 400, "material.date"],
        [{ ids: [shared], kind: "obraz" }, 400, "material.body"],
        [{ ids: [shared], title: "x".repeat(201) }, 400, "material.body"],
        [{ ids: [shared], title: "Lhota \ud800" }, 400, "material.body"],
        [{ ids: [shared] }, 400, "material.body"],
        [{ ids: [], title: "a" }, 400, "material.body"],
        [{ ids: Array.from({ length: 501 }, (_, i) => `I${i + 1}`), title: "a" }, 400, "material.body"],
        [{ ids: [shared, "I0999"], title: "a" }, 404, "material.file"],
      ] as const) {
        const r = await edit(body);
        assert.deepEqual([r.status, json(r).code], [status, code], JSON.stringify(body).slice(0, 80));
      }
      assert.equal(gitHead(w.cwd), head);
      // the same again: nothing written
      assert.deepEqual(json(await edit({ ids: [shared], title: "Lhota � 1930" })).changed, []);
      assert.equal(gitHead(w.cwd), head);
    } finally {
      await w.ok(["live", "stop"]);
    }
    w.cleanup();
  });
