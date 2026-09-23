import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeDate, yearLabel, dateYears } from "../../src/core/gdate.ts";
import { canonicalize, stringifyCanonical, writeJson, readJson } from "../../src/core/json.ts";
import { detectLang, normalizeLang } from "../../src/core/lang.ts";
import { Settings } from "../../src/core/config.ts";
import { configDir, defaultHome, displayPath, expandHome } from "../../src/core/paths.ts";
import { gedcomName, parseName, slashInName } from "../../src/core/people.ts";
import { foldText, safeFolderName } from "../../src/core/text.ts";
import { acquireLock } from "../../src/core/lock.ts";
import { LockedError } from "../../src/core/errors.ts";
import { signOp, verifyOp } from "../../src/core/seal.ts";
import { eventKind } from "../../src/core/model.ts";
import { VERSION } from "../../src/core/tree.ts";
import { gitProgram, resetCache } from "../../src/core/git.ts";

test("git is found where it is: STROM_GIT, PATH, or where Git for Windows put it (a PATH not updated yet)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom git "));
  assert.equal(gitProgram({ STROM_GIT: path.join(dir, "none") }), undefined, "an explicit git that is not there: none");
  const pf = path.join(dir, "Program Files");
  const exe = path.join(pf, "Git", "cmd", "git.exe");
  fs.mkdirSync(path.dirname(exe), { recursive: true });
  fs.writeFileSync(exe, "");
  assert.equal(gitProgram({ PATH: "", ProgramFiles: pf, LOCALAPPDATA: path.join(dir, "local") }, "win32"), exe);
  // strom's own git comes first
  const own = path.join(dir, "local", "Programs", "Strom", "git", "cmd", "git.exe");
  fs.mkdirSync(path.dirname(own), { recursive: true });
  fs.writeFileSync(own, "");
  resetCache();
  assert.equal(gitProgram({ PATH: "", ProgramFiles: pf, LOCALAPPDATA: path.join(dir, "local") }, "win32"), own);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the version strom reports is the package's", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "..", "..", "package.json"), "utf8")) as { version: string };
  assert.equal(VERSION, pkg.version);
});

test("dates: GEDCOM forms are accepted and normalized", () => {
  assert.equal(normalizeDate("24 jun 1783"), "24 JUN 1783");
  assert.equal(normalizeDate("1783-06-24"), "24 JUN 1783");
  assert.equal(normalizeDate("1783-06"), "JUN 1783");
  assert.equal(normalizeDate("abt 1783"), "ABT 1783");
  assert.equal(normalizeDate("BET 1811 AND 1812"), "BET 1811 AND 1812");
  assert.equal(normalizeDate("FROM 1839 TO 1845"), "FROM 1839 TO 1845");
  assert.equal(normalizeDate("BEF MAR 1850"), "BEF MAR 1850");
});

test("dates: invalid input is rejected", () => {
  for (const bad of ["31 FEB 1800", "yesterday", "1783-13", "ABT", "BET 1811", "12 1783", ""]) assert.equal(normalizeDate(bad), undefined, bad);
  assert.equal(normalizeDate("29 FEB 1804"), "29 FEB 1804");
  assert.equal(normalizeDate("29 FEB 1803"), undefined);
});

test("dates: year labels for listings", () => {
  assert.equal(yearLabel("24 JUN 1783"), "1783");
  assert.equal(yearLabel("ABT 1783"), "~1783");
  assert.equal(yearLabel("BEF 1850"), "<1850");
  assert.equal(yearLabel("BET 1811 AND 1812"), "1811/1812");
  assert.equal(yearLabel(undefined), "?");
  assert.deepEqual(dateYears("FROM 1839 TO 1845"), [1839, 1845]);
});

test("json: canonical key order and stable output", () => {
  const a = stringifyCanonical({ b: 1, id: "P0001", a: { z: 1, y: undefined, type: "x" }, type: "person" });
  assert.equal(a, '{\n  "id": "P0001",\n  "type": "person",\n  "a": {\n    "type": "x",\n    "z": 1\n  },\n  "b": 1\n}\n');
  assert.deepEqual(canonicalize([{ b: 1, a: 2 }]), [{ a: 2, b: 1 }]);
});

test("json: atomic write leaves no temp files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-json-"));
  const file = path.join(dir, "sub", "x.json");
  writeJson(file, { id: "X" });
  assert.deepEqual(readJson(file), { id: "X" });
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ["x.json"]);
  fs.rmSync(dir, { recursive: true });
});

test("lang: detection from environment", () => {
  assert.equal(normalizeLang("cs_CZ.UTF-8"), "cs");
  assert.equal(normalizeLang("de-AT"), "de");
  assert.equal(normalizeLang("C"), undefined);
  assert.equal(detectLang({ LANG: "pl_PL.UTF-8" }), "pl");
  assert.equal(detectLang({ LC_ALL: "sk_SK", LANG: "en_US" }), "sk");
  assert.match(detectLang({}), /^[a-z]{2,3}$/);
});

