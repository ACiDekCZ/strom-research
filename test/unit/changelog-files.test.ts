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
import { CHANGELOGS, betaChangelog } from "../../scripts/beta-commit.ts";

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

/** The beta commit's note in a changelog (scripts/beta-commit.ts), whatever the beta's version: the branch beta only. */
function withoutBetaNote(text: string, note: (version: string) => string): string {
  const [before, after] = note("\0").split("\0").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return text.replace(new RegExp(`${before}\\d+\\.\\d+\\.\\d+-beta\\.\\d+${after}`, "g"), "");
}

/** The checks of the three changelogs (en first): on main, and as the branch beta's commit gives them. */
function checkChangelogs(texts: string[], where: string): void {
  const read = FILES.map(([lang, file], i) => ({ lang, file, text: texts[i]!, s: sections(texts[i]!) }));
  const en = read[0]!;
  const base = VERSION.split("-")[0]!;
  assert.ok(en.s.has(base), `${where}: CHANGELOG.md has no section "## ${base}"`);
  const newer = (v: string) => v.split(".").map(Number).reduce((d, n, i) => d || n - Number(base.split(".")[i]), 0) > 0;
  for (const r of read) {
    assert.deepEqual([...r.s.keys()], [...en.s.keys()], `${where} ${r.file}: the versions of CHANGELOG.md`);
    for (const [version, points] of r.s) {
      assert.match(version, /^\d+\.\d+\.\d+$/, `${where} ${r.file}: "## ${version}" — a released version, its anchor stable`);
      // the version being prepared (newer than the sources') grows with its betas: 3–8 points by its release;
      // a fix release (X.Y.Z, Z > 0) may say only its one fix
      assert.ok(points.length >= (newer(version) || !version.endsWith(".0") ? 1 : 3) && points.length <= 8, `${where} ${r.file} ${version}: ${points.length} points`);
      assert.equal(points.length, en.s.get(version)!.length, `${where} ${r.file} ${version}: as many points as in English`);
      for (const p of points) assert.equal(addressesPerson(p, r.lang), undefined, `${where} ${r.file} ${version}: "${p}" addresses the person`);
    }
    // nothing of an assistant as an author, nothing of a beta on main (the branch beta's commit adds its note)
    const note = CHANGELOGS.find(([file]) => file === r.file)![1];
    assert.doesNotMatch(withoutBetaNote(r.text, note), /Claude|Anthropic|Co-Authored|Generated with|beta/i, `${where} ${r.file}`);
    // each links the other two
    for (const [, other] of FILES) if (other !== r.file) assert.ok(r.text.includes(`(${other})`), `${where} ${r.file} links ${other}`);
  }
}

test("the changelogs: a section for this version in each language, the same versions in the same order, 3–8 points each (the version being prepared and a fix release: 1–8), the same number in every language", () => {
  checkChangelogs(FILES.map(([, file]) => fs.readFileSync(path.join(ROOT, file), "utf8")), "main");
  assert.deepEqual(CHANGELOGS.map(([file]) => file), FILES.map(([, file]) => file), "the branch beta's commit notes the same files");
});

test("the changelogs as the branch beta's commit gives them pass the same checks (the tag's workflow runs them before npm)", () => {
  const texts = FILES.map(([, file]) => fs.readFileSync(path.join(ROOT, file), "utf8"));
  const newest = sections(texts[0]!).keys().next().value!;
  const beta = texts.map((text, i) => betaChangelog(text, CHANGELOGS[i]![0], CHANGELOGS[i]![1], `${newest}-beta.3`));
  assert.match(beta[0]!, /betas up to/);
  checkChangelogs(beta, "beta");
  // the note is let through only as the commit writes it
  assert.throws(() => checkChangelogs([beta[0]!.replace("betas up to", "beta builds up to"), beta[1]!, beta[2]!], "beta"), /beta/);
});
