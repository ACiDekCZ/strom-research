<a id="S1"></a>
# S1 Połączenie aplikacji i badania

Jak aplikacja Strom łączy się z badaniem na tym samym komputerze, jakie rodzaje drzew z tego powstają i co się dzieje,
gdy połączenie nie działa. Opisuje aplikację Strom 3.21.2 (i badanie 1.25.2). Zmiany z nowszej wersji mają przy sobie jej numer. Co dzieje się ze zmianami po połączeniu, opisuje [S2](S2-edits-from-the-app.md), telefon
[S5](S5-phone.md).

<a id="S1.1"></a>
## S1.1 Most badania działa tylko na tym komputerze

Aplikacja rozmawia z badaniem przez most: mały serwer, który badanie uruchamia na tym komputerze. Most nasłuchuje
tylko na adresie `127.0.0.1`, na losowym porcie, a każdy jego adres niesie tajny klucz. Dane drzewa nie idą przez most
nigdzie indziej.

- **Granice:**
  - Most przyjmuje zapytanie tylko ze strony aplikacji Strom na stromapp.info lub z adresu lokalnego. Jeśli jego
    klucz przyjdzie z obcej strony, badanie od razu wymienia klucz, a to zapytanie nie dostaje odpowiedzi.
  - Most działa, dopóki człowiek go nie wyłączy (`strom live stop`, w aplikacji przełącznik **Badanie włączone**,
    [S1.9](#S1.9)), albo do wyłączenia komputera. Sam kończy się tylko wtedy, gdy człowiek tak wybrał
    (`live.idleMinutes`, w aplikacji **Po 2 godzinach bez pracy**): gdy przez ten czas nikt o nic go nie pyta i nikt
    przy tym nie pracuje w drzewie. Regularne zapytanie aplikacji o stan nie utrzymuje mostu przy życiu.
  - Most kończy się sam także wtedy, gdy jego badanie zniknie z folderu i brakuje go też przy następnej kontroli co
    najmniej 10 s później. Dysk niedostępny tylko przez chwilę mostu nie kończy. Drugi most tego samego badania,
    uruchomiony obok działającego, od razu się kończy.
  - Gdy most uruchomi się ponownie sam (aktualizacja, bezczynność, awaria), zachowuje adres: ten sam port, jeśli jest
    wolny, i ten sam klucz. Aplikacja łączy się wtedy bez nowego linku.
  - `strom live stop` porzuca klucz: aplikację połączy wtedy ponownie dopiero `strom app`. Jeśli port zajmuje inny
    program, most bierze inny port, a aplikacja potrzebuje nowego linku.
  - Zapis most odrzuca, gdy drzewo jest zapieczętowane na innym komputerze, gdy pliki drzewa w folderze w chmurze nie
    są jeszcze pobrane i gdy dysk jest pełny. Zmiany czekają wtedy w aplikacji ([S2](S2-edits-from-the-app.md)).
- **Obsługa:** terminal: `strom live` (czy most działa?), `strom live start`, `strom live stop` (`--forget` zapomina
  też port), `strom config set live.idleMinutes <minuty>` (0: nigdy sam, domyślnie). Zapis przebiegu jest w folderze
  badania w `.strom/live.log`.
- **Obowiązuje od:** badanie 1.0.0. Ten sam adres po ponownym uruchomieniu od 1.8.0, `live.idleMinutes` od 1.25.0.
- **Od badania 1.29.0:** most nie kończy się już sam po bezczynności (domyślne `live.idleMinutes` 0); wcześniej
  kończył się sam po dwóch godzinach. Wartość zapisana przez człowieka zostaje.
- **Od badania 1.30.0:** most, którego badanie zniknęło, kończy się dopiero po drugiej kontroli co najmniej 10 s
  później (wcześniej od razu); drugi most tego samego badania od razu się kończy.

<!-- zdroj: research:src/core/live.ts (v1.25.2) header :1-80, token crypto.randomBytes :1702, leaked :1809, :1995, LIVE_IDLE_MS / live.idleMinutes :1705, config.ts DEFAULT_LIVE_IDLE_MINUTES = 0 (od 1.29.0), live-last.json :518, seal.foreign / tree.not-downloaded / disk.full · src/commands/start.ts live · src/core/config.ts live.idleMinutes · research:94d75934 src/core/live.ts GONE_MS 10_000 (researchGone: dvě kontroly aspoň 10 s od sebe), otherBridge (most téhož stromu už běží → konec) · CHANGELOG.cs.md 1.30.0 -->

<a id="S1.2"></a>
## S1.2 Badanie otwiera się w aplikacji linkiem z terminala

Badanie otwiera się w aplikacji poleceniem `strom app`. Badanie uruchamia most i otwiera w przeglądarce aplikację
z linkiem do swojego drzewa. Za pierwszym razem w aplikacji powstaje nowe drzewo, następnym razem aktualizuje się to
samo.

- **Granice:**
  - Jeśli w drzewie pracuje agent (albo z opcją `--live`), aplikacja od razu śledzi drzewo na żywo ([S1.4](#S1.4)).
    W przeciwnym razie wczytuje drzewo jeden raz.
  - Aplikacja przyjmuje tylko link do `127.0.0.1` lub `localhost`. Inny link ignoruje z komunikatem „Link wskazywał
    na plik, którego nie ma na tym komputerze, dlatego został zignorowany.”
  - Drzewo z badania już jest w aplikacji i od ostatniego wczytania nie zmieniło się w aplikacji: aktualizuje się.
    Zmieniło się: aplikacja pyta, czy je **Zaktualizuj**, czy **Otwórz jako kopię**. Przed aktualizacją zapisuje się
    kopia zapasowa.
  - Safari nie pozwala stronie internetowej łączyć się z programem na tym komputerze. `strom app` dlatego nigdy nie
    otwiera Safari. Bez odpowiedniej przeglądarki plik przejmuje zainstalowana aplikacja albo można przeciągnąć do
    okna aplikacji plik `output/tree-strom.ged` z folderu badania.
  - Chrome i Edge za pierwszym razem pytają o zezwolenie na dostęp do urządzeń w sieci lokalnej. Bez niego aplikacja
    nie dotrze do badania ([S1.5](#S1.5)).
- **Obsługa:** terminal: `strom app`, `strom app --live`. Aplikacja: **Badanie → Więcej → Badanie dla tego
  drzewa…**
- **Obowiązuje od:** aplikacja 3.0.0, badanie 1.0.0
- **Od badania 1.30.0:** na macOS badanie przekazuje adres dla aplikacji zainstalowanej z przeglądarki opartej na
  Chromium (Chrome, Edge…) przeglądarce, która już działa, tak jak przekazałoby go jej własne drugie uruchomienie. Nie
  uruchamia się żaden inny program, a w Docku nie przybywa ikona przeglądarki. Gdy przeglądarka nie działa lub nie
  odpowie w ciągu 5 s, badanie uruchomi ją jak dotąd.

<!-- zdroj: research:a4a2f6c0 src/core/chromium.ts openWebApp (darwin: handToRunning SingletonSocket, jinak launch), handToRunning (ACK, timeout 5000), singletonMessage · dirigent:prace/1109-vyzkum-dock-chrome/karta.md Výsledek (živě Chrome, Edge, Canary) · research:src/commands/start.ts (v1.25.2) app, liveAppUrl / importAppUrl, Safari · app:src/research-link.ts:584 parseLoopbackUrl, :747 decideResearchOpen · src/ui/research-ui.ts:1088 initExternalOpen, :1350 importResearchFromUrl · src/local-network.ts · strings.ts research.notLocal, research.editedMessage, research.safariBlocked -->

<a id="S1.2.1"></a>
### S1.2.1 Linki, które aplikacja przyjmuje

| Link | Co zrobi aplikacja |
|---|---|
| `?live=` | otworzy drzewo i śledzi je na żywo |
| `?import-url=` | wczyta drzewo z mostu jeden raz |
| `?send=` | wyśle zmiany na adres, który podało badanie uruchomione z aplikacji do wysłania |
| `?research=install` | otworzy instalację badania (link wysłany z telefonu) |
| `?tree=…&research=…&person=…` | otworzy drzewo badania na podanej osobie |

Parametry aplikacja po przetworzeniu usuwa z adresu. Po odświeżeniu strony w trakcie śledzenia śledzenie wznawia się
po cichu.

<!-- zdroj: app:src/ui/research-ui.ts initExternalOpen :1088, rememberedLiveBridge · src/deep-link.ts · src/research-install.ts -->

<a id="S1.3"></a>
## S1.3 Rodzaje drzew w aplikacji

Drzewo w aplikacji jest albo własne, albo należy do badania na tym komputerze. Drzewo z badania niesie w pliku numer
badania i wersję, z której powstało. Dzięki temu aplikacja wie, dokąd je odesłać.

| Rodzaj | W przełączniku drzew | Co to jest |
|---|---|---|
| Własne drzewo | bez oznaczenia | drzewo tylko w aplikacji, bez badania |
| Badanie | **Badanie** | drzewo, w którym pracuje agent badania |
| Archiwum Strom | **Archiwum** | drzewo, które badanie trzyma ze źródłami na dysku, bez agenta |
| Badanie czeka na agenta | **Archiwum** | badanie, które jeszcze nie ma agenta; aplikacja traktuje je jak archiwum |
| Kopia | bez oznaczenia | starsza kopia drzewa z badania (**Otwórz jako kopię**, duplikat, drugi import); z badania już się nie aktualizuje |

- **Granice:** czy drzewo jest badaniem, czy archiwum, rozstrzyga badanie, nie aplikacja. Przełączyć można tylko
  w badaniu.
- **Obsługa:** aplikacja: przełącznik drzew. Terminal: menu badania.
- **Obowiązuje od:** aplikacja 3.12.0 (nazwa Archiwum Strom), oznaczenia w przełączniku od 3.16.0

<!-- zdroj: app:src/research-link.ts _STROM_TREE, _STROM_HEAD · src/types.ts:1695 ResearchLink (copy, mode) · src/research-others.ts researchAgentless · src/ui/research-sync-ui.ts researchKindOf :654, researchAgentAway · strings.ts treeSwitcher.kindArchive, kindResearch · spec 002 · CHANGELOG.cs.md 3.12.0, 3.16.0 -->

<a id="S1.4"></a>
## S1.4 Śledzenie na żywo

Przy śledzeniu na żywo zmiany z badania przychodzą do aplikacji same. Śledzone drzewo jest w tym czasie tylko do
odczytu, aby zmiana w aplikacji nie spotkała się z pracą agenta.

- **Granice:**
  - Na żywo śledzi się zawsze tylko jedno drzewo. Śledzenie innego drzewa kończy poprzednie.
  - Przełączenie na drzewo, w którym pracuje agent, zaczyna je śledzić bez pytania. Niewysłane zmiany otwartego
    drzewa wysyłają się wcześniej.
  - Śledzenie kończy się, gdy agent przestaje pracować albo gdy badanie staje się archiwum. Drzewo można wtedy znów
    edytować.
  - Gdy automatyczne śledzenie się nie uda, aplikacja milczy, a drzewo zostaje takie, jakie było.
- **Obsługa:** aplikacja: **Śledź na żywo** · terminal: `strom app --live`
- **Obowiązuje od:** aplikacja 3.0.0; przełączenie na drzewo z agentem od 3.13.1
- **Od aplikacji 3.26.0 z badaniem 1.30.0:**
  - badanie ma drzewo dla aplikacji zbudowane dla każdego stanu i zachowuje je także po ponownym uruchomieniu mostu;
  - aplikacja od razu pokazuje drzewo w ostatnio zbudowanej postaci. Gdy badanie w międzyczasie poszło dalej, panel
    badania pokazuje „Przygotowywanie nowszej wersji…”, a nowsza wersja sama zastępuje drzewo, gdy tylko jest gotowa;
  - gdy badanie od ostatniego wczytania się nie zmieniło, a drzewo w aplikacji jest wciąż dokładnie tym wczytanym,
    aplikacja nie pobiera go ani nie wczytuje ponownie;
  - podczas śledzenia badanie ogłasza zmianę, gdy jej drzewo jest gotowe.

<!-- zdroj: app:src/ui/research-ui.ts startLiveFollow :2376 (opts.auto), researchReconnectOnly · strings.ts live.followLive, live.followingTree, live.followStarted, live.followMoved, live.liveEndedArchive, live.liveEndedNoAgent · CHANGELOG.cs.md 3.13.1 · spec 011 · app:669c08f0 src/research-tree-file.ts (ged.stale → tree.ged?stale=1, treeFileState preparing; ged.etag → If-None-Match jen u stromu přesně z toho souboru, 304 = strom zůstává), src/ui/research-ui.ts livePreparing, strings.ts research.newerPreparing · research:94d75934 src/core/liveged.ts (strom pro aplikaci jednou pro stav a variantu, na disku i po restartu mostu), src/core/live.ts (change až s hotovým stromem; ETag u tree.ged) · CHANGELOG.cs.md 1.30.0 -->

<a id="S1.5"></a>
## S1.5 Gdy badanie nie działa albo połączenie się nie udaje

Gdy aplikacja nie zastanie badania, drzewo w aplikacji się nie zmienia, a zmiany w nim czekają. Co dokładnie się
stało, aplikacja pokazuje w oknie **Nie udało się połączyć z badaniem**.

| Przyczyna | Co pokaże aplikacja | Co pomoże |
|---|---|---|
| przeglądarka nie dopuszcza strony do urządzeń w sieci lokalnej | **… blokuje połączenie** (nazwa przeglądarki) | zezwolić na **Aplikacje na urządzeniu** (Brave: **Dostęp do localhost**) w ustawieniach witryny |
| przeglądarka dopiero pyta | **Przeglądarka czeka na zezwolenie** | odpowiedzieć na pytanie przeglądarki |
| most nie działa | **Badanie nie odpowiada** | uruchomić badanie; pod nowym adresem połączy je `strom app --live` |
| pod adresem odpowiada inny most (zmieniony klucz, inne drzewo) | **Badanie odrzuciło połączenie** | `strom app --live` |
| Safari | **Safari nie połączy się z badaniem** | otworzyć link w Chrome lub Edge (**Kopiuj link**) |

- **Granice:**
  - Okno zawsze mówi, że nic się nie zmieniło i drzewo zostaje takie, jakie było. **Spróbuj ponownie** ponawia
    połączenie.
  - Drzewo z badania można edytować także wtedy, gdy badanie nie działa. Zmiany wyślą się, gdy badanie znów się
    połączy.
  - Most działa, ale nie odpowiada: pomaga `strom live stop` i ponowne uruchomienie.
- **Obsługa:** aplikacja: **Spróbuj ponownie**, **Zamknij**, **Jak zezwolić** · terminal: `strom app --live`,
  `strom live stop`
- **Obowiązuje od:** aplikacja 3.9.0

<!-- zdroj: app:src/ui/research-ui.ts:1406 showResearchConnectFailed (denied, prompt, down, refused, safari) · src/local-network.ts · strings.ts sync.stateBlocked, sync.blockedSub, sync.settingApps, sync.settingBrave, sync.bridgeDownSub, sync.notRespondingSub, sync.addressRefusedSub, researchOthers.offPanel -->

<a id="S1.6"></a>
## S1.6 Starsze i nowsze wersje

Aplikacja i badanie wydawane są osobno. Badanie mówi aplikacji w stanie, co potrafi, a aplikacja według tego włącza
tylko to, co badanie przyjmie. Badanie z kolei według wersji aplikacji wybiera, co jej wyśle.

- **Granice:**
  - **Starsze badanie** (bez automatycznego wysyłania albo bez tytułów): aplikacja pokazuje **Badanie ma starszą
    wersję (v)** z propozycją **Zaktualizuj badanie**. Zmiany wysyła się wtedy tylko ręcznie: aplikacja uruchamia
    badanie w terminalu, a ono je pobiera. Tytuły do aktualizacji zostają tylko w aplikacji.
  - **Dostępna nowa wersja badania:** aplikacja pokazuje **Nowa wersja Strom Research …** z przyciskiem
    **Zaktualizuj**. To, co właśnie działa, kończy się na obecnej wersji.
  - **Badanie zapisane przez nowszą wersję programu `strom`:** starszy program go nie otworzy ani do niego nie
    zapisze.
  - **Drzewo zapisane przez nowszą wersję aplikacji:** w aplikacji jest tylko do odczytu, dopóki aplikacja się nie
    zaktualizuje.
- **Obsługa:** aplikacja: **Zaktualizuj badanie**, **Sprawdź ponownie** · terminal: `strom update`
- **Obowiązuje od:** aplikacja 3.9.0 (badanie 1.12.0); drzewo tylko do odczytu od aplikacji 3.19.0
- **Od aplikacji 3.22.0:** linie z aplikacji i panel bez połączenia włączają się tylko z badaniem 1.26.0
  ([S4](S4-research-from-the-app.md)).

<!-- zdroj: app:src/ui/research-update-ui.ts · strings.ts researchUpdate.line, researchUpdate.titlesLine, research.updateAvailable, research.updateBusyHint, storage.newerReadOnly · research:src/core/live.ts (v1.25.2) status locked :1516, :2810, appVersionOf :1492 · CHANGELOG.cs.md 3.19.0 -->

<a id="S1.7"></a>
## S1.7 Kilka badań na jednym komputerze

Każde drzewo z badania ma własny most. Aplikacja pyta też mosty drzew, które akurat nie są otwarte, i ich stan
pokazuje w przełączniku drzew.

- **Granice:**
  - Oznaczenia przy drzewie w przełączniku: **na żywo** (jest śledzone), **działa** lub **N linie** (agent
    pracuje), **czeka N** (sprawy do załatwienia), **nie działa**.
  - Pyta zawsze tylko jeden most naraz i tylko wtedy, gdy strona jest widoczna: pierwszy raz po 3 sekundach, potem co
    minutę. Na odpowiedź czeka najwyżej 1,5 sekundy.
  - Niedziałające badanie łączy się ponownie przez otwarcie drzewa z badania (`strom app`).
- **Obsługa:** aplikacja: przełącznik drzew; panel badania, wiersz **Gdzie indziej**
- **Obowiązuje od:** aplikacja 3.13.1

<!-- zdroj: app:src/research-others.ts ResearchTreeKind, OTHER_BRIDGES_TIMINGS · src/ui/research-others-ui.ts · strings.ts researchOthers.otherTreeLabel, researchOthers.offReconnect · CHANGELOG.cs.md 3.13.1 -->

<a id="S1.8"></a>
## S1.8 Dane zostają na komputerze

Aplikacja trzyma drzewa w pamięci przeglądarki na tym urządzeniu. Badanie trzyma swoje drzewo w swoim folderze na
dysku. Między nimi drzewo przechodzi tylko przez most na tym komputerze ([S1.1](#S1.1)).

- **Granice:**
  - Każda przeglądarka ma własną pamięć. Drzewa otwartego w Chrome nie ma w Edge.
  - Drzewo w aplikacji i drzewo w badaniu to dwie kopie. Główne jest drzewo w aplikacji, badanie ma własną kopię,
    a to, czego badanie nie zapisze, jest w aplikacji zawsze widoczne ([S2](S2-edits-from-the-app.md)).
- **Obowiązuje od:** aplikacja 3.0.0

<!-- zdroj: app:src/storage.ts strom-db, strom-originals · strings.ts treeSettings.principles · research:src/core/live.ts 127.0.0.1 -->

<a id="S1.9"></a>
## S1.9 Badanie włączone: przełącznik mostu przy drzewie

Każde drzewo z badania na tym komputerze ma w aplikacji przełącznik **Badanie włączone**. Pokazuje rzeczywisty stan
mostu: włączony, gdy most odpowiada, w przeciwnym razie wyłączony. Włączony most działa do wyłączenia przełącznikiem
lub `strom live stop`, do wyłączenia komputera albo według ustawienia **Wyłączanie badania po bezczynności**.

- **Granice:**
  - Wyłączenie kończy most jak `strom live stop`, tylko że most zachowuje adres (port i klucz). Wyłączony most
    zostaje wyłączony: nowa praca w drzewie go nie przywróci. Drzewo w aplikacji zostaje i można je dalej edytować
    ([S1.5](#S1.5)). Pod przełącznikiem: „Wyłączone. Pozostanie wyłączone, dopóki nie zostanie włączone ponownie.”
  - Most wyłączony z powodu bezczynności wraca sam z nową pracą w drzewie, pod tym samym adresem. Pod przełącznikiem:
    „Wyłączyło się po czasie bez pracy. Nowa praca w drzewie włączy je ponownie.”
  - Włączenie wysyła badaniu link, który uruchamia tylko most pod jego ostatnim adresem, bez okna. Gdy nic się nie
    stanie albo badania nie da się włączyć z aplikacji, aplikacja pokazuje polecenie `strom live start` (do
    uruchomienia w terminalu, w folderze drzewa) z przyciskiem **Kopiuj**. Starsze badanie, którego nie da się wyłączyć
    z aplikacji, tak samo pokazuje polecenie `strom live stop`.
  - Po wyłączeniu lub ponownym uruchomieniu komputera most nie działa i sam się nie uruchomi. Włącza go człowiek:
    w panelu badania **Włącz** albo `strom live start`.
  - **Wyłączanie badania po bezczynności** ma dwie opcje: **Do wyłączenia komputera** (domyślnie) i **Po 2 godzinach
    bez pracy**. Obowiązuje dla wszystkich drzew na tym komputerze i przechowuje je badanie (`live.idleMinutes` 0 lub
    120). Działające mosty przejmują je w ciągu minuty. Wartość ustawiona w terminalu pokazuje się jako **Własna
    wartość (N min)**. Gdy nie działa żadne badanie, które przyjmuje ten wybór, aplikacja zamiast opcji pokazuje
    polecenia do terminala.
  - Na telefonie i tablecie przełącznika nie ma (badanie działa na komputerze). Kopia drzewa z badania przełącznika
    nie ma.
- **Obsługa:** aplikacja: przełącznik **Badanie włączone** w panelu badania (drzewo nieśledzone na żywo i po
  zakończeniu śledzenia) i w **Zarządzanie drzewami** przy wierszu drzewa; panel badania, gdy badanie nie działa:
  **Włącz**; **Ustawienia** → **Badania na tym komputerze** → **Wyłączanie badania po bezczynności**. Terminal:
  `strom live start`, `strom live stop`, `strom config set live.idleMinutes 0` (do wyłączenia komputera) lub `120`
  (po 2 godzinach bez pracy).
- **Obowiązuje od:** aplikacja 3.25.0, badanie 1.29.0

<!-- zdroj: research:src/core/live.ts liveWrite (POST <token>/live {idleMinutes 0…10080} → strom config set live.idleMinutes; {do: stop} → konec stopped, adresa zůstává), liveState (/status live idleMinutes, idleChoices), IDLE_READ_MS 60 s, reviveLive + endedIdle (zpět s prací jen konec idle; bez slova: zpět s menu, prací, aktualizací), stop SIGTERM → signal · src/core/config.ts DEFAULT_LIVE_IDLE_MINUTES 0, LIVE_IDLE_AFTER_MINUTES 120, LIVE_IDLE_CHOICES, LIVE_IDLE_MAX_MINUTES · src/core/links.ts LINK_LIVE_DOS start · src/commands/links.ts startBridge (bez okna) · app:src/ui/research-live-ui.ts researchLiveState (onComputer, link.copy, features live.stop / live.start), fillResearchLiveSlot, fillResearchLiveStart, renderResearchLiveSettings (LIVE_IDLE_FOREVER, LIVE_IDLE_TWO_HOURS, idleCustom), COMMAND_START / COMMAND_STOP · src/ui/research-ui.ts researchLiveSlot (panel po skončení sledování, idle, start) · src/ui/tree-management.ts researchLiveSlotHtml · strings.ts researchLive.* · index.html settings-group-research-live · spec 064 K1.1–K2.3 -->
