// The terminal strom opens its windows in (the setting terminal): macOS opens the one chosen by its bundle ID, one not
// installed falls back to the system's (said in the window), the setting is this computer's alone and never a link's.
// No real window opens: a stand-in `open` first on PATH writes down what it was asked.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { World } from "../helpers.ts";
import { openInNewTerminal } from "../../src/core/shortcut.ts";
import { linkText, parseLink } from "../../src/core/links.ts";
import { terminalChoices, terminalsHere } from "../../src/core/terminal.ts";

const posix = process.platform !== "win32";

/** A stand-in `open`: each call a line in calls.txt; `-b` of a terminal not installed (NO_BUNDLE=1) fails as open does. */
function fakeOpen(w: World): { env: Record<string, string>; calls: () => string[] } {
  const bin = path.join(w.dir, "fake-bin");
  fs.mkdirSync(bin, { recursive: true });
  const log = path.join(w.dir, "calls.txt");
  fs.writeFileSync(path.join(bin, "open"), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\nif [ "$1" = "-b" ] && [ "$NO_BUNDLE" = "1" ]; then exit 1; fi\nexit 0\n`, { mode: 0o755 });
  return {
    env: { ...w.env, STROM_NO_OPEN: "", PATH: [bin, w.env.PATH].join(path.delimiter) },
    calls: () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean) : []),
  };
}

/** The detached `open` writes its line a moment later. */
async function until(calls: () => string[], n: number): Promise<string[]> {
  for (let i = 0; i < 100 && calls().length < n; i++) await new Promise((r) => setTimeout(r, 30));
  return calls();
}

test("macOS: no terminal chosen (or system) — open <script>.command as before", { skip: !posix }, async () => {
  const w = new World();
  const cwd = path.join(w.dir, "Novákovi");
  fs.mkdirSync(cwd);
  const f = fakeOpen(w);
  assert.equal(openInNewTerminal(["menu"], cwd, f.env, "darwin"), true);
  const [call] = await until(f.calls, 1);
  assert.match(call!, /\/\.strom\/open\/strom-[0-9a-z]+\.command$/u);
  assert.doesNotMatch(call!, /^-b /u);
  w.cleanup();
});

test("macOS: iTerm2 chosen — open -b com.googlecode.iterm2 <script>.command, nothing else", { skip: !posix }, async () => {
  const w = new World();
  const cwd = path.join(w.dir, "Novákovi");
  fs.mkdirSync(cwd);
  const f = fakeOpen(w);
  assert.equal(openInNewTerminal(["link", "open", "x"], cwd, f.env, "darwin", { terminal: "iterm2", lang: "cs" }), true);
  const calls = f.calls();
  assert.equal(calls.length, 1);
  assert.match(calls[0]!, /^-b com\.googlecode\.iterm2 \/.*\.command$/u);
  const script = fs.readdirSync(path.join(cwd, ".strom", "open"))[0]!;
  assert.doesNotMatch(fs.readFileSync(path.join(cwd, ".strom", "open", script), "utf8"), /printf/u, "nothing said when it opened");
  w.cleanup();
});

test("macOS: iTerm2 chosen but not installed — the system's terminal opens, the window says so first (fallback)", { skip: !posix }, async () => {
  const w = new World();
  const cwd = path.join(w.dir, "Novákovi");
  fs.mkdirSync(cwd);
  const f = fakeOpen(w);
  assert.equal(openInNewTerminal(["link", "open", "x"], cwd, { ...f.env, NO_BUNDLE: "1" }, "darwin", { terminal: "iterm2", lang: "cs" }), "fallback");
  const calls = await until(f.calls, 2);
  assert.match(calls[0]!, /^-b com\.googlecode\.iterm2 /u);
  assert.match(calls[1]!, /^\/.*\.command$/u, "then the system's: open <script>");
  const dir = path.join(cwd, ".strom", "open");
  const body = fs.readFileSync(path.join(dir, fs.readdirSync(dir)[0]!), "utf8");
  assert.match(body, /^#!\/bin\/sh\nrm -f -- "\$0"\nprintf '%s\\n\\n' 'iTerm2 tu není nainstalovaný, okno se otevřelo ve výchozím terminálu\.'\n/u);
  // the sentence as the window shows it (a copy that stops before strom)
  const copy = path.join(dir, "copy.command");
  fs.writeFileSync(copy, body.replace(/^exec .*$/mu, "exit 0"), { mode: 0o755 });
  const { spawnSync } = await import("node:child_process");
  assert.equal(spawnSync("/bin/sh", [copy], { encoding: "utf8" }).stdout, "iTerm2 tu není nainstalovaný, okno se otevřelo ve výchozím terminálu.\n\n");
  w.cleanup();
});

test("Linux and Windows: the chosen terminal changes nothing (P1 is macOS)", { skip: !posix }, () => {
  const w = new World();
  const cwd = path.join(w.dir, "Novákovi");
  fs.mkdirSync(cwd);
  const f = fakeOpen(w);
  // Linux without a desktop: no window, open never asked
  assert.equal(openInNewTerminal(["menu"], cwd, { ...f.env, DISPLAY: "", WAYLAND_DISPLAY: "" }, "linux", { terminal: "iterm2" }), false);
  assert.deepEqual(f.calls(), []);
  assert.deepEqual(terminalChoices("linux"), ["system"]);
  assert.deepEqual(terminalChoices("win32"), ["system"]);
  assert.deepEqual(terminalChoices("darwin"), ["system", "terminal", "iterm2"]);
  w.cleanup();
});

test("strom config set/get/unset terminal: values of this system only, the user's alone — a tree's strom.json never counts", async () => {
  const w = new World();
  await w.withTree();
  const mac = process.platform === "darwin";
  const set = await w.run(["config", "set", "terminal", "iterm2", "--json"]);
  if (mac) {
    assert.equal(set.code, 0, set.err);
    assert.equal((await w.ok(["config", "get", "terminal", "--json"])).json.value, "iterm2");
    assert.equal(JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), "utf8")).terminal, "iterm2");
  } else assert.equal(set.code, 2);
  // a value no system takes: an error with the values this one does
  const bad = await w.run(["config", "set", "terminal", "wezterm"]);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /invalid terminal "wezterm"/u);
  assert.match(bad.err, mac ? /system, terminal, iterm2/u : /system/u);
  // a path or a command is no value
  assert.equal((await w.run(["config", "set", "terminal", "/Applications/iTerm.app"])).code, 2);
  // never for one tree
  assert.notEqual((await w.run(["config", "set", "terminal", "system", "--for-tree"])).code, 0);
  // unset: what holds now said — the system's, the default (found: "terminal unset — now (unset) (unset)")
  const unset = await w.ok(["config", "unset", "terminal"]);
  assert.equal(unset.out.trim(), "terminal unset — now system (default)");
  const got = (await w.ok(["config", "get", "terminal", "--json"])).json;
  assert.deepEqual([got.value, got.source], ["system", "default"]);
  // a research's strom.json carrying it (a folder from someone else): ignored
  const file = path.join(w.cwd, "strom.json");
  fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, "utf8")), terminal: "iterm2" }, null, 2));
  const kept = (await w.ok(["config", "get", "terminal", "--json"])).json;
  assert.deepEqual([kept.value, kept.source], ["system", "default"]);
  w.cleanup();
});

test("a link never chooses the terminal: its parameter terminal is dropped", () => {
  const tree = "0f8c2d4e-1b2a-4c3d-9e8f-7a6b5c4d3e2f";
  for (const action of ["send", "open", "setup", "app"]) {
    const link = parseLink(`strom-research://${action}?tree=${tree}&terminal=iterm2`);
    assert.deepEqual(link, { action, tree }, action);
    assert.doesNotMatch(linkText(link), /terminal/u, "the window's own link carries none either");
  }
  const app = "U3RhcnN5LXN0cm9tLXphLXNhZmFyaS0wMDAwMDAwMDE";
  assert.deepEqual(parseLink(`strom-research://new?app=${app}&terminal=/bin/sh`), { action: "new", app });
});

