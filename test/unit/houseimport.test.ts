// A research of a house the person made themselves, read (core/houseimport.ts, core/streets.ts houseInTitle): its house
// from its first heading or its file's name, its day, its links by section — those of a section to be gone through by
// hand or only in a reading room (assets/terms/houses.json, any of its languages) apart; decomposed input the same, any
// script. Made-up names only.

import { test } from "node:test";
import assert from "node:assert/strict";
import { manualHeading, readResearch } from "../../src/core/houseimport.ts";
import { houseInTitle } from "../../src/core/streets.ts";
import { forHouse, houseOfTask, houseWork } from "../../src/core/houses.ts";

test("houseInTitle: the municipality and its numbers of a heading or a file's name, what is in brackets or after a dash not", () => {
  assert.deepEqual(houseInTitle("Bělokamen čp. 16 (U Prouzalů) – rešerše"), { town: "Bělokamen", numbers: ["16"] });
  assert.deepEqual(houseInTitle("Lhota čp. 9 a 12 – rešerše"), { town: "Lhota", numbers: ["9", "12"] });
  assert.deepEqual(houseInTitle("Nová Lhota Haus Nr. 3"), { town: "Nová Lhota", numbers: ["3"] });
  assert.deepEqual(houseInTitle("lhota_cp_16"), { town: "lhota", numbers: ["16"] });
  assert.deepEqual(houseInTitle("Bělokamen čp. 16 – rešerše".normalize("NFD")), { town: "Bělokamen", numbers: ["16"] }, "decomposed input read as composed");
  assert.deepEqual(houseInTitle("Лхота № 5 – исследование"), { town: "Лхота", numbers: ["5"] });
  assert.equal(houseInTitle("Zápisky z cesty"), undefined);
  assert.equal(houseInTitle("1868"), undefined);
});

test("readResearch: the first heading, the day, each link with what it was for; a section by hand or only in a reading room apart, in every language", () => {
  const text = [
    "# Bělokamen čp. 16 – rešerše",
    "",
    "Datum: 14. 3. 2026",
    "",
    "## 2. Časová osa",
    "| Rok | Událost | Zdroj | Jistota |",
    "|---|---|---|---|",
    "| 1868 | Požár obce | https://kronika.example.org/b#1868 | střední |",
    "",
    "Snímek: [Archivní fotografie](https://foto.example.org/b-16).",
    "",
    "## 6. Mapy a odkazy (pro ruční otevření)",
    "- [Císařské otisky](https://archivnimapy.example.org/b/3)",
    "### Podrobněji",
    "- <https://oldmaps.example.org/2vm/b>",
    "## 7. Prameny",
    "- [Kronika](https://kronika.example.org/b).",
  ].join("\n");
  const r = readResearch(text.normalize("NFD"));
  assert.equal(r.title, "Bělokamen čp. 16 – rešerše");
  assert.equal(r.date, "2026-03-14");
  assert.deepEqual(
    r.links.map((l) => [l.url, l.manual]),
    [
      ["https://kronika.example.org/b#1868", false],
      ["https://foto.example.org/b-16", false],
      ["https://archivnimapy.example.org/b/3", true],
      ["https://oldmaps.example.org/2vm/b", true],
      ["https://kronika.example.org/b", false],
    ],
  );
  assert.equal(r.links[0]!.what, "1868 · Požár obce · střední", "a bare address in a table: its row's other cells");
  assert.equal(r.links[1]!.what, "Archivní fotografie");
  assert.equal(r.links[2]!.section, "6. Mapy a odkazy (pro ruční otevření)");
  assert.equal(readResearch("# X\n\nDate: 2026-4-1\n").date, "2026-04-01");
  for (const h of ["Odkazy pro ruční otevření", "Co je jen v badatelně", "Im Lesesaal", "Manuell zu öffnen", "To open by hand", "Reading room only", "Do ręcznego otwarcia", "Tylko w czytelni", "ODKAZY RUČNĚ".normalize("NFD")])
    assert.ok(manualHeading(h), h);
  for (const h of ["Časová osa", "Prameny použité v této rešerši", "Zeitleiste", "Sources", "Хронология"]) assert.ok(!manualHeading(h), h);
});

test("the tasks of a house: by their origin — a takeover, the house, a municipality's houses; none of another origin", () => {
  assert.equal(houseWork({ origin: "house:import:A0001" }), "takeover");
  assert.equal(houseOfTask({ origin: "house:import:A0001" }), "A0001");
  assert.equal(houseWork({ origin: "house:A0002" }), "house");
  assert.equal(houseOfTask({ origin: "house:lhota|16" }), "lhota|16");
  assert.equal(houseWork({ origin: "house:town:L0001" }), "town");
  assert.equal(houseOfTask({ origin: "house:town:L0001" }), undefined);
  assert.equal(forHouse({ origin: "kin:P0001" }), false);
  assert.equal(houseWork({ origin: "housework" }), undefined);
});
