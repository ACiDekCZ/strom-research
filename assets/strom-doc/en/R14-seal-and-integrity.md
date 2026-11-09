<a id="R14"></a>
# R14 The seal and the integrity of a research

strom writes every change of a research as an operation into the logs of its history (`data/ops`) and seals it with
this computer's key, together with a commit in the research's history (git). `strom verify` compares every record and
commit with its seal and says what changed outside strom. The chapter describes which ways on strom offers, and in
detail accepting a research as it is (`strom seal accept`). It describes the research 1.30.1.

<!-- zdroj: research:39c56a89 strom help verify („seal check of every record and commit“), strom help repair, strom help seal adopt, strom help seal accept · src/core/accept.ts (záhlaví) · src/core/tree.ts commit (commitSeal klíčem tohoto počítače), requireKey · CHANGELOG.cs.md 1.30.1 · dirigent:spec/072-prijmout-stav/spec.md -->

<a id="R14.1"></a>
## R14.1 What does not match its seal, and the ways on

What `strom verify` finds decides which way to go on. A person runs each of them in their own terminal.

| What happened | Way | What it does |
|---|---|---|
| a record edited or created outside strom, the history (git) can be read | `strom repair` | restores the last sealed state: edited records are restored, records created outside strom are removed; copies of everything replaced are kept in `.strom/quarantine/` |
| a research sealed on another computer | `strom seal adopt` | checks the chain of operations and every record's hash, and creates this computer's key for the research |
| a lost history: the oldest logs of `data/ops` are gone and the history (git) cannot be read or there is none; the records are as strom wrote them | `strom seal accept` | puts nothing back and takes nothing over: seals the research as it is now as a new base ([R14.2](#R14.2)) |

- **Enforced by the code:**
  - with a history (git) that can be read, strom does not point to `strom seal accept`: `strom repair` puts the lost
    logs back from it;
  - with a damaged or missing history, `strom verify` and `strom check` report the finding `git-damaged` (“the history
    (git) cannot be read — objects of it are missing”, or that the research has no history) and for every file not
    matching its seal say: “the history (git) is damaged, strom repair cannot restore it — once the records are looked
    over, in a terminal of one's own: strom seal accept”;
  - a write into a research with a damaged history is refused with “the history (git) of the research is damaged:
    nothing written” (code `tree.git-damaged`) and the same advice, instead of git's error. Before, every write and
    `strom check` stopped on it.
- **Controls:** terminal: `strom verify`, `strom check`, `strom repair`, `strom seal adopt`, `strom seal accept`.
- **Since:** research 1.30.1

<!-- zdroj: research:39c56a89 src/core/accept.ts ACCEPT_HINT, acceptWay (jen bez .git nebo s git.damaged; čitelná historie → nic, strom repair vrátí logy), GIT_DAMAGED, guardOrDamaged · src/commands/checks.ts check a verify (acceptWay nad verifyFull) · src/core/integrity.ts assertIntact, gitDamagedError (tree.git-damaged) · src/cli/ui.ts ui.check.accept.hint, ui.error.tree.git-damaged(.hint) · strom help repair, strom help seal adopt · CHANGELOG.md 1.30.1 -->

<a id="R14.2"></a>
## R14.2 Accepting a research as it is: `strom seal accept`

A cloud drive (iCloud Drive, for one) can take the oldest logs of the history (`data/ops`) and objects of its history
(git) away from a research. The records stay as strom wrote them, but `strom verify` reports them as created or edited
outside strom, and `strom repair` has nothing to put back, or would return an older state. `strom seal accept` takes
the research as it is now as a new sealed base. A person decides, having looked the records over first.

- **Counts first:** without a yes, the command changes nothing. It lists what accepting would do:
  - records whose history is missing;
  - records newer than what is left of their history;
  - other files of the research (history, quality, `strom.json`) not sealed as they are;
  - how many logs of the history are in the folder;
  - the state of the history (git): **readable** (the change is added to it), **its last change not made by strom**
    (sealed again), **damaged** (moved aside whole, nothing deleted, a new one begun), **none** (a new one begun);
  - the iCloud copies of files that are moved aside, and those left where they are ([R14.2.1](#R14.2.1)).
- **The yes:** a person answers **Accept the research as it is now?** in their own terminal. The default answer is no.
- **The difference:** `strom repair` returns the last sealed state, `strom seal adopt` takes over a research sealed on
  another computer; `strom seal accept` puts nothing back and takes nothing over ([R14.1](#R14.1)).
- **Controls:** terminal: `strom seal accept --preview` (counts only, an agent may run it too), `strom seal accept`.
  It works in the Strom archive too.
- **Since:** research 1.30.1

<!-- zdroj: research:39c56a89 src/commands/checks.ts seal accept (planAccept → acceptSaid; preview nebo neinteraktivně jen počty, exit 4; confirm(ui.accept.ask, false)) · src/core/accept.ts AcceptPlan (unsealed, edited, other, logs, git ok|unsealed|damaged|missing, moveAside, copies) · src/cli/ui.ts ui.accept.title, unsealed, edited, other, logs, git.*, aside, copies, does, ask · src/cli/help.ts ARCHIVE_COMMANDS „seal accept“ · CHANGELOG.md 1.30.1 -->

<a id="R14.2.1"></a>
### R14.2.1 What accepting does

After the yes, one sealed change names every file not matching its seal as it is now: no record changed, nothing
deleted.

- **Enforced by the code:**
  - one signed operation (`seal.accept`) carries the hash of every such file, and strom keeps it in a sealed commit;
  - a damaged history (git) is moved aside whole into the folder `.git-damaged-<when>` beside the research and a new
    one is begun; the folder with the old history is not part of the new one. Without a history a new one is begun; a
    history that can be read only gets the change added;
  - iCloud's copies of files (“P0001 2.json”, say) in the folders `data/`, `history/` and `quality/`, and copies of
    locks in `.strom/`, are moved into `.strom/accepted-<when>/`; they are never sealed as records. Copies elsewhere in
    the research (beside `strom.json`, in `.strom/`, in `output/`) are only listed and left where they are;
  - at the end the full check runs again: “strom verify: ok — every record matches its seal”, or how many problems are
    left (“strom verify still finds problems: N”);
  - a second run does nothing: “nothing to accept — every record matches its seal”.
- **Since:** research 1.30.1

<!-- zdroj: research:39c56a89 src/core/accept.ts applyAccept (appendOp seal.accept files[path, sha], targets []; tree.commit; .git-damaged-<stamp>, git.initRepo, .git/info/exclude /.git-damaged-*/; .strom/accepted-<stamp>), cloudCopies (SEALED_DIRS data, history, quality; kopie zámků v .strom; kořen, .strom, output jen vypsat), isCloudCopy, nothingToAccept · src/commands/checks.ts (po přijetí verifyFull) · src/cli/ui.ts ui.accept.does, done, gitmoved, copiesmoved, verified, still, nothing -->

<a id="R14.2.2"></a>
### R14.2.2 What accepting guards and never settles

- **Enforced by the code:**
  - only a person accepts a research, in their own interactive terminal, through the same gate as `strom seal adopt`;
    `--yes` never accepts it (“--yes never accepts the research: a person decides at their own terminal”). Outside an
    interactive terminal the command lists only the counts and the sentence “Accepting the research as it is is a
    person's own decision, at their own terminal — strom seal accept”;
  - an agent may run `--preview` only; strom refuses accepting itself to an agent, and the agent tells the person the
    command;
  - nothing is accepted while the bridge to the Strom app runs on the research (`strom live stop`, then again) or
    somebody is at work on it (`strom session finish`, then again);
  - after the yes, strom makes the plan again under the research's lock; when the research changed since it was looked
    over, nothing is accepted (“the research changed since it was looked over: nothing accepted”);
  - a research sealed on another computer is taken over first (`strom seal adopt`);
  - accepting never settles the check's other findings: a log rewritten, an operation forged, another key, files only
    in the cloud, a record deleted, or a file in `data/` that is not a record strom can read. With such a finding
    nothing is accepted (“Not accepted: the check finds what accepting never settles”) and `strom verify` says the
    way.
- **Since:** research 1.30.1

<!-- zdroj: research:39c56a89 src/commands/checks.ts seal accept (agentMay jen --preview; ctx.yes → accept.yes; requireHuman jako seal adopt; liveRunning → accept.bridge; liveWorkers/runsAtWork → accept.busy; tree.requireKey) · src/core/accept.ts SETTLED (unsealed, manual-edit, history-edited, quality-edited, config-edited, foreign-commit), planAccept refused (jiné kódy; recordReadable), applyAccept samePlan → accept.changed · src/cli/help.ts HUMAN_COMMANDS · src/cli/ui.ts ui.accept.person, refused, ui.error.accept.* · strom help seal accept -->
