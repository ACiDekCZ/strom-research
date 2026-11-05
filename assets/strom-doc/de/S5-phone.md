<a id="S5"></a>
# S5 Telefon

Wie sich das Telefon mit der Forschung auf dem Computer verbindet, was darauf zu sehen und zu tun ist und wann die
Verbindung nicht zustande kommt. Beschrieben werden die Strom-App 3.21.2 (und die Forschung 1.25.2). Änderungen aus einer neueren Version tragen deren Nummer.
Das Telefon öffnet nicht die Strom-App: Es öffnet die Seite **Strom-Forschung**, die die Forschung vom Computer im
Heimnetz sendet.

<a id="S5.1"></a>
## S5.1 Die Verbindung mit dem Telefon gehört dem Computer und nur ein Mensch schaltet sie ein

Die Verbindung mit dem Telefon gilt für den ganzen Computer, nicht für einen Stammbaum. Einschalten darf sie nur ein
Mensch, durch Bestätigen in einem Fenster am Computer. Ausschalten geht jederzeit; gekoppelte Telefone bleiben nach
dem Ausschalten gekoppelt und verbinden sich nach dem Einschalten wieder.

- **Grenzen:** die Seite für das Telefon sendet die Forschung, nicht die App. Ohne laufende Forschung
  ([S1](S1-connecting-app-and-research.md))
  sieht das Telefon nichts. Das Fenster „Telefonverbindung einschalten?“ erscheint am Computer von selbst; ohne
  Antwort innerhalb von 5 Minuten oder nach **Abbrechen** bleibt die Verbindung aus. Der Agent schaltet die
  Verbindung nicht ein, er darf sie nur ausschalten. Wo die Forschung kein Fenster zeigen kann (Computer ohne
  grafische Oberfläche), wird im Terminal eingeschaltet.
- **Bedienung:** App: **Forschung → Weitere Aktionen → Telefon verbinden…** → **Verbindung einschalten** → am
  Computer das Fenster „Telefonverbindung einschalten?“ → **Einschalten**; **Verbindung ausschalten** im selben
  Dialog · Terminal: `strom phone on`
  (Enter heißt nein), `strom phone off`, `strom phone` (Status); Menü **Einstellungen → Verbindung mit dem Telefon**.
  Ist die Verbindung eingeschaltet, hat die Schaltfläche **Forschung** einen Punkt, und der Menüeintrag heißt
  **Telefon** mit der Marke **an · 2** (Zahl der gekoppelten Telefone).
- **Gilt seit:** Forschung 1.18.0, App 3.14.0

<!-- zdroj: research:src/core/phone.ts askPhoneOn, phoneOff, phoneState · src/core/dialog.ts WAIT_SECONDS · src/commands/phone.ts · src/cli/menu-settings.ts:79 · app:src/ui/phone-ui.ts:150 phoneAvailable, :731, :918 phoneMenuItem · src/ui/research-actions-ui.ts:365, :460 · strings.ts phone.menuConnect, phone.menuOn, phone.statusKeep -->

<a id="S5.2"></a>
## S5.2 Das Telefon wird mit einem QR-Code vom Computer gekoppelt

Das Telefon verbindet sich durch Scannen des QR-Codes, den der Dialog **Telefon verbinden** (oder das Terminal)
zeigt. Der Code gilt 10 Minuten und für ein Telefon. Ein gekoppeltes Telefon merkt sich die Forschung, und die Seite
öffnet sich ohne neuen Code.

