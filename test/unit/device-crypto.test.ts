// The devices' pairing and encryption (src/core/devices.ts) give the vectors of test/fixtures/device-crypto.json byte by
// byte — the ones the Strom app's own code is checked against — and Node's primitives the RFCs' own vectors (an
// independent check: a vector written wrong by strom itself would not pass these).

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import {
  b64url,
  deviceKey,
  eventAad,
  eventsMessage,
  eventsProof,
  eventsProofHolds,
  fromB64url,
  MEDIA_BLOCK,
  MEDIA_META,
  MEDIA_TAG,
  mediaAad,
  mediaBlockLength,
  mediaBlockNonce,
  mediaBlocks,
  mediaBodyLength,
  mediaMeta,
  open,
  openMediaBlock,
  openEvent,
  openPair,
  openRequest,
  openResponse,
  pairAad,
  pairProof,
  parseMediaMeta,
  parseRequestEnvelope,
  proofHolds,
  requestAad,
  responseAad,
  responseBody,
  responseOf,
  seal,
  sealEvent,
  sealMediaBlock,
  sealMediaBody,
  sealPair,
  sealRequest,
  sealResponse,
  type DeviceResponse,
} from "../../src/core/devices.ts";

const V = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "fixtures", "device-crypto.json"), "utf8"));
const b = (s: string) => Buffer.from(s, "base64url");
const t8 = (s: string) => Buffer.from(s, "utf8");

test("RFC 8439 §2.8.2: ChaCha20-Poly1305 as the RFC gives it", () => {
  const key = Buffer.from("808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f", "hex");
  const nonce = Buffer.from("070000004041424344454647", "hex");
  const aad = Buffer.from("50515253c0c1c2c3c4c5c6c7", "hex");
  const plain = t8("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.");
  const want =
    "d31a8d34648e60db7b86afbc53ef7ec2a4aded51296e08fea9e2b5a736ee62d63dbea45e8ca9671282fafb69da92728b1a71de0a9e060b2905d6a5b67ecd3b3692ddbd7f2d778b8c9803aee328091b58fab324e4fad675945585808b4831d7bc3ff4def08e4b7a9de576d26586cec64b6116" +
    "1ae10b594f09e26a7e902ecbd0600691";
  assert.equal(seal(key, nonce, aad, plain).toString("hex"), want);
  assert.deepEqual(open(key, nonce, aad, Buffer.from(want, "hex")), plain);
});

