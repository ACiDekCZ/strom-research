<a id="A4"></a>
# A4 Family lines and surnames

The chapter describes how the app builds family lines from the tree and how it handles surnames. This covers the
birth surname, the married surname, feminine forms and joined spellings of one name.
Describes the Strom app 3.21.2. Changes from a later version carry its number.
How names get into the tree from GEDCOM is described in [A2](A2-loading-a-family-tree.md).

<a id="A4.1"></a>
## A4.1 A family line and its founder

A family line is the male line from the earliest known bearer of the name. The app computes it from the tree's data
only and stores only manual corrections, so the same tree always gives the same family lines.
A family line is set by its founder, not by the surname. One surname can thus have several unconnected family lines,
and one family line can have several spellings of the name.

Each person has one family line by birth. The app finds it through the "parent in the line":

| Situation | Parent in the line |
|---|---|
| A father is recorded | the father, even when the child's surname is written differently |
| The child bears the mother's surname and not the father's | the mother (the child belongs to her family line by birth) |
| The father is missing and the child does not bear the mother's surname | nobody, the child starts their own family line |
| A person without a usable surname | the father, otherwise the mother |

- **Limits:**
  - Without a usable surname are a placeholder person, a person without a surname and a woman recorded under her
    husband's surname, if she has no recorded father. Such a person never splits or starts a family line.
  - A step-parent and a foster parent do not pass the family line on. An adoptive parent passes it on when no other
    father is recorded.
  - A family line arises only where there is at least one real person with a surname. The founder is the person at
    the top of the line if that person is real and has a surname. Otherwise it is the oldest bearer of the name in the
    highest generation that has one.
  - A different spelling of the surname in the line does not split the family line. It shows as an unconfirmed form
    of the family line, see [A4.7](#A4.7).
  - "Earliest known" does not mean proven. The evidence of a person is set by
    [R3.8](R3-verification-and-citation.md#R3.8) and has no effect on the family line.
  - A daughter stays a member of her father's family line. A wife who married into the family line is shown in it
    next to the members but is not counted among them.
- **Controls:** **Tree overview → Family lines**. The detail of a family line shows **Places**, **Name forms** and
  **Members by generation**; generations are numbered in Roman numerals from the founder.
- **Since:** app 3.19.0

<!-- zdroj: app:src/lineage.ts:1 hlavička modulu · :296 fatherOf · :317 surnameLooksMarried · :328 birthSurname · :393 computeLineages (kroky 1–4) · :756 rodGenerations · strings.ts treeOverview.rods.intro -->

<a id="A4.1.1"></a>
### A4.1.1 Editing a family line by hand

The computation can be corrected in the dialog **Edit family line…** (the detail of a family line or the menu
**Family line actions** at a person's **Family line** row).

| Change | Element | What happens |
|---|---|---|
| A different founder | **Founder → Change…** | the line above the chosen person does not pass the family line on |
| A separate line | **Start a line from a person…** (at a person **Start a family line from this person…**) | the person and their descendants form a new family line |
| Return | **Restore automatic** | the family line is as computed again |
| Name form | **+ form**, **Remove the form** | changes the surname spellings of the whole tree ([A4.7](#A4.7)) |

- **Limits:**
  - Before each change a preview **What will change** is shown with the numbers of members and of those married in.
    A change is one step back: "Every change can be undone (Undo, Change history)."
  - An added form can merge two family lines and a removed form can split one. Family lines are joined by a
    parent–child link, not by the name form ("The lines are joined by a parent–child link, not by the form.").
  - A read-only tree and a followed tree can only be viewed. Only the open tree can be changed.
  - In a tree connected to the research, the research gets the correction of a family line the same way as groups of
    spellings (sending changes see S2).
- **Since:** app 3.19.0

<!-- zdroj: app:src/lineage.ts:1036 LineageChange · :1176 applyLineageChange · :1247 previewOverride · src/ui/lineage-edit-ui.ts · src/ged-exporter.ts _STROM_LINE · strings.ts lineage.edit.*, lineage.preview.* -->

<a id="A4.2"></a>
## A4.2 Family line by birth, and those who married in

A person's card and the person page have the row **Family line**. A member of a family line has their family line by
birth there and possibly "· married into …". Whoever married into the family line has "wife in … line" or "husband
in … line" and possibly "· born into …".

- **Limits:**
  - A person is shown as a wife or husband when they have no family line of their own, when their family line is only
    themselves, or when their family line is small ([A4.3](#A4.3)) and the marriage leads into a large family line.
    Otherwise they are shown as a member.
  - The family line by birth of a husband or wife is named only when it has more than one person.
  - A placeholder person and a person without a family line and without a marriage into one have no row.
  - In pages and exports with privacy of living people, the row of a living person is shown only with the option
    **Full data** or **Keep surname only**.
- **Controls:** the menu **Family line actions** at the row: **Show family line in tree**, **Edit family line…**,
  **Start a family line from this person…**, **Family line book…**. Choosing a family line in the tree view is
  described in A6.
- **Since:** app 3.19.0

<!-- zdroj: app:src/lineage.ts:793 marriedInto · :857 personRodRow · src/lineage-row.ts:40 personRodRowValue · :70 rodRowShown · strings.ts lineage.row.* -->

<a id="A4.3"></a>
## A4.3 Small family lines and Other families

A family line with at most 4 real members is small. Those who married in are not counted among the 4. Small family
lines are under **Other families** (up to 4 people), large family lines have a row of their own.

- **Limits:**
  - A family line formed by a single person who married into another family line does not belong to **Other
    families**. Such a family line is not in the list of family lines at all; the person is shown at the family line
    they married into.
  - Two different rules: a large family line is told apart from family lines of the same name only against other
    large ones, a small one against all ([A4.4](#A4.4)).
- **Controls:** **Tree overview → Family lines → Other families**. In the toolbar **Family lines → Other families**
  (A6).
- **Since:** app 3.19.0

<!-- zdroj: app:src/lineage.ts:72 SMALL_ROD_MAX_MEMBERS · :710 isMarriedInOnly · :722 otherFamilyRods · strings.ts treeOverview.rods, familyPages.otherFams -->

<a id="A4.4"></a>
## A4.4 Order and names of family lines

A family line is named by the founder's surname. A family line founded by a woman bears the form of the first man in
the line. When a family line has the same name as other family lines, it gets a distinction in brackets.

| Order of distinctions | Example |
|---|---|
| the family line's most frequent town, when no other family line has it | Horák (Brno) |
| the founder's year, when no other family line has it | Horák (1702) |
| the founder's given name | Horák (Jan) |
| given name and year | Horák (Jan, 1702) |

- **Limits:**
  - Family lines are sorted from the largest by the number of real members, on a tie by the founder's birth.
  - The founder's year is the year of birth, otherwise of baptism, otherwise of the oldest record. An approximate year
    reads "c.".
  - The founder's town is the place of birth, otherwise of baptism, otherwise the first event with a place.
  - Sorting in the overview: **size** (members and those married in), **oldest** (start of the family line), **A–Z**
    (by name in the app's language). The choice is remembered on the device, not in the tree.
  - From 20 large family lines the overview has a search and shows the first 20 family lines, the rest after
    expanding. It searches in the name, name forms, towns and members' names.
  - The time axis of family lines is rounded to 50 years.
- **Controls:** **Tree overview → Family lines**, the field "Search line, place or person…". The list **Family
  lines** in the toolbar has the same order and names, with **Whole tree** and **Other families** (A6).
- **Since:** app 3.19.0 (the list **Family lines** in the toolbar 3.21.0)

<!-- zdroj: app:src/lineage.ts:393 computeLineages (řazení) · :567 summarise · :672 founderYearOf · :938 rodLabel · src/rods-overview.ts:23 rodSize · :33 sortRods · :46 AXIS_STEP · :79 rodMatches · :98 ROD_SEARCH_FROM · :114 founderPlace · src/ui/tree-overview.ts:160 RODS_SORT_KEY -->

<a id="A4.5"></a>
## A4.5 Feminine and masculine forms of a surname

The app pairs the masculine and feminine form of a surname as one name: Horák and Horáková, Vlk and Vlková, Jaworski
and Jaworska. The pairing applies to search, merging people, family lines and the married surname suggestion.

| Rule | When it applies | Example |
|---|---|---|
| Polish -ski/-cki/-dzki ↔ -ska/-cka/-dzka | masculine form always | Jaworski → Jaworska |
| Czech -ský ↔ -ská, -ý ↔ -á | in a Czech tree | Lomský ↔ Lomská |
| Czech + -ová, -a → -ová | in a Czech tree | Horák → Horáková, Vlk → Vlková |
| dropped e before k, c, l | in a Czech tree | Jalůvek → Jalůvková, Krušec → Krušcová |
| indeclinable -ů, -í, -ých | never change | Macků, Kočí |

- **Limits:**
  - A tree is Czech when the app runs in Czech, or when some surname or group of forms contains a Czech letter
    (á é í ý č ď ě ň ř š ť ů ž ú ľ ĺ ŕ ä ô). The letter ó does not make a tree Czech.
  - Outside a Czech tree the Czech rules are not used. Ivanova is thus not paired with Ivan.
  - The feminine form -ska/-cka/-dzka belongs to -ski outside a Czech tree. In a Czech tree it stays under the Czech
    rules, because it can be a spelling without diacritics (Liska instead of Liška). Jaworski is paired with Jaworska
    anyway, but a search for "Jaworski" does not find a woman recorded as Jaworska.
  - A Polish form must have at least 4 characters before the ending -i/-a. A surname shorter than 3 characters gets no
    feminine form.
  - From -ová back, all possible masculine forms are tried (Jalůvková → Jalůvk, Jalůvka, Jalůvek). The stem must have
    at least 3 characters, otherwise -ová is read as an adjective (Nová → Nový).
  - Forms joined by the user ([A4.7](#A4.7)) always apply, outside a Czech tree too.
- **From app 3.22.0:** a tree with mostly Polish surnames is Polish and does not get the Czech rules even with the
  app in Czech (Nowak does not get the form Nowaková). The feminine form -ska is paired with -ski in every tree where
  -ski is present.
- **Since:** app 1.16.0 (Polish forms 3.21.2)

<!-- zdroj: app:src/surnames.ts (v3.21.2):29 CZECH_LETTERS · :39 POLISH_ADJECTIVAL · :42 polishPair · :64 genderRulesApply · :69 ruleForms · :89 czechRulesApply · :132 masculineForm · :164 masculineCandidates · :192 feminineForm · :263 sameSurname · HEAD src/surnames.ts treeSignals · CHANGELOG.cs.md 3.21.2, 3.22.0 -->

<a id="A4.6"></a>
## A4.6 Married surname and the surname in use

A person has a birth **Surname** and separately a **Married surname**. The birth surname sets the family line and the
name forms. The married surname serves for display and search.

When a woman's married surname is empty, the person editor offers "Suggestion: …" from the husband's surname, made
feminine according to [A4.5](#A4.5). **Use** fills it in, **Hide suggestion** hides it and the same suggestion is not
offered again.

- **Limits:**
  - The husband is the man from a union that is or was a marriage (divorced too). Of marriages with a date, the one
    with the latest date wins, otherwise the last in order. A union without marriage gives no suggestion.
  - A placeholder husband gives no suggestion. The suggestion is not offered when it equals the birth surname.
  - Where the rules do not apply, the husband's surname is offered unchanged (Brenntaler).
  - The field **Married surname** is shown when it is filled in, for a woman with a union, or after **+ married
    surname**.
  - **Surname in use** (**Birth** / **Married**) is shown only under a filled-in married surname. It is useful for
    example after a divorce.
- **Controls:** the display of all people is changed by **Settings → Person card → Surname display**:

| Option | Uses the married surname | Uses the birth surname |
|---|---|---|
| **Birth surname** | Marie Horáková | Marie Horáková |
| **Married (née birth surname)** (default) | Marie Vlková (née Horáková) | Marie Horáková (formerly Vlková) |
| **Married surname** | Marie Vlková | Marie Horáková (formerly Vlková) |

  The note "formerly" is only in the person's detail (card menu, relationship panel, editor header), not on the
  cards.
- **From app 3.22.0:** for a woman the birth surname field has the hint "Surname at birth" and an empty married
  surname says that the surname gained by marriage belongs there.
- **Since:** app 3.13.0 (surname in use 3.18.0)

<!-- zdroj: app:src/married-suggestion.ts:46 suggestionHusband · :65 wifeSurnameOf · :83 suggestMarriedSurname · src/person-name.ts:46 surnameDisplay · :79 shownNameParts · src/ui/person-modal.ts:1483 refreshMarriedSurname · strings.ts person.*, settings.surnameDisplay, name.* -->

<a id="A4.7"></a>
## A4.7 Surname spellings of the tree and suggestions from the research

Different spellings of one name (Horák, Horak, Horrák) can be joined into a group. A group applies to the whole tree:
search, merging people and family lines then take the forms as one name, also for people added later.

- **Limits:**
  - A group that overlaps with another is combined with it into one.
  - The tree remembers a removed form as a rejected pair.
  - A form of a single person (a nickname, a name after a farm) belongs to **Other spellings of the name** at the
    person, not to the tree's groups. Search ([A4.8](#A4.8)) and merging people compare these forms too; after a
    merge the forms of both people stay, and the spelling that lost a name conflict is added to them.
  - **Suggest from the research** shows the research's suggestions on two levels: **Documented** and **By rules**,
    each with a reason and records. Nothing is joined without a confirmation (**Accept** / **Reject**, **Undo**).
  - Suggestions are not offered when they are rejected, already lie in one group, or would join two groups. 10
    suggestions are shown, more after **Show … more**.
  - **Accept all documented** and **Accept all that differ only in diacritics** are shown from 2 suggestions.
  - "Suggestions are available while the research is running." Without the research the last loaded suggestions are
    shown. An accepted group "goes to the research with the next sending of changes" (S2).
- **Controls:** **Tree settings → Surname spellings…** (only for the open tree), **Link**, **Unlink**, **Suggest from
  the research**. A form of one family line: **Edit family line… → + form** ([A4.1.1](#A4.1.1)).
- **Since:** app 1.15.0 (suggestions from the research 3.17.0)

<!-- zdroj: app:src/surnames.ts:291 addSurnameGroup · :329 removeSurnameForm · src/surname-suggest.ts:197 isRejected · :208 suggestionGroup · src/ui/surname-suggest-ui.ts:41 PAGE · src/ui/surnames-ui.ts · src/ui/tree-actions.ts:217 · strings.ts surnames.*, surnameSuggest.* · src/merge/matching.ts:197 writtenSurnames · src/merge/executor.ts:781 addLosingNameVariant, :951 nameVariants -->

<a id="A4.8"></a>
## A4.8 Searching and sorting names

Searching for a person ignores upper and lower case, diacritics and punctuation. It finds a person under the birth
surname, the married surname, all their forms ([A4.5](#A4.5), [A4.7](#A4.7)) and under the person's other spellings
of the name.

| Match of the query | Order |
|---|---|
| start of the given name | 1. |
| start of the surname | 2. |
| start of the whole name | 3. |
| inside the given name, then inside the surname (earlier in the text ranks higher) | 4.–5. |
| another form of the surname or name: start, then inside | 6.–7. |
| several words spread between the name and another form | 8. |
| year of birth | 9. |
| cause of death or house (only the search in the toolbar) | 10. |

- **Limits:**
  - On a tie and without a query the sorting is by "surname given name", in the browser's alphabetical order.
  - When a person is found only by a surname that the name on the card does not show, the result gives it under the
    name ("married …", "née …", "formerly …").
  - The Latin and German form of a given name (Wenceslaus, Wenzel × Václav) is paired only when a read document is
    compared with the tree, not in search.
- **Controls:** the search in the toolbar, the choice of a person and the surname field in the extended filter.
- **Since:** app 3.0.0 (married surname in search 3.13.0)

<!-- zdroj: app:src/name-search.ts:26 searchableSurnames · :82 surnameMatchesQuery · src/merge/matching.ts:38 normalizeName · src/person-picker.ts:18 sortByName · :28 calculateMatchScore · :98 hiddenSurnameMatchHtml · src/search-filter.ts:95 · src/given-names.ts -->

<a id="A4.8.1"></a>
### A4.8.1 Same names in a person list

When the same name repeats in a search result, each such row has a second, grey line under the name with the shortest
detail that tells it apart from the others with the same name. A row with a unique name looks as before.

- **When:** what counts as the same is what the row shows: the name with titles and the note of the birth or earlier
  surname, and the year of birth when the list writes it after the name. It is compared as in search, ignoring upper
  and lower case and diacritics. It is counted in the whole result, also in the rows past the first 50.
- **Order of details:**
  1. years: "* 1820 – † 1866", only the known parts and only the year. A year of birth that the list writes after the
     name is not repeated;
  2. partner: "⚭ name"; with several marriages the first partner the other rows do not have;
  3. parents: "daughter of father and mother" ("son of" for a man, "child of" without a sex), only known parents;
  4. place: "born in …", without it "lived in …" (the latest residence with a place).
- **Limits:**
  - the details are taken in this order until the combination matches no other row of the group. Of them, only what
    is known and what not all other rows of the group have the same is shown, joined by " · ". Sisters with the same
    parents are so told apart by the birthplace, not the parents; two "Radegunda Pokusná" born 1900 have
    "⚭ Bohuchval Zkoušek" and "⚭ Sudivoj Pokus", not "* 1900 · ⚭ …". A detail that only some rows have the same is
    shown;
  - when only a detail not known for the row tells it apart, its first known detail that not all others have the
    same is shown, and when there is none, "no other details". A row that nothing tells apart from another shows all
    its known details;
  - a person found by a detail (married surname, cause of death, house, [A4.8](#A4.8)) has one line: the
    distinction and, after " · ", the find. A year the find already says ("† 1866 …") is not repeated in the
    distinction;
  - the distinction line does not widen the list: a longer end is shortened with "…". The whole text is in the row's
    tooltip and a screen reader reads the row as "name, distinction";
  - on a phone the list is as wide as the screen.
- **Where:** every choice of a person from a field: the search in the toolbar, adding a relation, finding a
  relationship, reading a document, the default person of the tree and others. The choice of a person for the
  ancestors' path on the map ([A6.5.4](A6-views.md#A6.5.4)) has its own list and no distinction.
- **Controls:** none: it applies by itself. Keys and loading by 50 rows are unchanged.
- **Since:** app 3.28.0

<!-- zdroj: app:f5d56ed3 src/picker-distinguish.ts rowKey (shownNameParts + birthNoteText, rok narození jen se showBirthYear, normalizeSearchText), distinguishFeatures (roky * – †, bez roku v řádku a bez části, kterou říká nález; partner první, kterého jiné řádky nemají; rodiče otec, matka, ostatní, bez zástupných; rodiště, jinak poslední bydliště s místem), distinguishLine (nejkratší předpona údajů, kterou nemá nikdo jiný; jinak první známý; jinak distNone), PickerDistinguisher (celý výsledek, i za 50) · src/person-picker.ts renderItem (person-picker-dist, nález na jednom řádku za „ · “, role option, aria-label a title „jméno, rozlišení“) · index.html .person-picker-dist (výpustka, min-width 330 px, telefon 100vw) · všechny new PersonPicker (search.ts, relation-modal.ts, kinship-ui.ts, read-document-ui.ts, tree-management.ts …); PathPersonPicker samostatný · strings.ts personPicker.distNone, distChild, distAnd, distBorn, distLived · app ac34f598 · dirigent:prace/1113-app-drobnosti-1112 · ZADANI_DEV_drobnosti-1112 §1 · app:1c4b7d19 distinguishLine (údaj shodný u všech ostatních řádků skupiny se vynechá; jinak první známý nesdílený; bez rozlišení vše) · dirigent:spec/085 A4.8.1 -->
