// strom as its installer puts it: Node and strom's code in one folder, a
// command on PATH. strom update replaces the code (and Node only when the
// release asks for another), a damaged download changes nothing, strom
// uninstall takes the folder and the command.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { compareVersions, currentAppDir, entryPackage, entryScript, installUpdate, layoutOf, VERSION_FOLDERS, oldVersions, removeOldVersions, UpdateHeld, versionDirs, isNewer, knownNewerVersion, latestRelease, newestTag, nodeArchive, npmChannel, npmChannelKept, setInstallChannel, updateChannel } from "../../src/core/update.ts";
import { Settings } from "../../src/core/config.ts";
import { launchersToTake, notOurs, ownProcesses, uninstallPlan, windowsRemoval } from "../../src/core/uninstall.ts";
import { insideProgram, installationAt, replacedHolding, withInstallEnv } from "../../src/core/self.ts";
import { desktopDir, documentsDir, tarProgram } from "../../src/core/paths.ts";
import { globalTargets } from "../../src/agents/global.ts";
import { registerLinks } from "../../src/core/links.ts";
import { isBetaAgents } from "../../scripts/beta-commit.ts";

const unix = { skip: process.platform === "win32" };
const LAYOUT2 = JSON.stringify({ name: "strom-research", version: "9.9.9", type: "module", stromLayout: 2 });

function world(): { dir: string; root: string; launcher: string; release: string; env: Record<string, string> } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-install-"));
  const root = path.join(dir, "share", "strom");
  fs.mkdirSync(path.join(root, "app", "dist"), { recursive: true });
  fs.mkdirSync(path.join(root, "node", "bin"), { recursive: true });
  fs.writeFileSync(path.join(root, "app", "dist", "cli.js"), "// 1.0.0\n");
  fs.writeFileSync(path.join(root, "node", "bin", "node"), "#!/bin/sh\n", { mode: 0o755 });
  const launcher = path.join(dir, "bin", "strom");
  fs.mkdirSync(path.dirname(launcher), { recursive: true });
  fs.writeFileSync(launcher, "#!/bin/sh\n", { mode: 0o755 });
  fs.writeFileSync(path.join(root, "install.json"), JSON.stringify({ launchers: [launcher], node: "26.9.0", version: "1.0.0", env: { STROM_CONFIG_DIR: path.join(dir, "cfg") } }));
  // A release: the new code, its checksum, the versions.
  const release = path.join(dir, "release");
  const stage = path.join(dir, "stage", "app", "dist");
  fs.mkdirSync(stage, { recursive: true });
  fs.mkdirSync(release);
  fs.writeFileSync(path.join(stage, "cli.js"), "// 9.9.9\n");
  // a release that knows the versions' folders (its package.json says so: core/update.ts layoutOf)
  fs.writeFileSync(path.join(stage, "..", "package.json"), LAYOUT2);
  spawnSync("tar", ["-czf", path.join(release, "strom-app.tar.gz"), "app"], { cwd: path.join(dir, "stage") });
  const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(release, "strom-app.tar.gz"))).digest("hex");
  fs.writeFileSync(path.join(release, "SHASUMS256.txt"), `${sha}  strom-app.tar.gz\n`);
  fs.writeFileSync(path.join(release, "VERSION"), "9.9.9\n");
  fs.writeFileSync(path.join(release, "NODE_VERSION"), "26.9.0\n");
  return { dir, root, launcher, release, env: { HOME: dir, STROM_DOWNLOAD_BASE: `file://${release}`, STROM_NODE_BASE: `file://${path.join(dir, "no-node")}` } };
}

const ENTRY = (dir: string) => entryScript(dir);
const json = (f: string) => JSON.parse(fs.readFileSync(f, "utf8"));

test("strom update: the new version in a folder of its own beside the one at work, the entry written again to name it; Node kept when the release asks for the same", unix, async () => {
  const w = world();
  assert.deepEqual(await installUpdate(w.env, w.root), { version: "9.9.9", dir: "app-9.9.9" });
  assert.equal(fs.readFileSync(path.join(w.root, "app-9.9.9", "dist", "cli.js"), "utf8"), "// 9.9.9\n");
  assert.equal(fs.readFileSync(path.join(w.root, "app", "dist", "cli.js"), "utf8"), ENTRY("app-9.9.9"), "the entry names it");
  assert.equal(json(path.join(w.root, "app", "package.json")).version, "9.9.9", "the version on disk for a strom started before");
  const info = json(path.join(w.root, "install.json"));
  assert.equal(info.version, "9.9.9");
  assert.equal(info.app, "app-9.9.9");
  assert.equal(info.previous, "app", "the whole program before lay in app/");
  assert.deepEqual(info.env, { STROM_CONFIG_DIR: path.join(w.dir, "cfg") }, "what it was installed with stays");
  assert.equal(fs.readFileSync(path.join(w.root, "node", "bin", "node"), "utf8"), "#!/bin/sh\n", "Node untouched");
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "app-9.9.9", "install.json", "node"], "nothing left over");
  assert.deepEqual(fs.readdirSync(path.join(w.root, "app", "dist")), ["cli.js"], "no file aside left");
  fs.rmSync(w.dir, { recursive: true, force: true });
});

test("the entry runs the version it names — the launchers, shortcuts and research's shims never written again (cmd.exe reads a batch file by its offset)", unix, async () => {
  const w = world();
  fs.writeFileSync(path.join(w.dir, "stage", "app", "dist", "cli.js"), "console.log('runs 9.9.9 from', import.meta.url);\n");
  fs.writeFileSync(path.join(w.dir, "stage", "app", "package.json"), JSON.stringify({ name: "strom-research", version: "9.9.9", type: "module", stromLayout: 2 }));
  spawnSync("tar", ["-czf", path.join(w.release, "strom-app.tar.gz"), "app"], { cwd: path.join(w.dir, "stage") });
  const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(w.release, "strom-app.tar.gz"))).digest("hex");
  fs.writeFileSync(path.join(w.release, "SHASUMS256.txt"), `${sha}  strom-app.tar.gz\n`);
  const launcher = fs.readFileSync(w.launcher, "utf8");
  await installUpdate(w.env, w.root);
  const r = spawnSync(process.execPath, [path.join(w.root, "app", "dist", "cli.js")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /runs 9\.9\.9 from file:.*\/app-9\.9\.9\/dist\/cli\.js/);
  assert.equal(fs.readFileSync(w.launcher, "utf8"), launcher, "the launcher as it was");
  fs.rmSync(w.dir, { recursive: true, force: true });
});

test("strom update from an installation before 1.25 (the whole program in app/): its entry written over its cli.js, the rest kept as the version before; made the entry alone by the update after; the versions before the one before go, unless in use", unix, async () => {
  const w = world();
  const app = path.join(w.root, "app");
  fs.mkdirSync(path.join(app, "dist", "core"), { recursive: true });
  fs.writeFileSync(path.join(app, "dist", "core", "tree.js"), "// 1.0.0's\n");
  fs.writeFileSync(path.join(app, "package.json"), JSON.stringify({ name: "strom-research", version: "1.0.0", type: "module" }));
  fs.mkdirSync(path.join(app, "assets"));
  fs.mkdirSync(path.join(w.root, "app.old"), { recursive: true }); // what an update of a strom before 1.25 left
  await installUpdate(w.env, w.root);
  assert.equal(fs.readFileSync(path.join(app, "dist", "cli.js"), "utf8"), ENTRY("app-9.9.9"));
  assert.ok(fs.existsSync(path.join(app, "dist", "core", "tree.js")), "a strom started before still reads its modules");
  assert.ok(fs.existsSync(path.join(app, "assets")));
  assert.ok(!fs.existsSync(path.join(w.root, "app.old")), "app.old/ gone");
  // the update after: app-9.9.9 the version before, app/ the entry alone
  fs.writeFileSync(path.join(w.release, "VERSION"), "9.9.10\n");
  assert.deepEqual(await installUpdate(w.env, w.root), { version: "9.9.10", dir: "app-9.9.10" });
  assert.deepEqual(json(path.join(w.root, "install.json")), { ...json(path.join(w.root, "install.json")), app: "app-9.9.10", previous: "app-9.9.9", version: "9.9.10" });
  assert.deepEqual(fs.readdirSync(app).sort(), ["dist", "package.json"]);
  assert.deepEqual(fs.readdirSync(path.join(app, "dist")), ["cli.js"]);
  assert.equal(json(path.join(app, "package.json")).version, "9.9.10");
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "app-9.9.10", "app-9.9.9", "install.json", "node"]);
  // the one after that: app-9.9.9 in use (a run pinned to it) stays; once nobody uses it, it goes
  fs.writeFileSync(path.join(w.release, "VERSION"), "9.9.11\n");
  await installUpdate(w.env, w.root, process.platform, { inUse: ["app-9.9.9"] });
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "app-9.9.10", "app-9.9.11", "app-9.9.9", "install.json", "node"]);
  fs.writeFileSync(path.join(w.release, "VERSION"), "9.9.12\n");
  await installUpdate(w.env, w.root);
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "app-9.9.11", "app-9.9.12", "install.json", "node"]);
  fs.rmSync(w.dir, { recursive: true, force: true });
});

/** The release in `w.release` made a version before 1.25 (layout 1): its package.json says nothing of the versions' folders. */
function oldRelease(w: ReturnType<typeof world>, version: string): void {
  const stage = path.join(w.dir, "old-stage");
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(path.join(stage, "app", "dist", "core"), { recursive: true });
  fs.writeFileSync(path.join(stage, "app", "dist", "cli.js"), `// ${version}\n`);
  fs.writeFileSync(path.join(stage, "app", "dist", "core", "self.js"), `// ${version}'s\n`);
  fs.writeFileSync(path.join(stage, "app", "package.json"), JSON.stringify({ name: "strom-research", version, type: "module" }));
  spawnSync("tar", ["-czf", path.join(w.release, "strom-app.tar.gz"), "app"], { cwd: stage });
  const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(w.release, "strom-app.tar.gz"))).digest("hex");
  fs.writeFileSync(path.join(w.release, "SHASUMS256.txt"), `${sha}  strom-app.tar.gz\n`);
  fs.writeFileSync(path.join(w.release, "VERSION"), `${version}\n`);
}

/** The release in `w.release` made a version that knows the versions' folders again. */
function newRelease(w: ReturnType<typeof world>, version: string): void {
  const stage = path.join(w.dir, "new-stage");
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(path.join(stage, "app", "dist"), { recursive: true });
  fs.writeFileSync(path.join(stage, "app", "dist", "cli.js"), `// ${version}\n`);
  fs.writeFileSync(path.join(stage, "app", "package.json"), JSON.stringify({ name: "strom-research", version, type: "module", stromLayout: 2 }));
  spawnSync("tar", ["-czf", path.join(w.release, "strom-app.tar.gz"), "app"], { cwd: stage });
  const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(w.release, "strom-app.tar.gz"))).digest("hex");
  fs.writeFileSync(path.join(w.release, "SHASUMS256.txt"), `${sha}  strom-app.tar.gz\n`);
  fs.writeFileSync(path.join(w.release, "VERSION"), `${version}\n`);
}

