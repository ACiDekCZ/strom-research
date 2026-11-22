// The files of the Strom app's tree given back (spec 108, the research's answer, "Návrat"): GET /tree.ged?images=ref&
// media=app has each record of the material in the tree at each of its places as the app sent it — a portrait and a
// couple's photo first, then the attachments in their order, an event's under its event, a source's under its person
// (2 _SOUR) or at the source; the working copy by its hash (strom-image:), whose bytes POST /images and GET /image give
// (only of records in the tree), else the name and the original's hash. Without media=app the file is as before. The
// return sent back changes nothing; the head given with the files is kept (media-heads.json).

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { servedWithMedia } from "../../src/core/treemedia.ts";

const opts = { skip: !hasGit || process.platform === "win32", timeout: 240_000 };
const APP = "https://beta.stromapp.info";
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const img = (name: string) => fs.readFileSync(path.join(fixtures, name));
const sha = (b: Uint8Array) => crypto.createHash("sha256").update(b).digest("hex");

const PORTRAIT = img("s0001.jpg");
const ORIGINAL = img("s0002.jpg");
const WORKING = img("grey.jpg");
const DEATH = img("png-rgb.png");
const ENTRY = img("png-grey.png");
const COUPLE = img("base420.jpg");
const COUPLE_MORE = img("base444.jpg");
const PAGE = img("png-pal.png");
const LETTER_SHA = "c".repeat(64);

type Got = { status: number; headers: http.IncomingHttpHeaders; body: Buffer; text: string };
function ask(url: string, headers: Record<string, string> = {}, method = "GET", body?: string): Promise<Got> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { agent: false, method, headers: { Origin: APP, ...headers } }, (res) => {
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

/** Václav Lhoták (P1, died 1960 in Lhota citing S1) and Eva Lhotáková (P2), married in Lhota (F1); the file the app was given. */
async function world(): Promise<{ w: World; given: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["lang", "cs"]);
  await w.ok(["person", "add", "Václav /Lhoták/", "--sex", "M", "--born", "1890"]); // P1
  await w.ok(["person", "add", "Eva /Lhotáková/", "--sex", "F", "--born", "1893"]); // P2
  await w.ok(["family", "add", "--partner", "P1", "--partner", "P2"]); // F1
  await w.ok(["event", "add", "F1", "MARR", "--date", "1915", "--place", "Lhota"]);
  await w.ok(["source", "add", "Matrika zemřelých Lhota", "--kind", "burial"]); // S1
  await w.ok(["event", "add", "P1", "DEAT", "--date", "1960", "--place", "Lhota", "--cite", "S0001"]);
  const given = path.join(w.dir, "given.ged");
  await w.ok(["export", "gedcom", "--for", "strom", "--images-for", "none", "--out", given]);
  return { w, given };
}

/** A file's lines as the app writes them: its data URL in pieces (CONC), its fields under it. */
function obje(level: number, o: { data?: Buffer; mime?: string; file?: string; sha?: string; name?: string; titl?: string; form?: string; type?: string; date?: string; note?: string; kind?: string; sour?: string; orient?: number }): string[] {
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
  if (o.sour) out.push(l(1, `_SOUR ${o.sour}`));
  return out;
}

