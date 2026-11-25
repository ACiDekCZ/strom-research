<a id="A13"></a>
# A13 Statystyki drzewa

Okno **Statystyki** liczy, jak często w drzewie powtarzają się imiona, miejsca, zawody, wiek i urodzenia. Każdy temat
to pełna tabela wartości z liczbą i udziałem, dla wybranego zakresu osób i okresu urodzenia. Kliknięcie wartości
pokazuje jej osoby w Tabeli, tabelę można zapisać jako CSV. Rozdział opisuje aplikację Strom 3.32.0; zmiany z nowszej
wersji mają przy sobie jej numer.

<!-- zdroj: dirigent:spec/138-podrobne-statistiky-stromu · app:d77da992 src/tree-stats.ts · f9722722 src/ui/tree-stats-ui.ts · 6f5412e3 · 417490db · 2723a543, e5723bf2, e1eae544 · 6c3b7e61 · strings.ts treeStats.* · dirigent:prace/1123-app-138-statistiky -->

<a id="A13.1"></a>
## A13.1 Okno Statystyki

Okno **Statystyki: <drzewo>** ma po lewej tematy w grupach, a po prawej tabelę wybranego tematu. Nad tabelą jest
**Zakres** ([A13.3](#A13.3)) i opcje tematu, pod nią sumy i uwagi o tym, jak się liczy.

- **Gdzie się otwiera:**
  - **Akcje › Drzewo › Statystyki** (zaraz pod **Przegląd drzewa**);
  - w Zarządzaniu drzewami w menu ⋯ przy drzewie, w grupie z **Przegląd drzewa**, **Jakość danych**, **Kopie
    zapasowe**, **Historia scaleń** i **Historia zmian** ([A14.1](A14-trees-and-structure.md#A14.1));
  - na telefonie **Więcej › Widok › Statystyki**; okno zaczyna się na przycisku **Temat**, temat i zakres wybiera się
    w arkuszu od dołu;
  - odnośnik **Szczegóły** w **Przeglądzie drzewa**: przy szczegółach rodu (**Imiona** z zakresem tego rodu), przy
    **Wiek w chwili zgonu** (**Wiek w chwili zgonu**), przy **Dzieci na parę według pokoleń** (**Liczba dzieci na
    parę**), przy **Urodzenia według miesięcy** (**Urodzenia w czasie** miesiącami) i przy **Najczęstsze imiona
    męskie** / **Najczęstsze imiona żeńskie** (**Imiona** mężczyzn, kobiet).
- Najpierw liczy się wybrany temat, potem liczby pozostałych tematów na liście po lewej; temat, który jeszcze się
  liczy, pokazuje „Obliczanie…”. Zmiana danych otwartego drzewa przelicza tabele od nowa.
- Tabela ma kolumny wartości, **Liczba** i **Udział**. Sortowanie **Według liczby**, **Alfabetycznie**; przy wieku,
  okresie i liczbie dzieci **Według wieku**, **Według okresu**, **Według liczby dzieci** (wartości w grupach są
  domyślnie sortowane według wartości). Pole wyszukiwania („Szukaj imienia…”, „Szukaj nazwiska…”, „Szukaj miejsca…”)
  zawęża wiersze bez względu na wielkość liter i znaki diakrytyczne; wiersz **Nie podano** jest podczas wyszukiwania
  ukryty.
- Pod tabelą sumy: „Razem 312 osób · 48 wartości”; przy wieku „… ze znanym wiekiem”, przy parach „Razem 120 par …”,
  przy ślubach „Razem 95 ślubów …”.
- **Granice:** zapisana strona (eksport HTML) nie ma Statystyk ani odnośników **Szczegóły**. Drzewo, które nie jest
  otwarte (okno z Zarządzania drzewami przy innym drzewie), oblicza statystyki, ale nie pokazuje osób w Tabeli
  („Drzewo nie jest otwarte – osób nie można pokazać w Tabeli.”).
- **Obsługa:** zob. **Gdzie się otwiera**; **Zamknij** lub Esc.
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:f9722722 src/ui/tree-stats-ui.ts (skupiny témat, tabulka, řazení, hledání, součty, poznámky) · 417490db (Akce › Strom pod Přehledem, list stromu, Správa stromů, čtvrtá dlaždice Zobrazení v listu Další na telefonu, nic v exportované stránce; telefon začíná na tlačítku Téma) · src/ui/tree-overview.ts treeOverviewStatsLink (rod-show firstNames rodId, deathAge, childrenPerCouple, births months, firstNames sex male/female; '' v režimu prohlížení) · src/tree-stats.ts defaultSort, isValueTopic · src/ui/tree-actions.ts treeActionGroups (overview) · strings.ts treeStats.menu, title, groups, topics, sort, search, none, total, readOnly, overview.more, phone.*; treeOverview.deathAgeTitle, childrenByGen, birthsByMonth, topMaleNames, topFemaleNames -->

<a id="A13.2"></a>
## A13.2 Tematy i jak się je liczy

Każdy temat wymienia wszystkie wartości, które ktoś w zakresie ma, nie tylko najczęstsze. Jednostka bez wartości jest
w wierszu **Nie podano**. Udział liczy się z jednostek z podaną wartością.

| Grupa | Temat | Liczy | Opcje |
|---|---|---|---|
| Imiona | **Imiona** | osoby | **Płeć** (**Mężczyźni**, **Kobiety**, **Nie podano**; domyślnie mężczyźni), **Licz** (**Pierwsze imię** / **Każde imię**) |
| | **Nazwiska** | osoby | **Nazwisko** (**Rodowe** / **U kobiet także po ślubie**) |
| Miejsca | **Miejsca urodzenia**, **Miejsca zgonu** | osoby | **Poziom** (**Miejscowość**, **Powiat**, **Kraj**) |
| | **Miejsca ślubu** | śluby | **Poziom** |
| Życie | **Zawody**, **Wyznania** | osoby | – |
| | **Wiek w chwili zgonu**, **Wiek przy pierwszym ślubie**, **Wiek przy pierwszym dziecku** | osoby, w grupach pięcioletnich | – |
| | **Liczba dzieci na parę** | pary | – |
| Czas | **Urodzenia w czasie** | osoby | **Grupuj** (**Dziesięcioleciami** / **Miesiącami**) |

- **Pilnuje kod:**
  - liczą się tylko rzeczywiste osoby, nigdy osoby zastępcze, także nie jako partnerzy ani dzieci pary;
  - jednostka liczy się przy jednej wartości raz. Osoba z kilkoma zawodami liczy się przy każdym z nich;
  - **Każde imię**: osoba z kilkoma imionami („Jan Karel”) liczy się przy każdym, a udziały sumują się do ponad
    100 %; imię z łącznikiem to jedno imię;
  - **Nazwiska**: męska i żeńska forma jednego nazwiska liczą się razem, według reguł zapisów nazwisk drzewa
    ([A4.5](A4-surnames-and-families.md#A4.5)). **U kobiet także po ślubie** liczy zamężną kobietę przy nazwisku
    rodowym i przy nazwisku po ślubie; suma jest wtedy większa niż liczba osób;
  - miejsca: to samo miejsce zapisane różnie liczy się raz (ujednolicone miejsca), wartość ma liczbę zapisów i dymek
    „Zapisane jako: …”. Drzewo bez hierarchii miejsc liczy miejscowości („Bez hierarchii miejsc liczone są
    miejscowości: ulice i numery domów należą do miejscowości.”) i nie ma opcji **Poziom**. Z miejscami ustalonymi
    przez badanie ([R4.2](R4-places.md#R4.2)) można liczyć powiaty i kraje; miejsce bez nich jest „bez ustalonego
    powiatu”, „bez ustalonego kraju”;
  - wiek jest w pełnych latach z daty urodzenia i daty zdarzenia, w grupach pięcioletnich, na górze „100 i więcej”.
    **Nie podano** to osoby żyjące i osoby bez obu dat;
  - **Liczba dzieci na parę**: para z co najmniej jednym partnerem w zakresie, dzieci bez osób zastępczych, na górze
    „10 i więcej”. **Miejsca ślubu** podobnie: ślub z co najmniej jednym partnerem w zakresie;
  - rok urodzenia bierze się także z szacunku („około 1820” liczy się jako 1820).
- **Granice:** temat, którego nikt nie ma, mówi dlaczego („W drzewie nikt nie ma zapisanego zawodu.”).
- **Obsługa:** okno **Statystyki** → temat po lewej (na telefonie **Temat**); opcje nad tabelą.
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:d77da992 src/tree-stats.ts (sdílená pravidla: zástupné nikdy, jednotky osoby/páry/sňatky, pár a sňatek v rozsahu s aspoň jedním partnerem, všechny hodnoty bez top N, Neuvedeno, podíl count/known), DEFAULT_STATS_OPTIONS (sex male, names first, surnames birth, level town, births decade), jména: slova, spojovník jedno slovo, příjmení: mužský a ženský tvar pod mužským klíčem, místo: klíč skupiny míst, jinak obec (ulice a čísla domů k obci), nejčastější zápis · src/ui/tree-stats-ui.ts volby jen u firstNames, surnames, místa s hasLevels, births · strings.ts treeStats.topics, desc, opt, ageGroup, ageTop, childrenTop, note.real, share, ages, ageNone, births, occupations, couples, surnames, withMarried, each, places, placesTown, placesLevel, noDistrict, noCountry, formsTip, empty.* -->

<a id="A13.3"></a>
## A13.3 Zakres i okres urodzenia

Statystyki liczą osoby z wybranego **Zakresu**, ewentualnie tylko urodzone w podanym okresie.

- **Zakres:** **Całe drzewo**, **Ród…**, **Linia bezpośrednia osoby…** (przodkowie, potomkowie i sama osoba, jak
  w [A4.8.2](A4-surnames-and-families.md#A4.8.2)), **Lista osób…** ([A11](A11-lists-of-people.md)). Wybór ma pole
  „Szukaj rodu, osoby, listy…”.
- **Okres urodzenia:** **Urodzeni od** i **do** (rok). Osoby bez roku urodzenia przy wybranym okresie wypadają;
  okno mówi, ile ich jest („12 osób bez roku urodzenia jest poza okresem.”). Rok musi być liczbą, a „od” najwyżej
  „do”, inaczej „Rok jako liczba, „od” nie później niż „do”.”. **Usuń okres** go usuwa.
- **Granice:** zakres i okres obowiązują do zamknięcia okna, tak samo jak temat, opcje, sortowanie i wyszukiwanie;
  nic nie zapisuje się w drzewie ani w ustawieniach. Następne otwarcie zaczyna od całego drzewa. Z odnośnika
  **Szczegóły** przy rodzie okno zaczyna od tego rodu. Zakres, który w międzyczasie zniknął (usunięta lista), jest
  pusty.
- **Obsługa:** okno **Statystyki** → **Zakres** (na telefonie arkusz **Zakres**).
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:d77da992 src/tree-stats.ts StatsScope (výběr okna nebo přímá linie), scopePeople (skutečné osoby, s obdobím počet bez roku narození, zmizelý výběr prázdný) · 6c3b7e61 přímá linie přes directLineIds rozsahu hledání · f9722722 src/ui/tree-stats-ui.ts (rozsah a období jen v okně) · strings.ts treeStats.scope.label, tree, treeSub, rodMore, directMore, directSub, listMore, search, from, to, periodSec, periodHint, outOfPeriod, invalid, clearPeriod -->

<a id="A13.4"></a>
## A13.4 Od wartości do Tabeli

Kliknięcie wiersza tabeli („Pokaż 14 osób w Tabeli”) otwiera Tabelę ([A6.7](A6-views.md#A6.7)) z osobami tej wartości.

- Tabela pokazuje całe drzewo zawężone jednym chipem na początku rzędu chipów: „Statystyki: imię Jan · ród Horák”. Na
  telefonie chip jest we własnym wierszu pod paskiem i wlicza się do **Filtry**.
- Przy parze i ślubie pokazani są oboje partnerzy.
- **Wróć do Statystyk** przywraca okno takie, jakie było (temat, opcje, zakres, okres).
- × przy chipie lub **Wyczyść filtry** usuwa chip. Chip nigdy nie zapisuje się w widoku, w bieżącej pracy ani
  w regule listy.
- **Zapisz jako listę osób** zapisuje dokładnie pokazane osoby jako stałą listę nazwaną według chipu
  ([A11.6](A11-lists-of-people.md#A11.6)).
- **Granice:** tylko przy otwartym drzewie ([A13.1](#A13.1)).
- **Obsługa:** wiersz tabeli (kliknięcie, Enter).
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:6f5412e3 (klik na hodnotu → Tabulka celého stromu se štítkem „Statistiky: … · rozsah“ první v řadě, na telefonu vlastní řádek pod lištou a počítá se do Filtrů, × nebo Zrušit filtry, Zpět do Statistik vrátí okno, štítek se neukládá do pohledu, práce ani pravidla, Uložit jako seznam osob = pevný seznam pojmenovaný podle štítku) · src/tree-stats.ts (pár a sňatek: klik ukáže oba partnery) · strings.ts treeStats.rowTitle, table.chip, table.back, chipWhat.*, readOnly -->

<a id="A13.5"></a>
## A13.5 Eksport CSV

**Eksport CSV** w stopce okna zapisuje tabelę tematu tak, jak ją okno pokazuje: z opcjami, zakresem, okresem
i wyszukiwaniem.

- Plik ma pierwszy wiersz z opisem („Statystyki: Imiona – mężczyźni, pierwsze imię · Zakres: ród Horák · Drzewo:
  Horákovi · 24. 11. 2026”, przy wyszukiwaniu także „wyszukiwanie „Jan””), potem kolumny **Wartość**, **Liczba**,
  **Udział %**, wiersz **Nie podano** (nie przy wyszukiwaniu) i **Razem**. Separatorem jest średnik, kodowanie UTF-8.
- Po zapisaniu komunikat „Zapisano: <plik>”. Nic nie jest wysyłane na zewnątrz; plik zostaje na urządzeniu.
- **Granice:** pusta tabela nie ma czego zapisać („Nie ma czego zapisać”); dopóki tabela się oblicza, przycisk czeka
  („Zapisze tabelę po obliczeniu”).
- **Obsługa:** okno **Statystyki** → **Eksport CSV** (na telefonie ikona w nagłówku).
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:f9722722 src/ui/tree-stats-ui.ts exportTreeStatsCsv, src/tree-stats.ts statsCsv (BOM, středník, Neuvedeno jen bez hledání, Celkem) · src/ui/tree-stats-ui.ts export (popisný řádek desc, hlavička head, none, total, toast) · strings.ts treeStats.export.btn, what, waiting, nothing, head, none, total, desc, search, toast, phone.exportAria -->
