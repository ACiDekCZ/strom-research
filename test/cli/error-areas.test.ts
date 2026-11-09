// strom error's areas (spec 070 K1.2, K1.5, K2.2, K3.2, K3.3): a broken research still gives its report, the area
// that could not be read said; nothing in a research is written (no commit, no migration); an archive's report says
// nothing of an agent; under an agent the commands of its own session, and where the problem happened asked of the user.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { World, hasGit, readJsonFile } from "../helpers.ts";
import { zipTexts } from "./error.helpers.ts";

const opts = { skip: !hasGit };
const hasTar = spawnSync("tar", ["--version"]).status === 0;

const report = (file: string) => JSON.parse(zipTexts(file)["report.json"]!);

/** Every file of a folder with its time and size (.git's own aside from what git status says). */
function snapshot(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const st = fs.statSync(p);
        out.set(path.relative(root, p), `${st.mtimeMs} ${st.size}`);
      }
    }
  };
  walk(root);
  return out;
}

/** What of two snapshots differs: the files added, gone or changed. */
function changed(a: Map<string, string>, b: Map<string, string>): string[] {
  const out: string[] = [];
  for (const [k, v] of a) if (b.get(k) !== v) out.push(`${k}: ${v} -> ${b.get(k) ?? "gone"}`);
  for (const k of b.keys()) if (!a.has(k)) out.push(`${k}: added`);
  return out;
}

const gitStatus = (root: string) => spawnSync("git", ["--no-optional-locks", "status", "--porcelain", "--untracked-files=all"], { cwd: root, encoding: "utf8" }).stdout;
const gitCount = (root: string) => spawnSync("git", ["--no-optional-locks", "rev-list", "--count", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();

test("a broken research still gives its report: what cannot be read is said as that area's error (K1.5)", opts, async () => {
  const w = new World();
  fs.mkdirSync(path.join(w.env.HOME!, "Downloads"));
  const root = await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]);
  fs.writeFileSync(path.join(root, "strom.json"), "{ not json");
  fs.rmSync(path.join(root, ".git"), { recursive: true, force: true });
  const r = await w.run(["error", "--yes", "--json"]);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.json.created, true);
  const research = r.json.areas.find((a: { name: string }) => a.name === "research");
  assert.equal(research.ok, false);
  assert.match(research.error, /settings|check/);
  const got = report(r.json.file);
  assert.equal(got.areas.research.partial.git.repository, false, "no git: said, not failed");
  assert.ok(got.areas.research.partial.fingerprint.counts.person >= 1, "what could be read stays");
  for (const name of ["system", "config", "connectors", "commands"]) assert.ok(got.areas[name] && !got.areas[name].error, name);
  // strom doctor cannot open it either: its error said, the report made all the same
  assert.match(got.areas.doctor.error, /strom\.json/);
  // in the person's language: the area and why
  const said = await w.run(["error", "--yes"]);
  assert.match(said.out, /✗ výzkum v číslech: .*nešlo přečíst/);
  w.cleanup();
});

test("nothing in the research is written: its files, their times and git as they were", opts, async () => {
  const w = new World();
  fs.mkdirSync(path.join(w.env.HOME!, "Downloads"));
  const root = await w.withTree("Lhotákovi");
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]);
  await w.ok(["note", "add", "P1", "Poznámka."]);
  // the journal of a failed command there already: kept as it is
  await w.run(["person", "show", "P9999"]);
  // a file touched since git last looked: a git status that may refresh its index would write it
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(path.join(root, "strom.json"), later, later);
  const config = path.join(w.env.STROM_CONFIG_DIR!, "config.json");
  const before = { files: snapshot(root), status: gitStatus(root), commits: gitCount(root), config: fs.readFileSync(config, "utf8") };
  await w.ok(["error", "--yes", "--about", "fetch", "--about", "sync", "--about", "agent", "--about", "install"]);
  await w.ok(["error", "--yes", "--json"], { env: { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "s-9" } });
  assert.deepEqual(changed(before.files, snapshot(root)), []);
  assert.equal(gitStatus(root), before.status);
  assert.equal(gitCount(root), before.commits);
  assert.equal(fs.readFileSync(config, "utf8"), before.config, "the settings neither");
  w.cleanup();
});