const isRecord = (r: string, which: string) => new RegExp(`\\n1 REFN ${which}\\n`).test(`${r}\n`) || r.startsWith(`0 ${which}`);
const records = (t: string) => t.split(/\n(?=0 )/u);
function under(t: string, which: string, lines: string[]): string {
  return records(t)
    .map((r) => (isRecord(r, which) ? `${r.replace(/\n+$/, "")}\n${lines.join("\n")}` : r))
    .join("\n");
}
function underFact(t: string, refn: string, tag: string, lines: string[]): string {
  return records(t)
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
const sourceXref = (t: string, id: string) => new RegExp(`0 (@[^@]+@) SOUR\\n(?:[1-9].*\\n)*?1 REFN ${id}\\n`).exec(t)?.[1] ?? assert.fail(`no ${id} in the file`);
/** The file as the app sends it (its header). */
const fromApp = (t: string) => t.replace(/^1 SOUR STROM_RESEARCH$/m, "1 SOUR STROM\n2 VERS 3.31.0");

/** Every kind of place a file has: a portrait, attachments (with an original, the original alone, of a source), an event's, a couple's, a source's. */
function withFiles(t: string): string {
  let out = fromApp(t);
  const s1 = sourceXref(out, "S0001");
  out = under(out, "P0001", [
    ...obje(1, { data: PORTRAIT, form: "jpg", titl: "Václav.jpg", kind: "photo" }),
    ...obje(1, { data: WORKING, form: "jpg", type: "photo", titl: "Svatba v Lhotě", name: "svatba-1915.jpg", sha: sha(ORIGINAL), date: "1915", note: "Na schodech kostela", orient: 6 }),
    ...obje(1, { file: "dopis.pdf", form: "pdf", type: "document", sha: LETTER_SHA }),
    ...obje(1, { data: ENTRY, mime: "image/png", form: "png", titl: "zapis.png", sour: s1 }),
  ]);
  out = underFact(out, "P0001", "DEAT", obje(2, { data: DEATH, mime: "image/png", form: "png", titl: "parte.png" }));
  out = under(out, "@F0001@ FAM", [...obje(1, { data: COUPLE, form: "jpg", titl: "svatba.jpg" }), ...obje(1, { data: COUPLE_MORE, form: "jpg", titl: "pozvanka.jpg" })]);
  out = under(out, `${s1} SOUR`, obje(1, { data: PAGE, mime: "image/png", form: "png", titl: "strana-12.png" }));
  return out;
}

/** The original the app sends first (PUT /media, as the bridge takes it): material of Václav. */
async function original(w: World): Promise<void> {
  const f = path.join(w.dir, "prijato.jpg");
  fs.writeFileSync(f, ORIGINAL);
  await w.ok(["media", "original", f, "--sha", sha(ORIGINAL), "--name", "svatba-1915.jpg", "--person", "P0001", "--json"]);
}

/** The OBJE blocks of a record (level 1) or of its fact (level 2 under the first line of that tag), as lines. */
function objes(t: string, which: string, fact?: string): string[][] {
  const r = records(t).find((x) => isRecord(x, which)) ?? assert.fail(`no ${which}`);
  let rows = r.split("\n");
  let level = 1;
  if (fact) {
    const at = rows.findIndex((x) => x === `1 ${fact}` || x.startsWith(`1 ${fact} `));
    let end = at + 1;
    while (end < rows.length && !/^[01] /.test(rows[end]!)) end++;
    rows = rows.slice(at + 1, end);
    level = 2;
  }
  const out: string[][] = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] !== `${level} OBJE`) continue;
    const block: string[] = [];
    for (let j = i + 1; j < rows.length && Number(rows[j]!.split(" ")[0]) > level; j++) block.push(rows[j]!.replace(/^\d+ /u, (m) => `${Number(m.trim()) - level} `));
    out.push(block);
  }
  return out;
}
const field = (block: string[], tag: string) => block.find((l) => l.startsWith(`1 ${tag} `) || l === `1 ${tag}`)?.slice(`1 ${tag} `.length);
const refOf = (block: string[]) => /^strom-image:([0-9a-f]{64})$/u.exec(field(block, "FILE") ?? "")?.[1];

/** The return as the app sends it back: each strom-image: replaced by the bytes /images gave (a data URL). */
function withBytes(t: string, bytes: Map<string, { mime: string; data: string }>): string {
  const rows = t.split("\n");
  const out: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const m = /^(\d+) FILE strom-image:([0-9a-f]{64})$/u.exec(rows[i]!);
    if (!m) {
      out.push(rows[i]!);
      continue;
    }
    const level = Number(m[1]);
    const got = bytes.get(m[2]!) ?? assert.fail(`no bytes of ${m[2]}`);
    const parts = `data:${got.mime};base64,${got.data}`.match(/.{1,180}/gs)!;
    out.push(`${level} FILE ${parts[0]}`, ...parts.slice(1).map((p) => `${level + 1} CONC ${p}`));
    while (i + 1 < rows.length && new RegExp(`^${level + 1} _(MIME|WIDTH|HEIGHT|BYTES) `, "u").test(rows[i + 1]!)) i++;
  }
  return out.join("\n");
}

