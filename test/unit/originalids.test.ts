// The IDs a record had in a family tree it came from (spec 066 K3.2): read literally from another program's file (its
// xref and bare level-1 ID lines) or from the Strom app's blocks of an import its HEAD names; compared by kind (a UUID
// without case, dashes, braces and a 4-hex checksum; FamilySearch's in either tag; an AFN; an EXID of the same TYPE);
// joined once per import and xref, taken back by an undo, those of a record merged away marked as not come of it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGedcomText } from "../../src/gedcom/parse.ts";
import { appIdBlocks, entryOf, foreignIds, idsAdded, IDS_MAX, joinIds, mergedAway, strongKey, withoutIds } from "../../src/core/originalids.ts";
import type { OriginalIds } from "../../src/core/model.ts";

const record = (lines: string[]) => parseGedcomText(["0 HEAD", ...lines, "0 TRLR", ""].join("\n")).records.find((r) => r.tag === "INDI" || r.tag === "FAM")!;

test("a UUID compares without case, dashes, braces and spaces; a 4-hex checksum after 32 hex digits taken off", () => {
  const a = strongKey({ tag: "_UID", value: "5F3B2C1A9D8E7F60A1B2C3D4E5F607181A2B" });
  const b = strongKey({ tag: "UID", value: "{5f3b2c1a-9d8e-7f60-a1b2-c3d4e5f60718}" });
  assert.deepEqual(a, { kind: "uuid", value: "5f3b2c1a9d8e7f60a1b2c3d4e5f60718" });
  assert.deepEqual(b, a);
  // FamilySearch's: _FSFTID and an EXID of familysearch.org are one kind, without case
  assert.deepEqual(strongKey({ tag: "_FSFTID", value: "KWCB-HZ2" }), { kind: "fs", value: "KWCB-HZ2" });
  assert.deepEqual(strongKey({ tag: "EXID", value: "kwcb-hz2", type: "https://www.FamilySearch.org/ark:/61903/4:1:" }), { kind: "fs", value: "KWCB-HZ2" });
  // another EXID: its TYPE is part of the kind
  assert.deepEqual(strongKey({ tag: "EXID", value: "123", type: "https://example.org/a" }), { kind: "exid:https://example.org/a", value: "123" });
  assert.deepEqual(strongKey({ tag: "AFN", value: "1abc-2de" }), { kind: "afn", value: "1ABC-2DE" });
  // weak IDs are no strong kind
  assert.equal(strongKey({ tag: "RIN", value: "37" }), undefined);
});

test("another program's record: its xref without @ and its level-1 ID lines literally (NFC, trimmed); never the Strom app's marks; an unreadable value said, not taken", () => {
  const problems: string[] = [];
  const nfd = "Lhota-é".normalize("NFD");
  const b = foreignIds(
    record([
      "0 @I37@ INDI",
      "1 NAME Jan /Lhoták/",
      "1 _UID  5F3B2C1A9D8E7F60A1B2C3D4E5F607181A2B ",
      `1 RIN ${nfd}`,
      "1 EXID KWCB-HZ2",
      "2 TYPE https://www.familysearch.org/ark:/61903/4:1:",
      "1 _FSFTID KWCB-HZ2",
      "1 AFN 1ABC-2DE",
      "1 UID bad\u0007value",
      "1 _STROM_IMPORT I1",
      "2 _XREF @I99@",
      "2 _UID 00000000000000000000000000000000",
      "1 _STROM_XID I2",
    ]),
    problems,
    "I37",
  )!;
  assert.equal(b.xref, "I37");
  assert.deepEqual(b.ids, [
    { tag: "_UID", value: "5F3B2C1A9D8E7F60A1B2C3D4E5F607181A2B" },
    { tag: "RIN", value: "Lhota-é".normalize("NFC") },
    { tag: "EXID", value: "KWCB-HZ2", type: "https://www.familysearch.org/ark:/61903/4:1:" },
    { tag: "_FSFTID", value: "KWCB-HZ2" },
    { tag: "AFN", value: "1ABC-2DE" },
  ]);
  assert.equal(problems.length, 1, problems.join("; "));
  assert.match(problems[0]!, /I37: UID not taken/);
  // U+FFFD: not taken, said
  const p2: string[] = [];
  const c = foreignIds(record(["0 @I1@ INDI", "1 _UID ab�cd"]), p2, "I1")!;
  assert.deepEqual(c.ids, []);
  assert.equal(p2.length, 1);
  // more than IDS_MAX lines: the rest passed, said
  const p3: string[] = [];
  const many = foreignIds(record(["0 @I1@ INDI", ...Array.from({ length: IDS_MAX + 3 }, (_, i) => `1 RIN ${i}`)]), p3, "I1")!;
  assert.equal(many.ids.length, IDS_MAX);
  assert.match(p3[0]!, /3 ID line\(s\) over 20 passed/);
});

