// The PATH of the person's terminal for a strom the system started (a link from the Strom app, the bridge): what of
// the remembered one and of the agents' folders is missing goes at the end, in its order, once; nothing before what
// the process was given; Windows' Path kept by its name, its folders compared without case.

import { test } from "node:test";
import assert from "node:assert/strict";
import { completePath, fullerPath, pathToRemember, startAgain } from "../../src/core/userpath.ts";
import { ui } from "../../src/cli/ui.ts";
import { agentBinDirs } from "../../src/core/install.ts";

const BARE = "/usr/bin:/bin:/usr/sbin:/sbin";

test("a bare PATH gets the terminal's folders and the agents' at its end, each once, in their order", () => {
  const env = { HOME: "/home/Jiří Novák", PATH: BARE };
  const terminal = "/opt/homebrew/bin:/home/Jiří Novák/.local/bin:/usr/bin:relative/bin::/home/Jiří Novák/.npm-global/bin/";
  assert.equal(
    fullerPath(env, terminal, "linux"),
    [BARE, "/opt/homebrew/bin", "/home/Jiří Novák/.local/bin", "/home/Jiří Novák/.npm-global/bin/", "/home/Jiří Novák/.claude/local", "/home/Jiří Novák/.grok/bin"].join(":"),
  );
  // nothing remembered: the agents' folders alone
  assert.equal(fullerPath(env, undefined, "linux"), `${BARE}:/home/Jiří Novák/.local/bin:/home/Jiří Novák/.claude/local:/home/Jiří Novák/.grok/bin`);
  // what the process was given stays first (the strom of a research's .strom/bin before the person's own)
  const full = { HOME: "/home/a", PATH: "/tree/.strom/bin:/home/a/.local/bin:/home/a/.claude/local/:/home/a/.grok/bin:/opt/homebrew/bin" };
  assert.equal(fullerPath(full, "/opt/homebrew/bin:/home/a/.local/bin", "linux"), undefined, "nothing missing");
});

test("the environment completed in place; Windows' Path by its name, its folders without case", () => {
  const env: Record<string, string | undefined> = { HOME: "/home/a", PATH: BARE };
  assert.equal(completePath(env, "/opt/homebrew/bin", "linux"), true);
  assert.equal(env.PATH, `${BARE}:/opt/homebrew/bin:/home/a/.local/bin:/home/a/.claude/local:/home/a/.grok/bin`);
  assert.equal(completePath(env, "/opt/homebrew/bin", "linux"), false, "the second time: nothing missing");

  const home = "C:\\Users\\Zdeněk";
  const win: Record<string, string | undefined> = { USERPROFILE: home, APPDATA: `${home}\\AppData\\Roaming`, Path: "C:\\Windows\\system32;C:\\Windows" };
  assert.equal(completePath(win, `c:\\windows\\System32;${home}\\AppData\\Roaming\\npm;C:\\Program Files\\nodejs\\`, "win32"), true);
  assert.equal(win.PATH, undefined);
  // (the agents' folders as this platform's path joins them: .local\\bin, the npm folder found in the remembered one already, / and \\ alike)
  const [local, , grok] = agentBinDirs(win, "win32");
  assert.equal(win.Path, `C:\\Windows\\system32;C:\\Windows;${home}\\AppData\\Roaming\\npm;C:\\Program Files\\nodejs\\;${local};${grok}`);
});

test("the PATH to remember: one there and not the one remembered already", () => {
  assert.equal(pathToRemember({ PATH: "/a:/b" }, undefined), "/a:/b");
  assert.equal(pathToRemember({ PATH: "/a:/b" }, "/a:/b"), undefined);
  assert.equal(pathToRemember({ PATH: " " }, "/a"), undefined);
  assert.equal(pathToRemember({ Path: "C:\\x" }, "/a"), "C:\\x");
});