test("RFC 5869 A.1 and RFC 4231 4.2: HKDF-SHA256 and HMAC-SHA256 of Node as the RFCs give them", () => {
  const okm = crypto.hkdfSync("sha256", Buffer.alloc(22, 0x0b), Buffer.from("000102030405060708090a0b0c", "hex"), Buffer.from("f0f1f2f3f4f5f6f7f8f9", "hex"), 42);
  assert.equal(Buffer.from(okm).toString("hex"), "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865");
  assert.equal(crypto.createHmac("sha256", Buffer.alloc(20, 0x0b)).update("Hi There").digest("hex"), "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
});

test("the vectors: the key of a pairing and its proof", () => {
  for (const h of V.hkdf) assert.equal(b64url(deviceKey(b(h.secret), h.pairId)), h.key);
  for (const p of V.proof) {
    assert.equal(p.message, `pair|${p.pairId}`);
    assert.equal(pairProof(b(p.key), p.pairId), p.proof);
    assert.ok(proofHolds(b(p.key), p.pairId, p.proof));
    assert.ok(!proofHolds(b(p.key), p.pairId, `${p.proof.slice(0, -2)}AA`));
    assert.ok(!proofHolds(b(p.key), `${p.pairId.slice(0, -1)}${p.pairId.endsWith("x") ? "y" : "x"}`, p.proof));
  }
});

test("the vectors: ChaCha20-Poly1305 of every length and script, both ways", () => {
  assert.ok(V.aead.length >= 6);
  const names = V.aead.map((a: { name: string }) => a.name);
  for (const n of ["empty", "1 byte", "63 bytes", "64 bytes", "65 bytes", "1 KiB", "diacritics and emoji", "non-Latin scripts"]) assert.ok(names.includes(n), n);
  for (const a of V.aead) {
    assert.equal(b64url(seal(b(a.key), b(a.nonce), t8(a.aad), b(a.plain))), a.sealed, a.name);
    assert.deepEqual(open(b(a.key), b(a.nonce), t8(a.aad), b(a.sealed)), b(a.plain), a.name);
    assert.equal(b(a.sealed).length, b(a.plain).length + 16, a.name);
  }
  // the texts as they are: NFC, any script
  const text = (n: string) => b(V.aead.find((a: { name: string }) => a.name === n).plain).toString("utf8");
  assert.match(text("diacritics and emoji"), /žluťoučký.*🌳/u);
  assert.equal(text("diacritics and emoji"), text("diacritics and emoji").normalize("NFC"));
  assert.match(text("non-Latin scripts"), /\p{Script=Cyrillic}.*\p{Script=Greek}.*\p{Script=Han}.*\p{Script=Hebrew}/u);
});

test("the vectors: refused — a byte changed, another AAD, another key", () => {
  assert.ok(V.negative.length >= 1);
  for (const x of V.negative) assert.equal(open(b(x.key), b(x.nonce), t8(x.aad), b(x.sealed)), undefined, x.name);
});

test("the vectors: a request through the tunnel", () => {
  const r = V.request;
  assert.equal(r.aad, `strom-device/1|${r.d}|${r.t}|req`);
  assert.equal(r.plain, JSON.stringify(r.request));
  assert.deepEqual(sealRequest(b(r.key), r.d, r.t, r.request, b(r.envelope.n)), r.envelope);
  const env = parseRequestEnvelope(r.envelope);
  assert.ok(env);
  assert.deepEqual(openRequest(b(r.key), env), r.request);
  assert.deepEqual(open(b(r.key), b(r.envelope.n), requestAad(r.d, r.t), b(r.envelope.c)), t8(r.plain));
  // another time, another device, another key: nothing opens
  assert.equal(openRequest(b(r.key), { ...env, t: r.t + 1 }), undefined);
  assert.equal(openRequest(b(r.key), { ...env, d: "dv_bbbbbbbbbbbbbbbb" }), undefined);
  assert.equal(openRequest(crypto.randomBytes(32), env), undefined);
});

test("the vectors: the answers — as they are and gzipped", () => {
  for (const r of V.response) {
    assert.equal(r.aad, `strom-device/1|${r.d}|${r.requestNonce}|res`);
    assert.deepEqual(open(b(r.key), b(r.envelope.n), responseAad(r.d, r.requestNonce), b(r.envelope.c)), t8(r.plain), r.name);
    assert.equal(b64url(seal(b(r.key), b(r.envelope.n), t8(r.aad), t8(r.plain))), r.envelope.c, r.name);
    const opened = openResponse(b(r.key), r.d, r.requestNonce, r.envelope);
    assert.ok(opened, r.name);
    assert.deepEqual(responseBody(opened), b(r.body), r.name);
    // the answer of another request: refused
    assert.equal(openResponse(b(r.key), r.d, b64url(crypto.randomBytes(12)), r.envelope), undefined);
  }
  const [plain, gz] = V.response;
  assert.equal(JSON.parse(plain.plain).z, undefined);
  assert.equal(JSON.parse(gz.plain).z, "gzip");
  // what does not depend on gzip's bytes is written the same by strom now
  const as = JSON.parse(plain.plain) as DeviceResponse;
  assert.deepEqual(sealResponse(b(plain.key), plain.d, plain.requestNonce, responseOf(as.s, as.h, b(plain.body)), b(plain.envelope.n)), plain.envelope);
  // gzipped only past 1 KiB, and never when the request asks identity
  const long = b(gz.body);
  assert.ok(long.length > 1024);
  assert.equal(responseOf(200, {}, long, { identity: true }).z, undefined);
  assert.deepEqual(responseBody(responseOf(200, {}, long)), long);
  assert.equal(responseOf(200, {}, Buffer.alloc(1024)).z, undefined);
  assert.equal(responseOf(200, {}, Buffer.alloc(1025)).z, "gzip");
  assert.equal(responseBody(responseOf(204, {}, null)), null);
});

test("the vectors: the answer to a pairing", () => {
  const p = V.pair;
  assert.equal(p.aad, `strom-device/1|${p.pairId}|pair`);
  assert.equal(p.plain, JSON.stringify(p.answer));
  assert.deepEqual(sealPair(b(p.key), p.pairId, p.answer, b(p.envelope.n)), p.envelope);
  assert.deepEqual(openPair(b(p.key), p.pairId, p.envelope), p.answer);
  assert.deepEqual(open(b(p.key), b(p.envelope.n), pairAad(p.pairId), b(p.envelope.c)), t8(p.plain));
  assert.equal(openPair(b(p.key), `${p.pairId.slice(0, -1)}${p.pairId.endsWith("A") ? "B" : "A"}`, p.envelope), undefined);
  // the key of the hkdf vector is the pairing's
  assert.equal(p.key, V.hkdf[0].key);
});

test("the vectors: the stream of events — the proof of its query, each event sealed in its order", () => {
  const e = V.events;
  const key = b(e.key);
  // the proof: HMAC-SHA256(K, "events|t|n|tree|app"), the app's version left empty when not said
  assert.equal(e.message, `events|${e.t}|${e.n}|${e.tree}|${e.app}`);
  assert.equal(e.messageWithoutApp, `events|${e.t}|${e.n}|${e.tree}|`);
  assert.equal(eventsMessage(e.t, e.n, e.tree, e.app), e.message);
  assert.equal(eventsProof(key, e.t, e.n, e.tree, e.app), e.a);
  assert.equal(eventsProof(key, e.t, e.n, e.tree), e.aWithoutApp);
  assert.equal(crypto.createHmac("sha256", key).update(e.message, "utf8").digest("base64url"), e.a);
  assert.ok(eventsProofHolds(key, e.t, e.n, e.tree, e.app, e.a));
  // anything of the query changed, another key, a proof of another shape: refused
  for (const [t, n, tree, app, a] of [
    [e.t + 1, e.n, e.tree, e.app, e.a],
    [e.t, b64url(crypto.randomBytes(12)), e.tree, e.app, e.a],
    [e.t, e.n, `${e.tree}x`, e.app, e.a],
    [e.t, e.n, e.tree, undefined, e.a],
    [e.t, e.n, e.tree, e.app, e.aWithoutApp],
    [e.t, e.n, e.tree, e.app, `${e.a}A`],
    [e.t, e.n, e.tree, e.app, 42],
  ] as const)
    assert.equal(eventsProofHolds(key, t, n, tree, app, a), false, `${t} ${n} ${tree} ${app} ${a}`);
  assert.equal(eventsProofHolds(crypto.randomBytes(32), e.t, e.n, e.tree, e.app, e.a), false);
  for (const s of e.sealed) {
    assert.equal(s.aad, `strom-device/1|${e.d}|${e.n}|event|${s.seq}`);
    assert.deepEqual(eventAad(e.d, e.n, s.seq), t8(s.aad));
    assert.equal(s.plain, JSON.stringify(s.event));
    assert.equal(s.line, `data: ${JSON.stringify(s.sealed)}`);
    assert.deepEqual(sealEvent(key, e.d, e.n, s.seq, s.event, b(s.sealed.n)), s.sealed);
    assert.deepEqual(open(key, b(s.sealed.n), t8(s.aad), b(s.sealed.c)), t8(s.plain));
    assert.deepEqual(openEvent(key, e.d, e.n, s.seq, s.sealed), s.event);
    // another order (moved, one left out), another stream, another device, another key: nothing opens
    for (const seq of [s.seq + 1, s.seq + 2, s.seq - 1]) assert.equal(openEvent(key, e.d, e.n, seq, s.sealed), undefined, `${s.seq} as ${seq}`);
    assert.equal(openEvent(key, e.d, b64url(crypto.randomBytes(12)), s.seq, s.sealed), undefined);
    assert.equal(openEvent(key, "dv_bbbbbbbbbbbbbbbb", e.n, s.seq, s.sealed), undefined);
    assert.equal(openEvent(crypto.randomBytes(32), e.d, e.n, s.seq, s.sealed), undefined);
  }
  // the two swapped: neither opens where the other was
  const [first, second] = e.sealed;
  assert.equal(openEvent(key, e.d, e.n, 0, second.sealed), undefined);
  assert.equal(openEvent(key, e.d, e.n, 1, first.sealed), undefined);
  // the key of the hkdf vector is the stream's
  assert.equal(e.key, V.hkdf[0].key);
});

test("the vectors: a large file in blocks — the meta block, each block's nonce, AAD and tag, the last block whole", () => {
  const m = V.media;
  const key = b(m.key);
  const base = b(m.base);
  // the file the vector is of, from its formula, and its hash
  const file = Buffer.alloc(m.file.size);
  for (let j = 0; j < file.length; j++) file[j] = (j * 31 + 7) & 255;
  assert.equal(m.file.byte, "byte j = (j * 31 + 7) & 255");
  assert.equal(crypto.createHash("sha256").update(file).digest("hex"), m.file.sha256);
  assert.equal(m.block, MEDIA_BLOCK);
  assert.equal(m.block, 1048576);
  assert.equal(m.blocks, mediaBlocks(m.file.size));
  assert.equal(m.blocks, 2);
  assert.equal(m.bodyLength, MEDIA_META + MEDIA_TAG + m.file.size + m.blocks * MEDIA_TAG);
  assert.equal(mediaBodyLength(m.file.size, 0), m.bodyLength);
  assert.equal(mediaBodyLength(m.file.size, 1), MEDIA_META + MEDIA_TAG + 1000 + MEDIA_TAG);
  assert.equal(mediaBodyLength(m.file.size, 2), MEDIA_META + MEDIA_TAG);
  // a nonce of a block: the base, its last 4 bytes XOR the index (big-endian) — Node's own bytes
  const xored = (i: number) => {
    const n = Buffer.from(base);
    for (let k = 0; k < 4; k++) n[8 + k] = n[8 + k]! ^ ((i >>> (8 * (3 - k))) & 255);
    return n;
  };
  assert.equal(m.meta.nonce, b64url(xored(0)));
  assert.deepEqual(mediaBlockNonce(base, 0), base);
  assert.equal(m.meta.aad, `strom-device/1|${m.d}|${m.t}|media|${m.file.sha256}|0|0`);
  assert.deepEqual(mediaAad(m.d, m.t, m.file.sha256, 0, false), t8(m.meta.aad));
  // the meta block: its JSON filled up with spaces to 4096 bytes, sealed
  const plain = Buffer.concat([t8(m.meta.json), Buffer.alloc(MEDIA_META - t8(m.meta.json).length, 0x20)]);
  assert.equal(m.meta.plainLength, MEDIA_META);
  assert.deepEqual(mediaMeta(JSON.parse(m.meta.json).h), plain);
  assert.equal(b(m.meta.sealed).length, MEDIA_META + MEDIA_TAG);
  assert.deepEqual(open(key, b(m.meta.nonce), t8(m.meta.aad), b(m.meta.sealed)), plain);
  assert.deepEqual(parseMediaMeta(plain), JSON.parse(m.meta.json).h);
  // each data block: Node's ChaCha20-Poly1305 of its nonce and AAD gives its tag and its bytes
  for (const blk of m.data) {
    const i = blk.i;
    const last = i === m.blocks;
    assert.equal(blk.last, last);
    assert.equal(blk.nonce, b64url(xored(i)));
    assert.equal(blk.aad, `strom-device/1|${m.d}|${m.t}|media|${m.file.sha256}|${i}|${last ? 1 : 0}`);
    assert.equal(blk.plainLength, mediaBlockLength(m.file.size, i));
    const part = file.subarray((i - 1) * MEDIA_BLOCK, i * MEDIA_BLOCK);
    const sealed = seal(key, b(blk.nonce), t8(blk.aad), part);
    assert.deepEqual(sealMediaBlock(key, m.d, m.t, base, m.file.sha256, i, last, part), sealed);
    assert.equal(b64url(sealed.subarray(sealed.length - MEDIA_TAG)), blk.tag);
    assert.equal(crypto.createHash("sha256").update(sealed).digest("hex"), blk.sealedSha256);
    if (blk.sealed) assert.equal(blk.sealed, b64url(sealed));
    assert.deepEqual(openMediaBlock(key, m.d, m.t, base, m.file.sha256, i, last, sealed), part);
    // said last where it is not (or not where it is), another file, another request, another device: nothing opens
    assert.equal(openMediaBlock(key, m.d, m.t, base, m.file.sha256, i, !last, sealed), undefined);
    assert.equal(openMediaBlock(key, m.d, m.t, base, "0".repeat(64), i, last, sealed), undefined);
    assert.equal(openMediaBlock(key, m.d, m.t + 1, base, m.file.sha256, i, last, sealed), undefined);
    assert.equal(openMediaBlock(key, "dv_bbbbbbbbbbbbbbbb", m.t, base, m.file.sha256, i, last, sealed), undefined);
  }
  // the whole body as a device sends it
  const body = sealMediaBody(key, m.d, m.t, base, m.file.sha256, JSON.parse(m.meta.json).h, file);
  assert.equal(body.length, m.bodyLength);
  assert.equal(b64url(body.subarray(0, MEDIA_META + MEDIA_TAG)), m.meta.sealed);
  // refused: the last block said not last, blocks swapped
  assert.equal(m.negative.length, 2);
  for (const neg of m.negative) {
    assert.equal(open(key, b(neg.nonce), t8(neg.aad), b(neg.sealed)), undefined, neg.name);
    assert.equal(openMediaBlock(key, m.d, m.t, base, m.file.sha256, neg.i, neg.i === m.blocks, b(neg.sealed)), undefined, neg.name);
  }
  assert.equal(m.key, V.hkdf[0].key);
});

test("the vectors: a request with its body gzipped — what the bridge gets", () => {
  const g = V.requestGzip;
  const key = b(g.key);
  const body = t8(g.body);
  assert.equal(body.length, g.bodyLength);
  assert.equal(crypto.createHash("sha256").update(body).digest("hex"), g.bodySha256);
  // any gzip of the body (its level, its header's time) opens to the same request and unpacks to the body
  for (const level of [1, 6, 9]) {
    const request = { ...g.request, b64: b64url(zlib.gzipSync(body, { level })) };
    const env = sealRequest(key, g.d, g.t, request);
    const opened = openRequest(key, env);
    assert.equal(opened?.z, "gzip");
    assert.deepEqual(zlib.gunzipSync(b(opened!.b64!)), body);
  }
  // z only with b64; another value of z: not a request
  const n = crypto.randomBytes(12);
  const sealedOf = (r: unknown) => ({ v: 1 as const, d: g.d, t: g.t, n: b64url(n), c: b64url(seal(key, n, requestAad(g.d, g.t), t8(JSON.stringify(r)))) });
  assert.equal(openRequest(key, sealedOf({ m: "POST", p: "sync", tree: "x", b: "abc", z: "gzip" })), undefined);
  assert.equal(openRequest(key, sealedOf({ m: "POST", p: "sync", tree: "x", b64: "AAAA", z: "br" })), undefined);
  assert.equal(g.carried.bytes, g.bodyLength);
});

test("base64url: without padding, one spelling only, the length checked", () => {
  assert.equal(b64url(Buffer.from([0xfb, 0xff])), "-_8");
  assert.deepEqual(fromB64url("-_8"), Buffer.from([0xfb, 0xff]));
  assert.equal(fromB64url("-_8="), undefined, "no padding");
  assert.equal(fromB64url("-_9"), undefined, "stray bits");
  assert.equal(fromB64url("ab+/"), undefined, "base64, not base64url");
  assert.deepEqual(fromB64url("AAAAAAAAAAAAAAAA", 12), Buffer.alloc(12));
  assert.equal(fromB64url("AAAA", 12), undefined);
  assert.equal(open(Buffer.alloc(31), Buffer.alloc(12), Buffer.alloc(0), Buffer.alloc(16)), undefined, "a wrong key length never throws");
  assert.equal(open(Buffer.alloc(32), Buffer.alloc(12), Buffer.alloc(0), Buffer.alloc(3)), undefined, "shorter than its tag");
});

test("the envelope of a request: its shape checked before any key", () => {
  const ok = { v: 1, d: "dv_abcdefghijklmnop", t: 1764000000000, n: b64url(Buffer.alloc(12)), c: b64url(Buffer.alloc(20)) };
  assert.deepEqual(parseRequestEnvelope(ok), ok);
  for (const bad of [null, [], "x", { ...ok, v: 2 }, { ...ok, d: "ph_abc" }, { ...ok, d: "dv_ABCDEFGHIJKLMNOP" }, { ...ok, t: "1" }, { ...ok, t: 1.5 }, { ...ok, n: b64url(Buffer.alloc(11)) }, { ...ok, c: "a+b" }])
    assert.equal(parseRequestEnvelope(bad), undefined, JSON.stringify(bad));
});