test("the layout a version knows: its package.json's stromLayout (2: each version in app-<version>/), nothing said or nonsense 1; a release of these sources says 2", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-layout-"));
  assert.equal(layoutOf(dir), 1, "no package.json");
  for (const [pkg, n] of [[{ version: "1.24.0" }, 1], [{ stromLayout: 2 }, 2], [{ stromLayout: 3 }, 3], [{ stromLayout: "2" }, 1], [{ stromLayout: 0 }, 1], [{ stromLayout: 1.5 }, 1]] as const) {
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg));
    assert.equal(layoutOf(dir), n, JSON.stringify(pkg));
  }
  fs.writeFileSync(path.join(dir, "package.json"), "{ not json");
  assert.equal(layoutOf(dir), 1, "unreadable");
  assert.ok(layoutOf(path.join(import.meta.dirname, "..", "..")) >= VERSION_FOLDERS, "package.json of the sources (what build-release packs)");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("strom update back to a version before 1.25 (found 2026-11-02: from the beta to 1.24.0 it ran from app-1.24.0/, took itself for npm's and never updated again): the whole version in app/ as it knows, install.json without app; from it the next update goes on into a folder of its own", unix, async () => {
  const w = world();
  const app = path.join(w.root, "app");
  await installUpdate(w.env, w.root);
  newRelease(w, "9.9.10");
  await installUpdate(w.env, w.root, process.platform, { channel: "beta" });
  assert.equal(currentAppDir(w.root), "app-9.9.10");
  // the marks of the researches' shims beside the entry (core/self.ts shimMarker)
  fs.writeFileSync(path.join(app, "dist", ".strom-shim-0123456789abcdef"), "");
  // a version that knows only app/
  oldRelease(w, "1.24.0");
  assert.deepEqual(await installUpdate(w.env, w.root, process.platform, { channel: "stable" }), { version: "1.24.0" });
  assert.equal(fs.readFileSync(path.join(app, "dist", "cli.js"), "utf8"), "// 1.24.0\n", "the version itself in app/, no entry");
  assert.ok(fs.existsSync(path.join(app, "dist", "core", "self.js")));
  assert.equal(json(path.join(app, "package.json")).version, "1.24.0");
  assert.ok(fs.existsSync(path.join(app, "dist", ".strom-shim-0123456789abcdef")), "the shims' mark kept");
  assert.equal(currentAppDir(w.root), undefined);
  const info = json(path.join(w.root, "install.json"));
  assert.equal(info.version, "1.24.0");
  assert.equal("app" in info, false, "no app: the version knows none");
  assert.equal(info.previous, "app-9.9.10", "the version that ran until now (a strom started before reads it on)");
  assert.equal("channel" in info, false);
  assert.deepEqual(info.env, { STROM_CONFIG_DIR: path.join(w.dir, "cfg") }, "what it was installed with stays");
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "app-9.9.10", "app-9.9.9", "install.json", "node"], "the one before the one before kept this time; no app.old, no .update-*");
  // what a strom before 1.25 takes for the installer's: run from app/ with install.json beside (its installationOf)
  assert.equal(path.basename(path.resolve(path.join(app, "dist", "core", "self.js"), "..", "..", "..")), "app");
  // another version before 1.25 over it: app/ whole again, the leftovers nobody uses gone; then a version that knows
  // the folders goes into a folder of its own again
  oldRelease(w, "1.24.1");
  await installUpdate(w.env, w.root, process.platform, { channel: "stable" });
  assert.deepEqual(json(path.join(w.root, "install.json")).previous, undefined, "the whole program before lay in app/");
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "app-9.9.10", "install.json", "node"], "app-9.9.9 nobody used: gone; app-9.9.10 kept as the one before");
  newRelease(w, "9.9.11");
  assert.deepEqual(await installUpdate(w.env, w.root, process.platform, { channel: "beta" }), { version: "9.9.11", dir: "app-9.9.11" });
  assert.equal(fs.readFileSync(path.join(app, "dist", "cli.js"), "utf8"), ENTRY("app-9.9.11"));
  const back = json(path.join(w.root, "install.json"));
  assert.deepEqual([back.version, back.app, back.previous, back.channel], ["9.9.11", "app-9.9.11", "app", "beta"]);
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "app-9.9.11", "install.json", "node"]);
  fs.rmSync(w.dir, { recursive: true, force: true });
});

test("strom update back to a version before 1.25: a version folder in use (a run pinned to it) stays; app/ held by another program — app/ as it was, the entry naming the version before, the Node before, the reason said", unix, async () => {
  const w = world();
  const app = path.join(w.root, "app");
  await installUpdate(w.env, w.root);
  newRelease(w, "9.9.10");
  await installUpdate(w.env, w.root);
  newRelease(w, "9.9.11");
  await installUpdate(w.env, w.root, process.platform, { inUse: ["app-9.9.9"] });
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "app-9.9.10", "app-9.9.11", "app-9.9.9", "install.json", "node"]);
  oldRelease(w, "1.24.0");
  // the unpacked version never let into app/: app/ back as it was
  const toApp = (from: string, to: string) => path.dirname(from).startsWith(path.join(w.root, ".update-")) && to === app;
  await assert.rejects(installUpdate(w.env, w.root, process.platform, { ops: heldDisk({ rename: toApp }).ops }), /could not be put in place \(EBUSY: another program held strom's files.*strom stays at its version/);
  assert.equal(fs.readFileSync(path.join(app, "dist", "cli.js"), "utf8"), ENTRY("app-9.9.11"), "the entry as it was");
  assert.equal(json(path.join(w.root, "install.json")).version, "9.9.11");
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "app-9.9.10", "app-9.9.11", "app-9.9.9", "install.json", "node"], "no app.old, no .update-*");
  // app/ itself held: nothing renamed; a newer Node came along — the Node before back too
  newerNodeOffered(w);
  await assert.rejects(installUpdate(w.env, w.root, process.platform, { ops: heldDisk({ rename: (from) => from === app }).ops }), /strom stays at its version/);
  assert.equal(fs.readFileSync(path.join(w.root, "node", "bin", "node"), "utf8"), "#!/bin/sh\n", "the Node before");
  assert.equal(fs.readFileSync(path.join(app, "dist", "cli.js"), "utf8"), ENTRY("app-9.9.11"));
  // let through, app-9.9.9 at work in a run: kept; app-9.9.10 the one before the one in use: kept; the rest go
  assert.deepEqual(await installUpdate(w.env, w.root, process.platform, { inUse: ["app-9.9.9"] }), { version: "1.24.0", node: { from: "26.9.0", to: "24.99.0" } });
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "app-9.9.10", "app-9.9.11", "app-9.9.9", "install.json", "node"]);
  assert.equal(fs.readFileSync(path.join(app, "dist", "cli.js"), "utf8"), "// 1.24.0\n");
  fs.rmSync(w.dir, { recursive: true, force: true });
});

test("strom update: a damaged download or a Node that cannot be had changes nothing", unix, async () => {
  const w = world();
  fs.appendFileSync(path.join(w.release, "strom-app.tar.gz"), "x");
  await assert.rejects(installUpdate(w.env, w.root), /checksum mismatch/);
  assert.equal(fs.readFileSync(path.join(w.root, "app", "dist", "cli.js"), "utf8"), "// 1.0.0\n");
  // Another Node asked for, not to be had: the code stays as it was too.
  const v = world();
  fs.writeFileSync(path.join(v.release, "NODE_VERSION"), "27.0.0\n");
  await assert.rejects(installUpdate(v.env, v.root));
  assert.equal(fs.readFileSync(path.join(v.root, "app", "dist", "cli.js"), "utf8"), "// 1.0.0\n");
  assert.deepEqual(fs.readdirSync(v.root).sort(), ["app", "install.json", "node"]);
  for (const x of [w, v]) fs.rmSync(x.dir, { recursive: true, force: true });
});

test("strom update: work under way and the person waits — the download checked, nothing put in place (UpdateHeld)", unix, async () => {
  const w = world();
  let asked = "";
  await assert.rejects(installUpdate(w.env, w.root, process.platform, { ready: async (v) => ((asked = v), false) }), UpdateHeld);
  assert.equal(asked, "9.9.9");
  assert.equal(fs.readFileSync(path.join(w.root, "app", "dist", "cli.js"), "utf8"), "// 1.0.0\n");
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "install.json", "node"], "no .update-* left");
  fs.rmSync(w.dir, { recursive: true, force: true });
});

/** The release asks for Node 24, and a mirror in nodejs.org's layout has 24.99.0: latest-v24.x/ with the archive for this computer and its sums. */
function newerNodeOffered(w: ReturnType<typeof world>): void {
  fs.writeFileSync(path.join(w.release, "NODE_VERSION"), "24\n");
  const name = nodeArchive("24.99.0");
  const top = name.replace(/\.tar\.gz$/, "");
  const stage = path.join(w.dir, "node-stage");
  fs.mkdirSync(path.join(stage, top, "bin"), { recursive: true });
  fs.writeFileSync(path.join(stage, top, "bin", "node"), "#!/bin/sh\necho v24.99.0\n", { mode: 0o755 });
  const latest = path.join(w.dir, "no-node", "latest-v24.x");
  fs.mkdirSync(latest, { recursive: true });
  spawnSync("tar", ["-czf", path.join(latest, name), top], { cwd: stage });
  const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(latest, name))).digest("hex");
  fs.writeFileSync(path.join(latest, "SHASUMS256.txt"), `${sha}  ${name}\n`);
}

test("strom update: the newest Node of the release's line comes along (security fixes), checked against nodejs.org's sums", unix, async () => {
  const w = world();
  fs.writeFileSync(path.join(w.release, "NODE_VERSION"), "24\n");
  // A mirror in nodejs.org's layout: latest-v24.x/ with the archive for this computer and its sums.
  const name = nodeArchive("24.99.0");
  const top = name.replace(/\.tar\.gz$/, "");
  const stage = path.join(w.dir, "node-stage");
  fs.mkdirSync(path.join(stage, top, "bin"), { recursive: true });
  fs.writeFileSync(path.join(stage, top, "bin", "node"), "#!/bin/sh\necho v24.99.0\n", { mode: 0o755 });
  const latest = path.join(w.dir, "no-node", "latest-v24.x");
  fs.mkdirSync(latest, { recursive: true });
  spawnSync("tar", ["-czf", path.join(latest, name), top], { cwd: stage });
  const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(latest, name))).digest("hex");
  fs.writeFileSync(path.join(latest, "SHASUMS256.txt"), `${"0".repeat(64)}  node-v24.99.0-aix-ppc64.tar.gz\n${sha}  ${name}\n`);
  assert.deepEqual(await installUpdate(w.env, w.root), { version: "9.9.9", node: { from: "26.9.0", to: "24.99.0" }, dir: "app-9.9.9" });
  assert.match(fs.readFileSync(path.join(w.root, "node", "bin", "node"), "utf8"), /v24\.99\.0/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.root, "install.json"), "utf8")).node, "24.99.0");
  fs.rmSync(w.dir, { recursive: true, force: true });
});


/** A disk whose renames or removals another program holds (EBUSY) — `held` says when; the waits counted, never slept. */
function heldDisk(held: { rename?: (from: string, to: string, n: number) => boolean; rm?: (target: string) => boolean }) {
  const waits: number[] = [];
  let renames = 0;
  const busy = (what: string) => Object.assign(new Error(`EBUSY: resource busy or locked, ${what}`), { code: "EBUSY" });
  return {
    waits,
    ops: {
      rename: (from: string, to: string) => {
        if (held.rename?.(from, to, ++renames)) throw busy(`rename '${from}' -> '${to}'`);
        fs.renameSync(from, to);
      },
      rm: (target: string) => {
        if (fs.existsSync(target) && held.rm?.(target)) throw busy(`rm '${target}'`);
        fs.rmSync(target, { recursive: true, force: true });
      },
      wait: (ms: number) => void waits.push(ms),
    },
  };
}