test("strom link open with no terminal at hand: the chosen terminal's window, the fallback in its result", { skip: process.platform !== "darwin" }, async () => {
  const w = new World();
  await w.withTree();
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  await w.ok(["config", "set", "terminal", "iterm2"]);
  const f = fakeOpen(w);
  // a link's own terminal parameter is not taken: the setting is
  const ok = await w.run(["link", "open", `strom-research://open?tree=${id}&terminal=terminal`, "--json"], { env: f.env });
  assert.equal(ok.code, 0, ok.err);
  assert.match(f.calls()[0]!, /^-b com\.googlecode\.iterm2 /u);
  assert.equal(ok.json.terminal, undefined);
  // not installed: the system's, said in the result
  const open = path.join(w.cwd, ".strom", "open");
  for (const x of fs.readdirSync(open)) fs.rmSync(path.join(open, x));
  const back = await w.run(["link", "open", `strom-research://open?tree=${id}`, "--json"], { env: { ...f.env, NO_BUNDLE: "1" } });
  assert.equal(back.code, 0, back.err);
  assert.equal(back.json.terminal, "fallback");
  assert.equal(back.json.done, true);
  w.cleanup();
});

test("the terminals found here: by their apps (tests: STROM_APP_DIRS), none outside macOS", () => {
  const w = new World();
  const apps = path.join(w.dir, "Applications");
  fs.mkdirSync(path.join(apps, "iTerm.app"), { recursive: true });
  assert.deepEqual(terminalsHere({ ...w.env, STROM_APP_DIRS: apps }, "darwin"), ["iterm2"]);
  fs.mkdirSync(path.join(apps, "Terminal.app"));
  assert.deepEqual(terminalsHere({ ...w.env, STROM_APP_DIRS: apps }, "darwin"), ["terminal", "iterm2"]);
  assert.deepEqual(terminalsHere({ ...w.env, STROM_APP_DIRS: apps }, "linux"), []);
  w.cleanup();
});

