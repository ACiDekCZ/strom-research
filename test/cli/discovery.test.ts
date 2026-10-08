// Self-description: an agent with no prior knowledge must be able to learn
// strom from strom itself.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "../helpers.ts";
import { commands } from "../../src/cli/registry.ts";
import "../../src/commands/index.ts";

test("every command is documented: summary, group, help renders", async () => {
  const w = new World();
  for (const def of commands()) {
    assert.ok(def.summary.length > 10, `summary of ${def.path.join(" ")}`);
    assert.match((await w.ok(["help", ...def.path])).out, /^strom/);
    assert.match((await w.ok(["help", ...def.path, "--human"], { tty: true })).out, /^strom/);
  }
  w.cleanup();
});

test("examples only use existing commands and options", async () => {
  const w = new World();
  for (const def of commands())
    for (const ex of def.examples ?? []) {
      const words = ex.replace(/^strom /, "");
      const r = await w.run([...words.split(" ").slice(0, def.path.length), "--help"]);
      assert.equal(r.code, 0, `example: ${ex}`);
    }
  w.cleanup();
});

test("commands --json is a complete machine-readable catalog", async () => {
  const w = new World();
  const cat = (await w.ok(["commands", "--json"])).json;
  const names = cat.commands.map((c: any) => c.command);
  for (const c of ["guide", "setup", "init", "research new", "person add", "person show", "check", "verify", "repair"]) assert.ok(names.includes(c), c);
  const add = cat.commands.find((c: any) => c.command === "person add");
  assert.equal(add.writes, true);
  assert.ok(add.options.some((o: any) => o.name === "--dry-run"));
  assert.ok(add.examples.length > 0);
  w.cleanup();
});

test("guide states the hard rules and the exit codes", async () => {
  const w = new World();
  const g = (await w.ok(["guide"])).out;
  assert.match(g, /Never create, edit, delete or read files under data\//);
  assert.match(g, /4 needs consent/);
  w.cleanup();
});

test("unknown commands and options fail with a hint (exit 2)", async () => {
  const w = new World();
  const r = await w.run(["frobnicate"]);
  assert.equal(r.code, 2);
  assert.match(r.err, /→ strom help/);
  const sub = await w.run(["person", "frobnicate"]);
  assert.equal(sub.code, 2);
  const opt = await w.run(["person", "list", "--colour"]);
  assert.equal(opt.code, 2);
  assert.match(opt.err, /strom help person list/);
  // a group: the agent's catalog of it, whoever asks; a person at a terminal told in a line how to get theirs
  const group = await w.ok(["person"]);
  assert.match(group.out, /person add/);
  assert.doesNotMatch(group.out, /--human/);
  assert.match((await w.ok(["person"], { tty: true })).out, /person add[\s\S]*strom help person --human\n$/);
  assert.match((await w.ok(["help", "person", "--human"], { tty: true })).out, /strom person card/);
  w.cleanup();
});

test("help: the agent's English catalog by default, whoever asks; a person's in the research language with --human", async () => {
  const w = new World();
  // a person's help: the commands a person uses, a sentence each
  const person = (await w.ok(["help", "--human"], { tty: true })).out;
  assert.match(person, /^ {2}strom sync undo +\S/m);
  assert.doesNotMatch(person, /^ {2}strom (person add|session start|brief)\b/m);
  assert.match((await w.ok(["help", "brief", "--human"], { tty: true })).out, /^strom brief: .*strom help brief$/m);
  // the default: the catalog — without a terminal, at one, with a mark of an agent or none; --agent the same
  const catalog = (await w.ok(["help"])).out;
  assert.match(catalog, /\bperson add\b/);
  assert.ok(catalog.length < 8000, `the overview is short: ${catalog.length} characters`);
  assert.doesNotMatch(catalog, /--human/, "nothing for a person where none reads it");
  assert.equal((await w.ok(["help", "--agent"])).out, catalog);
  assert.equal((await w.ok(["help"], { tty: true, env: { CLAUDECODE: "1" } })).out, catalog);
  // a person at a terminal: the same, and one line of their language at its end
  const atTerminal = (await w.ok(["help"], { tty: true })).out;
  assert.ok(atTerminal.startsWith(catalog.trimEnd()), atTerminal);
  assert.match(atTerminal, /Nápověda pro člověka v češtině: strom help --human\n$/);
  assert.match((await w.ok(["sync", "--help"], { tty: true })).out, /Options:[\s\S]*strom help sync --human\n$/);
  assert.doesNotMatch((await w.ok(["sync", "--help"], { tty: true, env: { CLAUDECODE: "1" } })).out, /--human/);
  w.cleanup();
});

test("a person's help ends with where the source code is, in their language; the agent's catalog and --version do not", async () => {
  const w = new World();
  const url = "https://github.com/ACiDekCZ/strom-research";
  for (const [lang, line] of [["en", "Source code (GNU AGPL 3.0 or later)"], ["cs", "Zdrojový kód (GNU AGPL 3.0 nebo pozdější)"], ["de", "Quellcode (GNU AGPL 3.0 oder später)"]] as const) {
    const own = (await w.ok(["help", "--human"], { tty: true, env: { STROM_LANG: lang } })).out;
    assert.ok(own.trimEnd().endsWith(`${line}: ${url}`), `${lang}:\n${own}`);
    assert.equal(own.split(url).length, 2, `${lang}: once`);
  }
  for (const args of [["help"], ["help", "--agent"], ["--version"], ["guide"]]) assert.doesNotMatch((await w.ok(args, { tty: true, env: { STROM_LANG: "en" } })).out, /GNU AGPL|Source code \(/, args.join(" "));
  w.cleanup();
});
