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
  - The bridge stops by itself when nobody asks it anything for two hours and nobody works in the tree meanwhile. The
    app's regular status request does not keep the bridge alive.
  - When the bridge restarts by itself (update, inactivity, crash), it keeps its address: the same port if it is free,
    and the same key. The app then connects without a new link.
  - `strom live stop` throws the key away: only `strom app` then connects the app again. When the port is taken by
    another program, the bridge takes another port and the app needs a new link.
  - The bridge refuses a write when the tree is sealed on another computer, when the tree's files in a cloud folder
    are not downloaded yet, and when the disk is full. Edits then wait in the app ([S2](S2-edits-from-the-app.md)).
- **Controls:** terminal: `strom live` (is the bridge running?), `strom live start`, `strom live stop` (`--forget`
  forgets the port too), `strom config set live.idleMinutes <minutes>` (0: never by itself). The run log is in the
  research folder in `.strom/live.log`.
- **Since:** research 1.0.0. The same address after a restart from 1.8.0, `live.idleMinutes` from 1.25.0.

<!-- zdroj: research:src/core/live.ts (v1.25.2) header :1-80, token crypto.randomBytes :1702, leaked :1809, :1995, LIVE_IDLE_MS / live.idleMinutes :1705, live-last.json :518, seal.foreign / tree.not-downloaded / disk.full · src/commands/start.ts live · src/core/config.ts live.idleMinutes -->

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
  - Safari does not let a web page connect to a program on this computer. `strom app` therefore never opens Safari.
    Without a suitable browser the installed app takes the file over, or the file `output/tree-strom.ged` from the
    research folder can be dragged into the app window.
  - Chrome and Edge ask the first time for permission to access devices on the local network. Without it the app
    cannot reach the research ([S1.5](#S1.5)).
- **Controls:** terminal: `strom app`, `strom app --live`. App: **Research → Other actions → Research for this
  tree…**
- **Since:** app 3.0.0, research 1.0.0

<!-- zdroj: research:src/commands/start.ts (v1.25.2) app, liveAppUrl / importAppUrl, Safari · app:src/research-link.ts:584 parseLoopbackUrl, :747 decideResearchOpen · src/ui/research-ui.ts:1088 initExternalOpen, :1350 importResearchFromUrl · src/local-network.ts · strings.ts research.notLocal, research.editedMessage, research.safariBlocked -->

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
| Copy | no mark | an older copy of a tree from the research (**Open as copy**, a duplicate, a second import); it is no longer updated from the research |

- **Limits:** whether a tree is a research or an archive is decided by the research, not by the app. It can be
  switched only in the research.
- **Controls:** app: the tree switcher. Terminal: the research menu.
- **Since:** app 3.12.0 (the name Strom archive), marks in the switcher from 3.16.0

<!-- zdroj: app:src/research-link.ts _STROM_TREE, _STROM_HEAD · src/types.ts:1695 ResearchLink (copy, mode) · src/research-others.ts researchAgentless · src/ui/research-sync-ui.ts researchKindOf :654, researchAgentAway · strings.ts treeSwitcher.kindArchive, kindResearch · spec 002 · CHANGELOG.cs.md 3.12.0, 3.16.0 -->

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

<!-- zdroj: app:src/ui/research-ui.ts startLiveFollow :2376 (opts.auto), researchReconnectOnly · strings.ts live.followLive, live.followingTree, live.followStarted, live.followMoved, live.liveEndedArchive, live.liveEndedNoAgent · CHANGELOG.cs.md 3.13.1 · spec 011 -->

<a id="S1.5"></a>
## S1.5 When the research is not running or the connection fails

When the app does not reach the research, the tree in the app does not change and edits in it wait. What exactly
happened, the app shows in the window **Couldn't connect to the research**.

| Cause | What the app shows | What helps |
|---|---|---|
| the browser does not let the page reach devices on the local network | **{browser} blocks the connection** | allow **Apps on device** (Brave: **Localhost access**) in the site settings |
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
  - **A new version of the research is available:** the app shows **New Strom Research {v}** with the button
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
- **Since:** app 3.0.0

<!-- zdroj: app:src/storage.ts strom-db, strom-originals · strings.ts treeSettings.principles · research:src/core/live.ts 127.0.0.1 -->
