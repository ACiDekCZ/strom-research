// What is new in each version, for a person: CHANGELOG.md (en), CHANGELOG.cs.md, CHANGELOG.de.md in the repository's
// root — strom --version and strom update link to the section of the version, in the research language, on the branch
// of the installation's channel (main: the released versions, beta: the version being prepared).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { whatsNewUrl } from "../../src/core/update.ts";
import { VERSION } from "../../src/core/tree.ts";
import { addressesPerson } from "../../src/core/impersonal.ts";
import { CHANGELOGS } from "../../scripts/beta-commit.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const FILES: [lang: string, file: string][] = [
  ["en", "CHANGELOG.md"],
  ["cs", "CHANGELOG.cs.md"],
  ["de", "CHANGELOG.de.md"],
];
const BASE = "https://github.com/ACiDekCZ/strom-research/blob";

test("what's new: the changelog of the person's language (another one: English), the channel's branch, the section of the version without its prerelease part", () => {
  for (const [lang, file] of [["cs", "CHANGELOG.cs.md"], ["de", "CHANGELOG.de.md"], ["en", "CHANGELOG.md"], ["pl", "CHANGELOG.md"], ["uk", "CHANGELOG.md"], ["cs-CZ", "CHANGELOG.cs.md"], ["DE_at", "CHANGELOG.de.md"], ["", "CHANGELOG.md"]] as const) {
    assert.equal(whatsNewUrl("1.15.0", "stable", lang), `${BASE}/main/${file}#1150`, lang);
    assert.equal(whatsNewUrl("1.15.0-beta.4", "beta", lang), `${BASE}/beta/${file}#1150`, lang);
  }
  // the same anchor from the first beta to the release; two-digit parts as GitHub makes it of "## 1.15.10"
  assert.equal(whatsNewUrl("1.15.0-rc.2", "stable", "en"), `${BASE}/main/CHANGELOG.md#1150`);
  assert.equal(whatsNewUrl("1.15.0", "beta", "cs"), `${BASE}/beta/CHANGELOG.cs.md#1150`, "a release on the beta channel: the beta's file");
  assert.equal(whatsNewUrl("2.10.12-beta.11", "beta", "de"), `${BASE}/beta/CHANGELOG.de.md#21012`);
  // production says nothing of a beta
  assert.doesNotMatch(whatsNewUrl(VERSION, "stable", "cs"), /beta/);
});

/** The sections of a changelog: version → its top-level points. */
function sections(text: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let at: string[] | undefined;
  for (const line of text.split("\n")) {
    const h = /^## (\S+)\s*$/.exec(line);
    if (h) out.set(h[1]!, (at = []));
    else if (at && line.startsWith("- ")) at.push(line.slice(2));
    else if (at && line.startsWith("  ") && at.length) at[at.length - 1] += ` ${line.trim()}`;
  }
  return out;
}

test("the changelogs: a section for this version in each language, the same versions in the same order, 3–8 points each, the same number in every language", () => {
  const read = FILES.map(([lang, file]) => ({ lang, file, text: fs.readFileSync(path.join(ROOT, file), "utf8"), s: sections(fs.readFileSync(path.join(ROOT, file), "utf8")) }));
  const en = read[0]!;
  const base = VERSION.split("-")[0]!;
  assert.ok(en.s.has(base), `CHANGELOG.md has no section "## ${base}"`);
  for (const r of read) {
    assert.deepEqual([...r.s.keys()], [...en.s.keys()], `${r.file}: the versions of CHANGELOG.md`);
    for (const [version, points] of r.s) {
      assert.match(version, /^\d+\.\d+\.\d+$/, `${r.file}: "## ${version}" — a released version, its anchor stable`);
      assert.ok(points.length >= 3 && points.length <= 8, `${r.file} ${version}: ${points.length} points`);
      assert.equal(points.length, en.s.get(version)!.length, `${r.file} ${version}: as many points as in English`);
      for (const p of points) assert.equal(addressesPerson(p, r.lang), undefined, `${r.file} ${version}: "${p}" addresses the person`);
    }
    // nothing of an assistant as an author, nothing of a beta on main (the branch beta's commit adds its note)
    assert.doesNotMatch(r.text, /Claude|Anthropic|Co-Authored|Generated with|beta/i, r.file);
    // each links the other two
    for (const [, other] of FILES) if (other !== r.file) assert.ok(r.text.includes(`(${other})`), `${r.file} links ${other}`);
  }
  assert.deepEqual(CHANGELOGS.map(([file]) => file), FILES.map(([, file]) => file), "the branch beta's commit notes the same files");
});
