<a id="A3"></a>
# A3 Belege in der App

Wie in der App Quellen erfasst werden, wie mit ihnen zitiert wird, wie Ausschnitte und Dateien beigefügt werden und
wo die App selbst zeigt, was fehlt. Beschrieben werden die Strom-App 3.21.2 (und die Forschung 1.25.2); Änderungen aus einer neueren Version tragen deren Nummer. Wie sicher eine Angabe ist und wie die Belegstufe einer Person berechnet
wird, beschreibt [R3.8](R3-verification-and-citation.md#R3.8); der Import von Quellen aus GEDCOM steht in
[A2](A2-loading-a-family-tree.md).

<a id="A3.1"></a>
## A3.1 Eine Quelle ist ein Eintrag

Eine Quelle ist ein konkreter Eintrag: Taufe, Heirat, Tod. Der Stammbaum hat eine einzige Liste von Quellen.
Personen und Angaben verweisen nur auf sie, sodass ein Eintrag mehrere Menschen und mehrere Angaben belegen kann.

- Felder: **Titel** (Pflicht), **Archiv**, **Signatur**, **Folio/Seite**, **Bild**, **Weitere Fundstelle**, **URL**,
  **Notiz**. Wo der Eintrag im Buch steht, beschreibt [A3.9](#A3.9). Unter **Mehr: Transkription, Eintragsdatum,
  Verlässlichkeit** liegen **Transkription des Eintrags**, **Eintragsdatum** und **Zuverlässigkeit der Quelle**. Der Abschnitt
  ist offen, wenn eines davon ausgefüllt ist.
- **Eintragsdatum** sagt, wann der Eintrag angelegt wurde. Es kann vom Datum des Ereignisses abweichen, z. B. eine
  nachträglich eingetragene Taufe.
- **Zuverlässigkeit der Quelle** hat drei Stufen: **Original**, **Abschrift / Index**, **Unsicher**. Ein zweites
  Tippen auf die gewählte Stufe hebt sie auf. Wie die Forschung sie nimmt, beschreibt
  [R3.2.1](R3-verification-and-citation.md#R3.2.1).
- **Grenzen:** ohne Titel lässt sich eine Quelle nicht speichern („Quellentitel eingeben“). Ein ungültiges
  **Eintragsdatum** wird nicht gespeichert. Der Wert 0 der Verlässlichkeit aus einem GEDCOM-Import erscheint als
  **Unsicher** und bleibt, bis eine andere Stufe gewählt wird. Das Löschen einer Quelle entfernt alle ihre
  Zitationen; die App fragt vorher und sagt, an wie vielen Stellen sie zitiert ist.
- **Bedienung:** **Aktionen → Quellen** (Liste der Quellen des Stammbaums mit der Zahl der Zitationen „n×“, Suche ab
  11 Quellen, Sortierung nach Titel); **Quelle bearbeiten**, **Quelle hinzufügen**. Den Punkt **Quellen** im Menü
  **Aktionen** gibt es nur bei einem bearbeitbaren Stammbaum und nur, wenn schon eine Quelle existiert oder
  **Einstellungen → Personenkarte → Erweiterte Felder** eingeschaltet ist.
- **Gilt seit:** App 1.4.0; **Zuverlässigkeit der Quelle** und **Eintragsdatum** 3.1.0; **Signatur**, **Folio/Seite**, **Bild**
  und **Weitere Fundstelle** 3.27.0 (früher **Archiv / Einrichtung** und **Signatur / Fundstelle**)
- **Ab App 3.27.0:** **Zuverlässigkeit der Quelle** ist die Standard-Zuverlässigkeit ihrer Zitationen. Eine Zitation
  mit eigener Zuverlässigkeit (aus einem GEDCOM-Import, [A2.6.1](A2-loading-a-family-tree.md#A2.6.1)) behält sie, auch
  wenn sich der Standard ändert; die übrigen Zitationen folgen der Änderung. Eine Angabe zeigt die Zuverlässigkeit
  ihrer Zitation ([A3.6](#A3.6), [S7.1](S7-reliability-and-verification.md#S7.1)). Früher bewertete die
  Zuverlässigkeit nur die ganze Quelle.

<!-- zdroj: app:src/types.ts Source · od 3.27.0: app:9732853b strings.ts sources.fieldRepository/fieldCallNumber/fieldFolio/fieldImage/fieldReference · src/ui/sources.ts:214 renderSourcesList, :327 deleteSource, :531 fillSourceEditor, :576 wireSourceEditor, :667 renderQualityControl, :733 saveSourceFromModal · src/ui/tree-management.ts:675 isSourcesMenuOffered · src/settings.ts:320 isAdvancedFields · strings.ts sources.titleHint/fieldTitle/fieldRepository/fieldReference/fieldUrl/fieldNote/more/fieldTranscript/fieldRecordDate/recordDateHint/reliabilityLabel (index.html source-quality-label)/quality1-3/titleRequired/citations/deleteConfirm, advanced.settingLabel · 3.27.0 výchozí spolehlivost: app:dde0151a src/citation-quality.ts setCitationQuality, citation-quality-shown.test.ts (formulář = výchozí) -->

<a id="A3.1.1"></a>
### A3.1.1 Transkription und Abschrift geprüft

**Transkription des Eintrags** ist der Text des Eintrags, so wie ihn der Benutzer gelesen hat. Bei einem mit der
Forschung verbundenen Stammbaum bestimmt die Einstellung **Meine Quellenabschriften**, wie die Forschung ihn nimmt
([R3.5.1](R3-verification-and-citation.md#R3.5.1)). Der Editor zeigt danach eines von dreien:

- das Kontrollkästchen **Abschrift geprüft**: bei der Einstellung **Hinweis** immer; bei **Beleg** nur bei einer
  Quelle, die vor dem Umschalten gesendet und seitdem nicht geändert wurde, oder bei einer Quelle, die schon
  angehakt ist;
- die Zeile „Gilt als erste Lesung (Stammbaum auf „Beleg“)“: bei **Beleg** und einer neuen oder geänderten Quelle;
- nichts: ein Stammbaum ohne Forschung, eine Quelle ohne Transkription oder eine Transkription, die die Forschung
  selbst gelesen hat.
- Bei einer Transkription, die die Forschung gelesen hat, weist der Editor darauf hin: eine Korrektur wird als
  Lesung des Benutzers gespeichert, und die Forschung vergleicht sie mit dem Bild. Im Quellenbetrachter steht unter
  der Transkription „Abschrift in der App gelesen / von der Forschung gelesen / in der App und von der Forschung
  gelesen“.
- **Grenzen:** das Anhaken ändert nichts am Grad der Sicherheit in der App, es entscheidet die Forschung. Ist das
  Kontrollkästchen nicht zu sehen, bleibt **Abschrift geprüft** nur, wenn sich die Transkription nicht geändert hat.
- **Bedienung:** Editor der Quelle, **Mehr: Transkription, Eintragsdatum, Verlässlichkeit**; in **Aktionen →
  Quellen** der Filter **Abschrift nicht geprüft** (nur bei einem Stammbaum auf **Beleg** mit älteren ungeprüften
  Quellen).
- **Gilt seit:** App 3.9.0
- **Ab App 3.24.0:** die Übersetzung der Transkription, die die Forschung gesendet hat
  ([R3.4](R3-verification-and-citation.md#R3.4)), steht unter der Transkription als zugeklappter Abschnitt
  **Übersetzung der Transkription**: im Quellenbetrachter und auf der Karte der Quelle auf der Seite der Person. Die
  Notiz der Quelle ändert sich dadurch nicht; der Editor der Notiz zeigt sie ganz. Eine Quelle ohne Übersetzung sieht
  aus wie früher.
- **Ab App 3.25.0:** eine Abschrift, die nur die Forschung gelesen hat, lässt sich im Quellenbetrachter bestätigen,
  ohne den Text zu ändern ([A3.1.3](#A3.1.3)).

<!-- zdroj: app:src/research-sync.ts:357 researchReadSource, :365 isOlderSource, :377 verifiedOffer, :385 unverifiedOlderSources · src/ui/sources.ts:618 renderSourceReading, :658 sourceVerifiedValue, :296 renderSourcesFilter, :377 renderSourceViewer · strings.ts sources.verified/verifiedHintGuide/verifiedHintOlder/verifiedByTree/readBy/userReadingNote/filterUnverified · překlad (od 3.24.0): src/source-translation.ts SOURCE_TRANSLATION_LABELS, splitSourceTranslation · strings.ts viewerTranslation, translation · commit c2942b0 -->

<a id="A3.1.2"></a>
### A3.1.2 Quelle löschen im verfolgten Stammbaum

Bei einem Stammbaum, den die App live aus der Forschung verfolgt, lässt sich eine Quelle direkt in der Forschung
löschen. Die Forschung zieht die Quelle zurück ([R3.10](R3-verification-and-citation.md#R3.10)): aus Angaben und
Erzählungen verschwinden ihre Zitate, Daten, Orte, Namen und der Text der Erzählungen ändern sich nicht, und das
Löschen lässt sich rückgängig machen.

- Das Fenster **Quellen** ist bei einem verfolgten Stammbaum schreibgeschützt: ohne Bearbeiten und Hinzufügen, in der
  Zeile einer Quelle ist nur der Papierkorb. Antwortet die Forschung nicht, ist der Papierkorb inaktiv und sagt beim
  Darüberfahren „Eine Quelle lässt sich löschen, wenn die Forschung läuft.“ Auf einem Touch-Gerät ist in der Zeile
  statt des Papierkorbs **⋯** mit einem Blatt von unten: **Quelle öffnen** und **Quelle löschen…**.
- Der Dialog **Quelle löschen?** ermittelt zuerst in der Forschung, was auf der Quelle steht („In der Forschung wird
  ermittelt, was auf die Quelle verweist…“), und erlaubt erst dann das Löschen. Unter der Überschrift **Was auf der
  Quelle steht** sagt er, wie viele Zitate bei Angaben und wie viele Erzählungen die Quelle zitieren, und nach Zeilen:
  - **Angaben** und **Ohne Quelle**: welche Angaben ohne Quelle bleiben („Die Angaben bleiben, nur ohne Zitat.“)
    und welche auch eine andere Quelle haben;
  - **Weniger sicher**: wie viele Angaben weniger sicher werden;
  - **Erzählungen**: „Der Erzähltext bleibt; die Quelle fällt nur aus der Quellenliste der Erzählung.“ Das Kürzel der
    Quelle im Text bleibt, nur nicht mehr als Verweis;
  - **Widersprüche**: ein Widerspruch bleibt und wird markiert „Quelle zurückgezogen – prüfen“
    ([S3.4.1](S3-what-the-research-knows.md#S3.4.1)); bei einem entschiedenen „die Entscheidung bleibt“. Ein
    Widerspruch schließt sich nicht von selbst;
  - **Aufgaben** (offen, in Arbeit, zurückgestellt, wartet): eine Aufgabe nur zu dieser Quelle endet als aufgegeben,
    bei einer anderen fällt die Quelle aus den Orten der Aufgabe; er sagt auch, wenn ein Agent gerade an der Aufgabe
    arbeitet. **Rückgängig** bringt die Aufgaben in den jetzigen Zustand zurück;
  - **Dateien**: eine Datei bleibt in den Materialien, nur ohne Verknüpfung zur Quelle; Archivbilder bleiben bei der
    Quelle. Ist die Quelle aus einer Stammbaumdatei entstanden, sagt der Dialog das; auch die Datei löschen lässt
    sich in den Materialien ([A3.5.17](#A3.5.17)).

  Eine Quelle, die niemand zitiert, hat nur „Niemand zitiert die Quelle.“
- Nach **Quelle löschen** sagt die Meldung „Quelle … in der Forschung gelöscht.“ mit **Rückgängig**. **Rückgängig**
  bringt die Quelle samt Zitaten zurück; ein Zitat, dessen Angabe sich inzwischen geändert hat, lässt sich nicht
  zurückbringen, und die Meldung sagt, wie viele. Später lässt sich die Quelle in der Forschung wiederherstellen
  (`strom source restore`).
- **Prüft der Code:**
  - das Löschen gilt nur für die Liste, die der Dialog gezeigt hat, und höchstens 15 Minuten. Hat sich die Liste
    inzwischen geändert oder ist die Bestätigung abgelaufen, zeigt der Dialog die neue Liste, und das Löschen muss
    neu bestätigt werden;
  - schreibt die Forschung gerade, wird das Löschen gleich erneut versucht. Bei einer Quelle, die nicht mehr in der
    Forschung ist, wird der Baum neu geladen; eine bereits zurückgezogene Quelle meldet der Dialog;
  - eine schreibgeschützte Forschung (auf einem anderen Computer versiegelt) bietet das Löschen nicht an.
- **Grenzen:**
  - nur bei einem verfolgten Stammbaum einer Forschung, die das Löschen einer Quelle kann, und nur bei einer Quelle
    aus der Forschung; nicht bei einer Kopie des Stammbaums. Das Löschen beim Bearbeiten eines Stammbaums aus der
    Forschung beschreibt [S2.6.1](S2-edits-from-the-app.md#S2.6.1);
  - **Rückgängig** braucht eine laufende Forschung; sonst sagt die Meldung, dass sich die Quelle in der Forschung
    wiederherstellen lässt. Eine in der Forschung zusammengeführte oder anders zurückgezogene Quelle lässt sich nicht
    wiederherstellen.
- **Bedienung:** App: **Aktionen → Quellen** → Papierkorb (auf Touch **⋯** → **Quelle löschen…**) → **Quelle
  löschen**; Meldung → **Rückgängig**. Der Eintrag **Quellen** ist bei einem verfolgten Stammbaum nur dann im Menü,
  wenn sich das Löschen anbieten lässt.
- **Gilt seit:** App 3.31.0 mit Forschung 1.36.0

<!-- zdroj: app:d527ffdd src/source-retract.ts sourceRetractOfferedIn (null bez sledování, jen ke čtení, kopie link.copy, bez brány source.retract; off když most neodpovídá), RETRACT stavy · 9d91f035, 4178ef85 src/ui/sources.ts sourcesReadOnly, openSourceRowSheet, source-retract-ui.ts (dialog, toast Vrátit, /source/restore) · src/ui/tree-management.ts isSourcesMenuOffered (zamčený strom jen se sourceRetractOffered) · strings.ts sources.retract.* (trashOff, rowMenu, menuDelete, menuOpen, title, intro, loading, usesTitle, counts, rows, bare, hasOther, lowered, storyKeep, storyCode, conflictReview, conflictDecided, conflictNever, taskState, taskDropped, taskNarrowed, taskDoing, tasksBack, filesStay, images, fileTree, undoLater, noCites, go, changed, expired, busyWait, gone, already, readonly, toast, undo, restored, restoredPart, restoreDown, notRestorable) · SPEC.md 1120-app-117-smazani · research:e6bbfb40 src/core/sourceretract.ts RETRACT_CONFIRM_MS · spec 117 §1–§3, J3 -->

<a id="A3.1.3"></a>
### A3.1.3 Abschrift der Forschung bestätigen

Eine Abschrift, die nur die Forschung gelesen hat, kann der Benutzer bestätigen: er hat den Eintrag selbst gelesen,
und die Abschrift stimmt. Der Text ändert sich nicht; die Abschrift gilt dann auch als Lesung des Benutzers
([R3.5.2](R3-verification-and-citation.md#R3.5.2)).

- Im Quellenbetrachter steht am Ende der Zeile „Abschrift von der Forschung gelesen“ eine kleine Schaltfläche
  **Abschrift bestätigen** („Die Abschrift stimmt mit dem Eintrag überein und gilt dann auch als in der App
  gelesen.“). Nach der Bestätigung lautet die Zeile „Abschrift von der Forschung gelesen und am ‹Datum› in der App
  bestätigt“, und die Schaltfläche ist **Bestätigung zurücknehmen** („Die Abschrift gilt wieder nur als von der
  Forschung gelesen.“).
- **Grenzen:**
  - nur bei einer Quelle mit einer Abschrift, die die Forschung kennt und nur sie gelesen hat; eine Abschrift, die
    der Benutzer anders gelesen hat, lässt sich nicht bestätigen;
  - nur in einem mit der Forschung verbundenen Stammbaum, deren Brücke Bestätigungen annimmt; nicht in einem
    Strom-Archiv, in einer Forschung, die auf ihren Agenten wartet, und nicht in einem schreibgeschützt geöffneten
    Stammbaum;
  - läuft die Forschung nicht, ist die Schaltfläche in Ruhe mit dem Satz „Bestätigen geht, solange die Forschung
    läuft.“ (beim Zurücknehmen „Die Bestätigung lässt sich zurücknehmen, solange die Forschung läuft.“);
  - die Bestätigung schreibt die Forschung, nicht die App. Die Antwort ist sofort zu sehen; in den Stammbaum kommt
    sie mit der nächsten Version der Forschung;
  - die Forschung kann ablehnen, und die App sagt warum: die Abschrift hat sich inzwischen geändert („Der neue
    Wortlaut lässt sich bestätigen, sobald er da ist.“), die Quelle ist zusammengeführt, zurückgezogen oder nicht
    mehr in der Forschung, oder die Forschung wurde zuletzt von einer neueren Version von Strom Research geschrieben;
  - eine Bestätigung ändert den Grad der Sicherheit in der App nicht; es entscheidet die Forschung.
- **Bedienung:** App: **Aktionen → Quellen** → eine Quelle → **Abschrift bestätigen** / **Bestätigung
  zurücknehmen**; gilt auch in einem Stammbaum, den die App live aus der Forschung verfolgt.
- **Gilt seit:** App 3.25.0, Forschung 1.29.0

<!-- zdroj: app:v3.30.0 src/source-confirm.ts (SOURCES_CONFIRM_FEATURE sources.confirm, SOURCE_CONFIRM_TIMEOUT_MS, sourceConfirmAction, sourceConfirmOffer: agentless, readOnly, rest) · src/ui/source-confirm-ui.ts (prohlížeč pramene, odpověď hned, strom až s další verzí výzkumu _STROM_READ/_CONF/_TXT) · strings.ts sources.readConfirmed, sources.confirm.action/actionTitle/undo/undoTitle/restConfirm/restUndo/changed/merged/retracted/reader/none/archive/locked · CHANGELOG.cs.md 3.25.0 · research:src/core/confirm.ts -->

<a id="A3.2"></a>
## A3.2 Zitation: was eine Quelle belegt

Eine Zitation sagt, welche Angabe eine Quelle belegt. Zitiert wird zur Person, zu ihrer Geburt und ihrem Tod, zu
einem einzelnen Ereignis der Person, zur Heirat und zu einem gemeinsamen Ereignis des Paares. Aus den Zitationen
berechnet die App die Belegstufe der Person ([R3.8.1](R3-verification-and-citation.md#R3.8.1)).

- Beim Bearbeiten einer Person: Abschnitt **Quellen** (Zitationen zur Person), **+ Quelle** unter dem Feld für
  Geburt und Tod, Zitationen bei jedem Ereignis; bei einer Verbindung **Quelle zitieren (Trauungseintrag…)**. Eine
  Zitation ist ein Etikett mit dem Titel der Quelle; Tippen öffnet den Quellenbetrachter, × entfernt die Zitation
  (**Zitat entfernen**), die Quelle bleibt.
- Außerhalb der Bearbeitung einer Person (Menü der Person **Quellen**, Hervorhebung [A3.7](#A3.7)) erscheint in der
  Auswahl der Quelle **Belegt**: **Person** / **Geburt** / **Tod**. Tod nur bei einer Person mit Tod. Hat die Geburt
  noch keine Quelle, beginnt die Auswahl bei **Geburt**.
- **Grenzen:** eine Zitation hat keinen Grad der Sicherheit. Eine nur an die Person gehängte Quelle belegt die
  Person, nicht die Geburt. Ein schreibgeschützter Stammbaum, ein gesperrter Stammbaum und eine gesperrte Person
  erlauben kein Zitieren. Bei einer Person sind die Abschnitte für Quellen und Anhänge zu sehen, wenn **Erweiterte
  Felder** eingeschaltet ist oder schon etwas ausgefüllt ist.
- **Bedienung:** siehe oben; die Auswahl der Quelle beschreibt [A3.2.1](#A3.2.1).
- **Gilt seit:** App 1.4.0; **Belegt** und **+ Quelle** 3.5.0

<!-- zdroj: app:src/ui/sources.ts:1220 renderSourceChips, :1288-1306 unciteBirthSource…unciteEventSource, :1331 showSourcePickerForPersonId, :1343 showSourcePickerForFact, :1356 renderSourcePickerFact, :1399 showSourcePickerForPartnership · src/ui/person-sources-ui.ts:114 canCiteOnPerson · src/settings.ts:320 · strings.ts sources.sectionTitle/citeAdd/citePartnership/remove/pickerFactLabel/pickerFactPerson, advanced.settingHint -->

<a id="A3.2.1"></a>
### A3.2.1 Auswahl der Quelle

- **Quelle zitieren** öffnet die Auswahl. Gesucht wird in Titel, Archiv, Signatur und Transkription. Quellen, die
  bei derselben Angabe schon zitiert sind, werden nicht angeboten.
- **Zuletzt verwendet**: bis zu 5 Quellen, getrennt für jeden Stammbaum in diesem Browser. Sie erscheinen nur, wenn
  der Stammbaum mehr als 8 Quellen hat und die Suche leer ist.
- **Neue Quelle…** füllt den Titel nach dem vor, was zitiert wird: „Geburt – Marie Vlková, 1865“, „Trauung – Josef
  Horák und Marie Vlková, 1890“. Das Jahr fehlt, wenn es nicht bekannt ist. Die neue Quelle wird sofort zitiert.
- **Andere Seite** bei einer Quelle in der Auswahl: eine neue Quelle mit demselben Titel, Archiv, Link,
  Verlässlichkeit und derselben Notiz; aus der Signatur verschwindet die Seite, aus der Notiz die Zeilen mit der
  Seite und mit dem Eintragsdatum. Nennt der Titel des Buches eine Person aus dem Stammbaum, wird ein Titel nach der
  zitierten Angabe vorgeschlagen.
- **Weiterer Eintrag aus demselben Buch** (Betrachter und Editor der Quelle): eine neue Quelle mit demselben Archiv
  und demselben Link; die Signatur ohne Nummer und Datum des Eintrags, also Buch, Bild und Seite („Buch 12, Bild 5,
  S. 3, 2. Eintrag (3. 4. 1801)“ → „Buch 12, Bild 5, S. 3“). Eine Signatur, in der die App den Teil des Eintrags
  nicht erkennt, bleibt ganz und zur Prüfung markiert. Aus dem Etikett einer Zitation geöffnet, wird sie sofort dort
  zitiert.
- **Gilt seit:** App 3.1.0 (**Zuletzt verwendet**, **Weiterer Eintrag aus demselben Buch**); **Andere Seite** 3.9.0;
  3.25.0: **Weiterer Eintrag aus demselben Buch** ohne Nummer und Datum des Eintrags
- **Ab App 3.27.0:** gesucht wird auch in Signatur, Folio und Bild. Bei einer Quelle mit Feldern ([A3.9](#A3.9))
  übernimmt **Weiterer Eintrag aus demselben Buch** Archiv, Signatur und Link; **Folio/Seite**, **Bild** und **Weitere
  Fundstelle** bleiben leer, und der Cursor steht in **Folio/Seite**. **Andere Seite** übernimmt bei einer Quelle mit
  Feldern auch die Signatur. Eine ältere Quelle (die Fundstelle als ein Text) verhält sich wie bisher.

<!-- zdroj: app:src/ui/sources.ts:1427 renderSourcePickerList, :322 sourceMatches, :1475 currentCitationSourceIds, :1505 noteRecentSource, :1526 otherPageFromPicker, :1554 createSourceFromPicker, :1569 suggestedSourceTitle, :1181 startSameBookEntry · src/settings.ts:12 RECENT_SOURCES_MAX · strings.ts sources.pickTitle/searchPlaceholder/recent/all/createNew/newTitleMarriage/otherPage/otherPageTitle/sameBook · 3.25.0: app:7327b758 src/source-page.ts sameBookReference (ENTRY_PART, DATE_PART, whole), src/ui/sources.ts:1217 (nepoznaný tvar označený) · CHANGELOG.cs.md 3.25.0 · dirigent:test/vysledek-1107-nejista-mista.md · 3.27.0: app:9732853b (další zápis s poli, Jiná stránka se signaturou), c3278633 sourcePlaceSearchText -->

<a id="A3.2.2"></a>
### A3.2.2 Reihenfolge der Zitate und Hauptzitat

Eine Angabe mit mehreren Zitationen hat sie überall in derselben Reihenfolge: die Etiketten beim Bearbeiten einer
Person und bei der Heirat, die Sprechblase an der Marke der Angabe, **Quellen** der Person. Wo die App nur eine
Zitation nimmt, nimmt sie die erste: den Auszug auf der Personenseite, die Heirat auf den Familienseiten, die
Quellennummern im Familienbuch, die Spalten der Zitationen in der **Tabelle** ([A6.7](A6-views.md#A6.7)) und die erste
Quelle bei **Prüfen** ([S7.3](S7-reliability-and-verification.md#S7.3)). Dieselbe Reihenfolge hat die Forschung
([R3.4.5](R3-verification-and-citation.md#R3.4.5)).

- **Reihenfolge:**
  1. das Hauptzitat, das der Benutzer gewählt hat;
  2. der primäre Eintrag des Ereignisses: eine Quelle, die diese Art von Ereignis verzeichnet, mit einer Zitation
     **Original** und höchstens 12 Monate nach der Angabe eingetragen. Bei Geburt und Taufe ein Geburts- oder
     Taufeintrag, bei Tod, Beerdigung und Einäscherung ein Sterbe- oder Beerdigungseintrag, bei Heirat, Aufgebot und
     Verlobung ein Heiratseintrag, bei einer Volkszählung eine Volkszählung. Ein früher eingetragener steht vor einem
     später eingetragenen, eine Quelle ohne **Eintragsdatum** hinter den eingetragenen mit Datum. Ein fehlendes oder
     unlesbares Datum der Angabe entscheidet nicht;
  3. die übrigen Zitationen mit der Zuverlässigkeit **Original**;
  4. die übrigen nach Zuverlässigkeit: **Abschrift / Index**, **Unsicher**, dann ohne Zuverlässigkeit;
  5. nach dem Zahlenteil der Quellennummer (eine Quelle ohne Nummer hinter den nummerierten), zuletzt die Reihenfolge,
     in der die Zitationen hinzugefügt wurden.
- Welche Ereignisse eine Quelle verzeichnet, weiß die App aus der GEDCOM-Datei (`1 DATA` › `2 EVEN`,
  [A2.6](A2-loading-a-family-tree.md#A2.6)); die Forschung schreibt es bei ihren Quellen. Eine Quelle ohne diese
  Angabe ist kein primärer Eintrag.
- **Hauptzitat:** eine Zitation einer Angabe kann der Benutzer als Hauptzitat markieren. Sie steht zuerst, ihr Etikett
  hat ★ vor dem Titel und einen hervorgehobenen Rand, seine Schaltfläche sagt „Hauptzitat“. In der Sprechblase steht
  bei ihr „★ Haupt“, in **Quellen** der Person und in **Belegt** des Quellenbetrachters ★ hinter der Angabe. Eine
  Zitation, die nur nach der Reihenfolge die erste ist, hat keine Marke.
- **Leiste im Quellenbetrachter:** der aus der Zitation einer Angabe geöffnete Betrachter (Etikett, Zeile der
  Sprechblase, Zeile in **Quellen** der Person) zeigt oben, was die Zitation belegt („Geburt · Marie Vlková“) und wo
  sie in der Reihenfolge steht: „2. von 3 Zitaten“; bei der ersten auch warum („steht zuerst: Eintrag (Geburt),
  Original“, „Original“, „höchste Verlässlichkeit“); „Hauptzitat (Geburt)“; „Einziges Zitat (Geburt)“. Darunter die
  Schaltflächen **Als Hauptzitat markieren** oder **Hauptzitat aufheben** und **Zitat entfernen** ([A3.2.3](#A3.2.3)).
- **Grenzen:**
  - gespeicherte Listen der Zitationen werden nicht umsortiert; die Reihenfolge wird bei der Anzeige und beim Export
    berechnet;
  - **Als Hauptzitat markieren** gibt es nur bei einer Angabe mit 2 und mehr Zitationen, und nur in einem Stammbaum
    ohne Forschung oder mit einer Forschung, die das Hauptzitat führt (Forschung 1.34.0 und neuer). Nur dort ist
    auch ★ zu sehen;
  - ein Stammbaum der Forschung, die die Reihenfolge der Zitationen selbst bestimmt, hat die Zitationen in der
    Reihenfolge aus der Datei der Forschung; das Hauptzitat steht zuerst;
  - bei einer gesperrten Person und in einem schreibgeschützten Stammbaum gibt es die Schaltflächen nicht;
  - Markieren, Wechseln und Aufheben ist ein Schritt **Rückgängig** („Hauptzitat (Geburt): …“, „Hauptzitat (Geburt)
    aufgehoben; die Reihenfolge ist wieder automatisch“). Das Entfernen des Hauptzitats oder seiner Quelle und eine
    Änderung des Ereignisses ohne es heben die Marke im selben Schritt auf; **Rückgängig** bringt Platz und ★ zurück;
  - ein gemeinsames Ereignis ([A10.1](A10-shared-events.md#A10.1)) hat ein Hauptzitat, das allen Kopien gemeinsam
    ist; Kopien, die sich darin unterscheiden, sind abweichende Kopien ([A10.3](A10-shared-events.md#A10.3));
  - eine in eine andere zusammengeführte Quelle überträgt die Marke auf die Quelle, in die sie zusammengeführt wurde.
    Das Zusammenführen von Stammbäumen ([A8](A8-merging-trees.md)) lässt die Marke der Seite, die sie hat; haben sie
    beide, die der behaltenen Seite.
- **Bedienung:** der aus der Zitation einer Angabe geöffnete Quellenbetrachter → **Als Hauptzitat markieren** ·
  **Hauptzitat aufheben**. Terminal der Forschung: `strom event main` ([R3.4.5](R3-verification-and-citation.md#R3.4.5)).
- **Gilt seit:** App 3.29.0

<!-- zdroj: app:e361220d src/citation-order.ts FACT_RECORDS, recordOfFact, PRIMARY_RECORD_MONTHS 12, orderedCitationSteps (main, primary jen QUAY 3, written, QUAY, number, list), citationMain (jeden krok Zpět, sdílená kopie, remap, merge/executor.ts), data v21 · 9c0ca227 (★ a pořadí: sources.ts chipy, relationships-panel, status-tip „★ hlavní“, person-sources, person-page, family-pages-html, book-blocks, table-sources, verify.ts) · 192d53ec src/citation-bar.ts citeBar, whyFirst, citeMainToast · src/citation-gates.ts citationMainOffered, citationFileOrder, citationMainShown · strings.ts sources.mainMark, citeAt, citePos, citeFirstWhy, whyPrimary, whyOriginal, whyQuality, citeMainAt, citeOnly, setMain, clearMain, mainSetToast, mainClearedToast · spec 095 K1.1, §2 -->

<a id="A3.2.3"></a>
### A3.2.3 Zitat entfernen

**Zitat entfernen** löst eine Quelle von einer Angabe. Die Quelle bleibt in **Quellen** des Stammbaums mit ihren
Ausschnitten und Anhängen, und die übrigen Angaben zitieren sie weiter.

- **Prüft der Code:**
  - ohne Bestätigung, auch beim Hauptzitat. Die Leiste im Betrachter sagt dann „Gelöst (Geburt) · die Quelle bleibt im
    Katalog“, und die Schaltflächen verschwinden;
  - die Meldung nennt Angabe und Quelle: „Zitat entfernt (Geburt): … · die Quelle bleibt“, beim Hauptzitat „…, kein
    Hauptzitat mehr: …“, bei einem gemeinsamen Ereignis „…, bei allen N Personen: …“ (es wird aus allen Kopien
    entfernt);
  - ein Schritt **Rückgängig**: **Rückgängig** in der Meldung bringt die Zitation an ihren Platz zurück, samt ★. Die
    Meldung steht auch über dem geöffneten Betrachter, sodass sich **Rückgängig** dort verwenden lässt;
  - in einem Stammbaum der Forschung, die das Entfernen nicht übernimmt, steht unter den Schaltflächen „Die Forschung
    übernimmt Entfernungen noch nicht.“, und das erste Entfernen im Fenster sagt „Die Forschung übernimmt dieses
    Entfernen nicht; beim Laden ihrer Version kommt das Zitat zurück.“, jedes weitere nur noch „von der Forschung
    nicht übernommen“. Was die Forschung mit dem Entfernen tut, beschreibt [S2.3.1](S2-edits-from-the-app.md#S2.3.1).
- **Grenzen:** bei einer gesperrten Person und in einem schreibgeschützten Stammbaum gibt es die Schaltfläche nicht.
  Eine ganze Quelle wird in **Aktionen → Quellen** gelöscht ([A3.1](#A3.1)).
- **Bedienung:** der aus der Zitation einer Angabe geöffnete Quellenbetrachter → **Zitat entfernen**; × am Etikett
  der Zitation beim Bearbeiten einer Person ([A3.2](#A3.2)).
- **Gilt seit:** App 1.4.0 (× am Etikett); Leiste und Meldung 3.29.0

<!-- zdroj: app:192d53ec src/citation-bar.ts citeBar (gone, note = editable && removeNotTaken), unciteToast (unciteWarned jednou na strom v okně), citeBarHtml · src/citation-gates.ts citationRemoveTaken (feature citations.remove) · strings.ts sources.citeGone, uncitedToast, uncitedMainToast, uncitedSharedToast, sourceStays, uncitedNotTaken, uncitedNotTakenShort, unciteNote, undo.uncite · spec 095 §3 -->

<a id="A3.3"></a>
## A3.3 Ausschnitt des Eintrags

Ein Ausschnitt des Eintrags ist ein Bild genau dieses Eintrags, nicht der ganzen Seite. Er erscheint bei der Quelle,
im Betrachter und im Buch.

- Drei Wege: **Aus Zwischenablage einfügen** (Ctrl+V, auf dem Mac ⌘V; der Ausschnitt wird genommen, wie er ist),
  **Bild hochladen** (öffnet den Zuschnitt **Eintrag ausschneiden**) und **Aus Anhang ausschneiden** (Bildanhänge der
  Person, bei einer Heirat beider Partner). Ein Bild lässt sich auch auf das leere Feld ziehen.
- Der Ausschnitt wird als JPEG mit einer längeren Seite von höchstens 1200 px gespeichert. **Beschriftung
  (optional)** bleibt auch nach **Ersetzen**.
- **Auch die ganze Seite als Anhang speichern** im Zuschnitt: die ganze Seite wird der Person als Anhang hinzugefügt
  ([A3.4](#A3.4)). **Zuschneiden** geht dann erneut von der ganzen Seite aus.
- Quellenbetrachter: Ausschnitte (Tippen vergrößert), **Seite im Archiv öffnen ↗** (Link des Ausschnitts, sonst die
  URL der Quelle), **Transkription**, **Belegt** (Liste der Zitationen); ohne Ausschnitt **Ausschnitt hinzufügen**.
  Bei einem Ausschnitt, den die Forschung erstellt hat, gibt es **Volle Qualität**: öffnet den Ausschnitt aus dem
  Originalscan in der Forschung.
- **Grenzen:** in der App lassen sich höchstens zwei Ausschnitte hinzufügen (der Eintrag und die Fortsetzung von der
  nächsten Seite). Die Forschung erfasst bis zu drei ([R3.4](R3-verification-and-citation.md#R3.4)); einen dritten
  behält die App, weitere fügt sie nicht hinzu. Die ganze Seite lässt sich nur bei einer Person speichern, nicht bei
  einer Heirat und nicht bei einer gesperrten Person. Drehen im Zuschnitt hebt die Bindung des Ausschnitts an den
  Anhang auf. Bilder, die die Forschung nicht an die App gesendet hat, stehen im Filter **Bild nur in der Forschung ·
  N** ([A3.8](#A3.8)).
- **Bedienung:** Editor der Quelle, Block **Ausschnitt des Eintrags**; **+ Fortsetzung von der nächsten Seite
  hinzufügen**; **Zuschneiden**, **Ersetzen**, **Ausschnitt entfernen**. „Ausschnitte: …“ in **Aktionen → Quellen**
  zeigt die Größe aller Ausschnitte ab 1 MB.
- **Gilt seit:** App 3.1.0; **Volle Qualität** 3.4.0; Bilder aus der Forschung 3.14.0 ([A3.8](#A3.8))

<!-- zdroj: app:src/types.ts:257 MAX_EXCERPTS_UI · src/excerpts.ts:12-14 EXCERPT_MAX_SIDE, EXCERPT_QUALITY · src/ui/sources.ts:853 renderExcerptBlock, :932 excerptAdderHtml, :999 addExcerptFromPaste, :1017 addExcerptFromUpload, :1047 recropExcerpt, :1099 addExcerptFromAttachment, :1121 putExcerptDraft, :1158 keepPagePersonId, :1165 excerptContextPages, :377 renderSourceViewer · src/ui/research-ui.ts:2263 excerptResearchUrl · strings.ts sources.excerpt*/viewer*/addExcerpt/excerptsTotal, crop.title/keepPage, research.fullQuality/fullQualityTitle, researchImages.filter -->

<a id="A3.4"></a>
## A3.4 Anhänge

Ein Anhang ist eine Datei bei einer Person: der Scan einer Seite, ein Dokument, das Foto einer Urkunde. Ein Anhang
belegt für sich nichts; der Beleg ist die Zitation einer Quelle ([A3.2](#A3.2)). Aus einem Bildanhang lässt sich ein
Ausschnitt des Eintrags ausschneiden ([A3.3](#A3.3)).

- JPG und PNG werden auf ein JPEG mit einer längeren Seite von höchstens 1600 px verkleinert. PDF bleibt, wie es
  ist, bis 2 MB. Andere Typen lehnt die App ab („Nicht unterstützter Dateityp. Erlaubt sind JPG, PNG oder PDF.“).
- Zu einem Anhang lässt sich eine **Notiz (optional)** schreiben. Ein PDF öffnet sich in einem neuen Tab.
- Unter den Anhängen steht eine Summe: „Bei dieser Person: Foto …, n Anhänge …, n Ausschnitte aus Quellen …“.
- **Grenzen:** bei einem mit der Forschung verbundenen Stammbaum, dessen Forschung Originale annimmt, lassen sich
  auch TIFF, HEIC und PDF über 2 MB hinzufügen. Im Stammbaum steht dann nur ein Eintrag ohne Vorschau („die Vorschau
  erstellt die Forschung“), und die Datei bekommt nur die Forschung. Läuft die Forschung nicht, nimmt die App eine
  solche Datei nicht an. Medien über 10 MB verlangsamen das Speichern; der **Stammbaum-Überblick** weist darauf hin.
- **Bedienung:** Bearbeiten der Person, Abschnitt **Anhänge** → **Anhang hinzufügen**; der Abschnitt ist mit
  **Erweiterte Felder** zu sehen oder wenn die Person Anhänge hat.
- **Gilt seit:** App 1.4.0; TIFF, HEIC und große PDF für die Forschung 3.9.0
- **Ab App 3.30.0:** Das ganze Foto, aus dem das Porträt der Person stammt, ist ein Anhang mit der Markierung
  **Porträt**. Er entsteht von selbst, wenn ein neues Foto für das Porträt gewählt wird. Ein anderer Bildanhang bietet
  **Als Porträt…** (in den Materialien und im Betrachter **Als Porträt verwenden…**). Das Löschen des Anhangs mit der
  Markierung Porträt lässt das Porträt bestehen ([A12.2](A12-portrait-and-couple-photo.md#A12.2)).
- **Ab App 3.30.0:** ein Anhang ist ein Material des Stammbaums ([A3.5](#A3.5)). Dieselbe Datei bei mehreren
  Personen ist eine Datei; ein zweites Mal hinzugefügt bietet sie **Auch hier verknüpfen** ([A3.5.4](#A3.5.4)). Der
  Papierkorb bei einem Anhang entfernt ihn nur von dieser Person, mit **Rückgängig**; die letzte Stelle fragt wie
  **Aus dem Stammbaum entfernen…** ([A3.5.6](#A3.5.6)). Auf einem breiteren Bildschirm sind die Aktionen eines
  Anhangs im Menü ⋯.

<!-- zdroj: app:src/attachments.ts:12-18 ATTACHMENT_MAX_SIDE, ATTACHMENT_QUALITY, MAX_PDF_BYTES, ATTACHMENT_WARN_BYTES · src/ui/attachments-ui.ts:28-31 ORIGINAL_ONLY_TYPES/needsOriginalOnly, :161 accept, :211 addAttachmentFile · strings.ts attachments.*, media.originalOnlyMeta/originalOnlyNeedsResearch, treeOverview.mediaWarning · 3.30.0: app:e6f0595d attachments-ui.ts štítek Portrét, asPortrait, danger.portraitSourceNote · 3.30.0 příloha jako materiál: app:2b66d7cf (verze dat 24), a275d977 (Soubor už ve stromu je), 13e4a70c src/ui/attachments-ui.ts removeAttachmentFromPerson, 30b0accd (akce v ⋯) -->

<a id="A3.4.1"></a>
### A3.4.1 Originale für die Forschung

Bei einem mit der Forschung verbundenen Stammbaum merkt sich die App bei jedem Bild und PDF den Fingerabdruck des
Originals, noch bevor sie die Datei verkleinert. Das Original in voller Qualität sendet sie an die Forschung; im
Stammbaum bleibt eine Vorschau. Die Forschung speichert es bei der Person, gegebenenfalls bei der Quelle und an der
Stelle des Ausschnitts.

- Stand beim Anhang: „Original wartet auf das Senden an die Forschung“, „Das Original ist in der Forschung“, „nur
  Vorschau“ mit Grund, „Das Original ist nicht mehr in der Forschung“.
- Läuft die Forschung nicht, warten die Originale in diesem Browser, höchstens 2 GB und höchstens 30 % des Platzes
  des Browsers. Sie sind nicht im Stammbaum, in Sicherungen oder im Export. Die App weist darauf hin, wenn sie 3 Tage
  warten oder wenn der Platz fast voll ist.
- **Volle Qualität** beim Anhang öffnet das Original direkt in der App, wenn die Forschung läuft und die Datei ein
  JPEG, PNG, WebP oder PDF bis 50 MB ist; sonst in der Forschung.
- Löschen eines Anhangs mit wartendem Original: das Original lässt sich verwerfen oder senden; die Forschung trennt
  es dann mit dem Vermerk „in der App entfernt“.
- **Grenzen:** nur auf dem Computer und nur bei einer Forschung, die Originale annimmt. Ein verschlüsselter
  Stammbaum lässt das Original nicht im Browser warten: er sendet es direkt an die laufende Forschung, sonst bleibt
  nur die Vorschau. Safari sendet keine Originale.
- **Bedienung:** **Forschung für diesen Stammbaum → Originaldateien senden** (ausgeschaltet nur Vorschauen);
  **Einstellungen → Daten und Datenschutz → Originale, die auf die Forschung warten** (nur wenn etwas wartet;
  einzeln und alle verwerfen). Das Senden ausführlicher in [S2](S2-edits-from-the-app.md).
- **Gilt seit:** App 3.9.0

<!-- zdroj: app:src/originals.ts:19-21 ORIGINALS_MAX_BYTES, ORIGINALS_QUOTA_SHARE, :60 originalsBudget · src/ui/originals-ui.ts:68 FULL_QUALITY_MAX_BYTES, :231 researchOriginalsLink, :241 prepareOriginal, :261 queueOriginal, :320 researchMediaAccepts, :358 fullQualityMode, :479 originalsQueueWarn · src/ui/research-tree-settings-ui.ts:232, :386 sendMedia · strings.ts media.*, mediaQueue.*, researchTree.originals/originalsDesc, research.fullQualityAppTitle -->

<a id="A3.5"></a>
## A3.5 Materialien

Material ist jede Datei des Stammbaums: ein Scan, ein Foto, ein Brief, eine Urkunde. Dieselbe Datei ist im Stammbaum
einmal, auch wenn sie bei mehreren Personen ist, und trägt ihre Stellen: Personen, eine Angabe oder ein Ereignis,
eine Partnerschaft, eine Quelle. Das Fenster **Materialien** hat jeder Stammbaum. Bei einem Stammbaum mit Forschung
oder Strom-Archiv zeigt es auch Dateien der Forschung, die im Stammbaum nirgends sind (**nur im Archiv**).

- Material des Stammbaums ist ein Anhang einer Person ([A3.4](#A3.4)), das ganze Foto eines Porträts und das Paarfoto
  ([A12](A12-portrait-and-couple-photo.md)), eine Datei bei einem Ereignis oder einer Partnerschaft und der Beleg
  einer Quelle ([A3.5.5](#A3.5.5)). Wo eine Datei gespeichert ist, beschreibt [S8](S8-where-the-data-are.md).
- Dateien lassen sich der Forschung auch senden, ohne sie dem Stammbaum hinzuzufügen: **Material senden…** bei einer
  Person und **Material zur Quelle senden…** (Betrachter und Editor der Quelle), höchstens 20 Dateien auf einmal, mit
  **Notiz für die Forschung**. Die Forschung macht aus ihnen eine Aufgabe für den Agenten
  ([R11.1](R11-material-from-the-user.md#R11.1)). **Auch als Anhang im Stammbaum hinzufügen** legt auch eine Vorschau
  in den Stammbaum. Einen ganzen Ordner sendet **Materialien hinzufügen…** im Menü der Forschung
  ([R11.4](R11-material-from-the-user.md#R11.4)) und im Kopf des Fensters **Materialien** ([A3.5.15](#A3.5.15)).
  Beim Strom-Archiv sind es **Material hinzufügen…** und **Auch im Stammbaum speichern** (Bilder und PDF bis 2 MB).
- Läuft die Forschung nicht, warten die gesendeten Dateien im Browser. Kennt die Forschung die Person noch nicht,
  werden sie nach dem nächsten Senden des Stammbaums gesendet.
- **Grenzen:**
  - Material lässt sich nur am Computer senden, bei einem mit der Forschung verbundenen Stammbaum, dessen Forschung
    Originale annimmt. Die Forschung nimmt nie Programme, Schlüssel, Archive oder Stammbaumdateien (GEDCOM) an;
  - Dateien der Forschung außerhalb des Stammbaums sind nur in der App am Computer zu sehen („Materialien aus der
    Forschung sind in der App am Computer zu sehen.“); auf dem Telefon zeigt das Fenster die Dateien des Stammbaums;
  - bei einem schreibgeschützten Stammbaum lassen sich die Dateien ansehen und herunterladen, nicht ändern;
  - eine Forschung älter als 1.35.0 kann Titel, Verknüpfungen, Verwendungen und Sortieren für Dateien außerhalb des
    Stammbaums nicht; die App sagt es bei der Aktion („… kann eine neuere Version der Forschung“).
- **Bedienung:** Stammbaum ohne Forschung: **Aktionen › Materialien** (mit der Zahl der Dateien); Stammbaum mit
  Forschung: **Materialien** im Menü der Forschung. Bei einer Person: **Alle Materialien der Person (N) ›** unter den
  Anhängen und **Materialien** im Menü der Person (das Fenster mit Filter auf die Person).
- **Gilt seit:** App 3.9.0; Abschnitt und Fenster **Materialien** 3.16.0; 3.30.0: das Fenster bei jedem Stammbaum,
  eine Datei des Stammbaums als ein Material mit seinen Stellen (Datenversion 24)
- **Ab App 3.31.0 mit Forschung 1.36.0:** die Forschung geht die Dateien nur dann selbst durch, wenn die Einstellung
  **An die Forschung gesendete Dateien geht der Agent selbst durch** eingeschaltet ist
  ([S4.4.11](S4-research-from-the-app.md#S4.4.11), [R11.6](R11-material-from-the-user.md#R11.6)). Ausgeschaltet
  (Standard):
  - **Material senden…** sagt „Dem Stammbaum wird nichts hinzugefügt. Die Forschung speichert die Dateien bei der
    Person. Unter Materialien warten sie; der Agent geht sie nur auf Anfrage durch.“ (bei einer Quelle „… bei der
    Quelle.“). Nach dem Senden die Meldung „An die Forschung gesendet: 1 Datei zu Jan Horák, unsortiert unter
    Materialien.“ mit **Mit dem Agenten sortieren…** (am Computer mit dem Fenster **Materialien**,
    [A3.5.8](#A3.5.8)) und **Anzeigen**;
  - die Bestätigung eines Stapels **Materialien hinzufügen…** hat keine Blöcke **Datenschutz** und **Geschätzte
    Kosten**, nur „Die Dateien werden in der Forschung gespeichert, außerhalb von Git, und warten unsortiert unter
    Materialien. Der Agent sortiert sie nur auf Anfrage; die Kosten werden vorher angezeigt.“;
  - das Ende des Stapels sagt „Die Dateien warten unsortiert unter Materialien. Der Agent sortiert sie nur auf
    Anfrage.“ und bietet **Mit dem Agenten sortieren…** für die Dateien des Stapels an; geht das nicht sofort,
    verweist es auf **Mit dem Agenten sortieren…** unter Materialien. Eingeschaltet: „Die Forschung sortiert den
    Stapel selbst. …“ mit der Zahl **Sortieraufgaben**;
  - eine Datei, die der Agent noch nicht durchgegangen ist, hat unter Materialien den Stand **unsortiert**
    (eingeschaltet: **wartet auf Verarbeitung**).

  Mit einer älteren Forschung gelten die bisherigen Texte.

<!-- zdroj: dirigent:spec/102-sprava-materialu-a-pramenu · app:2b66d7cf src/types.ts STROM_DATA_VERSION 24, Attachment.places (MediaPlace), migrace v23→v24 (stejný soubor u více osob jeden záznam) · src/media.ts allMedia, treeMedia · app:1ebf7896 src/ui/materials-ui.ts materialsWindowOn, materialsListOn · src/ui/tree-management.ts (Akce › Materiály) · src/ui/research-actions-ui.ts:373 · src/ui/attachments-ui.ts attachments-all-materials · app:a275d977 menu osoby Materiály · src/ui/material-ui.ts MATERIAL_MAX_FILES, MATERIAL_NOTE_MAX, REFUSED_EXT, materialAvailable · strings.ts material.*, materials.desktopOnlyResearch, treeReadOnly, olderEdit, assignNewer, agentSort.older · app:CHANGELOG.cs.md 3.30.0 -->

<a id="A3.5.1"></a>
### A3.5.1 Das Fenster Materialien

Das Fenster zeigt jede Datei einmal: die Dateien des Stammbaums mit allen Personen, bei denen sie sind, und neben
einem Archiv auch die Dateien der Forschung.

- **Gruppieren:** **Nach Datum des Hinzufügens** (mit den Personen, bei denen die Datei hinzukam) oder **Nach
  Person**; eine Datei nur bei einer Quelle oder Partnerschaft steht unter **Ohne Person**. Neben einem Archiv
  zusätzlich **Stapel** und **Nach Eingangsdatum**.
- **Ansicht** **Raster** oder **Liste**. Die Liste hat die Spalten **Titel**, **Art**, **Datum**, **Personen**,
  **Quelle**, **Im Stammbaum** und **Verwendet**; sortiert wird mit einem Klick auf die Kopfzeile. Eine Kachel zeigt,
  an wie vielen Stellen die Datei verwendet ist.
- **In Titel, Name und Notiz suchen**; **Filter** nach Person, Art und Stapel. Ausgeblendete Dateien der Forschung
  zeigt **Ausgeblendete zeigen**.
- ⓘ am Fenstertitel (**Wo die Dateien liegen**) sagt, wo die Dateien sind: „Die Dateien liegen nur in diesem
  Browser. Sicherung: Alles exportieren.“, oder in der Forschung bzw. im Strom-Archiv auf diesem Computer mit
  verkleinerten Kopien in der App; bei einem verschlüsselten Stammbaum auch, dass die Forschung auf der Festplatte
  nicht verschlüsselt ist.
- Eine Person ohne Namen oder als „?“ erfasst ist **Unbekannte Person** (mit den Jahren, wenn sie welche hat).
- **Grenzen:** auf dem Telefon ist das Fenster nicht im Menü **Mehr**; es öffnet sich von einer Person aus. Läuft die
  Forschung nicht, zeigt das Fenster den Stand aus der Zeit, als sie lief, und sagt, was sich bearbeiten lässt: Titel
  und Verknüpfungen der Dateien des Stammbaums werden mit dem Stammbaum geschrieben, Material außerhalb des
  Stammbaums erst bei laufender Forschung.
- **Sortieren ▾** in der Leiste des Fensters sortiert Raster und Liste gleich, innerhalb der Gruppen:
  **Standardreihenfolge** oder eine Spalte (**Titel**, **Art**, **Datum**, **Personen**, **Quelle**, bei einem Archiv
  **Im Stammbaum**, **Verwendet**) und **Aufsteigend** / **Absteigend**. Ein Klick auf eine Kopfzeile der Liste ändert
  dieselbe Sortierung. Die Sortierung wird auf diesem Gerät gemerkt. Auf dem Tablet und in einem Fenster bis 1024 px
  ist sie in **Filter**.
- **Bedienung:** siehe [A3.5](#A3.5); Dateien auswählen: **Auswählen**, Strg/Cmd+A wählt aus, was die Filter zeigen.
- **Gilt seit:** App 3.30.0
- **Ab App 3.31.0:** auf dem Telefon öffnet sich das Fenster auch aus **Mehr → Für die Familie**: die erste Zeile
  **Materialien** mit der Zahl der Dateien. Auf dem Tablet bleibt **Materialien** in der ersten Ebene von **Mehr**.

<!-- zdroj: app:c9775287 src/materials-overview.ts chooseSort, sortOverviewGroups (uvnitř skupin), src/ui/materials-window.ts mwSortChipHtml, mwSortMenu, mwSortColumns (intree jen model archive), mwSetSort → writeListPrefs (localStorage), filtry ≤ 1024 · strings.ts materials.sortBy, sortChip, sortDefault, sortAscending, sortDescending · app:1ebf7896 src/ui/materials-ui.ts, src/ui/materials-window.ts (skupiny, Kde soubory jsou) · app:a1127378 sloupce seznamu, Ctrl/Cmd+A · app:b198b1c2 src/media-uses.ts materialPersonLabel (Neznámá osoba) · app:e6e16634 staleEdit · app:prace/1117-app-102-materialy D1 (telefon: bez řádku Materiály ve Více) · strings.ts materials.groupAdded, groupPerson, groupBatch, groupDate, whereTitle, whereApp, whereArchiveResearch, whereEncryptedResearch, search, showHidden, unknownPerson, staleEdit · 3.31.0: app:122a5096 src/ui/bottom-sheet.ts materialsRow (s počtem materialsAppCount) jako první řádek stránky menu.forFamily jen isPhoneBar, jinak v první úrovni · strings.ts materials.menu, menu.forFamily · dirigent:prace/1122-app-mobil-drobnosti -->

<a id="A3.5.2"></a>
### A3.5.2 Titel, Art und Datum

Eine Datei kann einen **Titel**, eine **Art** (**Foto**, **Dokument**, **Urkunde**, **Sonstiges**) und ein **Datum**
haben. Der Titel erscheint statt des Dateinamens; ein leerer Titel bedeutet den Dateinamen.

- Das Datum ist ein Jahr, ein Datum oder ein Zeitraum („etwa 1920“); was sich nicht lesen lässt, speichert die App
  nicht („Das Datum lässt sich nicht lesen.“).
- Die Seite der Person, das Familienbuch und die gespeicherte Seite beschreiben eine Datei mit dem ganzen Titel, der
  Art und dem Jahr des Datums.
- Das Bearbeiten einer Datei des Stammbaums ist ein Schritt **Rückgängig**; eine Datei außerhalb des Stammbaums wird
  in der Forschung bearbeitet, mit Meldung und **Rückgängig**.
- GEDCOM trägt den Titel als `TITL` (den Dateinamen als `_STROM_NAME`) und die Art als `TYPE` unter `FORM`
  ([A2](A2-loading-a-family-tree.md)).
- **Grenzen:** eine Datei außerhalb des Stammbaums lässt sich nur mit laufender Forschung 1.35.0 oder neuer
  bearbeiten („Den Titel von Material, das nicht im Stammbaum ist, kann eine neuere Version der Forschung.“).
- **Bedienung:** Dateibetrachter: der Stift, **Titel hinzufügen** oder F2 (Enter speichert, Esc bricht ab); der
  Dialog **Anhang** (**Titel und Angaben…**: Titel, Art, Datum, Notiz).
- **Gilt seit:** App 3.30.0; eine Datei außerhalb des Stammbaums mit der Forschung 1.35.0

<!-- zdroj: app:30b0accd src/ui/material-viewer-ui.ts, src/ui/material-details-ui.ts (titulek, druh, datum, F2) · app:6d8fba0e DataManager (titulek vedle názvu) · app:dfb50772 src/ged-exporter.ts TITL, _STROM_NAME, TYPE pod FORM · strings.ts materials.kind, titleHint, datePh, dateInvalid, olderEdit, attachmentDialog, titleAndData, addTitle · research:a7df632d POST /material/edit -->

<a id="A3.5.3"></a>
### A3.5.3 Wo verwendet

Jede Datei zeigt, wo sie verwendet ist: Personen, Porträt, Partnerschaft, Ereignisse, Quellen und Ausschnitte, in
dieser Reihenfolge. Jede Zeile ist ein Link auf die Person oder die Quelle.

- Der Beleg einer Quelle sagt auch, wo die Quelle zitiert ist („Beleg · zitiert bei Geburt“).
- Über fünf Stellen erscheinen vier und „+ N weitere“.
- × an einer Stelle (**Verknüpfung lösen:**) entfernt die Datei nur von dieser Stelle, mit Meldung und
  **Rückgängig**. Die letzte Stelle einer Datei, die sonst nichts hält, fragt zuerst ([A3.5.6](#A3.5.6)).
- Neben einem Archiv gibt es zwei Teile: **Im Stammbaum** und **Im Archiv**, mit den im Archiv zugeordneten Personen
  und damit, wofür die Forschung die Datei verwendet hat (Ausschnitte, Quellen der Forschung, offene Aufgaben).
- Eine Datei, die die Datei einer Quelle der Forschung ist, hat oben **Datei einer Quelle**: die Quellen, wie die
  Datei zu ihnen gehört, wer sie zitiert, und „Die Datei ist in der Forschung; im Baum ist sie über eine Quelle.“
  ([A3.5.14](#A3.5.14)).
- **Grenzen:** ein schreibgeschützter Stammbaum zeigt die Stellen ohne ×. Die Verwendung im Archiv zeigt nur die
  Forschung 1.35.0 und neuer; läuft die Forschung nicht, gilt der Stand, den die App zuletzt kannte.
- **Bedienung:** Dateibetrachter (Seitenleiste, auf dem Telefon ein hochgezogenes Blatt); der Dialog **Anhang**.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:4bf66048 src/ui/material-uses-ui.ts (prameny první, usesSourceOf, keptViaSource) · app:1ccc666c src/media-uses.ts (pořadí person, portrait, couple, event, source, excerpt) · src/ui/material-uses-ui.ts COLLAPSE_OVER=5, COLLAPSED_ROWS=4 · app:55d66efd sourceCitedAt · strings.ts materials.used, usedInTree, usedInArchive, usedType, docCitedAt, moreN, unlink, usesArchive, usesOlder, usesStale · research:a7df632d GET /material/<I…>/uses -->

<a id="A3.5.4"></a>
### A3.5.4 Verknüpfen mit…

**Verknüpfen mit…** legt eine Datei zu Personen, zu einem Ereignis, zu einer Partnerschaft oder zu einer Quelle, in
einem Schritt **Rückgängig**.

- Bei einer Quelle ist die Datei ihr Beleg; bei einer Partnerschaft ein Anhang der Partnerschaft. Das Paarfoto wird
  bei der Partnerschaft geändert ([A12.4](A12-portrait-and-couple-photo.md#A12.4)).
- Ein Material nur im Archiv wird mit seiner verkleinerten Kopie aus der Forschung verknüpft: dann ist es auch im
  Stammbaum, im Export, im Buch und auf dem Telefon.
- Dieselbe Datei ein zweites Mal hinzugefügt: **Die Datei ist schon im Stammbaum** bietet **Auch hier verknüpfen**,
  **Als neue Datei hinzufügen** oder Abbrechen. Neben einem Archiv wird ohne Nachfrage verknüpft.
- Das Löschen einer Person oder einer Quelle sagt, welche Dateien bleiben und welche verschwinden.
- **Grenzen:** höchstens 50 Personen auf einmal. Ein Material nur im Archiv lässt sich nur bei laufender Forschung
  verknüpfen. Eine Person, die die Forschung noch nicht kennt, bekommt die Forschung mit dem nächsten Schreiben des
  Stammbaums.
- **Bedienung:** Dateibetrachter (**Verknüpfen mit…** oder P; die Pfeile wechseln das Ziel, Enter verknüpft); eine
  Auswahl im Fenster **Materialien**.
- **Gilt seit:** App 3.30.0
- **Ab App 3.31.0:** eine Person, der alle gewählten Dateien schon gehören (durch eine Stelle im Stammbaum oder eine
  Zuordnung in der Forschung), steht über der Liste als Chip mit der Markierung „bereits verknüpft“, ohne ×, und ist
  in der Liste angehakt und nicht änderbar. „Noch niemand“ erscheint daneben nicht.

<!-- zdroj: app:a275d977 src/ui/material-attach-ui.ts openAttachDialog, MAX_PEOPLE=50, materialKeptByArchive, dup dialog · strings.ts materials.attach, attachTarget, coupleNote, archiveOnlyResearch, dupTitle, dupAttach, dupNew, dupLinkedToast, assignMax, noRefnTreeResearch · 3.31.0: app:9eee6b2c src/ui/material-attach-ui.ts attachFixedPeople (místo ve stromu nebo REFN ve výzkumu, u všech souborů), src/person-picker.ts fixedChips · strings.ts materials.attachAlready, noneChosen · dirigent:prace/1122-app-portret-dev -->

<a id="A3.5.5"></a>
### A3.5.5 Quelle aus einer Datei und Beleg einer Quelle

Eine Quelle kann einen **Beleg** haben: die Datei, aus der sie stammt. Der Beleg ist eine Stelle der Datei bei der
Quelle; die Datei wird nicht noch einmal eingefügt.

- **Quelle aus dieser Datei anlegen…** öffnet den Editor der Quelle, ausgefüllt aus der Datei: der Name aus dem
  Titel, das Datum des Eintrags aus dem Datum, die Datei als Beleg und **Zitieren bei** mit der Person, von der die
  Datei ist, und mit dem Ereignis, dessen Jahr passt. Das Speichern ist ein Schritt **Rückgängig**: Quelle, Beleg und
  Zitat.
- Eine neue Quelle bei einer Person bietet **Beleg aus den Materialien der Person**: die Dateien der Person **Ohne
  Quelle** und **Bei einer anderen Quelle**, über 12 Dateien mit Suche (**In Titel und Name suchen**).
- Der Quellenbetrachter zeigt **Stammt aus**: die Belege mit × und **Beleg verknüpfen…**. Ein Ausschnitt verweist auf
  die Datei, aus der er geschnitten wurde („Ausschnitt aus … ›“).
- GEDCOM trägt den Beleg als `OBJE` bei der Quelle; eine Datei an mehreren Stellen ist ein Eintrag `OBJE`
  ([A2](A2-loading-a-family-tree.md)).
- **Grenzen:** ein Material nur im Archiv wird mit seiner verkleinerten Kopie nur bei laufender Forschung zum Beleg.
  Die App speichert eine Datei nie zweimal.
- **Bedienung:** Dateibetrachter, ⋯ bei einem Anhang, der Dialog **Anhang** und in **Verknüpfen mit…** bei einer
  Quelle **Neue Quelle aus dieser Datei…**; der Editor der Quelle, Feld **Beleg**.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:0c532b5a src/ui/source-docs-ui.ts (hlavička §5–§7: Vytvořit pramen, Doklad z materiálů osoby, Z čeho je), OFFER_SEARCH_OVER=12 · app:55d66efd · strings.ts sources.docLabel, docHint, attachDoc, citeAtLabel, offerTitle, offerNoSource, offerOther, offerSearch, viewerFrom, excerptFrom · materials.makeSource, newSourceFromFile · app:dfb50772 src/ged-exporter.ts objeOf (OBJE u SOUR, _SOUR u osoby), recordOf (soubor na více místech = záznam OBJE @M…@) -->

<a id="A3.5.6"></a>
### A3.5.6 Aus dem Stammbaum entfernen und Wiederherstellen

**Aus dem Stammbaum entfernen…** entfernt eine Datei von allen Stellen im Stammbaum. Was mit der Datei geschieht,
hängt davon ab, ob ein Archiv sie hält.

- Der Dialog sagt zuerst, was auf die Datei verweist: der Beleg einer Quelle („Die Quelle bleibt ohne Beleg.“), ein
  Ausschnitt („Der Ausschnitt bleibt.“), ein Porträt („Das Porträt bleibt, der Ausschnitt lässt sich nicht mehr
  ändern.“).
- **Ohne Archiv:** **Datei aus dem Stammbaum löschen?** löscht die Datei. „Die Datei ist nirgends sonst gespeichert.
  Nur Rückgängig oder eine Sicherung (Alles exportieren) holt sie zurück.“
- **Mit Archiv** (die Datei ist in der Forschung oder im Strom-Archiv): die Datei bleibt im Archiv, ausgeblendet mit
  dem Grund **Aus dem Stammbaum entfernt**; ein freiwilliger Grund ist **Betrifft nicht die Familie** oder
  **Duplikat**. In **Ausgeblendete zeigen** holt **Wiederherstellen** sie mitsamt Verknüpfungen zurück, an die
  Stellen, die im Stammbaum noch da sind.
- Mehrere Dateien aus einer Auswahl sind ein Schritt **Rückgängig**. **Person entfernen…** entfernt die gewählte
  Person von den ausgewählten Dateien; eine Datei ohne andere Stelle wird vorher angekündigt.
- Der Papierkorb bei einem Anhang einer Person entfernt die Datei nur von dieser Person, mit Meldung und
  **Rückgängig**; die letzte Stelle fragt wie **Aus dem Stammbaum entfernen…**.
- **Grenzen:** die Datei bleibt nur im Archiv, wenn das Archiv sie hat: ab der Forschung 1.35.0 jede Datei des
  Stammbaums nach einem Schreiben, bei älterer Forschung nur ein gesendetes Original. Das Archiv übernimmt das
  Entfernen mit dem Schreiben des Stammbaums ([R11.5.1](R11-material-from-the-user.md#R11.5.1)).
- **Bedienung:** Dateibetrachter; eine Auswahl im Fenster **Materialien** → ⋯.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:a275d977, c2ae8441 src/ui/material-attach-ui.ts openRemoveFromTreeDialog (rmRefs, materialKeptByArchive = caps.list && item.file) · src/data.ts removeMedia (keep → removed + places), removeMediaMany, restoreMedia (jen místa, která ve stromu jsou) · app:13e4a70c src/ui/attachments-ui.ts removeAttachmentFromPerson · strings.ts materials.removeFromTree, rmRefDoc, rmKeepDoc, rmKeepExcerpt, rmKeepPortrait, rmArchiveResearch, rmAppTitle, rmApp, reason, restore, selRemovePerson, selRemovePersonLast · research:91ab6230, a7df632d -->

<a id="A3.5.7"></a>
### A3.5.7 Durchgehen und Sammeländerungen

Das Fenster **Materialien** geht viele Dateien auf einmal durch: die Filter zeigen, was fehlt, und eine Auswahl
ändert alle ausgewählten Dateien zusammen.

- Filter mit Zahlen: **Ohne Titel**, **Ohne Quelle**, neben einem Archiv **Im Stammbaum** und **Nur im Archiv**.
- **Durchgehen (N)** öffnet den Betrachter mit den Feldern der ersten Datei: Enter oder → speichert und geht zur
  nächsten, ← zurück, **Überspringen**, Esc beendet; P verknüpft, S legt eine Quelle an. Auf dem Telefon werden die
  Dateien durch Wischen gewechselt.
- Eine Auswahl: **Durchgehen**, **Verknüpfen mit…**, **Titel…**, **Art…**, **Datum…**; unter ⋯ **Aus dem Stammbaum
  entfernen…**, **Person entfernen…** und neben einem Archiv **Einer Person zuordnen…** und **Ausblenden…**.
- **Titel…** kann **Nummer nach Reihenfolge im Stapel anhängen**, mit Vorschau. **Art…** und **Datum…** lassen
  Dateien, die schon einen Wert haben, aus, wenn das Ersetzen nicht angehakt ist.
- **Grenzen:** die Dateien des Stammbaums ändern sich in einem Schritt **Rückgängig**. Dateien der Forschung in
  Stapeln zu 500, über 500 mit Fortschritt und Abbrechen; abgelehnte Dateien nennt die Meldung.
- **Bedienung:** Fenster **Materialien** → **Auswählen** oder ein Filter.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:a1127378 src/ui/materials-window.ts (filtry, výběr, Projít), src/ui/material-bulk-ui.ts BULK_CHUNK=500 · app:13e4a70c (tažení na telefonu) · strings.ts materials.fNoTitle, fNoSource, fInTree, fOnlyArchive, review, setTitle, setKind, setDate, titleNumber, titleOverwrite, bulkProgress, bulkRejected, reviewSwipe -->

<a id="A3.5.8"></a>
### A3.5.8 Mit dem Agenten sortieren

**Mit dem Agenten sortieren…** sendet Dateien der Forschung an den Agenten. Der Agent schlägt zu jeder Titel, Datum,
Art und Verknüpfungen (Personen, Ereignis, Quelle) mit kurzer Begründung vor. Nichts wird geschrieben, bevor der
Vorschlag angenommen ist.

- Der Dialog zeigt die Dateien und das Feld **Was über die Dateien bekannt ist** (freiwillig, eigene Worte als
  Anhaltspunkt). Er sagt, dass das, was der Agent öffnet, an den Modellanbieter geht und dass das Sortieren das Abo
  oder Guthaben nutzt. Die Dateien sendet nur die Schaltfläche **Mit dem Agenten sortieren** im Dialog, einmal.
- Das Fenster lässt sich schließen; der Fortschritt und der fertige Vorschlag sind im Band des Fensters
  **Materialien**.
  - **Ab App 3.30.0:** das Band zeigt „Warten auf den Agenten…“, dann „Der Agent sortiert · k von n“ mit einer
    Anzeige, wie viele Dateien der Agent schon beurteilt hat. Eine Forschung, die die Zahl der beurteilten nicht
    nennt, hat „Der Agent sortiert · N Dateien“ mit einem Balken ohne Zahl; bei reduzierter Bewegung im System steht
    dieser Balken still. Darunter „Das Fenster lässt sich schließen, der Vorschlag wartet in den Materialien.“
- **Vorschlag des Agenten** hat **Vorschläge**, **Nicht zugeordnet** und **Erledigt** und bei jeder Datei
  **Annehmen**, **Bearbeiten**, **Ablehnen**; außerdem **Ausgewählte annehmen** und **Alle annehmen**. Die Sicherheit
  eines Vorschlags: sicher, wahrscheinlich, unsicher.
  - **Ab App 3.30.0:** unter **Nicht zugeordnet** steht bei einer Datei ohne Vorschlag in einer leisen Zeile, warum
    sie keinen hat: „Der Leser sagte nichts zur Datei“, „Die Datei hat schon alles Vorgeschlagene“, „Der Vorschlag
    ließ sich nicht verwenden“, „Der Agent hat die Datei ausgelassen“ oder „Die Datei ließ sich nicht lesen“. Was der
    Leser zur Datei schrieb, steht darunter in einer Zeile, ganz beim Überfahren. Eine Forschung, die den Grund nicht
    nennt, oder ein Grund, den die App nicht kennt: eine Zeile ohne Grund wie bisher.
  - **Ab App 3.30.0:** eine Datei, von der der Agent sagt, dass sie nicht die Familie betrifft, steht unter
    **Nicht zugeordnet** zuerst, markiert mit **Betrifft nicht die Familie** ([A3.5.9](#A3.5.9)).
  - Textdateien (.txt, .md) liest der Agent nach ihrem Inhalt, nicht als Bild
    ([R11.5.3](R11-material-from-the-user.md#R11.5.3)).
- Titel, Datum und Art von einem Menschen bleiben; der Vorschlag des Agenten wird nur verwendet, wenn **Vorschlag
  übernehmen** gewählt wird.
- Angenommenes wird geschrieben: die Dateien des Stammbaums in einem Schritt **Rückgängig** mit dem Stammbaum,
  Material außerhalb des Stammbaums ins Archiv. Eine Quelle der Forschung, die der Stammbaum noch nicht hat, kommt mit
  der Nummer der Forschung in den Stammbaum, und das Schreiben verdoppelt sie nicht. Ein angenommener Vorschlag lässt
  sich in seiner Zeile mit **Rückgängig** zurücknehmen.
- **Was geschickt wird:** aus einem Stapel und aus allen nicht eingeordneten nur Dateien ohne eigenen Titel oder ohne
  Person, ohne Kopien, Dateien einer Quelle, Dateien, die der Agent zuletzt nicht zugeordnet hat, und Text- und
  Datendateien; von Hand ausgewählte Dateien gehen alle ([A3.5.11](#A3.5.11)).
- Das Band des Sortierens gibt es einmal über dem ganzen Archiv ([A3.5.10](#A3.5.10)); ein Stapel wird aus seinem ⋯
  sortiert.
- **Grenzen:**
  - nur bei der Forschung 1.35.0 und neuer, die einen Agenten hat, und nur bei laufender Forschung; beim
    Strom-Archiv und bei einer Forschung, die auf einen Agenten wartet, gibt es das Angebot gar nicht;
  - höchstens 30 Stapel zu 50 Dateien als ein Lauf ([A3.5.12](#A3.5.12)), bei einer Forschung ohne Läufe 50
    Dateien; 2000 Zeichen Text;
  - die Forschung kann das Sortieren ablehnen: das Leselimit ist aufgebraucht, zu viele Sortierungen warten, der
    Agent kann gerade nicht arbeiten. Wie die Forschung sortiert, beschreibt
    [R11.5.3](R11-material-from-the-user.md#R11.5.3);
  - nur in der App am Computer.
- **Bedienung:** Fenster **Materialien**: eine Auswahl, das Band des Sortierens, ⋯ eines Stapels; das Ende eines
  Stapels aus der App.
- **Gilt seit:** App 3.30.0, Forschung 1.35.0

<!-- zdroj: app:9752aead (jeden pruh nad archivem, pruhy dávek a nabídka nad vším pryč, dávka z ⋯), 2fbab382 src/material-sort.ts sortNext, 1047b9d6 (běh do 1 500 souborů, bez material.sortRun jedna dávka) · app:1affd46e, d5b6ef8e src/ui/material-sort-ui.ts (odeslání jen klikem v dialogu), src/materials.ts SORT_MAX_FILES=50, SORT_MAX_TEXT=2000 · src/ui/materials-window.ts materialSortGate (sel-sort) · src/ui/batch-ui.ts doneSort · app:2a6dd268 pramen z výzkumu s REFN S… · strings.ts materials.agentSort.* (will, keep, privacy, cost, tooMany, errLimit, errQueue, errNotReady, offRun, phone, write, useProposal, undoRow) · research:87376d11 POST /material/sort, cc709045 material.sort jen s agentem · app:32f1e29f src/ui/material-sort-ui.ts (counted jen s job.filesDone: run k z n, progressbar aria-valuenow; jinak runFiles, is-indeterminate; runNote), strings.ts agentSort.queued, run, runFiles, runNote · app:30688d6b src/materials.ts parseSortUnproposed, material-sort-ui.ts (unassigned && !p → unproposed[why], said na jednom řádku s title), strings.ts agentSort.unproposed.* · research:ae866bb7 filesDone, unproposed, čtení textu · app:8a8131be src/material-sort.ts sortNeedy, sortWholeOffered (narrowed, remembered, jedna dávka se stejným počtem), materials-window.ts sortWholeClosed, strings.ts agentSort.stripWhole, closeWhole · app:a947b426 sortCandidates (dávka, filtr, celé okno: jen bez titulku nebo osoby; výběr vše) -->

<a id="A3.5.9"></a>
### A3.5.9 Betrifft nicht die Familie

Sagt der Agent beim Sortieren ([A3.5.8](#A3.5.8)), dass eine Datei offensichtlich nicht die Familie betrifft (ein
Bildschirmfoto, eine Quittung, ein Urlaubsfoto fremder Leute, eine versehentlich geschickte Datei), ist die Datei im
**Vorschlag des Agenten** unter **Nicht zugeordnet** mit **Betrifft nicht die Familie** markiert. Ausblenden kann
sie nur ein Mensch; weder die App noch die Forschung blendet sie von selbst aus oder löscht sie.

- Eine solche Datei hat keinen vorgeschlagenen Titel, kein Datum, keine Art und keine Verknüpfungen. Ihre Zeile zeigt
  die Sicherheit (sicher, wahrscheinlich, unsicher: wie sicher es ist, dass die Datei nicht zur Familie gehört) und
  „Warum nicht: …“ mit dem, was der Agent auf der Datei sah.
- Der Agent markiert so nur eine Datei offensichtlich außerhalb der Familie; eine Datei, die er nur nicht zuordnen
  kann, bleibt ohne Markierung unter **Nicht zugeordnet** ([R11.5.3](R11-material-from-the-user.md#R11.5.3)).
- Diese Dateien stehen unter **Nicht zugeordnet** zuerst. Darüber steht **Als „Betrifft nicht die Familie“
  ausblenden (N)**, bei jeder **Ausblenden…**. Beides öffnet den Dialog **Datei ausblenden?** mit dem vorgewählten
  Grund **Betrifft nicht die Familie** (änderbar auf **Duplikat** oder **Ohne Grund**); erst die Schaltfläche
  **Ausblenden** blendet die Datei aus. Die Meldung hat **Rückgängig**. Nach dem Dialog, auch einem abgebrochenen,
  kehrt der Vorschlag des Agenten zu **Nicht zugeordnet** zurück.
- Eine ausgeblendete Datei zeigt in ihrer Zeile „Ausgeblendet · betrifft nicht die Familie“ und
  **Wiederherstellen**. Sie bleibt mit ihrem Original in der Forschung und ist in **Ausgeblendete zeigen** zu sehen
  ([A3.5.1](#A3.5.1)). **Von Hand durchgehen (N)** lässt ausgeblendete Dateien aus.
- **Grenzen:**
  - ausblenden lässt sich nur eine Datei der Forschung außerhalb des Stammbaums, die noch nicht ausgeblendet ist.
    Eine Datei im Stammbaum hat die Markierung ohne **Ausblenden…**; aus dem Stammbaum nimmt sie **Aus dem
    Stammbaum entfernen…** ([A3.5.6](#A3.5.6));
  - **Ausblenden…** und **Wiederherstellen** wirken nur bei laufender Forschung; sonst sind sie deaktiviert;
  - eine Forschung, die die Markierung nicht sendet, lässt **Nicht zugeordnet** wie bisher.
- **Bedienung:** Fenster **Materialien** → Band des Vorschlags → **Vorschlag des Agenten** → **Nicht zugeordnet**;
  Terminal: `strom material show <id>`, Ausblenden `strom input hide I… --why unrelated`
  ([R11.5.2](R11-material-from-the-user.md#R11.5.2)).
- **Gilt seit:** App 3.30.0, Forschung 1.35.0

<!-- zdroj: app:f2bebc4c (v 401eaca4) src/materials.ts SortProposal.unrelated, parseSortProposal · src/material-sort.ts sortRows (unrelated: bez polí a vazeb), sortUnrelatedHideable (origin ≠ tree, file, !hidden, bez places) · src/ui/material-sort-ui.ts (Nepřiřazeno: unrelated první, msp-flag reason.unrelated, conf, unassignedWhy + why; hideUnrelated, hide, restore, hiddenLabel; hideCan: caps.assign, jinak null; bridgeUp && base, jinak vypnuto; reopen na tab unassigned; Projít ručně bez skrytých) · src/ui/material-actions-ui.ts openHideDialog (důvod unrelated předvybraný, ctx.back) · strings.ts materials.agentSort.hideUnrelated, unassignedWhy, reviewByHand, materials.hide, hideTitle, reasonLabel, reason, hideConfirm, hiddenLabel, hiddenToastResearch, restore · research:f36b3941 (ve vydání 1.35.0) src/core/sort.ts unrelated -->

<a id="A3.5.10"></a>
### A3.5.10 Das Band des Sortierens und das Ende des Vorschlags

Das Fenster **Materialien** hat ein Band des Sortierens über dem ganzen Archiv. Es zeigt den Stand aller Dateien der
Forschung, auch wenn ein Filter nur einen Teil zeigt; unter den Stapeln gibt es keine Bänder.

- **Zustände des Bands:**
  - nicht eingeordnete Dateien: „N Dateien ohne Titel oder Person“ mit **Mit dem Agenten sortieren…**, **Von Hand
    durchgehen** und ×;
  - der Agent sortiert: der Fortschritt ([A3.5.8](#A3.5.8), [A3.5.12](#A3.5.12)) mit **Abbrechen**; warten schon
    Vorschläge, auch **Vorschlag bearbeiten (N)**;
  - ein Vorschlag wartet: „Vorschlag des Agenten: N zu bearbeiten“ mit **Vorschlag bearbeiten (N)** und **Vorschlag
    schließen…**;
  - nach dem Vorschlag: „Fertig: a bearbeitet · u nicht zugeordnet · N nicht eingeordnet übrig“ mit **Weitere
    sortieren (N)…**, **Von Hand durchgehen** (die Dateien, die der Agent nicht zugeordnet hat) und ×;
  - nichts übrig: „Alle Dateien haben Titel und Person.“
- × blendet das Band aus, bis sich sein Zustand ändert. Ein Stapel, der bei offenem Fenster hinzukommt, meldet sich
  im Band mit „N Dateien hinzugefügt · M ohne Titel oder Person“ ([A3.5.15](#A3.5.15)).
- **Das Ende des Vorschlags:** ist alles bearbeitet, sagt das Fenster **Vorschlag des Agenten** „Fertig · a
  angenommen · r abgelehnt · u nicht zugeordnet“ (bei einem Lauf auch „Für den ganzen Lauf: …“) und darunter:
  - „Im Archiv bleiben N nicht eingeordnete Dateien“ mit **Weitere sortieren (N)…**: der Vorschlag wird geschlossen
    und der Dialog **Mit dem Agenten sortieren** öffnet sich; sonst „Im Archiv ist nichts weiter zu sortieren.“;
  - Kopien mit gleichem Inhalt, die nicht gesendet wurden: **Als Duplikat ausblenden (N)…**;
  - „N Dateien hat der Agent nicht zugeordnet“: sie bleiben ohne Titel und Person, tragen das Etikett **Vom
    Agenten nicht zugeordnet** und gehen beim nächsten Mal nicht an den Agenten ([A3.5.14](#A3.5.14)).
- Ein Vorschlag, in dem nichts wartet, wird mit dem Schließen des Fensters geschlossen. **Vorschlag schließen…**
  fragt **Vorschlag schließen?**: offene Vorschläge werden nicht geschrieben und die Dateien bleiben nicht
  eingeordnet; Angenommenes bleibt angenommen.
- **Grenzen:**
  - auf dem Telefon zeigt das Band nur den Stand; der Vorschlag ist in der App am Computer. Ein schreibgeschützter
    Stammbaum: nur der Stand und „Der Baum ist schreibgeschützt.“;
  - läuft die Forschung nicht, ist das Band aus und sagt warum;
  - eine Forschung ohne Läufe in Stapeln bietet **Die nächsten 50 sortieren…** mit „Der Agent nimmt höchstens 50
    Dateien auf einmal. In Stapeln sortiert eine neuere Version der Forschung.“
- **Bedienung:** Fenster **Materialien** → das Band des Sortierens; ⋯ eines Stapels → **Mit dem Agenten
  sortieren…**; Fenster **Vorschlag des Agenten**.
- **Gilt seit:** App 3.30.0, Forschung 1.35.0

<!-- zdroj: app:9752aead src/material-sort.ts sortStripState (A–F nad celým archivem i s filtrem; × jen v A a E), src/ui/material-sort-ui.ts materialSortStripView, konec návrhu (endTitle, endRun, restLine, restNote, leftLine, leftNote, nothingLeft, endFoot, closeAsk, closeText), materialSortCloseAsk · src/ui/materials-window.ts mwSortWholeClose (sortClosedState do změny stavu), ⋯ dávky (sort) · app:17585b94 materialsBatchAdded (stripAdded) · app:0b0c9d4f (telefon, strom jen ke čtení, výzkum neběží, starší výzkum bez běhů: olderNext, olderRun) · strings.ts materials.agentSort.stripWhole, reviewHand, handle, pending, doneLine, sortNextN, allSorted, closeProposal, readOnlyNote, phoneShort, hideCopies, copiesLine -->

<a id="A3.5.11"></a>
### A3.5.11 Was sortieren: Stapel und was nicht gesendet wird

Der Dialog **Mit dem Agenten sortieren** sagt zuerst, was gesendet wird, in wie vielen Stapeln und was nicht
gesendet wird. Die Dateien gehen in Stapeln zu höchstens 50.

- **Was sortieren:** Kacheln mit Anzahlen. Oben das, woher der Dialog kam (**Nur ausgewählte** oder **Nur Stapel
  „…“**), dann immer **Alle nicht eingeordneten**; über 10 Stapel auch **Nur die ersten 50** („1 Stapel; der Rest
  später mit „Weitere sortieren““).
- **Reihenfolge:** zuerst Bilder und PDF, dann andere Dateien, Text- und Datendateien zuletzt; darin nach Stapel und
  Ordner, die Dateien eines Ordners beisammen.
- **Was nicht gesendet wird** (aus einem Stapel und aus allen nicht eingeordneten): Kopien mit gleichem Inhalt wie
  eine ältere Datei (nur die ältere geht), eine Datei, die die Datei einer Quelle ist, Dateien, die der Agent zuletzt
  nicht zugeordnet hat, und Text- und Datendateien (.md, .txt, .json, .csv). Der Dialog sagt es in einem Satz mit
  **Einzelheiten**: bei Kopien **Als Duplikat ausblenden (N)…**, bei den nicht zugeordneten **In den Materialien
  zeigen**, bei Textdateien das Kästchen **Auch Text- und Datendateien senden (N)**.
- **Nur ausgewählte** sendet alle ausgewählten Dateien außer ausgeblendeten; Kopien und Dateien einer Quelle darunter
  nennt der Dialog mit ihrer Anzahl und sendet sie auch.
- Der Dialog sagt „Gesendet werden N Dateien in M Stapeln zu höchstens 50. …“ und die Schaltfläche heißt **Mit dem
  Agenten sortieren · M Stapel**. Über 10 Stapel sagt er deutlich, dass jeder Stapel das Abo oder Guthaben nutzt und
  dass der Lauf anhält, wenn das Limit aufgebraucht ist; zum Ausprobieren reicht **Nur die ersten 50**.
- **Grenzen:**
  - höchstens 30 Stapel (1 500 Dateien) als ein Lauf ([A3.5.12](#A3.5.12)); was darüber ist, sendet erst
    **Weitere sortieren**;
  - eine Forschung ohne Läufe in Stapeln nimmt einen Stapel (50 Dateien);
  - die Datei einer Quelle erkennt die App nur durch die Forschung. Kopien und Dateien, die der Agent nicht
    zugeordnet hat, sagt die Forschung; kann sie das nicht, erkennt die App Kopien am Inhalt der Dateien, die sie
    kennt, und die nicht zugeordneten an den Vorschlägen, die sie sich merkt.
- **Bedienung:** Fenster **Materialien**: das Band des Sortierens, eine Auswahl, ⋯ eines Stapels → Dialog **Mit dem
  Agenten sortieren**.
- **Gilt seit:** App 3.30.0, Forschung 1.35.0

<!-- zdroj: app:1047b9d6 src/ui/material-sort-ui.ts openSortDialog (base: selection | batch | all, 'first' nad SORT_MANY_BATCHES=10, plan, planOne, costBig, overRun, goRun, selWarn, drawLeft s details), src/material-sort.ts SORT_MAX_BATCHES=30, sortRunBatches · app:2fbab382 src/material-sort.ts sortNext (obrázky a PDF první, text poslední jen s withText, dávka a složka, výběr vše bez skrytých; kopie, zdroje, left jen mimo výběr), sortIsText, sortCopyOf (material.sameAs, jinak otisk), sortLeftMap (material.left, jinak paměť aplikace) · strings.ts materials.agentSort.scopeLegend, scopeAll, scopeSel, scopeBatch, scopeFirst, scopeFirstSub, leftCopies, leftText, leftSources, leftLeft, showLeft, details, withText, withTextHint -->

<a id="A3.5.12"></a>
### A3.5.12 Ein Lauf in Stapeln

Mehr als ein Stapel geht als ein Lauf: die Forschung sortiert die Stapel nacheinander, und der Vorschlag jedes
fertigen Stapels lässt sich sofort bearbeiten.

- Band und Anzeige gibt es einmal für den ganzen Lauf: „Der Agent sortiert · Stapel b von M · k von n“, am Anfang
  eines Stapels „… beginnt“. Das Fenster **Vorschlag des Agenten** zeigt „Stapel b von M läuft · weitere Vorschläge
  folgen“; neue Vorschläge kommen ans Ende der Liste, mit einer Meldung und **Zeigen**.
- Der Lauf geht weiter, auch wenn das Fenster geschlossen und die App neu geladen wird. Die Meldung vom Ende kommt
  einmal, am Ende des Laufs.
- **Abbrechen** hält den Lauf sofort an: der Stapel in Arbeit endet, die wartenden starten nicht. Gibt es fertige
  Vorschläge, fragt es **Fertige Vorschläge verwerfen?** und sagt, welche Stapel nicht starten und wie viele Dateien
  nicht eingeordnet bleiben; **Behalten** lässt sie zum Bearbeiten.
- **Ein Stapel, der nicht lief:** nach dem Ende des Laufs sagt das Band in der Fehlerfarbe „Stapel b von M lief
  nicht:“ mit dem Grund, was nicht eingeordnet bleibt, **Vorschlag bearbeiten (N)**, **Erneut versuchen…** und
  **Schließen**. Die anderen Stapel laufen inzwischen weiter.
- **Ein anderswo angehaltener Lauf:** „Das Sortieren hielt nach Stapel b von M an.“ mit **Fortsetzen (N
  Stapel)…**. **Erneut versuchen…** und **Fortsetzen** öffnen den Dialog mit **Was vom Lauf übrig ist**; neue
  Stapel kommen in den offenen Vorschlag.
- **Ein Stapel wartet**, wenn die Lesungen, die die App anfragen darf, aufgebraucht sind: „Stapel b von M wartet“
  und „Er startet von selbst in etwa N Min.“ (oder Std.).
- **Grenzen:** höchstens 30 Stapel zu 50 Dateien; nur eine Forschung, die Läufe in Stapeln kann
  ([R11.5.5](R11-material-from-the-user.md#R11.5.5)). Jeder Stapel nutzt das Abo oder Guthaben und zählt zu den
  Lesungen der App.
- **Bedienung:** Dialog **Mit dem Agenten sortieren**; das Band des Fensters **Materialien**; Fenster **Vorschlag
  des Agenten**.
- **Gilt seit:** App 3.30.0, Forschung 1.35.0

<!-- zdroj: app:acc877d6 src/ui/material-sort-ui.ts (běh výzkumu čtený do konce, jeden pruh a ukazatel, runBatch, runBatchFiles, runStarting, runInWindow, moreArrived, show; po novém načtení sledovaný znovu; toast jednou na konci) · app:687dd41b materialSortCancel (cancelMaterialSortRun, discardAsk, discardRun, discardKeep), batchFailed, runErrorText (errLimit, batchErr), leftAfterError, retry, stopped, stoppedNote, resume, scopeRest, runWaiting, runWaitText (waitApp, waitRetry) · app:0b0c9d4f (bez toastu při otevřeném okně návrhu) · research:0cc2cfca src/core/sort.ts SORT_RUN_MOST_FILES=1500 -->

<a id="A3.5.13"></a>
### A3.5.13 Rückseite und Porträt im Vorschlag

Der Agent kann im Vorschlag sagen, welche der gesendeten Dateien die Rückseite eines anderen Fotos oder einer
anderen Seite ist und welches Bild das Porträt einer Person ist. Der Vorschlag zeigt es als Chip an der Datei.

- **Rückseite:** an der Vorderseite ein Chip „Rückseite:“ mit Vorschau und Namen der Rückseite. Das Annehmen
  schreibt die Rückseite zusammen mit der Vorderseite: die Rückseite bekommt deren Datum, Art und Verknüpfungen und
  den Titel „… (Rückseite)“. Die Zeile zeigt beide Namen („… + … (Rückseite)“) und „2 Seiten“.
- **Porträt:** ein Chip „Porträt:“ mit der Person. Nach dem Annehmen bekommt die Datei eine Stelle bei der Person,
  und der Porträt-Editor öffnet sich ([A12](A12-portrait-and-couple-photo.md)).
- × nimmt den Chip aus dem Vorschlag; der Rest des Vorschlags bleibt.
- **Grenzen:**
  - eine Rückseite nur zwischen Dateien, die derselbe Leser der Forschung bekam: eine Rückseite zu einer
    Vorderseite, nie die Rückseite einer Rückseite und nie eine Textdatei
    ([R11.5.3](R11-material-from-the-user.md#R11.5.3));
  - ein Porträt wird nur bei einem Bild angeboten und nur bei einer Person, die kein Porträt hat und sich bearbeiten
    lässt.
- **Bedienung:** Fenster **Vorschlag des Agenten** → **Vorschläge**.
- **Gilt seit:** App 3.30.0, Forschung 1.35.0

<!-- zdroj: app:2fbab382 src/ui/material-sort-ui.ts withPortraits (obrázek, osoba bez photo, canEditPortrait), čipy own() s × (dropped), rubFiles, twoSides, accept (sortBackRow s rubSuffix, portrét: místo personId) · strings.ts materials.agentSort.rubChip, portraitChip, rubSuffix, rubFiles, twoSides · research:0cc2cfca src/core/sort.ts SORT_LINK_TYPES back, portrait -->

<a id="A3.5.14"></a>
### A3.5.14 Vom Agenten nicht zugeordnet, Gleicher Inhalt und Datei einer Quelle

Kacheln und Zeilen des Fensters **Materialien** tragen vor den Personen ein Etikett, das sagt, warum eine Datei nicht
eingeordnet blieb oder dass sie über eine Quelle eingeordnet ist.

- **Vom Agenten nicht zugeordnet:** eine Datei, zu der der Agent beim Sortieren nichts vorgeschlagen hat. Der
  Dateibetrachter zeigt bei ihr „Warum nicht“ mit dem Grund. Der Filter **Vom Agenten nicht zugeordnet** (mit
  Anzahl) steht nach den anderen Filtern. Das nächste Sortieren sendet solche Dateien nicht, außer sie werden von
  Hand ausgewählt.
- **Gleicher Inhalt:** eine Datei mit gleichem Inhalt wie eine ältere Datei; das Sortieren sendet nur die ältere.
- **Datei einer Quelle** (bei mehreren Quellen „Datei von N Quellen“): eine Datei, aus der die Forschung eine Quelle
  gemacht hat. Das Etikett steht vor den Personen, die die Quelle zitieren, und **Im Stammbaum** richtet sich danach,
  ob die Quelle im Stammbaum ist. In **Liste** zeigt die Spalte **Quelle** ein Etikett mit dem Titel der ersten
  Quelle. So eine Datei ist eingeordnet: sie zählt weder zu **Ohne Person** noch zu **Ohne Quelle** und trägt nicht
  **Vom Agenten nicht zugeordnet**. **Wo verwendet** zeigt bei ihr die Quellen zuerst ([A3.5.3](#A3.5.3)).
- **Grenzen:** **Vom Agenten nicht zugeordnet** und **Gleicher Inhalt** trägt nur eine Datei ohne Titel oder ohne
  Person, die nicht ausgeblendet ist. **Datei einer Quelle** nur mit einer Forschung, die die Dateien der Quellen
  meldet ([R11.5.4](R11-material-from-the-user.md#R11.5.4)); ohne sie zeigen sich die Dateien wie bisher.
- **Bedienung:** Fenster **Materialien** (Kacheln, **Liste**, **Filter**); Dateibetrachter.
- **Gilt seit:** App 3.30.0, Forschung 1.35.0

<!-- zdroj: app:2fbab382 src/ui/materials-window.ts (agentLeft, copyOf jen u souboru bez titulku nebo osoby, ne skrytý ani zdroj pramene), mwSortTagHtml, filtr left (fLeft), src/ui/material-viewer-ui.ts (unassignedWhy + said nebo unproposed[why]) · app:4bf66048 src/materials-overview.ts, src/ui/materials-window.ts mwSourceOfTag, src/ui/material-uses-ui.ts (zdroj pramene: přiřazený, bez Bez osoby a Bez pramene) · strings.ts materials.agentSort.fLeft, tagLeft, tagCopy, tagSourceOf, sourceOfN, usesSourceOf, viaInput, viaMedia, viaExcerpt, citedBy, keptViaSource · research:0cc2cfca src/core/live.ts GET /material (uses.of, left, sameAs) -->

<a id="A3.5.15"></a>
### A3.5.15 Materialien hinzufügen… im Fenster

**Materialien hinzufügen…** im Kopf des Fensters **Materialien** öffnet über dem Fenster den Assistenten
**Materialien zur Forschung hinzufügen** ([R11.4](R11-material-from-the-user.md#R11.4)).

- Dateien und Ordner, die auf das Fenster gezogen werden, zeigen „Hier loslassen: zu den Materialien hinzufügen“
  und öffnen den Assistenten mit ihnen. Ohne Bestätigung im Assistenten wird nichts gesendet.
- Ein Stapel, der bei offenem Fenster hinzukommt, meldet sich im Band des Sortierens ([A3.5.10](#A3.5.10)), und die
  Liste wird neu geladen.
- **Grenzen:** nur bei einer Forschung, die Stapel annimmt, und bei einem Stammbaum, der sich ändern lässt; ein
  Stammbaum ohne Forschung hat die Schaltfläche nicht. Auf dem Telefon gibt es kein Ziehen; **Materialien
  hinzufügen…** und **Wo die Dateien liegen** sind dort im ⋯ des Kopfs.
- **Bedienung:** Fenster **Materialien** → **Materialien hinzufügen…**; Dateien oder Ordner auf das Fenster ziehen.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:17585b94 src/ui/materials-window.ts mwAddMaterials (showBatchDialog), mwWireDrop (ne na telefonu), mwFillHeadMenu (telefon: add, where), materialsBatchAdded · src/ui/materials-ui.ts materialsAddOffered (windowAddOffered: model archive, batchAvailable, ne jen ke čtení) · strings.ts materials.addMaterials, dropTitleMaterials, dropSubMaterials, agentSort.stripAdded -->

<a id="A3.5.16"></a>
### A3.5.16 Endgültig löschen

**Endgültig löschen…** löscht Dateien der Forschung aus dem Archiv und aus dem Stammbaum. Es geht nur über einen
Dialog, der zuerst sagt, was auf die Dateien verweist; in der App lässt es sich nicht rückgängig machen.

- Der Dialog **N Dateien endgültig löschen?** zeigt eine Vorschau (bei mehreren Dateien die ersten fünf und „und N
  weitere“), **Was auf die Dateien verweist** nach der Forschung (Zeilen **Quelle**, **Ausschnitte**, **Baum**,
  **Personen**, **Aufgaben**), dass die Dateien aus dem Archiv der Forschung und aus dem Stammbaum gelöscht werden,
  und das Kästchen **Verstanden, Löschen lässt sich in der App nicht rückgängig machen**.
- Die Schaltfläche **Endgültig löschen** wirkt nur, wenn die Forschung die Liste bestätigt hat und das Kästchen
  angehakt ist; den Fokus hat **Abbrechen**. Dateien außerhalb des Stammbaums, die noch nicht ausgeblendet sind,
  bieten auch **Nur ausblenden – lässt sich rückgängig machen**.
- **Was geschieht:** eine Quelle bleibt, nur ohne ihre Datei; eine Quelle mit gleichem Inhalt verliert das Bild, Text
  und Zitate bleiben; Ausschnitte aus diesen Dateien werden gelöscht; Stellen im Stammbaum entfernt die nächste
  Version des Stammbaums aus der Forschung; die Datei verschwindet aus den Materialien der Personen; eine Aufgabe
  ohne weitere Dateien wird aufgegeben. Inhalt, den auch eine andere Datei oder eine andere Forschung auf diesem
  Computer hat, bleibt gespeichert, und nur der Eintrag wird gelöscht.
- Hat sich die Liste inzwischen geändert oder ist die Bestätigung abgelaufen (sie gilt 15 Minuten), zeigt der Dialog
  die neue Liste, nimmt den Haken weg, und das Löschen muss neu bestätigt werden.
- Nach dem Löschen die Meldung „Endgültig gelöscht: N Dateien.“ ohne **Rückgängig**. Die Dateien verschwinden aus
  dem Fenster und aus dem Vorschlag des Agenten. Sie bleiben nur in früheren Sicherungen der Forschung (beim
  Strom-Archiv des Archivs). Weder Agent noch Baum löschen je von selbst.
- **Grenzen:**
  - nur Dateien des Archivs der Forschung oder des Strom-Archivs; eine Datei, die nur im Stammbaum ist, entfernt
    **Aus dem Stammbaum entfernen…** ([A3.5.6](#A3.5.6));
  - höchstens 500 Dateien auf einmal („Auf einmal lassen sich höchstens 500 Dateien löschen.“);
  - nur mit einer Forschung, die löschen kann, und mit laufender Brücke; nie in einem schreibgeschützten Stammbaum;
  - auf einem schmalen Bildschirm ist der Dialog ein Blatt von unten;
  - eine Stammbaumdatei und eine Datei, aus der eine gültige Quelle entstand, beschreibt [A3.5.17](#A3.5.17).
- **Bedienung:** Fenster **Materialien** → Auswahl → ⋯ → **Endgültig löschen…** (der letzte Eintrag);
  Dateibetrachter (die letzte Aktion). Terminal: `strom input delete`
  ([R11.5.6](R11-material-from-the-user.md#R11.5.6)).
- **Gilt seit:** App 3.30.0, Forschung 1.35.0

<!-- zdroj: app:05e13ef7 src/ui/material-delete-ui.ts openDeleteDialog (suchý běh, potvrzení mostu, zaškrtnutí, Zrušit s fokusem, hideInstead, changed, expired, toast bez Zpět, list zespodu), src/material-delete.ts deletableFiles (origin ≠ tree, file), src/materials.ts DELETE_MAX_FILES=500, MATERIAL_DELETE_FEATURE · src/ui/materials-window.ts sel-delete (caps.delete, ne jen ke čtení, bridgeUp), src/ui/material-viewer-ui.ts (inArchive, poslední akce) · app:6949d833, f214eda6 (množné číslo, understandHint) · strings.ts materials.del.* · research:0cc2cfca src/core/materialdelete.ts DELETE_MOST_FILES, DELETE_CONFIRM_MS -->

<a id="A3.5.17"></a>
### A3.5.17 Stammbaumdatei in den Materialien

Das Fenster **Materialien** zeigt auch die Stammbaumdateien, die die Forschung hat: ein importiertes GEDCOM oder eine
JSON-Datei der App. Sie lassen sich ansehen und endgültig löschen; ist aus einer eine Quelle entstanden, nur zusammen
mit ihr.

- Kachel und Zeile der **Liste** zeigen Art und Größe („Stammbaumdatei · 184 kB“) und das Etikett **Datei einer
  Quelle**, wenn aus ihr eine Quelle entstanden ist ([A3.5.14](#A3.5.14)). Eine Stammbaumdatei ist nie **Im
  Stammbaum**: sie hat dieses Etikett nicht, und der Filter **Im Stammbaum** zählt sie nicht, auch dann nicht, wenn
  die Quelle aus ihr im Stammbaum ist. Der Filter **Art** hat die Zeile **Stammbaumdateien** nur, wenn es eine gibt.
- Stammbaumdateien sind außerhalb des Sortierens durch den Agenten, der Sammelaktionen, von **Ohne Person** und der
  Zählungen von **Durchgehen**. Titel, Art, Datum und Personen ändern sich bei ihnen nicht.
- Das Menü der Datei (auf einem schmalen Bildschirm ein Blatt von unten) hat nur **Details** und **Endgültig
  löschen…**. **Details** sind ohne Vorschau und nennen die Quelle, die aus der Datei entstand („Datei der Quelle
  …“).
- **Endgültig löschen…** bei einer Datei, aus der keine Quelle entstand: ein Dialog wie in [A3.5.16](#A3.5.16), mit
  dem Satz „Die Stammbaumdatei wird aus dem Archiv der Forschung gelöscht. In der App lässt sich das nicht rückgängig
  machen.“ und „Nichts verweist auf die Datei: aus ihr ist keine Quelle entstanden.“, ohne **Nur ausblenden – lässt
  sich rückgängig machen**.
- **Endgültig löschen…** bei einer Datei, aus der eine Quelle entstand, die noch gilt: ein zweiteiliger Dialog
  **Quelle und Datei löschen?** („Aus der Datei entstand die Quelle …. Die Datei wird nach der Quelle gelöscht,
  beides auf einmal.“):
  - **Zuerst wird die Quelle gelöscht**: was auf der Quelle steht, wie im Dialog **Quelle löschen?**
    ([A3.1.2](#A3.1.2));
  - **Dann wird die Datei gelöscht**: was auf die Datei verweist; die Quelle „wird im ersten Schritt gelöscht“;
  - „Die Quelle lässt sich später in der Forschung wiederherstellen, aber ohne die Datei.“, ein einziges Kästchen
    **Verstanden, die Datei lässt sich in der App nicht zurückholen** und die Schaltfläche **Quelle und Datei
    löschen**.

  Beides wird auf einmal geschrieben, mit einem Schreiben in der Forschung. Die Meldung „Quelle … und Datei …
  gelöscht.“ hat kein **Rückgängig**, und die Quelle verschwindet dann aus dem Stammbaum.
- **Prüft der Code:** hat sich die Liste inzwischen geändert, zeigt der Dialog die neue, nimmt den Haken weg, und das
  Löschen muss neu bestätigt werden. Ein misslungenes Schreiben löscht nichts („Das Schreiben in die Forschung ist
  fehlgeschlagen. Nichts wurde gelöscht.“) und erlaubt einen neuen Versuch.
- **Grenzen:** nur mit einer Forschung, die Stammbaumdateien im Material meldet; ohne sie zeigt das Fenster sie
  nicht. Löschen wie in [A3.5.16](#A3.5.16): nur mit laufender Brücke und nie in einem schreibgeschützten Stammbaum.
- **Bedienung:** Fenster **Materialien** → Stammbaumdatei → ⋯ → **Details** / **Endgültig löschen…**; Filter **Art →
  Stammbaumdateien**. Terminal: `strom input delete I… --retract-sources S…`
  ([R11.5.6](R11-material-from-the-user.md#R11.5.6)).
- **Gilt seit:** App 3.31.0 mit Forschung 1.36.0

<!-- zdroj: app:36601947 src/materials-overview.ts (druh tree za bránou material.trees, trees=1; mimo třídění, hromadné akce, bez osoby, počty Projít; podrobnosti nejdou upravit), src/material-delete.ts treeFileSource, retractSources, blockedBy (409 material.source-live) · 2a406d67 dlaždice a řádek (Soubor rodokmenu · velikost, štítek zdroje), filtr Druh, nabídka Podrobnosti + Smazat natrvalo… (list zespodu), Podrobnosti bez náhledu, dialog bez pramene bez Jen skrýt · b40b22e4 dvoudílný dialog · d9af4b16 (ne Ve stromu, ani štítek, ani filtr) · e2e/material-tree-delete.spec.ts (hlavička) · strings.ts materials.treeFile, kindTrees, treeFileOf, treeDetails, del.textTree, noRefsTree, bothTitle, bothIntro, partSource, partFile, laterNoFile, fileSourceSub, understandFile, bothGo, bothChanged, bothNone, bothToast · SPEC.md 1120-app-117-smazani, 1120-app-108-diry · spec 117 §5–§7 -->

<a id="A3.6"></a>
## A3.6 Quellen einer Person

Das Menü der Person **Quellen** zeigt alle Quellen der Person an einem Ort, ohne die Bearbeitung zu öffnen: zitiert
zur Person, zu Geburt und Tod, zu Ereignissen, zu Heiraten und zu gemeinsamen Ereignissen von Paaren.

- Eine Zeile je Quelle, darunter, was sie belegt: „Person“, „Geburt 1865“, „Trauung 1890“… Die Zeile zeigt auch
  die Verlässlichkeit.
  Ab App 3.27.0 ist es die Zuverlässigkeit der Zitationen: Stimmen die Zitationen der Quelle in der Zuverlässigkeit
  überein, steht sie einmal an der Zeile; unterscheiden sie sich, folgt jeder Angabe ihre eigene („Geburt 1865
  Abschrift / Index · Beruf Original“).
- Reihenfolge: nach dem ältesten Jahr dessen, was die Quelle belegt, sonst nach **Eintragsdatum**; ohne Datum am
  Ende, dann nach Titel.
- **Quelle zitieren** öffnet die Auswahl mit **Belegt** ([A3.2](#A3.2)).
- **Quelle in der Forschung finden**: nur bei einer Person ohne Quelle, die die Forschung kennt, und nur bei einer
  Forschung mit Agent. Öffnet das Terminal der Forschung mit einer Revision der Person.
- **Grenzen:** bei einem schreibgeschützten oder gesperrten Stammbaum steht der Punkt nur im Menü, wenn die Person
  eine Quelle hat. Die Zahl der Quellen steht beim Menüpunkt.
- **Bedienung:** Menü der Person (Klick auf die Karte) → **Quellen**.
- **Ab App 3.22.0:** die Quellen einer Erzählung stehen bei der Erzählung selbst. Unter dem Text der Erzählung ist
  ein einziger eingeklappter Abschnitt **Grundlage des Textes (N)**, wobei N die Zahl der Quellen ist:
  - **Quellen**: jede Quelle einmal. Zuerst die Quellen, auf die die Erzählung selbst verweist, dann die Quellen, die
    ihre Angaben zitieren. Eine Quelle mit Webadresse ist ein Link, der sich in einem neuen Fenster öffnet;
  - **Fakten**: die Angaben, auf denen der Text beruht, lesbar („Tod 25. 9. 1857, Lhota“), ohne Kennungen der
    Forschung;
  - **Anmerkung des Autors**, wenn die Erzählung eine hat.
- Der Abschnitt steht im Fenster **Erzählung**, auf der Personenseite, im Vergleich der Fassungen einer Erzählung und
  (nur lesbar) beim Bearbeiten der Person. Die Kennung einer Quelle im Text (`[S0164]`) erscheint als Titel der Quelle
  in Klammern, wenn der Stammbaum sie hat. Die Personenseite führt eine Quelle der Erzählung auch unter ihren Quellen
  auf, mit **Erzählung** oder **Geschichte der Ehe** als dem, was sie belegt. Das Menü **Quellen** führt die Quellen
  der Erzählung nicht auf.
- **Grenzen:** im Druck und im Familienbuch steht unter dem Text nichts; die Quellen der Erzählung sind im Buch
  nummeriert im Verzeichnis der Quellen. Wie die Forschung die Quellen einer Erzählung hält:
  [R3.9](R3-verification-and-citation.md#R3.9).
- **Gilt seit:** App 3.3.0; **Quelle in der Forschung finden** 3.19.0; **Grundlage des Textes** 3.22.0

<!-- zdroj: app:src/person-sources.ts:54 personSourceRows · src/ui/person-sources-ui.ts:114 canCiteOnPerson, :120 showPersonSourcesDialog, :187 find hidden · src/ui/context-menu.ts:191-203 readItems · src/ui/research-actions-ui.ts:1173 personFindSourceUrl · strings.ts personSources.*, research.findSource · src/story-sources.ts storyBasisSourceIds, storyFactText, storyBasisDetailsHtml · src/ui/person-page.ts:1738 storyBasisHtml · strings.ts storyBasis, basisSources, basisFacts, authorNote · CHANGELOG.cs.md 3.22.0 · 3.27.0: app:dde0151a src/person-sources.ts rowQuality, PersonSourceCite.quality, src/ui/person-sources-ui.ts source-quality-tag · app:66fc3f7f (údaj a štítek se nezalomí) -->

<a id="A3.7"></a>
## A3.7 Wo Belege fehlen

**Stammbaum-Überblick → Datenqualität → Wo Belege fehlen** listet Gruppen von Menschen auf, denen eine Quelle oder
die Eltern fehlen. Die Schaltfläche **Im Baum zeigen** hebt sie im Stammbaum hervor und führt einen nach dem anderen
durch sie. Eine leere Gruppe wird nicht aufgeführt.

- **Personen ohne Quelle**: im ganzen Stammbaum („n von N“).
- **Geburten ohne Quelle**: Vorfahren der gewählten Person („n von N Vorfahren“). Bei einem Stammbaum mit Forschung
  stattdessen **Geburten in der Forschung nicht bewiesen**: Geburten der Vorfahren, die nicht Belegt sind.
- **Linienenden**: Menschen ohne Eltern, die Vorfahren der gewählten Person sind oder Kinder haben und nicht
  eingeheiratet sind.
- Wenn nichts fehlt: „Alle haben eine Quelle und Eltern.“
- Unter den Gruppen steht immer die Schaltfläche **Belege im Baum**. Sie schaltet den Modus **Belege** ein: jede Karte
  bekommt einen Rahmen nach der Belegstufe der Person ([R3.8.1](R3-verification-and-citation.md#R3.8.1)), durchgezogen
  bei Belegt, gestrichelt bei Teilweise belegt und gepunktet bei Unbelegt. Die Leiste oben zeigt die Zahlen aller drei
  Stufen; eine Zahl hebt nur diese Gruppe hervor, mit **Nächste Person ›**. Die eine Marke auf der Karte ist etwas
  anderes ([S7.2](S7-reliability-and-verification.md#S7.2)).
- Bei der Hervorhebung: **Nächste Person ›**, **Zitieren** (bei den Gruppen ohne Quelle) und × **Hervorhebung
  beenden**. Die Reihenfolge ist nach Generation, dann nach Name. Am Ende: „Fertig, niemand mehr in dieser Auswahl.“
- **Grenzen:** bei einer Geburt, die die Forschung bewertet, steht statt **Zitieren** die Schaltfläche **Quellen**.
  Eine weitere Zitation belegt die Angabe nicht; es entscheidet die Forschung. **Zitieren** fehlt bei einem
  schreibgeschützten Stammbaum und bei einer gesperrten Person. Die Prüfung des Stammbaums als Ganzes beschreibt
  [A5](A5-tree-check.md).
- **Bedienung:** **Stammbaum-Überblick → Datenqualität → Wo Belege fehlen → Im Baum zeigen** (aus einem anderen
  Stammbaum **Stammbaum öffnen und zeigen**).
- **Gilt seit:** App 3.4.0; **Geburten in der Forschung nicht bewiesen** und **Quellen** statt **Zitieren** 3.13.1

<!-- zdroj: app:src/stats.ts:185-240 computeEvidenceGaps · src/ui/evidence-ui.ts:81 walkOrder, :325-358 pill · src/tree-overview.ts:215 birthResearchStatus · src/ui/tree-overview.ts:1946-1975 · strings.ts treeOverview.evidenceTitle/evNoSource/evBirthNoSource/evBirthUnproven/evLineEnds/evOfTotal/evOfAncestors/evAllGood/evLevels, treeHealth.citeAction/sourcesAction/next/highlightDone/highlightEnd · app:7eb903a3 src/ui/tree-overview.ts:1974 tov-ev-levels, :2293 showEvidenceLevelsFromOverview · src/ui/evidence-ui.ts showEvidenceLevels, renderEvidencePill, toggleEvidenceLevelGroup · index.html .person-card.evl-full/partial/none (solid, dashed, dotted) · strings.ts treeHealth.evidenceMode -->

<a id="A3.8"></a>
## A3.8 Bild nur in der Forschung

Ein Bild nur in der Forschung ist ein Scan oder Ausschnitt einer Quelle, der in der Forschung auf dem Computer
gespeichert ist und den die App noch nicht hat. Die Quelle ist auch ohne ihn in der App; das Bild erscheint nach dem
Laden aus der Forschung, die auf diesem Computer läuft.

- **Warum das Bild nicht in der App ist:** bei der Quelle steht der Grund: das Bild kam wegen der Einstellungen der
  Forschung oder der Größengrenze nicht in die App, oder es wird in der Forschung noch vorbereitet und kommt mit der
  nächsten Version. Die Forschung gibt Bilder nach ihren Einstellungen und ihrer Größengrenze in die Datei für die App.
- **Wo es zu sehen ist:** in **Quellen** der Filter **Bild nur in der Forschung · N** mit der Marke *Bild nur in der
  Forschung* bei der Quelle und einer Zeile unter dem Filter („N Bilder zu M Quellen sind nur in der Forschung auf
  diesem Computer gespeichert; in der App erscheinen sie nach dem Laden.“); im Menü **Forschung** die Zeile **Bilder nur
  in der Forschung · N**, die **Quellen** mit dem Filter öffnet und den Fortschritt des Ladens zeigt.
- **Laden:**
  - **Bild aus der Forschung laden** bei einer Quelle lädt ihre Bilder;
  - **Alle aus der Forschung laden…** zeigt zuerst die Zahl der Quellen und Bilder, die Größe („Die Bilder werden beim
    Stammbaum in diesem Browser gespeichert.“), wie viele Bilder die Forschung erst vorbereitet, und den freien Platz
    im Browser. Dann den Fortschritt mit **Pause** und **Anhalten**; das Fenster lässt sich schließen, und das Laden
    läuft weiter. Nicht Geladenes bleibt im Filter;
  - geladene Bilder bleiben beim Stammbaum in diesem Browser, getrennt von den Daten des Stammbaums.
- **Grenzen:**
  - laden geht nur aus einer Forschung, die auf diesem Computer läuft („Es wird geladen, sobald die Forschung auf
    diesem Computer läuft.“). Auf dem Telefon oder einem anderen Gerät: „Das Bild ist in der Forschung auf dem
    Computer. Auf diesem Gerät ist es, wenn der Stammbaum mit Bildern aus der Forschung übertragen wird.“;
  - **Aus der App entfernen** entfernt die Bilder wieder aus dem Browser; sie bleiben in der Forschung und lassen sich
    erneut laden. Bilder, die mit der Datei der Forschung kamen, bleiben;
  - **Bild einer Quelle beim Öffnen laden** lädt nur die geöffnete Quelle und nur,
    wenn die Forschung auf diesem Computer läuft; die Quellenliste lädt nichts von selbst;
  - der Export bietet **Quellenbilder**: **Ohne Quellenbilder**, **Nur die in der App** oder **Alle aus der Forschung** (vor dem Export
    geladen, nur wenn die Forschung auf diesem Computer läuft).
- **Bedienung:** App: **Quellen** → Filter **Bild nur in der Forschung** → **Alle aus der Forschung laden…**; bei einer
  Quelle **Bild aus der Forschung laden**, **Weitere Optionen → Aus der App entfernen**; **Einstellungen →
  Quellenbilder** (**Bild einer Quelle beim Öffnen laden**, **Aus der App entfernen…**, **Alle laden…**); **Forschung → Bilder nur in der Forschung · N**.
- **Gilt seit:** App 3.14.0 mit Forschung 1.18.0
- **Ab App 3.25.0:** Filter und Marke heißen **Bild nur in der Forschung** (früher **Bild in der Forschung**), die
  Zeile unter dem Filter sagt, wo die Bilder sind, und **?** öffnet diese Regel.

<!-- zdroj: app:src/strings.ts researchImages.* (held.scope/limit/later, heldTag, filter, bulkLine, bulkLoad, bulkSummary, bulkReady, bulkSpace, bulkCanClose, bulkLeft, menuRow, removeFromApp(Note), heldBridgeOff, heldDevice, settings.section/auto/autoDesc/remove/loadAll/removeKeep, export.legend/none/app/all/allOff) · src/help/topics.ts imagesHeld · CHANGELOG.cs.md 3.14.0, 3.25.0 · commit 68b31a48 -->

<a id="A3.9"></a>
## A3.9 Wo der Eintrag im Buch steht

Wo der Eintrag steht, wird bei einer Quelle in Feldern geschrieben. Über Archiv, Signatur, Folio und Bild findet sich
der Eintrag wieder, auch wenn das Archiv die Adressen der Bilder ändert oder das Buch keine Seitenzahlen hat.

- **Felder:**
  - **Archiv**: Archiv, Pfarramt, Bibliothek;
  - **Signatur**: die Signatur des Buches, eine Inventarnummer;
  - **Folio/Seite**: Folio oder Seite, wie das Buch zählt, auch mit dem Wort („fol. 12v“, „pag. 112“);
  - **Bild**: die Bildnummer im Viewer des Archivs. **?** neben dem Feld sagt, wozu: „Bildnummer im Viewer des
    Archivs. Mit Archiv, Signatur, Folio und Bild findet sich der Eintrag auch nach einer Adressänderung wieder.“;
  - **Weitere Fundstelle**: der Rest, z. B. die Nummer des Eintrags, Spalte, Band.
- **Eine ältere Quelle** hat, wo der Eintrag steht, als einen Text in **Weitere Fundstelle** und die neuen Felder
  leer. Sind **Folio/Seite** und **Bild** leer und nennt der Text ein Folio oder ein Bild, schlägt der Editor unter
  den Feldern vor: „Aus der Fundstelle: fol. 31 recto · Bild 3 · Rest „Nr. 2““. **Übernehmen** füllt die drei Felder
  („Aus der Fundstelle „…“ übernommen. Gesichert wird mit Speichern.“), **Zurück** nimmt das zurück. Nichts wird von
  selbst gespeichert: die übernommenen Felder werden erst mit **Speichern** gespeichert, als ein Schritt zurück. Das
  Erkennen ist Code der App, derselbe wie in der Forschung ([R3.4.3](R3-verification-and-citation.md#R3.4.3)).
- **Widerspruch:** nennt **Weitere Fundstelle** ein anderes Bild oder Folio als das Feld, sagt der Editor das („Die
  Fundstelle nennt Bild 35, das Feld Bild sagt 34. In GED gilt das Feld.“) und bietet **Fundstelle zu „…“ ändern**
  (oder **Widersprüchlichen Teil entfernen**) an. Speichern geht auch mit dem Widerspruch; in GEDCOM geht das Feld.
- **Wo es zu sehen ist:**
  - im Quellenbetrachter unter den Ausschnitten: **Buch** (Archiv · Signatur) und **Eintrag** (Folio · Bild · weitere
    Fundstelle), bei einer älteren Quelle die ganze **Fundstelle**; darunter der Link zur Seite im Archiv, ohne Link
    „Kein Link. Der Eintrag findet sich über Buch und Eintrag.“;
  - **Aktionen → Quellen** und die Auswahl der Quelle: Archiv · Signatur · Folio · Bild kurz („Bild 34“);
  - das Etikett einer Zitation: die Blase hat drei Zeilen (Titel, Buch, Eintrag);
  - die Personenseite, das Familienbuch und die Familienseiten nennen auch Signatur, Folio und Bild;
  - die Tabelle: die Spalten in [A6.7.11](A6-views.md#A6.7.11) und [A6.7.12](A6-views.md#A6.7.12).
  Eine Quelle ohne die neuen Felder sieht überall aus wie bisher.
- **Grenzen:**
  - ein geleertes Feld wird aus der Quelle entfernt. In einem Stammbaum aus der Forschung geht das Leeren auch in die
    Forschung ([S2.2.2](S2-edits-from-the-app.md#S2.2.2));
  - **Weiterer Eintrag aus demselben Buch** und **Andere Seite** mit Feldern beschreibt [A3.2.1](#A3.2.1);
  - GEDCOM: das Buch als `REPO` mit `CALN`, eine lesbare `PAGE` und eigene Tags von Strom ([A2.6](A2-loading-a-family-tree.md#A2.6),
    [A2.7](A2-loading-a-family-tree.md#A2.7));
  - pag. und fol. sowie Vorder- und Rückseite (r/v) werden nicht eigens unterschieden: sie sind Teil des Textes
    **Folio/Seite**.
- **Bedienung:** der Editor der Quelle (**Quelle bearbeiten**, **Quelle hinzufügen**): **Archiv**, **Signatur**,
  **Folio/Seite**, **Bild**, **Weitere Fundstelle**, **URL**; der Vorschlag **Aus der Fundstelle:** mit **Übernehmen**
  und **Zurück**.
- **Gilt seit:** App 3.27.0
- **Ab App 3.31.0:** bei einem Bild, das die Forschung aus ihren registrierten Scans ermittelt hat, schneidet GEDCOM
  kein anderes Bild aus der Fundstelle heraus: es bekommt die ganze Fundstelle und dahinter das Bild aus dem Feld, wenn
  die Fundstelle es nicht nennt ([A2.6](A2-loading-a-family-tree.md#A2.6)).

<!-- zdroj: app:c3278633 src/types.ts Source.callNumber/folio/image (reference = další umístění), src/source-location.ts hasPlaceFields, recognizeLocation, locatorOverlap, composePage, sourcePlaceParts, sourcePlaceLine (short: imageShort), test/fixtures/source-locations.json (38 případů společných s výzkumem) · 9732853b src/ui/sources.ts:1269 (návrh sleduje psaní), :1363-1400 řádek pod poli (taken/conflict/proposal jen při prázdném foliu i snímku), :1429 Vrátit; prázdná pole odebrána · 2f4a9c2f prohlížeč (viewerBook/viewerEntry/viewerLocation/viewerNoUrl), Správa a výběr, bublina čipu, person-page.ts, book-blocks.ts, family-pages-html.ts · strings.ts sources.fieldRepository(Ph)/fieldCallNumber(Ph)/fieldFolio(Ph)/fieldImage(Ph)/fieldImageHelp/imageHelpLabel/fieldReference(Ph)/proposalFrom/proposalRest/proposalTake/proposalTaken/proposalUndo/conflictImage/conflictFolio/conflictFix/conflictFixEmpty/imageShort · spec 075 K1.1, rozhodnutí 1, 2, 5 · dirigent:prace/1111-app-citace-pole · 3.31.0: app:2e68d373 src/source-location.ts composePage (imageDerived) -->

<a id="A3.9.1"></a>
### A3.9.1 Nach Vorschlag aufteilen

Die älteren Fundstellen aller Quellen lassen sich auf einmal in Felder aufteilen: Folio/Seite und Bild kommen in
eigene Felder, der Rest bleibt in **Weitere Fundstelle**. Aufgeteilt wird durch Code, ohne Agenten, und mit einem
Schritt lässt es sich auch zurücknehmen.

- **Angebot:** in **Aktionen → Quellen** und über Tabelle › Quellen die Zeile „Die Fundstellen von 12 Quellen lassen
  sich in Felder aufteilen.“ mit **Nach Vorschlag aufteilen…**. Das Fenster **Fundstellen in Felder aufteilen** zeigt
  eine Vorschau: **Quelle**, **Fundstelle bisher**, **Folio/Seite**, **Bild**, **Weitere Fundstelle**; zuerst
  6 Quellen, **Alle anzeigen (n)** lädt beim Scrollen weitere. Wie viele Fundstellen nicht erkannt wurden („…
  bleiben unverändert“), steht unter der Vorschau, darunter bis zu drei Beispiele („Z. B. „Buch N 7, Eintrag ohne
  Nummer“.“), jedes einmal und höchstens 60 Zeichen lang („…“).
- **Regel:** „Ein bereits ausgefülltes Feld wird nicht überschrieben. Ein Teil, den das Feld anders angibt, bleibt in
  der Fundstelle.“ Ein Wert, der bleibt, hat in der Vorschau „· unverändert“. Die Notizzeile „Signatur: …“ aus einem
  früheren GEDCOM-Import kommt ins leere Feld **Signatur** (Spalte **Signatur** mit „· aus Notiz“).
- **Aufteilen (n)** ändert alle n Quellen in einem Schritt, auch die, die die Vorschau noch nicht gezeigt hat. Die
  Meldung „n Fundstellen aufgeteilt.“ bietet 8 Sekunden lang **Rückgängig**; zurücknehmen geht auch mit Strg+Z (auf
  dem Mac ⌘Z). Solange die Aufteilung der letzte Schritt ist, sagen die **Quellen** „Fundstellen am … aufgeteilt
  (n Quellen).“ mit **Zurücknehmen…**, und das Fenster öffnet sich mit der Zeile **Aufteilung vom … zurücknehmen**.
  Gibt es nichts mehr aufzuteilen: „Weitere Fundstellen zum Aufteilen gibt es gerade nicht.“
- **Stammbaum aus der Forschung:** aufgeteilt wird von der Forschung, nur wenn sie läuft und das Aufteilen kann
  ([R3.4.4](R3-verification-and-citation.md#R3.4.4)). Die Vorschau ist die der Forschung; **Aufteilen** bittet sie,
  genau das aufzuteilen, was die Vorschau gezeigt hat, und der Fortschritt bleibt an der Schaltfläche, bis die
  Forschung schreibt. Die App übernimmt danach die neue Version der Forschung von selbst, wenn sich nur die
  Fundstellen der Quellen unterscheiden und nichts auf das Senden wartet. **Rückgängig** nimmt die Aufteilung über die
  Forschung zurück.
- **Grenzen:**
  - ein Stammbaum aus der Forschung ohne laufende Forschung: in **Quellen** nur der Satz „Fundstellen aufteilen geht,
    solange die Forschung läuft.“, in der Tabelle nichts. Das Strom-Archiv, ein schreibgeschützter und ein gesperrter
    Stammbaum bieten das Aufteilen nicht an;
  - inzwischen geänderte Quellen: „Die Quellen haben sich inzwischen geändert. Die Vorschau zeigt den jetzigen
    Stand.“; die Forschung mit einer anderen Aufgabe beschäftigt: „Die Forschung arbeitet gerade an einer anderen
    Aufgabe. Aufteilen geht gleich wieder.“ mit **Erneut versuchen**;
  - das Zurücknehmen wird ganz abgelehnt, wenn sich eine Quelle nach der Aufteilung geändert hat: es sagt, wie viele,
    und die ersten drei, zurückgenommen wird nichts. In der App ohne Forschung nach einer späteren Änderung des
    Stammbaums: „Zurücknehmen geht nicht mehr: der Stammbaum hat sich seit der Aufteilung geändert.“;
  - eine nicht erkannte Fundstelle bleibt, wie sie ist. Eine Quelle, die schon ein Folio oder ein Bild im Feld hat,
    zählt nicht zu den nicht erkannten: der Rest ihrer Fundstelle („Nr. 5“) ist nichts zum Aufteilen. In einem
    Stammbaum der Forschung liefert die Beispiele nicht erkannter die Forschung; schickt sie keine, zeigt die Vorschau
    nur die Anzahl.
- **Bedienung:** **Aktionen → Quellen → Nach Vorschlag aufteilen…**; Tabelle › Quellen, die Zeile über der Tabelle;
  **Aufteilen (n)**, **Rückgängig**, **Zurücknehmen…**. Die Forschung im Terminal: `strom source split`
  ([R3.4.4](R3-verification-and-citation.md#R3.4.4)).
- **Gilt seit:** App 3.27.0; Stammbaum aus der Forschung mit Forschung 1.31.0

<!-- zdroj: app:8dd21adf src/source-split.ts SplitSourceKind (local/bridge/needsResearch/archive/none), localSplitPlan (řádek poznámky „Signatura:“ v každém jazyce importu), splitOffer (needsResearch jen v Prameny) · src/ui/source-split-ui.ts:37 TOAST_MS 8000, sourceSplitKind (read-only/zamčený → none, archiv → archive, most + feature sources.split → bridge) · 5a59f01d src/source-split-bridge.ts (GET/POST sources/split, undo), příklady nerozpoznaných přes most (unrecognizedExamples, výzkum ff760309) a lokální plán jako výzkum (zbytek u pole folia/snímku = nic, NFC, bez duplicit, nejvýš 3, ořez 60 znaků po grafémech): app:34cb5996 src/source-split.ts localSplitPlan, SPLIT_UNRECOGNIZED_EXAMPLES, src/source-split-bridge.ts examplesOf, src/ui/source-split-ui.ts:614, strings.ts sources.split.unrecEx · src/ui/misc.ts:1352 Ctrl/⌘+Z · strings.ts sources.split.* (offer, open, needsResearch, doneLine, undoOpen, title, lead, rule, sigNote, col*, kept, fromNote, all, shown, unrec, go, progress, toast, undo, undoRow, nothingLeft, errPlan, errBusy, retry, errUndoLater, errUndo) · spec 075 K4.2 · research:c4fe4fac -->
