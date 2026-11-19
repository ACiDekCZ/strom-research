<a id="A6"></a>
# A6 Widoki i wybór osób

Jak aplikacja Strom wybiera, które osoby pokaże, i jak pokazują je poszczególne widoki. Opisuje aplikację
3.21.2; zmiany z nowszej wersji mają przy sobie jej numer.

Widok to inne odczytanie **tego samego wyboru osób**. Wybór określa osoba w centrum (ta, którą się kliknie)
i głębokość **Przodkowie** oraz **Potomkowie**. Rodzina, Potomkowie, Oś czasu i Mapa pokazują to samo otoczenie
osoby w centrum. Wachlarz liczy przodków i potomków sam według liczby pokoleń ([A6.4](#A6.4)). Tabela pokazuje
całe drzewo ([A6.7](#A6.7)), od aplikacji 3.30.0 także tylko jedną listę osób ([A6.7.19](#A6.7.19)).
Na komputerze każdy widok można otworzyć także w osobnym oknie ([A6.8](#A6.8)).

Widoki: **Rodzina**, **Potomkowie**, **Oś czasu**, **Wachlarz**, **Mapa**, **Tabela**.

<!-- zdroj: app:src/types.ts:1237 ViewMode · strings.ts viewModeSwitch.* · Tabulka od aplikace 3.27.0 (viewModeSwitch.table) -->

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

<a id="A6.1.2"></a>
### A6.1.2 Odstępy: Normalne i Gęste

Ustawienie **Odstępy** określa odstępy między kartami i między pokoleniami w widokach Rodzina i Potomkowie. **Gęste**
je zmniejsza, aby na ekranie zmieściło się więcej osób. **Normalne** jest domyślne, także na telefonie.

| Odstęp | Normalne | Gęste |
|---|---|---|
| między kartami obok siebie | 31 px | 20 px |
| między pokoleniami | 80 px | 48 px |
| między partnerami | 18 px | 14 px |

- Po przełączeniu drzewo od razu się przerysuje i zostaje przy tej samej osobie: przy karcie osoby w centrum, gdy jest
  cała widoczna, w przeciwnym razie przy karcie najbliższej środka. Tak samo drzewo zachowuje się po zmianie
  **Szczegóły kart**.
- **Kolejność małżeństwa:** w Gęste zamiast pigułki „1. ∞ 1866” jest tylko krótkie „∞ 1” na brzegu karty, czyli
  kolejność tego małżeństwa. Całą kolejność pokazuje dymek (myszą, klawiaturą i stuknięciem). Pigułka, która nie ma
  przy karcie miejsca, nie jest rysowana.
- **Eksport:** eksport plakatu ma własne ustawienie **Odstępy** (za formatem papieru i orientacją). Gdy różni się od
  ekranu, obraz, plakat i PDF w arkuszach układają się na nowo z wybranymi odstępami, z tym samym wyborem osób i tymi
  samymi kartami; ekran się nie zmienia. Pod każdą opcją jest liczba arkuszy („26 arkuszy A4”), gdy liczby się różnią.
  Druk (Ctrl+P) bierze odstępy ekranu.
- **Granice:** ustawienie należy do urządzenia i nie zapisuje się z drzewem. Oś czasu, Wachlarz, Mapa i Tabela mają
  własny układ i ustawienie ich nie dotyczy; eksport plakatu z Wachlarza i Osi czasu nie ma wiersza **Odstępy**.
- **Obsługa:** **Ustawienia** → **Karta osoby** → **Odstępy** (za **Szczegóły kart**): **Normalne** · **Gęste**. Na
  małym ekranie bez kompaktowej karty pod ustawieniem jest „Na małym ekranie pomogą też karty Kompaktowe.” Eksport:
  **Eksport plakatu** → **Odstępy**.
- **Obowiązuje od:** aplikacja 3.27.0

<!-- zdroj: app:src/types.ts TreeSpacing, DEFAULT_LAYOUT_CONFIG (31/80/18), DENSE_LAYOUT_CONFIG (20/48/14), layoutConfigFor · src/settings.ts getTreeSpacing/setTreeSpacing (treeSpacing), getPosterSpacing/setPosterSpacing (posterSpacing), výchozí normal · src/renderer.ts:804 STANDALONE_VIEWS (timeline, fan, map, table), getPosterLayout({spacing}), kotva překreslení (ústřední karta celá v obraze, jinak nejbližší středu; i při změně typu karty) · src/marriage-order.ts (husté: „∞ N“ na okraji karty, bez místa se nekreslí) · src/ui/export-image-ui.ts (řádek za formátem a orientací, skrytý u vějíře a časové osy, sheetsCount) · strings.ts spacing.label, normal, dense, desc, scope, scopeExport, smallHint, marriageOrder.short, poster.menu, poster.sheetsCount, settings.groupCard, cardDensity.settingLabel · commity 68b9dde4, 03918007, 928db183, e2891a8a · spec 069 K1.1, K3.1 -->

<a id="A6.1.3"></a>
### A6.1.3 Dzieci i rodzeństwo naraz

W widoku Rodzina jednym krokiem można pokazać na miejscu dzieci osoby oraz rodzeństwo osoby i jej przodków. Fokus,
głębokość i powiększenie zostają, karta osoby stoi w tym samym miejscu ekranu.

- **Kto dojdzie:**
  - dzieci osoby (nie wnuki);
  - rodzeństwo osoby i każdego jej przodka, który jest w widoku i którego rodzice są w widoku. Górny rząd głębokości
    **Przodkowie** się nie rozwija (jego rodzeństwo przyniosłoby nowe pokolenie, to zadanie głębokości); przy nim
    zostaje „▸ rodzice”;
  - rodzeństwo to dzieci rodziców w widoku ze wszystkich małżeństw, tak samo jak przy pojedynczym „Pokaż rodzeństwo
    tutaj”. Z dziećmi dochodzi ich drugi rodzic, partnerzy, których widok z nimi rysuje, i to, co pod nimi trzyma
    głębokość **Potomkowie**.
- **Liczba +n:** ile kart krok doda; liczy ją ten sam układ co widok, więc po kroku dochodzi dokładnie n kart. Liczy
  się na nowo po każdym rysowaniu.
- **Granice:**
  - krok to jeden układ, jeden krok historii i jeden krok **Ukryj pokazane · n** (n + 1). Cofa go **Wstecz**
    w historii, **Ukryj pokazane** (cofa wszystko pokazane) albo ponownie ta sama opcja („Zwiń dzieci
    i rodzeństwo”);
  - na dotkniętych kartach są zakładki „▾ dzieci” i „▾ rodzeństwo”, a pojedyncze rodziny można dalej zwijać po
    jednej;
  - nowa osoba w fokusie, inny widok lub drzewo krok anulują. Zmiana głębokości **Przodkowie** lub **Potomkowie**
    kończy wszystkie kroki „naraz”: ich karty znikają, rodziny pokazane po jednej zostają, a opcja proponuje „+n”
    nowej głębokości;
  - powyżej 150 osób aplikacja najpierw pyta w dymku: „Dojdzie n osób”, „Drzewo poszerzy się do ok. k szerokości
    ekranu. Powiększenie się nie zmienia.” (k z rzeczywistego układu przy obecnym powiększeniu, zaokrąglone w górę)
    i przyciski **Rozwiń +n**, **Tylko 2 pokolenia przodków +m** (tylko rodzeństwo osoby, rodziców i dziadków; brak,
    gdy m to n lub 0) i **Anuluj**. Esc, kliknięcie obok lub zmiana rozmiaru okna = Anuluj. Do 150 osób bez pytania.
- **Obsługa:** aplikacja, widok Rodzina:
  - pasek widoku, zaraz za opcjami **Przodkowie** i **Potomkowie**: **Dzieci i rodzeństwo +n** dla osoby w fokusie.
    Włączony krok pokazuje ✓, a kliknięcie go cofa; gdy nie ma czego dodać, opcja jest wyciszona („Wszystkie dzieci
    i rodzeństwo są już widoczne”). Na tablecie ikona i „+n”; gdy nie mieści się na pasku, ustępuje (menu osoby ma ją
    nadal). Telefon nie ma opcji na pasku;
  - menu osoby (na dotyku dolny panel osoby) pod wierszami, które pokazują na miejscu rodziców, rodzeństwo i dzieci:
    **Rozwiń dzieci i rodzeństwo · +n** z podwierszem „dzieci osoby, rodzeństwo osoby i jej przodków”, tylko gdy jest
    co dodać; gdy krok osoby stoi, **Zwiń dzieci i rodzeństwo**. U osoby w fokusie to ten sam krok co na pasku.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:f5d56ed3 src/bulk-family.ts collectBulkFamily (childrenOf osoba; siblingsOf osoba a předci v pohledu s rodiči v pohledu; maxGeneration), bulkParents, bulkNewIds (drawnPersonIds, kroky 1–5 pipeline), BULK_CONFIRM_ABOVE 150, BULK_TWO_GENERATIONS 2 · src/renderer.ts bulkFamilyPlan (jen family), bulkFamilyState (offer/on/none), bulkFamilyScreens (ceil šířka × zoom / plátno), showBulkFamily → showChildrenOf (jeden krok historie, zoom beze změny, kotva), undoBulkFamily, bulkStepOf (jen při stejné hloubce), forgetBulkSteps při změně hloubky, resetChildrenShown při změně fokusu, pohledu, stromu, hiddenShownCount (+1 za krok) · src/ui/bulk-family-ui.ts confirmBulkFamily (Esc, klik vedle, resize = zrušit; two jen m > 0 a m ≠ n), runBulkFamily, updateBulkFamilySwitches (title treeTip/menuOff/treeNone, aria-disabled) · src/ui/context-menu.ts bulkFamilyRows (offer: menu, +n, menuSub; on: menuOff) · src/ui/toolbar-fit.ts (tablet: přepínač ustoupí před hledáním, f5d56ed3) · index.html button.bulk-family (telefon skrytý) · strings.ts bulk.*, menu.showChildrenHere, showSiblingsHere, focusBar hideAllShown, history back · app 2eb013ba, cecea43f, 8dc34565, f5d56ed3 · dirigent:prace/1113-app-drobnosti-1112 · ZADANI_DEV_drobnosti-1112 §3 -->

<a id="A6.1.4"></a>
### A6.1.4 Zdjęcie na karcie

Ustawienie **Zdjęcie na karcie** określa rozmiar i kształt zdjęcia osoby na karcie w drzewie. Domyślne **Małe**
i **Koło** zostawiają kartę jak dotąd.

| | **Małe** | **Średnie** | **Duże** |
|---|---|---|---|
| karta **Normalne** | 188 × 64 px | 200 × 64 px | 236 × 96 px |
| zdjęcie na karcie **Normalne** | 34 px | 48 px | 80 px |
| zdjęcie w nagłówku karty **Szczegółowe**, **Metrykalne**, **Własne** | 30 px | 44 px | 72 px |

- Większa karta jest tylko w widoku, w którym co najmniej jedna pokazana osoba ma zdjęcie. Karty bez zdjęcia są w tym
  widoku tak samo szerokie, z małymi inicjałami, a imiona w rzędzie stoją na tej samej wysokości. Widok bez zdjęć ma
  karty 188 × 64 px.
- Karta **Normalne** ma zdjęcie obok imienia. **Szczegółowe**, **Metrykalne** i **Własne** mają je w nagłówku obok
  imienia i lat, wiersze danych pod nim na pełną szerokość; karta jest wyższa o zdjęcie (**Własne** 70 lub 98 px
  i 17 px na wiersz zamiast 56 px).
- **Od aplikacji 3.30.0:** wybrany rozmiar dotyczy każdej karty z awatarem, ze zdjęciem i bez. Inicjały karty bez
  zdjęcia mają rozmiar i kształt zdjęcia (**Normalne** 48 lub 80 px, w nagłówku karty 44 lub 72 px) i proporcjonalną
  czcionkę (17 i 29 px, w nagłówku 16 i 26 px). Widok ma większe karty, gdy tylko jest w nim co najmniej jedna karta
  z awatarem (wcześniej tylko ze zdjęciem); osoba zastępcza awatara nie ma. Eksport obrazu, plakat i jego PDF rysują
  inicjały tak samo. **Małe** wygląda jak dotąd. Zdanie pod ustawieniem: „Osoby bez zdjęcia mają inicjały w tym samym
  rozmiarze. Dotyczy drzewa, eksportu obrazu i plakatu na tym urządzeniu.”
- **Kształt:** **Koło** albo **Zaokrąglony kwadrat** (zaokrąglenie 12 px przy dużym zdjęciu, 5 px przy małym; tak
  samo inicjały). Znaczniki karty stoją na brzegu zdjęcia w obu kształtach.
- **Eksport:** eksport obrazu, plakat i jego PDF na wielu arkuszach ([A7](A7-book-pages-and-export.md)) rysują karty
  z wybranym rozmiarem i kształtem zdjęcia jak ekran: karta **Normalne** ma wymiar jak na ekranie, **Szczegółowe**
  i **Metrykalne** mają zdjęcie po lewej w nagłówku. Zdjęcie ukryte dla osoby żyjącej zostawia na karcie inicjały.
  Wynik, w którym nikt nie ma zdjęcia, oraz domyślne **Małe** z **Koło** wyglądają jak dotąd. Zdanie pod
  ustawieniem: „Dotyczy drzewa, eksportu obrazu i plakatu na tym urządzeniu.”
- **Granice:** karta **Kompaktowe** nie ma zdjęcia: wiersz zostaje, opcje są wyłączone, a pod nimi jest „Karta
  kompaktowa nie ma zdjęcia.”; wybrany rozmiar się zachowuje. Ustawienie należy do urządzenia i nie zapisuje się
  z drzewem. Podgląd w ustawieniach pokazuje wymiar karty („karta 236 × 96 px”).
- **Obsługa:** **Ustawienia** → **Karta osoby** → **Zdjęcie na karcie** (między **Szczegóły kart** a podglądem):
  **Rozmiar** **Małe** · **Średnie** · **Duże**; **Kształt** **Koło** · **Zaokrąglony kwadrat**.
- **Obowiązuje od:** aplikacja 3.29.0; 3.30.0: inicjały w rozmiarze zdjęcia

<!-- zdroj: app:28480ea1 src/types.ts NORMAL_PHOTO_BOX (188×64/34, 200×64/48, 236×96/80), src/settings.ts (zařízení, výchozí small + circle), src/ui/card-fields-ui.ts, src/renderer.ts · b71d561a src/card-width.ts cardAvatarSize (30/44/72), výška Vlastní 70/98 + 17 na řádek · strings.ts cardDensity.photoTitle, photoSize, photoSmall, photoMedium, photoLarge, photoShape, photoCircle, photoRounded, photoCompact, size · CHANGELOG.cs.md 3.29.0 „Fotka na kartě“ · dirigent:test/vysledek-1115-app-096-fotka.md · spec 096 P1 · export: app:64ae50ca src/export-image.ts, src/renderer.ts (poster, PDF po listech; výchozí small + circle bajt po bajtu jako dřív), strings.ts cardDensity.photoScope · spec 096 P2 · 3.30.0: app:0bed2a88 src/types.ts NORMAL_PHOTO_BOX (avatar = fotka i iniciály), src/renderer.ts viewHasAvatar (dřív viewHasPhoto), src/card-width.ts normalCardTextWidth (126 px u každého avataru), avatarInitialsSize (avatar × 0,36: 17/29, 16/26), src/export-image.ts getPosterCardPhoto (každá karta s avatarem), strings.ts cardDensity.photoScope · e2e/card-photo.spec.ts, poster-card-photo.spec.ts · CHANGELOG.cs.md 3.30.0 „Fotka na kartě“ · spec 103 K2.1–K2.3 · dirigent:test/vysledek-1116-app-103-tabulka.md -->

<a id="A6.1.5"></a>
### A6.1.5 Oznaczenie linii

Oznaczenie linii oznacza karty w drzewie według tego, do której linii należy osoba względem osoby w centrum
(w ustawieniach „wybrana osoba”): **ojcowska**, **matczyna**, **potomkowie**. Domyślny jest **Łuk** na lewej krawędzi
karty.

| Opcja | Jak wygląda oznaczenie | Drugi znak oprócz koloru |
|---|---|---|
| **Łuk** (domyślnie) | pasek wzdłuż lewej krawędzi karty | brak |
| **Etykieta z literą** | etykieta nachodząca na lewą krawędź karty | litera: O ojcowska, M matczyna, P potomkowie |
| **Pasek** | pionowy pasek przy lewej krawędzi | ojcowska ciągły, matczyna kreskowany, potomkowie kropkowany |
| **Narożnik** | trójkąt w lewym górnym rogu | ojcowska pełny, matczyna szrafowany, potomkowie konturowy |
| **Bez kształtu** | bez oznaczenia; przy włączonym podbarwieniu linię oznacza tylko tło karty | – |

- **Kolory:** ojcowska niebieska, matczyna różowa, potomkowie ochrowa. Jedna stała paleta, bez wyboru. Kolory różnią
  się też jasnością (ojcowska ciemna, potomkowie średnia, matczyna jasna), więc da się je rozróżnić także przy
  słabszym rozróżnianiu barw i w odcieniach szarości. Ciemny wygląd ma własne odcienie; jego podbarwienia mają
  jasność karty i różnią się odcieniem, więc trzy linie i kartę podbarwioną od niepodbarwionej da się rozróżnić także
  bez kształtu. Tekst karty ma na każdym podbarwieniu kontrast co najmniej 4,5:1.
- **Podbarwiaj karty kolorem linii** (domyślnie wyłączone) lekko podbarwia kartę kolorem linii. To osobny przełącznik,
  działa z każdym kształtem i z **Bez kształtu**:
  - kształt z podbarwieniem: oznaczenie i tło;
  - **Bez kształtu** z podbarwieniem: kartę oznacza tylko tło;
  - **Bez kształtu** bez podbarwienia: karty w ogóle nie oznaczają linii.
- **Kto ma oznaczenie:**
  - linia ojcowska i matczyna: rodzic, wszyscy jego przodkowie i rodzeństwo każdego z nich (ciotki, wujowie,
    rodzeństwo dziadków…);
  - potomkowie: wszyscy potomkowie osoby w centrum;
  - bez oznaczenia są osoba w centrum, partnerzy (także partnerzy potomków i przybrani rodzice), rodzeństwo osoby
    w centrum, kuzyni i kuzynki oraz osoby zastępcze (puste miejsce dla nieznanego rodzica).
- **Osoba w obu liniach** (na przykład przodek z małżeństwa krewnych) ma oba oznaczenia: **Łuk**, **Pasek**
  i **Narożnik** podzielone na połowę ojcowską i matczyną, **Etykieta z literą** dwie etykiety jedna nad drugą. Do
  3.29.0 dostawała tylko ojcowskie.
- **Rodzice tej samej płci** (oboje rodzice osoby w centrum znani, obaj mężczyźni albo obie kobiety): linie nazywają
  się **Linia 1. rodzica** i **Linia 2. rodzica**, etykieta ma 1 i 2, kolory zostają.
- **Legenda drzewa** (widoki Rodzina i Potomkowie, ustawienie **Legenda drzewa**): obwódki płci, próbka każdej linii
  w wybranym kształcie z nazwą i wiersz „Bez oznaczenia: wybrana osoba, partnerzy, rodzeństwo, kuzyni”. Przy
  **Bez kształtu** z podbarwieniem próbki są kwadracikami podbarwienia w ramce w kolorze linii (tak samo
  w Ustawieniach), bez podbarwienia części o liniach nie ma. Zwijanie legendy: [A9.6](A9-using-the-app.md#A9.6).
- **Czytnik ekranu** odczytuje przy karcie linię słowami („linia ojcowska”, „linia ojcowska i matczyna”, „potomek”,
  „linia 1. rodzica”).
- **To samo oznaczenie gdzie indziej:** Oś czasu ma znak linii przed imieniem ([A6.3](#A6.3)), Tabela kolumnę **Linia**
  ([A6.7.2](#A6.7.2)); Wachlarz w kolorach **Linie** ([A6.4](#A6.4)) i droga przodków na Mapie ([A6.5.5](#A6.5.5))
  mają te same odcienie. Przy **Bez kształtu** ani Oś czasu, ani Tabela nie mają znaku.
- **Eksport i druk:** eksport obrazu i plakat rysują wybrany kształt i podbarwienie, zawsze w jasnych kolorach.
  W druku z przeglądarki wszystkie karty mają tę samą szarą ramkę; płeć pokazuje obwódka przy zdjęciu lub
  inicjałach, linię oznaczenie. Oznaczenie drukuje się także bez drukowania tła, podbarwienie się nie drukuje
  (**Bez kształtu** z podbarwieniem w druku nic nie oznacza).
- **Granice:** oznaczenie jest tylko warstwą na brzegu karty, nie zmienia wymiaru ani treści karty. Linia liczy się
  na nowo przy każdej zmianie osoby w centrum. Ustawienie należy do urządzenia i nie zapisuje się z drzewem.
- **Obsługa:** **Ustawienia** → **Wyświetlanie drzewa** → **Oznaczenie linii**: **Łuk** · **Etykieta z literą** ·
  **Pasek** · **Narożnik** · **Bez kształtu**; pod tym **Podbarwiaj karty kolorem linii**. Każda opcja ma podgląd karty.
- **Obowiązuje od:** kolory gałęzi aplikacja 1.8.0 (pomarańczowy, niebieski i zielony); 3.30.0: **Oznaczenie linii**
  zamiast przełącznika **Kolory gałęzi**, nowe kolory, kształty, podbarwienie, oba oznaczenia, linie 1. i 2. rodzica.
  Włączone **Kolory gałęzi** przechodzą jako **Łuk**, wyłączone jako **Bez kształtu** bez podbarwienia.

<!-- zdroj: app:0e403ec6 src/branch-colors.ts classifyBranches (collectAncestorSide: předci + sourozenci každého předka; collectDescendants přes childIds; obě strany se sčítají R4; descendant jen mimo strany; focus smazán; numbered = oba rodiče známí a stejného pohlaví R5), src/settings.ts getBranchMarker (výchozí arc; branchColors false → off), isBranchTintOn (jen se značkou), isBranchTintChosen, save (migrace při prvním zápisu), src/renderer.ts renderCards (!isPlaceholder, viewMode ≠ timeline), src/branch-marker-attrs.ts (čtečka ariaPaternal/ariaBoth/ariaSlot1), index.html tokeny --branch-paternal #234e8c / --branch-maternal #d0679a / --branch-descendant #8a6400, tmavé #9cc2f2 / #f6a9cb / #e3b552, --branch-*-tint, CSS tvarů (arc, tag, stripe, corner; R4 .branch-paternal.branch-maternal) · app:c8afe382 index.html #branch-marker-setting (skupina settings.groupTree), #branch-tint-toggle, src/ui/branch-marker-ui.ts syncBranchLegend, src/ui/misc.ts (legenda jen family/descendants, isBranchLegendEnabled) · app:b94f3816 src/branch-marker-svg.ts, src/ui/export-image-ui.ts treeCardDrawing (branchMarker, branchTint, numbered; světlé hex), index.html @media print (R6: border 2px #999, white background, tiskové --branch-*, print-color-adjust) · strings.ts branchColors.* (settingLabel, markerArc…markerOff, defaultTag, tintLabel, legendPaternal…legendSlot2, legendNone, letterPaternal O, letterMaternal M, letterDescendant P) · barvy větví: app:6f86ad39 (v1.8.0) · CHANGELOG.cs.md 3.30.0 „Značení linií“ · dirigent:spec/112-znaceni-linii K1–K4, app:docs/ZADANI_DEV_linie-na-kartach.md R1–R6 · prace/1119-app-112-linie · Bez tvaru: app:999c373f src/types.ts BRANCH_MARKERS (none), src/settings.ts getBranchMarker (uložené off → none; branchColors false → none), isBranchTintOn (samostatně), isBranchMarkingOn, src/ui/branch-marker-ui.ts syncBranchLegend (none jen s podbarvením), src/branch-marker-attrs.ts, src/export-image.ts buildTreeSvg (none + tint = výplň karty), strings.ts branchColors.markerNone, tintHint · app:34aca82c index.html tmavé --branch-*-tint #172a41 / #3b1e2c / #372600 (světlost karty), světlé --text-faint #6a6254, .branch-swatch[data-shape="none"] rámeček var(--sw), src/__tests__/branch-tint-contrast.test.ts (4,5:1) · test/vysledek-1119-app-112-podbarveni -->

<a id="A6.1.6"></a>
### A6.1.6 Powrót do osoby domyślnej: ⌂

Przycisk ⌂ na początku **W centrum** ustawia w centrum osobę domyślną drzewa ([A6.1.1](#A6.1.1)), gdziekolwiek jest
centrum. Robi to samo co Ustaw w centrum przy karcie: nowy krok historii i powiadomienie „W centrum: {imię} · ↩ Wróć”;
**↩ Wróć**, strzałka ↩ w lewym dolnym rogu albo Alt+← przywraca poprzednie centrum.

| Ustawienie drzewa (**Domyślna osoba i widok**) | Kogo ⌂ ustawi w centrum |
|---|---|
| **Konkretna osoba:** | tę osobę; gdy nie ma jej już w drzewie, pierwszą osobę drzewa |
| **Ostatnio wyświetlana** | osobę, na której drzewo stanęło przy otwarciu (albo przy przełączeniu na to drzewo) |
| bez ustawienia | pierwszą osobę drzewa |

- **Gdzie jest ⌂:**
  - Rodzina: w **W centrum** na komputerze, na pasku na tablecie i na telefonie trzymanym poziomo, w panelu osoby na
    telefonie;
  - Potomkowie: na początku plakietki widoku;
  - Wachlarz: w lewym górnym rogu; przy przypiętym środku ([S4.1.3](S4-research-from-the-app.md#S4.1.3)) przed
    **Środek: {imię} · Odpiąć**, a przypięcie najpierw zwalnia.
- **Osoba domyślna już jest w centrum:** ⌂ zostaje na miejscu, wypełniony i przygaszony, z dymkiem „Osoba domyślna
  jest w centrum: {imię}”. Ani kliknięcie, ani klawisz nic nie robią.
- **Dymek:** „Ustaw w centrum osobę domyślną: {imię}”, przy pierwszej osobie drzewa z dopiskiem „ – pierwsza osoba
  w drzewie”, przy **Ostatnio wyświetlana** „ – w centrum przy otwarciu”, oraz „(H)”.
- **Klawisze:** H (poza polem tekstowym i otwartym menu); do tego ⌘1 na Macu i Ctrl+1 w Windows i Linuksie, gdy
  przeglądarka przekaże je aplikacji. W karcie przeglądarki przeglądarka zwykle używa ich sama do przejścia na
  pierwszą kartę. Przegląd klawiszy: [A9.8](A9-using-the-app.md#A9.8).
- **Podczas śledzenia badania** ⌂ i H działają jak inny wybór osoby: przerywają śledzenie agenta w oknie głównym
  (**Wróć do agenta**, [S4.1.1](S4-research-from-the-app.md#S4.1.1)). Gdy osoba domyślna już jest w centrum, nie
  przerywają.
- **Granice:** puste drzewo ⌂ nie ma. Mapa, Oś czasu, Tabela i kolejne okna ([A6.8](#A6.8)) ⌂ nie mają, a H nic w nich
  nie robi.
- **Obsługa:** ⌂ przy **W centrum** (Potomkowie: w plakietce, Wachlarz: w lewym górnym rogu); klawisz H.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:e52adde6 src/default-person.ts defaultTarget (specific, first, opened, fallbackFirst; prázdný strom null), startupPerson · src/ui/default-focus.ts FALLBACK_TO_FIRST = true, rememberOpenedFocus, isAtDefault (Vějíř: liveFollowPinned ?? focus), isDefaultFocusContext (hlavní okno, HOME_VIEWS family/descendants/fan), focusDefaultPerson (unpinFanCenter, TreeRenderer.focusFromTab → showFocusToast) · app:b6df0770 §3 telefon (panel osoby), §6 defaultFocusKey (H/h bez Ctrl/⌘/Alt mimo pole; ⌘1 / Ctrl+1 podle code Digit1 i z pole), src/ui/misc.ts defaultFocusKeyHeld, §7 Potomci (#descendants-badge), Vějíř (pilulka vlevo nahoře, pin), §9 pauza sledování · strings.ts focus.focusedOn, focusHome, focusHomeFirst, focusHomeOpened, focusHomeAt, focusToast, focusToastBack · CHANGELOG.cs.md 3.30.0 „Zpět na výchozí osobu“ · dirigent:spec/111 K1.1–K1.6 · app:docs/ZADANI_DEV_vychozi-osoba.md §1–§9 · ⌘1 / Ctrl+1 v kartě prohlížeče neměřeno (spec 111 Otevřené) -->

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
- **Od aplikacji 3.30.0:** przy włączonym **Oznaczeniu linii** ([A6.1.5](#A6.1.5)) przed imieniem osoby stoi znak
  linii w wybranym kształcie (osoba w obu liniach dwa znaki, przy rodzicach tej samej płci 1 i 2); najechanie na znak
  podaje linię słowami. Pasek życia ma nadal kolor płci i nie jest podbarwiany. Plakat osi czasu rysuje znak tak samo.
  Przy **Bez kształtu** znaku nie ma.

<!-- zdroj: app:src/timeline.ts computeTimelineModel, :59 TimelineHistory · strings.ts timeline.omitted · CHANGELOG.cs.md 3.19.0 -->
<!-- zdroj: app:cecd72a4 src/renderer.ts timelineBranchSigns (znak legendy před jménem, title linie slovy, dvě značky R4, číslice R5; plakát SVG) · CHANGELOG.cs.md 3.30.0 „Značení linií“ · dirigent:spec/112-znaceni-linii -->

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
  - **Od aplikacji 3.30.0:** **Linie** w kolorach **Oznaczenia linii** ([A6.1.5](#A6.1.5)): strona ojca niebieska
    (ojciec ojca niebieski, matka ojca niebieskozielona), strona matki różowa (ojciec matki różowy, matka matki
    malinowa), rodzice w delikatnym odcieniu swojej strony, potomkowie w kształcie Dwustronny ochrowi. Do 3.29.0 inne
    odcienie.
  - **Od aplikacji 3.30.0:** **Rody** barwią według strony wachlarza, z legendą według stron i wyróżnieniem rodu
    ([A6.4.1](#A6.4.1)).
- **Osoba wyjściowa** wraca wachlarzem do osoby, od której się zaczęło.
- **Obowiązuje od:** wachlarz aplikacja 1.8.0; nowy wachlarz z kształtami, kolorami i implexem aplikacja 3.20.0
- **Od aplikacji 3.27.0:** związek bez daty ślubu jest ustawiany według najpóźniejszej możliwej daty ślubu:
  wcześniejszej z końca związku (rozwodu) i urodzenia pierwszego dziecka związku. Ślub „przed 1982” stoi przed ślubem
  w roku 1982. Związek bez tych dat idzie za pozostałymi. Tę samą kolejność mają partnerzy obok osoby i oznaczenia
  kolejności małżeństw („1. ∞”) na kartach.

<!-- zdroj: app:src/fan-chart.ts FAN_MIN_GENERATIONS, FAN_MAX_GENERATIONS, FAN_DEFAULT_GENERATIONS, parentSlots, repeatOf · strings.ts fan.shapeHalf, fan.shapeFull, fan.shapeTwo, fan.colorGender, fan.colorLine, fan.colorRod, fan.legendRepeats, fan.originPerson, fan.showFirst, fanChart.kekuleHint · settings fanKekule (výchozí false) · spec 029 · CHANGELOG.cs.md 3.20.0 · 3.30.0: app:cecd72a4 src/fan-colors.ts LINE_HUE [258, 232, 352, 5], PARENT_LINE_HUE, DESCENDANT_LINE_HUE 82, parentLineColor, descLineColor (dřív 50/95/215/320, rodiče 70/250, potomci 150) · 3.27.0: app:ad1ca16c src/marriage-order.ts marriageKey (BOUND 0.5, qualifier „<“; bez sňatku min(endDate, narození dětí)), marriageDates, compareMarriages, marriagesInOrder (partneři vedle osoby, značka „1. ∞“) · src/fan-chart.ts familiesOf · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1109-app-tester-vlna1 (T50, T13) -->

<a id="A6.4.1"></a>
### A6.4.1 Kolory rodów i wyróżnienie rodu

W kolorach **Rody** każdy ród w wachlarzu ma własny kolor, a kolor mówi, po której stronie wachlarza ród jest: strona
ojca zimne odcienie niebieskiego i zielonego, strona matki ciepłe różowe i pomarańczowe, potomkowie (kształt
Dwustronny) ochrowe.

- **Strona rodu:** ród osoby w centrum należy do strony ojca. Ród, który jest w wachlarzu tylko wśród potomków, należy
  do potomków. Pozostałe rody należą do strony, po której są najbliżej centrum (w najniższym pierścieniu); przy
  remisie do strony ojca.
- **Kolejność rodów:** według liczby wycinków w wachlarzu (powtórzona osoba liczy się za każdym razem), potem według
  wielkości w drzewie. Pierwszych dziesięć rodów z co najmniej dwoma wycinkami i ród osoby w centrum ma odcień
  wyrazisty, pozostałe przygaszony.
- **Szare** są tylko osoby bez rodu, nieznane osoby (?) i puste miejsca (+). Każdy ród w wachlarzu ma kolor.
- **Sąsiedzi:** gdy odcienie strony się skończą, powtarzają się, ale nigdy na sąsiednich wycinkach (obok siebie, przez
  pokolenie ani przez szew pełnego koła), a nowo przydzielony odcień ani o jeden wycinek dalej. Odcień innej strony
  ród bierze tylko wtedy, gdy żaden własny nie jest dość odmienny.
- **Pamięć kolorów:** okno pamięta odcień każdego rodu, także rodu, którego teraz nie widać. Po zmianie centrum i po
  powrocie do wcześniejszego centrum rody mają te same kolory. Zapamiętany odcień ustępuje tylko sąsiadowi z tym samym
  odcieniem, więc po powrocie ten sam odcień może się pojawić o jeden wycinek dalej. Nowy ród dostaje najpierw
  odcień, którego żaden ród nie pamięta. Pamięć znika po wyjściu z widoku lub z drzewa; kolejne okno
  ([A6.8](#A6.8)) przejmuje ją od okna głównego.
- **Legenda:** grupy **Strona ojca**, **Strona matki** i **Potomkowie**; w każdej najpierw ród osoby w centrum
  („· środek”), potem rody według liczby osób w wachlarzu („7×”). W części głównej jest najwyżej dwadzieścia rodów
  z co najmniej dwoma wycinkami i ród osoby w centrum.
  - **Pozostałe · N rodów** zwija mniejsze rody do jednego wiersza z dwubarwną próbką i liczbą osób (osoby bez rodu
    liczą się tutaj). Rozwinięty pokazuje mniejsze rody w ich kolorach, według liczby i nazwy. Rozwinięcie jest
    zapamiętane na urządzeniu.
  - **bez rodu** jest wewnątrz **Pozostałe**, a gdy **Pozostałe** nie ma, osobnym wierszem.
  - Wiersze są przyciskami w jednym przystanku klawisza Tab (strzałki, Home, End). Najechanie myszą na wiersz
    wyróżnia ród jako podgląd.
- **Wyróżnienie rodu:** kliknięcie wiersza legendy lub **Wyróżnij ród {ród}** w menu wycinka wyróżnia ród drzewa
  ([A6.6](#A6.6)), tak jak w widoku Rodzina. Wycinki rodu mają przerywany obrys, pozostałe są przygaszone.
  Wyróżnienie zostaje po zmianie centrum. Usuwa je drugie kliknięcie, **Usuń wyróżnienie rodu**, × przy etykiecie
  lub Esc. Przy dopasowaniu wachlarz omija pas z etykietą wyróżnienia; powiększony widok zostaje, jak jest.
- **Telefon:** dotknięcie wiersza w arkuszu legendy wyróżnia ród (albo usuwa wyróżnienie) i zamyka arkusz. Chip
  kolorów pokazuje wtedy zamiast kropek próbkę i nazwę rodu. **Tablet:** wiersze legendy mają wielkość elementu
  sterującego.
- **Obraz, plakat i druk:** wyróżnienie się przenosi (przerywany obrys, pozostałe wypełnienia jaśniejsze), podtytuł
  podaje „wyróżniony ród {ród}”, gdy narysowana jest któraś osoba rodu. Legenda plakatu jest według stron,
  wyróżniony ród pogrubiony i podkreślony. Etykiety wyróżnienia się nie drukują.
- **Granice:** wachlarz na stronie osoby ma tylko kolory płci.
- **Obsługa:** **Kolory** › **Rody**; wiersze legendy; w menu wycinka **Wyróżnij ród {ród}** / **Usuń wyróżnienie
  rodu**; × przy etykiecie; Esc.
- **Obowiązuje od:** aplikacja 3.30.0 (kolory **Rody** od aplikacji 3.20.0; do 3.29.0 kolorowo tylko dziesięć
  największych rodów, pozostałe szaro)

<!-- zdroj: app:src/fan-rod-assign.ts (strany P/M/D: rod středu P, jen potomci D, jinak nejnižší prstenec, shoda P; pořadí počet výsečí › velikost › id; FAN_ROD_MAX_STRONG 10, FAN_ROD_LEGEND_MAIN 20, tier S/T; opakování odstínů ne na sousedních výsečích ani o jednu dál, výpůjčka jiné strany) · src/fan-colors.ts paleta P/M/D světlá, tmavá, tisk, fanRodLegend, fanRodOtherSwatch (K1.7), legendOther, legendNoRod · src/ui/fan-view.ts legenda (FAN_STORAGE_KEYS.legendOtherOpen, náhled jen při (hover: hover)), setRodSelection(…, 'legend'), forgetRodColors · strings.ts fan.legendFatherSide, legendMotherSide, legendDescendants, legendOther, legendNoRod, legendCentre, colorsChipRod, menuHighlightRod, menuUnhighlightRod, posterHighlighted · app:1d9dad0f, 7231dd13 (legenda po stranách), 77282e4e (telefon, tablet), b31c74a9 (štítky se netisknou), defe20a6, 7821ea72 (vějíř mimo štítek), 1ad91795 (paleta P/M/D), a265a3cc (paměť barev při návratu, další okna) · dirigent:spec/114-vejir-barvy-rodu · test/vysledek-1119-app-vejir-rody, vysledek-1119-app-vejir-barvy-vse · CHANGELOG.cs.md 3.30.0 -->

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
- **Migracja w czasie** pokazuje miejsca według lat i drogę przodków do jednej osoby ([A6.5.3](#A6.5.3)).
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

<a id="A6.5.3"></a>
### A6.5.3 Migracja w czasie

**Migracja w czasie** pokazuje miejsca według lat. Suwak na osi czasu pod mapą wyznacza rok, a mapa pokazuje miejsca,
które do tego roku przybyły, i linie przeprowadzek rodu.

- **Granice:**
  - na osi czasu są tylko miejsca z rokiem i położeniem. Miejsca z położeniem, ale bez daty pasek stanu liczy („N miejsc
    bez daty nie jest wyświetlanych na osi czasu.”);
  - oś czasu biegnie od najstarszego do najmłodszego roku miejsc w zakresie (**Ten widok** / **Całe drzewo**)
    i włączonych rodzajów ([A6.5](#A6.5)). Bez datowanych miejsc trybu nie można włączyć;
  - punkt, w którym coś się stało w ostatnich dziesięciu latach przed wybranym rokiem, jest wyróżniony;
  - linia prowadzi z miejsca urodzenia rodzica do miejsca urodzenia dziecka, gdy oba mają rok i położenie i się
    różnią. Rodzeństwo z tą samą drogą ma jedną linię. Linia blednie z wiekiem dziecka, po 60 latach do 15 %. Rysowane
    są tylko linie z końcem przy widocznym obszarze mapy, najwyżej 400. Bez rodzaju **Urodzenia** linie się nie
    rysują („Droga rodu jest widoczna tylko z Urodzeniami.”);
  - **Odtwórz** przesuwa rok mniej więcej co 120 ms aż do ostatniego roku. Na ostatnim roku **Odtwórz** zaczyna znowu
    od początku.
- **Od aplikacji 3.28.0:**
  - przycisk **◷ W czasie** ma przy ikonie także tekst;
  - mapa proponuje tryb raz: dopóki nie był włączony, a drzewo ma co najmniej dwa datowane miejsca z położeniem, przy
    przycisku stoi karta **Migracja w czasie** („Odtwarza, jak rody się przemieszczały, i pokazuje drogę przodków do
    jednej osoby.”). **Wypróbuj** włącza tryb, **Nie teraz** zamyka kartę. Po którymkolwiek z nich karta na tym
    urządzeniu już się nie pokazuje;
  - klawisze na suwaku: strzałki o rok, PageUp i PageDown o 10 lat, Home i End na początek i koniec. Spacja
    w dowolnym miejscu mapy (poza polami i przyciskami) odtwarza lub wstrzymuje. Ręczne przesunięcie wstrzymuje
    odtwarzanie;
  - w trybie można wybrać osobę, do której prowadzi droga jej przodków ([A6.5.4](#A6.5.4));
  - **Odtwórz** i **Wstrzymaj** mają tę samą szerokość (dłuższego z obu słów w danym języku), więc suwak, jego znaczniki
    ani rok nie przesuwają się przy uruchomieniu i zatrzymaniu. Telefon ma tylko ikonę.
- **Obsługa:** aplikacja: mapa → **◷ W czasie** (**Migracja w czasie**) → suwak, **Odtwórz** / **Wstrzymaj**.
- **Obowiązuje od:** aplikacja 2.4.0; rodzaje miejsc 3.21.0; tekst przycisku, jednorazowa propozycja, klawisze i stała
  szerokość **Odtwórz** 3.28.0

<!-- zdroj: app:src/map-time.ts collectDatedPlacePoints (undatedPlaceCount, minYear/maxYear) · src/ui/map-ui.ts drawMapTimeLayer (fresh = posledních 10 let, slice(0, 400) s koncem u výřezu), mapMigrationSegments (místa narození rodič → dítě, opacity max(0.15, 1 − věk/60·0.85), bez Narození nic), toggleMapTimePlay (setInterval 120, na konci od začátku), renderMapTimeTip / dismissMapTimeTip (strom.map.timeTipSeen, ≥ 2 datovaná místa s polohou, podklad mapy potvrzený), klávesy na posuvníku a mezerník (setMapTimeYear pozastaví) · strings.ts map.timeMode, timeModeShort, timeModeEmpty, timePlay, timePause, timeUndated, noFamilyPath, timeTipTitle, timeTipText, timeTipTry, timeTipLater · Migrace v čase od v2.4.0 (app 44a903bc) · 3.28.0: app 34e82d43, cce82a89 (app:81f2adf0) · CHANGELOG.cs.md 3.21.0, 3.28.0 · spec 054 P2 · stálá šířka Přehrát/Pozastavit: app 35ed67f9 src/ui/map-ui.ts (obě slova v jedné buňce, map-time-play-word), index.html .map-time-play-text -->

<a id="A6.5.4"></a>
### A6.5.4 Droga przodków do osoby

W Migracji w czasie można wybrać jedną osobę. Mapa pokazuje wtedy tylko jej bezpośrednich przodków, linie od
każdego przodka do jego dziecka aż do wybranej osoby, a oś czasu kończy się na niej.

- **Granice:**
  - przodkowie to rodzice, ich rodzice i dalej, najwyżej 30 pokoleń. Rodziców bierze się jak w wachlarzu
    ([A6.4](#A6.4)). Zastępczy drugi rodzic rodziny z jednym rodzicem przodkiem nie jest: jego gałąź jest nieznana;
  - przodek, do którego prowadzi kilka dróg (implex), jest na mapie jednym punktem, ale liczy się w każdej gałęzi, do
    której należy. W tej samej gałęzi jego przodkowie nie rozwijają się drugi raz;
  - przodek stoi w miejscu urodzenia, bez niego w miejscu chrztu, bez niego w pierwszym datowanym miejscu
    zamieszkania; zawsze tylko w miejscu z położeniem. Jego rok to rok urodzenia, bez niego rok chrztu, bez niego rok
    tego miejsca. Przodka bez roku albo bez miejsca z położeniem na osi czasu nie ma: legenda go liczy, a **Lista ›**
    wymienia go z tym, czego brakuje (**bez daty urodzenia**, **bez miejsca**, **bez daty i miejsca**), oraz
    odnośnik **Strona osoby ›** ([A6.5.5](#A6.5.5));
  - wybrana osoba stoi tak samo. Jest celem: kółko „◎ cel: imię”, na końcu osi czasu pełne kółko „◎ imię · rok” (przy
    miejscu chrztu „· chrzest rok”, przy miejscu zamieszkania „· zamieszkanie rok”). Cel bez miejsca na mapie się
    nie rysuje, a na końcu osi czasu stoi „… nie ma miejsca na mapie.”;
  - oś czasu biegnie od roku najstarszego przodka na mapie do późniejszego z lat ostatniego przodka i celu;
  - droga bierze przodków z całego drzewa: zamiast zakresu stoi chip z osobą, po usunięciu drogi zakres wraca.
    Rodzaje miejsc drogi nie dotyczą. Punkt miejscowości zbiera także jej domy jak bez drogi;
  - dymek miejsca pokazuje tylko ludzi drogi w tym miejscu, przodków do wybranego roku i cel, z etykietami ich rodów;
  - po wybraniu osoby mapa raz się przesuwa i przybliża na całą drogę, potem sama się nie rusza (wyjątek na końcu
    odtwarzania, [A6.5.6](#A6.5.6));
  - linii jest najwyżej 400 jak bez drogi. Gdy jest ich więcej, pierwszeństwo mają: pień (rodzice i dziadkowie), linie
    z ostatnich 10 lat, bliższe pokolenia, koniec w widocznym obszarze mapy, dłuższa linia. Legenda to mówi
    („Pokazano N z M linii”, „Pierwszeństwo mają bliższe pokolenia i nowo dodane linie.”);
  - wyłączenie **W czasie** drogę tylko ukrywa. Po włączeniu wraca i biegnie od pierwszego roku. Usuwa ją **×** na
    chipie;
  - nowe okno z mapą ([A6.8](#A6.8)) przejmuje osobę drogi, ćwiartki lub ósemki i kolory rodów.
- **Wybór osoby:** **Droga do osoby** szuka w całym drzewie („Imię, nazwisko lub rok”), najwyżej 30 osób. Puste pole
  pokazuje osobę centralną (**Ostatnio wybrana**). Przy każdej osobie stoi, ilu jej przodków jest na mapie; osoba bez
  nich jest wyszarzona („przodkowie jeszcze bez miejsc na mapie”) i nie można jej wybrać. Na telefonie i ekranie
  dotykowym wybór otwiera się jako panel wysuwany od dołu. Gdy żaden przodek nie jest na mapie, oś czasu mówi „Żaden
  przodek nie ma jeszcze miejsca na mapie.” i oferuje **Wybierz inną osobę**.
- **Obsługa:** aplikacja:
  - mapa → **◷ W czasie** → na osi czasu **◎ Droga do osoby…** → osoba. Chip **◎ Droga do:** imię otwiera wybór
    ponownie (**Zmień osobę**), **×** usuwa drogę (**Usuń drogę**);
  - w dymku miejsca kliknięcie osoby → **◎ Droga do tej osoby** (obok **Strona osoby ›**), także bez wybranej osoby;
  - na stronie osoby **◎ Droga przodków na mapie ›** ([A7.6](A7-book-pages-and-export.md#A7.6)): strona się zamyka,
    mapa pokazuje drogę od pierwszego roku, a powiadomienie oferuje **‹ Wróć do strony osoby**. Odnośnik jest
    w sekcji **Miejsca życia**. Osoba z najwyżej jednym własnym miejscem tej sekcji nie ma; gdy ma przodków na mapie,
    odnośnik stoi we własnym wierszu tam, gdzie byłaby sekcja. Gdy osoba ma przodków, ale żaden nie jest na mapie,
    odnośnik jest wyszarzony („Żaden przodek nie ma jeszcze miejsca na mapie.”) i tylko w sekcji **Miejsca życia**.
    Bez przodków w drzewie odnośnika nie ma.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:src/map-lines.ts buildPathModel (maxGen 30, fatherMother přes parentSlots jako vějíř, isPlaceholder není předek, implex záznam na cestu, expanded podle osoby a větve), placeOf (narození → křest → první datované bydliště, jen s polohou; rok narození → křest → místa), missing (date/place/both), yearFrom/yearTo, links, pathSegments (PATH_LINE_CAP 400, pořadí kmen, fresh < 10 let, generace, výřez, délka) · src/ui/map-path-ui.ts (mapEffectiveScope celý strom, čip místo rozsahu, clearMapPath vrátí rozsah, jednorázový výřez framed, cíl čárkovaný → plný, pathTargetNoPlace, pathNoAncestors + pathOtherPerson) · src/person-picker.ts PathPersonPicker (limit 30, recentId = ústřední osoba, onMapCount 0 = aria-disabled, celý strom) · src/ui/map-lines-legend-ui.ts mapPathBubbleParts · src/ui/map-ui.ts showMapPathPlace, toggleMapTime (vypnutí skryje, zapnutí od začátku) · src/ui/person-page-ui.ts personPageMapPath (on/off/null), openPersonPageMapPath (toast map-path-back) · src/person-page-map.ts (pp-map-path, aria-disabled, jen v okně aplikace; mapPathRowHtml vlastní řádek bez oddílu Místa života jen pro mapPath on, app caea192a) · src/person-page.ts mapPathRow · src/windows/view-window-state.ts MapTimeState path, mode, colors · strings.ts map.pathPick, pathPickTitle, pathPickPlaceholder, pathPickRecent, pathPickOnMap, pathPickNone, pathChip, pathChange, pathClear, pathFromPage, pathThisPerson, pathBackToPage, pathGoal, pathGoalEnd, pathTargetNoPlace, pathNoAncestors, pathOtherPerson, linesCut, linesCutWhy, missingDate, missingPlace, missingBoth · app 388e5a87, b01693bc, 5853882e, 34e82d43 (app:81f2adf0) · dirigent:prace/1113-app-mapa-rody-v-case · ZADANI_UIX_mapa-rody-v-case D3, D4 (ponechat) · spec 054 K2.1, P2 · CHANGELOG.cs.md 3.28.0 -->

<a id="A6.5.5"></a>
### A6.5.5 Kolory rodów i legenda Rody

Droga przodków jest kolorowa według rodów. Ród to tu gałąź jednego z dziadków (ćwiartka) lub jednego z pradziadków
(ósemka) wybranej osoby, nazwana jego nazwiskiem rodowym. Nie jest to ród według nazwiska
([A4](A4-surnames-and-families.md)).

- **Granice:**
  - ćwiartki to ojciec ojca, matka ojca, ojciec matki i matka matki, w tych samych odcieniach co kolory **Linie**
    w wachlarzu ([A6.4](#A6.4)). Każda ćwiartka ma też własny wzór linii (pierwsza ciągłą), więc rody da się
    rozróżnić także przy słabszym rozróżnianiu barw. Dwie ćwiartki tej samej strony (niebieska i niebieskozielona
    ojca, różowa i malinowa matki) różnią się jasnością i wzorem. Jasny i ciemny wygląd mają własne odcienie;
  - ósemka ma kolor swojej ćwiartki, druga ósemka tej samej ćwiartki ciemniejszy odcień. Numer ósemki (1–8) stoi na
    najdłuższej widocznej linii każdej ósemki;
  - linie od rodziców i dziadków to pień: w kolorze tekstu i szersze. Punkty rodziców mają kolor pnia, punkty
    dziadków kolor swojej ćwiartki. Punkt, w którym spotyka się kilka rodów, ma kolory wszystkich;
  - linia z ostatnich 10 lat jest szersza. Starsze linie bledną, najwyżej do 55 %, aby na końcu była widoczna cała
    droga;
  - nazwisko rodu to nazwisko rodowe dziadka lub pradziadka; bez nazwiska jego imię.
- **Legenda Rody** (po prawej pod sterowaniem mapy, gdy na mapie jest co najmniej jeden przodek):
  - **Ćwiartki** · **Ósemki**. **Ósemki** można wybrać, gdy drzewo zna co najmniej dwie ósemki;
  - wiersz rodu: wzór linii, nazwisko, relacja i liczba przodków na mapie („ojciec ojca · 12 przodków”). W ósemkach
    wiersze stoją pod nagłówkiem swojej ćwiartki („1 · nazwisko”). Nieznany dziadek lub babcia ma wiersz bez koloru
    („matka ojca – nieznana”). Ród, którego żaden przodek nie jest na osi czasu (wszyscy bez daty lub miejsca), ma
    wiersz wyciszony jak nieznany, z pustym kreskowanym wzorem i „poza osią czasu” zamiast liczby („matka ojca · poza
    osią czasu”); nie można go wyróżnić ani przypiąć. Ostatni wiersz to **Pień: rodzice i dziadkowie**;
  - najechanie na wiersz na chwilę wyróżnia ród, kliknięcie go przypina i przyciemnia pozostałe rody. Esc albo drugie
    kliknięcie przypięcie usuwa, przełączenie ćwiartek i ósemek też;
  - pod wierszami stoją: pierwsza osoba w dwóch rodach („↻ imię (rok) jest w dwóch rodach: … i ….”), przycięcie
    dużego drzewa ([A6.5.4](#A6.5.4)), przodkowie poza osią czasu („N przodków bez daty lub miejsca nie jest na osi
    czasu.” i **Lista ›**, lista **Przodkowie poza osią czasu**) i **Bez kolorów rodów**;
  - **Bez kolorów rodów** rysuje całą drogę jednym kolorem i ukrywa wiersze rodów. Pień zostaje szerszy, a osoba
    zostaje wybrana;
  - **▴** (**Zwiń**) składa legendę do chipu „Rody (N)” z kolorami rodów. Mapa się przy tym nie przesuwa.
- **Telefon:** legenda otwiera się jako panel wysuwany od dołu z chipu **Rody (N)** nad osią czasu, **Lista ›** także.
  Otwarty jest zawsze tylko jeden panel (legenda, lista, dymek lub wybór osoby). Telefon w poziomie ma chip w górnym
  rzędzie.
- **Obsługa:** aplikacja: mapa → **◷ W czasie** → droga do osoby ([A6.5.4](#A6.5.4)) → legenda **Rody**.
- **Obowiązuje od:** aplikacja 3.28.0
- **Od aplikacji 3.30.0:** ćwiartki w odcieniach **Oznaczenia linii** ([A6.1.5](#A6.1.5)): strona ojca niebieska
  i niebieskozielona, strona matki różowa i malinowa. Do 3.29.0 inne odcienie.

<!-- zdroj: app:src/map-line-colors.ts (LINE_HUE z fan-colors.ts jako vějíř Linie, tabulka OKLCH světlý/tmavý, QUARTER_DASH, lineCap, LINE_WIDTH base 3 / fresh 4 / trunk 4.5, pathLineOpacity max(0.55, 1 − věk/60·0.45), LINE_FOCUS_DIM, pointFill, lineSwatch; hlavička: dvojice 50↔95 a 215↔320 se liší světlostí i vzorem; app:cecd72a4 LINE_HUE 258/232/352/5, tabulka OKLCH q0–q3, e1–e7 (dvojice téže strany se liší světlostí)) · src/map-lines.ts lineClassOf (gen ≤ 2 kmen), pointClassOf (rodiče kmen), branchSurname (rodné příjmení, jinak křestní), quarters/eighths · src/ui/map-path-ui.ts drawMapPathLayer (čísla osmin na nejdelší viditelné čáře, LEGEND_WIDTH) · src/ui/map-lines-legend-ui.ts mapLinesLegendHtml (eighthsOff < 2 známé osminy, řádky, neznámý, kmen, pata), mapLinesImplexText, toggleMapLineFocus, setMapLineHover, setMapLineMode (připnutí pryč), setMapLineColors, setMapLegendCollapsed, openMapLinesSheet / closeMapLinesSheets, mapLinesUndatedHtml, offTimeline (count 0: is-unknown, is-off-timeline, swatch is-empty, app caea192a) · strings.ts map.linesOffTimeline, map.linesTitle, linesChip, linesQuarters, linesEighths, linesCollapse, linesRow, linesUnknown, linesTrunk, linesOff, linesImplex, pathUndated, pathUndatedList, pathUndatedTitle, lineE8–lineE15; fan.lineFatherFather… · app 388e5a87, b01693bc, 5853882e, 8e27df4a, 34e82d43 (app:81f2adf0) · spec 054 K1.1, K1.2 · CHANGELOG.cs.md 3.28.0 -->

<a id="A6.5.6"></a>
### A6.5.6 Odtwarzanie drogi do osoby

Z wybraną osobą **Odtwórz** przechodzi całą oś czasu w 24 sekundy, od najstarszego przodka do wybranej osoby.

- **Granice:**
  - rok po roku, żaden nie jest pomijany. Rok, w którym przybył przodek lub cel, trwa pięć razy dłużej niż rok bez
    nich;
  - odtwarzanie kończy się na celu. Kolejne **Odtwórz** zaczyna od początku;
  - wstrzymuje je **Wstrzymaj**, suwak, klawisze ([A6.5.3](#A6.5.3)) i znacznik nad suwakiem;
  - znaczniki nad suwakiem: każda znana ćwiartka w roku swojego najstarszego przodka na mapie, w kolorze rodu
    („nazwisko: najstarszy przodek rok”), i cel na końcu. Kliknięcie znacznika przeskakuje na jego rok;
  - wiersz pod suwakiem mówi, co ostatnio przybyło: „rok · imię · miejsce rodzica → miejsce” z próbką koloru rodu,
    cel pogrubiony. Gdy w jednym roku przybyło kilka osób, pokazuje cel, w przeciwnym razie osobę z najbliższego
    pokolenia. Czytnik ekranu odczytuje wiersz przy zmianie. Bez wybranej osoby wiersza nie ma, a zdanie o miejscach
    bez daty zostaje na pasku stanu;
  - mapa się przy odtwarzaniu nie rusza. Tylko gdy od wybrania osoby nikt jej nie przesunął ani nie przybliżył, a cel
    jest na końcu poza widocznym obszarem, przesuwa się do niego raz;
  - na telefonie **▶** jest bez tekstu, a oś czasu w jednym rzędzie.
- **Obsługa:** aplikacja: mapa → **◷ W czasie** → droga do osoby ([A6.5.4](#A6.5.4)) → **Odtwórz**.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:src/map-lines.ts pathPlaySchedule (PATH_PLAY_MS 24000, PATH_EVENT_WEIGHT 5, krok rok, součet 24 000), pathAddedIn (nejbližší generace, pak rel, cíl poslední), pathLastAdded · src/ui/map-path-ui.ts playMapPath (konec u cíle), panMapToPathEnd (framed, jednou), renderMapTimeMarks (čtvrtiny podle firstYear, cíl), renderMapTimeCaption (cíl, jinak items[0]; aria-live, aria-valuetext; bez cesty skryto) · src/ui/map-ui.ts toggleMapTimePlay (na konci od začátku), setMapTimeYear (pozastaví), značky → setMapTimeYear · strings.ts map.timeMarkTitle, pathGoalEnd · app cce82a89, 34e82d43 (app:81f2adf0) · ZADANI_UIX_mapa-rody-v-case D5 (ponechat) · spec 054 K2.2 · CHANGELOG.cs.md 3.28.0 -->

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

<a id="A6.7"></a>
## A6.7 Tabela

Tabela pokazuje całe drzewo w wierszach: każdą osobę, każdy związek, każde wydarzenie albo każde źródło, z danymi
w kolumnach. Służy do szukania luk, sprzeczności i ustaleń kontroli w całym drzewie. Nie zależy od głębokości
**Przodkowie** i **Potomkowie**.
Widok Tabela opiera się na tabeli Ondřeja Chrpy.

- **Wiersze:** przełącznik **Wiersze**: **Osoby** · **Związki** · **Wydarzenia** · **Źródła**. Każdy typ wierszy ma
  własne kolumny, filtr i sortowanie.
  - **Osoby:** jeden wiersz na osobę drzewa; osoby zastępcze (puste miejsce dla nieznanego rodzica) się pomija.
  - **Związki:** jeden wiersz na związek, który ma co najmniej jednego rzeczywistego partnera. **Partner 1** to ten
    z pary, kto jest krewnym osoby głównej; w przeciwnym razie pierwszy partner związku.
  - **Wydarzenia:** jeden wiersz na wydarzenie drzewa ([A6.7.10](#A6.7.10)).
  - **Źródła:** jeden wiersz na źródło drzewa ([A6.7.11](#A6.7.11)).
- **Osoba główna** to osoba w centrum drzewa ([A6.1](#A6.1)). Według niej liczy się kolumnę **Pokrewieństwo z osobą
  główną** i chip **Krewni**: przodkowie osoby głównej (także ona sama) i wszyscy ich potomkowie. Partnerzy, którzy
  weszli do rodziny przez małżeństwo, do nich nie należą.
- **Pokolenie** 1 to najstarsze pokolenie drzewa; partner ma pokolenie swojego partnera.
- **Żyjący** (kolumna, wartość „żyjący”) liczy się jak ochrona osób żyjących
  ([A7.1](A7-book-pages-and-export.md#A7.1)).
- Nad tabelą jest liczba („42 z 120 osób”) i sortowanie („Sortowanie: …”). Pole **Szukaj osoby...** na pasku
  narzędzi w tabeli wybiera wiersz osoby i przewija do niego; osoba w centrum się nie zmienia.
- **Osoba w centrum między widokami:** po przełączeniu na Tabelę wiersz osoby w centrum jest aktywnym wierszem
  i tabela przewija się do niego (wybrany wiersz, który jej dotyczy, zostaje; gdy filtr lub wyszukiwanie osobę
  pomija, aktywnego wiersza nie ma). Po przełączeniu z Tabeli osobą w centrum jest osoba aktywnego wiersza: przy
  związku ten partner, który już jest osobą w centrum, w przeciwnym razie **Partner 1**; przy wydarzeniu osoba
  w centrum, gdy jest wśród jego osób, w przeciwnym razie pierwsza osoba; wiersz źródła osoby w centrum nie zmienia.
- **Granice:**
  - wyróżnienie rodu ([A6.6](#A6.6)) w tabeli się nie stosuje; ród można wybrać chipem **Ród** ([A6.7.6](#A6.7.6));
  - kolumny, chipy i widoki badania są tylko w drzewie z badania ([A6.7.14](#A6.7.14));
  - drzewo tylko do odczytu (śledzone drzewo, drzewo zapisane nowszą wersją aplikacji, zablokowane drzewo) tabela
    tylko pokazuje: „Tylko do odczytu: edycji i „To nie błąd” tu nie ma.” Przeglądanie, filtr, sortowanie i eksport
    CSV i XLSX działają; widoku nie można zapisać, przemianować ani usunąć;
  - strzałek **↩ ↪** w lewym dolnym rogu (poprzednia i następna osoba centralna) ani Alt+← / Alt+→ w Tabeli nie ma:
    tabela nie pokazuje osoby centralnej i nie zmienia jej podczas pracy;
  - **od aplikacji 3.30.0** Alt+← / Alt+→ w tabeli prowadzą wstecz i naprzód po skokach przez imiona osób
    ([A6.7.16](#A6.7.16)); osoby centralnej i tak nie zmieniają.
- **Od aplikacji 3.30.0:** **Zakres ▾** zawęża tabelę do listy osób ([A6.7.19](#A6.7.19)), a **⋯** Tabeli (przy każdej
  szerokości; na komputerze ukryte, dopóki tabela nie ma wierszy) oferuje **Grupuj według ›** ([A6.7.20](#A6.7.20))
  i **Zapisz jako listę osób…** ([A11.6](A11-lists-of-people.md#A11.6)).
- **Obsługa:** w przełączniku widoków **Tabela** (za **Mapa**); na telefonie, tablecie i w oknie do 1024 px **Tabela**
  na dolnym pasku ([A9.5](A9-using-the-app.md#A9.5); do aplikacji 3.27.0 **Więcej → Widok → Tabela**). Widok jest zapamiętywany jak pozostałe ([A6.1.1](#A6.1.1)).
- **Obowiązuje od:** aplikacja 3.27.0

<!-- zdroj: app:src/ui/table-view/table-model.ts ROW_TYPES, buildTableModel (isPlaceholder ven, svazek aspoň s jedním skutečným partnerem), bloodOf (předci hlavní osoby a všichni jejich potomci), makeContext (homeId, isLivingPerson) · table-columns.ts unionPartners (pokrevní partner jako Partner 1), gen (assignGenerations + 1), kin (findRelationship, kinSelf) · src/ui/table-view/table-ui.ts tableReadOnly (isReadOnly: viewMode, isLocked, isNewerData) · src/data.ts:655 isReadOnly · src/ui/bottom-sheet.ts:443 (do 3.27.0 Více → Pohled: Vějíř, Mapa, Tabulka; od 3.28.0 app:4b1373a7 index.html bb-view-table, commit bb5e4d12) · table-bar.ts countText, sortText · perf-budget test 5 000 osob · strings.ts viewModeSwitch.table, table.rows, rowType, rowTypeNote, countOf, sortedBy, readOnly, readOnlyShort · commity c34c47ff, 1b72e6d8 · spec 073 U2 · Události a Prameny (spec 073 U3 P2, K5.1–K5.4): commity 8de751c2, 63ed9def, 1a3a49f1, 3cf69ffa, strings.ts table.rows.events, rows.sources, perf-budget 5 000 osob (Události) a 2 000 pramenů · poděkování: Milan 10. 11. (dirigent:prace/1110-doc-tabulka, bod 4) · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1110-app-tabulka-p1 · Žijící: strings.ts table.col.living, table.living (commit 7e648e24) · ústřední osoba mezi pohledy: commit 75de3a9b (T54 F1) · ↩ ↪ a Alt+šipky v Tabulce skryté: commity 79764eba, b1cbe546 (T54 G14) -->

<a id="A6.7.1"></a>
### A6.7.1 Związki w tabeli osób

Osoba z dwoma i więcej związkami ma w tabeli osób własny wiersz, a pod nim podwiersz dla każdego związku („Związek 2
z 3”). Wiersz osoby ma w kolumnie **Partner** liczbę („3 związki”), a pozostałe kolumny związku puste.

- Związki idą w kolejności ślubów jak w drzewie ([A6.4](#A6.4)): **Związek 1** to ten, który ma na karcie oznaczenie
  „1. ∞”. Związek bez daty ślubu jest ustawiany według najpóźniejszej możliwej daty ślubu (wcześniejszej z rozwodu
  i urodzenia pierwszego dziecka); związek bez tych dat idzie za pozostałymi. Przy remisie decyduje kolejność związków
  osoby w danych. Pusta rodzina zastępcza („?”) idzie na koniec w kolejności zapisu.
- **Zwinięte:** wiersz osoby pokazuje pierwszy związek i liczbę pozostałych. Domyślnie jest rozwinięte; wbudowany
  widok **Luki** ma związki zwinięte.
- **Filtr w kolumnie związku** ocenia się przy każdym związku osobno. Osoba zostaje, gdy spełnia go co najmniej jeden
  związek; pozostałe chowają się pod wiersz „2 związki poza filtrem · pokaż”. Pokazane są przygaszone do następnej zmiany
  filtru.
- **Sortowanie według kolumny związku** bierze pierwszy związek, który spełnia filtr.
- Osoba z jednym związkiem ma jego dane bezpośrednio w swoim wierszu.
- Podwiersz związku niesie tylko ustalenia swojego związku. Ustalenia osoby (np. wiek matki przy urodzeniu) i paski
  zwiniętych grup zostają w wierszu osoby.
- **Obsługa:** **Rozwiń związki** / **Zwiń związki** (na telefonie w menu **⋯**); klawisze → i ← w kolumnie **Imię
  i nazwisko**, * dla wszystkich osób; menu wiersza. Stan zapisuje się z widokiem ([A6.7.7](#A6.7.7)).

<!-- zdroj: app:src/ui/table-view/table-subrows.ts defaultUnionCollapse (collapsed: false), isExpanded, setAllExpanded, passingUnions, personPassesUnions, sortUnionOf, buildLines · table-model.ts unionsInMarriageOrder (marriagesInOrder z src/marriage-order.ts: Svazek 1 = „1. ∞“; bez data sňatku podle rozvodu nebo prvního dítěte; shoda podle seznamu partnerships osoby; zástupné rodiny „?“ za nimi v pořadí dat; commit 2e0346f9, T13) · table-views.ts BUILTIN_VIEWS gaps (unions collapsed) · strings.ts table.unionsN, unionKofN, hiddenUnions, expandAll, collapseAll · commity 8833da14, 8192621d · nálezy podřádku: commit 75de3a9b (T54 F6) -->

<a id="A6.7.2"></a>
### A6.7.2 Kolumny

Kolumny są w grupach. Które są widoczne i w jakiej kolejności, jest częścią widoku ([A6.7.7](#A6.7.7)).

| Wiersze | Grupy kolumn |
|---|---|
| **Osoby** | **Osoba** · **Urodzenie i chrzest** · **Rodzice** · **Związki** · **Rozwód** · **Zgon i pochówek** · **Wydarzenia** · **Źródła** · **Wiarygodność i badanie** · **Kontrole** |
| **Związki** | **Para** · **Ślub** · **Rozwód** · **Dzieci i źródła** |

- **Imię i nazwisko** (przy związkach **Partner 1**) jest zawsze przypięte po lewej; nie da się go odpiąć ani ukryć.
  Sortuje się według nazwiska, potem imienia. Składa się z części imienia i nazwiska, dlatego jest osobna kolumna **Imię** (domyślnie ukryta), którą
  można edytować w komórce ([A6.7.15](#A6.7.15)). **Nazwisko** to nazwisko po ślubie, w przeciwnym razie rodowe; **Nazwisko rodowe** to zapisane nazwisko.
- **ID badania** pokazuje tylko numer osoby z badania (P…). **Nr ref.** to numer referencyjny osoby (REFN), tak jak
  przyniósł go plik GEDCOM (i jak wraca do niego); sortuje się i filtruje jako tekst.
- **Otwarte pytanie**, **⇄ W innym drzewie** (drzewa na tym urządzeniu, w których osoba jest) i **Stan osoby**
  (oznaczenie udokumentowania i wiarygodności z karty, słowami; sortowane od najsilniejszego; od aplikacji 3.27.0 według wiarygodności
  cytatów, [S7.2](S7-reliability-and-verification.md#S7.2)) są w każdym drzewie.
  Grupa **Badanie** jest tylko w drzewie z badania ([A6.7.14](#A6.7.14)).
- **Wydarzenia** (**Zawód**, **Miejsce zamieszkania**, **Wyznanie**, **Służba wojskowa**, **Emigracja**,
  **Wykształcenie**) pokazują każdą wartość raz, najnowszą pierwszą.
- Kolumny **Wiarygodność …** i **Pewność z badania** mają wartość tylko w drzewie z badania
  ([S7](S7-reliability-and-verification.md)).
- Kolumny **Imię**, **Nr ref.**, **Otwarte pytanie**, **⇄ W innym drzewie** i **Stan osoby** są domyślnie ukryte.
- **Od aplikacji 3.30.0:** przy związkach w grupie **Dzieci i źródła** kolumna **Zdjęcie** z miniaturą zdjęcia pary,
  domyślnie ukryta; filtr **ze zdjęciem** / **bez zdjęcia** ([A12.6](A12-portrait-and-couple-photo.md#A12.6)).
- **Od aplikacji 3.30.0:** przy osobach w grupie **Osoba** kolumna **Dodano**, domyślnie ukryta: dzień, w którym osoba
  doszła do drzewa ([A11.7](A11-lists-of-people.md#A11.7)), w języku aplikacji. Osoba bez tej danej ma „wcześniej”
  szarą kursywą; komórka jest pusta, więc jest na końcu w obu kierunkach sortowania i znajduje ją **Tylko puste**.
  Sortuje się według chwili dodania (w obrębie dnia według czasu), filtr daty według roku.
- **Od aplikacji 3.30.0:** przy osobach w grupie **Osoba** kolumna **Linia**, domyślnie ukryta: linia osoby względem
  osoby w centrum drzewa ([A6.1.5](#A6.1.5)) słowami, **Ojcowska**, **Ojcowska i matczyna**, **Matczyna**, **Potomek**
  (przy rodzicach tej samej płci **Linia 1. rodzica**, **Linia 1. i 2. rodzica**, **Linia 2. rodzica**), przed tekstem
  znak w wybranym kształcie (przy **Bez kształtu** tylko tekst). Osoba bez linii ma pustą komórkę. Sortuje się w tej
  kolejności, puste na końcu; filtr według wartości. Z kolumną **Linia badania** grupy **Badanie** ([A6.7.14](#A6.7.14))
  nie ma związku.
- **Granice:** zwinięta grupa to wąski pasek; pokazuje najwyższy poziom ustalenia w swoich komórkach. Na telefonie
  przypięte imię i nazwisko jest węższe, a nagłówek można tylko czytać, nie zmieniać.
- **Obsługa:**
  - panel **Kolumny** („12 z 58”): **Szukaj kolumny**, grupy z polem wyboru **wszystkie**, przeciąganie kolejności,
    **Wiersz pokrycia**, **Przywróć domyślne**, **Gotowe**;
  - menu w nagłówku kolumny: **Sortuj rosnąco**, **Sortuj malejąco**, **Dodaj do sortowania** (Shift + kliknięcie),
    **Filtr…**, **Przypnij do lewej** / **Odepnij**, **Przesuń w lewo** / **Przesuń w prawo**, **Ukryj kolumnę**,
    **Zwiń grupę …** / **Rozwiń grupę …**; przy kolumnie obliczonej „Obliczono z: …”;
  - szerokość kolumny przez przeciągnięcie krawędzi nagłówka.
- **Kolejność kolumn:**
  - w części przypiętej każdą przypiętą kolumnę można przesunąć na dowolne miejsce wśród przypiętych, także
    **Imię i nazwisko** (nie musi być pierwsze);
  - poza częścią przypiętą kolumna przesuwa się tylko w obrębie swojej grupy;
  - przesunięcie, którego nie da się wykonać, nie jest oferowane: w menu nagłówka brakuje **Przesuń w lewo** albo
    **Przesuń w prawo**, w panelu **Kolumny** strzałki ↑ albo ↓.
- **Od aplikacji 3.28.0:** przypięte kolumny w dowolnej kolejności. Do 3.27.0 **Imię i nazwisko** było zawsze pierwsze
  i nie dało się go przesunąć, przypięte kolumny przesuwały się tylko w obrębie swojej grupy, a przesunięcie, którego
  nie dało się wykonać, było wyszarzone.

<!-- zdroj: app:4b1373a7 src/ui/table-view/table-state.ts normalizeColumns (zamčený sloupec ukotvený, kdekoli v ukotvené části), columnRun (ukotvená část: [0, pinned − 1]; mimo ni skupina), canMoveColumn, moveColumnBy · table-headmenu.ts headMenuItems (moveLeft/moveRight jen canMove; Skrýt ne u zamčeného; Uvolnit ne u zamčeného) · table-colpanel.ts (šipka jen pro možný posun) · commit 19dbb595 (dřív columnRun locked = 1, disabled/aria-disabled) · dirigent:spec/082-tester-3.28 K2.1 -->
<!-- zdroj: app:src/ui/table-view/table-columns.ts PERSON_GROUPS, UNION_GROUPS, katalog sloupců (surname marriedSurname || lastName, birthSurname lastName, researchId /^P\d{1,7}$/, eventValues nejnovější první, sortKey jména), pinnedWidth 156 na telefonu · table-state.ts MIN_COLUMN_WIDTH, BAND_WIDTH, lockedColumn · table-checks.ts bandSeverity · table-colpanel.ts panelGroups · table-headmenu.ts headMenuItems · strings.ts table.group.*, col.*, columns, columnsCount, searchColumn, all, pinnedLabel, resetColumns, done, coverageRow, sortAsc, sortDesc, sortAdd, sortAddHint, filterColumn, pin, unpin, moveLeft, moveRight, hide, collapseGroup, expandGroup, computedFrom · commity 89602f35, 49b96d92, e4a35406 · refn (skupina person, textCell p.refn; commit 7e648e24, T54 F3), question, crossTree (crossTreeCell), personStatus (personStatusCell, cardStatus, CARD_STATUS_CLASSES), strings.ts table.col.refn, question, crossTree, personStatus · „Celé jméno“ (id `name`) a sloupec firstName, záhlaví „Ref. číslo“ bez „(REFN)“: commity 79764eba, 8fdf52ca (T54 G10, G3) · 3.30.0: app:45f7ca2a table-columns.ts:732 uPhoto (group uextra, skrytý) · app:0971647c table-columns.ts addedCell (dateCell, sortKey + zlomek dne, bez údaje emptyCell s textem earlier), sloupec added (group person, nenabízí se ve výchozím stavu), strings.ts table.col.added, table.earlier · e2e/person-list-table.spec.ts, src/__tests__/table-view-added.test.ts · app:cecd72a4 table-columns.ts lineage (group person, skrytý, getFocusPersonId, řazení paternal → both → maternal → descendant, prázdné poslední, filtr hodnot), table-grid.ts lineageHtml (znak ve zvoleném tvaru), strings.ts branchColors.tableColumn, tableBoth, tableDescendant, tableSlotBoth · app:675e1c5e strings.ts table.col.rLine „Linie výzkumu“ (do 3.29.0 „Linie“), src/__tests__/table-column-labels-unique.test.ts -->

<a id="A6.7.3"></a>
### A6.7.3 Wartości obliczone i zastępcze

Czego w drzewie nie zapisano, ale da się to policzyć z danych, tabela oblicza. Niczego przy tym do drzewa nie
zapisuje.

| Wartość | Jak się liczy |
|---|---|
| wiek (przy urodzeniu dziecka, ślubie, zgonie) | z dat z dokładnym dniem („67”); z roku, miesiąca lub zakresu jako zakres („28–29”); z daty z ok., przed lub po jako szacunek („≈ 67”) |
| zastępcza data i miejsce | bez urodzenia chrzest („chrz. 3.5.1850”), bez zgonu pochówek („poch. …”); wiek z nich to szacunek (≈) |
| **Różnica wieku zapisanego** | o ile lat zapisany wiek wychodzi poza zakres wieku z dat („+3”, „−2”); wieku słownego i wieku z ok., przed, po się nie porównuje |
| **Długość związku** | od ślubu do rozwodu, w przeciwnym razie do pierwszego zgonu z pary |
| **Kolejność wśród rodzeństwa**, **Liczba rodzeństwa**, **Liczba dzieci**, **Liczba związków**, **Liczba źródeł** | z powiązań i źródeł drzewa |

- Daty mają przed sobą słowo dokładności (**ok.**, **przed**, **po**). Niepewna data jest podkreślona kropkami; nie
  jest to ustalenie. Datę sortuje się według jej początku.
- **Granice:** wieku się nie liczy, gdy koniec poprzedza początek. Kolumny zgonu mają przy osobie żyjącej **Nie
  dotyczy** (przy **Kompletność zgonu** „żyje”). **Wiek ojca/matki przy urodzeniu** bez zapisanego rodzica to **Nie
  dotyczy**.
- **Obsługa:** podpowiedź przy komórce („Chrzest, urodzenie nieznane”, „Pochówek, zgon nieznany”); przy kolumnie
  obliczonej w menu nagłówka „Obliczono z: …”; legenda **Oznaczenia** ([A6.7.13](#A6.7.13)).

<!-- zdroj: app:src/ui/table-view/table-columns.ts ageCell (přesně / rozsah ageRangeBetween / ≈ approxAgeBetween; nic, když konec před začátkem), dateCell, qualifierWord, birthOrBaptism, deathOrBurial (náhrada, ≈), gapCell (recordedAgeGap), unionLength, naCell, parentsOf · src/dates.ts:448 ageRangeBetween, recordedAgeGap · table-model.ts dateNumber (začátek rozsahu) · strings.ts table.na, living, subst.*, qual.*, computedFrom, from.* · commit 8833da14 -->

<a id="A6.7.4"></a>
### A6.7.4 Kompletność i wiersz pokrycia

Kolumny **Kompletność …** mówią, ile śledzonych pól jest wypełnionych, w procentach.

| Kolumna | Liczy się z |
|---|---|
| **Kompletność urodzenia** | data, miejsce, ojciec, matka, źródło |
| **Kompletność związku** | data, miejsce, partner, źródło ślubu; przy związku bez ślubu (**Partnerzy**, **W separacji**) tylko partner |
| **Kompletność zgonu** | data, miejsce, źródło (nie przy osobie żyjącej) |
| **Kompletność ogółem** | urodzenie, każdy związek i zgon, ważone liczbą pól |

- Wartość zastępcza (chrzest, pochówek) pola nie wypełnia. Podpowiedź przy komórce wypisuje, czego brakuje („brak:
  miejsce urodzenia, źródło urodzenia”).
- **Wiersz pokrycia** pod nagłówkiem pokazuje przy każdej kolumnie, ile procent wierszy ma wartość („wypełniono
  64 %”, podpowiedź „77 z 120”). Słowo „wypełniono” stoi w pierwszej kolumnie, jakakolwiek to jest (od aplikacji 3.28.0;
  wcześniej w kolumnie imienia i nazwiska), także w eksporcie XLSX. Przy kolumnach **Kompletność …** pokazuje średnią kompletność wierszy (podpowiedź
  „średnia z 120”). Liczy tylko wiersze, które są właśnie widoczne (po filtrze i wyszukiwaniu). Komórek
  **Nie dotyczy** się nie liczy; przy kolumnach związku liczą się związki, które spełniają filtr. Poniżej 50 % liczba
  jest pogrubiona; bez komórki, której by dotyczyła, jest „–”.
- **Związek bez ślubu** (typ **Partnerzy** lub **W separacji**): puste komórki ślubu (data, miejsce, wiek i wiek
  zapisany obojga, różnica wieku zapisanego, świadkowie, **Wiarygodność ślubu**) mają „–” z podpowiedzią „Nie dotyczy:
  związek bez ślubu” i nie liczą się ani do wiersza pokrycia, ani do kompletności. Wartość, która mimo to tam jest
  (początek związku z formularza związku), pokazuje się jak dotąd.
- **Obsługa:** **Wiersz pokrycia** w panelu **Kolumny** (na telefonie w **⋯**); zapisuje się z widokiem.

<!-- zdroj: app:src/ui/table-view/table-columns.ts compCell, unionComp (pole a váhy, náhrada nevyplní) · table-coverage.ts cellFilled, columnCoverage, coverageCell, coverageLabel (LOW pod 50 %) · table-subrows.ts coverageUnionsOf · strings.ts table.compList.*, compField.*, missing, missingNone, compCounts, coverage, coverageOf · rozhodnutí Milan 10. 11. (spec 073, bod 5) · commit 8833da14 · průměr u sloupců úplnosti (kind percent): table-coverage.ts columnCoverage average, strings.ts table.coverageAverage, i XLSX, commit 56f3418c (T54 G12) · „vyplněno“ v prvním sloupci: app:4b1373a7 table-ui.ts coverageOf (firstId), table-xlsx.ts labelAt, commit 19dbb595 · svazek bez sňatku: table-columns.ts unionWithoutWedding (partners, separated), weddingCell, oneUnionFields (jen partner), strings.ts table.naNoWedding, compList.unionNoWedding, commit 8fdf52ca (T54 G5, MILAN.md rozhodnutí 21) -->

<a id="A6.7.5"></a>
### A6.7.5 Ustalenia kontroli w komórkach

Tabela pokazuje ustalenia Jakości danych ([A5](A5-tree-check.md)) bezpośrednio przy danej, której dotyczą: komórka
jest podbarwiona i ma oznaczenie poziomu. Kontrola działa nad całym drzewem w tle, gdy aplikacja jest wolna.

| Poziom | Oznaczenie w legendzie |
|---|---|
| **błąd** | „Dane są ze sobą sprzeczne.” |
| **do sprawdzenia** | „Nietypowa wartość warta sprawdzenia.” |
| **trop** | „Trop do poszukiwań, nie błąd.” |
| **nietypowe** (☆) | „Ustalenie oznaczone „To nie błąd”.” |

- Ustalenie trafia do komórki danej: wiek rodzica przy urodzeniu do **Wiek ojca/matki przy urodzeniu** przy dziecku,
  ustalenie dotyczące ślubu do wieku i daty ślubu, zapisany wiek do zapisanego wieku i jego różnicy, zgon przed
  urodzeniem do obu dat i wieku, zdarzenie do kolumny zdarzenia, różnica wieku partnerów do partnera, możliwy
  duplikat do imienia i nazwiska, zapis miejsca do komórek z tym miejscem. Ustalenie bez własnej komórki jest tylko
  w kolumnach kontroli.
- Kolumny grupy **Kontrole**: **Ustalenia** (liczba; „…”, dopóki kontrola trwa), **Najwyższy poziom**, **Nietypowe,
  sprawdzone** (liczba ustaleń oznaczonych **To nie błąd**).
- Ustalenie oznaczone **To nie błąd** ([A5.7](A5-tree-check.md#A5.7)) zostaje w komórce jako **nietypowe**
  („Nietypowe, ale sprawdzone”) i nie liczy się do ustaleń.
- **Granice:** drzewo tylko do odczytu nie pozwala oznaczyć ustalenia („Drzewo tylko do odczytu: nie można oznaczać
  ustaleń.”).
- **Obsługa:** kliknięcie oznaczenia otwiera dymek (na telefonie panel od dołu): poziom, tekst ustalenia, „Ustalenie
  1 z 2” i
  - **To nie błąd** (powiadomienie „Oznaczono: to nie błąd” z **Cofnij**); przy nietypowym **Zgłaszaj ponownie**;
  - **Jakość danych ›** otwiera okno Jakości danych na grupie tego ustalenia; przy nietypowym na liście oznaczonych.

  Komórki **Ustalenia** i **Najwyższy poziom** otwierają listę wszystkich ustaleń osoby (kliknięcie, Enter,
  stuknięcie; na telefonie panel od dołu): przy każdym poziom, tekst i kogo lub czego dotyczy; zgłaszane według
  poziomu, oznaczone **To nie błąd** na końcu.

  Legenda **Oznaczenia** („Oznaczenia w komórkach”) objaśnia też niepewną datę, wiarygodność, wartość zastępczą,
  obliczenie i **Nie dotyczy**. Jak które oznaczenie wygląda: [A6.7.13](#A6.7.13).

<!-- zdroj: app:src/ui/table-view/table-checks.ts severityRank, parentAgeColumn, issueTargets (mapování nálezů na buňky), buildCheckIndex, CHECK_COLUMNS, applyChecks · table-ui.ts whenIdle (validateTreeData jednou), cellFindings · table-bubble.ts bubbleHeading, bubbleHtml, legendHtml, openBubblePanel, sheetElement · src/ui/tree-stats.ts showTreeValidationDialog (focus: skupina otevřená a posunutá; označené → seznam) · strings.ts table.sev.*, unusualChecked, notError, reReport, toQuality, dismissedToast, roNote, checksRunning, findingOf, legend, legendTitle, legendKind.*, legendText.* · commity 19cf28ea, e530019b, 59a8eed0 · seznam nálezů osoby z buněk Nálezy a Nejvyšší úroveň: commit 75de3a9b (T54 F5) -->

<a id="A6.7.6"></a>
### A6.7.6 Filtr, wyszukiwanie i sortowanie

Filtr wybiera wiersze, wyszukiwanie zawęża je dalej, sortowanie ustala kolejność.

- **Chipy** tabeli osób (związki chipów nie mają, wydarzenia i źródła mają własne, [A6.7.10](#A6.7.10), [A6.7.11](#A6.7.11)): **Żyjący**, **Zmarli** (wykluczają się), **Krewni**, **Ród** (wybór rodów),
  **Pokolenie** (zakres), **Kilka związków**, **Bez daty urodzenia**, **Niepewna data** (urodzenia lub zgonu),
  **Bez źródła**, **Z ustaleniami** (błąd lub do sprawdzenia; trop nie), **Nietypowe**, **Niepotwierdzone z badania**
  (tylko drzewo z badania). Chipy ustaleń czekają na kontrolę („Gdy sprawdzanie się skończy”). Co się nie zmieści,
  jest w **Więcej (n)**.
- **Filtr w kolumnie** (**Filtr…** w nagłówku) według rodzaju kolumny:
  - wartości z listy (płeć, stan związku, poziom ustalenia, ród …);
  - zakres **od**–**do** (przy dacie **Rok**, przy wieku, liczbie i procentach liczba);
  - tekst: **zawiera** · **zaczyna się od** · **jest** · **nie jest** (bez względu na wielkość liter i znaki
    diakrytyczne; chip „Kolumna = wartość ×” lub „Kolumna ≠ wartość ×”; szybko z menu komórki,
    [A6.7.15](#A6.7.15));
  - przy każdym **Tylko puste** · **Tylko wypełnione**.
- Obowiązują wszystkie filtry naraz. Liczba filtrów jest na **Filtry (n)**, wszystko anuluje **Wyczyść filtry**. Bez
  wiersza: „Nic nie pasuje do filtru”.
- **Szukaj w tabeli:** od 2 znaków, bez względu na wielkość liter i znaki diakrytyczne, w widocznych kolumnach
  i w podwierszach związków; trafienia są wyróżnione, nad tabelą jest ich liczba.
- **Sortowanie:** kliknięcie nagłówka sortuje rosnąco, kolejne kliknięcie malejąco, trzecie sortowanie anuluje;
  sortuje się tylko według tej kolumny. Shift + kliknięcie dodaje kolumnę jako kolejny klucz (kolejne kliknięcie go
  odwraca, trzecie usuwa). Strzałka ↑ ↓ przy nagłówku ma numer kolejności klucza. Puste wartości są zawsze na końcu,
  w obu kierunkach. Liczby w tekście sortują się jak liczby.
- **Granice:** wyszukiwanie nie zapisuje się w widoku ([A6.7.7](#A6.7.7)).
- **Od aplikacji 3.30.0:**
  - wykluczenia się sumują: każde **Bez „{wartość}”** z menu komórki ([A6.7.15](#A6.7.15)) jest osobnym chipem
    „{Kolumna} ≠ {wartość} ×” obok głównego filtru kolumny, w tej samej i w innej kolumnie. × usuwa tylko swój chip,
    **Wyczyść filtry** wszystkie. Formularz chipu edytuje tylko ten chip, formularz w nagłówku główny filtr kolumny;
  - drugie **Tylko „{wartość}”** w kolumnie dodaje wartość: „Ojciec = A lub B” (od czterech wartości „A, B +2”),
    wiersz przechodzi z dowolną z nich. **Bez** takiej wartości znowu ją usuwa (przy ostatniej staje się z niej
    wykluczenie), **Tylko** wykluczonej wartości wykluczenie usuwa. W kolumnie z wartościami z listy wybrane wartości
    dodają się i ubywają tak samo;
  - chip „= …” (i nagłówek kolumny, dopóki jego filtr to **jest**) ma zamiast pola tekstowego wartości kolumny do
    zaznaczenia: na górze zaznaczone, pod nimi pozostałe w kolejności kolumny, każda raz (ta sama osoba, w przeciwnym
    razie ten sam tekst bez względu na wielkość liter i znaki diakrytyczne). Zaznaczona wartość przybywa, odznaczona
    znika, a z ostatnią znika chip. **zawiera**, **zaczyna się od** lub **nie jest** przywraca pole tekstowe
    z pierwszą zaznaczoną wartością. Na telefonie wiersze listy mają 48 px;
  - osoba, której imię i nazwisko w drzewie pokazuje też inna osoba, ma w chipie, na liście wartości i w podsumowaniu
    filtrów rok urodzenia: „Jan Horák (ur. 1850)”. Pozostałe wartości są bez zmian;
  - widok zapisuje chipy ([A6.7.7](#A6.7.7)), widok zapisany wcześniej otwiera się bez zmian, a wersja danych
    zostaje. Starsza aplikacja stosuje wszystkie wykluczenia, a z „A lub B” tylko pierwszą wartość;
  - wiele chipów skraca się „…”, **Wyczyść filtry** zostaje w wierszu.

<!-- zdroj: app:src/ui/table-view/table-filter.ts CHIP_ORDER, setChip (Žijící × Zemřelí), personPassesChip (finding: chyba nebo k ověření; unusual; unconfirmed jen researchTree, relN/relB/relD), CHECK_CHIPS, rodChoices, generationSpan, filterKindOf, cellPasses, foldText · table-filterbar.ts SEARCH_DELAY_MS, columnFilterForm, chipChoiceForm · table-state.ts řazení (vzestupně → sestupně → vypnuto; Shift přidá, otočí, odebere; prázdné na konci; Intl.Collator numeric) · strings.ts table.chip.*, chipRod, chipGen, moreN, filters, clearFilters, search, matches, noMatch, checksWait, matchContains, matchStarts, rangeFrom, rangeTo, rangeYears, onlyEmpty, onlyFilled · commity dd1d74bc, e64b8b06, fc746037 · je / není: strings.ts table.matchEquals, matchNotEquals (commit 05d9a9ab, T54 F4) · 3.30.0: app:ec39d469 table-filter.ts isExclusionItem, addWithoutFilter, addOnlyFilter (or, picked), removeColumnItemAt, mainItemIndex, setColumnFilter(at), equalValues · strings.ts joinOr (od 4 hodnot „A, B +2“), table.filterOr · app:8891a860 table-filter.ts columnEqualValues, equalChoices, equalsOf, equalValueLabel, namesakes, table.nameBorn (nar.), table-filterbar.ts (.tv-ff-values, 48 px na telefonu) · CHANGELOG.cs.md 3.30.0 „Filtry Tabulky“ · spec 103 K1.1–K1.5 · dirigent:test/vysledek-1116-app-103-tabulka.md, vysledek-1116-app-103-odkazy-083-razeni.md -->

<a id="A6.7.7"></a>
### A6.7.7 Widoki tabeli

Widok to zapisane pod nazwą ustawienie tabeli. Wbudowane widoki to gotowe odczytania drzewa; własny widok zapisuje
sobie człowiek.

| Widok wbudowany | Wiersze | Co pokazuje |
|---|---|---|
| **Przegląd** (domyślny dla osób) | osoby | imię i nazwisko, data i miejsce urodzenia, data zgonu, wiek w chwili zgonu, partner, data ślubu i wiek przy nim, ustalenia, kompletność ogółem; sortowanie według daty urodzenia |
| **Urodzenia i rodzice** | osoby | urodzenie i chrzest, rodzice, ich wiek przy urodzeniu, kompletność urodzenia; sortowanie według daty urodzenia |
| **Śluby** (domyślny dla związków) | związki | para, data i miejsce ślubu, wiek i zapisany wiek obojga, stan, świadkowie, rozwód, dzieci, długość, źródła, kompletność; sortowanie według daty ślubu |
| **Zgony** | osoby | zgon, przyczyna, pochówek, wiek i zapisany wiek w chwili zgonu, kompletność zgonu; chip **Zmarli**; sortowanie według daty zgonu |
| **Źródła i cytaty** | osoby | liczba źródeł, udokumentowanie, wiarygodność urodzenia i zgonu; od najmniejszej liczby źródeł |
| **Luki** | osoby | kompletność ogółem i według części, urodzenie, rodzice, źródła; od najmniej kompletnych; związki zwinięte |
| **Kontrole** | osoby | poziom i liczba ustaleń, daty, wiek rodziców, ślub; chip **Z ustaleniami**; od najwyższego poziomu, potem liczby ustaleń |
| **Wszystkie wydarzenia** (domyślny dla wydarzeń) | wydarzenia | typ, osoba lub para, data, miejsce, wiek w chwili wydarzenia, chrzestni, świadkowie, celebrans, źródło; sortowanie według daty |
| **Wszystkie źródła** (domyślny dla źródeł) | źródła | tytuł, archiwum, księga i sygnatura, online, osób, faktów, przeczytane w badaniu, transkrypcja; sortowanie według tytułu |

- **Widok zapisuje:** typ wierszy, kolumny (kolejność, szerokości, przypięcie, zwinięte grupy), wiersz pokrycia, filtr,
  sortowanie i rozwinięcie związków; od aplikacji 3.30.0 także zakres ([A6.7.19](#A6.7.19)) i grupowanie wierszy
  ze zwiniętymi grupami wierszy ([A6.7.20](#A6.7.20)), przy źródłach nie. Nie zapisuje wyszukiwania, wyboru wiersza
  ani przewinięcia.
- Zmieniony widok ma etykietę **zmieniono** i opcje **Zapisz**, **Zapisz jako nowy**, **Odrzuć zmiany**. Widok
  wbudowany się nie zmienia ani nie można go przemianować czy usunąć; jego zmiany można tylko **Zapisz jako nowy**.
  Własny widok: **Zmień nazwę…**, **Usuń** (z potwierdzeniem). Własne widoki są uporządkowane według nazwy.
- Bieżący stan tabeli aplikacja pamięta dla każdego drzewa na tym urządzeniu; po odświeżeniu strony lub aktualizacji
  aplikacji tabela jest taka, jaka została. Należą do niego niezapisane zmiany każdego widoku, także tego, z którego
  się przełączono: po powrocie widok nadal ma etykietę **zmieniono**. **Zapisz**, **Zapisz jako nowy** i **Odrzuć
  zmiany** je załatwiają. Uszkodzona część bieżącego stanu zostaje pominięta.
- **Zapisane widoki są częścią drzewa** (wersja danych 17): zapisanie, zmiana nazwy i usunięcie mają krok wstecz
  i wpis w historii zmian. Idą z drzewem do kopii zapasowej (JSON), a przy wydzieleniu części drzewa także do nowego
  drzewa. GEDCOM ich nie niesie; drzewo z badania zachowuje je przy wczytaniu nowej wersji. Uszkodzony widok przy
  wczytaniu się pomija.
- **Granice:** starsza aplikacja (od 3.19.0) otwiera drzewo zapisane aplikacją 3.27.0 tylko do odczytu i nigdy go nie
  zapisuje; po aktualizacji aplikacji drzewo można znowu zmieniać.
- **Obsługa:** menu **Widok** na pasku tabeli (**Wbudowane**, **Własne**, **Zapisz jako nowy…**, **Zmień nazwę…**,
  **Usuń**).

<!-- zdroj: app:src/ui/table-view/table-views.ts BUILTIN_VIEWS (9: overview, births, marriages, deaths, sources, gaps, checks, events, allSources), defaultViewId (události → Všechny události, prameny → Všechny prameny), defaultViewId, viewFromState, viewChanged, uniqueViewName, customViews (podle jména), workStorageKey strom.table.{treeId}, readTableWork, writeTableWork · table-columns.ts výchozí sloupce pohledů (:683 Sňatky, DEFAULT_VIEWS.events, .sources) · src/table-views-data.ts sanitizeTableView, keepTableViews (verze z výzkumu ponechá pohledy) · src/data.ts:298 sanitizeTableViews při načtení, :1720 saveTableView, deleteTableView (krok zpět, historie změn) · src/subtree.ts:148 · src/types.ts STROM_DATA_VERSION 17, StromData.tableViews · src/tree-manager.ts:630 isTreeNewer, src/data.ts:649 isNewerData (jen ke čtení, od aplikace 3.19.0) · src/ui/research-ui.ts, conflict-decide-ui.ts keepTableViews · strings.ts table.view, views.*, viewName.* (events, allSources), changed, save, saveAs, discard, builtinNote, saveAsMenu, renameMenu, deleteMenu, builtinLocked, viewWhat, deleteConfirm · commity d19a5942, c2d48747, 8ca649ff · neuložené změny všech pohledů v pracovním stavu (localStorage) se sanitizací: commit b1cbe546 (T54 G9, varianta c) -->

<a id="A6.7.8"></a>
### A6.7.8 Akcje wiersza i edycja

Kliknięcie wybiera wiersz (także podwiersz związku); strzałki, Page Up/Down i Ctrl+Home/End przesuwają wybór, Esc go
anuluje.

| Akcja | Co zrobi |
|---|---|
| **Pokaż w drzewie** | przełącza na widok Rodzina z osobą jako osobą w centrum, wyśrodkowaną i wyróżnioną |
| **Otwórz osobę** (Enter) | otwiera stronę osoby |
| **Edytuj…** (dwuklik) | otwiera edycję osoby; przy podwierszu związku i w tabeli związków relacje osoby w tym związku |

- W tabeli związków akcje dotyczą osoby **Partner 1**.
- W tabeli wydarzeń dotyczą pierwszej osoby wiersza, a **Edytuj…** otwiera edycję tego wydarzenia ([A6.7.10](#A6.7.10));
  w tabeli źródeł jest **Otwórz źródło** ([A6.7.11](#A6.7.11)).
- Po edycji powiadomienie „Zapisano: …”, wiersz krótko mignie, a wiersze zostają w kolejności. Wiersz, który już nie
  spełnia filtru, zostaje z etykietą „nie pasuje do filtru” do następnej zmiany sortowania, filtru lub widoku. Zmianę
  z badania zgłasza „Badanie zmieniło 3 dane: …”.
- Jedną daną można edytować także bezpośrednio w komórce ([A6.7.15](#A6.7.15)).
- **Od aplikacji 3.30.0:** menu wiersza (i panel wiersza na telefonie) ma **Dodaj do listy ›** dla osób wiersza, wybór
  przez kilka wierszy **Dodaj N osób do listy ›**; w zakresie listy stałej także **Usuń z listy**
  ([A11.5](A11-lists-of-people.md#A11.5), [A6.7.19](#A6.7.19)).
- **Granice:** w drzewie tylko do odczytu **Edytuj…** nie ma ani **Dodaj do listy ›**.
- **Obsługa:** przyciski ⌖ ▤ ✎ na końcu wiersza, nad żadnym tekstem komórki: przy myszy pokażą się, gdy wskaźnik
  był na wierszu poza nimi, przy wybranym wierszu także ze wskaźnikiem gdzie indziej; menu wiersza (prawy przycisk;
  także rozwinięcie związków). Stuknięcie palcem w wiersz (telefon, wąskie okno, urządzenie obsługiwane głównie
  dotykiem) otwiera panel z akcjami i ze związkami („Związek 1: … · Edytuj ›”).
- **Od aplikacji 3.28.0:** kliknięcie myszą lub piórem tylko wybiera wiersz i komórkę na każdym urządzeniu, także na
  laptopie z ekranem dotykowym, tablecie z myszą i w wąskim oknie; decyduje wskaźnik kliknięcia, nie urządzenie. Do
  3.27.0 na urządzeniu dotykowym i w wąskim oknie każde kliknięcie otwierało panel wiersza. Akcje wiersza stoją na
  jego końcu, więc kolumna osób ma na wybranym wierszu całą szerokość.

<!-- zdroj: app:src/ui/table-view/table-ui.ts tableMethods (tableRowAction: tree → Rodina, focus, highlight; open; edit → dialog osoby / panel vztahů na svazku), personOfRow (Partner 1), keepWork · table-refresh.ts keepOrder, watchEdit, changedKeys, bridgeChanges, namesList · table-grid.ts FLASH_MS · strings.ts table.act.*, dblClickHint, actionsOf, unionWith, editMore, staleRow, savedToast, bridgeToast · commity da6b9786, de46ae30, e4a35406 · od 3.28.0: table-grid.ts clickPointerType, isMouseLikePointer, table-ui.ts onRowClick (panel jen klepnutí a isPhoneBar | isCoarsePointer), commit ee38c7a6; rowActions ⌖ ▤ ✎ v .tv-acts-dock, armRowActions (myš a pero), commit 80c2ffb9 -->

<a id="A6.7.9"></a>
### A6.7.9 Eksport CSV i XLSX

Eksport zapisuje tabelę tak, jak jest widoczna, do pliku dla programów arkuszy kalkulacyjnych: **CSV** lub **XLSX**
(skoroszyt Excela).

- **Co trafia do pliku:** widoczne kolumny w kolejności tabeli (kolumny zwiniętej grupy w całości) i wiersze po
  filtrze, wyszukiwaniu i sortowaniu. Wartości są takie, jak pisze je tabela: daty w zapisie aplikacji, „ok. …”,
  „≈ 67”, „chrz. …”, „–”.
- **Wiersze:** bez filtru i wyszukiwania do pliku trafiają wszystkie wiersze („Wszystko widoczne · 120 osób”).
  Z filtrem lub wyszukiwaniem jest wybór:
  - **Widoczne** (domyślnie): tylko wiersze, które tabela pokazuje, z liczbą i przypomnieniem filtru („Widoczne · 28
    z 866 osób (obowiązuje filtr: …)”);
  - **Wszystkie … bez filtru** („Wszystkie osoby bez filtru · 866”): wszystkie wiersze tego typu w kolejności według
    sortowania, bez filtru i wyszukiwania.

  Wiersz z etykietą „nie pasuje do filtru” ([A6.7.8](#A6.7.8)) do widocznych nie należy.
- Osoba z dwoma i więcej związkami: pierwszy związek, który spełnia filtr, jest w jej wierszu, każdy kolejny
  w wierszu kontynuacji z pustymi danymi osoby. Za imieniem i nazwiskiem jest kolumna **Związek** („1 z 3”).
- **CSV:** tekst, UTF-8 ze znacznikiem BOM, separator średnik, końce wierszy CRLF; komórka, która w arkuszu
  kalkulacyjnym uruchomiłaby się jako formuła, jest unieszkodliwiana. Oznaczenia ustaleń i kolory się nie eksportują.
- **XLSX:** jeden arkusz nazwany według widoku.
  - Wiersz 1 to grupy kolumn (scalone komórki), wiersz 2 nagłówek, wiersz 3 wiersz pokrycia ([A6.7.4](#A6.7.4)).
    Przypięte kolumny tabeli i te trzy wiersze są w arkuszu zablokowane.
  - Każda grupa kolumn to konspekt: można ją zwinąć, jej pierwsza kolumna zostaje. Wiersze kontynuacji związków są
    o poziom niżej pod wierszem osoby (poziom 2 konspektu wierszy).
  - Komórka z ustaleniem **błąd** lub **do sprawdzenia** jest podbarwiona, a ustalenia ma w komentarzu. Trop
    i nietypowe nie mają ani koloru, ani komentarza.
  - Liczby, wiek w pełnych latach i kompletność są liczbami (kompletność i pokrycie jako procent); reszta to tekst,
    tak jak pisze go tabela (także „≈ 67”, „28–29”, daty). Tekst nigdy nie staje się formułą. Link źródła jest
    w komórce jako link.
- **Od aplikacji 3.30.0:** w zakresie listy osób pierwsze kolumny to **#** i przy liście roboczej **Gotowe** (✓)
  ([A6.7.19](#A6.7.19)); pogrupowana tabela ma przed nimi kolumnę **Grupa** ([A6.7.20](#A6.7.20)).
- **Plik:** `{drzewo}_{widok}_{RRRR-MM-DD}.csv` lub `.xlsx`, bez znaków diakrytycznych.
- **Obsługa:** **Eksport ▾** na pasku tabeli (na telefonie w **⋯**): **Format** „CSV · dla Excela i Arkuszy Google”
  lub „XLSX · grupy, zablokowane kolumny, kolory kontroli”, **Wiersze**, **Pobierz CSV** / **Pobierz XLSX**;
  powiadomienie „Pobrano: …” z liczbą osób, wierszy i kolumn.
- **Granice:** eksport z menu drzewa (**Tabela osób (CSV)**, [A7](A7-book-pages-and-export.md)) to inny plik
  ze stałymi kolumnami.
- **Obowiązuje od:** aplikacja 3.27.0

<!-- zdroj: app:src/ui/table-view/table-export.ts tableCsvField (neutralizace vzorců), buildExportTable, buildTableCsv (BOM, ;, CRLF, pokračovací řádky, sloupec Svazek), fileNamePart, tableCsvFileName (csv | xlsx) · table-xlsx.ts buildTableXlsx (řádky 1–3, merges, outline sloupců za ukotvenou částí, pokračovací řádky outline 1, freeze, errorFill/warningFill + findingsComment jen chyba a k ověření, href), xlsxNumber (COUNT_COLUMNS, věk ^\d+$, procento) · src/xlsx.ts (ignoredErrors numberStoredAsText, styl @ pro text) · table-viewbar.ts exportForm (Formát, Řádky: Zobrazené / Všechny bez filtru jen s filtrem nebo hledáním) · table-ui.ts tableExportNow (unfiltered: všechny řádky typu v řazení, stale ven) · strings.ts table.export, exportFormat, exportRows, exportCsv, exportXlsx, exportAll, exportShown, exportFilterNote, exportUnfiltered.*, exportWhat.*, exportWhatAll.*, exportFile, exportDownload, exportDownloadXlsx, csvUnionCol, csvUnionOf, exportedToast · commity 2368683b, 5a67797b, 4308633b, e0ce4ec2, ebc1542f, e5b97725 · dirigent:prace/1110-app-tabulka-p2, 1110-app-tabulka-opravy -->

<a id="A6.7.10"></a>
### A6.7.10 Wydarzenia w wierszach

Tabela wydarzeń ma wiersz dla każdego wydarzenia drzewa: kto, kiedy, gdzie, w jakim wieku i kto przy tym był.

- **Co jest wierszem:**
  - każde wydarzenie osoby (chrzest, zawód, miejsce zamieszkania, służba wojskowa …) i każde wydarzenie pary;
  - urodzenie i zgon z danych osoby, gdy jest przy nich coś zapisane (data, miejsce, adres, źródło; przy zgonie także
    przyczyna lub wiek);
  - ślub związku: przy małżeństwie zawsze, przy innej relacji („Początek związku”) tylko z zapisaną daną; rozwód
    („Koniec związku”), gdy związek jest rozwiedziony albo zapisano jego koniec.
- **Wspólne wydarzenie** (miejsce zamieszkania, spis ludności, służba wojskowa, emigracja, imigracja, naturalizacja, własne
  wydarzenie) zapisane przy kilku osobach tak samo to jeden wiersz ze wszystkimi osobami. Tak samo znaczy: ten sam typ,
  data, miejsce, adres, notatka i źródła; data musi być zapisana, a do niej miejsce lub źródło. Chrzest, zawód lub
  tytuł należy zawsze tylko do jednej osoby.
- **Od aplikacji 3.28.0:**
  - wspólne wydarzenie ([A10.1](A10-shared-events.md#A10.1)) to jeden wiersz ze wszystkimi jego osobami, nawet gdy
    jego kopie się różnią. Takie same kopie bez wspólnego wydarzenia (starsze dane) nadal łączą się w jeden wiersz
    według danych; to tylko widok, zmiana trafia do jednej kopii;
  - komórka osób ma liczbę („N osób”). Wiek pokazuje wiek każdej osoby („42 · 38”) z dymkiem „Wiek według zapisu ·
    każdy własny”; gdy kopie się różnią, komórka ma „różni się u N” ([A10.3](A10-shared-events.md#A10.3));
  - zmiana **Data** lub **Miejsce** bezpośrednio w komórce zmienia wszystkie kopie wspólnego wydarzenia („{Pole}:
    zmieniono u N osób ({wydarzenie}).”), jeden krok **Cofnij**.
- **Kolumny** w grupach **Wydarzenie** · **Uczestnicy** · **Źródło**:
  - **Typ**, **Osoba lub para** (przy parze najpierw krewny osoby głównej), **Data**, **Miejsce**;
  - **Wiek w chwili wydarzenia** jak gdzie indziej ([A6.7.3](#A6.7.3)); do jednego roku z dokładnych dat w dniach
    („12 dn.”); przy kilku osobach wiek każdej w kolejności imion („–” nieznany); przy urodzeniu **Nie dotyczy**;
  - **Wartość**: wartość wydarzenia (zawód, tytuł), w przeciwnym razie przyczyna; przy zgonie przyczyna zgonu;
  - **Chrzestni**, **Świadkowie**, **Celebrans**, **Inni obecni**: uczestnicy według roli; osoba drzewa jest linkiem;
  - **Źródło**: cytowane źródła „tytuł, sygnatura”, kilka oddzielonych średnikiem; **Wiarygodność** danej.
- **Chipy:** **Urodzenia i chrzty** (także urodzenie z danych osoby), **Śluby** (także zaręczyny, zapowiedzi,
  zezwolenie, umowa), **Zgony i pochówki** (także kremacja), **Inne wydarzenia**, **Bez źródła**.
- **Filtr według uczestnika:** kliknięcie imienia uczestnika proponuje „Filtr: chrzestny …” (przy osobie drzewa także
  **Otwórz osobę**). Filtr to chip „Chrzestny: … ×” (Świadek, Celebrans, Obecny) i zastępuje poprzedni filtr
  uczestnika. Osobę drzewa szuka według osoby, zapisane imię według liter bez względu na wielkość, znaki diakrytyczne
  i spacje.
  **Od aplikacji 3.30.0** menu (także panel od dołu na telefonie i urządzeniu dotykowym) uczestnika, który jest
  osobą drzewa, zaczyna się pozycją **Przejdź do {imię}**: skok do jego wiersza w tabeli osób ([A6.7.16](#A6.7.16)).
  Imiona w kolumnie **Osoba lub para** zostają, jak były.
- **Chrzestny, który się powtarza** ([A5.5](A5-tree-check.md#A5.5)), jest w komórce uczestnika jako **trop**.
- **Obsługa:** wbudowany widok **Wszystkie wydarzenia**; akcje wiersza ([A6.7.8](#A6.7.8)) dotyczą pierwszej osoby
  wiersza. **Edytuj…** otwiera przy wydarzeniu osoby edycję osoby na tym wydarzeniu (przy wspólnym na pierwszej
  kopii), przy urodzeniu i zgonie edycję osoby, przy wydarzeniu pary jego okno, przy ślubie i rozwodzie relacje osoby
  w tym związku.
- **Granice:** osoby zastępcze nie mają wierszy; urodzenie i zgon bez zapisanej danej nie mają wiersza.
- **Obowiązuje od:** aplikacja 3.27.0; 3.28.0: spis ludności przy osobie jest wspólnym wydarzeniem, wspólne
  wydarzenie to jeden wiersz; 3.30.0: **Przejdź do …** w menu uczestnika

<!-- zdroj: app:src/ui/table-view/table-events.ts buildEventRows (narození/úmrtí jen se zapsaným údajem, weddingRow: manželství vždy kromě marriageUnrecorded, partnersStart jen se zápisem; divorceRow), SHARED_TYPES (od 3.28.0 i census, app:34b2174c), shareKey (typ, vlastní název, datum, místo, adresa, poznámka, prameny; datum a místo nebo pramen), mergeParticipants, eventEditTarget, MARRIAGE_COUPLE_TYPES · table-columns.ts EVENT_COLUMNS, eventPersons (pokrevní první), eventAgeCell, eventAge (dny < 366), eventValueCell, eventSourceCell, eventPill, DEFAULT_VIEWS.events · table-filter.ts EVENT_CHIP_ORDER, EVENT_KIND_CHIPS, lifeCategory, participantChip, eventHasParticipant (foldName), setParticipantFilter · table-ui.ts tableNameAction, tableRowAction (event → editTableEvent) · table-checks.ts PARTICIPANT_ROLE, recurring (recurringGodparent v buňkách účastníků) · 3.28.0: app:80c2ffb9 table-events.ts (shareId → jeden řádek, bez shareId odhad podle shareKey), strings.ts table agePerPerson, sharedDiffers, events.sharedCellChanged · strings.ts table.rows.events, group.event, participants, source, col.ev*, godparents, witnesses, officiants, others, chip.ev*, chipParticipant.*, filterParticipant.*, evKind.*, ageDays, viewName.events · commity 8de751c2, 63ed9def · spec 073 §14.1 · dirigent:prace/1110-app-tabulka-p2 · 3.30.0: app:0b833e3d table-ui.ts tableNameAction (goTo první, i v listu isPhoneBar | isCoarsePointer; jména Osoba nebo pár beze změny), strings.ts table.link.goTo · spec 103 rozhodnutí D6 c -->

<a id="A6.7.11"></a>
### A6.7.11 Źródła w wierszach

Tabela źródeł ma wiersz dla każdego źródła drzewa (**Akcje → Źródła**, [A3.1](A3-evidence-in-the-app.md#A3.1))
i mówi, ile źródło w drzewie dokumentuje.

- **Kolumny** w grupach **Źródło** · **Użycie**:
  - **Tytuł**, **Archiwum**, **Sygnatura**, **Folio/strona**, **Skan**, **Dalsza lokalizacja**
    ([A3.9](A3-evidence-in-the-app.md#A3.9)), **Online** (adres źródła, w przeciwnym razie strona jego pierwszego wypisu, bez `https://`; adres internetowy jest linkiem ↗ do nowego okna, tylko http i https; zapisany
    bez schematu („www.…”) otwiera się przez https; kliknięcie linku nie zmienia wyboru wiersza);
  - **Osób**: ile osób ma daną, która cytuje to źródło; dana związku dokumentuje obu partnerów;
  - **Faktów**: ile faktów cytuje źródło. Fakt to jedna lista cytowań: cytowania osoby, urodzenia, zgonu, każdego
    wydarzenia osoby, ślubu, rozwodu i każdego wydarzenia pary;
  - **Przeczytane w badaniu**: ilu czytelników przeczytało transkrypcję („1 czytelnik”, „2 czytelników”: człowiek
    w aplikacji i badanie), w przeciwnym razie „nie”;
  - **Transkrypcja**: tak / nie; w katalogu kolumn jest też **Data wpisu**.
- Kolumny domyślne: **Tytuł**, **Archiwum**, **Sygnatura**, **Folio/strona**, **Skan**, **Dalsza lokalizacja**,
  **Online**, **Osób**, **Faktów**. **Przeczytane w badaniu** i **Transkrypcja** są tylko w panelu **Kolumny**.
- Starsze źródło ma całą lokalizację w **Dalsza lokalizacja**, a nowe komórki puste. **Sygnatura**, **Folio/strona**
  i **Skan** sortują się naturalnie (9 przed 10, 57–58 za 34), puste na końcu w obu kierunkach; filtrują się jak tekst.
- Nad tabelą może stać oferta **Podziel według propozycji…** ([A3.9.1](A3-evidence-in-the-app.md#A3.9.1)).
- Cytowania osób zastępczych i źródeł opowieści się nie liczą.
- **Chipy:** **Bez osoby** (żadna osoba go nie cytuje), **Nieprzeczytane**, **Z transkrypcją**, **Online** (tak samo jak
  kolumna **Online**, także z adresem bez `https://`).
- **Obsługa:** wbudowany widok **Wszystkie źródła**. Przy wierszu **Otwórz źródło** i **Edytuj…**; **Pokaż w drzewie**
  tu nie ma.
  - **Otwórz źródło** otwiera podgląd źródła (wycinki, cytowania; w nim **Edytuj**, gdy drzewo można zmieniać).
  - **Edytuj…** (także dwuklik, na telefonie **Edytuj…** w panelu wiersza) otwiera od razu edycję źródła, taką samą
    jak w menedżerze źródeł.
  - Po zamknięciu tabela jest taka, jaka była: wybór, przewinięcie i aktywna komórka. Menedżer źródeł (**Akcje →
    Źródła**) otwiera się dalej z menu.
  - Do aplikacji 3.29.0 **Otwórz źródło** i **Edytuj…** otwierały menedżera źródeł na tym źródle.
- **Granice:** w drzewie tylko do odczytu (także zablokowanym) źródło tylko się pokazuje, bez edycji.
- **Obowiązuje od:** aplikacja 3.27.0; **Sygnatura**, **Folio/strona**, **Skan** i **Dalsza lokalizacja** (wcześniej
  **Księga, sygnatura, folio**) także 3.27.0; podgląd źródła i edycja od razu 3.30.0

<!-- zdroj: app:a97de984 table-columns.ts:898-901 srcSig/srcFolio/srcImageNo, :1026 DEFAULT_VIEWS.sources, přirozené řazení · 8dd21adf table-bar.ts nabídka rozdělení · app:src/ui/table-view/table-sources.ts sourceUsage (PERSON_CITATION_FIELDS, události, PARTNERSHIP_CITATION_FIELDS pro oba partnery, bez zástupných, ne příběh), buildSourceRows (katalog data.sources), sourceReaders (readBy user/research/both) · table-columns.ts SOURCE_COLUMNS, urlCell, shortUrl, readersCell, DEFAULT_VIEWS.sources · table-filter.ts SOURCE_CHIP_ORDER (srcNoPerson persons 0, srcUnread, srcTranscript, srcOnline safeHttpUrl) · table-grid.ts rowTail (source: open + edit) · table-ui.ts tableRowAction (source → openTableSource), openTableSourceId (zamčený strom → showSourceViewer readOnly; od 3.30.0 app:05e24806: bez edit → showSourceViewer, s edit → showEditSourceModal, jen ke čtení → prohlížeč, focusTableAfterSource) · strings.ts table.rows.sources, group.source, group.use, col.src*, chip.src*, readers, act.openSource, viewName.allSources, sources.readBy.* · commity 1a3a49f1, 3cf69ffa · spec 073 §14.2 · dirigent:prace/1110-app-tabulka-p2 · odkaz a čip Online: safeWebUrl (http/https, www. → https, rel noopener noreferrer), commit 7e648e24 (T54 F10, F11) -->

<a id="A6.7.12"></a>
### A6.7.12 Cytowania i chrzestni w tabeli osób

Tabela osób ma kolumny, które pokazują, z jakiego źródła jest urodzenie, ślub i zgon, i kto był chrzestnym.

- **Cytowania** (grupa **Źródła**): **Urodzenie: archiwum**, **Urodzenie: sygnatura**, **Urodzenie: folio/strona**,
  **Urodzenie: skan**, **Urodzenie: dalsza lokalizacja**, **Urodzenie: URL** i to samo dla **Ślub** i **Zgon**, w tej
  kolejności; nie są domyślne. Komórka pokazuje wartość pierwszego cytowanego źródła; kolejne źródła są w przycisku
  „+N”. Starsze źródło ma całą lokalizację w **… dalsza lokalizacja**. Dymek **Pozostałe cytowania**, arkusz wiersza
  źródła na telefonie i kolumna źródła w tabeli wydarzeń podają także sygnaturę, folio i skan. Adres internetowy
  w kolumnie **… URL** jest linkiem do nowego okna, jak w kolumnie **Online** ([A6.7.11](#A6.7.11)).
  - Urodzenie bierze cytowania urodzenia, potem wydarzeń urodzenia i chrztu; zgon cytowania zgonu, potem wydarzeń
    zgonu, pochówku i kremacji; ślub cytowania związku (przy podwierszu związku tego związku). Każde źródło raz.
  - Źródła z pochodzenia danej w badaniu się nie liczą, tylko cytowania w danych.
  - Przy osobie żyjącej kolumny zgonu mają **Nie dotyczy**.
  - Sortuje się i filtruje według pierwszego źródła.
- **Od aplikacji 3.27.0:** kolumny sygnatury, folio/strony, skanu i dalszej lokalizacji (**… sygnatura** wcześniej
  pokazywała całą lokalizację).
- **Chrzestni** (grupa **Urodzenie i chrzest**): chrzestni wydarzeń urodzenia i chrztu, każdy raz; osoba drzewa jest
  linkiem. Chrzestny, który się powtarza ([A5.5](A5-tree-check.md#A5.5)), ma w komórce oznaczenie **trop**.
- **Obsługa:** kolumny włącza się pojedynczo w panelu **Kolumny** ([A6.7.2](#A6.7.2)). Kliknięcie „+N” otwiera dymek
  **Pozostałe cytowania** (na telefonie panel od dołu); kliknięcie źródła w nim otwiera podgląd źródła (w nim
  **Edytuj**), do aplikacji 3.29.0 menedżera źródeł. Po zamknięciu tabela jest taka, jaka była.
- **Obowiązuje od:** aplikacja 3.27.0; podgląd źródła 3.30.0

<!-- zdroj: app:src/ui/table-view/table-sources.ts factCitations (narození: birthSourceIds + birth/baptism; úmrtí: deathSourceIds + death/burial/cremation; sňatek: sourceIds svazku; neznámé id ven, každý jednou) · table-columns.ts citeCell (první pramen, moreSources), bArch…dUrl (group sources, unionScoped, deathOnly → naCell), godparentsCell (group birth), personGodparents · table-checks.ts personRecurring (sloupec godparents) · table-grid.ts moreCitesHtml · table-ui.ts showTableCites, openTableSourceId (od 3.30.0 prohlížeč pramene, app:05e24806) · strings.ts table.col.bArch…dUrl (bUrl „Narození: URL“, commit 7e648e24, T54 F10); 3.27.0: a97de984 bSig/bFolio/bImage/bRef…dRef, table-bubble.ts, table-events source text, godparents, moreCites, citesTitle · commity 208d8b92, 21a132c1 · spec 073 §14.3, §14.5 · dirigent:prace/1110-app-tabulka-p2 (citace: jen citace v datech, ne FactReliability.sourceIds) -->

<a id="A6.7.13"></a>
### A6.7.13 Oznaczenia w komórkach

Przegląd wszystkiego, czym tabela oznacza komórkę lub wiersz. Legenda **Oznaczenia ⓘ** po prawej nad tabelą (dymek
„Oznaczenia w komórkach”, na telefonie panel od dołu) pokazuje dwie pierwsze tabele: cztery poziomy ustalenia i pięć
rodzajów wartości; w drzewie z badania także trzecią, oznaczenia badania.

**Ustalenia kontroli** ([A6.7.5](#A6.7.5)). Oznaczenie stoi na końcu komórki za wartością; kliknięcie komórki
z ustaleniem otwiera dymek ustalenia.

| Oznaczenie | Jak wygląda | Co znaczy (legenda) | Gdzie się pojawia |
|---|---|---|---|
| **błąd** | pełne czerwone kółko z białym „!”; komórka podbarwiona na czerwono | „Dane są ze sobą sprzeczne.” | komórka danej, której dotyczy ustalenie; **Ustalenia**, **Najwyższy poziom**; zwinięta grupa |
| **do sprawdzenia** | pełny bursztynowy kwadracik z zaokrąglonymi rogami i „?”; komórka podbarwiona na bursztynowo | „Nietypowa wartość warta sprawdzenia.” | jak błąd |
| **trop** | mały pusty szary okrąg; komórka bez podbarwienia | „Trop do poszukiwań, nie błąd.” | jak błąd; chrzestny, który się powtarza ([A6.7.10](#A6.7.10), [A6.7.12](#A6.7.12)) |
| **nietypowe** | szara pusta gwiazdka „☆”; komórka bez podbarwienia | „Ustalenie oznaczone „To nie błąd”.” | komórka danej; **Nietypowe, sprawdzone**; **Najwyższy poziom**, gdy wszystkie ustalenia osoby są oznaczone |

- Kółko i kwadrat różnią się kształtem i znakiem, nie tylko kolorem. Czytnik ekranu odczyta oznaczenie jako poziom
  i tekst ustalenia.
- **Ustalenia** ma oznaczenie najwyższego poziomu za liczbą; **Najwyższy poziom** ma je przed słowem. Osoba bez
  ustalenia ma w kolumnie **Ustalenia** blade „0”.
- Zwinięta grupa kolumn (wąski pasek) pokazuje najwyższe oznaczenie ze swoich komórek.

**Rodzaje wartości.** Żaden z nich nie jest ustaleniem.

| Oznaczenie | Jak wygląda | Co znaczy (legenda) | Gdzie się pojawia |
|---|---|---|---|
| **niepewna data** | data podkreślona kropkami; słowo **ok.**, **przed** lub **po** mniejszym szarym pismem przed datą | „Około, przed, po lub zakres; nie jest to ustalenie.” | kolumny dat ([A6.7.3](#A6.7.3)) |
| **wiarygodność** | szara nazwa stopnia (w legendzie **Potwierdzone**): **Potwierdzone**, **Udokumentowane**, **Prawdopodobne**, **Możliwe**, **Z drzewa**, **Wskazówka**, **Bez źródła** | „W kolumnach Wiarygodność i badanie; przy związkach w grupie Ślub, przy wydarzeniach w grupie Źródło.” | **Wiarygodność imienia**, **urodzenia**, **zgonu**, **ślubu** (osoby, związki), **Wiarygodność** (wydarzenia); stopnie: [S7.1](S7-reliability-and-verification.md#S7.1) |
| **wartość zastępcza** | skrót **chrz.** lub **poch.** w małej ramce przed wartością, wartość kursywą; podpowiedź „Chrzest, urodzenie nieznane”, „Pochówek, zgon nieznany” | „Chrzest zamiast urodzenia, pochówek zamiast zgonu.” | data i miejsce urodzenia i zgonu ([A6.7.3](#A6.7.3)) |
| **obliczone** | szare pismo; „≈ 67” szacunek, „28–29” zakres | „Zakres z niedokładnej daty, ≈ z szacunku.” | wiek, różnica wieku zapisanego, długość związku, liczby, pokolenie, kompletność; przy nagłówku „Obliczono z: …” |
| **nie dotyczy** | „–” szarą kursywą, w legendzie tak samo; podpowiedź „Nie dotyczy” | „Nie dotyczy osoby.” | zgon przy osobie żyjącej (przy **Kompletność zgonu** „żyje”), wiek ojca lub matki bez zapisanego rodzica, kolumny związku przy osobie bez związku, komórki ślubu przy związku bez ślubu (podpowiedź „Nie dotyczy: związek bez ślubu”, [A6.7.4](#A6.7.4)), **Wiek w chwili wydarzenia** przy urodzeniu |

- W kolumnach **Wiarygodność …** sortuje się od **Potwierdzone** do **Bez źródła** w kolejności z tabeli.

**Oznaczenia badania** ([A6.7.14](#A6.7.14)), tylko w drzewie z badania. Kółko badania ma wokół siebie obwódkę, więc także
bez koloru różni się od kółka błędu (bez obwódki) i kwadracika do sprawdzenia. Legenda dodaje: „Koło z obwódką oznacza
badanie. ! i ? badania są tylko w kolumnach Badanie, przy danej może być tylko ≠.”

| Oznaczenie | Jak wygląda | Co znaczy (legenda) | Gdzie się pojawia |
|---|---|---|---|
| **czeka** | pełne bursztynowe kółko z obwódką i „!” | „Badanie czeka na decyzję.” | **Badanie**, **Czeka na decyzję** |
| **czeka na innych** | pusty bursztynowy okrąg z „!” | „Oczekuje się odpowiedzi z zewnątrz (list, archiwum); nie ma czego rozstrzygać.” | **Badanie**, **Czeka na decyzję** |
| **sprzeczność** | pełne bursztynowe kółko z obwódką i „≠” | „Źródła się nie zgadzają. To nie błąd w danych: chodzi o to, któremu źródłu zaufać.” | przed wartością w komórce danej (bez podbarwienia, kliknięcie otwiera sprzeczności); **Badanie**, **Sprzeczności** |
| **pytanie** | pełne bursztynowe kółko z obwódką i „?” | „Otwarte pytanie lub hipoteza.” | **Badanie**, **Hipotezy** |
| **agent** | obracający się łuk (przy ograniczonym ruchu stoi) | „Agent pracuje teraz nad osobą (tylko podczas śledzenia).” | **Badanie**, **Agent**; przy imieniu osoby pionowy pasek 3 px |
| **gotowe** | „✓” | „Agent zakończył pracę (przez 4 s).” | za imieniem, **Agent** |

- W kolumnie **Badanie** osoba w kolejce agenta ma szarą kropkę „·” z „w kolejce”; „+2” za oznaczeniem to kolejne
  rodzaje sygnału. Nowe z badania ma w swojej kolumnie kropkę „•”.
- Kolumna, która ma wartość tylko podczas śledzenia badania, ma bez śledzenia „–” z etykietą „na żywo” (podpowiedź
  „Tylko podczas śledzenia badania”). Od aplikacji 3.27.0 tylko wtedy, gdy nie odpowiada też most badania
  ([A6.7.14](#A6.7.14)).

**Inne oznaczenia** (legenda ich nie pokazuje):

| Oznaczenie | Jak wygląda | Co znaczy | Gdzie się pojawia |
|---|---|---|---|
| „…” | blade trzy kropki; podpowiedź „Trwają kontrole…” | kontrola drzewa jeszcze trwa | **Ustalenia**, **Najwyższy poziom**, **Nietypowe, sprawdzone** |
| „◌ Trwają kontrole…” | pusty okrąg i tekst po prawej nad tabelą | to samo dla całej tabeli; chipy ustaleń na razie czekają | nad tabelą, obok **Oznaczenia ⓘ** |
| procent z paskiem | liczba i krótki pasek, którego wypełniona część to wartość | kompletność ([A6.7.4](#A6.7.4)) | kolumny **Kompletność …** |
| pogrubiona liczba, „–” | w wierszu pokrycia | pokrycie poniżej 50 % (przy kolumnach kompletności średnia poniżej 50 %); „–” kolumna bez komórki, której by dotyczyła | **Wiersz pokrycia** ([A6.7.4](#A6.7.4)) |
| „+2” | liczba w owalnej ramce za pierwszym cytowaniem | kolejne cytowane źródła; kliknięcie otwiera **Pozostałe cytowania** | cytowania urodzenia, ślubu, zgonu ([A6.7.12](#A6.7.12)) |
| „↗” | za podkreślonym adresem internetowym | link do nowego okna | **Online**, cytowania „… URL” ([A6.7.11](#A6.7.11), [A6.7.12](#A6.7.12)) |
| obrys komórki | cienki obrys 1 px | aktywna komórka ([A6.7.15](#A6.7.15)) | komórka wybranego wiersza |
| kursor tekstowy | po najechaniu myszą | komórkę można edytować w miejscu ([A6.7.15](#A6.7.15)) | edytowalne komórki |
| ●○, ●● | jedna lub dwie pełne kropki przed „1 czytelnik”, „2 czytelników”; podpowiedź, kto transkrypcję przeczytał | ilu czytelników przeczytało transkrypcję | **Przeczytane w badaniu** ([A6.7.11](#A6.7.11)) |
| „12 dn.” | liczba z „dn.” | wiek do jednego roku w dniach | **Wiek w chwili wydarzenia** ([A6.7.10](#A6.7.10)) |
| ▾, ▸ | trójkąt przed imieniem | związki osoby rozwinięte, zwinięte ([A6.7.1](#A6.7.1)) | **Imię i nazwisko** osoby z dwoma i więcej związkami |
| „3 związki” | przy zwiniętej osobie w owalnej ramce za imieniem; przy rozwiniętej w kolumnie **Partner** szarą kursywą | liczba związków osoby | wiersz osoby |
| „└ Związek 2 z 3” | wcięty podwiersz | jeden związek osoby | podwiersz związku |
| „2 związki poza filtrem · pokaż” | przycisk we wciętym wierszu | związki, które nie spełniają filtru; pokazane są przygaszone | pod podwierszami związków |
| „nie pasuje do filtru” | cały wiersz blady, tekst kursywą na końcu | wiersz po edycji nie spełnia filtru ([A6.7.8](#A6.7.8)) | do następnej zmiany sortowania, filtru lub widoku |
| wyróżnienie | podbarwione pismo trafienia | trafienie wyszukiwania ([A6.7.6](#A6.7.6)) | widoczne kolumny |
| ↑, ↓ (↑1, ↓2) | strzałka w nagłówku, z numerem przy kilku kluczach | kierunek i kolejność klucza sortowania ([A6.7.6](#A6.7.6)) | nagłówek kolumny |
| −, + | znak przy nazwie grupy | zwinięcie, rozwinięcie grupy kolumn ([A6.7.2](#A6.7.2)) | wiersz grup nad nagłówkiem |

- **Granice:** eksport CSV nie niesie oznaczeń ani kolorów; XLSX niesie tylko podbarwienie i komentarz przy błędzie
  i do sprawdzenia ([A6.7.9](#A6.7.9)).
- **Obsługa:** **Oznaczenia ⓘ** po prawej nad tabelą.
- **Obowiązuje od:** aplikacja 3.27.0

<!-- zdroj: app:src/ui/table-view/table-grid.ts MARK_GLYPH (error „!“, warning „?“, info prázdný, unusual „☆“), markHtml (role img, aria-label úroveň: text), cellClasses (aggregate, na, computed, uncertain, subst, ghost, issue), cellText („–“), cellInner (značka za hodnotou; u čísla vpravo za, jinak před slovem), moreCitesHtml „+N“, cellValueCore (tv-comp proužek 30 px, tv-subst, tv-qual), linkHtml „ ↗“, readersHtml (fs-dots), nameCell (▾/▸, tv-unions-pill unionsN, └ unionKofN, hiddenUnions), sort mark ↑/↓ s číslem, tv-group-toggle −/+ · table-bubble.ts legendHtml (4 značky + uncertain „1890–1892“, reliability ✓, subst křt., computed „≈ 67“, na „–“) · table-bar.ts createStatus (◌ checksRunning, legenda „Značky ⓘ“) · table-columns.ts checksPendingCell („…“ ghost), findingsCell („0“ ghost), topSeverityCell, unusualCell (☆), pillCell + reliabilityText + RELIABILITY_RANK (human, proven, probable, possible, import, lead, none), readersCell (dots [true, n > 1]), naCell (relD, fAge, mAge, unionScoped bez svazku, evAge narození), eventAge (ageDays) · table-subrows.ts aggregate „n svazků“ · table-checks.ts bandSeverity · table-coverage.ts LOW pod 50 % · index.html CSS .tv-mark--error (kolečko 16 px, --danger), --warning (čtverec radius 3px, --warning), --info (kroužek 10 px, okraj --text-faint), --unusual, .tv-cell--error/--warning (danger-soft, warning-soft), --uncertain (dotted), --na (kurzíva), --computed, .tv-subst, .tv-cites-more, .tv-row.is-stale, .tv-stale-note, mark.tv-hit · strings.ts table.legend, legendTitle, legendKind.*, legendText.*, sev.*, subst.*, qual.*, na, living, checksRunning, moreCites, citesTitle, readers, ageDays, unionsN, unionKofN, hiddenUnions, staleRow, col.relN/relB/relD/relW/evRel, reliability.human/proven/import/none, factStatus.probable/possible/lead · app f34d41e1 · Milan 10. 11. (dirigent:prace/1110-doc-tabulka-znacky bod 1) · pořadí stupňů podle RELIABILITY_RANK (Z rodokmenu před Vodítko), dirigent:prace/_drobnosti/doc.md · značky výzkumu: table-grid.ts RESEARCH_GLYPH (wait „!“, ext „!“, conf „≠“, q „?“, agent oblouk, done „✓“, queue „·“, new „•“), researchMarkHtml, conflictMarkHtml (≠ před hodnotou) · index.html .tv-rmark--wait/conf/q (kolečko 16 px, --signal-warn, lem box-shadow), --ext (prázdný kroužek), --agent (agSpin, prefers-reduced-motion), --done, .tv-agent-bar (3 px) · strings.ts table.res.legendName, legendText, legendNote, liveTag, liveOnly · aktivní buňka a kurzor: commity 05d9a9ab, be9ca8cd · spec 073 §16.3, U7 -->

<a id="A6.7.14"></a>
### A6.7.14 Badanie w tabeli

W drzewie z badania ([S1](S1-connecting-app-and-research.md)) tabela pokazuje także to, co badanie wie o osobach: co
czeka na decyzję, sprzeczności źródeł, hipotezy, pracę agenta, linie i wymianę z drzewem. Do drzewa niczego nie
zapisuje.

- **Kolumny osób** (grupa **Badanie**, domyślnie ukryta; pole wyboru **wszystkie** włącza **Badanie**, **Czeka na
  decyzję**, **Sprzeczności**, **Hipotezy** i **Agent**):

  | Kolumna | Co pokazuje |
  |---|---|
  | **Badanie** | najpilniejszy sygnał osoby w kolejności czeka › sprzeczność › pytanie lub hipoteza › agent › w kolejce; „+n” kolejne rodzaje |
  | **Czeka na decyzję** | liczba i pierwsza pozycja; przy czekaniu na innych „z zewnątrz: …” (list wysłano, pytanie w rodzinie …) |
  | **Sprzeczności** | liczba otwartych sprzeczności i dane („· urodzenie, …”); „· można rozstrzygnąć w aplikacji”, gdzie się da ([S2](S2-edits-from-the-app.md)) |
  | **Hipotezy** | liczba otwartych hipotez; „rozstrzygnął agent” |
  | **Zadania badania** | zadania osoby w kolejce („2 · najbliższe 3. w kolejce”, „1 · trwa teraz”) |
  | **Agent** | „pracuje: {zadanie}”, „w kolejce”, „gotowe” |
  | **Linia badania** (do aplikacji 3.29.0 **Linia**) | miejsce osoby wśród linii (niżej) |
  | **Materiały**, **Drzewo kończy się tu**, **Szukano bez wyniku**, **Wymiana z badaniem**, **Pierwotnie w drzewie**, **Opowieść**, **Gdzie się załatwia**, **Nowe z badania**, **Dostępność źródeł**, **Parafia (badanie)**, **Szacowane urodzenie** | co badanie wie o materiałach osoby, o krawędzi drzewa, o wymianie z drzewem, o źródłach i miejscach |

- **Związki:** **ID badania** (F…), **Linia badania** (według partnera z linii), **Agent** („pracuje nad parą: …”)
  i **Sprzeczności** (sprzeczności dotyczące ślubu i rozwodu u obu partnerów). **Źródła:** **ID badania** (S…)
  i **Obraz**: „na komputerze badania”, „brak skanu na komputerze badania” (wyróżnione), „online (archiwum)”.
- **Linia badania:** w linii (partner osoby z linii „· partner”; boczna gałąź dodana do linii należy do tej linii),
  „boczna gałąź: {imię}”, „wyspa”, „poza liniami”. **Poza liniami** są boczne gałęzie niedodane do linii, wyspy i
  pozostali ([R2.3](R2-lines-and-queue.md#R2.3)). Linie tabela bierze na żywo z badania, w przeciwnym razie z pliku
  badania; sortuje się w kolejności linii badania, potem gałęzie, wyspy i poza liniami, w ich obrębie według pokolenia.
  Kolumna i chipy linii są tylko przy badaniu z liniami.
- **Sprzeczność przy danej:** komórka danej z otwartą sprzecznością źródeł ma przed wartością „≠”, bez podbarwienia.
  Kliknięcie „≠” otwiera dymek ze sprzecznościami; czytnik ekranu odczyta „{wartość}, sprzeczność źródeł: {dana}”.
  Oznaczenia „!” i „?” badania są tylko w kolumnach badania ([A6.7.13](#A6.7.13)).
- **Chip Badanie ▾:** jeden chip z menu w sekcjach **Sygnały**, **Linie**, **Wymiana, źródła i miejsca**, **Więcej
  filtrów badania** i **Nowe z badania**; „Wybór rozwija blok Badanie w wierszu.” Chipy: **Czeka na decyzję**, **Ze
  sprzecznością**, **Z pytaniem**, **Agent pracuje / w kolejce**, po jednym na każdą linię i **Poza liniami**
  (z liczbami), **Niewysłane**, **Zmienione przez badanie**, **Do rozstrzygnięcia tutaj**, **Czeka na innych**, **Nowe
  z badania** (ostatnie 24 h, ostatnie 7 dni, od ostatniego otwarcia), **Tylko w czytelni**, **Miejsce nieokreślone**,
  **Rozstrzygnął agent**, **Wstrzymane / odłożone**, **Drzewo kończy się tu**. Na telefonie sekcja **Badanie** jest
  w panelu **Filtry**, rzadsze chipy pod **Więcej filtrów badania (n)**.
- **Wbudowane widoki** (sekcja **Badanie** w menu **Widok**; jak inne wbudowane się nie zmieniają, [A6.7.7](#A6.7.7)):

  | Widok | Co pokazuje |
  |---|---|
  | **Badanie** | osoby z sygnałem: imię i nazwisko, Badanie, Czeka na decyzję, Sprzeczności, Hipotezy, Agent, Zadania badania, urodzenie, zgon; sortowane od najpilniejszego, potem według imienia i nazwiska |
  | **Linia: {linia}** (dla każdej linii) i **Poza liniami** | imię i nazwisko, Linia badania, pokolenie, Badanie, urodzenie, zgon, Sprzeczności, Agent; chip linii; sortowane według linii |
  | **Wymiana z badaniem** | osoby z wymianą: imię i nazwisko, Wymiana z badaniem, Pierwotnie w drzewie, Nowe z badania, Sprzeczności, urodzenie |

  Związki są w nich zwinięte, a wiersz pokrycia włączony. Pusty widok powie „Badanie niczego teraz nie potrzebuje”
  lub „Drzewo i badanie są zgodne”.
- **Dymek badania:** kliknięcie komórki badania otwiera dymek (na telefonie panel od dołu) z sekcjami według tego, co
  osoba ma: **Czeka na decyzję · n** (**Porównaj wersje ›**, **Czeka na załatwienie ›**), **Czeka na innych**,
  **Sprzeczności źródeł · n** (**Rozstrzygnij ›**), **Hipotezy** lub **Otwarte pytanie** (**Co wie badanie ›**,
  [S3.5](S3-what-the-research-knows.md#S3.5)), **Agent pracuje** (**Śledź badanie ›**), **Zadania badania w kolejce**
  (**Otwórz zadanie w badaniu**), **Materiały ›**, **Linia** lub **Poza liniami** (**Pokaż linię w drzewie**,
  **Zmień w badaniu**), **Pierwotnie w drzewie** (**Przywróć wartość z drzewa**, tylko z badaniem na tym
  komputerze) i **Dostępność źródeł**. Akcja, którą potwierdza się w badaniu, ma oznaczenie jak gdzie indziej
  ([S4.5.1](S4-research-from-the-app.md#S4.5.1)).
- **Na żywo:** podczas śledzenia badania zmieniają się tylko komórki, których zmiana dotyczy, kolejność wierszy
  zostaje. Przy imieniu osoby, nad którą agent pracuje, biegnie pionowy pasek. Nad tabelą jest „● Badanie śledzone na
  żywo”, w przeciwnym razie „Badanie: stan z {kiedy}”.
- **Eksport:** CSV i XLSX niosą teksty i liczby („czeka; sprzeczność (1)”, „1: urodzenie”, bez sprzeczności „0”), bez
  oznaczeń. Bez śledzenia (od aplikacji 3.27.0 tylko bez odpowiedzi mostu) **Agent** i **Zadania badania** są puste,
  a powiadomienie powie „Agent i Zadania badania są puste: badanie nie jest śledzone.” Wiersz pokrycia ma przy kolumnach
  badania „–”.
- **Granice:**
  - bez agenta (Archiwum Strom) i w drzewie tylko do odczytu nie ma **Czeka na decyzję**, **Zadania badania**
    i **Agent** ani chipów **Niewysłane** i **Do rozstrzygnięcia tutaj**; widok **Wymiana z badaniem** jest tylko
    w badaniu z agentem, które można zmieniać;
  - **Agent** i **Zadania badania** mają wartość tylko podczas śledzenia badania, w przeciwnym razie „–” z etykietą „na
    żywo”; chip **Agent pracuje / w kolejce** bez śledzenia nie filtruje. Od aplikacji 3.27.0 oba obowiązują tylko
    bez odpowiedzi mostu (niżej);
  - w drzewie tylko do odczytu dymek nie ma akcji: „Tylko do odczytu: sprzeczności nie można tu rozstrzygnąć.”
- **Bez śledzenia z mostem:** gdy most badania na tym komputerze odpowiada, **Agent** i **Zadania badania** (także pasek
  przy imieniu, chip **Agent** i eksport) biorą pracę agenta i kolejkę z regularnego zapytania do mostu i wyglądają
  jak podczas śledzenia. Pusta kolejka mostu zostawia komórki puste. Tabela przerysowuje się, gdy odpowiedź mostu się
  zmieni. Telefon nie pyta mostu. Tak samo działa Przegląd badania bez śledzenia
  ([S4.1.5](S4-research-from-the-app.md#S4.1.5)).
- **Obsługa:** panel **Kolumny** → grupa **Badanie**; chip **Badanie ▾**; **Widok** → sekcja **Badanie**;
  **Oznaczenia ⓘ**.
- **Obowiązuje od:** aplikacja 3.27.0 z badaniem 1.31.0
- **Od aplikacji 3.30.0:** badanie w Tabeli innego okna, wiersz agenta i przewinięcie do niego, etykieta „Filtr
  badania nie jest teraz stosowany”: [A6.7.18](#A6.7.18).

<!-- zdroj: app:src/ui/table-view/table-research.ts RESEARCH_COLUMNS, RESEARCH_DEFAULT_COLUMNS (rSum, rWait, rConf, rHyp, rAgent), LIVE_ONLY (rTasks, rAgent), NEEDS_AGENT (rWait, rTasks, rAgent), rSum pořadí (čeká 5 › rozpor 4 › otázka 3 › agent 2 › fronta 1), researchLinesOf (živě /directions/people, jinak soubor _STROM_DIRECTION), personLineRole, isOffLine, researchChips, RESEARCH_SIGNAL_CHIPS, RESEARCH_MORE_CHIPS, researchChipOffer (xUnsent, xDecideHere jen research a ne jen ke čtení), researchChipActive (live), unionLineRole, unionResearchCell (UNION_FACTS), sourceImageCell, unionResearchIdCell, sourceResearchIdCell · table-views.ts pohledy Výzkum, Linie, Mimo linie, Výměna s výzkumem · table-research-bubble.ts, table-research-ui.ts · table-grid.ts conflictMarkHtml · table-export.ts (exportNotLive) · strings.ts table.res.*, table.col.r*, uResearchId, srcResearchId, srcImage · commity 53137620, 99b60acb, a2e1dc73, 02e88e9a, 32958eb4, fd9c220f, cf9e63d8, 4635c16e, 5857be6b, 970e6b88, 6b66e037, 9e51ff66 · research: GET /directions/people, funkce directions.places, brána APP_SHOWS_RESEARCH_TABLE (src/core/stromapp.ts), CHANGELOG.cs.md 1.31.0 „Výzkum v tabulce aplikace Strom“ · spec 073 §16, K7.1–K7.8 · bez sledování s mostem: app 8d564b35 src/ui/research-ui.ts unfollowedAgentNow (onComputer, researchStatusNow, status.working a queue), src/ui/table-view/table-ui.ts tableResearchAgentChanged · spec 057 K1.12 -->

<a id="A6.7.15"></a>
### A6.7.15 Aktywna komórka, menu komórki i edycja w miejscu

Kliknięcie komórki wybiera wiersz i czyni z komórki aktywną komórkę (cienki obrys); strzałki ją przesuwają. Aktywną
komórkę można skopiować, filtrować według jej wartości i edytować daną w niej bezpośrednio w tabeli.

- **Kopiowanie:** Ctrl/Cmd+C bez zaznaczonego tekstu kopiuje tekst, który aktywna komórka pokazuje, bez oznaczeń,
  ikon i pigułek. Ręcznie zaznaczony tekst kopiuje się jak zwykle.
- **Menu komórki:** menu wiersza (prawy przycisk, Shift+F10) i panel wiersza (stuknięcie palcem w komórkę)
  zaczynają się od opcji komórki **Kopiuj**, **Tylko „{wartość}”** i **Bez „{wartość}”** (wartość skrócona do około
  24 znaków z „…”); pod nimi są akcje wiersza ([A6.7.8](#A6.7.8)). Menu otwiera się przy komórce, także gdy wybrany
  był inny wiersz.
  - **Tylko** i **Bez** ustawiają filtr kolumny **jest** / **nie jest** ([A6.7.6](#A6.7.6)), chip „{Kolumna} =
    {wartość} ×” lub „{Kolumna} ≠ {wartość} ×”; porównuje się bez względu na wielkość liter i znaki diakrytyczne.
    Komórka z imieniem i nazwiskiem osoby porównuje osobę: **Tylko „{ojciec}”** w kolumnie **Ojciec** pokaże
    rodzeństwo, nie dzieci imiennika.
  - Pusta komórka oferuje **Tylko puste** i **Tylko wypełnione**, komórka z listą wartości ustawia filtr wartości.
    Komórka bez jednej wartości do porównania (oznaczenie badań, kilka imion, kompletność, liczba związków) oferuje
    tylko **Kopiuj**; własne imię i nazwisko lub tytuł wiersza ma tylko akcje wiersza.
  - Filtr zapisuje się z widokiem ([A6.7.7](#A6.7.7)).
  - **Od aplikacji 3.30.0:** **Bez** dodaje kolejne wykluczenie obok wcześniejszych, a drugie **Tylko** w kolumnie
    dodaje swoją wartość („= A lub B”), zamiast zastąpić filtr kolumny ([A6.7.6](#A6.7.6)). Komórka z imieniem
    i nazwiskiem osoby jest odnośnikiem do jej wiersza ([A6.7.16](#A6.7.16)); menu wiersza ma dodatkowo **Przypnij
    wiersz** ([A6.7.17](#A6.7.17)).
- **Edycja w miejscu:** edytować można komórkę, która odpowiada jednej danej drzewa:
  - **Imię**, **Nazwisko** (gdy pokazuje nazwisko po ślubie, edytuje je), **Nazwisko rodowe**, **Nazwisko po
    ślubie**;
  - **Płeć** przez wybór (**Mężczyzna**, **Kobieta**, **Nieznana**) i **Nr ref.**;
  - data i miejsce urodzenia, chrztu, zgonu i pochówku, **Przyczyna zgonu** i **Wiek zapisany przy zgonie**;
  - **Zawód**, dopóki osoba ma najwyżej jeden;
  - dane związku (tabela związków, podwiersz związku, wiersz osoby z jednym związkiem): **Stan związku** przez wybór
    (**Małżeństwo**, **Partnerzy**, **Rozwiedzeni**, **W separacji**, jak w formularzu związku), data i miejsce ślubu,
    wiek zapisany każdego z partnerów przy ślubie (**Wiek zapisany przy ślubie**, **Wiek zapisany partnera**, **Wiek
    zapisany 1** i **2**), **Data rozwodu** i **Miejsce rozwodu**. Pusta komórka zakłada daną związku tak, jak zakłada
    ją formularz związku. Przy związku bez ślubu ([A6.7.4](#A6.7.4)) komórek ślubu się nie edytuje.

  **Imię i nazwisko** nie edytuje się w komórce (składa się z kilku części), tak samo jak komórki obliczone,
  kontrole, badanie, cytowania, liczby i relacje; dwuklik na nich otwiera **Edytuj…**.
- **Pole** stoi w komórce. Tylko w kolumnie węższej niż najmniejsza szerokość pola (tekst i data 100 px, miejsce
  140 px, wybór 90 px) pole jest szersze i leży nad wierszem z cieniem (od aplikacji 3.28.0; wcześniej leżało na
  sąsiedniej komórce). **Enter** zapisuje, **Esc** anuluje, **Tab** i **Shift+Tab** zapisują i przechodzą do
  następnej lub poprzedniej edytowalnej komórki wiersza, kliknięcie gdzie indziej zapisuje. W wyborze kliknięcie myszą
  zapisuje wartość od razu; po wyborze strzałkami zapisuje ją Enter, Tab lub kliknięcie gdzie indziej. Datę odczytuje
  się jak
  w formularzu osoby; nieczytelna zostaje w polu z błędem „Nie można odczytać daty (np. 15.5.1880, 1880, ok. 1880)”.
  Miejsce podpowiada miejsca drzewa. Bez imienia i nazwiska nic się nie zapisze: „Imię lub nazwisko musi pozostać”.
- **Zapisanie** idzie tą samą drogą co formularz osoby (dane związku jak formularz związku) i jest jednym krokiem
  wstecz (Ctrl/Cmd+Z), także gdy pusta komórka daną założyła. Chrzest i pochówek
  edytują pierwsze takie wydarzenie (jego pozostałe dane i cytowania zostają) albo je dodają; puste pole usuwa tylko
  tę daną. Potem wiersz mignie, zostanie na miejscu, a powiadomienie powie „Zapisano: {imię}”.
- **Granice:** w miejscu nie można edytować w drzewie tylko do odczytu ani zablokowanym, w Archiwum Strom, na
  telefonie i przy zablokowanej osobie. Na telefonie daną edytuje się przez panel wiersza → **Edytuj…**.
- **Obsługa:** dwuklik, **F2**, **Enter** na aktywnej komórce (przy komórce z ustaleniem Enter najpierw otwiera dymek
  ustalenia), w menu wiersza **Edytuj komórkę** (F2). Edytowalna komórka ma po najechaniu myszą kursor tekstowy.
- **Obowiązuje od:** aplikacja 3.27.0

<!-- zdroj: app:src/ui/table-view/table-grid.ts copyKey (Ctrl/Cmd+C, copyPlainText), F2, Enter (has-issue → onIssue, has-finds → onFindings, jinak startEditAt, jinak open), Escape, Tab · table-ui.ts showTableRowMenu (cellPart, cell-edit „Upravit buňku“ s F2), tableCellChoices, tableCellSheetBlocks, :1663 úprava na místě ne v jen ke čtení, archivu, na telefonu (isPhoneBar) · table-edit.ts editTargetOf, PERSON_FIELDS (surname: marriedSurname || lastName, birthSurname, marriedSurname, bDate…burPlace, occ), UNION_FIELDS (wDate, wPlace), editChangeOf (normalizeDateInput, první křest a pohřeb, prázdné pole smaže jen údaj, beze jména neuloží) · strings.ts table.cell.copy, only, without, edit, badDate, nameNeeded, editLabel, onlyEmpty, onlyFilled, matchEquals, matchNotEquals, savedToast · commity 05d9a9ab, be9ca8cd, 28aabdc8 · spec 073 U9 (T54 F4, F8, F9) · T54 2. kolo: table-edit.ts PERSON_FIELDS (firstName, gender, refn, dCause, dAgeRec), UNION_FIELDS (wAgeRec, pAgeRec, rec1, rec2, divDate, divPlace, uStatus), WEDDING_FIELDS (ne u unionWithoutWedding), editOptionsOf (GENDERS, UNION_STATUSES v pořadí formuláře svazku), table-grid.ts select (klik myší uloží hned), commity 8fdf52ca, 79764eba (T54 G3, G10) · nabídka u buňky jiného řádku: commit 400ccda8 (T54 G7) · pole v buňce: table-grid.ts EDITOR_MIN_WIDTH (text 100, date 100, place 140, select 90), placeEditor, commit 80c2ffb9 · panel klepnutím: commit ee38c7a6 · 3.30.0: app:ec39d469 table-ui.ts tableCellChoices (addOnlyFilter, addWithoutFilter) -->

<a id="A6.7.16"></a>
### A6.7.16 Odnośniki do osób i skoki ‹ ›

W tabeli osób i związków imię i nazwisko osoby drzewa w komórce jest odnośnikiem do jej wiersza. Od ojca, matki,
partnera, chrzestnego lub świadka prowadzi tak do ich wiersza bez szukania i z powrotem.

- **Gdzie:** komórki tabeli osób i związków, które wymieniają osobę drzewa: **Ojciec**, **Matka**, **Partner**,
  chrzestni, świadkowie, partnerzy związku. Własne imię i nazwisko wiersza (**Imię i nazwisko**) odnośnikiem nie jest.
  Imię wygląda jak tekst komórki i podkreśla się tylko pod wskaźnikiem myszy; dymek pokazuje pełne imię i nazwisko.
  Kilka imion w jednej komórce ma każde własny odnośnik.
- **Skok:** prowadzi zawsze do tabeli osób (także z tabeli związków). Wiersz osoby jest pośrodku, kolumna przewija się
  w pole widzenia, komórka jest aktywna, a wiersz krótko mignie. Komórka docelowa:
  - przez partnera komórka **Partner** w wierszu tego związku (związek się rozwija), a w niej jest wyróżnione imię,
    skąd się przyszło, dopóki komórka jest aktywna;
  - w przeciwnym razie komórka **Imię i nazwisko**; także gdy kolumna **Partner** nie jest widoczna.
- **‹ ›:** na początku paska tabeli od pierwszego skoku. ‹ przywraca typ wierszy, przewinięcie i komórkę, z której
  skok wyszedł, i zwija związek, który skok rozwinął; › powtarza skok. Dymek mówi dokąd („Wróć do Jan Horák”,
  „Ponownie do Marie Vlková”); bez kroku w tym kierunku przycisk jest wyłączony. Kroki to tylko skoki przez imiona,
  nie ręczna zmiana typu wierszy, widoku lub filtru. Pamięć ma 50 kroków, a każde okno ([A6.8](#A6.8)) własną; inne
  drzewo zaczyna ją od nowa.
- **Osoba ukryta przez filtr lub wyszukiwanie:** skok się nie wykonuje, a pod paskiem pojawia się komunikat „Ukryte
  przez filtr: {imię}.”:
  - **Pokaż tymczasowo** pokazuje wiersz na jego miejscu w sortowaniu, przygaszony z „poza filtrem”, poza liczbą
    wierszy. Znika przy zmianie filtru, sortowania, widoku lub typu wierszy i po ‹;
  - **Wyczyść filtry** wyłącza filtr i wyszukiwanie i wykonuje skok;
  - × lub Esc zamyka komunikat, nic się nie zmienia.
  - osoba, której wiersz jest przypięty ([A6.7.17](#A6.7.17)): skok prowadzi wprost do jej przypiętego wiersza
    pod nagłówkiem tabeli, bez komunikatu.
- **Wydarzenia:** w tabeli wydarzeń imiona nie są odnośnikami; menu uczestnika zaczyna się od **Przejdź do {imię}**
  ([A6.7.10](#A6.7.10)).
- **Granice:**
  - skok uruchamia tylko zwykłe kliknięcie myszą lub piórem (bez Ctrl, Shift, Alt i bez przeciągania). Zaznaczanie
    tekstu, edycja komórki dwuklikiem w innym miejscu komórki i F2 działają jak dotąd; dwuklik zaraz po skoku nic nie
    robi;
  - stuknięcie palcem otwiera panel wiersza jak dotąd; zaczyna się on sekcją **Osoby w komórce** z wierszem **Przejdź
    do {imię}** dla każdej osoby komórki;
  - osoba w centrum drzewa skokiem się nie zmienia.
- **Obsługa:** kliknięcie imienia; **Enter** na aktywnej komórce z jednym imieniem skacze, z kilkoma imionami
  proponuje **Przejdź do…**; ‹ › na pasku i Alt+← / Alt+→ w tabeli.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:0b833e3d src/ui/table-view/table-grid.ts personLinks (osoba bez role účastníka, ne agregát), namesHtml (tv-nm--jump, title celé jméno), linksIn (ne sloupec name), klik jen isMouseLikePointer bez modifikátorů a e.detail 1, jumpedAt + JUMP_DOUBLE_MS (dvojklik po skoku nic), Enter (tableLinkPick), Alt+←/→ onHistory · table-ui.ts tableNameAction (persons, unions), tableJumpStep (přes p1/p2 nebo partner → via partner), tableJumpBy, tablePersonShown, tableRunJump (rowType persons, setExpanded, flash, jumpTo), tableHistory (rowType, scroll, buňka, zavře rozbalený svazek, ruší dočasné zobrazení), tableLinkPick, showTableRowSheet (link.inCell) · table-jump.ts JUMP_HISTORY_MAX 50, JumpHistory, jumpTargetCell (partner jen je-li sloupec vidět, jinak name) · table-notice.ts (role status, Zobrazit dočasně, Zrušit filtry, ×, Esc) · table-bar.ts updateNav (vidět od prvního skoku, aria-disabled) · strings.ts table.link.goTo, pick, inCell, enterHint, hidden, showTemp; table.nav.back, backTo, forward, forwardTo; table.outsideFilter · e2e/table-view-links.spec.ts · CHANGELOG.cs.md 3.30.0 „Odkazy v Tabulce“ · spec 103 K3.1–K3.3, ZADANI_DEV_tabulka-odkazy-ukotveni D1–D4, D6 · dirigent:test/vysledek-1116-app-103-odkazy-083-razeni.md · ukotvená osoba skrytá filtrem: app:9b2b6dca table-ui.ts tablePersonPinned, grid.jumpToPin (bez pruhu) · spec 103 Rozhodnutí 16. 11. (díl C) -->

<a id="A6.7.17"></a>
### A6.7.17 Przypięte wiersze

Przypięty wiersz zostaje pod nagłówkiem tabeli, gdy tabela się przewija. Służy do porównania wierszy, które są
w tabeli daleko od siebie.

- **Jak się przypina:** menu wiersza → **Przypnij wiersz** (za **Edytuj…**). Tekst zaznaczony przez kilka wierszy
  (przeciąganiem lub Shift+kliknięciem) i kliknięcie w niego prawym przyciskiem proponuje **Przypnij wiersze (n)** dla
  osób tych wierszy; podwiersz związku liczy się jako jego osoba. Na przypiętym wierszu jest zamiast tego **Odepnij
  wiersz**.
- **Jak wyglądają:** pod nagłówkiem w kolejności tabeli, osoba razem z podwierszami związków jak w treści tabeli. Imię
  przypiętego wiersza ma pełną pinezkę, jego własny wiersz w treści tabeli konturową. Zajmują najwyżej jedną trzecią
  wysokości tabeli, więcej wierszy przewija się na własnym pasku przewijania. Aktywna komórka, edycja w komórce,
  klawiatura i akcje wiersza działają w nich.
- **Filtr przypiętego wiersza nie ukrywa:** wiersz, który filtr lub wyszukiwanie ukrywa, zostaje przypięty,
  przygaszony z „poza filtrem”.
- **Chip** „Przypięte wiersze (n) ×” na początku rzędu filtrów: × odpina wszystkie. **Wyczyść filtry** przypięcie
  zostawia.
- **Granice:**
  - najwyżej 10 wierszy; pozycja, która przekroczyłaby limit, jest wyłączona z „Można przypiąć najwyżej 10
    wierszy.”;
  - przypięcie obowiązuje dla jednego drzewa i jednego typu wierszy w tym oknie: inne drzewo lub typ wierszy je
    odpina, widok, filtr ani wyszukiwanie nie. Nie zapisuje się w widoku i widok nie ma przez nie **zmieniono**. Po
    zamknięciu drzewa lub odświeżeniu strony go nie ma;
  - kolejność przypiętych wierszy po edycji się nie zmienia, dopóki nie zmieni się sortowanie, filtr, wyszukiwanie
    lub widok;
  - wiersz, który zniknie z drzewa, odpina się sam;
  - tylko komputer i tablet (na tablecie w panelu wiersza). Telefon, nawet obrócony poziomo, przypinania nie ma.
- **Obsługa:** menu wiersza (prawy przycisk, Shift+F10) **Przypnij wiersz** / **Przypnij wiersze (n)** / **Odepnij
  wiersz**; chip **Przypięte wiersze (n)** z ×.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:354e3675 src/ui/table-view/table-pins.ts PIN_MAX 10, TablePins (jeden strom a typ řádků; pohled, filtr, hledání je nechají; jen paměť okna, ne v pohledu), prune, ordered (pořadí do změny řazení, filtru, hledání, pohledu; D7 a), pinRanks · table-ui.ts tableRowPinEntry (ne isPhoneBar; many z tableAreaRowKeys, unpin, disabled + limit), tablePinnedLines (podřádky svazků jako v těle, D5 a; outside), showTableRowSheet (tablet), changeTablePins · table-grid.ts .tv-pinrows (role rowgroup, nejvýš třetina těla s vlastním posuvem), tv-outside · table-filterbar.ts štítek pinRow.chip s × (unpinAll; Zrušit filtry ukotvení nechá) · strings.ts table.pinRow.one, many, unpin, chip, unpinAll, zone, rowSr, limit; table.outsideFilter · e2e/table-view-pins.spec.ts · CHANGELOG.cs.md 3.30.0 „Odkazy v Tabulce“ · spec 103 K4.1–K4.4, D5, D7 · dirigent:test/vysledek-1116-app-103-odkazy-083-razeni.md -->

<a id="A6.7.18"></a>
### A6.7.18 Badanie w tabeli innego okna

Tabela w innym oknie ([A6.8](#A6.8)) pokazuje badanie tak, jak ma je okno główne: kolumny, chipy i widoki badania,
znacznik agenta przy osobie, nad którą pracuje, i jego kolejkę ([A6.7.14](#A6.7.14)). Z badaniem rozmawia tylko okno
główne; inne okno dostaje jego stan. Podczas śledzenia badania Tabela innego okna śledzi agenta
([S4.1.7](S4-research-from-the-app.md#S4.1.7)).

- **Chipy i widoki:** grupa **Badanie** jest w Tabeli każdego okna z drzewem badania. Chipy, które obowiązują tylko
  przy śledzeniu, są żywe, gdy okno główne śledzi badanie, w przeciwnym razie są jak w oknie głównym
  ([A6.7.14](#A6.7.14)). Zapisany widok z filtrami badania otwiera się w obu oknach tak samo.
- **Filtr badania bez badania** (w każdym oknie, także w głównym): widok, który filtruje według badania (chip badania
  lub filtr kolumny badania), gdy tabela nie ma danych badania, pokazuje wszystkie wiersze i obok nazwy widoku mówi
  „Filtr badania nie jest teraz stosowany”. Na telefonie jest tam tylko bursztynowa kropka z tym tekstem w podpowiedzi.
- **Wiersz agenta:** wiersz osoby, nad którą agent pracuje, ma w innym oknie tło w kolorze śledzenia, linię
  w komórce imienia i imię pogrubione, także w odłączonym oknie. Okno główne zachowuje pionowy pasek przy imieniu
  ([A6.7.14](#A6.7.14)).
- **Przewinięcie do agenta:** okno, które śledzi agenta i nie jest wstrzymane, przewija wiersz agenta na środek, gdy
  agent przejdzie do innej osoby, a jej wiersza nie widać w całości. Przewinięcie jest płynne (300 ms, przy
  ograniczonym ruchu od razu); aktywna komórka, zaznaczenie ani fokus się nie zmieniają i nic nie przewija się
  w poziomie. Widoczny wiersz i przypięty wiersz agenta ([A6.7.17](#A6.7.17)) tabeli nie przewijają. Wstrzymane
  i odłączone okno nie przewija.
- **Wstrzymanie:** kółko nad siatką, przeciągnięcie suwaka, naciśnięcie w wierszach (komórka, imię) i klawisze ruchu
  i przewijania w siatce wstrzymują śledzenie w oknie ([S4.1.7](S4-research-from-the-app.md#S4.1.7)). Pasek, nagłówek
  i wiersz stanu Tabeli wstrzymania nie uruchamiają, tylko przedłużają trwające.
- **Wiersz agenta ukryty przez filtr:** w oknie, które śledzi agenta (także wstrzymanym), tabela się nie przewija,
  a wiersz stanu mówi „Wiersz agenta ukrywa filtr” z **Pokaż tymczasowo**. To pokazuje tymczasowy wiersz jak przy
  skoku do osoby ([A6.7.16](#A6.7.16)) i przewija do niego. Uwaga znika, gdy tylko wiersz agenta jest widoczny.
  Dopóki uwaga jest widoczna, stan badania i „Tylko do odczytu” w wierszu stanu ustępują (oba mówi pasek okna);
  w oknie do 400 px ustępują też liczba wierszy i **Oznaczenia ⓘ**. Przypięty wiersz agenta uwagi nie ma.
- **Dymki badania:** akcję z dymka komórki badania ([A6.7.14](#A6.7.14)) wykonuje okno główne: uruchamia ją tylko
  wtedy, gdy jego dymek przy tej osobie właśnie ją proponuje, i przechodzi na wierzch (nie przy akcji, która otwiera
  terminal badania). Źródło w tabeli źródeł i strona archiwum otwierają się w innym oknie. Własna odpowiedź na
  czekającą pozycję nie jest w innym oknie proponowana; **Czeka na załatwienie ›** otwiera panel w oknie głównym. Gdy
  okno główne jest zamknięte, akcji, które by wykonało, w dymku nie ma.
- **Obsługa:** aplikacja: **Pokaż tymczasowo** w wierszu stanu Tabeli; stan śledzenia na pasku okna
  ([S4.1.7](S4-research-from-the-app.md#S4.1.7)).
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:34513c94 src/windows/agent-state.ts, agent-mirror.ts, src/ui/agent-window-ui.ts (zrcadlo stavu agenta, Tabulka čte vstup výzkumu z hlavního okna) · src/ui/table-view/table-filter.ts researchFilterIdle (čip výzkumu nebo sloupec fromResearch, bez ctx.research) · table-viewbar.ts .tv-view-note (role status) · index.html .tv-view-note na telefonu jen tečka · d24ff2ec src/ui/table-view/table-ui.ts tableAgentRow (jen windowAgentFollow, tj. další okno; attached posune, attached/paused poznámka, ukotvený ne), tableShowAgentRow, tableAgentFollowChanged · table-grid.ts revealKey(center, smooth, keepSelection), REVEAL_GLIDE_MS 300, prefers-reduced-motion · index.html .tv-row.is-agent (--follow-c1-soft, linka, font-weight 600, bez tv-agent-bar) · src/ui/live-follow-ui.ts (pauza Tabulky: kolečko, posuvník, stisk v řádcích, klávesy; lišta, hlava, stavový řádek ne) · table-bar.ts updateAgentNote (tv-status-agent, aria-live polite, showTemp) · 18dbb544 (poznámka: stav výzkumu a jen ke čtení ustoupí; do 400 px počet, Značky, ◎) · b8d21457 src/windows/window-table-research.ts (TABLE_BUBBLE_ACTION, bubbleRunsHere source / web, hlavní okno ověří nabídku, do popředí ne u terminálu, bez odpovědi čekající položky, při zavřeném hlavním okně vynechané) · strings.ts table.agentRowHidden, table.researchFilterOff, table.link.showTemp · CHANGELOG.cs.md 3.30.0 „Výzkum v Tabulce dalšího okna“, „Sledování agenta ve všech oknech“ · spec 097 K1.2, K3.1, K3.2, O4, dotaz 6 · app:docs/ZADANI_DEV_sledovani-ve-vsech-oknech.md §5; ZADANI_UIX dotazy 11, 14, 15 · prace/1116-app-097-sledovani-okna -->

<a id="A6.7.19"></a>
### A6.7.19 Zakres: lista osób

Tabela pokazuje całe drzewo albo jedną listę osób ([A11](A11-lists-of-people.md)). Zakres zawęża wiersze do osób
listy; filtr, wyszukiwanie i chipy obowiązują wtedy w jego obrębie.

| Wiersze | W zakresie listy |
|---|---|
| **Osoby** | osoby listy w kolejności listy; pierwsza kolumna **#** to kolejność, sortowanie „Sortowanie: # (kolejność listy)” |
| **Związki** | związki, w których co najmniej jeden partner jest na liście; partner spoza listy jest szary |
| **Wydarzenia** | wydarzenia, w których uczestniczy co najmniej jedna osoba listy |
| **Źródła** | zawsze całe drzewo: „Źródła nie mają zakresu według listy.” |

- Zakres obowiązuje dla Osób, Związków i Wydarzeń naraz. Liczby w przełączniku **Wiersze** i nad tabelą liczą tylko
  zakres. Sortowanie według innej kolumny jest możliwe; po powrocie do całego drzewa kolejność listy znika.
- Zakres nie jest chipem filtru: **Wyczyść filtry** go nie anuluje.
- **Lista robocza** ([A11.8](A11-lists-of-people.md#A11.8)): za **#** jest kolumna **Gotowe** (pole wyboru, kliknięcie
  lub spacja), a wśród chipów **Zostało** i **Gotowe** (wykluczają się).
- **Usuń z listy:** w zakresie listy stałej jest w menu wiersza osoby (także dla wyboru przez kilka wierszy); osoba
  od razu znika z tabeli, powiadomienie ma **Cofnij**.
- **Osoba spoza listy:** skok odnośnikiem ([A6.7.16](#A6.7.16)) do osoby, której nie ma na liście, mówi
  „Nie ma na liście: {imię}.” z **Pokaż tymczasowo** · **Całe drzewo** · ×. Tymczasowo pokazany lub przypięty wiersz
  ([A6.7.17](#A6.7.17)) spoza listy jest przygaszony, ma **#** „–” i etykietę „poza listą”.
- **Usunięta lista:** tabela wraca do całego drzewa i mówi „Listy widoku już nie ma, pokazano całe drzewo.”
- Zakres zapamiętuje się z widokiem ([A6.7.7](#A6.7.7)), z bieżącym stanem tabeli i w nowym oknie (⧉, [A6.8](#A6.8)).
- **Eksport CSV i XLSX** ([A6.7.9](#A6.7.9)) w zakresie niesie kolumny **#** i **Gotowe** jako pierwsze; **Wszystkie …
  bez filtru** znaczy wszystkie wiersze zakresu.
- **Granice:** drzewo bez list ma w **Zakres** tylko **Całe drzewo** i **Zarządzaj listami…**; w drzewie tylko do
  odczytu nie ma ani **Zarządzaj listami…**, ani **Gotowe** i **Usuń z listy** jako edycji.
- **Obsługa:** **Zakres ▾** na pasku tabeli: **Całe drzewo**, **Listy osób** (ikona rodzaju, liczba osób, ✓ przy
  wybranej), **Zarządzaj listami…**. Na komputerze pierwszy rząd paska zostaje jeden: gdzie jest mało miejsca, napis
  **Zakres** się ukrywa, a całe drzewo jest tylko znakiem. Na telefonie **⋯ → Zakres ›**. Z listy: **Otwórz w tabeli**
  ([A11.3](A11-lists-of-people.md#A11.3)).
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/ui/table-view/table-scope.ts tableScopeOf, scopeRows (Osoby v pořadí, svazek s partnerem, událost s osobou, prameny nikdy), scopeCounts, outsideScope, applyScopeCells · table-ui.ts setTableScope (Osoby, Svazky, Události najednou; LIST_SORT # ↑; zpět bez num), dropGoneScopes + scopeGone, tableScopeRows (Spravovat seznamy… ne v isReadOnly), showTableScopeMenu, tableScopeSheetRows, toggleTableDone, tableRowRemoveIds, hiddenJump.outsideList (:2204), leadColumnsOf (# a Hotovo), export :3125 scopeRows · table-notice.ts:60 (scopeGone, notInList, Celý strom) · table-views.ts:258, :272 view.scope · table-bar.ts tv-scope-btn · strings.ts table.scope, scopeWhole, scopeManage, scopeSources, scopeGone, notInList, outsideList, sortList, col.num, col.done, chip.left, chip.done, lists.toast.removed · app:211323e8, 33fa6cd4 (# a Hotovo v exportu), 9681a1f4 (N1 jeden řádek lišty) · ZADANI_DEV §9, §13d · spec 084 K3.* -->

<a id="A6.7.20"></a>
### A6.7.20 Grupuj według

Wiersze tabeli można pogrupować według jednej wartości. Każda grupa ma nagłówek z wartością i liczbą wierszy i można
ją zwinąć.

| Wiersze | Grupuj według |
|---|---|
| **Osoby** | **Linia badania** (tylko drzewo z liniami), **Ród**, **Nazwisko**, **Miejsce urodzenia**, **Wiek urodzenia**, **Dekada urodzenia**, **Pokolenie**, **Płeć**, **Zawód**, **Dodano – dzień** / **miesiąc** / **rok** ([A11.7](A11-lists-of-people.md#A11.7)), **Gotowe / zostało** (tylko w zakresie listy roboczej) |
| **Związki** | **Dekada ślubu**, **Miejsce ślubu**, **Ród partnerów**, **Liczba dzieci** |
| **Wydarzenia** | **Rodzaj wydarzenia**, **Dekada**, **Miejsce** |
| **Źródła** | nie grupują się |

- Grupuje się tylko na jednym poziomie. Grupy idą rosnąco według wartości (czas, liczba, alfabet); wiersze bez wartości
  są ostatnią grupą „bez wartości” (przy Dodano „wcześniej”). Wewnątrz grupy obowiązuje sortowanie tabeli. Pusta
  grupa się nie pokazuje.
- Wiersz z kilkoma wartościami (kilka linii, kilka zawodów, związek dwóch rodów) jest w każdej swojej grupie. Wiersz
  stanu mówi wtedy „N różnych osób · K grup”.
- Grupowanie jest widoczne jako chip „Pogrupowano: …” z ×; filtr i wyszukiwanie obowiązują dalej. Skok do wiersza
  w zwiniętej grupie ją otwiera.
- Grupowanie zapamiętuje się z widokiem ([A6.7.7](#A6.7.7)). Wartość, której typ wierszy lub drzewo nie oferuje, nie
  jest używana.
- **Eksport CSV i XLSX** pogrupowanej tabeli ma pierwszą kolumnę **Grupa**; wiersz w kilku grupach jest tam w każdej.
- **Obsługa:** **⋯** Tabeli → **Grupuj według ›** (**Bez grupowania** anuluje), **Zwiń wszystkie grupy** /
  **Rozwiń wszystkie grupy**. Nagłówek grupy: kliknięcie, Enter lub spacja zwija i rozwija, ← zwija, → rozwija.
  Na telefonie **⋯ → Grupuj według**; nagłówek grupy zostaje na górze przy przewijaniu.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/ui/table-view/table-group.ts PERSON_KEYS, UNION_KEYS, EVENT_KEYS, offeredGroupKeys (lines jen s liniemi, done jen pracovní seznam), multiValued, groupRows (vzestupně, NO_VALUE_KEY poslední, řazení uvnitř, prázdné ne), noValueLabel (lists.earlier), groupKeysOfRow (skok otevře), groupedExportRows · table-export.ts:131 groupCol · table-views.ts:259, :273 view.group, groupingFits · table-ui.ts tableGroupOffer, tableExportGroups, setTableGroupBy, ⋯ Tabulky :3377, telefon :3423 · strings.ts table.groupBy, groupNone, grouped, groupsCollapse, groupsExpand, groupKey.*, groupNoValue, distinct, groupsN, groupCol · app:84331c31 · ZADANI_DEV §10, §11 · spec 084 K4.* -->

<a id="A6.8"></a>
## A6.8 Widok w osobnym oknie

Na komputerze każdy widok można otworzyć w osobnym oknie, na przykład na drugim monitorze, i to w dowolnej liczbie.
Okno główne zostaje przy swoim widoku. Zapisuje tylko okno główne; pozostałe okna wysyłają mu swoje zmiany
i dostają od niego drzewo.

- **Gdzie to działa:** na komputerze (Windows, macOS, Linux, ChromeOS), także z ekranem dotykowym, w oknie szerszym
  niż 640 px. Na telefonie i tablecie (Android, iOS, iPadOS) oraz w wyeksportowanej aplikacji (plik HTML) ⧉ się nie
  pokazuje, a skróty niczego nie otwierają.
- **Co okno przejmuje:** drzewo, osobę w centrum i to, co pokazuje widok: w Tabeli typ wierszy, filtry,
  wyszukiwanie, zapisany widok, sortowanie i wybrany wiersz; w Rodzinie powiększenie, w Wachlarzu kręgi, na Mapie
  miejsca i powiększenie. Potem okno ma własny stan. Odświeżenie okna (F5) zachowuje jego widok i osobę.
- **Co okno ma:** zamiast paska aplikacji nagłówek: nazwę drzewa, przełącznik widoków (poniżej 960 px jako „{widok} ▾”),
  **Śledź wybór** ([A6.8.1](#A6.8.1)), **Cofnij**, **Ponów** i ⧉ **Otwórz kolejne okno**. Przełącznika drzew, menu
  **Badanie**, Ustawień ani małego panelu badania okno nie ma. Od aplikacji 3.30.0 zamiast **Śledź wybór** jest
  przełącznik **Wybór** ([A6.8.4](#A6.8.4)).
- **Zmiany:** w oknie można edytować osobę (menu osoby, **Edytuj**) i komórkę Tabeli. Zapisuje je okno główne, można
  je cofnąć jako jego kroki i od razu pokazują się we wszystkich oknach. **Cofnij** i **Ponów** w nagłówku okna cofają
  i ponawiają kroki okna głównego. Gdy drzewo w międzyczasie zmieniło się w innym oknie, zmiana nie zostaje
  zastosowana: „Drzewo zmieniło się w międzyczasie w innym oknie. Zmiany nie zastosowano, dane odświeżono.”
  Rozpoczęta komórka Tabeli przy tym zostaje („Szkic zachowany · Enter zastosuje, Esc odrzuci”).
- **Badanie:** połączenie z badaniem (most, śledzenie, wysyłanie zmian) obsługuje tylko okno główne. Pozycje badania
  w menu osoby stoją w oknie pod nagłówkiem **Badanie · wykona okno główne** i wykonuje je okno główne. Podczas
  śledzenia badania na żywo ([S1.4](S1-connecting-app-and-research.md#S1.4)) okna są tylko do odczytu jak okno
  główne: „Tylko do odczytu · okno główne śledzi badanie” z **Przejdź do okna głównego**.
- **Granice:**
  - ⧉ w oknie głównym pokazuje liczbę innych okien („2 inne okna”, poniżej 1280 px tylko liczbę). Jego menu ma na
    górze **Otwarte okna** (każde z **Przenieś na wierzch** i ×) oraz **Zamknij wszystkie**;
  - od 5 otwartych okien aplikacja ostrzega, że każde kolejne okno wymaga pamięci; niczego nie zabrania;
  - okno zablokowane przez przeglądarkę zostaje zgłoszone („Przeglądarka zablokowała nowe okno…”) ze **Spróbuj
    ponownie**;
  - tytuł okna podaje widok i drzewo („Tabela – Horákowie – Strom”), tytuł okna głównego drzewo („Horákowie –
    Strom”).
- **Obsługa:** aplikacja: ⧉ **Otwórz w nowym oknie** obok przełącznika widoków (menu sześciu widoków, przy drzewie
  z badania także **Przegląd badania**, [S4.1.6](S4-research-from-the-app.md#S4.1.6)); ⧉ na pasku Tabeli za
  **Eksport ▾**; na karcie widoku Ctrl+klik (macOS ⌘+klik), środkowy przycisk albo prawy klik (Shift+F10) →
  **{widok} w nowym oknie**.
- **Obowiązuje od:** aplikacja 3.28.0
- **Od aplikacji 3.30.0:** podczas śledzenia badania na żywo każde okno śledzi agenta we własnym widoku, a pasek okna
  mówi, jak okno śledzi, zamiast „Tylko do odczytu · okno główne śledzi badanie”
  ([S4.1.7](S4-research-from-the-app.md#S4.1.7)). Tabela w oknie pokazuje badanie jak w oknie głównym
  ([A6.7.18](#A6.7.18)).

<!-- zdroj: app:4b1373a7 src/windows/window-open.ts isDesktopSystem, windowsOffered (role main, ne isViewMode, > MOBILE_MAX 640, ne isPhoneBar), openInNewWindow · src/windows/window-controls.ts openWindow (BLOCKED_TOAST_MS 10 s, win.retry; MANY_WINDOWS 5, manyWindows), INDICATOR_TEXT_MIN_WIDTH 1280, renderMenu (6 pohledů, thisView, overview jen UI.canOpenResearchOverview), wireTabs (ctrl/meta click, auxclick button 1, contextmenu, Shift+F10 / ContextMenu) · src/windows/view-window-state.ts (přenos stavu, F5 satelitu) · src/windows/sat-header.ts · src/windows/satellite.ts readOnly (live, locked) · src/windows/sat-states.ts (live strip readOnlyLive, goToMain; CONFLICT_TOAST_MS) · src/windows/window-drafts.ts (draftKept) · src/windows/window-research-menu.ts (researchInMain) · src/windows/window-title.ts · index.html html.window-satellite .toolbar skryto · strings.ts win.* · CHANGELOG.cs.md 3.28.0 · spec 079 K1.1–K1.4, K1.7 · prace/1112-app-okna-zaklad, 1112-app-okna-pohledy -->

<a id="A6.8.1"></a>
### A6.8.1 Śledź wybór

Wybrana osoba jest wspólna dla okien. Co wybór w innym oknie zrobi w tym oknie, określa przełącznik **Śledź wybór**
w nagłówku okna.

| Tryb | Co robi osoba wybrana w innym oknie | Domyślnie w widokach |
|---|---|---|
| **przełączaj** | staje się centrum okna jak po Ustaw w centrum: Potomkowie pokazuje jej potomków, Wachlarz przodków, Rodzina jej rodzinę | Rodzina, Potomkowie, Wachlarz |
| **tylko zaznaczaj** | zostaje tylko zaznaczona: karta pierścieniem, w Wachlarzu wycinek, na Osi czasu wiersz, na Mapie jej miejsca, w Tabeli wiersz; centrum zostaje | Oś czasu, Mapa, Tabela |
| **wyłączone** | nic; okno ma własny wybór osoby i swojego wyboru nie wysyła | – |

- **Granice:**
  - **przełączaj** jest tylko w Rodzinie, Potomkach i Wachlarzu; gdzie indziej są tylko **tylko zaznaczaj**
    i **wyłączone**;
  - własne kliknięcie w oknie zmienia centrum tylko w tym oknie; okno, które przełączyło się za innym oknem, nie
    przekazuje wyboru dalej;
  - okno główne śledzi wybór zawsze i przełącznika nie ma;
  - wybór dotyczy jednego okna i przetrwa jego odświeżenie (F5). Wybrany tryb, który nie jest domyślny, obowiązuje
    także po przełączeniu widoku w oknie (**przełączaj** tam, gdzie go nie ma, jak **tylko zaznaczaj**); inaczej
    obowiązuje tryb domyślny nowego widoku.
- **Obsługa:** aplikacja: w nagłówku okna **Śledź wybór: {tryb} ▾**.
- **Obowiązuje od:** aplikacja 3.28.0
- **Od aplikacji 3.30.0:** okno, które podczas śledzenia badania śledzi agenta i nie jest wstrzymane, osobę wybraną
  w innym oknie tylko zaznacza, także w trybie **przełączaj**; przeskok za agentem nie jest wysyłany jako wybór osoby
  ([S4.1.7](S4-research-from-the-app.md#S4.1.7)).
- **Od aplikacji 3.30.0:** przełącznik nazywa się **Wybór ▾**, a te tryby są w jego grupie **To okno** · wybór
  z innych okien. Druga grupa **Okno główne** mówi, co wybór w tym oknie zrobi w oknie głównym ([A6.8.4](#A6.8.4)).

<!-- zdroj: app:4b1373a7 src/windows/follow-mode.ts RECENTERING (family, descendants, fan), defaultFollowMode, followModesFor, effectiveFollowMode, followChoiceToStore (sessionStorage pro okno) · src/windows/window-selection.ts (origin, bez smyčky) · src/windows/sat-header.ts · strings.ts win.followSelectionState, followModeSwitch, followModeMark, followModeOff, followModeSwitchNote, followModeMarkNote, followSelectionOff · spec 079 K1.3, K2.1 · prace/1112-app-okna-sledovat (7bb1b8b2) -->

<a id="A6.8.2"></a>
### A6.8.2 Gdy brakuje okna głównego

Okno bez okna głównego nic nie traci i nic nie zamyka się samo. Zostaje tylko do odczytu z ostatnimi danymi.

| Stan | Co okno pokazuje | Wybór |
|---|---|---|
| okno główne jest zamknięte (3 s bez wiadomości od niego) | pasek „Okno główne jest zamknięte · stan z {czas}, tylko do odczytu”; pozycji badania w menu osoby pod **Badanie · tylko z oknem głównym** nie da się użyć | **Otwórz Strom**, **Ustaw jako główne** |
| drzewo zostało usunięte w oknie głównym | „Drzewo już nie istnieje” zamiast zawartości | **Zamknij okno** |
| drzewo jest zablokowane | „Drzewo jest zablokowane · Hasło wpisuje się w oknie głównym.” | **Przejdź do okna głównego** |
| okno główne przełączyło drzewo | okno przełącza się razem z nim, widok zostaje, wybór się kasuje („{drzewo} → {drzewo}”) | – |

- **Granice:**
  - **Otwórz Strom** otwiera nowe okno główne; okna łączą się z nim i pasek znika;
  - **Ustaw jako główne** robi główne z tego okna: wczytuje drzewo z pamięci (dane w oknie mogły być starsze niż
    zapisane), dostaje pasek aplikacji, a widok zostaje. Gdy w międzyczasie powstało inne okno główne, nic się nie
    dzieje;
  - odświeżenie okna głównego (F5) paska nie pokazuje.
- **Obsługa:** aplikacja: przyciski na pasku i w miejscu zawartości okna.
- **Obowiązuje od:** aplikacja 3.28.0
- **Od aplikacji 3.30.0:** gdy okno główne zamknie się podczas śledzenia badania, jedno z innych okien samo staje się
  oknem głównym i śledzenie trwa w nim ([S4.1.7](S4-research-from-the-app.md#S4.1.7)). Gdy to niemożliwe, okna
  pokazują „Nie można wznowić śledzenia · okno główne zamknięte” z **Ustaw jako główne** i **Otwórz Strom**.

<!-- zdroj: app:4b1373a7 src/windows/satellite.ts MAIN_SILENCE_MS 3000, lastHeardAt, treeGone · src/windows/sat-states.ts (closed strip mainClosed, treeGone, treeLocked, SWITCHED_TOAST_MS) · src/windows/become-main.ts (zámek ifAvailable, znovunačtení jako hlavní z IndexedDB) · src/windows/window-research-menu.ts researchMainOnly · strings.ts win.mainClosed, openStrom, makeMain, treeGone, treeGoneNote, treeLocked, treeLockedNote, closeWindow, goToMain, treeSwitched · spec 079 K1.5 · prace/1112-app-okna-zaklad (stavy 1–6) -->

<a id="A6.8.3"></a>
### A6.8.3 Druga karta aplikacji

Aplikacja otwarta drugi raz w zwykłej karcie lub oknie przeglądarki nie wczytuje drugiej kopii drzewa. Pokazuje
„Strom jest już otwarty w innym oknie” z wyjaśnieniem „Zapisuje tylko jedno okno, aby zmiany się nie nadpisywały.
Kolejne okna łączą się z nim.”

- **Granice:**
  - **Przełącz tam** przenosi okno główne na wierzch. Gdy przeglądarka na to nie pozwala, karta to mówi i dodaje
    „Tę kartę można zamknąć.”;
  - **Otwórz jako kolejne okno** robi z karty okno jak w [A6.8](#A6.8), z Tabelą;
  - link otwarty w drugiej karcie (osoba, wyszukiwanie, linki badania, plik otwarty przez zainstalowaną aplikację)
    trafia do okna głównego dokładnie raz: „Link otworzył się w oknie głównym.”;
  - druga karta nic nie zapisuje do listy drzew ani do Ustawień.
- **Obsługa:** aplikacja: **Przełącz tam**, **Otwórz jako kolejne okno**.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:4b1373a7 src/windows/window-role.ts (Web Lock strom-main ifAvailable → main, jinak second-tab) · src/windows/second-tab.ts (secondTabSatelliteKind table) · src/windows/window-link.ts (předání odkazu hlavnímu jednou) · src/windows/window-start.ts openLinkFromWindow · strings.ts win.alreadyOpen, alreadyOpenNote, switchThere, openAsWindow, switchFailed, tabCanClose, linkForwarded · CHANGELOG.cs.md 3.28.0 · spec 079 K1.6 · prace/1112-app-okna-zaklad (7d22e396) -->

<a id="A6.8.4"></a>
### A6.8.4 Co wybór w kolejnym oknie zrobi w oknie głównym

Osoba wybrana w Tabeli, na Osi czasu albo na Mapie kolejnego okna zostaje w oknie głównym zaznaczona albo staje się
jego centrum. Określa to grupa **Okno główne** w przełączniku **Wybór** w nagłówku kolejnego okna.

| Wybór | Co się dzieje w oknie głównym |
|---|---|
| **tylko zaznaczaj** (domyślnie na Osi czasu i na Mapie) | osoba zostaje zaznaczona jak w trybie **tylko zaznaczaj** ([A6.8.1](#A6.8.1)); centrum zostaje |
| **ustaw w centrum** (domyślnie w Tabeli) | osoba staje się centrum okna głównego jak po Ustaw w centrum przy karcie, a drzewo jest wokół niej przerysowane, także gdy wcześniej jej nie rysowało |

- **Gdzie:** wybór mają Tabela, Oś czasu i Mapa kolejnego okna (na Mapie wybór osoby przy miejscu; kliknięcie samego
  miejsca nic nie wysyła). Rodzina, Potomkowie i Wachlarz kolejnego okna zmieniają kliknięciem własne centrum,
  a w oknie głównym osobę tylko zaznaczają.
- **Przechodzenie po wierszach:** strzałki i kliknięcie robią to samo. Okno główne zaznacza osobę od razu, a centrum
  zmienia dopiero 200 ms po ostatnim wyborze i tylko na ostatnio wybraną osobę. Przejście wierszy strzałkami zmienia
  więc centrum raz.
- **Powiadomienie i powrót:** na dole pośrodku drzewa okna głównego jest „Środek wybrany w innym oknie” z przyciskiem
  **↶ {imię}** (centrum sprzed pierwszego wyboru) i ×. Seria wyborów z jednego okna to w historii okna głównego jeden
  krok: jeden krok wstecz (↩ w lewym dolnym rogu, Alt+←) albo ↶ przywraca centrum sprzed niej. Seria kończy się
  własnym krokiem w oknie głównym (Ustaw w centrum, Przejdź do, ↩, ↪, inny widok), zamknięciem powiadomienia,
  przełączeniem wyboru na **tylko zaznaczaj** i zamknięciem kolejnego okna. Przełączenie wyboru centrum nie
  przywraca.
- **Osoba, której okno główne nie rysuje** (przy **tylko zaznaczaj**): widok Rodzina, Potomkowie albo Wachlarz okna
  głównego mówi „{imię} – brak w tym widoku.” z **Przejdź do** (osoba staje się centrum) i ×.
- **Granice:**
  - okno główne, które śledzi agenta badania, osobę tylko zaznacza; centrum zostaje przy agencie
    ([S4.1.7](S4-research-from-the-app.md#S4.1.7)). Raz na serię mówi „Śledzenie agenta – wybór z innego okna jest
    tylko zaznaczany.”; kolejne okno ma przy wyborze „(agent)”, a w menu „Okno główne śledzi agenta – wybór jest tam
    tylko zaznaczany.” Po wstrzymaniu lub końcu śledzenia nic się wstecz nie przełącza: **ustaw w centrum** obowiązuje
    od następnego wyboru;
  - osoba, której tymczasem nie ma w drzewie: centrum zostaje, „Wybranej osoby nie ma już w drzewie.” Powiadomienie
    bez × znika po 6 s;
  - osoba, którą Tabela okna głównego pomija (filtr, wyszukiwanie lub lista; nie przypięty wiersz ani wiersz
    pokazany tylko tymczasowo): centrum zostaje, osoba nie zostaje zaznaczona, a powiadomienie bez imienia „Wybrana
    osoba jest w tym oknie ukryta.” znika po 6 s. Rodzina, Potomkowie i Wachlarz nikogo nie ukrywają;
  - osoba, która już jest centrum: nic się nie dzieje;
  - przy **wyłączone** w grupie **To okno** i gdy okno główne nie jest otwarte, grupa **Okno główne** jest wyszarzona
    z uwagą „Niedostępne – udostępnianie wyboru jest w tym oknie wyłączone.” albo „Okno główne nie jest otwarte.”;
    wybór zostaje zapisany;
  - wybór dotyczy jednego okna i jego Tabeli, Osi czasu i Mapy, przetrwa odświeżenie okna (F5); każde kolejne okno ma
    własny. Dopóki się nie wybierze, decyduje widok: Tabela ustawia w centrum, Oś czasu i Mapa zaznaczają. Wybrane
    **tylko zaznaczaj** obowiązuje także w Tabeli i przetrwa odświeżenie okna.
- **Obsługa:** aplikacja: w nagłówku kolejnego okna **Wybór ▾** → **Okno główne** · wybór w tym oknie: **tylko
  zaznaczaj**, **ustaw w centrum**. Zamknięty przełącznik pokazuje, co jest wybrane (w wąskim oknie skrótowo
  ikonami); całe brzmienie ma w dymku.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:e7d3bb11 src/windows/follow-mode.ts SendMode mark|focus, SENDING table/timeline/map, sendModeKey (sessionStorage okna), getSendModeChoice · src/windows/sat-header.ts followControlParts (FOLLOW_LABEL_MIN_WIDTH 1280, FOLLOW_BOTH_MIN_WIDTH 1100), followSendGroupState (off, no-main, agent), sendModeName = contextMenu.focus malým písmenem, followControlAria · src/windows/satellite.ts sendMode (followSelection && sendModeAvailable), post select intent, seq · app:edaec740 src/windows/window-focus.ts WINDOW_FOCUS_DELAY_MS 200, take (seq), fire (deleted, hidden, followingAgent, focusId), run push/replace, endRun · src/windows/window-selection.ts wireMainSelection (markNotice not-in-view, VIEW_STEP_EVENT, onSendEnded), src/windows/window-start.ts mainFocusDeps (hidden: () => false, drawn family/descendants/fan) · src/ui/window-notice.ts PLAIN_NOTICE_MS 6000 · strings.ts satFollow.*, mainNotice.* · CHANGELOG.cs.md 3.30.0 · dirigent:spec/110 (rozhodnutí 18. 11. 17:35 a 17:45: „Zaměřit“ = nový střed) · app:docs/ZADANI_DEV_vyber-z-okna.md §1–§7 · app:6be873dc src/windows/follow-mode.ts defaultSendMode (table → focus, jinak mark), parseSendMode, setSendMode (ukládá focus i mark) · app:4927ccab src/ui/table-view/table-ui.ts tableHidesPerson (filtr, hledání, seznam; ne pinOutside, tempShown, sources), src/windows/window-start.ts mainFocusDeps hidden, src/windows/window-focus.ts { kind: 'hidden' }, strings.ts mainNotice (skrytá osoba), e2e/windows-send-focus.spec.ts -->
