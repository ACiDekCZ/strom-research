// Every example an agent is shown must work: the examples of every command
// run (as a dry run) on a small tree, and every strom command mentioned in
// the guide, the agent files and the method pack names a real command with
// real options.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World, hasGit, fakeConnector, pluginDir } from "../helpers.ts";
import { commands, match, optionsOf } from "../../src/cli/registry.ts";
import { splitCommand } from "../../src/cli/main.ts";
import { parseBatch } from "../../src/commands/batch.ts";
import { guideText } from "../../src/commands/guide.ts";

const opts = { skip: !hasGit };

/** Commands whose examples change the environment or start an agent (checked for syntax below, not run). */
const NOT_RUN = new Set(["setup", "init", "run", "read", "seal adopt", "connector add", "connector remove", "connector probe", "allow connector", "allow host", "login", "uninstall", "update", "gate test", "hook on", "hook test"]); // uninstall, update: the user's yes, the network; gate test, hook on/test: a program of the user's (their own tests)

async function seeded(): Promise<World> {
  const w = new World();
  await w.withTree();
  await w.ok(["research", "new", "Předci Jana Nováka", "--new-person", "Jan /Novák/", "--sex", "M", "--born", "ABT 1905", "--born-place", "Týnec nad Labem"]);
  await w.ok(["event", "edit", "E0001", "--with", "witness:Marie Dvořáková"]); // entered in the wrong role (event edit --without)
  await w.ok(["person", "add", "Josef /Novák/", "--sex", "M", "--born", "ABT 1870"]);
  await w.ok(["person", "add", "Marie /Svobodová/", "--sex", "F", "--born", "ABT 1875"]);
  await w.ok(["person", "add", "Antonín /Víšek/", "--sex", "M"]);
  await w.ok(["person", "add", "Marie /Nováková/", "--sex", "F"]);
  await w.ok(["family", "add", "--partner", "P0004", "--partner", "P0005"]);
  await w.ok(["event", "add", "F0001", "MARR", "--date", "1910"]); // E0004
  await w.ok(["family", "add", "--partner", "P0004"]); // the same couple recorded twice (family merge)
  await w.ok(["person", "add", "Josef /Víšek/", "--sex", "M"]); // P0006
  await w.ok(["family", "child", "F0002", "P0006"]);
  await w.ok(["repo", "add", "SOA Praha"]);
  await w.ok(["recordset", "add", "Týnec 17", "--repo", "R0001"]);
  await w.ok(["place", "add", "Týnec nad Labem"]);
  await w.ok(["source", "add", "Křest", "--kind", "baptism", "--form", "original", "--information", "primary"]);
  await w.ok(["source", "add", "Sňatek", "--kind", "marriage"]);
  await w.ok(["intake", "--text", "Děda Jan byl mlynář"]);
  fs.writeFileSync(path.join(w.cwd, "zapis.txt"), "Joannes filius Josephi\n");
  fs.mkdirSync(path.join(w.cwd, "notes"), { recursive: true });
  fs.writeFileSync(path.join(w.cwd, "notes", "story-P0001.md"), "Jan byl mlynář v Týnci.\n");
  fs.writeFileSync(path.join(w.cwd, "krest-1885.txt"), 'person add "Karel /Novák/" --sex M #karel\nnote add @karel "z křestního zápisu"\n');
  fs.writeFileSync(path.join(w.cwd, "strom-export.json"), JSON.stringify({ persons: {}, partnerships: {} }));
  // scans: registered ones for the views, new ones for media add, one download in the inbox
  const scans = path.join(import.meta.dirname, "..", "fixtures", "images");
  const downloads = path.join(w.env.HOME!, "Downloads", "tynec17");
  fs.mkdirSync(downloads, { recursive: true });
  for (const f of ["s0001.jpg", "s0002.jpg", "s0003.jpg"]) fs.copyFileSync(path.join(scans, f), path.join(downloads, f));
  await w.ok(["media", "add", downloads, "--recordset", "B0001"]);
  await w.ok(["recordset", "calibrate", "B0001", "--point", "1=110", "--point", "3=114"]);
  fs.mkdirSync(path.join(w.home, "shared", "inbox", "register-17"), { recursive: true });
  fs.copyFileSync(path.join(scans, "base420.jpg"), path.join(w.home, "shared", "inbox", "register-17", "s0004.jpg"));
  fs.copyFileSync(path.join(scans, "s0002.jpg"), path.join(w.env.HOME!, "Downloads", "40-left.jpg")); // a half page saved on its own
  fs.mkdirSync(path.join(w.env.HOME!, "Downloads", "rodina"), { recursive: true });
  fs.writeFileSync(path.join(w.env.HOME!, "Downloads", "rodina", "dopis.txt"), "Milá Marie …\n");
  // a connector in the plugins folder, answering from memory (no network in this test)
  await fakeConnector(w, "example-archive");
  const manifest = path.join(pluginDir(w, "example-archive"), "connector.json");
  const m = JSON.parse(fs.readFileSync(manifest, "utf8"));
  fs.writeFileSync(manifest, JSON.stringify({ ...m, can: [...m.can, "part", "locate"], routes: ["direct", "browser"] })); // parts of images too, and through the browser
  const probe = path.join(pluginDir(w, "example-archive"), ".test", "probe"); // a page saved while it was mapped
  fs.mkdirSync(probe, { recursive: true });
  fs.writeFileSync(path.join(probe, "viewer.html"), '<script src="/api/viewer.js"></script>\n<img src="/img/5359/1.jpg">\n');
  await w.ok(["session", "start"]); // for the example of session close
  await w.ok(["task", "done", "T0001", "--result", "zapsáno"]);
  await w.ok(["task", "add", "Sňatek rodičů", "--level", "link", "--where", "B0001", "--why", "jména rodičů", "--done-when", "zápis nalezen"]); // T0002, open
  await w.ok(["task", "add", "Kde je kniha oddaných", "--level", "locate", "--where", "archiv", "--why", "sňatek", "--done-when", "odkaz"]); // T0003
  await w.ok(["task", "wait", "T0003", "--on", "odkaz na knihu oddaných"]); // waits for the user
  await w.ok(["recordset", "add", "Týnec 18"]); // B0002
  await w.ok(["search", "add", "Křty Novák 1903–1907", "--recordset", "B0001", "--years", "1903-1907", "--method", "page-by-page", "--result", "negative"]); // Q0001
  return w;
}