test("settings: flag > env > config > default", () => {
  const env = { HOME: "/h", STROM_HOME: "/from-env" };
  assert.equal(new Settings(env, {}, { home: "/from-config" }).home()?.value, path.resolve("/from-env"));
  assert.equal(new Settings(env, { home: "/from-flag" }, {}).home()?.source, "flag");
  assert.equal(new Settings({ HOME: "/h" }, {}, { home: "/from-config" }).home()?.source, "config");
  assert.equal(new Settings({ HOME: "/h" }, {}, {}).home(), undefined);
  const s = new Settings({ HOME: "/h" }, {}, { home: "/strom" });
  assert.equal(s.shared()?.value, path.join(path.resolve("/strom"), "shared"));
  assert.equal(s.trees()?.value, path.resolve("/strom"));
  assert.equal(new Settings({ HOME: "/h" }, {}, { home: "/strom", shared: "/big" }).shared()?.value, path.resolve("/big"));
  assert.equal(new Settings({ HOME: "/h", STROM_LANG: "de" }, {}, { lang: "cs" }).lang().value, "de");
});

test("paths: platform defaults", () => {
  assert.equal(configDir({ HOME: "/u" }, "darwin"), path.join("/u", ".config", "strom"));
  assert.equal(configDir({ APPDATA: "C:\\AppData" }, "win32"), path.join("C:\\AppData", "strom"));
  assert.equal(defaultHome({ HOME: "/u" }, "darwin"), path.join("/u", "Documents", "Strom"));
  assert.equal(defaultHome({ HOME: "/u", STROM_DOCUMENTS: "~/Dokumenty" }, "darwin"), path.join("/u", "Dokumenty", "Strom"), "another Documents folder");
  assert.equal(expandHome("~/Documents/Strom", { HOME: "/u" }), path.join("/u", "Documents/Strom"));
  assert.equal(displayPath(path.join("/u", "x"), { HOME: "/u" }), path.join("~", "x"));
});

test("names: GEDCOM slashes, plain names, folding", () => {
  assert.deepEqual(parseName("Jan /Novák/"), { given: "Jan", surname: "Novák" });
  assert.deepEqual(parseName("Jan Novák"), { given: "Jan", surname: "Novák" });
  assert.deepEqual(parseName("/Novák/"), { given: "", surname: "Novák" });
  assert.deepEqual(parseName("Anna Maria /Reinhold/ jr."), { given: "Anna Maria jr.", surname: "Reinhold" });
  // a slash inside the surname stays in it (the caller refuses it), and GEDCOM gets "|" in its place
  assert.deepEqual(parseName("Anna /⟨K/Č⟩emenská/"), { given: "Anna", surname: "⟨K/Č⟩emenská" });
  assert.equal(slashInName(parseName("Anna /⟨K/Č⟩emenská/"))?.includes("⟨K/Č⟩emenská"), true);
  assert.equal(slashInName(parseName("Jan /Novák")) !== undefined, true);
  assert.equal(slashInName(parseName("Jan /Novák/")), undefined);
  assert.equal(gedcomName({ given: "Anna", surname: "⟨K/Č⟩emenská" }), "Anna /⟨K|Č⟩emenská/");
  assert.equal(foldText("Víšek  Antonín"), "visek antonin");
  assert.equal(foldText("Weiß Łukasz"), "weiss lukasz");
  assert.equal(safeFolderName('Novák: "rod"'), "Novák rod");
  assert.equal(safeFolderName("shared"), "shared-1");
});

test("events: tags and friendly aliases", () => {
  assert.equal(eventKind("birt"), "BIRT");
  assert.equal(eventKind("birth"), "BIRT");
  assert.equal(eventKind("military service"), "MILI");
  assert.equal(eventKind("nonsense"), undefined);
});

test("lock: exclusive, released, stale lock taken over", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-lock-"));
  const file = path.join(dir, "x.lock");
  const release = acquireLock(file, { owner: "a", waitMs: 0 });
  assert.throws(() => acquireLock(file, { owner: "b", waitMs: 0 }), LockedError);
  release();
  acquireLock(file, { owner: "c", waitMs: 0 })();
  fs.writeFileSync(file, JSON.stringify({ pid: 999999999, host: os.hostname(), at: new Date().toISOString(), owner: "dead" }));
  acquireLock(file, { owner: "d", waitMs: 0 })();
  fs.rmSync(dir, { recursive: true });
});

test("seal: signatures detect any change", () => {
  const key = Buffer.alloc(32, 7);
  const op: Record<string, unknown> = { at: "2026-01-01T00:00:00.000Z", op: "x", targets: ["P0001"], files: [], prev: "", sig: "" };
  op.sig = signOp(op, key);
  assert.ok(verifyOp(op, key));
  assert.ok(!verifyOp({ ...op, targets: ["P0002"] }, key));
  assert.ok(!verifyOp(op, Buffer.alloc(32, 8)));
});

test("image numbers: the part of an archive's file names that changes, not its call number", async () => {
  const { imageNumbers, numberInName } = await import("../../src/core/media.ts");
  const aron = [140, 141, 142].map((n) => `CZ_215000010_00190_KY2F4VMU_00${n}_sign-2873.jpg`);
  assert.deepEqual(imageNumbers(aron), [140, 141, 142]);
  assert.equal(numberInName(aron[1]!), 141, "one file: the zero-padded number");
  assert.deepEqual(imageNumbers(["s0097.jpg", "s0114.jpg"]), [97, 114]);
  assert.deepEqual(imageNumbers(["Havlíčkův-Brod-5927-1881-1922_00024.jpg", "Havlíčkův-Brod-5927-1881-1922_00045.jpg"]), [24, 45]);
  assert.deepEqual(imageNumbers(["004951234_00007.jpg", "004951234_00012.jpg", "004951234_00013.jpg"]), [7, 12, 13]);
  assert.deepEqual(imageNumbers(["page-9.png", "page-10.png"]), [9, 10]);
  assert.deepEqual(imageNumbers(["Křest.jpg"]), [undefined]);
});
