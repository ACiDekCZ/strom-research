<a id="A6"></a>
# A6 Ansichten und Auswahl der Personen

Wie die Strom-App auswählt, welche Personen sie zeigt, und wie die einzelnen Ansichten sie zeigen. Beschrieben wird
die App 3.21.2. Änderungen aus einer neueren Version tragen deren Nummer.

Eine Ansicht ist eine andere Lesart **derselben Auswahl der Personen**. Die Auswahl bestimmen die zentrale Person
(die angeklickte) und die Tiefe **Vorfahren** und **Nachkommen**. Familie, Nachkommen, Zeitleiste und Karte zeigen
dasselbe Umfeld der zentralen Person. Der Fächer berechnet Vorfahren und Nachkommen selbst nach der Zahl der
Generationen ([A6.4](#A6.4)).

| Ansicht (cs) | en | de | pl |
|---|---|---|---|
| **Rodina** | Family | Familie | Rodzina |
| **Potomci** | Descendants | Nachkommen | Potomkowie |
| **Časová osa** | Timeline | Zeitleiste | Oś czasu |
| **Vějíř** | Fan | Fächer | Wachlarz |
| **Mapa** | Map | Karte | Mapa |

<!-- zdroj: app:src/types.ts:1237 ViewMode · strings.ts viewModeSwitch.* -->

<a id="A6.1"></a>
## A6.1 Umfeld der zentralen Person in der Ansicht Familie

Die Ansicht Familie zeigt die zentrale Person in ihrer Familie, nicht den ganzen Stammbaum.

- Zur Auswahl gehören:
  1. die zentrale Person und alle ihre Partner;
  2. ihre Nachkommen bis zur Tiefe **Nachkommen**, mit Partnern;
  3. die direkten Vorfahren über beide Eltern bis zur Tiefe **Vorfahren**;
  4. Geschwister, auch Halbgeschwister (ihr anderer Elternteil kommt nicht hinzu), mit Partnern und Nachkommen bis
     zur Tiefe Nachkommen;
  5. Tanten und Onkel (Geschwister der Eltern) mit Partnern;
  6. Cousins und Cousinen, also Kinder der Tanten und Onkel, die in deren Partnerschaft erfasst sind, mit
     Nachkommen bis zur Tiefe Nachkommen.
- **Grenzen:** Vorfahren eines Partners der zentralen Person kommen nie in die Auswahl. Wer nicht zum Umfeld gehört,
  bleibt im Stammbaum, die Ansicht zeigt ihn nur nicht; eine neue zentrale Person zeigt ihn.
- **Tiefe:** nach der Wahl einer neuen zentralen Person stehen Vorfahren und Nachkommen auf der größten Tiefe, die der
  Stammbaum bei dieser Person hat. Das Angebot reicht von 1 bis zu dieser größten Tiefe. Kinder eines Partners aus
  einer anderen Partnerschaft fügen eine Generation nach unten hinzu.
- **Bedienung:** Klick auf die Personenkarte; Auswahl **Vorfahren** und **Nachkommen** in der Leiste der Ansicht.
- **Gilt seit:** App 1.0.0

<!-- zdroj: app:src/layout/pipeline/1-select-subgraph.ts selectSubgraph · src/layout/pipeline/index.ts:962 includeSpouseAncestors: false · src/renderer.ts:719 computeTreeLayout, setFocus (maxGenerations) · src/focus-depth.ts maxAncestorDepth, maxDescendantDepth · strings.ts focus.ancestorsLabel, focus.descendantsLabel -->

<a id="A6.1.1"></a>
### A6.1.1 Standardperson und -ansicht

Womit sich der Stammbaum öffnet, bestimmt die Stammbaum-Einstellung **Standardperson und -ansicht**.

| Auswahl | Möglichkeiten |
|---|---|
| Person | **Zuletzt fokussiert** · **Bestimmte Person:** (ausgewählt) |
| Ansicht | **Familie** · **Zuletzt verwendet** (auf diesem Gerät) |

- **Grenzen:** ohne Einstellung öffnet sich der Stammbaum bei der ersten Person des Stammbaums. Ein Neuladen der Seite
  behält Stammbaum, Ansicht und zentrale Person.
- **Bedienung:** Verwaltung der Stammbäume, beim Stammbaum **Standardperson und -ansicht**.
- **Gilt seit:** Standardperson App 1.0.0; Wahl der Ansicht und Neuladen der Seite App 3.21.0

<!-- zdroj: app:src/renderer.ts:1178 findDefaultFocusPerson, getStartupFocus · strings.ts treeManager.defaultPersonViewTitle, focus.defaultPersonLastFocused, focus.defaultPersonSpecific, focus.defaultViewFamily, focus.defaultViewLast · CHANGELOG.cs.md 3.21.0 -->

<a id="A6.2"></a>
## A6.2 Ansicht Nachkommen

Die Ansicht Nachkommen zeigt nur die zentrale Person und ihre Nachkommen bis zur Tiefe Nachkommen: ohne Vorfahren,
Tanten, Onkel und Cousins.

- **Nur Blutsverwandte** (Standard): die leiblichen Nachkommen der zentralen Person.
- **Ganze Familien**: dazu weitere Partnerschaften der Partner und ihre Stiefkinder, abgeschwächt.
- **Bedienung:** Schalter in der Leiste der Ansicht; die Standardwahl hält die Einstellung **Nachkommenansicht**.
- **Gilt seit:** Ansicht App 1.4.0; Ganze Familien App 1.9.2

<!-- zdroj: app:src/layout/pipeline/index.ts includeAuntsUncles: !descendantsOnly, expandLineageOnly: descendantsOnly && !isDescendantsFullFamilies() · strings.ts viewModeSwitch.bloodOnly, viewModeSwitch.fullFamilies, viewModeSwitch.settingLabel · settings descendantsFullFamilies (výchozí false) -->

<a id="A6.3"></a>
## A6.3 Zeitleiste

Die Zeitleiste zeigt die Personen der Ansicht als Lebensbalken auf einer Jahresachse.

- Eine Zeile bekommt nur eine Person mit Geburtsjahr. Die übrigen zählt die Ansicht und schreibt „N Personen ohne
  Geburtsjahr nicht angezeigt“. Platzhalterpersonen (leerer Platz für einen unbekannten Elternteil) werden
  ausgelassen.
- Reihenfolge der Zeilen: Geburtsjahr, dann Name ohne Titel.
- Der Balken einer lebenden Person reicht bis heute. Eine verstorbene Person ohne Sterbedatum hat einen Balken bis
  zum letzten bekannten Ereignis und ein offenes Ende.
- Das Jahr der Hochzeit stammt aus dem Anfangsdatum der Partnerschaft. Die Achse ist auf Jahrzehnte gerundet.
- Unter der Jahresachse läuft die Zeile der Geschichte der zentralen Person (Ereignisse der Zeit und der Orte ihres
  Lebens, Symbole der Arten). Ohne Forschung oder ohne solche Ereignisse gibt es die Zeile nicht.
- **Gilt seit:** Zeitleiste App 1.5.0; Zeile der Geschichte App 3.19.0

<!-- zdroj: app:src/timeline.ts computeTimelineModel, :59 TimelineHistory · strings.ts timeline.omitted · CHANGELOG.cs.md 3.19.0 -->

<a id="A6.4"></a>
## A6.4 Fächer

Der Fächer zeigt die Vorfahren der zentralen Person in Kreissegmenten, Generation für Generation.

- **Form:** **Halbkreis** · **Vollkreis** · **Beidseitig** (Vorfahren und Nachkommen).
- **Generationen** der Vorfahren 3–10, Standard 5. In der Form Beidseitig **Nachkommen** 1–5, Standard 3.
- Nummerierung der Vorfahren: 1 ist die zentrale Person, der Vater der Person n hat die Nummer 2n, die Mutter 2n+1.
  Die Linie des Vaters ist links. Nummern an den Segmenten schaltet die Einstellung **Fächerdiagramm**
  „Kekulé-(Ahnen-)Nummern anzeigen“ ein (Standard aus).
- Eltern sind die ersten zwei erfassten Eltern der Person. Eine nicht biologische Beziehung (Adoption, Stief-,
  Pflegeverhältnis) ist am Segment gekennzeichnet.
- Ein Vorfahr, der im Fächer ein zweites Mal vorkommt, wird erneut gezeichnet, aber nicht weiter entfaltet; Legende
  **↻ wiederholt (Ahnenschwund)**. Die Auswahl **Erstes Vorkommen zeigen** springt an seine erste Stelle.
- Nachkommen (Form Beidseitig): Partnerschaften in der Reihenfolge der Hochzeiten (Datum der Hochzeit, dann
  Reihenfolge in den Daten), Kinder nach Geburt. Ein unbekannter Partner sammelt die Kinder ohne zweiten Elternteil.
  Eine Partnerschaft ohne Kinder ist nur bei der zentralen Person zu sehen.
- **Farben:** **Geschlecht** · **Linien** (vier Linien der Großeltern: Vater des Vaters, Mutter des Vaters, Vater
  der Mutter, Mutter der Mutter) · **Stammlinien** ([A4](A4-surnames-and-families.md)).
- **Ursprüngliche Person** bringt den Fächer zurück zu der Person, von der aus begonnen wurde.
- **Gilt seit:** Fächer App 1.8.0; neuer Fächer mit Formen, Farben und Ahnenschwund App 3.20.0

<!-- zdroj: app:src/fan-chart.ts FAN_MIN_GENERATIONS, FAN_MAX_GENERATIONS, FAN_DEFAULT_GENERATIONS, parentSlots, repeatOf · strings.ts fan.shapeHalf, fan.shapeFull, fan.shapeTwo, fan.colorGender, fan.colorLine, fan.colorRod, fan.legendRepeats, fan.originPerson, fan.showFirst, fanChart.kekuleHint · settings fanKekule (výchozí false) · spec 029 · CHANGELOG.cs.md 3.20.0 -->

<a id="A6.5"></a>
## A6.5 Karte

Die Karte zeigt die Orte der Ereignisse der Personen.

- **Umfang:** **Diese Ansicht** (Standard, Personen der Ansicht) · **Ganzer Stammbaum**.
- **Arten:** **Geburten** · **Sterbefälle** · **Eheschließungen** · **Weitere Ereignisse**. Standardmäßig sind alle
  eingeschaltet; die Auswahl wird auf dem Gerät gespeichert.
  - Die Taufe zählt zur Geburt, Beerdigung und Einäscherung zum Tod.
  - Verlobung, Aufgebot, Heiratserlaubnis und Ehevertrag zählen zur Eheschließung. Andere Ereignisse des Paares sind
    Weitere Ereignisse.
- Der Ort der Hochzeit wird gezeigt, wenn mindestens einer der Partner in der Ansicht ist.
- Ein Ort wird in der häufigsten Schreibung geschrieben. Eine Gemeinde ist ein Punkt, auch mit Hausnummern; ein Ort
  mit eigenen genauen Koordinaten bleibt ein eigener Punkt.
- **Gilt seit:** Karte App 1.10.0; Arten der Ereignisse und Punkte der Gemeinden App 3.21.0

<!-- zdroj: app:src/places.ts collectPlaces, groupTownPoints · src/ui/map-ui.ts (localStorage strom.map.kinds) · strings.ts map.scopeView, map.scopeTree, map.kinds · CHANGELOG.cs.md 3.21.0 -->

<a id="A6.5.1"></a>
### A6.5.1 Woher die Karte die Lage eines Ortes nimmt

Im eigenen Stammbaum (ohne Forschung) schlägt die App die Lage der Orte selbst nach, im Dienst OpenStreetMap
(Nominatim). Sie sendet nur den Namen des Ortes, wie er im Stammbaum steht, und nur mit Zustimmung. In einem
Stammbaum aus der Forschung bestimmt die Forschung die Orte ([R4](R4-places.md)).

- **Grenzen:**
  - vor dem ersten Nachschlagen fragt die App (**Koordinaten online nachschlagen?**). Hinaus gehen nur Ortsnamen,
    keine Namen von Personen, keine Daten und Beziehungen. Höchstens etwa eine Anfrage pro Sekunde;
  - die Koordinaten werden im Stammbaum gespeichert: jeder Ort wird einmal nachgeschlagen, und die Karte funktioniert
    dann auch ohne Verbindung;
  - das automatische Nachschlagen nimmt das **erste Ergebnis** des Dienstes für den geschriebenen Namen. Bis App
    3.23.0 unterschied es dabei gleichnamige Gemeinden nicht: ein Ort konnte so in eine gleichnamige Gemeinde
    anderswo fallen. Eine Lage, die nicht in den Stammbaum passt, markiert **Prüfen** ([R4.4.1](R4-places.md#R4.4.1));
  - nur ein Ort mit Hausnummer, den der Dienst nicht gefunden hat, wird nach der Gemeinde nachgeschlagen. Von den
    Gemeinden dieses Namens wird die gewählt, die den übrigen Orten des Stammbaums am nächsten liegt („Mehrere Orte
    tragen diesen Namen; gewählt wurde der, der den übrigen Orten des Stammbaums am nächsten liegt.“); beim Ort steht
    **Lage nach dem Ort …**;
  - **ab App 3.24.0** wird die nächste Gemeinde bei jedem Ort gewählt: heißen zwei oder mehr Gemeinden genau wie der
    geschriebene Ort (ohne Rücksicht auf Groß- und Kleinschreibung und diakritische Zeichen), wird die genommen, die
    der Mitte des Stammbaums am nächsten liegt, nicht das erste Ergebnis. Die Mitte ist der Median der Lagen, die von
    Hand eingetragen oder mit **Beibehalten** bestätigt sind, wenn es mindestens 3 sind; sonst der Median aller Lagen
    des Stammbaums und der Orte, die das Nachschlagen ohne Zweifel gefunden hat. Ein Ort mit weiterer Angabe („Lhota u
    Kolína“, „Lhota 16“), eine einzige Gemeinde oder ein Stammbaum ohne Lagen bekommt das erste Ergebnis wie früher.
    Es bleibt bei einer Anfrage je Ort;
  - die Prüfung des Ortes sagt, wie viele Gemeinden dieses Namens die Karte gefunden hat („Die Karte fand 3 Orte
    dieses Namens und nahm den, der den übrigen Orten des Stammbaums am nächsten liegt.“); ab App 3.24.0, früher
    immer „zwei“;
  - eine Lage, die schon im Stammbaum ist, wird nicht verschoben: das Nachschlagen sucht nur Orte ohne Lage. Auch das
    Zusammenführen mit einem anderen Stammbaum oder einer GEDCOM-Datei überschreibt eine von Hand eingetragene oder
    mit **Beibehalten** bestätigte Lage nicht, es ergänzt nur fehlende. Eine falsche ältere Lage lässt sich nur von
    Hand verschieben;
  - was nicht gefunden wird, bleibt ohne Lage. Die App rät nichts: „Schreibweise prüfen oder das Land hinzufügen“.
- **Bedienung:** App: **Einstellungen → Orte online nachschlagen**; im Fenster der Orte **Falsche Stelle? Diesen Ort
  korrigieren**, **Diesen Ort unter einem anderen Namen suchen** (nur die Lage wird ergänzt, der Eintrag im Stammbaum
  ändert sich nicht), **Auch für die übrigen Hausnummern in … verwenden**, **Verwaiste Orte bereinigen (n)**.
- **Warum:** das Nachschlagen von Orten ist der einzige Teil der App, der etwas nach außen sendet; darum nur mit
  Zustimmung, nur Namen und jeden Ort einmal (Kommentar im Code). Das Limit von einer Anfrage pro Sekunde ist eine
  Bedingung des Dienstes.
- **Gilt seit:** App 1.10.0; **Falsche Stelle? Diesen Ort korrigieren** 1.10.1; **Verwaiste Orte bereinigen** 2.1.0;
  Lage nach dem Ort 3.21.0; die nächste gleichnamige Gemeinde bei jedem Ort und die Zahl der Gemeinden in der Prüfung
  3.24.0

<!-- zdroj: app:src/geocode.ts hlavička, REQUEST_INTERVAL_MS=1100, geocodePlace (limit 1, parseGeocodeResponse první výsledek), geocodeTown/pickTownHit nearestTo (od v3.21.0), geocodePlaces townFallback · app:src/strings.ts map.consentTitle, consentBody, settingLabel, wrongSpot (v1.10.1), searchLabel, attachOnly, useForOthers, cleanOrphans (v2.1.0), nearestTown, byTown, doneWithMisses · FB podnět 2026-11-04 (stejnojmenná obec) · od 3.24.0: geocode.ts treeCenter (medián, PERSONS_CENTER_MIN=3), sameNamedTowns, pickPlaceHit (townChoices), buildGeocodeUrl limit · place-check.ts multi count · strings.ts checkMulti(n) · merge-executor test (ruční poloha zůstane) · commit 046967d -->

<a id="A6.5.2"></a>
### A6.5.2 Orte ohne Karte in der Forschung suchen

Bei einem Stammbaum mit Forschung bietet die Statusleiste der Karte die Orte ohne Lage zum Suchen in der Forschung an
([R4.4](R4-places.md#R4.4)). Die Schaltfläche öffnet das Fenster **Orte** mit einer Vorschau; in die Warteschlange der
Forschung kommen die Orte erst nach **Vormerken**.

- **Grenzen:**
  - vor der Suche der Karte steht in der Leiste neben der Kartensuche **In der Forschung**. Nach der Suche, wenn die
    Karte manche Orte nicht gefunden hat, zeigt die Leiste „N Orte auf der Karte · K nicht gefunden“ und **In der
    Forschung suchen (K)**, gegebenenfalls „N zu bestätigen ›“ (öffnet **Offen** im Forschungsbereich);
  - die Schaltfläche gibt es nur bei einem Stammbaum mit Forschung und nur, wenn es etwas zu suchen gibt: einen Ort
    ohne Lage oder nicht bestimmt, der noch nicht in der Warteschlange ist, nicht bearbeitet wird und nicht auf eine
    Antwort wartet;
  - das Fenster **Orte** zeigt die Vorschau „N Orte ohne Karte in der Forschung suchen“. Vor **N Orte vormerken** wird
    nichts vorgemerkt, und kein Ort wird doppelt vorgemerkt;
  - läuft die Forschung auf einem anderen Computer, oder auf dem Telefon, sagt die App statt des Fensters, wo die
    Suche geht: „Suchen und prüfen geht in der Forschung auf dem Computer, wo sie läuft. Der Stand der Orte kommt mit
    dem Stammbaum hierher.“, auf dem Telefon „Suchen und prüfen geht am Computer mit der Forschung. Fragen zu Orten
    lassen sich auch hier beantworten, in Offen.“ Ältere Forschung: „Diese Version der Forschung sucht noch keine
    Orte.“;
  - beim Verfolgen der Forschung auf der Karte ([S4.1.3](S4-research-from-the-app.md#S4.1.3)) bietet die Zeile „… –
    ohne Position auf der Karte“ **In der Forschung suchen**: sie merkt diesen einen Ort sofort vor, ohne Vorschau;
    das Vormerken lässt sich in der Meldung zurücknehmen.
- **Bedienung:** App: Karte → Statusleiste → **In der Forschung**, nach der Kartensuche **In der Forschung suchen
  (K)** → Fenster **Orte** → **N Orte vormerken**.
- **Gilt seit:** App 3.25.0

<!-- zdroj: app:src/ui/map-ui.ts (stavový pruh, lookResearch, lookable), src/ui/place-actions.ts, src/ui/places-research-ui.ts (bulkLook, bulkLookHead, bulkLookGo, nic dvakrát), src/ui/map-follow-ui.ts (noCoords + places.research.look, Undo) · strings.ts map.onMap.notFound, lookResearch, lookResearchShort, lookResearchTitle, confirm; places.dialog.elsewhere, phoneLine, oldResearch · CHANGELOG.cs.md 3.25.0 · commit 2246ca28 · spec 058 -->

<a id="A6.6"></a>
## A6.6 Stammlinie in der Ansicht

Eine Ansicht kann eine Stammlinie hervorheben ([A4](A4-surnames-and-families.md)): ihre Mitglieder voll, Ehefrauen
und Ehemänner, die durch Heirat in die Stammlinie kamen, schwächer, die übrigen gedämpft. Das gilt in den Ansichten
Familie, Nachkommen und Fächer.

- Die Auswahl wird für jeden Stammbaum auf dem Gerät gespeichert. Eine Stammlinie, die es im Stammbaum nicht mehr
  gibt, wird still aufgehoben.
- Wenn in der Ansicht kein Mitglied der Stammlinie gezeichnet ist:
  - Familie und Fächer verschieben die zentrale Person auf das nächste Mitglied der Stammlinie (über Eltern, Kinder
    und Partner; bei Gleichstand auf das ältere), und wenn die Person mit ihm nicht verbunden ist, auf den
    Stammvater;
  - Nachkommen verschiebt die zentrale Person immer auf den Stammvater;
  - die Leiste bietet **↩ Zurück** an.
- **Grenzen:** das Wiederherstellen der Auswahl aus dem Speicher verschiebt die zentrale Person nicht.
- **Bedienung:** **Stammlinien** in der Leiste; im Angebot der Person **Nur Stammlinie …** (die Herkunftslinie der
  Person steht zuerst); Ende über × am Etikett oder **Ganzen Stammbaum zeigen**.
- **Gilt seit:** App 3.21.0

<!-- zdroj: app:src/ui/rod-view.ts · src/rod-focus.ts (BFS přes rodiče, děti, partnery) · strings.ts rodView.only, rodView.whole, rodView.moved · spec 039 · CHANGELOG.cs.md 3.21.0 -->
