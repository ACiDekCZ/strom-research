// A consent only the person gives, refused or out of reach: an agent reads it whole in English, a person whole in the
// research's language — never a sentence of the person's under the agent's English (found on Windows: strom unpack under
// an agent said "consent required — výzkum rozbaluje jen člověk u počítače … → ask the user…"). strom update said no to
// says nothing was installed and ends not ok.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };
/** Words of the Czech catalog a message for an agent never holds (the test's folders hold "ěš": no letters checked). */
const czech = /výzkum|rozbaluje|člověk|rodokmen|souhlas|spustit|nepovoleno|kdykoli/i;

test("strom unpack and strom trees remove from an agent: the whole error in English; from a person with no terminal: the whole of it in the research's language", opts, async () => {
  const w = new World();
  await w.withTree("Nováčkovi");
  const agent = { CLAUDECODE: "1" };
  const zip = path.join(w.dir, "Novákovi.zip");

  const a = await w.run(["unpack", zip], { env: agent });
  assert.equal(a.code, 4, a.out + a.err);
  assert.match(a.err, /^error: consent required — only the person at the computer unpacks a research \(it adds connectors\)\n/);
  assert.match(a.err, /\n→ ask the user to run in their own terminal: strom unpack ".+Novákovi\.zip"\n$/);
  assert.doesNotMatch(a.err, czech);
  const aj = await w.run(["unpack", zip, "--json"], { env: agent });
  assert.equal(aj.json.status, "needs-consent");
  assert.equal(aj.json.needs[0].question, "only the person at the computer unpacks a research (it adds connectors)", "a program reads the English");

  const p = await w.run(["unpack", zip]);
  assert.equal(p.code, 4, p.out + p.err);
  assert.match(p.err, /^chyba: tady je potřeba souhlas – výzkum rozbaluje jen člověk u počítače \(přidává konektory\)\n→ spustit ve vlastním terminálu: strom unpack .+Novákovi\.zip.\n$/);
  assert.doesNotMatch(p.err, /consent|ask the user|only the person/);

  const r = await w.run(["trees", "remove", "Nováčkovi"], { env: agent });
  assert.equal(r.code, 4, r.out + r.err);
  assert.match(r.err, /^error: consent required — only the person at the computer takes a family tree off it\n→ ask the user to run in their own terminal: strom trees remove ".+Nováčkovi"\n$/);
  assert.doesNotMatch(r.err, czech);
  const q = await w.run(["trees", "remove", "Nováčkovi"]);
  assert.equal(q.code, 4, q.out + q.err);
  assert.match(q.err, /^chyba: tady je potřeba souhlas – rodokmen z počítače odebírá jen člověk u počítače\n→ spustit ve vlastním terminálu: strom trees remove .+Nováčkovi.\n$/);
  assert.doesNotMatch(q.err, /consent|ask the user|only the person/);
  assert.ok(fs.existsSync(w.treeDir("Nováčkovi")), "nothing taken off");
  w.cleanup();
});

test("a consent said no to in the window: an agent reads the English and not to ask again; a person their language, nothing changed and how to ask again", opts, async () => {
  const w = new World();
  await w.withTree();
  const a = await w.run(["config", "set", "agent.permissions", "full"], { dialog: false, env: { CLAUDECODE: "1" } });
  assert.equal(a.code, 1, a.out + a.err);
  assert.match(a.err, /\nerror: not allowed — nothing was changed\n→ the user said no to: .+ — do not ask again unless they want to\n$/);
  assert.doesNotMatch(a.err.split("\n").slice(1).join("\n"), czech, "the window's question above it is the person's; the error is the agent's");
  const p = await w.run(["config", "set", "agent.permissions", "full"], { dialog: false });
  assert.equal(p.code, 1, p.out + p.err);
  assert.match(p.err, /\nchyba: nepovoleno – nic se nezměnilo\n→ kdykoli znovu: strom config set agent\.permissions full\n$/);
  assert.doesNotMatch(p.err, /said no|not allowed/);
  const j = await w.run(["config", "set", "agent.permissions", "full", "--json"], { dialog: false, env: { CLAUDECODE: "1" } });
  assert.deepEqual([j.json.code, j.json.message], ["consent.refused", "not allowed — nothing was changed"]);
  assert.equal((await w.ok(["config", "get", "agent.permissions"])).out.trim(), "auto");
  w.cleanup();
});