test("strom update: the new version's folder another program holds a moment (an antivirus) — the move tried again with growing waits, then in place", unix, async () => {
  const w = world();
  const d = heldDisk({ rename: (from, to, n) => path.dirname(from).startsWith(path.join(w.root, ".update-")) && to === path.join(w.root, "app-9.9.9") && n <= 3 });
  assert.deepEqual(await installUpdate(w.env, w.root, process.platform, { ops: d.ops }), { version: "9.9.9", dir: "app-9.9.9" });
  assert.deepEqual(d.waits, [50, 100, 200], "three waits, growing");
  assert.equal(fs.readFileSync(path.join(w.root, "app", "dist", "cli.js"), "utf8"), ENTRY("app-9.9.9"));
  assert.equal(json(path.join(w.root, "install.json")).version, "9.9.9");
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "app-9.9.9", "install.json", "node"], "nothing left over");
  fs.rmSync(w.dir, { recursive: true, force: true });
});

test("strom update: the new version never let into place, or the entry never written — the one before stays in use (and its Node), nothing left over, the reason said", unix, async () => {
  const w = world();
  const toNew = (from: string, to: string) => path.dirname(from).startsWith(path.join(w.root, ".update-")) && to === path.join(w.root, "app-9.9.9");
  const d = heldDisk({ rename: toNew });
  await assert.rejects(installUpdate(w.env, w.root, process.platform, { ops: d.ops }), /the new version could not be put in place \(EBUSY: another program held its files.*nothing was replaced/);
  assert.deepEqual(d.waits, [50, 100, 200, 400, 800, 1600, 1850], "tried again until the patience is spent (5 s, at most ten tries)");
  assert.equal(fs.readFileSync(path.join(w.root, "app", "dist", "cli.js"), "utf8"), "// 1.0.0\n", "the one before in use");
  assert.equal(json(path.join(w.root, "install.json")).version, "1.0.0");
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "install.json", "node"], "no .update-*");
  // the entry held for good: the new folder taken away again, app/package.json as it was
  fs.writeFileSync(path.join(w.root, "app", "package.json"), "{\"version\":\"1.0.0\"}\n");
  const e = heldDisk({ rename: (_from, to) => to === path.join(w.root, "app", "dist", "cli.js") });
  await assert.rejects(installUpdate(w.env, w.root, process.platform, { ops: e.ops }), /another program held strom's entry.*strom stays at its version/);
  assert.equal(fs.readFileSync(path.join(w.root, "app", "dist", "cli.js"), "utf8"), "// 1.0.0\n");
  assert.equal(fs.readFileSync(path.join(w.root, "app", "package.json"), "utf8"), "{\"version\":\"1.0.0\"}\n", "put back");
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "install.json", "node"]);
  assert.deepEqual(fs.readdirSync(path.join(w.root, "app", "dist")), ["cli.js"], "no file aside left");
  // a newer Node came along: the code not put in place, the Node before back too — never the old code on the new Node
  newerNodeOffered(w);
  await assert.rejects(installUpdate(w.env, w.root, process.platform, { ops: heldDisk({ rename: toNew }).ops }), /could not be put in place/);
  assert.equal(fs.readFileSync(path.join(w.root, "node", "bin", "node"), "utf8"), "#!/bin/sh\n", "the Node before");
  assert.equal(json(path.join(w.root, "install.json")).node, "26.9.0");
  assert.deepEqual(fs.readdirSync(path.join(w.root, "node", "bin")), ["node"], "nothing of it left");
  // let through: both in place, the Node before gone
  assert.deepEqual(await installUpdate(w.env, w.root), { version: "9.9.9", node: { from: "26.9.0", to: "24.99.0" }, dir: "app-9.9.9" });
  assert.match(fs.readFileSync(path.join(w.root, "node", "bin", "node"), "utf8"), /v24\.99\.0/);
  assert.deepEqual(fs.readdirSync(path.join(w.root, "node", "bin")), ["node"]);
  fs.rmSync(w.dir, { recursive: true, force: true });
});

test("strom update: an old version's folder held (a process still reading it) — the update done, the leftover in update.log, removed by the next update or strom tidy; a leftover of the same version nobody uses taken again", unix, async () => {
  const w = world();
  await installUpdate(w.env, w.root);
  fs.writeFileSync(path.join(w.release, "VERSION"), "9.9.10\n");
  await installUpdate(w.env, w.root);
  fs.writeFileSync(path.join(w.release, "VERSION"), "9.9.11\n");
  const d = heldDisk({ rm: (target) => target === path.join(w.root, "app-9.9.9") });
  assert.deepEqual(await installUpdate(w.env, w.root, process.platform, { ops: d.ops }), { version: "9.9.11", dir: "app-9.9.11" });
  assert.equal(json(path.join(w.root, "install.json")).version, "9.9.11");
  assert.ok(fs.existsSync(path.join(w.root, "app-9.9.9")), "left");
  assert.match(fs.readFileSync(path.join(w.root, "update.log"), "utf8"), /app-9\.9\.9 left: EBUSY/);
  assert.deepEqual(oldVersions(w.root), { dirs: ["app-9.9.9"], prune: false }, "strom tidy names it");
  // never one holding what the person keeps (a shared folder set there before strom refused it)
  const shared = path.join(w.root, "app-9.9.9", "sdílené");
  fs.mkdirSync(shared);
  assert.deepEqual(oldVersions(w.root, [], [shared]), { dirs: [], prune: false });
  assert.deepEqual(removeOldVersions(w.root, [], undefined, [shared]), []);
  fs.rmdirSync(shared);
  assert.deepEqual(removeOldVersions(w.root), ["app-9.9.9"]);
  // a folder of the version coming, left by an update that failed: nobody uses it — taken again
  fs.mkdirSync(path.join(w.root, "app-9.9.12", "dist"), { recursive: true });
  fs.writeFileSync(path.join(w.root, "app-9.9.12", "dist", "cli.js"), "// half\n");
  fs.writeFileSync(path.join(w.release, "VERSION"), "9.9.12\n");
  assert.deepEqual(await installUpdate(w.env, w.root), { version: "9.9.12", dir: "app-9.9.12" });
  assert.equal(fs.readFileSync(path.join(w.root, "app-9.9.12", "dist", "cli.js"), "utf8"), "// 9.9.9\n");
  // the same version again while a run uses its folder: a name of its own
  assert.deepEqual(await installUpdate(w.env, w.root, process.platform, { inUse: ["app-9.9.12"] }), { version: "9.9.12", dir: "app-9.9.12_2" });
  assert.equal(currentAppDir(w.root), "app-9.9.12_2");
  fs.rmSync(w.dir, { recursive: true, force: true });
});

test("strom update and strom doctor read an old version's package.json another program holds (found on Windows: EBUSY stopped both): the version then named by its folder", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom-held-pkg-"));
  for (const dir of ["app-1.0.0", "app-1.0.0_2", "app-1.1.0-beta.3"]) {
    fs.mkdirSync(path.join(root, dir, "dist"), { recursive: true });
    // unreadable as a file on every system: a folder where the file would be
    fs.mkdirSync(path.join(root, dir, "package.json"));
  }
  fs.writeFileSync(path.join(root, "install.json"), JSON.stringify({ version: "1.2.0", app: "app-1.2.0", previous: "app-1.1.0-beta.3" }));
  // the version in use, the entry naming it
  fs.mkdirSync(path.join(root, "app-1.2.0", "dist"), { recursive: true });
  fs.writeFileSync(path.join(root, "app-1.2.0", "dist", "cli.js"), "// 1.2.0\n");
  fs.writeFileSync(path.join(root, "app-1.2.0", "package.json"), JSON.stringify({ version: "1.2.0" }));
  fs.mkdirSync(path.join(root, "app", "dist"), { recursive: true });
  fs.writeFileSync(path.join(root, "app", "dist", "cli.js"), entryScript("app-1.2.0"));
  assert.deepEqual(versionDirs(root).sort((a, b) => a.dir.localeCompare(b.dir)), [
    { dir: "app-1.0.0", version: "1.0.0" },
    { dir: "app-1.0.0_2", version: "1.0.0" },
    { dir: "app-1.1.0-beta.3", version: "1.1.0-beta.3" },
    { dir: "app-1.2.0", version: "1.2.0" },
  ]);
  assert.deepEqual(oldVersions(root).dirs.sort(), ["app-1.0.0", "app-1.0.0_2"]);
  fs.rmSync(root, { recursive: true, force: true });
});

test("strom uninstall: the installer's folder and its command go; Node's archive names per system", unix, () => {
  const w = world();
  const plan = uninstallPlan(w.env, ["Strom research"], { platform: "darwin", install: { kind: "installed", root: w.root, launchers: [w.launcher] } });
  const program = plan.remove.find((r) => r.kind === "program")!;
  assert.equal(program.path, w.root);
  assert.equal(plan.npm, false);
  program.remove();
  assert.ok(!fs.existsSync(w.root) && !fs.existsSync(w.launcher));
  assert.equal(nodeArchive("26.9.0", "win32", "x64"), "node-v26.9.0-win-x64.zip");
  assert.equal(nodeArchive("26.9.0", "linux", "arm64"), "node-v26.9.0-linux-arm64.tar.gz");
  assert.equal(nodeArchive("26.9.0", "darwin", "arm64"), "node-v26.9.0-darwin-arm64.tar.gz");
  fs.rmSync(w.dir, { recursive: true, force: true });
});

