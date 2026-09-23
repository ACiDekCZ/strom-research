# Strom Research

Research your family's history with an AI agent. `strom` turns an AI agent —
Claude Code, OpenAI Codex, Google Antigravity or OpenCode — into a careful
genealogical researcher: the agent searches parish registers and archives, you
decide, and only what a record proves goes into your family tree. The result is
a GEDCOM file for the [Strom app](https://stromapp.info) or any other program.

Everything stays on your computer: the research is a folder with its full
history, and nothing leaves it except the requests to the archives and your
conversation with the agent you chose.

## Quick Start

### With an AI agent you already use

Send it this sentence:

> I'd like to research my family history with your help. Please install and
> start strom as described at https://github.com/ACiDekCZ/strom-research

The agent asks your permission, installs strom, asks where to keep the research
and in which language to talk, and opens the conversation for the research.

### One line in a terminal

No Node needed: the installer brings the official Node from nodejs.org (the
newest release of the Node 24 LTS line) and strom's code (plain JavaScript you
can read), checks both against their checksums, puts `strom` on your PATH and starts a short setup in your language.
Nothing needs admin rights.

- **Windows** (PowerShell):
  `irm https://raw.githubusercontent.com/ACiDekCZ/strom-research/main/install/install.ps1 | iex`
- **macOS, Linux**:
  `curl -fsSL https://raw.githubusercontent.com/ACiDekCZ/strom-research/main/install/install.sh | sh`

With Node 22.18 or newer: `npm install -g strom-research`.

The setup asks a few things — language, where to keep the research, which
agent (it finds the installed ones and offers Claude if there is none), the
model, whether the agent should also write stories of your ancestors, what the
agent may do without asking, a shortcut on the desktop — and gets git if it is
missing. Then the first conversation begins: tell the agent whom you are
looking for and what you know.

Next time: run `strom`, or double-click the "Strom research" shortcut.

Updates: strom looks for a new version at most once a day and says so;
`strom update` installs it (checked like the installer does), and with it the
newest security release of its Node line. Installed with
npm: `npm install -g strom-research@latest`.

## Features

**Research as a conversation**
- The agent explains, asks and proposes; you decide whom to research and what next
- Beginners talk to the agent in its desktop app (Claude, ChatGPT/Codex,
  OpenCode), experienced users in the terminal — strom opens it in the right
  folder, set up as you chose
- Or let the agent work on its own through the task queue (`strom run`) and
  read the result
- Several agents can work on one family tree side by side, each on its own task

**Evidence first**
- Every fact cites its record (folio, entry, the words of the register);
  facts without one stay leads
- Sources, record sets, archives, searches (also the negative ones),
  hypotheses and decisions — all recorded
- Proposes the next tasks itself: who still lacks proven parents and which
  books would name them
- Checks the tree for contradictions (ages, dates, duplicates) before every commit
- Every change is a commit; the agent never edits the data directly

**Archives**
- Downloaders ("connectors") for online archives: the agent builds one itself
  when the research needs an archive strom does not know yet, and tells you
- A polite limiter for every request (pace, hourly cap, back-off), images
  checked before they are kept; your own login to a paid portal stays with you
- A standard, versioned plugin interface — see
  [assets/plugins/connectors/README.md](assets/plugins/connectors/README.md)

**Results**
- GEDCOM for the Strom app (witnesses, stories, sources per page) and a strict
  standard GEDCOM for any other program
- Stories of your ancestors, written from the facts, for the family book
  (on by default, you may say no)
- The Strom app can open the research directly and follow it live while the
  agent works
- Ask the agent about anyone in the tree — with or without the app

**Safe by design**
- What the agent may do alone is your choice: ask, auto (default) or full
- Consents are yours: strom asks in a window of the system that the agent can
  neither see nor click
- `strom doctor` checks everything strom needs and fixes it with your yes;
  `strom uninstall` removes strom again (your research stays)

**Everywhere**
- Windows, macOS and Linux; strom brings its own official Node, needs no admin
  rights, and everything it runs is readable JavaScript
- English, Czech and German in the program; the research itself in any
  language and script

## What you need

- A computer with Windows 10/11 (64-bit), macOS or Linux
- An AI agent with an account at its maker — usually a subscription (for
  example Claude Pro). Choose its best model: the research reads old
  handwriting and weighs the records.
- git — strom gets it for you if it is missing

## For AI agents

The instructions for an agent sent here by its user:
[install/AGENTS.md](install/AGENTS.md). Once installed, `strom` (no
arguments) says where things stand and what to do next, `strom guide`
explains the work, `strom commands --json` lists every command.

## Build from Source

```bash
git clone https://github.com/ACiDekCZ/strom-research.git
cd strom-research
npm install
node src/cli.ts --help                # run from sources (Node 22.18+)
npm test                              # node --test
npm run typecheck
npm run build                         # dist/ for npm
npm run release                       # release/: strom-app.tar.gz, SHASUMS256.txt, VERSION, NODE_VERSION, installers
```

Zero runtime dependencies: TypeScript on Node's built-ins, and git.

## License

Copyright © 2026 Milan Víšek.

This Source Code Form is subject to the terms of the Mozilla Public License,
v. 2.0. If a copy of the MPL was not distributed with this file, You can
obtain one at https://mozilla.org/MPL/2.0/. See [LICENSE](LICENSE).

"Strom" is the name of the original project ([stromapp.info](https://stromapp.info));
please give a modified version a name of its own.
