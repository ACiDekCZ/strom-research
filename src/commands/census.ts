// Census records (spec 106): the agent's proposal to switch them on. The switch itself is the person's alone (the menu's
// settings, the Strom app, strom config set census on in their terminal — core/census.ts); the agent may propose it once
// in a research, at a dead end a census could help with (an origin unknown, a gap between the register's events): an
// item of What waits for the person (kind other, origin census:propose) — never a second one, whatever became of the
// first (done, dropped, declined). Switching census records on closes it (commands/setup.ts closeCensusProposal).

import { register } from "../cli/registry.ts";
import { lines, truncate } from "../cli/format.ts";
import { UsageError } from "../core/errors.ts";
import type { Task } from "../core/model.ts";
import { create } from "../core/records.ts";
import { phrase } from "../core/phrases.ts";
import { resolvePerson, displayName } from "../core/people.ts";
import { refuseInArchive } from "../core/state.ts";
import { CENSUS_PROPOSE_ORIGIN, censusProposal } from "../core/census.ts";
import { addressesPerson } from "../core/impersonal.ts";

register({
  path: ["census", "propose"],
  summary: "Propose to the person once in a research to switch census records on (the switch is theirs alone)",
  group: "tasks",
  tree: true,
  writes: true,
  description:
    "Census records are off unless the person switches them on (strom's menu, the Strom app). At a dead end a census\n" +
    "could help with — where a person came from is unknown, a gap between the events of the registers — the agent may\n" +
    "propose them: one item of What waits for the person, in the research language. Once in a research: never again\n" +
    "once a proposal exists, whatever became of it. Switching census records on closes it.",
  options: [
    { name: "why", type: "string", value: "<text>", description: "what a census could show here, one or two sentences in the research language (impersonal)", max: 600 },
    { name: "person", type: "string", value: "<P…>", description: "the person it would help with" },
  ],
  examples: ['strom census propose --why "the baptism was not found in the place of residence; a household in one year names the birthplace" --person P0002'],
  run(ctx, { opts }) {
    const tree = ctx.tree();
    refuseInArchive(tree, "strom census propose");
    if (ctx.settings.census(tree.config))
      throw new UsageError("census records are on for this research already: nothing to propose — a census task is strom task add … --census <year>[:<house>]", { code: "census.on" });
    const had = censusProposal(tree);
    if (had)
      throw new UsageError(`census records were proposed in this research already (${had.id}, ${had.state}): never again — go on without them`, {
        code: "census.proposed",
        details: { task: had.id, state: had.state },
      });
    const why = typeof opts.why === "string" ? opts.why.normalize("NFC").replace(/\s+/gu, " ").trim() : "";
    if (!why) throw new UsageError("--why: what a census could show here, in the research language", { hint: 'strom census propose --why "<what a census could show>" [--person P…]' });
    const word = addressesPerson(why, tree.lang, { clear: true });
    if (word)
      throw new UsageError(`--why speaks to the user ("${word}"): the person reads it in What waits, where nothing addresses them — say it impersonal, in the research language`, { code: "census.addresses" });
    const person = typeof opts.person === "string" && opts.person.trim() ? resolvePerson(tree, opts.person) : undefined;
    const said = /[.!?…]$/u.test(why) ? why : `${why}.`;
    const what = person
      ? phrase(tree.lang, "census.propose.who", { who: `${displayName(person)} (${person.id})`, why: said })
      : phrase(tree.lang, "census.propose.what", { why: said });
    const t = create<Task>(
      tree,
      "task",
      {
        level: "locate",
        priority: 2,
        what: truncate(what, 200),
        where: [phrase(tree.lang, "census.propose.where")],
        why: truncate(said, 1000),
        doneWhen: phrase(tree.lang, "census.propose.when"),
        subject: person ? [person.id] : [],
        state: "waiting",
        waitingOn: phrase(tree.lang, "census.propose.on"),
        wait: { kind: "other" },
        origin: CENSUS_PROPOSE_ORIGIN,
      } as never,
      (id) => `+${id} task: census records proposed to the person (their switch alone)`,
    );
    return {
      text: lines(
        ...tree.written.map((o) => o.summary),
        `${t.id} waits for the person (What waits): census records are their switch — never ask again nor propose a second time; go on with the research as it is. Say it in one sentence of the session's summary.`,
      ),
      data: { task: t },
    };
  },
});
