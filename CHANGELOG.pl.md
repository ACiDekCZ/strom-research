# Co nowego w Strom Research

[English](CHANGELOG.md) · [Čeština](CHANGELOG.cs.md) · [Deutsch](CHANGELOG.de.md) · Polski

Zmiany każdej wersji w skrócie. Pełne informacje o wydaniach i polecenia instalacji są na
[GitHub Releases](https://github.com/ACiDekCZ/strom-research/releases) (po angielsku).

## 1.38.0

*W przygotowaniu: bety do 1.38.0-beta.1. Sekcja będzie kompletna z wydaniem.*

- **Ustawienia badania w historii słowami:** ustawienie zmienione w aplikacji lub w menu pokazuje się w ostatnich
  zmianach nazwą i wartością w języku badania („Wyłączono w badaniu: Pytanie przed sortowaniem materiałów”), już nie
  jako klucz (`sort.confirm`).
- **Agent odnajduje się przy mniejszej liczbie prób:** `strom place find <nazwa>` i `strom place <nazwa>` kierują do
  `strom place list <nazwa>`; `strom source list --note <tekst>` wypisuje jednym wywołaniem źródła, których notatka coś
  mówi (na przykład że adres dał rejestr); `strom media view` wyjaśnia, jak obejrzeć obraz zarejestrowany tylko w
  częściach i jego wycinek.

## 1.37.0

*25.11.2026 · współpracuje z aplikacją Strom 3.32.0.*

- **Wpis archiwum w badaniu nie utrzymuje już portalu z listy stroma:** księga z adresem na portalu, który zna lista
  stroma (Porta fontium, Acta Publica…), nie czyni już portalu tak surowym jak archiwum, pod którym jest zapisana –
  portal kieruje się własnymi warunkami. Własny portal archiwum pod innym adresem (lista podaje
  przy nim warunki na stronie archiwum, np. eBadatelna praskiego archiwum państwowego) utrzymuje nadal. Poziom, który strom utrzymuje z wcześniej, zostaje, dopóki człowiek nie
  zdecyduje w „Co czeka”. Tam, gdzie wpis archiwum nadal utrzymuje stronę, `strom doctor` i `strom allow archive`
  wymieniają archiwum, jego księgę i stronę. Rozdział R12.2 przewodnika nie wymienia już nieistniejącego
  `strom run --chrome`.
- **Numer skanu w dowolnym miejscu nazwy:** skany zapisane ręcznie do folderu czekającego zadania są przejmowane także
  pod nazwami portalu – `__0236.jpg`, `Lhota_11__125.jpg` (portal uzupełnia zera tylko do trzech cyfr, od skanu 100 już
  nie), `fond12_kniha3_236.jpg`: z kilku liczb w nazwie ta, która należy do potrzebnych skanów, ta, która zmienia się
  między plikami folderu, inaczej ostatnia przed rozszerzeniem. Data i godzina zrzutu ekranu nigdy nie są numerem skanu,
  ani rok za nim (`33 1784.jpg`), gdy nie wiadomo, które skany; nazwa z dwoma potrzebnymi numerami nie jest zgadywana,
  lecz zgłaszana razem z plikiem. Nazwa, która nie daje numeru skanu, nie wstrzymuje już reszty (`000.jpg` zostaje
  w folderze i jest zgłoszony raz, bez rady zmiany nazwy). Pliki nazwane według aktów na nich (`001-004.jpg`) lub inaczej niż numerami skanów są
  przejmowane w kolejności folderu, gdy przez 20 minut nic więcej nie zostanie zapisane; akty zostają zapisane przy
  każdym skanie, a zadanie wraca z listą, który plik jest którym skanem. Kolejny arkusz pod tym samym numerem (`7a.jpg`)
  jest rozpoznawany po treści: kopia, powiększony fragment albo osobny skan zachowany pod swoją nazwą, nigdy ukryty – w tej
  samej lub późniejszej partii, także po powrocie zadania i przy `strom media add --inbox <folder>`.
  Zadanie, do którego przyszła tylko część skanów, wraca po tym samym czasie ciszy z tym, co przyszło i czego brakuje –
  skan na granicy dwóch roczników liczy się raz.
- **Wyczerpany limit strony nie jest już przeczekiwany na próżno:** po `web.perHost` agent słyszy, kiedy strona znów da
  strony – limit tego komputera albo w jego sesji już żadnej – i co do tego czasu: zadanie zostaje otwarte, inna praca,
  w przeciwnym razie koniec sesji; żadnej strony ponownie wcześniej ani czekania. `strom run` na razie pomija zadanie
  na takiej stronie i bierze inne; gdy innego nie ma, czeka, aż wolnych stron będzie dość (bez agenta, nic nie jest
  wysyłane), albo kończy i mówi kiedy. Zadanie czekające na skan, którego przeglądarka agenta nigdy nie zapisała (strona
  odrzucona), wraca z końcem sesji do kolejki i nigdy nie jest uznane za wstrzymane przez przeglądarkę. Tak zakończony
  przebieg jest dla aplikacji Strom ukończonym przebiegiem, nie błędem.
  Skany zapisywane przez przeglądarkę agenta są jego pracą: dopóki sesja agenta zapisuje skany przez swoją
  przeglądarkę (`strom media save`), zadania nie ma już w „Co czeka” – ani w liczbach, etykietach czy powiadomieniach
  – a aplikacja Strom dostaje je jako trwającą pracę (`working[].saving`: ile z podanych skanów jest zapisanych). Na
  człowieka czeka tylko skan wstrzymany przez przeglądarkę – zezwolić na pobieranie wielu plików z witryny,
  powiedziane od razu na początku – oraz sesja zakończona w połowie: zapisywanie zatrzymane na jej skanie, kontynuuje
  następna sesja. Wcześniej zapisane oczekiwania pokazują się tak bez ingerencji.
  Gdy przyczyna ustąpi, takie zadanie – i zadanie ze skanami, do których prowadzi tylko przeglądarka, gdy przeglądarka
  agenta tam sięga, albo tylko do odczytu z ekranu przeglądarki archiwum – wraca z „Co czeka” do agenta, pojedynczo lub
  całe archiwum naraz (także z aplikacji Strom: `waiting[].retry` mówi, na co czeka teraz i ile skanów): od razu
  w kolejce, najwyżej trzy razy na dobę, a gdy znów zostanie wstrzymane, czeka ponownie i to mówi. Skan zapisany ponownie z `--again`
  jest od razu przejmowany jako obraz skanu, dotychczasowy wycofany i zachowany – bez `strom media aside --take` przy
  każdym skanie. Kilka skanów naraz kosztuje znacznie mniej: `strom media save --image 40,41,45` (najwyżej dziesięć,
  strona dla każdego lub jeden adres z `{n}`) daje jeden krótszy skrypt dla wszystkich – każdy skan nadal na własnej
  stronie w tempie człowieka – a jedno `strom media add --inbox --waiting` je przejmuje; agent z podagentami przekazuje
  więcej niż trzy subagentowi drzewa `strom-image-saver` (mały kontekst, `model.cheap` osoby, te same hooki). Prawidłowo zapisana
  kopia ma pierwszeństwo przed zrzutem ekranu, nawet o większej liczbie pikseli, a `strom media cites M… --move-to M…`
  przenosi na nią źródła cytujące zrzut ekranu – zrzut pozostaje zachowany.
- **Wysyłki z aplikacji lżejsze i szybsze:** wysyłka z aplikacji Strom jest planowana raz zamiast dwa razy, a pliki,
  które badanie już ma, idą przez odwołanie (swój skrót) zamiast całych danych; wysyłka wskazująca plik, którego
  badanie nie znajduje, jest odrzucana w całości, zanim cokolwiek zostanie zapisane, a aplikacja wysyła ją ponownie
  z danymi. „Co czeka” nigdy nie pokazuje wysyłki, która jest jeszcze liczona, jako 0 zmian. Kilka urządzeń przy
  jednym badaniu: wysyłka podaje przeglądarkę lub komputer, z którego przyszła (w `strom input list`, w historii
  i w commicie); konflikt dwóch wysyłek wymienia oba urządzenia; cofnięcie jednej wysyłki pozostawia część danej,
  którą od tego czasu zmieniło inne urządzenie lub badanie, i mówi o tym.
- **E-maile osoby to kontakt, nie miejsce zamieszkania:** e-maile z GEDCOM (miejsce zamieszkania z MyHeritage tylko
  z e-mailem, starsza notatka aplikacji Strom „E-mail: …”) stają się kontaktem osoby, pokazywanym osobno od faktów
  w `strom person show` i na karcie osoby – nigdy zdarzeniem ani miejscem, gdzie osoba mieszkała, nigdy nie trafiają
  do agenta. Synchronizacja z aplikacją dodaje i usuwa e-maile jak inne zmiany. Nowa kontrola `strom fixes
  contact-residences` zamienia miejsca zamieszkania, które starszy strom zrobił z e-maili, na kontakt (wycofane, nigdy
  usunięte, cofa je `strom fixes undo`).
  **Spisy zapisane jako własne zdarzenie:** spis ludności osoby zapisany jako zdarzenie nazwane „Spis ludności”
  („Census”, „Sčítání lidu”…) trafia do aplikacji Strom jako spis, więc wczytanie wersji badania nie pokazuje już
  takich spisów za każdym razem jako przekreślonych; zapis w badaniu zostaje taki, jak go zapisano. `strom check`
  ostrzega przed dwoma spisami jednej osoby z tą samą datą, a zapis cytowany dwa razy ma swoje słowa w notatce faktu
  tylko raz.
  **Wyznanie jako fakt:** wyznanie, które akt podaje przy osobie – słowem w swojej rubryce lub znakiem w niej –, jest
  zapisywane jako fakt Wyznanie (RELI) z cytowaniem aktu i jego datą; nigdy nie jest wywodzone z rodziców, parafii,
  księgi ani obrzędu, ani z niepewnie odczytanego słowa. Kolejny akt tego samego wyznania dodaje do faktu tylko
  cytowanie; zmienione wyznanie jest osobnym faktem. Gdy transkrypcja własnego aktu osoby podaje wyznanie, którego
  badanie nie ma jako faktu, brief przypomina o tym agentowi przy pracy nad tą osobą.
- **Materiał do listy osób:** aplikacja Strom może wysłać skan do całej listy osób (arkusz spisu, strona księgi
  metrykalnej) zamiast do jednej osoby. Materiał zachowuje listę taką, jaką wysłano – nazwę, rodzaj, regułę i ID jej
  osób; do 50 z nich to osoby materiału, dłuższa lista jest podana nazwą i plikiem wszystkich jej osób. Zadanie agenta
  nosi nazwę listy i każe porównać każde imię ze skanu najpierw z tymi osobami, a dopiero potem z całym drzewem.
  Tak samo można wysłać skan źródła: pozostaje obrazem źródła, zachowuje listę tak samo, a zadanie jego odczytania ma
  osoby z listy (do 50) wśród dotyczących.
  **Sortowanie materiałów bez pytania:** ustawienie `sort.confirm` (dla badania z `--for-tree`, w przeciwnym razie
  dla tego komputera): `ask` – domyślne, jak dotąd: zgoda osoby na płatne odczyty przed każdym sortowaniem – albo
  `no`: `strom material sort` sortuje od razu, gdy osoba o to poprosi, i mówi, że nie pytano; nigdy samoczynnie,
  a przebieg, którego nikt nie obserwuje, nadal pyta. `no` ustawia tylko osoba we własnym terminalu lub w aplikacji
  Strom na tym komputerze (mówi o tym jedna linia w logu mostu), nigdy agent; powrót do pytania może każdy.
  **Materiał z aplikacji przypisany w drzewie:** plik z paczki wysłanej przez aplikację Strom (lub inny materiał z niej
  wysłany), który badanie przyporządkuje jako zapis, dokument lub zdjęcie osób, trafia teraz do drzewa aplikacji przy
  nich – dwoje partnerów jednej pary przy ich parze – więc aplikacja pokazuje go przy osobie, nie tylko w oknie
  Materiały. Osoby żyjące nie są wyjątkiem: to, co o nich wysłano, jest przyporządkowane i zapisane jak u każdego innego
  (ochrona osób żyjących należy do eksportu). Plik, który ma już miejsce w drzewie lub którego miejsce usunięto
  w aplikacji, zostaje bez zmian; osoba odebrana z pliku nie dostaje przy nim miejsca.
- **Badanie dla kopii drzewa:** link aplikacji Strom, który zakłada nowe badanie, może zaproponować jego nazwę (kopia
  drzewa: „… (kopia)”); terminal proponuje ją do zachowania lub nadpisania, a most podaje aplikacji folder, w którym
  powstają nowe badania. Drzewo przekazane z numerami innego badania (kopia drzewa, które miało badanie, ze starszej
  aplikacji) dostaje dla swoich osób i źródeł numery nowego badania według własnych oznaczeń pliku – nigdy numery
  tamtego badania, cytowania źródeł zostają.
- **Co najbardziej pomoże:** każda rzecz, która czeka na załatwienie i za którą stoją zadania, mówi, jak bardzo jej
  załatwienie rozszerzy drzewo – nowe pokolenie nad osobą, do której sięga badanie, linia prosta, zadania, które
  odblokuje – i dlaczego, w kilku słowach w języku badania; aplikacja Strom może więc pokazać najpierw to, co
  najbardziej pomoże. W terminalu to samo: `strom task list --state waiting --order gain`.

## 1.36.0

*22.11.2026 · współpracuje z aplikacją Strom 3.31.0.*

- **Próba zbiorczej weryfikacji od razu:** zadania próby zbiorczej weryfikacji (`strom verify bulk --try`) stoją na
  początku kolejki – weźmie je następna sesja – a aplikacja Strom pozwala przerobić je od razu, każde zadanie w jednej
  sesji, przez link wskazujący zadania. Każde zadanie kolejki ma swój rodzaj pracy (weryfikacja, wpisy, materiał,
  miejsca, historie…): `strom task list --kind`, a aplikacja Strom filtruje według niego.
- **Skany zapisywane ręcznie, bezpieczniej:** numer skanu jest brany z nazwy pliku tylko wtedy, gdy nazwa mówi go
  jednoznacznie (kopia menedżera plików „33 2.jpg” to skan 33; nazwa z dwiema liczbami i bez licznika nie dostaje
  żadnego); pliki partii są numerowane według kolejności tylko wtedy, gdy żaden nie ma liczby w nazwie; folder jest
  przejmowany dopiero po pobraniu całej partii (.crdownload lub .part obok go wstrzymuje). Plik będący tym samym skanem
  co inny skan nigdy nie jest usuwany: zostaje odłożony obok i jest to powiedziane. Plik zapisany pod numerem już zarejestrowanego skanu, pokazujący inną stronę (inny
  kształt lub inne pismo), nie zastępuje już skanu: zostaje odłożony obok, a pytanie o niego pojawia się w „Co czeka” i
  w aplikacji Strom – zachować skan, przyjąć nowy plik jako ten skan albo nadać mu własny numer (`strom media aside`).
  Ostrzejsza kopia jest przejmowana tylko wtedy, gdy na pewno jest tym samym skanem – porównywane jest pismo, nie
  drukowany formularz; gdy nie da się tego rozstrzygnąć, plik również zostaje odłożony i pojawia się pytanie o niego.
- **Agent z aplikacji Strom bez potwierdzenia:** ustawienie tego komputera `run.confirm` (Ustawienia → 1 → „Uruchamianie
  agenta z aplikacji Strom”): `ask` – domyślnie, jak dotąd – albo `no`, a to, o co prosi aplikacja Strom i co tylko
  uruchamia agenta w ramach subskrypcji lub kredytu AI (rozmowa, zadanie, praca nad kolejką, sprzeczność pozostawiona
  agentowi, ustalanie miejsc – przy kilku partiach miejsc pyta się tylko o liczbę, a Enter uruchamia co najmniej jedną),
  uruchamia się od razu; jedna linia w terminalu mówi o tym i gdzie pytanie włącza się z powrotem. Nadal pytane są:
  pytanie z ceną w pieniądzach, zgody, usuwanie, wysłanie prośby, warunek samodzielnej pracy i każde polecenie agenta.
  Pytanie wyłącza tylko człowiek – w terminalu lub w aplikacji Strom na tym komputerze (mówi o tym jedna linia w logu
  mostu), nigdy agent.
- **Usuwanie źródła:** źródło można usunąć w badaniu – `strom source retract` w terminalu lub usunięciem źródła w
  aplikacji Strom, tylko przez osobę, nigdy przez agenta (może je jedynie zaproponować, z tym, co według `--dry-run` by
  zabrało). Wartości zostają; jego cytaty są zdejmowane z danych i przechowywane w źródle, dana może stać się mniej
  pewna, zadanie oparte tylko na nim zostaje porzucone, a rozstrzygnięta sprzeczność, która na nim stała, zostaje
  oznaczona do sprawdzenia (`strom conflict keep` zachowuje rozstrzygnięcie). To, co zabierze, jest mówione wcześniej i
  osoba to potwierdza; źródło można przywrócić wraz z cytatami (`strom source restore` lub cofnięcie w aplikacji Strom).
  Źródło usunięte w aplikacji Strom podczas edycji drzewa jest usuwane w badaniu przy następnym wysłaniu – tylko przy
  wysłaniu całego drzewa przez osobę; w przeciwnym razie Zmiany mówią, dlaczego nie. Usunięte źródło nie wraca już z
  późniejszym plikiem ani importem. W terminalu `strom source show` mówi, że źródło jest usunięte, kiedy i co je
  przywraca, a `strom source list --retracted` wypisuje usunięte źródła.
- **Spisy ludności:** badanie może używać spisów ludności jako źródła – gospodarstwo domowe w jednym roku pokazuje, kto
  mieszkał razem i skąd kto pochodził. Wyłączone, dopóki osoba ich nie włączy, w ustawieniach badania („Spisy ludności
  w tym badaniu”) lub w aplikacji Strom; agent może to tylko raz zaproponować. Gospodarstwo jest zapisywane wszystkim
  jego członkom w drzewie naraz (`strom census add`): pokrewieństwo z głową rodziny, wiek, data, miejsce i dom oraz
  cytat arkusza jednakowo u każdego; osoby spoza drzewa tylko w notatce. Pokrewieństwo jest przejmowane tak, jak piszą
  je formularze spisu („głowa rodziny”, „żona głowy rodziny” i ich odpowiedniki po angielsku, czesku i niemiecku).
- **Imiona i nazwiska – jak pewne i po ślubie:** imię i nazwisko osoby cytuje się jak daną, także z tym, jak jest
  pewne: agent cytuje je tak, jak podaje je przeczytany wpis (`strom cite P… S… --status`, `name add --status`,
  `person add --name-status`; udokumentowane tylko według oryginału wpisu), a imiona i nazwiska, które starsze badanie
  cytowało z wpisów, raz same stają się prawdopodobne (nigdy udokumentowane; to, które osoba wpisała lub potwierdziła,
  zostaje; `strom fixes undo name-status` je przywraca). Aplikacja Strom, która to pokazuje, pozwala sprawdzić je razem
  z wpisem urodzenia i potwierdza je według skanu jak daną. U kobiety zamężnej kilka razy obecne nazwisko to nazwisko po ostatnim ślubie – nazwisko męża
  z najpóźniejszego ślubu, także w formie żeńskiej; nazwisko wybrane w aplikacji Strom jako obecne jest przejmowane i
  obowiązuje, dopóki nie zostanie wybrane ponownie. Plik dla aplikacji Strom podaje nazwiska po ślubie na końcu, obecne
  na samym końcu, więc także starsza aplikacja Strom pokaże właściwe.
- **Kilku agentów i kilka badań naraz, bez kolizji, i mniej straconych kroków w długich przebiegach:**
  każda sesja trzyma swoje zadanie, dopóki jej agent daje znaki
  życia – zadanie trzymane przez innego agenta zostaje przy nim, a zadanie agenta, który umilkł, zostaje przejęte po
  `task.hold` (to, co zapisał, zostaje, zadanie wraca do kolejki). Z archiwum, które ogranicza dostęp automatyczny
  (tempo człowieka, tylko przeglądarka, godzinny limit narzędzia pobierającego), korzysta naraz tylko jedna sesja ze
  wszystkich badań ze wspólnym folderem: zadanie z niego czeka, dopóki korzysta z niego inna sesja, a w tym czasie idzie
  inna praca; praca samodzielna, której zostały tylko takie zadania, czeka na archiwum najwyżej `archive.wait`, a na
  komputerze działa naraz tylko jedno zbiorcze pobieranie skanów z takiego archiwum, następne czeka w kolejce za nim.
  Podczas czekania archiwum nie dostaje żadnych zapytań. Menu pokazuje też agentów pracujących bezpośrednio, a aplikacja
  Strom dowiaduje się, kto trzyma zadanie lub archiwum, od kiedy i najpóźniej do kiedy. Czasy są ustawieniami tego
  komputera: `task.hold`, `archive.hold` (trzymanie archiwum bez zapytań do niego) i `archive.wait`, każde domyślnie 30
  minut, od 5 minut do 24 godzin. Każda linia może mieć własny przebieg agenta: `strom run --research G…` (w menu przez
  wybór linii, przebieg we własnym oknie nazwanym od linii) bierze zadania tej linii, drugi przebieg tej samej linii
  zostaje odrzucony, a praca nad całą kolejką pomija linie z własnym przebiegiem; w jednym badaniu pracuje naraz
  najwyżej `run.parallel` przebiegów (domyślnie 3, zwiększyć może tylko człowiek) – zużycie subskrypcji się sumuje. Nowa
  linia wewnątrz innej proponuje przejęcie otwartych zadań o swoich osobach (`strom research gather`). Aplikacja Strom
  widzi każdy przebieg, uruchamia i zatrzymuje je według linii (`strom run stop`); przebiegi na jednym komputerze dzielą
  limit subskrypcji, plany przeglądarki, strony witryny i czytelników skanów.
  Zasady agenta mówią, by pracował we własnej karcie przeglądarki; po karcie spoza jego grupy albo stronie, która nie
  odpowiada, od razu dostaje, co robić (nowa karta; praca w przeglądarce odłożona dopiero po drugim przekroczeniu
  czasu). Długi tekst `strom readings` lub `strom searched` kończy się przy około 20 kB wierszem, jak go zawęzić, oraz
  `--full` dla całości (`--json` pozostaje cały; `strom searched` ma strony jak inne listy). Partia z błędnymi wierszami
  mówi też, których wierszy nie sprawdzono, bo zależą od błędnego. Opcje, które agenci zgadują i które znaczą dokładnie
  inną, są przyjmowane i podawane w wierszu (`strom recordset list --parish` jako `--place`, `strom media list --image
  5` jako `--images 5-5`, `strom readings --recordset`, `strom search add --query`); `strom person list --surname`
  znajduje nazwisko z jego formami jak `strom query --surname`. Zapis bramki oznacza czekanie, przez które przebieg
  uruchomiony przez osobę przeszedł dalej (`pace`). Każdy przebieg zapisuje, dlaczego się zakończył
  (`.strom/runs/<przebieg>.end.json`: te same powody, które pokazuje aplikacja Strom, sesje, koszt, ostatnie i następne
  zadanie).
- **Drobne poprawki:** Zakres skanów przez przeglądarkę agenta: archiwum z listy stroma może dostać zakres skanów naraz (najwyżej 20, skan po skanie w tempie człowieka, z zatrzymaniem przy pierwszym sprawdzeniu lub odmowie archiwum; kolejny zakres z tego archiwum dopiero po ręcznym zapisaniu pozostałych skanów), każde archiwum tylko za własną zgodą człowieka (`strom allow archive <archiwum> --range` lub w menu); na razie nie ma go żadne archiwum. Zdjęcia z aplikacji Strom docierają znacznie szybciej: wysyłanie zdjęć lub paczki plików z
  aplikacji Strom do dużego badania nie odczytuje już przy każdym pliku wszystkich wpisów skanów badania: to, co badanie
  już ma, jest wyszukiwane w indeksie skrótów plików (w `.strom/cache`, odbudowywanym samoczynnie, gdy go brak lub jest
  nieaktualny), a most zapisuje to, co wysyła aplikacja, jednym stale działającym procesem strom zamiast uruchamiać nowy
  dla każdego pliku. Nowsza aplikacja Strom przekazuje całą paczkę naraz: każdy plik jest sprawdzany i potwierdzany
  zaraz po nadejściu, a paczka zapisywana przy zamknięciu – jeden zapis, jedna przebudowa pliku drzewa i jedno
  powiadomienie aplikacji – a pracujący agent dostaje się do badania między częściami. Starsza aplikacja Strom wysyła
  jak dotąd, tylko szybciej. Plik paczki, który przy jej zamykaniu zajmuje inny program (antywirus, synchronizacja lub
  kopia zapasowa), nie jest już błędem: nic nie ginie, aplikacja Strom chwilę czeka i dowiaduje się dlaczego, a badanie
  samo zapisuje pliki paczki chwilę później. Paczka zamknięta bez porządkowania, której pliki uporządkowano w aplikacji
  Strom, nie pozostaje już w menu aplikacji „nieuporządkowana”: plik, przez który porządkowanie przeszło do końca,
  liczy się jako uporządkowany – także w badaniu uporządkowanym tak wcześniej, bez żadnej zmiany w nim.
  Aplikacja Strom pokazuje w Materiałach zaimportowane pliki drzewa
  genealogicznego (GEDCOM, JSON aplikacji) i usuwa je na stałe jak każdy plik materiałów; ten, z którego powstało
  źródło, tylko razem z tym źródłem, w jednym kroku z jednym potwierdzeniem (`strom input delete … --retract-sources`).
  Osoby odłączonej od pliku materiału (Przypisz w aplikacji Strom, `strom input assign --remove`) sortowanie przez
  agenta już do niego nie dołącza; po ponownym dodaniu plik znów do niej należy.
  Archiwum, które strom trzyma surowiej, niż mówi jego własna lista warunków archiwów (konektor lub
  wpis w badaniu raz tak je odczytał), nie wyłącza już tam po cichu przeglądarki agenta: `strom doctor`, `strom run` i
  `strom allow archive` mówią, od kiedy, dlaczego i co mówi lista, Co czeka i aplikacja Strom pytają osobę raz, czy
  zachować poziom, czy przyjąć warunki archiwum (`strom allow archive <host> --keep` lub `--level <poziom>`), po czym do
  kolejki wracają tylko zadania, które nowy poziom otwiera; tam, gdzie osoba zezwoliła na archiwum „przez przeglądarkę”,
  sprawdzenie strony kieruje agenta do jego przeglądarki zamiast do zgody, która już obowiązuje; przed konektorem lub
  archiwum zapisanym surowiej niż lista strom ostrzega; zadanie wydzielone przez `strom task audit --fix` nazywa skany
  księgi jej tytułem, bez ID i czasownika; `strom task wait --images` podane ponownie dla tej samej księgi łączy jej
  skany (inna księga jest odrzucana: jedna księga na zadanie); dwie próby zbiorczej weryfikacji po sobie idą w
  kolejności zlecenia, starsza pierwsza; warunek limitów subskrypcji odczytuje je w sekundę lub dwie, bez przeglądania
  rozmów zapisanych na komputerze; w aplikacji Strom każdy przypis drzewa genealogicznego znów pokazuje własny wiersz
  drzewa (odnośnik utworzony przez import pozostaje na boku), a numer skanu znany tylko z zarejestrowanych skanów jest
  tak oznaczony, by aplikacja dodała go do lokalizacji, nie wycinając z niej numeru innego skanu. `strom pack` i `strom
  trees remove` nazywają skany z archiwów skanami (które idą razem, które są pominięte), a kopia zapasowa przed
  usunięciem mówi, że zawiera rodzinne zdjęcia i oryginały.
  W terminalu pytanie i warianty hipotezy nazywają osoby i rodziny podane identyfikatorem imieniem z identyfikatorem
  (w Co czeka i gdy aplikacja Strom prosi o rozstrzygnięcie), a agent też tak je pisze; imię zapisane przed
  identyfikatorem – osoby lub partnerów rodziny – nigdy nie powtarza się.
  Przebiegi obok siebie w jednym drzewie („uruchomić kolejnego obok niego”, rozmowa obok przebiegu): przebieg, którego
  następne zadanie tuż przed rozpoczęciem wziął inny, kontynuuje następnym wolnym zadaniem zamiast kończyć cały
  przebieg; żadne zadanie nie jest brane dwa razy.
  Linia zakończona wewnątrz szerszej, która trwa, nie zostawia już swoich zadań czekających na zawsze: liczą się do
  najwęższej trwającej linii, do której należą ich osoby (w zadaniach nic się nie zmienia, więc wznowiona linia ma je
  z powrotem); zadania wstrzymanej linii czekają jak dotąd.
  Plik wysłany do badania nie uruchamia już sam agenta, także w badaniu założonym wcześniej: ani paczka z aplikacji
  Strom lub z telefonu, ani pojedynczy plik czy skan źródła z aplikacji, ani materiały dodane w menu (tam pada pytanie,
  czy agent ma je przejrzeć). Pliki czekają w Materiałach, aż zostaną uporządkowane ręcznie lub przez porządkowanie
  agentem; samodzielne przeglądanie włącza dla badania tylko osoba (`strom config set intake.auto on --for-tree`,
  Ustawienia → 1 lub ustawienia badania w aplikacji Strom). Już założone zadania zostają.
  Gdy przeszukane skany księgi nie obejmują lat wokół daty znanej tylko z wieku (urodzony około 1761 według wieku przy
  śmierci), agent dowiaduje się, których lat brakuje i gdzie księga ciągnie się dalej, zanim „nie znaleziono” zostanie
  przyjęte – ile lat w każdą stronę, określa ustawienie badania `search.ageMargin` (domyślnie 5).
  Rozmowa o linii z aplikacji Strom jest przy zakończonej linii odrzucana jednym zdaniem – nic nie jest pytane ani
  uruchamiane. Skan innej księgi nie trafia już przez pomyłkę do księgi: `strom fetch` odrzuca księgę, której skany
  przyszły z innej księgi konektora, albo księgę z portalu innego konektora, i mówi, która to księga; wycofany skan
  nie wiąże księgi z niczym.
  Wysyłka z aplikacji Strom nie usuwa już notatki pliku materiału, którego aplikacja nigdy nie miała w swoim drzewie:
  taka wysyłka zatrzymywała każdy kolejny zapis badania (przyjęcie sortowania w aplikacji mówiło tylko „exit 1”);
  otwarcie aplikacji Strom lub kolejny zapis przywraca notatkę i zapisuje to, co czekało. Zapis aplikacji Strom odrzucony przez kontrolę badania
  nie zostawia niczego, a aplikacja dowiaduje się dlaczego.

## 1.35.0

*19.11.2026 · współpracuje z aplikacją Strom 3.30.0.*

- **Księgi z największą liczbą zadań:** strom mówi, których ksiąg archiwów potrzebuje najwięcej zadań badania –
  otwartych, odłożonych i czekających –, aby jedno ręczne pobranie posłużyło wielu z nich naraz: w menu stroma (Co
  czeka › księgi z największą liczbą zadań) i poleceniem `strom task books`, przy każdej archiwum, lata, ile zadań
  czeka, skany na dysku i brakujące, potrzebne skany, których jeszcze nie ma na dysku, oraz folder na jej skany.
  Oferowane są tylko księgi, które da się pobrać i nie są jeszcze całe na dysku: cała księga tam, gdzie pozwalają na to
  warunki archiwum (z własnymi słowami archiwum), w przeciwnym razie skany, na które czekają zadania. Pobranie jest
  dobrowolne: bez niego agent czyta księgę dalej online. Agent na początku zadania dowiaduje się, które inne zadania
  potrzebują tej samej księgi, aby zrobić je razem, a `strom task list --book` je wypisuje.
- **Księgi w aplikacji Strom i ich ustawienia:** most daje aplikacji Strom księgi z największą liczbą zadań i przy
  każdej to, co wolno z niej pobrać, a w tym, co czeka, i w kolejce podaje przy każdym zadaniu jego księgę. Od ilu
  zadań księga jest proponowana (`books.minTasks`, domyślnie 5) i czy następna sesja ciągnie dalej tę samą księgę
  (`queue.sameBook`, domyślnie wyłączone: po sesji nad księgą, której skany są na dysku, najpierw przychodzi kolejne
  zadanie tej samej księgi, najwyżej 5 sesji po kolei) ma każde badanie własne – ustawia się w aplikacji Strom, w menu
  stroma (Ustawienia › Archiwa › Księgi z największą liczbą zadań) albo poleceniem `strom config set … --for-tree`. Link z aplikacji otwiera
  folder księgi, bez terminala.
- **Czekające zadanie pod księgą do przeszukania:** zadanie, które czeka na przeszukanie księgi na stronie archiwum,
  jest w aplikacji Strom pod tą księgą, a nie pod księgą, w której znaleziono ślad: pod księgą, którą nadał mu agent
  (`strom task wait|edit --book`), inaczej pod jedyną księgą, którą wymienia jego tekst. Dopóki księgę trzeba dopiero
  znaleźć, zadanie czeka bez księgi i dla jego skanów nie jest proponowany folder innej księgi. „Co czeka” w menu
  stroma porządkuje zadania nadal według tego, na kogo czekają (archiwum, urząd, rodzina).
  Zadanie czekające na skany zapisywane ręcznie wraca samo tylko wtedy, gdy jego oczekiwanie wskazuje księgę badania i
  numery skanów (`strom task wait T… --images B…:57-58`), jedna księga na zadanie. strom odrzuca teraz oczekiwanie,
  które wymienia skany tylko słowami, chce skanów kilku ksiąg naraz lub księgi, której badanie jeszcze nie ma, i zamiast
  tego podaje dokładne polecenia. `strom task audit` znajduje oczekiwania zapisane tak wcześniej (przez starszą wersję)
  i poprawia każde jednym krokiem – zadanie czeka na skany swojej księgi, każda kolejna księga dostaje własne zadanie,
  już zapisane skany są od razu przejmowane – z drogą powrotu, dopóki nic się w międzyczasie nie zmieniło; oczekiwanie
  można też zostawić bez zmian. Rozmowa o takim zadaniu (`strom chat --task`) od tego się zaczyna, a agent zapisuje
  poprawkę dopiero po zgodzie osoby.
  Aplikacja Strom dostaje te same ustalenia przy każdym czekającym zadaniu i można w niej oczekiwanie poprawić, cofnąć
  poprawkę albo zostawić je bez zmian.
- **Skany księgi od człowieka:** skany zapisane ręcznie do folderu księgi, na którą nie czeka żadne zadanie, strom
  bierze (most albo następna sesja) według numeru skanu w nazwie, a wszystkie zadania tej księgi czytają je z dysku;
  pliki JPEG 2000 portalu, którego nazwy liczą skan × 10 (MZA Brno), są przeliczane z powrotem. Przy zadaniu, które
  nie wie, których skanów księgi potrzebuje, skan wysłany z aplikacji Strom nie jest już odrzucany, gdy jego nazwa nie
  podaje numeru skanu albo podaje kilka (rok i numer aktu, data i godzina z aparatu): dostaje kolejny wolny numer
  księgi (po najwyższym, który już jest), kilka naraz po kolei; numer podany w aplikacji albo jedyny numer w nazwie
  nadal ma pierwszeństwo. Most podaje aplikacji Strom kolejny wolny numer, żeby mogła go zaproponować. Kopia zapisanego skanu zrobiona przez menedżer plików (`33 2.jpg`, `33 - Copy (2).jpg`, `33a kopie.jpg`) to skan, który wskazuje jej numer; plik nazwany samym numerem nigdy nie dostaje według kolejności numeru innego skanu, a plik będący tym samym skanem co inny zostaje odłożony obok niego i jest to powiedziane – nigdy nie jest po cichu usuwany. Zadanie
  obudzone dostarczonymi skanami jest następne w kolejce: zadanie, które czekało na skany księgi, wraca do kolejki
  jako następne, jakby przesunięte ręcznie do przodu (po pracy w toku), gdy skany dostarcza człowiek – wysłane do
  niego z aplikacji Strom, zapisane w jego folderze wspólnej skrzynki albo przejęte przez `strom media add --inbox`.
  Kilka obudzonych naraz idzie do przodu razem, między sobą w zwykłej kolejności. Obowiązuje to raz: po sesji nad
  zadaniem znów zwykła kolejność. Zadanie obudzone inaczej (odpowiedź archiwum, decyzja, list, skany pobrane przez
  agenta albo konektor) zostaje na swoim miejscu, a kolejność ustawiona ręcznie (na koniec, gałąź niebadana)
  obowiązuje dalej.
  Brandenburskie Archiwum Krajowe (BLHA) według swojej odpowiedzi z 18 listopada 2026: pojedyncze skany jego duplikatów
  ksiąg metrykalnych (Rep. 5KB, CC-0) można zapisywać w przeglądarce osoby w ludzkim tempie i dawać do czytania
  agentowi – nigdy przeszukiwanie jego bazy ani cała księga; cytuje się „BLHA, Rep. 5KB Nr. <n>” z numerem skanu.
- **Notatki z aplikacji Strom:** notatka chrzestnego lub świadka zmieniona w aplikacji Strom 3.29.0 lub nowszej wraca do
  badania, z pliku i z tego, co aplikacja wysyła wprost przez most. Notatka, która jest tylko początkiem notatki badania
  (jak trzymała ją starsza aplikacja albo skrócona w aplikacji – także cięciem między literą a jej akcentem), nigdy nie
  jest przejmowana sama: strom sync mówi o tym jednym wierszem, a na człowieka czeka pytanie (w tym, co czeka, i w
  aplikacji Strom), czy przejąć krótszą notatkę, czy zachować notatkę badania. Pytanie pada raz: to samo drzewo wysłane
  ponownie już o nic nie pyta i mówi, że pytanie nadal czeka. Gdy strom przywraca notatki, które wysłanie z aplikacji Strom zapisało przy podobnej
  danej, notatkę zmienioną od tego czasu zostawia, a na człowieka czeka zadanie, by ją sprawdzić (w tym, co czeka, i w
  aplikacji Strom), nigdy tylko wiersz w historii.
- **Windows: po sprawdzeniu logowania nic nie działa dalej, okno linku z tytułem:** sprawdzenie, czy agent w terminalu jest zalogowany,
  kończy wszystko, co uruchomiło, gdy trwa za długo, a czytniki nie wypisują już ostrzeżenia Node DEP0190.
  Terminal, który w Windows otwiera link aplikacji Strom, ma tytuł Strom Research (druga instalacja ze swoją nazwą),
  a nie ścieżkę do node.exe. `strom doctor` i raport `strom error` podają, ile mostów do aplikacji Strom działa na
  komputerze, do którego badania należy każdy, jego pamięć i sumę, oraz oznaczają most, którego badania już nie ma;
  nic nie jest kończone.
- **Żadnych zmian, których nie było w aplikacji Strom:** po zapisie z aplikacji Strom „niezapisane” nie podaje już jako
  usuniętych cytowania rodziny z jednym rodzicem (starsza aplikacja Strom wysyła je z pustym małżeństwem) ani
  źródła zmian w aplikacji Strom (tych źródeł aplikacja nigdy nie dostaje).
  Link aplikacji Strom, który otwiera terminal lub coś robi na komputerze, badanie potwierdza aplikacji, gdy tylko
  terminal się pojawi lub rzecz jest zrobiona, więc aplikacja od razu przestaje czekać i odzywa się tylko wtedy, gdy
  nic się nie otworzyło.
- **Rodzinne materiały: w paczce osobno, z partiami, odłożone, dopóki nie ma agenta, zdjęcia i pliki aplikacji Strom zachowane z miejscami w drzewie:** `strom pack` i usunięcie drzewa
  genealogicznego z tego komputera odróżniają skany z archiwów od rodzinnych zdjęć i oryginałów: paczka mówi, ile czego
  zawiera, a pytanie o rodzinne zdjęcia i oryginały przy usuwaniu pada osobno (bez wyraźnego tak zostają) – nikt ich nie
  pobierze ponownie. Paczka zabiera też partie, w których aplikacja Strom wysłała rodzinne materiały (nazwa, osoby,
  notatka), a rozpakowanie je przywraca. Paczka, która miałaby ponad 4 GB, jest odrzucana, zanim cokolwiek zostanie
  zapisane, jednym zdaniem: takie badanie przeniesie skopiowany cały folder. Badanie, które czeka na swojego agenta,
  odkłada zadania do materiałów, które w tym czasie przyjdą, jak archiwum; wracają do kolejki, gdy tylko agent znów nad
  nim pracuje.
  Portrety, zdjęcia pary i pliki dołączone w aplikacji Strom do
  osoby, pary, zdarzenia lub źródła zapisują się w badaniu, gdy aplikacja wysyła swoje drzewo: każdy plik raz (według
  zawartości), jako wpis materiałów rodziny z tytułem, rodzajem, datą, notatką i swoimi miejscami w drzewie. Nowy
  portret zachowuje poprzedni jako starszą wersję. Plik zdjęty z miejsca w aplikacji zostaje zdjęty tylko wtedy, gdy
  aplikacja wysyła wszystkie swoje pliki, i tylko to, co aplikacja już dostała (nigdy plik dodany w innym oknie ani to,
  co dodało badanie); `strom sync undo` go przywraca, a sam plik nigdy nie jest usuwany. Badanie oddaje pliki aplikacji
  Strom razem z drzewem, pakiet (`strom pack`) je przenosi, oryginał pary wysłany z aplikacji jest materiałem obojga
  partnerów, a drzewo przejęte z aplikacji przynosi swoje pliki. Starsze dane badania nie potrzebują niczego: schemat
  przechodzi na 3 sam, nic nie jest przepisywane.
  To, co aplikacja Strom pokazuje z materiałów, mówi, gdzie każdy plik jest
  użyty (osoby, pary, zdarzenia, źródła), gdzie powstały z niego wycinki lub cytaty i które zadania go potrzebują; plik
  zdjęty ze wszystkich miejsc w drzewie pokazuje się jako usunięty i można go przywrócić. Tytuł, rodzaj i datę
  edytuje się dla jednego lub wielu plików naraz (`strom input edit`, też z aplikacji, z drogą powrotu), a osoba dodana
  do pliku drzewa staje się jego miejscem. W badaniu z agentem wybrane pliki może uporządkować czytelnik
  (`strom material sort` lub z aplikacji): proponuje tytuł, datę, rodzaj i miejsca z powodem i pewnością, niczego nie
  zapisuje, nigdy nie nadpisuje tego, co ustawiła osoba, i liczy się do limitów czytania z aplikacji. Odczyty są
  płatne: sortowanie zaczyna się dopiero po zgodzie osoby (w terminalu, w oknie systemu lub w oknie dialogowym
  aplikacji), nigdy samo ani na polecenie agenta.
  Przy pliku, który wyraźnie nie dotyczy rodziny (zrzut ekranu, paragon, plik wgrany przez pomyłkę), czytelnik mówi to
  wraz z powodem, aby można go było ukryć w aplikacji Strom; samo nic się nie ukrywa ani nie usuwa.
  Sortowanie czyta plik tekstowy (.txt, .md) jako tekst i ocenia go po tym, co w nim stoi, w trakcie pracy mówi, z iloma plikami już skończyło (aplikacja Strom to pokazuje), a przy każdym pliku bez propozycji mówi dlaczego (nic nie powiedziano, nic nowego, pominięty, odczyt się nie powiódł). Czytający może też powiedzieć, który plik jest odwrotem innego otrzymanego zdjęcia lub strony, a który obraz jest portretem osoby, aby aplikacja Strom to zaproponowała.
  Sortowanie materiałów uruchamia się bez pytania tylko wtedy, gdy przyjął je i podpisał most aplikacji Strom; wpis
  zapisany inaczej (lub dodany do kolejki przez starszą wersję) się nie uruchomi i trzeba go zlecić ponownie w
  aplikacji.
  To, co aplikacja Strom pokazuje przy każdym pliku, wymienia źródła z niego utworzone, z niego wycięte lub z obrazem
  tej samej treści, wraz z osobami, które je cytują, i informacją, czy ma je jej drzewo; plik, dla którego sortowanie
  niczego nie zaproponowało, oraz plik o tej samej treści co inny są oznaczone, aby nie wysyłać ich ponownie, a w
  badaniu z wieloma obrazami lista przychodzi kilkakrotnie szybciej. Z aplikacji można naraz sortować do 1500 plików:
  w partiach po 50, jedna po drugiej, dopóki działa most, każda w limitach czytania aplikacji i pokazana, gdy tylko
  jest gotowa; cały przebieg można zatrzymać naraz. Plik materiałów rodzinnych można usunąć na stałe – tylko przez
  osobę (`strom input delete` lub w aplikacji Strom po wykazie wszystkiego, czego dotyczy), nigdy przez agenta: jego
  źródła zachowują tekst i cytaty, jego obrazy i wycinki znikają tylko wtedy, gdy tej samej treści nie trzyma inny plik
  ani inne badanie, a pozostaje on tylko we wcześniejszych kopiach zapasowych badania.

## 1.34.0

*15.11.2026 · współpracuje z aplikacją Strom 3.29.0.*

- **Główny przypis i jedna kolejność przypisów:** przypisy każdej danej idą w każdym pliku w jednej kolejności – najpierw
  główny przypis, potem zapis samego zdarzenia, inne oryginały, a reszta według tego, jak są pewne. Główny przypis
  wybiera tylko człowiek, w aplikacji Strom albo w terminalu przez `strom event main`; agent nigdy go nie zmienia.
  `strom person|family|event show` pokazują kolejność i który przypis jest główny.
- **Przypisy usunięte w aplikacji Strom:** przypis usunięty przez użytkownika w aplikacji pozostaje usunięty, także po
  ponownym wczytaniu wersji badania, a badanie go znowu nie cytuje; cofnięcie tego wysłania go przywraca. Zmiana w
  aplikacji danej, którą badanie w międzyczasie wycofało, nigdy nie jest zapisana po cichu: aplikacja dowiaduje się
  dlaczego.
- **Samodzielna praca z warunkiem:** gdy limit planu agenta przerwie sesję, praca czeka do odnowienia limitu (w
  terminalu i w aplikacji Strom jako pauza), potem ponownie pyta warunek i idzie dalej; przerwane zadanie wraca do
  kolejki. Komunikat agenta o wyczerpaniu limitu jest odczytywany jako limit planu razem z czasem odnowienia.
- **Notatki z aplikacji Strom:** zmiany użytkownika w notatce danej wracają do badania, każda do swojej danej,
  wcześniejszy tekst zostaje w historii notatki; usunięta notatka niczego nie usuwa. Własne zdarzenie chrzestnego lub świadka w
  GEDCOM aplikacji jest nazwane w języku badania. Własne drugie urodzenie lub zgon aplikacji i jej akt urodzenia lub
  zgonu są rozpoznawane także po polsku i nigdy nie są zgłaszane jako nieprzejęte.
- **Folder domowy, w którym badanie już jest:** `strom setup --home <folder> --use-existing` (i konfiguracja po
  zgodzie) przyjmuje ten folder za domowy takim, jaki jest – nic nie jest przenoszone, a stary folder zostaje bez zmian.
- **Odrzucone polecenia:** polecenie odrzucone przez uprawnienia agenta jest zachowane w całości, także wielowierszowe,
  więc `strom error` widzi je całe; skraca je dopiero jego raport.
- **Inne drzewo pod nazwą badania:** wysłanie z aplikacji Strom, w którym prawie nie ma osób badania, tylko inne
  (na przykład przykładowe drzewo aplikacji), jest odrzucane i nic nie jest zapisane; jeśli to zamierzone, przyjmie je
  `strom sync <plik> --force`.
- **Agent w terminalu niezalogowany:** czytelnicy `strom read` i praca samodzielna uruchamiają program agenta
  w terminalu, który ma własne logowanie, nie to z aplikacji desktopowej. Gdy mówi, że nie jest zalogowany, nic się nie
  uruchamia, a komunikat mówi, jak się zalogować; tak samo przy czytelniku, który tak kończy, nigdy tylko „auth”.
  `strom doctor` ma osobny wiersz, czy agent w terminalu jest zalogowany.

## 1.33.0

*15.11.2026 · współpracuje z aplikacją Strom 3.28.0.*

- **Archiwa, do których wolno wejść tylko przeglądarką człowieka:** agent nie próbuje już tam pobierania przez strom ani
  wyszukiwania w katalogu. Ich skany idą pojedynczo przez przeglądarkę agenta (`strom media save`), gdy człowiek zezwoli
  „przez przeglądarkę”, w przeciwnym razie człowiek zapisuje je ręcznie; brief i odmowy od razu podają ten następny krok.
- **Skany zapisywane przez przeglądarkę:** księga jest brana z tego, na co czeka zadanie, albo ze strony archiwum;
  zapisany plik nosi znak badania, więc nigdy nie zostanie wzięty plik innego badania ze wspólnego folderu pobranych
  plików. Znajdowane są też przeglądarki skanów wbudowane w kod
  strony (OpenSeadragon w React); przeglądarka, do której strom nie sięga, jest zgłaszana razem z tym, co zamiast tego
  robi człowiek.
- **Wyszukiwania i historia:** wyszukiwanie, które coś znalazło, zapisuje się po swoim źródle, a bez źródła podaje
  kolejność; źródło znalezione omyłkowo usuwa `strom search edit --drop-found`. `strom history hide|show` sprawdzają,
  co dostały, zanim o cokolwiek zapytają; jedno zdarzenie czyta `strom history list --event <id>`.
- **Zapisy po skanach, które właśnie przyszły:** sesja rozpoczęta przy zadaniu, którego zapisane skany właśnie
  przyszły, zostaje zapisana; badanie, którego każdy zapis był potem odrzucany, znowu zapisuje samo.
- **Z aplikacji Strom:** fakt odesłany w innej postaci tego samego rodzaju (zdarzenie typu Census zamiast spisu) jest
  rozpoznawany jako ten sam fakt – bez zmiany, gdy nic się nie zmieniło, jako edycja tego faktu, gdy zmieniła się data.
- **Słabe i oczekiwane skany:** słaby skan zapisuje się jeszcze raz przez `strom media save --again` jako nową kopię obok
  pierwszej, nic nie jest usuwane, a skanem jest najostrzejsza kopia; skan, na który czeka zadanie, podaje, kto czeka,
  i następny krok; na pobieranie, które jeszcze się zapisuje, strom czeka, a `strom fetch --take` bierze listę skanów
  także obok planu stron.
- **Indeksy:** indeks innej parafii nigdy nie jest proponowany przez przynależność, która nie mówi, o którą parafię
  chodzi; liczą się lata przynależności.
- **Polecenia tak, jak wpisują je agenci:** inna nazwa opcji lub polecenia zostaje przyjęta albo strom odpowiada właściwą;
  `strom grep --in` z początkiem nazw plików czyta te pliki.

## 1.32.0

*14.11.2026 · współpracuje z aplikacją Strom 3.28.0.*

- **Pytania o drzewo jednym wywołaniem: `strom query`.** Ilu młynarzy jest w rodzie, kto mieszkał pod numerem 12, kto
  urodził się w Lhocie w XVIII wieku: wiersz na każdą daną osoby z wartością, miejscem, numerem domu, datą, pewnością
  i źródłami oraz z tym, jak osoba jest spokrewniona z osobą główną, słowami — w języku badania, ze stroną (ojca, matki)
  i pokoleniem, tak jak mówi kalkulator pokrewieństwa aplikacji Strom. Filtry według rodzaju, zawodu, wartości,
  miejsca, numeru domu, lat, nazwiska (także jego innych form), źródła i stanu; czyje dane: linia prosta, krewni
  (domyślnie, także linie boczne), z ich partnerami, albo całe drzewo. `--count` i `--by
  generation|kin|place|decade|surname` je liczą. Osoby i dane wycofane nigdy, obalone tylko na życzenie. **Także
  opowieści: `strom query --story <słowo>`** podaje osoby i pary, w których opowieści jest to słowo, każdą ze zdaniem
  i źródłami, na których się opiera. Numer domu zapisany z własnym słowem (č. 7, Nr. 7) nie ma już słowa dwa razy,
  także na karcie osoby.
- **Zawody także w formach czeskich, niemieckich, łacińskich i polskich:** mlynar znajduje też Müller i molitor; osoby
  ze słowem tylko w nazwisku lub notatce liczone są osobno, z `strom find`, który je znajduje.
  **Własne formy badania: `strom occupation add|list|remove`.** Formę, której lista nie ma (inny język, dawna
  pisownia, zawód, którego nie zna), dodaje się ręcznie, bez agenta — `strom occupation add olejník de:Ölschläger` — i
  zostaje przy badaniu; agent tak samo dodaje to, co znajdzie w źródłach, i o tym mówi, a dodanego ręcznie nigdy nie
  zmienia. `strom query` mówi, gdy słowa nie ma na żadnej liście (szukana jest tylko ta forma), i jak dodać jego formy.
  Lista wbudowana zna o 40 rzemiosł i stanów z ksiąg metrykalnych więcej (kościelny, grabarz, garbarz, cyrulik,
  ludwisarz …).
- **Agent odpowiada na pytania o drzewo poleceniem `strom query`,** z imieniem i ID osoby w nawiasie (by otworzyć ją w
  aplikacji Strom: `strom app --person P…`; aplikacja przed 3.21 otwiera drzewo), pełnym pokrewieństwem i źródłem z jego tytułem, i mówi, jak pewna jest każda dana: wskazówka ani
  dana prawdopodobna nigdy jako fakt. Opowieść pokazuje tylko, gdzie szukać; czyj jest zapis, kto jest kim i sprawdzanie
  danych idą dalej jak dotąd, ze źródeł.
- **Wydarzenia wspólne w aplikacji Strom** (spis ludności gospodarstwa, przeprowadzka) i własne wydarzenie chrzestnego
  lub świadka ślubu z rolą przy cudzym wydarzeniu są odczytywane z jej GEDCOM i JSON, zachowywane przy każdej danej
  i oddawane tak, jak przyszły; od aplikacji 3.28 o tym, kto dzieli wydarzenie, decyduje się w aplikacji, a
  synchronizacja przyjmuje jej zmianę jako zmianę użytkownika. `ROLE` uczestnika z GEDCOM 7 jest odczytywane także
  w pliku innego programu. Spis osoby w JSON aplikacji nie jest już pomijany. Badanie założone z drzewa aplikacji Strom przejmuje z jej JSON wszystko, co daje jej GEDCOM: wydarzenia wspólne
  i role, chrzestnych, świadków i wszystkich uczestników wydarzenia, przyczynę zgonu, wiek i numery domów, rozwód
  z datą, więź każdego dziecka z każdym rodzicem, nazwisko po ślubie. Własne długie notatki użytkownika zostają całe,
  nie są już skracane do 500 znaków. Badanie założone z drzewa aplikacji z długą notatką z emoji mogło pominąć osobę
  lub rodzinę; następna synchronizacja ją uzupełni.
- **Kolejka z aplikacji Strom:** wyszukiwanie w całej kolejce (numer zadania lub osoby, imię i nazwisko, słowa zadania,
  jego księga, archiwum lub miejsce, bez względu na znaki diakrytyczne; szukany tekst nie jest nigdzie zapisywany);
  „jako następne” stawia ostatnio wybrane zadanie na początku i daje się dokładnie cofnąć; praca nad kolejką otwiera
  terminal, który pokazuje, co się uruchomi, i uruchamia to dopiero po „tak” – określoną liczbę zadań (`strom run
  --tasks N`, kończy się po N załatwionych) albo samodzielną pracę tylko pod warunkiem. Most do aplikacji w dużym badaniu pracuje znacznie mniej, gdy nic się nie zmienia.
- **Ustawienie dla przeglądarek archiwów, które przeglądarka rysuje powoli.** Gdy przeglądarka rysuje kartę tylko mniej
  więcej raz na sekundę (rysowanie bez karty graficznej, zdalny pulpit), przeglądarka skanów archiwum (ACTA PUBLICA)
  potrzebuje na jeden skan kilku minut, a zapis poddawał się po 30 s z komunikatem, że nie dotarły wszystkie kafelki.
  Ten komunikat podaje teraz, co pomaga: `strom config set browser.tileWait 180` (60–600 s) — skrypt czeka wtedy,
  dopóki kafelki jeszcze przychodzą, i odpowiada agentowi „strom-wait”, aż skończy. Bez tego ustawienia nic się nie
  zmienia.
- **Badanie zapieczętowane na innym komputerze można czytać bez przejęcia:** podglądy `strom source split`, `strom sync
  <plik>` i `strom input names` (co zrobiłby podział, co wniosłoby drzewo, które nazwiska po ślubie zostałyby dodane)
  pokazują się jak każde czytanie; zapis (`--apply`, `strom sync --app`, `--undo`) nadal czeka na przejęcie badania
  (`strom seal adopt`). `strom repair undo <znacznik> --json` bez terminala odpowiada teraz jak `strom repair`: `status:
  "needs-consent"` z poleceniem do uruchomienia w terminalu, nie tylko kodem wyjścia 4.
- **Codex w Windows i jego sandbox:** agent, któremu sandbox nie pozwala czytać ustawień ani zapisywać w badaniu,
  dowiaduje się właśnie tego, z poleceniem do uruchomienia poza sandboxem, zamiast szukać ustawienia, które było
  włączone. Codex wypuszcza strom z sandboxu tylko jako zwykłe polecenie — bez `&`, potoku ani `cd` przed nim, bez
  półpauzy (–) i bez cudzysłowów wewnątrz tekstu w cudzysłowie w argumentach; agent dowiaduje się o tym (AGENTS.md,
  `strom guide`, wskazówka sandboxu), razem ze sposobem na dłuższy tekst: jego polecenie w pliku w `notes/`, uruchomione
  przez `strom batch --file`. Zadanie, przy którym sandbox albo uprawnienia trzy razy z rzędu nie dopuściły strom do
  badania (nic nie zapisano), zostaje odłożone z powodem i z tym, co pomaga (`strom task show`), a przebieg idzie dalej
  następnym zadaniem; najwyżej jedno naraz — gdy sandbox odmawia wszystkiego, przebieg kończy się jak dotąd. `strom
  error` pokazuje, które polecenia odrzucono, skrócone i zamaskowane.

## 1.31.0

*12.11.2026 · współpracuje z aplikacją Strom 3.27.0.*

- **`strom repair` nie usuwa już pracy ukrytej przez uszkodzoną historię.** Gdy historię gita badania da się odczytać,
  ale jest starsza niż jego rekordy (dysk w chmurze przywrócił starszy `.git`, obok kopie iCloud takie jak `index 2`),
  `strom verify`, `strom check` i odrzucony zapis zgłaszają `history-reverted` z liczbą rekordów, które naprawa by
  usunęła, i wskazują drogę, która nic nie traci: kopię zapasową całego folderu, `.git` z kopii zapasowej lub z Time
  Machine albo `strom seal accept` wykonane przez użytkownika. `strom repair`, który usunąłby więcej niż trzy rekordy
  lub którykolwiek taki rekord, mówi które i pyta w terminalu użytkownika; agent nigdy go nie uruchamia. To, co naprawa
  odłożyła na bok, przywraca `strom repair undo <znacznik>` (użytkownik w swoim terminalu, jedna zapieczętowana
  operacja), także po naprawie z wersji 1.30.

- **Jeden most na badanie, także po aktualizacji.** Most starszego stroma, który został uruchomiony obok mostu badania,
  kończy się sam: gdy jego następca zastaje badanie w rękach innego mostu, przy najbliższej kontroli albo gdy
  aktualizacja usunęła strom, z którego działa (wcześniej co 16 sekund zgłaszał błąd). Przekazanie mostowi nowszego
  stroma jest też szybsze: stary most odpowiada, podczas gdy nowy strom jest sprawdzany.

- **Obraz zapisywany z podglądu skanów archiwum czeka, gdy przeglądarka nie rysuje jego karty.** Przeglądarka nie
  rysuje karty schowanej za inną kartą ani w oknie zasłoniętym lub zminimalizowanym, a podgląd skanów archiwum nigdy
  wtedy nie zgłaszał, że ma wszystkie kafelki: zapisywanie poddawało się po 30 s z komunikatem „the viewer's tiles did
  not all come” (ACTA PUBLICA). Oczekiwanie liczy teraz tylko czas, gdy przeglądarka rysuje kartę, i trwa dalej, gdy
  znów ją rysuje; karta nierysowana przez 30 s jest zgłaszana jako taka. Gdy podgląd w międzyczasie przejdzie do
  innego skanu, nic nie zostanie zapisane pod nazwą innego obrazu.

  **`strom fetch` zgłasza obraz, który kosztuje wiele zapytań, tak jak `strom connector test`.** Konektor zbudowany
  przed wersją 1.30, który składa każdy obraz z kafelków (sto zapytań na obraz, godziny na księgę), pobierał bez słowa.
  Teraz pierwsze obrazy pobierania mówią agentowi raz, ile kosztuje jeden obraz i jak długo w tempie archiwum potrwa
  księga, a także jak zatrzymać pobieranie w tle i czego szukać najpierw (jedno zapytanie na obraz). Liczone jest tylko
  to, co samo pobieranie wysyła: archiwum nie jest o nic więcej pytane. Mówią to też `strom fetch --status` i brief.

- **Dołączenie rodziny do bocznej gałęzi to praca poza liniami.** Zadanie, które dołączyłoby osoby niezwiązane z
  drzewem, pomagało linii zawsze, gdy dołączało je do kogokolwiek z drzewa – także do rodzeństwa przodka, więc szło z
  linią, choć praca poza liniami miała czekać na końcu. Teraz pomaga linii tylko dołączenie do osoby z linii lub jej
  partnera; dołączone do bocznej gałęzi należy do tej gałęzi i przychodzi zgodnie z jej wyborem. Hipoteza linii i
  powód podany przez agenta zachowują swoje miejsce. `/status` mostu mówi, jak zadanie, nad którym trwa praca, pomaga
  linii (funkcja `working.helps`), aby aplikacja mogła pokazać, dlaczego idzie z linią.

- **Badania w tabeli aplikacji Strom.** Dla aplikacji Strom, która to pokazuje, plik dla aplikacji podaje przy każdej
  osobie jej miejsce wśród linii badań według tej samej reguły, którą kieruje się kolejka: w linii (w każdej, do której
  należy), partner osoby z linii, boczna gałąź poza liniami (z linią, do której ją dodano) albo wyspa, której nic nie
  łączy z drzewem; nagłówek wymienia linie i gałęzie. Przy każdej osobie są też zadania czekające na coś z zewnątrz
  (list wysłany lub do wysłania, pytanie do rodziny, strona do przejrzenia) wraz z miejscem, gdzie się je załatwia, oraz
  kiedy badania dodały tę osobę. `GET /directions/people` mostu podaje te same miejsca na żywo, z odciskiem, który
  powtarza `/status` (funkcja `directions.places`).

- **Hipoteza rozstrzygnięta w aplikacji Strom.** Przy hipotezie, której warianty mówią, czyim dzieckiem ktoś jest albo
  która to para, wariant wybiera się w aplikacji (albo „żaden nie jest prawdziwy”, pozostawienie otwartej, cofnięcie
  rozstrzygnięcia). Terminal badania pokazuje pytanie z wariantami i to, co zostanie zapisane, pyta raz – Enter to tak
  – i o powód (Enter zostawia słowa aplikacji), po czym zapisuje to jako rozstrzygnięcie użytkownika w aplikacji
  Strom. Tak samo przyjmuje się naraz kilka propozycji agenta. W aplikacji wybiera się też hipotezę, której warianty nikogo nie łączą: zapisuje się tylko rozstrzygnięcie, drzewo zostaje bez zmian, a terminal mówi to przed potwierdzeniem. To, czy dwa zapisy to ta sama osoba, czy rodzeństwo,
  nadal rozstrzyga się w terminalu, na pełnym ekranie hipotezy. Rozstrzygnięcie jest w drzewie od razu: dziecko lub
  para wybranego wariantu zapisane w tym samym zapisie, z cytowaniem źródła wariantu, także w archiwum – agent nie
  zapisuje go ponownie; to, co drzewo odrzuci (dziecko ma już rodziców z urodzenia), terminal powie wraz z powodem
  i zapisze to agent. Przy zmianie usuwa się to, co zapisało poprzednie rozstrzygnięcie; przy cofnięciu to, co zapisało
  ono samo, o ile w międzyczasie nie opiera się na tym dalsza praca – kolejne dziecko, dane lub źródło rodziny,
  scalenie, nigdy własne dane osób (aplikacja wie to wcześniej); zmianę, po której dotychczasowe powiązanie by zostało,
  a nowego nie dałoby się zapisać, terminal powie przed potwierdzeniem, a Enter wtedy anuluje, także przy kilku propozycjach naraz; w terminalu również przez `strom
  hypothesis decide --reopen` (tylko użytkownik). Dla aplikacji plik Strom mówi, kto i gdzie rozstrzygnął, poprzednie
  rozstrzygnięcie, propozycję agenta, co przemawia przeciw każdemu wariantowi i ile osób dołącza do drzewa; `/status`
  mostu wymienia czekające hipotezy (features `hypothesis.decide.link`, `hypotheses.accept.link`).

- **Wpis da się odnaleźć, nawet gdy archiwum zmieni linki.** To, gdzie wpis stoi w księdze, jest zapisywane pole po
  polu: `strom source add|edit --folio` (strona lub folio tak, jak numeruje je księga, „fol. 12v”), `--image` (numer
  skanu w portalu archiwum) i `--call-number` (sygnatura księgi przy wpisie spoza zarejestrowanych ksiąg), obok
  `--locator` na resztę (numer wpisu). `strom source show` podaje archiwum, sygnaturę, folio i skan razem (skan także
  z zarejestrowanych obrazów) i proponuje folio i skan, które wymienia starsza lokalizacja – nigdy nie zapisuje ich
  sam; istniejące źródła zostają bez zmian. Plik dla aplikacji Strom i innych programów ma jedną czytelną PAGE złożoną
  z pól („pag. 112, nr 3, skan 57”) i sygnaturę jako CALN; same pola aplikacja Strom dostaje od wersji, która je czyta
  (funkcja mostu `sources.fields`), a ich zmiany wracają przez synchronizację jak zmiany strony. Agent wypełnia je
  przy zapisie i po nich odnajduje link, który już się nie otwiera. PAGE nigdy nie podaje dwóch numerów skanu ani
  folio: gdy starsza lokalizacja wymienia inny numer niż pole, obowiązuje w niej pole (sama lokalizacja zostaje), a
  `strom source edit` i `show` proponują resztę lokalizacji. Starsze źródła rozdziela się na pola naraz poleceniem
  `strom source split`: podgląd, czym stałoby się każde (lokalizacja, w której nic nie rozpoznano, zostaje bez zmian,
  do trzech takich pokazuje tak, jak stoją),
  podział zapisuje użytkownik z `--apply` jednym krokiem i jednym się go cofa (`--undo`); agent tylko go proponuje.
  Podział można zrobić także z aplikacji Strom, która go oferuje (funkcja mostu `sources.split`): jej podgląd mówi,
  ile źródeł, podział zapisuje się po kliknięciu użytkownika jednym krokiem według tego podglądu i cofa w całości.
  Folio, skan lub sygnatura usunięte przez użytkownika w aplikacji Strom, która przechowuje te pola, znikają także w
  badaniu (cofa się je z synchronizacją); starsza aplikacja niczego nie usuwa. Gdy lokalizacja nie mówi nic poza folio
  i skanem, które dają już pola, `strom source show` proponuje ją opróżnić, a `strom source edit --locator ""` to
  robi.

- **Drobiazgi.** Fakt, którego weryfikację przesunięto na początek, jest w pliku dla aplikacji Strom oznaczony jako
  zamówiony, więc aplikacja nie proponuje już ponownego przesunięcia. `strom error --note` ukrywa też odmienione
  formy imion i miejsc znanych badaniu (czeskie *z Brna*, *v Praze*). `strom task wait --request` znajduje plik także
  wtedy, gdy jego nazwa jest podana w innej formie Unicode (ścieżka wpisana na Macu, użyta w Windows). To, co jest
  następne – w menu przed `strom run` i w kolejce aplikacji Strom – to kolejność, w jakiej zadania bierze `strom run`:
  gdy przychodzi kolej na opowieść, na początku jest jedna opowieść, nie wszystkie.

## 1.30.1

*9.11.2026 · współpracuje z aplikacją Strom 3.26.0.*

- **Badanie z historią uszkodzoną przez dysk w chmurze można przyjąć takim, jakie jest.** Gdy brakuje najstarszych
  dzienników badania, a jego historii (git) nie da się odczytać (np. badanie, które było w iCloud Drive), `strom
  verify` to mówi i przy każdym zapisie, którego już nie znajduje zapieczętowanego, wskazuje jedną drogę: użytkownik
  przegląda zapisy i we własnym terminalu uruchamia `strom seal accept`. Bez potwierdzenia tylko liczy, co by zrobił;
  po potwierdzeniu pieczętuje zapisy takimi, jakie są, jedną operacją, odkłada uszkodzoną historię na bok
  (`.git-damaged-<kiedy>`, nigdy nie usuwa), zakłada nową i odkłada kopie iCloud (`… 2.lock`). Żaden zapis się nie
  zmienia, nic nie jest usuwane; agent nigdy tego nie uruchamia, a innych wyników kontroli nie przyjmuje. Wcześniej
  każdy zapis i `strom check` zatrzymywały się na uszkodzonej historii, a `strom repair` mógł tylko przywrócić
  starszy stan.

## 1.30.0

*9.11.2026 · współpracuje z aplikacją Strom 3.26.0.*

- **Dane sprawdzane z oryginałem.** Urodzenie, chrzest, ślub, zgon lub pochówek, który cytuje pierwotny zapis, ale
  pozostaje prawdopodobny lub możliwy, agent sprawdzi z tym oryginałem: obejrzy skan i albo podniesie daną do
  udokumentowanej, albo zapisze, dlaczego zostaje bez zmian. Badanie założone wcześniej zostanie po aktualizacji raz
  przejrzane (tylko osoby połączone z drzewem, nikt żyjący; `strom fixes undo verify-originals` to cofa), nowe dane na
  bieżąco. Ręcznie dla osoby, rodziny lub jednej danej, jako pierwsze w kolejce (`strom verify facts <kogo>` lub
  z aplikacji Strom); zbiorczo dla linii, rodu lub całego drzewa z szacunkiem kosztu – uruchomić to może tylko
  użytkownik (`strom verify bulk`); zatrzymać przez `strom verify stop`. Danej, którą użytkownik potwierdzi w aplikacji
  Strom według skanu, agent nigdy nie zmienia – tylko proponuje. Wartość wpisana przez użytkownika lub pochodząca
  z drzewa nigdy nie jest nadpisywana: to, co się różni, jest propozycją do decyzji użytkownika. Ile danych czeka, mówią
  `strom check`, `strom doctor`, `strom stats` i `strom verify status`.
  Potwierdzenie w aplikacji Strom dotyczy wartości, którą użytkownik widział: dana zmieniona od tego czasu nie zostaje potwierdzona.

- **Dane z przejętego drzewa są chronione.** Drzewo z innego programu (GEDCOM) daje wskazówki: agent zmienia taką daną
  tylko według zapisu, który cytuje, a wartość z drzewa zostaje zachowana obok („pierwotnie z drzewa: …”) i można ją
  przywrócić (`strom event revert`, `strom person revert`). Bez cytowanego zapisu – i zawsze, gdy o hipotezach decyduje
  użytkownik – agent tylko proponuje, jako sprzeczność do decyzji użytkownika. Tego, co użytkownik wpisał lub zmienił, w
  aplikacji Strom lub w stromie, agent nigdy nie zmienia: tylko proponuje – również nie przez plik wczytany przez `strom
  sync`. Propozycje agenta są rozpoznawalne w `strom conflict list` i `show` i zamykają się same, gdy proponowana
  wartość już obowiązuje. Badanie założone wcześniej zostanie po aktualizacji raz oznaczone (które dane przyszły z
  przejętego drzewa, które są użytkownika): żadna wartość się nie zmienia, a `strom fixes undo origins` cofa oznaczenia; ile wartości i w ilu rekordach oznaczono, mówi `strom fixes show origins`.
  Propozycja, której wartość zmieniła się od jej powstania (zmienił ją użytkownik), jest nieaktualna: nie można jej
  przyjąć – nic nie zostanie zapisane na nowszej wartości – można ją tylko zamknąć, zachowując wartość. Czego propozycja
  nie uniesie (przyczyna zmieniona razem z datą), mówi wynik synchronizacji, nigdy nie ginie.
  Wartość, która przyszła z drzewem z aplikacji Strom i której nikt od tego czasu nie zmienił, jest chroniona jak wartość użytkownika.

- **Ponownie przejęte drzewo odnajduje swoje osoby.** ID, które program nadał osobom i rodzinom (`_UID`, `EXID`,
  `_FSFTID`… z MyHeritage, Gramps, FamilySearch i innych), są zachowywane: drzewo tego samego programu przejęte ponownie
  (lub z innego programu do badania) odnajduje według nich osoby – nigdy dwa razy, nowe dane dochodzą jako wskazówki;
  nowszy plik drzewa tego samego programu, w którym zmieniło się imię, płeć lub data urodzenia, odnajduje tę samą osobę,
  a to, co się różni, dodaje jako wskazówkę obok danej badania i zgłasza; osoba tylko być może ta sama (plik innego
  programu, inne ID FamilySearch) jest zgłaszana, nigdy łączona ani dołączana do rodziny, w której już jest ta, którą
  może być, a `strom check` wypisuje dwie osoby z tym samym ID z drzewa do porównania i scalenia. ID wracają z badaniem do
  aplikacji Strom. To, czego z pliku się nie przejmuje (media, własne znaczniki programu), jest liczone w wyniku. W badaniu założonym wcześniej ID wcześniejszych importów są odczytywane z ich plików, więc
  także drzewo przejęte ponownie przed oznaczeniem nie dodaje nikogo dwa razy.

- **Problem zgłoszony w jednym pliku.** `strom error` pakuje to, co potrzebne, by poznać, co się stało, do jednego
  pliku ZIP w folderze Pobrane (inaczej w bieżącym folderze): wersję, system, `strom doctor`, agentów, konektory, most
  do aplikacji Strom, badanie tylko w liczbach, logi techniczne z ostatnich 7 dni (`--since`) i polecenia zakończone
  błędem. Nic z drzewa do niego nie trafia – imiona, miejsca, notatki, transkrypcje, skany, ścieżki z nazwą
  użytkownika, logowania i tokeny są pominięte lub zastąpione stałymi kodami – i nic nie jest wysyłane: plik wysyła sam
  użytkownik, na adres podany przez polecenie. `--about fetch|sync|agent|install|windows` dodaje szczegóły jednego
  obszaru (tabela jest w `strom error --help`), `--where` mówi, gdzie problem wystąpił, `--note` opisuje go słowami
  użytkownika (trafia tak, jak została napisana – zastępowane są tylko nazwy znane badaniu); dane wskazanych osób, rodzin lub księgi tylko z `--with-data` i za zgodą użytkownika. Poproszony
  o zgłoszenie problemu agent pyta, gdzie wystąpił, uruchamia polecenie i podaje ścieżkę – pliku nigdy nie wysyła, nie
  otwiera ani nie przepisuje do czatu. W menu: Konserwacja → Zgłosić problem. Badanie jest tylko czytane, także
  uszkodzone.

- **Plik dla aplikacji Strom znów się zapisuje także w badaniu z hipotezą rozstrzygniętą z uzasadnieniem:** dla
  aplikacji od 3.25.0 (lub nieznanej wersji) `strom export gedcom` go odrzucał, a `output/tree-strom.ged` po sesji
  zostawał stary (badania otwartego w aplikacji przez `strom app` to nie dotyczyło). **Śledzenie dużego badania na
  żywo w aplikacji Strom otwiera się dużo szybciej:** drzewo dla aplikacji powstaje raz dla każdego stanu badania i
  zostaje zapisane, także po ponownym uruchomieniu mostu, a podczas śledzenia zmiana jest zgłaszana, gdy jej drzewo
  jest gotowe. Most nie kończy się już, gdy dysk badania jest na chwilę niedostępny, a drugi most tego samego badania
  uruchomiony dodatkowo kończy się od razu, zamiast działać dalej niezauważony.
  Aktualizacja w chwili, gdy strom uruchamia most, nie zostawia już dwóch mostów: zostaje jeden, pod adresem, który śledzi aplikacja.
  Aplikacji, która ma już najnowsze drzewo, nic nie jest wysyłane ponownie.
  Aplikacja, która o to poprosi, dostaje drzewo z obrazami oznaczonymi według ich zawartości i wczytuje tylko te, których jeszcze nie ma.

- **Dana pokazana lub zmieniona w terminalu** (`strom event show`, `strom event edit`) jest wypisywana w języku
  badania. W aplikacji Strom drzewo przejęte do badania nie ma już jako odnośnika całego drzewa pierwszego wiersza z
  niego: każda dana podaje swój.
  **Drzewa z programów dla Windows w stronie kodowej 1250 lub 1252 („ANSI”)** są czytane z właściwymi literami – po
  czesku, po polsku, po niemiecku, tak jak w aplikacji Strom. Znak, którego nie da się odczytać, jest zgłaszany, nigdy
  cicho zastępowany.

- **Codex w aplikacji ChatGPT, jaki jest naprawdę.** Konfiguracja nie mówi tam już o hookach Codexa (to zdanie dotyczy
  Codexa w terminalu), a `strom doctor` radzi potwierdzić je tylko w terminalu. Przeglądarka aplikacji ChatGPT działa
  przez chmurę ChatGPT i nie wywołuje żadnej reguły stroma: strom nie twierdzi już, że jej pilnuje, a agent w niej idzie
  do archiwum z ograniczeniami tylko przez człowieka (`strom task wait --images`). `strom doctor` i konfiguracja mówią
  to jako ostrzeżenie, z radą do okna ChatGPT „przeglądarka w chmurze” przy takim archiwum: *odmówić*, nigdy dostępu do
  wszystkich odpowiednich stron. Codex w terminalu pozostaje pilnowany – teraz także jego przeglądarka otwarta przez
  `createBrowserTab`.

- **Pobieranie skanów księgi, które konektor przerwie błędem,** mówi, których skanów nie pobrało, i podaje polecenie,
  które je pobierze (tylko je – o to, co już przyszło, nie pyta ponownie), kończy się błędem (dotąd zgłaszało sukces),
  a to, co zostało, mówią też `strom fetch --status` i brief; pobieranie, które archiwum po drodze odmówi, kończy się
  jak dotąd, z jego własną radą. **Transkrypcja potwierdzona w aplikacji Strom tuż po północy** ma nowy dzień według
  kalendarza tego komputera (dotąd dzień poprzedni).
  **Budowa konektora:** `strom connector test` ostrzega, gdy jeden skan kosztuje wiele żądań (kafelki), i mówi, czego
  szukać najpierw – linku portalu do całego skanu lub pobrania całej księgi – z czasem, jaki zajęłaby księga w tempie
  archiwum; `strom connector new` cytuje, co strom wie o warunkach archiwum.
  **macOS: aplikacja Strom otwarta z badania** (śledzenie na żywo, plik dla aplikacji) nie zostawia już w Docku wśród
  ostatnio używanych aplikacji ikony Google Chrome: adres trafia prosto do już działającej przeglądarki, okno aplikacji
  otwiera się jak dotąd.
  **Skan, który miała zapisać przeglądarka agenta, a przeglądarka go wstrzymała** (Chrome zapisuje sam jeden plik
  witryny, kolejny dopiero po zezwoleniu na pobieranie wielu plików), jest zgłaszany: „Co czeka“ podaje witrynę, której
  trzeba na to jednorazowo zezwolić w pasku adresu przeglądarki.

## 1.29.0

*8.11.2026 · współpracuje z aplikacją Strom 3.25.0.*

- **Kto rozstrzyga hipotezy: użytkownik czy AI.** Nowe ustawienie badania (`strom config set hypotheses.decide`,
  pytanie konfiguracji początkowej obok innych wyborów, Ustawienia w menu strom, ustawienia badania w aplikacji Strom):
  *rozstrzyga AI* lub *rozstrzyga człowiek*. Gdy rozstrzyga AI, agent sam rozstrzyga hipotezę, gdy
  tylko cytowany zapis potwierdzi jeden wariant, zawsze z wariantem i uzasadnieniem; decyzji użytkownika nigdy nie
  zmienia, a gałąź dziesięciu lub więcej osób spoza drzewa dołącza tylko na podstawie dwóch źródeł bez zastrzeżeń –
  w przeciwnym razie proponuje. Każda jego decyzja jest oznaczona jako decyzja agenta, pojawia się w przeglądzie zmian
  i można ją w każdej chwili zmienić; zmiana ustawienia nie zmienia niczego już rozstrzygniętego. Gdzie nic nie
  wybrano, rozstrzyga AI – także w badaniu założonym wcześniej; powrót do rozstrzygania przez człowieka:
  `strom config set hypotheses.decide person`. Konfiguracja początkowa stroma zaleca rozstrzyganie przez AI i proponuje
  je jako pierwsze, wybrane tam *rozstrzyga człowiek* zostaje zapisane; gdy rozstrzyga człowiek, rozstrzyganie przez AI
  włącza ponownie tylko człowiek, po drugim „tak”.

- **Każdą hipotezę można rozstrzygnąć z menu.** Gdy rozstrzyga użytkownik, „Co czeka“ oferuje także otwarte hipotezy
  bez propozycji agenta – rozstrzygnąć z wariantem i uzasadnieniem albo zostawić otwarte; gdy rozstrzyga AI
  (domyślnie), tylko propozycje agenta. Z przeglądu osoby i z linku aplikacji Strom można rozstrzygnąć każdą hipotezę,
  niezależnie od tego, kto rozstrzyga, a hipotezę rozstrzygniętą lub odłożoną można rozstrzygnąć ponownie
  z uzasadnieniem, wcześniejsza decyzja pozostaje czytelna. Gdy rozstrzyga użytkownik, agent proponuje decyzję
  wszędzie, gdzie zapisy wskazują na jeden wariant.

- **Badanie w aplikacji Strom pozostaje włączone.** Połączenie z aplikacją Strom (most) nie kończy się już samo po
  dwóch godzinach bez zapytań: działa, dopóki nie zostanie wyłączone albo komputer się nie wyłączy (`live.idleMinutes`
  wynosi teraz 0; wcześniej ustawiona wartość pozostaje). Aplikacja Strom dostaje przełącznik przy każdym badaniu
  i wybór w ustawieniach – do wyłączenia komputera albo po dwóch godzinach bez zapytań –, oba zapisywane przez most.
  Wyłączony w aplikacji most pozostaje wyłączony (nowa praca w badaniu go nie przywraca) i zachowuje swój adres, więc
  ponowne włączenie – z aplikacji linkiem stroma albo poleceniem `strom live start` – nie wymaga nowego połączenia.

- **Aplikacje agentów pilnowane tak jak agent w terminalu.** Wbudowana przeglądarka aplikacji agenta przestrzega warunków archiwów tak
  jak przeglądarka agenta w Chrome: archiwum, które wpuszcza tylko przeglądarkę człowieka, bez jego zgody zostaje
  odrzucone z tą samą radą, dozwolone zostaje zapisane i trzyma swoje tempo; strony lokalne nie są ograniczane.
  Polecenia stroma w terminalu aplikacji obowiązują tak samo jak w powłoce (to, co robi tylko człowiek, most aplikacji
  Strom); agent dostaje polecenie uruchamiać stroma przez swoją powłokę. Nic w aplikacji nie jest wyłączane. Terminal
  aplikacji rozpoznaje strom pod każdą jego nazwą – innego kanału, drugiej instalacji, pakiet przez program
  uruchamiający pakiety, ścieżkę do niego. Przeglądarka Codexa (w aplikacji ChatGPT) trzyma się tych samych reguł według
  adresów w jej kodzie, gdy hooki stroma są potwierdzone w Codexie – `strom doctor` i `strom chat` mówią, kiedy czekają;
  kod bez adresu nigdy nie jest odrzucany, tylko zapisywany. Z potwierdzonymi hookami archiwum, które wpuszcza tylko
  przeglądarkę człowieka, wpuszcza za zgodą „przez przeglądarkę” także przeglądarkę Codexa, tak jak przeglądarkę agenta w Chrome
  (`strom net web --check --browser`, `strom doctor`, materiały agenta, aplikacja Strom); bez potwierdzenia bez zmian.
  Computer use pozostaje niepilnowane. Co strom pilnuje u
  którego agenta i aplikacji: `strom doc R12`; agent z computer use dostaje polecenie obsługiwać aplikację Strom przez
  narzędzia strony w przeglądarce, a badania przez strom.

- **Aplikacja agenta bez agenta w terminalu.** strom mówi teraz, co działa, a co nie: rozmowa w aplikacji trwa dalej, praca
  samodzielna, czytanie skanów i praca z aplikacji Strom potrzebują agenta w terminalu – powiedziane, zanim padnie
  jakiekolwiek pytanie lub szacunek kosztu. Ustawienia i `strom doctor --fix` proponują jego instalację (można
  odmówić); `strom doctor` odróżnia przeglądarkę w rozmowie i w pracy samodzielnej. Rozmowa bez niego czyta skany
  własnym czytnikiem skanów stroma.

- **Źródło jest przeczytane przez użytkownika tylko wtedy, gdy je przeczytał, a dana udowodniona tylko z oryginału
  zapisu.** Czytelnikiem jest użytkownik przy transkrypcji wpisanej ręcznie w terminalu lub potwierdzonej w aplikacji
  Strom; to, co pod jego kontem zapisały importy, konwersje i partie, już nie. Dana jest udowodniona tylko z cytowanym
  oryginałem zapisu z informacją pierwotną; bez niego staje się prawdopodobna, a powód zostaje w jej historii, ta zaś,
  którą udowodnił użytkownik, zostaje i czeka w Co czeka na pozostawienie albo zmianę na prawdopodobną (`strom fixes
  review proven-originals keep|lower`). Istniejące badania poprawią się same jeden raz, zmiany są w przeglądzie zmian
  (`strom fixes undo readers|proven-originals` je przywraca). GEDCOM z innego programu nigdy nie czyni użytkownika
  czytelnikiem ani danej udowodnioną. Potwierdzenie w aplikacji obowiązuje dla brzmienia, do którego zostało dane, i
  można je tam cofnąć; z oryginałem zapisu z informacją pierwotną dana może wtedy być udowodniona, inaczej najwyżej
  prawdopodobna.
  **Transkrypcja przeczytana lub potwierdzona przez użytkownika należy do użytkownika.** Zmienia ją tylko własny
  terminal użytkownika lub aplikacja Strom – jakiekolwiek byłoby polecenie (edycja, partia, synchronizacja, poprawka,
  cofnięcie, import). Inne brzmienie od agenta jest zamiast tego proponowane: notatka przy źródle i jedno zadanie dla
  użytkownika na źródło, którego żaden agent nie bierze ani nie zamyka; decyzja w Co czeka, przez link aplikacji Strom
  lub w aplikacji – proponowane brzmienie przyjęte jako użytkownika albo transkrypcja zostawiona, a to samo brzmienie
  nigdy więcej nie proponowane; obie decyzje można cofnąć (wcześniejsza transkrypcja wraca wraz z potwierdzeniem, a
  propozycja znów czeka).

- **Każdy czytelnik dokumentu z własnym agentem, modelem i głębokością rozumowania, a źródło przeczytane ponownie z
  oryginału.** `strom document read|again --agent/--model/--effort` (i `--blind-…` dla czytelnika na ślepo) albo wybór w
  aplikacji Strom; bez wyboru czyta według ustawień badania, nigdy tańszym modelem. Wynik mówi, kto czytał – w
  terminalu, w pliku odczytu i w aplikacji Strom. Źródło czyta się ponownie z oryginału na tym komputerze (`strom
  document read --source S… [--clip …]` albo z aplikacji Strom), a czytelnicy nie widzą transkrypcji; nowy odczyt
  zostaje obok źródła, a gdzie się różni, zadanie zestawia oba brzmienia – transkrypcja, kto ją czytał, i potwierdzenie
  użytkownika zostają bez zmian. Wycinki jednego skanu, które się nakładają lub stykają, czyta się jako jeden widok, a
  słowa transkrypcji spoza przeczytanego wycinka (nagłówek strony nad nim) nie liczą się jako różnica. `strom fixes`
  traktuje odczyt dwóch czytelników jako odczyt pierwszego z nich: czytelnik na ślepo z innym modelem nigdy nie jest
  wcześniejszym modelem, z którym czytać ponownie, a odczyt, którego któryś czytelnik czytał dzisiejszym modelem, liczy
  się jako nim przeczytany. Ponowne czytanie z oryginału czyta najlepiej, jak się da. Czytelnicy dostają to, co badanie
  wie o zapisie – rodzaj, język, datę i miejsce w księdze, nigdy jednak transkrypcji ani imienia czy nazwiska –, a
  czytelnik z modelem GPT także polecenie, by przepisać wpis w środku wycinka, pominąć sąsiednie wpisy z krawędzi i
  zachować pierwotną pisownię litera po literze. Z transkrypcją porównuje się tylko wpis źródła (ten, który czytelnik
  oznaczy, w przeciwnym razie ten, który najbardziej leży w wycinku); nagłówki kolumn bez odpowiednika („Dies:“,
  „Vater:“), własny nagłówek badania nad zapisem, uwagi badania lub czytelnika w nawiasach, długie ſ wobec s,
  nieczytelne miejsce wobec niczego i słowa poza tym, co przeczytali obaj, nie liczą się jako różnica. Aplikacja Strom
  dostaje w wyniku czytania, który wpis jest wpisem źródła, cały tekst ślepego czytelnika, ostrzeżenie, gdy czytelnicy
  określili inny rodzaj zapisu (ślub × chrzest), a gdy porównania nie da się zapisać do badania – na przykład przy
  badaniu zapieczętowanym na innym komputerze –, mówi się to zamiast cichego pominięcia. Czytelnicy z modelem GPT
  (Codex, OpenCode) widzą mały wycinek powiększony do około 2000 px (najwyżej trzykrotnie), także gdy czytanie skanów
  dostrojono do mniejszego rozmiaru (dostrojenie mierzy całe strony i połowy, nigdy mały wycinek), pozostali jak dotąd;
  zarejestrowana ostrzejsza część obrazu, która pokazuje całe miejsce – albo cały wycinek, pomijając tylko jego margines –, zostaje użyta, a gdy miejsce jest na skanie małe,
  proponuje się pobranie ostrzejszego wycinka z archiwum – nigdy nie dzieje się to samo. Czytelnik Codex działa bez
  programu powiadomień, wtyczek, aplikacji, hooków i pamięci z ustawień Codexu oraz bez przeglądarki i sterowania
  komputerem jego aplikacji; ustawienia Codexu się nie zmieniają.
  Model, którego zainstalowana wersja Codex CLI nie ma, kończy odczyt jako błąd czytelnika z tym powodem i z nim
  zatrzymuje się też przebieg stromu: zaktualizować Codex (`npm install -g @openai/codex@latest`) albo wybrać inny model;
  modele z katalogu pobranego przez nowszy Codex niż zainstalowany są oferowane z uwagą.
  Odczyt zlecony z aplikacji Strom jest przyjmowany od razu, nawet gdy jego zakolejkowanie trwa dłużej (badanie trzyma
  inny proces): od pierwszej chwili widać go jako zakolejkowany pod jego ID i pod nim jest odczytany, a odczyt, którego
  potem nie da się zakolejkować, widać jako nieudany, z powodem; to samo źródło zlecone w międzyczasie ponownie jest
  odrzucane jako właśnie czytane.
  Wybór modelu badania (kreator ustawień, Ustawienia w menu stroma) przy
  Opusie, Sonnecie i własnym domyślnym modelu agenta podaje model, na którym ostatnio działał, gdy któreś badanie
  na tym komputerze widziało go w działaniu – „Opus (teraz Opus 5.5)”; `strom doctor` i ustawienia mówią to przy
  zapisanym modelu, a aplikacja Strom dostaje to z wyborem czytelników. Nieznany – jak dotąd. Zapisany zostaje Opus
  albo Sonnet, więc nowszy model jego linii zostanie użyty sam; stała wersja wpisana ręcznie (`strom config set model.lead
  <model>`) jest proponowana jako wybrana teraz i pozostaje stała.
  Odczyt, którego czytelnik na ślepo nic nie przeczytał (zawiódł albo skończył bez wpisu), jest odczytem samego
  pierwszego czytelnika, jak odczyt jednego czytelnika – nigdy nie mówi się, że każdy wpis się różni. Aplikacja Strom
  dostaje przy każdym miejscu, gdzie dwa odczyty się różnią, jaki to rodzaj różnicy – rzeczowa (imię lub nazwisko,
  liczba, data, osoba, miejsce nieczytelne) albo drobiazg (pisownia, skrót, interpunkcja, etykieta, wielkość liter) –, i
  gdzie jest każdy czytelnik: czeka, czyta, skończył w tylu sekundach albo zawiódł, także któremu czytelnikowi odrzucono
  model.
  **Źródło przeczytane ponownie: co dalej, wybiera użytkownik.** Zadanie powstaje tylko z danej merytorycznej, którą
  obaj czytelnicy odczytują wobec transkrypcji tak samo (imię, liczba, data, osoba, słowo, którego transkrypcja nie
  odczytała) – nigdy z drobiazgów (pisownia, skrót, interpunkcja), z miejsca, w którym czytelnicy się różnią lub które
  oznaczają jako nieczytelne, ani z miejsca ocenionego już we wcześniejszym zadaniu. Zadanie mówi, kto czytał (agent ·
  model · głębokość), że dwaj czytelnicy tego samego modelu to słabszy dowód, i że odczyt jest tylko wskazówką:
  transkrypcja zmienia się tylko tam, gdzie pokazuje to sam skan. Nowe ustawienie `read.sourceTask` mówi, co dalej:
  *pytać* (domyślnie) – odczyt zostaje przy źródle jako niesprawdzony, dopóki użytkownik nie wybierze: przejrzeć go z
  agentem od razu, dodać do kolejki albo tylko zapisać (w terminalu zaraz po odczycie, później `strom source reading
  S…` lub w aplikacji Strom); *zawsze* – zadanie od razu; *nigdy* – bez zadania. Jedno źródło ma naraz jedno zadanie
  swoich odczytów. Odczyt bez faktu do rozstrzygnięcia, tylko z miejscami, których czytelnicy nie są pewni, sam nie
  tworzy zadania – nawet przy *zawsze*; tylko na słowo użytkownika (`strom source reading S… --take queue --unsure`
  lub w aplikacji Strom) agent dostaje zadanie obejrzenia każdego takiego miejsca na skanie: gdzie skan pokazuje to
  pewnie, transkrypcja poprawiona z powodem, gdzie indziej notatka przy źródle. Transkrypcji potwierdzonej przez
  użytkownika agent nigdy nie zmienia: miejsca odczytane przez nowy odczyt są zamiast tego proponowane użytkownikowi
  do oceny (`--take review --unsure`).

- **Ponadto:** pomoc podaje wartości każdego ustawienia z wyborem i wyjaśnia obie możliwości tego, kto rozstrzyga
  hipotezy; `strom help --human` wymienia każde polecenie uruchamiane tylko przez człowieka. Zgoda na archiwum dana w
  badaniu poza folderem badań aktualizuje też instrukcje agenta tego badania, a podana witryna (example.org) obejmuje
  też adresy, których używają księgi badania. Warunki Archiwum Głównego Akt Dawnych w Warszawie według odpowiedzi
  archiwum: skany do swobodnego użytku, każdy cytowany miejscem oryginału – archiwum, zespół, sygnatura, strona lub
  karta. Sprzeczność zapisana w partii z etykietą źródła (`--claim "@s: …"`) cytuje teraz to źródło; taka, którą tak
  zapisała starsza wersja, pokazuje wartość bez surowej etykiety i tam, gdzie da się to rozpoznać, cytuje swoje źródło
  w aplikacji Strom i w GEDCOM-ie. Zakończona rozmowa nie pozostaje już w aplikacji Strom „przy pracy“, także na
  obciążonym komputerze i po zmianie nazwy komputera. Miejsce zapisane w zdaniu („w Lhocie nr 12“) nie zachowuje już
  przyimków: kontrola proponuje miejscowość tak, jak badanie zapisuje ją gdzie indziej, a rekord miejsca nie dostaje
  już nazwy w rodzaju „w Lhocie w“ – takie nazwy zapisane wcześniej zostają jednorazowo poprawione (cofnięcie: strom
  place undo).
  **Nakładające się wycinki jednego obrazu są jednym.** Dwa wycinki tego samego obrazu zaznaczone przez badanie,
  nakładające się co najmniej o 30 % mniejszego z nich, łączą się w jeden obejmujący oba (wycinek prawie cały wewnątrz większego – szczegół, wpis obok całej strony –
  zostaje); wycinki zaznaczone przez
  użytkownika zostają. We wcześniejszym badaniu nakładające się wycinki łączą się raz, każde połączenie zapisane w
  historii; transkrypcja i potwierdzenie użytkownika zostają.
  **Zadanie w kolejce z aplikacji Strom.** Link aplikacji do zadania w kolejce pokazuje je (co, dlaczego, kiedy
  gotowe) i proponuje przejrzeć je z agentem od razu (z tym, ile podobne zadania trwały tutaj), przesunąć je w kolejce
  do przodu albo je zostawić. `strom doctor` mówi, dlaczego droższa zmiana strojenia na rzecz dokładności zostaje, a
  plik hooków Codexa, którego tylko brakuje lub jest nieaktualny, nie jest już ostrzeżeniem – zapisze się ponownie, gdy
  strom następnym razem uruchomi agenta.

## 1.28.0

*6.11.2026 · współpracuje z aplikacją Strom 3.24.0.*

- **Jak działa Strom – w samym stromie: `strom doc`.** Dokumentacja aplikacji i badań po czesku, angielsku, niemiecku i
  polsku jest częścią stromu i czyta się ją także bez internetu: `strom doc` wypisuje rozdziały, `strom doc R10.1` jedną
  regułę wraz z tym, dlaczego tak jest, `strom doc <słowa>` szuka w tytułach, indeksie pojęć i tekście (bez względu na
  znaki diakrytyczne i wielkość liter). Każda reguła ma link do tej samej strony na stromapp.info. Na pytanie, jak lub
  dlaczego Strom coś robi, agent odpowiada według niej z numerem reguły. Pomoc dla człowieka (`strom help --human`)
  do niej odsyła.

- **O hipotezie decyduje tylko użytkownik.** Agent nie rozstrzyga już sam między konkurencyjnymi wyjaśnieniami:
  proponuje wariant z uzasadnieniem, a hipoteza czeka w menu stromu w „Co czeka” – rozstrzygnięta zgodnie z propozycją,
  inaczej albo pozostawiona otwarta. To, co decyzja łączy, agent zapisuje w drzewie w następnej sesji. Hipotezy
  rozstrzygnięte wcześniej pozostają bez zmian. Hipotezę, której warianty mówią, co by połączyły, rozstrzyga się tylko
  ze wskazanym wariantem.

- **Indeks to wskazówka, nigdy dowód.** Fakt, który cytuje tylko indeks, pozostaje wskazówką, dopóki nie zostanie
  odczytany i zacytowany sam wpis – tak jak przy drzewie genealogicznym czy wspomnieniu.

- **Tłumaczenie obok transkrypcji.** Wpis w innym języku lub piśmie niż język badań – łacina, kurrenta, niemiecki,
  cyrylica – otrzymuje obok dosłownej transkrypcji tłumaczenie na język badań.

- **Gdzie pracuje agent – dla mapy aplikacji Strom.** Podczas pracy agenta strom podaje aplikacji, do którego miejsca
  należy księga, którą agent bada – parafia lub wieś jej wpisów, nigdy archiwum – aby aplikacja mogła je pokazać na
  mapie podczas śledzenia pracy. Gdy badania tego nie wiedzą, nic nie podają, a aplikacja pozostaje przy miejscach
  osoby. Praca nad rodziną podaje parę – męża, a jeśli go brak, żonę – oraz samą rodzinę, aby aplikacja mogła skupić
  się na parze.

- **DigiArchiv Archiwum Państwowego w Třeboniu:** jego warunki, tak jak potwierdziło je archiwum – ręcznie tylko wybrane
  skany, nigdy cała księga, żadnych narzędzi do pobierania – i jak cytować stały link do skanu.

- **Lista przed uruchomieniem pokazuje, co weźmie agent.** W pozycji „Pozwól agentowi pracować samodzielnie“ wśród
  zadań w kolejności, w jakiej bierze je agent, są teraz także zadania historii miejsc, gdy przychodzi ich kolej –
  miejsca danych najpierw –, oznaczone jako historia.

- **Warunek przebiegu w jednym wierszu.** Co odpowiedział warunek (`run.gate`), jak jest pytany – przed każdą sesją
  albo raz przy zadaniach uruchomionych ręcznie – i jego pułap są podane przed pierwszą sesją w jednym wierszu, nie w
  trzech. Agent, który czyta strony internetowe przez własnego pomocnika, nie jest już zgłaszany jako
  pozbawiony narzędzia do czytania stron; narzędzie, którego naprawdę brak, jest podawane w języku badań.

## 1.27.0

*5.11.2026 · współpracuje z aplikacją Strom 3.23.0.*

- **Skany zapisane ręcznie same przywracają swoje zadanie.** Tam, gdzie skany archiwum zapisuje się ręcznie – archiwum,
  do którego wolno tylko przeglądarce człowieka, albo takie, którego warunki nie pozwalają na nic innego – badanie
  prosi o księgę i numery skanów i przygotowuje na nie folder w skrzynce (inbox). To, co się tam zapisze, zostaje
  przejęte samo: od razu, gdy działa most do aplikacji Strom, inaczej przy starcie następnej sesji; pliki nazwane
  inaczej według kolejności, gdy jest ich tyle, ile brakuje skanów. Zadanie wraca do kolejki, gdy są tam wszystkie
  skany; przy części z nich „Co czeka“ pokazuje, ile zapisano z ilu i których brakuje. Księga takiego archiwum nie
  uchodzi już za swobodnie do pobrania, a badanie nie proponuje dla niej budowy pobieracza – także księgi i oczekiwania
  ze starszych wersji, bez przepisywania czegokolwiek.

- **Na to, co czeka, można odpowiedzieć z aplikacji Strom, a skany, na które czeka zadanie, z niej wysłać.** Odpowiedź
  napisana w aplikacji przywraca zadanie do kolejki tak samo jak odpowiedź w terminalu; zapisuje się w całości, z
  adnotacją, że przyszła z aplikacji. Zadanie, które w międzyczasie czeka na coś innego, pozostaje bez zmian. Skany, na
  które czeka zadanie, trafiają z aplikacji prosto do niego: numerowane według obrazu wskazanego przez aplikację,
  inaczej według nazwy pliku, inaczej według kolejności brakujących; PDF strona po stronie. Skan o numerze, który
  badanie już ma, zostaje odrzucony, chyba że ma go zastąpić – poprzedni zostaje wycofany i zachowany, nigdy usunięty.
  Skan taki sam jak inny, już przejęty obraz zostaje odrzucony ze wskazaniem, z którym jest taki sam; nic nie zostaje
  przejęte. Są przejmowane tak samo jak obrazy zapisane ręcznie, a zadanie wraca, gdy są już wszystkie. Strona z jedną
  księgą zadania pokazuje też swój folder i ile ma obrazów. Strony jednego archiwum – na przykład archiwum cyfrowe i
  czytelnia jednego archiwum krajowego – czekają w jednym miejscu pod nazwą archiwum, z jego adresem.

- **Agent trzyma się z dala od mostu.** To, co aplikacja Strom wysyła przez most, należy do człowieka. Hooki agenta
  odrzucają polecenie lub pobranie strony, które odczytuje adres mostu lub go wywołuje, a agent nigdy nie poznaje
  tajnego adresu.

- **Przeglądarka agenta podlega tym samym zasadom co jego pobieranie stron.** Każda strona, którą agent otwiera w
  Chrome, jest liczona i spowalniana razem z jego innymi żądaniami do tej samej witryny; witryna, której warunki
  zabraniają automatyzacji, taka, która odmówiła, ścieżka zablokowana w jej robots.txt i most pozostają dla niego
  zamknięte. Archiwum, do którego wolno tylko przeglądarce człowieka, otwiera się dla niego tylko za zgodą człowieka
  „przez przeglądarkę”, strona po stronie, w tempie człowieka. Zgoda… w aplikacji Strom przy tym, co czeka na skany
  takiego archiwum, otwiera to pytanie, także tam, gdzie żaden program do pobierania nie sięga archiwum. Przeglądarka
  lub sterowanie komputerem innego agenta – Codexa, Antigravity – nie ma takiej kontroli: agent nie wchodzi z nią do
  takiego archiwum sam z siebie, a skany zapisuje człowiek ręcznie. `strom doctor`, brief agenta i Co czeka mówią raz, z
  jakim agentem i rozszerzeniem przeglądarki agent zapisałby je sam, albo że brakuje rozszerzenia. Nic nie jest
  wyłączane: przeglądarki i sterowania komputerem aplikacji desktopowych agentów badanie nie pilnuje i ich nie poleca –
  pilnuje przeglądarki agenta w Chrome, a innej agent używa tylko wtedy, gdy człowiek wyraźnie o to poprosi. `strom
  doctor` i brief agenta mówią to wprost, a agent nigdy nie pracuje w kopii badania, którą aplikacja desktopowa agenta
  otwiera we własnym worktree. Aplikacja Strom dowiaduje się od mostu, czy przeglądarka agenta jest gotowa, brakuje
  rozszerzenia, czy agent nie ma żadnej, którą badanie pilnuje.

- **Przeglądarka agenta sama zapisuje skany, po jednym.** Tam, gdzie człowiek zezwoli archiwum, do którego wolno tylko
  przeglądarce człowieka, na dostęp „przez przeglądarkę”, agent otwiera w Chrome jeden skan i zapisuje to, co pokazuje
  przeglądarka skanów archiwum – nigdy więcej, niż ona daje, nigdy większy niż oryginał, w tempie człowieka. Zapisuje
  tylko skan, który karta pokazuje pod jego własnym adresem – przeglądarka przewinięta na inny skan zostaje odrzucona i
  nic się nie zapisuje. Badanie przejmuje zapisany plik z folderu pobranych plików do folderu zadania pod jego numerem,
  a zadanie wraca, gdy są tam wszystkie jego skany. Zgodę można teraz dać także takiemu archiwum z listy badania, do
  którego nie prowadzi żaden pobieracz. Pobieracz archiwum, którego przeglądarka pokazuje skany w kafelkach, również
  zapisuje przez tę przeglądarkę, także część skanu; stronę księgi otwiera raz i nigdy jej nie odświeża. Sprawdzenia,
  czy przy komputerze jest człowiek, agent nigdy nie przechodzi. Archiwum, którego robots.txt nie wpuszcza żadnych
  robotów na cały serwis, uznaje się za takie, dokąd wolno tylko przeglądarce człowieka. To, co lista archiwów badania
  zostawia w rękach człowieka, nadal zapisuje się ręcznie – ścieżka do zapisów zamknięta w robots.txt dla wszystkich
  robotów, imienny zakaz dla agentów AI (jak w eBadatelnie SOA Praha), warunki, które nie pozwalają na nic innego, albo
  przeglądarka skanów, która bierze je z serwera obrazów zamkniętego dla wszystkich robotów.

- Warunek samodzielnej pracy agenta, który nie uruchomiłby zadań uruchomionych ręcznie, pada raz, potem już tylko
  „Uruchomić mimo to?”. Warunek tygodnia subskrypcji podaje wykorzystanie w tygodniu wobec tego, na co dotąd pozwolono,
  i jak jest liczone. `strom help --human` wymienia kolejność zadań, pracę poza liniami, poprawki i pozostawienie
  sprzeczności wśród poleceń człowieka. Badanie z OpenCode toczy się dalej po sesji, którą OpenCode poprawnie zamknął,
  ale zgłosił jako nieudaną, oraz po przejściowym błędzie sieci – ta sama sesja zostaje wznowiona po krótkim
  oczekiwaniu, w ramach czasu sesji. Gdy sandbox Codexa nie dopuści strom do badań – także w potoku, a w Windows
  także przy poleceniu podanym przez PowerShell – albo gdy polecenie strom odrzucą już reguły Codexa, zanim się
  uruchomi (w Windows strom w potoku lub po `;`), badanie od razu się zatrzymuje z tym, co pozostaje wyborem
  człowieka, a taka sesja nigdy
  nie odkłada zadania. Dziękujemy za zgłoszenie na GitHubie. Zmiana odczytu skanów, którą badanie wprowadziło samo i po
  której odczyty stały się wyraźnie mniej pewne, zostaje od razu cofnięta – już nie dopiero po 60 dniach – a `strom
  recent` to podaje.

- Badanie zna więcej archiwów Czech, Niemiec i Polski wraz z ich warunkami – na co każde pozwala narzędziom
  automatycznym, jego tempo i dokąd wolno tylko przeglądarce człowieka. Nowe wśród nich: archiwa miejskie Brna i
  Ostrawy, Wojskowe Archiwum Centralne w Pradze, Arcinsys Hesji, Dolnej Saksonii i Bremy oraz Szlezwika-Holsztynu,
  invenio i księga pamięci Archiwum Federalnego (tylko przeglądarka człowieka), galerie ksiąg metrykalnych dawnych ziem
  wschodnich w AGAD, LubGens (tylko przeglądarka człowieka) oraz indeksy polskich towarzystw genealogicznych. Pięć
  kolejnych czeskich, dokąd wolno tylko przeglądarce człowieka: Acta Publica Morawskiego Archiwum Krajowego (jego skany
  już nie przez program do pobierania, nawet ze zgodą wydaną wcześniej – pozostaje, jak została dana; przez przeglądarkę
  co najmniej 4 sekundy odstępu), eBadatelna SOA Praha oraz serwery obrazów SOA Litoměřice, ZA Opava i meldunków
  policyjnych Archiwum Narodowego (tylko ręcznie). Cyfrowe czytelnie SOA Litoměřice i ZA Opava biorą skany z tych
  serwerów, więc i ich skany zapisuje się ręcznie – zgody „przez przeglądarkę” się tam nie proponuje. Przy zadaniu,
  które już czeka na takie skany, mówi się tylko, że czeka na skany zapisane ręcznie, bez nowej rady co do czekania.
  Program do pobierania zrobiony wcześniej dla takiego archiwum zostaje odrzucony przed jakimkolwiek żądaniem, także
  jego próba, i mówi, co zostaje: zgoda człowieka „przez przeglądarkę” albo zapis ręczny.

- Wraz z całym 1.26.1: przerwany zapis już nie blokuje badania na stałe.

## 1.26.1

*4.11.2026 · współpracuje z aplikacją Strom 3.22.0.*

- **Przerwany zapis już nie blokuje badania na stałe.** Polecenie zatrzymane między `git add` a commitem (zakończone
  przez agenta albo w Windows z indeksem gita trzymanym przez inny program) mogło zostawić swoje pliki w indeksie gita:
  każdy kolejny zapis kończył się komunikatem „dane badania zmieniły się poza strom”, choć `strom verify` ani `strom
  repair` nic nie znalazły. Nowe pliki, które taki zapis zostawia w indeksie (nie ma ich już w folderze, w historii
  nigdy nie były), nie są niczyją zmianą – następny zapis sam je wycofa i działa dalej. `strom repair` zawsze przywraca
  cały indeks do zapieczętowanego stanu, także ze zmianą rekordu, która w nim została. Blokadę zostawioną przez git
  przerwany w trakcie pracy (`.git/index.lock`, starszą niż 10 minut) `strom repair` usuwa, a zapis, który na niej się
  kończy, mówi o tym. Rekord naprawdę usunięty lub zmieniony poza strom jest zgłaszany jak dotąd.

## 1.26.0

*4.11.2026 · współpracuje z aplikacją Strom 3.22.0.*

- **Linie badania z aplikacji Strom: założyć, zmienić, wstrzymać, uporządkować.** Linię można w aplikacji założyć lub
  zmienić (osoba, kierunek, pytanie, granice), wstrzymać, zakończyć lub wznowić; kolejność linii to kolejność pracy, a
  strona na telefon przesuwa linię w górę lub w dół i ją wstrzymuje. Praca poza liniami – boczna gałąź, do której nie
  sięga żadna linia, na przykład siostra przodka i jej rodzina – przychodzi teraz czasem, jedno zadanie na dziesięć
  sesji, a nie tylko na końcu. Każda taka gałąź może mieć własny wybór (czasem, na końcu, jak praca linii, nigdy albo
  dodana do linii), a dla rosnącej gałęzi w „Co czeka” proponowana jest linia: dodać do linii, założyć dla niej linię,
  zostawić bez zmian albo nie badać. Mąż lub żona przodka należą do linii przodka, a linia z pytaniem obejmuje swoją
  osobę. Każde zadanie można wziąć od razu lub przenieść na koniec, a każde zadanie w kolejce mówi, dlaczego stoi tam,
  gdzie stoi. W terminalu: Ustawienia → Samodzielna praca agenta → Praca poza liniami, `strom offline`, `strom task
  order`.

- **Opowieść napisana na nowo niczego nie traci.** Gdy badanie pisze opowieść od nowa – więcej danych, lepszy odczyt,
  opowieść przejęta ze starszego badania – każda dana, źródło i link poprzedniej wersji zostają albo odchodzą tylko
  celowo z powodem, zapisanym przy opowieści. Źródła, na których opiera się opowieść, są przy niej widoczne, tytuł i
  adres pod każdą daną, także gdy tekst ich nie wymienia, również źródło, które tekst wymienia tylko kodem; aplikacja
  Strom dostaje je z opowieścią. Dana z poszlaki mówi w tekście, skąd pochodzi.

- Duże drzewo przejęte w systemie Windows (około 1500 osób i więcej) nie kończy się już błędem gita o zbyt długim
  poleceniu (ENAMETOOLONG) bez żadnej zapisanej danej: wszystko, co przejęte, zostaje zapisane.

- Przy dużym badaniu (setki zadań w kolejce, wiele spraw czekających) aplikacja Strom nie zgłasza już, że badanie nie
  odpowiada, gdy pracuje jego agent: połączenie oblicza stan badania raz dla każdej zmiany, osobno, a aplikacji
  odpowiada w tym czasie od razu – także podczas codziennego porządkowania, szukania poprawek strom, czytania historii
  po każdej zmianie i przygotowania przeglądu dla widżetu na pulpicie.

- Opowieść i notatka trafiają do aplikacji Strom ze spacjami takimi, jak zostały zapisane: dwie spacje między
  słowami ani spacja nierozdzielająca lub wąska nie zamieniają się już w jedną zwykłą.

- **To, o czym decyduje użytkownik, pozostaje jego decyzją.** O sprzeczności badania ze zmianą z aplikacji Strom,
  o zatwierdzeniu opowieści lub jej nowej wersji i o odpowiedzi dla rosnącej gałęzi decyduje tylko użytkownik – w
  aplikacji albo w Co czeka; agent zostaje odrzucony i mówi tylko, że to czeka. Cofnięcie tego, co wysłała aplikacja lub
  co zsynchronizowano (`strom sync undo`), i odrzucenie czekającego drzewa również należy tylko do użytkownika. „Zostaw
  agentowi” w aplikacji przekazuje mu taką sprzeczność; strona wybrana w aplikacji jest w terminalu tylko potwierdzana,
  powód jest nieobowiązkowy. Identyfikacja miejsc: „Nie wiem” odpowiada też na sprzeczność położenia i na propozycję
  zapisu nazwy, a „Zawsze pierwszy kandydat (A)” przyjmuje kandydata także przy sprzeczności – nigdy ponad współrzędne
  wpisane ręcznie. Terminal mówi słowami aplikacji: wskazówka, udokumentowane, obalone, Nie wiem, Żaden z nich, te same
  wybory strony. Taką sprzeczność, o której wcześniej zdecydował agent, znajduje `strom fixes show edit-decisions` i
  otwiera ją ponownie dla użytkownika; decyzja agenta zostaje w notatce (`strom fixes undo edit-decisions` ją
  przywraca).

- **Warunek tygodnia subskrypcji przyjmuje liczby całkowite od 0 do 99 i trzyma pułap.** Menu i `strom config set`
  odrzucają ułamek i 100 (wcześniej zapisywały je, a potem każdy przebieg się kończył), a menu zachowuje ustawiony
  pułap; z pułapem trwająca sesja dostaje prośbę o zakończenie, gdy tydzień osiągnie pułap, nie dopiero przy 99 %.
  Zadanie odłożone do daty wraca tego dnia, jak teraz mówi też pomoc. Przychodzące skany budzą tylko zadania czekające
  na tę księgę – nigdy sprawdzenia strony przez człowieka, a list tylko wtedy, gdy czeka na tę księgę.
  Zadania obudzone tak wcześniej znajduje `strom fixes show woken-waits` i znów czekają tak, jak czekały.

## 1.25.2

*3.11.2026 · współpracuje z aplikacją Strom 3.21.2.*

- **Warunek tygodnia subskrypcji nie kończy już przebiegu z powodu jednej nieodczytanej odpowiedzi.** Pyta ponownie,
  potem czeka kwadrans i podaje, co otrzymał. Niezalogowany agent jest zgłaszany już przed pierwszą sesją, ze sposobem
  logowania; domyślny folder agenta podany w środowisku jest pomijany, więc agent zostaje przy swoim zwykłym logowaniu.
- **Identyfikacja miejsc: sprawdzenie zapisuje to, co ustali, w rekordzie miejsca.** Dawne nazwy i pisownie, inne formy
  miejsca w danych i błędna parafia (usunięta wraz z powodem) trafiają do rekordu także tam, gdzie współrzędne podała
  osoba, nigdy tylko do historii. Forma blisko miejsca, które ma już rekord, zostaje odrzucona ze wskazaniem, jak ją
  do tego rekordu dodać; dwa rekordy jednego miejsca można scalić. Na pierwszym miejscu jest dzisiejsza nazwa
  (miejscowość dziś w Polsce po polsku, niemiecka nazwa jako historyczna). Pytanie o miejsce nigdy nie odbiera osobie
  jej współrzędnych. Miejsca już zidentyfikowane zostają raz same poprawione (nazwy zapisane z językiem i latami jako
  tekst, dzisiejsza nazwa pierwsza, współrzędne osoby, dawne nazwy tylko w historii), a krok można cofnąć.
  Podsumowanie sesji o miejscach zaczyna się od tego, co zrobiono – zidentyfikowano, potwierdzono, z pytaniem, nie
  odnaleziono – a jedna sesja bierze więcej miejsc z sąsiednich obszarów. Z „w Lhocie w nr 12” nie zostaje już
  miejsce „w Lhocie w”: miejscem jest miejscowość tak, jak badanie zapisuje ją gdzie indziej, także gdy zdanie ją
  odmienia. Każda nazwa trafia do rekordu miejsca tylko raz.
- **Kolejka miejsc opróżnia się, gdy miejsca są załatwione.** Miejsce zidentyfikowane, sprawdzone, przekazane jako
  pytanie albo nieustalone opuszcza kolejkę ze wszystkimi swoimi formami, także z tą, którą fakty zapisują teraz
  inaczej; miejsca, które sesja już zrobiła, nie są brane ponownie, a liczba oczekujących się zgadza. To, co w kolejce
  zostawiła wcześniejsza wersja, usuwa się samo (tylko załatwione miejsca, krok można cofnąć); sprawdzenie zlecone dla
  miejsca czekającego na identyfikację zostaje jako sprawdzenie, a sprawdzenie czekające przy formie, którą fakty
  zapisują teraz jako inne miejsce, przechodzi z nimi do tego miejsca. Każdy krok przy miejscach można cofnąć jego własnym
  numerem, także gdy czeka inny (również odpowiedzi osoby). Błędną nazwę w rekordzie miejsca — pomyłkę z zapisu, której
  żaden fakt już nie zapisuje, nazwę innego miejsca — można usunąć z uzasadnieniem (`strom place names L… --drop`);
  sesja nad miejscami widzi pozostałe nazwy rekordu z językiem i latami; sprawdzenie może podać źródło, na którym się
  oparło; przynależność można podać także dla jednego roku.
- W sprzecznościach zmian z aplikacji numer domu, który ma już oznaczenie, nie dostaje go po raz drugi („nr domu nr
  domu 12”), a myślnik w tytule zależy od języka badania.
- Plan tego, co agent zrobi dalej, nie przerywa się już na oczekującej opowieści o parze: podaje oboje partnerów.

## 1.25.1

*3.11.2026 · współpracuje z aplikacją Strom 3.21.1.*

- **Warunki archiwów sprawdzone ponownie, doszły źródła polskie.** Warunki i robots.txt każdego archiwum, które zna
  strom, zostały 3 listopada 2026 przeczytane na nowo. eBadatelna SOA Praha nie wpuszcza już żadnych robotów do swoich
  skanów (jej robots.txt z 2 listopada): jej obrazy tylko przez przeglądarkę osoby, tak jak w archiwum w Třeboniu,
  które teraz odrzuca zapytania stromu. Warunki Porta fontium są zacytowane (po jednej stronie, do własnych badań,
  ze wskazaniem źródła i adresu). Nowe: Skanoteka PTG (minuta między zapytaniami), GenBaza, BaSIA, Genealogia
  w Archiwach, litewskie Metrikai oraz archiwa we Lwowie, Żytomierzu i Równem (za sprawdzeniem robota lub zamknięte
  dla agentów AI: tylko przeglądarka osoby), Polona i Śląska Biblioteka Cyfrowa (domena publiczna), Małopolska
  Biblioteka Cyfrowa (tylko na własny użytek, nigdy masowo), a dla miejscowości w Polsce nazwy z PRNG Geoportalu
  i Słownik geograficzny, z własnym wyszukiwaniem.
- **Polskie teksty poprawione; skopiowane polecenie działa.** Polskie menu, komunikaty, instalator i te notatki
  zostały przejrzane: wszędzie te same pojęcia co w aplikacji Strom 3.21.1 (Księga rodu, półpauzy), poprawiona
  gramatyka i formy liczby mnogiej; daty jak w aplikacji, bez zer na początku (3.11.2026), a miesiąc w przypadku,
  którego wymaga przyimek (przed majem 1880). Polecenie
  `strom unpack "…"`, pokazywane po spakowaniu badań lub przed ich usunięciem, ma teraz we wszystkich językach
  proste cudzysłowy, więc po skopiowaniu działa.

## 1.25.0

*3.11.2026 · współpracuje z aplikacją Strom 3.21.0.*

- **Po polsku.** Badanie mówi po polsku: menu, jego komunikaty, to, co zapisuje w badaniu, instalator i strona
  telefonu; notatki i role w pliku dla Stromu są po polsku. Polski system jest rozpoznawany automatycznie, w przeciwnym razie
  `strom config set lang pl`. Pomoc dla agenta pozostaje po angielsku.
- **Widżet Strom także w systemie Windows i otwiera osobę.** Badanie zapisuje teraz to, co pokazuje z niego widżet Strom (nad czym
  trwa praca, ustalenia z ostatnich 24 godzin, co czeka), także w systemie Windows, do `%USERPROFILE%\.config\strom\widget`,
  ze znacznikiem programu strom, który je zapisał. Widżet czytający swój plik nigdy nie wstrzymuje mostka.
  `strom uninstall` usuwa także pliki widżetu, również na Macu; badanie i ustawienia zostają.
  Wiersz lub ustalenie widżetu Strom dotyczące jednej osoby otwiera tę osobę w aplikacji
  Strom (jej stronę, drzewo wokół niej), a to, co czeka, otwiera „Czeka na decyzję” badania (aplikacja, która jeszcze tego nie
  potrafi, otwiera drzewo jak dotąd).
- **Numery domów po nazwie wsi.** Miejsca zapisane jako nazwa z samym numerem (`Lhota 16`) można teraz także
  poprawić (`strom fixes run street-places`): miejscem staje się gmina, a numer – numerem domu w niej; tylko gdy człowiek
  potwierdzi, osobno dla każdej gminy, że jej numery to domy, a wcześniej zobaczy dane, które to zmienia. Części
  miasta z numerem (`Praha 5`) nigdy nie są proponowane. Odpowiedź jest zapamiętana w badaniu, a
  `strom fixes undo street-places` przywraca wszystko.
- **Powrót w czasie.** `strom history back <zmiana>` przywraca badanie do stanu po wcześniejszej zmianie: najpierw
  pokazuje, co wróci i co zostanie odłożone na bok, a potem działa tylko na „tak” człowieka w terminalu. Nic nie
  jest usuwane: zapisy dodane od tamtej pory zostają odłożone na bok, a sam powrót można cofnąć w ten sam sposób.
  Odnośnik `strom-research://back` otwiera go dla jednej zmiany; dziennik mostka odróżnia powrót od innych zmian.
- **Identyfikacja miejsc.** Badanie identyfikuje miejsca swoich zapisów (`strom place identify`, `propose`,
  `unlocated`): miejsce pewne na podstawie zapisów dostaje współrzędne, nazwy i parafię w czasie; gdzie pewności
  brak, pyta człowieka, podając najwyżej trzech kandydatów, albo mówi, co by rozstrzygnęło. Pytania czekają w „Co
  czeka”, mostek proponuje je aplikacji Strom, a `strom place undo` cofa ostatnią odpowiedź. Kolejka miejsc, które
  aplikacja Strom zleca zidentyfikować, przebiega teraz w tylu sesjach, ile wybierze człowiek, każda liczba z czasem
  i ceną. Każda nazwa miejsca mówi, czy jest formą zapisaną w aktach, czy inną nazwą miejsca (inny język, dawna
  nazwa), a nazwa podana na oba sposoby jest przechowywana raz. Plik Strom przekazuje aplikacji Strom 3.21.0
  zidentyfikowane miejsca z ich nazwami, położeniem i parafią.
- **Rodzaje historii.** `history.kinds` określa, jakich rodzajów wydarzeń szuka historia miejsc (wojny,
  epidemie…). `strom history align` najpierw mówi, co by ukrył, ponownie pokazał i czego by szukał, i robi to tylko
  na „tak” człowieka; nic znalezionego nie jest usuwane.
- **Boczne gałęzie na końcu.** W badaniu z kilkoma liniami praca, która nie pomaga żadnej linii, czeka, aż linie nie
  będą miały nic do zrobienia (`queue.offLine`: na końcu, według priorytetu albo nigdy).
- **Aktualizacje bez przerywania pracy.** `strom update` instaluje każdą wersję we własnym folderze, więc trwający
  przebieg lub rozmowa toczy się dalej w swojej wersji; starsze wersje znikają przy następnej aktualizacji lub dzięki
  `strom tidy`, a `strom doctor` o nich informuje. Mostek odpowiada aplikacji Strom także podczas własnego
  ponownego uruchamiania i podczas tworzenia pliku drzewa.

## 1.24.0

*31.10.2026 · współpracuje z aplikacją Strom 3.19.0.*

- **Miejsca przypisane raz dla wszystkich badań na tym komputerze.** Miejsce, które inne badanie na tym komputerze
  już przypisało do regionów historii, zostaje przejęte, gdy na pewno jest tym samym miejscem (ta sama nazwa i te
  same współrzędne, parafia lub powiat), a wszystkie badania przypisują je tak samo; przechodzi tylko przypisanie
  miejsca, nic z rodziny. Miejsce o tej samej nazwie, które nie jest na pewno tym samym, agent dostaje jako
  propozycję; sam przypisuje tylko resztę. `strom history adopt --dry-run` mówi, co zostałoby przejęte. Pytanie
  o włączenie lub wyłączenie wydarzeń historycznych mówi, że dotyczy wszystkich badań na tym komputerze, i jak
  zmienić to tylko dla jednego badania.
- **Poprawki drzewa z badania w aplikacji Strom.** Mostek wymienia, co `strom fixes` proponuje w badaniu (tytuł, co robi,
  ile pozycji, stan, czy można to cofnąć), bezpłatnie i bez zapisywania czegokolwiek; odnośnik
  `strom-research://fixes` otwiera naprawę w terminalu badania, gdzie naprawa i jej cofnięcie są zawsze najpierw
  potwierdzane.
- **Strona każdego skanu w aplikacji Strom.** Plik dla Stromu podaje teraz przy każdym źródle stronę jego skanu
  w archiwum online: stronę jego pierwszego obrazu, a w przeciwnym razie własny adres źródła. Aplikacja Strom podaje
  ten odnośnik przy wycinkach, które plik pomija, i przy źródłach bez wycinka. Tylko publiczna strona internetowa,
  nigdy adres zespołu akt; standardowy plik GEDCOM zostawia adres w notatce. Data wersji badania w pliku dla Stromu
  zawiera też godzinę, więc aplikacja pokazuje dzień jej powstania także około północy.
- **Własny ród osoby z aplikacji Strom.** Gdy aplikacja Strom oznaczy, że osoba zakłada własny ród albo nie
  kontynuuje rodu rodziny, `strom sync` zachowuje to w badaniu, a plik dla Stromu to oddaje, więc kolejne przesłanie
  i inne urządzenie pokazują te same rody; scalenie dwóch osób zachowuje znacznik. Standardowy plik GEDCOM nic o tym
  nie mówi. Wymaga aplikacji Strom 3.19.0.
- **Numer domu, wiek i okres tak, jak je zapisano.** Słowo oznaczające numer domu („No.”, „čp.”) jest stawiane
  tylko przed samym numerem; ulica z numerem trafia do pliku tak, jak jest. Wiek „05y” jest odczytywany jako 5 lat.
  Jedno i drugie wraca z aplikacji Strom takie samo, nie jako zmiana użytkownika. Okres, który prowadzi aplikacja
  Strom („1871/1882” albo otwarty z jednej strony), trafia do badania jako od … do …, nigdy jako data gdzieś
  pomiędzy.
- **Słaby lub odrzucony model agenta zgłaszany przez doctor.** Gdy badanie nie ma wybranego modelu, a domyślny model
  samego agenta jest tym, który badanie uznało za słaby lub odrzuciło do swojej pracy, `strom doctor` ostrzega
  i podaje polecenie do wyboru modelu; sam nigdy nie wybiera.
- **strom z npm trzyma się swojego kanału.** strom zainstalowany przez npm pozostaje na kanale, z którego go
  zainstalowano, także po wydaniu; kanał wybrany przez `strom update --channel` również jest dla niego zapamiętywany.
- **Polecenie, które się nie powiedzie, cofa tylko swoje.** Polecenie, które po drodze zapisało, a potem się nie
  powiodło, cofa tylko to, co nastąpiło po jego zapisie, więc badanie nigdy nie wygląda na zmienione poza strom. Gdy
  zapis zostaje odrzucony, bo badanie zmieniono poza strom, człowiek czyta to w języku badania, wraz z pasującym
  wyjściem z sytuacji; agent nadal czyta to po angielsku.

## 1.23.0

*30.10.2026 · współpracuje z aplikacją Strom 3.18.0.*

- **Osoba pokazywana pod wybranym nazwiskiem.** Kobietę urodzoną pod jednym nazwiskiem, zamężną pod drugim i po
  rozwodzie znów przy pierwszym można ponownie pokazywać pod tym nazwiskiem bez dodawania go po raz drugi: `strom
  name primary <osoba> "<nazwisko>"` (i `--clear`) albo `strom name add --primary`. Wybór należy wyłącznie do
  użytkownika, nigdy nie jest odczytywany z zapisu; poprawki, cytaty i synchronizacja z aplikacją Strom nadal
  kierują się nazwiskiem rodowym. Plik dla Stromu oznacza wybrane nazwisko, standardowy plik GEDCOM podaje je jako
  pierwsze. Aplikacja Strom 3.18.0 pokazuje osobę pod nim, a nazwisko wybrane w niej wraca przy synchronizacji.
- **Plik dla aplikacji Strom bez ostrzeżeń.** Eksport dla aplikacji Strom ostrzegał przed niestandardowym znacznikiem
  przy każdej osobie z wybranym nazwiskiem i przy kilku znacznikach źródeł; kontrola zna teraz wszystkie własne
  znaczniki Stromu.
- **Commit zrobiony gitem na badaniu zapieczętowanym dwoma kluczami (Windows).** `strom check` radził jednocześnie
  `strom repair` i „nigdy `strom repair`”, a `strom repair` cofał pracę zapisaną kluczem terminala. `strom repair`
  cofa teraz tylko to, co zrobiono poza strom, praca obu kluczy zostaje; potem `strom seal adopt` w terminalu łączy
  klucze – `strom check` podaje oba kroki w tej kolejności. Uruchomiony z aplikacji desktopowej agenta spakowanej
  dla Windows, `strom repair` zostawia takie badanie bez zmian i odsyła do terminala; odrzucony tam zapis również
  odsyła do terminala, już nie najpierw do `strom repair`. Po commicie zrobionym gitem, który nie zmienił żadnego
  zapisu, `strom repair` mówi, że ponownie zapieczętował badanie, już nie „nie ma czego naprawiać”.
- **Klucz pieczęci także tam, gdzie szuka go starszy strom (Windows).** Klucz przejęty z kopii aplikacji spakowanej
  dla Windows jest teraz przechowywany również w `%APPDATA%\strom\keys`, gdzie szuka go strom 1.22.1 lub starszy
  w terminalu: po powrocie do starszej wersji badanie na tym komputerze pozostaje zapieczętowane. Klucz, który już
  tam jest, nigdy nie zostaje zastąpiony.
- **Opowieść pary zatwierdzana z aplikacji Strom.** Pytanie w terminalu mówi teraz o opowieści pary, już nie
  o opowieści osoby.
- **Opowieść pary proponowana przez badanie.** Gdy zapisy opowiadają wspólne życie pary (ich ślub lub dziecko i dwie
  dalsze dane), a jedno z nich ma już własną opowieść, badanie proponuje opowieść pary tak jak opowieść osoby –
  tylko ich wspólne życie (ślub, gospodarstwo domowe, miejsca zamieszkania, dzieci, wdowieństwo), z odesłaniem do
  opowieści partnerów, bez ich powtarzania. Opowieść osoby napisana później ujmuje małżeństwo w jednym zdaniu; żadna
  już napisana opowieść nie jest z tego powodu skracana. `strom config set stories no` wyłącza także te.
- **`strom repair` w jednym języku.** Każdy wiersz, który wypisuje („przywrócono”, „nie ma czego naprawiać”, …), jest
  dla człowieka w języku badania; agent czyta je po angielsku jak dotąd.

## 1.22.2

*30.10.2026 · współpracuje z aplikacją Strom 3.17.1.*

- **Strom z aplikacji desktopowej agenta i z terminala znów zapisuje do jednego badania (Windows).** Aplikacja
  desktopowa agenta może być spakowana dla Windows (MSIX), a każdy plik, który uruchomiony z niej strom utworzył
  w ustawieniach programu strom, trafiał do prywatnej kopii aplikacji: strom aplikacji i strom terminala miały każdy
  własny klucz pieczęci i każdy odrzucał zapisy drugiego jako zrobione poza strom. Ustawienia są teraz poza AppData
  (`%USERPROFILE%\.config\strom`), przejmowane samoczynnie ze starego folderu i z kopii aplikacji (oba zostają bez
  zmian). Badanie rozdzielone w ten sposób naprawia się samo, gdzie to możliwe; w przeciwnym razie `strom seal
  adopt` w terminalu łączy klucze (menu proponuje to raz) – każdy zapis sprawdzony, nic nie ginie, nigdy `strom
  repair`. `strom update` uruchomiony z takiej aplikacji nic nie instaluje (widziałaby to tylko ona) i odsyła do
  terminala; `strom doctor` znajduje kopię programu, którą aplikacja trzyma dla siebie.
- **`strom repair` po commicie zrobionym gitem, który nie zmienił żadnego zapisu** (pusty, same notatki), ponownie
  pieczętuje badanie; wcześniej commit pozostawał niezapieczętowany, każdy zapis był odrzucany i nie było czego
  naprawiać.

## 1.22.1

*29.10.2026 · współpracuje z aplikacją Strom 3.17.0.*

- **Wydarzenie miejsca nie jest zapisywane ponownie przy regionie.** Gdy historii miejsca szukano przed historią
  regionów, w których leży, historia regionu mogła dodać to samo wydarzenie jeszcze raz (ten sam rodzaj, te same
  lata). Region pomija teraz to, co ma już któreś z jego miejsc; wydarzenie, które dotyczyło całego regionu, nadal
  jest zapisywane. To, co agent czyta o miejscu, mówi też, których z jego regionów jeszcze nie przejrzano.

## 1.22.0

*29.10.2026 · współpracuje z aplikacją Strom 3.17.0.*

- **Każde imię raz w tym, co czeka.** Zadanie dotyczące materiałów przesłanych z aplikacji Strom wymieniało każdą
  osobę dwa razy w widżecie i na stronie telefonu (za drugim razem w nawiasach), a jego tekst bez imion zostawiał
  puste nawiasy; menu, `strom plan`, aplikacja Strom i plik GEDCOM pokazywały imię i nazwisko z powtórzonym ID.
  Każde z nich podaje je teraz raz.
- **Widżet otwiera właściwe badanie.** Przy kilku drzewach o tej samej nazwie w aplikacji Strom widżet na pulpicie
  Maca mógł otworzyć jedno z pozostałych; teraz otwiera drzewo swojego badania.
- **Znacznie mniejsze dzienniki sesji.** Dzienniki sesji i czytelników nie przechowują już obrazów, które oglądał
  agent (tylko ich rozmiar i ścieżkę widoku), więc są o 95–99% mniejsze.
- **Porządki, które nadążają, start, który nie czeka.** `strom tidy` radzi sobie z dziennikami dowolnej wielkości.
  Widoki skanów, przerwane pobierania i inne rzeczy, które strom tworzy ponownie, są utrzymywane w porządku nawet
  bez zgody; dzienniki są wtedy tylko zmniejszane, nigdy usuwane. Po odmowie pytanie wraca jeszcze raz, gdy `.strom`
  urośnie znacznie ponad samo badanie. Wolny start na OneDrive lub dysku sieciowym wykryty i naprawiony: menu
  i `strom doctor` nie otwierają już każdego skanu, powrót do menu jest natychmiastowy, doctor pokazuje postęp
  i mówi, gdy badanie leży w folderze w chmurze lub na dysku sieciowym; `strom doctor --timing` mówi, co trwało
  długo. W długim badaniu (setki osób, dziesiątki tysięcy skanów) menu od razu pokazuje, co czeka: liczba jest
  przechowywana obok badania, dopóki nie zmieni się nic, na czym się opiera, i liczona ponownie w ułamku sekundy.
- **Archiwum, które przestaje odpowiadać, zatrzymuje pętlę agenta; czytelnicy nie czekają już na milczącą
  usługę.** `strom fetch` mówi, kiedy spróbować ponownie i co robić w międzyczasie; wywołany ponownie w tej samej
  sesji kończy od razu (exit 8) i nic nie wysyła. Zadanie, którego archiwum ma przerwę, czeka do tego czasu poza
  kolejką (plan pokazuje je odłożone do tej godziny), a `strom run --loop` czeka do tego czasu zamiast uruchamiać
  sesje bez pracy. Czytelnik, którego agent milknie po ponowieniu próby przez swoją usługę, jest raz wznawiany tam,
  gdzie przerwał; gdy nadal milczy, kończy od razu. Taka awaria nie zmniejsza już partii odczytu.
- **Warunek tygodnia subskrypcji pozwala uruchomić kilka sesji z rzędu.** Gdy raz czeka na zapas punktów, rusza
  znowu dopiero przy dwóch punktach więcej (przy 15: 17), zamiast jednej sesji po każdym czekaniu.
- **Co przeżyli przodkowie.** Wydarzenia w miejscach drzewa – historię regionu ze stron, które strom sam pobrał
  i sprawdził, lokalne wydarzenia z odczytanych zapisów – pokazuje aplikacja Strom. Ustawienia początkowe proponują
  je włączyć; instalacja skonfigurowana wcześniej pyta raz, w pierwszym menu po aktualizacji (Enter: nie teraz),
  i nic nie włącza się samo. Włączyć je może tylko człowiek – wtedy albo później w menu Ustawienia → Samodzielna
  praca agenta → Historia, z aplikacji Strom albo poleceniem `strom config set experiments.history on`; dopóki są
  wyłączone, niczego się nie szuka. Historia regionów i historia miejsc to dwa przełączniki, każdy także dla jednego
  badania (Ustawienia → Samodzielna praca agenta, `strom config set
  experiments.history|experiments.placeHistory on|off --for-tree` albo wyłączenie z aplikacji Strom) – wybór
  badania obowiązuje w obie strony; przy wyłączonych miejscach nie szuka się nawet miejsca, o które poproszono. Co
  było włączone, zostaje włączone dla obu, co wyłączone – wyłączone dla obu. Po włączeniu miejsca są przypisywane
  w następnej sesji, a regiony przeszukiwane od czasu do czasu między sesjami badania rodzinnego: mniej więcej co 5.
  (domyślnie), co 10. albo tylko wtedy, gdy nie zostało nic innego (`strom config set experiments.historyPace`,
  ustawienia początkowe, ustawienia); `strom plan` mówi kiedy, a na słowo człowieka wszystkie mogą pójść na początek
  (`strom run --history`, w menu „Szukaj historii teraz”). Najpierw regiony z największą liczbą osób, kraj przed
  państwem nad nim.
  Gdy wydarzenia regionu są zebrane, lata, w których ludzie z drzewa mieszkali w nim ponad 15 lat z rzędu bez
  żadnego wydarzenia, są przeglądane jeszcze raz; przejrzane lata nie są ponownie podejmowane w żadnym badaniu,
  dopóki nie pojawi się ponowna prośba o region.
  Region jest przeszukiwany tylko w latach, w których ludzie z drzewa mieszkali w jego miejscach (ich dane tam i pięć
  lat wokół nich; aż do dziś tylko wtedy, gdy dane sięgają ostatnich 30 lat) – kilka lat na wojnie za granicą to
  tylko te lata. Gdy przodek odnaleziony później mieszkał tam wcześniej lub później albo region dzieli inne badanie,
  przeszukiwane są raz tylko nowe lata. Region, w którego latach nie mieszkał nikt z drzewa (dane w jego miejscach
  leżą wszystkie przed nimi lub po nich), nie jest przeszukiwany wcale; podsumowanie i aplikacja Strom mówią, że nikt
  z drzewa nie mieszkał tam w tych latach. `strom history status` i `strom plan` pokazują lata każdego regionu i to,
  co czeka.
  Tym, co jest pokazywane, zarządza człowiek, w aplikacji Strom lub przez `strom history`: wydarzenie ukryte lub
  usunięte – ze wszystkich badań na tym komputerze, nigdy więcej niezapisywane – i przywrócone; region lub miejsce
  pominięte; regiony miejsca przypisane ręcznie. `strom history list [--place L…] [--region <id>]` wypisuje
  wydarzenia w terminalu: lata, rodzaj, tekst w języku badania, źródło, co jest ukryte lub usunięte.
  Historii pojedynczego miejsca i okolicy – pożarów, powodzi, bitew w pobliżu, dóbr, parafii, szkoły – szuka się na
  słowo człowieka (z karty osoby w aplikacji Strom), najpierw przy następnej sesji, i zostaje ona dla wszystkich badań
  na tym komputerze z tym miejscem. Każde miejsce ze współrzędnymi może być wyszukiwane samoczynnie, najpierw miejsca
  z największą liczbą osób: Ustawienia → Samodzielna praca agenta → Historia poszczególnych miejsc samoczynnie
  (wyłączone, dopóki nie zostanie włączone). Wydarzenie, o które poproszono w rozmowie, agent dodaje ze strony, którą
  strom przeczytał, wraz z jej źródłem.
  Opowieści biorą to jako tło swoich czasów: wydarzenia z lat, w których każda osoba mieszkała w swoich miejscach,
  każde z jego źródłem, nigdy jako to, co osoba robiła (w opowieści pary tylko lata, w których mieszkali oboje); nic
  ukrytego ani usuniętego. Zatwierdzona opowieść pozostaje bez zmian – historia pojawia się dopiero w jej następnej
  wersji, czekającej na zatwierdzenie. Wyłączenie w ustawieniach lub w aplikacji Strom
  (`strom config set stories.history no`).
- **Formy jednego nazwiska.** `strom surname suggest` proponuje, które zapisane formy nazwiska należą do jednej
  rodziny: ta sama osoba zapisana tak w aktach (z cytatami) albo ten sam dźwięk zapisany inaczej w jednym miejscu
  w tych samych latach – nigdy rodziny męża i ojca tej samej kobiety; znak odczytu po nazwisku (`[?]`, `[!]`, `[…]`)
  nie jest osobną formą. Decyduje wyłącznie człowiek, w terminalu
  (`strom surname accept|reject|group`); agent tylko proponuje. Formy jednej rodziny poszerzają wyszukiwanie zapisów
  i osób, które mogą być jedną. `strom person compare` mówi o dwóch osobach, czy są jedną, dwiema, czy nie wiadomo,
  i dlaczego (już scalone, inna płeć, lata daleko od siebie, życie zakończone, zanim drugie się zaczęło, inni
  rodzice, jeden akt dla obu…). Ustalenie oznaczone jako niebędące błędem takim pozostaje: `strom quality
  dismiss|undo|list`, wyłącznie decyzja człowieka – dwie tak oznaczone osoby nigdy więcej nie są proponowane jako
  jedna. `strom check` ostrzega przed wydarzeniem lub ślubem datowanym na pewno po śmierci osoby (data przybliżona
  nigdy), a plan badania tworzy zadanie, by to zbadać, zamykane samoczynnie, gdy data zostanie poprawiona lub
  ustalenie oznaczone jako niebędące błędem. Uczestnik wydarzenia (chrzestny, świadek) to imię i nazwisko, a to, co
  zapis o nim mówi, trafia do nawiasu na końcu jako notatka:
  `--with "godparent:Jan Lhoták (sedlák, Lhota č. 12)"`; imię i nazwisko dłuższe niż cztery słowa lub z liczbą jest
  odrzucane z podaniem, co przenieść do nawiasu, ksiądz wpisany jako świadek ma być wpisany jako celebrans
  (`officiant`), a uczestnik, który może być kimś z rodziny wokół aktu, jest proponowany przez swój numer, nigdy nie
  łączony samoczynnie. Imiona zapisane tak wcześniej znajduje `strom check`, a rozdziela `strom fixes show|run
  participant-names` – bezpłatnie, według reguł, także w archiwum, wszystko jednym krokiem, cofa `strom fixes undo
  participant-names`; decyduje wyłącznie człowiek.
  Aplikacja Strom przed 3.17 odsyła okres jako przedział (od–do jako między–a) i wiek bez zerowych jednostek
  (0y 2m 26d jako 2m 26d); synchronizacja brała to za zmianę użytkownika – sprzeczność albo miejsce zamieszkania
  dodane jako wskazówka obok tego samego. Teraz niezmienione drzewo wraca bez zmian; z aplikacji, która je zachowuje
  (3.17), okres zamieniony na przedział znów jest zmianą użytkownika, a wiek złożony z samych zer (0y 0m 0d) to to
  samo co 0y. To, co tak zapisały wcześniejsze synchronizacje, znajduje `strom fixes show app-shapes`, a poprawia
  `strom fixes run app-shapes` – bezpłatnie, według reguł, także w archiwum, wszystko jednym krokiem, cofa
  `strom fixes undo app-shapes`; decyduje wyłącznie człowiek.
  Ulica to nie miejsce: miejsce zapisane z ulicą lub numerem domu („Lhota, ul. Lhotáka 12”) jest odrzucane przy
  zapisie z podaniem gminy do zapisania oraz ulicy i numeru dla `--house`, w dowolnym języku i piśmie; historia
  miejsc kieruje się gminą, więc miejsca różniące się tylko ulicą są jednym. To, co tak zapisano wcześniej, znajduje
  `strom check`, a poprawia `strom fixes show|run street-places` (ulica do domu, gdzie jest pusty lub wymienia to
  samo) – bezpłatnie, także w archiwum, wszystko jednym krokiem, cofa `strom fixes undo street-places`; decyduje
  wyłącznie człowiek.

## 1.21.0

*26.10.2026 · współpracuje z aplikacją Strom 3.16.0.*

- **„Czeka” mówi, czego aplikacja Strom nie pokazuje.** Wiersz w menu i `strom plan` mówią, ile z oczekujących spraw
  jest tylko tutaj w terminalu, a ile czeka na odpowiedź; reszta to liczba, którą pokazuje aplikacja Strom, więc obie
  się zgadzają.
- **„Co czeka” stawia sprawy samego terminala na początku.** To, co pokazuje tylko terminal (sprzeczność własnej
  zmiany, przesłanie z aplikacji, pytanie o odczyt skanów), jest wymienione pod „Tylko tutaj w terminalu”, reszta
  pod „Także w aplikacji Strom”.
- **`strom input assign`, `hide` i `unskip` mówią, co się zmieniło**, w języku badania: każdy plik, każde zwolnione
  lub utworzone zadanie, osoby z imienia i nazwiska oraz jak to cofnąć. Ich JSON pozostaje taki sam.
- **Podsumowanie badania dla widżetu na pulpicie macOS.** Dopóki działa mostek (`strom live`), podsumowanie każdego
  drzewa jest przechowywane w pliku dla widżetu na pulpicie Maca: nad czym teraz trwa praca, ustalenia z ostatniej
  doby i co czeka, każdy tekst także bez imion i nazwisk osób. Poza macOS nic nie jest zapisywane.

## 1.20.0

*25.10.2026 · współpracuje z aplikacją Strom 3.16.0.*

- **Menu bez nikogo przy terminalu mówi to od razu.** Uruchomione tam, gdzie nikt nie może odpowiedzieć (zamknięte
  wejście, okno bez terminala), menu kończy się jednym zdaniem w języku badania i tym, co zrobić zamiast tego, już nie
  błędem programu; pytanie, którego wejście kończy się przed odpowiedzią, kończy menu tak samo.
- **`strom check` mówi jednym językiem.** Dla człowieka każde ustalenie, suma i uwagi są w języku badania; dla
  agenta wszystko po angielsku, nigdy mieszanka obu. Mówi też, czego brakuje na tym komputerze: plików folderu
  wspólnego, których nie przeniesiono (ile, pierwszy i że przywrócić trzeba cały folder Strom), oraz plików badania
  w iCloud Drive, które jeszcze nie zostały pobrane – nazwane dokładnie tak, nigdy z odesłaniem do `strom repair`,
  nic nie jest nad nimi zapisywane. Pełny dysk jest wszędzie zgłaszany tak samo, w języku badania, z folderem,
  którego to dysk; mostek odpowiada aplikacji kodem `disk.full` (507) i `tree.not-downloaded` (409), a
  `strom live start` mówi, dlaczego mostek się nie uruchomił.
- **Gdy sandbox agenta odmawia gitowi, nazwane jest właściwe miejsce.** Komunikat podaje jako miejsce odmowy
  historię badania (jego folder `.git`), nie sam program gita.
- **Archiwum Strom nie uruchamia płatnego odczytu.** `strom read`, `strom clips` i `strom transcripts` są odrzucane
  w archiwum (i w badaniu czekającym na swojego agenta) tym samym jednym zdaniem co inne odmowy; nic nie jest czytane
  ani zapisywane.
  Jego teksty niczego nie obiecują: materiał jest „zapisany w Archiwum Strom” i podawana jest liczba, nic więcej;
  folder z ponad 20 obrazami proponuje zapisanie ich jako dokumentów rodzinnych; strona telefonu w archiwum mówi
  „Zapisz w Archiwum Strom”; telefon jest w pomocy archiwum. Pomoc archiwum i badania czekającego na swojego agenta
  proponuje tylko to, co w nim działa, bez zadań i kolejki; instrukcja w spakowanym archiwum (`strom pack`) prowadzi
  do aplikacji Strom. Nie zapowiada też nowego zadania, którego potem nie pokazuje. **Jego sprzeczności rozstrzyga
  się w nim:** otwarta (ta sama dana zmieniona inaczej w aplikacji Strom i tutaj) jest podawana w podsumowaniu
  i w „Co czeka” i tam rozstrzygana – wartość z aplikacji albo z archiwum, i dlaczego – tak jak rozstrzyga ją
  odnośnik z aplikacji, a `strom conflict` jest w pomocy archiwum. `strom person show` osoby usuniętej w aplikacji
  Strom zaczyna od tego, z dniem i z `strom sync undo I…`, które ją przywraca; wykazy jej krewnych oznaczają ją
  „(usunięta)”. **Dwie przeglądarki na jednym archiwum:** osoby usuniętej w jednej starsza kopia z drugiej nigdy nie
  zapisuje ponownie jako nowej osoby – gdy nic w niej tam nie zmieniono, usunięcie obowiązuje, a aplikacja dowiaduje
  się, które przesłanie ją usunęło; gdy ją tam zmieniono, zmiany są przy niej zachowywane, a sprzeczność pyta, czy
  wraca – druga kopia, która zmieniła ją inaczej, dostaje własną sprzeczność wobec pierwszej i nigdy jej nie
  nadpisuje, a po decyzji „zostawić usuniętą” ta sama kopia już nie pyta. Starsza kopia bez osoby, którą inne okno
  lub badanie w międzyczasie zmieniło, nie usuwa jej już po cichu: sprzeczność pyta, czy odchodzi, i mówi, kto ją
  zmienił (inna kopia aplikacji, badanie, oba); zmiana cofnięta w międzyczasie (`strom sync undo`) się nie liczy,
  a po decyzji „zostawić” ta sama kopia jest tylko o tym informowana. Cofnięcie przesłania starszej kopii po decyzji,
  że osoba odchodzi, mówi, że pozostaje usunięta, i jak ją przywrócić
  (`strom conflict resolve X… --take research`). Przesłanie cofnięte (`strom sync undo`) i wysłane z aplikacji
  ponownie znów usuwa to, co usuwało. O tym, czy osoba zostaje w drzewie, można decydować ponownie: `strom history`
  podaje każdą decyzję z jej własnym uzasadnieniem i z tym, czy osoba opuściła drzewo, czy wróciła, a `strom conflict
  show` wypisuje wcześniejsze decyzje w języku badania.
- **Kopia zapasowa przed inną wersją obejmuje też folder wspólny.** Wspólne obrazy (skany, oryginały z aplikacji
  Strom, zdjęcia z telefonu) są do niej podłączane, gdzie dysk to umożliwia, bez zajmowania miejsca dwa razy,
  w przeciwnym razie kopiowane; pomijane są tylko wtedy, gdy na dysku brak miejsca na tę kopię, i kopia zapasowa to
  mówi; niedokończone przesyłania z aplikacji i podglądy, które strom tworzy ponownie, zostają poza nią. **Co objąć
  kopią zapasową:** `strom backup` oraz Ustawienia → Konserwacja → „Co objąć kopią zapasową” podają jedyny folder,
  który zawiera wszystkie badania i wspólne obrazy, wraz z jego rozmiarem, albo `strom pack` dla jednego drzewa
  genealogicznego.
- **`strom doctor` rozpoznaje dysk sieciowy lub przekierowany.** Gdzie git nie może ustalić folderu, w którym
  pracuje, drzewa genealogiczne nie mogą prowadzić historii; doctor mówi to teraz, tak jak `strom init`.
- **Materiały rodziny porządkuje się w aplikacji Strom.** Osoby, których dotyczy zdjęcie lub dokument, dodaje się
  i usuwa dla wielu plików naraz albo dla całej partii; plik, który nie dotyczy rodziny albo jest taki sam jak inny,
  jest ukrywany i w razie potrzeby znów pokazywany – nic nie jest usuwane. Aplikacja pokazuje tytuł, rodzaj i datę
  każdego pliku (`strom input sort --title --date`) oraz małe podglądy zdjęć, HEIC i PDF, utworzone raz
  i przechowywane z boku. W terminalu: `strom input assign`, `strom input hide` i `strom input unskip`, który cofa też
  pominięcie. Materiał dodany w terminalu lub w menu do drzewa genealogicznego, które ma aplikacja Strom, mówi, gdzie
  w niej jest: przy osobie → Materiały.
- **Drzewo genealogiczne z innego komputera albo przeniesione ręcznie jest zgłaszane – nigdy zastępowane innym.**
  Zapieczętowane na innym komputerze (albo przy brakujących ustawieniach programu strom) można czytać, a zapis mówi
  to w języku badania z jednym krokiem, `strom seal adopt`, proponowanym przez menu, przez ustawienia początkowe
  (które wymieniają znalezione drzewa) i przez odnośnik aplikacji Strom, zawsze na „tak” człowieka; mostek odrzuca
  zapisy aplikacji kodem `seal.foreign` (409). Drzewo, którego już nie ma tam, gdzie było, jest wymieniane ze swoim
  dawnym folderem i sposobem dodania nowego (`strom trees use <folder>`, od tej pory zapamiętywanego); `strom app`,
  `strom live start` ani żadne polecenie nie otwiera w jego miejsce innego, a `strom trees forget` zdejmuje z listy
  drzewo, które nie jest już potrzebne. `strom trees` i `/status` mostka mówią, czym jest każde drzewo: badaniem,
  badaniem czekającym na swojego agenta albo Archiwum Strom – dla aplikacji (`kind`) badanie czekające na agenta
  jest archiwum, dopóki agent nie zacznie nad nim pracy. Pusta aplikacja Strom (z wyczyszczonymi danymi
  przeglądarki), prosząca o nowe badanie, dostaje najpierw propozycję drzew, które już tu są, by otworzyć jedno
  z nich w aplikacji.

## 1.19.0

*22.10.2026 · współpracuje z aplikacją Strom 3.15.0.*

- **Na archiwum, które umilkło, się czeka, zamiast pytać je raz po raz.** Gdy archiwum przestaje odpowiadać, strom
  zostawia je w spokoju na godzinę – na dwie, potem cztery, gdy tego samego dnia nadal milczy – a agent dowiaduje
  się, do kiedy: zajmuje się w tym czasie inną pracą, pozwala pobieraniu w tle poczekać na archiwum (do 30 minut)
  i kontynuować samodzielnie albo zamyka sesję, by podjąć pracę później. Koniec z ciągłym odpytywaniem archiwum
  w międzyczasie.
- **Pierwsze porządki starszego badania proponowane raz.** Badanie, przy którym nagromadziło się dużo, zanim strom
  zaczął sam utrzymywać tam porządek (dzienniki sesji pracy, widoki skanów i podobne), dostaje w menu jedną
  propozycję: co by znikło, ile i dlaczego, a bez zgody nic nie znika. Po zgodzie porządek jest utrzymywany
  samoczynnie; po odmowie menu i ustawienia nadal mówią, co można zwolnić. `strom pack`, usuwanie drzewa i menu
  podają rozmiar paczki, kopii zapasowej lub obrazów tak jak wszędzie indziej (1,5 MB po polsku, 24 kB dla małych),
  nigdy „0.0 MB”.
- **Biblioteki cyfrowe przeszukiwane dobrze za pierwszym razem.** Dla Krameriusa Czeskiej Biblioteki Narodowej
  i Morawskiej Biblioteki Krajowej oraz dla ANNO Austriackiej Biblioteki Narodowej agent dostaje własne adresy
  wyszukiwania tych bibliotek – mniej nieudanych zapytań i mniej zgadywania.
- **Odczyt z ostrzejszej części skanu.** Gdy część skanu przyszła z archiwum w większej szczegółowości, agent i jego
  czytelnicy oglądają to miejsce w niej – także gdy zaznaczone miejsce sięga trochę poza nią, a reszta jest podana
  – zamiast całego, pomniejszonego skanu; ostrzejsza część, która obejmuje tylko część miejsca, jest wymieniana wraz
  ze sposobem jej obejrzenia.
- **Dokument odczytany pewniej.** Czytelnik zapisuje swój odczyt w raporcie na bieżąco, a odczyt dwóch czytelników,
  z których czytał tylko jeden, to właśnie mówi, nigdy że się zgadzają.
- **Połączenie z telefonem czeka na badanie, nie jest zgłaszane jako błąd.** Zanim badanie wystartuje po ponownym
  uruchomieniu komputera, `strom phone` i ustawienia mówią, że połączenie jest włączone, a jego serwer uruchomi się
  ponownie wraz z badaniem. Na iPhonie arkusz zdjęć pozostaje nad klawiaturą podczas wpisywania osoby lub notatki,
  a proponowane osoby w zasięgu wzroku; serwer telefonu uruchamia się raz, także gdy kilka procesów uruchamia go
  w tej samej chwili.
- **Naprawy własnych błędów programu strom do decyzji.** Gdy strom stwierdzi, że któraś z jego wcześniejszych wersji
  zrobiła coś źle w badaniu, `strom fixes` oraz Ustawienia → Konserwacja → Poprawki drzewa mówią, o co chodzi, co znaleziono
  i co zrobiłaby naprawa, oraz jak jest wymagająca; bez zgody nic się nie dzieje, a odmowa jest zapamiętywana.
  Pierwsza: odczyty na ślepo zrobione z pomniejszonego skanu tam, gdzie istniała ostrzejsza część – czytane ponownie
  obok starych, najpierw na kilku, nic nie jest nadpisywane, różnica staje się zadaniem. Porównywane według tego, co
  odczytano – imion, dat i liczb transkrypcji, nie słów komentarza czytelnika (także po niemiecku, gdzie każdy
  rzeczownik ma wielką literę) – zadanie mówi w jednym zdaniu, która dana się różni; gdzie imię może jedynie
  zaczynać zdanie, odczyty nie są uznawane za zgodne. Gdy nie ma czego czytać ponownie, `strom fixes run` to mówi.
  Druga: po zmianie modelu lub agenta do odczytu wcześniejsze odczyty warte ponownego odczytania – z otwartymi
  miejscami, z niezgodnymi czytelnikami, z otwartą sprzecznością, z odczytem niepotwierdzonym w źródle; podane jako
  „czytał model X, teraz czyta model Y”, proponowane raz na agenta i model, każdy odczytywany ponownie tak, jak był
  czytany (obrazy jednego odczytu razem, próba lub część zawsze z całych odczytów). Liczone w odczytach z ich
  miejscami, a to, czego wymaga naprawa, w wywołaniach czytelnika; proponowane etapami – tylko sporne (rozbieżni
  czytelnicy, otwarta sprzeczność, niepotwierdzone w źródle), z linią bezpośrednią albo wszystkie – każdy z tym,
  czego wymaga, najwęższy pierwszy; daty i świadkowie tylko je porządkują. Naprawę może przeczytać inny gotowy tu
  agent lub model (`strom fixes run <id> --agent <a> --model <m>`), z podaniem, kto czytał wcześniej; ten, który
  tutaj czytać nie może, jest od razu odrzucany wraz z tymi, które mogą. Czas naprawy jest zaokrąglany w górę i po
  próbie przeliczany ponownie według odczytów, tak jak przebiegały równolegle.
- **Drzewo genealogiczne, do którego strom nie może zapisywać, mówi dlaczego.** strom zapisuje do folderu badania
  reguły dla Codexa: polecenie strom uruchamiane samodzielnie wychodzi poza sandbox Codexa – także w systemie Windows, gdzie
  sandbox trzymał historię badania zamkniętą i nie wpuszczał niczego innego – a to, o czym decyduje człowiek, i sam
  git pozostają zabronione. Gdy sandbox agenta mimo to nie pozwala programowi strom zapisywać do folderu drzewa,
  strom to mówi i podpowiada agentowi, co robić w jego sytuacji – uruchamiać strom samodzielnie, uruchomić Codexa
  w folderze badania, któremu ufa, albo dać polecenie do zatwierdzenia poza sandboxem – zamiast gołego „brak
  uprawnień”, które agent przekazywał dalej jako brak dostępu do drzewa. Gdzie agent nie zostawia własnego znaku,
  strom rozpoznaje go po własnym znaku na agentach, które uruchamia, albo po programach, które go uruchomiły, i jako
  prawdopodobną przyczynę wskazuje jego sandbox, potem OneDrive lub kontrolowany dostęp do folderów w systemie Windows. Zapis
  odrzucony przez historię nie jest już zgłaszany jako brak uprawnień do samego gita, a kopia zapasowa lub
  aktualizacja, której nie udało się zapisać, prosi o folder z prawem zapisu, już nie o zwolnienie miejsca na dysku.
  `strom doctor` i `strom check` próbują zapisać do badania i mówią, gdy to nie działa, także tam, gdzie folderu nie
  można nawet wylistować. Na dysku bez twardych dowiązań (udział sieciowy, dysk przekierowany przez Pulpit zdalny)
  strom znów zapisuje, z blokadą tworzoną w inny sposób, a blokada, której wolny dysk jeszcze nie pokazuje, nie jest
  już przejmowana po chwili; drzewo, którego nie można tam utworzyć, nie zostawia nic po sobie i mówi to w języku
  badania. Po instalacji przez npm w systemie Windows `strom.cmd` uruchamia strom tam, gdzie PowerShell odmawia skryptów.

## 1.18.0

*21.10.2026 · współpracuje z aplikacją Strom 3.14.0.*

- **Zdjęcia z telefonu w pionie.** Zdjęcie obrócone według orientacji EXIF jest odczytywane tak, jak ma być
  oglądane, prosto; zaznaczone na nim miejsca (wycinki, połówki rozkładówki, wycięta część) dotyczą obrazu tak, jak
  jest pokazywany. Samo zdjęcie pozostaje bez zmian.
- **Zdjęcia HEIC i dokumenty PDF można odczytać.** Zdjęcia HEIC z telefonu i strony PDF są do odczytu przekształcane
  na JPEG – w macOS, Windows i Linuksie – a oryginał zostaje taki, jaki przyszedł. Zdjęcie HEIC trafia do aplikacji
  Strom jako wycinek JPEG. Gdzie nic na komputerze nie przekształca obrazu, jedno zdanie to mówi wraz z tym, co by
  pomogło; `strom tidy` usuwa przekształcone obrazy po 30 dniach lub powyżej 500 MB.
- **Jeden dokument odczytany naraz.** `strom document read` odczytuje zdjęcie, skan lub PDF jednego dokumentu – aktu
  metrykalnego, listu, umowy, nagrobka, odwrocia zdjęcia: transkrypcję słowo w słowo, jej tłumaczenie, znaczenie
  dawnych słów i skrótów oraz wymienione w nim osoby, wraz z tym, kim w drzewie mogą być. Nic nie jest dopowiadane:
  imię, którego dokument nie ma, zostaje pominięte – także nazwisko, nigdy nie brane od ojca ani z innej rodziny –,
  to, czego nie można odczytać, jest oznaczane; drugi czytelnik może czytać na ślepo. Dokument na drukowanym
  formularzu, jak akt urodzenia, zachowuje swoje osoby – dziecko i oboje rodziców z ich rolą w nim, także ich imiona
  i nazwiska pisane rozstrzelonym drukiem i nazwisko rodowe matki po „née” lub „roz.” –, a dokument odczytany
  wcześniej pokazuje je po aktualizacji bez ponownego czytania. Każda osoba i wydarzenie, które wymienia, przychodzi
  z miejscem na stronie, w którym stoi, więc aplikacja Strom pokazuje każdemu jego własny wycinek. Nic z tego nie
  trafia do drzewa samoczynnie. Dokument już odczytany mówi to o sobie, więc nie jest omyłkowo czytany drugi raz.
  Dokument odczytany ponownie jest pokazywany pod nazwą swojego pliku, nigdy pod kodem. Dokument wysłany z aplikacji
  Strom znajduje agenta tak jak terminal – także zainstalowanego we własnym folderze, również przez npm lub Homebrew
  – zamiast zgłaszać, że żaden agent nie jest skonfigurowany. Czyta go każdy agent, z którym pracuje badanie,
  z modelem i wysiłkiem ustawionymi dla badania.
- **Zdjęcia z telefonu.** `strom phone on`, włączane wyłącznie przez człowieka, pozwala telefonowi w sieci domowej
  (Wi-Fi lub kabel – nigdy sieć komórkowa ani VPN) połączyć się z tym komputerem. Telefon paruje się raz kodem QR;
  jego strona robi potem zdjęcia lub wybiera je z galerii i wysyła je w całości do drzewa badania, z notatką i osobą,
  którą pokazują – tak jak „Dodaj materiały” w aplikacji Strom. Zdjęcie zostaje w telefonie, dopóki komputer go nie
  ma, więc połączenie przerwane w połowie niczego nie gubi.
- **Badanie śledzone z telefonu.** Strona telefonu pokazuje, co robi badanie – nad czym teraz trwa praca, co czeka
  na decyzję, ostatnie 24 godziny i najnowsze zmiany, odświeżane co 10 sekund, dopóki strona jest oglądana – tylko do
  oglądania: w telefonie nic nie odpowiada, nie uruchamia ani nie decyduje. Niedostępny komputer jest zgłaszany wraz
  z ostatnimi danymi i ich czasem. Strona otwiera drzewo, którego kod QR ją sparował, i można ją dodać do ekranu
  głównego jako ikonę, która otwiera ją bez ponownego parowania. To, co czeka, i zmiany można przeczytać na telefonie
  w całości: żaden tekst tego, co czeka, nie jest obcinany, więcej niż pierwszych 20 pojawia się po dotknięciu,
  zmiana wielu wierszy rozwija się w całości; „Co czeka” jest ostatnią częścią strony. Zmiana starsza niż dzisiejsza
  ma obok godziny datę (rok tylko wtedy, gdy nie jest bieżący). Ustalenia pod „Teraz” mówią, co badanie znalazło od
  ostatniego spojrzenia z telefonu (co najmniej ostatnie 24 godziny, starsze po dotknięciu) – nowe osoby, źródła,
  dane znalezione, poprawione lub nowo udokumentowane, rozstrzygnięte sprzeczności – z oznaczeniem nowych; coś
  nowego przy otwartej stronie pojawia się tylko jako liczba w tytule karty i mała etykieta.
- **Zgoda w jednym języku, pytanie także w terminalu.** Zgoda, której udziela tylko człowiek (rozpakowanie badania,
  usunięcie drzewa, okno, w którym odmówiono), jest podawana w całości w języku badania. To, co otwiera komputer na
  zewnątrz, kosztuje pieniądze lub uruchamia cudzy program – Remote Control, programy pobierające bez pytania,
  warunek samodzielnej pracy agenta, hook, własne tempo archiwum, połączenie z telefonem, dostrajanie odczytu – pyta
  o tak lub nie także w terminalu; Enter oznacza nie, a `--yes` nigdy na to nie odpowiada. Gdy `strom update`
  zostaje odrzucony, mówi, że nic nie zainstalowano i która wersja zostaje, i kończy się kodem błędu; nieudana
  instalacja jest zgłaszana również w języku badania.
- **Błędne imię lub notatka wycofane.** `strom name retract` wycofuje imię źle odczytane lub przypisane niewłaściwej
  osobie, `strom note retract` notatkę, a `strom note edit` ją poprawia – przy osobie, fakcie lub zadaniu, zawsze
  z powodem; nic nie jest usuwane. To, co wycofano, nie jest już nigdzie pokazywane – ani agentowi, ani w GEDCOM czy
  `strom find` – więc aplikacja Strom nie pokazuje tego po wczytaniu drzewa, a synchronizacja tego nie przywraca;
  `strom person show --history` mówi, co to było, kiedy i dlaczego, a `strom name restore` lub `strom note restore`
  to przywraca.
- **Poprawki ze zgłoszeń.** Pożegnanie menu mówi, jak ponownie uruchomić strom tam, gdzie okno terminala jeszcze nie
  zna polecenia (po instalacji jednym wierszem: `strom` w nowym oknie, pełna ścieżka w tym; pełna ścieżka także tam,
  gdzie na nazwę wcześniej odpowiada inny `strom`), oraz kiedy mostek aplikacji Strom działa dalej i jak go
  zatrzymać; wybór drzewa w menu można cofnąć przez 0. Mostek nie trzyma już folderu drzewa, więc Windows może go
  usunąć, i kończy pracę sam, gdy drzewa już nie ma (`strom trees remove` usuwa drzewo). Skraj drzewa, gdzie akt
  chrztu nie podaje ojca, jest zamkniętym końcem, gdy nic już nad nim nie pracuje, i nie czeka już bez końca na
  decyzję. Źródło przemianowane w aplikacji Strom jest przemianowywane także w badaniu, a sygnatura lub strona źródła
  trafia do aplikacji przy samym źródle, także zanim cokolwiek je cytuje. Emoji lub inny rzadki znak, który plik
  aplikacji Strom uszkodził po drodze (widoczny jako ��), nie jest zmianą nazwy ani zmianą notatki: badanie zachowuje
  swój tekst. Miejsce lub inna wartość dłuższa niż wiersz pliku GEDCOM (255 bajtów) nie wstrzymuje już zapisu pliku,
  a żadne emoji nie jest dzielone tam, gdzie długi wiersz ma ciąg dalszy. Przy `excerpts.for all` źródło, którego
  jeszcze nikt nie cytuje, także dostaje swój wycinek w aplikacji Strom, o ile mieści się w limicie obok cytowanych,
  które nigdy nie są z tego powodu zmniejszane; to, co się nie zmieściło, jest podawane. Aplikacja Strom dowiaduje
  się, które obrazy źródła badanie ma, ale plik je pominął, i na żądanie wczytuje je z badania – źródło po źródle
  albo wszystkie naraz, z podaniem, ile ich jest i jak są mniej więcej duże.

## 1.17.0

*19.10.2026 · współpracuje z aplikacją Strom 3.13.1.*

- **Najpierw to, co połączyłyby hipotezy.** Zadania uzupełnienia tego, co połączyłyby warianty otwartej hipotezy,
  idą w kolejce pierwsze – także w istniejącym badaniu po aktualizacji – więc aplikacja Strom wkrótce może pokazać
  te powiązania.
- **Mostek aplikacji Strom działa, dopóki pracuje agent.** Mostek nie kończy już pracy po dwóch spokojnych
  godzinach, gdy agent pracuje w drzewie (także przy wstrzymanym przebiegu), więc aplikacja Strom widzi badanie przy
  pracy nawet w drzewie, którego nie śledzi. Mostek zakończony z powodu spokoju wraca pod swój adres, gdy praca znów
  się zaczyna; zatrzymany przez `strom live stop` pozostaje zatrzymany.
- **Przerwane pobieranie zgłoszone i uprzątnięte.** Pobieranie, którego proces zakończył się w połowie, jest
  zgłaszane jako przerwane, z tym, co zapisano i czego brakuje; jego folder roboczy jest usuwany.
- **Nowe materiały zgłaszane w języku badania.** To, co przyszło (zarejestrowane materiały, co przybyło,
  prawdopodobne duplikaty, nazwiska po ślubie, zadania), jest podawane w języku badania.
- **Liczby tak, jak mówi je język.** Teksty liczą w formach swojego języka: 1 zadanie, 2 zadania, 5 zadań – po
  czesku 1 úkol, 2 úkoly, 5 úkolů, po niemiecku 1 Änderung, 2 Änderungen – zamiast „zadanie(-a)”.
- **Więcej w języku badania.** Osoby bez własnego zapisu (`strom person list --unproven`, do którego odsyła
  `strom check`), to, co zapisał `strom export gedcom`, i ostrzeżenie licznika w `strom check` są podawane w języku
  badania, także ich liczby – rozmiar i jakość obrazów tak, jak zapisuje je język (po czesku 0,4 MB · kvalita
  běžná).
- **Zapis w systemie Windows czeka na antywirus.** Plik zapisywany, gdy antywirus lub indeksowanie wyszukiwania na chwilę go
  trzyma, jest zapisywany – lub odczytywany – po krótkim czekaniu zamiast błędu. Plik trzymany dłużej zatrzymuje
  polecenie w całości, bez niczego zapisanego do połowy, a komunikat mówi, że plik trzyma inny program i polecenie
  można po prostu uruchomić ponownie.
- **Błędy dla agenta po angielsku.** To, co czyta agent, jest po angielsku bez względu na język badania; człowiek
  w terminalu lub w menu czyta to w języku badania jak dotąd.

## 1.16.0

*17.10.2026 · współpracuje z aplikacją Strom 3.13.0.*

- **Terminal dla okien badania (macOS).** To, co aplikacja Strom otwiera w terminalu, i rozmowa przekazana do
  nowego okna mogą otwierać się w iTerm2 zamiast w terminalu systemu: pierwsza pozycja ustawień, ustawienia
  początkowe, gdy oba są dostępne, albo `strom config set terminal iterm2`. Zamiast niezainstalowanego terminala
  otwiera się terminal systemu, a okno to zgłasza; `strom doctor` podaje wybrany. W systemie Windows decyduje system.
- **Każda osoba na skraju drzewa z własnymi wariantami.** Gdy otwarta hipoteza łączy się z drzewem przy kilku
  osobach, każda z nich niesie warianty, które ją wymieniają, i rodzinę spoza drzewa, do której należy, więc
  aplikacja Strom może pokazać wszystkie, nie tylko pierwszą.
- **Skraj drzewa osoba po osobie.** `strom edge --json` wymienia każdą osobę, do której dołącza hipoteza,
  z wariantami i rodziną każdej z nich.
- **Nazwisko po ślubie w obie strony z aplikacją Strom.** Nazwisko po ślubie odesłane przez aplikację Strom trafia
  do badania jako nazwisko rodzaju „po ślubie”, nigdy jako zmiana nazwy ani inna forma nazwiska rodowego; to samo
  nazwisko jest tym samym nazwiskiem bez względu na towarzyszące mu imię. Gdy zostanie zmienione lub usunięte
  w aplikacji, stare znika tam, gdzie dały je tylko zmiany w aplikacji; nazwisko podane przez zapis zostaje.
  `strom intake` odczytuje `_MARNM` innych programów jako nazwisko po ślubie. Badanie rozpoczęte wcześniej od
  takiego drzewa (MyHeritage, Legacy, PAF) dostaje je z przechowywanego pliku: `strom input names I…` je pokazuje,
  `--apply` dodaje tylko te nazwiska z cytatem importu, `--undo` je cofa.
- **Jedno archiwum, jedno pytanie.** Gdy obrazy jednego archiwum przychodzą z kilku hostów (jego strona, album,
  serwer obrazów), wymagane przez nie zezwolenie jest pytane raz i rozstrzygane dla wszystkich, nie host po hoście.
- **Linie badania po czesku.** Czeskie teksty mówią teraz wszędzie „linie výzkumu” (linie badania).

## 1.15.0

*16.10.2026 · współpracuje z aplikacją Strom 3.12.0.*

- **Archiwum Strom z wyboru, także z agentem AI.** Ustawienia początkowe pytają, czy nowe drzewa genealogiczne są
  badaniami z agentem, czy tylko Archiwum Strom; w ustawieniach można to zmienić dla jednego drzewa lub dla nowych.
- **Badanie czekające na swojego agenta.** Drzewo genealogiczne, którego agenta AI nie ma na tym komputerze,
  przechowuje to, co wysyła aplikacja Strom, tak jak Archiwum Strom. Gdy agent zostanie zainstalowany, badanie samo
  toczy się dalej.
- **Jedna księga archiwum pobierana raz.** Księga, która już jest w badaniu, zostaje wskazana zamiast ponownej
  rejestracji i pobierania, więc archiwum nigdy nie dostaje dwa razy zapytania o te same obrazy.
- **Szybszy odczyt.** Pięciu czytelników czyta skany jednocześnie (ustawienie `read.parallel`, od 1 do 10), a długie
  pobieranie mówi, ile już zrobiono („40/109 obrazów”). Czytelnicy zaczynają, gdy księga wciąż się pobiera: jej
  obrazy są rejestrowane po dziesięć, a to, co nie przyszło, jest podawane dokładnie; Ctrl-C zachowuje to, co
  przyszło. Archiwum dostaje te same zapytania w tym samym tempie. Księgę można też pobierać w tle, gdy agent pracuje
  dalej (`strom fetch --background`), nigdy z archiwum, które pozwala tylko na tempo człowieka. Szukanie jednego
  aktu może zakończyć się, gdy akt się znajdzie (`strom read --until-found`): odczytane obrazy są podawane dokładnie
  i tylko one liczą się jako przeszukane.
- **Drzewa genealogiczne z innych programów.** Plik GEDCOM zapisany ze znacznikiem kolejności bajtów (BOM) lub
  w UTF-16 (jak zapisują go niektóre programy w systemie Windows) jest odczytywany jako drzewo genealogiczne; drzewo innego
  badania jest przyjmowane jako obce.
- **Czysto na jednym komputerze.** Podgląd na żywo kończy się czysto w każdym systemie, także w systemie Windows, a aplikacja
  Strom dowiaduje się, że się zakończył. Inny strom na tym samym komputerze (z npm albo zbudowany ze źródeł) nigdy
  nie przejmuje odnośników aplikacji Strom ani kanału aktualizacji.
- **Poprawki z prawdziwych badań.** Dzienny przydział samodzielnej pracy pozwala nowemu tygodniowi zacząć się od
  razu, wykorzystuje to, co zostało, w ostatnich dwóch godzinach tygodnia zamiast czekać na reset, i mówi, kiedy
  tydzień się resetuje. Wiek zapisany ułamkiem (½ roku, 1 1/2 years, ein halbes Jahr) jest odczytywany, a lista
  obrazów (`strom read --images 5-19,21-39`) jest odczytywana tak, jak ją podano. Księgę pobiera sesja, która ją
  czyta, nigdy z wyprzedzeniem dla późniejszej; `strom fetch --recordset` sam znajduje księgę; liczby i polecenia
  są podawane tak, jak się je wpisuje.
- **Co nowego.** Po `strom update` i przy `strom --version` odnośnik do tej listy w języku badania. Aplikacja Strom
  pokazuje punkty nowej wersji badania we własnym oknie „Co nowego”.

## 1.14.0

*11.10.2026 · współpracuje z aplikacją Strom 3.11.0.*

- **Warunki każdego archiwum.** strom przestrzega tego, na ile każde archiwum pozwala na automatyczny dostęp:
  dozwolony, ograniczony, tylko ręcznie albo wcale. Gdzie warunki są niejasne, człowiek decyduje raz. Odmowa
  wstrzymuje archiwum na dobę.
- **Co czeka, według miejsc.** Sprawy dla człowieka są posortowane według rodzaju i pogrupowane według tego, gdzie
  się je załatwia: jedno archiwum, jeden urząd, rodzina, jedna strona internetowa. List lub zapytanie można oznaczyć
  jako wysłane.
- **Odczyt dawnego pisma ręcznego.** Skany w rozmiarze, jakiego potrzebuje każdy widok, czytelnik skanów na modelu
  wybranym przez człowieka i odczyt dostrojony na własnych udokumentowanych zapisach badania.
- **Z aplikacją Strom 3.11.0.** Sprzeczność między zmianą w aplikacji a zapisem rozstrzyga się w aplikacji; hipotezy
  pokazują, co połączyłby każdy wariant.
- **Mniejsze instrukcje dla agenta, które wiedzą więcej**, a poziom wysiłku rozumowania jest wyborem człowieka
  (`model.effort`).
- **`strom grep`** przeszukuje materiały wejściowe, notatki i wyniki badania, także bez względu na znaki
  diakrytyczne.
