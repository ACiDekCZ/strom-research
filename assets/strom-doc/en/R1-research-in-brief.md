<a id="R1"></a>
# R1 The research in brief

How the research works as a whole, on one page. Each section leads to a chapter with the exact rules. Describes
the research 1.25.2 and the Strom app 3.21.2; changes from a later version carry its number.

<a id="R1.1"></a>
## R1.1 The research is a record, not a conversation

The research is a folder on the computer. An AI agent (for example Claude Code or Codex) writes into it only with the
`strom` command: persons, events, sources, searches made, hypotheses and conflicts. What is not written into the
research is lost when the session ends, so the agent writes as it goes.

- **Limits:** nothing is deleted. A wrong fact is withdrawn with a reason, a changed fact is corrected with a reason,
  and the history keeps the original form too.
- **Since:** research 1.0.0

<!-- zdroj: research:assets/method/core.md „Nothing is deleted“, „Write as you go“ -->

<a id="R1.2"></a>
## R1.2 What the agent works on

What the research investigates is set by its **lines**: the ancestors of a person, the descendants of a person, or one
question. Lines give rise to tasks, and the open tasks form one **queue**. The agent always takes the first task in the
queue. Work on people no line reaches comes after the work on the lines.

- Tasks have kinds, in the order they go when their place in the queue is otherwise equal: material from the user,
  where the records are, proving a link, verification, enriching a person, a request to an archive, a story.
