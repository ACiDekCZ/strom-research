<a id="R2"></a>
# R2 Linie i kolejka

Na podstawie czego agent badania wybiera, nad czym będzie pracować. Opisuje badanie 1.25.2 i aplikację
Strom 3.21.2. Zmiany z nowszej wersji mają przy sobie jej numer.

<a id="R2.1"></a>
## R2.1 Linia wyznacza, co badanie bada

Linia badania to jeden cel: przodkowie osoby, potomkowie osoby albo jedno pytanie. Każde zadanie należy do którejś
linii, a agent pracuje nad zadaniami linii.

- **Obsługa:** aplikacja: panel badania, sekcja **Linie · aktywne: N** · terminal: menu **Rozszerz badanie →
  Nowa linia badania**, polecenie `strom research new`
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:src/core/model.ts DIRECTIONS, RESEARCH_STATES · research:src/commands/research.ts · app:strings.ts live.dirTitle -->

<a id="R2.1.1"></a>
### R2.1.1 Rodzaje linii i ograniczenia

- **Przodkowie osoby**, najwyżej podana liczba pokoleń albo tylko przodkowie urodzeni przed podanym rokiem.
- **Potomkowie osoby.**
- **Jedno pytanie** (zmyślony przykład: „Kto był ojcem Marie Vlkovej?”).
- **Przegląd osoby** powstaje z przeglądu osoby, nie z oferty nowej linii.
- **Obsługa:** terminal: `strom research new --direction ancestors|descendants --generations <n> --before <rok>
  --question "<otázka>"`. Aplikacja: **+ Nowa linia**, z ograniczeniami **Najwyżej pokoleń** i **Tylko przed rokiem**
  (aplikacja 3.22.0 z badaniem 1.26.0).
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:src/commands/research.ts:79 · assets/lang/cs.json ui.research.kind · app:src/ui/research-directions-ui.ts DIRECTIONS_WRITE_SINCE -->

<a id="R2.1.2"></a>
### R2.1.2 Linia wstrzymana i zakończona

- **Wstrzymana:** jej zadania czekają poza kolejką, agent bierze zadania innych linii.
- **Zakończona:** jej zadania znikają z kolejki. Nic nie jest usuwane i linię można uruchomić ponownie.
- **Obsługa:** terminal: **Rozszerz badanie → Linie badania: wstrzymaj, zakończ lub uruchom ponownie**,
  `strom research pause|done|resume`. Aplikacja: sekcja Linie, działania **Wstrzymaj**, **Zakończ**, **Uruchom
  ponownie**. W aplikacji 3.21.2 działanie potwierdza się w terminalu badania, od aplikacji 3.22.0 bezpośrednio
  w panelu.
- **Obowiązuje od:** badanie 1.8.0

<!-- zdroj: research:src/commands/research.ts:168-175 · src/cli/menu-research.ts:233-263 · app:v3.21.2 research-directions-ui.ts:554 -->

<a id="R2.1.3"></a>
### R2.1.3 Kto należy do linii

- Linia przodków: osoba, jej przodkowie w granicach linii oraz mąż lub żona przodka.
- Linia z pytaniem: osoba, której dotyczy pytanie.
- Zadanie bez określonej linii należy do najwęższej linii, do której należą jego ludzie.
- **Obowiązuje od:** badanie 1.0.0. Małżonkowie i osoba pytania od 1.26.0.

<!-- zdroj: research:src/core/frontier.ts:159-194 researchPeople/linePeople · src/core/directions.ts:75-82 directionOf · CHANGELOG.cs.md 1.26.0 -->

<a id="R2.1.4"></a>
### R2.1.4 Kolejność linii to kolejność pracy

Linie mają jedną kolejność i w niej przychodzi na nie praca: pierwsza linia ma pierwszeństwo.

