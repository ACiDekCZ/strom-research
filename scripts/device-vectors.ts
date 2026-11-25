// Writes test/fixtures/device-crypto.json: the test vectors of the devices' pairing and encryption (src/core/devices.ts)
// from fixed inputs, with Node's own HKDF, HMAC and ChaCha20-Poly1305. The Strom app copies them into its tests (its
// @noble code must give the same bytes); test/unit/device-crypto.test.ts checks strom gives them still.
//   node scripts/device-vectors.ts

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { b64url, deviceKey, DEVICE_PROTOCOL, eventAad, eventsMessage, eventsProof, MEDIA_BLOCK, MEDIA_TAG, mediaAad, mediaBlockLength, mediaBlockNonce, mediaBlocks, mediaBodyLength, mediaMeta, pairAad, pairProof, requestAad, responseAad, responseOf, seal, sealMediaBlock, type DeviceRequest, type DeviceResponse, type PairAnswer, type StreamEvent } from "../src/core/devices.ts";

/** Fixed bytes of a label (the same every time the vectors are written). */
const bytes = (label: string, n: number) => crypto.createHash("sha256").update(`strom-device vectors: ${label}`).digest().subarray(0, n);

const out: Record<string, unknown> = {
  about: `Test vectors of ${DEVICE_PROTOCOL}: the pairing (HKDF-SHA256, HMAC-SHA256) and ChaCha20-Poly1305 (RFC 8439) of the Strom app on another device and strom's gateway. Written by scripts/device-vectors.ts with Node's crypto from fixed inputs. Bytes are base64url without padding; "aad" and "plain" of the envelopes are UTF-8 text; "sealed" and "c" are the ciphertext with its 16-byte tag after it.`,
  protocol: DEVICE_PROTOCOL,
};

// the key of a pairing and its proof
const secret = bytes("secret", 32);
const pairId = b64url(bytes("pairId", 16));
const key = deviceKey(secret, pairId);
out.hkdf = [{ secret: b64url(secret), pairId, info: DEVICE_PROTOCOL, key: b64url(key) }];
out.proof = [{ key: b64url(key), pairId, message: `pair|${pairId}`, proof: pairProof(key, pairId) }];

// ChaCha20-Poly1305 of texts of several lengths and scripts
const texts: [string, Buffer][] = [
  ["empty", Buffer.alloc(0)],
  ["1 byte", Buffer.from([0x2a])],
  ["63 bytes", Buffer.concat([bytes("63a", 32), bytes("63b", 31)])],
  ["64 bytes", Buffer.concat([bytes("64a", 32), bytes("64b", 32)])],
  ["65 bytes", Buffer.concat([bytes("65a", 32), bytes("65b", 32), bytes("65c", 1)])],
  ["1 KiB", Buffer.concat(Array.from({ length: 32 }, (_, i) => bytes(`1k ${i}`, 32)))],
  ["diacritics and emoji", Buffer.from("Příliš žluťoučký kůň úpěl ďábelské ódy — Lhoták z Lhoty 👨‍👩‍👧 🌳", "utf8")],
  ["non-Latin scripts", Buffer.from("Генеалогия семьи · Γενεαλογία · 家系図 · שושלת", "utf8")],
];
out.aead = texts.map(([name, plain], i) => {
  const k = bytes(`aead key ${i}`, 32);
  const nonce = bytes(`aead nonce ${i}`, 12);
  const aad = `${DEVICE_PROTOCOL}|vector|${i}`;
  return { name, key: b64url(k), nonce: b64url(nonce), aad, plain: b64url(plain), sealed: b64url(seal(k, nonce, Buffer.from(aad, "utf8"), plain)) };
});

