<a id="R9"></a>
# R9 Archives: what the agent may do and what a person does

What happens to a task that needs images or pages of a particular archive: by what strom judges the archive, what
the agent may do by itself (downloader, web fetch, browser), when the task waits for a person and how it returns to
the queue. It holds the same for an automatic session (`strom run`, a session started from the Strom app, the night
run) and for a chat with the agent; the differences are in [R9.7](#R9.7). Describes the research 1.27.0 and the
Strom app 3.23.0. Each rule says what is **enforced by the code** (the `strom` command or the agent's hook refuses
it) and what is only a **rule of the method** (an instruction to the agent that the code does not check).

The procedure in brief:

1. **The archive:** strom knows the terms of archives from the list shipped with the research and from other
   sources. The strictest of them decides ([R9.1](#R9.1)).
2. **Permission:** an archive with a restriction is opened only by a person's permission: slowly, through the
   browser, or by hand only ([R9.2](#R9.2)).
3. **The agent by itself:** the archive's downloader (images, [R8.2](R8-reading-scans.md#R8.2)), the web fetch of
   pages ([R9.3](#R9.3)) and the agent's browser in Chrome ([R9.4](#R9.4), [R9.5](#R9.5)) follow the same rules.
4. **Waiting:** where the agent may not go, a person saves the images. The task waits for the images and returns by
   itself once all of them are in the research ([R9.6](#R9.6)).
5. **Decision:** the table and the course of a task are in [R9.8](#R9.8), a person's steps in [R9.9](#R9.9) and
   examples in [R9.10](#R9.10).

> **Note: where exactly the agent's browser applies.** strom watches the agent's browser only with **Claude Code**
> and the **Claude in Chrome** extension, and in the Claude app's built-in browser
> ([R12.2](R12-where-the-agent-works.md#R12.2)). strom cannot watch the browser or computer use of another agent
> (Codex, Antigravity and others): such an agent does not take them of its own accord into an archive only a
> person's browser may enter, and a person saves the images. The built-in browsers and computer use of the agents'
> desktop apps strom does not recommend; the agent uses them only when a person explicitly asks
> ([R9.4.2](#R9.4.2)). Where the agent is talked to and what strom watches where, [R12](R12-where-the-agent-works.md)
> sums up.

<!-- zdroj: research:CHANGELOG.cs.md 1.27.0 · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS, ON_REQUEST · src/core/chromehook.ts:1-25 · app:CHANGELOG.cs.md 3.23.0 -->

<a id="R9.1"></a>
## R9.1 Kinds of archives

Every site the research takes records from has a **level** of terms and may have further limits. The level says what
strom may do automatically; the detailed table of levels is in [R8.2](R8-reading-scans.md#R8.2).

| Entry in the list of archives | What it means |
|---|---|
| level **allowed** | catalogue, pages and images automatically, at the service's pace |
| level **restricted** | catalogue and pages; images only with a person's permission ([R9.2](#R9.2)) |
| level **unknown** | as restricted |
| level **by hand only** | images only by hand; permission does not open it |
| level **forbidden** | no automated access |
| **only through a person's browser** | no web fetch, no catalogue or images through a downloader; at most the agent's browser with the permission "through the browser" ([R9.4](#R9.4)) |
| **pace** | the shortest gap and the most requests per hour; strom never goes faster |
| **forbidden paths** | parts of the site where nothing automated may go, not even the agent's browser |
| **image server** | another site the archive's image viewer takes its images from |
| **terms, quote, date of check** | where the level comes from (the terms page or robots.txt) and when it was verified |

- **Enforced by the code:** the level of an archive is the strictest of: the downloader's reading of the terms, the
  archive's record in the research, the list of archives shipped with the research (`assets/archives.json`), the
  strictest level strom has ever seen at the server, and the robots.txt file. A server whose robots.txt closes the
  whole site to all robots (`Disallow: /`) counts as a site only through a person's browser, with the level
  restricted at least: the agent's browser may go there only with the permission "through the browser", one page at
  a time and at a person's pace ([R9.4](#R9.4)). The exception: the site's terms expressly allow automated use and
  its robots.txt names no AI agents. A server that refused the strom client counts as forbidden.
- **By hand only** (a person always saves the images, permission does not open it) stays what the list of archives
  keeps so:
  - a path to the records that robots.txt closes to all robots (a forbidden path in the list);
  - the level **by hand only**: terms that allow nothing else, or a ban naming AI agents where the list keeps it as
    by hand only (e.g. eBadatelna SOA Praha, [R9.10.3](#R9.10.3)). A ban naming AI in robots.txt does not by itself
    mean by hand only: an archive with one can also be only through a person's browser;
  - an image viewer that takes its images from an image server closed whole to all robots. Such an archive has the
    level **by hand only** in the list (e.g. the reading rooms of ZA Opava and SOA Litoměřice, [R9.10.2](#R9.10.2)).
- **Limits:**
  - an archive only through the browser with the level **by hand only** or with the permission **by hand only**
    allows nothing, not even the agent's browser or the catalogue;
  - the forbidden path `/` (the whole image server) closes the agent's browser too: images by hand only;
  - the sites of one archive (e.g. the digital archive and the reading room of one regional archive) each have their
    own entry; in What waits, however, they show under one archive name ([R9.6](#R9.6)).
- **Why:** the method wants the terms of every archive kept. Where robots.txt lets in only a browser, at most a
  browser goes, with a person's permission and at a person's pace; what the list of archives keeps for a person's
  hand, a person saves.
- **Controls:** terminal: `strom net web --check <address>` (what strom would do with an address), the archives menu,
  `strom allow archive` (a person only). App: Awaiting action.
- **Since:** research 1.14.0. Further archives of Czechia, Germany and Poland and the image server from 1.27.0.

<!-- zdroj: research:src/core/terms.ts:566-680 archiveLevel (robots "Disallow: /" → browserOnly, restricted; robotsYield: openByTerms + robotsNamesAi false), :789-803 allows (browserOnly + manual → nothing) · assets/archives.json (level, browserOnly, pace, disallow, imagesFrom, quote, quoteFrom, checked; metrikai.lt, lagis, gov, online-ofb restricted + browserOnly; ebadatelna.soapraha.cz manual) · src/core/knownterms.ts imagesFrom · test/unit/known-terms.test.ts (imagesFrom closed whole ⇒ manual) · src/core/browserhelp.ts browserHelps (disallow "/") · CHANGELOG.cs.md 1.26.0, 1.27.0 (c3ee4422) -->

<a id="R9.1.1"></a>
### R9.1.1 A site the research does not know

- A site that is not in the list of archives and has no downloader is judged by strom from the archive's record in
  the research, the strictest level seen and robots.txt as strom read it. Without any further figure its level is
  **unknown**, that is as restricted.
- The agent may fetch the pages of such a site, within the limits of [R9.3](#R9.3). Not images: images of an archive
  that is not allowed never go through a web fetch.
- **Controls:** terminal: `strom net web --check <address>`.
- **Since:** research 1.14.0

<!-- zdroj: research:src/core/terms.ts:566-680 archiveLevel (unknown → restricted) · src/core/webgate.ts webGate (images of a non-allowed archive) -->

<a id="R9.2"></a>
## R9.2 A person's permission

An archive with the level restricted or unknown is opened for images only by a person's permission. Permission has
three ways, and only a person gives it.

| Way (terminal) | Text of the choice | What the agent may do |
|---|---|---|
| `--way slow` | Slowly, at a person's pace | images through the downloader, at most one in 10 s and 120 an hour |
| `--way browser` | Through the browser on this computer | the downloader with its way through the browser, or the agent's browser one image at a time ([R9.5](#R9.5)) |
| `--way manual` | By hand only – the images are saved into a folder made ready | nothing; a person saves the images ([R9.6](#R9.6)) |

- **Enforced by the code:**
  - only a person gives permission: in their terminal, or in a system window that shows when the agent or the app
    runs the command. The agent does not see the window and cannot click it. In an automatic session without a
    window the command fails and the agent writes a task for a person;
  - permission holds for the archive in all researches on the computer and is saved in the user's settings. It is
    revoked by the choice **Forget the decision** (`--revoke`): at the next need strom asks again;
  - an archive only through the browser never gets **slowly** (images never through a downloader). An archive only
    through the browser that no downloader leads to gets only **through the browser**, **by hand only**, or
    revoking;
  - the levels **by hand only** and **forbidden** are not opened by permission: `strom allow archive … --way browser`
    (and `slow`) is refused and the app does not offer the link **Permission…**;
  - a person's pace (10 s, 120 an hour) can be changed in the setting `archive.pace` or by `strom allow host --pace
    --per-hour`. The pace from the list of archives is the lower bound: strom always goes at the slower of the two.
- **Limits:** after the decision, the tasks waiting for this archive in all researches on the computer return to the
  queue. With the choice **By hand only**, tasks for images saved by hand go on waiting. A task whose images already
  lie in the folder does not return: the images are taken in ([R9.6](#R9.6)). A task **a site to check** never wakes
  ([R6.2.2](R6-awaiting-action.md#R6.2.2)).
- **Why:** only a person may make an archive milder or open it; the agent may only make an archive stricter.
- **Controls:** terminal: `strom allow archive <site|downloader> --way slow|browser|manual`, `--revoke`, the archives
  menu. App: the link **Permission…** in the note at an item that waits for images of an archive only through the
  browser, and in the row **Browser** ([R9.4.3](#R9.4.3)). It opens the question in the research in the terminal,
  even when no downloader leads to the archive.
- **Since:** research 1.14.0. Permission for an archive only through the browser without a downloader, and
  **Permission…** for it, from 1.27.0.

<!-- zdroj: research:src/commands/archives.ts:575-738 allow archive (requireHuman :687, browserOnly + slow refused, bareArchive) · src/cli/context.ts:253 requireHuman · src/core/archivewait.ts:188 wakeForArchive (manual + images kept, saved in inbox) · src/core/terms.ts:1018 humanPace · src/core/net.ts:45 HUMAN_PACE · assets/lang/cs.json ui.archive.way.* · commit 74dcd58b -->

<a id="R9.3"></a>
## R9.3 The agent's web fetch

The pages of a site (catalogue, search results, the description of a book) are fetched by the agent with its web
tool. strom checks it by a hook before every fetch and counts the requests to each site.

- **Enforced by the code (the agent's hook and `strom net web --check`):**
  - an archive that is forbidden, or a site that refused the strom client: only the terms page, at most 3 times a
    day, and robots.txt;
  - an archive only through a person's browser: no web fetch. The agent gets advice: the permission "through the
    browser", or waiting for images (`strom task wait T… --images B…:<numbers>`);
  - an archive by hand only, the permission by hand only and a forbidden path from the list of archives: by hand
    only, not even the agent's browser;
  - a path that robots.txt forbids: refused;
  - images of an archive that is not allowed: never through a web fetch.
- **Limits:**
  - after 12 requests to one site in a session, at most one request in 6 s goes to the whole site, and strom advises
    a downloader;
  - after 30 requests to one site in a session (setting `web.perHost`): refused in an automatic session; in a chat
    strom asks the person once per session and site;
  - strom waits at most 30 s for a free slot; it also refuses when the site is one strom leaves alone, or has used up
    its limit or its hourly cap.
- **Method only:** for a refused site, another way first. The search is recorded with the result inconclusive
  (`strom search add … --result inconclusive`). Only when the source is still needed does the task wait for a person
  to check the site (`strom task wait --check`, [R6.2.2](R6-awaiting-action.md#R6.2.2)).
- **Why:** web fetches and the agent's browser are counted and slowed together, so that no way goes faster than
  another.
- **Controls:** terminal (agent): `strom net web --check <address>`.
- **Since:** research 1.14.0

<!-- zdroj: research:src/core/webgate.ts webGate (TERMS_PER_DAY, browserOnly advice, otherWay) · src/core/web.ts WEB_SOFT 12, WEB_SOFT_GAP_MS, WEB_PER_HOST 30, WEB_WAIT_MAX_MS · src/core/config.ts web.perHost · assets/method/locate.md -->

<a id="R9.4"></a>
## R9.4 The agent's browser

The agent's browser is Chrome with the **Claude in Chrome** extension, driven by **Claude Code**. Before every page it
opens, strom decides the same way as for a web fetch ([R9.3](#R9.3)), only on the way of a person's browser. The
Claude app's built-in browser it watches the same way ([R12.2](R12-where-the-agent-works.md#R12.2)).

- **Enforced by the code (a hook before a page opens):**
  - an archive only through a person's browser and images of an archive with a restriction open only with the
    permission **through the browser**, one page at a time, at a person's pace. Forbidden paths from the list of
    archives stay closed;
  - an archive that is forbidden, a site that refused the strom client, a path forbidden in robots.txt, images by
    hand only and the bridge to the Strom app: refused;
  - each page opened is written down, counted and slowed together with the fetches of the same site (the same limits
    as [R9.3](#R9.3));
  - the tools on a page (clicking, reading the page, a script) are checked by the site last opened in the tab. A site
    that strom now leaves alone is refused; nothing else is counted;
  - uploading a file, uploading an image, shortcuts, GIF recording and a batch of actions are forbidden to the agent.
- **Limits:** the hook sees neither a click nor an address typed into the page, nor the requests the page makes by
  itself. Hence the rule: from page to page of an archive only by opening the address, never by clicking through a
  series of pages.
- **Method only:** the agent never passes or gets around a check that a person is at the computer (Altcha, CAPTCHA,
  a bot check).
- **Why:** only with Claude Code can strom run a hook before a page opens; other agents have no such hook (verified on
  4 November 2026).
- **Controls:** terminal: `strom doctor` (the row **browser (Claude in Chrome)**), `strom agents use claude`.
- **Since:** research 1.27.0

<!-- zdroj: research:src/core/chromehook.ts:1-25 (navigate, page tools, what the hook cannot see) · src/core/webgate.ts browserGate · src/core/browser.ts CHROME_DENY · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS · assets/lang/cs.json ui.doc.browser · CHANGELOG.cs.md 1.27.0 -->

<a id="R9.4.1"></a>
### R9.4.1 When a session gets Chrome

- The setting `agent.browser` holds for the Claude Code sessions that strom starts:
  - **archives** (default): Chrome only in a research whose downloader downloads through the browser, or with an
    archive only through the browser with the permission **through the browser**, for their sites;
  - **always**: Chrome in every session, for the sites of the research's archives; for other sites the chat asks.
    Only a person turns it on.
- An automatic session turns Chrome on by the task: not for stories and queries; yes for a book from a downloader
  through the browser, for an archive only through the browser with permission and for a site the research does not
  know. A chat gets Chrome by the setting above.
- In an automatic session the agent cannot switch to another browser or ask a person.
- **Controls:** terminal: `strom config set agent.browser archives|always`.
- **Since:** research 1.14.0. An archive only through the browser with permission from 1.27.0.

<!-- zdroj: research:src/core/connector.ts agentBrowser, sessionBrowser · src/commands/start.ts:244 chrome · src/runners/claude.ts RUN_DISALLOWED (AskUserQuestion, switch_browser) · src/core/config.ts agent.browser -->

<a id="R9.4.2"></a>
### R9.4.2 Built-in browsers and computer use: not recommended

- Nothing of the agents' desktop apps is switched off in the research. The Claude app's built-in browser (its preview
  too) strom watches as it does Claude in Chrome ([R12.2](R12-where-the-agent-works.md#R12.2)). Computer use of the
  Claude app and the browser and computer use of the ChatGPT app (Codex) strom does not watch
  ([R12.5](R12-where-the-agent-works.md#R12.5)). None of them strom recommends.
- **Method only:** the agent does not use them of its own accord: it does not take them into an archive only a
  person's browser may enter, and a person saves the images ([R9.6](#R9.6)). When a person explicitly asks for them,
  it is the person's choice: the agent says in one sentence whether strom watches that way and what the archive's
  terms say. It never gets around the terms and never passes a check that a person is at the computer.
- The agent never works in a copy of the research that the agent's desktop app opens in its own worktree.
- **Why:** before the unwatched ones strom has no hook, so it does not check the pages they open. The archive's
  downloader, the web fetch of pages and the agent's browser in Chrome always follow the archives' rules
  ([R9.3](#R9.3), [R9.4](#R9.4)).
- **Controls:** terminal: `strom doctor`, the row **desktop apps' browser**.
- **Since:** research 1.27.0; 1.29.0: the Claude app's built-in browser watched
<!-- zdroj: research:src/core/browserhelp.ts ON_REQUEST, browserKept · src/core/browser.ts CODEX_BROWSER_SERVERS, Claude_Browser matcher · src/brief/brief.ts · src/commands/guide.ts · src/commands/setup.ts:527 desktop · assets/lang/cs.json ui.doc.desktop.unwatched · CHANGELOG.cs.md 1.27.0, 1.29.0 · commit 6968ab72 (agent řekne, zda strom cestu hlídá) -->

<a id="R9.4.3"></a>
### R9.4.3 The browser's state in strom doctor and the app

The row **browser (Claude in Chrome)** in `strom doctor`, for archives only through the browser that the research
works with:

| State | What the row says |
|---|---|
| an agent other than Claude Code | only through a person's browser; with Claude Code and the extension the agent would save the images itself, with this agent they are saved by hand (advice `strom agents use claude`) |
| the extension is missing | only through a person's browser; with the Claude in Chrome extension the agent would save the images itself, until then by hand (with a link to the extension) |
| permission is missing | with the permission "through the browser" for the archive the agent saves the images itself |
| all ready | the agent saves the images itself through the browser |

- The agent's brief and What waits give the same advice once ([R9.6](#R9.6)).
- The app shows the row **Browser** under the row **Agent** in the dialogs **Research for this tree** and **The
  research is ready**: **Claude in Chrome connected.**, with browser-only archives **… the agent also downloads from
  browser-only archives** (without permission for some: **No permission yet:** the first three archives, each with
  the link **Permission…**), **The Claude in Chrome extension is missing – images from browser-only archives are
  saved by hand.**, or for another agent **strom does not watch this agent's browser**. At an item that waits for
  images of such an archive, the same advice stands as a note. A research that serves as an archive has no such row.
- **Controls:** terminal: `strom doctor`. App: the dialog **Research for this tree**, Awaiting action.
- **Since:** research 1.27.0

<!-- zdroj: research:src/commands/setup.ts:490-516 · src/core/browserhelp.ts browserState, agentBrowserAdvice, personBrowserNote · assets/lang/cs.json ui.doc.browser.archives.* · app:src/research-browser.ts:75-98 browserRow, :170-201 browserNote · src/ui/research-browser-ui.ts:96-144 · src/strings.ts research.browser -->

<a id="R9.5"></a>
## R9.5 An image through the agent's browser

Where a person gave an archive only through the browser the permission **through the browser**, the agent saves the
images itself, one at a time: it opens the image in Chrome and saves what the archive's image viewer shows.

- **Enforced by the code:**
  - only Claude Code with the Claude in Chrome extension and with the permission **through the browser**; otherwise
    the command refuses and says what is left to do;
  - the image's address passes the check of the agent's browser ([R9.4](#R9.4));
  - only an image that the tab shows at its own address is saved. A viewer moved to another image is refused and
    nothing is saved. Never more than the archive's viewer gives, never larger than the original;
  - the command sets the task to waiting for that image. The file is saved into the downloads folder
    (`strom-T…-<number>.jpg`), and `strom media add --inbox --waiting` moves it into the task's folder under the
    image's number ([R9.6](#R9.6)).
- **Limits:** Chrome saves only one file from one page. Further downloads from the same page must be allowed by a
  person in Chrome's address bar; the agent never changes Chrome's settings.
- **Method only:** a downloader for an archive whose viewer shows images in tiles also saves through the browser,
  even part of an image; it opens the book's page once and never reloads it.
- **Why:** the permission "through the browser" allows what a person would do in their own browser, at their pace.
- **Controls:** terminal (agent): `strom media save T… --image <number> --at <address> [--recordset B…]`, then
  `strom media add --inbox --waiting`.
- **Since:** research 1.27.0

<!-- zdroj: research:src/commands/media.ts:1206-1294 media save (browserGate, guarded browser, permission browser, Downloads strom-T…-n.jpg) · commit dadd91e7 (viewer paged on) · src/core/browserhelp.ts agentBrowserAdvice · src/agents/files.ts:80-95 · CHANGELOG.cs.md 1.27.0 -->

<a id="R9.6"></a>
## R9.6 Waiting for images and the task's return

Where the agent does not get the images, the task waits for a person. The research names the book and the numbers
of the images and prepares a folder for them. The task returns to the queue by itself once all its images are in the
research.

- **Enforced by the code:**
  - `strom task wait T… --images B…:<numbers>` prepares the folder `inbox/<B… book title>` in the shared folder (the
    name at most 80 characters);
  - a file carries the number of the image (`40.jpg`, `9a.jpg`). Files named otherwise are numbered in order when
    there are as many of them as images missing;
  - a file is taken in once it has not changed for 3 s (a large scan is never taken in half-written);
  - taking in: at once while the bridge to the Strom app runs (it looks into the folders of waiting tasks, again
    every 30 s); otherwise at the start of the next session; or at once by the command
    `strom media add --inbox --waiting`;
  - the task returns once all images are there, with a note of what came. With only some of them it goes on waiting,
    and What waits shows how many of how many are saved and which are missing;
  - images from the app go straight to the task: numbered by the image the app gives, otherwise by the file name,
    otherwise in the order of the missing ones; a PDF page by page. An image with a number the research already has
    is refused unless it is to replace it; a replaced one is never deleted. A file identical to another image already
    taken in (another number or book) is refused and nothing is taken in. The same file sent again under the same
    number changes nothing and is reported as saved;
  - an answer written in the app returns the task just as an answer in the terminal does, and is saved with a note
    that it came from the app. A task that meanwhile waits for something else stays unchanged.
- **Limits (when images return a task):**
  - a task waiting for images is returned only by its book, and only once all images are there;
  - a task waiting for a site (`--kind web`) is returned by the book it names, or by the only book it works in;
  - a letter and a request to the family are returned only by the book they name;
  - a task waiting for a person to check a site is never returned (only a person answers).
- **Method only (the method, `strom guide` and the agent's brief alike):** for images by hand, the agent names the
  book, the numbers of the images, the format (JPEG), the file name and the folder. It opens and downloads nothing
  itself, not even with a browser. The one exception: at an archive only through a person's browser that the person
  gave the permission **through the browser** and that no downloader leads to, Claude in Chrome saves the images one
  at a time with `strom media save` ([R9.5](#R9.5)). Nothing else is opened or downloaded there; a check that a
  person is at the computer is passed only by a person.
- **Why:** the images are what the task waited for; part of the images does not finish the task.
- **Controls:** terminal: `strom task wait T… --images B…:40-45`, `strom media add --inbox --waiting`, in What waits
  **Open the folder ({have}/{want} saved)**. App: Awaiting action, at the item in this order **Add images**, **Open
  website ↗**, **Answer**, **Discuss with the agent**, **Open folder** (the last two open the research in the
  terminal). The state of the images shows "1 of 2 images" and, at the book, the chips **saved** / **missing**. The
  sites of one archive wait in one group **Archive** under the archive's name, with the link **Archive website ↗**
  and the number of images missing.
- **Limits (the archive's group):** the group is the research's archive the task belongs to: by the task's book, the
  archive's address, the address of its book, another site of the same archive by the list of archives, or the
  archive's name. Only where the research has no such archive is the group an archive from the list of archives;
  otherwise the site itself.
- **Limits (app):** an answer of at most 4000 characters; a task waiting for a site to be checked is answered only in
  the terminal. On a phone images are not added and the terminal is not opened.
- **Since:** research 1.0.0 (a folder in the inbox), waking after saving from 1.15.0. Taking in without a command,
  part of the images, the answer and images from the app and an archive under one name from research 1.27.0 and app
  3.23.0.

<!-- zdroj: research:src/commands/tasks.ts:1041 task wait (--images, folder) · src/core/media.ts:117 inboxFolderFor · src/core/inboxwait.ts:25 SETTLE_MS · src/core/inboxwatch.ts:1-8 (30 s) · src/commands/media.ts:141-180 wakeWaiting · src/core/live.ts waiting/<T> answer, PUT /media (X-Strom-Task, X-Strom-Image, 409 waiting.image-same) · src/commands/media.ts:403-478 (same sha under its number → 200 same: true, added []; another number/book → 409 waiting.image-same) · src/core/waiting.ts actionsOf, archiveGroup · src/core/waitkind.ts waitGroupOf (repo: before archive:, host:) · assets/method/waiting.md "Images saved by hand" (the one exception, 7bd55fa1) · assets/method/reading.md · src/commands/guide.ts rule 7 · src/agents/files.ts:80-95 · CHANGELOG.cs.md 1.27.0 · app:CHANGELOG.cs.md 3.23.0 · src/research-waiting.ts:216-272 (actions, order), :448-488 assignImages · src/research-waiting-write.ts:532 WAITING_ANSWER_MAX · src/ui/research-overview-ui.ts:698-812 group head · src/strings.ts live.waitingTask -->

<a id="R9.7"></a>
## R9.7 An automatic session and a chat

The rules of archives are the same in both. They differ in who is present and what happens at a limit.

| | Automatic session (`strom run`, the app, the night run) | Chat with the agent |
|---|---|---|
| Chrome | by the task ([R9.4.1](#R9.4.1)) | by the setting `agent.browser` |
| the agent's question to a person | none (AskUserQuestion off) | yes |
| switching the browser | off | allowed |
| more than 30 requests to a site | refused | strom asks once per session and site |
| an archive's permission | nobody is present: the command fails, the agent writes a task for a person and goes another way | a system window for the person, only where the system shows it |
| images the agent does not get | the task waits for images, the session goes on with another task | the same; a person can save the images at once and the agent takes them in by the command |

- **Limits:** the agent never writes for a person: neither permission, nor the answer to checking a site, nor the
  answer to a wait. In a chat they stay a person's just the same.
- **Controls:** see [R7](R7-when-the-agent-works.md) (when and how long a session runs).
- **Since:** research 1.14.0. The agent's browser from 1.27.0.

<!-- zdroj: research:src/runners/claude.ts RUN_DISALLOWED · src/core/web.ts WEB_PER_HOST (STROM_NONINTERACTIVE) · src/cli/context.ts:253 requireHuman (run: task for the person) · src/core/connector.ts sessionBrowser, agentBrowser · src/commands/start.ts:244 -->

<a id="R9.8"></a>
## R9.8 What happens to a task: a table

A task needs images of a book from a particular archive. The row is chosen by the archive and the permission. Where
the table says "Claude + Chrome", it means Claude Code with the Claude in Chrome extension and with Chrome running.

| Archive | Permission | Agent | What the agent does | How the task ends |
|---|---|---|---|---|
| allowed | not needed | any | downloader: catalogue and images at the service's pace; without a downloader the agent builds one | images in the research, reading ([R8](R8-reading-scans.md)) |
| restricted or unknown | none | any | catalogue and pages; no images; the downloader asks the archive's question | waits for permission ([R6.3.1](R6-awaiting-action.md#R6.3.1)) |
| restricted or unknown | slowly | any | images through the downloader at a person's pace | images in the research |
| restricted or unknown | through the browser | Claude + Chrome | the downloader on its way through the browser | images in the research |
| only through the browser | through the browser | Claude + Chrome | `strom media save`, image by image | images in the research, the task returns |
| only through the browser | none | Claude + Chrome | nothing in the archive; `task wait --images` | waits for images; What waits offers permission |
| only through the browser | any | another agent or without the extension | nothing in the archive; `task wait --images` | waits for images, a person saves them |
| only through the browser | by hand only | any | nothing; `task wait --images` | waits for images, a person saves them |
| by hand only, forbidden path `/`, image server closed whole | permission does not open it | any | nothing; `task wait --images` | waits for images, a person saves them |
| forbidden, refused the client | permission does not open it | any | only the terms page and robots.txt; another way | search inconclusive; if the source is needed, a site to check ([R6.2.2](R6-awaiting-action.md#R6.2.2)) |

- **Limits:** fetching the pages of a site (catalogue, description of a book) follows [R9.3](#R9.3) independently of
  the images.
- **Since:** research 1.27.0

<!-- zdroj: research:src/core/terms.ts:789-803 allows · src/core/webgate.ts webGate, browserGate · src/core/browserhelp.ts agentBrowserAdvice, browserHelps · src/commands/media.ts:1206 media save · src/commands/tasks.ts:1041 task wait -->

<a id="R9.8.1"></a>
### R9.8.1 The course of a task waiting for images

1. An **open** task needs images of the book B….
2. If the downloader may download them ([R9.8](#R9.8)), they are downloaded and the task goes on with reading. End.
3. Otherwise the agent sets `strom task wait T… --images B…:40-45`. The task is in the state **waiting**, in What
   waits under the archive's name, with a folder in the inbox.
4. With the permission **through the browser** and with Claude + Chrome, the agent saves the images itself
   ([R9.5](#R9.5)) and takes them in.
5. Otherwise a person saves the images into the folder or sends them from the app (**Add images**) ([R9.9](#R9.9)).
6. Taking in: the bridge at once, otherwise the start of the next session, or the command
   `strom media add --inbox --waiting`.
7. If all images are there, the task is **open** again in the queue, with a note of what came. If some are missing,
   it goes on waiting, and What waits shows which are missing (back to step 5).
8. At any time in between: a person's answer (in the app or `strom task wake T… --answer`) returns the task with the
   answer. The permission **slowly** or **through the browser** returns the tasks waiting for the archive that have
   nothing in the folder yet.

- **Since:** research 1.27.0, Strom app 3.23.0

<!-- zdroj: research:src/commands/media.ts:141 wakeWaiting · src/core/archivewait.ts:188 wakeForArchive · src/core/inboxwatch.ts · src/commands/session.ts takeWaiting · src/core/live.ts waiting answer -->

<a id="R9.9"></a>
## R9.9 What a person does

The steps for a task that waits for images of an archive where the agent may not go:

1. **Find:** app: **Awaiting action** (a group by archive). Terminal: the menu **What waits (n)** or the status line
   **Waiting: N**. The item names the book, the numbers of the images and what is missing for it.
2. **Decide the way:**
   - with Claude Code and the Claude in Chrome extension, the archive can be given the permission **through the
     browser** (app: the link **Permission…** in the note at the item; terminal `strom allow archive <site> --way
     browser`). The task returns and the agent saves the images itself ([R9.5](#R9.5));
   - otherwise, or for an archive by hand only, save the images by hand (the next steps).
3. **Open the book** in a browser on the archive's site, with the login and a person's check where the archive wants
   them.
4. **Save the images** with the numbers the item gives, as JPEG, named by the image's number (`40.jpg`, `41.jpg`),
   into the task's folder (**Open folder** in the app, **Open the folder** in the terminal). Or add them in the app on
   a computer through **Add images** (also by dragging onto the item); the app takes the image's number from the file
   name, otherwise it gives them in order.
5. **Done:** with the bridge to the app, the images are taken in by themselves; otherwise at the next session, or at
   once by `strom media add --inbox --waiting`. If some are missing, What waits says so.
6. **It does not work:** an answer in words (app **Answer**, terminal `strom task wake T… --answer "<what>"`) returns
   the task with the answer, e.g. that the book is not online.

- **Limits:** permission, the answer and saving the images are a person's only; the agent does not do them for a
  person ([R6.6](R6-awaiting-action.md#R6.6)).
- **Controls:** app: Awaiting action. Terminal: What waits, `strom allow archive`, `strom media add --inbox --waiting`.
- **Since:** research 1.27.0, Strom app 3.23.0

<!-- zdroj: research:assets/method/waiting.md "Images saved by hand" · src/core/waiting.ts actionsOf · src/core/browserhelp.ts personBrowserNote · app:CHANGELOG.cs.md 3.23.0 -->

<a id="R9.10"></a>
## R9.10 Examples

The levels and limits are from the list of archives of the research 1.27.0, DigiArchiv SOA Třeboň from the research
1.28.0. The Horák family is made up.

<a id="R9.10.1"></a>
### R9.10.1 Moravský zemský archiv (Acta Publica)

- Archive: restricted, only through a person's browser, pace at least 4 s. The census returns (`/scitacioperaty/`)
  are, according to the archive, only for viewing: a forbidden path, not even the agent's browser; a person saves the
  image.
- Task: the baptism of Marie Horáková in a parish register in Acta Publica. Neither the downloader nor a web fetch gets
  into the archive.
- With Claude Code, the extension and the permission **through the browser**: the agent opens the image and saves it
  with `strom media save`, at a person's pace (10 s; the archive's pace of 4 s is the lower bound). The task returns
  once it has all its images.
- Without permission or with another agent: the task waits for images; What waits says with what the agent would
  save them itself.
- A downloader built for this archive earlier is refused by strom before any request, even its test. A permission
  "slowly" from earlier stays saved, but images no longer go through the downloader.
- **Since:** research 1.27.0

<!-- zdroj: research:assets/archives.json mza.cz (restricted, browserOnly, pace 4000, disallow /scitacioperaty/) · CHANGELOG.cs.md 1.27.0 (Acta Publica) -->

<a id="R9.10.2"></a>
### R9.10.2 Zemský archiv v Opavě (digi.archives.cz)

- Archive: by hand only, only through a person's browser. robots.txt closes the whole site to all robots and the
  pages are protected by a check that a person is at the computer. The image viewer takes its images from the image
  server images.archives.cz, which robots.txt closes whole too. No downloader leads to the archive. The digital
  reading room of SOA Litoměřice is the same (digi.soalitomerice.cz, images from images.soalitomerice.cz).
- The permission **through the browser** cannot be given here: `strom allow archive digi.archives.cz --way browser`
  is refused, the app does not offer the link **Permission…** and `strom media save` does not save the image. The
  agent's browser would ask the closed image server for every image.
- Task: the marriage of Marie Vlková. The agent sets `strom task wait T… --images B…:12-13`.
- The only way is waiting for images: What waits in the app shows the task under the archive's name with a folder.
  A person opens the book in their own browser and saves images 12 and 13 (`12.jpg`, `13.jpg`) through **Open
  folder**, or adds them through **Add images**. The task returns.
- **Since:** research 1.27.0

<!-- zdroj: research:assets/archives.json digi.archives.cz, digi2.archives.cz, digi.soalitomerice.cz (manual, browserOnly, quoteFrom robots, imagesFrom images.archives.cz / images.soalitomerice.cz; commit 69902466) · src/core/terms.ts allows (browserOnly + manual) · src/commands/archives.ts:676-680 (manual/forbidden: no permission) · src/core/browserhelp.ts browserHelps, treeBrowserArchives (never by hand only) · test/cli/media-save.test.ts (digi.archives.cz) · CHANGELOG.cs.md 1.27.0 -->

<a id="R9.10.3"></a>
### R9.10.3 eBadatelna SOA Praha

- Archive: by hand only, only through a person's browser; robots.txt names AI tools and blocks them.
- The task always waits for images that a person saves. Permission does not open it; neither the agent's browser nor
  a web fetch may go there.
- **Since:** research 1.27.0

<!-- zdroj: research:assets/archives.json ebadatelna.soapraha.cz (manual, browserOnly, disallow /d/ /a/) · src/core/terms.ts allows (browserOnly + manual) -->

<a id="R9.10.4"></a>
### R9.10.4 Matricula

- Archive: allowed (terms CC BY-NC-ND), the image server too. The list of archives forbids some paths (search,
  paging through pages); they stay closed.
- Task: the burial of Marie Horáková in a Bavarian parish. The downloader downloads only the images needed, at the
  service's pace, without permission and without waiting. Without a downloader the agent builds one
  ([R8.2](R8-reading-scans.md#R8.2)).
- **Since:** research 1.14.0

<!-- zdroj: research:assets/archives.json data.matricula-online.eu (allowed, disallow /*?pg=, /*/suchen), hosted-images.matricula-online.eu (allowed) -->

<a id="R9.10.5"></a>
### R9.10.5 Szukaj w Archiwach

- Archive: restricted, only through a person's browser; the site is protected by a service against robots.
- Without permission the task waits for images. With the permission **through the browser** and with Claude + Chrome
  the agent saves them itself, as in [R9.10.1](#R9.10.1).
- **Since:** research 1.27.0

<!-- zdroj: research:assets/archives.json szukajwarchiwach.gov.pl (restricted, browserOnly) -->

<a id="R9.10.6"></a>
### R9.10.6 DigiArchiv SOA Třeboň

- Archive: by hand only, only through a person's browser. The terms on DigiArchiv's opening page (`/Uvod`): “Snímky
  jsou poskytnuty pouze za účelem on-line prohlížení v DigiArchivu SOA v Třeboni, jejich kopírování, distribuování,
  prodávání, využití v jiných projektech a na jiných stránkách je zakázáno.” (The images are provided only for online
  viewing in DigiArchiv of SOA Třeboň; copying, distributing, selling and using them in other projects and on other
  sites is forbidden.) The server refuses strom's requests (403), on purpose according to the archive.
- The archive confirmed: a person may save by hand only selected images, never a whole book or a substantial part of
  it. Download tools are not allowed, nor is the agent's browser.
- Task: the entry of Marie Horáková in a register in DigiArchiv. The task always waits for images that a person
  selects and saves. Permission does not open it; neither a downloader, a web fetch nor the agent's browser may go
  there.
- Citation: the permanent link to an image is the address of its page `https://digi.ceskearchivy.cz/<book>/<image>`,
  or **Odkaz na snímek** (link to the image) in the panel **POPIS**.
- **Since:** research 1.28.0

<!-- zdroj: research:assets/archives.json digi.ceskearchivy.cz (manual, browserOnly, terms https://digi.ceskearchivy.cz/Uvod, quote, robots 403, scope, checked 2026-11-05), www.ceskearchivy.cz (stejné terms/quote) · src/core/terms.ts allows (browserOnly + manual) · CHANGELOG.cs.md 1.28.0 · znalosti/archivy-cz.md „SOA v Třeboni (DigiArchiv)“ (odpověď archivu 5. 11. 2026) · commit 805b871d -->
