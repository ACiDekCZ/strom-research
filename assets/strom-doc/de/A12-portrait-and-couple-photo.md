<a id="A12"></a>
# A12 Porträt und Paarfoto

Das Porträt einer Person ist ein aus einem Foto ausgeschnittenes Quadrat. Der Ausschnitt wird in einem Editor über
dem ganzen Foto gewählt und lässt sich jederzeit ändern, weil das ganze Foto als Anhang bei der Person bleibt. Ein Paar
kann ein eigenes **Paarfoto** haben (Hochzeitsfoto oder gemeinsames Foto) und daraus die Porträts beider Partner.
Das Kapitel beschreibt die Strom-App 3.30.0. Änderungen aus einer neueren Version tragen deren Nummer.

<!-- zdroj: dirigent:spec/107-vyrez-portretu (K1.1–K2.3) · app:59b9dde9..6a00396f (dirigent:prace/1116-app-107-vyrez) · app:docs/ZADANI_DEV_vyrez-portretu.md §1–§10, rozhodnutí D1–D12 · app:src/photo.ts, src/portrait-editor-model.ts, src/ui/portrait-editor.ts · app:CHANGELOG.cs.md 3.30.0 -->

<a id="A12.1"></a>
## A12.1 Der Editor für den Porträtausschnitt

Ein bei der Bearbeitung der Person gewähltes Foto öffnet sich im Editor **Porträtausschnitt**. Ein Rahmen in der Form
des Fotos auf der Karte steht fest, und das Foto wird darunter verschoben, vergrößert und gedreht.

