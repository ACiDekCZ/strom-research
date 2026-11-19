<a id="R11"></a>
# R11 Unterlagen vom Benutzer

Was die Forschung mit den Dateien, Texten und Stammbäumen tut, die ihr der Benutzer gibt: im Terminal oder aus der
Strom-App. Wie Material aus der App gesendet wird, beschreibt [A3.5](A3-evidence-in-the-app.md#A3.5); die Antwort
mit einer Datei auf eine wartende Aufgabe [R6.7.1](R6-awaiting-action.md#R6.7.1). Beschreibt die Forschung 1.27.0;
Änderungen aus einer neueren Version tragen deren Nummer.
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
- **Bedienung:** Terminal: `strom intake <Dateien oder Ordner>`, `strom intake --text "…"` (was der Benutzer sagt),
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
    eigenen Ereignisse **Patenschaft** und **Trauzeuge**, benannt in der Sprache der Forschung (aus einer GEDCOM-Datei ab Forschung 1.34.0, vorher nach dem TYPE der Datei in der Sprache, in der die App lief), mit Verweis auf die
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

<!-- zdroj: research:src/core/import.ts hlavička ("as LEADS", oursByRefn), source kind family-tree form authored :113-117, status lead :294 · research:src/commands/intake.ts --no-import · research:assets/method/intake.md krok 5 · research:94d75934 src/core/import.ts (soubor aplikace Strom → origin user + tree), src/core/model.ts ValueOrigin.tree · 1.32.0: research:ac489205 src/core/import.ts importStromJson (godparent/weddingWitness → EVEN v jazyce výzkumu s roleAt, participants, partnerships[].participants, shareId/shareRole), src/core/roles.ts, src/gedcom/export.ts (porodní bába RELA Present + poznámka), celá poznámka události · research:f8eb2032 Note.whole, makeNote 500, factDetails, partnersAges, childRelation · research:01125661 appNobody, appMarriedName, appUnionFacts, appLooseFamilies · research:CHANGELOG 1.32.0 „Events shared in the Strom app“ · src/core/live.ts BRIDGE_FEATURES event.share · dirigent:prace/1113-vyzkum-085-json, 1113-vyzkum-json-intake-uplny, 1113-vyzkum-json-intake-drobnosti Výsledek · 1.34.0: research:aa0d53d5 src/core/import.ts gedRoleEventLabel (B6) -->

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

<a id="R11.5"></a>
## R11.5 Material der Forschung und Dateien des Stammbaums aus der App

Jede Datei, die die Forschung hält, ist ein Materialeintrag (`I…`): eine zu einer Person gesendete Datei, eine Datei
eines Stapels, eine Datei aus dem Terminal und eine Datei des Stammbaums aus der Strom-App. Der Eintrag hat Titel,
Art und Datum, die Personen, zu denen er gehört, und bei einer Datei des Stammbaums auch ihre Stellen im Stammbaum
der App.

- Die Art ist `photo`, `document`, `record` oder `other` (in der App **Foto**, **Dokument**, **Urkunde**,
  **Sonstiges**). Die Forschung merkt sich, wer den Titel gab: ein Mensch (App, Terminal) oder die Forschung.
- Eine ausgeblendete Datei (`unrelated`, `duplicate`, ohne Grund) bleibt mit ihrem Original in der Forschung und
  lässt sich wieder zeigen.
- **Prüft der Code:**
  - Ausblenden, Entfernen aus dem Stammbaum oder Zurücknehmen eines Schreibens löscht keine Datei: Original und
    Eintrag bleiben. Löschen kann nur `strom input delete` mit Zustimmung des Menschen ([R11.5.6](#R11.5.6));
  - eine Änderung von Titel, Art und Datum einer Datei außerhalb des Stammbaums schreibt die Forschung sofort. Bei
    einer Datei des Stammbaums erscheint die Änderung in der App mit dem nächsten Laden des Stammbaums;
  - die Forschung lehnt die ganze Änderung ab, wenn sie eine der Dateien nicht kennt oder einen Wert nicht lesen kann
    ([R11.5.2](#R11.5.2)).
- **Grenzen:** Einträge mit Stellen im Stammbaum sind im Stammbaumschema 3 (ab der Forschung 1.35.0). Der Übergang
  überschreibt nichts; ein älteres `strom` öffnet einen Stammbaum im Schema 3 nicht. Material in der App beschreibt
  [A3.5](A3-evidence-in-the-app.md#A3.5).
- **Bedienung:** Terminal: `strom input list`, `strom input show I…` (wo die Datei ist und was aus ihr entstand),
  `strom input edit`, `strom input assign`, `strom input hide`, `strom input unskip`, `strom input delete`,
  `strom material`. App: das Fenster **Materialien**.
- **Gilt seit:** Forschung 1.35.0

<!-- zdroj: research:0cc2cfca src/commands/intake.ts input delete · research:2aeeb228 src/core/model.ts SCHEMA_VERSION 3, Input (origin, working, orient, titled, materialKind, families, links), MEDIA_ORIGINS, LINK_TYPES, MATERIAL_KINDS, LINK_RETRACTIONS, HIDE_REASONS · src/core/material.ts hideMaterial, unhideMaterial, editMaterial, MATERIAL_MOST_EDIT, MATERIAL_TITLE_MAX · research:c9a4b614 CHANGELOG.cs.md 1.35.0 · help input, material -->

<a id="R11.5.1"></a>
### R11.5.1 Dateien des Stammbaums aus der App

Die Forschung 1.35.0 hält auch die Porträts, Paarfotos und Anhänge des Stammbaums aus der Strom-App. Sie speichert
jede Datei einmal, nach ihrem Inhalt, und merkt sich ihre Stellen im Stammbaum: Anhang oder Porträt einer Person,
Anhang oder Foto eines Paares, Datei eines Ereignisses, Beleg einer Quelle.

- Eine Datei, deren Original früher kam (`PUT /media`), erkennt die Forschung am Fingerabdruck des Originals; sonst
  am Fingerabdruck der gesendeten Bytes. Die verkleinerte Kopie, die die App zeigt, speichert sie unverändert neben
  dem Original.
- Ein neues Porträt ersetzt das alte: das alte bleibt als ältere Version (die Stelle mit dem Grund `replaced`
  zurückgezogen).
- Ein Eintrag ist **im Stammbaum**, solange er mindestens eine Stelle hat, die nicht zurückgezogen ist.
- **Prüft der Code:**
  - ein Entfernen in der App schreibt die Forschung nur, wenn das Schreiben alle Dateien des Stammbaums trägt
    (`media=app`), und nur gegen das, was die App mit ihren Dateien bekommen hat. Was ein anderes Fenster hinzufügte,
    entfernt sie nicht;
  - eine entfernte Datei bleibt im Material, ausgeblendet mit dem Grund **Aus dem Stammbaum entfernt**. Wieder
    gezeigt, bekommt sie die Stellen zurück, die ihr das letzte Schreiben nahm;
  - `strom sync undo I…` stellt auch die Stellen wieder her, die das Schreiben entfernte;
  - an die App geht eine Datei nach ihrem Fingerabdruck zurück (`GET /tree.ged?images=ref&media=app`), nur Dateien
    mit einer Stelle im Stammbaum. Der Ausschnitt eines Porträts im ursprünglichen Foto geht nicht zurück, das
    Porträt schon ([S8.3](S8-where-the-data-are.md#S8.3)).
- **Grenzen:** eine Forschung, die die Dateien des Stammbaums nicht hält (bis 1.34), tut nichts davon; die App zählt
  Fotos und Anhänge dann als nur im Browser ([S8.4](S8-where-the-data-are.md#S8.4)).
- **Bedienung:** App: Schreiben des Stammbaums ([S2](S2-edits-from-the-app.md)), **Aus dem Stammbaum entfernen…** und
  **Wiederherstellen** im Fenster **Materialien**; Terminal: `strom sync undo I…`, `strom input unskip I…`.
- **Gilt seit:** Forschung 1.35.0

<!-- zdroj: research:2aeeb228 · src/core/appmedia.ts (hlavička: soubor jednou podle otisku, keepBytes, MediaReader) · src/core/treemedia.ts (návrat GET /tree.ged?images=ref&media=app, POST /images, GET /image/<sha>) · research:91ab6230 (odebrání jen se všemi soubory, proti základu media=app, sync undo, restoreTakenOff) · research:d5e99375, 815bc90d, 7d7628eb · src/core/material.ts unhideMaterial (spec 102 M3) · dirigent:spec/108-kde-se-co-uklada K2.3 (photoSource se nevrací) -->

<a id="R11.5.2"></a>
### R11.5.2 Titel, Art, Datum und Personen aus dem Terminal

Titel, Art und Datum einer Datei setzt `strom input edit`, die Personen `strom input assign`. Beides gilt für Material
der Forschung und für Dateien des Stammbaums aus der App; die App bekommt sie mit der nächsten Stammbaumdatei.

- `strom input edit I… --title … --kind photo|document|record|other --date …`: höchstens 500 Dateien, ein Titel
  höchstens 200 Zeichen, ein Datum wie in GEDCOM (`1932`, `ABT 1930`, `12 MAY 1932`); `""` entfernt den Wert. Die
  Antwort nennt, was jede Datei vorher hatte (`was`): dieselbe Änderung mit diesen Werten nimmt sie zurück. Mehr
  Dateien mit `--files-from`.
- `strom input assign` fügt Personen von Dateien oder ganzen Stapeln (`--batch`) hinzu (`--add P…`) oder entfernt
  sie (`--remove P…`). Bei einer Datei des Stammbaums ist eine hinzugefügte Person eine neue Stelle: in der App ein
  Anhang der Person.
- `strom input hide I… --why unrelated|duplicate` blendet eine Datei aus; `strom input unskip I…` zeigt sie wieder.
- **Prüft der Code:** alles oder nichts: eine unbekannte Datei, ein zu langer Titel, eine unlesbare Art oder ein
  unlesbares Datum, und nichts wird geschrieben. `--dry-run` zeigt nur, was sich ändern würde.
- **Bedienung:** Terminal, siehe oben. Dasselbe tut das Fenster **Materialien** in der App über die Brücke.
- **Gilt seit:** Forschung 1.20.0 (`strom input assign`, `hide`, `unskip`); 1.35.0: `strom input edit`, Stellen der
  Dateien des Stammbaums

<!-- zdroj: research:a7df632d src/commands/intake.ts input edit, assign, hide, unskip · src/core/material.ts checkEdit, editMaterial, MATERIAL_MOST_EDIT=500, MATERIAL_TITLE_MAX=200, assignMaterial (místo u souboru stromu, spec 102 M4) · research:cc709045 příklady v helpu · help input edit, input assign, input hide -->

<a id="R11.5.3"></a>
### R11.5.3 Material sortieren: `strom material sort`

`strom material sort` lässt die Leser der Forschung die Dateien des Materials lesen. Zu jeder Datei schlagen sie
Titel, Datum, Art und Verknüpfungen zu Personen, Paaren, deren Ereignissen und Quellen des Stammbaums vor, mit
Begründung und Sicherheit. In die Forschung wird nichts geschrieben.

- Der Vorschlag ist neben der Forschung gespeichert (`strom material show <id>`). Was ein Mensch davon annimmt, wird
  als seines geschrieben: in der App oder mit `strom input edit`.
- `--text` ist, was ein Mensch über die Dateien weiß; die Leser richten sich danach, wo die Dateien nichts anderes
  sagen.
- `--queue` stellt das Sortieren nur in die Warteschlange; `strom material cancel <id>` hält es an.
- **Prüft der Code:**
  - höchstens 50 Dateien und 2000 Zeichen Text; aus einem PDF die ersten 10 Seiten. Eine Datei, die kein Leser
    öffnet, beurteilt er nach Name, Pfad und Notizen;
  - er schlägt nie einen Titel, eine Art oder ein Datum vor, die ein Mensch gab, eine Verknüpfung, die ein Mensch gab
    oder entfernte, noch eine ID, die die Forschung nicht hat. Weder ein Porträt noch ein Paarfoto schlägt er vor;
  - bezahlte Lesungen beginnen erst nach der Zustimmung eines Menschen: im eigenen Terminal (Enter ist nein) oder in
    einem Systemfenster. Ist niemand zu fragen, endet der Befehl mit Code 4. Der Agent antwortet nie für den Menschen;
  - ein Sortieren aus der App startet die Brücke nur mit ihrer eigenen Signatur, und die gilt einmal. Ein Eintrag,
    der sich nur als Sortieren aus der App ausgibt, startet nie;
  - in der Warteschlange warten höchstens 3 Sortierungen.
- **Ab Forschung 1.35.0:**
  - eine Textdatei (.txt, .md, .markdown, .text oder der Typ text/plain oder markdown) liest der Leser als Text und
    beurteilt sie nach dem, was sie sagt: höchstens die ersten 20 000 Zeichen. Bei einer längeren weiß der Leser,
    dass er nur den Anfang bekam und wie groß die Datei ist. Text in UTF-8 oder, mit Byte-Order-Mark, in UTF-16;
    sonst wird er als windows-1252 gelesen;
  - während des Sortierens sagt `strom material show`, wie viele Dateien die Leser schon beurteilt haben („N of M
    files done“); die App zeigt daraus „k von n“;
  - bei einem fertigen Sortieren hat jede Datei ohne Vorschlag einen Grund: der Leser sagte nichts zu ihr, die Datei
    hat schon alles Vorgeschlagene, der Vorschlag ließ sich nicht verwenden, der Agent hat die Datei ausgelassen,
    oder die Datei ließ sich nicht lesen (mit dem Ergebnis des Lesers). Was der Leser über die Datei schrieb, steht
    beim Grund.
  - eine Datei, die offensichtlich nicht die Familie betrifft (ein Bildschirmfoto, eine Quittung, eine versehentlich
    geschickte Datei), markiert der Leser mit `unrelated: yes`, mit Begründung und Sicherheit. Die Anweisung an den
    Leser: nur eine Datei offensichtlich außerhalb der Familie, nie eine Datei, die er nur nicht zuordnen kann. Die
    Forschung schlägt für eine solche Datei keinen Titel, kein Datum, keine Art und keine Verknüpfung vor (was der
    Leser trotzdem schrieb, verwirft sie). `strom material show` schreibt bei ihr „unrelated (not of the family)“.
    Die Forschung blendet die Datei nie von selbst aus und löscht sie nie; ausblenden kann sie nur ein Mensch: in der
    App ([A3.5.9](A3-evidence-in-the-app.md#A3.5.9)), im Terminal `strom input hide I… --why unrelated`;
  - der Leser darf auch sagen, welche der gesendeten Dateien die Rückseite eines anderen Fotos oder einer anderen
    Seite ist (Verknüpfung `back` auf die `I…` einer Datei, die derselbe Leser bekam: eine Rückseite zu einer
    Vorderseite, nie die Rückseite einer Rückseite und nie eine Textdatei) und welches Bild das Porträt einer Person
    ist (Verknüpfung `portrait` auf eine `P…`; nur ein Bild, kein Porträt, das der Mensch entfernt hat, und keine
    Datei, die schon das Porträt ist);
  - mehr als 50 Dateien lässt nur die App sortieren, als Lauf in Stapeln ([R11.5.5](#R11.5.5)).
- **Grenzen:** nur eine Forschung mit Agent: das Strom-Archiv und eine Forschung, die auf einen Agenten wartet,
  sortieren kein Material.
- **Bedienung:** Terminal: `strom material sort I… [--text …] [--queue]`, `strom material show`, `strom material
  cancel`; App: **Mit dem Agenten sortieren…** ([A3.5.8](A3-evidence-in-the-app.md#A3.5.8)).
- **Gilt seit:** Forschung 1.35.0

<!-- zdroj: research:acb5d1ce src/core/sort.ts SORT_MOST_FILES=50, SORT_TEXT_MAX=2000, SORT_QUEUE_MAX=3, SORT_PDF_PAGES=10, SORT_FILES_PER_READING=10, typy vazeb person/family/event/source · research:0cc2cfca src/core/sort.ts SORT_LINK_TYPES back, portrait · research:d667304d (souhlas člověka, exit 4) · research:2978645b, 19e525e5, 5b76fb43 (podpis mostu APP_SORT_FROM, platí jednou) · src/commands/material.ts · help material sort · research:ae866bb7 src/core/sort.ts SORT_TEXT_FILE_MAX=20_000, SORT_TEXT_TYPES, isTextFile, textOfFile (UTF-8 / UTF-16 BOM, jinak windows-1252; cut), řádek „read as text (only its first … characters: the file is … KB)“, unproposedOf (nothing-said, nothing-new, dropped, left-out, reader-failed + outcome; said) · src/commands/material.ts filesDone (+ group.length po čtenáři), show „N of M files done“, „no proposal: why (outcome)“ · research:f36b3941 (ve vydání 1.35.0) src/core/sort.ts pokyn čtenáři „unrelated: yes“ (jen soubor zjevně mimo rodinu, nikdy jen nezařazený), YES, keptProposals (unrelated: jen why a sure, ostatní dropped „unrelated“) · src/commands/material.ts show „· unrelated (not of the family)“ · src/core/live.ts GET /material/sort/<id> unrelated?: true („the person hides it, never strom“) · CHANGELOG.md 1.35.0 -->

<a id="R11.5.4"></a>
### R11.5.4 Material über die Brücke

Das Fenster **Materialien** in der App liest und ändert Material über die Brücke der Forschung. Jede Änderung ist
derselbe Befehl wie im Terminal, mit denselben Grenzen.

| Brücke | Was sie tut | Befehl |
|---|---|---|
| `GET /material` | Dateien mit Titel, Art, Datum, Personen, bei Dateien des Stammbaums Stellen und bei jeder die Verwendung; die Datei einer Quelle (`uses.of`), was der Agent nicht zugeordnet hat (`left`), gleicher Inhalt (`sameAs`) | |
| `GET /material/<I…>/uses` | Ausschnitte, Quellen und Aufgaben, die die Datei verwenden | |
| `POST /material/assign` | Personen von Dateien | `strom input assign` |
| `POST /material/hide` | ausblenden und wieder zeigen (bei einer entfernten Datei des Stammbaums mit Stellen) | `strom input hide`, `unskip` |
| `POST /material/edit` | Titel, Art und Datum, 1–500 Dateien | `strom input edit` |
| `POST /material/sort` | Sortieren von 1–50 Dateien; Fortschritt `GET /material/sort/<id>`, Abbrechen `…/cancel` | `strom material sort` |
| `POST /material/sort` (51–1 500) | ein Lauf in Stapeln ([R11.5.5](#R11.5.5)); Fortschritt `GET /material/sort/<run-…>`, Abbrechen `…/<run-…>/cancel` | |
| `POST /material/delete` | 1–500 Dateien endgültig löschen: zuerst `dryRun` (Liste und Bestätigung), dann mit der Bestätigung | `strom input delete` |

- Die Forschung meldet, was sie kann, in `/status.features`: `media.app`, `material.links`, `material.edit`,
  `material.uses` und `material.sort` (nur wo ein Agent ist). Ohne sie verhält sich die App wie mit einer älteren
  Forschung.
- **Ab Forschung 1.35.0:** auch `material.sourceOf`, `material.left`, `material.sameAs`, `material.sortRun` und
  `material.delete`. Das Löschen lehnt eine geänderte Liste ab (`material.delete-changed` mit der neuen Liste), eine
  fehlende oder alte Bestätigung (`material.body`) und ein Schreiben, das nicht aus der App kam.
- **Prüft der Code:** eine Änderung ist ganz oder gar nicht; eine beschäftigte Forschung antwortet, dass sie nichts
  geändert hat. Sortieren lehnt sie ab ohne Agent, mit aufgebrauchtem Leselimit, mit voller Warteschlange und wenn
  der Agent gerade nicht arbeiten kann.
- **Bedienung:** App: das Fenster **Materialien**, bei laufender Brücke
  ([S1.1](S1-connecting-app-and-research.md#S1.1)).
- **Gilt seit:** Forschung 1.35.0

<!-- zdroj: research:0cc2cfca src/core/live.ts (GET /material uses.of, left {at, sort, why, said}, sameAs; POST /material/sort run 51–1500, GET/POST /material/sort/<run-…>[/cancel]; POST /material/delete dryRun → impacts + confirm, chyby material.delete-changed, material.body, material.file, material.readonly, material.busy, app.only; BRIDGE_FEATURES material.sourceOf, left, sameAs, sortRun, delete) · research:src/core/live.ts:134-160 (GET /material, /material/<I…>/uses, POST /material/assign|hide|edit|sort, chyby material.body|date|file|readonly|busy) · src/core/live-sort.ts (sort.none, sort.limit, sort.queue, sort.not-ready) · research:a7df632d, 87376d11, 7754968e -->

<a id="R11.5.5"></a>
### R11.5.5 Ein Lauf des Sortierens aus der App

Die App kann 51 bis 1 500 Dateien als einen Lauf (`run-…`) sortieren lassen. Die Forschung teilt ihn in Stapel zu 50
und sortiert sie nacheinander, solange die Brücke läuft. Der Vorschlag jedes fertigen Stapels ist sofort da.

- Jeder Stapel ist ein eigenes Sortieren mit eigenem Vorschlag; er trägt, zu welchem Lauf er gehört und der
  wievielte er ist.
- In der Warteschlange (höchstens 3 Sortierungen) zählt ein Lauf als eines.
- **Lesungen der App:** der erste Stapel wird gezählt, wenn die Forschung den Lauf annimmt; die weiteren, wenn sie
  starten. Lässt das Leselimit der App einen Stapel nicht zu, wartet der Lauf und versucht es von selbst erneut
  (`material.sort-waiting`).
- Ein Stapel, der scheitert, hält die weiteren Stapel nicht an. `strom material show run-…` sagt den Stand des
  Laufs, wie viele Dateien fertig sind, und seine Stapel. `strom material cancel run-…` hält den Stapel in Arbeit
  an, bricht die wartenden ab und behält die fertigen mit ihren Vorschlägen.
- **Prüft der Code:** einen Lauf startet nur die App über die Brücke; ein Agent startet nie einen Lauf, und
  `strom material sort` aus dem Terminal nimmt höchstens 50 Dateien ([R11.5.3](#R11.5.3)).
- **Grenzen:** nur eine Forschung mit Agent und mit `material.sortRun` ([R11.5.4](#R11.5.4)); eine ältere Forschung
  nimmt von der App einen Stapel.
- **Bedienung:** App: **Mit dem Agenten sortieren…** ([A3.5.12](A3-evidence-in-the-app.md#A3.5.12)); Terminal:
  `strom material show run-…`, `strom material cancel run-…`.
- **Gilt seit:** Forschung 1.35.0

<!-- zdroj: research:0cc2cfca src/core/sort.ts SORT_RUN_MOST_FILES=1500, SORT_QUEUE_MAX=3 (běh jako jedna položka), run/part/parts, první dávka započtená při přijetí, další při startu podle read.app, jinak čeká a zkusí znovu; selhaná dávka nezastaví další · src/core/live-sort.ts, src/core/live.ts POST /material/sort (51–1500 → 202 {state queued, run}), GET /material/sort/<run-…>, POST …/<run-…>/cancel · src/commands/material.ts show run-… („N of M files done“, dávky), cancel run-…, material.sort-waiting · CHANGELOG.md 1.35.0 -->

<a id="R11.5.6"></a>
### R11.5.6 Endgültig löschen: `strom input delete`

`strom input delete I…` löscht Dateien des Materials endgültig. Das darf nur ein Mensch: im Terminal mit seiner
Zustimmung oder in der App über **Endgültig löschen…** ([A3.5.16](A3-evidence-in-the-app.md#A3.5.16)).

- Bei jeder Datei wird ihr Eintrag zurückgenommen, mit ihren Stellen im Stammbaum der App. Eine Quelle, die aus ihr
  entstand, behält Text und Zitate, nur ohne die Verknüpfung zur Datei. Eine Aufgabe, die die Datei hält, lässt sie
  los; eine Aufgabe ohne weitere Dateien wird aufgegeben.
- Der Inhalt der Datei (Original, Arbeitskopie, Vorschauen) verschwindet nur, wenn keine andere Datei der Forschung
  und keine andere Forschung auf diesem Computer denselben Inhalt hat. Dann verschwinden auch Bilder von Quellen
  mit demselben Inhalt und ihre Ausschnitte; eine Quelle verliert das Bild, nie ihren Text.
- `--dry-run` sagt alles, Datei für Datei (`--json`: `impacts`). Viele Dateien: `--files-from <Datei>` (eine ID je
  Zeile, `-` ist die Standardeingabe).
- `strom input show I…` sagt bei einer gelöschten Datei, dass der Mensch sie endgültig gelöscht hat; `strom input
  list` zeigt sie nicht. Derselbe Inhalt, erneut gebracht, ist neues Material.
- **Prüft der Code:**
  - alles oder nichts: eine Datei, die die Forschung nicht hat, und es wird nichts gelöscht; höchstens 500 Dateien;
  - ohne `--dry-run` sagt der Mensch ja in seinem eigenen Terminal (Enter ist nein), sonst in einem Fenster des
    Systems; ist niemand zu fragen, endet der Befehl mit Code 4;
  - ein Agent führt ihn nie aus und bietet ihn nie an; mit der Bestätigung der App wird er abgelehnt
    (`material.agent`);
  - die Bestätigung der App gilt nur für die Liste, die der Mensch in der App sah, und höchstens 15 Minuten. Eine
    geänderte Liste (`material.delete-changed`) oder eine alte Bestätigung löscht nichts;
  - lässt sich eine andere Forschung auf diesem Computer nicht lesen (die eines neueren `strom`), bleibt der Inhalt
    gespeichert.
- **Grenzen:** in der App Strom lässt es sich nicht rückgängig machen; eine Datei bleibt nur in einer Sicherung
  (`strom backup`) oder einem Paket, das vorher entstand. Die Geschichte der Forschung behält den Eintrag.
- **Bedienung:** Terminal: `strom input delete I… [--dry-run] [--files-from …]`; App: **Endgültig löschen…** über
  die Brücke (`POST /material/delete`, [R11.5.4](#R11.5.4)).
- **Gilt seit:** Forschung 1.35.0

<!-- zdroj: research:0cc2cfca src/commands/intake.ts input delete (popis, --files-from, skrytý --confirm, isAgent → material.agent, checkDeleteConfirm → material.delete-changed, material.body, souhlas člověka, exit 4) · src/core/materialdelete.ts (hlavička: historie drží záznam, bajty jen v záloze nebo balíčku; DELETE_MOST_FILES=MATERIAL_MOST_EDIT=500, DELETE_CONFIRM_MS 15 min; nečitelný jiný výzkum → nic se nesmaže) · input show („deleted for good“), input list bez smazaných · CHANGELOG.md 1.35.0 -->