- **Grenzen:** das Telefon muss im selben lokalen Netz sein wie der Computer ([S5.5](#S5.5)). Der Code wird in der
  Adresse der Seite nicht an den Computer gesendet und gilt nach dem Koppeln nicht mehr; im Dialog steht dann
  **Neuer Code**. Eine Kopplung gilt 400 Tage. Der Name des Telefons in der Liste ergibt sich aus dem Browser, z. B.
  „iPhone (Safari)“. Nach dem Koppeln öffnet sich auf dem Telefon der Stammbaum, zu dem der Code zuletzt gezeigt
  wurde. Die Seite spricht die Sprache, die die App beim Zeigen des Codes hatte.
  Ein Computer mit mehreren Netzen (WLAN und Kabel) bietet für jedes einen Code an (**Anderes Netz: …**).
- **Bedienung:** App: im Dialog **Telefon verbinden** ein QR-Code mit dem Text **Code noch … gültig, für ein
  Telefon.**;
  nach dem Scannen **Gekoppelt: iPhone (Safari)** und **Weiteres Telefon verbinden** · Telefon: Kamera (iPhone) oder
  Kamera bzw. Google Lens (Android) · Terminal: `strom phone qr` (nur im Terminal des Menschen, nicht für den
  Agenten).
  Auf der Seite fügt **Symbol auf dem Home-Bildschirm** ein Symbol hinzu, das die Seite ohne Koppeln öffnet; das
  geht innerhalb von 10 Minuten nach dem Koppeln.
- **Gilt seit:** Forschung 1.18.0, App 3.14.0

<!-- zdroj: research:src/core/phone.ts PAIR_MS, PHONE_KEY_DAYS, HOME_MS, pairCode, pairPhone, pageLang, phoneName · src/commands/phone.ts qr · app:src/ui/phone-ui.ts · strings.ts phone.qrValid, phone.qrOther, phone.paired, phone.qrExpiredHint -->

<a id="S5.3"></a>
## S5.3 Die Seite des Telefons zeigt die Forschung nur zum Lesen

Die Seite **Strom-Forschung** zeigt den Stand der Forschung eines Stammbaums, entscheidet und startet darin aber
nichts.
Reihenfolge der Teile: **Jetzt** (ob und seit wann gearbeitet wird), **Funde**, **Letzte 24 Std.** (Personen,
Quellen, Speicherungen), **Verlauf** (letzte Änderungen) und zuletzt **Wartet**.

- **Grenzen:** Antworten auf Einträge in **Wartet** geht nur am Computer („Entscheiden lässt sich am Computer in der
  Forschungsübersicht.“,
  [R6](R6-awaiting-action.md), [S4](S4-research-from-the-app.md)). Die Seite zeigt keine Pfade zu Dateien, keine
  Nummern von Datensätzen, keine Ausgaben und nicht das Modell des Agenten. **Funde** sind nur, was der Agent über
  die Familie eingetragen hat (neue Person, Familie, Name, Kind, gefundene, korrigierte oder neu belegte Angabe, neue
  Quelle, gelöster Widerspruch, entschiedene Frage), keine Änderungen des Menschen
  ([S2](S2-edits-from-the-app.md)); standardmäßig der letzten 24 h, ältere bis 31 Tage zurück. **Verlauf** zeigt
  höchstens 20 Änderungen, **Wartet** 20 Einträge mit dem Angebot weiterer; der Rest steht in der
  **Forschungsübersicht** am Computer.
  Beim Strom-Archiv (Stammbaum ohne Agent) zeigt die Seite keine Arbeit des Agenten.
- **Bedienung:** Telefon: Umschalter **Forschungsbäume auf diesem Computer** (alle Stammbäume mit Forschung auf
  diesem Computer, das Archiv mit der Marke **Archiv**); die Seite aktualisiert sich alle 10 s von selbst, solange
  sie zu sehen ist.
- **Gilt seit:** Forschung 1.18.0; Strom-Archiv 1.20.0; Seite auf Polnisch 1.25.0

<!-- zdroj: research:src/core/phone-send.ts state, log LOG_PHONE, waiting WAITING_SHOWN · src/core/phone-finds.ts FINDS_BACK_DAYS · src/core/phone-watch.ts · assets/phone/phone.js (v1.25.2) · assets/lang/cs.json ui.phone.page.* -->

<a id="S5.3.1"></a>
### S5.3.1 Linien vom Telefon

In der Forschung 1.26.0 hat die Seite die Karte **Linien · in der Reihenfolge der Arbeit**. Darin lässt sich eine
Linie nach oben oder unten schieben und pausieren oder wieder starten, wie am Computer ([R2](R2-lines-and-queue.md)).

- **Grenzen:** eine Linie öffnet sich beim Antippen. Beim Strom-Archiv lehnt die Forschung eine Änderung der Linie
  ab. Antworten auf **Wartet** geht weiter nur am Computer.
- **Bedienung:** Telefon: **Nach oben**, **Nach unten**, **Pausieren**, **Wieder starten**.
- **Gilt seit:** Forschung 1.26.0

<!-- zdroj: research:HEAD src/core/phone-send.ts POST /phone/line/<key> · assets/lang/cs.json ui.phone.page.lines.* · CHANGELOG 1.26.0 -->

<a id="S5.4"></a>
## S5.4 Fotos vom Telefon gehen in Stapeln in die Forschung

Fotos von Dokumenten vom Telefon (auf der Seite aufgenommen oder aus der Galerie gewählt) gehen in die Forschung des
gewählten Stammbaums als ein Stapel. Zum Stapel lassen sich eine Notiz und eine Person angeben. **An die Forschung
übergeben** schließt den Stapel ab, und die Forschung macht daraus Aufgaben zum Sortieren, wie bei **Materialien
hinzufügen** ([S4](S4-research-from-the-app.md)).

- **Grenzen:** Fotos werden unverändert gespeichert, in voller Auflösung und außerhalb der Geschichte des
  Stammbaums. Eine Datei, die die Forschung schon hat, wird nicht erneut gesendet („schon in der Forschung, wird
  nicht gesendet“). Ein Foto darf höchstens 500 MB haben. Wo der Computer das Format HEIC nicht umwandeln kann,
  nimmt die Seite nur JPEG an. Ein Stapel, den niemand übergibt, wird eine Stunde nach dem letzten Foto von selbst
  übergeben.
  Auf der Seite aufgenommene Fotos landen nicht in der Galerie des Telefons. Ungesendete Fotos warten auf dem Telefon
  und werden nach Wiederherstellen der Verbindung von selbst gesendet; nach einer Woche ohne Öffnen der Seite kann
  der Browser sie löschen.
  Beim Strom-Archiv werden Fotos im Archiv auf dem Computer gespeichert.
- **Bedienung:** Telefon: **Fotografieren**, **Aus Galerie** → **Fotos zum Senden** → Notiz und Person (ab 2
  Buchstaben, höchstens 8 Vorschläge) → **Fertig** → **An die Forschung übergeben** (beim Archiv **Im Strom-Archiv
  speichern**); **Übergabe abbrechen**, **Nächster Stapel**;
  bei ungesendeten Fotos **Auf dem Telefon speichern**, **Verwerfen**.
- **Gilt seit:** Forschung 1.18.0; **Im Strom-Archiv speichern** 1.20.0

<!-- zdroj: research:src/core/phone-send.ts media, batch/<id>/done, originalMax · src/core/batches.ts PHONE_BATCH_IDLE_MS, batch.why.phone · assets/phone/phone.js · assets/lang/cs.json ui.phone.page.commit*, keep.*, st.already, offline.queue -->

<a id="S5.5"></a>
## S5.5 Wann sich das Telefon nicht verbindet

Das Telefon erreicht den Computer nur im selben lokalen Netz, über die private Adresse des Computers im WLAN oder
am Kabel, und nur wenn die Forschung auf dem Computer läuft. Andere Geräte und der Computer selbst bekommen die Seite
nicht.

- **Grenzen:**
  - anderes Netz: Gast-WLAN, mobile Daten, VPN oder virtuelles Netz reichen nicht; ein Computer ohne lokales Netz
    meldet „Der Computer ist gerade in keinem lokalen Netz.“, und die Verbindung startet von selbst, sobald er mit
    einem WLAN verbunden ist;
  - Firewall: Windows verlangt im Fenster für `node.exe` **Private Netzwerke** anzukreuzen und **Zugriff zulassen**,
    das Netz muss den Typ Privat haben, nicht Öffentlich; der Mac kann **Erlauben** verlangen; unter Linux muss die
    Firewall den Port der Verbindung erlauben;
  - Port: die Forschung versucht die Ports 47800–47819; sind sie belegt, meldet sie „Port … wird von einem anderen
    Programm genutzt.“;
  - Änderung der Adresse des Computers: früher gekoppelte Telefone und Lesezeichen gelten nicht mehr, das Telefon
    muss neu gekoppelt werden (gelber Streifen **Die Adresse des Computers ist jetzt …** mit der Schaltfläche
    **Neuer QR**); es hilft, die Adresse im Router zu reservieren;
  - die Forschung läuft nicht: der Dialog zeigt „Ein Telefon verbindet sich über die laufende Forschung.“, und die
    Verbindung kommt mit der Forschung von selbst zurück;
  - Forschung älter als 1.18.0: „Diese Version der Forschung verbindet kein Telefon.“;
  - der Computer schläft oder ist aus: nach zwei erfolglosen Aktualisierungen zeigt die Seite „Der Computer antwortet
    gerade nicht“ mit den letzten Angaben und ihrer Zeit; die Verbindung wird von selbst wiederhergestellt.
- **Bedienung:** App: meldet sich das Telefon nicht innerhalb einer Minute nach dem Zeigen des Codes, bietet der
  Dialog die Liste **Das Telefon hat sich noch nicht gemeldet. Prüfen:** mit dem Link **So geht’s**; bei einem
  Fehler erscheint der Eintrag **Telefon** mit der Marke **Verbindungsfehler** direkt im Menü **Forschung**. Der
  Dialog bietet das Telefon nur am Computer mit Maus an, nicht in Safari und nur bei einem Stammbaum mit Forschung.
  Das Verfolgen der Forschung ([S4](S4-research-from-the-app.md)), auf dem Telefon über einen Link geöffnet, zeigt
  „Die Forschung läuft auf einem Computer“.
- **Gilt seit:** Forschung 1.18.0, App 3.14.0; Wiederherstellen mit der Forschung nach deren Neustart Forschung
  1.19.0

<!-- zdroj: research:src/core/phone.ts lanAddresses, remoteAllowed, PHONE_PORT, PORT_TRIES, revivePhone · assets/phone/phone.js S.fails · app:src/phone.ts:235 PHONE_SILENT_MS, :286 phoneAddressChanged · src/ui/phone-ui.ts:150 · src/ui/research-ui.ts:1514 · strings.ts phone.err*, phone.check*, phone.down*, phone.older, phone.addr* -->

<a id="S5.6"></a>
## S5.6 Ein getrenntes Telefon sieht nichts mehr

Trennen nimmt einem Telefon den Zugriff. Ausschalten der Verbindung hält die Seite für alle Telefone an, lässt die
Kopplung aber bestehen.

- **Grenzen:** **Trennen** lässt sich nur 15 s zurücknehmen (**Rückgängig**); danach muss das Telefon neu gekoppelt
  werden. Ein getrenntes Telefon sieht auf der Seite „Dieses Telefon ist nicht mit diesem Computer gekoppelt“;
  ungesendete Fotos bleiben darauf und werden nach neuem Koppeln gesendet. Nach einer Änderung der Adresse des
  Computers bietet der Dialog beim neuen Koppeln **Alten Eintrag trennen** für denselben Telefon-Eintrag an.
- **Bedienung:** App: **Telefon verbinden** → **Gekoppelte Telefone · 2** → **Trennen** / **Rückgängig** · Terminal:
  `strom phone list`, `strom phone remove …`; Menü **Einstellungen → Verbindung mit dem Telefon**.
- **Gilt seit:** Forschung 1.18.0, App 3.14.0

<!-- zdroj: research:src/core/phone.ts phoneEntries stale, maybeReplaces · src/core/live.ts (v1.25.2):3755-3857 phone/remove, phone/restore PHONE_RESTORE_MS · src/commands/phone.ts · app:src/ui/phone-ui.ts UNDO_MS · strings.ts phone.rowUnpair, phone.rowUndo, phone.replacesBtn -->

<a id="S5.7"></a>
## S5.7 Die Strom-App auf dem Telefon steuert die Forschung nicht

Die Strom-App, auf einem Telefon oder Tablet geöffnet, verbindet sich nicht mit der Forschung auf dem Computer.
Änderungen an die Forschung senden und ihre übrigen Aktionen gehen nur auf dem Computer, auf dem die Forschung läuft;
auf das Telefon gehört die Seite **Strom-Forschung** ([S5.3](#S5.3)).

- **Grenzen:** bei einem Stammbaum, der schon seine Forschung hat, zeigt **Ahnenforschung** auf dem Telefon nur eine
  Erklärung: auf dem Telefon vorgenommene Änderungen bleiben in diesem Browser und kommen zur Forschung, wenn der
  Stammbaum auf dem Computer der Forschung geöffnet wird (nach Export als Datei). Ein Link zum Verfolgen der
  Forschung, auf dem Telefon geöffnet, zeigt „Die Forschung läuft auf einem Computer“
  ([S4](S4-research-from-the-app.md)).
  **Telefon verbinden…** wird auf dem Telefon nicht angeboten.
- **Bedienung:** App auf dem Telefon: **Mehr → Stammbaum → Ahnenforschung**.
- **Gilt seit:** App 3.9.0; Link zum Verfolgen auf dem Telefon 3.12.0
- **Ab App 3.22.0:** Linien ([R2](R2-lines-and-queue.md)) zeigt die App auf dem Telefon nur zum Lesen mit dem
  Satz „Richtungen lassen sich in Strom auf dem Computer ändern, auf dem die Forschung läuft.“; ein Antippen zeigt
  die Linie im Stammbaum.

<!-- zdroj: app:src/ui/tree-actions.ts:257 treeResearchRow · src/ui/research-promo-ui.ts:272 showResearchInfoDialog · src/ui/research-ui.ts:1514 onPhone · src/ui/phone-ui.ts:150 phoneAvailable · strings.ts:9864 research.phoneHasResearch, :9423 connect.reasonPhoneLive · HEAD src/ui/research-directions-ui.ts dirPhoneOnly (fa73007) -->
