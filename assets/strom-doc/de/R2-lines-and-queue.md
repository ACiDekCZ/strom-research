<a id="R2"></a>
# R2 Linien und Warteschlange

Wonach der Agent der Forschung auswählt, woran er arbeiten wird. Beschrieben werden die Forschung 1.25.2
und die Strom-App 3.21.2. Änderungen aus einer neueren Version tragen deren Nummer.

<a id="R2.1"></a>
## R2.1 Die Linie bestimmt, was die Forschung untersucht

Eine Linie der Forschung ist ein Ziel: die Vorfahren einer Person, die Nachkommen einer Person oder eine Frage. Jede
Aufgabe gehört zu einer Linie, und der Agent arbeitet an den Aufgaben der Linien.

- **Bedienung:** App: Forschungsbereich, Abschnitt **Richtungen · N aktiv** · Terminal: Menü **Die Forschung
  erweitern → Eine neue Richtung**, Befehl `strom research new`
- **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:src/core/model.ts DIRECTIONS, RESEARCH_STATES · research:src/commands/research.ts · app:strings.ts live.dirTitle -->

<a id="R2.1.1"></a>
### R2.1.1 Arten von Linien und Grenzen

- **Vorfahren einer Person**, höchstens eine angegebene Zahl von Generationen, oder nur Vorfahren, die vor einem
  angegebenen Jahr geboren sind.
- **Nachkommen einer Person.**
- **Eine Frage** (erfundenes Beispiel: „Wer war der Vater von Marie Vlková?“).
- **Durchsicht einer Person** entsteht aus der Durchsicht einer Person, nicht aus dem Angebot einer neuen Linie.
- **Bedienung:** Terminal: `strom research new --direction ancestors|descendants --generations <n> --before <rok>
  --question "<otázka>"`. App: **+ Neue Richtung**, mit den Grenzen **Höchstens Generationen** und **Nur vor dem
  Jahr** (App 3.22.0 mit Forschung 1.26.0).
- **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:src/commands/research.ts:79 · assets/lang/cs.json ui.research.kind · app:src/ui/research-directions-ui.ts DIRECTIONS_WRITE_SINCE -->

<a id="R2.1.2"></a>
### R2.1.2 Pausierte und beendete Linie

- **Pausiert:** ihre Aufgaben warten außerhalb der Warteschlange, der Agent nimmt Aufgaben anderer Linien.
- **Beendet:** ihre Aufgaben verlassen die Warteschlange. Nichts wird gelöscht, und die Linie lässt sich wieder
  starten.
- **Bedienung:** Terminal: **Die Forschung erweitern → Die Richtungen der Forschung: pausieren, beenden oder wieder
  aufnehmen**, `strom research pause|done|resume`. App: Abschnitt Richtungen, Aktionen **Pausieren**, **Beenden**,
  **Neu starten**. In der App 3.21.2 wird die Aktion im Terminal der Forschung bestätigt, ab der App 3.22.0
  direkt im Bereich.
- **Gilt seit:** Forschung 1.8.0

<!-- zdroj: research:src/commands/research.ts:168-175 · src/cli/menu-research.ts:233-263 · app:v3.21.2 research-directions-ui.ts:554 -->

<a id="R2.1.3"></a>
### R2.1.3 Wer zu einer Linie gehört

- Linie der Vorfahren: die Person, ihre Vorfahren in den Grenzen der Linie und Ehemann oder Ehefrau eines Vorfahren.
- Linie mit einer Frage: die Person, die die Frage betrifft.
- Eine Aufgabe ohne bestimmte Linie gehört zur engsten Linie, in die ihre Personen fallen.
- **Gilt seit:** Forschung 1.0.0. Ehepartner und die Person der Frage seit 1.26.0.

<!-- zdroj: research:src/core/frontier.ts:159-194 researchPeople/linePeople · src/core/directions.ts:75-82 directionOf · CHANGELOG.cs.md 1.26.0 -->

<a id="R2.1.4"></a>
### R2.1.4 Die Reihenfolge der Linien ist die Reihenfolge der Arbeit

Die Linien haben eine Reihenfolge, und in ihr kommt die Arbeit zu ihnen: die erste Linie hat Vorrang.

