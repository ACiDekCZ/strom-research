// The menu's screens as a person sees them in a terminal without colours (spec 144): the main menu, the settings,
// maintenance, the archives, the permissions of archives, What waits and the fixes — Czech and German, 80 and 120
// columns. Each screen says where it is, its options in their columns, [0] last, no line wider than the terminal,
// no label over 40; the screens kept as pictures in test/fixtures/screens (STROM_UPDATE_SCREENS=1 writes them again).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, fakeConnector, hasGit } from "../helpers.ts";
import { main } from "../../src/cli/main.ts";
import { shown, terminalStyle } from "../../src/cli/screen.ts";

const opts = { skip: !hasGit };
const PICTURES = path.join(import.meta.dirname, "..", "fixtures", "screens");

async function world(): Promise<World> {
  const w = new World();
  const bin = path.join(w.dir, "bin");
  fs.mkdirSync(bin);
  const script = path.join(bin, "claude.mjs");
  fs.writeFileSync(script, "");
  fs.writeFileSync(path.join(bin, "claude"), `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, "claude.cmd"), `@"${process.execPath}" "%~dp0claude.mjs" %*\r\n`);
  const git = spawnSync(process.platform === "win32" ? "where" : "which", ["git"], { encoding: "utf8" }).stdout.split(/\r?\n/)[0]!.trim();
  if (process.platform === "win32") w.env.PATH = [bin, ...(git ? [path.dirname(git)] : [])].join(path.delimiter);
  else {
    if (git) fs.symlinkSync(git, path.join(bin, "git"));
    w.env.PATH = bin;
  }
  await w.withTree("Lhotákovi");
  await fakeConnector(w, "lhota", "", { automation: "restricted", terms: "https://archive.example.org/terms", termsSummary: "Snímky jen jednotlivě." });
  return w;
}

/** The menu on a terminal of `columns` without colours, answered by `answers`: what it wrote. */
async function terminal(w: World, answers: string[], columns: number, lang: string): Promise<string> {
  let out = "";
  const style = terminalStyle({ tty: true, env: { NO_COLOR: "1" }, platform: "linux", columns: () => columns, agent: false });
  const io = { stdout: (s: string) => void (out += s), stderr: (s: string) => void (out += s), tty: true, answers: [...answers], style };
  await main([], io, { ...w.env, STROM_LANG: lang }, w.cwd);
  return out;
}

/** The screens one after another: each from its crumbs (Strom › …) to its prompt. */
function screens(out: string): string[] {
  const all: string[] = [];
  const lines = out.split("\n");
  let start = -1;
  for (const [i, l] of lines.entries()) {
    if (/^Strom( › |$)|^Strom (výzkum|Research|Forschung) /u.test(l)) start = i;
    if (start >= 0 && /^(Volba|Auswahl)\b/u.test(l)) {
      all.push(lines.slice(start, i + 1).join("\n"));
      start = -1;
    }
  }
  return all;
}

/** What changes from run to run: the version, dates, the folders of the test. */
function steady(text: string, w: World): string {
  return text
    .split(w.dir)
    .join("<dir>")
    .replace(/\b\d+\.\d+\.\d+(?:-beta\.\d+)?\b/gu, "X.Y.Z")
    .replace(/\b\d{4}-\d{2}-\d{2}\b/gu, "YYYY-MM-DD")
    .replace(/\b\d{1,2}\. ?\d{1,2}\. ?\d{4}\b/gu, "D. M. YYYY");
}

function checked(screen: string, columns: number, where: string): void {
  const lines = screen.split("\n");
  for (const l of lines) assert.ok(shown(l) <= columns, `${where}: wider than ${columns}: ${l}`);
  assert.match(lines[0]!, /^Strom/u, `${where}: the crumbs first`);
  const options = lines.filter((l) => /^ {2,}\[[^\]\s]+\] {2}\S/u.test(l));
  if (!options.length) return;
  for (const o of options) {
    // the label: up to its column of values (two spaces), its value after · (a label longer than the column) or the end
    const label = /^ +\[[^\]]+\] {2}(.+?)(?: {2}| · |$)/u.exec(o)![1]!;
    assert.ok(shown(label) <= 40, `${where}: a label over 40: ${label}`);
  }
  const keys = options.map((o) => /\[([^\]]+)\]/u.exec(o)![1]);
  if (keys.includes("0")) assert.equal(keys.at(-1), "0", `${where}: [0] last`);
}

function pictured(name: string, text: string): void {
  const file = path.join(PICTURES, `${name}.txt`);
  if (process.env.STROM_UPDATE_SCREENS === "1" || !fs.existsSync(file)) {
    fs.mkdirSync(PICTURES, { recursive: true });
    fs.writeFileSync(file, text);
    return;
  }
  assert.equal(text, fs.readFileSync(file, "utf8").replace(/\r\n/gu, "\n"), `${name}: the screen as pictured (STROM_UPDATE_SCREENS=1 to write it again)`);
}

// the main menu · 8 settings · 8 maintenance; · 4 archives (its permissions by their number); · 3 What waits
const WALKS = [["8", "8", "0", "0", "0"], ["8", "4", "0", "0", "0"], ["3", "", "0"]];

for (const lang of ["cs", "de"]) {
  for (const columns of [80, 120]) {
    test(`the screens of the menu in ${lang} at ${columns} columns: where they are, options in columns, [0] last, nothing wider`, opts, async () => {
      const w = await world();
      try {
        const outs = [];
        for (const walk of WALKS) outs.push(await terminal(w, walk, columns, lang));
        // the permissions of archives: the item's number on the archives' screen
        const key = /\[(\d+)\] {2}(Svolení ke stahování|Erlaubnis)/u.exec(outs[1]!)?.[1];
        assert.ok(key, outs[1]);
        outs.push(await terminal(w, ["8", "4", key!, "0", "0", "0", "0"], columns, lang));
        // each screen once, by where it is
        const seen = new Map<string, string>();
        for (const s of outs.flatMap(screens)) if (!seen.has(s.split("\n")[0]!)) seen.set(s.split("\n")[0]!, s);
        for (const [where, s] of seen) checked(s, columns, `${lang} ${columns} ${where}`);
        assert.ok([...seen.keys()].some((c) => / › .+ › /u.test(c)), `three levels said: ${[...seen.keys()].join(" | ")}`);
        pictured(`menu-${lang}-${columns}`, steady([...seen.values()].join("\n\n-----\n\n"), w));
      } finally {
        w.cleanup();
      }
    });
  }
}
