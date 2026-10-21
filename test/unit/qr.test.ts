// The QR code to pair a phone, read back by a reader written apart from the encoder (test/qr-decode.ts): every version
// of 1–10 at its capacity and just past it, as an SVG and in a terminal, any script (a byte is a byte of UTF-8).

import { test } from "node:test";
import assert from "node:assert/strict";
import { QR_MAX_VERSION, qrCapacity, qrMatrix, qrSvg, qrTerminal } from "../../src/core/qr.ts";
import { decodeQr, svgModules, terminalModules } from "../qr-decode.ts";

const bytes = (s: string) => Buffer.byteLength(s, "utf8");

test("a QR code of versions 1–10, level M: what it says read back exactly, as an SVG and in a terminal", () => {
  const seen = new Set<number>();
  for (let v = 1; v <= QR_MAX_VERSION; v++) {
    const cap = qrCapacity(v);
    for (const text of ["http://192.168.1.23:47800/pair?lang=cs#".padEnd(cap, "A").slice(0, cap), "x".repeat(cap)]) {
      assert.equal(bytes(text), cap);
      const fromSvg = decodeQr(svgModules(qrSvg(text)));
      assert.deepEqual([fromSvg.text, fromSvg.version, fromSvg.level], [text, v, "M"]);
      const fromTerminal = decodeQr(terminalModules(qrTerminal(text)));
      assert.deepEqual([fromTerminal.text, fromTerminal.version], [text, v]);
      seen.add(fromSvg.mask);
    }
    // one byte more: the next version
    if (v < QR_MAX_VERSION) assert.equal(decodeQr(svgModules(qrSvg("y".repeat(cap + 1)))).version, v + 1);
    // a matrix of the version's size, the quiet zone apart
    assert.equal(qrMatrix("x".repeat(cap)).length, 17 + 4 * v);
  }
  assert.ok(seen.size > 1, "masks chosen, not one always");
  assert.throws(() => qrSvg("z".repeat(qrCapacity(QR_MAX_VERSION) + 1)));
});

test("a QR code of an address that pairs: the smallest version, any script and accent as UTF-8 (NFC and NFD alike)", () => {
  const url = "http://192.168.100.200:47801/pair?lang=de#AbCdEfGhIjKlMnOpQrStUv";
  assert.equal(decodeQr(svgModules(qrSvg(url))).text, url);
  assert.ok(decodeQr(svgModules(qrSvg(url))).version <= 5, "a camera reads it from far");
  for (const text of ["Žluťoučký kůň", "Žluťoučký kůň".normalize("NFD"), "Łódź · Київ · Ἀθῆναι"]) assert.equal(decodeQr(terminalModules(qrTerminal(text))).text, text);
});

test("the SVG of a QR code: shapes alone — no script, no link, no text; white around it; the terminal black on white", () => {
  const svg = qrSvg("http://10.0.0.5:47800/pair#AbCdEfGhIjKlMnOpQrStUv");
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 (\d+) \1"/);
  assert.doesNotMatch(svg, /script|href|<text|on\w+=|#AbCd/i);
  assert.match(svg, /<rect width="\d+" height="\d+" fill="#fff"\/>/);
  const rows = svgModules(svg);
  assert.ok(rows.slice(0, 4).every((r) => !r.includes(true)) && rows.every((r) => !r.slice(0, 4).includes(true)), "a quiet zone of 4 modules");
  for (const line of qrTerminal("abc").split("\n")) assert.match(line, /^\x1b\[30;107m[█▀▄ ]+\x1b\[0m$/);
});
