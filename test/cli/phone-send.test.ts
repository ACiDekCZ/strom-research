// Photos from a paired phone with real processes (the phone's server on the loopback alone — STROM_PHONE_TEST): each
// one received as the bridge receives the app's into a batch marked as the phone's, handed over with a note and a person
// as the user's, the same as "Add materials"; an upload cut short leaves nothing and is taken once when sent again; a
// batch nobody handed over closed an hour after its last photo by the phone's server alone, a photo sent into it after
// going on in the batch that took over from it; the parts of uploads cut short cleared.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { World, hasGit, until } from "../helpers.ts";
import { decodeQr, svgModules } from "../qr-decode.ts";
import { waysHere } from "../../src/core/readable.ts";

const APP = { Origin: "https://stromapp.info", "Content-Type": "text/plain;charset=UTF-8" };
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "images");
const read = (f: string) => fs.readFileSync(path.join(fixtures, f));
const sha = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

function request(method: string, url: string, body?: Buffer | string, headers: Record<string, string> = {}): Promise<{ status: number; body: Record<string, any> }> {
  return new Promise((resolve, reject) => {
    const data = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    const req = http.request(url, { method, agent: false, headers: { ...(data ? { "Content-Length": String(data.length) } : {}), ...headers } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => {
        let parsed: Record<string, any> = {};
        try {
          parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          // no JSON
        }
        resolve({ status: res.statusCode ?? 0, body: parsed });
      });
    });
    req.on("error", reject);
    req.end(data);
  });
}

/** Half a photo sent, then the connection gone (the Wi-Fi lost mid-upload). */
function cutShort(url: string, photo: Buffer, headers: Record<string, string>): Promise<void> {
  return new Promise((resolve) => {
    const req = http.request(url, { method: "PUT", agent: false, headers: { "Content-Length": String(photo.length), ...headers } });
    req.on("error", () => resolve());
    req.on("close", () => resolve());
    req.write(photo.subarray(0, Math.floor(photo.length / 2)), () => setTimeout(() => req.destroy(), 200));
  });
}

const skip = !hasGit || process.platform === "win32";