test("strom update said no to in the window, or failing to install: nothing installed, said so in the research's language for a person and in English for an agent, and not ok", { skip: !hasGit || process.platform === "win32" }, async () => {
  const { VERSION } = await import("../../src/core/tree.ts");
  const w = new World();
  const tree = await w.withTree();
  // an installation built from the sources, a newer release out
  const root = path.join(w.dir, "inst");
  const app = path.join(root, "app");
  const repo = path.resolve(import.meta.dirname, "..", "..");
  const built = spawnSync(process.execPath, [path.join(repo, "node_modules", "typescript", "bin", "tsc"), "-p", path.join(repo, "tsconfig.build.json"), "--outDir", path.join(app, "dist")], { encoding: "utf8" });
  assert.equal(built.status, 0, built.stdout + built.stderr);
  fs.symlinkSync(path.join(repo, "assets"), path.join(app, "assets"));
  fs.writeFileSync(path.join(app, "package.json"), JSON.stringify({ name: "strom-research", version: VERSION, type: "module" }));
  const install = JSON.stringify({ launchers: [], node: "26.9.0", version: VERSION });
  fs.writeFileSync(path.join(root, "install.json"), install);
  const release = path.join(w.dir, "release");
  fs.mkdirSync(release);
  fs.writeFileSync(path.join(release, "VERSION"), "99.0.0\n");
  fs.writeFileSync(path.join(release, "NODE_VERSION"), "26.9.0\n");
  // the window of the system: a stand-in that says no (macOS osascript, Linux zenity on a desktop)
  const bin = path.join(w.dir, "window");
  fs.mkdirSync(bin);
  for (const tool of ["osascript", "zenity"]) fs.writeFileSync(path.join(bin, tool), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  const env: Record<string, string> = { ...w.env, PATH: [path.join(w.dir, "window"), w.env.PATH].join(path.delimiter), DISPLAY: ":0", STROM_DOWNLOAD_BASE: `file://${release}`, STROM_NODE_BASE: `file://${path.join(w.dir, "no-node")}`, STROM_UPDATES: "check", STROM_ISOLATED: "1" };
  delete env.STROM_NO_DIALOG;
  const run = (args: string[], more: Record<string, string> = {}) =>
    spawnSync(process.execPath, [path.join(app, "dist", "cli.js"), "update", ...args], { cwd: tree, env: { ...env, ...more } as NodeJS.ProcessEnv, encoding: "utf8" });

  // a person (the Strom app, a script — no terminal) says no in the window
  const p = run([]);
  assert.equal(p.status, 1, p.stdout + p.stderr);
  assert.match(p.stderr, /\nchyba: nepovoleno – nic se nezměnilo\n→ kdykoli znovu: strom update\n$/);
  assert.doesNotMatch(p.stderr, /said no|not allowed/);
  // an agent asked it: the person said no in the window
  const a = run(["--channel", "beta"], { CLAUDECODE: "1" });
  assert.equal(a.status, 1, a.stdout + a.stderr);
  assert.match(a.stderr, /\nerror: not allowed — nothing was changed\n→ the user said no to: update strom to 99\.0\.0 \(--channel beta\) — do not ask again unless they want to\n$/);
  assert.equal(fs.readFileSync(path.join(root, "install.json"), "utf8"), install, "nothing installed");

  // a person's --yes, the release without its files: the install fails — said whole in the person's language
  const f = run(["--yes"]);
  assert.equal(f.status, 1, f.stdout + f.stderr);
  assert.match(f.stderr, new RegExp(`^chyba: aktualizace se nepovedla: .+\\. strom zůstává ve verzi ${VERSION.replace(/\./g, "\\.")}\\n→ znovu strom update – nebo spustit instalátor znovu\\n$`, "s"));
  assert.doesNotMatch(f.stderr, /run the installer|did not work/);
  const fj = run(["--yes", "--json"]);
  assert.equal(fj.status, 1);
  assert.equal(JSON.parse(fj.stdout).code, "update.failed", "a program reads the English and the code");
  assert.match(JSON.parse(fj.stdout).message, /^the update did not work: /);
  assert.equal(fs.readFileSync(path.join(root, "install.json"), "utf8"), install, "nothing installed");
  w.cleanup();
});
