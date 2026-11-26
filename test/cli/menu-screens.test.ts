// The menu's screens as a person sees them in a terminal without colours (spec 144): the main menu, the settings,
// the setup's "What to set up?", the agent working alone, maintenance, the fixes with nothing found, the archives,
// the permissions of archives, What waits and the fixes — Czech and German, 80 and 120 columns. Each screen says where
// it is, its options in their columns (a long label wrapped, its value in the column all the same), [0] last, one
// blank line at most, no line wider than the terminal, no label over 40; the screens kept as pictures in
// test/fixtures/screens (STROM_UPDATE_SCREENS=1 writes them again).

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, fakeConnector, hasGit } from "../helpers.ts";
import { main } from "../../src/cli/main.ts";
import { encodeImage } from "../../src/image/index.ts";
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

/**
 * The same with things waiting: two letters to one office of a long name (a place of its own, its crumb cut), the
 * family (one thing: the thing itself), a third letter sent, and an earlier reading by another model left open
 * (fixes: new-model).
 */
async function waitingWorld(): Promise<World> {
  const w = await world();
  await w.ok(["research", "new", "Předci Vojtěcha", "--new-person", "Vojtěch /Lhoták/", "--sex", "M", "--born", "1902"]);
  await w.ok(["recordset", "add", "Lhota N 1840–1860", "--kinds", "baptism"]);
  const scans = path.join(w.dir, "skeny");
  fs.mkdirSync(scans);
  fs.writeFileSync(path.join(scans, "s0001.jpg"), encodeImage({ width: 400, height: 300, channels: 3, data: new Uint8Array(400 * 300 * 3).fill(200) }, "jpeg"));
  await w.ok(["media", "add", scans, "--recordset", "B1"]);
  const readings = path.join(w.cwd, "notes", "readings");
  fs.mkdirSync(readings, { recursive: true });
  fs.writeFileSync(
    path.join(readings, `${new Date(Date.now() - 3_600_000).toISOString().slice(0, 10)}-M0001-1-1.md`),
    "# Reading M0001 · batch 1 of 1\nStrom: 1.19.0\nAgent: claude\nModel: m-old\nImages: M0001\nQuestion: Přepsat zápis celý; nejisté označit [?]\n\n## Image 1 · M0001\nresult: found\nentries:\n- Jan Lhoták [?], Lhota [?]\n",
  );
  w.env.STROM_MODEL_VISION = "m-new";
  let n = 0;
  const waiting = async (what: string, ...how: string[]) => {
    await w.ok(["task", "add", what, "--level", "request", "--where", "matrika Lhota", "--why", "rodiče", "--done-when", "odpověď", "--about", "P1", "--priority", "3", "--anyway"]);
    await w.ok(["task", "wait", `T${++n}`, ...how]);
  };
  for (let i = 1; i <= 2; i++) await waiting(`Opis zápisu Lhota ${i}`, "--kind", "letter", "--to", "Matriční úřad Lhota nad Lhotkou u Horní Lhoty", "--on", "Odpověď matriky na žádost.");
  await waiting("Vzpomínky na Lhotu", "--kind", "family", "--on", "Vzpomínky rodiny.");
  // a third letter to the office sent: What waits offers the replies by [?] as an option
  await waiting("Opis zápisu Lhota 3", "--kind", "letter", "--to", "Matriční úřad Lhota nad Lhotkou u Horní Lhoty", "--on", "Odpověď matriky na žádost.");
  await w.ok(["task", "sent", "T4"]);
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
    if (/^Strom( › |$)|^Strom (výzkum|Research|Forschung|Ahnenforschung) /u.test(l)) start = i;
    // a screen ends with its prompt, or with Enter back after a long answer (the fixes with nothing found)
    if (start >= 0 && /^(Volba|Auswahl)\b|^(Enter vrátí|Mit Enter zurück)/u.test(l)) {
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
    .replace(/\b\d{1,2}\. ?\d{1,2}\. ?\d{4}\b/gu, "D. M. YYYY")
    .replace(/\b\d{1,2}\. ?\d{1,2}\.(?!\s?\d)/gu, "D. M.");
}

function checked(screen: string, columns: number, where: string): void {
  const lines = screen.split("\n");
  for (const l of lines) assert.ok(shown(l) <= columns, `${where}: wider than ${columns}: ${l}`);
  assert.match(lines[0]!, /^Strom/u, `${where}: the crumbs first`);
  // one blank line at most between the parts of a screen, never two
  assert.doesNotMatch(screen, /\n\n\n/u, `${where}: two blank lines`);
  const options = lines.filter((l) => /^ {2,}\[[^\]\s]+\] {2}\S/u.test(l));
  if (!options.length) return;
  // the values in one column: a long label wrapped within its column, never its value after it (Der Agent allein)
  const at = new Set(options.map((o) => /^( +\[[^\]]+\] {2}\S.*? {2,})\S/u.exec(o)?.[1]!.length).filter((n) => n !== undefined));
  assert.ok(at.size <= 1, `${where}: values in more columns than one:\n${screen}`);
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

