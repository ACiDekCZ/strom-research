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

- Fields: **Title** (required), **Repository**, **Reference**, **URL**, **Note**. Under **More: transcript, record
  date, reliability** are **Transcript of the entry**, **Record date** and **Reliability**. The section is open when
  one of them is filled in.
- **Record date** says when the entry was made. It can differ from the date of the event, e.g. a baptism recorded
  later.
- **Reliability** has three levels: **Original**, **Copy / index**, **Uncertain**. A second click on the chosen level
  cancels it. It rates one source, not a fact. How the research takes it is described in
  [R3.2.1](R3-verification-and-citation.md#R3.2.1).
- **Limits:** a source without a title cannot be saved ("Enter a source title"). An invalid **Record date** is not
  saved. The reliability value 0 from a GEDCOM import is shown as **Uncertain** and stays until another level is
  chosen. Deleting a source removes all its citations; the app asks first and says in how many places it is cited.
- **Controls:** **Actions → Sources** (the tree's list of sources with the number of citations "n×", search from 11
  sources, sorting by title); **Edit source**, **Add source**. The item **Sources** in the **Actions** menu is only in
  a tree that can be edited, and only when some source already exists or **Settings → Person card → Advanced fields**
  is on.
- **Since:** app 1.4.0; **Reliability** and **Record date** 3.1.0

<!-- zdroj: app:src/types.ts Source · src/ui/sources.ts:214 renderSourcesList, :327 deleteSource, :531 fillSourceEditor, :576 wireSourceEditor, :667 renderQualityControl, :733 saveSourceFromModal · src/ui/tree-management.ts:675 isSourcesMenuOffered · src/settings.ts:320 isAdvancedFields · strings.ts sources.titleHint/fieldTitle/fieldRepository/fieldReference/fieldUrl/fieldNote/more/fieldTranscript/fieldRecordDate/recordDateHint/fieldQuality/quality1-3/titleRequired/citations/deleteConfirm, advanced.settingLabel -->

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
- **Another entry from the same register** (source viewer and editor): a new source with the same repository,
  reference and link; opened from a citation chip, it is cited right there.
- **Since:** app 3.1.0 (**Recently used**, **Another entry from the same register**); **Another page** 3.9.0

<!-- zdroj: app:src/ui/sources.ts:1427 renderSourcePickerList, :322 sourceMatches, :1475 currentCitationSourceIds, :1505 noteRecentSource, :1526 otherPageFromPicker, :1554 createSourceFromPicker, :1569 suggestedSourceTitle, :1181 startSameBookEntry · src/settings.ts:12 RECENT_SOURCES_MAX · strings.ts sources.pickTitle/searchPlaceholder/recent/all/createNew/newTitleMarriage/otherPage/otherPageTitle/sameBook -->

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
  in research · n** and are loaded from the running research.
- **Controls:** the source editor, block **Excerpt of the entry**; **Add continuation from the next page**; **Crop**,
  **Replace**, **Remove excerpt**. "Excerpts: …" in **Actions → Sources** shows the size of all excerpts from 1 MB.
- **Since:** app 3.1.0; **Full quality** 3.4.0; **Image in research** 3.14.0

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

<!-- zdroj: app:src/person-sources.ts:54 personSourceRows · src/ui/person-sources-ui.ts:114 canCiteOnPerson, :120 showPersonSourcesDialog, :187 find hidden · src/ui/context-menu.ts:191-203 readItems · src/ui/research-actions-ui.ts:1173 personFindSourceUrl · strings.ts personSources.*, research.findSource · src/story-sources.ts storyBasisSourceIds, storyFactText, storyBasisDetailsHtml · src/ui/person-page.ts:1738 storyBasisHtml · strings.ts storyBasis, basisSources, basisFacts, authorNote · CHANGELOG.cs.md 3.22.0 -->

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
- When nothing is missing: "Everyone has a source and parents." The row **Evidence in the tree (● ◐ ○ on cards)**
  switches the cards to marks of the level of evidence ([R3.8.1](R3-verification-and-citation.md#R3.8.1)).
- While highlighting: **Next person ›**, **Cite** (for groups without a source) and × **End highlighting**. The order
  is by generation, then by name. At the end: "Done, no one left in this selection."
- **Limits:** for a birth the research assesses, the button **Sources** is there instead of **Cite**. Another citation
  does not prove the fact; the research decides. **Cite** is missing in a read-only tree and for a locked person. The
  check of the tree as a whole is described in [A5](A5-tree-check.md).
- **Controls:** **Tree overview → Data quality → Where evidence is missing → Show in the tree** (from another tree
  **Open tree and show**).
- **Since:** app 3.4.0; **Births not proven in the research** and **Sources** instead of **Cite** 3.13.1

<!-- zdroj: app:src/stats.ts:185-240 computeEvidenceGaps · src/ui/evidence-ui.ts:81 walkOrder, :325-358 pill · src/tree-overview.ts:215 birthResearchStatus · src/ui/tree-overview.ts:1946-1975 · strings.ts treeOverview.evidenceTitle/evNoSource/evBirthNoSource/evBirthUnproven/evLineEnds/evOfTotal/evOfAncestors/evAllGood/evLevels, treeHealth.citeAction/sourcesAction/next/highlightDone/highlightEnd -->
