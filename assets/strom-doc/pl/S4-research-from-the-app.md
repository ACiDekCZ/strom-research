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
  - Panel: **Trwa praca**, **Czeka na decyzję**, **Ostatnie zmiany** (5 najnowszych, link **Wszystkie zmiany
    w przeglądzie ›**), **W kolejce** (3 zadania), a pod tym liczba sesji agenta w tym miesiącu.
  - Gdy panel jest wyższy niż okno, zwija się sam najpierw **W kolejce**, potem zmiany, potem **Trwa praca**.
    **Czeka na decyzję** nigdy nie zwija się sam. Sekcja, którą zwinął lub rozwinął człowiek, zostaje taka, jaka
    jest.
  - Przegląd, sekcje w tej kolejności: podsumowanie (**Stan**, **Ostatnie 24 h**, **Ten miesiąc** z liczbą sesji),
    **Teraz**, **Czeka na decyzję** (tylko gdy coś czeka), **Linie** ([S4.3](#S4.3)), **Przebieg**, **Kolejka**
    ([S4.2](#S4.2)), **Co wie badanie** ([S3](S3-what-the-research-knows.md)). **Kolejka** i **Co wie badanie** są
    na początku zwinięte.
  - **Przebieg** łączy kroki po 15 minut, pokazuje najwyżej 20 kroków.
  - Przegląd jest na szerokim oknie (od 1280 px) panelem bocznym obok drzewa, na tablecie warstwą nad drzewem, na
    telefonie całym ekranem. Na telefonie panel staje się paskiem, a stuknięcie otwiera przegląd.
  - Bez śledzenia panel pokazuje ostatnie znane **Czeka na decyzję** ze zdaniem **Stan na {d}. Badanie teraz nie
    działa.**
- **Obsługa:** aplikacja: panel, przyciski **⤢ Otwórz przegląd** i **Zakończ śledzenie**; menu **Badanie → Przegląd
  badania**.
- **Obowiązuje od:** aplikacja 3.5.0
- **Od aplikacji 3.22.0:** każdą sekcję można rozwinąć, zwinąć lub ukryć, a wybór obowiązuje dla panelu i przeglądu
  ([S4.1.2](#S4.1.2)). **Czeka na decyzję** nie rozwija się samo nawet przy nowej pozycji.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:223 PANEL_CHANGES, :227 AUTO_FOLD, :3326 appendQueueSection(…, 3), renderLivePanel, renderIdleResearchPanel · src/ui/research-overview-ui.ts:5 (≥1280), :51 FOLDED_BY_DEFAULT, :53 GROUP_MS, :59 MAX_STEPS, :74, :309-311 · strings.ts live.overviewTitle, research.panelLabel, research.stop, research.atWork, research.queue -->

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
  - sekcje: **Trwa praca** (w przeglądzie **Teraz**), **Czeka na decyzję**, **Ostatnie zmiany** (w przeglądzie
    **Przebieg**), **W kolejce** (w przeglądzie **Kolejka**) i tylko w przeglądzie **Linie** oraz **Co wie badanie**;
  - sekcja bez wyboru (**domyślna**) pokazuje się jak wcześniej: panel zwija, co się nie mieści (**zwinięta, brak
    miejsca**), przegląd ma zwinięte sekcje **Kolejka** i **Co wie badanie**. Sekcji z wyborem panel sam nie zwija;
  - kliknięcie nagłówka sekcji to trwały wybór (rozwinąć / zwinąć);
  - wybór zapamiętuje się na tym urządzeniu dla wszystkich drzew, nic się nie synchronizuje. Wcześniejsze ręczne
    zwinięcie sekcji przejmuje się jeden raz;
  - **Przywróć domyślne** usuwa wszystkie wybory. Przywrócenie domyślnych i ukrycie sekcji z jej menu można przez
    chwilę cofnąć (**Cofnij**). Gdy ukryte są wszystkie sekcje, panel mówi **Wszystkie sekcje są ukryte.**
- **Czeka na decyzję zwinięte lub ukryte:**
  - nowa pozycja sekcji nie rozwija. Nagłówek pokazuje liczbę i **{n} nowych**; wyróżnione, gdy jest wśród nich
    decyzja lub zgoda (**w tym decyzja lub zgoda**);
  - ukryte zostawia etykietę **Czeka {n}** w nagłówku panelu, w podsumowaniu zwiniętego panelu, w pasku na telefonie
    i w przeglądzie. Kliknięcie pokazuje sekcję w przeglądzie, dopóki przegląd się nie zamknie (**Ukryta sekcja,
    widoczna do zamknięcia przeglądu.**).
- **Obsługa:** aplikacja: **⋯ → Dostosuj panel…** w nagłówku panelu i przeglądu; prawy przycisk albo długie
  naciśnięcie na nagłówku sekcji (także klawisz Menu lub Shift+F10); **Ustawienia → Śledzenie badania**. Na
  telefonie jako panel wysuwany od dołu.
- **Obowiązuje od:** aplikacja 3.22.0

<!-- zdroj: app:src/ui/live-section-prefs.ts SECTION_PREFS_KEY, PREF_KEYS, OVERVIEW_KEYS, OLD_PANEL_KEY · src/ui/live-section-edit.ts · src/ui/live-section-edit-ui.ts · src/ui/research-ui.ts:282 waitingHeadInfo, :312 waitingChip, :3180 toggle, :3215 resetLiveSections, :3225 hideLiveSection · src/ui/research-overview-ui.ts:376 shownOnce · strings.ts live.editPanel(Menu), sectionExpanded/Collapsed/Hidden/Default, resetDefaults, autoFoldedNote, allHidden, waitingShort, importantHint, shownOnce, settings groupResearchFollow · commity c4b1dcc, a56232a · spec 044 K1–K5 -->

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

<a id="S4.2"></a>
## S4.2 Kolejka w aplikacji

Aplikacja pokazuje początek kolejki badania w kolejności, w jakiej bierze ją agent
([R2.2](R2-lines-and-queue.md#R2.2)). Cała kolejka zostaje w badaniu.

- **Granice:**
  - Panel pokazuje 3 zadania (**W kolejce**), przegląd 20 (**Kolejka**). Resztę pokazuje wiersz **i {n} kolejnych
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
  Etykieta gałęzi (**Gałąź {n} {k}**) zawęża całą kolejkę do zadań gałęzi; **Pokaż całą kolejkę** ją usuwa.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:308 queueNoteText, :3373 appendQueueSection · research-overview-ui.ts:311 (20) · strings.ts research.queue, research.park/drop/wake, research.queueMore, research.queueOffLast, research.queueOffNever, research.queueHelps · HEAD src/research-queue-pages.ts:19 QUEUE_PAGE, :28 QUEUE_ROWS_CAP · src/ui/research-ui.ts:3884 taskDoNext/taskDoLast · strings.ts live.taskDoing, live.queueLoadMore, live.queueCapNote, live.branchQueueChip, live.branchQueueChipClear -->

<a id="S4.3"></a>
## S4.3 Linie w aplikacji

Przegląd pokazuje linie badania ([R2.1](R2-lines-and-queue.md#R2.1)): co na którą czeka i dokąd doszła. W aplikacji
3.21.2 linie tylko się czyta; każdą zmianę potwierdza się w terminalu badania.

- **Granice:**
  - Sekcja **Linie · aktywne: {n}** jest tylko przy dwóch i więcej liniach albo przy jednej linii, gdy działa też
    praca poza nią (wiersz **Poza liniami**). Wstrzymane i zakończone linie są zwinięte pod **Wstrzymane
    i zakończone · {n}**.
  - Wiersz linii: rodzaj (↑ przodkowie, ↓ potomkowie, ⌕ pytanie), nazwa, osoba, liczba zadań i co czeka na decyzję.
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
  linii pokazuje, nad czym teraz trwa praca (**Teraz: …**), i granice (**do {n} pokoleń**, **przed {rok}**; przy
  linii wstrzymanej nie). Szczegóły linii mówią, co linia znalazła w ostatnich dniach (**Ostatnie {n} dni:** sesje,
  osoby, źródła); osoby pokazują w drzewie. Zakończone linie są zwinięte na końcu (**Zakończone · {n}**). W wąskim
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
  - Gdy taka sama linia już jest, formularz to mówi (**Linia {n} już działa.**) i proponuje **Pokaż ją** albo
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
  - Wiersz gałęzi: osoba gałęzi, związek z linią (**przy linii {n}**), liczba zadań, **rośnie**, **własny wybór**.
  - Kliknięcie gałęzi pokazuje jej pierwsze zadania z miejscem w kolejce (**W kolejce · pierwsze {k} z {n}**,
    **{i}. w kolejce**) i odnośnik **Wszystkie {n} zadań w kolejce ›**. Gdy zadania gałęzi stoją za wczytaną częścią
    kolejki: **Zadania gałęzi stoją dalej w kolejce ({n}).**
  - Dla gałęzi: **Podejmowana:** **Od czasu do czasu** / **Na końcu** / **Normalnie** (wybór badania ma
    **(domyślne)**), **Dodaj do linii {n}** (najbliższa linia pierwsza), **Załóż linię z tej gałęzi**, **Nie badaj**
    (zadania opuszczają kolejkę, nic nie jest usuwane), **Przywróć domyślne**. Gałęzie niebadane są razem
    (**Nie jest badana · {n} gałęzi**).
  - Pytania o rosnące gałęzie ([R2.3.2](R2-lines-and-queue.md#R2.3.2)) są w **Czeka na decyzję**: dodać do linii
    (przy linii wstrzymanej **Dodaj do linii {n} (wstrzymana)**), założyć linię, **Zostaw bez zmian**, nie badać. Bez
    odpowiedzi gałąź jest podejmowana dalej jak dotąd.
  - Okno **Badanie dla tego drzewa…**, grupa **Praca poza liniami**: wybór dla całego badania (**Od czasu do czasu**:
    „Około 1 zadanie poza liniami na {k} zadań linii.”), **Proponuj linie dla rosnących gałęzi**, **Gałęzie
    z własnym wyborem** i zadania z ręczną kolejnością.
- **Obsługa:** aplikacja: **Przegląd badania**, sekcja pracy poza liniami, przy gałęzi **⋯** (**Opcje gałęzi**);
  **Badanie dla tego drzewa…**.
- **Obowiązuje od:** aplikacja 3.22.0 (badanie 1.26.0)

<!-- zdroj: app:HEAD src/ui/research-offline-ui.ts:3, :104 (caps.offLineBranches, ≥2 linie) · src/research-directions-write.ts setBranchMode, setOffLineTree, answerBranchWaiting · strings.ts live.offModeLink, live.offModeCap, live.branchAddPick, live.branchCreate, live.branchNever, live.branchReset · research-offline-ui.ts:202-228 growingBranchLine, :542 branch choices, :680 branchQueueBeyond, :740 pick · strings.ts live.dirNear, branchGrows, branchOwnChoice, branchQueueHead, branchQueuePos, branchAllTasks, branchTaken, branchDefaultTag, branchAdd(Paused), branchNeverGroup, waitBranchLeave, waitBranchHint, setOutTitle, setOutOcc, setSuggest, setOwnChoice, setManualTasks, menu treeSettings · spec 038 K7 -->

<a id="S4.4"></a>
## S4.4 Czeka na decyzję w aplikacji

Panel i przegląd pokazują tę samą listę co badanie ([R6.1](R6-awaiting-action.md#R6.1)). Co można załatwić
w aplikacji, a co tylko w badaniu, mówi [R6.5](R6-awaiting-action.md#R6.5).

- **Granice:** pod listą jest napisane, gdzie się odpowiada: **Odpowiada się w badaniu. Drzewo zaktualizuje się samo
  po odpowiedzi.**, przy pytaniach o miejsca **Na pytania o miejsca odpowiada się tutaj.**, przy obu **Na pytania
  o miejsca odpowiada się tutaj, na pozostałe w badaniu.** Pozycji tylko dla terminala aplikacja nie dostaje
  ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
- **Obsługa:** aplikacja: panel, sekcja **Czeka na decyzję**; menu **Badanie → Czeka na decyzję**.
- **Obowiązuje od:** aplikacja 3.4.0. Pytania o miejsca od badania 1.25.0.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts renderLivePanel (waiting) · strings.ts research.answerWhere, research.answerHere, research.answerMixed -->

<a id="S4.5"></a>
## S4.5 Działania, które otwierają badanie

Większość działań badania w aplikacji to link `strom-research://`. Link otwiera terminal badania na tym samym
komputerze. Terminal mówi, o co prosi aplikacja, i pyta. Bez potwierdzenia w terminalu nic się nie zapisze ani nie
zapłaci.

- **Granice:**
  - Działanie jest widoczne tylko na komputerze (nie na urządzeniu dotykowym), tylko gdy badanie zgłosiło link i tylko
    gdy włączone jest **Strom Research na tym komputerze**.
  - Link niesie tylko numery rekordów i stałe wartości, żadnych imion ani nazwisk ani dowolnego tekstu.
  - Terminal zaczyna od **Prośba z aplikacji Strom: {co} / Badanie: {nazwa}** i pyta **Kontynuować?** Przy pracy
    agenta dopisuje **Agent pracuje w ramach subskrypcji lub kredytu AI swojego konta.**, przy zlecaniu zadań
    **Badanie zapisze zadania dla agenta – teraz niczego się nie szuka i za nic się nie płaci.**
  - Archiwum Strom i badanie, które czeka na agenta, odrzucają pracę agenta (rozmowa, sprawdzenie, szukanie,
    miejsca, dzieje).
  - Gdy taka sama aktywna linia już jest, **Szukaj przodków** tylko mówi **Taka linia badania już jest: „{name}” –
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

<!-- zdroj: app:v3.21.2 src/research-link.ts:66 RESEARCH_LINK_MARKS, researchLinkMark (task do=chat, conflict do=agent, experiment do=off, fixes paid) · strings.ts research.openingAgent, research.openingAgentHint · research:v1.25.2 src/commands/links.ts:373 whereToTalk -->

<a id="S4.5.2"></a>
### S4.5.2 Gdzie są działania

- **Menu Badanie** (tylko na komputerze, nie przy zablokowanym drzewie): na górze najwyżej 6 pozycji: **Czeka na
  decyzję**, **Kontynuuj z agentem**, **Przegląd badania** lub **Śledź na żywo**, **Otwórz badanie**, wysłanie
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

<!-- zdroj: app:v3.21.2 src/ui/research-actions-ui.ts:152 UNDO_MAX_AGE_MS, :158 FIRST_LEVEL_MAX, :300 researchMenuShown, :435 tools, :1000 personResearchActions · src/research-link.ts:115 RESEARCH_TOOL_GROUPS, :132 RESEARCH_TOOL_ACTIONS · research-overview-ui.ts:811, :870 finishSession · strings.ts research.footerFull, research.tools.*, research.reviewWhere, research.continueAgent -->

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

<!-- zdroj: research:v1.25.2 src/core/links.ts (hlavička: nic se nezapíše bez slova člověka v terminálu) · src/core/live.ts (hlavička mostu) · app:v3.21.2 src/research-link.ts:66 · HEAD src/research-directions-write.ts -->