test("spec 108: the return with media=app has the files of the app's tree at their places in order, by their hash — /images gives the same bytes, only of records in the tree; sent back it changes nothing; without media=app the file is as before; the head given with the files is kept", opts, async () => {
  const { w, given } = await world();
  await original(w);
  const file = path.join(w.dir, "app.ged");
  fs.writeFileSync(file, withFiles(fs.readFileSync(given, "utf8")));
  await w.ok(["sync", file, "--apply", "--json"]);
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  try {
    // without media=app: as before — no file of the app's tree, no head kept
    const plain = await ask(`${info.url}/tree.ged?images=ref`);
    assert.equal(plain.status, 200);
    assert.doesNotMatch(plain.text, /^\d+ OBJE/mu, "no OBJE of the app's tree without media=app");
    assert.equal(servedWithMedia(w.cwd, String(plain.headers["x-strom-head"])), false, "no head kept without media=app");

    const got = await ask(`${info.url}/tree.ged?images=ref&media=app`);
    assert.equal(got.status, 200, got.text);
    const t = got.text;
    const h = String(got.headers["x-strom-head"]);
    assert.ok(servedWithMedia(w.cwd, h), "the head given with the files kept");
    assert.notEqual(got.headers.etag, plain.headers.etag, "a variant of its own");
    assert.equal((await ask(`${info.url}/tree.ged?images=ref`, { "If-None-Match": String(got.headers.etag) })).status, 200, "the file without the files is not the one with them");
    assert.equal((await ask(`${info.url}/tree.ged?images=ref&media=app`, { "If-None-Match": String(got.headers.etag) })).status, 304);

    // Václav: the portrait first, then the attachments in the order the app gave them
    const p1 = objes(t, "P0001");
    assert.deepEqual(p1.map(refOf), [sha(PORTRAIT), sha(WORKING), undefined, sha(ENTRY)], t);
    assert.equal(field(p1[0]!, "_STROM_KIND"), "photo");
    assert.deepEqual(p1[0]!.filter((l) => /^2 _(MIME|BYTES) /u.test(l)), ["2 _MIME image/jpeg", `2 _BYTES ${PORTRAIT.length}`]);
    assert.ok(p1[0]!.some((l) => /^2 _WIDTH [1-9]/u.test(l)) && p1[0]!.some((l) => /^2 _HEIGHT [1-9]/u.test(l)), p1[0]!.join("\n"));
    assert.equal(field(p1[0]!, "TITL"), "Václav.jpg");
    // the attachment whose original the research keeps: its working copy, the original's hash, the user's fields
    const svatba = p1[1]!;
    assert.deepEqual([field(svatba, "TITL"), field(svatba, "_STROM_NAME"), field(svatba, "_STROM_SHA"), field(svatba, "_DATE"), field(svatba, "NOTE"), field(svatba, "_STROM_ORIENT"), field(svatba, "FORM")], ["Svatba v Lhotě", "svatba-1915.jpg", sha(ORIGINAL), "1915", "Na schodech kostela", "6", "jpeg"]);
    assert.ok(svatba.includes("2 TYPE photo"), svatba.join("\n"));
    // the original alone: its name and hash
    assert.deepEqual([field(p1[2]!, "FILE"), field(p1[2]!, "_STROM_SHA"), field(p1[2]!, "FORM")], ["dopis.pdf", LETTER_SHA, "pdf"]);
    assert.ok(p1[2]!.includes("2 TYPE document"));
    // of a source too: 2 _SOUR under the person's
    assert.equal(field(p1[3]!, "_SOUR"), "@S0001@");
    // the death's under its event
    assert.deepEqual(objes(t, "P0001", "DEAT").map(refOf), [sha(DEATH)]);
    assert.equal(field(objes(t, "P0001", "DEAT")[0]!, "FORM"), "png");
    // the couple's photo first, then its attachment
    const f1 = objes(t, "@F0001@ FAM");
    assert.deepEqual(f1.map(refOf), [sha(COUPLE), sha(COUPLE_MORE)]);
    assert.equal(field(f1[0]!, "_PRIM"), "Y");
    assert.equal(field(f1[0]!, "_STROM_KIND"), undefined, "a couple's photo has no kind of its own");
    // the source's own (no person): at the source
    assert.deepEqual(objes(t, "@S0001@ SOUR").map(refOf), [sha(PAGE)]);
    assert.equal(objes(t, "P0002").length, 0);

    // the bytes: the same as came, of the right type
    const refs = [...t.matchAll(/strom-image:([0-9a-f]{64})/gu)].map((m) => m[1]!);
    const answer = JSON.parse((await ask(`${info.url}/images`, { "Content-Type": "application/json" }, "POST", JSON.stringify({ images: [...new Set(refs)] }))).text) as { images: { sha: string; mime: string; data: string }[]; missing: string[] };
    assert.deepEqual(answer.missing, []);
    for (const i of answer.images) assert.equal(sha(Buffer.from(i.data, "base64")), i.sha);
    assert.equal(answer.images.find((i) => i.sha === sha(DEATH))!.mime, "image/png");
    assert.equal(answer.images.find((i) => i.sha === sha(PORTRAIT))!.mime, "image/jpeg");
    const one = await ask(`${info.url}/image/${sha(DEATH)}`);
    assert.equal(one.status, 200);
    assert.equal(one.headers["content-type"], "image/png");
    assert.equal(sha(one.body), sha(DEATH));
    // never another file of the shared store: the original (not what the app is given) is not here
    const other = JSON.parse((await ask(`${info.url}/images`, { "Content-Type": "application/json" }, "POST", JSON.stringify({ images: [sha(ORIGINAL)] }))).text) as { images: unknown[]; missing: string[] };
    assert.deepEqual([other.images.length, other.missing], [0, [sha(ORIGINAL)]]);
    assert.equal((await ask(`${info.url}/image/${sha(ORIGINAL)}`)).status, 404);

    // sent back as the app sends it (the bytes in it): nothing changes
    const back = path.join(w.dir, "back.ged");
    fs.writeFileSync(back, fromApp(withBytes(t, new Map(answer.images.map((i) => [i.sha, { mime: i.mime, data: i.data }])))));
    const again = (await w.ok(["sync", back, "--json"])).json as { changes: { kind: string }[] };
    assert.deepEqual(again.changes, [], JSON.stringify(again.changes));

    // media=app without images=ref: the bytes in the file
    const inline = await ask(`${info.url}/tree.ged?media=app`);
    assert.match(inline.text, /^2 FILE data:image\/jpeg;base64,/mu);
    assert.doesNotMatch(inline.text, /strom-image:/u);
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});

test("spec 108: output/tree-strom.ged carries the files of the app's tree in it (data URLs) within the images' limit, beyond it by name and hash and said; output/tree.ged has none", opts, async () => {
  const { w, given } = await world();
  await original(w);
  const file = path.join(w.dir, "app.ged");
  fs.writeFileSync(file, withFiles(fs.readFileSync(given, "utf8")));
  await w.ok(["sync", file, "--apply", "--json"]);
  const r = (await w.ok(["export", "gedcom", "--for", "both", "--json"])).json;
  const strom = fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  const p1 = objes(strom, "P0001");
  assert.equal(p1.length, 4, strom);
  assert.match(field(p1[0]!, "FILE") ?? "", /^data:image\/jpeg;base64,/u);
  assert.equal(field(p1[0]!, "_STROM_KIND"), "photo");
  assert.match(field(objes(strom, "P0001", "DEAT")[0]!, "FILE") ?? "", /^data:image\/png;base64,/u);
  assert.doesNotMatch(strom, /strom-image:/u);
  const standard = fs.readFileSync(path.join(w.cwd, "output", "tree.ged"), "utf8");
  assert.doesNotMatch(standard, /_STROM_SHA|data:image/u, "the file for any program as before");
  assert.ok(r);
  // a limit too small: by name and hash, said
  const small = await w.ok(["export", "gedcom", "--for", "strom", "--images-max-mb", "0.001"]);
  assert.match(small.out, /POZOR: \d+ soubor(y|ů)? stromu aplikace jen názvem|WARNING \d+ files? of the app's tree by name only/u, small.out);
  const cut = fs.readFileSync(path.join(w.cwd, "output", "tree-strom.ged"), "utf8");
  const first = objes(cut, "P0001")[0]!;
  assert.deepEqual([field(first, "FILE"), field(first, "_STROM_SHA")], ["Václav.jpg", sha(PORTRAIT)]);
  w.cleanup();
});

test("spec 108: a package carries every record's original and working copy; unpacked elsewhere the records and places are there, and the return gives the photos back", opts, async () => {
  const { w, given } = await world();
  await original(w);
  const file = path.join(w.dir, "app.ged");
  fs.writeFileSync(file, withFiles(fs.readFileSync(given, "utf8")));
  await w.ok(["sync", file, "--apply", "--json"]);
  const zip = path.join(w.dir, "balík.zip");
  const packed = (await w.ok(["pack", "--out", zip, "--json"])).json;
  assert.deepEqual(packed.manifest?.missing ?? [], []);
  const inputs = () => fs.readdirSync(path.join(w.cwd, "data", "inputs")).filter((f) => f.endsWith(".json")).sort();

  // another computer: its own shared store
  const there = new World();
  await there.ok(["setup", "--yes"]);
  await there.ok(["unpack", zip], { answers: ["a"] });
  there.cwd = there.treeDir("Lhotákovi");
  assert.deepEqual(fs.readdirSync(path.join(there.cwd, "data", "inputs")).filter((f) => f.endsWith(".json")).sort(), inputs());
  const sharedThere = path.join(there.home, "shared");
  const has = (h: string) => {
    const dir = path.join(sharedThere, "media", h.slice(0, 2), h.slice(2, 4));
    return fs.existsSync(dir) && fs.readdirSync(dir).some((n) => n.startsWith(`${h}.`));
  };
  for (const h of [ORIGINAL, WORKING, PORTRAIT, DEATH, ENTRY, COUPLE, COUPLE_MORE, PAGE].map(sha)) assert.ok(has(h), `${h} in the package`);
  const info = (await there.ok(["live", "start", "--json"])).json as { url: string };
  try {
    const t = (await ask(`${info.url}/tree.ged?images=ref&media=app`)).text;
    assert.deepEqual(objes(t, "P0001").map(refOf), [sha(PORTRAIT), sha(WORKING), undefined, sha(ENTRY)], t);
    assert.deepEqual(objes(t, "@F0001@ FAM").map(refOf), [sha(COUPLE), sha(COUPLE_MORE)]);
    const answer = JSON.parse((await ask(`${info.url}/images`, { "Content-Type": "application/json" }, "POST", JSON.stringify({ images: [sha(WORKING), sha(PAGE)] }))).text) as { images: { sha: string }[]; missing: string[] };
    assert.deepEqual([answer.images.map((i) => i.sha), answer.missing], [[sha(WORKING), sha(PAGE)], []]);
  } finally {
    await there.ok(["live", "stop"]);
  }
  there.cleanup();
  w.cleanup();
});

for (const mode of ["research", "archive"] as const)
  test(`spec 108 V9 (${mode}): a couple's original (PUT /media, X-Strom-Family) is material of both partners with an intake task, beside X-Strom-Person too; a bad or unknown couple refused; the bridge says media.app, material.links and accepts.media.family`, opts, async () => {
    const { w } = await world();
    await w.ok(["config", "set", "intake.auto", "on", "--for-tree"], { tty: true }); // the person's switch: files get their tasks
    if (mode === "archive") await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P3
    const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
    try {
      const status = JSON.parse((await ask(`${info.url}/status`)).text) as { features: string[]; accepts: { media: { family?: boolean } } };
      assert.ok(status.features.includes("media.app") && status.features.includes("material.links"), JSON.stringify(status.features));
      assert.equal(status.accepts.media.family, true);
      const pre = await ask(`${info.url}/media/${"a".repeat(64)}`, { "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "x-strom-name,x-strom-family" }, "OPTIONS");
      assert.match(String(pre.headers["access-control-allow-headers"]), /x-strom-family/iu);
      const put = (b: Buffer, h: Record<string, string>) =>
        new Promise<Got>((resolve, reject) => {
          const req = http.request(`${info.url}/media/${sha(b)}`, { agent: false, method: "PUT", headers: { Origin: APP, "Content-Type": "application/octet-stream", "Content-Length": String(b.length), ...h } }, (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (d: Buffer) => chunks.push(d));
            res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks), text: Buffer.concat(chunks).toString("utf8") }));
          });
          req.on("error", reject);
          req.end(b);
        });
      const coded = (r: Got) => [r.status, JSON.parse(r.text).code, JSON.parse(r.text).params];
      assert.deepEqual(coded(await put(COUPLE, { "X-Strom-Family": "Lhotákovi" })), [400, "media.bad-header", { header: "X-Strom-Family" }]);
      assert.deepEqual(coded(await put(COUPLE, { "X-Strom-Family": "F0099" })), [404, "media.no-family", { family: "F0099" }]);
      const one = await put(COUPLE, { "X-Strom-Name": encodeURIComponent("svatba Lhotákových.jpg"), "X-Strom-Family": "F0001" });
      assert.equal(one.status, 200, one.text);
      const got = JSON.parse(one.text) as { input: string; task: string };
      const input = (await w.ok(["input", "show", got.input, "--json"])).json.input as { persons: string[]; families: string[] };
      assert.deepEqual([input.persons, input.families], [["P0001", "P0002"], ["F0001"]]);
      const task = (await w.ok(["task", "show", got.task, "--json"])).json.task as { level: string; state: string; subject: string[] };
      assert.deepEqual([task.level, task.state], ["intake", mode === "archive" ? "parked" : "open"]);
      assert.ok(task.subject.includes("P0001") && task.subject.includes("P0002"));
      // beside a person; the same file said of again with a couple it has: nothing new
      const two = await put(COUPLE_MORE, { "X-Strom-Family": "F0001", "X-Strom-Person": "P0003" });
      assert.equal(two.status, 200, two.text);
      const second = (await w.ok(["input", "show", JSON.parse(two.text).input, "--json"])).json.input as { persons: string[]; families: string[] };
      assert.deepEqual([second.persons.sort(), second.families], [["P0001", "P0002", "P0003"], ["F0001"]]);
      assert.equal(JSON.parse((await put(COUPLE, { "X-Strom-Family": "F0001" })).text).known, got.input);
    } finally {
      await w.ok(["live", "stop"]);
    }
    w.cleanup();
  });

