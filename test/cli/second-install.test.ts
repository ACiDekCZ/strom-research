// A second strom beside the person's own (STROM_ISOLATED=1 with STROM_COMMAND=strom-<suffix>): its own command
// beside `strom`, its own folder of researches, its own links (strom-research-<suffix>://), its own bridge — and its
// uninstall takes only what is its own.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { nodeArchive } from "../../src/core/update.ts";
import { uninstallPlan } from "../../src/core/uninstall.ts";
import { configDir, defaultHome, noLinks, ownCommand } from "../../src/core/paths.ts";
import { LINK_SCHEME, LINUX_ENTRY, linkHandlerState, linkScheme, linkText, linuxEntryName, macApp, parseLink, registerLinks, unregisterLinks, LinkError, type Sys } from "../../src/core/links.ts";
import { exportGedcom } from "../../src/gedcom/export.ts";
import { validateGedcom } from "../../src/gedcom/validate.ts";
import { Tree } from "../../src/core/tree.ts";
import { asCommand } from "../../src/cli/format.ts";
import { ui } from "../../src/cli/ui.ts";
import { sayCommandAs } from "../../src/core/phrases.ts";

const unix = { skip: process.platform === "win32" };
const ID = "0f8c2d4e-1b2a-4c3d-9e8f-7a6b5c4d3e2f";

/** A release and a Node in nodejs.org's layout, both local; the Node says its version, else what it was given. */
function release(dir: string): Record<string, string> {
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
  fs.writeFileSync(path.join(stage, top, "bin", "node"), '#!/bin/sh\ncase "$1" in --version) echo v24.99.0 ;; *) echo "NODE RAN $*" ;; esac\n', { mode: 0o755 });
  const nodes = path.join(dir, "nodes", "v24.99.0");
  fs.mkdirSync(nodes, { recursive: true });
  spawnSync("tar", ["-czf", path.join(nodes, name), top], { cwd: stage });
  fs.writeFileSync(path.join(nodes, "SHASUMS256.txt"), `${sum(path.join(nodes, name))}  ${name}\n`);
  return { STROM_DOWNLOAD_BASE: `file://${rel}`, STROM_NODE_BASE: `file://${path.join(dir, "nodes")}` };
}