// one request through the tunnel (POST /device/x)
const deviceId = "dv_abcdefghijklmnop";
const t = 1764000000000;
const request: DeviceRequest = { m: "POST", p: "waiting/T0001", tree: "Lhotákovi", q: { lang: "cs" }, h: { "X-Strom-App-Version": "3.33.0" }, b: { do: "answer", text: "Matrika Lhota, sv. 3 — přečteno" } };
const reqNonce = bytes("request nonce", 12);
const reqPlain = JSON.stringify(request);
out.request = {
  key: b64url(key),
  d: deviceId,
  t,
  aad: requestAad(deviceId, t).toString("utf8"),
  request,
  plain: reqPlain,
  envelope: { v: 1, d: deviceId, t, n: b64url(reqNonce), c: b64url(seal(key, reqNonce, requestAad(deviceId, t), Buffer.from(reqPlain, "utf8"))) },
};

// its answers: a short body as it is, a long one gzipped (z: "gzip"; the bytes inside are gzip's, whatever its level)
const answer = (name: string, status: number, headers: Record<string, string>, body: Buffer, i: number) => {
  const response: DeviceResponse = responseOf(status, headers, body);
  const plain = JSON.stringify(response);
  const nonce = bytes(`response nonce ${i}`, 12);
  const n = b64url(reqNonce);
  return { name, key: b64url(key), d: deviceId, requestNonce: n, aad: responseAad(deviceId, n).toString("utf8"), body: b64url(body), plain, envelope: { v: 1, n: b64url(nonce), c: b64url(seal(key, nonce, responseAad(deviceId, n), Buffer.from(plain, "utf8"))) } };
};
const long = Buffer.from(JSON.stringify({ people: Array.from({ length: 40 }, (_, i) => ({ id: `P${String(i + 1).padStart(4, "0")}`, name: `Jan Lhoták ${i + 1}`, place: "Lhota" })) }), "utf8");
out.response = [
  answer("as it is", 200, { "Content-Type": "application/json; charset=utf-8" }, Buffer.from(JSON.stringify({ ok: true, waiting: "T0001" }), "utf8"), 0),
  answer("gzipped", 200, { "Content-Type": "application/json; charset=utf-8" }, long, 1),
];
if (!(out.response as { plain: string }[])[1]!.plain.includes('"z":"gzip"')) throw new Error("the long body was not gzipped");
// the gzip inside unpacks to the body (checked here once more)
const gz = JSON.parse((out.response as { plain: string }[])[1]!.plain) as DeviceResponse;
if (!zlib.gunzipSync(Buffer.from(gz.b!, "base64url")).equals(long)) throw new Error("gzip");

// the answer to a pairing
const pairAnswer: PairAnswer = { device: { id: deviceId, name: "iPhone · Safari", kind: "phone" }, computer: { name: "Pracovna" }, trees: [{ name: "Lhotákovi" }] };
const pairNonce = bytes("pair nonce", 12);
const pairPlain = JSON.stringify(pairAnswer);
out.pair = { key: b64url(key), pairId, aad: pairAad(pairId).toString("utf8"), answer: pairAnswer, plain: pairPlain, envelope: { v: 1, n: b64url(pairNonce), c: b64url(seal(key, pairNonce, pairAad(pairId), Buffer.from(pairPlain, "utf8"))) } };

// the stream of events (GET /device/events): the proof in its query, its events sealed one after another — the order
// (from 0) in the AAD; the second event opened as the first does not open
const streamNonce = b64url(bytes("events nonce", 12));
const eventsTree = "tr_lhotakovi";
const eventsApp = "3.33.0";
const streamed: StreamEvent[] = [
  { event: "device", data: { type: "device", what: "renamed", id: deviceId, name: "Telefon Lhotáků · Лхота", kind: "phone", at: "2025-11-24T16:00:00.000Z" } },
  { event: "change", data: { head: "0123456789abcdef0123456789abcdef01234567", what: ["person P0001: Jan Lhoták"], at: "2025-11-24T16:00:05.000Z", entries: [] } },
];
out.events = {
  key: b64url(key),
  d: deviceId,
  t,
  n: streamNonce,
  tree: eventsTree,
  app: eventsApp,
  message: eventsMessage(t, streamNonce, eventsTree, eventsApp),
  a: eventsProof(key, t, streamNonce, eventsTree, eventsApp),
  messageWithoutApp: eventsMessage(t, streamNonce, eventsTree),
  aWithoutApp: eventsProof(key, t, streamNonce, eventsTree),
  sealed: streamed.map((ev, seq) => {
    const nonce = bytes(`event nonce ${seq}`, 12);
    const plain = JSON.stringify(ev);
    const sealed = { n: b64url(nonce), c: b64url(seal(key, nonce, eventAad(deviceId, streamNonce, seq), Buffer.from(plain, "utf8"))) };
    return { seq, aad: eventAad(deviceId, streamNonce, seq).toString("utf8"), event: ev, plain, sealed, line: `data: ${JSON.stringify(sealed)}` };
  }),
};

