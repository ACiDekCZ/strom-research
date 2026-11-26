<a id="A8"></a>
# A8 Zusammenführen von Stammbäumen

Wie die Strom-App zwei Stammbäume zusammenführt: eine GEDCOM-Datei mit einem Stammbaum, zwei Stammbäume oder eine
Ansicht mit einem Stammbaum. Beschrieben wird die App 3.21.2; Änderungen aus einer neueren Version tragen deren Nummer.
Ab App 3.32.0 führt jedes Zusammenführen der Assistent **Stammbäume zusammenführen** in sechs Schritten
([A8.5](#A8.5) bis [A8.13](#A8.13)), und das Verbinden von Stammbäumen bietet **Struktur ändern…**
([A14.5](A14-trees-and-structure.md#A14.5)). Das Zusammenführen einer doppelten Person innerhalb eines Stammbaums ist
etwas anderes ([A5.6](A5-tree-check.md#A5.6)).

<a id="A8.1"></a>
## A8.1 Zusammenführen legt immer einen neuen Stammbaum an

Gilt nicht mehr ab App 3.32.0, ersetzt durch [A8.5](#A8.5): Der Assistent schreibt in den gewählten Stammbaum oder legt
einen neuen an.

Das Ergebnis des Zusammenführens wird als **neuer Stammbaum** gespeichert. Beide ursprünglichen Stammbäume und die
Datei bleiben unverändert.

| Woher | Bedienung |
|---|---|
| GEDCOM-Datei | **Import → GEDCOM importieren → Mit Vorhandenem zusammenführen** |
| anderer Stammbaum | Verwaltung der Stammbäume, beim Stammbaum **Stammbaum zusammenführen** → **Zielstammbaum auswählen** → **Zusammenführen starten** |
| gerade in der Ansicht gezeigte Personen | **Diese Ansicht zusammenführen mit…** und Wahl eines anderen Stammbaums |

- Vor dem Speichern fragt die App nach **Name für den zusammengeführten Stammbaum:** (Standard „Ziel + Quelle“).
  Nach dem Zusammenführen zeigt sie die Zahl der zusammengeführten und hinzugefügten Personen und bietet den Wechsel
  zum neuen Stammbaum an.
- **Grenzen:** eine leere Ansicht lässt sich nicht zusammenführen; eine Ansicht wird nur in einen anderen Stammbaum
  zusammengeführt.
- **Gilt seit:** App 1.0.0; Diese Ansicht zusammenführen mit… App 1.19.0

<!-- zdroj: app:src/merge/ui.ts:1421 newTreeNamePrompt, :1447 TreeManager.createTree · src/ui/merge-ui.ts:595 mergeViewInto · strings.ts merge.newTreeNamePrompt, merge.switchToNewTree, merge.mergeViewInto, merge.mergeViewEmpty, merge.mergeViewNoTarget, treeManager.mergeSourceTree, treeManager.selectTargetTree, treeManager.startMerge, importDialog.mergeExisting · git v1.19.0 (cf43bde) -->

<a id="A8.2"></a>
## A8.2 Abgleich der Personen

Die App sucht zu jeder Person aus der zusammengeführten Quelle eine Person im Zielstammbaum und gibt dem Paar einen
Übereinstimmungswert.

- Der Wert ergibt sich aus der Ähnlichkeit von Name, Geburtsdatum und Geburtsort, Sterbedatum und aus der
  Übereinstimmung von Eltern und Partnern. Das Geschlecht darf nicht widersprechen.
- **Hoch** ist eine Übereinstimmung ab 85, **Mittel** ab 55, sonst **Niedrig**. Eine Person ohne Übereinstimmung
  ist **Neu**.
- Der Assistent nennt bei einer Übereinstimmung den Grund (zum Beispiel „Name und Geburtsjahr“, „Kind einer
  abgeglichenen Person“).
- **Grenzen:** Platzhalterpersonen (leerer Platz für einen unbekannten Elternteil) werden nicht abgeglichen. Eine
  Person ohne Vornamen, die über eine verwandte Person abgeglichen wurde, geht immer zur Kontrolle.
- **Gilt seit:** App 1.0.0
- **Ab App 3.26.0:** Personen werden auch nach der Programm-ID abgeglichen (`_UID` = `UID`, `_FSFTID` = `EXID` mit der
  Adresse familysearch.org), mit dem Grund **Gleiche ID in der Datei**. Sicher ist eine solche Übereinstimmung nur bei
  ähnlichem Namen, einem Geschlecht nicht Mann gegen Frau, Geburtsjahren höchstens 3 auseinander und ohne abweichende
  globale ID; sonst ist sie ein Vorschlag mit einem Wert von höchstens 79. Datensatzkennung und `RIN` geben einer
  Übereinstimmung der Namen 25 Punkte dazu, nur bei Dateien desselben Programms. Familien werden nicht nach der ID
  abgeglichen ([S6.7](S6-tree-from-another-program.md#S6.7)).
- **Ab App 3.27.0:** eine ID des Programms (`_UID`, `UID`, `_FSFTID`, `AFN`, `EXID`), die im Stammbaum mehr
  als eine Person trägt, sagt nicht, welche es ist: Sie begründet allein keine Übereinstimmung, sie bietet sie nur an.
- **Ab App 3.32.0:** der Assistent zeigt den Wert als Prozent („N %“) und teilt die Paare in **Gleich** (Wert 80 und
  mehr) und **Vielleicht gleich** (niedrigerer Wert); eine Person ohne Übereinstimmung steht unter **Neu**
  ([A8.7](#A8.7)). Die Bezeichnungen **Hoch**, **Mittel** und **Niedrig** werden nicht mehr gezeigt.

<!-- zdroj: app:src/merge/matching.ts:318 findMatches, :781 (85 high, 55 medium), :790 calculateMatchScore, :618 UNKNOWN_NAME_MATCH_SCORE · strings.ts merge.highConfidence, merge.mediumConfidence, merge.lowConfidence, merge.matchReasons · 3.27.0: app:b5595ca1 src/merge/matching.ts idNamesSeveral (víc osob stromu se stejným silným ID → jen idCandidate), findDirectMatches · src/merge/id-match.ts STRONG_TAGS · CHANGELOG.cs.md 3.27.0 · spec 066 K3.2 -->

<a id="A8.3"></a>
## A8.3 Was der Mensch entscheidet

Der Assistent **Daten zusammenführen** zeigt Übereinstimmungen, Konflikte und neue Personen. Jede Übereinstimmung
lässt sich entscheiden.

| Auswahl | Was mit der Person aus der Quelle geschieht |
|---|---|
| **Bestätigen** | sie wird mit der Person des Stammbaums zusammengeführt |
| **Ablehnen** | sie wird als neue Person hinzugefügt |
| **Überspringen** | sie wird gar nicht übernommen |
| **Mit Vorhandener abgleichen** | sie wird mit einer von Hand gewählten Person zusammengeführt |

- Eine unentschiedene Übereinstimmung mit Wert 50 und mehr wird beim Zusammenführen von selbst bestätigt; eine
  unentschiedene unter 50 wird als neue Person hinzugefügt. Bleiben unentschiedene unsichere Übereinstimmungen, fragt
  die App vor dem Zusammenführen.
- **Nur vorhandene Personen aktualisieren (keine neuen hinzufügen)** ergänzt abgeglichene Personen und fügt keine
  neue Person hinzu.
- Eine Angabe, die beide Seiten unterschiedlich haben, ist ein Konflikt: **Vorhandenes behalten** oder **Aus dem
  Import übernehmen**; ein genaueres Datum oder ein vollständigerer Wert ist **vorgeschlagen**. Beim Paar werden so
  Beziehungsstatus, Datum und Ort der Hochzeit und Enddatum gelöst. Eine Angabe nur auf einer Seite wird ergänzt.
- Ein begonnenes Zusammenführen lässt sich beim Schließen **Für später speichern**; es kehrt als **Ausstehende
  Zusammenführungen** zurück.
- **Gilt seit:** App 1.0.0; Konflikte des Paares App 3.0.0; Überspringen und Nur vorhandene Personen aktualisieren
  App 1.19.0
- **Ab App 3.26.0:** eine unentschiedene Übereinstimmung wird erst ab dem Wert 80 von selbst bestätigt (im Assistenten
  vorab bestätigt, ✓). Eine Übereinstimmung von 50–79 wird nur angeboten (?) und ohne Entscheidung des Menschen als
  neue Person hinzugefügt: eine doppelte Person lässt sich später zusammenführen, ein falsches Zusammenführen lässt
  sich nicht rückgängig machen.
- **Ab App 3.32.0:** entschieden wird im Assistenten: Paare im Schritt **Wer ist wer** ([A8.7](#A8.7)), abweichende
  Angaben im Schritt **Wer hat recht** ([A8.9](#A8.9)). Die Auswahlen **Bestätigen**, **Ablehnen**, **Überspringen**
  und **Nur vorhandene Personen aktualisieren** werden ersetzt durch **Dieselbe Person**, **Neue Person**, **Nicht
  übernehmen** und den Umfang **d) Nur vorhandene Personen ergänzen**. Zusätzlich gilt:
  - ein Paar mit einem Wert unter 80 wird ohne Entscheidung des Menschen nicht verbunden; die übrigen unentschiedenen
    lassen sich auf einmal als neu hinzufügen oder auslassen ([A8.7](#A8.7)). Jede Person des Imports endet genau
    einmal: verbunden, hinzugefügt oder durch eine ausdrückliche Wahl ausgelassen;
  - der Vorschlag des Imports ist nur ein Rat: eine abweichende Angabe ohne Wahl des Menschen behält den Wert des
    Stammbaums;
  - ein Zusammenführen, bei dem etwas verloren ginge, wird nicht gespeichert: vor dem Schreiben werden die Summen der
    Personen, Paare, Verbindungen, Quellen, Fotos und Dateien und die Verweise geprüft; stimmen sie nicht, sagt es
    „Die Summen stimmen nicht: nichts wurde gespeichert.“ und was nicht stimmt;
  - eine Quelle des Imports mit einer ID, die der Stammbaum schon für eine andere Quelle hat, kommt als neue Quelle;
  - der Erfolg wird erst nach dem tatsächlichen Schreiben in den Speicher gemeldet.

<!-- zdroj: app:src/merge/executor.ts:78 AUTO_CONFIRM_SCORE, :110 detectPartnershipConflicts, :302 toAdd (updateOnly, skip, reject), :792 mergePersonData · src/merge/ui.ts:1408 pendingGate · strings.ts merge.confirm, merge.reject, merge.skip, merge.manualMatch, merge.updateOnlyLabel, merge.keepExisting, merge.useImport, merge.suggestedPrecise, merge.partnershipFields, merge.closeSave, merge.pendingMerges · git v3.0.0 (2218cea), v1.19.0 (cf43bde) -->

<a id="A8.4"></a>
## A8.4 Was mit dem Stammbaum übernommen wird

Außer Personen und Beziehungen werden auch die Listen zusammengeführt, die dem ganzen Stammbaum gehören.

- **Quellen:** dieselbe Quelle (dieselbe Signatur, sonst dieselbe Beschreibung) wird nicht verdoppelt; Zitationen
  gehen auf die behaltene Quelle über, und fehlende Abschrift und fehlendes Datum werden ergänzt.
- **Ab App 3.27.0:** Eine Quelle, die sich von der behaltenen nur in der Standard-Zuverlässigkeit unterscheidet, ist
  dieselbe Quelle und wird nicht verdoppelt; die übertragenen Zitationen behalten ihre Zuverlässigkeit
  ([A2.6.1](A2-loading-a-family-tree.md#A2.6.1)). Ein anderes Eintragsdatum oder andere Zeilen der Zitation ergeben
  weiter eine eigene Quelle.
- **Orte:** Koordinaten, Ortsdatensätze und andere Namen von Orten werden vereinheitlicht; wo beide Stammbäume
  denselben Ort kennen, gilt der Zielstammbaum.
- **Namensschreibweisen** ([A4.5](A4-surnames-and-families.md#A4.5)) werden vereinheitlicht; Gruppen, die sich
  überschneiden, werden verbunden.
- Der neue Stammbaum beginnt ohne Standardperson und -ansicht ([A6.1.1](A6-views.md#A6.1.1)).
- Die App sagt vor dem Zusammenführen, wie viele Probleme der Prüfung beide Stammbäume haben, und bietet nach dem
  Zusammenführen die Prüfung an, wenn das Zusammenführen neue gebracht hat ([A5](A5-tree-check.md)).
- **Grenzen:** den wiederholten Import der Datei einer Forschung in den Stammbaum der Forschung behandelt
  [S1](S1-connecting-app-and-research.md).
- **Gilt seit:** App 1.0.0; Meldung der Probleme der Prüfung App 1.19.0
- **Ab App 3.26.0:** Notizen von Person, Beziehung und Quelle werden beim Zusammenführen nicht verdoppelt. Vor dem
  Zusammenführen wird eine Sicherung des Stammbaums gespeichert ([S6.5](S6-tree-from-another-program.md#S6.5)). Nach
  dem Zusammenführen mit der Datei eines anderen Programms zeigt die App die Karte **Wie weiter**
  ([S6.4](S6-tree-from-another-program.md#S6.4)). Das manuelle Zusammenführen zweier Personen
  ([A5.6](A5-tree-check.md#A5.6)) verbindet die Notizen nicht.
- **Ab App 3.28.0:** gemeinsame Ereignisse ([A10.1](A10-shared-events.md#A10.1)) werden nicht verdoppelt: sie werden
  mit den Ereignissen des Zielstammbaums gepaart und übernehmen dessen gemeinsames Ereignis; ein eigenes Ereignis
  „Census“ wird mit einer Volkszählung gepaart. Die Zusammenfassung „Gemeinsame Ereignisse: n zusammengeführt“
  ([A10.6](A10-shared-events.md#A10.6)).
- **Ab App 3.32.0:**
  - die Sicherung **Vor dem Zusammenführen** nimmt der Assistent bei allen Eingängen und immer, auch bei
    ausgeschalteten automatischen Sicherungen ([A8.10](#A8.10), [S6.5](S6-tree-from-another-program.md#S6.5));
  - ein für später gespeichertes begonnenes Zusammenführen erkennt, dass sich der Stammbaum inzwischen geändert hat:
    die Vorschläge werden neu berechnet, entschiedene Paare bleiben ([A8.5](#A8.5));
  - die Karte **Wie weiter** erscheint nur nach einem Zusammenführen, das einen neuen Stammbaum anlegt; nach dem
    Zusammenführen in einen bestehenden Stammbaum ist die Datenprüfung im Schritt **Was passiert ist** (**Stammbaum
    prüfen**, [A8.11](#A8.11));
  - der Stammbaum bewahrt einen Eintrag seiner Zusammenführungen (Datenversion 26); ältere App-Versionen öffnen einen
    solchen Stammbaum nur schreibgeschützt.

<!-- zdroj: app:src/merge/executor.ts:211 executeMerge (mergeSourceCatalogs, places, mergePlaceRecords, mergePlaceAliases, addSurnameGroup, delete defaultPersonId/defaultView) · src/merge/ui.ts countNewMergeIssues · strings.ts merge.preValidationWarning, merge.newIssues · git v1.19.0 (00e5d38) · 3.27.0: app:dde0151a src/merge/executor.ts sourceKey bez quality, takeCitationQuality, remapCitations; app:5721b016 unionCitations · 3.28.0: app:80c2ffb9 src/merge/* (shareId, Census ↔ census), strings.ts merge.sharedJoined -->

<a id="A8.5"></a>
## A8.5 Der Assistent Stammbäume zusammenführen

Jeden Import eines Stammbaums in einen Stammbaum und jedes Zusammenführen zweier Stammbäume führt ein Assistent in sechs
Schritten. In den Stammbaum wird nichts geschrieben, bis das Schreiben im Schritt **Was passiert** bestätigt ist.

| Woher | Assistent | Bedienung |
|---|---|---|
| GEDCOM-Datei | **Stammbaum importieren** | **Import → GEDCOM importieren**; aus Stammbäume verwalten beginnt er mit der Auswahl **Neuer Stammbaum** |
| anderer Stammbaum | **Stammbäume zusammenführen** | **Struktur ändern…** › **Auswahl oder ganzen Stammbaum in einen anderen…** › **Der ganze Stammbaum** ([A14.5](A14-trees-and-structure.md#A14.5)); das Ziel ist der geöffnete Stammbaum, beim geöffneten Stammbaum ein anderer |
| Auswahl von Personen des Stammbaums (Stammlinie, Liste, Linie, Ansicht, von Hand) | **Stammbäume zusammenführen** | **Struktur ändern…** › **Auswahl oder ganzen Stammbaum in einen anderen…** › **Eine Auswahl…** |
| GEDCOM- oder Strom-Datei (JSON) in den geöffneten Stammbaum | **Stammbaum importieren** | **Struktur ändern…** › **Aus einer Datei in diesen Stammbaum…** |
| anderer Stammbaum in den geöffneten Stammbaum | **Stammbäume zusammenführen** | **Struktur ändern…** › **Aus einem anderen Stammbaum in diesen Stammbaum…** ([A14.5](A14-trees-and-structure.md#A14.5)) |
| GEDCOM-Datei oder Strom-Stammbaum (`.json`), auf dem Fenster der App abgelegt | **Stammbaum importieren** | die Datei auf das Fenster ziehen; Ziel ist der geöffnete Stammbaum ([A8.5.1](#A8.5.1)) |
| Datei, auf der Zeile eines Stammbaums in Stammbäume verwalten abgelegt, Zeile eines Stammbaums auf eine andere Zeile gezogen | **Stammbaum importieren** / **Stammbäume zusammenführen** | Stammbäume verwalten; Ziel ist der Stammbaum der Zeile, auf der abgelegt wurde ([A8.5.1](#A8.5.1)) |
| aus einem anderen Strom gesendete Änderungen | **Empfangene Änderungen** | Vorschau der empfangenen Änderungen → **Im Detail prüfen** |

- **Schritte:** **Was damit** ([A8.6](#A8.6)), **Wer ist wer** ([A8.7](#A8.7)), **Wen hinzufügen** ([A8.8](#A8.8)),
  **Wer hat recht** ([A8.9](#A8.9)), **Was passiert** ([A8.10](#A8.10)), **Was passiert ist** ([A8.11](#A8.11)). Ein
  Schritt, der für den gewählten Weg nichts entscheidet, wird übersprungen, und der Assistent sagt es bei ihm.
- Über den Schritten stehen laufende Zahlen der Personen des Imports: **Verbunden**, **Neu**, **Nicht übernommen** und
  **Zu entscheiden**; ihre Summe ist die Zahl der Personen des Imports.
- Auf einem breiteren Fenster (Tablet, Computer) nimmt der Assistent fast den ganzen Bildschirm ein, und die Schritte
  mit den Zahlen stehen in einer Leiste: die Zahlen in Worten und „= N Personen im Import“; unter 1100 px Breite
  haben die übrigen Schritte nur eine Zahl. Auf dem Telefon ist der Assistent unverändert.
- Ein von der Quelle aus gestarteter Assistent (der geöffnete Stammbaum wird in einen anderen zusammengeführt) nennt
  überall den Zielstammbaum: in der Überschrift, in der Statuszeile, in „… mit dem Stammbaum … vergleichen“ und in der
  Zeile der unvollendeten Zusammenführung.
- Der Vergleich eines großen Stammbaums zeigt den Fortschritt und eine Zeitschätzung. **Abbrechen** verliert nichts:
  die Wahl aus Schritt 1 bleibt, und der Vergleich lässt sich neu starten.
- Ein vor dem Schreiben geschlossener Assistent sagt „Noch ist nichts geschrieben.“, und die Entscheidungen lassen sich
  **Für später speichern**. Das gespeicherte Zusammenführen wartet unter Stammbäume verwalten bei seinem
  Zielstammbaum als **Unvollendete Zusammenführung** ([A14.1](A14-trees-and-structure.md#A14.1)). Hat sich der
  Zielstammbaum inzwischen geändert, sagt der Assistent es beim Fortsetzen; die Vorschläge werden neu berechnet,
  entschiedene Paare bleiben.
- Ein Zusammenführen, das beim letzten Mal nicht beendet wurde (geschlossenes Fenster, Absturz), meldet die App beim
  nächsten Öffnen: Stammbaum und Datei sind unverändert.
- **Grenzen:** eine GEDCOM-Datei in einen leeren Stammbaum wird weiter über **In Stammbaum einfügen** ohne Assistenten
  eingefügt ([A2](A2-loading-a-family-tree.md)). Das Zusammenführen zweier Personen eines Stammbaums ist etwas anderes
  ([A5.6](A5-tree-check.md#A5.6)).
- **Gilt seit:** App 3.32.0; früher legte das Zusammenführen immer einen neuen Stammbaum an ([A8.1](#A8.1)). Die
  früheren **Mit Stammbaum zusammenführen…** im ⋯ von Stammbäume verwalten und **Ansicht zusammenführen mit…** ersetzte
  in derselben Version **Struktur ändern…**.

<!-- zdroj: app:debf50cc (3.32.0) src/merge/ui.ts startMerge, repeatLine, resume, step6Env · src/merge/wizard-steps.ts stepInfo (přeskočené kroky) · src/merge/wizard-ui.ts title (titleImport, titleTrees, titleShare, titleCompare) · src/ui/import-export.ts openGedcomGuide (prázdný strom → showGedcomResultDialog), src/ui/merge-ui.ts (crashed, pendingMergeFound) · src/ui/share-ui.ts reviewChangePacketInMerge · strings.ts mergeWizard.steps, cntJoined, cntNew, cntSkipped, cntPending, cntTotal, comparing, comparingNote, stop, closeMsg, savedLater, resumeChanged, crashed, treeManager.mergeInto, menu.mergeViewInto, shareDiff.reviewDetail, merge.pendingMerges · CHANGELOG.cs.md 3.32.0 · dirigent:spec/134-bezpecne-slouceni-stromu §1–§13 · dirigent:test/vysledek-1123-scenare-app.md · app:52171573 (dotaz 10: větší okno, lišta kroků s počty, pod 1100 px číslem) · 6e36ad08 (V-N4: cílový strom v nadpisu, stavovém řádku, Porovnat, řádku rozpracovaného) · a9bc0b6b, f0c5a3fb (139: Sloučit do jiného stromu a Sloučit pohled do… nahrazené Změnit strukturu; mergeViewInto bez volajícího) · strings.ts structure.pendingRow -->

<a id="A8.5.1"></a>
### A8.5.1 Eine mit der Maus abgelegte Datei oder ein Stammbaum

Eine GEDCOM-Datei und ein Strom-Stammbaum (`.json`) lassen sich durch Ziehen in den Assistenten bringen: auf das
Fenster der App oder auf die Zeile eines Stammbaums in Stammbäume verwalten. Was geschieht, bestimmen die Datei und die
Stelle, an der sie abgelegt wird.

- **Auf dem Fenster der App:**
  - eine `.ged`-Datei öffnet den Assistenten **Stammbaum importieren** mit dem Ziel im geöffneten Stammbaum
    (**Neuer Stammbaum**, **Zu Stammbaum hinzufügen**, **Nur vergleichen**);
  - eine `.json`-Datei wird zuerst gelesen. Ein Stammbaum öffnet denselben Assistenten; ein verschlüsselter Stammbaum
    fragt vorher nach dem Passwort. Die Sicherung **Alle exportieren** und ein Änderungspaket aus einem anderen Strom
    gehen den Weg des JSON-Imports. Eine andere `.json`-Datei ist für eine Forschung, die Stapel annimmt, Material
    ([R11.4](R11-material-from-the-user.md#R11.4)); sonst sagt die App „{Datei} ist keine lesbare Stammbaumdatei
    (.json). Nichts wurde geändert.“;
  - mehrere Dateien auf einmal gehen bei einer Forschung, die Stapel annimmt, in einen Stapel; sonst entscheidet die
    erste Datei;
  - während des Ziehens wird eine einzelne Datei vom Typ JSON als Stammbaum genommen: die Aufschrift über dem Fenster
    sagt, dass sich der Assistent öffnet, kein Stapel;
  - eine andere Datei lehnt das Fenster ab: „Hier können nur GEDCOM-Dateien (.ged) und Strom-Stammbäume (.json)
    abgelegt werden.“ Der leere Bildschirm bietet „.ged- oder .json-Datei zum Öffnen hier ablegen“ an.
- **Auf der Zeile eines Stammbaums in Stammbäume verwalten:**
  - eine `.ged`- oder `.json`-Datei, auf einer Zeile abgelegt, öffnet den Assistenten mit der Auswahl **Zu Stammbaum
    hinzufügen** und dem Stammbaum dieser Zeile als Ziel. Der geöffnete Stammbaum bleibt geöffnet; das Schließen des
    Assistenten führt zurück zu Stammbäume verwalten;
  - die Zeile eines Stammbaums, mit der Maus auf eine andere Zeile gezogen, öffnet den Assistenten **Stammbäume
    zusammenführen**: der gezogene Stammbaum ist der Import, der Stammbaum darunter das Ziel;
  - die Zeile unter einer gezogenen Datei ist gestrichelt umrandet und sagt, was das Ablegen tut: „Ablegen: {Datei}
    zum Stammbaum {Stammbaum} hinzufügen“;
  - ein Stammbaum, in den gerade nicht geschrieben werden kann (gesperrt, live verfolgt, aus einer neueren
    App-Version), wird nicht zum Ziel: der Assistent bleibt bei der Auswahl **Zu Stammbaum hinzufügen** ohne gewähltes
    Ziel, und die Kachel dieses Stammbaums in Schritt 1 sagt, warum. Ein anderer Stammbaum wird nicht von selbst
    gewählt;
  - eine Zeile, die auf sich selbst abgelegt wird, Ablegen per Berührung oder in einer schreibgeschützt geöffneten App
    bewirkt nichts. Das Menü ⋯ der Zeile bleibt.
- **Grenzen:** ohne den Assistenten wird nichts geschrieben; das Schreiben gilt wie jedes Zusammenführen und lässt
  sich zurücknehmen ([A8.12](#A8.12)).
- **Bedienung:** eine Datei auf das Fenster oder auf eine Zeile von Stammbäume verwalten ziehen; die Zeile eines
  Stammbaums auf eine andere Zeile ziehen.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:b907d506 src/drop-route.ts dropRoute (guide-ged, json, batch, refuse), jsonDropKind (tree / šifrovaný, app-file: záloha Exportovat vše a balíček změn, other), dragLooksLikeJson · strings.ts onlyGedcom, dropHint, unreadableJson · app:73ee4625 src/tree-drop.ts treeRowDrop (sám na sebe, jen ke čtení nic), treeRowFileRoute, počáteční cíl (blokovaný strom nevybrán, důvod na dlaždici kroku 1, keepAdd) · src/ui/tree-management.ts (čárkovaný řádek, dotyk nic, ⋯ zůstává) · strings.ts mergeWizard.dropOnTree · dirigent:spec/134 K10.2, K10.3 -->

<a id="A8.6"></a>
## A8.6 Schritt 1: Was damit

Im ersten Schritt wird gewählt, was mit dem Import geschieht, in welchen Stammbaum, und was mit einer Person geschieht,
die schon im Stammbaum ist.

| Auswahl | Was passiert |
|---|---|
| **Neuer Stammbaum** | ein neuer Stammbaum mit den Personen des Imports entsteht; er wird nicht mit einer Forschung verbunden; bestehende Stammbäume bleiben unverändert |
| **Zu Stammbaum hinzufügen** | die Personen des Imports werden dem gewählten Stammbaum hinzugefügt (**In welchen Stammbaum**) |
| **Nur vergleichen** | dieselben Schritte werden durchlaufen, aber nichts wird geschrieben (Stammbaum, Sicherungen oder Dateien); die Liste lässt sich am Ende speichern |
| **Als JSON speichern** | **JSON herunterladen** lädt die umgewandelten Daten als `.json`-Datei herunter; in den Stammbaum wird nichts geschrieben |

- **Was mit einer Person geschieht, die schon im Stammbaum ist** (bei **Zu Stammbaum hinzufügen**):

  | Umfang | Bei verbundenen Personen | Neue Personen |
  |---|---|---|
  | **a) Nur fehlende Personen** | nichts ändert sich | werden hinzugefügt |
  | **b) Fehlende Personen und leere Angaben** | nur leere Angaben werden ergänzt | werden hinzugefügt |
  | **c) Angabe für Angabe entscheiden** | die Unterschiede werden in Schritt 4 gewählt ([A8.9](#A8.9)) | werden hinzugefügt |
  | **d) Nur vorhandene Personen ergänzen** | Angaben nach Schritt 4 | niemand Neues kommt hinzu |

- **Nicht übernommen wird:** was die App aus der Datei nicht übernimmt, ist mit Anzahl und Beispiel aufgezählt;
  **Liste speichern…** speichert die Liste. Nichts davon geht stillschweigend verloren.
- **Tauschen** kehrt bei zwei Stammbäumen um, was wohin hinzugefügt wird.
- Dieselbe Datei, erneut in den Stammbaum zusammengeführt, erkennt der Assistent und sagt, wie viele Personen neu
  sind; die beim letzten Mal verbundenen Personen werden nicht verdoppelt. So kommen nur die Personen hinzu, die beim
  letzten Mal ausgelassen wurden. Dasselbe gilt für einen Stammbaum: „Der Stammbaum Horákovi wurde schon hierher
  zusammengeführt (12. 11. 2026). Nur 5 Personen sind neu; 40 sind mit dieser früheren Zusammenführung verbunden und
  werden nicht verdoppelt.“
- **Regeln nach Programm:** eine GEDCOM-Datei aus einem Programm, für das eine Regel gespeichert ist, hat den Umfang
  und die Wahl aus Schritt 4 vorausgefüllt: „Vorausgefüllt nach der für Dateien aus {Programm} gespeicherten Regel
  (änderbar).“ ([A8.6.1](#A8.6.1))
- Eine Kopie eines Stammbaums und ein Stammbaum ohne Forschung haben in Schritt 1 die Beschreibung „Kopie des
  Stammbaums „{Name}“ · ohne Forschung“; bei einem Ziel ohne Forschung steht „{Stammbaum} hat keine Forschung: nach
  der Zusammenführung wird nichts gesendet.“ ([S1.10](S1-connecting-app-and-research.md#S1.10)).
- **Grenzen:** Ziel kann weder ein gesperrter Stammbaum sein (Entsperren unter Stammbäume verwalten) noch ein
  Stammbaum aus einer neueren App-Version. Ein Stammbaum, auf dem gerade das Live-Verfolgen der Forschung läuft
  (◎ **Agenten im Stammbaum folgen**), ist schreibgeschützt; der Assistent bietet bei ihm **Folgen ausschalten und
  hierher zusammenführen** an: Vor dem Schreiben wird eine Sicherung gespeichert, das Senden an die Forschung pausiert,
  und die Änderungen gehen erst nach der Wahl im letzten Schritt dorthin. Eine Kopie des Stammbaums der Forschung und
  ein Stammbaum ohne Forschung können Ziel sein, auch wenn anderswo live verfolgt wird. Aus einem schreibgeschützt
  geöffneten Stammbaum geht der Import nur als **Neuer Stammbaum**.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step1-what.ts (mode, scope, notTaken, swap, repeat), src/merge/ui.ts repeatLine (isRepeatOf podle otisku souboru, importedBefore), src/merge/plan.ts:715–717 (d: updateOnly, a: joinedDetails none, b: empty) · strings.ts mergeWizard.modeNew, modeNewDesc, modeAdd, modeAddDesc, modeCompare, modeCompareDesc, modeJson, modeJsonDesc, btnJson, whichTree, existingWhat, scopeA–scopeD, scopeADesc–scopeDDesc, notTaken, notTakenNote, saveList, swap, repeat, blockLive, blockLiveAction, blockLocked, blockReadOnly, blockNewer · app:166fbffd, 5c4bcc0c (1123-134 bod 10: blokuje jen strom s běžícím sledováním, kopie stromu výzkumu jde; nabídka Vypnout sledování a sloučit sem) src/live-follow-block.ts · CHANGELOG.cs.md 3.32.0 („tentýž soubor sloučený znovu přidá jen osoby, které se minule vynechaly“) · spec 134 K0.7 · app:7b967fd8 strings.ts mergeWizard.repeatTree (134 N1 doplněk) · bcb2a0fa strings.ts research.copyOf, structure.mergeNoResearch · app:02165311 strings.ts mergeWizard.repeat, repeatTree (datum dřívějšího sloučení v závorce) · app:fcddfcab (Jen porovnat: otisk všech stromů, záloh a souborů před a po; writePlan/applyPlan plán porovnání odmítnou) src/merge/write.ts · app:ad0ea45a strings.ts mergeWizard.prefilledFrom -->

<a id="A8.6.1"></a>
### A8.6.1 Regeln für die Dateien eines Programms

Der Umfang aus Schritt 1 und die Regeln aus Schritt 4 lassen sich für GEDCOM-Dateien aus demselben Programm merken.
Die nächste Datei aus diesem Programm beginnt den Assistenten damit; sie lassen sich ändern.

- **Speichern:** in Schritt 5 steht über der Schaltfläche zum Schreiben das Kontrollkästchen „Für Dateien aus
  {Programm} merken: Umfang c), Mein Stammbaum gilt“ (mit Regeln nach Art der Angabe „…, mit Ausnahmen nach Art der
  Angabe“). Darunter: „Beim nächsten Mal wird Schritt 1 damit vorausgefüllt (änderbar). Gespeicherte Regeln stehen
  unter Einstellungen → Daten und Datenschutz.“ Das Kästchen ist standardmäßig nicht angekreuzt, auch bei einem
  vorausgefüllten Schritt 1.
- **Wann gespeichert wird:** erst nach dem Schreiben; bei **Nur vergleichen** nach **Liste speichern…**. Ein
  geschlossener Assistent speichert nichts.
- **Was gespeichert wird:** Umfang und Regeln für das ganze Zusammenführen und nach Art der Angabe. Regeln für eine
  Person oder einen Wert werden nicht gespeichert: sie gehören zu den Personen eines Stammbaums. Für ein Programm gilt
  eine Regel; eine neuere ersetzt die ältere.
- **Wo:** in den Einstellungen dieses Geräts, nicht im Stammbaum. **Einstellungen** → **Daten und Datenschutz** →
  **Gespeicherte Importregeln** („Füllen Schritt 1 des Import-Assistenten für Dateien aus demselben Programm vor.“)
  hat eine Zeile für jedes Programm (Umfang · Regeln) mit **Entfernen**. Ohne gespeicherte Regel wird die Gruppe
  nicht angezeigt.
- **Vorausfüllen:** Schritt 1 der nächsten Datei aus demselben Programm hat Umfang und Regeln aus der gespeicherten
  Regel und unter dem Umfang den Satz „Vorausgefüllt nach der für Dateien aus {Programm} gespeicherten Regel
  (änderbar).“ Ein unvollendetes Zusammenführen behält seine Wahl.
- **Grenzen:** nur eine GEDCOM-Datei, die das Programm nennt, das sie erstellt hat (Kopf der Datei, `HEAD.SOUR`), und
  nur bei **Zu Stammbaum hinzufügen** und **Nur vergleichen**. Stammbaum, Auswahl und `.json`-Datei nennen kein
  Programm; **Neuer Stammbaum** hat weder Umfang noch Regeln.
- **Bedienung:** Schritt 5 des Assistenten; **Einstellungen** → **Daten und Datenschutz** → **Gespeicherte
  Importregeln**.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:ad0ea45a src/merge/saved-rules.ts sourceProgram (jen ged s program), canRemember (add | compare, ne json), ruleFromChoices (scope, rules.all, rules.kind; ne osoba ani hodnota), applySavedRule, rememberLabel, savedRuleDetail · src/merge/steps/step5-plan.ts:549 (políčko nad tlačítkem, rememberNote) · strings.ts mergeWizard.rememberRules, rememberNote, rememberKinds, prefilledFrom, settings.rulesSetting, rulesSettingHint, rulesRowDetail, rulesRemove, groupData · dirigent:spec/134 K10.4 -->

<a id="A8.7"></a>
## A8.7 Schritt 2: Wer ist wer

Schritt 2 zeigt die Personen des Imports in drei Gruppen, und über jedes Paar entscheidet der Mensch. Eine Verbindung,
die geschrieben wird, ist immer sichtbar und lässt sich aufheben.

- **Gruppen:** **Vielleicht gleich** (Wert unter 80), **Gleich** (Wert 80 und mehr, vorab verbunden) und **Neu** (ohne
  Übereinstimmung). Wert und Gründe der Übereinstimmung beschreibt [A8.2](#A8.2).
- **Paar:** die Person des Imports und die Person des Stammbaums nebeneinander in den Zeilen **Name**, **Geburt**,
  **Tod**, **Eltern**, **Partner**, **Kinder** und **Belege**, mit **Warum ja:** und **Was dagegen spricht:**.
- **Entscheidung:** **Dieselbe Person** (D), **Neue Person** (N), **Andere Person…** (A, mit einer anderen Person des
  Stammbaums verbinden) und **Nicht übernehmen** (X); ↑ ↓ geht zum nächsten Paar.
- Eine Entscheidung berechnet die Vorschläge bei Verwandten neu; entschiedene Paare ändern sich nicht.
- **Wiederholtes Zusammenführen:** Wird dieselbe Quelle ein zweites Mal zusammengeführt, erkennt der Assistent die
  Personen, die ein früheres, nicht zurückgenommenes Zusammenführen gebracht oder verbunden hat. Sie stehen unter
  **Gleich** mit dem Grund „Schon früher aus dieser Quelle zusammengeführt“, und nichts wird verdoppelt.
- **Warum ja** nennt nur, was beide Einträge hergeben: „Exakter Name und Geburtsdatum“ nur bei gleichem Geburtsdatum
  auf beiden Seiten, bei Übereinstimmung nur des Jahres „Name und Geburtsjahr“, sonst „Exakter Name“.
- Die **Übrigen unentschiedenen** lassen sich auf einmal erledigen: „Übrige N unentschieden:“ **Als neu hinzufügen
  (N)** (der Assistent warnt, dass das Personen verdoppeln kann, die schon im Stammbaum sind) oder **Nicht übernehmen
  (N)**. Paare mit denselben Eltern, demselben Kind oder demselben Partner lässt die Sammelentscheidung aus; unter den
  Schaltflächen steht „2 Paare mit denselben Eltern, demselben Kind oder demselben Partner sind einzeln zu
  entscheiden.“ Bleiben nur solche, bleibt nur dieser Satz. Solange ein unentschiedenes Paar bleibt, wird Schritt 3
  nicht freigegeben.
- **Auf einem breiteren Fenster:** über dem Paar ist eine Zeile mit Bedienelementen (‹ Liste ausblenden · „Paar i von
  n“ · Gruppe · ↑ ↓ · Entscheidung), die Kandidaten des Stammbaums stehen in Zeilen („2 Kandidaten im Stammbaum
  Horákovi“), und die Tabelle des Paars rollt selbst mit festem Kopf (Spalte „Import · {Datei}“). Die Verwandten
  stehen zeilenweise, von den Einträgen die ersten drei und „N weitere ▸“ / **Einklappen**. Der Rest der
  Unentschiedenen steht in der Fußzeile der Liste; die Liste lässt sich zu einer schmalen Leiste einklappen
  (**Paarliste ausblenden** / **Paarliste einblenden**). Auf dem Telefon ist der Schritt unverändert.
- **Wo sich der Schritt öffnet:** wartet in **Vielleicht gleich** ein unentschiedenes Paar, öffnet sich Schritt 2
  dort, beim ersten davon (auch nach der Rückkehr aus Schritt 1 oder aus einem späteren Schritt und bei einem
  unvollendeten Zusammenführen); sonst bei der zuletzt gezeigten Gruppe. Eine innerhalb des Schritts von Hand
  umgeschaltete Gruppe bleibt.
- **Zu entscheiden N** in den Zahlen (auf dem Telefon die Zeile der Zahlen) und „· N zu entscheiden“ unter Schritt 2
  führen zum ersten unentschiedenen Paar in **Vielleicht gleich** (auf dem Telefon zu seinem Kopf). Bleiben nur
  unverbundene Gruppen, führen sie zu Schritt 3. Bei 0 und nach dem Schreiben führen sie nirgendwohin.
- **Partner einer verbundenen Person:** ist eine Person des Imports verbunden und sind es auch ihre gemeinsamen
  Kinder, wird ihr Partner aus dem Import in **Vielleicht gleich** mit dem anderen Elternteil dieser Kinder im
  Stammbaum angeboten, mit dem Grund „Partner einer verbundenen Person, gemeinsame Kinder“, auch bei anderem
  Nachnamen (Geburtsname × Name nach der Heirat). Bedingungen: das Geschlecht unterscheidet sich nicht, und ein
  Vorname ist gleich (Initiale oder Kurzform des Namens nur bei ähnlichem Nachnamen oder wenn es der Nachname des
  Partners nach der Heirat ist). Der Wert liegt unter der Grenze 80, es entscheidet also der Mensch. Ein schwächeres
  Paar einer anderen Person ohne solchen Beleg (Namensvetterin, Schwägerin) tritt zurück. Ein in Schritt 2
  bestätigter oder von Hand gewählter Ehemann bringt so auch die Ehefrau.
- Ein in Schritt 4 mit **Dieselbe Person** verbundenes Paar ([A8.9](#A8.9)) hat in Schritt 2 den Grund „dieselbe
  Person, gewählt in Schritt 4“.
- **Grenzen:** bei **Neuer Stammbaum** wird der Schritt übersprungen: alle Personen sind neu.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step2-who.ts pairRows (AUTO_CONFIRM_SCORE → same, jinak maybe), decisions, recalc, rest · src/merge/executor.ts AUTO_CONFIRM_SCORE = 80 · src/merge/wizard-steps.ts stepInfo (step2 skip newTree, person-pending blokuje) · strings.ts mergeWizard.grpMaybe, grpSame, grpNew, rows, whyYes, whyNo, decSame, decNew, decOther, decSkip, decKeys, keysHint, recalc, restLabel, restAdd, restSkip, restAddWarn, sameNote · spec 134 §4 · app:1046e99b (1123-134 N1, N3) strings.ts merge.matchReasons.merged_before, exact_name, exact_name_gender_birthdate, name_gender_birthyear · app:878f29b7, f6dc2c4f strings.ts mergeWizard.restOneByOne (134 N2: stejní rodiče, dítě, partner) · 0af3e450, 642b2d05 (dotaz 10: řádek ovládání, candidatesIn, importCol, recordsMore, recordsLess, pairsHide, pairsShow, zbytek v patě) · app:e1c98f45 (K10.5: otevření na první nerozhodnuté dvojici Možná stejní, jinak skupina naposled; K rozhodnutí N a · N k rozhodnutí jako tlačítka, jen nenapojené → krok 3, při 0 a po zápisu nic) strings.ts mergeWizard.cntPending, subPending · app:fd66ae63 (K10.6: partner spojené osoby se společnými spojenými dětmi, pod AUTO_CONFIRM_SCORE, pohlaví, jedno křestní jméno, iniciála či zkrácený tvar jen při podobném příjmení nebo příjmení po sňatku; slabší dvojice ustoupí; manžel potvrzený v kroku 2 přivede manželku) strings.ts merge.matchReasons.partner_shared_children · app:d6333eab strings.ts mergeWizard.joinedInStep4 · dirigent:spec/134 K10.5, K10.6 -->

<a id="A8.8"></a>
## A8.8 Schritt 3: Wen hinzufügen

Schritt 3 wählt, welche neuen Personen hinzugefügt werden. Eine neue Person, die nichts mit dem Stammbaum verbindet,
wird ohne Entscheidung nicht hinzugefügt.

- **Wen die Auswahl nimmt:** **Alle neuen**, **Nur verbundene, bis N Schritte** (nur Personen, die mit dem Stammbaum
  über höchstens N Verwandte verbunden sind), **Vorfahren von…**, **Nachkommen von…** (mit der Zahl der
  Generationen), **Familie / Nachname…** und **Von Hand**. Die Auswahl von Vorfahren, Nachkommen oder einer Familie
  wählt die übrigen Neuen ab.
- **Verbundene neue:** eine Liste der neuen Personen mit dem Weg zum Stammbaum („knüpft über … an“), Suche,
  **Filter** (**Nachname**, **Jahre**, **Ort**, **Mit Quelle**, **Verbindend**, **Lebende**), **Lebende auslassen (N)**
  und **Vorschau** des Zweigs.
- Das Abwählen einer Person, über die weitere an den Stammbaum anknüpfen, fragt: **Auch sie auslassen**, **Als
  unverbunden behalten**, **… behalten** oder **Als „?“ behalten** (an ihrer Stelle bleibt ein verbindendes „?“ ohne
  Angaben, und die Verwandten bleiben verbunden).
- **Unverbundene Gruppen:** Personen ohne Weg zu den Personen des Stammbaums, nach Familien. Jede Gruppe braucht eine
  Entscheidung: **Mit Person verbinden…** (eine Person der Gruppe ist Elternteil, Kind oder Partner einer Person des
  Stammbaums), **Unverbunden hinzufügen**, **Eigener Stammbaum** (nach dem Schreiben ein eigener Stammbaum) oder
  **Nicht übernehmen**. Eine unentschiedene Gruppe hält das Schreiben auf.
- **Grenzen:** eine Verbindung, die einem Kind einen dritten Elternteil gäbe, wird nicht geschrieben. Der Umfang
  **d)** fügt niemand Neues hinzu und überspringt den Schritt. Bei **Neuer Stammbaum** nimmt der Schritt alle Personen.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step3-whom.ts, step3-model.ts, src/merge/plan-select.ts (scope d → 'scope', :392), src/merge/wizard-steps.ts (step3 skip allNew, group-pending) · strings.ts mergeWizard.vAll, vLinked, vAnc, vDesc, vRod, vManual, variants, pickAnc, pickDesc, pickRod, generations, tabLinked, tabGroups, linksVia, skipLiving, s3Tools, fSurname, fYears, fPlace, fSource, fLinking, fLiving, previewBtn, branchPreview, unlinkTitle, unlinkAll, unlinkLoose, unlinkKeep, unlinkQ, unlinkQDesc, groupsLead, gConnect, gLoose, gOwn, gSkip, relParent, relChild, relPartner, connectThird, groupsWhy · spec 134 §5, §6 -->

<a id="A8.9"></a>
## A8.9 Schritt 4: Wer hat recht

Schritt 4 entscheidet die Angaben, die verbundene Personen unterschiedlich haben. Ohne Wahl des Menschen gilt der
Stammbaum.

- **Regeln:** **Mein Stammbaum gilt** (Standard), **Der Import gilt**, **Beides behalten** (der Wert des Imports wird
  daneben gespeichert, „Der Import nennt: …“), **Genauer, wenn nicht widersprüchlich** und **Einzeln entscheiden**.
- Eine Regel lässt sich dem ganzen Zusammenführen geben, einer Art der Angabe (**Name**, **Geburt**, **Tod**, **Orte**,
  **Ereignisse**, **Notizen**, **Fotos**, **Geschlecht**, **Heirat**), einer Person und einem einzelnen Wert. Die
  engere Regel gilt: alles → Art der Angabe → Person → Wert. Bei jeder Regel ist zu sehen, wie viele Unterschiede
  bleiben, sich ändern oder daneben gespeichert werden.
- **Geschützte Angaben:** eine Angabe im Stammbaum, markiert als „belegt“, „bestätigt“ oder „aus der Forschung“,
  ändert eine Sammelwahl nicht; sie lässt sich nur einzeln ändern. Das Überschreiben einer belegten Angabe fragt
  **Belegte Angabe überschreiben?**; nach dem Schreiben ist die Angabe „Aus Stammbaum“, und der Beleg bleibt als
  Quelle bei der Person.
- **Widersprüche bei Beziehungen** (andere Eltern, zweiter Partner, andere Heirat, dritter Elternteil, Schleife
  Vorfahr–Nachkomme) entscheidet keine Sammelwahl: **Meins behalten**, **Aus dem Import** oder **Beides** wird bei
  jeder Zeile gewählt. Eine Schleife wird nie geschrieben.
- **Kinder eines Paars:** Kinder, deren Eltern denselben Widerspruch haben (dritter Elternteil, andere Eltern), sind
  eine Zeile mit Anzahl („dritter Elternteil · 6 Kinder“, die Namen der ersten drei und „+3“) und werden einmal für
  alle entschieden. Die Zahl der Widersprüche im Schritt zählt Zeilen.
- **Dieselbe Person:** bei einem dritten Elternteil oder zweiten Partner, der für den Stammbaum neu ist, gibt es
  zusätzlich die Wahl **Dieselbe Person**, wenn auf der anderen Seite eine Person des Stammbaums steht, die der Import
  nicht kennt. Sie verbindet beide Personen wie eine Entscheidung aus Schritt 2 (ein von Hand gewähltes Paar, das mit
  dem Zusammenführen gespeichert wird wie jedes andere). Widersprüche, die dadurch wegfallen, verschwinden, und die
  Zahlen werden neu berechnet. Unter den Widersprüchen steht „Als dieselbe Person verbunden: {Person des Imports} =
  {Person des Stammbaums}“ mit **Rückgängig** (stellt die Entscheidung wieder her, die vorher galt). Nicht angeboten
  wird sie bei anderem Geschlecht, bei einer Person des Stammbaums, die schon mit jemand anderem verbunden ist, bei
  einer Verbindung, die eine Schleife ergäbe, und beim verbindenden „?“.
- **Grenzen:** beim Umfang **a)** und **b)** wird der Schritt übersprungen; gibt es Widersprüche bei Beziehungen,
  zeigt er nur sie. Bei **Neuer Stammbaum** wird er immer übersprungen.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step4-rules.ts (relOnly, s4SkippedTitle, protected), src/merge/plan.ts:438 relationConflicts, :534 (scope a), :542 (scope b jen prázdné) · src/merge/wizard-steps.ts step4 (newTree, scope a/b skip) · strings.ts mergeWizard.ruleAll, ruleOrder, rMine, rImport, rBoth, rPrecise, rEach, rDefault, importSays, kinds, protectedLine, protKinds, protTitle, protText, protAfter, relConf, relKinds, relAlways, keepMine, fromImport, both, loopNever, step4Skipped, s4SkippedTitle, relOnly · spec 134 §7, K0.3 · app:d6333eab (K10.7, K10.8: děti jednoho páru se stejným rozporem jeden řádek, počet řádků; Stejná osoba u třetího rodiče či druhého partnera, spojení jako rozhodnutí kroku 2, Zpět; ne jiné pohlaví, osoba spojená s jiným, smyčka, „?“) strings.ts mergeWizard.relChildren, samePerson, samePersonTitle, joinedSame, undoSame · dirigent:spec/134 K10.7, K10.8 -->

<a id="A8.10"></a>
## A8.10 Schritt 5: Was passiert, und das Schreiben

Schritt 5 zeigt die ganze Liste der Änderungen nach Gruppen. Geschrieben wird erst mit seiner Schaltfläche und nur
das, was die Liste zeigt.

- **Liste:** **Neu**, **Verbunden**, **Geänderte Angaben**, **Ergänzte Angaben**, **Verbundene Quellen**, **Paare und
  Verbindungen**, **Quellen**, **Orte**, **Fotos und Dateien**, **Nicht übernommen** (bei jeder Person warum: Schritt
  und Wahl) und **Wird nicht übernommen**. Ein Eintrag lässt sich abwählen. **Liste speichern…** speichert sie als
  Text (`.txt`) und als Daten (`.json`); der Text endet mit den Zahlen in Worten („Verbunden 40 · Neu 5 · Nicht
  übernommen 0 · Zu entscheiden 0 · = 45 Personen im Import“).
- **Ergänzte Angaben** (nur wenn es welche gibt): leere Angaben verbundener Personen, die das Schreiben ergänzt,
  zeilenweise Person · Angabe (E-Mail, weitere Namensformen, Ereignisse, Quellen, eine offene Frage…).
- **Verbundene Quellen:** eine Quelle des Quellstammbaums wird nur mit derselben Quelle des Zielstammbaums verbunden
  (dieselbe Nummer der Forschung, Zitation oder Titel, Archiv und Ort): „1 Quelle mit einer vorhandenen verbunden“.
  Die Gruppe **Quellen** führt nur neue auf. Die Quellen des Quellstammbaums werden untereinander nicht verbunden:
  zwei Einträge einer Matrik, die sich nur in der Quellennummer der Forschung unterscheiden, bleiben zwei. Das
  Ergebnis hat so dieselben Quellen unabhängig von der Richtung (**Tauschen**).
- **Die Summen stimmen überall:** neue Paare und geänderte Angaben sind in Schritt 5, in Schritt 6, im Eintrag der
  Zusammenführung und im Dialog des Zurücknehmens dieselbe Zahl wie das, was geschrieben wird. Ein verbindendes „?“
  ohne Kinder und der Umfang **d)** fügen kein Paar hinzu und melden keines; zwei Personen des Imports, die mit einer
  Person verbunden sind, ändern eine Angabe einmal (auch in Schritt 4).
- Ein anderes Foto mit gleichem Namen und gleicher Größe steht unter **Geänderte Angaben** als „Foto: photo (3222) →
  ein anderes Foto mit gleichem Namen und gleicher Größe“ (auch in Schritt 4, im Verlauf der Zusammenführungen, beim
  Zurücknehmen und in der gespeicherten Liste).
- **Wohin schreiben:** **In … schreiben** oder **In neuen Stammbaum** (Kopie des Zielstammbaums mit dem Import; der
  Zielstammbaum bleibt unverändert).
- **Sicherung:** vor dem Schreiben in den Stammbaum entsteht die Sicherung **Vor dem Zusammenführen**, immer, auch
  bei ausgeschalteten automatischen Sicherungen. Sie bleibt, solange sich das Zusammenführen zurücknehmen lässt; die
  Rotation der Sicherungen löscht sie nicht. Wäre für sie kein Platz, fragt der Assistent (**Beide behalten (über dem
  Limit)** oder **Älteste andere Sicherung löschen**). Ohne Sicherung wird nichts geschrieben: „Die Sicherung ist
  fehlgeschlagen, daher wurde nichts geschrieben.“
- **Sicherheiten:** hat sich der Zielstammbaum inzwischen geändert, wird die Liste neu berechnet, und nichts wird
  blind geschrieben. Vor dem Speichern werden Summen und Verweise geprüft; stimmen sie nicht: „Die Summen stimmen
  nicht: nichts wurde gespeichert.“ Das Fenster während des Schreibens zu schließen schadet nicht: das Schreiben wird
  beendet, oder es wird nichts geschrieben.
- Das Schreiben ist ein Schritt **Rückgängig**.
- **Regeln merken:** bei einer GEDCOM-Datei, die ihr Programm nennt, steht über der Schaltfläche „Für Dateien aus
  {Programm} merken: …“ ([A8.6.1](#A8.6.1)).
- **Grenzen:** bei **Nur vergleichen** ist die Hauptschaltfläche **Liste speichern…**: sie speichert die Liste und
  schließt den Assistenten. Geschrieben wird nichts: Stammbaum, Sicherungen und Dateien bleiben, wie sie waren, und
  einen Vergleichsplan lässt die App nicht zum Schreiben durch. Die Prüfung zählt die durch den Umfang **b)**
  ergänzten leeren Angaben nicht zu **Geänderte Angaben**.
- **Bedienung:** die Schaltfläche „N Personen hinzufügen, M Angaben ändern“, mit ergänzten Angaben „…, F ergänzen“,
  beim neuen Stammbaum „Stammbaum mit N Personen anlegen“.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step5-plan.ts (skupiny, retentionAsk, targetChanged), src/merge/write.ts (backupBeforeMerge keepFor, storageFull, badTotals, one undo step strings.undo.mergeTrees) · src/data.ts:2047 backupBeforeMerge (bez ohledu na automatické zálohy, keepFor mimo rotaci) · src/snapshots.ts planRetention (keepFor se nesmaže) · strings.ts mergeWizard.gNew, gJoined, gFields, gLinks, gSources, gPlaces, gMedia, gSkipped, gNotTaken, skipWhy, whereTo, writeInto, writeNew, writeNewDesc, backupLine, savePlan, btnWrite, btnNewTree, backupFailed, retentionAsk, keepBoth, dropOldest, targetChanged, replanned, writingSafe, badTotals · dirigent:test/vysledek-1123-scenare-app.md N1 (doplněná prázdná pole se v kroku 5 nepočítají) · spec 134 §8, K0.2, K0.4, K0.5 · app:235afcd5 (134 N4, S-N2, S-N1: gFills, btnWrite …, doplnit F, jeden počet párů a údajů) · 834ceab8 (134 S-N3: gSourcesJoined, sourcesJoinedSum, prameny zdroje se mezi sebou nespojují) · a2567f81 strings.ts mergeWizard.otherPhoto · app:fcddfcab (K10.1) src/merge/write.ts (plán compare se nezapíše), src/merge/plan-export.ts exportPlan (počty slovy cntTotal), src/merge/ui.ts savePlan (.txt a .json), src/merge/wizard-ui.ts primary (compare: savePlan, finishCompare) · app:ad0ea45a step5-plan.ts merge-s5-remember -->

<a id="A8.11"></a>
## A8.11 Schritt 6: Was passiert ist, und der Verlauf der Zusammenführungen

Nach dem Schreiben sagt Schritt 6, was passiert ist, und das Zusammenführen bleibt im Stammbaum als Eintrag, zu dem
sich später zurückkehren lässt.

- **Was passiert ist:** „In den Stammbaum … geschrieben“ und „Die Summen stimmen: N Personen im Import = verbunden
  + neu + nicht übernommen“; die Sicherung **Vor dem Zusammenführen** ist unter Sicherungen.
- **Aktionen:** **Im Stammbaum zeigen**, **Als Personenliste speichern** ([A11](A11-lists-of-people.md)),
  **Stammbaum prüfen** ([A5](A5-tree-check.md)) und **Zusammenführung zurücknehmen…** ([A8.12](#A8.12)).
- Nach dem Zusammenführen der Datei eines anderen Programms in einen bestehenden Stammbaum erscheint die Karte **Wie
  weiter** nicht; die Datenprüfung ist hier. Ein neuer Stammbaum aus der Datei eines anderen Programms bekommt die
  Karte ([S6.4](S6-tree-from-another-program.md#S6.4)).
- Schritt 6 und der Verlauf der Zusammenführungen führen auch **Ergänzte Angaben** und die Zahl der verbundenen
  Quellen auf, mit denselben Zahlen wie Schritt 5.
- **Verlauf der Zusammenführungen:** jedes Zusammenführen in den Stammbaum mit Datum, Quelle, Zahlen (neu, verbunden,
  Angaben) und dem Stand **gilt**, **teilweise zurückgenommen** oder **zurückgenommen**. Beim Zusammenführen **Liste
  öffnen** und **Zurücknehmen…**; im Fenster auch **Sicherungen…** und **Änderungsverlauf…**. Den ganzen Stammbaum
  stellen Sicherungen her; hier lässt sich nur zurücknehmen, was ein Zusammenführen brachte.
- **Grenzen:** den Eintrag der Zusammenführungen trägt der Stammbaum ab Datenversion 26; ältere App-Versionen öffnen
  einen solchen Stammbaum nur schreibgeschützt. Zusammenführungen aus der Zeit vor App 3.32.0 stehen nicht im Verlauf.
- **Bedienung:** Aktionen des Stammbaums → **Verlauf der Zusammenführungen…** (nur bei einem Stammbaum, der
  Zusammenführungen hat); Stammbäume verwalten, ⋯ beim Stammbaum → **Verlauf der Zusammenführungen…**.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:debf50cc src/merge/steps/step6-done.ts (notes inHistory, noNextCard), src/merge/ui.ts step6Env (noNextCard = !newTree && gedcom) · src/ui/tree-actions.ts:199 menuHistory (jen se záznamy) · src/ui/merge-history-ui.ts · strings.ts mergeWizard.doneTitle, doneTotals, doneBackup, showInTree, saveAsList, checkTree, undoMerge, inHistory, noNextCard, menuHistory, histTitle, histLead, stValid, stPartial, stUndone, histCounts, openList, undoEllipsis, histBackups, histChanges · CHANGELOG.cs.md 3.32.0 (datová verze 26) · spec 134 §9 · app:235afcd5, 834ceab8 (doplněné údaje a spojené prameny v kroku 6 a historii) -->

<a id="A8.12"></a>
## A8.12 Zurücknehmen einer Zusammenführung

**Zusammenführung zurücknehmen** nimmt nur das zurück, was ein Zusammenführen brachte. Arbeit, die nach dem
Zusammenführen getan wurde, verschwindet nicht.

- **Was zurückgenommen wird:** **Entfernt**: die neuen Personen der Zusammenführung mit ihren Paaren, Quellen, Orten
  und Dateien; **Wiederhergestellt**: geänderte Angaben, auf den Wert vor der Zusammenführung; **Im Stammbaum
  wiederhergestellt**: seine Paare, Personen, Quellen und Dateien, an die die Zusammenführung anknüpfte, wie vor ihr;
  **Verbindungen aufgehoben**: die Personen des Stammbaums bleiben, nur ohne Angaben aus dem Import.
- **Bleibt, weil seither geändert:** eine nach dem Zusammenführen bearbeitete Person oder Angabe, eine bestätigte
  Angabe, eine Person mit einem neuen Verwandten, etwas, worauf eine spätere Zusammenführung aufbaut, und etwas, das
  noch von etwas zitiert wird, das bleibt. Bei jedem Eintrag lässt sich **Behalten** oder **Zurücknehmen** wählen.
- Ein Bild, das die Zusammenführung ersetzt hat, bringt nur die Sicherung **Vor dem Zusammenführen** zurück. Der
  Assistent zeigt auch den Unterschied zum Wiederherstellen der Sicherung: die Sicherung würde auch alles andere
  zurücksetzen, was seit der Zusammenführung im Stammbaum geschah.
- **Alles zurücknehmen** oder **Nur einige wählen…** (zurückgenommen wird nur, was angekreuzt ist). Eine teilweise
  zurückgenommene Zusammenführung lässt sich weiter zurücknehmen. Das Zurücknehmen legt die Sicherung **Vor dem
  Rückgängigmachen der Zusammenführung** an, immer, auch bei ausgeschalteten automatischen Sicherungen; die Rotation
  löscht sie nicht, solange sich die Zusammenführung wiederherstellen lässt. Das Zurücknehmen steht im
  Änderungsverlauf und lässt sich rückgängig machen (**Zurücknahme rückgängig machen**).
- **Grenzen:** ein gesperrter Stammbaum lässt sich nach dem Entsperren unter Stammbäume verwalten zurücknehmen; ein
  schreibgeschützter, sobald er bearbeitet werden kann. Baut eine spätere Zusammenführung auf der Zusammenführung auf,
  sagt der Assistent es. Das Zurücknehmen einer Zusammenführung, die schon in der Forschung ist, beschreibt
  [A8.13](#A8.13).
- **Bedienung:** Schritt 6 → **Zusammenführung zurücknehmen…**; **Verlauf der Zusammenführungen…** →
  **Zurücknehmen…**; die Schaltfläche „N Personen entfernen“.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:debf50cc src/merge/undo-plan.ts, src/merge/undo-view.ts, src/ui/merge-history-ui.ts (zápis se zálohou write.ts writeUndo, AuditLogManager, toast s redo) · strings.ts mergeWizard.undoTitle, undoLead, uRemove, uRestore, uUnjoin, uRemoveDesc, uRestoreDesc, uUnjoinDesc, uKeepHead, uEdited, uProven, uRelative, uLaterMerge, uUsed, uPicture, segKeep, segUndo, vsBackup, pickSome, pickAll, pickLead, btnUndo, builtOn, partlyDone, lockedUndo, undoReadOnly, undoNothing, undone, redo · spec 134 §10 · app:235afcd5 strings.ts mergeWizard.uTree, uTreeDesc · e2a6d712 strings.ts backups pre-merge-undo „Před odvoláním sloučení“ (134 N5, keepFor) -->

<a id="A8.13"></a>
## A8.13 Zusammenführen in einen Stammbaum mit Forschung

In einen mit einer Forschung verbundenen Stammbaum wird das Zusammenführen in der App geschrieben, und in die
Forschung geht nichts von selbst. Über das Senden entscheidet der Mensch in Schritt 6.

- Die Verbindung des Stammbaums mit der Forschung bleibt. Neue Personen und Verbindungen warten in der App („nicht an
  die Forschung gesendet · N Personen“), bis **An die Forschung senden…** oder **Vorerst nur in der App lassen**
  gewählt wird.
- In die Forschung gehen die Angaben als „Aus Stammbaum (ungeprüft)“, nie als belegt. Die Personen der Forschung
  behalten ihre Nummern, den Stand ihrer Angaben und ihre Zitate. Die Forschung bekommt die Änderungen über die
  Brücke; kein Agent wird gestartet. Arbeitet der Agent gerade, wartet das Senden bis zum Ende seines Schritts.
- Eine Forschung älterer Version kennt das Senden nach einem Zusammenführen nicht: der ganze Stammbaum wird über
  **Was gesendet wird** gesendet ([S1](S1-connecting-app-and-research.md)).
- **Was gesendet wird:** der einleitende Satz hat dieselben Zahlen wie die Liste darunter: „An die Forschung
  Horákovi: 5 neue Personen, 2 weitere geänderte Personen, 3 Paare, 4 Quellen.“ Ein verbindendes „?“ ist keine neue
  Person; ein neues Paar wird bei seinen Partnern gezählt, und **Paare** sind nur die eigenen Änderungen des Paars.
  Ohne genaue Liste bleibt der Satz mit dem, was die Zusammenführung brachte.
- **Zurücknehmen vor dem Senden:** die Forschung bekommt nichts. **Nach dem Senden:** die Forschung löscht Personen
  nicht von selbst. Das Zurücknehmen in der App entfernt auch die Personen, denen das Senden eine Nummer der Forschung
  gab (die Nummer ist keine Bearbeitung). Der Dialog sagt „Die Zusammenführung wurde am {Datum} an die Forschung
  gesendet, die Forschung hat ihre Personen also schon. Das Zurücknehmen in der App entfernt sie dort nicht.“ und „In
  der App erfolgt das Zurücknehmen sofort. In der Forschung ist ein Schritt im Terminal der Forschung nötig:“ mit dem
  Befehl `strom sync undo I0042` und **Kopieren**; mit bekannter Nummer der Unterlage auch **In der Forschung
  zurücknehmen**, sonst `I…` und wo die Nummer zu finden ist (`strom input list`). Die Meldung „Zusammenführung
  zurückgenommen…“ bietet **In der Forschung zurücknehmen** an. Sonst verweist der Dialog auf die Hilfe **In der App
  entfernte Person** ([S2.6](S2-edits-from-the-app.md#S2.6)). Bis dahin bringt die Forschung mit ihrer nächsten
  Version die Personen zurück, und die App bietet sie zum Entfernen an.
- **Grenzen:**
  - ein **Neuer Stammbaum** aus einem Import wird nicht mit einer Forschung verbunden; das Schreiben in einen neuen
    Stammbaum (Kopie des Ziels mit dem Import) ist eine Kopie ohne Forschung
    ([S1.10](S1-connecting-app-and-research.md#S1.10));
  - eine Kopie eines Stammbaums aus der Forschung und ein Stammbaum ohne Forschung senden nach der Zusammenführung
    nichts;
  - ist die Quelle mit einer Forschung verbunden und das Ziel nicht, geht die Verbindung nicht auf das Ziel über; der
    Assistent bietet **Tauschen** an;
  - sind beide Stammbäume verbunden, gehen weder Verbindung noch Nummern der Quelle über, und die Personen der Quelle
    sind in der Forschung des Ziels neu;
  - sind dieselben Personen auch in einem anderen mit einer Forschung verbundenen Stammbaum, weist der Assistent
    darauf hin.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:debf50cc src/merge/ui.ts step6Research (mergeHold, unsentMerges), src/merge/research-hold.ts, research-marks.ts, same-people.ts · strings.ts mergeWizard.researchKept, resStep5, resPending, sendRes, keepLocal, notSent, resSendLead, resSendNote, resSent, resUndoStep, resUndoHelp, resUndoHelpLink, resComesBack, copy, resAgent, resOld, resNewTree, resSwap, resSwapBtn, resTwo, resSamePeople, modeNewDesc · src/help/topics.ts:38 HELP_LINKS.mergeUndoResearch = 'S2.6' · undoResearchStep (jen záznam I\d+) · research:src/commands/sync.ts:627 sync undo · spec 134 K9.1–K9.6 · app:7a317a1e resSendLeadList (134 V-N5) · 20fb4782 (134 V-N3: číslo výzkumu není úprava, resSent, resUndoStep) · fd794063, 023879dd src/ui/research-undo-step.ts (Kopírovat, undoStepInput, undoStepRun, hlášení odvolání) · f3c66503 (zápis do nového stromu = kopie bez výzkumu) -->
