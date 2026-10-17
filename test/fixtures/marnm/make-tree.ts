// Makes a research started from a MyHeritage family tree by a strom that read no _MARNM (before 1.16), for
// test/cli/input-names.test.ts: a user's home and config, packed as <version>.tar.gz beside this file. Run it with the
// code of such a release (git archive v1.15.0 | tar -x -C /tmp/strom-1.15.0):
//
//   node test/fixtures/marnm/make-tree.ts /tmp/strom-1.15.0/src/cli.ts

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cli = path.resolve(process.argv[2] ?? "");
if (!fs.existsSync(cli)) throw new Error("give the release's src/cli.ts (or dist/cli.js)");
// a fixed, neutral folder: the paths strom writes into the tree say nothing of the computer it was made on
const dir = path.join(process.platform === "win32" ? os.tmpdir() : "/tmp", "strom-fixture");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir);
const home = path.join(dir, "home");
fs.mkdirSync(home);
const gitconfig = path.join(dir, "gitconfig");
fs.writeFileSync(gitconfig, "");
const env = {
  HOME: home,
  USERPROFILE: home,
  STROM_CONFIG_DIR: path.join(dir, "config"),
  LANG: "cs_CZ.UTF-8",
  PATH: process.env.PATH ?? "",
  GIT_CONFIG_GLOBAL: gitconfig,
  GIT_CONFIG_NOSYSTEM: "1",
  STROM_NO_DIALOG: "1",
  STROM_NO_OPEN: "1",
  STROM_NO_INSTALL: "1",
  STROM_UPDATES: "off",
  STROM_APP_DIRS: "",
};
let cwd = dir;
const strom = (...args: string[]): string => {
  const r = spawnSync(process.execPath, [cli, ...args], { cwd, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`strom ${args.join(" ")} → ${r.status}\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
};
const version = strom("--version").trim().split("\n")[0]!.replace(/^strom /, "");

// as MyHeritage writes it: the surname after the marriage under the NAME, the surname alone (one decomposed, NFD)
const ged = [
  "0 HEAD",
  "1 SOUR MYHERITAGE",
  "1 CHAR UTF-8",
  "0 @I1@ INDI",
  "1 NAME Marie /Dvořáková/",
  `2 _MARNM ${"Nováková".normalize("NFD")}`,
  "1 SEX F",
  "1 BIRT",
  "2 DATE 1901",
  "0 @I2@ INDI",
  "1 NAME Anna /Svobodová/",
  "2 _MARNM Černá",
  "1 SEX F",
  "0 @I3@ INDI",
  "1 NAME Ольга /Петрова/",
  "2 _MARNM Иванова",
  "1 SEX F",
  "0 @I4@ INDI",
  "1 NAME Jana /Malá/",
  "2 _MARNM Velká",
  "1 SEX F",
  "0 @I5@ INDI",
  "1 NAME Eva /Horáková/",
  "2 _MARNM Šťastná",
  "1 SEX F",
  "0 @I6@ INDI",
  "1 NAME Josef /Dvořák/",
  "1 SEX M",
  "0 @F1@ FAM",
  "1 HUSB @I6@",
  "1 WIFE @I1@",
  "0 TRLR",
].join("\n");

strom("setup", "--yes", "--lang", "cs");
strom("init", "Novákovi");
cwd = path.join(home, "Documents", "Strom", "Novákovi");
// P1: the research's own Eva, before the file came
strom("person", "add", "Eva /Horáková/", "--sex", "F");
const file = path.join(dir, "rodokmen.ged");
fs.writeFileSync(file, ged + "\n");
// I1, S1; P2…P7 = @I1@…@I6@
strom("intake", file);
// Anna's married name added since; the file's Eva the same as the research's; Jana withdrawn
strom("name", "add", "P3", "Anna /Černá/", "--kind", "married");
strom("person", "merge", "P1", "P6", "--reason", "the same woman");
strom("person", "retract", "P5", "--reason", "not of this family");
strom("check");

fs.rmSync(path.join(cwd, ".strom", "bin"), { recursive: true, force: true });
const out = path.join(import.meta.dirname, `${version}.tar.gz`);
const tar = spawnSync("tar", ["-czf", out, "home", "config"], { cwd: dir, env: { ...process.env, COPYFILE_DISABLE: "1" } });
if (tar.status !== 0) throw new Error(`tar: ${tar.stderr}`);
fs.rmSync(dir, { recursive: true, force: true });
console.log(`${out} (${fs.statSync(out).size} B)`);
