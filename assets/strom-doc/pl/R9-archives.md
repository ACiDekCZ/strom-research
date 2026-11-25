<a id="R9"></a>
# R9 Archiwa: co wolno agentowi, a co robi człowiek

Co dzieje się z zadaniem, które potrzebuje skanów lub stron konkretnego archiwum: według czego strom ocenia archiwum,
co agent może sam (program pobierający, pobieranie stron, przeglądarka), kiedy zadanie czeka na człowieka i jak wraca
do kolejki. Obowiązuje tak samo dla sesji automatycznej (`strom run`, sesja uruchomiona z aplikacji Strom, nocny
przebieg) i dla czatu z agentem; różnice są w [R9.7](#R9.7). Opisuje badanie 1.27.0 i aplikację Strom 3.23.0. Przy
zasadach rozróżnia się, czego **pilnuje kod** (polecenie `strom` lub hook agenta to odrzuca), a co jest tylko
**zasadą metodyki** (wskazówką dla agenta, której kod nie sprawdza).

Przebieg w skrócie:

1. **Archiwum:** strom zna warunki archiwów z listy dostarczonej z badaniem i z innych źródeł. Rozstrzyga najsurowsze
   z nich ([R9.1](#R9.1)).
2. **Zgoda:** archiwum z ograniczeniem otwiera tylko zgoda człowieka: powoli, przez przeglądarkę albo tylko ręcznie
   ([R9.2](#R9.2)).
3. **Agent sam:** program pobierający archiwum (skany, [R8.2](R8-reading-scans.md#R8.2)), pobieranie stron witryny
   ([R9.3](#R9.3)) i przeglądarka agenta w Chrome ([R9.4](#R9.4), [R9.5](#R9.5)) kierują się tymi samymi zasadami.
4. **Oczekiwanie:** tam, gdzie agentowi nie wolno, skany zapisuje człowiek. Zadanie czeka na skany i wraca samo, gdy
   w badaniu są wszystkie ([R9.6](#R9.6)).
5. **Decyzja:** tabela i przebieg zadania są w [R9.8](#R9.8), kroki człowieka w [R9.9](#R9.9) i przykłady w
   [R9.10](#R9.10).
6. **Spisy ludności:** źródło opcjonalne, które włącza tylko człowiek; od badania 1.36.0 ([R9.12](#R9.12)).

> **Uwaga: gdzie dokładnie obowiązuje przeglądarka agenta.** Przeglądarki agenta strom pilnuje przy **Claude Code**
> z rozszerzeniem **Claude in Chrome**, we wbudowanej przeglądarce aplikacji Claude
> ([R12.2](R12-where-the-agent-works.md#R12.2)) i w przeglądarce Codexu w terminalu według adresów w jej kodzie, gdy
> człowiek potwierdził hook stroma ([R12.5](R12-where-the-agent-works.md#R12.5)). Przeglądarka aplikacji ChatGPT
> (Codex) działa przez chmurę ChatGPT i strom jej nie pilnuje ([R12.5.1](R12-where-the-agent-works.md#R12.5.1)).
> Przeglądarki innego agenta (Antigravity
> i inne) ani sterowania komputerem żadnego agenta strom pilnować nie potrafi: agent nie wchodzi z nimi sam do
> archiwum, do którego wolno tylko przeglądarce człowieka, a skany zapisuje człowiek. Wbudowanych przeglądarek i sterowania komputerem
> aplikacji desktopowych agentów strom nie poleca; agent używa ich tylko na wyraźną prośbę człowieka
> ([R9.4.2](#R9.4.2)). Gdzie rozmawia się z agentem i czego strom gdzie pilnuje, podsumowuje
> [R12](R12-where-the-agent-works.md).

<!-- zdroj: research:CHANGELOG.cs.md 1.27.0, 1.29.0, 1.30.0 · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS, ON_REQUEST, codexInChatgptApp (v1.30.0, 33ac2e38) · src/core/chromehook.ts:1-25 · src/core/codexhook.ts · app:CHANGELOG.cs.md 3.23.0 -->

<a id="R9.1"></a>
## R9.1 Rodzaje archiwów

Każda witryna, z której badanie bierze wpisy, ma **poziom** warunków i może mieć dalsze ograniczenia. Poziom mówi, co
strom może robić automatycznie; szczegółowa tabela poziomów jest w [R8.2](R8-reading-scans.md#R8.2).

| Dane na liście archiwów | Co oznaczają |
|---|---|
| poziom **dozwolone** | katalog, strony i skany automatycznie, w tempie usługi |
| poziom **ograniczone** | katalog i strony; skany tylko za zgodą człowieka ([R9.2](#R9.2)) |
| poziom **nieznane** | jak ograniczone |
| poziom **tylko ręcznie** | skany tylko ręcznie; zgoda tego nie otwiera |
| poziom **zakazane** | żaden automatyczny dostęp |
| **tylko przez przeglądarkę człowieka** | bez pobierania stron, bez katalogu i skanów przez program pobierający; najwyżej przeglądarka agenta za zgodą „przez przeglądarkę” ([R9.4](#R9.4)) |
| **tempo** | najkrótszy odstęp i najwyższa liczba zapytań na godzinę; strom nigdy nie idzie szybciej |
| **zakazane ścieżki** | części witryny, do których nie wolno niczemu automatycznemu, nawet przeglądarce agenta |
| **serwer obrazów** | inna witryna, z której przeglądarka skanów archiwum bierze obrazy |
| **warunki, cytat, data sprawdzenia** | skąd pochodzi poziom (strona warunków lub robots.txt) i kiedy go sprawdzono |

- **Pilnuje kod:** poziom archiwum to najsurowszy z: odczytu warunków przez program pobierający, zapisu archiwum
  w badaniu, listy archiwów dostarczonej z badaniem (`assets/archives.json`), najsurowszego poziomu, jaki strom
  kiedykolwiek widział przy serwerze, i pliku robots.txt. Serwer, którego robots.txt zamyka całą witrynę wszystkim
  robotom (`Disallow: /`), uchodzi za witrynę tylko przez przeglądarkę człowieka, z poziomem co najmniej
  ograniczone: przeglądarka agenta może tam wejść tylko za zgodą „przez przeglądarkę”, po jednej stronie i w tempie
  człowieka ([R9.4](#R9.4)). Wyjątek: warunki witryny wyraźnie pozwalają na automatyczne użycie, a jej robots.txt
  nie wymienia agentów AI. Serwer, który odrzucił klienta strom, uchodzi za zakazany.
- **Tylko ręcznie** (skany zapisuje zawsze człowiek, zgoda tego nie otwiera) zostaje to, co tak prowadzi lista
  archiwów:
  - ścieżka do zapisów, którą robots.txt zamyka wszystkim robotom (zakazana ścieżka na liście);
  - poziom **tylko ręcznie**: warunki, które na nic innego nie pozwalają, albo imienny zakaz dla agentów AI tam, gdzie
    lista prowadzi go jako tylko ręcznie (np. eBadatelna SOA Praha, [R9.10.3](#R9.10.3)). Imienny zakaz AI w
    robots.txt sam w sobie nie oznacza tylko ręcznie: archiwum z nim może być także tylko przez przeglądarkę
    człowieka;
  - przeglądarka skanów, która bierze obrazy z serwera obrazów zamkniętego w całości dla wszystkich robotów. Takie
    archiwum ma na liście poziom **tylko ręcznie** (np. czytelnie ZA Opava i SOA Litoměřice, [R9.10.2](#R9.10.2)).
- **Granice:**
  - archiwum tylko przez przeglądarkę z poziomem **tylko ręcznie** lub ze zgodą **tylko ręcznie** nie pozwala na nic,
    ani przeglądarce agenta, ani na katalog;
  - zakazana ścieżka `/` (cały serwer obrazów) zamyka także przeglądarkę agenta: skany tylko ręcznie;
  - witryny jednego archiwum (np. archiwum cyfrowe i czytelnia jednego archiwum krajowego) mają każda swój zapis;
    w Co czeka pokazują się jednak pod jedną nazwą archiwum ([R9.6](#R9.6)).
- **Od badania 1.37.0:** księga zapisana w badaniu pod archiwum, której adres jest na portalu z listy archiwów (np.
  Porta fontium, Acta Publica), już nie czyni portalu tak surowym jak to archiwum: portal kieruje się swoimi warunkami
  i pozostałymi źródłami. Własny portal archiwum pod innym adresem, przy którym lista podaje warunki na stronie
  archiwum (np. eBadatelna SOA Praha), archiwum trzyma dalej. Poziom, który strom trzyma z wcześniej, zostaje, dopóki
  nie zdecyduje człowiek w Co czeka. Tam, gdzie wpis archiwum trzyma witrynę przez księgę, `strom doctor`, pytanie
  w Co czeka i `strom allow archive` wymieniają archiwum, księgę i witrynę: „wpis archiwum w badaniu R… (…) przez
  jego księgę … na … (strom recordset show …)”.
- **Dlaczego:** metodyka chce przestrzegać warunków każdego archiwum. Tam, gdzie robots.txt wpuszcza tylko
  przeglądarkę, idzie najwyżej przeglądarka, za zgodą człowieka i w jego tempie; to, co lista archiwów zostawia
  ręce człowieka, zapisuje człowiek.
- **Obsługa:** terminal: `strom net web --check <adres>` (co strom zrobiłby z adresem), menu archiwów, `strom
  allow archive` (tylko człowiek). Aplikacja: Czeka na załatwienie.
- **Obowiązuje od:** badanie 1.14.0. Kolejne archiwa Czech, Niemiec i Polski oraz serwer obrazów od 1.27.0. Portal
  z listy według swoich warunków, nie według księgi innego archiwum, od 1.37.0.

<!-- zdroj: 1.37.0: research:91631d2e, 66a521fa src/core/terms.ts listStates, treeLevel (kniha jen tam, kde seznam podmínky webu neuvádí; vlastní portál archivu s podmínkami na webu archivu drží), src/core/floor.ts FloorHold tree recordset, holdText, floorWhat · cs.json ui.archive.floor.hold.treeSet · CHANGELOG.cs.md 1.37.0 -->
<!-- zdroj: research:src/core/terms.ts:566-680 archiveLevel (robots "Disallow: /" → browserOnly, restricted; robotsYield: openByTerms + robotsNamesAi false), :789-803 allows (browserOnly + manual → nothing) · assets/archives.json (level, browserOnly, pace, disallow, imagesFrom, quote, quoteFrom, checked; metrikai.lt, lagis, gov, online-ofb restricted + browserOnly; ebadatelna.soapraha.cz manual) · src/core/knownterms.ts imagesFrom · test/unit/known-terms.test.ts (imagesFrom closed whole ⇒ manual) · src/core/browserhelp.ts browserHelps (disallow "/") · CHANGELOG.cs.md 1.26.0, 1.27.0 (c3ee4422) -->

<a id="R9.1.1"></a>
### R9.1.1 Strona, której badanie nie zna

- Witrynę, której nie ma na liście archiwów i która nie ma programu pobierającego, strom ocenia według zapisu
  archiwum w badaniu, najsurowszego widzianego poziomu i robots.txt, tak jak strom go odczytał. Bez innych danych ma
  poziom **nieznane**, czyli jak ograniczone.
- Strony takiej witryny agent może pobrać, w granicach [R9.3](#R9.3). Skanów nie: skany archiwum, które nie jest
  dozwolone, nigdy nie idą przez pobieranie stron.
- **Obsługa:** terminal: `strom net web --check <adres>`.
- **Obowiązuje od:** badanie 1.14.0

<!-- zdroj: research:src/core/terms.ts:566-680 archiveLevel (unknown → restricted) · src/core/webgate.ts webGate (images of a non-allowed archive) -->

<a id="R9.2"></a>
## R9.2 Zgoda człowieka

Archiwum z poziomem ograniczone lub nieznane otwiera dla skanów tylko zgoda człowieka. Zgoda ma trzy sposoby i daje
ją tylko człowiek.

| Sposób (terminal) | Tekst opcji | Co agentowi wolno |
|---|---|---|
| `--way slow` | Powoli, w ludzkim tempie | skany przez program pobierający, najwyżej jeden na 10 s i 120 na godzinę |
| `--way browser` | Przez przeglądarkę na tym komputerze | program pobierający z drogą przez przeglądarkę albo przeglądarka agenta po jednym skanie ([R9.5](#R9.5)) |
| `--way manual` | Tylko ręcznie – skany zapisuje się do przygotowanego folderu | nic; skany zapisuje człowiek ([R9.6](#R9.6)) |

- **Pilnuje kod:**
  - zgodę daje tylko człowiek: w swoim terminalu albo w oknie systemowym, które pokazuje się, gdy polecenie uruchomi
    agent lub aplikacja. Agent okna nie widzi i nie może go kliknąć. W sesji automatycznej bez okna polecenie kończy
    się błędem, a agent zapisuje zadanie dla człowieka;
  - zgoda obowiązuje dla archiwum we wszystkich badaniach na komputerze i jest zapisana w ustawieniach użytkownika.
    Odwołuje się ją opcją **Zapomnij decyzję** (`--revoke`): przy następnej potrzebie strom zapyta ponownie;
  - archiwum tylko przez przeglądarkę nigdy nie dostaje **powoli** (skany nigdy przez program pobierający). Archiwum
    tylko przez przeglądarkę, do którego nie prowadzi żaden program pobierający, dostaje tylko **przez przeglądarkę**,
    **tylko ręcznie** albo odwołanie;
  - poziomu **tylko ręcznie** i **zakazane** zgoda nie otwiera: `strom allow archive … --way browser` (także
    `slow`) zostaje odrzucone, a aplikacja nie proponuje odnośnika **Zgoda…**;
  - tempo człowieka (10 s, 120 na godzinę) można zmienić w ustawieniu `archive.pace` albo `strom allow host --pace
    --per-hour`. Tempo z listy archiwów to dolna granica: strom zawsze stosuje wolniejsze z obu.
- **Granice:** po decyzji wracają do kolejki zadania czekające na to archiwum we wszystkich badaniach na komputerze.
  Przy opcji **Tylko ręcznie** zadania czekają dalej na ręcznie zapisane skany. Zadanie, którego skany leżą już
  w folderze, nie wraca: skany zostaną przejęte ([R9.6](#R9.6)). Zadanie **witryna do sprawdzenia** nie budzi się
  nigdy ([R6.2.2](R6-awaiting-action.md#R6.2.2)).
- **Dlaczego:** złagodzić archiwum lub je otworzyć może tylko człowiek; agent może archiwum tylko zaostrzyć.
- **Obsługa:** terminal: `strom allow archive <witryna|pobieracz> --way slow|browser|manual`, `--revoke`, menu archiwów.
  Aplikacja: odnośnik **Zgoda…** w notatce przy pozycji, która czeka na skany archiwum tylko przez przeglądarkę,
  i w wierszu **Przeglądarka** ([R9.4.3](#R9.4.3)). Otwiera pytanie w badaniu w terminalu, nawet gdy do archiwum nie
  prowadzi żaden program pobierający.
- **Obowiązuje od:** badanie 1.14.0. Zgoda dla archiwum tylko przez przeglądarkę bez programu pobierającego
  i **Zgoda…** do niej od 1.27.0.

<!-- zdroj: research:src/commands/archives.ts:575-738 allow archive (requireHuman :687, browserOnly + slow refused, bareArchive) · src/cli/context.ts:253 requireHuman · src/core/archivewait.ts:188 wakeForArchive (manual + images kept, saved in inbox) · src/core/terms.ts:1018 humanPace · src/core/net.ts:45 HUMAN_PACE · assets/lang/cs.json ui.archive.way.* · commit 74dcd58b -->

<a id="R9.3"></a>
## R9.3 Pobieranie stron przez agenta

Strony witryny (katalog, wyniki wyszukiwania, opis księgi) pobiera agent swoim narzędziem do stron WWW. strom
sprawdza go hookiem przed każdym pobraniem i liczy zapytania do każdej witryny.

- **Pilnuje kod (hook agenta i `strom net web --check`):**
  - archiwum zakazane lub witryna, która odrzuciła klienta strom: tylko strona warunków, najwyżej 3 razy dziennie,
    i robots.txt;
  - archiwum tylko przez przeglądarkę człowieka: żadnego pobierania stron. Agent dostaje radę: zgoda „przez
    przeglądarkę” albo oczekiwanie na skany (`strom task wait T… --images B…:<numery>`);
  - archiwum tylko ręcznie, zgoda tylko ręcznie i zakazana ścieżka z listy archiwów: tylko ręcznie, nawet nie
    przeglądarka agenta;
  - ścieżka, której zabrania robots.txt: odrzucone;
  - skany archiwum, które nie jest dozwolone: nigdy przez pobieranie stron.
- **Granice:**
  - po 12 zapytaniach do jednej witryny w sesji idzie do całej witryny najwyżej jedno zapytanie na 6 s, a strom radzi
    program pobierający;
  - po 30 zapytaniach do jednej witryny w sesji (ustawienie `web.perHost`): w sesji automatycznej odrzucone, w czacie
    strom pyta człowieka raz na sesję i witrynę;
  - na wolne miejsce strom czeka najwyżej 30 s; odrzucone jest także wtedy, gdy strom daje witrynie spokój albo gdy ma
    ona wyczerpany limit lub godzinowy pułap.
- **Od badania 1.37.0 (wyczerpany limit):**
  - po `web.perHost` stronach agent słyszy, kiedy witryna znowu da strony: w tej sesji już żadnych albo od określonego
    czasu (limit tego komputera, strony wszystkich sesji w czasie jednej sesji). Zadanie zostaje otwarte, nigdy
    wykonane ani porzucone z powodu limitu; do tego czasu inna praca, inaczej koniec sesji. Strony witryny nie próbuje
    się wcześniej ponownie i na limit się nie czeka; po trzeciej odmowie tej samej witryny w sesji agent słyszy, że
    ma sesję zakończyć;
  - `strom run` zadanie, którego praca prowadzi na taką witrynę (zapis skanu przeglądarką agenta albo księga tylko na
    tej witrynie bez programu pobierającego), na razie pomija i bierze inne: „· T… na razie pominięte: strony … dla
    tego komputera są wyczerpane do …”. Sesja na takiej witrynie zaczyna się, gdy wolna jest co najmniej jedna
    trzecia limitu (10 z domyślnych 30);
  - gdy innego zadania nie ma: przebieg z `--loop` albo `--until` czeka (bez agenta, nic się nie wysyła; „⏸ oczekiwanie
    do … – pozostałe zadania potrzebują stron …”), inny przebieg się kończy i mówi kiedy („do … nie ma nic do zrobienia
    – …”). Dla aplikacji Strom to zakończony przebieg, nie błąd;
  - zadanie czekające na skan, którego przeglądarka agenta nigdy nie zapisała (strona odrzucona), wraca z końcem
    sesji do kolejki; nigdy się o nim nie mówi, że przeglądarka je wstrzymała.
- **Tylko metodyka:** przy odrzuconej witrynie najpierw inna droga. Wyszukiwanie zapisuje się z wynikiem
  nierozstrzygającym (`strom search add … --result inconclusive`). Dopiero gdy źródło jest nadal konieczne, zadanie
  czeka na człowieka, aby sprawdził witrynę (`strom task wait --check`, [R6.2.2](R6-awaiting-action.md#R6.2.2)).
- **Dlaczego:** pobieranie stron i przeglądarka agenta liczą się i zwalniają razem, aby żadna droga nie szła szybciej
  niż inna.
- **Obsługa:** terminal (agent): `strom net web --check <adres>`; `strom run`.
- **Obowiązuje od:** badanie 1.14.0; wyczerpany limit od 1.37.0

<!-- zdroj: 1.37.0: research:ce89202a src/core/web.ts ManyWhen, whenText, WEB_REFUSED_LOOP 3, manyText · src/core/webfull.ts (runWebFree perHost/3, WebFull) · src/core/machine.ts siteFreeAt · src/commands/session.ts:1311-1390 webOut, gateHolds (--loop, --until), stopCode web · cs.json ui.run.skip.web, ui.run.web.wait, ui.run.stop.web · CHANGELOG.cs.md 1.37.0 „Vyčerpaný limit webu“ -->
<!-- zdroj: research:src/core/webgate.ts webGate (TERMS_PER_DAY, browserOnly advice, otherWay) · src/core/web.ts WEB_SOFT 12, WEB_SOFT_GAP_MS, WEB_PER_HOST 30, WEB_WAIT_MAX_MS · src/core/config.ts web.perHost · assets/method/locate.md -->

<a id="R9.4"></a>
## R9.4 Przeglądarka agenta

Przeglądarka agenta to Chrome z rozszerzeniem **Claude in Chrome**, którym steruje **Claude Code**. strom przed
każdym otwarciem strony rozstrzyga tak samo jak przy pobieraniu stron ([R9.3](#R9.3)), tylko na drodze przeglądarki
człowieka. Tak samo pilnuje wbudowanej przeglądarki aplikacji Claude
([R12.2](R12-where-the-agent-works.md#R12.2)).

- **Pilnuje kod (hook przed otwarciem strony):**
  - archiwum tylko przez przeglądarkę człowieka i skany archiwum z ograniczeniem otwierają się tylko za zgodą **przez
    przeglądarkę**, po jednej stronie, w tempie człowieka. Zakazane ścieżki z listy archiwów zostają zamknięte;
  - archiwum zakazane, witryna, która odrzuciła klienta strom, ścieżka zakazana w robots.txt, skany tylko ręcznie
    i most do aplikacji Strom: odrzucone;
  - każde otwarcie strony zapisuje się, liczy i zwalnia razem z pobraniami tej samej witryny (te same granice co
    [R9.3](#R9.3));
  - narzędzia na stronie (klikanie, czytanie strony, skrypt) sprawdza się według witryny ostatniego otwarcia w karcie.
    Witryna, której strom obecnie daje spokój, jest odrzucona; reszty się nie liczy;
  - przesłanie pliku, przesłanie obrazu, skróty, nagranie GIF i partia akcji są agentowi zakazane.
- **Granice:** hook nie widzi kliknięcia ani adresu wpisanego na stronie, ani zapytań, które strona wykonuje sama.
  Stąd zasada: ze strony na stronę archiwum tylko przez otwarcie adresu, nigdy przez przeklikiwanie szeregu stron.
- **Tylko metodyka:** sprawdzenia, czy przy komputerze jest człowiek (Altcha, CAPTCHA, kontrola botów), agent nigdy
  nie przechodzi ani nie obchodzi.
- **Dlaczego:** tylko przy Claude Code strom może uruchomić hook przed otwarciem strony; u pozostałych agentów
  takiego hooka nie ma (sprawdzono 4.11.2026).
- **Obsługa:** terminal: `strom doctor` (wiersz **przeglądarka (Claude in Chrome)**), `strom agents use claude`.
- **Obowiązuje od:** badanie 1.27.0

<!-- zdroj: research:src/core/chromehook.ts:1-25 (navigate, page tools, what the hook cannot see) · src/core/webgate.ts browserGate · src/core/browser.ts CHROME_DENY · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS · assets/lang/cs.json ui.doc.browser · CHANGELOG.cs.md 1.27.0 -->

<a id="R9.4.1"></a>
### R9.4.1 Kiedy sesja dostaje Chrome

- Ustawienie `agent.browser` obowiązuje dla sesji Claude Code, które uruchamia strom:
  - **archives** (domyślne): Chrome tylko w badaniu, którego program pobierający pobiera przez przeglądarkę, albo
    z archiwum tylko przez przeglądarkę ze zgodą **przez przeglądarkę**, dla ich witryn;
  - **always**: Chrome w każdej sesji, dla witryn archiwów badania; o inne witryny czat zapyta. Włącza je tylko
    człowiek.
- Sesja automatyczna włącza Chrome według zadania: nie dla opowieści i zapytań, tak dla księgi z programu
  pobierającego przez przeglądarkę, dla archiwum tylko przez przeglądarkę ze zgodą i dla witryny, której badanie nie
  zna. Czat dostaje Chrome według ustawienia powyżej.
- W sesji automatycznej agent nie może przełączyć się na inną przeglądarkę ani pytać człowieka.
- **Obsługa:** terminal: `strom config set agent.browser archives|always`.
- **Obowiązuje od:** badanie 1.14.0. Archiwum tylko przez przeglądarkę ze zgodą od 1.27.0.

<!-- zdroj: research:src/core/connector.ts agentBrowser, sessionBrowser · src/commands/start.ts:244 chrome · src/runners/claude.ts RUN_DISALLOWED (AskUserQuestion, switch_browser) · src/core/config.ts agent.browser -->

<a id="R9.4.2"></a>
### R9.4.2 Wbudowane przeglądarki i sterowanie komputerem: niepolecane

- W badaniu nic z aplikacji desktopowych agentów się nie wyłącza. Wbudowanej przeglądarki aplikacji Claude (także jej
  podglądu) strom pilnuje jak Claude in Chrome ([R12.2](R12-where-the-agent-works.md#R12.2)). Przeglądarka aplikacji
  ChatGPT (Codex) działa przez chmurę ChatGPT i strom jej nie pilnuje, niezależnie od tego, czy hook stroma jest
  w Codexie potwierdzony; o stronach decyduje okno dialogowe ChatGPT
  ([R12.5.1](R12-where-the-agent-works.md#R12.5.1)). Przeglądarki Codexu w terminalu strom pilnuje według adresów
  w jej kodzie, gdy człowiek potwierdzi hook stroma ([R12.5](R12-where-the-agent-works.md#R12.5)). Sterowania komputerem aplikacji Claude ani aplikacji ChatGPT strom
  nie pilnuje ([R12.10](R12-where-the-agent-works.md#R12.10)). Żadnego z nich strom nie poleca.
- **Tylko metodyka:** agent nie używa ich sam z siebie: nie wchodzi z nimi do archiwum, do którego wolno tylko
  przeglądarce człowieka, a skany zapisuje człowiek ([R9.6](#R9.6)). Gdy człowiek wyraźnie o nie poprosi, to wybór
  człowieka: agent jednym zdaniem mówi, czy strom tej drogi pilnuje, i co mówią warunki archiwum. Warunków nigdy
  nie obchodzi, a sprawdzenia, czy przy komputerze jest człowiek, nigdy nie przechodzi.
- Agent nigdy nie pracuje w kopii badania, którą aplikacja desktopowa agenta otwiera we własnym worktree.
- **Dlaczego:** przed niepilnowanymi strom nie ma żadnego hooka, więc nie sprawdza stron, które otwierają. Program
  pobierający archiwum, pobieranie stron witryny i przeglądarka agenta w Chrome zawsze kierują się zasadami archiwów
  ([R9.3](#R9.3), [R9.4](#R9.4)).
- **Obsługa:** terminal: `strom doctor`, wiersz **przeglądarka aplikacji desktopowych**.
- **Obowiązuje od:** badanie 1.27.0; 1.29.0: wbudowana przeglądarka aplikacji Claude i przeglądarka Codexu pilnowane;
  1.30.0: przeglądarki aplikacji ChatGPT strom nie pilnuje

<!-- zdroj: research:src/core/browserhelp.ts ON_REQUEST, browserKept · src/core/browser.ts CODEX_BROWSER_SERVERS, Claude_Browser matcher · src/brief/brief.ts · src/commands/guide.ts · src/commands/setup.ts:527 desktop · assets/lang/cs.json ui.doc.desktop.unwatched · CHANGELOG.cs.md 1.27.0, 1.29.0 · research:v1.30.0 (33ac2e38) src/core/browserhelp.ts codexInChatgptApp, browserKept; assets/lang/pl.json ui.doc.desktop.codex; CHANGELOG.pl.md 1.30.0 · dirigent:test/vysledek-062-u4-codex.md · 1.29.0 (53dba68d; dev 6968ab72): agent řekne, zda strom cestu hlídá -->

<a id="R9.4.3"></a>
### R9.4.3 Stan przeglądarki w strom doctor i w aplikacji

Wiersz **przeglądarka (Claude in Chrome)** w `strom doctor` przy archiwach tylko przez przeglądarkę, z którymi
badanie pracuje:

| Stan | Co mówi wiersz |
|---|---|
| inny agent niż Claude Code | tylko przez przeglądarkę człowieka; z Claude Code i rozszerzeniem agent zapisałby skany sam, z tym agentem zapisuje się je ręcznie (rada `strom agents use claude`) |
| brak rozszerzenia | tylko przez przeglądarkę człowieka; z rozszerzeniem Claude in Chrome agent zapisałby skany sam, do tego czasu ręcznie (z odnośnikiem do rozszerzenia) |
| brak zgody | ze zgodą „przez przeglądarkę” dla archiwum agent zapisze skany sam |
| wszystko gotowe | agent zapisuje skany sam przez przeglądarkę |

- Tę samą radę podaje raz brief agenta i Co czeka ([R9.6](#R9.6)).
- Aplikacja pokazuje wiersz **Przeglądarka** pod wierszem **Agent** w oknach **Badanie dla drzewa** i **Badanie jest
  gotowe**: **Claude in Chrome połączony.**, z archiwami tylko przez przeglądarkę **… agent pobiera też z archiwów
  dostępnych tylko przez przeglądarkę** (gdy przy niektórych brak zgody: **Bez zgody:** pierwsze trzy archiwa, każde
  z odnośnikiem **Zgoda…**), **Brak rozszerzenia Claude in Chrome – skany z archiwów dostępnych tylko przez
  przeglądarkę zapisuje człowiek.** albo przy innym agencie **przeglądarki tego agenta Strom nie śledzi**. Przy
  pozycji, która czeka na skany takiego archiwum, stoi ta sama rada jako notatka. Badanie, które służy jako archiwum,
  tego wiersza nie ma.
- **Obsługa:** terminal: `strom doctor`. Aplikacja: okno **Badanie dla drzewa**, Czeka na załatwienie.
- **Obowiązuje od:** badanie 1.27.0

<!-- zdroj: research:src/commands/setup.ts:490-516 · src/core/browserhelp.ts browserState, agentBrowserAdvice, personBrowserNote · assets/lang/cs.json ui.doc.browser.archives.* · app:src/research-browser.ts:75-98 browserRow, :170-201 browserNote · src/ui/research-browser-ui.ts:96-144 · src/strings.ts research.browser -->

<a id="R9.5"></a>
## R9.5 Skan przez przeglądarkę agenta

Gdzie człowiek dał archiwum tylko przez przeglądarkę zgodę **przez przeglądarkę**, agent zapisuje skany sam, po
jednym: otwiera skan w Chrome i zapisuje to, co pokazuje przeglądarka skanów archiwum.

- **Pilnuje kod:**
  - tylko Claude Code z rozszerzeniem Claude in Chrome i ze zgodą **przez przeglądarkę**; w przeciwnym razie
    polecenie odmawia i mówi, czego brakuje;
  - adres skanu przechodzi kontrolę przeglądarki agenta ([R9.4](#R9.4));
  - zapisuje się tylko skan, który karta pokazuje pod swoim własnym adresem. Przeglądarka przesunięta na inny skan
    zostaje odrzucona i nic się nie zapisuje. Nigdy więcej, niż daje przeglądarka archiwum, nigdy większy niż
    oryginał;
  - zapisywanie czeka, aż przeglądarka archiwum pokaże cały skan, najwyżej 30 s (przeglądarka, która rysuje kartę powoli: [R9.5.2](#R9.5.2)). Od badania 1.31.0 liczy się tylko
    czas, gdy przeglądarka rysuje kartę (nie rysuje karty za inną kartą ani w zakrytym lub zminimalizowanym oknie).
    Karta nierysowana przez 30 s zostaje zgłoszona jako taka („the browser did not draw the tab with the viewer for
    30 s …”: karta na wierzch, okno odkryte, potem skrypt jeszcze raz); przeglądarka archiwum, która w tym czasie
    przejdzie na inny skan, nie zapisuje nic;
  - polecenie ustawia zadanie na oczekiwanie na ten skan. Plik zapisuje się do folderu pobranych plików jako
    `strom-<znacznik badania>-T…-<numer>.jpg` (np. `strom-3f2a9c1b-T0007-0040.jpg`, numer skanu czterocyfrowo), a
    `strom media add --inbox --waiting` przenosi go do folderu zadania pod numerem skanu ([R9.6](#R9.6));
  - znacznik badania to pierwsze 8 znaków szesnastkowych jego id. Folder pobranych plików dzielą wszystkie badania
    komputera: plik innego badania nigdy nie zostaje wzięty. Plik zapisany przed badaniem 1.33.0
    (`strom-T…-<numer>.jpg`, bez znacznika) przejmuje tylko badanie, którego zapis o zapisaniu podaje tę nazwę;
  - kopię, którą przeglądarka zapisze późno lub dwa razy („… (1).jpg”), `strom media add --inbox --waiting` usuwa z
    folderu pobranych plików, gdy skan jest już w badaniu (zapis o zapisaniu trzyma się 14 dni). Nigdy pliku, któremu
    strom nie nadał nazwy;
  - bez `--recordset` księga jest ta, na którą czeka zadanie, w przeciwnym razie jedna z ksiąg zadania w archiwum
    adresu `--at`. Kilka takich ksiąg strom wymienia i nic nie zapisuje;
  - przeglądarka skanów, która jest na stronie, ale strom do niej nie sięga, zostaje zgłoszona: nic się nie zapisuje,
    a komunikat mówi, co zrobi człowiek (zapisze skan w swojej przeglądarce do folderu zadania).
- **Granice:** Chrome zapisuje z jednej strony tylko jeden plik. Na kolejne pobrania z tej samej strony musi zezwolić
  człowiek w pasku adresu Chrome; agent nigdy nie zmienia ustawień Chrome. Skan, którego pliku nie ma w folderze
  pobranych plików nawet 5 s po poleceniu zapisu, `strom media add --inbox --waiting` uznaje za wstrzymany: mówi to
  agentowi, a oczekiwanie zadania mówi człowiekowi, której witrynie zezwolić na pobieranie wielu plików („przeglądarka
  wstrzymała skan {n}: zezwolić witrynie {witryna} na pobieranie wielu plików, jednorazowo (ikona po prawej stronie
  paska adresu przeglądarki)”). Na pobieranie, które jeszcze się zapisuje (`.crdownload`, `.part` i podobne),
  polecenie krótko czeka; gdy i wtedy się nie skończy, mówi to i nie uznaje go za wstrzymane.
- **Tylko metodyka:** program pobierający archiwum, którego przeglądarka pokazuje skany kafelkami, także zapisuje
  przez przeglądarkę, nawet część skanu; stronę księgi otwiera raz i nigdy jej nie odświeża.
- **Dlaczego:** zgoda „przez przeglądarkę” pozwala na to, co zrobiłby człowiek w swojej przeglądarce, w jego tempie.
- **Obsługa:** terminal (agent): `strom media save T… --image <numer> --at <adres> [--recordset B…]`, potem
  `strom media add --inbox --waiting`.
- **Obowiązuje od:** badanie 1.27.0. Wstrzymany skan jest zgłaszany od badania 1.30.0, nierysowana karta od 1.31.0.
  Znacznik badania w nazwie pliku, księga bez `--recordset`, sprzątanie późnych kopii, czekanie na zapisywane
  pobieranie i nieosiągalna przeglądarka skanów od 1.33.0.
- **Od badania 1.37.0 (kilka skanów naraz):**
  - `--image 40,41,45` albo `--image 40-45` (najwyżej 10 skanów) z jednym `--at` do każdego w ich kolejności albo
    z jednym adresem z `{n}` w miejscu numeru daje jeden krótszy skrypt dla wszystkich. Skrypt rozpoznaje skan po
    adresie karty i inną stronę odrzuca;
  - każdy skan jest nadal na własnej stronie, którą agent otwiera w ludzkim tempie pod pilnowaniem strom; żaden
    zakres. Jedno `strom media add --inbox --waiting` po ostatnim przejmuje wszystkie;
  - skan z listy, którego strona nie została jeszcze otwarta, nigdy nie liczy się jako zatrzymany przez przeglądarkę;
  - Claude Code przy więcej niż trzech skanach przekazuje je pomocnikowi drzewa `strom-image-saver`: mały kontekst,
    tylko narzędzia, których zapisanie potrzebuje, najwyżej 10 skanów na wywołanie, model `model.cheap` osoby,
    inaczej model agenta, który go uruchomił. Jego strony liczą się razem ze stronami agenta i obowiązuje je to samo
    pilnowanie.
- **Od badania 1.37.0 (oczekiwanie):** dopóki sesja agenta zapisuje skany, zadanie nie czeka na człowieka, a aplikacja
  Strom pokazuje je jako pracę agenta ([R6.1](R6-awaiting-action.md#R6.1)). Na człowieka czeka: skan zatrzymany przez
  przeglądarkę (powiedziane od razu na początku oczekiwania), zapisywanie zatrzymane końcem sesji (kontynuuje je
  następna sesja albo skany zapisuje człowiek; [R6.2.1](R6-awaiting-action.md#R6.2.1)) i oczekiwanie, które agent dla
  tego samego zadania zapisze sam (`strom task wait --images` po `strom media save`): niedokończone zapisy są
  odrzucane, a zadanie jest od razu w **Co czeka** z jego słowami. Zadanie czekające na skan, którego stronę
  pilnowanie odrzuciło (wyczerpany limit witryny), wraca z końcem sesji do kolejki z notatką, które skany zostały.

<!-- zdroj: research:a4a2f6c0 src/core/browser.ts SaveRecord, HELD_AFTER_MS 5000 · src/commands/media.ts heldSaves, heldLine (media add --inbox --waiting) · assets/lang/cs.json browser.wait.held · research:src/commands/media.ts:1206-1294 media save (browserGate, guarded browser, permission browser) · commit dadd91e7 (viewer paged on) · src/core/browserhelp.ts agentBrowserAdvice · src/agents/files.ts:80-95 · CHANGELOG.cs.md 1.27.0 · research:c6b6444d, dee0bb03 src/core/browser.ts VIEWER_HIDDEN_MS = 30_000, CAPTURE_JS (čekání jen na snímky kreslené karty, NOT_SHOWN, „the viewer's tiles did not all come in 30 s“, „the viewer was paged to another image … nothing saved“) · CHANGELOG.cs.md 1.31.0 · 1.33.0: research:7306f2a7 src/core/browser.ts researchMark (8 hex z id), waitFileBase (strom-<značka>-T…-NNNN), staré jméno jen podle SaveRecord.file · f6de01b7 src/commands/media.ts saveBookOf (kniha bez --recordset), tidyDownloads, TAKEN_KEEP_MS 14 dní · 903ce928 media add --inbox --waiting (zapisované stahování, STROM_DOWNLOAD_WAIT_MS, heldSaves dl.unfinished) · f5339b36 findViewer (OpenSeadragon v kódu stránky), hláška „strom cannot reach it … nothing saved“ · strom help media save · CHANGELOG.cs.md 1.33.0 · 1.37.0: research:66ef4451 src/commands/media.ts media save (--image seznam nebo rozsah, nejvýš 10, --at ke každému nebo {n}; skript pozná snímek podle adresy karty; neotevřená stránka není zadržená), agent strom-image-saver (model.cheap, delegate hook) · 81de7cdb, aae8f1aa src/core/waiting.ts savedByAgentNow, waitOnNow · 1c8a4380 (task wait --images po media save: uložení zahozena, čekání hned člověka) · src/core/ownsave.ts unsavedOwnWait, saveNeverOpened (návrat do fronty s koncem sezení) · CHANGELOG.cs.md 1.37.0 -->

<a id="R9.5.1"></a>
### R9.5.1 Ostrzejsza kopia skanu

Skan, który jest już w badaniu, a do czytania jest za słaby, agent zapisuje przez przeglądarkę jeszcze raz: z
przeglądarką archiwum przybliżoną albo w pełnej rozdzielczości.

- **Pilnuje kod:**
  - `strom media save … --again` zapisuje zarejestrowany skan jako nową kopię obok starej; nic się nie usuwa;
  - obrazem skanu jest cała kopia z największą liczbą pikseli (szerokość × wysokość). Widok, czytanie i wycinki przez
    `B…:<numer>` biorą ją; cytat, który już wskazuje na konkretną kopię (`M…`), przy niej zostaje;
  - dopóki nowa kopia nie przyjdzie, zadanie dalej czeka na skan. Jeśli przyjdzie ten sam skan, nic nie rejestruje się
    dwa razy, a zadanie wraca do kolejki;
  - bez `--again` zapisanie zarejestrowanego skanu zostaje odrzucone, a komunikat proponuje `--again`. Brief przy
    słabych skanach archiwum, do którego chodzi przeglądarka agenta, proponuje `--again` zamiast prośby do człowieka.
- **Granice:** tylko cały skan, nie jego wycinek.
- **Obsługa:** terminal (agent): `strom media save T… --image <numer> --recordset B… --at <adres> --again`.
- **Obowiązuje od:** badanie 1.33.0
- **Od badania 1.37.0:** `strom media add --inbox --waiting` przejmuje kopię zapisaną z `--again` od razu: ten
  sam skan, ostrzejszy, idzie obok jako kopia (obrazem jest ta z największą liczbą pikseli), inny skan staje się
  obrazem, a dotychczasowy zostaje wycofany i zachowany (ten, który cytuje źródło, zostaje obok). Nic nie jest
  odkładane ani potwierdzane, żadnego `strom media aside --take` przy każdym skanie.
- **Od badania 1.37.0 (zrzut ekranu):** porządnie zapisana kopia ma pierwszeństwo przed zrzutem ekranu, nawet gdy ma
  mniej pikseli. Kopia uchodzi za zrzut ekranu, gdy jej pierwotna nazwa jest nazwą zrzutu ekranu (albo jest to PNG
  obok JPEG) i jej proporcje boków różnią się od innej kopii skanu o więcej niż 15 %. Kopia pobrana przez program
  pobierający albo zapisana przez przeglądarkę agenta (nazwa `strom-…-T…-NNNN.jpg`) nigdy nie jest zrzutem ekranu.
  W przeciwnym razie obowiązuje kolejność według pikseli. Oblicza się to za każdym razem z zapisów, więc tak samo
  czyta to starsze badanie.
- **Od badania 1.37.0 (cytaty na inną kopię):** `strom media cites M…` wypisuje źródła, które cytują kopię, i inne
  kopie tego samego skanu; z `--move-to M…` przenosi je na inną kopię całego skanu (każde źródło jedną zmianą; stara
  kopia zostaje i nie jest wycofywana). Wycinek miejsca idzie z nimi tylko wtedy, gdy strom rozpozna oba pliki jako
  ten sam skan tak samo obrócony i nie chodzi o zrzut ekranu obok skanu; inaczej zostaje na starej kopii, a wypis
  podaje polecenia do jego ponownego zaznaczenia. Wycinek całego skanu idzie zawsze. Nic nie przenosi się samo;
  `--dry-run` mówi, co by się stało.

<!-- zdroj: research:6651b60b src/commands/media.ts media save --again, againPending, settleAgain · src/core/media.ts findImage (nejvíc pixelů, ne část) · src/core/browser.ts SaveRecord.again · strom help media save (--again) · dirigent:prace/1114-vyzkum-z-hlidani-2/vysledek-sub1.md (A2, otevřené: výřez ne; citace na M… zůstávají) · CHANGELOG.cs.md 1.33.0 · 1.37.0: research:66ef4451 (--again převzato hned, bez media aside --take) · a2fe388d src/core/media.ts rankCopies (jméno snímku obrazovky, poměr stran > 15 %), src/commands/media.ts media cites --move-to (výřez jen u téhož skenu, jinak příkazy) · d93be067 (PNG vedle JPEG; savedProperly: stahovač nebo jméno strom-…) · 0c7ed4d3 · strom help media cites · CHANGELOG.cs.md 1.37.0 -->

<a id="R9.5.2"></a>
### R9.5.2 Przeglądarka, która rysuje kartę powoli

Przeglądarka skanów archiwum, która składa skan z kafelków (OpenSeadragon, np. ACTA PUBLICA), prosi mniej więcej
o jeden kafelek przy każdym narysowaniu karty. Gdzie przeglądarka rysuje kartę tylko mniej więcej raz na sekundę,
kafelki jednego skanu trwają minuty, a zapisywanie kończy się po 30 s komunikatem „the viewer's tiles did not all come
in 30 s …”.

- **Najpierw przeglądarka:** powoli rysuje się karta bez akceleracji graficznej, na pulpicie zdalnym lub w maszynie
  wirtualnej. W Chrome: w `chrome://settings/system` włączyć akcelerację graficzną i uruchomić Chrome ponownie;
  `chrome://gpu` pokazuje, czy Canvas i Compositing nie są „Software only” (wtedy pomaga nowszy sterownik grafiki).
  Pole „last frame … s ago” w komunikacie mówi, jak dawno przeglądarka ostatnio narysowała kartę.
- **Pilnuje kod:**
  - ustawienie `browser.tileWait` jest ukryte: ani `strom config where`, ani `strom help config` go nie pokazują,
    dopóki nie jest ustawione. Przyjmuje całe sekundy od 60 do 600 (zalecane 180), inną wartość odrzuca z podpowiedzią.
    Jest zapisane w ustawieniach użytkownika i obowiązuje dla wszystkich badań na komputerze;
  - nieustawione: na kafelki czeka się 30 s jak dotąd; komunikat „tiles did not all come in 30 s” mówi ponadto
    agentowi, że pomoże `strom config set browser.tileWait 180`, a potem to samo polecenie strom jeszcze raz (nowy
    skrypt);
  - ustawione: dopóki kafelki jeszcze przychodzą (któryś w ostatnich 10 s), skrypt czeka dalej, dopóki przychodzą.
    Kończy po 30 s bez nowego kafelka, najpóźniej po ustawionym czasie;
  - jedno wywołanie skryptu po 35 s odpowiada „strom-wait …”: agent uruchamia ten sam skrypt jeszcze raz w tej samej
    karcie, a ten czeka dalej tam, gdzie był. Liczy się dopiero ostatnia odpowiedź „strom-result …”; z odpowiedzi
    „strom-wait” `strom fetch … --take` niczego nie przejmuje;
  - dotyczy `strom media save` ([R9.5](#R9.5)) i programu pobierającego, który przez przeglądarkę zapisuje
    z przeglądarki skanów archiwum (`strom fetch`, [R8.2](R8-reading-scans.md#R8.2)).
- **Granice:** karta rysowana szybko zapisuje się tak samo z ustawieniem i bez niego. Bez ustawienia nic się nie
  zmienia.
- **Dlaczego:** kafelki przychodzą tylko tak szybko, jak przeglądarka rysuje kartę; 30 s zostaje dla wszystkich innych.
- **Obsługa:** terminal: `strom config set browser.tileWait 180`, powrót do 30 s: `strom config unset browser.tileWait`.
- **Obowiązuje od:** badanie 1.32.0

<!-- zdroj: research:75245c94 src/core/browser.ts TILE_WAIT_MIN_S 60, TILE_WAIT_MAX_S 600, TILE_WAIT_SUGGESTED_S 180, TILE_RECENT_MS 10_000, TILE_QUIET_MS 30_000, WAIT_CALL_MS 35_000, CAPTURE_JS ("the viewer's tiles did not all come in 30 s" + věta strom config set browser.tileWait 180; "last frame … s ago"), "strom-wait" · src/core/config.ts browser.tileWait (hidden, tree false, rozsah, hint config unset) · src/commands/media.ts:1686 media save · src/commands/connectors.ts:3152 viewerScript, takeOver (strom-wait nic nepřevezme) · test/cli/connector-mza.test.ts:303 (skryté do nastavení: config where, help config) · CHANGELOG.cs.md 1.32.0 · dirigent:prace/1112-vyzkum-dlazdice-pokrok/karta.md (OSD ~1 dlaždice na snímek; závěr 2: grafická akcelerace, chrome://gpu, neověřeno u reportéra) -->

<a id="R9.6"></a>
## R9.6 Oczekiwanie na skany i powrót zadania

Gdzie agent skanów nie zdobędzie, zadanie czeka na człowieka. Badanie podaje księgę i numery skanów i przygotowuje dla
nich folder. Zadanie wraca do kolejki samo, gdy w badaniu są wszystkie jego skany.

- **Pilnuje kod:**
  - `strom task wait T… --images B…:<numery>` przygotowuje folder `inbox/<B… tytuł księgi>` w folderze współdzielonym
    (nazwa najwyżej 80 znaków);
  - plik nosi numer skanu (`40.jpg`, `9a.jpg`). Inaczej nazwane pliki numeruje się według kolejności, gdy jest ich
    tyle, ile skanów brakuje;
  - plik zostaje przejęty, gdy przez 3 s się nie zmienia (duży skan nigdy nie zostanie przejęty w połowie);
  - przejęcie: od razu, gdy działa most do aplikacji Strom (zagląda do folderów czekających zadań, ponownie co
    30 s); w przeciwnym razie przy starcie kolejnej sesji; albo od razu poleceniem `strom media add --inbox --waiting`;
  - `strom media view B…:<numer>` skanu, na który czeka zadanie, mówi, kto na niego czeka (przeglądarka agenta, plan
    programu pobierającego w przeglądarce albo człowiek) i dokładny następny krok (od badania 1.33.0);
  - zadanie wraca, gdy są tam wszystkie skany, z notatką, co przyszło. Przy części czeka dalej, a Co czeka pokazuje,
    ile zapisano z ilu i których brakuje;
  - skany z aplikacji idą prosto do zadania: ponumerowane według skanu, który poda aplikacja, w przeciwnym razie
    według nazwy pliku, w przeciwnym razie według kolejności brakujących; PDF strona po stronie. Skan z numerem, który
    badanie już ma, zostaje odrzucony, jeśli nie ma go zastąpić; zastąpiony nigdy nie zostaje usunięty. Plik
    identyczny z innym, już przejętym skanem (inny numer lub księga), zostaje odrzucony i nic nie zostaje przejęte.
    Ten sam plik wysłany ponownie pod tym samym numerem niczego nie zmienia i jest zgłaszany jako zapisany;
  - odpowiedź napisana w aplikacji przywraca zadanie tak samo jak odpowiedź w terminalu i zapisuje się z notatką, że
    przyszła z aplikacji. Zadanie, które w międzyczasie czeka na coś innego, zostaje bez zmian.
- **Granice (kiedy skany przywracają zadanie):**
  - zadanie czekające na skany przywraca tylko jego księga, i to dopiero gdy są wszystkie;
  - zadanie czekające na witrynę (`--kind web`) przywraca księga, którą wymienia, albo jedyna księga, w której
    pracuje; od badania 1.35.0 zamiast niej księga, pod którą czeka ([R6.8.4](R6-awaiting-action.md#R6.8.4));
  - list i zapytanie do rodziny przywraca tylko księga, którą wymieniają;
  - zadania czekającego na sprawdzenie witryny przez człowieka skany nie przywracają nigdy (odpowiada tylko człowiek).
- **Tylko metodyka (metodyka, `strom guide` i brief agenta jednakowo):** przy ręcznych skanach agent podaje księgę,
  numery skanów, format (JPEG), nazwę pliku i folder. Sam nic nie otwiera i nie pobiera, nawet przeglądarką. Jedyny
  wyjątek: przy archiwum tylko przez przeglądarkę człowieka, któremu człowiek dał zgodę **przez przeglądarkę** i do
  którego nie prowadzi program pobierający, Claude in Chrome zapisuje skany po jednym poleceniem `strom media save`
  ([R9.5](#R9.5)). Nic innego agent tam nie otwiera ani nie pobiera; sprawdzenie, czy przy komputerze jest
  człowiek, przechodzi tylko człowiek.
- **Dlaczego:** skany to to, na co zadanie czekało; część skanów zadania nie kończy.
- **Obsługa:** terminal: `strom task wait T… --images B…:40-45`, `strom media add --inbox --waiting`, w Co czeka
  **Otwórz folder (zapisano M/N)**. Aplikacja: Czeka na załatwienie, przy pozycji w tej kolejności **Dodaj
  skany**, **Otwórz stronę ↗**, **Odpowiedz**, **Omów z agentem**, **Otwórz folder** (dwa ostatnie otwierają badanie
  w terminalu); od aplikacji 3.30.0 blok **Dostarczyć** z krokami i odnośnik **Skanów nie da się uzyskać…**
  ([S4.4.7](S4-research-from-the-app.md#S4.4.7)). Stan skanów pokazuje „1 z 2 skanów”, a przy księdze chipy **zapisany** / **brak**. Witryny jednego
  archiwum czekają w jednej grupie **Archiwum** pod nazwą archiwum, z odnośnikiem **Strona archiwum ↗** i liczbą
  brakujących skanów.
- **Granice (grupa archiwum):** grupą jest archiwum badania, do którego należy zadanie: według księgi zadania, adresu
  archiwum, adresu jego księgi, innej witryny tego samego archiwum według listy archiwów albo nazwy archiwum. Tylko
  gdy badanie takiego archiwum nie ma, grupą jest archiwum z listy archiwów; w przeciwnym razie sama witryna.
- **Granice (aplikacja):** odpowiedź najwyżej 4000 znaków; na zadanie czekające na sprawdzenie witryny odpowiada się
  tylko w terminalu. Na telefonie nie dodaje się skanów ani nie otwiera terminala.
- **Obowiązuje od:** badanie 1.0.0 (folder w `inbox/`), budzenie po zapisaniu od 1.15.0. Przejęcie bez polecenia,
  części skanów, odpowiedź i skany z aplikacji oraz archiwum pod jedną nazwą od badania 1.27.0 i aplikacji 3.23.0.
- **Od badania 1.35.0:** strom bierze także foldery ksiąg, których potrzebują zadania i na które nic nie czeka, tylko
  według numeru w nazwie pliku ([R6.8.2](R6-awaiting-action.md#R6.8.2)).
- **Od badania 1.35.0:** samo zadanie wraca tylko wtedy, gdy jego czekanie jest zapisane według numerów skanów lub
  księgi badania; czekanie zapisane inaczej znajduje `strom task audit` ([R6.9](R6-awaiting-action.md#R6.9)).
- **Od badania 1.35.0 (pliki w folderze):**
  - kopia, którą obok pliku zrobił menedżer plików lub przeglądarka, nosi numer pliku pierwotnego: „33 2.jpg”,
    „33 kopie.jpg”, „33 copy.jpg”, „33 - Copy (2).jpg” i „33 (1).jpg” to skan 33, „33a 2.jpg” skan 33a. Same
    „ 2” do „ 9” za nazwą bierze się jako przyrostek kopii tylko za nazwą, która jest samą liczbą (z ewentualną
    literą);
  - według kolejności się nie numeruje, gdy któryś plik ma nazwę z samej liczby (`1.jpg` to skan 1, nie brakujący
    33): numeru, który nadał człowiek, kolejność nie przebija; nazwę z portalu albo datę i czas zrzutu ekranu tak;
  - plik, który jest tym samym skanem co skan już przejęty pod innym numerem lub w innej księdze, nie zostaje przejęty
    ani usunięty: odkłada się obok jako `<plik>.same-as-M…` (pod tą nazwą nie zostanie już nigdy przejęty), a wypis
    `strom media add --inbox`, wpis mostu i wyjście JSON mówią, dla którego skanu był, którym skanem jest i że jeden
    z obu numerów jest błędny. Gdy zmiana nazwy się nie uda, plik zostaje w folderze i mówi się to samo;
  - pliki `.jp2` z portalu Moravský zemský archiv przelicza się z powrotem ([R6.8.2](R6-awaiting-action.md#R6.8.2))
    także w folderze czekającego zadania.
- **Od badania 1.37.0 (skany zapisane ręcznie):**
  - numer skanu może być w dowolnym miejscu nazwy (`__0236.jpg`, `Lhota_11__125.jpg`, `fond12_kniha3_236.jpg`):
    z kilku liczb ta, która należy do chcianych skanów, ta, która zmienia się między plikami folderu, inaczej
    ostatnia przed rozszerzeniem. Data i godzina zrzutu ekranu nigdy nie są brane za numer, ani rok za numerem
    (`33 1784.jpg`), gdy nie wiadomo, które skany; nazwa z dwoma chcianymi numerami nie jest zgadywana, lecz
    zgłaszana;
  - plik, z którego nie da się rozpoznać numeru skanu (`000.jpg`), nie wstrzymuje pozostałych: zostaje w folderze
    i jest zgłaszany raz, bez rady, by zmienić nazwę;
  - pliki nazwane według aktów na nich (`001-004.jpg`) albo własnymi numerami portalu są przejmowane w kolejności
    folderu jako kolejne skany księgi, gdy przez 20 minut nic więcej się nie zapisze. Akty zostają zapisane przy
    skanie, a zadanie wraca z listą, który plik jest którym skanem;
  - kolejny arkusz pod tym samym numerem (`7a.jpg`) jest rozpoznawany po zawartości: kopia, powiększona część skanu
    albo osobny skan zapisany pod własną nazwą; nigdy nie jest ukrywany jako kopia tylko według nazwy. Dotyczy to tej
    samej i późniejszej partii, po powrocie zadania i przy `strom media add --inbox <folder>`;
  - zadanie, do którego przyszła tylko część skanów, wraca po 20 minutach ciszy z tym, co przyszło i czego brakuje;
    nigdy wcześniej. Skan na granicy dwóch roczników liczy się raz;
  - pliki nazwane numerem skanu są brane jak dotąd; nic nie jest przenumerowywane. Stan, menu i dziennik mostu mówią,
    kiedy folder zostanie przejęty i co zostało w folderze (czas lokalny).

<!-- zdroj: research:src/commands/tasks.ts:1041 task wait (--images, folder) · src/core/media.ts:117 inboxFolderFor · src/core/inboxwait.ts:25 SETTLE_MS · src/core/inboxwatch.ts:1-8 (30 s) · src/commands/media.ts:141-180 wakeWaiting · src/core/live.ts waiting/<T> answer, PUT /media (X-Strom-Task, X-Strom-Image, 409 waiting.image-same) · src/commands/media.ts:403-478 (same sha under its number → 200 same: true, added []; another number/book → 409 waiting.image-same) · src/core/waiting.ts actionsOf, archiveGroup · src/core/waitkind.ts waitGroupOf (repo: before archive:, host:) · assets/method/waiting.md "Images saved by hand" (the one exception, 7bd55fa1) · assets/method/reading.md · src/commands/guide.ts rule 7 · src/agents/files.ts:80-95 · CHANGELOG.cs.md 1.27.0 · app:CHANGELOG.cs.md 3.23.0 · src/research-waiting.ts:216-272 (actions, order), :448-488 assignImages · src/research-waiting-write.ts:532 WAITING_ANSWER_MAX · src/ui/research-overview-ui.ts:698-812 group head · src/strings.ts live.waitingTask · 1.33.0: research:bfa01a34 src/commands/media.ts media view (snímek, na který úkol čeká: kdo a další krok) · research:dddeb8a6 src/core/media.ts copyless (COPY_WORD copy/kopie/kopia/…, COPY_PAREN, COPY_BARE jen za číslem), namedByNumber · src/core/inboxwait.ts numberFiles (pořadí jen bez souboru pojmenovaného samým číslem; times .jp2 i u čekajících), bookTimes · src/commands/media.ts registerImages clashed, takeFiles (kolize → rename `${f}.same-as-${same}`, jinak leží; SetAside), asideLine (live.log, výpis ⚠, aside v JSON) · research:18fd10ec COPY_BARE \p{Nd}+\p{L}? („33a 2.jpg“) · CHANGELOG.cs.md 1.35.0 (research:e263eacb) · 1.37.0: research:62e335eb src/core/inboxwait.ts (000.jpg leží, akty jako záznamy, cizí jména v pořadí složky po STROM_INBOX_QUIET_MS 20 min, část snímků po tichu), 7a2a04cc src/core/media.ts findPart, 6fee0f71 (7a podle obsahu v každém převzetí i media add --inbox <složka>; soubor ležící schválně řečen jednou; místní čas) · src/core/media.ts (číslo kdekoli v názvu) · assets/method/waiting.md (sken na hranici jednou) · CHANGELOG.cs.md 1.37.0 · dirigent:spec/141 K1.1–K1.6, K2.2 -->

<a id="R9.7"></a>
## R9.7 Sesja automatyczna i czat

Zasady archiwów są w obu takie same. Różnią się tym, kto jest przy tym obecny i co dzieje się na granicy.

| | Sesja automatyczna (`strom run`, aplikacja, nocny przebieg) | Czat z agentem |
|---|---|---|
| Chrome | według zadania ([R9.4.1](#R9.4.1)) | według ustawienia `agent.browser` |
| pytanie agenta do człowieka | nie ma (AskUserQuestion wyłączone) | tak |
| przełączenie przeglądarki | wyłączone | dozwolone |
| ponad 30 zapytań do witryny | odrzucone | strom pyta raz na sesję i witrynę |
| zgoda archiwum | nikogo nie ma przy tym: polecenie kończy się błędem, agent zapisuje zadanie dla człowieka i idzie inną drogą | okno systemowe dla człowieka, tylko gdzie system je pokaże |
| skany, których agent nie zdobędzie | zadanie czeka na skany, sesja kontynuuje innym zadaniem | to samo; człowiek może zapisać skany od razu, a agent przejmie je poleceniem |

- **Granice:** agent nigdy nie pisze za człowieka: ani zgody, ani odpowiedzi na sprawdzenie witryny, ani odpowiedzi na
  oczekiwanie. W czacie należą one tak samo tylko do człowieka.
- **Obsługa:** zob. [R7](R7-when-the-agent-works.md) (kiedy i jak długo sesja działa).
- **Obowiązuje od:** badanie 1.14.0. Przeglądarka agenta od 1.27.0.

<!-- zdroj: research:src/runners/claude.ts RUN_DISALLOWED · src/core/web.ts WEB_PER_HOST (STROM_NONINTERACTIVE) · src/cli/context.ts:253 requireHuman (run: task for the person) · src/core/connector.ts sessionBrowser, agentBrowser · src/commands/start.ts:244 -->

<a id="R9.8"></a>
## R9.8 Co dzieje się z zadaniem: tabela

Zadanie potrzebuje skanów księgi z określonego archiwum. Wiersz wybiera się według archiwum i zgody. Gdzie tabela
mówi „Claude + Chrome”, chodzi o Claude Code z rozszerzeniem Claude in Chrome i z uruchomionym Chrome.

| Archiwum | Zgoda | Agent | Co agent robi | Jak kończy się zadanie |
|---|---|---|---|---|
| dozwolone | niepotrzebna | dowolny | program pobierający: katalog i skany w tempie usługi; bez programu pobierającego agent go buduje | skany w badaniu, odczyt ([R8](R8-reading-scans.md)) |
| ograniczone lub nieznane | żadna | dowolny | katalog i strony; skanów nie; program pobierający stawia pytanie archiwum | czeka na zgodę ([R6.3.1](R6-awaiting-action.md#R6.3.1)) |
| ograniczone lub nieznane | powoli | dowolny | skany przez program pobierający w tempie człowieka | skany w badaniu |
| ograniczone lub nieznane | przez przeglądarkę | Claude + Chrome | program pobierający drogą przez przeglądarkę | skany w badaniu |
| tylko przez przeglądarkę | przez przeglądarkę | Claude + Chrome | `strom media save`, skan po skanie | skany w badaniu, zadanie wraca |
| tylko przez przeglądarkę | żadna | Claude + Chrome | nic w archiwum; `task wait --images` | czeka na skany; Co czeka proponuje zgodę |
| tylko przez przeglądarkę | dowolna | inny agent lub bez rozszerzenia | nic w archiwum; `task wait --images` | czeka na skany, zapisuje człowiek |
| tylko przez przeglądarkę | tylko ręcznie | dowolny | nic; `task wait --images` | czeka na skany, zapisuje człowiek |
| tylko ręcznie, zakazana ścieżka `/`, serwer obrazów zamknięty w całości | zgoda nie otwiera | dowolny | nic; `task wait --images` | czeka na skany, zapisuje człowiek |
| zakazane, odrzuciło klienta | zgoda nie otwiera | dowolny | tylko strona warunków i robots.txt; inna droga | wyszukiwanie nierozstrzygające; gdy źródło jest konieczne, witryna do sprawdzenia ([R6.2.2](R6-awaiting-action.md#R6.2.2)) |

- **Granice:** pobieranie stron witryny (katalog, opis księgi) kieruje się [R9.3](#R9.3) niezależnie od skanów.
- **Obowiązuje od:** badanie 1.27.0

<!-- zdroj: research:src/core/terms.ts:789-803 allows · src/core/webgate.ts webGate, browserGate · src/core/browserhelp.ts agentBrowserAdvice, browserHelps · src/commands/media.ts:1206 media save · src/commands/tasks.ts:1041 task wait -->

<a id="R9.8.1"></a>
### R9.8.1 Przebieg zadania czekającego na skany

1. **Otwarte zadanie** potrzebuje skanów księgi B….
2. Jeśli może je pobrać program pobierający ([R9.8](#R9.8)), skany się pobierają, a zadanie kontynuuje odczytem.
   Koniec.
3. W przeciwnym razie agent ustawia `strom task wait T… --images B…:40-45`. Zadanie jest w stanie **czeka**, w Co
   czeka pod nazwą archiwum, z folderem w `inbox/`.
4. Ze zgodą **przez przeglądarkę** i z Claude + Chrome agent zapisuje skany sam ([R9.5](#R9.5)) i je przejmuje. Od
   badania 1.37.0 zadanie w tym czasie nie czeka na człowieka ani nie jest w Co czeka; na człowieka przechodzi tylko
   skan zatrzymany przez przeglądarkę albo zapisywanie zatrzymane końcem sesji.
5. W przeciwnym razie skany zapisuje człowiek do folderu albo wysyła je z aplikacji (**Dodaj skany**)
   ([R9.9](#R9.9)).
6. Przejęcie: most od razu, w przeciwnym razie start kolejnej sesji albo polecenie `strom media add --inbox --waiting`.
7. Gdy są tam wszystkie skany, zadanie jest znów **otwarte** w kolejce, z notatką, co przyszło. Gdy niektórych
   brakuje, czeka dalej, a Co czeka pokazuje, których brakuje (z powrotem do kroku 5).
8. W dowolnym momencie: odpowiedź człowieka (w aplikacji lub `strom task wake T… --answer`) przywraca zadanie
   z odpowiedzią. Zgoda **powoli** lub **przez przeglądarkę** przywraca zadania czekające na archiwum, które
   w folderze jeszcze nic nie mają.

- **Obowiązuje od:** badanie 1.27.0, aplikacja Strom 3.23.0
- **Od badania 1.37.0:** zadanie, które przeszło na człowieka z powodu przeglądarki agenta (wstrzymane pobieranie,
  zatrzymane zapisywanie) albo czeka na skany księgi, do której przeglądarka agenta ma dostęp, człowiek zwraca
  agentowi, gdy przeszkoda minęła ([R6.7.3](R6-awaiting-action.md#R6.7.3)); zadanie trafia od razu na początek
  kolejki i wraca do kroku 4.

<!-- zdroj: research:src/commands/media.ts:141 wakeWaiting · src/core/archivewait.ts:188 wakeForArchive · src/core/inboxwatch.ts · src/commands/session.ts takeWaiting · src/core/live.ts waiting answer · 1.37.0: research:81de7cdb src/core/waiting.ts savedByAgentNow -->

<a id="R9.9"></a>
## R9.9 Co robi człowiek

Kroki przy zadaniu, które czeka na skany archiwum, do którego agentowi nie wolno:

1. **Znaleźć:** aplikacja: **Czeka na załatwienie** (grupa według archiwum). Terminal: menu **Co czeka (n)** lub wiersz
   stanu **Czeka: N**. Pozycja podaje księgę, numery skanów i czego do tego brakuje.
2. **Wybrać drogę:**
   - z Claude Code i rozszerzeniem Claude in Chrome można dać archiwum zgodę **przez przeglądarkę** (aplikacja:
     odnośnik **Zgoda…** w notatce przy pozycji, terminal `strom allow archive <witryna> --way browser`). Zadanie wraca,
     a agent zapisuje skany sam ([R9.5](#R9.5));
   - w przeciwnym razie, albo przy archiwum tylko ręcznie, zapisać skany ręcznie (kolejne kroki).
3. **Otworzyć księgę** w przeglądarce na witrynie archiwum, z logowaniem i sprawdzeniem człowieka, gdzie archiwum ich
   wymaga.
4. **Zapisać skany** z numerami, które podaje pozycja, jako JPEG, z nazwą według numeru skanu (`40.jpg`, `41.jpg`), do
   folderu zadania (**Otwórz folder** w aplikacji i w terminalu). Albo dodać je w aplikacji na komputerze przez
   **Dodaj skany** (także przeciągnięciem na pozycję); numer skanu aplikacja bierze z nazwy pliku, w przeciwnym razie
   nadaje numery po kolei.
5. **Gotowe:** z mostem do aplikacji skany przejmują się same; w przeciwnym razie przy kolejnej sesji albo od razu
   `strom media add --inbox --waiting`. Gdy niektórych brakuje, Co czeka to powie.
6. **Nie da się:** odpowiedź słowami (aplikacja **Odpowiedz**, terminal `strom task wake T… --answer "<co>"`)
   przywraca zadanie z odpowiedzią, np. że księgi nie ma online.

- **Granice:** zgoda, odpowiedź i zapisanie skanów należą tylko do człowieka; agent nie zrobi ich za człowieka
  ([R6.6](R6-awaiting-action.md#R6.6)).
- **Obsługa:** aplikacja: Czeka na załatwienie. Terminal: Co czeka, `strom allow archive`, `strom media add --inbox
  --waiting`.
- **Obowiązuje od:** badanie 1.27.0, aplikacja Strom 3.23.0

<!-- zdroj: research:assets/method/waiting.md "Images saved by hand" · src/core/waiting.ts actionsOf · src/core/browserhelp.ts personBrowserNote · app:CHANGELOG.cs.md 3.23.0 -->

<a id="R9.10"></a>
## R9.10 Przykłady

Poziomy i ograniczenia pochodzą z listy archiwów badania 1.27.0, DigiArchiv SOA Třeboň z badania 1.28.0, BLHA
z badania 1.35.0. Rodzina Horáków jest zmyślona.

<a id="R9.10.1"></a>
### R9.10.1 Moravský zemský archiv (Acta Publica)

- Archiwum: ograniczone, tylko przez przeglądarkę człowieka, tempo co najmniej 4 s. Operaty spisowe
  (`/scitacioperaty/`) są według archiwum tylko do przeglądania: zakazana ścieżka, nawet nie przeglądarka agenta;
  skan zapisuje człowiek.
- Zadanie: chrzest Marie Horákovej w księdze metrykalnej w Acta Publica. Ani program pobierający, ani pobieranie stron
  nie dostaną się do archiwum.
- Z Claude Code, rozszerzeniem i zgodą **przez przeglądarkę**: agent otwiera skan i zapisuje go przez `strom media
  save`, w tempie człowieka (10 s; tempo archiwum 4 s to dolna granica). Zadanie wraca, gdy ma wszystkie skany.
- Bez zgody lub z innym agentem: zadanie czeka na skany; Co czeka mówi, z czym agent zapisałby je sam.
- Program pobierający, utworzony wcześniej dla tego archiwum, strom odrzuca przed jakimkolwiek zapytaniem, także jego
  test. Wcześniejsza zgoda „powoli” zostaje zapisana, ale skany przez program pobierający już nie idą.
- **Obowiązuje od:** badanie 1.27.0

<!-- zdroj: research:assets/archives.json mza.cz (restricted, browserOnly, pace 4000, disallow /scitacioperaty/) · CHANGELOG.cs.md 1.27.0 (Acta Publica) -->

<a id="R9.10.2"></a>
### R9.10.2 Zemský archiv v Opavě (digi.archives.cz)

- Archiwum: tylko ręcznie, tylko przez przeglądarkę człowieka. robots.txt zamyka całą witrynę wszystkim robotom, a
  strony chroni sprawdzenie, czy przy komputerze jest człowiek. Przeglądarka skanów bierze obrazy z serwera obrazów
  images.archives.cz, który robots.txt także zamyka w całości. Do archiwum nie prowadzi żaden program pobierający.
  Tak samo jest z cyfrową czytelnią SOA Litoměřice (digi.soalitomerice.cz, obrazy z images.soalitomerice.cz).
- Zgody **przez przeglądarkę** nie można tu dać: `strom allow archive digi.archives.cz --way browser` zostaje
  odrzucone, aplikacja nie proponuje odnośnika **Zgoda…**, a `strom media save` skanu nie zapisze. Przeglądarka
  agenta prosiłaby zamknięty serwer obrazów o każdy obraz.
- Zadanie: ślub Marie Vlkovej. Agent ustawia `strom task wait T… --images B…:12-13`.
- Jedyną drogą jest czekanie na skany: Co czeka w aplikacji pokazuje zadanie pod nazwą archiwum z folderem. Człowiek
  otwiera księgę w swojej przeglądarce, zapisuje skany 12 i 13 (`12.jpg`, `13.jpg`) przez **Otwórz folder** albo
  dodaje je przez **Dodaj skany**. Zadanie wraca.
- **Obowiązuje od:** badanie 1.27.0

<!-- zdroj: research:assets/archives.json digi.archives.cz, digi2.archives.cz, digi.soalitomerice.cz (manual, browserOnly, quoteFrom robots, imagesFrom images.archives.cz / images.soalitomerice.cz; commit 69902466) · src/core/terms.ts allows (browserOnly + manual) · src/commands/archives.ts:676-680 (manual/forbidden: no permission) · src/core/browserhelp.ts browserHelps, treeBrowserArchives (never by hand only) · test/cli/media-save.test.ts (digi.archives.cz) · CHANGELOG.cs.md 1.27.0 -->

<a id="R9.10.3"></a>
### R9.10.3 eBadatelna SOA Praha

- Archiwum: tylko ręcznie, tylko przez przeglądarkę człowieka; robots.txt imiennie blokuje narzędzia AI.
- Zadanie zawsze czeka na skany, które zapisuje człowiek. Zgoda tego nie otwiera; nie wolno tam wchodzić ani
  przeglądarce agenta, ani pobieraniu stron.
- **Obowiązuje od:** badanie 1.27.0

<!-- zdroj: research:assets/archives.json ebadatelna.soapraha.cz (manual, browserOnly, disallow /d/ /a/) · src/core/terms.ts allows (browserOnly + manual) -->

<a id="R9.10.4"></a>
### R9.10.4 Matricula

- Archiwum: dozwolone (warunki CC BY-NC-ND), serwer obrazów także. Lista archiwów zakazuje niektórych ścieżek
  (wyszukiwanie, stronicowanie), te zostają zamknięte.
- Zadanie: pochówek Marie Horákovej w bawarskiej parafii. Program pobierający pobiera tylko potrzebne skany w tempie
  usługi, bez zgody i bez czekania. Bez programu pobierającego agent go buduje ([R8.2](R8-reading-scans.md#R8.2)).
- **Obowiązuje od:** badanie 1.14.0

<!-- zdroj: research:assets/archives.json data.matricula-online.eu (allowed, disallow /*?pg=, /*/suchen), hosted-images.matricula-online.eu (allowed) -->

<a id="R9.10.5"></a>
### R9.10.5 Szukaj w Archiwach

- Archiwum: ograniczone, tylko przez przeglądarkę człowieka; witrynę chroni usługa przeciw robotom.
- Bez zgody zadanie czeka na skany. Ze zgodą **przez przeglądarkę** i z Claude + Chrome agent zapisuje je sam, jak
  w [R9.10.1](#R9.10.1).
- **Obowiązuje od:** badanie 1.27.0

<!-- zdroj: research:assets/archives.json szukajwarchiwach.gov.pl (restricted, browserOnly) -->

<a id="R9.10.6"></a>
### R9.10.6 DigiArchiv SOA Třeboň

- Archiwum: tylko ręcznie, tylko przez przeglądarkę człowieka. Warunki na stronie startowej DigiArchivu (`/Uvod`):
  „Snímky jsou poskytnuty pouze za účelem on-line prohlížení v DigiArchivu SOA v Třeboni, jejich kopírování,
  distribuování, prodávání, využití v jiných projektech a na jiných stránkách je zakázáno.” (po polsku: „Skany są
  udostępnione wyłącznie do przeglądania on-line w DigiArchivie SOA w Třeboniu; ich kopiowanie, rozpowszechnianie,
  sprzedawanie, wykorzystanie w innych projektach i na innych stronach jest zabronione.”) Serwer odrzuca zapytania
  stromu (403), według archiwum celowo.
- Archiwum potwierdziło: człowiek może ręcznie zapisać tylko wybrane skany, nigdy całej księgi ani jej znacznej części.
  Narzędzia do pobierania nie są dozwolone, nawet przeglądarka agenta.
- Zadanie: wpis Marie Horákovej w księdze metrykalnej w DigiArchivie. Zadanie zawsze czeka na skany, które wybiera
  i zapisuje człowiek. Zgoda tego nie otwiera; nie wolno tam wchodzić ani programowi pobierającemu, ani pobieraniu
  stron, ani przeglądarce agenta.
- Cytat: trwały odnośnik do skanu to adres jego strony `https://digi.ceskearchivy.cz/<księga>/<skan>` albo
  **Odkaz na snímek** w panelu **POPIS**.
- **Obowiązuje od:** badanie 1.28.0

<!-- zdroj: research:assets/archives.json digi.ceskearchivy.cz (manual, browserOnly, terms https://digi.ceskearchivy.cz/Uvod, quote, robots 403, scope, checked 2026-11-05), www.ceskearchivy.cz (stejné terms/quote) · src/core/terms.ts allows (browserOnly + manual) · CHANGELOG.cs.md 1.28.0 · znalosti/archivy-cz.md „SOA v Třeboni (DigiArchiv)“ (odpověď archivu 5. 11. 2026) · commit 805b871d -->

<a id="R9.10.7"></a>
### R9.10.7 Brandenburgisches Landeshauptarchiv (BLHA)

- Archiwum: ograniczone, tylko przez przeglądarkę człowieka. Dotyczy duplikatów ksiąg metrykalnych (Rep. 5KB)
  w dostępie online archiwum (blha-recherche.brandenburg.de); skany pochodzą z serwera obrazów
  blha-digi.brandenburg.de. Robots.txt zamyka całą witrynę, więc nie prowadzą tam ani własne zapytania stromu, ani
  program pobierający.
- Archiwum odpowiedziało 18.11.2026 (dosłowny cytat jest w liście): człowiek może w swojej przeglądarce zapisywać
  pojedyncze skany w ludzkim tempie i dać je przeczytać asystentowi AI na swoim komputerze; skany są na licencji
  CC-0. Najwyżej dwa zapytania naraz. Nigdy przeszukiwanie bazy danych archiwum ani cała księga.
- Zadanie: chrzest Anny Vlkovej w duplikacie księgi metrykalnej. Z Claude Code, rozszerzeniem i zgodą **przez
  przeglądarkę** agent otwiera przeglądarkę księgi, przechodzi do skanu i zapisuje pokazany przez `strom media save`,
  w tempie człowieka (10 s). Adres przeglądarki nie nazywa skanu.
- Bez zgody albo z innym agentem: zadanie czeka na skany; Co czeka mówi, czym agent zapisałby je sam.
- Księga: lista nie ma przy archiwum informacji o całej księdze, więc oferowane są tylko potrzebne skany
  ([R6.8.1](R6-awaiting-action.md#R6.8.1)).
- Cytat: „BLHA, Rep. 5KB Nr. <n>”, gdzie n to numer księgi z sygnatury „5KB <n>”, z numerem skanu w księdze.
- **Obowiązuje od:** badanie 1.35.0

<!-- zdroj: research:465c54ea assets/archives.json blha-recherche.brandenburg.de (restricted, browserOnly, terms robots.txt, quoteFrom reply, replied 2026-11-18, robots Disallow / zrušeno odpovědí pro jednotlivé snímky, nejvýš 2 požadavky, imagesFrom blha-digi.brandenburg.de, scope: nikdy prohledávání databáze ani celá kniha, adresa prohlížeče snímek nejmenuje, citace „BLHA, Rep. 5KB Nr. <n>“; bez wholeBook), blha-digi.brandenburg.de (restricted, IIIF, po jednom), blha.brandenburg.de (unknown, pace 10 s) · src/core/net.ts HUMAN_PACE 10 s · src/commands/archives.ts paceFor · src/core/terms.ts allows (browserOnly + restricted) · src/core/books.ts downloadOf (bez údaje range) · CHANGELOG.cs.md 1.35.0 (BLHA podle odpovědi z 18. 11. 2026) · commit d013df1c -->

<a id="R9.12"></a>
## R9.12 Spisy ludności jako źródło

Spis ludności zapisuje jedno gospodarstwo domowe w jednym roku: kto mieszkał w domu, jaki był jego stosunek do głowy
gospodarstwa, wiek lub rok urodzenia, często miejsce urodzenia, gminę przynależności i zawód. Badanie korzysta ze
spisów tylko wtedy, gdy człowiek je dla badania włączy.

- **Pilnuje kod:**
  - ustawienie `census` (**Spisy ludności w tym badaniu**) jest domyślnie wyłączone. Nieustawione ustawienie oznacza
    wyłączone, także w badaniach założonych wcześniej;
  - ustawienie obowiązuje dla wszystkich badań na tym komputerze albo z `--for-tree` tylko dla jednego. Wartość badania
    ma pierwszeństwo w obu kierunkach (włączone i wyłączone). Menu terminala i aplikacja Strom zapisują wartość
    badania. Ani zmienna środowiskowa, ani przełącznik polecenia ustawienia nie zmienia;
  - włącza je tylko człowiek: w menu, w swoim terminalu albo przełącznikiem w aplikacji Strom
    ([S4.4.10](S4-research-from-the-app.md#S4.4.10)). Gdy włączenie uruchamia agent w rozmowie, człowieka pyta okno
    systemu. Bez okna (samodzielna praca agenta) strom włączenie odrzuca i mówi agentowi, aby spisy zaproponował
    ([R9.12.1](#R9.12.1)). Wyłączyć może każdy, bez pytania;
  - włączone: można zakładać zadania spisu (`strom task add … --census <rok>[:<dom>]`), a agent dostaje przy nich
    stronę metodyki o spisach i listę spisów, które strom zna ([R9.12.2](#R9.12.2));
  - wyłączone: zadania spisu nie można założyć (odmowa mówi, jak spisy zaproponować), strony `strom guide census` strom
    nie daje, a zadania spisu są odłożone ([R9.12.4](#R9.12.4)). Zapisane wydarzenia spisu zostają;
  - Archiwum Strom nie ma tego ustawienia w menu. Most odrzuca je w Archiwum Strom i w badaniu, które czeka na agenta.
- **Dlaczego:** metryki zapisują pojedyncze wydarzenia. Spis pokazuje całe gospodarstwo domowe w jednym roku, dokąd
  rodzina się przeprowadziła i skąd kto przyszedł, czego metryki często nie mówią. Większość archiwów spisy tylko
  wyświetla, dlatego arkusze zwykle dostarcza człowiek jako zrzut ekranu.
- **Obsługa:** terminal: menu **Ustawienia** → **Język, agent, model, co agent może sam, opowieści… (kreator
  ustawień)** → **Spisy ludności w tym badaniu: …**. Najpierw zdanie, co dają spisy, potem pytanie **Włączyć spisy
  ludności w tym badaniu?** lub **Wyłączyć spisy ludności w tym badaniu? Ich zadania zostaną odłożone i wrócą po
  włączeniu.** (Enter = nic się nie zmienia). Polecenie `strom config set census on|off [--for-tree]`, obowiązującą
  wartość pokazuje `strom config where`. Aplikacja: [S4.4.10](S4-research-from-the-app.md#S4.4.10).
- **Obowiązuje od:** badanie 1.36.0, aplikacja 3.31.0

<!-- zdroj: research:c7b117cd src/core/config.ts SETTINGS census (env "", tree: true, off|on), censusSwitch (strom.json oběma směry, jinak config uživatele; nenastaveno = off) · src/commands/setup.ts censusDecision (requireHuman: terminál člověka; agent → okno systému, bez okna NeedsConsentError s návodem census propose; STROM_FOR_APP bez okna; vypnutí bez dotazu), effective census off · src/commands/tasks.ts censusOrigin (--census <rok>[:<dům>], census.off s návodem) · src/commands/meta.ts guide census (census.off) · src/brief/brief.ts (podmínka census / census-off) · src/core/live.ts POST /census (409 census.archive) · research:5a73905e src/cli/menu-settings.ts censusLabel, censusStep (ui.settings.census.about, .on, .off; --for-tree; jen mimo archiv) · cs.json ui.settings.census* · assets/method/census.md (úvod) · test/cli/census.test.ts · CHANGELOG.cs.md 1.36.0 „Sčítání lidu“ · dirigent:spec/106-vyzkum-scitani-lidu Proč, K1.1–K1.4, rozhodnutí 19. 11. a 20. 11. M2 -->

<a id="R9.12.1"></a>
### R9.12.1 Propozycja włączenia spisów ludności

Przy wyłączonych spisach agent może zaproponować człowiekowi spisy, raz na badanie.

- **Pilnuje kod:**
  - `strom census propose --why "…" [--person P…]` zakłada jedną pozycję Co czeka ([R6.2](R6-awaiting-action.md#R6.2))
    w języku badania: „Spisy ludności mogłyby pomóc w badaniu: … Włączyć je można w ustawieniach tego badania.”
    (z osobą „… mogłyby pomóc w sprawie osoby …”). Czeka na decyzję: włączyć spisy czy nie;
  - drugą propozycję strom odrzuca, jakkolwiek skończyła się pierwsza (załatwiona, anulowana, odrzucona). Przy
    włączonych spisach odrzuca każdą propozycję;
  - `--why` to jedno lub dwa zdania w języku badania, najwyżej 600 znaków, i nie może zwracać się do człowieka;
  - włączenie spisów zamyka propozycję („Spisy ludności włączone”). Przy włączonych spisach otwarta propozycja nigdzie
    się nie pokazuje;
  - podsumowanie sesji, w której propozycja powstała, mówi o niej zdaniem „Zaproponowano włączenie spisów ludności
    (T…).”;
  - propozycja jest zadaniem rodzaju **Inne**, nie zadaniem spisu.
- **Tylko metodyka:** propozycja tylko w ślepym punkcie, gdzie spis by pomógł: pochodzenie osoby nieznane, luka między
  wydarzeniami z metryk. Po propozycji agent kontynuuje bez spisów i nie pyta ponownie.
- **Obsługa:** aplikacja: **Czeka na załatwienie**. Terminal: menu Co czeka, włączenie w [R9.12](#R9.12).
- **Obowiązuje od:** badanie 1.36.0

<!-- zdroj: research:5a73905e src/commands/census.ts census propose (census.on, census.proposed, census.addresses, --why max 600, state waiting, wait kind other, origin census:propose) · src/core/census.ts censusProposal, censusHidden · src/commands/setup.ts closeCensusProposal (census.propose.done) · src/commands/session.ts censusSummary (census.propose.session) · src/core/taskkind.ts (census:propose → other) · assets/method/core.md „Census records are off“ · cs.json census.propose.* · dirigent:spec/106 rozhodnutí 20. 11. M1 -->

<a id="R9.12.2"></a>
### R9.12.2 Kiedy i gdzie agent szuka spisów ludności

Zadanie spisu to jedno gospodarstwo domowe w jednym roku i domu. Gdzie szukać spisów, mówi agentowi lista archiwów
dostarczona z badaniem.

- **Pilnuje kod:**
  - brief zadania spisu (tylko przy włączonych spisach) wymienia spisy z listy archiwów: lata, obszar, indeks nazwisk,
    jak szuka się gospodarstwa i drogę dla stromu. Poziom i warunki archiwum obowiązują jak przy każdym wpisie
    ([R9.1](#R9.1)), a droga nigdy nie jest łagodniejsza niż poziom archiwum;
  - spisy na liście archiwów (badanie 1.36.0):

| Archiwum | Lata | Obszar | Wyszukiwanie | Droga |
|---|---|---|---|---|
| Moravský zemský archiv (Acta Publica) | 1857, 1869, 1880, 1890, 1900, 1910, 1921 | Morawy Południowe i Wysoczyna | gmina, ulica; bez indeksu nazwisk | ręcznie: arkusz zapisuje człowiek ([R9.10.1](#R9.10.1)) |
| SOA v Třeboni (DigiArchiv) | jak MZA | Czechy Południowe | gmina | ręcznie |
| Východočeské archivy (ARON) | jak MZA | Czechy Wschodnie | gmina; bez indeksu nazwisk | agent sam |
| FamilySearch | jak MZA | wybrane miejsca | gmina | tylko odnośnik i zadanie dla człowieka |
| Archiv hlavního města Prahy | 1869, 1880, 1890 | Praga | – | ręcznie |
| MyHeritage | 1900, 1910, 1921 | Czechy | nazwisko (indeks nazwisk) | ręcznie |
| Archiv města Brna | 1850, 1857, 1870, 1880, 1890, 1900, 1921 | Brno | nazwisko, dom (indeks nazwisk) | powoli, po jednym wpisie |
| Archiv města Ostravy | nie podano | Ostrawa | – | powoli, po jednym wpisie |

- **Tylko metodyka:**
  - **kiedy:** pochodzenie osoby nieznane (chrztu nie znaleziono tam, gdzie żyła), luka między wydarzeniami z metryk
    (przeprowadzka, dzieci zmarłe gdzie indziej, drugi ślub) albo dom znany z chrztu, ślubu lub pochówku w roku
    bliskim roku spisu;
  - tylko ludzie, do których prowadzi drzewo (nic poza drzewem), nigdy żyjący. Jedno zadanie na gospodarstwo domowe,
    rok i dom, nigdy na osobę;
  - **gdzie:** spis gminy i roku w katalogu archiwum jednym wyszukiwaniem, nigdy przeglądaniem numerów. W nim dom
    według numeru; gdzie jest indeks nazwisk, szukać nazwiskiem i sprawdzić numer domu. Nigdy nie przeglądać numerów
    domów ani nie szukać ludzi, których drzewo nie potrzebuje;
  - archiwum, które spisy tylko wyświetla: zadanie czeka na człowieka, z adresem spisu gminy i tym, co zapisać
    („gmina, rok, numer domu: cały arkusz, obie strony”), albo na skany księgi ([R9.6](#R9.6)). Arkusz większy niż
    jeden ekran przychodzi w częściach;
  - nie znaleziono (spis gminy zaginął, brak domu, rodzina gdzie indziej): negatywne wyszukiwanie z tym, co dokładnie
    przejrzano, i agent do tego nie wraca.
- **Obsługa:** terminal: `strom task add … --census <rok>:<dom>`, `strom task wait T… --kind web --url <adres>
  --on "…"` lub `--images B…:<numery>`, `strom search add … --result negative`.
- **Obowiązuje od:** badanie 1.36.0

<!-- zdroj: research:5a73905e assets/archives.json census (years, area, nameIndex, search, how, says, checked 2026-11-04 až 2026-11-20: mza.cz by-hand, digi.ceskearchivy.cz by-hand, aron.vychodoceskearchivy.cz agent, familysearch.org link, digi.ahmp.cz by-hand, myheritage.com by-hand, digiarchiv.brno.cz slow, badatelna.ostrava.cz slow bez let), censusDays · src/core/census.ts censusHoldings · src/brief/brief.ts (oddíl census jen pro úkol sčítání při zapnutí) · src/core/assets.ts methodFor (census.md) · test/unit/known-terms.test.ts (how nikdy mírnější než úroveň) · assets/method/census.md „When“, „Where“ · dirigent:spec/106 K2.1–K2.4 -->

<a id="R9.12.3"></a>
### R9.12.3 Gospodarstwo domowe: jedno wspólne wydarzenie

`strom census add` zapisuje jeden arkusz (jeden dom, jedno gospodarstwo domowe) naraz. W aplikacji Strom gospodarstwo
jest jednym wspólnym wydarzeniem **Spis ludności** ([A10.1](A10-shared-events.md#A10.1)).

- **Pilnuje kod:**
  - każdy członek gospodarstwa, który jest osobą drzewa, dostaje wydarzenie spisu ze swoim stosunkiem do głowy
    gospodarstwa i wiekiem według arkusza. Data, miejsce, dom, notatka i cytat arkusza są we wszystkich kopiach takie
    same. Jedyny członek z drzewa dostaje zwykły spis osoby, a jego stosunek jest w notatce;
  - ludzie z arkusza, którzy nie są w drzewie (czeladź, komornicy, lokatorzy), są tylko w notatce gospodarstwa; osoba
    z nich nie powstaje. Nic więcej się nie zapisuje: rok i miejsce urodzenia z arkusza nie są urodzeniem;
  - **data:** sam rok oznacza dzień spisu danego roku, gdy strom go zna: w Czechach 31.10.1857, 31.12.1869, 1880,
    1890, 1900 i 1910 oraz 15.2.1921. W przeciwnym razie zostaje rok. Pełna data ma pierwszeństwo;
  - **miejsce** to gmina lub wpis miejsca, nigdy ulica ani numer domu. Dom pisze się tak, jak podaje go arkusz („14”,
    „Dlouhá 12”);
  - **stosunek:** stałe słowa (głowa gospodarstwa domowego, żona, mąż, syn, córka, ojciec, matka, teść, teściowa, zięć,
    synowa, wnuk, wnuczka, brat, siostra, pasierb, pasierbica, wychowanek, krewny, służący, służąca, parobek, dziewka,
    lokator, komornik, dożywotnik, uczeń, czeladnik) są rozpoznawane po czesku, angielsku, niemiecku i polsku
    i zapisują się słowem języka badania. Inny stosunek zostaje tak, jak jest napisany;
  - stosunek, jak piszą go formularze i odczyty arkusza: „přednosta [domácnosti]”, „hlava rodiny”,
    „Haushaltungsvorstand”, „głowa rodziny” i „head of the household” to głowa gospodarstwa domowego. Dopisek, który
    mówi tylko, do kogo stosunek się odnosi („manželka přednosty”, „son of the head”, „Tochter des
    Haushaltungsvorstandes”, „v domácnosti”), zostaje odcięty. Z wyliczenia po przecinku obowiązuje głowa
    gospodarstwa domowego, jeśli w nim jest; w przeciwnym razie zostaje całe;
  - **odrzuca się:** członka, który nie jest osobą drzewa (albo jest scalony lub wycofany), osobę podaną dwukrotnie,
    członka bez stosunku, osobę, która najpewniej żyje, dwie głowy gospodarstwa i gospodarstwo już zapisane (ten sam
    rok, gmina i dom);
  - **ostrzega:** w tym samym domu i roku są inne osoby drzewa (inne gospodarstwo domu albo to samo zapisane
    dwukrotnie); spis tego samego roku gdzie indziej (przeprowadzka albo dwie osoby wzięte za jedną);
  - kopie pozostają jednym wydarzeniem: wspólna dana poprawiona w jednej kopii (`strom event edit`, `strom cite`,
    `strom note edit|retract|restore`, `strom event main`) i propozycja poprawki przyjęta w jednej kopii obowiązują
    dla wszystkich. Wiek, stosunek, weryfikację i potwierdzenie człowieka ma każda kopia własne; stan badań trafia do
    wszystkich kopii tylko wyraźnie (`--status`). Do wspólnej notatki nie trafia nic, co należy do jednej kopii;
  - zapisać gospodarstwo można także przy wyłączonych spisach: polecenie zapisuje dostarczony arkusz, niczego nie
    szuka.
- **Tylko metodyka:**
  - arkusz czytać jak wpis metrykalny, całe gospodarstwo i głowę domu; zapisać raz. Każdy rok to osobne gospodarstwo,
    nigdy się ich nie scala;
  - **wskazówka, nie dowód:** rok lub miejsce urodzenia, gmina przynależności i zawód ze spisu nigdy nie zastąpią
    urodzenia ani chrztu. Prowadzą do metryk: zadanie znaleźć parafię miejsca urodzenia. Gdzie spis i metryka się
    rozchodzą, powstaje notatka lub hipoteza; danej z metryki ze względu na spis się nie zmienia;
  - **przenumerowane domy:** dom rozpoznawać także po sąsiadach i nazwiskach, nie tylko po numerze; niepewność podać
    w notatce.
- **Obsługa:** terminal: `strom census add --source S… --date <rok|dzień> --place <gmina|L…> --house <nr>`
  `--member P…:<stosunek>:<wiek> … [--others "…"] [--note "…"] [--locator "…"] [--transcript "…"]`. Aplikacja:
  gospodarstwo przy każdej osobie i na **Osi czasu** ([A10.2](A10-shared-events.md#A10.2), [A6.3](A6-views.md#A6.3)).
  Przykład (zmyślony): `strom census add --source S0004 --date 1890 --place L0007 --house 14`
  `--member P0002:"głowa rodziny":41 --member P0003:"żona głowy rodziny":36 --others "parobek, 19 lat"`
  zapisze Janowi Horákowi głowę gospodarstwa domowego (41), a Marie Horákovej żonę (36), oba na dzień 31.12.1890.
- **Obowiązuje od:** badanie 1.36.0, aplikacja 3.31.0
- **Od badania 1.37.0:**
  - spis ludności osoby zapisany jako własne wydarzenie z nazwą spisu („Spis ludności”, „Census”, „Sčítání lidu”…)
    idzie do aplikacji Strom jako spis ludności (`1 CENS`); zapis w badaniu zostaje, jak został zapisany. Wydarzenie
    pary i nazwa z czymś więcej zostają, jak są. Aplikacja 3.32.0 nie pokazuje już takiego spisu przekreślonego przy
    wczytaniu wersji badania ([S2.7.1](S2-edits-from-the-app.md#S2.7.1));
  - `strom check` ostrzega przed dwoma spisami jednej osoby z tą samą datą (`two-censuses`) i radzi zachować ten,
    który mówi więcej (gospodarstwo domowe, cytaty), a drugi wycofać `strom event retract`;
  - te same słowa zapisu cytowanego dwa razy trafiają do notatki faktu, imienia lub rodziny tylko raz.

<!-- zdroj: research:8dba2e52 src/commands/household.ts census add (--source, --date, --place, --house, --member, --others, --note, --locator, --transcript/--quote, --information, --status, --country; sameHouse, elsewhere) · src/core/household.ts addHousehold (census.member.none, record.none, merged/retracted, census.member.twice, census.living, relace chybí, census.head.twice, domácnost už zapsaná; jeden člen bez share id, vztah do poznámky; others jen v poznámce), parseMember, alignCopies · src/gedcom/export.ts (2 NOTE bez řádků kopie) · src/commands/people.ts alignCopies u note edit/retract/restore, cite, event edit, event main · research:ece404b9 src/core/origin.ts (přijatý návrh na všechny kopie), censusDay jedna tabulka · research:5a73905e assets/archives.json censusDays CZ · research:d2bef48e src/core/household.ts householdRoleOf, src/core/phrases.ts HOUSEHOLD_ROLES, HOUSEHOLD_ROLES_ALSO, HOUSEHOLD_OF_HEAD · test/cli/census-household.test.ts, census-reader.test.ts · assets/method/census.md „Reading and recording“ · CHANGELOG.cs.md 1.36.0 · dirigent:spec/106 K3.1–K3.3 · dirigent:prace/1120-vyzkum-106-scitani Výsledek (census add i při vypnutí, stav jen výslovně) · 1.37.0: research:6aa96d31 src/gedcom/export.ts (vlastní událost sčítání jako 1 CENS), src/core/labelkind.ts kindOfLabel, strom check two-censuses, poznámka bez zdvojených slov · CHANGELOG.cs.md 1.37.0 · dirigent:K052 -->

<a id="R9.12.4"></a>
### R9.12.4 Spisy ludności wyłączone: odłożone zadania

Wyłączenie spisów odkłada zadania spisu, nie usuwa ich. Po włączeniu wracają same.

- **Pilnuje kod:**
  - przy wyłączonych spisach zadania spisu otwarte lub czekające (także na skany) są poza kolejką, jej liczbami, Co
    czeka i stanem dla aplikacji. Nic się nie zapisuje ani nie usuwa: odłożenie wylicza się z ustawienia;
  - zadanie, nad którym sesja właśnie pracuje, nie zostaje odłożone: sesja je dokończy. Jeśli zostanie niedokończone,
    jest znów otwarte i od tej chwili odłożone. Agent słyszy to przy zamykaniu sesji;
  - zadanie, które człowiek odłożył na później, zostaje odłożone jak dotąd. Załatwione i anulowane zadania się nie
    zmieniają;
  - `strom task list` mówi, ile zadań spisu jest odłożonych; `strom task list --kind census` pokazuje je z oznaczeniem
    „held: census off”. Przy odłożonym zadaniu uruchomionym według numeru (`strom session start T…`) agent słyszy, że
    zadanie jest odłożone, aby zamknął sesję i wziął inne zadanie;
  - menu ustawień pokazuje przy ustawieniu np. „wyłączone, odłożone 3 zadania spisu”, a po wyłączeniu zdanie
    „Odłożone: 3 zadania spisu. Wrócą po włączeniu.”
- **Obsługa:** terminal: ustawienie w [R9.12](#R9.12), `strom task list --kind census`. Aplikacja: przełącznik
  [S4.4.10](S4-research-from-the-app.md#S4.4.10) ze zdaniem o odłożonych zadaniach.
- **Obowiązuje od:** badanie 1.36.0

<!-- zdroj: research:c7b117cd src/core/census.ts censusHeld (open, parked do uplynulého dne, waiting; nikdy doing ani parked člověkem), censusHidden, censusHeldCount · src/core/queue.ts rankTasks censusHide · src/core/waiting.ts (Co čeká) · src/core/live.ts censusStatus (/status.census {on, held}) · src/commands/tasks.ts task list (censusHeldNow, „held: census off“, --kind census) · src/commands/session.ts censusLine, censusCloseLine · research:5a73905e src/cli/menu-settings.ts censusLabel (ui.settings.census.held), censusStep (ui.settings.census.back) · test/cli/census.test.ts (M3) · dirigent:spec/106 K1.3, rozhodnutí 20. 11. M3 -->

<a id="R9.13"></a>
## R9.13 Archiwum z ograniczeniami: jedna sesja naraz

Archiwum, które ogranicza zautomatyzowany dostęp, używa naraz tylko jedna sesja ze wszystkich badań ze wspólnym
folderem na komputerze. Archiwum nie zablokuje więc dostępu, a jeden wykonawca idzie pełnym dozwolonym tempem, zamiast
żeby kilku dzieliło się tempem.

- **Archiwum z ograniczeniami:** warunki archiwum wymagają ludzkiego tempa albo tylko przeglądarki, człowiek dał zgodę
  „powoli” lub „przez przeglądarkę” ([R9.2](#R9.2)), albo program pobierający archiwum ma limit godzinowy. Odrzucenie
  przez archiwum (401, 403, 429) nie czyni archiwum archiwum z ograniczeniami: archiwum zostaje na chwilę zostawione
  w spokoju jak dotąd. Archiwum rozpoznaje się po domenie witryny.
- **Pilnuje kod:**
  - zadanie, którego księgi leżą tylko w archiwum z ograniczeniami, przy zajęciu zadania bierze także archiwum.
    Archiwum trzyma sesja; agent, który dopiero zabłądzi do archiwum, zajmuje je pierwszym zapytaniem;
  - trzymanie archiwum kończy się z sesją, z wygaśnięciem sesji ([R7.9](R7-when-the-agent-works.md#R7.9)) albo po
    `archive.hold` (domyślnie 30 min) bez zapytania do archiwum, nawet gdy sesja dalej trwa. Kto tylko czyta pobrane
    skany, zwalnia tak archiwum;
  - zadanie w archiwum, które trzyma inna sesja, zostaje na razie pominięte i bierze się inną pracę („pominięte:
    archiwum … ogranicza zautomatyzowany dostęp i używa go teraz inna sesja”). Zapytanie agenta do takiego archiwum
    zostaje odrzucone;
  - samodzielna praca, której zostały tylko takie zadania, czeka najwyżej `archive.wait` (domyślnie 30 min). Do
    archiwum podczas czekania nic się nie wysyła. Potem przebieg kończy się z powodem „nic więcej do zrobienia –
    pozostałe zadania potrzebują archiwum …, którego przez cały czas oczekiwania używała inna sesja”;
  - `strom session start T…` przy zadaniu zajętego archiwum zostaje odrzucone jednym zdaniem: „Archiwum … używa teraz
    inne badanie (od 9:10, ostatnio 9:40); zwolni się najpóźniej o 10:10.” W tym samym badaniu zamiast „inne badanie”
    stoi numer sesji;
  - kto czeka na archiwum, stoi w kolejce; po zwolnieniu pierwszeństwo ma ten, kto czeka najdłużej. Sesja, która
    archiwum puściła, nie zajmie go od razu ponownie, gdy ktoś na nie czeka.
- **Pobieranie zbiorcze:** na komputerze działa naraz tylko jedno zbiorcze pobieranie skanów z archiwum
  z ograniczeniami (`strom fetch`). Kolejne ustawia się w kolejce („queued behind …”) i czeka samo najwyżej
  `archive.wait`; potem kończy się z godziną, kiedy spróbować ponownie. Pobieranie trzyma też archiwum, więc agenci
  innych badań je pomijają. Archiwa bez ograniczeń się nie zmieniają: ich tempa dalej pilnuje tylko ogranicznik
  zapytań.
- **Granice:** trzymanie nie mówi, jak szybko się pobiera, tylko kto; tempo archiwum się nie zmienia. Starszy strom obok
  tego archiwów nie trzyma i trzyma się tylko tempa.
- **W aplikacji:** kto używa archiwum i na które archiwum praca czeka, pokazuje Przegląd badania
  ([S4.1](S4-research-from-the-app.md#S4.1), [S4.2](S4-research-from-the-app.md#S4.2)).
- **Obsługa:** terminal: `strom config set archive.hold <minuty>`, `strom config set archive.wait <minuty>` (np. `45m`,
  `2h`; od 5 min do 24 h, obowiązuje dla tego komputera); menu pokazuje „Praca samodzielna czeka na archiwum …
  (najdłużej do …).”
- **Obowiązuje od:** badanie 1.36.0

<!-- zdroj: research:10894288, 9408c7ea, 41dcd8eb src/core/archiveholds.ts (hlavička; restrictedLevel: browserOnly, permission slow|browser, allows(…).human; ne forbidden/refused; cappedConnector policy.pace.perHour; siteOf webDomain; siteLife: proces, sezení, archive.hold; PRIORITY_MS 2 min; joinQueue, releaseSite; BULK) · src/commands/connectors.ts:1443-1448 (help fetch), :3085-3190 holdArchive (fetch obrázků čeká ve frontě ≤ archive.wait, ostatní exit 7 data.held) · src/commands/session.ts:985-997, :1355-1389 (stop archive) · src/core/errors.ts:142 archive.held(.own) · src/core/config.ts:336-337 archive.hold, archive.wait · cs.json ui.run.skip.archive, ui.run.archive.wait, ui.run.stop.archive, ui.error.archive.held(.own), ui.menu.working.archive · CHANGELOG.cs.md 1.36.0 · dirigent:spec/127 K2.1–K2.5, K5.1, rozhodnutí 21. 11. (1)–(3), navrh-rezervace.md kap. 5 -->
