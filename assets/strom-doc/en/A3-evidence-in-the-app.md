<a id="A3"></a>
# A3 Evidence in the app

How the app records sources, cites them, adds excerpts and files, and where the app itself shows what is missing.
Describes the Strom app 3.21.2 (and the research 1.25.2); changes from a later version carry its number. How certain a
fact is and how the evidence of a person is counted is described in [R3.8](R3-verification-and-citation.md#R3.8);
the import of sources from GEDCOM is in [A2](A2-loading-a-family-tree.md).

<a id="A3.1"></a>
## A3.1 A source is one entry

A source is one particular entry: a baptism, a marriage, a death. A tree has one list of sources. People and facts
only refer to it, so one entry can support several people and several facts.

- Fields: **Title** (required), **Archive**, **Call number**, **Folio/page**, **Image**, **Other location**, **URL**,
  **Note**. Where the entry stands in the book is described in [A3.9](#A3.9). Under **More: transcript, record date,
  reliability** are **Transcript of the entry**, **Record date** and **Source reliability**. The section is open when one of
  them is filled in.
- **Record date** says when the entry was made. It can differ from the date of the event, e.g. a baptism recorded
  later.
- **Source reliability** has three levels: **Original**, **Copy / index**, **Uncertain**. A second click on the
  chosen level cancels it. How the research takes it is described in
  [R3.2.1](R3-verification-and-citation.md#R3.2.1).
- **Limits:** a source without a title cannot be saved ("Enter a source title"). An invalid **Record date** is not
  saved. The reliability value 0 from a GEDCOM import is shown as **Uncertain** and stays until another level is
  chosen. Deleting a source removes all its citations; the app asks first and says in how many places it is cited.
- **Controls:** **Actions → Sources** (the tree's list of sources with the number of citations "n×", search from 11
  sources, sorting by title); **Edit source**, **Add source**. The item **Sources** in the **Actions** menu is only in
  a tree that can be edited, and only when some source already exists or **Settings → Person card → Advanced fields**
  is on.
- **Since:** app 1.4.0; **Source reliability** and **Record date** 3.1.0; **Call number**, **Folio/page**, **Image** and
  **Other location** 3.27.0 (before, **Repository** and **Reference**)
- **From app 3.27.0:** **Source reliability** is the default reliability of its citations. A citation that has its
  own reliability (from a GEDCOM import, [A2.6.1](A2-loading-a-family-tree.md#A2.6.1)) keeps it even when the
  default changes; the other citations follow the change. A fact shows the reliability of its citation ([A3.6](#A3.6),
  [S7.1](S7-reliability-and-verification.md#S7.1)). Before, the reliability rated only the whole source.

<!-- zdroj: app:src/types.ts Source · od 3.27.0: app:9732853b strings.ts sources.fieldRepository/fieldCallNumber/fieldFolio/fieldImage/fieldReference · src/ui/sources.ts:214 renderSourcesList, :327 deleteSource, :531 fillSourceEditor, :576 wireSourceEditor, :667 renderQualityControl, :733 saveSourceFromModal · src/ui/tree-management.ts:675 isSourcesMenuOffered · src/settings.ts:320 isAdvancedFields · strings.ts sources.titleHint/fieldTitle/fieldRepository/fieldReference/fieldUrl/fieldNote/more/fieldTranscript/fieldRecordDate/recordDateHint/reliabilityLabel (index.html source-quality-label)/quality1-3/titleRequired/citations/deleteConfirm, advanced.settingLabel · 3.27.0 výchozí spolehlivost: app:dde0151a src/citation-quality.ts setCitationQuality, citation-quality-shown.test.ts (formulář = výchozí) -->

<a id="A3.1.1"></a>
### A3.1.1 Transcript and Transcription verified

**Transcript of the entry** is the text of the entry as the user read it. In a tree connected to the research, the
setting **My source transcriptions** decides how the research takes it
([R3.5.1](R3-verification-and-citation.md#R3.5.1)). The editor accordingly shows one of three things:

- the checkbox **Transcription verified**: with the setting **Lead** always; with **Evidence** only for a source sent
  before the switch and not changed since, or for a source that is already ticked;
- the line "Counts as the first reading (tree set to Evidence)": with **Evidence** and a new or changed source;
- nothing: a tree without the research, a source without a transcript, or a transcript the research read itself.
- For a transcript the research read, the editor warns: a correction is saved as the user's reading and the research
  compares it with the image. In the source viewer, under the transcript, is "Transcription read in the app / by the
  research / in the app and by the research".
- **Limits:** ticking changes nothing about the level of certainty in the app; the research decides. When the
  checkbox is not shown, **Transcription verified** stays only if the transcript has not changed.
- **Controls:** the source editor, **More: transcript, record date, reliability**; in **Actions → Sources** the
  filter **Transcription not verified** (only in a tree set to **Evidence** with older unverified sources).
- **Since:** app 3.9.0
- **From app 3.24.0:** a translation of the transcription sent by the research
  ([R3.4](R3-verification-and-citation.md#R3.4)) is under the transcription as a folded section **Translation of the
  transcript**: in the source viewer and on the source card on a person's page. The note of the source does not
  change; the note editor shows it whole. A source without a translation looks as before.
- **From app 3.25.0:** a transcript only the research read can be confirmed in the source viewer without changing the
  text ([A3.1.3](#A3.1.3)).

<!-- zdroj: app:src/research-sync.ts:357 researchReadSource, :365 isOlderSource, :377 verifiedOffer, :385 unverifiedOlderSources · src/ui/sources.ts:618 renderSourceReading, :658 sourceVerifiedValue, :296 renderSourcesFilter, :377 renderSourceViewer · strings.ts sources.verified/verifiedHintGuide/verifiedHintOlder/verifiedByTree/readBy/userReadingNote/filterUnverified · překlad (od 3.24.0): src/source-translation.ts SOURCE_TRANSLATION_LABELS, splitSourceTranslation · strings.ts viewerTranslation, translation · commit c2942b0 -->

<a id="A3.1.2"></a>
### A3.1.2 Delete source in a followed tree

In a tree the app follows live from the research, a source can be deleted directly in the research. The research
retracts the source ([R3.10](R3-verification-and-citation.md#R3.10)): its citations leave the facts and stories, the
dates, places, names and the text of stories do not change, and the deletion can be undone.

- The window **Sources** is read-only in a followed tree: no editing and no adding, the row of a source has only a
  bin. When the research does not answer, the bin is inactive and on hover says "Deleting a source works while the
  research runs." On a touch device the row has **⋯** instead of the bin, with a sheet from the bottom: **Open
  source** and **Delete source…**.
- The dialog **Delete source?** first checks in the research what rests on the source ("Checking in the research
  what refers to the source…"), and only then allows deleting. Under the heading **What rests on the source** it
  says how many citations on facts and how many stories cite the source, and by rows:
  - **Facts** and **Without a source**: which facts are left without a source ("The facts stay, only without a
    citation.") and which also have another source;
  - **Less certain**: how many facts become less certain;
  - **Stories**: "The story text stays; the source only leaves the story’s list of sources." The source's code in
    the text stays, only no longer as a link;
  - **Conflicts**: a conflict stays and is marked "source retracted – to review"
    ([S3.4.1](S3-what-the-research-knows.md#S3.4.1)); a decided one shows "the decision stays". A conflict does not
    close by itself;
  - **Tasks** (open, in progress, parked, waiting): a task only on this source ends as given up, from another task
    the source leaves the task's places; it also says when an agent is working on the task right now. **Undo**
    returns the tasks to their current state;
  - **Files**: a file stays in Materials, only without the link to the source; archive images stay with the source.
    When the source was made from a family tree file, the dialog says so; the file itself can be deleted in
    Materials ([A3.5.17](#A3.5.17)).

  A source nothing cites has only "Nothing cites the source."
- After **Delete source** the notice says "Source … deleted in the research." with **Undo**. **Undo** returns the
  source with its citations; a citation whose fact has changed meanwhile cannot be returned, and the notice says how
  many. Later the source can be restored in the research (`strom source restore`).
- **Enforced by the code:**
  - the deletion holds only for the list the dialog showed, and for at most 15 minutes. When the list has changed
    meanwhile or the confirmation has expired, the dialog shows the new list and the deletion must be confirmed
    again;
  - when the research is writing right now, the deletion is tried again in a moment. For a source that is no longer
    in the research, the tree is loaded again; a source already retracted is reported by the dialog;
  - a read-only research (sealed on another computer) does not offer the deletion.
- **Limits:**
  - only in a followed tree of a research that can delete a source, and only for a source from the research; not in
    a copy of the tree. Deleting while editing a tree from the research is described in
    [S2.6.1](S2-edits-from-the-app.md#S2.6.1);
  - **Undo** needs a running research; otherwise the notice says that the source can be restored in the research.
    A source merged or retracted otherwise in the research cannot be restored.
- **Controls:** app: **Actions → Sources** → the bin (on touch **⋯** → **Delete source…**) → **Delete source**;
  the notice → **Undo**. In a followed tree the item **Sources** is in the menu only when the deletion can be
  offered.
- **Since:** app 3.31.0 with research 1.36.0

<!-- zdroj: app:d527ffdd src/source-retract.ts sourceRetractOfferedIn (null bez sledování, jen ke čtení, kopie link.copy, bez brány source.retract; off když most neodpovídá), RETRACT stavy · 9d91f035, 4178ef85 src/ui/sources.ts sourcesReadOnly, openSourceRowSheet, source-retract-ui.ts (dialog, toast Vrátit, /source/restore) · src/ui/tree-management.ts isSourcesMenuOffered (zamčený strom jen se sourceRetractOffered) · strings.ts sources.retract.* (trashOff, rowMenu, menuDelete, menuOpen, title, intro, loading, usesTitle, counts, rows, bare, hasOther, lowered, storyKeep, storyCode, conflictReview, conflictDecided, conflictNever, taskState, taskDropped, taskNarrowed, taskDoing, tasksBack, filesStay, images, fileTree, undoLater, noCites, go, changed, expired, busyWait, gone, already, readonly, toast, undo, restored, restoredPart, restoreDown, notRestorable) · SPEC.md 1120-app-117-smazani · research:e6bbfb40 src/core/sourceretract.ts RETRACT_CONFIRM_MS · spec 117 §1–§3, J3 -->

<a id="A3.1.3"></a>
### A3.1.3 Confirm the research's transcription

A transcription only the research read can be confirmed by the user: they read the entry themselves and the
transcription matches. The text does not change; the transcription then also counts as the user's reading
([R3.5.2](R3-verification-and-citation.md#R3.5.2)).

- In the source viewer, at the end of the line "Transcription read by the research", is a small button **Confirm
  transcription** ("The transcription matches the record. It will also count as read in the app."). After
  confirming, the line reads "Transcription read by the research and confirmed in the app on ‹date›" and the button
  is **Undo confirmation** ("The transcription counts again as read by the research only.").
- **Limits:**
  - only for a source with a transcription the research knows and only the research read; a transcription the user
    read in another way cannot be confirmed;
  - only in a tree connected to the research whose bridge takes confirmations; not in a Strom archive, in a research
    waiting for its agent, or in a tree opened read-only;
  - when the research is not running, the button is at rest with the sentence "Confirming is possible while the
    research is running." (for undoing "Undoing the confirmation is possible while the research is running.");
  - the research writes the confirmation, not the app. The answer is shown at once; it comes into the tree with the
    research's next version;
  - the research may refuse and the app says why: the transcription changed meanwhile ("The new wording can be
    confirmed once it arrives."), the source is merged, withdrawn or no longer in the research, or the research was
    last written by a newer version of Strom Research;
  - a confirmation does not change the level of certainty in the app; the research decides.
- **Controls:** app: **Actions → Sources** → a source → **Confirm transcription** / **Undo confirmation**; also in a
  tree the app follows live from the research.
- **Since:** app 3.25.0, research 1.29.0

<!-- zdroj: app:v3.30.0 src/source-confirm.ts (SOURCES_CONFIRM_FEATURE sources.confirm, SOURCE_CONFIRM_TIMEOUT_MS, sourceConfirmAction, sourceConfirmOffer: agentless, readOnly, rest) · src/ui/source-confirm-ui.ts (prohlížeč pramene, odpověď hned, strom až s další verzí výzkumu _STROM_READ/_CONF/_TXT) · strings.ts sources.readConfirmed, sources.confirm.action/actionTitle/undo/undoTitle/restConfirm/restUndo/changed/merged/retracted/reader/none/archive/locked · CHANGELOG.cs.md 3.25.0 · research:src/core/confirm.ts -->

<a id="A3.2"></a>
## A3.2 Citation: what a source supports

A citation says which fact a source supports. A source is cited for a person, for their birth and death, for a single
event of the person, for a marriage and for a couple's shared event. From the citations the app computes the level
of evidence of a person ([R3.8.1](R3-verification-and-citation.md#R3.8.1)).

- When editing a person: the section **Sources** (citations for the person), **+ source** under the birth and death
  fields, citations at each event; for a union **Cite source (marriage record…)**. A citation is a chip with the name
  of the source; a click opens the source viewer, × removes the citation (**Remove citation**), the source stays.
- Outside editing a person (the person menu **Sources**, highlighting [A3.7](#A3.7)) the source picker shows
  **Supports**: **Person** / **Birth** / **Death**. Death only for a person with a death. When the birth has no source
  yet, the picker starts at **Birth**.
- **Limits:** a citation has no level of certainty. A source attached only to the person supports the person, not the
  birth. A read-only tree, a locked tree and a locked person do not allow citing. For a person, the sections of
  sources and attachments are shown when **Advanced fields** is on, or when something is already filled in.
- **Controls:** see above; the source picker is described in [A3.2.1](#A3.2.1).
- **Since:** app 1.4.0; **Supports** and **+ source** 3.5.0

<!-- zdroj: app:src/ui/sources.ts:1220 renderSourceChips, :1288-1306 unciteBirthSource…unciteEventSource, :1331 showSourcePickerForPersonId, :1343 showSourcePickerForFact, :1356 renderSourcePickerFact, :1399 showSourcePickerForPartnership · src/ui/person-sources-ui.ts:114 canCiteOnPerson · src/settings.ts:320 · strings.ts sources.sectionTitle/citeAdd/citePartnership/remove/pickerFactLabel/pickerFactPerson, advanced.settingHint -->

<a id="A3.2.1"></a>
### A3.2.1 Source picker

- **Cite a source** opens the picker. It searches in the title, repository, reference and transcript. Sources already
  cited for the same fact are not offered.
- **Recently used**: up to 5 sources, separately for each tree in this browser. They are shown only when the tree has
  more than 8 sources and the search is empty.
- **New source…** prefills the title according to what is cited: "Birth – Marie Vlková, 1865", "Marriage – Josef
  Horák and Marie Vlková, 1890". The year is left out when it is not known. The new source is cited right away.
- **Another page** at a source in the picker: a new source with the same title, repository, link, reliability and
  note; the page drops out of the reference, and lines with the page and the record date drop out of the note. When
  the title of the register names a person from the tree, a title according to the cited fact is suggested.
- **Another entry from the same register** (source viewer and editor): a new source with the same repository and
  link; the reference without the entry's number and date, that is the register, image and page ("vol. 12, image 5,
  p. 3, entry 2 (3 Apr 1801)" → "vol. 12, image 5, p. 3"). A reference in which the app does not recognise the
  entry's part stays whole and selected for checking. Opened from a citation chip, it is cited right there.
- **Since:** app 3.1.0 (**Recently used**, **Another entry from the same register**); **Another page** 3.9.0;
  3.25.0: **Another entry from the same register** without the entry's number and date
- **From app 3.27.0:** the search also covers the call number, folio and image. At a source with fields ([A3.9](#A3.9))
  **Another entry from the same register** takes over the archive, call number and link; **Folio/page**, **Image**
  and **Other location** stay empty and the cursor stands in **Folio/page**. **Another page** at a source with fields
  also takes over the call number. An older source (the location as one text) behaves as before.

<!-- zdroj: app:src/ui/sources.ts:1427 renderSourcePickerList, :322 sourceMatches, :1475 currentCitationSourceIds, :1505 noteRecentSource, :1526 otherPageFromPicker, :1554 createSourceFromPicker, :1569 suggestedSourceTitle, :1181 startSameBookEntry · src/settings.ts:12 RECENT_SOURCES_MAX · strings.ts sources.pickTitle/searchPlaceholder/recent/all/createNew/newTitleMarriage/otherPage/otherPageTitle/sameBook · 3.25.0: app:7327b758 src/source-page.ts sameBookReference (ENTRY_PART, DATE_PART, whole), src/ui/sources.ts:1217 (nepoznaný tvar označený) · CHANGELOG.cs.md 3.25.0 · dirigent:test/vysledek-1107-nejista-mista.md · 3.27.0: app:9732853b (další zápis s poli, Jiná stránka se signaturou), c3278633 sourcePlaceSearchText -->

<a id="A3.2.2"></a>
### A3.2.2 The order of citations and the main citation

A fact with more than one citation has them in one order everywhere: the chips when editing a person and at a
marriage, the tip at the fact's mark, the person's **Sources**. Where the app takes only one citation, it takes the
first: the extract on the person page, the marriage on the family pages, the source numbers in the family book, the
citation columns in the **Table** ([A6.7](A6-views.md#A6.7)) and the first source at **Verify**
([S7.3](S7-reliability-and-verification.md#S7.3)). The research has the same order
([R3.4.5](R3-verification-and-citation.md#R3.4.5)).

- **Order:**
  1. the main citation the user chose;
  2. the primary record of the event: a source that records this kind of event, with an **Original** citation and
     written at most 12 months from the fact. For a birth and a baptism a birth or baptism record, for a death, a
     burial and a cremation a death or burial record, for a marriage, banns and an engagement a marriage record, for
     a census a census. One written earlier stands before one written later, a source without **Record date** after
     those written with a date. A missing or unreadable date of the fact does not decide;
  3. the other citations with the reliability **Original**;
  4. the others by reliability: **Copy / index**, **Uncertain**, then without reliability;
  5. by the numeric part of the source's number (a source without a number after the numbered ones), finally the
     order in which the citations were added.
- Which events a source records, the app knows from the GEDCOM file (`1 DATA` › `2 EVEN`,
  [A2.6](A2-loading-a-family-tree.md#A2.6)); the research writes it at its sources. A source without it is not a
  primary record.
- **Main citation:** the user can mark one citation of a fact as the main one. It stands first, its chip has ★ before
  the title and a highlighted border, and its button says "main citation". In the tip at the mark it has "★ main",
  in the person's **Sources** and in **Supports** of the source viewer ★ after the fact. A citation that is first only
  by the order has no mark.
- **The bar in the source viewer:** the viewer opened from a citation of a fact (a chip, a row of the tip at the mark,
  a row of the person's **Sources**) shows at the top what the citation supports ("Birth · Marie Vlková") and where
  it stands in the order: "2 of 3 citations"; at the first one also why ("first because: the birth record,
  original", "original", "highest reliability"); "Main citation for the birth"; "The only citation for the birth".
  Below that the buttons **Mark as main** or **Unmark main** and **Remove citation** ([A3.2.3](#A3.2.3)).
- **Limits:**
  - saved lists of citations are not reordered; the order is computed on display and on export;
  - **Mark as main** is only at a fact with 2 or more citations, and only in a tree without the research or with a
    research that holds the main citation (research 1.34.0 and later). Only there is ★ shown as well;
  - a research's tree whose research sets the order of citations itself has the citations in the order of the
    research's file; the main citation stands first;
  - for a locked person and in a read-only tree there are no buttons;
  - marking, changing and unmarking is one **Undo** step ("Main citation for the birth: …", "Main citation for the
    birth unmarked; the order is automatic again"). Removing the main citation or its source, and editing the event
    without it, unmarks it in the same step; **Undo** puts back the place and the ★;
  - a shared event ([A10.1](A10-shared-events.md#A10.1)) has one main citation common to all copies; copies that
    differ in it are copies that differ ([A10.3](A10-shared-events.md#A10.3));
  - a source merged into another carries the mark over to the source it was merged into. Merging trees
    ([A8](A8-merging-trees.md)) keeps the mark of the side that has it; when both have it, that of the kept side.
- **Controls:** the source viewer opened from a citation of a fact → **Mark as main** · **Unmark main**. The
  research's terminal: `strom event main` ([R3.4.5](R3-verification-and-citation.md#R3.4.5)).
- **Since:** app 3.29.0

<!-- zdroj: app:e361220d src/citation-order.ts FACT_RECORDS, recordOfFact, PRIMARY_RECORD_MONTHS 12, orderedCitationSteps (main, primary jen QUAY 3, written, QUAY, number, list), citationMain (jeden krok Zpět, sdílená kopie, remap, merge/executor.ts), data v21 · 9c0ca227 (★ a pořadí: sources.ts chipy, relationships-panel, status-tip „★ hlavní“, person-sources, person-page, family-pages-html, book-blocks, table-sources, verify.ts) · 192d53ec src/citation-bar.ts citeBar, whyFirst, citeMainToast · src/citation-gates.ts citationMainOffered, citationFileOrder, citationMainShown · strings.ts sources.mainMark, citeAt, citePos, citeFirstWhy, whyPrimary, whyOriginal, whyQuality, citeMainAt, citeOnly, setMain, clearMain, mainSetToast, mainClearedToast · spec 095 K1.1, §2 -->

<a id="A3.2.3"></a>
### A3.2.3 Remove citation

**Remove citation** unlinks a source from one fact. The source stays in the tree's **Sources** with its excerpts and
attachments, and the other facts go on citing it.

- **Enforced by the code:**
  - without confirmation, also for the main citation. The bar in the viewer then says "Unlinked from the birth · the
    source stays in the catalog" and the buttons disappear;
  - the toast names the fact and the source: "Citation removed from the birth: … · the source stays", for the main
    citation "…, no longer main: …", for a shared event "… for all N people: …" (it is removed from all copies);
  - one **Undo** step: **Undo** in the toast puts the citation back in its place, with the ★. The toast stands above
    the open viewer too, so **Undo** can be used there;
  - in a research's tree whose research does not take the removal, under the buttons is "The research does not take
    removals yet." and the first removal in the window says "The research will not take this removal; the citation
    comes back when its version is loaded.", the next ones only "not taken by the research". What the research does
    with the removal is described in [S2.3.1](S2-edits-from-the-app.md#S2.3.1).
- **Limits:** for a locked person and in a read-only tree there is no button. A whole source is deleted in
  **Actions → Sources** ([A3.1](#A3.1)).
- **Controls:** the source viewer opened from a citation of a fact → **Remove citation**; × on the citation chip when
  editing a person ([A3.2](#A3.2)).
- **Since:** app 1.4.0 (× on the chip); the bar and the toast 3.29.0

<!-- zdroj: app:192d53ec src/citation-bar.ts citeBar (gone, note = editable && removeNotTaken), unciteToast (unciteWarned jednou na strom v okně), citeBarHtml · src/citation-gates.ts citationRemoveTaken (feature citations.remove) · strings.ts sources.citeGone, uncitedToast, uncitedMainToast, uncitedSharedToast, sourceStays, uncitedNotTaken, uncitedNotTakenShort, unciteNote, undo.uncite · spec 095 §3 -->

<a id="A3.3"></a>
## A3.3 Excerpt of the entry

An excerpt of the entry is an image of exactly that entry, not the whole page. It is shown at the source, in the
viewer and in the book.

- Three ways: **Paste from clipboard** (Ctrl+V, on a Mac ⌘V; the clipping is taken as it is), **Upload image** (opens
  the crop **Crop the entry**) and **Crop from attachment** (the person's image attachments, for a marriage those of
  both partners). An image can also be dragged onto the empty field.
- An excerpt is saved as a JPEG with the longer side at most 1200 px. **Caption (optional)** stays even after
  **Replace**.
- **Also save the whole page as an attachment** in the crop: the whole page is added to the person as an attachment
  ([A3.4](#A3.4)). **Crop** then works again from the whole page.
- Source viewer: excerpts (click to enlarge), **Open the page in the archive** (the excerpt's link, otherwise the
  source's URL), **Transcript**, **Supports** (list of citations); without an excerpt **Add excerpt**. An excerpt made
  by the research has **Full quality**: it opens the excerpt from the original scan in the research.
- **Limits:** the app can add at most two excerpts (the entry and its continuation from the next page). The research
  writes up to three ([R3.4](R3-verification-and-citation.md#R3.4)); the app keeps the third and adds no more. The
  whole page can be saved only for a person, not for a marriage and not for a locked person. Rotating in the crop
  breaks the excerpt's link to the attachment. Images the research did not send to the app are in the filter **Image
  only in the research · N** ([A3.8](#A3.8)).
- **Controls:** the source editor, block **Excerpt of the entry**; **Add continuation from the next page**; **Crop**,
  **Replace**, **Remove excerpt**. "Excerpts: …" in **Actions → Sources** shows the size of all excerpts from 1 MB.
- **Since:** app 3.1.0; **Full quality** 3.4.0; images from the research 3.14.0 ([A3.8](#A3.8))

<!-- zdroj: app:src/types.ts:257 MAX_EXCERPTS_UI · src/excerpts.ts:12-14 EXCERPT_MAX_SIDE, EXCERPT_QUALITY · src/ui/sources.ts:853 renderExcerptBlock, :932 excerptAdderHtml, :999 addExcerptFromPaste, :1017 addExcerptFromUpload, :1047 recropExcerpt, :1099 addExcerptFromAttachment, :1121 putExcerptDraft, :1158 keepPagePersonId, :1165 excerptContextPages, :377 renderSourceViewer · src/ui/research-ui.ts:2263 excerptResearchUrl · strings.ts sources.excerpt*/viewer*/addExcerpt/excerptsTotal, crop.title/keepPage, research.fullQuality/fullQualityTitle, researchImages.filter -->

<a id="A3.4"></a>
## A3.4 Attachments

An attachment is a file at a person: a scan of a page, a document, a photo of a certificate. An attachment by itself
supports nothing; the evidence is the citation of a source ([A3.2](#A3.2)). An excerpt of the entry can be cropped
from an image attachment ([A3.3](#A3.3)).

- JPG and PNG are reduced to a JPEG with the longer side at most 1600 px. A PDF stays as it is, up to 2 MB. The app
  refuses other types ("Unsupported file type. Use JPG, PNG or PDF.").
- An attachment can have a **Note (optional)**. A PDF opens in a new tab.
- Under the attachments is a total: "This person: photo …, n attachments …, n excerpts from sources …".
- **Limits:** in a tree connected to a research that accepts originals, TIFF, HEIC and PDF over 2 MB can be added too.
  The tree then holds only a record without a preview ("the research will make a preview") and only the research gets
  the file. When the research is not running, the app does not accept such a file. Media over 10 MB slow down saving;
  **Tree overview** warns about it.
- **Controls:** editing a person, section **Attachments** → **Add attachment**; the section is shown with **Advanced
  fields** or when the person has attachments.
- **Since:** app 1.4.0; TIFF, HEIC and large PDF for the research 3.9.0
- **From app 3.30.0:** the whole photo the person's portrait is made from is an attachment tagged **Portrait**. It
  is made by itself when a new photo is chosen for the portrait. Another image attachment offers **As portrait…**
  (in the materials and the viewer **Use as portrait…**). Deleting the attachment tagged Portrait leaves the portrait
  ([A12.2](A12-portrait-and-couple-photo.md#A12.2)).
- **From app 3.30.0:** an attachment is a material of the tree ([A3.5](#A3.5)). The same file at several people is one
  file; added a second time it offers **Link here too** ([A3.5.4](#A3.5.4)). The bin at an attachment removes it only
  from this person, with **Undo**; the last place asks like **Remove from the tree…** ([A3.5.6](#A3.5.6)). On a wider
  screen the actions of an attachment are in the menu ⋯.

<!-- zdroj: app:src/attachments.ts:12-18 ATTACHMENT_MAX_SIDE, ATTACHMENT_QUALITY, MAX_PDF_BYTES, ATTACHMENT_WARN_BYTES · src/ui/attachments-ui.ts:28-31 ORIGINAL_ONLY_TYPES/needsOriginalOnly, :161 accept, :211 addAttachmentFile · strings.ts attachments.*, media.originalOnlyMeta/originalOnlyNeedsResearch, treeOverview.mediaWarning · 3.30.0: app:e6f0595d attachments-ui.ts štítek Portrét, asPortrait, danger.portraitSourceNote · 3.30.0 příloha jako materiál: app:2b66d7cf (verze dat 24), a275d977 (Soubor už ve stromu je), 13e4a70c src/ui/attachments-ui.ts removeAttachmentFromPerson, 30b0accd (akce v ⋯) -->

<a id="A3.4.1"></a>
### A3.4.1 Originals for the research

In a tree connected to the research, the app keeps a fingerprint of the original of every image and PDF before it
reduces the file. It sends the full-quality original to the research; the tree keeps a preview. The research stores it
at the person, and where it applies at the source and the place of the excerpt.

- State at an attachment: "Original waiting to be sent to the research", "The original is in the research", "preview
  only" with a reason, "The original is no longer in the research".
- When the research is not running, originals wait in this browser, at most 2 GB and at most 30 % of the browser's
  space. They are not in the tree, in backups or in an export. The app warns when they have waited 3 days or when the
  space is nearly full.
- **Full quality** at an attachment opens the original right in the app when the research is running and the file is
  a JPEG, PNG, WebP or PDF up to 50 MB; otherwise in the research.
- Deleting an attachment with a waiting original: the original can be discarded or sent; the research then detaches it
  with the note "removed in the app".
- **Limits:** only on a computer and only with a research that accepts originals. An encrypted tree does not let an
  original wait in the browser: it sends it straight to the running research, otherwise only the preview stays. Safari
  does not send originals.
- **Controls:** **Research for this tree → Send original files** (turned off: previews only); **Settings → Data and
  privacy → Originals waiting for the research** (only when something is waiting; discard one by one or all). Sending
  in more detail in [S2](S2-edits-from-the-app.md).
- **Since:** app 3.9.0

<!-- zdroj: app:src/originals.ts:19-21 ORIGINALS_MAX_BYTES, ORIGINALS_QUOTA_SHARE, :60 originalsBudget · src/ui/originals-ui.ts:68 FULL_QUALITY_MAX_BYTES, :231 researchOriginalsLink, :241 prepareOriginal, :261 queueOriginal, :320 researchMediaAccepts, :358 fullQualityMode, :479 originalsQueueWarn · src/ui/research-tree-settings-ui.ts:232, :386 sendMedia · strings.ts media.*, mediaQueue.*, researchTree.originals/originalsDesc, research.fullQualityAppTitle -->

<a id="A3.5"></a>
## A3.5 Materials

A material is any file of the tree: a scan, a photo, a letter, a record. The same file is in the tree once, even
when it is at several people, and it carries its places: people, a fact or event, a union, a source. Every tree has
the window **Materials**. In a tree with a research or the Strom archive it also shows the research's files that are
nowhere in the tree (**only in the archive**).

- A material of the tree is an attachment of a person ([A3.4](#A3.4)), the whole photo of a portrait and a couple's
  photo ([A12](A12-portrait-and-couple-photo.md)), a file at an event or a union, and the evidence of a source
  ([A3.5.5](#A3.5.5)). Where a file is stored is described in [S8](S8-where-the-data-are.md).
- Files can also be sent to the research without adding them to the tree: **Send material…** at a person and **Send
  material for this source…** (source viewer and editor), at most 20 files at once, with **Note for the research**.
  The research makes a task for the agent from them ([R11.1](R11-material-from-the-user.md#R11.1)). **Also add as an
  attachment in the tree** puts a preview into the tree too. A whole folder is sent by **Add materials…** in the
  research menu ([R11.4](R11-material-from-the-user.md#R11.4)) and in the header of the window **Materials**
  ([A3.5.15](#A3.5.15)). With the Strom archive it is **Add material…** and **Also save to the tree** (images and
  PDF up to 2 MB). A scan with several people can be sent for a whole list of people ([A3.5.18](#A3.5.18)).
- When the research is not running, the sent files wait in the browser. When the research does not know the person
  yet, they are sent after the next sending of the tree.
- **Limits:**
  - material can be sent only on a computer, in a tree connected to a research that accepts originals. The research
    never accepts programs, keys, archives or family tree files (GEDCOM);
  - the research's files outside the tree are shown only in the app on a computer ("Materials from the research are
    shown in the app on the computer."); on a phone the window shows the tree's files;
  - in a read-only tree the files can be viewed and downloaded, not changed;
  - a research older than 1.35.0 cannot give titles, links, uses or sorting to files outside the tree; the app says so
    at the action ("A newer version of the research can …").
- **Controls:** a tree without a research: **Actions › Materials** (with the number of files); a tree with a
  research: **Materials** in the research menu. At a person: **All materials of this person (N) ›** under the
  attachments and **Materials** in the person menu (the window filtered to the person).
- **Since:** app 3.9.0; the section and window **Materials** 3.16.0; 3.30.0: the window in every tree, a file of the
  tree as one material with its places (data version 24)
- **From app 3.31.0 with research 1.36.0:** the research goes through the files by itself only with the setting
  **The agent goes through files sent to the research by itself** switched on
  ([S4.4.11](S4-research-from-the-app.md#S4.4.11), [R11.6](R11-material-from-the-user.md#R11.6)). Off (the default):
  - **Send material…** says "Nothing is added to the tree. The research stores the files with the person. They wait
    in Materials; the agent goes through them only on request." (at a source "… with the source."). After sending,
    the message "Sent to the research: 1 file for Jan Horák. It waits in Materials, not sorted yet." with **Sort with
    the agent…** (on a computer with the window **Materials**, [A3.5.8](#A3.5.8)) and **Show**;
  - the confirmation of a batch **Add materials…** has no blocks **Privacy** and **Estimated cost**, only "The files
    are stored in the research, outside git, and wait in Materials unsorted. The agent sorts them only on request;
    the cost is shown before that.";
  - the end of the batch says "The files wait in Materials, not sorted yet. The agent sorts them only on request."
    and offers **Sort with the agent…** for the batch's files; when that cannot be done at once, it points to **Sort
    with the agent…** in Materials. On: "The research sorts the batch by itself. …" with the count **Sorting tasks**;
  - a file the agent has not gone through yet has the state **not sorted** in Materials (on: **waiting to be
    processed**).

  With an older research the earlier texts apply.

<!-- zdroj: dirigent:spec/102-sprava-materialu-a-pramenu · app:2b66d7cf src/types.ts STROM_DATA_VERSION 24, Attachment.places (MediaPlace), migrace v23→v24 (stejný soubor u více osob jeden záznam) · src/media.ts allMedia, treeMedia · app:1ebf7896 src/ui/materials-ui.ts materialsWindowOn, materialsListOn · src/ui/tree-management.ts (Akce › Materiály) · src/ui/research-actions-ui.ts:373 · src/ui/attachments-ui.ts attachments-all-materials · app:a275d977 menu osoby Materiály · src/ui/material-ui.ts MATERIAL_MAX_FILES, MATERIAL_NOTE_MAX, REFUSED_EXT, materialAvailable · strings.ts material.*, materials.desktopOnlyResearch, treeReadOnly, olderEdit, assignNewer, agentSort.older · app:CHANGELOG.cs.md 3.30.0 -->

<a id="A3.5.1"></a>
### A3.5.1 The window Materials

The window shows every file once: the tree's files with all the people they are at and, beside an archive, the
research's files too.

- **Group:** **By date added** (with the people the file was added at) or **By person**; a file only at a source or
  a union is under **No person**. Beside an archive also **Batches** and **By date received**.
- **View** **Grid** or **List**. The list has the columns **Title**, **Type**, **Date**, **People**, **Source**, **In
  the tree** and **Used**; it is sorted by a click on the header. A tile shows in how many places the file is used.
- **Search title, name and note**; **Filters** by person, kind and batch. The research's hidden files are shown by
  **Show hidden**.
- ⓘ at the window's title (**Where the files are**) says where the files are: "The files are only in this browser.
  Backup: Export all.", or in the research or the Strom archive on this computer with reduced copies in the app; for
  an encrypted tree also that the research on disk is not encrypted.
- A person without a name or recorded as "?" is **Unknown person** (with the years, when there are any).
- **Limits:** on a phone the window is not in the menu **More**; it opens from a person. When the research is not
  running, the window shows the state from when it ran and says what can be edited: titles and links of the tree's
  files are written with the tree, material outside the tree only with the research running.
- **Sort ▾** in the window's bar sorts the Grid and the List alike, within the groups: **Default order**, or a column
  (**Title**, **Type**, **Date**, **People**, **Source**, with an archive **In the tree**, **Used**) and **Ascending** /
  **Descending**. A click on a header of the List changes the same sort. The sort is remembered on this device. On a
  tablet and in a window up to 1024 px it is in **Filters**.
- **Controls:** see [A3.5](#A3.5); selecting files: **Select**, Ctrl/Cmd+A selects what the filters show.
- **Since:** app 3.30.0
- **From app 3.31.0:** on a phone the window also opens from **More → For the family**: the first row **Materials**
  with the number of files. On a tablet **Materials** stays on the first level of **More**.

<!-- zdroj: app:c9775287 src/materials-overview.ts chooseSort, sortOverviewGroups (uvnitř skupin), src/ui/materials-window.ts mwSortChipHtml, mwSortMenu, mwSortColumns (intree jen model archive), mwSetSort → writeListPrefs (localStorage), filtry ≤ 1024 · strings.ts materials.sortBy, sortChip, sortDefault, sortAscending, sortDescending · app:1ebf7896 src/ui/materials-ui.ts, src/ui/materials-window.ts (skupiny, Kde soubory jsou) · app:a1127378 sloupce seznamu, Ctrl/Cmd+A · app:b198b1c2 src/media-uses.ts materialPersonLabel (Neznámá osoba) · app:e6e16634 staleEdit · app:prace/1117-app-102-materialy D1 (telefon: bez řádku Materiály ve Více) · strings.ts materials.groupAdded, groupPerson, groupBatch, groupDate, whereTitle, whereApp, whereArchiveResearch, whereEncryptedResearch, search, showHidden, unknownPerson, staleEdit · 3.31.0: app:122a5096 src/ui/bottom-sheet.ts materialsRow (s počtem materialsAppCount) jako první řádek stránky menu.forFamily jen isPhoneBar, jinak v první úrovni · strings.ts materials.menu, menu.forFamily · dirigent:prace/1122-app-mobil-drobnosti -->

<a id="A3.5.2"></a>
### A3.5.2 Title, kind and date

A file can have a **title**, a **kind** (**Photo**, **Document**, **Record**, **Other**) and a **date**. The title is
shown instead of the file name; an empty title means the file name.

- The date is a year, a date or a range ("about 1920"); what cannot be read the app does not save ("The date cannot
  be read.").
- The person page, the family book and the saved page describe a file by its whole title, its kind and the year of
  its date.
- Editing a file of the tree is one step of **Undo**; a file outside the tree is edited in the research, with a notice
  and **Undo**.
- GEDCOM carries the title as `TITL` (the file name as `_STROM_NAME`) and the kind as `TYPE` under `FORM`
  ([A2](A2-loading-a-family-tree.md)).
- **Limits:** a file outside the tree can be edited only with a running research 1.35.0 or newer ("A newer version of
  the research can title material that is not in the tree.").
- **Controls:** the file viewer: the pencil, **Add a title** or F2 (Enter saves, Esc cancels); the dialog
  **Attachment** (**Title and details…**: title, kind, date, note).
- **Since:** app 3.30.0; a file outside the tree with the research 1.35.0

<!-- zdroj: app:30b0accd src/ui/material-viewer-ui.ts, src/ui/material-details-ui.ts (titulek, druh, datum, F2) · app:6d8fba0e DataManager (titulek vedle názvu) · app:dfb50772 src/ged-exporter.ts TITL, _STROM_NAME, TYPE pod FORM · strings.ts materials.kind, titleHint, datePh, dateInvalid, olderEdit, attachmentDialog, titleAndData, addTitle · research:a7df632d POST /material/edit -->

<a id="A3.5.3"></a>
### A3.5.3 Where used

Every file shows where it is used: people, portrait, union, events, sources and excerpts, in this order. Each row is
a link to the person or the source.

- The evidence of a source also says where the source is cited ("evidence · cited at Birth").
- Over five places, four are shown and "+ N more".
- × at a place (**Unlink:**) removes the file only from this place, with a notice and **Undo**. The last place of a
  file nothing else holds asks first ([A3.5.6](#A3.5.6)).
- Beside an archive there are two parts: **In the tree** and **In the archive**, with the people assigned in the
  archive and with what the research used the file for (excerpts, the research's sources, open tasks).
- A file that is the file of a research's source has **File of a source** at the top: the sources, how the file
  belongs to them, who cites them, and "The file is in the research; in the tree it is there through a source."
  ([A3.5.14](#A3.5.14)).
- **Limits:** a read-only tree shows the places without ×. The uses in the archive are shown only by the research
  1.35.0 and newer; when the research is not running, they follow the state the app last knew.
- **Controls:** the file viewer (a panel, on a phone a pulled-up sheet); the dialog **Attachment**.
- **Since:** app 3.30.0

<!-- zdroj: app:4bf66048 src/ui/material-uses-ui.ts (prameny první, usesSourceOf, keptViaSource) · app:1ccc666c src/media-uses.ts (pořadí person, portrait, couple, event, source, excerpt) · src/ui/material-uses-ui.ts COLLAPSE_OVER=5, COLLAPSED_ROWS=4 · app:55d66efd sourceCitedAt · strings.ts materials.used, usedInTree, usedInArchive, usedType, docCitedAt, moreN, unlink, usesArchive, usesOlder, usesStale · research:a7df632d GET /material/<I…>/uses -->

<a id="A3.5.4"></a>
### A3.5.4 Link to…

**Link to…** puts a file at people, at an event, at a union or at a source, in one step of **Undo**.

- At a source the file is its evidence; at a union an attachment of the union. The couple's photo is changed at the
  union ([A12.4](A12-portrait-and-couple-photo.md#A12.4)).
- A material only in the archive is linked with its reduced copy from the research: then it is in the tree, in the
  export, in the book and on the phone too.
- The same file added a second time: **The file is already in the tree** offers **Link here too**, **Add as a new
  file** or cancel. Beside an archive it is linked without asking.
- Deleting a person or a source says which files stay and which disappear.
- **Limits:** at most 50 people at once. A material only in the archive can be linked only while the research runs. A
  person the research does not know yet reaches the research with the next writing of the tree.
- **Controls:** the file viewer (**Link to…** or P; the arrows change the target, Enter links); a selection in the
  window **Materials**.
- **Since:** app 3.30.0
- **From app 3.31.0:** a person who already has all the chosen files (by a place in the tree or by an assignment in
  the research) stands above the list as a chip marked "already linked", without ×, and is ticked in the list and
  cannot be changed. "Nobody yet" is not shown beside them.
- **From app 3.32.0:** in a tree followed live from the research, **Link to…** is offered as elsewhere (⋯ in the
  person's **Materials**, the rows of attachments, the file viewer). The dialog says "The tree is followed live and is
  read-only. Linking is possible after following ends; the choice stays." and offers **End following**; until then
  linking is not possible. A locked person still does not have the action.

<!-- zdroj: app:a275d977 src/ui/material-attach-ui.ts openAttachDialog, MAX_PEOPLE=50, materialKeptByArchive, dup dialog · strings.ts materials.attach, attachTarget, coupleNote, archiveOnlyResearch, dupTitle, dupAttach, dupNew, dupLinkedToast, assignMax, noRefnTreeResearch · 3.31.0: app:9eee6b2c src/ui/material-attach-ui.ts attachFixedPeople (místo ve stromu nebo REFN ve výzkumu, u všech souborů), src/person-picker.ts fixedChips · strings.ts materials.attachAlready, noneChosen · dirigent:prace/1122-app-portret-dev · 3.32.0: app:6a3f1550 (1123-app-vyrez-pripojit) src/ui/material-uses-ui.ts canEditMedia(id, {exceptFollow:true}), isTreeLocked({exceptFollow}) · src/ui/material-attach-ui.ts:215 followedNote + endFollow · strings.ts materials.attachFollowed · dirigent:test/vysledek-1123-app-vyrez-pripojit.md B -->

<a id="A3.5.5"></a>
### A3.5.5 A source from a file and the evidence of a source

A source can have **evidence**: the file it is taken from. The evidence is a place of the file at the source; the file
is not added again.

- **Create a source from this file…** opens the source editor filled in from the file: the name from the title, the
  date of the record from the date, the file as evidence and **Cite at** with the person the file is from and with
  the event whose year fits. Saving is one step of **Undo**: the source, the evidence and the citation.
- A new source at a person offers **Evidence from the person's materials**: the person's files **Without source** and
  **With another source**, over 12 files with a search (**Search title and name**).
- The source viewer shows **Taken from**: the evidence with × and **Link evidence…**. An excerpt points to the file it
  was cut from ("Excerpt cut from … ›").
- GEDCOM carries the evidence as `OBJE` at the source; a file in several places is one `OBJE` record
  ([A2](A2-loading-a-family-tree.md)).
- **Limits:** a material only in the archive becomes evidence with its reduced copy only while the research runs. The
  app never stores a file twice.
- **Controls:** the file viewer, ⋯ at an attachment, the dialog **Attachment** and in **Link to…** at a source **New
  source from this file…**; the source editor, the field **Evidence**.
- **Since:** app 3.30.0

<!-- zdroj: app:0c532b5a src/ui/source-docs-ui.ts (hlavička §5–§7: Vytvořit pramen, Doklad z materiálů osoby, Z čeho je), OFFER_SEARCH_OVER=12 · app:55d66efd · strings.ts sources.docLabel, docHint, attachDoc, citeAtLabel, offerTitle, offerNoSource, offerOther, offerSearch, viewerFrom, excerptFrom · materials.makeSource, newSourceFromFile · app:dfb50772 src/ged-exporter.ts objeOf (OBJE u SOUR, _SOUR u osoby), recordOf (soubor na více místech = záznam OBJE @M…@) -->

<a id="A3.5.6"></a>
### A3.5.6 Remove from the tree and Restore

**Remove from the tree…** removes a file from all its places in the tree. What happens to the file depends on whether
an archive holds it.

- The dialog first says what points to the file: the evidence of a source ("The source stays without evidence."), an
  excerpt ("The excerpt stays."), a portrait ("The portrait stays; its crop can no longer be changed.").
- **Without an archive:** **Delete the file from the tree?** deletes the file. "The file is not stored anywhere else.
  Only Undo or a backup (Export all) brings it back."
- **With an archive** (the file is in the research or in the Strom archive): the file stays in the archive, hidden
  with the reason **Removed from the tree**; an optional reason is **Not about the family** or **Duplicate**. In
  **Show hidden**, **Restore** brings it back with its links, to the places that are still in the tree.
- Several files from a selection are one step of **Undo**. **Remove a person…** removes the chosen person from the
  selected files; a file with no other place is announced beforehand.
- The bin at a person's attachment removes the file only from this person, with a notice and **Undo**; the last place
  asks like **Remove from the tree…**.
- **Limits:** the file stays in the archive only when the archive has it: from the research 1.35.0 every file of the
  tree after a writing, with an older research only a sent original. The archive takes over the removal with the
  writing of the tree ([R11.5.1](R11-material-from-the-user.md#R11.5.1)).
- **Controls:** the file viewer; a selection in the window **Materials** → ⋯.
- **Since:** app 3.30.0

<!-- zdroj: app:a275d977, c2ae8441 src/ui/material-attach-ui.ts openRemoveFromTreeDialog (rmRefs, materialKeptByArchive = caps.list && item.file) · src/data.ts removeMedia (keep → removed + places), removeMediaMany, restoreMedia (jen místa, která ve stromu jsou) · app:13e4a70c src/ui/attachments-ui.ts removeAttachmentFromPerson · strings.ts materials.removeFromTree, rmRefDoc, rmKeepDoc, rmKeepExcerpt, rmKeepPortrait, rmArchiveResearch, rmAppTitle, rmApp, reason, restore, selRemovePerson, selRemovePersonLast · research:91ab6230, a7df632d -->

<a id="A3.5.7"></a>
### A3.5.7 Go through and bulk edits

The window **Materials** goes through many files at once: the filters show what is missing, and a selection edits all
selected files together.

- Filters with counts: **Without title**, **Without source**, beside an archive **In the tree** and **Only in the
  archive**.
- **Go through (N)** opens the viewer with the fields of the first file: Enter or → saves and goes to the next, ←
  back, **Skip**, Esc ends; P links, S creates a source. On a phone the files are switched by swiping.
- A selection: **Go through**, **Link to…**, **Title…**, **Kind…**, **Date…**; under ⋯ **Remove from the tree…**,
  **Remove a person…** and beside an archive **Assign to a person…** and **Hide…**.
- **Title…** can **Add a number in the batch's order**, with a preview. **Kind…** and **Date…** skip files that
  already have a value unless overwriting is ticked.
- **Limits:** the tree's files change in one step of **Undo**. The research's files in batches of 500, over 500 with
  progress and cancelling; the notice names the refused files.
- **Controls:** the window **Materials** → **Select** or a filter.
- **Since:** app 3.30.0

<!-- zdroj: app:a1127378 src/ui/materials-window.ts (filtry, výběr, Projít), src/ui/material-bulk-ui.ts BULK_CHUNK=500 · app:13e4a70c (tažení na telefonu) · strings.ts materials.fNoTitle, fNoSource, fInTree, fOnlyArchive, review, setTitle, setKind, setDate, titleNumber, titleOverwrite, bulkProgress, bulkRejected, reviewSwipe -->

<a id="A3.5.8"></a>
### A3.5.8 Sort with the agent

**Sort with the agent…** sends the research's files to the agent. For each one the agent proposes a title, date,
kind and links (people, event, source) with a short reason. Nothing is written until the proposal is accepted.

- The dialog shows the files and the field **What is known about the files** (optional, own words as a guide). It
  says that what the agent opens goes to the model provider and that sorting uses the subscription or credit. Only
  the button **Sort with the agent** in the dialog sends the files, once.
- The window can be closed; the progress and the finished proposal are in the band of the window **Materials**.
  - **From app 3.30.0:** the band shows "Waiting for the agent…", then "The agent is sorting · k of n" with a bar
    showing how many files the agent has already assessed. A research that does not tell the number assessed has
    "The agent is sorting · N files" with a bar without a number; with reduced motion set in the system that bar
    stands still. Below it "The window can be closed; the proposal waits in Materials."
- **The agent's proposal** has **Proposals**, **Unassigned** and **Done**, and at each file **Accept**, **Edit**,
  **Reject**; further **Accept selected** and **Accept all**. The certainty of a proposal: sure, likely, uncertain.
  - **From app 3.30.0:** in **Unassigned** a file without a proposal has a quiet row saying why it has none: "The
    reader said nothing about the file", "The file already has everything proposed", "The proposal could not be
    used", "The agent left the file out" or "The file could not be read". What the reader wrote about the file stands
    below it on one line, in full on hovering. A research that does not give the reason, or a reason the app does not
    know: a row without a reason as before.
  - **From app 3.30.0:** a file the agent says is not about the family stands first in **Unassigned**, marked
    **Not about the family** ([A3.5.9](#A3.5.9)).
  - The agent reads text files (.txt, .md) by their content, not as an image
    ([R11.5.3](R11-material-from-the-user.md#R11.5.3)).
- A title, date and kind set by a person stay; the agent's proposal is used only when **Use the proposal** is chosen.
- What is accepted is written: the tree's files in one step of **Undo** with the tree, material outside the tree to
  the archive. A source of the research the tree does not have yet comes into the tree with the research's number,
  and writing does not duplicate it. An accepted proposal can be undone at its row with **Undo**.
- **What is sent:** from a batch and from all unsorted only files without a title of their own or without a person,
  without copies, files of a source, files the agent left unassigned last time, and text and data files; files
  selected by hand all go ([A3.5.11](#A3.5.11)).
- The sorting band is one above the whole archive ([A3.5.10](#A3.5.10)); a batch is sorted from its ⋯.
- **Limits:**
  - only with the research 1.35.0 and newer that has an agent, and only while the research runs; with the Strom
    archive and with a research waiting for an agent the offer is not there at all;
  - at most 30 batches of 50 files as one run ([A3.5.12](#A3.5.12)), with a research without runs 50 files; 2000
    characters of text;
  - the research can refuse the sorting: the reading limit used up, too many sortings waiting, the agent cannot work
    now. How the research sorts is described in [R11.5.3](R11-material-from-the-user.md#R11.5.3);
  - only in the app on a computer.
- **Controls:** the window **Materials**: a selection, the sorting band, ⋯ of a batch; the end of a batch from the
  app.
- **Since:** app 3.30.0, research 1.35.0
- **From app 3.32.0 with research 1.37.0:** with a research with **Sort with the agent without asking** (switched
  on in the app after a confirmation or in the terminal, [S4.4.13](S4-research-from-the-app.md#S4.4.13)) the
  dialog does not say the cost before sorting. Sorting still starts only by the button in the dialog; the AI tag and
  the number of files stay.

<!-- zdroj: app:9752aead (jeden pruh nad archivem, pruhy dávek a nabídka nad vším pryč, dávka z ⋯), 2fbab382 src/material-sort.ts sortNext, 1047b9d6 (běh do 1 500 souborů, bez material.sortRun jedna dávka) · app:1affd46e, d5b6ef8e src/ui/material-sort-ui.ts (odeslání jen klikem v dialogu), src/materials.ts SORT_MAX_FILES=50, SORT_MAX_TEXT=2000 · src/ui/materials-window.ts materialSortGate (sel-sort) · src/ui/batch-ui.ts doneSort · app:2a6dd268 pramen z výzkumu s REFN S… · strings.ts materials.agentSort.* (will, keep, privacy, cost, tooMany, errLimit, errQueue, errNotReady, offRun, phone, write, useProposal, undoRow) · research:87376d11 POST /material/sort, cc709045 material.sort jen s agentem · app:32f1e29f src/ui/material-sort-ui.ts (counted jen s job.filesDone: run k z n, progressbar aria-valuenow; jinak runFiles, is-indeterminate; runNote), strings.ts agentSort.queued, run, runFiles, runNote · app:30688d6b src/materials.ts parseSortUnproposed, material-sort-ui.ts (unassigned && !p → unproposed[why], said na jednom řádku s title), strings.ts agentSort.unproposed.* · research:ae866bb7 filesDone, unproposed, čtení textu · app:8a8131be src/material-sort.ts sortNeedy, sortWholeOffered (narrowed, remembered, jedna dávka se stejným počtem), materials-window.ts sortWholeClosed, strings.ts agentSort.stripWhole, closeWhole · app:a947b426 sortCandidates (dávka, filtr, celé okno: jen bez titulku nebo osoby; výběr vše) · 3.32.0: app:7674ee44 src/ui/material-sort-ui.ts (sort.confirm no: bez věty o ceně) · dirigent:spec/102 U8 -->

<a id="A3.5.9"></a>
### A3.5.9 Not about the family

When the agent says while sorting ([A3.5.8](#A3.5.8)) that a file is plainly not about the family (a screenshot, a
receipt, a stranger's holiday photo, a file sent by mistake), the file is marked **Not about the family** in **The
agent's proposal** under **Unassigned**. Only a person can hide it; neither the app nor the research hides or deletes
it by itself.

- Such a file has no proposed title, date, kind or links. Its row shows the certainty (sure, likely, uncertain: how
  sure it is that the file is not the family's) and "Why not: …" with what the agent saw on the file.
- The agent marks only a file plainly outside the family; a file it merely cannot place stays under **Unassigned**
  without the mark ([R11.5.3](R11-material-from-the-user.md#R11.5.3)).
- These files stand first under **Unassigned**. Above them is **Hide as Not about the family (N)**, at each one
  **Hide…**. Both open the dialog **Hide the file?** with the reason **Not about the family** preselected (it can be
  changed to **Duplicate** or **No reason**); only the button **Hide** hides the file. The notice has **Undo**. After
  the dialog, even a cancelled one, the agent's proposal comes back on **Unassigned**.
- A hidden file says "Hidden · not about the family" in its row, with **Restore**. It stays in the research with its
  original and is seen in **Show hidden** ([A3.5.1](#A3.5.1)). **Go through by hand (N)** leaves hidden files out.
- **Limits:**
  - only a research file outside the tree that is not hidden yet can be hidden. A file in the tree has the mark
    without **Hide…**; **Remove from the tree…** takes it out of the tree ([A3.5.6](#A3.5.6));
  - **Hide…** and **Restore** work only while the research runs; otherwise they are disabled;
  - a research that does not send the mark leaves **Unassigned** as before.
- **Controls:** the window **Materials** → the proposal's band → **The agent's proposal** → **Unassigned**;
  terminal: `strom material show <id>`, hiding `strom input hide I… --why unrelated`
  ([R11.5.2](R11-material-from-the-user.md#R11.5.2)).
- **Since:** app 3.30.0, research 1.35.0

<!-- zdroj: app:f2bebc4c (v 401eaca4) src/materials.ts SortProposal.unrelated, parseSortProposal · src/material-sort.ts sortRows (unrelated: bez polí a vazeb), sortUnrelatedHideable (origin ≠ tree, file, !hidden, bez places) · src/ui/material-sort-ui.ts (Nepřiřazeno: unrelated první, msp-flag reason.unrelated, conf, unassignedWhy + why; hideUnrelated, hide, restore, hiddenLabel; hideCan: caps.assign, jinak null; bridgeUp && base, jinak vypnuto; reopen na tab unassigned; Projít ručně bez skrytých) · src/ui/material-actions-ui.ts openHideDialog (důvod unrelated předvybraný, ctx.back) · strings.ts materials.agentSort.hideUnrelated, unassignedWhy, reviewByHand, materials.hide, hideTitle, reasonLabel, reason, hideConfirm, hiddenLabel, hiddenToastResearch, restore · research:f36b3941 (ve vydání 1.35.0) src/core/sort.ts unrelated -->

<a id="A3.5.10"></a>
### A3.5.10 The sorting band and the end of the proposal

The window **Materials** has one sorting band above the whole archive. It shows the state of all files of the
research, even when a filter shows only a part; there are no bands under the batches.

- **States of the band:**
  - unsorted files: "N files without title or person" with **Sort with the agent…**, **Go through by hand** and ×;
  - the agent is sorting: the progress ([A3.5.8](#A3.5.8), [A3.5.12](#A3.5.12)) with **Cancel**; when proposals
    are already waiting, also **Go through the proposal (N)**;
  - a proposal is waiting: "The agent's proposal: N to go through" with **Go through the proposal (N)** and **Close
    the proposal…**;
  - after the proposal: "Done: a handled · u unassigned · N unsorted left" with **Sort the next (N)…**, **Go
    through by hand** (the files the agent did not assign) and ×;
  - nothing left: "All files have a title and a person."
- × hides the band until its state changes. A batch added while the window is open is announced in the band as
  "N files added · M without title or person" ([A3.5.15](#A3.5.15)).
- **The end of the proposal:** when everything is gone through, the window **The agent's proposal** says "Done · a
  accepted · r rejected · u unassigned" (for a run also "For the whole run: …") and below it:
  - "N unsorted files are left in the archive" with **Sort the next (N)…**: the proposal closes and the dialog
    **Sort with the agent** opens; otherwise "Nothing else in the archive is left to sort.";
  - copies with the same content that were not sent: **Hide as Duplicate (N)…**;
  - "The agent did not assign N files": they stay without title and person, carry the tag **Not assigned by the
    agent** and are not sent to the agent next time ([A3.5.14](#A3.5.14)).
- A proposal in which nothing waits is closed by closing the window. **Close the proposal…** asks **Close the
  proposal?**: open proposals are not written and the files stay unsorted; accepted ones stay accepted.
- **Limits:**
  - on a phone the band only shows the state; the proposal is in the app on the computer. A read-only tree: only the
    state and "The tree is read-only.";
  - when the research is not running, the band is off and says why;
  - a research without runs in batches offers **Sort the next 50…** with "The agent takes at most 50 files at once.
    A newer version of the research sorts in batches."
- **Controls:** the window **Materials** → the sorting band; ⋯ of a batch → **Sort with the agent…**; the window
  **The agent's proposal**.
- **Since:** app 3.30.0, research 1.35.0

<!-- zdroj: app:9752aead src/material-sort.ts sortStripState (A–F nad celým archivem i s filtrem; × jen v A a E), src/ui/material-sort-ui.ts materialSortStripView, konec návrhu (endTitle, endRun, restLine, restNote, leftLine, leftNote, nothingLeft, endFoot, closeAsk, closeText), materialSortCloseAsk · src/ui/materials-window.ts mwSortWholeClose (sortClosedState do změny stavu), ⋯ dávky (sort) · app:17585b94 materialsBatchAdded (stripAdded) · app:0b0c9d4f (telefon, strom jen ke čtení, výzkum neběží, starší výzkum bez běhů: olderNext, olderRun) · strings.ts materials.agentSort.stripWhole, reviewHand, handle, pending, doneLine, sortNextN, allSorted, closeProposal, readOnlyNote, phoneShort, hideCopies, copiesLine -->

<a id="A3.5.11"></a>
### A3.5.11 What to sort: batches and what is not sent

The dialog **Sort with the agent** first says what is sent, in how many batches and what is not sent. Files go in
batches of at most 50.

- **What to sort:** tiles with counts. At the top where the dialog came from (**Selected only** or **Batch "…"
  only**), then always **All unsorted**; over 10 batches also **First 50 only** ("1 batch; the rest later with
  "Sort the next"").
- **Order:** images and PDF first, then other files, text and data files last; within that by batch and folder, the
  files of one folder together.
- **What is not sent** (from a batch and from all unsorted): copies with the same content as an older file (only
  the older one goes), a file that is the file of a source, files the agent left unassigned last time, and text and
  data files (.md, .txt, .json, .csv). The dialog says so in one sentence with **Details**: for copies **Hide as
  Duplicate (N)…**, for the unassigned ones **Show in Materials**, for text files the checkbox **Send text and data
  files too (N)**.
- **Selected only** sends all selected files except hidden ones; the dialog counts the copies and files of a source
  among them and sends them too.
- The dialog says "N files are sent in M batches of at most 50. …" and the button is **Sort with the agent · M
  batches**. Over 10 batches it says firmly that each batch uses the subscription or credit and that the run stops
  when the limit runs out; **First 50 only** is enough for a try.
- **Limits:**
  - at most 30 batches (1,500 files) as one run ([A3.5.12](#A3.5.12)); anything above that waits for **Sort the
    next**;
  - a research without runs in batches takes one batch (50 files);
  - the app knows a file of a source only from the research. Copies and files the agent left unassigned are told by
    the research; when it cannot, the app knows copies by the content of the files it knows and the unassigned ones
    by the proposals it remembers.
- **Controls:** the window **Materials**: the sorting band, a selection, ⋯ of a batch → the dialog **Sort with the
  agent**.
- **Since:** app 3.30.0, research 1.35.0

<!-- zdroj: app:1047b9d6 src/ui/material-sort-ui.ts openSortDialog (base: selection | batch | all, 'first' nad SORT_MANY_BATCHES=10, plan, planOne, costBig, overRun, goRun, selWarn, drawLeft s details), src/material-sort.ts SORT_MAX_BATCHES=30, sortRunBatches · app:2fbab382 src/material-sort.ts sortNext (obrázky a PDF první, text poslední jen s withText, dávka a složka, výběr vše bez skrytých; kopie, zdroje, left jen mimo výběr), sortIsText, sortCopyOf (material.sameAs, jinak otisk), sortLeftMap (material.left, jinak paměť aplikace) · strings.ts materials.agentSort.scopeLegend, scopeAll, scopeSel, scopeBatch, scopeFirst, scopeFirstSub, leftCopies, leftText, leftSources, leftLeft, showLeft, details, withText, withTextHint -->

<a id="A3.5.12"></a>
### A3.5.12 A run in batches

More than one batch goes as one run: the research sorts the batches one after another and the proposal of each
finished batch can be gone through at once.

- The band and the indicator are one for the whole run: "The agent is sorting · batch b of M · k of n", at the
  start of a batch "… is starting". The window **The agent's proposal** shows "Batch b of M is running · more
  proposals will come"; new proposals are added at the end of the list with a notice and **Show**.
- The run goes on after the window is closed and after the app is reloaded. The notice of the end comes once, at
  the end of the run.
- **Cancel** stops the run at once: the batch at work ends, the waiting ones do not start. When finished proposals
  exist, it asks **Discard the finished proposals?** and says which batches will not run and how many files stay
  unsorted; **Keep them** leaves them to go through.
- **A batch that did not run:** after the end of the run the band in the error colour says "Batch b of M did not
  run:" with the reason, what stays unsorted, **Go through the proposal (N)**, **Try again…** and **Close**. The
  other batches run on meanwhile.
- **A run stopped elsewhere:** "Sorting stopped after batch b of M." with **Continue (N batches)…**. **Try again…**
  and **Continue** open the dialog with **What is left of the run**; new batches are added to the proposal that is
  open.
- **A batch waits** when the readings the app may ask for are used up: "Batch b of M is waiting" and "It starts by
  itself in about N min." (or h).
- **Limits:** at most 30 batches of 50 files; only a research that can run batches
  ([R11.5.5](R11-material-from-the-user.md#R11.5.5)). Each batch uses the subscription or credit and counts towards
  the app's readings.
- **Controls:** the dialog **Sort with the agent**; the band of the window **Materials**; the window **The agent's
  proposal**.
- **Since:** app 3.30.0, research 1.35.0

<!-- zdroj: app:acc877d6 src/ui/material-sort-ui.ts (běh výzkumu čtený do konce, jeden pruh a ukazatel, runBatch, runBatchFiles, runStarting, runInWindow, moreArrived, show; po novém načtení sledovaný znovu; toast jednou na konci) · app:687dd41b materialSortCancel (cancelMaterialSortRun, discardAsk, discardRun, discardKeep), batchFailed, runErrorText (errLimit, batchErr), leftAfterError, retry, stopped, stoppedNote, resume, scopeRest, runWaiting, runWaitText (waitApp, waitRetry) · app:0b0c9d4f (bez toastu při otevřeném okně návrhu) · research:0cc2cfca src/core/sort.ts SORT_RUN_MOST_FILES=1500 -->

<a id="A3.5.13"></a>
### A3.5.13 Back and portrait in the proposal

In the proposal the agent can say which of the sent files is the back of another photo or page and which image is
a person's portrait. The proposal shows it as a chip at the file.

- **Back:** at the front a chip "Back:" with the preview and name of the back. Accepting writes the back together
  with the front: the back gets its date, kind and links and the title "… (back)". The row shows both names ("… +
  … (back)") and "2 sides".
- **Portrait:** a chip "Portrait:" with the person. When accepted, the file gets a place at the person and the
  portrait editor opens ([A12](A12-portrait-and-couple-photo.md)).
- × takes the chip off the proposal; the rest of the proposal stays.
- **Limits:**
  - a back only between files the same reader of the research got: one back to one front, never a back of a back
    nor a text file ([R11.5.3](R11-material-from-the-user.md#R11.5.3));
  - a portrait is offered only for an image and only at a person who has no portrait and can be edited.
- **Controls:** the window **The agent's proposal** → **Proposals**.
- **Since:** app 3.30.0, research 1.35.0

<!-- zdroj: app:2fbab382 src/ui/material-sort-ui.ts withPortraits (obrázek, osoba bez photo, canEditPortrait), čipy own() s × (dropped), rubFiles, twoSides, accept (sortBackRow s rubSuffix, portrét: místo personId) · strings.ts materials.agentSort.rubChip, portraitChip, rubSuffix, rubFiles, twoSides · research:0cc2cfca src/core/sort.ts SORT_LINK_TYPES back, portrait -->

<a id="A3.5.14"></a>
### A3.5.14 Not assigned by the agent, Same content and File of a source

The tiles and rows of the window **Materials** carry a tag before the people that says why a file stayed unsorted,
or that it is sorted through a source.

- **Not assigned by the agent:** a file the agent proposed nothing for when sorting. The file viewer shows "Why not"
  with the reason. The filter **Not assigned by the agent** (with a count) stands after the other filters. The next
  sorting does not send such files unless they are selected by hand.
- **Same content:** a file with the same content as an older file; sorting sends only the older one.
- **File of a source** (for more sources "File of N sources"): a file the research made a source of. The tag stands
  before the people who cite the source, and **In the tree** follows whether the source is in the tree. In **List**
  the column **Source** shows a tag with the title of the first source. Such a file is sorted: it does not count
  towards **No person** nor **Without source** and does not carry **Not assigned by the agent**. **Where used**
  shows the sources first for it ([A3.5.3](#A3.5.3)).
- **Limits:** **Not assigned by the agent** and **Same content** are carried only by a file without a title or
  without a person that is not hidden. **File of a source** only with a research that reports the files of sources
  ([R11.5.4](R11-material-from-the-user.md#R11.5.4)); without it the files show as before.
- **Controls:** the window **Materials** (tiles, **List**, **Filters**); the file viewer.
- **Since:** app 3.30.0, research 1.35.0

<!-- zdroj: app:2fbab382 src/ui/materials-window.ts (agentLeft, copyOf jen u souboru bez titulku nebo osoby, ne skrytý ani zdroj pramene), mwSortTagHtml, filtr left (fLeft), src/ui/material-viewer-ui.ts (unassignedWhy + said nebo unproposed[why]) · app:4bf66048 src/materials-overview.ts, src/ui/materials-window.ts mwSourceOfTag, src/ui/material-uses-ui.ts (zdroj pramene: přiřazený, bez Bez osoby a Bez pramene) · strings.ts materials.agentSort.fLeft, tagLeft, tagCopy, tagSourceOf, sourceOfN, usesSourceOf, viaInput, viaMedia, viaExcerpt, citedBy, keptViaSource · research:0cc2cfca src/core/live.ts GET /material (uses.of, left, sameAs) -->

<a id="A3.5.15"></a>
### A3.5.15 Add materials… in the window

**Add materials…** in the header of the window **Materials** opens the wizard **Add materials to the research**
over the window ([R11.4](R11-material-from-the-user.md#R11.4)).

- Files and folders dragged onto the window show "Drop here: add to materials" and open the wizard with them.
  Nothing is sent without confirming in the wizard.
- A batch added while the window is open is announced in the sorting band ([A3.5.10](#A3.5.10)) and the list is
  loaded again.
- **Limits:** only with a research that takes batches and with a tree that can be changed; a tree without a
  research has no button. On a phone there is no dragging; **Add materials…** and **Where the files are** are in
  the header's ⋯ there.
- **Controls:** the window **Materials** → **Add materials…**; dragging files or folders onto the window.
- **Since:** app 3.30.0

<!-- zdroj: app:17585b94 src/ui/materials-window.ts mwAddMaterials (showBatchDialog), mwWireDrop (ne na telefonu), mwFillHeadMenu (telefon: add, where), materialsBatchAdded · src/ui/materials-ui.ts materialsAddOffered (windowAddOffered: model archive, batchAvailable, ne jen ke čtení) · strings.ts materials.addMaterials, dropTitleMaterials, dropSubMaterials, agentSort.stripAdded -->

<a id="A3.5.16"></a>
### A3.5.16 Delete permanently

**Delete permanently…** deletes files of the research from the archive and from the tree. It goes only through a
dialog that first says what refers to the files; it cannot be undone in the app.

- The dialog **Delete N files permanently?** shows a preview (for more files the first five and "and N more"),
  **What refers to the files** according to the research (rows **Source**, **Excerpts**, **Tree**, **People**,
  **Tasks**), that the files are deleted from the archive of the research and from the tree, and the checkbox **I
  understand that deleting cannot be undone in the app**.
- The button **Delete permanently** works only when the research has confirmed the list and the box is ticked; the
  focus is on **Cancel**. Files outside the tree that are not hidden yet also offer **Only hide – can be undone**.
- **What happens:** a source stays, only without its file; a source with the same content loses the image, its text
  and citations stay; excerpts from these files are deleted; places in the tree are removed by the next version of
  the tree from the research; the file disappears from the people's materials; a task with no other files is given
  up. Content that another file or another research on this computer also has stays stored and only the record is
  deleted.
- When the list has changed meanwhile, or the confirmation has expired (it holds 15 minutes), the dialog shows the
  new list, clears the tick and the deleting must be confirmed again.
- After deleting the notice "Deleted permanently: N files." without **Undo**. The files disappear from the window
  and from the agent's proposal. They stay only in earlier backups of the research (with the Strom archive, of the
  archive). Neither the agent nor the tree ever delete on their own.
- **Limits:**
  - only files of the research's archive or of the Strom archive; a file that is only in the tree is removed by
    **Remove from the tree…** ([A3.5.6](#A3.5.6));
  - at most 500 files at once ("At most 500 files can be deleted at once.");
  - only with a research that can delete and with a running bridge; never in a read-only tree;
  - on a narrow screen the dialog is a sheet from the bottom;
  - a family tree file and a file a valid source was made from are described in [A3.5.17](#A3.5.17).
- **Controls:** the window **Materials** → a selection → ⋯ → **Delete permanently…** (the last item); the file
  viewer (the last action). Terminal: `strom input delete` ([R11.5.6](R11-material-from-the-user.md#R11.5.6)).
- **Since:** app 3.30.0, research 1.35.0

<!-- zdroj: app:05e13ef7 src/ui/material-delete-ui.ts openDeleteDialog (suchý běh, potvrzení mostu, zaškrtnutí, Zrušit s fokusem, hideInstead, changed, expired, toast bez Zpět, list zespodu), src/material-delete.ts deletableFiles (origin ≠ tree, file), src/materials.ts DELETE_MAX_FILES=500, MATERIAL_DELETE_FEATURE · src/ui/materials-window.ts sel-delete (caps.delete, ne jen ke čtení, bridgeUp), src/ui/material-viewer-ui.ts (inArchive, poslední akce) · app:6949d833, f214eda6 (množné číslo, understandHint) · strings.ts materials.del.* · research:0cc2cfca src/core/materialdelete.ts DELETE_MOST_FILES, DELETE_CONFIRM_MS -->

<a id="A3.5.17"></a>
### A3.5.17 A family tree file in Materials

The window **Materials** also shows the family tree files the research has: an imported GEDCOM or a JSON file of the
app. They can be viewed and deleted permanently; when a source was made from one, only together with the source.

- The tile and the row of **List** show the kind and size ("Family tree file · 184 kB") and the tag **File of a
  source** when a source was made from the file ([A3.5.14](#A3.5.14)). A family tree file is never **In the tree**:
  it does not have that tag and the filter **In the tree** does not count it, not even when the source from it is in
  the tree. The filter **Type** has the row **Family tree files** only when there is one.
- Family tree files are outside the agent's sorting, bulk actions, **No person** and the counts of **Go through**.
  Their title, kind, date and people do not change.
- The file's menu (on a narrow screen a sheet from the bottom) has only **Details** and **Delete permanently…**.
  **Details** are without a preview and name the source made from the file ("the file of the source …").
- **Delete permanently…** for a file no source was made from: a dialog as in [A3.5.16](#A3.5.16), with the sentences
  "The family tree file is deleted from the research archive. This cannot be undone in the app." and "Nothing refers
  to the file: no source was made from it.", without **Only hide – can be undone**.
- **Delete permanently…** for a file a still valid source was made from: a two-part dialog **Delete the source and
  the file?** ("The source … was made from this file. The file is deleted after the source, both at once."):
  - **First the source is deleted**: what rests on the source, as in the dialog **Delete source?**
    ([A3.1.2](#A3.1.2));
  - **Then the file is deleted**: what refers to the file; the source "deleted in the first step";
  - "The source can be restored in the research later, but without the file.", one checkbox **I understand the file
    cannot be brought back in the app** and the button **Delete source and file**.

  Both are written at once, in one write in the research. The notice "Deleted the source … and the file …." has no
  **Undo**, and the source then disappears from the tree.
- **Enforced by the code:** when the list has changed meanwhile, the dialog shows the new one, clears the tick and
  the deletion must be confirmed again. A failed write deletes nothing ("Writing to the research failed. Nothing was
  deleted.") and allows trying again.
- **Limits:** only with a research that reports family tree files in the material; without it the window does not
  show them. Deleting as in [A3.5.16](#A3.5.16): only with a running bridge and never in a read-only tree.
- **Controls:** the window **Materials** → a family tree file → ⋯ → **Details** / **Delete permanently…**; the
  filter **Type → Family tree files**. Terminal: `strom input delete I… --retract-sources S…`
  ([R11.5.6](R11-material-from-the-user.md#R11.5.6)).
- **Since:** app 3.31.0 with research 1.36.0

<!-- zdroj: app:36601947 src/materials-overview.ts (druh tree za bránou material.trees, trees=1; mimo třídění, hromadné akce, bez osoby, počty Projít; podrobnosti nejdou upravit), src/material-delete.ts treeFileSource, retractSources, blockedBy (409 material.source-live) · 2a406d67 dlaždice a řádek (Soubor rodokmenu · velikost, štítek zdroje), filtr Druh, nabídka Podrobnosti + Smazat natrvalo… (list zespodu), Podrobnosti bez náhledu, dialog bez pramene bez Jen skrýt · b40b22e4 dvoudílný dialog · d9af4b16 (ne Ve stromu, ani štítek, ani filtr) · e2e/material-tree-delete.spec.ts (hlavička) · strings.ts materials.treeFile, kindTrees, treeFileOf, treeDetails, del.textTree, noRefsTree, bothTitle, bothIntro, partSource, partFile, laterNoFile, fileSourceSub, understandFile, bothGo, bothChanged, bothNone, bothToast · SPEC.md 1120-app-117-smazani, 1120-app-108-diry · spec 117 §5–§7 -->

<a id="A3.5.18"></a>
### A3.5.18 Material for a list of people

A scan with several people of the tree on it (a census sheet, a register page) can be sent to the research for a
whole list of people instead of one person. The field **Concerns** is the first field of the dialog **Send material to
the research**: **Person** (the person the dialog was opened from), for a source **Source only**, and under **List of
people** the tree's lists ([A11](A11-lists-of-people.md)).

- **What is sent:** the list as it is at the moment of sending: the name, the kind, the rule of an automatic list and
  the research numbers of its people; the dialog's person is first, even when not on the list. The research stores
  the material for the list and keeps the list unchanged ([R11.7](R11-material-from-the-user.md#R11.7)). The sentence
  above the button says where: "The research stores the files with every person on the list (5) …", for a source
  "… with the source and every person on the list (5) …".
- **A list of up to 50 people:** the files go to all its people the research knows.
- **A list of over 50 people:** "The list has more than 50 people: the research gets its name and the list of its
  people and looks them up itself." (for an automatic list "… its name and rule …"). The files go only to the
  dialog's person, for a source to nobody.
- **Limits:**
  - people on the list the research does not know yet are not linked to the material ("People on the list the
    research does not know yet (2) are not linked to the material."). A list of which the research knows nobody has
    "the research does not know these people yet" in the menu, and the material goes to the dialog's person as before;
  - an empty list cannot be chosen ("empty"). An automatic list is computed again when the menu opens;
  - **Also add as an attachment in the tree** gives the attachment only to the dialog's person: "The attachment is
    added only to Jan Horák, not to the other people on the list.";
  - the choice holds only in the open dialog; each opening starts with the person or the source;
  - when the research does not accept the list, the dialog stays open with the files ("The list could not be sent to
    the research; the files stay in the dialog."). When the research does not have the list a file refers to, the app
    sends it again;
  - the field is there only with a research that accepts material for a list; for a source only with a research that
    also accepts a scan of a source for a list. Otherwise the dialog has no field and the files go to the person or
    the source as before. The field is also missing when the research is not running and the files cannot wait in
    the browser (an encrypted tree, Safari).
- **Controls:** **Send material…** at a person or **Send material for this source…** → **Concerns** → the list. The
  menu (on a phone a sheet from the bottom): Enter, Space or ↓ opens it, ↑/↓ moves, Enter chooses, Esc closes. From 9
  lists it has the field **Find a list…**. After sending the notice "Sent to the research: 3 files for the list
  “Sčítání 1869” (5 people). …"; in the Strom archive "Saved in the Strom archive: … for the list …".
- **Since:** app 3.32.0 with research 1.37.0

<!-- zdroj: app:cd621161 src/material-list.ts (MATERIAL_LIST_PEOPLE 50, PUT lists/<listRef> name/kind/rule/persons/missing/at, materialListRef, snímek s osobou dialogu první, X-Strom-Person všichni známí do 50 jinak jen osoba dialogu, '' u pramene, bez známých osob materiál jako dřív), src/ui/material-concern-ui.ts (Týká se: Osoba / Pramen / Jen pramen, Seznam osob, FIND_FROM 9, prázdný disabled, listUnknown, popover a list na telefonu, klávesy, volba jen v otevřeném dialogu), src/ui/material-ui.ts (brány media.list a media.list.source, 404 media.no-list → seznam znovu, listFailed dialog otevřený, cantWait pole skryté) · 27452fd4 e2e/material-list.spec.ts · f5315651, 53752e6a · strings.ts material.concern, concernPerson, concernSource, concernLists, sourceOnly, listEmpty, listFind, listUnknown, whereList, whereListBig, whereSourceList, bigRule, bigPersons, missingNote, alsoAttachListHint, listFailed, sentToastList, sentWaitToastList, savedArchiveToastList · dirigent:spec/137 K2, prace/1123-app-137-linie-material (B1–B3) · research:de5f709d, 778846e6 (media.list, media.list.source) -->

<a id="A3.6"></a>
## A3.6 Sources of a person

The person menu **Sources** shows all sources of a person in one place, without opening the edit: cited for the
person, for birth and death, for events, for marriages and for couples' shared events.

- One row per source, under it what it supports: "Person", "Birth 1865", "Marriage 1890"… The row also shows the
  reliability.
  From app 3.27.0 it is the reliability of the citations: when the citations of the source agree in reliability, it
  is at the row once; when they differ, each fact is followed by its own ("Birth 1865 Copy / index · Occupation
  Original").
- Order: by the oldest year of what the source supports, otherwise by **Record date**; without a date at the end, then
  by title.
- **Cite a source** opens the picker with **Supports** ([A3.2](#A3.2)).
- **Find a source in the research**: only for a person without a source whom the research knows, and only with a
  research with an agent. It opens the research's terminal with a review of the person.
- **Limits:** in a read-only or locked tree the menu item is there only when the person has some source. The number of
  sources is at the menu item.
- **Controls:** person menu (click on the card) → **Sources**.
- **From app 3.22.0:** a story's sources are with the story itself. Under the text of a story there is one folded
  section **What the text is based on (N)**, where N is the number of sources:
  - **Sources**: each source once. First the sources the story itself points to, then the sources its facts cite. A
    source with a web address is a link that opens in a new window;
  - **Facts**: the facts the text is based on, readable ("Death 25 Sep 1857, Lhota"), without the research's codes;
  - **Author's note**, when the story has one.
- The section is in the window **Story**, on the person page, in the comparison of story versions and (read-only) in
  the person's edit. A source code in the text (`[S0164]`) is shown as the source's title in parentheses when the tree
  has it. The person page also lists a story's source among its sources, with **Story** or **Story of the marriage**
  as what it supports. The menu **Sources** does not list a story's sources.
- **Limits:** in print and in the family book there is nothing under the text; in the book a story's sources are
  numbered in the list of sources. How the research keeps a story's sources: [R3.9](R3-verification-and-citation.md#R3.9).
- **Since:** app 3.3.0; **Find a source in the research** 3.19.0; **What the text is based on** 3.22.0

<!-- zdroj: app:src/person-sources.ts:54 personSourceRows · src/ui/person-sources-ui.ts:114 canCiteOnPerson, :120 showPersonSourcesDialog, :187 find hidden · src/ui/context-menu.ts:191-203 readItems · src/ui/research-actions-ui.ts:1173 personFindSourceUrl · strings.ts personSources.*, research.findSource · src/story-sources.ts storyBasisSourceIds, storyFactText, storyBasisDetailsHtml · src/ui/person-page.ts:1738 storyBasisHtml · strings.ts storyBasis, basisSources, basisFacts, authorNote · CHANGELOG.cs.md 3.22.0 · 3.27.0: app:dde0151a src/person-sources.ts rowQuality, PersonSourceCite.quality, src/ui/person-sources-ui.ts source-quality-tag · app:66fc3f7f (údaj a štítek se nezalomí) -->

<a id="A3.7"></a>
## A3.7 Where evidence is missing

**Tree overview → Data quality → Where evidence is missing** lists groups of people who lack a source or parents. The
button **Show in the tree** highlights them in the tree and goes through them one by one. A group with nobody in it is
not listed.

- **People without a source**: in the whole tree ("n of total").
- **Births without a source**: ancestors of the chosen person ("n of N ancestors"). In a tree with the research,
  instead **Births not proven in the research**: births of ancestors that are not Proven.
- **Line ends**: people without parents who are ancestors of the chosen person, or have children and did not marry
  in.
- When nothing is missing: "Everyone has a source and parents."
- Below the groups there is always the button **Evidence in the tree**. It turns on the **Evidence** mode: every card
  gets a frame by the person's level of evidence ([R3.8.1](R3-verification-and-citation.md#R3.8.1)), solid for
  Documented, dashed for Partly documented and dotted for Undocumented. The bar at the top shows the counts of all
  three levels; a count highlights only that group, with **Next person ›**. The one mark on the card is another thing
  ([S7.2](S7-reliability-and-verification.md#S7.2)).
- While highlighting: **Next person ›**, **Cite** (for groups without a source) and × **End highlighting**. The order
  is by generation, then by name. At the end: "Done, no one left in this selection."
- **Limits:** for a birth the research assesses, the button **Sources** is there instead of **Cite**. Another citation
  does not prove the fact; the research decides. **Cite** is missing in a read-only tree and for a locked person. The
  check of the tree as a whole is described in [A5](A5-tree-check.md).
- **Controls:** **Tree overview → Data quality → Where evidence is missing → Show in the tree** (from another tree
  **Open tree and show**).
- **Since:** app 3.4.0; **Births not proven in the research** and **Sources** instead of **Cite** 3.13.1

<!-- zdroj: app:src/stats.ts:185-240 computeEvidenceGaps · src/ui/evidence-ui.ts:81 walkOrder, :325-358 pill · src/tree-overview.ts:215 birthResearchStatus · src/ui/tree-overview.ts:1946-1975 · strings.ts treeOverview.evidenceTitle/evNoSource/evBirthNoSource/evBirthUnproven/evLineEnds/evOfTotal/evOfAncestors/evAllGood/evLevels, treeHealth.citeAction/sourcesAction/next/highlightDone/highlightEnd · app:7eb903a3 src/ui/tree-overview.ts:1974 tov-ev-levels, :2293 showEvidenceLevelsFromOverview · src/ui/evidence-ui.ts showEvidenceLevels, renderEvidencePill, toggleEvidenceLevelGroup · index.html .person-card.evl-full/partial/none (solid, dashed, dotted) · strings.ts treeHealth.evidenceMode -->

<a id="A3.8"></a>
## A3.8 Image only in the research

An image only in the research is a scan or excerpt of a source that is stored in the research on the computer and that
the app does not have yet. The source is in the app without it; the image shows after loading it from the research
running on this computer.

- **Why the image is not in the app:** the source gives the reason: "The image is in the research but was not
  included for the app (research settings).", "… (size limit).", or "The image is being prepared in the research and
  comes with the next version." The research puts images into the file for the app by its settings and size limit.
- **Where it shows:** in **Sources** the filter **Image only in the research · N** with the tag *image only in the
  research* at the source and a line under the filter ("N images for M sources are stored only in the research on this
  computer; they show in the app once loaded."); in the **Research** menu the row **Images only in the research · N**,
  which opens **Sources** with the filter and shows the progress of loading.
- **Loading:**
  - **Load image from the research** at a source loads its images;
  - **Load all from the research…** first shows the number of sources and images, the size ("They are stored with the
    tree in this browser."), how many images the research still has to prepare, and the free space in the browser.
    Then the progress with **Pause** and **Stop**; the window can be closed and loading goes on. What is not loaded
    stays in the filter;
  - loaded images stay with the tree in this browser, apart from the tree's data.
- **Limits:**
  - loading works only from a research running on this computer ("It loads once the research runs on this
    computer."). On a phone or another device: "The image is in the research on the computer. It will be on this
    device once the tree is transferred with images from the research.";
  - **Remove from the app** removes the images from the browser again; they stay in the research and can be loaded
    again. Images that came in the research file stay;
  - **Load a source’s image when it is opened** loads only the opened source and only while the research runs on this
    computer; the source list loads nothing by itself;
  - the export offers **Source images**: **No source images**, **Only those in the app**, or **All from the research** (loaded before
    the export, only while the research runs on this computer).
- **Controls:** app: **Sources** → the filter **Image only in the research** → **Load all from the research…**; at a
  source **Load image from the research**, **More options → Remove from the app**; **Settings → Source images**
  (**Load a source’s image when it is opened**, **Remove from the app…**, **Load all…**); **Research → Images only in
  the research · N**.
- **Since:** app 3.14.0 with research 1.18.0
- **From app 3.25.0:** the filter and the tag are called **Image only in the research** (before, **Image in
  research**), the line under the filter says where the images are, and **?** opens this rule.

<!-- zdroj: app:src/strings.ts researchImages.* (held.scope/limit/later, heldTag, filter, bulkLine, bulkLoad, bulkSummary, bulkReady, bulkSpace, bulkCanClose, bulkLeft, menuRow, removeFromApp(Note), heldBridgeOff, heldDevice, settings.section/auto/autoDesc/remove/loadAll/removeKeep, export.legend/none/app/all/allOff) · src/help/topics.ts imagesHeld · CHANGELOG.cs.md 3.14.0, 3.25.0 · commit 68b31a48 -->

<a id="A3.9"></a>
## A3.9 Where the entry stands in the book

Where the entry stands is written at a source by fields. By the archive, call number, folio and image the entry is
found again even when the archive changes the addresses of its images or the book has no page numbers.

- **Fields:**
  - **Archive**: an archive, parish, library;
  - **Call number**: the call number of the book, an inventory number;
  - **Folio/page**: the folio or page as the book numbers it, with the word too ("fol. 12v", "pag. 112");
  - **Image**: the image number in the archive's viewer. **?** beside the field says why: "The image number in the
    archive’s viewer. With archive, call number, folio and image the entry can be found again after its address
    changes.";
  - **Other location**: the rest, e.g. the entry number, column, volume.
- **An older source** has where the entry stands as one text in **Other location** and the new fields empty. When
  **Folio/page** and **Image** are both empty and the text names a folio or an image, the editor proposes under the
  fields "From the location: fol. 31 recto · image 3 · rest “no. 2”". **Use** fills the three fields ("Taken from the
  location “…”. Saved with Save."), **Undo** returns them. Nothing is saved by itself: the fields taken over are saved
  only with **Save**, as one step back. The recognition is the app's code, the same as in the research
  ([R3.4.3](R3-verification-and-citation.md#R3.4.3)).
- **Conflict:** when **Other location** names another image or folio than the field, the editor says so ("The location
  names image 35, the Image field says 34. GED uses the field.") and offers **Change location to “…”** (or **Remove the
  conflicting part**). Saving works with the conflict too; GEDCOM gets the field.
- **Where it shows:**
  - the source viewer under the excerpts: **Book** (archive · call number) and **Entry** (folio · image · other
    location), at an older source the whole **Location**; under them the link to the page in the archive, without a
    link "No link. The entry is found by its book and entry details.";
  - **Actions → Sources** and the source picker: archive · call number · folio · image in short ("img. 34");
  - the citation chip: its bubble has three lines (title, book, entry);
  - the person page, the family book and the family pages also give the call number, folio and image;
  - the Table: the columns in [A6.7.11](A6-views.md#A6.7.11) and [A6.7.12](A6-views.md#A6.7.12).
  A source without the new fields looks everywhere as before.
- **Limits:**
  - a cleared field is removed from the source. In a tree from the research the clearing also goes through to the
    research ([S2.2.2](S2-edits-from-the-app.md#S2.2.2));
  - **Another entry from the same register** and **Another page** with fields are described in [A3.2.1](#A3.2.1);
  - GEDCOM: the book as `REPO` with `CALN`, one readable `PAGE` and Strom's own tags ([A2.6](A2-loading-a-family-tree.md#A2.6),
    [A2.7](A2-loading-a-family-tree.md#A2.7));
  - pag. and fol. and recto and verso (r/v) are not told apart separately: they are part of the text **Folio/page**.
- **Controls:** the source editor (**Edit source**, **Add source**): **Archive**, **Call number**, **Folio/page**,
  **Image**, **Other location**, **URL**; the proposal **From the location:** with **Use** and **Undo**.
- **Since:** app 3.27.0
- **From app 3.31.0:** for an image the research found from its registered scans, GEDCOM cuts no other image out of
  the location: it gets the whole location and the image from the field after it, when the location does not name it
  ([A2.6](A2-loading-a-family-tree.md#A2.6)).

<!-- zdroj: app:c3278633 src/types.ts Source.callNumber/folio/image (reference = další umístění), src/source-location.ts hasPlaceFields, recognizeLocation, locatorOverlap, composePage, sourcePlaceParts, sourcePlaceLine (short: imageShort), test/fixtures/source-locations.json (38 případů společných s výzkumem) · 9732853b src/ui/sources.ts:1269 (návrh sleduje psaní), :1363-1400 řádek pod poli (taken/conflict/proposal jen při prázdném foliu i snímku), :1429 Vrátit; prázdná pole odebrána · 2f4a9c2f prohlížeč (viewerBook/viewerEntry/viewerLocation/viewerNoUrl), Správa a výběr, bublina čipu, person-page.ts, book-blocks.ts, family-pages-html.ts · strings.ts sources.fieldRepository(Ph)/fieldCallNumber(Ph)/fieldFolio(Ph)/fieldImage(Ph)/fieldImageHelp/imageHelpLabel/fieldReference(Ph)/proposalFrom/proposalRest/proposalTake/proposalTaken/proposalUndo/conflictImage/conflictFolio/conflictFix/conflictFixEmpty/imageShort · spec 075 K1.1, rozhodnutí 1, 2, 5 · dirigent:prace/1111-app-citace-pole · 3.31.0: app:2e68d373 src/source-location.ts composePage (imageDerived) -->

<a id="A3.9.1"></a>
### A3.9.1 Split as suggested

The older locations of all sources can be split into fields at once: folio/page and image move to their own fields,
the rest stays in **Other location**. The code splits them, without an agent, and one step also undoes it.

- **Offer:** in **Actions → Sources** and above Table › Sources the line "The locations of 12 sources can be split into
  fields." with **Split as suggested…**. The window **Split locations into fields** shows a preview: **Source**,
  **Location before**, **Folio/page**, **Image**, **Other location**; first 6 sources, **Show all (n)** loads more on
  scroll. How many locations were not recognised ("… stay unchanged") stands under the preview, and under it up to
  three examples ("E.g. “Book N 7, entry without number”."), each once and at most 60 characters ("…").
- **Rule:** "A field that is already filled is not overwritten. A part the field states differently stays in the
  location." A value that stays has "· unchanged" in the preview. The note line "Call number: …" from an earlier GEDCOM
  import moves into the empty field **Call number** (the column **Call number** with "· from note").
- **Split (n)** changes all n sources in one step, also those the preview has not shown yet. The notice "n locations
  split." offers **Undo** for 8 seconds; Ctrl+Z (on a Mac ⌘Z) undoes it too. While the split is the last step,
  **Sources** say "Locations split on … (n sources)." with **Undo…** and the window opens with the row **Undo the split
  of …**. When nothing is left to split: "No other locations to split right now."
- **Tree from the research:** the research splits, only when it runs and can split
  ([R3.4.4](R3-verification-and-citation.md#R3.4.4)). The preview is the research's; **Split** asks it to split exactly
  what the preview showed, and the progress stays on the button until the research writes. The app then takes over the
  new version of the research by itself when only the locations of sources differ and nothing waits to be sent.
  **Undo** undoes the split via the research.
- **Limits:**
  - a tree from the research without the research running: in **Sources** only the sentence "Splitting locations works
    while the research is running.", in the Table nothing. The Strom archive, a read-only tree and a locked tree do
    not offer splitting;
  - sources changed in the meantime: "The sources changed in the meantime. The preview shows them as they are now.";
    the research busy with another task: "The research is busy with another task. Splitting works again in a moment."
    with **Try again**;
  - undoing is refused whole when a source changed after the split: it says how many and the first three, nothing is
    undone. In the app without the research, after a later change of the tree: "Undo is no longer possible: the tree
    changed since the split.";
  - an unrecognised location stays as it is. A source that already has a folio or an image in a field is not counted
    among the unrecognised: the rest of its location ("No. 5") is nothing to split. In a research tree the examples of
    unrecognised ones come from the research; when it sends none, the preview shows only the count.
- **Controls:** **Actions → Sources → Split as suggested…**; Table › Sources, the line above the table; **Split (n)**,
  **Undo**, **Undo…**. The research in the terminal: `strom source split` ([R3.4.4](R3-verification-and-citation.md#R3.4.4)).
- **Since:** app 3.27.0; a tree from the research with research 1.31.0

<!-- zdroj: app:8dd21adf src/source-split.ts SplitSourceKind (local/bridge/needsResearch/archive/none), localSplitPlan (řádek poznámky „Signatura:“ v každém jazyce importu), splitOffer (needsResearch jen v Prameny) · src/ui/source-split-ui.ts:37 TOAST_MS 8000, sourceSplitKind (read-only/zamčený → none, archiv → archive, most + feature sources.split → bridge) · 5a59f01d src/source-split-bridge.ts (GET/POST sources/split, undo), příklady nerozpoznaných přes most (unrecognizedExamples, výzkum ff760309) a lokální plán jako výzkum (zbytek u pole folia/snímku = nic, NFC, bez duplicit, nejvýš 3, ořez 60 znaků po grafémech): app:34cb5996 src/source-split.ts localSplitPlan, SPLIT_UNRECOGNIZED_EXAMPLES, src/source-split-bridge.ts examplesOf, src/ui/source-split-ui.ts:614, strings.ts sources.split.unrecEx · src/ui/misc.ts:1352 Ctrl/⌘+Z · strings.ts sources.split.* (offer, open, needsResearch, doneLine, undoOpen, title, lead, rule, sigNote, col*, kept, fromNote, all, shown, unrec, go, progress, toast, undo, undoRow, nothingLeft, errPlan, errBusy, retry, errUndoLater, errUndo) · spec 075 K4.2 · research:c4fe4fac -->
