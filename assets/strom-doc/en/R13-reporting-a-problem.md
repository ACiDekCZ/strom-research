<a id="R13"></a>
# R13 Report a problem: `strom error`

When something goes wrong in the research, in a download, in the Strom app or in the installation, `strom error`
packs what is needed to see what happened into one ZIP file. Nothing of the family tree's people goes into it and
strom sends nothing: a person sends the file. The chapter describes the research 1.30.0.

<!-- zdroj: dirigent:spec/070-hlaseni-chyby/spec.md · research:6c6e7c3b CHANGELOG.cs.md 1.30.0 (Problém nahlášený v jednom souboru) · strom help error · src/commands/error.ts · src/core/report.ts -->

<a id="R13.1"></a>
## R13.1 One command, one file

`strom error` lists what the report will hold, asks **Create the report?** and saves the ZIP file. It says where the
file is, how large it is and where to send it.

- **Enforced by the code:**
  - the file goes to the Downloads folder, otherwise to the current folder; in a research without a Downloads folder
    to the home folder, never into the research;
  - the report is at most 2 MB: longer logs are shortened;
  - the command only reads the research and writes nothing into it;
  - strom sends nothing: “To send by e-mail to {address}, with a few words on what happened. strom itself sends
    nothing; the file can be opened and looked through first (README.txt says what is where).”
