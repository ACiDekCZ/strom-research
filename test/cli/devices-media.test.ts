// A large file of a paired device of the home network in sealed blocks (PUT /device/media/<sha256>; devices.mode on,
// the phone's server on the loopback alone — STROM_PHONE_TEST): the meta block (the bridge's headers), then blocks of
// 1 MiB, each sealed of its own (its index and whether it is the last in its AAD). Taken: a file of one block, of three,
// one sent in part and gone on with from what the gateway has (its state through the tunnel), one of a batch queued
// (respond-async) and the batch closed through the tunnel, names in any script and decomposed; the bytes the research
// keeps are the file's. Refused: another device's key, a device unpaired (its part gone), blocks past the last, a block
// changed, swapped, From out of range or not what the gateway has, a way out in the hash or in X-Strom-Path, the bridge's
// secret, a request sent again (its nonce: sealed media.replay with what the gateway has, nothing written), a time off, another Host, another page, X-Strom-Read, a file over the limit, a second file of a
// row at once. A request's body gzipped in the tunnel (z) unpacked, a bomb stopped.

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import zlib from "node:zlib";
import { World, hasGit, until } from "../helpers.ts";
import {
  b64url,
  deviceKey,
  fromB64url,
  MEDIA_BLOCK,
  MEDIA_META,
  MEDIA_TAG,
  mediaBlocks,
  openPair,
  openResponse,
  pairProof,
  responseBody,
  sealMediaBlock,
  sealMediaBody,
  sealRequest,
  type DeviceRequest,
} from "../../src/core/devices.ts";
import { deviceUploadsRoot, uploadFiles } from "../../src/core/device-uploads.ts";
import { liveFile } from "../../src/core/live.ts";

const skip = !hasGit || process.platform === "win32";
const MAX = 3 * 1024 * 1024;

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

type Answer = { status: number; body: Buffer; json: Record<string, any>; headers: http.IncomingHttpHeaders };

/**
 * How long a step of the test and one request may take at most (a budget, not a measure: on a Mac a step takes well under
 * a second). A request not answered in time fails naming its step — never a test waiting for the run's own limit with a
 * server left behind.
 */
const STEP_MS = 90_000;
const REQUEST_MS = 60_000;

/** The step the test is at: its name, and a signal that ends every request of it once its budget is spent. */
const at = { name: "setting up", ctl: new AbortController(), timer: undefined as NodeJS.Timeout | undefined };
function step(name: string, ms = STEP_MS): void {
  clearTimeout(at.timer);
  const ctl = new AbortController();
  at.name = name;
  at.ctl = ctl;
  at.timer = setTimeout(() => ctl.abort(new Error(`the step took more than ${ms} ms`)), ms);
  at.timer.unref();
}
/** A request's signal: its step's budget and its own. */
const signal = () => AbortSignal.any([at.ctl.signal, AbortSignal.timeout(REQUEST_MS)]);
/** Why a request failed, with its step. */
const failed = (method: string, url: string, e: Error, sig: AbortSignal) => new Error(`[${at.name}] ${method} ${new URL(url).pathname.slice(0, 80)}: ${sig.aborted ? `no answer — ${String((sig.reason as Error)?.message ?? sig.reason)}` : e.message}`, { cause: e });

/** A request; its body in one piece with its length, or (chunked) in pieces without one. */
function request(method: string, url: string, body?: Buffer | string, headers: Record<string, string> = {}, o: { chunked?: boolean } = {}): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const b = typeof body === "string" ? Buffer.from(body) : body;
    const sig = signal();
    const req = http.request(url, { method, agent: false, signal: sig, headers: { ...(b !== undefined && !o.chunked ? { "Content-Length": String(b.length) } : {}), ...headers } }, (res) => {
      const parts: Buffer[] = [];
      res.on("data", (c: Buffer) => parts.push(c));
      res.on("error", (e) => reject(failed(method, url, e, sig)));
      res.on("end", () => {
        const all = Buffer.concat(parts);
        let json: Record<string, any> = {};
        try {
          json = JSON.parse(all.toString("utf8"));
        } catch {
          // not JSON
        }
        resolve({ status: res.statusCode ?? 0, body: all, json, headers: res.headers });
      });
    });
    // (an answer come whole stands: a connection closed under the rest of a body still being sent is no failure)
    req.on("error", (e) => reject(failed(method, url, e, sig)));
    if (b && o.chunked) {
      for (let i = 0; i < b.length; i += 300_000) req.write(b.subarray(i, i + 300_000));
      req.end();
    } else req.end(b);
  });
}

/** A PDF of `size` bytes of its own content (a mark of its kind, its end): what the research takes as an original. */
function pdf(size: number, seed: number): Buffer {
  const b = Buffer.alloc(size);
  for (let j = 0; j < size; j++) b[j] = (j * 31 + 7 + seed) & 255;
  Buffer.from("%PDF-1.4\n").copy(b, 0);
  Buffer.from("\n%%EOF\n").copy(b, size - 7);
  return b;
}

const sha256 = (b: Buffer) => crypto.createHash("sha256").update(b).digest("hex");

type Dev = { id: string; key: Buffer };
type Sent = Answer & { s?: number; h?: Record<string, string>; data?: any; n: string };

