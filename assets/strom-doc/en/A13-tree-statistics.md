<a id="A13"></a>
# A13 Tree statistics

The window **Statistics** counts how often names, places, occupations, age and births recur in the tree. Each topic is
a complete table of values with a count and a share, for the chosen scope of people and period of birth. A click on a
value shows its people in the Table; the table can be saved as CSV. The chapter describes the Strom app 3.32.0;
changes from a newer version carry its number.

<!-- zdroj: dirigent:spec/138-podrobne-statistiky-stromu · app:d77da992 src/tree-stats.ts · f9722722 src/ui/tree-stats-ui.ts · 6f5412e3 · 417490db · 2723a543, e5723bf2, e1eae544 · 6c3b7e61 · strings.ts treeStats.* · dirigent:prace/1123-app-138-statistiky -->

<a id="A13.1"></a>
## A13.1 The Statistics window

The window **Statistics: <tree>** has the topics in groups on the left and the table of the chosen topic on the right.
Above the table are the **Scope** ([A13.3](#A13.3)) and the topic's options, below it the totals and notes on how it
is counted.

- **Where it opens:**
  - **Actions › Tree › Statistics** (right below **Tree overview**);
  - in Manage trees in the ⋯ menu at a tree, in the group with **Tree overview**, **Data quality**, **Backups**,
    **Merge history** and **Change history** ([A14.1](A14-trees-and-structure.md#A14.1));
  - on a phone **More › View › Statistics**; the window starts on the button **Topic**, the topic and the scope are
    chosen in a sheet from the bottom;
  - the link **In detail** in **Tree overview**: at the detail of a family line (**First names** with the scope of
    that family line), at **Age at death** (**Age at death**), at **Children per couple by generation** (**Children
    per couple**), at **Births by month** (**Births over time** by month) and at **Most common male names** / **Most
    common female names** (**First names** of men, of women).
- The chosen topic is counted first, then the counts of the other topics in the list on the left; a topic still being
  counted shows “Calculating…”. A change to the data of the open tree counts the tables again.
- The table has the columns of the value, **Count** and **Share**. Sorting **By count**, **A–Z**; for age, period and
  number of children **By age**, **By period**, **By children** (grouped values are sorted by value by default). The
  search field (“Search names…”, “Search surnames…”, “Search places…”) narrows the rows regardless of case and
  accents; the row **Not given** is hidden while searching.
- Below the table the totals: “Total 312 people · 48 values”; for age “… with a known age”, for couples “Total 120
  couples …”, for marriages “Total 95 marriages …”.
- **Limits:** a saved page (HTML export) has neither Statistics nor the links **In detail**. A tree that is not open
  (the window from Manage trees at another tree) computes the statistics, but does not show the people in the Table
  (“The tree is not open – the people cannot be shown in the Table.”).
- **Controls:** see **Where it opens**; **Close** or Esc.
- **Since:** app 3.32.0

<!-- zdroj: app:f9722722 src/ui/tree-stats-ui.ts (skupiny témat, tabulka, řazení, hledání, součty, poznámky) · 417490db (Akce › Strom pod Přehledem, list stromu, Správa stromů, čtvrtá dlaždice Zobrazení v listu Další na telefonu, nic v exportované stránce; telefon začíná na tlačítku Téma) · src/ui/tree-overview.ts treeOverviewStatsLink (rod-show firstNames rodId, deathAge, childrenPerCouple, births months, firstNames sex male/female; '' v režimu prohlížení) · src/tree-stats.ts defaultSort, isValueTopic · src/ui/tree-actions.ts treeActionGroups (overview) · strings.ts treeStats.menu, title, groups, topics, sort, search, none, total, readOnly, overview.more, phone.*; treeOverview.deathAgeTitle, childrenByGen, birthsByMonth, topMaleNames, topFemaleNames -->

<a id="A13.2"></a>
## A13.2 Topics and how they are counted

Each topic lists all values that someone in the scope has, not only the most common ones. A unit without a value is in
the row **Not given**. The share is of the units with a value given.

| Group | Topic | Counts | Options |
|---|---|---|---|
| Names | **First names** | people | **Sex** (**Men**, **Women**, **Not given**; default men), **Count** (**First name** / **Every name**) |
| | **Surnames** | people | **Surname** (**Birth** / **Women’s married too**) |
| Places | **Places of birth**, **Places of death** | people | **Level** (**Town**, **District**, **Country**) |
| | **Places of marriage** | marriages | **Level** |
| Life | **Occupations**, **Religions** | people | – |
| | **Age at death**, **Age at first marriage**, **Age at first child** | people, in five-year groups | – |
| | **Children per couple** | couples | – |
| Time | **Births over time** | people | **Group** (**By decade** / **By month**) |

- **Enforced by the code:**
  - only real people are counted, never placeholder persons, not even as partners or children of a couple;
  - a unit is counted once for one value. A person with several occupations counts under each of them;
  - **Every name**: a person with several names (“Jan Karel”) counts under each, and the shares add up to over
    100 %; a hyphenated name is one name;
  - **Surnames**: the male and the female form of one surname count together, by the rules of the tree's surname
    spellings ([A4.5](A4-surnames-and-families.md#A4.5)). **Women’s married too** counts a married woman under her
    birth surname and under her married surname; the total is then more than the number of people;
  - places: the same place written differently counts once (unified places); a value has the number of spellings and
    the tooltip “Written as: …”. A tree without a hierarchy of places counts towns (“Without a hierarchy of places the
    towns are counted: streets and house numbers belong to the town.”) and has no option **Level**. With places
    identified by the research ([R4.2](R4-places.md#R4.2)) districts and countries can be counted; a place without
    them is “no district known”, “no country known”;
  - age is in whole years from the date of birth and the date of the event, in five-year groups, at the top “100 and
    over”. **Not given** are the living and people without both dates;
  - **Children per couple**: a couple with at least one partner in the scope, children without placeholder persons,
    at the top “10 or more”. **Places of marriage** likewise: a marriage with at least one partner in the scope;
  - the year of birth is taken from an estimate too (“about 1820” counts as 1820).
- **Limits:** a topic that nobody has says why (“Nobody in the tree has an occupation recorded.”).
- **Controls:** the window **Statistics** → a topic on the left (on a phone **Topic**); options above the table.
- **Since:** app 3.32.0

<!-- zdroj: app:d77da992 src/tree-stats.ts (sdílená pravidla: zástupné nikdy, jednotky osoby/páry/sňatky, pár a sňatek v rozsahu s aspoň jedním partnerem, všechny hodnoty bez top N, Neuvedeno, podíl count/known), DEFAULT_STATS_OPTIONS (sex male, names first, surnames birth, level town, births decade), jména: slova, spojovník jedno slovo, příjmení: mužský a ženský tvar pod mužským klíčem, místo: klíč skupiny míst, jinak obec (ulice a čísla domů k obci), nejčastější zápis · src/ui/tree-stats-ui.ts volby jen u firstNames, surnames, místa s hasLevels, births · strings.ts treeStats.topics, desc, opt, ageGroup, ageTop, childrenTop, note.real, share, ages, ageNone, births, occupations, couples, surnames, withMarried, each, places, placesTown, placesLevel, noDistrict, noCountry, formsTip, empty.* -->

<a id="A13.3"></a>
## A13.3 Scope and period of birth

Statistics count the people of the chosen **Scope**, optionally only those born in a given period.

- **Scope:** **Whole tree**, **Family line…**, **A person’s direct line…** (ancestors, descendants and the person,
  as in [A4.8.2](A4-surnames-and-families.md#A4.8.2)), **List of people…** ([A11](A11-lists-of-people.md)). The
  picker has the field “Search line, person, list…”.
- **Period of birth:** **Born from** and **to** (a year). People without a year of birth drop out once a period is
  chosen; the window says how many (“12 people without a birth year are outside the period.”). The year must be a
  number and “from” at most “to”, otherwise “A year as a number, “from” not after “to”.”. **Clear the period** clears
  it.
- **Limits:** the scope and the period hold until the window closes, as do the topic, the options, the sorting and
  the search; nothing is saved to the tree or to the settings. The next opening starts with the whole tree. From the
  link **In detail** at a family line the window starts with that family line. A scope that has disappeared
  meanwhile (a deleted list) is empty.
- **Controls:** the window **Statistics** → **Scope** (on a phone the sheet **Scope**).
- **Since:** app 3.32.0

<!-- zdroj: app:d77da992 src/tree-stats.ts StatsScope (výběr okna nebo přímá linie), scopePeople (skutečné osoby, s obdobím počet bez roku narození, zmizelý výběr prázdný) · 6c3b7e61 přímá linie přes directLineIds rozsahu hledání · f9722722 src/ui/tree-stats-ui.ts (rozsah a období jen v okně) · strings.ts treeStats.scope.label, tree, treeSub, rodMore, directMore, directSub, listMore, search, from, to, periodSec, periodHint, outOfPeriod, invalid, clearPeriod -->

<a id="A13.4"></a>
## A13.4 From a value to the Table

A click on a row of the table (“Show 14 people in the Table”) opens the Table ([A6.7](A6-views.md#A6.7)) with the
people of that value.

- The Table shows the whole tree narrowed by one chip at the start of the row of chips: “Statistics: first name Jan ·
  Horák line”. On a phone the chip is in a row of its own below the bar and counts towards **Filters**.
- For a couple and a marriage both partners are shown.
- **Back to Statistics** returns the window as it was (topic, options, scope, period).
- × at the chip or **Clear filters** removes the chip. The chip is never saved into a view, into unfinished work or
  into the rule of a list.
- **Save as list of people** saves exactly the people shown as a fixed list named after the chip
  ([A11.6](A11-lists-of-people.md#A11.6)).
- **Limits:** only for the open tree ([A13.1](#A13.1)).
- **Controls:** a row of the table (click, Enter).
- **Since:** app 3.32.0

<!-- zdroj: app:6f5412e3 (klik na hodnotu → Tabulka celého stromu se štítkem „Statistiky: … · rozsah“ první v řadě, na telefonu vlastní řádek pod lištou a počítá se do Filtrů, × nebo Zrušit filtry, Zpět do Statistik vrátí okno, štítek se neukládá do pohledu, práce ani pravidla, Uložit jako seznam osob = pevný seznam pojmenovaný podle štítku) · src/tree-stats.ts (pár a sňatek: klik ukáže oba partnery) · strings.ts treeStats.rowTitle, table.chip, table.back, chipWhat.*, readOnly -->

<a id="A13.5"></a>
## A13.5 CSV export

**Export CSV** in the window's footer saves the topic's table as the window shows it: with the options, the scope, the
period and the search.

- The file has a first line with a description (“Statistics: First names – men, first name · Scope: Horák line ·
  Tree: Horákovi · 24. 11. 2026”, with a search also “search “Jan””), then the columns **Value**, **Count**,
  **Share %**, the row **Not given** (not with a search) and **Total**. The separator is a semicolon, the encoding
  UTF-8.
- After saving the notice “Saved: <file>”. Nothing is sent out; the file stays on the device.
- **Limits:** an empty table has nothing to save (“Nothing to save”); while the table is being computed, the button
  waits (“Saves the table once it is computed”).
- **Controls:** the window **Statistics** → **Export CSV** (on a phone the icon in the header).
- **Since:** app 3.32.0

<!-- zdroj: app:f9722722 src/ui/tree-stats-ui.ts exportTreeStatsCsv, src/tree-stats.ts statsCsv (BOM, středník, Neuvedeno jen bez hledání, Celkem) · src/ui/tree-stats-ui.ts export (popisný řádek desc, hlavička head, none, total, toast) · strings.ts treeStats.export.btn, what, waiting, nothing, head, none, total, desc, search, toast, phone.exportAria -->
