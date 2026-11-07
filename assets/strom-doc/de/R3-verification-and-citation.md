<a id="R3"></a>
# R3 Prüfung und Zitation

Wie die Forschung bestimmt, wie sicher jede Angabe ist, was gelten muss, damit sie belegt ist, und wie die App das
zeigt. Beschrieben werden die Forschung 1.25.2 und die Strom-App 3.21.2; Änderungen aus einer neueren Version tragen deren Nummer.
Bei den Regeln wird unterschieden, was **der Code prüft** (der Befehl `strom` lehnt den Eintrag sonst ab) und was nur
eine **Regel der Methodik** ist (eine Anweisung an den Agenten, die der Code nicht kontrolliert).

<a id="R3.1"></a>
## R3.1 Grade der Sicherheit einer Angabe

Jede Angabe (Geburt, Taufe, Heirat, Beruf…) hat einen von vier Graden der Sicherheit. Der Grad sagt, wie sicher die
Schlussfolgerung aus allen Quellen der Angabe ist, nicht, wie gut eine einzelne Quelle ist ([R3.2.1](#R3.2.1)).

| App | Terminal | Bedeutung nach der Methodik |
|---|---|---|
| **Belegt** | belegt | der Agent hat den ursprünglichen Eintrag selbst gelesen, und der Eintrag nennt die Angabe direkt |
| **Wahrscheinlich** | wahrscheinlich | guter Nachweis, aber indirekt, oder eine einzige Lesung einer schwierigen Schrift |
| **Möglich** | möglich | schwacher Nachweis |
| **Hinweis** | nur ein Hinweis | Familiengeschichte, Stammbaum, Register oder Schätzung: was zu prüfen ist, keine Angabe |

- **Grenzen:** eine Angabe kann auch widerlegt (`--status disproven`) oder zurückgezogen sein (`strom event retract
  E… --reason "…"`). Nichts wird gelöscht. Eine zurückgezogene Angabe wird nirgends gezeigt und lässt sich weder
  zitieren noch bearbeiten. `strom person show` zeigt übersetzte Namen nur dem Menschen; der
  Agent liest dort `proven`, `probable`, `possible`, `lead`.
- **Bedienung:** App: Etikett bei der Angabe (Ereignisse der Person, Heirat und Scheidung, gemeinsame Ereignisse des
  Paares), nur lesbar · Terminal: `strom person show`, `strom person card`, `strom stats` (Zeile „Angaben: belegt … ·
  nur Hinweise …“); Eintrag `strom event add … --status`, `strom cite E… S… --status`, `strom event edit E… --status …
  --reason "…"`.
- **Gilt seit:** Forschung 1.0.0; übersetzte Namen im Terminal 1.1.0 (bei `strom person show`
  1.12.0); Etikett in der App 3.9.0
- **Ab Forschung 1.26.0:** das Terminal nennt die Grade mit den Worten der App: **belegt**, **wahrscheinlich**,
  **möglich**, **Hinweis**, **widerlegt**. Die Zusammenfassung `strom stats` schreibt weiter „nur Hinweise“.

<!-- zdroj: research:src/core/model.ts:36 STATUSES · assets/method/core.md:8-12 · src/cli/human.ts:138 statusName · assets/lang/cs.json ui.st.*, ui.stats.facts · src/commands/people.ts:115 wordsFor · src/core/actions.ts:629 notRetracted · app:src/ui/fact-status.ts · strings.ts factStatus · 1.26.0: src/cli/human.ts:139 STATUS, cs.json ui.st.* (commit fe59fb40) -->

<a id="R3.1.1"></a>
### R3.1.1 Standardgrad und die Zitation, die ihn hebt

- Eine ohne `--status` erfasste Angabe: ohne Zitation **Hinweis**; mit Zitation mindestens einer Quelle, die nicht
  schwach ist ([R3.3](#R3.3)), **Wahrscheinlich**; sonst Hinweis. Ab Forschung 1.28.0 ist auch ein Register schwach.
- `strom cite` ohne `--status` hebt Hinweis auf Wahrscheinlich, wenn die neue Quelle nicht schwach ist. Einen anderen
  Grad ändert es nicht.
- Eine Änderung des Grades über `strom event edit --status` braucht `--reason`; eine Zitation mit Grad
  (`strom cite … --status`) nicht.
- Prüft der Code. **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:src/core/evidence.ts:49 defaultStatus · src/core/actions.ts:636-650 citeEvent, :903-913 event.needs-reason -->

<a id="R3.2"></a>
## R3.2 Was der Code als Wahrscheinlich und Belegt durchlässt

Der Grad darf nicht mehr behaupten, als die Zitationen der Angabe hergeben. Der Code prüft das bei jedem Eintrag
eines Grades: `event add`, `cite`, `event edit` und auch bei Angaben, die aus der App kommen.

- **Grenzen (prüft der Code),** in dieser Reihenfolge:
  1. Wahrscheinlich und Belegt brauchen mindestens eine Zitation.
  2. Mindestens eine Zitation muss aus einer Quelle stammen, die nicht schwach ist. Schwach sind ein Stammbaum
     (`--kind family-tree`), eine Erinnerung (`--kind family-memory`), ein verfasstes Werk (`--form authored`) und ab
     Forschung 1.28.0 ein Register (`--kind index`).
  3. Belegt braucht zusätzlich unter den Zitationen aus nicht schwachen Quellen mindestens eine mit
     Primärinformation (`--information primary`): ein Eintrag, zur Zeit des Ereignisses geschrieben von jemandem,
     der es wusste. Die Information bei der Zitation hat Vorrang vor der Information bei der Quelle.
- **Nur Methodik:** der Code prüft nicht, dass die Quelle eine Originalquelle ist (`--form original`), dass der Agent
  sie selbst gelesen hat, dass der Eintrag die Angabe direkt nennt, und auch nicht die blinde zweite Lesung
  ([R3.5](#R3.5)). Belegt geht darum auch bei einer Kopie mit Primärinformation durch (bei einem Register bis
  Forschung 1.27.0 ebenfalls).
- **Bedienung:** Terminal: `strom event add P… BIRT --date "…" --cite S… --information primary --status proven`.
  Die Ablehnung nennt den Grund und was stattdessen geht (Hinweis lassen, `--status possible` oder
  `--status probable`).
- **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:src/core/evidence.ts:27 isWeak, :32 informationOf, :55-68 checkStatus · src/core/actions.ts:196-209 makeEvent, :648, :906 · src/commands/people.ts:745 · od v1.28.0 evidence.ts isWeak (kind index), checkStatus "… or an index cannot make a fact" -->

<a id="R3.2.1"></a>
### R3.2.1 Quelle: Form und Information

- `strom source add --form original` (Standard) · `derivative` (Kopie, Register; Standard für `--kind index` und in
  einem Buch, das nur ein Register ist) · `authored` (zusammengestelltes Werk).
- `--information primary|secondary|unknown` (Standard `unknown`) gilt bei der Quelle; bei der Zitation (`event add`,
  `cite`) nur für diese Angabe. Ein Eintrag, der die Eltern nennt (die Taufe eines Enkels), ist für sie
  Sekundärinformation (Methodik).
- In GEDCOM geht die Qualität der Zitation als QUAY: 3 Originalquelle mit Primärinformation · 2 Originalquelle sonst,
  oder Kopie mit Primärinformation · 1 Kopie sonst, oder verfasstes Werk · 0 Stammbaum und Erinnerung.
- Eine Änderung von Form, Information, Art oder Abschrift einer Quelle (`strom source edit`) braucht `--reason`, eine
  Ergänzung nicht.
- App: die **Verlässlichkeit** einer Quelle kommt in die Forschung als **Original** = Originalquelle mit
  Primärinformation, **Abschrift / Index** = Originalquelle mit Sekundärinformation, **Unsicher** = Kopie mit
  unbekannter Information.
- **Gilt seit:** Forschung 1.0.0; Verlässlichkeit aus der App Forschung 1.12.0

<!-- zdroj: research:src/commands/sources.ts:197-198, :221, :837 · src/core/evidence.ts:40 quay · src/core/sync.ts:4660 QUAY_EVIDENCE · assets/method/recording.md:38-46 · app:strings.ts sources.quality1-3, src/ui/sources.ts:76 -->

<a id="R3.3"></a>
## R3.3 Quelle oder Hinweis

Stammbaum, Erinnerung, Register, Katalog und Online-Stammbaum sagen, wo zu suchen ist. Sie sind kein Nachweis einer
Angabe. Eine Angabe aus ihnen bleibt Hinweis, bis ein Eintrag sie belegt.

- **Prüft der Code:** Stammbaum, Erinnerung, verfasstes Werk und Register (`--kind index`) sind schwache Quellen: eine
  Angabe nur aus ihnen ist nie Wahrscheinlich oder Belegt ([R3.2](#R3.2)). Eine Angabe, die nur ein Register zitiert,
  bleibt Hinweis, bis der Eintrag selbst gelesen und zitiert ist; mit der Zitation des Eintrags ist es eine Angabe des
  Eintrags. Ein übernommener Stammbaum: [R11.3](R11-material-from-the-user.md#R11.3).
- **Grenzen:** bei Änderungen aus der App zählt ein Register als Eintrag: die Änderung einer Angabe, die ein Register
  belegt, wird zu einem Widerspruch ([R5.2](R5-conflicts.md#R5.2)), nichts wird stillschweigend überschrieben.
- **Nur Methodik:** das Register dient nur zum Finden der Seite; der Eintrag wird im Kirchenbuch gelesen. Auch ein
  fehlender Eintrag im Register ist nur ein Hinweis: eine ähnliche Form des Familiennamens ist ein Kandidat.
- Unterlagen vom Benutzer (Urkunde, Foto, Brief, was der Benutzer sagt):
  [R11.2](R11-material-from-the-user.md#R11.2).
- **Gilt seit:** Forschung 1.0.0
- **Ab Forschung 1.28.0:** das Register prüft der Code als schwache Quelle (früher nur Methodik: mit seiner Zitation
  bekam eine Angabe Wahrscheinlich, und mit `--information primary` ging auch Belegt durch).

<!-- zdroj: research:assets/method/core.md:8-12 · locate.md:22-24 · link.md:6-12 · intake.md:9-16 · src/core/evidence.ts isWeak (kind index od v1.28.0), isCompiled (sync) · src/core/sync.ts isCompiled · src/core/import.ts:1-7, :113-117 · src/commands/sources.ts:221 · test/cli/index-weak.test.ts · commit 9685fcbe -->

<a id="R3.4"></a>
## R3.4 Zitation: Ausschnitt und Abschrift

Die Zitation sagt, wo genau in der Quelle die Angabe steht. Eine Quelle ist ein Eintrag; mehrere Einträge einer
Seite sind mehrere Quellen.

- **Nur Methodik:** jeder Eintrag aus einem Scan bekommt `--clip` (den Ausschnitt, in dem der Agent ihn gelesen hat)
  und `--transcript` (die Worte des Eintrags, wie sie stehen, zeilenweise, ein nicht gelesener Buchstabe `[?]`), dazu
  `--locator` (Folio, Seite, Nummer des Eintrags) und bei der Angabe `--quote`. In ein Feld (`--date`, `--house`,
  `--age`, Name) kommt nur, was sicher gelesen ist; Unsicheres kommt mit `[?]` in die Abschrift und in die Notiz der
  Angabe.
- **Nur Methodik, ab Forschung 1.28.0:** ein Eintrag in einer anderen Sprache oder Schrift als der Sprache der
  Forschung (Latein, Kurrent, Polnisch, Kyrillisch…) bekommt neben der wörtlichen Abschrift auch eine Übersetzung in
  die Sprache der Forschung (`--translation`). Die Abschrift bleibt in der Sprache des Eintrags. Die App zeigt die
  Übersetzung zugeklappt unter der Abschrift ([A3.1.1](A3-evidence-in-the-app.md#A3.1.1)).
- **Prüft der Code:** höchstens 3 Ausschnitte je Quelle (der Eintrag und seine Fortsetzung über einen Seitenumbruch).
  Einen fehlenden Ausschnitt oder eine fehlende Abschrift lehnt der Code nicht ab, er erinnert nur bei einer Quelle
  auf einem Scan daran: nach `strom source add`, nach `strom source edit` mit Bild oder Ausschnitt und bei
  `strom task done` bei den Quellen, die die Aufgabe erfasst hat.
- Ältere Quellen: den Ausschnitt ergänzt `strom clips`, die Abschrift `strom transcripts` (Leser, ein zweiter Blick
  prüft sie).
- **Bedienung:** Terminal: `strom source add "…" --clip B…:57@x,y,w,h --transcript @notes/zapis.txt --translation
  @notes/preklad.txt --locator "…"`; Ergänzung `strom source edit S… --translation "…"`.
  Die App zeigt den Ausschnitt des Eintrags neben der Abschrift.
- **Gilt seit:** Forschung 1.1.0 (Ausschnitt, `strom clips`, `strom transcripts`); Abschrift 1.0.0
- **Ab Forschung 1.26.0:** die Hilfe der Option `--clip` sagt „ein weiterer bei jedem Seitenumbruch, höchstens 3“ (in 1.25.2
  „ein zweiter“). Die Regel ändert sich nicht.

<!-- zdroj: research:assets/method/recording.md:19-27, :55-62 · src/core/media.ts:285 MAX_CLIPS, :481 transcriptNote, :492 clipNote · src/commands/sources.ts:183, :214, :250, :893 · src/commands/tasks.ts:366-369 finishTask · src/commands/clips.ts · src/commands/transcripts.ts · HEAD commit 6bc7430b · překlad: assets/method/recording.md "--translation", link.md krok 7, src/brief/brief.ts (Research language), src/commands/sources.ts:196 translation, src/gedcom/export.ts:557 (oddíl poznámky pramene „Překlad:“), commit a1ccd24e -->

<a id="R3.4.1"></a>
### R3.4.1 Die Abschrift eines Menschen ändert nur der Mensch

Eine Abschrift, die ein Mensch geschrieben oder bestätigt hat, ändert niemand außer einem Menschen. Einen anderen
Wortlaut vom Agenten bekommt der Mensch nur vorgeschlagen. Das Lesen durch ein KI-Modell ist ein Vorschlag; Sicherheit
gibt die Prüfung durch den Menschen.

- **Prüft der Code:**
  - Abschrift eines Menschen ist eine von Hand in seinem Terminal geschriebene Abschrift oder eine aus der App mit
    angehaktem **Abschrift geprüft** oder mit der Einstellung **Meine Quellenabschriften → Beleg** ([R3.5.1](#R3.5.1)).
    Was Importe, Umwandlungen und Stapel unter dem Konto des Menschen geschrieben haben, ist keine Abschrift eines
    Menschen;
  - eine solche Abschrift ändert kein Befehl des Agenten: weder Bearbeitung, Stapel, Synchronisierung, Korrektur,
    Rücknahme, Import noch Umwandlung. Als Mensch schreiben dürfen nur sein Terminal und die Brücke der App Strom;
  - ein anderer Wortlaut vom Agenten (`strom source edit S… --transcript …`) wird stattdessen vorgeschlagen: eine Notiz
    bei der Quelle und eine Aufgabe für den Menschen je Quelle. Sie wartet in **Was wartet**, Gruppe **Abschriften zu
    entscheiden**. Keine Warteschlange bietet sie an; der Agent nimmt sie nicht, schließt sie nicht ab, stellt sie nicht
    zurück und startet sie nicht;
  - nur der Mensch entscheidet:
    - **Vorschlag übernehmen**: Abschrift wird der vorgeschlagene Wortlaut, und die Bestätigung des Menschen geht auf
      ihn über;
    - **Bisherige behalten**: die Abschrift bleibt; der vorgeschlagene Wortlaut ist abgelehnt und wird nicht erneut
      vorgeschlagen, auch seine Stellen nicht;
    - **Rückgängig** (nach beidem): Abschrift und Bestätigung wie vorher, und der Vorschlag wartet wieder. Die Rücknahme
      wird abgelehnt, wenn sich die Abschrift inzwischen geändert hat oder ein anderer Vorschlag wartet.
- **Eine Abschrift, die der Mensch nicht bestätigt hat:** der Agent ändert sie nur in einer Aufgabe und nur dort, wo
  es der Eintrag auf dem Scan selbst zeigt, mit einem Grund. Eine neue Lesung ([R8.8.2](R8-reading-scans.md#R8.8.2))
  ist nur ein Anhaltspunkt: wo es sich am Scan nicht entscheiden lässt, schreibt der Agent eine Notiz zur Quelle, und
  die Abschrift bleibt.
- **Nur Methodik:** eine Aufgabe aus einer neuen Lesung schließt der Agent ab, indem er den Eintrag auf dem Scan selbst
  neben beiden Lesungen ansieht.
- **Bedienung:** App: Quellenbetrachter, Block **Vorschlag des Agenten zur Abschrift** (**Ganzer Wortlaut
  nebeneinander**, **Vorschlag übernehmen**, **Bisherige behalten**, **Rückgängig**); bei einer vom Menschen
  bestätigten Abschrift nach einer neuen Lesung **Zur Prüfung vormerken** ([R8.8.3](R8-reading-scans.md#R8.8.3)).
  Terminal: **Was wartet** → **Die vorgeschlagene Fassung** / **Die Abschrift, wie sie ist**;
  `strom source proposal S… --take proposal|keep|undo`.
- **Warum:** die Abschrift eines Menschen ist seine eigene Lesung des Eintrags. Grundsatz des Projekts: nichts vom
  Menschen Bestätigte wird überschrieben; ein neues Ergebnis, das abweicht, ist eine Aufgabe oder ein Vorschlag zur
  Entscheidung.
- **Gilt seit:** Forschung 1.29.0, App 3.25.0

<!-- zdroj: research:c2a690ea strom help source proposal (--take proposal|keep|undo, --task, --proposed) · src/core/waiting.ts:375-390 (kind transcript, group transcripts, choices proposal/keep, ne TERMINAL_ONLY) · src/core/sync.ts:3862 (app read = evidence || verified) · assets/lang/cs.json proposal.*, ui.proposal.*, wait.group.transcripts, read.source.why, read.source.done · CHANGELOG.cs.md 1.29.0 („Přepis, který uživatel přečetl nebo potvrdil, je uživatelův“) · commity 284605bf, 8803cd70 · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 4, 5) · app:6bd8609e strings.ts read.pTitle, pWhole, pAccept, pKeep, pUndo, pAccepted2, pKept2, pNote, tReview · src/ui/read-source-state-view.ts proposalHtml · spec 065 K2.3, spec 059 K3.2 -->

<a id="R3.4.2"></a>
### R3.4.2 Überlappende Ausschnitte sind einer

Zwei Ausschnitte desselben Bildes, die sich stark überlappen, sind ein zweimal ausgeschnittener Eintrag. Die Forschung
fügt sie zu einem zusammen.

- **Prüft der Code:**
  - zwei Ausschnitte desselben Bildes, die sich um mindestens 30 % des kleineren überlappen, werden zu einem Rechteck
    über beide zusammengefügt, an der Stelle des ersten. Wiederholt: drei Ausschnitte in einer Reihe sind einer;
  - ein Ausschnitt, der zu mindestens 90 % in einem größeren liegt (Detail eines Namens oder Datums, ein Eintrag neben
    der ganzen Seite), bleibt. Zwei fast gleiche Rechtecke (jedes zu mindestens 90 % im anderen) werden zusammengefügt;
  - getrennte, sich nur berührende oder auf anderen Bildern liegende Ausschnitte bleiben;
  - zusammengefügt wird nur, was die Forschung geschrieben hat (der Agent, eine Sitzung, ein Stapel des Agenten,
    `strom clips`); dem Agenten wird gesagt, was zusammengefügt wurde. Ein Ausschnitt vom Menschen (Terminal, App)
    ändert sich nie;
  - eine ältere Forschung wird einmal zusammengefügt, beim ersten Start der neuen Version oder beim Start der Brücke:
    nur Ausschnitte, die laut Verlauf der Agent oder eine Sitzung geschrieben hat, ein aufgezeichneter Vorgang je
    Quelle. Abschrift und Bestätigung des Menschen bleiben.
- **Warum:** ein Leser schneidet mit einem Ausschnitt die unteren Zeilen ab, mit einem anderen den rechten Teil, und
  die App zeigt dann zwei fast gleiche Ausschnitte desselben Eintrags.
- **Bedienung:** keine: zusammengefügt wird von selbst beim Schreiben eines Ausschnitts (`strom source add|edit --clip`
  durch den Agenten, `strom clips`).
- **Gilt seit:** Forschung 1.29.0

<!-- zdroj: research:c2a690ea src/core/clipmerge.ts (hlavička, CLIP_OVERLAP = 0.3, CLIP_NESTED = 0.9, cutTwice, mergeOverlappingClips, handClipped, agentClipped, settleClips, CLIPS_SETTLED) · commity 599f9681, 326bae02 · CHANGELOG.cs.md 1.29.0 · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 6) -->

<a id="R3.5"></a>
## R3.5 Blinde zweite Lesung

Eine Schlussfolgerung, die auf einer einzigen schwer lesbaren Zelle steht (Hausnummer, Alter, Vorname oder
Geburtsname), braucht eine zweite, unabhängige Lesung. Über Wahrscheinlich steigt die Angabe nur, wenn zwei
unabhängige Lesungen übereinstimmen.

- **Nur Methodik:** der zweite Leser kennt weder den erwarteten Wert noch Name, Ort oder warum es darauf ankommt. Eine
  Zelle, ein Leser. Zuerst `strom readings B… --image N`: zwei Lesungen gibt es vielleicht schon. Weichen die Lesungen
  ab, sieht der Agent erneut hin; ein echter Unterschied ist ein Widerspruch mit beiden Lesungen (siehe
  [R5](R5-conflicts.md)), keine Wahl.
- **Prüft der Code:** `strom read --blind` sagt dem Leser, dass er blind liest (genau abschreiben, nichts ergänzen).
  Eine Doppelseite gibt er in zwei schärferen Hälften; die Nachricht des Lesers hat im Kopf „Blind: yes“. Der Code
  **prüft nicht**, dass eine belegte Angabe eine blinde Lesung hat ([R3.2](#R3.2)).
- **Wann die Methodik sie verlangt:** vor Belegt bei einer Angabe auf einer schwierigen Zelle; in der Prüfaufgabe aus
  der Durchsicht einer Person (Angaben Wahrscheinlich, die eine Quelle mit Bild zitieren: Übereinstimmung → Belegt,
  Unterschied → Widerspruch); bei einer Abschrift des Benutzers ([R3.5.1](#R3.5.1)).
- **Bedienung:** Terminal: `strom read M… --blind --crop x,y,w,h --question "…"`; Durchsicht einer Person: Menü
  **Eine Person durchsehen: prüfen und ergänzen, was über sie bekannt ist**, `strom review`.
- **Gilt seit:** Forschung 1.0.0; Prüfaufgabe aus der Durchsicht einer Person 1.1.0

<!-- zdroj: research:assets/method/verify.md:3-18 · recording.md:62-65 · src/commands/read.ts:192, :206, :334, :506 · src/core/reader.ts:194 readerPrompt · src/core/review.ts:205 singleReadings, :269 · src/core/phrases.ts review.verify.* · cs.json ui.menu.review -->

<a id="R3.5.1"></a>
### R3.5.1 Abschriften und Lesungen aus der App

Eine Abschrift, die der Benutzer in der App schreibt, nimmt die Forschung nie als Belegt und überschreibt sie nicht.
Wie sie damit rechnet, bestimmt eine Einstellung des Stammbaums in der App.

- **Meine Quellenabschriften → Hinweis** (Standard): eine neue Angabe aus der Abschrift ist Hinweis. Die Forschung
  schlägt eine Prüfaufgabe vor.
- **Meine Quellenabschriften → Beleg**, oder bei der Quelle angekreuzt **Abschrift geprüft**: die Abschrift gilt als
  erste Lesung. Angaben darauf sind Wahrscheinlich, nicht Belegt. Die Wahl gilt für Quellen, die ab der nächsten
  Sendung neu oder geändert sind.
- Ein Dokument, das Leser der Forschung gelesen haben: ein Leser → Möglich; zwei blinde Leser übereinstimmend →
  Wahrscheinlich; eine in der App geänderte Abschrift, abweichende Lesungen, ein unsicherer Leser oder eine Angabe,
  die die Lesung nicht nennt → Hinweis.
- **Prüft der Code:** diese Grade. Aus der App entsteht nie Belegt.
- **Nur Methodik:** in der Prüfaufgabe sucht der Agent den Eintrag, registriert das Bild und liest es selbst blind.
  Übereinstimmung → Notiz bei der Quelle; Unterschied → Widerspruch mit beiden Lesungen.
- **Gilt seit:** Forschung 1.12.0, App 3.9.0; Lesung eines Dokuments durch Leser der Forschung 1.18.0

<!-- zdroj: research:assets/method/verify.md:19-24 · src/core/sync.ts:220, :824, :3367 readsFor, :3870 reading, :3992 · src/core/readsync.ts:190 readingGrade · cs.json sync.verify.*, read.note.* · app:strings.ts treeSettings.transcripts/guide/evidence/evidenceDesc/notRetroactive, sources.verified -->

<a id="R3.6"></a>
## R3.6 Negative Suche

Eine vergebliche Suche ist ein Ergebnis. Jede Suche wird erfasst, auch ohne Fund, mit dem, was sie genau abgedeckt
hat. Der teuerste Fehler ist, dasselbe Buch zweimal zu durchsuchen.

- **Grenzen (prüft der Code):**
  - `--result found|negative|partial|inconclusive`; `found` braucht `--found S…` (die Quelle wird zuerst erfasst);
  - `negative` lehnt der Code ab, solange im durchsuchten Bereich eine Stelle bleibt, die ein Leser als unklar
    gemeldet hat, und niemand sie seitdem in voller Größe angesehen hat, auf der richtigen Seite der Doppelseite.
    Gezählt werden Lesungen seit der ersten Sitzung der Aufgabe (sonst der letzten 24 Stunden). Dann bleibt
    `--result inconclusive` mit der Stelle in `--note` oder `--result partial` mit den klar gelesenen Seiten in
    `--pages`;
  - eine vergebliche Suche in einem Register (`--method index`) wird als „negative in the index only“ ausgegeben;
  - `strom task done` erinnert bei einer Aufgabe wo die Einträge liegen, Beleg einer Verbindung, Prüfung und
    Ergänzung einer Person daran, wenn die Aufgabe keine Suche erfasst hat.
- **Nur Methodik:** negativ erst nach einem Blick auf die Seiten in voller Größe. Fehlende Seiten eines Buches sind
  nicht durchsucht (`--pages 40-52,55-69`). Nach `--until-found` nur die gelesenen Bilder, als `--result partial`.
- **Bedienung:** Terminal: `strom search add "…" --recordset B… --years … --surname … --pages … --method
  index|page-by-page|full-text|catalog|web|request|other --result negative --by main|reader|user --note "…"`.
- **Gilt seit:** Forschung 1.0.0; Ablehnung über einer unklaren Stelle und „nur im Register“ 1.14.0

<!-- zdroj: research:assets/method/core.md:22-25 · reading.md:22-30, :70-84 · src/commands/analysis.ts:208-268 · src/core/model.ts:484-485 · src/commands/readings.ts:347-380 openUnclear, :414 refuseNegativeOverUnclear · src/core/evidence.ts:21 searchedAs · src/commands/tasks.ts:348-351 -->

<a id="R3.7"></a>
## R3.7 Wann der Agent den Menschen fragt

Lesungen und Grade der Sicherheit bestimmt der Agent selbst. Den Menschen fragt er nur dort, wo es ohne ihn nicht
weitergeht. Die Frage geht in **Wartet auf Bearbeitung** (siehe [R6](R6-awaiting-action.md)) als unpersönlicher
Satz.

- **Nur Methodik,** der Agent fragt (`strom task wait T… --on "…"`): eine ähnliche Form des Familiennamens im
  richtigen Haus oder in den richtigen Jahren (er bittet um die Seite, bevor er sie ausschließt); ein Katalog, den der
  Agent nicht öffnet (`--kind web --url`); Bilder, die ein Archiv nicht automatisch herunterladen lässt
  (`--images B…:40-69`); eine Seite, die die Automatisierung verhindert (`--check <url>`), nur wenn kein anderer Weg
  zum Ziel führte und die Quelle nötig bleibt.
- **Prüft der Code,** nur der Mensch: die Antwort auf eine wartende Aufgabe (`strom task wake T… --answer`) und auf
  die Prüfung einer Seite (`--check`) bestätigt der Mensch in seinem Terminal oder in einem Fenster; „kein Fehler“ bei
  einem Fund der Prüfung (`strom quality dismiss`).
- **Nur Methodik:** ein Widerspruch, den der Benutzer entschieden hat, gilt; der Agent öffnet ihn erneut nur wegen
  einer Quelle, die die Entscheidung nicht gewogen hat (siehe [R5](R5-conflicts.md)). Die Abschrift des Benutzers
  überschreibt der Agent nicht ([R3.5.1](#R3.5.1)).
- **Gilt seit:** Forschung 1.0.0; Antwort nur durch den Menschen spätestens 1.14.0; „kein Fehler“ 1.22.0

<!-- zdroj: research:assets/method/link.md:6-12 · locate.md:17-27 · reading.md:105-121 · waiting.md:14-17 · core.md:124-130 · recording.md:77-81 · src/commands/tasks.ts:928-946 task.check-person, task.answer · src/commands/quality.ts PERSON · src/cli/main.ts:287-290 requireHuman -->

<a id="R3.8"></a>
## R3.8 Wie die App Belege zeigt

Die App verwendet das Wort „belegt“ in mehreren Bedeutungen. Den Grad der Sicherheit bestimmt die Forschung; die
Belegstufe einer Person berechnet die App selbst, nur aus Zitationen.

| Wo in der App | Was es zeigt | Wonach |
|---|---|---|
| Etikett bei der Angabe, z. B. **Belegt** | Grad der Sicherheit der Angabe | Forschung ([R3.1](#R3.1)) |
| **Stammbaum-Überblick → Datenqualität → Sicherheit der Forschungsangaben** | Geburten, Sterbefälle und Heiraten nach Grad | Forschung |
| Personenseite, **Für Forschende → Sicherheit der Angaben** | Grad jeder Angabe der Person | Forschung |
| **Belegt** / **Teilweise belegt** / **Unbelegt** (● ◐ ○) | Belegstufe der Person | Zitationen ([R3.8.1](#R3.8.1)) |
| **Für Forschende**, „Durch Quellen belegt: N von M Angaben“ | Angaben der Person mit Quelle | Zitationen |
| **Stammbaum-Überblick → Vorfahren**, Spalte **belegt** | Vorfahren mit belegter Geburt | mit Forschung nur Belegt, sonst Zitationen |
| **Wo Belege fehlen → Geburten in der Forschung nicht bewiesen** | Geburten der Vorfahren, die nicht Belegt sind | Forschung |
| Buch, **Daten für Forschende**: ● belegt · ◐ Widerspruch · ○ nicht belegt | Belegstand der Angabe | Belegt **oder** irgendeine Zitation |
| **Meine Quellenabschriften → Beleg** | wie die Forschung Abschriften des Benutzers nimmt | erste Lesung, Wahrscheinlich ([R3.5.1](#R3.5.1)) |

- **Grenzen:** die Grade der Sicherheit zeigt die App nur, ändern lassen sie sich nicht. Ein Widerspruch bei einer
  Angabe im Buch sticht ● und ○.
- **Gilt seit:** App 3.5.0 (Stufe der Person), 3.9.0 (Etikett, Meine Quellenabschriften), 3.13.0 (Sicherheit der
  Forschungsangaben), 3.13.1 (Spalte belegt), 3.18.0 (Für Forschende), 3.19.0 (Buch)

<!-- zdroj: app:src/ui/fact-status.ts · src/tree-overview.ts:224-233 birthDocumented · src/ui/tree-overview.ts:1037, :1960, :1650-1680 · src/person-page.ts:1014-1019 · src/book-blocks.ts:468-484 evidenceMark · strings.ts treeOverview.*, personPage.research.*, book.evidence.*, book.dlg.research(Hint), treeSettings.evidence -->

<a id="R3.8.1"></a>
### R3.8.1 Belegstufe einer Person

- **Unbelegt** (○): weder die Person noch ihre Ereignisse noch ihre Partnerschaften zitieren eine Quelle.
- **Belegt** (●): zitierte Geburt (oder Taufe) und, wenn die Person einen Tod hat (Datum, Ort, Ereignis des Todes
  oder des Begräbnisses), auch ein zitierter Tod (oder Begräbnis, Einäscherung).
- **Teilweise belegt** (◐): alles dazwischen, auch eine Quelle, die nur an der Person hängt (am Namen, am Wohnort).
- Der Grad der Sicherheit zählt nicht: eine Geburt, die auch nur einen übernommenen Stammbaum zitiert (Hinweis), gibt
  ●. Die App sagt das bei **Sicherheit der Forschungsangaben**: „Nicht zu verwechseln mit Quellenbelegen.“
- Zitiert im Stammbaum niemand eine Quelle, zeigt die Karte keine Stufe. Eine Platzhalterperson hat keine Stufe.
- **Bedienung:** App: Option der Karte **Belege aus Quellen**; Hervorhebung **Belege** im Stammbaum;
  **Stammbaum-Überblick → Datenqualität → Wo Belege fehlen**.
- **Gilt seit:** App 3.5.0

<!-- zdroj: app:src/evidence-level.ts personEvidence, treeHasAnySource · strings.ts treeHealth.evidenceMode/evFull/evPartial/evNone, cardDensity.cardEvidence/cardShowHint, treeOverview.certaintyDesc -->

<a id="R3.9"></a>
## R3.9 Eine Erzählung behält ihre Quellen

Eine Erzählung sagt, auf welche Quellen sie sich stützt. Eine neue Fassung der Erzählung verliert nichts aus der
vorigen Fassung ohne Grund.

- **Grenzen:**
  - Quellen der Erzählung sind die Quellen, die ihre Angaben zitieren, die Quellen des Hintergrunds von Ort und Zeit
    und die Quellen, die der Text nur mit einer Kennung nennt;
  - eine neue Fassung muss jede Angabe, Quelle und jeden Verweis der vorigen Fassung behalten oder mit Grund
    weglassen. Sonst lehnt die Forschung sie ab und gibt aus, was fehlen würde. Was eine Fassung weggelassen hat und
    warum, bleibt bei der Erzählung;
  - eine Erzählung nach einem Hinweis nennt im Text den Titel der Quelle und dass den Eintrag noch niemand gelesen
    hat. Nennt der Text die Quelle nicht, weist die Forschung darauf hin;
  - die Freigabe der Erzählung bleibt beim Menschen ([R5.5](R5-conflicts.md#R5.5)).
- **Bedienung:** Terminal: `strom story show P…` (jede Angabe mit ihren Quellen, dann der Hintergrund), `strom story
  set P… --fact E… --source S… --drop "E… <warum>"`. Strom-Datei: Quellen der Erzählung als `2 SOUR` unter
  `_STORY`.
- **Gilt seit:** Forschung 1.26.0

<!-- zdroj: research:src/core/storykeep.ts StoryVersion, StoryDrop, StorySource, storySources · src/commands/story.ts:104 --drop, :151 told from a lead, :231 story show · assets/method/narrate.md · CHANGELOG.cs.md 1.26.0 -->

<a id="R3.9.1"></a>
### R3.9.1 Was eine Erzählung behauptet

Eine Erzählung wird aus den Angaben für die Familie geschrieben. Was nicht belegt ist, wird nicht hinzugedacht.

- **Nur Methodik:**
  - jede Behauptung stützt sich auf eine erfasste Angabe; was abgeleitet ist, ist als Ableitung gekennzeichnet; was
    nicht bekannt ist, wird gesagt;
  - Hintergrund von Ort und Zeit (Krieg, Epidemie, Brand, wovon das Dorf lebte) nur aus einer in der Forschung
    erfassten Quelle und nur als Hintergrund, nie als Ursache dessen, was die Person tat, wenn es der Eintrag nicht
    sagt;
  - die Erzählung eines Paares erzählt das gemeinsame Leben: Heirat, Haushalt, Wohnorte, Kinder, Verwitwung. Das
    Leben jedes der beiden davor und danach gehört in seine eigene Erzählung und wird mit einem Satz erwähnt;
  - ein alter Beruf und ein Begriff, den die Lesenden nicht verstehen, werden erklärt; geschrieben wird in der
    Sprache der Forschung;
  - Format des Textes: nur Absätze, Zwischenüberschriften, Aufzählungspunkte, Fettdruck und Kursivschrift. Anderes
    (Links, Tabellen, Zitate, nummerierte Listen) zeigt die App nach der Methodik als einfachen Text.
- **Warum:**
  - nichts wird hinzugedacht: eine Erzählung ist für die Familie und stützt sich auf Belege. Was wahrscheinlich
    klänge, aber nicht belegt ist, würde in der Familie bald als Tatsache gelten;
  - Hintergrund: er ist für den Ort belegt, nicht für die Person; als Ursache dessen, was die Person tat, wäre er eine
    als Tatsache ausgegebene Vermutung. Die Erzählung nennt die Quelle des Hintergrunds (`--source`), damit sie sich
    prüfen lässt;
  - Erzählung eines Paares: das gemeinsame Leben wird einmal erzählt, beim Paar, damit dasselbe Leben nicht zweimal
    erzählt wird und die Fassungen nicht auseinandergehen;
  - Format: die Strom-App zeigt nur Absätze, Zwischenüberschriften, Aufzählungspunkte, Fettdruck und Kursivschrift;
    alles andere sähen die Lesenden als einfachen Text mit Zeichen.
- Freigabe und neue Fassung einer freigegebenen Erzählung: [R6.3.2](R6-awaiting-action.md#R6.3.2).
- **Bedienung:** Terminal: `strom story set P… --text @notes/… --fact E… --source S… --note "co je odvozené"`
  (Erzählung eines Paares bei der Familie F…).
- **Gilt seit:** Forschung 1.0.0; Hintergrund von Ort und Zeit 1.10.0; Format des Textes 1.8.0; Erzählung eines
  Paares 1.23.0

<!-- zdroj: research:assets/method/narrate.md (celé; formát od v1.8.0, pozadí od v1.10.0, pár od v1.23.0) · research:src/commands/story.ts --note -->
