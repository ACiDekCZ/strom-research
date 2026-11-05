# Co nowego w Strom Research

[English](CHANGELOG.md) · [Čeština](CHANGELOG.cs.md) · [Deutsch](CHANGELOG.de.md) · Polski

Zmiany każdej wersji w skrócie. Pełne informacje o wydaniach i polecenia instalacji są na
[GitHub Releases](https://github.com/ACiDekCZ/strom-research/releases) (po angielsku).

## 1.28.0

*W przygotowaniu: bety do 1.28.0-beta.1. Sekcja będzie kompletna z wydaniem.*

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

- **DigiArchiv Archiwum Państwowego w Třeboniu:** jego warunki, tak jak potwierdziło je archiwum – ręcznie tylko wybrane
  skany, nigdy cała księga, żadnych narzędzi do pobierania – i jak cytować stały link do skanu.

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