// refused: one byte changed (of the ciphertext, of the tag), another AAD, another key
const base = (out.aead as { key: string; nonce: string; aad: string; sealed: string }[])[4]!;
const flip = (s: string, at: number) => {
  const b = Buffer.from(s, "base64url");
  b[at] = b[at]! ^ 0x01;
  return b64url(b);
};
out.negative = [
  { name: "a byte of the ciphertext changed", key: base.key, nonce: base.nonce, aad: base.aad, sealed: flip(base.sealed, 10) },
  { name: "a byte of the tag changed", key: base.key, nonce: base.nonce, aad: base.aad, sealed: flip(base.sealed, Buffer.from(base.sealed, "base64url").length - 1) },
  { name: "another AAD", key: base.key, nonce: base.nonce, aad: `${base.aad}x`, sealed: base.sealed },
  { name: "another key", key: b64url(bytes("another key", 32)), nonce: base.nonce, aad: base.aad, sealed: base.sealed },
];

// a large file in blocks (PUT /device/media/<sha256>): the meta block (index 0, its JSON filled up with spaces to 4096
// bytes), then the file's blocks of 1 MiB (the last what is left), each sealed of its own — its nonce the base with its
// index XORed into the last 4 bytes (big-endian), its AAD strom-device/1|<d>|<t>|media|<sha>|<i>|<1 for the last block>
const mediaBase = bytes("media nonce", 12);
const mediaFile = Buffer.alloc(MEDIA_BLOCK + 1000);
for (let j = 0; j < mediaFile.length; j++) mediaFile[j] = (j * 31 + 7) & 255;
const mediaSha = crypto.createHash("sha256").update(mediaFile).digest("hex");
const mediaHeaders = { "X-Strom-Name": encodeURIComponent("Matrika Lhota — křest, Лхота.jpg"), "X-Strom-Person": "P0001", Prefer: "respond-async" };
const metaPlain = mediaMeta(mediaHeaders)!;
const mediaN = mediaBlocks(mediaFile.length);
const sealedBlocks = Array.from({ length: mediaN }, (_, k) => {
  const i = k + 1;
  return sealMediaBlock(key, deviceId, t, mediaBase, mediaSha, i, i === mediaN, mediaFile.subarray((i - 1) * MEDIA_BLOCK, i * MEDIA_BLOCK));
});
const lastPlain = mediaFile.subarray((mediaN - 1) * MEDIA_BLOCK);
out.media = {
  about: "PUT /device/media/<sha>: open headers X-Strom-Device, X-Strom-Time, X-Strom-Nonce (the base), X-Strom-Tree, X-Strom-Size, X-Strom-From; the body the sealed meta block and the sealed blocks From+1…N one after another (no framing: each block's length follows from Size).",
  key: b64url(key),
  d: deviceId,
  t,
  base: b64url(mediaBase),
  file: { size: mediaFile.length, byte: "byte j = (j * 31 + 7) & 255", sha256: mediaSha },
  block: MEDIA_BLOCK,
  blocks: mediaN,
  headers: { "X-Strom-Device": deviceId, "X-Strom-Time": String(t), "X-Strom-Nonce": b64url(mediaBase), "X-Strom-Tree": "tr_lhotakovi", "X-Strom-Size": String(mediaFile.length), "X-Strom-From": "0" },
  bodyLength: mediaBodyLength(mediaFile.length, 0),
  meta: {
    i: 0,
    nonce: b64url(mediaBlockNonce(mediaBase, 0)),
    aad: mediaAad(deviceId, t, mediaSha, 0, false).toString("utf8"),
    json: JSON.stringify({ h: mediaHeaders }),
    plainLength: metaPlain.length,
    fill: "spaces (0x20) after the JSON up to 4096 bytes",
    sealed: b64url(sealMediaBlock(key, deviceId, t, mediaBase, mediaSha, 0, false, metaPlain)),
  },
  data: sealedBlocks.map((s, k) => {
    const i = k + 1;
    return {
      i,
      last: i === mediaN,
      nonce: b64url(mediaBlockNonce(mediaBase, i)),
      aad: mediaAad(deviceId, t, mediaSha, i, i === mediaN).toString("utf8"),
      plainLength: mediaBlockLength(mediaFile.length, i),
      tag: b64url(s.subarray(s.length - MEDIA_TAG)),
      sealedSha256: crypto.createHash("sha256").update(s).digest("hex"),
      ...(i === mediaN ? { sealed: b64url(s) } : {}),
    };
  }),
  negative: [
    { name: "the last block sealed with last 0 (as if more came)", i: mediaN, nonce: b64url(mediaBlockNonce(mediaBase, mediaN)), aad: mediaAad(deviceId, t, mediaSha, mediaN, true).toString("utf8"), sealed: b64url(sealMediaBlock(key, deviceId, t, mediaBase, mediaSha, mediaN, false, lastPlain)) },
    { name: "blocks swapped: the last block sent first (opened as block 1)", i: 1, nonce: b64url(mediaBlockNonce(mediaBase, 1)), aad: mediaAad(deviceId, t, mediaSha, 1, false).toString("utf8"), sealed: b64url(sealedBlocks[mediaN - 1]!) },
  ],
};

