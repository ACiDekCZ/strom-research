<a id="S4"></a>
# S4 Forschung aus der App gesteuert

Was die App von der Forschung zeigt und was sich aus ihr in der Forschung starten lässt: laufende Arbeit,
Warteschlange, Linien und Aktionen, die die Forschung öffnen. Beschrieben werden die Strom-App 3.21.2 (und die
Forschung 1.25.2). Änderungen aus einer neueren Version tragen deren Nummer.

<a id="S4.1"></a>
## S4.1 Panel und Forschungsübersicht zeigen die laufende Arbeit

Beim Verfolgen einer Forschung ([S1](S1-connecting-app-and-research.md)) zeigt die App ein kleines Panel
**Live-Forschung aus Strom Research** und daraus die größere **Forschungsübersicht**. Beide lesen nur. Was sie
zeigen, sendet die Forschung über die Brücke.

- **Grenzen:**
  - Panel: **In Arbeit**, **Wartet auf Bearbeitung**, **Letzte Änderungen** (die 5 neuesten, Link **Alle Änderungen
    in der Übersicht ›**),
    **Als Nächstes** (3 Aufgaben) und darunter die Zahl der Sitzungen des Agenten in diesem Monat.
  - Ist das Panel höher als das Fenster, klappt sich zuerst **Als Nächstes** von selbst zu, dann die Änderungen,
    dann **In Arbeit**. **Wartet auf Bearbeitung**
    klappt sich nie von selbst zu. Ein Abschnitt, den der Mensch zu- oder aufgeklappt hat, bleibt, wie er ist.
  - Übersicht, Abschnitte in dieser Reihenfolge: Zusammenfassung (**Status**, letzte 24 h, **Diesen Monat** mit der
    Zahl der Sitzungen), **Jetzt**, **Wartet auf Bearbeitung** (nur wenn etwas wartet), **Richtungen**
    ([S4.3](#S4.3)), **Verlauf**, **Warteschlange** ([S4.2](#S4.2)), **Was die Forschung weiß**
    ([S3](S3-what-the-research-knows.md)). **Warteschlange** und **Was die Forschung weiß** sind anfangs zugeklappt.
  - **Verlauf** fasst Schritte in 15 Minuten zusammen und zeigt höchstens 20 Schritte.
  - Die Übersicht ist in einem breiten Fenster (ab 1280 px) ein Seitenpanel neben dem Stammbaum, auf dem Tablet eine
    Ebene über dem Stammbaum, auf dem Telefon der ganze Bildschirm. Auf dem Telefon wird das Panel zu einem Streifen,
    und ein Tippen öffnet die Übersicht.
  - Ohne Verfolgen zeigt das Panel das letzte bekannte **Wartet auf Bearbeitung** mit dem Satz **Stand …. Die
    Forschung läuft gerade nicht.**
- **Bedienung:** App: Panel, Schaltflächen **⤢ Übersicht öffnen** und **Verfolgung beenden**; Menü **Forschung →
  Forschungsübersicht**.
- **Gilt seit:** App 3.5.0
- **Ab App 3.22.0:** jeder Abschnitt lässt sich aufklappen, zuklappen oder ausblenden, und die Wahl gilt für das Panel
  und die Übersicht ([S4.1.2](#S4.1.2)). **Wartet auf Bearbeitung** klappt sich auch bei einem neuen Eintrag nicht
  von selbst auf.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:223 PANEL_CHANGES, :227 AUTO_FOLD, :3326 appendQueueSection(…, 3), renderLivePanel, renderIdleResearchPanel · src/ui/research-overview-ui.ts:5 (≥1280), :51 FOLDED_BY_DEFAULT, :53 GROUP_MS, :59 MAX_STEPS, :74, :309-311 · strings.ts live.overviewTitle, research.panelLabel, research.stop, research.atWork, research.queue -->

<a id="S4.1.1"></a>
### S4.1.1 Agenten im Stammbaum folgen

Der Stammbaum kann von selbst zu der Person wechseln, an der der Agent gerade arbeitet (die erste nicht pausierte
Arbeit im Abschnitt **Jetzt**).

- **Grenzen:** höchstens ein Wechsel in 8 s. Ist der Stammbaum weiter als auf 0,55 verkleinert, wird er auf 0,8
  vergrößert. Ein Verschieben des Stammbaums, die Wahl einer anderen Person oder eine andere Ansicht unterbricht das
  Folgen (**Zurück zum Agenten**); nach 20 s ohne Berührung kehrt es von selbst zurück. Die Auswahl wird für das Gerät
  gespeichert.
- **Bedienung:** App: **Forschungsübersicht → Agenten im Stammbaum folgen** / **Nicht mehr folgen**.
- **Gilt seit:** App 3.5.0
- **Ab App 3.24.0:** Folgen geht auch im Fächer und auf der Karte ([S4.1.3](#S4.1.3)); das Verschieben der Karte pausiert es ebenso.

<!-- zdroj: app:src/ui/live-follow-ui.ts:7, :26 ZOOM_FAR, :27 ZOOM_READABLE, :32 gap 8000 / idle 20_000 · strings.ts live.followOn, live.followOff -->

<a id="S4.1.2"></a>
### S4.1.2 Panel anpassen

Jeder Abschnitt der Verfolgung der Forschung hat eine Wahl: **Aufgeklappt**, **Eingeklappt** oder **Ausgeblendet**.
Die Wahl gilt für das Panel und die Übersicht.

- **Grenzen:**
  - Abschnitte: **In Arbeit** (in der Übersicht **Jetzt**), **Wartet auf Bearbeitung**, **Letzte Änderungen** (in der
    Übersicht **Verlauf**), **Als Nächstes** (in der Übersicht **Warteschlange**) und nur in der Übersicht
    **Richtungen** und **Was die Forschung weiß**;
  - ein Abschnitt ohne Wahl (**Standard**) erscheint wie bisher: das Panel klappt zu, was keinen Platz hat
    (**eingeklappt, kein Platz**), die Übersicht hat **Warteschlange** und **Was die Forschung weiß** zugeklappt.
    Einen Abschnitt mit Wahl klappt das Panel nicht von selbst zu;
  - ein Klick auf die Überschrift eines Abschnitts ist eine dauerhafte Wahl (aufklappen / zuklappen);
  - die Wahl wird auf diesem Gerät für alle Stammbäume gespeichert, nichts wird synchronisiert. Ein früheres
    Zuklappen von Abschnitten von Hand wird einmal übernommen;
  - **Standard wiederherstellen** hebt alle Wahlen auf. Das Wiederherstellen des Standards und das Ausblenden eines
    Abschnitts aus seinem Menü lassen sich eine Weile zurücknehmen (**Rückgängig**). Sind alle Abschnitte
    ausgeblendet, sagt das Panel **Alle Bereiche sind ausgeblendet.**
- **Wartet auf Bearbeitung eingeklappt oder ausgeblendet:**
  - ein neuer Eintrag klappt den Abschnitt nicht auf. Die Überschrift zeigt die Zahl und **N neu**; hervorgehoben,
    wenn darunter eine Entscheidung oder Erlaubnis ist (**darunter eine Entscheidung oder Erlaubnis**);
  - ausgeblendet hinterlässt er die Marke **Wartet N** im Kopf des Panels, in der Zusammenfassung des eingeklappten
    Panels, im Streifen auf dem Telefon und in der Übersicht. Ein Klick zeigt den Abschnitt in der Übersicht, bis die
    Übersicht geschlossen wird (**Ausgeblendeter Bereich, sichtbar bis die Übersicht schließt.**).
- **Bedienung:** App: **⋯ → Panel anpassen…** im Kopf des Panels und der Übersicht; rechte Maustaste oder langes
  Drücken auf die Überschrift eines Abschnitts (auch die Menütaste oder Umschalt+F10); **Einstellungen → Forschung
  verfolgen**. Auf dem Telefon als Blatt von unten.
- **Gilt seit:** App 3.22.0

<!-- zdroj: app:src/ui/live-section-prefs.ts SECTION_PREFS_KEY, PREF_KEYS, OVERVIEW_KEYS, OLD_PANEL_KEY · src/ui/live-section-edit.ts · src/ui/live-section-edit-ui.ts · src/ui/research-ui.ts:282 waitingHeadInfo, :312 waitingChip, :3180 toggle, :3215 resetLiveSections, :3225 hideLiveSection · src/ui/research-overview-ui.ts:376 shownOnce · strings.ts live.editPanel(Menu), sectionExpanded/Collapsed/Hidden/Default, resetDefaults, autoFoldedNote, allHidden, waitingShort, importantHint, shownOnce, settings groupResearchFollow · commity c4b1dcc, a56232a · spec 044 K1–K5 -->

<a id="S4.1.3"></a>
### S4.1.3 Folgen im Fächer und auf der Karte

Das Folgen des Agenten ([S4.1.1](#S4.1.1)) läuft in der Familie, im Fächer und auf der Karte. Der Umschalter
**Folgen in** wechselt die Ansicht, und das Folgen bleibt eingeschaltet. Der Fächer bewegt sich dabei nicht, er
markiert nur, wo gearbeitet wird; die Karte zeigt den Ort der Arbeit mit einem Ring.

- **Fächer:**
  - die Mitte des Fächers ist die **Fokussierte Person** vor dem Einschalten des Folgens (Standard), die
    **Standardperson** oder eine **Gewählte Person** (für einen Stammbaum). Nie ist es die Person, an der der Agent
    arbeitet. **Als Mitte fixieren** hält eine Person als Mitte, **Mitte lösen** gibt sie frei; eine neue Mitte blendet
    in 150 ms über;
  - die bearbeitete Person hat einen Umriss in der Farbe der Sitzung und blinkt zweimal, wenn die Arbeit wechselt und
    wenn das Folgen in den Fächer kommt. Ein schmaler Sektor bekommt eine Marke außerhalb des Fächers;
  - eine Person außerhalb des Fächers bekommt das Schild **Außerhalb des Fächers in Bearbeitung:** bei der nächsten
    Person des Fächers, in dieser Reihenfolge: Ehemann oder Ehefrau, Geschwister, ein Vorfahr jenseits des Fächerrands,
    bei einem Nachkommen die Mitte, sonst der erste Vorfahr bis zu 12 Generationen zurück.
- **Karte:**
  - der Ort der Arbeit hat einen Ring in der Farbe der Sitzung: ein voller Ring ist der **Ort des Eintrags** (der Ort
    der Quelle, an der der Agent arbeitet, wenn die Forschung ihn sendet), ein gestrichelter der **Ort der Person** (der
    erste Ort mit Position aus Geburt, Wohnort, Heirat, Tod). Nie ist es der Sitz eines Archivs;
  - der Ring pulsiert einmal, wenn das Folgen auf die Karte kommt. Die Karte verschiebt sich nur, wenn der Ort der
    ersten Sitzung außerhalb der Ansicht liegt und die Karte nicht pausiert ist. Verschieben von Hand pausiert sie
    (**Kartenschwenk pausiert**) bis **Zurück zum Agenten**;
  - ein Ort ohne Position zeigt oben die Zeile „… – ohne Position auf der Karte“ mit **Position suchen** (bei einem
    Stammbaum mit Forschung **In der Forschung suchen**, [A6.5.2](A6-views.md#A6.5.2)); eine Person ohne Ort „… – ohne
    Ort“;
  - die Legende **Bedeutung der Markierungen** erklärt die Ringe, die Spur und die hohle Markierung.
- **Sitzungsspur:** in der Familie, im Fächer und auf der Karte verblassen die bearbeiteten Personen und Orte mit dem
  Alter: höchstens die letzten 8 Änderungen, keine älter als 60 Minuten. Auf der Karte sind es leere Ringe, die Orte
  einer Sitzung verbindet eine gepunktete Linie (nicht auf dem Telefon). Die Spur lässt sich ausschalten.
- **Grenzen:**
  - laufen mehrere Sitzungen, hat jede eine Nummer (sichtbar ab zwei) und eine Farbe: die erste die Hauptfarbe, die
    weiteren eine Akzentfarbe;
  - Arbeit an einer Heirat wird beim Paar verfolgt: fokussiert ist der Ehemann, sonst die Ehefrau;
  - die Einstellungen gelten auf diesem Gerät für alle Stammbäume, die gewählte Person nur für ihren Stammbaum. Auf dem
    Telefon ist die Darstellung vereinfacht.
- **Bedienung:** App: beim Folgen **Folgen in** (Familie, Fächer, Karte); **Einstellungen → Forschung verfolgen** →
  **Dem Agenten folgen in** (gilt beim Einschalten des Folgens und bei **Zurück zum Agenten**), **Fächermitte beim
  Folgen** (**Person wählen**, **Ändern**), **Sitzungsspur in Familie, Fächer und Karte**; im Fächer **Als Mitte
  fixieren** / **Mitte lösen**.
- **Gilt seit:** App 3.24.0
- **Ab App 3.25.0:** die Legende der Karte sagt „Hohle Markierung: Ort ohne Person unter den gezeigten Orten“ und ein
  Ort der Arbeit ohne Person auf der Karte „noch ohne Person auf der Karte“ (früher „außerhalb des Kartenbereichs“).

<!-- zdroj: app:src/ui/live-follow-ui.ts (hlavička, followIn) · src/live-follow-prefs.ts · src/live-follow-targets.ts TRAIL_MAX=8, TRAIL_MAX_AGE_MS=60 min, fanCenter, sessionNumbers, sessionTone · src/live-follow-map.ts · src/fan-follow-anchor.ts MAX_UP=12 · src/ui/fan-follow-ui.ts · src/ui/map-follow-ui.ts PAN_MARGIN=64, PAN_MS=400, telefon bez čáry · strings.ts settings.groupResearchFollow, researchFollowNote, followView(Help), followFanCenter*, followTrail(Help); live.followIn, mapPaused, legendTitle, legendTrail, legendRecord, legendPerson, legendOut; fan.pin, unpin, centerLabel, workOutside; map workRecord, workPerson, outScope, noCoords, noPlace, locate · CHANGELOG.cs.md 3.24.0, 3.25.0 · spec 043 -->

<a id="S4.1.4"></a>
### S4.1.4 Änderungen aus der Forschung ohne Flackern

Eine Änderung aus der Forschung erscheint im Stammbaum sofort, ohne den ganzen Bildschirm neu zu zeichnen. Karten,
die bleiben, behalten ihren Platz; was hinzukam, wegfiel oder sich änderte, zeigt sich kurz mit Bewegung.

- **Grenzen:**
  - bleibende Karten verschieben sich fließend (320 ms). Eine neue Person wächst aus ihrer Linie, und ein Licht läuft
    die Linie entlang; eine entfernte zieht sich in ihre Linie zurück; eine zusammengeführte Person fließt in die, die
    bleibt (nach gleichem Nachnamen, Geburt ±1 Jahr, gemeinsamem Elternteil oder Partner); eine geänderte Karte hat
    einen Umriss in der Farbe der Sitzung;
  - mit Bewegung zeigen sich höchstens 12 neue Karten; bei mehr als 60 geänderten Personen entfällt die Bewegung, und
    die Änderungen erscheinen sofort. Auf Telefon und Tablet sind die Zeiten kürzer (×0,875);
  - eine neue Person außerhalb der Ansicht bekommt eine Marke am Rand („Außerhalb der Ansicht hinzugefügt: …“, 4 s).
    Zoom und fokussierte Person ändern sich nicht. Ein Bildschirmleser kündigt die Änderungen an;
  - ausgeschaltete **Bewegung beim Laden von Änderungen** und reduzierte Bewegung im System zeigen die Änderungen
    sofort, nur hervorgehoben („Im System ist reduzierte Bewegung aktiv, Änderungen erscheinen daher ohne
    Bewegung.“).
- **Bedienung:** App: **Einstellungen → Forschung verfolgen → Bewegung beim Laden von Änderungen** (standardmäßig an).
- **Gilt seit:** App 3.24.0

<!-- zdroj: app:src/live-transition.ts LIVE (move 320 ms, maxAnimatedNew=12, maxChangedForScene=60, ×0.875 touch), src/live-diff.ts (merge guess: surname, birth ±1, parent/partner) · strings.ts settings.liveMotion, liveMotionHelp, liveMotionReduced, edgeAdded · CHANGELOG.cs.md 3.24.0 · spec 055 -->

<a id="S4.2"></a>
## S4.2 Warteschlange in der App

Die App zeigt den Anfang der Warteschlange der Forschung in der Reihenfolge, in der der Agent sie abarbeitet
([R2.2](R2-lines-and-queue.md#R2.2)). Die ganze Warteschlange bleibt in der Forschung.

- **Grenzen:**
  - Das Panel zeigt 3 Aufgaben (**Als Nächstes**), die Übersicht 20 (**Warteschlange**). Den Rest zeigt die Zeile
    **und N weitere in der Forschung**, die die Forschung öffnet.
  - Mit zwei und mehr laufenden Linien lassen sich Aufgaben nach Linie filtern (**Warteschlange nach Richtung**).
  - Eine Aufgabe außerhalb der Linien hat eine Notiz: **Wartet, bis die Arbeit der Richtungen getan ist · hilft
    keiner Richtung**, **Wird nicht übernommen · Arbeit außerhalb der Richtungen ist ausgeschaltet** oder warum sie
    einer Linie hilft (**Hilft der Richtung: eine Frage der Richtung**, **Hilft der Richtung: verbindet Personen mit
    dem Baum**, **Hilft der Richtung, wie der Agent angibt**). Die Regeln stehen in
    [R2.3](R2-lines-and-queue.md#R2.3).
  - Menü der Aufgabe **Aufgabenoptionen**: **Zurückstellen** und **Aufgeben**; bei einer zurückgestellten Aufgabe
    **Fortsetzen**. Jede davon öffnet das Terminal der Forschung, und dort wird bestätigt ([S4.5](#S4.5)).
- **Bedienung:** App: Panel, Abschnitt **Als Nächstes**; **Forschungsübersicht**, Abschnitt **Warteschlange**; bei
  der Aufgabe **⋯**.
- **Gilt seit:** App 3.5.0. Notizen bei Aufgaben außerhalb der Linien seit 3.21.0 (Forschung 1.25.0).
- **Ab App 3.22.0:** mit der Forschung 1.26.0 hat jede Aufgabe eine Zeile, warum sie steht, wo sie steht
  ([R2.4](R2-lines-and-queue.md#R2.4)).
  **Als Nächstes** und **Ans Ende** (und **Auf Standard zurücksetzen**) ändern den Platz der Aufgabe direkt aus der
  App, ohne Terminal ([R2.3.1](R2-lines-and-queue.md#R2.3.1)); bei einer Aufgabe, an der der Agent arbeitet, geht
  das nicht. Die Warteschlange wird seitenweise gelesen: **Weitere laden** fügt 50 Aufgaben hinzu, die Liste hält
  höchstens 300, den Rest grenzt der Filter einer Linie oder eines Zweigs ein.
  Die Marke des Zweigs (**Zweig … K**) grenzt die ganze Warteschlange auf die Aufgaben des Zweigs ein; **Ganze
  Warteschlange zeigen** hebt sie auf.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:308 queueNoteText, :3373 appendQueueSection · research-overview-ui.ts:311 (20) · strings.ts research.queue, research.park/drop/wake, research.queueMore, research.queueOffLast, research.queueOffNever, research.queueHelps · HEAD src/research-queue-pages.ts:19 QUEUE_PAGE, :28 QUEUE_ROWS_CAP · src/ui/research-ui.ts:3884 taskDoNext/taskDoLast · strings.ts live.taskDoing, live.queueLoadMore, live.queueCapNote, live.branchQueueChip, live.branchQueueChipClear -->

<a id="S4.3"></a>
## S4.3 Linien in der App

Die Übersicht zeigt die Linien der Forschung ([R2.1](R2-lines-and-queue.md#R2.1)): was auf welche wartet und wie weit
sie gekommen ist. In App 3.21.2 werden Linien nur gelesen; jede Änderung wird im Terminal der Forschung bestätigt.

- **Grenzen:**
  - Den Abschnitt **Richtungen · N aktiv** gibt es nur bei zwei und mehr Linien oder bei einer Linie, wenn auch
    Arbeit außerhalb von ihr läuft (Zeile **Außerhalb der Richtungen**). Pausierte und beendete Linien sind unter
    **Pausiert und beendet · N** zugeklappt.
  - Zeile einer Linie: Art (↑ Vorfahren, ↓ Nachkommen, ⌕ Frage), Name, Person, Zahl der Aufgaben und was auf
    Bearbeitung wartet. Eine Linie ohne Arbeit hat **Nichts offen, sie kann beendet werden.**
  - Detail einer Linie: bekannte Vorfahren nach Generationen, wann zuletzt an ihr gearbeitet wurde, **An dieser
    Richtung arbeiten** (Gespräch mit dem Agenten, nicht im Strom-Archiv) und **Im Stammbaum zeigen**.
  - Menü **Aktionen der Richtung**: **Pausieren**, **Beenden**, **Neu starten**. Jede öffnet das Terminal, das sagt,
    was geschieht,
    und nach dem Grund fragt ([R2.1.2](R2-lines-and-queue.md#R2.1.2)).
  - Auf dem Telefon fehlt das Menü: **Nichts offen · beenden in der Forschung am Computer**.
  - Mit zwei und mehr Linien teilt das Panel die Arbeit nach Linien, und eine Linie lässt sich wählen; nach ihr wird
    die Warteschlange gefiltert.
- **Bedienung:** App: **Forschungsübersicht → Richtungen**, bei der Linie **⋯**.
- **Gilt seit:** App 3.5.0 (Forschung 1.8.0). Teilung des Panels nach Linien seit 3.13.1.
- **Ab App 3.22.0:** mit der Forschung 1.26.0 werden Linien direkt in der App geändert ([S4.3.1](#S4.3.1)). Die
  Zeile einer Linie zeigt, woran gerade gearbeitet wird (**Jetzt: …**), und die Grenzen (**bis N Generationen**,
  **vor …** (Jahr); bei einer pausierten Linie nicht). Das Detail einer Linie sagt, was die Linie in den letzten Tagen
  gefunden hat (**Letzte N Tage:** Sitzungen, Personen, Quellen); die Personen zeigt es im Stammbaum. Beendete
  Linien sind am Ende zugeklappt (**Beendet · N**). In einem schmalen Fenster und auf dem Telefon ist die Übersicht
  ein Blatt: statt des Griffs für die Reihenfolge Pfeile ▲▼.

<!-- zdroj: app:v3.21.2 src/ui/research-directions-ui.ts:156 linesMulti, :350-353 appendOverviewDirections, :385 canDo, :528 dirWork · strings.ts live.dirTitle, live.dirOutside, live.dirInactive, live.dirWork · research:v1.25.2 assets/lang/cs.json ui.link.what.direction.pause/done/resume · 3.22.0: research-directions-ui.ts:703 dirEnded, :852 dirNow, :878 dirFoundIn, :720 sheet; strings.ts live.dirLimitGen, dirLimitBefore, dirFound* -->

<a id="S4.3.1"></a>
### S4.3.1 Verwaltung der Linien aus der App

Mit einer Forschung, die das kann, schreibt die App Änderungen der Linien direkt über die Brücke. Das Terminal öffnet
sich nicht, und nichts wird bezahlt.

- **Grenzen:**
  - **+ Neue Richtung** (Formular **Neue Richtung**: **Art** Vorfahren / Nachkommen / Frage, **Person**, **Frage**,
    **Name**, **Begrenzen…**). Das Anlegen kostet nichts, und der Agent beginnt mit der Linie beim nächsten Lauf. Eine
    neue Linie kommt ans Ende der Reihenfolge.
  - **Bearbeiten**: Art und Person lassen sich nicht ändern (eine andere Person = eine neue Linie). Die Änderung gilt
    ab der nächsten Wahl einer Aufgabe.
  - Reihenfolge der Linien: durch Ziehen, mit Pfeilen oder **An den Anfang**. Unter der Liste steht, wie die
    Forschung die Reihenfolge nimmt: **Die Forschung widmet sich am meisten den oberen Richtungen; die anderen laufen
    weiter.** oder **Die Forschung nimmt die Richtungen der Reihe nach.**
  - **Pausieren** und **Neu starten** lassen sich zurücknehmen (**Rückgängig**). **Beenden…** fragt nach und nimmt
    einen freiwilligen Grund.
  - Gibt es dieselbe Linie schon, sagt das Formular das (**Die Richtung … läuft bereits.**) und bietet **Anzeigen**
    oder **Trotzdem anlegen** an.
  - **Vorfahren suchen** und **Nachkommen suchen** bei einer Person öffnen dieses Formular.
  - Nur zum Lesen: im Strom-Archiv (**Archiv: Richtungen nur zum Lesen.**), auf dem Telefon (**Richtungen lassen
    sich in Strom auf dem Computer ändern, auf dem die Forschung läuft.**) und wenn die Forschung nicht läuft (**Die
    Forschung läuft nicht. Richtungen lassen sich ändern, sobald sie läuft.**).
  - Forschung älter als 1.26.0: die Aktionen bleiben im Terminal (**Die Forschung steuert Richtungen aus der App ab
    Version 1.26.0.**).
  - Lehnt die Forschung das Schreiben ab (zum Beispiel weil sie beschäftigt ist), ändert die App nichts und bietet
    **Erneut versuchen** an.
- **Bedienung:** App: **Forschungsübersicht → Richtungen**, **+ Neue Richtung**, bei der Linie **⋯**; Menü der
  Person **Forschung ›**.
- **Gilt seit:** App 3.22.0 (Forschung 1.26.0)

<!-- zdroj: app:HEAD src/ui/research-directions-ui.ts:372 DIRECTIONS_WRITE_SINCE, :628 · src/research-directions-write.ts createDirection, editDirection, setDirectionState, writeDirectionOrder · src/ui/research-actions-ui.ts:1015-1024, :1067 openDirectionForm · strings.ts live.dirNew, dirFormNew, dirFree, dirEditFree, dirLocked, dirOrderWeight, dirOrderStrict, dirArchive, dirPhoneOnly, dirBridgeDown, dirOldResearch, dirBusy, dirRetry, dirDupActive, dirShowIt, dirAnyway · research:src/core/live.ts /directions -->

<a id="S4.3.2"></a>
### S4.3.2 Arbeit außerhalb der Linien nach Zweigen

Bei zwei und mehr Linien zeigt die Übersicht die Arbeit außerhalb der Linien nach Zweigen. Die Optionen aus
[R2.3](R2-lines-and-queue.md#R2.3) und [R2.3.1](R2-lines-and-queue.md#R2.3.1) lassen sich direkt aus der App
einstellen.

- **Grenzen:**
  - Für die ganze Forschung: **Wie Arbeit außerhalb der Richtungen übernommen wird**: **Ab und zu**, **Am Ende**,
    **Wie üblich**, **Nie**.
  - Zeile eines Zweigs: Person des Zweigs, Bezug zur Linie (**bei der Richtung …**), Zahl der Aufgaben, **wächst**,
    **eigene Wahl**.
  - Ein Klick auf einen Zweig zeigt seine ersten Aufgaben mit dem Platz in der Warteschlange (**In der Warteschlange ·
    die ersten K von N**, **I. in der Warteschlange**) und den Link **Alle N Aufgaben in der Warteschlange
    ›**. Stehen die Aufgaben des Zweigs hinter dem geladenen Teil der Warteschlange: **Die Aufgaben des Zweigs stehen
    weiter hinten in der Warteschlange (N).**
  - Für einen Zweig: **Übernommen:** **Ab und zu** / **Am Ende** / **Wie üblich** (die Wahl der Forschung hat
    **(Standard)**), **Zur Richtung … hinzufügen** (die nächste Linie zuerst), **Richtung aus diesem Zweig
    anlegen**, **Nicht erforschen** (die Aufgaben verlassen die Warteschlange, nichts wird gelöscht), **Auf Standard
    zurücksetzen**. Nicht erforschte Zweige stehen beisammen (**Nicht erforscht · N Zweige**).
  - Fragen zu wachsenden Zweigen ([R2.3.2](R2-lines-and-queue.md#R2.3.2)) stehen in **Wartet auf Bearbeitung**:
    einer Linie hinzufügen (bei einer pausierten Linie **Zur Richtung … (pausiert) hinzufügen**), eine Linie
    anlegen, **So lassen**, nicht erforschen. Ohne Antwort wird der Zweig weiter wie bisher übernommen.
  - Fenster **Forschung für diesen Stammbaum…**, Gruppe **Arbeit außerhalb der Richtungen**: die Wahl für die ganze
    Forschung (**Ab und zu**: „Etwa 1 Aufgabe außerhalb der Richtungen auf K Aufgaben der Richtungen.“),
    **Richtungen für wachsende Zweige vorschlagen**, **Zweige mit eigener Wahl** und Aufgaben mit manueller
    Reihenfolge.
- **Bedienung:** App: **Forschungsübersicht**, Abschnitt der Arbeit außerhalb der Linien, beim Zweig **⋯** (**Optionen
  des Zweigs**); **Forschung für diesen Stammbaum…**.
- **Gilt seit:** App 3.22.0 (Forschung 1.26.0)

<!-- zdroj: app:HEAD src/ui/research-offline-ui.ts:3, :104 (caps.offLineBranches, ≥2 linie) · src/research-directions-write.ts setBranchMode, setOffLineTree, answerBranchWaiting · strings.ts live.offModeLink, live.offModeCap, live.branchAddPick, live.branchCreate, live.branchNever, live.branchReset · research-offline-ui.ts:202-228 growingBranchLine, :542 branch choices, :680 branchQueueBeyond, :740 pick · strings.ts live.dirNear, branchGrows, branchOwnChoice, branchQueueHead, branchQueuePos, branchAllTasks, branchTaken, branchDefaultTag, branchAdd(Paused), branchNeverGroup, waitBranchLeave, waitBranchHint, setOutTitle, setOutOcc, setSuggest, setOwnChoice, setManualTasks, menu treeSettings · spec 038 K7 -->

<a id="S4.4"></a>
## S4.4 Wartet auf Bearbeitung in der App

Panel und Übersicht zeigen dieselbe Liste wie die Forschung ([R6.1](R6-awaiting-action.md#R6.1)). Was sich in der App
erledigen lässt und was nur in der Forschung, sagt [R6.5](R6-awaiting-action.md#R6.5).

- **Grenzen:** unter der Liste steht, wo geantwortet wird: **Geantwortet wird in der Forschung. Der Stammbaum
  aktualisiert sich danach selbst.**, bei Fragen zu Orten **Fragen zu Orten werden hier beantwortet.**, bei beidem
  **Fragen zu Orten werden hier beantwortet, die übrigen in der Forschung.** Einträge nur für das Terminal bekommt die
  App nicht ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
- **Bedienung:** App: Panel, Abschnitt **Wartet auf Bearbeitung**; Menü **Forschung → Wartet auf Bearbeitung**.
- **Gilt seit:** App 3.4.0. Fragen zu Orten seit Forschung 1.25.0.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts renderLivePanel (waiting) · strings.ts research.answerWhere, research.answerHere, research.answerMixed -->

<a id="S4.5"></a>
## S4.5 Aktionen, die die Forschung öffnen

Die meisten Aktionen der Forschung in der App sind ein Link `strom-research://`. Der Link öffnet das Terminal der
Forschung auf demselben Computer. Das Terminal sagt, worum die App bittet, und fragt nach. Ohne Bestätigung im
Terminal wird nichts geschrieben und nichts bezahlt.

- **Grenzen:**
  - Eine Aktion ist nur am Computer zu sehen (nicht auf einem Touch-Gerät), nur wenn die Forschung den Link gemeldet
    hat und nur wenn **Strom Research auf diesem Computer** eingeschaltet ist.
  - Der Link trägt nur Nummern von Datensätzen und feste Werte, keine Namen und keinen freien Text.
  - Das Terminal beginnt mit **Die Strom-App bittet um: … / Forschung: …** und fragt **Fortfahren?** Bei
    Arbeit des Agenten fügt es **Der Agent arbeitet auf das eigene Abonnement oder KI-Guthaben.** hinzu, bei der
    Vergabe von Aufgaben **Die Forschung schreibt Aufgaben für den Agenten – jetzt wird nichts gesucht und nichts
    bezahlt.**
  - Das Strom-Archiv und eine Forschung, die auf einen Agenten wartet, lehnen Arbeit des Agenten ab (Gespräch,
    Prüfung, Suche, Orte, Geschichte).
  - Gibt es dieselbe aktive Linie schon, sagt **Vorfahren suchen** nur **Diese Forschung gibt es schon: „…“ –
    der Agent arbeitet daran weiter.**
  - Die App erkennt nicht, ob sich das Terminal geöffnet hat. Sie zeigt **Forschung wird geöffnet…** und den Rat
    **Wenn sich nichts öffnet, Strom Research starten und erneut versuchen.**
- **Bedienung:** App: **Einstellungen → Daten und Datenschutz → Strom Research auf diesem Computer**.
- **Gilt seit:** App 3.4.0 (Forschung 1.6.0). Ablehnung im Strom-Archiv seit Forschung 1.14.0, beim Warten auf einen
  Agenten seit 1.15.0.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts researchLinkAvailable, launchResearchLink, :841 onComputer · strings.ts research.linksSetting, research.openingQuietHint · index.html linksSetting · research:v1.25.2 src/commands/links.ts:128 refusedHere, :153 inTerminal, :351 ui.research.exists · src/core/links.ts (hlavička) · assets/lang/cs.json ui.link.asks, ui.link.go, ui.link.cost, ui.link.tasks, ui.archive.refuse, ui.waiting.refuse -->

<a id="S4.5.1"></a>
### S4.5.1 Marken der Aktionen

Jede Aktion der Forschung hat eine von drei Marken, je nachdem, was sie öffnet.

| Marke | Was geschieht | Aktionen |
|---|---|---|
| ohne Marke | nichts öffnet das Terminal | **Live verfolgen**, Ausschnitt und Original im Betrachter, Laden des Stammbaums |
| Terminal | das Terminal zeigt etwas oder fragt; durch den Klick wird nichts bezahlt | **Forschung öffnen**, Senden von Änderungen, **Erneut prüfen…**, **Vorfahren suchen**, **Zurückstellen**, **Aufgeben**, Aktionen der Linie, **Abschließen und beenden**, **Letztes Senden zurücknehmen**, Einstellungen, **Forschung prüfen** |
| KI und Terminal | Arbeit des Agenten, bezahlt vom KI-Abonnement | **Mit dem Agenten weitermachen**, **Den Agenten fragen**, **An dieser Richtung arbeiten**, Gespräch zu einer Aufgabe oder einem Widerspruch, Forschung zu Orten, Geschichte eines Ortes |

- **Grenzen:** bei Arbeit des Agenten zeigt die App beim Öffnen **Agent wird geöffnet…** und **Dem Agenten
  schreiben, was herausgefunden werden soll. Seine Arbeit nutzt das eigene KI-Abo.** Ein Gespräch kann statt des
  Terminals die App des Agenten öffnen, wenn die Forschung so eingestellt ist.
- **Gilt seit:** App 3.21.0

<!-- zdroj: app:v3.21.2 src/research-link.ts:66 RESEARCH_LINK_MARKS, researchLinkMark (task do=chat, conflict do=agent, experiment do=off, fixes paid) · strings.ts research.openingAgent, research.openingAgentHint · research:v1.25.2 src/commands/links.ts:373 whereToTalk -->

<a id="S4.5.2"></a>
### S4.5.2 Wo die Aktionen sind

- **Menü Forschung** (nur am Computer, nicht bei einem gesperrten Stammbaum): oben höchstens 6 Einträge: **Wartet auf
  Bearbeitung**, **Mit dem Agenten weitermachen**, **Forschungsübersicht** oder **Live verfolgen**, **Forschung
  öffnen**, Senden von Änderungen. Darunter **Neue Version laden**, **Forschungswerkzeuge**, **Letztes Senden
  zurücknehmen** (höchstens 7 Tage alt) und die Einstellungen der Forschung. Unten steht **geht in der Forschung auf
  diesem Computer weiter. Ohne Bestätigung dort wird nichts geschrieben oder bezahlt.**
- **Forschungswerkzeuge**: Gruppen **Ansehen**, **Arbeit vergeben**, **Agent starten**. In 3.21.2 steht darin nur
  **Forschung prüfen**.
- Menü der Person **Forschung ›** (nur bei einer Person, die die Forschung kennt): **Erneut prüfen…** (Fenster mit dem
  Umfang: nur die Person, mit Familie,
  mit Vorfahren; **Geht im Terminal der Forschung weiter, wo die Aufgaben zu sehen und zu bestätigen sind.
  Kostenlos.**), **Vorfahren suchen**, **Nachkommen suchen**, **Den Agenten fragen**.
- **Forschungsübersicht → Jetzt**: bei einem arbeitenden Agenten **Abschließen und beenden**
  ([R7.3](R7-when-the-agent-works.md#R7.3)).
- Im Strom-Archiv fehlt alles, was einen Agenten braucht, auch **Live verfolgen**.
- **Gilt seit:** App 3.4.0; die oberen 6 Einträge seit 3.14.0, **Forschungswerkzeuge** seit 3.19.0, **Abschließen
  und beenden** seit 3.5.0

<!-- zdroj: app:v3.21.2 src/ui/research-actions-ui.ts:152 UNDO_MAX_AGE_MS, :158 FIRST_LEVEL_MAX, :300 researchMenuShown, :435 tools, :1000 personResearchActions · src/research-link.ts:115 RESEARCH_TOOL_GROUPS, :132 RESEARCH_TOOL_ACTIONS · research-overview-ui.ts:811, :870 finishSession · strings.ts research.footerFull, research.tools.*, research.reviewWhere, research.continueAgent -->

<a id="S4.6"></a>
## S4.6 Was nur im Terminal geht

Die App zeigt und bittet, das Terminal entscheidet. Was die Zustimmung des Menschen braucht oder Geld kostet, wird
immer im Terminal der Forschung bestätigt, auch wenn es mit einem Klick in der App beginnt.

- **Grenzen:**
  - Nur im Terminal: der Start selbstständiger Arbeit des Agenten und ihre Grenzen
    ([R7.1](R7-when-the-agent-works.md#R7.1)), die Bedingung, die Wahl des Agenten, die Einstellungen der
    Warteschlange und die Einträge **Nur hier im Terminal** ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
  - Im Terminal bestätigt werden: alles mit der Marke Terminal oder KI ([S4.5.1](#S4.5.1)), in 3.21.2 auch Aktionen
    der Linien und der Warteschlange.
  - Auf dem Telefon gibt es keine Links; geantwortet wird in der Forschung am Computer ([S5](S5-phone.md)).
- **Gilt seit:** App 3.4.0 (Forschung 1.6.0)
- **Ab App 3.22.0:** mit der Forschung 1.26.0 gehen ohne Terminal die Linien ([S4.3.1](#S4.3.1)), die Arbeit
  außerhalb der Linien nach Zweigen
  ([S4.3.2](#S4.3.2)) und der Platz einer Aufgabe in der Warteschlange ([S4.2](#S4.2)).

<!-- zdroj: research:v1.25.2 src/core/links.ts (hlavička: nic se nezapíše bez slova člověka v terminálu) · src/core/live.ts (hlavička mostu) · app:v3.21.2 src/research-link.ts:66 · HEAD src/research-directions-write.ts -->
