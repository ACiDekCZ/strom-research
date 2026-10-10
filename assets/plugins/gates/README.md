# strom gates — interface 1

A gate is a condition you set on the agent working alone. Before each session
of `strom run` strom asks your gate: go on, wait, or stop? With
`strom run --loop` the agent works on for as long as there is work and the gate
lets it — your subscription's room, a budget, the night's tariff: whatever the
gate's program decides.

    plugins/gates/
      README.md                this interface
      claude-usage/            a gate strom ships (the Claude subscription's daily ration)
      my-gate/                 one of yours: gate.json and its program

**Use one**: `strom config set run.gate <name>` — or its name and what it is
given, `"claude-usage 10"` (only you: an agent cannot set or remove it);
`strom gate test` to see its answer now. `strom gate list` shows
the gates here. `strom config unset run.gate`: no gate.

## gate.json

    {
      "interface": 1,
      "title": "My budget",
      "command": ["node", "gate.ts"],
      "timeout": 60
    }

- `command`: the program and its arguments, run in the gate's folder. `node`
  is strom's own Node (TypeScript runs as it is) — best on every system. What
  the user gives the gate after its name (`run.gate "my-gate 20 night"`) is
  added to these arguments.
- `timeout`: seconds it may take (default 120). No answer in time: an error.

## The answer

The exit status says it:

| status | meaning |
|---|---|
| 0 | go on: the next session starts |
| 1 | wait: strom asks again later (the computer may sleep meanwhile) |
| 2 | stop: the run ends |
| anything else, a crash, no answer | an error: the run ends — never spending blind |

One line of JSON on stdout (the last line) may say more:

    {"reason": "the week is at 61 %", "until": "2026-10-02T14:00:00Z"}

- `reason`: why, for the user (in their language: `STROM_LANG`).
- `wait` (seconds) or `until` (a time): when to ask again. Without them: in
  15 minutes; never sooner than a minute.
- `hard` (`true`, with status 1 or 2): this answer is the user's own hard
  limit — a cap set in `run.gate`. The run ends, saying the reason; no
  "start anyway" goes past it.
- `watch` (`{"kind": "seven_day", "finish": 0.99}`): the gate holds a cap on
  that window of the agent's plan (`five_hour` or `seven_day`). strom then asks
  it before **every** session, also of the runs you started yourself (there
  only its hard stop counts), and asks a session at work to finish — write
  down what it found and close — once the agent says the window's use reached
  `finish` (0–1). A gate that never says `watch` is asked as before.

Both are optional; an older strom ignores them.

Plain text instead of JSON is the reason.

## What strom tells the gate

Environment variables, besides the user's own:

| variable | |
|---|---|
| `STROM_GATE` | the gate's name |
| `STROM_TREE` | the family tree's folder |
| `STROM_LANG` | the research language (cs, de, en…) |
| `STROM_AGENT` | the agent: claude, codex, antigravity, opencode, grok |
| `STROM_MODEL` | the main model, when one is set |
| `STROM_SESSIONS` | sessions this run has had |
| `STROM_COST_USD` | what this run has cost so far (as the agent reported it) |
| `STROM_NEXT_TASK` | the task the next session would take |
| `STROM_AGENT_LIMITS` | what the agent said of its plan's limits in this run, when it said any (Claude Code): JSON `[{"kind": "five_hour" \| "seven_day", "used": 0.97, "resetsAt": "<ISO time>", "at": "<when it said it>"}]` — absent otherwise; an older gate ignores it |

A session already at work is never stopped by a gate: it is asked between
sessions only (a session's own time limit is `run.minutes`). Under a cap
(`watch`) the session is asked to finish, as `strom session finish` does: its
agent hears it from its next strom command and starts no new reader; work it
delegated inside itself (a subagent) strom cannot stop half-way.

The gate holds the runs that go on by themselves: `strom run --loop` and
`--until`. Tasks you start yourself (one, `--max 3`, `--task T0007`, "work
alone" in the menu) are your choice: the gate is asked once, and when it would
not start now, strom tells you why and asks whether to start anyway (no is
suggested). An agent starting them needs your yes in a window of the system;
a script nobody can ask keeps to the gate.

## claude-usage

Keeps the work to the daily ration of your Claude subscription. It asks Claude
Code (`claude -p /usage`) how much of the week is used and counts how much of
the week is gone since its reset (a day ≈ 14.3 %). A session starts only while
usage is at least the number you give it behind the week gone:

    strom config set run.gate "claude-usage 10"     gone − used ≥ 10

Without a number: 0 — no faster than the week goes; 14: about a day in hand.
Not enough in hand: it waits until the week has caught up (past the reset: the
new week's share). A used-up session: until it resets. Another agent than
Claude Code: it lets the work go on.

**A cap** — your own hard stop for the week:

    strom config set run.gate "claude-usage 10 --cap 95"

At 95 % of the week used no session starts: in every run, `--max` and
`--task` and the menu's too, asked before each session, and no "start anyway"
goes past it — the run ends saying the use and when the week resets. A session
at work is asked to finish when Claude Code says the week is at 99 %. What
Claude Code said in the run (`STROM_AGENT_LIMITS`, at most 15 minutes old) is
read instead of asking `claude -p /usage`. `--cap` alone: the cap without the
pace (`claude-usage --cap 95`).

A gate is a program on this computer, put here by you (or by strom); the
`.gitignore` of the plugins folder keeps it out of any repository.
