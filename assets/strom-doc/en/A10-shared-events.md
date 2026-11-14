<a id="A10"></a>
# A10 One event of several people

A census, residence or emigration of a whole household is recorded once and holds for everyone who was part of it.
A godparent, witness or officiant recorded at another person's event shows in the godparent's life too, when they
are linked to a person in the tree. The chapter describes the Strom app 3.28.0 and the research 1.32.0. How a shared
event is read and written in GEDCOM is said in [A2.1](A2-loading-a-family-tree.md#A2.1) and
[A2.7](A2-loading-a-family-tree.md#A2.7).

<!-- zdroj: dirigent:spec/085-sdilena-udalost U9, K1.1–K1.6, K2.1–K2.2 · app:1c4b7d19..e832e6e2 (dirigent:prace/1113-app-sdilena-udalost), app:f1d56989..80c2ffb9 (dirigent:prace/1113-app-085-nalezy) · app:CHANGELOG 3.28.0 -->

<a id="A10.1"></a>
## A10.1 A shared event: Shared with

An event that several people lived through together is recorded once. Each person has their own copy, the common
details are the same in all copies and an edit of any copy holds for all of them.

- **Which events:** **Census**, **Residence**, **Emigration**, **Immigration**, **Military service**,
  **Naturalization** and **Custom** (with a label filled in). Birth, baptism, marriage, death and other events always
  belong to one person; at them the others are recorded as godparents and witnesses ([A10.5](#A10.5)).
- **Common details:** type, the label of a custom event, date, place, house, note, sources and citation quality.
  **Each person their own:** the age as recorded, the role at the event, the research status and verification.
- **Limits:**
  - an edit of a common detail is saved in all copies as one **Undo** step (“{event}: saved for N people.”). When
    one of the people is locked, nothing is saved (“Nothing saved: one of the persons is locked, or this type of
    event belongs to one person only.”);
  - while other people share the event, it cannot be changed to a type for one person only: the choice of type has
    the group **One person only** with the explanation “These types can’t be shared. First remove or separate the
    others in Shared with (N).”;
  - the role is each person's own: the default **household member**, or **Other role…** with a word of one's own
    (lodger, servant…);
  - with 7 or more other people the list shows the first 5 and **Show N more** (back **Show less**);
  - deleting a person deletes only their copy; the confirmation lists “Shared events stay with the others:” (at most
    5 lines, then “…”). A copy left alone is an ordinary event of its person;
  - a living person protected by the privacy of living people ([A7](A7-book-pages-and-export.md)) is neither named
    nor counted at a shared event in the book, on the pages and in the export.
- **Controls:** editing a person's event, the section **Shared with** with the columns **Person**, **Role** and
  **Age** and the hint “Date, place, house, note and sources apply to everyone. Each person has their own age.” At an
  event of several people, the bar “Shared by N people – changes apply to everyone” is above the form.
  - the menu of a person's row: **Open person**, **Separate (keep an own copy)** (“The copy stays; later changes no
    longer affect it.”), **Remove from the event** (“The event disappears for this person and stays for the
    others.”). Removing and separating are saved with the other edits as one **Undo** step;
  - deleting in the footer: **Delete for this person only** (“Stays for the other N.”), **Separate this person**,
    **Delete for all N people…** (the confirmation lists the people for whom the event disappears). Both can be
    undone with **Undo**.
- **Since:** app 3.28.0

<!-- zdroj: app:80c2ffb9 src/events.ts SHAREABLE_EVENT_TYPES (census, residence, emigration, immigration, military, naturalization, custom), SHARED_EVENT_COMMON_FIELDS (type, customLabel, date, place, address, note, sourceIds, citationQuay) · src/types.ts LifeEvent.shareId, shareRole · src/shared-events.ts, src/shared-event-editor.ts · src/ui/shared-event-ui.ts LARGE_HOUSEHOLD 7, SHOWN 5, openSharedRowMenu, openSharedDeleteMenu, sharedTakeOut, sharedDeleteAll · strings.ts events.sharedWith, sharedWithHint, sharedBanner, sharedCol*, sharedRoleDefault, sharedRoleOther, sharedRolePlaceholder, sharedShowMore, sharedShowLess, sharedOpenPerson, sharedSeparate(Hint), sharedRemove(Hint), sharedSeparateSelf, sharedDeleteSelf(Hint), sharedDeleteAll(Title, Lead), undoHint, sharedTypeLocked(Hint), sharedSaved, sharedSaveRefused, personDelete deleteShared · spec 085 K1.1–K1.3 · dirigent:prace/1113-app-sdilena-udalost Výsledek -->

<a id="A10.1.1"></a>
### A10.1.1 Add a person

**Add a person** in the section **Shared with** opens a choice of people. Nothing in it is ticked in advance.

- **Family:** without a search text it offers the group “Family · alive on {date}”: the person's partners, children,
  parents and siblings, without placeholder persons. Whoever was not alive in the year of the event is not in it, and
  the choice says so (“Without N people who were not alive on the event date: …”, at most 3 names with the year of
  death).
- **Search:** searches the whole tree, at most 50 results. Whoever is already in **Shared with** has “already in
  Shared with”. Without a result it offers **Create a new person “…”** and reminds “Anyone who doesn’t belong in the
  tree (lodger, servant) goes only into the event note.” **Create and add** creates the person and adds them.
- **A person who already has the same event:** the row shows “already has {event} – it will be joined”. After saving,
  their own record is joined to the shared event and no new copy is made; the person's age and own details stay.
  When their common details differ, **Make all match…** is offered ([A10.3](#A10.3)).
- **The same event** means:
  - the same type (for a custom event also the same label);
  - a full date: day, month and year, without “about”, a range or a period;
  - the same place (regardless of spaces at the ends and of upper and lower case);
  - the same house, or a house recorded in only one of the records (the joined event takes it over). Two different
    houses are never the same event.
- **Controls:** **Add (n)** adds the chosen people; they are saved with the event.
- **Since:** app 3.28.0

<!-- zdroj: app:80c2ffb9 src/ui/shared-event-ui.ts showSharedPicker, familyCandidates (partneři, děti, rodiče, sourozenci, bez zástupných, živí k roku), hledání max 50 · src/shared-events.ts sameEventKey, isSameEvent (SHAREABLE, vlastní s názvem, úplné datum bez kvalifikátoru, místo trim + bez velikosti, dům shodný nebo jen u jednoho) · strings.ts personPicker.family, familyAlive, familyHidden, alreadyShared, joinsOwnRecord, createNamed, noteHint, addN, createAdd · spec 085 K1.6 a · dirigent:prace/1113-app-085-nalezy -->

<a id="A10.2"></a>
## A10.2 Where a shared event shows

A shared event is in the life of each person who has it. Where several people of the event are in one place, it shows
once.

- **A person's list of events:** under the event, the line “with …”: up to 3 people by name, more as the first 2 and
  “and N more”. **Open the shared event** opens the editing of the event.
- **Person page, the section Life timeline:** like the person's other events, with the line “with …”.
- **Map:** in a place's bubble the shared event is one line with all its people.
- **The family's timeline:** once.
- **Book and family pages:** the block **Family together**, when all people of the event are in this family (the
  couple and their children), one line with ages and the source. The partners' timelines then leave the same event
  out. A census is in the book at the detail **All**, not at the default **Normal**.
- **Table:** one row ([A6.7.10](A6-views.md#A6.7.10)).
- **Limits:** placeholder persons and living people protected by the privacy of living people are neither named nor
  counted in the line.
- **Since:** app 3.28.0

<!-- zdroj: app:80c2ffb9 src/shared-with-line.ts SHARED_LINE_MAX, sharedWithLine, sharedWithLineHtml, familyTogetherEvents (všechny kopie v rodině, bez zástupných a skrytých), familyTogetherLineHtml · src/book-blocks.ts familyTogetherHtml (skip pro časové osy partnerů) · strings.ts events.sharedLine, sharedLineMore, sharedLineOpen, book.familyTogether · spec 085 K1.4, §2h · dirigent:prace/1113-app-sdilena-udalost Výsledek (mapa, osa rodiny, kniha Běžně/Vše) · strings.ts book detail.normal, personPage sec.timeline -->

<a id="A10.3"></a>
## A10.3 Copies differ: Make all match

When the common details of the copies of one event differ (for example after an import or a merge), the app says so
and offers to make them match. It changes nothing by itself.

- **Where:**
  - **Data quality**, the section **To check**, the group **Shared events**: “{event} · {person}: {field} differs
    (…; others …).”, with more copies “{event} · N copies differ: …” ([A5.1](A5-tree-check.md#A5.1));
  - a finding's bubble in the Table view;
  - editing the event: the bar “Copy differs: … (…)” with **Compare**.
- **The dialog Make copies match · {event}:** shows only the fields that differ (type, label, date, place, house,
  note, sources, citation quality). Preselected is the value of the majority; with equal counts, the value of the
  person the dialog was opened from. From 3 fields there is also **Take everything from:** and a person. The line
  “Same: … Age, research status and verification belong to each person and are not matched.”
- **Limits:** making them match is one **Undo** step. **Separate the differing copy** (with more **Separate the
  differing copies (n)**) makes the differing copy a separate event of its person.
- **Controls:** **Make all match…** → **Make match for N people**; **Open** opens the event.
- **Since:** app 3.28.0

<!-- zdroj: app:80c2ffb9 src/shared-divergence.ts · src/validation.ts (groupShared, závažnost warning) · src/ui/tree-stats.ts · src/ui/shared-event-ui.ts (pruh sharedDiffers, sharedCompare) · strings.ts validation.groupShared, sharedDiffersOne, sharedDiffersMany, unify, separateCopy, separateCopies, openEvent, unifyTitle, unifyLead, unifyTakeAll, unifySame, unifyGo, unified, sharedFields · spec 085 §4 · dirigent:prace/1113-app-085-nalezy -->

<a id="A10.4"></a>
## A10.4 The same event recorded separately: Join into one event

The same census or residence recorded separately at several people (for example from an older tree or from another
program) is found by Data quality, which offers to join it. Nothing is joined by itself, not even when the data are
updated.

- **Where:** **Data quality**, the section **Leads**:
  - one group: “{event} {date}, {place}, {house} – recorded separately for N people.” (the house only when recorded) with **Join into one event**;
  - more groups: “N events are recorded separately for several people.” with **Review one by one**. The dialog
    **Events recorded separately for several people · N** offers the groups one at a time: **Join into one event**,
    **Later** (the group does not show again until the dialog is closed), **Back** (back to the check).
- **Limits:**
  - the same event is recognized as in **Add a person** ([A10.1.1](#A10.1.1)). Different houses split the groups;
    a record without a house then joins none of them;
  - after joining it is one shared event; each person's age and own details stay. When the common details differ,
    **Make copies match** is offered ([A10.3](#A10.3));
  - a group that already holds a shared event joins it (“Joins the shared event of N people.”);
  - joining is one **Undo** step (“{event}: joined into one event for N people.”).
- **Controls:** **Tree overview → Data quality → Quick actions → Validation details**, the section **Leads**.
- **Since:** app 3.28.0

<!-- zdroj: app:80c2ffb9 src/ui/same-event-join-ui.ts · src/shared-events.ts sameEventKey (domy dělí skupiny) · src/validation.ts (stopa info) · strings.ts validation.sameJoinLead, sameJoinSummary, sameJoinReview, sameJoin, sameJoinTitle, sameJoinHint, sameJoinToShare, sameJoinDone, later, nameLinkBack · spec 085 K1.6 b · dirigent:prace/1113-app-085-nalezy Výsledek -->

<a id="A10.5"></a>
## A10.5 Godparents, witnesses and other participants in a person's life

A godparent, witness, officiant and another participant are recorded at the event they took part in: at a baptism,
marriage, death. When the participant is linked to a person in the tree, that event shows in the person's life too.

- **Roles:** **Godparent**, **Witness**, **Officiant**, **Present**; from files also **Midwife** and **Informant**.
  A participant is recorded by name as in the source, and with a detail (trade, “neighbour”…).
- **In the life of the linked person:** a derived row, for example “Godparent · baptism: …”, “Witness · marriage:
  …”, “Officiant · marriage: …”, “Midwife · baptism: …”, “Informant · death: …” (the same for a woman). It is in the
  person's list of events and on the person page in the section **Life timeline**; the summary of the person page has
  “Godparent and witness for”.
- **Limits:**
  - a derived row is not the person's own event: it does not go to GEDCOM, the Table, the map, the book, the family's
    timeline or the timeline in the person dialog;
  - the row disappears as soon as the person has an own event ([A10.5.1](#A10.5.1)) that refers to the same event;
  - a participant recorded by name only shows in nobody's life; [A10.5.2](#A10.5.2) offers the link.
- **Controls:** editing the event, the section **Godparents & witnesses**: **+ Add**, **Link to someone in the
  tree**; a linked participant has the mark **in the tree**. The menu of a derived row: **Open person**, **Also
  record as an own event**, **Unlink**.
- **Since:** app 3.28.0

<!-- zdroj: app:80c2ffb9 strings.ts events.roles, extraRoles, participants, addParticipant, participantName, participantNote, participantLink, participantInTree, derived*, derivedMenu, recordOwn, unlink · personPage godparentWitness · src/ui/shared-event-ui.ts (odvozené řádky jen v seznamu událostí a v Časové ose života) · spec 085 K2.1 · dirigent:prace/1113-app-sdilena-udalost Výsledek -->

<a id="A10.5.1"></a>
### A10.5.1 Also record as an own event

Being a godparent or witness can also be recorded as the person's own event, for example to give it a note or source
of its own.

- **Types:** **Godparent** (the field **For the baptism**), **Wedding witness** (the field **For the marriage**); at
  another event the field **For the event**. The own event refers to the baptism or marriage it belongs to.
- **Limits:**
  - date, place and source are prefilled from the baptism (“Prefilled from the baptism. Later changes to the baptism
    are not carried over.”), from a marriage likewise;
  - it is never a copy of the baptism or marriage; the baptism and the marriage still belong to their person and
    couple;
  - the derived row ([A10.5](#A10.5)) then does not show.
- **Controls:** the menu of a derived row → **Also record as an own event** (“Creates a godparent event linked to
  the baptism, with the same source.”). After saving “{type}: saved for {name}.” The types are also in the choice of
  the event type.
- **Since:** app 3.28.0

<!-- zdroj: app:80c2ffb9 src/events.ts godparent, weddingWitness (roleAt) · strings.ts events.types.godparent „Kmotrovství“, weddingWitness „Svědek při sňatku“, recordOwnHintGodparent, recordOwnHintWitness, recordOwnPrefilled(Marriage, Event), refBaptism, refMarriage, refEvent, recordedOwn · src/ged-exporter.ts (1 EVEN, 2 TYPE, 2 _STROM_ROLE, 3 _STROM_AT, 4 TYPE BAPM|MARR) · spec 085 K2.2 -->

<a id="A10.5.2"></a>
### A10.5.2 Linking a godparent or witness recorded by name

A godparent or witness recorded by name only who matches a person in the tree gets an offer to link. Nothing is
linked by itself, and the name recorded in the event stays.

- **Who is offered:** only godparents and witnesses, not those present at the event by office. A person in the tree
  with the same given name and surname (regardless of upper and lower case and diacritics; the married surname counts
  too) who was alive on the date of the event and at least 12 years old. A date with “about” allows a difference of
  2 years; the age is counted from the date of birth, otherwise of baptism. Without a date of the event nobody is
  excluded.
- **Who never:** the person the event belongs to, whoever is already linked, and whoever was rejected.
- **Limits:**
  - the year of birth and the house (the address of birth, or the residence or census nearest the date) are only
    shown with the offer, they do not decide;
  - the tree remembers a rejection and does not offer it again; in GEDCOM it comes back
    ([A2.7](A2-loading-a-family-tree.md#A2.7));
  - at a shared event the link is made in all copies.
- **Controls:**
  - editing the event: a grey bar “{name} ({details}) is in the tree – link?”, with more people “N people named … are
    in the tree – link?”, the buttons **Link**, **Not this person**, **None of them**. It holds only after **Save**;
  - **Data quality**, the section **Leads**: “N godparents and witnesses recorded by name match a person in the
    tree.” with **Review one by one**; the dialog **Godparents and witnesses by name who are probably in the tree ·
    N** saves at once, each link or rejection is one **Undo** step. Under the list “Rejected ones are not offered
    again (n).”
- **Since:** app 3.28.0

<!-- zdroj: app:80c2ffb9 src/participant-match.ts MIN_PARTICIPANT_AGE 12, cca ±2, attendsByOffice, příjmení po sňatku, linkRejected · src/ui/name-link-ui.ts · src/ui/shared-event-ui.ts (nabídka v editoru) · strings.ts events.linkOffer, linkOfferMany, link, notThisPerson, noneOfThem, linked · validation.nameLinkLead, nameLinkReview, nameLinkTitle, nameLinkHint, rejectedCount · spec 085 §6, 6g · dirigent:prace/1113-app-085-nalezy -->

<a id="A10.6"></a>
## A10.6 Merging people and trees

A merge does not double a shared event.

- **Merging two people** ([A5.6](A5-tree-check.md#A5.6)): the dialog **Shared events after the merge** shows the
  shared events of both people. An event both have stays once (“Once – both are in it.”); when the age differs, one
  is chosen. An own copy that matches the other person's shared event is joined to it (ticked “Attach to the shared
  event (N people) – the own copy matches”).
- **Merging trees** ([A8](A8-merging-trees.md)): the shared events of the incoming tree are paired with the events
  of the target tree (the same ID, otherwise the same record) and take over its shared event. A person with two same
  copies keeps one. A shared event left with one copy is an ordinary event. Summary: “Shared events: n joined”.
- **Since:** app 3.28.0

<!-- zdroj: app:80c2ffb9 src/merge/* (párování shareId, sjednocení kopií) · src/ui/person-merge (sharedTitle) · strings.ts personMerge.sharedTitle, merge.sharedOnce, sharedAttach, sharedJoined · spec 085 K1.5 · dirigent:prace/1113-app-sdilena-udalost Výsledek -->

<a id="A10.7"></a>
## A10.7 Trees saved earlier

A tree saved by an older version of the app is updated for the new version when it is first opened. Before that it is
backed up once (**Before the data update of a new version**). The update joins nothing; joining is offered by Data
quality ([A10.4](#A10.4)).

- **A custom event “Census”:** a person's custom event named exactly “Census”, “Sčítání lidu”, “Volkszählung” or
  “Spis ludności” (regardless of upper and lower case and spaces at the ends) becomes the event **Census**. Date,
  place, age, house, note, sources and participants stay. Custom events with another name and events of a couple
  stay as they are. A merge then takes a custom “Census” and a census as the same event, so the same file loaded
  again adds no event.
- **Invalid sharing** is dropped: an invalid mark, sharing at a type for one person only and sharing with a single
  copy.
- **Controls:** none, it happens by itself. The backup is in the tree menu → **Backups** → **Backup history**
  ([S6.5](S6-tree-from-another-program.md#S6.5)).
- **Since:** app 3.28.0

<!-- zdroj: app:80c2ffb9 src/tree-manager.ts (verze dat 20, migrace), src/snapshots.ts 'pre-migration' · src/shared-events.ts (zahození neplatných shareId) · strings.ts snapshots.pre-migration „Před úpravou dat pro novou verzi“ · test gedcom-census-legacy.test.ts · dirigent:prace/1113-app-085-nalezy Výsledek (Census → census, záloha, NFC, trim, bez roleAt) -->
