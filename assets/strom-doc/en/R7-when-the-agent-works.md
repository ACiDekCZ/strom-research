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
- **From research 1.32.0:** `--tasks <n>` (1–100) ends after n tasks dealt with: done, waiting for a person, parked or
  dropped after their session (also a task the run parked because it got stuck on it). An unfinished task that goes
  back to the queue (the agent did not finish it, the time limit, an interruption) does not count. At most 2×n
  sessions. `--tasks` does not go with `--max`, `--loop`, `--task`, `--until` or any other choice of the tasks. The
  condition is asked once, as with `--max` ([R7.4.1](#R7.4.1)). Work on the queue from a Strom app link:
  [R7.1.2](#R7.1.2).

<!-- zdroj: research:src/commands/session.ts:737-783 (popis a volby run), :830 max, :694 parseUntil · src/cli/menu.ts:288-375 (v1.25.2) · cs.json ui.menu.run, ui.run.queue, ui.run.pick, ui.run.loop, ui.run.how · 1.32.0: src/commands/session.ts TASKS_MAX=100, SETTLED (done, waiting, parked, dropped), --tasks (max = 2×n, odmítnutí s --max, --loop, --task, --until a dalšími volbami výběru), popis run · CHANGELOG.cs.md 1.32.0 · spec 052 K6.3 -->

<a id="R7.1.1"></a>
### R7.1.1 Why a run ends

- At the end the run prints **N sessions · stopped: …**: **done**, **no open tasks**, **time limit**
  (`--until`), **by hand** ([R7.3](#R7.3)), **subscription limit** ([R7.6](#R7.6)), **the agent is not logged in**
  ([R7.7](#R7.7)), the condition's answer ([R7.4](#R7.4)), or an error (credentials, the agent failed, the model).
- When the remaining tasks need an archive that does not answer, a run with `--loop` and `--until` waits
  (**⏸ waiting until …**); any other run ends.
- **Since:** research 1.0.0; waiting for an archive that does not answer from 1.22.0
- **From research 1.32.0:** a run with `--tasks` ends with **N tasks dealt with**, or after 2×n sessions with
  **sessions: … (the most for the tasks asked) — tasks dealt with: …**.
- **From research 1.36.0:** a run left only with tasks on a restricted archive that another session uses waits at
  most `archive.wait` and ends with **nothing else to do — the tasks left need the archive …**
  ([R9.13](R9-archives.md#R9.13)).

<!-- zdroj: research:src/commands/session.ts:853 Stop, :1220-1268, :1277-1285 · cs.json ui.run.summary, ui.run.stop.*, ui.run.asleep.wait · CHANGELOG.cs.md 1.22.0 · 1.32.0: session.ts Stop tasks|sessions, cs.json ui.run.stop.tasks, ui.run.stop.sessions -->

<a id="R7.1.2"></a>
### R7.1.2 Work on the queue from a Strom app link

- With the link `strom-research://work` the Strom app can ask for the agent's work alone on the queue: a number of
  tasks, or work for as long as there is something to do. The link opens the research's terminal
  ([S4.5](S4-research-from-the-app.md#S4.5)). The terminal shows what would start and starts it only on a yes; the
  default answer is no.
- **Limits:**
  - the terminal shows the first 5 tasks in the order `strom run` takes them (a task chosen **Do next** first), how
    many more there are, when the run ends, the session's time limit and the condition ([R7.4](#R7.4));
  - the number of tasks is 1–100, 5 when none is given. It starts `strom run --tasks N` ([R7.1](#R7.1)); the
    condition is asked once, before the first session;
  - work for as long as there is something to do runs only under a condition and starts `strom run --loop`. With no
    condition set nothing starts: instead the terminal offers a number of tasks, setting a condition, or nothing (the
    default);
  - when a run or a session is already at work on the research, nothing more starts. Nor with an empty queue. When
    the agent's terminal program is missing on the computer, the terminal says so before it asks anything;
  - the run goes on in the same terminal window. Ctrl-C asks the session at work to finish and stops the run
    ([R7.3](#R7.3)); the rest stays in the queue;
  - the bridge does not start the agent's work, only the terminal after the yes.
- **Controls:** a link from the Strom app (`strom-research://work` with `do=tasks` and `n`, or `do=loop`), in the app
  3.28.0 **Work on the queue…** ([S4.2.3](S4-research-from-the-app.md#S4.2.3)); terminal:
  `strom link open "<link>"`.
- **Since:** research 1.32.0
- **From research 1.36.0:** with **Starting the agent from the Strom app: without the question** the work starts
  without asking for a yes; the condition still asks ([S4.5.5](S4-research-from-the-app.md#S4.5.5)).
- **From research 1.36.0:** the link can name tasks (`do=tasks` with `task=T…,T…`, task numbers only, at most 100,
  never with `n`): **Process now** after a trial of verification ([S7.5.1](S7-reliability-and-verification.md#S7.5.1)).
  The terminal shows “These tasks, in this order:” and “One session for each task (N sessions), then it ends; what is
  not finished goes back to the queue.” After a yes it starts `strom run --task` with those tasks in the link's
  order. Tasks that no longer wait (done, taken back or held by another) are left out and their number said; when
  none waits, nothing starts.

<!-- zdroj: 1.36.0: research:7116bb60 src/cli/menu-links.ts workOn, src/core/links.ts (task= jen s do=tasks, ne s n, 1–LINK_WORK_MAX) · cs.json ui.link.work.picked.* · research:src/cli/menu-links.ts workRun (WORK_LIST=5, agentCliHere, busyIn, taskQueue s RUN_TURNS, loop jen s run.gate, choose výchozí „Teď nic“, asks … false, run --tasks | --loop) · src/core/links.ts LINK_WORK_DOS, LINK_WORK_MAX=100, LINK_WORK_DEFAULT=5 · src/commands/links.ts case "work" · cs.json ui.link.work.*, ui.link.what.work.*, ui.run.next, ui.run.limit, ui.link.cost · CHANGELOG.cs.md 1.32.0 · spec 052 K6.2 (cesta terminál, most agenta nespouští) -->

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
- **From research 1.36.0:** a run can also be stopped from outside and on its own, `strom run stop <run-…>
  [--finish]`; with more runs, each has its own **Finish and stop** in the app ([R7.10.2](#R7.10.2)).

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
**subscription limit (resets …)**. Up to research 1.33.0 the run does not wait, not even with `--loop`, and this does
not depend on the condition; from 1.34.0 see below.

- **Limits:** the task returns to the queue; the reset time shows only when the agent said it. Only a condition can
  wait.
- **Since:** research 1.0.0
- **From research 1.34.0:** a run that goes on by itself (`--loop`, `--until`) and has a condition ([R7.4](#R7.4))
  does not end after the limit. The task returns to the queue (another one may come next), the run waits until the
  limit resets and a minute more, then asks the condition again and goes on. Terminal: “⏸ the agent's plan limit is
  used up (five-hour window): waiting until it resets (…), then the condition is asked again and the work goes on
  (Ctrl-C ends the run)”; the Strom app shows the run as paused with the reason.
  - the reset time: from the agent's report of the used-up window of the plan (five-hour window, week; both used up:
    the later of them), otherwise from the time the agent said (a date and time, “in 2 hours”, “7pm” only in the
    computer's time zone). A time more than 8 days ahead or in the past is not taken. An unknown time: the run waits
    15 minutes (“…, when it resets not said: waiting until …, then the condition is asked again”);
  - the reset only after the `--until` time: the run ends with **time limit**;
  - a session interrupted by the limit does not count for the task as a failure of the agent;
  - unchanged: a manual run (one task, `--tasks n`, `--max` without `--loop`) and a run without a condition end with
    **subscription limit** as before. The Claude Code message “You've hit your limit · resets …” and a refusal of
    the agent because of the limit are taken as the limit.
- **From research 1.36.0:** a limit hit by one run stops new sessions of all runs of the same agent on the computer
  ([R7.10.3](#R7.10.3)).

<!-- zdroj: research:src/commands/session.ts:1196-1206 closeSession (session.limit), :1255-1259 · src/core/session.ts:248-262 · runners/runner.ts:226 looksLikeLimit · cs.json ui.run.stop.limit, ui.run.stop.resets · 1.34.0: research:8f24e9f7 src/commands/session.ts:1453-1483 (gateHolds && gate, limitResume, limitReserve, DEFAULT_WAIT_MS 15 min, until → time, markPaused), :1363 metrics.limit, src/core/planlimit.ts limitResume, timeOf, LIMIT_RESERVE_MS 60 s, FURTHEST_MS · 03146702 (B8: „You've hit your limit“, odmítnutý rate_limit_event) · cs.json ui.run.limit.wait, ui.run.limit.unknown, ui.run.limit.why, ui.run.limit.five_hour, ui.run.limit.seven_day · dirigent:prace/1115-vyzkum-k036-limit-obnova -->

<a id="R7.7"></a>
## R7.7 An agent not logged in

An agent that is not logged in to its subscription does not do a session. The run ends: **the agent is not logged
in — run … once and log in**.

- **Limits:**
  - before the first session strom checks this for Claude Code: up to research 1.33.0 only with a separate folder
    (`agent.claudeConfigDir` or `CLAUDE_CONFIG_DIR`, other than `~/.claude`), from 1.34.0 with the default one too.
    The run then ends without a session and without asking the condition;
  - otherwise the `claude-usage` condition finds it (it stops; for a run by hand **Start anyway?** comes up,
    [R7.4.1](#R7.4.1)), or a session that ends with a login error.
- **Since:** research 1.25.2; stopping after a session with a login error from 1.0.0
- **From research 1.34.0:** Claude Code in the terminal, which strom starts by itself (working alone, the readers of
  scans and documents, [R8.3](R8-reading-scans.md#R8.3)), has a login of its own, not the Claude app's. When
  `claude auth status` says it is not logged in:
  - `strom read` and the other reading by readers (clips, transcripts, a document from the app) start no reader and
    end at once: **Claude Code in the terminal is not logged in — … starts it itself (not the Claude app, which has
    its own login)**, with the hint **logging in once in a terminal: …, then /login**;
  - a reader that ends with a login error says so with how to log in, as it goes and in the summary, never only
    “auth”;
  - `strom doctor` has a line of its own **Claude Code login**: **Claude Code in the terminal logged in**, or the
    warning **Claude Code in the terminal is not logged in — …** with the fix **… in a terminal, then /login**. In
    a Strom archive the login is neither checked nor said.

  An answer that does not tell the login decides nothing. Terminal: `claude`, then `/login`; `strom doctor`.
- **From research 1.35.0:** a login check that does not answer within 5 s decides nothing and ends everything it
  started, on Windows too, where the agent's program could go on running before.

<!-- zdroj: research:src/commands/session.ts:916 loggedOut, :1260-1264 auth · src/core/claudedir.ts claudeConfigSet :33, forClaude, claudeLoggedIn :91 · gate.ts:253-258 loggedIn · CHANGELOG.cs.md 1.25.2 · 1.34.0 (K040): src/core/agentcli.ts requireClaudeLogin, agentLoggedOut (agent.logged-out) · src/commands/readers.ts refuseReadersLoggedOut, readerAuthSaid · src/commands/read.ts · src/commands/session.ts loggedOut bez claudeConfigSet · src/commands/setup.ts doctor login (ne v archivu) · assets/lang/*.json ui.read.auth, ui.doc.login*, ui.error.agent.logged-out* · CHANGELOG 1.34.0 · 1.35.0: research:bb79ee54 src/core/claudedir.ts AUTH_STATUS_MS 5000, claudeLoggedIn přes src/core/runsync.ts runSync (win32 taskkill /T /F, jinde skupina procesů) · CHANGELOG.cs.md 1.35.0 „Windows: po kontrole přihlášení nic neběží dál“ -->

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
  - what the app sends is entered as in an archive; the agent gets nothing, and the agent's work is refused
    with a sentence saying that the research waits for an agent and where to install it or choose another;
  - the saved mode does not change and the tasks the research had are not parked. Once the agent is installed, the research goes on by
    itself with the tasks it had;
  - an agent that is working in the research right now (even one other than the one set) makes it a research.
- **Why:** an archive is the person's choice and strom does not record it for them. A research without an agent only
  behaves as an archive, so once the agent is installed it goes on by itself with the tasks it had.
- **Controls:** terminal: the menu, the first item (**Keep it only as a Strom archive: keeping the data from the Strom
  app**, or installing the agent); `strom mode` shows the state. The app shows such a research as **Archive**
  ([S1.3](S1-connecting-app-and-research.md#S1.3)).
- **Since:** research 1.15.0; 1.35.0: new tasks put aside
- **From research 1.35.0:** a task that comes meanwhile (for material sent, a scan to read) is made put aside, as in
  an archive. It comes back to the queue as soon as an agent starts working on the research (session start,
  `strom run`, chat; even another than the one set), or when the agent set is on the computer again.

<!-- zdroj: research:src/core/state.ts (hlavička, stateOf, actsAsArchive, kindOf, refuseInArchive agent.missing) · cs.json ui.mode.is.waiting, ui.waiting.refuse, ui.menu.keeparchive · CHANGELOG 1.15.0 · 1.35.0: research:31def74a src/core/state.ts heldWhereNobody (parked, heldBy archive, waiting.held), settleWaiting (atWork: session start, run, chat; jinak stateOf research) · src/core/records.ts create · CHANGELOG.cs.md 1.35.0 „Rodinný materiál … odložený, dokud tu agent není“ -->

<a id="R7.9"></a>
## R7.9 A task is held by the session working on it

Several agents can work on one research at once: working alone (`strom run`), a conversation (`strom chat`), an agent
that calls `strom` directly in its own terminal, and another computer over the same research. A task always has only
one worker: the open session holds it while its agent gives a sign of life. An abandoned task is released by itself.

- **Enforced by the code:**
  - choosing a task and claiming it happen at once. When two want the same task, one of them gets it; the other takes
    the next free one. This applies to `strom run`, `strom chat`, `strom session start`, `strom task start`, a link
    from the Strom app and an agent that works directly;
  - a sign of life: the process of a run or a conversation that strom started, on this computer; otherwise every
    `strom` command of that session. The research recognises an agent that works directly by the number of its
    conversation (Claude Code, Codex…): two such agents each have a session of their own;
  - with no sign of life for longer than `task.hold` (default 30 min) the hold lapses. When the holder's process on
    this computer has ended, it lapses at once;
  - a lapsed session is taken over by one taker only. The old session is closed as interrupted with the note “taken
    over after N minutes without a sign of life; work in progress in N…”; what was written in it stays, and the task
    goes back to the queue;
  - an old holder that wakes up after the takeover (a computer put to sleep, a stopped process) writes nothing more:
    a writing command is refused and says which session took the task over and when. It may still read. `strom task
    done` and other writes to a task that another session holds are refused;
  - whoever wants a task that another session holds gets one sentence: “T12 is held by Claude Code (session N0040)
    since 14:05, last sign of life 14:31; free by 15:01 at the latest.” When a live process on this computer holds
    it, in place of the time stands “free when it ends”. `strom run` takes the next free task, `strom session start
    T…` is refused with an offer of the next one (`strom task next`). There is no waiting for the release;
  - `strom run` takes over lapsed sessions at the start of each session and leaves out tasks that another session
    holds (“T12 left out: another agent is working on it”).
- **Method only:** an agent that works directly gives a `strom` command at least once every 20 minutes; a long
  reading of scans without one would release the task.
- **Limits:**
  - the time comes from the same computer; for a research on a shared disk from another computer only the last sign
    of life decides. With clocks out of step a reservation holds rather longer, it never doubles;
  - an older strom beside this one does not hold tasks: the new strom judges its sessions by its run and by the last
    write, otherwise from the start of the session;
  - none of this is in the research's data; the hold is only a local state beside the research.
- **In the app:** who holds a task and until when is shown by the Research overview
  ([S4.1](S4-research-from-the-app.md#S4.1), [S4.2](S4-research-from-the-app.md#S4.2)).
- **Controls:** terminal: `strom config set task.hold <minutes>` (e.g. `45m`, `2h`; 5 min to 24 h, applies to this
  computer, not to one research), `strom task next`; the menu shows in the line about work the agents that work
  directly too (“An agent is working directly in the research right now.”).
- **Since:** research 1.36.0

<!-- zdroj: research:1e58aa7b, f08b6574, 23b20c27 src/core/holds.ts (Hold by run|chat|agent, agentSession, BEAT_MS 60 s, holdAlive: proces tady mrtvý → hned, jinak lastSign < task.hold; lastSign max(beat, mtime), budoucnost jako teď; sessionLife: bez holdu worker, run.lock, ops logy, jinak start) · src/core/session.ts claimTask, takeOver (session.taken: „převzato po … bez známky života; rozdělaná práce v …“), :574 session.taken · src/core/errors.ts:122 task.held, task.held.here · src/commands/session.ts:217-225 (session start: sign of life, at least once every 20 minutes, task.held), :985-997 (run: vynechá držené, převzetí na začátku sezení) · src/brief/brief.ts:1668, src/commands/guide.ts:152 (aspoň jednou za 20 minut) · src/core/config.ts:242-246, :335 task.hold (tree: false, 5 min–24 h, výchozí 30) · ověřeno: strom config set task.hold 3 / 25h / --for-tree odmítnuto (izolovaně) · cs.json ui.error.task.held(.here), ui.error.session.taken, ui.run.skip.held, ui.menu.working.direct(.more), session.taken · CHANGELOG.cs.md 1.36.0 „Více agentů a výzkumů najednou“ · dirigent:spec/127 K1.1–K1.5, K5.1–K5.3, navrh-rezervace.md kap. 1–4, 6 -->

<a id="R7.10"></a>
## R7.10 A run of a line: each line can have a run of its own

Working alone ([R7.1](#R7.1)) can be started on one line (`strom run --research G…`). Each line has at most one run.
The runs of different lines and the run of the whole queue work side by side, each on other tasks.

- **Enforced by the code:**
  - a run of a line holds its line while its process lives. A second run of the same line is refused at once with
    one sentence: “The line Ancestors of Jan Horák has a run already (since 14:05) — one run per line. It can be
    stopped in its own window.”;
  - a run of a line takes the tasks whose main line is its own. A task's main line is its own line, and when that
    one has ended, the narrowest active line of its people ([R2.1.3](R2-lines-and-queue.md#R2.1.3)). It also takes
    shared tasks (a common ancestor, help to another line, [R2.3](R2-lines-and-queue.md#R2.3)) whose main line has no
    run of its own. A task whose main line is held by another run it never takes;
  - the run of the whole queue leaves out every task of a line that has a run of its own, and also a shared task
    whose people belong to such a line. Work outside the lines, local history and places stay with it;
  - this is judged at every choice of a task, before the task is claimed ([R7.9](#R7.9)). A task another session is
    already working on is not taken over: the session at work finishes it;
  - conversations (`strom chat`) do not hold a line and do not count among the runs ([R7.10.1](#R7.10.1));
  - a run of a line does not start beside a run of a strom older than 1.25. Beside a run of a newer strom that does
    not know lines it starts and says so: that one may take tasks of this line too, but never the one at work.
- **Limits:**
  - a run of a line has its own terminal window with the title “Strom · Horáks · Ancestors of Jan Horák (G0002)”;
    the agent names its session after the line. Meanwhile a run of another line can be started from the menu;
  - the window of the same line does not open again right after the first one (“A window for the line … opened a
    moment ago — the run goes on there.”);
  - only an active line: neither a paused nor an ended line gets a run ([R2.1.2](R2-lines-and-queue.md#R2.1.2));
  - the research remembers the agent the line last ran with and offers it next time in the menu and in the app;
  - the warning at a run beside another run says that the subscription use adds up.
- **In the app:** **Put an agent on this direction** ([S4.3.3](S4-research-from-the-app.md#S4.3.3)); runs in the
  section **Now** ([S4.1.8](S4-research-from-the-app.md#S4.1.8)).
- **Controls:** terminal: the menu **Let the agent work on its own**; with two or more active lines it asks **Work on
  what?**: **the whole queue (the lines with a run of their own aside)**, or a line (“— in a window of its own”; a
  line with a run “— has a run already” and does not start). The command `strom run --research G…` (with the further
  options of [R7.1](#R7.1)); `strom research list` shows the numbers of the lines.
- **Since:** research 1.36.0

<!-- zdroj: research:089875ec src/core/linerun.ts (lineHolds .strom/lines/<G>.json zámek s procesem, run.line.held, run.line.older pro strom před 1.25, lineRunFilter: obecný běh vynechá úkol s linií drženou jiným během; běh linie bere hlavní linii G nebo úkoly v G, jejichž hlavní linii nedrží jiný běh; linie úkolu = vlastní + hlavní (placer core/offline.ts) + linie jeho lidí; mimo linie, dějiny, místa žádnou; rememberLineAgent) · src/cli/menu.ts runMenu (ui.run.where, ui.run.whole, ui.run.line.item/busy/held, openInNewTerminal title Strom · strom · linie (G…), key linie, ui.run.window, ui.run.window.recent; dějiny jen celá fronta) · src/commands/session.ts:1107 enterRun (research, agent) · cs.json ui.run.line, ui.run.line.older, ui.run.beside, ui.run.others · help run (Runs of lines) · CHANGELOG.cs.md 1.36.0 · dirigent:spec/126 U11, prace/1121-research-126-linie-b1 -->

<a id="R7.10.1"></a>
### R7.10.1 Runs at once, at most: `run.parallel`

At most `run.parallel` runs work at once in one family tree (default 3, 1–10): the run of the whole queue and the runs
of lines together. Conversations do not count.

- **Enforced by the code:**
  - counted when a run starts, under a short lock of the tree's lines. A run beyond the limit is refused and says
    which runs are working and how to stop them;
  - only a person may raise the value: `strom config set run.parallel <n>` asks “Let up to N runs of the agent work
    at once in one family tree (now M)? Each run spends the agent's plan — the use adds up.” The agent does not raise
    the value. Anyone may lower it, the app too ([S4.4.12](S4-research-from-the-app.md#S4.4.12));
  - lowering it below the number of runs going on stops none; a new run starts once there are fewer.
- **Limits:** the setting applies to this computer, not to one family tree.
- **Controls:** terminal: `strom config set run.parallel <n>`, back with `strom config unset run.parallel`.
- **Since:** research 1.36.0

<!-- zdroj: research:089875ec src/core/linerun.ts (run.parallel, hint strom config set run.parallel <n>, rozhovory se nepočítají) · src/core/config.ts run.parallel (tree: false, DEFAULT_RUN_PARALLEL 3, RUN_PARALLEL_MAX 10, „only you raise it“) · src/commands/setup.ts runsDecision (requireHuman jen při zvýšení), cs.json ui.consent.runParallel · src/core/live.ts runsLimitWrite (POST settings/runs: snížení, zvýšení 403 runs.raise s příkazem, mimo 1–10 400 runs.max) · src/core/liveruns.ts runLimits · help run -->

<a id="R7.10.2"></a>
### R7.10.2 Stopping one run

Each run can be stopped on its own; the other runs work on. Stopping interrupts nothing by force.

- **Limits:**
  - `strom run stop <run-…>`: the session at work finishes its task and no next one starts. With `--finish` the
    session at work is also asked to finish at once: the agent writes what it found and closes the session as
    `strom session finish` does ([R7.3](#R7.3));
  - a run that waits (for the condition, the subscription limit or an archive) ends at once;
  - the run reads the request within a second or two and says so in its terminal. Ctrl-C in the run's window stops
    only that run;
  - the number of a run (`run-…`) is given by the refusal of a run beyond the limit ([R7.10.1](#R7.10.1)) and by
    `strom session list --open`;
  - after a run of a line ends, the run of the whole queue takes its tasks again.
- **In the app:** **Stop** and **Finish and stop** in the run's block ([S4.1.8](S4-research-from-the-app.md#S4.1.8)).
- **Controls:** terminal: `strom run stop <run-…> [--finish]`, Ctrl-C in the run's window.
- **Since:** research 1.36.0

<!-- zdroj: research:src/commands/session.ts run stop (help: the task at work is finished, no next one starts; --finish; a run that waits ends at once; read within a second or two) · src/core/live.ts POST runs/stop · src/commands/links.ts finish?run= finishRun (strom run stop <run> --finish) · STOP_HINT src/core/linerun.ts · help run stop -->

<a id="R7.10.3"></a>
### R7.10.3 What runs on a computer share

Runs on one computer (all researches with the same shared folder) share the agent's subscription limit, the questions
to the condition, the requests to websites and the readers of scans.

- **Enforced by the code:**
  - a subscription limit hit by one run ([R7.6](#R7.6)) applies to all runs of the same agent (and account) on the
    computer: no new session starts until the limit renews. A run under a condition with `--loop` or `--until` waits,
    any other ends (**subscription limit**). A session at work goes on;
  - the runs ask their conditions ([R7.4](#R7.4)) one after another: the next only after the session the condition
    let through has started;
  - the pages of one website the agents open count towards `web.perHost` ([R9.3](R9-archives.md#R9.3)) from all
    sessions on the computer over the last `run.minutes`;
  - at most `read.parallel` readers read scans at once on the whole computer ([R8.3.1](R8-reading-scans.md#R8.3.1)).
- **Since:** research 1.36.0

<!-- zdroj: research:src/core/machine.ts (limit-<agent>.json ve sdílené složce agents/, brána po jednom, sloty čtenářů) · src/core/web.ts web.perHost za run.minutes ze všech sezení · src/core/config.ts read.parallel, web.perHost (počítáno na počítač) · help run (What runs share on this computer) · CHANGELOG.cs.md 1.36.0 · dirigent:spec/126 U8 -->

<a id="R7.10.4"></a>
### R7.10.4 A run of a line from a link of the Strom app

- The link `strom-research://work` with `research=G…` (and possibly `agent=…`) asks for a run of one line. The
  research terminal opens it in a new window with the line's name, says “Run of the line …: its tasks only — another
  line can have a run of its own beside it.”, the agent and the first 5 tasks of the line, and starts `strom run
  --research G…` with `--tasks N` or `--loop` as in [R7.1.2](#R7.1.2).
- **Limits:**
  - nothing starts when the line is not in the research or is paused or ended, when the chosen agent's program is not
    on the computer, when the line already has a run, when a run of a strom older than 1.25 works on the research, or
    at the full number of runs (“The limit of runs at once is reached (3 of 3, setting run.parallel). Nothing more was
    started.”);
  - the confirmation follows the setting **Starting the agent from the Strom app**
    ([S4.5.5](S4-research-from-the-app.md#S4.5.5));
  - a link for the whole queue is still refused beside a run of the whole queue or a session outside the runs of
    lines. The runs of lines count for it only towards `run.parallel`; the queue it shows has no tasks of lines with a
    run of their own;
  - `strom-research://finish` with `run=run-…` asks the run to finish and end as `strom run stop <run-…> --finish`
    does ([R7.10.2](#R7.10.2)).
- **Controls:** the app ([S4.3.3](S4-research-from-the-app.md#S4.3.3)); terminal: `strom link open "<link>"`.
- **Since:** research 1.36.0

<!-- zdroj: research:src/cli/menu-links.ts workRun byLine (ui.link.direction.none, ui.link.work.line.state, ui.link.work.agent, ui.link.work.older, ui.run.line.held, ui.link.work.cap; obecný odkaz: busy bez běhů linií, runRefusal max; lineRunFilter; ui.run.line, ui.link.work.agent.is; run --research [--agent] --tasks|--loop) · src/commands/links.ts lineWindow (titulek Strom · strom · linie (G…), klíč linie), finish run= → finishRun · src/core/links.ts work research=, agent= -->
