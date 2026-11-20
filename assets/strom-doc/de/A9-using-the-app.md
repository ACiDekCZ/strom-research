<a id="A9"></a>
# A9 Bedienung der App

Wo in der Strom-App was ist, wie die Bedienelemente heißen und was dem Menschen bleibt. Es gilt gleich für den
Menschen, für einen Bildschirmleser und für einen Agenten, der die Seite mit den Werkzeugen des Browsers liest.
Beschreibt die Strom-App 3.25.0 und die Forschung 1.29.0.

<!-- zdroj: dirigent:spec/063-computer-use-usnadnit K1.1, K1.3, K1.4, K1.5 · test/vysledek-063-pruzkum.md kolo 2 (A1–A7) · app:CHANGELOG.cs.md 3.25.0 -->

<a id="A9.1"></a>
## A9.1 Wo was ist

Die App zeigt das Umfeld einer Person ([A1.3](A1-the-app-in-brief.md#A1.3)). Was eine Person betrifft, steht im Menü
der Person; was den ganzen Stammbaum betrifft, steht in der Leiste und im Menü **Aktionen**.

| Aufgabe | Wo in der App | Regel |
|---|---|---|
| eine Person finden | Feld **Person suchen...** in der Leiste | [A4.8](A4-surnames-and-families.md#A4.8) |
| Menü der Person | Klick auf die Personenkarte oder Enter auf der Karte; auf einem Touch-Gerät öffnet langes Drücken der Karte ein Blatt von unten mit denselben Aktionen | [A6.1](A6-views.md#A6.1) |
| Was die Forschung über die Person weiß | Menü der Person → **Forschung → Was die Forschung weiß** | [S3.2](S3-what-the-research-knows.md#S3.2) |
| Quellen der Person | Menü der Person → **Quellen** | [A3.6](A3-evidence-in-the-app.md#A3.6) |
| Quellen des Stammbaums | **Aktionen → Quellen** | [A3.1](A3-evidence-in-the-app.md#A3.1) |
| eine Person bearbeiten | Menü der Person → **Bearbeiten** | [S2](S2-edits-from-the-app.md), beim Verfolgen [A9.3](#A9.3) |
| Ansicht Karte und weitere Ansichten | Umschalter der Ansichten in der Leiste; auf Telefon, Tablet und im Fenster bis 1024 px die untere Leiste und **Mehr → Ansicht** | [A6](A6-views.md), [A9.5](#A9.5) |
| der ganze Stammbaum in Zeilen, CSV- und XLSX-Export | **Tabelle** im Umschalter der Ansichten; auf Telefon, Tablet und im Fenster bis 1024 px **Tabelle** in der unteren Leiste | [A6.7](A6-views.md#A6.7) |
| Personenlisten (feste, automatische, Arbeitslisten) | **Aktionen → Personenlisten…**; auf dem Telefon **Mehr → Personenlisten** | [A11](A11-lists-of-people.md) |
| Porträtausschnitt, Paarfoto | Bearbeiten der Person → **Foto auswählen**, **Ausschnitt bearbeiten**; Bearbeiten der Person → **Beziehungen verwalten** → Zeile **Foto** | [A12](A12-portrait-and-couple-photo.md) |
| Minikarte oder Stammbaum-Legende einklappen | Reiter über der Minikarte; **◯** in der Legende | [A9.6](#A9.6) |
| Vollbild (Telefon und Tablet) | **Mehr → Vollbild**; auf dem iPhone in Safari **Mehr → Vollbild…** | [A9.5](#A9.5) |
| eine Ansicht oder die Forschungsübersicht in einem eigenen Fenster (am Computer) | ⧉ **In neuem Fenster öffnen** neben dem Ansichtsumschalter; Strg+Klick (macOS ⌘+Klick) auf den Reiter einer Ansicht; ⧉ in der Leiste der Tabelle und im Kopf der Übersicht | [A6.8](A6-views.md#A6.8), [S4.1.6](S4-research-from-the-app.md#S4.1.6) |
| Kartenhintergrund | **Karte anzeigen** beim Hinweis, dass der Hintergrund von openstreetmap.org geladen wird | [A9.4](#A9.4) |
| Orte ohne Karte | Statusleiste der Karte → **In der Forschung**; in der Forschung der Abschnitt **Wartet auf Bearbeitung** | [A6.5.2](A6-views.md#A6.5.2), [R4.5](R4-places.md#R4.5) |
| Arbeit der Forschung | Panel der Forschung, **⤢ Übersicht öffnen**; Menü **Forschung → Forschungsübersicht** | [S4.1](S4-research-from-the-app.md#S4.1) |
| was auf den Menschen wartet | Panel, Abschnitt **Wartet auf Bearbeitung**; Menü **Forschung → Wartet auf Bearbeitung** | [S4.4](S4-research-from-the-app.md#S4.4) |
| Verfolgen der Forschung | **Live verfolgen**; Ende **Verfolgung beenden** | [S1.4](S1-connecting-app-and-research.md#S1.4), [A9.3](#A9.3) |
| Senden der Änderungen an die Forschung | **Forschung → Weitere Aktionen → Forschung für diesen Stammbaum… → Änderungen senden** | [S2.2](S2-edits-from-the-app.md#S2.2) |
| Regeln und Begriffe | **Aktionen → So funktioniert Strom** | [A1.7](A1-the-app-in-brief.md#A1.7) |
| zurück zur Standardperson des Stammbaums | ⌂ am Anfang von **Fokussiert auf**; die Taste H | [A6.1.6](A6-views.md#A6.1.6), [A9.8](#A9.8) |
| eine Aktion, die eine Weile dauert | der Zustand auf der Schaltfläche (ein Rad und was gerade geschieht); eine lange Aktion in einer Meldung mit Fortschritt | [A9.7](#A9.7) |

- **Grenzen:**
  - die Einträge der Forschung gibt es nur bei einem Stammbaum aus der Forschung; Schaltflächen, die die Forschung
    öffnen, nur auf dem Computer, auf dem die Forschung läuft ([S3.2](S3-what-the-research-knows.md#S3.2));
  - die App verbindet sich mit der Forschung über einen Link aus dem Terminal, `strom app`
    ([S1.2](S1-connecting-app-and-research.md#S1.2)).
- **Bedienung:** wie in der Tabelle.
- **Gilt seit:** App 3.25.0 (Übersicht; jeder Ort gilt seit der Version in seiner Regel)

<!-- zdroj: app:index.html search input (search.placeholder) · src/renderer.ts card.onclick → UI.showContextMenu, klávesy Enter/Space · src/ui/bottom-sheet.ts (dlouhý stisk, menu.sectionView) · SPEC.md Long-press → bottom sheet · strings.ts search.placeholder, mobileMenu.more, menu.sectionView, map.tilesNotice, map.tilesNoticeOk, research.stop · cesty z pravidel A3.1, A3.6, A6, A6.5.2, A11 (od 3.30.0, index.html #actions-lists-row, bottom-sheet.ts sheet-lists), A12 (od 3.30.0, app:88859da2 person-modal.ts, 9a47896e relationships-panel.ts; tlačítka otočení fotky přesunuta do editoru), S1.4, S2.2, S3.2, S4.1, S4.4, A1.7 · okna: A6.8, S4.1.6 (app:4b1373a7 src/windows/window-controls.ts) · dolní lišta a Celá obrazovka: A9.5 (app:4b1373a7, commit bb5e4d12) · akce, která trvá: A9.7 (app:2d01dffd src/ui/busy.ts) -->

<a id="A9.2"></a>
## A9.2 Bedienelemente haben einen lesbaren Namen

Jedes Bedienelement hat einen Namen, den ein Bildschirmleser und auch ein Werkzeug des Browsers, das die Seite liest,
lesen. Das Aussehen ändert sich dadurch nicht.

- **Grenzen:**
  - Schaltflächen nur mit einem Symbol haben einen Namen: Vergrößern, Filter, zurück und vor, Drehen eines Fotos (ab
    App 3.30.0 im Editor für den Porträtausschnitt, [A12.1](A12-portrait-and-couple-photo.md#A12.1)), Vorschau, die
    Liste bei der Personensuche (**Liste anzeigen**), eine verknüpfte Datei, der Link zur Quelle eines Ortes (**Quelle
    öffnen**) und weitere;
  - geschlossene Dialoge und Menüs werden nicht gelesen: sie sind weder im Baum der Barrierefreiheit noch in dem, was
    ein Werkzeug des Browsers auf der Seite findet;
  - das Blatt von unten nimmt während des Ausfahrens keinen Klick und kein Tippen an, damit kein anderer Eintrag
    getroffen wird;
  - mit reduzierter Bewegung (Einstellung des Systems) erscheinen Menüs, Meldungen und das Blatt von unten ohne
    Animation;
  - ein ausgegrauter Eintrag wird auch mit seinem Grund gelesen, startet aber nichts ([A9.3](#A9.3)).
- **Bedienung:** keine: es gilt von selbst. Reduzierte Bewegung: Einstellungen des Systems.
- **Gilt seit:** App 3.25.0

<!-- zdroj: app:commity c641f7b8 (aria-label ikonových prvků, e2e a11y-names), 76f08f6a + 322b08c3 (zavřené dialogy a menu mimo strom přístupnosti, spodní panel inert při vysouvání, prefers-reduced-motion), 4a8b4fed · strings.ts personPicker.showList, places…dSourceOpen · CHANGELOG.cs.md 3.25.0 „Čtečky obrazovky“ · dirigent:test/vysledek-063-pruzkum.md A1–A3 -->

<a id="A9.3"></a>
## A9.3 Bearbeiten beim Verfolgen der Forschung

Ein Stammbaum, der live verfolgt wird, ist nur zum Lesen ([S1.4](S1-connecting-app-and-research.md#S1.4)). Die App
zeigt, warum eine Bearbeitung nicht geht und wie das Verfolgen beendet wird.

- **Grenzen:**
  - beim Verfolgen zeigt das Menü der Person ein ausgegrautes **Bearbeiten** mit dem Grund **Beim Verfolgen der
    Forschung nur zum Lesen.** und gleich darunter **Verfolgung beenden**. Das gilt am Computer und auf dem Telefon;
  - **Verfolgung beenden** im Menü der Person beendet das Verfolgen genauso wie die Schaltfläche im Panel der
    Forschung;
  - nach dem Ende des Verfolgens fragt die App sofort einmal **Wie sollen Änderungen an die Forschung gehen?**, wenn
    sie beim Stammbaum noch nicht gefragt hat und die Forschung läuft und Änderungen annimmt
    ([S2.2](S2-edits-from-the-app.md#S2.2)).
- **Bedienung:** App: Menü der Person → **Verfolgung beenden**; Panel der Forschung → **Verfolgung beenden**.
- **Gilt seit:** App 3.25.0

<!-- zdroj: app:src/ui/context-menu.ts (edit-following disabled + note, live-stop link), src/ui/bottom-sheet.ts (aria-disabled), src/ui/research-sync-ui.ts researchAskSendModeAfterFollow · strings.ts contextMenu.editFollowing, research.stop, treeSettings.askTitle · commity ffed0d42, cc26c35a, cf0352cd · CHANGELOG.cs.md 3.25.0 „Úpravy během sledování výzkumu“ · dirigent:spec/063-computer-use-usnadnit K1.4 -->

<a id="A9.4"></a>
## A9.4 Der Agent in der App

Ein Agent, der die Strom-App steuert, steuert sie mit den Werkzeugen der Seite im Browser, so wie ein Bildschirmleser
sie liest. Aktionen der Forschung gehen zuverlässiger mit dem Befehl `strom`. Strom empfiehlt nirgends, die
Computersteuerung einzuschalten ([R12.10](R12-where-the-agent-works.md#R12.10)).

- **Grenzen:**
  - Werkzeuge der Seite haben der eingebaute Browser der App Claude und Claude in Chrome. Die Computersteuerung in der
    App Claude liest den Browser nur (Bildschirmfoto): klicken und schreiben lässt sich darin nicht
    ([R12.10](R12-where-the-agent-works.md#R12.10));
  - die Brücke zur Strom-App bleibt dem Agenten verschlossen: der Agent arbeitet mit der Seite, nicht mit der Brücke
    ([R12.2](R12-where-the-agent-works.md#R12.2));
  - die Zustimmung zum Kartenhintergrund (**Karte anzeigen**), die Frage **Wie sollen Änderungen an die Forschung
    gehen?** und weitere Wahlen und Einstellungen des Menschen bleiben dem Menschen.
- **Nur Methodik:** der Agent klickt auf ein Bedienelement nach dem Verweis, den ihm das Werkzeug zum Suchen auf der
  Seite gegeben hat, nicht nach Koordinaten, und wartet, bis das Blatt von unten ausgefahren ist, bevor er erneut
  klickt. Aktionen der Forschung macht er mit dem Befehl `strom` in seiner Kommandozeile; in der App nur, was der
  Befehl nicht hat. Auf eine Wahl des Menschen klickt er nicht: er sagt, was auf den Menschen wartet.
- **Bedienung:** keine: es gelten die Anweisungen im Ordner der Forschung (`AGENTS.md`).
- **Gilt seit:** Forschung 1.29.0; App 3.25.0

<!-- zdroj: research:src/agents/files.ts AGENTS.md „## When you have computer use“ (page tools, click by the reference find gives, never by coordinates, wait until a sliding panel has stopped; Claude's computer use only looks at browsers; research through strom; consent or setting left to the person: map's OpenStreetMap, how edits are sent) · CHANGELOG.cs.md 1.29.0 · src/core/browser.ts + src/core/bridgeguard.ts (most odmítnut) · dirigent:test/vysledek-063-pruzkum.md kolo 1 (úrovně), kolo 2 (klik přes ref z find spolehlivý, klik podle souřadnic během vysouvání trefil jinou položku; souhlas Zobrazit mapu nekliknut; místo mimo mapu v Čeká na vyřízení) · spec/063-computer-use-usnadnit K1.2, K1.3, K1.5 -->

<a id="A9.5"></a>
## A9.5 Die untere Leiste auf Telefon und Tablet

Auf Telefon, Tablet und im Fenster bis 1024 px hat die App statt des Umschalters der Ansichten eine untere Leiste.
Die übrigen Ansichten und Aktionen stehen im Blatt **Mehr**.

- **Untere Leiste:** **Familie** | **Nachkommen** | **＋** (Person hinzufügen; nur in einem Stammbaum, der sich
  bearbeiten lässt) | **Tabelle** | **Mehr**. Eine offene Familie, Nachkommen oder Tabelle wird in der Leiste
  hervorgehoben; ein offener Fächer, eine offene Karte oder Zeitleiste hebt **Mehr** hervor.
- **Mehr → Ansicht:** **Fächer** | **Karte** | **Zeitleiste**. Auf dem Telefon steht darunter die Wahl der Stammlinie
  ([A6.6](A6-views.md#A6.6)), wenn der Stammbaum sie anbietet; nicht bei Zeitleiste, Karte und Tabelle.
- **Vollbild:** Im Blatt **Mehr** steht **Vollbild**, im Vollbild **Vollbild beenden**. Die Leisten des Browsers
  nehmen dann keinen Platz ein.
  - Es wird nur angeboten, wo der Browser einer Seite das Vollbild erlaubt, und nur mit der unteren Leiste. Ein
    quer gehaltenes Telefon hat es als vierte Kachel in der Zeile **Ansicht**.
  - Auf einem iPhone oder iPad, dessen Browser einer Seite kein Vollbild erlaubt (Safari auf dem iPhone), steht
    stattdessen **Vollbild…** mit einem Hinweis: Strom auf dem Home-Bildschirm (**Teilen → Zum Home-Bildschirm**)
    öffnet sich ohne die Leisten des Browsers, hat aber einen eigenen, getrennten Speicher; ein Stammbaum kommt
    durch Export und Import hinein. Die vom Home-Bildschirm gestartete App hat diese Zeile nicht.
  - Lehnt der Browser das Vollbild ab, bleibt das Fenster, wie es ist.
- **Bedienung:** untere Leiste; **Mehr → Ansicht**; **Mehr → Vollbild**.
- **Gilt seit:** App 3.28.0 (bis 3.27.0 hatte die untere Leiste **Zeitleiste** statt **Tabelle**, und die Tabelle
  stand unter **Mehr → Ansicht**)

<!-- zdroj: app:4b1373a7 index.html #bottom-bar (bb-view-family, bb-view-descendants, bottom-bar-fab edit-only, bb-view-table, bb-view-more) · src/ui/misc.ts:530–533 (active: table na liště; fan, map, timeline → Více) · src/breakpoints.ts isTabletOrMobile (≤ 1024 px), isPhoneBar, MQ_PHONE_LANDSCAPE · src/ui/bottom-sheet.ts blok 5 (Pohled: fan, map, timeline; rodRow jen isPhoneBar, ne timeline/map/table; fullscreenRow jen isTabletOrMobile, na šířku čtvrtá dlaždice) · src/ui/fullscreen.ts fullscreenOffer (fullscreenEnabled → enter/exit; iOS a ne standalone → ios-hint; jinak nic), toggleFullscreen (odmítnutí: okno beze změny) · src/file-copy.ts isIosDevice · src/pwa.ts isStandaloneDisplay · strings.ts mobileMenu.fullscreen, fullscreenExit, fullscreenIos, fullscreenIosText, menu.sectionView, viewModeSwitch.* · commit bb5e4d12 (dřív bb-view-timeline a v Pohledu Tabulka) · dirigent:spec/082-tester-3.28 K1.1, K1.3 · prace/1112-app-tester-328-telefon -->

<a id="A9.6"></a>
## A9.6 Minikarte und Stammbaum-Legende lassen sich einklappen

Minikarte und Stammbaum-Legende lassen sich einklappen, damit sie den Stammbaum nicht verdecken. Das Gerät merkt sich
die Wahl für alle Stammbäume. Einklappen ist kein Ausschalten: ob das Element überhaupt erscheint, bestimmen weiter
die Einstellungen **Minikarte** und **Stammbaum-Legende**.

- **Minikarte** (Computer und Tablet, Ansichten Familie und Nachkommen, wenn der Stammbaum größer als das Fenster
  ist):
  - an der oberen Kante des Blocks mit der Minikarte ist ein Reiter: ⌄ klappt die Minikarte ein (**Minikarte
    einklappen**), eine eingeklappte hat einen Reiter mit dem Zeichen der Minikarte (**Minikarte ausklappen**). Mit
    der Maus ist der Reiter nur beim Überfahren des Blocks oder bei Tastaturfokus sichtbar, bei Berührung immer;
  - eine eingeklappte Minikarte wird ausgeblendet und nicht gezeichnet; die Zoom-Schaltflächen bleiben an ihrem
    Platz;
  - Standard ist ausgeklappt. Das Telefon hat keine Minikarte.
- **Stammbaum-Legende:**
  - **◯** klappt die Legende zu einem Chip „◯ Legende“ ein, und der Chip klappt sie wieder aus. Schaltfläche ist der
    erste Teil der Pille (beim Überfahren wird daraus ⌄, **Legende einklappen**) und im Feld mit den Zeichen der
    Karten der ganze Kopf „◯ Legende ⌄“;
  - Standard ist ausgeklappt. Ziehen mit der Maus über die Legende außerhalb der Schaltfläche verschiebt weiter den
    Stammbaum;
  - der eingeklappte Chip hat einen Punkt, wenn die Ansicht eine Art Kartenzeichen zeigt, die die Legende auf diesem
    Gerät noch nicht ausgeklappt gezeigt hat; ein Bildschirmleser liest „Legende, neues Zeichen“. Nach dem
    Ausklappen verschwindet der Punkt;
  - **Telefon** (hochkant und quer): die Legende ist immer ein Chip. Tippen öffnet sie als Blatt von unten (quer als
    Feld rechts) mit der Überschrift „◯ Legende“ und **Fertig**. Es schließen **Fertig**, Tippen daneben, Ziehen nach
    unten (quer nach rechts) und Esc. Nach dem Neuladen der Seite öffnet es sich nicht von selbst, und das Telefon
    liest und schreibt die Wahl des Geräts nicht;
  - ab App 3.30.0 zeigt die Legende neben den Geschlechtsringen auch die **Linienmarkierung** in der gewählten Form
    ([A6.1.5](A6-views.md#A6.1.5)).
- **Grenzen:** ohne Speicher des Browsers (privates Fenster) gilt die Wahl, bis die Seite geschlossen wird.
- **Bedienung:** Reiter über der Minikarte; **◯** in der Legende, Chip „◯ Legende“. Ausschalten: Einstellungen
  **Minikarte**, **Stammbaum-Legende**.
- **Gilt seit:** App 3.28.0

<!-- zdroj: app:f5d56ed3 src/ui/minimap.ts readMinimapOpen (strom-minimap-open, výchozí otevřeno), setMinimapFold (ouško jen když je minimapa nabízená), updateMinimap (isMinimapEnabled, mobil a telefon na šířku bez minimapy, STANDALONE_VIEWS, sbaleno: display none, nic se nekreslí) · src/ui/tree-legend.ts readTreeLegendOpen (strom-tree-legend-open, výchozí otevřeno), readTreeLegendSeen / noteTreeLegendSeen (strom-tree-legend-seen), syncTreeLegendFold (tečka, aria-label title + newMark, telefon vždy čip), openTreeLegendSheet (Hotovo = tour.done, klepnutí vedle, tažení 80 px dolů / doprava na šířku, nečte ani nepíše volbu), paměť bez úložiště · src/ui/misc.ts updateLegendMarks (data-marks: story-own, story-other, action, cross) · src/storage-keys.ts TREE_UI_STORAGE_KEYS · index.html .minimap-toggle (hover / pointer coarse), #tree-legend .tree-legend-toggle, pointer-events · strings.ts minimap.title, collapse, expand, settingLabel; legend.title, collapse, expand, newMark; settings legendLabel · app d78ba58b · dirigent:prace/1113-app-drobnosti-1112 · ZADANI_DEV_drobnosti-1112 §2 -->

<a id="A9.7"></a>
## A9.7 Eine Aktion, die eine Weile dauert

Eine Schaltfläche oder ein Link, deren Aktion eine Weile dauert, zeigt, dass sie arbeitet, und endet mit einer
einzigen Nachricht: es hat geklappt, oder warum nicht. Ein zweiter Klick startet inzwischen nichts erneut.

- **Grenzen:**
  - das Element sperrt sich gleich nach dem Klick. Ein zweiter Klick, Enter oder Leertaste startet nichts erneut. Das
    Element wird nicht grau, behält seine Farbe und den Tastaturfokus und ändert seine Breite nicht;
  - der Zustand erscheint erst nach 120 ms, damit kurze Aktionen nicht flackern, und bleibt mindestens 300 ms zu
    sehen: ein Rad und Worte, was gerade geschieht. Das Verb wechselt in die Form „Wird …“ (**Senden** → **Wird
    gesendet…**), sonst steht **Wird geladen…**; ein Link ins Terminal sagt **Forschung wird geöffnet…**
    ([S4.5](S4-research-from-the-app.md#S4.5)). Bei reduzierter Bewegung (Systemeinstellung) stehen statt des Rads
    drei Punkte;
  - ein Link im Text und ein Menüeintrag behalten ihren Text, das Rad steht dahinter. Eine Schaltfläche nur mit
    Symbol (⋯, ✕) hat das Rad an Stelle des Symbols in derselben Größe. Eine Aktion aus einem Menü, das sich nach dem
    Klick schließt, lässt ihren Zustand an der Zeile, zu der sie gehört (Aufgabe, Richtung, Material); ohne eine
    solche Zeile trägt ihn eine Meldung;
  - eine Liste oder ein Element, das während der Arbeit neu gezeichnet wird (die Brücke wird jede Sekunde gefragt),
    hält den Zustand ohne Unterbrechung: das neue Element hat ihn sofort, deshalb lässt es sich inzwischen nicht
    erneut anklicken;
  - ein Erfolg, wo das Ergebnis sonst nicht zu sehen ist, zeigt auf dem Element 2 s lang ein Häkchen mit einem Wort
    (**Geschrieben**, **Gespeichert**);
  - ein Misserfolg ist ein Satz direkt unter dem Element mit **Erneut versuchen**. Ist das Element inzwischen
    verschwunden (ein geschlossenes Menü oder ein geschlossener Dialog), sagt dasselbe eine Meldung; eine Meldung über
    einen Fehler schließt sich nicht von selbst und hat ✕. Ein Browserfenster mit Hinweis wird nicht verwendet.
    „Nichts gefunden“ ist kein Fehler: es steht ein neutraler Satz mit **Anders suchen** ([A9.7.4](#A9.7.4));
  - jede Aktion hat ein Zeitlimit nach dem, worauf sie wartet: eine Anfrage an die Forschung 15 s, ein Schreiben in
    die Forschung 30 s, Laden oder Senden des Stammbaums 120 s, Öffnen des Terminals 10 s, Arbeit an der
    Warteschlange 30 s, ein Dienst im Internet 10 s je Anfrage; weitere Limits stehen in [A9.7.4](#A9.7.4). Eine
    Berechnung im Browser hat kein Limit;
  - auf Telefon und Tablet gilt dasselbe. Ein Blatt mit einem Menü von Aktionen schließt sich nach der Wahl sofort,
    und die Zeile trägt den Zustand.
- **Bedienung:** nichts: gilt von selbst.
- **Gilt seit:** App 3.30.0, in der ganzen App: Links ins Terminal, **Senden**, die Übergabe des Stammbaums an die
  Forschung, das Laden einer Version aus der Forschung, das Wechseln des Stammbaums, **An der Warteschlange
  arbeiten…**, **Text aller Anfragen**, die Schaltflächen in Meldungen, Menüeinträge, Links und Symbole, Schreiben in
  die Forschung ([A9.7.2](#A9.7.2)), Berechnungen und Dateien ([A9.7.3](#A9.7.3)). Bis 3.29.0 hatten manche Stellen
  ein eigenes Rad, andere nichts, und ein arbeitendes Element wurde abgedunkelt.

<!-- zdroj: app:2d01dffd, 7b69dba9, 574e7ef9, 6ee5a7f7, f63cc742, 3f841191, 1473151c, d2bdabac, c02df469, 6093a386, 58539c82 src/ui/busy.ts (runBusy: zámek 0 ms aria-disabled, BUSY_SHOW_MS 120, BUSY_MIN_MS 300, BUSY_DONE_MS 2000, šířka v jedné buňce .bl, bez ztlumení, konec věta .busy-msg + retry, prvek pryč → toast, BUSY_TIMEOUTS bridge 15 s, write 30 s, tree 120 s, terminal 10 s, queueWork 30 s, network 10 s, local bez limitu; reducedMotion tři tečky) · strings.ts busy.generic, sending, openingResearch, done.written, done.saved, retry · CHANGELOG.cs.md 3.30.0 „Tlačítka, která čekají“ · app:docs/ZADANI_DEV_tlacitka-cekani.md §1, §10, §13.1 (fáze 0–1) · dirigent:prace/1118-app-tlacitka-a · fáze 2–4: app:79a05311 (00fd19b6..2e1ec36f, 727f2fa7) src/ui/busy.ts trailsSpinner (a, .link, menuitem: kolečko za textem), iconOnly (kolečko místo ikony), rowOf (§4: stav na řádku), toastWhenGone, MutationObserver přenos stavu na překreslený prvek (727f2fa7, dřív kontrola co 400 ms); 00852929 jediné .busy-spin, ztlumení pracujících pryč; ZADANI_DEV §4, §5, §10.1, §11.1 · BUSY_TIMEOUTS.satellite 10 s a busy.mainWindowSilent v kódu jsou, ale žádné místo je nepoužívá: nepopsáno (nález) · dirigent:prace/1118-app-tlacitka-b, 1118-app-tlacitka-n1 -->

<a id="A9.7.1"></a>
### A9.7.1 Eine lange Aktion: Fortschritt in einer Meldung

Eine Aktion, die länger dauert, zeigt ihren Fortschritt in einer Meldung: was gerade geschieht und wie lange es
dauert.

- **Grenzen:**
  - die Meldung mit Fortschritt erscheint, wenn die Aktion länger als 3 s läuft oder wenn das Element, das sie
    gestartet hat, verschwunden ist. Sie hat einen Titel, einen Schritt („2 von 5“), ab 10 s die Zeit („· 12 s“) und
    nach der doppelten üblichen Dauer, frühestens nach 20 s, **Dauert länger als üblich.** Ein Erfolg zeigt 4 s lang
    eine Zusammenfassung mit Häkchen;
  - **Abbrechen** hat nur eine Aktion, die sich wirklich abbrechen lässt. Ein Schreiben in die Forschung lässt sich
    nicht abbrechen. Das Schließen eines Dialogs bricht die Aktion nicht ab;
  - die Übergabe des Stammbaums an die Forschung zeigt die Schritte (**Sicherung wird gespeichert**, **GEDCOM wird
    erstellt**, **Die Forschung übernimmt den Stammbaum**, Laden), und der Dialog lässt sich mit **Im Hintergrund
    fortsetzen** weiterlaufen lassen;
  - das Wechseln des Stammbaums sendet zuerst die nicht gesendeten Änderungen des offenen Stammbaums an die Forschung
    (**Vor dem Wechsel werden Änderungen an die Forschung gesendet…**), höchstens 15 s. Sind sie bis dahin nicht
    gesendet, wechselt der Stammbaum nicht: **Der Wechsel hat nicht geklappt: Die Änderungen wurden in 15 s nicht
    gesendet. Der Stammbaum blieb geöffnet.** mit **Erneut versuchen**;
  - während eine Version aus der Forschung geladen, der Stammbaum übergeben oder gewechselt wird, warten Änderungen
    am Stammbaum: ein Änderungsversuch ändert nichts, und eine Meldung sagt warum (**Der Stammbaum wird gerade aus
    der Forschung geladen – Änderungen sind danach möglich.**, **Der Stammbaum wird gerade gewechselt – Änderungen
    sind danach möglich.**). Ansehen und Suchen gehen weiter;
  - eine Arbeit in Teilen zeigt, wo sie steht: das Familienbuch im neuen Fenster **Buch wird vorbereitet…** mit
    „Kapitel 3 von 12“ und im Hauptfenster eine Meldung mit Fortschritt; „3 Stammbäume erstellen“ beim Teilen
    „Stammbaum 2 von 3 wird erstellt: …“; das Verschlüsseln aller Stammbäume „Stammbaum 2 von 5 wird
    verschlüsselt…“; das Laden einer großen Datei die Zahl der schon gelesenen Personen;
  - der Fortschritt eines Stapels, des Hochladens von Bildern, des Lesens eines Dokuments, der Quellenbilder und des
    Auffindens von Orten auf der Karte sieht gleich aus: ein Balken, rechts „k von n“, die Aktionen rechts unten;
  - das Verlassen der Seite, während an die Forschung gesendet oder der Stammbaum geladen wird, bestätigt zuerst der
    Browser. Wurde die Seite während eines Schreibens geschlossen, sagt sie beim nächsten Öffnen **Vor dem Schließen
    wurde an die Forschung gesendet – das Ergebnis ist nicht bekannt.** mit **Ermitteln**.
- **Bedienung:** App: **Abbrechen**, **Im Hintergrund fortsetzen**, **Ermitteln**, **Erneut versuchen** in der
  Meldung.
- **Gilt seit:** App 3.30.0

<!-- zdroj: app:2d01dffd, 3f841191, 1473151c, d2bdabac src/ui/toast.ts showProgressToast (ELAPSED_FROM_MS 10 s, TAKING_LONG_MIN_MS 20 s a 2× usualMs, SUMMARY_MS 4000, cancel jen kde jde) · src/ui/busy.ts BUSY_LONG_TOAST_MS 3000 · src/ui/adopt-progress.ts, research-adopt-ui.ts (kroky adoptBackup, adoptGedcom, adoptTaking, loadingTree; adoptBackground) · src/ui/tree-edit-lock.ts (load, adopt, switch; editsWaitLoad, editsWaitAdopt, editsWaitSwitch) · src/ui/busy-leave.ts (beforeunload při send, adopt, load; strom.busy.pending → unknownAfterLeave + findOut) · strings.ts busy.* · app:docs/ZADANI_DEV_tlacitka-cekani.md §2 · fáze 2–4: app:79a05311 src/ui/tree-switch-busy.ts (TREE_SWITCH_SEND_MS 15 s, beforeSwitchSend, switchNotSent, retry) · src/ui/book-ui.ts (nové okno book-window.ts preparingBook, chapterK, showProgressToast) · src/ui/split-ui.ts, split-families-ui.ts creatingTreeK · src/ui/encryption-ui.ts encryptingK · db6f48cd src/ui/in-parts.ts, import-export.ts (GED po částech, počet osob) · de144a3e jeden pruh .bar + .prog „k z n“ (dávka, snímky k úkolu, čtení dokumentu, obrazy pramenů, dohledání míst) · ZADANI_DEV §2.3, §2.6, §2.8, §3.4, §8 -->

<a id="A9.7.2"></a>
### A9.7.2 Ein Schreiben in die Forschung, sofort sichtbar

Eine Zeile, ein Schalter oder eine Auswahl, die in die Forschung schreiben, zeigen die Änderung sofort. Bis die
Forschung sie bestätigt, ist an ihnen zu sehen, dass gespeichert wird; eine Ablehnung nimmt die Änderung zurück und
sagt warum.

- **Grenzen:**
  - das Verschieben oder Ändern einer Zeile (ein Eintrag in **Wartet auf Bearbeitung** → **Gesendet** und zurück,
    eine in der Reihenfolge verschobene Richtung) steht sofort an der neuen Stelle. Bis zur Bestätigung stehen am
    Ende der Zeile ein Rad und „wird gespeichert“; die Zeile wird nicht abgedunkelt. Nach der Bestätigung
    verschwindet die Marke, ohne Häkchen;
  - eine Ablehnung setzt die Zeile an ihre Stelle zurück, tönt sie 10 s lang ein, und in der Zeile steht ein Satz mit
    dem Grund und **Erneut versuchen**. Ein Fokus, der in der Zeile war, geht auf den Satz. Eine Zeile, die inzwischen
    nicht zu sehen ist (Übersicht geschlossen, Abschnitt eingeklappt), sagt die Ablehnung mit einer Meldung;
  - ein Schalter, der schreibt (Arten und Suche der Geschichte, Einstellungen der Forschung zum Stammbaum,
    **Forschung an**), zeigt den neuen Stand sofort, gestrichelt umrandet und gesperrt. Nach 120 ms steht darunter
    **Wird gespeichert…** (**Wird eingeschaltet…**, **Wird ausgeschaltet…**), nach 5 s **Wartet auf die Forschung**.
    Eine Ablehnung stellt den Schalter zurück, und an ihm steht der Satz „Unverändert: <Grund>“ mit **Erneut
    versuchen**, ohne Meldung;
  - **Forschung an** wartet höchstens 30 s auf die Brücke. Dann geht der Schalter zurück, und es steht **Die
    Forschung hat sich in 30 s nicht gemeldet. Strom Research muss gestartet werden.** mit dem Befehl fürs Terminal
    und **Erneut versuchen** ([S1.9](S1-connecting-app-and-research.md#S1.9));
  - ein Filter der Warteschlange wechselt sofort, und die Liste darunter sagt **Aufgaben werden geladen…**, bis die
    Antwort kommt;
  - **Rückgängig** in einer Meldung: die Meldung verschwindet nicht, sie zeigt **Wird rückgängig gemacht…** und dann
    „Rückgängig gemacht.“ oder „Nicht rückgängig gemacht: <Grund>“ mit **Erneut versuchen**. Ein zweiter Klick
    startet inzwischen nichts.
- **Bedienung:** nichts: gilt von selbst. **Erneut versuchen** am Satz.
- **Gilt seit:** App 3.30.0. Bis 3.29.0 sagte eine Ablehnung nur eine Meldung, und ein Schalter verwarf weitere
  Klicks stillschweigend.

<!-- zdroj: app:79a05311 src/ui/research-waiting-write-ui.ts (startWaitingRows announce savingRow, endWaitingRows: vrácení, podbarvení 10 s, věta v řádku, sayWaitingRowRefused fokus na větu, řádek mimo → showWaitingRefused toast) · src/ui/research-directions-ui.ts, research-overview-ui.ts savingRow · src/ui/switch-pend.ts (data-pend, aria-busy, aria-disabled, BUSY_SHOW_MS 120, PEND_WAIT_MS 5000 waitingResearch, odmítnutí: přepínač zpět + věta role=alert + retry, bez toastu; uživatelé history-kinds-ui, history-manage-ui, history-ui, person-research-ui, research-live-ui, research-offline-ui, research-tree-settings-ui) · src/ui/research-live-ui.ts START_CONFIRM_MS 30 s, researchLiveTimedOut liveSilent + COMMAND_START + retry · src/ui/research-ui.ts queueLoadingStatus (live.queueLoading) · src/ui/toast.ts (reverting, undone, notUndone, SUMMARY_MS 4000, a901c925 akce oddělené) · strings.ts busy.savingRow, saving, turningOn, turningOff, waitingResearch, notChanged, liveSilent, reverting, undone, notUndone · ZADANI_DEV_tlacitka-cekani §4, §6, §7 · dirigent:prace/1118-app-tlacitka-b (díl 1–2b) -->

<a id="A9.7.3"></a>
### A9.7.3 Berechnungen und Dateien in der App

Was nur der Browser berechnet (das Layout des Stammbaums, die Karte, eine Prüfung, das Buch, ein Export) und was eine
Datei liest oder speichert, zeigt seinen Zustand wie eine Aktion, die auf die Forschung wartet. Der Zustand wird
gezeichnet, bevor die Berechnung beginnt, damit das Fenster nicht eingefroren wirkt.

- **Grenzen:**
  - das Layout des Stammbaums (**Im Stammbaum zeigen**, **Nächste Person ›**, eine Auswahl, die den Stammbaum neu
    zeichnet) und die Karte des ganzen Stammbaums decken die Fläche mit einer Überlagerung ab: **Layout wird
    berechnet…** oder **Karte wird berechnet…**. Die Überlagerung erscheint nach 120 ms und bleibt mindestens 300 ms;
    schnelle Neuberechnungen flackern nicht. Der **Stammbaum-Überblick** hat dieselben Zeiten;
  - eine Schaltfläche, die eine längere Berechnung startet (die Prüfung des Stammbaums, das Paaren beim
    Zusammenführen, der Export der Tabelle, das Poster), sagt, was sie tut („2.400 Personen werden geprüft…“, „Wird
    analysiert…“). Bei einem großen Stammbaum erscheint der Zustand sofort, ohne die 120 ms;
  - während des Systemfensters zur Wahl einer Datei (Import, Sicherung, **Datei hinzufügen**) gibt es keinen
    Zustand; das Element ist nur gegen ein zweites Öffnen des Fensters gesperrt. Eine abgebrochene Wahl gibt das
    Element sofort frei;
  - nach der Wahl trägt der Zustand den Namen der Datei („familie-horak.ged wird geladen…“) und dann die Zahl der
    Personen. Eine Datei, die sich nicht lesen lässt, endet mit einem Satz am Element **Die Datei lässt sich nicht
    lesen: weder GEDCOM noch eine Strom-Sicherung.** mit **Andere Datei wählen**;
  - das Speichern in eine Datei fragt zuerst im Systemfenster, wohin, und zeigt den Zustand erst danach (**Die
    Sicherung wird gespeichert…** oder **Die Datei wird gespeichert…** mit der Zahl der Personen und Fotos). Das
    Verschlüsseln und Entsperren eines Stammbaums haben ihren eigenen Zustand (**Wird verschlüsselt…**, **Wird
    entsperrt…**).
- **Bedienung:** nichts: gilt von selbst.
- **Gilt seit:** App 3.30.0. Bis 3.29.0 zeigten nur manche Stellen den Zustand einer Berechnung, und eine unlesbare
  Datei meldete ein Browserfenster.

<!-- zdroj: app:79a05311 src/ui/canvas-busy.ts (překryv .canvas-busy, nextPaint, BUSY_SHOW_MS 120, BUSY_MIN_MS 300, layout, mapCalc) · c8f8203e, 0c16ef20 Přehled stromu 120/300 ms, volby vzhledu pod překryvem · src/ui/busy.ts runHeavy (heavy, atOnce 'now') · 71fedb93 Kontrola stromu checkingPeople, fcb108b0 párování merge.analyzing, 095a3499 export tabulky, 24149806 plakát, cea9e4ec odhad knihy · src/ui/file-pick.ts (bez stavu během systémového dialogu, zámek proti dvojímu otevření, zrušení → hned zpět, loadingFile, FileUnreadableError → fileUnreadable + pickOther, bez alertu) · src/ui/encryption-ui.ts exportSaveStep (savingBackup / savingFile + filePeople, filePhotos), encryptingK, unlocking · strings.ts busy.layout, mapCalc, checking, analyzing, loadingFile, fileUnreadable, pickOther, savingBackup, savingFile, encrypting, unlocking · ZADANI_DEV_tlacitka-cekani §8, §9 · dirigent:prace/1118-app-tlacitka-b (díl 4–6b) -->

<a id="A9.7.4"></a>
### A9.7.4 Wenn die Forschung oder ein Dienst schweigt

Stellen, die früher ohne Ende warteten oder schwiegen, haben ein Limit. Danach sagen sie, was geschehen ist, und
bieten **Erneut versuchen** an.

- **Grenzen:**
  - die Liste der fehlenden Bilder, die Bewertung möglicher Duplikate, das Lesen und Schreiben der Geschichte und
    die Kartenkacheln warten höchstens 15 s. Die Bewertung sagt dann unter dem Kopf der Gruppe **Die Forschung hat
    nicht geantwortet – die Bewertung wurde nicht geladen.**, die Geschichte „Die Forschung hat in 15 s nicht
    geantwortet.“, die Karte in ihrer Ecke **Die Kartenkacheln wurden nicht geladen.**, alles mit **Erneut
    versuchen**;
  - die Suche eines Orts im Internet wartet 10 s je Anfrage und unterscheidet, warum keine Antwort kam: **Der Dienst
    ist nicht erreichbar (Netzwerkfehler).**, „Der Dienst hat in 10 s nicht geantwortet.“ oder **Der Dienst lehnt
    gerade weitere Anfragen ab (Anfragelimit). Ein neuer Versuch ist später möglich.** Das Auffinden von Orten auf
    der Karte hält dann mit dem Satz und **Erneut versuchen** an; die übrigen Orte werden nicht als nicht gefunden
    markiert;
  - ein leeres Suchergebnis ist kein Fehler: es steht neutral, mit **Anders suchen**;
  - eine Forschung, die nicht läuft: **Die Forschung läuft nicht. Strom Research muss gestartet werden.**; eine
    Forschung, die gerade eine andere Aufgabe schreibt: **Die Forschung schreibt gerade eine andere Aufgabe. Ein
    neuer Versuch ist gleich möglich.**
- **Bedienung:** App: **Erneut versuchen**, **Anders suchen**.
- **Gilt seit:** App 3.30.0. Bis 3.29.0 wartete die Liste der fehlenden Bilder ohne Limit, die Bewertung von
  Duplikaten schwieg ohne Brücke, und die Suche eines Orts ohne Antwort sagte „nicht gefunden“.

<!-- zdroj: app:79a05311 src/research-images.ts MISSING_LIST_TIMEOUT_MS 15 s (c69425d0, i pro export) · src/quality-bridge.ts, src/ui/duplicate-verdicts-ui.ts (ea76fa71: 15 s, treeManager.verdictsSilent pod hlavičkou skupiny + retry) · src/history-bridge.ts HISTORY_READ_TIMEOUT_MS 15 s, HISTORY_WRITE_TIMEOUT_MS · src/ui/history-manage-ui.ts, history-ui.ts, history-kinds-ui.ts errTimeout · src/ui/map-tiles.ts TILE_TIMEOUT_MS 15 s, tilesFailed · src/geocode.ts GEOCODE_TIMEOUT_MS 10 s, GeocodeFailure network|timeout|limit · src/ui/busy.ts serviceFailText (errNetwork, serviceTimeout, serviceLimit) · src/ui/places-find-ui.ts (věta ve výsledcích, searchOther), src/ui/map-ui.ts (70d3368b: běh se zastaví, zbylá místa ne „nenalezena“) · strings.ts busy.errOffline, errBusy, errTimeout, errNetwork, serviceTimeout, serviceLimit, searchOther, tilesFailed · ZADANI_DEV_tlacitka-cekani §10.2, §10.3 · dirigent:prace/1118-app-tlacitka-b (díl 7) -->

<a id="A9.8"></a>
## A9.8 Tastenkürzel

Die Tasten des Hauptfensters der App am Computer. Auf dem Mac gilt ⌘ statt Strg.

| Taste | Was sie tut | Wo und wann | Regel |
|---|---|---|---|
| Esc | schließt den obersten Dialog oder das oberste Menü | überall | – |
| Alt+← / Alt+→ | vorige / nächste zentrale Person | außerhalb der Tabelle; in der Tabelle Sprünge über Namen | [A6.7.16](A6-views.md#A6.7.16) |
| Strg+F, / | Cursor in **Person suchen...** | / nur außerhalb eines Textfelds | [A4.8](A4-surnames-and-families.md#A4.8) |
| Strg+S | **In Datei speichern** | nicht bei einem gesperrten Stammbaum und in einer Kopie nur zum Lesen | [S8](S8-where-the-data-are.md) |
| Strg+Z; Strg+Umschalt+Z oder Strg+Y | **Rückgängig**; **Wiederholen** | außerhalb eines Textfelds | – |
| Entf, Rücktaste | die zentrale Person löschen (nach Bestätigung) | Familie und Nachkommen, außerhalb eines Textfelds; nicht bei einer gesperrten Person und in einem Stammbaum nur zum Lesen | – |
| + oder =; −; 0 | vergrößern; verkleinern; Standardgröße | außerhalb eines Textfelds | – |
| H | die Standardperson fokussieren | Familie, Nachkommen, Fächer; außerhalb eines Textfelds und eines offenen Menüs | [A6.1.6](A6-views.md#A6.1.6) |
| ⌘1 (Mac), Strg+1 (Windows, Linux) | dasselbe wie H, auch aus einem Textfeld | nur wenn der Browser es an die App weitergibt | [A6.1.6](A6-views.md#A6.1.6) |

- **Grenzen:**
  - bei offenem Dialog gelten nur Esc und die Tasten des Dialogs;
  - ⌘1 / Strg+1 nimmt in einem Browser-Tab meist der Browser (der erste Tab);
  - Tabelle, Fenster und Dialoge haben eigene Tasten, bei ihren Regeln (zum Beispiel [A6.7.15](A6-views.md#A6.7.15),
    [A11](A11-lists-of-people.md)).
- **Bedienung:** die Tastatur; die App hat keine Übersicht der Tasten, der Tooltip von ⌂ nennt seine Taste.
- **Gilt seit:** App 3.30.0 (die Übersicht; jede Taste gilt seit der Version in ihrer Regel, H und ⌘1 / Strg+1 seit
  3.30.0)

<!-- zdroj: app:401eaca4 src/ui/misc.ts keydown (Esc a dialogStack; dialog otevřený → return; Alt+←/→ goBack/goForward, v Tabulce ne; Ctrl/⌘+F a „/“ toolbarSearchPicker.focusInput; ⌘S / Ctrl+S saveTreeCopy, ne isViewMode/isLocked; defaultFocusKey H a mod1 + defaultFocusKeyHeld; typing → return; Ctrl/⌘+Z, Shift+Z, Y; Delete/Backspace confirmDelete jen family/descendants, ne isReadOnly, ne isPersonLocked; + = − 0 ZoomPan) · app:b6df0770 spec 111 §6, §8 (přehled v aplikaci ne) -->
