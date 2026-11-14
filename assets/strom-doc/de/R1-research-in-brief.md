<a id="R1"></a>
# R1 Die Forschung im Überblick

Wie die Forschung als Ganzes arbeitet, auf einer Seite. Jeder Abschnitt führt zu einem Kapitel mit den genauen
Regeln. Beschrieben werden die Forschung 1.25.2 und die Strom-App 3.21.2. Änderungen aus einer neueren Version tragen
deren Nummer.

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
- Wo mit dem Agenten gesprochen wird (Terminal, App Claude oder ChatGPT) und was strom wo überwacht: [R12](R12-where-the-agent-works.md).

<!-- zdroj: research:src/commands/run.ts · assets/method/core.md „The time is strom's to say“ -->

<a id="R1.4"></a>
## R1.4 Wie die Forschung Beweise gewichtet

Der Agent arbeitet nach dem **Genealogical Proof Standard** (GPS): gründliche Suche, Zitation jeder Angabe, Analyse
und Vergleich der Beweise, Auflösung von Widersprüchen und eine niedergeschriebene Schlussfolgerung, die eine weitere
forschende Person versteht.

- Jede Angabe hat einen Grad der Sicherheit: **Hinweis**, **Möglich**, **Wahrscheinlich**, **Belegt**. Ein Stammbaum,
  die Familienüberlieferung und ein Register sind immer nur ein Hinweis: das Register führt zum Eintrag, belegt erst
  der Eintrag selbst (das Register prüft der Code ab Forschung 1.28.0). Ausführlich:
  [R3](R3-verification-and-citation.md).
- Ein Namensvetter ist nicht die gesuchte Person. Eine Person bestimmen Jahr, Ort, Haus, Beruf, Ehemann oder Ehefrau
  und die Eltern. Zwei Einträge mit demselben Namen und anderen Eltern sind zwei Personen. Identifizierung von
  Personen, ihre Namen und konkurrierende Hypothesen: [R10](R10-people-and-hypotheses.md).
- Eine erfolglose Suche ist ein Ergebnis. Es wird erfasst, was genau durchsucht wurde, damit dasselbe Buch nicht
  zweimal durchsucht wird.
- Wenn die Einträge voneinander abweichen, wählt der Agent nicht stillschweigend: er erfasst einen **Widerspruch**.
  Ausführlich: [R5](R5-conflicts.md).
- Ein Ort bekommt eine Lage auf der Karte nur, wenn sicher ist, welcher Ort es ist. Ausführlich: [R4](R4-places.md).

<!-- zdroj: research:assets/method/core.md (úvod, „Certainty is explicit“, „A namesake is not your person“, „Negative results are results“) · src/core/evidence.ts isWeak (rejstřík od 1.28.0) -->

<a id="R1.5"></a>
## R1.5 Was der Mensch entscheidet

Manche Entscheidungen gehören nur dem Menschen. Die Forschung fragt danach in **Wartet auf Bearbeitung**, und der
Agent antwortet nicht an Stelle des Menschen.

- Was auf den Menschen wartet (Briefe, Bilder zum Herunterladen, Fragen zu Orten, Widersprüche, Hypothesen,
  Erzählungen zur Freigabe) und wo es erledigt wird: [R6](R6-awaiting-action.md).
