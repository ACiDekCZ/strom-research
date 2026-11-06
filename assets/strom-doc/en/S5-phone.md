<a id="S5"></a>
# S5 Phone

How a phone connects with the research on the computer, what can be seen and done on it and when the connection does
not work. Describes the Strom app 3.21.2 and the research 1.25.2; changes from a later version carry its number.
The phone does not open the Strom app: it opens the page **Strom research**, which the research on the computer serves
in the home network.

<a id="S5.1"></a>
## S5.1 The phone connection belongs to the computer and only a person turns it on

The phone connection is one for the whole computer, not for one tree. Only a person may turn it on, by confirming in a
window on the computer. It can be turned off at any time; paired phones stay paired after it is turned off and connect
again after it is turned on.

- **Limits:** the page for the phone is served by the research, not by the app. Without a running research
  ([S1](S1-connecting-app-and-research.md)) the phone sees nothing. The window "Turn on phone connection?" appears on
  the computer by itself; without an answer within 5 minutes or after **Cancel** the connection stays off. The agent
  does not turn the connection on, it may only turn it off. Where the research cannot show the window (a computer
  without a graphical desktop), it is turned on in the terminal.
- **Controls:** app: **Research → Other actions → Connect phone…** → **Turn connection on** → on the computer the
  window "Turn on phone connection?" → **Turn on**; **Turn connection off** in the same dialog · terminal: `strom
  phone on` (Enter means no), `strom phone off`, `strom phone` (state); menu **Settings → Phone connection**.
  When the connection is on, the button **Research** has a dot and the menu item is called **Phone** with the label
  **on · 2** (the number of paired phones).
- **Since:** research 1.18.0, app 3.14.0

<!-- zdroj: research:src/core/phone.ts askPhoneOn, phoneOff, phoneState · src/core/dialog.ts WAIT_SECONDS · src/commands/phone.ts · src/cli/menu-settings.ts:79 · app:src/ui/phone-ui.ts:150 phoneAvailable, :731, :918 phoneMenuItem · src/ui/research-actions-ui.ts:365, :460 · strings.ts phone.menuConnect, phone.menuOn, phone.statusKeep -->

<a id="S5.2"></a>
## S5.2 The phone is paired with a QR code from the computer

The phone connects by reading the QR code shown by the dialog **Connect phone** (or by the terminal). The code holds
for 10 minutes and for one phone. The research then remembers the paired phone, and the page opens without a new
code.

