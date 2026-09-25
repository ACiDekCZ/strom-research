// The agent guide: what an agent needs to know to do research with strom,
// with no other documentation. Keep it short — it is read at the start of
// sessions and costs tokens every time. Every command in it must exist
// (test/cli/examples.test.ts checks them against the registry).

import { langName } from "../core/lang.ts";

export function guideText(lang: string | undefined): string {
  const language = lang
    ? `The research language of this tree is ${langName(lang)} (${lang}): talk to the user in ${langName(lang)} and write notes, tasks and stories in ${langName(lang)}. Keep transcripts of records in their original language.`
    : "Talk to the user in their language. Set it as the research language: strom setup --lang <code> (cs, en, de, pl, …).";
  return `STROM — genealogical research with an AI agent

WHAT THIS IS
strom is the research toolkit you (the agent) work through. It keeps the
evidence (people, families, events, sources, searches, tasks) in a git
repository, enforces genealogical method, and produces a GEDCOM file for
family tree programs such as the Strom app. You bring judgement and reading;
strom keeps the record straight.

HARD RULES
1. Never create, edit, delete or read files under data/ yourself. Every change
   goes through a strom command. Direct edits are detected and block writing.
2. Never invent facts. What the user or a family tree says is a lead until a
   record proves it.
3. Nothing is deleted. Wrong facts are retracted with --reason.
4. A namesake is not your person: check year, place, house and parents —
   different parents mean two people, not a clerk's error.
5. Negative results are results: record every search, also when nothing
   was found.
6. Do not answer consent questions yourself (exit code 4). Ask the user.
7. Never download from an archive yourself (curl, a script, browser tools).
   Scans come through a connector (strom fetch), paced by strom — an archive
   the research needs has none yet: build one first (strom connector new,
   its DISCOVERY.md) and tell the user in a sentence. The user saves images
   by hand only where the archive does not allow automation.
${language}

GETTING STARTED (once)
  strom setup --yes --lang <code>      the language the user speaks with you;
                                       tell the user where the research lives
  strom init "<family name>"
  strom research new "<name>" --new-person "Josef /Novák/" --born "ABT 1885" --born-place "Kamenice nad Lipou"
  strom intake --text "<what the user told you, in their words>"
  strom intake <file or folder>        documents, photos, a GEDCOM or Strom tree

EVERY SESSION
  strom session start                  the brief: task, what is known, method
  … work; record every finding at once …
  strom task done T0001 --result "…"   a complete negative search is a result
  strom session close --summary "…" --next "…"    (not finished: --continue)
  in a conversation, the next task is best begun in a fresh context (Claude Code: /clear) —
  suggest it to the user; many tasks waiting: the agent working on its own (strom run, the
  user starts it from strom's menu), every task in a fresh session

RECORDING
A record (register entry, certificate) — the source first, then its facts:
  strom source add "Křest Jana Nováka 1885" --kind baptism --recordset B0001 --clip B0001:12@0.05,0.40,0.45,0.18 --locator "fol. 12, č. 3" --form original --information primary --transcript @zapis.txt
  strom person add "Jan /Novák/" --sex M --born "24 JUN 1885" --born-place "Kamenice nad Lipou" --cite S0001
  strom family add --partner P0002 --partner P0003 --child P0001    the baptism naming the parents proves the link
  strom event add P0001 CHR --date "25 JUN 1885" --cite S0001 --locator "fol. 12" --with "godparent:Marie Dvořáková" --status proven
  strom event add P0002 OCCU --value "rolník" --cite S0001
The same fact from a second record: strom cite E0001 S0002 (never a second BIRT).
Names a record gives: strom name add P0003 "Marie /Svobodová/" --kind birth --cite S0001
(a maiden name completes "Marie"; --kind married for a married name). A record
naming someone's parents (a grandchild's baptism) cites the family itself and
the new names: strom person add "Josef /Svoboda/" --cite S0001 --information secondary,
strom family add --partner P0004 --child P0003 --cite S0001 --information secondary.
Corrections — a person, a fact, a source:
  strom person edit P0003 --sex F --name "…" --reason "…"
  strom event edit E0001 --date "…" --reason "…"
  strom source edit S0001 --translation "…"
One person recorded twice (an imported tree and the research) — parents
recorded twice are merged first:
  strom family merge F0002 F0005 --reason "…"
  strom person merge P0001 P0007 --reason "…"
Many facts from one record in one call — lines of commands, "#name" labels
what a line creates, "@name" uses it later:
  strom batch 'person add "Anna /Svobodová/" --sex F #anna' 'family add --partner P0001 --partner @anna --married 1910 --cite S0001'
What the user remembers: strom intake --text "…", then people and facts
WITHOUT --cite — they stay leads. A document the user has but you have not
seen: record it as a source (--form original), cite it, and keep the facts
probable — proven needs your own reading of the record.

CERTAINTY
status of a fact = how sure the conclusion is:
  proven    you read the original record yourself and it states the fact
  probable  good evidence, but indirect, or a hard reading
  possible  weak evidence
  lead      family memory, a family tree, an index, a guess
evidence quality = what the record is (source --form original | derivative |
authored) and what it knew about THIS fact (--information primary: written at
the time by someone who knew | secondary). A baptism entry is primary for the
date of the baptism, secondary for the age of a parent: say so on the citation
(--information on cite/event add). A family tree, a memory or a compiled work
never makes a fact more than a lead; proven needs primary information.
An age gives a birth estimate: aged 25 at a marriage in 1910 →
  strom event add P0001 BIRT --date "CAL 1885" --cite S0001 --quote "25 let" --information secondary
Ages as the record gives them: --age "25 let", "annorum 25", "3 months" (a
marriage gives both: strom family add … --age husband:25 --age wife:22).

SEARCHING
  strom searched B0001 --years 1880-1890     before opening anything
  strom search add "Křty Novák 1880-1890" --recordset B0001 --years 1880-1890 --surname Novák --method page-by-page --result negative
  strom search edit Q0001 --recordset B0002 --reason "…"   a search recorded wrongly is corrected, never added again
  strom repo add … · strom recordset add … · strom place jurisdiction …   where the records are
  strom place add "<village>" --kind village --lat … --lon …   the places of the facts, on the Strom app's map —
                                       identify the place first (district, parish, today's name: of several
                                       villages of a name, the one the records mean); not sure: --unlocated "<why>".
                                       session close and strom place list --off-map say which are still off it
  strom connector list                 connectors: they find books and fetch scans
  strom fetch <connector> --find "<place>" --years 1780-1850
  strom fetch <connector> <book> --images 40-69 --recordset B0001    registered at once
  strom connector use <connector> --via browser    only when the user asks: images through their own
                                       browser (strom fetch then says what to do; --via direct: back)
  strom connector new <name> --url <portal>    an archive you need has none: build it (its DISCOVERY.md)

FINDING YOUR WAY
  strom research show G0001 · strom person show P0001 · strom family show F0001
  strom gaps · strom find <text> [<text>…] · strom frontier · strom task list
  for the user, in the research language: strom stats (how far the research got) · strom recent
  (what came in lately) · strom plan (what you do next) · strom pedigree [P…] (the ancestors as a
  tree) · strom person card P… (one life)
ONE PERSON, LOOKED AT AGAIN (the user asks you to check or complete someone; a new model reads better)
  strom review P… [--scope family|line] [--reread] — strom proposes tasks: what records, notes and the
  diary say of them outside their data, entries whose images are here but were not read whole, facts
  resting on one reading, conflicts left open (--reread: a second reading with the model the user reads
  with now). Each task's brief lists its items. Tell the user how many and what they cost; they decide.
STORIES OF THE ANCESTORS (the setting stories — on by default; strom shows it)
  Once records tell a person's life (a baptism and more facts from records), strom proposes a narrate
  task: write the story for the family book — plain words, the research language, every statement on a
  recorded fact (strom story set P… --text @notes/story-P….md --fact E… …). More facts later: it
  proposes adding to it. Stories wait behind all the research; working alone
  (strom run), every few sessions one comes first. In a conversation the user leads: write one when they
  want it, or offer it when the research has a pause. A story is a draft until the user approves it (--final). When strom says to tell
  the user (once, not in every conversation): in a sentence, and that they may say no (strom config set
  stories no).

The result: strom export gedcom writes output/tree.ged (standard GEDCOM for any program) and
output/tree-strom.ged (for the Strom app) — both from the same evidence, also on session close.
Changes are committed automatically; you never run git yourself.

THE STROM APP — where the user sees the result
  The Strom app (https://stromapp.info) is strom's companion: a free family tree app, no account,
  the family's data stay on their computer; it shows the tree, the sources, a map, a family book.
  When the user wants to see the results, or when strom says to offer it (once, not in every
  conversation), suggest it gently, in a sentence or two — best installed as an app from the browser, then it works offline:
  https://stromapp.info/run/   the app itself: opened in the browser, installed from there (the
                        install icon at the end of the address bar; Safari: File → Add to Dock)
  strom app install     opens it there and says where to click
  strom app             opens it — with this research when the app can take it (strom says so), and
                        run by you, the app follows the research live: what you record shows there
                        by itself — the best way to watch it grow; otherwise in the app: Import,
                        and output/tree-strom.ged
                        Each entry comes with its image, cut out of its scan (the sources' clips —
                        give --clip when you record an entry); sources without a clip (read earlier,
                        or from an older research) — when the user wants them too: strom clips
                        --dry-run (how many), then strom clips (readers find and check them); their
                        words, when a clip has none: strom transcripts (read, then checked)
  Without the app, the user can simply ask you about anyone in the tree, a family, a line, what is
  proven and by which record, what is new or next: answer from strom (person card, pedigree, stats,
  recent, plan, person show, family show, research show, find, source show, story show, gaps,
  frontier) in plain words — names, dates, places, no IDs.
  strom (no arguments) says whether it is installed here (results): not yet — offer to install it; installed —
  just open it. A program they already use is fine too: output/tree.ged. They do not want it:
  never again.

OUTPUT AND ERRORS
- One line per record, IDs first. Read the text; add --json only to parse.
- Listings are paged (--limit, --page). Do not pipe strom output.
- People can be named by ID (P0001) or name ("Jan Novák", no diacritics ok).
  An ambiguous name lists candidates (exit 2) — then use the ID.
- Every error ends with "→ <what to run next>".
- Exit codes: 0 ok · 1 error · 2 usage/ambiguous · 3 needs input (ask the
  user, then run the given command) · 4 needs consent (the USER must run the
  given command in their terminal) · 5 locked by another session.
- Settings and how to override them: strom config where.

MORE
  strom help <command>                 short help with examples
  strom commands <group> --json        options and examples of a group
`;
}
