<a id="A2"></a>
# A2 Einlesen eines Stammbaums (GEDCOM)

Das Kapitel sagt, was die App aus einer GEDCOM-Datei eines anderen Programms übernimmt, was sie überspringt und wie
sie das in der Zusammenfassung des Imports offenlegt. Beschrieben werden die Strom-App 3.21.2 (und die Forschung
1.25.2); Änderungen aus einer neueren Version tragen deren Nummer. Das Öffnen einer Datei der Forschung und die
Bindung eines Stammbaums an die Forschung gehören in Kapitel S1. Den ganzen Weg eines Stammbaums aus einem anderen
Programm (Zuverlässigkeitsmarken, Schutz der Angaben aus dem Stammbaum, die Karte **Wie weiter**, Export zurück)
beschreibt [S6](S6-tree-from-another-program.md).

<a id="A2.1"></a>
## A2.1 Was eingelesen wird und was nicht

Die App übernimmt Personen, Familien, Quellen, Notizen, Ereignisse und Medien, die sie kennt. Was sie nicht kennt,
überträgt sie nicht, legt es aber offen: jedes nicht übertragene Tag wird in der Kachel **Nicht unterstützt** gezählt
und namentlich in der Zeile **Übersprungene Einträge** genannt. Auf der Ebene eines Datensatzes und einer direkten
Angabe von Person, Familie und Quelle geht nichts stillschweigend verloren.

