<a id="S2"></a>
# S2 Zmiany z aplikacji w badaniu

Co z aplikacji wysyła się do badania, kiedy, co badanie z tym zrobi i czego nie przyjmie. Opisuje aplikację Strom
3.21.2 (i badanie 1.25.2). Jak aplikacja łączy się z badaniem,
opisuje [S1](S1-connecting-app-and-research.md). Co staje się ze zmiany udokumentowanej danej, opisuje
[R5.2](R5-conflicts.md#R5.2).

<a id="S2.1"></a>
## S2.1 Główne jest drzewo w aplikacji

Drzewo w aplikacji i drzewo w badaniu to dwie kopie. Zmiany z aplikacji idą do badania przez wysłanie całego drzewa.
Badanie porównuje, co dało aplikacji, co przyszło i co ma teraz, i zapisuje tylko to, co zmieniło się w aplikacji.
Czego badanie nie zapisze, zostaje w aplikacji i jest widoczne.

- **Granice:**
  - Tego, co badanie w międzyczasie zrobiło samo, nigdy nie traktuje jako zmiany z aplikacji, która by to cofała.
  - Drzewo z innego programu lub starszy eksport bez informacji, z której wersji badania powstał: badanie bierze tylko
    nowe dane, a różnice tylko pokazuje.
  - Jedno wysłanie to w historii badania jeden wpis z jednym źródłem i można je cofnąć ([S2.7](#S2.7)).
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :1-19 · app:strings.ts treeSettings.principles -->

<a id="S2.2"></a>
## S2.2 Kiedy zmiany są wysyłane

Każde drzewo z badania ma swój sposób wysyłania. Wybiera się go w oknie **Badanie dla drzewa**, sekcja **Wysyłanie
zmian**.

| Opcja | Co się dzieje |
|---|---|
| **Ręcznie** | wysyła się dopiero przyciskiem **Wyślij**; wcześniej widać **Co zostanie wysłane** |
| **Automatycznie** | zmiany wysyłają się same po chwili spokoju |
| **Tylko wczytywanie z badania (bez wysyłania)** | nic się nie wysyła, z badania tylko się wczytuje |

- **Granice:**
  - Opcja domyślna: **Ręcznie** przy badaniu z agentem, **Automatycznie** przy Archiwum Strom i przy badaniu, które
    czeka na agenta. Drzewo połączone z badaniem przed aplikacją 3.9.0 wysyła automatycznie. Przy takim drzewie i przy
    drzewie otwartym z badania aplikacja raz pyta **Jak wysyłać zmiany do badania?**; dotychczasowy sposób jest
    oznaczony **(dotychczas)**.
  - **Automatycznie** wysyła zmiany po 2 minutach bez kolejnej zmiany, przy przełączeniu na inne drzewo i przy
    opuszczeniu strony. Wysyła tylko do działającego badania i zawsze tylko za jedno drzewo naraz.
  - Drzewo śledzone na żywo jest tylko do odczytu i nic nie wysyła ([S1](S1-connecting-app-and-research.md)).
  - Badanie nie działa: zmiany czekają i wysyłają się po jego uruchomieniu. **Wyślij** potrafi je uruchomić linkiem
    w terminalu.
  - Na odpowiedź badania aplikacja czeka najwyżej 2 minuty. Potem pokazuje „Badanie nie odpowiedziało na czas.”;
    zmiany zostają w aplikacji.
  - Po przełączeniu z **Tylko wczytywanie** pierwsze wysłanie idzie zawsze ręcznie przez **Co zostanie wysłane**.
  - Wysyła się tylko z komputera, na którym działa badanie. Telefon zmian nie wysyła ([S5](S5-phone.md)).
- **Obsługa:** aplikacja: **Badanie → Więcej → Badanie dla tego drzewa… → Wysyłanie zmian**; przycisk **Wyślij**
  (**Wyślij do badania**); **Wyślij teraz**; **Odtąd wysyłanie bez podglądu**
- **Obowiązuje od:** aplikacja 3.9.0 (badanie 1.12.0); wysyłanie przy opuszczeniu strony od aplikacji 3.16.0

<!-- zdroj: app:src/research-sync.ts:43 newTieSendMode · src/types.ts:1735 ResearchLink.sendMode · src/ui/research-sync-ui.ts (v3.21.2) AUTO_QUIET_MS :136, SEND_TIMEOUT_MS :130, pagehide :428, researchAutoSend :1438, researchSendNow · src/ui/research-tree-settings-ui.ts researchSendModeCardsHtml, maybeAskResearchSendMode · strings.ts treeSettings.sending, auto, manual, off, askTitle, askWas, deviceNote · changes.skipPreview · sync.sendNoAnswer, sync.sendWhenRunning · CHANGELOG.cs.md 3.16.0 -->

<a id="S2.2.1"></a>
### S2.2.1 Co zostanie wysłane

Przed ręcznym wysłaniem aplikacja pokazuje listę **Co zostanie wysłane**: zmienione osoby (nowa osoba, usunięta, imię
i nazwisko, urodzenie, zgon, ślub, zdarzenie, chrzestni, świadkowie), zmienione źródła z miejscami, w których są
cytowane, pary, miejsca z nowymi współrzędnymi i warianty nazwisk. Każda grupa ma własną sekcję. Po zapisie pokazuje
w ten sam sposób **Co zostało zapisane** z sekcjami **Zapisano** i **Nie zapisano**.

- **Granice:** gdy dokładnej listy nie da się policzyć, drzewo wysyła się takie, jakie jest, a badanie zapisuje tylko
  różnice.
- **Obowiązuje od:** aplikacja 3.14.0

<!-- zdroj: app:strings.ts changes.willSendTitle, changes.kind*, changes.inexact, changes.writtenSection, changes.notWrittenSection · CHANGELOG.cs.md 3.14.0 -->

<a id="S2.2.2"></a>
### S2.2.2 Folio, skan i sygnatura z aplikacji

Aplikacja, która przechowuje pola źródła ([A3.9](A3-evidence-in-the-app.md#A3.9)), wysyła badaniu sygnaturę, folio,
skan i dalszą lokalizację w polach. Badanie porównuje je pole po polu i zapisuje zmianę jako zmianę strony źródła.

- **Usunięcie:** folio, skan albo sygnaturę, które człowiek usunie w aplikacji, usuwa też badanie. Przywraca je
  cofnięcie wysłania ([S2.7](#S2.7)).
- **Granice:**
  - starsza aplikacja, która pól nie zna, nie usuwa niczego. Zmiana całej strony ze starszej aplikacji zastępuje
    lokalizację i usuwa podane folio i skan (cofnięcie je przywraca);
  - nie usuwa się wartość, którą plik aplikacji jeszcze wymienia: folio albo skan w stronie (`PAGE`), sygnatura jako
    cała strona albo we własnym wierszu notatki źródła („Sygnatura: …”, w dowolnym języku). Lepiej, żeby została, niż
    żeby usunęło się to, czego aplikacja nie widziała jako pola;
  - sygnatura księgi i numer skanu z zarejestrowanych skanów nie są polami źródła: usunięcie w aplikacji ich nie
    zmienia;
  - przy źródle, które przeczytało badanie, zmiana ani usunięcie nie zapisuje się do źródła; zapisuje się notatka obok
    („folio/strona: usunięto w aplikacji Strom (było fol. 12v)”).
- **Na liście Co zostanie wysłane** ([S2.2.1](#S2.2.1)) zmieniona sygnatura, folio albo skan jest zmianą strony
  źródła.
- **Obowiązuje od:** aplikacja 3.27.0 z badaniem 1.31.0

<!-- zdroj: research:337787ff, 87785596 src/core/sync.ts:3534 SOURCE_EDITS, SOURCE_FIELDS, :3551 removedFields (fieldsKept, entryWords, locatorOverlap, isValue, noteCallNumbers, CALL_NUMBER_LABELS), removedLine (sync.reading.removed) · 4de28f00 (úprava celé PAGE ze starší aplikace nahradí locator a smaže folio/snímek, undo vrátí) · app:c3278633 src/research-changes.ts (změna signatury, folia, snímku jako strana), src/ged-exporter.ts sourceFields · CHANGELOG.cs.md 1.31.0 · dirigent:prace/1111-vyzkum-citace-most-n1, prace/1111-vyzkum-citace-pole · spec 075 U1c B -->

<a id="S2.2.3"></a>
### S2.2.3 Które drzewo zostaje wysłane

Do badania trafia zawsze drzewo, które jest z nim połączone, z własnymi danymi. Przełączenie na inne drzewo niczego
w tym nie zmienia.

- **Przełączenie drzewa:** niewysłane zmiany drzewa, które się opuszcza, odchodzą od razu ([S2.2](#S2.2)). Drzewo,
  na które się przełącza, zostaje wysłane dopiero otwarte, przy najbliższej odpowiedzi mostu. Zmiana zapisana
  w trakcie przełączania zostaje w drzewie, w którym powstała.
- **Kopia bez osób badania:** aplikacja nie wyśle kopii, która prawie nie niesie osób badania: wersja badania,
  z której drzewo wychodzi, ma co najmniej 10 osób z numerem badania, wysłanie niosłoby mniej niż 10 % z nich,
  a mniej niż 10 % wysyłanych osób miałoby taki numer. Nie wyśle jej sama, przyciskiem **Wyślij** ani przy
  opuszczeniu strony; zmiany zostają w aplikacji niewysłane. Wysłanie przyciskiem mówi to komunikatem „Nie wysłano:
  otwarte drzewo prawie nie zawiera osób tego badania i zostałoby tam odczytane jako inne drzewo. Zmiany zostają
  tutaj.“, **Wyślij ponownie** cofniętej wysyłki komunikatem „Nie wysłano ponownie: ta wysyłka nie zawierała osób
  tego drzewa. Zmiany zostają tutaj.“ Wysyłka sama z siebie i opuszczenie strony niczego nie zgłaszają; czekające
  zmiany pokazuje znacznik.
- **Drzewo przykładowe** nigdy nie jest wysyłane do badania ([S1.3.1](S1-connecting-app-and-research.md#S1.3.1)).
- **Granice:** od badania 1.34.0 małe inne drzewo pod połączeniem badania odrzuca też samo badanie ([S2.5](#S2.5)).
  Cofnięte wysłanie, które nie niosło osób drzewa, nie jest ponownie proponowane ([S2.7](#S2.7)).
- **Obowiązuje od:** aplikacja 3.29.0

<!-- zdroj: app:7e92c784 src/data.ts switchTree/loadStartupTree (switchSeq, id stromu spolu s daty), getDataFor(treeId), save() páruje id s daty · 92f9e978 DataManager.isSwitchingTo(treeId) (odkládá se jen poslání stromu, na který se přepíná; autoDue při odpovědi mostu) · bbcc2b17 src/research-foreign-send.ts foreignSendCheck (FOREIGN_SEND_MIN_BASE 10, FOREIGN_SEND_SHARE 0.1, čísla REFN P…), src/ui/research-sync-ui.ts (auto, ruční, odchod ze stránky) · 302a2d3d (bez navigator.locks bez zámku) · CHANGELOG.cs.md 3.29.0 „Přepnutí stromu“ · prace/1115-app-prepnuti-stromu, prace/1115-app-odeslani-pred-prepnutim · hláška ručního poslání: app:65e7cba0 strings.ts sync.foreignNotSent, sync.undoneForeignNotSent (jen ručně a Poslat znovu) -->

<a id="S2.3"></a>
## S2.3 Co badanie zrobi z wysłanymi zmianami

Badanie z agentem zapisuje wysłanie od razu. Nowa dana lub osoba z aplikacji jest zawsze **Wskazówka** ze źródłem
„Zmiany w aplikacji Strom”, nigdy Udokumentowane. Zmiana danej udokumentowanej zapisem staje się sprzecznością.
Szczegółowe zasady są w [R5.2](R5-conflicts.md#R5.2); transkrypcje źródeł z aplikacji
w [R3.5.1](R3-verification-and-citation.md#R3.5.1).

- **Granice:**
  - Z opcją badania `sync.review on` badanie nie zapisuje wysłania od razu. Czeka na słowo człowieka w terminalu
    ([R6](R6-awaiting-action.md)); aplikacja w tym czasie pokazuje **Czeka na potwierdzenie w badaniu.**
  - Po zapisie aplikacja sama wczytuje nową wersję badania, gdy nic by się przez to w aplikacji nie straciło.
  - Sprzeczności powstałe przez wysłanie aplikacja pokazuje komunikatem **Zapisano, N sprzeczności do
    rozstrzygnięcia** z **Pokaż**. Rozstrzyga się w badaniu (**Rozstrzygnij w badaniu**); wartość z aplikacji do tego
    czasu zostaje w aplikacji.
- **Obsługa:** terminal: `strom config set sync.review on|off`, `strom config set sync.edits conflict|user`
  ([R5.2.1](R5-conflicts.md#R5.2.1)). Aplikacja: okno **Badanie dla drzewa** pokazuje, co opcja znaczy
  („Zmiany są zapisywane w badaniu dopiero po potwierdzeniu.”).
- **Obowiązuje od:** badanie 1.5.0; `sync.review` od 1.12.0
- **Od badania 1.32.0:** `strom sync` drzewa z aplikacji (JSON i GEDCOM) zachowuje wspólne wydarzenia, role, własne
  wydarzenia **Chrzestny** i **Świadek ślubu** oraz uczestników wydarzeń ([A10](A10-shared-events.md)), jak przy
  przejęciu drzewa genealogicznego ([R11.3](R11-material-from-the-user.md#R11.3)). Badanie, które przejęło drzewo
  z aplikacji wcześniej, samo się nie poprawi; kolejny `strom sync` z aplikacji uzupełni, czego brakuje:
  - notatkę osoby lub rodziny, którą wcześniejsze przejęcie skróciło do 500 znaków, do pełnej (można cofnąć);
  - brakujące własne wydarzenia chrzestnego i świadka jako nowe dane oraz brakujących uczestników wydarzeń;
  - osobę lub rodzinę, którą przejęcie GEDCOM w badaniu 1.31 pominęło z powodu długiej notatki ze znakiem spoza
    podstawowego zestawu (emoji), zaproponuje jako nową.

  Notatek wydarzeń i notatek uczestników `strom sync` w badaniu 1.32.0 i 1.33.0 nie porównuje, więc ich nie
  uzupełni; aplikacja trzyma je w całości.
- **Od aplikacji 3.28.0:** badanie starsze niż 1.32.0 nie zwraca wspólnych wydarzeń ani własnych wydarzeń
  chrzestnego i świadka. Aplikacja przy wczytaniu nowej wersji takiego badania przejmuje je z poprzedniego stanu
  drzewa: osobę rozpoznaje po numerze w badaniu, wydarzenie po typie, dacie, miejscu i wartości, tylko gdy zgodność
  jest jedna. Wydarzenie, które badanie zmieniło, jest zwykłym wydarzeniem swojej osoby; pozostałe kopie zostają
  połączone.
- **Od badania 1.34.0:** `strom sync` porównuje także notatkę wydarzenia, z pliku GEDCOM i z JSON aplikacji,
  trójstronnie: notatkę, której badanie nie ma, uzupełni;
  notatkę, którą użytkownik od ostatniego przekazania zmienił, poprawi (poprzednia zostaje w historii notatki);
  notatkę zmienioną po obu stronach zostawi do wyboru. Usunięta notatka niczego nie usuwa. Wiersze, które do notatki
  wpisuje eksport (stan, słowa wpisu, wiek), własne wiersze badania i notatka, którą aplikacja daje każdej kopii
  wspólnego wydarzenia, nie liczą się jako zmiana. Zmianę można cofnąć. Sync uruchomiony przez agenta nie zmienia
  notatki użytkownika ani notatki zaimportowanej danej. Nowa dana z aplikacji na razie notatki nie przenosi.
  - **Które wydarzenie:** wydarzenie z pliku łączy się z wydarzeniem badania najpierw po jego numerze w badaniu (E…),
    który niesie plik aplikacji, potem po szczegółach i nazwie. Notatka jednego wydarzenia nigdy nie poprawi innego;
    przy dwóch takich samych wydarzeniach jednej osoby (ten sam typ, dzień i źródło), których nic z tego nie
    rozróżnia, notatka nie jest brana przy żadnym. Drzewo z aplikacji bez zmian nie zmienia żadnej notatki.
  - **Notatka uczestnika:** notatki uczestnika wydarzenia (chrzestnego, świadka…) z aplikacji badanie 1.34.0 nie
    bierze, także z aplikacji 3.29.0: drzewo zapisane w aplikacji w starszej wersji może mieć dłuższą notatkę
    uczestnika skróconą, a badanie skróciłoby ją również.

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :1-19 · src/core/config.ts:285 sync.review · src/core/live.ts accepts() :1455 sync.auto write|off|mirror · app:src/ui/research-sync-ui.ts :1-21 · strings.ts sync.statePendingSub, sync.flyConflict, sync.showConflicts, sync.decideInResearch, sync.writtenConflictsSub, treeSettings.effectReview · 1.32.0: research:ac489205 src/core/sync.ts readStromJson (appPersonEvent, appParticipants; fact.new, fact.part, fact.share), research:f8eb2032 note.correct (zkrácená poznámka → celá), research:01125661 (NFD zkrácená poznámka), dirigent:prace/1113-vyzkum-json-intake-drobnosti bod 5 (vynechané osoby 1.31 → nové), postřeh 2 (sync poznámek událostí a účastníků) · 3.28.0: app:80c2ffb9 src/research-link.ts keepEventShares, EVENT_SHARE_FEATURE event.share, eventMatchKey · 1.34.0: research:4cfc233c src/core/sync.ts fact.note, fact.part.note (noteEdits, pick, smazání nic), dirigent:prace/1115-vyzkum-095-cli-drobnosti B1 · párování podle čísla: src/core/sync.ts planSync (byId `2 _STROM_EID`, sure), poznámka účastníka: src/core/stromapp.ts APP_SENDS_PART_NOTES undefined (dirigent:prace/1115-release-vyzkum-1.34.0 Průběh 22:02) -->

<a id="S2.3.1"></a>
### S2.3.1 Cytat główny i usunięty cytat z aplikacji

Cytat główny ([A3.2.2](A3-evidence-in-the-app.md#A3.2.2)) i cytat usunięty z danej
([A3.2.3](A3-evidence-in-the-app.md#A3.2.3)) badanie przejmuje jako zmianę użytkownika. Każdą można cofnąć
([S2.7](#S2.7)), a historia badania mówi, kto i kiedy.

- **Cytat główny:**
  - cytat oznaczony w aplikacji jest główny także w badaniu ([R3.4.5](R3-verification-and-citation.md#R3.4.5)); inny
    cytat tej samej danej przestaje być główny;
  - usunięcie oznaczenia badanie rozpozna, gdy plik z aplikacji wychodzi z wersji badania, w której cytat główny był,
    a przy cytacie już go nie ma. Przy pliku, któremu badanie nic nie dało, cytat główny bierze się tylko jako
    ustawienie;
  - cytat główny przy cytacie, którego badanie nie ma, badanie najpierw doda, a potem oznaczy. Gdy cytatu nie doda,
    głównego nie ustawi i powie to ([S2.5.1](#S2.5.1));
  - cytatu głównego przy danej, której użytkownik w tym samym wysłaniu zmienił datę lub rodzaj, badanie nie zapisze
    (nie dopasuje danej); wystarczy wysłać go ponownie po kolejnym wczytaniu.
- **Usunięty cytat:**
  - badanie usuwa go z danej i pamięta usunięcie ([R3.4.6](R3-verification-and-citation.md#R3.4.6)). Źródło i jego
    skany zostają. Usunięty cytat główny usuwa także oznaczenie głównego;
  - przy wspólnym wydarzeniu usuwa się raz, z tego jednego wspólnego wydarzenia badania;
  - usuwa się tylko cytat, który dana miała w wersji badania, z której wychodzi plik aplikacji. Cytat tego samego
    źródła, który agent dodał później, zostaje.
- **Granice:**
  - usunięcie badanie bierze tylko z pliku GEDCOM, który aplikacja wysyła przez most, i tylko przy urodzeniu,
    zgonie, wydarzeniach osoby, ślubie, wydarzeniach pary i rozwodzie. Cytaty osoby, imienia i rodziny nie są
    usuwane z aplikacji;
  - gdy w pliku brakuje całego źródła, nic się nie usuwa: źródło zostaje w badaniu z cytatami i usuwa się je
    w badaniu;
  - aplikacja, która jeszcze nie wysyła usunięć, niczego nie usuwa; cytat zostaje w badaniu;
  - z pliku JSON aplikacji badanie czyta cytat główny (od wersji danych 21), usunięcia nie;
  - aplikacja proponuje cytat główny tylko przy badaniu, które go przechowuje, a przy badaniu, które usunięć nie
    przejmuje, mówi to ([A3.2.3](A3-evidence-in-the-app.md#A3.2.3)). `_STROM_MAIN` i `1 DATA` › `2 EVEN` badanie
    zapisuje tylko aplikacji, która je czyta ([A2.7](A2-loading-a-family-tree.md#A2.7)).
- Co z tego badanie nie przyjęło, aplikacja wypisuje z nazwy ([S2.5.1](#S2.5.1)).
- **Obowiązuje od:** aplikacja 3.29.0 z badaniem 1.34.0

<!-- zdroj: research:355df0a5 src/core/sync.ts fact.main (op event.main, _STROM_HEAD: zrušení), fact.uncite (jen s HEAD, APP_SENDS_UNCITE, BIRT/DEAT/LifeEvent/MARR/události páru/DIV; cite.notCarried, cite.sourceRemoved, cite.olderApp, fact.noMatch, main.notCarried), :5268 · src/core/stromapp.ts:806-820 APP_READS_MAIN_CITATION, APP_SENDS_UNCITE, APP_DATA_MAIN_CITATION 21 · src/core/live.ts features citations.order, citations.main, citations.remove, sync.notWritten.codes · 4cd81f14 (vrácení) · app:src/citation-gates.ts · ZADANI_VYZKUM_hlavni-citace.md 3.2, 4.1, Upřesnění 3 a 5, V6, V7 · spec 095 K2, K3 -->

<a id="S2.4"></a>
## S2.4 Archiwum Strom i badanie bez agenta

Archiwum Strom i badanie, które czeka na swojego agenta, odzwierciedlają drzewo z aplikacji: obowiązuje słowo
z aplikacji. Zapisują każde wysłanie od razu, nawet gdy włączone jest `sync.review`.

- **Granice:**
  - Zmiana danej udokumentowanej zapisem nie tworzy sprzeczności; dana z zapisu zostaje wycofana z powodem.
    Sprzeczność rodziców i sprzeczność usuniętej osoby powstają także tutaj ([R5.2.1](R5-conflicts.md#R5.2.1)).
  - To, co w aplikacji zostanie usunięte, badanie odkłada z powodem i można to cofnąć.
  - Tego, co Archiwum Strom ma, a czego to okno aplikacji nigdy nie miało, archiwum nie usuwa. Aplikacja podaje to
    przy niezapisanych zmianach: **Archiwum Strom wciąż ją przechowuje: to okno nigdy nie miało tych danych**.
  - Zadania sprawdzenia transkrypcji z aplikacji tu nie powstają, bo nikt nie czyta
    ([R3.5.1](R3-verification-and-citation.md#R3.5.1)).
- **Obowiązuje od:** badanie 1.12.0

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :2283-2287 mirror = actsAsArchive, gone :2355 · app:strings.ts treeSettings.effectArchive, sync.notWrittenKept, sync.archiveBridgeDownSub · spec 002 -->

<a id="S2.5"></a>
## S2.5 Czego badanie nie przyjmie

Badanie może odrzucić wysłanie w całości albo zapisać tylko część. Zmiany, których nie zapisało, zostają w aplikacji
i nic się nie traci.

| Kiedy | Co powie aplikacja |
|---|---|
| drzewo jest większe niż 200 MB | drzewo jest za duże, by wysłać je w ten sposób; można je wyeksportować jako GEDCOM i wczytać w badaniu |
| drzewo należy do innego badania | to drzewo należy do innego badania |
| drzewo nie wygląda na drzewo genealogiczne tego badania | można je wyeksportować i wczytać w badaniu jako inne drzewo |
| drzewo dotarło puste lub nieczytelne | drzewo dotarło puste lub nieczytelne |
| badanie właśnie przejmuje drzewo | badanie właśnie przejmuje to drzewo |
| kopia drzewa nie ma jeszcze numerów osób z badania | **Nie wysłano.** Najpierw wymagane jest **Wczytaj wersję badania** |

- **Granice:**
  - Zapis badanie odkłada, gdy drzewo jest zapieczętowane na innym komputerze (**Przejmij na tym komputerze**), gdy
    pliki w folderze w chmurze nie są jeszcze pobrane albo gdy dysk jest pełny. Zmiany do tego czasu czekają
    niewysłane.
  - Gdy badanie zapisze tylko część, aplikacja pokazuje **Zapisano N, nie zapisano M** i przy każdej niezapisanej
    zmianie powód (na przykład „brak wspólnej podstawy: wybór należy do badania”).
  - Po odrzuceniu automatyczne wysyłanie się zatrzymuje. Samo wyśle się ponownie dopiero po kolejnej zmianie.
- **Obsługa:** aplikacja: **Badanie nie przyjęło zmian** w panelu badania, **Spróbuj ponownie**, **Szczegóły (do
  przekazania)**
- **Obowiązuje od:** aplikacja 3.11.0 (badanie 1.12.0); odłożony zapis od badania 1.20.0
- **Od badania 1.26.0:** duże drzewo genealogiczne (około 1 500 osób i więcej) przejęte w systemie Windows zapisuje
  się w całości. Wcześniej kończyło się błędem gita o zbyt długim poleceniu (ENAMETOOLONG) i nie zapisywało się nic.
- **Od badania 1.34.0:** badanie odrzuca też małe inne drzewo wysłane pod jego połączeniem (na przykład drzewo
  przykładowe), w którym z drzewa badania zostało mniej niż pół osób: z wysłanych osób numer badania ma mniej niż
  10 % (przy 10 i więcej wysłanych) albo żadna (przy 5 i więcej). Nic się nie zapisuje, a zmiany zostają
  w aplikacji. Jeśli to zamierzone, taki plik przyjmie terminal: `strom sync <plik> --force`.

<!-- zdroj: research:src/core/sync.ts (v1.25.2) SYNC_MAX_BYTES :1325, tree.empty :1218, tree.other-research :2038, tree.foreign :2068, tree.no-ids :2345 · src/core/live.ts seal.foreign, tree.not-downloaded, disk.full · app:src/research-write-held.ts · strings.ts sync.refusedCodes, sync.refusedDetails, sync.noIdsToast, sync.held, sync.writtenCount, sync.notWrittenPick, sync.rejectedAutoSub · 1.26.0: research:src/core/git.ts commitAll po částech (commit 0e7238fc) · 1.34.0: research:4a5887dc src/core/sync.ts planSync (jiný strom: poslaných ≥ 10 a s id výzkumu < 10 %, nebo ≥ 5 a žádná; kept < given/2, strangers > 0; --force) · CHANGELOG.cs.md 1.34.0 „Jiný rodokmen pod jménem výzkumu“ · prace/1115-vyzkum-cizi-strom -->

<a id="S2.5.1"></a>
### S2.5.1 Nieprzyjęte zmiany z nazwy

Badanie, które do każdej nieprzyjętej zmiany wysyła powód jako kod, dostaje w aplikacji przy każdej takiej zmianie
własny wiersz z powodem słowami aplikacji.

- **Komunikat:** gdy badanie z wysłania niczego nie przyjęło, ale zmiany nazwało: „Badanie nie przyjęło 3 zmian.
  Zostają tu w aplikacji.” z **Pokaż**. Sekcja wysłania w panelu badania ma nagłówek „Badanie nie przyjęło 3 zmian”.
  Takie wysłanie nigdy nie mówi „nic nowego”.
- **Lista:** **Co zostało zapisane** ([S2.2.1](#S2.2.1)) ma przy każdej nieprzyjętej zmianie wiersz osoba · dana ·
  źródło (osobę i źródło można otworzyć, to, co nieznane, się pomija; „Zmiana”, gdy nie jest znana ani osoba, ani
  źródło) i powód:

| Kiedy | Co powie aplikacja |
|---|---|
| starsza aplikacja, która nie wysyła usunięcia cytatu | cytat zostaje w badaniu: ta wersja aplikacji nie wysyła jeszcze usunięć |
| w pliku brakuje całego źródła | źródło zostaje w badaniu z cytatami; źródło usuwa się w badaniu |
| źródło zniknęło z całej osoby lub rodziny | cytaty osoby, imienia lub rodziny nie są usuwane z aplikacji |
| cytat główny przy cytacie, którego badanie nie dodało | cytat główny nie ustawiony: badanie nie przyjęło tego cytatu |
| dana się nie dopasowała | badanie nie znalazło tego faktu (zmieniła się data lub rodzaj) |
| badanie w międzyczasie wycofało daną | badanie w międzyczasie wycofało ten fakt; nie wróci już do aplikacji |
| w pliku brakuje osoby, danej, imienia, dziecka lub partnera | brak w pliku; badanie nic nie usuwa, tylko odnotowuje |
| w tej sprawie czeka już sprzeczność | w tej sprawie czeka już otwarta sprzeczność |
| późniejsze wysłanie z innego okna | późniejsze wysłanie z innego okna zmieniło fakt; ta kopia jest starsza |
| potwierdzenie danej, którą badanie w międzyczasie zmieniło | potwierdzenie nieprzyjęte: badanie w międzyczasie zmieniło fakt |
| relacja dziecka słowem, którego badanie nie zna | relacja dziecka: badanie nie zna tego słowa |
| grupa form nazwiska, którą badanie w międzyczasie zmieniło | badanie zachowuje swoją grupę form nazwiska (w międzyczasie zmienioną) |
| grupa form nazwiska z ostrzeżeniem | grupa form nazwiska: w badaniu tylko z ostrzeżeniem |
| wartość z importu lub od użytkownika, którą agent tylko zaproponuje | wartość z importu lub od użytkownika: badanie ją tylko proponuje |
| osoba się nie dopasowała | badanie nie dopasowało osoby |
| zapis, który badanie chciało wykonać i który się nie powiódł | zapis w badaniu się nie powiódł |
| kod, którego aplikacja nie zna | nieprzyjęte |

- Zmiany, które badanie chciało zapisać, a zapis się nie powiódł, są na tej samej liście, nie we własnym komunikacie.
  Powody, które aplikacja podawała już wcześniej (czeka na wybór, archiwum ją przechowuje, osoba usunięta, wycofane),
  zostają przy swoich dotychczasowych słowach.
- **Dana, którą badanie w międzyczasie wycofało** (`strom event retract`, [R3.1](R3-verification-and-citation.md#R3.1))
  po wersji, z której wychodzi plik aplikacji: usunięty cytat, cytat główny, nowy cytat, notatka, szczegół ani
  potwierdzenie takiej danej się nie zapiszą i każde z nich ma na liście wiersz z tym powodem. Cytaty wycofanej
  danej zostają w badaniu. Terminal przy `strom sync` pisze „nie zapisano: badanie w międzyczasie wycofało tę daną
  (nie wróci już do aplikacji)”.
- Wiersz nowego cytatu, którego badanie nie przyjęło, podaje wszystkie cytowane źródła, które drzewo ma, także
  źródło nowe w aplikacji.
- Późniejszy stan badania uzupełnia tę samą listę bez komunikatu.
- **Granice:** badanie bez kodów zachowuje się jak dotąd: wysłanie, z którego nic nie przyjęło, zgłasza „Badanie nie
  przejęło z tej wysyłki niczego nowego.” Powody przy cytatach (pierwsze trzy wiersze tabeli) badanie wysyła tylko
  aplikacji, która czyta cytat główny; starsza aplikacja ich nie dostanie.
- **Obowiązuje od:** aplikacja 3.29.0 z badaniem 1.34.0

<!-- zdroj: app:1e10a1dd src/ui/research-sync-ui.ts:1985-2005 (SYNC_NW_CODES_FEATURE, notTakenToast, nothingTakenToast), :2849 notTakenTitle · src/ui/research-changes-ui.ts nwReason, NW_TODAY_WHY · strings.ts sync.notTakenToast, notTakenTitle, nw.*, nwUnknown, nothingTakenToast · research:355df0a5 src/core/sync.ts notWritten codes, skipped codes, /status sends[].notWritten (nejvýš 50) · ZADANI_VYZKUM_hlavni-citace.md V4, V5 · spec 095 K3.4 · event.retracted: app:bcf456ee strings.ts sync.nw.event.retracted (notWritten i skipped), src/ui/research-changes-ui.ts nwRowParts more (cites) · research:4a5887dc src/core/sync.ts retractedDiff (code event.retracted: fact.uncite, fact.main, fact.cite s cites, fact.note, fact.detail, fact.confirm), cli/ui.ts + cs/de/pl.json ui.sync.do.event.retracted · prace/1115-vyzkum-095-retract -->

<a id="S2.6"></a>
## S2.6 Osoba usunięta w aplikacji

Badanie z agentem samo nie usuwa osoby ani danej, które zniknęły w aplikacji. Usunięcie tylko odnotowuje, a aplikacja
przy niezapisanych zmianach podaje: „usunięto tylko tutaj: badanie odnotowało usunięcie, ale samo niczego nie usuwa;
usunąć można w badaniu”. Archiwum Strom usunięcie odzwierciedla ([S2.4](#S2.4)).

- **Granice:** gdy jedno okno aplikacji usunie osobę, a gdzie indziej w międzyczasie zostanie zmieniona, badanie pyta,
  czy osoba zostanie w drzewie ([R5.2](R5-conflicts.md#R5.2), punkt 6). Aplikacja pokazuje jedno pytanie na osobę:
  - **Usunięto w innym oknie:** **Przywróć do drzewa** albo **Zostaw usuniętą**;
  - **Zmieniono gdzie indziej:** **Usuń z drzewa** albo **Zostaw w drzewie**.
  Decyzję potwierdza badanie. Potem aplikacja wczytuje jego wersję.
- **Obowiązuje od:** badanie 1.0.0; pytanie o usuniętą osobę od aplikacji 3.16.0 (badanie 1.20.0)

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :1-19 „What the app no longer has is only reported“, gone :2355 · app:src/ui/research-removed-ui.ts :1-14 · strings.ts sync.notWrittenReport, conflict.person.* · CHANGELOG.cs.md 3.16.0 -->

<a id="S2.7"></a>
## S2.7 Cofnięcie wysłania

Wysłanie można w badaniu cofnąć. Zmiany w aplikacji przy tym zostają; z badania odchodzą tylko zmiany tego wysłania.

- **Granice:**
  - Z aplikacji można cofnąć ostatnie wysłanie do 7 dni. Potwierdza się to w terminalu badania.
  - Po cofnięciu aplikacja nic więcej nie wysyła, dopóki nie zostanie wybrane: **Wyślij ponownie** albo pozostawienie
    cofnięcia opcją **Wczytaj wersję badania** (zastępuje zmiany z aplikacji, kopia zapasowa zostaje).
  - Wczytanie wersji badania można cofnąć opcją **Przywróć stan sprzed wczytania**.
- **Obsługa:** aplikacja: **Badanie → Więcej → Cofnij ostatnie wysłanie** · terminal: `strom sync undo`
- **Obowiązuje od:** aplikacja 3.4.0, badanie 1.0.0
- **Od badania 1.26.0:** cofnąć wysłanie (`strom sync undo`) i odrzucić wysłane drzewo, które czeka (`strom sync
  discard`), może tylko człowiek; agentowi badanie odmawia. Zmiany w aplikacji po odrzuceniu zostają i można je
  wysłać ponownie.
- **Od aplikacji 3.29.0:** cofnięte wysłanie, które nie niosło osób tego drzewa (zapis badania o wysłaniu wymienia
  inne drzewo aplikacji albo wysłana wersja prawie nie wymienia jego osób), nie jest ponownie proponowane ani
  wysyłane. Panel badania mówi „Ta wysyłka nie zawierała osób tego drzewa, dlatego nie zostanie wysłana ponownie.
  Wczytanie wersji badania zachowa cofnięcie.” a jego główną akcją jest **Wczytaj wersję badania**. Gdzie
  aplikacja nie może tego rozpoznać, wybór zostaje jak dotąd.

<!-- zdroj: app:src/ui/research-actions-ui.ts (v3.21.2) :448 researchActionUndoSend, UNDO_MAX_AGE_MS :152 · src/research-link.ts:73 sync-undo terminal · strings.ts research.undoSend, sync.undoneSub, sync.sendAgain, sync.loadVersion, sync.againNothing, sync.restoreBeforeLoad · research:src/core/sync.ts :19 strom sync undo · 1.26.0: src/commands/sync.ts:503 sync discard (person), sync undo (person) (commit 942c56f9) · 3.29.0: app:bbcc2b17 src/ui/research-changes-ui.ts researchUndoneForeign (záznam poslání jmenuje jiný strom aplikace, nebo uložená verze poslání skoro nejmenuje osoby druhé uložené verze), strings.ts sync.undoneForeignSub -->

<a id="S2.7.1"></a>
### S2.7.1 Wczytać wersję badania?

Zanim wersja badania zastąpi drzewo w aplikacji, aplikacja pyta **Wczytać wersję badania?** i pokazuje, co się
w aplikacji zmieni albo zniknie.

- **Lista:** wiersz na każdą wartość: osoba · dana · **tutaj → z badania**. Pierwsze 8 wierszy, pozostałe pod „i N
  więcej”. Pod listą, co z badania przybędzie („Z badania przybędzie: + 2 osoby, 3 dane”), oraz „Przed wczytaniem
  zapisywana jest kopia zapasowa; można ją przywrócić.”
- **Notatka wiersz po wierszu:** gdy notatkę mają obie wersje, wspólne wiersze zostają zwykłe, usunięte są
  przekreślone, a dodane lub zmienione wyróżnione (zmieniony wiersz: stary przekreślony, potem nowy). Akapit, który
  badanie tylko dodało, niczego nie przekreśla. Spacje na końcu wiersza i końce wierszy z Windows nie są zmianą.
  Notatka tylko po jednej stronie ma dalej **tutaj → z badania**. Wczytują się te same dane co dotąd.
- **Granice:** przy drzewie, które z badania tylko wczytuje ([S2.2](#S2.2)), i gdy z ostatniego wysłania coś się nie
  zapisało, okno mówi, że wczytanie nadpisze te zmiany; przyciski to **Wczytaj i nadpisz** i **Otwórz jako kopię**.
- **Obsługa:** aplikacja: **Wczytaj wersję badania**
- **Obowiązuje od:** aplikacja 3.9.0; notatka wiersz po wierszu od 3.29.0

<!-- zdroj: app:src/ui/research-load-ui.ts askResearchLoad (ROWS_SHOWN 8, overwrite: sendMode off nebo nezapsané z posledního poslání → loadOverwrite + research.openCopy), src/ui/research-ui.ts:2377 · 03352a9c src/line-diff.ts diffLines (LCS po řádcích, mezery na konci a CRLF nejsou změna), research-load-ui.ts notes · strings.ts sync.loadTitle, loadColChange, loadMore, loadAdded, loadBackupNote, loadOverwrite, loadOverNotWritten · CHANGELOG.cs.md 3.29.0 „Načíst verzi výzkumu?“ · v3.9.0 (loadColChange) -->
