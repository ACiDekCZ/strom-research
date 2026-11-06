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
  - Die Brücke endet von selbst, wenn sie zwei Stunden lang niemand etwas fragt und dabei niemand im Stammbaum
    arbeitet. Die regelmäßige Statusabfrage der App hält die Brücke nicht am Leben.
  - Startet die Brücke von selbst neu (Aktualisierung, Untätigkeit, Absturz), behält sie ihre Adresse: denselben Port,
    wenn er frei ist, und denselben Schlüssel. Die App verbindet sich dann ohne neuen Link.
  - `strom live stop` verwirft den Schlüssel: die App verbindet dann erst wieder `strom app`. Ist der Port von einem
    anderen Programm belegt, nimmt die Brücke einen anderen Port, und die App braucht einen neuen Link.
  - Einen Schreibvorgang lehnt die Brücke ab, wenn der Stammbaum auf einem anderen Computer versiegelt ist, wenn die
    Dateien des Stammbaums in einem Cloud-Ordner noch nicht heruntergeladen sind und wenn der Datenträger voll ist.
    Die Änderungen warten dann in der App ([S2](S2-edits-from-the-app.md)).
- **Bedienung:** Terminal: `strom live` (läuft die Brücke?), `strom live start`, `strom live stop` (`--forget`
  vergisst auch den Port), `strom config set live.idleMinutes <Minuten>` (0: nie von selbst). Das Protokoll des
  Laufs liegt im Ordner der Forschung in `.strom/live.log`.
- **Gilt seit:** Forschung 1.0.0. Dieselbe Adresse nach einem Neustart seit 1.8.0, `live.idleMinutes` seit 1.25.0.

<!-- zdroj: research:src/core/live.ts (v1.25.2) header :1-80, token crypto.randomBytes :1702, leaked :1809, :1995, LIVE_IDLE_MS / live.idleMinutes :1705, live-last.json :518, seal.foreign / tree.not-downloaded / disk.full · src/commands/start.ts live · src/core/config.ts live.idleMinutes -->

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
    Kopie öffnen** soll. Vor der Aktualisierung wird eine Sicherung gespeichert.
  - Safari erlaubt einer Webseite keine Verbindung mit einem Programm auf diesem Computer. `strom app` öffnet Safari
    darum nie. Ohne geeigneten Browser übernimmt die installierte App die Datei, oder die Datei
    `output/tree-strom.ged` aus dem Ordner der Forschung lässt sich in das Fenster der App ziehen.
  - Chrome und Edge fragen beim ersten Mal nach der Erlaubnis für den Zugriff auf Geräte im lokalen Netzwerk. Ohne sie
    erreicht die App die Forschung nicht ([S1.5](#S1.5)).
- **Bedienung:** Terminal: `strom app`, `strom app --live`. App: **Forschung → Weitere Aktionen → Forschung für
  diesen Stammbaum…**
- **Gilt seit:** App 3.0.0, Forschung 1.0.0

<!-- zdroj: research:src/commands/start.ts (v1.25.2) app, liveAppUrl / importAppUrl, Safari · app:src/research-link.ts:584 parseLoopbackUrl, :747 decideResearchOpen · src/ui/research-ui.ts:1088 initExternalOpen, :1350 importResearchFromUrl · src/local-network.ts · strings.ts research.notLocal, research.editedMessage, research.safariBlocked -->

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
| Kopie | ohne Marke | eine ältere Kopie eines Stammbaums aus der Forschung (**Als Kopie öffnen**, Duplikat, zweiter Import); wird aus der Forschung nicht mehr aktualisiert |

- **Grenzen:** ob ein Stammbaum Forschung oder Archiv ist, entscheidet die Forschung, nicht die App. Umschalten
  lässt es sich nur in der Forschung.
- **Bedienung:** App: Stammbaum-Umschalter. Terminal: Menü der Forschung.
- **Gilt seit:** App 3.12.0 (Name Strom-Archiv), Marken im Umschalter seit 3.16.0

<!-- zdroj: app:src/research-link.ts _STROM_TREE, _STROM_HEAD · src/types.ts:1695 ResearchLink (copy, mode) · src/research-others.ts researchAgentless · src/ui/research-sync-ui.ts researchKindOf :654, researchAgentAway · strings.ts treeSwitcher.kindArchive, kindResearch · spec 002 · CHANGELOG.cs.md 3.12.0, 3.16.0 -->

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

<!-- zdroj: app:src/ui/research-ui.ts startLiveFollow :2376 (opts.auto), researchReconnectOnly · strings.ts live.followLive, live.followingTree, live.followStarted, live.followMoved, live.liveEndedArchive, live.liveEndedNoAgent · CHANGELOG.cs.md 3.13.1 · spec 011 -->

<a id="S1.5"></a>
## S1.5 Wenn die Forschung nicht läuft oder die Verbindung nicht geht

Erreicht die App die Forschung nicht, ändert sich der Stammbaum in der App nicht, und Änderungen darin warten. Was
genau geschah, zeigt die App im Fenster **Verbindung zur Forschung fehlgeschlagen**.

| Ursache | Was die App zeigt | Was hilft |
|---|---|---|
| der Browser lässt die Seite nicht zu Geräten im lokalen Netzwerk | **{Browser} blockiert die Verbindung** | **Apps auf dem Gerät** (Brave: **Localhost-Zugriff**) in den Website-Einstellungen erlauben |
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
  - **Neue Version der Forschung verfügbar:** die App zeigt **Neue Version Strom Research {v}** mit der Schaltfläche
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
  - Marken am Stammbaum im Umschalter: **live** (wird verfolgt), **läuft** oder **{n} Richtungen** (ein Agent
    arbeitet), **{n} offen** (Dinge zu erledigen), **läuft nicht**.
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
- **Gilt seit:** App 3.0.0

<!-- zdroj: app:src/storage.ts strom-db, strom-originals · strings.ts treeSettings.principles · research:src/core/live.ts 127.0.0.1 -->