test("strom uninstall on Windows: the launcher cmd runs is never deleted under it — a second strom's bin\\strom-beta.cmd and the folder go only once its node.exe can be deleted (cmd said \"The batch file cannot be found.\", exit 1)", unix, () => {
  const w = world();
  const bin = path.join(w.root, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const own = path.join(bin, "strom-beta.cmd");
  const main = path.join(w.root, "strom.cmd");
  for (const f of [own, main]) fs.writeFileSync(f, "@echo off\r\n");
  const later: string[] = [];
  const env = { ...w.env, STROM_ISOLATED: "1", STROM_COMMAND: "strom-beta", PATH: "" };
  const plan = uninstallPlan(env, ["Strom research"], { platform: "win32", install: { kind: "installed", root: w.root, launchers: [main, own] }, later: (c) => later.push(c) });
  assert.equal(plan.remove.find((r) => r.kind === "program")!.remove(), "later");
  assert.ok(fs.existsSync(own) && fs.existsSync(main), "nothing deleted while strom runs");
  assert.equal(later.length, 1);
  const [cmd] = later as [string];
  const node = path.win32.join(w.root, "node", "node.exe");
  const wait = cmd.indexOf(`if not exist "${node}"`);
  assert.ok(cmd.indexOf(`del /f /q "${node}"`) >= 0 && wait > 0, cmd);
  assert.ok(cmd.indexOf(`"${own}"`) > wait, "the launcher outside the folder only once Node has ended");
  for (const d of ["node", "app"]) assert.ok(cmd.indexOf(`rmdir /s /q "${path.win32.join(w.root, d)}"`) > wait, d);
  assert.ok(cmd.indexOf(`del /f /q "${path.win32.join(w.root, "strom.cmd")}"`) > wait, "the folder's own launcher once Node has ended");
  assert.ok(!cmd.includes(`rmdir /s /q "${w.root}"`) && cmd.includes(`rmdir "${w.root}"`), "the folder itself only when empty");
  fs.rmSync(w.dir, { recursive: true, force: true });
});

test("strom uninstall takes only what the installer and strom update made in its folder — a research there (the layout of an isolated installation before), its backups, a file of the person's stay, and the folder with them; a research where a launcher's name is, or inside strom's own folder, too", unix, () => {
  const w = world();
  const home = path.join(w.root, "Strom research");
  const tree = path.join(home, "Novákovi");
  for (const d of [path.join(tree, ".git"), path.join(home, "backups", "2026-10-07 1.0.0 to 1.1.0", "trees"), path.join(w.root, "app.old"), path.join(w.root, "app-1.25.0", "dist"), path.join(w.root, "app-1.25.0_2"), path.join(w.root, ".update-x1"), path.join(w.root, "git", "cmd")]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(tree, "strom.json"), "{}");
  fs.writeFileSync(path.join(w.root, "poznámka.txt"), "moje");
  fs.writeFileSync(path.join(w.root, "strom"), "#!/bin/sh\n");
  fs.writeFileSync(path.join(w.root, ".DS_Store"), "");
  const plan = uninstallPlan({ ...w.env, STROM_ISOLATED: "1" }, [], { platform: "darwin", install: { kind: "installed", root: w.root, launchers: [path.join(w.root, "strom"), w.launcher] }, keep: [home, tree] });
  assert.equal(plan.remove.find((r) => r.kind === "program")!.remove(), true);
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["Strom research", "poznámka.txt"]);
  assert.ok(fs.existsSync(path.join(tree, "strom.json")) && fs.existsSync(path.join(home, "backups", "2026-10-07 1.0.0 to 1.1.0", "trees")));
  assert.ok(!fs.existsSync(w.launcher), "the command outside the folder goes");
  assert.deepEqual(notOurs(w.root).sort(), ["Strom research", "poznámka.txt"]);
  // a research under a launcher's name (a disk that ignores case: "Strom" is "strom"), one inside strom's own app/
  const v = world();
  const odd = path.join(v.root, "strom");
  fs.mkdirSync(path.join(odd, "Novákovi"), { recursive: true });
  fs.writeFileSync(path.join(odd, "Novákovi", "strom.json"), "{}");
  const inApp = path.join(v.root, "app", "Dvořákovi");
  fs.mkdirSync(inApp);
  fs.writeFileSync(path.join(inApp, "strom.json"), "{}");
  uninstallPlan(v.env, [], { platform: "linux", install: { kind: "installed", root: v.root, launchers: [v.launcher] }, keep: [inApp] }).remove.find((r) => r.kind === "program")!.remove();
  assert.ok(fs.existsSync(path.join(odd, "Novákovi", "strom.json")), "a folder is no launcher");
  assert.ok(fs.existsSync(path.join(inApp, "strom.json")), "a folder holding a research is never taken");
  assert.ok(!fs.existsSync(path.join(v.root, "node")) && !fs.existsSync(path.join(v.root, "install.json")));
  // nothing but strom's: the folder goes too
  const x = world();
  uninstallPlan(x.env, [], { platform: "linux", install: { kind: "installed", root: x.root, launchers: [x.launcher] } }).remove.find((r) => r.kind === "program")!.remove();
  assert.ok(!fs.existsSync(x.root));
  for (const y of [w, v, x]) fs.rmSync(y.dir, { recursive: true, force: true });
});

test("strom uninstall on Windows names only strom's own entries of its folder — never a recursive delete of the folder, which goes only when empty; a research and backups in it, a file of the person's stay", unix, () => {
  const w = world();
  const home = path.join(w.root, "Strom research");
  for (const d of [path.join(home, "Novákovi"), path.join(home, "backups"), path.join(w.root, "git"), path.join(w.root, "bin")]) fs.mkdirSync(d, { recursive: true });
  for (const f of ["strom.cmd", "strom", "poznámka.txt", path.join("bin", "strom-beta.cmd")]) fs.writeFileSync(path.join(w.root, f), "x");
  const later: string[] = [];
  const own = path.join(w.root, "bin", "strom-beta.cmd");
  uninstallPlan({ ...w.env, STROM_ISOLATED: "1", STROM_COMMAND: "strom-beta", PATH: "" }, [], { platform: "win32", install: { kind: "installed", root: w.root, launchers: [path.join(w.root, "strom.cmd"), path.join(w.root, "strom"), own] }, later: (c) => later.push(c), keep: [home] }).remove.find((r) => r.kind === "program")!.remove();
  const [cmd] = later as [string];
  // (a folder of this system's as Windows would write it)
  const j = (...p: string[]) => path.win32.join(w.root, ...p);
  const named = [...cmd.matchAll(/"([^"]+)"/g)].map((m) => path.win32.normalize(m[1]!)).filter((p) => p.startsWith(j()));
  assert.deepEqual([...new Set(named)].sort(), [j(), j("app"), j("bin"), j("git"), j("install.json"), j("node"), j("node", "node.exe"), j("strom"), j("strom.cmd"), j("bin", "strom-beta.cmd")].sort());
  assert.ok(!/rmdir \/s \/q "[^"]*Strom research/.test(cmd) && !cmd.includes("poznámka"), cmd);
  assert.ok(!cmd.includes(`rmdir /s /q "${w.root}"`) && cmd.includes(`rmdir "${w.root}" 2>nul`), "the folder: rmdir without /s");
  assert.ok(cmd.includes(`rmdir "${j("bin")}" 2>nul`) && !cmd.includes(`rmdir /s /q "${j("bin")}"`), "bin only when empty");
  assert.ok(cmd.indexOf(`rmdir "${w.root}"`) > cmd.indexOf(`rmdir /s /q "${j("app")}"`), "the folder after strom's own");
  // the command alone: a folder of strom's only, a file deleted, never a folder deleted as a file
  const c = windowsRemoval("C:\\S", [], [{ name: "app", dir: true }, { name: "install.json", dir: false }]);
  assert.match(c, /rmdir \/s \/q "C:\\S\\app"/);
  assert.match(c, /del \/f \/q "C:\\S\\install\.json"/);
  assert.match(c, /if not exist "C:\\S\\app" exit \/b 0/);
  fs.rmSync(w.dir, { recursive: true, force: true });
});

test("an installation's own environment (install.json env) for every start of it: what the process has set wins, nothing else is taken", () => {
  const own = { STROM_CONFIG_DIR: "/zkouska/cfg", HOME: "/zkouska/home", STROM_ISOLATED: "1", PATH: "/zlo", NODE_OPTIONS: "--require /zlo.js" };
  assert.deepEqual(withInstallEnv({ PATH: "/bin" }, own), { PATH: "/bin", STROM_CONFIG_DIR: "/zkouska/cfg", HOME: "/zkouska/home", STROM_ISOLATED: "1" });
  // an isolated installation: its own win, however it is started (a link: the person's HOME)
  assert.deepEqual(withInstallEnv({ HOME: "/moje", STROM_CONFIG_DIR: "/moje/cfg" }, own), { HOME: "/zkouska/home", STROM_CONFIG_DIR: "/zkouska/cfg", STROM_ISOLATED: "1" });
  // the person's own installation: what the process has set wins
  const person = { STROM_CONFIG_DIR: "/jinde/cfg" };
  assert.deepEqual(withInstallEnv({ HOME: "/moje", STROM_CONFIG_DIR: "/moje/cfg" }, person), { HOME: "/moje", STROM_CONFIG_DIR: "/moje/cfg" });
  assert.deepEqual(withInstallEnv({ HOME: "/moje" }, person), { HOME: "/moje", STROM_CONFIG_DIR: "/jinde/cfg" });
  assert.deepEqual(withInstallEnv({ HOME: "/moje" }, undefined), { HOME: "/moje" });
});

