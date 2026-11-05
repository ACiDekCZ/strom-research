// What waits for the person, answered and fed from the Strom app (the app's ZADANI_VYZKUM_cekani-na-snimky.md, V1–V4):
// the person's answer through the bridge (POST /waiting/<T…> {"do": "answer"}) — as strom task wake --answer, given in
// the app; scans a task waits for sent with X-Strom-Task (and X-Strom-Image, X-Strom-Replace) — the same way as images
// saved by hand into the task's folder (core/inboxwait.ts): numbered, registered, the task back once all are there;
// a site with one book: its inbox and the action "images"; the sites of one archive in one place (archive:<id>).

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { Tree } from "../../src/core/tree.ts";
import { waitingFor } from "../../src/core/waiting.ts";
import { numbersForTask } from "../../src/core/inboxwait.ts";
import { archiveOfSite } from "../../src/core/waitkind.ts";
import { encodeImage } from "../../src/image/index.ts";
import type { Media, Task } from "../../src/core/model.ts";
import { get, post } from "./sync.helpers.ts";
import { makePdf } from "../image-samples.ts";

const opts = { skip: !hasGit };
const bridged = { skip: !hasGit || process.platform === "win32" };
const app = { Origin: "https://beta.stromapp.info", "Content-Type": "application/json" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const sha = (b: Buffer | Uint8Array) => crypto.createHash("sha256").update(b).digest("hex");
const scan = (w: number, h: number, grey: number) => ({ bytes: encodeImage({ width: w, height: h, channels: 3, data: new Uint8Array(w * h * 3).fill(grey) }, "jpeg", 92), width: w, height: h });

function put(url: string, body: Buffer | Uint8Array, headers: Record<string, string>): Promise<{ status: number; body: string; json: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "PUT", headers: { "Content-Length": String(body.length), "Content-Type": "application/octet-stream", ...headers } }, (res) => {
      let b = "";
      res.on("data", (d) => (b += d));
      res.on("end", () => {
        let json: any;
        try {
          json = JSON.parse(b);
        } catch {
          json = undefined;
        }
        resolve({ status: res.statusCode ?? 0, body: b, json });
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}

/**
 * Images 9–10 of a book (T1); a site with that one book, which images not known (T2); the family (T3); a check of a
 * site (T4).
 */
async function world(): Promise<{ w: World; shared: string }> {
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  await w.ok(["recordset", "add", "Lhota N 1850–1870", "--url", "https://archive.example.org/book/77"]); // B1
  const add = (what: string, where = "B1") => w.ok(["task", "add", what, "--level", "link", "--where", where, "--why", "a", "--done-when", "b", "--about", "P1", "--anyway"]);
  await add("Křest Jana"); // T1
  await add("Oddavky Jana"); // T2
  await add("Vzpomínky na Jana", "matrika Lhota"); // T3
  await add("Ověřit knihu", "matrika Lhota"); // T4
  await w.ok(["task", "wait", "T1", "--images", "B1:9-10", "--on", "snímky 9–10 knihy Lhota"]);
  await w.ok(["task", "wait", "T2", "--kind", "web", "--url", "https://archive.example.org/book/77", "--on", "projít knihu Lhota"]);
  await w.ok(["task", "wait", "T3", "--on", "Vzpomínky rodiny na Jana.", "--kind", "family"]);
  await w.ok(["search", "add", "Kniha", "--method", "web", "--result", "inconclusive", "--task", "T4", "--note", "closed.example.com refused automated access"]);
  await w.ok(["task", "wait", "T4", "--check", "https://closed.example.com/book/1", "--on", "Je kniha vidět?"]);
  return { w, shared: path.join(w.home, "shared") };
}

const task = async (w: World, id: string): Promise<Task> => (await w.ok(["task", "show", id, "--json"])).json.task;
const statusOf = async (url: string) => JSON.parse((await get(`${url}/status`)).body) as { features: string[]; accepts: { media?: { taskImages?: boolean } }; waiting: { id: string; at: string; actions?: string[]; inbox?: Record<string, unknown>; group: { key: string; url?: string } }[] };

test("the numbers of what came for a task: X-Strom-Image, else the name, else the order of those missing when as many came", () => {
  assert.deepEqual(numbersForTask(1, { image: 9, want: [9, 10], missing: [9, 10] }), { numbers: [9], by: "image" });
  // a PDF of two pages from 9: 9 and 10
  assert.deepEqual(numbersForTask(2, { image: 9, want: [9, 10], missing: [9, 10] }), { numbers: [9, 10], by: "image" });
  assert.deepEqual(numbersForTask(2, { image: 10, want: [9, 10], missing: [9, 10] }), { code: "waiting.image-unwanted", want: [9, 10] });
  assert.deepEqual(numbersForTask(1, { name: "snímek 10.jpg", want: [9, 10], missing: [9, 10] }), { numbers: [10], by: "name" });
  // a name in any script, decomposed: no number of those asked — by order only when exactly as many miss
  assert.deepEqual(numbersForTask(1, { name: "Снимок экрана.png".normalize("NFD"), want: [9, 10], missing: [10] }), { numbers: [10], by: "order" });
  assert.deepEqual(numbersForTask(1, { name: "Snímek.png", want: [9, 10], missing: [9, 10] }), { code: "waiting.image-unknown", missing: [9, 10] });
  // a site with a book (which images not known): a number by the header or the name, any
  assert.deepEqual(numbersForTask(1, { name: "kniha-41.jpg", missing: [] }), { numbers: [41], by: "name" });
  assert.deepEqual(numbersForTask(1, { image: 300, missing: [] }), { numbers: [300], by: "image" });
  assert.deepEqual(numbersForTask(1, { name: "obrázek.jpg", missing: [] }), { code: "waiting.image-unknown", missing: [] });
  assert.deepEqual(numbersForTask(1, { name: "Snímek obrazovky 2026-11-04 v 10.15.jpg", missing: [] }), { code: "waiting.image-unknown", missing: [] });
  assert.deepEqual(numbersForTask(1, { name: "IMG_0057.JPG", missing: [] }), { numbers: [57], by: "name" });
  // a date in the name that happens to be a number asked for: not taken for it
  assert.deepEqual(numbersForTask(1, { name: "Snímek 2026-11-10.png", want: [9, 10], missing: [9, 10] }), { code: "waiting.image-unknown", missing: [9, 10] });
});

test("V1: the person's answer from the app — the task back as by strom task wake --answer, given in the app; refused: changed since, a check, empty or too long, no task that waits, no app", bridged, async () => {
  const { w } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const status = await statusOf(info.url);
    assert.ok(status.features.includes("waiting.answer"));
    assert.equal(status.accepts.media?.taskImages, true);
    const item = status.waiting.find((i) => i.id === "T0003")!;
    assert.ok(item.actions?.includes("answer"));
    const answer = (id: string, body: Record<string, unknown>, headers: Record<string, string> = app) => post(`${info.url}/waiting/${id}`, JSON.stringify(body), headers);
    const text = "Babička Lhotáková říkala, že Jan se narodil ve mlýně.".normalize("NFD");
    // the item the app saw is no longer what the task waits for: nothing written
    const changed = await answer("T0003", { do: "answer", text, expect: "2000-01-01T00:00:00.000Z" });
    assert.equal(changed.status, 409, changed.body);
    assert.deepEqual([JSON.parse(changed.body).code, JSON.parse(changed.body).params.id], ["waiting.changed", "T0003"]);
    assert.equal((await task(w, "T3")).state, "waiting");
    // not from a page of the app: refused before anything
    const foreign = await answer("T0003", { do: "answer", text }, { "Content-Type": "application/json" });
    assert.equal(foreign.status, 403, foreign.body);
    const ok = await answer("T0003", { do: "answer", text, expect: item.at });
    assert.equal(ok.status, 200, ok.body);
    assert.deepEqual([JSON.parse(ok.body).task, JSON.parse(ok.body).state], ["T0003", "open"]);
    const t3 = await task(w, "T3");
    assert.equal(t3.state, "open");
    const given = t3.answers!.at(-1)! as { answer: string; givenIn?: string; whole?: string };
    assert.deepEqual([given.answer, given.givenIn, given.whole], [text.normalize("NFC"), "app", undefined]);
    assert.match((await w.ok(["task", "show", "T3"])).out, /in the Strom app/);
    // again: it waits no more
    const twice = await answer("T0003", { do: "answer", text });
    assert.deepEqual([twice.status, JSON.parse(twice.body).code], [404, "waiting.none"]);
    // a check of a site: its answers are the terminal's
    const check = await answer("T0004", { do: "answer", text });
    assert.deepEqual([check.status, JSON.parse(check.body).code, JSON.parse(check.body).params], [409, "waiting.no-answer", { id: "T0004", kind: "check" }]);
    for (const body of [{ do: "answer", text: "   " }, { do: "answer", text: "x".repeat(4001) }, { do: "answer", text: "ok", expect: 5 }, { do: "answer" }]) {
      const bad = await answer("T0002", body);
      assert.deepEqual([bad.status, JSON.parse(bad.body).code], [400, "waiting.bad-body"], JSON.stringify(body).slice(0, 60));
    }
    // a long answer: kept whole beside its first 500 characters
    const long = `${"Ž".repeat(1200)} konec`;
    const longOk = await answer("T0002", { do: "answer", text: long });
    assert.equal(longOk.status, 200, longOk.body);
    const a2 = (await task(w, "T2")).answers!.at(-1)! as { answer: string; whole?: string };
    assert.ok([...a2.answer].length <= 500);
    assert.equal(a2.whole, long);
    assert.match((await w.ok(["brief", "T2"])).out, /in the Strom app/);
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("V2: scans for a task waiting for images of a book — numbered (X-Strom-Image, name, order), registered as saved by hand; the same again only said; another refused unless replaced (the old one withdrawn, kept); a number not asked, a type not an image, a PDF page by page", bridged, async () => {
  const { w, shared } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const send = (b: Buffer | Uint8Array, h: Record<string, string>) => put(`${info.url}/media/${sha(b)}`, b, { ...app, "X-Strom-Task": "T0001", ...h });
    const grey = fs.readFileSync(path.join(fixtures, "grey.jpg"));
    const cmyk = fs.readFileSync(path.join(fixtures, "cmyk.jpg"));
    const png = fs.readFileSync(path.join(fixtures, "png-rgb.png"));
    // no number, a name with none: which of 9–10 is not known
    const unknown = await send(grey, { "X-Strom-Name": encodeURIComponent("Snímek obrazovky.jpg") });
    assert.deepEqual([unknown.status, unknown.json.code, unknown.json.missing, unknown.json.task], [409, "waiting.image-unknown", [9, 10], "T0001"]);
    // a number it does not ask for
    const unwanted = await send(grey, { "X-Strom-Image": "11" });
    assert.deepEqual([unwanted.status, unwanted.json.code, unwanted.json.want], [409, "waiting.image-unwanted", [9, 10]]);
    // bad headers: refused before anything is kept
    for (const h of [{ "X-Strom-Image": "0" }, { "X-Strom-Image": "abc" }, { "X-Strom-Image": "1234567" }, { "X-Strom-Replace": "yes" }] as Record<string, string>[]) {
      const bad = await send(grey, h);
      assert.deepEqual([bad.status, bad.json.code], [400, "media.bad-header"], JSON.stringify(h));
    }
    const noTask = await put(`${info.url}/media/${sha(grey)}`, grey, { ...app, "X-Strom-Image": "9" });
    assert.deepEqual([noTask.status, noTask.json.code], [400, "media.bad-header"]);
    // not an image
    const text = Buffer.from("Lhota, matrika\n");
    const notImage = await send(text, { "X-Strom-Image": "9", "X-Strom-Name": "opis.txt" });
    assert.equal(notImage.status, 415, notImage.body);
    assert.equal((await task(w, "T1")).state, "waiting");

    // 9 by its header: registered, the task waits on for 10
    const nine = await send(grey, { "X-Strom-Image": "9" });
    assert.equal(nine.status, 200, nine.body);
    assert.deepEqual([nine.json.task, nine.json.recordset, nine.json.images, nine.json.by, nine.json.state, nine.json.inbox.missing], ["T0001", "B0001", [9], "image", "waiting", [10]]);
    const t1 = await task(w, "T1");
    assert.equal(t1.state, "waiting");
    assert.equal(t1.files?.length, 1);
    assert.deepEqual([t1.files![0]!.by, t1.files![0]!.asked], ["app", "snímky 9–10 knihy Lhota"]);
    const mediaOf = () => Tree.open(w.cwd, w.env).list<Media>("media");
    assert.equal(mediaOf().filter((m) => !m.retracted).length, 1);
    // the same content again at 9: only said
    const same = await send(grey, { "X-Strom-Image": "9" });
    assert.equal(same.status, 200, same.body);
    assert.deepEqual([same.json.same, same.json.added], [true, []]);
    assert.equal(mediaOf().length, 1);
    // the same file sent as image 10: never vanishes as a copy of 9 — refused, said which it is, nothing taken or left lying
    const nineId = mediaOf()[0]!.id;
    const copy = await send(grey, { "X-Strom-Image": "10" });
    assert.deepEqual([copy.status, copy.json.code, copy.json.image, copy.json.same, copy.json.as, copy.json.sameRecordset, copy.json.sameImage, copy.json.task], [409, "waiting.image-same", 10, nineId, "B0001:9", "B0001", 9, "T0001"], copy.body);
    assert.match(copy.json.error ?? copy.json.text ?? copy.body, new RegExp(`image 10 of B0001: this file is the same as ${nineId} \\(B0001:9\\)`));
    assert.equal(mediaOf().length, 1);
    assert.equal((await task(w, "T1")).state, "waiting");
    const folder = fs.readdirSync(path.join(shared, "inbox")).find((d) => d.startsWith("B0001"));
    assert.deepEqual(folder ? fs.readdirSync(path.join(shared, "inbox", folder)) : [], [], "nothing left in the task's folder");
    // another scan at 9: refused, unless it replaces the one there — withdrawn, never deleted
    const other = await send(png, { "X-Strom-Image": "9" });
    assert.deepEqual([other.status, other.json.code, other.json.image], [409, "waiting.image-exists", 9]);
    const replaced = await send(png, { "X-Strom-Image": "9", "X-Strom-Replace": "1" });
    assert.equal(replaced.status, 200, replaced.body);
    assert.equal(replaced.json.replaced.length, 1, "the M… it replaced");
    assert.match(replaced.json.replaced[0], /^M\d+$/);
    const all = mediaOf();
    assert.equal(all.filter((m) => m.retracted).length, 1, "the old scan withdrawn");
    assert.equal(all.filter((m) => !m.retracted).length, 1);
    assert.equal((await task(w, "T1")).state, "waiting");
    // the last one, named otherwise: by the order of the one missing — the task back in the queue
    const last = await send(cmyk, { "X-Strom-Name": encodeURIComponent("Снимок.jpg".normalize("NFD")) });
    assert.equal(last.status, 200, last.body);
    assert.deepEqual([last.json.images, last.json.by, last.json.state, last.json.woken], [[10], "order", "open", true]);
    assert.equal((await task(w, "T1")).state, "open");
    assert.ok(!fs.existsSync(path.join(shared, "inbox", "B0001")) || fs.readdirSync(path.join(shared, "inbox")).every((d) => !d.startsWith("B0001")), "the emptied folder goes");
    // a task that waits no more: refused
    const gone = await send(scan(120, 160, 90).bytes, { "X-Strom-Image": "9" });
    assert.deepEqual([gone.status, gone.json.code], [409, "waiting.none"]);
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("V2: a PDF of two scans — from X-Strom-Image page by page; without a number onto those missing when as many", bridged, async () => {
  const { w } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const send = (b: Uint8Array, h: Record<string, string>) => put(`${info.url}/media/${sha(b)}`, b, { ...app, "X-Strom-Task": "T0001", ...h });
    const pdf = makePdf([{ jpeg: scan(120, 160, 60) }, { jpeg: scan(160, 120, 160) }]);
    const at10 = await send(pdf, { "X-Strom-Image": "10", "X-Strom-Name": "lhota.pdf" });
    assert.deepEqual([at10.status, at10.json?.code], [409, "waiting.image-unwanted"], at10.body);
    const r = await send(pdf, { "X-Strom-Name": "lhota.pdf" });
    assert.equal(r.status, 200, r.body);
    assert.deepEqual([r.json.images, r.json.by, r.json.state], [[9, 10], "order", "open"]);
    assert.equal((await task(w, "T1")).state, "open");
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("V2 + V3: a site with one book — its inbox and the action images; scans sent do not bring it back (which images not known), the answer does", bridged, async () => {
  const { w } = await world();
  const info = (await w.ok(["live", "start", "--json"])).json;
  try {
    const before = (await statusOf(info.url)).waiting.find((i) => i.id === "T0002")!;
    assert.deepEqual(before.actions, ["answer", "images", "folder", "chat"]);
    assert.equal(before.inbox?.recordset, "B0001");
    assert.equal(before.inbox?.book, "Lhota N 1850–1870");
    assert.equal(before.inbox?.want, undefined, "which images: not known");
    assert.deepEqual(before.inbox?.missing, []);
    assert.equal(before.inbox?.have, 0);
    // images of a book asked by their numbers: the same actions, the want said
    const t1 = (await statusOf(info.url)).waiting.find((i) => i.id === "T0001")!;
    assert.deepEqual([t1.actions, t1.inbox?.want, t1.inbox?.missing, t1.inbox?.have], [["answer", "images", "folder", "chat"], 2, [9, 10], 0]);
    // a family's answer and a check: no images
    const t3 = (await statusOf(info.url)).waiting.find((i) => i.id === "T0003")!;
    assert.ok(!t3.actions?.includes("images"));
    const send = (b: Buffer | Uint8Array, h: Record<string, string>) => put(`${info.url}/media/${sha(b)}`, b, { ...app, "X-Strom-Task": "T0002", ...h });
    const one = await send(fs.readFileSync(path.join(fixtures, "grey.jpg")), { "X-Strom-Name": "kniha-41.jpg" });
    assert.equal(one.status, 200, one.body);
    assert.deepEqual([one.json.images, one.json.state, one.json.woken], [[41], "waiting", false]);
    const two = await send(fs.readFileSync(path.join(fixtures, "cmyk.jpg")), { "X-Strom-Image": "42" });
    assert.equal(two.status, 200, two.body);
    const unnamed = await send(fs.readFileSync(path.join(fixtures, "png-rgb.png")), { "X-Strom-Name": "obrázek.png" });
    assert.deepEqual([unnamed.status, unnamed.json.code], [409, "waiting.image-unknown"]);
    const after = (await statusOf(info.url)).waiting.find((i) => i.id === "T0002")!;
    assert.equal(after.inbox?.have, 2, "the scans handed to it count");
    const t2 = await task(w, "T2");
    assert.equal(t2.state, "waiting");
    assert.equal(t2.files?.length, 2);
    const answered = await post(`${info.url}/waiting/T0002`, JSON.stringify({ do: "answer", text: "Snímky 41 a 42 jsou uložené, zbytek knihy bez zápisu." }), app);
    assert.equal(answered.status, 200, answered.body);
    assert.equal((await task(w, "T2")).state, "open");
    assert.match((await w.ok(["check"])).out, /^ok/);
  } finally {
    await w.ok(["live", "stop"]);
    w.cleanup();
  }
});

test("V4: the sites of one archive in one place (archive:<id>, its address); a repository of the research at either site goes first", opts, async () => {
  assert.deepEqual(archiveOfSite("digi.archives.cz"), { key: "archive:zemsky-archiv-v-opave", name: "Zemský archiv v Opavě" });
  assert.deepEqual(archiveOfSite("digi2.archives.cz")?.key, "archive:zemsky-archiv-v-opave");
  assert.equal(archiveOfSite("archive.example.org"), undefined);
  const w = new World();
  await w.withTree("Lhotákovi");
  await w.ok(["research", "new", "X", "--new-person", "Jan /Lhoták/"]);
  await w.ok(["recordset", "add", "Lhota N 1850–1870", "--url", "https://digi.archives.cz/da/permalink?xid=1"]); // B1
  await w.ok(["recordset", "add", "Lhota O 1850–1870", "--url", "https://digi2.archives.cz/book/2"]); // B2
  const add = (what: string, where: string) => w.ok(["task", "add", what, "--level", "link", "--where", where, "--why", "a", "--done-when", "b", "--about", "P1", "--anyway"]);
  await add("Křest Jana", "B1"); // T1
  await add("Oddavky Jana", "B2"); // T2
  await w.ok(["task", "wait", "T1", "--images", "B1:3-4", "--on", "snímky 3–4"]);
  await w.ok(["task", "wait", "T2", "--kind", "web", "--url", "https://digi2.archives.cz/book/2", "--on", "projít oddavky"]);
  const shared = path.join(w.home, "shared");
  const groups = () => new Map(waitingFor(Tree.open(w.cwd, w.env), { shared }).map((x) => [x.item.id, x.item.group]));
  const g = groups();
  assert.equal(g.get("T0001")?.key, "archive:zemsky-archiv-v-opave");
  assert.equal(g.get("T0002")?.key, "archive:zemsky-archiv-v-opave");
  assert.equal(g.get("T0001")?.kind, "archive");
  assert.match(g.get("T0001")?.url ?? "", /^https:\/\/digi2?\.archives\.cz\/$/);
  // the research's own repository of that archive, at one of its sites: the place of both
  await w.ok(["repo", "add", "Zemský archiv v Opavě", "--url", "https://digi.archives.cz/"]); // R1
  const r = groups();
  assert.equal(r.get("T0001")?.key, "repo:R0001");
  assert.equal(r.get("T0002")?.key, "repo:R0001");
  assert.equal(r.get("T0002")?.url, "https://digi.archives.cz/");
  w.cleanup();
});
