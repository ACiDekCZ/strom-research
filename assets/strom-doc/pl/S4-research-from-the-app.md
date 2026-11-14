<a id="S4"></a>
# S4 Badanie sterowane z aplikacji

Co z badania pokazuje aplikacja i co można z niej uruchomić w badaniu: bieżącą pracę, kolejkę, linie i działania,
które otwierają badanie. Opisuje aplikację Strom 3.21.2 (i badanie 1.25.2). Zmiany z nowszej wersji mają przy sobie jej numer.

<a id="S4.1"></a>
## S4.1 Panel i Przegląd badania pokazują bieżącą pracę

Przy śledzeniu badania ([S1](S1-connecting-app-and-research.md)) aplikacja pokazuje mały panel **Badanie na żywo ze
Strom Research**, a z niego większy **Przegląd badania**. Oba tylko czytają. To, co pokazują, badanie wysyła przez
most.

- **Granice:**
  - Panel: **Trwa praca**, **Czeka na załatwienie**, **Ostatnie zmiany** (5 najnowszych, link **Wszystkie zmiany
    w przeglądzie ›**), **W kolejce** (3 zadania), a pod tym liczba sesji agenta w tym miesiącu.
  - Gdy panel jest wyższy niż okno, zwija się sam najpierw **W kolejce**, potem zmiany, potem **Trwa praca**.
    **Czeka na załatwienie** nigdy nie zwija się sam. Sekcja, którą zwinął lub rozwinął człowiek, zostaje taka, jaka
    jest.
  - Przegląd, sekcje w tej kolejności: podsumowanie (**Stan**, **Ostatnie 24 h**, **Ten miesiąc** z liczbą sesji),
    **Teraz**, **Czeka na załatwienie** (tylko gdy coś czeka), **Linie** ([S4.3](#S4.3)), **Przebieg**, **Kolejka**
    ([S4.2](#S4.2)), **Co wie badanie** ([S3](S3-what-the-research-knows.md)). **Kolejka** i **Co wie badanie** są
    na początku zwinięte.
  - **Przebieg** łączy kroki po 15 minut, pokazuje najwyżej 20 kroków.
  - Przegląd jest na szerokim oknie (od 1280 px) panelem bocznym obok drzewa, na tablecie warstwą nad drzewem, na
    telefonie całym ekranem. Na telefonie panel staje się paskiem, a stuknięcie otwiera przegląd.
  - Bez śledzenia panel pokazuje ostatnie znane **Czeka na załatwienie** ze zdaniem **Stan na …. Badanie teraz nie
    działa.**
- **Obsługa:** aplikacja: panel, przyciski **⤢ Otwórz przegląd** i **Zakończ śledzenie**; menu **Badanie → Przegląd
  badania**.
- **Obowiązuje od:** aplikacja 3.5.0
- **Od aplikacji 3.22.0:** każdą sekcję można rozwinąć, zwinąć lub ukryć, a wybór obowiązuje dla panelu i przeglądu
  ([S4.1.2](#S4.1.2)). **Czeka na załatwienie** nie rozwija się samo nawet przy nowej pozycji.
- **Od aplikacji 3.27.0:** z badaniem 1.31.0 wiersz w **Teraz** pokazuje przy zadaniu, które nie należy do żadnej
  linii, dlaczego się nad nim pracuje: przy zadaniu, które linii tylko pomaga, której i jak („pomaga linii Przodkowie:
  Jan Horák · łączy ludzi z drzewem”; dalej „pytanie linii”, „według agenta”, „małżonek przodka”, „gałąź …”), przy
  zadaniu poza liniami jego gałąź („poza liniami · gałąź Josef Horák”, pod nagłówkiem **Poza liniami** tylko „gałąź
  Josef Horák”). Co pomaga linii, mówi [R2.3](R2-lines-and-queue.md#R2.3). Wiersze **Trwa praca** w małym panelu
  mówią to samo; pod nagłówkiem linii tylko jak, bez jej nazwy.
- **Od aplikacji 3.27.0:** **Przegląd badania** otwiera się także bez śledzenia ([S4.1.5](#S4.1.5)): w menu
  **Badanie** jest zawsze pierwszy, drugie jest **Śledź na żywo**, podczas śledzenia na jego miejscu **Zakończ
  śledzenie**; w Archiwum Strom **Śledź na żywo** nie ma. Z **Przeglądu drzewa** otwiera go **Badanie ›** w nagłówku
  **Na czym się skupić**. Przycisk **⤢ Otwórz przegląd** w małym panelu jest tylko podczas śledzenia.
  - Podsumowanie pokazuje tylko włączone części ([S4.1.2](#S4.1.2)): **Ostatnie 24 h** osoby i źródła, **Ten miesiąc**
    liczbę sesji. Koszt (kwotę i odczyt skanów) pokaże dopiero po włączeniu, inaczej nawet w tekście po najechaniu.
    Pod małym panelem stoi „Agent w tym miesiącu: 4 sesje”, kwota, oba albo nic.
  - W wierszu linii w sekcji **Linie** stoi przy pracy tylko „trwa praca”, gdy sekcja **Teraz** jest widoczna
    (rozwinięta i zwinięta); całe „Teraz: …” jest w tekście po najechaniu. Przy ukrytym **Teraz** wiersz mówi
    „Teraz: …” w całości.
- **Od aplikacji 3.28.0:** na komputerze Przegląd otwiera się także w osobnym oknie ([S4.1.6](#S4.1.6)).
- **Od aplikacji 3.28.0:** mały panel pamięta na tym urządzeniu, czy jest zwinięty: jeden wybór dla wszystkich
  badań, domyślnie rozwinięty. Przejmuje go odświeżenie strony, nowe śledzenie i panel innego badania; zapisuje go
  tylko strzałka panelu. Otwarty Przegląd nie rozwija już panelu za sobą. Telefon wyboru nie czyta ani nie zapisuje
  (pasek otwiera przegląd jak dotąd). Bez pamięci przeglądarki (okno prywatne) obowiązuje do zamknięcia strony.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:223 PANEL_CHANGES, (3.28.0: app 8da3f11e MINI_OPEN_KEY strom-research-mini-open, miniPanelFolded, rememberMiniPanelFolded, ne na telefonu; otevřený Přehled panel nerozbalí), :227 AUTO_FOLD, :3326 appendQueueSection(…, 3), renderLivePanel, renderIdleResearchPanel · src/ui/research-overview-ui.ts:5 (≥1280), :51 FOLDED_BY_DEFAULT, :53 GROUP_MS, :59 MAX_STEPS, :74, :309-311 · strings.ts live.overviewTitle, research.panelLabel, research.stop, research.atWork, research.queue · 3.27.0 Teď: app 4e4f6d8c src/research-link.ts WORKING_HELPS_FEATURE (working.helps), sanitizeWorking (helps jen s linií, branch) · src/ui/research-offline-ui.ts workingWhyText (helps → qWhyHelps + qWhyHow / qWhyHowBranch; větev mimo linie → qWhyOutBranch, ve skupině qWhyHowBranch) · src/ui/research-overview-ui.ts (Teď: důvod místo názvu linie) · strings.ts live.qWhyHelps, qWhyHow.*, qWhyHowBranch, qWhyOutBranch · spec 036 K1.8 · malý panel: app 2c018779 src/ui/research-ui.ts, research-directions-ui.ts (pod nadpisem linie jen jak) · 3.27.0 spec 057: app f05fff8e src/ui/research-actions-ui.ts overviewRows (research-item-overview první; stop při sledování, jinak followLive, ne bez agenta), src/ui/tree-actions.ts researchOverview · 8d564b35 src/ui/tree-overview.ts treeOverviewResearchLinkHtml (live.researchLink v záhlaví focus) · 28bbebeb src/ui/live-section-prefs.ts TOP_DEFAULTS (month.price false), research-overview-ui.ts appendOverviewSummary, strings.ts live.spendSessions, spendAmount · 87a6ea88 live.dirWorkedOn · strings.ts live.openOverview -->

<a id="S4.1.1"></a>
### S4.1.1 Śledź agenta w drzewie

Drzewo może samo przechodzić do osoby, nad którą agent właśnie pracuje (pierwsza niewstrzymana praca w sekcji
**Teraz**).

- **Granice:** najwyżej jedno przejście na 8 s. Gdy drzewo jest oddalone bardziej niż do 0,55, przybliża się do 0,8.
  Przesunięcie drzewa, wybór innej osoby lub inny widok przerywa śledzenie (**Wróć do agenta**); po 20 s bez dotyku
  wraca samo. Wybór zapamiętuje się dla urządzenia.
- **Obsługa:** aplikacja: **Przegląd badania → Śledź agenta w drzewie** / **Przestań śledzić**.
- **Obowiązuje od:** aplikacja 3.5.0
- **Od aplikacji 3.24.0:** śledzić można także w wachlarzu i na mapie ([S4.1.3](#S4.1.3)); przesunięcie mapy wstrzymuje je tak samo.

<!-- zdroj: app:src/ui/live-follow-ui.ts:7, :26 ZOOM_FAR, :27 ZOOM_READABLE, :32 gap 8000 / idle 20_000 · strings.ts live.followOn, live.followOff -->

<a id="S4.1.2"></a>
### S4.1.2 Dostosowanie panelu

Każda sekcja śledzenia badania ma jeden wybór: **Rozwinięta**, **Zwinięta** albo **Ukryta**. Wybór obowiązuje dla
panelu i przeglądu.

- **Granice:**
  - sekcje: **Trwa praca** (w przeglądzie **Teraz**), **Czeka na załatwienie**, **Ostatnie zmiany** (w przeglądzie
    **Przebieg**), **W kolejce** (w przeglądzie **Kolejka**) i tylko w przeglądzie **Linie** oraz **Co wie badanie**;
  - sekcja bez wyboru (**domyślna**) pokazuje się jak wcześniej: panel zwija, co się nie mieści (**zwinięta, brak
    miejsca**), przegląd ma zwinięte sekcje **Kolejka** i **Co wie badanie**. Sekcji z wyborem panel sam nie zwija;
  - kliknięcie nagłówka sekcji to trwały wybór (rozwinąć / zwinąć);
  - wybór zapamiętuje się na tym urządzeniu dla wszystkich drzew, nic się nie synchronizuje. Wcześniejsze ręczne
    zwinięcie sekcji przejmuje się jeden raz;
  - **Przywróć domyślne** usuwa wszystkie wybory. Przywrócenie domyślnych i ukrycie sekcji z jej menu można przez
    chwilę cofnąć (**Cofnij**). Gdy ukryte są wszystkie sekcje, panel mówi **Wszystkie sekcje są ukryte.**
- **Czeka na załatwienie zwinięte lub ukryte:**
  - nowa pozycja sekcji nie rozwija. Nagłówek pokazuje liczbę i **N nowych**; wyróżnione, gdy jest wśród nich
    decyzja lub zgoda (**w tym decyzja lub zgoda**);
  - ukryte zostawia etykietę **Czeka N** w nagłówku panelu, w podsumowaniu zwiniętego panelu, w pasku na telefonie
    i w przeglądzie. Kliknięcie pokazuje sekcję w przeglądzie, dopóki przegląd się nie zamknie (**Ukryta sekcja,
    widoczna do zamknięcia przeglądu.**).
- **Obsługa:** aplikacja: **⋯ → Dostosuj panel…** w nagłówku panelu i przeglądu; prawy przycisk albo długie
  naciśnięcie na nagłówku sekcji (także klawisz Menu lub Shift+F10); **Ustawienia → Śledzenie badania**. Na
  telefonie jako panel wysuwany od dołu.
- **Obowiązuje od:** aplikacja 3.22.0
- **Od aplikacji 3.27.0:** **Dostosuj panel** ma dwie karty, takie same w oknie, w panelu wysuwanym od dołu na
  telefonie (zamyka go **Gotowe**) i w **Ustawienia → Śledzenie badania**:
  - **Sekcje i kolejność:** wszystkie sześć sekcji na jednej liście i w jednej kolejności dla panelu i przeglądu
    (panel pomija **Linie** i **Co wie badanie**). Każdy wiersz ma wybór **Rozwinięta** / **Zwinięta** / **Ukryta**
    (ukryty wiersz „ukryta”). Wiersz przesuwa się strzałkami ↑ ↓ (na skrajach nie działają), Alt+↑ / Alt+↓,
    przeciąganiem za ⠿ (Esc anuluje przeciąganie; na telefonie uchwytu nie ma) albo w menu sekcji **Przesuń w górę**
    / **Przesuń w dół**. Czytnik ekranu powie nowe miejsce („… przeniesiono na pozycję 2 z 6.”). Domyślna kolejność:
    **Trwa praca** (**Teraz**), **Czeka na załatwienie**, **Linie**, **Ostatnie zmiany** (**Przebieg**), **W kolejce**
    (**Kolejka**), **Co wie badanie**. Gdy panel się nie mieści, zwija sekcje od dołu tej kolejności;
  - **Na górze:** **Stan** jest zawsze widoczny („zawsze widoczny”). **Ostatnie 24 h** (części **osoby**,
    **źródła**) i **Ten miesiąc** (części **sesje**, **koszt**) mają każdy przełącznik i swoje części; kafelek
    z obiema wyłączonymi częściami znika. **Koszt** jest domyślnie wyłączony („Koszt widać dopiero po włączeniu.”).
    Na telefonie **Ten miesiąc** jest szary („Na telefonie niewidoczny.”). **Śledzenie w** można ukryć („Tylko
    podczas śledzenia na żywo.”), śledzenie działa wtedy w widoku wybranym wcześniej;
  - stopka: **Przywróć domyślne** przywraca stany sekcji, kolejność i **Na górze** (koszt znów ukryty), bez pytania,
    z powiadomieniem „Przywrócono domyślne” i **Cofnij** przez 8 s; **Wszystkie ustawienia śledzenia ›** otwiera
    Ustawienia. Ukrycie sekcji bezpośrednio w oknie **Dostosuj panel** nie jest ogłaszane, ukrycie z menu sekcji tak
    („Sekcja ukryta”, **Cofnij**);
  - wybory obowiązują na tym urządzeniu dla wszystkich drzew, dla panelu i Przeglądu badania, ze śledzeniem i bez
    niego. Wcześniej zapisane wybory zostają.

<!-- zdroj: app:src/ui/live-section-prefs.ts SECTION_PREFS_KEY, PREF_KEYS, OVERVIEW_KEYS, OLD_PANEL_KEY · src/ui/live-section-edit.ts · src/ui/live-section-edit-ui.ts · src/ui/research-ui.ts:282 waitingHeadInfo, :312 waitingChip, :3180 toggle, :3215 resetLiveSections, :3225 hideLiveSection · src/ui/research-overview-ui.ts:376 shownOnce · strings.ts live.editPanel(Menu), sectionExpanded/Collapsed/Hidden/Default, resetDefaults, autoFoldedNote, allHidden, waitingShort, importantHint, shownOnce, settings groupResearchFollow · commity c4b1dcc, a56232a · spec 044 K1–K5 · 3.27.0: app 28bbebeb src/ui/live-section-prefs.ts DEFAULT_ORDER, TOP_KEYS, TOP_DEFAULTS (záznam v2: pořadí, nahoře; v1 se čte beze změny) · 0b090a80 src/ui/live-section-edit-ui.ts (Sekce a pořadí / Nahoře, ⠿ ne v listu, Alt+↑↓, Escape tažení, Hotovo) · src/ui/research-ui.ts resetLiveSections (RESTORED_TOAST_MS 8000, live.undo), hideLiveSection (hiddenToast, undo.undo) · strings.ts live.groupSections, groupTop, alwaysShown, topDay, partPersons, partSources, topMonth, partSessions, partPrice, priceHelp, monthPhoneNote, topFollowIn, followInHelp, moveUp, moveDown, movedSr, allFollowSettings, settingsNote, restoredToast, hiddenToast, done · spec 057 K1.1–K1.7, K2.1 -->

<a id="S4.1.3"></a>
### S4.1.3 Śledzenie w wachlarzu i na mapie

Śledzenie agenta ([S4.1.1](#S4.1.1)) działa w Rodzinie, w wachlarzu i na mapie. Przełącznik **Śledzenie w** zmienia
widok, a śledzenie zostaje włączone. Wachlarz się przy tym nie porusza, tylko oznacza, gdzie się pracuje; mapa
pokazuje miejsce pracy pierścieniem.

- **Wachlarz:**
  - środkiem wachlarza jest **Osoba w centrum uwagi** sprzed włączenia śledzenia (domyślnie), **Osoba domyślna** albo
    **Wybrana osoba** (dla jednego drzewa). Nigdy nie jest to osoba, nad którą agent pracuje. **Przypiąć jako środek**
    zatrzymuje osobę jako środek, **Odpiąć środek** ją puszcza; nowy środek przenika się w 150 ms;
  - osoba, nad którą się pracuje, ma obrys w kolorze sesji i mignie dwa razy, gdy praca się przesunie i gdy śledzenie
    przejdzie do wachlarza. Wąski wycinek dostaje znacznik poza wachlarzem;
  - osoba poza wachlarzem dostaje etykietę **Praca poza wachlarzem:** przy najbliższej osobie wachlarza, w tej
    kolejności: mąż albo żona, rodzeństwo, przodek za krawędzią wachlarza, przy potomku środek, inaczej pierwszy przodek
    do 12 pokoleń wstecz.
- **Mapa:**
  - miejsce pracy ma pierścień w kolorze sesji: pełny pierścień to **miejsce wpisu** (miejsce źródła, nad którym agent
    pracuje, gdy badanie je wysyła), przerywany to **miejsce osoby** (pierwsze miejsce z położeniem z urodzenia,
    zamieszkania, ślubu, zgonu). Nigdy nie jest to siedziba archiwum;
  - pierścień raz pulsuje, gdy śledzenie przejdzie na mapę. Mapa przesuwa się tylko wtedy, gdy miejsce pierwszej sesji
    jest poza widokiem, a mapa nie jest wstrzymana. Ręczne przesunięcie mapy ją wstrzymuje (**Przesuwanie mapy
    wstrzymane**) do **Powrót do agenta**;
  - miejsce bez położenia pokazuje u góry wiersz „… – bez położenia na mapie” z **Wyszukać położenie** (przy drzewie
    z badaniem **Odszukaj w badaniu**, [A6.5.2](A6-views.md#A6.5.2)); osoba bez miejsca „… – bez miejsca”;
  - legenda **Znaczenie wyróżnień** objaśnia pierścienie, ślad i pusty znacznik.
- **Ślad sesji:** w Rodzinie, wachlarzu i na mapie osoby i miejsca, nad którymi się pracowało, bledną z wiekiem:
  najwyżej ostatnie 8 zmian, żadna starsza niż 60 minut. Na mapie to puste pierścienie, miejsca jednej sesji łączy
  kropkowana linia (nie na telefonie). Ślad można wyłączyć.
- **Granice:**
  - gdy działa kilka sesji, każda ma numer (widoczny od dwóch) i kolor: pierwsza główny, kolejne akcentowy;
  - praca nad ślubem jest śledzona przy parze: w centrum uwagi jest mąż, inaczej żona;
  - ustawienia obowiązują na tym urządzeniu dla wszystkich drzew, wybrana osoba tylko dla swojego drzewa. Na
    telefonie widok jest uproszczony.
- **Obsługa:** aplikacja: przy śledzeniu **Śledzenie w** (Rodzina, Wachlarz, Mapa); **Ustawienia → Śledzenie
  badania** → **Śledzenie agenta w** (używane przy włączeniu śledzenia i przy **Powrót do agenta**), **Środek
  wachlarza przy śledzeniu** (**Wybrać osobę**, **Zmienić**), **Ślad sesji w Rodzinie, wachlarzu i na mapie**;
  w wachlarzu **Przypiąć jako środek** / **Odpiąć środek**.
- **Obowiązuje od:** aplikacja 3.24.0
- **Od aplikacji 3.25.0:** legenda mapy mówi „Pusty znacznik: miejsce bez osoby wśród pokazanych miejsc”, a miejsce
  pracy bez osoby na mapie „na razie bez osoby na mapie” (wcześniej „poza zakresem mapy”).

<!-- zdroj: app:src/ui/live-follow-ui.ts (hlavička, followIn) · src/live-follow-prefs.ts · src/live-follow-targets.ts TRAIL_MAX=8, TRAIL_MAX_AGE_MS=60 min, fanCenter, sessionNumbers, sessionTone · src/live-follow-map.ts · src/fan-follow-anchor.ts MAX_UP=12 · src/ui/fan-follow-ui.ts · src/ui/map-follow-ui.ts PAN_MARGIN=64, PAN_MS=400, telefon bez čáry · strings.ts settings.groupResearchFollow, researchFollowNote, followView(Help), followFanCenter*, followTrail(Help); live.followIn, mapPaused, legendTitle, legendTrail, legendRecord, legendPerson, legendOut; fan.pin, unpin, centerLabel, workOutside; map workRecord, workPerson, outScope, noCoords, noPlace, locate · CHANGELOG.cs.md 3.24.0, 3.25.0 · spec 043 -->

<a id="S4.1.4"></a>
### S4.1.4 Zmiany z badania bez migania

Zmiana z badania pojawia się w drzewie od razu, bez przerysowania całego ekranu. Karty, które zostają, trzymają swoje
miejsce; to, co przybyło, ubyło albo się zmieniło, pokazuje się krótko ruchem.

- **Granice:**
  - zostające karty przesuwają się płynnie (320 ms). Nowa osoba wyrasta ze swojej linii, a wzdłuż linii przebiega
    światło; usunięta cofa się do swojej linii; scalona osoba spływa w tę, która zostaje (po tym samym nazwisku,
    urodzeniu ±1 rok, wspólnym rodzicu albo partnerze); zmieniona karta ma obrys w kolorze sesji;
  - ruchem pokazuje się najwyżej 12 nowych kart; przy ponad 60 zmienionych osobach ruch jest pomijany, a zmiany
    pokazują się od razu. Na telefonie i tablecie czasy są krótsze (×0,875);
  - nowa osoba poza widokiem dostaje znacznik przy krawędzi („Dodano poza widokiem: …”, 4 s). Powiększenie ani osoba
    w centrum uwagi się nie zmieniają. Czytnik ekranu ogłasza zmiany;
  - wyłączony **Ruch przy wczytywaniu zmian** i ograniczenie ruchu w systemie pokazują zmiany od razu, tylko
    wyróżnione („W systemie włączono ograniczenie ruchu, dlatego zmiany pojawiają się bez ruchu.”).
- **Obsługa:** aplikacja: **Ustawienia → Śledzenie badania → Ruch przy wczytywaniu zmian** (domyślnie włączony).
- **Obowiązuje od:** aplikacja 3.24.0

<!-- zdroj: app:src/live-transition.ts LIVE (move 320 ms, maxAnimatedNew=12, maxChangedForScene=60, ×0.875 touch), src/live-diff.ts (merge guess: surname, birth ±1, parent/partner) · strings.ts settings.liveMotion, liveMotionHelp, liveMotionReduced, edgeAdded · CHANGELOG.cs.md 3.24.0 · spec 055 -->

<a id="S4.1.5"></a>
### S4.1.5 Przegląd badania bez śledzenia

**Przegląd badania** można otworzyć przy każdym drzewie z badania także bez śledzenia. Drzewo nie przełącza się przy
tym na wersję badania, nie blokuje się i można je dalej edytować. Co Przegląd pokaże, zależy od tego, czy most
badania odpowiada.

- **Most odpowiada** (badanie na tym komputerze działa): Przegląd pokaże to samo co podczas śledzenia (kafelki
  i wszystkie sekcje) z regularnego zapytania do mostu; pod **Stan** „odświeżono …”. **Czeka na załatwienie** i zarządzanie
  liniami działają przez most. Pod nagłówkiem stoi „Drzewo przełączy się na wersję badania i nie będzie można go
  edytować.” z przyciskiem **Śledź na żywo**. Gdy agent w międzyczasie zacznie pracować, nad tym stoi „Agent zaczął”,
  a przycisk jest wyraźniejszy; samo nic się nie przełącza. W Archiwum Strom tego paska nie ma.
- **Most nie odpowiada:**
  - **Stan** „Badanie nie działa” z **Włącz** (gdzie badania nie da się włączyć z aplikacji, stoi tam, jak je
    uruchomić);
  - **Czeka na załatwienie** tak, jak badanie ostatnio podało je na tym urządzeniu, ze „stan na …”; starsze niż 7 dni się
    nie pokazuje;
  - **Linie** z pliku drzewa: nazwa i liczba osób, nic o pracy nad nimi; **Co wie badanie** i w stopce **Gdzie brakuje
    dowodów: N osób ›**;
  - sekcji **Teraz**, **Przebieg** i **Kolejka** nie ma; jeden wiersz je wymienia, np. „Teraz, Przebieg i Kolejka:
    po włączeniu badania.” (ukryte sekcje pomija; gdy ukryte są wszystkie trzy, wiersza nie ma). Gdy tylko most odpowie,
    Przegląd przerysuje się sam.
- **Telefon** nie pyta mostu: **Stan** „Tylko z drzewa” i „Pracę agenta widać na komputerze z badaniem.” W poziomie
  stan zostaje na górze, a sekcje przewijają się pod nim.
- **Gdzie indziej w aplikacji:** bez śledzenia pracę agenta i kolejkę, gdy most odpowiada, pokazuje też widok Tabela
  ([A6.7.14](A6-views.md#A6.7.14)).
- **Obsługa:** aplikacja: **Badanie → Przegląd badania**; **Przegląd drzewa → Na czym się skupić → Badanie ›** (przy
  drzewie bez osób w nagłówku okna); na telefonie i tablecie w działaniach drzewa, grupa **Badanie**; w Przeglądzie
  **Śledź na żywo**.
- **Obowiązuje od:** aplikacja 3.27.0
- **Od aplikacji 3.28.0:** gdy most odpowiada, **⋯** przy zadaniu w **Kolejce** zmienia jego miejsce jak podczas
  śledzenia: **Zrób jako następne** z **Cofnij** ([S4.2.2](#S4.2.2)), a gdzie badanie je oferuje, **Na koniec**
  i **Przywróć domyślne** ([S4.2](#S4.2)). Tak samo w wynikach wyszukiwania ([S4.2.1](#S4.2.1)) i w osobnym oknie
  Przeglądu ([S4.1.6](#S4.1.6)), gdzie robi to główne okno. Zapisuje to most badania; śledzenie się nie zaczyna,
  drzewo się nie przełącza i można je dalej edytować. Kolejka zaraz potem wczytuje się z badania, bez czekania na
  regularne zapytanie. Bez mostu (Przegląd z drzewa, telefon) nic się nie zmienia.
  Tak samo Przegląd bez śledzenia pyta most o stan zaraz po każdym zapisie przez most: w **Czeka na załatwienie**
  odpowiedź, **Dodaj plik**, **Wysłano** i **Przywróć do załatwienia**, odpowiedź na pytania o miejsca i o rosnącą
  gałąź; w **Linie** założenie, edycja, przeniesienie, wstrzymanie, zakończenie i wznowienie linii; rozstrzygnięcie
  sprzeczności, cofnięcie wartości oraz weryfikacja lub potwierdzenie danej przez most. Okno Przeglądu
  ([S4.1.6](#S4.1.6)) dostaje nowy stan od okna głównego, które robi zapis.
- **Od aplikacji 3.28.0:** Przegląd badania bez śledzenia da się zamknąć przyciskiem ⤡ i ×; panel badania, który był widoczny obok niego,
  po zamknięciu Przeglądu pokaże się znowu. **Zakończ śledzenie** w otwartym Przeglądzie tylko kończy śledzenie,
  a Przegląd zostaje otwarty bez śledzenia; zakończenie, które aplikacja robi sama (na przykład przełączenie do
  archiwum), go zamyka. Przełączenie na inny widok zamyka Przegląd bez śledzenia jak ⤡; Przegląd śledzonego badania
  zostaje.

<!-- zdroj: app:f05fff8e, 48573de6 src/ui/research-overview-ui.ts renderResearchOverview (source live | bridge | tree; fromTree vynechá working, changes, queue), appendOverviewStateOff (notRunning, turnOn / researchLiveStartHow; telefon phoneTreeOnly, phoneWhy), overviewFollowStrip (activeResearchAgentless → bez pruhu; agentStarted, followNote), appendOverviewWaitingAsOf (asOf), appendOverviewSkeletonLines, appendOverviewFoot (missingLink) · src/research-overview-source.ts BRIDGE_ONLY_SECTIONS, afterTurnOnKeys, skeletonLines (_STROM_DIRECTION, místa osob) · src/research-device.ts WAITING_MAX_AGE_MS = 7 dní · src/ui/research-ui.ts OverviewViewing (refreshedAt, agentStarted, waitingAt) · src/ui/tree-actions.ts researchOverview · 8d564b35 src/ui/tree-overview.ts treeOverviewResearchLinkHtml (sekce focus, bez osob v záhlaví) · strings.ts live.followNote, agentStarted, notRunning, turnOn, afterTurnOn, refreshedAgo, asOf, phoneTreeOnly, phoneWhy, researchLink, missingLink, treeOverview focus · CHANGELOG.cs.md 3.27.0 · spec 057 K1.8–K1.12 · 3.28.0: app:bb6c0d07 src/ui/research-ui.ts researchSession (sledovaný, jinak prohlížený přes most), openLiveTaskMenu, researchStatusAfterWrite / statusAfterWriteWay (bez sledování hned askResearchBridge, jen počítač), src/ui/research-offline-ui.ts taskMenuOrders (queue.next; queue.own last, default), changeTaskOrder, writeTaskOrder · CHANGELOG.cs.md 3.28.0 (c04a7199) · spec 052 K5.1, K5.6; spec 057 §7 · prace/1113-app-jako-dalsi-bez-sledovani · app:3c751bea src/ui/research-ui.ts researchStatusAfterWrite (Čeká: sent, unsent, odpověď, soubor; linie; větev), researchViewedStatusAfterWrite, viewedWriteSession (jen prohlížený přes most, ne sledovaný, ne ze stromu) · research-waiting-write-ui.ts, research-directions-ui.ts, direction-form-ui.ts, research-offline-ui.ts, research-sync-ui.ts, verify-ui.ts, waiting-places-ui.ts · e2e/overview-write-unfollowed.spec.ts (do 3 s, okno bez dotazu na most) · strings.ts live.waitingWrite.sent, unsent, file · spec 083 · prace/1113-app-hledani-v-prehledu bod 2 · od 3.28.0 zavření a Ukončit sledování: app commit 3f2e19f8 (panel výzkumu skrytý pod Přehledem bez sledování, Ukončit sledování nechá Přehled otevřený, jiný pohled ho zavře) -->

<a id="S4.1.6"></a>
### S4.1.6 Przegląd badania w osobnym oknie

Na komputerze **Przegląd badania** można otworzyć w osobnym oknie, na przykład na drugim monitorze. Okno tylko
pokazuje: stan badania wysyła mu okno główne, a to, co zrobi się w oknie, wykonuje okno główne. Z mostem badania
okno nie rozmawia.

- **Gdzie to działa:** przy drzewie z badania, ze śledzeniem i bez niego ([S4.1.5](#S4.1.5)), na tych samych
  warunkach co widok w oknie ([A6.8](A6-views.md#A6.8)): komputer, okno szersze niż 640 px.
- **Układ:** podsumowanie na całą szerokość, pod nim sekcje w kolumnach według szerokości okna:
  - poniżej 1100 px jedna kolumna jak Przegląd w oknie głównym, od 1100 px dwie, od 1600 px trzy. Do mniejszej liczby
    kolumn okno wraca dopiero 24 px poniżej progu, żeby przeciąganie krawędzi nie migało;
  - kolumna ma najwyżej 660 px szerokości, kolumny stoją pośrodku i każda przewija się sama;
  - sekcje idą w kolejności Przeglądu (**Dostosuj panel**, [S4.1.2](#S4.1.2)) i dzielą się na kolumny po kolei tak,
    żeby najwyższa kolumna była jak najniższa. Trzy kolumny, z których jedna miałaby mniej niż jedną piątą wysokości,
    to dwie;
  - podział zmienia się przy zmianie liczby kolumn, przy zwinięciu, rozwinięciu, ukryciu lub przeniesieniu sekcji
    i po **Wczytaj więcej** w **Kolejce**; nowe dane z badania ani pisanie go nie zmieniają;
  - długa sekcja (z polem wyszukiwania albo z więcej niż 8 wierszami) ma w kolumnie przyklejoną głowę: nagłówek, pole
    wyszukiwania, chipy i liczba znalezionych zostają na górze, wiersze przewijają się pod nimi;
  - przy zmianie szerokości przez próg zostaje rozpoczęte wyszukiwanie, kursor i sekcja, która była na widoku;
  - ustawienia sekcji ([S4.1.2](#S4.1.2)) obowiązują także w oknie.
- **Nagłówek okna:** „{drzewo} · Przegląd badania”, pod nim nazwa badania, po prawej zależnie od stanu **Śledź na
  żywo** albo zakończenie śledzenia, i ⋯. Bez ⤡, × i **Śledzenie w**.
- **Akcje:** pokazanie osoby w drzewie, odpowiedź w **Czeka na załatwienie**, zarządzanie liniami, miejsce zadania
  w kolejce, wyszukiwanie w **Kolejce** ([S4.2.1](#S4.2.1)), **Śledź na żywo** i jego zakończenie, **Włącz**,
  a w sekcji **Weryfikacja** **Zatrzymaj** i **Zweryfikuj dane w drzewie…**
  ([S7.5](S7-reliability-and-verification.md#S7.5)) wykonuje okno główne. Wyszukiwanie i strony kolejki czyta okno
  główne ze swojego mostu i wynik wysyła oknu. Po akcji, której wynik widać w oknie głównym (na przykład pokazanie
  w drzewie albo okno dialogowe **Zweryfikuj dane w drzewie**, które otwiera się w oknie głównym), okno prosi
  o przeniesienie okna głównego na wierzch; po **Zatrzymaj** nie. Wyszukiwanie w **Czeka na załatwienie** i **Co wie badanie**
  ([S4.4.2](#S4.4.2), [S3.7.1](S3-what-the-research-knows.md#S3.7.1)) okno filtruje samo.
- **Wyróżnienie:** to, co drzewo w oknie głównym właśnie wyróżnia, okno pokazuje podświetleniem przycisku tej grupy:
  **Pokaż w drzewie** przy linii w **Teraz** i w **Linie**, liczba znalezionych osób linii i **Pokaż zmienione
  w drzewie** w **Przebiegu**. Po zakończeniu wyróżnienia lub zamknięciu okna głównego nic nie jest podświetlone. Gdy
  filtr **Przebiegu** ponownie wyróżni zmienione osoby, okno główne nie przechodzi na wierzch; filtr bez osób kończy
  wyróżnienie w oknie głównym.
- **Stany okna:**

| Stan | Co okno pokazuje |
|---|---|
| śledzone na żywo | to samo co Przegląd podczas śledzenia |
| nieśledzone, most odpowiada | to samo co Przegląd bez śledzenia ([S4.1.5](#S4.1.5)) z paskiem **Śledź na żywo** |
| badanie nie działa | „Badanie nie działa · widać to, co jest w drzewie” z **Włącz**; **Czeka na załatwienie** z pamięci ze „stan na …” |
| okno główne przełączyło się na drzewo bez badania | „To drzewo nie ma badania”, „Okno główne przełączyło się na drzewo {drzewo}, które nie ma badania.” i **Zamknij okno**; po powrocie do drzewa z badaniem okno wraca samo |
| okno główne jest zamknięte | pasek „Okno główne jest zamknięte · stan z {czas}, tylko do odczytu”, ostatni stan, akcje wyszarzone; **Otwórz Strom** ([A6.8.2](A6-views.md#A6.8.2)) |
| drzewo usunięte albo zablokowane | jak widok w oknie ([A6.8.2](A6-views.md#A6.8.2)) |

- **Granice:** dopóki okno Przeglądu jest otwarte, okno główne własnego Przeglądu nie rysuje; otwarty zamyka się
  po otwarciu okna. Mały panel badania zostaje. **⤢ Otwórz przegląd**, **Badanie → Przegląd badania** i pozycja
  w menu ⧉ wtedy tylko przenoszą okno Przeglądu na wierzch („Przegląd badania jest w osobnym oknie · kliknięcie
  przeniesie je na wierzch”). Po zamknięciu okna wszystko jest jak wcześniej.
- **Obsługa:** aplikacja: ⧉ w nagłówku Przeglądu (między ⋯ a ⤡); ⧉ **Otwórz w nowym oknie** obok przełącznika
  widoków → **Przegląd badania**.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:4b1373a7 src/windows/overview-window.ts (research-state bez adresy a tokenu mostu, OVERVIEW_ACTION_IDS, OVERVIEW_ACTIONS_TO_MAIN, 6g) · src/windows/overview-main.ts · src/ui/research-overview-ui.ts OVERVIEW_WINDOW_COLS_MIN 1100, WINDOW_LEFT (working, waiting, directions), overviewMode 'window', overviewWindowButton (jen canOpenWindows, ne sheet), canOpenResearchOverview · index.html html.window-overview (bez ⤡, ×, ⧉, Follow in) · src/windows/window-controls.ts renderMenu (overview: focusOverviewWindow / openInNewWindow) · strings.ts win.overviewHead, overviewOffNote, noResearch, noResearchNote, overviewInWindow, mainClosed · CHANGELOG.cs.md 3.28.0 · spec 079 P3 (K3), ZADANI_DEV §6 · prace/1113-app-okna-prehled (8a7575f0..4387a662) · app:3c2fde77 src/ui/overview-window-view.ts readQueuePage přes akci queue-list do hlavního okna (okno most nevolá) · app:3f9a5ca4 overview-window-view.ts treeVerifyNow (extras.verify), verifyStop → verify-stop, showVerifyBulkDialog → verify-bulk; evidenceHighlightNow (extras.highlight), endEvidenceHighlight → highlight-end, startPersonHighlight quiet · src/ui/research-ui.ts lightsGroup, markOverviewLit (is-lit, aria-current; nic při zavřeném hlavním okně) · research-overview-ui.ts lightsGroup direction (show-in-tree v Teď), changed (showChanged) · research-directions-ui.ts lightsGroup direction (dirShow), direction-found (dirFoundPersons) · strings.ts verify.section, bulkRow, stop, live.showInTree, dirShow, showChanged · spec 079 K3 · prace/1113-app-dorovnani-052-okna (2876d570..27f0bafb) · app:7f307c74 src/overview-columns.ts OVERVIEW_WINDOW_COLS_2 1100, OVERVIEW_WINDOW_COLS_3 1600, OVERVIEW_COLS_HYSTERESIS 24, OVERVIEW_SMALL_COLUMN 0.2, OVERVIEW_COLUMN_MAX 660, partitionContiguous, planOverviewColumns · src/ui/overview-columns-ui.ts (souhrn a pruhy nad sloupci, každý sloupec se posouvá sám, nové rozdělení jen při změně sloupců, sbalení, skrytí, přesunu, Načíst další; lepkavá hlava: pole nebo > 8 řádků; fokus, výběr v poli a oddíl na očích při změně šířky) · e2e/windows-overview-columns.spec.ts · CHANGELOG.cs.md 3.28.0 (e540e4b5) · spec 083 U3 · prace/1113-app-hledani-v-prehledu -->

<a id="S4.2"></a>
## S4.2 Kolejka w aplikacji

Aplikacja pokazuje początek kolejki badania w kolejności, w jakiej bierze ją agent
([R2.2](R2-lines-and-queue.md#R2.2)). Cała kolejka zostaje w badaniu.

- **Granice:**
  - Panel pokazuje 3 zadania (**W kolejce**), przegląd 20 (**Kolejka**). Resztę pokazuje wiersz **i N kolejnych
    w badaniu**, który otwiera badanie.
  - Przy dwóch i więcej działających liniach zadania można filtrować według linii (**Kolejka według linii**).
  - Zadanie poza liniami ma uwagę: **Czeka do zakończenia pracy linii · nie pomaga żadnej linii**, **Niepodejmowane
    · praca poza liniami jest wyłączona** albo dlaczego pomaga linii (**Pomaga linii: pytanie linii**, **Pomaga
    linii: łączy ludzi z drzewem**, **Pomaga linii, według agenta**). Zasady są w
    [R2.3](R2-lines-and-queue.md#R2.3).
  - Menu zadania **Opcje zadania**: **Odłóż** i **Porzuć**; przy odłożonym zadaniu **Przywróć**. Każda z nich otwiera
    terminal badania i tam się potwierdza ([S4.5](#S4.5)).
- **Obsługa:** aplikacja: panel, sekcja **W kolejce**; **Przegląd badania**, sekcja **Kolejka**; przy zadaniu **⋯**.
- **Obowiązuje od:** aplikacja 3.5.0. Uwagi przy zadaniach poza liniami od 3.21.0 (badanie 1.25.0).
- **Od aplikacji 3.22.0:** z badaniem 1.26.0 każde zadanie ma wiersz, dlaczego stoi tam, gdzie stoi
  ([R2.4](R2-lines-and-queue.md#R2.4)).
  **Zrób jako następne** i **Na koniec** (oraz **Przywróć domyślne**) zmieniają miejsce zadania bezpośrednio
  z aplikacji, bez terminala ([R2.3.1](R2-lines-and-queue.md#R2.3.1)); przy zadaniu, nad którym pracuje agent, nie
  da się tego zrobić. Kolejkę czyta się stronami: **Wczytaj więcej** dodaje 50 zadań, lista trzyma najwyżej 300,
  resztę zawęża filtr linii lub gałęzi.
  Etykieta gałęzi (**Gałąź … K**) zawęża całą kolejkę do zadań gałęzi; **Pokaż całą kolejkę** ją usuwa.
- **Od aplikacji 3.27.0:** z badaniem 1.31.0 kolejka w aplikacji jest w tej samej kolejności, w jakiej zadania bierze
  `strom run` i jak pokazuje je menu badania przed nim ([R2.2](R2-lines-and-queue.md#R2.2)): przy kolei opowieści na
  górze jest jedna opowieść, a w kolejce są też zadania historii. Zadanie ma za tekstem cichą etykietę **opowieść**
  albo **historia** (w **W kolejce**, w **Kolejce**, przy odłożonych zadaniach i w zadaniach gałęzi); zadanie bez niej
  wygląda jak wcześniej. Bez śledzenia kolejkę pokazuje Przegląd ([S4.1.5](#S4.1.5)) i Tabela, gdy most odpowiada.
- **Od aplikacji 3.28.0:** z badaniem 1.32.0 w **Kolejce** można szukać ([S4.2.1](#S4.2.1)), dać zadanie jako
  następne i cofnąć to ([S4.2.2](#S4.2.2)) oraz poprosić o pracę agenta nad kolejką ([S4.2.3](#S4.2.3)). Rozwinięta
  **Kolejka** ma wtedy liczbę zadań w nagłówku („Kolejka · 1240”) zamiast po prawej. Ze starszym badaniem Kolejka
  jest jak wcześniej.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:308 queueNoteText, :3373 appendQueueSection · research-overview-ui.ts:311 (20) · strings.ts research.queue, research.park/drop/wake, research.queueMore, research.queueOffLast, research.queueOffNever, research.queueHelps · HEAD src/research-queue-pages.ts:19 QUEUE_PAGE, :28 QUEUE_ROWS_CAP · src/ui/research-ui.ts:3884 taskDoNext/taskDoLast · strings.ts live.taskDoing, live.queueLoadMore, live.queueCapNote, live.branchQueueChip, live.branchQueueChipClear · 3.27.0: app 2ee3718d (queue[].kind ze /status i ze stránek fronty, jiná hodnota zahozena) strings.ts live.queueKind · research 5f48cdaf src/core/queue.ts RUN_TURNS, runOrder (most /status queue[], GET /queue, menu před strom run), kind story|history · 3.28.0: app 4ad34832 src/ui/research-ui.ts appendQueueSection (counted: queueTitleCount místo summary, když je pole nebo akce záhlaví) · spec 052 -->

<a id="S4.2.1"></a>
### S4.2.1 Wyszukiwanie w kolejce

W **Kolejce** w **Przeglądzie badania** (także w jego osobnym oknie, [S4.1.6](#S4.1.6)) jest pole **Szukaj zadania, osoby, archiwum…**. Szuka badanie w całej
kolejce, także poza wczytanymi stronami; aplikacja wysyła mu tylko szukany tekst ([R2.2](R2-lines-and-queue.md#R2.2)).

- **Kiedy pole jest:** w rozwiniętej **Kolejce**, z badaniem, którego most umie szukać i odpowiada, i tylko gdy
  w kolejce jest co najmniej jedno zadanie (także odłożone). Ze starszym badaniem pola nie ma, a Kolejka jest jak
  wcześniej.
- **Co się znajduje:**
  - numer zadania (`T0815`, `t815`, `815`): to zadanie jako pierwsze, potem zadania, w których tekście jest ten numer;
  - numer osoby (`P12`): zadania dotyczące tej osoby;
  - inny tekst: zadania, które mają każde słowo w tekście zadania, w imionach i nazwiskach jego osób, w księdze,
    sygnaturze, archiwum lub miejscu albo w numerze zadania lub osoby; bez względu na wielkość liter i znaki
    diakrytyczne. Wyniki są w kolejności kolejki.
- **Granice:**
  - szuka się 300 ms po ostatnim wpisanym znaku, wysyła się najwyżej 100 znaków; puste pole przywraca kolejkę;
  - etykiety linii i gałęzi ([S4.2](#S4.2)) łączą się z wyszukiwaniem: wynikiem są zadania etykiety, które pasują do
    tekstu. Liczby w etykietach pozostają liczbami kolejki;
  - wiersz wyniku to wiersz kolejki (miejsce w kolejce, tekst, **⋯**) z szarym numerem zadania. Wyróżnione jest tylko
    dopasowanie numeru zadania lub osoby („P0108 Jan Horák”), dopasowanie tekstu nie. Odłożone zadania są na końcu
    z miejscem „–” i etykietą **odłożone**;
  - nad wynikami stoi ich liczba („Znaleziono 12 zadań”). Bez wyniku **Nic nie znaleziono.** i **Wyczyść
    wyszukiwanie**, z etykietą linii także **Szukaj we wszystkich liniach**;
  - numer zadania, którego już nie ma w kolejce: „T0815 nie ma już w kolejce (gotowe).”, stan **gotowe**, **czeka na
    decyzję**, **odłożone** albo **porzucone**;
  - więcej niż 50 wyników: **Wczytaj więcej** po 50, najwyżej 300 wierszy jak w kolejce;
  - most nie odpowiada albo jest zajęty: **Wyszukiwanie nie powiodło się, badanie nie odpowiada.** albo **Badanie jest
    zajęte, wyszukiwanie jest teraz niedostępne.** i **Spróbuj ponownie**; tekst w polu zostaje;
  - gdy kolejka zmieni się w trakcie wyszukiwania, wynik odświeża się sam; tekst i kursor w polu zostają;
  - wyszukiwanie obowiązuje, dopóki się go nie wyczyści (×, Escape w polu, **Wyczyść wyszukiwanie**) albo dopóki nie
    zamknie się Przeglądu. Szukany tekst nie jest nigdzie zapisywany.
- **Obsługa:** aplikacja: **Przegląd badania → Kolejka**, pole wyszukiwania; w małym panelu pod **W kolejce** link
  **Szukaj w kolejce…**: otwiera Przegląd, rozwija **Kolejkę** tylko do jego zamknięcia (zapisany wybór sekcji się nie
  zmienia) i ustawia kursor w polu. Na telefonie, gdzie panel staje się paskiem, linku nie ma.
- **Obowiązuje od:** aplikacja 3.28.0 (badanie 1.32.0)

<!-- zdroj: app:4ad34832 (8a10387e) src/ui/queue-search-ui.ts QUEUE_SEARCH_PAUSE_MS 300, queueSearchOffered (queue.search, queuePaged, queue/queueMore/queueCounts next+parked), resetQueueSearch (zavření Přehledu), Escape · src/research-queue-pages.ts QUEUE_QUERY_MAX 100, QUEUE_PAGE 50, QUEUE_ROWS_CAP 300, QUEUE_ELSEWHERE_STATES · src/ui/research-ui.ts appendQueueSection (searchable jen v Přehledu, ne při sbalení), appendQueueSearchResult (štítek + q, queueSearchBusy/Err, dirRetry), řádek výsledku (live-queue-num „–“, research-queue__match id/person, queueTagDeferred), live-queue-search-link (canExpandLivePanel) · src/ui/research-overview-ui.ts openQueueSearch (unfoldOverviewSection queue do zavření) · strings.ts live.queueSearch*, queueState, queueTagDeferred, queueTitleCount, dirRetry · research 1.32.0 src/core/live.ts searchQueue (TASK_NUMBER, PERSON_NUMBER, každé slovo v jednom poli, pořadí fronty, elsewhere) · spec 052 K1.1–K1.7 · ZADANI_DEV_fronta-hledani §1, §2; D1 (bez řádku pole) · app:08268b9f strings.ts live.queueSearchInDir, queueSearchNoneDir, queueSearchAllDirs (linie) · app:3c2fde77 okno Přehledu (queue-list) · spec 052 K1.1 -->

<a id="S4.2.2"></a>
### S4.2.2 Zrób jako następne i Cofnij

Zadanie można z aplikacji wysłać na kolej jako następne, bez terminala. Rozpoczętej pracy agent nie przerywa: zadanie
przychodzi na kolej po niej ([R2.3.1](R2-lines-and-queue.md#R2.3.1)).

- **Granice:**
  - **Zrób jako następne** („Przyjdzie kolej po zadaniu w toku”) to pierwsza pozycja w **⋯** przy zadaniu w **Kolejce**,
    w wynikach wyszukiwania ([S4.2.1](#S4.2.1)) i w **W kolejce** małego panelu, bez oznaczenia. Stoi w miejscu
    dotychczasowego **Zrób jako następne** (wybór **od razu**); **Na koniec** i **Przywróć domyślne** zostają przy
    badaniu, które je oferuje ([S4.2](#S4.2));
  - nie jest oferowane przy zadaniu, które już jest pierwsze, nad którym pracuje agent albo które jest odłożone;
  - działa ze śledzeniem i bez niego: w **Przeglądzie badania** otwartym bez śledzenia ([S4.1.5](#S4.1.5)), gdy most
    badania odpowiada; śledzenie się nie zaczyna, a drzewo pozostaje edytowalne. Po zmianie kolejka od razu
    wczytuje się z badania;
  - zadanie przesuwa się na pierwsze miejsce, jego wiersz krótko się wyróżni i przy tekście ma etykietę **jako
    następne**, dopóki nie przyjdzie jego kolej. Z kilku zadań jako następne pierwsze jest ostatnio oznaczone; etykietę
    mają wszystkie. Wyszukiwanie zostaje;
  - powiadomienie z numerem zadania („T0103 jako następne”) i **Cofnij** stoi 6 s. **Cofnij** stawia zadanie
    dokładnie na pierwotne miejsce, także z jego pierwotnym wyborem; wiersz jest na tym miejscu zaraz po odpowiedzi
    badania, także w osobnym oknie przeglądu ([S4.1.6](#S4.1.6));
  - gdy agent tymczasem wziął zadanie: **Agent właśnie pracuje nad tym zadaniem; jego miejsca nie można teraz
    zmienić.** i kolejka się odświeża. Gdy most nie odpowiada: **Badanie nie odpowiada, kolejność się nie zmieniła.**
    i **Spróbuj ponownie**;
  - nic się nie potwierdza: nic się nie uruchamia ani nie płaci;
  - na telefonie menu jest panelem wysuwanym od dołu jak inne panele aplikacji (uchwyt, przyciemnione okno pod nim)
    z numerem i tekstem zadania na górze; stuknięcie w przyciemnione okno lub Escape go zamyka.
- **Obsługa:** aplikacja: przy zadaniu **⋯ → Zrób jako następne**, w powiadomieniu **Cofnij**. Terminal: `strom task
  order T… --next`, `--restore` ([R2.3.1](R2-lines-and-queue.md#R2.3.1)).
- **Obowiązuje od:** aplikacja 3.28.0 (badanie 1.32.0)

<!-- zdroj: app:623d9c77 (8a10387e) src/ui/research-offline-ui.ts queueNextOffered (queue.next, most odpovídá), queueNextFor (state next, ne pozice 1, ne práce agenta), doTaskNext (toast queueMoved 6000 ms, queueUndo → restoreTaskPlace {do: restore, was}), taskOrderRefusedToast (taken → taskDoing, bridge → queueBridgeErr + dirRetry), QUEUE_FLASH_MS 1600 · src/ui/research-ui.ts openLiveTaskMenu (nextOn: queueNext místo taskDoNext; taskOrderOffered: last, default; list na telefonu ≤ 640 px s titulem), markQueueNextRow (queueTagNext) · strings.ts live.queueNext, queueNextHint, queueTagNext, queueMoved, queueUndo, queueBridgeErr, taskDoing · research 1.32.0 rankTasks (naposledy zvolený první) · spec 052 K5.1, K5.3, K5.4, K5.6 · ZADANI_DEV_fronta-hledani §4 · app:2876d570 placeQueueItemInLists (odpověď restore: pos, own, why), strings.ts live.queueMoved(id) · app:7dc924ee list ⋯ = bottom-sheet (úchyt, ztmavení, Escape) · app:3f9a5ca4 Vrátit v okně Přehledu · spec 052 K5.4 · app:bb6c0d07 bez sledování přes most (researchSession, taskMenuOrders, researchStatusAfterWrite) · spec 057 §7 -->

<a id="S4.2.3"></a>
### S4.2.3 Praca nad kolejką…

Z aplikacji można poprosić o samodzielną pracę agenta nad kolejką. Aplikacja niczego nie uruchamia: otwiera terminal
badania, ten pokazuje, co się uruchomi, i uruchamia to dopiero po **tak** ([R7.1.2](R7-when-the-agent-works.md#R7.1.2)).
Praca agenta zużywa subskrypcję AI.

- **Kiedy jest oferowana:** z mostem, który odpowiada, przy badaniu, które zgłosiło link do pracy, z agentem (nie
  w Archiwum Strom ani w badaniu, które czeka na agenta), tylko tam, gdzie aplikacja otwiera linki badania
  ([S4.5](#S4.5)); nie na telefonie. Gdy agent pracuje albo trwa przebieg, działania nie ma; w nagłówku **Kolejki**
  jest zamiast niego **● Trwa praca ›**, które rozwija **Teraz** i przechodzi do **Dokończ i zakończ**.
- **Okno Praca nad kolejką:**
  - **Automatycznie** (domyślnie): „Agent bierze zadanie za zadaniem, dopóki pozwala limit subskrypcji.” Gdy badanie
    zgłasza, że bramka subskrypcji (warunek, [R7.4](R7-when-the-agent-works.md#R7.4)) nie jest ustawiona, stoi pod tym
    **Praca automatyczna wymaga ustawionej bramki subskrypcji; terminal zaproponuje ustawienie.** Wybór zostaje;
  - **Tylko 5 zadań**: liczba 1–100, domyślnie 5. Praca kończy się po tylu załatwionych zadaniach; liczy się też
    zadanie, które kończy się czekaniem, odłożeniem lub porzuceniem. Tylko z badaniem, które to umie; w przeciwnym
    razie jest tylko **Automatycznie**;
  - **Jako pierwsze**: zadanie oznaczone jako następne ([S4.2.2](#S4.2.2)), w przeciwnym razie pierwsze zadanie
    kolejki;
  - gdy badanie to zgłasza, długość sesji i bramka („Sesja najwyżej 3 godz. · bramka subskrypcji: …”);
  - **Anuluj** i **Otwórz terminal** (oznaczenie AI i terminal) ze zdaniem **Uruchomienie potwierdza terminal badania.
    Pracę zatrzymuje Ctrl-C w jego oknie lub „Dokończ i zakończ” w sekcji Teraz.**
- **Obsługa:** aplikacja: **Praca nad kolejką…** po prawej w nagłówku rozwiniętej **Kolejki** w **Przeglądzie
  badania**; menu **Badanie → Praca nad kolejką…** ([S4.5.2](#S4.5.2)). Terminal: `strom run --tasks N`,
  `strom run --loop` ([R7.1](R7-when-the-agent-works.md#R7.1)).
- **Obowiązuje od:** aplikacja 3.28.0 (badanie 1.32.0)

<!-- zdroj: app:9cf43b22, 34accb13 (8a10387e) src/ui/queue-work-dialog.ts queueWorkOffer (live, ne phone/sheet, ne noAgent, linkAvailable work, work.link; busy sessions|runs → 'busy'), queueWorkHead (queue-work-busy → showOverviewNowFinish), queueWorkCounted (run.tasks), queueWorkFirst (own next, pos 1), queueWorkSessionLine, WORK_TASKS_DEFAULT 5, noGate (work.gate === null) · src/research-link.ts WORK_TASKS_MIN/MAX, WORK_LINK_FEATURE, RUN_TASKS_FEATURE · src/ui/research-ui.ts queueHeadAction (jen rozbalená Fronta) · src/ui/research-overview-ui.ts showOverviewNowFinish · strings.ts live.queueWork*, queueWorkingLink · spec 052 K6.1, K6.2, K6.4, K6.6 · ZADANI_DEV_fronta-hledani §5; D6 (řádek sezení i bez brány) -->

<a id="S4.3"></a>
## S4.3 Linie w aplikacji

Przegląd pokazuje linie badania ([R2.1](R2-lines-and-queue.md#R2.1)): co na którą czeka i dokąd doszła. W aplikacji
3.21.2 linie tylko się czyta; każdą zmianę potwierdza się w terminalu badania.

- **Granice:**
  - Sekcja **Linie · aktywne: N** jest tylko przy dwóch i więcej liniach albo przy jednej linii, gdy działa też
    praca poza nią (wiersz **Poza liniami**). Wstrzymane i zakończone linie są zwinięte pod **Wstrzymane
    i zakończone · N**.
  - Wiersz linii: rodzaj (↑ przodkowie, ↓ potomkowie, ⌕ pytanie), nazwa, osoba, liczba zadań i co czeka na załatwienie.
    Linia bez pracy ma **Nic nie czeka, można ją zakończyć.**
  - Szczegóły linii: znani przodkowie według pokoleń, kiedy ostatnio nad nią pracowano, **Pracuj nad tą linią**
    (rozmowa z agentem, nie w Archiwum Strom) i **Pokaż w drzewie**.
  - Menu **Akcje linii**: **Wstrzymaj**, **Zakończ**, **Uruchom ponownie**. Każde otwiera terminal, który mówi, co
    się stanie, i pyta o powód ([R2.1.2](R2-lines-and-queue.md#R2.1.2)).
  - Na telefonie menu brakuje: **Nic nie czeka · zakończyć można w badaniu na komputerze**.
  - Przy dwóch i więcej liniach panel dzieli pracę według linii i można wybrać jedną linię; według niej filtruje się
    kolejka.
- **Obsługa:** aplikacja: **Przegląd badania → Linie**, przy linii **⋯**.
- **Obowiązuje od:** aplikacja 3.5.0 (badanie 1.8.0). Podział panelu według linii od 3.13.1.
- **Od aplikacji 3.22.0:** z badaniem 1.26.0 linie zmienia się bezpośrednio w aplikacji ([S4.3.1](#S4.3.1)). Wiersz
  linii pokazuje, nad czym teraz trwa praca (**Teraz: …**), i granice (**do N pokoleń**, **przed …** (rok); przy
  linii wstrzymanej nie). Szczegóły linii mówią, co linia znalazła w ostatnich dniach (**Ostatnie N dni:** sesje,
  osoby, źródła); osoby pokazują w drzewie. Zakończone linie są zwinięte na końcu (**Zakończone · N**). W wąskim
  oknie i na telefonie przegląd jest panelem wysuwanym: zamiast uchwytu kolejności strzałki ▲▼.

<!-- zdroj: app:v3.21.2 src/ui/research-directions-ui.ts:156 linesMulti, :350-353 appendOverviewDirections, :385 canDo, :528 dirWork · strings.ts live.dirTitle, live.dirOutside, live.dirInactive, live.dirWork · research:v1.25.2 assets/lang/cs.json ui.link.what.direction.pause/done/resume · 3.22.0: research-directions-ui.ts:703 dirEnded, :852 dirNow, :878 dirFoundIn, :720 sheet; strings.ts live.dirLimitGen, dirLimitBefore, dirFound* -->

<a id="S4.3.1"></a>
### S4.3.1 Zarządzanie liniami z aplikacji

Z badaniem, które to potrafi, aplikacja zapisuje zmiany linii bezpośrednio przez most. Terminal się nie otwiera i za
nic się nie płaci.

- **Granice:**
  - **+ Nowa linia** (formularz **Nowa linia**: **Rodzaj** Przodkowie / Potomkowie / Pytanie, **Osoba**,
    **Pytanie**, **Nazwa**, **Ogranicz…**). Założenie nic nie kosztuje, a agent zaczyna pracę nad linią przy
    następnym uruchomieniu. Nowa linia idzie na koniec kolejności.
  - **Edytuj**: rodzaju i osoby zmienić nie można (inna osoba = nowa linia). Edycja obowiązuje od następnego wyboru
    zadania.
  - Kolejność linii: przeciąganiem, strzałkami lub **Przenieś na początek**. Pod listą jest napisane, jak badanie
    traktuje kolejność: **Badanie poświęca najwięcej czasu liniom na górze, pozostałe nie stoją.** albo **Badanie
    bierze linie po kolei.**
  - **Wstrzymaj** i **Uruchom ponownie** można cofnąć (**Cofnij**). **Zakończ…** pyta i przyjmuje nieobowiązkowy
    powód.
  - Gdy taka sama linia już jest, formularz to mówi (**Linia … już działa.**) i proponuje **Pokaż ją** albo
    **Załóż mimo to**.
  - **Szukaj przodków** i **Szukaj potomków** przy osobie otwierają ten formularz.
  - Tylko do odczytu: w Archiwum Strom (**Archiwum: linie tylko do odczytu.**), na telefonie (**Linie można zmieniać
    w Stromie na komputerze, na którym działa badanie.**) i gdy badanie nie działa (**Badanie nie działa. Linie
    będzie można zmienić, gdy zacznie działać.**).
  - Badanie starsze niż 1.26.0: działania zostają w terminalu (**Badanie zarządza liniami z aplikacji od wersji
    1.26.0.**).
  - Gdy badanie odrzuci zapis (na przykład jest zajęte), aplikacja nic nie zmienia i proponuje **Spróbuj ponownie**.
- **Obsługa:** aplikacja: **Przegląd badania → Linie**, **+ Nowa linia**, przy linii **⋯**; menu osoby
  **Badanie ›**.
- **Obowiązuje od:** aplikacja 3.22.0 (badanie 1.26.0)

<!-- zdroj: app:HEAD src/ui/research-directions-ui.ts:372 DIRECTIONS_WRITE_SINCE, :628 · src/research-directions-write.ts createDirection, editDirection, setDirectionState, writeDirectionOrder · src/ui/research-actions-ui.ts:1015-1024, :1067 openDirectionForm · strings.ts live.dirNew, dirFormNew, dirFree, dirEditFree, dirLocked, dirOrderWeight, dirOrderStrict, dirArchive, dirPhoneOnly, dirBridgeDown, dirOldResearch, dirBusy, dirRetry, dirDupActive, dirShowIt, dirAnyway · research:src/core/live.ts /directions -->

<a id="S4.3.2"></a>
### S4.3.2 Praca poza liniami według gałęzi

Przy dwóch i więcej liniach przegląd pokazuje pracę poza liniami według gałęzi. Opcje
z [R2.3](R2-lines-and-queue.md#R2.3) i [R2.3.1](R2-lines-and-queue.md#R2.3.1) można ustawić bezpośrednio z aplikacji.

- **Granice:**
  - Dla całego badania: **Jak jest podejmowana praca poza liniami**: **Od czasu do czasu**, **Na końcu**,
    **Normalnie**, **Nigdy**.
  - Wiersz gałęzi: osoba gałęzi, związek z linią (**przy linii …**), liczba zadań, **rośnie**, **własny wybór**.
  - Kliknięcie gałęzi pokazuje jej pierwsze zadania z miejscem w kolejce (**W kolejce · pierwsze K z N**,
    **I. w kolejce**) i odnośnik **Wszystkie N zadań w kolejce ›**. Gdy zadania gałęzi stoją za wczytaną częścią
    kolejki: **Zadania gałęzi stoją dalej w kolejce (N).**
  - Dla gałęzi: **Podejmowana:** **Od czasu do czasu** / **Na końcu** / **Normalnie** (wybór badania ma
    **(domyślne)**), **Dodaj do linii …** (najbliższa linia pierwsza), **Załóż linię z tej gałęzi**, **Nie badaj**
    (zadania opuszczają kolejkę, nic nie jest usuwane), **Przywróć domyślne**. Gałęzie niebadane są razem
    (**Nie jest badana · N gałęzi**).
  - Pytania o rosnące gałęzie ([R2.3.2](R2-lines-and-queue.md#R2.3.2)) są w **Czeka na załatwienie**: dodać do linii
    (przy linii wstrzymanej **Dodaj do linii … (wstrzymana)**), założyć linię, **Zostaw bez zmian**, nie badać. Bez
    odpowiedzi gałąź jest podejmowana dalej jak dotąd.
  - Okno **Badanie dla tego drzewa…**, grupa **Praca poza liniami**: wybór dla całego badania (**Od czasu do czasu**:
    „Około 1 zadanie poza liniami na K zadań linii.”), **Proponuj linie dla rosnących gałęzi**, **Gałęzie
    z własnym wyborem** i zadania z ręczną kolejnością. Od aplikacji 3.27.0 wstęp grupy mówi, co pomaga linii
    i zawsze idzie z nią: „pytanie linii, dołączenie osób do kogoś z linii lub do jego partnera, powód podany przez
    agenta” ([R2.3](R2-lines-and-queue.md#R2.3)).
- **Obsługa:** aplikacja: **Przegląd badania**, sekcja pracy poza liniami, przy gałęzi **⋯** (**Opcje gałęzi**);
  **Badanie dla tego drzewa…**.
- **Obowiązuje od:** aplikacja 3.22.0 (badanie 1.26.0)

<!-- zdroj: app:HEAD src/ui/research-offline-ui.ts:3, :104 (caps.offLineBranches, ≥2 linie) · src/research-directions-write.ts setBranchMode, setOffLineTree, answerBranchWaiting · strings.ts live.offModeLink, live.offModeCap, live.branchAddPick, live.branchCreate, live.branchNever, live.branchReset · research-offline-ui.ts:202-228 growingBranchLine, :542 branch choices, :680 branchQueueBeyond, :740 pick · strings.ts live.dirNear, branchGrows, branchOwnChoice, branchQueueHead, branchQueuePos, branchAllTasks, branchTaken, branchDefaultTag, branchAdd(Paused), branchNeverGroup, waitBranchLeave, waitBranchHint, setOutTitle, setOutOcc, setSuggest, setOwnChoice, setManualTasks, menu treeSettings · spec 038 K7 · 3.27.0: strings.ts live.setOutIntro (app 4e4f6d8c, spec 036 K1.8) -->

<a id="S4.4"></a>
## S4.4 Czeka na załatwienie w aplikacji

Panel i przegląd pokazują tę samą listę co badanie ([R6.1](R6-awaiting-action.md#R6.1)). Co można załatwić
w aplikacji, a co tylko w badaniu, mówi [R6.5](R6-awaiting-action.md#R6.5).

- **Granice:** pod listą jest napisane, gdzie się odpowiada: **Odpowiada się w badaniu. Drzewo zaktualizuje się samo
  po odpowiedzi.**, przy pytaniach o miejsca **Na pytania o miejsca odpowiada się tutaj.**, przy obu **Na pytania
  o miejsca odpowiada się tutaj, na pozostałe w badaniu.** Pozycji tylko dla terminala aplikacja nie dostaje
  ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
- **Z drzewa:** karta osoby, na którą coś czeka, ma znacznik **!** (podpowiedź: **Kliknięcie: odpowiedz**).
  Kliknięcie w niego i pozycja **Odpowiedz · N czeka** w menu osoby robią to samo:
  - gdy na osobę czeka jedna pozycja, otworzy się jej odpowiedź tak samo jak przyciskiem w jej wierszu w panelu;
  - gdy czeka ich więcej, otworzy się panel w sekcji **Czeka na załatwienie** z pozycjami osoby na górze, wyróżnionymi.
    Na telefonie, przy zwiniętej lub ukrytej sekcji i przy otwartym przeglądzie zostaną wyróżnione w **Przeglądzie
    badania**;
  - gdy na żadną pozycję osoby (nawet na jedyną) nie można tu odpowiedzieć, panel otworzy się tak samo, a pod każdą
    pozycją stoi **Tutaj nie można odpowiedzieć: odpowiada się w badaniu, na komputerze, na którym jest
    zainstalowane.** Kliknięcie nigdy nie zostaje bez reakcji;
  - nowa wersja opowieści otworzy porównanie;
  - na urządzeniu dotykowym menu osoby ma zamiast **Odpowiedz · N czeka** pozycję **Czeka na załatwienie · N ›**:
    wyróżni pozycje osoby, a odpowiada się z ich wierszy.
  - gdy karta ma dwa lub trzy oznaczenia, kliknięcie zaproponuje, co otworzyć ([S4.4.1](#S4.4.1)).
- **Hipotezy:** z badaniem, które umie je rozstrzygać w aplikacji, hipotezy do rozstrzygnięcia są w grupie
  **Hipotezy do rozstrzygnięcia** (chip **Decyzje**), także z przyjęciem propozycji agenta naraz ([S3.5.2](S3-what-the-research-knows.md#S3.5.2)).
- **Obsługa:** aplikacja: panel, sekcja **Czeka na załatwienie**; menu **Badanie → Czeka na załatwienie**; znacznik **!** na
  karcie i **Odpowiedz · N czeka** w menu osoby.
- **Obowiązuje od:** aplikacja 3.4.0. Pytania o miejsca od badania 1.25.0. Znacznik **!** i **Odpowiedz · N czeka**
  działają tak od aplikacji 3.26.0. Hipotezy od aplikacji 3.27.0 z badaniem 1.31.0. Kilka oznaczeń na karcie od
  aplikacji 3.27.0 ([S4.4.1](#S4.4.1)).
- **Od aplikacji 3.28.0:** w **Przeglądzie badania** sekcja ma od 10 pozycji pole wyszukiwania ([S4.4.2](#S4.4.2)).

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts renderLivePanel (waiting) · strings.ts research.answerWhere, research.answerHere, research.answerMixed · app:7cf409bd src/ui/card-signals-ui.ts answerPersonWaiting (vyprávění → porovnání; 1 položka → waitingAnswerAction; jinak showPersonWaiting, why jen když žádná nejde), personSignalsMenuHtml (dotyk: menuWaiting → signal-waiting-list) · src/ui/research-ui.ts showPersonWaiting (telefon, sbalený/skrytý oddíl, otevřený přehled → přehled), waitingWhyEl · src/research-waiting.ts personWaiting, panelWaiting (focus první) · src/ui/waiting-task-ui.ts waitingAnswerAction · src/card-signals.ts ACTION_GLYPH waiting '!' · strings.ts card.menuAnswer, card.menuWaiting, card.tipClickAnswer, live.waitingNoAnswerHere · e2e/card-waiting-answer.spec.ts · hypotézy: app:src/ui/hypothesis-waiting-ui.ts (commit 8d7f1597), research:src/core/waiting.ts hypothesesApp -->

<a id="S4.4.1"></a>
### S4.4.1 Kilka oznaczeń na karcie osoby

Karta osoby ma w rogu portretu (zdjęcia lub inicjałów) najwyżej jedno oznaczenie badania każdego rodzaju: **!** (coś
czeka, [S4.4](#S4.4)), **≠** (sprzeczność źródeł, [R5](R5-conflicts.md)) i **?** (otwarte pytanie). Z jednym
oznaczeniem karta zachowuje się jak wcześniej. Dwa lub trzy oznaczenia stoją jedno za drugim jako jeden przycisk.

- **Granice:**
  - kolejność oznaczeń: czeka › sprzeczność › pytanie; z przodu, gdzie stoi pojedyncze oznaczenie, jest najpilniejsze,
    tylne są bez znaku. Pokazują się tylko rodzaje włączone w **Ustawienia → Karta osoby → Na karcie pokazuj**
    (**Czeka na załatwienie**, **Sprzeczności w źródłach**, **Otwarte pytania**);
  - podpowiedź po najechaniu ma wiersz na każde oznaczenie (co czeka z tekstem pierwszego zadania, sprzeczności
    i hipotezy, pytanie), a pod nimi „Kliknięcie: wybór, co otworzyć”. Czytnik ekranu słyszy, co czeka („Czeka 3,
    2 sprzeczności, 1 hipoteza, 1 pytanie”);
  - kliknięcie otwiera przy oznaczeniach małe okno z imieniem i latami osoby (czytnik ekranu: „{imię}: co czeka”)
    i wyborami: **Odpowiedz · N czeka** z tekstem pierwszego zadania (na urządzeniu dotykowym **Czeka na załatwienie
    · N ›**), **Porównaj** (nowa wersja opowieści), **Co wie badanie · … ›** (sprzeczności, hipotezy i pytanie jako
    jeden wybór), **Śledź badanie ›** (agent pracuje nad osobą). Wybory zostają w aplikacji, żaden nie ma oznaczenia
    badania ([S4.5.1](#S4.5.1));
  - tylko sprzeczność i pytanie dają jeden wybór: kliknięcie od razu otwiera **Co wie badanie** („Kliknięcie: co wie
    badanie”);
  - okno stoi pod oznaczeniami, przy prawej lub dolnej krawędzi okna odwrotnie, a gdzie nie mieści się nigdzie, na
    górze i przewija się. Zamyka je kliknięcie obok (nic więcej nie robi), drugie kliknięcie w oznaczenia, Esc, wybór,
    przesunięcie lub przybliżenie drzewa, zmiana rozmiaru okna i przerysowanie drzewa. Na telefonie (do 640 px) to
    panel wysuwany od dołu z wierszami 48 px, zamyka go stuknięcie obok lub przeciągnięcie w dół; na tablecie
    i telefonie w poziomie okno z wierszami 44 px;
  - klawiatura: Enter, spacja lub strzałka w dół na oznaczeniach otwiera okno na pierwszym wyborze, strzałki chodzą
    w kółko, Home i End, Enter wybiera, Esc wraca na oznaczenia, Tab idzie dalej;
  - karta bez portretu (**Szczegóły kart → Kompaktowe**) ma zamiast oznaczeń dwie kropki. Przy oddaleniu drzewa
    poniżej 0,55 każda karta, w każdych **Szczegółach kart**, ma zamiast oznaczeń jedną kropkę. Wydruk drzewa nie ma
    oznaczeń.
- **Obsługa:** aplikacja: kliknięcie w oznaczenia w rogu portretu; **Ustawienia → Karta osoby → Na karcie pokazuj**.
- **Obowiązuje od:** aplikacja 3.27.0

<!-- zdroj: app:16461aca, 85c1f704, abf7620f src/card-signals.ts ACTION_ORDER (waiting, conflict, question), presentActions (zapnuté v Na kartě ukázat), stackChoices (waiting, story, knows, agent), ACTION_GLYPH · src/card-signal-marks.ts cardActionMarksHtml (stoh n2/n3, tečky), stackAriaLabel, stackTipHtml (tipClickChoose / tipClickKnows), stackMenuItemsHtml (menuAnswer / dotyk menuWaiting, story.compare, menuKnows, menuAgent; bez značky výzkumu), placeStackMenu · index.html .card-signal-stack, #tree-canvas.zoom-far (src/zoom.ts ZOOM_FAR = 0.55; index.html:13732-13741 jedna tečka u všech Detailů karet, e2e/card-signals.spec.ts:353), body.view-mode-print bez značek, compact dvě tečky · strings.ts card.stackLabel, stackWaiting, stackMenuLabel, tipClickChoose, cardDensity.cardWaiting, cardConflict, cardQuestion, compact · CHANGELOG.cs.md 3.27.0 „Více značek na kartě“ · dirigent:prace/1111-app-karta-vice-znacek -->

<a id="S4.4.2"></a>
### S4.4.2 Wyszukiwanie w Czeka na załatwienie

Sekcja **Czeka na załatwienie** w **Przeglądzie badania** ma pole **Szukaj osoby, miejsca, archiwum, zadania…**.
Aplikacja szuka sama w pozycjach, które już ma, i nic nie wysyła do badania. Filtruje od razu przy pisaniu, także bez
śledzenia, gdy badanie nie działa (pozycje, które badanie podało ostatnio, [S4.1.5](#S4.1.5)), i w oknie Przeglądu
([S4.1.6](#S4.1.6)).

- **Kiedy pole jest:** w rozwiniętej sekcji z 10 i więcej pozycjami, pod nagłówkiem sekcji i nad chipami rodzaju.
  Z wpisanym tekstem pole zostaje, nawet gdy pozycji ubędzie.
- **Co się znajdzie:** pozycje, które mają każde wpisane słowo (w dowolnej kolejności; słowa dzieli spacja, przecinek
  albo średnik) w tym, co pokazuje ich wiersz, szczegół albo nagłówek grupy:
  - tekst pozycji i na co czeka;
  - imiona i nazwiska oraz numery osób (`P47` i `P0047`);
  - numer zadania (`T0815`, `t815`) i hipotezy (`H22`); sama liczba (`815`) znajdzie zadanie z tym numerem,
    w przeciwnym razie hipotezę, w przeciwnym razie tekst (na przykład rok);
  - nazwa grupy (miejsce, archiwum, urząd), adres archiwum przy zezwoleniu i do kogo idzie list.
- **Zgodność tekstu:** bez względu na wielkość liter i znaki diakrytyczne; ß, ł, đ, ø, æ i œ znajdą się też jako ss,
  l, d, o, ae i oe (`grosshof` znajdzie „Großhof”). Słowo z 5 i więcej znakami znajdzie też słowa, które zaczynają
  się jak ono bez ostatniego znaku (`bialy` znajdzie „Białe”).
- **Granice:**
  - chipy rodzaju (**Decyzje**, **Obrazy**, **Archiwa i urzędy**…) pokazują liczbę znalezionych; rodzaj bez
    zgodności jest przerywany i można go dalej wybrać. Szuka się w wybranym rodzaju;
  - nad listą „Znaleziono 12 z 40” (z pozycji wybranego rodzaju). Bez wyniku **Nic nie znaleziono.**, w wybranym
    rodzaju „W rodzaju Obrazy nic nie znaleziono.” z **Szukaj we wszystkich rodzajach**, oraz **Wyczyść
    wyszukiwanie**;
  - fazy (**Do załatwienia**, **Czeka na odpowiedź**) i grupy ze zgodnością się rozwijają, bez zgodności się nie
    pokazują. To, co zwinie się podczas wyszukiwania, obowiązuje tylko dla tego wyszukiwania; po wyczyszczeniu pola
    wraca ręczne rozwinięcie;
  - zgodność numeru osoby, zadania lub hipotezy ma przy wierszu bursztynową etykietę („P0108 Jan Horák”); zgodność
    tekstu nie jest wyróżniana;
  - hipotezy w grupie **Hipotezy do rozstrzygnięcia**: głowa wyboru **Wybierz znalezione z propozycją (n)** wybiera
    tylko znalezione. Wybrane poza wyszukiwaniem zostają wybrane, a stopka to mówi („Wybrano 5, w tym 2 poza
    wyszukiwaniem.”) z **Odznacz poza wyszukiwaniem**. **Przyjmij propozycje (n)** liczy wszystkie wybrane
    ([S3.5.2](S3-what-the-research-knows.md#S3.5.2));
  - zwinięta sekcja z wpisanym wyszukiwaniem ma w nagłówku zamiast podsumowania lupę i szukany tekst;
  - starsze badanie bez rodzajów i grup: szuka się w wierszach, jak idą po sobie;
  - × albo Escape czyści pole (Escape w pustym polu zamyka Przegląd), ↓ przechodzi do pierwszego wiersza, czytnik
    ekranu powie liczbę po krótkiej przerwie. Tekst obowiązuje do zamknięcia Przeglądu i nigdzie się nie zapisuje;
  - telefon: pole ma 44 px wysokości; po stuknięciu w pole sekcja przesuwa się pod nagłówek Przeglądu, a Przegląd
    kończy się nad klawiaturą, więc znalezione jest między polem a klawiaturą.
- **Obsługa:** aplikacja: **Przegląd badania → Czeka na załatwienie**, pole wyszukiwania.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:8cbada1c src/section-search-match.ts foldSearch2 (ß ł đ ø æ œ), tokenize (mezera, čárka, středník; p/t/h + číslo, samotné číslo), matchDoc (každé slovo; n: úkol, hypotéza, text), textMatches (≥ 5 znaků bez posledního na začátku slova), fieldVisible (≥ 10 nebo text) · src/ui/section-search.ts (×, Escape: nejdřív hledání, prázdné pole zavře Přehled; ↓; searchOpen se vymaže s textem; zavření Přehledu text zahodí) · app:9ebf7f2c src/section-search-filter.ts searchSection, chipCount, sectionPartOpen, toggleSectionPart, sheetOverKeyboard · src/ui/section-search-view.ts mountSectionSearch, paintSearchChip (čárkovaný), appendSearchOutcome (sectionSearchFound, queueSearchNone, sectionSearchNoneKind + sectionSearchAllKinds, queueSearchCancel), searchHitTag, searchSummaryEl (lupa a text), bindSheetSearch, keepSheetOverKeyboard · src/ui/research-overview-ui.ts appendOverviewWaiting (pole jen v rozbaleném oddílu, starší výzkum bez skupin), waitingSearchDoc (what, on, osoby, person, partner, task, hypo, group.name / otázky k místům, host, to), overviewWaitingRow (hit t, p) · app:cd0030b0 src/ui/hypothesis-waiting-ui.ts hypothesisAcceptHeadEl (bulkSelectFound), hypothesisAcceptFootEl (bulkSelectedHidden, bulkDeselectHidden), hwr-id hit h · strings.ts live.waitingSearchPlaceholder, waitingSearchAria, sectionSearchFound, sectionSearchNoneKind, sectionSearchAllKinds, bulkSelectFound, bulkSelectedHidden, bulkDeselectHidden, sectionSearchQuoted, waitingPhaseTodo, waitingPhaseSent, waitingChips · e2e/overview-waiting-search.spec.ts · CHANGELOG.cs.md 3.28.0 (e540e4b5) · spec 083 K1.1–K1.3 · prace/1113-app-hledani-v-prehledu (pole 44 px na telefonu) -->

<a id="S4.5"></a>
## S4.5 Działania, które otwierają badanie

Większość działań badania w aplikacji to link `strom-research://`. Link otwiera terminal badania na tym samym
komputerze. Terminal mówi, o co prosi aplikacja, i pyta. Bez potwierdzenia w terminalu nic się nie zapisze ani nie
zapłaci.

- **Granice:**
  - Działanie jest widoczne tylko na komputerze (nie na urządzeniu dotykowym), tylko gdy badanie zgłosiło link i tylko
    gdy włączone jest **Strom Research na tym komputerze**.
  - Link niesie tylko numery rekordów i stałe wartości, żadnych imion ani nazwisk ani dowolnego tekstu.
  - Terminal zaczyna od **Prośba z aplikacji Strom: … / Badanie: …** i pyta **Kontynuować?** Przy pracy
    agenta dopisuje **Agent pracuje w ramach subskrypcji lub kredytu AI swojego konta.**, przy zlecaniu zadań
    **Badanie zapisze zadania dla agenta – teraz niczego się nie szuka i za nic się nie płaci.**
  - Archiwum Strom i badanie, które czeka na agenta, odrzucają pracę agenta (rozmowa, sprawdzenie, szukanie,
    miejsca, dzieje).
  - Gdy taka sama aktywna linia już jest, **Szukaj przodków** tylko mówi **Taka linia badania już jest: „…” –
    agent ją kontynuuje.**
  - Aplikacja nie wie, czy terminal się otworzył. Pokazuje **Otwieranie badania…** i radę **Jeśli nic się nie
    otworzy, trzeba uruchomić Strom Research i spróbować ponownie.**
- **Obsługa:** aplikacja: **Ustawienia → Dane i prywatność → Strom Research na tym komputerze**.
- **Obowiązuje od:** aplikacja 3.4.0 (badanie 1.6.0). Odrzucenie w Archiwum Strom od badania 1.14.0, przy czekaniu
  na agenta od 1.15.0.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts researchLinkAvailable, launchResearchLink, :841 onComputer · strings.ts research.linksSetting, research.openingQuietHint · index.html linksSetting · research:v1.25.2 src/commands/links.ts:128 refusedHere, :153 inTerminal, :351 ui.research.exists · src/core/links.ts (hlavička) · assets/lang/cs.json ui.link.asks, ui.link.go, ui.link.cost, ui.link.tasks, ui.archive.refuse, ui.waiting.refuse -->

<a id="S4.5.1"></a>
### S4.5.1 Oznaczenia działań

Każde działanie badania ma jedno z trzech oznaczeń według tego, co otwiera.

| Oznaczenie | Co się stanie | Działania |
|---|---|---|
| bez oznaczenia | nic nie otwiera terminala | **Śledź na żywo**, wycinek i oryginał w przeglądarce, wczytanie drzewa |
| terminal | terminal pokazuje lub pyta; kliknięciem nic się nie płaci | **Otwórz badanie**, wysłanie zmian, **Sprawdź ponownie…**, **Szukaj przodków**, **Odłóż**, **Porzuć**, akcje linii, **Dokończ i zakończ**, **Cofnij ostatnie wysłanie**, ustawienia, **Kontrola badania** |
| AI i terminal | praca agenta, płaci za nią subskrypcja AI | **Kontynuuj z agentem**, **Zapytaj agenta**, **Pracuj nad tą linią**, rozmowa o zadaniu lub sprzeczności, badanie miejsc, dzieje miejsca |

- **Granice:** przy pracy agenta aplikacja przy otwieraniu pokazuje **Otwieranie agenta…** i **Pytania zadaje się
  agentowi. Praca agenta zużywa subskrypcję AI.** Rozmowa może zamiast terminala otworzyć aplikację agenta, gdy
  badanie jest tak ustawione.
- **Obowiązuje od:** aplikacja 3.21.0
- **Od aplikacji 3.28.0:** **Praca nad kolejką…** i w jej oknie **Otwórz terminal** mają oznaczenie AI i terminal
  ([S4.2.3](#S4.2.3)). Wyszukiwanie w kolejce, **Zrób jako następne** i **Cofnij** są bez oznaczenia: idą przez most
  i nic nie otwierają ([S4.2.1](#S4.2.1), [S4.2.2](#S4.2.2)).

<!-- zdroj: app:v3.21.2 src/research-link.ts:66 RESEARCH_LINK_MARKS, researchLinkMark (task do=chat, conflict do=agent, experiment do=off, fixes paid) · strings.ts research.openingAgent, research.openingAgentHint · research:v1.25.2 src/commands/links.ts:373 whereToTalk · 3.28.0: app 9cf43b22 researchLinkMark('work') u queue-work-btn, research-item-queue-work, Otevřít terminál; ZADANI_DEV_fronta-hledani „Značení akcí“ -->

<a id="S4.5.2"></a>
### S4.5.2 Gdzie są działania

- **Menu Badanie** (tylko na komputerze, nie przy zablokowanym drzewie): na górze najwyżej 6 pozycji: **Czeka na
  załatwienie**, **Kontynuuj z agentem**, **Przegląd badania** lub **Śledź na żywo**, **Otwórz badanie**, wysłanie
  zmian. Pod tym **Wczytaj nową wersję**, **Narzędzia badania**, **Cofnij ostatnie wysłanie** (najwyżej sprzed 7 dni)
  i ustawienia badania. Na dole jest **kontynuacja w badaniu na tym komputerze. Nic nie zostanie zapisane ani
  opłacone bez potwierdzenia w nim.**
- **Narzędzia badania**: grupy **Przegląd**, **Zlecenie pracy**, **Uruchomienie agenta**. W 3.21.2 jest w nich tylko
  **Kontrola badania**.
- Menu osoby **Badanie ›** (tylko przy osobie, którą badanie zna): **Sprawdź ponownie…** (okno z zakresem: tylko
  osoba, z rodziną, z przodkami; **Kontynuacja w terminalu badania, gdzie zadania są widoczne i zatwierdzane. Za
  darmo.**), **Szukaj przodków**, **Szukaj potomków**, **Zapytaj agenta**.
- **Przegląd badania → Teraz**: przy pracującym agencie **Dokończ i zakończ**
  ([R7.3](R7-when-the-agent-works.md#R7.3)).
- W Archiwum Strom brakuje wszystkiego, co potrzebuje agenta, także **Śledź na żywo**.
- **Obowiązuje od:** aplikacja 3.4.0; górnych 6 pozycji od 3.14.0, **Narzędzia badania** od 3.19.0, **Dokończ
  i zakończ** od 3.5.0
- **Od aplikacji 3.28.0:**
  - w menu **Badanie** pod **Kontynuuj z agentem** jest pozycja **Praca nad kolejką…** ([S4.2.3](#S4.2.3)), gdy jest
    oferowana. Gdy na górze jest więcej niż 6 pozycji, do **Więcej działań** przenosi się jako pierwsze **Otwórz
    badanie**;
  - w **Teraz** działania stoją pod tekstem każdej sesji, w jednym wierszu: **Pokaż w drzewie** · **Dokończ
    i zakończ**. Na telefonie jest tylko **Pokaż w drzewie**.

<!-- zdroj: app:v3.21.2 src/ui/research-actions-ui.ts:152 UNDO_MAX_AGE_MS, :158 FIRST_LEVEL_MAX, :300 researchMenuShown, :435 tools, :1000 personResearchActions · src/research-link.ts:115 RESEARCH_TOOL_GROUPS, :132 RESEARCH_TOOL_ACTIONS · research-overview-ui.ts:811, :870 finishSession · strings.ts research.footerFull, research.tools.*, research.reviewWhere, research.continueAgent · 3.28.0: app 9cf43b22 src/ui/research-actions-ui.ts research-item-queue-work za research-item-chat (queueWorkMenuOffered), FIRST_LEVEL_MAX 6: research-item-open do more · 623d9c77 src/ui/research-overview-ui.ts overviewNowActions (now-actions pod textem: showInTree · finishSession, finish ne v sheet), overviewNowLine (každé sezení svůj řádek) · ZADANI_DEV_fronta-hledani §6 (varianta A) -->

<a id="S4.5.3"></a>
### S4.5.3 Otwarcie zadania w kolejce

**Otwórz zadanie T…** otwiera zadanie w kolejce w terminalu badania. Terminal pokazuje zadanie i pyta, co z nim teraz.

- **Granice:**
  - terminal pokazuje **Zadanie T… jest w kolejce: agent weźmie je, gdy przyjdzie jego kolej.**, **Dlaczego: …**
    i **Gotowe, gdy: …** i pyta **Co teraz?**:
    - **Przejść je z agentem (…) teraz, w rozmowie**: najpierw pyta i mówi, ile kosztowały tu podobne sesje, albo że
      tego jeszcze nie wiadomo;
    - **Przesunąć je w kolejce do przodu (najwyższy priorytet)**: priorytet 5; jeśli zadanie już go ma, nic się nie
      dzieje;
    - **Zostawić je w kolejce bez zmian**;
  - Enter lub 0 niczego nie zapisuje. Z zadaniem, nad którym agent właśnie pracuje, nic się nie dzieje;
  - zadanie, które czeka na człowieka, otwiera swoje dotychczasowe pytanie.
- **Obsługa:** aplikacja: **Otwórz zadanie T…** (oznaczenie terminal) po utworzeniu zadania z nowego odczytu i w wierszu
  przy źródle ([R8.8.3](R8-reading-scans.md#R8.8.3)). Terminal: `strom chat --task T…` bierze zadanie z kolejki od razu
  do rozmowy.
- **Obowiązuje od:** badanie 1.29.0, aplikacja 3.25.0

<!-- zdroj: research:c2a690ea src/cli/menu-links.ts (odkaz task bez do, úkol open) · assets/lang/cs.json ui.link.open.title/why/done/pick/chat/ahead/keep/already/kept/busy/estimate/estimate.none, ui.chat.task.open.say · strom help chat (--task: „a task in the queue (open): gone through now, taken up in the conversation“) · commit 9bd14e84 · test/cli/link-open-task.test.ts · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 7; klik v aplikaci neověřen) · app:6bd8609e strings.ts read.openTaskN, src/__tests__/read-source-state-view.test.ts:75 (researchLinkMark task) -->

<a id="S4.6"></a>
## S4.6 Co jest tylko w terminalu

Aplikacja pokazuje i prosi, terminal rozstrzyga. Co wymaga zgody człowieka lub kosztuje pieniądze, potwierdza się
zawsze w terminalu badania, nawet gdy zaczyna się kliknięciem w aplikacji.

- **Granice:**
  - Tylko w terminalu: uruchomienie samodzielnej pracy agenta i jej granice ([R7.1](R7-when-the-agent-works.md#R7.1)),
    warunek, wybór agenta, ustawienia kolejki i pozycje **Tylko tutaj w terminalu**
    ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
  - Potwierdza się w terminalu: wszystko z oznaczeniem terminal lub AI ([S4.5.1](#S4.5.1)), w 3.21.2 także akcje
    linii i kolejki.
  - Na telefonie linków nie ma; odpowiada się w badaniu na komputerze ([S5](S5-phone.md)).
- **Obowiązuje od:** aplikacja 3.4.0 (badanie 1.6.0)
- **Od aplikacji 3.22.0:** z badaniem 1.26.0 bez terminala działają linie ([S4.3.1](#S4.3.1)), praca poza liniami
  według gałęzi ([S4.3.2](#S4.3.2)) i miejsce zadania w kolejce ([S4.2](#S4.2)).
- **Od aplikacji 3.28.0:** z badaniem 1.32.0 o samodzielną pracę agenta nad kolejką można poprosić z aplikacji
  ([S4.2.3](#S4.2.3)). Uruchamia ją terminal badania dopiero po potwierdzeniu
  ([R7.1.2](R7-when-the-agent-works.md#R7.1.2)); warunek i jego ustawienie zostają w terminalu.

<!-- zdroj: research:v1.25.2 src/core/links.ts (hlavička: nic se nezapíše bez slova člověka v terminálu) · src/core/live.ts (hlavička mostu) · app:v3.21.2 src/research-link.ts:66 · HEAD src/research-directions-write.ts · 3.28.0: app 9cf43b22 src/ui/queue-work-dialog.ts (aplikace nic nespouští, odkaz work) · spec 052 K6.2 (cesta terminál) -->
