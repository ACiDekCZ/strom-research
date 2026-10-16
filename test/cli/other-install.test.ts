// Another strom on the same computer — a run of the sources, npm's beside the installer's — never takes what the
// person's own installation set up (found 2026-10-15: a strom built in its checkout took the person's links at its first
// run; the Strom app's next link started it over the installed beta, which then backed every research up "back from a
// beta", wrote its channel into the settings and the researches' shims): the links, the shims and the channel stay the
// installation's; a strom no longer there, an older place of the same installation, a run of the sources are taken.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { linkStateText, linksTakeable, LINUX_ENTRY, linuxDesktopEntry, macApp, refreshLinks, type Sys } from "../../src/core/links.ts";
import { guestOf, installationOf, mayTakeOver, refreshTreeShim, shimScript, stromLauncher, type Installation } from "../../src/core/self.ts";
import { VERSION } from "../../src/core/tree.ts";

/** An installer's installation: node/, app/dist/cli.js, install.json. */
function installed(dir: string): { root: string; node: string; cli: string; inst: Installation } {
  const node = path.join(dir, "node", "bin", "node");
  const cli = path.join(dir, "app", "dist", "cli.js");
  fs.mkdirSync(path.dirname(node), { recursive: true });
  fs.mkdirSync(path.dirname(cli), { recursive: true });
  fs.writeFileSync(node, "");
  fs.writeFileSync(cli, "");
  fs.writeFileSync(path.join(dir, "install.json"), JSON.stringify({ launchers: [], node: "24.0.0" }));
  return { root: dir, node, cli, inst: { kind: "installed", root: dir, launchers: [] } };
}

/** A checkout of the sources with dist/ built in it. */
function checkout(dir: string): { cli: string } {
  const cli = path.join(dir, "dist", "cli.js");
  fs.mkdirSync(path.dirname(cli), { recursive: true });
  fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
  fs.writeFileSync(cli, "");
  return { cli };
}

