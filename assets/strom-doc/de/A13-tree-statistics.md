<a id="A13"></a>
# A13 Statistik des Stammbaums

Das Fenster **Statistik** zählt, wie oft sich im Stammbaum Namen, Orte, Berufe, Alter und Geburten wiederholen. Jedes
Thema ist eine vollständige Tabelle der Werte mit Anzahl und Anteil, für den gewählten Umfang von Personen und
Geburtszeitraum. Ein Klick auf einen Wert zeigt seine Personen in der Tabelle, die Tabelle lässt sich als CSV
speichern. Das Kapitel beschreibt die Strom-App 3.32.0. Änderungen aus einer neueren Version tragen deren Nummer.

<!-- zdroj: dirigent:spec/138-podrobne-statistiky-stromu · app:d77da992 src/tree-stats.ts · f9722722 src/ui/tree-stats-ui.ts · 6f5412e3 · 417490db · 2723a543, e5723bf2, e1eae544 · 6c3b7e61 · strings.ts treeStats.* · dirigent:prace/1123-app-138-statistiky -->

<a id="A13.1"></a>
## A13.1 Das Fenster Statistik

Das Fenster **Statistik: <Stammbaum>** hat links die Themen in Gruppen und rechts die Tabelle des gewählten Themas.
Über der Tabelle stehen **Umfang** ([A13.3](#A13.3)) und die Optionen des Themas, darunter die Summen und Hinweise,
wie gezählt wird.

- **Wo es sich öffnet:**
  - **Aktionen › Stammbaum › Statistik** (direkt unter **Stammbaum-Überblick**);
  - unter Stammbäume verwalten im Menü ⋯ beim Stammbaum, in der Gruppe mit **Stammbaum-Überblick**,
    **Datenqualität**, **Sicherungen**, **Verlauf der Zusammenführungen** und **Änderungsverlauf**
    ([A14.1](A14-trees-and-structure.md#A14.1));
  - auf dem Telefon **Mehr › Ansicht › Statistik**; das Fenster beginnt bei der Schaltfläche **Thema**, Thema und
    Umfang werden in einer Liste von unten gewählt;
  - der Link **Im Detail** im **Stammbaum-Überblick**: beim Detail einer Stammlinie (**Vornamen** mit dem Umfang
    dieser Stammlinie), bei **Sterbealter** (**Sterbealter**), bei **Kinder pro Paar nach Generation** (**Kinder pro
    Paar**), bei **Geburten nach Monat** (**Geburten im Lauf der Zeit** nach Monaten) und bei **Häufigste männliche
    Vornamen** / **Häufigste weibliche Vornamen** (**Vornamen** der Männer, der Frauen).
- Zuerst wird das gewählte Thema gezählt, dann die Zahlen der anderen Themen in der Liste links; ein Thema, das noch
  gezählt wird, zeigt „Wird berechnet…“. Eine Änderung der Daten des geöffneten Stammbaums zählt die Tabellen neu.
- Die Tabelle hat die Spalten des Werts, **Anzahl** und **Anteil**. Sortierung **Nach Anzahl**, **A–Z**; bei Alter,
  Zeitraum und Kinderzahl **Nach Alter**, **Nach Zeitraum**, **Nach Kinderzahl** (gruppierte Werte sind standardmäßig
  nach dem Wert sortiert). Das Suchfeld („Namen suchen…“, „Nachnamen suchen…“, „Orte suchen…“) grenzt die Zeilen ohne
  Rücksicht auf Groß-/Kleinschreibung und diakritische Zeichen ein; die Zeile **Nicht angegeben** ist beim Suchen
  ausgeblendet.
- Unter der Tabelle die Summen: „Insgesamt 312 Personen · 48 Werte“; beim Alter „… mit bekanntem Alter“, bei Paaren
  „Insgesamt 120 Paare …“, bei Ehen „Insgesamt 95 Ehen …“.
- **Grenzen:** eine gespeicherte Seite (HTML-Export) hat weder Statistik noch die Links **Im Detail**. Ein Stammbaum,
  der nicht geöffnet ist (das Fenster aus Stammbäume verwalten bei einem anderen Stammbaum), berechnet die Statistik,
  zeigt die Personen aber nicht in der Tabelle („Der Stammbaum ist nicht geöffnet – die Personen lassen sich nicht in
  der Tabelle zeigen.“).
- **Bedienung:** siehe **Wo es sich öffnet**; **Schließen** oder Esc.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:f9722722 src/ui/tree-stats-ui.ts (skupiny témat, tabulka, řazení, hledání, součty, poznámky) · 417490db (Akce › Strom pod Přehledem, list stromu, Správa stromů, čtvrtá dlaždice Zobrazení v listu Další na telefonu, nic v exportované stránce; telefon začíná na tlačítku Téma) · src/ui/tree-overview.ts treeOverviewStatsLink (rod-show firstNames rodId, deathAge, childrenPerCouple, births months, firstNames sex male/female; '' v režimu prohlížení) · src/tree-stats.ts defaultSort, isValueTopic · src/ui/tree-actions.ts treeActionGroups (overview) · strings.ts treeStats.menu, title, groups, topics, sort, search, none, total, readOnly, overview.more, phone.*; treeOverview.deathAgeTitle, childrenByGen, birthsByMonth, topMaleNames, topFemaleNames -->

<a id="A13.2"></a>
## A13.2 Themen und wie sie gezählt werden

Jedes Thema führt alle Werte auf, die jemand im Umfang hat, nicht nur die häufigsten. Eine Einheit ohne Wert steht in
der Zeile **Nicht angegeben**. Der Anteil bezieht sich auf die Einheiten mit angegebenem Wert.

| Gruppe | Thema | Zählt | Optionen |
|---|---|---|---|
| Namen | **Vornamen** | Personen | **Geschlecht** (**Männer**, **Frauen**, **Nicht angegeben**; Standard Männer), **Zählen** (**Erster Vorname** / **Jeder Vorname**) |
| | **Nachnamen** | Personen | **Nachname** (**Geburtsname** / **Bei Frauen auch Ehename**) |
| Orte | **Geburtsorte**, **Sterbeorte** | Personen | **Ebene** (**Ort**, **Bezirk**, **Land**) |
| | **Heiratsorte** | Ehen | **Ebene** |
| Leben | **Berufe**, **Religionen** | Personen | – |
| | **Sterbealter**, **Alter bei der ersten Heirat**, **Alter beim ersten Kind** | Personen, in Fünfjahresgruppen | – |
| | **Kinder pro Paar** | Paare | – |
| Zeit | **Geburten im Lauf der Zeit** | Personen | **Gruppieren** (**Nach Jahrzehnten** / **Nach Monaten**) |

- **Prüft der Code:**
  - gezählt werden nur echte Personen, nie Platzhalterpersonen, auch nicht als Partner oder Kinder eines Paares;
  - eine Einheit wird bei einem Wert einmal gezählt. Eine Person mit mehreren Berufen zählt bei jedem von ihnen;
  - **Jeder Vorname**: eine Person mit mehreren Vornamen („Jan Karel“) zählt bei jedem, die Summe der Anteile liegt
    über 100 %; ein Name mit Bindestrich ist ein Name;
  - **Nachnamen**: männliche und weibliche Form eines Nachnamens zählen zusammen, nach den Regeln der
    Namensschreibweisen des Stammbaums ([A4.5](A4-surnames-and-families.md#A4.5)). **Bei Frauen auch Ehename** zählt
    eine verheiratete Frau beim Geburtsnamen und beim Ehenamen; die Summe ist dann größer als die Zahl der Personen;
  - Orte: derselbe, unterschiedlich geschriebene Ort zählt einmal (vereinheitlichte Orte), ein Wert hat die Zahl der
    Schreibweisen und die Sprechblase „Geschrieben als: …“. Ein Stammbaum ohne Ortshierarchie zählt Orte („Ohne
    Ortshierarchie werden Orte gezählt: Straßen und Hausnummern gehören zum Ort.“) und hat die Option **Ebene** nicht.
    Mit Orten, die die Forschung bestimmt hat ([R4.2](R4-places.md#R4.2)), lassen sich Bezirke und Länder zählen; ein
    Ort ohne sie ist „ohne bekannten Bezirk“, „ohne bekanntes Land“;
  - das Alter ist in ganzen Jahren aus Geburtsdatum und Datum des Ereignisses, in Fünfjahresgruppen, oben „100 und
    mehr“. **Nicht angegeben** sind Lebende und Personen ohne beide Daten;
  - **Kinder pro Paar**: ein Paar mit mindestens einem Partner im Umfang, Kinder ohne Platzhalterpersonen, oben „10
    und mehr“. **Heiratsorte** ebenso: eine Ehe, bei der mindestens ein Partner im Umfang ist;
  - das Geburtsjahr wird auch aus einer Schätzung genommen („um 1820“ zählt als 1820).
- **Grenzen:** ein Thema, das niemand hat, sagt warum („Im Stammbaum hat niemand einen Beruf eingetragen.“).
- **Bedienung:** Fenster **Statistik** → Thema links (auf dem Telefon **Thema**); Optionen über der Tabelle.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:d77da992 src/tree-stats.ts (sdílená pravidla: zástupné nikdy, jednotky osoby/páry/sňatky, pár a sňatek v rozsahu s aspoň jedním partnerem, všechny hodnoty bez top N, Neuvedeno, podíl count/known), DEFAULT_STATS_OPTIONS (sex male, names first, surnames birth, level town, births decade), jména: slova, spojovník jedno slovo, příjmení: mužský a ženský tvar pod mužským klíčem, místo: klíč skupiny míst, jinak obec (ulice a čísla domů k obci), nejčastější zápis · src/ui/tree-stats-ui.ts volby jen u firstNames, surnames, místa s hasLevels, births · strings.ts treeStats.topics, desc, opt, ageGroup, ageTop, childrenTop, note.real, share, ages, ageNone, births, occupations, couples, surnames, withMarried, each, places, placesTown, placesLevel, noDistrict, noCountry, formsTip, empty.* -->

<a id="A13.3"></a>
## A13.3 Umfang und Geburtszeitraum

Die Statistik zählt die Personen im gewählten **Umfang**, wahlweise nur die in einem angegebenen Zeitraum geborenen.

- **Umfang:** **Ganzer Stammbaum**, **Stammlinie…**, **Direkte Linie einer Person…** (Vorfahren, Nachkommen und die
  Person, wie [A4.8.2](A4-surnames-and-families.md#A4.8.2)), **Personenliste…** ([A11](A11-lists-of-people.md)). Die
  Auswahl hat das Feld „Stammlinie, Person, Liste suchen…“.
- **Geburtszeitraum:** **Geboren von** und **bis** (Jahr). Personen ohne Geburtsjahr fallen bei gewähltem Zeitraum
  heraus; das Fenster sagt, wie viele („12 Personen ohne Geburtsjahr liegen außerhalb des Zeitraums.“). Das Jahr muss
  eine Zahl sein und „von“ höchstens „bis“, sonst „Ein Jahr als Zahl, „von“ nicht nach „bis“.“. **Zeitraum
  aufheben** hebt ihn auf.
- **Grenzen:** Umfang und Zeitraum gelten, bis sich das Fenster schließt, ebenso wie Thema, Optionen, Sortierung und
  Suche; nichts wird im Stammbaum oder in den Einstellungen gespeichert. Das nächste Öffnen beginnt mit dem ganzen
  Stammbaum. Vom Link **Im Detail** bei einer Stammlinie beginnt das Fenster mit dieser Stammlinie. Ein Umfang, der
  inzwischen verschwunden ist (eine gelöschte Liste), ist leer.
- **Bedienung:** Fenster **Statistik** → **Umfang** (auf dem Telefon die Liste **Umfang**).
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:d77da992 src/tree-stats.ts StatsScope (výběr okna nebo přímá linie), scopePeople (skutečné osoby, s obdobím počet bez roku narození, zmizelý výběr prázdný) · 6c3b7e61 přímá linie přes directLineIds rozsahu hledání · f9722722 src/ui/tree-stats-ui.ts (rozsah a období jen v okně) · strings.ts treeStats.scope.label, tree, treeSub, rodMore, directMore, directSub, listMore, search, from, to, periodSec, periodHint, outOfPeriod, invalid, clearPeriod -->

<a id="A13.4"></a>
## A13.4 Von einem Wert zur Tabelle

Ein Klick auf eine Zeile der Tabelle („14 Personen in der Tabelle zeigen“) öffnet die Tabelle ([A6.7](A6-views.md#A6.7))
mit den Personen dieses Werts.

- Die Tabelle zeigt den ganzen Stammbaum, eingegrenzt durch einen Chip am Anfang der Reihe der Chips: „Statistik:
  Vorname Jan · Stammlinie Horák“. Auf dem Telefon steht der Chip in einer eigenen Zeile unter der Leiste und zählt zu
  **Filter**.
- Bei einem Paar und einer Ehe werden beide Partner gezeigt.
- **Zurück zur Statistik** bringt das Fenster so zurück, wie es war (Thema, Optionen, Umfang, Zeitraum).
- × am Chip oder **Filter aufheben** hebt den Chip auf. Der Chip wird nie in einer Ansicht, in angefangener Arbeit
  oder in der Regel einer Liste gespeichert.
- **Als Personenliste speichern** speichert genau die gezeigten Personen als feste Liste, benannt nach dem Chip
  ([A11.6](A11-lists-of-people.md#A11.6)).
- **Grenzen:** nur beim geöffneten Stammbaum ([A13.1](#A13.1)).
- **Bedienung:** Zeile der Tabelle (Klick, Enter).
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:6f5412e3 (klik na hodnotu → Tabulka celého stromu se štítkem „Statistiky: … · rozsah“ první v řadě, na telefonu vlastní řádek pod lištou a počítá se do Filtrů, × nebo Zrušit filtry, Zpět do Statistik vrátí okno, štítek se neukládá do pohledu, práce ani pravidla, Uložit jako seznam osob = pevný seznam pojmenovaný podle štítku) · src/tree-stats.ts (pár a sňatek: klik ukáže oba partnery) · strings.ts treeStats.rowTitle, table.chip, table.back, chipWhat.*, readOnly -->

<a id="A13.5"></a>
## A13.5 CSV-Export

**CSV exportieren** in der Fußzeile des Fensters speichert die Tabelle des Themas so, wie das Fenster sie zeigt: mit
Optionen, Umfang, Zeitraum und Suche.

- Die Datei hat eine erste Zeile mit einer Beschreibung („Statistik: Vornamen – Männer, erster Vorname · Umfang:
  Stammlinie Horák · Stammbaum: Horákovi · 24. 11. 2026“, mit Suche auch „Suche „Jan““), dann die Spalten **Wert**,
  **Anzahl**, **Anteil %**, die Zeile **Nicht angegeben** (nicht bei einer Suche) und **Insgesamt**. Trennzeichen ist
  das Semikolon, Kodierung UTF-8.
- Nach dem Speichern die Meldung „Gespeichert: <Datei>“. Nichts wird nach außen gesendet; die Datei bleibt auf dem
  Gerät.
- **Grenzen:** eine leere Tabelle hat nichts zu speichern („Nichts zu speichern“); solange die Tabelle berechnet wird,
  wartet die Schaltfläche („Speichert die Tabelle, sobald sie berechnet ist“).
- **Bedienung:** Fenster **Statistik** → **CSV exportieren** (auf dem Telefon das Symbol im Kopf).
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:f9722722 src/ui/tree-stats-ui.ts exportTreeStatsCsv, src/tree-stats.ts statsCsv (BOM, středník, Neuvedeno jen bez hledání, Celkem) · src/ui/tree-stats-ui.ts export (popisný řádek desc, hlavička head, none, total, toast) · strings.ts treeStats.export.btn, what, waiting, nothing, head, none, total, desc, search, toast, phone.exportAria -->
