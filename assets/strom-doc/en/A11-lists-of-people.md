<a id="A11"></a>
# A11 Lists of people

A list of people keeps chosen people of the tree under one name so they can be worked with again and again: in the
Table as its scope ([A6.7.19](A6-views.md#A6.7.19)), in export and as a checklist with ticking off. A list is made
from a rule (family line, ancestors, descendants, research line, Table filter, when the people came into the tree,
a custom rule of conditions), from search results or by hand. The chapter describes the Strom app 3.32.0.

<!-- zdroj: dirigent:spec/084-seznamy-osob (K1.1–K8.4, rozhodnutí 14. a 16. 11.) · app:714a8ab2..60265541 (dirigent:prace/1116-app-084-seznamy) · app:docs/ZADANI_DEV_seznamy-osob.md §1–§13, §15, §16 · app:src/person-lists.ts, src/person-lists-data.ts · app:CHANGELOG.cs.md 3.30.0 „Pojmenované seznamy osob“ · 3.32.0 vlastní pravidla: dirigent:spec/136-pravidla-seznamu (fáze 1, K1.1–K1.10) · app:a07c78b2..efc14cff (merge 78807628) · app:CHANGELOG.cs.md 3.32.0 „Vlastní pravidla seznamů“ -->

<a id="A11.1"></a>
## A11.1 Fixed list, automatic list and checklist

A list is **fixed** or **automatic**. A fixed list holds its people and changes only by hand. An automatic list is a
saved rule: its people are worked out again each time.

| Kind | What it holds | Add and remove by hand | Manual order |
|---|---|---|---|
| **fixed** | people in a manual order; the rule it was made from (**Created from**), when it has one | yes | yes |
| **automatic** | only the rule (**Based on**) | no: “The rule decides the content – nothing is added or removed by hand.” | no |
| **checklist** | a fixed list with **Tick off done** switched on ([A11.8](#A11.8)) | yes | yes |

- The kind shows at the list in the overview (an icon and the word **fixed**, **automatic**, **checklist**), in the
  detail (the badge **Fixed list**, **Automatic list**, **Checklist**) and in the Table's **Scope** (an icon).
- A list has a name. The name is unique in the tree; it is compared without diacritics, case and extra spaces. A
  taken name is not saved: “A list with this name exists. Suggested: “{name} (2)”.” (the next free number).
- Placeholder persons are never in a list.
- **Limits:** lists change only in a tree that can be changed. In a read-only tree (an exported HTML page, a followed
  tree, a tree saved by a newer version of the app, a locked tree) the lists can be viewed and opened in the Table,
  without edits; the dialog has the badge **Read only**. A locked person can be added to a list.
- From app 3.32.0 a fixed or automatic list can stand on a custom rule of conditions ([A11.2.4](#A11.2.4)) and a
  fixed list with a rule can be made automatic again (**Keep by the rule**, [A11.2.2](#A11.2.2)).
- **Controls:** **Actions → Lists of people…** ([A11.3](#A11.3)).
- **Since:** app 3.30.0; 3.32.0: custom rule, **Keep by the rule**

<!-- zdroj: app:src/person-lists.ts listKind (dynamic → auto, checklist → work), listPersonIds (bez zástupných osob) · src/person-lists-data.ts foldListName, isListNameTaken, suggestListName · src/data.ts:2130 listsReadOnly (isReadOnly || isTreeLocked; isTreeLocked: sledovaný strom liveTreeId, isNewerData, isLocked) · src/ui/person-list-add.ts personListMenuRows (zamčená osoba ano, app:60265541) · strings.ts lists.kind.*, badge.*, rule.key, rule.origin, autoInfo, save.dup, readOnly · ZADANI_DEV §1, §16c, Q1 -->

<a id="A11.2"></a>
## A11.2 The rule of a list

A rule says which people belong to the list. A fixed list uses it once when it is made, an automatic list every time.

| Rule | Whom it finds | Name of the new list | Default sort |
|---|---|---|---|
| **Empty** | nobody, people are added by hand | – | **Manual** |
| **Family line** | the blood members of the family line ([A4](A4-surnames-and-families.md)) | the name of the family line | **Oldest first** |
| **Ancestors of a person** | the ancestors of the chosen person, **all generations** or **up to N generations** | “Ancestors – {person}” | **By generation** |
| **Descendants of a person** | the descendants of the chosen person, all generations or up to N generations | “Descendants – {person}” | **By generation** |
| **Research line** | the people of the research line, as the line's chip in the Table ([A6.7.14](A6-views.md#A6.7.14)) | the name of the line | **Oldest first** |
| **Added in a period** | the people added to the tree in the last 7, 30, 90 or another number of days ([A11.7](#A11.7)) | “Added in the last {n} days” | **By date added** |
| Table filter | the Table's rows after the filter and sort ([A11.6](#A11.6)) | the name of the view | **Manual** (the Table's order) |
| **Custom rule** (from app 3.32.0) | the people who meet conditions put together in groups ([A11.2.4](#A11.2.4)) | typed; from a template its name ([A11.2.10](#A11.2.10)); with a single condition **Family of a person** “Family – {person}” | **Oldest first** |

- **Partners:** a family line, ancestors and descendants take blood relatives only. A partner who came into the family
  by marriage is not in the list until added by hand.
- Generations can be chosen from 1 to 10, or **all generations**. The number of days is 1 to 3650. The day the list
  is worked out is the first day of the period (“in the last 30 days” = today and the 29 days before).
- The name follows the choice of rule until the field **Name** is typed over.
- Each choice shows the number of people the list would get. Research line is offered only in a tree with lines.
- **Keep up to date** (off by default) makes an automatic list; otherwise a fixed list is made: “Fixed list: the
  people are chosen now and change only by hand. The rule is kept for “Add from the rule”.”
- From app 3.32.0 the last option is **Custom rule** (“build from conditions”): instead of the choices the building
  of the rule shows ([A11.2.4](#A11.2.4)). **Custom rule ▾** goes back to another option; a rule with a single
  condition the option knows is taken over with its settings. A rule some option knows (one condition without
  “except”) is saved as that option's rule. **Edit rule…** of a list with a custom rule opens the building at once.
- From app 3.32.0 **Ancestors of a person** and **Descendants of a person** have the link **More options: family of a
  person…**: a custom rule with one condition **Family of a person** ([A11.2.6](#A11.2.6)).
- **Controls:** **Lists of people → New list…** → **Based on**, **Keep up to date**, **Create**; at a list
  **Edit rule…**. Then the dialog opens on the new list with the notice “List “{name}” saved.” From app 3.32.0 the
  line **Based on** also has **Start from a template ▾** on the right ([A11.2.10](#A11.2.10)).
- **Since:** app 3.30.0; 3.32.0: **Custom rule**, **More options: family of a person…**

<!-- zdroj: app:src/person-lists.ts rulePersonIds (rods/ancestors/descendants přes selection().memberIds – jen pokrevní, Q2; line přes personLineRole jako čip linie; tableFilter filterRows + sortRows; added: startOfDay − (days − 1) dní), ruleLabel · src/ui/person-list-new-ui.ts PERIODS 7/30/90, MAX_GENERATIONS 10, MAX_DAYS 3650, jméno podle pravidla do přepsání, počet u volby · ZADANI_DEV §3 (výchozí řazení podle pravidla), Q2 · app:e09dcacb · strings.ts lists.new.*, keep, keepOn, keepOff, create, toast.saved, rule.* · 3.32.0: src/ui/person-list-new-ui.ts (volba custom jako poslední, customToRule při uložení, moreFamily, Upravit pravidlo… vlastního pravidla rovnou do sestavení, newPersonListTemplateHtml), src/data.ts createCustomPersonList (řazení old), strings.ts lists.new.customRule, customRuleSub, fromTemplate, moreFamily, nameFamily (app:3a7e8595) -->

<a id="A11.2.1"></a>
### A11.2.1 Add from the rule

A fixed list made from a rule can use it again: **Add from the rule** adds the people the rule finds today who are
not in the list.

- A person removed from the list by hand does not come back this way, only when added by hand.
- The new people go to the end of the manual order, in the list's sort (with the manual sort **Oldest first**).
- Notice: “N people added from the rule.” with **Undo**; when nobody is added, “The list is complete.”
- A fixed list without a rule (made empty or from search results) does not have this option.
- **Controls:** the list's detail, the line **Created from** → **Add from the rule**.
- **Since:** app 3.30.0

<!-- zdroj: app:src/person-lists.ts withRuleFilled (bez personIds a removed, na konec, ruční → old), withPersonsRemoved (removed jen s pravidlem), withPersonsAdded (ruční přidání vyjme z removed) · strings.ts lists.fill, toast.filled, toast.full · ZADANI_DEV §3c -->

<a id="A11.2.2"></a>
### A11.2.2 Freezing an automatic list

**Freeze** turns an automatic list into a fixed one with its current people in their current order (“Becomes fixed
with the people it has now”). The rule stays as **Created from**, from app 3.32.0 a custom rule too.

- Notice “List frozen – it is fixed now.” with **Undo**.
- Up to app 3.31.0 a fixed list cannot be made automatic. From app 3.32.0 **Keep by the rule** (“Worked out again
  from the rule”) does it at a fixed list with a rule: the list is worked out from the rule again, the people added
  and removed by hand, the ticks and the manual order are dropped (**Manual** becomes **Oldest first**).
  - When there is something to drop, it asks first: “Keep by the rule?” – “The list will be worked out from the rule.
    People added ({a}) and removed ({r}) by hand and the manual order are dropped.” (the manual order only when the
    list has one).
  - Notice “The list follows the rule now.”
  - A checklist cannot: “First switch off Tick off done”.
- **Controls:** **⋯** of an automatic list → **Freeze**; from app 3.32.0 **⋯** of a fixed list with a rule → **Keep
  by the rule**.
- **Since:** app 3.30.0; 3.32.0: custom rule, **Keep by the rule**

<!-- zdroj: app:src/person-lists.ts withFrozen (dynamic false, personIds = listPersonIds, rule zůstává) · strings.ts lists.menu.freeze, freezeSub, toast.frozen · app:3dc8e709 · 3.32.0: src/person-lists.ts withFrozen (custom.auto false), keptByRuleLoss (added, removed, manual; null u pracovního), withKeptByRule (removed, done, checklist ven, manual → old) · src/ui/person-list-hooks.ts freezeAndChecklistRows, keepByRule (ptá se jen při ztrátě) · src/data.ts keepPersonListByRule · strings.ts lists.menu.keepByRule, keepByRuleSub, keepByRule.*, toast.keptByRule · app:5959ed63 -->

<a id="A11.2.3"></a>
### A11.2.3 A rule that finds nothing any more

When what the rule stands on disappears, the list stays, only empty, and says why:

- “The rule finds nothing any more: {name} was deleted.” (ancestors or descendants of a deleted person; the rule
  keeps the name from when it was made);
- “The rule finds nothing any more: the family line is gone.”;
- “The rule finds nothing any more: the line was removed.”
- Under the sentence are **Edit rule…** and **Delete list**.
- From app 3.32.0: a custom rule shows what is missing instead and counts a condition with a missing reference as
  empty ([A11.2.11](#A11.2.11)).
- **Since:** app 3.30.0; 3.32.0: custom rule

<!-- zdroj: app:src/person-lists.ts ruleBroken (person podle rule.personName, rod, line) · strings.ts lists.ruleGone, ruleGoneRod, ruleGoneLine, deleteList · ZADANI_DEV §7d -->

<a id="A11.2.4"></a>
### A11.2.4 Custom rule: conditions and groups

A **Custom rule** puts conditions ([A11.2.5](#A11.2.5)) together in groups. A group says how its conditions combine:
**All apply** (a person must meet each of them) or **Any applies** (one is enough).

- The conditions after the first start with “and” (**All apply**) or “or” (**Any applies**).
- **except** at a condition or group takes away the people who meet it. The items with “except” stand at the end of
  their group, and every person who meets any of them is taken away. The first item of a group cannot be “except”; a
  group of “except” items only finds nobody.
- A group is an item like a condition: it has its own **All apply** / **Any applies** and can have “except”. A rule
  has at most three levels (the whole rule is the first); the third level has no **+ Add group**.
- **Group with…** makes a group **All apply** of a condition and the condition under it. Two conditions with
  “except” join into one “except” group with **Any applies** (it takes away the same people).
- The row of a condition: the joining word, the name of the condition with its settings, its own number of people
  ([A11.2.9](#A11.2.9)) and **⋯**: **except** / **Include**, **Move up** / **Move down**, **Group with…**,
  **Duplicate**, **Remove**. **⋯** of a group: **except**, **Ungroup**, **Move up** / **Move down**, **Remove group**.
- Removing shows “Condition removed.” with **Undo**. Ctrl+Z (⌘Z) undoes the last step of building the rule; it does
  not undo changes of the tree.
- A new condition gets the default settings ([A11.2.5](#A11.2.5)); the person is the central person of the view.
- **Create** (when editing **Save**) waits for a rule that can be saved. The footer says why: “No condition yet”,
  “Condition {i} is incomplete”, “A group needs a condition without “except””, or “The rule cannot be saved like
  this” (an empty group, more than three levels, a loop through lists, [A11.2.8](#A11.2.8)).
- Closing the dialog with an unfinished rule with more than one edited condition asks: “Discard the unfinished
  rule?” (**Keep editing** / **Discard**).
- **Keep up to date** applies here too: on it makes an automatic list, off a fixed list with the people the rule
  finds now.
- **Add condition…** at a list with a rule opens the rule's dialog with the rule so far and the choice of a new
  condition; a rule from an option (e.g. **Ancestors of a person**) becomes the first condition. A fixed list keeps
  its people, only the rule **Created from** changes (then **Add from the rule**, [A11.2.1](#A11.2.1)).
- **Limits:** at most three levels of groups; undo of building the rule at most 50 steps. The limits of the settings
  are in [A11.2.5](#A11.2.5), the speed of counting in [A11.2.9](#A11.2.9).
- **Controls:** **New list…** → **Based on** → **Custom rule**; **+ Add condition** opens the catalog of conditions
  with the field **Find a condition**, **+ Add group** a group with one condition from the catalog. **⋯** of the
  rule: **Save as template…** ([A11.2.10](#A11.2.10)), **Clear the rule**. Moving a row: dragging by the handle (mouse
  only), Alt+↑ / Alt+↓ or **⋯**. **⋯** of a list or the link in the detail → **Add condition…** ([A11.3](#A11.3)).
  On a phone the joining word stands before the name of the condition and the menus are bottom panels.
- **Since:** app 3.32.0

<!-- zdroj: app:src/person-list-rules.ts (RULE_MAX_DEPTH 3; skupina all = průnik kladných, any = sjednocení, minus sjednocení kromě; ruleIssues: incomplete, depth, empty, exceptFirst, exceptOnly, cycle), src/person-list-rule-edit.ts (canExcept: ne první položka; toggleExcept na konec skupiny; canAddGroup; groupWithNext: dvě kromě → skupina any s kromě), src/ui/person-list-rule-ui.ts (UNDO_MAX 50, UNDO_MS 6000, řádek a ⋯, Ctrl+Z, ruleBuilderStartAdd, důvod v patičce), src/ui/person-list-new-ui.ts (startWith addCondition, ruleToCustom, discard u víc než jedné upravené podmínky, primární Vytvořit / Uložit), src/data.ts setPersonListCustomRule (pevný si nechá personIds) · strings.ts lists.rules.all, any, and, or, except, include, addCondition, addGroup, intoGroup, dissolve, removeGroup, remove, removed, clear, noConditions, incomplete, needPlus, cantSave, discard.*, firstOfGroup, catalog.search, lists.addCondition, lists.up, down, menu.dup · app:3a7e8595, ffc7ff32, 5959ed63, 0bd2e438 · spec 136 K1.1, K1.2, K1.5 -->

<a id="A11.2.5"></a>
### A11.2.5 Conditions of a custom rule

The catalog of conditions has the groups **Family and lines**, **Life in time**, **Places**, **Person**, **Facts**
and **From the tree and the Table**, in the order of the table.

| Condition | Whom it finds | Default settings and limits |
|---|---|---|
| **Family of a person** | the person and their relatives by steps up, down, sideways and through marriages ([A11.2.6](#A11.2.6)) | the central person; 2 up, 2 down, direct line only, blood only |
| **Ancestors of a person** | the ancestors of the person as the option **Ancestors of a person** ([A11.2](#A11.2)) | the central person; all generations or 1–10 |
| **Descendants of a person** | the descendants of the person as the option **Descendants of a person** | the central person; all generations or 1–10 |
| **Family line** | the blood members of the family line | the first family line of the tree |
| **Research line** | the people of the research line | the first line |
| **Another list** | the people of another list ([A11.2.8](#A11.2.8)) | the list is chosen |
| **Birth in a period** | the year of birth, without a birth date the year of baptism, in the range | years 1–2999, from, to, or from–to |
| **Death in a period** | the year of death, without a death date the year of burial, in the range | as for birth |
| **Marriage in a period** | the year a union of the person began in the range | as for birth |
| **Lived in a period** | people who were surely alive in some year of the range; a century can be chosen too | the 19th century (1801–1900) |
| **Age at death** | the age at death as the Table's column | up to 5 years; 0–130 |
| **Living / deceased** | living or deceased people as the Table's chip | living |
| **Place and surroundings** | birth, death, marriage or residence in the place and its surroundings ([A11.2.7](#A11.2.7)) | all four events, **place only** |
| **Sex** | women, men, or sex unknown | women |
| **Occupation** | people with any of the chosen occupations | the occupations are chosen (several too) |
| **Has a fact** | people who have the fact (**has**) or do not have it (**has not**) | has not: citation or source |
| **Count** | at least or at most N children, marriages or sources | at least 5 children; 0–999 |
| **Text in story or note** | text in the story, in the note, or in both | both; at most 200 characters |
| **Added in a period** | people added to the tree in 24 hours, 7 days, 30 days, or from a date ([A11.7](#A11.7)) | 7 days |
| **Changed in a period** | people whose data changed in the app, in the same periods | 7 days |
| **Saved Table filter** | the rows of a saved view of the Table (People or Unions) by a copy of its filter | the first saved view |

- The catalog offers only conditions the tree has data for: **Family line** only in a tree with family lines,
  **Research line** only with research lines, **Another list** only with more than one list, **Occupation** only with
  an occupation, **Saved Table filter** only with a saved view of the Table.
- **Periods:** a condition holds only when the whole span of the date lies in the period (“about 1820” is 1818–1822;
  “before 1850” has no start). A person without the date does not meet the condition.
- **Lived in a period:** a person lived from the end of the span of birth to the start of the span of death; without
  a death date “without a date of death, 90 years from birth are assumed” (until today at most), with a death date
  only the year of death, without both dates the person does not meet the condition.
- **Has a fact:** birth date, birth place, death date, death place; citation or source, photo, material; parents,
  partner, children; story, note; in a tree from the research also conflict (an undecided conflict of the research)
  and open research task.
- **Count:** children are own children; marriages and sources are counted as in the Table's columns.
- **Text:** “ignoring case and accents”.
- **Changed in a period:** the time of a change is recorded at a person when their data, events, citations or parents
  change in the app, and at both partners when their union changes; a new person has none (it has the date added). The
  condition shows “the change time is recorded from version 3.32 – older edits do not count”.
- **Saved Table filter:** the condition holds a copy of the filter (“a copy of the filter: {view}”); a later change
  of the Table's view does not change it.
- **Since:** app 3.32.0

<!-- zdroj: app:src/types.ts RuleCondName (21 podmínek) · src/person-list-rules.ts (spanInside celé rozpětí, ABOUT_YEARS 2, LIFE_YEARS_WITHOUT_DEATH 90, livedSpan, born birthOrBaptism, died deathOrBurial, married startDate svazku, count children / uCount / srcCount, has: čipy a buňky Tabulky, conflict nerozhodnutý, openTask, text fold bez diakritiky, added/changed hours 24 / days / since, gender unknown) · src/ui/person-list-rule-editors.ts ruleCatalog (skupina, pořadí, available) · src/ui/person-list-rule-cond-editors.ts (výchozí: deathAge to 5, has nemá source, count děti aspoň 5, rod první rod, line první linie, tableFilter první pohled; HAS_GROUPS, výzkum jen ve stromu z výzkumu; CHANGED_FROM 3.32) · src/person-lists-data.ts stampChangedAt · strings.ts lists.rules.cond.*, catalog.head.*, has.*, livedHint, textHint, changedFrom, filterCopy, countWhat, cmp · app:ffc7ff32, 6f3847ec, 4bc39c94 · spec 136 K1.1 -->

<a id="A11.2.6"></a>
### A11.2.6 Family of a person

**Family of a person** takes the person and their relatives by steps in four directions. The person is always in the
result.

| Direction | Choices |
|---|---|
| **Up** | 0–10 generations or **all**; **through both parents**, **through the father**, **through the mother** |
| **Down** | 0–10 generations or **all** |
| **Sideways** | **direct line only**, **+ siblings**, **+ cousins** up to the 1st–5th degree or **all degrees** |
| **Spouses** | **blood only**, **+ spouses**, **+ spouses' families** |

- **through the father** and **through the mother** apply in every step up. With two parents of the same sex the
  father's side is the first of them.
- **+ siblings** are the siblings of the person and of every ancestor within the reach of **Up**. **+ cousins** up to
  the Nth degree are all the descendants of the ancestors up to N + 1 generations up (the 1st degree are first
  cousins), at most within the reach of **Up**.
- **+ spouses** adds the partners of all the people in the result, **+ spouses' families** also the parents and
  siblings of these partners.
- A step goes only through own parents and children; a link of a step-parent or foster parent does not count. A step
  goes through a placeholder person, a placeholder person is not in the result.
- **Quick choice** sets the directions at once; a choice is on only when the directions match it exactly:

| Quick choice | Up | Down | Sideways | Spouses |
|---|---|---|---|---|
| **Closest family** | 1 | 1 | + siblings | + spouses |
| **Ancestors** | all | 0 | direct line only | blood only |
| **Descendants** | 0 | all | direct line only | blood only |
| **Blood relatives** | all | all | + cousins of all degrees | blood only |
| **Whole family with marriages** | all | all | + cousins of all degrees | + spouses' families |
| **Paternal line** | all through the father | 0 | direct line only | blood only |
| **Maternal line** | all through the mother | 0 | direct line only | blood only |

- Under the settings is the condition in words, e.g. “Family: {person}, 2 generations up, 2 generations down” or with
  a quick choice “Closest family: {person}”.
- A single condition **Family of a person** only up or only down (through both parents, direct line only, blood only)
  is saved as the rule **Ancestors of a person** / **Descendants of a person**.
- **Controls:** the condition **Family of a person** in the catalog; **More options: family of a person…** at
  **Ancestors of a person** and **Descendants of a person** ([A11.2](#A11.2)); **Person's menu → Add to list › →
  List from this person’s family…** (quick choice **Closest family**, [A11.5](#A11.5)).
- **Since:** app 3.32.0

<!-- zdroj: app:src/lineage.ts familySet (seenUp, via v každém kroku, parentInRole, siblings osoby a předků v dosahu, cousins: potomci předků do degree + 1 v dosahu up, spouses / families: rodiče a sourozenci partnerů, zástupné ven, descentParents bez nevlastních a pěstounských), FAMILY_PRESETS, familyPresetOf · src/ui/person-list-rule-family.ts (FAMILY_GEN_MAX 10, FAMILY_COUSIN_MAX 5, pořadí rychlých voleb, nápověda slovy) · src/person-list-rules.ts customToRule (family → ancestors / descendants) · src/ui/person-list-add.ts LIST_FROM_FAMILY_ACTION (FAMILY_PRESETS.closest) · strings.ts lists.rules.family.*, preset.*, say.family, say.preset, contextMenu.listFromFamily · app:ffc7ff32, 007581af · spec 136 K1.1 -->

<a id="A11.2.7"></a>
### A11.2.7 Place and surroundings

**Place and surroundings** finds the people who have the chosen event in the place or in its surroundings.

- **Events:** birth (baptism too), death (burial too), marriage (the place where the union began), residence; by
  default all four.
- The place is chosen from the places of the tree (places of birth, death, marriage and residence), those with the
  most people first.
- The place includes its houses (a place with a house number or street of the same town); **including places under
  it** (only when the place's record in the research has places under it) adds those too.
- **Surroundings:** **place only**, **5 km**, **10 km**, **25 km**, **50 km**, or **other…** (default 100 km,
  1–500 km). The surroundings take every place of the tree whose location on the Map is within the chosen distance
  from the place's location (as the crow flies).
- Above the places is a summary (“Within {km} km: N places · M places of the tree without a location”) and **Show
  places ›**: the first 6 places, then “… and N more”; places without a location are under “Without a location (not
  counted)” with **Add locations on the Map ›**.
- A place without a location counts by name only (“The place has no location on the map – by name only.”); the
  distance cannot be chosen then and choosing such a place sets it back to **place only**. A tree without place
  locations: “The tree has no place locations – surroundings work once locations are added on the Map.”
- **Limits:** surroundings at most 500 km. A place without a location on the Map is not counted in the surroundings.
- **Since:** app 3.32.0

<!-- zdroj: app:src/person-list-rules.ts NEAR_MAX_KM 500, placeIndexOf (birthPlace, baptism a birth; residence; startPlace svazku; deathPlace, burial a death), nearKeys (townKey: dům téže obce, below keysBelow, km > 0 haversineKm od geoOfKey), rulePlaceChoices (nejvíc osob první) · src/ui/person-list-rule-near.ts (KM_PRESETS 0/5/10/25/50, KM_OTHER 100, 6 míst a more, unplaced, noCoords, noneInTree) · strings.ts lists.rules.near.*, say.events · app:ffc7ff32, cbcb7673 · spec 136 K1.1 -->

<a id="A11.2.8"></a>
### A11.2.8 Another list

**Another list** takes the people of another list: of a fixed list its people, of an automatic list those its rule
finds now.

- A list through which the rule would lead back to the list being edited (through other lists too) is unavailable in
  the choice, with the path of the loop: “would make a loop: {A → B → A}”. A rule with a loop cannot be saved.
- From 9 lists the choice has a field **Search**.
- Deleting a list that another list uses asks first ([A11.3](#A11.3)); the condition then shows as “missing”
  ([A11.2.11](#A11.2.11)).
- **Limits:** the condition is in the catalog only when the tree has more than one list.
- **Since:** app 3.32.0

<!-- zdroj: app:src/person-list-rules.ts listCycle („A → B → A“), ruleIssues cycle, condSet list (listMembers, visiting), listUsedBy · src/ui/person-list-rule-cond-editors.ts list (available: víc než jeden seznam, hledání od 9) · strings.ts lists.rules.cycle, cond.list · spec 136 K1.7 -->

<a id="A11.2.9"></a>
### A11.2.9 Counts and Show in the tree

Building a rule shows counts: each condition and group its own number of people in the whole tree, the footer the
number of the whole rule (“N people match”, or “Nobody matches”).

- An incomplete condition is not counted in the number of the whole rule.
- When a rule with **All apply** finds nobody, the item after which the result fell to zero has the mark “0 here”.
- The counts are worked out again 120 ms after the last change. When the previous counting took longer than 200 ms,
  the footer first shows “Counting…” with the previous number (“so far N people”).
- **Show in the tree** (next to the count, only when someone matches and the rule can be saved): the dialog is
  hidden, not closed; the **Family** view shows (another view switches to it) with the people of the rule highlighted
  and the title “Rule preview · N people”. **Back to the rule**, × and Esc end the highlight, return the previous view
  and show the dialog as it was.
- **Controls:** on a phone **⋯** of the rule → **Show in the tree**.
- **Since:** app 3.32.0

<!-- zdroj: app:src/person-list-rules.ts evalRuleCounts (vlastní počet každé položky nad celým stromem, neúplné mimo celek, zeroAt jen u celku 0 a op all) · src/ui/person-list-rule-ui.ts RULE_COUNT_DEBOUNCE_MS 120, RULE_COUNT_SLOW_MS 200, ruleBuilderCountsBusy · src/ui/person-list-new-ui.ts newPersonListFootExtraHtml, newPersonListMoreRows (telefon), showNewPersonListInTree (skryté overlaye, setViewMode family, highlightGroup rulePreview), backToNewPersonList · strings.ts lists.rules.match, nobody, zeroHere, computing, previous, showInTree, preview, backToRule · app:ffc7ff32 · spec 136 K1.3, K1.4 -->

<a id="A11.2.10"></a>
### A11.2.10 List templates

A template is a ready custom rule. It is offered when a new list is made: **Start from a template ▾** on the right of
the line **Based on** (on a phone **⋯** of the custom rule → **Start from a template…**).

| Group | Template | Rule |
|---|---|---|
| **What research lacks** | **Ancestors without a source** | ancestors of a person and without a citation or source |
| | **Ends of lines** | ancestors of a person and without parents |
| | **Without birth date or place** | without a birth date or without a birth place |
| | **People with a conflict** | has a conflict (a tree from the research only) |
| | **In progress** | has an open research task (a tree from the research only) |
| **Family and lines** | **Direct paternal line** | **Family of a person**, quick choice **Paternal line** |
| | **Descendants to N generations** | descendants of a person, 3 generations |
| | **From a place and surroundings** | birth, death, marriage or residence within 10 km of the place |
| | **Died in childhood** | age at death up to 5 years |
| **Stories and sharing** | **Ancestors without a photo** | ancestors of a person and without a photo |
| | **Living people** | living |
| | **Recently added** | added in the last 7 days |

- The menu **Templates** has the own templates at the top (**Own**), then the built-in ones by group, without counts.
  A template that needs a person or place has “needs a person” / “needs a place”. A template with a condition the
  tree does not offer ([A11.2.5](#A11.2.5)) is not in the menu.
- Choosing a template opens the custom rule with its conditions and at once the choice of the first missing person or
  place. The list's name is the template's name, after the person or place is filled in “{template} – {person}”,
  until it is typed over.
- Above the rule stands “From template: {template}” and **Drop the template**: the rule is emptied and the name
  follows the rule again.
- A rule from a template can be edited like any other. The list remembers which template it came from
  ([A11.3](#A11.3)); the name of a built-in template is in the app's language.
- **Save as template…** (**⋯** of the custom rule) opens the dialog **Save as template** with the field **Template
  name** (by default the list's name) and the note “People, places and lists are not saved in a template – they are
  filled in when it is used. The template is saved on this device and works in other trees too.” Family lines and
  research lines are not saved either.
  - A taken name is outlined: “A template with this name exists. Suggested: “{name} (2)”.”; **Save** takes the
    suggested one.
  - **⋯** of an own template in the menu: **Rename…** (the dialog **Rename template**), **Delete** (the notice
    “Template “{name}” deleted.” with **Undo**).
- **Limits:** templates only when a new list is made, not when a rule is edited nor at **Save as list of
  people…**. Own templates belong to the device (the app's settings in this browser), not to the tree.
- **Since:** app 3.32.0

<!-- zdroj: app:src/person-list-templates.ts LIST_TEMPLATES (12, skupiny missing / family / story, research jen ve stromu z výzkumu), templateRoot, listTemplateName (vestavěná podle jazyka, app:29c57b0e) · src/person-list-rules.ts stripTemplateParams (osoby, místa, seznamy, rody, linie), makeListTemplate, ruleNeeds · src/ui/person-list-new-ui.ts offeredTemplates (ruleOffered), openNewPersonListTemplates, applyNewPersonListTemplate (origin template, otevře první chybějící), dropNewPersonListTemplate, openNewPersonListTemplateActions, openListTemplateNameDialog (freeTemplateName), newPersonListMoreRows · src/types.ts ListTemplate (nastavení listTemplates, ne strom) · strings.ts lists.templates.*, lists.new.fromTemplate · app:58ad425d, 7f13e899 · spec 136 K1.9 -->

<a id="A11.2.11"></a>
### A11.2.11 A missing person, place or list in a rule

When a person, place, list, family line or research line a custom rule refers to disappears from the tree, the rule
stays and the reference shows as “missing”.

- A condition with a missing reference counts as empty: it finds nobody, with “except” it takes nobody away.
- In the builder the condition has “{name} – missing” and its **⋯** offers first **Choose another person…**
  (**Choose another place…**, **Choose another list…**, **Choose another family line…**, **Choose another research
  line…**).
- An automatic list says so in the overview (“automatic · The rule refers to a missing person”, …) and in the detail
  (“The rule refers to a missing person: {name} – the condition counts as empty.”) with **Edit rule…**.
- Merging people: the kept person takes over a reference to the removed one.
- Deleting a list that another list uses asks first ([A11.3](#A11.3)); **Undo** brings back the list and the
  references.
- **Since:** app 3.32.0

<!-- zdroj: app:src/person-list-rules.ts condMissing (person, place, list, rod, line), customMissing, chybějící odkaz = prázdná množina · src/ui/person-list-rule-ui.ts (gone, pickOther první v ⋯) · src/ui/person-lists-ui.ts listMissing (jen automatický), rowMeta is-warn, pl-note--warn s edit-rule · src/person-lists-data.ts onPersonsMerged (customWithPersonMerged) · strings.ts lists.rules.missing, gone, pickOther.*, missingRef.*, missingNote · app:c76a8954 · spec 136 K1.7 -->

<a id="A11.3"></a>
## A11.3 Managing the lists: Lists of people

All the lists of the tree are in one place, the dialog **Lists of people**: the overview on the left, the chosen list
on the right.

- **Overview:** each list with the icon of its kind, its name, the number of people and a line under the name
  (**fixed · changed …**, **automatic ·** the rule, **checklist · a of b left**). Sorted **By name** or **By change**.
  From 9 lists there is a field **Search the lists** above them (regardless of diacritics).
- **Detail:** the name (renamed in place: a click, ✎ or F2; Enter saves, Esc goes back), the badge of the kind, the
  line of the rule (**Based on** / **Created from**), the summary ([A11.3.1](#A11.3.1)) and **People in the list · N**
  with the sort ([A11.4](#A11.4)). In a fixed list × at a person (**Remove from the list**) and **Add person…**
  ([A11.5](#A11.5)). Beside a person, depending on the sort, is the generation, the date added or the birthplace.
- From app 3.32.0 the line of the rule gives the rule in words on at most two lines (four on a phone), whole in the
  tooltip; on a phone **Whole rule ›** opens the rule's dialog (in a read-only tree it unfolds the whole text). A
  custom rule in words: the conditions one after another separated by “ · ”, each after the first with “and” or “or”,
  the conditions with “except” at the end (“except A or B”), groups in brackets; e.g. “Ancestors: {person}, all
  generations · and without a citation or source”.
  - Under the rule is where the list came from: “From template “{template}” · {date}”; nothing for a list made by
    hand.
  - A list with a rule has next to **Edit rule…** / **Add from the rule** also **Add condition…**
    ([A11.2.4](#A11.2.4)).
- **⋯ of a list** (at a row in the overview and in the detail): **Open in Table**, **On the map** (from app
  3.31.0), **Rename**, **Duplicate**,
  **Tick off done** (fixed, [A11.8](#A11.8)) or **Freeze** (automatic, [A11.2.2](#A11.2.2)), **Export ›**
  ([A11.9](#A11.9)), **Delete**. From app 3.32.0 a list with a rule has **Add condition…** before them
  ([A11.2.4](#A11.2.4)) and a fixed list with a rule also **Keep by the rule** after **Tick off done**
  ([A11.2.2](#A11.2.2)).
  - **Open in Table** closes the dialog and opens the Table in the list's scope ([A6.7.19](A6-views.md#A6.7.19)).
  - **On the map** (also a button next to **Open in Table** in the detail) closes the dialog, sets the list as the
    window's selection ([A6.6](A6-views.md#A6.6)) and opens the Map with the scope **Selection**
    ([A6.5.7](A6-views.md#A6.5.7)). In another window the main window carries it out; without it **On the map** is
    unavailable ("The main window is not open.").
  - **Duplicate** makes a copy of the same kind with the same rule, order, people removed by hand and people ticked
    off, named “{name} (2)”.
  - **Delete** does not ask: the notice “List “{name}” deleted.” with **Undo**. From app 3.32.0 it asks when another
    list uses the list in the condition **Another list**: “Delete the list “{name}”?” with “The list has N people;
    the people stay in the tree.” and “Used by: {lists}. The “Another list” condition shows as “missing” there.” (at
    most three names, then “and N more”) and the note “Deleting can be undone – the list and the references to it
    come back.”
- **Limits:**
  - the detail shows at most 200 people: “The first 200 of N people.” with a link to the Table, which has them all;
  - every change of a list is one **Undo** step; making (a duplicate too), renaming, freezing and deleting are
    recorded in the change history;
  - in another window of the app ([A6.8](A6-views.md#A6.8)) a change of a list is saved through the main window.
- **Controls:** **Actions → Lists of people…**; on a phone **More → Lists of people**; in the Table **Scope ▾ →
  Manage lists…**. Keys in the overview: ↑ ↓ choose, Enter renames, Delete deletes, Esc closes the dialog. On a phone
  the overview and the list take turns on the whole screen (‹ **Back to the lists**), **⋯** is a bottom panel.
- **Since:** app 3.30.0; 3.32.0: the rule in words, the origin of a list, **Add condition…**, the question before
  deleting a list another list uses

<!-- zdroj: app:src/ui/person-lists-ui.ts (OVERLAY_ID person-lists-modal, SEARCH_FROM 9, LIST_DETAIL_ROWS 200, NARROW_QUERY, přejmenování klik/✎/F2, klávesy ↑↓ Enter Delete) · src/ui/person-list-hooks.ts listMenu (freezeAndChecklistRows, exportRows) · src/data.ts duplicatePersonList (structuredClone, suggestPersonListName), deletePersonList (Vrátit), storePersonList audit (personList.save, :2224 přejmenování, :2254 personList.delete, :2330 zmrazení) · index.html #actions-lists-row · src/ui/bottom-sheet.ts řádek Seznamy osob v listu Více · strings.ts menu.lists, lists.title, search, byName, byChange, changed, left, people, remove, addPerson, openTable, menu.*, large, back, toast.deleted, undo.*, audit.* · app:4acf7a09, 3dc8e709 · ZADANI_DEV §2, §16 (okna 079: WindowEditSink) · 3.31.0 Na mapě: src/ui/person-lists-ui.ts (tlačítko pl-onmap v detailu, ⋯ řádek map za open), src/ui/person-list-hooks.ts showOnMap, src/windows/window-show-on-map.ts, strings.ts lists.onMap, onMapTitle, table.onMapNoMain (app:2a578474, 39020cf1, ZADANI_DEV_vyber-osob §6) · 3.32.0: src/ui/person-lists-ui.ts (pl-rule-t s title, pl-rule-whole: edit-rule nebo whole-rule ve stromu jen ke čtení, listOriginText, add-condition, deletePersonList s listUsedBy: 3 jména a more, showConfirm danger s note), src/person-list-rules.ts customLabel (·, a zároveň / nebo, kromě na konci), src/person-lists.ts listRuleLabel, src/ui/person-list-hooks.ts freezeAndChecklistRows · strings.ts lists.wholeRule, origin.*, addCondition, deleteTitle, deletePeople, deleteUsedBy, deleteUsedNote · app:c76a8954, 5959ed63 · spec 136 K1.4, K1.7 -->

<a id="A11.3.1"></a>
### A11.3.1 The summary of a list

The list's detail sums up its people in tiles: **people** · **born** (the earliest and latest year of birth, without
years “–”) · **with photo** · **with citation** · **with story**; a checklist first also **left**.

- **With citation** is a person with at least one source citation at the person, their facts, events or unions.
- Under the tiles is the link “N without citation ›”: it opens the Table in the list's scope with the chip
  **No source**.
- **Since:** app 3.30.0

<!-- zdroj: app:src/person-lists.ts listSummary (birthMin/Max, photo, personEvidence sources > 0, story.text, noCite, left jen u pracovního) · src/ui/person-list-hooks.ts openInTable (noSource) · strings.ts lists.sum.* · app:211323e8 (Otevřít v Tabulce s čipem Bez pramene) · spec 084 K8.2 -->

<a id="A11.4"></a>
## A11.4 The order of a list

A list has one of five sorts. The Table (the column **#**) and export use the list's order.

| Sort | Order |
|---|---|
| **Oldest first** | by date of birth; without a date at the end |
| **By generation** | in a list of ancestors or descendants the generation from the person of the rule, otherwise the generation as in the Table's column; within a generation oldest first |
| **Alphabetically** | surname, then given name, by the app's language |
| **By date added** | the most recently added first; people without the date added at the end |
| **Manual** | the order a fixed list holds |

- Only a fixed list has **Manual**. For an automatic list the option is unavailable: “Only a fixed list has a manual
  order – Freeze”.
- Switching to another sort does not delete the manual order; back on **Manual** it is as it was. A newly added
  person goes to the end of the manual order.
- Every move is one **Undo** step; a screen reader announces it (“Moved: … is at position 3 of 12.”).
- **Controls:** **Sort: … ▾** above the list's people. Manual order: dragging a row by its handle (mouse or finger),
  Esc cancels the drag; Alt+↑ / Alt+↓ on a row; **⋯** of a person → **Move up** / **Move down**. On a phone there is
  no handle, only **⋯**.
- **Since:** app 3.30.0

<!-- zdroj: app:src/person-lists.ts sortListIds (old birthKey, gen ruleGenerations / assignGenerations, name Intl.Collator, added sestupně bez data na konec, manual), withSort (automatický bez manual), withPersonMoved, withManualOrder, withPersonsAdded (na konec) · src/ui/person-lists-ui.ts úchyt, Alt+↑/↓, Esc · strings.ts lists.sortBy, sort.*, manualOff, handle, up, down, moved · app:3dc8e709 · ZADANI_DEV §5 -->

<a id="A11.5"></a>
## A11.5 Add to list and remove

A person can be added to a fixed list from the person's menu, from the Table, from search results and from the
list's detail. An automatic list does not change by hand, so the menus do not offer it (“Automatic lists fill
themselves from their rule.”).

- **Person's menu → Add to list ›:** the fixed lists by last change, at most 8, then **More lists…**; a list the
  person is in has ✓ and a click takes them out of it. Below them **New list with this person…**: the dialog of a new
  list ([A11.2](#A11.2)), the option **Empty** with this person; for **Ancestors of a person** and **Descendants of a
  person** this person is preselected. On a phone a second page of the person's panel. From app 3.32.0 below it is
  also **List from this person’s family…**: the dialog of a new list with the custom rule **Family of a person** of
  this person in the quick choice **Closest family** ([A11.2.6](#A11.2.6)).
- **Table:** the row's menu → **Add to list ›** (the row's person; for a union both partners, for an event its
  people). A selection across several rows: **Add N people to a list ›** and **New list with these people…**. In the
  scope of a fixed list the row's menu also has **Remove from the list** ([A6.7.19](A6-views.md#A6.7.19)).
- **Search results → Results to a list ›:** adds all the results, not only those shown, or starts **New list from the
  results (N)…** (fixed, named “Search: {query}”).
- **List's detail → Add person…:** people picked by name, several at once; people already in the list are grey
  (“already in the list”).
- A person already in the list is not added twice (“All of them are already in “{list}”.”). A removed person is no
  longer ticked off.
- Removing has **Undo** in the notice.
- **Limits:** a read-only tree has none of these menus ([A11.1](#A11.1)).
- **Since:** app 3.30.0; 3.32.0: **List from this person’s family…**

<!-- zdroj: app:src/ui/person-list-add.ts MENU_LISTS 8, addTargets (pevné podle updated), personListMenuRows (✓, Další seznamy…, Nový seznam s touto osobou…, poznámka), listMenuEntries (víc osob, bez zdvojení), showAddPersonsToList (PICK_ROWS 200, inList) · src/ui/context-menu.ts getPersonMenuActions (za Hledat v archivech) · src/ui/person-list-new-ui.ts:215 (personIds → volba Prázdný s osobami; jedna osoba = osoba pravidla předků a potomků) · src/ui/table-view/table-ui.ts showTableRowMenu (toListN, tableAreaRowKeys, svazek oba partneři) · src/ui/search.ts (Výsledky do seznamu, všechny výsledky) · src/person-lists.ts withPersonsRemoved (done ven) · strings.ts contextMenu.toList, newListWith, newListWithMany, autoListsNote, moreLists, table.act.toListN, search.toList, newFromResults, lists.save.searchName, inList, addN, toast.added, removed, addedN, allIn · app:68363dbe · ZADANI_DEV §4 · 3.32.0: src/ui/person-list-add.ts LIST_FROM_FAMILY_ACTION (FAMILY_PRESETS.closest), strings.ts contextMenu.listFromFamily (app:007581af, spec 136 §12) -->

<a id="A11.6"></a>
## A11.6 Saving a view as a list

Some views can be saved as a list: only where a choice of people makes sense.

| From | Option | Default |
|---|---|---|
| Table › People | the Table's **⋯** or the menu **View** → **Save as list of people…** | fixed: the people in the order of the Table's rows |
| Table › Unions | the Table's **⋯** → **Save as list of people…** | fixed: both partners of each union, each person once |
| search results | **Results to a list ›** ([A11.5](#A11.5)) | fixed only |
| the window's selection | **Selection ▾**, the footer **Save the selection as a list…** (family line, ancestors, descendants, research line; [A6.6.1](A6-views.md#A6.6.1)); up to app 3.30.0 only a family line: **Save the {family line} family line as a list…** | automatic |
| research line | **⋯** of the line → **Save as list…** | automatic |

- From the Table the people after the filter and sort are saved; rows shown for now are not. A pinned row outside the
  filter is not saved (“The pinned row outside the filter (…) is not saved.”).
- **Keep in line with the filter** makes an automatic list with a copy of today's filter and sort of the Table. A
  later change of the Table's view does not change it. **Edit rule…** of such a list opens the Table with its filter
  and the Table's **⋯** offers **Save to the list {name}**.
- **Limits:** Events, Sources and the Family, Descendants, Fan, Timeline and Map views are not saved as a list.
- **Since:** app 3.30.0

<!-- zdroj: app:src/ui/person-list-new-ui.ts (SAVE_ID person-list-save; zdroje table/unions/search/rod/line, pinOut, keepFilter) · src/ui/table-view/table-ui.ts saveTableAsList, saveTableRule (lists.saveRule), canSaveAsList · src/ui/rod-view.ts (rodView.saveList) · src/ui/research-directions-ui.ts:1127 directionSaveListItem · src/person-lists.ts rulePersonIds tableFilter (unions: p1, p2) · strings.ts lists.saveAs, save.*, saveRule, rodView.saveList, research.dirSaveList · app:e09dcacb, 68363dbe, 211323e8 · ZADANI_DEV §6 · spec 084 K1.4, K6.3 a · 3.31.0: src/ui/selection-picker-ui.ts saveListOptions (rod, line, selection = předci/potomci), person-list-new-ui.ts dynamic pro rod/line/selection, strings.ts selection.saveList (app:61873988, ZADANI_DEV_vyber-osob §2) -->

<a id="A11.7"></a>
## A11.7 When a person came: Added in the last 30 days

From app 3.30.0 the tree remembers for each person when they came into it. The date is not edited by hand and does
not show on the person's card; the rule **Added in a period**, the sort **By date added**, the column **Added** in the
Table ([A6.7.2](A6-views.md#A6.7.2)) and grouping in the Table ([A6.7.20](A6-views.md#A6.7.20)) use it.

- **When it is recorded:**
  - a new person in the app: the time it is made (a placeholder person only once it becomes a real person);
  - loading a GEDCOM file: the day of loading;
  - merging trees: the time of the merge for the people who came into the tree; a merged person keeps the earlier
    date;
  - a new person from the research: the date the research gives for them, otherwise the time of loading.
- People from before 3.30.0 do not have the date (in the list's detail, in the column **Added** and in the Table's
  groups “earlier”); nothing is worked out afterwards.
- **Added in the last 30 days** is a ready-made automatic list of every tree, also a new or loaded one. The period can
  be changed (**Edit rule…**); the name then follows the period until the list is renamed. Once deleted it does not
  come back. Empty, it says “Nothing yet – the date added is recorded from version 3.30.”
- **Limits:** GEDCOM does not carry the date. An export with living people protected leaves it out for living people
  ([A7.2](A7-book-pages-and-export.md#A7.2)).
- **Since:** app 3.30.0

<!-- zdroj: app:src/data.ts:2636 createPerson (addedAt, ne zástupná), :2847 zástupná osoba při první úpravě, :5435 mergePersons earlierAddedAt · src/ged-parser.ts:6594 stampAddedAt(origin.at) · src/merge/executor.ts:573 (mergedAt), :1962 · src/person-lists-data.ts builtinAdded30, personListsOf (i nový strom a import, personListsDropped), keepPersonListData, stampResearchTree (research.added nebo now) · src/person-lists.ts listDisplayName (jméno podle období do přejmenování) · src/ui/person-lists-ui.ts:41 ADDED_SINCE '3.30', :534 lists.earlier · src/ui/table-view/table-group.ts:238 · src/privacy.ts:373 (stripDetails žijících: delete addedAt) · strings.ts lists.builtin.added30, addedNone, earlier · ZADANI_DEV §8, Q3 · app:714a8ab2 · sloupec Přidáno app:0971647c (table.earlier) -->

<a id="A11.8"></a>
## A11.8 A checklist: Tick off done

A fixed list can be used as a checklist: each person has a box and the people done are ticked off.

- A person done is struck through in the detail. Above the people is **All** / **Left N** / **Done N**, in the
  overview “a of b left” and in the summary the tile **left**.
- Ticking off belongs to the list, not to the person: a duplicate of the list takes it over, another list does not.
  A removed person is no longer ticked off.
- Switching **Tick off done** off does not delete the ticks; switched on again, they are back.
- A tick is an **Undo** step, without a notice.
- In the Table in the scope of a checklist there is the column **Done** and the chips **Left** and **Done**
  ([A6.7.19](A6-views.md#A6.7.19)).
- **Limits:** an automatic list cannot be ticked off. In a read-only tree the people done show without boxes.
- **Controls:** **⋯** of a fixed list → **Tick off done** (✓); the box by a click or Space.
- **Since:** app 3.30.0

<!-- zdroj: app:src/person-lists.ts withChecklist (vypnutí drží done), withDoneToggled, withPersonsRemoved (done ven), listSummary left · src/data.ts duplicatePersonList (done převezme) · src/ui/person-lists-ui.ts zaškrtávátka, segment · strings.ts lists.menu.work, filter.*, left, sum.left, table.col.done, table.chip.left, chip.done · app:3dc8e709, 211323e8 · ZADANI_DEV §13 · spec 084 K8.4 -->

<a id="A11.9"></a>
## A11.9 Exporting a list

A list can be exported in two ways: as a part of the tree (GEDCOM, JSON backup) or as a table (CSV).

- **Export dialog → What to export → List of people:** the option **List** offers the lists of the open tree that
  have people. **GEDCOM export** then holds the people of the list and the families between them, the **JSON backup**
  the tree's data narrowed to the people of the list. Protecting the living and the file's content apply as for the
  whole tree ([A7.2](A7-book-pages-and-export.md#A7.2), [A7.3](A7-book-pages-and-export.md#A7.3)). The other formats
  are unavailable: “This format exports the whole tree”. The choice is remembered; a list that is gone returns the
  choice to **Whole tree**.
- **⋯ of a list → Export ›:**
  - **GEDCOM…** opens the Export dialog on this list;
  - **CSV (list order)** downloads at once the table of the list's people in its order: the columns as the Table ›
    People has them, before them **#** (and **Done** for a checklist). File `{tree}_{list}_{YYYY-MM-DD}.csv`.
- **Lists in the export:** a JSON backup of the whole tree carries the lists whole. An export of a part of the tree
  (a list, **Current view only**) keeps in fixed lists only the people of that part and leaves out a list with nobody
  left. Automatic lists stay whole; their rule works with what the part has.
- The names of lists stay in the export, also with living people protected.
- **Limits:** GEDCOM does not carry lists, not even for the whole tree. An exported HTML page only shows the lists and
  opens them in the Table.
- **Since:** app 3.30.0

<!-- zdroj: app:src/ui/import-export.ts exportableLists (jen s osobami, podle jména), scope 'list' (neplatný seznam → tree), exportScopeList, exportPersonListJSON (exportFocusedJSON), GEDCOM podstrom (:389), option.disabled scopeWholeOnly · src/subtree.ts:153 subsetForSubtree · src/person-lists-data.ts subsetForSubtree (pevný zúžit, prázdný ven, automatický celý) · src/ui/table-view/table-ui.ts:3215 exportPersonListCsv (leadColumnsOf: # a Hotovo, shownColumns persons, tableCsvFileName) · src/ui/person-list-hooks.ts exportRows (jen seznam s osobami) · strings.ts exportMenu.scopeLabel, scopeList, listPick, backupListDesc, gedcomListDesc, scopeWholeOnly, scopeView, lists.menu.export, export.ged, export.csv · app:33fa6cd4 · dirigent:MILAN.md 35 (4) jména seznamů v exportu zůstávají -->

<a id="A11.10"></a>
## A11.10 Lists in the data of the tree

Lists are part of the tree (data version 22): they go with the tree into the backup and transfer, and every change
of them has an **Undo** step.

- **A deleted person** disappears from all lists, the order of the others stays. The notice of the deletion says so
  (“… deleted, also removed from 2 lists.”); **Undo** returns them to the lists too.
- **Merged people:** the kept person takes the place of the removed one; when both are in a list, the person stays
  once at the earlier position. The person is done when either was done; removed by hand only when both were. From
  app 3.32.0 the kept person also takes over the references of custom rules.
- **A tree from the research** keeps its lists and the dates added when a new version is loaded from the research,
  from app 3.32.0 also the custom rules, the origins of lists and the change times of people.
- From app 3.32.0 (data version 26) a list also carries a custom rule and its origin (a template), and a person the
  time of the last change (for **Changed in a period**).
  - A list with a custom rule also has the people the rule found at the last save stored; an app that does not know
    custom rules therefore shows it as a fixed list with these people.
  - A custom rule the app cannot read whole (from a newer version) is kept unchanged and the list is held as fixed
    with the stored people; an app that can read the rule uses it again.
  - Own templates are not in the tree ([A11.2.10](#A11.2.10)).
- **Limits:** an older app (from 3.19.0) opens a tree with lists read-only and does not save it, so the lists are not
  lost ([A6.7.7](A6-views.md#A6.7.7)). A tree saved by app 3.32.0 (data version 26) opens read-only in an older app.
- **Since:** app 3.30.0; 3.32.0: custom rule, origin of a list and change time of a person in the data (data version
  26)

<!-- zdroj: app:src/types.ts STROM_DATA_VERSION 22 (seznamy, addedAt; app:714a8ab2) · src/data.ts:436 sanitizePersonLists při načtení · src/person-lists-data.ts onPersonDeleted, onPersonsMerged, keepPersonListData · src/research-link.ts:1903 keepPersonListData · strings.ts lists.toast.personDeleted · src/tree-manager.ts isTreeNewer, src/data.ts isNewerData · app:714a8ab2 · ZADANI_DEV „Data a rozhraní“, §16a, §16b · 3.32.0: src/version.ts v26 (PersonList.custom, origin, customUnknown, Person.changedAt aditivně; vlastní pravidlo dynamic false s personIds), src/person-lists-data.ts sanitizeCustomRule (celé, nebo customUnknown), withCustomSnapshot, onPersonsMerged, keepPersonListData (custom, origin, changedAt), src/types.ts ListTemplate v nastavení · app:5b16c6fc, efc14cff · spec 136 K1.8 -->