test("an isolated installation touches nothing outside its folders: no links, nothing taught to the agents, no PATH lines of another strom's, no OneDrive", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-isolated-"));
  const env = { HOME: path.join(dir, "home"), STROM_CONFIG_DIR: path.join(dir, "cfg"), STROM_ISOLATED: "1", OneDrive: path.join(dir, "OneDrive") };
  fs.mkdirSync(path.join(env.OneDrive, "Desktop"), { recursive: true });
  fs.mkdirSync(path.join(env.OneDrive, "Documents"), { recursive: true });
  assert.deepEqual(globalTargets(env), []);
  const calls: string[] = [];
  assert.equal(registerLinks(env, "win32", (cmd, args) => (calls.push(`${cmd} ${args.join(" ")}`), { status: 0, stdout: "" })), false);
  assert.deepEqual(calls, [], "the registry not touched");
  assert.equal(desktopDir(env, "win32"), path.join(env.HOME, "Desktop"));
  assert.equal(documentsDir(env, "win32"), path.join(env.HOME, "Documents"));
  const { STROM_ISOLATED: _, ...person } = env;
  assert.equal(desktopDir(person, "win32"), path.join(env.OneDrive, "Desktop"), "the person's own strom: OneDrive's");
  // the person's own strom's line on PATH stays
  fs.mkdirSync(env.HOME, { recursive: true });
  fs.writeFileSync(path.join(env.HOME, ".zshrc"), 'export PATH="/x/.local/bin:$PATH"  # strom research\n');
  const plan = uninstallPlan(env, ["Strom research"], { platform: "darwin", install: { kind: "installed", root: path.join(dir, "program"), launchers: [] } });
  assert.deepEqual(plan.remove.map((r) => r.kind), ["program"]);
  assert.deepEqual(uninstallPlan(person, ["Strom research"], { platform: "darwin", install: { kind: "installed", root: path.join(dir, "program"), launchers: [] } }).remove.map((r) => r.kind), ["path", "program"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A release and a Node in nodejs.org's layout, both local, for the installer itself. */
function release(dir: string, node = "#!/bin/sh\necho v24.99.0\n"): Record<string, string> {
  const rel = path.join(dir, "release");
  const stage = path.join(dir, "stage");
  fs.mkdirSync(path.join(stage, "app", "dist"), { recursive: true });
  fs.mkdirSync(rel, { recursive: true });
  fs.writeFileSync(path.join(stage, "app", "dist", "cli.js"), "// strom\n");
  fs.writeFileSync(path.join(stage, "app", "package.json"), LAYOUT2);
  spawnSync("tar", ["-czf", path.join(rel, "strom-app.tar.gz"), "app"], { cwd: stage });
  const sum = (f: string) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
  fs.writeFileSync(path.join(rel, "SHASUMS256.txt"), `${sum(path.join(rel, "strom-app.tar.gz"))}  strom-app.tar.gz\n`);
  fs.writeFileSync(path.join(rel, "VERSION"), "9.9.9\n");
  fs.writeFileSync(path.join(rel, "NODE_VERSION"), "24.99.0\n");
  const name = nodeArchive("24.99.0");
  const top = name.replace(/\.tar\.gz$/, "");
  fs.mkdirSync(path.join(stage, top, "bin"), { recursive: true });
  fs.writeFileSync(path.join(stage, top, "bin", "node"), node, { mode: 0o755 });
  const nodes = path.join(dir, "nodes", "v24.99.0");
  fs.mkdirSync(nodes, { recursive: true });
  spawnSync("tar", ["-czf", path.join(nodes, name), top], { cwd: stage });
  fs.writeFileSync(path.join(nodes, "SHASUMS256.txt"), `${sum(path.join(nodes, name))}  ${name}\n`);
  return { STROM_DOWNLOAD_BASE: `file://${rel}`, STROM_NODE_BASE: `file://${path.join(dir, "nodes")}` };
}

test("the installer, isolated (STROM_ISOLATED=1): everything in its folder, install.json keeps what it was installed with, no PATH line; without its own folders it refuses", unix, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-installer-"));
  const home = path.join(dir, "home");
  fs.mkdirSync(home);
  const script = path.join(import.meta.dirname, "..", "..", "install", "install.sh");
  const base = { ...release(dir), HOME: home, PATH: "/usr/bin:/bin:/usr/sbin:/sbin", SHELL: "/bin/zsh", LANG: "cs_CZ.UTF-8", STROM_INSTALL_ONLY: "1" };
  const run = (env: Record<string, string>) => spawnSync("sh", [script], { env: { ...base, ...env }, encoding: "utf8" });

  const refused = run({ STROM_ISOLATED: "1", STROM_INSTALL_DIR: path.join(dir, "zkouska") });
  assert.equal(refused.status, 1);
  assert.match(refused.stdout, /STROM_ISOLATED potřebuje vlastní složky/);
  assert.ok(!fs.existsSync(path.join(dir, "zkouska")));
  // the language strom is told wins over the system's (found on Mac: English with STROM_LANG=cs)
  const told = run({ LANG: "en_US.UTF-8", STROM_LANG: "cs", STROM_ISOLATED: "1", STROM_INSTALL_DIR: path.join(dir, "zkouska") });
  assert.match(told.stdout, /STROM_ISOLATED potřebuje vlastní složky/);

  const inst = path.join(dir, "zkouška strom");
  const cfg = path.join(dir, "cfg");
  const r = run({ STROM_ISOLATED: "1", STROM_INSTALL_DIR: inst, STROM_CONFIG_DIR: cfg });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /Izolovaná instalace: .* Spouští se takto: .*zkouška strom\/strom/);
  assert.deepEqual(fs.readdirSync(inst).sort(), ["app", "app-9.9.9", "install.json", "node", "strom"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(inst, "install.json"), "utf8")), {
    launchers: [path.join(inst, "strom")],
    node: "24.99.0",
    version: "9.9.9",
    app: "app-9.9.9",
    env: { STROM_CONFIG_DIR: cfg, HOME: home, STROM_ISOLATED: "1" },
  });
  assert.deepEqual(fs.readdirSync(home), [], "no PATH line, nothing in its HOME");
  // the entry as strom update writes it, word for word; the version in its own folder
  assert.equal(fs.readFileSync(path.join(inst, "app", "dist", "cli.js"), "utf8"), entryScript("app-9.9.9"));
  assert.equal(fs.readFileSync(path.join(inst, "app", "package.json"), "utf8"), entryPackage("9.9.9"));
  assert.equal(fs.readFileSync(path.join(inst, "app-9.9.9", "dist", "cli.js"), "utf8"), "// strom\n");
  // installed again over it (the same version, its folder in use): a folder of its own beside, the one before kept
  const again = run({ STROM_ISOLATED: "1", STROM_INSTALL_DIR: inst, STROM_CONFIG_DIR: cfg });
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.deepEqual(fs.readdirSync(inst).sort(), ["app", "app-9.9.9", "app-9.9.9_2", "install.json", "node", "strom"]);
  assert.equal(currentAppDir(inst), "app-9.9.9_2");
  assert.equal(JSON.parse(fs.readFileSync(path.join(inst, "install.json"), "utf8")).previous, "app-9.9.9");
  // over an installation before 1.25 (the whole program in app/, app.old/ left): the whole kept as the version before
  const older = path.join(dir, "older");
  fs.mkdirSync(path.join(older, "app", "dist", "core"), { recursive: true });
  fs.mkdirSync(path.join(older, "app.old"));
  fs.writeFileSync(path.join(older, "app", "dist", "cli.js"), "// 1.24.0\n");
  const o = run({ STROM_ISOLATED: "1", STROM_INSTALL_DIR: older, STROM_CONFIG_DIR: cfg });
  assert.equal(o.status, 0, o.stdout + o.stderr);
  assert.deepEqual(fs.readdirSync(older).sort(), ["app", "app-9.9.9", "install.json", "node", "strom"]);
  assert.ok(fs.existsSync(path.join(older, "app", "dist", "core")), "what a strom at work reads stays");
  assert.equal(JSON.parse(fs.readFileSync(path.join(older, "install.json"), "utf8")).previous, "app");

  // the person's own: its PATH line, install.json with its settings folder only when set
  const own = run({ STROM_INSTALL_DIR: path.join(dir, "bin"), STROM_PROGRAM_DIR: path.join(dir, "share") });
  assert.equal(own.status, 0, own.stdout + own.stderr);
  assert.match(fs.readFileSync(path.join(home, ".zshrc"), "utf8"), /# strom research/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "share", "install.json"), "utf8")).env, undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the installer of a version before 1.25 (no stromLayout) over an installation with the versions' folders: the whole version in app/ as it knows, the shims' marks kept, install.json without app, previous the version that ran; one that knows the folders again goes into its own", unix, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-installer-old-"));
  const home = path.join(dir, "home");
  fs.mkdirSync(home);
  const script = path.join(import.meta.dirname, "..", "..", "install", "install.sh");
  const inst = path.join(dir, "inst");
  const cfg = path.join(dir, "cfg");
  const base: Record<string, string> = { ...release(dir), HOME: home, PATH: "/usr/bin:/bin:/usr/sbin:/sbin", SHELL: "/bin/zsh", LANG: "en_US.UTF-8", STROM_INSTALL_ONLY: "1", STROM_ISOLATED: "1", STROM_INSTALL_DIR: inst, STROM_CONFIG_DIR: cfg };
  const run = () => spawnSync("sh", [script], { env: base, encoding: "utf8" });
  const first = run();
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.equal(currentAppDir(inst), "app-9.9.9");
  fs.writeFileSync(path.join(inst, "app", "dist", ".strom-shim-0123456789abcdef"), "");
  // the release made one before 1.25: no stromLayout in its package.json
  const rel = new URL(base.STROM_DOWNLOAD_BASE!).pathname;
  const stage = path.join(dir, "old-stage");
  fs.mkdirSync(path.join(stage, "app", "dist", "core"), { recursive: true });
  fs.writeFileSync(path.join(stage, "app", "dist", "cli.js"), "// 1.24.0\n");
  fs.writeFileSync(path.join(stage, "app", "package.json"), JSON.stringify({ name: "strom-research", version: "1.24.0", type: "module" }, null, 2));
  const pack = () => {
    spawnSync("tar", ["-czf", path.join(rel, "strom-app.tar.gz"), "app"], { cwd: stage });
    const sum = crypto.createHash("sha256").update(fs.readFileSync(path.join(rel, "strom-app.tar.gz"))).digest("hex");
    fs.writeFileSync(path.join(rel, "SHASUMS256.txt"), `${sum}  strom-app.tar.gz\n`);
  };
  pack();
  fs.writeFileSync(path.join(rel, "VERSION"), "1.24.0\n");
  const o = run();
  assert.equal(o.status, 0, o.stdout + o.stderr);
  assert.equal(fs.readFileSync(path.join(inst, "app", "dist", "cli.js"), "utf8"), "// 1.24.0\n", "the version itself in app/");
  assert.ok(fs.existsSync(path.join(inst, "app", "dist", "core")));
  assert.ok(fs.existsSync(path.join(inst, "app", "dist", ".strom-shim-0123456789abcdef")), "the shims' mark kept");
  assert.deepEqual(fs.readdirSync(inst).sort(), ["app", "app-9.9.9", "install.json", "node", "strom"], "no app.old");
  const info = JSON.parse(fs.readFileSync(path.join(inst, "install.json"), "utf8"));
  assert.equal(info.version, "1.24.0");
  assert.equal("app" in info, false);
  assert.equal(info.previous, "app-9.9.9");
  // installed again (the same old version over app/ whole): no previous — the whole program before lay in app/
  const again = run();
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.equal("previous" in JSON.parse(fs.readFileSync(path.join(inst, "install.json"), "utf8")), false);
  // one that knows the folders (stromLayout 2): into a folder of its own, app/ kept as the version before
  fs.writeFileSync(path.join(stage, "app", "package.json"), JSON.stringify({ name: "strom-research", version: "1.25.0", type: "module", stromLayout: 2 }, null, 2));
  pack();
  fs.writeFileSync(path.join(rel, "VERSION"), "1.25.0\n");
  const n = run();
  assert.equal(n.status, 0, n.stdout + n.stderr);
  assert.equal(currentAppDir(inst), "app-1.25.0");
  const now = JSON.parse(fs.readFileSync(path.join(inst, "install.json"), "utf8"));
  assert.deepEqual([now.version, now.app, now.previous], ["1.25.0", "app-1.25.0", "app"]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the installer starts strom on the terminal's own device, never /dev/tty (macOS: an agent waiting through kqueue never hears it); /dev/tty when the device is not found", unix, (t) => {
  // a terminal: the installer on a pty of its own, as in a person's terminal (python's pty; script(1) on macOS wants a terminal itself)
  const PTY = "import os, pty, sys\npid, fd = pty.fork()\nif pid == 0:\n    os.execvp(sys.argv[1], sys.argv[1:])\nout = b''\nwhile True:\n    try:\n        b = os.read(fd, 65536)\n    except OSError:\n        break\n    if not b:\n        break\n    out += b\nsys.stdout.write(out.decode('utf-8', 'replace'))\nsys.exit(os.waitstatus_to_exitcode(os.waitpid(pid, 0)[1]))\n";
  const viaPty = (cmd: string[], env: Record<string, string>) => spawnSync("python3", ["-c", PTY, ...cmd], { env, encoding: "utf8", timeout: 60_000 });
  if (spawnSync("python3", ["-c", "import pty"]).status !== 0) return t.skip("no python3 here to make a terminal");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-installer-"));
  const home = path.join(dir, "home");
  fs.mkdirSync(home);
  const script = path.join(import.meta.dirname, "..", "..", "install", "install.sh");
  // strom as installed: says the device its input comes from
  const said = release(dir, '#!/bin/sh\ncase "$1" in --version) echo v24.99.0 ;; *) echo "STROM STDIN $(/usr/bin/tty)" ;; esac\n');
  const env = { ...said, HOME: home, PATH: "/usr/bin:/bin:/usr/sbin:/sbin", SHELL: "/bin/zsh", LANG: "cs_CZ.UTF-8", STROM_ISOLATED: "1", STROM_CONFIG_DIR: path.join(dir, "cfg") };

  const r = viaPty(["sh", script], { ...env, STROM_INSTALL_DIR: path.join(dir, "a") });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const got = /STROM STDIN (\S+)/.exec(r.stdout)?.[1];
  assert.ok(got, r.stdout);
  assert.match(got, /^\/dev\/(ttys?\w*\d|pts\/\d+)$/, "the terminal's own device");
  assert.notEqual(got, "/dev/tty");

  // the device not found (no tty(1) that answers): /dev/tty, as before
  const bin = path.join(dir, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "tty"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  const fallback = viaPty(["sh", script], { ...env, PATH: `${bin}:${env.PATH}`, STROM_INSTALL_DIR: path.join(dir, "b") });
  assert.equal(fallback.status, 0, fallback.stdout + fallback.stderr);
  assert.match(fallback.stdout, /STROM STDIN \/dev\/tty\s/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("strom uninstall finds the stroms of its installation still running — a bridge (stopped) and another window (closed first); never itself or another installation's", () => {
  const win = "C:\\Users\\Pavla\\AppData\\Local\\Programs\\Strom";
  const listed = JSON.stringify([
    { ProcessId: 101, ExecutablePath: `${win}\\node\\node.exe`, CommandLine: `"${win}\\node\\node.exe" "${win}\\app\\dist\\cli.js" live serve` },
    { ProcessId: 102, ExecutablePath: `${win.toLowerCase()}\\node\\node.exe`, CommandLine: `"${win}\\node\\node.exe" "${win}\\app\\dist\\cli.js"` },
    { ProcessId: 103, ExecutablePath: "C:\\strom-test\\node\\node.exe", CommandLine: "node cli.js menu" },
    { ProcessId: process.pid, ExecutablePath: `${win}\\node\\node.exe`, CommandLine: `"${win}\\node\\node.exe" "${win}\\app\\dist\\cli.js" uninstall` },
  ]);
  const windows = (cmd: string) => (assert.equal(cmd, "powershell.exe"), { status: 0, stdout: listed });
  assert.deepEqual(ownProcesses(win, "win32", windows), [
    { pid: 101, args: "live serve", bridge: true },
    { pid: 102, args: "", bridge: false },
  ]);
  // one process only: PowerShell gives an object, not a list
  assert.equal(ownProcesses(win, "win32", () => ({ status: 0, stdout: JSON.stringify(JSON.parse(listed)[0]) })).length, 1);
  const root = "/Users/pavla/.local/share/strom";
  const ps = ` 201 ${root}/node/bin/node ${root}/app/dist/cli.js run --loop\n 202 /opt/homebrew/bin/node /x/cli.js menu\n ${process.pid} ${root}/node/bin/node ${root}/app/dist/cli.js uninstall\n`;
  assert.deepEqual(ownProcesses(root, "darwin", () => ({ status: 0, stdout: ps })), [{ pid: 201, args: "run --loop", bridge: false }]);
});

test("a newer version: by its numbers, the release newer than its candidates, rc.8 than rc.7", () => {
  assert.equal(isNewer("1.12.0", "1.11.0"), true);
  assert.equal(isNewer("1.11.0", "1.12.0-rc.7"), false, "the release before: no update offered to a candidate");
  assert.equal(isNewer("1.12.0", "1.12.0-rc.7"), true, "the release itself is offered to its candidate");
  assert.equal(isNewer("1.12.0-rc.8", "1.12.0-rc.7"), true);
  assert.equal(isNewer("1.12.0-rc.7", "1.12.0"), false);
  assert.equal(isNewer("1.12.0", "1.12.0"), false);
  assert.equal(isNewer("v1.2.10", "1.2.9"), true);
});

test("the Windows installer needs no -ExecutionPolicy Bypass: nothing of Windows PowerShell 5.1's script modules, which the policy Restricted keeps from loading (Get-FileHash, the archive's, …) — SHA-256 by .NET", () => {
  const ps1 = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "install", "install.ps1"), "utf8");
  const code = ps1.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  for (const cmd of ["Get-FileHash", "Expand-Archive", "Compress-Archive", "New-TemporaryFile", "Format-Hex", "Import-PowerShellDataFile", "ConvertFrom-SddlString", "Import-Module", "Set-ExecutionPolicy"])
    assert.doesNotMatch(code, new RegExp(`\\b${cmd}\\b`, "i"), `${cmd} in install.ps1`);
  assert.match(code, /\[Security\.Cryptography\.SHA256\]::Create\(\)/);
  // no script of its own run as a file (that one would need the policy): the installer is the one expression `irm | iex` runs
  assert.doesNotMatch(code, /\s-File\b|\.ps1['"]?\s*$|&\s*['"][^'"]+\.ps1/m);
});

test("the system's own tar unpacks the downloads on Windows: Git's usr\\bin first on PATH (strom started from Git Bash) gave GNU tar, which reads C:\\… as a host and failed — the installer and strom update, strom's own git alike", () => {
  const ps1 = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "install", "install.ps1"), "utf8");
  const code = ps1.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  assert.match(code, /\$tar = if \(\$env:SystemRoot\) \{ Join-Path \$env:SystemRoot 'System32\\tar\.exe' \}/);
  assert.doesNotMatch(code, /&\s*tar(\.exe)?\s/i, "never the tar PATH finds first");
  assert.equal((code.match(/& \$tar -x/g) ?? []).length, 2, "Node and strom's code");
  const sys = "C:\\Windows\\System32\\tar.exe";
  assert.equal(tarProgram({ SystemRoot: "C:\\Windows" }, "win32", (f) => f === sys), sys);
  assert.equal(tarProgram({ SYSTEMROOT: "C:\\Windows" }, "win32", (f) => f === sys), sys);
  assert.equal(tarProgram({ SystemRoot: "C:\\Windows" }, "win32", () => false), "tar", "none there: PATH's");
  assert.equal(tarProgram({}, "darwin", () => true), "tar");
  for (const f of ["update.ts", "deps.ts"]) {
    const src = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "src", "core", f), "utf8");
    assert.doesNotMatch(src, /spawnSync\("tar"/, `${f} takes tarProgram`);
  }
});

test("a newer version by semver: prereleases by their identifiers (beta.10 > beta.2, rc > beta), the release above them all", () => {
  assert.equal(isNewer("1.13.0-beta.10", "1.13.0-beta.2"), true, "numbers as numbers");
  assert.equal(isNewer("1.13.0-beta.2", "1.13.0-beta.10"), false);
  assert.equal(isNewer("1.13.0-rc.1", "1.13.0-beta.9"), true, "rc after beta");
  assert.equal(isNewer("1.13.0-beta.9", "1.13.0-rc.1"), false);
  assert.equal(isNewer("1.13.0", "1.13.0-rc.1"), true);
  assert.equal(isNewer("1.13.0-beta.2", "1.13.0-rc.2"), false, "the same number, another word: not the same version");
  assert.equal(isNewer("1.13.0-alpha.1", "1.13.0-alpha"), true, "a longer set above its shorter prefix");
  assert.equal(isNewer("1.13.0-alpha.beta", "1.13.0-alpha.1"), true, "a word above a number");
  assert.equal(isNewer("1.13.0-beta.1", "1.12.9"), true);
  assert.equal(compareVersions("v1.13.0-beta.3", "1.13.0-beta.3"), 0);
  const sorted = ["1.0.0", "1.0.0-rc.1", "1.0.0-beta.11", "1.0.0-beta.2", "1.0.0-beta", "1.0.0-alpha.beta", "1.0.0-alpha.1", "1.0.0-alpha"].sort(compareVersions);
  assert.deepEqual(sorted, ["1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0"], "semver.org's own order");
});

test("the channel: STROM_CHANNEL, then install.json, then a prerelease not run from the sources (npm's beta), else the releases", () => {
  const installed = { kind: "installed" as const, root: "/x" };
  assert.equal(updateChannel({}, installed, "1.13.0"), "stable");
  assert.equal(updateChannel({}, { ...installed, channel: "beta" }, "1.13.0"), "beta", "install.json");
  assert.equal(updateChannel({ STROM_CHANNEL: "stable" }, { ...installed, channel: "beta" }, "1.13.0-beta.1"), "stable", "the environment wins");
  assert.equal(updateChannel({ STROM_CHANNEL: "beta" }, installed, "1.13.0"), "beta");
  assert.equal(updateChannel({}, { kind: "npm" }, "1.13.0-beta.2"), "beta", "npm install -g strom-research@beta");
  assert.equal(updateChannel({}, { kind: "npm" }, "1.13.0", {}), "stable");
  assert.equal(updateChannel({}, { kind: "source" }, "1.13.0-rc.4"), "stable", "a candidate in the sources is no beta");
  assert.equal(updateChannel({ STROM_CHANNEL: "nonsense" }, { kind: "source" }, "1.13.0"), "stable");
});

test("npm's strom: a release after a beta stays on the beta (npm's beta moves to each release), until the person says otherwise or goes back to an older release", () => {
  const npm = { kind: "npm" as const };
  const onBeta = { lastVersion: "1.24.0-beta.2", lastChannel: "beta" as const };
  // npm install -g strom-research@beta after the release of 1.24.0: the release itself, on the beta still
  assert.equal(updateChannel({}, npm, "1.24.0", onBeta), "beta");
  assert.equal(updateChannel({}, npm, "1.24.0", { lastVersion: "1.24.0", lastChannel: "beta" }), "beta", "its next runs too");
  assert.equal(npmChannel({ lastVersion: "1.24.1", lastChannel: "beta" }, "1.25.0"), "beta");
  // npm install -g strom-research@latest back from a beta: an older release is stable
  assert.equal(updateChannel({}, npm, "1.23.0", onBeta), "stable");
  assert.equal(updateChannel({}, npm, "1.24.0", { lastVersion: "1.23.0", lastChannel: "stable" }), "stable", "the releases stay the releases");
  assert.equal(updateChannel({}, npm, "1.24.0", {}), "stable", "a first run ever");
  // strom update --channel: the person's word holds for a release; a beta is a beta whatever was said
  assert.equal(updateChannel({}, npm, "1.24.0", { ...onBeta, npmChannel: "stable" }), "stable");
  assert.equal(updateChannel({}, npm, "1.24.0", { lastVersion: "1.23.0", lastChannel: "stable", npmChannel: "beta" }), "beta");
  assert.equal(updateChannel({}, npm, "1.25.0-beta.1", { npmChannel: "stable" }), "beta");
  assert.equal(updateChannel({ STROM_CHANNEL: "stable" }, npm, "1.24.0", onBeta), "stable", "the environment wins");
  // as a new version first runs: a beta installed after "stable", an older release after "beta" — npm's choice since
  assert.equal(npmChannelKept({ lastVersion: "1.24.0", npmChannel: "stable" }, "1.25.0-beta.1"), undefined);
  assert.equal(npmChannelKept({ lastVersion: "1.24.0", npmChannel: "stable" }, "1.24.1"), "stable");
  assert.equal(npmChannelKept({ lastVersion: "1.25.0-beta.1", npmChannel: "beta" }, "1.24.0"), undefined);
  assert.equal(npmChannelKept({ lastVersion: "1.25.0-beta.1", npmChannel: "beta" }, "1.25.0"), "beta");
  assert.equal(npmChannelKept({ lastVersion: "1.24.0" }, "1.25.0"), undefined);
  // the installer's strom: install.json says it, the memory of npm's never counts
  assert.equal(updateChannel({}, { kind: "installed", root: "/x" }, "1.24.0", onBeta), "stable");
});

test("a long process (the bridge) takes the channel as install.json says it now — a switch to the releases said at once; what it runs stays what it started with", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "strom-inst-ěš-"));
  try {
    fs.mkdirSync(path.join(root, "app", "dist", "core"), { recursive: true });
    const info = path.join(root, "install.json");
    fs.writeFileSync(info, JSON.stringify({ launchers: [], node: "24.1.0", channel: "beta" }));
    const inst = installationAt(path.join(root, "app", "dist", "core", "self.js"));
    assert.equal(inst().channel, "beta");
    assert.equal(updateChannel({}, inst(), "1.17.0"), "beta");
    // strom update --channel stable in another process: install.json rewritten, nothing else installed
    setInstallChannel(root, "stable");
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(info, later, later);
    assert.equal(inst().channel, undefined);
    assert.equal(updateChannel({}, inst(), "1.17.0"), "stable");
    // back to the beta, and a newer Node written: the channel follows, the Node this process runs does not
    fs.writeFileSync(info, JSON.stringify({ launchers: [], node: "26.0.0", channel: "beta" }));
    const later2 = new Date(Date.now() + 10000);
    fs.utimesSync(info, later2, later2);
    assert.deepEqual([inst().channel, inst().node], ["beta", "24.1.0"]);
    // being written (not JSON yet): the channel as it was
    fs.writeFileSync(info, "{");
    assert.equal(inst().channel, "beta");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/** GitHub's list of releases, as its API gives it (the fields that matter, and some that must not). */
const RELEASES_JSON = JSON.stringify([
  { url: "u", author: { login: "x", id: 1 }, tag_name: "v1.3.0-beta.2", name: "v1.3.0-beta.2", draft: false, prerelease: true, assets: [{ name: "VERSION" }], body: 'not "tag_name": "v9.9.9"' },
  { tag_name: "v2.0.0", draft: true, prerelease: false },
  { tag_name: "v1.3.0-beta.10", draft: false, prerelease: true },
  { tag_name: "v1.2.0", draft: false, prerelease: false },
  { tag_name: "nightly", draft: false, prerelease: true },
]);

test("the newest release of the beta channel: GitHub's list, drafts and other tags left out, the semver maximum; STROM_DOWNLOAD_BASE wins; nothing to read: none", async () => {
  assert.equal(newestTag(JSON.parse(RELEASES_JSON)), "v1.3.0-beta.10");
  assert.equal(newestTag({ message: "API rate limit exceeded" }), undefined);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-channel-"));
  const api = path.join(dir, "releases.json");
  fs.writeFileSync(api, RELEASES_JSON);
  fs.mkdirSync(path.join(dir, "base"));
  fs.writeFileSync(path.join(dir, "base", "VERSION"), "1.2.0\n");
  const beta = { STROM_RELEASES_API: api, STROM_RELEASE_DOWNLOAD: "file:///dl" };
  assert.deepEqual(await latestRelease(beta, { channel: "beta" }), { version: "1.3.0-beta.10", base: "file:///dl/v1.3.0-beta.10" });
  assert.deepEqual(await latestRelease({ STROM_RELEASES_API: `file://${api}` }, { channel: "beta" }), { version: "1.3.0-beta.10", base: "https://github.com/ACiDekCZ/strom-research/releases/download/v1.3.0-beta.10" });
  assert.deepEqual(await latestRelease({ ...beta, STROM_DOWNLOAD_BASE: `file://${path.join(dir, "base")}` }, { channel: "beta" }), { version: "1.2.0", base: `file://${path.join(dir, "base")}` }, "the download base always wins");
  assert.deepEqual(await latestRelease({ STROM_DOWNLOAD_BASE: `file://${path.join(dir, "base")}` }, { channel: "stable" }), { version: "1.2.0", base: `file://${path.join(dir, "base")}` });
  assert.equal(await latestRelease({ STROM_RELEASES_API: path.join(dir, "none.json") }, { channel: "beta" }), undefined, "no list: no update known");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the daily look remembers its channel: a stable answer is none for the beta channel, and the other way round", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-channel-"));
  const env = { HOME: dir, STROM_CONFIG_DIR: path.join(dir, "cfg") };
  const settings = new Settings(env, {});
  settings.config.updateCheck = { at: new Date().toISOString(), latest: "99.0.0" };
  assert.equal(knownNewerVersion(settings, { ...env, STROM_CHANNEL: "stable" }), "99.0.0");
  assert.equal(knownNewerVersion(settings, { ...env, STROM_CHANNEL: "beta" }), undefined, "the releases' answer is no beta's");
  settings.config.updateCheck = { at: new Date().toISOString(), latest: "99.0.0-beta.1", channel: "beta" };
  assert.equal(knownNewerVersion(settings, { ...env, STROM_CHANNEL: "beta" }), "99.0.0-beta.1");
  assert.equal(knownNewerVersion(settings, { ...env, STROM_CHANNEL: "stable" }), undefined, "a beta's answer is none for the releases");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("strom update keeps the channel and what the installation was installed with; another channel written or taken away, an older version too", unix, async () => {
  const w = world();
  const info = () => JSON.parse(fs.readFileSync(path.join(w.root, "install.json"), "utf8"));
  fs.writeFileSync(path.join(w.root, "install.json"), JSON.stringify({ ...info(), channel: "beta" }));
  assert.deepEqual(await installUpdate(w.env, w.root), { version: "9.9.9", dir: "app-9.9.9" });
  assert.equal(info().channel, "beta", "kept");
  assert.deepEqual(info().env, { STROM_CONFIG_DIR: path.join(w.dir, "cfg") });
  // back to the releases: an older version than the one there, the channel gone
  fs.writeFileSync(path.join(w.release, "VERSION"), "1.0.0\n");
  assert.deepEqual(await installUpdate(w.env, w.root, process.platform, { channel: "stable" }), { version: "1.0.0", dir: "app-1.0.0" });
  assert.equal(info().version, "1.0.0");
  assert.equal("channel" in info(), false);
  assert.deepEqual(info().env, { STROM_CONFIG_DIR: path.join(w.dir, "cfg") }, "what it was installed with stays");
  setInstallChannel(w.root, "beta");
  assert.equal(info().channel, "beta");
  setInstallChannel(w.root, "stable");
  assert.equal("channel" in info(), false);
  fs.rmSync(w.dir, { recursive: true, force: true });
});

test("the installer with STROM_CHANNEL=beta: the newest of every release by semver from GitHub's list (a file, a file:// address), install.json says its channel; without it none", unix, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-installer-"));
  const home = path.join(dir, "home");
  fs.mkdirSync(home);
  const script = path.join(import.meta.dirname, "..", "..", "install", "install.sh");
  const { STROM_DOWNLOAD_BASE: rel, ...rest } = release(dir);
  // the releases' folders: each tag its own files (only the newest beta can be installed)
  const dl = path.join(dir, "download");
  fs.cpSync(new URL(rel!).pathname, path.join(dl, "v1.3.0-beta.10"), { recursive: true });
  fs.writeFileSync(path.join(dl, "v1.3.0-beta.10", "VERSION"), "1.3.0-beta.10\n");
  const api = path.join(dir, "releases.json");
  fs.writeFileSync(api, RELEASES_JSON);
  const base = { ...rest, HOME: home, PATH: "/usr/bin:/bin:/usr/sbin:/sbin", SHELL: "/bin/zsh", LANG: "en_US.UTF-8", STROM_INSTALL_ONLY: "1", STROM_ISOLATED: "1", STROM_RELEASE_DOWNLOAD: `file://${dl}` };
  const run = (env: Record<string, string>) => spawnSync("sh", [script], { env: { ...base, ...env }, encoding: "utf8" });
  const info = (inst: string) => JSON.parse(fs.readFileSync(path.join(inst, "install.json"), "utf8"));

  for (const [i, list] of [api, `file://${api}`].entries()) {
    const inst = path.join(dir, `beta${i}`);
    const r = run({ STROM_CHANNEL: "beta", STROM_RELEASES_API: list, STROM_INSTALL_DIR: inst, STROM_CONFIG_DIR: path.join(dir, `cfg${i}`) });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(info(inst).version, "1.3.0-beta.10", "beta.10 above beta.2 and 1.2.0; the draft 2.0.0 never");
    assert.equal(info(inst).channel, "beta");
  }
  // no release in the list: said, nothing installed
  fs.writeFileSync(path.join(dir, "empty.json"), "[]");
  const none = run({ STROM_CHANNEL: "beta", STROM_RELEASES_API: path.join(dir, "empty.json"), STROM_INSTALL_DIR: path.join(dir, "none"), STROM_CONFIG_DIR: path.join(dir, "cfgn") });
  assert.equal(none.status, 1);
  assert.match(none.stdout, /No release could be found/);
  assert.ok(!fs.existsSync(path.join(dir, "none", "install.json")));
  // the download base always wins; the channel is still the installation's
  const fixed = run({ STROM_CHANNEL: "beta", STROM_DOWNLOAD_BASE: rel!, STROM_RELEASES_API: path.join(dir, "empty.json"), STROM_INSTALL_DIR: path.join(dir, "fixed"), STROM_CONFIG_DIR: path.join(dir, "cfgf") });
  assert.equal(fixed.status, 0, fixed.stdout + fixed.stderr);
  assert.equal(info(path.join(dir, "fixed")).version, "9.9.9");
  assert.equal(info(path.join(dir, "fixed")).channel, "beta");
  // the releases (no STROM_CHANNEL, or stable): as ever, no channel written, the list never read
  for (const ch of [undefined, "stable"]) {
    const inst = path.join(dir, `stable-${ch ?? "none"}`);
    const r = run({ ...(ch ? { STROM_CHANNEL: ch } : {}), STROM_DOWNLOAD_BASE: rel!, STROM_RELEASES_API: path.join(dir, "missing.json"), STROM_INSTALL_DIR: inst, STROM_CONFIG_DIR: path.join(dir, `cfg-${ch}`) });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(info(inst).version, "9.9.9");
    assert.equal("channel" in info(inst), false);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the Windows installer takes the channel the same way: STROM_CHANNEL beta, GitHub's list with a User-Agent, drafts left out, semver, the channel in install.json", () => {
  const ps1 = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "install", "install.ps1"), "utf8");
  const code = ps1.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  assert.match(code, /\$env:STROM_CHANNEL/);
  assert.match(code, /\$env:STROM_DOWNLOAD_BASE\)/, "the download base wins");
  assert.match(code, /api\.github\.com\/repos\/ACiDekCZ\/strom-research\/releases\?per_page=30/);
  assert.match(code, /\$env:STROM_RELEASES_API/);
  assert.match(code, /'User-Agent'/);
  assert.match(code, /\.draft -eq \$true/);
  assert.match(code, /function Compare-Version/);
  assert.match(code, /releases\/download/);
  assert.match(code, /if \(\$channel\) \{ \$info\.channel = \$channel \}/);
});

