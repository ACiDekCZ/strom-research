// Makes the research of a published strom that every newer one must go on with:
// a user's home and config with one family tree, written by that release's own
// code, packed as <version>.tar.gz beside this file. Run it once per release,
// with the release's code (git archive v1.2.0 | tar -x -C /tmp/strom-1.2.0):
//
//   node test/fixtures/releases/make-tree.ts /tmp/strom-1.2.0/src/cli.ts
//
// test/cli/compat.test.ts opens each of them with the strom of today.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cli = path.resolve(process.argv[2] ?? "");
if (!fs.existsSync(cli)) throw new Error("give the release's src/cli.ts (or dist/cli.js)");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-release-"));
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
const version = strom("--version").trim().replace(/^strom /, "");

strom("setup", "--yes", "--lang", "cs");
strom("init", "Novákovi");
cwd = path.join(home, "Documents", "Strom", "Novákovi");
strom("research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905");
strom("repo", "add", "Státní oblastní archiv", "--country", "cz", "--automation", "manual");
strom("recordset", "add", "Týnec 17, N 1903-1920", "--repo", "R1", "--kinds", "baptism", "--places", "Týnec nad Labem", "--years", "1903-1920", "--access", "online-free");
const scans = path.join(dir, "kniha");
fs.mkdirSync(scans);
const images = path.join(import.meta.dirname, "..", "images");
for (const [from, to] of [["base420.jpg", "s0001.jpg"], ["base444.jpg", "s0002.jpg"]]) fs.copyFileSync(path.join(images, from!), path.join(scans, to!));
strom("media", "add", scans, "--recordset", "B1", "--url", "https://archive.example.org/book/1");
strom("source", "add", "Křest Jana Nováka 1905", "--kind", "baptism", "--recordset", "B1", "--locator", "fol. 45", "--language", "la", "--information", "primary", "--media", "M1", "--transcript", "Joannes filius Josephi Novák");
strom("event", "add", "P1", "CHR", "--date", "25 JUN 1905", "--place", "Týnec nad Labem", "--cite", "S1", "--status", "proven", "--with", "godparent:Marie Dvořáková");
strom("person", "add", "Josef /Novák/", "--sex", "M");
strom("person", "add", "Marie /Dvořáková/", "--sex", "F");
strom("family", "add", "--partner", "P2", "--partner", "P3", "--child", "P1", "--cite", "S1");
strom("search", "add", "Křty Novák 1903–1907", "--recordset", "B1", "--years", "1903-1907", "--surname", "Novák", "--method", "page-by-page", "--result", "negative");
strom("source", "add", "Úmrtí 1960", "--kind", "death");
strom("conflict", "add", "Rok narození", "--about", "P1", "--claim", "S1: 1905", "--claim", "S2: 1904");
strom("hypothesis", "add", "Kdo byl otec Josefa?", "--about", "P2", "--variant", "A: Václav z čp. 12", "--variant", "B: Václav z čp. 31");
strom("intake", "--text", "Babička vyprávěla, že Marie byla z Týnce.");
strom("task", "add", "Oddavky Josefa a Marie", "--level", "link", "--where", "B1", "--why", "rodiče Jana", "--done-when", "zápis nalezen", "--about", "P2");
strom("session", "start", "T1");
strom("session", "note", "Hledám v rejstříku.");
strom("session", "close", "--continue", "--summary", "rejstřík prohledán", "--next", "projít knihu");
strom("story", "set", "P1", "--text", "Jan Novák byl pokřtěn roku 1905 v Týnci nad Labem.", "--fact", "E1");
strom("export", "gedcom");
strom("check");

// Packed without the machine's extras (macOS resource forks), the paths relative to the folder.
const out = path.join(import.meta.dirname, `${version}.tar.gz`);
const tar = spawnSync("tar", ["-czf", out, "home", "config"], { cwd: dir, env: { ...process.env, COPYFILE_DISABLE: "1" } });
if (tar.status !== 0) throw new Error(`tar: ${tar.stderr}`);
fs.rmSync(dir, { recursive: true, force: true });
console.log(`${out} (${fs.statSync(out).size} B)`);
