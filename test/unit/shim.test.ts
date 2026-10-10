// The tree's strom.cmd: cmd reads a batch file's lines in the console's code page, so an installation whose path has
// letters outside ASCII is named only after the console is put to UTF-8 (and given back); an ASCII path keeps two lines.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureShimMarker, refreshTreeShim, shimCmd, shimMarker, shimNeedsCodePage, stromLauncher, writeShim } from "../../src/core/self.ts";

/** The mark beside cli.js there (made), or not to be made. */
const marked = () => true;
const unmarked = () => false;

const cli = "C:\\Users\\Public\\AppData\\Local\\Programs\\Strom\\app\\dist\\cli.js";

test("an installation in ASCII: strom.cmd stays the two lines it was", () => {
  const node = "C:\\Users\\Public\\AppData\\Local\\Programs\\Strom\\node\\node.exe";
  assert.equal(shimCmd(node, [cli], { LOCALAPPDATA: "C:\\Users\\Public\\AppData\\Local" }), `@echo off\r\n"${node}" "${cli}" %*\r\n`);
});

test("an installation whose path has letters outside ASCII: the console in UTF-8 before the line naming it, given back after", () => {
  const nfc = "C:\\Users\\Lukáš Dvořák\\AppData\\Local\\Programs\\Strom\\node\\node.exe";
  const nfd = nfc.normalize("NFD");
  assert.notEqual(nfd, nfc);
  const cyrillic = "C:\\Users\\Пётр\\AppData\\Local\\Programs\\Strom\\node\\node.exe";
  for (const node of [nfc, nfd, cyrillic]) {
    const text = shimCmd(node, [cli], {});
    assert.equal(text.includes(":literal"), false, "no folder of the profile: the chcp form only");
    const lines = text.split("\r\n");
    assert.equal(text.replace(/\r\n/g, "").includes("\n"), false, "CRLF everywhere");
    assert.equal(text.replace(/\r\n/g, "").includes("\r"), false, "CRLF everywhere");
    const at = lines.findIndex((l) => l.includes(node));
    assert.ok(at > 0, "the node path verbatim");
    assert.equal(lines[at], `"${node}" "${cli}" %*`, "quoted");
    const before = Buffer.from(lines.slice(0, at).join("\r\n"), "utf8");
    assert.ok(before.every((b) => b < 0x80), "every line before it reads the same in any code page");
    const chcp = lines.indexOf("chcp 65001 >nul 2>nul");
    assert.ok(chcp >= 0 && chcp < at, "UTF-8 before the path");
    assert.equal(lines[0], "@echo off");
    assert.equal(lines[1], "setlocal DisableDelayedExpansion", "a ! of a path kept under cmd /v:on");
    assert.equal(lines.filter((l) => l === "setlocal").length, 0, "one setlocal, at the top");
    // the code page as the last word of chcp's line: any language, with or without a colon
    assert.ok(lines.includes('for /f "delims=" %%l in (\'chcp\') do for %%w in (%%l) do set "_STROMCP=%%w"'));
    assert.ok(lines.includes('set "_STROMRC=%ERRORLEVEL%"'));
    assert.ok(lines.includes("if defined _STROMCP chcp %_STROMCP:.=% >nul 2>nul"));
    assert.ok(text.endsWith("exit /b %_STROMRC%\r\n"));
  }
  // an argument outside ASCII counts the same
  assert.match(shimCmd("C:\\node\\node.exe", ["C:\\Strom výzkum\\cli.js"], {}), /chcp 65001/);
});

const local = "C:\\Users\\Lukáš\\AppData\\Local";
const inLocal = { node: `${local}\\Programs\\Strom\\node\\node.exe`, cli: `${local}\\Programs\\Strom\\app\\dist\\cli.js` };