test("dist/ built in a checkout is the sources, never npm's package; the installer's folder is installed, npm's npm", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "strom-other-ěš-"));
  try {
    const repo = path.join(base, "strom-research");
    checkout(repo);
    assert.equal(installationOf(path.join(repo, "dist", "core", "self.js")).kind, "source");
    assert.equal(installationOf(path.join(repo, "src", "core", "self.ts")).kind, "source");
    const inst = installed(path.join(base, "Strom"));
    assert.equal(installationOf(path.join(inst.root, "app", "dist", "core", "self.js")).kind, "installed");
    const npm = path.join(base, "lib", "node_modules", "strom-research");
    fs.mkdirSync(path.join(npm, "dist", "core"), { recursive: true });
    assert.equal(installationOf(path.join(npm, "dist", "core", "self.js")).kind, "npm");
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("what another strom set up is taken only from a strom no longer there, this installation's own place or a run of the sources; a guest of another installation's settings switches nothing", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "strom-other-ěš-"));
  try {
    const mine = installed(path.join(base, "Mine"));
    const other = installed(path.join(base, "Jiná instalace"));
    const dev = checkout(path.join(base, "repo"));
    assert.equal(mayTakeOver(undefined, mine.inst), true, "no strom known");
    assert.equal(mayTakeOver(path.join(base, "gone", "cli.js"), mine.inst), true, "a strom no longer there");
    assert.equal(mayTakeOver(mine.cli, mine.inst), true, "this installation");
    assert.equal(mayTakeOver(other.cli, mine.inst), false, "another installation still here");
    assert.equal(mayTakeOver(dev.cli, mine.inst), true, "a run of the sources: the person's own takes it back");
    assert.equal(mayTakeOver(dev.cli, { kind: "source" }), false, "…never another run of the sources");
    assert.equal(mayTakeOver(other.cli, { kind: "npm" }), false);

    // the settings of the installer's strom: npm's or the sources' strom is its guest; the installer's never one
    assert.equal(guestOf(other.root, { kind: "npm" }), other.root);
    assert.equal(guestOf(other.root, { kind: "source" }), other.root);
    assert.equal(guestOf(other.root, mine.inst), undefined, "an installer's installation is the person's own");
    assert.equal(guestOf(undefined, { kind: "npm" }), undefined, "nothing known yet");
    assert.equal(guestOf(path.join(base, "gone"), { kind: "npm" }), undefined, "the installation went");
    assert.equal(guestOf(path.join(base, "lib", "node_modules", "strom-research"), { kind: "source" }), undefined, "npm's: no installer's");
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("after an update the links of another installation still here stay — macOS, Windows, Linux (here faked); said where they lead; this installation's older place, a strom gone and a run of the sources are taken", () => {
  const w = new World();
  const env = { ...w.env, XDG_DATA_HOME: path.join(w.dir, "data"), XDG_CONFIG_HOME: path.join(w.dir, "cfg") };
  const appDir = macApp(env);
  const entry = path.join(env.XDG_DATA_HOME, "applications", LINUX_ENTRY);
  const key = "HKCU\\Software\\Classes\\strom-research\\shell\\open\\command";
  const other = installed(path.join(w.dir, "Jiná instalace"));
  const dev = checkout(path.join(w.dir, "repo"));
  const mine = installed(path.join(w.dir, "Moje"));
  for (const platform of ["win32", "darwin", "linux"] as const) {
    const reg = new Map<string, string>();
    const writes: string[] = [];
    const run: Sys = (cmd, args) => {
      if (cmd === "reg.exe" && args[0] === "query") {
        const v = reg.get(args[1]!);
        return v === undefined ? { status: 1, stdout: "" } : { status: 0, stdout: `\r\n${args[1]}\r\n    (Default)    REG_SZ    ${v}\r\n` };
      }
      if (cmd === "osascript") return { status: 0, stdout: `${appDir}\n` };
      if (cmd === "xdg-mime" && args[0] === "query") return { status: 0, stdout: `${LINUX_ENTRY}\n` };
      writes.push(`${cmd} ${args.join(" ")}`);
      if (cmd === "osacompile") fs.mkdirSync(path.join(args[args.indexOf("-o") + 1]!, "Contents", "Resources"), { recursive: true });
      return { status: 0, stdout: "" };
    };
    const setUp = (argv: string[]) => {
      if (platform === "win32") reg.set(key, `${argv.map((a) => `"${a}"`).join(" ")} link open "%1"`);
      if (platform === "darwin") {
        fs.mkdirSync(path.join(appDir, "Contents", "Resources"), { recursive: true });
        fs.writeFileSync(path.join(appDir, "Contents", "Resources", "strom-link.json"), JSON.stringify({ argv: [...argv, "link", "open"] }));
      }
      if (platform === "linux") {
        fs.mkdirSync(path.dirname(entry), { recursive: true });
        fs.writeFileSync(entry, linuxDesktopEntry([...argv, "link", "open"]));
      }
    };

    // another installation still here: kept, said where they lead
    setUp([other.node, other.cli]);
    assert.equal(linksTakeable(env, platform, run, mine.inst), false, platform);
    assert.equal(refreshLinks("yes", env, platform, run, mine.inst), false, platform);
    assert.deepEqual(writes, [], `${platform}: ${writes.join("; ")}`);
    assert.deepEqual(linkStateText("other", env, (p) => p, platform, run), { key: "ui.doc.links.elsewhere", where: other.cli }, platform);
    // …the same from a run of the sources
    assert.equal(refreshLinks("yes", env, platform, run, { kind: "source" }), false, platform);
    assert.deepEqual(writes, [], platform);

    // a run of the sources had them: the person's installation takes them back
    setUp([process.execPath, dev.cli]);
    assert.equal(linksTakeable(env, platform, run, mine.inst), true, platform);
    refreshLinks("yes", env, platform, run, mine.inst);
    assert.ok(writes.length > 0, `${platform}: taken back from the sources`);
    writes.length = 0;

    // an older place of this installation: taken; with another settings folder (macOS, Linux): another strom's researches, kept
    const own = platform === "win32" ? [] : ["/usr/bin/env", `STROM_CONFIG_DIR=${w.env.STROM_CONFIG_DIR}`];
    setUp([...own, path.join(mine.root, "node", "bin", "node-old"), mine.cli]);
    assert.equal(linksTakeable(env, platform, run, mine.inst), true, platform);
    if (platform !== "win32") {
      setUp(["/usr/bin/env", "STROM_CONFIG_DIR=/jinde/nastaveni", mine.node, mine.cli]);
      assert.equal(linksTakeable(env, platform, run, mine.inst), false, platform);
    }

    // a strom no longer there: taken
    setUp([path.join(w.dir, "pryč", "node"), path.join(w.dir, "pryč", "cli.js")]);
    assert.equal(linksTakeable(env, platform, run, mine.inst), true, platform);

    fs.rmSync(appDir, { recursive: true, force: true });
    fs.rmSync(entry, { force: true });
  }
  w.cleanup();
});

test("a research's shim of another installation still here stays; this installation's, one gone and a run of the sources' are written again", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "strom-other-ěš-"));
  try {
    const mine = installed(path.join(base, "Moje"));
    const other = installed(path.join(base, "Jiná"));
    const dev = checkout(path.join(base, "repo"));
    const tree = path.join(base, "Výzkum");
    fs.mkdirSync(path.join(tree, ".strom", "bin"), { recursive: true });
    fs.writeFileSync(path.join(tree, "strom.json"), JSON.stringify({ name: "Výzkum" }));
    const shim = path.join(tree, ".strom", "bin", "strom");
    const point = (node: string, cli: string) => fs.writeFileSync(shim, `#!/bin/sh\nexec "${node}" "${cli}" "$@"\n`);
    const launcher = { command: mine.node, args: [mine.cli] };

    point(other.node, other.cli);
    assert.equal(shimScript(tree), other.cli);
    const before = fs.readFileSync(shim, "utf8");
    assert.equal(refreshTreeShim(tree, {}, launcher, mine.inst), false);
    assert.equal(fs.readFileSync(shim, "utf8"), before, "another installation's shim kept");
    // …by a run of the sources too
    assert.equal(refreshTreeShim(tree, {}, { command: process.execPath, args: [dev.cli] }, { kind: "source" }), false);
    assert.equal(fs.readFileSync(shim, "utf8"), before);

    for (const [node, cli, why] of [
      [process.execPath, dev.cli, "a run of the sources"],
      [path.join(base, "pryč", "node"), path.join(base, "pryč", "cli.js"), "a strom gone"],
      [path.join(mine.root, "node", "bin", "node-old"), mine.cli, "this installation"],
    ] as const) {
      point(node, cli);
      assert.equal(refreshTreeShim(tree, {}, launcher, mine.inst), true, why);
      assert.equal(shimScript(tree), mine.cli, why);
    }
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("a guest of the installer's settings (the sources, npm's): no backup of another channel, the last version, channel and program kept, the shims as they are; the installation gone, it is the host", { skip: !hasGit || process.platform === "win32" }, async () => {
  const w = new World();
  try {
    const tree = await w.withTree("Novákovi");
    await w.ok(["person", "add", "Jan /Novák/", "--born", "1905"]);
    const cfg = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
    // the installer's beta ran here last
    const beta = installed(path.join(w.dir, "Strom beta"));
    const shim = path.join(tree, ".strom", "bin", "strom");
    fs.mkdirSync(path.dirname(shim), { recursive: true });
    fs.writeFileSync(shim, `#!/bin/sh\nexec "${beta.node}" "${beta.cli}" "$@"\n`, { mode: 0o755 });
    const was = { lastVersion: "99.0.0-beta.1", lastChannel: "beta", lastProgram: beta.root };
    fs.writeFileSync(cfg, JSON.stringify({ ...readJsonFile(cfg), ...was }));
    const shimBefore = fs.readFileSync(shim, "utf8");

    const r = await w.ok(["status"], { cwd: tree });
    const after = readJsonFile(cfg);
    assert.deepEqual({ lastVersion: after.lastVersion, lastChannel: after.lastChannel, lastProgram: after.lastProgram }, was, "the installation's own kept");
    assert.equal(after.backups, undefined, "no backup back from a beta");
    assert.doesNotMatch(r.err, /Záloha/);
    assert.equal(fs.readFileSync(shim, "utf8"), shimBefore, "the shim leads to the installation still");

    // the installation gone: this strom is the host — backed up, its version, channel and program, the shim its own
    fs.rmSync(beta.root, { recursive: true, force: true });
    await w.ok(["status"], { cwd: tree });
    const now = readJsonFile(cfg);
    assert.equal(now.lastVersion, VERSION);
    assert.equal(now.lastProgram, path.resolve(path.dirname(stromLauncher().args[0]!), ".."));
    assert.equal(now.backups?.length, 1);
    assert.equal(shimScript(tree), stromLauncher().args[0]);
  } finally {
    w.cleanup();
  }
});
