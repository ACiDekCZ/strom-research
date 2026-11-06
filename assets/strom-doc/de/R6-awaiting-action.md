<a id="R6"></a>
# R6 Wartet auf Bearbeitung

Was die Forschung vom Menschen braucht, wo es gezeigt wird und wie eine Aufgabe nach der Erledigung in die
Warteschlange zurückkehrt. Beschrieben werden die Forschung 1.25.2 und die Strom-App 3.21.2. Änderungen aus einer neueren Version tragen deren Nummer.

<a id="R6.1"></a>
## R6.1 Was wartet, ist eine einzige Liste

Alles, worauf die Forschung vom Menschen wartet, bildet eine einzige geordnete Liste: auf Warten gesetzte Aufgaben,
Fragen der Archive, neue Fassungen freigegebener Erzählungen und Fragen zu Orten. Das Terminal zeigt zusätzlich, was
nur dort erledigt wird. Die Liste wird jedes Mal aus der Forschung berechnet, in sie wird nichts geschrieben.

- **Grenzen:** eine Aufgabe, die nur auf die Erlaubnis eines Archivs wartet und keine Bilder hat, gehört zur Frage
  des Archivs. Eine Forschung, die als Archiv dient, hat in der Liste weder Aufgaben noch Orte.
- **Bedienung:** App: Abschnitt **Wartet auf Bearbeitung** · Terminal: Menü **Was wartet (n)**, Statuszeile
  **Wartet: N** · Seite für das Telefon: **Wartet · {n}**.
- **Gilt seit:** Forschung 1.3.0. Die Liste nach Orten der Erledigung und in der App seit 1.14.0 (App 3.11.0).

<!-- zdroj: research:src/core/waiting.ts:1-12, waitingFor :303-460 (filtr :321), actsAsArchive (v1.15.0) · src/cli/menu.ts:234, :379 · CHANGELOG.cs.md 1.14.0 · app:src/ui/research-overview-ui.ts research.waiting -->

<a id="R6.1.1"></a>
### R6.1.1 Die Zahl und was nur im Terminal ist

- Die Zeile **Wartet: N (davon X nur hier im Terminal, Y warten auf Antwort)** teilt die Zahl wie die App. Die Zahl
  der App ist N ohne die Einträge nur für das Terminal und ohne gesendete Anfragen.
- Nur im Terminal sind Stammbäume, die aus der App gesendet wurden (**Die Strom-App**), Fragen zum Lesen der Scans
  (**Das Lesen der Scans**), Widersprüche (**Widersprüche zu entscheiden**, siehe [R5](R5-conflicts.md)), Hypothesen zu
  entscheiden (ab Forschung 1.28.0) und mildere Bedingungen eines Archivs. In der Übersicht **Was wartet** kommen sie
  zuerst unter
  der Überschrift **Nur hier im Terminal (nicht in der Strom-App)**, danach **Auch in der Strom-App**.
- Die Seite für das Telefon liest nur: ohne die Einträge nur für das Terminal, mit Erzählungen, zuerst 20 Einträge,
  höchstens 200 auf einmal. Sie schreibt **Entscheiden lässt sich am Computer in der Forschungsübersicht.**
- **Gilt seit:** Forschung 1.21.0. Die Seite für das Telefon seit 1.18.0, die gemerkte Zahl im Menü seit 1.22.0.

<!-- zdroj: research:src/core/waiting.ts:127 TERMINAL_ONLY, :139 waitingSplit, :149 waitingLine · src/cli/menu-waiting.ts:215-232 · src/core/waitkept.ts · src/core/phone-watch.ts WAITING_SHOWN, WAITING_ASKED · assets/lang/cs.json ui.waiting.split*, ui.wait.only.head, ui.phone.page.waiting.where -->

<a id="R6.2"></a>
## R6.2 Eine Aufgabe wartet auf den Menschen

Wenn der Agent ohne den Menschen nicht weiterkommt, setzt er die Aufgabe auf Warten und schreibt unpersönlich, was
gebraucht wird. Die Art des Wartens bestimmt den Abschnitt, die Gruppe und die möglichen Aktionen: **Bilder**,
**Seite prüfen**, **Erlaubnis eines Archivs**, **Brief**, **Familie**, **Web**, **Sonstiges**.

