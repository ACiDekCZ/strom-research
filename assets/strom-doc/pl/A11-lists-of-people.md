<a id="A11"></a>
# A11 Listy osób

Lista osób trzyma wybrane osoby drzewa pod jedną nazwą, aby można było z nimi pracować wielokrotnie: w Tabeli jako
jej zakres ([A6.7.19](A6-views.md#A6.7.19)), w eksporcie i jako lista robocza z odhaczaniem. Lista powstaje według
reguły (ród, przodkowie, potomkowie, linia badania, filtr Tabeli, kiedy osoby doszły), z wyników wyszukiwania lub
ręcznie. Rozdział opisuje aplikację Strom 3.30.0.

<!-- zdroj: dirigent:spec/084-seznamy-osob (K1.1–K8.4, rozhodnutí 14. a 16. 11.) · app:714a8ab2..60265541 (dirigent:prace/1116-app-084-seznamy) · app:docs/ZADANI_DEV_seznamy-osob.md §1–§13, §15, §16 · app:src/person-lists.ts, src/person-lists-data.ts · app:CHANGELOG.cs.md 3.30.0 „Pojmenované seznamy osob“ -->

<a id="A11.1"></a>
## A11.1 Lista stała, automatyczna i robocza

Lista jest **stała** albo **automatyczna**. Lista stała trzyma swoje osoby i zmienia się tylko ręcznie. Lista
automatyczna to zapisana reguła: jej osoby liczą się zawsze na nowo.

| Rodzaj | Co trzyma | Ręcznie dodać i usunąć | Ręczna kolejność |
|---|---|---|---|
| **stała** | osoby w ręcznej kolejności; regułę, z której powstała (**Utworzona z**), gdy jakąś ma | tak | tak |
| **automatyczna** | tylko regułę (**Według**) | nie: „Zawartość wyznacza reguła – ręcznie nic się nie dodaje ani nie usuwa.” | nie |
| **robocza** | lista stała z włączonym **Odhaczaj gotowe** ([A11.8](#A11.8)) | tak | tak |

- Rodzaj widać przy liście w przeglądzie (ikona i słowo **stała**, **automatyczna**, **robocza**), w szczegółach
  (etykieta **Lista stała**, **Lista automatyczna**, **Lista robocza**) i w **Zakres** Tabeli (ikona).
- Lista ma nazwę. Nazwa jest w drzewie jedyna; porównuje się ją bez znaków diakrytycznych, wielkości liter i zbędnych
  spacji. Zajęta nazwa się nie zapisze: „Lista o tej nazwie już istnieje. Proponowana: „{nazwa} (2)”.” (kolejny wolny
  numer).
- Osób zastępczych na liście nie ma nigdy.
- **Granice:** listy zmieniają się tylko w drzewie, które można zmieniać. W drzewie tylko do odczytu (wyeksportowana
  strona HTML, śledzone drzewo, drzewo zapisane nowszą wersją aplikacji, zablokowane drzewo) listy można przeglądać
  i otworzyć w Tabeli, edycji brak; zarządzanie ma etykietę **Tylko do odczytu**. Zablokowaną osobę do listy dodać
  można.
- **Obsługa:** **Akcje → Listy osób…** ([A11.3](#A11.3)).
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/person-lists.ts listKind (dynamic → auto, checklist → work), listPersonIds (bez zástupných osob) · src/person-lists-data.ts foldListName, isListNameTaken, suggestListName · src/data.ts:2130 listsReadOnly (isReadOnly || isTreeLocked; isTreeLocked: sledovaný strom liveTreeId, isNewerData, isLocked) · src/ui/person-list-add.ts personListMenuRows (zamčená osoba ano, app:60265541) · strings.ts lists.kind.*, badge.*, rule.key, rule.origin, autoInfo, save.dup, readOnly · ZADANI_DEV §1, §16c, Q1 -->

<a id="A11.2"></a>
## A11.2 Reguła listy

Reguła mówi, które osoby należą do listy. Lista stała używa jej raz przy powstaniu, automatyczna za każdym razem.

| Reguła | Kogo znajdzie | Nazwa nowej listy | Domyślne sortowanie |
|---|---|---|---|
| **Pusta** | nikogo, osoby dodaje się ręcznie | – | **Ręcznie** |
| **Ród** | członków rodu związanych krwią ([A4](A4-surnames-and-families.md)) | **Ród** nazwa rodu | **Od najstarszych** |
| **Przodkowie osoby** | przodków wybranej osoby, **wszystkie pokolenia** albo **do N pokoleń** | „Przodkowie – {osoba}” | **Według pokoleń** |
| **Potomkowie osoby** | potomków wybranej osoby, wszystkie pokolenia albo do N pokoleń | „Potomkowie – {osoba}” | **Według pokoleń** |
| **Linia badania** | osoby linii badania, tak samo jak chip linii w Tabeli ([A6.7.14](A6-views.md#A6.7.14)) | nazwa linii | **Od najstarszych** |
| **Dodane w okresie** | osoby dodane do drzewa w ostatnich 7, 30, 90 lub innej liczbie dni ([A11.7](#A11.7)) | „Dodane w ostatnich {n} dniach” | **Według dodania** |
| filtr Tabeli | wiersze Tabeli po filtrze i sortowaniu ([A11.6](#A11.6)) | nazwa widoku | **Ręcznie** (kolejność Tabeli) |

- **Partnerzy:** ród, przodkowie i potomkowie biorą tylko osoby związane krwią. Partnera, który wszedł do rodziny
  przez małżeństwo, na liście nie ma, dopóki nie zostanie dodany ręcznie.
- Pokolenia można wybrać od 1 do 10 albo **wszystkie pokolenia**. Liczba dni to 1 do 3650. Lista liczy od pierwszego
  dnia okresu („w ostatnich 30 dniach” = dziś i 29 dni wcześniej).
- Nazwa zmienia się z wyborem reguły, dopóki pole **Nazwa** nie zostanie nadpisane.
- Każda opcja pokazuje liczbę osób, które lista by dostała. Linia badania jest tylko w drzewie z liniami.
- **Aktualizuj automatycznie** (domyślnie wyłączone) tworzy listę automatyczną; w przeciwnym razie powstaje stała:
  „Lista stała: osoby wybiera się teraz, potem zmieniają się tylko ręcznie. Reguła zostaje dla „Uzupełnij według
  reguły”.”
- **Obsługa:** **Listy osób → Nowa lista…** → **Według**, **Aktualizuj automatycznie**, **Utwórz**; przy liście
  **Edytuj regułę…**. Potem otwiera się zarządzanie z nową listą i powiadomienie „Lista „{nazwa}” zapisana.”
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/person-lists.ts rulePersonIds (rods/ancestors/descendants přes selection().memberIds – jen pokrevní, Q2; line přes personLineRole jako čip linie; tableFilter filterRows + sortRows; added: startOfDay − (days − 1) dní), ruleLabel · src/ui/person-list-new-ui.ts PERIODS 7/30/90, MAX_GENERATIONS 10, MAX_DAYS 3650, jméno podle pravidla do přepsání, počet u volby · ZADANI_DEV §3 (výchozí řazení podle pravidla), Q2 · app:e09dcacb · strings.ts lists.new.*, keep, keepOn, keepOff, create, toast.saved, rule.* -->

<a id="A11.2.1"></a>
### A11.2.1 Uzupełnij według reguły

Lista stała, która powstała z reguły, może jej użyć ponownie: **Uzupełnij według reguły** dodaje osoby, które
reguła dziś znajdzie, a których na liście nie ma.

- Osoba ręcznie usunięta z listy przez uzupełnienie nie wraca. Wraca tylko przez ręczne dodanie.
- Nowe osoby trafiają na koniec ręcznej kolejności, posortowane według sortowania listy (przy sortowaniu ręcznym
  **Od najstarszych**).
- Powiadomienie: „Dodano N osób według reguły.” z **Cofnij**; gdy nic nie dojdzie, „Lista jest kompletna.”
- Lista stała bez reguły (powstała pusta lub z wyników wyszukiwania) tej opcji nie ma.
- **Obsługa:** szczegóły listy, wiersz **Utworzona z** → **Uzupełnij według reguły**.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/person-lists.ts withRuleFilled (bez personIds a removed, na konec, ruční → old), withPersonsRemoved (removed jen s pravidlem), withPersonsAdded (ruční přidání vyjme z removed) · strings.ts lists.fill, toast.filled, toast.full · ZADANI_DEV §3c -->

<a id="A11.2.2"></a>
### A11.2.2 Zamrażanie listy automatycznej

**Zamroź** robi z listy automatycznej listę stałą z obecnymi osobami w obecnej kolejności („Stanie się stałą
z obecnymi osobami”). Reguła zostaje jako **Utworzona z**.

- Powiadomienie „Lista zamrożona – teraz jest stała.” z **Cofnij**.
- Z listy stałej nie można zrobić automatycznej.
- **Obsługa:** **⋯** listy automatycznej → **Zamroź**.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/person-lists.ts withFrozen (dynamic false, personIds = listPersonIds, rule zůstává) · strings.ts lists.menu.freeze, freezeSub, toast.frozen · app:3dc8e709 -->

<a id="A11.2.3"></a>
### A11.2.3 Reguła, która nic już nie znajduje

Gdy zniknie to, na czym reguła stoi, lista zostaje, tylko pusta, i mówi dlaczego:

- „Reguła nic już nie znajduje: osoba {imię} została usunięta.” (przodkowie lub potomkowie usuniętej osoby; imię
  reguła pamięta z chwili powstania);
- „Reguła nic już nie znajduje: ród przestał istnieć.”;
- „Reguła nic już nie znajduje: linię usunięto.”
- Pod zdaniem są **Edytuj regułę…** i **Usuń listę**.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/person-lists.ts ruleBroken (person podle rule.personName, rod, line) · strings.ts lists.ruleGone, ruleGoneRod, ruleGoneLine, deleteList · ZADANI_DEV §7d -->

<a id="A11.3"></a>
## A11.3 Zarządzanie listami: Listy osób

Wszystkie listy drzewa są w jednym miejscu, w oknie **Listy osób**: po lewej przegląd, po prawej wybrana lista.

- **Przegląd:** każda lista z ikoną rodzaju, nazwą, liczbą osób i wierszem pod nazwą (**stała · zmieniono …**,
  **automatyczna ·** reguła, **robocza · zostało a z b**). Sortowanie **Według nazwy** lub **Według zmiany**. Od 9
  list jest nad nimi pole **Szukaj w listach** (bez względu na znaki diakrytyczne).
- **Szczegóły:** nazwa (zmienia się na miejscu: kliknięcie, ✎ lub F2; Enter zapisuje, Esc przywraca), etykieta
  rodzaju, wiersz reguły (**Według** / **Utworzona z**), podsumowanie ([A11.3.1](#A11.3.1)) i **Osoby na liście · N**
  z sortowaniem ([A11.4](#A11.4)). Przy liście stałej × przy osobie (**Usuń z listy**) i **Dodaj osobę…**
  ([A11.5](#A11.5)). Przy osobie jest według sortowania pokolenie, data dodania albo miejsce urodzenia.
- **⋯ listy** (przy wierszu w przeglądzie i w szczegółach): **Otwórz w tabeli**, **Na mapie** (od aplikacji 3.31.0),
  **Zmień nazwę**, **Duplikuj**,
  **Odhaczaj gotowe** (stała, [A11.8](#A11.8)) albo **Zamroź** (automatyczna, [A11.2.2](#A11.2.2)), **Eksportuj ›**
  ([A11.9](#A11.9)), **Usuń**.
  - **Otwórz w tabeli** zamyka okno i otwiera Tabelę w zakresie listy ([A6.7.19](A6-views.md#A6.7.19)).
  - **Na mapie** (także przycisk obok **Otwórz w tabeli** w szczegółach) zamyka okno, ustawia listę jako wybór okna
    ([A6.6](A6-views.md#A6.6)) i otwiera Mapę z zakresem **Wybór** ([A6.5.7](A6-views.md#A6.5.7)). W kolejnym oknie
    wykonuje to okno główne; bez niego **Na mapie** jest niedostępne („Okno główne nie jest otwarte.”).
  - **Duplikuj** robi kopię tego samego rodzaju z tą samą regułą, kolejnością, ręcznie usuniętymi i odhaczonymi,
    z nazwą „{nazwa} (2)”.
  - **Usuń** nie pyta: powiadomienie „Lista „{nazwa}” usunięta.” z **Cofnij**.
- **Granice:**
  - szczegóły pokazują najwyżej 200 osób: „Pokazano pierwsze 200 z N osób.” z odnośnikiem do Tabeli, gdzie są
    wszystkie;
  - każda zmiana listy to jeden krok **Cofnij**; utworzenie (także duplikat), zmiana nazwy, zamrożenie i usunięcie
    mają wpis w historii zmian;
  - w innym oknie aplikacji ([A6.8](A6-views.md#A6.8)) zmiana listy zapisuje się przez okno główne.
- **Obsługa:** **Akcje → Listy osób…**; na telefonie **Więcej → Listy osób**; w Tabeli **Zakres ▾ → Zarządzaj
  listami…**. Klawisze w przeglądzie: ↑ ↓ wybór, Enter zmiana nazwy, Delete usunięcie, Esc zamyka okno. Na telefonie
  przegląd i lista zmieniają się na całym ekranie (‹ **Wróć do list**), **⋯** to panel od dołu.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/ui/person-lists-ui.ts (OVERLAY_ID person-lists-modal, SEARCH_FROM 9, LIST_DETAIL_ROWS 200, NARROW_QUERY, přejmenování klik/✎/F2, klávesy ↑↓ Enter Delete) · src/ui/person-list-hooks.ts listMenu (freezeAndChecklistRows, exportRows) · src/data.ts duplicatePersonList (structuredClone, suggestPersonListName), deletePersonList (Vrátit), storePersonList audit (personList.save, :2224 přejmenování, :2254 personList.delete, :2330 zmrazení) · index.html #actions-lists-row · src/ui/bottom-sheet.ts řádek Seznamy osob v listu Více · strings.ts menu.lists, lists.title, search, byName, byChange, changed, left, people, remove, addPerson, openTable, menu.*, large, back, toast.deleted, undo.*, audit.* · app:4acf7a09, 3dc8e709 · ZADANI_DEV §2, §16 (okna 079: WindowEditSink) · 3.31.0 Na mapě: src/ui/person-lists-ui.ts (tlačítko pl-onmap v detailu, ⋯ řádek map za open), src/ui/person-list-hooks.ts showOnMap, src/windows/window-show-on-map.ts, strings.ts lists.onMap, onMapTitle, table.onMapNoMain (app:2a578474, 39020cf1, ZADANI_DEV_vyber-osob §6) -->

<a id="A11.3.1"></a>
### A11.3.1 Podsumowanie listy

Szczegóły listy podsumowują jej osoby w kafelkach: **osób** · **urodzenia** (najstarszy i najmłodszy rok urodzenia,
bez lat „–”) · **ze zdjęciem** · **z dowodem** · **z opowieścią**; lista robocza ma dodatkowo najpierw **zostało**.

- **Z dowodem** jest osoba z co najmniej jednym cytowaniem źródła przy osobie, jej danych, wydarzeniach lub
  związkach.
- Pod kafelkami jest odnośnik „N bez dowodu ›”: otwiera Tabelę w zakresie listy z chipem **Bez źródła**.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/person-lists.ts listSummary (birthMin/Max, photo, personEvidence sources > 0, story.text, noCite, left jen u pracovního) · src/ui/person-list-hooks.ts openInTable (noSource) · strings.ts lists.sum.* · app:211323e8 (Otevřít v Tabulce s čipem Bez pramene) · spec 084 K8.2 -->

<a id="A11.4"></a>
## A11.4 Sortowanie listy

Lista ma jedno z pięciu sortowań. Z kolejności listy korzysta Tabela (kolumna **#**) i eksport.

| Sortowanie | Kolejność |
|---|---|
| **Od najstarszych** | według daty urodzenia; bez daty na końcu |
| **Według pokoleń** | przy liście z przodków lub potomków pokolenie od osoby reguły, w przeciwnym razie pokolenie jak kolumna Tabeli; w pokoleniu od najstarszych |
| **Alfabetycznie** | nazwisko, potem imię, według języka aplikacji |
| **Według dodania** | od ostatnio dodanych; osoby bez danej „dodano” na końcu |
| **Ręcznie** | kolejność, którą trzyma lista stała |

- **Ręcznie** ma tylko lista stała. Przy automatycznej opcja jest niedostępna: „Ręczną kolejność ma tylko lista stała
  – Zamroź”.
- Przełączenie na inne sortowanie ręcznej kolejności nie usuwa; po powrocie do **Ręcznie** obowiązuje tak, jak była.
  Nowo dodana osoba trafia na koniec ręcznej kolejności.
- Każde przesunięcie to jeden krok **Cofnij**; czytnik ekranu je ogłasza („Przeniesiono: … jest na pozycji 3 z 12.”).
- **Obsługa:** **Sortowanie: … ▾** nad osobami listy. Ręczna kolejność: przeciąganie wiersza za uchwyt (mysz i palec),
  Esc przeciąganie anuluje; Alt+↑ / Alt+↓ na wierszu; **⋯** osoby → **Przesuń wyżej** / **Przesuń niżej**. Na
  telefonie uchwytu nie ma, tylko **⋯**.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/person-lists.ts sortListIds (old birthKey, gen ruleGenerations / assignGenerations, name Intl.Collator, added sestupně bez data na konec, manual), withSort (automatický bez manual), withPersonMoved, withManualOrder, withPersonsAdded (na konec) · src/ui/person-lists-ui.ts úchyt, Alt+↑/↓, Esc · strings.ts lists.sortBy, sort.*, manualOff, handle, up, down, moved · app:3dc8e709 · ZADANI_DEV §5 -->

<a id="A11.5"></a>
## A11.5 Dodaj do listy i usuń

Osobę można dodać do listy stałej z menu osoby, z Tabeli, z wyników wyszukiwania i ze szczegółów listy. Listy
automatycznej nie zmienia się ręcznie, dlatego menu jej nie oferują („Listy automatyczne wypełniają się same według
reguły.”).

- **Menu osoby → Dodaj do listy ›:** listy stałe według ostatniej zmiany, najwyżej 8, potem **Więcej list…**; lista,
  na której osoba jest, ma ✓, a kliknięcie ją z niej usuwa. Pod nimi **Nowa lista z tą osobą…**: okno nowej listy
  ([A11.2](#A11.2)), opcja **Pusta** z tą osobą; dla **Przodkowie osoby** i **Potomkowie osoby** jest wstępnie wybrana
  ta osoba. Na telefonie druga strona panelu osoby.
- **Tabela:** menu wiersza → **Dodaj do listy ›** (osoba wiersza; przy związku oboje partnerzy, przy wydarzeniu jego
  osoby). Wybór przez kilka wierszy: **Dodaj N osób do listy ›** i **Nowa lista z tymi osobami…**. W zakresie listy
  stałej w menu wiersza jest też **Usuń z listy** ([A6.7.19](A6-views.md#A6.7.19)).
- **Wyniki wyszukiwania → Wyniki do listy ›:** dodaje wszystkie wyniki, nie tylko pokazane, albo zakłada **Nowa lista
  z wyników (N)…** (stała, nazwa „Wyszukiwanie: {zapytanie}”).
- **Szczegóły listy → Dodaj osobę…:** wybór osób według imienia, kilka naraz; osoby już na liście są szare („już na
  liście”).
- Osoba już na liście się nie dubluje („Wszystkie są już na liście „{lista}”.”). Usunięta osoba przestaje być
  odhaczona.
- Usunięcie ma **Cofnij** w powiadomieniu.
- **Granice:** w drzewie tylko do odczytu tych menu nie ma ([A11.1](#A11.1)).
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/ui/person-list-add.ts MENU_LISTS 8, addTargets (pevné podle updated), personListMenuRows (✓, Další seznamy…, Nový seznam s touto osobou…, poznámka), listMenuEntries (víc osob, bez zdvojení), showAddPersonsToList (PICK_ROWS 200, inList) · src/ui/context-menu.ts getPersonMenuActions (za Hledat v archivech) · src/ui/person-list-new-ui.ts:215 (personIds → volba Prázdný s osobami; jedna osoba = osoba pravidla předků a potomků) · src/ui/table-view/table-ui.ts showTableRowMenu (toListN, tableAreaRowKeys, svazek oba partneři) · src/ui/search.ts (Výsledky do seznamu, všechny výsledky) · src/person-lists.ts withPersonsRemoved (done ven) · strings.ts contextMenu.toList, newListWith, newListWithMany, autoListsNote, moreLists, table.act.toListN, search.toList, newFromResults, lists.save.searchName, inList, addN, toast.added, removed, addedN, allIn · app:68363dbe · ZADANI_DEV §4 -->

<a id="A11.6"></a>
## A11.6 Zapisanie widoku jako listy

Niektóre widoki można zapisać jako listę: tylko tam, gdzie wybór osób ma sens.

| Skąd | Opcja | Domyślnie |
|---|---|---|
| Tabela › Osoby | **⋯** Tabeli lub menu **Widok** → **Zapisz jako listę osób…** | stała: osoby w kolejności wierszy Tabeli |
| Tabela › Związki | **⋯** Tabeli → **Zapisz jako listę osób…** | stała: oboje partnerzy każdego związku, każda osoba raz |
| wyniki wyszukiwania | **Wyniki do listy ›** ([A11.5](#A11.5)) | tylko stała |
| wybór okna | **Wybór ▾**, stopka **Zapisz wybór jako listę…** (ród, przodkowie, potomkowie, linia badania; [A6.6.1](A6-views.md#A6.6.1)); do aplikacji 3.30.0 tylko ród: **Zapisz ród {ród} jako listę…** | automatyczna |
| linia badania | **⋯** linii → **Zapisz jako listę…** | automatyczna |

- Z Tabeli zapisują się osoby po filtrze i sortowaniu; tymczasowo pokazane wiersze nie. Przypięty wiersz poza filtrem
  się nie zapisuje („Przypięty wiersz poza filtrem (…) nie zostanie zapisany.”).
- **Aktualizuj według filtra** tworzy listę automatyczną z kopią dzisiejszego filtra i sortowania Tabeli. Późniejsza
  zmiana widoku Tabeli jej nie zmienia. **Edytuj regułę…** takiej listy otwiera Tabelę z jej filtrem i w **⋯** Tabeli
  oferuje **Zapisz do listy {nazwa}**.
- **Granice:** Wydarzenia, Źródła i widoki Rodzina, Potomkowie, Wachlarz, Oś czasu i Mapa nie zapisują się jako lista.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/ui/person-list-new-ui.ts (SAVE_ID person-list-save; zdroje table/unions/search/rod/line, pinOut, keepFilter) · src/ui/table-view/table-ui.ts saveTableAsList, saveTableRule (lists.saveRule), canSaveAsList · src/ui/rod-view.ts (rodView.saveList) · src/ui/research-directions-ui.ts:1127 directionSaveListItem · src/person-lists.ts rulePersonIds tableFilter (unions: p1, p2) · strings.ts lists.saveAs, save.*, saveRule, rodView.saveList, research.dirSaveList · app:e09dcacb, 68363dbe, 211323e8 · ZADANI_DEV §6 · spec 084 K1.4, K6.3 a · 3.31.0: src/ui/selection-picker-ui.ts saveListOptions (rod, line, selection = předci/potomci), person-list-new-ui.ts dynamic pro rod/line/selection, strings.ts selection.saveList (app:61873988, ZADANI_DEV_vyber-osob §2) -->

<a id="A11.7"></a>
## A11.7 Kiedy osoba doszła: Dodane w ostatnich 30 dniach

Od aplikacji 3.30.0 drzewo przy każdej osobie pamięta, kiedy do niego doszła. Tej danej nie edytuje się ręcznie
i karta osoby jej nie pokazuje; używa jej reguła **Dodane w okresie**, sortowanie **Według dodania**, kolumna
**Dodano** w Tabeli ([A6.7.2](A6-views.md#A6.7.2)) i grupowanie w Tabeli ([A6.7.20](A6-views.md#A6.7.20)).

- **Kiedy się zapisuje:**
  - nowa osoba w aplikacji: czas utworzenia (osoba zastępcza dopiero wtedy, gdy staje się z niej rzeczywista osoba);
  - wczytanie pliku GEDCOM: dzień wczytania;
  - scalenie drzew: czas scalenia przy osobach, które do drzewa doszły; scalona osoba zachowuje wcześniejszą daną;
  - nowa osoba z badania: data, którą podaje przy niej badanie, w przeciwnym razie czas wczytania.
- Osoby sprzed 3.30.0 tej danej nie mają (w szczegółach listy, w kolumnie **Dodano** i w grupach Tabeli „wcześniej”);
  nic się nie dolicza.
- **Dodane w ostatnich 30 dniach** to gotowa lista automatyczna każdego drzewa, także nowego i wczytanego. Okres można
  zmienić (**Edytuj regułę…**); nazwa zmienia się wtedy z okresem, dopóki nie zostanie zmieniona ręcznie. Usunięta już
  nie wraca. Pusta mówi „Na razie nic – data dodania jest zapisywana od wersji 3.30.”
- **Granice:** GEDCOM tej danej nie niesie. Eksport z ochroną osób żyjących pomija ją przy żyjących
  ([A7.2](A7-book-pages-and-export.md#A7.2)).
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/data.ts:2636 createPerson (addedAt, ne zástupná), :2847 zástupná osoba při první úpravě, :5435 mergePersons earlierAddedAt · src/ged-parser.ts:6594 stampAddedAt(origin.at) · src/merge/executor.ts:573 (mergedAt), :1962 · src/person-lists-data.ts builtinAdded30, personListsOf (i nový strom a import, personListsDropped), keepPersonListData, stampResearchTree (research.added nebo now) · src/person-lists.ts listDisplayName (jméno podle období do přejmenování) · src/ui/person-lists-ui.ts:41 ADDED_SINCE '3.30', :534 lists.earlier · src/ui/table-view/table-group.ts:238 · src/privacy.ts:373 (stripDetails žijících: delete addedAt) · strings.ts lists.builtin.added30, addedNone, earlier · ZADANI_DEV §8, Q3 · app:714a8ab2 · sloupec Přidáno app:0971647c (table.earlier) -->

<a id="A11.8"></a>
## A11.8 Lista robocza: Odhaczaj gotowe

Listę stałą można używać jako roboczej: przy każdej osobie jest pole wyboru, a gotowe osoby się odhacza.

- Gotowa osoba jest w szczegółach przekreślona. Nad osobami jest **Wszystkie** / **Zostało N** / **Gotowe N**,
  w przeglądzie „zostało a z b”, a w podsumowaniu kafelek **zostało**.
- Odhaczenie należy do listy, nie do osoby: duplikat listy je przejmuje, inna lista nie. Usunięta osoba przestaje być
  odhaczona.
- Wyłączenie **Odhaczaj gotowe** odhaczeń nie usuwa; po ponownym włączeniu wracają.
- Odhaczenie to krok **Cofnij**, bez powiadomienia.
- W Tabeli w zakresie listy roboczej jest kolumna **Gotowe** i chipy **Zostało** i **Gotowe**
  ([A6.7.19](A6-views.md#A6.7.19)).
- **Granice:** listy automatycznej nie można odhaczać. W drzewie tylko do odczytu gotowe osoby są widoczne bez pól
  wyboru.
- **Obsługa:** **⋯** listy stałej → **Odhaczaj gotowe** (✓); pole wyboru kliknięciem lub spacją.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/person-lists.ts withChecklist (vypnutí drží done), withDoneToggled, withPersonsRemoved (done ven), listSummary left · src/data.ts duplicatePersonList (done převezme) · src/ui/person-lists-ui.ts zaškrtávátka, segment · strings.ts lists.menu.work, filter.*, left, sum.left, table.col.done, table.chip.left, chip.done · app:3dc8e709, 211323e8 · ZADANI_DEV §13 · spec 084 K8.4 -->

<a id="A11.9"></a>
## A11.9 Eksport listy

Listę można wyeksportować dwiema drogami: jako część drzewa (GEDCOM, kopia zapasowa JSON) albo jako tabelę (CSV).

- **Okno Eksport → Co eksportować → Lista osób:** opcja **Lista** oferuje listy otwartego drzewa, które mają osoby.
  **Eksport GEDCOM** niesie wtedy osoby listy i rodziny między nimi, **kopia zapasowa JSON** dane drzewa zawężone do
  osób listy. Ochrona osób żyjących i zawartość pliku obowiązują jak przy całym drzewie
  ([A7.2](A7-book-pages-and-export.md#A7.2), [A7.3](A7-book-pages-and-export.md#A7.3)). Pozostałe formaty są
  niedostępne: „Ten format eksportuje całe drzewo”. Wybór się zapamiętuje; lista, która zniknęła, przywraca wybór do
  **Całe drzewo**.
- **⋯ listy → Eksportuj ›:**
  - **GEDCOM…** otwiera okno Eksport na tej liście;
  - **CSV (kolejność listy)** od razu pobiera tabelę osób listy w jej kolejności: kolumny, jakie ma Tabela › Osoby,
    przed nimi **#** (i **Gotowe** przy liście roboczej). Plik `{drzewo}_{lista}_{RRRR-MM-DD}.csv`.
- **Listy w eksporcie:** kopia zapasowa JSON całego drzewa niesie listy w całości. Eksport części drzewa (lista,
  **Tylko bieżący widok**) zostawia w listach stałych tylko osoby tej części; listę, na której nikt nie został, pomija.
  Listy automatyczne zostają całe, ich reguła liczy z tym, co część ma.
- Nazwy list zostają w eksporcie także z ochroną osób żyjących.
- **Granice:** GEDCOM list nie niesie, nawet przy całym drzewie. Wyeksportowana strona HTML listy tylko pokazuje
  i otwiera w Tabeli.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/ui/import-export.ts exportableLists (jen s osobami, podle jména), scope 'list' (neplatný seznam → tree), exportScopeList, exportPersonListJSON (exportFocusedJSON), GEDCOM podstrom (:389), option.disabled scopeWholeOnly · src/subtree.ts:153 subsetForSubtree · src/person-lists-data.ts subsetForSubtree (pevný zúžit, prázdný ven, automatický celý) · src/ui/table-view/table-ui.ts:3215 exportPersonListCsv (leadColumnsOf: # a Hotovo, shownColumns persons, tableCsvFileName) · src/ui/person-list-hooks.ts exportRows (jen seznam s osobami) · strings.ts exportMenu.scopeLabel, scopeList, listPick, backupListDesc, gedcomListDesc, scopeWholeOnly, scopeView, lists.menu.export, export.ged, export.csv · app:33fa6cd4 · dirigent:MILAN.md 35 (4) jména seznamů v exportu zůstávají -->

<a id="A11.10"></a>
## A11.10 Listy w danych drzewa

Listy są częścią drzewa (wersja danych 22): idą z drzewem do kopii zapasowej i przy przenoszeniu, a każda ich zmiana
ma krok **Cofnij**.

- **Usunięta osoba** znika ze wszystkich list, kolejność pozostałych zostaje. Powiadomienie o usunięciu to mówi
  („Osoba … usunięta, także z 2 list.”); **Cofnij** przywraca ją także do list.
- **Scalone osoby:** miejsce usuniętej osoby przejmuje zachowana; gdy na liście są obie, zostaje raz na wcześniejszej
  pozycji. Jest gotowa, gdy gotowa była którakolwiek; ręcznie usunięta tylko wtedy, gdy usunięte były obie.
- **Drzewo z badania** zachowuje listy i dane „dodano” przy wczytaniu nowej wersji z badania.
- **Granice:** starsza aplikacja (od 3.19.0) otwiera drzewo z listami tylko do odczytu i go nie zapisuje, aby list nie
  odrzuciła ([A6.7.7](A6-views.md#A6.7.7)).
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:src/types.ts STROM_DATA_VERSION 22 (seznamy, addedAt; app:714a8ab2) · src/data.ts:436 sanitizePersonLists při načtení · src/person-lists-data.ts onPersonDeleted, onPersonsMerged, keepPersonListData · src/research-link.ts:1903 keepPersonListData · strings.ts lists.toast.personDeleted · src/tree-manager.ts isTreeNewer, src/data.ts isNewerData · app:714a8ab2 · ZADANI_DEV „Data a rozhraní“, §16a, §16b -->