test("an installation under a folder of the profile: named through it first, in ASCII; the literal path with chcp after", () => {
  for (const env of [{ LOCALAPPDATA: local }, { LOCALAPPDATA: local.toUpperCase() + "\\" }, { LOCALAPPDATA: local.normalize("NFD") }]) {
    const text = shimCmd(inLocal.node, [inLocal.cli], env, marked);
    const lines = text.split("\r\n");
    const at = lines.indexOf(":literal");
    assert.ok(at > 0, JSON.stringify(env));
    assert.deepEqual(lines.slice(0, at + 1), [
      "@echo off",
      "setlocal DisableDelayedExpansion",
      'if not exist "%LOCALAPPDATA%\\Programs\\Strom\\node\\node.exe" goto literal',
      'if not exist "%LOCALAPPDATA%\\Programs\\Strom\\app\\dist\\cli.js" goto literal',
      `if not exist "%LOCALAPPDATA%\\Programs\\Strom\\app\\dist\\${shimMarker(inLocal.cli)}" goto literal`,
      '"%LOCALAPPDATA%\\Programs\\Strom\\node\\node.exe" "%LOCALAPPDATA%\\Programs\\Strom\\app\\dist\\cli.js" %*',
      "exit /b %ERRORLEVEL%",
      ":literal",
    ]);
    const literal = lines.indexOf(`"${inLocal.node}" "${inLocal.cli}" %*`);
    assert.ok(literal > lines.indexOf("chcp 65001 >nul 2>nul") && lines.indexOf("chcp 65001 >nul 2>nul") > at);
    assert.ok(Buffer.from(lines.slice(0, literal).join("\r\n"), "utf8").every((b) => b < 0x80));
    assert.ok(text.endsWith("exit /b %_STROMRC%\r\n"));
    assert.equal(shimNeedsCodePage(inLocal.node, [inLocal.cli], env, marked), false);
  }
  // LOCALAPPDATA first when more fit
  assert.ok(shimCmd(inLocal.node, [inLocal.cli], { USERPROFILE: "C:\\Users\\Lukáš", LOCALAPPDATA: local }, marked).includes('"%LOCALAPPDATA%\\Programs'));
  // Node literal in ASCII, strom through a folder of the profile (npm's under APPDATA): named so, its mark checked
  const roaming = "C:\\Users\\Lukáš\\AppData\\Roaming";
  const npmCli = `${roaming}\\npm\\node_modules\\strom-research\\dist\\cli.js`;
  const npm = shimCmd("C:\\Program Files\\nodejs\\node.exe", [npmCli], { APPDATA: roaming }, marked);
  assert.ok(npm.includes(`if not exist "%APPDATA%\\npm\\node_modules\\strom-research\\dist\\${shimMarker(npmCli)}" goto literal\r\n`), npm);
  assert.ok(npm.includes('"C:\\Program Files\\nodejs\\node.exe" "%APPDATA%\\npm\\node_modules\\strom-research\\dist\\cli.js" %*\r\nexit /b %ERRORLEVEL%\r\n'), npm);
});

test("Node and strom under different folders of the profile: no line through them (a Node of another profile would run this strom)", () => {
  const roaming = "C:\\Users\\Lukáš\\AppData\\Roaming";
  const env = { APPDATA: roaming, USERPROFILE: "C:\\Users\\Lukáš", LOCALAPPDATA: local };
  const text = shimCmd("C:\\Users\\Lukáš\\node\\node.exe", [`${roaming}\\npm\\node_modules\\strom-research\\dist\\cli.js`], env, marked);
  assert.equal(text.includes(":literal"), false, text);
  assert.equal(text.includes("%APPDATA%") || text.includes("%USERPROFILE%"), false, text);
  assert.match(text, /chcp 65001/);
  assert.equal(shimNeedsCodePage("C:\\Users\\Lukáš\\node\\node.exe", [`${roaming}\\npm\\node_modules\\strom-research\\dist\\cli.js`], env, marked), true);
  // strom in ASCII, Node through a folder of the profile: no mark to tell it, no line through it either
  assert.equal(shimCmd(inLocal.node, ["C:\\strom\\dist\\cli.js"], env, marked).includes(":literal"), false);
});

test("the mark cannot be made beside cli.js: no line through the folder of the profile, the chcp form only, said by doctor", () => {
  const env = { LOCALAPPDATA: local };
  const text = shimCmd(inLocal.node, [inLocal.cli], env, unmarked);
  assert.equal(text.includes(":literal"), false, text);
  assert.equal(text.includes("%LOCALAPPDATA%"), false, text);
  assert.match(text, /chcp 65001/);
  assert.equal(shimNeedsCodePage(inLocal.node, [inLocal.cli], env, unmarked), true);
  // asked for the entry script itself
  const asked: string[] = [];
  shimCmd(inLocal.node, [inLocal.cli], env, (c) => (asked.push(c), true));
  assert.deepEqual(asked, [inLocal.cli]);
});