test("the installer with STROM_COMMAND: its own command beside strom in ~/.local/bin, install.json says it; refused without isolation, with a bad name, or over a file it did not write", unix, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-second-"));
  const home = path.join(dir, "home");
  fs.mkdirSync(home);
  const script = path.join(import.meta.dirname, "..", "..", "install", "install.sh");
  const base = { ...release(dir), HOME: home, PATH: "/usr/bin:/bin:/usr/sbin:/sbin", SHELL: "/bin/zsh", LANG: "en_US.UTF-8", STROM_INSTALL_ONLY: "1" };
  const run = (env: Record<string, string>) => spawnSync("sh", [script], { env: { ...base, ...env }, encoding: "utf8" });
  const bin = path.join(home, ".local", "bin");
  const inst = path.join(dir, "zkouška beta");
  const cfg = path.join(dir, "cfg");
  const isolated = { STROM_ISOLATED: "1", STROM_INSTALL_DIR: inst, STROM_CONFIG_DIR: cfg };

  // not isolated: the person's own strom has no second command
  const plain = run({ STROM_COMMAND: "strom-beta", STROM_INSTALL_DIR: path.join(dir, "plain") });
  assert.equal(plain.status, 1, plain.stdout);
  assert.match(plain.stdout, /STROM_COMMAND is for an isolated installation only/);
  // a name that is not strom-<a–z, 0–9>{1,20}
  for (const name of ["strom", "strom-", "beta", "strom-Beta", "strom-be ta", "strom-běta", "strom-a/b", `strom-${"a".repeat(21)}`, "strom-beta\nstrom-x", "xstrom-beta"]) {
    const r = run({ ...isolated, STROM_COMMAND: name });
    assert.equal(r.status, 1, `${JSON.stringify(name)}: ${r.stdout}`);
    assert.match(r.stdout, /STROM_COMMAND is strom-<lowercase letters and digits, at most 20>/, name);
  }
  assert.ok(!fs.existsSync(inst) && !fs.existsSync(bin), "nothing installed, nothing written");
  // the person's own file of that name: never overwritten
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "strom-beta"), "#!/bin/sh\necho mine\n", { mode: 0o755 });
  const foreign = run({ ...isolated, STROM_COMMAND: "strom-beta" });
  assert.equal(foreign.status, 1, foreign.stdout);
  assert.match(foreign.stdout, /The command is there already, written by another installation — nothing is overwritten/);
  assert.equal(fs.readFileSync(path.join(bin, "strom-beta"), "utf8"), "#!/bin/sh\necho mine\n");
  assert.ok(!fs.existsSync(inst));
  fs.rmSync(path.join(bin, "strom-beta"));

  // installed: its command beside strom, started by its whole path while that folder is not on PATH
  const r = run({ ...isolated, STROM_COMMAND: "strom-beta" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const launcher = path.join(bin, "strom-beta");
  assert.match(r.stdout, new RegExp(`A second installation beside the regular strom: .* Start it with the command: ${launcher.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(inst, "install.json"), "utf8")), {
    launchers: [path.join(inst, "strom"), launcher],
    node: "24.99.0",
    version: "9.9.9",
    command: "strom-beta",
    env: { STROM_CONFIG_DIR: cfg, HOME: home, STROM_ISOLATED: "1", STROM_COMMAND: "strom-beta" },
  });
  // it starts this installation's Node with its code
  const started = spawnSync(launcher, ["--help"], { encoding: "utf8" });
  assert.match(started.stdout, new RegExp(`NODE RAN ${path.join(inst, "app", "dist", "cli.js").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} --help`));
  assert.deepEqual(fs.readdirSync(home), [".local"], "no PATH line, nothing else in its HOME");
  assert.deepEqual(fs.readdirSync(bin), ["strom-beta"], "the person's strom not touched");
  // installed again over itself: its own launcher is taken again; on PATH, said by its name
  const again = run({ ...isolated, STROM_COMMAND: "strom-beta", PATH: `${bin}:/usr/bin:/bin` });
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.match(again.stdout, /Start it with the command: strom-beta\s*$/);
  // another installation with the same command: that launcher is not its own
  const other = run({ STROM_ISOLATED: "1", STROM_INSTALL_DIR: path.join(dir, "other"), STROM_CONFIG_DIR: path.join(dir, "cfg2"), STROM_COMMAND: "strom-beta" });
  assert.equal(other.status, 1, other.stdout);
  assert.match(other.stdout, /written by another installation/);
  // Czech too
  const cs = run({ LANG: "cs_CZ.UTF-8", STROM_COMMAND: "strom-beta" });
  assert.match(cs.stdout, /STROM_COMMAND je jen pro izolovanou instalaci/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("the Windows installer takes STROM_COMMAND the same way: only isolated, the name checked to its end, nothing of that name from elsewhere, its bin on the user's PATH, install.json says it", () => {
  const ps1 = fs.readFileSync(path.join(import.meta.dirname, "..", "..", "install", "install.ps1"), "utf8");
  const code = ps1.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  assert.match(code, /\$command = if \(\$env:STROM_COMMAND\)/);
  assert.match(code, /if \(-not \$isolated\) \{ throw \(T 'STROM_COMMAND is for an isolated installation only/);
  assert.match(code, /-cnotmatch '\^strom-\[a-z0-9\]\{1,20\}\\z'/, "a line break at the end is no name");
  assert.match(code, /Get-Command \$command -All/);
  assert.match(code, /Join-Path \$bin "\$command\.cmd"/);
  assert.match(code, /%~dp0\.\.\\node\\node\.exe/);
  assert.match(code, /\$info\.command = \$command/);
  assert.match(code, /\$own\.STROM_COMMAND = \$command/);
  assert.match(code, /SetEnvironmentVariable\('Path', \(\(@\(\$parts\) \+ @\(\$bin\)\) -join ';'\), 'User'\)/, "after the person's own entries");
  // the refusals come before anything is downloaded
  assert.ok(code.indexOf("Get-Command $command") < code.indexOf("Get-File \"$base/NODE_VERSION\""));
});

test("the second installation's command, scheme and folder: only an isolated installation with a good name has them; its research never in the person's Documents/Strom", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strom-second-"));
  const person = { HOME: path.join(dir, "home"), STROM_CONFIG_DIR: path.join(dir, "cfg") };
  const beta = { ...person, STROM_CONFIG_DIR: path.join(dir, "cfg-beta"), STROM_ISOLATED: "1", STROM_COMMAND: "strom-beta" };
  const isolated = { ...person, STROM_CONFIG_DIR: path.join(dir, "cfg-iso"), STROM_ISOLATED: "1" };
  assert.equal(ownCommand(beta), "strom-beta");
  assert.equal(ownCommand({ ...person, STROM_COMMAND: "strom-beta" }), undefined, "not isolated: none");
  assert.equal(ownCommand({ ...beta, STROM_COMMAND: "strom-Beta" }), undefined);
  assert.equal(ownCommand({ ...beta, STROM_COMMAND: "strom-beta\n" }), undefined);
  assert.equal(linkScheme(person), LINK_SCHEME);
  assert.equal(linkScheme(isolated), LINK_SCHEME);
  assert.equal(linkScheme(beta), "strom-research-beta");
  assert.deepEqual([noLinks(person), noLinks(isolated), noLinks(beta)], [false, true, false]);
  for (const platform of ["darwin", "linux", "win32"] as const) {
    const own = defaultHome(person, platform);
    assert.equal(own, path.join(person.HOME, "Documents", "Strom"));
    assert.equal(defaultHome(beta, platform), path.join(person.HOME, "Documents", "Strom beta"));
    // without a command: inside its own settings folder — never the program's, which strom uninstall takes away
    assert.equal(defaultHome(isolated, platform), path.join(configDir(isolated, platform), "Strom research"));
    // never the name of its launcher `strom` beside it, whatever the case (macOS, Windows: one name; setup failed)
    assert.notEqual(path.basename(defaultHome(isolated, platform)).toLowerCase(), "strom");
    assert.equal(new Set([own, defaultHome(beta, platform), defaultHome(isolated, platform)]).size, 3);
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test("links of a second installation: strom-research-beta:// parsed and written again with its scheme, never the other's", () => {
  assert.deepEqual(parseLink(`strom-research-beta://open?tree=${ID}`, "strom-research-beta"), { action: "open", tree: ID });
  assert.deepEqual(parseLink(`strom-research-beta://review?tree=${ID}&person=p12`, "strom-research-beta"), { action: "review", tree: ID, person: "P12", scope: "person" });
  assert.throws(() => parseLink(`strom-research-beta://open?tree=${ID}`), (e: unknown) => e instanceof LinkError && /not a strom-research link/.test((e as Error).message));
  assert.throws(() => parseLink(`strom-research://open?tree=${ID}`, "strom-research-beta"), (e: unknown) => e instanceof LinkError && /not a strom-research-beta link/.test((e as Error).message));
  const link = parseLink(`strom-research-beta://chat?tree=${ID}&person=P1`, "strom-research-beta") as Exclude<ReturnType<typeof parseLink>, { action: "menu" }>;
  assert.equal(linkText(link, "strom-research-beta"), `strom-research-beta://chat?tree=${ID}&person=P1`);
  assert.equal(linkText(link), `strom-research://chat?tree=${ID}&person=P1`);
});

test("a second installation registers its own scheme — macOS, Windows, Linux (here faked) — and takes off only that; the person's strom-research stays", () => {
  const w = new World();
  const person = { ...w.env, XDG_DATA_HOME: path.join(w.dir, "data"), XDG_CONFIG_HOME: path.join(w.dir, "cfg") };
  const env = { ...person, STROM_CONFIG_DIR: path.join(w.dir, "config-beta"), STROM_ISOLATED: "1", STROM_COMMAND: "strom-beta" };
  // the system: what is registered, and each call asked of it
  const reg = new Map<string, string>();
  const xdg = new Map<string, string>();
  const mac = new Map<string, string>();
  const calls: string[] = [];
  const run: Sys = (cmd, args) => {
    calls.push(`${cmd} ${args.join(" ")}`);
    if (cmd === "reg.exe") {
      const [op, key] = args;
      if (op === "add") reg.set(`${key}|${args.includes("/ve") ? "" : args[args.indexOf("/v") + 1]}`, args[args.indexOf("/d") + 1]!);
      if (op === "query") {
        const v = reg.get(`${key}|`);
        return v === undefined ? { status: 1, stdout: "" } : { status: 0, stdout: `\r\n${key}\r\n    (Default)    REG_SZ    ${v}\r\n` };
      }
      if (op === "delete") for (const k of [...reg.keys()]) if (k.startsWith(`${key}\\`) || k.startsWith(`${key}|`)) reg.delete(k);
      return { status: 0, stdout: "" };
    }
    if (cmd === "xdg-mime" && args[0] === "default") return xdg.set(args[2]!, args[1]!), { status: 0, stdout: "" };
    if (cmd === "xdg-mime" && args[0] === "query") return { status: 0, stdout: `${xdg.get(args[2]!) ?? ""}\n` };
    if (cmd === "osacompile") {
      const app = args[args.indexOf("-o") + 1]!;
      fs.mkdirSync(path.join(app, "Contents", "Resources"), { recursive: true });
      return { status: 0, stdout: "" };
    }
    // the applet's schemes: the system opens them with it
    if (cmd === "plutil" && args[1] === "CFBundleURLTypes") {
      const schemes = (JSON.parse(args[3]!) as { CFBundleURLSchemes: string[] }[])[0]!.CFBundleURLSchemes;
      for (const s of schemes) mac.set(s, path.dirname(path.dirname(args[4]!)));
    }
    if (cmd === "osascript") return { status: 0, stdout: `${mac.get(/URLWithString\("([^:]+):/.exec(args[3]!)?.[1] ?? "") ?? ""}\n` };
    return { status: 0, stdout: "" };
  };

  // Linux: its own entry, the default for its own scheme
  assert.equal(registerLinks(env, "linux", run), true);
  assert.equal(linuxEntryName(env), "strom-research-beta-link.desktop");
  const entry = path.join(person.XDG_DATA_HOME, "applications", "strom-research-beta-link.desktop");
  assert.match(fs.readFileSync(entry, "utf8"), /^MimeType=x-scheme-handler\/strom-research-beta;$/m);
  assert.match(fs.readFileSync(entry, "utf8"), /^Name=Strom Research \(beta\)$/m);
  assert.deepEqual([...xdg.entries()], [["x-scheme-handler/strom-research-beta", "strom-research-beta-link.desktop"]]);
  assert.equal(linkHandlerState(env, "linux", run), "ours");
  assert.equal(linkHandlerState(person, "linux", run), "none", "the person's scheme not touched");
  // the person's own strom's links there too: the second installation's uninstall takes only its own
  fs.writeFileSync(path.join(person.XDG_DATA_HOME, "applications", LINUX_ENTRY), "[Desktop Entry]\nExec=/jinde/node /jinde/cli.js link open %u\n");
  fs.mkdirSync(person.XDG_CONFIG_HOME, { recursive: true });
  fs.writeFileSync(path.join(person.XDG_CONFIG_HOME, "mimeapps.list"), `[Default Applications]\nx-scheme-handler/strom-research=${LINUX_ENTRY}\nx-scheme-handler/strom-research-beta=strom-research-beta-link.desktop\n`);
  const root = path.join(w.dir, "beta-program");
  const launcher = path.join(w.env.HOME!, ".local", "bin", "strom-beta");
  fs.mkdirSync(path.join(root, "app"), { recursive: true });
  fs.mkdirSync(path.dirname(launcher), { recursive: true });
  fs.writeFileSync(launcher, "#!/bin/sh\n");
  fs.writeFileSync(path.join(w.env.HOME!, ".local", "bin", "strom"), "#!/bin/sh\n");
  const plan = uninstallPlan(env, ["Strom research"], { platform: "linux", install: { kind: "installed", root, launchers: [path.join(root, "strom"), launcher] } });
  assert.deepEqual(plan.remove.map((r) => [r.kind, r.path]), [["links", entry], ["program", root]]);
  for (const r of plan.remove) assert.ok(r.remove());
  assert.ok(!fs.existsSync(entry) && !fs.existsSync(root) && !fs.existsSync(launcher));
  assert.ok(fs.existsSync(path.join(person.XDG_DATA_HOME, "applications", LINUX_ENTRY)), "the person's entry stays");
  assert.ok(fs.existsSync(path.join(w.env.HOME!, ".local", "bin", "strom")), "the person's strom stays");
  assert.equal(fs.readFileSync(path.join(person.XDG_CONFIG_HOME, "mimeapps.list"), "utf8"), `[Default Applications]\nx-scheme-handler/strom-research=${LINUX_ENTRY}\n`);
  // the person's uninstall: the second installation's scheme is none of its business
  assert.equal(registerLinks(env, "linux", run), true);
  assert.ok(!uninstallPlan(person, [], { platform: "linux", install: { kind: "npm" } }).remove.some((r) => r.path === entry));

  // Windows: its own key under HKCU, never the person's
  assert.equal(registerLinks(env, "win32", run), true);
  const keys = [...reg.keys()];
  assert.ok(keys.length && keys.every((k) => k.startsWith("HKCU\\Software\\Classes\\strom-research-beta")), keys.join("; "));
  assert.equal(reg.get("HKCU\\Software\\Classes\\strom-research-beta|"), "URL:Strom Research (beta)");
  assert.equal(linkHandlerState(env, "win32", run), "ours");
  assert.equal(linkHandlerState(person, "win32", run), "none");
  reg.set("HKCU\\Software\\Classes\\strom-research\\shell\\open\\command|", `"C:\\Jinde\\node.exe" "C:\\Jinde\\cli.js" link open "%1"`);
  assert.equal(unregisterLinks(env, "win32", run), true);
  assert.deepEqual([...reg.keys()], ["HKCU\\Software\\Classes\\strom-research\\shell\\open\\command|"], "only its own key went");

  // macOS: an applet of its own name, its own scheme and bundle
  calls.length = 0;
  assert.equal(path.basename(macApp(env)), "Strom Research (beta).app");
  assert.equal(path.basename(macApp(person)), "Strom Research.app");
  assert.equal(registerLinks(env, "darwin", run), true);
  assert.ok(calls.some((c) => c === `plutil -replace CFBundleIdentifier -string info.stromapp.research.link.beta ${path.join(macApp(env), "Contents", "Info.plist")}`), calls.join("\n"));
  assert.ok(calls.some((c) => c.includes('"CFBundleURLSchemes":["strom-research-beta"]')), calls.join("\n"));
  assert.ok(!calls.some((c) => c.includes('["strom-research"]')));
  assert.equal(linkHandlerState(env, "darwin", run), "ours");
  assert.equal(linkHandlerState(person, "darwin", run), "none");
  assert.equal(unregisterLinks(env, "darwin", run), true);
  assert.ok(!fs.existsSync(macApp(env)));
  w.cleanup();
});

test("two installations, two researches, two bridges at once: each its settings, folder and port — the second says its scheme to the app", { skip: !hasGit || process.platform === "win32" }, async () => {
  const a = new World();
  await a.withTree("Novákovi");
  // the second installation: the same person (HOME), its own settings
  const b = new World();
  Object.assign(b.env, { HOME: a.env.HOME, USERPROFILE: a.env.USERPROFILE, STROM_ISOLATED: "1", STROM_COMMAND: "strom-beta" });
  await b.ok(["setup", "--yes"]);
  const home = path.join(a.env.HOME!, "Documents", "Strom beta");
  assert.equal(readJsonFile(path.join(b.env.STROM_CONFIG_DIR!, "config.json")).home, home, "its own folder of researches");
  assert.equal(readJsonFile(path.join(a.env.STROM_CONFIG_DIR!, "config.json")).home, path.join(a.env.HOME!, "Documents", "Strom"));
  await b.ok(["init", "Svobodovi"]);
  b.cwd = path.join(home, "Svobodovi");
  assert.ok(fs.existsSync(path.join(b.cwd, "strom.json")));
  assert.ok(!fs.existsSync(path.join(a.env.HOME!, "Documents", "Strom", "Svobodovi")));
  // doctor says what it is
  const doc = (await b.run(["doctor", "--json"])).json.checks as { name: string; detail: string }[];
  assert.match(doc.find((c) => c.name === "program")!.detail, /druhá instalace: příkaz strom-beta, ve složce .*, její odkazy strom-research-beta:\/\//);
  assert.equal((await b.ok(["link", "status", "--json"])).json.scheme, "strom-research-beta");
  assert.equal((await a.ok(["link", "status", "--json"])).json.scheme, "strom-research");

  const ia = (await a.ok(["live", "start", "--json"])).json;
  const ib = (await b.ok(["live", "start", "--json"])).json;
  try {
    assert.notEqual(new URL(ia.url).port, new URL(ib.url).port);
    const sa = (await (await fetch(`${ia.url}/status`)).json()) as Record<string, any>;
    const sb = (await (await fetch(`${ib.url}/status`)).json()) as Record<string, any>;
    assert.equal(sa.tree.name, "Novákovi");
    assert.equal(sb.tree.name, "Svobodovi");
    assert.equal(sb.path, b.cwd);
    assert.equal("linkScheme" in sa, false, "the person's strom: the scheme the app knows");
    assert.equal(sb.linkScheme, "strom-research-beta");
    assert.ok(Array.isArray(sb.links));
  } finally {
    await a.ok(["live", "stop"]);
    await b.ok(["live", "stop"]);
  }
  // the GEDCOM it serves an app that opens links: the scheme under the links (only there)
  const ged = exportGedcom(Tree.open(b.cwd, b.env), { for: "strom", links: ["send", "open"], linkScheme: "strom-research-beta" }).text;
  assert.match(ged, /\n1 _STROM_LINKS send open\r?\n2 _SCHEME strom-research-beta\r?\n/);
  assert.deepEqual(validateGedcom(ged).filter((f) => f.level === "error"), []);
  assert.doesNotMatch(exportGedcom(Tree.open(b.cwd, b.env), { for: "strom" }).text, /_SCHEME/);
  a.cleanup();
  b.cleanup();
});

test("an isolated installation in the person's own folder of researches: doctor says so", { skip: !hasGit }, async () => {
  const w = new World();
  w.env.STROM_ISOLATED = "1";
  await w.ok(["setup", "--yes", "--home", path.join(w.env.HOME!, "Documents", "Strom")]);
  const home = (await w.run(["doctor", "--json"])).json.checks.find((c: { name: string }) => c.name === "home");
  assert.equal(home.status, "warn");
  assert.match(home.detail, /je to i složka běžného stromu: dvě instalace nad jedním výzkumem/);
  w.cleanup();
});

test("a second installation names its own command in every hint — doctor, link status, errors, orientation, help, JSON — never strom (found on Windows: strom-beta doctor said strom doctor --fix); a sentence's strom stays", async () => {
  const w = new World();
  const env = { STROM_CONFIG_DIR: path.join(w.dir, "config-beta"), STROM_ISOLATED: "1", STROM_COMMAND: "strom-beta", STROM_LANG: "cs" };
  await w.ok(["setup", "--yes"], { env });
  const status = await w.run(["link", "status"], { env });
  assert.match(status.out, /→ strom-beta link on/);
  assert.doesNotMatch(status.out, /(^|\s)strom link/m);
  const doctor = await w.run(["doctor"], { env });
  assert.match(doctor.out, /strom-beta doctor --fix/);
  assert.doesNotMatch(doctor.out, /(^|\s)strom (doctor|link|config) /m, doctor.out);
  const none = await w.run(["person", "list", "--json"], { env });
  assert.match(none.json.hint, /strom-beta init/);
  const err = await w.run(["person", "list"], { env });
  assert.match(err.err, /strom-beta init/);
  assert.match((await w.run([], { env })).out, /strom-beta init/);
  assert.match((await w.run(["help"], { env })).out, /^strom-beta <command>/);
  // the person's own strom: as it was
  assert.match((await w.run(["link", "status"])).out, /→ strom link on/);
  assert.equal(asCommand("Tento strom ho nechává beze změny: strom update", "strom-beta", ["update", "doctor"]), "Tento strom ho nechává beze změny: strom-beta update");
  assert.equal(asCommand("~/strom doctor/x, strom doctoring, `strom doctor`", "strom-beta", ["doctor"]), "~/strom doctor/x, strom doctoring, `strom-beta doctor`");
  w.cleanup?.();
});

test("a second installation's errors of the command line name its own command — an unknown command (any language, JSON too, after a global option), an unknown subcommand in Czech and German quotes, an unknown option of strom itself (strom-beta nonexistent-cmd said „strom nonexistent-cmd“)", async () => {
  const w = new World();
  const env = { STROM_CONFIG_DIR: path.join(w.dir, "config-beta"), STROM_ISOLATED: "1", STROM_COMMAND: "strom-beta" };
  for (const [lang, said] of [["en", /unknown command "strom-beta nonexistent-cmd"/], ["cs", /neznámý příkaz „strom-beta nonexistent-cmd“/], ["de", /unbekannter Befehl „strom-beta nonexistent-cmd“/]] as const) {
    const r = await w.run(["nonexistent-cmd"], { env: { ...env, STROM_LANG: lang } });
    assert.notEqual(r.code, 0);
    assert.match(r.err, said, r.err);
    assert.doesNotMatch(r.err, /(^|[\s"„])strom /m, r.err);
  }
  const json = await w.run(["nonexistent-cmd", "--json"], { env });
  assert.match(json.json.message, /"strom-beta nonexistent-cmd"/);
  assert.match((await w.run(["--lang", "cs", "nonexistent-cmd"], { env })).err, /strom-beta nonexistent-cmd/);
  assert.match((await w.run(["person", "xyz"], { env: { ...env, STROM_LANG: "cs" } })).err, /„strom-beta person xyz“/);
  assert.match((await w.run(["person", "xyz"], { env: { ...env, STROM_LANG: "de" } })).err, /„strom-beta person xyz“/);
  assert.match((await w.run(["--bogus"], { env: { ...env, STROM_LANG: "en" } })).err, /unknown option --bogus for strom-beta\b/);
  assert.match((await w.run(["--bogus"], { env: { ...env, STROM_LANG: "cs" } })).err, /neznámá volba --bogus u strom-beta\n→ strom-beta help\n/);
  assert.match((await w.run(["person", "add", "--bogus"], { env })).err, /strom-beta person add/);
  assert.match((await w.run(["person", "add"], { env })).err, /strom-beta help person add/);
  // the person's own strom: as it was
  assert.match((await w.run(["nonexistent-cmd"])).err, /"strom nonexistent-cmd"|„strom nonexistent-cmd“/);
  // a sentence's strom stays, quoted or not
  assert.equal(asCommand("„strom je velký“ – strom-beta? „strom doctor“", "strom-beta", ["doctor"]), "„strom je velký“ – strom-beta? „strom-beta doctor“");
  w.cleanup?.();
});

test("D3b: a second installation names its own command after unpack, at the menu's goodbye and where a text names the program alone — „Dál: strom-beta (nabídka) nebo strom-beta chat.“; a command at the end of a sentence too, never a file", { skip: !hasGit }, async () => {
  const w = new World();
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Novákovi"]);
  w.cwd = w.treeDir("Novákovi");
  await w.ok(["person", "add", "Jan /Novák/", "--born", "1805"]);
  const zip = path.join(w.dir, "balík.zip");
  await w.ok(["pack", "--out", zip]);
  const env = { STROM_CONFIG_DIR: path.join(w.dir, "config-beta"), STROM_ISOLATED: "1", STROM_COMMAND: "strom-beta", STROM_LANG: "cs", STROM_HOME: path.join(w.dir, "beta-home") };
  await w.ok(["setup", "--yes"], { env, cwd: w.dir });
  const u = await w.ok(["unpack", zip], { env, cwd: w.dir, answers: ["a"] });
  assert.match(u.out, /Dál: strom-beta \(nabídka\) nebo strom-beta chat\./, u.out);
  assert.doesNotMatch(u.out, /(^|[\s:„(])strom (\(|chat|unpack)/m, u.out);
  const bye = await w.ok([], { env, cwd: w.dir, tty: true, answers: ["0"] });
  assert.match(bye.out, /Příště stačí spustit: strom-beta\n/);
  // the person's own strom: as it was
  assert.match((await w.ok([], { cwd: w.dir, tty: true, answers: ["0"], env: { STROM_LANG: "cs" } })).out, /Příště stačí spustit: strom\n/);
  // a command at the end of a sentence; a file named so stays
  assert.equal(asCommand("Dál: strom chat. Kdykoli strom unpack.", "strom-beta", ["chat", "unpack"]), "Dál: strom-beta chat. Kdykoli strom-beta unpack.");
  assert.equal(asCommand("strom chat.txt, strom unpack.zip", "strom-beta", ["chat", "unpack"]), "strom chat.txt, strom unpack.zip");
  // {strom} — the program alone — in what no output passes (a window of the system, a file: the backup's README)
  sayCommandAs("strom-beta");
  try {
    assert.match(ui("en", "ui.backup.readme", { from: "1", to: "2", date: "x" }), /then run strom-beta: strom checks it \(strom-beta check\)\./);
    assert.equal(ui("cs", "ui.link.noterminal.new"), "strom nemohl otevřít okno terminálu. Spustit strom-beta a pak to zkusit z aplikace Strom znovu.");
  } finally {
    sayCommandAs("strom");
  }
  assert.equal(ui("en", "ui.menu.bye"), "Until next time. Start again with: strom");
  w.cleanup?.();
});

test("D3b-a: a person's help in any language begins with the installation's own command — „strom-beta <příkaz>“, „strom-beta <Befehl>“ (found: cs and de said strom), a group's too; the person's own strom as it was", async () => {
  const w = new World();
  const beta = { STROM_CONFIG_DIR: path.join(w.dir, "config-beta"), STROM_ISOLATED: "1", STROM_COMMAND: "strom-beta" };
  await w.ok(["setup", "--yes"], { env: beta });
  await w.ok(["setup", "--yes"]);
  for (const [lang, word] of [["en", "<command>"], ["cs", "<příkaz>"], ["de", "<Befehl>"]] as const) {
    const own = (await w.ok(["help", "--human"], { env: { ...beta, STROM_LANG: lang } })).out;
    assert.ok(own.startsWith(`strom-beta ${word} `), `${lang}: ${own.split("\n")[0]}`);
    assert.doesNotMatch(own, /^ *strom |(^|\s)strom </mu, `${lang}: never strom as the command`);
    assert.match(own, /: https:\/\/github\.com\/ACiDekCZ\/strom-research\n?$/, `${lang}: the source code's address as it is`);
    assert.ok((await w.ok(["help", "research", "--human"], { env: { ...beta, STROM_LANG: lang } })).out.startsWith(`strom-beta research ${word}`), lang);
    const plain = (await w.ok(["help", "--human"], { env: { STROM_LANG: lang } })).out;
    assert.ok(plain.startsWith(`strom ${word} `), `${lang}: ${plain.split("\n")[0]}`);
    assert.doesNotMatch(plain, /strom-beta/);
  }
  w.cleanup?.();
});
