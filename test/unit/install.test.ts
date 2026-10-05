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
import { installUpdate, isNewer, nodeArchive } from "../../src/core/update.ts";
import { ownProcesses, uninstallPlan } from "../../src/core/uninstall.ts";
import { withInstallEnv } from "../../src/core/self.ts";
import { desktopDir, documentsDir } from "../../src/core/paths.ts";
import { globalTargets } from "../../src/agents/global.ts";
import { registerLinks } from "../../src/core/links.ts";

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
  fs.writeFileSync(path.join(root, "install.json"), JSON.stringify({ launchers: [launcher], node: "26.9.0", version: "1.0.0", env: { STROM_CONFIG_DIR: path.join(dir, "cfg") } }));
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
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(w.root, "install.json"), "utf8")).env, { STROM_CONFIG_DIR: path.join(w.dir, "cfg") }, "what it was installed with stays");
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
  assert.deepEqual(fs.readdirSync(inst).sort(), ["app", "install.json", "node", "strom"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(inst, "install.json"), "utf8")), {
    launchers: [path.join(inst, "strom")],
    node: "24.99.0",
    version: "9.9.9",
    env: { STROM_CONFIG_DIR: cfg, HOME: home, STROM_ISOLATED: "1" },
  });
  assert.deepEqual(fs.readdirSync(home), [], "no PATH line, nothing in its HOME");

  // the person's own: its PATH line, install.json with its settings folder only when set
  const own = run({ STROM_INSTALL_DIR: path.join(dir, "bin"), STROM_PROGRAM_DIR: path.join(dir, "share") });
  assert.equal(own.status, 0, own.stdout + own.stderr);
  assert.match(fs.readFileSync(path.join(home, ".zshrc"), "utf8"), /# strom research/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "share", "install.json"), "utf8")).env, undefined);
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