test("the mark's name: the SHA-256 of the script's path, Windows' way — the same for any case, slashes or NFD, another for another path", () => {
  const m = shimMarker(inLocal.cli);
  assert.match(m, /^\.strom-shim-[0-9a-f]{16}$/);
  assert.equal(shimMarker(inLocal.cli.toUpperCase()), m);
  assert.equal(shimMarker(inLocal.cli.normalize("NFD")), m);
  assert.equal(shimMarker(inLocal.cli.replace(/\\/g, "/")), m);
  // the person's own strom where the folder of the profile is another: another mark
  assert.notEqual(shimMarker("C:\\Users\\Lukáš\\AppData\\Local\\Programs\\Strom-beta\\app\\dist\\cli.js"), m);
  assert.notEqual(shimMarker("C:\\Users\\Pavel\\AppData\\Local\\Programs\\Strom\\app\\dist\\cli.js"), m);
});

test("every way out of strom.cmd says strom's exit: no bare exit /b; the two lines of ASCII end with Node's line (cmd /c passes its code)", () => {
  const cases = [
    shimCmd(inLocal.node, [inLocal.cli], { LOCALAPPDATA: local }, marked),
    shimCmd(inLocal.node, [inLocal.cli], { LOCALAPPDATA: local }, unmarked),
    shimCmd("C:\\Strom výzkum\\node.exe", ["C:\\Strom výzkum\\cli.js"], {}),
  ];
  for (const text of cases) {
    const lines = text.split("\r\n");
    for (const l of lines) if (/^exit\b/i.test(l)) assert.match(l, /^exit \/b (%ERRORLEVEL%|%_STROMRC%)$/, text);
    // a line running strom is followed by one keeping its exit
    for (let i = 0; i < lines.length; i++) if (/%\*$/.test(lines[i]!)) assert.match(lines[i + 1]!, /^(exit \/b %ERRORLEVEL%|set "_STROMRC=%ERRORLEVEL%")$/, text);
    // before :literal (the branch's end) and at the end of the file: an exit with its code
    const at = lines.indexOf(":literal");
    if (at >= 0) assert.equal(lines[at - 1], "exit /b %ERRORLEVEL%");
    assert.equal(lines.filter((l) => l).at(-1), "exit /b %_STROMRC%");
  }
  const ascii = shimCmd("C:\\strom\\node.exe", ["C:\\strom\\cli.js"], {}).split("\r\n");
  assert.deepEqual(ascii, ["@echo off", '"C:\\strom\\node.exe" "C:\\strom\\cli.js" %*', ""]);
});

test("a % in the path is written %% in every line naming it literally (cmd turns %% into %), never through a variable", () => {
  const node = "C:\\Tools 100%\\node\\node.exe";
  const cliPct = "C:\\Tools 100%\\strom\\cli.js";
  assert.equal(shimCmd(node, [cliPct], {}), '@echo off\r\n"C:\\Tools 100%%\\node\\node.exe" "C:\\Tools 100%%\\strom\\cli.js" %*\r\n');
  // outside ASCII too: the literal line after chcp
  const odd = "C:\\Lukáš %TEMP%\\node.exe";
  const lines = shimCmd(odd, [cliPct], {}).split("\r\n");
  assert.ok(lines.includes('"C:\\Lukáš %%TEMP%%\\node.exe" "C:\\Tools 100%%\\strom\\cli.js" %*'), lines.join("\n"));
  assert.ok(!lines.some((l) => /[^%]%TEMP%[^%]/.test(l)));
  // named through a folder of the profile: the rest of a path and an ASCII path beside it doubled as well
  const pctCli = `${local}\\Programs\\50% Strom\\app\\cli.js`;
  const text = shimCmd(`${local}\\Programs\\50% Strom\\node.exe`, [pctCli], { LOCALAPPDATA: local }, marked);
  assert.ok(text.includes('if not exist "%LOCALAPPDATA%\\Programs\\50%% Strom\\node.exe" goto literal'), text);
  assert.ok(text.includes(`if not exist "%LOCALAPPDATA%\\Programs\\50%% Strom\\app\\${shimMarker(pctCli)}" goto literal`), text);
  assert.ok(text.includes('"%LOCALAPPDATA%\\Programs\\50%% Strom\\node.exe" "%LOCALAPPDATA%\\Programs\\50%% Strom\\app\\cli.js" %*'), text);
  assert.ok(text.includes(`"${local}\\Programs\\50%% Strom\\node.exe" "${local}\\Programs\\50%% Strom\\app\\cli.js" %*`), text);
});