- Eine Hypothese entscheidet der Mensch, und der Agent schlägt die Entscheidung vor (ab Forschung 1.28.0):
  [R10.3.1](R10-people-and-hypotheses.md#R10.3.1). Ab Forschung 1.29.0 ist das eine Wahl der Forschung: ohne
  gespeicherte Wahl entscheidet der Agent (**Die KI entscheidet**), **Der Mensch entscheidet** wählt der Mensch:
  [R10.3.2](R10-people-and-hypotheses.md#R10.3.2).
- Die Entscheidung des Menschen gilt. Der Agent ändert sie nur auf Grund einer neuen Quelle: [R5.4](R5-conflicts.md#R5.4).
- Eine vom Menschen eingetragene Lage eines Ortes wird nicht geändert: [R4.3](R4-places.md#R4.3).
- Einstellungen, die ändern, was der Agent darf, bestätigt der Mensch (zum Beispiel die Bedingung für die Arbeit des
  Agenten allein, [R7](R7-when-the-agent-works.md)).

<!-- zdroj: research:assets/method/waiting.md · src/core/conflicts.ts againAllowed · src/core/placeid.ts personsHand · src/core/config.ts run.gate · src/commands/analysis.ts hypothesis decide (person, od 1.28.0) -->

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

<a id="R1.8"></a>
## R1.8 So funktioniert Strom: `strom doc`

Diese Dokumentation liegt der Forschung bei und lässt sich auch ohne Internet lesen. `strom doc` gibt den Inhalt aus,
`strom doc R10.1` eine Regel samt den Regeln darunter und `strom doc <Wörter>` sucht in den Überschriften, im
Begriffsverzeichnis und im Text.

- **Grenzen:**
  - die Nummer lässt sich auch in Kleinbuchstaben oder mit Bindestrich schreiben (`r4.3`, `R4-3`). Eine unbekannte
    Nummer endet mit einem Fehler, der die nächsten Nummern nennt;
  - die Suche achtet weder auf diakritische Zeichen noch auf Groß- und Kleinschreibung. Sie zeigt höchstens 10 Regeln,
    die besten zuerst, und wie viele es noch gibt (`--limit` eine andere Anzahl);
  - der Text ist in der Sprache der Forschung (`--lang` eine andere). Eine Sprache, in die die Dokumentation nicht
    übersetzt ist, bekommt Englisch mit einem Hinweis;
  - bei der Regel steht ein Link auf dieselbe Regel auf stromapp.info;
  - funktioniert auch außerhalb der Forschung und im Strom-Archiv und schreibt nichts.
- **Nur Methodik:** auf die Frage des Menschen, wie oder warum Strom etwas tut, antwortet der Agent nach `strom doc`:
  mit der Nummer der Regel und mit dem Link, den `strom doc` ausgibt.
- **Bedienung:** Terminal: `strom doc`, `strom doc R2.3`, `strom doc hypotéza --lang en`, `--json`. Die Hilfe für den
  Menschen (`strom help --human`) endet mit einem Verweis auf `strom doc`. Die App hat dieselbe Dokumentation in
  **So funktioniert Strom** ([A1.7](A1-the-app-in-brief.md#A1.7)).
- **Gilt seit:** Forschung 1.28.0

<!-- zdroj: research:src/commands/doc.ts (SEARCH_ROWS=10, --limit, ui.docs.fallback, docUrl) · src/core/doc.ts · assets/strom-doc/ (PIN) · src/agents/files.ts:188 "answer from `strom doc`" · src/cli/help.ts (help --human, poslední řádek) · CHANGELOG.cs.md 1.28.0 · commity 314ab218, 4acfb170 -->

<a id="R1.9"></a>
## R1.9 Fragen an die Daten des Baums: `strom query`

Eine Frage an die Daten des Baums (wie viele Müller es in der Familie gibt, wer im Haus Nr. 12 lebte, wer in einem
Jahrhundert an einem Ort geboren wurde) beantwortet ein Aufruf von `strom query`. Er gibt eine Zeile für jede Angabe
einer Person aus: wer es ist und wie die Person mit der Ausgangsperson verwandt ist, was die Angabe sagt, wo, wann,
wie sicher sie ist und auf welcher Quelle sie beruht. Der Befehl liest nur: er prüft nichts und schreibt nichts.

- **Grenzen:**
  - eine Angabe einer Familie (eine Ehe) hat eine Zeile für jeden Partner. Zurückgezogene Personen und Angaben nie,
    widerlegte Angaben nur mit `--status disproven`;
  - die Beziehung zur Ausgangsperson (Einstellung `main.person`, sonst `--of P…`) steht in Worten in der Sprache der
    Forschung, mit der Seite und der Generation, zum Beispiel **Großvater, väterlicherseits (G3)**. G1 ist die
    Ausgangsperson, G2 ihre Eltern. Ohne Ausgangsperson, oder wenn sie zurückgezogen ist, lehnt `strom query` ab und
    sagt, wie es weitergeht (`strom config set main.person P…` oder `--of P…`);
  - wessen Angaben (`--kin`): `ancestors` die Ausgangsperson und die direkte Linie; `blood` (Standard) die Vorfahren
    und alle ihre Nachkommen, auch die Seitenzweige; `family` die Blutsverwandten und ihre Partner; `all` der ganze
    Baum;
  - die Filter gelten alle zugleich: `--kind` (Art der Angabe: OCCU, RESI, BIRT …; eine unbekannte Art wird mit der
    Liste der gültigen abgelehnt), `--occupation`, `--value` (wiederholt: irgendeines der Wörter), `--place`,
    `--house` (12 findet auch č. 12 und Nr. 12), `--years` (1750-1850 oder ein Jahr), `--surname` (auch weitere Formen
    des Nachnamens: Horáková), `--source` (S… oder Wörter des Titels), `--status`;
  - ein Wort wird am Anfang eines Wortes im Wert, in der Bezeichnung oder in der Ursache der Angabe gesucht, nicht in
    der Notiz, ohne Rücksicht auf diakritische Zeichen. Ein Beruf wird auch in tschechischen, deutschen, lateinischen
    und polnischen Formen gesucht (mlynar findet auch Müller und molitor) und in den eigenen Formen der Forschung ([R1.9.2](#R1.9.2)); der Kopf
    der Ausgabe nennt die Formen. Ein Beruf, den keine Liste kennt, wird nur in der geschriebenen Form gesucht, und
    die Ausgabe sagt es.
    `--exact` sucht nur das Wort selbst;
  - `--count` gibt nur die Zahlen der Personen und Angaben aus; `--by generation|kin|place|decade|surname` teilt sie
    in Gruppen (nach Generation haben die Seitenzweige eine eigene Gruppe), ohne `--count` die Zeilen nach Gruppen. Die
    Zeilen kommen seitenweise (`--limit`, höchstens 100, `--page`); `--json` gibt bei der Person auch den Link, der sie
    in der Strom-App öffnet;
  - Personen, die das gesuchte Wort nur anderswo haben (Name, Notiz), werden gesondert gezählt, mit dem Befehl
    `strom find`, der sie findet. Wird nichts gefunden, bietet die Ausgabe `strom find` und einen weiteren Kreis
    `--kin` an.
- **Nur Methodik:** auf eine Frage an die Daten antwortet der Agent mit einem Aufruf von `strom query`, nicht mit einer
  Suche Person für Person. Er nennt eine Person mit Namen und der ID in Klammern (Jan Horák (P0012)), die Beziehung
  ganz, wie `strom query` sie gab, nie gekürzt, und eine Quelle mit ihrem Titel und der S… in Klammern. Bei jeder
  Angabe sagt er, wie sicher sie ist: als Tatsache nur eine belegte; eine wahrscheinliche oder mögliche Angabe und ein
  Hinweis sind nicht belegt. Eine Zeile von `strom query` reicht nicht, um zu sagen, wessen Eintrag es ist und wer wer
  ist, noch um eine Angabe zu prüfen oder zu schreiben: das geht weiter aus den Quellen und nach der Methodik
  ([R3](R3-verification-and-citation.md), [R10](R10-people-and-hypotheses.md)).
- **Bedienung:** Terminal: `strom query`, zum Beispiel `strom query --occupation mlynar --count --by generation`;
  `strom app --person P…` öffnet die Strom-App bei der Person (eine App vor 3.21 öffnet den Baum). `strom find` sucht
  weiter ein Wort in jedem Text der Forschung, und seine Hilfe verweist auf `strom query`. `strom facts …` führt
  nichts aus: es sagt **„strom facts“ heißt jetzt „strom query“ (dieselben Optionen)** und den ganzen Aufruf mit
  `strom query`.
- **Gilt seit:** Forschung 1.32.0

<!-- zdroj: research:src/commands/query.ts (popis, volby, KIN_SETS, FACT_GROUPS, LIST_PAGE_MAX=100, elsewhereOf, tries) · src/core/query.ts (hlavička, kinSet, SHOWN_STATUSES, ASKED_STATUSES) · src/core/occupations.ts · src/commands/analysis.ts help find („the facts recorded of people … strom query“) · src/cli/execute.ts RENAMED, renamedCommand · src/agents/files.ts AGENTS.md „Questions over the data“ · src/commands/start.ts app --person · cs.json ui.query.*, ui.error.command.renamed · test/cli/query.test.ts · CHANGELOG.cs.md 1.32.0 · spec 081 K1–K7 · query bez hlavní osoby / odvolaná: src/commands/query.ts ofPerson (query.no-main, query.retracted), cs.json ui.error.query.*, commit 6cdab11b -->

<a id="R1.9.1"></a>
### R1.9.1 Erzählungen: `strom query --story`

- `--story <Wort>` listet die Personen und Paare auf, in deren Erzählung das Wort steht: eine Zeile je Erzählung, mit
  dem Satz, in dem das Wort steht, und mit den Quellen, auf die sich der Satz stützt.
- **Grenzen:**
  - das Wort wird wie bei `--value` gesucht (ohne Rücksicht auf diakritische Zeichen, mit den Formen eines Berufs,
    `--exact`); wiederholt: irgendeines;
  - ein langer Satz wird um das Wort gekürzt. Eine Erzählung, die auf Freigabe wartet (auch eine neue Version einer
    freigegebenen), hat **Entwurf**;
  - die Quellen des Satzes sind die, die der Satz nennt, sonst die Quellen der Angaben der Erzählung aus den Jahren,
    die der Satz erwähnt. Lassen sie sich nicht bestimmen, zeigt die Zeile **Quellen der ganzen Erzählung**;
  - die Erzählung eines Paares hat eine Zeile für jeden Partner. Die übrigen Filter wählen die Personen (die mit
    einer passenden Angabe); `--by` nur `generation`, `kin`, `surname`.
- **Nur Methodik:** eine Erzählung erzählt die Angaben nach. Der Agent antwortet aus den Angaben und Quellen; eine
  Erzählung zeigt nur, wo zu suchen ist.
- **Gilt seit:** Forschung 1.32.0

<!-- zdroj: research:src/commands/query.ts (--story, --by place|decade odmítnuto, storyText, storyData) · src/core/query.ts findStories (hlavička: sourcesNamed, storySources, basis sentence|story) · cs.json ui.query.story.* · src/agents/files.ts „A story retells the facts“ · CHANGELOG.cs.md 1.32.0 -->

<a id="R1.9.2"></a>
### R1.9.2 Eigene Formen von Berufen: `strom occupation`

Die eingebaute Liste der Berufe (83 Berufe, jeder in tschechischen, deutschen, lateinischen und polnischen Formen)
lässt sich um eigene Formen der Forschung ergänzen: eine andere Sprache, eine alte Schreibweise oder ein Beruf, den
die Liste nicht kennt. `strom query --occupation` ([R1.9](#R1.9)) findet dann alle Formen als einen Beruf, auch mit
`--exact`, `--count` und `--story` ([R1.9.1](#R1.9.1)).

- **Grenzen:**
  - `strom occupation add` nimmt mindestens zwei Formen eines Berufs. Eine Form, die die Liste kennt, nimmt die
    anderen zu sich (eine weitere Form des Müllers); Formen, die die Liste nicht kennt, sind ein neuer Beruf. Eine
    Form ist in der Sprache der Forschung, eine andere Sprache wird mit ihrem Code vor der Form geschrieben:
    `de:Ölschläger`. Sind die Formen schon ein Beruf, wird nichts geschrieben;
  - jede Gruppe hält fest, wer sie hinzugefügt hat (der Mensch von Hand oder der Agent bei der Forschung), den Tag
    und mit `--source` die Quelle, in der die Form vorkam;
  - der Mensch fügt Formen in seinem eigenen Terminal hinzu und nimmt sie heraus, ohne Agent, und darf jede eigene
    Form der Forschung herausnehmen. Der Agent nimmt nur eine Form heraus, die ein Agent hinzugefügt hat; was der
    Mensch hinzugefügt hat, ändert er nie und nimmt es nie heraus. Die eingebaute Liste bleibt, wie sie ist;
  - `strom query` sagt, wenn der gesuchte Beruf in keiner Liste steht (gesucht wird nur die geschriebene Form), und
    nennt den Befehl, der seine Formen hinzufügt: „{Wort}: nicht in der Liste der Berufe, nur diese Form gesucht;
    weitere Formen fügt hinzu: strom occupation add {Wort} <Form> [la:<Form> …]“;
  - die eigene Liste ist die Datei der Forschung `quality/occupations.json` unter dem Siegel
    ([R14](R14-seal-and-integrity.md)). Lässt sie sich nicht lesen, suchen `strom query` und `strom occupation list`
    nur in der eingebauten Liste und sagen es in einer Zeile mit `strom repair`; `add` und `remove` schreiben nichts
    darüber.
- **Nur Methodik:** einen Beruf, den `strom query` in keiner Liste findet, oder eine Form aus einer Quelle, die die
  Liste nicht hat, fügt der Agent mit `strom occupation add … --source S…` samt den anderen Formen hinzu und sagt es
  dem Nutzer.
- **Bedienung:** Terminal: `strom occupation add olejník de:Ölschläger`; `strom occupation list` (die Gruppen der
  Forschung: wer, wann, Quellen), `strom occupation list mlynar` (die Formen eines Berufs, eigene mit `*`),
  `strom occupation list --all` (alle Berufe); `strom occupation remove de:Ölschläger`.
- **Gilt seit:** Forschung 1.32.0

<!-- zdroj: research:src/commands/occupation.ts (add: aspoň dva tvary, --source ověřený pramen, by human | agent podle tree.personWrites; list: bez slova skupiny s by/at/sources, se slovem tvary s * u vlastních, --all; remove: agent jen své, persons, builtin, unknown) · src/core/occupations.ts (OCCUPATIONS_FILE quality/occupations.json, parseForm kód jazyka, addOccupation: nic se nezapíše, když už jedno povolání; mergeOccupations, ownOrRefuse: nečitelný soubor → UsageError strom repair; writeOwn putFile zapečetěná operace) · src/commands/query.ts:254–265 (ui.query.occupation.unknown, ui.occupation.unreadable) · assets/terms/occupations.json (83 skupin) · src/agents/files.ts AGENTS.md „An occupation strom query says is in no list“ · cs.json ui.occupation.*, ui.query.occupation.unknown · commity 84e7fc0e, 0abe8793 · CHANGELOG.cs.md 1.32.0 -->