// the main menu · 8 settings · 8 maintenance · 3 the fixes (nothing found); · 1 the setup's "What to set up?"; · 2 the
// agent working alone; · 4 archives (its permissions by their number); · 3 What waits
const WALKS = [["8", "8", "3", "", "0", "0", "0"], ["8", "1", "0", "0", "0"], ["8", "2", "0", "0", "0"], ["8", "4", "0", "0", "0"], ["3", "", "0"]];

for (const lang of ["cs", "de"]) {
  for (const columns of [80, 120]) {
    test(`the screens of the menu in ${lang} at ${columns} columns: where they are, options in columns, [0] last, nothing wider`, opts, async () => {
      const w = await world();
      try {
        const outs = [];
        for (const walk of WALKS) outs.push(await terminal(w, walk, columns, lang));
        // the permissions of archives: the item's number on the archives' screen
        const key = /\[(\d+)\] {2}(Svolení ke stahování|Erlaubnis)/u.exec(outs[3]!)?.[1];
        assert.ok(key, outs[3]);
        outs.push(await terminal(w, ["8", "4", key!, "0", "0", "0", "0"], columns, lang));
        // each screen once, by where it is
        const seen = new Map<string, string>();
        for (const s of outs.flatMap(screens)) if (!seen.has(s.split("\n")[0]!)) seen.set(s.split("\n")[0]!, s);
        for (const [where, s] of seen) checked(s, columns, `${lang} ${columns} ${where}`);
        assert.ok([...seen.keys()].some((c) => / › .+ › /u.test(c)), `three levels said: ${[...seen.keys()].join(" | ")}`);
        // the screens of the findings of 26. 11.: the fixes with nothing found, the setup's question, working alone
        for (const where of [/ › (Opravy stromu|Korrekturen von strom)$/u, / › (Průvodce nastavením|Einrichtung)$/u, / › (Samostatná práce agenta|Der Agent allein)$/u])
          assert.ok([...seen.keys()].some((c) => where.test(c)), `${where}: ${[...seen.keys()].join(" | ")}`);
        // pictured without the setup's question: its items are not the same on each system (the terminal: macOS and
        // Windows), checked above all the same
        pictured(`menu-${lang}-${columns}`, steady([...seen].filter(([c]) => !/ › (Průvodce nastavením|Einrichtung)$/u.test(c)).map(([, s]) => s).join("\n\n-----\n\n"), w));
      } finally {
        w.cleanup();
      }
    });
  }
}

// What waits: its places · a place of its own (two letters) · the family's one thing; the fixes from maintenance, the
// question before and what [?] Details says after it
const WAITING = [["3", "1", "0", "0", "0"], ["3", "2", "0", "0", "0"], ["8", "8", "3", "?", "0", "", "0", "0", "0"]];

for (const lang of ["cs", "de"]) {
  for (const columns of [80, 120]) {
    test(`What waits and the fixes in ${lang} at ${columns} columns: the place's name in the crumbs, cut; before the question what, how many and the cost, the rest behind [?]`, opts, async () => {
      const w = await waitingWorld();
      try {
        const outs = [];
        for (const walk of WAITING) outs.push(await terminal(w, walk, columns, lang));
        const seen = new Map<string, string>();
        for (const s of outs.flatMap(screens)) if (!seen.has(s.split("\n")[0]!)) seen.set(s.split("\n")[0]!, s);
        for (const [where, s] of seen) checked(s, columns, `${lang} ${columns} ${where}`);
        const crumbs = [...seen.keys()];
        // the office's long name cut whole words in the crumbs, the screen of the family's thing with its crumbs too
        assert.ok(crumbs.some((c) => / › Matriční úřad Lhota nad Lhotkou…$/u.test(c)), crumbs.join(" | "));
        assert.ok(crumbs.some((c) => / › (Rodina|Familie)$/u.test(c)), crumbs.join(" | "));
        // the replies offered as every option is: [?], two spaces, what it is
        assert.match(outs[0]!, /\n {2}\[\?\] {2}(čeká na odpověď|wartet auf Antwort) 1\n/u);
        // the fixes: their way above them, three lines before the question, [?] before [0], the rest only after [?]
        const fixes = seen.get(crumbs.find((c) => / › (Opravy stromu|Korrekturen von strom)$/u.test(c))!)!;
        assert.ok(fixes, crumbs.join(" | "));
        assert.match(fixes, /\n {2}\[\?\] {2}(Podrobnosti|Details)\n\n {2}\[0\]/u);
        const before = fixes.split("\n").filter((l) => l && !/^Strom/u.test(l)).findIndex((l) => /^(Napravit|Beheben)\?/u.test(l));
        assert.ok(before >= 3 && before <= 5, fixes);
        const details = outs[2]!.slice(outs[2]!.indexOf(fixes.split("\n").at(-1)!) + fixes.split("\n").at(-1)!.length);
        assert.match(details, /m-old/u);
        assert.doesNotMatch(fixes, /m-old \(1/u);
        for (const l of details.split("\n")) assert.ok(shown(l) <= columns, `wider than ${columns}: ${l}`);
        const told = details.slice(0, details.search(/\n(Volba|Auswahl)/u));
        pictured(`waiting-${lang}-${columns}`, steady([...seen.values()].join("\n\n-----\n\n") + "\n\n----- [?]\n" + told, w));
      } finally {
        w.cleanup();
      }
    });
  }
}
