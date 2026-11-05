<a id="R1"></a>
# R1 Die Forschung im Überblick

Wie die Forschung als Ganzes arbeitet, auf einer Seite. Jeder Abschnitt führt zu einem Kapitel mit den genauen
Regeln. Beschrieben werden die Forschung 1.25.2 und die Strom-App 3.21.2.

<a id="R1.1"></a>
## R1.1 Die Forschung ist eine Aufzeichnung, kein Gespräch

Die Forschung ist ein Ordner auf dem Computer. Ein KI-Agent (zum Beispiel Claude Code oder Codex) schreibt in ihn
nur mit dem Befehl `strom`: Personen, Ereignisse, Quellen, durchgeführte Suchen, Hypothesen und Widersprüche. Was
nicht in der Forschung erfasst ist, geht mit dem Ende der Sitzung verloren, darum schreibt der Agent laufend.

- **Grenzen:** nichts wird gelöscht. Eine falsche Angabe wird mit Begründung zurückgezogen, eine geänderte Angabe
  wird mit Begründung berichtigt, und in der Historie bleibt auch die ursprüngliche Form.
- **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:assets/method/core.md „Nothing is deleted“, „Write as you go“ -->

<a id="R1.2"></a>
## R1.2 Woran der Agent arbeitet

Was die Forschung untersucht, bestimmen die **Linien**: die Vorfahren einer Person, die Nachkommen einer Person oder
eine Frage. Aus den Linien entstehen Aufgaben, und die offenen Aufgaben bilden eine **Warteschlange**. Der Agent nimmt
immer die erste Aufgabe der Warteschlange. Arbeit an Personen, die keine Linie erreicht, kommt erst nach der Arbeit
an den Linien.

- Aufgaben haben Arten, in der Reihenfolge, in der sie bei sonst gleichem Platz in der Warteschlange kommen:
  Unterlagen vom Benutzer, wo die Einträge liegen, Beleg einer Verbindung, Prüfung, Ergänzung einer Person,
  Anfrage an ein Archiv, Erzählung.
