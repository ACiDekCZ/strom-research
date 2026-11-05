<a id="R4"></a>
# R4 Orte

Wie die Forschung Orte aus den Angaben bestimmt, wann ein Ort eine Lage auf der Karte bekommt und was über einen Ort
der Mensch entscheidet. Beschrieben werden die Forschung 1.25.2 und die Strom-App 3.21.2. Änderungen aus einer neueren Version tragen deren Nummer.

<a id="R4.1"></a>
## R4.1 Ein Ort bekommt eine Lage nur, wenn er sicher ist

Die Forschung bestimmt aus dem Zusammenhang der Einträge, welche Gemeinde dieses Namens es ist: Pfarrei, Bezirk,
Jahre. Ein falscher Ort ist schlimmer als keiner. Darum hat die Bestimmung drei Stufen, und Koordinaten bekommt nur
ein sicherer Ort.

- **Sicher:** Pfarrei, Bezirk und Jahre der Einträge stimmen mit einer einzigen Gemeinde überein. Der Ort bekommt
  Koordinaten, Namen und Zugehörigkeit.
- **Wahrscheinlich:** die Forschung schlägt 1 bis 3 Kandidaten vor, und der Mensch entscheidet in Wartet auf
  Bearbeitung (siehe [R4.5](#R4.5)).
- **Nicht bestimmbar:** der Ort bleibt ohne Karte. Die Forschung erfasst, warum es nicht geht und was entscheiden
  würde.
- **Grenzen:** höchstens 3 Kandidaten. Der Grund und „was entscheiden würde“ haben je höchstens 300 Zeichen. Die
  Forschung sucht vom Billigen zum Teureren: zuerst der Stammbaum und seine Quellen, dann die Regeln der Schreibung,
  das Web erst zuletzt. Zur Suche gehen nur die Namen von Orten, Pfarreien und Bezirken, nie Namen von Personen oder
  ihre Lebensdaten.
- **Bedienung:** App: Zustand des Ortes **Noch nicht auf der Karte**, **In der Warteschlange**, **Wird gesucht…**,
  **Zu bestätigen**, **Nicht bestimmt**, **Prüfen**; Herkunft der Lage **Von der Forschung bestimmt**; im Detail
  **Warum hier**, **Was entscheiden würde**, **Quelle** · Terminal: `strom place identify`, `strom place propose`,
  `strom place unlocated` (Befehle des Agenten)
- **Gilt seit:** Forschung 1.25.0, App 3.21.0

<!-- zdroj: research:src/commands/placeid.ts:80 identify, :124 unlocated (why/needs ≤300), :144 propose (candidate 1–3) · research:src/brief/places.ts (tři stupně, web až nakonec) · research:assets/lang/cs.json ui.link.places.private · app:src/strings.ts cs places (v3.21.2 :9897) -->

<a id="R4.1.1"></a>
### R4.1.1 Gleicher Name, anderer Ort

Gemeinden gleichen Namens gibt es oft mehrere. Sie unterscheiden Pfarrei und Bezirk aus den Einträgen, nicht der Name
allein. Erfundenes Beispiel: die Familie Horák lebte „in Lhota“; aus dem Kirchenbuch ist die Pfarrei bekannt, und sie
zeigt, welches Lhota es ist.

- **Grenzen:** einen Eintrag eines anderen Ortes, der näher als 1,5 km liegt, darf die Forschung nicht übersehen.
  Entweder ist es ein Ort, und sie führt die Einträge zusammen, oder sie sagt ausdrücklich, dass es ein anderer Ort
  ist (Ortsteil, Nachbarort). Zusammenführen lassen sich nur Einträge innerhalb von 1,5 km, und eine vom Menschen
  eingetragene Lage hat Vorrang. Weiter voneinander entfernte Einträge führt die Forschung nicht zusammen und fragt
  den Menschen. Ein Name, den zwei Einträge tragen, muss mit der Kennung des Ortes (L0012) angegeben werden.
- **Bedienung:** Terminal: `strom place identify --separate <L…>`, `strom place merge <L…> --into <L…>`
- **Gilt seit:** Forschung 1.25.2

<!-- zdroj: research:src/core/placeid.ts NEAR_KM=1.5 (:575), mergePlaces, errors place.near / place.far · research:src/commands/placeid.ts:80 --separate, :203 merge · CHANGELOG.cs.md 1.25.2 -->

<a id="R4.1.2"></a>
### R4.1.2 Ein nicht gefundener Ort kommt von selbst zurück

Einen Ort, der sich nicht bestimmen ließ, reiht die Forschung erneut ein, wenn der Stammbaum mehr über ihn weiß: es
kommt eine Angabe mit Zitation hinzu, eine Zugehörigkeit oder ein übergeordneter Ort. Der Mensch muss nicht darum
bitten.

- **Grenzen:** ein solcher Ort läuft nicht bevorzugt, weil ihn nicht der Mensch eingereiht hat (siehe [R4.4](#R4.4)).
- **Gilt seit:** Forschung 1.25.0

<!-- zdroj: research:src/core/placeid.ts contextOf, requeue of unlocated (K2.3) · placesFirst counts only entries queued by the person · CHANGELOG.cs.md 1.25.0 -->

<a id="R4.2"></a>
## R4.2 Namen und Zugehörigkeit eines Ortes

Der erste Name eines Ortes ist der heutige amtliche Name in der Sprache des Landes, in dem der Ort heute liegt. Alte
Namen, Namen in anderen Sprachen und andere Schreibungen aus den Quellen stehen beim Ort neben ihm, mit Sprache und
Jahren. Die Zugehörigkeit sagt, wohin der Ort gehörte: Pfarrei, Gemeinde, Bezirk und weitere, immer mit den Jahren
von–bis.

- **Grenzen:** ein anderer Name hat Sprache und Jahre; ein einzelnes Jahr bedeutet, dass der Name in diesem Jahr
  belegt ist. Arten der Zugehörigkeit: Pfarrei, Zivilverwaltung, Diözese, Herrschaft, Bezirk, Kreis, Staat, Sonstiges.
  Entfernen lässt sich nur ein Name, der nicht der erste ist und den keine Angabe mehr schreibt. Eine falsche
  Zugehörigkeit entfernt die Forschung nur mit Begründung.
- **Bedienung:** App: im Detail des Ortes **Heute**, **Früher**, **Anderer Name**, **Andere Schreibung**; Etiketten
  **Hauptform**, **andere Schreibung**, **alter Name**, **anderer Name** · Terminal: `strom place identify|verify
  --name --alt <název@jazyk:od-do> --form --jurisdiction <druh:název:od-do>`, `strom place names <L…> --drop <název>
  --why`
- **Gilt seit:** Forschung 1.25.0; der heutige Name als erster und `strom place names` seit Forschung 1.25.2

<!-- zdroj: research:src/core/placeid.ts todayName, parseJurisdiction, dropPlaceNames · research:src/core/places.ts JURISDICTIONS = parish, civil, diocese, manor, district, county, state, other · research:src/commands/placeid.ts:167 verify, :258 names · research:src/brief/places.ts (today's name rule) · app:src/strings.ts cs places tags/detail -->

<a id="R4.2.1"></a>
### R4.2.1 Wie Angaben einen Ort schreiben

In einer Angabe ist der Ort eine Gemeinde. Straße und Hausnummer gehören in das eigene Feld für das Haus. Schreiben
die Angaben einen Ort anders, schlägt die Forschung die Änderung nur vor, und der Mensch bestätigt sie mit der Frage
**Vorschlag zum Eintrag**.

- **Grenzen:** ein schon erfasstes Haus wird nicht überschrieben. Die Abschrift einer Quelle wird in keinem Fall
  geändert.
- **Bedienung:** App: Wartet auf Bearbeitung, **Vorschlag zum Eintrag**, **Ja** / **Nein** · Terminal: **Die Angaben
  so schreiben** / **Die Angaben lassen, wie sie sind**; `strom place rewrite --propose`, `--house`
- **Gilt seit:** Forschung 1.25.0

<!-- zdroj: research:src/commands/placeid.ts:225 rewrite · app:src/strings.ts formExplain · research:src/cli/menu-waiting.ts:523–560 (v1.25.2) -->

<a id="R4.3"></a>
## R4.3 Eine vom Menschen eingetragene Lage ändert die Forschung nicht

Eine Lage, die der Mensch von Hand gesetzt hat, gehört dem Menschen. Die Forschung verschiebt sie nicht, löscht sie
nicht und markiert sie nicht als nicht gefunden. Sagen die Einträge etwas anderes, fragt sie in Wartet auf
Bearbeitung mit der Frage **Widerspruch der Lage**.

- **Grenzen:** eine Lage von Hand ist jede Lage ohne Aufzeichnung darüber, wer sie bestimmt hat, und jede Lage aus
  der App. Die Forschung darf bei ihr nur bestätigen, dass die Einträge übereinstimmen, oder erfassen, dass es sich
  nicht entscheiden lässt. Dabei erfasst sie Namen und Zugehörigkeit und lässt die Koordinaten. Die Antwort
  **Beibehalten** gilt, bis sich die Lage ändert; nach demselben Widerspruch fragt die Forschung nicht erneut. Eine
  Sammelerledigung übernimmt eine Lage von Hand nicht an Stelle des Menschen (siehe [R4.5](#R4.5)).
- **Bedienung:** App: Herkunft **Von Hand gesetzt**, **Von Hand auf der Karte setzen**; Text „Eine von Hand gesetzte
  Lage ändert die Forschung nicht, bei Widerspruch fragt sie in Offen.“ · Terminal: Herkunft „von Hand eingetragen“;
  `strom place verify --ok|--undecided`, `strom place propose --conflict` (Befehle des Agenten)
- **Gilt seit:** Forschung 1.25.0, App 3.21.0

<!-- zdroj: research:src/core/placeid.ts personsHand (:714), proposePlace kept → place.kept · research:src/commands/sources.ts place edit ~:976 (agent refused on personsHand) · research:src/core/sync.ts:3401 byPerson · research:assets/lang/cs.json ui.wait.place.by.person · app:src/strings.ts whoHand, pvHand -->

<a id="R4.4"></a>
## R4.4 Warteschlange der Orte

Orte zur Bestimmung reiht der Mensch ein. Das Einreihen selbst erfasst nichts, und der Agent arbeitet dabei nicht.
Die Forschung arbeitet die Warteschlange in Sitzungen nach Gebieten ab, wobei ein Gebiet das Archiv der meisten
Quellen des Ortes ist.

- **Grenzen:** höchstens 15 Orte je Sitzung, kleine Gebiete gehen zusammen. Voran gehen die Orte, bei denen die App
  **Prüfen** meldet, dann nach der Zeit des Einreihens. Ein Einreihen umfasst höchstens 5000 Orte. Ein Ort, der schon
  auf der Karte ist, wird nur zur Überprüfung eingereiht. Ein Ort, an dem gerade eine Sitzung läuft, lässt sich weder
  einreihen noch herausnehmen. Die Schätzung der Dauer erscheint sofort, die Schätzung des Preises erst nach 3
  gemessenen Sitzungen. Die Aufgabe der vom Menschen eingereihten Orte ist kurze Arbeit, die voran geht (Schlüssel 5
  in [R2.2](R2-lines-and-queue.md#R2.2)). Die Aufgabe gehört zu keiner Linie und ist darum nie Arbeit außerhalb der
  Linien.
- **Bedienung:** App: **In der Forschung suchen**, **In der Forschung prüfen**, **Aus der Warteschlange nehmen**,
  **Jetzt starten**, **Alle Orte ohne Karte suchen (n)**, **Alle Zuordnungen prüfen (n)** · Terminal: Aufgabe „Die
  Orte der Angaben in der Warteschlange bestimmen (n)“; `strom place queue [--all] [--check]`,
  `strom place unqueue [--all]`
- **Gilt seit:** Forschung 1.25.0, App 3.21.0; Sitzungen nach Gebieten seit Forschung 1.25.2

<!-- zdroj: research:src/core/placeid.ts BATCH_MAX=15 (:31), REQUEST_MAX=5000, BATCH_MINUTES, MEASURED_MIN=3, PLACE_FLAGS, queueOrder (:225), raisePlacesTask (priority 5, level enrich), placesFirst · research:src/core/queue.ts rankTasks first (v1.25.2 :142–280) · research:src/commands/placeid.ts:283 queue, :320 unqueue · app:src/place-check.ts PLACE_FAR_KM=60 -->

<a id="R4.4.1"></a>
### R4.4.1 Wann die App Prüfen meldet

Die App markiert selbst, ohne die Forschung, eine Lage, die nicht in den Stammbaum passt. Sie ändert nichts an ihr.

- **Grenzen:** der Ort liegt weiter als 60 km von allen übrigen Orten der Familie im Zeitraum ±20 Jahre; ein Eintrag
  der Forschung nennt eine andere Pfarrei oder einen anderen Bezirk; die gefundene Beschreibung ist eine Straße oder
  ein Ortsteil; die Suche fand mehrere Gemeinden dieses Namens. Eine Lage mit der Antwort **Beibehalten** und eine
  von der Forschung bestätigte Lage werden nicht gemeldet, solange sie sich nicht bewegen.
- **Gilt seit:** App 3.21.0; Grenze 60 km seit App 3.21.1

<!-- zdroj: app:src/place-check.ts:1–31 PLACE_FAR_KM=60, PLACE_YEARS=20 · app CHANGELOG.cs.md 3.21.1 -->

<a id="R4.5"></a>
## R4.5 Fragen zu Orten in Wartet auf Bearbeitung

Fragen zu Orten beantwortet nur der Mensch, in der App oder im Terminal. Der Agent beantwortet sie nicht. Es gibt drei
Arten von Fragen: **Wo liegt** (Kandidaten), **Widerspruch der Lage** (die Lage auf der Karte gegen die Einträge) und
**Vorschlag zum Eintrag** (wie Angaben einen Ort schreiben).

| Antwort (App) | Terminal | Was geschieht |
|---|---|---|
| **Es ist A** (B, C) | Name des Kandidaten | Der Ort bekommt die Lage des Kandidaten als Lage von Hand. |
| **Keiner davon** | **Keiner davon** | Der Ort bleibt ohne Karte. |
| **Weiß nicht** | **Nicht zu sagen** | Der Ort bleibt ohne Karte. |
| **Beibehalten** | **Die Lage auf der Karte behalten** | Die Lage bleibt, und nach demselben Widerspruch fragt die Forschung nicht erneut. |
| **Ja** / **Nein** | **Die Angaben so schreiben** / **Die Angaben lassen, wie sie sind** | Die Angaben werden umgeschrieben oder bleiben. |

- **Grenzen:** **Keiner davon** und **Weiß nicht** nimmt die Forschung nur bei der Frage **Wo liegt** an. Die Antwort
  wird nicht erfasst, wenn sich die Frage inzwischen geändert hat; die App erneuert dann Wartet auf Bearbeitung.
  **Alle Vorschläge übernehmen (n)** nimmt bei der Frage **Wo liegt** den Kandidaten A, beim Widerspruch der Lage
  behält es die Lage. **Alle beibehalten (n)** behält die Lage bei Widersprüchen. Eine Sammelerledigung lässt Lagen
  von Hand aus. Ein Schritt **Rückgängig** nimmt die ganze Sammelerledigung zurück. Die Reihenfolge der Fragen unter
  den übrigen Dingen in Wartet auf Bearbeitung beschreibt [R6](R6-awaiting-action.md).
- **Bedienung:** App: Fenster **Wartet auf Bearbeitung · Orte**, Gruppe **Orte**, **Antworten**, **Nach Gebiet:** ·
  Terminal: **Was wartet → Orte zu bestimmen**; `strom place answer <L…> --take c1|c2|c3|keep|unknown|none|yes|no|first`
  mit `--dry` und `--expect`
- **Gilt seit:** Forschung 1.25.0, App 3.21.0
- **Ab Forschung 1.26.0:** die kleine Karte bei der Frage zeigt nur die Punkte der Frage und die Entfernung vom Vorschlag
  (App 3.22.0).
- **Ab Forschung 1.26.0:**
  - das Terminal sagt mit den Worten der App **Weiß nicht** und **Keiner davon**;
  - **Weiß nicht** geht auch beim **Widerspruch der Lage** (die Lage bleibt, die Frage verschwindet, die Forschung
    kann erneut fragen) und beim **Vorschlag zum Eintrag** (die Angaben bleiben, wie sie sind). Die App 3.22.0 bietet
    es dort nur mit der Forschung 1.26.0 an. **Keiner davon** bleibt nur bei der Frage **Wo liegt**;
  - **Alle Vorschläge übernehmen (n)** (`--take first`) nimmt den Kandidaten A auch beim Widerspruch der Lage. Eine
    von Hand eingegebene Lage überschreibt es nie: einen solchen Widerspruch lässt es aus.

<!-- zdroj: research:src/commands/placeid.ts:345 answer (person only) · research:src/core/placeid.ts PLACE_TAKES, answerOne ~:1195 · research:src/core/waiting.ts:395–420 (v1.25.2) wait.group.places · research:src/cli/menu-waiting.ts:523–560 · app:src/waiting-places.ts placeQuestionChoices :40, bulkAcceptable :140, bulkKeepable, placeAreas · app:src/strings.ts waiting.* · app CHANGELOG.cs.md 3.22.0 · 1.26.0: research:src/core/placeid.ts answerOne (first: locating.by person vynechá; unknown u conflict a form), cs.json ui.wait.place.unknown/none (commit fe59fb40) · app:src/waiting-places.ts PLACES_UNKNOWN_ALL_SINCE, ui/waiting-places-ui.ts:645 take first -->

<a id="R4.5.1"></a>
### R4.5.1 Rücknahme eines Schritts

Jeder Schritt bei den Orten lässt sich zurücknehmen: eine Antwort, ein entfernter Name, ein Aufräumen der
Warteschlange und auch eine einmalige Korrektur der Einträge von Orten. Die Rücknahme ist Sache des Menschen.

- **Grenzen:** die letzten 20 Schritte, jeder einzeln nach seiner Kennung. Ein Schritt lässt sich nicht zurücknehmen,
  wenn sich der Ort seitdem geändert hat.
- **Bedienung:** App: **Rückgängig** · Terminal: `strom place undo <krok>`
- **Gilt seit:** Forschung 1.25.2 (in der Forschung 1.25.0 nur der letzte Schritt)

<!-- zdroj: research:src/core/placeid.ts UNDO_KEPT=20 (:102), undoPlaces · research:src/commands/placeid.ts:399 undo (person only) · CHANGELOG.cs.md 1.25.0 / 1.25.2 -->

<a id="R4.6"></a>
## R4.6 Orte aus anderen Forschungen auf diesem Computer

Die Forschung übernimmt weder Koordinaten noch Angaben aus anderen Stammbäumen. Sie übernimmt nur die Zuordnung eines
Ortes zu einer Region der Geschichte und zeigt dem Agenten die Einträge anderer Forschungen als Vorschlag.

- **Grenzen:** die Forschung 1.24.0 übernimmt die Zuordnung zu einer Region der Geschichte nur, wenn alle Forschungen
  sie gleich haben. Derselbe Ort ist einer, der innerhalb von 2 km liegt, dieselbe Pfarrei oder denselben Bezirk oder
  Kreis hat; weiter als 5 km ist es ein anderer Ort. Aus der Familie wird nichts übertragen. Die Forschung 1.25.0
  zeigt bei der Bestimmung Pfarrei, Bezirk und Koordinaten des Ortes aus einer anderen Forschung. Der Agent verwendet
  sie nur dort, wo Pfarrei oder Bezirk übereinstimmen.
- **Bedienung:** Terminal: `strom history adopt --dry-run` (nur mit eingeschalteter Geschichte)
- **Gilt seit:** Forschung 1.24.0 (Regionen), Forschung 1.25.0 (Vorschlag bei der Bestimmung)

<!-- zdroj: research:src/core/placeadopt.ts SAME_KM=2, OTHER_KM=5 · research:src/brief/places.ts othersRecords · research:src/core/placeid.ts PLACE_BY (adopted never written) · CHANGELOG.cs.md 1.24.0 (l.114), 1.25.0 (l.77) -->

<a id="R4.7"></a>
## R4.7 Geschichte der Orte

Die Geschichte der Orte sind belegte Ereignisse an den Orten, an denen die Familie lebte. Sie wird nur gesucht, wenn
der Mensch sie einschaltet. Die Forschung ordnet dazu die Orte Regionen der Geschichte zu.

- **Grenzen:** eine Aufgabe der Geschichte kommt nur gelegentlich an die Reihe: etwa jede 5. Sitzung (Standard),
  selten etwa jede 10., oder nur, wenn keine andere Arbeit übrig ist (Schlüssel 3 in
  [R2.2](R2-lines-and-queue.md#R2.2)).
  Die Zuordnung von Orten zu Regionen und ein Ort, um den der Mensch gebeten hat, gehen der
  Forschung voran. Die Ortsgeschichte umfasst den Ort und die Umgebung bis etwa 10 km. Eine Aufgabe der Geschichte
  nimmt der Agent nur bei `strom run` oder `strom task next --history`, im Gespräch nicht von sich aus. Ein Ort, der
  sich nicht zuordnen lässt, wird als nicht gefunden markiert.
- **Bedienung:** App: **Geschichte der Orte**, **Ortsgeschichte suchen…**, **Region zuordnen**, Zustände
  **Ortsgeschichte: wartet**, **Ortsgeschichte: wird gesucht**, **Die Forschung konnte den Ort nicht bestimmen** ·
  Terminal: **Einstellungen → Der Agent allein → Geschichte**; `strom config set experiments.history on`,
  `strom history place <L…>`, `strom history map --unlocated`
- **Gilt seit:** Forschung 1.22.0

<!-- zdroj: research:src/core/pastevents.ts PACE_EVERY (:2621), experiments.historyPace · research:src/core/placehistory.ts · research:src/commands/history.ts place, map --unlocated, adopt · research:assets/lang/cs.json ui.alone.title, ui.alone.history · app:src/strings.ts history.* (v3.21.2 :13121–13235) · CHANGELOG.cs.md 1.22.0 (l.229) -->
