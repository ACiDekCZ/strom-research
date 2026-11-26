<a id="A11"></a>
# A11 Personenlisten

Eine Personenliste hält ausgewählte Personen des Stammbaums unter einem Namen, damit sich wiederholt mit ihnen
arbeiten lässt: in der Tabelle als ihr Umfang ([A6.7.19](A6-views.md#A6.7.19)), im Export und als Arbeitsliste zum
Abhaken. Eine Liste entsteht nach einer Regel (Stammlinie, Vorfahren, Nachkommen, Forschungslinie, Filter der
Tabelle, wann die Personen hinzukamen, eigene Regel aus Bedingungen), aus den Ergebnissen der Suche oder von Hand.
Das Kapitel beschreibt die Strom-App 3.32.0.

<!-- zdroj: dirigent:spec/084-seznamy-osob (K1.1–K8.4, rozhodnutí 14. a 16. 11.) · app:714a8ab2..60265541 (dirigent:prace/1116-app-084-seznamy) · app:docs/ZADANI_DEV_seznamy-osob.md §1–§13, §15, §16 · app:src/person-lists.ts, src/person-lists-data.ts · app:CHANGELOG.cs.md 3.30.0 „Pojmenované seznamy osob“ · 3.32.0 vlastní pravidla: dirigent:spec/136-pravidla-seznamu (fáze 1, K1.1–K1.10) · app:a07c78b2..efc14cff (merge 78807628) · app:CHANGELOG.cs.md 3.32.0 „Vlastní pravidla seznamů“ -->

<a id="A11.1"></a>
## A11.1 Feste Liste, automatische Liste und Arbeitsliste

Eine Liste ist **fest** oder **automatisch**. Eine feste Liste hält ihre Personen und ändert sich nur von Hand. Eine
automatische Liste ist eine gespeicherte Regel: ihre Personen werden jedes Mal neu berechnet.

| Art | Was sie hält | Von Hand hinzufügen und entfernen | Manuelle Reihenfolge |
|---|---|---|---|
| **fest** | Personen in manueller Reihenfolge; die Regel, aus der sie entstand (**Entstanden aus**), wenn sie eine hat | ja | ja |
| **automatisch** | nur die Regel (**Nach**) | nein: „Den Inhalt bestimmt die Regel – manuell wird nichts hinzugefügt oder entfernt.“ | nein |
| **Arbeitsliste** | eine feste Liste mit eingeschaltetem **Erledigtes abhaken** ([A11.8](#A11.8)) | ja | ja |

- Die Art steht bei der Liste in der Übersicht (Symbol und das Wort **fest**, **automatisch**, **Arbeitsliste**), im
  Detail (Etikett **Feste Liste**, **Automatische Liste**, **Arbeitsliste**) und unter **Umfang** der Tabelle (Symbol).
- Eine Liste hat einen Namen. Der Name ist im Stammbaum eindeutig; verglichen wird ohne Rücksicht auf diakritische
  Zeichen, Groß- und Kleinschreibung und überzählige Leerzeichen. Ein vergebener Name wird nicht gespeichert: „Eine
  Liste mit diesem Namen gibt es schon. Vorschlag: „{Name} (2)“.“ (die nächste freie Nummer).
- Platzhalterpersonen sind nie in einer Liste.
- **Grenzen:** Listen ändern sich nur in einem Stammbaum, der sich ändern lässt. In einem schreibgeschützten
  Stammbaum (exportierte HTML-Seite, verfolgter Stammbaum, von einer neueren Version der App gespeicherter Stammbaum,
  gesperrter Stammbaum) lassen sich Listen ansehen und in der Tabelle öffnen, die Bearbeitung fehlt; die Verwaltung
  hat das Etikett **Nur lesen**. Eine gesperrte Person lässt sich zu einer Liste hinzufügen.
- Ab App 3.32.0 kann eine feste wie eine automatische Liste auf einer eigenen Regel aus Bedingungen stehen
  ([A11.2.4](#A11.2.4)), und eine feste Liste mit Regel lässt sich wieder automatisch machen (**Nach Regel aktuell
  halten**, [A11.2.2](#A11.2.2)).
- **Bedienung:** **Aktionen → Personenlisten…** ([A11.3](#A11.3)).
- **Gilt seit:** App 3.30.0; 3.32.0: eigene Regel, **Nach Regel aktuell halten**

<!-- zdroj: app:src/person-lists.ts listKind (dynamic → auto, checklist → work), listPersonIds (bez zástupných osob) · src/person-lists-data.ts foldListName, isListNameTaken, suggestListName · src/data.ts:2130 listsReadOnly (isReadOnly || isTreeLocked; isTreeLocked: sledovaný strom liveTreeId, isNewerData, isLocked) · src/ui/person-list-add.ts personListMenuRows (zamčená osoba ano, app:60265541) · strings.ts lists.kind.*, badge.*, rule.key, rule.origin, autoInfo, save.dup, readOnly · ZADANI_DEV §1, §16c, Q1 -->

<a id="A11.2"></a>
## A11.2 Die Regel einer Liste

Die Regel sagt, welche Personen zur Liste gehören. Eine feste Liste wendet sie einmal bei ihrem Entstehen an, eine
automatische jedes Mal.

| Regel | Wen sie findet | Name der neuen Liste | Standardsortierung |
|---|---|---|---|
| **Leer** | niemanden, Personen werden von Hand hinzugefügt | – | **Manuell** |
| **Stamm** | die blutsverwandten Mitglieder der Stammlinie ([A4](A4-surnames-and-families.md)) | **Stamm** und der Name der Stammlinie | **Älteste zuerst** |
| **Vorfahren einer Person** | die Vorfahren der gewählten Person, **alle Generationen** oder **bis N Generationen** | „Vorfahren – {Person}“ | **Nach Generationen** |
| **Nachkommen einer Person** | die Nachkommen der gewählten Person, alle Generationen oder bis N Generationen | „Nachkommen – {Person}“ | **Nach Generationen** |
| **Forschungslinie** | die Personen einer Forschungslinie, wie der Chip der Linie in der Tabelle ([A6.7.14](A6-views.md#A6.7.14)) | Name der Linie | **Älteste zuerst** |
| **Hinzugefügt im Zeitraum** | in den letzten 7, 30, 90 oder einer anderen Zahl von Tagen zum Stammbaum hinzugefügte Personen ([A11.7](#A11.7)) | „In den letzten {n} Tagen hinzugefügt“ | **Nach Hinzufügen** |
| Filter der Tabelle | die Zeilen der Tabelle nach Filter und Sortierung ([A11.6](#A11.6)) | Name der Ansicht | **Manuell** (Reihenfolge der Tabelle) |
| **Eigene Regel** (ab App 3.32.0) | die Personen, die zu Gruppen zusammengesetzte Bedingungen erfüllen ([A11.2.4](#A11.2.4)) | wird eingegeben; aus einer Vorlage ihr Name ([A11.2.10](#A11.2.10)); mit der einzigen Bedingung **Familie einer Person** „Familie – {Person}“ | **Älteste zuerst** |

- **Partner:** Stammlinie, Vorfahren und Nachkommen nehmen nur Blutsverwandte. Ein Partner, der durch Heirat in die
  Familie kam, ist nicht in der Liste, bis er von Hand hinzugefügt wird.
- Generationen lassen sich von 1 bis 10 wählen oder **alle Generationen**. Die Zahl der Tage ist 1 bis 3650. Der Tag,
  ab dem die Liste zählt, ist der erste Tag des Zeitraums („in den letzten 30 Tagen“ = heute und die 29 Tage davor).
- Der Name ändert sich mit der Wahl der Regel, bis das Feld **Name** überschrieben wird.
- Jede Wahl zeigt die Zahl der Personen, die die Liste bekäme. Forschungslinie gibt es nur in einem Stammbaum mit
  Linien.
- **Aktuell halten** (standardmäßig aus) macht eine automatische Liste; sonst entsteht eine feste: „Feste Liste: Die
  Personen werden jetzt gewählt und ändern sich danach nur von Hand. Die Regel bleibt für „Nach Regel ergänzen“.“
- Ab App 3.32.0 ist die letzte Wahl **Eigene Regel** („aus Bedingungen zusammensetzen“): Statt der Wahlen erscheint
  das Zusammensetzen der Regel ([A11.2.4](#A11.2.4)). **Eigene Regel ▾** kehrt zu einer anderen Wahl zurück; eine
  Regel mit einer einzigen Bedingung, die die Wahl kennt, übernimmt sie samt Einstellungen. Eine Regel, die eine Wahl
  kennt (eine Bedingung ohne „außer“), wird als Regel dieser Wahl gespeichert. **Regel bearbeiten…** einer Liste mit
  eigener Regel öffnet gleich das Zusammensetzen.
- Ab App 3.32.0 haben **Vorfahren einer Person** und **Nachkommen einer Person** den Link **Mehr Möglichkeiten:
  Familie einer Person…**: eine eigene Regel mit einer Bedingung **Familie einer Person** ([A11.2.6](#A11.2.6)).
- **Bedienung:** **Personenlisten → Neue Liste…** → **Nach**, **Aktuell halten**, **Erstellen**; bei einer Liste
  **Regel bearbeiten…**. Danach öffnet sich die Verwaltung mit der neuen Liste und die Meldung „Liste „{Name}“
  gespeichert.“ Ab App 3.32.0 steht rechts in der Zeile **Nach** auch **Mit Vorlage beginnen ▾**
  ([A11.2.10](#A11.2.10)).
- **Gilt seit:** App 3.30.0; 3.32.0: **Eigene Regel**, **Mehr Möglichkeiten: Familie einer Person…**

<!-- zdroj: app:src/person-lists.ts rulePersonIds (rods/ancestors/descendants přes selection().memberIds – jen pokrevní, Q2; line přes personLineRole jako čip linie; tableFilter filterRows + sortRows; added: startOfDay − (days − 1) dní), ruleLabel · src/ui/person-list-new-ui.ts PERIODS 7/30/90, MAX_GENERATIONS 10, MAX_DAYS 3650, jméno podle pravidla do přepsání, počet u volby · ZADANI_DEV §3 (výchozí řazení podle pravidla), Q2 · app:e09dcacb · strings.ts lists.new.*, keep, keepOn, keepOff, create, toast.saved, rule.* · 3.32.0: src/ui/person-list-new-ui.ts (volba custom jako poslední, customToRule při uložení, moreFamily, Upravit pravidlo… vlastního pravidla rovnou do sestavení, newPersonListTemplateHtml), src/data.ts createCustomPersonList (řazení old), strings.ts lists.new.customRule, customRuleSub, fromTemplate, moreFamily, nameFamily (app:3a7e8595) -->

<a id="A11.2.1"></a>
### A11.2.1 Nach Regel ergänzen

Eine feste Liste, die aus einer Regel entstand, kann sie erneut anwenden: **Nach Regel ergänzen** fügt die Personen
hinzu, die die Regel heute findet und die nicht in der Liste sind.

- Eine von Hand aus der Liste entfernte Person kehrt durch das Ergänzen nicht zurück. Sie kehrt nur durch Hinzufügen
  von Hand zurück.
- Neue Personen kommen ans Ende der manuellen Reihenfolge, geordnet nach der Sortierung der Liste (bei manueller
  Sortierung **Älteste zuerst**).
- Meldung: „N Personen nach der Regel hinzugefügt.“ mit **Rückgängig**; kommt nichts hinzu, „Die Liste ist
  vollständig.“
- Eine feste Liste ohne Regel (leer entstanden oder aus den Ergebnissen der Suche) hat diese Wahl nicht.
- **Bedienung:** Detail der Liste, Zeile **Entstanden aus** → **Nach Regel ergänzen**.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:src/person-lists.ts withRuleFilled (bez personIds a removed, na konec, ruční → old), withPersonsRemoved (removed jen s pravidlem), withPersonsAdded (ruční přidání vyjme z removed) · strings.ts lists.fill, toast.filled, toast.full · ZADANI_DEV §3c -->

<a id="A11.2.2"></a>
### A11.2.2 Eine automatische Liste einfrieren

**Einfrieren** macht aus einer automatischen Liste eine feste mit den jetzigen Personen in der jetzigen Reihenfolge
(„Wird fest mit den heutigen Personen“). Die Regel bleibt als **Entstanden aus**, ab App 3.32.0 auch eine eigene
Regel.

- Meldung „Liste eingefroren – jetzt fest.“ mit **Rückgängig**.
- Bis App 3.31.0 lässt sich aus einer festen Liste keine automatische machen. Ab App 3.32.0 kann das **Nach Regel
  aktuell halten** („Wird wieder nach der Regel berechnet“) bei einer festen Liste mit Regel: Die Liste wird wieder
  nach der Regel berechnet, von Hand hinzugefügte und entfernte Personen, Häkchen und die manuelle Reihenfolge
  entfallen (**Manuell** wird zu **Älteste zuerst**).
  - Gibt es etwas zu verwerfen, fragt es zuerst: „Nach Regel aktuell halten?“ – „Die Liste wird nach der Regel
    berechnet. Von Hand hinzugefügte ({a}) und entfernte ({r}) Personen sowie die manuelle Reihenfolge entfallen.“
    (die manuelle Reihenfolge nur, wenn die Liste eine hat).
  - Meldung „Die Liste folgt jetzt der Regel.“
  - Eine Arbeitsliste geht nicht: „Zuerst Erledigtes abhaken ausschalten“.
- **Bedienung:** **⋯** einer automatischen Liste → **Einfrieren**; ab App 3.32.0 **⋯** einer festen Liste mit Regel
  → **Nach Regel aktuell halten**.
- **Gilt seit:** App 3.30.0; 3.32.0: eigene Regel, **Nach Regel aktuell halten**

<!-- zdroj: app:src/person-lists.ts withFrozen (dynamic false, personIds = listPersonIds, rule zůstává) · strings.ts lists.menu.freeze, freezeSub, toast.frozen · app:3dc8e709 · 3.32.0: src/person-lists.ts withFrozen (custom.auto false), keptByRuleLoss (added, removed, manual; null u pracovního), withKeptByRule (removed, done, checklist ven, manual → old) · src/ui/person-list-hooks.ts freezeAndChecklistRows, keepByRule (ptá se jen při ztrátě) · src/data.ts keepPersonListByRule · strings.ts lists.menu.keepByRule, keepByRuleSub, keepByRule.*, toast.keptByRule · app:5959ed63 -->

<a id="A11.2.3"></a>
### A11.2.3 Eine Regel, die nichts mehr findet

Verschwindet, worauf die Regel steht, bleibt die Liste bestehen, nur leer, und sagt, warum:

- „Die Regel findet nichts mehr: {Name} wurde gelöscht.“ (Vorfahren oder Nachkommen einer gelöschten Person; den
  Namen merkt sich die Regel aus der Zeit ihres Entstehens);
- „Die Regel findet nichts mehr: Der Stamm existiert nicht mehr.“;
- „Die Regel findet nichts mehr: Die Linie wurde entfernt.“
- Unter dem Satz stehen **Regel bearbeiten…** und **Liste löschen**.
- Ab App 3.32.0: Eine eigene Regel zeigt stattdessen, was fehlt, und zählt eine Bedingung mit fehlendem Verweis als
  leer ([A11.2.11](#A11.2.11)).
- **Gilt seit:** App 3.30.0; 3.32.0: eigene Regel

<!-- zdroj: app:src/person-lists.ts ruleBroken (person podle rule.personName, rod, line) · strings.ts lists.ruleGone, ruleGoneRod, ruleGoneLine, deleteList · ZADANI_DEV §7d -->

<a id="A11.2.4"></a>
### A11.2.4 Eigene Regel: Bedingungen und Gruppen

Eine **Eigene Regel** setzt Bedingungen ([A11.2.5](#A11.2.5)) zu Gruppen zusammen. Die Gruppe sagt, wie sich ihre
Bedingungen verbinden: **Alle gelten** (die Person muss jede erfüllen) oder **Mindestens eine gilt** (eine genügt).

- Die Bedingungen nach der ersten beginnen mit „und“ (**Alle gelten**) oder „oder“ (**Mindestens eine gilt**).
- **außer** bei einer Bedingung oder Gruppe nimmt die Personen weg, die sie erfüllen. Die Einträge mit „außer“ stehen
  am Ende ihrer Gruppe, und weggenommen wird jede Person, die einen von ihnen erfüllt. Der erste Eintrag einer Gruppe
  kann nicht „außer“ sein; eine Gruppe nur aus „außer“ findet niemanden.
- Eine Gruppe ist ein Eintrag wie eine Bedingung: Sie hat ein eigenes **Alle gelten** / **Mindestens eine gilt** und
  kann „außer“ haben. Eine Regel hat höchstens drei Ebenen (die ganze Regel ist die erste); in der dritten Ebene gibt
  es **+ Gruppe hinzufügen** nicht.
- **Gruppieren mit…** macht aus einer Bedingung und der Bedingung darunter eine Gruppe **Alle gelten**. Zwei
  Bedingungen mit „außer“ verbinden sich zu einer Gruppe „außer“ mit **Mindestens eine gilt** (sie nimmt dieselben
  Personen weg).
- Zeile einer Bedingung: das verbindende Wort, der Name der Bedingung mit ihren Einstellungen, ihre eigene Zahl von
  Personen ([A11.2.9](#A11.2.9)) und **⋯**: **außer** / **Einbeziehen**, **Nach oben** / **Nach unten**,
  **Gruppieren mit…**, **Duplizieren**, **Entfernen**. **⋯** einer Gruppe: **außer**, **Gruppe auflösen**, **Nach
  oben** / **Nach unten**, **Gruppe entfernen**.
- Das Entfernen meldet „Bedingung entfernt.“ mit **Rückgängig**. Strg+Z (⌘Z) nimmt den letzten Schritt beim
  Zusammensetzen zurück; Änderungen des Stammbaums nimmt es nicht zurück.
- Eine neue Bedingung bekommt die Standardeinstellungen ([A11.2.5](#A11.2.5)); Person ist die zentrale Person der
  Ansicht.
- **Erstellen** (beim Bearbeiten **Speichern**) wartet auf eine Regel, die sich speichern lässt. Die Fußzeile sagt,
  warum: „Noch keine Bedingung“, „Bedingung {i} ist unvollständig“, „Eine Gruppe braucht eine Bedingung ohne „außer““
  oder „Die Regel lässt sich so nicht speichern“ (leere Gruppe, mehr als drei Ebenen, Kreis über Listen,
  [A11.2.8](#A11.2.8)).
- Das Schließen des Dialogs mit einer unfertigen Regel, in der mehr als eine Bedingung bearbeitet ist, fragt:
  „Unfertige Regel verwerfen?“ (**Weiter bearbeiten** / **Verwerfen**).
- **Aktuell halten** gilt auch hier: eingeschaltet macht es eine automatische Liste, ausgeschaltet eine feste mit
  den Personen, die die Regel jetzt findet.
- **Bedingung hinzufügen…** bei einer Liste mit Regel öffnet den Dialog der Regel mit der bisherigen Regel und der
  Wahl einer neuen Bedingung; eine Regel aus einer Wahl (z. B. **Vorfahren einer Person**) wird zur ersten Bedingung.
  Eine feste Liste behält ihre Personen, nur die Regel **Entstanden aus** ändert sich (danach **Nach Regel
  ergänzen**, [A11.2.1](#A11.2.1)).
- **Grenzen:** höchstens drei Ebenen von Gruppen; Rückgängig beim Zusammensetzen höchstens 50 Schritte. Die Grenzen
  der Einstellungen stehen in [A11.2.5](#A11.2.5), die Geschwindigkeit des Zählens in [A11.2.9](#A11.2.9).
- **Bedienung:** **Neue Liste…** → **Nach** → **Eigene Regel**; **+ Bedingung hinzufügen** öffnet den Katalog der
  Bedingungen mit dem Feld **Bedingung suchen**, **+ Gruppe hinzufügen** eine Gruppe mit einer Bedingung aus dem
  Katalog. **⋯** der Regel: **Als Vorlage speichern…** ([A11.2.10](#A11.2.10)), **Regel leeren**. Verschieben einer
  Zeile: Ziehen am Griff (nur Maus), Alt+↑ / Alt+↓ oder **⋯**. **⋯** einer Liste oder der Link im Detail →
  **Bedingung hinzufügen…** ([A11.3](#A11.3)). Auf dem Telefon steht das verbindende Wort vor dem Namen der Bedingung
  und die Menüs sind Panels von unten.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:src/person-list-rules.ts (RULE_MAX_DEPTH 3; skupina all = průnik kladných, any = sjednocení, minus sjednocení kromě; ruleIssues: incomplete, depth, empty, exceptFirst, exceptOnly, cycle), src/person-list-rule-edit.ts (canExcept: ne první položka; toggleExcept na konec skupiny; canAddGroup; groupWithNext: dvě kromě → skupina any s kromě), src/ui/person-list-rule-ui.ts (UNDO_MAX 50, UNDO_MS 6000, řádek a ⋯, Ctrl+Z, ruleBuilderStartAdd, důvod v patičce), src/ui/person-list-new-ui.ts (startWith addCondition, ruleToCustom, discard u víc než jedné upravené podmínky, primární Vytvořit / Uložit), src/data.ts setPersonListCustomRule (pevný si nechá personIds) · strings.ts lists.rules.all, any, and, or, except, include, addCondition, addGroup, intoGroup, dissolve, removeGroup, remove, removed, clear, noConditions, incomplete, needPlus, cantSave, discard.*, firstOfGroup, catalog.search, lists.addCondition, lists.up, down, menu.dup · app:3a7e8595, ffc7ff32, 5959ed63, 0bd2e438 · spec 136 K1.1, K1.2, K1.5 -->

<a id="A11.2.5"></a>
### A11.2.5 Bedingungen einer eigenen Regel

Der Katalog der Bedingungen hat die Gruppen **Familie und Linien**, **Leben in der Zeit**, **Orte**, **Person**,
**Angaben** und **Aus dem Stammbaum und der Tabelle**, in der Reihenfolge der Tabelle.

| Bedingung | Wen sie findet | Standardeinstellungen und Grenzen |
|---|---|---|
| **Familie einer Person** | die Person und ihre Verwandten in Schritten nach oben, nach unten, in die Breite und über Ehen ([A11.2.6](#A11.2.6)) | die zentrale Person; 2 nach oben, 2 nach unten, nur direkte Linie, nur blutsverwandt |
| **Vorfahren einer Person** | die Vorfahren der Person wie die Wahl **Vorfahren einer Person** ([A11.2](#A11.2)) | die zentrale Person; alle Generationen oder 1–10 |
| **Nachkommen einer Person** | die Nachkommen der Person wie die Wahl **Nachkommen einer Person** | die zentrale Person; alle Generationen oder 1–10 |
| **Stamm** | die blutsverwandten Mitglieder der Stammlinie | die erste Stammlinie des Stammbaums |
| **Forschungslinie** | die Personen der Forschungslinie | die erste Linie |
| **Andere Liste** | die Personen einer anderen Liste ([A11.2.8](#A11.2.8)) | die Liste wird gewählt |
| **Geburt im Zeitraum** | das Geburtsjahr, ohne Geburtsdatum das Taufjahr, im Bereich | Jahre 1–2999, ab, bis oder von–bis |
| **Tod im Zeitraum** | das Sterbejahr, ohne Sterbedatum das Jahr der Bestattung, im Bereich | wie bei der Geburt |
| **Heirat im Zeitraum** | das Jahr, in dem eine Verbindung der Person begann, im Bereich | wie bei der Geburt |
| **Gelebt im Zeitraum** | Personen, die in einem Jahr des Bereichs sicher lebten; auch ein Jahrhundert lässt sich wählen | 19. Jahrhundert (1801–1900) |
| **Sterbealter** | das Alter beim Tod wie die Spalte der Tabelle | bis 5 Jahre; 0–130 |
| **Lebend / verstorben** | lebende oder verstorbene Personen wie der Chip der Tabelle | lebend |
| **Ort und Umgebung** | Geburt, Tod, Heirat oder Wohnort im Ort und seiner Umgebung ([A11.2.7](#A11.2.7)) | alle vier Ereignisse, **nur der Ort** |
| **Geschlecht** | Frauen, Männer oder Geschlecht unbekannt | Frauen |
| **Beruf** | Personen mit einem der gewählten Berufe | die Berufe werden gewählt (auch mehrere) |
| **Hat Angabe** | Personen, die die Angabe haben (**hat**) oder nicht haben (**hat nicht**) | hat nicht: Beleg oder Quelle |
| **Anzahl** | mindestens oder höchstens N Kinder, Ehen oder Quellen | mindestens 5 Kinder; 0–999 |
| **Text in Erzählung oder Notiz** | Text in der Erzählung, in der Notiz oder in beiden | beide; höchstens 200 Zeichen |
| **Hinzugefügt im Zeitraum** | in 24 Stunden, 7 Tagen, 30 Tagen oder ab einem Datum zum Stammbaum hinzugefügte Personen ([A11.7](#A11.7)) | 7 Tage |
| **Geändert im Zeitraum** | Personen, deren Angaben sich in der App geändert haben, in denselben Zeiträumen | 7 Tage |
| **Gespeicherter Tabellenfilter** | die Zeilen einer gespeicherten Ansicht der Tabelle (Personen oder Verbindungen) nach einer Kopie ihres Filters | die erste gespeicherte Ansicht |

- Der Katalog bietet nur Bedingungen an, für die der Stammbaum Daten hat: **Stamm** nur in einem Stammbaum mit
  Stammlinien, **Forschungslinie** nur mit Forschungslinien, **Andere Liste** nur mit mehr als einer Liste,
  **Beruf** nur mit einem Beruf, **Gespeicherter Tabellenfilter** nur mit einer gespeicherten Ansicht der Tabelle.
- **Zeiträume:** Eine Bedingung gilt nur, wenn die ganze Spanne des Datums im Zeitraum liegt („um 1820“ ist
  1818–1822; „vor 1850“ hat keinen Anfang). Eine Person ohne das Datum erfüllt die Bedingung nicht.
- **Gelebt im Zeitraum:** Eine Person lebte vom Ende der Spanne der Geburt bis zum Anfang der Spanne des Todes; ohne
  Sterbedatum „ohne Sterbedatum gelten 90 Jahre ab der Geburt“ (höchstens bis heute), nur mit Sterbedatum das
  Sterbejahr, ohne beide Daten erfüllt sie die Bedingung nicht.
- **Hat Angabe:** Geburtsdatum, Geburtsort, Sterbedatum, Sterbeort; Beleg oder Quelle, Foto, Material; Eltern,
  Partner, Kinder; Erzählung, Notiz; in einem Stammbaum aus der Forschung auch Widerspruch (ein unentschiedener
  Widerspruch der Forschung) und offene Forschungsaufgabe.
- **Anzahl:** Kinder sind leibliche Kinder; Ehen und Quellen werden wie in den Spalten der Tabelle gezählt.
- **Text:** „ohne Rücksicht auf Groß-/Kleinschreibung und Akzente“.
- **Geändert im Zeitraum:** Die Zeit einer Änderung wird bei einer Person erfasst, wenn sich in der App ihre
  Angaben, Ereignisse, Zitate oder Eltern ändern, und bei beiden Partnern, wenn sich ihre Verbindung ändert; eine neue
  Person hat sie nicht (sie hat die Angabe „hinzugefügt“). Bei der Bedingung steht „die Änderungszeit wird seit
  Version 3.32 erfasst – ältere Änderungen zählen nicht“.
- **Gespeicherter Tabellenfilter:** Die Bedingung hält eine Kopie des Filters („Kopie des Filters: {Ansicht}“); eine
  spätere Änderung der Ansicht der Tabelle ändert sie nicht.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:src/types.ts RuleCondName (21 podmínek) · src/person-list-rules.ts (spanInside celé rozpětí, ABOUT_YEARS 2, LIFE_YEARS_WITHOUT_DEATH 90, livedSpan, born birthOrBaptism, died deathOrBurial, married startDate svazku, count children / uCount / srcCount, has: čipy a buňky Tabulky, conflict nerozhodnutý, openTask, text fold bez diakritiky, added/changed hours 24 / days / since, gender unknown) · src/ui/person-list-rule-editors.ts ruleCatalog (skupina, pořadí, available) · src/ui/person-list-rule-cond-editors.ts (výchozí: deathAge to 5, has nemá source, count děti aspoň 5, rod první rod, line první linie, tableFilter první pohled; HAS_GROUPS, výzkum jen ve stromu z výzkumu; CHANGED_FROM 3.32) · src/person-lists-data.ts stampChangedAt · strings.ts lists.rules.cond.*, catalog.head.*, has.*, livedHint, textHint, changedFrom, filterCopy, countWhat, cmp · app:ffc7ff32, 6f3847ec, 4bc39c94 · spec 136 K1.1 -->

<a id="A11.2.6"></a>
### A11.2.6 Familie einer Person

**Familie einer Person** nimmt die Person und ihre Verwandten in Schritten in vier Richtungen. Die Person selbst ist
immer im Ergebnis.

| Richtung | Wahl |
|---|---|
| **Nach oben** | 0–10 Generationen oder **alle**; **über beide Eltern**, **über den Vater**, **über die Mutter** |
| **Nach unten** | 0–10 Generationen oder **alle** |
| **In die Breite** | **nur direkte Linie**, **+ Geschwister**, **+ Cousins** bis 1.–5. Grades oder **aller Grade** |
| **Ehepartner** | **nur blutsverwandt**, **+ Ehepartner**, **+ Familien der Ehepartner** |

- **über den Vater** und **über die Mutter** gelten in jedem Schritt nach oben. Bei zwei Eltern gleichen Geschlechts
  ist die Seite des Vaters der erste von ihnen.
- **+ Geschwister** sind die Geschwister der Person und jedes Vorfahren in der Reichweite von **Nach oben**. **+
  Cousins** bis N. Grades sind alle Nachkommen der Vorfahren bis N + 1 Generationen nach oben (1. Grad sind Cousins
  und Cousinen ersten Grades), höchstens in der Reichweite von **Nach oben**.
- **+ Ehepartner** fügt die Partner aller Personen des Ergebnisses hinzu, **+ Familien der Ehepartner** auch die
  Eltern und Geschwister dieser Partner.
- Ein Schritt führt nur über leibliche Eltern und Kinder; die Verbindung eines Stief- oder Pflegeelternteils zählt
  nicht. Durch eine Platzhalterperson führt der Schritt hindurch, im Ergebnis ist die Platzhalterperson nicht.
- **Schnellauswahl** stellt die Richtungen auf einmal ein; eine Wahl ist nur eingeschaltet, wenn die Richtungen
  genau passen:

| Schnellauswahl | Nach oben | Nach unten | In die Breite | Ehepartner |
|---|---|---|---|---|
| **Nächste Familie** | 1 | 1 | + Geschwister | + Ehepartner |
| **Vorfahren** | alle | 0 | nur direkte Linie | nur blutsverwandt |
| **Nachkommen** | 0 | alle | nur direkte Linie | nur blutsverwandt |
| **Blutsverwandte** | alle | alle | + Cousins aller Grade | nur blutsverwandt |
| **Ganze Familie mit Ehen** | alle | alle | + Cousins aller Grade | + Familien der Ehepartner |
| **Mannesstamm** | alle über den Vater | 0 | nur direkte Linie | nur blutsverwandt |
| **Frauenstamm** | alle über die Mutter | 0 | nur direkte Linie | nur blutsverwandt |

- Unter den Einstellungen steht die Bedingung in Worten, z. B. „Familie: {Person}, 2 Generationen nach oben,
  2 Generationen nach unten“ oder bei einer Schnellauswahl „Nächste Familie: {Person}“.
- Eine einzige Bedingung **Familie einer Person** nur nach oben oder nur nach unten (über beide Eltern, nur direkte
  Linie, nur blutsverwandt) wird als Regel **Vorfahren einer Person** / **Nachkommen einer Person** gespeichert.
- **Bedienung:** Bedingung **Familie einer Person** im Katalog; **Mehr Möglichkeiten: Familie einer Person…** bei
  **Vorfahren einer Person** und **Nachkommen einer Person** ([A11.2](#A11.2)); **Menü der Person → Zur
  Personenliste hinzufügen › → Liste aus der Familie dieser Person…** (Schnellauswahl **Nächste Familie**,
  [A11.5](#A11.5)).
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:src/lineage.ts familySet (seenUp, via v každém kroku, parentInRole, siblings osoby a předků v dosahu, cousins: potomci předků do degree + 1 v dosahu up, spouses / families: rodiče a sourozenci partnerů, zástupné ven, descentParents bez nevlastních a pěstounských), FAMILY_PRESETS, familyPresetOf · src/ui/person-list-rule-family.ts (FAMILY_GEN_MAX 10, FAMILY_COUSIN_MAX 5, pořadí rychlých voleb, nápověda slovy) · src/person-list-rules.ts customToRule (family → ancestors / descendants) · src/ui/person-list-add.ts LIST_FROM_FAMILY_ACTION (FAMILY_PRESETS.closest) · strings.ts lists.rules.family.*, preset.*, say.family, say.preset, contextMenu.listFromFamily · app:ffc7ff32, 007581af · spec 136 K1.1 -->

<a id="A11.2.7"></a>
### A11.2.7 Ort und Umgebung

**Ort und Umgebung** findet die Personen, die das gewählte Ereignis im Ort oder in seiner Umgebung haben.

- **Ereignisse:** Geburt (auch Taufe), Tod (auch Bestattung), Heirat (Ort des Beginns der Verbindung), Wohnort;
  standardmäßig alle vier.
- Der Ort wird aus den Orten des Stammbaums gewählt (Orte von Geburt, Tod, Heirat und Wohnort), die mit den meisten
  Personen zuerst.
- Zum Ort gehören auch seine Häuser (ein Ort mit Hausnummer oder Straße derselben Gemeinde); **einschließlich
  untergeordneter Orte** (nur wenn der Eintrag des Orts in der Forschung Orte unter sich hat) fügt auch diese hinzu.
- **Umgebung:** **nur der Ort**, **5 km**, **10 km**, **25 km**, **50 km** oder **andere…** (standardmäßig 100 km,
  1–500 km). Die Umgebung nimmt jeden Ort des Stammbaums, dessen Lage auf der Karte höchstens die gewählte Entfernung
  von der Lage des Orts entfernt ist (Luftlinie).
- Über den Orten steht eine Zusammenfassung („Im Umkreis von {km} km: N Orte · M Orte des Stammbaums ohne Lage“) und
  **Orte zeigen ›**: die ersten 6 Orte, dann „… und N weitere“; Orte ohne Lage stehen unter „Ohne Lage (nicht
  gezählt)“ mit **Lagen auf der Karte ergänzen ›**.
- Ein Ort ohne Lage zählt nur nach dem Namen („Der Ort hat keine Lage auf der Karte – nur nach Name.“); die
  Entfernung lässt sich dann nicht wählen, und die Wahl eines solchen Orts setzt sie auf **nur der Ort** zurück. Ein
  Stammbaum ohne Ortslagen: „Der Stammbaum hat keine Ortslagen – die Umgebung geht nach dem Ergänzen auf der Karte.“
- **Grenzen:** Umgebung höchstens 500 km. Ein Ort ohne Lage auf der Karte zählt nicht zur Umgebung.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:src/person-list-rules.ts NEAR_MAX_KM 500, placeIndexOf (birthPlace, baptism a birth; residence; startPlace svazku; deathPlace, burial a death), nearKeys (townKey: dům téže obce, below keysBelow, km > 0 haversineKm od geoOfKey), rulePlaceChoices (nejvíc osob první) · src/ui/person-list-rule-near.ts (KM_PRESETS 0/5/10/25/50, KM_OTHER 100, 6 míst a more, unplaced, noCoords, noneInTree) · strings.ts lists.rules.near.*, say.events · app:ffc7ff32, cbcb7673 · spec 136 K1.1 -->

<a id="A11.2.8"></a>
### A11.2.8 Andere Liste

**Andere Liste** nimmt die Personen einer anderen Liste: bei einer festen ihre Personen, bei einer automatischen die,
die ihre Regel jetzt findet.

- Eine Liste, über die die Regel zurück in die bearbeitete Liste führen würde (auch über weitere Listen), ist in der
  Auswahl nicht verfügbar, mit dem Weg des Kreises: „würde einen Kreis bilden: {A → B → A}“. Eine Regel mit Kreis
  lässt sich nicht speichern.
- Ab 9 Listen hat die Auswahl das Feld **Suchen**.
- Das Löschen einer Liste, die eine andere Liste verwendet, fragt zuerst nach ([A11.3](#A11.3)); die Bedingung
  erscheint dann als „fehlt“ ([A11.2.11](#A11.2.11)).
- **Grenzen:** Die Bedingung ist nur im Katalog, wenn der Stammbaum mehr als eine Liste hat.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:src/person-list-rules.ts listCycle („A → B → A“), ruleIssues cycle, condSet list (listMembers, visiting), listUsedBy · src/ui/person-list-rule-cond-editors.ts list (available: víc než jeden seznam, hledání od 9) · strings.ts lists.rules.cycle, cond.list · spec 136 K1.7 -->

<a id="A11.2.9"></a>
### A11.2.9 Zahlen und Im Stammbaum zeigen

Das Zusammensetzen einer Regel zeigt Zahlen: jede Bedingung und Gruppe ihre eigene Zahl von Personen im ganzen
Stammbaum, die Fußzeile die Zahl der ganzen Regel („N Personen passen“ oder „Niemand passt“).

- Eine unvollständige Bedingung zählt nicht zur Zahl der ganzen Regel.
- Findet eine Regel mit **Alle gelten** niemanden, hat der Eintrag, nach dem das Ergebnis auf null fiel, die Marke
  „hier 0“.
- Die Zahlen werden 120 ms nach der letzten Änderung neu berechnet. Dauerte die vorige Berechnung länger als 200 ms,
  zeigt die Fußzeile zuerst „Wird berechnet…“ mit der vorigen Zahl („bisher N Personen“).
- **Im Stammbaum zeigen** (neben der Zahl, nur wenn jemand passt und die Regel sich speichern lässt): Der Dialog wird
  ausgeblendet, nicht geschlossen; es erscheint die Ansicht **Familie** (aus einer anderen Ansicht wird auf sie
  gewechselt) mit hervorgehobenen Personen der Regel und dem Titel „Regelvorschau · N Personen“. **Zurück zur Regel**,
  × und Esc beenden die Hervorhebung, kehren zur vorigen Ansicht zurück und zeigen den Dialog, wie er war.
- **Bedienung:** auf dem Telefon **⋯** der Regel → **Im Stammbaum zeigen**.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:src/person-list-rules.ts evalRuleCounts (vlastní počet každé položky nad celým stromem, neúplné mimo celek, zeroAt jen u celku 0 a op all) · src/ui/person-list-rule-ui.ts RULE_COUNT_DEBOUNCE_MS 120, RULE_COUNT_SLOW_MS 200, ruleBuilderCountsBusy · src/ui/person-list-new-ui.ts newPersonListFootExtraHtml, newPersonListMoreRows (telefon), showNewPersonListInTree (skryté overlaye, setViewMode family, highlightGroup rulePreview), backToNewPersonList · strings.ts lists.rules.match, nobody, zeroHere, computing, previous, showInTree, preview, backToRule · app:ffc7ff32 · spec 136 K1.3, K1.4 -->

<a id="A11.2.10"></a>
### A11.2.10 Vorlagen für Listen

Eine Vorlage ist eine vorbereitete eigene Regel. Sie wird beim Anlegen einer neuen Liste angeboten: **Mit Vorlage
beginnen ▾** rechts in der Zeile **Nach** (auf dem Telefon **⋯** der eigenen Regel → **Mit Vorlage beginnen…**).

| Gruppe | Vorlage | Regel |
|---|---|---|
| **Was in der Forschung fehlt** | **Vorfahren ohne Quelle** | Vorfahren einer Person und ohne Beleg oder Quelle |
| | **Enden der Linien** | Vorfahren einer Person und ohne Eltern |
| | **Ohne Geburtsdatum oder -ort** | ohne Geburtsdatum oder ohne Geburtsort |
| | **Personen mit Widerspruch** | hat Widerspruch (nur Stammbaum aus der Forschung) |
| | **In Arbeit** | hat offene Forschungsaufgabe (nur Stammbaum aus der Forschung) |
| **Familie und Linien** | **Direkte Linie im Mannesstamm** | **Familie einer Person**, Schnellauswahl **Mannesstamm** |
| | **Nachkommen bis N Generationen** | Nachkommen einer Person, 3 Generationen |
| | **Aus Ort und Umgebung** | Geburt, Tod, Heirat oder Wohnort bis 10 km vom Ort |
| | **Im Kindesalter verstorben** | Sterbealter bis 5 Jahre |
| **Erzählen und Teilen** | **Vorfahren ohne Foto** | Vorfahren einer Person und ohne Foto |
| | **Lebende Personen** | lebend |
| | **Neu hinzugefügt** | in den letzten 7 Tagen hinzugefügt |

- Das Menü **Vorlagen** hat oben die eigenen Vorlagen (**Eigene**), dann die eingebauten nach Gruppen, ohne Zahlen.
  Eine Vorlage, die eine Person oder einen Ort braucht, hat „braucht eine Person“ / „braucht einen Ort“. Eine Vorlage
  mit einer Bedingung, die der Stammbaum nicht anbietet ([A11.2.5](#A11.2.5)), ist nicht im Menü.
- Die Wahl einer Vorlage öffnet die eigene Regel mit ihren Bedingungen und gleich die Wahl der ersten fehlenden
  Person oder des ersten fehlenden Orts. Der Name der Liste ist der Name der Vorlage, nach dem Ergänzen der Person
  oder des Orts „{Vorlage} – {Person}“, bis er überschrieben wird.
- Über der Regel steht „Aus Vorlage: {Vorlage}“ und **Vorlage verwerfen**: Die Regel wird geleert, und der Name
  richtet sich wieder nach der Regel.
- Eine Regel aus einer Vorlage lässt sich wie jede andere bearbeiten. Die Liste merkt sich, aus welcher Vorlage sie
  entstand ([A11.3](#A11.3)); der Name einer eingebauten Vorlage steht in der Sprache der App.
- **Als Vorlage speichern…** (**⋯** der eigenen Regel) öffnet den Dialog **Als Vorlage speichern** mit dem Feld
  **Name der Vorlage** (standardmäßig der Name der Liste) und dem Hinweis „Personen, Orte und Listen werden nicht in
  der Vorlage gespeichert – sie werden bei der Verwendung ergänzt. Die Vorlage wird auf diesem Gerät gespeichert und
  funktioniert auch in anderen Stammbäumen.“ Stammlinien und Forschungslinien werden auch nicht gespeichert.
  - Ein vergebener Name wird umrandet: „Eine Vorlage mit diesem Namen gibt es schon. Vorschlag: „{Name} (2)“.“;
    **Speichern** nimmt den Vorschlag.
  - **⋯** einer eigenen Vorlage im Menü: **Umbenennen…** (Dialog **Vorlage umbenennen**), **Löschen** (Meldung
    „Vorlage „{Name}“ gelöscht.“ mit **Rückgängig**).
- **Grenzen:** Vorlagen nur beim Anlegen einer neuen Liste, nicht beim Bearbeiten einer Regel und nicht bei **Als
  Personenliste speichern…**. Eigene Vorlagen gehören zum Gerät (Einstellungen der App in diesem Browser), nicht zum
  Stammbaum.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:src/person-list-templates.ts LIST_TEMPLATES (12, skupiny missing / family / story, research jen ve stromu z výzkumu), templateRoot, listTemplateName (vestavěná podle jazyka, app:29c57b0e) · src/person-list-rules.ts stripTemplateParams (osoby, místa, seznamy, rody, linie), makeListTemplate, ruleNeeds · src/ui/person-list-new-ui.ts offeredTemplates (ruleOffered), openNewPersonListTemplates, applyNewPersonListTemplate (origin template, otevře první chybějící), dropNewPersonListTemplate, openNewPersonListTemplateActions, openListTemplateNameDialog (freeTemplateName), newPersonListMoreRows · src/types.ts ListTemplate (nastavení listTemplates, ne strom) · strings.ts lists.templates.*, lists.new.fromTemplate · app:58ad425d, 7f13e899 · spec 136 K1.9 -->

<a id="A11.2.11"></a>
### A11.2.11 Fehlende Person, fehlender Ort oder fehlende Liste in einer Regel

Verschwindet aus dem Stammbaum eine Person, ein Ort, eine Liste, eine Stammlinie oder eine Forschungslinie, auf die
eine eigene Regel verweist, bleibt die Regel bestehen und der Verweis erscheint als „fehlt“.

- Eine Bedingung mit fehlendem Verweis zählt als leer: Sie findet niemanden, mit „außer“ nimmt sie niemanden weg.
- Beim Zusammensetzen hat die Bedingung „{Name} – fehlt“, und ihr **⋯** bietet zuerst **Andere Person wählen…**
  (**Anderen Ort wählen…**, **Andere Liste wählen…**, **Anderen Stamm wählen…**, **Andere Forschungslinie
  wählen…**).
- Eine automatische Liste sagt es in der Übersicht („automatisch · Die Regel verweist auf eine fehlende Person“, …)
  und im Detail („Die Regel verweist auf eine fehlende Person: {Name} – die Bedingung zählt als leer.“) mit **Regel
  bearbeiten…**.
- Zusammenführen von Personen: Einen Verweis auf die entfernte Person übernimmt die behaltene.
- Das Löschen einer Liste, die eine andere Liste verwendet, fragt zuerst nach ([A11.3](#A11.3)); **Rückgängig** bringt
  die Liste und die Verweise zurück.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:src/person-list-rules.ts condMissing (person, place, list, rod, line), customMissing, chybějící odkaz = prázdná množina · src/ui/person-list-rule-ui.ts (gone, pickOther první v ⋯) · src/ui/person-lists-ui.ts listMissing (jen automatický), rowMeta is-warn, pl-note--warn s edit-rule · src/person-lists-data.ts onPersonsMerged (customWithPersonMerged) · strings.ts lists.rules.missing, gone, pickOther.*, missingRef.*, missingNote · app:c76a8954 · spec 136 K1.7 -->

<a id="A11.3"></a>
## A11.3 Listen verwalten: Personenlisten

Alle Listen des Stammbaums sind an einem Ort, im Dialog **Personenlisten**: links die Übersicht, rechts die gewählte
Liste.

- **Übersicht:** jede Liste mit dem Symbol der Art, dem Namen, der Zahl der Personen und einer Zeile unter dem Namen
  (**fest · geändert …**, **automatisch ·** Regel, **Arbeitsliste · a von b offen**). Sortierung **Nach Name** oder
  **Nach Änderung**. Ab 9 Listen steht über ihnen das Feld **In Listen suchen** (ohne Rücksicht auf diakritische
  Zeichen).
- **Detail:** der Name (wird an Ort und Stelle umbenannt: Klick, ✎ oder F2; Enter speichert, Esc nimmt zurück), das
  Etikett der Art, die Zeile der Regel (**Nach** / **Entstanden aus**), die Zusammenfassung ([A11.3.1](#A11.3.1)) und
  **Personen der Liste · N** mit der Sortierung ([A11.4](#A11.4)). Bei einer festen Liste × bei der Person (**Aus der
  Liste entfernen**) und **Person hinzufügen…** ([A11.5](#A11.5)). Bei der Person steht je nach Sortierung die
  Generation, das Datum des Hinzufügens oder der Geburtsort.
- Ab App 3.32.0 sagt die Zeile der Regel die Regel in Worten auf höchstens zwei Zeilen (auf dem Telefon vier), ganz
  im Tooltip; auf dem Telefon öffnet **Ganze Regel ›** den Dialog der Regel (in einem schreibgeschützten Stammbaum
  klappt es den ganzen Text auf). Eine eigene Regel in Worten: die Bedingungen nacheinander, getrennt durch „ · “,
  jede nach der ersten mit „und“ oder „oder“, die Bedingungen mit „außer“ am Ende („außer A oder B“), Gruppen in
  Klammern; z. B. „Vorfahren: {Person}, alle Generationen · und ohne Beleg oder Quelle“.
  - Unter der Regel steht, woher die Liste stammt: „Aus Vorlage „{Vorlage}“ · {Datum}“; bei einer von Hand angelegten
    Liste nichts.
  - Eine Liste mit Regel hat neben **Regel bearbeiten…** / **Nach Regel ergänzen** auch **Bedingung hinzufügen…**
    ([A11.2.4](#A11.2.4)).
- **⋯ der Liste** (an der Zeile in der Übersicht und im Detail): **In Tabelle öffnen**, **Auf der Karte** (ab App
  3.31.0), **Umbenennen**, **Duplizieren**, **Erledigtes abhaken** (fest, [A11.8](#A11.8)) oder **Einfrieren** (automatisch,
  [A11.2.2](#A11.2.2)), **Exportieren ›** ([A11.9](#A11.9)), **Löschen**. Ab App 3.32.0 hat eine Liste mit Regel davor
  **Bedingung hinzufügen…** ([A11.2.4](#A11.2.4)) und eine feste Liste mit Regel nach **Erledigtes abhaken** auch
  **Nach Regel aktuell halten** ([A11.2.2](#A11.2.2)).
  - **In Tabelle öffnen** schließt den Dialog und öffnet die Tabelle im Umfang der Liste
    ([A6.7.19](A6-views.md#A6.7.19)).
  - **Auf der Karte** (auch die Schaltfläche neben **In Tabelle öffnen** im Detail) schließt den Dialog, setzt die
    Liste als Auswahl des Fensters ([A6.6](A6-views.md#A6.6)) und öffnet die Karte mit dem Bereich **Auswahl**
    ([A6.5.7](A6-views.md#A6.5.7)). In einem weiteren Fenster führt das das Hauptfenster aus; ohne es ist **Auf der
    Karte** nicht verfügbar („Das Hauptfenster ist nicht geöffnet.“).
  - **Duplizieren** macht eine Kopie derselben Art mit derselben Regel, Reihenfolge, den von Hand entfernten und den
    abgehakten Personen, mit dem Namen „{Name} (2)“.
  - **Löschen** fragt nicht nach: Meldung „Liste „{Name}“ gelöscht.“ mit **Rückgängig**. Ab App 3.32.0 fragt es,
    wenn eine andere Liste die Liste in der Bedingung **Andere Liste** verwendet: „Liste „{Name}“ löschen?“ mit „Die
    Liste hat N Personen; die Personen bleiben im Stammbaum.“ und „Verwendet von: {Listen}. Die Bedingung „Andere
    Liste“ erscheint dort als „fehlt“.“ (höchstens drei Namen, dann „und N weiteren“) und dem Hinweis „Das Löschen
    lässt sich rückgängig machen – die Liste und die Verweise kommen zurück.“
- **Grenzen:**
  - das Detail zeigt höchstens 200 Personen: „Die ersten 200 von N Personen.“ mit einem Link in die Tabelle, wo alle
    sind;
  - jede Änderung einer Liste ist ein Schritt **Rückgängig**; Entstehen (auch eines Duplikats), Umbenennen, Einfrieren und
    Löschen haben einen Eintrag im Änderungsverlauf;
  - in einem weiteren Fenster der App ([A6.8](A6-views.md#A6.8)) wird eine Änderung einer Liste über das Hauptfenster
    gespeichert.
- **Bedienung:** **Aktionen → Personenlisten…**; auf dem Telefon **Mehr → Personenlisten**; in der Tabelle
  **Umfang ▾ → Listen verwalten…**. Tasten in der Übersicht: ↑ ↓ Auswahl, Enter umbenennen, Entf löschen, Esc
  schließt den Dialog. Auf dem Telefon wechseln sich Übersicht und Liste auf dem ganzen Bildschirm ab (‹ **Zurück zu
  den Listen**), **⋯** ist ein Panel von unten.
- **Gilt seit:** App 3.30.0; 3.32.0: Regel in Worten, Herkunft der Liste, **Bedingung hinzufügen…**, Frage vor dem
  Löschen einer Liste, die eine andere Liste verwendet

<!-- zdroj: app:src/ui/person-lists-ui.ts (OVERLAY_ID person-lists-modal, SEARCH_FROM 9, LIST_DETAIL_ROWS 200, NARROW_QUERY, přejmenování klik/✎/F2, klávesy ↑↓ Enter Delete) · src/ui/person-list-hooks.ts listMenu (freezeAndChecklistRows, exportRows) · src/data.ts duplicatePersonList (structuredClone, suggestPersonListName), deletePersonList (Vrátit), storePersonList audit (personList.save, :2224 přejmenování, :2254 personList.delete, :2330 zmrazení) · index.html #actions-lists-row · src/ui/bottom-sheet.ts řádek Seznamy osob v listu Více · strings.ts menu.lists, lists.title, search, byName, byChange, changed, left, people, remove, addPerson, openTable, menu.*, large, back, toast.deleted, undo.*, audit.* · app:4acf7a09, 3dc8e709 · ZADANI_DEV §2, §16 (okna 079: WindowEditSink) · 3.31.0 Na mapě: src/ui/person-lists-ui.ts (tlačítko pl-onmap v detailu, ⋯ řádek map za open), src/ui/person-list-hooks.ts showOnMap, src/windows/window-show-on-map.ts, strings.ts lists.onMap, onMapTitle, table.onMapNoMain (app:2a578474, 39020cf1, ZADANI_DEV_vyber-osob §6) · 3.32.0: src/ui/person-lists-ui.ts (pl-rule-t s title, pl-rule-whole: edit-rule nebo whole-rule ve stromu jen ke čtení, listOriginText, add-condition, deletePersonList s listUsedBy: 3 jména a more, showConfirm danger s note), src/person-list-rules.ts customLabel (·, a zároveň / nebo, kromě na konci), src/person-lists.ts listRuleLabel, src/ui/person-list-hooks.ts freezeAndChecklistRows · strings.ts lists.wholeRule, origin.*, addCondition, deleteTitle, deletePeople, deleteUsedBy, deleteUsedNote · app:c76a8954, 5959ed63 · spec 136 K1.4, K1.7 -->

<a id="A11.3.1"></a>
### A11.3.1 Die Zusammenfassung einer Liste

Das Detail der Liste fasst ihre Personen in Kacheln zusammen: **Personen** · **Geburt** (das älteste und das jüngste
Geburtsjahr, ohne Jahre „–“) · **mit Foto** · **mit Beleg** · **mit Erzählung**; eine Arbeitsliste zuerst noch
**offen**.

- **Mit Beleg** ist eine Person mit mindestens einem Zitat einer Quelle bei der Person, ihren Angaben, Ereignissen
  oder Verbindungen.
- Unter den Kacheln steht der Link „N ohne Beleg ›“: er öffnet die Tabelle im Umfang der Liste mit dem Chip **Ohne
  Quelle**.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:src/person-lists.ts listSummary (birthMin/Max, photo, personEvidence sources > 0, story.text, noCite, left jen u pracovního) · src/ui/person-list-hooks.ts openInTable (noSource) · strings.ts lists.sum.* · app:211323e8 (Otevřít v Tabulce s čipem Bez pramene) · spec 084 K8.2 -->

<a id="A11.4"></a>
## A11.4 Die Sortierung einer Liste

Eine Liste hat eine von fünf Sortierungen. Die Reihenfolge der Liste nehmen die Tabelle (Spalte **#**) und der
Export.

| Sortierung | Reihenfolge |
|---|---|
| **Älteste zuerst** | nach dem Geburtsdatum; ohne Datum am Ende |
| **Nach Generationen** | bei einer Liste aus Vorfahren oder Nachkommen die Generation von der Person der Regel aus, sonst die Generation wie in der Spalte der Tabelle; innerhalb der Generation die ältesten zuerst |
| **Alphabetisch** | Nachname, dann Vorname, nach der Sprache der App |
| **Nach Hinzufügen** | die zuletzt hinzugefügten zuerst; Personen ohne die Angabe „hinzugefügt“ am Ende |
| **Manuell** | die Reihenfolge, die die feste Liste hält |

- **Manuell** hat nur eine feste Liste. Bei einer automatischen ist die Wahl nicht verfügbar: „Manuelle Reihenfolge
  hat nur eine feste Liste – Einfrieren“.
- Das Umschalten auf eine andere Sortierung löscht die manuelle Reihenfolge nicht; nach der Rückkehr zu **Manuell**
  gilt sie wie vorher. Eine neu hinzugefügte Person kommt ans Ende der manuellen Reihenfolge.
- Jedes Verschieben ist ein Schritt **Rückgängig**; ein Bildschirmleser sagt es an („Verschoben: … steht an Position 3
  von 12.“).
- **Bedienung:** **Sortierung: … ▾** über den Personen der Liste. Manuelle Reihenfolge: Ziehen der Zeile am Griff
  (Maus und Finger), Esc bricht das Ziehen ab; Alt+↑ / Alt+↓ auf der Zeile; **⋯** der Person → **Nach oben** /
  **Nach unten**. Auf dem Telefon gibt es keinen Griff, nur **⋯**.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:src/person-lists.ts sortListIds (old birthKey, gen ruleGenerations / assignGenerations, name Intl.Collator, added sestupně bez data na konec, manual), withSort (automatický bez manual), withPersonMoved, withManualOrder, withPersonsAdded (na konec) · src/ui/person-lists-ui.ts úchyt, Alt+↑/↓, Esc · strings.ts lists.sortBy, sort.*, manualOff, handle, up, down, moved · app:3dc8e709 · ZADANI_DEV §5 -->

<a id="A11.5"></a>
## A11.5 Zur Personenliste hinzufügen und entfernen

Eine Person lässt sich zu einer festen Liste aus dem Menü der Person, aus der Tabelle, aus den Ergebnissen der Suche
und aus dem Detail der Liste hinzufügen. Eine automatische Liste ändert sich nicht von Hand, die Menüs bieten sie
deshalb nicht an („Automatische Listen füllen sich selbst nach ihrer Regel.“).

- **Menü der Person → Zur Personenliste hinzufügen ›:** feste Listen nach der letzten Änderung, höchstens 8, dann
  **Weitere Listen…**; eine Liste, in der die Person ist, hat ✓, und ein Klick entfernt sie daraus. Darunter **Neue
  Liste mit dieser Person…**: der Dialog der neuen Liste ([A11.2](#A11.2)), die Wahl **Leer** mit dieser Person; für
  **Vorfahren einer Person** und **Nachkommen einer Person** ist diese Person vorgewählt. Auf dem Telefon die zweite
  Seite des Panels der Person. Ab App 3.32.0 steht darunter auch **Liste aus der Familie dieser Person…**: der Dialog
  einer neuen Liste mit der eigenen Regel **Familie einer Person** dieser Person in der Schnellauswahl **Nächste
  Familie** ([A11.2.6](#A11.2.6)).
- **Tabelle:** Zeilenmenü → **Zur Personenliste hinzufügen ›** (die Person der Zeile; bei einer Verbindung beide
  Partner, bei einem Ereignis seine Personen). Auswahl über mehrere Zeilen: **N Personen zur Liste hinzufügen ›** und
  **Neue Liste mit diesen Personen…**. Im Umfang einer festen Liste hat das Zeilenmenü auch **Aus der Liste
  entfernen** ([A6.7.19](A6-views.md#A6.7.19)).
- **Ergebnisse der Suche → Ergebnisse in eine Liste ›:** fügt alle Ergebnisse hinzu, nicht nur die gezeigten, oder
  legt **Neue Liste aus den Ergebnissen (N)…** an (fest, Name „Suche: {Anfrage}“).
- **Detail der Liste → Person hinzufügen…:** Wahl der Personen nach dem Namen, mehrere auf einmal; Personen, die schon
  in der Liste sind, sind grau („schon in der Liste“).
- Eine Person, die schon in der Liste ist, wird nicht verdoppelt („Alle sind schon in der Liste „{Liste}“.“). Eine
  entfernte Person ist nicht mehr abgehakt.
- Das Entfernen hat **Rückgängig** in der Meldung.
- **Grenzen:** in einem schreibgeschützten Stammbaum gibt es diese Menüs nicht ([A11.1](#A11.1)).
- **Gilt seit:** App 3.30.0; 3.32.0: **Liste aus der Familie dieser Person…**

<!-- zdroj: app:src/ui/person-list-add.ts MENU_LISTS 8, addTargets (pevné podle updated), personListMenuRows (✓, Další seznamy…, Nový seznam s touto osobou…, poznámka), listMenuEntries (víc osob, bez zdvojení), showAddPersonsToList (PICK_ROWS 200, inList) · src/ui/context-menu.ts getPersonMenuActions (za Hledat v archivech) · src/ui/person-list-new-ui.ts:215 (personIds → volba Prázdný s osobami; jedna osoba = osoba pravidla předků a potomků) · src/ui/table-view/table-ui.ts showTableRowMenu (toListN, tableAreaRowKeys, svazek oba partneři) · src/ui/search.ts (Výsledky do seznamu, všechny výsledky) · src/person-lists.ts withPersonsRemoved (done ven) · strings.ts contextMenu.toList, newListWith, newListWithMany, autoListsNote, moreLists, table.act.toListN, search.toList, newFromResults, lists.save.searchName, inList, addN, toast.added, removed, addedN, allIn · app:68363dbe · ZADANI_DEV §4 · 3.32.0: src/ui/person-list-add.ts LIST_FROM_FAMILY_ACTION (FAMILY_PRESETS.closest), strings.ts contextMenu.listFromFamily (app:007581af, spec 136 §12) -->

<a id="A11.6"></a>
## A11.6 Eine Ansicht als Liste speichern

Manche Ansichten lassen sich als Liste speichern: nur dort, wo eine Auswahl von Personen Sinn ergibt.

| Woher | Wahl | Standard |
|---|---|---|
| Tabelle › Personen | **⋯** der Tabelle oder Menü **Ansicht** → **Als Personenliste speichern…** | fest: die Personen in der Reihenfolge der Zeilen der Tabelle |
| Tabelle › Verbindungen | **⋯** der Tabelle → **Als Personenliste speichern…** | fest: beide Partner jeder Verbindung, jede Person einmal |
| Ergebnisse der Suche | **Ergebnisse in eine Liste ›** ([A11.5](#A11.5)) | nur fest |
| Auswahl des Fensters | **Auswahl ▾**, Fußzeile **Auswahl als Liste speichern…** (Stammlinie, Vorfahren, Nachkommen, Forschungslinie; [A6.6.1](A6-views.md#A6.6.1)); bis App 3.30.0 nur Stammlinie: **Stamm {Stammlinie} als Liste speichern…** | automatisch |
| Forschungslinie | **⋯** der Linie → **Als Liste speichern…** | automatisch |

- Aus der Tabelle werden die Personen nach Filter und Sortierung gespeichert; vorübergehend gezeigte Zeilen nicht.
  Eine angeheftete Zeile außerhalb des Filters wird nicht gespeichert („Die angeheftete Zeile außerhalb des Filters
  (…) wird nicht gespeichert.“).
- **Nach Filter aktuell halten** macht eine automatische Liste mit einer Kopie des heutigen Filters und der
  Sortierung der Tabelle. Eine spätere Änderung der Ansicht der Tabelle ändert sie nicht. **Regel bearbeiten…** einer
  solchen Liste öffnet die Tabelle mit ihrem Filter und bietet im **⋯** der Tabelle **In der Liste {Name} speichern**
  an.
- **Grenzen:** Ereignisse, Quellen und die Ansichten Familie, Nachkommen, Fächer, Zeitleiste und Karte werden nicht als
  Liste gespeichert.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:src/ui/person-list-new-ui.ts (SAVE_ID person-list-save; zdroje table/unions/search/rod/line, pinOut, keepFilter) · src/ui/table-view/table-ui.ts saveTableAsList, saveTableRule (lists.saveRule), canSaveAsList · src/ui/rod-view.ts (rodView.saveList) · src/ui/research-directions-ui.ts:1127 directionSaveListItem · src/person-lists.ts rulePersonIds tableFilter (unions: p1, p2) · strings.ts lists.saveAs, save.*, saveRule, rodView.saveList, research.dirSaveList · app:e09dcacb, 68363dbe, 211323e8 · ZADANI_DEV §6 · spec 084 K1.4, K6.3 a · 3.31.0: src/ui/selection-picker-ui.ts saveListOptions (rod, line, selection = předci/potomci), person-list-new-ui.ts dynamic pro rod/line/selection, strings.ts selection.saveList (app:61873988, ZADANI_DEV_vyber-osob §2) -->

<a id="A11.7"></a>
## A11.7 Wann eine Person hinzukam: In den letzten 30 Tagen hinzugefügt

Ab App 3.30.0 merkt sich der Stammbaum bei jeder Person, wann sie hinzukam. Die Angabe wird nicht von Hand bearbeitet
und in der Personenkarte nicht gezeigt; sie nutzen die Regel **Hinzugefügt im Zeitraum**, die Sortierung **Nach
Hinzufügen**, die Spalte **Hinzugefügt** in der Tabelle ([A6.7.2](A6-views.md#A6.7.2)) und die Gruppierung in der
Tabelle ([A6.7.20](A6-views.md#A6.7.20)).

- **Wann sie eingetragen wird:**
  - eine neue Person in der App: der Zeitpunkt ihres Entstehens (eine Platzhalterperson erst, wenn aus ihr eine echte
    Person wird);
  - Laden einer GEDCOM-Datei: der Tag des Ladens;
  - Zusammenführen von Stammbäumen: der Zeitpunkt des Zusammenführens bei den Personen, die in den Stammbaum kamen;
    eine zusammengeführte Person behält die frühere Angabe;
  - eine neue Person aus der Forschung: das Datum, das die Forschung bei ihr angibt, sonst der Zeitpunkt des Ladens.
- Personen aus der Zeit vor 3.30.0 haben die Angabe nicht (im Detail der Liste, in der Spalte **Hinzugefügt** und in
  den Gruppen der Tabelle „früher“); nichts wird nachträglich berechnet.
- **In den letzten 30 Tagen hinzugefügt** ist eine vorbereitete automatische Liste jedes Stammbaums, auch eines neuen
  und eines geladenen. Der Zeitraum lässt sich ändern (**Regel bearbeiten…**); der Name ändert sich dann mit dem
  Zeitraum, bis die Liste umbenannt wird. Eine gelöschte kehrt nicht mehr zurück. Leer sagt sie „Noch nichts – das
  Hinzufügedatum wird seit Version 3.30 erfasst.“
- **Grenzen:** GEDCOM trägt die Angabe nicht. Ein Export mit Schutz lebender Personen lässt sie bei lebenden weg
  ([A7.2](A7-book-pages-and-export.md#A7.2)).
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:src/data.ts:2636 createPerson (addedAt, ne zástupná), :2847 zástupná osoba při první úpravě, :5435 mergePersons earlierAddedAt · src/ged-parser.ts:6594 stampAddedAt(origin.at) · src/merge/executor.ts:573 (mergedAt), :1962 · src/person-lists-data.ts builtinAdded30, personListsOf (i nový strom a import, personListsDropped), keepPersonListData, stampResearchTree (research.added nebo now) · src/person-lists.ts listDisplayName (jméno podle období do přejmenování) · src/ui/person-lists-ui.ts:41 ADDED_SINCE '3.30', :534 lists.earlier · src/ui/table-view/table-group.ts:238 · src/privacy.ts:373 (stripDetails žijících: delete addedAt) · strings.ts lists.builtin.added30, addedNone, earlier · ZADANI_DEV §8, Q3 · app:714a8ab2 · sloupec Přidáno app:0971647c (table.earlier) -->

<a id="A11.8"></a>
## A11.8 Arbeitsliste: Erledigtes abhaken

Eine feste Liste lässt sich als Arbeitsliste verwenden: bei jeder Person ist ein Kästchen, und erledigte Personen
werden abgehakt.

- Eine erledigte Person ist im Detail durchgestrichen. Über den Personen steht **Alle** / **Offen N** / **Erledigt N**,
  in der Übersicht „a von b offen“ und in der Zusammenfassung die Kachel **offen**.
- Das Abhaken gehört der Liste, nicht der Person: ein Duplikat der Liste übernimmt es, eine andere Liste nicht. Eine
  entfernte Person ist nicht mehr abgehakt.
- Das Ausschalten von **Erledigtes abhaken** löscht das Abhaken nicht; nach erneutem Einschalten ist es wieder da.
- Das Abhaken ist ein Schritt **Rückgängig**, ohne Meldung.
- In der Tabelle im Umfang einer Arbeitsliste gibt es die Spalte **Erledigt** und die Chips **Offen** und **Erledigt**
  ([A6.7.19](A6-views.md#A6.7.19)).
- **Grenzen:** eine automatische Liste lässt sich nicht abhaken. In einem schreibgeschützten Stammbaum sind erledigte
  Personen ohne Kästchen zu sehen.
- **Bedienung:** **⋯** einer festen Liste → **Erledigtes abhaken** (✓); das Kästchen per Klick oder Leertaste.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:src/person-lists.ts withChecklist (vypnutí drží done), withDoneToggled, withPersonsRemoved (done ven), listSummary left · src/data.ts duplicatePersonList (done převezme) · src/ui/person-lists-ui.ts zaškrtávátka, segment · strings.ts lists.menu.work, filter.*, left, sum.left, table.col.done, table.chip.left, chip.done · app:3dc8e709, 211323e8 · ZADANI_DEV §13 · spec 084 K8.4 -->

<a id="A11.9"></a>
## A11.9 Export einer Liste

Eine Liste lässt sich auf zwei Wegen exportieren: als Teil des Stammbaums (GEDCOM, Datensicherung JSON) oder als
Tabelle (CSV).

- **Dialog Export → Was exportieren → Personenliste:** die Wahl **Liste** bietet die Listen des offenen Stammbaums an,
  die Personen haben. **GEDCOM** trägt dann die Personen der Liste und die Familien zwischen ihnen, die
  **Datensicherung (JSON)** die Daten des Stammbaums, eingeschränkt auf die Personen der Liste. Schutz lebender
  Personen und Inhalt der Datei gelten wie beim ganzen Stammbaum ([A7.2](A7-book-pages-and-export.md#A7.2),
  [A7.3](A7-book-pages-and-export.md#A7.3)). Die übrigen Formate sind nicht verfügbar: „Dieses Format exportiert den
  ganzen Stammbaum“. Die Wahl wird gespeichert; eine verschwundene Liste setzt die Wahl auf **Ganzer Stammbaum**
  zurück.
- **⋯ der Liste → Exportieren ›:**
  - **GEDCOM…** öffnet den Dialog Export bei dieser Liste;
  - **CSV (Reihenfolge der Liste)** lädt sofort die Tabelle der Personen der Liste in ihrer Reihenfolge herunter: die
    Spalten, wie sie Tabelle › Personen hat, davor **#** (und **Erledigt** bei einer Arbeitsliste). Datei
    `{Stammbaum}_{Liste}_{JJJJ-MM-TT}.csv`.
- **Listen im Export:** die Datensicherung (JSON) des ganzen Stammbaums trägt die Listen ganz. Ein Export eines Teils
  des Stammbaums (Liste, **Nur aktuelle Ansicht**) lässt in festen Listen nur die Personen dieses Teils; eine Liste, in
  der niemand übrig bleibt, fällt weg. Automatische Listen bleiben ganz, ihre Regel rechnet mit dem, was der Teil hat.
- Die Namen der Listen bleiben im Export auch mit Schutz lebender Personen.
- **Grenzen:** GEDCOM trägt keine Listen, auch nicht beim ganzen Stammbaum. Die exportierte HTML-Seite zeigt Listen
  nur an und öffnet sie in der Tabelle.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:src/ui/import-export.ts exportableLists (jen s osobami, podle jména), scope 'list' (neplatný seznam → tree), exportScopeList, exportPersonListJSON (exportFocusedJSON), GEDCOM podstrom (:389), option.disabled scopeWholeOnly · src/subtree.ts:153 subsetForSubtree · src/person-lists-data.ts subsetForSubtree (pevný zúžit, prázdný ven, automatický celý) · src/ui/table-view/table-ui.ts:3215 exportPersonListCsv (leadColumnsOf: # a Hotovo, shownColumns persons, tableCsvFileName) · src/ui/person-list-hooks.ts exportRows (jen seznam s osobami) · strings.ts exportMenu.scopeLabel, scopeList, listPick, backupListDesc, gedcomListDesc, scopeWholeOnly, scopeView, lists.menu.export, export.ged, export.csv · app:33fa6cd4 · dirigent:MILAN.md 35 (4) jména seznamů v exportu zůstávají -->

<a id="A11.10"></a>
## A11.10 Listen in den Daten des Stammbaums

Listen sind Teil des Stammbaums (Datenversion 22): sie gehen mit dem Stammbaum in die Sicherung und die Übertragung,
und jede ihrer Änderungen ist ein Schritt **Rückgängig**.

- **Eine gelöschte Person** verschwindet aus allen Listen, die Reihenfolge der übrigen bleibt. Die Meldung des
  Löschens sagt es („… gelöscht, auch aus 2 Listen entfernt.“); **Rückgängig** bringt sie auch in die Listen zurück.
- **Zusammengeführte Personen:** den Platz der entfernten Person übernimmt die behaltene; sind beide in der Liste,
  bleibt sie einmal an der früheren Position. Sie ist erledigt, wenn eine der beiden erledigt war; von Hand entfernt
  nur, wenn beide entfernt waren. Ab App 3.32.0 übernimmt die behaltene Person auch die Verweise eigener Regeln.
- **Ein Stammbaum aus der Forschung** behält Listen und Angaben „hinzugefügt“ beim Laden einer neuen Version aus der
  Forschung, ab App 3.32.0 auch eigene Regeln, die Herkunft der Listen und die Änderungszeit der Personen.
- Ab App 3.32.0 (Datenversion 26) trägt eine Liste auch eine eigene Regel und ihre Herkunft (Vorlage), und eine
  Person die Zeit der letzten Änderung (für **Geändert im Zeitraum**).
  - Eine Liste mit eigener Regel hat auch die Personen gespeichert, die die Regel beim letzten Speichern fand; eine
    App, die eigene Regeln nicht kennt, zeigt sie deshalb als feste Liste mit diesen Personen.
  - Eine eigene Regel, die die App nicht ganz lesen kann (aus einer neueren Version), behält sie unverändert und hält
    die Liste als feste mit den gespeicherten Personen; eine App, die die Regel lesen kann, verwendet sie wieder.
  - Eigene Vorlagen sind nicht im Stammbaum ([A11.2.10](#A11.2.10)).
- **Grenzen:** eine ältere App (ab 3.19.0) öffnet einen Stammbaum mit Listen schreibgeschützt und speichert ihn nicht,
  damit sie die Listen nicht verwirft ([A6.7.7](A6-views.md#A6.7.7)). Einen von App 3.32.0 gespeicherten Stammbaum
  (Datenversion 26) öffnet eine ältere App schreibgeschützt.
- **Gilt seit:** App 3.30.0; 3.32.0: eigene Regel, Herkunft der Liste und Änderungszeit der Person in den Daten
  (Datenversion 26)

<!-- zdroj: app:src/types.ts STROM_DATA_VERSION 22 (seznamy, addedAt; app:714a8ab2) · src/data.ts:436 sanitizePersonLists při načtení · src/person-lists-data.ts onPersonDeleted, onPersonsMerged, keepPersonListData · src/research-link.ts:1903 keepPersonListData · strings.ts lists.toast.personDeleted · src/tree-manager.ts isTreeNewer, src/data.ts isNewerData · app:714a8ab2 · ZADANI_DEV „Data a rozhraní“, §16a, §16b · 3.32.0: src/version.ts v26 (PersonList.custom, origin, customUnknown, Person.changedAt aditivně; vlastní pravidlo dynamic false s personIds), src/person-lists-data.ts sanitizeCustomRule (celé, nebo customUnknown), withCustomSnapshot, onPersonsMerged, keepPersonListData (custom, origin, changedAt), src/types.ts ListTemplate v nastavení · app:5b16c6fc, efc14cff · spec 136 K1.8 -->