- **Limits:** the phone has to be on the same local network as the computer ([S5.5](#S5.5)). The code is not sent to
  the computer in the page's address and stops holding after pairing; the dialog then has **New code**. Pairing holds
  for 400 days. The phone's name in the list is derived from the browser, e.g. "iPhone (Safari)". After pairing, the
  phone opens the tree for which the code was shown last. The page speaks the language the app had when the code was
  shown.
  A computer with several networks (Wi-Fi and cable) offers a code for each of them (**Other network: …**).
- **Controls:** app: in the dialog **Connect phone** the QR code with the text **Code valid for … more, for one
  phone.**; after reading **Paired: iPhone (Safari)** and **Connect another phone** · phone: the camera (iPhone) or
  the camera or Google Lens (Android) · terminal: `strom phone qr` (only in a person's terminal, not for the agent).
  On the page, **Icon on the home screen** adds an icon that opens the page without pairing; it can be added within
  10 minutes of pairing.
- **Since:** research 1.18.0, app 3.14.0

<!-- zdroj: research:src/core/phone.ts PAIR_MS, PHONE_KEY_DAYS, HOME_MS, pairCode, pairPhone, pageLang, phoneName · src/commands/phone.ts qr · app:src/ui/phone-ui.ts · strings.ts phone.qrValid, phone.qrOther, phone.paired, phone.qrExpiredHint -->

<a id="S5.3"></a>
## S5.3 The phone page shows the research read-only

The page **Strom research** shows the state of the research of one tree, but decides and starts nothing in it.
Order of the parts: **Now** (whether and since when work goes on), **Finds**, **Last 24 h** (people, sources,
saves), **Progress** (the latest changes) and at the end **Waiting**.

- **Limits:** items in **Waiting** can be answered only on the computer ("Decisions are made on the computer in the
  Research overview.", [R6](R6-awaiting-action.md), [S4](S4-research-from-the-app.md)). The page does not show paths
  to files, record numbers, spending or the agent's model. **Finds** are only what the agent wrote about the family (a
  new person, family, name, child, a fact found, corrected or newly proven, a new source, a resolved conflict, a
  decided question), not a person's edits ([S2](S2-edits-from-the-app.md)); by default for the last 24 h, older ones
  up to 31 days back. **Progress** shows at most 20 changes, **Waiting** 20 items with an offer of more; the rest is
  in the **Research overview** on the computer.
  For a Strom archive (a tree without an agent) the page does not show the agent's work.
- **Controls:** phone: the switcher **Research trees on this computer** (all trees with a research on this computer,
  an archive with the mark **archive**); the page refreshes by itself every 10 s while it is visible.
- **Since:** research 1.18.0; Strom archive 1.20.0; the page in Polish 1.25.0

<!-- zdroj: research:src/core/phone-send.ts state, log LOG_PHONE, waiting WAITING_SHOWN · src/core/phone-finds.ts FINDS_BACK_DAYS · src/core/phone-watch.ts · assets/phone/phone.js (v1.25.2) · assets/lang/cs.json ui.phone.page.* -->

<a id="S5.3.1"></a>
### S5.3.1 Lines from the phone

In research 1.26.0 the page has the card **Lines · in the order of work**. From it a line can be moved up or down
and paused or started again, the same as on the computer ([R2](R2-lines-and-queue.md)).

- **Limits:** a line opens on a tap. For a Strom archive the research refuses a change of a line. **Waiting** can
  still be answered only on the computer.
- **Controls:** phone: **Move up**, **Move down**, **Pause**, **Start again**.
- **Since:** research 1.26.0

<!-- zdroj: research:HEAD src/core/phone-send.ts POST /phone/line/<key> · assets/lang/cs.json ui.phone.page.lines.* · CHANGELOG 1.26.0 -->

<a id="S5.4"></a>
## S5.4 Photos from the phone go to the research in batches

Photos of documents from the phone (taken on the page or picked from the gallery) are sent to the research of the
chosen tree as one batch. A note and a person can be added to the batch. **Hand over to research** closes the batch,
and the research makes tasks to sort it out, the same as with **Add materials…** ([S4](S4-research-from-the-app.md)).

- **Limits:** photos are saved unchanged, in full resolution and outside the tree's history. A file the research
  already has is not sent again ("already in the research, not sent"). One photo may have at most 500 MB. Where the
  computer cannot convert the HEIC format, the page accepts only JPEG. A batch nobody hands over is handed over by
  itself an hour after the last photo. Photos taken on the page are not saved to the phone's gallery. Unsent photos
  wait on the phone and are sent by themselves once the connection is back; after a week without opening the page the
  browser may delete them.
  For a Strom archive the photos are saved to the archive on the computer.
- **Controls:** phone: **Take photo**, **From gallery** → **Photos to send** → note and person (from 2 letters, at
  most 8 suggestions) → **Done** → **Hand over to research** (for an archive **Save to the Strom archive**); **Cancel
  hand-over**, **Next batch**; for unsent photos **Save to phone**, **Discard**.
- **Since:** research 1.18.0; **Save to the Strom archive** 1.20.0

<!-- zdroj: research:src/core/phone-send.ts media, batch/<id>/done, originalMax · src/core/batches.ts PHONE_BATCH_IDLE_MS, batch.why.phone · assets/phone/phone.js · assets/lang/cs.json ui.phone.page.commit*, keep.*, st.already, offline.queue -->

<a id="S5.5"></a>
## S5.5 When the phone does not connect

The phone reaches the computer only on the same local network, through the computer's private address on Wi-Fi or a
cable, and only when the research runs on the computer. Other devices and the computer itself do not get the page.

- **Limits:**
  - another network: a guest Wi-Fi, mobile data, a VPN or a virtual network is not enough; a computer without a local
    network reports "The computer is not on any local network right now." and the connection starts by itself once on
    Wi-Fi;
  - firewall: Windows wants **Private networks** ticked and **Allow access** in the window for `node.exe`, and the
    network must have the type Private, not Public; a Mac may want **Allow**; on Linux the firewall must allow the
    connection's port;
  - port: the research tries the ports 47800–47819; when they are taken, it reports "Another program is using port
    …";
  - a change of the computer's address: phones paired before and bookmarks stop holding, and the phone has to be
    paired again (a yellow strip **The computer address changed to …** with the button **New QR**); reserving the
    address in the router helps;
  - the research is not running: the dialog shows "A phone connects through the running research." and the connection
    comes back by itself with the research;
  - research older than 1.18.0: "This version of the research does not connect a phone.";
  - the computer sleeps or is off: after two failed refreshes the page shows "The computer is not responding right
    now" with the last data and their time; the connection is retried by itself.
- **Controls:** app: when the phone does not answer within a minute after the code is shown, the dialog offers the
  list **The phone has not reached the computer yet. Check:** with the link **How to**; on an error the item
  **Phone** with the label **connection problem** appears right in the menu **Research**. The dialog offers the phone
  only on a computer with a mouse, not in Safari and only for a tree with a research. Following the research
  ([S4](S4-research-from-the-app.md)) opened by a link on a phone shows "The research runs on a computer".
- **Since:** research 1.18.0, app 3.14.0; coming back with the research after a restart research 1.19.0

<!-- zdroj: research:src/core/phone.ts lanAddresses, remoteAllowed, PHONE_PORT, PORT_TRIES, revivePhone · assets/phone/phone.js S.fails · app:src/phone.ts:235 PHONE_SILENT_MS, :286 phoneAddressChanged · src/ui/phone-ui.ts:150 · src/ui/research-ui.ts:1514 · strings.ts phone.err*, phone.check*, phone.down*, phone.older, phone.addr* -->

<a id="S5.6"></a>
## S5.6 An unpaired phone sees nothing any more

Unpairing takes access away from one phone. Turning the connection off stops the page for all phones but keeps the
pairing.

- **Limits:** **Unpair** can be undone only for 15 s (**Undo**); after that the phone has to be paired again. An
  unpaired phone sees on the page "This phone is not paired with this computer"; unsent photos stay on it and are sent
  after a new pairing. After a change of the computer's address, the dialog offers at a new pairing **Remove old
  entry** for the same phone.
- **Controls:** app: **Connect phone** → **Paired phones · 2** → **Unpair** / **Undo** · terminal: `strom phone
  list`, `strom phone remove …`; menu **Settings → Phone connection**.
- **Since:** research 1.18.0, app 3.14.0

<!-- zdroj: research:src/core/phone.ts phoneEntries stale, maybeReplaces · src/core/live.ts (v1.25.2):3755-3857 phone/remove, phone/restore PHONE_RESTORE_MS · src/commands/phone.ts · app:src/ui/phone-ui.ts UNDO_MS · strings.ts phone.rowUnpair, phone.rowUndo, phone.replacesBtn -->

<a id="S5.7"></a>
## S5.7 The Strom app on a phone does not run the research

The Strom app opened on a phone or a tablet does not connect to the research on the computer. Sending edits to the
research and its other actions work only on the computer where the research runs; the page **Strom research** belongs
on the phone ([S5.3](#S5.3)).

- **Limits:** for a tree that already has its research, **Ancestor research** on a phone shows only an explanation:
  edits made on the phone stay in this browser and get to the research by opening the tree on the research's
  computer (after an export to a file). A link to follow the research opened on a phone shows "The research runs on a
  computer" ([S4](S4-research-from-the-app.md)).
  **Connect phone…** is not offered on a phone.
- **Controls:** app on a phone: **More → Tree → Ancestor research**.
- **Since:** app 3.9.0; the link to follow on a phone 3.12.0
- **From app 3.22.0:** the app on a phone shows directions ([R2](R2-lines-and-queue.md)) read-only with the sentence
  "Directions can be changed in Strom on the computer where the research runs."; a tap shows the direction in the
  tree.

<!-- zdroj: app:src/ui/tree-actions.ts:257 treeResearchRow · src/ui/research-promo-ui.ts:272 showResearchInfoDialog · src/ui/research-ui.ts:1514 onPhone · src/ui/phone-ui.ts:150 phoneAvailable · strings.ts:9864 research.phoneHasResearch, :9423 connect.reasonPhoneLive · HEAD src/ui/research-directions-ui.ts dirPhoneOnly (fa73007) -->