test("a large file of a device in sealed blocks: taken whole, gone on with after a break, in a batch queued; every refusal; a gzipped request unpacked", { skip, timeout: 300_000 }, async () => {
  const w = new World();
  const site = http.createServer((_req, res) => void res.writeHead(404, { "Content-Type": "text/plain" }).end("not here"));
  await new Promise<void>((ok) => site.listen(0, "127.0.0.1", ok));
  // a stand-in of the bridge of a second tree (its live.json the test's own): busy (503) first, then it takes the file
  const TOKEN = crypto.randomBytes(16).toString("hex");
  const standIn = { busy: 1, got: [] as { url: string; headers: http.IncomingHttpHeaders; body: Buffer }[], early: [] as [number, Record<string, unknown>][], answeredEarly: 0 };
  const fake = http.createServer((req, res) => {
    // answered before it took the file (as the bridge refuses one, or has it already): at once, the rest read and
    // thrown away
    const early = standIn.early.shift();
    if (early) {
      standIn.answeredEarly++;
      res.writeHead(early[0], { "Content-Type": "application/json; charset=utf-8", ...(early[0] === 503 ? { "Retry-After": "30" } : {}) }).end(JSON.stringify(early[1]));
      return void req.resume();
    }
    const parts: Buffer[] = [];
    req.on("data", (c: Buffer) => parts.push(c));
    req.on("end", () => {
      const body = Buffer.concat(parts);
      standIn.got.push({ url: req.url ?? "", headers: req.headers, body });
      const sha = /^\/[0-9a-f]+\/media\/([0-9a-f]{64})$/.exec(req.url ?? "")?.[1];
      if (req.method !== "PUT" || !req.url?.startsWith(`/${TOKEN}/`) || !sha) return void res.writeHead(404).end();
      if (standIn.busy-- > 0) return void res.writeHead(503, { "Content-Type": "application/json; charset=utf-8", "Retry-After": "30" }).end(JSON.stringify({ code: "research.busy", retry: 30 }));
      if (sha256(body) !== sha) return void res.writeHead(409, { "Content-Type": "application/json; charset=utf-8" }).end(JSON.stringify({ code: "media.sha-differs" }));
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" }).end(JSON.stringify({ sha, bytes: body.length }));
    });
  });
  await new Promise<void>((ok) => fake.listen(0, "127.0.0.1", ok));
  let standInFile: string | undefined;
  const keepAlive = new http.Agent({ keepAlive: true });
  const open: http.ClientRequest[] = [];
  try {
    step("a tree, its bridge and the phone's server");
    await w.withTree("Lhotákovi");
    await w.ok(["init", "Lhotovi"], { cwd: w.home });
    const second = w.treeDir("Lhotovi");
    await w.ok(["person", "add", "Jan /Lhoták/", "--sex", "M"]); // P1
    await w.ok(["config", "set", "devices.mode", "on"], { tty: true });
    fs.writeFileSync(path.join(w.env.STROM_CONFIG_DIR!, "phone.json"), JSON.stringify({ on: false, port: await freePort() }));
    w.env.STROM_MEDIA_MAX_BYTES = String(MAX);
    const env = { STROM_ISOLATED: "1", STROM_PHONE_TEST_ANSWER: "yes", STROM_PHONE_TEST_ANSWER_MS: "200", STROM_DEVICE_LOCAL_NAME: "lhota-pc", STROM_DEVICE_SWEEP_MS: "200" };
    const APP = { Origin: `http://127.0.0.1:${(site.address() as net.AddressInfo).port}`, "X-Strom-App-Version": "3.99.0", "Content-Type": "text/plain;charset=UTF-8" };
    const bridge = (await w.ok(["live", "start", "--json"], { env })).json as { url: string };
    const root = w.treeDir("Lhotákovi");
    const token = (JSON.parse(fs.readFileSync(path.join(root, ".strom", "live.json"), "utf8")) as { token: string }).token;
    assert.equal((await request("POST", `${bridge.url}/phone/on`, "{}", APP)).status, 200);
    let address = "";
    await until("the phone's server", async () => {
      address = (await request("GET", `${bridge.url}/phone`, undefined, APP)).json.addresses?.[0]?.url ?? "";
      return !!address;
    }, { ms: 20_000 });
    const ORIGIN = { Origin: address };
    step("two devices paired");

    const pairWith = async (pairId: string, secret: string, name: string): Promise<Dev & { tree: string; tree2: string }> => {
      const key = deviceKey(fromB64url(secret, 32)!, pairId);
      const r = await request("POST", `${address}/device/pair`, JSON.stringify({ pairId, proof: pairProof(key, pairId), name, kind: "phone" }), { ...ORIGIN, "Content-Type": "application/json" });
      assert.equal(r.status, 200, r.body.toString());
      const said = openPair(key, pairId, r.json)!;
      const trees = said.trees as { id: string; name: string }[];
      return { id: said.device.id, key, tree: trees.find((t) => t.name === "Lhotákovi")!.id, tree2: trees.find((t) => t.name === "Lhotovi")!.id };
    };
    const code = async () => String((await request("POST", `${bridge.url}/phone/pair`, JSON.stringify({ mode: "app" }), APP)).json.url).split("#")[1]!.split(".") as [string, string];
    const me = await pairWith(...(await code()), "Telefon Lhotáků");
    const other = await pairWith(...(await code()), "Tablet · Лхота");
    const tree = me.tree;

    /** A request of the tunnel, its answer opened. */
    const x = async (dev: Dev, r: Omit<DeviceRequest, "tree">): Promise<Sent> => {
      const envelope = sealRequest(dev.key, dev.id, Date.now(), { tree, ...r } as DeviceRequest);
      const got = await request("POST", `${address}/device/x`, JSON.stringify(envelope), { ...ORIGIN, "Content-Type": "application/json" });
      if (got.status !== 200) return { ...got, n: envelope.n };
      const inner = openResponse(dev.key, dev.id, envelope.n, got.json);
      assert.ok(inner, "the answer opens with the device's key");
      const body = responseBody(inner);
      let data: any;
      try {
        data = body ? JSON.parse(body.toString("utf8")) : undefined;
      } catch {
        data = undefined;
      }
      return { ...got, s: inner.s, h: inner.h, data, n: envelope.n };
    };
    const kept = (dev: Dev, sha: string) => x(dev, { m: "GET", p: `device/media/${sha}` });

    type Put = { sha?: string; from?: number; to?: number; meta?: Record<string, string>; t?: number; base?: Buffer; headers?: Record<string, string>; body?: Buffer; chunked?: boolean; path?: string; key?: Buffer; size?: number };
    /** A file sent as a device sends it (its blocks from From+1 to `to`); the answer opened with its key. */
    const put = async (dev: Dev, file: Buffer, o: Put = {}): Promise<Sent> => {
      const t = o.t ?? Date.now();
      const base = o.base ?? crypto.randomBytes(12);
      const sha = o.sha ?? sha256(file);
      const body = o.body ?? sealMediaBody(o.key ?? dev.key, dev.id, t, base, sha, o.meta ?? {}, file, o.from ?? 0, o.to);
      const headers = { ...ORIGIN, "Content-Type": "application/octet-stream", "X-Strom-Device": dev.id, "X-Strom-Time": String(t), "X-Strom-Nonce": b64url(base), "X-Strom-Tree": tree, "X-Strom-Size": String(o.size ?? file.length), "X-Strom-From": String(o.from ?? 0), "X-Strom-App-Version": "3.99.0", ...o.headers };
      const got = await request("PUT", `${address}${o.path ?? `/device/media/${sha}`}`, body, headers, { chunked: o.chunked });
      const n = b64url(base);
      if (got.status !== 200) return { ...got, n };
      const inner = openResponse(dev.key, dev.id, n, got.json);
      assert.ok(inner, `the answer opens with the device's key: ${got.body.toString().slice(0, 200)}`);
      // never with another device's
      assert.equal(openResponse(dev.id === me.id ? other.key : me.key, dev.id, n, got.json), undefined);
      const raw = responseBody(inner);
      return { ...got, s: inner.s, h: inner.h, data: raw && raw.length ? JSON.parse(raw.toString("utf8")) : undefined, n };
    };
    const coded = (a: Sent) => [a.status, a.s, a.s === undefined ? a.json.code : a.data?.code];
    const uploads = deviceUploadsRoot(w.env);
    const filesIn = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).map(String).sort() : []);
    const research = async (sha: string) => (await request("GET", `${bridge.url}/media/${sha}`)).json;
    const bytesOf = async (sha: string) => (await request("GET", `${bridge.url}/media/${sha}?file=1`)).body;

    // ——— taken ———

    step("a file of one block");
    // one block: a name decomposed and of another script, a person, a note — the research keeps the file's bytes
    const small = pdf(50_000, 1);
    const name = "Křest Jana Lhotáka — Лхота.pdf";
    const one = await put(me, small, { meta: { "X-Strom-Name": encodeURIComponent(name.normalize("NFD")), "X-Strom-Person": "P0001", "X-Strom-Note": encodeURIComponent("z krabice Lhotáků · Лхота".normalize("NFD")) } });
    assert.equal(one.status, 200, one.body.toString());
    assert.equal(one.s, 200, JSON.stringify(one.data));
    assert.equal(one.data.sha, sha256(small));
    assert.equal((await research(sha256(small))).name, name.normalize("NFC"));
    assert.deepEqual(await bytesOf(sha256(small)), small);
    assert.deepEqual(filesIn(path.join(uploads, me.id)), [], "nothing kept once delivered");

    step("a file of three blocks");
    // three blocks (2.1 MiB: 1 MiB, 1 MiB and the rest)
    const three = pdf(2 * MEDIA_BLOCK + 100_000, 2);
    assert.equal(mediaBlocks(three.length), 3);
    const t3 = await put(me, three, { meta: { "X-Strom-Name": "tri-bloky.pdf", "X-Strom-Person": "P0001" } });
    assert.deepEqual([t3.status, t3.s, t3.data?.sha], [200, 200, sha256(three)], JSON.stringify(t3.data));
    assert.deepEqual(await bytesOf(sha256(three)), three);

    step("a break after block 1, gone on with From = 1");
    // a break after block 1: kept (the user's alone), its state through the tunnel, gone on with From = 1
    const broken = pdf(2 * MEDIA_BLOCK + 200_000, 3);
    const bsha = sha256(broken);
    assert.deepEqual((await kept(me, bsha)).data, { sha: bsha, have: 0 }, "nothing yet");
    const tb = Date.now();
    const bb = crypto.randomBytes(12);
    const part = await put(me, broken, { to: 1, t: tb, base: bb, meta: { "X-Strom-Name": "prerusene.pdf" } });
    assert.deepEqual([part.status, part.s, part.data], [200, 200, { sha: bsha, have: 1, size: broken.length }]);
    // the same request again, whole (a browser sends a PUT again by itself once its connection broke): nothing of it
    // read, written or carried — told, sealed, what the gateway has (never device.clock: no clock to even out)
    for (const to of [undefined, 1]) {
      const replay = await put(me, broken, { t: tb, base: bb, meta: { "X-Strom-Name": "prerusene.pdf" }, ...(to ? { to } : {}) });
      assert.deepEqual([...coded(replay), replay.data.params], [200, 409, "media.replay", { have: "1" }], JSON.stringify(replay.json));
    }
    // sent again on a connection that ends with the answer (Connection: close): the rest of the body read first, then
    // the answer — the device never meets a reset under the rest it still sends (before: the answer at once, the
    // connection ended under the body, a write EPIPE on Linux before the answer was read)
    {
      const u = new URL(address);
      const sealedBody = sealMediaBody(me.key, me.id, tb, bb, bsha, { "X-Strom-Name": "prerusene.pdf" }, broken, 0);
      const head = [`PUT /device/media/${bsha} HTTP/1.1`, `Host: ${u.host}`, `Origin: ${address}`, "Connection: close", "Content-Type: application/octet-stream", `Content-Length: ${sealedBody.length}`, `X-Strom-Device: ${me.id}`, `X-Strom-Time: ${tb}`, `X-Strom-Nonce: ${b64url(bb)}`, `X-Strom-Tree: ${tree}`, `X-Strom-Size: ${broken.length}`, "X-Strom-From: 0", "", ""].join("\r\n");
      const so = net.connect(Number(u.port), u.hostname);
      const got: Buffer[] = [];
      let failure: Error | undefined;
      so.on("data", (c: Buffer) => got.push(c));
      so.on("error", (e) => (failure = e));
      const closed = new Promise<void>((ok) => so.on("close", () => ok()));
      await new Promise<void>((ok) => so.once("connect", () => ok()));
      const cut = MEDIA_META + MEDIA_TAG + 1000;
      so.write(Buffer.concat([Buffer.from(head), sealedBody.subarray(0, cut)]));
      // the meta block opened and judged a request sent again while the rest waits
      await until("the meta block taken", () => got.length > 0 || so.destroyed, { ms: 1500 }).catch(() => undefined);
      const early = Buffer.concat(got).length;
      if (!so.destroyed) so.end(sealedBody.subarray(cut));
      await closed;
      assert.equal(failure, undefined, `no reset under the body still sent: ${failure?.message}`);
      assert.equal(early, 0, "on a connection that ends with it, the answer comes once the body was read");
      const text = Buffer.concat(got).toString("utf8");
      assert.match(text, /^HTTP\/1\.1 200 /u, text.slice(0, 200));
      const [top, ...rest] = text.split("\r\n\r\n");
      let raw = rest.join("\r\n\r\n");
      if (/^transfer-encoding: *chunked/imu.test(top!)) {
        // its chunks joined
        let out = "";
        for (let at = 0; ; ) {
          const eol = raw.indexOf("\r\n", at);
          const n = parseInt(raw.slice(at, eol), 16);
          if (!n) break;
          out += raw.slice(eol + 2, eol + 2 + n);
          at = eol + 2 + n + 2;
        }
        raw = out;
      }
      const opened = openResponse(me.key, me.id, b64url(bb), JSON.parse(raw))!;
      assert.deepEqual([opened.s, JSON.parse(responseBody(opened)!.toString("utf8")).code], [409, "media.replay"]);
    }
    assert.equal(fs.statSync(uploadFiles(w.env, me.id, bsha).part).size, MEDIA_BLOCK, "nothing written of a request sent again");
    assert.ok(!(await research(bsha)).known, "nothing carried to the research");
    const f = uploadFiles(w.env, me.id, bsha);
    assert.equal(fs.statSync(f.part).size, MEDIA_BLOCK);
    assert.equal(fs.statSync(f.part).mode & 0o777, 0o600);
    assert.equal(fs.statSync(f.note).mode & 0o777, 0o600);
    assert.deepEqual(fs.readFileSync(f.part), broken.subarray(0, MEDIA_BLOCK), "the block opened, as it is");
    assert.ok(path.relative(root, uploads).startsWith(".."), "never in the research's folder (nor its git)");
    const state = await kept(me, bsha);
    assert.deepEqual([state.s, state.data], [200, { sha: bsha, size: broken.length, have: 1 }]);
    // another device has nothing of it (its own uploads)
    assert.deepEqual((await kept(other, bsha)).data, { sha: bsha, have: 0 });
    // From not what the gateway has: told what it has (sealed)
    const wrong = await put(me, broken, { from: 2, meta: { "X-Strom-Name": "prerusene.pdf" } });
    assert.deepEqual([wrong.status, wrong.s, wrong.data.code, wrong.data.params], [200, 409, "media.from", { have: "1" }]);
    assert.equal(fs.statSync(f.part).size, MEDIA_BLOCK, "kept as it was");
    // the state's sha of another shape
    assert.deepEqual([(await kept(me, "../etc")).s, (await kept(me, "../etc")).data.code], [400, "device.id"]);
    const rest = await put(me, broken, { from: 1, meta: { "X-Strom-Name": "prerusene.pdf" } });
    assert.deepEqual([rest.status, rest.s, rest.data?.sha], [200, 200, bsha], JSON.stringify(rest.data));
    assert.deepEqual(await bytesOf(bsha), broken);
    assert.deepEqual((await kept(me, bsha)).data, { sha: bsha, have: 0 }, "gone once delivered");

    step("a file of a batch queued, the batch closed through the tunnel");
    // a batch: queued (respond-async), its path and the batch's name in any script, closed through the tunnel
    const batch = "lhota-krabice-2026";
    const inBatch = pdf(MEDIA_BLOCK + 5000, 4);
    const q = await put(me, inBatch, { meta: { "X-Strom-Batch": batch, "X-Strom-Name": encodeURIComponent("dopis.pdf"), "X-Strom-Path": encodeURIComponent("Krabice Lhotáků/Лхота/dopis.pdf".normalize("NFD")), Prefer: "respond-async" } });
    assert.deepEqual([q.status, q.s, q.data?.queued, q.data?.sha, q.h?.["Preference-Applied"]], [200, 202, true, sha256(inBatch), "respond-async"], JSON.stringify(q.data));
    const done = await x(me, { m: "POST", p: `batch/${batch}/done`, b: { name: "Krabice Lhotáků · Лхота".normalize("NFD"), files: 1, person: "P0001", note: "půda" } });
    assert.equal(done.s, 200, JSON.stringify(done.data));
    await until("the batch's file in the research", async () => (await research(sha256(inBatch))).known, { ms: 30_000 });
    assert.deepEqual(await bytesOf(sha256(inBatch)), inBatch);

    step("the bridge busy (a stand-in), the file sent again with From = N");
    // the bridge busy (503): the blocks kept, the answer told as the bridge said it; sent again with From = N (the meta
    // block alone), delivered whole — then nothing kept
    standInFile = liveFile(second);
    fs.mkdirSync(path.dirname(standInFile), { recursive: true });
    fs.writeFileSync(standInFile, JSON.stringify({ port: (fake.address() as net.AddressInfo).port, token: TOKEN, pid: process.pid, url: `http://127.0.0.1:${(fake.address() as net.AddressInfo).port}/${TOKEN}`, started: new Date().toISOString(), root: second }));
    const held503 = pdf(MEDIA_BLOCK + 3000, 17);
    const hsha = sha256(held503);
    const to2 = { "X-Strom-Tree": me.tree2 };
    const busy503 = await put(me, held503, { headers: to2, meta: { "X-Strom-Name": encodeURIComponent("Lhotovi · Лхота.pdf".normalize("NFD")) } });
    assert.deepEqual([...coded(busy503), busy503.h?.["Retry-After"]], [200, 503, "research.busy", "30"], JSON.stringify(busy503.data));
    assert.deepEqual((await kept(me, hsha)).data, { sha: hsha, size: held503.length, have: 2 }, "kept for From = N");
    assert.deepEqual(fs.readFileSync(uploadFiles(w.env, me.id, hsha).part), held503);
    const again503 = await put(me, held503, { from: 2, headers: to2, meta: { "X-Strom-Name": encodeURIComponent("Lhotovi · Лхота.pdf".normalize("NFD")) } });
    assert.deepEqual([again503.status, again503.s, again503.data], [200, 200, { sha: hsha, bytes: held503.length }]);
    assert.equal(standIn.got.length, 2);
    for (const g of standIn.got) {
      assert.equal(g.url, `/${TOKEN}/media/${hsha}`);
      assert.ok(g.body.equals(held503), "the file whole, both times");
      assert.equal(g.headers["x-strom-device"], me.id);
      assert.equal(decodeURIComponent(String(g.headers["x-strom-name"])), "Lhotovi · Лхота.pdf".normalize("NFD"));
      assert.equal(g.headers["x-strom-app-version"], "3.99.0");
    }
    assert.deepEqual((await kept(me, hsha)).data, { sha: hsha, have: 0 }, "gone once delivered");

    // a bridge answering before it took the whole file (refused it, had it already: answered at once, the rest thrown
    // away and the connection closed under it): its answer told to the device at once — the gateway never waits for
    // the rest of the file to go (it once waited for ever, the device's request never answered)
    step("a bridge answering before it took the whole file");
    const lateFile = pdf(2 * MEDIA_BLOCK + 50_000, 18);
    const lsha0 = sha256(lateFile);
    standIn.early.push([409, { code: "batch.closed" }]);
    const closedEarly = await put(me, lateFile, { headers: to2, meta: { "X-Strom-Name": "lhota-pozde.pdf" } });
    assert.deepEqual(coded(closedEarly), [200, 409, "batch.closed"], JSON.stringify(closedEarly.data));
    assert.deepEqual((await kept(me, lsha0)).data, { sha: lsha0, have: 0 }, "refused for good: nothing kept");
    // busy before it took it: kept for From = N, then taken whole
    standIn.early.push([503, { code: "research.busy", retry: 30 }]);
    const busyEarly = await put(me, lateFile, { headers: to2, meta: { "X-Strom-Name": "lhota-pozde.pdf" } });
    assert.deepEqual([...coded(busyEarly), busyEarly.h?.["Retry-After"]], [200, 503, "research.busy", "30"], JSON.stringify(busyEarly.data));
    assert.deepEqual((await kept(me, lsha0)).data, { sha: lsha0, size: lateFile.length, have: 3 });
    const lateAgain = await put(me, lateFile, { from: 3, headers: to2, meta: { "X-Strom-Name": "lhota-pozde.pdf" } });
    assert.deepEqual([lateAgain.status, lateAgain.s, lateAgain.data], [200, 200, { sha: lsha0, bytes: lateFile.length }]);
    assert.equal(standIn.answeredEarly, 2);
    assert.ok(standIn.got.at(-1)!.body.equals(lateFile), "the file whole");
    fs.rmSync(standInFile, { force: true });
    standInFile = undefined;

    step("refused before it is opened");
    // ——— refused before it is opened (open answers): the shape, the device, its key, its time and nonce ———

    const plain = pdf(20_000, 5);
    const psha = sha256(plain);
    /** A body sealed as the request says (its time and nonce): refused for what it says alone. */
    const meta0 = (file: Buffer, sha: string, from = 0) => {
      const t = Date.now();
      const base = crypto.randomBytes(12);
      return { t, base, body: sealMediaBody(me.key, me.id, t, base, sha, {}, file, from) };
    };
    for (const [why, o] of [
      ["a hash of another shape", { path: `/device/media/${psha.slice(1)}` }],
      ["a way out as the hash", { path: `/device/media/..%2F..%2F${psha.slice(12)}` }],
      ["a device of another shape", { headers: { "X-Strom-Device": "../dv_x" } }],
      ["From no number", { headers: { "X-Strom-From": "jedna" } }],
      ["Size no number", { headers: { "X-Strom-Size": "20 000" } }],
      ["Size 0", { headers: { "X-Strom-Size": "0" } }],
      ["From past the last block", { from: 2, ...meta0(plain, psha, 1) }],
      ["a nonce of another length", { headers: { "X-Strom-Nonce": b64url(crypto.randomBytes(8)) } }],
      ["a body longer than its blocks", ((o) => ({ ...o, body: Buffer.concat([o.body, Buffer.alloc(32)]) }))(meta0(plain, psha))],
    ] as [string, Put][]) {
      const r = await put(me, plain, o);
      assert.deepEqual([r.status, r.json.code], [400, "device.bad"], why);
    }
    const way = await request("PUT", `${address}/device/media/../../${psha}`, Buffer.alloc(4112), { ...ORIGIN });
    assert.notEqual(way.status, 200, "a way up is no file");
    // another device's id with this one's key: its meta block does not open
    assert.deepEqual(coded(await put({ id: other.id, key: me.key }, plain)), [400, undefined, "device.bad"]);
    // the time over 2 minutes off: open, with the gateway's time (the device evens out its clock)
    const late = await put(me, plain, { t: Date.now() - 3 * 60_000 });
    assert.deepEqual(coded(late), [409, undefined, "device.clock"]);
    assert.deepEqual([typeof late.json.now, late.json.replay], ["number", false]);
    // the same nonce again (the tunnel's memory): sealed media.replay — delivered already, the gateway has none of it
    const base = crypto.randomBytes(12);
    const t0 = Date.now();
    assert.equal((await put(me, plain, { t: t0, base })).s, 200);
    const again = await put(me, plain, { t: t0, base });
    assert.deepEqual([...coded(again), again.data.params], [200, 409, "media.replay", { have: "0" }]);
    // its nonce taken in the tunnel too: the tunnel's request with it refused as sent again
    const reused = await request("POST", `${address}/device/x`, JSON.stringify(sealRequest(me.key, me.id, t0, { tree, m: "GET", p: "status" } as DeviceRequest, base)), { ...ORIGIN, "Content-Type": "application/json" });
    assert.deepEqual([reused.status, reused.json.code, reused.json.replay], [409, "device.clock", true]);
    // another page, another Host
    assert.deepEqual([(await put(me, plain, { headers: { Origin: "http://lhota.example" } })).status], [403]);
    assert.deepEqual(coded(await put(me, plain, { headers: { Host: "lhota.example" } })), [421, undefined, "phone.host"]);

    // ——— refused once opened (sealed) ———
    step("refused once opened");

    assert.deepEqual(coded(await put(me, plain, { meta: { "X-Strom-Read": "1" } })).slice(0, 3), [200, 403, "device.computer-only"]);
    assert.equal((await put(me, plain, { meta: { "X-Strom-Read": "1" } })).data.action, "media.read");
    const unknown = await put(me, plain, { meta: { "X-Strom-Secret": "1" } });
    assert.deepEqual([...coded(unknown), unknown.data.params], [200, 400, "device.bad", { header: "X-Strom-Secret" }]);
    assert.deepEqual(coded(await put(me, plain, { meta: { "X-Strom-Name": "Лхота.pdf" } })), [200, 400, "device.bad"], "a header's value: printable ASCII (percent-encoded)");
    assert.deepEqual(coded(await put(me, plain, { meta: { "X-Strom-Name": "a\r\nX-Strom-Read: 1" } })), [200, 400, "device.bad"]);
    assert.deepEqual(coded(await put(me, plain, { headers: { "X-Strom-Tree": "tr_nikde" } })), [200, 404, "tree.unknown"]);
    // over the limit: refused before any block is read
    const gt = Date.now();
    const gbase = crypto.randomBytes(12);
    const large = await put(me, plain, { t: gt, base: gbase, size: MAX + 1, body: sealMediaBody(me.key, me.id, gt, gbase, psha, {}, plain, 0, 0) });
    assert.deepEqual([...coded(large), large.data.max], [200, 413, "media.large", MAX]);
    // the bridge's secret in what a device sends: as it is or percent-encoded
    for (const note of [token, encodeURIComponent(`../${token}/status`)]) {
      const r = await put(me, pdf(20_000, 6), { meta: { "X-Strom-Note": note } });
      assert.deepEqual([...coded(r), r.data.action], [200, 403, "device.computer-only", "path"]);
    }
    step("a way out in X-Strom-Path");
    // a way out in X-Strom-Path (as it is and percent-encoded): the bridge keeps the path's words alone, nothing outside
    for (const [i, way] of ["../../venku.pdf", encodeURIComponent("../../venku-2.pdf"), encodeURIComponent("..\\..\\venku-3.pdf")].entries()) {
      const out = pdf(20_000, 70 + i);
      const outside = await put(me, out, { meta: { "X-Strom-Batch": "lhota-cesta-2026", "X-Strom-Path": way } });
      assert.equal(outside.s, 200, JSON.stringify(outside.data));
      assert.deepEqual(await bytesOf(sha256(out)), out);
    }
    for (const dir of [uploads, path.dirname(uploads), root, path.dirname(root), w.home]) for (const n of ["venku.pdf", "venku-2.pdf", "venku-3.pdf"]) assert.ok(!fs.existsSync(path.join(dir, n)), path.join(dir, n));
    assert.deepEqual(filesIn(path.join(uploads, me.id)), []);
    step("a block changed, blocks swapped, the last said not last, a block past the last");
    // a block changed: not delivered, what came before it kept
    const changed = pdf(2 * MEDIA_BLOCK + 3000, 8);
    const csha = sha256(changed);
    const ct = Date.now();
    const cbase = crypto.randomBytes(12);
    const cbody = sealMediaBody(me.key, me.id, ct, cbase, csha, {}, changed);
    cbody.writeUInt8(cbody.readUInt8(cbody.length - 5) ^ 0x01, cbody.length - 5);
    const c = await put(me, changed, { t: ct, base: cbase, body: cbody });
    assert.deepEqual([...coded(c), c.data.params], [200, 400, "device.bad", { have: "2" }]);
    assert.equal((await research(csha)).known ?? null, null, "not delivered");
    assert.deepEqual((await kept(me, csha)).data, { sha: csha, size: changed.length, have: 2 });
    // swapped blocks: nothing opens past the meta block
    const st = Date.now();
    const sbase = crypto.randomBytes(12);
    const swapped = Buffer.concat([
      sealMediaBody(me.key, me.id, st, sbase, csha, {}, changed, 0, 0),
      sealMediaBlock(me.key, me.id, st, sbase, csha, 2, false, changed.subarray(MEDIA_BLOCK, 2 * MEDIA_BLOCK)),
      sealMediaBlock(me.key, me.id, st, sbase, csha, 1, false, changed.subarray(0, MEDIA_BLOCK)),
      sealMediaBlock(me.key, me.id, st, sbase, csha, 3, true, changed.subarray(2 * MEDIA_BLOCK)),
    ]);
    const sw = await put(me, changed, { t: st, base: sbase, body: swapped });
    assert.deepEqual([...coded(sw), sw.data.params], [200, 400, "device.bad", { have: "0" }]);
    // the last block said not last
    const lt = Date.now();
    const lbase = crypto.randomBytes(12);
    const notLast = Buffer.concat([sealMediaBody(me.key, me.id, lt, lbase, csha, {}, changed, 0, 2), sealMediaBlock(me.key, me.id, lt, lbase, csha, 3, false, changed.subarray(2 * MEDIA_BLOCK))]);
    assert.deepEqual(coded(await put(me, changed, { t: lt, base: lbase, body: notLast })), [200, 400, "device.bad"]);
    // a block past the last (no length said, the body read as it comes): refused, the file's blocks kept — then sent
    // with From = N (the meta block alone), delivered
    const xt = Date.now();
    const xbase = crypto.randomBytes(12);
    const past = Buffer.concat([sealMediaBody(me.key, me.id, xt, xbase, csha, {}, changed), sealMediaBlock(me.key, me.id, xt, xbase, csha, 4, false, Buffer.alloc(1000))]);
    const over = await put(me, changed, { t: xt, base: xbase, body: past, chunked: true });
    assert.deepEqual([...coded(over), over.data.params], [200, 400, "device.bad", { have: "3" }]);
    assert.deepEqual((await kept(me, csha)).data, { sha: csha, size: changed.length, have: 3 });
    const deliver = await put(me, changed, { from: 3 });
    assert.deepEqual([deliver.status, deliver.s, deliver.data?.sha], [200, 200, csha], JSON.stringify(deliver.data));
    assert.deepEqual(await bytesOf(csha), changed);
    step("a file not of its hash");
    // a file not of its hash: nothing kept
    const liar = pdf(30_000, 9);
    const lsha = sha256(pdf(30_000, 10));
    assert.deepEqual(coded(await put(me, liar, { sha: lsha })), [200, 409, "media.hash"]);
    assert.deepEqual((await kept(me, lsha)).data, { sha: lsha, have: 0 });

    step("one file at a time for a row");
    // one file at a time for a row (the icon of its home screen with its device): 429 with Retry-After
    const home = await x(me, { m: "POST", p: "device/home", b: {} });
    const [homeId, homeSecret] = String(home.data.url).split("#home.")[1]!.split(".") as [string, string];
    const icon = await pairWith(homeId, homeSecret, "Ikona Lhotáků");
    const slow = pdf(2 * MEDIA_BLOCK + 1000, 11);
    const ssha = sha256(slow);
    const sTime = Date.now();
    const sBase = crypto.randomBytes(12);
    const sBody = sealMediaBody(me.key, me.id, sTime, sBase, ssha, {}, slow);
    const held = http.request(`${address}/device/media/${ssha}`, { method: "PUT", agent: false, signal: signal(), headers: { ...ORIGIN, "Content-Type": "application/octet-stream", "Content-Length": String(sBody.length), "X-Strom-Device": me.id, "X-Strom-Time": String(sTime), "X-Strom-Nonce": b64url(sBase), "X-Strom-Tree": tree, "X-Strom-Size": String(slow.length), "X-Strom-From": "0" } });
    const first = new Promise<Answer>((resolve, reject) => {
      held.on("response", (res) => {
        const parts: Buffer[] = [];
        res.on("data", (ch: Buffer) => parts.push(ch));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(parts), json: JSON.parse(Buffer.concat(parts).toString("utf8")), headers: res.headers }));
      });
      held.on("error", reject);
    });
    open.push(held);
    held.write(sBody.subarray(0, MEDIA_META + MEDIA_TAG + MEDIA_BLOCK + MEDIA_TAG));
    await until("the first block taken", () => fs.existsSync(uploadFiles(w.env, me.id, ssha).note) && JSON.parse(fs.readFileSync(uploadFiles(w.env, me.id, ssha).note, "utf8")).blocks === 1, { ms: 20_000 });
    for (const dev of [me, icon]) {
      const busy = await put(dev, pdf(20_000, 12));
      assert.deepEqual(coded(busy), [200, 429, "device.busy"], dev.id);
      assert.equal(busy.h?.["Retry-After"], "5");
    }
    // another device's row is not held
    assert.equal((await put(other, pdf(20_000, 13))).s, 200);
    held.end(sBody.subarray(MEDIA_META + MEDIA_TAG + MEDIA_BLOCK + MEDIA_TAG));
    const firstDone = await first;
    const opened = openResponse(me.key, me.id, b64url(sBase), firstDone.json)!;
    assert.equal(opened.s, 200);
    assert.deepEqual(await bytesOf(ssha), slow);
    assert.equal((await put(icon, pdf(20_000, 12))).s, 200, "free again");

    // answered before the body came whole (a file over the limit, told once the meta block opened, 32 MiB still to
    // come on a connection the device keeps open): told at once while it is still sending, the rest read and thrown
    // away — but not all of it: past a few blocks the gateway ends the connection, never held open for a body nobody
    // takes (before, it read every byte)
    step("an answer before the body came whole: the rest thrown away, not all of it");
    const huge = pdf(32 * MEDIA_BLOCK + 500, 19);
    const ht = Date.now();
    const hbase = crypto.randomBytes(12);
    const hbody = sealMediaBody(me.key, me.id, ht, hbase, sha256(huge), {}, huge);
    const cutReq = http.request(`${address}/device/media/${sha256(huge)}`, { method: "PUT", agent: keepAlive, signal: signal(), headers: { ...ORIGIN, "Content-Type": "application/octet-stream", "Content-Length": String(hbody.length), "X-Strom-Device": me.id, "X-Strom-Time": String(ht), "X-Strom-Nonce": b64url(hbase), "X-Strom-Tree": tree, "X-Strom-Size": String(huge.length), "X-Strom-From": "0" } });
    open.push(cutReq);
    let sentWhole = false;
    let socketOf: net.Socket | undefined;
    cutReq.on("finish", () => (sentWhole = true));
    cutReq.on("socket", (so) => (socketOf = so));
    const cutAnswer = new Promise<Answer>((resolve, reject) => {
      cutReq.on("response", (res) => {
        const parts: Buffer[] = [];
        res.on("data", (ch: Buffer) => parts.push(ch));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(parts), json: JSON.parse(Buffer.concat(parts).toString("utf8")), headers: res.headers }));
      });
      // (once answered, the connection ended under the rest is what is asked for)
      cutReq.on("error", reject);
    });
    cutReq.end(hbody);
    const cutGot = await cutAnswer;
    const cutOpened = openResponse(me.key, me.id, b64url(hbase), cutGot.json)!;
    assert.deepEqual([cutGot.status, cutOpened.s, JSON.parse(responseBody(cutOpened)!.toString("utf8")).code], [200, 413, "media.large"]);
    await until("the connection ended by the gateway", () => !!socketOf && (socketOf.destroyed || socketOf.readyState === "closed"), { ms: 20_000 });
    assert.equal(sentWhole, false, "the connection ended before the whole body went");
    assert.deepEqual(filesIn(path.join(uploads, me.id)), [], "nothing of it kept");

    step("a device unpaired by itself");
    // a device unpaired: its parts gone with it, its next file 401
    const gone = pdf(MEDIA_BLOCK + 10, 14);
    const gsha = sha256(gone);
    assert.deepEqual((await put(other, gone, { to: 1 })).data, { sha: gsha, have: 1, size: gone.length });
    assert.ok(fs.existsSync(uploadFiles(w.env, other.id, gsha).part));
    assert.equal((await x(other, { m: "POST", p: "device/unpair", b: {} })).s, 200);
    assert.ok(!fs.existsSync(path.join(uploads, other.id)), "its parts gone");
    assert.deepEqual(coded(await put(other, gone, { from: 1 })), [401, undefined, "device.unpaired"]);
    // nothing of a device anywhere but its own folder of device-uploads
    for (const p of filesIn(uploads)) assert.match(p, /^dv_[a-z2-7]{16}(\/[0-9a-f]{64}\.(part|json))?$/u, p);

    // ——— a request's body gzipped in the tunnel (z) ———
    step("a request's body gzipped in the tunnel");
    const gzBatch = "lhota-gzip-2026";
    const one2 = pdf(20_000, 16);
    assert.equal((await put(me, one2, { meta: { "X-Strom-Batch": gzBatch, "X-Strom-Name": "gz.pdf" } })).s, 200);
    const body = Buffer.from(JSON.stringify({ name: "Krabice · Лхота · Lhoták".normalize("NFD"), files: 1, person: "P0001", note: "x".repeat(5000) }));
    const gz = await x(me, { m: "POST", p: `batch/${gzBatch}/done`, h: { "Content-Type": "application/json" }, b64: b64url(zlib.gzipSync(body)), z: "gzip" });
    assert.equal(gz.s, 200, JSON.stringify(gz.data));
    // judged as what it is once unpacked: a question taken away is still the computer's
    const sorted = await x(me, { m: "POST", p: "settings/run", h: { "Content-Type": "application/json" }, b64: b64url(zlib.gzipSync(Buffer.from(JSON.stringify({ confirm: "no" })))), z: "gzip" });
    assert.deepEqual([sorted.s, sorted.data.code], [403, "device.computer-only"]);
    const notGzip = await x(me, { m: "POST", p: `batch/${gzBatch}/done`, b64: b64url(Buffer.from("{}")), z: "gzip" });
    assert.deepEqual([notGzip.s, notGzip.data.code], [400, "device.body"]);
    const bomb = await x(me, { m: "POST", p: `batch/${gzBatch}/done`, b64: b64url(zlib.gzipSync(Buffer.alloc(200 * 1024 * 1024 + 1), { level: 9 })), z: "gzip" });
    assert.deepEqual([bomb.s, bomb.data.code, bomb.data.max], [413, "device.large", 200 * 1024 * 1024]);
    // z with no b64, or another z: no request
    assert.deepEqual([(await x(me, { m: "POST", p: `batch/${gzBatch}/done`, b: {}, z: "gzip" } as never)).status], [400]);

    step("unpaired on the computer, its parts swept");
    // unpaired on the computer (the bridge: the device's row, its icon with it): swept by the gateway's tick
    const lost = pdf(MEDIA_BLOCK + 10, 15);
    assert.equal((await put(icon, lost, { to: 1 })).data.have, 1);
    assert.equal((await put(me, lost, { to: 1 })).data.have, 1);
    assert.ok(fs.existsSync(path.join(uploads, icon.id)) && fs.existsSync(path.join(uploads, me.id)));
    const removed = await request("DELETE", `${bridge.url}/phone/devices/${me.id}`, undefined, APP);
    assert.equal(removed.status, 200, removed.body.toString());
    await until("the row's parts swept", () => !fs.existsSync(path.join(uploads, icon.id)) && !fs.existsSync(path.join(uploads, me.id)), { ms: 20_000 });
    assert.deepEqual(coded(await put(me, lost, { from: 1 })), [401, undefined, "device.unpaired"]);

    // turned off: nothing of it there
    step("turned off");
    await w.ok(["config", "set", "devices.mode", "off"], { tty: true });
    const offPut = await put(me, plain);
    assert.deepEqual([offPut.status, offPut.json.code], [404, "device.disabled"]);
    await w.ok(["phone", "off"]);
    await w.ok(["live", "stop"]);
  } catch (e) {
    // the step it failed at, named
    if (e instanceof Error && !e.message.startsWith("[")) {
      const was = e.message;
      e.message = `[${at.name}] ${was}`;
      if (e.stack) e.stack = e.stack.replace(was, e.message);
    }
    throw e;
  } finally {
    // nothing of the test left: its requests, the step's budget, the bridge and the phone's server, its servers
    clearTimeout(at.timer);
    at.ctl.abort(new Error("the test ended"));
    for (const r of open) r.destroy();
    keepAlive.destroy();
    if (standInFile) fs.rmSync(standInFile, { force: true });
    w.cleanup();
    for (const s of [site, fake])
      await new Promise<void>((ok) => {
        s.closeAllConnections();
        s.close(() => ok());
      });
  }
});