test("the menu's goodbye: strom by its name where the terminal knows it; else a new window does, the full path for this one (found: a window on Windows the Strom app's install line ran in had no strom)", () => {
  const win = { platform: "win32" as const, launchers: ["C:\\Users\\Jiří\\AppData\\Local\\Programs\\Strom\\strom.cmd", "C:\\Users\\Jiří\\AppData\\Local\\Programs\\Strom\\strom"], command: "strom", isolated: false };
  const winPath = "C:\\Windows\\system32;c:\\users\\jiří\\appdata\\local\\programs\\strom\\";
  // Windows, started by the one-line installer: what PATH it was given says nothing of the window (install.ps1 put the
  // folder on the PATH of its own process) — a new window, and the full path for this one
  assert.deepEqual(startAgain({ ...win, given: winPath, installer: true }), { kind: "new", path: win.launchers[0] });
  // Windows, started otherwise: by the PATH it was given (its folders without case, a trailing \ or not)
  assert.deepEqual(startAgain({ ...win, given: winPath, installer: false }), { kind: "name" });
  assert.deepEqual(startAgain({ ...win, given: "C:\\Windows\\system32", installer: false }), { kind: "new", path: win.launchers[0] });
  // a folder with a space: PowerShell runs it as & "…"
  assert.deepEqual(startAgain({ ...win, launchers: ["C:\\Users\\Jiří Novák\\AppData\\Local\\Programs\\Strom\\strom.cmd"], given: "", installer: true }), { kind: "new", path: '& "C:\\Users\\Jiří Novák\\AppData\\Local\\Programs\\Strom\\strom.cmd"' });
  // macOS, Linux: install.sh writes the folder into the shell's profile, a window open already never reads it
  const nix = { platform: "darwin" as const, launchers: ["/Users/jiří/.local/bin/strom"], command: "strom", isolated: false, installer: true };
  assert.deepEqual(startAgain({ ...nix, given: "/usr/bin:/bin" }), { kind: "new", path: "/Users/jiří/.local/bin/strom" });
  assert.deepEqual(startAgain({ ...nix, given: "/usr/bin:/Users/jiří/.local/bin/:/bin" }), { kind: "name" });
  assert.deepEqual(startAgain({ ...nix, launchers: ["/Users/Jiří Novák/.local/bin/strom"], given: "/usr/bin" }), { kind: "new", path: "'/Users/Jiří Novák/.local/bin/strom'" });
  // a second installation: its own command, in its folder of commands
  assert.deepEqual(startAgain({ ...nix, launchers: ["/opt/strom-beta/strom", "/Users/jiří/.local/bin/strom-beta"], command: "strom-beta", given: "/usr/bin:/Users/jiří/.local/bin" }), { kind: "name" });
  assert.deepEqual(startAgain({ ...win, launchers: ["C:\\Beta\\strom.cmd", "C:\\Beta\\bin\\strom-beta.cmd"], command: "strom-beta", given: "C:\\Beta\\bin", installer: true }), { kind: "new", path: "C:\\Beta\\bin\\strom-beta.cmd" });
  // an isolated installation: on no PATH — its full path, nothing of a new window
  assert.deepEqual(startAgain({ ...nix, isolated: true, given: "/usr/bin" }), { kind: "path", path: "/Users/jiří/.local/bin/strom" });
  // npm, the sources: no launcher of the installer — as before
  assert.deepEqual(startAgain({ ...nix, launchers: [], given: "/usr/bin" }), { kind: "name" });
  // another strom answers the name first (an older installation, npm's): the full path, in this window and a new one
  // (found on Windows: `strom` ran 1.12.0 beside 1.18.0-beta.9); after its own folder or elsewhere, the name as before
  const at = (...files: string[]) => (f: string) => files.includes(f);
  const oldWin = "C:\\Users\\Jiří\\AppData\\Roaming\\npm";
  assert.deepEqual(startAgain({ ...win, given: `${oldWin};${winPath}`, installer: false, found: at(`${oldWin}\\strom.ps1`) }), { kind: "path", path: win.launchers[0] });
  assert.deepEqual(startAgain({ ...win, given: `${oldWin};${winPath}`, installer: false, found: at(`${oldWin}\\strom.cmd`) }), { kind: "path", path: win.launchers[0] });
  assert.deepEqual(startAgain({ ...win, given: `${oldWin};${winPath}`, installer: false, found: at(`${oldWin}\\strom`) }), { kind: "name" }, "Windows runs no file without its extension");
  assert.deepEqual(startAgain({ ...win, given: `${winPath};${oldWin}`, installer: false, found: at(`${oldWin}\\strom.cmd`) }), { kind: "name" }, "its own first");
  assert.deepEqual(startAgain({ ...win, given: oldWin, installer: true, found: at(`${oldWin}\\strom.cmd`) }), { kind: "path", path: win.launchers[0] }, "its own not on PATH: a new window runs the other one too");
  assert.deepEqual(startAgain({ ...win, given: `${oldWin};${winPath}`, installer: false, found: at(`${oldWin}\\strom-beta.cmd`) }), { kind: "name" }, "another command's name");
  assert.deepEqual(startAgain({ ...nix, given: "/opt/homebrew/bin:/Users/jiří/.local/bin", found: at("/opt/homebrew/bin/strom") }), { kind: "path", path: "/Users/jiří/.local/bin/strom" });
  assert.deepEqual(startAgain({ ...nix, isolated: true, given: "/opt/old:/Users/jiří/.local/bin", found: at("/opt/old/strom") }), { kind: "path", path: "/Users/jiří/.local/bin/strom" });
  assert.deepEqual(startAgain({ ...nix, given: "/Users/jiří/.local/bin:/opt/homebrew/bin", found: at("/opt/homebrew/bin/strom") }), { kind: "name" });
  // said in every language, nobody addressed
  assert.equal(ui("cs", "ui.menu.bye.new", { path: "C:\\S\\strom.cmd" }), "Na shledanou. V novém okně terminálu stačí spustit: strom – v tomto okně: C:\\S\\strom.cmd");
  assert.equal(ui("en", "ui.menu.bye.new", { path: "/x/strom" }), "Until next time. In a new terminal window start again with: strom — in this one: /x/strom");
  assert.equal(ui("de", "ui.menu.bye.new", { path: "/x/strom" }), "Auf Wiedersehen. In einem neuen Terminalfenster genügt: strom – in diesem Fenster: /x/strom");
  assert.equal(ui("cs", "ui.menu.bye"), "Na shledanou. Příště stačí spustit: strom");
});
