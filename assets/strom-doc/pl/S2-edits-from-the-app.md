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

<!-- zdroj: research:src/core/sync.ts (v1.25.2) :1-19 · src/core/config.ts:285 sync.review · src/core/live.ts accepts() :1455 sync.auto write|off|mirror · app:src/ui/research-sync-ui.ts :1-21 · strings.ts sync.statePendingSub, sync.flyConflict, sync.showConflicts, sync.decideInResearch, sync.writtenConflictsSub, treeSettings.effectReview -->

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

<!-- zdroj: research:src/core/sync.ts (v1.25.2) SYNC_MAX_BYTES :1325, tree.empty :1218, tree.other-research :2038, tree.foreign :2068, tree.no-ids :2345 · src/core/live.ts seal.foreign, tree.not-downloaded, disk.full · app:src/research-write-held.ts · strings.ts sync.refusedCodes, sync.refusedDetails, sync.noIdsToast, sync.held, sync.writtenCount, sync.notWrittenPick, sync.rejectedAutoSub · 1.26.0: research:src/core/git.ts commitAll po částech (commit 0e7238fc) -->

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

<!-- zdroj: app:src/ui/research-actions-ui.ts (v3.21.2) :448 researchActionUndoSend, UNDO_MAX_AGE_MS :152 · src/research-link.ts:73 sync-undo terminal · strings.ts research.undoSend, sync.undoneSub, sync.sendAgain, sync.loadVersion, sync.againNothing, sync.restoreBeforeLoad · research:src/core/sync.ts :19 strom sync undo · 1.26.0: src/commands/sync.ts:503 sync discard (person), sync undo (person) (commit 942c56f9) -->