test("the Windows installer puts each version in a folder of its own the same way: the entry it names read back, app-<version> free or another name, the entry and app/package.json written aside and moved over whole, app.old/ gone, install.json app and previous — app/ renamed only for a version before 1.25 (no stromLayout), its shims' marks kept", () => {
  const ps1 = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "install", "install.ps1"), "utf8");
  const code = ps1.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  // the entry's line as strom update writes it, and the installer reads it back by the same pattern
  const line = entryScript("app-9.9.9").split("\n")[2]!;
  const pattern = /\[regex\]::Match\(\[IO\.File\]::ReadAllText\(\$entry\), '([^']+)'\)/.exec(code)?.[1];
  assert.ok(pattern, "the entry read back");
  assert.equal(new RegExp(pattern!.replace("(?m)", ""), "m").exec(line)?.[1], "app-9.9.9");
  assert.ok(code.includes("await import(`\"../../$dir/dist/cli.js`\");"), "the same entry written");
  for (const head of entryScript("x").split("\n").slice(0, 2)) assert.ok(code.includes(head), head);
  assert.match(code, /\$dir = "app-\$version"/);
  assert.match(code, /Move-Item \(Join-Path \$tmp 'app'\) \(Join-Path \$dest \$dir\)/);
  assert.equal((code.match(/Move-Item -Force \$aside /g) ?? []).length, 2, "package.json, then the entry");
  assert.match(code, /\$info\.app = \$dir/);
  assert.match(code, /\$info\.previous = \$before/);
  assert.doesNotMatch(code, /Move-Item[^\n]*'app'\)? -Destination[^\n]*app\.old/, "app/ never renamed to app.old");
  assert.match(code, /Remove-Item[^\n]*app\.old/);
  // a version before 1.25 (layout 1, the same rule as core/update.ts layoutOf): the whole version in app/
  assert.match(code, /\.stromLayout/);
  assert.match(code, /if \(\$layout -lt 2\) \{/);
  assert.match(code, /Move-Item \$app \$old \}\n\s*Move-Item \(Join-Path \$tmp 'app'\) \$app/);
  assert.match(code, /'\.strom-shim-\*'/);
  assert.match(code, /if \(\$dir\) \{ \$info\.app = \$dir \}/, "no app for a version before 1.25");
  assert.ok(VERSION_FOLDERS === 2, "the installers say 2 too");
});

