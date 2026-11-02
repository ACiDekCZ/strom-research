// What the installers say to a person comes in the person's language: English, and each language with a catalog of
// strom's (assets/lang) — the same sentences in each, nothing left in English but where a language has none.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
const LANGS = fs.readdirSync(path.join(ROOT, "assets", "lang")).filter((f) => /^[a-z]{2,3}\.json$/.test(f)).map((f) => f.slice(0, -5)).sort();

test("install.sh: a case for each language with a catalog, each setting the sentences English sets", () => {
  const sh = read("install/install.sh");
  const cases = new Map<string, string[]>();
  for (const m of sh.matchAll(/^ {2}([a-z]{2,3}\*|\*)\) (T_.*);;$/gmu)) {
    cases.set(m[1]!, [...m[2]!.matchAll(/(T_[A-Z0-9_]+)=/g)].map((v) => v[1]!).sort());
  }
  const english = cases.get("*");
  assert.ok(english?.length, "the English case");
  for (const lang of LANGS) assert.deepEqual(cases.get(`${lang}*`), english, `install.sh: ${lang}`);
  if (process.platform !== "win32") {
    const r = spawnSync("sh", ["-n", path.join(ROOT, "install", "install.sh")], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
  }
});

/** The arguments of each call of T in install.ps1: '…' (with '') and "…" (with `") strings, up to its closing parenthesis. */
function tCalls(ps1: string): string[][] {
  const calls: string[][] = [];
  for (const m of ps1.matchAll(/\(T /g)) {
    let i = m.index! + 3;
    const args: string[] = [];
    for (;;) {
      while (ps1[i] === " ") i++;
      const q = ps1[i];
      if (q !== "'" && q !== '"') break;
      let j = i + 1;
      for (; j < ps1.length; j++) {
        if (q === '"' && ps1[j] === "`") j++;
        else if (ps1[j] === q) {
          if (q === "'" && ps1[j + 1] === "'") j++;
          else break;
        }
      }
      args.push(ps1.slice(i + 1, j));
      i = j + 1;
    }
    calls.push(args);
  }
  return calls;
}

test("install.ps1: every sentence of T in English, Czech, German and Polish, the language chosen as strom chooses it", () => {
  const ps1 = read("install/install.ps1");
  assert.match(ps1, /function T\(\$en, \$czech, \$german, \$polish\)/);
  assert.deepEqual(LANGS, ["cs", "de", "pl"], "a new catalog: its sentences in both installers");
  const calls = tCalls(ps1);
  assert.ok(calls.length >= 15, `${calls.length} calls`);
  for (const args of calls) {
    assert.equal(args.length, 4, `T ${args[0]}: ${args.length} languages`);
    assert.ok(!args.slice(0, 3).includes(args[3]!), `T ${args[0]}: the Polish one is its own`);
  }
  // "nie" says no in Polish, as "ne", "nein" do
  assert.match(ps1, /\(n\|ne\|no\|nein\|nie\)/);
});