/** A folder of apps with these terminals (STROM_APP_DIRS: what strom finds on this computer in a test). */
function appsWith(w: World, ...apps: string[]): string {
  const dir = path.join(w.dir, "Applications");
  for (const a of apps) fs.mkdirSync(path.join(dir, a), { recursive: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test("the menu's settings → the setup: the terminal for the research's windows, only those found here offered", { skip: process.platform !== "darwin" }, async () => {
  const w = new World();
  await w.withTree();
  const env = { STROM_APP_DIRS: appsWith(w, "iTerm.app", "Terminal.app") };
  // 8 settings · 1 the setup · 3 the terminal · 3 iTerm2 · 0 · 0
  const r = await w.ok([], { tty: true, answers: ["8", "1", "3", "3", "0", "0"], env });
  assert.match(r.out, / 3 {2}Terminál pro okna výzkumu \(z aplikace Strom, předaný rozhovor\): výchozí systému\n/u);
  assert.match(r.out, /Ve kterém terminálu otevírat okna výzkumu\?\n {3}1 {2}výchozí systému\n {3}2 {2}Terminál\n {3}3 {2}iTerm2\n {3}0 {2}Zpět\nVybrat \[1\]/u);
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), "utf8")).terminal, "iterm2");
  // its state on the line; 0 changes nothing; the system's default picked: unset
  const again = await w.ok([], { tty: true, answers: ["8", "1", "3", "0", "1", "3", "1", "0", "0"], env });
  assert.match(again.out, /Terminál pro okna výzkumu \(z aplikace Strom, předaný rozhovor\): iTerm2\n/u);
  assert.match(again.out, /Vybrat \[3\]/u, "the one chosen suggested");
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), "utf8")).terminal, undefined);
  // only Terminal here: iTerm2 not offered
  const one = await w.ok([], { tty: true, answers: ["8", "1", "3", "0", "0", "0"], env: { STROM_APP_DIRS: path.join(w.dir, "none") } });
  assert.doesNotMatch(one.out.split("Ve kterém terminálu")[1] ?? "", /iTerm2/u);
  w.cleanup();
});

