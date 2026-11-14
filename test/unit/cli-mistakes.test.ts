// What agents type that strom does not take (live run, 2026-11-14): the option or command they meant said in the error,
// another name taken only where it can mean nothing else — query --person (--of), history read (history show · list),
// task view (task show), search add --about (--task, --surname), recordset list --repo-of (--repo).

import { test } from "node:test";
import assert from "node:assert/strict";
import "../../src/commands/index.ts";
import { parseOptions, resolveCommand } from "../../src/cli/execute.ts";
import { match } from "../../src/cli/registry.ts";
import { UsageError } from "../../src/core/errors.ts";

/** The error a line gives: its message and hint. */
function mistake(f: () => unknown): { message: string; hint: string } {
  try {
    f();
  } catch (e) {
    assert.ok(e instanceof UsageError, String(e));
    return { message: e.message, hint: e.hint ?? "" };
  }
  assert.fail("no error");
}

const def = (...words: string[]) => match(words)!.def;

test("an option agents type for another: the one meant, with what it takes — several when it may be either", () => {
  const person = mistake(() => parseOptions(def("query"), ["--person", "P0001"]));
  assert.equal(person.message, "unknown option --person for strom query");
  assert.match(person.hint, /^meant: --of <P…> — the person the relations are to/);
  const about = mistake(() => parseOptions(def("search", "add"), ["Křty Lhoták", "--about", "P0001"]));
  assert.equal(about.message, "unknown option --about for strom search add");
  assert.match(about.hint, /^meant: --surname <name> — surnames looked for \(repeatable\) · --task <T…> — task this search served/);
});

test("another name of an option, taken as it: --repo-of for recordset list's --repo, wake's --note for --reason", () => {
  assert.equal(parseOptions(def("recordset", "list"), ["--repo-of", "R0001"]).values.repo, "R0001");
  assert.equal(parseOptions(def("recordset", "list"), ["--repo-of=R0002"]).values.repo, "R0002");
  assert.equal(parseOptions(def("task", "wake"), ["T0001", "--note", "znovu"]).values.note, "znovu");
  assert.equal(parseOptions(def("task", "list"), ["--all"]).values.all, true);
});

test("a command a group does not have: another word for one of its commands, a group that is a command too, its commands behind a gate", () => {
  // a group that is a command of its own (strom history): a word after it is no argument but a command it lacks
  const read = mistake(() => resolveCommand(["history", "read"]));
  assert.equal(read.message, 'unknown command "strom history read"');
  assert.equal(read.hint, "similar command: strom history show · strom history list");
  assert.equal(mistake(() => resolveCommand(["history", "lst"])).hint, "similar command: strom history list");
  // another word for show
  assert.equal(mistake(() => resolveCommand(["task", "view", "T0001"])).hint, "similar command: strom task show · strom task list");
  assert.equal(mistake(() => resolveCommand(["person", "get", "P0001"])).hint, "similar command: strom person show · strom person list");
  // what was taken stays taken: the group alone, its options, its own commands; a typo still the near one
  assert.deepEqual(resolveCommand(["history", "--limit", "3"]).def.path, ["history"]);
  assert.deepEqual(resolveCommand(["history", "list", "--event", "x"]).def.path, ["history", "list"]);
  assert.equal(mistake(() => resolveCommand(["person", "ad"])).hint, "similar command: strom person add");
});
