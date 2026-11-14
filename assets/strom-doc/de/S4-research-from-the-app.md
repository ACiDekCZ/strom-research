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
- **Ab App 3.27.0:** mit Forschung 1.31.0 zeigt die Zeile in **Jetzt** bei einer Aufgabe, die zu keiner Richtung
  gehört, warum an ihr gearbeitet wird: bei einer Aufgabe, die einer Richtung nur hilft, welcher und wie („hilft der
  Richtung Vorfahren: Jan Horák · verbindet Personen mit dem Baum“; außerdem „eine Frage der Richtung“, „wie der
  Agent angibt“, „Ehepartner eines Vorfahren“, „Zweig …“), bei einer Aufgabe außerhalb der Richtungen ihren Zweig
  („außerhalb der Richtungen · Zweig Josef Horák“, unter der Überschrift **Außerhalb der Richtungen** nur „Zweig
  Josef Horák“). Was einer Richtung hilft, steht in [R2.3](R2-lines-and-queue.md#R2.3). Die Zeilen **In Arbeit** im
  kleinen Panel sagen es genauso; unter der Überschrift einer Richtung nur wie, ohne ihren Namen.
- **Ab App 3.27.0:** die **Forschungsübersicht** öffnet sich auch ohne Verfolgen ([S4.1.5](#S4.1.5)): im Menü
  **Forschung** steht sie immer an erster Stelle, an zweiter **Live verfolgen**, beim Verfolgen an seiner Stelle
  **Verfolgung beenden**; im Strom-Archiv gibt es **Live verfolgen** nicht. Aus dem **Stammbaum-Überblick** öffnet sie
  **Forschung ›** im Kopf von **Worauf achten**. Die Schaltfläche **⤢ Übersicht öffnen** im kleinen Panel gibt es nur
  beim Verfolgen.
  - Die Zusammenfassung zeigt nur eingeschaltete Teile ([S4.1.2](#S4.1.2)): **Letzte 24 Std.** Personen und Quellen,
    **Diesen Monat** die Zahl der Sitzungen. Die Kosten (Betrag und Leser der Scans) zeigt sie erst nach dem
    Einschalten, sonst auch nicht im Text beim Überfahren mit der Maus. Unter dem kleinen Panel steht „Agent diesen
    Monat: 4 Sitzungen“, der Betrag, beides oder nichts.
  - In der Zeile einer Richtung im Abschnitt **Richtungen** steht bei der Arbeit nur „wird bearbeitet“, wenn der
    Abschnitt **Jetzt** sichtbar ist (aufgeklappt oder eingeklappt); das ganze „Jetzt: …“ steht im Text beim
    Überfahren mit der Maus. Bei ausgeblendetem **Jetzt** sagt die Zeile „Jetzt: …“ ganz.
- **Ab App 3.28.0:** am Computer öffnet sich die Übersicht auch in einem eigenen Fenster ([S4.1.6](#S4.1.6)).
- **Ab App 3.28.0:** das kleine Panel merkt sich auf diesem Gerät, ob es eingeklappt ist: eine Wahl für alle
  Forschungen, standardmäßig ausgeklappt. Neuladen der Seite, neues Verfolgen und das Panel einer anderen Forschung
  übernehmen sie; schreiben kann sie nur der Pfeil des Panels. Eine offene Übersicht klappt das Panel hinter sich
  nicht mehr aus. Das Telefon liest und schreibt die Wahl nicht (der Streifen öffnet die Übersicht wie bisher). Ohne
  Speicher des Browsers (privates Fenster) gilt sie, bis die Seite geschlossen wird.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:223 PANEL_CHANGES, (3.28.0: app 8da3f11e MINI_OPEN_KEY strom-research-mini-open, miniPanelFolded, rememberMiniPanelFolded, ne na telefonu; otevřený Přehled panel nerozbalí), :227 AUTO_FOLD, :3326 appendQueueSection(…, 3), renderLivePanel, renderIdleResearchPanel · src/ui/research-overview-ui.ts:5 (≥1280), :51 FOLDED_BY_DEFAULT, :53 GROUP_MS, :59 MAX_STEPS, :74, :309-311 · strings.ts live.overviewTitle, research.panelLabel, research.stop, research.atWork, research.queue · 3.27.0 Teď: app 4e4f6d8c src/research-link.ts WORKING_HELPS_FEATURE (working.helps), sanitizeWorking (helps jen s linií, branch) · src/ui/research-offline-ui.ts workingWhyText (helps → qWhyHelps + qWhyHow / qWhyHowBranch; větev mimo linie → qWhyOutBranch, ve skupině qWhyHowBranch) · src/ui/research-overview-ui.ts (Teď: důvod místo názvu linie) · strings.ts live.qWhyHelps, qWhyHow.*, qWhyHowBranch, qWhyOutBranch · spec 036 K1.8 · malý panel: app 2c018779 src/ui/research-ui.ts, research-directions-ui.ts (pod nadpisem linie jen jak) · 3.27.0 spec 057: app f05fff8e src/ui/research-actions-ui.ts overviewRows (research-item-overview první; stop při sledování, jinak followLive, ne bez agenta), src/ui/tree-actions.ts researchOverview · 8d564b35 src/ui/tree-overview.ts treeOverviewResearchLinkHtml (live.researchLink v záhlaví focus) · 28bbebeb src/ui/live-section-prefs.ts TOP_DEFAULTS (month.price false), research-overview-ui.ts appendOverviewSummary, strings.ts live.spendSessions, spendAmount · 87a6ea88 live.dirWorkedOn · strings.ts live.openOverview -->

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
- **Ab App 3.27.0:** **Panel anpassen** hat zwei Karten, gleich im Fenster, im Blatt auf dem Telefon (es schließt
  **Fertig**) und in **Einstellungen → Forschung verfolgen**:
  - **Bereiche und Reihenfolge:** alle sechs Abschnitte in einer Liste und in einer Reihenfolge für Panel und
    Übersicht (das Panel lässt **Richtungen** und **Was die Forschung weiß** aus). Jede Zeile hat die Wahl
    **Aufgeklappt** / **Eingeklappt** / **Ausgeblendet** (eine ausgeblendete Zeile „ausgeblendet“). Eine Zeile wird
    mit den Pfeilen ↑ ↓ verschoben (an den Rändern nicht), mit Alt+↑ / Alt+↓, durch Ziehen an ⠿ (Esc bricht das
    Ziehen ab; auf dem Telefon gibt es den Griff nicht) oder im Menü des Abschnitts **Nach oben** / **Nach unten**.
    Ein Bildschirmleser sagt den neuen Platz („… an Position 2 von 6 verschoben.“). Standardreihenfolge: **In Arbeit**
    (**Jetzt**), **Wartet auf Bearbeitung**, **Richtungen**, **Letzte Änderungen** (**Verlauf**), **Als Nächstes**
    (**Warteschlange**), **Was die Forschung weiß**. Passt das Panel nicht, klappt es Abschnitte vom unteren Ende
    dieser Reihenfolge her zu;
  - **Oben:** **Status** ist immer sichtbar („immer sichtbar“). **Letzte 24 Std.** (Teile **Personen**, **Quellen**)
    und **Diesen Monat** (Teile **Sitzungen**, **Kosten**) haben je einen Schalter und ihre Teile; eine Kachel mit
    beiden Teilen ausgeschaltet verschwindet. **Kosten** ist standardmäßig aus („Kosten erscheinen erst nach dem
    Einschalten.“). Auf dem Telefon ist **Diesen Monat** grau („Auf dem Telefon nicht angezeigt.“). **Folgen in** lässt
    sich ausblenden („Nur beim Live-Folgen.“), das Folgen läuft dann in der zuvor gewählten Ansicht;
  - Fußzeile: **Standard wiederherstellen** stellt die Zustände der Abschnitte, die Reihenfolge und **Oben** zurück
    (Kosten wieder ausgeblendet), ohne Rückfrage, mit der Meldung „Standard wiederhergestellt“ und **Rückgängig** für
    8 s; **Alle Einstellungen zum Folgen ›** öffnet die Einstellungen. Das Ausblenden eines Abschnitts direkt im
    Fenster **Panel anpassen** wird nicht gemeldet, das Ausblenden aus dem Menü des Abschnitts schon („Bereich
    ausgeblendet“, **Rückgängig**);
  - die Wahl gilt auf diesem Gerät für alle Stammbäume, für das Panel und die Forschungsübersicht, mit und ohne
    Verfolgen. Früher gespeicherte Wahlen bleiben.

<!-- zdroj: app:src/ui/live-section-prefs.ts SECTION_PREFS_KEY, PREF_KEYS, OVERVIEW_KEYS, OLD_PANEL_KEY · src/ui/live-section-edit.ts · src/ui/live-section-edit-ui.ts · src/ui/research-ui.ts:282 waitingHeadInfo, :312 waitingChip, :3180 toggle, :3215 resetLiveSections, :3225 hideLiveSection · src/ui/research-overview-ui.ts:376 shownOnce · strings.ts live.editPanel(Menu), sectionExpanded/Collapsed/Hidden/Default, resetDefaults, autoFoldedNote, allHidden, waitingShort, importantHint, shownOnce, settings groupResearchFollow · commity c4b1dcc, a56232a · spec 044 K1–K5 · 3.27.0: app 28bbebeb src/ui/live-section-prefs.ts DEFAULT_ORDER, TOP_KEYS, TOP_DEFAULTS (záznam v2: pořadí, nahoře; v1 se čte beze změny) · 0b090a80 src/ui/live-section-edit-ui.ts (Sekce a pořadí / Nahoře, ⠿ ne v listu, Alt+↑↓, Escape tažení, Hotovo) · src/ui/research-ui.ts resetLiveSections (RESTORED_TOAST_MS 8000, live.undo), hideLiveSection (hiddenToast, undo.undo) · strings.ts live.groupSections, groupTop, alwaysShown, topDay, partPersons, partSources, topMonth, partSessions, partPrice, priceHelp, monthPhoneNote, topFollowIn, followInHelp, moveUp, moveDown, movedSr, allFollowSettings, settingsNote, restoredToast, hiddenToast, done · spec 057 K1.1–K1.7, K2.1 -->

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

<a id="S4.1.5"></a>
### S4.1.5 Forschungsübersicht ohne Folgen

Die **Forschungsübersicht** lässt sich bei jedem Stammbaum aus der Forschung auch ohne Verfolgen öffnen. Der Stammbaum
wechselt dabei nicht zur Forschungsversion, wird nicht gesperrt und lässt sich weiter bearbeiten. Was die Übersicht
zeigt, hängt davon ab, ob die Brücke der Forschung antwortet.

- **Die Brücke antwortet** (die Forschung läuft auf diesem Computer): die Übersicht zeigt dasselbe wie beim Verfolgen
  (Kacheln und alle Abschnitte) aus der regelmäßigen Abfrage der Brücke; unter **Status** „aktualisiert …“. **Wartet
  auf Bearbeitung** und die Verwaltung der Linien funktionieren über die Brücke. Unter dem Kopf steht „Der Stammbaum
  wechselt zur Forschungsversion und ist nicht bearbeitbar.“ mit der Schaltfläche **Live verfolgen**. Beginnt der
  Agent inzwischen zu arbeiten, steht darüber „Agent hat begonnen“, und die Schaltfläche ist stärker hervorgehoben;
  von selbst wechselt nichts. Im Strom-Archiv gibt es diesen Streifen nicht.
- **Die Brücke antwortet nicht:**
  - **Status** „Forschung läuft nicht“ mit **Einschalten** (wo sich die Forschung aus der App nicht einschalten
    lässt, steht dort, wie sie zu starten ist);
  - **Wartet auf Bearbeitung** so, wie die Forschung es zuletzt auf diesem Gerät gesagt hat, mit „Stand …“; älter als
    7 Tage erscheint es nicht;
  - **Richtungen** aus der Datei des Stammbaums: Name und Zahl der Personen, nichts über die Arbeit an ihnen; **Was
    die Forschung weiß** und in der Fußzeile **Fehlende Belege: N Personen ›**;
  - **Jetzt**, **Verlauf** und **Warteschlange** gibt es nicht; eine Zeile nennt sie, z. B. „Jetzt, Verlauf und
    Warteschlange: nach dem Einschalten der Forschung.“ (ausgeblendete Abschnitte lässt sie aus; sind alle drei
    ausgeblendet, gibt es die Zeile nicht). Sobald die Brücke antwortet, zeichnet sich die Übersicht von selbst neu.
- **Das Telefon** fragt die Brücke nicht: **Status** „Nur aus dem Stammbaum“ und „Die Arbeit des Agenten ist am
  Computer mit der Forschung sichtbar.“ Quer gehalten bleibt der Status oben, und die Abschnitte scrollen darunter.
- **Anderswo in der App:** ohne Verfolgen zeigt auch die Ansicht Tabelle die Arbeit des Agenten und die
  Warteschlange, wenn die Brücke antwortet ([A6.7.14](A6-views.md#A6.7.14)).
- **Bedienung:** App: **Forschung → Forschungsübersicht**; **Stammbaum-Überblick → Worauf achten → Forschung ›**
  (bei einem Stammbaum ohne Personen im Kopf des Dialogs); auf Telefon und Tablet in den Aktionen des Stammbaums,
  Gruppe **Forschung**; in der Übersicht **Live verfolgen**.
- **Gilt seit:** App 3.27.0
- **Ab App 3.28.0:** wenn die Brücke antwortet, ändert **⋯** bei einer Aufgabe in der **Warteschlange** ihre Stelle
  wie beim Verfolgen: **Als Nächstes erledigen** mit **Rückgängig** ([S4.2.2](#S4.2.2)) und, wo die Forschung sie
  anbietet, **Ans Ende** und **Auf Standard zurücksetzen** ([S4.2](#S4.2)). Ebenso in den Ergebnissen der Suche
  ([S4.2.1](#S4.2.1)) und im eigenen Fenster der Übersicht ([S4.1.6](#S4.1.6)), wo es das Hauptfenster ausführt. Es
  schreibt die Brücke der Forschung; das Verfolgen beginnt nicht, der Stammbaum wechselt nicht und lässt sich weiter
  bearbeiten. Die Warteschlange wird gleich danach aus der Forschung gelesen, ohne auf die regelmäßige Abfrage zu
  warten. Ohne Brücke (die Übersicht aus dem Stammbaum, ein Telefon) ändert sich nichts.
  Ebenso fragt die Übersicht ohne Verfolgen die Brücke nach jedem Schreiben über die Brücke sofort nach dem Stand: in
  **Wartet auf Bearbeitung** eine Antwort, **Datei hinzufügen**, **Gesendet** und **Zurück zu „Zu erledigen“**, eine
  Antwort auf die Fragen zu Orten und zu einem wachsenden Zweig; in **Richtungen** das Anlegen, Bearbeiten,
  Verschieben, Pausieren, Beenden und Wiederaufnehmen einer Richtung; das Entscheiden eines Widerspruchs, das
  Zurücknehmen eines Werts und das Prüfen oder Bestätigen einer Angabe über die Brücke. Das Fenster der Übersicht
  ([S4.1.6](#S4.1.6)) bekommt den neuen Stand vom Hauptfenster, das das Schreiben ausführt.
- **Ab App 3.28.0:** die Forschungsübersicht ohne Folgen lässt sich mit ⤡ und × schließen; ein Forschungspanel, das neben ihr zu
  sehen war, erscheint nach dem Schließen der Übersicht wieder. **Verfolgung beenden** in der offenen Übersicht beendet
  nur die Verfolgung, und die Übersicht bleibt ohne Folgen offen; ein Ende, das die App selbst macht (zum Beispiel
  ein Wechsel ins Archiv), schließt sie. Der Wechsel in eine andere Ansicht schließt die Übersicht ohne Folgen wie
  ⤡; die Übersicht einer verfolgten Forschung bleibt.

<!-- zdroj: app:f05fff8e, 48573de6 src/ui/research-overview-ui.ts renderResearchOverview (source live | bridge | tree; fromTree vynechá working, changes, queue), appendOverviewStateOff (notRunning, turnOn / researchLiveStartHow; telefon phoneTreeOnly, phoneWhy), overviewFollowStrip (activeResearchAgentless → bez pruhu; agentStarted, followNote), appendOverviewWaitingAsOf (asOf), appendOverviewSkeletonLines, appendOverviewFoot (missingLink) · src/research-overview-source.ts BRIDGE_ONLY_SECTIONS, afterTurnOnKeys, skeletonLines (_STROM_DIRECTION, místa osob) · src/research-device.ts WAITING_MAX_AGE_MS = 7 dní · src/ui/research-ui.ts OverviewViewing (refreshedAt, agentStarted, waitingAt) · src/ui/tree-actions.ts researchOverview · 8d564b35 src/ui/tree-overview.ts treeOverviewResearchLinkHtml (sekce focus, bez osob v záhlaví) · strings.ts live.followNote, agentStarted, notRunning, turnOn, afterTurnOn, refreshedAgo, asOf, phoneTreeOnly, phoneWhy, researchLink, missingLink, treeOverview focus · CHANGELOG.cs.md 3.27.0 · spec 057 K1.8–K1.12 · 3.28.0: app:bb6c0d07 src/ui/research-ui.ts researchSession (sledovaný, jinak prohlížený přes most), openLiveTaskMenu, researchStatusAfterWrite / statusAfterWriteWay (bez sledování hned askResearchBridge, jen počítač), src/ui/research-offline-ui.ts taskMenuOrders (queue.next; queue.own last, default), changeTaskOrder, writeTaskOrder · CHANGELOG.cs.md 3.28.0 (c04a7199) · spec 052 K5.1, K5.6; spec 057 §7 · prace/1113-app-jako-dalsi-bez-sledovani · app:3c751bea src/ui/research-ui.ts researchStatusAfterWrite (Čeká: sent, unsent, odpověď, soubor; linie; větev), researchViewedStatusAfterWrite, viewedWriteSession (jen prohlížený přes most, ne sledovaný, ne ze stromu) · research-waiting-write-ui.ts, research-directions-ui.ts, direction-form-ui.ts, research-offline-ui.ts, research-sync-ui.ts, verify-ui.ts, waiting-places-ui.ts · e2e/overview-write-unfollowed.spec.ts (do 3 s, okno bez dotazu na most) · strings.ts live.waitingWrite.sent, unsent, file · spec 083 · prace/1113-app-hledani-v-prehledu bod 2 · od 3.28.0 zavření a Ukončit sledování: app commit 3f2e19f8 (panel výzkumu skrytý pod Přehledem bez sledování, Ukončit sledování nechá Přehled otevřený, jiný pohled ho zavře) -->

<a id="S4.1.6"></a>
### S4.1.6 Forschungsübersicht in einem eigenen Fenster

Am Computer lässt sich die **Forschungsübersicht** in einem eigenen Fenster öffnen, etwa auf einem zweiten Monitor.
Das Fenster zeigt nur: den Stand der Forschung schickt ihm das Hauptfenster, und was im Fenster getan wird, führt
das Hauptfenster aus. Mit der Brücke der Forschung spricht das Fenster nicht.

- **Wo es geht:** bei einem Stammbaum aus der Forschung, mit oder ohne Verfolgen ([S4.1.5](#S4.1.5)), unter denselben
  Bedingungen wie eine Ansicht im Fenster ([A6.8](A6-views.md#A6.8)): Computer, Fenster breiter als 640 px.
- **Aufteilung:** die Zusammenfassung über die ganze Breite, darunter die Abschnitte in Spalten nach der Breite des
  Fensters:
  - unter 1100 px eine Spalte wie die Übersicht im Hauptfenster, ab 1100 px zwei, ab 1600 px drei. Zu weniger Spalten
    kehrt das Fenster erst 24 px unter der Grenze zurück, damit das Ziehen am Rand nicht flackert;
  - eine Spalte ist höchstens 660 px breit, die Spalten stehen in der Mitte, und jede scrollt für sich;
  - die Abschnitte folgen der Reihenfolge der Übersicht (**Panel anpassen**, [S4.1.2](#S4.1.2)) und werden der Reihe
    nach so auf die Spalten verteilt, dass die höchste Spalte möglichst niedrig ist. Drei Spalten, von denen eine
    weniger als ein Fünftel der Höhe hätte, sind zwei;
  - die Verteilung ändert sich, wenn sich die Zahl der Spalten ändert, wenn ein Abschnitt eingeklappt, aufgeklappt,
    ausgeblendet oder verschoben wird, und nach **Weitere laden** in der **Warteschlange**; neue Daten aus der
    Forschung und das Tippen ändern sie nicht;
  - ein langer Abschnitt (mit Suchfeld oder mit mehr als 8 Zeilen) hat in seiner Spalte einen haftenden Kopf:
    Überschrift, Suchfeld, Chips und die Zahl der Gefundenen bleiben oben, die Zeilen scrollen darunter;
  - ändert sich die Breite über eine Grenze, bleiben die angefangene Suche, der Cursor und der Abschnitt, der zu
    sehen war;
  - die Einstellungen der Abschnitte ([S4.1.2](#S4.1.2)) gelten auch im Fenster.
- **Kopf des Fensters:** „{Stammbaum} · Forschungsübersicht“, darunter der Name der Forschung, rechts je nach Zustand
  **Live verfolgen** oder das Beenden des Verfolgens, und ⋯. Ohne ⤡, × und **Folgen in**.
- **Aktionen:** eine Person im Stammbaum zeigen, eine Antwort in **Wartet auf Bearbeitung**, die Verwaltung der
  Richtungen, die Stelle einer Aufgabe in der Warteschlange, die Suche in der **Warteschlange** ([S4.2.1](#S4.2.1)),
  **Live verfolgen** und sein Beenden, **Einschalten** und im Abschnitt **Prüfung** **Anhalten** und **Angaben im Baum
  prüfen…** ([S7.5](S7-reliability-and-verification.md#S7.5)) führt das Hauptfenster aus. Die Suche und die Seiten
  der Warteschlange liest das Hauptfenster von seiner Brücke und schickt das Ergebnis dem Fenster. Nach einer Aktion,
  deren Ergebnis im Hauptfenster zu sehen ist (etwa das Zeigen im Stammbaum oder der Dialog **Angaben im Baum
  prüfen**, der sich im Hauptfenster öffnet), bittet das Fenster, das Hauptfenster nach vorne zu holen; nach
  **Anhalten** nicht. Die Suche in **Wartet auf Bearbeitung** und **Was die Forschung weiß**
  ([S4.4.2](#S4.4.2), [S3.7.1](S3-what-the-research-knows.md#S3.7.1)) filtert das Fenster selbst.
- **Hervorhebung:** Was der Stammbaum im Hauptfenster gerade hervorhebt, zeigt das Fenster, indem es die Schaltfläche
  dieser Gruppe hervorhebt: **Im Stammbaum zeigen** bei einer Richtung in **Jetzt** und in **Richtungen**, die Zahl
  der gefundenen Personen einer Richtung und **Geänderte im Stammbaum zeigen** in **Verlauf**. Nach dem Ende der
  Hervorhebung oder dem Schließen des Hauptfensters ist nichts hervorgehoben. Hebt ein Filter in **Verlauf** die
  geänderten Personen erneut hervor, wird das Hauptfenster nicht nach vorne geholt; ein Filter ohne Personen beendet
  die Hervorhebung im Hauptfenster.
- **Zustände des Fensters:**

| Zustand | Was das Fenster zeigt |
|---|---|
| live verfolgt | dasselbe wie die Übersicht beim Verfolgen |
| nicht verfolgt, die Brücke antwortet | dasselbe wie die Übersicht ohne Verfolgen ([S4.1.5](#S4.1.5)) mit dem Streifen **Live verfolgen** |
| die Forschung läuft nicht | „Forschung läuft nicht · gezeigt wird, was im Stammbaum ist“ mit **Einschalten**; **Wartet auf Bearbeitung** aus dem Gedächtnis mit „Stand …“ |
| das Hauptfenster hat zu einem Stammbaum ohne Forschung gewechselt | „Dieser Stammbaum hat keine Forschung“, „Das Hauptfenster hat zu {Stammbaum} gewechselt, ohne Forschung.“ und **Fenster schließen**; zurück bei einem Stammbaum mit Forschung kommt das Fenster von selbst wieder |
| das Hauptfenster ist geschlossen | Streifen „Das Hauptfenster ist geschlossen · Stand {Zeit}, nur lesen“, der letzte Stand, Aktionen ausgegraut; **Strom öffnen** ([A6.8.2](A6-views.md#A6.8.2)) |
| der Stammbaum gelöscht oder gesperrt | wie bei einer Ansicht im Fenster ([A6.8.2](A6-views.md#A6.8.2)) |

- **Grenzen:** solange das Fenster der Übersicht offen ist, zeichnet das Hauptfenster keine eigene Übersicht; eine
  offene schließt sich, wenn das Fenster aufgeht. Das kleine Forschungspanel bleibt. **⤢ Übersicht öffnen**,
  **Forschung → Forschungsübersicht** und der Eintrag im Menü ⧉ holen dann nur das Fenster der Übersicht nach vorne
  („Die Forschungsübersicht ist in einem eigenen Fenster · Klick holt sie nach vorne“). Nach dem Schließen des
  Fensters ist alles wie vorher.
- **Bedienung:** App: ⧉ im Kopf der Übersicht (zwischen ⋯ und ⤡); ⧉ **In neuem Fenster öffnen** neben dem
  Ansichtsumschalter → **Forschungsübersicht**.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:4b1373a7 src/windows/overview-window.ts (research-state bez adresy a tokenu mostu, OVERVIEW_ACTION_IDS, OVERVIEW_ACTIONS_TO_MAIN, 6g) · src/windows/overview-main.ts · src/ui/research-overview-ui.ts OVERVIEW_WINDOW_COLS_MIN 1100, WINDOW_LEFT (working, waiting, directions), overviewMode 'window', overviewWindowButton (jen canOpenWindows, ne sheet), canOpenResearchOverview · index.html html.window-overview (bez ⤡, ×, ⧉, Follow in) · src/windows/window-controls.ts renderMenu (overview: focusOverviewWindow / openInNewWindow) · strings.ts win.overviewHead, overviewOffNote, noResearch, noResearchNote, overviewInWindow, mainClosed · CHANGELOG.cs.md 3.28.0 · spec 079 P3 (K3), ZADANI_DEV §6 · prace/1113-app-okna-prehled (8a7575f0..4387a662) · app:3c2fde77 src/ui/overview-window-view.ts readQueuePage přes akci queue-list do hlavního okna (okno most nevolá) · app:3f9a5ca4 overview-window-view.ts treeVerifyNow (extras.verify), verifyStop → verify-stop, showVerifyBulkDialog → verify-bulk; evidenceHighlightNow (extras.highlight), endEvidenceHighlight → highlight-end, startPersonHighlight quiet · src/ui/research-ui.ts lightsGroup, markOverviewLit (is-lit, aria-current; nic při zavřeném hlavním okně) · research-overview-ui.ts lightsGroup direction (show-in-tree v Teď), changed (showChanged) · research-directions-ui.ts lightsGroup direction (dirShow), direction-found (dirFoundPersons) · strings.ts verify.section, bulkRow, stop, live.showInTree, dirShow, showChanged · spec 079 K3 · prace/1113-app-dorovnani-052-okna (2876d570..27f0bafb) · app:7f307c74 src/overview-columns.ts OVERVIEW_WINDOW_COLS_2 1100, OVERVIEW_WINDOW_COLS_3 1600, OVERVIEW_COLS_HYSTERESIS 24, OVERVIEW_SMALL_COLUMN 0.2, OVERVIEW_COLUMN_MAX 660, partitionContiguous, planOverviewColumns · src/ui/overview-columns-ui.ts (souhrn a pruhy nad sloupci, každý sloupec se posouvá sám, nové rozdělení jen při změně sloupců, sbalení, skrytí, přesunu, Načíst další; lepkavá hlava: pole nebo > 8 řádků; fokus, výběr v poli a oddíl na očích při změně šířky) · e2e/windows-overview-columns.spec.ts · CHANGELOG.cs.md 3.28.0 (e540e4b5) · spec 083 U3 · prace/1113-app-hledani-v-prehledu -->

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
- **Ab App 3.27.0:** mit Forschung 1.31.0 hat die Warteschlange in der App dieselbe Reihenfolge, in der `strom run`
  die Aufgaben nimmt und in der das Menü der Forschung sie davor zeigt ([R2.2](R2-lines-and-queue.md#R2.2)): ist die
  Erzählung an der Reihe, steht oben eine Erzählung, und in der Warteschlange sind auch Aufgaben der Ortsgeschichte.
  Eine Aufgabe trägt hinter dem Text ein unauffälliges Etikett **Erzählung** oder **Zeitgeschehen** (in **Als
  Nächstes**, in der **Warteschlange**, bei zurückgestellten Aufgaben und in den Aufgaben eines Zweigs); eine Aufgabe
  ohne Etikett sieht aus wie bisher. Ohne Verfolgen zeigen die Warteschlange die Übersicht ([S4.1.5](#S4.1.5)) und die
  Tabelle, wenn die Brücke antwortet.
- **Ab App 3.28.0:** mit Forschung 1.32.0 lässt sich in der **Warteschlange** suchen ([S4.2.1](#S4.2.1)), eine
  Aufgabe als nächste einreihen und zurücknehmen ([S4.2.2](#S4.2.2)) und um die Arbeit des Agenten an der
  Warteschlange bitten ([S4.2.3](#S4.2.3)). Die aufgeklappte **Warteschlange** hat dann die Zahl der Aufgaben in der
  Überschrift („Warteschlange · 1.240“) statt rechts. Mit einer älteren Forschung ist die Warteschlange wie bisher.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:308 queueNoteText, :3373 appendQueueSection · research-overview-ui.ts:311 (20) · strings.ts research.queue, research.park/drop/wake, research.queueMore, research.queueOffLast, research.queueOffNever, research.queueHelps · HEAD src/research-queue-pages.ts:19 QUEUE_PAGE, :28 QUEUE_ROWS_CAP · src/ui/research-ui.ts:3884 taskDoNext/taskDoLast · strings.ts live.taskDoing, live.queueLoadMore, live.queueCapNote, live.branchQueueChip, live.branchQueueChipClear · 3.27.0: app 2ee3718d (queue[].kind ze /status i ze stránek fronty, jiná hodnota zahozena) strings.ts live.queueKind · research 5f48cdaf src/core/queue.ts RUN_TURNS, runOrder (most /status queue[], GET /queue, menu před strom run), kind story|history · 3.28.0: app 4ad34832 src/ui/research-ui.ts appendQueueSection (counted: queueTitleCount místo summary, když je pole nebo akce záhlaví) · spec 052 -->

<a id="S4.2.1"></a>
### S4.2.1 Suche in der Warteschlange

In der **Warteschlange** in der **Forschungsübersicht** (auch in ihrem eigenen Fenster, [S4.1.6](#S4.1.6)) gibt es
das Feld **Aufgabe, Person, Archiv suchen…**. Die
Forschung sucht in der ganzen Warteschlange, auch jenseits der geladenen Seiten; die App schickt ihr nur den gesuchten
Text ([R2.2](R2-lines-and-queue.md#R2.2)).

- **Wann es das Feld gibt:** in der aufgeklappten **Warteschlange**, mit einer Forschung, deren Brücke die Suche kann
  und antwortet, und nur, wenn in der Warteschlange mindestens eine Aufgabe ist (auch eine zurückgestellte). Mit einer
  älteren Forschung gibt es das Feld nicht, und die Warteschlange ist wie bisher.
- **Was gefunden wird:**
  - Nummer einer Aufgabe (`T0815`, `t815`, `815`): diese Aufgabe als erste, dann Aufgaben, in deren Text die Nummer
    steht;
  - Nummer einer Person (`P12`): Aufgaben zu dieser Person;
  - anderer Text: Aufgaben, die jedes Wort im Text der Aufgabe, in den Namen ihrer Personen, im Buch, in der
    Signatur, im Archiv oder Ort oder in der Nummer der Aufgabe oder Person haben; ohne Rücksicht auf Groß- und
    Kleinschreibung und diakritische Zeichen. Die Ergebnisse stehen in der Reihenfolge der Warteschlange.
- **Grenzen:**
  - gesucht wird 300 ms nach dem zuletzt getippten Zeichen, geschickt werden höchstens 100 Zeichen; ein leeres Feld
    bringt die Warteschlange zurück;
  - die Etiketten der Linie und des Zweigs ([S4.2](#S4.2)) lassen sich mit der Suche kombinieren: das Ergebnis sind
    die Aufgaben des Etiketts, die zum Text passen. Die Zahlen in den Etiketten bleiben die der Warteschlange;
  - eine Zeile des Ergebnisses ist eine Zeile der Warteschlange (Platz in der Warteschlange, Text, **⋯**) mit der
    grauen Nummer der Aufgabe. Hervorgehoben ist nur ein Treffer der Nummer der Aufgabe oder Person („P0108 Jan
    Horák“), ein Treffer im Text nicht. Zurückgestellte Aufgaben stehen am Ende mit dem Platz „–“ und dem Etikett
    **zurückgestellt**;
  - über den Ergebnissen steht ihre Zahl („12 Aufgaben gefunden“). Ohne Ergebnis **Nichts gefunden.** und **Suche
    aufheben**, mit dem Etikett einer Linie auch **In allen Richtungen suchen**;
  - die Nummer einer Aufgabe, die nicht mehr in der Warteschlange ist: „T0815 ist nicht mehr in der Warteschlange
    (erledigt)“, Zustand **erledigt**, **wartet auf Bearbeitung**, **zurückgestellt** oder **aufgegeben**;
  - mehr als 50 Ergebnisse: **Weitere laden** je 50, höchstens 300 Zeilen wie in der Warteschlange;
  - antwortet die Brücke nicht oder ist sie beschäftigt: **Die Suche ist fehlgeschlagen, die Forschung antwortet
    nicht.** oder **Die Forschung ist beschäftigt, Suchen geht gerade nicht.** und **Erneut versuchen**; der Text im
    Feld bleibt;
  - ändert sich die Warteschlange während der Suche, erneuert sich das Ergebnis von selbst; Text und Cursor im Feld
    bleiben;
  - die Suche gilt, bis sie aufgehoben wird (×, Escape im Feld, **Suche aufheben**) oder bis die Übersicht
    geschlossen wird. Der gesuchte Text wird nirgends gespeichert.
- **Bedienung:** App: **Forschungsübersicht → Warteschlange**, Suchfeld; im kleinen Panel unter **Als Nächstes** der
  Link **In der Warteschlange suchen…**: er öffnet die Übersicht, klappt die **Warteschlange** nur bis zu deren
  Schließen auf (die gespeicherte Wahl des Abschnitts ändert sich nicht) und setzt den Cursor ins Feld. Auf dem
  Telefon, wo das Panel ein Streifen ist, gibt es den Link nicht.
- **Gilt seit:** App 3.28.0 (Forschung 1.32.0)

<!-- zdroj: app:4ad34832 (8a10387e) src/ui/queue-search-ui.ts QUEUE_SEARCH_PAUSE_MS 300, queueSearchOffered (queue.search, queuePaged, queue/queueMore/queueCounts next+parked), resetQueueSearch (zavření Přehledu), Escape · src/research-queue-pages.ts QUEUE_QUERY_MAX 100, QUEUE_PAGE 50, QUEUE_ROWS_CAP 300, QUEUE_ELSEWHERE_STATES · src/ui/research-ui.ts appendQueueSection (searchable jen v Přehledu, ne při sbalení), appendQueueSearchResult (štítek + q, queueSearchBusy/Err, dirRetry), řádek výsledku (live-queue-num „–“, research-queue__match id/person, queueTagDeferred), live-queue-search-link (canExpandLivePanel) · src/ui/research-overview-ui.ts openQueueSearch (unfoldOverviewSection queue do zavření) · strings.ts live.queueSearch*, queueState, queueTagDeferred, queueTitleCount, dirRetry · research 1.32.0 src/core/live.ts searchQueue (TASK_NUMBER, PERSON_NUMBER, každé slovo v jednom poli, pořadí fronty, elsewhere) · spec 052 K1.1–K1.7 · ZADANI_DEV_fronta-hledani §1, §2; D1 (bez řádku pole) · app:08268b9f strings.ts live.queueSearchInDir, queueSearchNoneDir, queueSearchAllDirs (linie) · app:3c2fde77 okno Přehledu (queue-list) · spec 052 K1.1 -->

<a id="S4.2.2"></a>
### S4.2.2 Als Nächstes erledigen und Rückgängig

Eine Aufgabe lässt sich aus der App als nächste einreihen, ohne Terminal. Laufende Arbeit unterbricht der Agent
nicht: die Aufgabe kommt nach ihr an die Reihe ([R2.3.1](R2-lines-and-queue.md#R2.3.1)).

- **Grenzen:**
  - **Als Nächstes erledigen** („Kommt nach der laufenden Aufgabe an die Reihe“) ist der erste Eintrag in **⋯** bei
    einer Aufgabe in der **Warteschlange**, in den Ergebnissen der Suche ([S4.2.1](#S4.2.1)) und in **Als Nächstes**
    im kleinen Panel, ohne Marke. Es steht an der Stelle von **Als Nächstes**; **Ans Ende** und **Auf Standard
    zurücksetzen** bleiben bei einer Forschung, die sie anbietet ([S4.2](#S4.2));
  - nicht angeboten bei einer Aufgabe, die schon die erste ist, an der der Agent arbeitet oder die zurückgestellt ist;
  - es geht mit und ohne Verfolgen: in der **Forschungsübersicht**, die ohne Verfolgen geöffnet ist
    ([S4.1.5](#S4.1.5)), wenn die Brücke der Forschung antwortet; das Verfolgen beginnt nicht und der Stammbaum
    bleibt bearbeitbar. Nach der Änderung wird die Warteschlange sofort aus der Forschung gelesen;
  - die Aufgabe rückt an die erste Stelle, ihre Zeile wird kurz hervorgehoben und hat beim Text das Etikett **als
    Nächstes**, bis sie an der Reihe ist. Von mehreren Aufgaben als nächste ist die zuletzt markierte die erste; das
    Etikett haben alle. Die Suche bleibt;
  - die Meldung mit der Nummer der Aufgabe („T0103 als Nächstes“) und **Rückgängig** steht 6 s. **Rückgängig** setzt
    die Aufgabe genau auf ihren früheren Platz zurück, samt ihrer früheren Wahl; die Zeile steht dort, sobald die
    Forschung antwortet, auch im eigenen Fenster der Übersicht ([S4.1.6](#S4.1.6));
  - hat der Agent die Aufgabe inzwischen genommen: **Der Agent arbeitet gerade an dieser Aufgabe; ihr Platz lässt sich
    jetzt nicht ändern.**, und die Warteschlange wird neu geladen. Antwortet die Brücke nicht: **Die Forschung
    antwortet nicht, die Reihenfolge ist unverändert.** und **Erneut versuchen**;
  - nichts wird bestätigt: nichts wird gestartet und nichts bezahlt;
  - auf dem Telefon ist das Menü ein Blatt am unteren Rand wie die anderen Blätter der App (Griff, das Fenster
    darunter abgedunkelt) mit Nummer und Text der Aufgabe oben; ein Tippen auf das abgedunkelte Fenster oder Escape
    schließt es.
- **Bedienung:** App: bei der Aufgabe **⋯ → Als Nächstes erledigen**, in der Meldung **Rückgängig**. Terminal:
  `strom task order T… --next`, `--restore` ([R2.3.1](R2-lines-and-queue.md#R2.3.1)).
- **Gilt seit:** App 3.28.0 (Forschung 1.32.0)

<!-- zdroj: app:623d9c77 (8a10387e) src/ui/research-offline-ui.ts queueNextOffered (queue.next, most odpovídá), queueNextFor (state next, ne pozice 1, ne práce agenta), doTaskNext (toast queueMoved 6000 ms, queueUndo → restoreTaskPlace {do: restore, was}), taskOrderRefusedToast (taken → taskDoing, bridge → queueBridgeErr + dirRetry), QUEUE_FLASH_MS 1600 · src/ui/research-ui.ts openLiveTaskMenu (nextOn: queueNext místo taskDoNext; taskOrderOffered: last, default; list na telefonu ≤ 640 px s titulem), markQueueNextRow (queueTagNext) · strings.ts live.queueNext, queueNextHint, queueTagNext, queueMoved, queueUndo, queueBridgeErr, taskDoing · research 1.32.0 rankTasks (naposledy zvolený první) · spec 052 K5.1, K5.3, K5.4, K5.6 · ZADANI_DEV_fronta-hledani §4 · app:2876d570 placeQueueItemInLists (odpověď restore: pos, own, why), strings.ts live.queueMoved(id) · app:7dc924ee list ⋯ = bottom-sheet (úchyt, ztmavení, Escape) · app:3f9a5ca4 Vrátit v okně Přehledu · spec 052 K5.4 · app:bb6c0d07 bez sledování přes most (researchSession, taskMenuOrders, researchStatusAfterWrite) · spec 057 §7 -->

<a id="S4.2.3"></a>
### S4.2.3 An der Warteschlange arbeiten…

Aus der App lässt sich um selbstständige Arbeit des Agenten an der Warteschlange bitten. Die App startet nichts: sie
öffnet das Terminal der Forschung, das zeigt, was gestartet wird, und es erst auf ein Ja startet
([R7.1.2](R7-when-the-agent-works.md#R7.1.2)). Die Arbeit des Agenten verbraucht das KI-Abonnement.

- **Wann sie angeboten wird:** mit einer Brücke, die antwortet, bei einer Forschung, die den Link für die Arbeit
  gemeldet hat, mit einem Agenten (nicht im Strom-Archiv und nicht in einer Forschung, die auf einen Agenten wartet),
  nur dort, wo die App Links der Forschung öffnet ([S4.5](#S4.5)); nicht auf dem Telefon. Arbeitet der Agent oder
  läuft ein Lauf, gibt es die Aktion nicht; im Kopf der **Warteschlange** steht stattdessen **● In Arbeit ›**, das
  **Jetzt** aufklappt und zu **Abschließen und beenden** springt.
- **Dialog An der Warteschlange arbeiten:**
  - **Automatisch** (Standard): „Der Agent nimmt eine Aufgabe nach der anderen, solange das Abo-Limit es erlaubt.“
    Meldet die Forschung, dass die Abo-Schranke (Bedingung, [R7.4](R7-when-the-agent-works.md#R7.4)) nicht
    eingerichtet ist, steht darunter **Automatische Arbeit braucht eine eingerichtete Abo-Schranke; das Terminal
    bietet die Einrichtung an.** Die Wahl bleibt;
  - **Nur 5 Aufgaben**: Zahl 1–100, Standard 5. Die Arbeit endet nach so vielen erledigten Aufgaben; mit zählt auch
    eine Aufgabe, die mit Warten, Zurückstellen oder Aufgeben endet. Nur mit einer Forschung, die das kann; sonst
    gibt es nur **Automatisch**;
  - **Als Erstes kommt**: die als nächste markierte Aufgabe ([S4.2.2](#S4.2.2)), sonst die erste Aufgabe der
    Warteschlange;
  - wenn die Forschung es meldet, die Länge der Sitzung und die Schranke („Sitzung höchstens 3 Std. · Abo-Schranke:
    …“);
  - **Abbrechen** und **Terminal öffnen** (Marke KI und Terminal) mit dem Satz **Den Start bestätigt das
    Forschungsterminal. Die Arbeit stoppt Strg-C in dessen Fenster oder „Abschließen und beenden“ im Bereich Jetzt.**
- **Bedienung:** App: **An der Warteschlange arbeiten…** rechts im Kopf der aufgeklappten **Warteschlange** in der
  **Forschungsübersicht**; Menü **Forschung → An der Warteschlange arbeiten…** ([S4.5.2](#S4.5.2)). Terminal:
  `strom run --tasks N`, `strom run --loop` ([R7.1](R7-when-the-agent-works.md#R7.1)).
- **Gilt seit:** App 3.28.0 (Forschung 1.32.0)

<!-- zdroj: app:9cf43b22, 34accb13 (8a10387e) src/ui/queue-work-dialog.ts queueWorkOffer (live, ne phone/sheet, ne noAgent, linkAvailable work, work.link; busy sessions|runs → 'busy'), queueWorkHead (queue-work-busy → showOverviewNowFinish), queueWorkCounted (run.tasks), queueWorkFirst (own next, pos 1), queueWorkSessionLine, WORK_TASKS_DEFAULT 5, noGate (work.gate === null) · src/research-link.ts WORK_TASKS_MIN/MAX, WORK_LINK_FEATURE, RUN_TASKS_FEATURE · src/ui/research-ui.ts queueHeadAction (jen rozbalená Fronta) · src/ui/research-overview-ui.ts showOverviewNowFinish · strings.ts live.queueWork*, queueWorkingLink · spec 052 K6.1, K6.2, K6.4, K6.6 · ZADANI_DEV_fronta-hledani §5; D6 (řádek sezení i bez brány) -->

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
    Reihenfolge. Ab App 3.27.0 sagt die Einleitung der Gruppe, was einer Richtung hilft und immer mit ihr geht: „eine
    Frage der Richtung, Personen an jemanden in ihr oder an dessen Partner anbinden, ein vom Agenten genannter
    Grund“ ([R2.3](R2-lines-and-queue.md#R2.3)).
- **Bedienung:** App: **Forschungsübersicht**, Abschnitt der Arbeit außerhalb der Linien, beim Zweig **⋯** (**Optionen
  des Zweigs**); **Forschung für diesen Stammbaum…**.
- **Gilt seit:** App 3.22.0 (Forschung 1.26.0)

<!-- zdroj: app:HEAD src/ui/research-offline-ui.ts:3, :104 (caps.offLineBranches, ≥2 linie) · src/research-directions-write.ts setBranchMode, setOffLineTree, answerBranchWaiting · strings.ts live.offModeLink, live.offModeCap, live.branchAddPick, live.branchCreate, live.branchNever, live.branchReset · research-offline-ui.ts:202-228 growingBranchLine, :542 branch choices, :680 branchQueueBeyond, :740 pick · strings.ts live.dirNear, branchGrows, branchOwnChoice, branchQueueHead, branchQueuePos, branchAllTasks, branchTaken, branchDefaultTag, branchAdd(Paused), branchNeverGroup, waitBranchLeave, waitBranchHint, setOutTitle, setOutOcc, setSuggest, setOwnChoice, setManualTasks, menu treeSettings · spec 038 K7 · 3.27.0: strings.ts live.setOutIntro (app 4e4f6d8c, spec 036 K1.8) -->

<a id="S4.4"></a>
## S4.4 Wartet auf Bearbeitung in der App

Panel und Übersicht zeigen dieselbe Liste wie die Forschung ([R6.1](R6-awaiting-action.md#R6.1)). Was sich in der App
erledigen lässt und was nur in der Forschung, sagt [R6.5](R6-awaiting-action.md#R6.5).

- **Grenzen:** unter der Liste steht, wo geantwortet wird: **Geantwortet wird in der Forschung. Der Stammbaum
  aktualisiert sich danach selbst.**, bei Fragen zu Orten **Fragen zu Orten werden hier beantwortet.**, bei beidem
  **Fragen zu Orten werden hier beantwortet, die übrigen in der Forschung.** Einträge nur für das Terminal bekommt die
  App nicht ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
- **Vom Stammbaum aus:** das Kärtchen einer Person, auf die etwas wartet, hat die Marke **!** (Popup: **Klick:
  antworten**). Ein Klick darauf und der Eintrag **Antworten · N wartend** im Menü der Person tun dasselbe:
  - wartet auf die Person ein Eintrag, öffnet sich seine Antwort wie mit der Schaltfläche in seiner Zeile im Panel;
  - warten mehrere, öffnet sich das Panel im Abschnitt **Wartet auf Bearbeitung** mit den Einträgen der Person oben,
    hervorgehoben. Auf dem Telefon, bei eingeklapptem oder ausgeblendetem Abschnitt und bei geöffneter Übersicht
    werden sie in der **Forschungsübersicht** hervorgehoben;
  - lässt sich hier auf keinen Eintrag der Person antworten (auch nicht auf einen einzigen), öffnet sich das Panel
    trotzdem, und unter jedem Eintrag steht **Hier ist keine Antwort möglich: Geantwortet wird in der Forschung, auf
    dem Computer, auf dem sie installiert ist.** Ein Klick bleibt nie ohne Reaktion;
  - eine neue Version einer Erzählung öffnet den Vergleich;
  - auf einem Touch-Gerät hat das Menü der Person statt **Antworten · N wartend** den Eintrag **Wartet auf Erledigung
    · N ›**: er hebt die Einträge der Person hervor, geantwortet wird aus ihren Zeilen.
  - hat das Kärtchen zwei oder drei Marken, bietet ein Klick an, was sich öffnen soll ([S4.4.1](#S4.4.1)).
- **Hypothesen:** mit einer Forschung, die sie in der App entscheiden lässt, stehen Hypothesen zu entscheiden in
  der Gruppe **Hypothesen zu entscheiden** (Chip **Entscheidungen**), auch mit dem Annehmen der Vorschläge des Agenten auf einmal
  ([S3.5.2](S3-what-the-research-knows.md#S3.5.2)).
- **Bedienung:** App: Panel, Abschnitt **Wartet auf Bearbeitung**; Menü **Forschung → Wartet auf Bearbeitung**; die
  Marke **!** auf dem Kärtchen und **Antworten · N wartend** im Menü der Person.
- **Gilt seit:** App 3.4.0. Fragen zu Orten seit Forschung 1.25.0. Die Marke **!** und **Antworten · N wartend** so
  seit App 3.26.0. Hypothesen seit App 3.27.0 mit Forschung 1.31.0. Mehrere Marken auf dem Kärtchen seit App 3.27.0
  ([S4.4.1](#S4.4.1)).
- **Ab App 3.28.0:** in der **Forschungsübersicht** hat der Abschnitt ab 10 Einträgen ein Suchfeld ([S4.4.2](#S4.4.2)).

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts renderLivePanel (waiting) · strings.ts research.answerWhere, research.answerHere, research.answerMixed · app:7cf409bd src/ui/card-signals-ui.ts answerPersonWaiting (vyprávění → porovnání; 1 položka → waitingAnswerAction; jinak showPersonWaiting, why jen když žádná nejde), personSignalsMenuHtml (dotyk: menuWaiting → signal-waiting-list) · src/ui/research-ui.ts showPersonWaiting (telefon, sbalený/skrytý oddíl, otevřený přehled → přehled), waitingWhyEl · src/research-waiting.ts personWaiting, panelWaiting (focus první) · src/ui/waiting-task-ui.ts waitingAnswerAction · src/card-signals.ts ACTION_GLYPH waiting '!' · strings.ts card.menuAnswer, card.menuWaiting, card.tipClickAnswer, live.waitingNoAnswerHere · e2e/card-waiting-answer.spec.ts · hypotézy: app:src/ui/hypothesis-waiting-ui.ts (commit 8d7f1597), research:src/core/waiting.ts hypothesesApp -->

<a id="S4.4.1"></a>
### S4.4.1 Mehrere Marken auf der Personenkarte

Das Kärtchen einer Person hat in der Ecke des Porträts (Foto oder Initialen) höchstens eine Marke der Forschung je Art:
**!** (etwas wartet, [S4.4](#S4.4)), **≠** (Widerspruch der Quellen, [R5](R5-conflicts.md)) und **?** (offene Frage).
Mit einer Marke verhält sich die Karte wie bisher. Zwei oder drei Marken stehen hintereinander gestaffelt als eine
Schaltfläche.

- **Grenzen:**
  - Reihenfolge der Marken: wartet › Widerspruch › Frage; vorn, wo eine einzelne Marke steht, ist die dringendste, die
    hinteren sind ohne Zeichen. Es erscheinen nur die Arten, die in **Einstellungen → Personenkarte → Auf der Karte
    zeigen** eingeschaltet sind (**Wartet auf Bearbeitung**, **Widersprüchliche Quellen**, **Offene Fragen**);
  - das Popup beim Überfahren mit der Maus hat eine Zeile je Marke (was wartet, mit dem Text der ersten Aufgabe,
    Widersprüche und Hypothesen, Frage) und darunter „Klick: auswählen, was sich öffnet“. Ein Bildschirmleser hört,
    was wartet („3 wartend, 2 Widersprüche, 1 Hypothese, 1 Frage“);
  - ein Klick öffnet bei den Marken ein kleines Fenster mit Namen und Jahren der Person (Bildschirmleser: „{Name}: was
    wartet“) und den Wahlen: **Antworten · N wartend** mit dem Text der ersten Aufgabe (auf einem Touch-Gerät
    **Wartet auf Erledigung · N ›**), **Vergleichen** (neue Version einer Erzählung), **Was die Forschung weiß · … ›**
    (Widersprüche, Hypothesen und Frage als eine Wahl), **Forschung verfolgen ›** (der Agent arbeitet an der Person).
    Die Wahlen bleiben in der App, keine hat eine Marke der Forschung ([S4.5.1](#S4.5.1));
  - nur Widerspruch und Frage ergeben eine einzige Wahl: ein Klick öffnet direkt **Was die Forschung weiß** („Klick:
    was die Forschung weiß“);
  - das Fenster steht unter den Marken, am rechten oder unteren Rand des Fensters umgekehrt, wo es nirgends passt, oben
    und scrollt. Es schließt ein Klick daneben (der sonst nichts tut), ein zweiter Klick auf die Marken, Esc, eine
    Wahl, Verschieben oder Vergrößern des Stammbaums, eine Änderung der Fenstergröße und ein Neuzeichnen des
    Stammbaums. Auf dem Telefon (bis 640 px) ist es ein Blatt von unten mit Zeilen von 48 px, es schließt ein Tippen
    daneben oder Ziehen nach unten; auf dem Tablet und dem quer gehaltenen Telefon ein Fenster mit Zeilen von 44 px;
  - Tastatur: Enter, Leertaste oder Pfeil nach unten auf den Marken öffnet das Fenster auf der ersten Wahl, die Pfeile
    laufen im Kreis, Pos1 und Ende, Enter wählt, Esc kehrt zu den Marken zurück, Tab geht weiter;
  - ein Kärtchen ohne Porträt (**Kartendetail → Kompakt**) hat statt der Marken zwei Punkte. Ist der Stammbaum unter
    0,55 verkleinert, hat jedes Kärtchen, in jedem **Kartendetail**, statt der Marken einen Punkt. Der Druck des
    Stammbaums hat keine Marken.
- **Bedienung:** App: Klick auf die Marken in der Ecke des Porträts; **Einstellungen → Personenkarte → Auf der Karte
  zeigen**.
- **Gilt seit:** App 3.27.0

<!-- zdroj: app:16461aca, 85c1f704, abf7620f src/card-signals.ts ACTION_ORDER (waiting, conflict, question), presentActions (zapnuté v Na kartě ukázat), stackChoices (waiting, story, knows, agent), ACTION_GLYPH · src/card-signal-marks.ts cardActionMarksHtml (stoh n2/n3, tečky), stackAriaLabel, stackTipHtml (tipClickChoose / tipClickKnows), stackMenuItemsHtml (menuAnswer / dotyk menuWaiting, story.compare, menuKnows, menuAgent; bez značky výzkumu), placeStackMenu · index.html .card-signal-stack, #tree-canvas.zoom-far (src/zoom.ts ZOOM_FAR = 0.55; index.html:13732-13741 jedna tečka u všech Detailů karet, e2e/card-signals.spec.ts:353), body.view-mode-print bez značek, compact dvě tečky · strings.ts card.stackLabel, stackWaiting, stackMenuLabel, tipClickChoose, cardDensity.cardWaiting, cardConflict, cardQuestion, compact · CHANGELOG.cs.md 3.27.0 „Více značek na kartě“ · dirigent:prace/1111-app-karta-vice-znacek -->

<a id="S4.4.2"></a>
### S4.4.2 Suche in Wartet auf Bearbeitung

Der Abschnitt **Wartet auf Bearbeitung** in der **Forschungsübersicht** hat das Feld **Person, Ort, Archiv, Aufgabe
suchen…**. Die App sucht selbst in den Einträgen, die sie schon hat, und schickt nichts an die Forschung. Sie filtert
gleich beim Tippen, auch ohne Verfolgen, wenn die Forschung nicht läuft (die Einträge, die die Forschung zuletzt
gesagt hat, [S4.1.5](#S4.1.5)), und im Fenster der Übersicht ([S4.1.6](#S4.1.6)).

- **Wann das Feld da ist:** in einem aufgeklappten Abschnitt mit 10 und mehr Einträgen, unter der Überschrift des
  Abschnitts und über den Chips der Arten. Mit eingegebenem Text bleibt das Feld, auch wenn es weniger Einträge
  werden.
- **Was gefunden wird:** Einträge, die jedes eingegebene Wort haben (in beliebiger Reihenfolge; Wörter trennt ein
  Leerzeichen, ein Komma oder ein Semikolon) in dem, was ihre Zeile, ihr Detail oder die Überschrift ihrer Gruppe
  zeigt:
  - der Text des Eintrags und worauf er wartet;
  - Namen und Nummern von Personen (`P47` und `P0047`);
  - die Nummer einer Aufgabe (`T0815`, `t815`) und einer Hypothese (`H22`); eine bloße Zahl (`815`) findet die
    Aufgabe mit dieser Nummer, sonst die Hypothese, sonst Text (etwa ein Jahr);
  - der Name der Gruppe (Ort, Archiv, Amt), die Adresse des Archivs bei einer Erlaubnis und an wen ein Brief geht.
- **Übereinstimmung im Text:** ohne Rücksicht auf Groß- und Kleinschreibung und diakritische Zeichen; ß, ł, đ, ø, æ
  und œ werden auch als ss, l, d, o, ae und oe gefunden (`grosshof` findet „Großhof“). Ein Wort mit 5 und mehr
  Zeichen findet auch Wörter, die wie es ohne das letzte Zeichen beginnen (`bialy` findet „Białe“).
- **Grenzen:**
  - die Chips der Arten (**Entscheidungen**, **Bilder**, **Archive und Ämter**…) zeigen die Zahl der Gefundenen;
    eine Art ohne Treffer ist gestrichelt und lässt sich weiter wählen. Gesucht wird in der gewählten Art;
  - über der Liste „12 von 40 gefunden“ (aus den Einträgen der gewählten Art). Ohne Ergebnis **Nichts gefunden.**,
    in einer gewählten Art „In der Art Bilder nichts gefunden.“ mit **In allen Arten suchen**, und **Suche
    aufheben**;
  - Phasen (**Zu erledigen**, **Wartet auf Antwort**) und Gruppen mit Treffer klappen auf, ohne Treffer erscheinen
    sie nicht. Was während der Suche eingeklappt wird, gilt nur für diese Suche; nach dem Leeren des Felds kehrt das
    manuelle Aufklappen zurück;
  - ein Treffer bei der Nummer einer Person, Aufgabe oder Hypothese hat an der Zeile ein bernsteinfarbenes Etikett
    („P0108 Jan Horák“); ein Treffer im Text wird nicht hervorgehoben;
  - Hypothesen in der Gruppe **Hypothesen zu entscheiden**: der Kopf der Auswahl **Gefundene mit Vorschlag auswählen
    (n)** wählt nur die Gefundenen. Ausgewählte außerhalb der Suche bleiben ausgewählt, und die Fußzeile sagt es
    („5 ausgewählt, davon 2 außerhalb der Suche.“) mit **Auswahl außerhalb der Suche aufheben**. **Vorschläge
    annehmen (n)** zählt alle ausgewählten ([S3.5.2](S3-what-the-research-knows.md#S3.5.2));
  - ein eingeklappter Abschnitt mit eingegebener Suche hat in der Überschrift statt der Zusammenfassung eine Lupe und
    den gesuchten Text;
  - eine ältere Forschung ohne Arten und Gruppen: gesucht wird in den Zeilen, wie sie aufeinander folgen;
  - × oder Escape leert das Feld (Escape im leeren Feld schließt die Übersicht), ↓ geht zur ersten Zeile, ein
    Bildschirmleser sagt die Zahl nach einer kurzen Pause. Der Text gilt bis zum Schließen der Übersicht und wird
    nirgends gespeichert;
  - Telefon: das Feld ist 44 px hoch; nach einem Tippen ins Feld rückt der Abschnitt unter den Kopf der Übersicht,
    und die Übersicht endet über der Tastatur, sodass das Gefundene zwischen Feld und Tastatur steht.
- **Bedienung:** App: **Forschungsübersicht → Wartet auf Bearbeitung**, Suchfeld.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:8cbada1c src/section-search-match.ts foldSearch2 (ß ł đ ø æ œ), tokenize (mezera, čárka, středník; p/t/h + číslo, samotné číslo), matchDoc (každé slovo; n: úkol, hypotéza, text), textMatches (≥ 5 znaků bez posledního na začátku slova), fieldVisible (≥ 10 nebo text) · src/ui/section-search.ts (×, Escape: nejdřív hledání, prázdné pole zavře Přehled; ↓; searchOpen se vymaže s textem; zavření Přehledu text zahodí) · app:9ebf7f2c src/section-search-filter.ts searchSection, chipCount, sectionPartOpen, toggleSectionPart, sheetOverKeyboard · src/ui/section-search-view.ts mountSectionSearch, paintSearchChip (čárkovaný), appendSearchOutcome (sectionSearchFound, queueSearchNone, sectionSearchNoneKind + sectionSearchAllKinds, queueSearchCancel), searchHitTag, searchSummaryEl (lupa a text), bindSheetSearch, keepSheetOverKeyboard · src/ui/research-overview-ui.ts appendOverviewWaiting (pole jen v rozbaleném oddílu, starší výzkum bez skupin), waitingSearchDoc (what, on, osoby, person, partner, task, hypo, group.name / otázky k místům, host, to), overviewWaitingRow (hit t, p) · app:cd0030b0 src/ui/hypothesis-waiting-ui.ts hypothesisAcceptHeadEl (bulkSelectFound), hypothesisAcceptFootEl (bulkSelectedHidden, bulkDeselectHidden), hwr-id hit h · strings.ts live.waitingSearchPlaceholder, waitingSearchAria, sectionSearchFound, sectionSearchNoneKind, sectionSearchAllKinds, bulkSelectFound, bulkSelectedHidden, bulkDeselectHidden, sectionSearchQuoted, waitingPhaseTodo, waitingPhaseSent, waitingChips · e2e/overview-waiting-search.spec.ts · CHANGELOG.cs.md 3.28.0 (e540e4b5) · spec 083 K1.1–K1.3 · prace/1113-app-hledani-v-prehledu (pole 44 px na telefonu) -->

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
- **Ab App 3.28.0:** **An der Warteschlange arbeiten…** und in seinem Dialog **Terminal öffnen** haben die Marke KI
  und Terminal ([S4.2.3](#S4.2.3)). Die Suche in der Warteschlange, **Als Nächstes erledigen** und **Rückgängig** sind
  ohne Marke: sie gehen über die Brücke und öffnen nichts ([S4.2.1](#S4.2.1), [S4.2.2](#S4.2.2)).

<!-- zdroj: app:v3.21.2 src/research-link.ts:66 RESEARCH_LINK_MARKS, researchLinkMark (task do=chat, conflict do=agent, experiment do=off, fixes paid) · strings.ts research.openingAgent, research.openingAgentHint · research:v1.25.2 src/commands/links.ts:373 whereToTalk · 3.28.0: app 9cf43b22 researchLinkMark('work') u queue-work-btn, research-item-queue-work, Otevřít terminál; ZADANI_DEV_fronta-hledani „Značení akcí“ -->

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
- **Ab App 3.28.0:**
  - im Menü **Forschung** steht unter **Mit dem Agenten weitermachen** der Eintrag **An der Warteschlange arbeiten…**
    ([S4.2.3](#S4.2.3)), wenn er angeboten wird. Sind es oben mehr als 6 Einträge, rückt **Forschung öffnen** als
    erster Eintrag in **Weitere Aktionen**;
  - in **Jetzt** stehen die Aktionen unter dem Text jeder Sitzung, in einer Zeile: **Im Stammbaum zeigen** ·
    **Abschließen und beenden**. Auf dem Telefon gibt es nur **Im Stammbaum zeigen**.

<!-- zdroj: app:v3.21.2 src/ui/research-actions-ui.ts:152 UNDO_MAX_AGE_MS, :158 FIRST_LEVEL_MAX, :300 researchMenuShown, :435 tools, :1000 personResearchActions · src/research-link.ts:115 RESEARCH_TOOL_GROUPS, :132 RESEARCH_TOOL_ACTIONS · research-overview-ui.ts:811, :870 finishSession · strings.ts research.footerFull, research.tools.*, research.reviewWhere, research.continueAgent · 3.28.0: app 9cf43b22 src/ui/research-actions-ui.ts research-item-queue-work za research-item-chat (queueWorkMenuOffered), FIRST_LEVEL_MAX 6: research-item-open do more · 623d9c77 src/ui/research-overview-ui.ts overviewNowActions (now-actions pod textem: showInTree · finishSession, finish ne v sheet), overviewNowLine (každé sezení svůj řádek) · ZADANI_DEV_fronta-hledani §6 (varianta A) -->

<a id="S4.5.3"></a>
### S4.5.3 Eine Aufgabe in der Warteschlange öffnen

**Aufgabe T… öffnen** öffnet eine Aufgabe in der Warteschlange im Terminal der Forschung. Das Terminal zeigt die
Aufgabe und fragt, was jetzt mit ihr geschehen soll.

- **Grenzen:**
  - das Terminal zeigt **Die Aufgabe T… steht in der Warteschlange: der Agent nimmt sie, wenn sie an der Reihe ist.**,
    **Warum: …** und **Erledigt, wenn: …** und fragt **Was nun?**:
    - **Jetzt mit dem Agenten (…) durchgehen, im Gespräch**: fragt zuerst und sagt, was ähnliche Sitzungen hier
      gekostet haben, oder dass es noch nicht bekannt ist;
    - **In der Warteschlange nach vorn (höchste Priorität)**: Priorität 5; hat die Aufgabe sie schon, geschieht nichts;
    - **In der Warteschlange lassen, wie sie ist**;
  - Enter oder 0 schreibt nichts. Mit einer Aufgabe, an der der Agent gerade arbeitet, geschieht nichts;
  - eine Aufgabe, die auf den Menschen wartet, öffnet ihre bisherige Frage.
- **Bedienung:** App: **Aufgabe T… öffnen** (Marke Terminal) nach dem Anlegen einer Aufgabe aus einer neuen Lesung und
  in der Zeile bei der Quelle ([R8.8.3](R8-reading-scans.md#R8.8.3)). Terminal: `strom chat --task T…` nimmt die
  Aufgabe aus der Warteschlange direkt ins Gespräch.
- **Gilt seit:** Forschung 1.29.0, App 3.25.0

<!-- zdroj: research:c2a690ea src/cli/menu-links.ts (odkaz task bez do, úkol open) · assets/lang/cs.json ui.link.open.title/why/done/pick/chat/ahead/keep/already/kept/busy/estimate/estimate.none, ui.chat.task.open.say · strom help chat (--task: „a task in the queue (open): gone through now, taken up in the conversation“) · commit 9bd14e84 · test/cli/link-open-task.test.ts · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 7; klik v aplikaci neověřen) · app:6bd8609e strings.ts read.openTaskN, src/__tests__/read-source-state-view.test.ts:75 (researchLinkMark task) -->

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
- **Ab App 3.28.0:** mit Forschung 1.32.0 lässt sich um selbstständige Arbeit des Agenten an der Warteschlange aus
  der App bitten ([S4.2.3](#S4.2.3)). Gestartet wird sie vom Terminal der Forschung erst nach der Bestätigung
  ([R7.1.2](R7-when-the-agent-works.md#R7.1.2)); die Bedingung und ihre Einstellung bleiben im Terminal.

<!-- zdroj: research:v1.25.2 src/core/links.ts (hlavička: nic se nezapíše bez slova člověka v terminálu) · src/core/live.ts (hlavička mostu) · app:v3.21.2 src/research-link.ts:66 · HEAD src/research-directions-write.ts · 3.28.0: app 9cf43b22 src/ui/queue-work-dialog.ts (aplikace nic nespouští, odkaz work) · spec 052 K6.2 (cesta terminál) -->
