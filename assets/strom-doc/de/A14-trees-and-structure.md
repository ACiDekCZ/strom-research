<a id="A14"></a>
# A14 Stammbäume verwalten und die Struktur ändern

Die Stammbäume in der App werden in einem Fenster verwaltet, **Stammbäume verwalten**. Was mit einem Stammbaum
geschehen soll (neuer Stammbaum aus einer Auswahl, Kopie, Aufteilen, Zusammenführen mit einem anderen Stammbaum,
Hinzufügen aus einer Datei), bietet ein einziger Eintrag, **Struktur ändern…**. Bei jeder Option steht, welcher
Stammbaum sich ändert. Zu jeder Forschung gehört nur ein Stammbaum; Kopien und neue Stammbäume sind ohne Forschung
([S1.10](S1-connecting-app-and-research.md#S1.10)). Das Kapitel beschreibt die Strom-App 3.32.0. Änderungen aus einer
neueren Version tragen deren Nummer.

<!-- zdroj: dirigent:spec/139-zmenit-strukturu-dialog · app:a9bc0b6b src/structure-options.ts, src/ui/structure-ui.ts · 518c9654, e9f50b62 src/ui/structure-select-ui.ts · 3110125c, fbd97361 src/ui/tree-management.ts, src/tree-row.ts · bcb2a0fa, 023879dd, f3c66503 · strings.ts structure.*, treeManager.* · dirigent:prace/1123-app-139-* -->

<a id="A14.1"></a>
## A14.1 Stammbäume verwalten

Stammbäume verwalten zeigt alle Stammbäume in der App, jeden in derselben Zeile mit denselben Angaben. Die Angaben der
Zeile kommen aus dem Register der Stammbäume; die Daten des Stammbaums werden dafür nicht gelesen.

- **Zeile eines Stammbaums:**
  - der Name und die Marken **Geöffnet**, **Gesperrt**, **Ausgeblendet**;
  - „N Personen · M Paare · Größe · bearbeitet …“. Ein Stammbaum, der einen Teil der Bilder mit einem anderen
    Stammbaum gemeinsam hat (Kopie, Zusammenführung), hat bei der Größe „· Bilder geteilt“. Der Hinweis beim
    Darüberfahren: „Einige Bilder teilt der Stammbaum mit einem anderen: Die Größe zählt sie mit, Platz belegen sie aber
    nur einmal.“ ([S8.7](S8-where-the-data-are.md#S8.7));
  - die Zeile der Herkunft, die erste, die zutrifft:

    | Stammbaum | Zeile |
    |---|---|
    | ein Stammbaum, der zu einer Forschung gehört | „Forschung {Nummer}“ und der Schalter **Forschung an** ([S1.9](S1-connecting-app-and-research.md#S1.9)) |
    | eine Kopie eines Stammbaums | „Kopie des Stammbaums „{Name}“ · ohne Forschung“ und der ausgeschaltete Schalter ([S1.10](S1-connecting-app-and-research.md#S1.10)) |
    | ein neuer Stammbaum aus einer Auswahl | „Ausschnitt aus dem Stammbaum „{Name}“ · ohne Forschung“ |
    | ein Stammbaum aus einer Datei | „aus GEDCOM {Datei} · ohne Forschung“, „aus der Datei {Datei} · ohne Forschung“ |
    | andere | „ohne Forschung“ |

  - ein live verfolgter Stammbaum hat „◎ Live verfolgt“ und, wenn das Schreiben in ihn wartet, auch „· Schreiben in
    den Stammbaum pausiert“;
  - ein Stammbaum mit Zusammenführungen hat den Link **Zusammenführungen (N)** ([A8.11](A8-merging-trees.md#A8.11));
  - die Schaltflächen **Öffnen** (nicht beim geöffneten Stammbaum), **Struktur ändern…** ([A14.2](#A14.2)),
    **Export…** und ⋯ **Weitere Aktionen**.
- **Unvollendete Zusammenführungen** stehen unter dem Stammbaum, in den sie schreiben werden: „Unvollendete
  Zusammenführung: {Quelle} → {Ziel}“, „N zu entscheiden“ (dieselbe Zahl wie Schritt 2 des Assistenten), wie viele
  Paare geprüft sind, „gespeichert …“, und die Links **Fortsetzen**, **Umbenennen**, **Verwerfen**. Eine
  Zusammenführung, deren Zielstammbaum gelöscht wurde, steht im Abschnitt **Unvollendete Zusammenführungen ohne
  Stammbaum** mit dem Vermerk „der Zielstammbaum wurde gelöscht“.
- **⋯ Weitere Aktionen** bei einem Stammbaum, in Gruppen, die eine Linie trennt:
  1. **Stammbaum-Überblick**, **Statistik** ([A13](A13-tree-statistics.md#A13)), **Datenqualität**, **Sicherungen**,
     **Verlauf der Zusammenführungen** (nur mit einer Zusammenführung), **Änderungsverlauf**;
  2. Forschung: **Forschungsübersicht** (Telefon und Tablet), **Änderungen senden** (nur ein Stammbaum, der zu einer
     Forschung gehört), und eine Zeile der Forschung: bei einer Kopie **Forschung einschalten…**, sonst die
     Einstellungen der Forschung, **Forschung starten** oder die Installation;
  3. **Umbenennen…**, **Standardperson und -ansicht** ([A6.1.1](A6-views.md#A6.1.1)), **Beim Start öffnen**, die
     Standardeinstellung der Lebenszeitleiste, beim geöffneten Stammbaum **Orte** und **Namensschreibweisen**;
  4. **Struktur ändern…**;
  5. **Stammbaum ausblenden** / **Stammbaum einblenden**, **Stammbaum sperren** / **Stammbaum entsperren**;
  6. **Stammbaum löschen…**.
- Fußzeile des Fensters: **Alle exportieren**, **Neuer Stammbaum**, **Schließen**. Ab 6 Stammbäumen steht über der
  Liste das Feld **Stammbäume durchsuchen…**.
- **Ablegen auf einer Zeile:** eine GEDCOM-Datei oder ein Strom-Stammbaum (`.json`), auf der Zeile eines Stammbaums
  abgelegt, öffnet den Zusammenführungs-Assistenten mit diesem Stammbaum als Ziel; die Zeile eines Stammbaums, mit der
  Maus auf eine andere Zeile gezogen, führt ihn über den Assistenten in diesen Stammbaum zusammen. Die Zeile unter
  einer gezogenen Datei ist gestrichelt umrandet und sagt „Ablegen: {Datei} zum Stammbaum {Stammbaum} hinzufügen“
  ([A8.5.1](A8-merging-trees.md#A8.5.1)).
- **Grenzen:**
  - ein gesperrter Stammbaum hat in ⋯ nur Lesen und **Entsperren**; ein Stammbaum, den eine neuere Version der App
    gespeichert hat, nur Lesen;
  - **Duplizieren**, **Mit Stammbaum zusammenführen…**, **Aufteilen** und **Nicht verbundene Teile trennen** sind
    nicht in ⋯; sie sind in **Struktur ändern…**. Nicht verbundene Teile trennen bieten weiterhin auch der Import
    ([S6.4](S6-tree-from-another-program.md#S6.4)) und der Stammbaum-Überblick in **Schnellaktionen**
    ([A5](A5-tree-check.md)) an;
  - eine Kopie des Stammbaums einer Forschung hat keine Aktionen der Forschung, nur **Forschung einschalten…**.
- **Bedienung:** **Aktionen › Stammbaum › Stammbäume verwalten…**; Stammbaum-Umschalter → **Stammbäume verwalten…**;
  auf dem Telefon das Blatt der Stammbäume → **Stammbäume verwalten ›**.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:3110125c src/ui/tree-management.ts renderTreeManagerList (stats z indexu, badges, canStructure, pendingRow, mergeFacts subPending 134 S-P2, pendingOrphans, targetGone, searchable ≥ 6) · fbd97361 src/tree-row.ts treeOriginLine (research → copy → fromTree → importedFrom → none) · src/ui/tree-actions.ts treeActionGroups (overview, research, settings, structure, manage, delete, trees; manageTrees jen mimo správu) · 7b967fd8 strings.ts treeManager.imagesShared, imagesSharedTip (134 S-P1) · bcb2a0fa (kopie s vypnutým přepínačem, ◎ Sleduje se živě, zápis stojí) · strings.ts structure.research, followed, writeStopped, fromTree, fromGedcom, fromFile, mergeHistory, pendingRow, savedAt, pendingOrphans, targetGone, treeManager.* · app:73ee4625 src/tree-drop.ts, src/ui/tree-management.ts (puštění na řádek) · strings.ts mergeWizard.dropOnTree -->

<a id="A14.2"></a>
## A14.2 Struktur ändern…

Das Fenster **Struktur ändern: {Stammbaum}** bietet alles, was aus dem Stammbaum einen anderen Stammbaum macht oder
etwas zu ihm hinzufügt, in drei Gruppen. Bei jeder Option steht, welcher Stammbaum sich ändert: „Was mit dem
Stammbaum geschehen soll. Bei jeder Option steht, welcher Stammbaum sich ändert.“

| Gruppe | Option | Was geschieht |
|---|---|---|
| **Neuer Stammbaum** | **Aus einer Auswahl…** | Stammlinie, Personenliste, Linie oder Ansicht; ein neuer Stammbaum entsteht ([A14.3](#A14.3)) |
| | **Kopie des ganzen Stammbaums** | eine Kopie ohne Verbindung zur Forschung entsteht ([A14.3](#A14.3)) |
| **Aufteilen** | **In Familien…** | nach Stammlinien, Zweigen oder aus Sicht einer Person entstehen neue Stammbäume ([A14.4](#A14.4)) |
| | **Nicht verbundene Teile trennen…** | aus Teilen, die nichts verbindet, entstehen neue Stammbäume ([A14.4](#A14.4)) |
| **Zusammenführen** | **Auswahl oder ganzen Stammbaum in einen anderen…** | über den Zusammenführungs-Assistenten; der Zielstammbaum ändert sich, rückgängig machbar ([A14.5](#A14.5)) |
| | **Aus einem anderen Stammbaum in diesen Stammbaum…** | ein anderer Stammbaum der App über den Zusammenführungs-Assistenten; dieser Stammbaum ändert sich, rückgängig machbar ([A14.5](#A14.5)) |
| | **Aus einer Datei in diesen Stammbaum…** | GEDCOM oder Strom-Datei (JSON) über den Zusammenführungs-Assistenten; dieser Stammbaum ändert sich, rückgängig machbar ([A14.5](#A14.5)) |

Neuer Stammbaum, Kopie und Aufteilen ändern den ursprünglichen Stammbaum nicht.

- **Eine ausgegraute Option** zeigt unter sich den Grund:
  - **Aus einer Auswahl…** und **Aus einer Datei…** bei einem Stammbaum, der nicht geöffnet ist: „Nach dem Öffnen des
    Stammbaums.“ mit dem Link **Stammbaum {Name} öffnen** (öffnet den Stammbaum und das Fenster erneut);
  - **Nicht verbundene Teile trennen…** bei einem Stammbaum, der ganz verbunden ist: „Der ganze Stammbaum ist
    verbunden.“ Bei einem großen Stammbaum wird das im Hintergrund berechnet, und die Option bleibt aktiv, bis es
    sicher ist;
  - **Auswahl oder ganzen Stammbaum in einen anderen…**, wenn es keinen anderen Stammbaum gibt: „Es gibt keinen
    anderen Stammbaum.“ Ein Ziel, in das gerade nicht geschrieben werden kann, graut die Option nicht aus: warum, sagt
    der Zusammenführungs-Assistent ([A8.5](A8-merging-trees.md#A8.5));
  - **Aus einer Datei…** bei einem live verfolgten Stammbaum: „Der Stammbaum wird live verfolgt; hineinschreiben geht
    gerade nicht.“ mit dem Link **Verfolgung beenden**;
  - **Aus einem anderen Stammbaum in diesen Stammbaum…**, der erste Grund, der zutrifft: „Es gibt keinen anderen
    Stammbaum.“ → „Nach dem Öffnen des Stammbaums.“ → „Der Stammbaum wird live verfolgt; hineinschreiben geht gerade
    nicht.“ mit dem Link **Verfolgung beenden**.
- Alle Optionen sind ohne Scrollen auf einem Notebook-Bildschirm mit 1366 × 657 und mit 1024 × 768 zu sehen, auch
  mit den ausgegrauten Optionen und den Gründen darunter. Wo unter dem Fensterrand noch etwas ist, blendet der untere
  Teil des Fensters aus.
- **Grenzen:** ein gesperrter Stammbaum und ein Stammbaum nur zum Lesen haben das Fenster nicht (der Eintrag fehlt).
  Bei den Optionen hat das Fenster **Schließen**, bei den weiteren Schritten **Zurück** · **Abbrechen** und die
  Schaltfläche des Schritts; aus Stammbäume verwalten geöffnet, kehrt es dorthin zurück.
- **Bedienung:** **Aktionen › Stammbaum › Struktur ändern…**; Stammbäume verwalten, die Schaltfläche **Struktur
  ändern…** in der Zeile des Stammbaums und in ⋯; auf dem Telefon aus dem Menü **Mehr** bei einem Stammbaum. Die
  Pfeiltasten nach oben und unten, Pos1 und Ende wechseln zwischen den aktiven Optionen.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:a9bc0b6b src/structure-options.ts (OPTIONS, STRUCTURE_GROUPS, blocked: select notOpen, parts connected, into noOther, file notOpen/followed+stopFollowing; readOnly bez dialogu), src/ui/structure-ui.ts structureOptionRow (důvod pod volbou, Ukončit sledování), structureOpenTree, structureRunOption, arrowKeys · defe53b4 (Zavřít na volbách, Zpět · Zrušit · primární na krocích) · 45d5be44 (telefon) · strings.ts structure.intro, group.*, opt*, why*, openTree, research.stop · app:5e85dfc1 src/structure-options.ts (from: noOther → notOpen → followed + stopFollowing) · fef250eb, f4050b1c (všechny volby bez posouvání do 1366 × 657 a 1024 × 768, rozplynutí spodku okna) · dirigent:spec/139 K3.2, K3.3 -->

<a id="A14.3"></a>
## A14.3 Neuer Stammbaum aus einer Auswahl und Kopie des ganzen Stammbaums

**Aus einer Auswahl…** führt durch zwei Schritte: **Wen nehmen** und **Übersicht**. **Kopie des ganzen Stammbaums**
geht direkt zur Übersicht. Das Ergebnis ist ein neuer Stammbaum ohne Forschung; der ursprüngliche Stammbaum ändert
sich nicht.

- **Wen nehmen:** sieben Quellen, unter jeder „Ausgewählt: …“ mit der tatsächlichen Zahl der Personen:

  | Quelle | Was sie nimmt |
  |---|---|
  | **Aktuelle Ansicht** | „Die Personen, die gerade zu sehen sind:“; nur in der Ansicht Familie oder Nachkommen, sonst ausgegraut mit „Nur in der Ansicht Familie oder Nachkommen.“ |
  | **Geschlecht / Nachname** | eine Stammlinie; kleine Stammlinien stehen in der zusammengefalteten Zeile **Weitere Familien** |
  | **Personenliste** | Forschungslinien, **Feste Listen**, **Automatische Listen** ([A11](A11-lists-of-people.md#A11)); Feld **Liste suchen…** |
  | **Vorfahren einer Person** | die Person und die Zahl der Generationen 1–10 oder alle |
  | **Nachkommen einer Person** | dasselbe nach unten |
  | **Direkte Linie einer Person** | „Direkte Linie: Vorfahren und Nachkommen der Person, ohne Geschwister und deren Familien.“, Generationen nach oben und unten |
  | **Von Hand** | Personen, eine nach der anderen gewählt |

- **Übersicht:** „{Was} – der neue Stammbaum erhält:“ (bei der Kopie „Die Kopie erhält den ganzen Stammbaum {Name}:“)
  und die Zahlen der Personen, Paare, Quellen und Bilder nach denselben Regeln, nach denen der Stammbaum entsteht. Mit
  einem gewählten Kind kommt auch sein anderer Elternteil mit. Bilder werden nur gezählt, nicht in den Speicher
  geladen. Eine große Auswahl wird in Stapeln gezählt („Wird gezählt… N von M Personen“), und **Stammbaum erstellen**
  (**Kopie erstellen**) wartet auf das Ende der Zählung.
- **Eigenständige Teile:** Personen, die nur über nicht ausgewählte Personen verbunden sind, stehen im neuen Stammbaum
  allein: „N Personen sind nur über nicht ausgewählte Personen verbunden und stehen im neuen Stammbaum allein.“
  **Namen zeigen (N)** listet sie auf, auch damit, wer sie verbindet („verbunden über {Name}“).
- **Name:** ein neuer Stammbaum „{Stammbaum} — {was}“ (etwa „Horákovi — Geschlecht Vlková“), eine Kopie der erste
  freie aus „{Stammbaum} (Kopie)“, „{Stammbaum} (Kopie 2)“, „(Kopie 3)“… Einen Namen, den schon ein anderer Stammbaum
  hat, sagt das Feld unter sich („Ein Stammbaum mit diesem Namen existiert bereits.“), und speichern geht trotzdem.
  Einen freien Namen nimmt auch die Kopie eines über einen geteilten Link eingefügten Stammbaums.
- **Nach dem Erstellen:** die App wechselt zum neuen Stammbaum, auf seine Standardperson in der Mitte, und meldet
  „Stammbaum „{Name}“ erstellt (N Personen).“ mit der Aktion **Zurück zu {ursprünglicher Stammbaum}**. Eine Kopie
  kehrt in das Fenster zurück, aus dem sie kam.
- **Grenzen:**
  - aus einer Auswahl nur bei einem geöffneten Stammbaum; eine Kopie auch bei einem geschlossenen;
  - weder ein neuer Stammbaum noch eine Kopie ist mit einer Forschung verbunden: „Der ursprüngliche Stammbaum bleibt
    unverändert. Der neue ist nicht mit einer Forschung verbunden.“; bei einer Kopie „…eine eigene lässt sich später
    in der Stammbaumverwaltung einschalten.“ ([S1.10](S1-connecting-app-and-research.md#S1.10));
  - ein neuer Stammbaum aus einer Auswahl hat in Stammbäume verwalten die Herkunft „Ausschnitt aus dem Stammbaum
    „{Name}““, eine Kopie „Kopie des Stammbaums „{Name}““; eine Kopie einer Kopie trägt den Namen dieser Kopie.
- **Bedienung:** **Struktur ändern…** › **Aus einer Auswahl…**, **Kopie des ganzen Stammbaums** (ersetzt das frühere
  **Duplizieren**).
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:518c9654, b79b55ad, 1ff40d37 src/ui/structure-select-ui.ts (WHO_KINDS, CUT_VIEWS family/descendants, paneList selectionLines + pevné/automatické, panePerson generace 1–10/všechny, directNote, summarizeSubsetSteps po dávkách, create disabled do konce) · src/structure-options.ts summarizeSubset, keptWithGlue (druhý rodič vybraného dítěte), islands · e9f50b62 (Duplikovat → souhrn kopie, bez dialogu názvu) · 7b967fd8 src/tree-copy-name.ts freeCopyName, treeNameTaken (134 S-N4) · 21989997 (nový strom na výchozí osobě) · src/tree-manager.ts duplicateTree copyOf · strings.ts structure.kind.*, chosen, summaryLead, copyLead, islands, islandVia, showNames, defaultName, keepNote, copyKeepNote, create, createCopy, counting, imagesNotLoaded, createdToast, backTo, treeManager.duplicateSuffix, duplicateSuffixN, duplicateNameTaken -->

<a id="A14.4"></a>
## A14.4 Aufteilen

Das Aufteilen macht aus einem Stammbaum mehrere neue. Der ursprüngliche Stammbaum bleibt genau, wie er ist; ein
ungewollter lässt sich in Stammbäume verwalten löschen.

- **In Familien…** öffnet das Fenster **In Familien aufteilen**. **Was als eine Familie zählt:**
  - **Namenslinien:** Kinder gehören zu dem Elternteil, dessen Nachnamen sie tragen; eine eingeheiratete Person ohne
    eigene Familie bleibt beim Partner;
  - **Zweige:** die Hauptlinie mit allen Eingeheirateten und jeder angeschlossene Zweig für sich;
  - **Sicht einer Person:** der Grundstammbaum ist die Linie der gewählten Person (direkte Vorfahren, ihre leiblichen
    Geschwister, eigene Geschwister, alle Nachkommen); **Geschwisterfamilien behalten bis zu** Cousins ersten Grades,
    Cousins zweiten Grades oder niemandem; weitere Grundstammbäume über **Person hinzufügen…**; **Schnitte bei
    Geschwistern** wählt, wessen Familie ein Nebenstammbaum wird.

  Derselbe Stammbaum wird immer gleich aufgeteilt; die angezeigte Person bestimmt nur, welche Familie die erste ist.
  Die neuen Stammbäume bleiben über gemeinsame Personen verbunden. Die Schaltfläche **N Stammbäume erstellen**.
- **Nicht verbundene Teile trennen…** öffnet **Nicht verbundene Teile dieses Stammbaums**: Familien, zwischen denen
  kein Elternteil, kein Kind und keine Ehe führt, mit der Zahl der Personen und der ältesten Person. Die ausgewählten
  werden in neue Stammbäume abgetrennt (**N abtrennen**), jeder nach seinem Teil benannt. Ein Stammbaum, der ganz
  verbunden ist, hat diese Option nicht ([A14.2](#A14.2)).
- **Grenzen:** **In Familien…** geht auch bei einem Stammbaum, der nicht geöffnet ist: die Vorschläge erscheinen
  sofort, geordnet ab der Standardperson des Stammbaums (ohne sie ab der ersten Person); das Aufteilen hängt nicht von
  der Person ab.
- **Bedienung:** **Struktur ändern…** › **In Familien…**, **Nicht verbundene Teile trennen…**; nach dem Import einer
  Datei mit mehreren Familien **Nicht verbundene Teile trennen…** ([S6.4](S6-tree-from-another-program.md#S6.4));
  Stammbaum-Überblick, **Schnellaktionen** ([A5](A5-tree-check.md)). Aus beiden Fenstern führt ein Weg zurück zu
  Struktur ändern.
- **Gilt seit:** App 3.32.0 (im Fenster Struktur ändern); das Aufteilen selbst ist älter

<!-- zdroj: app:src/ui/split-families-ui.ts (kopie, originál nedotčen), src/split-families.ts · src/ui/split-ui.ts (nespojené části, components.ts) · src/ui/structure-ui.ts structureRunOption families (aktivní: showSplitFamiliesDialog, jinak showSplitFamiliesPickerDialog), parts showSplitDialog · 3e3b6c35 (cesta zpět do Změnit strukturu, oddělená část pojmenuje svůj strom, části spočítané jednou) · strings.ts splitFamilies.*, split.* -->

<a id="A14.5"></a>
## A14.5 Zusammenführen

Das Zusammenführen führt immer über den Zusammenführungs-Assistenten ([A8.5](A8-merging-trees.md#A8.5)): wohin, wer
ist wer, was sich ändert. Geschrieben wird erst nach der Bestätigung im Assistenten, und es lässt sich rückgängig
machen ([A8.12](A8-merging-trees.md#A8.12)).

- **Auswahl oder ganzen Stammbaum in einen anderen…** öffnet **In einen anderen Stammbaum übernehmen**, den Schritt
  „was übernehmen“:
  - **Der ganze Stammbaum {Name}:** in den Zielstammbaum wird ergänzt, was ihm fehlt;
  - **Eine Auswahl…:** der Schritt **Wen nehmen** wie bei einem neuen Stammbaum ([A14.3](#A14.3)); nur bei einem
    geöffneten Stammbaum. Unter der Auswahl steht, wie viele Partner der Assistent zusätzlich nimmt: „Mit ihnen kommen
    auch 2 Partner mit, die anderen Elternteile gewählter Kinder – insgesamt 9 Personen.“ Der Import heißt im
    Assistenten „{Stammbaum} — {was}“.

  **Weiter zum Assistenten** öffnet den Assistenten, in dem der Zielstammbaum gewählt wird. Dieser Stammbaum ändert
  sich nicht.
- **Aus einem anderen Stammbaum in diesen Stammbaum…** öffnet **Aus einem anderen Stammbaum übernehmen**, den Schritt
  „aus welchem Stammbaum“: „Welcher Stammbaum in diesen übernommen wird. Gewählt wird der ganze; eingrenzen lässt er
  sich im ersten Schritt des Assistenten.“ Angeboten werden alle anderen Stammbäume der App alphabetisch, auch
  ausgeblendete und Kopien, jeder mit „N Personen · Zeile der Herkunft · Ausgeblendet“ ([A14.1](#A14.1)). **Weiter
  zum Assistenten** öffnet den Zusammenführungs-Assistenten mit dem gewählten ganzen Stammbaum als Import und diesem
  Stammbaum als Ziel ([A8.5](A8-merging-trees.md#A8.5)). Der gewählte Stammbaum ändert sich nicht; dieser Stammbaum
  ändert sich erst nach der Bestätigung im Assistenten, und das Zusammenführen lässt sich rückgängig machen
  (**Rückgängig** in der Meldung, **Verlauf der Zusammenführungen**). Ein langer Name ohne Leerzeichen wird auf dem
  Telefon in der Zeile umbrochen.
- **Aus einer Datei in diesen Stammbaum…:** **GEDCOM-Datei (.ged)** (aus einem anderen Programm: MyHeritage, Geni,
  Ancestry, Gramps…) oder **Strom-Datei (.json)** (ein Export aus Strom, etwa von Verwandten). Nach der Dateiauswahl
  öffnet sich der Zusammenführungs-Assistent mit diesem Stammbaum als Ziel. In den Stammbaum wird nichts geschrieben,
  bis der Assistent es bestätigt.
- **Grenzen:** wenn gerade kein Stammbaum die Zusammenführung aufnehmen kann, bleibt das Fenster Struktur ändern, und
  der Assistent sagt, warum. Aus einer Datei und aus einem anderen Stammbaum hinzufügen geht nur in einen geöffneten
  Stammbaum, der nicht live verfolgt wird. Was nach einer Zusammenführung an die Forschung gesendet wird, regelt
  [A8.13](A8-merging-trees.md#A8.13).
- **Bedienung:** **Struktur ändern…** › **Auswahl oder ganzen Stammbaum in einen anderen…**, **Aus einem anderen
  Stammbaum in diesen Stammbaum…**, **Aus einer Datei in diesen Stammbaum…**; eine Datei oder die Zeile eines
  Stammbaums, auf einer Zeile von Stammbäume verwalten abgelegt ([A8.5.1](A8-merging-trees.md#A8.5.1))
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:f0c5a3fb src/ui/structure-ui.ts structureJoinWhatStep, structureJoin (whole → showMergeTreesDialog, selection → structureWhoStep mode join → mergeSubsetInto „{strom} — {co}“), structureFileStep (startGedcomImportPlain, startJsonImportIntoTree) · 29d02a8c joinPartners · strings.ts structure.joinTitle, joinWhatIntro, joinWhole, joinWholeDesc, joinSelection, joinSelectionDesc, joinNote, continueGuide, joinPartners, fileTitle, fileGed*, fileJson*, fileNote · app:5e85dfc1 src/ui/structure-ui.ts (from: ostatní stromy podle abecedy, persons · treeOriginText · hiddenBadge; celý strom jako import, otevřený strom cíl) · fef250eb (dlouhý název na telefonu) · strings.ts structure.optFrom, optFromDesc, fromTitle, fromStep, fromIntro, fromNote · dirigent:spec/139 K3.2 -->
