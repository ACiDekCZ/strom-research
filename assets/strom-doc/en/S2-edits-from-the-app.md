<a id="S2"></a>
# S2 Edits from the app in the research

What the app sends to the research, when, what the research does with it and what it does not accept. Describes the
Strom app 3.21.2 (and the research 1.25.2). How the app connects with
the research is described in [S1](S1-connecting-app-and-research.md). What becomes of an edit of a proven fact is
described in [R5.2](R5-conflicts.md#R5.2).

<a id="S2.1"></a>
## S2.1 The tree in the app is the main one

The tree in the app and the tree in the research are two copies. Edits from the app go to the research by sending the
whole tree. The research compares what it gave the app, what arrived and what it has now, and writes only what changed
in the app. What the research does not write stays in the app and is visible.

- **Limits:**
  - What the research did by itself meanwhile is never taken as an edit from the app that would undo it.
  - A tree from another program or an older export without the record of the research version it came from: the
    research takes only new facts and only shows the differences.
  - One send is one entry in the research's history with one source, and it can be undone ([S2.7](#S2.7)).
- **Since:** research 1.0.0

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :1-19 · app:strings.ts treeSettings.principles -->

<a id="S2.2"></a>
## S2.2 When edits are sent

Each tree from the research has its own way of sending. It is chosen in the window **Research for this tree**, section
**Sending changes**.

| Option | What happens |
|---|---|
| **Manually** | sending only by the button **Send**; before that **What will be sent** is shown |
| **Automatically** | edits are sent by themselves after a moment of quiet |
| **Only load from the research (send nothing)** | nothing is sent, the tree is only loaded from the research |

- **Limits:**
  - Default option: **Manually** for a research with an agent, **Automatically** for a Strom archive and for a
    research waiting for an agent. A tree connected to the research before app 3.9.0 sends automatically. For such a
    tree and for a tree opened from the research the app asks once **How should changes go to the research?**; the
    way used so far is marked **(so far)**.
  - **Automatically** sends edits after 2 minutes without another edit, on switching to another tree and on leaving
    the page. It sends only to a running research and always for one tree at a time.
  - A tree followed live is read-only and sends nothing ([S1](S1-connecting-app-and-research.md)).
  - The research is not running: edits wait and are sent after it starts. **Send** can start it through a link in the
    terminal.
  - The app waits at most 2 minutes for the research's answer. Then it shows "The research didn't answer in time";
    the edits stay in the app.
  - After switching from **Only load from the research**, the first send is always manual through **What will be
    sent**.
  - Edits are sent only from the computer on which the research runs. A phone does not send edits ([S5](S5-phone.md)).
- **Controls:** app: **Research → Other actions → Research for this tree… → Sending changes**; the button **Send**
  (**Send to research**); **Send now**; **Send without preview next time**
- **Since:** app 3.9.0 (research 1.12.0); sending on leaving the page from app 3.16.0

<!-- zdroj: app:src/research-sync.ts:43 newTieSendMode · src/types.ts:1735 ResearchLink.sendMode · src/ui/research-sync-ui.ts (v3.21.2) AUTO_QUIET_MS :136, SEND_TIMEOUT_MS :130, pagehide :428, researchAutoSend :1438, researchSendNow · src/ui/research-tree-settings-ui.ts researchSendModeCardsHtml, maybeAskResearchSendMode · strings.ts treeSettings.sending, auto, manual, off, askTitle, askWas, deviceNote · changes.skipPreview · sync.sendNoAnswer, sync.sendWhenRunning · CHANGELOG.cs.md 3.16.0 -->

<a id="S2.2.1"></a>
### S2.2.1 What will be sent

Before a manual send the app shows the list **What will be sent**: changed people (new person, deleted, name, birth,
death, marriage, event, godparents, witnesses), changed sources with the places where they are cited, couples, places
with new coordinates and surname variants. Each group has its own section. After writing it shows in the same way
**What was written** with the sections **Written** and **Not written**.

- **Limits:** when the exact list cannot be computed, the tree is sent as it is and the research writes only the
  differences.
- **Since:** app 3.14.0
- **From app 3.32.0 (research 1.37.0):** a send says which browser it came from: a lasting random id stored in that
  browser and a readable name from the browser and the system (e.g. "Chrome · Mac", not translated, nothing
  personal). Both go only with a send to the research; an exported file never carries them. A change in the
  research's history sent from another browser has "from Chrome · Mac" after it; a returned send from another browser
  says "Sent from Chrome · Mac.". A browser without a name is stood for by the first 8 characters of its id. With an
  older research everything reads as before.

<!-- zdroj: 3.32.0: app:src/device-client.ts (DEVICE_ID_KEY strom-device-id, browserOf, systemOf, deviceNameOf „Chrome · Mac“), src/research-link.ts:5883-5957 1 _STROM_CLIENT / 2 NAME jen při poslání do mostu, src/conflict-devices.ts otherDeviceWords, deviceWords (ID_SHOWN 8), src/ui/research-ui.ts:838-842, src/ui/research-sync-ui.ts:3556-3560 · strings.ts research.fromDevice, research.sentFromDevice · research:3856505e src/core/sync.ts _STROM_CLIENT · spec 094 K2.4 -->
<!-- zdroj: app:strings.ts changes.willSendTitle, changes.kind*, changes.inexact, changes.writtenSection, changes.notWrittenSection · CHANGELOG.cs.md 3.14.0 -->

<a id="S2.2.2"></a>
### S2.2.2 Folio, image and call number from the app

An app that keeps the source's fields ([A3.9](A3-evidence-in-the-app.md#A3.9)) sends the research the call number,
folio, image and other location by fields. The research compares them by fields and writes an edit as an edit of the
source's page.

- **Deletion:** a folio, image or call number a person deletes in the app is deleted by the research too. Undoing the
  send ([S2.7](#S2.7)) brings them back.
- **Limits:**
  - an older app that does not know the fields deletes nothing. An edit of the whole page from an older app replaces
    the locator and deletes the folio and image entered (undoing brings them back);
  - a value that the app's file still names is not deleted: a folio or image in the page (`PAGE`), a call number as
    the whole page or on its own line of the source's note ("Call number: …", in any language). It is better that it
    stays than that something the app did not see as a field is deleted;
  - the call number of the book and the image number from registered scans are not fields of the source: a deletion
    in the app does not change them;
  - for a source read by the research, neither an edit nor a deletion is written into the source; a note is written
    beside it ("folio: removed in the Strom app (was fol. 12v)").
- **In the list What will be sent** ([S2.2.1](#S2.2.1)) a changed call number, folio or image is a change of the
  source's page.
- **Since:** app 3.27.0 with research 1.31.0

<!-- zdroj: research:337787ff, 87785596 src/core/sync.ts:3534 SOURCE_EDITS, SOURCE_FIELDS, :3551 removedFields (fieldsKept, entryWords, locatorOverlap, isValue, noteCallNumbers, CALL_NUMBER_LABELS), removedLine (sync.reading.removed) · 4de28f00 (úprava celé PAGE ze starší aplikace nahradí locator a smaže folio/snímek, undo vrátí) · app:c3278633 src/research-changes.ts (změna signatury, folia, snímku jako strana), src/ged-exporter.ts sourceFields · CHANGELOG.cs.md 1.31.0 · dirigent:prace/1111-vyzkum-citace-most-n1, prace/1111-vyzkum-citace-pole · spec 075 U1c B -->

<a id="S2.2.3"></a>
### S2.2.3 Which tree is sent

What goes to the research is always the tree connected to it, with its own data. A switch to another tree changes
nothing about that.

- **A switch of trees:** the unsent edits of the tree being left go at once ([S2.2](#S2.2)). The tree being switched
  to is sent only once it is open, at the bridge's next answer. An edit saved during the switch stays in the tree it
  was made in.
- **A copy without the research's people:** the app does not send a copy that hardly carries the research's people:
  the research's version the tree builds on has at least 10 people with a research number, the send would carry
  fewer than 10 % of them, and fewer than 10 % of the people sent would carry such a number. It does not send it by
  itself, with the **Send** button or on leaving the page; the edits stay unsent in the app. A send with the button
  says so in the message “Not sent: the tree open here has hardly any of the research's people, so it would read
  there as another family tree. The changes stay here.”, **Send again** of a taken-back send in the message “Not
  sent again: that send did not carry this tree's people. The changes stay here.” A send by itself and leaving the
  page say nothing; the mark shows the edits waiting.
- **The sample tree** is never sent to a research ([S1.3.1](S1-connecting-app-and-research.md#S1.3.1)).
- **From app 3.32.0:** a copy of a tree from a research is not sent to the research at all, not even with the button.
  When the research asks for the changes through a link, the tree that belongs to the research is sent
  ([S1.10](S1-connecting-app-and-research.md#S1.10)).
- **Limits:** from research 1.34.0 the research itself also refuses a small other tree under its connection
  ([S2.5](#S2.5)). A send taken back that did not carry the tree's people is not offered again ([S2.7](#S2.7)).
- **Since:** app 3.29.0

<!-- zdroj: app:7e92c784 src/data.ts switchTree/loadStartupTree (switchSeq, id stromu spolu s daty), getDataFor(treeId), save() páruje id s daty · 92f9e978 DataManager.isSwitchingTo(treeId) (odkládá se jen poslání stromu, na který se přepíná; autoDue při odpovědi mostu) · bbcc2b17 src/research-foreign-send.ts foreignSendCheck (FOREIGN_SEND_MIN_BASE 10, FOREIGN_SEND_SHARE 0.1, čísla REFN P…), src/ui/research-sync-ui.ts (auto, ruční, odchod ze stránky) · 302a2d3d (bez navigator.locks bez zámku) · CHANGELOG.cs.md 3.29.0 „Přepnutí stromu“ · prace/1115-app-prepnuti-stromu, prace/1115-app-odeslani-pred-prepnutim · hláška ručního poslání: app:65e7cba0 strings.ts sync.foreignNotSent, sync.undoneForeignNotSent (jen ručně a Poslat znovu) -->

<a id="S2.3"></a>
## S2.3 What the research does with sent edits

A research with an agent writes a send at once. A new fact or person from the app is always a **Lead** with the
source "Edits in the Strom app", never Proven. A change of a fact proven by a record becomes a conflict. The detailed
rules are in [R5.2](R5-conflicts.md#R5.2); transcriptions of sources from the app in
[R3.5.1](R3-verification-and-citation.md#R3.5.1).

- **Limits:**
  - With the research option `sync.review on`, the research does not write a send at once. It waits for a person's
    word in the terminal ([R6](R6-awaiting-action.md)); the app meanwhile shows **Waiting for confirmation in the
    research.**
  - After writing, the app loads the research's new version by itself when nothing would be lost in the app.
  - Conflicts that arose from a send are shown by the app with the message **Written, N conflicts to decide** with
    **Show**. They are decided in the research (**Decide in the research**); until then the value from the app stays
    in the app.
- **Controls:** terminal: `strom config set sync.review on|off`, `strom config set sync.edits conflict|user`
  ([R5.2.1](R5-conflicts.md#R5.2.1)). App: the window **Research for this tree** shows what the option means
  ("Changes are written in the research only after confirmation.").
- **Since:** research 1.5.0; `sync.review` from 1.12.0
- **From research 1.32.0:** `strom sync` of a tree from the app (JSON and GEDCOM) keeps shared events, roles, the
  own events **Godparent** and **Wedding witness** and the participants of events
  ([A10](A10-shared-events.md)), as when a family tree is taken over
  ([R11.3](R11-material-from-the-user.md#R11.3)). Research that took over the tree from the app earlier is not
  repaired by itself; the next `strom sync` from the app adds what is missing:
  - a note of a person or family that the earlier taking over shortened to 500 characters, to the whole note (it can
    be taken back);
  - missing own events of a godparent and a witness as new facts, and missing participants of events;
  - a person or family that the GEDCOM taking over in research 1.31 left out because of a long note with a character
    outside the basic set (emoji) is offered as new.

  The notes of events and of participants are not compared by `strom sync` in research 1.32.0 and 1.33.0, so it does
  not fill them in; the app keeps them whole.
- **From app 3.28.0:** research older than 1.32.0 does not give back shared events and the own events of a
  godparent and a witness. The app takes them over from the previous state of the tree when it loads a new version
  of such research: it knows a person by the number in the research, an event by type, date, place and value, only
  when the match is the only one. An event the research changed is an ordinary event of its person; the other copies
  stay joined.
- **From research 1.34.0:** `strom sync` also compares the note of an event, from the GEDCOM file and from the
  app's JSON alike, three ways: a note the research
  does not have it fills in; a note the user changed since the last handover it corrects (the previous one stays in
  the note's history); a note changed on both sides it leaves to a choice. A removed note removes nothing. The lines
  the export writes into a note (the state, the words of the entry, ages), the research's own lines and the note the
  app gives each copy of a shared event do not count as an edit. The edit can be undone. A sync started by the agent
  changes neither the user's note nor the note of an imported fact. A new fact from the app does not carry its note
  yet.
  - **Which event:** an event of the file is paired with the research's event first by its number in the research
    (E…), which the app's file carries, then by its details and its name. The note of one event never corrects
    another; of two alike events of one person (the same type, day and source) that nothing of this tells apart,
    neither note is taken. An unedited tree from the app changes no note.
  - **A participant's note:** research 1.34.0 does not take the note of a participant of an event (a godparent, a
    witness…) from the app; from research 1.35.0 it takes it as [S2.3.2](#S2.3.2) says.
  - **Notes written to an alike event:** `strom sync` of a research older than 1.34.0 could write to an event the note
    of another event of the same person or family with the same type, day, place and value, and to a participant
    their note cut short by app 3.28.0. Research 1.34.0 sets this right by itself and once, at the first start of the
    new version or at a bridge's start, while nobody is at work on the tree; when there is something to set right, the
    research is backed up first. It puts back the note as it was before the send, and the one written stays in the
    note's history. An event's note changed since that send it leaves as it is.
    - **From research 1.35.0:** each such note left as it is has a task waiting for the person, in **What waits** and
      in the app ([R6.2](R6-awaiting-action.md#R6.2), [S4.4](S4-research-from-the-app.md#S4.4)): "Check the note of
      {event} ({person}): a send of the Strom app wrote there the note of a fact alike". The task gives the note before
      the send, what the send wrote and the note now. Before, only a line in the history said so.

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :1-19 · src/core/config.ts:285 sync.review · src/core/live.ts accepts() :1455 sync.auto write|off|mirror · app:src/ui/research-sync-ui.ts :1-21 · strings.ts sync.statePendingSub, sync.flyConflict, sync.showConflicts, sync.decideInResearch, sync.writtenConflictsSub, treeSettings.effectReview · 1.32.0: research:ac489205 src/core/sync.ts readStromJson (appPersonEvent, appParticipants; fact.new, fact.part, fact.share), research:f8eb2032 note.correct (zkrácená poznámka → celá), research:01125661 (NFD zkrácená poznámka), dirigent:prace/1113-vyzkum-json-intake-drobnosti bod 5 (vynechané osoby 1.31 → nové), postřeh 2 (sync poznámek událostí a účastníků) · 3.28.0: app:80c2ffb9 src/research-link.ts keepEventShares, EVENT_SHARE_FEATURE event.share, eventMatchKey · 1.34.0: research:4cfc233c src/core/sync.ts fact.note, fact.part.note (noteEdits, pick, smazání nic), dirigent:prace/1115-vyzkum-095-cli-drobnosti B1 · párování podle čísla: src/core/sync.ts planSync (byId `2 _STROM_EID`, sure), poznámka účastníka: src/core/stromapp.ts APP_SENDS_PART_NOTES undefined (dirigent:prace/1115-release-vyzkum-1.34.0 Průběh 22:02) · poznámky k podobné události: research:7a556be2 src/core/notefix.ts settleNotes, noteFixes (alike: druh, datum, místo, hodnota; wrongPartNote cut: aplikace před 3.29.0, poznámka > 200 B), applyNoteFixes (noteEdits, marker twin-notes-1), backupBeforeNotes; src/cli/main.ts (první spuštění verze), src/core/live.ts (start mostu) · 1.35.0: research:bb79ee54 askLeftNotes (origin sync:notes-left, waiting, kind other), assets/lang/cs.json notes.left.* · CHANGELOG.cs.md 1.35.0 „Poznámka změněná po odeslání z aplikace“ · dirigent:prace/1116-vyzkum-po-134 bod 2 -->

<a id="S2.3.1"></a>
### S2.3.1 The main citation and a removed citation from the app

The research takes the main citation ([A3.2.2](A3-evidence-in-the-app.md#A3.2.2)) and a citation removed from a fact
([A3.2.3](A3-evidence-in-the-app.md#A3.2.3)) as the user's edit. Each can be undone ([S2.7](#S2.7)), and the
research's history says who and when.

- **Main citation:**
  - the citation marked in the app is the main one in the research too
    ([R3.4.5](R3-verification-and-citation.md#R3.4.5)); another citation of the same fact stops being the main one;
  - the research recognises an unmarking when the file from the app comes from a version of the research in which
    the main citation was, and it is no longer at the citation. For a file the research gave nothing, the main
    citation is taken only as a setting;
  - a main citation at a citation the research does not have, the research first adds and then marks. When it does
    not add the citation, it does not set the main one and says so ([S2.5.1](#S2.5.1));
  - a main citation at a fact whose date or type the user changed in the same send the research does not write (it
    does not match the fact); it is enough to send it again after the next load.
- **Removed citation:**
  - the research removes it from the fact and remembers the removal
    ([R3.4.6](R3-verification-and-citation.md#R3.4.6)). The source and its images stay. A removed main citation also
    removes the main one;
  - at a shared event it is removed once, from that one shared event of the research;
  - only a citation the fact had in the research version the app's file comes from is removed. A citation of the
    same source that the agent added later stays.
- **Limits:**
  - the research takes a removal only from the GEDCOM file the app sends through the bridge, and only at a birth,
    a death, a person's events, a marriage, a couple's events and a divorce. Citations of a person, a name and
    a family are not removed from the app;
  - when the whole source is missing in the file, nothing is removed: the source stays in the research with its
    citations and is deleted in the research;
  - an app that does not send removals yet removes nothing; the citation stays in the research;
  - from the app's JSON file the research reads the main citation (from data version 21), not a removal;
  - the app offers the main citation only with a research that keeps it, and with a research that does not take
    removals it says so ([A3.2.3](A3-evidence-in-the-app.md#A3.2.3)). The research writes `_STROM_MAIN` and
    `1 DATA` › `2 EVEN` only to an app that reads them ([A2.7](A2-loading-a-family-tree.md#A2.7)).
- What of this the research did not take, the app lists by name ([S2.5.1](#S2.5.1)).
- **Since:** app 3.29.0 with research 1.34.0

<!-- zdroj: research:355df0a5 src/core/sync.ts fact.main (op event.main, _STROM_HEAD: zrušení), fact.uncite (jen s HEAD, APP_SENDS_UNCITE, BIRT/DEAT/LifeEvent/MARR/události páru/DIV; cite.notCarried, cite.sourceRemoved, cite.olderApp, fact.noMatch, main.notCarried), :5268 · src/core/stromapp.ts:806-820 APP_READS_MAIN_CITATION, APP_SENDS_UNCITE, APP_DATA_MAIN_CITATION 21 · src/core/live.ts features citations.order, citations.main, citations.remove, sync.notWritten.codes · 4cd81f14 (vrácení) · app:src/citation-gates.ts · ZADANI_VYZKUM_hlavni-citace.md 3.2, 4.1, Upřesnění 3 a 5, V6, V7 · spec 095 K2, K3 -->

<a id="S2.3.2"></a>
### S2.3.2 A participant's note from the app

The detail of a godparent, a witness or another participant of an event (the field **Detail (trade, "neighbour"…)**,
[A10.5](A10-shared-events.md#A10.5)) edited in the app the research takes as the user's edit, as the note of an
event ([S2.3](#S2.3)): a note the research does not have at the participant it fills in; a note the user changed
since the last handover it corrects; a note changed since in the research too, or without a known handover, it
leaves to a choice. The edit can be undone ([S2.7](#S2.7)).

- **From where:** from the GEDCOM file of app 3.29.0 and newer and from the app's JSON file with data version 21 and
  higher, from a file and from what the app sends straight over the bridge. From an older app, or from a file that
  does not say its version, a participant's note is not taken.
- **A shorter note:** a note that is only the beginning of the research's note is never taken by itself. A tree saved
  in app 3.28 carries a longer participant's note cut short in a newer app too, and the research cannot tell whether
  the app or the user cut it. A cut between a letter and its accent ("sedla" of "sedlák") and a broken character at
  the end count as a beginning too.
  - shorter than the research's note: `strom sync` says so in a line "not taken: shorter than the research's —
    whether to take it waits under Waiting", and the write makes a task waiting for the person "The note of {who} at
    {event} ({person}) from the Strom app is shorter than the research's: take it, or keep the research's?" with both
    notes. The task is in **What waits** and in the app ([S4.4](S4-research-from-the-app.md#S4.4)). App 3.30.0 has
    in **What was written** ([S2.5.1](#S2.5.1)) the line "shorter detail of a godparent or witness not taken: the
    research asks in Awaiting action whether to take it";
  - shorter only than what the app was given by the research (the research changed the note since): nothing is
    written and nobody is asked.
- **It asks once:** the same tree sent again makes no new task, not even after the decision. Undoing the send
  ([S2.7](#S2.7)) drops the task that still waits.
- **A question is not a change:** `strom sync` counts a question apart from the research's changes ("N changes
  against the research, N questions to decide"; when there is only a question, "Nothing in the research changed by
  …: N question waits under Waiting"). The same tree sent again while the question waits says "A question of an
  earlier send still waits under Waiting" with the task's number.
- **The person decides:** **Take the shorter note from the app** writes the shorter note at the participant, **Keep
  the research's note** leaves the research's note; the task is done either way. The agent carries out the decision
  only by the person's answer to the task ([R6.6](R6-awaiting-action.md#R6.6)). When the research's note changed
  since the question, taking writes nothing and says so.
- **Limits:** a note the file no longer has removes nothing. A note is taken only at a participant in the same role
  and only at an event the research pairs surely ([S2.3](#S2.3), Which event).
- **Controls:** terminal: **What waits** → the task → **Take the shorter note from the app** or **Keep the research's
  note**; `strom sync note T… take|keep`.
- **Since:** research 1.35.0 (app 3.29.0, data 21); the line in **What was written** since app 3.30.0

<!-- zdroj: research:bb79ee54 src/core/stromapp.ts APP_SENDS_PART_NOTES "3.29.0", appSendsPartNotes · research:28237d57 APP_DATA_PART_NOTES 21, appDataPartNotes · src/core/sync.ts planSync partNotes, partNoteDiff (add / correct / pick; mine podle role a osoby; given; p.note povinná: odebraná nic; jen sure), cutShort (noteLine, NFD), sentNote (U+FFFD, půlka páru) · research:fb94435f src/core/shorternote.ts SHORTER_ORIGIN sync:note-shorter, shorterAsked (jednou, dropped ne), askShorterNote (waiting, kind other), decideShorterNote (personWrites nebo answers; shorter.changed) · src/commands/sync.ts sync note (person, agentMay s odpovědí) · src/cli/menu-waiting.ts shorterNote (take/keep) · assets/lang/cs.json ui.sync.do.note.shorter, note.shorter.*, ui.wait.a.shorter.* · CHANGELOG.cs.md 1.35.0 „Poznámka účastníka z aplikace Strom“ · app:2c2cec57 strings.ts sync.nw note.shorter, participantNote · dirigent:prace/1116-vyzkum-po-134, 1116-vyzkum-poznamka-kratsi, 1116-vyzkum-app-data-part-notes · research:7a4b3e5c src/commands/sync.ts asksPerson (otázka ≠ změna), ui.sync.title.asks / title.both / done.asks / done.asked, ui.sync.waiting; src/core/sync.ts planSync waiting (shorterWaiting) -->

<a id="S2.4"></a>
## S2.4 A Strom archive and a research without an agent

A Strom archive and a research waiting for its agent mirror the tree from the app: the word from the app holds. They
write every send at once, even when `sync.review` is on.

- **Limits:**
  - A change of a fact proven by a record does not create a conflict; the fact from the record is withdrawn with a
    reason. A conflict of parents and a conflict of a removed person arise here too
    ([R5.2.1](R5-conflicts.md#R5.2.1)).
  - What is deleted in the app, the research sets aside with a reason, and it can be restored.
  - What the Strom archive has and this window of the app never had, the archive does not delete. The app says so at
    the unwritten edits: **the Strom archive still keeps it: this window never had these details**.
  - Tasks to verify a transcription from the app do not arise here, because nobody reads
    ([R3.5.1](R3-verification-and-citation.md#R3.5.1)).
- **Since:** research 1.12.0

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :2283-2287 mirror = actsAsArchive, gone :2355 · app:strings.ts treeSettings.effectArchive, sync.notWrittenKept, sync.archiveBridgeDownSub · spec 002 -->

<a id="S2.5"></a>
## S2.5 What the research does not accept

The research can refuse a send as a whole, or write only a part. Edits it did not write stay in the app and nothing is
lost.

| When | What the app says |
|---|---|
| the tree is larger than 200 MB | the tree is too large to send this way; it can be exported as GEDCOM and loaded in the research |
| the tree belongs to another research | this tree belongs to another research |
| the tree does not look like this research's family tree | it can be exported and loaded in the research as another family tree |
| the tree arrived empty or unreadable | the tree arrived empty or unreadable |
| the research is taking the tree in right now | the research is taking this tree in right now |
| the copy of the tree does not have the research's numbers of people yet | **Not sent.** The research's version has to be loaded first (**Load the research's version**) |

- **Limits:**
  - The research postpones writing when the tree is sealed on another computer (**Take over on this computer**), when
    the files in a cloud folder are not downloaded yet, or when the disk is full. Until then the edits wait unsent.
  - When the research writes only a part, the app shows **Written N, not written M** and the reason at each
    unwritten edit (for example "no common ground: choose in the research").
  - After a refusal, automatic sending stops. It sends again by itself only after the next edit.
- **Controls:** app: **The research didn't accept the changes** in the research panel, **Try again**, **Details (to
  pass on)**
- **Since:** app 3.11.0 (research 1.12.0); postponed writing from research 1.20.0
- **From research 1.26.0:** a large family tree (roughly 1,500 people and more) taken over on Windows is written
  whole. Before, it ended with a git error about a command too long (ENAMETOOLONG) and nothing was written.
- **From research 1.34.0:** the research also refuses a small other tree sent under its connection (the sample tree,
  for example) in which fewer than half of the people of the research's family tree remain: of the people sent,
  fewer than 10 % have a research number (with 10 or more sent) or none has (with 5 or more). Nothing is written
  and the edits stay in the app. If it is meant, the terminal takes such a file: `strom sync <file> --force`.

<!-- zdroj: research:src/core/sync.ts (v1.25.2) SYNC_MAX_BYTES :1325, tree.empty :1218, tree.other-research :2038, tree.foreign :2068, tree.no-ids :2345 · src/core/live.ts seal.foreign, tree.not-downloaded, disk.full · app:src/research-write-held.ts · strings.ts sync.refusedCodes, sync.refusedDetails, sync.noIdsToast, sync.held, sync.writtenCount, sync.notWrittenPick, sync.rejectedAutoSub · 1.26.0: research:src/core/git.ts commitAll po částech (commit 0e7238fc) · 1.34.0: research:4a5887dc src/core/sync.ts planSync (jiný strom: poslaných ≥ 10 a s id výzkumu < 10 %, nebo ≥ 5 a žádná; kept < given/2, strangers > 0; --force) · CHANGELOG.cs.md 1.34.0 „Jiný rodokmen pod jménem výzkumu“ · prace/1115-vyzkum-cizi-strom -->

<a id="S2.5.1"></a>
### S2.5.1 Changes not taken, by name

A research that sends the reason for each change not taken as a code gets, in the app, a line of its own at each
such change, with the reason in the app's words.

- **Message:** when the research took nothing from a send but named the changes: “The research did not take
  3 changes. They stay here in the app.” with **Show**. The send's section in the research panel has the heading
  “The research did not take 3 changes”. Such a send never says “nothing new”.
- **List:** **What was written** ([S2.2.1](#S2.2.1)) has at each change not taken a line person · fact · source (the
  person and the source can be opened, what is not known is left out; “Change” when neither the person nor the source
  is known) and the reason:

| When | What the app says |
|---|---|
| an older app that does not send removals of citations | citation kept in the research: this version of the app does not send removals yet |
| the whole source is missing in the file | the source stays in the research with its citations; a source is deleted in the research |
| the source disappeared from a whole person or family | citations of a person, a name or a family are not removed from the app |
| a main citation at a citation the research did not add | main citation not set: the research did not take this citation |
| the fact did not match | the research did not find this fact (its date or type changed) |
| the research has taken the fact back since | the research has since withdrawn this fact; it will not come back to the app |
| a person, fact, name, child or partner is missing in the file | missing in the file; the research deletes nothing, it only notes it |
| a conflict already waits on the same thing | an open conflict on this is already waiting |
| a later send from another window | a later send from another window changed the fact; this copy is older |
| a confirmation of a fact the research changed meanwhile | confirmation not taken: the research changed the fact meanwhile |
| a child's relationship by a word the research does not know | child's relationship: the research does not know this word |
| a surname group the research changed meanwhile | the research keeps its surname group (it changed it meanwhile) |
| a surname group with a warning | surname group: only with a warning in the research |
| a value from an import or from the user that the agent only proposes | a value from an import or the user: the research only proposes it |
| the person did not match | the research did not match the person |
| an entry the research wanted to make and that failed | writing in the research failed |
| a code the app does not know | not taken |

- Changes the research wanted to write and that failed are in the same list, not in a message of their own. Reasons
  the app gave before (waits for a choice, the archive keeps it, person removed, taken back) keep their existing
  words.
- **A fact the research has taken back since** (`strom event retract`, [R3.1](R3-verification-and-citation.md#R3.1))
  the version the app's file builds on: a removed citation, a main citation, a new citation, a note, a detail or
  a confirmation of such a fact is not written, and each has a line in the list with this reason. The citations of
  the fact taken back stay in the research. The terminal says at `strom sync`: "not written: the research has taken
  this fact back since (nothing of it comes back to the app)".
- The line of a new citation the research did not take names every cited source the tree has, a source new in the
  app too.
- A later state of the research fills in the same list without a message.
- **Limits:** a research without codes behaves as before: a send it took nothing from reports “The research took
  nothing new from this send.” The reasons at citations (the first three rows of the table) the research sends only
  to an app that reads the main citation; an older app does not get them.
- **Since:** app 3.29.0 with research 1.34.0

<!-- zdroj: app:1e10a1dd src/ui/research-sync-ui.ts:1985-2005 (SYNC_NW_CODES_FEATURE, notTakenToast, nothingTakenToast), :2849 notTakenTitle · src/ui/research-changes-ui.ts nwReason, NW_TODAY_WHY · strings.ts sync.notTakenToast, notTakenTitle, nw.*, nwUnknown, nothingTakenToast · research:355df0a5 src/core/sync.ts notWritten codes, skipped codes, /status sends[].notWritten (nejvýš 50) · ZADANI_VYZKUM_hlavni-citace.md V4, V5 · spec 095 K3.4 · event.retracted: app:bcf456ee strings.ts sync.nw.event.retracted (notWritten i skipped), src/ui/research-changes-ui.ts nwRowParts more (cites) · research:4a5887dc src/core/sync.ts retractedDiff (code event.retracted: fact.uncite, fact.main, fact.cite s cites, fact.note, fact.detail, fact.confirm), cli/ui.ts + cs/de/pl.json ui.sync.do.event.retracted · prace/1115-vyzkum-095-retract -->

<a id="S2.6"></a>
## S2.6 A person removed in the app

A research with an agent does not delete by itself a person or a fact that disappeared in the app. It only notes the
removal, and the app says at the unwritten edits: "removed here only: the research noted the removal but deletes
nothing by itself; it can be deleted in the research". A Strom archive mirrors the removal ([S2.4](#S2.4)).

- **Limits:** when one window of the app removes a person and the person is edited elsewhere meanwhile, the research
  asks whether the person stays in the tree ([R5.2](R5-conflicts.md#R5.2), point 6). The app shows one question per
  person:
  - **Removed in another window:** **Return to the tree**, or **Keep removed**;
  - **Edited elsewhere:** **Remove from the tree**, or **Keep in the tree**.
  The research confirms the decision. Then the app loads its version.
- **Since:** research 1.0.0; the question about a removed person from app 3.16.0 (research 1.20.0)
- **From app 3.32.0:** the same holds for the people of an undone merge of trees
  ([A8.12](A8-merging-trees.md#A8.12)). A merge not yet sent to the research is undone only in the app, and the
  research gets nothing. A merge already sent the app undoes at once and says that the research does not delete the
  people by itself; when it knows the research's entry the merge brought, it gives a step in the research's terminal
  `strom sync undo I…` with **Copy**, otherwise it points here. Until then the research brings the people back with
  its next version and the app offers them for removal ([A8.13](A8-merging-trees.md#A8.13)).

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :1-19 „What the app no longer has is only reported“, gone :2355 · app:src/ui/research-removed-ui.ts :1-14 · strings.ts sync.notWrittenReport, conflict.person.* · CHANGELOG.cs.md 3.16.0 · 3.32.0: app:debf50cc src/ui/merge-history-ui.ts (resSent, resUndoStep / resUndoHelp), undoResearchStep (jen záznam I\d+), src/help/topics.ts:38 HELP_LINKS.mergeUndoResearch = 'S2.6' · strings.ts mergeWizard.resSent, resUndoStep, resUndoHelp, resUndoHelpLink, resComesBack, copy · research:src/commands/sync.ts:627 sync undo · spec 134 K9.3 -->

<a id="S2.6.1"></a>
### S2.6.1 A source deleted in the app

A source that a person deletes in the app in a tree from the research that the app edits (not follows) is retracted by
the research with the next write of changes ([R3.10](R3-verification-and-citation.md#R3.10)): the citations are kept
in the source and `strom source restore` brings it back. A followed tree deletes the source straight in the research
([A3.1.2](A3-evidence-in-the-app.md#A3.1.2)).

- **What the app shows on deleting:**
  - a research that can delete sources, with the bridge running: the dialog **Delete source?** with a preview from
    the research as in a followed tree. The source is deleted only in the app and can be brought back with **Undo**;
  - a research that can do it, without the bridge: the previous confirmation and the sentence "The research retracts
    the source with the next write of changes.";
  - a research that cannot do it: the previous confirmation and the sentence "The research keeps the source; it comes
    back with the next load.";
  - when the app does not know the research, the previous confirmation.
- The file for the research names the deleted sources: only sources of the research that are missing from the file,
  at most 50. A source brought back with **Undo** is not named.
- **Enforced by the code:** the research retracts the source only when:
  - the write was started by a person, not an agent;
  - the file is the whole tree the research gave the app, and it carries the research state it came from;
  - nobody cites the source in the file;
  - the research has the source and has not retracted it yet.

  Otherwise it deletes nothing. A deleted source no longer comes back with a later file from the app or an import.
- **Changes** and **What was written:**
  - the line **Deleted source**; when the send waits in the research for confirmation, with the note "waiting in the
    research for confirmation";
  - a deletion not taken, with the reason: "source not retracted: the file is only part of the tree", "… it is still
    cited in the tree", "… it is not in the research", "… it is already retracted", "… the file does not carry the
    research state it came from", "… the write was not started by a person";
  - a citation of a source the research has already retracted is not written ("the source is retracted in the
    research; a citation of it is not written"). Such a line has **Restore the source in the research** (through the
    bridge), without the bridge the sentence "the source can be restored in the research".
- **Controls:** app: **Sources** → the bin at the source, then **Send** ([S2.2](#S2.2)).
- **Since:** app 3.31.0 with research 1.36.0

<!-- zdroj: app:810319cb src/source-retract.ts sourceRetractEditModeIn (preview / plain / old / unknown), ResearchLink.deletedSources, deletedSourcesToSend (_STROM_SOURCE_DELETED, jen chybějící, max 50, zapomene se po Zpět a po odvolání) · src/ui/research-changes-ui.ts (sourceDeleted, reviewWait při sent.state pending, nwSourceRow, restoreTail now/later) · strings.ts sources.retract.editMode, editModeOld, changes.sourceDeleted, reviewWait, restoreSource, restoreLater, sync.notWritten source.retract-skipped:*, source.retracted · research:e6bbfb40 src/core/sync.ts sourcesDeleted, plan source.retract (notPerson, noHead, partial, stillCited, unknown, retracted), withholdDeleted (spec 117 J6) · SPEC.md 1120-app-117-smazani · spec 117 K1.4, §4 -->

<a id="S2.7"></a>
## S2.7 Undoing a send

A send can be undone in the research. The edits in the app stay; only the changes of that send leave the research.

- **Limits:**
  - From the app the last send can be undone within 7 days. It is confirmed in the research's terminal.
  - After an undo the app sends nothing more until one is chosen: **Send again**, or keep the undo with **Load the
    research's version** (replaces the edits from the app, a backup stays).
  - Loading the research's version can be undone with **Restore the state before loading**.
- **Controls:** app: **Research → Other actions → Undo last send** · terminal: `strom sync undo`
- **Since:** app 3.4.0, research 1.0.0
- **From research 1.26.0:** only a person may undo a send (`strom sync undo`) and discard a sent tree that waits
  (`strom sync discard`); the research refuses the agent. The edits in the app stay after discarding and can be sent
  again.
- **From app 3.29.0:** a send taken back that did not carry this tree's people (the research's record of the send
  names another tree of the app, or the version sent hardly names its people) is neither offered nor sent again.
  The research panel says "That send did not carry this tree's people, so it is not sent again. Loading the
  research's version keeps the undo." and its main action is **Load the research's version**. Where the app
  cannot tell, the choice stays as before.

<!-- zdroj: app:src/ui/research-actions-ui.ts (v3.21.2) :448 researchActionUndoSend, UNDO_MAX_AGE_MS :152 · src/research-link.ts:73 sync-undo terminal · strings.ts research.undoSend, sync.undoneSub, sync.sendAgain, sync.loadVersion, sync.againNothing, sync.restoreBeforeLoad · research:src/core/sync.ts :19 strom sync undo · 1.26.0: src/commands/sync.ts:503 sync discard (person), sync undo (person) (commit 942c56f9) · 3.29.0: app:bbcc2b17 src/ui/research-changes-ui.ts researchUndoneForeign (záznam poslání jmenuje jiný strom aplikace, nebo uložená verze poslání skoro nejmenuje osoby druhé uložené verze), strings.ts sync.undoneForeignSub -->

<a id="S2.7.1"></a>
### S2.7.1 Load the research version?

Before the research's version replaces the tree in the app, the app asks **Load the research version?** and shows
what changes or goes in the app.

- **List:** a row for each value: person · fact · **here → from research**. The first 8 rows, the others under "and
  N more". Below the list, what the research adds ("Added from the research: + 2 people, 3 facts"), and "A backup is
  saved before loading; it can be restored."
- **A note line by line:** when both versions have a note, the lines they share stay plain, removed lines are struck
  through and added or changed lines are marked (a changed line: the old one struck through, then the new one).
  A paragraph the research only added strikes nothing through. Spaces at the end of a line and Windows line ends
  are no change. A note on one side only keeps **here → from research**. The same data is loaded as before.
- **An image number or folio added:** a source to whose place the research's version only adds an image number or a
  folio (missing here, the location otherwise the same) gives no row at any of its citations. Below the list there is
  only the sentence "Image number added in 3 sources." (for a folio "Folio added in 3 sources."), and it does not count
  as a change. A changed location, a changed image number and its removal still give a row.
- **Limits:** for a tree that only loads from the research ([S2.2](#S2.2)), and when something of the last send was
  not written, the dialog says that loading overwrites those edits; the buttons are **Load and overwrite** and
  **Open as copy**.
- **Controls:** app: **Load the research's version**
- **Since:** app 3.9.0; a note line by line from 3.29.0; an image number or folio added from 3.31.0
- **From app 3.32.0:** a person's census that the research wrote as a custom event "Census" (with research
  1.37.0 it comes as a census, [R9.12.3](R9-archives.md#R9.12.3)) is read as a census the tree has
  ([A10.7](A10-shared-events.md#A10.7)). The list no longer shows it struck through, and the same version loads
  without the question.

<!-- zdroj: app:src/ui/research-load-ui.ts askResearchLoad (ROWS_SHOWN 8, overwrite: sendMode off nebo nezapsané z posledního poslání → loadOverwrite + research.openCopy), src/ui/research-ui.ts:2377 · 03352a9c src/line-diff.ts diffLines (LCS po řádcích, mezery na konci a CRLF nejsou změna), research-load-ui.ts notes · strings.ts sync.loadTitle, loadColChange, loadMore, loadAdded, loadBackupNote, loadOverwrite, loadOverNotWritten · CHANGELOG.cs.md 3.29.0 „Načíst verzi výzkumu?“ · v3.9.0 (loadColChange) · 3.31.0: app:2e68d373 src/research-changes.ts placeNumberAdded, pageMoved, diffValues numbersAdded; src/ui/research-load-ui.ts (věta pod seznamem, nepočítá se); strings.ts sync.loadImageNumbers, loadFolioNumbers · CHANGELOG.cs.md 3.31.0 „Načtení verze výzkumu“ · 3.32.0: app:1319a508 src/ged-parser.ts (EVEN / TYPE Sčítání lidu → census), src/research-changes.ts pairEvents · dirigent:K052 -->
