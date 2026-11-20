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
| listy osób (stałe, automatyczne, robocze) | **Akcje → Listy osób…**; na telefonie **Więcej → Listy osób** | [A11](A11-lists-of-people.md) |
| kadrowanie portretu, zdjęcie pary | edycja osoby → **Wybierz zdjęcie**, **Edytuj kadr**; edycja osoby → **Zarządzaj relacjami** → wiersz **Zdjęcie** | [A12](A12-portrait-and-couple-photo.md) |
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
| powrót do osoby domyślnej drzewa | ⌂ na początku **W centrum**; klawisz H | [A6.1.6](A6-views.md#A6.1.6), [A9.8](#A9.8) |
| działanie, które chwilę trwa | stan na przycisku (kółko i to, co się dzieje); długie działanie w powiadomieniu z postępem | [A9.7](#A9.7) |

- **Granice:**
  - pozycje badania są tylko przy drzewie z badania; przyciski, które otwierają badanie, tylko na komputerze, na
    którym badanie działa ([S3.2](S3-what-the-research-knows.md#S3.2));
  - aplikacja łączy się z badaniem linkiem z terminala, `strom app` ([S1.2](S1-connecting-app-and-research.md#S1.2)).
- **Obsługa:** jak w tabeli.
- **Obowiązuje od:** aplikacja 3.25.0 (podsumowanie; każde miejsce obowiązuje od wersji w swojej zasadzie)

<!-- zdroj: app:index.html search input (search.placeholder) · src/renderer.ts card.onclick → UI.showContextMenu, klávesy Enter/Space · src/ui/bottom-sheet.ts (dlouhý stisk, menu.sectionView) · SPEC.md Long-press → bottom sheet · strings.ts search.placeholder, mobileMenu.more, menu.sectionView, map.tilesNotice, map.tilesNoticeOk, research.stop · cesty z pravidel A3.1, A3.6, A6, A6.5.2, A11 (od 3.30.0, index.html #actions-lists-row, bottom-sheet.ts sheet-lists), A12 (od 3.30.0, app:88859da2 person-modal.ts, 9a47896e relationships-panel.ts; tlačítka otočení fotky přesunuta do editoru), S1.4, S2.2, S3.2, S4.1, S4.4, A1.7 · okna: A6.8, S4.1.6 (app:4b1373a7 src/windows/window-controls.ts) · dolní lišta a Celá obrazovka: A9.5 (app:4b1373a7, commit bb5e4d12) · akce, která trvá: A9.7 (app:2d01dffd src/ui/busy.ts) -->

<a id="A9.2"></a>
## A9.2 Elementy mają czytelną nazwę

Każdy element sterujący ma nazwę, którą odczyta czytnik ekranu i narzędzie przeglądarki, które czyta stronę. Wygląd
się przez to nie zmienia.

- **Granice:**
  - przyciski z samą ikoną mają nazwę: powiększenie, filtry, wstecz i dalej, obrót zdjęcia (od aplikacji 3.30.0
    w edytorze kadrowania portretu, [A12.1](A12-portrait-and-couple-photo.md#A12.1)), podgląd, lista przy
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
    ani nie zapisuje;
  - od aplikacji 3.30.0 legenda pokazuje obok obwódek płci także **Oznaczenie linii** w wybranym kształcie
    ([A6.1.5](A6-views.md#A6.1.5)).
- **Granice:** bez pamięci przeglądarki (okno prywatne) wybór obowiązuje do zamknięcia strony.
- **Obsługa:** uszko nad minimapą; **◯** w legendzie, chip „◯ Legenda”. Wyłączenie: ustawienia **Minimapa**,
  **Legenda drzewa**.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:f5d56ed3 src/ui/minimap.ts readMinimapOpen (strom-minimap-open, výchozí otevřeno), setMinimapFold (ouško jen když je minimapa nabízená), updateMinimap (isMinimapEnabled, mobil a telefon na šířku bez minimapy, STANDALONE_VIEWS, sbaleno: display none, nic se nekreslí) · src/ui/tree-legend.ts readTreeLegendOpen (strom-tree-legend-open, výchozí otevřeno), readTreeLegendSeen / noteTreeLegendSeen (strom-tree-legend-seen), syncTreeLegendFold (tečka, aria-label title + newMark, telefon vždy čip), openTreeLegendSheet (Hotovo = tour.done, klepnutí vedle, tažení 80 px dolů / doprava na šířku, nečte ani nepíše volbu), paměť bez úložiště · src/ui/misc.ts updateLegendMarks (data-marks: story-own, story-other, action, cross) · src/storage-keys.ts TREE_UI_STORAGE_KEYS · index.html .minimap-toggle (hover / pointer coarse), #tree-legend .tree-legend-toggle, pointer-events · strings.ts minimap.title, collapse, expand, settingLabel; legend.title, collapse, expand, newMark; settings legendLabel · app d78ba58b · dirigent:prace/1113-app-drobnosti-1112 · ZADANI_DEV_drobnosti-1112 §2 -->

<a id="A9.7"></a>
## A9.7 Działanie, które chwilę trwa

Przycisk lub link, którego działanie chwilę trwa, pokazuje, że pracuje, i kończy się jedną wiadomością: udało się
albo dlaczego nie. Drugie kliknięcie w tym czasie niczego ponownie nie uruchamia.

- **Granice:**
  - element blokuje się zaraz po kliknięciu. Drugie kliknięcie, Enter ani spacja niczego ponownie nie uruchamiają.
    Element nie szarzeje, zachowuje kolor i fokus klawiatury i nie zmienia szerokości;
  - stan pokazuje się dopiero po 120 ms, żeby krótkie działania nie migały, i zostaje widoczny co najmniej 300 ms:
    kółko i słowa, co się dzieje. Czasownik zmienia się w rzeczownik odczasownikowy (**Wyślij** → **Wysyłanie…**),
    w przeciwnym razie stoi **Wczytywanie…**; link do terminala mówi **Otwieranie badania…**
    ([S4.5](S4-research-from-the-app.md#S4.5)). Przy ograniczonym ruchu (ustawienie systemu) zamiast kółka stoją trzy
    kropki;
  - link w tekście i pozycja menu zachowują swój tekst, a kółko stoi za nim. Przycisk z samą ikoną (⋯, ✕) ma kółko
    w miejscu ikony, w tej samej wielkości. Działanie z menu, które po kliknięciu się zamyka, zostawia swój stan na
    wierszu, do którego należy (zadanie, linia, materiał); bez takiego wiersza niesie go powiadomienie;
  - lista lub element, który podczas pracy rysuje się na nowo (most jest pytany co sekundę), utrzymuje stan bez
    przerwy: nowy element ma go od razu, więc w międzyczasie nie da się go kliknąć ponownie;
  - powodzenie tam, gdzie wynik nie jest inaczej widoczny, pokazuje na elemencie przez 2 s znak ✓ ze słowem
    (**Zapisano w badaniu**, **Zapisano**);
  - niepowodzenie to zdanie tuż pod elementem ze **Spróbować ponownie**. Gdy element w międzyczasie zniknął
    (zamknięte menu lub okno), to samo mówi powiadomienie; powiadomienie o błędzie samo się nie zamyka i ma ✕. Okno
    przeglądarki z komunikatem nie jest używane. „Nic nie znaleziono” nie jest błędem: stoi neutralne zdanie ze
    **Szukać inaczej** ([A9.7.4](#A9.7.4));
  - każde działanie ma limit czasu według tego, na co czeka: zapytanie do badania 15 s, zapis do badania 30 s,
    wczytanie lub wysłanie drzewa 120 s, otwarcie terminala 10 s, praca nad kolejką 30 s, usługa w internecie 10 s
    na zapytanie; dalsze limity są w [A9.7.4](#A9.7.4). Obliczenie w przeglądarce nie ma limitu;
  - na telefonie i tablecie obowiązuje to samo. Arkusz z menu działań zamyka się od razu po wyborze, a stan niesie
    wiersz.
- **Obsługa:** nic: obowiązuje samo.
- **Obowiązuje od:** aplikacja 3.30.0, w całej aplikacji: linki do terminala, **Wyślij**, przekazanie drzewa badaniu,
  wczytanie wersji z badania, przełączenie drzewa, **Praca nad kolejką…**, **Treść wszystkich zapytań**, przyciski
  w powiadomieniach, pozycje menu, linki i ikony, zapisy do badania ([A9.7.2](#A9.7.2)), obliczenia i pliki
  ([A9.7.3](#A9.7.3)). Do 3.29.0 niektóre miejsca miały własne kółko, inne nic, a pracujący element był
  przyciemniony.

<!-- zdroj: app:2d01dffd, 7b69dba9, 574e7ef9, 6ee5a7f7, f63cc742, 3f841191, 1473151c, d2bdabac, c02df469, 6093a386, 58539c82 src/ui/busy.ts (runBusy: zámek 0 ms aria-disabled, BUSY_SHOW_MS 120, BUSY_MIN_MS 300, BUSY_DONE_MS 2000, šířka v jedné buňce .bl, bez ztlumení, konec věta .busy-msg + retry, prvek pryč → toast, BUSY_TIMEOUTS bridge 15 s, write 30 s, tree 120 s, terminal 10 s, queueWork 30 s, network 10 s, local bez limitu; reducedMotion tři tečky) · strings.ts busy.generic, sending, openingResearch, done.written, done.saved, retry · CHANGELOG.cs.md 3.30.0 „Tlačítka, která čekají“ · app:docs/ZADANI_DEV_tlacitka-cekani.md §1, §10, §13.1 (fáze 0–1) · dirigent:prace/1118-app-tlacitka-a · fáze 2–4: app:79a05311 (00fd19b6..2e1ec36f, 727f2fa7) src/ui/busy.ts trailsSpinner (a, .link, menuitem: kolečko za textem), iconOnly (kolečko místo ikony), rowOf (§4: stav na řádku), toastWhenGone, MutationObserver přenos stavu na překreslený prvek (727f2fa7, dřív kontrola co 400 ms); 00852929 jediné .busy-spin, ztlumení pracujících pryč; ZADANI_DEV §4, §5, §10.1, §11.1 · BUSY_TIMEOUTS.satellite 10 s a busy.mainWindowSilent v kódu jsou, ale žádné místo je nepoužívá: nepopsáno (nález) · dirigent:prace/1118-app-tlacitka-b, 1118-app-tlacitka-n1 -->

<a id="A9.7.1"></a>
### A9.7.1 Długie działanie: postęp w powiadomieniu

Działanie, które trwa dłużej, pokazuje swój postęp w powiadomieniu: co się właśnie dzieje i jak długo to trwa.

- **Granice:**
  - powiadomienie z postępem pokazuje się, gdy działanie trwa dłużej niż 3 s albo gdy element, który je uruchomił,
    zniknął. Ma nazwę, krok („2 z 5”), od 10 s czas („· 12 s”), a po dwukrotności zwykłego czasu, najwcześniej po
    20 s, **Trwa dłużej niż zwykle.** Powodzenie pokazuje przez 4 s podsumowanie ze znakiem ✓;
  - **Anuluj** ma tylko działanie, które naprawdę można anulować. Zapisu do badania anulować nie można. Zamknięcie
    okna nie anuluje działania;
  - przekazanie drzewa badaniu pokazuje kroki (**Zapisywanie kopii zapasowej**, **Tworzenie GEDCOM**, **Badanie
    przejmuje drzewo**, wczytywanie), a okno można zostawić w działaniu przez **Kontynuować w tle**;
  - przełączenie drzewa najpierw wysyła niewysłane zmiany otwartego drzewa do badania (**Przed przełączeniem
    wysyłanie zmian do badania…**), najwyżej 15 s. Gdy do tego czasu nie zostaną wysłane, drzewo się nie przełącza:
    **Przełączenie się nie udało: zmiany nie zostały wysłane w ciągu 15 s. Drzewo pozostało otwarte.** ze
    **Spróbować ponownie**;
  - podczas wczytywania wersji z badania, przekazania i przełączania drzewa zmiany w drzewie czekają: próba zmiany
    niczego nie zmienia, a powiadomienie mówi dlaczego (**Drzewo wczytuje się teraz z badania – zmiany będą możliwe
    po wczytaniu.**, **Drzewo jest teraz przełączane – zmiany będą możliwe potem.**). Przeglądanie i wyszukiwanie
    działają dalej;
  - praca w częściach pokazuje, gdzie jest: książka rodzinna w nowym oknie **Przygotowywanie książki…** z „rozdział
    3 z 12”, a w oknie głównym powiadomienie z postępem; „Utwórz 3 drzewa” przy podziale „Tworzenie drzewa 2 z 3: …”;
    szyfrowanie wszystkich drzew „Szyfrowanie drzewa 2 z 5…”; wczytywanie dużego pliku liczbę już odczytanych osób;
  - postęp partii, wysyłania obrazów, odczytu dokumentu, obrazów źródeł i wyszukiwania miejsc na mapie wygląda tak
    samo: jeden pasek, po prawej „k z n”, działania w prawym dolnym rogu;
  - opuszczenie strony, gdy trwa wysyłanie do badania lub wczytywanie drzewa, przeglądarka najpierw potwierdza. Gdy
    strona zamknęła się w trakcie zapisu, przy następnym otwarciu mówi **Przed zamknięciem trwało wysyłanie do
    badania – wynik nie jest znany.** ze **Sprawdzić**.
- **Obsługa:** aplikacja: **Anuluj**, **Kontynuować w tle**, **Sprawdzić**, **Spróbować ponownie**
  w powiadomieniu.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:2d01dffd, 3f841191, 1473151c, d2bdabac src/ui/toast.ts showProgressToast (ELAPSED_FROM_MS 10 s, TAKING_LONG_MIN_MS 20 s a 2× usualMs, SUMMARY_MS 4000, cancel jen kde jde) · src/ui/busy.ts BUSY_LONG_TOAST_MS 3000 · src/ui/adopt-progress.ts, research-adopt-ui.ts (kroky adoptBackup, adoptGedcom, adoptTaking, loadingTree; adoptBackground) · src/ui/tree-edit-lock.ts (load, adopt, switch; editsWaitLoad, editsWaitAdopt, editsWaitSwitch) · src/ui/busy-leave.ts (beforeunload při send, adopt, load; strom.busy.pending → unknownAfterLeave + findOut) · strings.ts busy.* · app:docs/ZADANI_DEV_tlacitka-cekani.md §2 · fáze 2–4: app:79a05311 src/ui/tree-switch-busy.ts (TREE_SWITCH_SEND_MS 15 s, beforeSwitchSend, switchNotSent, retry) · src/ui/book-ui.ts (nové okno book-window.ts preparingBook, chapterK, showProgressToast) · src/ui/split-ui.ts, split-families-ui.ts creatingTreeK · src/ui/encryption-ui.ts encryptingK · db6f48cd src/ui/in-parts.ts, import-export.ts (GED po částech, počet osob) · de144a3e jeden pruh .bar + .prog „k z n“ (dávka, snímky k úkolu, čtení dokumentu, obrazy pramenů, dohledání míst) · ZADANI_DEV §2.3, §2.6, §2.8, §3.4, §8 -->

<a id="A9.7.2"></a>
### A9.7.2 Zapis do badania widoczny od razu

Wiersz, przełącznik lub wybór, który zapisuje do badania, pokazuje zmianę od razu. Dopóki badanie jej nie potwierdzi,
widać na nim, że trwa zapisywanie; odmowa cofa zmianę i mówi dlaczego.

- **Granice:**
  - przesunięcie lub zmiana wiersza (pozycja w **Czeka na załatwienie** → **Wysłano** i z powrotem, linia
    przesunięta w kolejności) stoi od razu w nowym miejscu. Do potwierdzenia na końcu wiersza stoją kółko
    i „zapisywanie”; wiersz nie jest przyciemniony. Po potwierdzeniu znak znika, bez ✓;
  - odmowa wraca wiersz na jego miejsce, podbarwia go na 10 s, a w wierszu stoi zdanie z powodem i **Spróbować
    ponownie**. Fokus, który był w wierszu, przechodzi na zdanie. Wiersz, którego w międzyczasie nie widać (przegląd
    zamknięty, sekcja zwinięta), mówi o odmowie powiadomieniem;
  - przełącznik, który zapisuje (rodzaje i wyszukiwanie historii, ustawienia badania dla drzewa, **Badanie
    włączone**), pokazuje nowy stan od razu, z przerywanym obrysem i zablokowany. Po 120 ms stoi pod nim
    **Zapisywanie…** (**Włączanie…**, **Wyłączanie…**), po 5 s **Czeka na badanie**. Odmowa przestawia przełącznik
    z powrotem, a przy nim stoi zdanie „Bez zmian: <powód>” ze **Spróbować ponownie**, bez powiadomienia;
  - **Badanie włączone** czeka na most najwyżej 30 s. Potem przełącznik wraca i stoi **Badanie nie odezwało się
    w ciągu 30 s. Trzeba uruchomić Strom Research.** z poleceniem do terminala i **Spróbować ponownie**
    ([S1.9](S1-connecting-app-and-research.md#S1.9));
  - filtr kolejki przełącza się od razu, a lista pod nim mówi **Wczytywanie zadań…**, dopóki nie przyjdzie
    odpowiedź;
  - **Cofnij** w powiadomieniu: powiadomienie nie znika, pokazuje **Cofanie…**, a potem „Cofnięto.” albo „Nie
    cofnięto: <powód>” ze **Spróbować ponownie**. Drugie kliknięcie w tym czasie niczego nie uruchamia.
- **Obsługa:** nic: obowiązuje samo. **Spróbować ponownie** przy zdaniu.
- **Obowiązuje od:** aplikacja 3.30.0. Do 3.29.0 odmowę mówiło tylko powiadomienie, a przełącznik po cichu odrzucał
  kolejne kliknięcia.

<!-- zdroj: app:79a05311 src/ui/research-waiting-write-ui.ts (startWaitingRows announce savingRow, endWaitingRows: vrácení, podbarvení 10 s, věta v řádku, sayWaitingRowRefused fokus na větu, řádek mimo → showWaitingRefused toast) · src/ui/research-directions-ui.ts, research-overview-ui.ts savingRow · src/ui/switch-pend.ts (data-pend, aria-busy, aria-disabled, BUSY_SHOW_MS 120, PEND_WAIT_MS 5000 waitingResearch, odmítnutí: přepínač zpět + věta role=alert + retry, bez toastu; uživatelé history-kinds-ui, history-manage-ui, history-ui, person-research-ui, research-live-ui, research-offline-ui, research-tree-settings-ui) · src/ui/research-live-ui.ts START_CONFIRM_MS 30 s, researchLiveTimedOut liveSilent + COMMAND_START + retry · src/ui/research-ui.ts queueLoadingStatus (live.queueLoading) · src/ui/toast.ts (reverting, undone, notUndone, SUMMARY_MS 4000, a901c925 akce oddělené) · strings.ts busy.savingRow, saving, turningOn, turningOff, waitingResearch, notChanged, liveSilent, reverting, undone, notUndone · ZADANI_DEV_tlacitka-cekani §4, §6, §7 · dirigent:prace/1118-app-tlacitka-b (díl 1–2b) -->

<a id="A9.7.3"></a>
### A9.7.3 Obliczenia i pliki w aplikacji

To, co liczy tylko przeglądarka (układ drzewa, mapa, kontrola, książka, eksport), i to, co czyta lub zapisuje plik,
pokazuje swój stan jak działanie czekające na badanie. Stan jest narysowany, zanim obliczenie się zacznie, żeby okno
nie wyglądało na zamrożone.

- **Granice:**
  - układ drzewa (**Pokaż w drzewie**, **Następna osoba ›**, wybór, który rysuje drzewo na nowo) i mapa całego
    drzewa zakrywają powierzchnię nakładką **Obliczanie układu…** lub **Obliczanie mapy…**. Nakładka pokazuje się po
    120 ms i zostaje co najmniej 300 ms; szybkie przeliczenia nie migają. **Przegląd drzewa** ma te same czasy;
  - przycisk, który uruchamia dłuższe obliczenie (kontrola drzewa, parowanie przy scalaniu, eksport tabeli, plakat),
    mówi, co robi („Sprawdzanie: 2400 osób…”, „Analizowanie…”). W dużym drzewie stan pokazuje się od razu, bez
    120 ms;
  - dopóki jest otwarte okno systemu do wyboru pliku (import, kopia zapasowa, **Dodaj plik**), nie ma żadnego stanu;
    element jest tylko zablokowany przed drugim otwarciem okna. Odwołany wybór zwalnia element od razu;
  - po wyborze stan niesie nazwę pliku („Wczytywanie rodzina-horakow.ged…”), a potem liczbę osób. Plik, którego nie
    da się odczytać, kończy się zdaniem przy elemencie **Nie można odczytać pliku: to nie jest GEDCOM ani kopia
    zapasowa Strom.** z **Wybrać inny plik**;
  - zapis do pliku najpierw pyta w oknie systemu, gdzie zapisać, a stan pokazuje dopiero potem (**Zapisywanie kopii
    zapasowej…** lub **Zapisywanie pliku…** z liczbą osób i zdjęć). Szyfrowanie i odblokowanie drzewa mają własny
    stan (**Szyfrowanie…**, **Odblokowywanie…**).
- **Obsługa:** nic: obowiązuje samo.
- **Obowiązuje od:** aplikacja 3.30.0. Do 3.29.0 stan obliczenia pokazywały tylko niektóre miejsca, a nieczytelny plik
  zgłaszało okno przeglądarki.

<!-- zdroj: app:79a05311 src/ui/canvas-busy.ts (překryv .canvas-busy, nextPaint, BUSY_SHOW_MS 120, BUSY_MIN_MS 300, layout, mapCalc) · c8f8203e, 0c16ef20 Přehled stromu 120/300 ms, volby vzhledu pod překryvem · src/ui/busy.ts runHeavy (heavy, atOnce 'now') · 71fedb93 Kontrola stromu checkingPeople, fcb108b0 párování merge.analyzing, 095a3499 export tabulky, 24149806 plakát, cea9e4ec odhad knihy · src/ui/file-pick.ts (bez stavu během systémového dialogu, zámek proti dvojímu otevření, zrušení → hned zpět, loadingFile, FileUnreadableError → fileUnreadable + pickOther, bez alertu) · src/ui/encryption-ui.ts exportSaveStep (savingBackup / savingFile + filePeople, filePhotos), encryptingK, unlocking · strings.ts busy.layout, mapCalc, checking, analyzing, loadingFile, fileUnreadable, pickOther, savingBackup, savingFile, encrypting, unlocking · ZADANI_DEV_tlacitka-cekani §8, §9 · dirigent:prace/1118-app-tlacitka-b (díl 4–6b) -->

<a id="A9.7.4"></a>
### A9.7.4 Gdy badanie lub usługa milczy

Miejsca, które dawniej czekały bez końca albo milczały, mają limit. Po nim mówią, co się stało, i oferują
**Spróbować ponownie**.

- **Granice:**
  - lista brakujących obrazów, ocena możliwych duplikatów, odczyt i zapis historii oraz podkłady mapy czekają
    najwyżej 15 s. Ocena mówi wtedy pod nagłówkiem grupy **Badanie nie odpowiedziało – ocena się nie wczytała.**,
    historia „Badanie nie odpowiedziało w ciągu 15 s.”, mapa w swoim rogu **Podkłady mapy się nie wczytały.**,
    wszystko ze **Spróbować ponownie**;
  - wyszukanie miejsca w internecie czeka 10 s na zapytanie i rozróżnia, dlaczego nie przyszła odpowiedź: **Usługa
    jest niedostępna (błąd sieci).**, „Usługa nie odpowiedziała w ciągu 10 s.” albo **Usługa odrzuca teraz kolejne
    zapytania (limit zapytań). Ponowna próba będzie możliwa później.** Wyszukiwanie miejsc na mapie zatrzymuje się
    wtedy ze zdaniem i **Spróbować ponownie**; pozostałe miejsca nie są oznaczone jako nieznalezione;
  - pusty wynik wyszukiwania nie jest błędem: stoi neutralnie, ze **Szukać inaczej**;
  - badanie, które nie działa: **Badanie nie działa. Trzeba uruchomić Strom Research.**; badanie, które zapisuje
    właśnie inne zadanie: **Badanie zapisuje teraz inne zadanie. Ponowna próba będzie możliwa za chwilę.**
- **Obsługa:** aplikacja: **Spróbować ponownie**, **Szukać inaczej**.
- **Obowiązuje od:** aplikacja 3.30.0. Do 3.29.0 lista brakujących obrazów czekała bez limitu, ocena duplikatów bez
  mostu milczała, a wyszukanie miejsca bez odpowiedzi mówiło „nie znaleziono”.

<!-- zdroj: app:79a05311 src/research-images.ts MISSING_LIST_TIMEOUT_MS 15 s (c69425d0, i pro export) · src/quality-bridge.ts, src/ui/duplicate-verdicts-ui.ts (ea76fa71: 15 s, treeManager.verdictsSilent pod hlavičkou skupiny + retry) · src/history-bridge.ts HISTORY_READ_TIMEOUT_MS 15 s, HISTORY_WRITE_TIMEOUT_MS · src/ui/history-manage-ui.ts, history-ui.ts, history-kinds-ui.ts errTimeout · src/ui/map-tiles.ts TILE_TIMEOUT_MS 15 s, tilesFailed · src/geocode.ts GEOCODE_TIMEOUT_MS 10 s, GeocodeFailure network|timeout|limit · src/ui/busy.ts serviceFailText (errNetwork, serviceTimeout, serviceLimit) · src/ui/places-find-ui.ts (věta ve výsledcích, searchOther), src/ui/map-ui.ts (70d3368b: běh se zastaví, zbylá místa ne „nenalezena“) · strings.ts busy.errOffline, errBusy, errTimeout, errNetwork, serviceTimeout, serviceLimit, searchOther, tilesFailed · ZADANI_DEV_tlacitka-cekani §10.2, §10.3 · dirigent:prace/1118-app-tlacitka-b (díl 7) -->

<a id="A9.8"></a>
## A9.8 Skróty klawiszowe

Klawisze okna głównego aplikacji na komputerze. Na Macu obowiązuje ⌘ zamiast Ctrl.

| Klawisz | Co robi | Gdzie i kiedy | Reguła |
|---|---|---|---|
| Esc | zamyka okno dialogowe albo menu na wierzchu | wszędzie | – |
| Alt+← / Alt+→ | poprzednia / następna osoba w centrum | poza Tabelą; w Tabeli skoki po imionach | [A6.7.16](A6-views.md#A6.7.16) |
| Ctrl+F, / | kursor do **Szukaj osoby...** | / tylko poza polem tekstowym | [A4.8](A4-surnames-and-families.md#A4.8) |
| Ctrl+S | **Zapisz do pliku** | nie przy zablokowanym drzewie i w kopii tylko do odczytu | [S8](S8-where-the-data-are.md) |
| Ctrl+Z; Ctrl+Shift+Z albo Ctrl+Y | **Cofnij**; **Ponów** | poza polem tekstowym | – |
| Delete, Backspace | usunąć osobę w centrum (po potwierdzeniu) | Rodzina i Potomkowie, poza polem tekstowym; nie przy zablokowanej osobie i w drzewie tylko do odczytu | – |
| + albo =; −; 0 | przybliżyć; oddalić; domyślne przybliżenie | poza polem tekstowym | – |
| H | ustawić w centrum osobę domyślną | Rodzina, Potomkowie, Wachlarz; poza polem tekstowym i otwartym menu | [A6.1.6](A6-views.md#A6.1.6) |
| ⌘1 (Mac), Ctrl+1 (Windows, Linux) | to samo co H, także z pola tekstowego | tylko gdy przeglądarka przekaże go aplikacji | [A6.1.6](A6-views.md#A6.1.6) |

- **Granice:**
  - przy otwartym oknie dialogowym obowiązują tylko Esc i klawisze tego okna;
  - ⌘1 / Ctrl+1 w karcie przeglądarki zwykle bierze przeglądarka (pierwsza karta);
  - Tabela, okna i okna dialogowe mają też własne klawisze, przy swoich regułach (na przykład
    [A6.7.15](A6-views.md#A6.7.15), [A11](A11-lists-of-people.md)).
- **Obsługa:** klawiatura; aplikacja nie ma przeglądu klawiszy, dymek ⌂ podaje jego klawisz.
- **Obowiązuje od:** aplikacja 3.30.0 (przegląd; każdy skrót obowiązuje od wersji w swojej regule, H i ⌘1 / Ctrl+1 od
  3.30.0)

<!-- zdroj: app:401eaca4 src/ui/misc.ts keydown (Esc a dialogStack; dialog otevřený → return; Alt+←/→ goBack/goForward, v Tabulce ne; Ctrl/⌘+F a „/“ toolbarSearchPicker.focusInput; ⌘S / Ctrl+S saveTreeCopy, ne isViewMode/isLocked; defaultFocusKey H a mod1 + defaultFocusKeyHeld; typing → return; Ctrl/⌘+Z, Shift+Z, Y; Delete/Backspace confirmDelete jen family/descendants, ne isReadOnly, ne isPersonLocked; + = − 0 ZoomPan) · app:b6df0770 spec 111 §6, §8 (přehled v aplikaci ne) -->
