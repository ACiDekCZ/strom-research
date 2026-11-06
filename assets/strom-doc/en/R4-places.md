<a id="R4"></a>
# R4 Places

How the research identifies the places in facts, when a place gets a position on the map, and what a person decides
about a place. Describes the research 1.25.2 and the Strom app 3.21.2. Changes from a later version carry its number.

<a id="R4.1"></a>
## R4.1 A place gets a position only when it is certain

The research works out which village of a given name it is from the context of the records: parish, district, years.
A wrong place is worse than none. So identification has three degrees, and only a certain place gets coordinates.

- **Certain:** the parish, district and years of the records agree with a single village. The place gets
  coordinates, names and jurisdiction.
- **Probable:** the research proposes 1 to 3 candidates and a person decides in Awaiting action (see [R4.5](#R4.5)).
- **Cannot be identified:** the place stays off the map. The research writes why it cannot and what would decide.
- **Limits:** at most 3 candidates. The reason and “what would decide” have at most 300 characters each. The research
  searches from cheap to costly: the tree and its sources first, then the rules of the entry, the web last. Only the
  names of places, parishes and districts go to a search, never the names of persons or the dates of their lives.
- **Controls:** app: the place state **Not on the map yet**, **Queued in the research**, **Being looked up…**,
  **To confirm**, **Not identified**, **Check**; the origin of the position **Identified by the research**; in the
  detail **Why here**, **What would decide**, **Source** · terminal: `strom place identify`, `strom place propose`,
  `strom place unlocated` (agent commands)
- **Since:** research 1.25.0, app 3.21.0

<!-- zdroj: research:src/commands/placeid.ts:80 identify, :124 unlocated (why/needs ≤300), :144 propose (candidate 1–3) · research:src/brief/places.ts (tři stupně, web až nakonec) · research:assets/lang/cs.json ui.link.places.private · app:src/strings.ts cs places (v3.21.2 :9897) -->

<a id="R4.1.1"></a>
### R4.1.1 The same name, a different place

There are often several villages of the same name. They are told apart by the parish and district from the records,
not by the name itself. A made-up example: the Horák family lived “in Lhota”; the register gives the parish, and the
parish shows which Lhota it is.

- **Limits:** the research must not overlook a record of another place nearer than 1.5 km. Either it is one place and
  the records are joined, or the research states explicitly that it is a different place (a part of the village,
  a neighbour). Only records within 1.5 km can be joined, and a position set by a person takes precedence. The research
  does not join records further apart and asks a person. A name that two records carry must be given by the place
  identifier (L0012).
- **Controls:** terminal: `strom place identify --separate <L…>`, `strom place merge <L…> --into <L…>`
- **Since:** research 1.25.2

<!-- zdroj: research:src/core/placeid.ts NEAR_KM=1.5 (:575), mergePlaces, errors place.near / place.far · research:src/commands/placeid.ts:80 --separate, :203 merge · CHANGELOG.cs.md 1.25.2 -->

<a id="R4.1.2"></a>
### R4.1.2 A place not located comes back by itself

A place that could not be identified is queued again by the research when the tree knows more about it: a fact with
a citation, a jurisdiction or a parent place is added. A person does not need to ask for it.

- **Limits:** such a place does not run first, because a person did not queue it (see [R4.4](#R4.4)).
- **Since:** research 1.25.0

<!-- zdroj: research:src/core/placeid.ts contextOf, requeue of unlocated (K2.3) · placesFirst counts only entries queued by the person · CHANGELOG.cs.md 1.25.0 -->

<a id="R4.2"></a>
## R4.2 The names and jurisdiction of a place

The first name of a place is today's official name in the language of the country where the place lies today. Old
names, names in other languages and other spellings from the sources stand beside it at the place, with language and
years. Jurisdiction says where the place belonged: parish, municipality, district and more, always with years from–to.

- **Limits:** another name has a language and years; a single year means the name is attested in that year. Kinds of
  jurisdiction: parish, civil administration, diocese, manor, district, county, state, other. Only a name that is not
  the first and that no fact uses any more can be removed. The research removes a wrong jurisdiction only with
  a reason.
- **Controls:** app: in the place detail **Today**, **Earlier**, **Other name**, **Other spelling**; the tags **main
  form**, **other spelling**, **old name**, **other name** · terminal: `strom place identify|verify --name --alt
  <name@language:from-to> --form --jurisdiction <kind:name:from-to>`, `strom place names <L…> --drop <name> --why`
- **Since:** research 1.25.0; today's name as the first and `strom place names` from research 1.25.2

<!-- zdroj: research:src/core/placeid.ts todayName, parseJurisdiction, dropPlaceNames · research:src/core/places.ts JURISDICTIONS = parish, civil, diocese, manor, district, county, state, other · research:src/commands/placeid.ts:167 verify, :258 names · research:src/brief/places.ts (today's name rule) · app:src/strings.ts cs places tags/detail -->

<a id="R4.2.1"></a>
### R4.2.1 How facts write a place

In a fact, the place is the village or town. The street and house number belong in the separate house field. When
facts write a place otherwise, the research only proposes the change and a person confirms it with the question
**Entry suggestion**.

- **Limits:** a house already entered is not overwritten. The transcription of a source is never changed.
- **Controls:** app: Awaiting action, **Entry suggestion**, **Yes** / **No** · terminal: **Write the facts so** /
  **Leave the facts as they are**; `strom place rewrite --propose`, `--house`
- **Since:** research 1.25.0

<!-- zdroj: research:src/commands/placeid.ts:225 rewrite · app:src/strings.ts formExplain · research:src/cli/menu-waiting.ts:523–560 (v1.25.2) -->

<a id="R4.3"></a>
## R4.3 The research does not change a position set by a person

A position a person placed by hand belongs to the person. The research does not move it, delete it or mark it as not
located. When the records say something else, it asks in Awaiting action with the question **Location conflict**.

- **Limits:** a position by hand is every position with no record of who set it, and every position from the app. The
  research may only confirm that the records agree, or write that it cannot be decided. It then writes the names and
  jurisdiction and leaves the coordinates. The answer **Keep** holds until the position changes; the research does
  not ask again about the same conflict. Dealing with questions in bulk does not accept a position by hand for the
  person (see [R4.5](#R4.5)).
- **Controls:** app: the origin **Placed by hand**, **Place by hand on the map**; the text “The research never changes
  a hand-placed location; it asks in Waiting if it finds a conflict.” · terminal: the origin “put there by hand”;
  `strom place verify --ok|--undecided`, `strom place propose --conflict` (agent commands)
- **Since:** research 1.25.0, app 3.21.0

<!-- zdroj: research:src/core/placeid.ts personsHand (:714), proposePlace kept → place.kept · research:src/commands/sources.ts place edit ~:976 (agent refused on personsHand) · research:src/core/sync.ts:3401 byPerson · research:assets/lang/cs.json ui.wait.place.by.person · app:src/strings.ts whoHand, pvHand -->

<a id="R4.4"></a>
## R4.4 The places queue

Places to identify are queued by a person. Queuing itself writes nothing and the agent does not work at that moment.
The research works through the queue in sessions by area, where an area is the archive of most of the place's
sources.

- **Limits:** at most 15 places per session; small areas go together. Places for which the app reports **Check** go
  first, then by the time they were queued. One queuing holds at most 5000 places. A place already on the map is
  queued only to be checked. A place a session is running on cannot be queued or removed. The estimate of duration
  shows at once, the estimate of cost only after 3 measured sessions. The task of places queued by a person is short
  work that goes first (key 5 in [R2.2](R2-lines-and-queue.md#R2.2)). The task belongs to no line, so it is never
  work off the lines.
- **Controls:** app: **Look up in the research**, **Check in the research**, **Remove from the queue**, **Run now**,
  **Look up all not on the map (n)**, **Check all locations (n)** · terminal: the task “Identify the places of the
  facts in the queue (n)”; `strom place queue [--all] [--check]`, `strom place unqueue [--all]`
- **Since:** research 1.25.0, app 3.21.0; sessions by area from research 1.25.2

<!-- zdroj: research:src/core/placeid.ts BATCH_MAX=15 (:31), REQUEST_MAX=5000, BATCH_MINUTES, MEASURED_MIN=3, PLACE_FLAGS, queueOrder (:225), raisePlacesTask (priority 5, level enrich), placesFirst · research:src/core/queue.ts rankTasks first (v1.25.2 :142–280) · research:src/commands/placeid.ts:283 queue, :320 unqueue · app:src/place-check.ts PLACE_FAR_KM=60 -->

<a id="R4.4.1"></a>
### R4.4.1 When the app reports Check

The app on its own, without the research, marks a position that does not fit the tree. It changes nothing about it.

- **Limits:** the place lies further than 60 km from all other places of the family within ±20 years; a record of the
  research names another parish or district; the description found is a street or a part of a village; the search
  found several villages of that name. A position answered **Keep** and a position confirmed by the research are not
  reported until they move.
- **Since:** app 3.21.0; the 60 km limit from app 3.21.1

<!-- zdroj: app:src/place-check.ts:1–31 PLACE_FAR_KM=60, PLACE_YEARS=20 · app CHANGELOG.cs.md 3.21.1 -->

<a id="R4.5"></a>
## R4.5 Questions about places in Awaiting action

Only a person answers questions about places, in the app or in the terminal. The agent does not answer them. There
are three kinds of questions: **Where is** (candidates), **Location conflict** (the position on the map against the
records) and **Entry suggestion** (how facts write the place).

| Answer (app) | Terminal | What happens |
|---|---|---|
| **It is A** (B, C) | the candidate's name | The place gets the candidate's position as a position by hand. |
| **None of them** | **None of them** | The place stays off the map. |
| **Don’t know** | **Cannot tell** | The place stays off the map. |
| **Keep** | **Keep the position on the map** | The position stays and the research does not ask again about the same conflict. |
| **Yes** / **No** | **Write the facts so** / **Leave the facts as they are** | The facts are rewritten, or they stay. |

- **Limits:** the research accepts **None of them** and **Don’t know** only for the question **Where is**. An answer is
  not written when the question has changed meanwhile; the app then refreshes Awaiting action. **Accept all suggested
  (n)** takes candidate A for the question **Where is**, and keeps the position for a location conflict. **Keep all
  (n)** keeps the position for conflicts. Dealing with questions in bulk leaves out positions by hand. One **Undo**
  reverts the whole bulk step. The order of the questions among the other items in Awaiting action is described in
  [R6](R6-awaiting-action.md).
- **Controls:** app: the window **Awaiting action · Places**, the group **Places**, **Answer**, **By area:** ·
  terminal: **What waits → Places to identify**;
  `strom place answer <L…> --take c1|c2|c3|keep|unknown|none|yes|no|first` with `--dry` and `--expect`
- **Since:** research 1.25.0, app 3.21.0
- **From research 1.26.0:** the small map at a question shows only the question's points and the distance from the proposal
  (app 3.22.0).
- **From research 1.26.0:**
  - the terminal says **Don’t know** and **None of them** in the app's words;
  - **Don’t know** is possible also for a **Location conflict** (the position stays, the question goes, the research
    may ask again) and for an **Entry suggestion** (the facts stay as they are). App 3.22.0 offers it there only with
    research 1.26.0. **None of them** stays only for the question **Where is**;
  - **Accept all suggested (n)** (`--take first`) takes candidate A also for a location conflict. It never overwrites
    a position entered by hand: it leaves such a conflict out.

<!-- zdroj: research:src/commands/placeid.ts:345 answer (person only) · research:src/core/placeid.ts PLACE_TAKES, answerOne ~:1195 · research:src/core/waiting.ts:395–420 (v1.25.2) wait.group.places · research:src/cli/menu-waiting.ts:523–560 · app:src/waiting-places.ts placeQuestionChoices :40, bulkAcceptable :140, bulkKeepable, placeAreas · app:src/strings.ts waiting.* · app CHANGELOG.cs.md 3.22.0 · 1.26.0: research:src/core/placeid.ts answerOne (first: locating.by person vynechá; unknown u conflict a form), cs.json ui.wait.place.unknown/none (commit fe59fb40) · app:src/waiting-places.ts PLACES_UNKNOWN_ALL_SINCE, ui/waiting-places-ui.ts:645 take first -->

<a id="R4.5.1"></a>
### R4.5.1 Undoing a step

Every step with places can be undone: an answer, a removed name, a cleanup of the queue, and a one-off repair of the
place records. Undoing is a matter for a person.

- **Limits:** the last 20 steps, each separately by its identifier. A step cannot be undone when the place has changed
  since.
- **Controls:** app: **Undo** · terminal: `strom place undo <step>`
- **Since:** research 1.25.2 (in research 1.25.0 only the last step)

<!-- zdroj: research:src/core/placeid.ts UNDO_KEPT=20 (:102), undoPlaces · research:src/commands/placeid.ts:399 undo (person only) · CHANGELOG.cs.md 1.25.0 / 1.25.2 -->

<a id="R4.6"></a>
## R4.6 Places from other researches on this computer

The research does not take over coordinates or facts from other trees. It takes over only the assignment of a place
to a history region, and shows the agent the records of other researches as a proposal.

- **Limits:** research 1.24.0 takes over the assignment to a history region only when all researches have it the
  same. The same place is one that lies within 2 km, has the same parish, or the same district or county; beyond 5 km
  it is a different place. Nothing moves from the family. Research 1.25.0 shows, during identification, the parish,
  district and coordinates of the place from another research. The agent uses them only where the parish or district
  agrees.
- **Controls:** terminal: `strom history adopt --dry-run` (only with local history switched on)
- **Since:** research 1.24.0 (regions), research 1.25.0 (the proposal during identification)

<!-- zdroj: research:src/core/placeadopt.ts SAME_KM=2, OTHER_KM=5 · research:src/brief/places.ts othersRecords · research:src/core/placeid.ts PLACE_BY (adopted never written) · CHANGELOG.cs.md 1.24.0 (l.114), 1.25.0 (l.77) -->

<a id="R4.7"></a>
## R4.7 Local history

Local history is documented events in the places where the family lived. It is looked for only when a person
switches it on. For it, the research assigns places to history regions.

- **Limits:** a history task comes up only now and then: roughly every 5th session (default), sparsely roughly every
  10th, or only when no other work is left (key 3 in [R2.2](R2-lines-and-queue.md#R2.2)). Assigning places to regions
  and a place a person asked for go before the research. The history of a place covers the place and its surroundings
  up to roughly 10 km. The agent takes a history task only during `strom run` or `strom task next --history`, not on
  its own in a conversation. A place that cannot be assigned is marked as not located.
- **Controls:** app: **History of places**, **Find local history…**, **Assign region**, the states **Local history:
  waiting**, **Local history: searching**, **The research could not locate the place** · terminal: **Settings → The
  agent working alone → History**; `strom config set experiments.history on`, `strom history place <L…>`,
  `strom history map --unlocated`
- **Since:** research 1.22.0

<!-- zdroj: research:src/core/pastevents.ts PACE_EVERY (:2621), experiments.historyPace · research:src/core/placehistory.ts · research:src/commands/history.ts place, map --unlocated, adopt · research:assets/lang/cs.json ui.alone.title, ui.alone.history · app:src/strings.ts history.* (v3.21.2 :13121–13235) · CHANGELOG.cs.md 1.22.0 (l.229) -->
