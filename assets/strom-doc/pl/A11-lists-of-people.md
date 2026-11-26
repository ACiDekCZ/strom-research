<a id="A11"></a>
# A11 Listy osób

Lista osób trzyma wybrane osoby drzewa pod jedną nazwą, aby można było z nimi pracować wielokrotnie: w Tabeli jako
jej zakres ([A6.7.19](A6-views.md#A6.7.19)), w eksporcie i jako lista robocza z odhaczaniem. Lista powstaje według
reguły (ród, przodkowie, potomkowie, linia badania, filtr Tabeli, kiedy osoby doszły, własna reguła z warunków),
z wyników wyszukiwania lub ręcznie. Rozdział opisuje aplikację Strom 3.32.0.

<!-- zdroj: dirigent:spec/084-seznamy-osob (K1.1–K8.4, rozhodnutí 14. a 16. 11.) · app:714a8ab2..60265541 (dirigent:prace/1116-app-084-seznamy) · app:docs/ZADANI_DEV_seznamy-osob.md §1–§13, §15, §16 · app:src/person-lists.ts, src/person-lists-data.ts · app:CHANGELOG.cs.md 3.30.0 „Pojmenované seznamy osob“ · 3.32.0 vlastní pravidla: dirigent:spec/136-pravidla-seznamu (fáze 1, K1.1–K1.10) · app:a07c78b2..efc14cff (merge 78807628) · app:CHANGELOG.cs.md 3.32.0 „Vlastní pravidla seznamů“ -->

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
- Od aplikacji 3.32.0 lista stała i automatyczna może stać na własnej regule z warunków ([A11.2.4](#A11.2.4)),
  a listę stałą z regułą można znów zrobić automatyczną (**Utrzymuj według reguły**, [A11.2.2](#A11.2.2)).
- **Obsługa:** **Akcje → Listy osób…** ([A11.3](#A11.3)).
- **Obowiązuje od:** aplikacja 3.30.0; 3.32.0: własna reguła, **Utrzymuj według reguły**

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
| **Własna reguła** (od aplikacji 3.32.0) | osoby, które spełniają warunki złożone w grupy ([A11.2.4](#A11.2.4)) | wpisuje się; z szablonu jego nazwa ([A11.2.10](#A11.2.10)); z jedynym warunkiem **Rodzina osoby** „Rodzina – {osoba}” | **Od najstarszych** |

- **Partnerzy:** ród, przodkowie i potomkowie biorą tylko osoby związane krwią. Partnera, który wszedł do rodziny
  przez małżeństwo, na liście nie ma, dopóki nie zostanie dodany ręcznie.
- Pokolenia można wybrać od 1 do 10 albo **wszystkie pokolenia**. Liczba dni to 1 do 3650. Lista liczy od pierwszego
  dnia okresu („w ostatnich 30 dniach” = dziś i 29 dni wcześniej).
- Nazwa zmienia się z wyborem reguły, dopóki pole **Nazwa** nie zostanie nadpisane.
- Każda opcja pokazuje liczbę osób, które lista by dostała. Linia badania jest tylko w drzewie z liniami.
- **Aktualizuj automatycznie** (domyślnie wyłączone) tworzy listę automatyczną; w przeciwnym razie powstaje stała:
  „Lista stała: osoby wybiera się teraz, potem zmieniają się tylko ręcznie. Reguła zostaje dla „Uzupełnij według
  reguły”.”
- Od aplikacji 3.32.0 ostatnią opcją jest **Własna reguła** („złożyć z warunków”): zamiast opcji pokazuje się
  składanie reguły ([A11.2.4](#A11.2.4)). **Własna reguła ▾** wraca do innej opcji; regułę z jedynym warunkiem, który
  opcja zna, przejmuje razem z ustawieniami. Reguła, którą zna któraś opcja (jeden warunek bez „oprócz”), zapisuje się
  jako reguła tej opcji. **Edytuj regułę…** listy z własną regułą otwiera od razu składanie.
- Od aplikacji 3.32.0 **Przodkowie osoby** i **Potomkowie osoby** mają odnośnik **Więcej możliwości: rodzina
  osoby…**: własna reguła z jednym warunkiem **Rodzina osoby** ([A11.2.6](#A11.2.6)).
- **Obsługa:** **Listy osób → Nowa lista…** → **Według**, **Aktualizuj automatycznie**, **Utwórz**; przy liście
  **Edytuj regułę…**. Potem otwiera się zarządzanie z nową listą i powiadomienie „Lista „{nazwa}” zapisana.” Od
  aplikacji 3.32.0 po prawej w wierszu **Według** jest też **Zacznij od szablonu ▾** ([A11.2.10](#A11.2.10)).
- **Obowiązuje od:** aplikacja 3.30.0; 3.32.0: **Własna reguła**, **Więcej możliwości: rodzina osoby…**

<!-- zdroj: app:src/person-lists.ts rulePersonIds (rods/ancestors/descendants přes selection().memberIds – jen pokrevní, Q2; line přes personLineRole jako čip linie; tableFilter filterRows + sortRows; added: startOfDay − (days − 1) dní), ruleLabel · src/ui/person-list-new-ui.ts PERIODS 7/30/90, MAX_GENERATIONS 10, MAX_DAYS 3650, jméno podle pravidla do přepsání, počet u volby · ZADANI_DEV §3 (výchozí řazení podle pravidla), Q2 · app:e09dcacb · strings.ts lists.new.*, keep, keepOn, keepOff, create, toast.saved, rule.* · 3.32.0: src/ui/person-list-new-ui.ts (volba custom jako poslední, customToRule při uložení, moreFamily, Upravit pravidlo… vlastního pravidla rovnou do sestavení, newPersonListTemplateHtml), src/data.ts createCustomPersonList (řazení old), strings.ts lists.new.customRule, customRuleSub, fromTemplate, moreFamily, nameFamily (app:3a7e8595) -->

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
z obecnymi osobami”). Reguła zostaje jako **Utworzona z**, od aplikacji 3.32.0 także własna reguła.

- Powiadomienie „Lista zamrożona – teraz jest stała.” z **Cofnij**.
- Do aplikacji 3.31.0 z listy stałej nie można zrobić automatycznej. Od aplikacji 3.32.0 umie to **Utrzymuj według
  reguły** („Liczona ponownie według reguły”) przy liście stałej z regułą: lista znów liczy się według reguły, ręcznie
  dodane i usunięte osoby, odhaczenia i ręczna kolejność są odrzucane (**Ręcznie** zmienia się na **Od
  najstarszych**).
  - Gdy jest co odrzucić, najpierw pyta: „Utrzymywać według reguły?” – „Lista będzie liczona według reguły. Ręcznie
    dodane ({a}) i usunięte ({r}) osoby oraz ręczna kolejność zostaną odrzucone.” (ręczna kolejność tylko wtedy, gdy
    lista ją ma).
  - Powiadomienie „Lista jest teraz liczona według reguły.”
  - Lista robocza nie może: „Najpierw wyłącz Odhaczanie zrobionych”.
- **Obsługa:** **⋯** listy automatycznej → **Zamroź**; od aplikacji 3.32.0 **⋯** listy stałej z regułą → **Utrzymuj
  według reguły**.
- **Obowiązuje od:** aplikacja 3.30.0; 3.32.0: własna reguła, **Utrzymuj według reguły**

<!-- zdroj: app:src/person-lists.ts withFrozen (dynamic false, personIds = listPersonIds, rule zůstává) · strings.ts lists.menu.freeze, freezeSub, toast.frozen · app:3dc8e709 · 3.32.0: src/person-lists.ts withFrozen (custom.auto false), keptByRuleLoss (added, removed, manual; null u pracovního), withKeptByRule (removed, done, checklist ven, manual → old) · src/ui/person-list-hooks.ts freezeAndChecklistRows, keepByRule (ptá se jen při ztrátě) · src/data.ts keepPersonListByRule · strings.ts lists.menu.keepByRule, keepByRuleSub, keepByRule.*, toast.keptByRule · app:5959ed63 -->

<a id="A11.2.3"></a>
### A11.2.3 Reguła, która nic już nie znajduje

Gdy zniknie to, na czym reguła stoi, lista zostaje, tylko pusta, i mówi dlaczego:

- „Reguła nic już nie znajduje: osoba {imię} została usunięta.” (przodkowie lub potomkowie usuniętej osoby; imię
  reguła pamięta z chwili powstania);
- „Reguła nic już nie znajduje: ród przestał istnieć.”;
- „Reguła nic już nie znajduje: linię usunięto.”
- Pod zdaniem są **Edytuj regułę…** i **Usuń listę**.
- Od aplikacji 3.32.0: własna reguła pokazuje zamiast tego, czego brakuje, i warunek z brakującym odwołaniem liczy
  jako pusty ([A11.2.11](#A11.2.11)).
- **Obowiązuje od:** aplikacja 3.30.0; 3.32.0: własna reguła

<!-- zdroj: app:src/person-lists.ts ruleBroken (person podle rule.personName, rod, line) · strings.ts lists.ruleGone, ruleGoneRod, ruleGoneLine, deleteList · ZADANI_DEV §7d -->

<a id="A11.2.4"></a>
### A11.2.4 Własna reguła: warunki i grupy

**Własna reguła** składa warunki ([A11.2.5](#A11.2.5)) w grupy. Grupa mówi, jak łączą się jej warunki: **Wszystkie**
(osoba musi spełnić każdy) albo **Którykolwiek** (wystarczy jeden).

- Warunki po pierwszym zaczynają się od „i” (**Wszystkie**) albo „lub” (**Którykolwiek**).
- **oprócz** przy warunku lub grupie odejmuje osoby, które go spełniają. Pozycje z „oprócz” stoją na końcu swojej
  grupy i odejmuje się każdą osobę, która spełnia którąkolwiek z nich. Pierwsza pozycja grupy nie może być „oprócz”;
  grupa tylko z „oprócz” nie znajdzie nikogo.
- Grupa jest pozycją jak warunek: ma własne **Wszystkie** / **Którykolwiek** i może mieć „oprócz”. Reguła ma
  najwyżej trzy poziomy (cała reguła jest pierwszym); na trzecim poziomie **+ Dodaj grupę** nie ma.
- **Zgrupuj z…** robi z warunku i warunku pod nim grupę **Wszystkie**. Dwa warunki z „oprócz” łączą się w jedną grupę
  „oprócz” z **Którykolwiek** (odejmuje te same osoby).
- Wiersz warunku: słowo łączące, nazwa warunku z ustawieniami, własna liczba osób ([A11.2.9](#A11.2.9)) i **⋯**:
  **oprócz** / **Uwzględnij**, **Przesuń wyżej** / **Przesuń niżej**, **Zgrupuj z…**, **Duplikuj**, **Usuń**. **⋯**
  grupy: **oprócz**, **Rozgrupuj**, **Przesuń wyżej** / **Przesuń niżej**, **Usuń grupę**.
- Usunięcie zgłasza „Warunek usunięty.” z **Cofnij**. Ctrl+Z (⌘Z) cofa ostatni krok składania reguły; zmian drzewa
  nie cofa.
- Nowy warunek dostaje ustawienia domyślne ([A11.2.5](#A11.2.5)); osobą jest osoba w centrum widoku.
- **Utwórz** (przy edycji **Zapisz**) czeka na regułę, którą da się zapisać. Stopka mówi dlaczego: „Jeszcze brak
  warunku”, „Warunek {i} jest niepełny”, „Grupa potrzebuje warunku bez „oprócz”” albo „Reguły nie da się tak
  zapisać” (pusta grupa, więcej niż trzy poziomy, pętla przez listy, [A11.2.8](#A11.2.8)).
- Zamknięcie okna z niedokończoną regułą, w której zmieniono więcej niż jeden warunek, pyta: „Odrzucić niedokończoną
  regułę?” (**Kontynuuj edycję** / **Odrzuć**).
- **Aktualizuj automatycznie** działa i tutaj: włączone tworzy listę automatyczną, wyłączone stałą z osobami, które
  reguła znajdzie teraz.
- **Dodaj warunek…** przy liście z regułą otwiera okno reguły z dotychczasową regułą i wyborem nowego warunku;
  reguła z opcji (np. **Przodkowie osoby**) staje się pierwszym warunkiem. Lista stała zachowuje swoje osoby, zmienia
  się tylko reguła **Utworzona z** (potem **Uzupełnij według reguły**, [A11.2.1](#A11.2.1)).
- **Granice:** najwyżej trzy poziomy grup; cofanie składania reguły najwyżej 50 kroków. Granice ustawień są
  w [A11.2.5](#A11.2.5), szybkość liczenia w [A11.2.9](#A11.2.9).
- **Obsługa:** **Nowa lista…** → **Według** → **Własna reguła**; **+ Dodaj warunek** otwiera katalog warunków z polem
  **Szukaj warunku**, **+ Dodaj grupę** grupę z jednym warunkiem z katalogu. **⋯** reguły: **Zapisz jako szablon…**
  ([A11.2.10](#A11.2.10)), **Wyczyść regułę**. Przesunięcie wiersza: przeciągnięcie za uchwyt (tylko mysz),
  Alt+↑ / Alt+↓ albo **⋯**. **⋯** listy lub odnośnik w szczegółach → **Dodaj warunek…** ([A11.3](#A11.3)). Na
  telefonie słowo łączące stoi przed nazwą warunku, a menu są panelami od dołu.
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:src/person-list-rules.ts (RULE_MAX_DEPTH 3; skupina all = průnik kladných, any = sjednocení, minus sjednocení kromě; ruleIssues: incomplete, depth, empty, exceptFirst, exceptOnly, cycle), src/person-list-rule-edit.ts (canExcept: ne první položka; toggleExcept na konec skupiny; canAddGroup; groupWithNext: dvě kromě → skupina any s kromě), src/ui/person-list-rule-ui.ts (UNDO_MAX 50, UNDO_MS 6000, řádek a ⋯, Ctrl+Z, ruleBuilderStartAdd, důvod v patičce), src/ui/person-list-new-ui.ts (startWith addCondition, ruleToCustom, discard u víc než jedné upravené podmínky, primární Vytvořit / Uložit), src/data.ts setPersonListCustomRule (pevný si nechá personIds) · strings.ts lists.rules.all, any, and, or, except, include, addCondition, addGroup, intoGroup, dissolve, removeGroup, remove, removed, clear, noConditions, incomplete, needPlus, cantSave, discard.*, firstOfGroup, catalog.search, lists.addCondition, lists.up, down, menu.dup · app:3a7e8595, ffc7ff32, 5959ed63, 0bd2e438 · spec 136 K1.1, K1.2, K1.5 -->

<a id="A11.2.5"></a>
### A11.2.5 Warunki własnej reguły

Katalog warunków ma grupy **Rodzina i linie**, **Życie w czasie**, **Miejsca**, **Osoba**, **Dane** i **Z drzewa
i z Tabeli**, w kolejności tabeli.

| Warunek | Kogo znajdzie | Ustawienia domyślne i granice |
|---|---|---|
| **Rodzina osoby** | osobę i jej krewnych krokami w górę, w dół, wszerz i przez małżeństwa ([A11.2.6](#A11.2.6)) | osoba w centrum; 2 w górę, 2 w dół, tylko linia prosta, tylko krewni |
| **Przodkowie osoby** | przodków osoby jak opcja **Przodkowie osoby** ([A11.2](#A11.2)) | osoba w centrum; wszystkie pokolenia albo 1–10 |
| **Potomkowie osoby** | potomków osoby jak opcja **Potomkowie osoby** | osoba w centrum; wszystkie pokolenia albo 1–10 |
| **Ród** | członków rodu związanych krwią | pierwszy ród drzewa |
| **Linia badań** | osoby linii badania | pierwsza linia |
| **Inna lista** | osoby innej listy ([A11.2.8](#A11.2.8)) | listę się wybiera |
| **Urodzenie w okresie** | rok urodzenia, bez daty urodzenia rok chrztu, w zakresie | lata 1–2999, od, do albo od–do |
| **Śmierć w okresie** | rok śmierci, bez daty śmierci rok pochówku, w zakresie | jak przy urodzeniu |
| **Ślub w okresie** | rok początku któregoś związku osoby w zakresie | jak przy urodzeniu |
| **Żył w okresie** | osoby, które na pewno żyły w którymś roku zakresu; można wybrać też wiek | XIX wiek (1801–1900) |
| **Wiek w chwili śmierci** | wiek w chwili śmierci jak kolumna Tabeli | do 5 lat; 0–130 |
| **Żyjący / zmarły** | osoby żyjące albo zmarłe jak chip Tabeli | żyjący |
| **Miejsce i okolica** | urodzenie, śmierć, ślub albo zamieszkanie w miejscu i jego okolicy ([A11.2.7](#A11.2.7)) | wszystkie cztery wydarzenia, **tylko miejsce** |
| **Płeć** | kobiety, mężczyźni albo płeć nieznana | kobiety |
| **Zawód** | osoby z którymś z wybranych zawodów | zawody się wybiera (także kilka) |
| **Ma dane** | osoby, które dane mają (**ma**) albo nie mają (**nie ma**) | nie ma: dowód lub źródło |
| **Liczba** | co najmniej albo najwyżej N dzieci, małżeństw albo źródeł | co najmniej 5 dzieci; 0–999 |
| **Tekst w opowieści lub notatce** | tekst w opowieści, w notatce albo w obu | oba; najwyżej 200 znaków |
| **Dodane w okresie** | osoby dodane do drzewa w ciągu 24 godzin, 7 dni, 30 dni albo od daty ([A11.7](#A11.7)) | 7 dni |
| **Zmienione w okresie** | osoby, których dane zmieniły się w aplikacji, w tych samych okresach | 7 dni |
| **Zapisany filtr Tabeli** | wiersze zapisanego widoku Tabeli (Osoby lub Związki) według kopii jego filtra | pierwszy zapisany widok |

- Katalog oferuje tylko warunki, dla których drzewo ma dane: **Ród** tylko w drzewie z rodami, **Linia badań** tylko
  z liniami badania, **Inna lista** tylko z więcej niż jedną listą, **Zawód** tylko z zawodem, **Zapisany filtr
  Tabeli** tylko z zapisanym widokiem Tabeli.
- **Okresy:** warunek obowiązuje tylko wtedy, gdy cały zakres daty leży w okresie („około 1820” to 1818–1822; „przed
  1850” nie ma początku). Osoba bez daty warunku nie spełnia.
- **Żył w okresie:** osoba żyła od końca zakresu urodzenia do początku zakresu śmierci; bez daty śmierci „bez daty
  śmierci przyjmuje się 90 lat od urodzenia” (najdłużej do dziś), tylko z datą śmierci rok śmierci, bez obu dat
  warunku nie spełnia.
- **Ma dane:** datę urodzenia, miejsce urodzenia, datę śmierci, miejsce śmierci; dowód lub źródło, zdjęcie, materiał;
  rodziców, partnera, dzieci; opowieść, notatkę; w drzewie z badania także sprzeczność (nierozstrzygniętą sprzeczność
  badania) i otwarte zadanie badawcze.
- **Liczba:** dzieci to własne dzieci; małżeństwa i źródła liczą się jak w kolumnach Tabeli.
- **Tekst:** „bez względu na wielkość liter i znaki diakrytyczne”.
- **Zmienione w okresie:** czas zmiany zapisuje się przy osobie, gdy w aplikacji zmienią się jej dane, wydarzenia,
  cytowania lub rodzice, i przy obojgu partnerach, gdy zmieni się ich związek; nowa osoba go nie ma (ma dane
  „dodano”). Przy warunku stoi „czas zmiany jest zapisywany od wersji 3.32 – starsze zmiany się nie liczą”.
- **Zapisany filtr Tabeli:** warunek trzyma kopię filtra („kopia filtra: {widok}”); późniejsza zmiana widoku Tabeli
  go nie zmienia.
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:src/types.ts RuleCondName (21 podmínek) · src/person-list-rules.ts (spanInside celé rozpětí, ABOUT_YEARS 2, LIFE_YEARS_WITHOUT_DEATH 90, livedSpan, born birthOrBaptism, died deathOrBurial, married startDate svazku, count children / uCount / srcCount, has: čipy a buňky Tabulky, conflict nerozhodnutý, openTask, text fold bez diakritiky, added/changed hours 24 / days / since, gender unknown) · src/ui/person-list-rule-editors.ts ruleCatalog (skupina, pořadí, available) · src/ui/person-list-rule-cond-editors.ts (výchozí: deathAge to 5, has nemá source, count děti aspoň 5, rod první rod, line první linie, tableFilter první pohled; HAS_GROUPS, výzkum jen ve stromu z výzkumu; CHANGED_FROM 3.32) · src/person-lists-data.ts stampChangedAt · strings.ts lists.rules.cond.*, catalog.head.*, has.*, livedHint, textHint, changedFrom, filterCopy, countWhat, cmp · app:ffc7ff32, 6f3847ec, 4bc39c94 · spec 136 K1.1 -->

<a id="A11.2.6"></a>
### A11.2.6 Rodzina osoby

**Rodzina osoby** bierze osobę i jej krewnych krokami w czterech kierunkach. Sama osoba jest w wyniku zawsze.

| Kierunek | Wybór |
|---|---|
| **W górę** | 0–10 pokoleń albo **wszystkie**; **przez oboje rodziców**, **przez ojca**, **przez matkę** |
| **W dół** | 0–10 pokoleń albo **wszystkie** |
| **Wszerz** | **tylko linia prosta**, **+ rodzeństwo**, **+ kuzyni** do 1.–5. stopnia albo **wszystkich stopni** |
| **Małżonkowie** | **tylko krewni**, **+ małżonkowie**, **+ rodziny małżonków** |

- **przez ojca** i **przez matkę** obowiązują w każdym kroku w górę. Przy dwojgu rodzicach tej samej płci stroną ojca
  jest pierwsze z nich.
- **+ rodzeństwo** to rodzeństwo osoby i każdego przodka w zasięgu **W górę**. **+ kuzyni** do N. stopnia to wszyscy
  potomkowie przodków do N + 1 pokoleń w górę (1. stopień to kuzyni i kuzynki pierwszego stopnia), najwyżej
  w zasięgu **W górę**.
- **+ małżonkowie** dodaje partnerów wszystkich osób wyniku, **+ rodziny małżonków** także rodziców i rodzeństwo tych
  partnerów.
- Krok prowadzi tylko przez własnych rodziców i dzieci; więź ojczyma, macochy i rodzica zastępczego się nie liczy.
  Przez osobę zastępczą krok przechodzi, w wyniku osoby zastępczej nie ma.
- **Szybki wybór** ustawia kierunki naraz; wybór jest włączony tylko wtedy, gdy kierunki dokładnie mu odpowiadają:

| Szybki wybór | W górę | W dół | Wszerz | Małżonkowie |
|---|---|---|---|---|
| **Najbliższa rodzina** | 1 | 1 | + rodzeństwo | + małżonkowie |
| **Przodkowie** | wszystkie | 0 | tylko linia prosta | tylko krewni |
| **Potomkowie** | 0 | wszystkie | tylko linia prosta | tylko krewni |
| **Krewni** | wszystkie | wszystkie | + kuzyni wszystkich stopni | tylko krewni |
| **Cała rodzina z małżeństwami** | wszystkie | wszystkie | + kuzyni wszystkich stopni | + rodziny małżonków |
| **Po mieczu** | wszystkie przez ojca | 0 | tylko linia prosta | tylko krewni |
| **Po kądzieli** | wszystkie przez matkę | 0 | tylko linia prosta | tylko krewni |

- Pod ustawieniami jest warunek słowami, np. „Rodzina: {osoba}, 2 pokolenia w górę, 2 pokolenia w dół” albo przy
  szybkim wyborze „Najbliższa rodzina: {osoba}”.
- Jedyny warunek **Rodzina osoby** tylko w górę albo tylko w dół (przez oboje rodziców, tylko linia prosta, tylko
  krewni) zapisuje się jako reguła **Przodkowie osoby** / **Potomkowie osoby**.
- **Obsługa:** warunek **Rodzina osoby** w katalogu; **Więcej możliwości: rodzina osoby…** przy **Przodkowie osoby**
  i **Potomkowie osoby** ([A11.2](#A11.2)); **Menu osoby → Dodaj do listy › → Lista z rodziny tej osoby…** (szybki
  wybór **Najbliższa rodzina**, [A11.5](#A11.5)).
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:src/lineage.ts familySet (seenUp, via v každém kroku, parentInRole, siblings osoby a předků v dosahu, cousins: potomci předků do degree + 1 v dosahu up, spouses / families: rodiče a sourozenci partnerů, zástupné ven, descentParents bez nevlastních a pěstounských), FAMILY_PRESETS, familyPresetOf · src/ui/person-list-rule-family.ts (FAMILY_GEN_MAX 10, FAMILY_COUSIN_MAX 5, pořadí rychlých voleb, nápověda slovy) · src/person-list-rules.ts customToRule (family → ancestors / descendants) · src/ui/person-list-add.ts LIST_FROM_FAMILY_ACTION (FAMILY_PRESETS.closest) · strings.ts lists.rules.family.*, preset.*, say.family, say.preset, contextMenu.listFromFamily · app:ffc7ff32, 007581af · spec 136 K1.1 -->

<a id="A11.2.7"></a>
### A11.2.7 Miejsce i okolica

**Miejsce i okolica** znajduje osoby, które mają wybrane wydarzenie w miejscu lub w jego okolicy.

- **Wydarzenia:** urodzenie (także chrzest), śmierć (także pochówek), ślub (miejsce początku związku), zamieszkanie;
  domyślnie wszystkie cztery.
- Miejsce wybiera się z miejsc drzewa (miejsc urodzenia, śmierci, ślubu i zamieszkania), najpierw te z największą
  liczbą osób.
- Do miejsca należą też jego domy (miejsce z numerem domu lub ulicą tej samej miejscowości); **łącznie z miejscami
  podrzędnymi** (tylko gdy zapis miejsca w badaniu ma miejsca pod sobą) dodaje i te.
- **Okolica:** **tylko miejsce**, **5 km**, **10 km**, **25 km**, **50 km** albo **inne…** (domyślnie 100 km,
  1–500 km). Okolica bierze każde miejsce drzewa, którego położenie na Mapie jest w wybranej odległości od położenia
  miejsca (w linii prostej).
- Nad miejscami jest podsumowanie („W promieniu {km} km: N miejsc · M miejsc drzewa bez położenia”) i **Pokaż
  miejsca ›**: pierwsze 6 miejsc, potem „… i N więcej”; miejsca bez położenia są pod „Bez położenia (nieliczone)”
  z **Uzupełnij położenia na Mapie ›**.
- Miejsce bez położenia liczy się tylko według nazwy („Miejsce nie ma położenia na mapie – tylko według nazwy.”);
  odległości nie można wtedy wybrać, a wybór takiego miejsca przywraca **tylko miejsce**. Drzewo bez położeń miejsc:
  „Drzewo nie ma położeń miejsc – okolica zadziała po uzupełnieniu położeń na Mapie.”
- **Granice:** okolica najwyżej 500 km. Miejsce bez położenia na Mapie do okolicy się nie liczy.
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:src/person-list-rules.ts NEAR_MAX_KM 500, placeIndexOf (birthPlace, baptism a birth; residence; startPlace svazku; deathPlace, burial a death), nearKeys (townKey: dům téže obce, below keysBelow, km > 0 haversineKm od geoOfKey), rulePlaceChoices (nejvíc osob první) · src/ui/person-list-rule-near.ts (KM_PRESETS 0/5/10/25/50, KM_OTHER 100, 6 míst a more, unplaced, noCoords, noneInTree) · strings.ts lists.rules.near.*, say.events · app:ffc7ff32, cbcb7673 · spec 136 K1.1 -->

<a id="A11.2.8"></a>
### A11.2.8 Inna lista

**Inna lista** bierze osoby innej listy: przy stałej jej osoby, przy automatycznej te, które jej reguła znajdzie
teraz.

- Lista, przez którą reguła prowadziłaby z powrotem do edytowanej listy (także przez kolejne listy), jest w wyborze
  niedostępna, z drogą pętli: „utworzyłoby pętlę: {A → B → A}”. Reguły z pętlą nie da się zapisać.
- Od 9 list wybór ma pole **Szukaj**.
- Usunięcie listy, której używa inna lista, najpierw pyta ([A11.3](#A11.3)); warunek pokaże się potem jako „brak”
  ([A11.2.11](#A11.2.11)).
- **Granice:** warunek jest w katalogu tylko wtedy, gdy drzewo ma więcej niż jedną listę.
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:src/person-list-rules.ts listCycle („A → B → A“), ruleIssues cycle, condSet list (listMembers, visiting), listUsedBy · src/ui/person-list-rule-cond-editors.ts list (available: víc než jeden seznam, hledání od 9) · strings.ts lists.rules.cycle, cond.list · spec 136 K1.7 -->

<a id="A11.2.9"></a>
### A11.2.9 Liczby i Pokaż w drzewie

Składanie reguły pokazuje liczby: każdy warunek i grupa własną liczbę osób w całym drzewie, stopka liczbę całej
reguły („Pasuje: N osób” albo „Nikt nie pasuje”).

- Niepełny warunek do liczby całej reguły się nie liczy.
- Gdy reguła z **Wszystkie** nie znajdzie nikogo, pozycja, po której wynik spadł do zera, ma znacznik „tu 0”.
- Liczby przeliczają się 120 ms po ostatniej zmianie. Gdy poprzednie liczenie trwało dłużej niż 200 ms, stopka
  najpierw pokazuje „Liczenie…” z poprzednią liczbą („dotąd N osób”).
- **Pokaż w drzewie** (obok liczby, tylko gdy ktoś pasuje i regułę da się zapisać): okno się ukrywa, nie zamyka;
  pokazuje się widok **Rodzina** (z innego widoku następuje przełączenie) z wyróżnionymi osobami reguły i tytułem
  „Podgląd reguły · N osób”. **Wróć do reguły**, × i Esc kończą wyróżnienie, przywracają poprzedni widok i pokazują
  okno, jakie było.
- **Obsługa:** na telefonie **⋯** reguły → **Pokaż w drzewie**.
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:src/person-list-rules.ts evalRuleCounts (vlastní počet každé položky nad celým stromem, neúplné mimo celek, zeroAt jen u celku 0 a op all) · src/ui/person-list-rule-ui.ts RULE_COUNT_DEBOUNCE_MS 120, RULE_COUNT_SLOW_MS 200, ruleBuilderCountsBusy · src/ui/person-list-new-ui.ts newPersonListFootExtraHtml, newPersonListMoreRows (telefon), showNewPersonListInTree (skryté overlaye, setViewMode family, highlightGroup rulePreview), backToNewPersonList · strings.ts lists.rules.match, nobody, zeroHere, computing, previous, showInTree, preview, backToRule · app:ffc7ff32 · spec 136 K1.3, K1.4 -->

<a id="A11.2.10"></a>
### A11.2.10 Szablony list

Szablon to gotowa własna reguła. Oferuje się go przy zakładaniu nowej listy: **Zacznij od szablonu ▾** po prawej
w wierszu **Według** (na telefonie **⋯** własnej reguły → **Zacznij od szablonu…**).

| Grupa | Szablon | Reguła |
|---|---|---|
| **Czego brakuje w badaniach** | **Przodkowie bez źródła** | przodkowie osoby i bez dowodu lub źródła |
| | **Końce linii** | przodkowie osoby i bez rodziców |
| | **Bez daty lub miejsca urodzenia** | bez daty urodzenia lub bez miejsca urodzenia |
| | **Osoby ze sprzecznością** | ma sprzeczność (tylko drzewo z badania) |
| | **W toku** | ma otwarte zadanie badawcze (tylko drzewo z badania) |
| **Rodzina i linie** | **Linia prosta po mieczu** | **Rodzina osoby**, szybki wybór **Po mieczu** |
| | **Potomkowie do N pokoleń** | potomkowie osoby, 3 pokolenia |
| | **Z miejsca i okolicy** | urodzenie, śmierć, ślub albo zamieszkanie do 10 km od miejsca |
| | **Zmarli w dzieciństwie** | wiek w chwili śmierci do 5 lat |
| **Opowieści i udostępnianie** | **Przodkowie bez zdjęcia** | przodkowie osoby i bez zdjęcia |
| | **Osoby żyjące** | żyjący |
| | **Ostatnio dodane** | dodane w ostatnich 7 dniach |

- Menu **Szablony** ma na górze własne szablony (**Własne**), potem wbudowane według grup, bez liczb. Szablon, który
  wymaga osoby lub miejsca, ma „wymaga osoby” / „wymaga miejsca”. Szablonu z warunkiem, którego drzewo nie oferuje
  ([A11.2.5](#A11.2.5)), w menu nie ma.
- Wybór szablonu otwiera własną regułę z jego warunkami i od razu wybór pierwszej brakującej osoby lub miejsca. Nazwa
  listy to nazwa szablonu, po uzupełnieniu osoby lub miejsca „{szablon} – {osoba}”, dopóki nie zostanie nadpisana.
- Nad regułą stoi „Z szablonu: {szablon}” i **Porzuć szablon**: reguła się opróżnia, a nazwa znów idzie za regułą.
- Regułę z szablonu można edytować jak każdą inną. Lista pamięta, z którego szablonu powstała ([A11.3](#A11.3));
  nazwa wbudowanego szablonu jest w języku aplikacji.
- **Zapisz jako szablon…** (**⋯** własnej reguły) otwiera okno **Zapisz jako szablon** z polem **Nazwa szablonu**
  (domyślnie nazwa listy) i uwagą „Osoby, miejsca i listy nie są zapisywane w szablonie – uzupełnia się je przy
  użyciu. Szablon zapisuje się na tym urządzeniu i działa także w innych drzewach.” Rody i linie badania też się nie
  zapisują.
  - Zajęta nazwa dostaje obramowanie: „Szablon o tej nazwie już istnieje. Proponowana: „{nazwa} (2)”.”; **Zapisz**
    bierze proponowaną.
  - **⋯** własnego szablonu w menu: **Zmień nazwę…** (okno **Zmień nazwę szablonu**), **Usuń** (powiadomienie
    „Szablon „{nazwa}” usunięty.” z **Cofnij**).
- **Granice:** szablony tylko przy zakładaniu nowej listy, nie przy edycji reguły ani przy **Zapisz jako listę
  osób…**. Własne szablony należą do urządzenia (ustawienia aplikacji w tej przeglądarce), nie do drzewa.
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:src/person-list-templates.ts LIST_TEMPLATES (12, skupiny missing / family / story, research jen ve stromu z výzkumu), templateRoot, listTemplateName (vestavěná podle jazyka, app:29c57b0e) · src/person-list-rules.ts stripTemplateParams (osoby, místa, seznamy, rody, linie), makeListTemplate, ruleNeeds · src/ui/person-list-new-ui.ts offeredTemplates (ruleOffered), openNewPersonListTemplates, applyNewPersonListTemplate (origin template, otevře první chybějící), dropNewPersonListTemplate, openNewPersonListTemplateActions, openListTemplateNameDialog (freeTemplateName), newPersonListMoreRows · src/types.ts ListTemplate (nastavení listTemplates, ne strom) · strings.ts lists.templates.*, lists.new.fromTemplate · app:58ad425d, 7f13e899 · spec 136 K1.9 -->

<a id="A11.2.11"></a>
### A11.2.11 Brakująca osoba, miejsce lub lista w regule

Gdy z drzewa zniknie osoba, miejsce, lista, ród lub linia badania, do których odwołuje się własna reguła, reguła
zostaje, a odwołanie pokazuje się jako „brak”.

- Warunek z brakującym odwołaniem liczy się jako pusty: nikogo nie znajduje, z „oprócz” nikogo nie odejmuje.
- Przy składaniu warunek ma „{nazwa} – brak”, a jego **⋯** oferuje najpierw **Wybierz inną osobę…** (**Wybierz inne
  miejsce…**, **Wybierz inną listę…**, **Wybierz inny ród…**, **Wybierz inną linię badań…**).
- Lista automatyczna mówi to w przeglądzie („automatyczna · Reguła odwołuje się do brakującej osoby”, …)
  i w szczegółach („Reguła odwołuje się do brakującej osoby: {imię} – warunek liczy się jako pusty.”) z **Edytuj
  regułę…**.
- Scalanie osób: odwołanie do usuniętej osoby przejmuje zachowana.
- Usunięcie listy, której używa inna lista, najpierw pyta ([A11.3](#A11.3)); **Cofnij** przywraca listę i odwołania.
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:src/person-list-rules.ts condMissing (person, place, list, rod, line), customMissing, chybějící odkaz = prázdná množina · src/ui/person-list-rule-ui.ts (gone, pickOther první v ⋯) · src/ui/person-lists-ui.ts listMissing (jen automatický), rowMeta is-warn, pl-note--warn s edit-rule · src/person-lists-data.ts onPersonsMerged (customWithPersonMerged) · strings.ts lists.rules.missing, gone, pickOther.*, missingRef.*, missingNote · app:c76a8954 · spec 136 K1.7 -->

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
- Od aplikacji 3.32.0 wiersz reguły mówi regułę słowami na najwyżej dwóch wierszach (na telefonie czterech), całą
  w podpowiedzi; na telefonie **Cała reguła ›** otwiera okno reguły (w drzewie tylko do odczytu rozwija cały tekst).
  Własna reguła słowami: warunki po kolei oddzielone „ · ”, każdy po pierwszym ze słowem „i” albo „lub”, warunki
  z „oprócz” na końcu („oprócz A lub B”), grupy w nawiasach; np. „Przodkowie: {osoba}, wszystkie pokolenia · i bez
  dowodu lub źródła”.
  - Pod regułą jest, skąd lista pochodzi: „Z szablonu „{szablon}” · {data}”; przy liście założonej ręcznie nic.
  - Lista z regułą ma obok **Edytuj regułę…** / **Uzupełnij według reguły** także **Dodaj warunek…**
    ([A11.2.4](#A11.2.4)).
- **⋯ listy** (przy wierszu w przeglądzie i w szczegółach): **Otwórz w tabeli**, **Na mapie** (od aplikacji 3.31.0),
  **Zmień nazwę**, **Duplikuj**,
  **Odhaczaj gotowe** (stała, [A11.8](#A11.8)) albo **Zamroź** (automatyczna, [A11.2.2](#A11.2.2)), **Eksportuj ›**
  ([A11.9](#A11.9)), **Usuń**. Od aplikacji 3.32.0 lista z regułą ma przed nimi **Dodaj warunek…**
  ([A11.2.4](#A11.2.4)), a lista stała z regułą za **Odhaczaj gotowe** także **Utrzymuj według reguły**
  ([A11.2.2](#A11.2.2)).
  - **Otwórz w tabeli** zamyka okno i otwiera Tabelę w zakresie listy ([A6.7.19](A6-views.md#A6.7.19)).
  - **Na mapie** (także przycisk obok **Otwórz w tabeli** w szczegółach) zamyka okno, ustawia listę jako wybór okna
    ([A6.6](A6-views.md#A6.6)) i otwiera Mapę z zakresem **Wybór** ([A6.5.7](A6-views.md#A6.5.7)). W kolejnym oknie
    wykonuje to okno główne; bez niego **Na mapie** jest niedostępne („Okno główne nie jest otwarte.”).
  - **Duplikuj** robi kopię tego samego rodzaju z tą samą regułą, kolejnością, ręcznie usuniętymi i odhaczonymi,
    z nazwą „{nazwa} (2)”.
  - **Usuń** nie pyta: powiadomienie „Lista „{nazwa}” usunięta.” z **Cofnij**. Od aplikacji 3.32.0 pyta, gdy listy
    używa inna lista w warunku **Inna lista**: „Usunąć listę „{nazwa}”?” z „Lista ma N osób; osoby zostają
    w drzewie.” i „Używana przez: {listy}. Warunek „Inna lista” pokaże się tam jako „brak”.” (najwyżej trzy nazwy,
    potem „i N innych”) oraz uwagą „Usunięcie można cofnąć – lista i odwołania do niej wrócą.”
- **Granice:**
  - szczegóły pokazują najwyżej 200 osób: „Pokazano pierwsze 200 z N osób.” z odnośnikiem do Tabeli, gdzie są
    wszystkie;
  - każda zmiana listy to jeden krok **Cofnij**; utworzenie (także duplikat), zmiana nazwy, zamrożenie i usunięcie
    mają wpis w historii zmian;
  - w innym oknie aplikacji ([A6.8](A6-views.md#A6.8)) zmiana listy zapisuje się przez okno główne.
- **Obsługa:** **Akcje → Listy osób…**; na telefonie **Więcej → Listy osób**; w Tabeli **Zakres ▾ → Zarządzaj
  listami…**. Klawisze w przeglądzie: ↑ ↓ wybór, Enter zmiana nazwy, Delete usunięcie, Esc zamyka okno. Na telefonie
  przegląd i lista zmieniają się na całym ekranie (‹ **Wróć do list**), **⋯** to panel od dołu.
- **Obowiązuje od:** aplikacja 3.30.0; 3.32.0: reguła słowami, pochodzenie listy, **Dodaj warunek…**, pytanie przed
  usunięciem listy, której używa inna lista

<!-- zdroj: app:src/ui/person-lists-ui.ts (OVERLAY_ID person-lists-modal, SEARCH_FROM 9, LIST_DETAIL_ROWS 200, NARROW_QUERY, přejmenování klik/✎/F2, klávesy ↑↓ Enter Delete) · src/ui/person-list-hooks.ts listMenu (freezeAndChecklistRows, exportRows) · src/data.ts duplicatePersonList (structuredClone, suggestPersonListName), deletePersonList (Vrátit), storePersonList audit (personList.save, :2224 přejmenování, :2254 personList.delete, :2330 zmrazení) · index.html #actions-lists-row · src/ui/bottom-sheet.ts řádek Seznamy osob v listu Více · strings.ts menu.lists, lists.title, search, byName, byChange, changed, left, people, remove, addPerson, openTable, menu.*, large, back, toast.deleted, undo.*, audit.* · app:4acf7a09, 3dc8e709 · ZADANI_DEV §2, §16 (okna 079: WindowEditSink) · 3.31.0 Na mapě: src/ui/person-lists-ui.ts (tlačítko pl-onmap v detailu, ⋯ řádek map za open), src/ui/person-list-hooks.ts showOnMap, src/windows/window-show-on-map.ts, strings.ts lists.onMap, onMapTitle, table.onMapNoMain (app:2a578474, 39020cf1, ZADANI_DEV_vyber-osob §6) · 3.32.0: src/ui/person-lists-ui.ts (pl-rule-t s title, pl-rule-whole: edit-rule nebo whole-rule ve stromu jen ke čtení, listOriginText, add-condition, deletePersonList s listUsedBy: 3 jména a more, showConfirm danger s note), src/person-list-rules.ts customLabel (·, a zároveň / nebo, kromě na konci), src/person-lists.ts listRuleLabel, src/ui/person-list-hooks.ts freezeAndChecklistRows · strings.ts lists.wholeRule, origin.*, addCondition, deleteTitle, deletePeople, deleteUsedBy, deleteUsedNote · app:c76a8954, 5959ed63 · spec 136 K1.4, K1.7 -->

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
  ta osoba. Na telefonie druga strona panelu osoby. Od aplikacji 3.32.0 jest pod nim także **Lista z rodziny tej
  osoby…**: okno nowej listy z własną regułą **Rodzina osoby** tej osoby w szybkim wyborze **Najbliższa rodzina**
  ([A11.2.6](#A11.2.6)).
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
- **Obowiązuje od:** aplikacja 3.30.0; 3.32.0: **Lista z rodziny tej osoby…**

<!-- zdroj: app:src/ui/person-list-add.ts MENU_LISTS 8, addTargets (pevné podle updated), personListMenuRows (✓, Další seznamy…, Nový seznam s touto osobou…, poznámka), listMenuEntries (víc osob, bez zdvojení), showAddPersonsToList (PICK_ROWS 200, inList) · src/ui/context-menu.ts getPersonMenuActions (za Hledat v archivech) · src/ui/person-list-new-ui.ts:215 (personIds → volba Prázdný s osobami; jedna osoba = osoba pravidla předků a potomků) · src/ui/table-view/table-ui.ts showTableRowMenu (toListN, tableAreaRowKeys, svazek oba partneři) · src/ui/search.ts (Výsledky do seznamu, všechny výsledky) · src/person-lists.ts withPersonsRemoved (done ven) · strings.ts contextMenu.toList, newListWith, newListWithMany, autoListsNote, moreLists, table.act.toListN, search.toList, newFromResults, lists.save.searchName, inList, addN, toast.added, removed, addedN, allIn · app:68363dbe · ZADANI_DEV §4 · 3.32.0: src/ui/person-list-add.ts LIST_FROM_FAMILY_ACTION (FAMILY_PRESETS.closest), strings.ts contextMenu.listFromFamily (app:007581af, spec 136 §12) -->

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
  pozycji. Jest gotowa, gdy gotowa była którakolwiek; ręcznie usunięta tylko wtedy, gdy usunięte były obie. Od
  aplikacji 3.32.0 zachowana osoba przejmuje też odwołania własnych reguł.
- **Drzewo z badania** zachowuje listy i dane „dodano” przy wczytaniu nowej wersji z badania, od aplikacji 3.32.0
  także własne reguły, pochodzenie list i czas zmiany osób.
- Od aplikacji 3.32.0 (wersja danych 26) lista niesie też własną regułę i swoje pochodzenie (szablon), a osoba czas
  ostatniej zmiany (dla **Zmienione w okresie**).
  - Lista z własną regułą ma zapisane także osoby, które reguła znalazła przy ostatnim zapisie; aplikacja, która nie
    zna własnych reguł, pokazuje ją więc jako listę stałą z tymi osobami.
  - Własną regułę, której aplikacja nie odczyta w całości (z nowszej wersji), zachowuje bez zmian i trzyma listę jako
    stałą z zapisanymi osobami; aplikacja, która regułę odczyta, znów jej używa.
  - Własnych szablonów w drzewie nie ma ([A11.2.10](#A11.2.10)).
- **Granice:** starsza aplikacja (od 3.19.0) otwiera drzewo z listami tylko do odczytu i go nie zapisuje, aby list nie
  odrzuciła ([A6.7.7](A6-views.md#A6.7.7)). Drzewo zapisane aplikacją 3.32.0 (wersja danych 26) starsza aplikacja
  otwiera tylko do odczytu.
- **Obowiązuje od:** aplikacja 3.30.0; 3.32.0: własna reguła, pochodzenie listy i czas zmiany osoby w danych (wersja
  danych 26)

<!-- zdroj: app:src/types.ts STROM_DATA_VERSION 22 (seznamy, addedAt; app:714a8ab2) · src/data.ts:436 sanitizePersonLists při načtení · src/person-lists-data.ts onPersonDeleted, onPersonsMerged, keepPersonListData · src/research-link.ts:1903 keepPersonListData · strings.ts lists.toast.personDeleted · src/tree-manager.ts isTreeNewer, src/data.ts isNewerData · app:714a8ab2 · ZADANI_DEV „Data a rozhraní“, §16a, §16b · 3.32.0: src/version.ts v26 (PersonList.custom, origin, customUnknown, Person.changedAt aditivně; vlastní pravidlo dynamic false s personIds), src/person-lists-data.ts sanitizeCustomRule (celé, nebo customUnknown), withCustomSnapshot, onPersonsMerged, keepPersonListData (custom, origin, changedAt), src/types.ts ListTemplate v nastavení · app:5b16c6fc, efc14cff · spec 136 K1.8 -->