test("spec 108 N1, spec 102 M4: the research's own files (strom intake, held in git under inputs/) the app made a portrait and a couple's photo of (the same bytes) come back by their hash and their bytes are given; they keep no origin and stay in the family's material — one a send marked before too", opts, async () => {
  const { w, given } = await world();
  const a = path.join(w.dir, "portrét Lhotáka.png");
  const b = path.join(w.dir, "svatba.png");
  fs.writeFileSync(a, DEATH);
  fs.writeFileSync(b, ENTRY);
  await w.ok(["intake", a, b]);
  const own = ((await w.ok(["input", "list", "--json"])).json.inputs as { id: string }[]).map((i) => i.id);
  const recs = () => own.map((id) => JSON.parse(fs.readFileSync(path.join(w.cwd, "data", "inputs", `${id}.json`), "utf8")) as { id: string; file: string; origin?: string; links?: { type: string }[] });
  assert.deepEqual(recs().map((r) => r.file.startsWith("inputs/")), [true, true], "held in git");
  let t = fromApp(fs.readFileSync(given, "utf8"));
  t = under(t, "P0001", obje(1, { data: DEATH, mime: "image/png", form: "png", titl: "portrét Lhotáka.png", kind: "photo" }));
  t = under(t, "@F0001@ FAM", obje(1, { data: ENTRY, mime: "image/png", form: "png", titl: "svatba.png" }));
  const file = path.join(w.dir, "app.ged");
  fs.writeFileSync(file, t);
  await w.ok(["sync", file, "--apply", "--json"]);
  assert.equal(((await w.ok(["input", "list", "--json"])).json.inputs as unknown[]).length, own.length + 1, "the same records (and the sync's own)");
  assert.deepEqual(recs().map((r) => [r.origin, r.links?.map((l) => l.type)]), [[undefined, ["personPortrait"]], [undefined, ["familyPhoto"]]]);
  const info = (await w.ok(["live", "start", "--json"])).json as { url: string };
  try {
    const back = (await ask(`${info.url}/tree.ged?images=ref&media=app`)).text;
    assert.deepEqual(objes(back, "P0001").map(refOf), [sha(DEATH)], back);
    assert.deepEqual(objes(back, "@F0001@ FAM").map(refOf), [sha(ENTRY)], back);
    const one = await ask(`${info.url}/image/${sha(DEATH)}`);
    assert.deepEqual([one.status, one.headers["content-type"], sha(one.body)], [200, "image/png", sha(DEATH)]);
    const both = JSON.parse((await ask(`${info.url}/images`, { "Content-Type": "application/json" }, "POST", JSON.stringify({ images: [sha(DEATH), sha(ENTRY)] }))).text) as { images: { sha: string; data: string }[]; missing: string[] };
    assert.deepEqual([both.images.map((i) => sha(Buffer.from(i.data, "base64"))), both.missing], [[sha(DEATH), sha(ENTRY)], []]);
    const listed = async () => (JSON.parse((await ask(`${info.url}/material`)).text) as { files: { id: string; origin?: string; hidden?: unknown }[] }).files.filter((f) => own.includes(f.id));
    assert.deepEqual((await listed()).map((f) => [f.id, f.origin, f.hidden]), own.map((id) => [id, undefined, undefined]));
    // a send of an older strom marked the research's file as a portrait: read as the research's still
    const at = path.join(w.cwd, "data", "inputs", `${own[0]}.json`);
    fs.writeFileSync(at, JSON.stringify({ ...JSON.parse(fs.readFileSync(at, "utf8")), origin: "portrait" }, null, 1));
    assert.deepEqual((await listed()).map((f) => [f.id, f.origin, f.hidden]), own.map((id) => [id, undefined, undefined]));
  } finally {
    await w.ok(["live", "stop"]);
  }
  w.cleanup();
});