// a request through the tunnel with its body gzipped (z: "gzip", b64 gzip's bytes of any level): the gateway unpacks it
// (at most 200 MiB) before anything else and carries the body unpacked — the vector keeps what the device means and
// what the bridge gets, not gzip's bytes
const gzBody = Buffer.from(`0 HEAD\n1 CHAR UTF-8\n${Array.from({ length: 30 }, (_, i) => `0 @I${i + 1}@ INDI\n1 NAME Jan /Lhoták/\n2 GIVN Jan\n1 BIRT\n2 PLAC Lhota · Лхота\n`).join("")}0 TRLR\n`, "utf8");
const gzRequest: DeviceRequest = { m: "POST", p: "sync", tree: "tr_lhotakovi", h: { "Content-Type": "text/plain; charset=utf-8" }, b64: b64url(zlib.gzipSync(gzBody)), z: "gzip" };
out.requestGzip = {
  about: 'POST /device/x with {"z": "gzip"}: "b64" is the body gzipped (any level), base64url. The gateway unpacks it (at most 200 MiB: past it 413 device.large, not gzip 400 device.body, both sealed) and carries the body unpacked; z only with b64.',
  key: b64url(key),
  d: deviceId,
  t,
  aad: requestAad(deviceId, t).toString("utf8"),
  request: { ...gzRequest, b64: "<gzip of body, base64url>" },
  body: gzBody.toString("utf8"),
  bodyLength: gzBody.length,
  bodySha256: crypto.createHash("sha256").update(gzBody).digest("hex"),
  carried: { method: "POST", path: "sync", contentType: "text/plain; charset=utf-8", bytes: gzBody.length },
};


const file = path.join(import.meta.dirname, "..", "test", "fixtures", "device-crypto.json");
fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
console.log(`written: ${path.relative(process.cwd(), file)}`);
