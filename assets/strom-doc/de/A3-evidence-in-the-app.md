<a id="A3"></a>
# A3 Belege in der App

Wie in der App Quellen erfasst werden, wie mit ihnen zitiert wird, wie Ausschnitte und Dateien beigefügt werden und
wo die App selbst zeigt, was fehlt. Beschrieben werden die Strom-App 3.21.2 (und die Forschung 1.25.2); Änderungen aus einer neueren Version tragen deren Nummer. Wie sicher eine Angabe ist und wie die Belegstufe einer Person berechnet
wird, beschreibt [R3.8](R3-verification-and-citation.md#R3.8); der Import von Quellen aus GEDCOM steht in
[A2](A2-loading-a-family-tree.md).

<a id="A3.1"></a>
## A3.1 Eine Quelle ist ein Eintrag

Eine Quelle ist ein konkreter Eintrag: Taufe, Heirat, Tod. Der Stammbaum hat eine einzige Liste von Quellen.
Personen und Angaben verweisen nur auf sie, sodass ein Eintrag mehrere Menschen und mehrere Angaben belegen kann.

- Felder: **Titel** (Pflicht), **Archiv / Einrichtung**, **Signatur / Fundstelle**, **URL**, **Notiz**. Unter
  **Mehr: Transkription, Eintragsdatum, Verlässlichkeit** liegen **Transkription des Eintrags**, **Eintragsdatum**
  und **Verlässlichkeit**. Der Abschnitt ist offen, wenn eines davon ausgefüllt ist.
- **Eintragsdatum** sagt, wann der Eintrag angelegt wurde. Es kann vom Datum des Ereignisses abweichen, z. B. eine
  nachträglich eingetragene Taufe.
- **Verlässlichkeit** hat drei Stufen: **Original**, **Abschrift / Index**, **Unsicher**. Ein zweites Tippen auf die
  gewählte Stufe hebt sie auf. Sie bewertet eine Quelle, nicht eine Angabe. Wie die Forschung sie nimmt, beschreibt
  [R3.2.1](R3-verification-and-citation.md#R3.2.1).
- **Grenzen:** ohne Titel lässt sich eine Quelle nicht speichern („Quellentitel eingeben“). Ein ungültiges
  **Eintragsdatum** wird nicht gespeichert. Der Wert 0 der Verlässlichkeit aus einem GEDCOM-Import erscheint als
  **Unsicher** und bleibt, bis eine andere Stufe gewählt wird. Das Löschen einer Quelle entfernt alle ihre
  Zitationen; die App fragt vorher und sagt, an wie vielen Stellen sie zitiert ist.
- **Bedienung:** **Aktionen → Quellen** (Liste der Quellen des Stammbaums mit der Zahl der Zitationen „n×“, Suche ab
  11 Quellen, Sortierung nach Titel); **Quelle bearbeiten**, **Quelle hinzufügen**. Den Punkt **Quellen** im Menü
  **Aktionen** gibt es nur bei einem bearbeitbaren Stammbaum und nur, wenn schon eine Quelle existiert oder
  **Einstellungen → Personenkarte → Erweiterte Felder** eingeschaltet ist.
- **Gilt seit:** App 1.4.0; **Verlässlichkeit** und **Eintragsdatum** 3.1.0

<!-- zdroj: app:src/types.ts Source · src/ui/sources.ts:214 renderSourcesList, :327 deleteSource, :531 fillSourceEditor, :576 wireSourceEditor, :667 renderQualityControl, :733 saveSourceFromModal · src/ui/tree-management.ts:675 isSourcesMenuOffered · src/settings.ts:320 isAdvancedFields · strings.ts sources.titleHint/fieldTitle/fieldRepository/fieldReference/fieldUrl/fieldNote/more/fieldTranscript/fieldRecordDate/recordDateHint/fieldQuality/quality1-3/titleRequired/citations/deleteConfirm, advanced.settingLabel -->

<a id="A3.1.1"></a>
### A3.1.1 Transkription und Abschrift geprüft

**Transkription des Eintrags** ist der Text des Eintrags, so wie ihn der Benutzer gelesen hat. Bei einem mit der
Forschung verbundenen Stammbaum bestimmt die Einstellung **Meine Quellenabschriften**, wie die Forschung ihn nimmt
([R3.5.1](R3-verification-and-citation.md#R3.5.1)). Der Editor zeigt danach eines von dreien:

- das Kontrollkästchen **Abschrift geprüft**: bei der Einstellung **Hinweis** immer; bei **Beleg** nur bei einer
  Quelle, die vor dem Umschalten gesendet und seitdem nicht geändert wurde, oder bei einer Quelle, die schon
  angehakt ist;
- die Zeile „Gilt als erste Lesung (Stammbaum auf „Beleg“)“: bei **Beleg** und einer neuen oder geänderten Quelle;
- nichts: ein Stammbaum ohne Forschung, eine Quelle ohne Transkription oder eine Transkription, die die Forschung
  selbst gelesen hat.
- Bei einer Transkription, die die Forschung gelesen hat, weist der Editor darauf hin: eine Korrektur wird als
  Lesung des Benutzers gespeichert, und die Forschung vergleicht sie mit dem Bild. Im Quellenbetrachter steht unter
  der Transkription „Abschrift in der App gelesen / von der Forschung gelesen / in der App und von der Forschung
  gelesen“.
- **Grenzen:** das Anhaken ändert nichts am Grad der Sicherheit in der App, es entscheidet die Forschung. Ist das
  Kontrollkästchen nicht zu sehen, bleibt **Abschrift geprüft** nur, wenn sich die Transkription nicht geändert hat.
- **Bedienung:** Editor der Quelle, **Mehr: Transkription, Eintragsdatum, Verlässlichkeit**; in **Aktionen →
  Quellen** der Filter **Abschrift nicht geprüft** (nur bei einem Stammbaum auf **Beleg** mit älteren ungeprüften
  Quellen).
- **Gilt seit:** App 3.9.0
- **Ab App 3.24.0:** die Übersetzung der Transkription, die die Forschung gesendet hat
  ([R3.4](R3-verification-and-citation.md#R3.4)), steht unter der Transkription als zugeklappter Abschnitt
  **Übersetzung der Transkription**: im Quellenbetrachter und auf der Karte der Quelle auf der Seite der Person. Die
  Notiz der Quelle ändert sich dadurch nicht; der Editor der Notiz zeigt sie ganz. Eine Quelle ohne Übersetzung sieht
  aus wie früher.

<!-- zdroj: app:src/research-sync.ts:357 researchReadSource, :365 isOlderSource, :377 verifiedOffer, :385 unverifiedOlderSources · src/ui/sources.ts:618 renderSourceReading, :658 sourceVerifiedValue, :296 renderSourcesFilter, :377 renderSourceViewer · strings.ts sources.verified/verifiedHintGuide/verifiedHintOlder/verifiedByTree/readBy/userReadingNote/filterUnverified · překlad (od 3.24.0): src/source-translation.ts SOURCE_TRANSLATION_LABELS, splitSourceTranslation · strings.ts viewerTranslation, translation · commit c2942b0 -->

<a id="A3.2"></a>
## A3.2 Zitation: was eine Quelle belegt

Eine Zitation sagt, welche Angabe eine Quelle belegt. Zitiert wird zur Person, zu ihrer Geburt und ihrem Tod, zu
einem einzelnen Ereignis der Person, zur Heirat und zu einem gemeinsamen Ereignis des Paares. Aus den Zitationen
berechnet die App die Belegstufe der Person ([R3.8.1](R3-verification-and-citation.md#R3.8.1)).

- Beim Bearbeiten einer Person: Abschnitt **Quellen** (Zitationen zur Person), **+ Quelle** unter dem Feld für
  Geburt und Tod, Zitationen bei jedem Ereignis; bei einer Verbindung **Quelle zitieren (Trauungseintrag…)**. Eine
  Zitation ist ein Etikett mit dem Titel der Quelle; Tippen öffnet den Quellenbetrachter, × entfernt die Zitation
  (**Zitat entfernen**), die Quelle bleibt.
- Außerhalb der Bearbeitung einer Person (Menü der Person **Quellen**, Hervorhebung [A3.7](#A3.7)) erscheint in der
  Auswahl der Quelle **Belegt**: **Person** / **Geburt** / **Tod**. Tod nur bei einer Person mit Tod. Hat die Geburt
  noch keine Quelle, beginnt die Auswahl bei **Geburt**.
- **Grenzen:** eine Zitation hat keinen Grad der Sicherheit. Eine nur an die Person gehängte Quelle belegt die
  Person, nicht die Geburt. Ein schreibgeschützter Stammbaum, ein gesperrter Stammbaum und eine gesperrte Person
  erlauben kein Zitieren. Bei einer Person sind die Abschnitte für Quellen und Anhänge zu sehen, wenn **Erweiterte
  Felder** eingeschaltet ist oder schon etwas ausgefüllt ist.
- **Bedienung:** siehe oben; die Auswahl der Quelle beschreibt [A3.2.1](#A3.2.1).
- **Gilt seit:** App 1.4.0; **Belegt** und **+ Quelle** 3.5.0

<!-- zdroj: app:src/ui/sources.ts:1220 renderSourceChips, :1288-1306 unciteBirthSource…unciteEventSource, :1331 showSourcePickerForPersonId, :1343 showSourcePickerForFact, :1356 renderSourcePickerFact, :1399 showSourcePickerForPartnership · src/ui/person-sources-ui.ts:114 canCiteOnPerson · src/settings.ts:320 · strings.ts sources.sectionTitle/citeAdd/citePartnership/remove/pickerFactLabel/pickerFactPerson, advanced.settingHint -->

<a id="A3.2.1"></a>
### A3.2.1 Auswahl der Quelle

- **Quelle zitieren** öffnet die Auswahl. Gesucht wird in Titel, Archiv, Signatur und Transkription. Quellen, die
  bei derselben Angabe schon zitiert sind, werden nicht angeboten.
- **Zuletzt verwendet**: bis zu 5 Quellen, getrennt für jeden Stammbaum in diesem Browser. Sie erscheinen nur, wenn
  der Stammbaum mehr als 8 Quellen hat und die Suche leer ist.
- **Neue Quelle…** füllt den Titel nach dem vor, was zitiert wird: „Geburt – Marie Vlková, 1865“, „Trauung – Josef
  Horák und Marie Vlková, 1890“. Das Jahr fehlt, wenn es nicht bekannt ist. Die neue Quelle wird sofort zitiert.
- **Andere Seite** bei einer Quelle in der Auswahl: eine neue Quelle mit demselben Titel, Archiv, Link,
  Verlässlichkeit und derselben Notiz; aus der Signatur verschwindet die Seite, aus der Notiz die Zeilen mit der
  Seite und mit dem Eintragsdatum. Nennt der Titel des Buches eine Person aus dem Stammbaum, wird ein Titel nach der
  zitierten Angabe vorgeschlagen.
- **Weiterer Eintrag aus demselben Buch** (Betrachter und Editor der Quelle): eine neue Quelle mit demselben Archiv,
  derselben Signatur und demselben Link; aus dem Etikett einer Zitation geöffnet, wird sie sofort dort zitiert.
- **Gilt seit:** App 3.1.0 (**Zuletzt verwendet**, **Weiterer Eintrag aus demselben Buch**); **Andere Seite** 3.9.0

<!-- zdroj: app:src/ui/sources.ts:1427 renderSourcePickerList, :322 sourceMatches, :1475 currentCitationSourceIds, :1505 noteRecentSource, :1526 otherPageFromPicker, :1554 createSourceFromPicker, :1569 suggestedSourceTitle, :1181 startSameBookEntry · src/settings.ts:12 RECENT_SOURCES_MAX · strings.ts sources.pickTitle/searchPlaceholder/recent/all/createNew/newTitleMarriage/otherPage/otherPageTitle/sameBook -->

<a id="A3.3"></a>
## A3.3 Ausschnitt des Eintrags

Ein Ausschnitt des Eintrags ist ein Bild genau dieses Eintrags, nicht der ganzen Seite. Er erscheint bei der Quelle,
im Betrachter und im Buch.

- Drei Wege: **Aus Zwischenablage einfügen** (Ctrl+V, auf dem Mac ⌘V; der Ausschnitt wird genommen, wie er ist),
  **Bild hochladen** (öffnet den Zuschnitt **Eintrag ausschneiden**) und **Aus Anhang ausschneiden** (Bildanhänge der
  Person, bei einer Heirat beider Partner). Ein Bild lässt sich auch auf das leere Feld ziehen.
- Der Ausschnitt wird als JPEG mit einer längeren Seite von höchstens 1200 px gespeichert. **Beschriftung
  (optional)** bleibt auch nach **Ersetzen**.
- **Auch die ganze Seite als Anhang speichern** im Zuschnitt: die ganze Seite wird der Person als Anhang hinzugefügt
  ([A3.4](#A3.4)). **Zuschneiden** geht dann erneut von der ganzen Seite aus.
- Quellenbetrachter: Ausschnitte (Tippen vergrößert), **Seite im Archiv öffnen ↗** (Link des Ausschnitts, sonst die
  URL der Quelle), **Transkription**, **Belegt** (Liste der Zitationen); ohne Ausschnitt **Ausschnitt hinzufügen**.
  Bei einem Ausschnitt, den die Forschung erstellt hat, gibt es **Volle Qualität**: öffnet den Ausschnitt aus dem
  Originalscan in der Forschung.
- **Grenzen:** in der App lassen sich höchstens zwei Ausschnitte hinzufügen (der Eintrag und die Fortsetzung von der
  nächsten Seite). Die Forschung erfasst bis zu drei ([R3.4](R3-verification-and-citation.md#R3.4)); einen dritten
  behält die App, weitere fügt sie nicht hinzu. Die ganze Seite lässt sich nur bei einer Person speichern, nicht bei
  einer Heirat und nicht bei einer gesperrten Person. Drehen im Zuschnitt hebt die Bindung des Ausschnitts an den
  Anhang auf. Bilder, die die Forschung nicht an die App gesendet hat, stehen im Filter **Bild nur in der Forschung ·
  N** ([A3.8](#A3.8)).
- **Bedienung:** Editor der Quelle, Block **Ausschnitt des Eintrags**; **+ Fortsetzung von der nächsten Seite
  hinzufügen**; **Zuschneiden**, **Ersetzen**, **Ausschnitt entfernen**. „Ausschnitte: …“ in **Aktionen → Quellen**
  zeigt die Größe aller Ausschnitte ab 1 MB.
- **Gilt seit:** App 3.1.0; **Volle Qualität** 3.4.0; Bilder aus der Forschung 3.14.0 ([A3.8](#A3.8))

<!-- zdroj: app:src/types.ts:257 MAX_EXCERPTS_UI · src/excerpts.ts:12-14 EXCERPT_MAX_SIDE, EXCERPT_QUALITY · src/ui/sources.ts:853 renderExcerptBlock, :932 excerptAdderHtml, :999 addExcerptFromPaste, :1017 addExcerptFromUpload, :1047 recropExcerpt, :1099 addExcerptFromAttachment, :1121 putExcerptDraft, :1158 keepPagePersonId, :1165 excerptContextPages, :377 renderSourceViewer · src/ui/research-ui.ts:2263 excerptResearchUrl · strings.ts sources.excerpt*/viewer*/addExcerpt/excerptsTotal, crop.title/keepPage, research.fullQuality/fullQualityTitle, researchImages.filter -->

<a id="A3.4"></a>
## A3.4 Anhänge

Ein Anhang ist eine Datei bei einer Person: der Scan einer Seite, ein Dokument, das Foto einer Urkunde. Ein Anhang
belegt für sich nichts; der Beleg ist die Zitation einer Quelle ([A3.2](#A3.2)). Aus einem Bildanhang lässt sich ein
Ausschnitt des Eintrags ausschneiden ([A3.3](#A3.3)).

- JPG und PNG werden auf ein JPEG mit einer längeren Seite von höchstens 1600 px verkleinert. PDF bleibt, wie es
  ist, bis 2 MB. Andere Typen lehnt die App ab („Nicht unterstützter Dateityp. Erlaubt sind JPG, PNG oder PDF.“).
- Zu einem Anhang lässt sich eine **Notiz (optional)** schreiben. Ein PDF öffnet sich in einem neuen Tab.
- Unter den Anhängen steht eine Summe: „Bei dieser Person: Foto …, n Anhänge …, n Ausschnitte aus Quellen …“.
- **Grenzen:** bei einem mit der Forschung verbundenen Stammbaum, dessen Forschung Originale annimmt, lassen sich
  auch TIFF, HEIC und PDF über 2 MB hinzufügen. Im Stammbaum steht dann nur ein Eintrag ohne Vorschau („die Vorschau
  erstellt die Forschung“), und die Datei bekommt nur die Forschung. Läuft die Forschung nicht, nimmt die App eine
  solche Datei nicht an. Medien über 10 MB verlangsamen das Speichern; der **Stammbaum-Überblick** weist darauf hin.
- **Bedienung:** Bearbeiten der Person, Abschnitt **Anhänge** → **Anhang hinzufügen**; der Abschnitt ist mit
  **Erweiterte Felder** zu sehen oder wenn die Person Anhänge hat.
- **Gilt seit:** App 1.4.0; TIFF, HEIC und große PDF für die Forschung 3.9.0

<!-- zdroj: app:src/attachments.ts:12-18 ATTACHMENT_MAX_SIDE, ATTACHMENT_QUALITY, MAX_PDF_BYTES, ATTACHMENT_WARN_BYTES · src/ui/attachments-ui.ts:28-31 ORIGINAL_ONLY_TYPES/needsOriginalOnly, :161 accept, :211 addAttachmentFile · strings.ts attachments.*, media.originalOnlyMeta/originalOnlyNeedsResearch, treeOverview.mediaWarning -->

<a id="A3.4.1"></a>
### A3.4.1 Originale für die Forschung

Bei einem mit der Forschung verbundenen Stammbaum merkt sich die App bei jedem Bild und PDF den Fingerabdruck des
Originals, noch bevor sie die Datei verkleinert. Das Original in voller Qualität sendet sie an die Forschung; im
Stammbaum bleibt eine Vorschau. Die Forschung speichert es bei der Person, gegebenenfalls bei der Quelle und an der
Stelle des Ausschnitts.

- Stand beim Anhang: „Original wartet auf das Senden an die Forschung“, „Das Original ist in der Forschung“, „nur
  Vorschau“ mit Grund, „Das Original ist nicht mehr in der Forschung“.
- Läuft die Forschung nicht, warten die Originale in diesem Browser, höchstens 2 GB und höchstens 30 % des Platzes
  des Browsers. Sie sind nicht im Stammbaum, in Sicherungen oder im Export. Die App weist darauf hin, wenn sie 3 Tage
  warten oder wenn der Platz fast voll ist.
- **Volle Qualität** beim Anhang öffnet das Original direkt in der App, wenn die Forschung läuft und die Datei ein
  JPEG, PNG, WebP oder PDF bis 50 MB ist; sonst in der Forschung.
- Löschen eines Anhangs mit wartendem Original: das Original lässt sich verwerfen oder senden; die Forschung trennt
  es dann mit dem Vermerk „in der App entfernt“.
- **Grenzen:** nur auf dem Computer und nur bei einer Forschung, die Originale annimmt. Ein verschlüsselter
  Stammbaum lässt das Original nicht im Browser warten: er sendet es direkt an die laufende Forschung, sonst bleibt
  nur die Vorschau. Safari sendet keine Originale.
- **Bedienung:** **Forschung für diesen Stammbaum → Originaldateien senden** (ausgeschaltet nur Vorschauen);
  **Einstellungen → Daten und Datenschutz → Originale, die auf die Forschung warten** (nur wenn etwas wartet;
  einzeln und alle verwerfen). Das Senden ausführlicher in [S2](S2-edits-from-the-app.md).
- **Gilt seit:** App 3.9.0

<!-- zdroj: app:src/originals.ts:19-21 ORIGINALS_MAX_BYTES, ORIGINALS_QUOTA_SHARE, :60 originalsBudget · src/ui/originals-ui.ts:68 FULL_QUALITY_MAX_BYTES, :231 researchOriginalsLink, :241 prepareOriginal, :261 queueOriginal, :320 researchMediaAccepts, :358 fullQualityMode, :479 originalsQueueWarn · src/ui/research-tree-settings-ui.ts:232, :386 sendMedia · strings.ts media.*, mediaQueue.*, researchTree.originals/originalsDesc, research.fullQualityAppTitle -->

<a id="A3.5"></a>
## A3.5 Materialien

Material ist eine Datei, die an die Forschung zu einer Person oder zu einer Quelle gesendet wird: ein Brief, ein
Foto, eine Kopie aus dem Archiv. Dem Stammbaum wird nichts hinzugefügt. Die Forschung speichert die Dateien und
macht aus ihnen eine Aufgabe für den Agenten.

- **Material senden…** (bei einer Person) und **Material zur Quelle senden…** (Betrachter und Editor der Quelle):
  höchstens 20 Dateien auf einmal und **Notiz für die Forschung**. Einen ganzen Ordner sendet **Materialien
  hinzufügen…** im Menü der Forschung ([S4](S4-research-from-the-app.md)).
- **Auch als Anhang im Stammbaum hinzufügen** (nur bei einer Person): im Stammbaum entsteht auch eine Vorschau wie
  bei einem Anhang.
- Läuft die Forschung nicht, warten die Dateien im Browser. Kennt die Forschung die Person noch nicht, werden sie
  nach dem nächsten Senden des Stammbaums gesendet.
- Der Abschnitt **Materialien** beim Bearbeiten der Person, **Materialien** im Menü der Person und das Fenster
  **Alle Materialien ›** zeigen Anhänge des Stammbaums und Dateien der Forschung zusammen. Dieselbe Datei erscheint
  einmal.
- **Grenzen:** nur auf dem Computer, bei einem mit der Forschung verbundenen Stammbaum, dessen Forschung Originale
  annimmt. Die Forschung nimmt nie Programme, Schlüssel, Archive oder Stammbaumdateien (GEDCOM) an. Zuordnen und
  Ausblenden von Material geht nur bei laufender Forschung. Bei einem Strom-Archiv wird das Material im Archiv
  gespeichert; **Auch im Stammbaum speichern** fügt Bilder und PDF bis 2 MB auch dem Stammbaum hinzu.
- **Bedienung:** siehe oben.
- **Gilt seit:** App 3.9.0; Abschnitt und Fenster **Materialien** 3.16.0

<!-- zdroj: app:src/ui/material-ui.ts:30-33 MATERIAL_MAX_FILES, MATERIAL_NOTE_MAX, REFUSED_EXT, :38 materialAccepted, :51 alsoTreeEligible, :71 materialAvailable · src/materials.ts:477 personMaterials, :519-529 gates · src/ui/originals-ui.ts:269 · src/ui/research-actions-ui.ts:357 batch · strings.ts material.*, materials.*, batch.menu -->

<a id="A3.6"></a>
## A3.6 Quellen einer Person

Das Menü der Person **Quellen** zeigt alle Quellen der Person an einem Ort, ohne die Bearbeitung zu öffnen: zitiert
zur Person, zu Geburt und Tod, zu Ereignissen, zu Heiraten und zu gemeinsamen Ereignissen von Paaren.

- Eine Zeile je Quelle, darunter, was sie belegt: „Person“, „Geburt 1865“, „Trauung 1890“… Die Zeile zeigt auch
  die Verlässlichkeit.
- Reihenfolge: nach dem ältesten Jahr dessen, was die Quelle belegt, sonst nach **Eintragsdatum**; ohne Datum am
  Ende, dann nach Titel.
- **Quelle zitieren** öffnet die Auswahl mit **Belegt** ([A3.2](#A3.2)).
- **Quelle in der Forschung finden**: nur bei einer Person ohne Quelle, die die Forschung kennt, und nur bei einer
  Forschung mit Agent. Öffnet das Terminal der Forschung mit einer Revision der Person.
- **Grenzen:** bei einem schreibgeschützten oder gesperrten Stammbaum steht der Punkt nur im Menü, wenn die Person
  eine Quelle hat. Die Zahl der Quellen steht beim Menüpunkt.
- **Bedienung:** Menü der Person (Klick auf die Karte) → **Quellen**.
- **Ab App 3.22.0:** die Quellen einer Erzählung stehen bei der Erzählung selbst. Unter dem Text der Erzählung ist
  ein einziger eingeklappter Abschnitt **Grundlage des Textes (N)**, wobei N die Zahl der Quellen ist:
  - **Quellen**: jede Quelle einmal. Zuerst die Quellen, auf die die Erzählung selbst verweist, dann die Quellen, die
    ihre Angaben zitieren. Eine Quelle mit Webadresse ist ein Link, der sich in einem neuen Fenster öffnet;
  - **Fakten**: die Angaben, auf denen der Text beruht, lesbar („Tod 25. 9. 1857, Lhota“), ohne Kennungen der
    Forschung;
  - **Anmerkung des Autors**, wenn die Erzählung eine hat.
- Der Abschnitt steht im Fenster **Erzählung**, auf der Personenseite, im Vergleich der Fassungen einer Erzählung und
  (nur lesbar) beim Bearbeiten der Person. Die Kennung einer Quelle im Text (`[S0164]`) erscheint als Titel der Quelle
  in Klammern, wenn der Stammbaum sie hat. Die Personenseite führt eine Quelle der Erzählung auch unter ihren Quellen
  auf, mit **Erzählung** oder **Geschichte der Ehe** als dem, was sie belegt. Das Menü **Quellen** führt die Quellen
  der Erzählung nicht auf.
- **Grenzen:** im Druck und im Familienbuch steht unter dem Text nichts; die Quellen der Erzählung sind im Buch
  nummeriert im Verzeichnis der Quellen. Wie die Forschung die Quellen einer Erzählung hält:
  [R3.9](R3-verification-and-citation.md#R3.9).
- **Gilt seit:** App 3.3.0; **Quelle in der Forschung finden** 3.19.0; **Grundlage des Textes** 3.22.0

<!-- zdroj: app:src/person-sources.ts:54 personSourceRows · src/ui/person-sources-ui.ts:114 canCiteOnPerson, :120 showPersonSourcesDialog, :187 find hidden · src/ui/context-menu.ts:191-203 readItems · src/ui/research-actions-ui.ts:1173 personFindSourceUrl · strings.ts personSources.*, research.findSource · src/story-sources.ts storyBasisSourceIds, storyFactText, storyBasisDetailsHtml · src/ui/person-page.ts:1738 storyBasisHtml · strings.ts storyBasis, basisSources, basisFacts, authorNote · CHANGELOG.cs.md 3.22.0 -->

<a id="A3.7"></a>
## A3.7 Wo Belege fehlen

**Stammbaum-Überblick → Datenqualität → Wo Belege fehlen** listet Gruppen von Menschen auf, denen eine Quelle oder
die Eltern fehlen. Die Schaltfläche **Im Baum zeigen** hebt sie im Stammbaum hervor und führt einen nach dem anderen
durch sie. Eine leere Gruppe wird nicht aufgeführt.

- **Personen ohne Quelle**: im ganzen Stammbaum („n von N“).
- **Geburten ohne Quelle**: Vorfahren der gewählten Person („n von N Vorfahren“). Bei einem Stammbaum mit Forschung
  stattdessen **Geburten in der Forschung nicht bewiesen**: Geburten der Vorfahren, die nicht Belegt sind.
- **Linienenden**: Menschen ohne Eltern, die Vorfahren der gewählten Person sind oder Kinder haben und nicht
  eingeheiratet sind.
- Wenn nichts fehlt: „Alle haben eine Quelle und Eltern.“ Die Zeile **Belege im Baum (● ◐ ○ auf Karten)** stellt
  die Karten auf die Zeichen der Belegstufe um ([R3.8.1](R3-verification-and-citation.md#R3.8.1)).
- Bei der Hervorhebung: **Nächste Person ›**, **Zitieren** (bei den Gruppen ohne Quelle) und × **Hervorhebung
  beenden**. Die Reihenfolge ist nach Generation, dann nach Name. Am Ende: „Fertig, niemand mehr in dieser Auswahl.“
- **Grenzen:** bei einer Geburt, die die Forschung bewertet, steht statt **Zitieren** die Schaltfläche **Quellen**.
  Eine weitere Zitation belegt die Angabe nicht; es entscheidet die Forschung. **Zitieren** fehlt bei einem
  schreibgeschützten Stammbaum und bei einer gesperrten Person. Die Prüfung des Stammbaums als Ganzes beschreibt
  [A5](A5-tree-check.md).
- **Bedienung:** **Stammbaum-Überblick → Datenqualität → Wo Belege fehlen → Im Baum zeigen** (aus einem anderen
  Stammbaum **Stammbaum öffnen und zeigen**).
- **Gilt seit:** App 3.4.0; **Geburten in der Forschung nicht bewiesen** und **Quellen** statt **Zitieren** 3.13.1

<!-- zdroj: app:src/stats.ts:185-240 computeEvidenceGaps · src/ui/evidence-ui.ts:81 walkOrder, :325-358 pill · src/tree-overview.ts:215 birthResearchStatus · src/ui/tree-overview.ts:1946-1975 · strings.ts treeOverview.evidenceTitle/evNoSource/evBirthNoSource/evBirthUnproven/evLineEnds/evOfTotal/evOfAncestors/evAllGood/evLevels, treeHealth.citeAction/sourcesAction/next/highlightDone/highlightEnd -->

<a id="A3.8"></a>
## A3.8 Bild nur in der Forschung

Ein Bild nur in der Forschung ist ein Scan oder Ausschnitt einer Quelle, der in der Forschung auf dem Computer
gespeichert ist und den die App noch nicht hat. Die Quelle ist auch ohne ihn in der App; das Bild erscheint nach dem
Laden aus der Forschung, die auf diesem Computer läuft.

- **Warum das Bild nicht in der App ist:** bei der Quelle steht der Grund: das Bild kam wegen der Einstellungen der
  Forschung oder der Größengrenze nicht in die App, oder es wird in der Forschung noch vorbereitet und kommt mit der
  nächsten Version. Die Forschung gibt Bilder nach ihren Einstellungen und ihrer Größengrenze in die Datei für die App.
- **Wo es zu sehen ist:** in **Quellen** der Filter **Bild nur in der Forschung · N** mit der Marke *Bild nur in der
  Forschung* bei der Quelle und einer Zeile unter dem Filter („N Bilder zu M Quellen sind nur in der Forschung auf
  diesem Computer gespeichert; in der App erscheinen sie nach dem Laden.“); im Menü **Forschung** die Zeile **Bilder nur
  in der Forschung · N**, die **Quellen** mit dem Filter öffnet und den Fortschritt des Ladens zeigt.
- **Laden:**
  - **Bild aus der Forschung laden** bei einer Quelle lädt ihre Bilder;
  - **Alle aus der Forschung laden…** zeigt zuerst die Zahl der Quellen und Bilder, die Größe („Die Bilder werden beim
    Stammbaum in diesem Browser gespeichert.“), wie viele Bilder die Forschung erst vorbereitet, und den freien Platz
    im Browser. Dann den Fortschritt mit **Pause** und **Anhalten**; das Fenster lässt sich schließen, und das Laden
    läuft weiter. Nicht Geladenes bleibt im Filter;
  - geladene Bilder bleiben beim Stammbaum in diesem Browser, getrennt von den Daten des Stammbaums.
- **Grenzen:**
  - laden geht nur aus einer Forschung, die auf diesem Computer läuft („Es wird geladen, sobald die Forschung auf
    diesem Computer läuft.“). Auf dem Telefon oder einem anderen Gerät: „Das Bild ist in der Forschung auf dem
    Computer. Auf diesem Gerät ist es, wenn der Stammbaum mit Bildern aus der Forschung übertragen wird.“;
  - **Aus der App entfernen** entfernt die Bilder wieder aus dem Browser; sie bleiben in der Forschung und lassen sich
    erneut laden. Bilder, die mit der Datei der Forschung kamen, bleiben;
  - **Bild einer Quelle beim Öffnen laden** lädt nur die geöffnete Quelle und nur,
    wenn die Forschung auf diesem Computer läuft; die Quellenliste lädt nichts von selbst;
  - der Export bietet **Quellenbilder**: **Ohne Quellenbilder**, **Nur die in der App** oder **Alle aus der Forschung** (vor dem Export
    geladen, nur wenn die Forschung auf diesem Computer läuft).
- **Bedienung:** App: **Quellen** → Filter **Bild nur in der Forschung** → **Alle aus der Forschung laden…**; bei einer
  Quelle **Bild aus der Forschung laden**, **Weitere Optionen → Aus der App entfernen**; **Einstellungen →
  Quellenbilder** (**Bild einer Quelle beim Öffnen laden**, **Aus der App entfernen…**, **Alle laden…**); **Forschung → Bilder nur in der Forschung · N**.
- **Gilt seit:** App 3.14.0 mit Forschung 1.18.0
- **Ab App 3.25.0:** Filter und Marke heißen **Bild nur in der Forschung** (früher **Bild in der Forschung**), die
  Zeile unter dem Filter sagt, wo die Bilder sind, und **?** öffnet diese Regel.

<!-- zdroj: app:src/strings.ts researchImages.* (held.scope/limit/later, heldTag, filter, bulkLine, bulkLoad, bulkSummary, bulkReady, bulkSpace, bulkCanClose, bulkLeft, menuRow, removeFromApp(Note), heldBridgeOff, heldDevice, settings.section/auto/autoDesc/remove/loadAll/removeKeep, export.legend/none/app/all/allOff) · src/help/topics.ts imagesHeld · CHANGELOG.cs.md 3.14.0, 3.25.0 · commit 68b31a48 -->
