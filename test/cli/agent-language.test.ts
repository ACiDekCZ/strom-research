// What an agent reads stays English in a Czech or German research — the person's language never in place of an agent's
// instructions (Milan, 2026-10-04): an agent known by its marks (Claude Code, Codex), one strom does not know (no
// terminal, no marks) and one at a terminal of its own get the guide, the help, the help of a command and the catalog in
// English, the listings an agent reads as they were; only a person at a terminal reads them in their language. The
// orientation is the research's language but names the guide for a new agent.

import { test } from "node:test";
import assert from "node:assert/strict";
import { World, hasGit } from "../helpers.ts";

const opts = { skip: !hasGit };

const AGENTS: { who: string; env: Record<string, string>; tty: boolean; like?: "person" }[] = [
  { who: "an agent strom does not know (no terminal, no marks)", env: {}, tty: false },
  { who: "Claude Code", env: { CLAUDECODE: "1" }, tty: false },
  { who: "Codex", env: { CODEX_SANDBOX: "seatbelt" }, tty: false },
  { who: "Claude Code at a terminal of its own", env: { CLAUDECODE: "1" }, tty: true },
  // strom cannot tell it from a person: its help is the agent's all the same (one line for a person at its end), the
  // listings a person reads at a terminal are in the person's language
  { who: "an agent strom does not know at a terminal (a PTY, no marks)", env: {}, tty: true, like: "person" },
];

for (const lang of ["cs", "de"] as const) {
  test(`an agent reads English in a ${lang === "cs" ? "Czech" : "German"} research: guide, help, help of a command, catalog, listings`, opts, async () => {
    const w = new World();
    w.env.LANG = lang === "cs" ? "cs_CZ.UTF-8" : "de_DE.UTF-8";
    await w.ok(["setup", "--yes"]);
    await w.ok(["init", "Dvořákovi"]);
    w.cwd = w.treeDir("Dvořákovi");
    await w.ok(["person", "add", "Karel /Dvořák/", "--sex", "M", "--born", "1870"]);
    for (const a of AGENTS) {
      const run = async (args: string[]) => {
        const r = await w.run(args, { env: a.env, tty: a.tty });
        assert.equal(r.code, 0, `${a.who}: strom ${args.join(" ")}\n${r.err}`);
        return r.out;
      };
      const why = (args: string[]) => `${lang}, ${a.who}: strom ${args.join(" ")}`;
      assert.match(await run(["guide"]), /Never create, edit, delete or read files under data\//, why(["guide"]));
      const help = await run(["help"]);
      assert.match(help, /\bperson add\b/, why(["help"]));
      if (!a.like) assert.doesNotMatch(help, /--human/, why(["help"]));
      for (const args of [["help", "person", "show"], ["help", "person", "show", "--agent"], ["person", "show", "--help"]])
        assert.match(await run(args), /Everything about one person: facts, family, notes/, why(args));
      const catalog = JSON.parse(await run(["commands", "--json"])) as { commands: { name?: string; path?: string[]; summary: string }[] };
      assert.ok(JSON.stringify(catalog).includes("Everything about one person: facts, family, notes"), why(["commands", "--json"]));
      if (a.like) continue;
      const shown = await run(["person", "show", "P0001"]);
      assert.match(shown, /^facts$/m, why(["person", "show"]));
      assert.match(shown, /\bBIRT\b.*\[lead\]/, why(["person", "show"]));
      // the orientation in the research's language, the guide named for a new agent
      assert.match(await run([]), /strom guide/, why([]));
    }
    // a person at a terminal: their language
    const person = await w.ok(["person", "show", "P0001"], { tty: true });
    assert.match(person.out, lang === "cs" ? /^údaje$/m : /^Angaben$/m);
    // help is the agent's for anyone (Milan, 2026-10-04): a person at a terminal gets it too, with one line of theirs
    const atTerminal = (await w.ok(["help"], { tty: true })).out;
    assert.match(atTerminal, /\bperson add\b/);
    assert.match(atTerminal, lang === "cs" ? /Nápověda pro člověka v češtině: strom help --human\n$/ : /Hilfe für Menschen auf Deutsch: strom help --human\n$/);
    // a person's own help: --human, in their language
    const own = (await w.ok(["help", "--human"], { tty: true })).out;
    assert.match(own, lang === "cs" ? /^strom <příkaz> – co člověk se stromem dělá/ : /^strom <Befehl> – was ein Mensch mit strom tut/);
    assert.doesNotMatch(own, /^ {2}strom person add\b/m);
    w.cleanup();
  });
}
