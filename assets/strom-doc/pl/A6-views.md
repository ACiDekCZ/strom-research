<a id="A6"></a>
# A6 Widoki i wybór osób

Jak aplikacja Strom wybiera, które osoby pokaże, i jak pokazują je poszczególne widoki. Opisuje aplikację
3.21.2; zmiany z nowszej wersji mają przy sobie jej numer.

Widok to inne odczytanie **tego samego wyboru osób**. Wybór określa osoba w centrum (ta, którą się kliknie)
i głębokość **Przodkowie** oraz **Potomkowie**. Rodzina, Potomkowie, Oś czasu i Mapa pokazują to samo otoczenie
osoby w centrum. Wachlarz liczy przodków i potomków sam według liczby pokoleń ([A6.4](#A6.4)).

| Widok (cs) | en | de | pl |
|---|---|---|---|
| **Rodina** | Family | Familie | Rodzina |
| **Potomci** | Descendants | Nachkommen | Potomkowie |
| **Časová osa** | Timeline | Zeitleiste | Oś czasu |
| **Vějíř** | Fan | Fächer | Wachlarz |
| **Mapa** | Map | Karte | Mapa |

<!-- zdroj: app:src/types.ts:1237 ViewMode · strings.ts viewModeSwitch.* -->

<a id="A6.1"></a>
## A6.1 Otoczenie osoby w centrum w widoku Rodzina

Widok Rodzina pokazuje osobę w centrum w jej rodzinie, nie całe drzewo.

- Do wyboru należą:
  1. osoba w centrum i wszyscy jej partnerzy;
  2. jej potomkowie do głębokości **Potomkowie**, z partnerami;
  3. bezpośredni przodkowie przez oboje rodziców do głębokości **Przodkowie**;
  4. rodzeństwo, także przyrodnie (ich drugiego rodzica się nie dodaje), z partnerami i potomkami do głębokości
     Potomkowie;
  5. ciotki i wujowie (rodzeństwo rodziców) z partnerami;
  6. kuzyni i kuzynki, czyli dzieci ciotek i wujów zapisane w ich związku, z potomkami do głębokości Potomkowie.
- **Granice:** przodków partnera osoby w centrum nie dodaje się do wyboru nigdy. Kto nie należy do otoczenia,
  zostaje w drzewie, tylko widok go nie pokazuje; pokaże go nowa osoba w centrum.
- **Głębokość:** po wyborze nowej osoby w centrum Przodkowie i Potomkowie są ustawione na największą głębokość, jaką
  drzewo ma przy tej osobie. Menu daje od 1 do tej największej głębokości. Dzieci partnera z innego związku dodają
  jedno pokolenie w dół.
- **Obsługa:** kliknięcie karty osoby; opcje **Przodkowie** i **Potomkowie** na pasku widoku.
- **Obowiązuje od:** aplikacja 1.0.0

<!-- zdroj: app:src/layout/pipeline/1-select-subgraph.ts selectSubgraph · src/layout/pipeline/index.ts:962 includeSpouseAncestors: false · src/renderer.ts:719 computeTreeLayout, setFocus (maxGenerations) · src/focus-depth.ts maxAncestorDepth, maxDescendantDepth · strings.ts focus.ancestorsLabel, focus.descendantsLabel -->

<a id="A6.1.1"></a>
### A6.1.1 Domyślna osoba i widok

Z czym otwiera się drzewo, określa ustawienie drzewa **Domyślna osoba i widok**.

| Opcja | Możliwości |
|---|---|
| osoba | **Ostatnio wyświetlana** · **Konkretna osoba:** (wybrana) |
| widok | **Rodzina** · **Ostatnio używany** (na tym urządzeniu) |

- **Granice:** bez ustawienia drzewo otwiera się na pierwszej osobie drzewa. Odświeżenie strony zachowuje drzewo,
  widok i osobę w centrum.
- **Obsługa:** zarządzanie drzewami, przy drzewie **Domyślna osoba i widok**.
- **Obowiązuje od:** domyślna osoba aplikacja 1.0.0; wybór widoku i odświeżenie strony aplikacja 3.21.0

<!-- zdroj: app:src/renderer.ts:1178 findDefaultFocusPerson, getStartupFocus · strings.ts treeManager.defaultPersonViewTitle, focus.defaultPersonLastFocused, focus.defaultPersonSpecific, focus.defaultViewFamily, focus.defaultViewLast · CHANGELOG.cs.md 3.21.0 -->

<a id="A6.2"></a>
## A6.2 Widok Potomkowie

Widok Potomkowie pokazuje tylko osobę w centrum i jej potomków do głębokości Potomkowie: bez przodków, ciotek, wujów
i kuzynów.

- **Tylko krewni** (domyślnie): potomkowie osoby w centrum związani krwią.
- **Pełne rodziny**: dodatkowo kolejne związki partnerów i ich dzieci nie z tej krwi, przygaszone.
- **Obsługa:** przełącznik na pasku widoku; opcję domyślną przechowuje ustawienie **Widok Potomkowie**.
- **Obowiązuje od:** widok aplikacja 1.4.0; Pełne rodziny aplikacja 1.9.2

<!-- zdroj: app:src/layout/pipeline/index.ts includeAuntsUncles: !descendantsOnly, expandLineageOnly: descendantsOnly && !isDescendantsFullFamilies() · strings.ts viewModeSwitch.bloodOnly, viewModeSwitch.fullFamilies, viewModeSwitch.settingLabel · settings descendantsFullFamilies (výchozí false) -->

<a id="A6.3"></a>
## A6.3 Oś czasu

Oś czasu pokazuje osoby widoku jako paski życia na osi lat.

- Wiersz dostaje tylko osoba z rokiem urodzenia. Pozostałe widok policzy i napisze „N osoby bez roku urodzenia nie
  są wyświetlane”. Osoby zastępcze (puste miejsce dla nieznanego rodzica) się pomija.
- Kolejność wierszy: rok urodzenia, potem imię i nazwisko bez tytułów.
- Pasek osoby żyjącej sięga do dziś. Zmarła osoba bez daty zgonu ma pasek do ostatniego znanego zdarzenia i otwarty
  koniec.
- Rok ślubu bierze się z daty początku związku. Oś jest zaokrąglona do dziesięcioleci.
- Pod osią lat biegnie wiersz historii osoby w centrum (wydarzenia epoki i miejsc jej życia, symbole rodzajów). Bez
  badania lub bez takich wydarzeń wiersza nie ma.
- **Obowiązuje od:** oś czasu aplikacja 1.5.0; wiersz historii aplikacja 3.19.0

<!-- zdroj: app:src/timeline.ts computeTimelineModel, :59 TimelineHistory · strings.ts timeline.omitted · CHANGELOG.cs.md 3.19.0 -->

<a id="A6.4"></a>
## A6.4 Wachlarz

Wachlarz pokazuje przodków osoby w centrum w wycinkach koła, pokolenie po pokoleniu.

- **Kształt:** **Półkole** · **Pełne koło** · **Dwustronny** (przodkowie i potomkowie).
- **Pokolenia** przodków 3–10, domyślnie 5. W kształcie Dwustronny **Potomkowie** 1–5, domyślnie 3.
- Numeracja przodków: 1 to osoba w centrum, ojciec osoby n ma numer 2n, matka 2n+1. Linia ojca jest po lewej.
  Numery przy wycinkach włącza ustawienie **Wachlarz** „Wyświetlanie numerów Kekulégo (ahnentafel) przodków”
  (domyślnie wyłączone).
- Rodzice to pierwsi dwoje zapisanych rodziców osoby. Relacja, która nie jest biologiczna (adopcja, przybrany
  rodzic, rodzic zastępczy), jest przy wycinku oznaczona.
- Przodek, który pojawia się w wachlarzu drugi raz, jest rysowany ponownie, ale dalej się nie rozwija; legenda
  **↻ powtarza się (implex)**. Opcja **Pokaż pierwsze wystąpienie** przeskakuje do jego pierwszego miejsca.
- Potomkowie (kształt Dwustronny): związki w kolejności ślubów (data ślubu, potem kolejność w danych), dzieci według
  urodzenia. Nieznany partner zbiera dzieci bez drugiego rodzica. Związek bez dzieci jest widoczny tylko przy osobie
  w centrum.
- **Kolory:** **Płeć** · **Linie** (cztery linie dziadków: ojciec ojca, matka ojca, ojciec matki, matka matki) ·
  **Rody** ([A4](A4-surnames-and-families.md)).
- **Osoba wyjściowa** wraca wachlarzem do osoby, od której się zaczęło.
- **Obowiązuje od:** wachlarz aplikacja 1.8.0; nowy wachlarz z kształtami, kolorami i implexem aplikacja 3.20.0

<!-- zdroj: app:src/fan-chart.ts FAN_MIN_GENERATIONS, FAN_MAX_GENERATIONS, FAN_DEFAULT_GENERATIONS, parentSlots, repeatOf · strings.ts fan.shapeHalf, fan.shapeFull, fan.shapeTwo, fan.colorGender, fan.colorLine, fan.colorRod, fan.legendRepeats, fan.originPerson, fan.showFirst, fanChart.kekuleHint · settings fanKekule (výchozí false) · spec 029 · CHANGELOG.cs.md 3.20.0 -->

<a id="A6.5"></a>
## A6.5 Mapa

Mapa pokazuje miejsca zdarzeń osób.

- **Zakres:** **Ten widok** (domyślnie, osoby widoku) · **Całe drzewo**.
- **Rodzaje:** **Urodzenia** · **Zgony** · **Śluby** · **Inne wydarzenia**. Domyślnie włączone są wszystkie; wybór
  zapamiętuje się na urządzeniu.
  - Chrzest liczy się do urodzenia, pochówek i kremacja do zgonu.
  - Zaręczyny, zapowiedzi, zezwolenie na ślub i intercyza liczą się do ślubu. Pozostałe zdarzenia pary to Inne
    wydarzenia.
- Miejsce ślubu pokazuje się, gdy w widoku jest co najmniej jedno z partnerów.
- Miejsce pisze się w najczęstszym zapisie. Miejscowość to jeden punkt także z numerami domów; miejsce z własnymi
  dokładnymi współrzędnymi zostaje osobnym punktem.
- **Obowiązuje od:** mapa aplikacja 1.10.0; rodzaje zdarzeń i punkty miejscowości aplikacja 3.21.0

<!-- zdroj: app:src/places.ts collectPlaces, groupTownPoints · src/ui/map-ui.ts (localStorage strom.map.kinds) · strings.ts map.scopeView, map.scopeTree, map.kinds · CHANGELOG.cs.md 3.21.0 -->

<a id="A6.5.1"></a>
### A6.5.1 Skąd mapa bierze położenie miejsca

We własnym drzewie (bez badania) położenie miejsc odszukuje sama aplikacja, w usłudze OpenStreetMap (Nominatim).
Wysyła tylko nazwę miejsca tak, jak jest zapisana w drzewie, i tylko za zgodą. W drzewie z badania miejsca identyfikuje
badanie ([R4](R4-places.md)).

- **Granice:**
  - przed pierwszym wyszukiwaniem aplikacja pyta (**Odszukać współrzędne online?**). Wychodzą tylko nazwy miejsc,
    żadne imiona, daty ani relacje. Najwyżej jedno zapytanie mniej więcej na sekundę;
  - współrzędne zapisują się w drzewie: każde miejsce wyszukuje się raz, a mapa działa potem także bez połączenia;
  - automatyczne wyszukiwanie bierze **pierwszy wynik** usługi dla zapisanej nazwy. Do aplikacji 3.23.0 nie
    rozróżniało przy tym miejscowości o tej samej nazwie: miejsce mogło więc trafić do miejscowości o tej samej nazwie
    gdzie indziej. Położenie, które do drzewa nie pasuje, oznacza **Do sprawdzenia** ([R4.4.1](R4-places.md#R4.4.1));
  - tylko miejsce z numerem domu, którego usługa nie znalazła, wyszukuje się według miejscowości. Spośród miejscowości
    o tej nazwie wybiera się tę najbliższą innym miejscom drzewa („Miejscowość o tej nazwie występuje kilka razy;
    wybrano tę najbliższą innym miejscom drzewa.”); przy miejscu stoi **Położenie według miejscowości**;
  - **od aplikacji 3.24.0** najbliższą miejscowość wybiera się przy każdym miejscu: gdy dwie lub więcej miejscowości
    nazywa się dokładnie tak jak zapisane miejsce (bez względu na wielkość liter i znaki diakrytyczne), bierze się tę
    najbliższą środka drzewa, nie pierwszy wynik. Środek to mediana położeń wprowadzonych ręcznie lub potwierdzonych
    **Zachowaj**, gdy jest ich co najmniej 3; w przeciwnym razie mediana wszystkich położeń drzewa i miejsc, które
    wyszukiwanie znalazło bez wątpliwości. Miejsce z dalszym określeniem („Lhota u Kolína”, „Lhota 16”), jedyna
    miejscowość lub drzewo bez położeń dostaje pierwszy wynik jak wcześniej. Nadal jest to jedno zapytanie na miejsce;
  - kontrola miejsca mówi, ile miejscowości o tej nazwie mapa znalazła („Mapa znalazła 3 miejscowości o tej nazwie
    i wybrała tę najbliższą innym miejscom drzewa.”); od aplikacji 3.24.0, wcześniej zawsze „dwie”;
  - położenie, które już jest w drzewie, się nie przesuwa: wyszukiwanie szuka tylko miejsc bez położenia. Także
    scalenie z innym drzewem lub plikiem GEDCOM nie nadpisuje położenia wprowadzonego ręcznie lub potwierdzonego
    **Zachowaj**, tylko uzupełnia brakujące. Złe starsze położenie można przesunąć tylko ręcznie;
  - czego się nie znajdzie, zostaje bez położenia. Aplikacja niczego nie zgaduje: „pomoże poprawienie zapisu lub
    dodanie kraju”.
- **Obsługa:** aplikacja: **Ustawienia → Wyszukiwanie miejsc online**; w oknie miejsc **Złe miejsce? Popraw**,
  **Znajdź to miejsce pod inną nazwą** (dołącza się tylko położenie, zapis w drzewie się nie zmienia), **Użyj też dla
  innych numerów domów w miejscowości …**, **Wyczyść osierocone miejsca (n)**.
- **Dlaczego:** wyszukiwanie miejsc to jedyna część aplikacji, która coś wysyła na zewnątrz; dlatego tylko za zgodą,
  tylko nazwy i każde miejsce raz (komentarz w kodzie). Limit jednego zapytania na sekundę to warunek usługi.
- **Obowiązuje od:** aplikacja 1.10.0; **Złe miejsce? Popraw** 1.10.1; **Wyczyść osierocone miejsca** 2.1.0; położenie
  według miejscowości 3.21.0; najbliższa miejscowość o tej samej nazwie przy każdym miejscu i liczba miejscowości
  w kontroli 3.24.0

<!-- zdroj: app:src/geocode.ts hlavička, REQUEST_INTERVAL_MS=1100, geocodePlace (limit 1, parseGeocodeResponse první výsledek), geocodeTown/pickTownHit nearestTo (od v3.21.0), geocodePlaces townFallback · app:src/strings.ts map.consentTitle, consentBody, settingLabel, wrongSpot (v1.10.1), searchLabel, attachOnly, useForOthers, cleanOrphans (v2.1.0), nearestTown, byTown, doneWithMisses · FB podnět 2026-11-04 (stejnojmenná obec) · od 3.24.0: geocode.ts treeCenter (medián, PERSONS_CENTER_MIN=3), sameNamedTowns, pickPlaceHit (townChoices), buildGeocodeUrl limit · place-check.ts multi count · strings.ts checkMulti(n) · merge-executor test (ruční poloha zůstane) · commit 046967d -->

<a id="A6.5.2"></a>
### A6.5.2 Odszukanie miejsc poza mapą w badaniu

Przy drzewie z badaniem pasek stanu mapy oferuje miejsca bez położenia do odszukania w badaniu
([R4.4](R4-places.md#R4.4)). Przycisk otwiera okno **Miejsca** z podglądem; do kolejki badania miejsca trafiają
dopiero po **Dodaj do kolejki**.

- **Granice:**
  - przed wyszukaniem na mapie jest na pasku obok wyszukiwania mapy **W badaniu**. Po wyszukaniu, gdy mapa części
    miejsc nie znalazła, pasek pokazuje „N miejsc na mapie · mapa nie znalazła K” i **Odszukaj w badaniu (K)**,
    ewentualnie „N do potwierdzenia ›” (otwiera **Czeka** w panelu badania);
  - przycisk jest tylko przy drzewie z badaniem i tylko wtedy, gdy jest co odszukać: miejsce bez położenia albo
    nieustalone, którego jeszcze nie ma w kolejce, nad którym się nie pracuje i które nie czeka na odpowiedź;
  - okno **Miejsca** pokazuje podgląd „Odszukaj w badaniu N miejsc poza mapą”. Przed **Dodaj do kolejki N miejsc**
    nic nie trafia do kolejki i żadne miejsce nie trafia tam dwa razy;
  - gdy badanie działa na innym komputerze albo na telefonie, aplikacja zamiast okna mówi, gdzie odszukanie działa:
    „Odszukać i sprawdzić można w badaniu na komputerze, na którym jest uruchomione. Stan miejsc przenosi się tutaj
    razem z drzewem.”, na telefonie „Odszukać i sprawdzić można na komputerze z badaniem. Na pytania o miejsca można
    odpowiedzieć także tutaj, w zakładce Czeka.” Starsze badanie: „Ta wersja badania jeszcze nie wyszukuje miejsc.”;
  - przy śledzeniu badania na mapie ([S4.1.3](S4-research-from-the-app.md#S4.1.3)) wiersz „… – bez położenia na
    mapie” oferuje **Odszukaj w badaniu**: dodaje to jedno miejsce do kolejki od razu, bez podglądu; dodanie można
    cofnąć w komunikacie.
- **Obsługa:** aplikacja: mapa → pasek stanu → **W badaniu**, po wyszukaniu na mapie **Odszukaj w badaniu (K)** →
  okno **Miejsca** → **Dodaj do kolejki N miejsc**.
- **Obowiązuje od:** aplikacja 3.25.0

<!-- zdroj: app:src/ui/map-ui.ts (stavový pruh, lookResearch, lookable), src/ui/place-actions.ts, src/ui/places-research-ui.ts (bulkLook, bulkLookHead, bulkLookGo, nic dvakrát), src/ui/map-follow-ui.ts (noCoords + places.research.look, Undo) · strings.ts map.onMap.notFound, lookResearch, lookResearchShort, lookResearchTitle, confirm; places.dialog.elsewhere, phoneLine, oldResearch · CHANGELOG.cs.md 3.25.0 · commit 2246ca28 · spec 058 -->

<a id="A6.6"></a>
## A6.6 Ród w widoku

Widok może wyróżnić jeden ród ([A4](A4-surnames-and-families.md)): jego członków w pełni, żony i mężów, którzy
weszli do rodu przez małżeństwo, słabiej, pozostałych przygaszonych. Działa w widokach Rodzina, Potomkowie
i Wachlarz.

- Wybór zapamiętuje się dla każdego drzewa na urządzeniu. Ród, którego w drzewie już nie ma, anuluje się po cichu.
- Gdy w widoku nie jest narysowany żaden członek rodu:
  - Rodzina i Wachlarz przesuwają osobę w centrum na najbliższego członka rodu (przez rodziców, dzieci i partnerów;
    przy remisie na starszego), a gdy osoba nie jest z nim połączona, na założyciela rodu;
  - Potomkowie przesuwają osobę w centrum zawsze na założyciela;
  - pasek proponuje **↩ Wróć**.
- **Granice:** przywrócenie wyboru z pamięci nie przesuwa osoby w centrum.
- **Obsługa:** **Rody** na pasku; w menu osoby **Tylko ród …** (ród z urodzenia osoby jest pierwszy); koniec przez
  × przy etykiecie lub **Pokaż całe drzewo**.
- **Obowiązuje od:** aplikacja 3.21.0

<!-- zdroj: app:src/ui/rod-view.ts · src/rod-focus.ts (BFS přes rodiče, děti, partnery) · strings.ts rodView.only, rodView.whole, rodView.moved · spec 039 · CHANGELOG.cs.md 3.21.0 -->
