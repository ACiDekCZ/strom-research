<a id="R11"></a>
# R11 Unterlagen vom Benutzer

Was die Forschung mit den Dateien, Texten und Stammbäumen tut, die ihr der Benutzer gibt: im Terminal oder aus der
Strom-App. Wie Material aus der App gesendet wird, beschreibt [A3.5](A3-evidence-in-the-app.md#A3.5); die Antwort
mit einer Datei auf eine wartende Aufgabe [R6.7.1](R6-awaiting-action.md#R6.7.1). Beschreibt die Forschung 1.27.0.
Bei den Regeln wird unterschieden, was **der Code prüft** und was nur eine **Regel der Methodik** ist.

<a id="R11.1"></a>
## R11.1 Jede Datei ist eine Unterlage mit einer Aufgabe

Jede Datei wird in der Forschung unverändert als Unterlage gespeichert und bekommt eine Aufgabe Unterlagen. Der Agent
erfasst daraus nur, was wirklich darin steht.

- **Prüft der Code:**
  - dieselbe Datei ein zweites Mal wird übersprungen (erkannt am Inhalt, nicht am Namen);
  - Dateien bis 20 MB liegen im Stammbaum und in seiner Historie, größere im gemeinsamen Medienspeicher;
  - ein Ordner mit mehr als 20 Bildern gilt als Scans eines Buches, nicht als Familienunterlagen (`--documents` sagt
    das Gegenteil);
  - ein Stammbaum hat eine eigene Aufgabe; die übrigen Dateien eines Ordners haben eine gemeinsame Aufgabe;
  - eine Aufgabe Unterlagen wartet nie außerhalb der Warteschlange ([R2.2.3](R2-lines-and-queue.md#R2.2.3)). Im
    Strom-Archiv wird sie zurückgestellt ([R7.8](R7-when-the-agent-works.md#R7.8)).
- **Nur Methodik:** Namen und Orte werden so erfasst, wie sie geschrieben sind; vereinheitlicht werden nur Daten. Die
  Aufgabe wird mit dem geschlossen, was aus der Unterlage hervorging, und mit weiteren Aufgaben: wo nach Einträgen zu
  suchen ist, die die Hinweise belegen.
- **Warum:**
  - 20 Bilder: Scans einer Matrik gehören nicht als Hunderte Aufgaben Unterlagen in die Historie des Stammbaums.
    Familienunterlagen eines Ordners sind meist einige bis einige Dutzend Dateien; mehr als 20 Bilder sind meist
    Scans eines Buches und werden als Buch erfasst;
  - 20 MB: die Historie des Stammbaums wird nie umgeschrieben und geht mit dem Stammbaum in Sicherungen und
    Übertragungen mit. Große Dateien (Video, unkomprimierte Scans) würden sie dauerhaft vergrößern, deshalb liegen
    sie im gemeinsamen Medienspeicher.
- **Bedienung:** Terminal: `strom intake <soubory nebo složky>`, `strom intake --text "…"` (was der Benutzer sagt),
  `strom input list`, `strom input show I…`. App: **Material senden…**, **Materialien hinzufügen…**
  ([A3.5](A3-evidence-in-the-app.md#A3.5)).
- **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:src/commands/intake.ts intake (description, BOOK_OF_SCANS=20, sha256 known, intakeTask) · research:src/core/media.ts MAX_IN_TREE=20 MB · research 1.0.0 = commit 48698860 · research:assets/method/intake.md kroky 1, 4, 6, 7 -->

<a id="R11.2"></a>
## R11.2 Eine Urkunde ist eine Quelle, der Rest ist ein Hinweis

Aus einer Unterlage kann eine Quelle werden, die Angaben belegt, oder nur ein Hinweis, der sagt, wo zu suchen ist. Es
entscheidet, was für ein Dokument es ist, nicht wer es gesendet hat.

- **Nur Methodik:**
  - eine amtliche oder kirchliche Urkunde (Geburts-, Heirats-, Sterbeurkunde, Auszug aus dem Kirchenbuch,
    Militärpapiere) ist eine Quelle (`--form original`; `--information primary`, wenn sie zur Zeit des Ereignisses
    geschrieben wurde);
  - Foto, Brief, Stammbaum und Erinnerung sind das Werk eines Autors oder eine abgeleitete Quelle: was aus ihnen
    stammt, bleibt **Hinweis**;
  - was der Benutzer sagt, ist eine Erinnerung der Familie (`--kind family-memory --form authored --information
    secondary`);
  - mehrere Angaben aus einer Unterlage werden in einem Stapel erfasst (`strom batch`): alles oder nichts.
- **Prüft der Code:** eine Angabe nur aus einer Erinnerung, einem Stammbaum oder einem Werk eines Autors ist nie
  Wahrscheinlich oder Belegt ([R3.2](R3-verification-and-citation.md#R3.2)).
- **Bedienung:** Terminal: `strom source add "…" --input I… --form … --information …`.
- **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:assets/method/intake.md krok 2 · research:src/core (weak sources: family-tree, family-memory, authored) -->

<a id="R11.3"></a>
## R11.3 Ein übernommener Stammbaum

Ein Stammbaum (GEDCOM oder eine Datei der Strom-App) sind die Schlüsse eines anderen, kein Eintrag. Die Forschung
übernimmt ihn ganz, aber nur als Hinweise.

- **Prüft der Code:**
  - der Stammbaum wird gleich bei der Übernahme eingelesen: jede Person und jede Angabe als **Hinweis** mit der
    Zitation einer Quelle der Art Stammbaum (`--kind family-tree`, `--form authored`). Jede Person weiß, woher sie
    kam;
  - Personen des Stammbaums dieser Forschung, die aus einer Datei der Strom-App zurückkommen, werden nach ihrer Nummer
    in der Forschung abgeglichen und nicht ein zweites Mal angelegt. Nummern einer anderen Forschung werden nie
    abgeglichen;
  - `--no-import` speichert den Stammbaum nur und liest ihn nicht ein.
- **Nur Methodik:**
  - Duplikate und unmögliche Daten werden geprüft, aber nicht aus dem Gedächtnis „berichtigt“; sie sind Hinweise;
  - eine Person des Stammbaums, die in der Forschung schon erforscht ist, wird **in** die erforschte Person
    zusammengeführt, zuerst ihre Eltern ([R10.2](R10-people-and-hypotheses.md#R10.2)). Die erforschte Person behält
    ihre Belege;
  - worin der Stammbaum abweicht, bleibt ein Hinweis oder wird ein Widerspruch; nie eine Angabe.
- **Bedienung:** Terminal: `strom intake rodokmen.ged`. Das Einlesen eines Stammbaums in die App beschreibt
  [A2](A2-loading-a-family-tree.md).
- **Gilt seit:** Forschung 1.0.0
- **Ab Forschung 1.30.0:**
  - jede Angabe hat eine Herkunft (aus dem Stammbaum, vom Menschen, aus der Forschung). Eine Angabe aus dem Stammbaum
    ändert der Agent nur mit einem zitierten Eintrag, sonst schlägt er vor; bei einer Angabe des Menschen schlägt er
    nur vor. Der Wert aus dem Stammbaum bleibt gespeichert, und zurücksetzen darf ihn nur der Mensch
    (`strom event revert`, `strom person revert`) ([S6.3](S6-tree-from-another-program.md#S6.3)). Ein Wert aus einer
    Datei der App Strom, den seit der Übernahme niemand geändert hat, stammt aus dem eigenen Stammbaum des Menschen:
    geschützt wie eine Angabe des Menschen, gilt aber nicht als vom Menschen bestätigt;
  - Programm-IDs (`_UID`, `EXID`, `_FSFTID` …) bleiben erhalten: derselbe Stammbaum, erneut übernommen, fügt niemanden
    zweimal hinzu; eine nur möglicherweise identische Person wird nicht verbunden, und das Ergebnis nennt sie
    (`candidates`); was nicht übernommen wurde, zählt das Ergebnis (`notTaken`)
    ([S6.8](S6-tree-from-another-program.md#S6.8));
  - eine Datei in Windows-1250 oder Windows-1252 („ANSI“) wird mit den richtigen Buchstaben gelesen;
  - die Quelle des Stammbaums hat keine Seite (`PAGE`): jede Angabe nennt ihre Zeile aus dem Stammbaum;
  - eine früher angelegte Forschung wird nach der Aktualisierung einmal gekennzeichnet (`strom fixes undo origins`
    nimmt das zurück).
- **Ab Forschung 1.32.0:**
  - ein Stammbaum aus der Strom-App ergibt aus einer JSON-Datei und aus GEDCOM dasselbe. Übernommen werden auch ein
    gemeinsames Ereignis mehrerer Personen mit der Rolle jeder Person ([A10.1](A10-shared-events.md#A10.1)), die
    eigenen Ereignisse **Patenschaft** und **Trauzeuge**, benannt in der Sprache der Forschung, mit Verweis auf die
    Taufe oder Heirat ([A10.5.1](A10-shared-events.md#A10.5.1)), Paten, Zeugen, Amtspersonen und die Hebamme bei
    Ereignissen der Person (mit einer Person verknüpft und nur namentlich), Trauzeugen und weitere Ereignisse des
    Paares mit Beteiligten und Notiz. Die Forschung hält sie bei jeder Angabe und gibt sie der App zurück, wie sie
    kamen;
  - aus einer JSON-Datei werden auch Todesursache und Alter beim Tod übernommen, die Adresse von Geburt und Tod,
    Adresse und Alter bei der Heirat, das Verhältnis des Kindes zu jedem Elternteil, Scheidung und Trennung mit
    Datum, die Notiz des Paares, das Alter einer Person bei einer gemeinsamen Volkszählung, eine Familie nur eines
    Elternteils und der Ehename. Platzhalterpersonen („?“) werden ausgelassen;
  - die Notiz eines Ereignisses wird ganz übernommen. Die Notiz einer Person und Familie aus dem Stammbaum des
    Menschen wird nicht auf 500 Zeichen gekürzt; die Grenze von 500 Zeichen gilt für Notizen, die die Forschung und
    der Agent schreiben;
  - die `ROLE` eines Beteiligten nach GEDCOM 7 wird auch in der Datei eines anderen Programms gelesen;
  - eine Hebamme geht in die App als **Anwesend** mit der Notiz „Hebamme“.

<!-- zdroj: research:src/core/import.ts hlavička ("as LEADS", oursByRefn), source kind family-tree form authored :113-117, status lead :294 · research:src/commands/intake.ts --no-import · research:assets/method/intake.md krok 5 · research:94d75934 src/core/import.ts (soubor aplikace Strom → origin user + tree), src/core/model.ts ValueOrigin.tree · 1.32.0: research:ac489205 src/core/import.ts importStromJson (godparent/weddingWitness → EVEN v jazyce výzkumu s roleAt, participants, partnerships[].participants, shareId/shareRole), src/core/roles.ts, src/gedcom/export.ts (porodní bába RELA Present + poznámka), celá poznámka události · research:f8eb2032 Note.whole, makeNote 500, factDetails, partnersAges, childRelation · research:01125661 appNobody, appMarriedName, appUnionFacts, appLooseFamilies · research:CHANGELOG 1.32.0 „Events shared in the Strom app“ · src/core/live.ts BRIDGE_FEATURES event.share · dirigent:prace/1113-vyzkum-085-json, 1113-vyzkum-json-intake-uplny, 1113-vyzkum-json-intake-drobnosti Výsledek -->

<a id="R11.4"></a>
## R11.4 Ein Stapel aus der App

Einen Ordner, eine ZIP-Datei oder eine Schachtel Dokumente, aus der App gesendet, nimmt die Forschung als einen
Stapel an. Der Agent sortiert ihn dann nach Aufgaben.

- **Prüft der Code:**
  - ein Stapel wird geschlossen, wenn die App meldet, dass er vollständig ist, oder einen Tag nach der letzten Datei
    (ein Stapel vom Telefon eine Stunde nach dem letzten Foto, [S5.4](S5-phone.md#S5.4));
  - dann werden daraus Aufgaben Unterlagen zu je etwa 25 Dateien, nach den Ordnern, in denen die Dateien kamen. Im
    Strom-Archiv warten die Aufgaben zurückgestellt;
  - die Dateien eines Stapels werden als Originale im gemeinsamen Medienspeicher gespeichert, nicht in der Historie
    des Stammbaums. Was der Agent daraus nicht erfasst, bleibt privat;
  - eine als nicht zugehörig markierte Datei (`--as unrelated`) braucht einen Grund. Sie wird übersprungen, und nichts
    daraus wird erfasst.
- **Nur Methodik:**
  - der Agent sieht zuerst günstig alle Dateien der Aufgabe durch (Vorschauen im Raster) und ordnet jede gleich ein:
    Eintrag (Quelle), Dokument, Foto, nicht zugehörig, und wem sie gehört. Gründlich liest er nur, was zu den
    Personen der Forschung gehört;
  - über eine lebende Person wird nichts erfasst; die Datei wird nur eingeordnet;
  - die Scans eines Buches (viele nummerierte Bilder) werden nicht Datei für Datei gelesen: sie werden als Buch
    erfasst, und die Einträge werden daraus gelesen wie aus jedem Buch ([R8](R8-reading-scans.md));
  - die Aufgabe wird geschlossen, wenn jede ihrer Dateien eingeordnet ist; ein weiterer Teil des Stapels ist eine
    eigene Aufgabe.
- **Warum:**
  - einen Tag nach der letzten Datei: die App sendet die Dateien einzeln. Ein Stapel, von dem niemand gesagt hat, dass
    er vollständig ist, wird mit dem geschlossen, was kam, damit nichts länger wartet; ein Tag ohne weitere Datei
    heißt, dass das Senden vorbei ist. Die Seite auf dem Telefon wird leicht geschlossen, ohne den Stapel zu
    übergeben, deshalb genügt dort eine Stunde;
  - 25 Dateien: eine Aufgabe Unterlagen liest eine Sitzung des Agenten, und etwa 25 Dateien passen hinein;
  - der Pfad einer Datei im Stapel sagt viel (`Babička/Dopisy/1946.jpg`); was nicht zur Familie gehört, soll nicht in
    den Stammbaum gelangen (Methodik).
- **Bedienung:** Terminal: `strom input batch` (Stapel und wie viel eingeordnet ist), `strom input sort I… --as
  source|document|photo|unrelated --person P…`. App: **Materialien hinzufügen…** im Menü der Forschung.
- **Gilt seit:** Forschung 1.12.0; Stapel vom Telefon 1.18.0

<!-- zdroj: research:src/core/batches.ts hlavička, BATCH_TASK_FILES=25 (od v1.12.0), BATCH_IDLE_MS, PHONE_BATCH_IDLE_MS (od v1.18.0) · research:src/commands/intake.ts input batch done (--idle), input sort (unrelated --reason) · research:assets/method/intake.md "A batch from the Strom app" -->
