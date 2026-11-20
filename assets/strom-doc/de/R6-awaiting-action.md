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
  **Wartet: N** · Seite für das Telefon: **Wartet · N**.
- **Gilt seit:** Forschung 1.3.0. Die Liste nach Orten der Erledigung und in der App seit 1.14.0 (App 3.11.0).

<!-- zdroj: research:src/core/waiting.ts:1-12, waitingFor :303-460 (filtr :321), actsAsArchive (v1.15.0) · src/cli/menu.ts:234, :379 · CHANGELOG.cs.md 1.14.0 · app:src/ui/research-overview-ui.ts research.waiting -->

<a id="R6.1.1"></a>
### R6.1.1 Die Zahl und was nur im Terminal ist

- Die Zeile **Wartet: N (davon X nur hier im Terminal, Y warten auf Antwort)** teilt die Zahl wie die App. Die Zahl
  der App ist N ohne die Einträge nur für das Terminal und ohne gesendete Anfragen.
- Nur im Terminal sind Stammbäume, die aus der App gesendet wurden (**Die Strom-App**), Fragen zum Lesen der Scans
  (**Das Lesen der Scans**), Widersprüche (**Widersprüche zu entscheiden**, siehe [R5](R5-conflicts.md)), Hypothesen zu
  entscheiden (ab Forschung 1.28.0; ab 1.31.0 bekommt sie auch die Strom-App, die sie entscheiden kann,
  [R6.3.4](#R6.3.4)) und mildere Bedingungen eines Archivs. In der Übersicht **Was wartet** kommen sie
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
- **Bedienung:** Terminal: `strom task wait T… --on "<was>" --kind <Art> --to "<an wen>" --request notes/<Datei>
  --url <Adresse>`, nachträglich `strom task edit T… --kind --to --request`.
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
- **Bedienung:** Terminal: `strom task wait T… --images B…:<von>-<bis>`, danach `strom media add --inbox`; in **Was
  wartet** **Den Ordner öffnen (M/N gespeichert)**. App: **Ordner öffnen** (seit App 3.23.0; vorher **Ordner**).
- Archive nur über den Browser, Bilder aus der App und was der Mensch tut: [R9.6](R9-archives.md#R9.6), [R9.9](R9-archives.md#R9.9).
- **Ab App 3.30.0:** der geöffnete Eintrag in der App beginnt mit dem Block **Liefern** (welche Bilder und in welchen
  Ordner) mit den Schritten **Archiv-Website ↗** → **Ordner des Buchs öffnen** oder **Ordner öffnen** → **Bilder
  hinzufügen** ([S4.4.7](S4-research-from-the-app.md#S4.4.7)).
- **Ab Forschung 1.35.0:** ein anders erfasstes Warten auf Bilder (Bilder nur in Worten, mehrere Bücher, ein Buch, das
  die Forschung nicht hat) schreibt `strom task wait` nicht, und `strom task audit` findet solche Aufgaben und
  korrigiert sie ([R6.9](#R6.9)).
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
- **Bedienung:** Terminal: `strom task wait T… --check <Adresse> --on "<was>"`; in **Was wartet** **Was ist dort?**,
  `strom task wake T… --check=works|view|no`.
- **Gilt seit:** Forschung 1.14.0

<!-- zdroj: research:src/commands/tasks.ts:439-470 checkUrl (task.check-search) · src/core/model.ts:510 CHECK_ANSWERS · src/core/waiting.ts:51-65 SECTION · src/cli/menu-waiting.ts:637 checkSite -->

<a id="R6.3"></a>
## R6.3 Entscheidungen

Der Abschnitt **Entscheidungen** sammelt Fragen, die den Agenten aufhalten: Erlaubnis eines Archivs, zu bestätigende
Downloader, mildere Bedingungen, Seite prüfen, Erzählung, Ort (siehe [R4](R4-places.md)), Widerspruch (siehe [R5](R5-conflicts.md)), Hypothese (siehe
[R6.3.4](#R6.3.4)), Stammbäume aus der App, das Lesen der Scans und ein vorgeschlagener Wortlaut einer Abschrift (Gruppe **Abschriften
zu entscheiden**, siehe [R3.4.1](R3-verification-and-citation.md#R3.4.1)). Entscheidungen stehen in der Liste zuerst.

- **Bedienung:** Terminal: **Was wartet** → Eintrag; `strom allow archive --way`, `strom place answer`,
  `strom conflict resolve`, `strom media calibrate --answer`.
- **Gilt seit:** Forschung 1.14.0. Widersprüche seit 1.20.0, Orte seit 1.25.0, Hypothesen seit 1.28.0, Abschriften seit 1.29.0.

<!-- zdroj: research:src/core/waiting.ts:51-65 SECTION, :75 DECIDE_RANK · src/cli/menu-waiting.ts:486 decideConflictHere, :518 decidePlace, :712 decideTune · CHANGELOG.cs.md 1.20.0, 1.25.0 · 1.29.0: src/core/waiting.ts:375-390 (kind transcript, section decide, wait.group.transcripts) -->

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
- Nach den Vorschlägen warten offene Hypothesen ohne Vorschlag. Wahl: **Entscheiden** (eine Version oder keine, mit
  dem Text der Entscheidung), **Offen lassen**. Eine offen gelassene Hypothese erscheint in Was wartet wieder, sobald
  der Agent vorschlägt, wie sie zu entscheiden ist.
- Eine entschiedene oder verworfene Hypothese, aus dem Menü geöffnet, bietet **Entscheidung ändern**: der neue Text der
  Entscheidung ist nötig und zugleich der Grund der Änderung. Hat der Agent sie entschieden, steht bei ihr **Vom
  Agenten entschieden (Tag).**
- **Grenzen:** das gilt, wenn der Mensch die Hypothesen entscheidet (gespeicherte Wahl **Der Mensch entscheidet**;
  ohne gespeicherte Wahl entscheidet die KI, [R10.3.2](R10-people-and-hypotheses.md#R10.3.2)); es entscheidet nur der
  Mensch ([R6.6](#R6.6)). Warten 10 oder mehr offene Hypothesen, bietet die App in **Was die Forschung weiß** das
  Umstellen auf **Die KI entscheidet** an (bestätigt in der Forschung). Bei **Die KI
  entscheidet** entscheidet der Agent selbst, was ein zitierter Eintrag belegt, und es warten nur seine Vorschläge
  (Entscheidungen, die er nicht selbst treffen darf). Die Strom-App, die Hypothesen entscheiden kann, zeigt die Gruppe
  auch ([S3.5.2](S3-what-the-research-knows.md#S3.5.2)); eine ältere App bekommt sie nicht ([R6.1.1](#R6.1.1)). Im
  Strom-Archiv gibt es die Gruppe nicht.
- **Bedienung:** Terminal: **Was wartet** → Eintrag, `strom hypothesis decide H… --proposed | --keep-open`. Dieselbe
  Wahl gibt es in der Durchsicht einer Person: **Die Forschung erweitern** → **Eine Person durchsehen** → **Hypothesen
  zur Person (n)**.
- **Gilt seit:** Forschung 1.28.0
- **Ab Forschung 1.29.0:** auch offene Hypothesen ohne Vorschlag (**Entscheiden**, **Offen lassen**), **Entscheidung
  ändern** und die Wahl **Wer die Hypothesen entscheidet**.

<!-- zdroj: research:src/core/waiting.ts (kind hypothesis, section decide, DECIDE_RANK 0, open: priority -1 a hypothesesOpen jen při person, leftOpen, TERMINAL_ONLY hypotheses, actsAsArchive) · src/cli/menu-waiting.ts decideHypothesis (proposed / open / decided) · src/cli/menu-research.ts:532 · assets/lang/cs.json wait.group.hypotheses, ui.wait.hypothesis.proposed/accept/other/keep/decide/keepOpen/change/byAgent · CHANGELOG.cs.md 1.29.0 · src/cli/wizard.ts 5c (doporučení) · app:src/ui/person-research-ui.ts HYPOTHESES_OFFER_MIN -->

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
- **Ab Forschung 1.35.0:** die Forschung sendet beim Eintrag auch sein Buch. Die App 3.30.0 kann die Einträge nach
  Buch gruppieren ([S4.4.4](S4-research-from-the-app.md#S4.4.4)); in **Was wartet** gibt es eine Übersicht der Bücher
  mit den meisten Aufgaben ([R6.8](#R6.8)).

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
- **Bedienung:** Terminal: **Mit Text antworten** (höchstens 300 Zeichen), `strom task wake T… --answer "<Text>"`.
- **Gilt seit:** Forschung 1.14.0. Orte seit 1.25.0.
- **Ab Forschung 1.26.0:** nur der Mensch auch: Freigabe und Verwerfen einer Erzählung (`strom story
  approve|discard`; dem Agenten lehnt die Forschung auch `strom story set --final` ab), die Antwort auf einen
  wachsenden Zweig (`strom offline answer`), das Überlassen eines Widerspruchs aus einer Änderung an den Agenten
  (`strom conflict leave`), das Zurücknehmen und Verwerfen eines Sendens aus der App (`strom sync undo|discard`) und
  die Korrekturen `strom fixes … edit-decisions|woken-waits`.
- **Ab Forschung 1.28.0:** nur der Mensch entscheidet auch eine Hypothese (`strom hypothesis decide`, auch innerhalb
  von `strom batch`); der Agent schlägt sie nur vor ([R10.3.1](R10-people-and-hypotheses.md#R10.3.1)).
- **Ab Forschung 1.29.0:** das gilt bei **Der Mensch entscheidet**; ohne gespeicherte Wahl entscheidet die KI
  ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)). **Die KI entscheidet** dort speichern, wo **Der Mensch
  entscheidet** gespeichert ist, oder diese Wahl entfernen, darf nur der Mensch. Nur der Mensch entscheidet auch, was mit einer erneut gelesenen
  Quelle weiter geschieht (`strom source reading`, [R8.8.3](R8-reading-scans.md#R8.8.3)), und über einen
  vorgeschlagenen Wortlaut einer Abschrift, die er geschrieben oder bestätigt hat (`strom source proposal`, auch die
  Rücknahme, [R3.4.1](R3-verification-and-citation.md#R3.4.1)).
- **Ab Forschung 1.35.0:** nur der Mensch entscheidet auch, ob eine kürzere Notiz eines Beteiligten aus der App
  übernommen wird (`strom sync note`, [S2.3.2](S2-edits-from-the-app.md#S2.3.2)); der Agent führt nur die Antwort
  des Menschen auf diese Aufgabe aus.

<!-- zdroj: research:src/commands/tasks.ts:897-970 (requireHuman :941, task.check-person :932) · src/commands/archives.ts:586-645 · src/commands/calibrate.ts:320 · src/commands/placeid.ts:343 person · assets/method/waiting.md, narrate.md:26-31 · src/cli/menu-waiting.ts:45 ANSWER_MAX · 1.26.0: userOnly u story approve/discard, offline answer, conflict leave, sync undo/discard (commity 4683a22d, 1189532f, 942c56f9), fixes.ts edit-decisions/woken-waits (person at the terminal) · 1.28.0: analysis.ts hypothesis decide (person), batch.ts def.person (commit 9b12256a) · 1.29.0: setup.ts syncDecisions hypotheses.decide (requireHuman), config.ts hypothesesDecide výchozí agent; strom help source reading („The person's alone … an agent never decides it“), strom help source proposal („Only the person decides it“) · 1.35.0: research:fb94435f src/commands/sync.ts sync note (person, agentMay s odpovědí), src/core/shorternote.ts decideShorterNote (shorter.person) -->

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
  `strom intake <Datei> --answers T…`, `strom task wake T… --answer "<Text>"`.
- **Gilt seit:** Forschung 1.3.0 (in Worten). Als Datei seit 1.14.0.

<!-- zdroj: research:src/commands/intake.ts:164-205 (--answers) · src/core/taskfiles.ts fileRefused · src/commands/tasks.ts:969 answers · src/core/live.ts PUT /media X-Strom-Task -->

<a id="R6.7.2"></a>
### R6.7.2 Wann eine Aufgabe von selbst zurückkehrt, und das Zurückstellen

- Eine Aufgabe kehrt von selbst zurück, wenn in die Forschung Bilder des Buches gespeichert werden, auf das sie wartet
  oder das sie nennt, oder wenn ein Archiv eine Entscheidung bekommt ([R6.3.1](#R6.3.1)).
- Eine zurückgestellte Aufgabe steht weder in der Liste noch in der Warteschlange. Mit einem Datum `--until` kehrt sie
  von selbst zurück und ist an diesem Tag schon offen. Ohne Datum wartet sie, bis sie jemand weckt. Das Zurückstellen
  verlangt einen Grund.
- **Bedienung:** Terminal: `strom task park T… --reason "<warum>" --until JJJJ-MM-TT`, zurück mit `strom task wake T…`.
  App: Abschnitt **Warteschlange**, **Zurückstellen** (Link ins Terminal, ohne Datum).
- **Gilt seit:** Forschung 1.0.0. Rückkehr nach Bildern seit 1.15.0, nach der Entscheidung eines Archivs seit 1.14.0.
- **Ab Forschung 1.26.0:**
  - Bilder bringen nur eine Aufgabe zurück, die auf Bilder genau dieses Buches wartet. Eine Aufgabe, die auf das
    Prüfen einer Seite durch den Menschen wartet, bringen sie nie zurück. Einen Brief, eine Anfrage an die Familie
    oder eine Seite bringt nur das Buch zurück, auf das die Aufgabe wartet, nicht ein Buch, in dem sie nur arbeitet;
  - seit Forschung 1.27.0 bringt eine Aufgabe, die auf eine Seite wartet (`--kind web`), auch das einzige Buch
    zurück, in dem sie arbeitet: die dort gespeicherten Bilder sind das, worauf sie gewartet hat. Einen Brief und eine
    Anfrage an die Familie weiter nur das Buch, auf das sie warten;
  - seit Forschung 1.35.0 bringt eine Aufgabe, die auf eine Seite wartet, statt des einzigen Buchs, in dem sie
    arbeitet, das Buch zurück, unter dem sie wartet ([R6.8.4](#R6.8.4)). Eine Aufgabe, die ohne Buch wartet, bringt
    nur das Buch zurück, das sie nennt;
  - Aufgaben, die Bilder früher zu Unrecht zurückgebracht haben, setzt die Korrektur `strom fixes show|run|undo
    woken-waits` wieder ins Warten: die Aufgabe wartet wie vorher, samt dem Senden. Eine Aufgabe, an der
    inzwischen gearbeitet wurde, bleibt. Die Korrektur startet nur der Mensch im Terminal, im Strom-Archiv gibt es sie
    nicht. Solange sie nicht gelaufen ist, weist `strom check` auf solche Aufgaben hin.

<!-- zdroj: research:src/commands/media.ts:135-170 wakeWaiting (1.26.0: awaits jen ta kniha, check nikdy, letter/family/web jen waitingOn; 1.27.0: web i singleBook) · src/commands/fixes.ts:835 woken-waits (commit 740e1893) · src/core/archivewait.ts:188 wakeForArchive · src/commands/tasks.ts:880-895 task park · src/core/queue.ts:112 effectiveState · app:src/ui/research-ui.ts:3473-3500 -->

<a id="R6.8"></a>
## R6.8 Bücher mit den meisten Aufgaben

Die Forschung zählt, welche Bücher die meisten ihrer Aufgaben brauchen. Ein Herunterladen des Buchs von Hand dient
dann allen seinen Aufgaben auf einmal. Es ist ein Angebot, kein Eintrag, der wartet: in die Zahl **Wartet: N** zählt
es nicht, und ohne Herunterladen liest der Agent das Buch weiter online.

- **Prüft der Code:**
  - gezählt werden offene (auch begonnene), zurückgestellte und wartende Aufgaben. Das Buch einer Aufgabe ist ein
    Buch (B…), das die Aufgabe darin nennt, wo sie arbeitet, ein Buch, auf dessen Bilder sie wartet, und bei einer
    wartenden Aufgabe das Buch, das ihr der Agent gegeben hat (`--book`, [R6.8.4](#R6.8.4)). Eine Aufgabe, die kein
    Buch nennt, zählt nicht, und es wird ihr kein Buch zugedacht: die Zahlen sind eine Untergrenze, keine Schätzung;
  - ein in ein anderes zusammengeführtes Buch zählt als das andere, ein zurückgezogenes Buch als keines;
  - Reihenfolge: die meisten Aufgaben, bei Gleichheit die meisten wartenden, dann die Nummer des Buchs;
  - beim Buch: Archiv, Jahre, Zugang, wie viele Aufgaben es brauchen (davon warten und zurückgestellt), Bilder
    insgesamt, auf der Festplatte und fehlend (insgesamt und fehlend nur, wo der Katalog die Zahl der Bilder kennt),
    benötigte Bilder, die noch nicht auf der Festplatte sind (die Nummern, auf die seine wartenden Aufgaben warten),
    der Ordner im gemeinsamen Ordner und die Adresse des Buchs;
  - ein Buch wird zum Herunterladen **angeboten**, wenn es mindestens `books.minTasks` Aufgaben brauchen (Standard 5,
    [R6.8.3](#R6.8.3)), der Zugang frei oder mit Anmeldung ist (`online-free`, `online-login`), es nicht ganz auf
    der Festplatte ist und es etwas anzubieten gibt: das ganze Buch, wo die Bedingungen des Archivs es erlauben,
    sonst benötigte Bilder, die noch nicht auf der Festplatte sind ([R6.8.1](#R6.8.1)). Ein Buch, aus dem die
    Bedingungen nichts herunterzuladen erlauben, wird nie angeboten;
  - das Strom-Archiv bietet keine Bücher an ([R7.8](R7-when-the-agent-works.md#R7.8)).
- **Der Agent bei einer Aufgabe:** zu Beginn einer Aufgabe erfährt der Agent, welche weiteren Aufgaben dasselbe Buch
  brauchen, damit er sie zusammen erledigt: im Briefing beim Buch und in `strom task show` die Zeile „the same book is
  needed by N more tasks: …“. Zuerst offene, dann wartende und zurückgestellte, höchstens 10 Nummern von Aufgaben,
  der Rest als Zahl.
- **Bedienung:** Terminal:
  - `strom task books`: angebotene Bücher; `--min <n>` eine andere Grenze nur für diese Ausgabe (1–999), `--all`
    jedes Buch, das irgendeine Aufgabe braucht, `--json`;
  - `strom task list --book B…`: Aufgaben eines Buchs, offene zuerst, dann zurückgestellte und wartende; mit
    `--state` nur Aufgaben dieses Zustands;
  - Menü **Was wartet**: Taste **k** „Bücher mit den meisten Aufgaben N“; wenn nichts wartet, erscheinen die Bücher
    unter **Nichts wartet.** Der Bildschirm zeigt höchstens 9 Bücher, die übrigen `strom task books`.

  App: Wartet auf Bearbeitung, Gruppen nach Buch und **Schneller durch Herunterladen**
  ([S4.4.4](S4-research-from-the-app.md#S4.4.4), [S4.4.5](S4-research-from-the-app.md#S4.4.5)).
- **Warum:** Bilder gehören zum Buch, nicht zur Aufgabe: ein Ordner und ein Herunterladen dienen allen Aufgaben des
  Buchs.
- **Gilt seit:** Forschung 1.35.0

<!-- zdroj: research:c533bc0e, 198eed31, b1749433 src/core/books.ts needsBooks (open, doing, parked, waiting; ne proposal ani shorterNote), liveBook (mergedInto, retracted), booksOfTask (where B…, awaits.recordset), bookRows (registered, missing jen s images, need = awaits.images bez registrovaných, řazení tasks ↓, waiting ↓, id), offerable (minTasks, DOWNLOADABLE online-free/online-login, missing !== 0, whole nebo range/selected s needCount), tasksOfBook (open, parked, waiting), sameBookLine (SAME_BOOK_IDS_MAX 10) · src/brief/brief.ts sameBookLine u knihy (ne u odhadnutého místa) · src/commands/tasks.ts task books (--min 1–999, --all, --json), task list --book (task.book), taskDetail řádek book · src/cli/menu-waiting.ts booksHere (actsAsArchive → žádné), showBooks (BOOKS_SHOWN 9), ui.wait.c.books · src/cli/menu.ts (Nic nečeká → showBooks) · assets/lang/cs.json ui.wait.c.books, ui.books.* · CHANGELOG.cs.md 1.35.0 „Knihy s nejvíc úkoly“ · dirigent:spec/105-co-nejvic-pomuze K1.1–K1.3 -->

<a id="R6.8.1"></a>
### R6.8.1 Was sich aus einem Buch herunterladen lässt: die Bedingungen des Archivs

Was die Forschung aus einem Buch anbietet, bestimmen die Bedingungen des Archivs. Die Liste der Archive, die der
Stammbaum bei sich hat, gibt beim Archiv an, was der Mensch aus einem Buch von Hand herunterladen darf, mit einem
wörtlichen Zitat der Bedingungen, ihrer Seite oder einer schriftlichen Antwort des Archivs.

- **Prüft der Code:**

  | Bedingungen des Archivs | Was angeboten wird |
  |---|---|
  | das Archiv bietet das ganze Buch an (Schaltfläche, ZIP), oder die Bedingungen erlauben, es herunterzuladen | das ganze Buch |
  | nur ausgewählte Bilder, nie das ganze Buch oder ein wesentlicher Teil davon | nur benötigte Bilder, die nicht auf der Festplatte sind |
  | nichts | nichts, das Buch wird nicht angeboten |
  | die Liste kennt das Archiv nicht | benötigte Bilder, die nicht auf der Festplatte sind |

  - es entscheidet die Adresse des Buchs, sonst die Adresse seines Archivs;
  - die benötigten Bilder kennen nur Aufgaben, die auf Bilder warten. Ein Buch ohne wartende Aufgabe wird daher außer
    bei Archiven, die das ganze Buch erlauben, nicht angeboten.
- **Beispiele aus der Liste:** das ganze Buch: eBadatelna SOA Praha (herunterladen dürfen Registrierte) und
  weitere Archive, deren Bedingungen es erlauben; nur ausgewählte Bilder: DigiArchiv SOA Třeboň (schriftliche
  Antwort des Archivs); nichts: FamilySearch, Archion. Moravský zemský
  archiv hat in der Liste keine Angabe (das wörtliche Zitat fehlt): angeboten werden die benötigten Bilder
  ([R9.10.1](R9-archives.md#R9.10.1)).
- **Grenzen:** die Bedingungen des Archivs gehen dem Angebot vor. Das ganze Buch bieten App und Terminal nur an, wenn
  die Bedingungen es sagen.
- **Bedienung:** Terminal: `strom task books --json` (das Feld `download`: `whole`, `range`, `selected`, `none`, und
  das Zitat `downloadTerms`). App: „Ganzes Buch herunterladbar“, „Bilder … herunterladbar“, „Ausgewählte Bilder …
  herunterladbar“ ([S4.4.4](S4-research-from-the-app.md#S4.4.4)).
- **Gilt seit:** Forschung 1.35.0

<!-- zdroj: research:b1749433 assets/archives.json wholeBook {how offered|allowed|selected|never, says, from terms|termsPage|reply} (ebadatelna.soapraha.cz offered termsPage; digi.ceskearchivy.cz, www.ceskearchivy.cz selected reply; aron./imgx.vychodoceskearchivy.cz, vychodoceskearchivy.cz, www.landesarchiv-nrw.de, apertus.rlp.de allowed terms; agad.gov.pl, agadd*.home.net.pl allowed reply; familysearch.org, www.archion.de never; mza.cz bez wholeBook) · src/core/terms.ts wholeBookFor · src/core/books.ts downloadOf (b.url, jinak repo.url; bez údaje range), offerable · karta prace/1116-vyzkum-105-knihy-a (V4: čísla snímků znají jen čekající úkoly), -b (MZA bez citace, range) · spec 105 rozhodnutí U1 -->

<a id="R6.8.2"></a>
### R6.8.2 Bilder im Ordner des Buchs

Bilder, die der Mensch in den Ordner eines Buchs im gemeinsamen Ordner speichert, übernimmt strom von selbst, auch
wenn keine Aufgabe auf das Buch wartet. Sie gehören zum Buch, und alle seine Aufgaben lesen sie dann von der
Festplatte.

- **Prüft der Code:**
  - der Ordner ist derselbe wie beim Warten auf Bilder, `inbox/<B… Buchtitel>` ([R9.6](R9-archives.md#R9.6)). Ihn
    legt der Link **Ordner öffnen** aus der App an, ohne Terminal; die Brücke beobachtet nur Ordner, die es schon gibt;
  - Übernahme: sofort, wenn die Brücke zur Strom-App läuft (eine Datei erst nach 3 s ohne Änderung); sonst beim Start
    der nächsten Sitzung; oder mit dem Befehl `strom media add --inbox --waiting`. Zuerst die Ordner wartender
    Aufgaben, dann die Ordner der Bücher;
  - die Nummer des Bildes kommt **nur aus dem Dateinamen** (`40.jpg`), nie aus der Reihenfolge. Eine Datei ohne
    Nummer bleibt im Ordner liegen, und die Ausgabe sagt, wie viele liegen geblieben sind; die übrigen werden
    übernommen. Hat keine Datei eine Nummer, wird nichts übernommen, und die Forschung sagt, wie die Dateien zu
    benennen sind;
  - Dateien JPEG 2000 (`.jp2`) aus dem Portal des Moravský zemský archiv haben im Namen das Bild × 10: strom rechnet
    sie zurück. Eine Zahl, die kein Vielfaches von 10 ist, ist keine Bildnummer, und die Datei bleibt liegen;
  - ein Buch, das ganz auf der Festplatte ist, verschwindet aus dem Angebot. Dateien, die im Ordner liegen und noch
    nicht übernommen sind, zeigt die App als „N Dateien werden übernommen“;
  - eine Kopie vom Dateimanager („33 2.jpg“, „33 kopie.jpg“) ist Bild 33, und eine Datei, die derselbe Scan ist wie
    ein Bild unter einer anderen Nummer, wird daneben als `<Datei>.same-as-M…` abgelegt und gemeldet, nie still
    gelöscht; ebenso wie im Ordner einer wartenden Aufgabe ([R9.6](R9-archives.md#R9.6)).
- **Grenzen:** die Ordner wartender Aufgaben folgen [R9.6](R9-archives.md#R9.6) (dort werden anders benannte Dateien
  auch nach der Reihenfolge nummeriert).
- **Bedienung:** Terminal: `strom media add --inbox --waiting`, der Ordner in `strom task books`. App: **Ordner
  öffnen** beim Buch ([S4.4.4](S4-research-from-the-app.md#S4.4.4)).
- **Gilt seit:** Forschung 1.35.0

<!-- zdroj: research:b1749433 src/core/inboxwait.ts bookFolders (knihy, které úkoly potřebují, bez čekající složky; nic se nevytváří), imageFileTimesOf (assets/archives.json mza.cz imageFileTimes 10) · edfd2b88 numberBookFiles (jen čísla ze jmen, .jp2 ÷ times, nenásobek → bez čísla, left; žádné číslo → inbox.unnamed), src/commands/media.ts (po čekajících složky knih, book: true, „N file(s) left lying“), src/core/live.ts (live.log) · src/core/inboxwatch.ts (most hlídá i složky knih) · src/commands/links.ts book?tree=&id=&do=folder (mkdir, openForUser, bez terminálu) · src/core/live.ts booksStatus pending · CHANGELOG.cs.md 1.35.0 „Snímky uložené do složky knihy“ · karta prace/1116-vyzkum-105-knihy-c · research:dddeb8a6 numberBookFiles stem = copyless(f), takeFiles same-as (i u knih: asideLine(b, …)) · 18fd10ec -->

<a id="R6.8.3"></a>
### R6.8.3 Einstellungen der Bücher

Ab wie vielen Aufgaben ein Buch angeboten wird und ob die Warteschlange im selben Buch weitermacht, hat jede
Forschung für sich.

- **Prüft der Code:**
  - `books.minTasks`: ab wie vielen Aufgaben ein Buch angeboten wird ([R6.8](#R6.8)). Ganze Zahl von 1 bis 999,
    Standard 5;
  - `queue.sameBook`: `no` (Standard: der Agent bekommt nur einen Satz über die weiteren Aufgaben des Buchs) oder
    `yes` (die Warteschlange nimmt nach einer Sitzung in einem Buch mit Bildern auf der Festplatte zuerst die nächste
    Aufgabe desselben Buchs, [R2.2.4](R2-lines-and-queue.md#R2.2.4));
  - eine Änderung im Terminal zeigt sich in der App und umgekehrt (die App schreibt über die Brücke mit denselben
    Befehlen).
- **Bedienung:** Terminal: `strom config set books.minTasks <1–999> --for-tree`,
  `strom config set queue.sameBook yes|no --for-tree`, der Standardwert `strom config unset … --for-tree`; Menü
  **Einstellungen › Archive › Bücher mit den meisten Aufgaben** (**Ein Buch zum Herunterladen von Hand angeboten ab
  N Aufgaben**, **Die nächste Sitzung im selben Buch**). App: **Forschung für diesen Stammbaum › Bücher**
  ([S4.4.6](S4-research-from-the-app.md#S4.4.6)).
- **Gilt seit:** Forschung 1.35.0

<!-- zdroj: research:b1749433 src/core/config.ts BOOKS_MIN_TASKS 5, BOOKS_MIN_TASKS_MAX 999, SETTINGS books.minTasks, queue.sameBook (tree, no|yes), validace „whole number from 1 to 999“ · src/cli/menu-settings.ts booksSettings (1 ui.books.min, 2 ui.books.same), položka Archivy ui.archives.books (poslední) · src/core/live.ts POST /books (config set/unset --for-tree), booksSettings · assets/lang/cs.json ui.books.settings.title, ui.books.min, ui.books.same · CHANGELOG.cs.md 1.35.0 „Knihy v aplikaci Strom a jejich nastavení“ -->

<a id="R6.8.4"></a>
### R6.8.4 Unter welchem Buch eine Aufgabe wartet

Eine wartende Aufgabe gehört unter das Buch, das durchsucht werden muss, nicht unter das Buch, in dem der Agent die
Spur gefunden hat (eine Notiz in einer Geburtsmatrik, die zu den Trauungen einer anderen Pfarrei führt). Unter diesem
Buch zeigt sie die Strom-App in den Gruppen nach Buch ([S4.4.4](S4-research-from-the-app.md#S4.4.4)), und in seinen
Ordner werden die Bilder für eine Aufgabe gespeichert, die auf eine Website wartet.

- **Prüft der Code:** das Buch einer wartenden Aufgabe, in dieser Reihenfolge:
  1. die Aufgabe wartet auf Bilder mit Nummern (`--images`): das Buch dieser Bilder;
  2. das Buch, das der Agent der Aufgabe gegeben hat (`strom task wait|edit --book B…`);
  3. das einzige Buch, dessen Nummer (B…) im Text dessen steht, worauf die Aufgabe wartet, und das nicht unter den
     Büchern ist, in denen die Aufgabe arbeitet. Bei mehreren Nummern gelten die nächsten Punkte;
  4. die Aufgabe wartet auf eine Website oder auf das Prüfen einer Website (`--kind web`, `--check`), arbeitet in
     einem Buch und nennt daneben in freiem Text einen Ort oder ein Buch, das erst gesucht wird: **ohne Buch** (in der
     App unter **Ohne Buch**). Nummern von Datensätzen (B…, R…) zählen nicht als freier Text;
  5. sonst das einzige Buch, in dem die Aufgabe arbeitet; keines oder mehrere: ohne Buch.
- **Was sich danach richtet:**
  - das Buch des Eintrags in der Strom-App und die Zahlen der Bücher ([R6.8](#R6.8); das Buch aus `--book` zählt
    neben dem Buch, in dem die Aufgabe arbeitet);
  - eine Aufgabe, die auf eine Website wartet: ihr Ordner im gemeinsamen Ordner (in **Was wartet** **Den Ordner
    öffnen**, in der App der Block **Liefern**, [S4.4.7](S4-research-from-the-app.md#S4.4.7)) und die Rückkehr der
    Aufgabe nach dem Speichern von Bildern hinein ([R6.7.2](#R6.7.2)). Eine Aufgabe ohne Buch hat keinen Ordner, und
    der Ordner des Buchs, in dem die Spur gefunden wurde, wird ihr nicht angeboten.
- **Grenzen:**
  - nur für wartende Aufgaben. Warteschlange, offene und zurückgestellte Aufgaben bleiben beim Buch, in dem die
    Aufgabe arbeitet;
  - nichts wird überschrieben: die Punkte 3–5 werden beim Lesen ermittelt, der Text des Wartens und die Antworten der
    Menschen ändern sich nicht;
  - `--book` nur bei einer wartenden Aufgabe und nur mit einem lebenden Buch (ein unbekanntes oder zurückgezogenes ist
    ein Fehler). Mit `--images` nur dasselbe Buch wie bei den Bildern, ein anderes ist ein Fehler. Eine neue
    Einstellung des Wartens löscht `--book` ([R6.2](#R6.2)). Ein älteres strom lässt das Feld, wie es ist.
- **Der Agent bei einer Aufgabe:** `strom task show` zeigt die Zeile `book B… — the book to be searched`. Hat eine
  Aufgabe, die auf eine Website oder auf das Prüfen einer Website wartet, kein Buch, sagt die Ausgabe von
  `strom task wait` dem Agenten, wie er es ihr gibt, sobald es angelegt ist (`strom recordset add`, dann
  `strom task edit T… --book B…`).
- **Nur Methodik:** Leitfaden des Agenten: das Buch zum Durchsuchen, nicht das, in dem die Spur gefunden wurde:
  `--book B…`.
- **Warum:** lieber kein Buch als ein fremdes.
- **Bedienung:** Terminal: `strom task wait T… --kind web --book B… --on "<was>"`, `strom task edit T… --book B…`,
  `strom task show T…`. App: **Wartet auf Bearbeitung**, Gruppen nach Buch
  ([S4.4.4](S4-research-from-the-app.md#S4.4.4)).
- **Gilt seit:** Forschung 1.35.0

<!-- zdroj: research:8d19d4f6 src/core/books.ts waitTarget (jen waiting bez awaits: wait.book → jediné živé B… ve waitingOn mimo where (BOOK_ID_IN) → null pro web/check s jednou knihou ve where a volným textem (RECORD_ID) → undefined), bookOfTask (awaits → waitTarget → jediná kniha where), booksOfTask (+ wait.book u waiting) · src/core/inboxwait.ts webWaitBook, inboxWaitOf (web) · src/commands/media.ts wakeWaiting (web: named || webWaitBook) · src/core/waiting.ts:441 book · src/core/live.ts:2180 · src/commands/tasks.ts waitOptions --book (requireRecord recordset, liveBook → chyba vzatá zpět, s --images jen táž kniha), task edit (jen waiting, task.not-waiting), taskDetail řádek book, task wait řádek pro web/check bez knihy · src/core/model.ts wait.book · assets/method/core.md (locate, request) „The book to search, not the one the trail was found in: `--book B…`.“ · CHANGELOG.cs.md 1.35.0 „Čekající úkol pod knihou, kterou je třeba prohledat“ · dirigent:prace/1117-vyzkum-kniha-cile (Návrh A–F, „lepší žádná kniha než cizí“), 1117-research-kniha-cile -->

<a id="R6.9"></a>
## R6.9 Prüfung, wie das Warten erfasst ist: `strom task audit`

Eine Aufgabe, die auf Bilder wartet, die der Mensch von Hand speichert, kehrt nur dann von selbst in die
Warteschlange zurück, wenn ihr Warten so erfasst ist, wie strom es braucht: Bilder eines Buchs der Forschung nach
Nummern (`--images B…:<Nummern>`) oder nach Buch (`--kind web --book B…`). Ein Buch pro Aufgabe; das Buch ist in der
Forschung erfasst (B…) und hat einen Ordner im gemeinsamen Ordner. `strom task audit` findet wartende
Aufgaben, die anders erfasst sind, und nennt zu jeder eine Korrektur.

- **Prüft der Code:**
  - geprüft werden wartende Aufgaben, die nicht zurückgezogen sind, nicht auf eine Prüfung oder eine Erlaubnis warten
    und nicht auf einen Brief, die Familie oder anderes warten;
  - Befunde:

    | Code | Was falsch ist |
    |---|---|
    | `images-as-text` | die Bilder eines Buchs stehen nur in Worten, ohne Buch und Nummern; auch ein Warten nach Buch, dessen Text genaue Bildnummern dieses Buchs nennt |
    | `several-books` | ein Warten will Bilder aus zwei oder mehr Büchern |
    | `book-unknown` | ein Buch, das die Forschung nicht hat (B…) |
    | `folder-missing` | der Aufgabe fehlt ihr Ordner im gemeinsamen Ordner; nur wenn sich das Warten sonst nicht ändert |

  - eine Schätzung („≈ Bild 160“, „etwa“, „ca.“) ist keine Bildnummer. Wörter für Bilder werden auf Tschechisch,
    Deutsch, Englisch und Polnisch erkannt;
  - zu jedem Befund gibt es die Korrektur, die strom vorschlägt: ganz (`whole`), teilweise (`part`) oder keine
    (`none`, die Korrektur schreibt der Agent), und die genauen Befehle ([R6.9.1](#R6.9.1));
  - liest nur, kostenlos, ohne Netz. Eine Aufgabe, deren Warten der Mensch so gelassen hat, wird nicht aufgeführt
    ([R6.9.1](#R6.9.1)).
- **Der Agent bei einer Aufgabe:** dem Agenten wird der Befund gesagt, wenn er das Warten schreibt, und strom
  schreibt ein solches Warten nicht ([R6.9.2](#R6.9.2)).
- **Bedienung:** Terminal:
  - `strom task audit`: alle wartenden Aufgaben mit Befund; am Ende eine Checkliste für das Warten (`each wait: …`).
    Ohne Befund „every waiting task's wait is as strom needs it“;
  - `strom task audit T…`: eine Aufgabe; `--all` auch die Aufgaben, die der Mensch so gelassen hat; `--json`.

  App: Marke und Korrektur in **Wartet auf Bearbeitung** ([S4.4.8](S4-research-from-the-app.md#S4.4.8)).
- **Gilt seit:** Forschung 1.35.0

<!-- zdroj: research:61c95c53, 1fe47bf3, 15312d00, 6775c199 src/core/taskaudit.ts audited (waiting, ne retracted, awaitsCheck, awaitsPermission, ne letter/family/other), findingsOf (images-as-text, several-books, book-unknown, folder-missing jen se sdílenou schránkou a bez jiného přepisu), fixOf (can whole/part/none), odhad ≈/asi/cca není číslo, slova snímků cs/de/en/pl, WAIT_CHECKLIST · src/commands/tasks.ts task audit (--all, --json, „every waiting task's wait is as strom needs it“, each wait: checklist) · strom help task audit („Reads only, free, no network.“) · CHANGELOG.cs.md 1.35.0 · app:docs/ZADANI_VYZKUM_kontrola-ukolu.md „Odpověď výzkumu (U2)“ · dirigent:spec/109 K1.3 -->

<a id="R6.9.1"></a>
### R6.9.1 Korrektur in einem Schritt und der Weg zurück

Die Korrektur wird in einem Vorgang geschrieben und lässt sich zurücknehmen, solange sich nichts von ihr geändert
hat. Was der Mensch so lassen will, wie es ist, kann er so lassen.

- **Prüft der Code:**
  - `--fix` (Vorgang `task.audit-fix`, ein Commit): die Aufgabe wartet auf Bilder eines Buchs, nach Nummern, sonst
    nach Buch. Jedes weitere Buch bekommt eine eigene Aufgabe mit demselben Was, Warum und Erledigt, wenn, von der
    ursprünglichen abgetrennt. Der Text des Wartens wird so geteilt, dass kein Wort verloren geht: die Überschrift
    einer Liste geht mit jeder Aufgabe, der Schluss und die Teile ohne Buch bleiben bei der ursprünglichen, der
    Eintrag eines Buchs bleibt ganz;
  - ein Buch, das die Forschung nicht hat, bleibt ein Warten in Worten in einer eigenen Aufgabe: zuerst das
    Buch (`strom recordset add`), dann `--images`. Sind alle Bücher unbekannt, ändert strom nichts, und
    die Korrektur schreibt der Agent;
  - die Korrektur legt die Ordner an und übernimmt die Bilder, die schon darin liegen: eine Aufgabe, die alle Bilder
    hat, kehrt in die Warteschlange zurück;
  - `--expect <stamp>`: schreibt nur eine Aufgabe, die so ist wie beim Vorschlag der Korrektur, sonst lehnt es ab
    (`audit.changed`). Eine Aufgabe, die nicht mehr wartet, oder eine Korrektur ohne Änderung wird abgelehnt
    (`audit.none`);
  - `--unfix` (Vorgang `task.audit-unfix`) nimmt die Korrektur zurück, solange sich keine ihrer Aufgaben geändert hat,
    sonst `audit.changed`. Die abgetrennten Aufgaben werden zurückgezogen (nie gelöscht), die ursprüngliche Aufgabe
    wartet genau wie zuvor. Gespeicherte Bilder bleiben registriert;
  - `--keep` (Vorgang `task.audit-keep`): der Mensch lässt das Warten, wie es ist. Nur der Mensch; dem Agenten lehnt
    strom `--keep` und `--unkeep` ab (`audit.person-only`). Es gilt, solange sich das Warten nicht ändert und neue
    Befunde unter denen sind, die der Mensch gelassen hat. Geschrieben wird, wer es gegeben hat und wo (Terminal oder
    App). `--unkeep` (Vorgang `task.audit-unkeep`) nimmt es zurück.
- **Verlauf der Aufgabe:** `strom task show T…` zeigt die Zeile „audit  kept as it is …“ oder „fixed by the audit …
  (T… split off) — undone by strom task audit T… --unfix“.
- **App:** die Brücke gibt bei einem wartenden Eintrag den Befund (`audit`: Arten, Korrektur, Stempel), die Vorschau
  der Korrektur (`GET <token>/waiting/<T…>/fix`) und das Schreiben (`POST <token>/waiting/<T…>` mit
  `do: fix|unfix|keep|unkeep` und `expect`), Funktion `tasks.audit`. Das gilt auch im Strom-Archiv
  ([S4.4.8](S4-research-from-the-app.md#S4.4.8), [S4.4.9](S4-research-from-the-app.md#S4.4.9)).
- **Bedienung:** Terminal: `strom task audit T… --fix`, `--unfix`, `--keep`, `--unkeep`, `--expect <stamp>`,
  `--dry-run`. App: **Korrigieren**, **Rückgängig** in der Meldung, **So lassen**.
- **Gilt seit:** Forschung 1.35.0

<!-- zdroj: research:61c95c53, 15312d00, 6775c199 src/core/taskaudit.ts fixOf (wait-images / wait-book, split, left book-unknown, jen neznámé → nic), applyAuditFix (atomicky, expect → audit.changed, bez změn audit.none, before, rozdělení textu, splitFrom, op task.audit-fix), takeWaiting, sealAuditFix, undoAuditFix (audit.changed, dropped + retracted, original přesně, snímky zůstanou, op task.audit-unfix), keepAudit (auditKept at, by, givenIn, kinds, wait; podmnožina druhů; op task.audit-keep / task.audit-unkeep) · src/commands/tasks.ts task audit (--fix, --unfix, --keep, --unkeep, --expect jen s fix/keep, audit.person-only, STROM_FOR_APP → by app), task show řádky audit · strom help task audit · app:docs/ZADANI_VYZKUM_kontrola-ukolu.md „Odpověď výzkumu (U2)“ (most, kódy 409/404/503/423/507, i v archivu) · dirigent:spec/109 K1.5 -->

<a id="R6.9.2"></a>
### R6.9.2 Das Warten wird nicht falsch geschrieben, und der Agent erfährt es

Strom schreibt kein Warten mit Befund und sagt dem Agenten, was an der Aufgabe noch nicht so ist, wie es sein soll.

- **Prüft der Code:**
  - `strom task wait` und `strom task edit` mit `--on`, `--kind`, `--url` oder `--book` lehnen ein Warten mit Befund
    ab (`task.wait-images`) und geben die genauen Befehle. Ein fehlender Ordner wird nicht abgelehnt;
  - nach `strom task wait` bekommt der Agent die Zeile „check the task's wait: …“ mit einer Checkliste, wenn das
    Warten noch nicht so ist, wie es sein soll. `strom task park`, dessen Grund Bilder eines Buchs der Forschung
    nennt, sagt dem Agenten, dass von Hand gespeicherte Bilder ein Warten sind, kein Zurückstellen, mit dem genauen
    Befehl;
  - `strom session close` sagt dasselbe für die Aufgaben der Sitzung (`--json`: `audit`); `strom session finish`
    nicht;
  - `strom chat --task T…` beginnt bei einer Aufgabe mit Befund für den Agenten mit dem Satz „Ihr Warten ist nicht
    so geschrieben, wie strom es braucht (…). Führe `strom task audit T…` aus, schlage mir die Korrektur vor und
    schreibe sie erst, wenn ich hier zugestimmt habe.“
- **Grenzen:** der Agent schreibt die Korrektur erst nach der Zustimmung des Menschen im Gespräch. Das Warten so
  lassen, wie es ist, darf nur der Mensch ([R6.9.1](#R6.9.1)).
- **Bedienung:** Terminal: `strom task wait`, `strom task edit`, `strom task park`, `strom session close`,
  `strom chat --task T…`. App: **Mit Agent besprechen** bei einem Befund
  ([S4.4.8](S4-research-from-the-app.md#S4.4.8)).
- **Gilt seit:** Forschung 1.35.0

<!-- zdroj: research:61c95c53, 15312d00 src/core/taskaudit.ts refuseWait (task.wait-images, kromě folder-missing, waitCommands), WAIT_CHECKLIST · src/commands/tasks.ts checkWaitLine, parkedForImages · src/commands/session.ts:373 session close (check of each wait, --json audit) · assets/lang/cs.json ui.chat.task.audit.say, ui.chat.task.audit.images/books/unknown/folder.say · CHANGELOG.cs.md 1.35.0 · app:docs/ZADANI_VYZKUM_kontrola-ukolu.md „Odpověď výzkumu (U2)“ K1.1, K1.2, V11 · dirigent:spec/109 K1.1, K1.2 -->
