<a id="A7"></a>
# A7 Book, pages and export

What the Strom app puts out of the tree (the family book, pages, files for the family and for other programs) and how
it protects living people in them. Describes the app 3.21.2.

| Output | What it is |
|---|---|
| **Family book** | a book to read from the start, to print on A4 or save as HTML ([A7.4](#A7.4)) |
| **Family pages**, **Tree pages** | a linked set of pages of family lines, families and people ([A7.5](#A7.5)) |
| **Person page** | the whole life of one person, to view, print and save as HTML ([A7.6](#A7.6)) |
| **App with data (HTML)** | a standalone file with the app and the tree ([A7.7](#A7.7)) |
| **Send to a relative** | one file by e-mail to open, complete and send back |
| **Poster** | the current view as SVG, PNG or a multi-page PDF |
| **Data backup (JSON)**, **GEDCOM**, **Person table (CSV)** | data for restoring and for other programs ([A2](A2-loading-a-family-tree.md)) |

<!-- zdroj: app:strings.ts importExport.app, importExport.share, importExport.poster, importExport.book, importExport.backup, importExport.gedcom, importExport.csv · src/ui/import-export.ts -->

<a id="A7.1"></a>
## A7.1 Who is a living person

The privacy of living people ([A7.2](#A7.2)) concerns only people the app considers living.

1. A person marked as deceased (**Deceased**) is deceased; a person whose data say "living" explicitly is living.
2. A person with a date of death is deceased.
3. Otherwise the person is living when fewer than 110 years have passed since their latest possible year of birth.
4. A person without a year of birth and without any other clue is living (the safe choice).

- The latest possible year of birth is taken from the person's own data and events, from a marriage (at least 14
  years before it) and from children (a parent is at least 12 years older than a child, across further
  generations).
- **Limits:** the mark † at a person in the tree is a different rule (presumed deceased after 120 years) and does
  not control privacy. A descendant's death alone does not mark an ancestor as deceased.
- **Controls:** the checkbox **Deceased** when editing a person; when a relative is added it is ticked by itself once
  a date or place of death is filled in.
- **Since:** app 1.2.0; ticking Deceased by itself app 3.21.2

<!-- zdroj: app:src/privacy.ts:215 ASSUMED_MAX_AGE, :217 MIN_PARENT_AGE, :219 MIN_MARRIAGE_AGE, :229 isLivingPerson, inferBirthUpperBounds · presumedDeceasedSet · strings.ts person.deceased · CHANGELOG.cs.md 3.21.2 -->

<a id="A7.2"></a>
## A7.2 Privacy of living people

Before an output from the tree, how to show living people is chosen. In the export and in the family book the option
is called **Privacy of living people**.

| Option | The name of a living person |
|---|---|
| **Full data** | unchanged, nothing is hidden |
| **Initials + birth year** | initials of the given name and surname, the year of birth stays; married surname only an initial |
| **Hide names** | "Living person", without a surname |
| **Keep surname only** | "Living person" and the surname |

- Every option except Full data removes from living people all dates and places, notes, stories, the photo, events,
  citations, attachments, name variants, titles, the married surname, the open question, REFN and the research's
  data. With Initials the year of birth stays.
- The couple's data (dates, place, note, witnesses, stories, events) disappear when at least one of the partners is
  living. Initials keep the year the union began.
- **Limits:** the structure always stays: people, relationships and sex. Deceased people do not change.
- **Sources:** in the export (App with data, JSON, GEDCOM) every option except Full data leaves out the source
  catalogue, citations and attachments **for all people, deceased too** (the app says so at the option). The family
  book, the pages and the person page take sources away only from living people; a source cited only for living
  people drops out.
- **Since:** app 1.2.0; sources of deceased people in the book and on the pages app 3.18.0

<!-- zdroj: app:src/privacy.ts applyPrivacy (keepDeceasedSources) · strings.ts privacy.label, privacy.modeFull, privacy.modeInitials, privacy.modeAnonymous, privacy.modeMinimal, privacy.livingPerson, privacy.dropsSources · book.dlg.privacy · CHANGELOG.cs.md 3.18.0 -->

<a id="A7.2.1"></a>
### A7.2.1 Default privacy by output

| Output | Default option |
|---|---|
| App with data (HTML) | Initials + birth year |
| GEDCOM | Initials + birth year |
| Send to a relative | Initials + birth year |
| Family book | Initials + birth year |
| Person page | Full data when there is no living person on the page; otherwise the last chosen, otherwise Initials |
| Person table (CSV), Export all trees | Full data |

- **Limits:** Family pages and Tree pages make no page of its own and no link for a protected person; in the index
  the person is under the protected name. When the choice contains living people and privacy is off, the dialog
  warns that the file will carry their names, dates and places.
- **Since:** app 1.2.0; person page app 3.18.0; family book app 3.19.0

<!-- zdroj: app:src/ui/import-export.ts (výchozí privacy podle formátu) · src/book-options.ts:55 · src/person-page.ts:94, :104 personPageExportPrivacy · src/family-pages.ts:309 · src/ui/share-ui.ts · strings.ts familyPages.privacyWarn -->

<a id="A7.3"></a>
## A7.3 Content of the file

In the export, next to privacy, the **Content** is chosen: what is saved into the file.

| Preset | Photos | Attachments and source clippings | Notes | Sources and citations |
|---|---|---|---|---|
| **Complete archive** | yes | yes | yes | yes |
| **Small file to send** | no | no | yes | yes |
| **Bare skeleton** | no | no | no | no |

- **Limits:** the structure of the tree and the names always stay. The research's workshop (queue, tasks, drafts of
  stories) never goes into an export. The privacy option can leave out sources and attachments even with Complete
  archive ([A7.2](#A7.2)).
- **Since:** app 2.4.0

<!-- zdroj: app:src/privacy.ts CONTENT_PRESETS, stripResearchWork · strings.ts privacy.contentLabel, privacy.presetComplete, privacy.presetSmall, privacy.presetSkeleton, privacy.dropsSourcesContent -->

<a id="A7.4"></a>
## A7.4 Family book

The family book is a book to read from the start: a family tree, families by generations, stories and sources.

- **What goes in the book:** **Whole tree** · **Family lines** (one or more) · **Ancestors of a person** ·
  **Descendants of a person** (the choice of people [A7.4.1](#A7.4.1)).
- **Parts of the book** in this order: **Contents**, **Family line tree**, **Families** (always), **Stories**, **Life
  chart and timeline**, **The times (history)**, **Sources**, **Record clippings and photos**, **Other families**,
  **Person index**.
- A part without content is left out and the dialog says why: Stories needs stories, the chart a level of detail
  other than brief, The times history, Sources cited sources, Clippings a photo or a clipping. Other families are only
  in the book of the whole tree.
- **Preset:** **For the family** (all parts, the usual level of detail, without notes and data for researchers) ·
  **For researchers** (full detail, notes, data for researchers: state of evidence and conflicts,
  [R3.8](R3-verification-and-citation.md#R3.8)) · **Custom**. The default is Whole tree, For the family, Initials +
  birth year and the language of the app.
- The **Title** is made from the choice (the tree's name, the family line, Ancestors: name, Descendants: name) and can
  be rewritten.
- **Book language** changes headings and labels; data from the tree are not translated.
- The options are remembered for each tree.
- **Controls:** export **Family book**; the book window: printing on A4 and **Save as HTML**.
- **Since:** app 3.19.0; the preset Custom app 3.21.0

<!-- zdroj: app:src/book-options.ts (části, předvolby, výchozí :55) · strings.ts book.dlg.kind, book.dlg.parts, book.dlg.preset, book.dlg.lang, book.parts, book.unavailable · CHANGELOG.cs.md 3.19.0, 3.21.0 -->

<a id="A7.4.1"></a>
### A7.4.1 Choice of people for the book and the pages

| Choice | People | Order |
|---|---|---|
| Whole tree | all people | by birth |
| Family lines | members of the family lines with their families, and the members' wives and husbands | a chapter for each family line |
| Ancestors of a person | ancestors up to the chosen number of generations and the unions the members come from | generation by generation, father before mother |
| Descendants of a person | descendants up to the chosen number of generations through sons and daughters, with partners and all unions | by birth |
| Selected people (pages only) | only the selected people; a family only when both partners are selected | – |

- **Limits:** the line of ancestors and descendants is carried by biological and adoptive parents. A step-parent and
  a foster parent do not carry the line. The father means the male parent, biological before adoptive.
- **Since:** app 3.19.0; Selected people app 3.21.0

<!-- zdroj: app:src/lineage.ts selection, :279 isDescentLink · strings.ts book.dlg.kind, book.dlg.kindHint -->

<a id="A7.5"></a>
## A7.5 Family pages and tree pages

The pages are a linked set of pages: the family line, families and people with links between them and with indexes
of people, families, surnames and towns.

- **Family pages:** one or more family lines ([A4](A4-surnames-and-families.md)).
- **Tree pages:** **Pages for the whole tree** (all family lines and Other families), **Selected people**, the
  ancestors of a person with a chosen number of generations.
- Privacy of living people and sources as in [A7.2](#A7.2); default Initials + birth year.
- **Since:** Family pages app 3.20.0; Tree pages app 3.21.0

<!-- zdroj: app:src/family-pages.ts · strings.ts familyPages.menuItem, familyPages.treePages, familyPages.treePagesAction, familyPages.indexTitle · spec 026 · CHANGELOG.cs.md 3.20.0, 3.21.0 -->

<a id="A7.6"></a>
## A7.6 Person page

The **Person page** shows the whole life of one person: dates in words, the family as a small family tree, stories,
the places of the life on a map, a life axis with history, clippings from registers and sources, and the section
**For researchers**.

- **Save as HTML** creates one self-contained file that opens offline in any browser. Groups of content and the
  privacy of living people can be chosen ([A7.2.1](#A7.2.1)); the choice is remembered.
- **Controls:** the menu of a person's card, **Person page**; also from the fan.
- **Since:** app 3.18.0

<!-- zdroj: app:src/person-page.ts · strings.ts personPage.save, fan.personPage · CHANGELOG.cs.md 3.18.0 -->

<a id="A7.7"></a>
## A7.7 Saved HTML (a standalone file)

**App with data (HTML)** saves the app and the tree into one file that opens in any browser without installation.
**Export as app** in **Export all trees** puts all trees into one file.

- Such a file has its own storage in the browser. It does **not synchronize** with the app on stromapp.info; changes
  are kept by **Save file** (downloads a copy) and are moved into the web app by an import (**From HTML file**).
- **Limits:** by default the file protects living people (Initials, [A7.2.1](#A7.2.1)).
- **Since:** app 1.0.0

<!-- zdroj: app:strings.ts importExport.app, importExport.appDesc, importExport.exportAllApp, importExport.fromHtml, embeddedMode.* · src/ui/import-export.ts -->
