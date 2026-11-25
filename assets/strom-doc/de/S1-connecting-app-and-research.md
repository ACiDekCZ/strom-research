<a id="S1"></a>
# S1 Verbindung von App und Forschung

Wie sich die Strom-App mit der Forschung auf demselben Computer verbindet, welche Arten von Stammbäumen dabei
entstehen und was geschieht, wenn die Verbindung nicht geht. Beschrieben werden die Strom-App 3.21.2 (und die
Forschung 1.25.2). Änderungen aus einer neueren Version tragen deren Nummer. Was nach der Verbindung mit Änderungen
geschieht, beschreibt [S2](S2-edits-from-the-app.md), das Telefon [S5](S5-phone.md).

<a id="S1.1"></a>
## S1.1 Die Brücke der Forschung läuft nur auf diesem Computer

Die App spricht mit der Forschung über eine Brücke: einen kleinen Server, den die Forschung auf diesem Computer
startet. Die Brücke lauscht nur auf der Adresse `127.0.0.1`, auf einem zufälligen Port, und jede ihrer Adressen trägt
einen geheimen Schlüssel. Daten des Stammbaums gehen über die Brücke nirgendwo anders hin.

- **Grenzen:**
  - Die Brücke nimmt eine Anfrage nur von einer Seite der Strom-App auf stromapp.info oder von einer lokalen Adresse an. Kommt ihr Schlüssel von einer fremden Seite, tauscht die Forschung den Schlüssel sofort aus, und diese
    Anfrage bekommt keine Antwort.
  - Die Brücke läuft, bis der Mensch sie ausschaltet (`strom live stop`, in der App der Schalter **Forschung an**,
    [S1.9](#S1.9)), oder bis der Computer heruntergefahren wird. Von selbst endet sie nur, wenn der Mensch das gewählt
    hat (`live.idleMinutes`, in der App **Nach 2 Stunden ohne Arbeit**): wenn sie in dieser Zeit niemand etwas fragt
    und dabei niemand im Stammbaum arbeitet. Die regelmäßige Statusabfrage der App hält die Brücke nicht am Leben.
  - Die Brücke endet von selbst auch dann, wenn ihre Forschung aus dem Ordner verschwindet und auch bei der nächsten
    Prüfung mindestens 10 s später fehlt. Ein nur kurz nicht erreichbarer Datenträger beendet die Brücke nicht. Eine
    zweite Brücke derselben Forschung, neben einer laufenden gestartet, endet sofort.
  - Startet die Brücke von selbst neu (Aktualisierung, Untätigkeit, Absturz), behält sie ihre Adresse: denselben Port,
    wenn er frei ist, und denselben Schlüssel. Die App verbindet sich dann ohne neuen Link.
  - `strom live stop` verwirft den Schlüssel: die App verbindet dann erst wieder `strom app`. Ist der Port von einem
    anderen Programm belegt, nimmt die Brücke einen anderen Port, und die App braucht einen neuen Link.
  - Einen Schreibvorgang lehnt die Brücke ab, wenn der Stammbaum auf einem anderen Computer versiegelt ist, wenn die
    Dateien des Stammbaums in einem Cloud-Ordner noch nicht heruntergeladen sind und wenn der Datenträger voll ist.
    Die Änderungen warten dann in der App ([S2](S2-edits-from-the-app.md)).
- **Bedienung:** Terminal: `strom live` (läuft die Brücke?), `strom live start`, `strom live stop` (`--forget`
  vergisst auch den Port), `strom config set live.idleMinutes <Minuten>` (0: nie von selbst, Standard). Das Protokoll
  des Laufs liegt im Ordner der Forschung in `.strom/live.log`.
- **Gilt seit:** Forschung 1.0.0. Dieselbe Adresse nach einem Neustart seit 1.8.0, `live.idleMinutes` seit 1.25.0.
- **Ab Forschung 1.29.0:** die Brücke endet bei Untätigkeit nicht mehr von selbst (Standard `live.idleMinutes` 0);
  vorher endete sie von selbst nach zwei Stunden. Ein Wert, den der Mensch gespeichert hat, bleibt.
- **Ab Forschung 1.30.0:** eine Brücke, deren Forschung verschwunden ist, endet erst nach einer zweiten Prüfung
  mindestens 10 s später (vorher sofort); eine zweite Brücke derselben Forschung endet sofort.
- **Ab Forschung 1.31.0:** auch nach einem Update bleibt bei einer Forschung eine Brücke. Eine Brücke, die neben der
  Brücke der Forschung läuft (der, die `.strom/live.json` nennt), endet bei der nächsten Prüfung von selbst (alle
  10 s). Eine Brücke, deren strom ein Update gelöscht hat, endet auch und schreibt das in `.strom/live.log`. Eine neue
  Brücke, die endet, weil eine andere Brücke die Forschung hält, beendet auch die Brücke, die sie für die Übergabe
  gestartet hat, außer es ist die Brücke der Forschung. Die Übergabe der Brücke an einen neueren strom ist schneller:
  die alte Brücke antwortet, während der neue strom geprüft wird.

<!-- zdroj: research:src/core/live.ts (v1.25.2) header :1-80, token crypto.randomBytes :1702, leaked :1809, :1995, LIVE_IDLE_MS / live.idleMinutes :1705, config.ts DEFAULT_LIVE_IDLE_MINUTES = 0 (od 1.29.0), live-last.json :518, seal.foreign / tree.not-downloaded / disk.full · src/commands/start.ts live · src/core/config.ts live.idleMinutes · research:94d75934 src/core/live.ts GONE_MS 10_000 (researchGone: dvě kontroly aspoň 10 s od sebe), otherBridge (most téhož stromu už běží → konec) · CHANGELOG.cs.md 1.30.0 · research:0c6f2205 src/core/live.ts OWNER_MS 10_000 (most mimo live.json skončí), kód stromu smazaný aktualizací (dvě kontroly GONE_MS, live.log), EXIT.locked → konec mostu, který spustil předání (STROM_LIVE_REPLACES), kromě mostu z live.json · 0239e6c3 předání: starý most odpovídá během ověření nového · CHANGELOG.cs.md 1.31.0 -->

<a id="S1.2"></a>
## S1.2 Die Forschung öffnet sich in der App über einen Link aus dem Terminal

Die Forschung öffnet sich in der App mit dem Befehl `strom app`. Die Forschung startet die Brücke und öffnet im
Browser die App mit einem Link auf ihren Stammbaum. Beim ersten Mal entsteht in der App ein neuer Stammbaum, danach
wird derselbe aktualisiert.

- **Grenzen:**
  - Arbeitet im Stammbaum ein Agent (oder mit der Option `--live`), verfolgt die App den Stammbaum gleich live
    ([S1.4](#S1.4)). Sonst lädt sie den Stammbaum einmal.
  - Die App nimmt nur einen Link auf `127.0.0.1` oder `localhost` an. Einen anderen Link ignoriert sie mit der
    Meldung „Der Link verwies auf eine Datei, die nicht auf diesem Computer liegt, und wurde daher ignoriert.“
  - Der Stammbaum aus der Forschung ist schon in der App und hat sich seit dem letzten Laden in der App nicht
    geändert: er wird aktualisiert. Hat er sich geändert: die App fragt, ob sie ihn **Aktualisieren** oder **Als
    Kopie öffnen** soll. Vor der Aktualisierung wird eine Sicherung gespeichert. **Als Kopie öffnen** macht aus der
    Forschung einen neuen Stammbaum, der die weiteren Aktualisierungen bekommt; der Stammbaum mit den Änderungen bleibt,
    wie er ist, ab App 3.32.0 als Kopie ohne Forschung ([S1.10](#S1.10)).
  - Safari erlaubt einer Webseite keine Verbindung mit einem Programm auf diesem Computer. `strom app` öffnet Safari
    darum nie. Ohne geeigneten Browser übernimmt die installierte App die Datei, oder die Datei
    `output/tree-strom.ged` aus dem Ordner der Forschung lässt sich in das Fenster der App ziehen.
  - Chrome und Edge fragen beim ersten Mal nach der Erlaubnis für den Zugriff auf Geräte im lokalen Netzwerk. Ohne sie
    erreicht die App die Forschung nicht ([S1.5](#S1.5)).
- **Bedienung:** Terminal: `strom app`, `strom app --live`. App: **Forschung → Weitere Aktionen → Forschung für
  diesen Stammbaum…**
- **Gilt seit:** App 3.0.0, Forschung 1.0.0
- **Seit Forschung 1.30.0:** unter macOS übergibt die Forschung die Adresse für die aus einem Chromium-Browser
  installierte App (Chrome, Edge…) dem schon laufenden Browser, so wie sie sein eigener zweiter Start übergeben würde.
  Kein weiteres Programm startet, und im Dock kommt kein Browser-Symbol hinzu. Läuft der Browser nicht oder antwortet
  er nicht innerhalb von 5 s, startet die Forschung ihn wie bisher.

<!-- zdroj: research:a4a2f6c0 src/core/chromium.ts openWebApp (darwin: handToRunning SingletonSocket, jinak launch), handToRunning (ACK, timeout 5000), singletonMessage · dirigent:prace/1109-vyzkum-dock-chrome/karta.md Výsledek (živě Chrome, Edge, Canary) · research:src/commands/start.ts (v1.25.2) app, liveAppUrl / importAppUrl, Safari · app:src/research-link.ts:584 parseLoopbackUrl, :747 decideResearchOpen · src/ui/research-ui.ts:1088 initExternalOpen, :1350 importResearchFromUrl · src/local-network.ts · strings.ts research.notLocal, research.editedMessage, research.safariBlocked -->

<a id="S1.2.1"></a>
### S1.2.1 Links, die die App annimmt

| Link | Was die App tut |
|---|---|
| `?live=` | öffnet den Stammbaum und verfolgt ihn live |
| `?import-url=` | lädt den Stammbaum einmal von der Brücke |
| `?send=` | sendet Änderungen an die Adresse, die eine aus der App zum Senden gestartete Forschung angegeben hat |
| `?research=install` | öffnet die Installation der Forschung (ein vom Telefon gesendeter Link) |
| `?tree=…&research=…&person=…` | öffnet den Stammbaum der Forschung bei der angegebenen Person |

Die Parameter entfernt die App nach der Verarbeitung aus der Adresse. Nach einem Neuladen der Seite während des
Verfolgens wird das Verfolgen still wiederhergestellt.

<!-- zdroj: app:src/ui/research-ui.ts initExternalOpen :1088, rememberedLiveBridge · src/deep-link.ts · src/research-install.ts -->

<a id="S1.3"></a>
## S1.3 Arten von Stammbäumen in der App

Ein Stammbaum in der App ist entweder ein eigener oder gehört zu einer Forschung auf diesem Computer. Ein Stammbaum
aus der Forschung trägt in der Datei die Nummer der Forschung und die Version, aus der er entstand. Daran erkennt die
App, wohin sie ihn zurückschickt.

| Art | Im Stammbaum-Umschalter | Was es ist |
|---|---|---|
| Eigener Stammbaum | ohne Marke | ein Stammbaum nur in der App, ohne Forschung |
| Forschung | **Forschung** | ein Stammbaum, in dem der Agent der Forschung arbeitet |
| Strom-Archiv | **Archiv** | ein Stammbaum, den die Forschung mit den Quellen auf dem Datenträger hält, ohne Agent |
| Forschung wartet auf einen Agenten | **Archiv** | eine Forschung, die noch keinen Agenten hat; die App behandelt sie wie ein Archiv |
| Kopie | ohne Marke | eine Kopie eines Stammbaums aus der Forschung (**Als Kopie öffnen**, Kopie des ganzen Stammbaums, zweiter Import); wird aus der Forschung nicht aktualisiert und ist ab App 3.32.0 ohne Forschung ([S1.10](#S1.10)) |

- **Grenzen:** ob ein Stammbaum Forschung oder Archiv ist, entscheidet die Forschung, nicht die App. Umschalten
  lässt es sich nur in der Forschung.
- **Bedienung:** App: Stammbaum-Umschalter. Terminal: Menü der Forschung.
- **Gilt seit:** App 3.12.0 (Name Strom-Archiv), Marken im Umschalter seit 3.16.0

<!-- zdroj: app:src/research-link.ts _STROM_TREE, _STROM_HEAD · src/types.ts:1695 ResearchLink (copy, mode) · src/research-others.ts researchAgentless · src/ui/research-sync-ui.ts researchKindOf :654, researchAgentAway · strings.ts treeSwitcher.kindArchive, kindResearch · spec 002 · CHANGELOG.cs.md 3.12.0, 3.16.0 -->

<a id="S1.3.1"></a>
### S1.3.1 Der Beispiel-Stammbaum

Der Beispiel-Stammbaum dient zum Ausprobieren der App. Er wird nie mit einer Forschung verbunden, und nichts aus ihm
wird an eine Forschung gesendet.

- **Ahnenforschung** im Beispiel-Stammbaum richtet nichts ein und sagt: „Der Beispiel-Stammbaum dient zum
  Ausprobieren der App und wird nie mit einer Forschung verbunden. Eine Forschung beginnt mit einem echten
  Stammbaum.“
- Das Öffnen des Beispiel-Stammbaums beendet das Verfolgen der offenen Forschung wie ein Wechsel zu einem anderen
  Stammbaum ([S1.4](#S1.4)).
- **Grenzen:** einen Beispiel-Stammbaum aus einer älteren Version der App erkennt die App an seinem Inhalt und
  markiert ihn beim Öffnen oder Importieren. Ein Beispiel, das schon mit einer Forschung verbunden ist, wird nicht
  markiert und bleibt verbunden.
- **Bedienung:** App: **Beispiel-Stammbaum ausprobieren**
- **Gilt seit:** App 3.29.0

<!-- zdroj: app:bbcc2b17 src/types.ts TreeMetadata.demo · src/demo-sample.ts (starší ukázka podle obsahu; propojená se neoznačí) · src/tree-manager.ts, src/ui/import-export.ts (označení při otevření a importu) · src/ui/research-promo-ui.ts showResearchInfoDialog (demo → demo.noResearch, nic se nenastaví) · src/ui/research-adopt-ui.ts (nikdy ukázka) · src/ui/research-follow-ui.ts researchFollowBeforeSwitch(null) · strings.ts demo.tryDemo, demo.noResearch, research.menuItem · CHANGELOG.cs.md 3.29.0 „Přepnutí stromu“ · prace/1115-app-prepnuti-stromu -->

<a id="S1.4"></a>
## S1.4 Live verfolgen

Beim Live-Verfolgen kommen Änderungen aus der Forschung von selbst in die App. Der verfolgte Stammbaum ist
währenddessen schreibgeschützt, damit sich eine Änderung in der App nicht mit der Arbeit des Agenten trifft.

- **Grenzen:**
  - Live verfolgt wird immer nur ein Stammbaum. Das Verfolgen eines anderen Stammbaums beendet das vorige.
  - Der Wechsel zu einem Stammbaum, in dem ein Agent arbeitet, beginnt ohne Rückfrage, ihn zu verfolgen. Nicht
    gesendete Änderungen des geöffneten Stammbaums werden vorher gesendet.
  - Das Verfolgen endet, wenn der Agent aufhört zu arbeiten oder wenn aus der Forschung ein Archiv wird. Der
    Stammbaum lässt sich dann wieder bearbeiten.
  - Misslingt das automatische Verfolgen, schweigt die App, und der Stammbaum bleibt, wie er war.
- **Bedienung:** App: **Live verfolgen** · Terminal: `strom app --live`
- **Gilt seit:** App 3.0.0; Wechsel zu einem Stammbaum mit Agent seit 3.13.1
- **Ab App 3.26.0 mit Forschung 1.30.0:**
  - die Forschung hat den Stammbaum für die App für jeden Stand erstellt und behält ihn auch nach einem Neustart der
    Brücke;
  - die App zeigt den Stammbaum sofort in seiner zuletzt erstellten Form. Ist die Forschung inzwischen
    weitergekommen, zeigt das Panel der Forschung „Neuere Version wird vorbereitet…“, und die neuere Version ersetzt
    den Stammbaum von selbst, sobald sie fertig ist;
  - hat sich die Forschung seit dem letzten Laden nicht geändert und ist der Stammbaum in der App noch genau der
    geladene, lädt die App ihn weder erneut herunter noch erneut ein;
  - beim Verfolgen meldet die Forschung eine Änderung, sobald ihr Stammbaum fertig ist.

<!-- zdroj: app:src/ui/research-ui.ts startLiveFollow :2376 (opts.auto), researchReconnectOnly · strings.ts live.followLive, live.followingTree, live.followStarted, live.followMoved, live.liveEndedArchive, live.liveEndedNoAgent · CHANGELOG.cs.md 3.13.1 · spec 011 · app:669c08f0 src/research-tree-file.ts (ged.stale → tree.ged?stale=1, treeFileState preparing; ged.etag → If-None-Match jen u stromu přesně z toho souboru, 304 = strom zůstává), src/ui/research-ui.ts livePreparing, strings.ts research.newerPreparing · research:94d75934 src/core/liveged.ts (strom pro aplikaci jednou pro stav a variantu, na disku i po restartu mostu), src/core/live.ts (change až s hotovým stromem; ETag u tree.ged) · CHANGELOG.cs.md 1.30.0 -->

<a id="S1.4.1"></a>
### S1.4.1 Der Stammbaum sofort, die Fotos folgen

Ein mit **Live verfolgen** geöffneter Stammbaum erscheint sofort, mit den Fotos, die die App schon hat. Die übrigen
Porträts, Paarfotos, Anhänge und Ausschnitte von Quellen kommen danach aus der Forschung, im Hintergrund. Namen,
Beziehungen und Karten lassen sich sofort ansehen.

- **Reihenfolge:** zuerst die Fotos der Karten auf dem Bildschirm, dann die um die Mitte. Verschieben oder Zoomen des
  Stammbaums ordnet sie neu. Der erste Stapel hat 30 Fotos, die weiteren je 500, höchstens 2 Anfragen zugleich. Jedes
  Foto wird vor dem Einfügen in den Stammbaum an seinem Fingerabdruck geprüft.
- **Ein Foto unterwegs:** die Karte zeigt die Initialen unter einem ruhigen, langsam pulsierenden Schleier; eine Karte
  mit einem älteren Foto zeigt dieses unter dem Schleier, bis das neue kommt. Der Tooltip sagt „Foto wird geladen…“
  oder „Neues Foto wird geladen…“. Ein ankommendes Foto blendet an Ort und Stelle ein; der Stammbaum wird dafür nicht
  neu gezeichnet.
  - Denselben Schleier haben der Dialog der Person, die Personenseite und die Familienseiten im Fenster der App, das
    Fenster **Materialien**, Dateien und Material der Person, Vorschauen von Quellen und Ausschnitten und das Paarfoto
    in der Tabelle. Die Diashow, die Änderungen aus der Forschung und ein Konflikt beim Zusammenführen zeigen die
    Initialen, bis das Porträt kommt.
- **Ein Foto, das nicht kam:** die Karte sieht aus wie eine Karte ohne Foto; Tooltip „Das Foto wurde nicht geladen.“
  Eine Kachel in Listen zeigt ein durchgestrichenes Bild, ab 64 px mit **Nicht geladen**. Der Dialog der Person und
  die Personenseite haben beim Foto **Erneut versuchen**.
- **Die Anzeige Fotos k / n:** sie erscheint, wenn die Fotos länger als 400 ms laden, und zählt die Fotos des ganzen
  Stammbaums („Fotos 846 / 860“, mit „· 3 nicht geladen“) mit einem Fortschrittsbalken. Am Computer steht sie oben, in
  einem Fenster bis 1024 px Breite unten über den Meldungen. Ein Klick zeigt die Einzelheiten: „Noch N · M nicht
  geladen“ und was sich mit dem Stammbaum inzwischen tun lässt: beim Live-Verfolgen „Der Stammbaum kann inzwischen
  angesehen werden.“ (der Stammbaum ist schreibgeschützt, [S1.4](#S1.4)), sonst „Der Stammbaum kann inzwischen
  bearbeitet werden.“ Sind alle da, zeigt sie 2 s lang ✓ und verschwindet.
- **Einige wurden nicht geladen:** die Anzeige verschwindet und es bleibt eine Meldung „Einige Fotos wurden nicht
  geladen (N).“ mit dem Grund („Die Forschung läuft nicht. Strom Research muss gestartet werden.“, „Die Forschung hat
  in 60 s nicht geantwortet.“ oder „Die Forschung hat diese Fotos nicht.“) und **Erneut versuchen**. Das lädt die
  nicht geladenen Fotos erneut, und die Anzeige zählt wieder den ganzen Stammbaum.
- **Prüft der Code:** ein Foto unterwegs löscht oder überschreibt nie ein gespeichertes Foto.
  - Wird der Stammbaum gespeichert, bevor die Fotos kommen, behalten Porträt und Paarfoto das bisherige Foto (oder
    keines). Die noch nicht gekommenen Fotos merkt sich die App beim Stammbaum und holt sie bei der nächsten Verbindung
    zur Forschung.
  - Der Dialog der Person schreibt das Foto nur, wenn es im Dialog geändert wurde. Ein Foto, das bei offenem Dialog
    kommt, wird dort ergänzt.
  - **Rückgängig**, **Wiederholen**, ein verworfener Dialog, die tägliche Sicherung und weitere Fenster behalten die
    Fotos, die schon gekommen sind.
  - **Ausschnitt bearbeiten** bei einem Porträt oder Paarfoto wartet auf das Foto: „Der Ausschnitt lässt sich
    bearbeiten, sobald das Foto geladen ist.“
  - Das Ankommen eines Fotos ist keine Änderung des Stammbaums: es lässt sich nicht als Schritt rückgängig machen, und
    ein mit der Forschung abgeglichener Stammbaum bleibt abgeglichen.
  - Fotos, die nicht kamen, nimmt die Forschung nicht als entfernt: bis sie kommen, fügen Schreibvorgänge des
    Stammbaums nur hinzu ([S8.5](S8-where-the-data-are.md#S8.5)).
- **Grenzen:**
  - nur beim Öffnen des Stammbaums mit **Live verfolgen**. Eine neuere Version während des Verfolgens, die Übernahme
    eines Stammbaums und andere Ladevorgänge einer Version aus der Forschung bringen die Fotos wie bisher zugleich mit
    dem Stammbaum;
  - eine Forschung bis 1.29 schickt den Stammbaum mit den Fotos in der Datei: der Stammbaum erscheint erst mit ihnen;
  - ein während des Ladens geöffneter anderer Stammbaum bricht das Laden ab, und die Anzeige verschwindet. Ein Foto
    landet nur in dem Stammbaum und dem Ladevorgang, für den es geholt wurde;
  - weitere Fenster der App ([A6.8](A6-views.md#A6.8)) haben keine Ladezustände und zeigen den Stammbaum ohne Schleier;
  - bei einem verschlüsselten Stammbaum kommen Dateien und Ausschnitte von Quellen, die bis zum Schließen der Seite
    nicht kamen, erst mit der nächsten Version aus der Forschung;
  - auf einem quer gehaltenen Telefon klappt das aufgeklappte Panel der Forschung bei der Anzeige zu
    ([S4.1](S4-research-from-the-app.md#S4.1)).
- **Bedienung:** App: **Live verfolgen**; die Anzeige **Fotos k / n** (Klick: Einzelheiten, Esc schließt sie); die
  Meldung → **Erneut versuchen**; Dialog der Person und Personenseite → **Erneut versuchen**.
- **Gilt seit:** App 3.31.0, Forschung 1.30.0

<!-- zdroj: dirigent:spec/116-fotky-nacitat-pozdeji K1.2–K1.6, K2.1 · prace/1119-app-116-fotky (Výsledek, odchylky) · app:45dd3426 src/image-loads.ts (ImageLoadQueue, IMAGE_FIRST_BATCH 30, takePendingImages, write jen do současného stromu a načtení, bez kroku zpět), src/research-image-refs.ts IMAGE_BATCH 500, IMAGE_CONCURRENCY 2, IMAGE_ANSWER_MS 60 s · src/ui/research-ui.ts startLiveFollow (ged.imagesByHash → later, priority TreeRenderer.imagePriority: na obrazovce, pak kolem středu; setPendingImages I1; researchResumePendingImages) · research:33ac2e38 (1.30.0) src/core/live.ts ged.imagesByHash · app:95e68ac7 (K1.5 I1–I7: TreeMetadata.pendingImages, notes(records) bez záznamů u šifrovaného stromu) · 87b9ec30 src/ui/image-slot.ts (data-img-state loading/refresh/failed, IMG_PULSE_MS, TILE_NOTE_MIN_PX 64) · ad9e82a0 src/ui/person-modal.ts renderPhotoState, photoModel · 05cf608c, e188236f (další místa) · 4afeb434, b1bcb476 src/ui/image-load-chip.ts CHIP_SHOW_MS 400, BUSY_DONE_MS, detailNote(readOnly), failedReasonText (offline → timeout → missing), treeSwitched · 4afeb434 src/image-loads.ts abort (strom už není současný) · strings.ts photos.loading, loadingNew, failed, failedNew, tileFailed, recropWait, chipLabel, chipFailed, detailLeft, detailEditable, detailViewOnly, someFailed, whyMissing · busy.errOffline, errTimeout, retry · a2feee6b (≤ 1024 dole nad oznámením) · 7be40d24 src/ui/landscape-panel-fold.ts · CHANGELOG.cs.md 3.31.0 -->

<a id="S1.4.2"></a>
### S1.4.2 Ausgaben warten auf die Fotos

Eine Ausgabe, die angefordert wird, während die Fotos des Stammbaums noch kommen ([S1.4.1](#S1.4.1)), wartet auf sie
und entsteht erst mit ihnen. Ohne die Fotos entsteht sie nur auf ausdrückliche Wahl.

- **Welche Ausgaben:** Poster drucken, PNG-Bild und SVG-Vektor, Personenseite, Familienseiten, Familienbuch, die
  Datensicherung (**In Datei speichern**, Schreiben in die verknüpfte Datei, eine Datei zum Teilen, **Exportieren**
  der Sicherung) und der GEDCOM-Export. Eine CSV-Datei hat keine Fotos und wartet nicht.
- **Warten:** die Schaltfläche oder Zeile der Ausgabe sagt „Warten auf Fotos · k von n“, und ein zweiter Klick startet
  nichts. Eine Meldung mit dem Namen der Ausgabe („Poster drucken“, „Familienbuch“…) zählt die Fotos mit einem Balken
  und hat **Abbrechen**. Die Anzeige **Fotos k / n** blendet sich inzwischen aus.
- **Wenn einige nicht kamen:** eine Meldung „Einige Fotos wurden nicht geladen (N).“ mit dem Grund und drei
  Möglichkeiten: **Erneut versuchen**, **Ohne N Fotos fortfahren** (die Ausgabe aus den Daten, wie sie sind) und
  **Abbrechen**.
- **Prüft der Code:** eine Ausgabe enthält nie den Schleier oder das Zeichen eines nicht geladenen Fotos. Der Druck
  lädt und zeichnet vor dem Öffnen des Drucks auch die Bilder, die die Seite erst beim Scrollen lädt.
- **Bedienung:** App: die Ausgabe wie immer; in der Meldung **Abbrechen**; im Hinweis **Erneut versuchen**, **Ohne
  N Fotos fortfahren**, **Abbrechen**.
- **Gilt seit:** App 3.31.0

<!-- zdroj: dirigent:spec/116-fotky-nacitat-pozdeji K1.7 · app:9d326239 src/ui/output-images.ts imagesBeforeOutput, waitingLine, someFailedText, toastImagesView (retry, without, cancel; suspendImageLoadChip), imagesReadyForPrint · src/image-loads.ts awaitTreeImages · volající: src/ui/export-image-ui.ts (poster, png, svg), person-page-ui.ts (personPage, familyPages), book-ui.ts (book, familyPages), file-copy-ui.ts, file-access-ui.ts, share-ui.ts (backup), encryption-ui.ts (backup, gedcom; csv ne) · src/ui/fan-view.ts (live false: fotka nebo nic) · strings.ts photos.waiting, continueWithout, out.*, busy.kOfN, buttons.cancel · CHANGELOG.cs.md 3.31.0 -->

<a id="S1.5"></a>
## S1.5 Wenn die Forschung nicht läuft oder die Verbindung nicht geht

Erreicht die App die Forschung nicht, ändert sich der Stammbaum in der App nicht, und Änderungen darin warten. Was
genau geschah, zeigt die App im Fenster **Verbindung zur Forschung fehlgeschlagen**.

| Ursache | Was die App zeigt | Was hilft |
|---|---|---|
| der Browser lässt die Seite nicht zu Geräten im lokalen Netzwerk | **… blockiert die Verbindung** (Name des Browsers) | **Apps auf dem Gerät** (Brave: **Localhost-Zugriff**) in den Website-Einstellungen erlauben |
| der Browser fragt erst noch | **Der Browser wartet auf eine Erlaubnis** | die Frage des Browsers beantworten |
| die Brücke läuft nicht | **Die Forschung antwortet nicht** | die Forschung starten; an der neuen Adresse verbindet sie `strom app --live` |
| an der Adresse antwortet eine andere Brücke (geänderter Schlüssel, anderer Stammbaum) | **Die Forschung hat die Verbindung abgelehnt** | `strom app --live` |
| Safari | **Safari verbindet sich nicht mit der Forschung** | den Link in Chrome oder Edge öffnen (**Link kopieren**) |

- **Grenzen:**
  - Das Fenster sagt immer, dass sich nichts geändert hat und der Stammbaum bleibt, wie er war. **Erneut
    versuchen** versucht die Verbindung erneut.
  - Ein Stammbaum aus der Forschung lässt sich auch dann bearbeiten, wenn die Forschung nicht läuft. Die Änderungen
    werden gesendet, sobald sich die Forschung wieder verbindet.
  - Die Brücke läuft, antwortet aber nicht: es hilft `strom live stop` und ein neuer Start.
- **Bedienung:** App: **Erneut versuchen**, **Schließen**, **So erlauben** · Terminal: `strom app --live`,
  `strom live stop`
- **Gilt seit:** App 3.9.0

<!-- zdroj: app:src/ui/research-ui.ts:1406 showResearchConnectFailed (denied, prompt, down, refused, safari) · src/local-network.ts · strings.ts sync.stateBlocked, sync.blockedSub, sync.settingApps, sync.settingBrave, sync.bridgeDownSub, sync.notRespondingSub, sync.addressRefusedSub, researchOthers.offPanel -->

<a id="S1.6"></a>
## S1.6 Ältere und neuere Versionen

App und Forschung erscheinen getrennt. Die Forschung sagt der App im Status, was sie kann, und die App schaltet danach
nur ein, was die Forschung annimmt. Die Forschung wiederum wählt nach der Version der App, was sie ihr sendet.

- **Grenzen:**
  - **Ältere Forschung** (ohne automatisches Senden oder ohne Titel): die App zeigt **Die Forschung hat eine ältere
    Version (v)** mit dem Angebot **Forschung aktualisieren**. Änderungen werden dann nur von Hand gesendet: die App
    startet die Forschung im Terminal, und diese holt sie ab. Titel bleiben bis zur Aktualisierung nur in der App.
  - **Neue Version der Forschung verfügbar:** die App zeigt **Neue Version Strom Research …** mit der Schaltfläche
    **Aktualisieren**. Was gerade läuft, endet mit der aktuellen Version.
  - **Eine Forschung, die eine neuere Version des Programms `strom` geschrieben hat:** ein älteres Programm öffnet sie
    nicht und schreibt nicht in sie.
  - **Ein Stammbaum, den eine neuere Version der App gespeichert hat:** in der App ist er schreibgeschützt, bis die
    App aktualisiert wird.
- **Bedienung:** App: **Forschung aktualisieren**, **Erneut prüfen** · Terminal: `strom update`
- **Gilt seit:** App 3.9.0 (Forschung 1.12.0); schreibgeschützter Stammbaum seit App 3.19.0
- **Ab App 3.22.0:** Linien aus der App und das Panel ohne Verbindung schalten sich nur mit der Forschung 1.26.0
  ein ([S4](S4-research-from-the-app.md)).

<!-- zdroj: app:src/ui/research-update-ui.ts · strings.ts researchUpdate.line, researchUpdate.titlesLine, research.updateAvailable, research.updateBusyHint, storage.newerReadOnly · research:src/core/live.ts (v1.25.2) status locked :1516, :2810, appVersionOf :1492 · CHANGELOG.cs.md 3.19.0 -->

<a id="S1.7"></a>
## S1.7 Mehrere Forschungen auf einem Computer

Jeder Stammbaum aus einer Forschung hat eine eigene Brücke. Die App fragt auch die Brücken von Stammbäumen, die gerade
nicht geöffnet sind, und zeigt ihren Status im Stammbaum-Umschalter.

- **Grenzen:**
  - Marken am Stammbaum im Umschalter: **live** (wird verfolgt), **läuft** oder **N Richtungen** (ein Agent
    arbeitet), **N offen** (Dinge zu erledigen), **läuft nicht**.
  - Gefragt wird immer nur eine Brücke auf einmal und nur, wenn die Seite sichtbar ist: zuerst nach 3 Sekunden, dann
    jede Minute. Auf eine Antwort wartet die App höchstens 1,5 Sekunden.
  - Eine nicht laufende Forschung verbindet sich wieder, wenn der Stammbaum aus der Forschung geöffnet wird
    (`strom app`).
- **Bedienung:** App: Stammbaum-Umschalter; Panel der Forschung, Zeile **Anderswo**
- **Gilt seit:** App 3.13.1

<!-- zdroj: app:src/research-others.ts ResearchTreeKind, OTHER_BRIDGES_TIMINGS · src/ui/research-others-ui.ts · strings.ts researchOthers.otherTreeLabel, researchOthers.offReconnect · CHANGELOG.cs.md 3.13.1 -->

<a id="S1.8"></a>
## S1.8 Die Daten bleiben auf dem Computer

Die App hält Stammbäume im Speicher des Browsers auf diesem Gerät. Die Forschung hält ihren Stammbaum in ihrem Ordner
auf dem Datenträger. Zwischen beiden geht der Stammbaum nur über die Brücke auf diesem Computer ([S1.1](#S1.1)).

- **Grenzen:**
  - Jeder Browser hat einen eigenen Speicher. Ein in Chrome geöffneter Stammbaum ist nicht in Edge.
  - Der Stammbaum in der App und der Stammbaum in der Forschung sind zwei Kopien. Maßgeblich ist der Stammbaum in der
    App, die Forschung hat eine eigene Kopie, und was die Forschung nicht schreibt, ist in der App immer zu sehen
    ([S2](S2-edits-from-the-app.md)).
  - Ab der Forschung 1.35.0 hat die Forschung auch die Porträts, Paarfotos und Anhänge des Stammbaums. Was wo
    gespeichert ist und was nur im Browser liegt, beschreibt [S8](S8-where-the-data-are.md).
- **Gilt seit:** App 3.0.0

<!-- zdroj: app:src/storage.ts strom-db, strom-originals · strings.ts treeSettings.principles · research:src/core/live.ts 127.0.0.1 · S8: dirigent:spec/108-kde-se-co-uklada, research:c9a4b614 CHANGELOG.cs.md 1.35.0 -->

<a id="S1.9"></a>
## S1.9 Forschung an: der Schalter der Brücke am Stammbaum

Jeder Stammbaum aus einer Forschung auf diesem Computer hat in der App den Schalter **Forschung an**. Er zeigt den
wirklichen Zustand der Brücke: an, wenn die Brücke antwortet, sonst aus. Eine eingeschaltete Brücke läuft, bis sie mit
dem Schalter oder `strom live stop` ausgeschaltet wird, bis der Computer heruntergefahren wird, oder wie es die
Einstellung **Forschung bei Untätigkeit ausschalten** sagt.

- **Grenzen:**
  - Das Ausschalten beendet die Brücke wie `strom live stop`, nur behält die Brücke ihre Adresse (Port und
    Schlüssel). Eine ausgeschaltete Brücke bleibt aus: neue Arbeit im Stammbaum bringt sie nicht zurück. Der
    Stammbaum in der App bleibt und lässt sich weiter bearbeiten ([S1.5](#S1.5)). Unter dem Schalter steht
    „Ausgeschaltet. Bleibt aus, bis die Forschung wieder eingeschaltet wird.“
  - Eine wegen Untätigkeit ausgeschaltete Brücke kommt mit neuer Arbeit im Stammbaum von selbst zurück, an derselben
    Adresse. Unter dem Schalter steht „Nach einer Zeit ohne Arbeit ausgeschaltet. Neue Arbeit im Stammbaum schaltet
    sie wieder ein.“
  - Das Einschalten schickt der Forschung einen Link, der nur die Brücke an ihrer letzten Adresse startet, ohne
    Fenster. Wenn nichts passiert oder die Forschung sich aus der App nicht einschalten lässt, zeigt die App den Befehl
    `strom live start` (im Terminal im Ordner des Stammbaums auszuführen) mit der Schaltfläche **Kopieren**. Eine
    ältere Forschung, die sich aus der App nicht ausschalten lässt, zeigt ebenso den Befehl `strom live stop`.
  - Der Schalter zeigt inzwischen den neuen Stand und **Wird eingeschaltet…** (**Wird ausgeschaltet…**). Antwortet
    die Brücke nicht in 30 s, geht der Schalter zurück, und an ihm steht **Die Forschung hat sich in 30 s nicht
    gemeldet. Strom Research muss gestartet werden.** mit dem Befehl und **Erneut versuchen**
    ([A9.7.2](A9-using-the-app.md#A9.7.2)).
  - Nach dem Herunterfahren oder Neustart des Computers läuft die Brücke nicht und startet nicht von selbst. Der
    Mensch schaltet sie ein: im Panel der Forschung **Einschalten**, oder `strom live start`.
  - **Forschung bei Untätigkeit ausschalten** hat zwei Wahlmöglichkeiten: **Bis zum Herunterfahren des Computers**
    (Standard) und **Nach 2 Stunden ohne Arbeit**. Sie gilt für alle Stammbäume auf diesem Computer, und die Forschung
    hält sie (`live.idleMinutes` 0 oder 120). Laufende Brücken übernehmen sie innerhalb einer Minute. Ein im Terminal
    gesetzter Wert erscheint als **Eigener Wert (N Min.)**. Läuft keine Forschung, die die Wahl annimmt, zeigt die App
    statt der Wahlmöglichkeiten die Befehle für das Terminal.
  - Auf Telefon und Tablet gibt es keinen Schalter (die Forschung läuft auf einem Computer). Eine Kopie eines
    Stammbaums aus einer Forschung hat in Stammbäume verwalten den Schalter ausgeschaltet; sein Einschalten öffnet
    **Forschung für eine Kopie** ([S1.10.1](#S1.10.1)).
- **Bedienung:** App: der Schalter **Forschung an** im Panel der Forschung (ein Stammbaum, der nicht live verfolgt
  wird, und nach dem Ende des Verfolgens) und in **Stammbäume verwalten** in der Zeile des Stammbaums; im Panel der
  Forschung, wenn die Forschung nicht läuft: **Einschalten**; **Einstellungen** → **Forschung auf diesem Computer** →
  **Forschung bei Untätigkeit ausschalten**. Terminal: `strom live start`, `strom live stop`, `strom config set
  live.idleMinutes 0` (bis zum Herunterfahren des Computers) oder `120` (nach 2 Stunden ohne Arbeit).
- **Gilt seit:** App 3.25.0, Forschung 1.29.0. Der Stand am Schalter und der Satz nach 30 s seit App 3.30.0.

<!-- zdroj: research:src/core/live.ts liveWrite (POST <token>/live {idleMinutes 0…10080} → strom config set live.idleMinutes; {do: stop} → konec stopped, adresa zůstává), liveState (/status live idleMinutes, idleChoices), IDLE_READ_MS 60 s, reviveLive + endedIdle (zpět s prací jen konec idle; bez slova: zpět s menu, prací, aktualizací), stop SIGTERM → signal · src/core/config.ts DEFAULT_LIVE_IDLE_MINUTES 0, LIVE_IDLE_AFTER_MINUTES 120, LIVE_IDLE_CHOICES, LIVE_IDLE_MAX_MINUTES · src/core/links.ts LINK_LIVE_DOS start · src/commands/links.ts startBridge (bez okna) · app:src/ui/research-live-ui.ts researchLiveState (onComputer, link.copy, features live.stop / live.start), fillResearchLiveSlot, fillResearchLiveStart, renderResearchLiveSettings (LIVE_IDLE_FOREVER, LIVE_IDLE_TWO_HOURS, idleCustom), COMMAND_START / COMMAND_STOP · src/ui/research-ui.ts researchLiveSlot (panel po skončení sledování, idle, start) · src/ui/tree-management.ts researchLiveSlotHtml · strings.ts researchLive.* · index.html settings-group-research-live · spec 064 K1.1–K2.3 · 3.30.0: app:cd35804c src/ui/research-live-ui.ts START_CONFIRM_MS 30 s, researchLiveTimedOut (liveSilent, COMMAND_START, retry) · src/ui/switch-pend.ts (turningOn, turningOff) -->

<a id="S1.10"></a>
## S1.10 Eine Forschung, ein Stammbaum: Kopie ohne Forschung

In eine Forschung schreibt nur ein Stammbaum in der App: der, der mit der Forschung entstanden ist oder sie übernommen
hat. Jede Kopie eines Stammbaums aus einer Forschung ist ein Stammbaum ohne Forschung. Sie sendet nichts an die
Forschung: weder von selbst noch mit der Schaltfläche noch beim ersten Schreiben der Dateien.

- **Was eine Kopie ist:** **Kopie des ganzen Stammbaums** (früher **Duplizieren**,
  [A14.3](A14-trees-and-structure.md#A14.3)), der bisherige Stammbaum nach **Als Kopie öffnen** bei einem Stammbaum
  aus einer Forschung (der neue Stammbaum aus der Forschung bekommt ihre Aktualisierungen, der Stammbaum mit den
  Änderungen bleibt, wie er ist, als Kopie; [S1.2](#S1.2)), das zweite Laden der JSON-Datei derselben Forschung, eine
  Zusammenführung in einen neuen Stammbaum ([A8.10](A8-merging-trees.md#A8.10)) und Stammbäume, die aus der Sicherung
  aller Stammbäume als neue wiederhergestellt wurden.
- **Wie sich eine Kopie zeigt:** in Stammbäume verwalten und in Schritt 1 des Zusammenführungs-Assistenten „Kopie des
  Stammbaums „{Name}“ · ohne Forschung“, mit ausgeschaltetem Schalter **Forschung an**. Aktionen der Forschung hat sie
  nicht; ⋯ bietet nur **Forschung einschalten…**.
- **Änderungen aus der Forschung anfordern:** der Link, mit dem die Forschung um die Änderungen bittet, sendet immer
  nur den Stammbaum, der zur Forschung gehört. Die Frage, welcher Stammbaum gesendet werden soll, gibt es nicht mehr.
- **Grenzen:** eine Kopie einer Kopie trägt den Namen dieser Kopie. Ein neuer Stammbaum aus einer Auswahl und
  Stammbäume aus einer Aufteilung sind ebenfalls ohne Forschung ([A14](A14-trees-and-structure.md#A14)).
- **Bedienung:** Stammbäume verwalten ([A14.1](A14-trees-and-structure.md#A14.1)).
- **Gilt seit:** App 3.32.0. Vorher blieb eine Kopie mit der Forschung des Originals verbunden, wurde aus ihr nur
  nicht aktualisiert.

<!-- zdroj: app:7d4236f8 (134 bod 11, 13: kopie stromu výzkumu nic nezapisuje do výzkumu originálu) · src/tree-manager.ts canSendToResearch (isResearchOwner), duplicateTree copyOf · src/research-owner.ts · src/ui/research-ui.ts sendChangesToResearch (?send= jen vlastník, „Only the research's owner is sent“) · f3c66503 (sloučení do nového stromu a obnovená záloha = kopie bez výzkumu) · src/tree-row.ts treeOriginLine · strings.ts research.copyOf, structure.turnOnResearch · dirigent:prace/_drobnosti/doc.md 134 bod 11+13 -->

<a id="S1.10.1"></a>
### S1.10.1 Forschung für eine Kopie

Eine Kopie kann eine eigene, neue Forschung bekommen oder die Forschung des Originals übernehmen. Beides bietet das
Fenster **Forschung für eine Kopie**: „„{Kopie}“ ist eine Kopie des Stammbaums „{Original}“. In eine Forschung
schreibt nur ein Stammbaum, daher erhält die Kopie eine eigene, neue.“

- **Neue Forschung anlegen:** das Feld **Ordner der neuen Forschung** ist mit dem Namen der Kopie vorausgefüllt (mit
  dem Pfad, in dem die Forschung auf diesem Computer Forschungen anlegt, wenn die Forschung ihn mitteilt). Danach geht
  das Anlegen der Forschung weiter wie bei **Forschung starten** ([S4](S4-research-from-the-app.md)). In die neue
  Forschung kommen keine Nummern von Personen und Quellen einer anderen Forschung; die Kopie bekommt die Nummern der
  neuen Forschung.
- **Forschung von „{Original}“ übernehmen…:** nur wenn das Original eine Forschung hat; das Fenster sagt dann auch
  „Die Forschung „{Nummer}“ bleibt beim Stammbaum „{Original}“.“ Die Übernahme wird mit einer Warnung bestätigt: „Der
  Stammbaum „{Original}“ wird von der Forschung „{Nummer}“ getrennt und schreibt nicht mehr hinein. Schreiben wird nur
  die Kopie.“ und „Das Original bleibt als Stammbaum ohne Forschung.“, Schaltfläche **Forschung übernehmen**. Die
  Übernahme geschieht nur in der App; an die Forschung wird nichts gesendet.
- **Grenzen:** das Fenster gibt es nur auf einem Computer, auf dem sich eine Forschung aus der App anlegen lässt; nicht
  beim Beispiel-Stammbaum.
- **Bedienung:** Stammbäume verwalten, der Schalter bei einer Kopie; ⋯ bei einer Kopie → **Forschung einschalten…**.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:023879dd src/ui/research-adopt-ui.ts showCopyResearchDialog (složka = název kopie, treesRoot, copyResearchStays a Převzít jen u vlastníka originálu, is-danger potvrzení), src/research-owner.ts transferResearchTie (jen v aplikaci), src/research-link.ts (bez REFN P…/S… jiného výzkumu, K5.4) · a236a31e (název složky i přes soubor v Safari, cesta výzkumů) · strings.ts structure.copyResearch*, createResearch, takeOver* · spec 139 K5.1–K5.4 -->

<a id="S1.10.2"></a>
### S1.10.2 Einmaliges Trennen von Stammbäumen, die eine Forschung teilten

Stammbäume, die vor App 3.32.0 eine Forschung teilten (ältere Kopien oder zwei Stammbäume derselben Forschung), werden
beim ersten Start der neuen Version einmal getrennt. Die Forschung behält einen Stammbaum, die anderen sind Kopien ohne
Forschung.

- **Welcher Stammbaum bleibt:** der Stammbaum, der keine Kopie ist; von mehreren solchen der älteste. Sind alle Kopien,
  bleibt die älteste Kopie, wie sie ist, und schreibt weiterhin nichts in die Forschung.
- **Die anderen:** vor dem Trennen bekommen sie die Sicherung **Vor der Anpassung der Daten an eine neue Version**
  ([S6.5](S6-tree-from-another-program.md#S6.5)); die Daten bleiben unverändert. Ein gesperrter verschlüsselter
  Stammbaum wird weder gelesen noch gesichert; nur sein Eintrag in Stammbäume verwalten ändert sich.
- **Beim ersten Öffnen** eines getrennten Stammbaums erscheint einmal das Fenster **Kopie ohne Forschung**: „Der
  Stammbaum „{Name}“ war eine Kopie, die mit der Forschung des Stammbaums „{Original}“ verbunden war. Die Verbindung
  wurde aufgehoben, damit nur ein Stammbaum in die Forschung schreibt. Eine eigene Forschung lässt sich unter
  Stammbäume verwalten starten.“ Hat die Kopie vorher Änderungen an die Forschung gesendet:
  - warten sie in der Forschung: „Davor hat die Kopie Änderungen an diese Forschung gesendet ({Datum}). Die Änderungen
    warten in der Forschung und lassen sich dort verwerfen.“;
  - sind sie geschrieben: „…Die Forschung nimmt sie mit einem Schritt in ihrem Terminal zurück:“ und der Befehl
    `strom sync undo I0042` mit **Kopieren**; bei bekannter Unterlage auch **In der Forschung zurücknehmen**, sonst
    `I…` und „I… steht für die Nummer dieser Sendung in der Forschung (strom input list zeigt sie).“
    ([S2.6](S2-edits-from-the-app.md#S2.6)).

  Das Fenster hat **Schließen** und, wo es geht, **Forschung starten**.
- **Grenzen:** die Reparatur läuft einmal; ein älteres zurückgebrachtes Register der Stammbäume wird erneut
  durchgesehen.
- **Gilt seit:** App 3.32.0

<!-- zdroj: app:e4e3eeea src/tree-manager.ts repairSharedResearchTies (researchTiesRepaired, planSharedTieRepair, backupBeforeTieRepair 'pre-migration' bez čtení zamčeného šifrovaného, detachAsCopy, researchDetached) · src/research-owner.ts planSharedTieRepair (keeper: bez copyOf, nejstarší; jinak nejstarší kopie) · src/ui/research-detached-ui.ts showResearchDetached (jednou, sentAfterCopy pending/undo step, adoptTree) · strings.ts research.detached*, undoStep*, backups label pre-migration · dirigent:prace/_drobnosti/doc.md 134 bod 13 -->
