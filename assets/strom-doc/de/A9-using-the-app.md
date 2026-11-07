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
| Ansicht Karte und weitere Ansichten | Umschalter der Ansichten in der Leiste; im schmalen Fenster und auf dem Telefon **Mehr → Ansicht** | [A6](A6-views.md) |
| Kartenhintergrund | **Karte anzeigen** beim Hinweis, dass der Hintergrund von openstreetmap.org geladen wird | [A9.4](#A9.4) |
| Orte ohne Karte | Statusleiste der Karte → **In der Forschung**; in der Forschung der Abschnitt **Wartet auf Bearbeitung** | [A6.5.2](A6-views.md#A6.5.2), [R4.5](R4-places.md#R4.5) |
| Arbeit der Forschung | Panel der Forschung, **⤢ Übersicht öffnen**; Menü **Forschung → Forschungsübersicht** | [S4.1](S4-research-from-the-app.md#S4.1) |
| was auf den Menschen wartet | Panel, Abschnitt **Wartet auf Bearbeitung**; Menü **Forschung → Wartet auf Bearbeitung** | [S4.4](S4-research-from-the-app.md#S4.4) |
| Verfolgen der Forschung | **Live verfolgen**; Ende **Verfolgung beenden** | [S1.4](S1-connecting-app-and-research.md#S1.4), [A9.3](#A9.3) |
| Senden der Änderungen an die Forschung | **Forschung → Weitere Aktionen → Forschung für diesen Stammbaum… → Änderungen senden** | [S2.2](S2-edits-from-the-app.md#S2.2) |
| Regeln und Begriffe | **Aktionen → So funktioniert Strom** | [A1.7](A1-the-app-in-brief.md#A1.7) |

- **Grenzen:**
  - die Einträge der Forschung gibt es nur bei einem Stammbaum aus der Forschung; Schaltflächen, die die Forschung
    öffnen, nur auf dem Computer, auf dem die Forschung läuft ([S3.2](S3-what-the-research-knows.md#S3.2));
  - die App verbindet sich mit der Forschung über einen Link aus dem Terminal, `strom app`
    ([S1.2](S1-connecting-app-and-research.md#S1.2)).
- **Bedienung:** wie in der Tabelle.
- **Gilt seit:** App 3.25.0 (Übersicht; jeder Ort gilt seit der Version in seiner Regel)

<!-- zdroj: app:index.html search input (search.placeholder) · src/renderer.ts card.onclick → UI.showContextMenu, klávesy Enter/Space · src/ui/bottom-sheet.ts (dlouhý stisk, menu.sectionView) · SPEC.md Long-press → bottom sheet · strings.ts search.placeholder, mobileMenu.more, menu.sectionView, map.tilesNotice, map.tilesNoticeOk, research.stop · cesty z pravidel A3.1, A3.6, A6, A6.5.2, S1.4, S2.2, S3.2, S4.1, S4.4, A1.7 -->

<a id="A9.2"></a>
## A9.2 Bedienelemente haben einen lesbaren Namen

Jedes Bedienelement hat einen Namen, den ein Bildschirmleser und auch ein Werkzeug des Browsers, das die Seite liest,
lesen. Das Aussehen ändert sich dadurch nicht.

- **Grenzen:**
  - Schaltflächen nur mit einem Symbol haben einen Namen: Vergrößern, Filter, zurück und vor, Drehen eines Fotos,
    Vorschau, die Liste bei der Personensuche (**Liste anzeigen**), eine verknüpfte Datei, der Link zur Quelle eines
    Ortes (**Quelle öffnen**) und weitere;
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
