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
6. **Census records:** an optional source that only a person switches on; since research 1.36.0 ([R9.12](#R9.12)).

> **Note: where exactly the agent's browser applies.** strom watches the agent's browser with **Claude Code** and
> the **Claude in Chrome** extension, in the Claude app's built-in browser
> ([R12.2](R12-where-the-agent-works.md#R12.2)) and in the browser of Codex in the terminal by the addresses in its
> code, when a person has confirmed strom's hook ([R12.5](R12-where-the-agent-works.md#R12.5)). The ChatGPT app's
> (Codex) browser runs through ChatGPT's cloud and strom does not watch it
> ([R12.5.1](R12-where-the-agent-works.md#R12.5.1)). strom cannot watch the browser of
> another agent (Antigravity and others) or the computer use of any agent: the agent does not take them of its own
> accord into an archive only a person's browser may enter, and a person saves the images. The built-in browsers and computer use of the agents'
> desktop apps strom does not recommend; the agent uses them only when a person explicitly asks
> ([R9.4.2](#R9.4.2)). Where the agent is talked to and what strom watches where, [R12](R12-where-the-agent-works.md)
> sums up.

<!-- zdroj: research:CHANGELOG.cs.md 1.27.0, 1.29.0, 1.30.0 · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS, ON_REQUEST, codexInChatgptApp (v1.30.0, 33ac2e38) · src/core/chromehook.ts:1-25 · src/core/codexhook.ts · app:CHANGELOG.cs.md 3.23.0 -->

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
- **From research 1.37.0:** a book recorded in the research under an archive whose address is on a portal from the
  list of archives (e.g. Porta fontium, Acta Publica) no longer makes the portal as strict as that archive: the
  portal follows its own terms and the other sources. An archive's own portal at another address, for which the list
  gives the terms on the archive's website (e.g. eBadatelna SOA Praha), the archive still holds. A level that strom
  holds from before stays until a person decides in What waits. Where the archive's record holds a site through a
  book, `strom doctor`, the question in What waits and `strom allow archive` name the archive, the book and the site:
  "the research's record of the archive R… (…) through its book … on … (strom recordset show …)".
- **Why:** the method wants the terms of every archive kept. Where robots.txt lets in only a browser, at most a
  browser goes, with a person's permission and at a person's pace; what the list of archives keeps for a person's
  hand, a person saves.
- **Controls:** terminal: `strom net web --check <address>` (what strom would do with an address), the archives menu,
  `strom allow archive` (a person only). App: Awaiting action.
- **Since:** research 1.14.0. Further archives of Czechia, Germany and Poland and the image server from 1.27.0. A
  portal from the list by its own terms, not by the book of another archive, from 1.37.0.

<!-- zdroj: 1.37.0: research:91631d2e, 66a521fa src/core/terms.ts listStates, treeLevel (kniha jen tam, kde seznam podmínky webu neuvádí; vlastní portál archivu s podmínkami na webu archivu drží), src/core/floor.ts FloorHold tree recordset, holdText, floorWhat · cs.json ui.archive.floor.hold.treeSet · CHANGELOG.cs.md 1.37.0 -->
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
- **From research 1.37.0 (a used-up limit):**
  - after `web.perHost` pages the agent hears when the site will give pages again: none more in this session, or from
    a certain time (the limit of this computer, the pages of all sessions over the time of one session). The task
    stays open, never done or given up because of the limit; until then other work, otherwise the end of the session.
    A page of the site is not tried again earlier and nobody waits for the limit; after the third refusal of the same
    site in a session the agent hears that it should end the session;
  - `strom run` leaves out for now a task whose work leads to such a site (saving an image by the agent's browser, or
    a book only on that site without a downloader) and takes another one: "· T… left for now: the pages of … for this
    computer are used up until …". A session on such a site starts once at least a third of the limit is free (10 of
    the default 30);
  - when there is no other task: a run with `--loop` or `--until` waits (without an agent, nothing is sent; "⏸ waiting
    until … — the tasks left need pages of …"), another run ends and says when ("nothing to do until … — …"). For the
    Strom app this is a finished run, not an error;
  - a task waiting for an image that the agent's browser never saved (the page refused) goes back to the queue with
    the end of the session; it is never said of it that the browser held it back.
- **Method only:** for a refused site, another way first. The search is recorded with the result inconclusive
  (`strom search add … --result inconclusive`). Only when the source is still needed does the task wait for a person
  to check the site (`strom task wait --check`, [R6.2.2](R6-awaiting-action.md#R6.2.2)).
- **Why:** web fetches and the agent's browser are counted and slowed together, so that no way goes faster than
  another.
- **Controls:** terminal (agent): `strom net web --check <address>`; `strom run`.
- **Since:** research 1.14.0; the used-up limit from 1.37.0

<!-- zdroj: 1.37.0: research:ce89202a src/core/web.ts ManyWhen, whenText, WEB_REFUSED_LOOP 3, manyText · src/core/webfull.ts (runWebFree perHost/3, WebFull) · src/core/machine.ts siteFreeAt · src/commands/session.ts:1311-1390 webOut, gateHolds (--loop, --until), stopCode web · cs.json ui.run.skip.web, ui.run.web.wait, ui.run.stop.web · CHANGELOG.cs.md 1.37.0 „Vyčerpaný limit webu“ -->
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
  too) strom watches as it does Claude in Chrome ([R12.2](R12-where-the-agent-works.md#R12.2)). The ChatGPT app's
  (Codex) browser runs through ChatGPT's cloud and strom does not watch it, whether strom's hook in Codex is
  confirmed or not; the sites are decided by ChatGPT's dialog ([R12.5.1](R12-where-the-agent-works.md#R12.5.1)).
  The browser of Codex in the terminal strom watches by the addresses in its code, once a person confirms strom's
  hook ([R12.5](R12-where-the-agent-works.md#R12.5)). Computer use of the Claude app and of the ChatGPT app strom does not
  watch ([R12.10](R12-where-the-agent-works.md#R12.10)). None of them strom recommends.
- **Method only:** the agent does not use them of its own accord: it does not take them into an archive only a
  person's browser may enter, and a person saves the images ([R9.6](#R9.6)). When a person explicitly asks for them,
  it is the person's choice: the agent says in one sentence whether strom watches that way and what the archive's
  terms say. It never gets around the terms and never passes a check that a person is at the computer.
- The agent never works in a copy of the research that the agent's desktop app opens in its own worktree.
- **Why:** before the unwatched ones strom has no hook, so it does not check the pages they open. The archive's
  downloader, the web fetch of pages and the agent's browser in Chrome always follow the archives' rules
  ([R9.3](#R9.3), [R9.4](#R9.4)).
- **Controls:** terminal: `strom doctor`, the row **desktop apps' browser**.
- **Since:** research 1.27.0; 1.29.0: the Claude app's built-in browser and Codex's browser watched; 1.30.0: the
  ChatGPT app's browser strom does not watch

<!-- zdroj: research:src/core/browserhelp.ts ON_REQUEST, browserKept · src/core/browser.ts CODEX_BROWSER_SERVERS, Claude_Browser matcher · src/brief/brief.ts · src/commands/guide.ts · src/commands/setup.ts:527 desktop · assets/lang/cs.json ui.doc.desktop.unwatched · CHANGELOG.cs.md 1.27.0, 1.29.0 · research:v1.30.0 (33ac2e38) src/core/browserhelp.ts codexInChatgptApp, browserKept; src/cli/ui.ts ui.doc.desktop.codex; CHANGELOG.md 1.30.0 · dirigent:test/vysledek-062-u4-codex.md · 1.29.0 (53dba68d; dev 6968ab72): agent řekne, zda strom cestu hlídá -->

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
  - saving waits until the archive's viewer shows the whole image, 30 s at most (a browser that draws the tab slowly: [R9.5.2](#R9.5.2)). Since research 1.31.0 only the time
    while the browser draws the tab counts (it does not draw a tab behind another tab or in a covered or minimized
    window). A tab not drawn for 30 s is reported as such ("the browser did not draw the tab with the viewer for 30 s
    …": the tab in front, its window uncovered, then the script again); a viewer that meanwhile pages to another
    image saves nothing;
  - the command sets the task to waiting for that image. The file is saved into the downloads folder as
    `strom-<research mark>-T…-<number>.jpg` (e.g. `strom-3f2a9c1b-T0007-0040.jpg`, the image's number in four
    digits), and `strom media add --inbox --waiting` moves it into the task's folder under the image's number
    ([R9.6](#R9.6));
  - the research mark is the first 8 hexadecimal characters of the research's id. All researches on the computer
    share the downloads folder: a file of another research is never taken. A file saved before research 1.33.0
    (`strom-T…-<number>.jpg`, without the mark) is taken only by the research whose record of the save names it;
  - a copy the browser saves late or twice ("… (1).jpg") is removed from the downloads folder by `strom media add
    --inbox --waiting` once the image is in the research (the record of the save is kept 14 days). Never a file strom
    did not name;
  - without `--recordset` the book is the one the task waits for, else one of the task's books on the archive of the
    `--at` address. Several such books are listed and nothing is saved;
  - an image viewer that is on the page but strom cannot reach is reported: nothing is saved and the message says what
    the person does (saves the image in their own browser into the task's folder).
- **Limits:** Chrome saves only one file from one page. Further downloads from the same page must be allowed by a
  person in Chrome's address bar; the agent never changes Chrome's settings. An image whose file is not in the
  downloads folder even 5 s after the instruction to save it counts as held back for `strom media add --inbox
  --waiting`: it tells the agent, and the task's wait tells the person which website to allow to download several
  files (“the browser held image {n} back: {website} to be allowed to download several files, once (the icon at the
  right end of the browser's address bar)”). A download still being written (`.crdownload`, `.part` and the like) is
  waited for briefly; if it does not finish even then, the command says so and does not count it as held back.
- **Method only:** a downloader for an archive whose viewer shows images in tiles also saves through the browser,
  even part of an image; it opens the book's page once and never reloads it.
- **Why:** the permission "through the browser" allows what a person would do in their own browser, at their pace.
- **Controls:** terminal (agent): `strom media save T… --image <number> --at <address> [--recordset B…]`, then
  `strom media add --inbox --waiting`.
- **Since:** research 1.27.0. A held-back image is reported since research 1.30.0, a tab not drawn since 1.31.0. The
  research mark in the file's name, the book without `--recordset`, tidying late copies, waiting for a download being
  written and an image viewer out of reach since 1.33.0.
- **From research 1.37.0 (several images at once):**
  - `--image 40,41,45` or `--image 40-45` (at most 10 images) with one `--at` for each in their order, or one address
    with `{n}` in place of the number, gives one shorter script for all of them. The script tells an image by the
    tab's address and refuses another page;
  - each image is still on its own page, which the agent opens at a person's pace under strom's watching; no range.
    One `strom media add --inbox --waiting` after the last one takes them all in;
  - an image of the list whose page has not been opened yet never counts as held back by the browser;
  - Claude Code with more than three images hands them to the tree's helper `strom-image-saver`: a small context,
    only the tools saving needs, at most 10 images per call, the person's model `model.cheap`, else the model of the
    agent that started it. Its pages count with the agent's pages, and the same watching applies to them.
- **From research 1.37.0 (waiting):** while the agent's session saves images, the task does not wait for a person and
  the Strom app shows it as the agent's work ([R6.1](R6-awaiting-action.md#R6.1)). Waiting for a person are: an image
  held back by the browser (said right at the start of the wait), saving stopped by the end of the session (the next
  session goes on with it, or a person saves the images; [R6.2.1](R6-awaiting-action.md#R6.2.1)) and a wait the agent
  writes itself for the same task (`strom task wait --images` after `strom media save`): unfinished saves are dropped
  and the task is at once in **What waits** with its words. A task waiting for an image whose page the watching
  refused (a site's limit used up) returns to the queue at the end of the session, with a note of which images
  remain.

<!-- zdroj: research:a4a2f6c0 src/core/browser.ts SaveRecord, HELD_AFTER_MS 5000 · src/commands/media.ts heldSaves, heldLine (media add --inbox --waiting) · assets/lang/cs.json browser.wait.held · research:src/commands/media.ts:1206-1294 media save (browserGate, guarded browser, permission browser) · commit dadd91e7 (viewer paged on) · src/core/browserhelp.ts agentBrowserAdvice · src/agents/files.ts:80-95 · CHANGELOG.cs.md 1.27.0 · research:c6b6444d, dee0bb03 src/core/browser.ts VIEWER_HIDDEN_MS = 30_000, CAPTURE_JS (čekání jen na snímky kreslené karty, NOT_SHOWN, „the viewer's tiles did not all come in 30 s“, „the viewer was paged to another image … nothing saved“) · CHANGELOG.cs.md 1.31.0 · 1.33.0: research:7306f2a7 src/core/browser.ts researchMark (8 hex z id), waitFileBase (strom-<značka>-T…-NNNN), staré jméno jen podle SaveRecord.file · f6de01b7 src/commands/media.ts saveBookOf (kniha bez --recordset), tidyDownloads, TAKEN_KEEP_MS 14 dní · 903ce928 media add --inbox --waiting (zapisované stahování, STROM_DOWNLOAD_WAIT_MS, heldSaves dl.unfinished) · f5339b36 findViewer (OpenSeadragon v kódu stránky), hláška „strom cannot reach it … nothing saved“ · strom help media save · CHANGELOG.cs.md 1.33.0 · 1.37.0: research:66ef4451 src/commands/media.ts media save (--image seznam nebo rozsah, nejvýš 10, --at ke každému nebo {n}; skript pozná snímek podle adresy karty; neotevřená stránka není zadržená), agent strom-image-saver (model.cheap, delegate hook) · 81de7cdb, aae8f1aa src/core/waiting.ts savedByAgentNow, waitOnNow · 1c8a4380 (task wait --images po media save: uložení zahozena, čekání hned člověka) · src/core/ownsave.ts unsavedOwnWait, saveNeverOpened (návrat do fronty s koncem sezení) · CHANGELOG.cs.md 1.37.0 -->

<a id="R9.5.1"></a>
### R9.5.1 A sharper copy of an image

An image already in the research that is too weak to read is saved through the browser once more by the agent: with
the archive's viewer zoomed in, or at its full resolution.

- **Enforced by the code:**
  - `strom media save … --again` saves a registered image as a new copy beside the old one; nothing is removed;
  - the image is the whole copy with the most pixels (width × height). Views, readings and excerpts through
    `B…:<number>` take it; a citation that already points to a particular copy (`M…`) stays on it;
  - until the new copy comes, the task keeps waiting for the image. If the same scan comes, nothing is registered
    twice and the task returns to the queue;
  - without `--again`, saving a registered image is refused and the message offers `--again`. The brief offers
    `--again` for weak scans of an archive the agent's browser goes to, instead of a request to the person.
- **Limits:** only the whole image, not an excerpt of it.
- **Controls:** terminal (agent): `strom media save T… --image <number> --recordset B… --at <address> --again`.
- **Since:** research 1.33.0
- **From research 1.37.0:** `strom media add --inbox --waiting` takes in a copy saved with `--again` at once: the
  same scan, sharper, goes beside as a copy (the image is the one with the most pixels), another scan of the image
  becomes the image, and the one so far is withdrawn and kept (the one a source cites stays beside). Nothing is put
  aside or confirmed, no `strom media aside --take` at each image.
- **From research 1.37.0 (screenshot):** a properly saved copy comes ahead of a screenshot, even with fewer pixels.
  A copy counts as a screenshot when its original name is a screenshot's name (or it is a PNG beside a JPEG) and its
  aspect ratio differs from another copy of the image by more than 15 %. A copy downloaded by a downloader or saved
  by the agent's browser (the name `strom-…-T…-NNNN.jpg`) is never a screenshot. Otherwise the order by pixels
  holds. It is worked out from the records each time, so an older research reads it the same way.
- **From research 1.37.0 (citations to another copy):** `strom media cites M…` lists the sources that cite the copy
  and other copies of the same image; with `--move-to M…` it moves them to another copy of the whole image (each
  source in one edit; the old copy stays and is not withdrawn). The excerpt of a place goes with them only when
  strom recognizes both files as the same scan turned the same way and it is not a screenshot beside a scan;
  otherwise it stays on the old copy and the listing gives the commands to mark it anew. An excerpt of the whole
  image always goes. Nothing is moved by itself; `--dry-run` says what would happen.

<!-- zdroj: research:6651b60b src/commands/media.ts media save --again, againPending, settleAgain · src/core/media.ts findImage (nejvíc pixelů, ne část) · src/core/browser.ts SaveRecord.again · strom help media save (--again) · dirigent:prace/1114-vyzkum-z-hlidani-2/vysledek-sub1.md (A2, otevřené: výřez ne; citace na M… zůstávají) · CHANGELOG.cs.md 1.33.0 · 1.37.0: research:66ef4451 (--again převzato hned, bez media aside --take) · a2fe388d src/core/media.ts rankCopies (jméno snímku obrazovky, poměr stran > 15 %), src/commands/media.ts media cites --move-to (výřez jen u téhož skenu, jinak příkazy) · d93be067 (PNG vedle JPEG; savedProperly: stahovač nebo jméno strom-…) · 0c7ed4d3 · strom help media cites · CHANGELOG.cs.md 1.37.0 -->

<a id="R9.5.2"></a>
### R9.5.2 A browser that draws the tab slowly

An archive's image viewer that builds an image from tiles (OpenSeadragon, e.g. ACTA PUBLICA) asks for about one tile
each time the tab is drawn. Where the browser draws the tab only about once a second, the tiles of one image take
minutes, and saving ends after 30 s with "the viewer's tiles did not all come in 30 s …".

- **The browser first:** a tab draws slowly without graphics acceleration, on a remote desktop or in a virtual
  machine. In Chrome: turn graphics acceleration on in `chrome://settings/system` and restart Chrome; `chrome://gpu`
  shows whether Canvas and Compositing are "Software only" (then a newer graphics driver helps). The field "last frame
  … s ago" in the message says how long ago the browser last drew the tab.
- **Enforced by the code:**
  - the setting `browser.tileWait` is hidden: neither `strom config where` nor `strom help config` shows it until it
    is set. It takes whole seconds from 60 to 600 (180 suggested) and refuses another value with a hint. It is saved
    in the user's settings and holds for all researches on the computer;
  - unset: the tiles are waited for 30 s, as before; the message "tiles did not all come in 30 s" also tells the agent
    that `strom config set browser.tileWait 180` helps, then the same strom command again (a new script);
  - set: while tiles still come (one within the last 10 s), the script goes on waiting as long as they come. It ends
    after 30 s without a new tile, at the latest after the time set;
  - one call of the script answers "strom-wait …" after 35 s: the agent runs the same script again in the same tab,
    and it goes on waiting where it was. Only the last answer, "strom-result …", counts; `strom fetch … --take` takes
    nothing over from a "strom-wait" answer;
  - it holds for `strom media save` ([R9.5](#R9.5)) and for a downloader that saves from an archive's image viewer
    through the browser (`strom fetch`, [R8.2](R8-reading-scans.md#R8.2)).
- **Limits:** a tab drawn quickly is saved the same with the setting or without it. Without the setting nothing
  changes.
- **Why:** the tiles come only as fast as the browser draws the tab; 30 s stays for everyone else.
- **Controls:** terminal: `strom config set browser.tileWait 180`, back to 30 s with `strom config unset browser.tileWait`.
- **Since:** research 1.32.0

<!-- zdroj: research:75245c94 src/core/browser.ts TILE_WAIT_MIN_S 60, TILE_WAIT_MAX_S 600, TILE_WAIT_SUGGESTED_S 180, TILE_RECENT_MS 10_000, TILE_QUIET_MS 30_000, WAIT_CALL_MS 35_000, CAPTURE_JS ("the viewer's tiles did not all come in 30 s" + věta strom config set browser.tileWait 180; "last frame … s ago"), "strom-wait" · src/core/config.ts browser.tileWait (hidden, tree false, rozsah, hint config unset) · src/commands/media.ts:1686 media save · src/commands/connectors.ts:3152 viewerScript, takeOver (strom-wait nic nepřevezme) · test/cli/connector-mza.test.ts:303 (skryté do nastavení: config where, help config) · CHANGELOG.cs.md 1.32.0 · dirigent:prace/1112-vyzkum-dlazdice-pokrok/karta.md (OSD ~1 dlaždice na snímek; závěr 2: grafická akcelerace, chrome://gpu, neověřeno u reportéra) -->

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
  - `strom media view B…:<number>` of an image a task waits for says who waits for it (the agent's browser, a
    downloader's plan in the browser, or the person) and the exact next step (since research 1.33.0);
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
  - a task waiting for a site (`--kind web`) is returned by the book it names, or by the only book it works in; from
    research 1.35.0 instead of it by the book it waits under ([R6.8.4](R6-awaiting-action.md#R6.8.4));
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
  **Open the folder (M/N saved)**. App: Awaiting action, at the item in this order **Add images**, **Open
  website ↗**, **Answer**, **Discuss with the agent**, **Open folder** (the last two open the research in the
  terminal); from app 3.30.0 the block **Deliver** with steps and the link **Images can’t be obtained…**
  ([S4.4.7](S4-research-from-the-app.md#S4.4.7)). The state of the images shows "1 of 2 images" and, at the book,
  the chips **saved** / **missing**. The sites of one archive wait in one group **Archive** under the archive's name, with the link **Archive website ↗**
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
- **From research 1.35.0:** strom also takes in the folders of books that tasks need and that nothing waits for, only
  by the number in the file name ([R6.8.2](R6-awaiting-action.md#R6.8.2)).
- **From research 1.35.0:** a task comes back by itself only when its wait is written by image numbers or a book of the
  research; a wait written otherwise is found by `strom task audit` ([R6.9](R6-awaiting-action.md#R6.9)).
- **From research 1.35.0 (files in the folder):**
  - a copy that a file manager or a browser made beside a file carries the number of the original file: "33 2.jpg",
    "33 kopie.jpg", "33 copy.jpg", "33 - Copy (2).jpg" and "33 (1).jpg" are image 33, "33a 2.jpg" image 33a. A bare
    " 2" to " 9" after the name is taken as a copy suffix only after a name that is only a number (with a letter,
    if any);
  - files are not numbered by their order when some file has a name that is only a number (`1.jpg` is image 1, not
    the missing 33): the order does not override a number a person gave; it does override a name from the portal or
    the date and time of a screenshot;
  - a file that is the same scan as an image already taken in under another number or in another book is neither
    taken in nor deleted: it is put aside as `<file>.same-as-M…` (under this name it is never taken in again), and
    the listing of `strom media add --inbox`, the bridge's log and the JSON output say which image it was for, which
    image it is, and that one of the two numbers is wrong. When renaming is not possible, the file stays lying and
    the same is said;
  - `.jp2` files from the portal of Moravský zemský archiv are counted back ([R6.8.2](R6-awaiting-action.md#R6.8.2))
    in the folder of a waiting task too.
- **From research 1.37.0 (scans saved by hand):**
  - an image's number can be anywhere in the name (`__0236.jpg`, `Lhota_11__125.jpg`, `fond12_kniha3_236.jpg`): of
    several numbers, the one that belongs to the images asked for, the one that changes between the folder's files,
    else the last one before the extension. A screenshot's date and time is never taken as a number, nor a year after
    the number (`33 1784.jpg`) when it is not known which images; a name with two numbers asked for is not guessed but
    reported;
  - a file whose image number cannot be told (`000.jpg`) does not hold up the others: it stays lying and is reported
    once, without advice to rename it;
  - files named by the entries on them (`001-004.jpg`) or by the portal's own numbers are taken in in the folder's
    order as the book's next images when nothing more is saved for 20 minutes. The entries stay recorded at the
    image, and the task returns with a list of which file is which image;
  - another sheet under the same number (`7a.jpg`) is told by its content: a copy, a zoomed-in part of the image, or
    a scan of its own saved under its name; it is never hidden as a copy by its name alone. This holds in the same
    and in a later batch, after the task's return and with `strom media add --inbox <folder>`;
  - a task to which only part of the images came returns after 20 minutes of quiet with what came and what is
    missing; never sooner. A scan on the boundary of two years is counted once;
  - files named by the image's number are taken as before; nothing is renumbered. The status, the menu and the
    bridge's log say when the folder will be taken in and what stayed lying (local time).

<!-- zdroj: research:src/commands/tasks.ts:1041 task wait (--images, folder) · src/core/media.ts:117 inboxFolderFor · src/core/inboxwait.ts:25 SETTLE_MS · src/core/inboxwatch.ts:1-8 (30 s) · src/commands/media.ts:141-180 wakeWaiting · src/core/live.ts waiting/<T> answer, PUT /media (X-Strom-Task, X-Strom-Image, 409 waiting.image-same) · src/commands/media.ts:403-478 (same sha under its number → 200 same: true, added []; another number/book → 409 waiting.image-same) · src/core/waiting.ts actionsOf, archiveGroup · src/core/waitkind.ts waitGroupOf (repo: before archive:, host:) · assets/method/waiting.md "Images saved by hand" (the one exception, 7bd55fa1) · assets/method/reading.md · src/commands/guide.ts rule 7 · src/agents/files.ts:80-95 · CHANGELOG.cs.md 1.27.0 · app:CHANGELOG.cs.md 3.23.0 · src/research-waiting.ts:216-272 (actions, order), :448-488 assignImages · src/research-waiting-write.ts:532 WAITING_ANSWER_MAX · src/ui/research-overview-ui.ts:698-812 group head · src/strings.ts live.waitingTask · 1.33.0: research:bfa01a34 src/commands/media.ts media view (snímek, na který úkol čeká: kdo a další krok) · research:dddeb8a6 src/core/media.ts copyless (COPY_WORD copy/kopie/kopia/…, COPY_PAREN, COPY_BARE jen za číslem), namedByNumber · src/core/inboxwait.ts numberFiles (pořadí jen bez souboru pojmenovaného samým číslem; times .jp2 i u čekajících), bookTimes · src/commands/media.ts registerImages clashed, takeFiles (kolize → rename `${f}.same-as-${same}`, jinak leží; SetAside), asideLine (live.log, výpis ⚠, aside v JSON) · research:18fd10ec COPY_BARE \p{Nd}+\p{L}? („33a 2.jpg“) · CHANGELOG.cs.md 1.35.0 (research:e263eacb) · 1.37.0: research:62e335eb src/core/inboxwait.ts (000.jpg leží, akty jako záznamy, cizí jména v pořadí složky po STROM_INBOX_QUIET_MS 20 min, část snímků po tichu), 7a2a04cc src/core/media.ts findPart, 6fee0f71 (7a podle obsahu v každém převzetí i media add --inbox <složka>; soubor ležící schválně řečen jednou; místní čas) · src/core/media.ts (číslo kdekoli v názvu) · assets/method/waiting.md (sken na hranici jednou) · CHANGELOG.cs.md 1.37.0 · dirigent:spec/141 K1.1–K1.6, K2.2 -->

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
   ([R9.5](#R9.5)) and takes them in. From research 1.37.0 the task meanwhile does not wait for a person and is not
   in What waits; only an image held back by the browser or saving stopped by the end of the session passes to a
   person.
5. Otherwise a person saves the images into the folder or sends them from the app (**Add images**) ([R9.9](#R9.9)).
6. Taking in: the bridge at once, otherwise the start of the next session, or the command
   `strom media add --inbox --waiting`.
7. If all images are there, the task is **open** again in the queue, with a note of what came. If some are missing,
   it goes on waiting, and What waits shows which are missing (back to step 5).
8. At any time in between: a person's answer (in the app or `strom task wake T… --answer`) returns the task with the
   answer. The permission **slowly** or **through the browser** returns the tasks waiting for the archive that have
   nothing in the folder yet.

- **Since:** research 1.27.0, Strom app 3.23.0
- **From research 1.37.0:** a task that passed to a person because of the agent's browser (downloads held back,
  saving stopped), or that waits for images of a book the agent's browser may go to, is returned to the agent by a
  person once the obstacle is gone ([R6.7.3](R6-awaiting-action.md#R6.7.3)); the task goes first in the queue and
  back to step 4.

<!-- zdroj: research:src/commands/media.ts:141 wakeWaiting · src/core/archivewait.ts:188 wakeForArchive · src/core/inboxwatch.ts · src/commands/session.ts takeWaiting · src/core/live.ts waiting answer · 1.37.0: research:81de7cdb src/core/waiting.ts savedByAgentNow -->

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
1.28.0, BLHA from the research 1.35.0. The Horák family is made up.

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

<a id="R9.10.7"></a>
### R9.10.7 Brandenburgisches Landeshauptarchiv (BLHA)

- Archive: restricted, only through a person's browser. It concerns the duplicate registers (Rep. 5KB) in the
  archive's online access (blha-recherche.brandenburg.de); the images come from the image server
  blha-digi.brandenburg.de. Robots.txt closes the whole site, so neither strom's own requests nor the downloader go
  there.
- The archive replied on 18 November 2026 (the verbatim quote is in the list): a person may save single images in
  their browser at a human pace and let the AI assistant on their computer read them; the images are under the CC-0
  licence. At most two requests at once. Never a search of the archive's database, never a whole book.
- Task: the baptism of Anna Vlková in a duplicate register. With Claude Code, the extension and the permission
  **through the browser**, the agent opens the book's viewer, goes to the image and saves the one shown with
  `strom media save`, at a person's pace (10 s). The viewer's address does not name the image.
- Without the permission or with another agent: the task waits for images; What waits says with what the agent would
  save them itself.
- Book: the list has no entry on a whole book for the archive, so only the needed images are offered
  ([R6.8.1](R6-awaiting-action.md#R6.8.1)).
- Citation: “BLHA, Rep. 5KB Nr. <n>”, where n is the book's number from the reference “5KB <n>”, with the number of
  the image in the book.
- **Since:** research 1.35.0

<!-- zdroj: research:465c54ea assets/archives.json blha-recherche.brandenburg.de (restricted, browserOnly, terms robots.txt, quoteFrom reply, replied 2026-11-18, robots Disallow / zrušeno odpovědí pro jednotlivé snímky, nejvýš 2 požadavky, imagesFrom blha-digi.brandenburg.de, scope: nikdy prohledávání databáze ani celá kniha, adresa prohlížeče snímek nejmenuje, citace „BLHA, Rep. 5KB Nr. <n>“; bez wholeBook), blha-digi.brandenburg.de (restricted, IIIF, po jednom), blha.brandenburg.de (unknown, pace 10 s) · src/core/net.ts HUMAN_PACE 10 s · src/commands/archives.ts paceFor · src/core/terms.ts allows (browserOnly + restricted) · src/core/books.ts downloadOf (bez údaje range) · CHANGELOG.cs.md 1.35.0 (BLHA podle odpovědi z 18. 11. 2026) · commit d013df1c -->

<a id="R9.12"></a>
## R9.12 Census records as a source

A census records one household in one year: who lived in the house, their relation to the head, age or year of
birth, often birthplace, home municipality and occupation. The research uses census records only once a person
switches them on for the research.

- **Enforced by the code:**
  - the setting `census` (**Census records in this research**) is off by default. An unset setting means off, also for
    researches started earlier;
  - the setting applies to all researches on this computer, or with `--for-tree` to one only. The research's value
    wins both ways (on and off). The terminal menu and the Strom app write the research's value. No environment
    variable or command flag changes the setting;
  - only a person switches it on: in the menu, in their own terminal, or with the switch in the Strom app
    ([S4.4.10](S4-research-from-the-app.md#S4.4.10)). When the agent starts the switch in a conversation, a system
    window asks the person. With no window (the agent working on its own) strom refuses and tells the agent to propose
    census records ([R9.12.1](#R9.12.1)). Anyone may switch them off, with no question;
  - on: census tasks can be created (`strom task add … --census <year>[:<house>]`), and with them the agent gets the
    method page on census records and the list of census records strom knows ([R9.12.2](#R9.12.2));
  - off: a census task cannot be created (the refusal says how to propose census records), strom does not give the
    page `strom guide census`, and census tasks are set aside ([R9.12.4](#R9.12.4)). Census events already recorded
    stay;
  - the Strom archive has no such setting in the menu. The bridge refuses it in the Strom archive and in a research
    waiting for an agent.
- **Why:** registers record single events. A census shows a whole household in one year, where the family moved and
  where each person came from, which the registers often do not tell. Most archives only display census records, so
  the sheets are mostly supplied by a person as screenshots.
- **Controls:** terminal: the menu **Settings** → **Language, agent, model, what the agent may do alone, stories… (the
  setup)** → **Census records in this research: …**. First a sentence on what census records give, then the question
  **Switch census records on for this research?** or **Switch census records off for this research? Their tasks are
  set aside and come back when switched on again.** (Enter = nothing changes). The command `strom config set census
  on|off [--for-tree]`; `strom config where` shows the value in force. App: [S4.4.10](S4-research-from-the-app.md#S4.4.10).
- **Since:** research 1.36.0, app 3.31.0

<!-- zdroj: research:c7b117cd src/core/config.ts SETTINGS census (env "", tree: true, off|on), censusSwitch (strom.json oběma směry, jinak config uživatele; nenastaveno = off) · src/commands/setup.ts censusDecision (requireHuman: terminál člověka; agent → okno systému, bez okna NeedsConsentError s návodem census propose; STROM_FOR_APP bez okna; vypnutí bez dotazu), effective census off · src/commands/tasks.ts censusOrigin (--census <rok>[:<dům>], census.off s návodem) · src/commands/meta.ts guide census (census.off) · src/brief/brief.ts (podmínka census / census-off) · src/core/live.ts POST /census (409 census.archive) · research:5a73905e src/cli/menu-settings.ts censusLabel, censusStep (ui.settings.census.about, .on, .off; --for-tree; jen mimo archiv) · cs.json ui.settings.census* · assets/method/census.md (úvod) · test/cli/census.test.ts · CHANGELOG.cs.md 1.36.0 „Sčítání lidu“ · dirigent:spec/106-vyzkum-scitani-lidu Proč, K1.1–K1.4, rozhodnutí 19. 11. a 20. 11. M2 -->

<a id="R9.12.1"></a>
### R9.12.1 Proposal to switch census records on

With census records off, the agent may propose them to the person, once per research.

- **Enforced by the code:**
  - `strom census propose --why "…" [--person P…]` creates one item of What waits ([R6.2](R6-awaiting-action.md#R6.2))
    in the research language: “Census records could help this research: … They can be switched on in the settings of
    this research.” (with a person “Census records could help with …: …”). It waits for the decision: census records
    switched on, or not;
  - strom refuses a second proposal, however the first ended (done, dropped, refused). With census records on it
    refuses every proposal;
  - `--why` is one or two sentences in the research language, at most 600 characters, and must not address the
    person;
  - switching census records on closes the proposal (“Census records switched on”). With census records on, an open
    proposal is shown nowhere;
  - the summary of the session in which the proposal was made says so: “Census records proposed to be switched on
    (T…).”;
  - the proposal is a task of type **Other**, not a census task.
- **Method only:** a proposal only at a dead end where a census would help: a person's origin unknown, a gap between
  register events. After proposing, the agent goes on without census records and does not ask again.
- **Controls:** app: **Awaiting action**. Terminal: the menu What waits; switching on in [R9.12](#R9.12).
- **Since:** research 1.36.0

<!-- zdroj: research:5a73905e src/commands/census.ts census propose (census.on, census.proposed, census.addresses, --why max 600, state waiting, wait kind other, origin census:propose) · src/core/census.ts censusProposal, censusHidden · src/commands/setup.ts closeCensusProposal (census.propose.done) · src/commands/session.ts censusSummary (census.propose.session) · src/core/taskkind.ts (census:propose → other) · assets/method/core.md „Census records are off“ · cs.json census.propose.* · dirigent:spec/106 rozhodnutí 20. 11. M1 -->

<a id="R9.12.2"></a>
### R9.12.2 When and where the agent looks for census records

A census task is one household in one year and house. Where to look tells the agent the list of archives that comes
with the research.

- **Enforced by the code:**
  - the brief of a census task (only with census records on) lists the census records from the list of archives:
    years, area, name index, how a household is searched for, and the way for strom. The level and terms of the
    archive hold as for every record ([R9.1](#R9.1)), and the way is never milder than the archive's level;
  - census records in the list of archives (research 1.36.0):

| Archive | Years | Area | Search | Way |
|---|---|---|---|---|
| Moravian Land Archive (Acta Publica) | 1857, 1869, 1880, 1890, 1900, 1910, 1921 | South Moravia and Vysočina | municipality, street; no name index | by hand: a person saves the sheet ([R9.10.1](#R9.10.1)) |
| State Regional Archive in Třeboň (DigiArchiv) | as MZA | South Bohemia | municipality | by hand |
| East Bohemian archives (ARON) | as MZA | East Bohemia | municipality; no name index | the agent itself |
| FamilySearch | as MZA | selected places | municipality | a link and a task for the person only |
| Prague City Archives | 1869, 1880, 1890 | Prague | – | by hand |
| MyHeritage | 1900, 1910, 1921 | Czechia | name (name index) | by hand |
| Brno City Archives | 1850, 1857, 1870, 1880, 1890, 1900, 1921 | Brno | name, house (name index) | slowly, one record at a time |
| Ostrava City Archives | not given | Ostrava | – | slowly, one record at a time |

- **Method only:**
  - **when:** a person's origin unknown (baptism not found where they lived), a gap between register events (a move,
    children who died elsewhere, a second marriage), or a house known from a baptism, marriage or burial in a year
    near a census year;
  - only people the tree leads to (nothing off the tree), never the living. One task per household, year and house,
    never per person;
  - **where:** the census of the municipality and year in the archive's catalogue with one search, never by stepping
    through numbers. In it the house by its number; where there is a name index, search by name and check the house
    number. Never step through house numbers or look for people the tree does not need;
  - an archive that only displays census records: the task waits for a person, with the address of the
    municipality's census and what to save (“municipality, year, house number: the whole sheet, both sides”), or for
    the images of a book ([R9.6](#R9.6)). A sheet larger than one screen comes in parts;
  - not found (the municipality's census lost, the house missing, the family elsewhere): a negative search with what
    exactly was gone through, and the agent does not come back to it.
- **Controls:** terminal: `strom task add … --census <year>:<house>`, `strom task wait T… --kind web --url <address>`
  `--on "…"` or `--images B…:<numbers>`, `strom search add … --result negative`.
- **Since:** research 1.36.0

<!-- zdroj: research:5a73905e assets/archives.json census (years, area, nameIndex, search, how, says, checked 2026-11-04 až 2026-11-20: mza.cz by-hand, digi.ceskearchivy.cz by-hand, aron.vychodoceskearchivy.cz agent, familysearch.org link, digi.ahmp.cz by-hand, myheritage.com by-hand, digiarchiv.brno.cz slow, badatelna.ostrava.cz slow bez let), censusDays · src/core/census.ts censusHoldings · src/brief/brief.ts (oddíl census jen pro úkol sčítání při zapnutí) · src/core/assets.ts methodFor (census.md) · test/unit/known-terms.test.ts (how nikdy mírnější než úroveň) · assets/method/census.md „When“, „Where“ · dirigent:spec/106 K2.1–K2.4 -->

<a id="R9.12.3"></a>
### R9.12.3 A household: one shared event

`strom census add` records one sheet (one house, one household) at once. In the Strom app the household is one shared
event **Census** ([A10.1](A10-shared-events.md#A10.1)).

- **Enforced by the code:**
  - each member of the household who is a person of the tree gets a census event with their relation to the head and
    age as on the sheet. Date, place, house, note and the sheet's citation are the same on all copies. A single member
    from the tree gets a plain census of the person, with the relation in the note;
  - people on the sheet who are not in the tree (servants, inmates, lodgers) are only in the household's note; no
    person is created for them. Nothing else is recorded: the year and place of birth from the sheet are not a birth;
  - **date:** a year alone means that year's census reference day where strom knows it: in Czechia 31 Oct 1857,
    31 Dec 1869, 1880, 1890, 1900 and 1910, and 15 Feb 1921. Otherwise the year stays. A full date wins;
  - **place** is a municipality or a place record, never a street or house number. The house is written as the sheet
    gives it (“14”, “Dlouhá 12”);
  - **relation:** the fixed words (head of household, wife, husband, son, daughter, father, mother, father-in-law,
    mother-in-law, son-in-law, daughter-in-law, grandson, granddaughter, brother, sister, stepson, stepdaughter,
    foster child, relative, servant, farmhand, maid, lodger, inmate, retired farmer, apprentice, journeyman) are
    recognised in English, Czech, German and Polish and written in the word of the research language. Any other
    relation stays as written;
  - the relation as the forms and readings of a sheet give it: “přednosta [domácnosti]”, “hlava rodiny”,
    “Haushaltungsvorstand”, “głowa rodziny” and “head of the household” are head of household. Words after a relation
    that say only whom it is to (“manželka přednosty”, “son of the head”, “Tochter des Haushaltungsvorstandes”, “v
    domácnosti”) are cut off. Of a list with commas, head of household holds where it is among them; otherwise the
    whole stays;
  - **refused:** a member who is not a person of the tree (or is merged or retracted), a person given twice, a member
    with no relation, a person who is likely living, two heads of household, and a household already recorded (same
    year, municipality and house);
  - **warned:** other people of the tree in the same house and year (another household of the house, or the same one
    recorded twice); a census of the same year elsewhere (a move, or two people taken for one);
  - the copies stay one event: a common field corrected on one copy (`strom event edit`, `strom cite`,
    `strom note edit|retract|restore`, `strom event main`) and a correction proposal accepted on one copy apply to all.
    Age, relation, verification and a person's confirmation are each copy's own; the research status goes to all
    copies only when asked for (`--status`). Nothing that belongs to one copy goes into the common note;
  - a household can be recorded also with census records off: the command records a sheet supplied, it searches for
    nothing.
- **Method only:**
  - read the sheet like a register entry, the whole household and the head of the house; record it once. Each year is
    a household of its own, never merged;
  - **a clue, not proof:** a year or place of birth, home municipality and occupation from a census never replace a
    birth or baptism. They lead to the register: a task to find the parish of the birthplace. Where the census and
    the register disagree, a note or hypothesis is made; a fact from the register is not changed because of a census;
  - **renumbered houses:** know the house also by its neighbours and names, not by its number alone; say any
    uncertainty in the note.
- **Controls:** terminal: `strom census add --source S… --date <year|day> --place <municipality|L…> --house <no.>`
  `--member P…:<relation>:<age> … [--others "…"] [--note "…"] [--locator "…"] [--transcript "…"]`. App: the household
  at each person and on the **Timeline** ([A10.2](A10-shared-events.md#A10.2), [A6.3](A6-views.md#A6.3)). An example
  (made up): `strom census add --source S0004 --date 1890 --place L0007 --house 14`
  `--member P0002:"head of the household":41 --member P0003:"wife of the head":36 --others "farmhand, 19"`
  records Jan Horák as head of household (41) and Marie Horáková as wife (36), both as of 31 Dec 1890.
- **Since:** research 1.36.0, app 3.31.0
- **From research 1.37.0:**
  - a person's census written as a custom event with a census name ("Census", "Sčítání lidu", "Volkszählung"…) goes
    to the Strom app as a census (`1 CENS`); the record in the research stays as it was written. A couple's event and
    a name with something more stay as they are. App 3.32.0 no longer shows such a census struck through when
    loading the research's version ([S2.7.1](S2-edits-from-the-app.md#S2.7.1));
  - `strom check` warns of two censuses of one person with the same date (`two-censuses`) and advises keeping the one
    that says more (household, citations) and withdrawing the other with `strom event retract`;
  - the same words of a record cited twice go into the note of a fact, name or family only once.

<!-- zdroj: research:8dba2e52 src/commands/household.ts census add (--source, --date, --place, --house, --member, --others, --note, --locator, --transcript/--quote, --information, --status, --country; sameHouse, elsewhere) · src/core/household.ts addHousehold (census.member.none, record.none, merged/retracted, census.member.twice, census.living, relace chybí, census.head.twice, domácnost už zapsaná; jeden člen bez share id, vztah do poznámky; others jen v poznámce), parseMember, alignCopies · src/gedcom/export.ts (2 NOTE bez řádků kopie) · src/commands/people.ts alignCopies u note edit/retract/restore, cite, event edit, event main · research:ece404b9 src/core/origin.ts (přijatý návrh na všechny kopie), censusDay jedna tabulka · research:5a73905e assets/archives.json censusDays CZ · research:d2bef48e src/core/household.ts householdRoleOf, src/core/phrases.ts HOUSEHOLD_ROLES, HOUSEHOLD_ROLES_ALSO, HOUSEHOLD_OF_HEAD · test/cli/census-household.test.ts, census-reader.test.ts · assets/method/census.md „Reading and recording“ · CHANGELOG.cs.md 1.36.0 · dirigent:spec/106 K3.1–K3.3 · dirigent:prace/1120-vyzkum-106-scitani Výsledek (census add i při vypnutí, stav jen výslovně) · 1.37.0: research:6aa96d31 src/gedcom/export.ts (vlastní událost sčítání jako 1 CENS), src/core/labelkind.ts kindOfLabel, strom check two-censuses, poznámka bez zdvojených slov · CHANGELOG.cs.md 1.37.0 · dirigent:K052 -->

<a id="R9.12.4"></a>
### R9.12.4 Census records off: tasks set aside

Switching census records off sets census tasks aside, it does not delete them. Once switched on, they come back by
themselves.

- **Enforced by the code:**
  - with census records off, census tasks that are open or waiting (also for images) are out of the queue, its
    counts, What waits and the status for the app. Nothing is written or deleted: setting aside follows from the
    setting;
  - a task a session is working on right now is not set aside: the session finishes it. If it stays unfinished, it is
    open again and from then on set aside. The agent is told so when the session closes;
  - a task a person put off until later stays put off as before. Done and dropped tasks do not change;
  - `strom task list` says how many census tasks are set aside; `strom task list --kind census` shows them marked
    “held: census off”. For a task set aside that is started by its number (`strom session start T…`), the agent is
    told the task is set aside, to close the session and take another task;
  - the settings menu shows at the setting e.g. “off, 3 census tasks set aside” and after switching off the sentence
    “Set aside: 3 census tasks. They come back when this is switched on.”
- **Controls:** terminal: the setting in [R9.12](#R9.12), `strom task list --kind census`. App: the switch
  [S4.4.10](S4-research-from-the-app.md#S4.4.10) with the sentence on tasks set aside.
- **Since:** research 1.36.0

<!-- zdroj: research:c7b117cd src/core/census.ts censusHeld (open, parked do uplynulého dne, waiting; nikdy doing ani parked člověkem), censusHidden, censusHeldCount · src/core/queue.ts rankTasks censusHide · src/core/waiting.ts (Co čeká) · src/core/live.ts censusStatus (/status.census {on, held}) · src/commands/tasks.ts task list (censusHeldNow, „held: census off“, --kind census) · src/commands/session.ts censusLine, censusCloseLine · research:5a73905e src/cli/menu-settings.ts censusLabel (ui.settings.census.held), censusStep (ui.settings.census.back) · test/cli/census.test.ts (M3) · dirigent:spec/106 K1.3, rozhodnutí 20. 11. M3 -->

<a id="R9.13"></a>
## R9.13 A restricted archive: one session at a time

An archive that restricts automated access is used by only one session at a time of all the researches with the
shared folder on the computer. The archive thus does not block access, and one worker goes at the full allowed pace
instead of several workers sharing the pace.

- **A restricted archive:** the archive's terms want a person's pace or the browser alone, a person gave the
  permission “slowly” or “through the browser” ([R9.2](#R9.2)), or the archive's downloader has an hourly cap.
  A refusal by the archive (401, 403, 429) does not make an archive restricted: the archive is left alone for a while
  as before. The archive is recognised by the domain of its website.
- **Enforced by the code:**
  - a task whose books lie only on a restricted archive takes the archive too when the task is claimed. The session
    holds the archive; an agent that only strays onto the archive claims it with its first request;
  - holding the archive ends with the session, with the session lapsing ([R7.9](R7-when-the-agent-works.md#R7.9)),
    or after `archive.hold` (default 30 min) without a request to the archive, even while the session goes on.
    Whoever only reads downloaded scans thus releases the archive;
  - a task on an archive that another session holds is left out for now and other work is taken (“left out: the
    archive … restricts automated access and another session uses it now”). An agent's request to such an archive is
    refused;
  - working alone left only with such tasks waits at most `archive.wait` (default 30 min). Nothing is sent to the
    archive while it waits. Then the run ends with the reason “nothing else to do — the tasks left need the archive …,
    which another session used through the whole wait”;
  - `strom session start T…` on a task of an occupied archive is refused with one sentence: “the archive … is used
    now by another research (since 9:10, last request 9:40); free by 10:10 at the latest.” In the same research the
    session's number stands in place of “another research”;
  - whoever waits for the archive stands in a queue; after the release the one who has waited longest goes first.
    A session that let the archive go does not claim it again at once when someone is waiting for it.
- **Bulk download:** on the computer only one bulk download of images from a restricted archive runs at a time
  (`strom fetch`). Another one joins a queue (“queued behind …”) and waits by itself at most `archive.wait`; then it
  ends with a time to try again. The download holds the archive too, so the agents of other researches skip it.
  Unrestricted archives do not change: their pace is still watched only by the request limiter.
- **Limits:** holding says not how fast the download goes, only who downloads; the archive's pace does not change. An
  older strom beside this one does not hold archives and keeps only to the pace.
- **In the app:** who uses an archive and which archive the work waits for is shown by the Research overview
  ([S4.1](S4-research-from-the-app.md#S4.1), [S4.2](S4-research-from-the-app.md#S4.2)).
- **Controls:** terminal: `strom config set archive.hold <minutes>`, `strom config set archive.wait <minutes>` (e.g.
  `45m`, `2h`; 5 min to 24 h, applies to this computer); the menu shows “The work on its own waits for the archive …
  (at most until …).”
- **Since:** research 1.36.0

<!-- zdroj: research:10894288, 9408c7ea, 41dcd8eb src/core/archiveholds.ts (hlavička; restrictedLevel: browserOnly, permission slow|browser, allows(…).human; ne forbidden/refused; cappedConnector policy.pace.perHour; siteOf webDomain; siteLife: proces, sezení, archive.hold; PRIORITY_MS 2 min; joinQueue, releaseSite; BULK) · src/commands/connectors.ts:1443-1448 (help fetch), :3085-3190 holdArchive (fetch obrázků čeká ve frontě ≤ archive.wait, ostatní exit 7 data.held) · src/commands/session.ts:985-997, :1355-1389 (stop archive) · src/core/errors.ts:142 archive.held(.own) · src/core/config.ts:336-337 archive.hold, archive.wait · cs.json ui.run.skip.archive, ui.run.archive.wait, ui.run.stop.archive, ui.error.archive.held(.own), ui.menu.working.archive · CHANGELOG.cs.md 1.36.0 · dirigent:spec/127 K2.1–K2.5, K5.1, rozhodnutí 21. 11. (1)–(3), navrh-rezervace.md kap. 5 -->
