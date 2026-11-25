// The device of the Strom app a send names (spec 094): its ID as a send's marks are, its name cleaned to read and never
// broken text — read from a GEDCOM's HEAD and from the app's JSON alike.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appClient, clientLabel, readTreeFile, sendMarks, withSendClient } from "../../src/core/sync.ts";
import { viaDevice } from "../../src/cli/context.ts";

test("a device's ID: letters, digits and . _ : - up to 64; anything else is no device", () => {
  assert.deepEqual(appClient("c-7f3a.9_b:2", undefined), { id: "c-7f3a.9_b:2" });
  assert.equal(appClient("", "Chrome"), undefined);
  assert.equal(appClient("a b", "Chrome"), undefined);
  assert.equal(appClient("x".repeat(65), "Chrome"), undefined);
  assert.equal(appClient("zařízení", "Chrome"), undefined);
  assert.equal(appClient(42, "Chrome"), undefined);
});

test("a device's name: NFC, no control or direction marks, at most 60 characters as read", () => {
  // decomposed (NFD) in, composed out
  assert.equal(appClient("a1", "Prohlížeč · Mac")!.name, "Prohlížeč · Mac");
  assert.equal(appClient("a1", "Chrome\u0000‮\tMac\n")!.name, "Chrome Mac");
  assert.equal(appClient("a1", "Хром · Линукс")!.name, "Хром · Линукс");
  assert.equal(appClient("a1", "   ")!.name, undefined);
  // cut at 60 graphemes, never inside one (an emoji family, a letter with its accents, a CJK character at the edge)
  for (const unit of ["👨‍👩‍👧", "é", "語"]) {
    const name = appClient("a1", unit.repeat(70))!.name!;
    assert.equal(name, unit.normalize("NFC").repeat(60));
  }
});

test("a name of broken text (U+FFFD, half a surrogate pair) is none, said; the device goes by its ID", () => {
  for (const bad of ["Chrome � Mac", "Chrome \uD83D Mac", "Chrome \uDC00"]) {
    const said: string[] = [];
    const c = appClient("a1", bad, (why) => said.push(why));
    assert.deepEqual(c, { id: "a1" });
    assert.equal(said.length, 1, bad);
    assert.equal(clientLabel(c!), "a1");
  }
  assert.equal(clientLabel({ id: "0123456789abcdef" }), "01234567");
  assert.equal(clientLabel({ id: "a1", name: "Edge · Windows" }), "Edge · Windows");
});

const ged = (client: string) => `0 HEAD\n1 SOUR Strom\n1 _STROM_HEAD abc\n1 _STROM_APP_TREE t1\n${client}1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME Jan /Lhoták/\n0 TRLR\n`;