test("the Strom app's record: only its blocks of an import its HEAD names, never its level-1 _UID nor its own xref; _STROM_XID kept as not come of it", () => {
  const problems: string[] = [];
  const r = record([
    "0 @I12@ INDI",
    "1 _UID FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
    "1 _STROM_IMPORT I1",
    "2 _XREF @I37@",
    "2 _UID 6F2A9C1E6F2A9C1E6F2A9C1E6F2A9C1E",
    "2 RIN 37",
    "2 EXID KWCB-HZ2",
    "3 TYPE https://www.familysearch.org/ark:/61903/4:1:",
    "1 _STROM_XID I2",
    "2 _XREF @P5@",
    "2 _UID 11111111111111111111111111111111",
    "1 _STROM_IMPORT I9",
    "2 _XREF @I1@",
    "1 NAME Иван /Лхотак/",
    "2 _STROM_IMPORT I1",
  ]);
  const blocks = appIdBlocks(r, (k) => k === "I1" || k === "I2", problems, "I12");
  assert.deepEqual(blocks, [
    { key: "I1", xref: "I37", ids: [{ tag: "_UID", value: "6F2A9C1E6F2A9C1E6F2A9C1E6F2A9C1E" }, { tag: "RIN", value: "37" }, { tag: "EXID", value: "KWCB-HZ2", type: "https://www.familysearch.org/ark:/61903/4:1:" }] },
    { key: "I2", xref: "P5", ids: [{ tag: "_UID", value: "11111111111111111111111111111111" }], xid: true },
  ]);
  assert.deepEqual(problems, []);
  assert.deepEqual(entryOf(blocks[1]!, "S0003"), { source: "S0003", xref: "P5", ids: [{ tag: "_UID", value: "11111111111111111111111111111111" }], xid: true });
});

test("entries joined once per import and xref (their lines joined), taken back by an undo; a record merged away gives its entries as not come of the import", () => {
  const a: OriginalIds = { source: "S0001", xref: "I1", ids: [{ tag: "_UID", value: "A" }] };
  const b: OriginalIds = { source: "S0002", xref: "I0001", ids: [{ tag: "RIN", value: "1" }] };
  let j = joinIds([a], [{ source: "S0001", xref: "I1", ids: [{ tag: "_UID", value: "A" }] }]);
  assert.equal(j.changed, false, "the same entry: nothing");
  j = joinIds([a], [{ source: "S0001", xref: "I1", ids: [{ tag: "RIN", value: "7" }] }, b]);
  assert.equal(j.changed, true);
  assert.deepEqual(j.list, [{ source: "S0001", xref: "I1", ids: [{ tag: "_UID", value: "A" }, { tag: "RIN", value: "7" }] }, b]);
  const added = idsAdded([a], j.list);
  assert.deepEqual(added, [{ source: "S0001", xref: "I1", ids: [{ tag: "RIN", value: "7" }], lines: true }, b]);
  assert.deepEqual(withoutIds(j.list, added), [a], "the undo: as it was");
  // lines added to an entry of only an xref: the undo keeps the entry
  const bare: OriginalIds = { source: "S0003", xref: "F12" };
  const more = joinIds([bare], [{ source: "S0003", xref: "F12", ids: [{ tag: "RIN", value: "12" }] }]).list;
  assert.deepEqual(withoutIds(more, idsAdded([bare], more)), [bare]);
  // an entry the step made: gone, unless lines were added to it since
  const made = joinIds([], [b]).list;
  assert.deepEqual(withoutIds(made, idsAdded([], made)), []);
  const since = joinIds(made, [{ source: "S0002", xref: "I0001", ids: [{ tag: "_UID", value: "B" }] }]).list;
  assert.deepEqual(withoutIds(since, idsAdded([], made)), [{ source: "S0002", xref: "I0001", ids: [{ tag: "_UID", value: "B" }] }]);
  assert.deepEqual(mergedAway([b]), [{ ...b, xid: true }]);
  // the input is never changed
  assert.deepEqual(a, { source: "S0001", xref: "I1", ids: [{ tag: "_UID", value: "A" }] });
});