test("no folder of the profile holds it, or one whose value cmd would misread: the chcp form only, said by doctor", () => {
  const node = "C:\\strom\\Č-Lukáš\\inst\\node\\node.exe";
  const env = { LOCALAPPDATA: local, APPDATA: "C:\\Users\\Lukáš\\AppData\\Roaming", USERPROFILE: "C:\\Users\\Lukáš" };
  assert.equal(shimCmd(node, [cli], env, marked).includes(":literal"), false);
  assert.equal(shimNeedsCodePage(node, [cli], env, marked), true);
  // a value with %, " or ^ is never written into the file
  for (const odd of ["C:\\Users\\Lukáš%x%\\AppData\\Local", 'C:\\Users\\Luk"áš\\AppData\\Local', "C:\\Users\\Lukáš^\\AppData\\Local"]) {
    const text = shimCmd(`${odd}\\Programs\\Strom\\node\\node.exe`, [`${odd}\\Programs\\Strom\\app\\dist\\cli.js`], { LOCALAPPDATA: odd }, marked);
    assert.equal(text.includes("%LOCALAPPDATA%"), false, odd);
    assert.match(text, /chcp 65001/);
  }
  // the rest outside ASCII, or a folder only its name begins with: not named through it
  assert.equal(shimNeedsCodePage(`${local}\\Programs\\Štrom\\node.exe`, [`${local}\\Programs\\Štrom\\cli.js`], { LOCALAPPDATA: local }, marked), true);
  assert.equal(shimNeedsCodePage(`${local}X\\Programs\\node.exe`, [`${local}X\\Programs\\cli.js`], { LOCALAPPDATA: local }, marked), true);
  // in ASCII: nothing to say, the file as it was, no mark asked for
  const never = () => assert.fail("no mark for an ASCII path");
  assert.equal(shimNeedsCodePage("C:\\strom\\node.exe", [cli], env, never), false);
  assert.equal(shimCmd("C:\\strom\\node.exe", [cli], env, never), `@echo off\r\n"C:\\strom\\node.exe" "${cli}" %*\r\n`);
});