- **Erst der Stammbaum, dann darüber hinaus:** eine in den Einträgen gefundene Familie, die keine belegte Verbindung
  mit dem Stammbaum verbindet, wird nicht weiter erforscht, bis die Verbindung belegt ist
  ([R10.4](R10-people-and-hypotheses.md#R10.4)).
- Was die Forschung mit Unterlagen vom Benutzer tut: [R11](R11-material-from-the-user.md).
- Ausführlich: [R2](R2-lines-and-queue.md).

<!-- zdroj: research:src/core/queue.ts LEVEL_ORDER · assets/method/core.md „The tree first, then above it“ -->

<a id="R1.3"></a>
## R1.3 Wie der Agent arbeitet: Sitzungen

Der Agent arbeitet in **Sitzungen**. Eine Sitzung ist eine Aufgabe mit einem Zeitlimit. Am Ende schreibt der Agent
auf, was erledigt ist und was als Nächstes kommen soll, und schließt die Sitzung. Arbeitet der Agent allein, folgt
Sitzung auf Sitzung, solange es Arbeit gibt und die Bedingung es erlaubt, die der Mensch gesetzt hat (zum Beispiel
das Tempo des wöchentlichen Limits des Abonnements).

- Die Forschung kann auch nur ein **Strom-Archiv** sein, an dem kein Agent arbeitet:
  [R7.8](R7-when-the-agent-works.md#R7.8).
- Ausführlich: [R7](R7-when-the-agent-works.md).

<!-- zdroj: research:src/commands/run.ts · assets/method/core.md „The time is strom's to say“ -->

<a id="R1.4"></a>
## R1.4 Wie die Forschung Beweise gewichtet

Der Agent arbeitet nach dem **Genealogical Proof Standard** (GPS): gründliche Suche, Zitation jeder Angabe, Analyse
und Vergleich der Beweise, Auflösung von Widersprüchen und eine niedergeschriebene Schlussfolgerung, die eine weitere
forschende Person versteht.

- Jede Angabe hat einen Grad der Sicherheit: **Hinweis**, **Möglich**, **Wahrscheinlich**, **Belegt**. Ein Stammbaum
  und die Familienüberlieferung sind immer nur ein Hinweis, ein Register dient zum Finden des Eintrags. Ausführlich:
  [R3](R3-verification-and-citation.md).
- Ein Namensvetter ist nicht die gesuchte Person. Eine Person bestimmen Jahr, Ort, Haus, Beruf, Ehemann oder Ehefrau
  und die Eltern. Zwei Einträge mit demselben Namen und anderen Eltern sind zwei Personen. Identifizierung von
  Personen, ihre Namen und konkurrierende Hypothesen: [R10](R10-people-and-hypotheses.md).
- Eine erfolglose Suche ist ein Ergebnis. Es wird erfasst, was genau durchsucht wurde, damit dasselbe Buch nicht
  zweimal durchsucht wird.
- Wenn die Einträge voneinander abweichen, wählt der Agent nicht stillschweigend: er erfasst einen **Widerspruch**.
  Ausführlich: [R5](R5-conflicts.md).
- Ein Ort bekommt eine Lage auf der Karte nur, wenn sicher ist, welcher Ort es ist. Ausführlich: [R4](R4-places.md).

<!-- zdroj: research:assets/method/core.md (úvod, „Certainty is explicit“, „A namesake is not your person“, „Negative results are results“) -->

<a id="R1.5"></a>
## R1.5 Was der Mensch entscheidet

Manche Entscheidungen gehören nur dem Menschen. Die Forschung fragt danach in **Wartet auf Bearbeitung**, und der
Agent antwortet nicht an Stelle des Menschen.

- Was auf den Menschen wartet (Briefe, Bilder zum Herunterladen, Fragen zu Orten, Widersprüche, Erzählungen zur
  Freigabe) und wo es erledigt wird: [R6](R6-awaiting-action.md).
- Die Entscheidung des Menschen gilt. Der Agent ändert sie nur auf Grund einer neuen Quelle: [R5.4](R5-conflicts.md#R5.4).
- Eine vom Menschen eingetragene Lage eines Ortes wird nicht geändert: [R4.3](R4-places.md#R4.3).
- Einstellungen, die ändern, was der Agent darf, bestätigt der Mensch (zum Beispiel die Bedingung für die Arbeit des
  Agenten allein, [R7](R7-when-the-agent-works.md)).

<!-- zdroj: research:assets/method/waiting.md · src/core/conflicts.ts againAllowed · src/core/placeid.ts personsHand · src/core/config.ts run.gate -->

<a id="R1.6"></a>
## R1.6 Die Forschung und die Strom-App

Die Strom-App zeigt die Forschung als Stammbaum: Personen, Angaben mit ihrem Grad der Sicherheit, Quellen und
Widersprüche, und wenn der Agent arbeitet, auch die laufende Arbeit. Änderungen in der App gehen zurück an die
Forschung. Die Änderung einer Angabe, die ein Eintrag belegt, überschreibt sie nicht, sondern wird zu einem
Widerspruch ([R5](R5-conflicts.md)). Das Zusammenspiel von App und Forschung beschreibt Teil S.

<!-- zdroj: research:src/core/sync.ts:1-19 · app:strings.ts research.knows -->

<a id="R1.7"></a>
## R1.7 Wie die Forschung Scans liest

Die meisten Angaben stammen aus Scans von Kirchenbüchern und anderen Büchern. Die Forschung bestimmt zuerst das Buch,
die Bilder lädt sie nur über den Downloader des Archivs und nur die nötigen. Das Buch blättern **Leser** durch
(`strom read`): eigene Agenten, jeder mit einem Stapel Bilder. Einen Eintrag, der zitiert wird, liest der Hauptagent
selbst aus einem Ausschnitt in voller Auflösung und erfasst ihn mit Ausschnitt und Abschrift. Das Lesen durch ein
KI-Modell ist nicht hundertprozentig; wichtige Angaben soll idealerweise noch ein Mensch prüfen.

- Ausführlich, mit dem Ablauf Schritt für Schritt: [R8](R8-reading-scans.md).
- **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:assets/method/reading.md · assets/method/locate.md · assets/method/recording.md · src/commands/read.ts:183-200 -->
