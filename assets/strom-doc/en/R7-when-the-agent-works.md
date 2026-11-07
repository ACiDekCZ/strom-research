<a id="R7"></a>
# R7 When and how long the agent works

How long the research agent works alone, when the next session starts, and why a run ends. Describes the research 1.25.2 and the Strom app 3.21.2. Changes from a later version carry its number.

<a id="R7.1"></a>
## R7.1 Working alone runs in sessions

When working alone, the agent takes tasks from the queue ([R2.2](R2-lines-and-queue.md#R2.2)) without a person. One
session is one task. A run starts one or more sessions in a row; between them it may ask the condition
([R7.4](#R7.4)).

- **Limits:**
  - without an option 1 session; `--max <n>` at most n; `--loop` session after session while there is work;
  - `--task T…`: the chosen tasks in the given order, each one session; a task done or taken meanwhile is skipped;
  - `--until HH:MM`: after it no session starts, one already running finishes. A time that has already passed today
    means tomorrow;
  - every run ends when no open task is left in the queue.
- **Controls:** terminal: the menu **Let the agent work on its own**, the choices **Work through the queue in this
  order – as many as chosen** (1–100, like `--max`), **Only the tasks picked from the list** (like `--task`) and
  **Let it work on while there is work and the condition “…” allows it** (like `--loop`, only with a condition
  set); the command `strom run`. The Strom app 3.21.2 does not set up working alone; it shows the state of the run
  ([R7.4](#R7.4)), and a session can be finished from it ([R7.3](#R7.3)).
- **Since:** research 1.0.0 (`--max`, `--until`, `--task`), `--loop` from 1.2.0

<!-- zdroj: research:src/commands/session.ts:737-783 (popis a volby run), :830 max, :694 parseUntil · src/cli/menu.ts:288-375 (v1.25.2) · cs.json ui.menu.run, ui.run.queue, ui.run.pick, ui.run.loop, ui.run.how -->

<a id="R7.1.1"></a>
### R7.1.1 Why a run ends

- At the end the run prints **N sessions · stopped: …**: **done**, **no open tasks**, **time limit**
  (`--until`), **by hand** ([R7.3](#R7.3)), **subscription limit** ([R7.6](#R7.6)), **the agent is not logged in**
  ([R7.7](#R7.7)), the condition's answer ([R7.4](#R7.4)), or an error (credentials, the agent failed, the model).
- When the remaining tasks need an archive that does not answer, a run with `--loop` and `--until` waits
  (**⏸ waiting until …**); any other run ends.
- **Since:** research 1.0.0; waiting for an archive that does not answer from 1.22.0

<!-- zdroj: research:src/commands/session.ts:853 Stop, :1220-1268, :1277-1285 · cs.json ui.run.summary, ui.run.stop.*, ui.run.asleep.wait · CHANGELOG.cs.md 1.22.0 -->

<a id="R7.2"></a>
## R7.2 Each session has a time limit

One session lasts at most the set number of minutes, 60 by default. The agent knows the end time in advance, and
strom reminds it. At the limit strom stops it and returns the unfinished task to the queue.

- **Limits:**
  - in the last 10 minutes (a short session: the last quarter) every `strom` command says how much time is left; in
    the last 3 minutes (a short session: the last eighth) it asks the agent to write what it found and close the
    session;
  - at the limit, an agent that can (Claude Code, Codex, OpenCode, Grok) gets 5 more minutes to write and close;
  - a task on which 2 sessions in a row wrote nothing is parked (**… parked**); sessions ended by a person do not
    count;
  - the order: `--minutes` > the variable `STROM_RUN_MINUTES` > the family tree's setting > the computer's setting
    > 60.
- **Controls:** terminal: **Settings: the agent, working alone, messages, archives, maintenance → The agent working
  alone → Time for one task: N min** (5–600; 0 goes back without a change); `strom config set run.minutes <n>`
  (`--for-tree`: only this family tree). App: nothing.
- **Since:** research 1.0.0 (60 minutes, parking a task); reminders and 5 minutes to write from 1.2.0

<!-- zdroj: research:src/core/config.ts:223 DEFAULT_RUN_MINUTES=60, run.minutes tree:true · src/core/clock.ts REMIND_MS, CLOSE_MS, WRAP_UP_MS, clockLine :103-118 · session.ts:705 MAX_IDLE_SESSIONS=2, :750 popis · src/cli/menu-settings.ts:300-317 (v1.25.2) · cs.json ui.alone.minutes, ui.alone.minutes.ask, ui.run.parked -->

<a id="R7.3"></a>
## R7.3 A session can be asked to finish

A person can ask a running session to end. The agent starts nothing new, writes what it found, and closes the
session. Then the run ends and no further session starts. Nothing is stopped by force.

- **Limits:**
  - the agent sees the request at its next `strom` command; a new reader does not start, and strom does not stop
    a subagent's work halfway;
  - Ctrl-C in the run's terminal: the first time the same request, the second time an immediate stop (the task
    returns to the queue). On Windows and with `--interactive`, the first Ctrl-C stops at once.
- **Controls:** terminal: `strom session finish [N…]` (when more sessions run, name which), Ctrl-C. App: **Research
  overview**, at the working agent **Finish and stop**; it is confirmed in the research's terminal. When the run
  waits for the condition, the button is not there.
- **Since:** research 1.8.0, app 3.5.0

<!-- zdroj: research:src/commands/session.ts:198-221 session finish, :865 onSignal, :1194 askedToFinish · src/core/clock.ts askFinish, refuseReadersWhenFinishing · runners/runner.ts:296 OWN_GROUP · src/cli/menu-links.ts:473 finishSession · app:v3.21.2 research-overview-ui.ts:810,868 (!w.paused) · strings.ts live.finishSession -->

<a id="R7.4"></a>
## R7.4 A condition decides whether the next session starts

A condition is a program strom asks before a session: go on, wait, or stop. Only a person sets it, for the whole
computer. Without a condition the run goes on while there is work.

- **Limits:**
  - **go on**: the session starts; **wait**: the run waits and asks again; **stop**: the run ends. Anything else (the
    program crashes, no answer within 120 s, `claude-usage` 660 s) is an error and the run ends;
  - when to ask again is said by the condition; otherwise in 15 minutes, never sooner than in 1 minute. Ctrl-C ends
    the waiting; with `--until` the given time ends it (**time limit**);
  - `--loop` and `--until`: a question before each session; tasks started by hand: one question ([R7.4.1](#R7.4.1));
  - strom ships the condition `claude-usage` ([R7.5](#R7.5)); an own condition is a folder
    `plugins/gates/<name>/`;
  - a run without the condition set (`--no-gate`) or with another one (`--gate`) needs a person's consent.
- **Controls:** terminal: **Settings → The agent working alone → Working on and on under a condition: …**
  (a condition, or **none**); `strom config set run.gate "<name> [what to give it]"`, `strom config unset run.gate`;
  a person confirms both. App: **Research overview** shows **Paused** and **resumes at …** at a waiting run.
- **Since:** research 1.2.0, app 3.5.0 (the state Paused)

<!-- zdroj: research:src/core/gate.ts:27-34 DEFAULT_TIMEOUT_S, DEFAULT_WAIT_MS, MIN_WAIT_MS, askGate :209-254, SHIPPED :124 · session.ts:911 gateHolds, :1038-1063 wait, markPaused, runGate :1357-1380 · config.ts run.gate tree:false · setup.ts:1537-1548 · app:v3.21.2 research-overview-ui.ts:340-347, strings.ts live.statePaused, live.pausedUntil -->

<a id="R7.4.1"></a>
### R7.4.1 Tasks started by hand: “Start anyway?”

- One session, `--max`, `--task` and the menu are a person's choice. The condition is asked once, before the first
  session. When it would not start (wait, stop, error), the question **The condition “…” would not start now —
  …. Start anyway?** comes up. Enter means no: the run ends (**not started — the condition “…”:
  …**). Yes: the sessions start and the condition is not asked again, except for the cap
  ([R7.4.2](#R7.4.2)).
- When the agent starts the run, a person answers in a system window. A script that no one can be asked keeps to the
  condition.
- **Since:** research 1.2.0

<!-- zdroj: research:src/commands/session.ts:1027-1037, startAnyway :1400-1411 · cs.json ui.run.gate.once, ui.run.gate.anyway, ui.run.stop.gate.declined -->

<a id="R7.4.2"></a>
### R7.4.2 The cap: a hard limit

- A condition can mark its answer as a person's hard limit (`hard`). The run then ends (**the cap of the condition
  “…”**), and no “anyway” goes past it.
- A condition can watch the agent's plan window (`watch`). It is then asked before each session of every run, and
  a session at work gets a request to finish ([R7.3](#R7.3)) when the agent reports the window's use at the given
  limit.
- **Since:** research 1.14.0

<!-- zdroj: research:src/core/gate.ts:64-71 hard, watch, parseSaid :330-348 · session.ts:1012-1026, onLimits :1175-1182 · cs.json ui.run.gate.cap, ui.run.cap.finish, ui.run.stop.gate.cap -->

<a id="R7.4.3"></a>
### R7.4.3 The record of the condition's answers

- Each answer has a line in the run's output: **· condition …: … (exit …; .strom/gate.log)**: the condition's name, its answer with the reason and the code.
- At the same time a JSON line in the family tree's `.strom/gate.log`: when, the condition and what was given to it,
  the exit code, the verdict, the reason, the waiting, the plan's limits and what the run did (`go`, `wait`, `stop`,
  `anyway`). It is kept for 90 days, at most 2 MB.
- **Controls:** terminal: **The agent working alone → What would the condition say now?**, `strom gate test`.
- **Since:** research 1.14.0 (the record); the question from the menu from 1.3.0

<!-- zdroj: research:src/core/gate.ts GATE_LOG, GateRecord :264-287, recordGate :311 · session.ts:1003-1007, :1069-1078 · src/core/tidy.ts:49 gate {days: 90, bytes: 2 MB} · menu-settings.ts:432-452 (v1.25.2) -->

<a id="R7.5"></a>
## R7.5 The claude-usage condition keeps the week's pace

`claude-usage` keeps working alone within the weekly limit of the Claude subscription. It compares how many percent
of the week have passed since it reset (a day ≈ 14.3 %) with the week's usage. A session starts only when the lead
(passed − used) is at least the given number n.

- **Limits:** the steps go in this order; the first that applies decides:
  1. n is not a whole number 0–99, or the cap is not a whole number 1–100: stop (every run);
  2. the agent is not Claude Code, or Claude Code runs on an API key: go on;
  3. the usage from the agent's report in this run (at most 15 minutes old), otherwise from `claude -p /usage`.
     Cannot be read: 3 attempts 30 s apart, then wait 15 minutes. Claude Code is not logged in: stop ([R7.7](#R7.7));
  4. a week without a reset time: used 0 % → go on, otherwise wait 15 minutes;
  5. used ≥ the cap: stop, hard ([R7.5.4](#R7.5.4));
  6. the five-hour window used up (100 %): wait until it resets, plus 1 minute;
  7. the lead ≥ what is needed ([R7.5.1](#R7.5.1)), after waiting with the extra ([R7.5.2](#R7.5.2)): go on;
  8. the last 2 hours before the week resets, and at least 10 points left to 100 % (or to the cap): go on;
  9. otherwise wait ([R7.5.3](#R7.5.3)).
- **Controls:** terminal: **Working on and on under a condition** → **Claude usage** → enter n (offers 10; only with
  Claude Code on the computer); `strom config set run.gate "claude-usage 10"`. Without a number, 0 applies.
- **Since:** research 1.2.0; unreadable usage and not being logged in from 1.25.2
- **From research 1.26.0:** the menu and `strom config set` accept only a whole n 0–99 (in 1.25.2 also a decimal, which then
  stops the run).

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts (v1.25.2 = HEAD) :209-312, FRESH_MS, ATTEMPTS=3, RETRY_MS=30 s, UNREAD_WAIT=15 min, AFTER_RESET=60 s, END_WINDOW=2 h, SESSION_POINTS=10 · gate.json timeout 660 · menu-settings.ts:322-357 (v1.25.2) · HEAD src/core/gate.ts pointsProblem -->

<a id="R7.5.1"></a>
### R7.5.1 The start of the week

- What is needed is the smaller of n and half the part of the week passed; the whole n holds from 2·n % of the week.
  Right after the reset a session starts. An example: n = 10, 12 % passed → 6 needed; a session starts at a usage of
  at most 6 %.
- **Since:** research 1.15.0

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts:280 need = min(min, gone/2) · CHANGELOG.cs.md 1.15.0 -->

<a id="R7.5.2"></a>
### R7.5.2 The extra after waiting

- When the condition waited because the lead was small, it lets a session through again only with an extra of
  2 points (at 15: a lead of 17), proportionally smaller at the start of the week (2 · needed / n). Then it lets
  sessions through one after another until the lead drops below what is needed.
- It remembers the week of waiting in `hold.json` in its folder; a new week starts without the extra.
- **Since:** research 1.22.0

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts RESERVE=2 :71, reserve :287, holding/hold :368-387 · CHANGELOG.cs.md 1.22.0 -->

<a id="R7.5.3"></a>
### R7.5.3 How long it waits

- Until the first of these moments: the week catches up with the lead plus the extra; the last 2 hours of the week
  begin (only when at least 10 points are left to 100 % or to the cap); the week resets (plus 1 minute). Never past the
  reset, always at least 5 minutes.
- The answer says the usage, the part passed, the lead, and what lead it waits for.
- **Since:** research 1.2.0; the last 2 hours from 1.15.0

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts:294-312 (caught, last, after, now + 5 min), T.cs head, hold -->

<a id="R7.5.4"></a>
### R7.5.4 The week's cap

- `claude-usage 10 --cap 95`: at a week's usage of 95 % or more no session starts, in no run, not even after “Start
  anyway?”. The run ends and says the usage and when the week resets.
- It is asked before each session of every run ([R7.4.2](#R7.4.2)). A running session gets a request to finish only
  at 99 % of the week, even when the cap is lower. `--cap` without n: the cap holds, and the pace with n = 0.
- **Controls:** terminal: `strom config set run.gate "claude-usage 10 --cap 95"`. The menu does not accept a cap in
  1.25.2; it does from 1.26.0.
- **Since:** research 1.14.0
- **From research 1.26.0:** a running session gets the request to finish already at the cap (`--cap 95`: at 95 %
  of the week; `--cap 100`: at 99 %).

<!-- zdroj: research:assets/plugins/gates/claude-usage/gate.ts:213-219 --cap, :271-272 cap hard, FINISH_AT=0.99 :54, answer() watch :204 · src/core/gate.ts capProblem :159 · menu-settings.ts:350 (v1.25.2) · 1.26.0: gate.ts finish min(0.99, cap/100) (commit 6276a16f) -->

<a id="R7.6"></a>
## R7.6 The subscription limit stops the run

When the agent runs into the limit of its subscription during a session, the session closes and the run ends:
**subscription limit (resets …)**. The run does not wait, not even with `--loop`. This does not depend on the
condition.

- **Limits:** the task returns to the queue; the reset time shows only when the agent said it. Only a condition can
  wait.
- **Since:** research 1.0.0

<!-- zdroj: research:src/commands/session.ts:1196-1206 closeSession (session.limit), :1255-1259 · src/core/session.ts:248-262 · runners/runner.ts:226 looksLikeLimit · cs.json ui.run.stop.limit, ui.run.stop.resets -->

<a id="R7.7"></a>
## R7.7 An agent not logged in

An agent that is not logged in to its subscription does not do a session. The run ends: **the agent is not logged
in — run … once and log in**.

- **Limits:**
  - before the first session strom checks this only for Claude Code with a separate folder
    (`agent.claudeConfigDir` or `CLAUDE_CONFIG_DIR`, other than `~/.claude`). The run then ends without a session and
    without asking the condition;
  - otherwise the `claude-usage` condition finds it (it stops; for a run by hand **Start anyway?** comes up,
    [R7.4.1](#R7.4.1)), or a session that ends with a login error.
- **Since:** research 1.25.2; stopping after a session with a login error from 1.0.0

<!-- zdroj: research:src/commands/session.ts:916 loggedOut, :1260-1264 auth · src/core/claudedir.ts claudeConfigSet :33, forClaude, claudeLoggedIn :91 · gate.ts:253-258 loggedIn · CHANGELOG.cs.md 1.25.2 -->

<a id="R7.8"></a>
## R7.8 Strom archive: a research the agent does not work on

A research can be only a **Strom archive**: the data are entered in the Strom app, and the research keeps them with
their sources, originals and history. The agent does not work on it and researches nothing. Only a person switches
the archive on and off, either way; nothing is deleted in doing so.

- **Enforced by the code:**
  - the agent's work is refused in an archive: a chat (`strom chat`), working alone, a new line, a person review,
    reading scans (`strom read`, `strom clips`, `strom transcripts`), reading a document, identifying places. The
    refusal says in one sentence where research is switched on;
  - switching to an archive parks the open, started and waiting tasks with the reason “kept for later: the research
    is a Strom archive”. A new task in an archive waits parked. When research is switched on, the tasks return to
    where they were: to the queue, or back to waiting for a person;
  - the research cannot be switched to an archive while someone is working on it. The session finishes first;
  - switching research on without an agent on the computer offers to install one. Without an agent the archive stays
    as it was;
  - a person confirms the switch; the agent does not make it.
- What the app sends to an archive is entered as it comes: [S2.4](S2-edits-from-the-app.md#S2.4). How the app shows
  an archive: [S1.3](S1-connecting-app-and-research.md#S1.3).
- **Why:** an archive is for a family tree without an AI agent: the data from the app have their history, sources and
  a backup (`strom pack`), and nothing is paid for reading (the code, CHANGELOG 1.20.0).
- **Controls:** terminal: the research's menu, the first item; `strom mode` (shows it), `strom mode archive`, `strom mode
  research`. For new researches `strom setup` asks (**What should a new research on this computer be?**); it is changed
  by **Settings → New researches: research, or only a Strom archive**.
- **Since:** research 1.12.0; the choice for new researches also with an agent on the computer 1.15.0; reading scans
  refused 1.20.0

<!-- zdroj: research:src/core/mode.ts (hlavička, switchMode, holdForArchive, heldInArchive) · research:src/core/state.ts refuseInArchive · research:src/commands/trees.ts strom mode (liveWorkers, agentReady, requireHuman "mode") · refuseInArchive v session.ts:805 (run), start.ts (chat), research.ts (research new, review), document.ts, placeid.ts, calibrate.ts · cs.json archive.held, ui.mode.*, ui.archive.refuse · CHANGELOG 1.15.0, 1.20.0 · switchMode od v1.12.0 -->

<a id="R7.8.1"></a>
### R7.8.1 A research waiting for an agent

A research whose agent is not on this computer (not installed, or the research was moved from another computer) waits
for it. Until then it behaves as a Strom archive.

- **Enforced by the code:**
  - what the app sends is entered as in an archive; nothing is made for the agent, and the agent's work is refused
    with a sentence saying that the research waits for an agent and where to install it or choose another;
  - the saved mode does not change and the tasks are not parked. Once the agent is installed, the research goes on by
    itself with the tasks it had;
  - an agent that is working in the research right now (even one other than the one set) makes it a research.
- **Why:** an archive is the person's choice and strom does not record it for them. A research without an agent only
  behaves as an archive, so once the agent is installed it goes on by itself with the tasks it had; none is parked.
- **Controls:** terminal: the menu, the first item (**Keep it only as a Strom archive: keeping the data from the Strom
  app**, or installing the agent); `strom mode` shows the state. The app shows such a research as **Archive**
  ([S1.3](S1-connecting-app-and-research.md#S1.3)).
- **Since:** research 1.15.0

<!-- zdroj: research:src/core/state.ts (hlavička, stateOf, actsAsArchive, kindOf, refuseInArchive agent.missing) · cs.json ui.mode.is.waiting, ui.waiting.refuse, ui.menu.keeparchive · CHANGELOG 1.15.0 -->
