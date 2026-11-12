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

<!-- zdroj: app:src/research-sync.ts:357 researchReadSource, :365 isOlderSource, :377 verifiedOffer, :385 unverifiedOlderSources · src/ui/sources.ts:618 renderSourceReading, :658 sourceVerifiedValue, :296 renderSourcesFilter, :377 renderSourceViewer · strings.ts sources.verified/verifiedHintGuide/verifiedHintOlder/verifiedByTree/readBy/userReadingNote/filterUnverified · překlad (od 3.24.0): src/source-translation.ts SOURCE_TRANSLATION_LABELS, splitSourceTranslation · strings.ts viewerTranslation, translation · commit c2942b0 -->

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

<!-- zdroj: app:src/attachments.ts:12-18 ATTACHMENT_MAX_SIDE, ATTACHMENT_QUALITY, MAX_PDF_BYTES, ATTACHMENT_WARN_BYTES · src/ui/attachments-ui.ts:28-31 ORIGINAL_ONLY_TYPES/needsOriginalOnly, :161 accept, :211 addAttachmentFile · strings.ts attachments.*, media.originalOnlyMeta/originalOnlyNeedsResearch, treeOverview.mediaWarning -->

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

A material is a file sent to the research for a person or a source: a letter, a photo, a copy from an archive. Nothing
is added to the tree. The research stores the files and makes a task for the agent from them.

- **Send material…** (at a person) and **Send material for this source…** (source viewer and editor): at most 20 files
  at once and **Note for the research**. A whole folder is sent by **Add materials…** in the research menu
  ([S4](S4-research-from-the-app.md)).
- **Also add as an attachment in the tree** (only at a person): the tree also gets a preview, as with an attachment.
- When the research is not running, the files wait in the browser. When the research does not know the person yet,
  they are sent after the next sending of the tree.
- The section **Materials** when editing a person, **Materials** in the person menu and the window **All materials ›**
  show the tree's attachments and the research's files together. The same file is shown once.
- **Limits:** only on a computer, in a tree connected to a research that accepts originals. The research never accepts
  programs, keys, archives or family tree files (GEDCOM). Assigning and hiding a material works only with the research
  running. With a Strom archive the material is stored in the archive; **Also save to the tree** adds images and PDFs
  up to 2 MB to the tree too.
- **Controls:** see above.
- **Since:** app 3.9.0; the section and window **Materials** 3.16.0

<!-- zdroj: app:src/ui/material-ui.ts:30-33 MATERIAL_MAX_FILES, MATERIAL_NOTE_MAX, REFUSED_EXT, :38 materialAccepted, :51 alsoTreeEligible, :71 materialAvailable · src/materials.ts:477 personMaterials, :519-529 gates · src/ui/originals-ui.ts:269 · src/ui/research-actions-ui.ts:357 batch · strings.ts material.*, materials.*, batch.menu -->

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

<!-- zdroj: app:c3278633 src/types.ts Source.callNumber/folio/image (reference = další umístění), src/source-location.ts hasPlaceFields, recognizeLocation, locatorOverlap, composePage, sourcePlaceParts, sourcePlaceLine (short: imageShort), test/fixtures/source-locations.json (38 případů společných s výzkumem) · 9732853b src/ui/sources.ts:1269 (návrh sleduje psaní), :1363-1400 řádek pod poli (taken/conflict/proposal jen při prázdném foliu i snímku), :1429 Vrátit; prázdná pole odebrána · 2f4a9c2f prohlížeč (viewerBook/viewerEntry/viewerLocation/viewerNoUrl), Správa a výběr, bublina čipu, person-page.ts, book-blocks.ts, family-pages-html.ts · strings.ts sources.fieldRepository(Ph)/fieldCallNumber(Ph)/fieldFolio(Ph)/fieldImage(Ph)/fieldImageHelp/imageHelpLabel/fieldReference(Ph)/proposalFrom/proposalRest/proposalTake/proposalTaken/proposalUndo/conflictImage/conflictFolio/conflictFix/conflictFixEmpty/imageShort · spec 075 K1.1, rozhodnutí 1, 2, 5 · dirigent:prace/1111-app-citace-pole -->

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