- **The tree first, then above it:** a family found in the records that no proven link joins to the tree is not
  researched further until the link is proven ([R10.4](R10-people-and-hypotheses.md#R10.4)).
- What the research does with material from the user: [R11](R11-material-from-the-user.md).
- In detail: [R2](R2-lines-and-queue.md).

<!-- zdroj: research:src/core/queue.ts LEVEL_ORDER · assets/method/core.md „The tree first, then above it“ -->

<a id="R1.3"></a>
## R1.3 How the agent works: sessions

The agent works in **sessions**. One session is one task with a time limit. At the end the agent writes what is done
and what should come next, and closes the session. When working alone, session follows session as long as there is
work and the condition set by a person allows it (for example the pace of the weekly subscription limit).

- A research can also be only a **Strom archive**, which the agent does not work on:
  [R7.8](R7-when-the-agent-works.md#R7.8).
- In detail: [R7](R7-when-the-agent-works.md).
- Where the agent is talked to (the terminal, the Claude or ChatGPT app) and what strom watches where: [R12](R12-where-the-agent-works.md).

<!-- zdroj: research:src/commands/run.ts · assets/method/core.md „The time is strom's to say“ -->

<a id="R1.4"></a>
## R1.4 How the research weighs evidence

The agent works by the **Genealogical Proof Standard** (GPS): a reasonably exhaustive search, a citation for every fact,
analysis and correlation of the evidence, resolution of conflicts, and a written conclusion another researcher can follow.

- Every fact has a degree of certainty: **Lead**, **Possible**, **Probable**, **Proven**. A family tree, family
  memory and an index are always only a lead: an index leads to the entry, only the entry itself proves it (the code
  enforces the index from research 1.28.0). In detail: [R3](R3-verification-and-citation.md).
- A namesake is not the person sought. A person is identified by year, place, house, occupation, spouse and parents.
  Two records with the same name and different parents are two persons. Identifying persons, their names and
  competing hypotheses: [R10](R10-people-and-hypotheses.md).
- A search that finds nothing is a result. What exactly was searched is written down, so the same book is not searched
  twice.
- When records differ, the agent does not choose silently: it writes a **conflict**. In detail: [R5](R5-conflicts.md).
- A place gets a position on the map only when it is certain which place it is. In detail: [R4](R4-places.md).

<!-- zdroj: research:assets/method/core.md (úvod, „Certainty is explicit“, „A namesake is not your person“, „Negative results are results“) · src/core/evidence.ts isWeak (rejstřík od 1.28.0) -->

<a id="R1.5"></a>
## R1.5 What a person decides

Some decisions belong to a person only. The research asks about them in **Awaiting action**, and the agent does not
answer for the person.

- What waits for a person (letters, images to download, questions about places, conflicts, hypotheses, stories to
  approve) and where it is dealt with: [R6](R6-awaiting-action.md).
- A person decides a hypothesis and the agent proposes the decision (from research 1.28.0):
  [R10.3.1](R10-people-and-hypotheses.md#R10.3.1). From research 1.29.0 this is a choice of the research: without a
  saved choice the agent decides (**The AI decides**), **The user decides** a person chooses:
  [R10.3.2](R10-people-and-hypotheses.md#R10.3.2).
- A person's decision holds. The agent changes it only on the strength of a new source: [R5.4](R5-conflicts.md#R5.4).
- A place position set by a person does not change: [R4.3](R4-places.md#R4.3).
- Settings that change what the agent may do are confirmed by a person (for example the condition for working alone,
  [R7](R7-when-the-agent-works.md)).

<!-- zdroj: research:assets/method/waiting.md · src/core/conflicts.ts againAllowed · src/core/placeid.ts personsHand · src/core/config.ts run.gate · src/commands/analysis.ts hypothesis decide (person, od 1.28.0) -->

<a id="R1.6"></a>
## R1.6 The research and the Strom app

The Strom app shows the research as a family tree: persons, facts with their degree of certainty, sources and conflicts,
and, while the agent works, the work in progress. Edits in the app are sent back to the research. An edit of a fact a
record proves does not overwrite it but becomes a conflict ([R5](R5-conflicts.md)). Part S will describe how the app
and the research work together.

<!-- zdroj: research:src/core/sync.ts:1-19 · app:strings.ts research.knows -->

<a id="R1.7"></a>
## R1.7 How the research reads scans

Most facts come from scans of parish registers and other books. The research first determines the book, downloads
images only through the archive's downloader and only those needed. A book is browsed by **readers** (`strom read`):
separate agents, each with a batch of images. An entry that will be cited the main agent reads itself from a crop at
full resolution and records it with a clip and a transcription. Reading by an AI model is not one hundred per cent;
important facts should ideally be verified by a person as well.

- In detail, step by step: [R8](R8-reading-scans.md).
- **Since:** research 1.0.0

<!-- zdroj: research:assets/method/reading.md · assets/method/locate.md · assets/method/recording.md · src/commands/read.ts:183-200 -->

<a id="R1.8"></a>
## R1.8 How Strom works: `strom doc`

This documentation is carried in the research and can be read offline too. `strom doc` lists the contents,
`strom doc R10.1` one rule together with the rules under it, and `strom doc <words>` searches the headings, the
glossary and the text.

- **Limits:**
  - a number can also be written in small letters or with a hyphen (`r4.3`, `R4-3`). An unknown number ends with an
    error that gives the nearest numbers;
  - the search ignores diacritics and letter case. It shows at most 10 rules, the best first, and how many more there
    are (`--limit` another count);
  - the text is in the language of the research (`--lang` another). A language the documentation is not translated
    into gets English with a note;
  - each rule has a link to the same rule on stromapp.info;
  - it works outside a research and in a Strom archive too, and writes nothing.
- **Method only:** to a person's question how or why Strom does something, the agent answers from `strom doc`: with
  the number of the rule and with the link that `strom doc` prints.
- **Controls:** terminal: `strom doc`, `strom doc R2.3`, `strom doc hypothesis --lang en`, `--json`. The help for
  a person (`strom help --human`) ends with a pointer to `strom doc`. The app has the same documentation in **How
  Strom works** ([A1.7](A1-the-app-in-brief.md#A1.7)).
- **Since:** research 1.28.0

<!-- zdroj: research:src/commands/doc.ts (SEARCH_ROWS=10, --limit, ui.docs.fallback, docUrl) · src/core/doc.ts · assets/strom-doc/ (PIN) · src/agents/files.ts:188 "answer from `strom doc`" · src/cli/help.ts (help --human, poslední řádek) · CHANGELOG.cs.md 1.28.0 · commity 314ab218, 4acfb170 -->

<a id="R1.9"></a>
## R1.9 Questions over the tree's data: `strom query`

A question over the tree's data (how many millers are in the family, who lived at house 12, who was born in one place
in one century) is answered by one call of `strom query`. It prints a row for each fact of a person: who it is and how
they are related to the main person, what the fact says, where, when, how certain it is and on what source. The
command only reads: it verifies nothing and writes nothing.

- **Limits:**
  - a fact of a family (a marriage) has a row for each partner. Retracted persons and facts never, disproven facts
    only with `--status disproven`;
  - the relation to the main person (the setting `main.person`, else `--of P…`) is in words in the language of the
    research, with the side and the generation, for example **grandfather, father's side (G3)**. G1 is the main
    person, G2 their parents. Without a main person, or with a retracted one, `strom query` refuses and says how to
    go on (`strom config set main.person P…`, or `--of P…`);
  - whose facts (`--kin`): `ancestors` the main person and the direct line; `blood` (the default) the ancestors and
    all their descendants, the side branches too; `family` the blood relatives and their partners; `all` the whole
    tree;
  - the filters all apply together: `--kind` (the kind of fact: OCCU, RESI, BIRT …; an unknown kind is refused with
    the list of valid ones), `--occupation`, `--value` (repeated: any of the words), `--place`, `--house` (12 also
    finds č. 12 and Nr. 12), `--years` (1750-1850 or one year), `--surname` (the other forms of the surname too:
    Horáková), `--source` (S… or words of the title), `--status`;
  - a word is looked for at the start of a word in the fact's value, label or cause, not in the note, ignoring
    diacritics. An occupation is also looked for in its Czech, German, Latin and Polish forms (mlynar also finds
    Müller and molitor) and in the research's own forms ([R1.9.2](#R1.9.2)); the head of the listing names the
    forms. An occupation no list knows is looked for only as written, and the listing says so. `--exact` looks for the word itself only;
  - `--count` prints only the numbers of persons and facts; `--by generation|kin|place|decade|surname` splits them
    into groups (by generation the side branches have a group of their own), without `--count` the rows by group. The
    rows come in pages (`--limit`, at most 100, `--page`); `--json` also gives each person the link that opens them in
    the Strom app;
  - persons who have the word only elsewhere (a name, a note) are counted apart, with the `strom find` command that
    finds them. When nothing is found, the listing offers `strom find` and a wider `--kin`.
- **Method only:** to a question over the data the agent answers with one call of `strom query`, not by searching
  person by person. It names a person by name with the ID in brackets (Jan Horák (P0012)), the relation whole as
  `strom query` gave it, never shortened, and a source by its title with the S… in brackets. For each fact it says how
  certain it is: only a proven one as a fact; a probable or possible fact and a lead are not proven. A row of
  `strom query` is not enough to tell whose a record is or who is who, nor to verify or record a fact: that goes on
  from the sources and by the method ([R3](R3-verification-and-citation.md), [R10](R10-people-and-hypotheses.md)).
- **Controls:** terminal: `strom query`, for example `strom query --occupation mlynar --count --by generation`;
  `strom app --person P…` opens the Strom app at the person (an app before 3.21 opens the tree). `strom find` still
  looks for a word in any text of the research, and its help points to `strom query`. `strom facts …` does nothing:
  it says **"strom facts" is now "strom query" (the same options)** and the whole call with `strom query`.
- **Since:** research 1.32.0

<!-- zdroj: research:src/commands/query.ts (popis, volby, KIN_SETS, FACT_GROUPS, LIST_PAGE_MAX=100, elsewhereOf, tries) · src/core/query.ts (hlavička, kinSet, SHOWN_STATUSES, ASKED_STATUSES) · src/core/occupations.ts · src/commands/analysis.ts help find („the facts recorded of people … strom query“) · src/cli/execute.ts RENAMED, renamedCommand · src/agents/files.ts AGENTS.md „Questions over the data“ · src/commands/start.ts app --person · cs.json ui.query.*, ui.error.command.renamed · test/cli/query.test.ts · CHANGELOG.cs.md 1.32.0 · spec 081 K1–K7 · query bez hlavní osoby / odvolaná: src/commands/query.ts ofPerson (query.no-main, query.retracted), cs.json ui.error.query.*, commit 6cdab11b -->

<a id="R1.9.1"></a>
### R1.9.1 Stories: `strom query --story`

- `--story <word>` lists the persons and couples whose story holds the word: a row for each story, with the sentence
  the word is in and the sources the sentence rests on.
- **Limits:**
  - the word is looked for as with `--value` (ignoring diacritics, with the forms of an occupation, `--exact`);
    repeated: any of them;
  - a long sentence is shortened around the word. A story waiting for approval (also a new version of an approved
    one) has **draft**;
  - the sources of the sentence are those the sentence names, else the sources of the story's facts from the years
    the sentence mentions. When they cannot be told, the row shows **the story's sources**;
  - a couple's story has a row for each partner. The other filters choose the persons (those with a matching fact);
    `--by` only `generation`, `kin`, `surname`.
- **Method only:** a story retells the facts. The agent answers from the facts and sources; a story only shows where
  to look.
- **Since:** research 1.32.0

<!-- zdroj: research:src/commands/query.ts (--story, --by place|decade odmítnuto, storyText, storyData) · src/core/query.ts findStories (hlavička: sourcesNamed, storySources, basis sentence|story) · cs.json ui.query.story.* · src/agents/files.ts „A story retells the facts“ · CHANGELOG.cs.md 1.32.0 -->

<a id="R1.9.2"></a>
### R1.9.2 The research's own forms of occupations: `strom occupation`

The built-in list of occupations (83 occupations, each in Czech, German, Latin and Polish forms) can be extended by
the research's own forms: another language, an old spelling or an occupation the list does not know.
`strom query --occupation` ([R1.9](#R1.9)) then finds all the forms as one occupation, also with `--exact`, `--count`
and `--story` ([R1.9.1](#R1.9.1)).

- **Limits:**
  - `strom occupation add` takes at least two forms of one occupation. A form the list knows joins the others to it
    (another form of a miller); forms the list does not know make a new occupation. A form is in the research's
    language, another language is written with its code before the form: `de:Ölschläger`. When the forms are one
    occupation already, nothing is written;
  - each group keeps who added it (the person by hand, or the agent during the research), the day and, with
    `--source`, the source the form was met in;
  - the person adds and takes out forms in their own terminal, without an agent, and may take out any of the
    research's own forms. The agent takes out only a form an agent added; what the person added it never changes or
    takes out. The built-in list stays as it is;
  - `strom query` says when the occupation asked for is in no list (only the form as written is looked for) and gives
    the command that adds its forms: “{word}: not in the list of occupations, found only as written; its other forms:
    strom occupation add {word} <form> [la:<form> …]”;
  - the research's own list is the research's file `quality/occupations.json` under the seal
    ([R14](R14-seal-and-integrity.md)). When it cannot be read, `strom query` and `strom occupation list` look only in
    the built-in list and say so in one line with `strom repair`; `add` and `remove` write nothing over it.
- **Method only:** an occupation `strom query` finds in no list, or a form from a source the list lacks, the agent
  adds with `strom occupation add … --source S…` together with its other forms and tells the user.
- **Controls:** terminal: `strom occupation add olejník de:Ölschläger`; `strom occupation list` (the research's
  groups: who, when, sources), `strom occupation list mlynar` (the forms of one occupation, the research's own marked
  `*`), `strom occupation list --all` (every occupation); `strom occupation remove de:Ölschläger`.
- **Since:** research 1.32.0

<!-- zdroj: research:src/commands/occupation.ts (add: aspoň dva tvary, --source ověřený pramen, by human | agent podle tree.personWrites; list: bez slova skupiny s by/at/sources, se slovem tvary s * u vlastních, --all; remove: agent jen své, persons, builtin, unknown) · src/core/occupations.ts (OCCUPATIONS_FILE quality/occupations.json, parseForm kód jazyka, addOccupation: nic se nezapíše, když už jedno povolání; mergeOccupations, ownOrRefuse: nečitelný soubor → UsageError strom repair; writeOwn putFile zapečetěná operace) · src/commands/query.ts:254–265 (ui.query.occupation.unknown, ui.occupation.unreadable) · assets/terms/occupations.json (83 skupin) · src/agents/files.ts AGENTS.md „An occupation strom query says is in no list“ · cs.json ui.occupation.*, ui.query.occupation.unknown · commity 84e7fc0e, 0abe8793 · CHANGELOG.cs.md 1.32.0 -->
