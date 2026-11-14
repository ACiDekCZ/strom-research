<a id="A6"></a>
# A6 Ansichten und Auswahl der Personen

Wie die Strom-App auswählt, welche Personen sie zeigt, und wie die einzelnen Ansichten sie zeigen. Beschrieben wird
die App 3.21.2. Änderungen aus einer neueren Version tragen deren Nummer.

Eine Ansicht ist eine andere Lesart **derselben Auswahl der Personen**. Die Auswahl bestimmen die zentrale Person
(die angeklickte) und die Tiefe **Vorfahren** und **Nachkommen**. Familie, Nachkommen, Zeitleiste und Karte zeigen
dasselbe Umfeld der zentralen Person. Der Fächer berechnet Vorfahren und Nachkommen selbst nach der Zahl der
Generationen ([A6.4](#A6.4)). Die Tabelle zeigt den ganzen Stammbaum ([A6.7](#A6.7)).
Am Computer lässt sich jede Ansicht auch in einem eigenen Fenster öffnen ([A6.8](#A6.8)).

Ansichten: **Familie**, **Nachkommen**, **Zeitleiste**, **Fächer**, **Karte**, **Tabelle**.

<!-- zdroj: app:src/types.ts:1237 ViewMode · strings.ts viewModeSwitch.* · Tabulka od aplikace 3.27.0 (viewModeSwitch.table) -->

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

<a id="A6.1.2"></a>
### A6.1.2 Abstände: Normal und Dicht

Die Einstellung **Abstände** bestimmt die Lücken zwischen den Karten und zwischen den Generationen in den Ansichten
Familie und Nachkommen. **Dicht** macht sie kleiner, damit mehr Personen auf den Bildschirm passen. **Normal** ist der
Standard, auch auf dem Telefon.

| Lücke | Normal | Dicht |
|---|---|---|
| zwischen Karten nebeneinander | 31 px | 20 px |
| zwischen Generationen | 80 px | 48 px |
| zwischen Partnern | 18 px | 14 px |

- Nach dem Umschalten wird der Stammbaum sofort neu gezeichnet und bleibt bei derselben Person: bei der Karte der
  zentralen Person, wenn sie ganz im Bild ist, sonst bei der Karte, die der Mitte am nächsten ist. Ebenso verhält sich
  der Stammbaum nach einer Änderung von **Kartendetail**.
- **Ehefolge:** bei Dicht steht statt der Marke „1. ∞ 1866“ nur ein kurzes „∞ 1“ am Rand der Karte, also die
  Stelle dieser Ehe in der Folge. Die ganze Reihenfolge zeigt eine Blase (mit der Maus, der Tastatur und durch Tippen).
  Eine Marke, die an der Karte keinen Platz hat, wird nicht gezeichnet.
- **Export:** der Posterexport hat eine eigene Einstellung **Abstände** (nach dem Papierformat und der Ausrichtung).
  Weicht sie vom Bildschirm ab, werden Bild, Poster und PDF in Blättern mit den gewählten Abständen neu angeordnet,
  mit derselben Auswahl der Personen und denselben Karten; der Bildschirm ändert sich nicht. Unter jeder Möglichkeit
  steht die Zahl der Blätter („26 Blätter A4“), wenn sich die Zahlen unterscheiden. Der Druck (Strg+P) nimmt die
  Abstände des Bildschirms.
- **Grenzen:** die Einstellung gehört zum Gerät und wird nicht mit dem Stammbaum gespeichert. Zeitleiste, Fächer, Karte
  und Tabelle haben eine eigene Anordnung, die Einstellung betrifft sie nicht; der Posterexport aus dem Fächer und der
  Zeitleiste hat keine Zeile **Abstände**.
- **Bedienung:** **Einstellungen** → **Personenkarte** → **Abstände** (nach **Kartendetail**): **Normal** ·
  **Dicht**. Auf einem kleinen Bildschirm ohne Kompakt-Karte steht unter der Einstellung „Auf einem kleinen Bildschirm
  hilft auch die Kompakt-Karte.“ Export: **Poster exportieren** → **Abstände**.
- **Gilt seit:** App 3.27.0

<!-- zdroj: app:src/types.ts TreeSpacing, DEFAULT_LAYOUT_CONFIG (31/80/18), DENSE_LAYOUT_CONFIG (20/48/14), layoutConfigFor · src/settings.ts getTreeSpacing/setTreeSpacing (treeSpacing), getPosterSpacing/setPosterSpacing (posterSpacing), výchozí normal · src/renderer.ts:804 STANDALONE_VIEWS (timeline, fan, map, table), getPosterLayout({spacing}), kotva překreslení (ústřední karta celá v obraze, jinak nejbližší středu; i při změně typu karty) · src/marriage-order.ts (husté: „∞ N“ na okraji karty, bez místa se nekreslí) · src/ui/export-image-ui.ts (řádek za formátem a orientací, skrytý u vějíře a časové osy, sheetsCount) · strings.ts spacing.label, normal, dense, desc, scope, scopeExport, smallHint, marriageOrder.short, poster.menu, poster.sheetsCount, settings.groupCard, cardDensity.settingLabel · commity 68b9dde4, 03918007, 928db183, e2891a8a · spec 069 K1.1, K3.1 -->

<a id="A6.1.3"></a>
### A6.1.3 Kinder und Geschwister auf einmal

In der Ansicht Familie lassen sich mit einem Schritt an Ort und Stelle die Kinder der Person und die Geschwister der
Person und ihrer Vorfahren zeigen. Fokus, Tiefe und Zoom bleiben, die Karte der Person steht an derselben Stelle des
Bildschirms.

- **Wer hinzukommt:**
  - die Kinder der Person (nicht die Enkel);
  - die Geschwister der Person und jedes ihrer Vorfahren, der in der Ansicht ist und dessen Eltern in der Ansicht sind.
    Die oberste Reihe der Tiefe **Vorfahren** wird nicht aufgeklappt (ihre Geschwister brächten eine neue Generation,
    das ist Aufgabe der Tiefe); bei ihr bleibt „▸ Eltern“;
  - Geschwister sind die Kinder der Eltern in der Ansicht aus allen Ehen, wie beim einzelnen „Geschwister hier
    zeigen“. Mit den Kindern kommen ihr anderer Elternteil, die Partner, die die Ansicht mit ihnen zeichnet, und das,
    was die Tiefe **Nachkommen** unter ihnen hält.
- **Anzahl +n:** wie viele Karten der Schritt hinzufügt; sie berechnet dieselbe Anordnung wie die Ansicht, sodass
  nach dem Schritt genau n Karten hinzukommen. Sie wird nach jedem Zeichnen neu gezählt.
- **Grenzen:**
  - der Schritt ist eine Anordnung, ein Schritt im Verlauf und ein Schritt von **Gezeigte ausblenden · n** (n + 1).
    Rückgängig machen ihn **Zurück** im Verlauf, **Gezeigte ausblenden** (nimmt alles Gezeigte zurück) oder dieselbe
    Wahl noch einmal („Kinder und Geschwister zuklappen“);
  - an den betroffenen Karten stehen die Reiter „▾ Kinder“ und „▾ Geschwister“, und einzelne Familien lassen sich
    weiter einzeln zuklappen;
  - eine neue Person im Fokus, eine andere Ansicht oder ein anderer Stammbaum heben den Schritt auf. Eine Änderung
    der Tiefe **Vorfahren** oder **Nachkommen** beendet alle Schritte „auf einmal“: ihre Karten verschwinden,
    einzeln gezeigte Familien bleiben, und die Wahl bietet das „+n“ der neuen Tiefe an;
  - über 150 Personen fragt die App zuerst in einer Blase: „n Personen kommen hinzu“, „Der Baum wird etwa
    k Bildschirmbreiten breit. Der Zoom bleibt.“ (k aus der tatsächlichen Anordnung beim jetzigen Zoom, aufgerundet)
    und die Schaltflächen **Aufklappen +n**, **Nur 2 Vorfahrengenerationen +m** (nur die Geschwister der Person, der
    Eltern und der Großeltern; fehlt, wenn m gleich n oder 0 ist) und **Abbrechen**. Esc, ein Klick daneben oder eine
    Änderung der Fenstergröße = Abbrechen. Bis 150 Personen ohne Frage.
- **Bedienung:** App, Ansicht Familie:
  - die Leiste der Ansicht, gleich nach der Auswahl **Vorfahren** und **Nachkommen**: **Kinder & Geschwister +n** für
    die Person im Fokus. Ein eingeschalteter Schritt zeigt ✓, und ein Klick nimmt ihn zurück; gibt es nichts
    hinzuzufügen, ist die Wahl gedämpft („Alle Kinder und Geschwister sind schon sichtbar“). Auf dem Tablet Symbol
    und „+n“; passt sie nicht in die Leiste, weicht sie (das Menü der Person hat sie weiter). Das Telefon hat die Wahl
    in der Leiste nicht;
  - das Menü der Person (bei Berührung das untere Feld der Person) unter den Zeilen, die Eltern, Geschwister und
    Kinder an Ort und Stelle zeigen: **Kinder und Geschwister aufklappen · +n** mit der Unterzeile „Kinder der Person,
    Geschwister der Person und ihrer Vorfahren“, nur wenn es etwas hinzuzufügen gibt; solange der Schritt der Person
    steht, **Kinder und Geschwister zuklappen**. Bei der Person im Fokus ist es derselbe Schritt wie in der Leiste.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:f5d56ed3 src/bulk-family.ts collectBulkFamily (childrenOf osoba; siblingsOf osoba a předci v pohledu s rodiči v pohledu; maxGeneration), bulkParents, bulkNewIds (drawnPersonIds, kroky 1–5 pipeline), BULK_CONFIRM_ABOVE 150, BULK_TWO_GENERATIONS 2 · src/renderer.ts bulkFamilyPlan (jen family), bulkFamilyState (offer/on/none), bulkFamilyScreens (ceil šířka × zoom / plátno), showBulkFamily → showChildrenOf (jeden krok historie, zoom beze změny, kotva), undoBulkFamily, bulkStepOf (jen při stejné hloubce), forgetBulkSteps při změně hloubky, resetChildrenShown při změně fokusu, pohledu, stromu, hiddenShownCount (+1 za krok) · src/ui/bulk-family-ui.ts confirmBulkFamily (Esc, klik vedle, resize = zrušit; two jen m > 0 a m ≠ n), runBulkFamily, updateBulkFamilySwitches (title treeTip/menuOff/treeNone, aria-disabled) · src/ui/context-menu.ts bulkFamilyRows (offer: menu, +n, menuSub; on: menuOff) · src/ui/toolbar-fit.ts (tablet: přepínač ustoupí před hledáním, f5d56ed3) · index.html button.bulk-family (telefon skrytý) · strings.ts bulk.*, menu.showChildrenHere, showSiblingsHere, focusBar hideAllShown, history back · app 2eb013ba, cecea43f, 8dc34565, f5d56ed3 · dirigent:prace/1113-app-drobnosti-1112 · ZADANI_DEV_drobnosti-1112 §3 -->

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
- **Ab App 3.27.0:** eine Partnerschaft ohne Datum der Hochzeit wird nach dem spätesten möglichen Datum der
  Hochzeit geordnet: dem früheren aus dem Ende der Partnerschaft (Scheidung) und der Geburt des ersten Kindes der
  Partnerschaft. Eine Hochzeit „vor 1982“ steht vor einer Hochzeit im Jahr 1982. Eine Partnerschaft ohne diese Daten
  kommt nach den anderen. Dieselbe Reihenfolge haben die Partner neben der Person und die Marken der Ehefolge („1. ∞“)
  auf den Karten.

<!-- zdroj: app:src/fan-chart.ts FAN_MIN_GENERATIONS, FAN_MAX_GENERATIONS, FAN_DEFAULT_GENERATIONS, parentSlots, repeatOf · strings.ts fan.shapeHalf, fan.shapeFull, fan.shapeTwo, fan.colorGender, fan.colorLine, fan.colorRod, fan.legendRepeats, fan.originPerson, fan.showFirst, fanChart.kekuleHint · settings fanKekule (výchozí false) · spec 029 · CHANGELOG.cs.md 3.20.0 · 3.27.0: app:ad1ca16c src/marriage-order.ts marriageKey (BOUND 0.5, qualifier „<“; bez sňatku min(endDate, narození dětí)), marriageDates, compareMarriages, marriagesInOrder (partneři vedle osoby, značka „1. ∞“) · src/fan-chart.ts familiesOf · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1109-app-tester-vlna1 (T50, T13) -->

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
- **Migration im Zeitverlauf** zeigt die Orte nach Jahren und den Weg der Vorfahren zu einer Person
  ([A6.5.3](#A6.5.3)).
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

<a id="A6.5.3"></a>
### A6.5.3 Migration im Zeitverlauf

**Migration im Zeitverlauf** zeigt die Orte nach Jahren. Der Schieberegler in der Leiste unter der Karte bestimmt das
Jahr, und die Karte zeigt die Orte, die bis zu diesem Jahr hinzugekommen sind, und die Linien der Umzüge der Familie.

- **Grenzen:**
  - auf der Leiste sind nur Orte mit Jahr und Lage. Orte mit Lage, aber ohne Datum zählt die Statusleiste („N Orte
    ohne Datum werden auf der Zeitleiste nicht angezeigt.“);
  - die Leiste reicht vom ältesten bis zum jüngsten Jahr der Orte im Umfang (**Diese Ansicht** / **Ganzer
    Stammbaum**) und in den eingeschalteten Arten ([A6.5](#A6.5)). Ohne datierte Orte lässt sich der Modus nicht
    einschalten;
  - ein Punkt, an dem in den letzten zehn Jahren vor dem gewählten Jahr etwas geschah, ist hervorgehoben;
  - eine Linie führt vom Geburtsort eines Elternteils zum Geburtsort des Kindes, wenn beide Jahr und Lage haben und
    verschieden sind. Geschwister mit demselben Weg haben eine Linie. Die Linie verblasst mit dem Alter des Kindes,
    nach 60 Jahren auf 15 %. Gezeichnet werden nur Linien mit einem Ende am Kartenausschnitt, höchstens 400. Ohne die
    Art **Geburten** werden keine Linien gezeichnet („Der Familienweg erscheint nur mit Geburten.“);
  - **Abspielen** verschiebt das Jahr etwa alle 120 ms bis zum letzten Jahr. Im letzten Jahr beginnt **Abspielen**
    wieder von vorn.
- **Ab App 3.28.0:**
  - die Schaltfläche **◷ Zeitverlauf** hat neben dem Symbol auch Text;
  - die Karte bietet den Modus einmal an: solange er nicht eingeschaltet war und der Stammbaum mindestens zwei
    datierte Orte mit Lage hat, steht bei der Schaltfläche der Hinweis **Migration im Zeitverlauf** („Spielt ab, wie
    die Linien umzogen, und zeigt den Weg der Vorfahren zu einer Person.“). **Ausprobieren** schaltet den Modus ein,
    **Nicht jetzt** schließt den Hinweis. Nach einer der beiden erscheint der Hinweis auf diesem Gerät nicht mehr;
  - Tasten am Schieberegler: Pfeile um ein Jahr, PageUp und PageDown um 10 Jahre, Home und End an Anfang und Ende.
    Die Leertaste irgendwo auf der Karte (außer in Feldern und auf Schaltflächen) spielt ab oder pausiert. Ein
    Verschieben von Hand pausiert das Abspielen;
  - im Modus lässt sich eine Person wählen, zu der der Weg ihrer Vorfahren führt ([A6.5.4](#A6.5.4));
  - **Abspielen** und **Pause** sind gleich breit (so breit wie das längere der beiden Wörter in der jeweiligen
    Sprache), sodass sich Schieberegler, seine Marken und das Jahr beim Starten und Anhalten nicht verschieben. Das
    Telefon hat nur das Symbol.
- **Bedienung:** App: Karte → **◷ Zeitverlauf** (**Migration im Zeitverlauf**) → Schieberegler, **Abspielen** /
  **Pause**.
- **Gilt seit:** App 2.4.0; Arten der Orte 3.21.0; Text der Schaltfläche, einmaliges Angebot, Tasten und feste
  Breite von **Abspielen** 3.28.0

<!-- zdroj: app:src/map-time.ts collectDatedPlacePoints (undatedPlaceCount, minYear/maxYear) · src/ui/map-ui.ts drawMapTimeLayer (fresh = posledních 10 let, slice(0, 400) s koncem u výřezu), mapMigrationSegments (místa narození rodič → dítě, opacity max(0.15, 1 − věk/60·0.85), bez Narození nic), toggleMapTimePlay (setInterval 120, na konci od začátku), renderMapTimeTip / dismissMapTimeTip (strom.map.timeTipSeen, ≥ 2 datovaná místa s polohou, podklad mapy potvrzený), klávesy na posuvníku a mezerník (setMapTimeYear pozastaví) · strings.ts map.timeMode, timeModeShort, timeModeEmpty, timePlay, timePause, timeUndated, noFamilyPath, timeTipTitle, timeTipText, timeTipTry, timeTipLater · Migrace v čase od v2.4.0 (app 44a903bc) · 3.28.0: app 34e82d43, cce82a89 (app:81f2adf0) · CHANGELOG.cs.md 3.21.0, 3.28.0 · spec 054 P2 · stálá šířka Přehrát/Pozastavit: app 35ed67f9 src/ui/map-ui.ts (obě slova v jedné buňce, map-time-play-word), index.html .map-time-play-text -->

<a id="A6.5.4"></a>
### A6.5.4 Der Weg der Vorfahren zu einer Person

In der Migration im Zeitverlauf lässt sich eine Person wählen. Die Karte zeigt dann nur ihre direkten Vorfahren und
die Linien von jedem Vorfahren zu seinem Kind bis zur gewählten Person, und die Leiste endet bei ihr.

- **Grenzen:**
  - Vorfahren sind die Eltern, deren Eltern und so weiter, höchstens 30 Generationen. Die Eltern werden wie im Fächer
    genommen ([A6.4](#A6.4)). Ein Platzhalter als zweiter Elternteil einer Familie mit einem Elternteil ist kein
    Vorfahr: sein Zweig ist unbekannt;
  - ein Vorfahr, zu dem mehrere Wege führen (Ahnenschwund), ist auf der Karte ein Punkt, zählt aber in jedem Zweig,
    zu dem er gehört. Im selben Zweig werden seine Vorfahren nicht ein zweites Mal entfaltet;
  - ein Vorfahr steht am Geburtsort, ohne ihn am Taufort, ohne ihn am ersten datierten Wohnort; immer nur an einem
    Ort mit Lage. Sein Jahr ist das Geburtsjahr, ohne es das Jahr der Taufe, ohne es das Jahr dieses Ortes. Ein
    Vorfahr ohne Jahr oder ohne Ort mit Lage ist nicht auf der Leiste: die Legende zählt ihn, und **Liste ›** nennt
    ihn mit dem, was fehlt (**ohne Geburtsdatum**, **ohne Ort**, **ohne Datum und Ort**), und **Personenseite ›**
    ([A6.5.5](#A6.5.5));
  - die gewählte Person steht genauso. Sie ist das Ziel: Kreis „◎ Ziel: Name“, am Ende der Leiste ein voller Kreis
    „◎ Name · Jahr“ (beim Taufort „· Taufe Jahr“, beim Wohnort „· Wohnort Jahr“). Ein Ziel ohne Ort auf der Karte
    wird nicht gezeichnet, und am Ende der Leiste steht „… hat keinen Ort auf der Karte.“;
  - die Leiste reicht vom Jahr des ältesten Vorfahren auf der Karte bis zum späteren der Jahre des letzten Vorfahren
    und des Ziels;
  - der Weg nimmt die Vorfahren aus dem ganzen Stammbaum: statt des Umfangs steht ein Chip mit der Person, nach dem
    Aufheben des Weges kehrt der Umfang zurück. Die Arten der Orte gelten für den Weg nicht. Der Punkt einer Gemeinde
    sammelt auch ihre Häuser wie ohne Weg;
  - die Blase eines Ortes zeigt nur die Personen des Weges an diesem Ort, die Vorfahren bis zum gewählten Jahr und
    das Ziel, mit den Etiketten ihrer Stammlinien;
  - nach der Wahl der Person verschiebt und vergrößert sich die Karte einmal auf den ganzen Weg, danach bewegt sie
    sich nicht von selbst (Ausnahme am Ende des Abspielens, [A6.5.6](#A6.5.6));
  - es gibt höchstens 400 Linien wie ohne Weg. Sind es mehr, haben Vorrang: der Stamm (Eltern und Großeltern),
    Linien aus den letzten 10 Jahren, nähere Generationen, ein Ende im Kartenausschnitt, die längere Linie. Die
    Legende sagt es („N von M Linien gezeigt“, „Vorrang haben nähere Generationen und neu hinzugekommene Linien.“);
  - das Ausschalten von **Zeitverlauf** blendet den Weg nur aus. Nach dem Einschalten kehrt er zurück und läuft ab
    dem ersten Jahr. Aufgehoben wird er mit **×** am Chip;
  - ein neues Fenster mit der Karte ([A6.8](#A6.8)) übernimmt die Person des Weges, Viertel oder Achtel und die
    Farben der Stammlinien.
- **Wahl der Person:** **Weg zu einer Person** sucht im ganzen Stammbaum („Name, Nachname oder Jahr“), höchstens 30
  Personen. Ein leeres Feld zeigt die zentrale Person (**Zuletzt fokussiert**). Bei jeder Person steht, wie viele
  ihrer Vorfahren auf der Karte sind; eine Person ohne sie ist ausgegraut („Vorfahren noch ohne Orte auf der Karte“)
  und lässt sich nicht wählen. Auf dem Telefon und einem Touch-Gerät öffnet sich die Wahl als Blatt von unten. Wenn
  kein Vorfahr auf der Karte ist, sagt die Leiste „Noch kein Vorfahre hat einen Ort auf der Karte.“ und bietet
  **Andere Person wählen** an.
- **Bedienung:** App:
  - Karte → **◷ Zeitverlauf** → in der Leiste **◎ Weg zu einer Person…** → Person. Der Chip **◎ Weg zu:** Name
    öffnet die Wahl erneut (**Person ändern**), **×** hebt den Weg auf (**Weg aufheben**);
  - in der Blase eines Ortes Klick auf eine Person → **◎ Weg zu dieser Person** (neben **Personenseite ›**), auch
    ohne gewählte Person;
  - auf der Personenseite **◎ Weg der Vorfahren auf der Karte ›** ([A7.6](A7-book-pages-and-export.md#A7.6)): die
    Seite schließt sich, die Karte zeigt den Weg ab dem ersten Jahr, und die Meldung bietet **‹ Zurück zur
    Personenseite** an. Der Link steht im Abschnitt **Lebensorte**. Eine Person mit höchstens einem eigenen Ort hat
    diesen Abschnitt nicht; hat sie Vorfahren auf der Karte, steht der Link in einer eigenen Zeile dort, wo der
    Abschnitt wäre. Hat die Person Vorfahren, aber keiner ist auf der Karte, ist der Link ausgegraut („Noch kein
    Vorfahre hat einen Ort auf der Karte.“) und nur im Abschnitt **Lebensorte**. Ohne Vorfahren im Stammbaum gibt es
    den Link nicht.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:src/map-lines.ts buildPathModel (maxGen 30, fatherMother přes parentSlots jako vějíř, isPlaceholder není předek, implex záznam na cestu, expanded podle osoby a větve), placeOf (narození → křest → první datované bydliště, jen s polohou; rok narození → křest → místa), missing (date/place/both), yearFrom/yearTo, links, pathSegments (PATH_LINE_CAP 400, pořadí kmen, fresh < 10 let, generace, výřez, délka) · src/ui/map-path-ui.ts (mapEffectiveScope celý strom, čip místo rozsahu, clearMapPath vrátí rozsah, jednorázový výřez framed, cíl čárkovaný → plný, pathTargetNoPlace, pathNoAncestors + pathOtherPerson) · src/person-picker.ts PathPersonPicker (limit 30, recentId = ústřední osoba, onMapCount 0 = aria-disabled, celý strom) · src/ui/map-lines-legend-ui.ts mapPathBubbleParts · src/ui/map-ui.ts showMapPathPlace, toggleMapTime (vypnutí skryje, zapnutí od začátku) · src/ui/person-page-ui.ts personPageMapPath (on/off/null), openPersonPageMapPath (toast map-path-back) · src/person-page-map.ts (pp-map-path, aria-disabled, jen v okně aplikace; mapPathRowHtml vlastní řádek bez oddílu Místa života jen pro mapPath on, app caea192a) · src/person-page.ts mapPathRow · src/windows/view-window-state.ts MapTimeState path, mode, colors · strings.ts map.pathPick, pathPickTitle, pathPickPlaceholder, pathPickRecent, pathPickOnMap, pathPickNone, pathChip, pathChange, pathClear, pathFromPage, pathThisPerson, pathBackToPage, pathGoal, pathGoalEnd, pathTargetNoPlace, pathNoAncestors, pathOtherPerson, linesCut, linesCutWhy, missingDate, missingPlace, missingBoth · app 388e5a87, b01693bc, 5853882e, 34e82d43 (app:81f2adf0) · dirigent:prace/1113-app-mapa-rody-v-case · ZADANI_UIX_mapa-rody-v-case D3, D4 (ponechat) · spec 054 K2.1, P2 · CHANGELOG.cs.md 3.28.0 -->

<a id="A6.5.5"></a>
### A6.5.5 Linienfarben und die Legende Stammlinien

Der Weg der Vorfahren ist nach Stammlinien gefärbt. Eine Stammlinie ist hier der Zweig eines Großelternteils
(Viertel) oder eines Urgroßelternteils (Achtel) der gewählten Person, benannt nach seinem Geburtsnamen. Es ist nicht
die Stammlinie nach dem Nachnamen ([A4](A4-surnames-and-families.md)).

- **Grenzen:**
  - die Viertel sind Vater des Vaters, Mutter des Vaters, Vater der Mutter und Mutter der Mutter, in denselben Tönen
    wie die Farben **Linien** im Fächer ([A6.4](#A6.4)). Jedes Viertel hat auch ein eigenes Linienmuster (das erste
    durchgezogen), sodass sich die Stammlinien auch bei schwächerem Farbsehen unterscheiden. Paare, die eine
    schwächere Unterscheidung von Rot und Grün verschmelzen lässt, unterscheiden sich in Helligkeit und Muster.
    Helles und dunkles Erscheinungsbild haben eigene Töne;
  - ein Achtel hat die Farbe seines Viertels, das zweite Achtel desselben Viertels einen dunkleren Ton. Die Nummer
    des Achtels (1–8) steht auf der längsten sichtbaren Linie jedes Achtels;
  - die Linien von Eltern und Großeltern sind der Stamm: in der Textfarbe und breiter. Die Punkte der Eltern haben
    die Farbe des Stamms, die Punkte der Großeltern die Farbe ihres Viertels. Ein Punkt, an dem sich mehrere
    Stammlinien treffen, hat die Farben aller;
  - eine Linie aus den letzten 10 Jahren ist breiter. Ältere Linien verblassen, höchstens auf 55 %, damit am Ende der
    ganze Weg zu sehen ist;
  - der Nachname der Stammlinie ist der Geburtsname des Großelternteils oder Urgroßelternteils; ohne Nachnamen sein
    Vorname.
- **Legende Stammlinien** (rechts unter den Steuerelementen der Karte, wenn mindestens ein Vorfahr auf der Karte
  ist):
  - **Viertel** · **Achtel**. **Achtel** lassen sich wählen, wenn der Stammbaum mindestens zwei Achtel kennt;
  - Zeile einer Stammlinie: Linienmuster, Nachname, Beziehung und Zahl der Vorfahren auf der Karte („Vater des
    Vaters · 12 Vorfahren“). Bei den Achteln stehen die Zeilen unter der Überschrift ihres Viertels („1 ·
    Nachname“). Ein unbekannter Großelternteil hat eine Zeile ohne Farbe („Mutter des Vaters – unbekannt“). Eine
    Stammlinie, von der kein Vorfahre auf der Zeitleiste ist (alle ohne Datum oder Ort), hat eine gedämpfte Zeile wie
    eine unbekannte, mit leerem gestricheltem Muster und „außerhalb der Zeitleiste“ statt der Zahl („Mutter des
    Vaters · außerhalb der Zeitleiste“); hervorheben oder anheften lässt sie sich nicht. Die letzte Zeile ist
    **Stamm: Eltern und Großeltern**;
  - das Überfahren einer Zeile hebt die Stammlinie kurz hervor, ein Klick heftet sie an und dämpft die übrigen
    Stammlinien. Esc oder ein zweiter Klick hebt das Anheften auf, ebenso das Umschalten von Vierteln und Achteln;
  - unter den Zeilen stehen: die erste Person in zwei Zweigen („↻ Name (Jahr) gehört zu zwei Linien: … und ….“),
    die Kürzung eines großen Stammbaums ([A6.5.4](#A6.5.4)), Vorfahren außerhalb der Leiste („N Vorfahren ohne Datum
    oder Ort sind nicht auf der Zeitleiste.“ und **Liste ›**, die Liste **Vorfahren außerhalb der Zeitleiste**) und
    **Ohne Linienfarben**;
  - **Ohne Linienfarben** zeichnet den ganzen Weg in einer Farbe und blendet die Zeilen der Stammlinien aus. Der
    Stamm bleibt breiter, und die Person bleibt gewählt;
  - **▴** (**Einklappen**) klappt die Legende zu einem Chip „Stammlinien (N)“ mit den Farben der Stammlinien
    zusammen. Die Karte verschiebt sich dadurch nicht.
- **Telefon:** die Legende öffnet sich als Blatt von unten aus dem Chip **Stammlinien (N)** über der Leiste,
  **Liste ›** ebenso. Offen ist immer nur ein Blatt (Legende, Liste, Blase oder Wahl der Person). Ein Telefon im
  Querformat hat den Chip in der oberen Reihe.
- **Bedienung:** App: Karte → **◷ Zeitverlauf** → Weg zu einer Person ([A6.5.4](#A6.5.4)) → Legende
  **Stammlinien**.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:src/map-line-colors.ts (LINE_HUE z fan-colors.ts jako vějíř Linie, tabulka OKLCH světlý/tmavý, QUARTER_DASH, lineCap, LINE_WIDTH base 3 / fresh 4 / trunk 4.5, pathLineOpacity max(0.55, 1 − věk/60·0.45), LINE_FOCUS_DIM, pointFill, lineSwatch; hlavička: dvojice 50↔95 a 215↔320 se liší světlostí i vzorem) · src/map-lines.ts lineClassOf (gen ≤ 2 kmen), pointClassOf (rodiče kmen), branchSurname (rodné příjmení, jinak křestní), quarters/eighths · src/ui/map-path-ui.ts drawMapPathLayer (čísla osmin na nejdelší viditelné čáře, LEGEND_WIDTH) · src/ui/map-lines-legend-ui.ts mapLinesLegendHtml (eighthsOff < 2 známé osminy, řádky, neznámý, kmen, pata), mapLinesImplexText, toggleMapLineFocus, setMapLineHover, setMapLineMode (připnutí pryč), setMapLineColors, setMapLegendCollapsed, openMapLinesSheet / closeMapLinesSheets, mapLinesUndatedHtml, offTimeline (count 0: is-unknown, is-off-timeline, swatch is-empty, app caea192a) · strings.ts map.linesOffTimeline, map.linesTitle, linesChip, linesQuarters, linesEighths, linesCollapse, linesRow, linesUnknown, linesTrunk, linesOff, linesImplex, pathUndated, pathUndatedList, pathUndatedTitle, lineE8–lineE15; fan.lineFatherFather… · app 388e5a87, b01693bc, 5853882e, 8e27df4a, 34e82d43 (app:81f2adf0) · spec 054 K1.1, K1.2 · CHANGELOG.cs.md 3.28.0 -->

<a id="A6.5.6"></a>
### A6.5.6 Den Weg zu einer Person abspielen

Mit gewählter Person geht **Abspielen** die ganze Leiste in 24 Sekunden durch, vom ältesten Vorfahren bis zur
gewählten Person.

- **Grenzen:**
  - Jahr für Jahr, keines wird übersprungen. Ein Jahr, in dem ein Vorfahr oder das Ziel hinzukam, dauert fünfmal so
    lange wie ein Jahr ohne sie;
  - das Abspielen endet beim Ziel. Ein weiteres **Abspielen** beginnt von vorn;
  - angehalten wird es durch **Pause**, den Schieberegler, die Tasten ([A6.5.3](#A6.5.3)) und eine Marke über dem
    Schieberegler;
  - Marken über dem Schieberegler: jedes bekannte Viertel im Jahr seines ältesten Vorfahren auf der Karte, in der
    Farbe der Stammlinie („Nachname: ältester Vorfahr Jahr“), und das Ziel am Ende. Ein Klick auf eine Marke springt
    zu ihrem Jahr;
  - die Zeile unter dem Schieberegler sagt, was zuletzt hinzukam: „Jahr · Name · Ort des Elternteils → Ort“ mit einem
    Farbfeld der Stammlinie, das Ziel fett. Kamen in einem Jahr mehrere Personen hinzu, zeigt sie das Ziel, sonst die
    Person aus der nächsten Generation. Ein Bildschirmleser liest die Zeile bei einer Änderung vor. Ohne gewählte
    Person gibt es die Zeile nicht, und der Satz über Orte ohne Datum bleibt in der Statusleiste;
  - die Karte bewegt sich beim Abspielen nicht. Nur wenn sie seit der Wahl der Person niemand verschoben oder
    vergrößert hat und das Ziel am Ende außer Sicht ist, verschiebt sie sich einmal zu ihm;
  - auf dem Telefon ist **▶** ohne Text und die Leiste in einer Reihe.
- **Bedienung:** App: Karte → **◷ Zeitverlauf** → Weg zu einer Person ([A6.5.4](#A6.5.4)) → **Abspielen**.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:src/map-lines.ts pathPlaySchedule (PATH_PLAY_MS 24000, PATH_EVENT_WEIGHT 5, krok rok, součet 24 000), pathAddedIn (nejbližší generace, pak rel, cíl poslední), pathLastAdded · src/ui/map-path-ui.ts playMapPath (konec u cíle), panMapToPathEnd (framed, jednou), renderMapTimeMarks (čtvrtiny podle firstYear, cíl), renderMapTimeCaption (cíl, jinak items[0]; aria-live, aria-valuetext; bez cesty skryto) · src/ui/map-ui.ts toggleMapTimePlay (na konci od začátku), setMapTimeYear (pozastaví), značky → setMapTimeYear · strings.ts map.timeMarkTitle, pathGoalEnd · app cce82a89, 34e82d43 (app:81f2adf0) · ZADANI_UIX_mapa-rody-v-case D5 (ponechat) · spec 054 K2.2 · CHANGELOG.cs.md 3.28.0 -->

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

<a id="A6.7"></a>
## A6.7 Tabelle

Die Tabelle zeigt den ganzen Stammbaum in Zeilen: jede Person, jede Verbindung, jedes Ereignis oder jede Quelle, mit
den Angaben in Spalten. Sie dient dazu, Lücken, Widersprüche und Befunde der Prüfung quer durch den Stammbaum zu
finden. Sie hängt nicht von der Tiefe **Vorfahren** und **Nachkommen** ab. Die Ansicht Tabelle beruht auf einer
Tabelle von Ondřej Chrpa.

- **Zeilen:** Umschalter **Zeilen**: **Personen** · **Verbindungen** · **Ereignisse** · **Quellen**. Jede Zeilenart
  hat eigene Spalten, Filter und Sortierung.
  - **Personen:** eine Zeile je Person des Stammbaums; Platzhalterpersonen (leerer Platz für einen unbekannten
    Elternteil) werden ausgelassen.
  - **Verbindungen:** eine Zeile je Verbindung, die mindestens einen echten Partner hat. **Partner 1** ist der aus
    dem Paar, der mit der Hauptperson blutsverwandt ist; sonst der erste Partner der Verbindung.
  - **Ereignisse:** eine Zeile je Ereignis des Stammbaums ([A6.7.10](#A6.7.10)).
  - **Quellen:** eine Zeile je Quelle des Stammbaums ([A6.7.11](#A6.7.11)).
- Die **Hauptperson** ist die zentrale Person des Stammbaums ([A6.1](#A6.1)). Nach ihr werden die Spalte **Beziehung
  zur Hauptperson** und der Chip **Blutsverwandte** berechnet: die Vorfahren der Hauptperson (auch sie selbst) und
  alle ihre Nachkommen. Partner, die durch Heirat in die Familie kamen, gehören nicht dazu.
- **Generation** 1 ist die älteste Generation des Stammbaums; ein Partner hat die Generation seines Partners.
- **Lebend** (Spalte, Wert „lebend“) wird wie beim Schutz lebender Personen berechnet
  ([A7.1](A7-book-pages-and-export.md#A7.1)).
- Über der Tabelle stehen die Anzahl („42 von 120 Personen“) und die Sortierung („Sortierung: …“). Das Feld **Person
  suchen...** in der Leiste wählt in der Tabelle die Zeile der Person aus und rollt zu ihr; die zentrale Person ändert
  sich nicht.
- **Die zentrale Person zwischen den Ansichten:** nach dem Wechsel in die Tabelle ist die Zeile der zentralen Person
  die aktive Zeile, und die Tabelle rollt zu ihr (eine ausgewählte Zeile, die sie betrifft, bleibt; lassen Filter oder
  Suche die Person aus, gibt es keine aktive Zeile). Nach dem Wechsel aus der Tabelle ist die zentrale Person die
  Person der aktiven Zeile: bei einer Verbindung der Partner, der schon zentrale Person ist, sonst **Partner 1**; bei
  einem Ereignis die zentrale Person, wenn sie unter seinen Personen ist, sonst die erste Person; eine Zeile einer
  Quelle ändert die zentrale Person nicht.
- **Grenzen:**
  - die Hervorhebung einer Stammlinie ([A6.6](#A6.6)) wird in der Tabelle nicht verwendet; einen Stamm wählt der
    Chip **Stamm** ([A6.7.6](#A6.7.6));
  - Spalten, Chips und Ansichten der Forschung gibt es nur in einem Stammbaum aus der Forschung
    ([A6.7.14](#A6.7.14));
  - einen schreibgeschützten Stammbaum (verfolgter Stammbaum, von einer neueren Version der App gespeicherter
    Stammbaum, gesperrter Stammbaum) zeigt die Tabelle nur an: „Nur lesen: Bearbeiten und „Kein Fehler“ gibt es hier
    nicht.“ Ansehen, Filter, Sortierung und CSV- und XLSX-Export funktionieren; eine Ansicht lässt sich weder
    speichern noch umbenennen noch löschen;
  - die Pfeile **↩ ↪** unten links (die vorige und die nächste zentrale Person) und Alt+← / Alt+→ gibt es in der
    Tabelle nicht: die Tabelle zeigt die zentrale Person nicht und ändert sie bei der Arbeit nicht.
- **Bedienung:** in der Leiste der Ansichten **Tabelle** (nach **Karte**); auf Telefon, Tablet und im Fenster bis
  1024 px **Tabelle** in der unteren Leiste ([A9.5](A9-using-the-app.md#A9.5); bis App 3.27.0 **Mehr → Ansicht → Tabelle**). Die Ansicht wird wie die anderen gespeichert ([A6.1.1](#A6.1.1)).
- **Gilt seit:** App 3.27.0

<!-- zdroj: app:src/ui/table-view/table-model.ts ROW_TYPES, buildTableModel (isPlaceholder ven, svazek aspoň s jedním skutečným partnerem), bloodOf (předci hlavní osoby a všichni jejich potomci), makeContext (homeId, isLivingPerson) · table-columns.ts unionPartners (pokrevní partner jako Partner 1), gen (assignGenerations + 1), kin (findRelationship, kinSelf) · src/ui/table-view/table-ui.ts tableReadOnly (isReadOnly: viewMode, isLocked, isNewerData) · src/data.ts:655 isReadOnly · src/ui/bottom-sheet.ts:443 (do 3.27.0 Více → Pohled: Vějíř, Mapa, Tabulka; od 3.28.0 app:4b1373a7 index.html bb-view-table, commit bb5e4d12) · table-bar.ts countText, sortText · perf-budget test 5 000 osob · strings.ts viewModeSwitch.table, table.rows, rowType, rowTypeNote, countOf, sortedBy, readOnly, readOnlyShort · commity c34c47ff, 1b72e6d8 · spec 073 U2 · Události a Prameny (spec 073 U3 P2, K5.1–K5.4): commity 8de751c2, 63ed9def, 1a3a49f1, 3cf69ffa, strings.ts table.rows.events, rows.sources, perf-budget 5 000 osob (Události) a 2 000 pramenů · poděkování: Milan 10. 11. (dirigent:prace/1110-doc-tabulka, bod 4) · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1110-app-tabulka-p1 · Žijící: strings.ts table.col.living, table.living (commit 7e648e24) · ústřední osoba mezi pohledy: commit 75de3a9b (T54 F1) · ↩ ↪ a Alt+šipky v Tabulce skryté: commity 79764eba, b1cbe546 (T54 G14) -->

<a id="A6.7.1"></a>
### A6.7.1 Verbindungen in der Personentabelle

Eine Person mit zwei und mehr Verbindungen hat in der Personentabelle eine eigene Zeile und darunter eine Unterzeile
für jede Verbindung („Verbindung 2 von 3“). Die Zeile der Person hat in der Spalte **Partner** die Anzahl
(„3 Verbindungen“) und die übrigen Spalten der Verbindung leer.

- Die Verbindungen folgen in der Reihenfolge der Hochzeiten wie im Stammbaum ([A6.4](#A6.4)): **Verbindung 1** ist
  die, die auf der Karte die Marke „1. ∞“ hat. Eine Verbindung ohne Datum der Hochzeit wird nach dem spätesten
  möglichen Datum der Hochzeit geordnet (dem früheren aus der Scheidung und der Geburt des ersten Kindes); eine
  Verbindung ohne diese Daten kommt nach den anderen. Bei Gleichstand entscheidet die Reihenfolge der Verbindungen der
  Person in den Daten. Eine leere Platzhalterfamilie („?“) kommt ans Ende in der Reihenfolge der Erfassung.
- **Zugeklappt:** die Zeile der Person zeigt die erste Verbindung und die Zahl der übrigen. Standard ist
  aufgeklappt; die vorgegebene Ansicht **Lücken** hat die Verbindungen zugeklappt.
- **Ein Filter in einer Spalte der Verbindung** wird bei jeder Verbindung einzeln beurteilt. Die Person bleibt, wenn
  mindestens eine Verbindung passt; die übrigen verschwinden unter der Zeile „2 Verbindungen außerhalb des Filters · zeigen“.
  Gezeigte sind bis zur nächsten Änderung des Filters abgeschwächt.
- **Die Sortierung nach einer Spalte der Verbindung** nimmt die erste Verbindung, die dem Filter entspricht.
- Eine Person mit einer Verbindung hat deren Angaben direkt in ihrer Zeile.
- Eine Unterzeile einer Verbindung trägt nur die Befunde ihrer Verbindung. Die Befunde der Person (etwa das Alter der
  Mutter bei der Geburt) und die Streifen eingeklappter Gruppen bleiben in der Zeile der Person.
- **Bedienung:** **Verbindungen aufklappen** / **Verbindungen zuklappen** (auf dem Telefon im Menü **⋯**); die
  Tasten → und ← in der Spalte **Vollständiger Name**, * für alle Personen; das Zeilenmenü. Der Zustand wird mit der Ansicht
  gespeichert ([A6.7.7](#A6.7.7)).

<!-- zdroj: app:src/ui/table-view/table-subrows.ts defaultUnionCollapse (collapsed: false), isExpanded, setAllExpanded, passingUnions, personPassesUnions, sortUnionOf, buildLines · table-model.ts unionsInMarriageOrder (marriagesInOrder z src/marriage-order.ts: Svazek 1 = „1. ∞“; bez data sňatku podle rozvodu nebo prvního dítěte; shoda podle seznamu partnerships osoby; zástupné rodiny „?“ za nimi v pořadí dat; commit 2e0346f9, T13) · table-views.ts BUILTIN_VIEWS gaps (unions collapsed) · strings.ts table.unionsN, unionKofN, hiddenUnions, expandAll, collapseAll · commity 8833da14, 8192621d · nálezy podřádku: commit 75de3a9b (T54 F6) -->

<a id="A6.7.2"></a>
### A6.7.2 Spalten

Die Spalten stehen in Gruppen. Welche sichtbar sind und in welcher Reihenfolge, ist Teil der Ansicht
([A6.7.7](#A6.7.7)).

| Zeilen | Gruppen der Spalten |
|---|---|
| **Personen** | **Person** · **Geburt und Taufe** · **Eltern** · **Verbindungen** · **Scheidung** · **Tod und Begräbnis** · **Ereignisse** · **Quellen** · **Verlässlichkeit und Forschung** · **Prüfungen** |
| **Verbindungen** | **Paar** · **Heirat** · **Scheidung** · **Kinder und Quellen** |

- **Vollständiger Name** (bei Verbindungen **Partner 1**) ist immer links fixiert; lösen oder ausblenden lässt er
  sich nicht. Er wird nach dem Nachnamen, dann nach dem Vornamen sortiert. Er setzt sich aus den Teilen des Namens zusammen, deshalb gibt es eine eigene Spalte
  **Vorname** (standardmäßig ausgeblendet), die sich in der Zelle bearbeiten lässt ([A6.7.15](#A6.7.15)). **Nachname** ist der Ehename, sonst der Geburtsname; **Geburtsname** ist der erfasste Nachname.
- **Forschungs-ID** zeigt nur die Nummer der Person aus der Forschung (P…). **Ref.-Nummer** ist die
  Referenznummer der Person (REFN), wie sie die GEDCOM-Datei gebracht hat (und wie sie in eine zurückgeht); sie wird als Text
  sortiert und gefiltert.
- **Offene Frage**, **⇄ In anderem Baum** (die Stammbäume auf diesem Gerät, in denen die Person ist) und **Status der
  Person** (das Zeichen der Belegung und Verlässlichkeit von der Karte, in Worten; von der stärksten an sortiert; ab App 3.27.0 nach der Zuverlässigkeit
  der Zitationen, [S7.2](S7-reliability-and-verification.md#S7.2)) gibt
  es in jedem Stammbaum. Die Gruppe **Forschung** gibt es nur in einem Stammbaum aus der Forschung
  ([A6.7.14](#A6.7.14)).
- **Ereignisse** (**Beruf**, **Wohnort**, **Konfession**, **Militärdienst**, **Auswanderung**, **Bildung**) zeigen
  jeden Wert einmal, den neuesten zuerst.
- Die Spalten **Verlässlichkeit …** und **Sicherheit aus der Forschung** haben nur in einem Stammbaum aus der
  Forschung einen Wert ([S7](S7-reliability-and-verification.md)).
- Die Spalten **Vorname**, **Ref.-Nummer**, **Offene Frage**, **⇄ In anderem Baum** und **Status der Person** sind
  standardmäßig ausgeblendet.
- **Grenzen:** eine eingeklappte Gruppe ist ein schmaler Streifen; er zeigt die höchste Stufe eines Befunds in seinen
  Zellen. Auf dem Telefon ist der fixierte Name schmaler, und die Kopfzeile lässt sich nur lesen, nicht ändern.
- **Bedienung:**
  - Panel **Spalten** („12 von 58“): **Spalte suchen**, Gruppen mit dem Kästchen **alle**, Ziehen der Reihenfolge,
    **Abdeckungszeile**, **Standard wiederherstellen**, **Fertig**;
  - Menü im Spaltenkopf: **Aufsteigend sortieren**, **Absteigend sortieren**, **Zur Sortierung hinzufügen**
    (Umschalt + Klick), **Filter…**, **Links fixieren** / **Lösen**, **Nach links** / **Nach rechts**, **Spalte
    ausblenden**, **Gruppe … einklappen** / **Gruppe … ausklappen**; bei einer berechneten Spalte „Berechnet aus: …“;
  - Breite der Spalte durch Ziehen am Rand des Spaltenkopfs.
- **Reihenfolge der Spalten:**
  - im fixierten Teil lässt sich jede fixierte Spalte an jede Stelle unter den fixierten verschieben, auch
    **Vollständiger Name** (er muss nicht der erste sein);
  - außerhalb des fixierten Teils verschiebt sich eine Spalte nur innerhalb ihrer Gruppe;
  - eine Verschiebung, die nicht geht, wird nicht angeboten: Im Menü des Spaltenkopfs fehlt **Nach links** oder
    **Nach rechts**, im Panel **Spalten** der Pfeil ↑ oder ↓.
- **Ab App 3.28.0:** fixierte Spalten in beliebiger Reihenfolge. Bis 3.27.0 war **Vollständiger Name** immer der
  erste und ließ sich nicht verschieben, fixierte Spalten verschoben sich nur innerhalb ihrer Gruppe, und eine
  Verschiebung, die nicht ging, war ausgegraut.

<!-- zdroj: app:4b1373a7 src/ui/table-view/table-state.ts normalizeColumns (zamčený sloupec ukotvený, kdekoli v ukotvené části), columnRun (ukotvená část: [0, pinned − 1]; mimo ni skupina), canMoveColumn, moveColumnBy · table-headmenu.ts headMenuItems (moveLeft/moveRight jen canMove; Skrýt ne u zamčeného; Uvolnit ne u zamčeného) · table-colpanel.ts (šipka jen pro možný posun) · commit 19dbb595 (dřív columnRun locked = 1, disabled/aria-disabled) · dirigent:spec/082-tester-3.28 K2.1 -->
<!-- zdroj: app:src/ui/table-view/table-columns.ts PERSON_GROUPS, UNION_GROUPS, katalog sloupců (surname marriedSurname || lastName, birthSurname lastName, researchId /^P\d{1,7}$/, eventValues nejnovější první, sortKey jména), pinnedWidth 156 na telefonu · table-state.ts MIN_COLUMN_WIDTH, BAND_WIDTH, lockedColumn · table-checks.ts bandSeverity · table-colpanel.ts panelGroups · table-headmenu.ts headMenuItems · strings.ts table.group.*, col.*, columns, columnsCount, searchColumn, all, pinnedLabel, resetColumns, done, coverageRow, sortAsc, sortDesc, sortAdd, sortAddHint, filterColumn, pin, unpin, moveLeft, moveRight, hide, collapseGroup, expandGroup, computedFrom · commity 89602f35, 49b96d92, e4a35406 · refn (skupina person, textCell p.refn; commit 7e648e24, T54 F3), question, crossTree (crossTreeCell), personStatus (personStatusCell, cardStatus, CARD_STATUS_CLASSES), strings.ts table.col.refn, question, crossTree, personStatus · „Celé jméno“ (id `name`) a sloupec firstName, záhlaví „Ref. číslo“ bez „(REFN)“: commity 79764eba, 8fdf52ca (T54 G10, G3) -->

<a id="A6.7.3"></a>
### A6.7.3 Berechnete und Ersatzwerte

Was im Stammbaum nicht erfasst ist, sich aber aus den Daten berechnen lässt, berechnet die Tabelle. Dabei schreibt
sie nichts in den Stammbaum.

| Wert | Wie er berechnet wird |
|---|---|
| Alter (bei der Geburt eines Kindes, bei der Heirat, beim Tod) | aus Daten mit Tag genau („67“); aus Jahr, Monat oder Zeitraum als Bereich („28–29“); aus einem Datum mit um, vor oder nach als Schätzung („≈ 67“) |
| Ersatzdatum und -ort | ohne Geburt die Taufe („get. 3.5.1850“), ohne Tod das Begräbnis („begr. …“); ein Alter daraus ist eine Schätzung (≈) |
| **Abweichung angegebenes Alter** | um wie viele Jahre das angegebene Alter außerhalb des Bereichs des Alters aus den Daten liegt („+3“, „−2“); ein Alter in Worten und ein Alter mit um, vor, nach wird nicht verglichen |
| **Dauer der Verbindung** | von der Heirat bis zur Scheidung, sonst bis zum ersten Tod aus dem Paar |
| **Geburtsrang**, **Zahl der Geschwister**, **Zahl der Kinder**, **Zahl der Verbindungen**, **Zahl der Quellen** | aus den Beziehungen und Quellen des Stammbaums |

- Daten haben das Wort der Genauigkeit vor sich (**um**, **vor**, **nach**). Ein unsicheres Datum ist gepunktet
  unterstrichen; ein Befund ist es nicht. Ein Datum wird nach seinem Anfang sortiert.
- **Grenzen:** ein Alter wird nicht berechnet, wenn das Ende vor dem Anfang liegt. Die Spalten des Todes haben bei
  einer lebenden Person **Trifft nicht zu** (bei **Vollständigkeit Sterbefall** „lebt“). **Alter des Vaters/der
  Mutter bei der Geburt** ohne erfassten Elternteil ist **Trifft nicht zu**.
- **Bedienung:** Hinweis an der Zelle („Taufe, Geburt unbekannt“, „Begräbnis, Tod unbekannt“); bei einer berechneten
  Spalte im Menü des Spaltenkopfs „Berechnet aus: …“; die Legende **Zeichen** ([A6.7.13](#A6.7.13)).

<!-- zdroj: app:src/ui/table-view/table-columns.ts ageCell (přesně / rozsah ageRangeBetween / ≈ approxAgeBetween; nic, když konec před začátkem), dateCell, qualifierWord, birthOrBaptism, deathOrBurial (náhrada, ≈), gapCell (recordedAgeGap), unionLength, naCell, parentsOf · src/dates.ts:448 ageRangeBetween, recordedAgeGap · table-model.ts dateNumber (začátek rozsahu) · strings.ts table.na, living, subst.*, qual.*, computedFrom, from.* · commit 8833da14 -->

<a id="A6.7.4"></a>
### A6.7.4 Vollständigkeit und Abdeckungszeile

Die Spalten **Vollständigkeit …** sagen, wie viele der beobachteten Felder ausgefüllt sind, in Prozent.

| Spalte | Gezählt aus |
|---|---|
| **Vollständigkeit Geburt** | Datum, Ort, Vater, Mutter, Quelle |
| **Vollständigkeit Verbindung** | Datum, Ort, Partner, Quelle zur Heirat; bei einer Verbindung ohne Heirat (**Partner**, **Getrennt**) nur der Partner |
| **Vollständigkeit Sterbefall** | Datum, Ort, Quelle (nicht bei einer lebenden Person) |
| **Vollständigkeit gesamt** | Geburt, jede Verbindung und Tod, gewichtet nach der Zahl der Felder |

- Ein Ersatzwert (Taufe, Begräbnis) füllt kein Feld aus. Der Hinweis an der Zelle nennt, was fehlt („fehlt:
  Geburtsort, Quelle zur Geburt“).
- Die **Abdeckungszeile** unter dem Spaltenkopf zeigt bei jeder Spalte, wie viel Prozent der Zeilen einen Wert haben
  („ausgefüllt 64 %“, Hinweis „77 von 120“). Das Wort „ausgefüllt“ steht in der ersten Spalte, welche es auch ist (ab App 3.28.0;
  vorher in der Spalte des Namens), auch im XLSX-Export. Bei den Spalten **Vollständigkeit …** zeigt sie die durchschnittliche
  Vollständigkeit der Zeilen (Hinweis „Durchschnitt von 120“). Sie zählt nur die Zeilen, die gerade zu sehen sind (nach Filter und
  Suche). Zellen **Trifft nicht zu** werden nicht gezählt; bei Spalten der Verbindung werden die Verbindungen
  gezählt, die dem Filter entsprechen. Unter 50 % ist die Zahl fett; ohne eine Zelle, die sie betreffen würde, steht
  „–“.
- **Verbindung ohne Heirat** (Art **Partner** oder **Getrennt**): die leeren Zellen der Heirat (Datum, Ort, Alter und
  eingetragenes Alter beider, Abweichung des eingetragenen Alters, Trauzeugen, **Verlässlichkeit Heirat**) haben „–“
  mit dem Hinweis „Trifft nicht zu: Verbindung ohne Heirat“ und zählen weder in der Abdeckungszeile noch in der
  Vollständigkeit. Ein Wert, der dort trotzdem steht (der Beginn der Beziehung aus dem Formular der Verbindung), wird
  wie bisher gezeigt.
- **Bedienung:** **Abdeckungszeile** im Panel **Spalten** (auf dem Telefon in **⋯**); sie wird mit der Ansicht
  gespeichert.

<!-- zdroj: app:src/ui/table-view/table-columns.ts compCell, unionComp (pole a váhy, náhrada nevyplní) · table-coverage.ts cellFilled, columnCoverage, coverageCell, coverageLabel (LOW pod 50 %) · table-subrows.ts coverageUnionsOf · strings.ts table.compList.*, compField.*, missing, missingNone, compCounts, coverage, coverageOf · rozhodnutí Milan 10. 11. (spec 073, bod 5) · commit 8833da14 · průměr u sloupců úplnosti (kind percent): table-coverage.ts columnCoverage average, strings.ts table.coverageAverage, i XLSX, commit 56f3418c (T54 G12) · „vyplněno“ v prvním sloupci: app:4b1373a7 table-ui.ts coverageOf (firstId), table-xlsx.ts labelAt, commit 19dbb595 · svazek bez sňatku: table-columns.ts unionWithoutWedding (partners, separated), weddingCell, oneUnionFields (jen partner), strings.ts table.naNoWedding, compList.unionNoWedding, commit 8fdf52ca (T54 G5, MILAN.md rozhodnutí 21) -->

<a id="A6.7.5"></a>
### A6.7.5 Befunde der Prüfung in den Zellen

Die Tabelle zeigt die Befunde der Datenqualität ([A5](A5-tree-check.md)) direkt bei der Angabe, die sie betreffen:
die Zelle ist hinterlegt und hat ein Zeichen der Stufe. Die Prüfung läuft über den ganzen Stammbaum im Hintergrund,
wenn die App frei ist.

| Stufe | Zeichen in der Legende |
|---|---|
| **Fehler** | „Die Angaben widersprechen sich.“ |
| **zu prüfen** | „Ein ungewöhnlicher Wert, der geprüft werden sollte.“ |
| **Spur** | „Eine Spur für die Forschung, kein Fehler.“ |
| **ungewöhnlich** (☆) | „Ein als „Kein Fehler“ markierter Befund.“ |

- Ein Befund kommt in die Zelle seiner Angabe: das Alter eines Elternteils bei der Geburt in **Alter des Vaters/der
  Mutter bei der Geburt** beim Kind, ein Befund zur Heirat in das Alter und das Datum der Heirat, ein angegebenes
  Alter in das angegebene Alter und seine Abweichung, ein Tod vor der Geburt in beide Daten und das Alter, ein
  Ereignis in die Spalte des Ereignisses, der Altersunterschied der Partner in den Partner, eine mögliche doppelte
  Person in den Namen, die Schreibung eines Ortes in die Zellen mit diesem Ort. Ein Befund ohne eigene Zelle steht
  nur in den Spalten der Prüfungen.
- Spalten der Gruppe **Prüfungen**: **Befunde** (Anzahl; „…“, solange die Prüfung läuft), **Höchste Stufe**,
  **Ungewöhnlich, geprüft** (Zahl der als **Kein Fehler** markierten Befunde).
- Ein als **Kein Fehler** markierter Befund ([A5.7](A5-tree-check.md#A5.7)) bleibt in der Zelle als **ungewöhnlich**
  („Ungewöhnlich, aber geprüft“) und zählt nicht zu den Befunden.
- **Grenzen:** ein schreibgeschützter Stammbaum lässt keinen Befund markieren („Der Baum ist schreibgeschützt:
  Befunde lassen sich nicht markieren.“).
- **Bedienung:** ein Klick auf das Zeichen öffnet eine Blase (auf dem Telefon ein Panel von unten): Stufe, Text des
  Befunds, „Befund 1 von 2“ und
  - **Kein Fehler** (Meldung „Markiert: kein Fehler“ mit **Rückgängig**); bei einem ungewöhnlichen **Wieder
    melden**;
  - **Datenqualität ›** öffnet den Dialog der Datenqualität bei der Gruppe dieses Befunds; bei einem ungewöhnlichen
    bei der Liste der markierten.

  Die Zellen **Befunde** und **Höchste Stufe** öffnen die Liste aller Befunde der Person (Klick, Enter, Tippen; auf
  dem Telefon ein Panel von unten): bei jedem die Stufe, der Text und wen oder was er betrifft; gemeldete nach der
  Stufe, die als **Kein Fehler** markierten am Ende.

  Die Legende **Zeichen** („Zeichen in den Zellen“) erklärt auch das unsichere Datum, die Verlässlichkeit, den
  Ersatzwert, den berechneten Wert und **Trifft nicht zu**. Wie welches Zeichen aussieht: [A6.7.13](#A6.7.13).

<!-- zdroj: app:src/ui/table-view/table-checks.ts severityRank, parentAgeColumn, issueTargets (mapování nálezů na buňky), buildCheckIndex, CHECK_COLUMNS, applyChecks · table-ui.ts whenIdle (validateTreeData jednou), cellFindings · table-bubble.ts bubbleHeading, bubbleHtml, legendHtml, openBubblePanel, sheetElement · src/ui/tree-stats.ts showTreeValidationDialog (focus: skupina otevřená a posunutá; označené → seznam) · strings.ts table.sev.*, unusualChecked, notError, reReport, toQuality, dismissedToast, roNote, checksRunning, findingOf, legend, legendTitle, legendKind.*, legendText.* · commity 19cf28ea, e530019b, 59a8eed0 · seznam nálezů osoby z buněk Nálezy a Nejvyšší úroveň: commit 75de3a9b (T54 F5) -->

<a id="A6.7.6"></a>
### A6.7.6 Filter, Suche und Sortierung

Der Filter wählt die Zeilen aus, die Suche engt sie weiter ein, die Sortierung bestimmt die Reihenfolge.

- **Chips** der Personentabelle (Verbindungen haben keine Chips, Ereignisse und Quellen eigene, [A6.7.10](#A6.7.10),
  [A6.7.11](#A6.7.11)): **Lebend**, **Verstorben** (schließen sich aus), **Blutsverwandte**, **Stamm**
  (Wahl der Stämme), **Generation** (Bereich), **Mehrere Verbindungen**, **Ohne Geburtsdatum**, **Unsicheres Datum**
  (Geburt oder Tod), **Ohne Quelle**, **Mit Befund** (Fehler oder zu prüfen; Spur nicht), **Ungewöhnlich**,
  **Unbestätigt (Forschung)** (nur Stammbaum aus der Forschung). Die Chips der Befunde warten auf die Prüfung
  („Sobald die Prüfungen fertig sind“). Was nicht hineinpasst, steht unter **Weitere (n)**.
- **Filter in der Spalte** (**Filter…** im Spaltenkopf) nach der Art der Spalte:
  - Werte aus einer Liste (Geschlecht, Stand der Verbindung, Stufe des Befunds, Stamm …);
  - Bereich **von**–**bis** (beim Datum **Jahr**, bei Alter, Anzahl und Prozent eine Zahl);
  - Text: **enthält** · **beginnt mit** · **ist** · **ist nicht** (ohne Rücksicht auf Groß- und Kleinschreibung und
    diakritische Zeichen; Chip „Spalte = Wert ×“ oder „Spalte ≠ Wert ×“; schnell aus dem Zellenmenü,
    [A6.7.15](#A6.7.15));
  - bei jeder **Nur leere** · **Nur ausgefüllte**.
- Es gelten alle Filter zugleich. Die Zahl der Filter steht auf **Filter (n)**, alles hebt **Filter aufheben** auf.
  Ohne Zeile: „Nichts entspricht dem Filter“.
- **In Tabelle suchen:** ab 2 Zeichen, ohne Rücksicht auf Groß- und Kleinschreibung und diakritische Zeichen, in den
  sichtbaren Spalten und auch in den Unterzeilen der Verbindungen; Treffer sind hervorgehoben, über der Tabelle
  steht ihre Zahl.
- **Sortierung:** ein Klick auf den Spaltenkopf sortiert aufsteigend, ein weiterer absteigend, der dritte hebt die
  Sortierung auf; sortiert wird nur nach dieser Spalte. Umschalt + Klick fügt die Spalte als weiteren Schlüssel hinzu
  (ein weiterer Klick dreht ihn um, der dritte entfernt ihn). Der Pfeil ↑ ↓ am Spaltenkopf trägt die Nummer der
  Reihenfolge des Schlüssels. Leere Werte stehen immer am Ende, in beiden Richtungen. Zahlen im Text werden als Zahlen
  sortiert.
- **Grenzen:** die Suche wird nicht in der Ansicht gespeichert ([A6.7.7](#A6.7.7)).

<!-- zdroj: app:src/ui/table-view/table-filter.ts CHIP_ORDER, setChip (Žijící × Zemřelí), personPassesChip (finding: chyba nebo k ověření; unusual; unconfirmed jen researchTree, relN/relB/relD), CHECK_CHIPS, rodChoices, generationSpan, filterKindOf, cellPasses, foldText · table-filterbar.ts SEARCH_DELAY_MS, columnFilterForm, chipChoiceForm · table-state.ts řazení (vzestupně → sestupně → vypnuto; Shift přidá, otočí, odebere; prázdné na konci; Intl.Collator numeric) · strings.ts table.chip.*, chipRod, chipGen, moreN, filters, clearFilters, search, matches, noMatch, checksWait, matchContains, matchStarts, rangeFrom, rangeTo, rangeYears, onlyEmpty, onlyFilled · commity dd1d74bc, e64b8b06, fc746037 · je / není: strings.ts table.matchEquals, matchNotEquals (commit 05d9a9ab, T54 F4) -->

<a id="A6.7.7"></a>
### A6.7.7 Tabellenansichten

Eine Ansicht ist eine unter einem Namen gespeicherte Einstellung der Tabelle. Die vorgegebenen Ansichten sind fertige
Lesarten des Stammbaums; eine eigene Ansicht speichert der Mensch.

| Vorgegebene Ansicht | Zeilen | Was sie zeigt |
|---|---|---|
| **Übersicht** (Standard für Personen) | Personen | Name, Datum und Ort der Geburt, Sterbedatum, Sterbealter, Partner, Heiratsdatum und Alter dabei, Befunde, Vollständigkeit gesamt; sortiert nach dem Geburtsdatum |
| **Geburten und Eltern** | Personen | Geburt und Taufe, Eltern, ihr Alter bei der Geburt, Vollständigkeit Geburt; sortiert nach dem Geburtsdatum |
| **Heiraten** (Standard für Verbindungen) | Verbindungen | Paar, Datum und Ort der Heirat, Alter und angegebenes Alter beider, Stand, Trauzeugen, Scheidung, Kinder, Dauer, Quellen, Vollständigkeit; sortiert nach dem Heiratsdatum |
| **Sterbefälle** | Personen | Tod, Ursache, Begräbnis, Alter und angegebenes Alter beim Tod, Vollständigkeit Sterbefall; Chip **Verstorben**; sortiert nach dem Sterbedatum |
| **Quellen und Zitate** | Personen | Zahl der Quellen, Belegung, Verlässlichkeit von Geburt und Tod; von den wenigsten Quellen an |
| **Lücken** | Personen | Vollständigkeit gesamt und nach Teilen, Geburt, Eltern, Quellen; von den am wenigsten vollständigen an; Verbindungen zugeklappt |
| **Prüfungen** | Personen | Stufe und Zahl der Befunde, Daten, Alter der Eltern, Heirat; Chip **Mit Befund**; von der höchsten Stufe an, dann nach der Zahl der Befunde |
| **Alle Ereignisse** (Standard für Ereignisse) | Ereignisse | Art, Person oder Paar, Datum, Ort, Alter beim Ereignis, Paten, Trauzeugen, Amtsperson, Quelle; sortiert nach dem Datum |
| **Alle Quellen** (Standard für Quellen) | Quellen | Titel, Archiv, Buch und Signatur, online, Personen, Angaben, von der Forschung gelesen, Abschrift; sortiert nach dem Titel |

- **Die Ansicht speichert:** Zeilenart, Spalten (Reihenfolge, Breiten, Fixierung, eingeklappte Gruppen),
  Abdeckungszeile, Filter, Sortierung und das Aufklappen der Verbindungen. Sie speichert nicht die Suche, die
  ausgewählte Zeile und die Bildlaufposition.
- Eine geänderte Ansicht hat das Etikett **geändert** und die Möglichkeiten **Speichern**, **Als neue speichern**,
  **Änderungen verwerfen**. Eine vorgegebene Ansicht ändert sich nicht und lässt sich weder umbenennen noch löschen;
  ihre Änderungen gehen nur über **Als neue speichern**. Eigene Ansicht: **Umbenennen…**, **Löschen** (mit
  Bestätigung). Eigene Ansichten sind nach dem Namen geordnet.
- Den Arbeitsstand der Tabelle merkt sich die App für jeden Stammbaum auf diesem Gerät; nach dem Neuladen der Seite
  oder einer Aktualisierung der App ist die Tabelle so, wie sie geblieben ist. Dazu gehören die ungespeicherten
  Änderungen jeder Ansicht, auch einer, aus der weggeschaltet wurde: zurück in ihr hat die Ansicht weiter das Etikett
  **geändert**. **Speichern**, **Als neue speichern** und **Änderungen verwerfen** erledigen sie. Ein beschädigter Teil
  des Arbeitsstands wird ausgelassen.
- **Gespeicherte Ansichten sind Teil des Stammbaums** (Datenversion 17): Speichern, Umbenennen und Löschen haben
  einen Schritt zurück und einen Eintrag im Änderungsverlauf. Sie gehen mit dem Stammbaum in die Sicherung (JSON) und
  beim Abtrennen eines Teils des Stammbaums auch in den neuen Stammbaum. GEDCOM trägt sie nicht; ein Stammbaum aus der
  Forschung behält sie beim Laden einer neuen Version. Eine beschädigte Ansicht wird beim Laden ausgelassen.
- **Grenzen:** eine ältere App (ab 3.19.0) öffnet einen von App 3.27.0 gespeicherten Stammbaum schreibgeschützt und
  speichert ihn nie; nach der Aktualisierung der App lässt sich der Stammbaum wieder ändern.
- **Bedienung:** Menü **Ansicht** in der Leiste der Tabelle (**Vorgegeben**, **Eigene**, **Als neue speichern…**,
  **Umbenennen…**, **Löschen**).

<!-- zdroj: app:src/ui/table-view/table-views.ts BUILTIN_VIEWS (9: overview, births, marriages, deaths, sources, gaps, checks, events, allSources), defaultViewId (události → Všechny události, prameny → Všechny prameny), defaultViewId, viewFromState, viewChanged, uniqueViewName, customViews (podle jména), workStorageKey strom.table.{treeId}, readTableWork, writeTableWork · table-columns.ts výchozí sloupce pohledů (:683 Sňatky, DEFAULT_VIEWS.events, .sources) · src/table-views-data.ts sanitizeTableView, keepTableViews (verze z výzkumu ponechá pohledy) · src/data.ts:298 sanitizeTableViews při načtení, :1720 saveTableView, deleteTableView (krok zpět, historie změn) · src/subtree.ts:148 · src/types.ts STROM_DATA_VERSION 17, StromData.tableViews · src/tree-manager.ts:630 isTreeNewer, src/data.ts:649 isNewerData (jen ke čtení, od aplikace 3.19.0) · src/ui/research-ui.ts, conflict-decide-ui.ts keepTableViews · strings.ts table.view, views.*, viewName.* (events, allSources), changed, save, saveAs, discard, builtinNote, saveAsMenu, renameMenu, deleteMenu, builtinLocked, viewWhat, deleteConfirm · commity d19a5942, c2d48747, 8ca649ff · neuložené změny všech pohledů v pracovním stavu (localStorage) se sanitizací: commit b1cbe546 (T54 G9, varianta c) -->

<a id="A6.7.8"></a>
### A6.7.8 Zeilenaktionen und Bearbeitung

Ein Klick wählt eine Zeile aus (auch eine Unterzeile einer Verbindung); die Pfeiltasten, Bild auf/ab und
Strg+Pos1/Ende verschieben die Auswahl, Esc hebt sie auf.

| Aktion | Was sie tut |
|---|---|
| **Im Baum zeigen** | wechselt in die Ansicht Familie mit der Person als zentraler Person, zentriert und hervorgehoben |
| **Person öffnen** (Enter) | öffnet die Seite der Person |
| **Bearbeiten…** (Doppelklick) | öffnet die Bearbeitung der Person; bei einer Unterzeile einer Verbindung und in der Verbindungstabelle die Beziehungen der Person in dieser Verbindung |

- In der Verbindungstabelle betreffen die Aktionen die Person **Partner 1**.
- In der Ereignistabelle betreffen sie die erste Person der Zeile, und **Bearbeiten…** öffnet die Bearbeitung dieses
  Ereignisses ([A6.7.10](#A6.7.10)); in der Quellentabelle gibt es **Quelle öffnen** ([A6.7.11](#A6.7.11)).
- Nach einer Bearbeitung die Meldung „Gespeichert: …“, die Zeile blinkt kurz, und die Zeilen bleiben in ihrer
  Reihenfolge. Eine Zeile, die dem Filter nicht mehr entspricht, bleibt mit dem Etikett „passt nicht mehr“ bis zur
  nächsten Änderung der Sortierung, des Filters oder der Ansicht. Eine Änderung aus der Forschung meldet „Die
  Forschung hat 3 Angaben geändert: …“.
- Eine Angabe lässt sich auch direkt in der Zelle bearbeiten ([A6.7.15](#A6.7.15)).
- **Grenzen:** in einem schreibgeschützten Stammbaum gibt es kein **Bearbeiten…**.
- **Bedienung:** die Schaltflächen ⌖ ▤ ✎ am Ende der Zeile, über keinem Text einer Zelle: mit der Maus erscheinen
  sie, sobald der Zeiger auf der Zeile außerhalb von ihnen war, an der ausgewählten Zeile auch mit dem Zeiger
  anderswo; Zeilenmenü (rechte Maustaste; auch Aufklappen der Verbindungen). Ein Tippen mit dem Finger auf die Zeile
  (Telefon, schmales Fenster, ein vor allem per Touch bedientes Gerät) öffnet ein Panel mit den Aktionen und den
  Verbindungen („Verbindung 1: … · Bearbeiten ›“).
- **Ab App 3.28.0:** ein Klick mit Maus oder Stift wählt auf jedem Gerät nur Zeile und Zelle aus, auch auf einem
  Notebook mit Touchscreen, einem Tablet mit Maus und in einem schmalen Fenster; es entscheidet der Zeiger des
  Klicks, nicht das Gerät. Bis 3.27.0 öffnete auf einem Touch-Gerät und in einem schmalen Fenster jeder Klick das
  Panel der Zeile. Die Aktionen der Zeile stehen an ihrem Ende, sodass die Spalte der Personen auf der ausgewählten
  Zeile ihre ganze Breite behält.

<!-- zdroj: app:src/ui/table-view/table-ui.ts tableMethods (tableRowAction: tree → Rodina, focus, highlight; open; edit → dialog osoby / panel vztahů na svazku), personOfRow (Partner 1), keepWork · table-refresh.ts keepOrder, watchEdit, changedKeys, bridgeChanges, namesList · table-grid.ts FLASH_MS · strings.ts table.act.*, dblClickHint, actionsOf, unionWith, editMore, staleRow, savedToast, bridgeToast · commity da6b9786, de46ae30, e4a35406 · od 3.28.0: table-grid.ts clickPointerType, isMouseLikePointer, table-ui.ts onRowClick (panel jen klepnutí a isPhoneBar | isCoarsePointer), commit ee38c7a6; rowActions ⌖ ▤ ✎ v .tv-acts-dock, armRowActions (myš a pero), commit 80c2ffb9 -->

<a id="A6.7.9"></a>
### A6.7.9 CSV- und XLSX-Export

Der Export speichert die Tabelle, wie sie zu sehen ist, in eine Datei für Tabellenkalkulationen: **CSV** oder
**XLSX** (Excel-Arbeitsmappe).

- **Was hinausgeht:** die sichtbaren Spalten in der Reihenfolge der Tabelle (die Spalten einer eingeklappten Gruppe
  ganz) und die Zeilen nach Filter, Suche und Sortierung. Die Werte sind so, wie die Tabelle sie schreibt: Daten in
  der Schreibweise der App, „um …“, „≈ 67“, „get. …“, „–“.
- **Zeilen:** ohne Filter und Suche gehen alle Zeilen hinaus („Alles Angezeigte · 120 Personen“). Mit Filter oder
  Suche gibt es die Wahl:
  - **Angezeigte** (Standard): nur die Zeilen, die die Tabelle zeigt, mit der Anzahl und einem Hinweis auf den Filter
    („Angezeigte · 28 von 866 Personen (Filter: …)“);
  - **Alle … ohne Filter** („Alle Personen ohne Filter · 866“): alle Zeilen dieser Art in der Reihenfolge der
    Sortierung, ohne Filter und ohne Suche.

  Eine Zeile mit dem Etikett „passt nicht mehr“ ([A6.7.8](#A6.7.8)) gehört nicht zu den angezeigten.
- Eine Person mit zwei und mehr Verbindungen: die erste Verbindung, die dem Filter entspricht, steht in ihrer Zeile,
  jede weitere in einer Folgezeile mit leeren Angaben der Person. Hinter dem Namen steht die Spalte **Verbindung**
  („1 von 3“).
- **CSV:** Text, UTF-8 mit BOM-Kennung, Trennzeichen Semikolon, Zeilenenden CRLF; eine Zelle, die eine
  Tabellenkalkulation als Formel ausführen würde, wird entschärft. Zeichen der Befunde und Farben werden nicht
  exportiert.
- **XLSX:** ein Tabellenblatt, benannt nach der Ansicht.
  - Zeile 1 sind die Gruppen der Spalten (verbundene Zellen), Zeile 2 der Spaltenkopf, Zeile 3 die Abdeckungszeile
    ([A6.7.4](#A6.7.4)). Die fixierten Spalten der Tabelle und diese drei Zeilen sind im Blatt fixiert.
  - Jede Gruppe von Spalten ist eine Gliederung: sie lässt sich zuklappen, ihre erste Spalte bleibt. Die Folgezeilen
    der Verbindungen liegen eine Ebene tiefer unter der Zeile der Person (Ebene 2 der Zeilengliederung).
  - Eine Zelle mit einem Befund **Fehler** oder **zu prüfen** ist hinterlegt und hat die Befunde in einem Kommentar.
    Spur und ungewöhnlich haben weder Farbe noch Kommentar.
  - Anzahlen, Alter in ganzen Jahren und Vollständigkeit sind Zahlen (Vollständigkeit und Abdeckung als Prozent);
    das Übrige ist Text, wie ihn die Tabelle schreibt (auch „≈ 67“, „28–29“, Daten). Text wird nie zu einer Formel.
    Der Link einer Quelle ist in der Zelle ein Link.
- **Datei:** `{Stammbaum}_{Ansicht}_{JJJJ-MM-TT}.csv` oder `.xlsx`, ohne diakritische Zeichen.
- **Bedienung:** **Export ▾** in der Leiste der Tabelle (auf dem Telefon in **⋯**): **Format** „CSV · für Excel und
  Google Tabellen“ oder „XLSX · Gruppen, fixierte Spalten, Prüffarben“, **Zeilen**, **CSV herunterladen** / **XLSX
  herunterladen**; Meldung „Heruntergeladen: …“ mit der Zahl der Personen, Zeilen und Spalten.
- **Grenzen:** der Export aus dem Menü des Stammbaums (**Personentabelle (CSV)**, [A7](A7-book-pages-and-export.md))
  ist eine andere Datei mit festen Spalten.
- **Gilt seit:** App 3.27.0

<!-- zdroj: app:src/ui/table-view/table-export.ts tableCsvField (neutralizace vzorců), buildExportTable, buildTableCsv (BOM, ;, CRLF, pokračovací řádky, sloupec Svazek), fileNamePart, tableCsvFileName (csv | xlsx) · table-xlsx.ts buildTableXlsx (řádky 1–3, merges, outline sloupců za ukotvenou částí, pokračovací řádky outline 1, freeze, errorFill/warningFill + findingsComment jen chyba a k ověření, href), xlsxNumber (COUNT_COLUMNS, věk ^\d+$, procento) · src/xlsx.ts (ignoredErrors numberStoredAsText, styl @ pro text) · table-viewbar.ts exportForm (Formát, Řádky: Zobrazené / Všechny bez filtru jen s filtrem nebo hledáním) · table-ui.ts tableExportNow (unfiltered: všechny řádky typu v řazení, stale ven) · strings.ts table.export, exportFormat, exportRows, exportCsv, exportXlsx, exportAll, exportShown, exportFilterNote, exportUnfiltered.*, exportWhat.*, exportWhatAll.*, exportFile, exportDownload, exportDownloadXlsx, csvUnionCol, csvUnionOf, exportedToast · commity 2368683b, 5a67797b, 4308633b, e0ce4ec2, ebc1542f, e5b97725 · dirigent:prace/1110-app-tabulka-p2, 1110-app-tabulka-opravy -->

<a id="A6.7.10"></a>
### A6.7.10 Ereignisse in Zeilen

Die Ereignistabelle hat eine Zeile für jedes Ereignis des Stammbaums: wer, wann, wo, in welchem Alter und wer dabei
war.

- **Was eine Zeile ist:**
  - jedes Ereignis einer Person (Taufe, Beruf, Wohnort, Militärdienst …) und jedes Ereignis eines Paares;
  - Geburt und Tod aus den Angaben der Person, wenn dazu etwas erfasst ist (Datum, Ort, Adresse, Quelle; beim Tod
    auch die Ursache oder das Alter);
  - die Heirat einer Verbindung: bei einer Ehe immer, bei einer anderen Beziehung („Beginn der Beziehung“) nur mit
    einer erfassten Angabe; die Scheidung („Ende der Beziehung“), wenn die Verbindung geschieden ist oder ihr Ende
    erfasst ist.
- **Ein gemeinsames Ereignis** (Wohnort, Volkszählung, Militärdienst, Auswanderung, Einwanderung, Einbürgerung, eigenes Ereignis),
  das bei mehreren Personen gleich erfasst ist, ist eine Zeile mit allen diesen Personen. Gleich heißt gleiche Art,
  gleiches Datum, gleicher Ort, gleiche Adresse, Notiz und Quellen; das Datum muss erfasst sein und dazu ein Ort oder
  eine Quelle. Taufe, Beruf oder Titel gehören immer nur einer Person.
- **Ab App 3.28.0:**
  - ein gemeinsames Ereignis ([A10.1](A10-shared-events.md#A10.1)) ist eine Zeile mit allen seinen Personen, auch
    wenn seine Kopien abweichen. Gleiche Kopien ohne gemeinsames Ereignis (ältere Daten) werden weiter nach ihren
    Angaben zu einer Zeile verbunden; das ist nur eine Ansicht, eine Bearbeitung geht in eine Kopie;
  - die Zelle der Personen hat eine Anzahl („N Personen“). Das Alter zeigt das Alter jeder Person („42 · 38“) mit
    dem Tooltip „Alter laut Eintrag · je Person“; weichen die Kopien ab, hat die Zelle „weicht bei N ab“
    ([A10.3](A10-shared-events.md#A10.3));
  - eine Bearbeitung von **Datum** oder **Ort** direkt in der Zelle ändert alle Kopien des gemeinsamen Ereignisses
    („{Feld}: bei N Personen geändert ({Ereignis}).“), ein Schritt **Rückgängig**.
- **Spalten** in den Gruppen **Ereignis** · **Beteiligte** · **Quelle**:
  - **Art**, **Person oder Paar** (beim Paar zuerst der Blutsverwandte der Hauptperson), **Datum**, **Ort**;
  - **Alter beim Ereignis** wie anderswo ([A6.7.3](#A6.7.3)); bis zu einem Jahr aus genauen Daten in Tagen
    („12 T.“); bei mehreren Personen das Alter jeder in der Reihenfolge der Namen („–“ unbekannt); bei der Geburt
    **Trifft nicht zu**;
  - **Angabe**: der Wert des Ereignisses (Beruf, Titel), sonst die Ursache; beim Tod die Todesursache;
  - **Paten**, **Trauzeugen**, **Amtsperson**, **Weitere Anwesende**: die Beteiligten nach Rolle; eine Person des
    Stammbaums ist ein Link;
  - **Quelle**: die zitierten Quellen „Titel, Signatur“, mehrere durch Semikolon getrennt; **Verlässlichkeit** der
    Angabe.
- **Chips:** **Geburten und Taufen** (auch Geburten aus den Angaben der Person), **Heiraten** (auch Verlobung,
  Aufgebot, Erlaubnis, Vertrag), **Sterbefälle und Begräbnisse** (auch Einäscherung), **Andere Ereignisse**, **Ohne
  Quelle**.
- **Filter nach Beteiligten:** ein Klick auf den Namen eines Beteiligten bietet „Filter: Pate …“ an (bei einer Person
  des Stammbaums auch **Person öffnen**). Der Filter ist der Chip „Pate: … ×“ (Zeuge, Amtsperson, Anwesend) und
  ersetzt den vorigen Filter nach Beteiligten. Eine Person des Stammbaums wird nach der Person gesucht, ein
  geschriebener Name nach den Buchstaben ohne Rücksicht auf Groß- und Kleinschreibung, diakritische Zeichen und
  Leerzeichen.
- **Ein Pate, der immer wieder auftaucht** ([A5.5](A5-tree-check.md#A5.5)), steht in der Zelle des Beteiligten als
  **Spur**.
- **Bedienung:** die vorgegebene Ansicht **Alle Ereignisse**; die Zeilenaktionen ([A6.7.8](#A6.7.8)) betreffen die
  erste Person der Zeile. **Bearbeiten…** öffnet beim Ereignis einer Person die Bearbeitung der Person bei diesem
  Ereignis (beim gemeinsamen bei der ersten Kopie), bei Geburt und Tod die Bearbeitung der Person, beim Ereignis
  eines Paares dessen Dialog, bei Heirat und Scheidung die Beziehungen der Person in dieser Verbindung.
- **Grenzen:** Platzhalterpersonen haben keine Zeilen; Geburt und Tod ohne erfasste Angabe haben keine Zeile.
- **Gilt seit:** App 3.27.0; 3.28.0: eine Volkszählung bei einer Person ist ein gemeinsames Ereignis, ein
  gemeinsames Ereignis ist eine Zeile

<!-- zdroj: app:src/ui/table-view/table-events.ts buildEventRows (narození/úmrtí jen se zapsaným údajem, weddingRow: manželství vždy kromě marriageUnrecorded, partnersStart jen se zápisem; divorceRow), SHARED_TYPES (od 3.28.0 i census, app:34b2174c), shareKey (typ, vlastní název, datum, místo, adresa, poznámka, prameny; datum a místo nebo pramen), mergeParticipants, eventEditTarget, MARRIAGE_COUPLE_TYPES · table-columns.ts EVENT_COLUMNS, eventPersons (pokrevní první), eventAgeCell, eventAge (dny < 366), eventValueCell, eventSourceCell, eventPill, DEFAULT_VIEWS.events · table-filter.ts EVENT_CHIP_ORDER, EVENT_KIND_CHIPS, lifeCategory, participantChip, eventHasParticipant (foldName), setParticipantFilter · table-ui.ts tableNameAction, tableRowAction (event → editTableEvent) · table-checks.ts PARTICIPANT_ROLE, recurring (recurringGodparent v buňkách účastníků) · 3.28.0: app:80c2ffb9 table-events.ts (shareId → jeden řádek, bez shareId odhad podle shareKey), strings.ts table agePerPerson, sharedDiffers, events.sharedCellChanged · strings.ts table.rows.events, group.event, participants, source, col.ev*, godparents, witnesses, officiants, others, chip.ev*, chipParticipant.*, filterParticipant.*, evKind.*, ageDays, viewName.events · commity 8de751c2, 63ed9def · spec 073 §14.1 · dirigent:prace/1110-app-tabulka-p2 -->

<a id="A6.7.11"></a>
### A6.7.11 Quellen in Zeilen

Die Quellentabelle hat eine Zeile für jede Quelle des Stammbaums (**Aktionen → Quellen**,
[A3.1](A3-evidence-in-the-app.md#A3.1)) und sagt, wie viel die Quelle im Stammbaum belegt.

- **Spalten** in den Gruppen **Quelle** · **Verwendung**:
  - **Titel**, **Archiv**, **Signatur**, **Folio/Seite**, **Bild**, **Weitere Fundstelle**
    ([A3.9](A3-evidence-in-the-app.md#A3.9)), **Online** (die Adresse der Quelle, sonst die Seite ihres ersten
    Auszugs, ohne `https://`; eine Webadresse ist ein Link ↗ in ein neues Fenster, nur http und https; eine ohne
    Schema geschriebene („www.…“) öffnet sich über https; ein Klick auf den Link ändert die Auswahl der Zeile nicht);
  - **Personen**: wie viele Personen eine Angabe haben, die die Quelle zitiert; eine Angabe der Verbindung belegt
    beide Partner;
  - **Angaben**: wie viele Angaben die Quelle zitieren. Eine Angabe ist eine Liste von Zitaten: das Zitat der Person,
    Geburt, Tod, jedes Ereignis der Person, Heirat, Scheidung und jedes Ereignis des Paares;
  - **Von der Forschung gelesen**: wie viele Leser die Abschrift gelesen haben („1 Leser“, „2 Leser“: ein Mensch in
    der App und die Forschung), sonst „nein“;
  - **Abschrift**: ja / nein; im Katalog der Spalten gibt es auch **Datum des Eintrags**.
- Vorgegebene Spalten: **Titel**, **Archiv**, **Signatur**, **Folio/Seite**, **Bild**, **Weitere Fundstelle**,
  **Online**, **Personen**, **Angaben**. **Von der Forschung gelesen** und **Abschrift** gibt es nur im Panel
  **Spalten**.
- Eine ältere Quelle hat die ganze Fundstelle in **Weitere Fundstelle** und die neuen Zellen leer. **Signatur**,
  **Folio/Seite** und **Bild** werden natürlich sortiert (9 vor 10, 57–58 nach 34), leere in beiden Richtungen am
  Ende; gefiltert werden sie als Text.
- Über der Tabelle kann das Angebot **Nach Vorschlag aufteilen…** stehen ([A3.9.1](A3-evidence-in-the-app.md#A3.9.1)).
- Zitate von Platzhalterpersonen und Quellen einer Geschichte werden nicht gezählt.
- **Chips:** **Ohne Person** (keine Person zitiert sie), **Ungelesen**, **Mit Abschrift**, **Online** (wie die Spalte
  **Online**, auch mit einer Adresse ohne `https://`).
- **Bedienung:** die vorgegebene Ansicht **Alle Quellen**. An der Zeile **Quelle öffnen** und **Bearbeiten…**: beide
  öffnen die Quellenverwaltung bei dieser Quelle; **Im Baum zeigen** gibt es hier nicht.
- **Grenzen:** in einem gesperrten Stammbaum wird die Quelle nur angezeigt, ohne Bearbeitung.
- **Gilt seit:** App 3.27.0; **Signatur**, **Folio/Seite**, **Bild** und **Weitere Fundstelle** (früher **Buch,
  Signatur, Folio**) ebenfalls 3.27.0

<!-- zdroj: app:a97de984 table-columns.ts:898-901 srcSig/srcFolio/srcImageNo, :1026 DEFAULT_VIEWS.sources, přirozené řazení · 8dd21adf table-bar.ts nabídka rozdělení · app:src/ui/table-view/table-sources.ts sourceUsage (PERSON_CITATION_FIELDS, události, PARTNERSHIP_CITATION_FIELDS pro oba partnery, bez zástupných, ne příběh), buildSourceRows (katalog data.sources), sourceReaders (readBy user/research/both) · table-columns.ts SOURCE_COLUMNS, urlCell, shortUrl, readersCell, DEFAULT_VIEWS.sources · table-filter.ts SOURCE_CHIP_ORDER (srcNoPerson persons 0, srcUnread, srcTranscript, srcOnline safeHttpUrl) · table-grid.ts rowTail (source: open + edit) · table-ui.ts tableRowAction (source → openTableSource), openTableSourceId (zamčený strom → showSourceViewer readOnly) · strings.ts table.rows.sources, group.source, group.use, col.src*, chip.src*, readers, act.openSource, viewName.allSources, sources.readBy.* · commity 1a3a49f1, 3cf69ffa · spec 073 §14.2 · dirigent:prace/1110-app-tabulka-p2 · odkaz a čip Online: safeWebUrl (http/https, www. → https, rel noopener noreferrer), commit 7e648e24 (T54 F10, F11) -->

<a id="A6.7.12"></a>
### A6.7.12 Quellenangaben und Paten in der Personentabelle

Die Personentabelle hat Spalten, die zeigen, aus welcher Quelle Geburt, Heirat und Tod stammen und wer Pate war.

- **Quellenangaben** (Gruppe **Quellen**): **Geburt: Archiv**, **Geburt: Signatur**, **Geburt: Folio/Seite**,
  **Geburt: Bild**, **Geburt: weitere Fundstelle**, **Geburt: URL** und dasselbe für **Heirat** und **Tod**, in dieser
  Reihenfolge; vorgegeben sind sie nicht. Die Zelle zeigt den Wert der ersten zitierten Quelle; weitere Quellen stehen
  in der Schaltfläche „+N“. Eine ältere Quelle hat die ganze Fundstelle in **… weitere Fundstelle**. Die Blase
  **Weitere Quellenangaben**, das Panel einer Quellenzeile auf dem Telefon und die Spalte der Quelle in der
  Ereignistabelle nennen auch Signatur, Folio und Bild. Eine Webadresse in der Spalte **… URL** ist ein Link in ein neues Fenster,
  wie in der Spalte **Online** ([A6.7.11](#A6.7.11)).
  - Geburt nimmt die Zitate der Geburt, dann der Ereignisse Geburt und Taufe; Tod die Zitate des Todes, dann der
    Ereignisse Tod, Begräbnis und Einäscherung; Heirat die Zitate der Verbindung (bei einer Unterzeile der
    Verbindung die dieser Verbindung). Jede Quelle einmal.
  - Quellen aus der Herkunft einer Angabe in der Forschung werden nicht gezählt, nur Zitate in den Daten.
  - Bei einer lebenden Person haben die Spalten des Todes **Trifft nicht zu**.
  - Sortiert und gefiltert wird nach der ersten Quelle.
- **Ab App 3.27.0:** Spalten für Signatur, Folio/Seite, Bild und weitere Fundstelle (**… Signatur** zeigte früher die
  ganze Fundstelle).
- **Paten** (Gruppe **Geburt und Taufe**): die Paten der Ereignisse Geburt und Taufe, jeder einmal; eine Person des
  Stammbaums ist ein Link. Ein Pate, der immer wieder auftaucht ([A5.5](A5-tree-check.md#A5.5)), hat in der Zelle
  das Zeichen **Spur**.
- **Bedienung:** die Spalten werden einzeln im Panel **Spalten** eingeschaltet ([A6.7.2](#A6.7.2)). Ein Klick auf
  „+N“ öffnet die Blase **Weitere Quellenangaben** (auf dem Telefon ein Panel von unten); ein Klick auf eine Quelle
  öffnet sie in der Quellenverwaltung.
- **Gilt seit:** App 3.27.0

<!-- zdroj: app:src/ui/table-view/table-sources.ts factCitations (narození: birthSourceIds + birth/baptism; úmrtí: deathSourceIds + death/burial/cremation; sňatek: sourceIds svazku; neznámé id ven, každý jednou) · table-columns.ts citeCell (první pramen, moreSources), bArch…dUrl (group sources, unionScoped, deathOnly → naCell), godparentsCell (group birth), personGodparents · table-checks.ts personRecurring (sloupec godparents) · table-grid.ts moreCitesHtml · table-ui.ts showTableCites, openTableSourceId · strings.ts table.col.bArch…dUrl (bUrl „Narození: URL“, commit 7e648e24, T54 F10); 3.27.0: a97de984 bSig/bFolio/bImage/bRef…dRef, table-bubble.ts, table-events source text, godparents, moreCites, citesTitle · commity 208d8b92, 21a132c1 · spec 073 §14.3, §14.5 · dirigent:prace/1110-app-tabulka-p2 (citace: jen citace v datech, ne FactReliability.sourceIds) -->

<a id="A6.7.13"></a>
### A6.7.13 Zeichen in den Zellen

Übersicht über alles, womit die Tabelle eine Zelle oder eine Zeile kennzeichnet. Die Legende **Zeichen ⓘ** rechts
über der Tabelle (Blase „Zeichen in den Zellen“, auf dem Telefon ein Panel von unten) zeigt die ersten zwei Tabellen:
vier Stufen eines Befunds und fünf Arten eines Werts; in einem Stammbaum aus der Forschung auch die dritte, die
Zeichen der Forschung.

**Befunde der Prüfung** ([A6.7.5](#A6.7.5)). Das Zeichen steht am Ende der Zelle hinter dem Wert; ein Klick auf eine
Zelle mit Befund öffnet die Blase des Befunds.

| Zeichen | Wie es aussieht | Was es bedeutet (Legende) | Wo es erscheint |
|---|---|---|---|
| **Fehler** | ein voller roter Kreis mit weißem „!“; die Zelle rötlich hinterlegt | „Die Angaben widersprechen sich.“ | die Zelle der Angabe, die der Befund betrifft; **Befunde**, **Höchste Stufe**; eine eingeklappte Gruppe |
| **zu prüfen** | ein volles bernsteinfarbenes Quadrat mit abgerundeten Ecken und „?“; die Zelle bernsteinfarben hinterlegt | „Ein ungewöhnlicher Wert, der geprüft werden sollte.“ | wie Fehler |
| **Spur** | ein kleiner leerer grauer Ring; die Zelle nicht hinterlegt | „Eine Spur für die Forschung, kein Fehler.“ | wie Fehler; ein Pate, der immer wieder auftaucht ([A6.7.10](#A6.7.10), [A6.7.12](#A6.7.12)) |
| **ungewöhnlich** | ein grauer leerer Stern „☆“; die Zelle nicht hinterlegt | „Ein als „Kein Fehler“ markierter Befund.“ | die Zelle der Angabe; **Ungewöhnlich, geprüft**; **Höchste Stufe**, wenn alle Befunde der Person markiert sind |

- Kreis und Quadrat unterscheiden sich in Form und Zeichen, nicht nur in der Farbe. Ein Bildschirmleser liest das
  Zeichen als Stufe und Text des Befunds vor.
- **Befunde** hat das Zeichen der höchsten Stufe hinter der Anzahl; **Höchste Stufe** hat es vor dem Wort. Eine Person
  ohne Befund hat in der Spalte **Befunde** eine blasse „0“.
- Eine eingeklappte Gruppe von Spalten (schmaler Streifen) zeigt das höchste Zeichen aus ihren Zellen.

**Arten eines Werts.** Keine davon ist ein Befund.

| Zeichen | Wie es aussieht | Was es bedeutet (Legende) | Wo es erscheint |
|---|---|---|---|
| **unsicheres Datum** | das Datum gepunktet unterstrichen; das Wort **um**, **vor** oder **nach** in kleinerer grauer Schrift vor dem Datum | „Etwa, vor, nach oder ein Zeitraum; kein Befund.“ | Spalten der Daten ([A6.7.3](#A6.7.3)) |
| **Verlässlichkeit** | der Name der Stufe in Grau (in der Legende **Bestätigt**): **Bestätigt**, **Belegt**, **Wahrscheinlich**, **Möglich**, **Aus dem Stammbaum**, **Hinweis**, **Ohne Quelle** | „In den Spalten Verlässlichkeit und Forschung; bei Verbindungen in der Gruppe Heirat, bei Ereignissen in der Gruppe Quelle.“ | **Verlässlichkeit Name**, **Verlässlichkeit Geburt**, **Verlässlichkeit Tod**, **Verlässlichkeit Heirat** (Personen, Verbindungen), **Verlässlichkeit** (Ereignisse); Stufen: [S7.1](S7-reliability-and-verification.md#S7.1) |
| **Ersatzwert** | die Abkürzung **get.** oder **begr.** in einem kleinen Rahmen vor dem Wert, der Wert kursiv; Hinweis „Taufe, Geburt unbekannt“, „Begräbnis, Tod unbekannt“ | „Taufe statt Geburt, Begräbnis statt Tod.“ | Datum und Ort von Geburt und Tod ([A6.7.3](#A6.7.3)) |
| **berechnet** | graue Schrift; „≈ 67“ eine Schätzung, „28–29“ ein Bereich | „Ein Bereich aus ungenauem Datum, ≈ aus einer Schätzung.“ | Alter, Abweichung des angegebenen Alters, Dauer der Verbindung, Anzahlen, Generation, Vollständigkeit; am Spaltenkopf „Berechnet aus: …“ |
| **trifft nicht zu** | „–“ in grauer Kursivschrift, in der Legende ebenso; Hinweis „Trifft nicht zu“ | „Betrifft die Person nicht.“ | der Tod bei einer lebenden Person (bei **Vollständigkeit Sterbefall** „lebt“), das Alter des Vaters oder der Mutter ohne erfassten Elternteil, die Spalten der Verbindung bei einer Person ohne Verbindung, die Zellen der Heirat bei einer Verbindung ohne Heirat (Hinweis „Trifft nicht zu: Verbindung ohne Heirat“, [A6.7.4](#A6.7.4)), **Alter beim Ereignis** bei der Geburt |

- In den Spalten **Verlässlichkeit …** wird von **Bestätigt** bis **Ohne Quelle** in der Reihenfolge aus der Tabelle
  sortiert.

**Zeichen der Forschung** ([A6.7.14](#A6.7.14)), nur in einem Stammbaum aus der Forschung. Der Kreis der Forschung hat
einen Rand, so dass er sich auch ohne Farbe vom Kreis des Fehlers (ohne Rand) und vom Quadrat „zu prüfen“
unterscheidet. Die Legende ergänzt: „Ein Kreis mit Rand steht für die Forschung. ! und ? der Forschung stehen nur in
den Spalten Forschung, an einer Angabe nur ≠.“

| Zeichen | Wie es aussieht | Was es bedeutet (Legende) | Wo es erscheint |
|---|---|---|---|
| **wartet** | ein voller bernsteinfarbener Kreis mit Rand und „!“ | „Die Forschung wartet auf eine Entscheidung.“ | **Forschung**, **Wartet auf Entscheidung** |
| **wartet auf andere** | ein leerer bernsteinfarbener Ring mit „!“ | „Eine Antwort von außen steht aus (Brief, Archiv); zu entscheiden gibt es nichts.“ | **Forschung**, **Wartet auf Entscheidung** |
| **Widerspruch** | ein voller bernsteinfarbener Kreis mit Rand und „≠“ | „Die Quellen stimmen nicht überein. Das ist kein Fehler in den Daten: Es geht darum, welcher Quelle man folgt.“ | vor dem Wert in der Zelle der Angabe (ohne Hinterlegung, ein Klick öffnet die Widersprüche); **Forschung**, **Widersprüche** |
| **Frage** | ein voller bernsteinfarbener Kreis mit Rand und „?“ | „Eine offene Frage oder eine Hypothese.“ | **Forschung**, **Hypothesen** |
| **Agent** | ein sich drehender Bogen (bei reduzierter Bewegung steht er still) | „Der Agent arbeitet gerade an der Person (nur beim Verfolgen).“ | **Forschung**, **Agent**; am Namen der Person ein senkrechter Balken von 3 px |
| **fertig** | „✓“ | „Der Agent hat die Arbeit beendet (4 s lang).“ | hinter dem Namen, **Agent** |

- In der Spalte **Forschung** hat eine Person in der Warteschlange des Agenten einen grauen Punkt „·“ mit „in der
  Warteschlange“; „+2“ hinter dem Zeichen sind weitere Arten von Signalen. Neu aus der Forschung hat in seiner Spalte
  den Punkt „•“.
- Eine Spalte, die nur beim Verfolgen der Forschung einen Wert hat, hat ohne Verfolgen „–“ mit dem Etikett „live“
  (Hinweis „Nur beim Verfolgen der Forschung“). Ab App 3.27.0 nur dann, wenn auch die Brücke der Forschung nicht
  antwortet ([A6.7.14](#A6.7.14)).

**Weitere Zeichen** (die Legende zeigt sie nicht):

| Zeichen | Wie es aussieht | Was es bedeutet | Wo es erscheint |
|---|---|---|---|
| „…“ | drei blasse Punkte; Hinweis „Prüfungen laufen…“ | die Prüfung des Stammbaums läuft noch | **Befunde**, **Höchste Stufe**, **Ungewöhnlich, geprüft** |
| „◌ Prüfungen laufen…“ | ein leerer Ring und Text rechts über der Tabelle | dasselbe für die ganze Tabelle; die Chips der Befunde warten noch | über der Tabelle, neben **Zeichen ⓘ** |
| Prozent mit Balken | eine Zahl und ein kurzer Balken, dessen gefüllter Teil der Wert ist | Vollständigkeit ([A6.7.4](#A6.7.4)) | Spalten **Vollständigkeit …** |
| fette Zahl, „–“ | in der Abdeckungszeile | Abdeckung unter 50 % (bei den Spalten der Vollständigkeit ein Durchschnitt unter 50 %); „–“ eine Spalte ohne eine Zelle, die sie betreffen würde | **Abdeckungszeile** ([A6.7.4](#A6.7.4)) |
| „+2“ | eine Zahl in einem ovalen Rahmen hinter dem ersten Zitat | weitere zitierte Quellen; ein Klick öffnet **Weitere Quellenangaben** | Quellenangaben zu Geburt, Heirat, Tod ([A6.7.12](#A6.7.12)) |
| „↗“ | hinter einer unterstrichenen Webadresse | ein Link in ein neues Fenster | **Online**, Quellenangaben „… URL“ ([A6.7.11](#A6.7.11), [A6.7.12](#A6.7.12)) |
| Umriss der Zelle | ein dünner Umriss von 1 px | die aktive Zelle ([A6.7.15](#A6.7.15)) | eine Zelle der ausgewählten Zeile |
| Textcursor | beim Überfahren mit der Maus | die Zelle lässt sich an Ort und Stelle bearbeiten ([A6.7.15](#A6.7.15)) | bearbeitbare Zellen |
| ●○, ●● | ein oder zwei volle Punkte vor „1 Leser“, „2 Leser“; Hinweis, wer die Abschrift gelesen hat | wie viele Leser die Abschrift gelesen haben | **Von der Forschung gelesen** ([A6.7.11](#A6.7.11)) |
| „12 T.“ | eine Zahl mit „T.“ | ein Alter bis zu einem Jahr in Tagen | **Alter beim Ereignis** ([A6.7.10](#A6.7.10)) |
| ▾, ▸ | ein Dreieck vor dem Namen | die Verbindungen der Person aufgeklappt, zugeklappt ([A6.7.1](#A6.7.1)) | **Vollständiger Name** einer Person mit zwei und mehr Verbindungen |
| „3 Verbindungen“ | bei einer zugeklappten Person in einem ovalen Rahmen hinter dem Namen; bei einer aufgeklappten in der Spalte **Partner** in grauer Kursivschrift | die Zahl der Verbindungen der Person | Zeile der Person |
| „└ Verbindung 2 von 3“ | eine eingerückte Unterzeile | eine Verbindung der Person | Unterzeile der Verbindung |
| „2 Verbindungen außerhalb des Filters · zeigen“ | eine Schaltfläche in einer eingerückten Zeile | Verbindungen, die dem Filter nicht entsprechen; gezeigte sind abgeschwächt | unter den Unterzeilen der Verbindungen |
| „passt nicht mehr“ | die ganze Zeile blass, Text kursiv am Ende | die Zeile entspricht nach einer Bearbeitung dem Filter nicht mehr ([A6.7.8](#A6.7.8)) | bis zur nächsten Änderung der Sortierung, des Filters oder der Ansicht |
| Hervorhebung | hinterlegte Schrift des Treffers | ein Treffer der Suche ([A6.7.6](#A6.7.6)) | sichtbare Spalten |
| ↑, ↓ (↑1, ↓2) | ein Pfeil im Spaltenkopf, mit Nummer bei mehreren Schlüsseln | Richtung und Reihenfolge des Schlüssels der Sortierung ([A6.7.6](#A6.7.6)) | Spaltenkopf |
| −, + | ein Zeichen beim Namen der Gruppe | eine Gruppe von Spalten einklappen, ausklappen ([A6.7.2](#A6.7.2)) | Zeile der Gruppen über dem Spaltenkopf |

- **Grenzen:** der CSV-Export trägt weder Zeichen noch Farben; XLSX trägt nur die Hinterlegung und den Kommentar bei
  Fehler und zu prüfen ([A6.7.9](#A6.7.9)).
- **Bedienung:** **Zeichen ⓘ** rechts über der Tabelle.
- **Gilt seit:** App 3.27.0

<!-- zdroj: app:src/ui/table-view/table-grid.ts MARK_GLYPH (error „!“, warning „?“, info prázdný, unusual „☆“), markHtml (role img, aria-label úroveň: text), cellClasses (aggregate, na, computed, uncertain, subst, ghost, issue), cellText („–“), cellInner (značka za hodnotou; u čísla vpravo za, jinak před slovem), moreCitesHtml „+N“, cellValueCore (tv-comp proužek 30 px, tv-subst, tv-qual), linkHtml „ ↗“, readersHtml (fs-dots), nameCell (▾/▸, tv-unions-pill unionsN, └ unionKofN, hiddenUnions), sort mark ↑/↓ s číslem, tv-group-toggle −/+ · table-bubble.ts legendHtml (4 značky + uncertain „1890–1892“, reliability ✓, subst křt., computed „≈ 67“, na „–“) · table-bar.ts createStatus (◌ checksRunning, legenda „Značky ⓘ“) · table-columns.ts checksPendingCell („…“ ghost), findingsCell („0“ ghost), topSeverityCell, unusualCell (☆), pillCell + reliabilityText + RELIABILITY_RANK (human, proven, probable, possible, import, lead, none), readersCell (dots [true, n > 1]), naCell (relD, fAge, mAge, unionScoped bez svazku, evAge narození), eventAge (ageDays) · table-subrows.ts aggregate „n svazků“ · table-checks.ts bandSeverity · table-coverage.ts LOW pod 50 % · index.html CSS .tv-mark--error (kolečko 16 px, --danger), --warning (čtverec radius 3px, --warning), --info (kroužek 10 px, okraj --text-faint), --unusual, .tv-cell--error/--warning (danger-soft, warning-soft), --uncertain (dotted), --na (kurzíva), --computed, .tv-subst, .tv-cites-more, .tv-row.is-stale, .tv-stale-note, mark.tv-hit · strings.ts table.legend, legendTitle, legendKind.*, legendText.*, sev.*, subst.*, qual.*, na, living, checksRunning, moreCites, citesTitle, readers, ageDays, unionsN, unionKofN, hiddenUnions, staleRow, col.relN/relB/relD/relW/evRel, reliability.human/proven/import/none, factStatus.probable/possible/lead · app f34d41e1 · Milan 10. 11. (dirigent:prace/1110-doc-tabulka-znacky bod 1) · pořadí stupňů podle RELIABILITY_RANK (Z rodokmenu před Vodítko), dirigent:prace/_drobnosti/doc.md · značky výzkumu: table-grid.ts RESEARCH_GLYPH (wait „!“, ext „!“, conf „≠“, q „?“, agent oblouk, done „✓“, queue „·“, new „•“), researchMarkHtml, conflictMarkHtml (≠ před hodnotou) · index.html .tv-rmark--wait/conf/q (kolečko 16 px, --signal-warn, lem box-shadow), --ext (prázdný kroužek), --agent (agSpin, prefers-reduced-motion), --done, .tv-agent-bar (3 px) · strings.ts table.res.legendName, legendText, legendNote, liveTag, liveOnly · aktivní buňka a kurzor: commity 05d9a9ab, be9ca8cd · spec 073 §16.3, U7 -->

<a id="A6.7.14"></a>
### A6.7.14 Die Forschung in der Tabelle

In einem Stammbaum aus der Forschung ([S1](S1-connecting-app-and-research.md)) zeigt die Tabelle auch, was die
Forschung über die Personen weiß: was auf Entscheidung wartet, Widersprüche der Quellen, Hypothesen, die Arbeit des
Agenten, die Linien und den Austausch mit dem Stammbaum. In den Stammbaum schreibt sie nichts.

- **Spalten der Personen** (Gruppe **Forschung**, standardmäßig ausgeblendet; das Kästchen **alle** schaltet
  **Forschung**, **Wartet auf Entscheidung**, **Widersprüche**, **Hypothesen** und **Agent** ein):

  | Spalte | Was sie zeigt |
  |---|---|
  | **Forschung** | das dringendste Signal der Person in der Reihenfolge wartet › Widerspruch › Frage oder Hypothese › Agent › in der Warteschlange; „+n“ weitere Arten |
  | **Wartet auf Entscheidung** | die Anzahl und der erste Eintrag; beim Warten auf andere „von außen: …“ (Brief gesendet, Anfrage in der Familie …) |
  | **Widersprüche** | die Zahl der offenen Widersprüche und die Angaben („· Geburt, …“); „· in der App entscheidbar“, wo das geht ([S2](S2-edits-from-the-app.md)) |
  | **Hypothesen** | die Zahl der offenen Hypothesen; „vom Agenten entschieden“ |
  | **Forschungsaufgaben** | die Aufgaben der Person in der Warteschlange („2 · nächste Nr. 3 in der Warteschlange“, „1 · läuft gerade“) |
  | **Agent** | „arbeitet: {Aufgabe}“, „in der Warteschlange“, „fertig“ |
  | **Linie** | der Platz der Person zwischen den Linien (unten) |
  | **Materialien**, **Baum endet hier**, **Gesucht, nichts gefunden**, **Austausch mit der Forschung**, **Ursprünglich im Stammbaum**, **Geschichte**, **Wo es bearbeitet wird**, **Neu aus der Forschung**, **Verfügbarkeit der Quellen**, **Pfarrei (Forschung)**, **Geschätzte Geburt** | was die Forschung über die Materialien der Person weiß, über den Rand des Stammbaums, über den Austausch mit dem Stammbaum, über Quellen und Orte |

- **Verbindungen:** **Forschungs-ID** (F…), **Linie** (nach dem Partner aus der Linie), **Agent** („arbeitet am Paar:
  …“) und **Widersprüche** (Widersprüche zu Heirat und Scheidung bei beiden Partnern). **Quellen:** **Forschungs-ID**
  (S…) und **Scan**: „auf dem Rechner der Forschung“, „Scan fehlt auf dem Rechner der Forschung“ (hervorgehoben),
  „online (Archiv)“.
- **Linie:** in einer Linie (der Partner einer Person aus der Linie „· Partner“; ein zur Linie hinzugefügter
  Seitenzweig gehört zu dieser Linie), „Seitenzweig: {Name}“, „Insel“, „außerhalb der Linien“. **Außerhalb der
  Linien** sind nicht zu einer Linie hinzugefügte Seitenzweige, Inseln und die übrigen
  ([R2.3](R2-lines-and-queue.md#R2.3)). Die Linien nimmt die Tabelle live aus der Forschung, sonst aus der Datei der
  Forschung; sortiert wird in der Reihenfolge der Linien der Forschung, dann Zweige, Inseln und außerhalb der Linien,
  darin nach der Generation. Die Spalte und die Chips der Linien gibt es nur bei einer Forschung mit Linien.
- **Widerspruch an einer Angabe:** die Zelle einer Angabe mit offenem Widerspruch der Quellen hat vor dem Wert „≠“,
  ohne Hinterlegung. Ein Klick auf „≠“ öffnet die Blase mit den Widersprüchen; ein Bildschirmleser liest „{Wert},
  Widerspruch der Quellen: {Angabe}“. Die Zeichen „!“ und „?“ der Forschung stehen nur in den Spalten der Forschung
  ([A6.7.13](#A6.7.13)).
- **Chip Forschung ▾:** ein Chip mit einem Menü in den Abschnitten **Signale**, **Linien**, **Austausch, Quellen und
  Orte**, **Weitere Filter der Forschung** und **Neu aus der Forschung**; „Eine Auswahl öffnet den Block Forschung in
  der Leiste.“ Chips: **Wartet auf Entscheidung**, **Mit Widerspruch**, **Mit offener Frage**, **Agent arbeitet /
  wartet**, einer für jede Linie und **Außerhalb der Linien** (mit Anzahlen), **Nicht gesendet**, **Von der Forschung
  geändert**, **Hier zu entscheiden**, **Wartet auf andere**, **Neu aus der Forschung** (letzte 24 Std., letzte
  7 Tage, seit dem letzten Öffnen), **Nur im Lesesaal**, **Ort unbestimmt**, **Vom Agenten entschieden**, **Pausiert /
  zurückgestellt**, **Baum endet hier**. Auf dem Telefon ist der Abschnitt **Forschung** im Panel **Filter**, seltenere
  Chips unter **Weitere Forschung (n)**.
- **Vorgegebene Ansichten** (Abschnitt **Forschung** im Menü **Ansicht**; wie die anderen vorgegebenen ändern sie sich
  nicht, [A6.7.7](#A6.7.7)):

  | Ansicht | Was sie zeigt |
  |---|---|
  | **Forschung** | Personen mit einem Signal: Name, Forschung, Wartet auf Entscheidung, Widersprüche, Hypothesen, Agent, Forschungsaufgaben, Geburt, Tod; vom dringendsten an sortiert, dann nach dem Namen |
  | **Linie: {Linie}** (für jede Linie) und **Außerhalb der Linien** | Name, Linie, Generation, Forschung, Geburt, Tod, Widersprüche, Agent; Chip der Linie; nach der Linie sortiert |
  | **Austausch mit der Forschung** | Personen mit einem Austausch: Name, Austausch mit der Forschung, Ursprünglich im Stammbaum, Neu aus der Forschung, Widersprüche, Geburt |

  Die Verbindungen sind darin zugeklappt und die Abdeckungszeile eingeschaltet. Eine leere Ansicht sagt „Die
  Forschung braucht gerade nichts“ oder „Baum und Forschung sind abgeglichen“.
- **Blase der Forschung:** ein Klick auf eine Zelle der Forschung öffnet eine Blase (auf dem Telefon ein Panel von
  unten) mit Abschnitten danach, was die Person hat: **Wartet auf Entscheidung · n** (**Versionen vergleichen ›**,
  **Wartet auf Bearbeitung ›**), **Wartet auf andere**, **Widersprüche der Quellen · n** (**Entscheiden ›**),
  **Hypothesen** oder **Offene Frage** (**Was die Forschung weiß ›**, [S3.5](S3-what-the-research-knows.md#S3.5)),
  **Agent arbeitet** (**Forschung verfolgen ›**), **Forschungsaufgaben in der Warteschlange** (**Aufgabe in der
  Forschung öffnen**), **Materialien ›**, **Linie** oder **Außerhalb der Linien** (**Linie im Baum zeigen**, **In der
  Forschung ändern**), **Ursprünglich im Stammbaum** (**Wert aus dem Stammbaum wiederherstellen**, nur mit der
  Forschung auf diesem Rechner) und **Verfügbarkeit der Quellen**. Eine Aktion, die in der Forschung bestätigt wird,
  hat ein Zeichen wie anderswo ([S4.5.1](S4-research-from-the-app.md#S4.5.1)).
- **Live:** beim Verfolgen der Forschung ändern sich nur die Zellen, die die Änderung betrifft; die Reihenfolge der
  Zeilen bleibt. Am Namen der Person, an der der Agent arbeitet, läuft ein senkrechter Balken. Über der Tabelle steht
  „● Forschung live verfolgt“, sonst „Forschung: Stand vom {wann}“.
- **Export:** CSV und XLSX tragen Texte und Anzahlen („wartet; Widerspruch (1)“, „1: Geburt“, ohne Widerspruch „0“),
  ohne Zeichen. Ohne Verfolgen (ab App 3.27.0 nur ohne Antwort der Brücke) sind **Agent** und **Forschungsaufgaben**
  leer, und die Meldung sagt „Agent und Forschungsaufgaben sind leer: Die Forschung wird nicht verfolgt.“ Die
  Abdeckungszeile hat bei den Spalten der Forschung „–“.
- **Grenzen:**
  - ohne Agenten (Strom-Archiv) und in einem schreibgeschützten Stammbaum gibt es weder **Wartet auf Entscheidung**,
    **Forschungsaufgaben** und **Agent** noch die Chips **Nicht gesendet** und **Hier zu entscheiden**; die Ansicht
    **Austausch mit der Forschung** gibt es nur in einer Forschung mit Agenten, die sich ändern lässt;
  - **Agent** und **Forschungsaufgaben** haben nur beim Verfolgen der Forschung einen Wert, sonst „–“ mit dem Etikett
    „live“; der Chip **Agent arbeitet / wartet** filtert ohne Verfolgen nicht. Ab App 3.27.0 gilt beides nur ohne
    Antwort der Brücke (unten);
  - in einem schreibgeschützten Stammbaum hat die Blase keine Aktionen: „Schreibgeschützt: Widersprüche lassen sich
    hier nicht entscheiden.“
- **Ohne Verfolgen mit Brücke:** antwortet die Brücke der Forschung auf diesem Computer, nehmen **Agent** und
  **Forschungsaufgaben** (auch der Balken am Namen, der Chip **Agent arbeitet / wartet** und der Export) die Arbeit
  des Agenten und die Warteschlange aus der regelmäßigen Abfrage der Brücke und sehen aus wie beim Verfolgen. Eine
  leere Warteschlange der Brücke lässt die Zellen leer. Die Tabelle wird neu gezeichnet, wenn sich die Antwort der
  Brücke ändert. Das Telefon fragt die Brücke nicht. Genauso funktioniert die Forschungsübersicht ohne Verfolgen
  ([S4.1.5](S4-research-from-the-app.md#S4.1.5)).
- **Bedienung:** Panel **Spalten** → Gruppe **Forschung**; Chip **Forschung ▾**; **Ansicht** → Abschnitt
  **Forschung**; **Zeichen ⓘ**.
- **Gilt seit:** App 3.27.0 mit Forschung 1.31.0

<!-- zdroj: app:src/ui/table-view/table-research.ts RESEARCH_COLUMNS, RESEARCH_DEFAULT_COLUMNS (rSum, rWait, rConf, rHyp, rAgent), LIVE_ONLY (rTasks, rAgent), NEEDS_AGENT (rWait, rTasks, rAgent), rSum pořadí (čeká 5 › rozpor 4 › otázka 3 › agent 2 › fronta 1), researchLinesOf (živě /directions/people, jinak soubor _STROM_DIRECTION), personLineRole, isOffLine, researchChips, RESEARCH_SIGNAL_CHIPS, RESEARCH_MORE_CHIPS, researchChipOffer (xUnsent, xDecideHere jen research a ne jen ke čtení), researchChipActive (live), unionLineRole, unionResearchCell (UNION_FACTS), sourceImageCell, unionResearchIdCell, sourceResearchIdCell · table-views.ts pohledy Výzkum, Linie, Mimo linie, Výměna s výzkumem · table-research-bubble.ts, table-research-ui.ts · table-grid.ts conflictMarkHtml · table-export.ts (exportNotLive) · strings.ts table.res.*, table.col.r*, uResearchId, srcResearchId, srcImage · commity 53137620, 99b60acb, a2e1dc73, 02e88e9a, 32958eb4, fd9c220f, cf9e63d8, 4635c16e, 5857be6b, 970e6b88, 6b66e037, 9e51ff66 · research: GET /directions/people, funkce directions.places, brána APP_SHOWS_RESEARCH_TABLE (src/core/stromapp.ts), CHANGELOG.cs.md 1.31.0 „Výzkum v tabulce aplikace Strom“ · spec 073 §16, K7.1–K7.8 · bez sledování s mostem: app 8d564b35 src/ui/research-ui.ts unfollowedAgentNow (onComputer, researchStatusNow, status.working a queue), src/ui/table-view/table-ui.ts tableResearchAgentChanged · spec 057 K1.12 -->

<a id="A6.7.15"></a>
### A6.7.15 Aktive Zelle, Zellenmenü und Bearbeiten an Ort und Stelle

Ein Klick auf eine Zelle wählt die Zeile aus und macht die Zelle zur aktiven Zelle (dünner Umriss); die Pfeiltasten
verschieben sie. Die aktive Zelle lässt sich kopieren, nach ihrem Wert filtern und die Angabe in ihr direkt in der
Tabelle bearbeiten.

- **Kopieren:** Strg/Cmd+C ohne ausgewählten Text kopiert den Text, den die aktive Zelle zeigt, ohne Zeichen, Symbole
  und Marken. Von Hand ausgewählter Text wird wie gewohnt kopiert.
- **Zellenmenü:** das Zeilenmenü (rechte Maustaste, Umschalt+F10) und das Panel der Zeile (Tippen mit dem Finger auf
  die Zelle) beginnen mit den Möglichkeiten der Zelle **Kopieren**, **Nur „{Wert}“** und **Ohne „{Wert}“** (der Wert
  auf etwa 24 Zeichen gekürzt, mit „…“); darunter stehen die Zeilenaktionen ([A6.7.8](#A6.7.8)). Das Menü öffnet sich
  an der Zelle, auch wenn eine andere Zeile ausgewählt war.
  - **Nur** und **Ohne** setzen den Filter der Spalte **ist** / **ist nicht** ([A6.7.6](#A6.7.6)), Chip „{Spalte} =
    {Wert} ×“ oder „{Spalte} ≠ {Wert} ×“; verglichen wird ohne Rücksicht auf Groß- und Kleinschreibung und
    diakritische Zeichen. Eine Zelle mit dem Namen einer Person vergleicht die Person: **Nur „{Vater}“** in der Spalte
    **Vater** zeigt die Geschwister, nicht die Kinder eines Namensvetters.
  - Eine leere Zelle bietet **Nur leere** und **Nur ausgefüllte**, eine Zelle mit einer Werteliste setzt den Filter
    der Werte. Eine Zelle ohne einen einzelnen Wert zum Vergleichen (Zeichen der Forschung, mehrere Namen,
    Vollständigkeit, Zahl der Verbindungen) bietet nur **Kopieren**; der eigene Name oder Titel der Zeile hat nur die
    Zeilenaktionen.
  - Der Filter wird mit der Ansicht gespeichert ([A6.7.7](#A6.7.7)).
- **Bearbeiten an Ort und Stelle:** bearbeiten lässt sich eine Zelle, die für eine Angabe des Stammbaums steht:
  - **Vorname**, **Nachname** (zeigt er den Ehenamen, wird dieser bearbeitet), **Geburtsname**, **Ehename**;
  - **Geschlecht** durch Auswahl (**Männlich**, **Weiblich**, **Unbekannt**) und **Ref.-Nummer**;
  - Datum und Ort von Geburt, Taufe, Tod und Begräbnis, **Todesursache** und **Eingetragenes Sterbealter**;
  - **Beruf**, solange die Person höchstens einen hat;
  - die Angaben der Verbindung (Verbindungstabelle, Unterzeile der Verbindung, Zeile einer Person mit einer
    Verbindung): **Stand der Verbindung** durch Auswahl (**Verheiratet**, **Partner**, **Geschieden**, **Getrennt**, wie
    im Formular der Verbindung), Datum und Ort der Heirat, das eingetragene Alter jedes Partners bei der Heirat
    (**Eingetragenes Heiratsalter**, **Eingetragenes Alter des Partners**, **Eingetragen 1** und **2**),
    **Scheidungsdatum** und **Scheidungsort**. Eine leere Zelle legt die Angabe der Verbindung an, wie sie das Formular
    der Verbindung anlegt. Bei einer Verbindung ohne Heirat ([A6.7.4](#A6.7.4)) werden die Zellen der Heirat nicht
    bearbeitet.

  **Vollständiger Name** wird in der Zelle nicht bearbeitet (er besteht aus mehreren Teilen), ebenso wenig berechnete Zellen,
  Prüfungen, Forschung, Quellenangaben, Anzahlen und Beziehungen; ein Doppelklick darauf öffnet **Bearbeiten…**.
- **Das Feld** steht in der Zelle. Nur in einer Spalte, die schmaler ist als die kleinste Breite des Felds (Text und
  Datum 100 px, Ort 140 px, Auswahl 90 px), ist das Feld breiter und liegt mit einem Schatten über der Zeile (ab App
  3.28.0; vorher lag es über der nächsten Zelle). **Enter** speichert, **Esc** bricht ab, **Tab** und **Umschalt+Tab** speichern und
  gehen zur nächsten oder vorigen bearbeitbaren Zelle der Zeile, ein Klick anderswohin speichert. In einer Auswahl speichert ein
  Mausklick den Wert sofort; nach der Wahl mit den Pfeilen speichern ihn Enter, Tab oder ein Klick anderswohin. Das
  Datum wird wie im
  Formular der Person gelesen; ein unlesbares bleibt im Feld mit dem Fehler „Das Datum ist nicht lesbar (z. B.
  15.5.1880, 1880, um 1880)“. Der Ort bietet die Orte des Stammbaums an. Ohne Vor- und Nachname wird nichts
  gespeichert: „Vor- oder Nachname muss bleiben“.
- **Das Speichern** geht denselben Weg wie das Formular der Person (die Angaben der Verbindung wie das Formular der
  Verbindung) und ist ein Schritt zurück (Strg/Cmd+Z), auch wenn eine leere Zelle die Angabe angelegt hat. Taufe und
  Begräbnis bearbeiten das erste solche Ereignis (seine übrigen Angaben und Zitate bleiben) oder fügen eines hinzu;
  ein leeres Feld löscht nur diese Angabe. Dann blinkt die Zeile, bleibt an ihrem Platz, und die Meldung sagt
  „Gespeichert: {Name}“.
- **Grenzen:** an Ort und Stelle lässt sich nicht bearbeiten in einem schreibgeschützten oder gesperrten Stammbaum,
  im Strom-Archiv, auf dem Telefon und bei einer gesperrten Person. Auf dem Telefon wird eine Angabe über das Panel
  der Zeile → **Bearbeiten…** bearbeitet.
- **Bedienung:** Doppelklick, **F2**, **Enter** auf der aktiven Zelle (bei einer Zelle mit Befund öffnet Enter zuerst
  die Blase des Befunds), im Zeilenmenü **Zelle bearbeiten** (F2). Eine bearbeitbare Zelle hat beim Überfahren mit der
  Maus einen Textcursor.
- **Gilt seit:** App 3.27.0

<!-- zdroj: app:src/ui/table-view/table-grid.ts copyKey (Ctrl/Cmd+C, copyPlainText), F2, Enter (has-issue → onIssue, has-finds → onFindings, jinak startEditAt, jinak open), Escape, Tab · table-ui.ts showTableRowMenu (cellPart, cell-edit „Upravit buňku“ s F2), tableCellChoices, tableCellSheetBlocks, :1663 úprava na místě ne v jen ke čtení, archivu, na telefonu (isPhoneBar) · table-edit.ts editTargetOf, PERSON_FIELDS (surname: marriedSurname || lastName, birthSurname, marriedSurname, bDate…burPlace, occ), UNION_FIELDS (wDate, wPlace), editChangeOf (normalizeDateInput, první křest a pohřeb, prázdné pole smaže jen údaj, beze jména neuloží) · strings.ts table.cell.copy, only, without, edit, badDate, nameNeeded, editLabel, onlyEmpty, onlyFilled, matchEquals, matchNotEquals, savedToast · commity 05d9a9ab, be9ca8cd, 28aabdc8 · spec 073 U9 (T54 F4, F8, F9) · T54 2. kolo: table-edit.ts PERSON_FIELDS (firstName, gender, refn, dCause, dAgeRec), UNION_FIELDS (wAgeRec, pAgeRec, rec1, rec2, divDate, divPlace, uStatus), WEDDING_FIELDS (ne u unionWithoutWedding), editOptionsOf (GENDERS, UNION_STATUSES v pořadí formuláře svazku), table-grid.ts select (klik myší uloží hned), commity 8fdf52ca, 79764eba (T54 G3, G10) · nabídka u buňky jiného řádku: commit 400ccda8 (T54 G7) · pole v buňce: table-grid.ts EDITOR_MIN_WIDTH (text 100, date 100, place 140, select 90), placeEditor, commit 80c2ffb9 · panel klepnutím: commit ee38c7a6 -->

<a id="A6.8"></a>
## A6.8 Ansicht in einem eigenen Fenster

Am Computer lässt sich jede Ansicht in einem eigenen Fenster öffnen, etwa auf einem zweiten Monitor, und zwar in
beliebiger Zahl. Das Hauptfenster bleibt bei seiner Ansicht. Nur das Hauptfenster speichert; die anderen Fenster
schicken ihm ihre Änderungen und bekommen von ihm den Stammbaum.

- **Wo es geht:** am Computer (Windows, macOS, Linux, ChromeOS), auch mit Touchscreen, in einem Fenster breiter als
  640 px. Auf Telefon und Tablet (Android, iOS, iPadOS) und in der exportierten App (HTML-Datei) erscheint ⧉ nicht,
  und die Kurzbefehle öffnen nichts.
- **Was das Fenster übernimmt:** den Stammbaum, die Person in der Mitte und das, was die Ansicht zeigt: bei der
  Tabelle Zeilentyp, Filter, Suche, gespeicherte Ansicht, Sortierung und die gewählte Zeile; bei Familie den Zoom,
  beim Fächer die Kreise, bei der Karte Orte und Zoom. Danach hat das Fenster einen eigenen Zustand. Neu laden des
  Fensters (F5) behält Ansicht und Person.
- **Was das Fenster hat:** statt der Leiste der App einen Kopf: Name des Stammbaums, Ansichtsumschalter (unter
  960 px als „{Ansicht} ▾“), **Auswahl folgen** ([A6.8.1](#A6.8.1)), **Rückgängig**, **Wiederholen** und ⧉ **Weiteres Fenster
  öffnen**. Stammbaum-Umschalter, Menü **Forschung**, Einstellungen und das kleine Forschungspanel hat das Fenster
  nicht.
- **Änderungen:** im Fenster lässt sich eine Person bearbeiten (Menü der Person, **Bearbeiten**) und eine Zelle der
  Tabelle. Das Hauptfenster speichert sie, sie lassen sich als seine Schritte rückgängig machen und erscheinen sofort in allen Fenstern.
  **Rückgängig** und **Wiederholen** im Kopf des Fensters nehmen Schritte des Hauptfensters zurück oder wiederholen sie. Wurde
  der Stammbaum inzwischen in einem anderen Fenster geändert, wird die Änderung nicht übernommen: „Der Stammbaum wurde
  inzwischen in einem anderen Fenster geändert. Die Änderung wurde nicht übernommen, die Daten sind aktualisiert.“ Eine
  angefangene Zelle der Tabelle bleibt dabei erhalten („Entwurf bleibt · Enter übernimmt, Esc verwirft“).
- **Forschung:** die Verbindung zur Forschung (Brücke, Verfolgen, Senden von Änderungen) bedient nur das
  Hauptfenster. Die Forschungseinträge im Menü der Person stehen im Fenster unter der Überschrift **Forschung · läuft
  im Hauptfenster**, und das Hauptfenster führt sie aus. Beim Live-Verfolgen der Forschung
  ([S1.4](S1-connecting-app-and-research.md#S1.4)) sind die Fenster wie das Hauptfenster nur lesbar: „Nur lesen · das
  Hauptfenster verfolgt die Forschung“ mit **Zum Hauptfenster**.
- **Grenzen:**
  - ⧉ im Hauptfenster zeigt die Zahl weiterer Fenster („2 weitere Fenster“, unter 1280 px nur die Zahl). Sein Menü
    hat oben **Geöffnete Fenster** (jedes mit **In den Vordergrund** und ×) und **Alle schließen**;
  - ab 5 offenen Fenstern weist die App darauf hin, dass jedes weitere Fenster Speicher braucht; sie verbietet nichts;
  - ein vom Browser blockiertes Fenster wird gemeldet („Der Browser hat das neue Fenster blockiert…“), mit **Erneut
    versuchen**;
  - der Titel des Fensters nennt Ansicht und Stammbaum („Tabelle – Horák – Strom“), der des Hauptfensters den
    Stammbaum („Horák – Strom“).
- **Bedienung:** App: ⧉ **In neuem Fenster öffnen** neben dem Ansichtsumschalter (Menü mit den sechs Ansichten, bei
  einem Stammbaum aus der Forschung auch **Forschungsübersicht**, [S4.1.6](S4-research-from-the-app.md#S4.1.6)); ⧉ in
  der Leiste der Tabelle nach **Export ▾**; am Reiter einer Ansicht Strg+Klick (macOS ⌘+Klick), mittlere Maustaste
  oder Rechtsklick (Umschalt+F10) → **{Ansicht} in neuem Fenster**.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:4b1373a7 src/windows/window-open.ts isDesktopSystem, windowsOffered (role main, ne isViewMode, > MOBILE_MAX 640, ne isPhoneBar), openInNewWindow · src/windows/window-controls.ts openWindow (BLOCKED_TOAST_MS 10 s, win.retry; MANY_WINDOWS 5, manyWindows), INDICATOR_TEXT_MIN_WIDTH 1280, renderMenu (6 pohledů, thisView, overview jen UI.canOpenResearchOverview), wireTabs (ctrl/meta click, auxclick button 1, contextmenu, Shift+F10 / ContextMenu) · src/windows/view-window-state.ts (přenos stavu, F5 satelitu) · src/windows/sat-header.ts · src/windows/satellite.ts readOnly (live, locked) · src/windows/sat-states.ts (live strip readOnlyLive, goToMain; CONFLICT_TOAST_MS) · src/windows/window-drafts.ts (draftKept) · src/windows/window-research-menu.ts (researchInMain) · src/windows/window-title.ts · index.html html.window-satellite .toolbar skryto · strings.ts win.* · CHANGELOG.cs.md 3.28.0 · spec 079 K1.1–K1.4, K1.7 · prace/1112-app-okna-zaklad, 1112-app-okna-pohledy -->

<a id="A6.8.1"></a>
### A6.8.1 Auswahl folgen

Die gewählte Person ist zwischen den Fenstern geteilt. Was eine Wahl in einem anderen Fenster in diesem Fenster
bewirkt, bestimmt der Schalter **Auswahl folgen** im Kopf des Fensters.

| Modus | Was eine in einem anderen Fenster gewählte Person bewirkt | Standard in den Ansichten |
|---|---|---|
| **wechseln** | sie wird zur Mitte des Fensters wie nach Fokussieren: Nachkommen zeigt ihre Nachkommen, der Fächer ihre Vorfahren, Familie ihre Familie | Familie, Nachkommen, Fächer |
| **nur markieren** | sie wird nur markiert: die Karte mit einem Ring, im Fächer ein Sektor, in der Zeitleiste eine Zeile, auf der Karte ihre Orte, in der Tabelle eine Zeile; die Mitte bleibt | Zeitleiste, Karte, Tabelle |
| **aus** | nichts; das Fenster hat eine eigene Auswahl und schickt sie nicht | – |

- **Grenzen:**
  - **wechseln** gibt es nur in Familie, Nachkommen und Fächer; sonst nur **nur markieren** und **aus**;
  - ein eigener Klick im Fenster ändert die Mitte nur in diesem Fenster; ein Fenster, das nach einem anderen
    gewechselt hat, gibt die Wahl nicht weiter;
  - das Hauptfenster folgt der Auswahl immer und hat keinen Schalter;
  - die Wahl gilt für ein Fenster und übersteht sein Neuladen (F5). Ein gewählter Modus, der nicht der Standard ist,
    gilt auch nach einem Wechsel der Ansicht im Fenster (**wechseln**, wo es fehlt, wie **nur markieren**); sonst gilt
    der Standard der neuen Ansicht.
- **Bedienung:** App: im Kopf des Fensters **Auswahl folgen: {Modus} ▾**.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:4b1373a7 src/windows/follow-mode.ts RECENTERING (family, descendants, fan), defaultFollowMode, followModesFor, effectiveFollowMode, followChoiceToStore (sessionStorage pro okno) · src/windows/window-selection.ts (origin, bez smyčky) · src/windows/sat-header.ts · strings.ts win.followSelectionState, followModeSwitch, followModeMark, followModeOff, followModeSwitchNote, followModeMarkNote, followSelectionOff · spec 079 K1.3, K2.1 · prace/1112-app-okna-sledovat (7bb1b8b2) -->

<a id="A6.8.2"></a>
### A6.8.2 Wenn das Hauptfenster fehlt

Ein Fenster ohne Hauptfenster verliert nichts, und nichts schließt sich von selbst. Es bleibt mit den letzten Daten
nur lesbar.

| Zustand | Was das Fenster zeigt | Auswahl |
|---|---|---|
| das Hauptfenster ist geschlossen (3 s ohne Nachricht von ihm) | Streifen „Das Hauptfenster ist geschlossen · Stand {Zeit}, nur lesen“; die Forschungseinträge im Menü der Person unter **Forschung · nur mit Hauptfenster** sind nicht nutzbar | **Strom öffnen**, **Zum Hauptfenster machen** |
| der Stammbaum wurde im Hauptfenster gelöscht | „Der Stammbaum existiert nicht mehr“ statt des Inhalts | **Fenster schließen** |
| der Stammbaum ist gesperrt | „Der Stammbaum ist gesperrt · Das Passwort wird im Hauptfenster eingegeben.“ | **Zum Hauptfenster** |
| das Hauptfenster hat den Stammbaum gewechselt | das Fenster wechselt mit, die Ansicht bleibt, die Auswahl wird aufgehoben („{Stammbaum} → {Stammbaum}“) | – |

- **Grenzen:**
  - **Strom öffnen** öffnet ein neues Hauptfenster; die Fenster verbinden sich damit, und der Streifen verschwindet;
  - **Zum Hauptfenster machen** macht dieses Fenster zum Hauptfenster: es lädt den Stammbaum aus dem Speicher (die
    Daten im Fenster können älter sein als die gespeicherten), bekommt die Leiste der App, und die Ansicht bleibt.
    Ist inzwischen ein anderes Hauptfenster entstanden, geschieht nichts;
  - Neuladen des Hauptfensters (F5) zeigt den Streifen nicht.
- **Bedienung:** App: die Schaltflächen im Streifen und anstelle des Fensterinhalts.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:4b1373a7 src/windows/satellite.ts MAIN_SILENCE_MS 3000, lastHeardAt, treeGone · src/windows/sat-states.ts (closed strip mainClosed, treeGone, treeLocked, SWITCHED_TOAST_MS) · src/windows/become-main.ts (zámek ifAvailable, znovunačtení jako hlavní z IndexedDB) · src/windows/window-research-menu.ts researchMainOnly · strings.ts win.mainClosed, openStrom, makeMain, treeGone, treeGoneNote, treeLocked, treeLockedNote, closeWindow, goToMain, treeSwitched · spec 079 K1.5 · prace/1112-app-okna-zaklad (stavy 1–6) -->

<a id="A6.8.3"></a>
### A6.8.3 Ein zweiter Tab der App

Die App, ein zweites Mal in einem gewöhnlichen Tab oder Fenster des Browsers geöffnet, lädt keine zweite Kopie des
Stammbaums. Sie zeigt „Strom ist bereits in einem anderen Fenster geöffnet“ mit der Erklärung „Nur ein Fenster
speichert, damit sich Änderungen nicht gegenseitig überschreiben. Weitere Fenster verbinden sich damit.“

- **Grenzen:**
  - **Dorthin wechseln** holt das Hauptfenster nach vorne. Lässt der Browser das nicht zu, sagt es der Tab und fügt
    „Dieser Tab kann geschlossen werden.“ hinzu;
  - **Als weiteres Fenster öffnen** macht aus dem Tab ein Fenster wie in [A6.8](#A6.8), mit der Tabelle;
  - ein im zweiten Tab geöffneter Link (Person, Suche, Links der Forschung, eine von der installierten App geöffnete
    Datei) geht genau einmal an das Hauptfenster: „Der Link wurde im Hauptfenster geöffnet.“;
  - der zweite Tab schreibt nichts in die Liste der Stammbäume und nichts in die Einstellungen.
- **Bedienung:** App: **Dorthin wechseln**, **Als weiteres Fenster öffnen**.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:4b1373a7 src/windows/window-role.ts (Web Lock strom-main ifAvailable → main, jinak second-tab) · src/windows/second-tab.ts (secondTabSatelliteKind table) · src/windows/window-link.ts (předání odkazu hlavnímu jednou) · src/windows/window-start.ts openLinkFromWindow · strings.ts win.alreadyOpen, alreadyOpenNote, switchThere, openAsWindow, switchFailed, tabCanClose, linkForwarded · CHANGELOG.cs.md 3.28.0 · spec 079 K1.6 · prace/1112-app-okna-zaklad (7d22e396) -->