- **Granice:**
  - linia wstrzymana i zakończona zachowuje swoje miejsce; po ponownym uruchomieniu wraca tam, gdzie była. Nowa
    linia idzie na koniec;
  - co kolejność znaczy dla kolejki, zależy od strategii ([R2.2.1](#R2.2.1)): **balanced** i **depth** dają zadaniom
    pierwszej trwającej linii dodatek 2 punktów, ostatniej 0, pozostałym proporcjonalnie; żadna linia nie stoi.
    **priority** bierze linie ściśle po kolei: pierwszą, dopóki ma pracę, potem następną; zadania bez linii dopiero
    po nich;
  - badanie bez zapisanej kolejności układa linie według priorytetu, potem według daty założenia;
  - węższa granica linii (`strom research edit`) niczego nie usuwa: zadania poza granicą czekają poza linią.
- **Obsługa:** terminal: `strom research list` (w kolejności pracy), `strom research order G… G…`,
  `strom research move G… --to <n>|--up|--down|--first`,
  `strom research edit G… --name|--question|--generations|--before`. Aplikacja: sekcja **Linie**
  ([S4.3.1](S4-research-from-the-app.md#S4.3.1)), telefon ([S5](S5-phone.md)).
- **Obowiązuje od:** badanie 1.26.0

<!-- zdroj: research:src/core/order.ts workOrder, orderMode · src/core/queue.ts:237-240 lineBonus, :396 priority lineRank · src/commands/research.ts:215 research edit, :303 research order, :326 research move -->

<a id="R2.2"></a>
## R2.2 Kolejka wyznacza, które zadanie przychodzi na kolej

Otwarte zadania wszystkich trwających linii tworzą jedną kolejkę. Agent zawsze bierze pierwsze zadanie. Zadanie
rozpoczęte idzie przed wszystkimi.

- **Granice:** kolejność wyznaczają te klucze, każdy następny tylko przy zgodności poprzednich:
  1. zadanie rozpoczęte;
  2. ręczny wybór **od razu** / **na koniec** ([R2.3.1](#R2.3.1));
  3. zadania historii miejsc idą za pozostałymi, we własnej kolejności; gdy historia jest na kolei, jej pierwsze
     zadanie idzie naprzód;
  4. praca poza liniami ([R2.3](#R2.3));
  5. krótka praca naprzód: łączenie wariantów hipotez z osobami drzewa oraz miejsca, o których identyfikację
     poprosił człowiek;
  6. opowieść: gdy jest na kolei, idzie pierwsza ([R2.2.2](#R2.2.2)), w przeciwnym razie dopiero po badaniu;
  7. zadanie, które można wykonać od razu, przed zadaniem, które czeka na skany pobrane przez człowieka;
  8. strategia kolejki ([R2.2.1](#R2.2.1));
  9. rodzaj zadania: materiały → gdzie są akty → potwierdzenie powiązania → weryfikacja → wzbogacenie osoby →
     wniosek do archiwum → opowieść;
  10. wiek zadania.
- **Obsługa:** terminal: `strom task list`, `strom task next`. Aplikacja: sekcja **Kolejka**.
- **Obowiązuje od:** badanie 1.0.0 (klucze 1, 7–10). Klucz 6 od 1.1.0, łączenie hipotez od 1.17.0, klucz 3 od 1.22.0,
  klucz 4 i miejsca na prośbę od 1.25.0. Klucz 2 od 1.26.0.
- **Od badania 1.32.0:** most szuka w całej kolejce (numer zadania lub osoby, imiona i nazwiska osób, słowa zadania,
  jego księga, sygnatura, archiwum i miejsce, bez względu na znaki diakrytyczne), a szukany tekst nie jest nigdzie
  zapisywany, nawet w dzienniku mostu.
  W aplikacji: pole wyszukiwania w **Kolejce** ([S4.2.1](S4-research-from-the-app.md#S4.2.1)).

<!-- zdroj: research:src/core/queue.ts rankTasks (řazení :374-396), LEVEL_ORDER :52, linksFirst (hypolinks.ts:453), placesFirst · verze klíčů: git log -S na „a.blocked - b.blocked“ (v1.0.0), „a.story - b.story“ (v1.1.0), „a.first - b.first“ (v1.17.0), „a.hist - b.hist“ (v1.22.0), „a.offLine - b.offLine“ a placesFirst (v1.25.0) · 1.32.0: src/core/live.ts searchQueue, queueAsk (GET /queue?q=, q nikdy v logu mostu), funkce queue.search · CHANGELOG.cs.md 1.32.0 -->

<a id="R2.2.1"></a>
### R2.2.1 Strategia kolejki

- **balanced** (domyślna): przeplata linie. Wyżej stawia wyższy priorytet linii, bliższe pokolenie i linię, nad
  którą nie pracowano w ostatnich 4 sesjach. Niżej stawia zadanie, które już się nie powiodło.
- **depth:** trzyma się linii, nad którą właśnie trwa praca.
- **priority:** według priorytetu linii (1–5, domyślnie 3), potem według pokolenia.
- **Obsługa:** terminal: `strom config set queue.strategy balanced|depth|priority`, priorytet linii
  `strom research new … --priority <1–5>`.
- **Obowiązuje od:** badanie 1.0.0
- **Od badania 1.26.0:** znaczenie ma też kolejność linii ([R2.1.4](#R2.1.4)); **priority** bierze linie po kolei,
  wewnątrz linii według priorytetu zadania i pokolenia.

<!-- zdroj: research:src/core/queue.ts:294-299, RECENT=4 :58 · src/core/config.ts queue.strategy · model.ts priority -->

<a id="R2.2.2"></a>
### R2.2.2 Opowieść na kolei

Opowieść w przeciwnym razie czeka, aż badanie nie ma nic do zrobienia. Po 5 sesjach bez opowieści jedna czekająca
opowieść przychodzi jednak na kolej jako pierwsza (przy samodzielnej pracy agenta). Przy strategii priority to nie
obowiązuje.

- **Obowiązuje od:** badanie 1.1.0
- **Od badania 1.31.0:** przy kolei opowieści idzie naprzód tylko pierwsza opowieść w kolejności, pozostałe zostają za
  badaniem. Kolejność, w jakiej zadania bierze `strom run` (z koleją opowieści i z zadaniami historii, gdy są na
  kolei), pokazuje też menu przed `strom run` („Teraz kolej na te zadania, w kolejności, w jakiej weźmie je agent:”)
  i kolejka w aplikacji Strom ([S4.2](S4-research-from-the-app.md#S4.2)); kolejka mostu niesie przy zadaniu, czy to
  opowieść, czy historia. `strom task next` i `strom task list` mają kolejność rozmowy: bez kolei opowieści.

<!-- zdroj: research:src/core/queue.ts STORY_EVERY=5 :61 · 1.31.0: research 5f48cdaf src/core/queue.ts rankTasks (turnStory: jen první vyprávění tahu), RUN_TURNS, runOrder; src/cli/menu.ts (ui.run.next), src/core/live.ts (/status queue[], GET /queue, kind story|history), src/commands/tasks.ts CONVERSATION_ORDER (task next, task list) · CHANGELOG.cs.md 1.31.0 -->

<a id="R2.2.3"></a>
### R2.2.3 Zadania, które czekają poza kolejką

Zadania nie bierze się, dopóki:
- jego linia jest wstrzymana lub zakończona ([R2.1.2](#R2.1.2));
- dotyczy tylko ludzi, których z drzewem nie łączy żadne powiązanie rodzinne. Najpierw trzeba udokumentować
  powiązanie z drzewem, potem bada się dalej. Zadanie, które to powiązanie weryfikuje, się bierze;
- brakuje skanów księgi, którą ma czytać, i czeka się na decyzję, jak je zdobyć;
- archiwum, z którego czyta, jest chwilowo niedostępne;
- jest poza liniami z wyborem **nigdy** ([R2.3](#R2.3)).

Materiały (zadanie typu materiały) i zadanie rozpoczęte nie czekają nigdy.

- **Obsługa:** terminal: `strom task list --off-tree` (zadania poza drzewem).
- **Obowiązuje od:** badanie 1.9.0 (poza drzewem); pozostałe powody według wersji w przywołanych zasadach.

<!-- zdroj: research:src/core/queue.ts:205-210 waits · src/core/kin.ts:98 offTree · assets/method/core.md „The tree first, then above it“ -->

<a id="R2.3"></a>
## R2.3 Praca poza liniami

W badaniu z wieloma liniami **praca poza liniami** to zadanie o ludziach, do których nie sięga żadna linia (siostra
przodka i jej rodzina), które nie pomaga żadnej linii. Taka praca idzie **dopiero po pracy nad liniami**.

- **Granice:** zadanie pomaga linii, a więc nie jest poza liniami, gdy wymienia hipotezę lub sprzeczność linii,
  łączy ludzi z drzewem przez osobę linii albo jej partnera, albo agent zapisał, jak pomaga linii (rodzeństwo przodka
  jako chrzestny lub świadek, ten sam dom, nazwisko przodka). Własna rodzina rodzeństwa linii nie pomaga: łączenie
  ludzi z boczną gałęzią (na przykład z rodzeństwem przodka) należy do tej gałęzi i przychodzi na nie kolej według jej
  wyboru ([R2.3.1](#R2.3.1)). Hipoteza linii i powód zapisany przez agenta obowiązują dalej.
- **Opcje:** **na końcu, dopiero po liniach** (domyślnie) · **normalnie, jak praca linii** · **nigdy** (zadań się nie
  bierze, nic nie jest usuwane).
- **Obsługa:** terminal: **Ustawienia → Samodzielna praca agenta → Praca poza liniami**,
  `strom config set queue.offLine last|normal|never`. Aplikacja 3.21.2 pokazuje przy zadaniu **Czeka do zakończenia
  pracy linii · nie pomaga żadnej linii**.
- **Obowiązuje od:** badanie 1.25.0
- **Od badania 1.26.0:** nowa opcja domyślna **czasem, raz na jakiś czas**: jedno zadanie poza liniami na 10 sesji
  (`queue.offLineShare`), z najbliższej gałęzi. Do pracy poza liniami należy też mąż lub żona przodka
  ([R2.1.3](#R2.1.3)).
- **Od badania 1.31.0:** linii pomaga tylko łączenie ludzi z osobą linii albo z jej partnerem; wcześniej wystarczało
  połączenie z kimkolwiek z drzewa, także z rodzeństwem przodka. Most w `/status` mówi przy zadaniu, nad którym trwa
  praca, jak pomaga linii (funkcja `working.helps`). Aplikacja 3.27.0 pokazuje to w **Przeglądzie badania** w wierszu
  **Teraz** („pomaga linii … · łączy ludzi z drzewem”, „poza liniami · gałąź …”,
  [S4.1](S4-research-from-the-app.md#S4.1)) i we wstępie wyboru pracy poza liniami
  ([S4.3.2](S4-research-from-the-app.md#S4.3.2)).

<!-- zdroj: research:v1.25.2 src/core/config.ts:278 queue.offLine (popis), :715 výchozí last · HEAD model.ts OFF_LINE_CHOICES, config.ts OFF_LINE_SHARE=10 · assets/method/core.md „The lines first“ · app:strings.ts research.queueOffLast · výzkum 1.31.0: src/core/offline.ts (b: joins jen k osobě linie nebo partnerovi, jinak větev; a, c mají přednost), HelpsBy, /status working[].helps, branch · commity 576cf7e5, 2e54c8d5 · CHANGELOG.cs.md 1.31.0 „Připojení rodiny k vedlejší větvi je práce mimo linie“ · spec 036 K1.7 -->

<a id="R2.3.1"></a>
### R2.3.1 Wybór dla jednej gałęzi i jednego zadania

Oprócz wyboru dla całego badania własny wybór może mieć jedna gałąź (także „dodać do linii”) i jedno zadanie
(**od razu** / **na koniec**). Węższy wybór wygrywa: zadanie przed gałęzią, gałąź przed badaniem.

- **Granice:**
  - gałąź: **czasem**, **na końcu**, **normalnie**, **nigdy** (zadania czekają poza kolejką, nic nie jest usuwane
    i nowe zadanie się w niej nie proponuje), albo dodać do linii: zadania gałęzi wtedy pomagają linii i idą z nią.
    Wybór obowiązuje też dla nowych zadań gałęzi. Powrót do wyboru badania: domyślny;
  - zadanie **od razu** przychodzi na kolej jako następne, przed liniami, miejscami i historią miejsc, i tylko raz:
    po sesji nad nim wybór znika sam. **Na koniec** obowiązuje, dopóki zadanie nie jest gotowe albo dopóki wybór nie
    zostanie cofnięty. Zadanie, nad którym pracuje agent, miejsca nie zmienia.
- **Obsługa:** terminal: `strom offline list|show`, `strom offline set B-P… --mode occasional|last|normal|never`,
  `--line G…`, `--default`; `strom task order T… --next|--last|--default`. Aplikacja 3.22.0:
  **Zrób jako następne**, **Na koniec**, opcje gałęzi ([S4.3.2](S4-research-from-the-app.md#S4.3.2)). Aplikacja 3.28.0
  z badaniem 1.32.0: **Zrób jako następne** i **Cofnij** ([S4.2.2](S4-research-from-the-app.md#S4.2.2)).
- **Obowiązuje od:** badanie 1.26.0
- **Od badania 1.32.0:** z kilku zadań wybranych **od razu** pierwsze idzie ostatnio wybrane (wybrane ponownie idzie
  na górę); wcześniej pierwsze wybrane. Zadanie, nad którym agent pracuje, zostaje pierwsze. `strom task order T…
  --restore next@<czas>` (lub `last@<czas>`) przywraca wybór zadania dokładnie taki, jaki był: czas to ten, który
  poprzednia zmiana podała w `--json` (`was`), najwyżej sprzed 30 dni i nie późniejszy niż teraz.

<!-- zdroj: research:src/commands/offline.ts:101 offline set (BRANCH_MODES), :171 task order (next once, queue.doing) · quality/offline.json · 1.32.0: src/core/queue.ts rankTasks (b.nextAt před a.nextAt: naposledy zvolený první; doing první), turnWas, restoredTurn, RESTORE_DAYS=30 · src/commands/offline.ts task order --restore, was · src/core/live.ts POST /queue/<T…> was, {do: restore} · CHANGELOG.cs.md 1.32.0 · spec 052 K5.3, K5.4 -->

<a id="R2.3.2"></a>
### R2.3.2 Rosnąca gałąź dostaje propozycję linii

Gdy gałąź poza liniami urośnie do 10 otwartych zadań lub 5 osób, w **Czeka na załatwienie** pojawia się pytanie: dodać
do linii, założyć linię, zostawić bez zmian albo nie badać. Po odpowiedzi „zostawić” propozycja wraca dopiero przy
dwukrotnej wielkości. Gałąź z własnym wyborem i wybór **nigdy** propozycji nie dostają.

- **Granice:** odpowiada tylko człowiek (aplikacja lub **Co czeka**); agentowi badanie odpowiedź odrzuca. Gdy linia
  przy gałęzi jest wstrzymana lub zakończona, aplikacja proponuje najwęższą trwającą linię, do której należy osoba
  gałęzi; gdy takiej nie ma, linię wstrzymaną z uwagą **(wstrzymana)**.
- **Obsługa:** terminal: **Proponować linie dla rosnących gałęzi** (włączyć/wyłączyć), `strom offline answer B-P…
  line|keep|never`, `strom config set queue.suggestTasks|queue.suggestPersons <n>`. Aplikacja: **Czeka na załatwienie**,
  ustawienie **Proponuj linie dla rosnących gałęzi** ([S4.3.2](S4-research-from-the-app.md#S4.3.2)).
- **Obowiązuje od:** badanie 1.26.0

<!-- zdroj: research:src/core/offline.ts:449-455 grows · config.ts SUGGEST_TASKS=10, SUGGEST_PERSONS=5 · cs.json ui.wait.branch.done.keep · src/commands/offline.ts:142 offline answer (person) · app:src/ui/research-offline-ui.ts answerGrowingBranch · strings.ts live.setSuggest, live.branchAddPaused -->

<a id="R2.4"></a>
## R2.4 Dlaczego zadanie stoi tam, gdzie stoi

Każde zadanie w kolejce podaje powód swojego miejsca: w linii, pomaga linii (i jak), poza liniami (i w jakiej
gałęzi), ręczny wybór albo czeka, bo linia jest wstrzymana.

- **Obsługa:** aplikacja 3.22.0: sekcja **Kolejka**, wiersz przy zadaniu (np. „pomaga linii N · …”).
- **Obowiązuje od:** badanie 1.26.0

<!-- zdroj: research:src/core/queue.ts:312-349 · app:strings.ts live.qWhyLine, qWhyHelps, qWhyOut, qWhyManualNext, qWhyPaused -->