- **Grenzen:** `--kind` nimmt nur `letter`, `family`, `web`, `other`; Bilder und das Prüfen einer Seite haben eigene
  Optionen, die nicht zusammen gehen. Ohne `--kind` wird die Art aus den Worten abgeleitet: eine Frage an den
  Menschen ist **Familie**, sonst entscheidet der erste Satz, danach der ganze Text, wenn er genau eine Art nennt;
  sonst **Sonstiges**. Einen Text, der den Menschen anredet, lehnt die Forschung ab. Ein neues Setzen auf Warten
  löscht das vorige und auch die Markierung des Sendens.
- **Bedienung:** Terminal: `strom task wait T… --on "<co>" --kind <druh> --to "<komu>" --request notes/<soubor>
  --url <adresa>`, nachträglich `strom task edit T… --kind --to --request`.
- **Ab Forschung 1.26.0:** `--kind images` bei `--images` und `--kind check` bei `--check` gilt als Wiederholung, nicht als
  Fehler.
- **Gilt seit:** Forschung 1.0.0. Arten, `--to` und `--request` seit 1.14.0.

<!-- zdroj: research:src/commands/tasks.ts:975-1050 task wait, :497-520 waitOptions, :392-417 stateChange · src/core/model.ts:540 WAIT_KINDS · src/core/waitkind.ts:150 waitKindOf (ASK_USER, firstClause) · assets/method/waiting.md -->

<a id="R6.2.1"></a>
### R6.2.1 Von Hand gespeicherte Bilder

- Die Forschung bereitet einen Ordner in `inbox/` des gemeinsamen Ordners vor. Eine Datei trägt die Nummer des Bildes
  (`9.jpg`, `9a.jpg`).
