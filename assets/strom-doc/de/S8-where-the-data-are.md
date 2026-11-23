<a id="S8"></a>
# S8 Wo die Daten liegen

Die App hält Stammbäume im Speicher des Browsers auf diesem Gerät. Die Forschung und das Strom-Archiv halten ihren
Stammbaum in einem Ordner auf dem Datenträger dieses Computers, mit Quellen, Material und Verlauf. Ab der Forschung
1.35.0 hält die Forschung auch die Porträts, Paarfotos und Anhänge des Stammbaums aus der App. Das Kapitel
beschreibt die Strom-App 3.30.0 und die Forschung 1.35.0. Wie die Brücke zwischen beiden den Stammbaum überträgt,
beschreiben [S1](S1-connecting-app-and-research.md) und [S2](S2-edits-from-the-app.md).

| Was | Wo es liegt | Dauerhafte Kopie | Bedienung |
|---|---|---|---|
| Stammbaum in der App, Sicherungen in der App | Speicher des Browsers | Datei JSON (**In Datei speichern**, **Exportieren**) | App: **Wo die Daten liegen** |
| Originale, die auf die Forschung warten | Speicher des Browsers, höchstens 2 GB | keine, bis die Forschung sie annimmt ([A3.4.1](A3-evidence-in-the-app.md#A3.4.1)) | App: **Einstellungen → Daten und Datenschutz** |
| Stammbaum der Forschung, Quellen, Material, Verlauf | Ordner der Forschung (standardmäßig `Strom` in Dokumente) | Paket `strom pack` | Terminal |
| Scans aus Archiven, Originale, Dateien des Stammbaums aus der App | gemeinsamer Ordner der Forschung (`shared`) | Paket `strom pack` | Terminal |
| Porträts, Paarfotos, Anhänge | im Stammbaum in der App; ab der Forschung 1.35.0 auch in der Forschung | Datei JSON mit Bildern oder die Forschung 1.35.0 | App und Terminal |

<!-- zdroj: dirigent:spec/108-kde-se-co-uklada · app:src/storage.ts strom-db, strom-originals · strings.ts fileCopy.title „Kde jsou data“, fileCopy.intro, backupsNote · research:src/core/paths.ts:148 (Dokumenty/Strom), src/core/config.ts:276 shared · research:c9a4b614 CHANGELOG.cs.md 1.35.0 -->

<a id="S8.1"></a>
## S8.1 Was nur im Browser liegt

Der Stammbaum in der App liegt nur im Speicher dieses Browsers, bis er in eine Datei gespeichert wird. Der Browser
kann den Speicher löschen; die Sicherungen in der App liegen im selben Speicher und verschwinden mit ihm.

- Das Fenster **Wo die Daten liegen** sagt, ob der Browser den Speicher dauerhaft hält, wann der Stammbaum zuletzt in
  eine Datei gespeichert wurde und wie sich der Speicher halten lässt (Installation als App, dauerhafter Speicher in
  Firefox, Dock oder Home-Bildschirm in Safari).
- **In Datei speichern** speichert den ganzen Stammbaum mit allen Angaben und Bildern in eine Datei JSON, die sich in
  Strom wieder öffnen lässt. Ein verschlüsselter Stammbaum lässt sich verschlüsselt speichern.
- Ein privates Browserfenster löscht die Stammbäume beim Schließen.
- **Grenzen:**
  - jeder Browser und jedes Gerät hat einen eigenen Speicher: ein in Chrome geöffneter Stammbaum ist weder in Edge
    noch auf dem Telefon;
  - Originale, die auf die Forschung warten, sind nicht im Stammbaum, in den Sicherungen oder im Export
    ([A3.4.1](A3-evidence-in-the-app.md#A3.4.1));
  - bei einem Stammbaum ohne Forschung sind Porträts, Paarfotos und Anhänge nur im Stammbaum im Browser und in seinen
    Dateien: „Die Dateien liegen nur in diesem Browser. Sicherung: Alles exportieren.“
- **Bedienung:** App: die Anzeige **Nur im Browser** in der Leiste, **Wo sind meine Daten?**; **Einstellungen → An
  das Speichern in eine Datei erinnern**.
- **Gilt seit:** App 3.0.0

<!-- zdroj: app:src/storage.ts strom-db · src/ui/file-copy-ui.ts · strings.ts fileCopy.title, intro, statePersistent, stateNotPersistent, statePrivate, backupsNote, save, quickHint, saveEncryptedBtn, details, settingLabel · materials.whereApp · S1.8 -->

<a id="S8.2"></a>
## S8.2 Was in der Forschung und im Strom-Archiv liegt

Die Forschung und das Strom-Archiv halten den Stammbaum in einem eigenen Ordner auf dem Datenträger. Darin haben sie
den Stammbaum mit Verlauf, Quellen, Material und Aufgaben; Scans aus Archiven, Originale und Dateien des Stammbaums
aus der App liegen im gemeinsamen Ordner, jede Datei einmal.

- Der Stammbaum in der App und der Stammbaum in der Forschung sind zwei Kopien. Was die App sendet, schreibt die
  Forschung nach [S2](S2-edits-from-the-app.md).
- Dateien der Forschung, die nicht im Stammbaum sind, zeigt die App im Fenster **Materialien** als **nur im Archiv**
  ([A3.5](A3-evidence-in-the-app.md#A3.5)).
- **Grenzen:**
  - ein verschlüsselter Stammbaum in der App bedeutet keine verschlüsselte Forschung: „Der Stammbaum ist
    verschlüsselt, die Forschung auf der Festplatte nicht.“;
  - Material der Forschung ist nur in der App am Computer zu sehen.
- **Bedienung:** Terminal: `strom pack` (ein Paket als Sicherung oder zur Weitergabe), `strom unpack`, `strom trees
  remove` ([S8.6](#S8.6)); App: ⓘ **Wo die Dateien liegen** im Fenster **Materialien**.
- **Gilt seit:** Forschung 1.0.0; Dateien des Stammbaums aus der App in der Forschung 1.35.0

<!-- zdroj: research:src/core/paths.ts, src/core/config.ts (home, shared), src/core/media.ts sharedMediaPath (media/<sha[0:2]>/<sha[2:4]>/<sha><ext>) · app:strings.ts materials.whereTitle, whereArchiveResearch, whereEncryptedResearch, desktopOnlyResearch -->

<a id="S8.3"></a>
## S8.3 Fotos und Anhänge des Stammbaums in der Forschung

Die Forschung 1.35.0 und das Strom-Archiv 1.35.0 halten die Porträts, Paarfotos und Anhänge des Stammbaums aus der
Strom-App. Das Schreiben des Stammbaums übergibt sie alle; die Forschung speichert jede Datei einmal, nach ihrem
Inhalt, mit ihren Stellen im Stammbaum ([R11.5.1](R11-material-from-the-user.md#R11.5.1)).

- Das Original eines Porträts geht in die Forschung als Original eines Anhangs mit der Markierung **Porträt**, das
  Original eines Paarfotos als Material beider Partner. Ein Original erzeugt eine Aufgabe Unterlagen; im
  Strom-Archiv wartet es zurückgestellt.
  - **Ab Forschung 1.36.0:** die Aufgabe Unterlagen entsteht nur, wenn die Einstellung **An die Forschung gesendete
    Dateien geht der Agent selbst durch** eingeschaltet ist; sonst wartet das Original unsortiert unter Materialien
    ([R11.6](R11-material-from-the-user.md#R11.6)).
- Das Laden des Stammbaums aus der Forschung gibt die Dateien nach ihrem Fingerabdruck zurück: die App bekommt
  Porträts, Paarfotos und Anhänge an ihre Stellen. Eine in der App entfernte Datei blendet die Forschung aus, sie
  löscht sie nicht ([A3.5.6](A3-evidence-in-the-app.md#A3.5.6)).
- **Grenzen:**
  - die Forschung hält nicht, wo im ganzen Foto der Ausschnitt eines Porträts liegt. Der Stammbaum in der App behält
    ihn beim Laden einer neuen Version; ein zum ersten Mal aus der Forschung geladener Stammbaum hat das Porträt und
    das ganze Foto, aber **Ausschnitt bearbeiten** geht nur innerhalb des Quadrats des Porträts
    ([A12.3](A12-portrait-and-couple-photo.md#A12.3));
  - die Forschung bis 1.34 hält die Dateien des Stammbaums nicht: Porträts, Paarfotos und Anhänge sind nur in der App,
    und das Laden aus der Forschung lässt sie im Stammbaum ([A12.8](A12-portrait-and-couple-photo.md#A12.8));
  - nur am Computer und nur mit der Brücke der Forschung.
- **Bedienung:** App: Schreiben des Stammbaums (**Senden**, [S2](S2-edits-from-the-app.md)); **Forschung für diesen
  Stammbaum → Originaldateien senden**.
- **Gilt seit:** App 3.30.0, Forschung 1.35.0

<!-- zdroj: dirigent:spec/108-kde-se-co-uklada (U8, K2.3, K2.6, K2.7) · app:3419afff POST /sync?media=app, 7263f1f6 GET /tree.ged?images=ref&media=app, 402b7d9b, e3e415f6 (X-Strom-Person, originál se štítkem Portrét), 59ff465e · src/research-link.ts carryOverMedia (photoSource ponechaný, base K2.3) · research:0834987b (X-Strom-Family), 3925b84a (_PRIM Y), 815bc90d, 91ab6230, 771d8af0 · research:src/core/treemedia.ts (hlavička) · research:c9a4b614 CHANGELOG.cs.md 1.35.0 -->

<a id="S8.4"></a>
## S8.4 Die Anzeige Nur im Browser

Die Anzeige **Nur im Browser** leuchtet, wenn der Stammbaum Änderungen hat, die keine Datei hält. Bei einem
Stammbaum mit Forschung am Computer leuchtet sie nicht, wenn die Forschung alle seine Änderungen hält.

- Änderungen, die an die Forschung gesendet wurden, oder frische, innerhalb von 10 Minuten gesendete, zählen als
  gehalten. Eine länger nicht gesendete Änderung (die Brücke läuft nicht, die Forschung hat sie abgelehnt, es wird
  von Hand gesendet) lässt die Anzeige leuchten.
- Porträts, Paarfotos und Anhänge hält die Forschung bis 1.34 nicht: solange keine Datei sie hat, leuchtet die
  Anzeige auch bei einem Stammbaum, dessen Änderungen die Forschung hält.
- Bei der Forschung 1.35.0 zählen Fotos und Anhänge als gehalten nach dem ersten Schreiben des Stammbaums, das sie
  übergeben hat. Ein danach hinzugefügtes Bild wartet wie jede nicht gesendete Änderung.
- **Grenzen:** ein Export ohne Fotos zählt nicht als Kopie der Fotos. Ein Stammbaum der Forschung, der seit der
  Aktualisierung der App nicht geöffnet wurde, zählt wie bisher, bis er geöffnet wird.
- **Bedienung:** App: die Anzeige in der Leiste öffnet **Wo die Daten liegen**; **In Datei speichern**.
- **Gilt seit:** App 3.0.0; 3.30.0: Fotos und Anhänge in der Anzeige
- **Ab App 3.31.0:** hält die Forschung den Stammbaum bis auf die Porträts, Paarfotos und Anhänge, sagt die Anzeige
  **Fotos nur im Browser**, der Text beim Überfahren „Die Forschung hält den Stammbaum, nicht seine Porträts,
  Paarfotos und Anhänge. Diese gibt es nur im Browser, noch nicht in einer Datei — der Browser kann sie löschen“.
  Dasselbe sagen die Zeile in **Mehr** („Mehr – Fotos nicht gespeichert“), der Hinweis („Den Stammbaum regelmäßig
  in eine Datei speichern.“) und der Dialog **Wo die Daten liegen** („Die Forschung hält den Stammbaum, aber seitdem
  hinzugefügte Porträts, Paarfotos und Anhänge gibt es nur im Browser.“). Das gilt nur, wenn alle Stammbäume, die
  die Anzeige zählt, so sind. Bleibt auch eine Änderung länger als 10 Minuten ungesendet, sagt die Anzeige wieder
  **Nur im Browser**.

<!-- zdroj: app:e434e730, a678b253 src/browser-media.ts browserMediaFingerprint, browserMediaSafe, archiveHoldsAppMedia · src/ui/research-sync-ui.ts researchHoldsTree, RESEARCH_HOLD_MS=10 min, researchArchiveHoldsMedia · src/tree-manager.ts noteFileCopy (export bez fotek), learnMediaFingerprints · src/ui/file-copy-ui.ts unsavedOutsideResearch · strings.ts fileCopy.indicatorShort, indicatorTitle · dirigent:spec/108-kde-se-co-uklada K1b.1, K2.6 · 3.31.0: app 110f4109 src/ui/research-sync-ui.ts researchHoldsTree → photos, src/file-copy.ts unsavedKind (všechny stromy photos), strings.ts fileCopy.photosShort, photosTitle, photosMoreHint, noticePhotos, copyPhotosSince, copyPhotosNever · SPEC.md 1120-app-108-diry -->

<a id="S8.5"></a>
## S8.5 Die Fotos aus der Forschung konnten nicht geladen werden

Wird der Stammbaum aus einer Forschung geladen, die die Dateien des Stammbaums hält, deren Fotos sich aber nach dem
Fingerabdruck nicht laden lassen, lädt die App den Stammbaum ohne sie und entfernt nichts, was die Forschung hat.

- Bis die Fotos kommen, fügen Schreibvorgänge des Stammbaums nur hinzu: eine Datei, die der Stammbaum in der App
  gerade nicht hat, entfernt die Forschung nicht.
- Die App versucht es selbst nach 5 und nach 30 Sekunden erneut. Geht es nicht, meldet sie „Die Fotos aus der
  Forschung konnten nicht geladen werden.“ mit **Erneut versuchen**.
- **Grenzen:** **Erneut versuchen** lädt die Version aus der Forschung wie jedes Laden: hat sich der Stammbaum
  inzwischen geändert, fragt es.
- **Bedienung:** App: die Meldung → **Erneut versuchen**.
- **Gilt seit:** App 3.30.0, Forschung 1.35.0
- **Ab App 3.31.0:** beim Öffnen mit **Live verfolgen** kommen die Fotos nach dem Stammbaum
  ([S1.4.1](S1-connecting-app-and-research.md#S1.4.1)). Fotos, die nicht kamen, meldet dort „Einige Fotos wurden
  nicht geladen (N).“ mit **Erneut versuchen**; nach 5 s und 30 s wird es
  nicht von selbst wiederholt. Bis sie kommen, fügen
  Schreibvorgänge des Stammbaums weiterhin nur hinzu.

<!-- zdroj: app:src/ui/research-ui.ts startLiveFollow onDone (failed → noteResearchMediaMissed, bez researchMediaMissed a MEDIA_RETRY_MS), src/ui/image-load-chip.ts showFailed · spec 116 · app:6bbc2f82 src/ui/research-ui.ts noteResearchMediaMissed (zápisy jen přidávají), 61ef1bdd MEDIA_RETRY_MS=[5000, 30000], researchMediaMissed, tellResearchMediaMissed, researchRetryMedia · strings.ts sync.mediaMissed, sync.retry -->

<a id="S8.6"></a>
## S8.6 Paket und Entfernen eines Stammbaums: Scans und Familienfotos

`strom pack` und `strom trees remove` unterscheiden **Scans aus Archiven** und **Familienfotos und Originale**. Scans
lassen sich aus dem Archiv wieder laden, Familienfotos und Originale nicht.

- Ein Scan ist ein Bild aus einem Archiv (ein Buch oder ein heruntergeladenes Bild). Eine Datei, die beides ist,
  zählt als Familienfoto.
- `strom pack` nennt beides getrennt. Von den Scans packt es die mit Einträgen und die, die niemand wieder lädt (oder
  alle); Familienfotos und Originale immer alle, auch mit den verkleinerten Kopien der Dateien des Stammbaums. Das
  Paket trägt auch die Stapel aus der App.
- Die Stapel aus der App gehen ins Paket auch mit Namen, Personen und Notiz; `strom unpack` holt sie samt den Dateien
  des Stapels zurück ([R11.4](R11-material-from-the-user.md#R11.4)).
- `strom trees remove` bietet zuerst eine Sicherung als Paket mit allen Scans aus Archiven, Familienfotos und
  Originalen an (zurück holt sie `strom unpack`), fragt dann getrennt nach den Scans und getrennt
  nach den Familienfotos und Originalen, die kein anderer Stammbaum verwendet; bei den Familienfotos ist die
  Standardantwort nein. Das Entfernen bestätigt der eingetippte Name des Stammbaums. Die Dateien gehen als ein Ordner
  „<Name> – Dateien“ in den Papierkorb.
- **Grenzen:**
  - ein Paket über 4 GB oder über 65 535 Dateien lehnt die Forschung ab, bevor sie etwas schreibt: die Forschung
    überträgt dann der kopierte ganze Ordner (auf ein USB-Laufwerk, in einen Cloud-Ordner). `strom trees remove` sagt
    es bei der Sicherung und macht ohne sie weiter;
  - einen Stammbaum entfernt nur ein Mensch am Computer, nicht der Agent.
- **Bedienung:** Terminal: `strom pack [--all-images]`, `strom unpack "<Datei>"`, `strom trees remove`.
- **Gilt seit:** Forschung 1.35.0

<!-- zdroj: research:31def74a src/commands/pack.ts (ui.pack.images, ui.pack.family, ui.pack.batches, pack.too-large), src/core/pack.ts (bez ZIP64), src/core/zip.ts ZIP_MAX_FILES=0xffff · src/commands/trees.ts:271-287 (záloha výchozí ano, skeny ano jen se zálohou, rodinné ne, název), ui.remove.images.folder · research:771d8af0 (zmenšené kopie v balíku) · assets/lang/cs.json ui.pack.*, ui.remove.*, ui.error.pack.too-large · ui.pack.batches, ui.unpack.batches (v1.35.0) · trees remove: strom pack --all-images · e6bbfb40 ui.pack.which, ui.remove.backup (1.36.0 jen texty) -->
