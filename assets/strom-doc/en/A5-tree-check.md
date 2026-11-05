<a id="A5"></a>
# A5 Tree check

What the app watches in a tree, with what thresholds, and what can be done with a finding: fix it, mark it **Not an
error**, or let the research assess it. Describes the Strom app 3.21.2 (and the research 1.25.2).
The research has its own check `strom check` ([R5](R5-conflicts.md)). It is not described here, except where the two
agree.

<a id="A5.1"></a>
## A5.1 The check and its findings

The app checks the whole tree every time the check is opened. Nothing is saved and the tree does not change.
Each finding has a severity:

| Severity | Section in the dialog | Meaning |
|---|---|---|
| error | **Problems** | the data contradict each other or are broken ([A5.2](#A5.2), [A5.3](#A5.3), [A5.4](#A5.4)) |
| warning | **Problems** | unlikely but possible |
| info | **Leads** | "Not errors. Leads that may help the research." ([A5.5](#A5.5), [A5.6](#A5.6)) |

- **Limits:**
  - Findings of the same kind form a group, sorted by severity, size and name. Only a group with an error is open.
    Over 50 findings, more are shown 20 at a time. On a phone (up to 640 px) **Leads** are collapsed when there are
    **Problems** too.
  - Placeholder persons are not reported. A finding marked **Not an error** ([A5.7](#A5.7)) is neither counted nor
    shown.
  - A read-only tree only shows findings. For a tree other than the open one, a fix or a mark opens the tree first.
- **Controls:** the dialog **Tree validation**: **Tree overview → Data quality → Quick actions → Validation details**,
  the row "n leads ›" in **Consistency** (opens **Leads** directly), the card with errors in **Where to focus**.
  After a GEDCOM import the app asks ("Data check") only when it finds errors or warnings
  ([A2](A2-loading-a-family-tree.md)).
  The same after a merge with another tree, for new findings. The check has no menu item of its own.
- **Since:** app 1.0.0; the sections **Problems** and **Leads** app 3.17.0

<!-- zdroj: app:src/validation.ts:83 validateTreeData, :1370 groupValidationIssues · src/ui/tree-stats.ts:101 LONG_GROUP, :148 showTreeValidationDialog · src/ui/import-export.ts:1341 offerPostImportValidation · src/ui/merge/ui.ts:1515 · strings.ts treeManager.validationTitle, valProblems, valLeads, leadsIntro, valReadOnly, valShowMore, postImportCheck -->

<a id="A5.1.1"></a>
### A5.1.1 One-click fix

Some findings have a button **Fix** and the group **Fix all (n)**. A fix is one step back ("fix from validation") and
is written into the change history.

| Finding | What the fix does |
|---|---|
| Reference to a non-existent record, a participant without a person | removes the reference |
| A parent without a reference to the child, a child to the parent, a person to the partnership | adds the missing reference (parents only to a child with fewer than 2 parents) |
| Self-partnership | removes it |
| Duplicate partnership | keeps the first, moves the children to it |
| One place written several ways | rewrites all spellings to the most frequent one |

- **Since:** app 1.1.0; fixing places 1.10.0

<!-- zdroj: app:src/data.ts:4071 FIXABLE_TYPES, :4097 repairValidationIssue · strings.ts treeManager.valFix, valFixAll -->

<a id="A5.2"></a>
## A5.2 Family links

The check looks for links that cannot hold. All are errors, except a duplicate partnership (warning).

| Finding in the app | When |
|---|---|
| **Ancestor cycle detected** | a person is their own ancestor; only the first cycle is reported |
| **Self-partnership** / **Duplicate partnership** | the partner is the same person / two partnerships of the same couple |
| **Parent missing child reference**, **Child missing parent reference**, **Partnership child mismatch** | the link is recorded from one side only |
| **Reference to non-existent record** | a parent, child, partner or partnership is missing |
| **Event participant links to a person who no longer exists** | a godparent or witness (also a marriage witness) is a deleted person |
| **More than 2 parents** | |
| **Person at multiple generations** | counting generations runs into a contradiction; a partner is in the same generation |
| **Partner is also parent / child**, **Sibling is also parent / child** | |

- **Since:** app 1.0.0; event participant 1.16.0

<!-- zdroj: app:src/validation.ts:142 checkCycles, :200, :223, :255, :293, :346-464 orphaned*, :471 tooManyParents, :554 generationConflict, :621 · strings.ts treeManager.val* -->

<a id="A5.3"></a>
## A5.3 Dates and age

The check reports only what certainly does not hold. It counts an incomplete or approximate date over its whole
possible range: without a month January to December, "about" ± 2 years, "before" up to 20 years earlier, "after" up to
20 years later, a range up to its end. Only when the violation holds over the whole range is it a finding.

| Finding in the app | Severity | When |
|---|---|---|
| **Death date is before birth date** | error | |
| **Implausibly long lifespan** | warning | more than 115 years |
| **Parent younger than child** | error | by date of birth |
| **Parent very young / very old at birth** | warning | under 12 / over 80 years; birth dates only |
| **Event dated before birth** | warning | |
| **Event dated after death** | warning | except: Burial, Cremation, Will, Probate |
| **Child born after the mother's death** | error | more than 1 month after the death; own parents only |
| **Child born long after the father's death** (… **a parent's**, sex unknown) | warning | more than 10 months |
| **Wedding dated before a partner's birth** | error | |
| **Wedding dated after a partner's death** | warning | |
| **Married as a child** | warning | under 14 years |
| **Extreme age difference between partners** | info (**Leads**) | 40 years and more |
| **Birth/death recorded as a life event** | error | birth or death in the list of events |
| **Custom event has no label** / **Event has an invalid date** | warning | |

- **Limits:** the research's `strom check` has the same exceptions after death. A parent without a type of
  relationship counts as biological.
- **Since:** app 1.0.0 (age of parents); 1.4.0 (events); 1.7.0 (dates and death); a child after the death of a parent
  of unknown sex 3.10.0; four exceptions after death 3.17.0 (before only burial)

<!-- zdroj: app:src/validation.ts:493 checkAgePlausibility MIN_PARENT_AGE MAX_PARENT_AGE, :863 checkDateConsistency MAX_LIFESPAN_YEARS CHILD_MARRIAGE_YEARS PARTNER_AGE_GAP_YEARS POSTHUMOUS_FATHER_MONTHS AFTER_DEATH_EVENT_TYPES, :120 checkLifeEvents · monthRange, certainlyBefore · research:src/core/afterdeath.ts AFTER_BY_NATURE · strings.ts treeManager.val* -->

<a id="A5.4"></a>
## A5.4 Sources, attachments and merges on import

| Finding in the app | Severity | When |
|---|---|---|
| **Citation points to a missing source** | warning | a citation at a person, event, partnership or attachment |
| **Attachment has no usable data** | warning | the data are neither an image nor a PDF (an attachment with an original only is not reported) |
| **Photo is not a supported image** | warning | a format other than JPEG, PNG, WebP, GIF |
| Two people probably merged into one when a GEDCOM file was imported (Strom 3.8.1 and older) … | error | see below |

Older versions could give two people the same ID on import. The check reports it on a clear sign (more than 2 parents,
a person who is their own parent, child or partner), or when a child is born less than 12 years after a parent and in
addition there are parents or a partner of the same sex. Parents of the same sex alone do not give a finding. The
remedy is in the text of the finding: import the original file again as a new tree.

- **Since:** app 1.7.0 (sources and attachments); 3.0.0 (photos); 3.9.0 (merges on import)

<!-- zdroj: app:src/validation.ts:982 checkSourceIntegrity, checkPhotoData, :1199 checkImportMerges · strings.ts treeManager.valCitationMissingSource, valAttachmentNoData, valPhotoUnsafeData, valImportMerge -->

<a id="A5.5"></a>
## A5.5 Leads: godparents and spellings of places

**Leads** are not errors. They show where there may be kinship or an inconsistent spelling.

- **A godparent who keeps turning up — often a relative:** the same godparent or witness is at the events of at least
  2 people who are not related to each other, and those people belong to at least 2 groups of siblings. The row
  shows at how many events and people. Example: Marie Vlková is godmother to the Horák children and to the children of
  their neighbours.
- **One place written several ways:** spellings that differ only in upper and lower case, diacritics, or a full stop
  or comma, e.g. "Brno" and "brno.". The row shows each spelling with a count; the fix is in [A5.1.1](#A5.1.1).
- **Limits:** relatives are people at most 3 steps apart through parents, children and partners. Counted are the
  participants of a person's events, marriage witnesses and the participants of a couple's shared events. **Leads**
  also hold the age difference of partners ([A5.3](#A5.3)).
- **Since:** app 1.10.0 (places); 1.16.0 (godparents); groups of siblings and officials 3.17.0

<!-- zdroj: app:src/godparents.ts:42 RECURRING_THRESHOLD, :188 recurringParticipants, :270 siblingGroupCount, :300 godparentLeads · src/validation.ts:1034 checkPlaceSpellings, checkRecurringGodparents · strings.ts treeManager.valRecurringGodparent, valRecurringGodparentDetail, valPlaceSpelling, leadsSkipped -->

<a id="A5.5.1"></a>
### A5.5.1 How the same godparent is recognised

- A person linked to the tree is recognised by the record. A name that is only written is compared as text; the row
  then has "matched by name".
- From the entry the name is taken up to the first comma, lower-case letter or digit. Titles and forms of address
  (godfather, Mr., Mgr. …) are left out, particles (von, de …) stay, text in brackets is a note. Comparison ignores
  diacritics and upper and lower case.
- The name must have at least 2 words. A given name alone never matches.
- Whoever is at the event by office is not reported: the officiant, the midwife and the clergy (parish priest,
  chaplain, Pfarrer, parochus …). A cleric recorded as a godparent is reported.

<!-- zdroj: app:src/godparents.ts:48 NAME_PARTICLES, :54 NAME_PREFIXES, :80 participantName, :117 CLERGY_WORDS, :121 MIDWIFE_WORDS, :134 attendsByOffice · strings.ts treeManager.valRecurringGodparentByName -->

<a id="A5.6"></a>
## A5.6 Possible duplicate person

Two people may be the same when they have the same surname and the same given name and were born in the same years.
Comparison ignores upper and lower case and diacritics. The finding is in **Leads** in the group **Possible duplicate
person**.

- **Limits:**
  - Year of birth: the date of birth; without it the baptism (the year of baptism or the year before it); without it
    the death or burial with the age at death. When both years come from births, they must overlap. Otherwise they
    may be 2 years apart.
  - When one person lacks a given name, the surname and the years are enough.
  - People without a date are paired only with exactly the same name. A person with a date is not paired with a
    person without one.
  - Not reported: placeholder and unnamed persons, incompatible sex, parent and child, and pairs where one person
    certainly died before the other's birth (or baptism).
- **Controls:** **Two different people** ([A5.7](#A5.7)); at a verdict of the research **Merge…**
  ([A5.6.1](#A5.6.1)).
- **Since:** app 1.9.9; years from baptism and death 3.17.0

<!-- zdroj: app:src/validation.ts:1084 birthYears, :1127 checkPossibleDuplicates STAND_IN_YEARS_SLACK · strings.ts treeManager.valGroupPossibleDuplicate, twoPeople -->

<a id="A5.6.1"></a>
### A5.6.1 The research's verdict

For a tree from the research, the app asks the research about all pairs when the dialog opens. The dialog does not
wait for the answer. The research assesses only people who have its number (P…). The first rule that applies decides:

| Order | The research found | Verdict in the app |
|---|---|---|
| 1 | it does not know the person | none |
| 2 | it has already merged the people | **Merged in the research** |
| 3–9 | two people marked by a person; different sex; parent and child; birth or baptism more than 3 years apart; one died before the other was born; siblings (the second child was given the name of the one who died); different parents | **Two people** |
| 10 | the names differ in the research | **Uncertain** |
| 11–12 | the same parents and known years; the same entry in a source for both | **Probably the same person** |
| 13–14 | close years and nothing more; no date for one person | **Uncertain** |

- **Limits:**
  - Pairs with the verdict **Probably the same person** and **Merged in the research** go to the top, then
    **Uncertain**, then those without a verdict.
  - Pairs **Two people** go aside into the row **Told apart by the research: n** and are not counted.
  - A verdict that arrives into an open group only adds a label. It is re-sorted at the next opening.
  - Under the group is **The research is assessing…** or **Assessed by the research**. When the research that assessed
    at the last connection is not running: "Not assessed by the research – the research is not running." A research
    that cannot assess is not mentioned.
- **Controls:** at a verdict **Merge…** (merging people) or **Load the new version** · terminal:
  `strom person compare P… P…`, for many pairs `--pairs-from`. Connection with the research:
  [S1](S1-connecting-app-and-research.md).
- **Since:** app 3.17.0 (research 1.22.0)

<!-- zdroj: app:src/duplicate-verdicts.ts:18 MAX_JUDGE_PAIRS, :54 issueResearchPair, :142 verdictRank, :154 verdictsMode, :192 verdictReasonText · src/quality-bridge.ts:172 postDuplicates · strings.ts treeManager.verdict*, reason* · research:src/core/duplicates.ts judge YEARS_CLOSE · src/core/live.ts:168-192 · src/commands/quality.ts person compare -->

<a id="A5.6.2"></a>
### A5.6.2 Warning when entering a person

When a new person is entered, the app shows at most 3 similar people ("Similar people already exist:"). It compares
differently from [A5.6](#A5.6): by a similarity score as in merging, never with incompatible sex.
- **Controls:** **Go to person**, **Use existing** · turned off by **Settings → Notifications → Duplicate
  suggestions**.
- **Since:** app 1.4.0

<!-- zdroj: app:src/ui/duplicate-suggest.ts:22 MAX_SUGGESTIONS, :75 runDuplicateCheck · findSimilarPersons SIMILAR_PERSON_THRESHOLD · strings.ts duplicateSuggest.settingLabel, useExisting -->

<a id="A5.7"></a>
## A5.7 Not an error

A finding that is not an error is marked. Then it is no longer reported, even when the tree is checked again.
The mark is a change of the tree: it has a step back and an entry in the change history. For a possible duplicate the
button is called **Two different people**.

- **Limits:**
  - The app recognises the same finding by its kind, people and subject. The subject is the year for an event or
    wedding after death, the name for a godparent and the most frequent spelling for a place. When any of these
    changes, the finding shows again.
  - For a tree from the research, the mark is sent to the research when all people of the finding have a research
    number (at most 20 people). The research's GEDCOM file does not carry the marks; when a new version is loaded they
    are taken over from the old version of the tree.
  - The research respects marks at an event and a wedding after death: `strom check` does not report them and the
    agent does not investigate them.
  - State of a mark: **Sent to the research**, **Waiting for the research** (the research is not running, it is sent
    at the next connection), **In the app only** (the research did not take it or the people have no number; it is
    not sent again), **Marked in the research**.
  - A mark at a place has no people, so it is not sent to the research. When a part of the tree is separated, only
    marks whose people all stay are kept.
  - The app knows a mark written in the research only for an open tree from the research, when the research is
    running.
- **Controls:** in the row of a finding **Not an error** / **Two different people**, for 6 s the offer **Undo**. The
  list **Marked as not an error: n** under the findings, at each mark a date or **Marked in the research**, the button
  **Restore** · terminal: `strom quality list`, `strom quality dismiss possibleDuplicate P… P…`,
  `strom quality dismiss eventAfterDeath P… --subject 1861`, `strom quality undo …`. Only a person writes a mark,
  never the agent.
- **Since:** app 3.17.0 (research 1.22.0)

<!-- zdroj: app:src/validation.ts:1415 qualityFinding · src/quality-dismiss.ts:47 sanitizeQualityDismissed, :152 dismissalFor, :186 dismissBody, mergeResearchMarks, carryOverTreeDecisions, dismissalsWithin · src/quality-bridge.ts:74 dismissReply · src/ui/quality-ui.ts:155 flushQuality, :257 readQualityMarks · src/data.ts:1674 dismissQualityFinding · src/ui/tree-stats.ts:104 DISMISS_TOAST_MS · strings.ts treeManager.notAnError, twoPeople, dismissedRow, sentToResearch, waitingForResearch, appOnly, markedInResearch · research:src/commands/quality.ts PERSON · src/core/afterdeath.ts -->

<a id="A5.8"></a>
## A5.8 Tree overview → Data quality

The section sums up the check and the completeness of the tree. It counts the same way as the dialog, without marked
findings and without pairs the research told apart.

| Block | What it shows |
|---|---|
| **Consistency** | a summary ("2 errors, 1 warning, 3 leads."), the 5 most serious **Problems**, "and n more…", the row "n leads ›" |
| **Data completeness** | the share of people with **Birth date**, **Date of death (deceased)**, **Birthplace**, **Photo**; under 50 % highlighted; "Tree content:" (photos, events, sources, attachments) |
| **Certainty of research facts**, **Where evidence is missing** | evidence, see [R3.8](R3-verification-and-citation.md#R3.8) and [A3](A3-evidence-in-the-app.md) |
| **Structure** | the number of unions; unconnected parts, or "All people are connected into one family." |
| **Quick actions** | **Validation details**, **Clean up orphaned places (n)**, **Split into families** |

- **Limits:**
  - Over 10 MB of photos and attachments a warning is added. An orphaned place is a place nothing refers to.
  - An unconnected part has no path to the main family; it can be separated (**Separate unconnected parts**).
  - The card in **Where to focus** shows the number of errors and the most frequent kind. It has the button **Fix**
    (open tree) or **Validation details**; both open the dialog.
- **Controls:** **Tree overview → Data quality**; in the tree menu also **Data quality** directly.
  Actions that change data work only in the open tree.
- **Since:** app 3.13.0; leads and marks 3.17.0

<!-- zdroj: app:src/ui/tree-overview.ts:101 TOP_ISSUES, :108 LOW_SHARE, :1882 treeOverviewQualityHtml, :925 selectFocusCards · src/ui/tree-actions.ts:191 overview-quality · strings.ts treeOverview.consistencyTitle, completenessTitle, field*, contentLabel, mediaWarning, structureTitle, allConnected, quickActions, actValidation, actCleanPlaces, actSplitFamilies, cardValidation -->
