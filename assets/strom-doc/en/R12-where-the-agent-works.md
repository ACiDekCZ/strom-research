<a id="R12"></a>
# R12 Where the agent works and what strom watches

The agent (Claude Code, Codex, Antigravity, Grok Build, OpenCode) is talked to in a terminal, or in the agent's
desktop app when strom opens it; working alone runs without a conversation.
Accordingly, what differs is where the conversation is, which browser the agent uses, what strom watches, what a
person does and what does not work without the agent in the terminal. The archives' rules are the same everywhere
([R9](R9-archives.md)); only what strom stands before differs. Describes the research 1.29.0. Each rule says what is
**enforced by the code** (the `strom` command or the agent's hook refuses it) and what is only a **rule of the
method**. What has not been verified live on a Mac is said in [R12.6](#R12.6).

<!-- zdroj: dirigent:spec/062-hlidani-desktop-a-codex/spec.md K5.1, K5.2 · test/vysledek-desktop-chrome.md · test/vysledek-062-u4-desktop.md · test/vysledek-1106-vyzkum-062-desktop.md · research:CHANGELOG.cs.md 1.29.0 · src/core/which.ts AGENTS -->

<a id="R12.1"></a>
## R12.1 Ways of working: a table

| Way of working | Where the conversation is | The agent's browser | What strom watches | A person's step | Without the agent in the terminal |
|---|---|---|---|---|---|
| Claude Code in the terminal | the terminal: Claude Code in the research folder (`strom chat --where terminal`) | Chrome with the Claude in Chrome extension ([R9.4.1](R9-archives.md#R9.4.1)) | the browser in Chrome ([R9.4](R9-archives.md#R9.4)), the web fetch ([R9.3](R9-archives.md#R9.3)), commands in the agent's command line | an archive's permission ([R9.2](R9-archives.md#R9.2)) | – (Claude Code is in the terminal) |
| the Claude app (Code tab) and Claude Code in the terminal | the Claude app, Code tab (`strom chat`) | Chrome with Claude in Chrome, or the app's built-in browser ([R12.2](#R12.2)) | the browser in Chrome and the app's built-in browser, the web fetch, commands in the agent's command line and in the app's terminal ([R12.3](#R12.3)) | confirm the folder (Trust workspace) and send the prepared message; an archive's permission | nothing is missing: working alone and reading scans run through Claude Code in the terminal |
| the Claude app without Claude Code in the terminal | the Claude app, Code tab (`strom chat`) | as in the row above | as in the row above | as in the row above; an installation of Claude Code that strom offers and that can be declined ([R12.4](#R12.4)) | working alone (`strom run`), reading scans by the readers (`strom read`) and work from the Strom app ([R12.4](#R12.4)) |
| Codex in the terminal | the terminal: Codex in the research folder (`strom chat --where terminal`) | Codex's browser, Chrome and computer use, if its settings have them ([R12.5](#R12.5)) | `strom` commands by the tree's rules for Codex; Codex's browser by the addresses in its code, once a person confirms strom's hook; not Codex's computer use or web search ([R12.5](#R12.5)) | trust the research folder (only then the tree's rules apply) and confirm strom's hook (**Review hooks**, `/hooks`); an archive's permission | – (Codex is in the terminal) |
| the ChatGPT app (Codex) | the ChatGPT app (`strom chat`) | as with Codex in the terminal: the same settings ([R12.5](#R12.5)) | as with Codex in the terminal ([R12.5](#R12.5)) | as `strom chat` says, confirm the folder and send the prepared message (not verified, [R12.6](#R12.6)); confirm strom's hook (**Settings › Hooks**); an archive's permission | working alone, reading scans by the readers and work from the Strom app ([R12.5](#R12.5)) |
| Antigravity in the terminal | the terminal: Antigravity (`agy`) in the research folder (`strom chat`); strom does not open the Antigravity app ([R12.7](#R12.7)) | Antigravity's browser, if the agent has one; strom does not watch it ([R12.7](#R12.7)) | only what `strom` itself refuses: commands that belong to a person alone; Antigravity has no hook and no rules in the research folder ([R12.7](#R12.7)) | an archive's permission | – (Antigravity is in the terminal) |
| Grok Build in the terminal | the terminal: Grok (`grok`) in the research folder (`strom chat`); strom opens no Grok app ([R12.8](#R12.8)) | none strom would watch ([R12.8](#R12.8)) | the web fetch ([R9.3](R9-archives.md#R9.3)) and commands in the agent's command line: strom's hooks and rules in `.grok/` ([R12.8](#R12.8)) | nothing more: `strom chat` starts Grok with the research folder as trusted; an archive's permission | – (Grok is in the terminal) |
| OpenCode in the terminal | the terminal: OpenCode in the research folder (`strom chat --where terminal`) | none strom would watch ([R12.9](#R12.9)) | commands and files by the tree's rules in `opencode.json`; not the web fetch or a browser ([R12.9](#R12.9)) | approve commands other than `strom` that OpenCode asks about (except at the level `full`); an archive's permission | – (OpenCode is in the terminal) |
| the OpenCode app | the OpenCode app (`strom chat`) | as with OpenCode in the terminal | as with OpenCode in the terminal (not verified, [R12.6](#R12.6)) | as `strom chat` says, confirm the folder and send the prepared message (not verified, [R12.6](#R12.6)); an archive's permission | working alone, reading scans by the readers and work from the Strom app ([R12.9](#R12.9)) |
| a run alone, `strom run` | nowhere: the agent works alone; the terminal and the Strom app show the course ([S1.4](S1-connecting-app-and-research.md#S1.4)) | Claude Code: Chrome by the task ([R9.4.1](R9-archives.md#R9.4.1)); Codex: browser and computer use switched off ([R12.5](#R12.5)); Grok: without the MCP servers of Claude Code and Cursor ([R12.8](#R12.8)); Antigravity and OpenCode: strom changes nothing | Claude Code and Grok: as in the terminal; Codex: `strom` commands; Antigravity and OpenCode: what the rules do not allow is refused, nobody is asked ([R12.7](#R12.7), [R12.9](#R12.9)) | start the run; an archive's permission beforehand, nobody is there during the run ([R9.7](R9-archives.md#R9.7)) | the whole run: it ends before any question or cost estimate ([R12.4](#R12.4)) |

- **Enforced by the code:**
  - strom's hooks in the research's `.claude/settings.json` are run by Claude Code in the terminal and by the Claude
    app (Code tab); Codex reads the tree's rules in `.codex/rules/strom.rules` and strom's hook in `.codex/hooks.json`, Grok Build in `.grok/config.toml` (and strom's
    hooks in `.grok/hooks/strom.json`), OpenCode in `opencode.json`; Antigravity reads only the instructions in
    `AGENTS.md`;
  - commands that belong to a person alone (signing in, the seal, an archive's permission and others) `strom`
    itself refuses to every agent it recognises, with all five agents;
  - nothing of the agents' apps is switched off. The one exception is a run alone with Codex without the agent's
    personal add-ons ([R12.5](#R12.5)).
- **Limits:** computer use strom watches with no agent: the agent controls the computer with it as a person does.
  What computer use can and cannot do in the Strom app and in the research is said in [R12.10](#R12.10).
- **Method only:** in every way of working the agent runs `strom` in its command line and does not of its own accord
  use a browser strom does not recommend ([R9.4.2](R9-archives.md#R9.4.2)).
- **Controls:** terminal: `strom chat` (where, says the setting `agent.where`: `app` the agent's app, `terminal` the
  terminal; unset: the app when it is installed), `strom chat --where app|terminal` once otherwise,
  `strom agents use claude|codex|antigravity|grok|opencode`, `strom doctor` (rows **where the conversation is**, **the agent in the
  terminal**, **browser (Claude in Chrome)**, **desktop apps' browser**, **Codex's hooks (browser)**).
- **Since:** research 1.29.0

<!-- zdroj: research:src/core/apps.ts DESKTOP_APPS (claude://code/new, codex://new; mac Claude.app, Codex.app, ChatGPT.app) · src/commands/start.ts:156-217 strom chat (where app|terminal, ui.chat.app.open) · src/core/config.ts:311 agent.where, :316 agent.addons · src/agents/files.ts codexRules · src/core/agentcli.ts · src/cli/main.ts:290 (def.person && isAgent) · src/core/which.ts detectAgent · src/cli/ui.ts ui.doc.where, ui.doc.cli, ui.doc.browser, ui.doc.desktop · test/vysledek-desktop-chrome.md (Trust workspace, odkaz jen předvyplní zprávu) -->

<a id="R12.2"></a>
## R12.2 The browser in the Claude app

The Claude app has two browsers: Chrome with the Claude in Chrome extension and its own built-in browser. strom
watches both alike.

- **Enforced by the code (a hook before a page opens):**
  - the built-in browser gets the same rules as the browser in Chrome ([R9.4](R9-archives.md#R9.4)): an archive only
    a person's browser may enter is refused without the permission **through the browser**, with the same advice; an
    allowed one is recorded and keeps its pace together with Chrome and the web fetch;
  - tools on a page (reading the page, finding, a script) are checked by the site last opened in that tab. The tabs of
    the built-in browser and of Chrome are not mixed up;
  - local pages (localhost, a file on the computer) are not limited at all. The bridge to the Strom app is always
    refused.
- **Limits:** which browser the agent uses is up to the Claude app: its setting **Preferred browser** and whether the
  extension in Chrome is connected. With Chrome preferred, sites go through Chrome. Computer use of the Claude app
  strom does not watch: the agent controls the computer with it as a person does.
- **Method only:** strom does not recommend the built-in browser: the agent does not use it of its own accord
  ([R9.4.2](R9-archives.md#R9.4.2)).
- **Why:** the Claude app runs the research's hooks before its built-in browser too, so strom can judge every address
  as it does for Chrome.
- **Controls:** the Claude app: the setting **Preferred browser**. Terminal: `strom doctor`, the row **desktop apps'
  browser** and, at the browser in Chrome, **in a conversation in the Claude app: yes; working alone (strom run
  --chrome): only with Claude Code in the terminal**.
- **Since:** research 1.29.0

<!-- zdroj: research:src/core/browser.ts (matcher mcp__(remote-devices__)?Claude_Browser__*) · src/core/chromehook.ts · src/core/webgate.ts browserGate · src/cli/ui.ts ui.doc.desktop.unwatched, ui.doc.browser.apponly · CHANGELOG.md 1.29.0 · test/vysledek-062-u4-desktop.md kroky 1–3 · test/vysledek-1106-vyzkum-062-desktop.md bod 3 · test/vysledek-desktop-chrome.md bod 4, bod 6 -->

<a id="R12.3"></a>
## R12.3 The Claude app's terminal

The Claude app also has a terminal of its own. Commands in it hold the same as in the agent's command line.

- **Enforced by the code (a hook before a command in the app's terminal):**
  - what only a person does is refused to the agent: the login (`strom login`), the seal (`strom seal`), installing
    and removing a connector, an archive's permission (`strom allow`), approving a story, deciding a hypothesis,
    answering a place and the person's other commands, also with the full path to `strom` or a variable before it;
  - git, which the research forbids the agent, is refused;
  - the bridge to the Strom app is refused (its address and the file it is in).
- **Limits:** strom does not add the app's terminal to the allowed commands: a person approves every command in it,
  as before. The app's terminal is the user's login shell with the user's path to programs.
- **Method only:** the agent runs `strom` in its command line, not in the app's terminal.
- **Why:** strom's rules for the agent's command line do not reach the app's terminal by themselves; strom's hook
  carries them over.
- **Controls:** none: it holds by itself in the research.
- **Since:** research 1.29.0

<!-- zdroj: research:src/core/desktopterminal.ts desktopTerminalRefusal · src/core/bridgeguard.ts · src/agents/files.ts (CLAUDE.md: use Bash for strom commands … never its terminal) · test/vysledek-1106-vyzkum-062-desktop.md bod 4 · test/vysledek-062-u4-desktop.md krok 4, kroky 5–6 · CHANGELOG.md 1.29.0 -->

<a id="R12.4"></a>
## R12.4 The Claude app without Claude Code in the terminal

The Claude app is enough for a conversation. What strom starts by itself, Claude Code in the terminal runs.

- **Enforced by the code:**
  - working alone (`strom run`), reading scans by the readers (`strom read`), fixes and work from the Strom app end
    without Claude Code in the terminal with the code `agent.cli-missing`, before any question or cost estimate. The
    message offers to go on with the conversation in the app (`strom chat`) and an installation of Claude Code;
  - the bridge tells the Strom app that reading is not ready, with the same code;
  - `strom setup` shows the row **Claude — the app (working alone and reading scans need Claude Code)** and offers an
    installation of Claude Code. It can be declined; without a person only the installation line is printed;
  - `strom doctor` warns (it is not an error) in the row **the agent in the terminal**: **working alone, reading scans
    and work from the Strom app need Claude Code in the terminal**; `strom doctor --fix` offers the installation;
  - in a conversation without Claude Code in the terminal, strom's scan reader reads scans right in the conversation
    (instead of `strom read`).
- **Limits:** the copy of Claude Code the Claude app carries inside it strom never uses: it starts only Claude Code
  installed in the terminal.
- **Why:** the app leads the conversation, but working alone and the readers strom starts with the Claude Code
  command. Saying so beforehand spares a consent and a cost estimate that would lead nowhere.
- **Controls:** terminal: `strom doctor`, `strom doctor --fix`, `strom setup`, `strom chat`.
- **Since:** research 1.29.0

<!-- zdroj: research:src/core/agentcli.ts CLI_MISSING, appWithoutCli, claudeInstallLine · src/commands/setup.ts:471 ui.doc.cli.missing · src/cli/ui.ts ui.setup.cli.apponly · test/vysledek-1106-vyzkum-062-desktop.md bod 5 · prace/1106-vyzkum-062-desktop/pruzkum.md B · CHANGELOG.md 1.29.0 -->

<a id="R12.5"></a>
## R12.5 Codex: in the terminal and in the ChatGPT app

Codex runs in the terminal, or in the ChatGPT app (the older separate Codex app came before it). The browser, Chrome
and computer use are its plugins in one Codex setting (`~/.codex/config.toml`), which the terminal and the app share.
Codex drives the browser by JavaScript code (the tool `js`), not by a page's address.

- **Enforced by the code:**
  - `strom` commands by the tree's rules for Codex (`.codex/rules/strom.rules`): `strom` is allowed; the login, the
    seal, installing and removing a connector, and git are forbidden. Codex reads these rules once a person trusts
    the research folder;
  - before every call of Codex's browser strom's hook runs (`.codex/hooks.json`). Codex runs it once a person trusts
    the research folder and confirms the hook **strom** in Codex (Trust). strom confirms nothing for the person;
  - a page's address written in the code: the same decision as for the browser in Chrome ([R9.4](R9-archives.md#R9.4)).
    An archive that lets in only a person's browser is refused without the permission **via the browser**, with the
    same advice; an allowed one is recorded and keeps its pace together with the web fetch of the same site. Two
    archive pages in one call are refused: pages go one at a time. The bridge to the Strom app is always refused;
    local addresses (localhost) the hook does not judge;
  - code that works with the page without an address (a click, back): the site the hook let through last in the
    session applies to it;
  - code without an address strom could see and without such a site: it is never refused. It is recorded as
    unwatched (`strom net web` counts it), and once per session the agent gets the advice to write each page's address
    straight into the call;
  - Codex does not take a question to a person from a hook: where strom would ask (more requests to one site than the
    session may make), the call is refused;
  - a run alone (`strom run`) with Codex without the agent's personal add-ons (`agent.addons off`, the default)
    switches off its plugins, browser and computer use. With `agent.addons on` and in a conversation they stay as the
    person has them;
  - `strom doctor`, `strom setup` and `strom chat` say when strom's hook waits for confirmation, has changed since it
    was confirmed, is turned off in Codex, Codex's hooks are off, Codex does not trust the research folder, or the
    hook file is missing. They read the state only from Codex's settings.
- **Limits:**
  - until the hook is confirmed, and again after each change of it, Codex skips it: strom then does not watch Codex's
    browser;
  - Codex's computer use (code that controls other apps) the hook leaves alone: strom neither watches nor records it
    ([R12.10](#R12.10));
  - Codex's web search no hook sees;
  - the archive check (`strom net web --check --browser`) and `strom doctor` count on the agent's browser only with
    Claude Code: with Codex a task at an archive reachable only via the browser waits for images from a person
    ([R9.4.3](R9-archives.md#R9.4.3));
  - without Codex in the terminal (only the ChatGPT app) strom does not start working alone, reading scans
    by the readers or work from the Strom app; it ends with the same code `agent.cli-missing` as with Claude
    ([R12.4](#R12.4)).
- **Method only:** the agent does not use Codex's browser of its own accord: it does not take it into an archive only
  a person's browser may enter, and a person saves the images ([R9.4.2](R9-archives.md#R9.4.2),
  [R9.6](R9-archives.md#R9.6)). When it uses it, it writes each page's address straight into the call
  (`tab.goto("https://…")`), one page at a time, and does not click through a series of an archive's pages.
- **Why:** Codex's browser is driven by code, not by a page's address. strom judges only an address it sees in the
  code; so it does not refuse code without an address, it only records it.
- **Controls:** the ChatGPT app (Codex): **Settings › Hooks** (or **Review hooks** by the message field) → the hook
  **strom** → **Trust**; Codex in the terminal in the research folder: **Review hooks** (`/hooks`). Terminal:
  `strom doctor` (rows **desktop apps' browser** and **Codex's hooks (browser)**), `strom agents sync` (writes a
  missing hook file), `strom net web` (the number of unwatched calls), `strom config set agent.addons on|off`.
- **Since:** research 1.27.0 (browser and computer use switched off in a run alone); `agent.addons` since 1.14.0;
  the hook before Codex's browser and Codex missing in the terminal since 1.29.0

<!-- zdroj: research:src/agents/files.ts codexRules (allow strom; forbidden login, seal, connector add/remove, git; „read once the folder is trusted“), CODEX_HOOKS v AGENT_FILES · src/core/codexhook.ts (CODEX_BROWSER_TOOL mcp__node_repl__js, CODEX_HOOK_MATCHER, answerCodexEvent: codeUrls → answerChromeEvent navigate, >1 archiv deny, ask → deny, reachesBridge, loopback, page tool = poslední puštěný host, UNWATCHED + UNWATCHED_HINT jednou za sezení, computerUseOnly sky.* → nic; codexHookState trusted|modified|untrusted|disabled|off|folder|missing jen z config.toml) · src/commands/web.ts (unwatched v strom net web) · src/runners/codex.ts CODEX_CLEAN, codexBrowserOff · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS = claude · src/core/agentcli.ts cliMissing · src/core/apps.ts codex (Codex.app, ChatGPT.app) · src/cli/ui.ts ui.doc.codexhooks.*, ui.doc.desktop.codex · CHANGELOG.md 1.27.0, 1.29.0 · dirigent:prace/1106-vyzkum-062-codex/karta.md Výsledek -->

<a id="R12.6"></a>
## R12.6 What is not verified

The table [R12.1](#R12.1) describes the research's code and what was verified on a Mac in the Claude app (Code tab).
Not yet verified live:

- the Claude app with the extension in Chrome disconnected, or with the built-in browser preferred: which browser the
  agent then picks (it follows only from the app's instructions to the agent);
- the agent's command line in the Claude app and the web fetch in it (the hooks are the same as in the terminal);
- the watching in the Claude app when Claude Code is not in the terminal (the app runs the hooks with its own copy of
  Claude Code);
- Codex live: neither in the terminal nor in the ChatGPT app (the tree's rules, the hook before the browser and its
  confirmation, refusals and recording of unwatched calls, opening a conversation by a link, a person's steps), nor
  that the ChatGPT app behaves like the older Codex app. The hook before Codex's browser is described from the code;
- Codex's computer use: whether it gives apps levels as the Claude app does ([R12.10](#R12.10));
- Antigravity, Grok Build and OpenCode live in any way of working: strom's rules and hooks, a person's steps, the
  refusal of a person's commands;
- the OpenCode app: opening a conversation by a link, and that it reads the research's `opencode.json` rules;
- Grok opened in the research folder other than through `strom chat` (in a folder it does not trust): what of
  strom's rules and hooks then applies;
- whether Antigravity, Grok Build and OpenCode have a browser or computer use and how the agent uses them (strom
  does not watch them);
- the Claude, ChatGPT and OpenCode apps on Windows.

- **Since:** research 1.29.0

<!-- zdroj: test/vysledek-desktop-chrome.md Neověřeno · test/vysledek-062-u4-desktop.md Neověřeno · test/vysledek-1106-vyzkum-062-desktop.md Neověřeno · dirigent 6. 11. (ChatGPT.app × Codex.app) · spec 062 K5.1 (06. 11.: Antigravity, Grok, OpenCode jen z kódu) · spec 062 Mimo rozsah (Windows) -->

<a id="R12.7"></a>
## R12.7 Antigravity

Antigravity is started in the terminal with the command `agy`. Antigravity has an app too, but strom opens no
conversation in it (strom knows no link that would open one): `strom chat` with Antigravity is always in the
terminal.

- **Enforced by the code:**
  - `strom setup` (and `strom agents install`) writes a rule into Antigravity's settings that `strom` may run without
    asking (`command(strom)`);
  - commands that belong to a person alone `strom` itself refuses ([R12.1](#R12.1));
  - a run alone (`strom run`): what Antigravity's settings do not allow is refused, nobody is asked. When Antigravity
    stops at a refused command, strom tells it in the same conversation to go on only through `strom`, at most
    twice. At the level `full` the permissions are skipped;
  - Antigravity's web fetches and searches in a run alone are written into the research's record only after they
    happened.
- **Limits:**
  - Antigravity has no hook before a web fetch, a browser or a command: strom does not check the web's limits
    ([R9.3](R9-archives.md#R9.3)), Antigravity's browser or computer use beforehand;
  - strom writes no rules for files and git for Antigravity in the research folder;
  - the bridge to the Strom app is protected only by its own checks.
- **Method only:** the instructions in `AGENTS.md`: the agent works only through `strom`, checks a site beforehand
  (`strom net web --check`), does not of its own accord use Antigravity's browser and does not go with it to an
  archive only a person's browser goes to ([R9.4.2](R9-archives.md#R9.4.2)).
- **Controls:** terminal: `strom agents use antigravity`, `strom chat`, `strom setup`.
- **Since:** research 1.0.0; going on after a refused command since 1.14.0

<!-- zdroj: research:src/core/apps.ts (Antigravity: no known link, strom talks to it in the terminal) · src/core/apps.ts whereToTalk · src/agents/global.ts allowRules command(strom) · src/commands/setup.ts installGlobal · src/agents/launch.ts antigravity (--mode accept-edits, --dangerously-skip-permissions) · src/runners/antigravity.ts (headless: what would ask is refused; AGY_GO_ON = 2; ANTIGRAVITY_WEB) · src/core/metrics.ts webOpt (from: stream) · src/core/bridgeguard.ts (agent without hooks: Codex, OpenCode, Antigravity) · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS · src/agents/files.ts AGENTS.md body 10, syncAgentFiles (žádný soubor Antigravity) · git tagy v1.0.0, v1.14.0 -->

<a id="R12.8"></a>
## R12.8 Grok Build

Grok Build is started in the terminal with the command `grok`. strom opens no Grok app: `strom chat` with Grok is
always in the terminal.

- **Enforced by the code:**
  - the tree's rules in `.grok/config.toml`: `strom` allowed; signing in, the seal, installing and removing a
    connector, git, the research's evidence and a person's settings forbidden. Grok reads them only in a folder it
    trusts: `strom chat` and `strom run` start it with the research folder as trusted (recorded once per research);
  - strom's hooks in `.grok/hooks/strom.json`: before a web fetch and a search the same rules as with Claude Code
    ([R9.3](R9-archives.md#R9.3)); before a command in the agent's command line the refusal of the bridge to the
    Strom app;
  - a run alone without personal add-ons (`agent.addons off`, the default): Grok does not take over the skills, MCP
    servers and hooks of Claude Code and Cursor and switches its memory off; strom's hooks in `.grok/hooks` still
    apply. What the rules do not allow is refused, nobody is asked; at the level `full` only the prohibitions apply.
- **Limits:**
  - Grok's own skills, plugins and MCP servers stay in a run alone too: Grok has no switch for one run;
  - Grok lets harmless commands through by its own judgement too: what holds are the prohibitions, not the list of
    what is allowed;
  - strom does not watch Grok's browser or computer use: it watches only Claude in Chrome, the Claude app's
    built-in browser ([R12.2](#R12.2)) and Codex's browser ([R12.5](#R12.5)).
- **Method only:** the instructions in `AGENTS.md` and `.grok/rules/strom.md`: Grok reads scans itself, the way of
  delegating in `CLAUDE.md` is not its own.
- **Controls:** terminal: `strom agents use grok`, `strom chat`, `strom config set agent.addons on|off`.
- **Since:** research 1.4.0; the web hooks and a run alone without personal add-ons since 1.14.0; the hook before a
  command since 1.27.0

<!-- zdroj: research:src/agents/files.ts treeRules(grok), grokConfig, GROK_RULES, grokHooks, GROK_HOOKS · src/core/web.ts grokWebHooks (web_fetch|web_search) · src/core/bridgeguard.ts grokShellHook (run_terminal_command|bash|shell) · src/runners/grok.ts grokTrust (--trust), GROK_CLEAN, dontAsk, --always-approve · src/agents/launch.ts grok · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS · git tagy v1.4.0, v1.14.0, v1.27.0 -->

<a id="R12.9"></a>
## R12.9 OpenCode

OpenCode is started in the terminal, or in the OpenCode app: `strom chat` opens it by a link with the research
folder and a prepared message. The app takes the model from the research's `opencode.json`.

- **Enforced by the code:**
  - the tree's rules in `opencode.json` in the research folder: `strom` allowed; signing in, the seal, installing and
    removing a connector, and git forbidden; the research's evidence and history (`.git`) are neither read nor
    changed; without asking it writes only into the notes (`notes/`) and into connectors the agent builds; its own
    rules and instructions (`opencode.json`, `AGENTS.md`, `CLAUDE.md`) the agent does not change. OpenCode asks
    about other commands and writes; at the level `full` it does without asking everything the rules do not forbid;
  - a run alone: OpenCode's agent `strom-run` with the same rules; what would ask is refused (OpenCode would
    otherwise end the whole run at the first question);
  - without OpenCode in the terminal (only the app) working alone, reading scans by the readers and work from the
    Strom app end with the code `agent.cli-missing`, as with Claude ([R12.4](#R12.4));
  - OpenCode's web fetches and searches in a run alone are written into the research's record only after they
    happened.
- **Limits:**
  - OpenCode has no hook: the rules allow web fetches and searches and strom does not check them beforehand
    ([R9.3](R9-archives.md#R9.3)); strom does not watch a browser or computer use, if OpenCode has them;
  - OpenCode's personal add-ons stay in a run alone too: strom has no switch for them.
- **Method only:** the instructions in `AGENTS.md`: the agent works only through `strom`, checks a site beforehand
  (`strom net web --check`) and does not go to an archive only a person's browser goes to
  ([R9.4.2](R9-archives.md#R9.4.2)).
- **Controls:** terminal: `strom agents use opencode`, `strom chat`, `strom chat --where app|terminal`.
- **Since:** research 1.0.0; the agent `strom-run` since 1.4.0

<!-- zdroj: research:src/agents/files.ts opencodeConfig (bash strom * allow, login/seal/connector add|remove deny, git deny; read data/.git deny; edit notes allow; webfetch/websearch allow), OPENCODE_RUN_AGENT, refused (ask → deny) · src/core/apps.ts opencode (OpenCode.app, opencode://new?cwd=…&q=…) · src/commands/start.ts strom chat (model z opencode.json) · src/agents/launch.ts opencode (--auto) · src/core/agentcli.ts agentCliMissing · src/runners/opencode.ts OPENCODE_WEB · src/runners/runner.ts clean (jen Claude Code, Codex; Grok GROK_CLEAN) · git tagy v1.0.0, v1.4.0 -->

<a id="R12.10"></a>
## R12.10 Computer use

Computer use controls the computer as a person does: screenshots, clicking and typing. strom watches it with no
agent and does not recommend it; it switches nothing in it off or on.

- **Limits:**
  - with computer use the Claude app gives apps levels: a browser only for reading (a screenshot, without clicking
    and typing), a terminal only for clicking (without typing and keys), other apps fully. So computer use cannot
    control the Strom app in a browser or the research in a terminal: the Strom app goes by the page tools in the
    browser (the Claude app's built-in browser, Claude in Chrome; [A9.4](A9-using-the-app.md#A9.4)), the research by
    the command `strom` in the agent's command line;
  - a conversation in the Claude app without the research folder (the Chat tab) has its command line outside the
    computer: `strom` cannot be run in it;
  - Codex's computer use strom's hook leaves alone ([R12.5](#R12.5)). Whether it gives apps levels as the Claude app
    does is not verified ([R12.6](#R12.6));
  - the archives' rules apply the same even where strom does not watch: the pace, "by hand only" ([R9](R9-archives.md)).
- **Method only:** the agent never suggests turning computer use on. When it has it: it controls the Strom app by the
  page tools in the browser, not by points on the screen; the research by the command `strom` in its own command
  line, never by typing into a terminal window; a person's consents and settings (the map's base layer from
  OpenStreetMap, how edits are sent to the research) it leaves to the person and says what waits for them.
- **Controls:** nothing: strom neither switches computer use off nor on. Terminal: `strom doctor`, the row **desktop
  apps' browser**.
- **Since:** research 1.29.0

<!-- zdroj: research:src/agents/files.ts AGENTS.md „## When you have computer use“ (Never suggest turning it on; page tools, not pixels; strom in own command line; consents left to the person; archives' rules) · src/core/codexhook.ts computerUseOnly (sky.*) · src/cli/ui.ts ui.doc.desktop.claude, ui.doc.desktop.codex · CHANGELOG.md 1.29.0 · dirigent:test/vysledek-063-pruzkum.md kolo 1 (úrovně aplikací: prohlížeče read, terminály click, ostatní full; Chat bez složky má shell v cloudu) · spec/063-computer-use-usnadnit K1.3 -->
