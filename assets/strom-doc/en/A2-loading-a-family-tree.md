<a id="A2"></a>
# A2 Loading a family tree (GEDCOM)

The chapter says what the app takes over from a GEDCOM file from another program, what it skips and how it admits
this in the import summary. Describes the Strom app 3.21.2 (and the research 1.25.2); changes from a later version carry its number. Opening the research's file and linking a tree to the research belong to chapter S1. The whole path of a family tree
from another program (reliability marks, protection of the family tree's facts, the card **What next**, export back) is
described in [S6](S6-tree-from-another-program.md).

<a id="A2.1"></a>
## A2.1 What is loaded and what is not

The app takes over the people, families, sources, notes, events and media it knows. What it does not know it does not
carry over, but it admits it: each tag not carried over is counted in the tile **Unsupported** and named in the row
**Skipped records**. Nothing is lost silently at the level of a record or of a direct fact of a person, family and
source.

- **Limits:** unknown records (level 0) and unknown direct facts of a person, family and source (level 1) are
  counted. Unknown details deeper in a record (level 2 and below) are skipped without counting. Bookkeeping tags of
  other programs (`_UPD`, `RIN`, `_UID`, `CHAN`, `_PROJECT_GUID`, `_EXPORTED_FROM_SITE_ID`) are skipped silently; they
  say nothing about the family. The tags `ANCI`, `DESI`, `RFN`, `AFN` and `RESN` are counted. A number of facts
  without a place of their own in the app are not thrown away but written into the person's note as a labelled line:
  blessing, retirement, social standing, description, identification number, number of children, number of
  marriages, property, insurance number, a general fact and "Also known as". Strom's research blocks are not read from
  an ordinary file and are counted (see [A2.7](#A2.7)).
- **Controls:** **Import → Import GEDCOM** (a `.ged` file). In a new tree also the button on the empty tree. The
  summary see [A2.1.1](#A2.1.1).
- **Since:** app 1.9.0 (summary of tags not carried over); note lines from app 3.0.0.
- **From app 3.26.0:**
  - `_UID`, `RIN`, `AFN` and other program IDs (`UID`, `EXID`, `_FSFTID`) are not skipped: they are kept with the
    person and the family together with the original record identifier (`@I12@`) as program IDs
    ([S6.1](S6-tree-from-another-program.md#S6.1));
  - the program's own tags (`_XXX`) directly on a person, family and source are kept for the export **Back to
    {program}** ([S6.6](S6-tree-from-another-program.md#S6.6)); deeper own tags are counted;
  - MyHeritage photo cutouts (`_POSITION`, `_CUTOUT`) are bookkeeping and are not counted;
  - a divorce written before the marriage (PAF) is not lost and does not overwrite the marriage; an empty marriage or
    divorce written before another one with a date (MyHeritage) keeps the date and place of the dated one;
  - a name written as a description (`Son`, `Unknown`) comes back as it was written, with no note made of it; text on
    the line of a fact (education, burial, a custom event), an address in parts (`ADR1`, `CITY`…) and a web link in
    the text of a source stay and come back as the file had them.

<!-- zdroj: app:src/ged-parser.ts:1450 KNOWN_INDI_TAGS, :1453 KNOWN_FAM_TAGS, :1464 KNOWN_RECORD_TYPES, :1478 IGNORED_BOOKKEEPING_TAGS, :636 NOTED_INDI_TAGS, :2094 drop, :2410, :2486, :2194 · strings.ts gedcom.unsupported, gedcom.skippedTags, gedcomNotes.factLabels -->

<a id="A2.1.1"></a>
### A2.1.1 Import summary

After the conversion the window **GEDCOM conversion** opens. The tiles **People**, **Partnerships**, **Placeholders**
and **Unsupported** are always there; **Photos**, **Documents**, **Excerpts**, **Sources** and **Events** only with a
count above zero. The row **Skipped records** lists the tags from the most frequent ("`OBJE` ×12"). Further rows
report people with unknown sex and children recorded in more than one family. "Everything in the file was imported."
is shown only when nothing was skipped. Sex is not guessed from the role in the family; a value other than `M` or `F`
is unknown sex.

Options: **Import as a new tree** (the current tree stays), **Merge with existing** (see [A2.8](#A2.8)), **Save as
JSON**; from an empty tree also **Insert into tree**. The checkbox **Import images (excerpts, attachments, photos)**
shows an estimate of the size. Its default comes from **Settings → Load images when importing** and holds only for
this import. Without images, transcriptions, archives and page references stay. Paths and addresses of files are
offered for linking.

- **From app 3.22.0:** above the list of skipped tags there is a sentence saying what the tile **Unsupported**
  counts: parts of the file that Strom does not know and did not carry over, not people and relationships.
- **From app 3.26.0:**
  - the line “Kept for the export “Back to {program}”: N tags (…)” when the file has the program's own tags;
  - the row **Text encoding** for a file with a guessed or single-byte encoding ([A2.2](#A2.2));
  - after the import of another program's file, the card **What next** ([S6.4](S6-tree-from-another-program.md#S6.4));
    it replaces the earlier questions after an import;
  - **Insert into tree** first saves a backup of the tree ([S6.5](S6-tree-from-another-program.md#S6.5)).

<!-- zdroj: app:src/ui/import-export.ts:374 handleGedcomFile, :410 showGedcomResultDialog · app:src/ged-parser.ts:3880 statistiky convertToStrom, :3186 pohlaví · strings.ts gedcom.*, importImages.* -->

<a id="A2.2"></a>
## A2.2 Encoding and GEDCOM version

The app reads GEDCOM 5.5.1 and GEDCOM 7 and recognizes the encoding by itself. It always exports GEDCOM 5.5.1 in
UTF-8.

- **Limits:** the encoding is set first by a BOM mark (UTF-8, UTF-16 LE and BE). Without one the line `1 CHAR` in the
  header decides: `ANSEL` has its own conversion (an unknown byte shows as "�"), `UNICODE` is UTF-16, `ANSI` is
  Windows-1252, anything else UTF-8. Line ends CR, LF and CRLF are equal. The continuations `CONC` and `CONT` are
  joined; for places, names, pages, addresses and notes a space at the start of a continuation is kept too. From
  GEDCOM 7, `SNOTE` is read as a shared note, and records without an identifier are read. Standalone media records
  `0 @O1@ OBJE` are not read and are counted in **Unsupported**; an image referenced only by a pointer therefore does
  not arrive. A GEDZIP package is not loaded; the window accepts only `.ged`.
- **Controls:** none; the encoding is not chosen.
- **Since:** app 1.16.0 (ANSEL conversion and encoding by the header).
- **From app 3.22.0:** the GEDCOM 7 tags `UID`, `CREA` and `EXID` are skipped silently as bookkeeping data; in
  3.21.2 they are counted in **Unsupported**.
- **From app 3.26.0:**
  - `CHAR CP1250` or `WINDOWS-1250` is Windows-1250. `ANSI` means the code page of the computer that wrote the file:
    valid UTF-8 stays UTF-8, otherwise the words of the file decide between Windows-1250 (Central Europe: č ř ě ł ż)
    and Windows-1252 (Western Europe). A file without `CHAR` and a file with `CHAR UTF-8` that is not valid UTF-8 are
    guessed the same way;
  - when the encoding was guessed or is single-byte and the file has text with diacritics, the import summary shows
    the row **Text encoding** with **Names:** and a choice of another encoding (**UTF-8**, **Windows-1250 (Central
    Europe)**, **Windows-1252 (Western Europe)**, **ISO-8859-2 (Latin-2)**, **ANSEL (older GEDCOM)**). Garbled
    letters in the names (è instead of č, ø instead of ř) mean that another encoding fits. **Controls:** the choice
    in the row **Text encoding**;
  - standalone media records `0 @O1@ OBJE` are read through the references to them; a family photo referenced this
    way is only counted.

<!-- zdroj: app:src/ged-parser.ts:1262 decodeGedcomFile, :1236 decodeAnsel, :1290–1380 předzpracování CONC/CONT, :1683 parseGedcom · app:src/ged-exporter.ts:508 exportToGedcom · index.html input accept=".ged" -->

<a id="A2.3"></a>
## A2.3 Given names and surnames

The given name and surname are taken from the subtags `GIVN` and `SURN`, otherwise from the line `NAME` by the
slashes. Titles from `NPFX` and `NSFX` are kept separately and removed from the line; without these tags a title is
not guessed. The rules are the same as in the research.

- **Limits:** without slashes the line is split at the first space. Text after the closing slash belongs to the
  surname. Entries such as "N.N.", "neznámý", "unknown", "nieznany" give the name "?". Descriptions instead of a name
  ("syn", "dcera", "mrtvě narozený", "totgeboren", "filius", text in brackets) give "?" and the words go into the
  person's note. Further `NAME` lines are variants. A name with `TYPE married` or `_MARNM` is the married surname, not
  a variant; the last such one wins. When the married name comes first and the birth name only later, they are
  swapped. `2 _STROM_PRIMARY Y` marks the name the person goes by. A person without a given name and surname is a
  placeholder person (tile **Placeholders**). Groups of surname variants and family lines are covered by
  [A4](A4-surnames-and-families.md).
- **Controls:** none; the result is edited in the person's card.
- **Since:** app 3.10.0 (titles), 3.13.0 (married surname), 3.18.0 (`_STROM_PRIMARY`).

<!-- zdroj: app:src/gedcom-names.ts:197 readGedcomName, :114 splitNameLine, :85 noName, :96 notAName, :260 stripTitles · app:src/ged-parser.ts:1404 readMarriedSurname, :2250 varianty, :2955 prohození TYPE -->

<a id="A2.4"></a>
## A2.4 Dates and their forms

GEDCOM dates are converted to the app's form: `3 JUN 1900` to a day, `JUN 1900` to a month, `1900` to a year. An
estimate (`ABT`, `EST`, `CAL`, `INT`) is "about", `BEF` "before", `AFT` "after", `BET … AND` and `FROM … TO` a range.
What does not fit the form stays in the person's note; nothing is thrown away.

- **Limits:** a double year (1699/00) keeps the first year. A calendar other than the Gregorian is removed and the
  note says "Date in the Julian calendar: …" (also Hebrew, French revolutionary, Roman). Text in brackets is kept as
  "Date in the record: …". An unknown month leaves only the year, with a note. Words in Czech, Slovak, Polish, German,
  Russian and Ukrainian ("po", "před", "kolem", "mezi … a", "nach", "około") are read as tags only when a valid date
  follows them; "po válce" stays text. The age at an event (`AGE`) is written as "61 years", `INFANT` as "infant". A
  form of date that the app would write differently (e.g. `EST` or `CAL`) is remembered at the person and the
  relationship. The export returns it in its original form as long as the date does not change.
- **Controls:** none.
- **Since:** app 3.0.0 (notes on dates), 3.7.0 (words of languages), 3.17.0 (kept forms).

<!-- zdroj: app:src/gedcom-date-read.ts:22 parseGedcomDate, :33 gedcomDatePhrase, :55 readGedcomDate · app:src/date-words.ts · app:src/ged-parser.ts:702 kalendář, :1157 gedcomDates · app:src/gedcom-date-form.ts · strings.ts gedcomNotes.datePhrase -->

<a id="A2.5"></a>
## A2.5 Relationships and the status of a couple

A family (`FAM`) gives the relationship of two partners and their children. The status of the couple is set by
marriages and divorces in the order of the file; dated events are compared by date. The tag `_STAT` takes precedence
over events.

- **Limits:** `_STAT` knows the values married, divorced, separated and unmarried partners (in English `married`,
  `divorced`, `separated`, `partners`, `unmarried`, `cohabiting` etc.). A divorce and a new marriage of the same
  couple give a note "Divorce …, new marriage …". The same couple in two families is joined. A third partner in one
  family is not carried over and is counted. A family with one parent gets a placeholder second parent "?". A family
  without children and without a parent stays only when it says something (a marriage, a date, a source, a note). A
  child recorded in more than one family is shown in the birth family; the others are written into a note ("Also
  recorded as an adopted child of …"). Adoption and fostering are read from `PEDI` and more precisely from `_FREL` and
  `_MREL`. The export writes `_STAT` only for unmarried and separated couples.
- **Controls:** none; the status is edited in the relationship in the person's card.
- **Since:** app 3.0.0 (`_STAT`), 1.16.0 (a child in more than one family), 3.8.0 (further events of a couple).
- **From app 3.22.0:** `_RELATIONSHIP_STATUS` is read too; in 3.21.2 it is counted in **Unsupported**. The values of
  both tags are recognized in Czech, Polish and German too ("manželé", "rozvedeni", "druh a družka", "rozwiedzeni",
  "Lebensgemeinschaft"). An unknown value is counted in **Unsupported**. When a family has both tags, `_STAT` wins.

<!-- zdroj: app:src/ged-parser.ts:1496 resolveUnionStatus, :1545 statusFromStat, :1563 přednost _STAT, :3453 dítě ve více rodinách, :2684 PEDI · app:src/ged-exporter.ts:70 GEDCOM_STAT · strings.ts gedcom.otherFamilyLinks -->

<a id="A2.6"></a>
## A2.6 Sources, citations and QUAY

A source record (`SOUR`) gives a source of the app: title, archive, call number, transcription (`TEXT`), link and
excerpts. A citation at a birth and a death proves the person's birth and death, a citation at a person the person, a
citation at a family the couple. The rating `QUAY` is shown as **Source reliability**: 3 is **Original**, 2 **Copy /
index**, 1 and 0 **Uncertain**.

- **Limits:** without `TITL` the abbreviation `ABBR` is taken, otherwise "?". Publisher, author and the call number in
  the archive go into the source's note. A citation with a page (`PAGE`) other than the source's creates a derived
  source for that page with the same title and archive; transcription and excerpts do not pass to it. The record's
  `QUAY` takes precedence over the citation's `QUAY`, and for each source the first citation holds. `DATA` and `TEXT`
  inside a citation are not read. Every image at a source is an excerpt. The app does not change certainty from
  another program. How the research takes `QUAY` over as the form and information of a source is said by
  [R3.2.1](R3-verification-and-citation.md#R3.2.1); when a fact is proven, by
  [R3.8](R3-verification-and-citation.md#R3.8). Sources in the app are described in [A3](A3-evidence-in-the-app.md).
- **Controls:** **Source reliability** in the source's detail (**Original**, **Copy / index**, **Uncertain**).
- **Since:** app 1.9.4 (`QUAY`), 3.9.0 (derived source for a page).
- **From app 3.22.0:** the person's story (`_STORY`) also reads and exports references to sources.

<!-- zdroj: app:src/ged-parser.ts:2140–2230 záznam SOUR, :1700 noteQuay, :3010–3055 citace a odvozené prameny, :3099–3140 převod pramenů · app:src/ui/sources.ts:75 qualityLabel · app:src/ged-exporter.ts pushCitation · strings.ts gedcom.quality1–3, gedcom.reliabilityLabel · research:src/sync.ts:4660 QUAY_EVIDENCE -->

<a id="A2.7"></a>
## A2.7 Strom's own tags and what comes back

The app's export writes its own tags with the prefix `_STROM`, so that what GEDCOM 5.5.1 cannot hold comes back on a
new load. The header `1 SOUR STROM` says that Strom wrote the file.

- **Limits:** on export and a new load these come back: the married surname (as a second `NAME` with `TYPE
  married`), the name the person goes by, family lines, groups of surname variants, the person's questions and
  stories, the state of facts, the kind and fingerprint of images, the verification of a transcription
  (`_STROM_VERIFIED`), the reading of a record, excerpts with cropping, families without a couple
  (`_STROM_NO_COUPLE`), a child's relationship to the parents, and witnesses. These do not come back from an export:
  who read a transcription (`_STROM_READ`), an image left out because of its size, and place records. Research blocks
  (conflicts, hypotheses, searches, links, islands, drafts) are read only from the research's file, and the app's
  export does not write them. A file without Strom's header is read without its conventions: descriptions instead of
  a name go into the note ([A2.3](#A2.3)). The lines in the header that link to the research (`_STROM_TREE` etc.) are
  covered by S1 and S2.
- **Controls:** **Export → Export GEDCOM**.
- **Since:** app 3.9.0 or earlier (single tags were added up to 3.19.0).
- **From app 3.26.0:** program IDs come back under `_STROM_IMPORT` and `_STROM_XID`; on a new load the file is paired
  by them ([S6.7](S6-tree-from-another-program.md#S6.7)). A file with Strom's header is not a family tree from another
  program: it has no mark **From family tree** and no card **What next**.

<!-- zdroj: app:src/ged-exporter.ts:506 STROM_SEX_U_LINE, :508 exportToGedcom, :680 TYPE married · app:src/ged-parser.ts:2174 _STROM_VERIFIED/_STROM_READ, :2324 výzkumné bloky, :2574 _DRAFT, :2654 _STROM_STATUS, :1914 _STROM_PLACE · app:src/research-link.ts:2936 researchHeaderLines -->

<a id="A2.8"></a>
## A2.8 Repeated import and merging

Each import as a new tree creates a new tree; the old trees do not change. **Merge with existing** pairs the people
from the file with the people of the current tree and saves the result as yet another new tree
([A8](A8-merging-trees.md)).

- **Limits:** a repeated import of the research's file into the research's tree is covered by
  [S1](S1-connecting-app-and-research.md).
- **Controls:** **Import → Import GEDCOM → Import as a new tree** or **Merge with existing**.
- **Since:** app 1.0.0
- **From app 3.26.0:** a family tree of the same program loaded again is also paired by program ID (reason **Same ID
  in the file**); a match of 50–79 is only offered ([S6.7](S6-tree-from-another-program.md#S6.7)).

<!-- zdroj: app:src/merge/ui.ts:1447 TreeManager.createTree · strings.ts treeManager.importAsNewTree, importDialog.mergeExisting -->
