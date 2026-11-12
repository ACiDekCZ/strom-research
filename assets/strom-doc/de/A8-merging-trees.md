<a id="A8"></a>
# A8 Zusammenführen von Stammbäumen

Wie die Strom-App zwei Stammbäume zusammenführt: eine GEDCOM-Datei mit einem Stammbaum, zwei Stammbäume oder eine
Ansicht mit einem Stammbaum. Beschrieben wird die App 3.21.2; Änderungen aus einer neueren Version tragen deren Nummer. Das Zusammenführen einer doppelten Person
innerhalb eines Stammbaums ist etwas anderes ([A5.6](A5-tree-check.md#A5.6)).

<a id="A8.1"></a>
## A8.1 Zusammenführen legt immer einen neuen Stammbaum an

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

<!-- zdroj: app:src/merge/executor.ts:211 executeMerge (mergeSourceCatalogs, places, mergePlaceRecords, mergePlaceAliases, addSurnameGroup, delete defaultPersonId/defaultView) · src/merge/ui.ts countNewMergeIssues · strings.ts merge.preValidationWarning, merge.newIssues · git v1.19.0 (00e5d38) · 3.27.0: app:dde0151a src/merge/executor.ts sourceKey bez quality, takeCitationQuality, remapCitations; app:5721b016 unionCitations -->