test("an archive's settings: the terminal line says nothing of a conversation", { skip: process.platform !== "darwin" }, async () => {
  const w = new World();
  await w.withTree();
  await w.ok(["mode", "archive"], { tty: true, answers: ["a"] });
  const r = await w.ok([], { tty: true, answers: ["8", "1", "0", "0", "0"], env: { STROM_APP_DIRS: appsWith(w, "iTerm.app") } });
  assert.match(r.out, /Terminál pro okna výzkumu \(z aplikace Strom\): výchozí systému\n/u);
  assert.doesNotMatch(r.out, /předaný rozhovor/u);
  w.cleanup();
});

test("the setup asks for the terminal only on a Mac with more than one — the one it runs in suggested", { skip: process.platform !== "darwin" }, async () => {
  const w = new World();
  const env = { STROM_APP_DIRS: appsWith(w, "iTerm.app", "Terminal.app"), TERM_PROGRAM: "iTerm.app" };
  const r = await w.ok(["setup"], { tty: true, answers: Array(30).fill(""), env });
  assert.match(r.out, /Ve kterém terminálu otevírat okna výzkumu\?\n {3}1 {2}výchozí systému\n {3}2 {2}Terminál\n {3}3 {2}iTerm2\nVybrat \[3\]/u);
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.env.STROM_CONFIG_DIR!, "config.json"), "utf8")).terminal, "iterm2");
  w.cleanup();
  const one = new World();
  const alone = await one.ok(["setup"], { tty: true, answers: Array(30).fill(""), env: { STROM_APP_DIRS: path.join(one.dir, "none"), TERM_PROGRAM: "iTerm.app" } });
  assert.doesNotMatch(alone.out, /Ve kterém terminálu/u);
  assert.equal(JSON.parse(fs.readFileSync(path.join(one.env.STROM_CONFIG_DIR!, "config.json"), "utf8")).terminal, undefined);
  one.cleanup();
});

test("strom doctor: the terminal chosen; one not installed warned with the way back", { skip: process.platform !== "darwin" }, async () => {
  const w = new World();
  await w.withTree();
  const term = async (env: Record<string, string>) => ((await w.run(["doctor", "--json"], { env })).json.checks as { name: string; status: string; detail: string; fix?: string }[]).find((c) => c.name === "terminal");
  const here = { STROM_APP_DIRS: appsWith(w, "iTerm.app") };
  assert.deepEqual(await term(here), { name: "terminal", label: "terminál pro okna", status: "ok", detail: "výchozí systému" });
  await w.ok(["config", "set", "terminal", "iterm2"]);
  assert.equal((await term(here))!.detail, "iTerm2");
  const gone = await term({ STROM_APP_DIRS: path.join(w.dir, "none") });
  assert.equal(gone!.status, "warn");
  assert.equal(gone!.detail, "zvolený iTerm2 tu není nainstalovaný: okna se otevírají ve výchozím systému");
  assert.equal(gone!.fix, "strom config unset terminal");
  w.cleanup();
});

test("Windows: the menu says the system decides the terminal, and where (cs, en, de)", async () => {
  const { terminalState } = await import("../../src/cli/terminals.ts");
  const { ui } = await import("../../src/cli/ui.ts");
  const ctx = { settings: { terminal: () => "iterm2" }, env: {} } as unknown as Parameters<typeof terminalState>[0];
  assert.equal(terminalState(ctx, "cs", "win32"), "určuje systém");
  assert.equal(ui("cs", "ui.terminal.windows"), "Na Windows terminál určuje systém: Nastavení → Systém → Pro vývojáře → Terminál.");
  assert.equal(ui("en", "ui.terminal.windows"), "On Windows the system decides the terminal: Settings → System → For developers → Terminal.");
  assert.equal(ui("de", "ui.terminal.windows"), "Unter Windows bestimmt das System das Terminal: Einstellungen → System → Für Entwickler → Terminal.");
});

/** Write a terminal into the user's config.json by hand (as a newer strom, another system or an editor would). */
function storeTerminal(w: World, value: string): void {
  const file = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  const cfg = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  fs.writeFileSync(file, JSON.stringify({ ...cfg, terminal: value }, null, 2));
}

const STRANGE = ["foo", "constructor", "__proto__", "toString", "hasOwnProperty"];