test("a research's folder never inside strom's program folder: anywhere in the installer's folder refused (app/, node/, beside them), the settings folder lying in it allowed unless in app/; named another way (case, /tmp and /private/tmp) the same; strom update refuses what lies in app/, app.old/, node/ and installs nothing", unix, async () => {
  const w = world();
  const inst = { kind: "installed" as const, root: w.root, launchers: [w.launcher] };
  const settings = path.join(w.root, "cfg");
  for (const p of [path.join(w.root, "app", "výzkum"), path.join(w.root, "node", "x"), path.join(w.root, "Strom research"), w.root, path.join(w.root, "app.old"), path.join(w.root, "git", "Новиковы")])
    assert.equal(insideProgram(p, { inst, settings }), w.root, p);
  for (const p of [path.join(w.dir, "Strom"), path.join(w.dir, "share", "strom-other"), path.join(settings, "Strom research")]) assert.equal(insideProgram(p, { inst, settings }), undefined, p);
  assert.equal(insideProgram(path.join(w.root, "app", "cfg", "Strom research"), { inst, settings: path.join(w.root, "app", "cfg") }), w.root, "a settings folder in app/ is no excuse");
  // another case on a disk that ignores it; the folder as the disk has it (a symbolic link to it)
  assert.equal(insideProgram(path.join(w.root.toUpperCase(), "APP", "Výzkum"), { inst, platform: "darwin" }), w.root);
  const link = path.join(w.dir, "odkaz");
  fs.symlinkSync(w.root, link);
  assert.equal(insideProgram(path.join(link, "app", "nový", "strom"), { inst }), w.root, "through a symbolic link, a folder not there yet");
  assert.equal(insideProgram(path.join(w.dir, "x"), { inst: { kind: "source" } }), undefined, "run from the sources: no program folder");
  // strom update: a research in app/ refused before anything is touched
  const home = path.join(w.root, "app", "Strom");
  fs.mkdirSync(path.join(home, "backups", "b1"), { recursive: true });
  fs.writeFileSync(path.join(home, "backups", "b1", "strom.json"), "{}");
  assert.deepEqual(replacedHolding(w.root, [home, path.join(w.dir, "cfg")]), [{ folder: home, entry: path.join(w.root, "app") }]);
  assert.deepEqual(replacedHolding(w.root, [path.join(w.root, "Strom research")]), [], "beside app/: an update leaves it");
  // a version's own folder (app-<version>) is strom's as app/ is: a research there refused, an update would remove it
  const inVersion = path.join(w.root, "app-1.25.0", "Strom");
  assert.equal(insideProgram(inVersion, { inst, settings }), w.root);
  assert.deepEqual(replacedHolding(w.root, [inVersion]), [{ folder: inVersion, entry: path.join(w.root, "app-1.25.0") }]);
  assert.deepEqual(replacedHolding(w.root, [path.join(w.root, "app-notes", "Strom")]), [], "a folder of the person's named so: no version");
  await assert.rejects(installUpdate(w.env, w.root, process.platform, { keep: [home] }), /lies inside .*app.*nothing was installed/);
  assert.equal(fs.readFileSync(path.join(w.root, "app", "dist", "cli.js"), "utf8"), "// 1.0.0\n", "the old code stays");
  assert.equal(fs.readFileSync(path.join(home, "backups", "b1", "strom.json"), "utf8"), "{}");
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "install.json", "node"], "no work folder left");
  fs.rmSync(w.dir, { recursive: true, force: true });
});