test("a research of an older schema is read as it is, never migrated", { skip: !hasGit || !hasTar }, async () => {
  const w = new World();
  const r = spawnSync("tar", ["-xzf", path.join(import.meta.dirname, "..", "fixtures", "releases", "1.0.0.tar.gz"), "-C", w.dir]);
  assert.equal(r.status, 0, String(r.stderr));
  const home = path.join(w.dir, "home");
  Object.assign(w.env, { HOME: home, USERPROFILE: home, STROM_CONFIG_DIR: path.join(w.dir, "config") });
  const file = path.join(w.dir, "config", "config.json");
  fs.writeFileSync(file, JSON.stringify({ ...readJsonFile(file), home: w.home }, null, 2));
  w.cwd = w.treeDir("Novákovi");
  const schema = (readJsonFile(path.join(w.cwd, "strom.json")) as { schema?: number }).schema ?? 1;
  const before = { files: snapshot(w.cwd), status: gitStatus(w.cwd), commits: gitCount(w.cwd) };
  const got = await w.ok(["error", "--yes", "--json"]);
  assert.doesNotMatch(got.err, /převedená/, "nothing brought forward");
  assert.equal((readJsonFile(path.join(w.cwd, "strom.json")) as { schema?: number }).schema ?? 1, schema);
  assert.deepEqual(changed(before.files, snapshot(w.cwd)), []);
  assert.equal(gitStatus(w.cwd), before.status);
  assert.equal(gitCount(w.cwd), before.commits);
  const research = report(got.json.file).areas.research;
  assert.equal(research.settings.schema ?? 1, schema);
  assert.ok(research.fingerprint.counts.person >= 1);
  w.cleanup();
});

test("outside a research: every research known in numbers only (K2.2)", opts, async () => {
  const w = new World();
  fs.mkdirSync(path.join(w.env.HOME!, "Downloads"));
  await w.withTree("Lhotákovi");
  await w.ok(["init", "Lhotští"]);
  w.cwd = w.dir;
  const r = await w.ok(["error", "--yes", "--json"]);
  const got = report(r.json.file);
  assert.equal(got.areas.research.trees.length, 2);
  assert.ok(got.areas.research.trees.every((t: { data: { fingerprint: unknown } }) => t.data.fingerprint));
  assert.equal(got.areas.logs, undefined, "no logs of a research not chosen");
  // --tree: that one
  const one = await w.ok(["error", "--yes", "--json", "--tree", "Lhotští"]);
  assert.ok(report(one.json.file).areas.research.fingerprint);
  w.cleanup();
});

test("an archive's report says nothing of an agent or AI", opts, async () => {
  const w = new World();
  fs.mkdirSync(path.join(w.env.HOME!, "Downloads"));
  await w.ok(["setup", "--yes"]);
  await w.ok(["init", "Archiv", "--mode", "archive"]);
  w.cwd = w.treeDir("Archiv");
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"]);
  await w.run(["person", "show", "P9999"]);
  const AI = /agent|\bAI\b|umělá inteligence|Claude|Codex|OpenCode|Grok|Antigravity|\bmodel/i;
  const r = await w.run(["error", "--yes", "--about", "fetch", "--about", "agent", "--about", "sync"]);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual((r.out + r.err).split("\n").filter((l) => AI.test(l)), []);
  const tty = await w.run(["error"], { tty: true, answers: ["4", "ano"] });
  assert.deepEqual((tty.out + tty.err).split("\n").filter((l) => AI.test(l)), [], tty.out);
  assert.doesNotMatch(tty.out, /v rozhovoru s agentem/);
  const downloads = path.join(w.env.HOME!, "Downloads");
  for (const f of fs.readdirSync(downloads)) {
    for (const [name, text] of Object.entries(zipTexts(path.join(downloads, f)))) {
      const bad = text.split("\n").filter((l) => AI.test(l));
      assert.deepEqual(bad, [], `${f} ${name}: ${bad.join(" | ")}`);
    }
  }
  w.cleanup();
});

