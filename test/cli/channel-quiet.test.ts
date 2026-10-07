// The releases say nothing of a beta: the catalogs (English, cs, de) outside the texts of the beta channel (their
// keys carry a `.beta` part), README.md, the help, the catalog of commands, the guide and doctor of a strom on the
// releases, and the installers outside their STROM_CHANNEL branch. A beta install says so (the same look sees it).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit } from "../helpers.ts";
import { UI } from "../../src/cli/ui.ts";
import { PHRASES } from "../../src/core/phrases.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
/** beta, Beta, betě, bety, betu, betou — never "between", "alphabet". */
const BETA = /(?<!\p{L})bet[aěyu]/iu;
/** Shown only on the beta channel: a `.beta` part of the key. */
const betaOnly = (key: string) => /\.beta(\.|$)/.test(key);
/** The Strom app's own beta copy (another copy of the app, not strom's channel): said on the releases too. */
const APP_COPY = new Set(["ui.link.new.elsewhere"]);

test("the catalogs: beta only in the texts of the beta channel (keys with .beta)", () => {
  const catalogs: [string, Record<string, string>][] = [
    ["en ui", UI as Record<string, string>],
    ["en phrases", PHRASES as Record<string, string>],
    ...fs.readdirSync(path.join(ROOT, "assets", "lang")).map((f): [string, Record<string, string>] => [f, JSON.parse(fs.readFileSync(path.join(ROOT, "assets", "lang", f), "utf8"))]),
  ];
  for (const [name, catalog] of catalogs) {
    const bad = Object.entries(catalog).filter(([key, text]) => typeof text === "string" && !betaOnly(key) && !APP_COPY.has(key) && BETA.test(text));
    assert.deepEqual(bad, [], name);
  }
  // the look sees what it looks for
  assert.ok(BETA.test((UI as Record<string, string>)["ui.doc.beta"]!));
});

test("README.md says nothing of a beta", () => {
  const bad = fs.readFileSync(path.join(ROOT, "README.md"), "utf8").split("\n").filter((l) => BETA.test(l));
  assert.deepEqual(bad, []);
});

test("the installers: beta only where STROM_CHANNEL is read and its branch, never in what they print", () => {
  for (const f of ["install.sh", "install.ps1"]) {
    const lines = fs.readFileSync(path.join(ROOT, "install", f), "utf8").split("\n");
    const code = lines.filter((l) => !/^\s*#/.test(l) && BETA.test(l));
    assert.ok(code.length > 0, `${f}: its channel branch`);
    for (const l of code) {
      assert.match(l, /channel/i, `${f}: beta outside the channel: ${l}`);
      assert.doesNotMatch(l, /\b(echo|printf|Write-Host|Write-Output)\b|\$T_|\$t\./, `${f}: beta printed: ${l}`);
    }
    // the texts the installer shows (T_…= / $t…) carry no beta
    const texts = lines.filter((l) => /^\s*(T_\w+=|\$T_\w+\s*=|\w+\s*=\s*'|'\w+'\s*=)/.test(l) && BETA.test(l));
    assert.deepEqual(texts, [], f);
  }
});

test("a strom on the releases: help, the catalog of commands, the guide, doctor and the orientation say nothing of a beta", { skip: !hasGit }, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Rodina"]);
  w.cwd = w.treeDir("Rodina");
  const said: [string, string][] = [];
  for (const args of [[], ["help"], ["help", "--human"], ["help", "update"], ["help", "update", "--human"], ["update", "--help"], ["commands", "--json"], ["guide"], ["doctor"], ["status"]]) {
    const r = await w.run(args, args[0] === "help" || args.includes("--help") ? { tty: true } : {});
    said.push([`strom ${args.join(" ")}`, r.out + r.err]);
  }
  for (const [label, text] of said) assert.ok(text.trim().length > 40, `${label}: said something`);
  for (const [label, text] of said) assert.deepEqual(text.split("\n").filter((l) => BETA.test(l)), [], `${label}:\n${text}`);
  // a beta install says it (the look above would see it)
  const beta = await w.run(["doctor"], { env: { STROM_CHANNEL: "beta" } });
  assert.match(beta.out + beta.err, BETA);
});