test("strom uninstall takes from install.json's launchers only a file of a launcher's name (strom, strom.cmd, strom-<suffix>…) outside the research — a tree's file listed there, or another name, stays and is said; the Windows command never names them (found 2026-10-07: a tree's strom.json went)", unix, () => {
  const w = world();
  const home = path.join(w.dir, "Strom");
  const tree = path.join(home, "Novákovi");
  fs.mkdirSync(tree, { recursive: true });
  const treeFile = path.join(tree, "strom.json");
  fs.writeFileSync(treeFile, "{}");
  const inTree = path.join(tree, "strom"); // a launcher's name, inside the research
  fs.writeFileSync(inTree, "moje");
  const odd = path.join(w.dir, "bin", "poznámka.txt");
  fs.writeFileSync(odd, "moje");
  const own = path.join(w.dir, "bin", "strom-beta");
  fs.writeFileSync(own, "#!/bin/sh\n");
  const launchers = [w.launcher, own, treeFile, inTree, odd];
  assert.deepEqual(launchersToTake(launchers, [home, tree]), { take: [w.launcher, own], skipped: [treeFile, inTree, odd] });
  assert.deepEqual(launchersToTake(["C:\\S\\STROM.CMD", "C:\\S\\bin\\strom-beta.cmd", "C:\\S\\strom.json", "C:\\S\\stromy.cmd"], [], "win32").skipped, ["C:\\S\\strom.json", "C:\\S\\stromy.cmd"]);
  const plan = uninstallPlan(w.env, [], { platform: "linux", install: { kind: "installed", root: w.root, launchers }, keep: [home, tree] });
  assert.deepEqual(plan.skipped, [treeFile, inTree, odd]);
  assert.equal(plan.remove.find((r) => r.kind === "program")!.remove(), true);
  assert.ok(!fs.existsSync(w.launcher) && !fs.existsSync(own), "strom's launchers go");
  for (const f of [treeFile, inTree, odd]) assert.equal(fs.readFileSync(f, "utf8"), f === treeFile ? "{}" : "moje", `${f} stays`);
  // Windows: the command names none of them
  const later: string[] = [];
  const v = world();
  uninstallPlan(v.env, [], { platform: "win32", install: { kind: "installed", root: v.root, launchers }, keep: [home, tree], later: (c) => later.push(c) }).remove.find((r) => r.kind === "program")!.remove();
  for (const f of [treeFile, inTree, odd]) assert.ok(!later[0]!.includes(f), `${f} not in ${later[0]}`);
  assert.ok(later[0]!.includes(own) && later[0]!.includes(w.launcher));
  assert.ok(!windowsRemoval("C:\\S", ["C:\\Users\\x\\Strom\\N\\strom.json", "C:\\Users\\x\\bin\\strom-beta.cmd"], []).includes("strom.json"), "the command alone: a launcher by its name only");
  for (const y of [w, v]) fs.rmSync(y.dir, { recursive: true, force: true });
});

test("strom uninstall with the research in the program's folder itself: the launcher there goes with what the installer put there, and is said as taken, never as staying; what stays is said (found on a Mac: \"inst/strom … stays\", and it went)", unix, () => {
  const w = world();
  const inRoot = path.join(w.root, "strom");
  fs.writeFileSync(inRoot, "#!/bin/sh\n", { mode: 0o755 });
  const beta = path.join(w.root, "strom-beta"); // a launcher's name the installer never puts there: stays, said
  fs.writeFileSync(beta, "moje");
  const tree = path.join(w.root, "Novákovi");
  fs.mkdirSync(tree);
  fs.writeFileSync(path.join(tree, "strom.json"), "{}");
  const keep = [w.root, tree];
  const plan = uninstallPlan(w.env, [], { platform: "linux", install: { kind: "installed", root: w.root, launchers: [w.launcher, inRoot, beta] }, keep });
  assert.deepEqual(plan.skipped, [beta]);
  assert.equal(plan.remove.find((r) => r.kind === "program")!.remove(), true);
  assert.ok(!fs.existsSync(inRoot) && !fs.existsSync(w.launcher), "both launchers go");
  assert.equal(fs.readFileSync(beta, "utf8"), "moje", "the one said to stay stays");
  assert.equal(fs.readFileSync(path.join(tree, "strom.json"), "utf8"), "{}");
  // a folder of the launcher's name there is none: said to stay, and stays
  const v = world();
  fs.mkdirSync(path.join(v.root, "strom"));
  const p2 = uninstallPlan(v.env, [], { platform: "linux", install: { kind: "installed", root: v.root, launchers: [path.join(v.root, "strom")] }, keep: [v.root] });
  assert.deepEqual(p2.skipped, [path.join(v.root, "strom")]);
  p2.remove.find((r) => r.kind === "program")!.remove();
  assert.ok(fs.statSync(path.join(v.root, "strom")).isDirectory());
  for (const y of [w, v]) fs.rmSync(y.dir, { recursive: true, force: true });
});

test("the Windows installer's error stays on the screen: a trap says it and waits for Enter only when somebody can press it (input not redirected), never exit", () => {
  const ps1 = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "install", "install.ps1"), "utf8");
  const code = ps1.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  const trap = code.match(/\ntrap \{[\s\S]*?\n\}\n/)?.[0] ?? "";
  assert.ok(trap, "a trap at the script's level");
  assert.match(trap, /\$_\.Exception\.Message/);
  assert.match(trap, /\[Console\]::IsInputRedirected/);
  assert.match(trap, /Enter zavře okno/);
  assert.match(trap, /\bbreak\b/);
  assert.doesNotMatch(code, /^\s*exit\b/m, "an exit would close a PowerShell the line was pasted into");
  assert.ok(code.indexOf("function T(") < code.indexOf("\ntrap {"), "its sentence in the person's language");
  const agents = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "install", "AGENTS.md"), "utf8");
  // the branch beta's tree (the tag's workflow tests it) gives the beta's line
  if (isBetaAgents(agents)) assert.match(agents, /`\$env:STROM_CHANNEL='beta'; irm https:\/\/raw\.githubusercontent\.com\/ACiDekCZ\/strom-research\/beta\/install\/install\.ps1 \| iex`/);
  else assert.match(agents, /powershell -ExecutionPolicy Bypass -c "irm https:\/\/stromapp\.info\/research\/install\.ps1 \| iex"/);
});
