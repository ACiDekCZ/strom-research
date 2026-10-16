// What is new in this strom for the Strom app (the bridge's /whats-new): the running version's section of the
// changelog shipped with strom, in the language asked for (else English), its items only, and where the section is.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { changelogPoints, whatsNew, WHATS_NEW_MAX_CHARS, WHATS_NEW_MAX_POINTS } from "../../src/core/whatsnew.ts";
import { CHANGELOGS, betaChangelog } from "../../scripts/beta-commit.ts";
import { VERSION } from "../../src/core/tree.ts";

const BASE = "https://github.com/ACiDekCZ/strom-research/blob";

const CS = `# Co je nového

[English](CHANGELOG.md) · Čeština

## 2.1.0

*Patří k aplikaci Strom 4.0.0.*

- **Příjmení Šťastný.** Záznamy se čtou
  i ve dvou řádcích, \`strom read\` beze změny.
- **Кириллица.** Ольга Петрова
  ve *třech*
  řádcích.

Odstavec, který není bodem.

* **Hvězdička** jako odrážka.

## 2.0.0

- Starší verze.
`;

function folder(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-whatsnew-"));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return dir;
}

test("the section of the version without its prerelease part: each top-level item one string, its lines joined, no note in italics, no paragraph", () => {
  const points = changelogPoints(CS, "2.1.0-beta.6");
  assert.deepEqual(points, [
    "**Příjmení Šťastný.** Záznamy se čtou i ve dvou řádcích, `strom read` beze změny.",
    "**Кириллица.** Ольга Петрова ve *třech* řádcích.",
    "**Hvězdička** jako odrážka.",
  ]);
  assert.deepEqual(changelogPoints(CS, "2.0.0"), ["Starší verze."]);
  assert.deepEqual(changelogPoints(CS, "2.2.0"), [], "no section: nothing");
  assert.deepEqual(changelogPoints(CS, "2.1.00"), [], "only that version");
  // a section of another version that begins the same is not it
  assert.deepEqual(changelogPoints("## 2.1.0.1\n\n- x\n", "2.1.0"), []);
  // Windows line ends, a BOM, a decomposed accent kept as it is
  const nfd = "\uFEFF## 2.1.0\r\n\r\n- Zdene\u030Ck\r\n  Dvor\u030Ca\u0301k\r\n";
  assert.deepEqual(changelogPoints(nfd, "2.1.0"), ["Zdene\u030Ck Dvor\u030Ca\u0301k"]);
});

test("the note of the branch beta (In preparation…) is no point, in any language", () => {
  for (const [file, note] of CHANGELOGS) {
    const text = betaChangelog(CS.replace("## 2.0.0", "## 1.0.0"), file, note, "2.1.0-beta.6");
    assert.ok(text.includes("2.1.0-beta.6"), file);
    const points = changelogPoints(text, "2.1.0-beta.6");
    assert.equal(points.length, 3, file);
    for (const p of points) assert.doesNotMatch(p, /2\.1\.0-beta\.6/, file);
  }
});

test("no HTML, at most 20 points of at most 1000 characters", () => {
  const many = Array.from({ length: 30 }, (_, i) => `- Bod ${i} <b>tučně</b> <script>x</script>`).join("\n");
  const points = changelogPoints(`## 3.0.0\n\n${many}\n- ${"ž".repeat(3000)}\n`, "3.0.0");
  assert.equal(points.length, WHATS_NEW_MAX_POINTS);
  assert.equal(points[0], "Bod 0 tučně x");
  const long = changelogPoints(`## 3.0.0\n\n- ${"ž".repeat(3000)}\n`, "3.0.0")[0]!;
  assert.equal([...long].length, WHATS_NEW_MAX_CHARS);
  assert.ok(long.endsWith("…"));
});

test("the language asked for (cs, de), any other English; a language whose changelog lacks the section: English; the address on the channel's branch", () => {
  const dir = folder({ "CHANGELOG.md": "## 2.1.0\n\n- New.\n", "CHANGELOG.cs.md": CS, "CHANGELOG.de.md": "## 2.0.0\n\n- Alt.\n" });
  try {
    assert.deepEqual(whatsNew("2.1.0-beta.6", "cs", "beta", dir), {
      version: "2.1.0-beta.6",
      lang: "cs",
      url: `${BASE}/beta/CHANGELOG.cs.md#210`,
      points: changelogPoints(CS, "2.1.0"),
    });
    assert.deepEqual(whatsNew("2.1.0", "CS-cz", "stable", dir).url, `${BASE}/main/CHANGELOG.cs.md#210`);
    // German without the section: the English one, said so
    assert.deepEqual(whatsNew("2.1.0", "de", "stable", dir), { version: "2.1.0", lang: "en", url: `${BASE}/main/CHANGELOG.md#210`, points: ["New."] });
    for (const lang of ["pl", "uk", "", null, undefined, "../../etc/passwd"]) {
      const got = whatsNew("2.1.0", lang, "stable", dir);
      assert.equal(got.lang, "en", String(lang));
      assert.deepEqual(got.points, ["New."], String(lang));
    }
    // no section anywhere: no points, the address still said
    assert.deepEqual(whatsNew("9.9.9", "de", "stable", dir), { version: "9.9.9", lang: "de", url: `${BASE}/main/CHANGELOG.de.md#999`, points: [] });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("no changelogs at all (or unreadable): no points, never an error", () => {
  const dir = folder({});
  fs.mkdirSync(path.join(dir, "CHANGELOG.cs.md"));
  try {
    assert.deepEqual(whatsNew("2.1.0", "cs", "stable", dir), { version: "2.1.0", lang: "cs", url: `${BASE}/main/CHANGELOG.cs.md#210`, points: [] });
    assert.deepEqual(whatsNew("2.1.0", "en", "beta", dir).points, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("strom's own changelogs: this version's points in each language", () => {
  for (const lang of ["en", "cs", "de"]) {
    const got = whatsNew(VERSION, lang, "stable");
    assert.equal(got.lang, lang);
    assert.ok(got.points.length >= 3 && got.points.length <= 8, `${lang}: ${got.points.length}`);
    for (const p of got.points) assert.doesNotMatch(p, /^- |^\*[^*]|\n/, `${lang}: ${p}`);
  }
});