test("under an agent: the commands of its own session (K3.3), and where the problem happened asked of the user (K3.2)", opts, async () => {
  const w = new World();
  fs.mkdirSync(path.join(w.env.HOME!, "Downloads"));
  await w.withTree("Lhotákovi");
  const agent = { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "s-1234" };
  await w.ok(["person", "list"], { env: { CLAUDECODE: "1", CLAUDE_CODE_SESSION_ID: "s-other" } });
  await w.ok(["person", "add", "Vojtěch /Lhoták/", "--sex", "M"], { env: agent });
  await w.run(["person", "show", "P9999"], { env: agent });
  await w.ok(["person", "list", "--limit", "3"], { env: agent });
  const r = await w.ok(["error", "--yes", "--json"], { env: agent });
  assert.equal(r.json.where, "unknown");
  assert.match(r.json.next, /^Ask the user where the problem happened/);
  assert.match(r.json.next, /--where chat\|terminal\|app/);
  const got = report(r.json.file);
  const mine = got.areas.commands.thisSession as { cmd: string; args: string[]; exit: number; session: string }[];
  assert.deepEqual(mine.map((c) => c.cmd), ["person add", "person show", "person list"]);
  assert.ok(mine.every((c) => c.session === "s-1234"));
  assert.notEqual(mine[1]!.exit, 0);
  assert.deepEqual(mine[1]!.args, ["P9999"]);
  assert.match(mine[0]!.args[0]!, /^‹[0-9a-f]{5}›$/, "a name in it masked");
  assert.equal(got.areas.system.launched.by, "agent");
  assert.equal(got.areas.system.launched.agent, "claude");
  // the user's answer passed on: said as it is, the agent's next step only to tell the user where the file is
  const told = await w.ok(["error", "--yes", "--json", "--where", "chat", "--note", "the download stopped"], { env: agent });
  assert.equal(told.json.where, "chat");
  assert.match(told.json.next, /^Tell the user the path of the file/);
  assert.equal(report(told.json.file).note, "the download stopped");
  // a wrong one refused, what it takes said
  const wrong = await w.run(["error", "--yes", "--where", "phone"], { env: agent });
  assert.equal(wrong.code, 2);
  assert.match(wrong.err, /--where takes chat, terminal, app, unknown, not phone/);
  const about = await w.run(["error", "--yes", "--about", "gedcom"], { env: agent });
  assert.equal(about.code, 2);
  assert.match(about.err, /--about takes fetch, sync, agent, install, windows/);
  w.cleanup();
});

test("--since: the logs of that time only; a date or 2d, 1w, 12h", opts, async () => {
  const w = new World();
  fs.mkdirSync(path.join(w.env.HOME!, "Downloads"));
  const root = await w.withTree("Lhotákovi");
  const old = new Date(Date.now() - 5 * 86400_000).toISOString();
  const recent = new Date(Date.now() - 3600_000).toISOString();
  fs.appendFileSync(path.join(root, ".strom", "live.log"), `${old} [1] started on port 4711\n${recent} [2] started on port 4712\n`);
  const all = report((await w.ok(["error", "--yes", "--json"])).json.file);
  assert.equal(all.areas.logs["live.log"].length, 2);
  const two = report((await w.ok(["error", "--yes", "--json", "--since", "2d"])).json.file);
  assert.deepEqual(two.areas.logs["live.log"].map((l: string) => /port (\d+)/.exec(l)?.[1]), ["4712"]);
  const bad = await w.run(["error", "--yes", "--since", "soon"]);
  assert.equal(bad.code, 2);
  w.cleanup();
});