- **Grenzen:**
  - eine pausierte und eine beendete Linie behalten ihren Platz; nach dem Neustart steht sie wieder, wo sie war. Eine
    neue Linie kommt ans Ende;
  - was die Reihenfolge für die Warteschlange bedeutet, hängt von der Strategie ab ([R2.2.1](#R2.2.1)): **balanced**
    und **depth** geben den Aufgaben der ersten laufenden Linie einen Zuschlag von 2 Punkten, der letzten 0, den
    übrigen anteilig; keine Linie steht still. **priority** nimmt die Linien streng der Reihe nach: die erste, solange
    sie Arbeit hat, dann die nächste; Aufgaben ohne Linie erst nach ihnen;
  - eine Forschung ohne gespeicherte Reihenfolge ordnet die Linien nach Priorität, dann nach dem Datum der Anlage;
  - eine engere Grenze der Linie (`strom research edit`) löscht nichts: Aufgaben jenseits der Grenze warten außerhalb
    der Linie.
- **Bedienung:** Terminal: `strom research list` (in der Reihenfolge der Arbeit), `strom research order G… G…`,
  `strom research move G… --to <n>|--up|--down|--first`, `strom research edit G…
  --name|--question|--generations|--before`. App: Abschnitt **Richtungen**
  ([S4.3.1](S4-research-from-the-app.md#S4.3.1)), Telefon ([S5](S5-phone.md)).
- **Gilt seit:** Forschung 1.26.0

<!-- zdroj: research:src/core/order.ts workOrder, orderMode · src/core/queue.ts:237-240 lineBonus, :396 priority lineRank · src/commands/research.ts:215 research edit, :303 research order, :326 research move -->

<a id="R2.2"></a>
## R2.2 Die Warteschlange bestimmt, welche Aufgabe an die Reihe kommt

Die offenen Aufgaben aller laufenden Linien bilden eine Warteschlange. Der Agent nimmt immer die erste Aufgabe. Eine
begonnene Aufgabe geht allen voran.

- **Grenzen:** die Reihenfolge bestimmen diese Schlüssel, jeder weitere nur bei Gleichheit der vorigen:
  1. begonnene Aufgabe;
  2. Wahl von Hand **sofort** / **ans Ende** ([R2.3.1](#R2.3.1));
  3. Aufgaben der Ortsgeschichte kommen nach den übrigen, in eigener Reihenfolge; ist die Geschichte an der Reihe,
     geht ihre erste Aufgabe voran;
  4. Arbeit außerhalb der Linien ([R2.3](#R2.3));
  5. kurze Arbeit voran: Verknüpfung von Varianten der Hypothesen mit Personen des Stammbaums und Orte, deren
     Bestimmung der Mensch angefordert hat;
  6. Erzählung: ist sie an der Reihe, kommt sie zuerst ([R2.2.2](#R2.2.2)), sonst erst nach der Forschung;
  7. eine Aufgabe, die sich sofort erledigen lässt, vor einer Aufgabe, die auf vom Menschen heruntergeladene Bilder
     wartet;
  8. Strategie der Warteschlange ([R2.2.1](#R2.2.1));
  9. Art der Aufgabe: Unterlagen → wo die Einträge liegen → Beleg einer Verbindung → Prüfung → Ergänzung einer
     Person → Anfrage an ein Archiv → Erzählung;
  10. Alter der Aufgabe.
- **Bedienung:** Terminal: `strom task list`, `strom task next`. App: Abschnitt **Warteschlange**.
- **Gilt seit:** Forschung 1.0.0 (Schlüssel 1, 7–10). Schlüssel 6 seit 1.1.0, Verknüpfung von Hypothesen seit
  1.17.0, Schlüssel 3 seit 1.22.0, Schlüssel 4 und Orte auf Anforderung seit 1.25.0. Schlüssel 2 seit 1.26.0.

<!-- zdroj: research:src/core/queue.ts rankTasks (řazení :374-396), LEVEL_ORDER :52, linksFirst (hypolinks.ts:453), placesFirst · verze klíčů: git log -S na „a.blocked - b.blocked“ (v1.0.0), „a.story - b.story“ (v1.1.0), „a.first - b.first“ (v1.17.0), „a.hist - b.hist“ (v1.22.0), „a.offLine - b.offLine“ a placesFirst (v1.25.0) -->

<a id="R2.2.1"></a>
### R2.2.1 Strategie der Warteschlange

- **balanced** (Standard): wechselt zwischen den Linien. Höher reiht sie eine höhere Priorität der Linie, eine
  nähere Generation und eine Linie, an der in den letzten 4 Sitzungen nicht gearbeitet wurde. Niedriger reiht sie
  eine Aufgabe, die schon einmal ohne Erfolg blieb.
- **depth:** bleibt bei der Linie, an der gerade gearbeitet wird.
- **priority:** nach der Priorität der Linie (1–5, Standard 3), dann nach der Generation.
- **Bedienung:** Terminal: `strom config set queue.strategy balanced|depth|priority`, Priorität der Linie
  `strom research new … --priority <1–5>`.
- **Gilt seit:** Forschung 1.0.0
- **Ab Forschung 1.26.0:** Gewicht hat auch die Reihenfolge der Linien ([R2.1.4](#R2.1.4)); **priority** nimmt die
  Linien der Reihe nach, innerhalb einer Linie nach der Priorität der Aufgabe und der Generation.

<!-- zdroj: research:src/core/queue.ts:294-299, RECENT=4 :58 · src/core/config.ts queue.strategy · model.ts priority -->

<a id="R2.2.2"></a>
### R2.2.2 Erzählung an der Reihe

Eine Erzählung wartet sonst, bis die Forschung nichts zu tun hat. Nach 5 Sitzungen ohne Erzählung kommt aber eine
wartende Erzählung als erste an die Reihe (wenn der Agent allein arbeitet). Mit der Strategie priority gilt das
nicht.

- **Gilt seit:** Forschung 1.1.0

<!-- zdroj: research:src/core/queue.ts STORY_EVERY=5 :61 -->

<a id="R2.2.3"></a>
### R2.2.3 Aufgaben, die außerhalb der Warteschlange warten

Eine Aufgabe wird nicht genommen, solange:
- ihre Linie pausiert oder beendet ist ([R2.1.2](#R2.1.2));
- sie nur Personen betrifft, die keine familiäre Verbindung mit dem Stammbaum verbindet. Zuerst muss die Verbindung
  zum Stammbaum belegt sein, dann wird weiter erforscht. Eine Aufgabe, die diese Verbindung prüft, wird genommen;
- die Bilder des Buches fehlen, das sie lesen soll, und auf die Entscheidung gewartet wird, wie sie zu beschaffen
  sind;
- das Archiv, aus dem sie liest, vorübergehend nicht erreichbar ist;
- sie außerhalb der Linien liegt und die Wahl **nie** gilt ([R2.3](#R2.3)).

Unterlagen (eine Aufgabe der Art Unterlagen) und eine begonnene Aufgabe warten nie.

- **Bedienung:** Terminal: `strom task list --off-tree` (Aufgaben außerhalb des Stammbaums).
- **Gilt seit:** Forschung 1.9.0 (außerhalb des Stammbaums); die übrigen Gründe nach den Versionen in den
  verwiesenen Regeln.

<!-- zdroj: research:src/core/queue.ts:205-210 waits · src/core/kin.ts:98 offTree · assets/method/core.md „The tree first, then above it“ -->

<a id="R2.3"></a>
## R2.3 Arbeit außerhalb der Linien

In einer Forschung mit mehreren Linien ist **Arbeit außerhalb der Linien** eine Aufgabe über Personen, die keine
Linie erreicht (die Schwester eines Vorfahren und ihre Familie), und die keiner Linie hilft. Solche Arbeit kommt
**erst nach der Arbeit an den Linien**.

- **Grenzen:** eine Aufgabe hilft einer Linie und liegt also nicht außerhalb der Linien, wenn sie eine Hypothese oder
  einen Widerspruch der Linie nennt, Personen mit dem Stammbaum verbindet oder der Agent erfasst hat, wie sie der
  Linie hilft (ein Geschwister eines Vorfahren als Pate oder Zeuge, dasselbe Haus, der Familienname eines Vorfahren).
  Die eigene Familie des Geschwisters hilft der Linie nicht.
- **Optionen:** **am Ende, nach den Linien** (Standard) · **wie die Arbeit der Linien** · **nie** (die Aufgaben werden
  nicht genommen, nichts wird gelöscht).
- **Bedienung:** Terminal: **Einstellungen → Der Agent allein → Arbeit außerhalb der Linien**,
  `strom config set queue.offLine last|normal|never`. Die App 3.21.2 zeigt bei der Aufgabe **Wartet, bis die Arbeit
  der Richtungen getan ist · hilft keiner Richtung**.
- **Gilt seit:** Forschung 1.25.0
- **Ab Forschung 1.26.0:** neue Standardwahl **gelegentlich, ab und zu eine**: eine Aufgabe außerhalb der Linien auf 10
  Sitzungen (`queue.offLineShare`), aus dem nächsten Zweig. Zur Arbeit außerhalb der Linien gehört auch Ehemann oder
  Ehefrau eines Vorfahren ([R2.1.3](#R2.1.3)).

<!-- zdroj: research:v1.25.2 src/core/config.ts:278 queue.offLine (popis), :715 výchozí last · HEAD model.ts OFF_LINE_CHOICES, config.ts OFF_LINE_SHARE=10 · assets/method/core.md „The lines first“ · app:strings.ts research.queueOffLast -->

<a id="R2.3.1"></a>
### R2.3.1 Wahl für einen Zweig und eine Aufgabe

Neben der Wahl für die ganze Forschung kann ein Zweig eine eigene Wahl haben (auch „einer Linie hinzufügen“) und eine
Aufgabe (**sofort** / **ans Ende**). Die engere Wahl gewinnt: die Aufgabe vor dem Zweig, der Zweig vor der Forschung.

- **Grenzen:**
  - Zweig: **ab und zu**, **am Ende**, **wie üblich**, **nie** (die Aufgaben warten außerhalb der Warteschlange,
    nichts wird gelöscht, und in ihm wird keine neue Aufgabe vorgeschlagen), oder einer Linie hinzufügen: die
    Aufgaben des Zweigs helfen dann der Linie und gehen mit ihr. Die Wahl gilt auch für neue Aufgaben des Zweigs.
    Zurück zur Wahl der Forschung: Standard;
  - eine Aufgabe **sofort** kommt als nächste an die Reihe, vor den Linien, Orten und der Geschichte, und nur einmal:
    nach einer Sitzung an ihr verschwindet die Wahl von selbst. **Ans Ende** gilt, bis die Aufgabe erledigt ist oder
    bis die Wahl zurückgesetzt wird. Eine Aufgabe, an der der Agent arbeitet, ändert ihren Platz nicht.
- **Bedienung:** Terminal: `strom offline list|show`, `strom offline set B-P… --mode occasional|last|normal|never`,
  `--line G…`, `--default`; `strom task order T… --next|--last|--default`. App 3.22.0:
  **Als Nächstes**, **Ans Ende**, Optionen des Zweigs ([S4.3.2](S4-research-from-the-app.md#S4.3.2)).
- **Gilt seit:** Forschung 1.26.0

<!-- zdroj: research:src/commands/offline.ts:101 offline set (BRANCH_MODES), :171 task order (next once, queue.doing) · quality/offline.json -->

<a id="R2.3.2"></a>
### R2.3.2 Ein wachsender Zweig bekommt einen Vorschlag für eine Linie

Wächst ein Zweig außerhalb der Linien auf 10 offene Aufgaben oder 5 Personen, erscheint in **Wartet auf
Bearbeitung** eine Frage: einer Linie hinzufügen, eine Linie anlegen, so lassen oder nicht erforschen. Nach der
Antwort „so lassen“ wird erst bei doppelter Größe wieder vorgeschlagen. Ein Zweig mit eigener Wahl und die Wahl
**nie** bekommen keinen Vorschlag.

- **Grenzen:** es antwortet nur der Mensch (App oder **Was wartet**); dem Agenten lehnt die Forschung die Antwort ab.
  Ist die Linie beim Zweig pausiert oder beendet, bietet die App die engste laufende Linie an, zu der die Person des
  Zweigs gehört; gibt es keine, die pausierte Linie mit der Notiz **(pausiert)**.
- **Bedienung:** Terminal: **Linien für wachsende Zweige vorschlagen** (ein/aus), `strom offline answer B-P…
  line|keep|never`, `strom config set queue.suggestTasks|queue.suggestPersons <n>`. App: **Wartet auf
  Bearbeitung**, Einstellung **Richtungen für wachsende Zweige vorschlagen**
  ([S4.3.2](S4-research-from-the-app.md#S4.3.2)).
- **Gilt seit:** Forschung 1.26.0

<!-- zdroj: research:src/core/offline.ts:449-455 grows · config.ts SUGGEST_TASKS=10, SUGGEST_PERSONS=5 · cs.json ui.wait.branch.done.keep · src/commands/offline.ts:142 offline answer (person) · app:src/ui/research-offline-ui.ts answerGrowingBranch · strings.ts live.setSuggest, live.branchAddPaused -->

<a id="R2.4"></a>
## R2.4 Warum eine Aufgabe steht, wo sie steht

Jede Aufgabe in der Warteschlange nennt den Grund ihres Platzes: in einer Linie, hilft einer Linie (und wie),
außerhalb der Linien (und in welchem Zweig), Wahl von Hand, oder sie wartet, weil die Linie pausiert ist.

- **Bedienung:** App 3.22.0: Abschnitt **Warteschlange**, Zeile bei der Aufgabe (z. B. „hilft der Richtung N ·
  …“).
- **Gilt seit:** Forschung 1.26.0

<!-- zdroj: research:src/core/queue.ts:312-349 · app:strings.ts live.qWhyLine, qWhyHelps, qWhyOut, qWhyManualNext, qWhyPaused -->
