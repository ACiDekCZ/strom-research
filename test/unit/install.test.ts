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
import { installUpdate, nodeArchive } from "../../src/core/update.ts";
import { uninstallPlan } from "../../src/core/uninstall.ts";

const unix = { skip: process.platform === "win32" };

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
  fs.writeFileSync(path.join(root, "install.json"), JSON.stringify({ launchers: [launcher], node: "26.9.0", version: "1.0.0" }));
  // A release: the new code, its checksum, the versions.
  const release = path.join(dir, "release");
  const stage = path.join(dir, "stage", "app", "dist");
  fs.mkdirSync(stage, { recursive: true });
  fs.mkdirSync(release);
  fs.writeFileSync(path.join(stage, "cli.js"), "// 9.9.9\n");
  spawnSync("tar", ["-czf", path.join(release, "strom-app.tar.gz"), "app"], { cwd: path.join(dir, "stage") });
  const sha = crypto.createHash("sha256").update(fs.readFileSync(path.join(release, "strom-app.tar.gz"))).digest("hex");
  fs.writeFileSync(path.join(release, "SHASUMS256.txt"), `${sha}  strom-app.tar.gz\n`);
  fs.writeFileSync(path.join(release, "VERSION"), "9.9.9\n");
  fs.writeFileSync(path.join(release, "NODE_VERSION"), "26.9.0\n");
  return { dir, root, launcher, release, env: { HOME: dir, STROM_DOWNLOAD_BASE: `file://${release}`, STROM_NODE_BASE: `file://${path.join(dir, "no-node")}` } };
}

test("strom update: the new code in place of the old, Node kept when the release asks for the same", unix, async () => {
  const w = world();
  assert.deepEqual(await installUpdate(w.env, w.root), { version: "9.9.9" });
  assert.equal(fs.readFileSync(path.join(w.root, "app", "dist", "cli.js"), "utf8"), "// 9.9.9\n");
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.root, "install.json"), "utf8")).version, "9.9.9");
  assert.equal(fs.readFileSync(path.join(w.root, "node", "bin", "node"), "utf8"), "#!/bin/sh\n", "Node untouched");
  assert.deepEqual(fs.readdirSync(w.root).sort(), ["app", "install.json", "node"], "nothing left over");
  fs.rmSync(w.dir, { recursive: true, force: true });
});

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
  assert.deepEqual(await installUpdate(w.env, w.root), { version: "9.9.9", node: { from: "26.9.0", to: "24.99.0" } });
  assert.match(fs.readFileSync(path.join(w.root, "node", "bin", "node"), "utf8"), /v24\.99\.0/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.root, "install.json"), "utf8")).node, "24.99.0");
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