test("photos from a phone: a batch of the phone's as from \"Add materials\", the note and the person the user's; cut short nothing, sent again once; an hour without a photo closes it without the bridge, a late photo goes on in the next", { skip }, async () => {
  const w = new World();
  try {
    await w.withTree("Dvořákovi");
    await w.ok(["lang", "cs"]);
    await w.ok(["person", "add", "Anežka /Dvořáková/", "--sex", "F"]); // P0001
    // the part of an upload cut short a day ago: cleared when the phone's server starts
    const incoming = path.join(w.home, "shared", "media", ".incoming");
    fs.mkdirSync(incoming, { recursive: true });
    const stale = path.join(incoming, `${"a".repeat(64)}-0badf00d.part`);
    fs.writeFileSync(stale, "half a photo");
    const day = new Date(Date.now() - 25 * 3600_000);
    fs.utimesSync(stale, day, day);

    const env = { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "200", STROM_BATCH_CHECK_MS: "200", STROM_LIVE_POLL_MS: "100" };
    const bridge = (await w.ok(["live", "start", "--json"], { env })).json as { url: string };
    assert.equal((await request("POST", `${bridge.url}/phone/on`, JSON.stringify({ lang: "cs" }), APP)).status, 200);
    let address = "";
    await until("the phone's server", async () => {
      const r = await request("GET", `${bridge.url}/phone`);
      address = r.body.addresses?.[0]?.url ?? "";
      return !!address;
    }, { ms: 20_000 });
    const port = new URL(address).port;

    // not paired: nothing of the research
    const unpaired = await request("GET", `${address}/phone/state`);
    assert.deepEqual([unpaired.status, unpaired.body.code], [401, "phone.unpaired"]);
    // paired by the bridge's QR code
    const code = decodeQr(svgModules(await (await fetch(`${bridge.url}/phone/qr.svg`)).text())).text.split("#")[1]!;
    const paired = await fetch(`${address}/pair`, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8", Origin: address }, body: JSON.stringify({ code }) });
    assert.equal(paired.status, 200);
    const cookie = paired.headers.get("set-cookie")!.split(";")[0]!;
    const me = { Cookie: cookie };
    assert.equal(cookie.split("=")[0], `strom_phone_${port}`);

    // the trees, what this computer converts; never a path
    const state = await request("GET", `${address}/phone/state`, undefined, me);
    assert.equal(state.status, 200);
    assert.deepEqual(state.body.trees.map((t: { name: string; archive: boolean }) => [t.name, t.archive]), [["Dvořákovi", false]]);
    assert.equal(state.body.heic, !!waysHere(w.env).heic);
    assert.ok(state.body.max > 0);
    assert.ok(!JSON.stringify(state.body).includes(w.home), "no path of this computer");
    const tree = state.body.trees[0].id as string;
    // another page of the network reads nothing either
    const evil = { ...me, Origin: "http://evil.example" };
    assert.equal((await request("GET", `${address}/phone/state`, undefined, evil)).status, 403);
    assert.equal((await request("GET", `${address}/phone/people?tree=${encodeURIComponent(tree)}&q=dvorak`, undefined, evil)).status, 403);
    assert.equal((await request("GET", `${address}/phone/media/${"0".repeat(64)}?tree=${encodeURIComponent(tree)}`, undefined, evil)).status, 403);
    await until("the stale part cleared", () => !fs.existsSync(stale), { ms: 20_000 });

    // a person: case, accents and a decomposed query aside
    for (const q of ["dvorak", "DVOŘÁ", "anežka".normalize("NFD")]) {
      const found = await request("GET", `${address}/phone/people?tree=${encodeURIComponent(tree)}&q=${encodeURIComponent(q)}`, undefined, me);
      assert.deepEqual(found.body.people.map((p: { id: string; name: string }) => [p.id, p.name]), [["P0001", "Anežka Dvořáková"]], q);
    }
    assert.deepEqual((await request("GET", `${address}/phone/people?tree=${tree}&q=d`, undefined, me)).body.people, []);
    assert.equal((await request("GET", `${address}/phone/people?tree=nope&q=dvorak`, undefined, me)).body.code, "phone.tree-gone");

    const media = (s: string, batch?: string) => `${address}/phone/media/${s}?tree=${encodeURIComponent(tree)}${batch ? `&batch=${batch}` : ""}`;
    const put = (photo: Buffer, name: string, batch: string, more: Record<string, string> = {}) =>
      request("PUT", media(sha(photo), batch), photo, { ...me, "Content-Type": "image/jpeg", "X-Strom-Name": encodeURIComponent(name), ...more });
    const batchFile = (id: string) => path.join(w.cwd, ".strom", "batches", `${id}.json`);
    const batchOf = (id: string) => JSON.parse(fs.readFileSync(batchFile(id), "utf8")) as Record<string, any>;

    // two photos taken, one from the gallery
    const A = "6b0f3c1e-2d4a-4e8b-9c7d-1a2b3c4d5e6f";
    const [one, two, three] = [read("s0001.jpg"), read("base420.jpg"), read("png-bw.png")];
    assert.deepEqual((await request("GET", media(sha(one)), undefined, me)).body, { known: false });
    assert.equal((await put(one, "IMG_0001.jpg", A, { Origin: "http://evil.example" })).status, 403, "another page of the network sends nothing");
    assert.equal((await request("PUT", media(sha(one), A), one, { "X-Strom-Name": "x.jpg" })).status, 401, "a phone not paired sends nothing");
    const first = await put(one, "IMG_0001.jpg", A);
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.match(first.body.input, /^I\d{4}$/);
    assert.equal(first.body.batch, A);
    // a NUL in the name (no browser sends one): left out, the photo taken
    const second = await put(two, "IMG_\u00000002.jpg", A);
    assert.equal(second.status, 200, JSON.stringify(second.body));
    assert.ok(!fs.readdirSync(incoming).some((n) => n.startsWith(sha(two))), "no part left");
    const known = await request("GET", media(sha(one)), undefined, me);
    assert.deepEqual([known.body.known, known.body.id], [true, first.body.input]);
    // the third cut short: nothing of it kept, no part left; sent again: once
    await cutShort(media(sha(three), A), three, { ...me, "X-Strom-Name": encodeURIComponent("Скан_03.png") });
    await until("the part of the cut upload gone", () => !fs.readdirSync(incoming).some((n) => n.startsWith(sha(three))), { ms: 20_000 });
    assert.deepEqual((await request("GET", media(sha(three)), undefined, me)).body, { known: false });
    assert.equal(batchOf(A).inputs.length, 2);
    const again = await put(three, "Скан_03.png", A);
    assert.equal(again.status, 200, JSON.stringify(again.body));
    const twice = await put(three, "Скан_03.png", A);
    assert.equal(twice.status, 200);
    assert.equal(twice.body.known, again.body.input, "the same photo twice: said known, nothing new");
    assert.equal(batchOf(A).inputs.length, 3);
    assert.equal(batchOf(A).from, "phone");
    const named = (await w.ok(["input", "show", again.body.input, "--json"])).json.input;
    assert.deepEqual([named.name, named.batch], ["Скан_03.png", A]);

    // handed over: a note in a decomposed form with another script, the person
    const note = "Dopisy z války, pošta Ольга".normalize("NFD");
    assert.equal((await request("POST", `${address}/phone/batch/${A}/done?tree=${tree}`, JSON.stringify({ note, person: "P0001" }), { ...me, Origin: "http://evil.example" })).status, 403);
    const done = await request("POST", `${address}/phone/batch/${A}/done?tree=${tree}`, JSON.stringify({ note, person: "P0001" }), { ...me, "Content-Type": "text/plain;charset=UTF-8" });
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.deepEqual(done.body.batches, [A]);
    assert.ok(done.body.tasks.length >= 1);
    const closed = batchOf(A);
    assert.equal(closed.note, note.normalize("NFC"));
    assert.deepEqual(closed.persons, ["P0001"]);
    assert.ok(closed.done);
    const task = (await w.ok(["task", "show", done.body.tasks[0], "--json"])).json.task;
    assert.equal(task.level, "intake");
    assert.ok(task.subject.includes("P0001"));
    assert.ok(task.why.includes(note.normalize("NFC")), task.why);
    const noted = (await w.ok(["input", "show", first.body.input, "--json"])).json.input;
    assert.deepEqual(noted.notes.map((n: { text: string; by: string }) => [n.text, n.by]), [[note.normalize("NFC"), "user"]]);

    // the same from the app's "Add materials" through the bridge: the same batch but for whose it is
    const B = "0e1d2c3b-4a59-4687-b5a4-c3d2e1f0a9b8";
    const four = read("grey.jpg");
    // a NUL in a header of the app's: refused before it is read, no part left for the tidying
    const nul = await request("PUT", `${bridge.url}/media/${sha(four)}`, four, { Origin: "https://stromapp.info", "X-Strom-Batch": B, "X-Strom-Name": "gr%00ey.jpg" });
    assert.deepEqual([nul.status, nul.body.code], [400, "media.bad-header"]);
    assert.ok(!fs.readdirSync(incoming).some((n) => n.startsWith(sha(four))), "no part left");
    assert.equal((await request("PUT", `${bridge.url}/media/${sha(four)}`, four, { Origin: "https://stromapp.info", "X-Strom-Batch": B, "X-Strom-Name": "grey.jpg", "X-Strom-Path": "grey.jpg" })).status, 200);
    const appDone = await request("POST", `${bridge.url}/batch/${B}/done`, JSON.stringify({ note: "Krabice", person: "P0001" }), { Origin: "https://stromapp.info", "Content-Type": "application/json" });
    assert.equal(appDone.status, 200, JSON.stringify(appDone.body));
    const app = batchOf(B);
    assert.deepEqual(Object.keys(closed).filter((k) => k !== "from").sort(), Object.keys(app).sort());
    assert.equal(app.from, undefined);
    const appTask = (await w.ok(["task", "show", appDone.body.tasks[0], "--json"])).json.task;
    assert.equal(appTask.level, task.level);

    // a batch nobody hands over: closed an hour after its last photo by the phone's server alone (no bridge runs)
    const C = "5f4e3d2c-1b0a-4987-8654-3210fedcba98";
    const five = read("base444.jpg");
    assert.equal((await put(five, "IMG_0005.jpg", C)).status, 200);
    await w.ok(["live", "stop"]);
    fs.writeFileSync(batchFile(C), JSON.stringify({ ...batchOf(C), updated: new Date(Date.now() - 61 * 60_000).toISOString() }));
    await until("closed by the phone's server", () => batchOf(C).closed === "idle", { ms: 30_000, state: () => batchOf(C) });
    // a photo sent into it after: in the batch that took over from it
    const six = read("png-rgb.png");
    const late = await put(six, "IMG_0006.png", C);
    assert.equal(late.status, 200, JSON.stringify(late.body));
    const D = late.body.batch as string;
    assert.ok(D && D !== C, "another batch took over");
    assert.equal(batchOf(C).next, D);
    assert.equal(batchOf(D).from, "phone");
    // handed over: both, the note and the person given to the one closed already too
    const both = await request("POST", `${address}/phone/batch/${C}/done?tree=${tree}`, JSON.stringify({ note: "Náhrobek, Жуков", person: "p0001" }), me);
    assert.equal(both.status, 200, JSON.stringify(both.body));
    assert.deepEqual(both.body.batches, [C, D]);
    assert.equal(batchOf(C).note, "Náhrobek, Жуков");
    assert.deepEqual(batchOf(C).persons, ["P0001"]);
    assert.ok(batchOf(D).done);
    const idleTask = (await w.ok(["task", "show", batchOf(C).tasks[0], "--json"])).json.task;
    assert.ok(idleTask.subject.includes("P0001"));
    assert.ok(idleTask.why.includes("Náhrobek, Жуков"), idleTask.why);
    // a batch none of whose photos was new: nothing to hand over
    assert.deepEqual((await request("POST", `${address}/phone/batch/1a2b3c4d-0000-4000-8000-000000000000/done?tree=${tree}`, "{}", me)).body, { empty: true, batch: "1a2b3c4d-0000-4000-8000-000000000000" });
    // the tree gone from the page's list: said, the photos kept on the phone
    assert.equal((await request("PUT", `${address}/phone/media/${sha(six)}?tree=nope&batch=${C}`, six, me)).body.code, "phone.tree-gone");
  } finally {
    w.cleanup();
  }
});