- **Controls:** terminal: `strom error`; in the `strom` menu: **Settings → Maintenance → Report a problem: one ZIP file
  to send (nothing of the family tree's people)**.
- **Since:** research 1.30.0

<!-- zdroj: research:6c6e7c3b src/commands/error.ts (ctx.readOnly, cíl ZIPu) · src/core/report.ts REPORT_MAX_BYTES · cs.json ui.report.summary, ui.report.create, ui.report.done, ui.report.send, ui.maintenance.title, ui.maintenance.report -->

<a id="R13.2"></a>
## R13.2 What the report holds and what not

| Area | What is in it |
|---|---|
| this computer | strom's version and channel, Node, git, the system, language, free space |
| strom's settings | no paths, no logins |
| `strom doctor` | every check |
| agents | which are installed, their versions, the default model, strom's hooks |
| connectors | list, versions, allowed hosts, the last test (no logins) |
| the bridge to the Strom app | running, the app's version, the last sync |
| the research in numbers | counts, `strom check`, git, downloads, sessions (no names) |
| technical logs | strom's logs of the last 7 days (bridge, tidying, downloads) |
| commands | commands ended with an error, those of the conversation with the agent too |

- **Enforced by the code:**
  - names, places, notes, transcripts, scans and e-mails do not go into the report, or are replaced by stable codes
    (for example ‹a1b2c›): the same word has the same code throughout the report, so it shows that something is the
    same, not what it is;
  - paths with the user's name are masked; logins, keys and tokens never go;
  - researches are named in the report only R1, R2…, never by their path;
  - an area that cannot be read has ✗ and the error in the listing (“could not be read (…)”); the report is made from
    the others;
  - the ZIP holds README.txt (what is where) and report.json.
- **Since:** research 1.30.0

<!-- zdroj: research:6c6e7c3b cs.json ui.report.area.* (system, config, doctor, agents, connectors, bridge, research, logs, commands), ui.report.area.failed, ui.report.readme.intro · src/core/redact.ts (stálé kódy) · src/core/cmdlog.ts (výzkumy jen R1, R2…, 6c6e7c3b) · src/commands/error.ts:85-97, :408 -->

<a id="R13.3"></a>
## R13.3 Which problem, which command

`--about` adds the details of one area. It can be given more than once.

| Problem | Command |
|---|---|
| a download stops, fails or waits long | `strom error --about fetch` |
| the Strom app: sync, the bridge, the tree not shown | `strom error --about sync` |
| the agent: a conversation or `strom run` went wrong | `strom error --about agent` |
| installing or updating strom | `strom error --about install` |
| anything on Windows | `strom error --about windows` |
| something else | `strom error` |

- **What an area adds:** downloads in detail (every one, its connector, waits and errors); the bridge in detail
  (synchronisations, the app's gates); the agent's sessions in detail (steps and exit codes); the installation in
  detail (PATH, updates, backups of the installation); Windows (PowerShell's execution policy, long paths, OneDrive).
- **Controls:** `--since 2d|1w|12h|YYYY-MM-DD` sets how far back the logs go (7 days by default).
- **Since:** research 1.30.0

<!-- zdroj: research:6c6e7c3b strom help error (tabulka), REPORT_ABOUT · cs.json ui.report.area.fetch, sync, agent, install, windows -->

<a id="R13.4"></a>
## R13.4 Where the problem happened and what happened

The report says where the problem happened and can carry a description in the person's words.

- **Enforced by the code:**
  - a person at the terminal is asked **Where did the problem happen?**: **in a conversation with an agent**, **in a
    terminal, strom without an agent**, **in the Strom app**, **not known**; with `--where chat|terminal|app|unknown`
    there is no question;
  - run by an agent without `--where`: the place stays “not known” and strom tells the agent to ask the person and run
    the command again;
  - `--note "…"` is the description of the problem in the person's words, at most 2000 characters; names from the
    research are masked in it.
  - **From research 1.31.0:** declined forms of names and places the research knows are masked too, where the last
    one or two letters change (“z Brna” of Brno, “v Praze” of Praha). The stem has at least 3 letters, and the
    shorter the stem, the shorter the ending; a common word that only begins alike stays readable. The whole report
    is masked the same way.
- **Controls:** `strom error --where app --about sync`, `strom error --since 2d --note "the download stopped
  halfway"`.
- **Since:** research 1.30.0

<!-- zdroj: research:6c6e7c3b src/commands/error.ts (otázka jen interaktivně; pod agentem where unknown) · cs.json ui.report.where.q, .chat, .terminal, .app, .unknown · strom help error --note (≤2000 characters, masked) · research:c5ee74ab src/core/redact.ts formOf (změněné poslední 1–2 písmeno, kmen ≥ 3, koncovka podle kmene; slovo ze 3 písmen jen o písmeno delší), byPrefix 3 písmena · CHANGELOG.cs.md 1.31.0 -->

<a id="R13.5"></a>
## R13.5 Data of people only with consent

When the problem lies in a particular person, family or book, its data can be added. Only on an explicit wish.

- **Enforced by the code:**
  - `--with-data` with `--person P…`, `--family F…` or `--book B…` adds the file data.json: names, facts, places,
    citations and how sure each fact is. No scans, notes or transcripts;
  - a person at the terminal is asked **Add them to the report?**;
  - the agent has to add `--yes-data`, and only after the person's explicit “yes” in the conversation; without it the
    command ends saying that consent is missing.
- **Controls:** `strom error --about fetch --with-data --book B0001`.
- **Since:** research 1.30.0

<!-- zdroj: research:6c6e7c3b strom help error --with-data, --person, --family, --book, --yes-data · src/core/reportdata.ts · cs.json ui.report.data.q, ui.report.data.add -->

<a id="R13.6"></a>
## R13.6 A broken research, the Strom archive and outside a research

- **Enforced by the code:**
  - a broken research is only read; what cannot be read has ✗ in the listing and the rest of the report is made;
  - in the Strom archive the report has no agents, no sessions and no `--about agent`; the question **Where did the
    problem happen?** has no “in a conversation with an agent” and offers **in a terminal** instead of “in a terminal,
    strom without an agent”;
  - run outside a research: the report has every known research, only in numbers and with a masked name; the commands
    ended with an error from all of them.
- **Since:** research 1.30.0

<!-- zdroj: research:6c6e7c3b CHANGELOG.cs.md 1.30.0 („Výzkum se jen čte, i rozbitý.“) · src/commands/error.ts (archiv: bez agentů a gate.log; mimo výzkum jen otisky známých výzkumů) · cs.json ui.report.where.terminal.archive, ui.report.area.research.archive -->

<a id="R13.7"></a>
## R13.7 The agent and reporting a problem

The agent knows the command. When a person says they have a problem with strom, or want to “send the error”, the
agent asks where it happened (in this conversation, in a terminal without the agent, or in the Strom app), never
guesses it, and runs `strom error --where …` with the `--about` that fits and with `--note` in the person's words.
Then it tells the path of the file and the address strom printed.

- **Enforced by the code:** the agent adds people's data only with `--yes-data`, which it may give only after the
  person's explicit consent ([R13.5](#R13.5)).
- **Method only:** the agent never sends or opens the file and never copies its content into the conversation.
- **Since:** research 1.30.0

<!-- zdroj: research:6c6e7c3b src/commands/guide.ts:371-378 (A PROBLEM WITH STROM) · CHANGELOG.cs.md 1.30.0 -->
