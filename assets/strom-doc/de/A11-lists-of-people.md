<a id="A11"></a>
# A11 Personenlisten

Eine Personenliste hält ausgewählte Personen des Stammbaums unter einem Namen, damit sich wiederholt mit ihnen
arbeiten lässt: in der Tabelle als ihr Umfang ([A6.7.19](A6-views.md#A6.7.19)), im Export und als Arbeitsliste zum
Abhaken. Eine Liste entsteht nach einer Regel (Stammlinie, Vorfahren, Nachkommen, Forschungslinie, Filter der
Tabelle, wann die Personen hinzukamen), aus den Ergebnissen der Suche oder von Hand.
Das Kapitel beschreibt die Strom-App 3.30.0.

<!-- zdroj: dirigent:spec/084-seznamy-osob (K1.1–K8.4, rozhodnutí 14. a 16. 11.) · app:714a8ab2..60265541 (dirigent:prace/1116-app-084-seznamy) · app:docs/ZADANI_DEV_seznamy-osob.md §1–§13, §15, §16 · app:src/person-lists.ts, src/person-lists-data.ts · app:CHANGELOG.cs.md 3.30.0 „Pojmenované seznamy osob“ -->

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
- **Bedienung:** **Aktionen → Personenlisten…** ([A11.3](#A11.3)).
- **Gilt seit:** App 3.30.0

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

- **Partner:** Stammlinie, Vorfahren und Nachkommen nehmen nur Blutsverwandte. Ein Partner, der durch Heirat in die
  Familie kam, ist nicht in der Liste, bis er von Hand hinzugefügt wird.
- Generationen lassen sich von 1 bis 10 wählen oder **alle Generationen**. Die Zahl der Tage ist 1 bis 3650. Der Tag,
  ab dem die Liste zählt, ist der erste Tag des Zeitraums („in den letzten 30 Tagen“ = heute und die 29 Tage davor).
- Der Name ändert sich mit der Wahl der Regel, bis das Feld **Name** überschrieben wird.
- Jede Wahl zeigt die Zahl der Personen, die die Liste bekäme. Forschungslinie gibt es nur in einem Stammbaum mit
  Linien.
- **Aktuell halten** (standardmäßig aus) macht eine automatische Liste; sonst entsteht eine feste: „Feste Liste: Die
  Personen werden jetzt gewählt und ändern sich danach nur von Hand. Die Regel bleibt für „Nach Regel ergänzen“.“
- **Bedienung:** **Personenlisten → Neue Liste…** → **Nach**, **Aktuell halten**, **Erstellen**; bei einer Liste
  **Regel bearbeiten…**. Danach öffnet sich die Verwaltung mit der neuen Liste und die Meldung „Liste „{Name}“
  gespeichert.“
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:src/person-lists.ts rulePersonIds (rods/ancestors/descendants přes selection().memberIds – jen pokrevní, Q2; line přes personLineRole jako čip linie; tableFilter filterRows + sortRows; added: startOfDay − (days − 1) dní), ruleLabel · src/ui/person-list-new-ui.ts PERIODS 7/30/90, MAX_GENERATIONS 10, MAX_DAYS 3650, jméno podle pravidla do přepsání, počet u volby · ZADANI_DEV §3 (výchozí řazení podle pravidla), Q2 · app:e09dcacb · strings.ts lists.new.*, keep, keepOn, keepOff, create, toast.saved, rule.* -->

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
(„Wird fest mit den heutigen Personen“). Die Regel bleibt als **Entstanden aus**.

- Meldung „Liste eingefroren – jetzt fest.“ mit **Rückgängig**.
- Aus einer festen Liste lässt sich keine automatische machen.
- **Bedienung:** **⋯** einer automatischen Liste → **Einfrieren**.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:src/person-lists.ts withFrozen (dynamic false, personIds = listPersonIds, rule zůstává) · strings.ts lists.menu.freeze, freezeSub, toast.frozen · app:3dc8e709 -->

<a id="A11.2.3"></a>
### A11.2.3 Eine Regel, die nichts mehr findet

Verschwindet, worauf die Regel steht, bleibt die Liste bestehen, nur leer, und sagt, warum:

- „Die Regel findet nichts mehr: {Name} wurde gelöscht.“ (Vorfahren oder Nachkommen einer gelöschten Person; den
  Namen merkt sich die Regel aus der Zeit ihres Entstehens);
- „Die Regel findet nichts mehr: Der Stamm existiert nicht mehr.“;
- „Die Regel findet nichts mehr: Die Linie wurde entfernt.“
- Unter dem Satz stehen **Regel bearbeiten…** und **Liste löschen**.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:src/person-lists.ts ruleBroken (person podle rule.personName, rod, line) · strings.ts lists.ruleGone, ruleGoneRod, ruleGoneLine, deleteList · ZADANI_DEV §7d -->

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
- **⋯ der Liste** (an der Zeile in der Übersicht und im Detail): **In Tabelle öffnen**, **Auf der Karte** (ab App
  3.31.0), **Umbenennen**, **Duplizieren**, **Erledigtes abhaken** (fest, [A11.8](#A11.8)) oder **Einfrieren** (automatisch,
  [A11.2.2](#A11.2.2)), **Exportieren ›** ([A11.9](#A11.9)), **Löschen**.
  - **In Tabelle öffnen** schließt den Dialog und öffnet die Tabelle im Umfang der Liste
    ([A6.7.19](A6-views.md#A6.7.19)).
  - **Auf der Karte** (auch die Schaltfläche neben **In Tabelle öffnen** im Detail) schließt den Dialog, setzt die
    Liste als Auswahl des Fensters ([A6.6](A6-views.md#A6.6)) und öffnet die Karte mit dem Bereich **Auswahl**
    ([A6.5.7](A6-views.md#A6.5.7)). In einem weiteren Fenster führt das das Hauptfenster aus; ohne es ist **Auf der
    Karte** nicht verfügbar („Das Hauptfenster ist nicht geöffnet.“).
  - **Duplizieren** macht eine Kopie derselben Art mit derselben Regel, Reihenfolge, den von Hand entfernten und den
    abgehakten Personen, mit dem Namen „{Name} (2)“.
  - **Löschen** fragt nicht nach: Meldung „Liste „{Name}“ gelöscht.“ mit **Rückgängig**.
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
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:src/ui/person-lists-ui.ts (OVERLAY_ID person-lists-modal, SEARCH_FROM 9, LIST_DETAIL_ROWS 200, NARROW_QUERY, přejmenování klik/✎/F2, klávesy ↑↓ Enter Delete) · src/ui/person-list-hooks.ts listMenu (freezeAndChecklistRows, exportRows) · src/data.ts duplicatePersonList (structuredClone, suggestPersonListName), deletePersonList (Vrátit), storePersonList audit (personList.save, :2224 přejmenování, :2254 personList.delete, :2330 zmrazení) · index.html #actions-lists-row · src/ui/bottom-sheet.ts řádek Seznamy osob v listu Více · strings.ts menu.lists, lists.title, search, byName, byChange, changed, left, people, remove, addPerson, openTable, menu.*, large, back, toast.deleted, undo.*, audit.* · app:4acf7a09, 3dc8e709 · ZADANI_DEV §2, §16 (okna 079: WindowEditSink) · 3.31.0 Na mapě: src/ui/person-lists-ui.ts (tlačítko pl-onmap v detailu, ⋯ řádek map za open), src/ui/person-list-hooks.ts showOnMap, src/windows/window-show-on-map.ts, strings.ts lists.onMap, onMapTitle, table.onMapNoMain (app:2a578474, 39020cf1, ZADANI_DEV_vyber-osob §6) -->

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
  Seite des Panels der Person.
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
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:src/ui/person-list-add.ts MENU_LISTS 8, addTargets (pevné podle updated), personListMenuRows (✓, Další seznamy…, Nový seznam s touto osobou…, poznámka), listMenuEntries (víc osob, bez zdvojení), showAddPersonsToList (PICK_ROWS 200, inList) · src/ui/context-menu.ts getPersonMenuActions (za Hledat v archivech) · src/ui/person-list-new-ui.ts:215 (personIds → volba Prázdný s osobami; jedna osoba = osoba pravidla předků a potomků) · src/ui/table-view/table-ui.ts showTableRowMenu (toListN, tableAreaRowKeys, svazek oba partneři) · src/ui/search.ts (Výsledky do seznamu, všechny výsledky) · src/person-lists.ts withPersonsRemoved (done ven) · strings.ts contextMenu.toList, newListWith, newListWithMany, autoListsNote, moreLists, table.act.toListN, search.toList, newFromResults, lists.save.searchName, inList, addN, toast.added, removed, addedN, allIn · app:68363dbe · ZADANI_DEV §4 -->

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
  nur, wenn beide entfernt waren.
- **Ein Stammbaum aus der Forschung** behält Listen und Angaben „hinzugefügt“ beim Laden einer neuen Version aus der
  Forschung.
- **Grenzen:** eine ältere App (ab 3.19.0) öffnet einen Stammbaum mit Listen schreibgeschützt und speichert ihn nicht,
  damit sie die Listen nicht verwirft ([A6.7.7](A6-views.md#A6.7.7)).
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:src/types.ts STROM_DATA_VERSION 22 (seznamy, addedAt; app:714a8ab2) · src/data.ts:436 sanitizePersonLists při načtení · src/person-lists-data.ts onPersonDeleted, onPersonsMerged, keepPersonListData · src/research-link.ts:1903 keepPersonListData · strings.ts lists.toast.personDeleted · src/tree-manager.ts isTreeNewer, src/data.ts isNewerData · app:714a8ab2 · ZADANI_DEV „Data a rozhraní“, §16a, §16b -->