test("every example in the help runs", opts, async () => {
  const w = await seeded();
  const failures: string[] = [];
  for (const def of commands()) {
    if (NOT_RUN.has(def.path.join(" "))) continue;
    for (const example of def.examples ?? []) {
      const lines = parseBatch(example);
      assert.equal(lines.length, 1, example);
      const argv = lines[0]!.argv;
      // Paths outside the test world are only checked for syntax.
      if (argv.some((a) => a.startsWith("/Volumes/"))) continue;
      const r = await w.run([...argv, ...(def.writes ? ["--dry-run"] : [])]);
      if (r.code !== 0) failures.push(`${example}\n    → ${(r.err || r.out).trim().split("\n").slice(0, 2).join(" | ")}`);
    }
  }
  assert.deepEqual(failures, []);
  w.cleanup();
});

/** Is this line a real command with real options? (placeholders like <…> and … are fine) */
function problemsOf(line: string): string | undefined {
  let argv: string[];
  try {
    argv = parseBatch(line)[0]?.argv ?? [];
  } catch {
    return undefined;
  }
  if (argv.length === 0) return undefined;
  const { words } = splitCommand(argv);
  const found = match(words);
  if (!found || found.used !== words.length) return `no such command: strom ${argv.slice(0, 2).join(" ")}`;
  const known = new Set(optionsOf(found.def).map((o) => `--${o.name}`));
  const own = argv.indexOf("--") >= 0 ? argv.slice(0, argv.indexOf("--")) : argv; // after "--": for the agent CLI
  const bad = own.filter((a) => /^--[a-z]/.test(a) && !known.has(a.split("=")[0]!));
  return bad.length ? `strom ${found.def.path.join(" ")}: no option ${bad.join(" ")}` : undefined;
}

/** Every "strom …" command mentioned in a text (inline `code` or indented lines). */
function mentions(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/`(strom [^`]+)`/g)) out.push(m[1]!);
  for (const line of text.split("\n")) {
    const m = /^\s*(strom\s.+)$/.exec(line);
    if (!m) continue;
    // "strom a · strom b" and a comment after two or more spaces
    for (const part of m[1]!.split(/\s+·\s+/)) out.push(part.replace(/\s{2,}\S.*$/, "").trim());
  }
  return out.filter((c) => !/^strom (is|keeps|detects)\b/.test(c));
}

test("the examples that are not run name real commands and options", () => {
  for (const def of commands().filter((d) => NOT_RUN.has(d.path.join(" "))))
    for (const example of def.examples ?? []) assert.equal(problemsOf(example), undefined, example);
});

test("every command in the guide, the agent files and the method pack exists, with its options", opts, async () => {
  const w = new World();
  await w.withTree();
  const texts: Record<string, string> = {
    guide: guideText("cs"),
    "AGENTS.md": fs.readFileSync(path.join(w.cwd, "AGENTS.md"), "utf8"),
    "CLAUDE.md": fs.readFileSync(path.join(w.cwd, "CLAUDE.md"), "utf8"),
  };
  const methodDir = path.join(import.meta.dirname, "..", "..", "assets", "method");
  for (const f of fs.readdirSync(methodDir)) texts[`method/${f}`] = fs.readFileSync(path.join(methodDir, f), "utf8");
  const problems: string[] = [];
  let checked = 0;
  for (const [name, text] of Object.entries(texts)) {
    // the lines of a batch shown in a method (indented, without "strom")
    const batchLines = name.startsWith("method/") ? text.split("\n").filter((l) => /^ {4}[a-z]/.test(l)).map((l) => `strom ${l.trim().replace(/\s+#\w+$/, "")}`) : [];
    for (const cmd of [...mentions(text), ...batchLines]) {
      checked++;
      const p = problemsOf(cmd);
      if (p) problems.push(`${name}: ${cmd}\n    → ${p}`);
    }
  }
  assert.ok(checked > 30, `only ${checked} commands found`);
  assert.deepEqual(problems, []);
  w.cleanup();
});