- Nach dem Speichern der Bilder in die Forschung wird die Aufgabe geweckt, mit einer Notiz, welche Bilder fehlen
  ([R6.7.2](#R6.7.2)).
- **Bedienung:** Terminal: `strom task wait T… --images B…:<od>-<do>`, danach `strom media add --inbox`; in **Was
  wartet** **Den Ordner öffnen ({have}/{want} gespeichert)**. App: **Ordner öffnen** (seit App 3.23.0; vorher **Ordner**).
- Archive nur über den Browser, Bilder aus der App und was der Mensch tut: [R9.6](R9-archives.md#R9.6), [R9.9](R9-archives.md#R9.9).
- **Gilt seit:** Forschung 1.0.0. Wecken nach dem Speichern seit 1.15.0.

<!-- zdroj: research:src/commands/tasks.ts:1000-1025 (--images, inbox) · src/commands/media.ts:135-170 wakeWaiting · assets/method/waiting.md · app:src/research-waiting.ts:251 waitingActions (folder) · src/ui/research-overview-ui.ts:1023, src/ui/waiting-task-ui.ts:231 · src/strings.ts waitingTask.openFolder -->

<a id="R6.2.2"></a>
### R6.2.2 Seite prüfen

Die Aufgabe wartet, bis sich der Mensch eine Seite ansieht, die der Agent selbst nicht öffnet. Die Antwort ist **Es
geht – das Buch und seine Bilder sind zu sehen**, **Nur dort anzusehen** oder **Es geht nicht**, mit einer
freiwilligen Notiz.

- **Grenzen:** `--check` verlangt eine in dieser Sitzung oder bei der Aufgabe erfasste Suche, die dieselbe Seite
  nennt. Antworten darf nur der Mensch ([R6.6](#R6.6)). Der Eintrag gehört zu den **Entscheidungen**, nicht zu
  **Web**.
- **Bedienung:** Terminal: `strom task wait T… --check <adresa> --on "<co>"`; in **Was wartet** **Was ist dort?**,
  `strom task wake T… --check=works|view|no`.
- **Gilt seit:** Forschung 1.14.0

<!-- zdroj: research:src/commands/tasks.ts:439-470 checkUrl (task.check-search) · src/core/model.ts:510 CHECK_ANSWERS · src/core/waiting.ts:51-65 SECTION · src/cli/menu-waiting.ts:637 checkSite -->

<a id="R6.3"></a>
## R6.3 Entscheidungen

Der Abschnitt **Entscheidungen** sammelt Fragen, die den Agenten aufhalten: Erlaubnis eines Archivs, zu bestätigende
Downloader, mildere Bedingungen, Seite prüfen, Erzählung, Ort (siehe [R4](R4-places.md)), Widerspruch (siehe [R5](R5-conflicts.md)), Hypothese (siehe
[R6.3.4](#R6.3.4)), Stammbäume aus der App und das Lesen der Scans. Entscheidungen stehen in der Liste zuerst.

- **Bedienung:** Terminal: **Was wartet** → Eintrag; `strom allow archive --way`, `strom place answer`,
  `strom conflict resolve`, `strom media calibrate --answer`.
- **Gilt seit:** Forschung 1.14.0. Widersprüche seit 1.20.0, Orte seit 1.25.0, Hypothesen seit 1.28.0.

<!-- zdroj: research:src/core/waiting.ts:51-65 SECTION, :75 DECIDE_RANK · src/cli/menu-waiting.ts:486 decideConflictHere, :518 decidePlace, :712 decideTune · CHANGELOG.cs.md 1.20.0, 1.25.0 -->

<a id="R6.3.1"></a>
### R6.3.1 Erlaubnis eines Archivs

- Die Fragen stehen in einer Gruppe nach Archiv, zu genehmigende Downloader in der Gruppe **Downloader**. Eine
  Aufgabe, deren Herunterladen auf eine Frage gestoßen ist, wartet auf die Entscheidung.
- Die Entscheidung weckt die Aufgaben, die auf dieses Archiv warten, in allen Forschungen auf dem Computer. Bei der
  Wahl **Nur von Hand – die Bilder werden in einen vorbereiteten Ordner gespeichert** warten die Aufgaben weiter auf
  von Hand gespeicherte Bilder. Eine Aufgabe **Seite prüfen** wird nie geweckt.
- **Bedienung:** Terminal: `strom allow archive --way`, Menü der Archive, Fenster des Herunterladens. App: Link ins
  Terminal.
- **Gilt seit:** Forschung 1.14.0

<!-- zdroj: research:src/core/archivewait.ts:188-215 wakeForArchive (way "manual", check :205), waitingForDecision · src/core/waiting.ts:303-340 · assets/lang/cs.json wait.group.takeover -->

<a id="R6.3.2"></a>
### R6.3.2 Erzählung zur Freigabe

- In der Liste steht nur eine neue Fassung einer schon freigegebenen Erzählung, in der Gruppe **Geschichten**. Wahl:
  **die neue Fassung, anstelle der alten** oder **die alte behalten (die neue Fassung entfällt)**.
- **Bedienung:** App: **Neue Fassung der Erzählung**, **Vergleichen**, Entscheidung über einen Link ins Terminal.
  Terminal: **Welche Erzählung soll das Familienbuch haben?**, `strom story approve|discard`.
- **Gilt seit:** Forschung 1.14.0
- **Ab Forschung 1.26.0:** es entscheidet nur der Mensch; dem Agenten lehnt die Forschung `strom story
  approve|discard` ab ([R6.6](#R6.6)).

<!-- zdroj: research:src/core/stories.ts:169 storiesToApprove · src/core/waiting.ts:369-390 · src/cli/menu-waiting.ts:686 decideStory · src/commands/story.ts:102-134 · app:src/ui/story-compare-ui.ts -->

<a id="R6.3.3"></a>
### R6.3.3 Zweige außerhalb der Linien

- Ein wachsender Zweig außerhalb der Linien bekommt eine Frage in der Gruppe **Zweige außerhalb der Linien**
  ([R2.3.2](R2-lines-and-queue.md#R2.3.2)): **Einer Linie hinzufügen**, **Eine Linie anlegen**, **So lassen**,
  **Nicht erforschen**.
- **Grenzen:** es antwortet nur der Mensch ([R6.6](#R6.6)).
- **Bedienung:** Terminal: **Was wartet** → Eintrag, `strom offline answer`.
- **Gilt seit:** Forschung 1.26.0

<!-- zdroj: research:HEAD src/core/waiting.ts:428-451 (group branches) · src/cli/menu-waiting.ts decideBranch · assets/lang/cs.json:2359 wait.group.branches -->

<a id="R6.3.4"></a>
### R6.3.4 Hypothesen zu entscheiden

- Eine Hypothese, deren Entscheidung der Agent vorgeschlagen hat ([R10.3.1](R10-people-and-hypotheses.md#R10.3.1)),
  wartet in der Gruppe **Hypothesen zu entscheiden**: die Frage, die Versionen und der Vorschlag („Vorschlag:
  Variante B – …“). Wahl: **Wie vorgeschlagen entscheiden**, **Anders entscheiden** (eine andere Version oder keine,
  mit Grund), **So lassen (Vorschlag nicht übernommen)**.
- **Grenzen:** es entscheidet nur der Mensch ([R6.6](#R6.6)). Sie ist nur im Terminal, die Strom-App zeigt sie nicht
  ([R6.1.1](#R6.1.1)). Im Strom-Archiv gibt es die Gruppe nicht.
- **Bedienung:** Terminal: **Was wartet** → Eintrag, `strom hypothesis decide H… --proposed | --keep-open`.
- **Gilt seit:** Forschung 1.28.0

<!-- zdroj: research:src/core/waiting.ts (kind hypothesis, section decide, DECIDE_RANK 0, TERMINAL_ONLY hypotheses, actsAsArchive) · src/cli/menu-waiting.ts decideHypothesis · assets/lang/cs.json wait.group.hypotheses, ui.wait.hypothesis.proposed/accept/other/keep -->

<a id="R6.4"></a>
## R6.4 Gruppen und Reihenfolge

Jeder Eintrag gehört zu einer Gruppe nach dem Ort, an dem er erledigt wird: Archiv, Amt, Familie, Web oder
Sonstiges. Die Einträge einer Gruppe stehen beisammen an der Stelle ihres ersten Eintrags, damit sie sich mit einer
Nachricht erledigen lassen.

- **Grenzen:** die Reihenfolge bestimmen diese Schlüssel, jeder weitere nur bei Gleichheit der vorigen:
  1. **Zu erledigen** vor **Wartet auf Antwort**; gesendete vom am längsten gesendeten an;
  2. Abschnitt: Entscheidungen → Bilder und Web → Archive und Ämter, Familie → Sonstiges;
  3. in den Entscheidungen: Stammbäume aus der App und Widersprüche → Erlaubnis eines Archivs → Downloader → mildere
     Bedingungen → Seite prüfen → Erzählungen und Orte (und Zweige) → das Lesen der Scans;
  4. Priorität der Aufgabe, höhere zuerst;
  5. Alter, ältere zuerst.
- Gruppe einer Aufgabe: Empfänger `--to` (Amt oder Archiv der Forschung) → **Familie** → Amt aus dem Brief → Archiv
  oder Server aus der Adresse der Seite → Archiv des Buches der Aufgabe → Archiv nach Adresse → Amt → Server →
  **Sonstiges**. Feste Gruppen: **Geschichten**, **Downloader**, **Die Strom-App**, **Das Lesen der Scans**,
  **Widersprüche zu entscheiden**, **Orte zu bestimmen**, **Zweige außerhalb der Linien**.
- **Bedienung:** App: **Zu erledigen** / **Wartet auf Antwort**, Filter **Nach Art zeigen** (**Entscheidungen**,
  **Bilder**, **Archive und Ämter**, **Familie**, **Web**, **Sonstiges**) · Terminal: in **Was wartet** der
  Buchstabe des Abschnitts, `?` schaltet auf **Wartet auf Antwort** um.
- **Gilt seit:** Forschung 1.14.0

<!-- zdroj: research:src/core/waiting.ts:73 SECTION_RANK, :75 DECIDE_RANK, :468 together, :478-492 ordered · src/core/waitkind.ts:238 waitGroupOf · assets/lang/cs.json:2313-2320 wait.group.* (:2359) · src/cli/menu-waiting.ts:205-232 · app:strings.ts:11958 waitingFilterLabel -->

<a id="R6.5"></a>
## R6.5 Was sich wo erledigen lässt

Die App selbst erfasst nur eine Tatsache: die Anfrage ist gesendet, sie kehrt zu den zu erledigenden zurück, eine
Datei mit der Antwort ist gekommen. Entscheidungen und Zustimmungen nimmt nur das Terminal an; Schaltflächen, die sie
brauchen, öffnen das Terminal der Forschung auf dem Computer.

- **Grenzen:**
  - Die App erledigt selbst: **Gesendet** (auch für eine Gruppe), **Zurück zu „Zu erledigen“**, **Datei hinzufügen**
    (nur Bilder und PDF), **Text aller Anfragen** und die Antwort auf eine Frage zu einem Ort (Fenster **Wartet auf
    Bearbeitung · Orte**).
  - Über einen Link ins Terminal: **Antworten**, **Chat**, **Anfragetext**, **Ordner**, Erzählung, Erlaubnis eines
    Archivs.
  - Auf einem schmalen Bildschirm hat die App keine Links und schreibt **Antwort in der Forschung am Computer**; auf
    Fragen zu Orten lässt sich auch dort antworten.
- **Bedienung:** Terminal: **Was wartet** → Gruppe (**Der Text aller Anfragen auf einmal**, **Für die ganze Gruppe
  gesendet**, **Ein Gespräch mit dem Agenten über die ganze Gruppe**) oder Eintrag.
- **Gilt seit:** Forschung 1.14.0 (App 3.11.0). Orte seit 1.25.0.

<!-- zdroj: research:src/core/live.ts:60-80 (POST /waiting, /group, PUT /media X-Strom-Task, POST /places/answer, /conflict 403), :2761 · src/core/waiting.ts:78-88 actionsOf · app:src/ui/research-overview-ui.ts · strings.ts:9972, :10078, :11953 -->

<a id="R6.6"></a>
## R6.6 Was nur der Mensch darf

Eine Antwort an Stelle des Menschen schreibt der Agent nicht. Wenn der Agent einen dem Menschen vorbehaltenen Befehl
startet, fragt die Forschung den Menschen in einem Systemfenster, oder sie lehnt den Befehl ab.

- **Grenzen:**
  - nur der Mensch: die Antwort auf eine wartende Aufgabe, die Antwort auf das Prüfen einer Seite, die Erlaubnis
    eines Archivs, die Antwort auf eine Frage zum Lesen der Scans und auf eine Frage zu einem Ort; eine Aufgabe, die
    auf das Prüfen einer Seite wartet, weckt der Agent ohne Antwort nicht;
  - die Freigabe einer Erzählung und **Gesendet** setzt der Agent nur auf das Wort des Menschen; so sagt es die
    Methodik.
- **Bedienung:** Terminal: **Mit Text antworten** (höchstens 300 Zeichen), `strom task wake T… --answer "<text>"`.
- **Gilt seit:** Forschung 1.14.0. Orte seit 1.25.0.
- **Ab Forschung 1.26.0:** nur der Mensch auch: Freigabe und Verwerfen einer Erzählung (`strom story
  approve|discard`; dem Agenten lehnt die Forschung auch `strom story set --final` ab), die Antwort auf einen
  wachsenden Zweig (`strom offline answer`), das Überlassen eines Widerspruchs aus einer Änderung an den Agenten
  (`strom conflict leave`), das Zurücknehmen und Verwerfen eines Sendens aus der App (`strom sync undo|discard`) und
  die Korrekturen `strom fixes … edit-decisions|woken-waits`.
- **Ab Forschung 1.28.0:** nur der Mensch entscheidet auch eine Hypothese (`strom hypothesis decide`, auch innerhalb
  von `strom batch`); der Agent schlägt sie nur vor ([R10.3.1](R10-people-and-hypotheses.md#R10.3.1)).

<!-- zdroj: research:src/commands/tasks.ts:897-970 (requireHuman :941, task.check-person :932) · src/commands/archives.ts:586-645 · src/commands/calibrate.ts:320 · src/commands/placeid.ts:343 person · assets/method/waiting.md, narrate.md:26-31 · src/cli/menu-waiting.ts:45 ANSWER_MAX · 1.26.0: userOnly u story approve/discard, offline answer, conflict leave, sync undo/discard (commity 4683a22d, 1189532f, 942c56f9), fixes.ts edit-decisions/woken-waits (person at the terminal) · 1.28.0: analysis.ts hypothesis decide (person), batch.ts def.person (commit 9b12256a) -->

<a id="R6.7"></a>
## R6.7 Gesendet, Antwort und Rückkehr in die Warteschlange

Ein Brief, eine Anfrage an die Familie oder eine andere Anfrage wandert nach dem Senden nach **Wartet auf Antwort**.
Eine Antwort bringt die Aufgabe in die Warteschlange zurück, und der Agent verarbeitet sie bei der nächsten Arbeit.

- **Grenzen:** **Gesendet** geht nur bei einer wartenden Aufgabe der Art Brief, Familie oder Sonstiges. Nach 30 Tagen
  ohne Antwort schreibt das Terminal **seit über 30 Tagen keine Antwort**.
- **Bedienung:** App: **Gesendet**, **Zurück zu „Zu erledigen“** · Terminal: **Gesendet**, `strom task sent T…`,
  zurück mit `--undo`.
- **Gilt seit:** Forschung 1.14.0

<!-- zdroj: research:src/commands/tasks.ts:1053-1118 task sent (task.not-waiting, task.not-sendable) · src/core/waitkind.ts:23 SENDABLE · src/cli/menu-waiting.ts:49 NO_REPLY_DAYS, :126 -->

<a id="R6.7.1"></a>
### R6.7.1 Antwort als Datei oder in Worten

- **Als Datei:** die Dateien werden zu Unterlagen der Personen der Aufgabe, und die Aufgabe kehrt in die
  Warteschlange zurück. Eine Aufgabe zur Annahme von Unterlagen entsteht nicht. Eine Datei lässt sich nicht einer
  Aufgabe beifügen, die nicht wartet, die auf das Prüfen einer Seite oder auf die Erlaubnis eines Archivs wartet.
- **In Worten:** die Antwort wird mit der Frage bei der Aufgabe gespeichert, und die Aufgabe kehrt in die
  Warteschlange zurück. `intake --text` mit `--answers` lehnt die Forschung ab: eine Antwort in Worten gehört nur dem
  Menschen.
- **Bedienung:** App: **Datei hinzufügen** · Terminal: **Eine Datei hinzufügen**, **Mit Text antworten**;
  `strom intake <soubor> --answers T…`, `strom task wake T… --answer "<text>"`.
- **Gilt seit:** Forschung 1.3.0 (in Worten). Als Datei seit 1.14.0.

<!-- zdroj: research:src/commands/intake.ts:164-205 (--answers) · src/core/taskfiles.ts fileRefused · src/commands/tasks.ts:969 answers · src/core/live.ts PUT /media X-Strom-Task -->

<a id="R6.7.2"></a>
### R6.7.2 Wann eine Aufgabe von selbst zurückkehrt, und das Zurückstellen

- Eine Aufgabe kehrt von selbst zurück, wenn in die Forschung Bilder des Buches gespeichert werden, auf das sie wartet
  oder das sie nennt, oder wenn ein Archiv eine Entscheidung bekommt ([R6.3.1](#R6.3.1)).
- Eine zurückgestellte Aufgabe steht weder in der Liste noch in der Warteschlange. Mit einem Datum `--until` kehrt sie
  von selbst zurück und ist an diesem Tag schon offen. Ohne Datum wartet sie, bis sie jemand weckt. Das Zurückstellen
  verlangt einen Grund.
- **Bedienung:** Terminal: `strom task park T… --reason "<proč>" --until RRRR-MM-DD`, zurück mit `strom task wake T…`.
  App: Abschnitt **Warteschlange**, **Zurückstellen** (Link ins Terminal, ohne Datum).
- **Gilt seit:** Forschung 1.0.0. Rückkehr nach Bildern seit 1.15.0, nach der Entscheidung eines Archivs seit 1.14.0.
- **Ab Forschung 1.26.0:**
  - Bilder bringen nur eine Aufgabe zurück, die auf Bilder genau dieses Buches wartet. Eine Aufgabe, die auf das
    Prüfen einer Seite durch den Menschen wartet, bringen sie nie zurück. Einen Brief, eine Anfrage an die Familie
    oder eine Seite bringt nur das Buch zurück, auf das die Aufgabe wartet, nicht ein Buch, in dem sie nur arbeitet;
  - seit Forschung 1.27.0 bringt eine Aufgabe, die auf eine Seite wartet (`--kind web`), auch das einzige Buch
    zurück, in dem sie arbeitet: die dort gespeicherten Bilder sind das, worauf sie gewartet hat. Einen Brief und eine
    Anfrage an die Familie weiter nur das Buch, auf das sie warten;
  - Aufgaben, die Bilder früher zu Unrecht zurückgebracht haben, setzt die Korrektur `strom fixes show|run|undo
    woken-waits` wieder ins Warten: die Aufgabe wartet wie vorher, samt dem Senden. Eine Aufgabe, an der
    inzwischen gearbeitet wurde, bleibt. Die Korrektur startet nur der Mensch im Terminal, im Strom-Archiv gibt es sie
    nicht. Solange sie nicht gelaufen ist, weist `strom check` auf solche Aufgaben hin.

<!-- zdroj: research:src/commands/media.ts:135-170 wakeWaiting (1.26.0: awaits jen ta kniha, check nikdy, letter/family/web jen waitingOn; 1.27.0: web i singleBook) · src/commands/fixes.ts:835 woken-waits (commit 740e1893) · src/core/archivewait.ts:188 wakeForArchive · src/commands/tasks.ts:880-895 task park · src/core/queue.ts:112 effectiveState · app:src/ui/research-ui.ts:3473-3500 -->
