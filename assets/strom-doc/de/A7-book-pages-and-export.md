<a id="A7"></a>
# A7 Buch, Seiten und Export

Was die Strom-App aus dem Stammbaum nach außen gibt (Familienbuch, Seiten, Dateien für die Familie und für andere
Programme) und wie sie dabei lebende Personen schützt. Beschrieben wird die App 3.21.2.

| Ausgabe | Was es ist |
|---|---|
| **Familienbuch** | ein Buch zum Lesen von Anfang an, zum Drucken auf A4 oder zum Speichern als HTML ([A7.4](#A7.4)) |
| **Familienseiten**, **Seiten des Stammbaums** | ein verknüpfter Satz von Seiten der Stammlinien, Familien und Personen ([A7.5](#A7.5)) |
| **Personenseite** | das ganze Leben einer Person, zum Ansehen, Drucken und Speichern als HTML ([A7.6](#A7.6)) |
| **App mit den Daten (HTML)** | eine eigenständige Datei mit der App und dem Stammbaum ([A7.7](#A7.7)) |
| **An Verwandte senden** | eine Datei per E-Mail zum Öffnen, Ergänzen und Zurücksenden |
| **Poster** | die aktuelle Ansicht als SVG, PNG oder mehrseitiges PDF |
| **Datensicherung (JSON)**, **GEDCOM**, **Personentabelle (CSV)** | Daten zum Wiederherstellen und für andere Programme ([A2](A2-loading-a-family-tree.md)) |

<!-- zdroj: app:strings.ts importExport.app, importExport.share, importExport.poster, importExport.book, importExport.backup, importExport.gedcom, importExport.csv · src/ui/import-export.ts -->

<a id="A7.1"></a>
## A7.1 Wer eine lebende Person ist

Der Schutz lebender Personen ([A7.2](#A7.2)) betrifft nur Personen, die die App für lebend hält.

1. Eine als verstorben markierte Person (**Verstorben**) ist verstorben; eine Person, die in den Daten ausdrücklich
   „lebt“ hat, ist lebend.
2. Eine Person mit Sterbedatum ist verstorben.
3. Sonst ist sie lebend, wenn seit ihrem spätestmöglichen Geburtsjahr weniger als 110 Jahre vergangen sind.
4. Eine Person ohne Geburtsjahr und ohne anderen Anhaltspunkt ist lebend (sichere Wahl).

- Das spätestmögliche Geburtsjahr stammt aus den eigenen Daten und Ereignissen der Person, aus der Hochzeit
  (mindestens 14 Jahre davor) und aus den Kindern (ein Elternteil ist mindestens 12 Jahre älter als das Kind, über
  weitere Generationen).
- **Grenzen:** das Zeichen † bei einer Person im Stammbaum folgt einer anderen Regel (vermutlich verstorben nach 120
  Jahren) und steuert den Schutz nicht. Der Tod eines Nachkommen markiert einen Vorfahren nicht von selbst als
  verstorben.
- **Bedienung:** das Kästchen **Verstorben** in der Bearbeitung der Person; beim Hinzufügen eines Verwandten wird es
  von selbst angehakt, wenn Sterbedatum oder Sterbeort ausgefüllt werden.
- **Gilt seit:** App 1.2.0; selbsttätiges Anhaken von Verstorben App 3.21.2

<!-- zdroj: app:src/privacy.ts:215 ASSUMED_MAX_AGE, :217 MIN_PARENT_AGE, :219 MIN_MARRIAGE_AGE, :229 isLivingPerson, inferBirthUpperBounds · presumedDeceasedSet · strings.ts person.deceased · CHANGELOG.cs.md 3.21.2 -->

<a id="A7.2"></a>
## A7.2 Schutz lebender Personen

Vor einer Ausgabe aus dem Stammbaum wird gewählt, wie lebende Personen gezeigt werden. Im Export heißt die Auswahl
**Privatsphäre lebender Personen**, im Familienbuch **Schutz lebender Personen**.

| Auswahl | Name einer lebenden Person |
|---|---|
| **Vollständige Daten** | unverändert, nichts wird verborgen |
| **Initialen + Geburtsjahr** | Initialen von Vor- und Nachname, das Geburtsjahr bleibt; Ehename nur als Initiale |
| **Namen verbergen** | „Lebende Person“, ohne Nachnamen |
| **Nur Nachname behalten** | „Lebende Person“ und Nachname |

- Jede Auswahl außer Vollständige Daten nimmt lebenden Personen alle Daten und Orte, Notizen, Erzählungen, Foto,
  Ereignisse, Zitationen, Anhänge, Namensvarianten, Titel, Ehenamen, offene Frage, REFN und Angaben der Forschung.
  Bei Initialen bleibt das Geburtsjahr.
- Angaben des Paares (Daten, Ort, Notiz, Zeugen, Erzählung, Ereignisse) verschwinden, wenn mindestens einer der
  Partner lebt. Initialen behalten das Anfangsjahr der Partnerschaft.
- **Grenzen:** die Struktur bleibt immer: Personen, Beziehungen und Geschlecht. Verstorbene Personen ändern sich
  nicht.
- **Quellen:** im Export (App mit den Daten, JSON, GEDCOM) lässt jede Auswahl außer Vollständige Daten den Katalog
  der Quellen, die Zitationen und die Anhänge **bei allen Personen, auch verstorbenen** weg (die App schreibt das bei
  der Auswahl dazu). Familienbuch, Seiten und Personenseite nehmen Quellen nur lebenden Personen; eine Quelle, die
  nur bei lebenden Personen zitiert ist, fällt weg.
- **Gilt seit:** App 1.2.0; Quellen Verstorbener im Buch und auf den Seiten App 3.18.0

<!-- zdroj: app:src/privacy.ts applyPrivacy (keepDeceasedSources) · strings.ts privacy.label, privacy.modeFull, privacy.modeInitials, privacy.modeAnonymous, privacy.modeMinimal, privacy.livingPerson, privacy.dropsSources · book.dlg.privacy · CHANGELOG.cs.md 3.18.0 -->

<a id="A7.2.1"></a>
### A7.2.1 Standardschutz je nach Ausgabe

| Ausgabe | Standardauswahl |
|---|---|
| App mit den Daten (HTML) | Initialen + Geburtsjahr |
| GEDCOM | Initialen + Geburtsjahr |
| An Verwandte senden | Initialen + Geburtsjahr |
| Familienbuch | Initialen + Geburtsjahr |
| Personenseite | Vollständige Daten, wenn auf der Seite keine lebende Person ist; sonst die zuletzt gewählte, sonst Initialen |
| Personentabelle (CSV), Alle Stammbäume exportieren | Vollständige Daten |

- **Grenzen:** Familienseiten und Seiten des Stammbaums machen für eine geschützte Person keine eigene Seite und
  keinen Link; im Register steht sie unter dem geschützten Namen. Enthält die Auswahl lebende Personen und ist der
  Schutz ausgeschaltet, weist der Dialog darauf hin, dass die Datei ihre Namen, Daten und Orte trägt.
- **Gilt seit:** App 1.2.0; Personenseite App 3.18.0; Familienbuch App 3.19.0

<!-- zdroj: app:src/ui/import-export.ts (výchozí privacy podle formátu) · src/book-options.ts:55 · src/person-page.ts:94, :104 personPageExportPrivacy · src/family-pages.ts:309 · src/ui/share-ui.ts · strings.ts familyPages.privacyWarn -->

<a id="A7.3"></a>
## A7.3 Inhalt der Datei

Beim Export wird neben dem Schutz der **Inhalt** gewählt: was in die Datei gespeichert wird.

| Vorgabe | Fotos | Anhänge und Quellenausschnitte | Notizen | Quellen und Zitationen |
|---|---|---|---|---|
| **Vollständiges Archiv** | ja | ja | ja | ja |
| **Kleine Datei zum Senden** | nein | nein | ja | ja |
| **Nacktes Gerüst** | nein | nein | nein | nein |

- **Grenzen:** die Struktur des Stammbaums und die Namen bleiben immer. Die Werkstatt der Forschung (Warteschlange,
  Aufgaben, Entwürfe von Erzählungen) kommt nie in den Export. Die Auswahl des Schutzes kann Quellen und Anhänge auch
  beim Vollständigen Archiv weglassen ([A7.2](#A7.2)).
- **Gilt seit:** App 2.4.0

<!-- zdroj: app:src/privacy.ts CONTENT_PRESETS, stripResearchWork · strings.ts privacy.contentLabel, privacy.presetComplete, privacy.presetSmall, privacy.presetSkeleton, privacy.dropsSourcesContent -->

<a id="A7.4"></a>
## A7.4 Familienbuch

Das Familienbuch ist ein Buch zum Lesen von Anfang an: Stammbaum, Familien nach Generationen, Erzählungen und
Quellen.

- **Was ins Buch kommt:** **Ganzer Stammbaum** · **Stammlinien** (eine oder mehrere) · **Vorfahren einer Person** ·
  **Nachkommen einer Person** (Auswahl der Personen [A7.4.1](#A7.4.1)).
- **Teile des Buchs** in dieser Reihenfolge: **Inhalt**, **Stammbaum der Linie**, **Familien** (immer),
  **Erzählungen**, **Lebensgrafik und Zeitleiste**, **Die Zeit (Geschichte)**, **Quellen**, **Ausschnitte und
  Fotos**, **Weitere Familien**, **Personenregister**.
- Ein Teil ohne Inhalt wird ausgelassen, und der Dialog sagt warum: Erzählungen braucht eine Erzählung, die Grafik
  eine andere Detailstufe als die knappe, Die Zeit Geschichte, Quellen zitierte Quellen, Ausschnitte ein Foto oder
  einen Ausschnitt. Weitere Familien gibt es nur im Buch des ganzen Stammbaums.
- **Voreinstellung:** **Für die Familie** (alle Teile, normale Detailstufe, ohne Notizen und Angaben für Forschende)
  · **Für Forschende** (volle Detailstufe, Notizen, Angaben für Forschende: Stand der Belege und Widersprüche,
  [R3.8](R3-verification-and-citation.md#R3.8)) · **Eigene**. Standard ist Ganzer Stammbaum, Für die Familie,
  Initialen + Geburtsjahr und die Sprache der App.
- Der **Titel** entsteht aus der Auswahl (Name des Stammbaums, Stammlinie X, Vorfahren: Name, Nachkommen: Name) und
  lässt sich überschreiben.
- Die **Sprache des Buchs** ändert Überschriften und Beschriftungen; Angaben aus dem Stammbaum werden nicht übersetzt.
- Die Auswahl wird für jeden Stammbaum gespeichert.
- **Bedienung:** Export **Familienbuch**; Fenster des Buchs: Druck auf A4 und **Als HTML speichern**.
- **Gilt seit:** App 3.19.0; Voreinstellung Eigene App 3.21.0

<!-- zdroj: app:src/book-options.ts (části, předvolby, výchozí :55) · strings.ts book.dlg.kind, book.dlg.parts, book.dlg.preset, book.dlg.lang, book.parts, book.unavailable · CHANGELOG.cs.md 3.19.0, 3.21.0 -->

<a id="A7.4.1"></a>
### A7.4.1 Auswahl der Personen für Buch und Seiten

| Auswahl | Personen | Reihenfolge |
|---|---|---|
| Ganzer Stammbaum | alle Personen | nach Geburt |
| Stammlinien | Mitglieder der Stammlinien mit Familien sowie Ehefrauen und Ehemänner der Mitglieder | ein Kapitel je Stammlinie |
| Vorfahren einer Person | Vorfahren bis zur gewählten Zahl der Generationen und die Partnerschaften, aus denen die Mitglieder stammen | Generation für Generation, Vater vor Mutter |
| Nachkommen einer Person | Nachkommen bis zur gewählten Zahl der Generationen über Söhne und Töchter, mit Partnern und allen Partnerschaften | nach Geburt |
| Ausgewählte Personen (nur Seiten) | nur die ausgewählten Personen; eine Familie nur, wenn beide Partner ausgewählt sind | – |

- **Grenzen:** die Linie der Vorfahren und Nachkommen tragen leibliche und Adoptiveltern. Stiefelternteil und
  Pflegeelternteil tragen die Linie nicht. Vater ist der männliche Elternteil, der leibliche vor dem Adoptivvater.
- **Gilt seit:** App 3.19.0; Ausgewählte Personen App 3.21.0

<!-- zdroj: app:src/lineage.ts selection, :279 isDescentLink · strings.ts book.dlg.kind, book.dlg.kindHint -->

<a id="A7.5"></a>
## A7.5 Familienseiten und Seiten des Stammbaums

Die Seiten sind ein verknüpfter Satz von Seiten: Stammlinie, Familien und Personen mit Links untereinander und mit
Registern der Personen, Familien, Nachnamen und Orte.

- **Familienseiten:** eine oder mehrere Stammlinien ([A4](A4-surnames-and-families.md)).
- **Seiten des Stammbaums:** **Seiten für den ganzen Stammbaum** (alle Stammlinien und Weitere Familien),
  **Ausgewählte Personen**, Vorfahren einer Person mit gewählter Zahl der Generationen.
- Schutz lebender Personen und Quellen nach [A7.2](#A7.2); Standard Initialen + Geburtsjahr.
- **Gilt seit:** Familienseiten App 3.20.0; Seiten des Stammbaums App 3.21.0

<!-- zdroj: app:src/family-pages.ts · strings.ts familyPages.menuItem, familyPages.treePages, familyPages.treePagesAction, familyPages.indexTitle · spec 026 · CHANGELOG.cs.md 3.20.0, 3.21.0 -->

<a id="A7.6"></a>
## A7.6 Personenseite

Die **Personenseite** zeigt das ganze Leben einer Person: Daten in Worten, die Familie als kleinen Stammbaum,
Erzählung, Lebensorte auf der Karte, den Lebenslauf mit Geschichte, Ausschnitte aus Kirchenbüchern und Quellen und
den Abschnitt **Für Forschende**.

- **Als HTML speichern** erzeugt eine einzige eigenständige Datei, die sich offline in jedem Browser öffnet. Die
  Gruppen des Inhalts und der Schutz lebender Personen lassen sich wählen ([A7.2.1](#A7.2.1)); die Auswahl wird
  gespeichert.
- **Bedienung:** Angebot der Personenkarte, **Personenseite**; auch aus dem Fächer.
- **Gilt seit:** App 3.18.0

<!-- zdroj: app:src/person-page.ts · strings.ts personPage.save, fan.personPage · CHANGELOG.cs.md 3.18.0 -->

<a id="A7.7"></a>
## A7.7 Gespeichertes HTML (eigenständige Datei)

**App mit den Daten (HTML)** speichert App und Stammbaum in eine einzige Datei, die sich in jedem Browser ohne
Installation öffnet. **Als App exportieren** in **Alle Stammbäume exportieren** legt alle Stammbäume in eine Datei.

- Eine solche Datei hat einen eigenen Speicher im Browser. Mit der App auf stromapp.info wird sie **nicht
  synchronisiert**; Änderungen bewahrt **Datei speichern** (lädt eine Kopie herunter), und in die Web-App kommen sie
  per Import (**Aus HTML-Datei**).
- **Grenzen:** die Datei schützt in der Grundeinstellung lebende Personen (Initialen, [A7.2.1](#A7.2.1)).
- **Gilt seit:** App 1.0.0

<!-- zdroj: app:strings.ts importExport.app, importExport.appDesc, importExport.exportAllApp, importExport.fromHtml, embeddedMode.* · src/ui/import-export.ts -->
