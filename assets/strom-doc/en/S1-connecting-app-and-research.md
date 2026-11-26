<a id="S1"></a>
# S1 Connecting the app and the research

How the Strom app connects with the research on the same computer, what kinds of trees come of it and what happens
when the connection fails. Describes the Strom app 3.21.2 (and the research 1.25.2). Changes from a later version carry its number. What happens to edits after connecting is described in [S2](S2-edits-from-the-app.md), the phone in
[S5](S5-phone.md).

<a id="S1.1"></a>
## S1.1 The research's bridge runs only on this computer

The app talks with the research through a bridge: a small server the research starts on this computer. The bridge
listens only at the address `127.0.0.1`, on a random port, and each of its addresses carries a secret key. The tree's
data go nowhere else through the bridge.

- **Limits:**
  - The bridge accepts a request only from a page of the Strom app on stromapp.info or from a local address. When
    its key comes from a foreign page, the research replaces the key at once and that request gets no answer.
  - The bridge runs until the user switches it off (`strom live stop`, in the app the switch **Research on**,
    [S1.9](#S1.9)), or until the computer shuts down. It stops by itself only when the user chose so
    (`live.idleMinutes`, in the app **After 2 hours without work**): when nobody asks it anything for that time and
    nobody works in the tree meanwhile. The app's regular status request does not keep the bridge alive.
  - The bridge also stops by itself when its research disappears from the folder and is still missing at the next
    check at least 10 s later. A disk unavailable only for a moment does not stop the bridge. A second bridge of the
    same research started next to a running one stops at once.
  - When the bridge restarts by itself (update, inactivity, crash), it keeps its address: the same port if it is free,
    and the same key. The app then connects without a new link.
  - `strom live stop` throws the key away: only `strom app` then connects the app again. When the port is taken by
    another program, the bridge takes another port and the app needs a new link.
  - The bridge refuses a write when the tree is sealed on another computer, when the tree's files in a cloud folder
    are not downloaded yet, and when the disk is full. Edits then wait in the app ([S2](S2-edits-from-the-app.md)).
- **Controls:** terminal: `strom live` (is the bridge running?), `strom live start`, `strom live stop` (`--forget`
  forgets the port too), `strom config set live.idleMinutes <minutes>` (0: never by itself, the default). The run log
  is in the research folder in `.strom/live.log`.
- **Since:** research 1.0.0. The same address after a restart from 1.8.0, `live.idleMinutes` from 1.25.0.
- **From research 1.29.0:** the bridge no longer stops by itself when idle (the default `live.idleMinutes` is 0);
  before, it stopped by itself after two hours. A value the user saved stays.
- **From research 1.30.0:** a bridge whose research disappeared stops only after a second check at least 10 s later
  (before, at once); a second bridge of the same research stops at once.
- **From research 1.31.0:** one bridge per research stays even after an update. A bridge running beside the
  research's bridge (the one `.strom/live.json` names) stops by itself at the next check (every 10 s). A bridge whose
  strom an update deleted stops too and says so in `.strom/live.log`. A new bridge that stops because another bridge
  holds the research also stops the bridge that started it for the hand-over, unless that is the research's bridge.
  Handing the bridge over to a newer strom is quicker: the old bridge answers while the new strom is checked.

<!-- zdroj: research:src/core/live.ts (v1.25.2) header :1-80, token crypto.randomBytes :1702, leaked :1809, :1995, LIVE_IDLE_MS / live.idleMinutes :1705, config.ts DEFAULT_LIVE_IDLE_MINUTES = 0 (od 1.29.0), live-last.json :518, seal.foreign / tree.not-downloaded / disk.full · src/commands/start.ts live · src/core/config.ts live.idleMinutes · research:94d75934 src/core/live.ts GONE_MS 10_000 (researchGone: dvě kontroly aspoň 10 s od sebe), otherBridge (most téhož stromu už běží → konec) · CHANGELOG.cs.md 1.30.0 · research:0c6f2205 src/core/live.ts OWNER_MS 10_000 (most mimo live.json skončí), kód stromu smazaný aktualizací (dvě kontroly GONE_MS, live.log), EXIT.locked → konec mostu, který spustil předání (STROM_LIVE_REPLACES), kromě mostu z live.json · 0239e6c3 předání: starý most odpovídá během ověření nového · CHANGELOG.cs.md 1.31.0 -->

<a id="S1.2"></a>
## S1.2 The research opens in the app through a link from the terminal

The research is opened in the app by the command `strom app`. The research starts the bridge and opens the app in the
browser with a link to its tree. The first time a new tree is created in the app, the next time the same one is
updated.

- **Limits:**
  - When an agent works in the tree (or with the option `--live`), the app follows the tree live right away
    ([S1.4](#S1.4)). Otherwise it loads the tree once.
  - The app takes only a link to `127.0.0.1` or `localhost`. It ignores any other link with the message "The link
    pointed to a file that is not on this computer, so it was ignored."
  - The tree from the research is already in the app and has not changed in the app since the last load: it is
    updated. It has changed: the app asks whether to **Update** it or **Open as copy**. A backup is saved before the
    update.
    **Open as copy** makes a new tree from the research that takes the further updates; the tree with the changes
    stays as it is, from app 3.32.0 as a copy without research ([S1.10](#S1.10)).
  - Safari does not let a web page connect to a program on this computer. `strom app` therefore never opens Safari.
    Without a suitable browser the installed app takes the file over, or the file `output/tree-strom.ged` from the
    research folder can be dragged into the app window.
  - Chrome and Edge ask the first time for permission to access devices on the local network. Without it the app
    cannot reach the research ([S1.5](#S1.5)).
- **Controls:** terminal: `strom app`, `strom app --live`. App: **Research → Other actions → Research for this
  tree…**
- **Since:** app 3.0.0, research 1.0.0
- **Since research 1.30.0:** on macOS the research hands the address for the app installed from a Chromium browser
  (Chrome, Edge…) to the browser already running, as its own second start would hand it over. No other program starts
  and no browser icon is added to the Dock. When the browser is not running or does not answer within 5 s, the
  research starts it as before.

<!-- zdroj: research:a4a2f6c0 src/core/chromium.ts openWebApp (darwin: handToRunning SingletonSocket, jinak launch), handToRunning (ACK, timeout 5000), singletonMessage · dirigent:prace/1109-vyzkum-dock-chrome/karta.md Výsledek (živě Chrome, Edge, Canary) · research:src/commands/start.ts (v1.25.2) app, liveAppUrl / importAppUrl, Safari · app:src/research-link.ts:584 parseLoopbackUrl, :747 decideResearchOpen · src/ui/research-ui.ts:1088 initExternalOpen, :1350 importResearchFromUrl · src/local-network.ts · strings.ts research.notLocal, research.editedMessage, research.safariBlocked -->

<a id="S1.2.1"></a>
### S1.2.1 Links the app accepts

| Link | What the app does |
|---|---|
| `?live=` | opens the tree and follows it live |
| `?import-url=` | loads the tree once from the bridge |
| `?send=` | sends edits to the address the research started from the app gave for sending |
| `?research=install` | opens the installation of the research (a link sent from a phone) |
| `?tree=…&research=…&person=…` | opens the research's tree at the given person |

The app removes the parameters from the address after processing them. When the page is reloaded during following,
following resumes silently.

<!-- zdroj: app:src/ui/research-ui.ts initExternalOpen :1088, rememberedLiveBridge · src/deep-link.ts · src/research-install.ts -->

<a id="S1.3"></a>
## S1.3 Kinds of trees in the app

A tree in the app is either its own, or it belongs to a research on this computer. A tree from the research carries in
its file the number of the research and the version it came from. By that the app knows where to send it back.

| Kind | In the tree switcher | What it is |
|---|---|---|
| Own tree | no mark | a tree only in the app, without the research |
| Research | **Research** | a tree in which the research's agent works |
| Strom archive | **Archive** | a tree the research keeps with sources on the disk, without an agent |
| Research waiting for an agent | **Archive** | a research that has no agent yet; the app treats it as an archive |
| Copy | no mark | a copy of a tree from the research (**Open as copy**, a copy of the whole tree, a second import); it is not updated from the research, and from app 3.32.0 it is without research ([S1.10](#S1.10)) |

- **Limits:** whether a tree is a research or an archive is decided by the research, not by the app. It can be
  switched only in the research.
- **Controls:** app: the tree switcher. Terminal: the research menu.
- **Since:** app 3.12.0 (the name Strom archive), marks in the switcher from 3.16.0

<!-- zdroj: app:src/research-link.ts _STROM_TREE, _STROM_HEAD · src/types.ts:1695 ResearchLink (copy, mode) · src/research-others.ts researchAgentless · src/ui/research-sync-ui.ts researchKindOf :654, researchAgentAway · strings.ts treeSwitcher.kindArchive, kindResearch · spec 002 · CHANGELOG.cs.md 3.12.0, 3.16.0 -->

<a id="S1.3.1"></a>
### S1.3.1 The sample tree

The sample tree is for trying out the app. It is never connected to a research, and nothing of it is sent to a
research.

- **Ancestor research** in the sample tree sets nothing up and says: "The sample tree is for trying out the app and
  is never connected to a research. A research starts with a real family tree."
- Opening the sample tree ends the following of the open research, as a switch to another tree does
  ([S1.4](#S1.4)).
- **Limits:** a sample tree from an older version of the app is recognised by its content and marked when it is
  opened or imported. A sample that is already connected to a research is not marked and stays connected.
- **Controls:** app: **Try a sample tree**
- **Since:** app 3.29.0

<!-- zdroj: app:bbcc2b17 src/types.ts TreeMetadata.demo · src/demo-sample.ts (starší ukázka podle obsahu; propojená se neoznačí) · src/tree-manager.ts, src/ui/import-export.ts (označení při otevření a importu) · src/ui/research-promo-ui.ts showResearchInfoDialog (demo → demo.noResearch, nic se nenastaví) · src/ui/research-adopt-ui.ts (nikdy ukázka) · src/ui/research-follow-ui.ts researchFollowBeforeSwitch(null) · strings.ts demo.tryDemo, demo.noResearch, research.menuItem · CHANGELOG.cs.md 3.29.0 „Přepnutí stromu“ · prace/1115-app-prepnuti-stromu -->

<a id="S1.4"></a>
## S1.4 Following live

When following live, changes from the research come into the app by themselves. The followed tree is read-only
meanwhile, so that an edit in the app does not meet the agent's work.

- **Limits:**
  - Only one tree is followed live at a time. Following another tree ends the previous one.
  - Switching to a tree where an agent works starts following it without asking. Unsent edits of the open tree are
    sent first.
  - Following ends when the agent stops working or when the research becomes an archive. The tree can then be edited
    again.
  - When automatic following fails, the app stays silent and the tree stays as it was.
- **Controls:** app: **Follow live** · terminal: `strom app --live`
- **Since:** app 3.0.0; switching to a tree with an agent from 3.13.1
- **From app 3.26.0 with research 1.30.0:**
  - the research has the tree for the app built for each state and keeps it even after the bridge starts again;
  - the app shows the tree at once in its last built form. When the research has moved on meanwhile, the research
    panel shows “Preparing a newer version…” and the newer version replaces the tree by itself once it is ready;
  - when the research has not changed since the last load and the tree in the app is still exactly the one loaded,
    the app neither downloads nor loads it again;
  - while following, the research announces a change once its tree is ready.

<!-- zdroj: app:src/ui/research-ui.ts startLiveFollow :2376 (opts.auto), researchReconnectOnly · strings.ts live.followLive, live.followingTree, live.followStarted, live.followMoved, live.liveEndedArchive, live.liveEndedNoAgent · CHANGELOG.cs.md 3.13.1 · spec 011 · app:669c08f0 src/research-tree-file.ts (ged.stale → tree.ged?stale=1, treeFileState preparing; ged.etag → If-None-Match jen u stromu přesně z toho souboru, 304 = strom zůstává), src/ui/research-ui.ts livePreparing, strings.ts research.newerPreparing · research:94d75934 src/core/liveged.ts (strom pro aplikaci jednou pro stav a variantu, na disku i po restartu mostu), src/core/live.ts (change až s hotovým stromem; ETag u tree.ged) · CHANGELOG.cs.md 1.30.0 -->

<a id="S1.4.1"></a>
### S1.4.1 The tree at once, the photos follow

A tree opened with **Follow live** shows at once, with the photos the app already has. The other portraits, couple
photos, attachments and source crops come from the research afterwards, in the background. Names, relationships and
cards can be browsed straight away.

- **Order:** first the photos of the cards on screen, then those around the centre. Panning or zooming the tree
  reorders them. The first batch has 30 photos, the next ones 500, at most 2 requests at a time. Each photo is checked
  against its fingerprint before it goes into the tree.
- **A photo on its way:** the card shows the initials under a calm, slowly pulsing veil; a card with an older photo
  shows that one under the veil until the new one comes. The tooltip says “Loading the photo…” or “Loading the new
  photo…”. A photo that comes fades in on the spot; the tree is not redrawn for it.
  - The same veil is in the person's dialog, the person page and the family pages in the app window, the window
    **Materials**, a person's files and material, previews of sources and crops and the couple photo in the Table.
    The slideshow, the changes from the research and a merge conflict show the initials until the portrait comes.
- **A photo that did not come:** the card looks like a card without a photo; tooltip “The photo did not load.” A tile
  in lists shows a struck-through picture, from 64 px with **Not loaded**. The person's dialog and the person page
  have **Try again** at the photo.
- **The indicator Photos k / n:** it appears when the photos take longer than 400 ms and counts the photos of the whole
  tree (“Photos 846 / 860”, with “· 3 not loaded”) with a progress bar. On a computer it stands at the top, in a
  window up to 1024 px wide at the bottom above the notices. A click shows the detail: “N to go · M not loaded” and
  what can be done with the tree meanwhile: when following live “The tree can be viewed meanwhile.” (the tree is
  read-only, [S1.4](#S1.4)), otherwise “The tree can be edited meanwhile.” When all have come, it shows ✓ for 2 s and
  goes.
- **Some did not load:** the indicator goes and one notice stays: “Some photos did not load (N).” with the reason
  (“The research is not running. Strom Research needs to be started.”, “The research did not answer within 60 s.” or
  “The research does not have these photos.”) and **Try again**. That loads the photos that did not load again and the
  indicator counts the whole tree again.
- **Enforced by the code:** a photo on its way never deletes or overwrites a saved photo.
  - Saving the tree before the photos come keeps the previous photo (or none) at a portrait and a couple photo. The
    app notes the photos that have not come yet with the tree and fetches them at the next connection to the research.
  - The person's dialog writes the photo only when it was changed in the dialog. A photo that comes while the dialog
    is open is filled in there.
  - **Undo**, **Redo**, a discarded dialog, the daily backup and other windows keep the photos that have already
    come.
  - **Edit crop** of a portrait or a couple photo waits for the photo: “The crop can be edited once the photo has
    loaded.”
  - A photo coming in is not an edit of the tree: it cannot be undone as a step, and a tree in step with the research
    stays in step.
  - Photos that did not come are not taken by the research as removed: until they come, the tree's writes only add
    ([S8.5](S8-where-the-data-are.md#S8.5)).
- **Limits:**
  - only when the tree is opened with **Follow live**. A newer version while following, taking over a tree and other
    loads of a version from the research bring the photos at once with the tree, as before;
  - research up to 1.29 sends the tree with the photos inside the file: the tree shows only with them;
  - another tree opened during loading cancels the loading and the indicator goes. A photo lands only in the tree and
    the load it was fetched for;
  - other windows of the app ([A6.8](A6-views.md#A6.8)) have no loading states and show the tree without the veil;
  - for an encrypted tree, source files and crops that did not come before the page was closed come only with the next
    version from the research;
  - on a phone held sideways the expanded research panel folds at the indicator ([S4.1](S4-research-from-the-app.md#S4.1)).
- **Controls:** app: **Follow live**; the indicator **Photos k / n** (a click: the detail, Esc closes it); the notice
  → **Try again**; the person's dialog and the person page → **Try again**.
- **Since:** app 3.31.0, research 1.30.0

<!-- zdroj: dirigent:spec/116-fotky-nacitat-pozdeji K1.2–K1.6, K2.1 · prace/1119-app-116-fotky (Výsledek, odchylky) · app:45dd3426 src/image-loads.ts (ImageLoadQueue, IMAGE_FIRST_BATCH 30, takePendingImages, write jen do současného stromu a načtení, bez kroku zpět), src/research-image-refs.ts IMAGE_BATCH 500, IMAGE_CONCURRENCY 2, IMAGE_ANSWER_MS 60 s · src/ui/research-ui.ts startLiveFollow (ged.imagesByHash → later, priority TreeRenderer.imagePriority: na obrazovce, pak kolem středu; setPendingImages I1; researchResumePendingImages) · research:33ac2e38 (1.30.0) src/core/live.ts ged.imagesByHash · app:95e68ac7 (K1.5 I1–I7: TreeMetadata.pendingImages, notes(records) bez záznamů u šifrovaného stromu) · 87b9ec30 src/ui/image-slot.ts (data-img-state loading/refresh/failed, IMG_PULSE_MS, TILE_NOTE_MIN_PX 64) · ad9e82a0 src/ui/person-modal.ts renderPhotoState, photoModel · 05cf608c, e188236f (další místa) · 4afeb434, b1bcb476 src/ui/image-load-chip.ts CHIP_SHOW_MS 400, BUSY_DONE_MS, detailNote(readOnly), failedReasonText (offline → timeout → missing), treeSwitched · 4afeb434 src/image-loads.ts abort (strom už není současný) · strings.ts photos.loading, loadingNew, failed, failedNew, tileFailed, recropWait, chipLabel, chipFailed, detailLeft, detailEditable, detailViewOnly, someFailed, whyMissing · busy.errOffline, errTimeout, retry · a2feee6b (≤ 1024 dole nad oznámením) · 7be40d24 src/ui/landscape-panel-fold.ts · CHANGELOG.cs.md 3.31.0 -->

<a id="S1.4.2"></a>
### S1.4.2 Outputs wait for the photos

An output asked for while the tree's photos are still coming ([S1.4.1](#S1.4.1)) waits for them and is made only with
them. Without the photos it is made only on an explicit choice.

- **Which outputs:** printing the poster, the PNG image and the SVG vector, the person page, the family pages, the
  family book, the data backup (**Save to file**, writing to the linked file, a file for sharing, **Export** of the
  backup) and the GEDCOM export. A CSV file has no photos and does not wait.
- **Waiting:** the output's button or row says “Waiting for photos · k of n” and a second click starts nothing. A notice
  with the output's name (“Printing the poster”, “Family book”…) counts the photos with a bar and has **Cancel**. The
  indicator **Photos k / n** hides meanwhile.
- **When some did not come:** one notice “Some photos did not load (N).” with the reason and three choices: **Try
  again**, **Continue without N photos** (the output from the data as they are) and **Cancel**.
- **Enforced by the code:** an output never contains the veil or the mark of a photo that did not load. Printing
  loads and draws, before the print opens, even the pictures the page loads only on scrolling.
- **Controls:** app: the output as always; in the notice **Cancel**; in the alert **Try again**, **Continue without
  N photos**, **Cancel**.
- **Since:** app 3.31.0

<!-- zdroj: dirigent:spec/116-fotky-nacitat-pozdeji K1.7 · app:9d326239 src/ui/output-images.ts imagesBeforeOutput, waitingLine, someFailedText, toastImagesView (retry, without, cancel; suspendImageLoadChip), imagesReadyForPrint · src/image-loads.ts awaitTreeImages · volající: src/ui/export-image-ui.ts (poster, png, svg), person-page-ui.ts (personPage, familyPages), book-ui.ts (book, familyPages), file-copy-ui.ts, file-access-ui.ts, share-ui.ts (backup), encryption-ui.ts (backup, gedcom; csv ne) · src/ui/fan-view.ts (live false: fotka nebo nic) · strings.ts photos.waiting, continueWithout, out.*, busy.kOfN, buttons.cancel · CHANGELOG.cs.md 3.31.0 -->

<a id="S1.5"></a>
## S1.5 When the research is not running or the connection fails

When the app does not reach the research, the tree in the app does not change and edits in it wait. What exactly
happened, the app shows in the window **Couldn't connect to the research**.

| Cause | What the app shows | What helps |
|---|---|---|
| the browser does not let the page reach devices on the local network | **… blocks the connection** (the browser's name) | allow **Apps on device** (Brave: **Localhost access**) in the site settings |
| the browser is still asking | **The browser is waiting for permission** | answer the browser's question |
| the bridge is not running | **The research isn't responding** | start the research; at a new address `strom app --live` connects it |
| another bridge answers at the address (changed key, another tree) | **The research turned the connection down** | `strom app --live` |
| Safari | **Safari won't connect to the research** | open the link in Chrome or Edge (**Copy link**) |

- **Limits:**
  - The window always says that nothing has changed and the tree stays as it was. **Try again** tries the
    connection again.
  - A tree from the research can be edited even when the research is not running. Edits are sent when the research
    connects again.
  - The bridge runs but does not answer: `strom live stop` and a new start help.
- **Controls:** app: **Try again**, **Close**, **How to allow** · terminal: `strom app --live`, `strom live stop`
- **Since:** app 3.9.0

<!-- zdroj: app:src/ui/research-ui.ts:1406 showResearchConnectFailed (denied, prompt, down, refused, safari) · src/local-network.ts · strings.ts sync.stateBlocked, sync.blockedSub, sync.settingApps, sync.settingBrave, sync.bridgeDownSub, sync.notRespondingSub, sync.addressRefusedSub, researchOthers.offPanel -->

<a id="S1.6"></a>
## S1.6 Older and newer versions

The app and the research are released separately. The research tells the app in its status what it can do, and the
app turns on only what the research accepts. The research in turn chooses by the app's version what it sends.

- **Limits:**
  - **Older research** (without automatic sending, or without titles): the app shows **The research has an older
    version (v)** with the offer **Update the research**. Edits are then sent only by hand: the app starts the
    research in the terminal and the research takes them. Until the update, titles stay only in the app.
  - **A new version of the research is available:** the app shows **New Strom Research …** with the button
    **Update**. What is running finishes on the current version.
  - **A research written by a newer version of the `strom` program:** an older program neither opens it nor writes
    into it.
  - **A tree saved by a newer version of the app:** it is read-only in the app until the app is updated.
- **Controls:** app: **Update the research**, **Check again** · terminal: `strom update`
- **Since:** app 3.9.0 (research 1.12.0); read-only tree from app 3.19.0
- **From app 3.22.0:** directions from the app and the panel without a connection are turned on only with research
  1.26.0 ([S4](S4-research-from-the-app.md)).

<!-- zdroj: app:src/ui/research-update-ui.ts · strings.ts researchUpdate.line, researchUpdate.titlesLine, research.updateAvailable, research.updateBusyHint, storage.newerReadOnly · research:src/core/live.ts (v1.25.2) status locked :1516, :2810, appVersionOf :1492 · CHANGELOG.cs.md 3.19.0 -->

<a id="S1.7"></a>
## S1.7 Several researches on one computer

Each tree from a research has its own bridge. The app also asks the bridges of trees that are not open right now and
shows their state in the tree switcher.

- **Limits:**
  - Marks at a tree in the switcher: **live** (followed), **running** or **N directions** (an agent works),
    **N waiting** (items to deal with), **not running**.
  - It always asks only one bridge at a time and only when the page is visible: the first time after 3 seconds, then
    every minute. It waits at most 1.5 seconds for an answer.
  - A research that is not running connects again when its tree is opened from the research (`strom app`).
- **Controls:** app: the tree switcher; the research panel, row **Elsewhere**
- **Since:** app 3.13.1

<!-- zdroj: app:src/research-others.ts ResearchTreeKind, OTHER_BRIDGES_TIMINGS · src/ui/research-others-ui.ts · strings.ts researchOthers.otherTreeLabel, researchOthers.offReconnect · CHANGELOG.cs.md 3.13.1 -->

<a id="S1.8"></a>
## S1.8 Data stay on the computer

The app keeps trees in the browser's storage on this device. The research keeps its tree in its folder on the disk.
Between them the tree travels only through the bridge on this computer ([S1.1](#S1.1)).

- **Limits:**
  - Each browser has its own storage. A tree opened in Chrome is not in Edge.
  - The tree in the app and the tree in the research are two copies. The main one is the tree in the app, the research
    has its own copy, and what the research does not write is always visible in the app
    ([S2](S2-edits-from-the-app.md)).
  - From the research 1.35.0 the research also has the portraits, couples' photos and attachments of the tree. What
    is stored where and what is only in the browser is described in [S8](S8-where-the-data-are.md).
- **Since:** app 3.0.0

<!-- zdroj: app:src/storage.ts strom-db, strom-originals · strings.ts treeSettings.principles · research:src/core/live.ts 127.0.0.1 · S8: dirigent:spec/108-kde-se-co-uklada, research:c9a4b614 CHANGELOG.cs.md 1.35.0 -->

<a id="S1.9"></a>
## S1.9 Research on: the bridge's switch at a tree

Each tree from a research on this computer has the switch **Research on** in the app. It shows the bridge's real
state: on when the bridge answers, otherwise off. A bridge switched on runs until it is switched off with the switch or
`strom live stop`, until the computer shuts down, or as the setting **Switch research off when idle** says.

- **Limits:**
  - Switching off stops the bridge like `strom live stop`, except that the bridge keeps its address (port and key).
    A bridge switched off stays off: new work in the tree does not bring it back. The tree in the app stays and can
    still be edited ([S1.5](#S1.5)). Under the switch: "Switched off. It stays off until switched on again."
  - A bridge switched off by idleness comes back by itself with new work in the tree, at the same address. Under the
    switch: "Switched off after a time without work. New work in the tree switches it on again."
  - Switching on sends the research a link that starts only the bridge at its last address, without a window. When
    nothing happens, or the research cannot be switched on from the app, the app shows the command `strom live start`
    (to run in the terminal, in the tree's folder) with the button **Copy**. An older research that cannot be
    switched off from the app likewise shows the command `strom live stop`.
  - Meanwhile the switch shows the new state and **Turning on…** (**Turning off…**). When the bridge does not answer
    within 30 s, the switch goes back and **The research did not respond within 30 s. Strom Research needs to be
    started.** stands at it with the command and **Try again** ([A9.7.2](A9-using-the-app.md#A9.7.2)).
  - After the computer shuts down or restarts, the bridge is not running and does not start by itself. The user
    switches it on: **Switch on** in the research panel, or `strom live start`.
  - **Switch research off when idle** has two choices: **Until the computer shuts down** (the default) and **After 2
    hours without work**. It holds for all trees on this computer and the research keeps it (`live.idleMinutes` 0 or
    120). Running bridges take it within a minute. A value set in the terminal shows as **Own value (N min)**. When no
    research that takes the choice is running, the app shows the commands for the terminal instead of the choices.
  - Phones and tablets have no switch (the research runs on a computer). A copy of a tree from a research has the
    switch off in Manage trees; switching it on opens **Research for a copy of a tree** ([S1.10.1](#S1.10.1)).
- **Controls:** app: the switch **Research on** in the research panel (a tree not followed live, and after following
  ended) and in **Manage trees** at the tree's row; the research panel when the research is not running: **Switch
  on**; **Settings** → **Research on this computer** → **Switch research off when idle**. Terminal: `strom live
  start`, `strom live stop`, `strom config set live.idleMinutes 0` (until the computer shuts down) or `120` (after
  2 hours without work).
- **Since:** app 3.25.0, research 1.29.0. The state on the switch and the sentence after 30 s since app 3.30.0.

<!-- zdroj: research:src/core/live.ts liveWrite (POST <token>/live {idleMinutes 0…10080} → strom config set live.idleMinutes; {do: stop} → konec stopped, adresa zůstává), liveState (/status live idleMinutes, idleChoices), IDLE_READ_MS 60 s, reviveLive + endedIdle (zpět s prací jen konec idle; bez slova: zpět s menu, prací, aktualizací), stop SIGTERM → signal · src/core/config.ts DEFAULT_LIVE_IDLE_MINUTES 0, LIVE_IDLE_AFTER_MINUTES 120, LIVE_IDLE_CHOICES, LIVE_IDLE_MAX_MINUTES · src/core/links.ts LINK_LIVE_DOS start · src/commands/links.ts startBridge (bez okna) · app:src/ui/research-live-ui.ts researchLiveState (onComputer, link.copy, features live.stop / live.start), fillResearchLiveSlot, fillResearchLiveStart, renderResearchLiveSettings (LIVE_IDLE_FOREVER, LIVE_IDLE_TWO_HOURS, idleCustom), COMMAND_START / COMMAND_STOP · src/ui/research-ui.ts researchLiveSlot (panel po skončení sledování, idle, start) · src/ui/tree-management.ts researchLiveSlotHtml · strings.ts researchLive.* · index.html settings-group-research-live · spec 064 K1.1–K2.3 · 3.30.0: app:cd35804c src/ui/research-live-ui.ts START_CONFIRM_MS 30 s, researchLiveTimedOut (liveSilent, COMMAND_START, retry) · src/ui/switch-pend.ts (turningOn, turningOff) -->

<a id="S1.10"></a>
## S1.10 One research, one tree: a copy without research

Only one tree in the app writes to a research: the one that was created with the research or took it over. Every copy
of a tree from a research is a tree without research. It sends nothing to the research: not by itself, not with the
button, not with the first write of the files.

- **What a copy is:** **Copy of the whole tree** (formerly **Duplicate**, [A14.3](A14-trees-and-structure.md#A14.3)),
  the existing tree after **Open as copy** at a tree from a research (the new tree from the research takes its updates,
  the tree with the changes stays as it is, as a copy; [S1.2](#S1.2)), a second load of the JSON file of the same
  research, a merge into a new tree ([A8.10](A8-merging-trees.md#A8.10)) and trees restored as new ones from the backup
  of all trees.
- **How a copy shows:** in Manage trees and in step 1 of the merge guide "copy of the tree “{name}” · no research",
  with the switch **Research on** off. It has no research actions; ⋯ offers only **Turn on research…**.
- **Sending changes from the research:** the link through which the research asks for the changes always sends only
  the tree that belongs to the research. The question which tree to send is gone.
- **Limits:** a copy of a copy carries the name of that copy. A new tree from a selection and trees from a split are
  also without research ([A14](A14-trees-and-structure.md#A14)).
- **Controls:** Manage trees ([A14.1](A14-trees-and-structure.md#A14.1)).
- **Since:** app 3.32.0. Before, a copy stayed connected to the research of the original; it was only not updated
  from it.

<!-- zdroj: app:7d4236f8 (134 bod 11, 13: kopie stromu výzkumu nic nezapisuje do výzkumu originálu) · src/tree-manager.ts canSendToResearch (isResearchOwner), duplicateTree copyOf · src/research-owner.ts · src/ui/research-ui.ts sendChangesToResearch (?send= jen vlastník, „Only the research's owner is sent“) · f3c66503 (sloučení do nového stromu a obnovená záloha = kopie bez výzkumu) · src/tree-row.ts treeOriginLine · strings.ts research.copyOf, structure.turnOnResearch · dirigent:prace/_drobnosti/doc.md 134 bod 11+13 -->

<a id="S1.10.1"></a>
### S1.10.1 Research for a copy of a tree

A copy can get a new research of its own, or take over the research of the original. Both are offered by the window
**Research for a copy of a tree**: "“{copy}” is a copy of the tree “{original}”. Only one tree writes to a research,
so the copy gets a new research of its own."

- **Start a new research:** the field **Folder of the new research** is filled in with the name of the copy (with the
  path where the research on this computer starts researches, when the research tells it). Then starting the research
  continues as with **Start research** ([S4](S4-research-from-the-app.md)). The numbers of people and sources of
  another research do not go into the new research; the copy gets the numbers of the new research.
- **Take over the research of “{original}”…:** only when the original has a research; the window then also says "The
  research “{number}” stays with the tree “{original}”." Taking over is confirmed with a warning: "The tree
  “{original}” is unlinked from the research “{number}” and stops writing to it. Only the copy will write." and "The
  original stays as a tree without research.", the button **Take over research**. Taking over happens only in the
  app; nothing is sent to the research.
- **Limits:** the window is only on a computer where a research can be started from the app; not for the sample tree.
- **Controls:** Manage trees, the switch at a copy; ⋯ at a copy → **Turn on research…**.
- **Since:** app 3.32.0

<!-- zdroj: app:023879dd src/ui/research-adopt-ui.ts showCopyResearchDialog (složka = název kopie, treesRoot, copyResearchStays a Převzít jen u vlastníka originálu, is-danger potvrzení), src/research-owner.ts transferResearchTie (jen v aplikaci), src/research-link.ts (bez REFN P…/S… jiného výzkumu, K5.4) · a236a31e (název složky i přes soubor v Safari, cesta výzkumů) · strings.ts structure.copyResearch*, createResearch, takeOver* · spec 139 K5.1–K5.4 -->

<a id="S1.10.2"></a>
### S1.10.2 One-time detaching of trees that shared a research

Trees that shared one research before app 3.32.0 (older copies or two trees of the same research) are split once at
the first start of the new version. The research keeps one tree; the others are copies without research.

- **Which tree stays:** the tree that is not a copy; of several such, the oldest. When all are copies, the oldest
  copy stays as it is and still writes nothing to the research.
- **The others:** before detaching they get the backup **Before the data update of a new version**
  ([S6.5](S6-tree-from-another-program.md#S6.5)); the data stay unchanged. A locked encrypted tree is not read and not
  backed up; only its record in Manage trees changes.
- **At the first opening** of a detached tree the window **Copy without research** shows once: "The tree “{name}” was
  a copy tied to the research of the tree “{original}”. The tie was removed so that only one tree writes to the
  research. A research of its own can be started in Manage trees." When the copy sent changes to the research before:
  - when they wait in the research: "Before that, the copy sent changes to that research ({date}). They wait in the
    research and can be discarded there.";
  - when they are written: "…The research takes them back with one step in its terminal:" and the command
    `strom sync undo I0042` with **Copy**; with a known input also **Take back in the research**, otherwise `I…` and
    "I… stands for the number of that send in the research (strom input list shows it)."
    ([S2.6](S2-edits-from-the-app.md#S2.6)).

  The window has **Close** and, where possible, **Start research**.
- **Limits:** the repair runs once; an older register of trees brought back is looked through again.
- **Since:** app 3.32.0

<!-- zdroj: app:e4e3eeea src/tree-manager.ts repairSharedResearchTies (researchTiesRepaired, planSharedTieRepair, backupBeforeTieRepair 'pre-migration' bez čtení zamčeného šifrovaného, detachAsCopy, researchDetached) · src/research-owner.ts planSharedTieRepair (keeper: bez copyOf, nejstarší; jinak nejstarší kopie) · src/ui/research-detached-ui.ts showResearchDetached (jednou, sentAfterCopy pending/undo step, adoptTree) · strings.ts research.detached*, undoStep*, backups label pre-migration · dirigent:prace/_drobnosti/doc.md 134 bod 13 -->