- **Grenzen:** Gezählt werden unbekannte Datensätze (Ebene 0) und unbekannte direkte Angaben von Person, Familie und
  Quelle (Ebene 1). Unbekannte Einzelheiten tiefer im Datensatz (Ebene 2 und darunter) werden ohne Zählung
  übersprungen. Verwaltungs-Tags anderer Programme (`_UPD`, `RIN`, `_UID`, `CHAN`, `_PROJECT_GUID`,
  `_EXPORTED_FROM_SITE_ID`) werden stillschweigend übersprungen; über die Familie sagen sie nichts. Die Tags `ANCI`,
  `DESI`, `RFN`, `AFN` und `RESN` werden gezählt. Eine Reihe von Angaben ohne eigenen Platz in der App wird nicht
  verworfen, sondern als beschriftete Zeile in die Notiz der Person geschrieben: Segnung, Ruhestand, Stand,
  Beschreibung, Ausweisnummer, Kinderzahl, Anzahl der Ehen, Besitz, Sozialversicherungsnummer, Angabe und „Auch
  bekannt als“. Forschungsblöcke von Strom werden aus einer gewöhnlichen Datei nicht gelesen und gezählt (siehe
  [A2.7](#A2.7)).
- **Bedienung:** **Import → GEDCOM importieren** (Datei `.ged`). In einem neuen Stammbaum auch die Schaltfläche im
  leeren Stammbaum. Zusammenfassung siehe [A2.1.1](#A2.1.1).
- **Gilt seit:** App 1.9.0 (Zusammenfassung der nicht übertragenen Tags); Notizzeilen seit App 3.0.0.
- **Ab App 3.26.0:**
  - `_UID`, `RIN`, `AFN` und weitere Programm-IDs (`UID`, `EXID`, `_FSFTID`) werden nicht übersprungen: sie bleiben bei
    Person und Familie zusammen mit der ursprünglichen Datensatzkennung (`@I12@`) als Programm-ID erhalten
    ([S6.1](S6-tree-from-another-program.md#S6.1));
  - eigene Tags des Programms (`_XXX`) direkt bei Person, Familie und Quelle bleiben für den Export **Zurück zu
    {program}** erhalten ([S6.6](S6-tree-from-another-program.md#S6.6)); tiefere eigene Tags werden gezählt;
  - Fotoausschnitte von MyHeritage (`_POSITION`, `_CUTOUT`) sind Verwaltungsangaben und werden nicht gezählt;
  - eine vor der Heirat eingetragene Scheidung (PAF) geht nicht verloren und überschreibt die Heirat nicht; eine leere
    Heirat oder Scheidung, die vor einer anderen mit Datum eingetragen ist (MyHeritage), behält Datum und Ort der
    datierten;
  - ein als Beschreibung eingetragener Name (`Son`, `Unknown`) kommt so zurück, wie er eingetragen war, ohne eine
    daraus gemachte Notiz; Text auf der Zeile einer Angabe (Bildung, Begräbnis, eigenes Ereignis), eine Adresse in
    Teilen (`ADR1`, `CITY`…) und ein Weblink im Text einer Quelle bleiben erhalten und kommen so zurück, wie die Datei
    sie hatte.

<!-- zdroj: app:src/ged-parser.ts:1450 KNOWN_INDI_TAGS, :1453 KNOWN_FAM_TAGS, :1464 KNOWN_RECORD_TYPES, :1478 IGNORED_BOOKKEEPING_TAGS, :636 NOTED_INDI_TAGS, :2094 drop, :2410, :2486, :2194 · strings.ts gedcom.unsupported, gedcom.skippedTags, gedcomNotes.factLabels -->

<a id="A2.1.1"></a>
### A2.1.1 Zusammenfassung des Imports

Nach der Umwandlung öffnet sich das Fenster **GEDCOM-Umwandlung**. Die Kacheln **Personen**, **Partnerschaften**,
**Platzhalter** und **Nicht unterstützt** sind immer da; **Fotos**, **Dokumente**, **Ausschnitte**, **Quellen** und
**Ereignisse** nur mit einer Anzahl über null. Die Zeile **Übersprungene Einträge** zählt die Tags vom häufigsten an
auf („`OBJE` ×12“). Weitere Zeilen melden Personen mit unbekanntem Geschlecht und Kinder, die in mehreren Familien
erfasst sind. „Alles in der Datei wurde importiert.“ erscheint nur, wenn nichts übersprungen wurde. Das Geschlecht
wird nicht aus der Rolle in der Familie erraten; ein anderer Wert als `M` oder `F` ist ein unbekanntes Geschlecht.

Optionen: **Als neuen Stammbaum importieren** (der aktuelle Stammbaum bleibt), **Mit Vorhandenem zusammenführen**
(siehe [A2.8](#A2.8)), **Als JSON speichern**; aus einem leeren Stammbaum außerdem **In Stammbaum einfügen**. Das
Kontrollkästchen **Bilder importieren (Ausschnitte, Anhänge, Fotos)** zeigt eine Schätzung der Größe. Den
Ausgangszustand nimmt es aus **Einstellungen → Bilder beim Import laden**, und es gilt nur für diesen Import. Ohne
Bilder bleiben Abschriften, Archive und Verweise auf Seiten. Pfade und Adressen von Dateien werden zum Anbinden
angeboten.

- **Ab App 3.22.0:** Über der Liste der übersprungenen Tags steht ein Satz, was die Kachel **Nicht
  unterstützt** zählt: Teile der Datei, die Strom nicht kennt und nicht übertragen hat, keine Personen und
  Beziehungen.
- **Ab App 3.26.0:**
  - die Zeile „Für den Export „Zurück zu {program}“ aufbewahrt: N GEDCOM-Tags (…)“, wenn die Datei eigene Tags des
    Programms hat;
  - die Zeile **Textkodierung** bei einer Datei mit erratener oder einbytiger Kodierung ([A2.2](#A2.2));
  - nach dem Import einer Datei eines anderen Programms die Karte **Wie weiter**
    ([S6.4](S6-tree-from-another-program.md#S6.4)); sie ersetzt die früheren Fragen nach dem Import;
  - **In Stammbaum einfügen** speichert zuerst eine Sicherung des Stammbaums
    ([S6.5](S6-tree-from-another-program.md#S6.5)).

<!-- zdroj: app:src/ui/import-export.ts:374 handleGedcomFile, :410 showGedcomResultDialog · app:src/ged-parser.ts:3880 statistiky convertToStrom, :3186 pohlaví · strings.ts gedcom.*, importImages.* -->

<a id="A2.2"></a>
## A2.2 Kodierung und Version von GEDCOM

Die App liest GEDCOM 5.5.1 und GEDCOM 7 und erkennt die Kodierung selbst. Sie exportiert immer GEDCOM 5.5.1 in UTF-8.

- **Grenzen:** Die Kodierung bestimmt zuerst die BOM-Markierung (UTF-8, UTF-16 LE und BE). Ohne sie entscheidet die
  Zeile `1 CHAR` im Kopf: `ANSEL` hat eine eigene Umwandlung (ein unbekanntes Byte erscheint als „�“), `UNICODE` ist
  UTF-16, `ANSI` ist Windows-1252, alles andere UTF-8. Zeilenenden CR, LF und CRLF sind gleichwertig. Fortsetzungen
  `CONC` und `CONT` werden verbunden; bei Orten, Namen, Seiten, Adressen und Notizen bleibt auch ein Leerzeichen am
  Anfang der Fortsetzung erhalten. Aus GEDCOM 7 werden `SNOTE` als gemeinsame Notiz und Datensätze ohne Kennung
  gelesen. Eigenständige Mediendatensätze `0 @O1@ OBJE` werden nicht gelesen und in **Nicht unterstützt** gezählt;
  ein Bild, auf das nur ein Zeiger verweist, kommt so nicht an. Ein GEDZIP-Paket wird nicht eingelesen, das Fenster
  nimmt nur `.ged` an.
- **Bedienung:** Keine; die Kodierung wird nicht gewählt.
- **Gilt seit:** App 1.16.0 (Umwandlung von ANSEL und Kodierung nach dem Kopf).
- **Ab App 3.22.0:** Die GEDCOM-7-Tags `UID`, `CREA` und `EXID` werden als Verwaltungsangaben stillschweigend
  übersprungen; in 3.21.2 werden sie in **Nicht unterstützt** gezählt.
- **Ab App 3.26.0:**
  - `CHAR CP1250` oder `WINDOWS-1250` ist Windows-1250. `ANSI` bedeutet die Codepage des Computers, der die Datei
    geschrieben hat: gültiges UTF-8 bleibt UTF-8, sonst entscheiden die Wörter der Datei zwischen Windows-1250
    (Mitteleuropa: č ř ě ł ż) und Windows-1252 (Westeuropa). Ebenso wird die Kodierung einer Datei ohne `CHAR` erraten
    und einer Datei mit `CHAR UTF-8`, die kein gültiges UTF-8 ist;
  - wenn die Kodierung erraten wurde oder einbytig ist und die Datei Text mit diakritischen Zeichen hat, zeigt die
    Zusammenfassung des Imports die Zeile **Textkodierung** mit **Namensbeispiele:** und der Wahl einer anderen
    Kodierung (**UTF-8**, **Windows-1250 (Mitteleuropa)**, **Windows-1252 (Westeuropa)**, **ISO-8859-2 (Latin-2)**,
    **ANSEL (älteres GEDCOM)**). Verstümmelte Zeichen in Namen (è statt č, ø statt ř) bedeuten, dass eine andere
    Kodierung passt. **Bedienung:** die Wahl in der Zeile **Textkodierung**;
  - eigenständige Mediendatensätze `0 @O1@ OBJE` werden über die Verweise auf sie gelesen; ein so verwiesenes Foto
    einer Familie wird nur gezählt.

<!-- zdroj: app:src/ged-parser.ts:1262 decodeGedcomFile, :1236 decodeAnsel, :1290–1380 předzpracování CONC/CONT, :1683 parseGedcom · app:src/ged-exporter.ts:508 exportToGedcom · index.html input accept=".ged" -->

<a id="A2.3"></a>
## A2.3 Vornamen und Nachnamen

Vorname und Nachname werden aus den Unter-Tags `GIVN` und `SURN` genommen, sonst aus der Zeile `NAME` nach den
Schrägstrichen. Titel aus `NPFX` und `NSFX` werden getrennt gehalten und aus der Zeile entfernt; ohne diese Tags wird
kein Titel erraten. Die Regeln sind dieselben wie in der Forschung.

- **Grenzen:** Ohne Schrägstriche wird die Zeile am ersten Leerzeichen geteilt. Text hinter dem schließenden
  Schrägstrich gehört zum Nachnamen. Schreibungen wie „N.N.“, „neznámý“, „unknown“, „nieznany“ ergeben den Namen
  „?“. Beschreibungen anstelle eines Namens („syn“, „dcera“, „mrtvě narozený“, „totgeboren“, „filius“, Text in
  Klammern) ergeben „?“, und die Wörter kommen in die Notiz der Person. Weitere Zeilen `NAME` sind Varianten. Ein
  Name mit `TYPE married` oder `_MARNM` ist ein Ehename, keine Variante; der letzte solche gewinnt.
  Steht der Ehename zuerst und der Geburtsname erst danach, werden sie vertauscht. `2 _STROM_PRIMARY Y` kennzeichnet
  den Namen, unter dem die Person bekannt ist. Eine Person ohne Vor- und Nachnamen ist eine Platzhalterperson (Kachel
  **Platzhalter**). Gruppen von Varianten des Nachnamens und Stammlinien behandelt [A4](A4-surnames-and-families.md).
- **Bedienung:** Keine; das Ergebnis wird in der Personenkarte bearbeitet.
- **Gilt seit:** App 3.10.0 (Titel), 3.13.0 (Ehename), 3.18.0 (`_STROM_PRIMARY`).

<!-- zdroj: app:src/gedcom-names.ts:197 readGedcomName, :114 splitNameLine, :85 noName, :96 notAName, :260 stripTitles · app:src/ged-parser.ts:1404 readMarriedSurname, :2250 varianty, :2955 prohození TYPE -->

<a id="A2.4"></a>
## A2.4 Daten und ihre Formen

GEDCOM-Daten werden in die Form der App umgewandelt: `3 JUN 1900` in einen Tag, `JUN 1900` in einen Monat, `1900` in
ein Jahr. Eine Schätzung (`ABT`, `EST`, `CAL`, `INT`) ist „ungefähr“, `BEF` „vor“, `AFT` „nach“, `BET … AND` und
`FROM … TO` ein Zeitraum. Was nicht in die Form passt, bleibt in der Notiz der Person, nichts wird verworfen.

- **Grenzen:** Ein Doppeljahr (1699/00) behält das erste Jahr. Ein anderer Kalender als der gregorianische wird
  entfernt, und die Notiz sagt „Datum im julianischen Kalender: …“ (auch jüdischer, französischer Revolutions- und
  römischer Kalender). Text in Klammern bleibt als „Datum laut Eintrag: …“ erhalten. Ein unbekannter Monat lässt nur
  das Jahr mit einer Notiz. Wörter auf Tschechisch, Slowakisch, Polnisch, Deutsch, Russisch und Ukrainisch („po“,
  „před“, „kolem“, „mezi … a“, „nach“, „około“) werden nur dann als Tags gelesen, wenn ein gültiges Datum folgt;
  „po válce“ bleibt Text. Das Alter bei einem Ereignis (`AGE`) wird als „61 Jahre“ erfasst, `INFANT` als „Säugling“.
  Eine Form des Datums, die die App anders schreiben würde (z. B. `EST` oder `CAL`), wird bei der Person und der
  Beziehung gemerkt. Der Export gibt sie in der ursprünglichen Gestalt zurück, solange sich das Datum nicht ändert.
- **Bedienung:** Keine.
- **Gilt seit:** App 3.0.0 (Notizen zu Daten), 3.7.0 (Wörter der Sprachen), 3.17.0 (erhaltene Formen).

<!-- zdroj: app:src/gedcom-date-read.ts:22 parseGedcomDate, :33 gedcomDatePhrase, :55 readGedcomDate · app:src/date-words.ts · app:src/ged-parser.ts:702 kalendář, :1157 gedcomDates · app:src/gedcom-date-form.ts · strings.ts gedcomNotes.datePhrase -->

<a id="A2.5"></a>
## A2.5 Beziehungen und Stand des Paares

Eine Familie (`FAM`) ergibt die Beziehung zweier Partner und ihre Kinder. Den Stand des Paares bestimmen Heiraten
und Scheidungen in der Reihenfolge der Datei; datierte Ereignisse werden nach dem Datum verglichen. Das Tag `_STAT`
hat Vorrang vor den Ereignissen.

- **Grenzen:** `_STAT` kennt die Werte verheiratet, geschieden, getrennt und unverheiratete Partner (englisch
  `married`, `divorced`, `separated`, `partners`, `unmarried`, `cohabiting` u. a.). Scheidung und neue Heirat
  desselben Paares ergeben die Notiz „Geschieden …, erneut geheiratet …“. Dasselbe Paar in zwei Familien wird
  verbunden. Ein dritter Partner in einer Familie wird nicht übertragen und gezählt. Eine Familie mit einem Elternteil
  bekommt einen platzhaltenden zweiten Elternteil „?“. Eine Familie ohne Kinder und ohne Elternteil bleibt nur, wenn
  sie etwas aussagt (Heirat, Datum, Quelle, Notiz). Ein Kind, das in mehreren Familien erfasst ist, erscheint bei der
  Herkunftsfamilie; die übrigen kommen in die Notiz („Auch erfasst als adoptiertes Kind von …“). Adoption und
  Pflegschaft werden aus `PEDI` und genauer aus `_FREL` und `_MREL` gelesen. Der Export schreibt `_STAT` nur für
  unverheiratete und getrennte Paare.
- **Bedienung:** Keine; der Stand wird in der Beziehung in der Personenkarte bearbeitet.
- **Gilt seit:** App 3.0.0 (`_STAT`), 1.16.0 (Kind in mehreren Familien), 3.8.0 (weitere Ereignisse des Paares).
- **Ab App 3.22.0:** Gelesen wird auch `_RELATIONSHIP_STATUS`; in 3.21.2 wird es in **Nicht unterstützt**
  gezählt. Die Werte beider Tags werden auch auf Tschechisch, Polnisch und Deutsch erkannt („manželé“, „rozvedeni“,
  „druh a družka“, „rozwiedzeni“, „Lebensgemeinschaft“). Ein unbekannter Wert wird in **Nicht unterstützt** gezählt.
  Hat eine Familie beide Tags, gewinnt `_STAT`.

<!-- zdroj: app:src/ged-parser.ts:1496 resolveUnionStatus, :1545 statusFromStat, :1563 přednost _STAT, :3453 dítě ve více rodinách, :2684 PEDI · app:src/ged-exporter.ts:70 GEDCOM_STAT · strings.ts gedcom.otherFamilyLinks -->

<a id="A2.6"></a>
## A2.6 Quellen, Zitationen und QUAY

Ein Quellendatensatz (`SOUR`) ergibt eine Quelle der App: Titel, Archiv, Signatur, Abschrift (`TEXT`), Link und
Ausschnitte. Eine Zitation bei Geburt und Tod belegt Geburt und Tod der Person, eine Zitation bei der Person die
Person, eine Zitation bei der Familie das Paar. Die Bewertung `QUAY` erscheint als **Zuverlässigkeit der Quelle**: 3
ist **Original**, 2 **Abschrift / Index**, 1 und 0 **Unsicher**.

- **Grenzen:** Ohne `TITL` wird die Abkürzung `ABBR` genommen, sonst „?“. Verlag, Autor und Signatur im Archiv kommen
  in die Notiz der Quelle. Eine Zitation mit einer anderen Seite (`PAGE`) als bei der Quelle erzeugt eine abgeleitete
  Quelle für diese Seite mit demselben Titel und Archiv; Abschrift und Ausschnitte gehen nicht auf sie über. `QUAY`
  des Datensatzes hat Vorrang vor `QUAY` der Zitation, und bei jeder Quelle gilt die erste Zitation. `DATA` und
  `TEXT` innerhalb einer Zitation werden nicht gelesen. Jedes Bild bei einer Quelle ist ein Ausschnitt. Die
  Sicherheit aus einem fremden Programm ändert die App nicht. Wie die Forschung `QUAY` als Form und Information der
  Quelle übernimmt, sagt [R3.2.1](R3-verification-and-citation.md#R3.2.1); wann eine Angabe belegt ist,
  [R3.8](R3-verification-and-citation.md#R3.8). Quellen in der App beschreibt [A3](A3-evidence-in-the-app.md).
- **Bedienung:** **Zuverlässigkeit der Quelle** im Detail der Quelle (**Original**, **Abschrift / Index**,
  **Unsicher**).
- **Gilt seit:** App 1.9.4 (`QUAY`), 3.9.0 (abgeleitete Quelle für eine Seite).
- **Ab App 3.22.0:** Die Geschichte der Person (`_STORY`) liest und exportiert auch Verweise auf Quellen.

<!-- zdroj: app:src/ged-parser.ts:2140–2230 záznam SOUR, :1700 noteQuay, :3010–3055 citace a odvozené prameny, :3099–3140 převod pramenů · app:src/ui/sources.ts:75 qualityLabel · app:src/ged-exporter.ts pushCitation · strings.ts gedcom.quality1–3, gedcom.reliabilityLabel · research:src/sync.ts:4660 QUAY_EVIDENCE -->

<a id="A2.7"></a>
## A2.7 Eigene Tags von Strom und was zurückkommt

Der Export der App schreibt eigene Tags mit dem Präfix `_STROM`, damit beim erneuten Einlesen zurückkommt, was
GEDCOM 5.5.1 nicht kann. Der Kopf `1 SOUR STROM` sagt, dass Strom die Datei geschrieben hat.

- **Grenzen:** Beim Export und erneuten Einlesen kommt zurück: der Ehename (als zweites `NAME` mit
  `TYPE married`), der Name, unter dem die Person bekannt ist, die Stammlinien, Gruppen von Varianten des Nachnamens,
  Fragen und Geschichten der Person, der Stand der Angaben, Art und Fingerabdruck von Bildern, die Prüfung der
  Abschrift (`_STROM_VERIFIED`), die Lesung eines Eintrags, Ausschnitte mit Zuschnitt, Familien ohne Paar
  (`_STROM_NO_COUPLE`), das Verhältnis des Kindes zu den Eltern und Zeugen. Aus dem Export kommt nicht zurück: wer
  die Abschrift gelesen hat (`_STROM_READ`), ein wegen der Größe ausgelassenes Bild und die Ortsdatensätze.
  Forschungsblöcke (Widersprüche, Hypothesen, Suchen, Verbindungen, Inseln, Entwürfe) werden nur aus einer Datei der
  Forschung gelesen, und der Export der App schreibt sie nicht. Eine Datei ohne den Kopf von Strom wird ohne dessen
  Gepflogenheiten gelesen: Beschreibungen anstelle eines Namens kommen in die Notiz ([A2.3](#A2.3)). Zeilen der
  Bindung an die Forschung im Kopf (`_STROM_TREE` u. a.) behandeln S1 und S2.
- **Bedienung:** **Export → GEDCOM exportieren**.
- **Gilt seit:** App 3.9.0 oder früher (einzelne Tags kamen bis 3.19.0 hinzu).
- **Ab App 3.26.0:** Programm-IDs kommen unter `_STROM_IMPORT` und `_STROM_XID` zurück; beim erneuten Einlesen wird
  die Datei danach gepaart ([S6.7](S6-tree-from-another-program.md#S6.7)). Eine Datei mit dem Kopf von Strom ist kein
  Stammbaum aus einem anderen Programm: sie hat weder die Marke **Aus dem Stammbaum** noch die Karte **Wie weiter**.

<!-- zdroj: app:src/ged-exporter.ts:506 STROM_SEX_U_LINE, :508 exportToGedcom, :680 TYPE married · app:src/ged-parser.ts:2174 _STROM_VERIFIED/_STROM_READ, :2324 výzkumné bloky, :2574 _DRAFT, :2654 _STROM_STATUS, :1914 _STROM_PLACE · app:src/research-link.ts:2936 researchHeaderLines -->

<a id="A2.8"></a>
## A2.8 Wiederholter Import und Zusammenführen

Jeder Import als neuer Stammbaum legt einen neuen Stammbaum an; alte Stammbäume ändern sich nicht. **Mit
Vorhandenem zusammenführen** paart die Personen aus der Datei mit den Personen des aktuellen Stammbaums und speichert
das Ergebnis als weiteren neuen Stammbaum ([A8](A8-merging-trees.md)).

- **Grenzen:** den wiederholten Import einer Datei der Forschung in einen Stammbaum der Forschung behandelt
  [S1](S1-connecting-app-and-research.md).
- **Bedienung:** **Import → GEDCOM importieren → Als neuen Stammbaum importieren** oder **Mit Vorhandenem
  zusammenführen**.
- **Gilt seit:** App 1.0.0
- **Ab App 3.26.0:** ein erneut eingelesener Stammbaum desselben Programms wird auch nach der Programm-ID gepaart (Grund
  **Gleiche ID in der Datei**); eine Übereinstimmung von 50–79 wird nur angeboten
  ([S6.7](S6-tree-from-another-program.md#S6.7)).

<!-- zdroj: app:src/merge/ui.ts:1447 TreeManager.createTree · strings.ts treeManager.importAsNewTree, importDialog.mergeExisting -->