test("sendMarks and a GEDCOM read take the device from HEAD; an older app's file has none", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-client-"));
  try {
    const withName = ged("1 _STROM_CLIENT dev-A\n2 NAME Firefox · Linux\n");
    assert.deepEqual(sendMarks(withName).client, { id: "dev-A", name: "Firefox · Linux" });
    assert.deepEqual(sendMarks(ged("1 _STROM_CLIENT dev-B\n")).client, { id: "dev-B" });
    assert.equal(sendMarks(ged("")).client, undefined);
    const file = path.join(dir, "a.ged");
    fs.writeFileSync(file, withName);
    assert.deepEqual(readTreeFile(file).client, { id: "dev-A", name: "Firefox · Linux" });
    fs.writeFileSync(file, ged(""));
    assert.equal(readTreeFile(file).client, undefined);
    // the app's JSON: research.client
    const json = path.join(dir, "a.json");
    fs.writeFileSync(json, JSON.stringify({ version: 3, persons: { a: { id: "a", firstName: "Jan", lastName: "Lhoták", gender: "male", parentIds: [] } }, partnerships: {}, research: { id: "T1", client: { id: "dev-C", name: "Safari · iPad" } } }));
    assert.deepEqual(readTreeFile(json).client, { id: "dev-C", name: "Safari · iPad" });
    fs.writeFileSync(json, JSON.stringify({ version: 3, persons: { a: { id: "a", firstName: "Jan", lastName: "Lhoták", gender: "male", parentIds: [] } }, partnerships: {}, research: { id: "T1", client: { id: "bad id" } } }));
    assert.equal(readTreeFile(json).client, undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a send of a paired device: its own words of its device replaced by the device's (GEDCOM, CRLF, BOM, the JSON) — the rest as it came", () => {
  const dev = { id: "dv_abcdefghijklmnop", name: "Telefon Lhotáků" };
  // a GEDCOM naming another device (with its name and a line under it): only the device's then
  const other = ged("1 _STROM_CLIENT dev-A\n2 NAME Firefox · Linux\n1 _STROM_SENT s1\n");
  const re = withSendClient(other, dev);
  assert.deepEqual(sendMarks(re).client, dev);
  assert.equal(sendMarks(re).sent, "s1", "the rest of HEAD kept");
  assert.equal((re.match(/_STROM_CLIENT/g) ?? []).length, 1);
  assert.ok(!re.includes("Firefox"));
  assert.equal(re.replace(/^1 _STROM_CLIENT .*\n2 NAME .*\n/m, ""), other.replace(/^1 _STROM_CLIENT .*\n2 NAME .*\n/m, ""), "nothing else changed");
  // none named: the device's put in
  assert.deepEqual(sendMarks(withSendClient(ged(""), dev)).client, dev);
  // CRLF and a BOM kept; a device without a name goes by its id
  const crlf = `\uFEFF${ged("1 _STROM_CLIENT dev-B\n").replace(/\n/g, "\r\n")}`;
  const back = withSendClient(crlf, { id: dev.id });
  assert.ok(back.startsWith("\uFEFF0 HEAD"));
  assert.ok(!/[^\r]\n/.test(back), "every line ends CRLF");
  assert.deepEqual(sendMarks(back).client, { id: dev.id });
  // a name decomposed (NFD), of another script: as the device's row has it
  for (const name of ["Telefon Lhotáků".normalize("NFD"), "Телефон Лхоты"]) assert.deepEqual(sendMarks(withSendClient(other, { id: dev.id, name: name.normalize("NFC") })).client, { id: dev.id, name: name.normalize("NFC") });
  // the app's JSON: research.client, the rest kept
  const json = JSON.stringify({ version: 3, persons: { a: { id: "a", firstName: "Jan", lastName: "Lhoták" } }, research: { id: "T1", head: "h1", client: { id: "dev-C", name: "Safari · iPad" } } });
  const j = JSON.parse(withSendClient(json, dev));
  assert.deepEqual(j.research, { id: "T1", head: "h1", client: dev });
  assert.deepEqual(j.persons, JSON.parse(json).persons);
  assert.deepEqual(JSON.parse(withSendClient(JSON.stringify({ version: 3, persons: {} }), dev)).research, { client: dev });
  // neither: as it came
  for (const t of ["not a tree", "[1, 2]", ""]) assert.equal(withSendClient(t, dev), t);
});

test("the device the gateway runs a strom for (STROM_VIA_DEVICE): a device's id alone (dv_ and 16 of base32), its name one line, NFC, at most 60", () => {
  const id = "dv_abcdefghijklmnop";
  assert.deepEqual(viaDevice({ STROM_VIA_DEVICE: id, STROM_VIA_DEVICE_NAME: "Telefon Lhotáků".normalize("NFD") }), { id, name: "Telefon Lhotáků" });
  assert.deepEqual(viaDevice({ STROM_VIA_DEVICE: id, STROM_VIA_DEVICE_NAME: "Телефон\n\u0000Лхоты" }), { id, name: "Телефон Лхоты" });
  assert.deepEqual(viaDevice({ STROM_VIA_DEVICE: id }), { id });
  assert.equal([...viaDevice({ STROM_VIA_DEVICE: id, STROM_VIA_DEVICE_NAME: "é".repeat(80) })!.name!].length, 60);
  for (const bad of ["dv_ABCDEFGHIJKLMNOP", "dv_abcdefghijklmno", "dv_abcdefghijklmnop1", "dev-A", "dv_abcdefghijklmn01", ""]) assert.equal(viaDevice({ STROM_VIA_DEVICE: bad, STROM_VIA_DEVICE_NAME: "x" }), undefined, bad);
});
