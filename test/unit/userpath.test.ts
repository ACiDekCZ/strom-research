// The PATH of the person's terminal for a strom the system started (a link from the Strom app, the bridge): what of
// the remembered one and of the agents' folders is missing goes at the end, in its order, once; nothing before what
// the process was given; Windows' Path kept by its name, its folders compared without case.

import { test } from "node:test";
import assert from "node:assert/strict";
import { completePath, fullerPath, pathToRemember } from "../../src/core/userpath.ts";
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