test("a terminal in the config this system does not take counts as the system's — a prototype's key never opens", async () => {
  const { Settings } = await import("../../src/core/config.ts");
  const { macTerminal } = await import("../../src/core/terminal.ts");
  for (const v of STRANGE) {
    assert.equal(macTerminal(v, "darwin"), undefined, v);
    const s = new Settings({}, {}, JSON.parse(`{"terminal": ${JSON.stringify(v)}}`));
    assert.equal(s.terminal("darwin"), undefined, v);
    assert.equal(s.terminalUnknown("darwin"), v);
  }
  // another system's: iTerm2 on Linux and Windows is the system's, said by doctor
  const mac = new Settings({}, {}, { terminal: "iterm2" });
  assert.equal(mac.terminal("darwin"), "iterm2");
  assert.equal(mac.terminalUnknown("darwin"), undefined);
  for (const p of ["linux", "win32"] as const) {
    assert.equal(mac.terminal(p), undefined, p);
    assert.equal(mac.terminalUnknown(p), "iterm2", p);
  }
  // system and nothing stored: nothing to say
  assert.equal(new Settings({}, {}, { terminal: "system" }).terminalUnknown("linux"), undefined);
  assert.equal(new Settings({}, {}, {}).terminalUnknown("darwin"), undefined);
  // what the variable says is checked where it is read: the config's value is not said beside it
  assert.equal(new Settings({ STROM_TERMINAL: "system" }, {}, { terminal: "foo" }).terminalUnknown("darwin"), undefined);
});

test("strom doctor: a terminal unknown here warned with the way back, never a failure (foo, constructor, __proto__, another system's)", async () => {
  const w = new World();
  await w.withTree();
  const values = [...STRANGE, ...(process.platform === "darwin" ? [] : ["iterm2"])];
  for (const v of values) {
    storeTerminal(w, v);
    const r = await w.run(["doctor", "--json"], { env: { STROM_APP_DIRS: path.join(w.dir, "none") } });
    assert.doesNotMatch(r.err, /Cannot read properties/u, v);
    const term = (r.json.checks as { name: string; status: string; detail: string; fix?: string }[]).find((c) => c.name === "terminal");
    assert.equal(term!.status, "warn", v);
    assert.equal(term!.detail, `terminál „${v}“ tu strom nezná: okna se otevírají ve výchozím systému`);
    assert.equal(term!.fix, "strom config unset terminal");
  }
  await w.ok(["config", "unset", "terminal"]);
  const ok = (await w.run(["doctor", "--json"])).json.checks as { name: string; status: string }[];
  assert.notEqual(ok.find((c) => c.name === "terminal")?.status, "warn");
  w.cleanup();
});

test("a terminal unknown here: the menu's settings show the system's, a link opens the system's terminal (no open -b)", { skip: process.platform !== "darwin" }, async () => {
  const w = new World();
  await w.withTree();
  const id = JSON.parse(fs.readFileSync(path.join(w.cwd, "strom.json"), "utf8")).id as string;
  const f = fakeOpen(w);
  const open = path.join(w.cwd, ".strom", "open");
  for (const v of STRANGE) {
    storeTerminal(w, v);
    const menu = await w.ok([], { tty: true, answers: ["8", "1", "0", "0", "0"], env: { STROM_APP_DIRS: appsWith(w, "iTerm.app") } });
    assert.match(menu.out, /Terminál pro okna výzkumu \(z aplikace Strom, předaný rozhovor\): výchozí systému\n/u, v);
    if (fs.existsSync(open)) for (const x of fs.readdirSync(open)) fs.rmSync(path.join(open, x));
    const before = f.calls().length;
    const r = await w.run(["link", "open", `strom-research://open?tree=${id}`, "--json"], { env: f.env });
    assert.equal(r.code, 0, `${v}: ${r.err}`);
    assert.equal(r.json.terminal, undefined, v);
    const call = (await until(f.calls, before + 1))[before]!;
    assert.doesNotMatch(call, /^-b /u, v);
    assert.match(call, /\.command$/u, v);
  }
  w.cleanup();
});

test("the bridge says it: terminal.choice in /status features (the app shows its sentence only beside a research that has the choice)", async () => {
  const { BRIDGE_FEATURES } = await import("../../src/core/live.ts");
  assert.ok((BRIDGE_FEATURES as readonly string[]).includes("terminal.choice"));
});