- **Im Editor:**
  - **Verschieben** durch Ziehen des Fotos; das Verschieben hält an, bevor im Rahmen eine leere Stelle bliebe;
  - **Vergrößerung** von 100 % (der Rahmen deckt die kürzere Seite des Fotos) bis höchstens 800 %; der Ausschnitt hat
    immer mindestens 128 px des ursprünglichen Fotos, sodass sich ein kleines Foto weniger vergrößert (höchstens auf
    das Doppelte der tatsächlichen Auflösung); **Standard** stellt den anfänglichen Ausschnitt wieder her: das größte
    Quadrat aus der Mitte;
  - **Drehen** um 90° nach links und nach rechts;
  - **Begradigen** um höchstens 45° nach beiden Seiten in Schritten von 0,5°, mit einem Raster über dem Rahmen beim
    Ziehen; das Foto vergrößert sich dabei, damit im Rahmen keine leere Ecke bleibt;
  - **Spiegeln**;
  - **Vorschau**: die Karte der Person mit Form und Größe des Fotos aus den Einstellungen
    ([A6.1.4](A6-views.md#A6.1.4)), das Quadrat aus **Personenseite** und der Ausschnitt 4 : 5 aus
    **Familienseiten**. Der Satz unter der Vorschau: „Auf der Karte ein Kreis, gespeichert wird das ganze Quadrat.“
    (beim abgerundeten Quadrat „Auf der Karte ein abgerundetes Quadrat, gespeichert wird das ganze Quadrat.“).
- **Fertig** gibt das Porträt an die Bearbeitung der Person zurück; gespeichert wird es erst mit deren **Speichern**.
  **Abbrechen** (auch Escape) lässt die Bearbeitung der Person, wie sie war, und die Datei wird nicht verwendet. Eine
  ohne Speichern geschlossene Bearbeitung der Person hinterlässt nichts, weder das Porträt noch das Original.
- Das gespeicherte Porträt ist ein Quadrat von 256 × 256 px im Format JPEG. Transparente Stellen (PNG) bekommen einen
  weißen Hintergrund, aus einem GIF wird das erste Bild genommen. Kreis oder abgerundetes Quadrat sind nur die Form
  auf der Karte: gespeichert wird das ganze Quadrat.
- Ein Porträt aus einer neuen Datei, an dem im Editor nichts geändert wurde, ist bytegleich mit einem Porträt vor App
  3.30.0. Das Original wird trotzdem gespeichert ([A12.2](#A12.2)).
- Deckt der Ausschnitt weniger als 256 px des ursprünglichen Fotos, sagt der Editor einmal „Das Foto ist klein, das
  Porträt kann unscharf sein.“
- **Grenzen:**
  - in einem schreibgeschützten Stammbaum (exportierte HTML-Seite, verfolgter Stammbaum, von einer neueren Version der
    App gespeicherter Stammbaum, Vorschau einer Version) und bei einer gesperrten Person ändert sich das Porträt
    nicht: **Ausschnitt bearbeiten**, **Porträtausschnitt bearbeiten**, **Als Porträt…** und **Als Porträt
    verwenden…** fehlen oder öffnen nichts; das Porträt wird nur gezeigt;
  - eine während der Bearbeitung gelöschte Person (in einem anderen Fenster, beim Laden aus der Forschung) bekommt
    nichts: „Die Person ist nicht mehr im Stammbaum, nichts wurde gespeichert.“;
  - eine Datei, die kein Bild ist oder sich nicht lesen lässt, öffnet der Editor nicht; die App sagt es wie bisher.
- **Bedienung:** Bearbeitung der Person, **Foto auswählen** beim Foto. Auf dem Telefon (bis 640 px) füllt der Editor
  den ganzen Bildschirm: Vorschau der Karte, der Umschalter **Vergrößerung** | **Begradigen** mit einem Schieberegler
  und darunter ↺ ↻ und **Spiegeln**.
- **Gilt seit:** App 3.30.0; die Schaltflächen zum Drehen des Fotos in der Bearbeitung der Person sind seit 3.30.0 im
  Editor.
- **Ab App 3.31.0:** **Foto auswählen** öffnet bei einer Person, die Fotos zum Anbieten hat, zuerst die Auswahl
  **Porträt aus einem Foto** ([A12.2](#A12.2)); eine Datei vom Computer gibt darin **Vom Computer…** (bei Berührung
  **Von diesem Gerät…**). Eine neue Person und eine Person ohne solche Fotos bekommen die Dateiauswahl wie bisher.

<!-- zdroj: app:327d9734 src/ui/portrait-editor.ts (rámeček, posun, kolečko, dva prsty, ↺ ↻, narovnání s mřížkou, Zrcadlit, náhled karty / Stránka osoby / Rodinné stránky, telefon), src/photo.ts PHOTO_SIZE 256, PORTRAIT_MIN_SOURCE_PX 128, PORTRAIT_MAX_ANGLE 45, PORTRAIT_ANGLE_STEP 0.5, minZoomForAngle, cropToJpeg (bílý podklad) · src/portrait-editor-model.ts isIdentityPortrait (Hotovo beze změny z nového souboru = compressPhoto), isSmallPortrait · app:88859da2 src/ui/person-modal.ts handlePhotoInput → editor, Zrušit/Escape nechá dialog, dialog zavřený bez Uložit nic nenechá, #photo-rotate-left/right odstraněny · app:a2af453a jen ke čtení / zamčená osoba, personGone · app:ef688950 dlouhá jména, telefon na šířku · strings.ts portrait.title, preview, personPage, familyPages, savedCircle, savedRounded, rotate, straighten, zoom, reset, mirror, small, personGone · ZADANI_DEV §1, §9, §10 · 3.31.0: app:c6fbb3ff src/ui/person-modal.ts choosePersonPhoto (#photo-choose-btn; bez currentId → #input-photo), src/ui/portrait-picker-ui.ts openPortraitPicker (prázdný model → portraitPickFile), portraitPickerHtml (fromComputer / fromDevice) · strings.ts labels.photoChoose, portrait.pickTitle, fromComputer, fromDevice · dirigent:prace/1122-app-portret-dev · app:docs/ZADANI_DEV_portret-z-materialu.md §1.2, §1.3 -->

<a id="A12.1.1"></a>
### A12.1.1 Tastatur, Maus und Touch im Editor

| Eingabe | Was sie tut |
|---|---|
| Ziehen des Fotos (Maus, ein Finger) | Verschieben |
| Mausrad | Vergrößerung um den Zeiger (× 1,15 je Schritt) |
| zwei Finger | Vergrößerung um die Mitte der Finger; Drehen mit zwei Fingern gibt es nicht |
| Doppelklick oder Doppeltippen auf das Foto, Taste `0`, **Standard** | anfänglicher Ausschnitt des Schritts |
| Doppelklick auf den Schieberegler **Begradigen** | 0° |
| ← → ↑ ↓ (Fokus auf dem Rahmen) | Verschieben um 1 % der Seite des Ausschnitts, mit Shift um 10 % |
| `+` `=` `−` | Vergrößern und Verkleinern um 10 % |
| `[` `]` | Drehen um 90° nach links und nach rechts |
| Schieberegler **Begradigen** ← → | ± 0,5°, mit Shift ± 5°, Pos1 und Ende ± 45° |
| Enter | **Fertig**; im ersten von zwei Schritten **Weiter** ([A12.5](#A12.5)) |
| Escape | **Abbrechen**: schließt nur den Editor, die Bearbeitung der Person darunter bleibt offen |

- Der Rahmen bekommt nach dem Öffnen den Fokus. Ein Bildschirmleser sagt Vergrößerung und Begradigung an
  („Vergrößerung 290 %“, „Begradigung −2,5°“), 300 ms nach der letzten Änderung. Tab geht durch den Editor und
  verlässt ihn nicht.
- **Grenzen:** auf dem Computer steht in der Fußzeile ein Hinweis auf die Tasten, auf Telefon und Tablet nicht. Der
  anfängliche Ausschnitt ist bei einem einzelnen Porträt die Mitte des Fotos, bei einem Porträt aus dem Paarfoto die
  Hälfte des Partners ([A12.5](#A12.5)).
- **Bedienung:** wie in der Tabelle.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:327d9734 src/ui/portrait-editor.ts ZOOM_STEP 1.1, WHEEL_STEP 1.15, šipky 1 % / Shift 10 %, [ ], Enter, Escape ve fázi capture, live hlášení po 300 ms, past fokusu · app:4cea7fbd Výchozí / 0 / dvojklik = úvodní výřez kroku · strings.ts portrait.keys, frameAria, liveZoom, liveAngle, straightenHint · ZADANI_DEV §3 -->

<a id="A12.2"></a>
## A12.2 Das Original und die Markierung Porträt

Ein Porträt merkt sich, aus welchem Foto und wie es ausgeschnitten wurde. Das ganze Foto bleibt als Anhang mit der
Markierung **Porträt** bei der Person, und der Ausschnitt lässt sich deshalb jederzeit ohne Verlust an Schärfe
ändern.

- **Original aus einer neuen Datei:** nach **Fertig** und **Speichern** bekommt die Person einen Anhang mit dem ganzen
  Foto (JPEG, längere Seite höchstens 1600 px, ohne Drehung und Spiegelung, Name nach der Datei). Er zählt zur Summe
  der Anhänge der Person ([A3.4](A3-evidence-in-the-app.md#A3.4)).
- **Die Markierung Porträt** steht beim Anhang, aus dem das Porträt stammt, in der Bearbeitung der Person, in den
  Materialien der Person und im Panel des Betrachters (Hinweis „Aus diesem Foto stammt das Porträt der Person.“). In
  der Bearbeitung der Person wechselt die Markierung sofort mit dem Porträt, noch vor **Speichern**.
- **Porträt aus einem Foto, das die Person schon hat:** **Als Porträt…** in der Zeile eines Bildanhangs (vor dem
  Papierkorb), **Als Porträt verwenden…** im Menü ⋯ der Materialien der Person und im Panel des Betrachters (vor **Aus dem Stammbaum entfernen…**). Der Editor öffnet sich über diesem Anhang; ein neuer Anhang
  entsteht nicht. Aus der Bearbeitung der Person wird das Ergebnis mit **Speichern** gespeichert, von anderswo sofort:
  „Porträt von {Name} ersetzt.“ mit **Rückgängig**. Die Forschung muss dafür nicht laufen.
- **Die Person hat schon ein Porträt:** der Editor zeigt „Die Person hat schon ein Porträt. Fertig ersetzt es, das
  lässt sich rückgängig machen.“ und die Vorschauen **Bisher** → **Neu**.
- **Löschen des Anhangs, aus dem das Porträt stammt:** die Bestätigung sagt „Das ist die Quelle des Porträts. Das
  Porträt bleibt, sein Ausschnitt lässt sich danach nur noch innerhalb des fertigen Quadrats ändern.“ Das Porträt
  bleibt ohne Verknüpfung.
- **Entfernen** beim Porträt in der Bearbeitung der Person löscht das Porträt und seine Verknüpfung; der Anhang bleibt
  ohne Markierung.
- **Grenzen:** der Menüpunkt **Als Porträt…** steht nur bei einem Bildanhang mit Vorschau (nicht bei PDF und nicht bei
  einer Datei, die nur die Forschung hält, [A3.4](A3-evidence-in-the-app.md#A3.4)) und nur bei einem Anhang, der noch
  nicht Quelle des Porträts ist. Bei einer gesperrten Person und in einem schreibgeschützten Stammbaum fehlt er.
  Porträts zweier Personen aus einem Foto macht das Paarfoto ([A12.5](#A12.5)).
- **Bedienung:** Bearbeitung der Person, Abschnitt des Fotos und **Anhänge**; Personenseite, Materialien und
  Betrachter des Anhangs.
- **Gilt seit:** App 3.30.0
- **Ab App 3.31.0:**
  - **Als Porträt verwenden…** gibt es auch bei einem JPEG- oder PNG-Bild der Forschung, das die Person nennt (⋯ in
    den Materialien der Person, Dateibetrachter). Der Editor öffnet sich über einer Arbeitskopie aus der Forschung.
    Zur Datei des Stammbaums bei der Person wird das Bild erst nach **Fertig** (in der Bearbeitung der Person nach
    **Speichern**), in einem Schritt **Rückgängig**. Aus einem Foto mehrerer Menschen bekommt jede Person ihren
    eigenen Ausschnitt; die Datei ist einmal im Stammbaum, bei jeder Person als weitere Stelle. Läuft die Forschung
    nicht, ist die Aktion bei einer Datei nur in der Forschung nicht verfügbar; eine Forschung, die Dateien keinen
    Personen zuordnet, bietet sie nicht an.
  - **Die Auswahl Porträt aus einem Foto** bietet die Fotos der Person an, aus denen sich ein Porträt ausschneiden
    lässt: Bilder des Stammbaums bei der Person und JPEG- und PNG-Bilder der Forschung, die die Person nennen, die
    neuesten zuerst (ohne Datum am Ende). Ein PDF, eine Datei, die nur ein Original in der Forschung ist,
    ausgeblendete Dateien und Stammbaumdateien sind nicht darin. Das Foto des heutigen Porträts ist auch darin (ein
    neuer Ausschnitt desselben Fotos), mit der Markierung **Porträt**. Ein Foto, das auch andere Personen nennt, hat
    unter dem Namen „und 2 weitere“ und ihre Namen im Tooltip („Auch auf dem Foto: …“); Personen nur aus dem Stapel,
    mit dem die Datei kam, zählen nicht. Die Wahl eines Fotos öffnet den Editor ([A12.1](#A12.1)); aus der
    Bearbeitung der Person wird das Porträt mit **Speichern** gespeichert, von der Personenseite sofort mit
    **Rückgängig**. Die letzte Zeile ist **Vom Computer…** (bei Berührung **Von diesem Gerät…**).
  - **Aussehen der Auswahl:** am Computer mit Maus in einem Fenster breiter als 1024 px ein Popover an der
    Schaltfläche; bei Berührung und in einem Fenster bis 1024 px ein Blatt von unten mit dem Namen der Person, auf
    einem quer gehaltenen Telefon ein Panel rechts. Escape, ein Klick daneben und die Wahl eines Fotos schließen sie.
  - **Zustände der Auswahl:** läuft die Forschung nicht, fehlen Fotos nur in der Forschung und die Auswahl sagt
    „Fotos aus der Forschung (3) sind verfügbar, wenn die Forschung läuft.“, am Computer mit **Forschung starten**.
    Mit einer älteren Forschung, ohne Forschung und bei Berührung bietet sie nur Fotos des Stammbaums an, ohne den
    Satz. Eine Datei des Stammbaums, die nach dem Öffnen des Stammbaums noch nicht gekommen ist
    ([S1.4.1](S1-connecting-app-and-research.md#S1.4.1)), lädt und lässt sich nicht wählen; eine Datei, die nicht
    gekommen ist, ist nicht in der Auswahl. Ein gewähltes Foto aus der Forschung lädt in der Auswahl („Das Foto wird
    aus der Forschung geladen…“); lädt es nicht, bleibt die Auswahl offen mit „Das Foto ließ sich nicht laden.“ und
    **Erneut versuchen**.
  - **Porträt aus einem Foto…:** eine Person ohne Porträt, die sich ändern lässt und ein Foto zum Anbieten hat, hat
    im Kopf der Bearbeitung der Person unter dem Namen den Link **Porträt aus einem Foto…**. Dasselbe öffnen der
    Kreis im Kopf und der leere Kreis im Fotobereich. Die Personenseite hat den Link **Porträt aus einem Foto…** unter
    den Initialen; eine gespeicherte Seite (**Als HTML speichern**), der Druck und ein schreibgeschützter Stammbaum
    haben ihn nicht. Nur Fotos aus einer Forschung, die nicht läuft, geben keinen Link.

<!-- zdroj: app:59b9dde9 src/types.ts PortraitCrop, PortraitSource (attachmentId | partnershipId), Person.photoSource · app:88859da2 originál = cropToJpeg celé fotky, ATTACHMENT_MAX_SIDE 1600, ATTACHMENT_QUALITY 0.8, jen z nového souboru · app:e6f0595d src/ui/attachments-ui.ts štítek Portrét, Jako portrét… (isImage && !originalOnly && !locked, ne u zdroje), materials-ui.ts / material-viewer-ui.ts Použít jako portrét… (před Odstranit ze stromu…; app 3.30.0 material-viewer-ui.ts m.removeFromTree), danger.portraitSourceNote, unlinkPortraitFromAttachment, toast portraitReplaced s Vrátit · app:a2af453a Odebrat portrét → zdroj se smaže, příloha zůstane · D5 (bez běžícího výzkumu) · strings.ts attachments.asPortrait, portraitTag, portraitTagTitle, materials.useAsPortrait, portrait.replaceNote, current, newOne, replaced · ZADANI_DEV §4, §10 · 3.31.0: app:43d87c60 src/ui/portrait-actions-ui.ts materialPortraitOffer (vlastní obrázek stromu, nebo JPEG/PNG výzkumu se jménem osoby; bridge jen s caps.assign), useMaterialAsPortrait, linkPortraitFile; src/materials.ts isMaterialPortraitCandidate, PORTRAIT_MIMES · dirigent:prace/1121-app-portret-z-materialu · app:c6fbb3ff src/portrait-candidates.ts portraitCandidates (offer, bridge && !bridgeUp → researchOnly, waits failed vynechané, nejnovější první, isSource), photoPeopleOthers (directPersons bez dávky, místa přílohy), src/ui/portrait-picker-ui.ts (popover !isCoarsePointer && !isTabletOrMobile, jinak presentPortraitSheet; Escape, klik vedle; pickPortraitCandidate: busy, failed, Zkusit znovu = materials.retry; start jen na počítači s researchStartUrl) · app:3f6c9dfd src/ui/person-modal.ts updatePortraitOffer (#pm-portrait-link, #pm-avatar, #photo-preview is-pick), src/person-page.ts portraitPick (jen mode app, links app, ne readOnly), src/ui/person-page-ui.ts personPagePortraitPick · strings.ts portrait.pickTitle, fromComputer, fromDevice, fromPhoto, others, alsoIn, researchDown, pickLoading, pickFailed, materials.retry, sync.startResearch · dirigent:prace/1122-app-portret-dev · app:docs/ZADANI_DEV_portret-z-materialu.md §1–§4 -->

<a id="A12.3"></a>
## A12.3 Den Ausschnitt später bearbeiten

Ein Porträt mit Original lässt sich jederzeit neu aus dem ganzen Foto ausschneiden. Ein Porträt ohne Original lässt
sich nur innerhalb seines Quadrats ändern.

- **Mit Original:** der Editor öffnet sich über dem Anhang oder dem Paarfoto, aus dem das Porträt stammt, mit dem
  bisherigen Ausschnitt.
- **Ohne Original** (ein Porträt aus der Zeit vor App 3.30.0, aus einem GEDCOM-Import, aus einer Zusammenführung ohne
  Quelle, nach dem Löschen des Quellanhangs): der Editor arbeitet mit dem fertigen Quadrat von 256 px. Der Ausschnitt
  lässt sich nur verkleinern, innen verschieben, drehen, begradigen und spiegeln. Der Editor sagt es („Das ganze Foto
  ist nicht gespeichert, der Ausschnitt lässt sich nur verkleinern.“) und bietet **Foto erneut auswählen…** an: es
  öffnet die Dateiauswahl und dann wie ein neues Foto ([A12.1](#A12.1)). Jede weitere Bearbeitung ohne Original macht
  das Porträt weicher; eine neue Auswahl des Fotos behebt das.
- **Porträt | Ganzes Foto:** die Vergrößerung des Porträts auf der Personenseite hat unten den Umschalter **Porträt** |
  **Ganzes Foto**, wenn das Porträt sein Original im Stammbaum hat. Eine gespeicherte Personenseite (**Als HTML
  speichern**) hat in der Vergrößerung des Porträts den Link **Ganzes Foto** nur, wenn die Datei dieses Foto trägt
  (Anhänge oder Paarfoto in den Gruppen des Inhalts, [A7.6](A7-book-pages-and-export.md#A7.6)). Ein Porträt ohne
  Original und andere Bilder haben den Umschalter nicht.
- **Grenzen:** das Ergebnis aus der Bearbeitung der Person wird erst mit **Speichern** gespeichert; von der
  Personenseite wird es sofort als ein Schritt geschrieben („Porträt angepasst.“ mit **Rückgängig**), und die Seite
  wird neu gezeichnet. In einem schreibgeschützten Stammbaum und bei einer gesperrten Person gibt es keine Bearbeitung
  ([A12.1](#A12.1)).
- **Bedienung:** Bearbeitung der Person, **Ausschnitt bearbeiten** zwischen **Foto auswählen** und **Entfernen** (nur
  mit Foto); Personenseite, ⋯ **Weitere Aktionen** → **Porträtausschnitt bearbeiten** (nur bei einer Person mit
  Porträt, die sich ändern lässt).
- **Gilt seit:** App 3.30.0
- **Ab App 3.31.0:** ⋯ **Weitere Aktionen** auf der Personenseite hat vor **Porträtausschnitt bearbeiten** den Eintrag
  **Porträt ändern…**: er öffnet unter ⋯ die Auswahl **Porträt aus einem Foto** ([A12.2](#A12.2)), und das neue
  Porträt wird sofort mit **Rückgängig** geschrieben. Den Eintrag gibt es nur bei einer Person mit Porträt, die sich
  ändern lässt und ein Foto zum Anbieten hat (Fotos aus einer Forschung, die nicht läuft, zählen auch). Ein Klick auf
  das Porträt öffnet weiter die Vergrößerung.

<!-- zdroj: app:1feae064 src/ui/person-modal.ts #photo-recrop-btn (labels.photoRecrop), editor nad zdrojem s photoSource, jinak squareOnly + chooseAgain → #input-photo · src/ui/person-page-ui.ts item('crop', editCrop) jen canEdit && person.photo, Hotovo = jedna transakce, toast portraitUpdated s Vrátit · app:dab74024 src/ui/image-viewer.ts přepínač Portrét | Celá fotka (jen s existujícím zdrojem), src/person-page.ts portraitLightbox odkaz Celá fotka jen když soubor fotku nese · strings.ts labels.photoRecrop, personPage.moreActions, editCrop, portrait, wholePhoto, portrait.noOriginal, chooseAgain, updated · ZADANI_DEV §2, §10 · 3.31.0: app:3f6c9dfd src/ui/person-page-ui.ts togglePersonPageMenu item('portrait') před crop, personPageCanChangePortrait (shown + researchOnly > 0), runPersonPageMenu → openPortraitPicker pod .pp-more · strings.ts personPage.changePortrait · dirigent:prace/1122-app-portret-dev · app:docs/ZADANI_DEV_portret-z-materialu.md §1.3 -->

<a id="A12.4"></a>
## A12.4 Das Paarfoto

Eine Partnerschaft kann ein Foto des Paares haben: ein Hochzeitsfoto oder ein gemeinsames Foto. Es gehört der
Partnerschaft, nicht einem der Partner.

- **Die Zeile Foto** bei jeder Partnerschaft in den Beziehungen der Person:
  - ohne Foto **Foto auswählen** und der Hinweis „Hochzeitsfoto oder gemeinsames Foto des Paares“;
  - mit Foto eine Vorschau, **Foto auswählen** (tauscht es aus), **Porträts erstellen…** ([A12.5](#A12.5)),
    **Entfernen** und die Größe in kB. Ein Klick auf die Vorschau öffnet den Betrachter mit der Beschriftung „{A} und
    {B} · Paarfoto“ (die Partner in der Reihenfolge wie auf der Karte), **Herunterladen** und **Porträts erstellen…**.
- Das Foto wird wie ein Anhang verkleinert: JPEG mit einer längeren Seite von höchstens 1600 px.
- Änderungen des Fotos in den Beziehungen werden mit **Speichern** des Panels gespeichert, und **Abbrechen** verwirft
  sie; die Meldung ist ohne **Rückgängig**. Außerhalb des Panels (Betrachter aus der Tabelle, [A12.6](#A12.6)) wird
  sofort als ein Schritt mit **Rückgängig** geschrieben.
- **Entfernen** fragt nach („Paarfoto entfernen?“, „Die daraus entstandenen Porträts bleiben.“). Die Porträts bleiben
  ohne Verknüpfung und werden danach nur innerhalb ihres Quadrats bearbeitet ([A12.3](#A12.3)).
- **Löschen einer Partnerschaft mit Foto** fragt zuerst: „Mit ihr verschwindet auch das Paarfoto. Die Porträts daraus
  bleiben.“ Eine Partnerschaft ohne Foto wird wie bisher gelöscht.
- **Grenzen:** ein Foto je Partnerschaft; weitere Fotos des Paares nur als Anhänge der Personen. Ist einer der Partner
  gesperrt oder der Stammbaum schreibgeschützt, zeigt die Zeile nur Vorschau und Größe.
- **Bedienung:** Bearbeitung der Person, Abschnitt **Beziehungen** → **Beziehungen verwalten** (Panel **Beziehungen:
  {Name}**), bei der Partnerschaft die Zeile **Foto**; in der Tabelle der Verbindungen **Bearbeiten…** an der Zeile
  ([A6.7.8](A6-views.md#A6.7.8)). Auf dem Telefon füllt das Panel den ganzen Bildschirm, und die Schaltflächen der
  Zeile brechen um.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:59b9dde9 src/types.ts Partnership.photo, photoOriginalName, photoDate (verze dat 23), unlinkPortraitsFromUnion · app:9a47896e src/ui/relationships-panel.ts partnershipPhotoRowHtml (Vybrat fotku, unionPhotoHint, náhled → prohlížeč s popiskem, Udělat portréty…, Odebrat s danger.unionPhotoPortraitsStay, kB, zamčený partner jen náhled a velikost), Uložit / Zrušit panelu (D7) · src/attachments.ts ATTACHMENT_MAX_SIDE 1600 · app:68c232ad potvrzení smazání svazku s fotkou deleteUnionPhotoNote (D1) · strings.ts relationships.unionPhoto, unionPhotoHint, makePortraits, unionPhotoCaption, danger.removeUnionPhotoTitle, removeUnionPhoto, unionPhotoPortraitsStay, deleteUnionTitle, deleteUnionPhotoNote, buttons.manageRelationships (index.html #link-relationships), relationships.title · ZADANI_DEV §6, D1, D7, D9 -->

<a id="A12.5"></a>
## A12.5 Porträts aus dem Paarfoto

**Porträts erstellen…** schneidet aus dem Paarfoto das Porträt jedes Partners in einem Editor aus, Schritt für
Schritt.

- Der Editor **Porträts aus dem Paarfoto** hat einen Schritt für jeden Partner in der Reihenfolge wie auf der Karte.
  Der anfängliche Ausschnitt ist das größte Quadrat in der linken bzw. rechten Hälfte des Fotos; bei einem Foto im
  Hochformat in der oberen und unteren Hälfte. Der Rahmen des anderen Partners ist gestrichelt mit dem Namen zu sehen.
- Die Schritte lassen sich in der Kopfzeile wechseln; die Einstellung eines Schritts bleibt erhalten. Fußzeile:
  **Abbrechen** · **Überspringen** · **Weiter**, im letzten Schritt **Fertig**. Ein übersprungener Schritt ändert das
  Porträt nicht.
- **Ein Partner, der ein Porträt hat:** „{Name} hat schon ein Porträt“ und die Wahl **Bisheriges Porträt behalten**
  (Standard; „Der Schritt wird übersprungen.“) oder **Durch neuen Ausschnitt ersetzen** („Das bisherige Porträt lässt
  sich wiederherstellen.“).
- **Eine Partnerschaft mit einem bekannten Partner** hat einen Schritt: „Der zweite Partner ist unbekannt, das Porträt
  entsteht nur für eine Person.“
- **Fertig** speichert alle neuen Porträts auf einmal, jedes mit einer Verknüpfung zum Paarfoto; in die Anhänge kommt
  keine Kopie des Fotos. Meldung: „2 Porträts aus dem Paarfoto gespeichert.“ (mit übersprungenen „…, 1
  übersprungen.“). **Rückgängig** nimmt beide Porträts in einem Schritt zurück; in den Beziehungen gelten
  **Speichern** und **Abbrechen** des Panels ([A12.4](#A12.4)).
- Ein Porträt aus dem Paarfoto wird später über dem Paarfoto bearbeitet ([A12.3](#A12.3)).
- **Grenzen:** ein gesperrter Partner bekommt keinen Schritt; in einem schreibgeschützten Stammbaum gibt es
  **Porträts erstellen…** nicht.
- **Bedienung:** **Porträts erstellen…** in der Zeile **Foto** in den Beziehungen und im Betrachter des Paarfotos
  (auch aus der Tabelle, [A12.6](#A12.6)). Tasten wie in [A12.1.1](#A12.1.1).
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:9a47896e src/ui/portrait-editor.ts dva kroky (pořadí partnerů jako na kartě, levá / pravá polovina, u fotky na výšku horní / dolní), Přeskočit, Ponechat / Nahradit, Hotovo = jedna transakce, photoSource.partnershipId bez kopie do příloh, toast fromUnion s Vrátit · app:4cea7fbd Výchozí = polovina partnera · app:327d9734 čárkovaný rámeček druhého partnera · D9 zamčený partner · strings.ts portrait.twoTitle, next, skip, skipped, done, hasPortrait, keep, keepSub, replace, replaceSub, keepStage, single, fromUnion · ZADANI_DEV §7 -->

<a id="A12.6"></a>
## A12.6 Wo Porträt und Paarfoto erscheinen

Der Ausschnitt gilt überall, wo das Foto einer Person gezeigt wird. Das Paarfoto steht nur dort, wo vom Paar die Rede
ist: in den Beziehungen, in der Tabelle der Verbindungen, auf Personenseiten und im Familienbuch.

| Ort | Porträt (Ausschnitt) | Paarfoto |
|---|---|---|
| Karte im Stammbaum, Vorschau beim Überfahren, Bearbeitung der Person | ja | nein |
| Personenseite (in der App und gespeichert) | ja | als erstes in der Galerie **Bilder und Dokumente** beider Partner, Beschriftung „{A} und {B} · Paarfoto“, zählt zu den Bildern |
| Familienseiten (Seiten einer Stammlinie und des Stammbaums) | ja, auf 4 : 5 beschnitten | wie auf der Personenseite |
| Familienbuch | ja | im Kapitel der Familie über den Ereignissen des Paares |
| Poster, Bildexport, Druck des Stammbaums, Diashow | ja | nein |
| Tabelle › Verbindungen | – | Spalte **Foto** |
| Beziehungen der Person | – | Zeile **Foto** ([A12.4](#A12.4)) |

- **Tabelle › Verbindungen, Spalte Foto:** in der Gruppe **Kinder und Quellen**, anfangs ausgeblendet. Die Zelle zeigt
  eine kleine Vorschau; Klick oder Tippen öffnet den Betrachter mit **Porträts erstellen…**, die sofort mit
  **Rückgängig** geschrieben werden. Kopieren, CSV und XLSX haben „ja“ oder nichts. Die Sortierung stellt
  Verbindungen mit Foto vor solche ohne. Wertefilter **mit Foto** / **ohne Foto**; **Nur** und **Ohne** in der Zelle
  filtern gleich ([A6.7.6](A6-views.md#A6.7.6)). Auf dem Telefon hat die Zeile eine Vorschau nur, wenn die Spalte
  eingeschaltet ist.
- **Familienbuch:** das Foto über die Breite der Spalte, höchstens 110 mm hoch, mit einer Beschriftung der Art der
  Verbindung und des Datums („Heirat, 18.6.1924“, bei einem unverheirateten Paar „Partner“). Es steht nur mit dem Teil
  **Ausschnitte und Fotos** ([A7.4](A7-book-pages-and-export.md#A7.4)); ein Stammbaum, dessen einzige Bilder
  Paarfotos sind, bietet diesen Teil an.
- **Seiten:** das Paarfoto fehlt ohne die Gruppe der Bilder und auf einer Seite, die lebende Personen schützt, wenn
  mindestens einer der Partner lebt ([A12.7](#A12.7)).
- **Grenzen:** der Stammbaum (Familie, Nachkommen, Karten, Verbindungslinien), Poster, Druck und Diashow zeigen das
  Paarfoto nicht. Tabelle, Fächer, Zeitleiste, Karte und Statistiken zeigen das Porträt nicht (unverändert).
  **Stammbaum-Überblick** zählt Paarfotos zu den Fotos und Originale von Porträts zu den Anhängen.
- **Bedienung:** Tabelle › Verbindungen, Auswahl der Spalten; Personenseite; Export **Familienbuch**.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:45f7ca2a src/ui/table-view/table-columns.ts:732 uPhoto (group uextra, skrytý, kind thumb), thumbCell (strings.table.yes, sortKey), table-filter.ts presence (withPhoto / withoutPhoto), prohlížeč s Udělat portréty… a Vrátit, telefon (D10) · app:fd1f0c3c src/person-page.ts couplePhotoItems (první v galerii, popisek, počet obrázků, bez skupiny obrázků / žijící partner pod ochranou), rodinné stránky totéž, src/book-blocks.ts couplePhotoHtml (jen parts.media, popisek fields.marriageRow / book.partners + datum), src/book-css.ts .book-photo--couple max-height 110mm · app:50e49518 src/ui/tree-overview.ts a src/attachments.ts: fotka svazku mezi fotkami, originál portrétu je příloha · ZADANI_DEV §5, §8, D10, D12 · strings.ts tableCols.uPhoto, tableFilter.withPhoto, withoutPhoto, table.groups.uextra, personPage.sec.materials, relationships.unionPhotoCaption, book.parts.media -->

<a id="A12.7"></a>
## A12.7 Export, Schutz lebender Personen und GEDCOM

Das Original eines Porträts und das Paarfoto sind Fotos: sie gehen in einen Export mit Fotos und fallen mit ihnen
weg.

- **Inhalt des Exports** ([A7.3](A7-book-pages-and-export.md#A7.3)):
  - ohne **Fotos** (auch **Kleine Datei zum Senden** und **Nacktes Gerüst**) verschwinden die Porträts, ihre Originale
    (auch wenn Anhänge exportiert werden) und die Paarfotos; ein Ausschnitt des Eintrags aus einem solchen Original
    bleibt ohne Verknüpfung;
  - ohne **Anhänge, Dokumente & Quellenausschnitte**, aber mit Fotos, bleiben Porträts und Paarfotos; Porträts aus
    Anhängen verlieren die Verknüpfung zum Original.
- **Schutz lebender Personen** ([A7.2](A7-book-pages-and-export.md#A7.2)): eine lebende Person verliert Porträt,
  Original und Anhänge; eine Partnerschaft, bei der mindestens ein Partner lebt, verliert das Foto. Ebenso auf den
  Seiten und im Familienbuch.
- **Der GEDCOM-Export** schreibt das Paarfoto als gewöhnliches Bild der Familie (`1 OBJE` bei `FAM`), ohne eigenes
  Kennzeichen von Strom. Ausschnitt und Verknüpfung des Porträts mit dem Original werden nicht geschrieben; das
  Original geht als gewöhnlicher Anhang der Person. Der Export **Zurück zu {program}** hat keine Fotos
  ([S6.6](S6-tree-from-another-program.md#S6.6)).
- **GEDCOM-Import:** das erste Bild der Familie (Vorrang hat ein Bild mit `_PRIM`, `_PRIMARY` oder `_PERSONALPHOTO`
  `Y`; direkt bei der Familie geschrieben oder über einen Verweis auf einen Medieneintrag `@O1@`) wird zum Paarfoto,
  wenn es direkt in der Datei enthalten ist. Die übrigen Bilder der Familie werden wie bisher für **Zurück zu
  {program}** aufbewahrt; das Bild, das zum Paarfoto wurde, wird dort nicht noch einmal geschrieben. Ein Foto der
  Familie, auf das die Datei nur über einen Pfad verweist, wird zum Verknüpfen angeboten
  ([A2.1.1](A2-loading-a-family-tree.md#A2.1.1)).
- **Grenzen:** ein Porträt nach einem GEDCOM-Import (aus Strom und von anderswo) hat keine Verknüpfung mit einem
  Original und wird innerhalb seines Quadrats bearbeitet ([A12.3](#A12.3)). Eine verknüpfte Datei eines Fotos der
  Familie ersetzt die für **Zurück zu {program}** aufbewahrten Zeilen; dorthin kehrt sie dann nicht zurück.
- **Bedienung:** **Export** → **Inhalt**, **Privatsphäre lebender Personen**; **Import → GEDCOM importieren**,
  Zusammenfassung des Imports.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:50e49518 src/photo.ts stripPhotos (portrét, photoSource, zdrojová příloha i při exportu příloh, Partnership.photo*, výřez zápisu bez fromAttachmentId), src/attachments.ts stripAttachments + dropDanglingPortraitSources, src/privacy.ts (žijící: photoSource, přílohy; svazek se žijícím partnerem bez fotky), CONTENT_PRESETS (small, skeleton bez fotek; back bez médií) · app:68c232ad src/ged-exporter.ts:2089 Partnership.photo → 1 OBJE u FAM bez _STROM_KIND, photoSource se nezapisuje · src/ged-parser.ts první obrázek rodiny (_PRIM/_PRIMARY/_PERSONALPHOTO Y první, na místě i @O1@) → Partnership.photo jen jako bezpečná data URL, ostatní v extras pro Zpět do, vložený se nezapíše dvakrát · src/ged-media-attach.ts attachGedcomMediaFile (partnershipId: jen obrázek, jen svazek bez fotky, dropMediaLink) · strings.ts privacy.contentPhotos, contentAttachments, presetSmall, presetSkeleton · ZADANI_DEV „Data a rozhraní“, §6 -->

<a id="A12.8"></a>
## A12.8 Fotos in den Daten des Stammbaums

Das Original eines Porträts, der Ausschnitt und das Paarfoto sind Teil des Stammbaums (Datenversion 24: jede Datei
des Stammbaums ist ein Material mit seinen Stellen, [A3.5](A3-evidence-in-the-app.md#A3.5)). Sie gehen mit dem
Stammbaum in die Datensicherung JSON und in die Datei **App mit den Daten**. Wo sie überall gespeichert sind,
beschreibt [S8](S8-where-the-data-are.md).

- **Eine ältere App** (ab 3.19.0) öffnet einen Stammbaum der Version 24 nur schreibgeschützt und speichert ihn nicht,
  damit sie Porträts, Originale, Paarfotos und die Stellen der Dateien nicht verwirft ([A6.7.7](A6-views.md#A6.7.7)).
- **Rückgängig:** jedes **Fertig** außerhalb der Bearbeitung der Person ist ein Schritt; in der Bearbeitung der
  Person wird alles mit deren **Speichern** gespeichert und zurückgenommen; zwei Porträts aus einem Paarfoto sind ein
  Schritt.
- **Zusammenführen von Personen:** die Verknüpfung mit dem Original geht mit dem Porträt, das bleibt. Bei
  Partnerschaften bleibt das Foto der behaltenen Partnerschaft, und hat sie keines, das Foto der anderen.
- **Zusammenführen von Stammbäumen** ([A8](A8-merging-trees.md)): das Paarfoto aus der zusammengeführten Datei kommt
  hinzu, wo die Partnerschaft im Stammbaum keines hat; ein Porträt behält das Original des Porträts, das gewonnen hat.
- **Stammbaum aus der Forschung oder dem Strom-Archiv:** ab 1.35.0 halten die Forschung und das Archiv Porträts,
  Originale von Porträts, Paarfotos und Anhänge: das Schreiben des Stammbaums übergibt sie, und das Laden des
  Stammbaums gibt sie nach ihrem Fingerabdruck zurück ([S8.3](S8-where-the-data-are.md#S8.3)). Die Forschung hält
  nur den Ausschnitt nicht, also wo im ganzen Foto das Porträt liegt; der Stammbaum in der App behält ihn. Die
  Forschung bis 1.34 hält nichts davon: das Laden einer neuen Version lässt sie im Stammbaum; hat die Forschung bei
  einer Person oder einem Paar ein eigenes Foto, gilt ihres, sonst bleibt das Foto aus dem Stammbaum. Ein in der App
  entferntes Porträt, ein entfernter Anhang oder ein entferntes Paarfoto kommt mit der nächsten Aktualisierung nicht
  zurück.
- **Grenzen:** ohne die Forschung 1.35.0 sind Porträts, Originale und Paarfotos nur im Stammbaum in der App und in
  seinen Sicherungen. Eine Verknüpfung mit dem Original, die nicht passt (Original fehlt, Ausschnitt außerhalb des
  Fotos, Winkel über 45°), wird beim Laden verworfen; das Porträt bleibt.
- **Gilt seit:** App 3.30.0; Fotos in der Forschung mit der Forschung 1.35.0

<!-- zdroj: app:src/types.ts:1862 STROM_DATA_VERSION 24 (app:2b66d7cf; verze 23 app:59b9dde9, obě v 3.30.0) · src/photo.ts dropDanglingPortraitSources, sanitize při načtení · src/tree-manager.ts:659 isTreeNewer (jen ke čtení), strings.ts newerDataTitle · src/merge/executor.ts photoSource s vítězným portrétem, fotka svazku vítězného jinak druhého (app:59b9dde9, 50e49518) · app:50e49518 sloučení souboru: fotka svazku tam, kde chybí, originál podle bajtů · app:3f0312fb, 50e49518 src/research-link.ts carryOverMedia (fotka svazku a photoSource přenesené, vlastní fotka výzkumu vyhrává, odebrané se nevrací) · dirigent:spec/107 rozhodnutí: výzkum a archiv fotky nedrží (ZADANI_VYZKUM V2, V6, V7), platí pro výzkum do 1.34 · spec 108: dirigent:spec/108-kde-se-co-uklada U8, K2.3 (výřez se nevrací) · app:3419afff, 7263f1f6, src/research-link.ts carryOverMedia base · research:c9a4b614 CHANGELOG.cs.md 1.35.0 -->
