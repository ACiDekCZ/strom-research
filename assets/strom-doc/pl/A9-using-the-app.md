<a id="A9"></a>
# A9 Obsługa aplikacji

Gdzie co w aplikacji Strom jest, jak nazywają się elementy i co zostaje człowiekowi. Obowiązuje tak samo dla
człowieka, dla czytnika ekranu i dla agenta, który czyta stronę narzędziami przeglądarki. Opisuje aplikację Strom
3.25.0 i badanie 1.29.0.

<!-- zdroj: dirigent:spec/063-computer-use-usnadnit K1.1, K1.3, K1.4, K1.5 · test/vysledek-063-pruzkum.md kolo 2 (A1–A7) · app:CHANGELOG.cs.md 3.25.0 -->

<a id="A9.1"></a>
## A9.1 Gdzie co jest

Aplikacja pokazuje otoczenie jednej osoby ([A1.3](A1-the-app-in-brief.md#A1.3)). To, co dotyczy osoby, jest w menu
osoby; to, co dotyczy całego drzewa, jest na pasku narzędzi i w menu **Akcje**.

| Zadanie | Gdzie w aplikacji | Zasada |
|---|---|---|
| znaleźć osobę | pole **Szukaj osoby...** na pasku narzędzi | [A4.8](A4-surnames-and-families.md#A4.8) |
| menu osoby | kliknięcie karty osoby albo Enter na karcie; na urządzeniu dotykowym długie naciśnięcie karty otwiera panel wysuwany od dołu z tymi samymi akcjami | [A6.1](A6-views.md#A6.1) |
| Co wie badanie o osobie | menu osoby → **Badanie → Co wie badanie** | [S3.2](S3-what-the-research-knows.md#S3.2) |
| źródła osoby | menu osoby → **Źródła** | [A3.6](A3-evidence-in-the-app.md#A3.6) |
| źródła drzewa | **Akcje → Źródła** | [A3.1](A3-evidence-in-the-app.md#A3.1) |
| edytować osobę | menu osoby → **Edytuj** | [S2](S2-edits-from-the-app.md), przy śledzeniu [A9.3](#A9.3) |
| widok Mapa i inne widoki | przełącznik widoków na pasku narzędzi; na telefonie, tablecie i w oknie do 1024 px dolny pasek i **Więcej → Widok** | [A6](A6-views.md), [A9.5](#A9.5) |
| całe drzewo w wierszach, eksport CSV i XLSX | **Tabela** w przełączniku widoków; na telefonie, tablecie i w oknie do 1024 px **Tabela** na dolnym pasku | [A6.7](A6-views.md#A6.7) |
| zwinąć minimapę lub legendę drzewa | uszko nad minimapą; **◯** w legendzie | [A9.6](#A9.6) |
| pełny ekran (telefon i tablet) | **Więcej → Pełny ekran**; na iPhonie w Safari **Więcej → Pełny ekran…** | [A9.5](#A9.5) |
| widok albo Przegląd badania w osobnym oknie (na komputerze) | ⧉ **Otwórz w nowym oknie** obok przełącznika widoków; Ctrl+klik (macOS ⌘+klik) na karcie widoku; ⧉ na pasku Tabeli i w nagłówku Przeglądu | [A6.8](A6-views.md#A6.8), [S4.1.6](S4-research-from-the-app.md#S4.1.6) |
| podkład mapy | **Pokaż mapę** przy powiadomieniu, że podkład wczytuje się z openstreetmap.org | [A9.4](#A9.4) |
| miejsca poza mapą | pasek stanu mapy → **W badaniu**; w badaniu sekcja **Czeka na załatwienie** | [A6.5.2](A6-views.md#A6.5.2), [R4.5](R4-places.md#R4.5) |
| praca badania | panel badania, **⤢ Otwórz przegląd**; menu **Badanie → Przegląd badania** | [S4.1](S4-research-from-the-app.md#S4.1) |
| co czeka na człowieka | panel, sekcja **Czeka na załatwienie**; menu **Badanie → Czeka na załatwienie** | [S4.4](S4-research-from-the-app.md#S4.4) |
| śledzenie badania | **Śledź na żywo**; koniec **Zakończ śledzenie** | [S1.4](S1-connecting-app-and-research.md#S1.4), [A9.3](#A9.3) |
| wysyłanie zmian do badania | **Badanie → Więcej → Badanie dla tego drzewa… → Wysyłanie zmian** | [S2.2](S2-edits-from-the-app.md#S2.2) |
| zasady i pojęcia | **Akcje → Jak działa Strom** | [A1.7](A1-the-app-in-brief.md#A1.7) |

- **Granice:**
  - pozycje badania są tylko przy drzewie z badania; przyciski, które otwierają badanie, tylko na komputerze, na
    którym badanie działa ([S3.2](S3-what-the-research-knows.md#S3.2));
  - aplikacja łączy się z badaniem linkiem z terminala, `strom app` ([S1.2](S1-connecting-app-and-research.md#S1.2)).
- **Obsługa:** jak w tabeli.
- **Obowiązuje od:** aplikacja 3.25.0 (podsumowanie; każde miejsce obowiązuje od wersji w swojej zasadzie)

<!-- zdroj: app:index.html search input (search.placeholder) · src/renderer.ts card.onclick → UI.showContextMenu, klávesy Enter/Space · src/ui/bottom-sheet.ts (dlouhý stisk, menu.sectionView) · SPEC.md Long-press → bottom sheet · strings.ts search.placeholder, mobileMenu.more, menu.sectionView, map.tilesNotice, map.tilesNoticeOk, research.stop · cesty z pravidel A3.1, A3.6, A6, A6.5.2, S1.4, S2.2, S3.2, S4.1, S4.4, A1.7 · okna: A6.8, S4.1.6 (app:4b1373a7 src/windows/window-controls.ts) · dolní lišta a Celá obrazovka: A9.5 (app:4b1373a7, commit bb5e4d12) -->

<a id="A9.2"></a>
## A9.2 Elementy mają czytelną nazwę

Każdy element sterujący ma nazwę, którą odczyta czytnik ekranu i narzędzie przeglądarki, które czyta stronę. Wygląd
się przez to nie zmienia.

- **Granice:**
  - przyciski z samą ikoną mają nazwę: powiększenie, filtry, wstecz i dalej, obrót zdjęcia, podgląd, lista przy
    wyszukiwaniu osoby (**Pokaż listę**), powiązany plik, odnośnik do źródła miejsca (**Otwórz źródło**) i inne;
  - zamknięte okna dialogowe i menu nie są odczytywane: nie ma ich w drzewie dostępności ani w tym, co narzędzie
    przeglądarki znajdzie na stronie;
  - panel wysuwany od dołu w trakcie wysuwania nie przyjmuje kliknięcia ani stuknięcia, aby nie trafić w inną pozycję;
  - z ograniczonym ruchem (ustawienie systemu) menu, powiadomienia i panel wysuwany od dołu pokazują się bez animacji;
  - wyszarzona pozycja jest odczytywana razem ze swoim powodem, ale niczego nie uruchamia ([A9.3](#A9.3)).
- **Obsługa:** nic: obowiązuje samo. Ograniczony ruch: ustawienia systemu.
- **Obowiązuje od:** aplikacja 3.25.0

<!-- zdroj: app:commity c641f7b8 (aria-label ikonových prvků, e2e a11y-names), 76f08f6a + 322b08c3 (zavřené dialogy a menu mimo strom přístupnosti, spodní panel inert při vysouvání, prefers-reduced-motion), 4a8b4fed · strings.ts personPicker.showList, places…dSourceOpen · CHANGELOG.cs.md 3.25.0 „Čtečky obrazovky“ · dirigent:test/vysledek-063-pruzkum.md A1–A3 -->

<a id="A9.3"></a>
## A9.3 Edycja podczas śledzenia badania

Drzewo śledzone na żywo jest tylko do odczytu ([S1.4](S1-connecting-app-and-research.md#S1.4)). Aplikacja pokazuje,
dlaczego edycja nie jest możliwa i jak zakończyć śledzenie.

- **Granice:**
  - podczas śledzenia menu osoby pokazuje wyszarzone **Edytuj** z powodem **Podczas śledzenia badania tylko do
    odczytu.**, a tuż pod nim **Zakończ śledzenie**. Obowiązuje na komputerze i na telefonie;
  - **Zakończ śledzenie** w menu osoby kończy śledzenie tak samo jak przycisk w panelu badania;
  - po zakończeniu śledzenia aplikacja od razu raz pyta **Jak wysyłać zmiany do badania?**, gdy przy tym drzewie
    jeszcze nie pytała, a badanie działa i przyjmuje zmiany ([S2.2](S2-edits-from-the-app.md#S2.2)).
- **Obsługa:** aplikacja: menu osoby → **Zakończ śledzenie**; panel badania → **Zakończ śledzenie**.
- **Obowiązuje od:** aplikacja 3.25.0

<!-- zdroj: app:src/ui/context-menu.ts (edit-following disabled + note, live-stop link), src/ui/bottom-sheet.ts (aria-disabled), src/ui/research-sync-ui.ts researchAskSendModeAfterFollow · strings.ts contextMenu.editFollowing, research.stop, treeSettings.askTitle · commity ffed0d42, cc26c35a, cf0352cd · CHANGELOG.cs.md 3.25.0 „Úpravy během sledování výzkumu“ · dirigent:spec/063-computer-use-usnadnit K1.4 -->

<a id="A9.4"></a>
## A9.4 Agent w aplikacji

Agent, który obsługuje aplikację Strom, obsługuje ją narzędziami strony w przeglądarce, tak samo jak czyta ją
czytnik ekranu. Akcje badania idą pewniej poleceniem `strom`. Strom nigdzie nie poleca włączyć sterowania
komputerem ([R12.10](R12-where-the-agent-works.md#R12.10)).

- **Granice:**
  - narzędzia strony ma wbudowana przeglądarka aplikacji Claude i Claude in Chrome. Sterowanie komputerem w aplikacji
    Claude przeglądarkę tylko czyta (zrzut ekranu): klikać i pisać w niej nie można
    ([R12.10](R12-where-the-agent-works.md#R12.10));
  - most do aplikacji Strom zostaje dla agenta zamknięty: agent pracuje ze stroną, nie z mostem
    ([R12.2](R12-where-the-agent-works.md#R12.2));
  - zgoda na podkład mapy (**Pokaż mapę**), pytanie **Jak wysyłać zmiany do badania?** oraz inne wybory i ustawienia
    człowieka zostają człowiekowi.
- **Tylko metodyka:** agent klika element według odnośnika, który dało mu narzędzie wyszukiwania na stronie, nie
  według współrzędnych, i czeka, aż panel wysuwany od dołu się zatrzyma, zanim kliknie ponownie. Akcje badania wykonuje
  poleceniem `strom` w swoim wierszu poleceń; w aplikacji tylko to, czego polecenie nie ma. Wyboru człowieka nie
  klika: mówi, co na człowieka czeka.
- **Obsługa:** nic: obowiązują instrukcje w folderze badania (`AGENTS.md`).
- **Obowiązuje od:** badanie 1.29.0; aplikacja 3.25.0

<!-- zdroj: research:src/agents/files.ts AGENTS.md „## When you have computer use“ (page tools, click by the reference find gives, never by coordinates, wait until a sliding panel has stopped; Claude's computer use only looks at browsers; research through strom; consent or setting left to the person: map's OpenStreetMap, how edits are sent) · CHANGELOG.cs.md 1.29.0 · src/core/browser.ts + src/core/bridgeguard.ts (most odmítnut) · dirigent:test/vysledek-063-pruzkum.md kolo 1 (úrovně), kolo 2 (klik přes ref z find spolehlivý, klik podle souřadnic během vysouvání trefil jinou položku; souhlas Zobrazit mapu nekliknut; místo mimo mapu v Čeká na vyřízení) · spec/063-computer-use-usnadnit K1.2, K1.3, K1.5 -->

<a id="A9.5"></a>
## A9.5 Dolny pasek na telefonie i tablecie

Na telefonie, tablecie i w oknie do 1024 px aplikacja ma zamiast przełącznika widoków dolny pasek. Pozostałe widoki
i akcje są w arkuszu **Więcej**.

- **Dolny pasek:** **Rodzina** | **Potomkowie** | **＋** (dodaj osobę; tylko w drzewie, które można edytować) |
  **Tabela** | **Więcej**. Otwarta Rodzina, Potomkowie lub Tabela jest wyróżniona na pasku; otwarty Wachlarz, Mapa
  lub Oś czasu wyróżnia **Więcej**.
- **Więcej → Widok:** **Wachlarz** | **Mapa** | **Oś czasu**. Na telefonie jest pod nimi wybór rodu
  ([A6.6](A6-views.md#A6.6)), gdy drzewo go oferuje; nie przy Osi czasu, Mapie i Tabeli.
- **Pełny ekran:** w arkuszu **Więcej** jest **Pełny ekran**, w trybie pełnego ekranu **Zamknij pełny ekran**.
  Paski przeglądarki nie zajmują wtedy miejsca.
  - Oferuje się go tylko tam, gdzie przeglądarka pozwala stronie na pełny ekran, i tylko z dolnym paskiem. Telefon
    trzymany poziomo ma go jako czwarty kafelek w wierszu **Widok**.
  - Na iPhonie lub iPadzie, którego przeglądarka nie pozwala stronie na pełny ekran (Safari na iPhonie), jest zamiast
    niego **Pełny ekran…** z podpowiedzią: Strom dodany do ekranu początkowego (**Udostępnij → Do ekranu
    początkowego**) otwiera się bez pasków przeglądarki, ale ma własną, oddzielną pamięć; drzewo trafia do niej przez
    eksport i import. Aplikacja uruchomiona z ekranu początkowego tego wiersza nie ma.
  - Gdy przeglądarka pełny ekran odrzuci, okno zostaje bez zmian.
- **Obsługa:** dolny pasek; **Więcej → Widok**; **Więcej → Pełny ekran**.
- **Obowiązuje od:** aplikacja 3.28.0 (do 3.27.0 dolny pasek miał **Oś czasu** zamiast **Tabeli**, a Tabela była
  w **Więcej → Widok**)

<!-- zdroj: app:4b1373a7 index.html #bottom-bar (bb-view-family, bb-view-descendants, bottom-bar-fab edit-only, bb-view-table, bb-view-more) · src/ui/misc.ts:530–533 (active: table na liště; fan, map, timeline → Více) · src/breakpoints.ts isTabletOrMobile (≤ 1024 px), isPhoneBar, MQ_PHONE_LANDSCAPE · src/ui/bottom-sheet.ts blok 5 (Pohled: fan, map, timeline; rodRow jen isPhoneBar, ne timeline/map/table; fullscreenRow jen isTabletOrMobile, na šířku čtvrtá dlaždice) · src/ui/fullscreen.ts fullscreenOffer (fullscreenEnabled → enter/exit; iOS a ne standalone → ios-hint; jinak nic), toggleFullscreen (odmítnutí: okno beze změny) · src/file-copy.ts isIosDevice · src/pwa.ts isStandaloneDisplay · strings.ts mobileMenu.fullscreen, fullscreenExit, fullscreenIos, fullscreenIosText, menu.sectionView, viewModeSwitch.* · commit bb5e4d12 (dřív bb-view-timeline a v Pohledu Tabulka) · dirigent:spec/082-tester-3.28 K1.1, K1.3 · prace/1112-app-tester-328-telefon -->

<a id="A9.6"></a>
## A9.6 Minimapę i legendę drzewa można zwinąć

Minimapę i legendę drzewa można zwinąć, aby nie zasłaniały drzewa. Urządzenie zapamiętuje wybór dla wszystkich drzew.
Zwinięcie to nie wyłączenie: czy element w ogóle się pokazuje, nadal decydują ustawienia **Minimapa** i **Legenda
drzewa**.

- **Minimapa** (komputer i tablet, widoki Rodzina i Potomkowie, gdy drzewo jest większe niż okno):
  - na górnej krawędzi bloku z minimapą jest uszko: ⌄ zwija minimapę (**Zwiń minimapę**), zwinięta ma uszko ze
    znakiem minimapy (**Rozwiń minimapę**). Przy myszy uszko widać tylko po najechaniu na blok lub przy fokusie
    klawiatury, na dotyku zawsze;
  - zwinięta minimapa się ukrywa i nie rysuje; przyciski powiększenia zostają na swoim miejscu;
  - domyślnie rozwinięta. Telefon nie ma minimapy.
- **Legenda drzewa:**
  - **◯** zwija legendę do chipu „◯ Legenda”, a chip ją z powrotem rozwija. Przyciskiem jest pierwsza część pigułki
    (po najechaniu zmienia się w ⌄, **Zwiń legendę**), a w panelu ze znakami kart cały nagłówek „◯ Legenda ⌄”;
  - domyślnie rozwinięta. Przeciąganie myszą po legendzie poza przyciskiem dalej przesuwa drzewo;
  - zwinięty chip ma kropkę, gdy widok pokazuje rodzaj znaku karty, którego legenda na tym urządzeniu jeszcze
    rozwinięta nie pokazała; czytnik ekranu czyta „Legenda, nowy znak”. Po rozwinięciu kropka znika;
  - **telefon** (pionowo i poziomo): legenda jest zawsze chipem. Stuknięcie otwiera ją jako panel od dołu (poziomo
    jako panel po prawej) z nagłówkiem „◯ Legenda” i **Gotowe**. Zamyka go **Gotowe**, stuknięcie obok, przeciągnięcie
    w dół (poziomo w prawo) i Esc. Po odświeżeniu strony sam się nie otwiera, a telefon wyboru urządzenia nie czyta
    ani nie zapisuje.
- **Granice:** bez pamięci przeglądarki (okno prywatne) wybór obowiązuje do zamknięcia strony.
- **Obsługa:** uszko nad minimapą; **◯** w legendzie, chip „◯ Legenda”. Wyłączenie: ustawienia **Minimapa**,
  **Legenda drzewa**.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:f5d56ed3 src/ui/minimap.ts readMinimapOpen (strom-minimap-open, výchozí otevřeno), setMinimapFold (ouško jen když je minimapa nabízená), updateMinimap (isMinimapEnabled, mobil a telefon na šířku bez minimapy, STANDALONE_VIEWS, sbaleno: display none, nic se nekreslí) · src/ui/tree-legend.ts readTreeLegendOpen (strom-tree-legend-open, výchozí otevřeno), readTreeLegendSeen / noteTreeLegendSeen (strom-tree-legend-seen), syncTreeLegendFold (tečka, aria-label title + newMark, telefon vždy čip), openTreeLegendSheet (Hotovo = tour.done, klepnutí vedle, tažení 80 px dolů / doprava na šířku, nečte ani nepíše volbu), paměť bez úložiště · src/ui/misc.ts updateLegendMarks (data-marks: story-own, story-other, action, cross) · src/storage-keys.ts TREE_UI_STORAGE_KEYS · index.html .minimap-toggle (hover / pointer coarse), #tree-legend .tree-legend-toggle, pointer-events · strings.ts minimap.title, collapse, expand, settingLabel; legend.title, collapse, expand, newMark; settings legendLabel · app d78ba58b · dirigent:prace/1113-app-drobnosti-1112 · ZADANI_DEV_drobnosti-1112 §2 -->
