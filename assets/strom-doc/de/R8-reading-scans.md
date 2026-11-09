<a id="R8"></a>
# R8 Einträge in Scans finden und lesen

Wie die Forschung ein Buch findet, seine Bilder bekommt, wer die Bilder liest und wie das Gelesene erfasst wird.
Beschreibt die Forschung 1.25.2 und 1.26.0 (das Lesen der Scans ändert sich zwischen ihnen nicht). Bei den Regeln
wird unterschieden, was **der Code prüft** (der Befehl `strom` tut es oder lehnt den Eintrag ab) und was nur eine
**Regel der Methodik** ist (eine Anweisung an den Agenten, die der Code nicht kontrolliert). **Warum** nennt den
Grund so, wie ihn die Methodik oder der Code der Forschung nennt.

Der Ablauf in Kürze:

1. **Buch:** nach Ort und Zeit bestimmt der Agent die Zuständigkeit (Pfarrei, Standesamt), das Archiv und das
   konkrete Buch ([R8.1](#R8.1)).
2. **Bilder:** sie werden nur über den Downloader des Archivs geladen, im Tempo und nach den Bedingungen des Archivs,
   und nur die nötigen. Wo das Archiv kein automatisches Herunterladen erlaubt, speichert sie der Mensch
   ([R8.2](#R8.2)).
3. **Durchblättern:** ein Buch oder einen Bereich von Bildern lesen **Leser** (`strom read`): eigene Agenten mit
   leerem Kontext, jeder mit einem Stapel Bilder und der ganzen Frage ([R8.3](#R8.3)). Wie das Lesen läuft, stimmt
   strom selbst ab ([R8.4](#R8.4)).
4. **Eigener Blick:** jeden Eintrag, der zitiert wird, liest der Hauptagent selbst, aus einem Ausschnitt in voller
   Auflösung ([R8.5](#R8.5)).
5. **Erfassen:** eine Quelle mit Ausschnitt und Abschrift, Angaben nur aus sicher Gelesenem und die Suche auch ohne
   Fund ([R8.6](#R8.6)).
6. **Sicherheit:** der Grad der Sicherheit hängt davon ab, wer den Eintrag wie gelesen hat; eine schwierige Stelle
   braucht eine zweite, blinde Lesung ([R8.7](#R8.7)).

Wer was liest, kurz und am Beispiel eines Eintrags, sagt [R8.9](#R8.9).

> **Hinweis: das Lesen durch ein Modell ist nicht hundertprozentig.** Alte Schrift liest ein KI-Modell, und die
> Genauigkeit des Lesens hängt vom Modell ab. Die Methodik will für alte Schrift das stärkste Modell, nie ein
> schnelles oder billiges Lesen. Leser lesen mit dem Modell für Schrift (`model.vision`, sonst `strom read --model`),
> und die Größe der Ansichten richtet sich nach dem Modell ([R8.3.2](#R8.3.2)).
> Die Größe der Ansichten lässt sich kalibrieren (`strom media calibrate`, bestätigt ein Mensch), und strom stimmt das
> Lesen für jeden Agenten und jedes Modell getrennt ab ([R8.4](#R8.4)).
> Trotzdem irrt sich das Modell: bei Namen, Hausnummern, Daten und Orten. Darum schreibt der Leser bei jedem Namen die
> Sicherheit in Prozent, „unleserlich“ hat Vorrang vor einer Schätzung, eine schwierige Stelle bekommt eine blinde
> zweite Lesung, abweichende Lesungen sind ein Widerspruch, und Belegt will die Methodik nur nach dem eigenen Lesen
> des Eintrags durch den Hauptagenten ([R8.7](#R8.7)).
> **Grundsatz des Projekts:** wichtige Angaben soll idealerweise noch ein Mensch prüfen. Die Strom-App zeigt bei der
> Quelle den Ausschnitt des Eintrags neben der Transkription ([A3.3](A3-evidence-in-the-app.md#A3.3)). Eine vom
> Menschen kontrollierte Transkription lässt sich als **Abschrift geprüft** markieren
> ([A3.1.1](A3-evidence-in-the-app.md#A3.1.1), wie die Forschung damit rechnet: [R3.5.1](R3-verification-and-citation.md#R3.5.1)).
> Eine falsche Angabe lässt sich in der App korrigieren; die Änderung einer Angabe, die ein Eintrag belegt, wird zu
> einem Widerspruch ([S2](S2-edits-from-the-app.md)).
> Das Lesen durch ein Modell ist nur ein Vorschlag: Eine Abschrift, die ein Mensch geschrieben oder bestätigt hat,
> ändert niemand außer einem Menschen, auch keine neue Lesung ([R3.4.1](R3-verification-and-citation.md#R3.4.1)).

<!-- zdroj: research:assets/method/reading.md:3-8 · src/agents/profiles.ts:5 vision, :147 · src/commands/read.ts:214 --model · src/core/reader.ts:226 certainty · assets/method/verify.md · Milan 4. 11. 2026 (zásada ověření člověkem) -->

<a id="R8.1"></a>
## R8.1 Zuerst das Buch

Bevor sich etwas belegen lässt, muss klar sein, wo die Einträge liegen. Der Agent bestimmt die Zuständigkeit des
Ortes in der jeweiligen Zeit, das Archiv und das konkrete Buch (eine Sammlung von Einträgen) mit Zugang: Adresse oder
Signatur.

- **Nur Methodik,** in dieser Reihenfolge:
  1. Ort und Zeit bestimmen die Zuständigkeit (`strom place jurisdiction L… --kind parish|civil|manor|district --from --to`).
     Ein nur unsicher gelesener Ort ergibt keine Pfarrei und kein Buch, solange er nicht sicher ist ([R8.5.2](#R8.5.2));
  2. Archiv (`strom repo add`, mit den Nutzungsbedingungen) und Buch (`strom recordset add … --places --years --kinds
     --access --url`). Der Downloader des Archivs findet Bücher selbst: `strom fetch <stahovač> --find "<místo>" --years 1780-1850`;
  3. der Katalog wird wie von einem Menschen benutzt: die Suche oder die Seite eines Buches, nie die Nummern der
     Datensätze der Reihe nach;
  4. wo gesucht wurde, auch ohne Ergebnis, wird erfasst (`strom search add … --method web|catalog`).
- Register, Kataloge und Online-Stammbäume sind nur ein Hinweis, wo zu suchen ist ([R3.3](R3-verification-and-citation.md#R3.3)).
- Fertig, wenn das Buch mit Zugang existiert und die Aufgabe des Belegens auf es zeigt (`--where B…`).
- **Warum:** Grenzen, Pfarreien und Namen haben sich geändert; ein Dorf konnte in verschiedenen Jahrhunderten zu
  verschiedenen Pfarreien gehören. Das Durchgehen der Nummern von Datensätzen blockieren die Archive. Eine erfasste
  vergebliche Suche verhindert, dass die nächste Sitzung dieselben Kataloge erneut durchsucht.
- **Bedienung:** Terminal (Agent).
- **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:assets/method/locate.md:1-34 -->

<a id="R8.1.1"></a>
### R8.1.1 Ein Register vor dem Durchblättern

- **Prüft der Code:** soll ein Buch Bild für Bild durchgeblättert werden (`strom read`, `strom fetch`) und ist für
  Pfarrei, Jahre und Art der Einträge des Buches ein Register bekannt, das dafür noch niemand durchsucht hat, nennt
  strom es, bevor es etwas startet, samt dem Befehl, der es liest.
- **Grenzen:** ab 30 Bildern; eine andere Grenze (oder nie) bestimmt die Antwort des Menschen auf die Frage
  `index.first` (`strom media calibrate --questions`). Im Gespräch sagt strom es nur, in einer Sitzung `strom run`
  lehnt es das Lesen ab, bis der Agent `--no-index` gibt.
- **Warum:** nach einem Kommentar im Code lohnt sich ab etwa 20–40 Bildern das Register mehr als das Durchblättern.
  Ein Fall aus einer echten Forschung: Leser lasen 61 Bilder eines Trauungsbuches, während das Register der Pfarrei
  heruntergeladen bereitlag.
- **Gilt seit:** Forschung 1.14.0

<!-- zdroj: research:src/core/indexfirst.ts:1-28 INDEX_FIRST_DEFAULT · src/commands/read.ts:217 --no-index, :265 guardIndexFirst -->

<a id="R8.1.2"></a>
### R8.1.2 Eine Lehre zu einem Buch

Eine Besonderheit eines Buches, eines Archivs oder eines Ortes wird dort als Lehre vermerkt. Wer das nächste Mal mit
dem Buch arbeitet, sieht sie.

- **Prüft der Code:**
  - eine Lehre ist ein Satz, höchstens 200 Zeichen; bei einem längeren Text bildet der Anfang die Lehre, und der Rest
    geht in die Einzelheiten (höchstens 2000 Zeichen);
  - eine Lehre gehört zu einem Buch, einem Archiv oder einem Ort, die es in der Forschung gibt (`--on B…|R…|L…`);
  - eine Aufgabe zeigt die Lehren der Bücher, in denen sie sucht (`strom task show`).
- **Nur Methodik:** hierher gehören die Kalibrierung eines Buches, zwei Jahre je Seite, eine Hand, die die 7 wie eine
  1 schreibt. Eine Notiz in der Aufgabe oder im Tagebuch ist dafür nicht der Ort: dort sieht sie beim Buch niemand.
- **Warum:** die Besonderheit eines Buches soll jeder sehen, der es das nächste Mal öffnet (Methodik „Lessons belong
  where they apply“).
- **Bedienung:** Terminal: `strom lesson add "<poučení>" --on B…`, `strom lesson list`, `strom lesson edit`.
- **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:src/commands/analysis.ts lesson add (LESSON_MAX, --on repository|recordset|place) · research:src/core/model.ts:732 LESSON_MAX=200, LESSON_DETAIL_MAX=2000 · research:src/commands/tasks.ts:354 taskDetail lessons · research:assets/method/core.md "Lessons belong where they apply" -->

<a id="R8.2"></a>
## R8.2 Bilder nur über einen Downloader

Bilder aus dem Archiv lädt nur strom, über den Downloader (Konnektor) des jeweiligen Archivs und in dessen Tempo. Der
Agent lädt selbst nie herunter: weder mit einem Befehl noch mit einem Skript noch mit seinem Browser.

- **Prüft der Code:** jeder Weg zum Archiv richtet sich nach der strengsten bekannten Stufe seiner Bedingungen:

| Stufe | Was strom selbst tut |
|---|---|
| erlaubt | Katalog und Bilder, im Tempo des Dienstes |
| eingeschränkt | Katalog; Bilder nur mit Erlaubnis des Menschen für das Archiv: langsam oder über seinen Browser, sonst von Hand |
| nur von Hand | Katalog; Bilder nur von Hand |
| verboten | kein automatischer Zugriff |
| unbekannt | wie eingeschränkt |

- **Grenzen (prüft der Code):**
  - die Stufe ist die strengste aus: dem Lesen der Bedingungen durch den Downloader, dem Eintrag des Archivs in der
    Forschung, den mit strom gelieferten Bedingungen, der strengsten Stufe, die strom beim Server je gesehen hat, der
    Datei robots.txt und der Ablehnung durch den Server;
  - ein Archiv lockern, eine Erlaubnis geben und ein milderes Lesen des Downloaders annehmen darf nur der Mensch; der
    Agent darf ein Archiv nur verschärfen;
  - Tempo: ohne Angabe des Dienstes mindestens 2 s zwischen zwei Anfragen an den Server. Mit der Erlaubnis „langsam“
    höchstens ein Bild alle 10 s und höchstens 120 pro Stunde (Tempo eines Menschen), wenn der Mensch für den Server
    kein eigenes eingestellt hat; strom beschleunigt es nie.
- **Nur Methodik:** nur die Bilder laden, die die Aufgabe liest, nie das ganze Buch „zur Sicherheit“. Das Buch lädt
  die Sitzung, die es liest. Archiv ohne Downloader: der Agent baut einen Downloader (`strom connector new`) nach den
  Bedingungen des Portals und der robots.txt.
- **Ab Forschung 1.30.0:** `strom connector test --fetch` warnt, wenn ein Bild mehr als 10 Anfragen kostet
  (wahrscheinlich Kacheln), sagt, wie lange Bild und Buch im Tempo des Archivs dauern, und schickt den Agenten zuerst
  auf die Suche nach einem Link des Portals auf das ganze Bild, nach dem Herunterladen des ganzen Buches oder nach dem
  ganzen Bild über IIIF; Kacheln erst zuletzt.
- Bilder, die das Archiv nicht automatisch herunterladen lässt, speichert der Mensch in einen vorbereiteten Ordner
  ([R6.2.1](R6-awaiting-action.md#R6.2.1)); Erlaubnis eines Archivs: [R6.3.1](R6-awaiting-action.md#R6.3.1).
  Archive nur über den Browser, der Browser des Agenten und der ganze Ablauf: [R9](R9-archives.md).
- **Warum:** die Methodik will die Bedingungen jedes Archivs einhalten; ein Portal, dessen Bedingungen es verbieten,
  wird nicht automatisch durchsucht. Das Stundenlimit des Archivs hält die übrige Arbeit an, darum zuerst ganze Bilder
  und Teile nur dort, wo der Eintrag sie braucht.
- **Bedienung:** Terminal: `strom fetch <stahovač> … --images 40-69 --recordset B…`, `strom allow archive` (nur der
  Mensch). App: Wartet auf Bearbeitung.
- **Gilt seit:** Forschung 1.0.0 (Herunterladen nur über strom); Stufen der Bedingungen und Tempo eines Menschen 1.14.0

<!-- zdroj: research:src/core/terms.ts:1-30 (úrovně), :52-59 LEVELS, WAYS · src/core/net.ts:39 DEFAULT_PACE, :45 HUMAN_PACE · assets/method/reading.md:44-49, :89-104 · assets/method/locate.md:15-21 · cs.json ui.archive.level.* · CHANGELOG.cs.md 1.14.0, 1.15.0 · research:773c475a src/commands/connectors.ts HEAVY_IMAGE = 10 -->

<a id="R8.3"></a>
## R8.3 Leser: wer die Bilder liest

Ein Buch oder einen Bereich von Bildern gehen **Leser** durch, nicht der Hauptagent. Ein Leser ist ein eigener Lauf
des Agenten (desselben Programms, mit dem die Forschung arbeitet) mit leerem Kontext. Er bekommt einen Stapel
Ansichten und die ganze Frage und schreibt nur seinen Bericht.

- **Prüft der Code:**
  - der Leser arbeitet in einem leeren Ordner außerhalb der Forschung, nicht im Ordner der Forschung;
  - er sieht nur seine Ansichten und schreibt nur seinen Bericht in `notes/readings/`; in die Forschung schreibt er
    nie, und er startet keine Befehle;
  - er liest mit dem Modell für Schrift: `--model`, sonst die Einstellung `model.vision` (bei Claude Code
    standardmäßig `opus`);
  - ohne persönliche Erweiterungen des Agenten (Skills, Plugins, MCP-Server), bis der Mensch `agent.addons`
    einschaltet;
  - in einem Strom-Archiv (ohne KI) starten keine Leser.
- **Nur Methodik:** das Durchblättern eines Buches ist Arbeit der Leser, nicht eigener Subagenten des Agenten. Ein
  Subagent (`strom-scan-reader`) liest nur Ausschnitte gefundener Einträge. Fund und Suche erfasst der Hauptagent
  selbst, die Suche mit `--by reader`.
- **Warum:** ein Bild bleibt im Kontext dessen, der es geöffnet hat; der Hauptagent bekommt so einen kurzen Bericht
  statt eines Kontexts voller Bilder. Ordner außerhalb der Forschung: der Leser darf keine Anweisungen der Forschung
  übernehmen (Dateien CLAUDE.md, AGENTS.md). Das Modell für Schrift nie schwächer als das Hauptmodell: ein falsch
  gelesener Name schickt die Forschung ins falsche Dorf.
- **Bedienung:** Terminal: `strom read B… --images 40-69 --question "…"`. Im Vordergrund starten und zu Ende laufen
  lassen (oft zehn Minuten und mehr).
- **Gilt seit:** Forschung 1.0.0; leerer Ordner außerhalb der Forschung und `agent.addons` 1.14.0

<!-- zdroj: research:src/core/reader.ts:1-9 · src/commands/read.ts:1-4, :183-200, :226, :304-309, :514-523 · src/commands/readers.ts:73-81 readerDesk, :128 refuseReadersInArchive · src/core/reader.ts:307-313 readerSettings · src/agents/profiles.ts:5, :147 · src/core/config.ts:314 agent.addons · assets/method/reading.md:51-68 -->

<a id="R8.3.1"></a>
### R8.3.1 Stapel, gleichzeitige Leser und Umfang

- **Stapel:** 10 Ansichten je Leser (`--batch`, höchstens 12). Eine in Hälften gelesene Doppelseite sind zwei
  Ansichten. Die Stapel sind möglichst gleichmäßig (11 Bilder: 6 und 5, nie 10 und 1).
- **Gleichzeitig:** 5 Leser auf einmal (`--parallel`, 1 bis 10; dauerhaft `strom config set read.parallel <n>`).
- **Umfang:** höchstens 200 Bilder in einer Lesung; eine Liste (`--images 5-19,21-39`) wird genau so gelesen, wie
  sie angegeben ist.
- Bilder, die schon früher gelesen wurden, nennt strom am Anfang; das Lesen lehnt es nicht ab.
- **Warum:** die Kosten eines Lesers wachsen mit dem Quadrat seines Stapels (ein Bild wird in jedem weiteren Schritt
  bezahlt); zehn Bilder je Leser kosten je Bild ein Drittel gegenüber fünfzig. Gleichzeitige Leser geben dieselben
  Leser und Anfragen, nur früher; weniger, wenn sich das Abonnement des Agenten zu schnell erschöpft. Hunderte Bilder
  in einer Lesung sind nach dem Code ein Fehler, keine Absicht.
- **Gilt seit:** Forschung 1.0.0 (Stapel 10, höchstens 12); gleichzeitige Leser 1.15.0; Umfang 200 Bilder 1.14.0;
  Liste mit Lücken 1.15.0

<!-- zdroj: research:src/core/reader.ts:5-15 BATCH, BATCH_MAX, :137-171 batches · src/core/config.ts:229-230, :277 read.parallel · src/core/media.ts:126 IMAGE_RANGE_MAX · src/commands/read.ts:113-120, :407-409 · CHANGELOG.cs.md 1.15.0 -->

<a id="R8.3.2"></a>
### R8.3.2 Größe der Ansichten und eine Doppelseite in Hälften

- **Größe (prüft der Code):** eine Ansicht ist so groß, wie das Modell der Leser sie ganz nimmt: 2000 px an der
  längeren Seite bei neueren Modellen (Claude Opus 4.7 und neuer, Sonnet 5 und neuer, Fable; Codex und OpenCode),
  sonst 1568 px. Anders nur, wenn der Mensch die Größe kalibriert hat (`strom media calibrate`) oder strom sie bei
  einem Buch vergrößert hat ([R8.4](#R8.4)).
- **Doppelseite in Hälften:** bei einer blinden Lesung, in einer Prüfaufgabe und bei einem Bild, das ein Leser früher
  als unklar gemeldet hat, bekommt der Leser eine Doppelseite als zwei Hälften, die sich am Falz überlappen (4 % der
  Breite auf jeder Seite). Nur wenn eine Hälfte mindestens 1,25× schärfer ist als das ganze Bild in einer Ansicht.
  Sonst wird die Doppelseite ganz gelesen; `--half both` erzwingt Hälften, `--whole` verbietet sie, `--half
  left|right` nimmt nur eine Seite.
- **Ausschnitt (`--crop`):** nur dieser Teil jedes Bildes, in voller Auflösung. Einen Ausschnitt, der größer ist als
  eine Ansicht, bekommt der Leser in sich überlappenden Teilen. Kam vom Archiv ein schärferer Teil des Bildes, wird
  aus ihm gelesen.
- **Warum:** ein größeres Bild verkleinert der Agent selbst, bevor das Modell es sieht, und für die verworfenen Pixel
  zahlt er mit langsamerem Lesen. Eine Hälfte zeigt jede Seite schärfer; bei einer fast quadratischen Doppelseite
  würde die zweite Ansicht mehr kosten, als sie bringt.
- **Gilt seit:** Forschung 1.14.0; Lesen aus einem schärferen Teil des Bildes 1.19.0

<!-- zdroj: research:src/agents/images.ts:1-54 IMAGE_MAX, IMAGE_MAX_LARGE, imageMax · src/core/views.ts:113-140 SPREAD_OVERLAP, SPREAD_GAIN, halves, readInHalves, :97 tiles · src/commands/read.ts:192-194, :332-339, :356-390, :59-85 sharperForReader · CHANGELOG.cs.md 1.19.0 „Ostřejší část snímku se opravdu čte“ -->

<a id="R8.3.3"></a>
### R8.3.3 Was ein Leser schreibt

Der Leser schreibt den Bericht fortlaufend, nach jedem Bild, nicht am Ende. Für jedes Bild ein Block mit Feldern:

| Feld | Was darin steht |
|---|---|
| `result` | `found` (Fund), `nothing` (nichts), `unclear` (mögliche Übereinstimmung, die sich nicht bestätigen lässt) |
| `entries` | jeder Eintrag, der die Frage beantwortet, Wort für Wort in der ursprünglichen Sprache und Schreibweise, wo er steht und in welcher Spalte |
| `illegible` | was sich nicht lesen ließ und wo |
| `hand` | Schrift: Tinte, Art der Schrift, Sprache, Abkürzungen |
| `certainty` | bei jedem Namen im Eintrag, wie sicher sich der Leser ist (%) |
| `pages` | auf dem Bild geschriebene Seitenzahlen |
| `gaps` | fehlende Seiten vor dem Bild (die Zählung springt) |
| `section` | auf dem Bild beginnt ein anderer Teil des Buches (Ort, Jahr, Art der Einträge) |

- **Regeln des Lesers** (strom gibt sie in den Auftrag des Lesers):
  - nur abschreiben, wonach die Frage fragt (nur Seitenzahlen, nur Einträge eines Familiennamens, einen Eintrag
    ganz);
  - „nichts“ ist ein gültiges und wertvolles Ergebnis: der Leser sagt, was er geprüft hat;
  - „unleserlich“ hat Vorrang vor einer Schätzung;
  - eine mögliche Übereinstimmung (ein unleserlicher Name, wenn das Übrige passt: Alter, Haus, Datum, Eltern) ist
    `unclear` und ein Eintrag, nie versteckt im Block `nothing`;
  - was die Forschung weiß (`--context`), dient nur zum Erkennen der Familie, nie zum Ergänzen von nicht Gelesenem;
  - bei einer blinden Lesung (`--blind`) eine genaue Abschrift ohne Erwartung ([R3.5](R3-verification-and-citation.md#R3.5)).
- **Prüft der Code:** eine unklare Stelle aus diesem Bericht verhindert das Erfassen einer vergeblichen Suche im
  Bereich, bis sie jemand aus der Nähe angesehen hat ([R3.6](R3-verification-and-citation.md#R3.6)).
- **Warum:** bei einer unklaren Stelle muss der Agent aus der Nähe hinsehen, bevor der Bereich als vergeblich
  durchsucht gilt; eine mögliche Übereinstimmung versteckt sich oft gerade im Unleserlichen. Ein fortlaufender
  Bericht übersteht einen Ausfall: ein wiederaufgenommener Leser fährt bei den Bildern fort, die noch nicht im
  Bericht sind.
- **Gilt seit:** Forschung 1.0.0; Felder `pages`, `gaps`, `section`, `unclear` als Eintrag und „nur, wonach die Frage
  fragt“ 1.14.0

<!-- zdroj: research:src/core/reader.ts:188-240 readerPrompt, :266-300 parseReport · assets/method/reading.md:51-57, :76-77 · src/commands/readings.ts openUnclear, refuseNegativeOverUnclear -->

<a id="R8.3.4"></a>
### R8.3.4 Zeitlimit eines Lesers und Ausfall des Dienstes

- **Prüft der Code:** ein Leser hat 5 Minuten und 1 Minute je Ansicht, mindestens 6 und höchstens 15 Minuten. Haben
  Leser desselben Agenten und Modells mehr gebraucht, verlängert strom das Limit: nach den letzten 10 Lesern, die zu
  Ende gelaufen oder an das Limit gestoßen sind (×1,5 nach einem zu Ende gelaufenen, ×2 nach einem angehaltenen), nie
  über 15 Minuten. `--minutes` setzt das Limit von Hand.
- **Ausfall des Dienstes:** ein Leser, bei dem der Dienst des Modells nach wiederholtem Versuch 150 s schweigt, wird
  einmal dort wiederaufgenommen, wo er aufgehört hat, mit der übrigen Zeit. Schweigt der Dienst weiter, endet der
  Leser sofort; seine Bilder werden später erneut gelesen. Ein solcher Ausfall verkleinert die Stapel nicht.
- Ein vom Limit angehaltener Leser hat zu seinen Bildern keine Antwort gegeben: strom sagt, dass der Agent sie selbst
  ansehen oder mit einem längeren Limit erneut lesen soll.
- **Warum:** Fälle aus echten Forschungen: der Leser eines einzigen Ausschnitts stand 15 Minuten, und der Agent
  wartete auf ihn; der Leser eines einzigen Ausschnitts endete im Limit von 6 Minuten ohne Ergebnis, dieselbe Lesung
  mit einem Limit von 12 Minuten war in 4 fertig. Ein schweigender Dienst führte früher bis zum Limit, und Leser ohne
  Ergebnis verkleinerten die Stapel.
- **Gilt seit:** Forschung 1.14.0; Wiederaufnahme nach einem Ausfall des Dienstes 1.22.0

<!-- zdroj: research:src/core/reader.ts:17-91 readerMinutes, learnedReaderMinutes, READER_STALL_MS · src/commands/read.ts:493-496, :674-680 · src/core/readstats.ts readerLimit · CHANGELOG.cs.md 1.22.0 -->

<a id="R8.3.5"></a>
### R8.3.5 Lesen bis zum Fund

- **Prüft der Code:** mit `--until-found` beginnt kein weiterer Leser, sobald einer einen Fund meldet; Leser, die
  schon arbeiten, lesen zu Ende. strom gibt genau aus, welche Bilder niemand gelesen hat.
- **Grenzen:** durchsucht sind nur die gelesenen Bilder; die Suche wird als `--result partial` erfasst, nie als
  vergeblich für den ganzen Bereich.
- **Nur Methodik:** nur für **einen** konkreten Eintrag (Taufe, Heirat oder Begräbnis einer Person, über die genug
  bekannt ist). Nie für alle Einträge eines Ortes oder Familiennamens und nicht, wo nach dem Fund ein Namensvetter
  kommen kann. Ist der Fund nicht der richtige, wird der Rest gelesen.
- **Warum:** ein nicht gelesenes Bild ist nicht durchsucht. Ein Namensvetter ist nicht die gesuchte Person
  ([R1.4](R1-research-in-brief.md#R1.4)).
- **Gilt seit:** Forschung 1.15.0

<!-- zdroj: research:src/commands/read.ts:197-199, :216, :468-489, :596-631 · assets/method/reading.md:70-75 · CHANGELOG.cs.md 1.15.0 -->

<a id="R8.3.6"></a>
### R8.3.6 Lesen eines Buches, das gerade geladen wird

- **Prüft der Code:** ein Buch, das `strom fetch` gerade herunterlädt, lässt sich sofort lesen. Die Leser beginnen
  mit den registrierten Bildern (Stapel zu 10), auf den Rest wird gewartet. Bilder, die das Herunterladen nicht
  gebracht hat, gibt strom genau aus; sie werden nicht gelesen und zählen nicht als vergeblich.
- **Warum:** schnelleres Lesen; das Archiv bekommt dieselben Anfragen im selben Tempo.
- **Gilt seit:** Forschung 1.15.0

<!-- zdroj: research:src/commands/read.ts:195-196, :238-253, :411-456, :599-633 · CHANGELOG.cs.md 1.15.0 „Rychlejší čtení“ -->

<a id="R8.3.7"></a>
### R8.3.7 Was der Agent zurückbekommt

- **Prüft der Code:** nach dem Lesen bekommt der Agent eine kurze Zusammenfassung: auf welchen Bildern ein Fund ist,
  auf welchen eine unklare Stelle, was sich dort, wo nichts war, nicht lesen ließ, und Lücken im Buch. Dazu einen
  fertigen Befehl `strom search add … --by reader` mit dem Ergebnis `found`, `partial`, `inconclusive` oder `negative`
  und den Lücken in `--note`. Die Berichte werden in der Forschung gespeichert.
- Bilder, die niemand gemeldet hat, und Leser, die versagt haben, sind getrennt aufgeführt.
- **Nur Methodik:** die Berichte werden nicht ganz gelesen, nur über `strom readings` (`--match <příjmení>`,
  `--list`, ein Bild: `strom readings B… --image 57`). Jeder Bericht wird sofort erfasst, bevor weitere Leser
  beginnen. Früher gelesene Bilder: eine andere Frage oder eine blinde Kontrolle ist in Ordnung, dieselbe Frage nicht.
- **Warum:** der Hauptagent hält im Kontext nur, was die Leser gefunden haben, keine Bilder und keine ganzen Berichte.
- **Bedienung:** Terminal: `strom readings`.
- **Gilt seit:** Forschung 1.0.0; `strom readings` 1.14.0

<!-- zdroj: research:src/commands/read.ts:641-689 · src/commands/readings.ts:467-478 · assets/method/reading.md:57-67 · src/core/reader.ts:1-3 -->

<a id="R8.4"></a>
## R8.4 Selbstabstimmung des Lesens

strom misst, wie das Lesen der Scans verläuft, und ändert danach selbst, wie gelesen wird. Nur zu mehr Genauigkeit
oder zu weniger Anfragen an das Archiv.

- **Prüft der Code,** was strom selbst ändern darf:
  - ein Buch, das schlechter gelesen wird als die anderen oder vergrößert gezeigt wird: das ganze Bild in der Größe
    zum Lesen, die Doppelseite in Hälften, aus Bildern, die schon auf dem Computer sind;
  - Leser, die den Kontext verlieren, Ansichten erneut öffnen oder kein Ergebnis geben: kleinere Stapel und weniger
    Ansichten je Aufruf, nie unter die Hälfte des Standardwerts;
  - ein Archiv, das an sein Limit gestoßen ist: zuerst ganze Bilder, Hälften und Teile nur bei Kandidaten;
  - ein Buch, für das das Portal keinen schärferen Teil gab: weitere Teile werden nicht angeboten;
  - heruntergeladene und nie gelesene Bilder: geladen wird nur, was die Aufgabe liest;
  - jede Änderung kehrt nach 60 Tagen ohne ihr Signal und mit neuen Lesungen zum Standardwert zurück.
- **Grenzen (prüft der Code):** nie eine kleinere Ansicht, ein billigeres Modell, ein Lesen, das einen Eintrag
  verfehlen könnte, oder mehr Anfragen an das Archiv: das entscheidet der Mensch (`strom media calibrate
  --questions`). Entschieden wird nach der Sitzung, nie während der Sitzung: eine Sitzung folgt den Werten von ihrem
  Beginn. Gilt getrennt für jeden Agenten und jedes Modell. Jede Änderung ist mit Grund erfasst.
- **Bedienung:** Terminal: `strom media calibrate --report` (wie das Lesen verlief, kostenlos), `--questions` (was
  der Mensch entscheidet), `--reset` (zurück zum Standard); `strom config set tune.auto off` schaltet die
  Selbstabstimmung aus. Die Kalibrierung der Größe der Ansichten (`strom media calibrate`) ist ein bezahltes Lesen
  eigener belegter Einträge der Forschung, und nur der Mensch bestätigt sie.
  `strom doctor`, die Zeile **nach der Selbstabstimmung**: eine Änderung, nach der schlechter gelesen wird (empfiehlt,
  sie rückgängig zu machen), oder eine Änderung, nach der das Lesen teurer und um nichts sicherer ist (empfiehlt, sie
  zu behalten).
- **Warum:** nach dem Code nur so, dass sich dadurch nichts verschlechtert: eine Änderung darf Genauigkeit hinzufügen
  oder Anfragen an das Archiv sparen; was Genauigkeit nehmen oder das Archiv belasten könnte, ist eine Frage für den Menschen. Eine teurere Änderung empfiehlt `strom doctor` zu behalten, weil sie zur Genauigkeit
  ging und die Sicherheit nur an den unsicheren Stellen gemessen wird: eine nähere Ansicht kann genauer lesen, auch wenn
  die unsicheren Stellen nicht weniger werden.
- **Gilt seit:** Forschung 1.14.0
- **Ab Forschung 1.29.0:** `strom doctor` sagt bei einer teureren Änderung, warum es empfiehlt, sie zu behalten.

<!-- zdroj: research:src/core/tune.ts:1-21 (A1–A7) · src/core/readstats.ts:88-99 TUNING smallest, backAfterDays · src/core/config.ts:337 tune.auto · src/commands/calibrate.ts:394-420 · assets/lang/cs.json ui.doc.tuneworse, ui.doc.tuneworse.a, ui.doc.tuneworse.b (důvod od commitu 9bd14e84, 1.29.0) -->

<a id="R8.5"></a>
## R8.5 Eigenes Lesen des Hauptagenten

Einen Eintrag, der zitiert wird, sieht sich der Hauptagent selbst in voller Auflösung an. Mit alter Schrift befasst
sich das stärkste Modell, nie ein schnelles oder billiges Lesen.

- **Prüft der Code:** Bilder werden nur als Ansichten `strom media view` geöffnet (Datei in `.strom/views/`). Ein
  ganzes Bild hat höchstens 1400 px an der längeren Seite: zum Finden des Eintrags, nicht zum Lesen. Hälfte,
  Ausschnitt und Teile haben die Größe, die das Modell ganz nimmt (1568 oder 2000 px). Höchstens 12 Bilder und 24
  Ansichten je Aufruf.
- **Nur Methodik,** Ablauf:
  1. finden: das ganze Bild mit `--grid` (Raster in Zehnteln), ablesen, wo der Eintrag ist;
  2. ausschneiden: `--crop x,y,w,h` (Bruchteile des Bildes) oder `--half left|right`; abgeschrieben wird nur
     aus einem Ausschnitt oder einer Hälfte in voller Auflösung. Verblasste Tinte `--contrast`, eine seitlich liegende
     Seite `--rotate 90`, eine Seite in Teilen `--split 2x2`; ist die ganze Ansicht unklar: `--half both`, bevor
     „nicht gefunden“ gesagt wird;
  3. nach etwa 30 Ansichten erfassen, was gefunden wurde, bevor weitere geöffnet werden; eine Ansicht, die aus dem
     Kontext gefallen ist, wird nicht erneut geöffnet, es gelten die Notizen;
  4. sagt der Ausschnitt „vergrößert“, hat der Scan nicht mehr Detail. Einen schärferen Teil lädt nur ein
     Downloader, der das kann.
- Seite ↔ Bild: `strom recordset calibrate B… --point 57=112` (auf dem Bild gemessen, nie geschätzt); dann
  `strom media view B… --page 112`.
- **Warum:** ein verkleinertes ganzes Bild reicht zum Finden des Eintrags für die Hälfte der Tokens, aber nicht zum
  Lesen. Jede Ansicht bleibt im Kontext, der sie geöffnet hat. Auf so wenige Pixel sehen, wie die Frage braucht.
- **Bedienung:** Terminal: `strom media view B…:57 --grid`, `strom media view B…:57 --crop 0.05,0.40,0.45,0.18`.
- **Gilt seit:** Forschung 1.0.0 (Ansichten, `--grid`, `--crop`, `--contrast`, `--rotate`); Größen 1400/1568/2000 px,
  `--split`, Limits je Aufruf und etwa 30 Ansichten 1.14.0

<!-- zdroj: research:assets/method/reading.md:3-8, :18-50, :86-88 · src/commands/media.ts:239-241 VIEW_MAX_IMAGES, VIEW_MAX_VIEWS, :934-967 · src/agents/images.ts:14-18 OVERVIEW_MAX · src/agents/profiles.ts:43 DEFAULT_READING_NUMBERS viewsStop · src/commands/sources.ts:612-618 recordset calibrate -->

<a id="R8.5.1"></a>
### R8.5.1 Name und Ort für die weitere Suche

- **Nur Methodik:** ein Name oder Ort, von dem die weitere Suche abhängt (Familienname, Geburtsort, Pfarrei), wird
  vor dem Erfassen erneut auf einem Ausschnitt in voller Auflösung gelesen. Was unsicher bleibt, wird als unsicher
  erfasst und so gesagt.
- **Warum:** ein falsch gelesener Name schickt die Forschung ins falsche Dorf.
- **Gilt seit:** Forschung 1.4.1

<!-- zdroj: research:assets/method/reading.md:3-8 -->

<a id="R8.5.2"></a>
### R8.5.2 Ein unsicher gelesener Ort ist ein Hinweis

- **Nur Methodik:** ein unsicher gelesener Ort (die Leser weichen ab, `[?]`, nichts anderes bestätigt ihn) ist ein
  Hinweis, kein Ort. Aus ihm folgen keine Pfarrei, kein Buch und keine Aufgabe, bis er sicher ist: eigener Blick auf
  den Ausschnitt, Register des Buches, Ortsverzeichnis oder Kataster (die Pfarrei des Dorfes aus ihnen, nie aus der
  heutigen Gemeinde). Bleibt er unsicher: eine Hypothese mit den Lesungen als Varianten (`strom hypothesis add`) und
  eine Aufgabe, die sie prüft (`--about H…`).
- **Warum:** eine Aufgabe, die den unsicheren Ort als sicher nähme, würde im Buch einer anderen Pfarrei suchen.
- **Gilt seit:** Forschung 1.14.0

<!-- zdroj: research:assets/method/reading.md:10-15 · assets/method/locate.md:8-9 -->

<a id="R8.6"></a>
## R8.6 Erfassen eines Fundes

Ein gefundener Eintrag wird auf einmal erfasst: die Quelle mit Ausschnitt, Abschrift und Stelle im Buch, die Angaben
daraus und die Suche, die ihn gefunden hat.

- **Prüft der Code:** `strom batch --file notes/<soubor>` erfasst alle Zeilen oder keine; fehlerhafte Zeilen nennt es
  alle auf einmal.
- **Nur Methodik:**
  - eine Quelle aus einem Scan bekommt `--clip` (den Ausschnitt, in dem der Eintrag gelesen wurde), `--transcript`
    (die Worte des Eintrags zeilenweise, nicht Gelesenes `[?]`) und `--locator` (Folio, Seite, Nummer des Eintrags);
    ausführlich [R3.4](R3-verification-and-citation.md#R3.4);
  - ein Eintrag in einer anderen Sprache oder Schrift als der Sprache der Forschung bekommt neben der wörtlichen
    Abschrift auch eine Übersetzung in die Sprache der Forschung (`--translation`), ab Forschung 1.28.0;
  - in die Felder (`--date`, `--house`, `--age`, Name) kommt nur sicher Gelesenes. Unsicheres kommt mit `[?]` in die
    Abschrift und in die Notiz der Angabe („Haus 21 oder 27“). Was ein Leser als unleserlich gemeldet hat, bleibt
    unleserlich, bis der Agent es selbst liest. Eine leere Spalte ist leer; nichts wird nach dem Üblichen ergänzt;
  - ein nur teilweise gelesener Name behält die sicheren Buchstaben (`Anna /Kr[?]ková/`), ein Datum mit unsicherem
    Tag behält den Monat;
  - die Suche wird auch ohne Fund erfasst, mit dem genauen Bereich der Seiten; fehlende Seiten des Buches sind nicht
    durchsucht ([R3.6](R3-verification-and-citation.md#R3.6)).
- **Prüft der Code:** eine vergebliche Suche über einer Stelle, die ein Leser als unklar gemeldet hat, lehnt strom ab
  ([R3.6](R3-verification-and-citation.md#R3.6)). An einen fehlenden Ausschnitt oder eine fehlende Abschrift erinnert
  es.
- **Warum:** die Strom-App zeigt den aus dem Scan ausgeschnittenen Eintrag neben seinen Worten. Nach den sicheren
  Feldern wird die Person weiter gesucht; ein Name mit sicheren Buchstaben lässt sich weiter finden. Der teuerste
  Fehler ist, dasselbe Buch zweimal zu durchsuchen.
- **Bedienung:** Terminal (Agent). App: der Quellenbetrachter zeigt Ausschnitt und Transkription
  ([A3.3](A3-evidence-in-the-app.md#A3.3)).
- **Gilt seit:** Forschung 1.0.0; Ausschnitt 1.1.0

<!-- zdroj: research:assets/method/recording.md:1-27, :55-65 · assets/method/reading.md:76-84 · assets/method/core.md „Negative results are results“ · překlad: recording.md "--translation", link.md krok 7 (od v1.28.0) -->

<a id="R8.7"></a>
## R8.7 Sicherheit und Prüfung des Gelesenen

Der Grad der Sicherheit einer Angabe aus einem Scan hängt davon ab, wer den Eintrag wie gelesen hat.

- **Nur Methodik:** Belegt nur dann, wenn der Hauptagent den Eintrag selbst gelesen hat und der Eintrag die Angabe
  direkt nennt. Eine Schlussfolgerung, die auf einer einzigen schwierigen Zelle steht (Hausnummer, Alter, Name),
  braucht vor Belegt eine zweite, blinde Lesung; abweichende Lesungen sind ein Widerspruch, keine Wahl
  ([R3.5](R3-verification-and-citation.md#R3.5)).
- **Prüft der Code:** Belegt braucht eine Zitation aus einer Quelle, die nicht schwach ist, mit Primärinformation
  ([R3.2](R3-verification-and-citation.md#R3.2)). Der Code **prüft nicht**, dass der Hauptagent den Eintrag selbst
  gelesen hat, und auch nicht die blinde Lesung.
- Ein Dokument, das Leser der Forschung gelesen haben: ein Leser → Möglich; zwei blinde Leser übereinstimmend →
  Wahrscheinlich ([R3.5.1](R3-verification-and-citation.md#R3.5.1)). Grade der Sicherheit:
  [R3.1](R3-verification-and-citation.md#R3.1).
- **Warum:** der zweite Leser darf den erwarteten Wert nicht kennen, sonst würde er ihn „lesen“. Über Wahrscheinlich
  steigt eine Angabe nur, wenn zwei unabhängige Lesungen übereinstimmen.
- **Gilt seit:** Forschung 1.0.0; Lesen eines Dokuments durch Leser der Forschung 1.18.0

<!-- zdroj: research:assets/method/verify.md:1-18 · assets/method/core.md:8-12 · src/core/evidence.ts:55-68 checkStatus · src/core/readsync.ts readingGrade -->

<a id="R8.8"></a>
## R8.8 Ein Dokument aus der App lesen

Ein Foto, Scan oder PDF eines Dokuments lässt sich aus der App dem Agenten der Forschung zum Lesen geben:
Transkription, Übersetzung und Erläuterung. Lesen kann ein Leser oder zwei unabhängige; zwei werden verglichen, und
das Ergebnis zeigt die Stellen, an denen sie abweichen. In den Stammbaum kommt vom Gelesenen nichts ohne Bestätigung.

- **Prüft der Code:**
  - Eingabe: Foto, Scan oder PDF; mehrere Dateien sind Seiten eines Dokuments; höchstens 10 Seiten und 50 MB pro
    Datei. Eine Seite, deren kürzere Seite weniger als 800 px hat, ist zu klein, und die Leser bekommen sie nicht;
  - **1 Leser** (schneller, günstiger) oder **2 unabhängige Leser** (zuverlässiger, zum Eintragen in den Stammbaum);
    die Wahl wird gemerkt;
  - jeder Leser beginnt mit sauberem Kontext und liefert: Transkription wortgetreu, Übersetzung in die Sprache der
    Forschung, Erläuterung (Begriffe, Abkürzungen, Berufe, Zusammenhänge) und die genannten Personen, Ereignisse und
    Beziehungen;
  - der zweite Leser liest blind, ohne das erste Lesen zu sehen. Verglichen werden die Transkriptionen Wort für Wort,
    die Personen nach Rolle und Reihenfolge, die Ereignisse nach Art und Reihenfolge. Wo sie abweichen, gibt es
    Varianten;
  - ein Name, den ein Leser angibt, muss in seiner Transkription stehen. Welche Personen und Orte des Stammbaums
    passen, bestimmt strom, nicht der Leser;
  - höchstens 20 Lesungen pro Stunde und 60 pro Tag (erhöhen kann sie nur der Mensch); bei einem Stammbaum wird ein
    Dokument auf einmal gelesen, und 3 weitere warten. Im Strom-Archiv gibt es das Lesen nicht.
- **Ergebnis:**
  - die Marke der Übereinstimmung: **2 Leser, übereinstimmend**, **2 Leser, K Stellen weichen ab** oder **1 Leser**.
    Auf der Seitenvorschau markiert ein grüner Rahmen den gewählten Eintrag und ein bernsteinfarbener die Stellen, an
    denen die Leser abweichen („Leser weichen ab: der erste liest „a“, der zweite „b““). In der Transkription bedeutet
    `[?]` unsicheres Lesen und `[...]` eine unleserliche oder ausgelassene Stelle;
  - die Abschnitte **Transkription**, **Übersetzung**, **Erläuterung**, **Über das Dokument**, **Erwähnt**;
    **Transkription kopieren**;
  - ein Dokument, das sich nicht lesen lässt, bekommt einen Grund (verschwommen, Spiegelung über dem Text, schräg
    fotografiert, Teil der Seite fehlt, zu dunkel, zu klein, kein geschriebener Text im Bild) und einen Rat für ein
    besseres Foto;
  - das Ergebnis bleibt im Verlauf des Lesens (**Gelesene Dokumente**). In den Stammbaum geht es über **In den
    Stammbaum vorschlagen…**.
- **Grenzen:**
  - ohne Wahl lesen Agent und Modell der Forschung für Scans ([R8.3](#R8.3)); bei jedem Leser lassen sich Agent,
    Modell und Gründlichkeit wählen ([R8.8.1](#R8.8.1)). Das Lesen zählt zu den Kosten der Forschung,
    auch ein abgebrochenes: Bereits Gelesenes zählt;
  - das Fenster lässt sich schließen; das Lesen läuft weiter, und das Ergebnis wird gemeldet. Die Schätzung im Fenster
    rechnet mit etwa einer Minute pro Leser, mit Grok 4 Minuten;
  - lesen geht nur mit einer Forschung, die auf diesem Computer läuft und einen Agenten eingerichtet hat; sonst sagt
    der Dialog, warum (**Gerade nicht möglich: …**).
- **Bedienung:** App: **Forschung → Dokument lesen…**, im Menü der Person **Dokument zu dieser Person lesen…**; Dateien
  ins Fenster ziehen oder **Dateien wählen…**; wahlweise **Dokument betrifft** (eine Person) und **Notiz**;
  **Leser**; **Lesen**. Eine in die App gezogene Datei bietet **Jetzt lesen** oder **Zu den Materialien**
  ([R11](R11-material-from-the-user.md)). Verlauf: **Forschung für diesen Stammbaum… → Gelesene Dokumente (N) ›**.
  Eine Quelle, die schon eine Abschrift hat, lässt sich erneut aus dem Original lesen ([R8.8.2](#R8.8.2)).
- **Gilt seit:** App 3.14.0, Forschung 1.18.0


- **Ab App 3.25.0 und Forschung 1.29.0:** die Wahl der Leser (**Lesen anpassen**, [R8.8.1](#R8.8.1)), wer gelesen hat,
  **Erneut lesen…** bei einer Quelle ([R8.8.2](#R8.8.2)) und die Einstellung **Aufgabe aus einer neuen Lesung**
  ([R8.8.3](#R8.8.3)).

<!-- zdroj: app:src/ui/read-document-ui.ts · strings.ts read.* (menu, menuPerson, r1/r1Sub, r2/r2Sub, agree, differ, oneReader, variantNote, scanHint, whyText, advice, cancelled, closeNote, limit, propose, historyRow) · research:src/core/document.ts DOC_PAGES=10, SMALL_PX=800 · src/core/live-read.ts READ_MAX_BYTES=50 MB, READ_QUEUE_MAX=3, read.app (20/h, 60/den) · src/commands/document.ts:463 · config model.vision · spec 059 K1.1 · 3.25.0/1.29.0: spec 059 K2.1, K3.1, K6, K7; app:6bd8609e strings.ts read.refine, read.sourceAgain · research:c2a690ea CHANGELOG.cs.md 1.29.0 -->

<a id="R8.8.1"></a>
### R8.8.1 Leser: Programm, Modell und Gründlichkeit

Jeder Leser eines Dokuments kann mit einem anderen Agenten, Modell und einer anderen Gründlichkeit lesen. Ohne Wahl
wird nach den Einstellungen der Forschung gelesen. Das Ergebnis sagt bei jeder Lesung, wer gelesen hat.

- **Prüft der Code:**
  - **1 Leser** (schneller) oder **2 Leser** (zuverlässiger, für den Stammbaum). Zwei Leser lesen jeder für sich; wo
    ihre Texte voneinander abweichen, kann ein Fehler stecken, und diese Stelle wird zum Prüfen gezeigt;
  - in **Lesen anpassen** haben **Leser 1** und **Leser 2** jeweils ein **Programm** (den Agenten), ein **Modell** und
    eine **Gründlichkeit** (**schnell**, **normal**, **höher**, **am höchsten**), nur aus dem, was die Forschung auf
    diesem Computer anbietet. Standard ist **laut Einstellungen des Agenten**; eine Änderung wird fürs nächste Lesen
    gemerkt (**Standard** stellt die Einstellungen der Forschung wieder her);
  - ohne Wahl liest das Modell der Forschung für Scans (`model.vision`), nie ein günstigeres Modell;
  - der zweite Leser liest blind und sieht die erste Lesung nicht ([R3.5](R3-verification-and-citation.md#R3.5));
  - ein Agent, der gerade nicht lesen kann (Anmeldung abgelaufen, Limit erreicht), wird mit dem Grund angeboten, und
    ein Leser mit ihm startet nicht. Ein Modell, das das installierte Codex nicht kennt, beendet das Lesen als Fehler
    des Lesers mit diesem Grund.
- **Ergebnis:** **Gelesen von** bei jeder Lesung: Agent · Modell · Gründlichkeit jedes Lesers, im Terminal, in der
  Datei der Lesung und in der App. Der Text ist nach Leser 1; Leser 2 las unabhängig, zur Kontrolle, und sein ganzer
  Text lässt sich zeigen (**Abschrift des Lesers**: **Leser 1** / **Leser 2**). Lasen beide mit demselben Programm,
  sagt es das Ergebnis.
- **Warum:** zwei Leser desselben Modells sind ein schwächerer Beleg als zwei verschiedene Modelle: wo sie
  übereinstimmen, können sie sich gleich irren. So sagt es auch die Aufgabe aus einer neuen Lesung ([R8.8.3](#R8.8.3)).
- **Bedienung:** App: **Dokument lesen…** und **Erneut lesen…** → **Leser** → **Lesen anpassen**. Terminal:
  `strom document read … --agent --model --effort` (der erste Leser) und `--blind-agent --blind-model --blind-effort`
  (der blinde Leser), `--readers 2`.
- **Gilt seit:** Forschung 1.29.0, App 3.25.0

<!-- zdroj: app:6bd8609e src/strings.ts read.c1/c1Sub/c2/c2Sub/readersWhy, refine, readerN, colProgram, colModel, colThorough, thorough.*, bySettings, changed, reset, agentWhyAuth/agentWhyLimit, downRow, readBy, readerView, whoLine, whoSame · research:c2a690ea strom help document read (--agent/--model/--effort, --blind-agent/--blind-model/--blind-effort: „default model.vision — never weaker for handwriting“) · assets/lang/cs.json read.source.same · CHANGELOG.cs.md 1.29.0 · spec 059 K1.2, K2.1, K2.2, K6.6 -->

<a id="R8.8.2"></a>
### R8.8.2 Eine Quelle erneut aus dem Original lesen

Eine Quelle mit Abschrift lässt sich erneut aus dem Original lesen (dem Scan oder dem Ausschnitt in der Forschung),
nicht aus der Abschrift. Die neue Lesung wird Stelle für Stelle mit der Abschrift verglichen. Die Abschrift ändert sich
dadurch nicht: Die neue Lesung bleibt neben ihr bei der Quelle gespeichert.

- **Prüft der Code:**
  - nur bei einer Quelle, deren Original die Forschung auf diesem Computer hat und die eine Abschrift hat; sonst sagt
    die App, warum (**Die Forschung hat das Original der Quelle auf diesem Computer nicht.**, **Die Quelle hat keine
    Abschrift, mit der ein neues Lesen verglichen werden könnte.**). Am Telefon nur ein Satz, dass erneut lesen in der
    App am Computer mit der Forschung geht;
  - die Leser sehen weder die Abschrift noch die Namen. Sie bekommen, was die Forschung über den Eintrag weiß: Art,
    Sprache, Datum und wo der Eintrag steht;
  - mit der Abschrift wird nur der Eintrag der Quelle verglichen, nicht benachbarte Einträge vom Rand des Ausschnitts.
    Nicht als Unterschied zählen Spaltenbeschriftungen ohne Gegenstück, Überschriften und Anmerkungen der Forschung und
    des Lesers in Klammern, langes ſ gegen s, eine unleserliche Stelle gegen nichts und Wörter außerhalb dessen, was
    beide gelesen haben;
  - jede Stelle, an der die neue Lesung von der Abschrift abweicht, hat eine Art:
    - **inhaltliche Änderung**: ein Name, eine Zahl, ein Datum, eine Person oder ein Wort dort, wo die Abschrift
      `[...]` hat;
    - **Kleinigkeit**: Rechtschreibung, Abkürzung, Zeichensetzung, Beschriftung, Großbuchstaben;
  - eine inhaltliche Änderung ist nur dann **sicher**, wenn beide Leser sie gegenüber der Abschrift gleich gelesen
    haben und die neue Lesung dort weder `[...]` noch `[?]` hat. Eine Stelle, an der die Leser voneinander abweichen,
    ist eine Unsicherheit, keine Änderung der Abschrift. Bei einem Leser sind die unsicheren Stellen die, an denen
    sich der Leser nicht sicher war (die neue Lesung hat dort `[...]` oder `[?]`), keine Abweichung zweier Leser;
  - eine Stelle, die eine Aufgabe schon geprüft hat oder die der Mensch behalten oder abgelehnt hat, wird nicht erneut
    geprüft.
- **Ergebnis** (Fenster **Quelle erneut gelesen**): „Gegenüber der bisherigen Abschrift N inhaltliche Änderungen und K
  Kleinigkeiten.“ oder **Stimmt mit der bisherigen Abschrift überein.**; **Die Leser stimmen überein.** oder „Die Leser
  weichen an N Stellen voneinander ab.“; in **Zu prüfen** die Gruppen **Inhaltliche Änderungen zu prüfen** (bei einer
  vom Menschen bestätigten Abschrift **Inhaltliche Änderungen zur Prüfung**), **Unsicher – Leser weichen ab** (bei
  einem Leser **Unsicher – Leser war nicht sicher**), **Bereits geprüft in Aufgabe T…**, **Bereits entschieden:
  behalten** und **Kleinigkeiten**. Von selbst gehen nur sichere inhaltliche Änderungen in eine Aufgabe, unsichere
  Stellen nur auf Wunsch des Menschen ([R8.8.3](#R8.8.3)).
- **Grenzen:** die Bestätigung der Abschrift durch den Menschen bleibt. Eine neue Lesung überschreibt die Abschrift nie
  von selbst ([R3.4.1](R3-verification-and-citation.md#R3.4.1)).
- **Bedienung:** App: Quellenbetrachter → **Erneut lesen…** (Marke KI), mit der Wahl der Leser ([R8.8.1](#R8.8.1));
  bei der Quelle dann die Zeile der neuen Lesung mit **Ergebnis ›**. Terminal:
  `strom document read --source S… [--clip …]`, `strom source show S…`.
- **Warum:** nach einer Zeit lässt sich eine Abschrift von einem anderen Leser prüfen, aus dem Original.
  Übereinstimmung stützt die bisherige Abschrift; ein Unterschied ist ein Anhaltspunkt zum Prüfen, keine neue
  Abschrift.
- **Gilt seit:** Forschung 1.29.0, App 3.25.0

<!-- zdroj: research:c2a690ea src/core/sourceread.ts (porovnání, druhy míst, sure, judged) · strom help document read --source · CHANGELOG.cs.md 1.29.0 · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 1, Tabulka scénářů) · app:6bd8609e src/ui/read-source-ui.ts (nabídka jen s originálem, AI) · strings.ts read.sourceAgain, sourceAgainTitle, againPhone, srcWhy.*, resultSource, vSrc, vSrcSame, vDis, check, gMajor, gMajorPerson, gUnsure, gJudged, gKept, gMinor, vk.*, againResultLink, keepConfirm · spec 059 K3.1–K3.3, K6.2, K6.3 · dirigent:test ověření aplikace 6bd8609e · jeden čtenář: research:4895d0f0 src/core/sourceread.ts surely (jeden čtenář: nejisté jen `[...]`, `[?]`) · app:7327b758 strings.ts read.gUnsure1, vk.number („číslo“) · dirigent:test/vysledek-1107-nejista-mista.md -->

<a id="R8.8.3"></a>
### R8.8.3 Aufgabe aus einer neuen Lesung

Eine Aufgabe aus einer erneut gelesenen Quelle entsteht von selbst nur aus einer sicheren inhaltlichen Änderung, die
noch niemand geprüft hat. Kleinigkeiten legen nie eine Aufgabe an, unsichere Stellen nicht von selbst: Sie lassen sich
dem Agenten nur auf Wunsch des Menschen geben. Ob die Aufgabe aus einer sicheren inhaltlichen Änderung sofort entsteht
oder der Mensch entscheidet, bestimmt die Einstellung **Aufgabe aus einer neuen Lesung**.

- **Einstellung** (`read.sourceTask`, für jeden Stammbaum):
  - **Nachfragen** (`ask`, Standard): keine Aufgabe entsteht von selbst. Die Lesung bleibt bei der Quelle als nicht
    geprüft, bis der Mensch entscheidet;
  - **Immer anlegen** (`always`): die Aufgabe entsteht sofort; bei einer vom Menschen bestätigten Abschrift ein
    vorgeschlagener Wortlaut für den Menschen;
  - **Nie anlegen** (`never`): keine Aufgabe entsteht von selbst; die Lesung wartet bei der Quelle, und der Mensch kann
    genauso entscheiden wie bei **Nachfragen**.
- **Wahl** (Fußzeile des Fensters **Quelle erneut gelesen**, bei der Quelle **Entscheiden ▸**):
  - eine Abschrift, die der Mensch nicht bestätigt hat: **Aufgabe für den Agenten** → **Jetzt mit dem Agenten prüfen**
    (eine Aufgabe und sofort ein Gespräch mit dem Agenten im Terminal) oder **In die Warteschlange des Agenten** (eine
    Aufgabe vorn in der Warteschlange, Priorität 3); **Ohne Aufgabe** → **Nur speichern** (keine Aufgabe, die Quelle
    fragt nicht mehr, und dieselben Stellen werden nicht erneut angeboten; bei der Quelle lässt sich dann noch **Dem
    Agenten geben…** wählen);
  - eine vom Menschen bestätigte Abschrift: **Aufgabe für einen Menschen** → **Zur Prüfung vormerken** (ein
    vorgeschlagener Wortlaut für den Menschen; der Agent arbeitet nicht daran,
    [R3.4.1](R3-verification-and-citation.md#R3.4.1)) oder **Nur speichern**. Eine Aufgabe für den Agenten entsteht hier
    nie;
  - eine Quelle mit einer nicht abgeschlossenen Aufgabe: **An T… anfügen und jetzt prüfen**, **An Aufgabe T…
    anfügen**. Eine Quelle hat zugleich eine Aufgabe ihrer Lesungen: neue Stellen werden ihr angefügt, keine doppelt.
- **Unsichere Stellen auf Wunsch:**
  - angeboten nur bei einer Lesung, die keine sichere inhaltliche Änderung zu entscheiden hat, aber unsichere Stellen,
    die keine Kleinigkeit sind und die noch keine Aufgabe geprüft hat. In der Fußzeile des Fensters **Quelle erneut
    gelesen** steht die Wahl neben **Schließen** (das bleibt die Hauptschaltfläche), bei der Quelle in der Zeile der
    neuen Lesung (**Dem Agenten geben… ▸**, bei einer bestätigten Abschrift **Zur Prüfung vormerken… ▸**). Sie wird
    bei jeder Einstellung angeboten, auch bei **Nie anlegen**; am Telefon nicht. Nur Kleinigkeiten oder bereits
    geprüfte Stellen → die Wahl wird nicht angeboten;
  - eine Abschrift, die der Mensch nicht bestätigt hat: **Dem Agenten zur Prüfung geben** (Marke KI) → eine Aufgabe
    für den Agenten in der Warteschlange (Priorität 3), oder die Stellen werden der nicht abgeschlossenen Aufgabe der
    Quelle angefügt. Die Leser haben blind gelesen, ohne Abschrift und Namen ([R8.8.2](#R8.8.2)); die Stellen prüft
    erst der Agent, am Scan mit allem, was die Forschung über die Personen, Orte und Daten des Eintrags weiß. Wo der
    Scan es sicher zeigt, berichtigt er die Abschrift und schreibt den Grund; sonst lässt er die Abschrift und schreibt
    zur Quelle eine Notiz, was er angesehen hat und warum die Stelle unsicher bleibt. Er fragt den Menschen nichts;
  - eine vom Menschen bestätigte Abschrift: **Zur Prüfung vormerken** → eine Aufgabe für den Menschen mit einem
    vorgeschlagenen Wortlaut nur aus den unsicheren Stellen, die die neue Lesung gelesen hat (nicht `[...]`, `[?]`);
    der Agent ändert die Abschrift nicht ([R3.4.1](R3-verification-and-citation.md#R3.4.1)). Hat die neue Lesung nur
    unleserliche Stellen gelesen, wird die Wahl nicht angeboten;
  - eine Aufgabe aus unsicheren Stellen entsteht nur auf einen Klick, nie von selbst, auch nicht bei **Immer
    anlegen**. Stellen, die dann eine Aufgabe hält, werden bei späteren Lesungen nicht erneut angeboten.
- **Prüft der Code:**
  - nur der Mensch entscheidet: in der App oder an seinem Terminal. `strom document read --source` am Terminal des
    Menschen fragt sofort (**Jetzt mit dem Agenten durchgehen**, **Als Aufgabe in die Warteschlange stellen**, **Die
    Lesung nur aufbewahren**, bei einer bestätigten Abschrift **Zur Prüfung vormerken**); ohne Wahl entscheidet es
    nichts, und später entscheidet `strom source reading S…`. Der Agent darf nicht entscheiden: er sagt dem Menschen,
    was wartet;
  - unsichere Stellen übergibt nur der Mensch: `strom source reading S… --take queue --unsure` (bei einer bestätigten
    Abschrift `--take review --unsure`); sonst geht `--unsure` nicht. Eine Lesung mit einer sicheren inhaltlichen
    Änderung zu entscheiden wird mit `--unsure` abgelehnt: Sie wird ohne es entschieden, und die unsicheren Stellen
    gehen mit. `strom source show S…` sagt, wenn sich die Stellen übergeben lassen;
  - die Aufgabe nennt, wer gelesen hat (Agent · Modell · Gründlichkeit jedes Lesers), dass zwei Leser desselben Modells
    ein schwächerer Beleg sind und dass die neue Lesung nur ein Anhaltspunkt ist
    ([R3.4.1](R3-verification-and-citation.md#R3.4.1)). Inhaltliche Änderungen stehen im Grund der Aufgabe zuerst;
  - eine App älter als 3.25.0 hat keine Wahl: bei einer nicht bestätigten Abschrift entsteht sofort eine Aufgabe für
    den Agenten, bei einer bestätigten ein vorgeschlagener Wortlaut für den Menschen.
- **Zustand bei der Quelle** (Quellenbetrachter): **Neuere Lesung vom … weicht ab (N inhaltliche Änderungen), nicht
  geprüft.**, **… gespeichert, keine Aufgabe angelegt.**, **…: Aufgabe T… für den Agenten (in der Warteschlange).**,
  **…: Aufgabe T… zur Prüfung.**, **…: nur Kleinigkeiten weichen ab.**, **…: Die Leser weichen an … ab, die Abschrift
  bleibt.** (bei einem Leser **…: Der Leser war sich an … nicht sicher, die Abschrift bleibt.**) Nach dem Anlegen der
  Aufgabe **Aufgabe T… öffnen** ([S4.5.3](S4-research-from-the-app.md#S4.5.3)).
- **Bedienung:** App: **Forschung → Weitere Aktionen → Forschung für diesen Stammbaum… → Dokumente lesen → Aufgabe aus
  einer neuen Lesung** (wird in die Forschung geschrieben und gilt auch für Lesungen aus dem Terminal). Terminal:
  `strom config set read.sourceTask ask|always|never --for-tree`, einmalig `strom document read --source S…
  --source-task …`, `strom source reading S… [--take now|queue|keep|review] [--unsure]`, `strom source show S…`.
- **Warum:** eine Aufgabe kostet Arbeit des Agenten, die das Abonnement verbraucht; eine Kleinigkeit oder eine
  Unsicherheit ändert die Abschrift nicht, und was schon geprüft wurde, soll nicht erneut geprüft werden. Unsichere
  Stellen lassen sich trotzdem prüfen: Die Leser können sie nicht klären, weil sie blind lesen, der Agent aber mit dem
  Zusammenhang der Forschung, wenn der Mensch darum bittet.
- **Gilt seit:** Forschung 1.29.0, App 3.25.0

<!-- zdroj: research:c2a690ea src/core/config.ts:310 read.sourceTask (ask|always|never, tree) · src/core/sourceread.ts:293-302, :438, :600-617 · src/commands/source-reading.ts · strom help source reading (--take now|queue|keep|review, priorita 3) · strom help document read --source-task · assets/lang/cs.json ui.reading.*, read.source.why/same · src/core/live.ts:124-138 taskChoice, POST sourceTask · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 2–4, Tabulka scénářů) · app:6bd8609e strings.ts treeResearch.readGroup/readTask/readTaskAsk/readTaskAlways/readTaskNever/rtOk, read.tAgent, tNow, tQueue, tNone, tSave, tPerson, tReview, tAppendNow, tAppendQueue, sUnchecked, sSaved, sTaskQueued, sTaskPerson, sMinor, sUnsure, sDecide, sGiveAgent, openTaskN · src/ui/read-task-setting-view.ts · dirigent:test ověření aplikace 6bd8609e · spec 059 K3.2, spec 065 K2.3 · nejistá místa na žádost: spec 059 P8 K8.1–K8.5 · research:4895d0f0 src/core/sourceread.ts unsureOffered, wordingOf, decideReading (unsure, read.decide.sure/nothing/noproposal), handOver priorita 3 · src/commands/source-reading.ts --unsure · assets/lang/cs.json read.source.unsure.* · CHANGELOG.cs.md 1.29.0 · app:docs/ZADANI_VYZKUM_cteni-vysledek.md „Odpověď výzkumu: nejistá místa na žádost“ · app:7327b758 src/ui/read-task-view.ts readTaskUnsureShown (B, D, jen počítač), unsureChoiceHtml · src/ui/read-source-state-view.ts · strings.ts read.close, tUnsureQueue, tUnsureQueueSub, tReview, tUnsureReviewSub, sGiveAgent, sReviewGive, sUnsure · dirigent:test/vysledek-1107-nejista-mista.md (i doověření N1) -->

<a id="R8.9"></a>
## R8.9 Wer liest: Überblick und Beispiel eines Eintrags

Einen Eintrag im Scan lesen mehrere Leser, jeder mit einer anderen Aufgabe und einem anderen Blick. Kein Leser
schreibt in den Stammbaum: was er liest, ist eine Grundlage für den Hauptagenten und für den Menschen.

| Wer liest | Was er sieht | Was er zurückgibt | Regel |
|---|---|---|---|
| Leser eines Buchs (`strom read`) | einen Stapel Ansichten und die ganze Frage; sonst nichts aus der Forschung | einen kurzen Bericht: Einträge zur Frage, bei Namen die Sicherheit in Prozent | [R8.3](#R8.3) |
| Hauptagent | den Ausschnitt des Eintrags in voller Auflösung und alles, was die Forschung weiß | eine Quelle mit Abschrift und Angaben aus sicher Gelesenem | [R8.5](#R8.5), [R8.6](#R8.6) |
| blinder zweiter Leser (`strom read --blind --crop`) | nur den Ausschnitt einer Zelle; nicht den erwarteten Wert, Namen, Ort und warum es darauf ankommt | seine Lesung dieser Zelle | [R3.5](R3-verification-and-citation.md#R3.5) |
| Leser eines Dokuments aus der App (**1 Leser** oder **2 Leser**) | die Seiten des Dokuments; der zweite Leser sieht die Lesung des ersten nicht | Transkription, Übersetzung, Erläuterung und erwähnte Personen | [R8.8](#R8.8), [R8.8.1](#R8.8.1) |
| Leser von **Erneut lesen…** (1 oder 2) | das Original des Eintrags und was die Forschung über den Eintrag weiß (Art, Sprache, Datum, wo der Eintrag steht); nicht die Abschrift und die Namen | eine neue Lesung, Stelle für Stelle mit der Abschrift verglichen | [R8.8.2](#R8.8.2) |

- **Prüft der Code:**
  - **blind** bedeutet: der Leser bekommt nicht, was von ihm erwartet wird. Der blinde zweite Leser bekommt nur den
    Ausschnitt, der zweite Leser eines Dokuments sieht die erste Lesung nicht, und die Leser von **Erneut lesen…**
    sehen weder die Abschrift noch die Namen;
  - Leser lesen mit dem Modell der Forschung für Schrift (`model.vision`), nie mit einem schwächeren. Beim Lesen eines
    Dokuments und bei **Erneut lesen…** hat jeder Leser sein Programm, Modell und seine Gründlichkeit, und das
    Ergebnis sagt bei der Lesung, wer gelesen hat ([R8.8.1](#R8.8.1));
  - wo zwei Leser voneinander abweichen, ist die Stelle unsicher, keine Berichtigung der Abschrift
    ([R8.8.2](#R8.8.2)).
- **Nur Methodik:** einen Eintrag, der zitiert wird, liest der Hauptagent selbst, aus dem Ausschnitt
  ([R8.5](#R8.5)); eine schwierige Zelle bekommt eine blinde zweite Lesung
  ([R3.5](R3-verification-and-citation.md#R3.5)).
- **Warum:** wer den erwarteten Wert kennt, neigt dazu, ihn zu „lesen“. Zwei unabhängige Leser, am besten zweier
  verschiedener Modelle, zeigen die Stellen, an denen sich die Schrift auf zweierlei Weise lesen lässt.
- **Gilt seit:** Forschung 1.0.0 (Leser eines Buchs, blinde zweite Lesung); Lesen eines Dokuments Forschung 1.18.0;
  Wahl der Leser und **Erneut lesen…** Forschung 1.29.0, App 3.25.0

**Beispiel eines Eintrags (erfunden).** Die Quelle ist ein Taufeintrag aus dem Jahr 1843. Die bisherige Abschrift hat
die Forschung geschrieben, und der Mensch hat sie nicht bestätigt: „Am 3. März 1843 getauft Jan, Sohn des Václav
Horák, Häuslers in Javorná Nr. 12, und der Marie geb. Vlková.“ Das Taufdatum von Jan Horák hat der Mensch in der App in
den Stammbaum eingetragen.

1. **Erneut lesen…** bei der Quelle, **2 Leser**: Leser 1 Claude Code, Leser 2 Codex, jeder mit seinem Modell und
   seiner Gründlichkeit. Beide bekommen nur das Original des Eintrags und das, was die Forschung über den Eintrag weiß
   (Art, Sprache, Datum, wo der Eintrag steht); Abschrift und Namen sehen sie nicht.
2. Die Leser lesen:
   - Leser 1: „… 5. März 1843 … in Javorná Nr. 17, und der Marie geborene Vlková.“
   - Leser 2: „… 5. März 1843 … in Javorná Nr. 12, und der Marie geborene Vlková.“
3. Vergleich mit der Abschrift:
   - der Tag **5.** statt **3.**: beide Leser lesen gleich und sicher → eine sichere inhaltliche Änderung;
   - die Hausnummer: Leser 1 liest **17**, Leser 2 **12** → die Leser weichen ab; die Stelle ist unsicher, keine
     Änderung der Abschrift;
   - „geb.“ gegen „geborene“: eine Abkürzung → eine Kleinigkeit.
4. In **Zu prüfen** stehen: **Inhaltliche Änderungen zu prüfen** (der Tag der Taufe), **Unsicher – Leser weichen ab**
   (die Hausnummer) und **Kleinigkeiten** („geb.“). Die Abschrift hat sich nicht geändert; die neue Lesung bleibt bei
   der Quelle.
5. Bei der Einstellung **Nachfragen** entscheidet der Mensch: **Aufgabe für den Agenten** → **In die Warteschlange des
   Agenten**. In die Aufgabe geht die sichere inhaltliche Änderung und mit ihr auch die unsichere Stelle; eine
   Kleinigkeit legt von selbst keine Aufgabe an ([R8.8.3](#R8.8.3)).
6. Der Agent sieht sich in der Aufgabe den Eintrag im Scan an, mit allem, was die Forschung über die Personen und Orte
   weiß:
   - der Tag ist im Scan sicher **5.**: er berichtigt die Abschrift und schreibt den Grund;
   - die Hausnummer ist im Scan nicht sicher: er lässt die Abschrift und schreibt zur Quelle eine Notiz, was er
     angesehen hat und warum die Stelle unsicher bleibt;
   - das Taufdatum im Stammbaum hat der Mensch eingetragen: der Agent ändert es nicht, er schlägt nur den 5. März 1843
     vor. Die App zeigt bei der Angabe **Die Forschung schlägt vor, eine von einem Menschen eingetragene Angabe zu
     ändern** und **Widerspruch ›**; es entscheidet der Mensch ([S6.3](S6-tree-from-another-program.md#S6.3)).

Eine Angabe aus dem Stammbaum eines anderen Programms dürfte der Agent nach dem zitierten Eintrag ändern; der Wert aus
dem Stammbaum bliebe bei der Angabe zum Zurücksetzen ([S6.3](S6-tree-from-another-program.md#S6.3)).

<!-- zdroj: research:v1.30.0 src/core/sourceread.ts placesOf (fresh, ordered: jistá věcná změna první, s ní ostatní neposouzená místa), decideReading, review · assets/lang/cs.json read.source.why, read.source.unsure.why · src/commands/read.ts --blind --crop · assets/method/verify.md · app:1c9b2392 strings.ts read.check „Co ověřit“, gMajor, gUnsure, gMinor, tAgent, tQueue, origin.proposeUser, origin.conflictOpen · spec 059 ukoly U6 (nové 8. 11.: oddíl se čtenáři a příkladem, jen text) -->
