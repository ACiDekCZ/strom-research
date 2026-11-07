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

> **Uwaga: gdzie dokładnie obowiązuje przeglądarka agenta.** Przeglądarki agenta strom pilnuje przy **Claude Code**
> z rozszerzeniem **Claude in Chrome**, we wbudowanej przeglądarce aplikacji Claude
> ([R12.2](R12-where-the-agent-works.md#R12.2)) i w przeglądarce Codexu według adresów w jej kodzie, gdy człowiek
> potwierdził hook stroma ([R12.5](R12-where-the-agent-works.md#R12.5)). Przeglądarki innego agenta (Antigravity
> i inne) ani sterowania komputerem żadnego agenta strom pilnować nie potrafi: agent nie wchodzi z nimi sam do
> archiwum, do którego wolno tylko przeglądarce człowieka, a skany zapisuje człowiek. Wbudowanych przeglądarek i sterowania komputerem
> aplikacji desktopowych agentów strom nie poleca; agent używa ich tylko na wyraźną prośbę człowieka
> ([R9.4.2](#R9.4.2)). Gdzie rozmawia się z agentem i czego strom gdzie pilnuje, podsumowuje
> [R12](R12-where-the-agent-works.md).

<!-- zdroj: research:CHANGELOG.cs.md 1.27.0, 1.29.0 · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS, ON_REQUEST · src/core/chromehook.ts:1-25 · src/core/codexhook.ts · app:CHANGELOG.cs.md 3.23.0 -->

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
- **Dlaczego:** metodyka chce przestrzegać warunków każdego archiwum. Tam, gdzie robots.txt wpuszcza tylko
  przeglądarkę, idzie najwyżej przeglądarka, za zgodą człowieka i w jego tempie; to, co lista archiwów zostawia
  ręce człowieka, zapisuje człowiek.
- **Obsługa:** terminal: `strom net web --check <adresa>` (co strom zrobiłby z adresem), menu archiwów, `strom
  allow archive` (tylko człowiek). Aplikacja: Czeka na decyzję.
- **Obowiązuje od:** badanie 1.14.0. Kolejne archiwa Czech, Niemiec i Polski oraz serwer obrazów od 1.27.0.

<!-- zdroj: research:src/core/terms.ts:566-680 archiveLevel (robots "Disallow: /" → browserOnly, restricted; robotsYield: openByTerms + robotsNamesAi false), :789-803 allows (browserOnly + manual → nothing) · assets/archives.json (level, browserOnly, pace, disallow, imagesFrom, quote, quoteFrom, checked; metrikai.lt, lagis, gov, online-ofb restricted + browserOnly; ebadatelna.soapraha.cz manual) · src/core/knownterms.ts imagesFrom · test/unit/known-terms.test.ts (imagesFrom closed whole ⇒ manual) · src/core/browserhelp.ts browserHelps (disallow "/") · CHANGELOG.cs.md 1.26.0, 1.27.0 (c3ee4422) -->

<a id="R9.1.1"></a>
### R9.1.1 Strona, której badanie nie zna

- Witrynę, której nie ma na liście archiwów i która nie ma programu pobierającego, strom ocenia według zapisu
  archiwum w badaniu, najsurowszego widzianego poziomu i robots.txt, tak jak strom go odczytał. Bez innych danych ma
  poziom **nieznane**, czyli jak ograniczone.
- Strony takiej witryny agent może pobrać, w granicach [R9.3](#R9.3). Skanów nie: skany archiwum, które nie jest
  dozwolone, nigdy nie idą przez pobieranie stron.
- **Obsługa:** terminal: `strom net web --check <adresa>`.
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
- **Obsługa:** terminal: `strom allow archive <web|stahovač> --way slow|browser|manual`, `--revoke`, menu archiwów.
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
    przeglądarkę” albo oczekiwanie na skany (`strom task wait T… --images B…:<čísla>`);
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
- **Tylko metodyka:** przy odrzuconej witrynie najpierw inna droga. Wyszukiwanie zapisuje się z wynikiem
  nierozstrzygającym (`strom search add … --result inconclusive`). Dopiero gdy źródło jest nadal konieczne, zadanie
  czeka na człowieka, aby sprawdził witrynę (`strom task wait --check`, [R6.2.2](R6-awaiting-action.md#R6.2.2)).
- **Dlaczego:** pobieranie stron i przeglądarka agenta liczą się i zwalniają razem, aby żadna droga nie szła szybciej
  niż inna.
- **Obsługa:** terminal (agent): `strom net web --check <adresa>`.
- **Obowiązuje od:** badanie 1.14.0

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
  podglądu) strom pilnuje jak Claude in Chrome ([R12.2](R12-where-the-agent-works.md#R12.2)), przeglądarki aplikacji
  ChatGPT (Codex) według adresów w jej kodzie, gdy człowiek potwierdzi hook stroma
  ([R12.5](R12-where-the-agent-works.md#R12.5)). Sterowania komputerem aplikacji Claude ani aplikacji ChatGPT strom
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
- **Obowiązuje od:** badanie 1.27.0; 1.29.0: wbudowana przeglądarka aplikacji Claude i przeglądarka Codexu pilnowane

<!-- zdroj: research:src/core/browserhelp.ts ON_REQUEST, browserKept · src/core/browser.ts CODEX_BROWSER_SERVERS, Claude_Browser matcher · src/brief/brief.ts · src/commands/guide.ts · src/commands/setup.ts:527 desktop · assets/lang/cs.json ui.doc.desktop.unwatched · CHANGELOG.cs.md 1.27.0, 1.29.0 · commit 6968ab72 (agent řekne, zda strom cestu hlídá) -->

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
- **Obsługa:** terminal: `strom doctor`. Aplikacja: okno **Badanie dla drzewa**, Czeka na decyzję.
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
  - polecenie ustawia zadanie na oczekiwanie na ten skan. Plik zapisuje się do folderu pobranych plików
    (`strom-T…-<číslo>.jpg`), a `strom media add --inbox --waiting` przenosi go do folderu zadania pod numerem skanu
    ([R9.6](#R9.6)).
- **Granice:** Chrome zapisuje z jednej strony tylko jeden plik. Na kolejne pobrania z tej samej strony musi zezwolić
  człowiek w pasku adresu Chrome; agent nigdy nie zmienia ustawień Chrome.
- **Tylko metodyka:** program pobierający archiwum, którego przeglądarka pokazuje skany kafelkami, także zapisuje
  przez przeglądarkę, nawet część skanu; stronę księgi otwiera raz i nigdy jej nie odświeża.
- **Dlaczego:** zgoda „przez przeglądarkę” pozwala na to, co zrobiłby człowiek w swojej przeglądarce, w jego tempie.
- **Obsługa:** terminal (agent): `strom media save T… --image <číslo> --at <adresa> [--recordset B…]`, potem
  `strom media add --inbox --waiting`.
- **Obowiązuje od:** badanie 1.27.0

<!-- zdroj: research:src/commands/media.ts:1206-1294 media save (browserGate, guarded browser, permission browser, Downloads strom-T…-n.jpg) · commit dadd91e7 (viewer paged on) · src/core/browserhelp.ts agentBrowserAdvice · src/agents/files.ts:80-95 · CHANGELOG.cs.md 1.27.0 -->

<a id="R9.6"></a>
## R9.6 Oczekiwanie na skany i powrót zadania

Gdzie agent skanów nie zdobędzie, zadanie czeka na człowieka. Badanie podaje księgę i numery skanów i przygotowuje dla
nich folder. Zadanie wraca do kolejki samo, gdy w badaniu są wszystkie jego skany.

- **Pilnuje kod:**
  - `strom task wait T… --images B…:<čísla>` przygotowuje folder `inbox/<B… název knihy>` w folderze współdzielonym
    (nazwa najwyżej 80 znaków);
  - plik nosi numer skanu (`40.jpg`, `9a.jpg`). Inaczej nazwane pliki numeruje się według kolejności, gdy jest ich
    tyle, ile skanów brakuje;
  - plik zostaje przejęty, gdy przez 3 s się nie zmienia (duży skan nigdy nie zostanie przejęty w połowie);
  - przejęcie: od razu, gdy działa most do aplikacji Strom (zagląda do folderów czekających zadań, ponownie co
    30 s); w przeciwnym razie przy starcie kolejnej sesji; albo od razu poleceniem `strom media add --inbox --waiting`;
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
    pracuje;
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
  **Otwórz folder (zapisano M/N)**. Aplikacja: Czeka na decyzję, przy pozycji w tej kolejności **Dodaj
  skany**, **Otwórz stronę ↗**, **Odpowiedz**, **Omów z agentem**, **Otwórz folder** (dwa ostatnie otwierają badanie
  w terminalu). Stan skanów pokazuje „1 z 2 skanów”, a przy księdze chipy **zapisany** / **brak**. Witryny jednego
  archiwum czekają w jednej grupie **Archiwum** pod nazwą archiwum, z odnośnikiem **Strona archiwum ↗** i liczbą
  brakujących skanów.
- **Granice (grupa archiwum):** grupą jest archiwum badania, do którego należy zadanie: według księgi zadania, adresu
  archiwum, adresu jego księgi, innej witryny tego samego archiwum według listy archiwów albo nazwy archiwum. Tylko
  gdy badanie takiego archiwum nie ma, grupą jest archiwum z listy archiwów; w przeciwnym razie sama witryna.
- **Granice (aplikacja):** odpowiedź najwyżej 4000 znaków; na zadanie czekające na sprawdzenie witryny odpowiada się
  tylko w terminalu. Na telefonie nie dodaje się skanów ani nie otwiera terminala.
- **Obowiązuje od:** badanie 1.0.0 (folder w `inbox/`), budzenie po zapisaniu od 1.15.0. Przejęcie bez polecenia,
  części skanów, odpowiedź i skany z aplikacji oraz archiwum pod jedną nazwą od badania 1.27.0 i aplikacji 3.23.0.

<!-- zdroj: research:src/commands/tasks.ts:1041 task wait (--images, folder) · src/core/media.ts:117 inboxFolderFor · src/core/inboxwait.ts:25 SETTLE_MS · src/core/inboxwatch.ts:1-8 (30 s) · src/commands/media.ts:141-180 wakeWaiting · src/core/live.ts waiting/<T> answer, PUT /media (X-Strom-Task, X-Strom-Image, 409 waiting.image-same) · src/commands/media.ts:403-478 (same sha under its number → 200 same: true, added []; another number/book → 409 waiting.image-same) · src/core/waiting.ts actionsOf, archiveGroup · src/core/waitkind.ts waitGroupOf (repo: before archive:, host:) · assets/method/waiting.md "Images saved by hand" (the one exception, 7bd55fa1) · assets/method/reading.md · src/commands/guide.ts rule 7 · src/agents/files.ts:80-95 · CHANGELOG.cs.md 1.27.0 · app:CHANGELOG.cs.md 3.23.0 · src/research-waiting.ts:216-272 (actions, order), :448-488 assignImages · src/research-waiting-write.ts:532 WAITING_ANSWER_MAX · src/ui/research-overview-ui.ts:698-812 group head · src/strings.ts live.waitingTask -->

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
4. Ze zgodą **przez przeglądarkę** i z Claude + Chrome agent zapisuje skany sam ([R9.5](#R9.5)) i je przejmuje.
5. W przeciwnym razie skany zapisuje człowiek do folderu albo wysyła je z aplikacji (**Dodaj skany**)
   ([R9.9](#R9.9)).
6. Przejęcie: most od razu, w przeciwnym razie start kolejnej sesji albo polecenie `strom media add --inbox --waiting`.
7. Gdy są tam wszystkie skany, zadanie jest znów **otwarte** w kolejce, z notatką, co przyszło. Gdy niektórych
   brakuje, czeka dalej, a Co czeka pokazuje, których brakuje (z powrotem do kroku 5).
8. W dowolnym momencie: odpowiedź człowieka (w aplikacji lub `strom task wake T… --answer`) przywraca zadanie
   z odpowiedzią. Zgoda **powoli** lub **przez przeglądarkę** przywraca zadania czekające na archiwum, które
   w folderze jeszcze nic nie mają.

- **Obowiązuje od:** badanie 1.27.0, aplikacja Strom 3.23.0

<!-- zdroj: research:src/commands/media.ts:141 wakeWaiting · src/core/archivewait.ts:188 wakeForArchive · src/core/inboxwatch.ts · src/commands/session.ts takeWaiting · src/core/live.ts waiting answer -->

<a id="R9.9"></a>
## R9.9 Co robi człowiek

Kroki przy zadaniu, które czeka na skany archiwum, do którego agentowi nie wolno:

1. **Znaleźć:** aplikacja: **Czeka na decyzję** (grupa według archiwum). Terminal: menu **Co czeka (n)** lub wiersz
   stanu **Czeka: N**. Pozycja podaje księgę, numery skanów i czego do tego brakuje.
2. **Wybrać drogę:**
   - z Claude Code i rozszerzeniem Claude in Chrome można dać archiwum zgodę **przez przeglądarkę** (aplikacja:
     odnośnik **Zgoda…** w notatce przy pozycji, terminal `strom allow archive <web> --way browser`). Zadanie wraca,
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
- **Obsługa:** aplikacja: Czeka na decyzję. Terminal: Co czeka, `strom allow archive`, `strom media add --inbox
  --waiting`.
- **Obowiązuje od:** badanie 1.27.0, aplikacja Strom 3.23.0

<!-- zdroj: research:assets/method/waiting.md "Images saved by hand" · src/core/waiting.ts actionsOf · src/core/browserhelp.ts personBrowserNote · app:CHANGELOG.cs.md 3.23.0 -->

<a id="R9.10"></a>
## R9.10 Przykłady

Poziomy i ograniczenia pochodzą z listy archiwów badania 1.27.0, DigiArchiv SOA Třeboň z badania 1.28.0. Rodzina
Horáków jest zmyślona.

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
- Cytat: trwały odnośnik do skanu to adres jego strony `https://digi.ceskearchivy.cz/<kniha>/<snímek>` albo
  **Odkaz na snímek** w panelu **POPIS**.
- **Obowiązuje od:** badanie 1.28.0

<!-- zdroj: research:assets/archives.json digi.ceskearchivy.cz (manual, browserOnly, terms https://digi.ceskearchivy.cz/Uvod, quote, robots 403, scope, checked 2026-11-05), www.ceskearchivy.cz (stejné terms/quote) · src/core/terms.ts allows (browserOnly + manual) · CHANGELOG.cs.md 1.28.0 · znalosti/archivy-cz.md „SOA v Třeboni (DigiArchiv)“ (odpověď archivu 5. 11. 2026) · commit 805b871d -->