test("writeShim writes the tree's strom.cmd, strom-hook.cmd and strom", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom-shim-"));
  try {
    const dir = writeShim(root);
    assert.equal(dir, path.join(root, ".strom", "bin"));
    const { command, args } = stromLauncher();
    const run = [command, ...args].map((a) => `"${a}"`).join(" ");
    assert.equal(fs.readFileSync(path.join(dir, "strom.cmd"), "utf8"), shimCmd(command, args));
    assert.equal(fs.readFileSync(path.join(dir, "strom-hook.cmd"), "utf8"), `@echo off\r\ncall "%~dp0strom.cmd" %*\r\nexit /b 0\r\n`);
    assert.equal(fs.readFileSync(path.join(dir, "strom"), "utf8"), `#!/bin/sh\nexec ${run} "$@"\n`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/** A temporary installation in a folder of the profile outside ASCII: its Node and cli.js, the profile's folder. */
function fakeInstall(): { base: string; local: string; node: string; cli: string; dist: string } {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "strom-shim-inst-"));
  const local = path.join(base, "Lukáš", "AppData", "Local");
  const prog = path.join(local, "Programs", "Strom");
  const dist = path.join(prog, "app", "dist");
  fs.mkdirSync(dist, { recursive: true });
  fs.mkdirSync(path.join(prog, "node"), { recursive: true });
  const node = path.join(prog, "node", "node.exe");
  const cli = path.join(dist, "cli.js");
  fs.writeFileSync(node, "");
  fs.writeFileSync(cli, "");
  return { base, local, node, cli, dist };
}

test("writeShim marks this installation beside cli.js and checks the mark before naming it through the folder of the profile", () => {
  const inst = fakeInstall();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom-shim-"));
  try {
    const env = { LOCALAPPDATA: inst.local };
    const dir = writeShim(root, env, { command: inst.node, args: [inst.cli] });
    const marker = path.join(inst.dist, shimMarker(inst.cli));
    assert.equal(fs.readFileSync(marker, "utf8"), "", "an empty mark beside cli.js");
    const text = fs.readFileSync(path.join(dir, "strom.cmd"), "utf8");
    assert.ok(text.includes(`if not exist "%LOCALAPPDATA%${path.sep}Programs${path.sep}Strom${path.sep}app${path.sep}dist\\${shimMarker(inst.cli)}" goto literal`), text);
    assert.ok(text.includes("exit /b %ERRORLEVEL%\r\n:literal\r\n"), text);
    // written again: the mark kept, the same file
    assert.equal(ensureShimMarker(inst.cli), true);
    writeShim(root, env, { command: inst.node, args: [inst.cli] });
    assert.equal(fs.readFileSync(path.join(dir, "strom.cmd"), "utf8"), text);
    // strom update replaced the folder: no mark, the next writeShim makes it again
    fs.rmSync(marker);
    assert.equal(fs.existsSync(marker), false);
    writeShim(root, env, { command: inst.node, args: [inst.cli] });
    assert.equal(fs.existsSync(marker), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(inst.base, { recursive: true, force: true });
  }
});

test("writeShim where the mark cannot be made (no right to write, no folder): no line through the folder of the profile, never an error", () => {
  const inst = fakeInstall();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom-shim-"));
  const asRoot = typeof process.getuid === "function" && process.getuid() === 0;
  try {
    const env = { LOCALAPPDATA: inst.local };
    if (process.platform !== "win32" && !asRoot) {
      fs.chmodSync(inst.dist, 0o555);
      try {
        const dir = writeShim(root, env, { command: inst.node, args: [inst.cli] });
        const text = fs.readFileSync(path.join(dir, "strom.cmd"), "utf8");
        assert.equal(text.includes("%LOCALAPPDATA%"), false, text);
        assert.equal(text.includes(":literal"), false, text);
        assert.match(text, /chcp 65001/);
        assert.equal(fs.existsSync(path.join(inst.dist, shimMarker(inst.cli))), false);
        assert.equal(shimNeedsCodePage(inst.node, [inst.cli], env), true);
      } finally {
        fs.chmodSync(inst.dist, 0o755);
      }
    }
    // a cli.js whose folder is not there
    const gone = path.join(inst.local, "Programs", "Strom", "app", "none", "cli.js");
    assert.equal(ensureShimMarker(gone), false);
    const dir = writeShim(root, env, { command: inst.node, args: [gone] });
    assert.equal(fs.readFileSync(path.join(dir, "strom.cmd"), "utf8").includes("%LOCALAPPDATA%"), false);
    // a checkout of the sources: never a mark there
    fs.mkdirSync(path.join(inst.dist, "..", ".git"));
    assert.equal(ensureShimMarker(inst.cli), false);
    assert.equal(fs.existsSync(path.join(inst.dist, shimMarker(inst.cli))), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(inst.base, { recursive: true, force: true });
  }
});

test("writeShim for an installation in ASCII: the two lines as before, no mark written", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "strom-shim-ascii-"));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom-shim-"));
  try {
    const dist = path.join(base, "Programs", "Strom", "app", "dist");
    fs.mkdirSync(dist, { recursive: true });
    const node = path.join(base, "Programs", "Strom", "node", "node.exe");
    const cliA = path.join(dist, "cli.js");
    const dir = writeShim(root, { LOCALAPPDATA: base }, { command: node, args: [cliA] });
    assert.equal(fs.readFileSync(path.join(dir, "strom.cmd"), "utf8"), `@echo off\r\n"${node}" "${cliA}" %*\r\n`);
    assert.deepEqual(fs.readdirSync(dist), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("refreshTreeShim: a research's .strom/bin written again for this installation, its mark made; none where it has none, none in an archive", () => {
  const inst = fakeInstall();
  const trees = fs.mkdtempSync(path.join(os.tmpdir(), "strom-shim-trees-"));
  try {
    const env = { LOCALAPPDATA: inst.local };
    const launcher = { command: inst.node, args: [inst.cli] };
    const research = path.join(trees, "Výzkum");
    fs.mkdirSync(path.join(research, ".strom", "bin"), { recursive: true });
    fs.writeFileSync(path.join(research, "strom.json"), JSON.stringify({ name: "Výzkum" }));
    fs.writeFileSync(path.join(research, ".strom", "bin", "strom.cmd"), '@echo off\r\n"%LOCALAPPDATA%\\old\\node.exe" %*\r\nexit /b\r\n');
    assert.equal(refreshTreeShim(research, env, launcher), true);
    const text = fs.readFileSync(path.join(research, ".strom", "bin", "strom.cmd"), "utf8");
    assert.equal(text, shimCmd(inst.node, [inst.cli], env));
    assert.ok(text.includes(shimMarker(inst.cli)));
    assert.equal(fs.existsSync(path.join(inst.dist, shimMarker(inst.cli))), true);
    assert.equal(refreshTreeShim(research, env, launcher), false, "as it is: nothing written");
    // the mark went with the app folder an update replaced: made again
    fs.rmSync(path.join(inst.dist, shimMarker(inst.cli)));
    assert.equal(refreshTreeShim(research, env, launcher), false);
    assert.equal(fs.existsSync(path.join(inst.dist, shimMarker(inst.cli))), true);
    // no .strom/bin: none made
    const none = path.join(trees, "Bez");
    fs.mkdirSync(none);
    fs.writeFileSync(path.join(none, "strom.json"), JSON.stringify({ name: "Bez" }));
    assert.equal(refreshTreeShim(none, env, launcher), false);
    assert.equal(fs.existsSync(path.join(none, ".strom")), false);
    // an archive: untouched
    const archive = path.join(trees, "Archiv");
    fs.mkdirSync(path.join(archive, ".strom", "bin"), { recursive: true });
    fs.writeFileSync(path.join(archive, "strom.json"), JSON.stringify({ name: "Archiv", mode: "archive" }));
    fs.writeFileSync(path.join(archive, ".strom", "bin", "strom.cmd"), "old");
    assert.equal(refreshTreeShim(archive, env, launcher), false);
    assert.equal(fs.readFileSync(path.join(archive, ".strom", "bin", "strom.cmd"), "utf8"), "old");
    // a folder not there: no error
    assert.equal(refreshTreeShim(path.join(trees, "gone"), env, launcher), false);
  } finally {
    fs.rmSync(trees, { recursive: true, force: true });
    fs.rmSync(inst.base, { recursive: true, force: true });
  }
});

test("a ! in a path: delayed expansion off before any line names it (cmd /v:on would take it); an ASCII path without one as before", () => {
  const bang = "C:\\Tools!\\strom\\cli.js";
  assert.equal(shimCmd("C:\\Tools!\\node.exe", [bang], {}), '@echo off\r\nsetlocal DisableDelayedExpansion\r\n"C:\\Tools!\\node.exe" "C:\\Tools!\\strom\\cli.js" %*\r\n');
  assert.equal(shimCmd("C:\\Tools\\node.exe", ["C:\\Tools\\cli.js"], {}), '@echo off\r\n"C:\\Tools\\node.exe" "C:\\Tools\\cli.js" %*\r\n');
  // outside ASCII: the line before both ways, the variable's and the literal one
  const cliBang = `${local}\\Programs\\Strom!\\app\\cli.js`;
  const lines = shimCmd(`${local}\\Programs\\Strom!\\node.exe`, [cliBang], { LOCALAPPDATA: local }, marked).split("\r\n");
  assert.deepEqual(lines.slice(0, 2), ["@echo off", "setlocal DisableDelayedExpansion"]);
  const named = lines.findIndex((l) => l.includes("%LOCALAPPDATA%") && l.endsWith("%*"));
  const literal = lines.findIndex((l) => l.startsWith(`"${local}`));
  assert.ok(named > 1 && literal > named, lines.join("\n"));
  assert.ok(lines[named]!.includes("Strom!"));
  assert.equal(lines.at(-2), "exit /b %_STROMRC%");
});
