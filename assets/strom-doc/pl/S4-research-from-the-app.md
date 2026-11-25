<a id="S4"></a>
# S4 Badanie sterowane z aplikacji

Co z badania pokazuje aplikacja i co można z niej uruchomić w badaniu: bieżącą pracę, kolejkę, linie i działania,
które otwierają badanie. Opisuje aplikację Strom 3.21.2 (i badanie 1.25.2). Zmiany z nowszej wersji mają przy sobie jej numer.

<a id="S4.1"></a>
## S4.1 Panel i Przegląd badania pokazują bieżącą pracę

Przy śledzeniu badania ([S1](S1-connecting-app-and-research.md)) aplikacja pokazuje mały panel **Badanie na żywo ze
Strom Research**, a z niego większy **Przegląd badania**. Oba tylko czytają. To, co pokazują, badanie wysyła przez
most.

- **Granice:**
  - Panel: **Trwa praca**, **Czeka na załatwienie**, **Ostatnie zmiany** (5 najnowszych, link **Wszystkie zmiany
    w przeglądzie ›**), **W kolejce** (3 zadania), a pod tym liczba sesji agenta w tym miesiącu.
  - Gdy panel jest wyższy niż okno, zwija się sam najpierw **W kolejce**, potem zmiany, potem **Trwa praca**.
    **Czeka na załatwienie** nigdy nie zwija się sam. Sekcja, którą zwinął lub rozwinął człowiek, zostaje taka, jaka
    jest.
  - Przegląd, sekcje w tej kolejności: podsumowanie (**Stan**, **Ostatnie 24 h**, **Ten miesiąc** z liczbą sesji),
    **Teraz**, **Czeka na załatwienie** (tylko gdy coś czeka), **Linie** ([S4.3](#S4.3)), **Przebieg**, **Kolejka**
    ([S4.2](#S4.2)), **Co wie badanie** ([S3](S3-what-the-research-knows.md)). **Kolejka** i **Co wie badanie** są
    na początku zwinięte.
  - **Przebieg** łączy kroki po 15 minut, pokazuje najwyżej 20 kroków.
  - Przegląd jest na szerokim oknie (od 1280 px) panelem bocznym obok drzewa, na tablecie warstwą nad drzewem, na
    telefonie całym ekranem. Na telefonie panel staje się paskiem, a stuknięcie otwiera przegląd.
  - Bez śledzenia panel pokazuje ostatnie znane **Czeka na załatwienie** ze zdaniem **Stan na …. Badanie teraz nie
    działa.**
- **Obsługa:** aplikacja: panel, przyciski **⤢ Otwórz przegląd** i **Zakończ śledzenie**; menu **Badanie → Przegląd
  badania**.
- **Obowiązuje od:** aplikacja 3.5.0
- **Od aplikacji 3.22.0:** każdą sekcję można rozwinąć, zwinąć lub ukryć, a wybór obowiązuje dla panelu i przeglądu
  ([S4.1.2](#S4.1.2)). **Czeka na załatwienie** nie rozwija się samo nawet przy nowej pozycji.
- **Od aplikacji 3.27.0:** z badaniem 1.31.0 wiersz w **Teraz** pokazuje przy zadaniu, które nie należy do żadnej
  linii, dlaczego się nad nim pracuje: przy zadaniu, które linii tylko pomaga, której i jak („pomaga linii Przodkowie:
  Jan Horák · łączy ludzi z drzewem”; dalej „pytanie linii”, „według agenta”, „małżonek przodka”, „gałąź …”), przy
  zadaniu poza liniami jego gałąź („poza liniami · gałąź Josef Horák”, pod nagłówkiem **Poza liniami** tylko „gałąź
  Josef Horák”). Co pomaga linii, mówi [R2.3](R2-lines-and-queue.md#R2.3). Wiersze **Trwa praca** w małym panelu
  mówią to samo; pod nagłówkiem linii tylko jak, bez jej nazwy.
- **Od aplikacji 3.27.0:** **Przegląd badania** otwiera się także bez śledzenia ([S4.1.5](#S4.1.5)): w menu
  **Badanie** jest zawsze pierwszy, drugie jest **Śledź na żywo**, podczas śledzenia na jego miejscu **Zakończ
  śledzenie**; w Archiwum Strom **Śledź na żywo** nie ma. Z **Przeglądu drzewa** otwiera go **Badanie ›** w nagłówku
  **Na czym się skupić**. Przycisk **⤢ Otwórz przegląd** w małym panelu jest tylko podczas śledzenia.
  - Podsumowanie pokazuje tylko włączone części ([S4.1.2](#S4.1.2)): **Ostatnie 24 h** osoby i źródła, **Ten miesiąc**
    liczbę sesji. Koszt (kwotę i odczyt skanów) pokaże dopiero po włączeniu, inaczej nawet w tekście po najechaniu.
    Pod małym panelem stoi „Agent w tym miesiącu: 4 sesje”, kwota, oba albo nic.
  - W wierszu linii w sekcji **Linie** stoi przy pracy tylko „trwa praca”, gdy sekcja **Teraz** jest widoczna
    (rozwinięta i zwinięta); całe „Teraz: …” jest w tekście po najechaniu. Przy ukrytym **Teraz** wiersz mówi
    „Teraz: …” w całości.
- **Od aplikacji 3.28.0:** na komputerze Przegląd otwiera się także w osobnym oknie ([S4.1.6](#S4.1.6)). Od
  aplikacji 3.30.0 mały panel obok tego okna ma tylko nagłówek i **Trwa praca**.
- **Od aplikacji 3.28.0:** mały panel pamięta na tym urządzeniu, czy jest zwinięty: jeden wybór dla wszystkich
  badań, domyślnie rozwinięty. Przejmuje go odświeżenie strony, nowe śledzenie i panel innego badania; zapisuje go
  tylko strzałka panelu. Otwarty Przegląd nie rozwija już panelu za sobą. Telefon wyboru nie czyta ani nie zapisuje
  (pasek otwiera przegląd jak dotąd). Bez pamięci przeglądarki (okno prywatne) obowiązuje do zamknięcia strony.
- **Od aplikacji 3.31.0:** na telefonie trzymanym poziomo rozwinięty panel śledzonego badania zwija się do paska,
  gdy pojawi się wskaźnik wczytywania zdjęć **Zdjęcia k / n** ([S1.4.1](S1-connecting-app-and-research.md#S1.4.1)) albo powiadomienie (nie pigułka **Cofnij** ani
  potwierdzenie ustawienia w centrum). Sam się ponownie nie rozwinie, nawet gdy wskaźnik albo powiadomienie
  zniknie; rozwija go stuknięcie w nagłówek. Zwinięcie nie jest zapamiętywane jako wybór urządzenia. Na komputerze,
  tablecie i telefonie trzymanym pionowo nic się nie zmienia.
- **Od aplikacji 3.31.0 z badaniem 1.36.0:** **Trwa praca** i **Teraz** pokazują także agenta, który pracuje
  bezpośrednio w badaniu („Claude Code – praca bezpośrednia”). Przy pracy, która trzyma zadanie
  ([R7.9](R7-when-the-agent-works.md#R7.9)), stoi „ostatnio 14:31; zwolni się najpóźniej o 15:01” (ostatnio tylko
  wtedy, gdy różni się od początku; przy procesie na tym komputerze bez czasu zwolnienia). Przebieg, który czeka na
  archiwum z ograniczeniami ([R9.13](R9-archives.md#R9.13)), ma stan „Wstrzymano · czeka na archiwum … (najdłużej
  do 14:40)”. Ze starszym badaniem wszystko jest jak wcześniej.
- **Od aplikacji 3.31.0 z badaniem 1.36.0:** przy kilku przebiegach **Teraz** ma blok dla każdego przebiegu; każdy
  się śledzi i zatrzymuje osobno ([S4.1.8](#S4.1.8)).
- **Od aplikacji 3.32.0 z badaniem 1.37.0:** gdy agent zapisuje skany księgi przez swoją przeglądarkę
  ([R9.5](R9-archives.md#R9.5)), przy zadaniu jego wiersza stoi „agent zapisuje skany (k z n)”: w panelu na żywo,
  w **Teraz** z jednym przebiegiem, w wierszu linii, w bloku przebiegu i przy liniach. Bez paska postępu; liczba
  rośnie ze skanami. Takiego zadania nie ma w **Czeka na załatwienie** ani w liczbach
  ([R6.2.1](R6-awaiting-action.md#R6.2.1)). Ze starszym badaniem wiersze są jak dotąd.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:223 PANEL_CHANGES, (3.28.0: app 8da3f11e MINI_OPEN_KEY strom-research-mini-open, miniPanelFolded, rememberMiniPanelFolded, ne na telefonu; otevřený Přehled panel nerozbalí), :227 AUTO_FOLD, :3326 appendQueueSection(…, 3), renderLivePanel, renderIdleResearchPanel · src/ui/research-overview-ui.ts:5 (≥1280), :51 FOLDED_BY_DEFAULT, :53 GROUP_MS, :59 MAX_STEPS, :74, :309-311 · strings.ts live.overviewTitle, research.panelLabel, research.stop, research.atWork, research.queue · 3.27.0 Teď: app 4e4f6d8c src/research-link.ts WORKING_HELPS_FEATURE (working.helps), sanitizeWorking (helps jen s linií, branch) · src/ui/research-offline-ui.ts workingWhyText (helps → qWhyHelps + qWhyHow / qWhyHowBranch; větev mimo linie → qWhyOutBranch, ve skupině qWhyHowBranch) · src/ui/research-overview-ui.ts (Teď: důvod místo názvu linie) · strings.ts live.qWhyHelps, qWhyHow.*, qWhyHowBranch, qWhyOutBranch · spec 036 K1.8 · malý panel: app 2c018779 src/ui/research-ui.ts, research-directions-ui.ts (pod nadpisem linie jen jak) · 3.27.0 spec 057: app f05fff8e src/ui/research-actions-ui.ts overviewRows (research-item-overview první; stop při sledování, jinak followLive, ne bez agenta), src/ui/tree-actions.ts researchOverview · 8d564b35 src/ui/tree-overview.ts treeOverviewResearchLinkHtml (live.researchLink v záhlaví focus) · 28bbebeb src/ui/live-section-prefs.ts TOP_DEFAULTS (month.price false), research-overview-ui.ts appendOverviewSummary, strings.ts live.spendSessions, spendAmount · 87a6ea88 live.dirWorkedOn · strings.ts live.openOverview · 3.31.0: app 7be40d24 src/ui/landscape-panel-fold.ts (MQ_PHONE_LANDSCAPE, jen rozbalený panel, images nebo toast message, nerozbalí se sám, nepamatuje se) · SPEC.md 1120-app-108-diry · spec 116 · 3.31.0 spec 127: app:f89b5166, 040e42e6 src/research-holds.ts workingHoldText, waitsText, src/ui/research-ui.ts pausedText (statePaused · waitsArchive), workingHoldEl, src/ui/research-overview-ui.ts:921, src/research-link.ts features task.holds, archive.holds · strings.ts live.holdLast, holdFreeBy, waitsArchive · research cs.json who.agent · 3.32.0: app:7a10c93f (working[].saving jen s working.saving: kniha, dvě celá čísla, saved ≤ of) strings.ts live.workingSaving · research:81de7cdb src/core/live.ts working[].saving, feature working.saving -->

<a id="S4.1.1"></a>
### S4.1.1 Śledź agenta w drzewie

Drzewo może samo przechodzić do osoby, nad którą agent właśnie pracuje (pierwsza niewstrzymana praca w sekcji
**Teraz**).

- **Granice:** najwyżej jedno przejście na 8 s. Gdy drzewo jest oddalone bardziej niż do 0,55, przybliża się do 0,8.
  Przesunięcie drzewa, wybór innej osoby lub inny widok przerywa śledzenie (**Wróć do agenta**); po 20 s bez dotyku
  wraca samo. Wybór zapamiętuje się dla urządzenia.
- **Obsługa:** aplikacja: **Przegląd badania → Śledź agenta w drzewie** / **Przestań śledzić**.
- **Obowiązuje od:** aplikacja 3.5.0
- **Od aplikacji 3.24.0:** śledzić można także w wachlarzu i na mapie ([S4.1.3](#S4.1.3)); przesunięcie mapy wstrzymuje je tak samo.
- **Od aplikacji 3.30.0:** ◎ **Przestań śledzić** zatrzymuje przeskoki tylko w oknie, w którym zostanie kliknięte;
  inne okna śledzą dalej, każde we własnym widoku ([S4.1.7](#S4.1.7)).
- **Od aplikacji 3.30.0:** łuk wokół portretu osoby, nad którą pracuje agent, jest widoczny także obok oznaczeń
  badania na karcie ([S4.4.1](#S4.4.1)).

<!-- zdroj: app:src/ui/live-follow-ui.ts:7, :26 ZOOM_FAR, :27 ZOOM_READABLE, :32 gap 8000 / idle 20_000 · strings.ts live.followOn, live.followOff · 3.30.0: spec 097 O1, O3, ZADANI_DEV §6 (◎ v hlavním okně další okna nevypne) · oblouk vedle značek: app:16cba085 src/card-signals.ts showAgent -->

<a id="S4.1.2"></a>
### S4.1.2 Dostosowanie panelu

Każda sekcja śledzenia badania ma jeden wybór: **Rozwinięta**, **Zwinięta** albo **Ukryta**. Wybór obowiązuje dla
panelu i przeglądu.

- **Granice:**
  - sekcje: **Trwa praca** (w przeglądzie **Teraz**), **Czeka na załatwienie**, **Ostatnie zmiany** (w przeglądzie
    **Przebieg**), **W kolejce** (w przeglądzie **Kolejka**) i tylko w przeglądzie **Linie** oraz **Co wie badanie**;
  - sekcja bez wyboru (**domyślna**) pokazuje się jak wcześniej: panel zwija, co się nie mieści (**zwinięta, brak
    miejsca**), przegląd ma zwinięte sekcje **Kolejka** i **Co wie badanie**. Sekcji z wyborem panel sam nie zwija;
  - kliknięcie nagłówka sekcji to trwały wybór (rozwinąć / zwinąć);
  - wybór zapamiętuje się na tym urządzeniu dla wszystkich drzew, nic się nie synchronizuje. Wcześniejsze ręczne
    zwinięcie sekcji przejmuje się jeden raz;
  - **Przywróć domyślne** usuwa wszystkie wybory. Przywrócenie domyślnych i ukrycie sekcji z jej menu można przez
    chwilę cofnąć (**Cofnij**). Gdy ukryte są wszystkie sekcje, panel mówi **Wszystkie sekcje są ukryte.**
- **Czeka na załatwienie zwinięte lub ukryte:**
  - nowa pozycja sekcji nie rozwija. Nagłówek pokazuje liczbę i **N nowych**; wyróżnione, gdy jest wśród nich
    decyzja lub zgoda (**w tym decyzja lub zgoda**);
  - ukryte zostawia etykietę **Czeka N** w nagłówku panelu, w podsumowaniu zwiniętego panelu, w pasku na telefonie
    i w przeglądzie. Kliknięcie pokazuje sekcję w przeglądzie, dopóki przegląd się nie zamknie (**Ukryta sekcja,
    widoczna do zamknięcia przeglądu.**).
- **Obsługa:** aplikacja: **⋯ → Dostosuj panel…** w nagłówku panelu i przeglądu; prawy przycisk albo długie
  naciśnięcie na nagłówku sekcji (także klawisz Menu lub Shift+F10); **Ustawienia → Śledzenie badania**. Na
  telefonie jako panel wysuwany od dołu.
- **Obowiązuje od:** aplikacja 3.22.0
- **Od aplikacji 3.27.0:** **Dostosuj panel** ma dwie karty, takie same w oknie, w panelu wysuwanym od dołu na
  telefonie (zamyka go **Gotowe**) i w **Ustawienia → Śledzenie badania**:
  - **Sekcje i kolejność:** wszystkie sześć sekcji na jednej liście i w jednej kolejności dla panelu i przeglądu
    (panel pomija **Linie** i **Co wie badanie**). Każdy wiersz ma wybór **Rozwinięta** / **Zwinięta** / **Ukryta**
    (ukryty wiersz „ukryta”). Wiersz przesuwa się strzałkami ↑ ↓ (na skrajach nie działają), Alt+↑ / Alt+↓,
    przeciąganiem za ⠿ (Esc anuluje przeciąganie; na telefonie uchwytu nie ma) albo w menu sekcji **Przesuń w górę**
    / **Przesuń w dół**. Czytnik ekranu powie nowe miejsce („… przeniesiono na pozycję 2 z 6.”). Domyślna kolejność:
    **Trwa praca** (**Teraz**), **Czeka na załatwienie**, **Linie**, **Ostatnie zmiany** (**Przebieg**), **W kolejce**
    (**Kolejka**), **Co wie badanie**. Gdy panel się nie mieści, zwija sekcje od dołu tej kolejności;
  - **Na górze:** **Stan** jest zawsze widoczny („zawsze widoczny”). **Ostatnie 24 h** (części **osoby**,
    **źródła**) i **Ten miesiąc** (części **sesje**, **koszt**) mają każdy przełącznik i swoje części; kafelek
    z obiema wyłączonymi częściami znika. **Koszt** jest domyślnie wyłączony („Koszt widać dopiero po włączeniu.”).
    Na telefonie **Ten miesiąc** jest szary („Na telefonie niewidoczny.”). **Śledzenie w** można ukryć („Tylko
    podczas śledzenia na żywo.”), śledzenie działa wtedy w widoku wybranym wcześniej;
  - stopka: **Przywróć domyślne** przywraca stany sekcji, kolejność i **Na górze** (koszt znów ukryty), bez pytania,
    z powiadomieniem „Przywrócono domyślne” i **Cofnij** przez 8 s; **Wszystkie ustawienia śledzenia ›** otwiera
    Ustawienia. Ukrycie sekcji bezpośrednio w oknie **Dostosuj panel** nie jest ogłaszane, ukrycie z menu sekcji tak
    („Sekcja ukryta”, **Cofnij**);
  - wybory obowiązują na tym urządzeniu dla wszystkich drzew, dla panelu i Przeglądu badania, ze śledzeniem i bez
    niego. Wcześniej zapisane wybory zostają.

<!-- zdroj: app:src/ui/live-section-prefs.ts SECTION_PREFS_KEY, PREF_KEYS, OVERVIEW_KEYS, OLD_PANEL_KEY · src/ui/live-section-edit.ts · src/ui/live-section-edit-ui.ts · src/ui/research-ui.ts:282 waitingHeadInfo, :312 waitingChip, :3180 toggle, :3215 resetLiveSections, :3225 hideLiveSection · src/ui/research-overview-ui.ts:376 shownOnce · strings.ts live.editPanel(Menu), sectionExpanded/Collapsed/Hidden/Default, resetDefaults, autoFoldedNote, allHidden, waitingShort, importantHint, shownOnce, settings groupResearchFollow · commity c4b1dcc, a56232a · spec 044 K1–K5 · 3.27.0: app 28bbebeb src/ui/live-section-prefs.ts DEFAULT_ORDER, TOP_KEYS, TOP_DEFAULTS (záznam v2: pořadí, nahoře; v1 se čte beze změny) · 0b090a80 src/ui/live-section-edit-ui.ts (Sekce a pořadí / Nahoře, ⠿ ne v listu, Alt+↑↓, Escape tažení, Hotovo) · src/ui/research-ui.ts resetLiveSections (RESTORED_TOAST_MS 8000, live.undo), hideLiveSection (hiddenToast, undo.undo) · strings.ts live.groupSections, groupTop, alwaysShown, topDay, partPersons, partSources, topMonth, partSessions, partPrice, priceHelp, monthPhoneNote, topFollowIn, followInHelp, moveUp, moveDown, movedSr, allFollowSettings, settingsNote, restoredToast, hiddenToast, done · spec 057 K1.1–K1.7, K2.1 -->

<a id="S4.1.3"></a>
### S4.1.3 Śledzenie w wachlarzu i na mapie

Śledzenie agenta ([S4.1.1](#S4.1.1)) działa w Rodzinie, w wachlarzu i na mapie. Przełącznik **Śledzenie w** zmienia
widok, a śledzenie zostaje włączone. Wachlarz się przy tym nie porusza, tylko oznacza, gdzie się pracuje; mapa
pokazuje miejsce pracy pierścieniem.

- **Wachlarz:**
  - środkiem wachlarza jest **Osoba w centrum uwagi** sprzed włączenia śledzenia (domyślnie), **Osoba domyślna** albo
    **Wybrana osoba** (dla jednego drzewa). Nigdy nie jest to osoba, nad którą agent pracuje. **Przypiąć jako środek**
    zatrzymuje osobę jako środek, **Odpiąć środek** ją puszcza; nowy środek przenika się w 150 ms;
  - osoba, nad którą się pracuje, ma obrys w kolorze sesji i mignie dwa razy, gdy praca się przesunie i gdy śledzenie
    przejdzie do wachlarza. Wąski wycinek dostaje znacznik poza wachlarzem;
  - osoba poza wachlarzem dostaje etykietę **Praca poza wachlarzem:** przy najbliższej osobie wachlarza, w tej
    kolejności: mąż albo żona, rodzeństwo, przodek za krawędzią wachlarza, przy potomku środek, inaczej pierwszy przodek
    do 12 pokoleń wstecz.
- **Mapa:**
  - miejsce pracy ma pierścień w kolorze sesji: pełny pierścień to **miejsce wpisu** (miejsce źródła, nad którym agent
    pracuje, gdy badanie je wysyła), przerywany to **miejsce osoby** (pierwsze miejsce z położeniem z urodzenia,
    zamieszkania, ślubu, zgonu). Nigdy nie jest to siedziba archiwum;
  - pierścień raz pulsuje, gdy śledzenie przejdzie na mapę. Mapa przesuwa się tylko wtedy, gdy miejsce pierwszej sesji
    jest poza widokiem, a mapa nie jest wstrzymana. Ręczne przesunięcie mapy ją wstrzymuje (**Przesuwanie mapy
    wstrzymane**) do **Powrót do agenta**;
  - miejsce bez położenia pokazuje u góry wiersz „… – bez położenia na mapie” z **Wyszukać położenie** (przy drzewie
    z badaniem **Odszukaj w badaniu**, [A6.5.2](A6-views.md#A6.5.2)); osoba bez miejsca „… – bez miejsca”;
  - legenda **Znaczenie wyróżnień** objaśnia pierścienie, ślad i pusty znacznik.
- **Ślad sesji:** w Rodzinie, wachlarzu i na mapie osoby i miejsca, nad którymi się pracowało, bledną z wiekiem:
  najwyżej ostatnie 8 zmian, żadna starsza niż 60 minut. Na mapie to puste pierścienie, miejsca jednej sesji łączy
  kropkowana linia (nie na telefonie). Ślad można wyłączyć.
- **Granice:**
  - gdy działa kilka sesji, każda ma numer (widoczny od dwóch) i kolor: pierwsza główny, kolejne akcentowy;
  - praca nad ślubem jest śledzona przy parze: w centrum uwagi jest mąż, inaczej żona;
  - ustawienia obowiązują na tym urządzeniu dla wszystkich drzew, wybrana osoba tylko dla swojego drzewa. Na
    telefonie widok jest uproszczony.
- **Obsługa:** aplikacja: przy śledzeniu **Śledzenie w** (Rodzina, Wachlarz, Mapa); **Ustawienia → Śledzenie
  badania** → **Śledzenie agenta w** (używane przy włączeniu śledzenia i przy **Powrót do agenta**), **Środek
  wachlarza przy śledzeniu** (**Wybrać osobę**, **Zmienić**), **Ślad sesji w Rodzinie, wachlarzu i na mapie**;
  w wachlarzu **Przypiąć jako środek** / **Odpiąć środek**.
- **Obowiązuje od:** aplikacja 3.24.0
- **Od aplikacji 3.25.0:** legenda mapy mówi „Pusty znacznik: miejsce bez osoby wśród pokazanych miejsc”, a miejsce
  pracy bez osoby na mapie „na razie bez osoby na mapie” (wcześniej „poza zakresem mapy”).
- **Od aplikacji 3.30.0:** **Śledzenie agenta w** dotyczy tylko okna głównego; inne okna śledzą w widoku, który
  pokazują ([S4.1.7](#S4.1.7)). Na komputerze z myszą (okno szersze niż 640 px) mówi to pomoc w Ustawieniach:
  „Dotyczy okna głównego przy włączeniu śledzenia i przy Powrót do agenta. Inne okna śledzą we własnym widoku.”

<!-- zdroj: app:src/ui/live-follow-ui.ts (hlavička, followIn) · src/live-follow-prefs.ts · src/live-follow-targets.ts TRAIL_MAX=8, TRAIL_MAX_AGE_MS=60 min, fanCenter, sessionNumbers, sessionTone · src/live-follow-map.ts · src/fan-follow-anchor.ts MAX_UP=12 · src/ui/fan-follow-ui.ts · src/ui/map-follow-ui.ts PAN_MARGIN=64, PAN_MS=400, telefon bez čáry · strings.ts settings.groupResearchFollow, researchFollowNote, followView(Help), followFanCenter*, followTrail(Help); live.followIn, mapPaused, legendTitle, legendTrail, legendRecord, legendPerson, legendOut; fan.pin, unpin, centerLabel, workOutside; map workRecord, workPerson, outScope, noCoords, noPlace, locate · CHANGELOG.cs.md 3.24.0, 3.25.0 · spec 043 · 3.30.0: app:e7e79873 src/ui/live-section-edit-ui.ts (isMouseWide → settings.followViewHelpWindows) · src/breakpoints.ts MQ_MOUSE_WIDE · spec 097 O5, ZADANI_DEV §8 -->

<a id="S4.1.4"></a>
### S4.1.4 Zmiany z badania bez migania

Zmiana z badania pojawia się w drzewie od razu, bez przerysowania całego ekranu. Karty, które zostają, trzymają swoje
miejsce; to, co przybyło, ubyło albo się zmieniło, pokazuje się krótko ruchem.

- **Granice:**
  - zostające karty przesuwają się płynnie (320 ms). Nowa osoba wyrasta ze swojej linii, a wzdłuż linii przebiega
    światło; usunięta cofa się do swojej linii; scalona osoba spływa w tę, która zostaje (po tym samym nazwisku,
    urodzeniu ±1 rok, wspólnym rodzicu albo partnerze); zmieniona karta ma obrys w kolorze sesji;
  - ruchem pokazuje się najwyżej 12 nowych kart; przy ponad 60 zmienionych osobach ruch jest pomijany, a zmiany
    pokazują się od razu. Na telefonie i tablecie czasy są krótsze (×0,875);
  - nowa osoba poza widokiem dostaje znacznik przy krawędzi („Dodano poza widokiem: …”, 4 s). Powiększenie ani osoba
    w centrum uwagi się nie zmieniają. Czytnik ekranu ogłasza zmiany;
  - wyłączony **Ruch przy wczytywaniu zmian** i ograniczenie ruchu w systemie pokazują zmiany od razu, tylko
    wyróżnione („W systemie włączono ograniczenie ruchu, dlatego zmiany pojawiają się bez ruchu.”).
- **Obsługa:** aplikacja: **Ustawienia → Śledzenie badania → Ruch przy wczytywaniu zmian** (domyślnie włączony).
- **Od aplikacji 3.32.0:** osoba zastępcza „?”, która przy wczytaniu dostała nowe ID, nie jest ani nowa, ani usunięta:
  nie ogłasza jej ani znacznik przy krawędzi, ani czytnik ekranu; ogłaszane są tylko prawdziwe osoby. Dotyczy to też
  stanu po wysłaniu do badania i po cofnięciu scalenia.
- **Obowiązuje od:** aplikacja 3.24.0

<!-- zdroj: app:src/live-transition.ts LIVE (move 320 ms, maxAnimatedNew=12, maxChangedForScene=60, ×0.875 touch), src/live-diff.ts (merge guess: surname, birth ±1, parent/partner) · strings.ts settings.liveMotion, liveMotionHelp, liveMotionReduced, edgeAdded · CHANGELOG.cs.md 3.24.0 · spec 055 · 3.32.0: app:6c90cc34 (134 V-N6: realPeople, zástupná „?“ s novým ID se nehlásí) -->

<a id="S4.1.5"></a>
### S4.1.5 Przegląd badania bez śledzenia

**Przegląd badania** można otworzyć przy każdym drzewie z badania także bez śledzenia. Drzewo nie przełącza się przy
tym na wersję badania, nie blokuje się i można je dalej edytować. Co Przegląd pokaże, zależy od tego, czy most
badania odpowiada.

- **Most odpowiada** (badanie na tym komputerze działa): Przegląd pokaże to samo co podczas śledzenia (kafelki
  i wszystkie sekcje) z regularnego zapytania do mostu; pod **Stan** „odświeżono …”. **Czeka na załatwienie** i zarządzanie
  liniami działają przez most. Pod nagłówkiem stoi „Drzewo przełączy się na wersję badania i nie będzie można go
  edytować.” z przyciskiem **Śledź na żywo**. Gdy agent w międzyczasie zacznie pracować, nad tym stoi „Agent zaczął”,
  a przycisk jest wyraźniejszy; samo nic się nie przełącza. W Archiwum Strom tego paska nie ma.
- **Most nie odpowiada:**
  - **Stan** „Badanie nie działa” z **Włącz** (gdzie badania nie da się włączyć z aplikacji, stoi tam, jak je
    uruchomić);
  - **Czeka na załatwienie** tak, jak badanie ostatnio podało je na tym urządzeniu, ze „stan na …”; starsze niż 7 dni się
    nie pokazuje;
  - **Linie** z pliku drzewa: nazwa i liczba osób, nic o pracy nad nimi; **Co wie badanie** i w stopce **Gdzie brakuje
    dowodów: N osób ›**;
  - sekcji **Teraz**, **Przebieg** i **Kolejka** nie ma; jeden wiersz je wymienia, np. „Teraz, Przebieg i Kolejka:
    po włączeniu badania.” (ukryte sekcje pomija; gdy ukryte są wszystkie trzy, wiersza nie ma). Gdy tylko most odpowie,
    Przegląd przerysuje się sam.
- **Telefon** nie pyta mostu: **Stan** „Tylko z drzewa” i „Pracę agenta widać na komputerze z badaniem.” W poziomie
  stan zostaje na górze, a sekcje przewijają się pod nim.
- **Gdzie indziej w aplikacji:** bez śledzenia pracę agenta i kolejkę, gdy most odpowiada, pokazuje też widok Tabela
  ([A6.7.14](A6-views.md#A6.7.14)).
- **Obsługa:** aplikacja: **Badanie → Przegląd badania**; **Przegląd drzewa → Na czym się skupić → Badanie ›** (przy
  drzewie bez osób w nagłówku okna); na telefonie i tablecie w działaniach drzewa, grupa **Badanie**; w Przeglądzie
  **Śledź na żywo**.
- **Obowiązuje od:** aplikacja 3.27.0
- **Od aplikacji 3.28.0:** gdy most odpowiada, **⋯** przy zadaniu w **Kolejce** zmienia jego miejsce jak podczas
  śledzenia: **Zrób jako następne** z **Cofnij** ([S4.2.2](#S4.2.2)), a gdzie badanie je oferuje, **Na koniec**
  i **Przywróć domyślne** ([S4.2](#S4.2)). Tak samo w wynikach wyszukiwania ([S4.2.1](#S4.2.1)) i w osobnym oknie
  Przeglądu ([S4.1.6](#S4.1.6)), gdzie robi to główne okno. Zapisuje to most badania; śledzenie się nie zaczyna,
  drzewo się nie przełącza i można je dalej edytować. Kolejka zaraz potem wczytuje się z badania, bez czekania na
  regularne zapytanie. Bez mostu (Przegląd z drzewa, telefon) nic się nie zmienia.
  Tak samo Przegląd bez śledzenia pyta most o stan zaraz po każdym zapisie przez most: w **Czeka na załatwienie**
  odpowiedź, **Dodaj plik**, **Wysłano** i **Przywróć do załatwienia**, odpowiedź na pytania o miejsca i o rosnącą
  gałąź; w **Linie** założenie, edycja, przeniesienie, wstrzymanie, zakończenie i wznowienie linii; rozstrzygnięcie
  sprzeczności, cofnięcie wartości oraz weryfikacja lub potwierdzenie danej przez most. Okno Przeglądu
  ([S4.1.6](#S4.1.6)) dostaje nowy stan od okna głównego, które robi zapis.
- **Od aplikacji 3.28.0:** Przegląd badania bez śledzenia da się zamknąć przyciskiem ⤡ i ×; panel badania, który był widoczny obok niego,
  po zamknięciu Przeglądu pokaże się znowu. **Zakończ śledzenie** w otwartym Przeglądzie tylko kończy śledzenie,
  a Przegląd zostaje otwarty bez śledzenia; zakończenie, które aplikacja robi sama (na przykład przełączenie do
  archiwum), go zamyka. Przełączenie na inny widok zamyka Przegląd bez śledzenia jak ⤡; Przegląd śledzonego badania
  zostaje.

<!-- zdroj: app:f05fff8e, 48573de6 src/ui/research-overview-ui.ts renderResearchOverview (source live | bridge | tree; fromTree vynechá working, changes, queue), appendOverviewStateOff (notRunning, turnOn / researchLiveStartHow; telefon phoneTreeOnly, phoneWhy), overviewFollowStrip (activeResearchAgentless → bez pruhu; agentStarted, followNote), appendOverviewWaitingAsOf (asOf), appendOverviewSkeletonLines, appendOverviewFoot (missingLink) · src/research-overview-source.ts BRIDGE_ONLY_SECTIONS, afterTurnOnKeys, skeletonLines (_STROM_DIRECTION, místa osob) · src/research-device.ts WAITING_MAX_AGE_MS = 7 dní · src/ui/research-ui.ts OverviewViewing (refreshedAt, agentStarted, waitingAt) · src/ui/tree-actions.ts researchOverview · 8d564b35 src/ui/tree-overview.ts treeOverviewResearchLinkHtml (sekce focus, bez osob v záhlaví) · strings.ts live.followNote, agentStarted, notRunning, turnOn, afterTurnOn, refreshedAgo, asOf, phoneTreeOnly, phoneWhy, researchLink, missingLink, treeOverview focus · CHANGELOG.cs.md 3.27.0 · spec 057 K1.8–K1.12 · 3.28.0: app:bb6c0d07 src/ui/research-ui.ts researchSession (sledovaný, jinak prohlížený přes most), openLiveTaskMenu, researchStatusAfterWrite / statusAfterWriteWay (bez sledování hned askResearchBridge, jen počítač), src/ui/research-offline-ui.ts taskMenuOrders (queue.next; queue.own last, default), changeTaskOrder, writeTaskOrder · CHANGELOG.cs.md 3.28.0 (c04a7199) · spec 052 K5.1, K5.6; spec 057 §7 · prace/1113-app-jako-dalsi-bez-sledovani · app:3c751bea src/ui/research-ui.ts researchStatusAfterWrite (Čeká: sent, unsent, odpověď, soubor; linie; větev), researchViewedStatusAfterWrite, viewedWriteSession (jen prohlížený přes most, ne sledovaný, ne ze stromu) · research-waiting-write-ui.ts, research-directions-ui.ts, direction-form-ui.ts, research-offline-ui.ts, research-sync-ui.ts, verify-ui.ts, waiting-places-ui.ts · e2e/overview-write-unfollowed.spec.ts (do 3 s, okno bez dotazu na most) · strings.ts live.waitingWrite.sent, unsent, file · spec 083 · prace/1113-app-hledani-v-prehledu bod 2 · od 3.28.0 zavření a Ukončit sledování: app commit 3f2e19f8 (panel výzkumu skrytý pod Přehledem bez sledování, Ukončit sledování nechá Přehled otevřený, jiný pohled ho zavře) -->

<a id="S4.1.6"></a>
### S4.1.6 Przegląd badania w osobnym oknie

Na komputerze **Przegląd badania** można otworzyć w osobnym oknie, na przykład na drugim monitorze. Okno tylko
pokazuje: stan badania wysyła mu okno główne, a to, co zrobi się w oknie, wykonuje okno główne. Z mostem badania
okno nie rozmawia.

- **Gdzie to działa:** przy drzewie z badania, ze śledzeniem i bez niego ([S4.1.5](#S4.1.5)), na tych samych
  warunkach co widok w oknie ([A6.8](A6-views.md#A6.8)): komputer, okno szersze niż 640 px.
- **Układ:** podsumowanie na całą szerokość, pod nim sekcje w kolumnach według szerokości okna:
  - poniżej 1100 px jedna kolumna jak Przegląd w oknie głównym, od 1100 px dwie, od 1600 px trzy. Do mniejszej liczby
    kolumn okno wraca dopiero 24 px poniżej progu, żeby przeciąganie krawędzi nie migało;
  - kolumna ma najwyżej 660 px szerokości, kolumny stoją pośrodku i każda przewija się sama;
  - sekcje idą w kolejności Przeglądu (**Dostosuj panel**, [S4.1.2](#S4.1.2)) i dzielą się na kolumny po kolei tak,
    żeby najwyższa kolumna była jak najniższa. Trzy kolumny, z których jedna miałaby mniej niż jedną piątą wysokości,
    to dwie;
  - podział zmienia się przy zmianie liczby kolumn, przy zwinięciu, rozwinięciu, ukryciu lub przeniesieniu sekcji
    i po **Wczytaj więcej** w **Kolejce**; nowe dane z badania ani pisanie go nie zmieniają;
  - długa sekcja (z polem wyszukiwania albo z więcej niż 8 wierszami) ma w kolumnie przyklejoną głowę: nagłówek, pole
    wyszukiwania, chipy i liczba znalezionych zostają na górze, wiersze przewijają się pod nimi;
  - przy zmianie szerokości przez próg zostaje rozpoczęte wyszukiwanie, kursor i sekcja, która była na widoku;
  - ustawienia sekcji ([S4.1.2](#S4.1.2)) obowiązują także w oknie.
- **Nagłówek okna:** „{drzewo} · Przegląd badania”, pod nim nazwa badania, po prawej zależnie od stanu **Śledź na
  żywo** albo zakończenie śledzenia, i ⋯. Bez ⤡, × i **Śledzenie w**.
- **Akcje:** pokazanie osoby w drzewie, odpowiedź w **Czeka na załatwienie**, zarządzanie liniami, miejsce zadania
  w kolejce, wyszukiwanie w **Kolejce** ([S4.2.1](#S4.2.1)), **Śledź na żywo** i jego zakończenie, **Włącz**,
  a w sekcji **Weryfikacja** **Zatrzymaj** i **Zweryfikuj dane w drzewie…**
  ([S7.5](S7-reliability-and-verification.md#S7.5)) wykonuje okno główne. Wyszukiwanie i strony kolejki czyta okno
  główne ze swojego mostu i wynik wysyła oknu. Po akcji, której wynik widać w oknie głównym (na przykład pokazanie
  w drzewie albo okno dialogowe **Zweryfikuj dane w drzewie**, które otwiera się w oknie głównym), okno prosi
  o przeniesienie okna głównego na wierzch; po **Zatrzymaj** nie. Wyszukiwanie w **Czeka na załatwienie** i **Co wie badanie**
  ([S4.4.2](#S4.4.2), [S3.7.1](S3-what-the-research-knows.md#S3.7.1)) okno filtruje samo.
- **Wyróżnienie:** to, co drzewo w oknie głównym właśnie wyróżnia, okno pokazuje podświetleniem przycisku tej grupy:
  **Pokaż w drzewie** przy linii w **Teraz** i w **Linie**, liczba znalezionych osób linii i **Pokaż zmienione
  w drzewie** w **Przebiegu**. Po zakończeniu wyróżnienia lub zamknięciu okna głównego nic nie jest podświetlone. Gdy
  filtr **Przebiegu** ponownie wyróżni zmienione osoby, okno główne nie przechodzi na wierzch; filtr bez osób kończy
  wyróżnienie w oknie głównym.
- **Stany okna:**

| Stan | Co okno pokazuje |
|---|---|
| śledzone na żywo | to samo co Przegląd podczas śledzenia |
| nieśledzone, most odpowiada | to samo co Przegląd bez śledzenia ([S4.1.5](#S4.1.5)) z paskiem **Śledź na żywo** |
| badanie nie działa | „Badanie nie działa · widać to, co jest w drzewie” z **Włącz**; **Czeka na załatwienie** z pamięci ze „stan na …” |
| okno główne przełączyło się na drzewo bez badania | „To drzewo nie ma badania”, „Okno główne przełączyło się na drzewo {drzewo}, które nie ma badania.” i **Zamknij okno**; po powrocie do drzewa z badaniem okno wraca samo |
| okno główne jest zamknięte | pasek „Okno główne jest zamknięte · stan z {czas}, tylko do odczytu”, ostatni stan, akcje wyszarzone; **Otwórz Strom** ([A6.8.2](A6-views.md#A6.8.2)) |
| drzewo usunięte albo zablokowane | jak widok w oknie ([A6.8.2](A6-views.md#A6.8.2)) |

- **Granice:** dopóki okno Przeglądu jest otwarte, okno główne własnego Przeglądu nie rysuje; otwarty zamyka się
  po otwarciu okna. Mały panel badania zostaje. **⤢ Otwórz przegląd**, **Badanie → Przegląd badania** i pozycja
  w menu ⧉ wtedy tylko przenoszą okno Przeglądu na wierzch („Przegląd badania jest w osobnym oknie · kliknięcie
  przeniesie je na wierzch”). Po zamknięciu okna wszystko jest jak wcześniej.
- **Od aplikacji 3.30.0:** dopóki okno Przeglądu jest otwarte, mały panel w oknie głównym na komputerze (okno
  szersze niż 1024 px) pokazuje tylko nagłówek i **Trwa praca**. **Czeka na załatwienie**, **Ostatnie zmiany**
  i **W kolejce** są w oknie Przeglądu.
  - sekcja **Trwa praca** jest zawsze rozwinięta, także gdy w **Dostosuj panel** ([S4.1.2](#S4.1.2)) jest zwinięta
    albo ukryta; wybór się zachowuje i obowiązuje znowu po zamknięciu okna. Gdy agent nie pracuje, stoi tam „Teraz
    nie trwa żadna praca”;
  - etykiety **Czeka N** w nagłówku, etykiet czekających pozycji i nowych zmian w podsumowaniu zwiniętego panelu ani
    „Wszystkie sekcje są ukryte.” wtedy nie ma. Paski pod nagłówkiem (na przykład **Śledzenie w**) i liczba sesji pod
    panelem zostają;
  - panel sam się nie zwija; gdy **Trwa praca** się nie mieści, przewija się;
  - po zamknięciu okna Przeglądu panel jest cały, a sekcje są zwinięte i rozwinięte jak wcześniej. Przy zwężeniu
    okna do 1024 px i mniej panel jest cały, po poszerzeniu znowu tylko **Trwa praca**;
  - **⤢** w panelu przenosi okno Przeglądu na wierzch;
  - telefon, tablet, zakończone śledzenie i panel bez śledzenia są bez zmian.
- **Obsługa:** aplikacja: ⧉ w nagłówku Przeglądu (między ⋯ a ⤡); ⧉ **Otwórz w nowym oknie** obok przełącznika
  widoków → **Przegląd badania**.
- **Obowiązuje od:** aplikacja 3.28.0; 3.30.0: mały panel obok okna tylko z **Trwa praca**

<!-- zdroj: app:4b1373a7 src/windows/overview-window.ts (research-state bez adresy a tokenu mostu, OVERVIEW_ACTION_IDS, OVERVIEW_ACTIONS_TO_MAIN, 6g) · src/windows/overview-main.ts · src/ui/research-overview-ui.ts OVERVIEW_WINDOW_COLS_MIN 1100, WINDOW_LEFT (working, waiting, directions), overviewMode 'window', overviewWindowButton (jen canOpenWindows, ne sheet), canOpenResearchOverview · index.html html.window-overview (bez ⤡, ×, ⧉, Follow in) · src/windows/window-controls.ts renderMenu (overview: focusOverviewWindow / openInNewWindow) · strings.ts win.overviewHead, overviewOffNote, noResearch, noResearchNote, overviewInWindow, mainClosed · CHANGELOG.cs.md 3.28.0 · spec 079 P3 (K3), ZADANI_DEV §6 · prace/1113-app-okna-prehled (8a7575f0..4387a662) · app:3c2fde77 src/ui/overview-window-view.ts readQueuePage přes akci queue-list do hlavního okna (okno most nevolá) · app:3f9a5ca4 overview-window-view.ts treeVerifyNow (extras.verify), verifyStop → verify-stop, showVerifyBulkDialog → verify-bulk; evidenceHighlightNow (extras.highlight), endEvidenceHighlight → highlight-end, startPersonHighlight quiet · src/ui/research-ui.ts lightsGroup, markOverviewLit (is-lit, aria-current; nic při zavřeném hlavním okně) · research-overview-ui.ts lightsGroup direction (show-in-tree v Teď), changed (showChanged) · research-directions-ui.ts lightsGroup direction (dirShow), direction-found (dirFoundPersons) · strings.ts verify.section, bulkRow, stop, live.showInTree, dirShow, showChanged · spec 079 K3 · prace/1113-app-dorovnani-052-okna (2876d570..27f0bafb) · app:7f307c74 src/overview-columns.ts OVERVIEW_WINDOW_COLS_2 1100, OVERVIEW_WINDOW_COLS_3 1600, OVERVIEW_COLS_HYSTERESIS 24, OVERVIEW_SMALL_COLUMN 0.2, OVERVIEW_COLUMN_MAX 660, partitionContiguous, planOverviewColumns · src/ui/overview-columns-ui.ts (souhrn a pruhy nad sloupci, každý sloupec se posouvá sám, nové rozdělení jen při změně sloupců, sbalení, skrytí, přesunu, Načíst další; lepkavá hlava: pole nebo > 8 řádků; fokus, výběr v poli a oddíl na očích při změně šířky) · e2e/windows-overview-columns.spec.ts · CHANGELOG.cs.md 3.28.0 (e540e4b5) · spec 083 U3 · prace/1113-app-hledani-v-prehledu · 3.30.0: app:965e83f8 src/ui/live-panel-working-only.ts livePanelWorkingOnly (okno Přehledu, isDesktop > 1024 px, ne ukončené), livePanelDrawnSections (jen working), livePanelNothingAtWork · src/ui/research-ui.ts (třída working-only, bez štítků waiting a nových změn, bez samoskládání; overviewWindowOpenChanged, placeLivePanel při přechodu 1024 px; openResearchOverview → focusOverviewWindow) · strings.ts live.nothingAtWork · e2e/windows-overview-panel.spec.ts · CHANGELOG.cs.md 3.30.0 „Panel výzkumu vedle okna Přehledu“ · spec 079 U9 (rozhodnutí 27, 16. 11.) · dirigent:test/vysledek-1116-app-079-panel.md -->

<a id="S4.1.7"></a>
### S4.1.7 Śledzenie agenta w innych oknach

Podczas śledzenia badania ([S1.4](S1-connecting-app-and-research.md#S1.4)) agenta śledzi też każde inne okno drzewa
([A6.8](A6-views.md#A6.8)), każde we własnym widoku. Jedno okno można odłączyć i w międzyczasie oglądać w nim coś
innego; pozostałe okna śledzą dalej. Wszystkie okna są przy tym tylko do odczytu.

- **Kiedy:** gdy okno główne śledzi badanie na żywo. Dołącza każde inne okno, także otwarte przed włączeniem
  śledzenia (bez odświeżenia) albo dopiero w jego trakcie. Inne okno nie łączy się z mostem badania: stan agenta
  wysyła mu okno główne, bez adresu mostu.
- **Widok:** okno śledzi w widoku, który właśnie pokazuje. **Śledzenie agenta w** ([S4.1.3](#S4.1.3)) dotyczy tylko
  okna głównego, a **Powrót do agenta** nie przełącza widoku innego okna.
  - **Rodzina**, **Wachlarz**, **Mapa:** przeskok za agentem, znaczniki, ślad i legenda jak w oknie głównym
    ([S4.1.1](#S4.1.1), [S4.1.3](#S4.1.3));
  - **Tabela:** wiersz agenta ([A6.7.18](A6-views.md#A6.7.18));
  - **Potomkowie**, **Oś czasu:** bez przeskoków, mówi to pasek. Przesuwanie w nich nie wstrzymuje śledzenia. Po
    przełączeniu na Rodzinę, Wachlarz lub Mapę okno od razu przeskakuje do agenta.
- **Pasek pod nagłówkiem okna** mówi, jak okno śledzi (ikoną i tekstem). Ostatni jest zawsze **Przejdź do okna
  głównego**.

| Stan okna | Pasek | Przyciski |
|---|---|---|
| śledzi | „Śledzenie agenta · tylko do odczytu”; w Potomkach i na Osi czasu „Śledzenie agenta · w tym widoku bez przeskoków · tylko do odczytu” | **Odłącz to okno** |
| śledzi, agent nie pracuje nad nikim z tego drzewa | „Agent teraz nie pracuje · tylko do odczytu” | **Odłącz to okno** |
| wstrzymane | „Śledzenie wstrzymane · tylko do odczytu” | **Powrót do agenta**, **Odłącz to okno** |
| odłączone | „To okno nie śledzi agenta · tylko do odczytu” | **Śledź agenta** |
| połączenie z mostem przerwane | „Połączenie z badaniem przerwane · ponawianie” (bursztynowo) | **Odłącz to okno**, w odłączonym oknie **Śledź agenta** |

- **Wstrzymanie:** ręczne przesunięcie, powiększenie lub wybór osoby w oknie (w Tabeli przewinięcie lub kliknięcie
  w wiersze) wstrzymuje śledzenie tylko w tym oknie. Przywraca je **Powrót do agenta** albo wraca samo po 20 s bez
  dotyku. Wstrzymanie pokazuje pasek; pływającej etykiety wstrzymania ani „Przesuwanie mapy wstrzymane” inne okno nie
  ma. Wstrzymanie w oknie głównym nie wpływa na inne okna, a wstrzymanie w innym oknie nie wpływa na okno główne ani
  na pozostałe okna. Odświeżenie okna (F5) wstrzymanie anuluje.
- **Odłączenie:** **Odłącz to okno** zatrzymuje przeskoki za agentem w tym oknie; okno można swobodnie przeglądać
  i zostaje tylko do odczytu. Znaczniki agenta (karta osoby, nad którą trwa praca, wiersz agenta w Tabeli, znaczniki
  i ślad w Wachlarzu i na Mapie) w nim zostają. **Śledź agenta** ponownie dołącza okno i od razu przeskakuje do
  agenta. Odłączenie przetrwa odświeżenie okna (F5) i zostaje zapomniane wraz z końcem śledzenia.
- **Wybór z innego okna:** śledzące okno, które nie jest wstrzymane, osobę wybraną w innym oknie tylko zaznacza, także
  przy **Wybrana osoba** → **To okno**: **przełączaj** ([A6.8.1](A6-views.md#A6.8.1)); centrum zostaje przy agencie. Tabela
  zaznacza wiersz tej osoby, ale do niego nie przewija. Przeskok za agentem nie jest wysyłany innym oknom jako wybór
  osoby. Wstrzymane i odłączone okno kieruje się wyborem **To okno** jak poza śledzeniem. Wybór wysłany do okna głównego
  z **ustaw w centrum** okno główne śledzące agenta tylko zaznacza ([A6.8.4](A6-views.md#A6.8.4)).
- **Koniec:**
  - ◎ **Przestań śledzić** w oknie głównym zatrzymuje przeskoki tylko w oknie głównym; inne okna śledzą dalej;
  - **Zakończ śledzenie** (panel badania, menu **Badanie**, menu osoby) i koniec sesji kończą śledzenie we wszystkich
    oknach: pasek znika, drzewo znów można edytować, odłączenie zostaje zapomniane, a każde inne okno to zgłasza
    („Śledzenie badania zakończone · drzewo można edytować”).
- **Zamknięcie okna głównego podczas śledzenia:** jedno z innych okien samo staje się oknem głównym i śledzenie trwa
  w nim.
  - Zamknięcie rozpoznaje się po 3 s bez wiadomości od okna głównego ([A6.8.2](A6-views.md#A6.8.2)). Odświeżenie okna
    głównego (F5) niczego z tego nie uruchamia;
  - kolejność: najpierw okna, które śledzą agenta (śledzące i wstrzymane), potem odłączone; w każdej grupie od
    najstarszego okna. Okno Przeglądu badania ([S4.1.6](#S4.1.6)) głównym nie zostaje. Każde okno w kolejności czeka
    o 400 ms dłużej niż poprzednie i głównym zostaje tylko jedno;
  - to okno pokazuje „Okno główne zamknięte · śledzenie trwa w tym oknie…”, wczytuje się ponownie jako główne z tym
    samym widokiem i z ◎ włączonym, jeśli był włączony w zamkniętym oknie głównym. Pozostałe okna zgłaszają
    „Śledzenie przejęło inne okno” i zostają takie, jakie były (odłączone zostaje odłączone);
  - gdy ta przeglądarka nie ma zapisanego adresu mostu badania, żadne okno nie zostaje głównym, a okna pokazują „Nie
    można wznowić śledzenia · okno główne zamknięte” z **Ustaw jako główne** i **Otwórz Strom**
    ([A6.8.2](A6-views.md#A6.8.2));
  - bez śledzenia obowiązuje [A6.8.2](A6-views.md#A6.8.2) bez zmian.
- **Granice:** inne okna są tylko na komputerze ([A6.8](A6-views.md#A6.8)); telefon i tablet są bez zmian. Okno
  główne nie pokazuje, ile okien śledzi.
- **Obsługa:** aplikacja: na pasku innego okna **Odłącz to okno**, **Śledź agenta**, **Powrót do agenta**,
  **Przejdź do okna głównego**; w oknie głównym ◎ **Przestań śledzić** i **Zakończ śledzenie**.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:9cec9c30 (od 3714c539) src/windows/agent-follow-state.ts AgentFollow attached/paused/detached, agentFollowKey (sessionStorage jen detached), setLive (konec sezení zapomene odpojení), detach, attach, setPaused · src/windows/agent-state.ts, agent-mirror.ts, src/ui/agent-window-ui.ts (stav agenta z hlavního okna bez adresy a tokenu mostu, K1.3) · src/windows/sat-states.ts SatStrip, liveStrip (lost › paused › detached › idle › attachedNoJump › attached), STRIP_ICON, AMBER, writeStrip (tlačítka, goToMain poslední) · src/main.ts noJump (descendants, timeline) · src/ui/live-follow-ui.ts (další okno: pohled okna, Zpět pohled nepřepne, bez štítku pauzy ani mapPaused, pauza jen v okně, návrat po 20 s) · src/windows/window-selection.ts (připojené okno výběr jen vyznačí; skok agenta se nerozesílá) · src/windows/takeover.ts TAKEOVER_STEP_MS 400, takeoverOrder (sledující, pak odpojená; okno bez vlastního sledování ne), hasBridge (storedResearchBridge) · src/windows/become-main.ts, window-start.ts (◎ jako v zavřeném hlavním okně) · strings.ts win.agentAttached, agentAttachedNoJump, agentIdle, agentPaused, agentDetached, detach, attach, bridgeLost, followEnded, takingOver, takenOver, takeoverFailed, goToMain; live.followOff, followBack; research.stop · CHANGELOG.cs.md 3.30.0 „Sledování agenta ve všech oknech“ · spec 097 K1.1–K1.4, K2.1–K2.6, Rozhodnutí 16. 11. O1–O5, dotazy 3–5, 8 · app:docs/ZADANI_DEV_sledovani-ve-vsech-oknech.md §1–§4, §6, §7; ZADANI_UIX dotazy 10, 12 · prace/1116-app-097-sledovani-okna -->

<a id="S4.1.8"></a>
### S4.1.8 Teraz z kilkoma przebiegami

Przy badaniu, które potrafi przebiegi linii ([R7.10](R7-when-the-agent-works.md#R7.10)), sekcja **Teraz**
w **Przeglądzie badania** pokazuje jeden blok dla każdego przebiegu: przebieg całej kolejki i przebieg każdej linii
osobno. Każdy przebieg można śledzić i zatrzymać osobno.

- **Blok przebiegu:**
  - nagłówek: znak linii, jej nazwa i numer (G…), przy przebiegu całej kolejki **Cała kolejka**; po prawej stan:
    **pracuje**, **uruchamia się…**, **czeka na limit subskrypcji do 14:00**, **czeka na archiwum do 14:40**, **czeka
    na przeglądarkę archiwum** („Przeglądarkę archiwum ma teraz inny przebieg; ten poczeka, aż się zwolni.”),
    **czeka na pobieranie**, **czeka do …**, **kończy – agent dopisuje znalezione**, **zakończył o 11:52**;
  - pod nagłówkiem agent, od kiedy i jak długo, i ostatni krok (osoba – zadanie) jak dotąd ([S4.1](#S4.1));
  - przebieg całej kolejki, obok którego linie mają własne przebiegi: „Pomija: Przodkowie Jana Horáka, Potomkowie
    Marie Vlkovej”. Gdy właśnie kończy zadanie linii, która w międzyczasie dostała własny przebieg: „Dokończy T0103
    linii …, potem ją pominie.”;
  - zakończony przebieg zostaje w **Teraz** 60 s ze stanem **zakończył o …**. Pod nim, tylko przy końcu przez limit,
    **Wyczerpał się limit subskrypcji.**, a przy błędzie **Agent zakończył się błędem; szczegóły są w terminalu
    badania.**; przy przebiegu linii także **Linię znowu bierze cała kolejka.** Potem blok znika. Nowe otwarcie
    aplikacji zakończonych bloków nie pokazuje.
- **Kolejność bloków:** najpierw przebieg całej kolejki, potem przebiegi linii w kolejności linii
  ([R2.1.4](R2-lines-and-queue.md#R2.1.4)). Nagłówek sekcji to „Teraz · agenci: 3”; podsumowanie **Stan** przy dwóch
  i więcej przebiegach „Pracuje agentów: 3” i ewentualnie „1 czeka na limit do 14:00”. Od aplikacji 3.32.0 liczy się
  także przebieg, który czeka na archiwum, przeglądarkę archiwum albo pobieranie: wtedy tylko „1 czeka” (bez
  godziny).
- **Akcje bloku:**
  - **Pokaż w drzewie**: osoby linii, przy przebiegu całej kolejki osoba, nad którą pracuje agent;
  - **Śledź ten przebieg** / **● Śledzony**: tylko przy dwóch i więcej przebiegach i włączonym śledzeniu;
  - **Zatrzymaj** („Dokończy rozpoczęte zadanie i nie zacznie kolejnego”): od razu przez most, bez terminala, przy
    pracującym albo czekającym przebiegu; podczas zapisu **Zatrzymywanie…**, przy odmowie **Nie udało się zatrzymać
    agenta.** Znaczenie jest takie jak `strom run stop` ([R7.10.2](R7-when-the-agent-works.md#R7.10.2));
  - **Dokończ i zakończ**: otwiera terminal badania i prosi ten przebieg, by dokończył i się zakończył
    ([R7.3](R7-when-the-agent-works.md#R7.3)); przy pracującym przebiegu i przy przebiegu czekającym na przeglądarkę
    archiwum albo pobieranie. Przebieg czekający na limit albo archiwum go nie ma;
  - kończący się przebieg ma tylko **Pokaż w drzewie**. Zatrzymanie jednego przebiegu nie zmienia pozostałych;
    zatrzymać wszystkich naraz się nie da.
- **Śledzenie:** śledzi się jeden przebieg. Domyślny jest pierwszy niewstrzymany przebieg w kolejności **Teraz**;
  nowy przebieg śledzenia nie przełącza. Gdy śledzony przebieg się zakończy, śledzi się znowu domyślny.
  - w drzewie przy dwóch i więcej przebiegach jest pigułka **Śledzony: Przodkowie Jana Horáka ▾** z menu **Śledź
    przebieg** (numer i nazwa bloku, pod nimi agent i osoba; czekający przebieg szary ze swoim stanem; na końcu
    **Przestań śledzić**);
  - osoby wszystkich przebiegów są oznaczone jak dotąd ([S4.1.1](#S4.1.1)); śledzony przebieg ma pierwszy kolor
    śledzenia, pozostałe drugi. Zamiast numeru sesji niosą oznaczenie przebiegu: znak linii i numer bloku w **Teraz**
    („↑ 2”), przebieg całej kolejki tylko numer;
  - inne okna drzewa ([S4.1.7](#S4.1.7)) śledzą ten sam przebieg co okno główne.
- **Telefon:** bloki i stany są takie same, bez **Zatrzymaj**, **Dokończ i zakończ** i wyboru śledzonego przebiegu;
  pigułka mówi tylko, który przebieg jest śledzony, i oznaczone są tylko osoby śledzonego przebiegu.
- **Granice:** przy starszym badaniu albo przy jedynym przebiegu całej kolejki **Teraz** jest jak dotąd.
- **Obsługa:** aplikacja: **Przegląd badania → Teraz**; pigułka **Śledzony:** w drzewie. Terminal:
  `strom run stop <run-…> [--finish]`.
- **Obowiązuje od:** aplikacja 3.31.0 (badanie 1.36.0)

<!-- zdroj: 3.32.0: app:f09e9722 src/research-runs-text.ts runsWaitingText (stateAgentsWaitingAny, když některý běh nečeká na limit) · app:4de0835a src/research-runs.ts (run.lines, RUN_ENDED_MS 60 s, orderRuns obecný první a linie v pořadí, runCount, noteEndedRuns jen v paměti) · src/ui/research-overview-ui.ts vykreslení bloku (runStateWorking/Starting/Limit/Archive/Waiting/WaitingUntil/Browser/Download/Finishing/Ended, runBrowserNote, runSkips, runFinishesThen, runEndedText jen limit|error, runAfterStop), overviewRunActions (Ukázat ve stromu; Sledovat tento běh jen ≥ 2 běhy a sledování, ne telefon; Zastavit s run.stop u working|waiting, ne telefon; Dokončit a skončit finish?run= u working a čekání na prohlížeč nebo stahování) · src/ui/live-follow-ui.ts pilulka followRunPill, followRunMenu, followOff · strings.ts live.nowAgents, stateAgents, stateAgentsWaiting, runWhole, run*, followRun* · app:docs/ZADANI_DEV_beh-po-liniich.md §3, §4, §7, Kolo 2 C2 · dirigent:spec/126 K2.1, K2.2, K2.5, prace/1121-app-126-linie, 1122-app-126-kolo2 · research: /status runs[], runsEnded[] (POST runs/stop) -->

<a id="S4.2"></a>
## S4.2 Kolejka w aplikacji

Aplikacja pokazuje początek kolejki badania w kolejności, w jakiej bierze ją agent
([R2.2](R2-lines-and-queue.md#R2.2)). Cała kolejka zostaje w badaniu.

- **Granice:**
  - Panel pokazuje 3 zadania (**W kolejce**), przegląd 20 (**Kolejka**). Resztę pokazuje wiersz **i N kolejnych
    w badaniu**, który otwiera badanie.
  - Przy dwóch i więcej działających liniach zadania można filtrować według linii (**Kolejka według linii**).
  - Zadanie poza liniami ma uwagę: **Czeka do zakończenia pracy linii · nie pomaga żadnej linii**, **Niepodejmowane
    · praca poza liniami jest wyłączona** albo dlaczego pomaga linii (**Pomaga linii: pytanie linii**, **Pomaga
    linii: łączy ludzi z drzewem**, **Pomaga linii, według agenta**). Zasady są w
    [R2.3](R2-lines-and-queue.md#R2.3).
  - Menu zadania **Opcje zadania**: **Odłóż** i **Porzuć**; przy odłożonym zadaniu **Przywróć**. Każda z nich otwiera
    terminal badania i tam się potwierdza ([S4.5](#S4.5)).
- **Obsługa:** aplikacja: panel, sekcja **W kolejce**; **Przegląd badania**, sekcja **Kolejka**; przy zadaniu **⋯**.
- **Obowiązuje od:** aplikacja 3.5.0. Uwagi przy zadaniach poza liniami od 3.21.0 (badanie 1.25.0).
- **Od aplikacji 3.22.0:** z badaniem 1.26.0 każde zadanie ma wiersz, dlaczego stoi tam, gdzie stoi
  ([R2.4](R2-lines-and-queue.md#R2.4)).
  **Zrób jako następne** i **Na koniec** (oraz **Przywróć domyślne**) zmieniają miejsce zadania bezpośrednio
  z aplikacji, bez terminala ([R2.3.1](R2-lines-and-queue.md#R2.3.1)); przy zadaniu, nad którym pracuje agent, nie
  da się tego zrobić. Kolejkę czyta się stronami: **Wczytaj więcej** dodaje 50 zadań, lista trzyma najwyżej 300,
  resztę zawęża filtr linii lub gałęzi.
  Etykieta gałęzi (**Gałąź … K**) zawęża całą kolejkę do zadań gałęzi; **Pokaż całą kolejkę** ją usuwa.
- **Od aplikacji 3.27.0:** z badaniem 1.31.0 kolejka w aplikacji jest w tej samej kolejności, w jakiej zadania bierze
  `strom run` i jak pokazuje je menu badania przed nim ([R2.2](R2-lines-and-queue.md#R2.2)): przy kolei opowieści na
  górze jest jedna opowieść, a w kolejce są też zadania historii. Zadanie ma za tekstem cichą etykietę **opowieść**
  albo **historia** (w **W kolejce**, w **Kolejce**, przy odłożonych zadaniach i w zadaniach gałęzi); zadanie bez niej
  wygląda jak wcześniej. Bez śledzenia kolejkę pokazuje Przegląd ([S4.1.5](#S4.1.5)) i Tabela, gdy most odpowiada.
- **Od aplikacji 3.28.0:** z badaniem 1.32.0 w **Kolejce** można szukać ([S4.2.1](#S4.2.1)), dać zadanie jako
  następne i cofnąć to ([S4.2.2](#S4.2.2)) oraz poprosić o pracę agenta nad kolejką ([S4.2.3](#S4.2.3)). Rozwinięta
  **Kolejka** ma wtedy liczbę zadań w nagłówku („Kolejka · 1240”) zamiast po prawej. Ze starszym badaniem Kolejka
  jest jak wcześniej.
- **Od aplikacji 3.31.0 z badaniem 1.36.0:** zadanie w kolejce, które trzyma inna sesja, ma uwagę „Zadanie trzyma
  Claude Code (sesja N0040) od 14:05, ostatnio 14:31; zwolni się najpóźniej o 15:01.” Zadanie, z którego archiwum
  z ograniczeniami korzysta teraz inna sesja, ma „Z archiwum … korzysta teraz inne badanie (od 14:05, ostatnio
  14:31); zwolni się najpóźniej o 15:01.”; zamiast „inne badanie” może stać „sesja N0040”, „inna sesja” albo
  „zbiorcze pobieranie”. Gdy na archiwum dłużej czeka inna praca: „Na archiwum … dłużej czeka inna praca; kolej
  najpóźniej o 15:01.” Uruchomienie zadania, które trzyma inna sesja, badanie odrzuca
  ([R7.9](R7-when-the-agent-works.md#R7.9), [R9.13](R9-archives.md#R9.13)). Ze starszym badaniem bez uwag.
- **Od aplikacji 3.31.0 z badaniem 1.36.0:** zadania linii z własnym przebiegiem
  ([R7.10](R7-when-the-agent-works.md#R7.10)) i zadania, które jej pomagają, nie stoją bez filtra w numerowanych
  wierszach. Na ich miejscu nad wierszami stoi jeden wiersz na linię: znak, nazwa linii, liczba zadań, „robi je własny
  agent linii (Claude)” i **Pokaż ›** (filtr linii). Liczba w **Kolejce** i w etykiecie **Wszystkie linie** oraz
  numery porządkowe obejmują tylko zadania dla przebiegu całej kolejki. W filtrze takiej linii jej zadania są
  ponumerowane w jej kolejności, a nad nimi stoi „Nad tą linią pracuje własny agent (Claude, od 10:42). Cała kolejka
  ją pomija.” Praca poza liniami, gałęzie i historia miejsc zostają przy przebiegu całej kolejki. Na telefonie
  **Kolejka** jest taka sama.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:308 queueNoteText, :3373 appendQueueSection · research-overview-ui.ts:311 (20) · strings.ts research.queue, research.park/drop/wake, research.queueMore, research.queueOffLast, research.queueOffNever, research.queueHelps · HEAD src/research-queue-pages.ts:19 QUEUE_PAGE, :28 QUEUE_ROWS_CAP · src/ui/research-ui.ts:3884 taskDoNext/taskDoLast · strings.ts live.taskDoing, live.queueLoadMore, live.queueCapNote, live.branchQueueChip, live.branchQueueChipClear · 3.27.0: app 2ee3718d (queue[].kind ze /status i ze stránek fronty, jiná hodnota zahozena) strings.ts live.queueKind · research 5f48cdaf src/core/queue.ts RUN_TURNS, runOrder (most /status queue[], GET /queue, menu před strom run), kind story|history · 3.28.0: app 4ad34832 src/ui/research-ui.ts appendQueueSection (counted: queueTitleCount místo summary, když je pole nebo akce záhlaví) · spec 052 · 3.31.0 spec 127: app:f89b5166 src/research-holds.ts heldByText, archiveHeldText, queueHoldText (linie vynechána), src/ui/research-ui.ts queueHoldNote · strings.ts live.heldByTask, archiveHeld, archiveHolderOther, archiveHolderFetch, archiveHolderOwn, archiveHolderSession, archiveHeldWaiting · app:docs/ZADANI_VYZKUM_rezervace.md Odpověď aplikace -->

<a id="S4.2.1"></a>
### S4.2.1 Wyszukiwanie w kolejce

W **Kolejce** w **Przeglądzie badania** (także w jego osobnym oknie, [S4.1.6](#S4.1.6)) jest pole **Szukaj zadania, osoby, archiwum…**. Szuka badanie w całej
kolejce, także poza wczytanymi stronami; aplikacja wysyła mu tylko szukany tekst ([R2.2](R2-lines-and-queue.md#R2.2)).

- **Kiedy pole jest:** w rozwiniętej **Kolejce**, z badaniem, którego most umie szukać i odpowiada, i tylko gdy
  w kolejce jest co najmniej jedno zadanie (także odłożone). Ze starszym badaniem pola nie ma, a Kolejka jest jak
  wcześniej.
- **Co się znajduje:**
  - numer zadania (`T0815`, `t815`, `815`): to zadanie jako pierwsze, potem zadania, w których tekście jest ten numer;
  - numer osoby (`P12`): zadania dotyczące tej osoby;
  - inny tekst: zadania, które mają każde słowo w tekście zadania, w imionach i nazwiskach jego osób, w księdze,
    sygnaturze, archiwum lub miejscu albo w numerze zadania lub osoby; bez względu na wielkość liter i znaki
    diakrytyczne. Wyniki są w kolejności kolejki.
- **Granice:**
  - szuka się 300 ms po ostatnim wpisanym znaku, wysyła się najwyżej 100 znaków; puste pole przywraca kolejkę;
  - etykiety linii i gałęzi ([S4.2](#S4.2)) łączą się z wyszukiwaniem: wynikiem są zadania etykiety, które pasują do
    tekstu. Liczby w etykietach pozostają liczbami kolejki;
  - wiersz wyniku to wiersz kolejki (miejsce w kolejce, tekst, **⋯**) z szarym numerem zadania. Wyróżnione jest tylko
    dopasowanie numeru zadania lub osoby („P0108 Jan Horák”), dopasowanie tekstu nie. Odłożone zadania są na końcu
    z miejscem „–” i etykietą **odłożone**;
  - nad wynikami stoi ich liczba („Znaleziono 12 zadań”). Bez wyniku **Nic nie znaleziono.** i **Wyczyść
    wyszukiwanie**, z etykietą linii także **Szukaj we wszystkich liniach**;
  - numer zadania, którego już nie ma w kolejce: „T0815 nie ma już w kolejce (gotowe).”, stan **gotowe**, **czeka na
    decyzję**, **odłożone** albo **porzucone**;
  - więcej niż 50 wyników: **Wczytaj więcej** po 50, najwyżej 300 wierszy jak w kolejce;
  - most nie odpowiada albo jest zajęty: **Wyszukiwanie nie powiodło się, badanie nie odpowiada.** albo **Badanie jest
    zajęte, wyszukiwanie jest teraz niedostępne.** i **Spróbuj ponownie**; tekst w polu zostaje;
  - gdy kolejka zmieni się w trakcie wyszukiwania, wynik odświeża się sam; tekst i kursor w polu zostają;
  - wyszukiwanie obowiązuje, dopóki się go nie wyczyści (×, Escape w polu, **Wyczyść wyszukiwanie**) albo dopóki nie
    zamknie się Przeglądu. Szukany tekst nie jest nigdzie zapisywany.
- **Obsługa:** aplikacja: **Przegląd badania → Kolejka**, pole wyszukiwania; w małym panelu pod **W kolejce** link
  **Szukaj w kolejce…**: otwiera Przegląd, rozwija **Kolejkę** tylko do jego zamknięcia (zapisany wybór sekcji się nie
  zmienia) i ustawia kursor w polu. Na telefonie, gdzie panel staje się paskiem, linku nie ma.
- **Obowiązuje od:** aplikacja 3.28.0 (badanie 1.32.0)

<!-- zdroj: app:4ad34832 (8a10387e) src/ui/queue-search-ui.ts QUEUE_SEARCH_PAUSE_MS 300, queueSearchOffered (queue.search, queuePaged, queue/queueMore/queueCounts next+parked), resetQueueSearch (zavření Přehledu), Escape · src/research-queue-pages.ts QUEUE_QUERY_MAX 100, QUEUE_PAGE 50, QUEUE_ROWS_CAP 300, QUEUE_ELSEWHERE_STATES · src/ui/research-ui.ts appendQueueSection (searchable jen v Přehledu, ne při sbalení), appendQueueSearchResult (štítek + q, queueSearchBusy/Err, dirRetry), řádek výsledku (live-queue-num „–“, research-queue__match id/person, queueTagDeferred), live-queue-search-link (canExpandLivePanel) · src/ui/research-overview-ui.ts openQueueSearch (unfoldOverviewSection queue do zavření) · strings.ts live.queueSearch*, queueState, queueTagDeferred, queueTitleCount, dirRetry · research 1.32.0 src/core/live.ts searchQueue (TASK_NUMBER, PERSON_NUMBER, každé slovo v jednom poli, pořadí fronty, elsewhere) · spec 052 K1.1–K1.7 · ZADANI_DEV_fronta-hledani §1, §2; D1 (bez řádku pole) · app:08268b9f strings.ts live.queueSearchInDir, queueSearchNoneDir, queueSearchAllDirs (linie) · app:3c2fde77 okno Přehledu (queue-list) · spec 052 K1.1 -->

<a id="S4.2.2"></a>
### S4.2.2 Zrób jako następne i Cofnij

Zadanie można z aplikacji wysłać na kolej jako następne, bez terminala. Rozpoczętej pracy agent nie przerywa: zadanie
przychodzi na kolej po niej ([R2.3.1](R2-lines-and-queue.md#R2.3.1)).

- **Granice:**
  - **Zrób jako następne** („Przyjdzie kolej po zadaniu w toku”) to pierwsza pozycja w **⋯** przy zadaniu w **Kolejce**,
    w wynikach wyszukiwania ([S4.2.1](#S4.2.1)) i w **W kolejce** małego panelu, bez oznaczenia. Stoi w miejscu
    dotychczasowego **Zrób jako następne** (wybór **od razu**); **Na koniec** i **Przywróć domyślne** zostają przy
    badaniu, które je oferuje ([S4.2](#S4.2));
  - nie jest oferowane przy zadaniu, które już jest pierwsze, nad którym pracuje agent albo które jest odłożone;
  - działa ze śledzeniem i bez niego: w **Przeglądzie badania** otwartym bez śledzenia ([S4.1.5](#S4.1.5)), gdy most
    badania odpowiada; śledzenie się nie zaczyna, a drzewo pozostaje edytowalne. Po zmianie kolejka od razu
    wczytuje się z badania;
  - zadanie przesuwa się na pierwsze miejsce, jego wiersz krótko się wyróżni i przy tekście ma etykietę **jako
    następne**, dopóki nie przyjdzie jego kolej. Z kilku zadań jako następne pierwsze jest ostatnio oznaczone; etykietę
    mają wszystkie. Wyszukiwanie zostaje;
  - powiadomienie z numerem zadania („T0103 jako następne”) i **Cofnij** stoi 6 s. **Cofnij** stawia zadanie
    dokładnie na pierwotne miejsce, także z jego pierwotnym wyborem; wiersz jest na tym miejscu zaraz po odpowiedzi
    badania, także w osobnym oknie przeglądu ([S4.1.6](#S4.1.6));
  - gdy agent tymczasem wziął zadanie: **Agent właśnie pracuje nad tym zadaniem; jego miejsca nie można teraz
    zmienić.** i kolejka się odświeża. Gdy most nie odpowiada: **Badanie nie odpowiada, kolejność się nie zmieniła.**
    i **Spróbuj ponownie**;
  - nic się nie potwierdza: nic się nie uruchamia ani nie płaci;
  - na telefonie menu jest panelem wysuwanym od dołu jak inne panele aplikacji (uchwyt, przyciemnione okno pod nim)
    z numerem i tekstem zadania na górze; stuknięcie w przyciemnione okno lub Escape go zamyka.
- **Obsługa:** aplikacja: przy zadaniu **⋯ → Zrób jako następne**, w powiadomieniu **Cofnij**. Terminal: `strom task
  order T… --next`, `--restore` ([R2.3.1](R2-lines-and-queue.md#R2.3.1)).
- **Obowiązuje od:** aplikacja 3.28.0 (badanie 1.32.0)

<!-- zdroj: app:623d9c77 (8a10387e) src/ui/research-offline-ui.ts queueNextOffered (queue.next, most odpovídá), queueNextFor (state next, ne pozice 1, ne práce agenta), doTaskNext (toast queueMoved 6000 ms, queueUndo → restoreTaskPlace {do: restore, was}), taskOrderRefusedToast (taken → taskDoing, bridge → queueBridgeErr + dirRetry), QUEUE_FLASH_MS 1600 · src/ui/research-ui.ts openLiveTaskMenu (nextOn: queueNext místo taskDoNext; taskOrderOffered: last, default; list na telefonu ≤ 640 px s titulem), markQueueNextRow (queueTagNext) · strings.ts live.queueNext, queueNextHint, queueTagNext, queueMoved, queueUndo, queueBridgeErr, taskDoing · research 1.32.0 rankTasks (naposledy zvolený první) · spec 052 K5.1, K5.3, K5.4, K5.6 · ZADANI_DEV_fronta-hledani §4 · app:2876d570 placeQueueItemInLists (odpověď restore: pos, own, why), strings.ts live.queueMoved(id) · app:7dc924ee list ⋯ = bottom-sheet (úchyt, ztmavení, Escape) · app:3f9a5ca4 Vrátit v okně Přehledu · spec 052 K5.4 · app:bb6c0d07 bez sledování přes most (researchSession, taskMenuOrders, researchStatusAfterWrite) · spec 057 §7 -->

<a id="S4.2.3"></a>
### S4.2.3 Praca nad kolejką…

Z aplikacji można poprosić o samodzielną pracę agenta nad kolejką. Aplikacja niczego nie uruchamia: otwiera terminal
badania, ten pokazuje, co się uruchomi, i uruchamia to dopiero po **tak** ([R7.1.2](R7-when-the-agent-works.md#R7.1.2)).
Praca agenta zużywa subskrypcję AI.

- **Kiedy jest oferowana:** z mostem, który odpowiada, przy badaniu, które zgłosiło link do pracy, z agentem (nie
  w Archiwum Strom ani w badaniu, które czeka na agenta), tylko tam, gdzie aplikacja otwiera linki badania
  ([S4.5](#S4.5)); nie na telefonie. Gdy agent pracuje albo trwa przebieg, działania nie ma; w nagłówku **Kolejki**
  jest zamiast niego **● Trwa praca ›**, które rozwija **Teraz** i przechodzi do **Dokończ i zakończ**.
- **W sekcji Teraz:** gdy agent nie pracuje i nie trwa żaden przebieg, **Praca nad kolejką…** z tym samym
  oznaczeniem, oknem i warunkami oferuje też sekcja **Teraz** w **Przeglądzie badania**, także w jego osobnym
  oknie. Gdy agent pracuje, w **Teraz** zostaje tylko **Dokończ i zakończ**. Zamknięcie okna przywraca fokus na
  przycisk w **Teraz**.
- **Okno Praca nad kolejką:**
  - **Automatycznie** (domyślnie): „Agent bierze zadanie za zadaniem, dopóki pozwala limit subskrypcji.” Gdy badanie
    zgłasza, że bramka subskrypcji (warunek, [R7.4](R7-when-the-agent-works.md#R7.4)) nie jest ustawiona, stoi pod tym
    **Praca automatyczna wymaga ustawionej bramki subskrypcji; terminal zaproponuje ustawienie.** Wybór zostaje;
  - **Tylko 5 zadań**: liczba 1–100, domyślnie 5. Praca kończy się po tylu załatwionych zadaniach; liczy się też
    zadanie, które kończy się czekaniem, odłożeniem lub porzuceniem. Tylko z badaniem, które to umie; w przeciwnym
    razie jest tylko **Automatycznie**;
  - **Jako pierwsze**: zadanie oznaczone jako następne ([S4.2.2](#S4.2.2)), w przeciwnym razie pierwsze zadanie
    kolejki;
  - **Kolejne (n)** pod zadaniem **Jako pierwsze** rozwija kolejne zadania kolejki w kolejności badania: najpierw
    zadanie oznaczone jako następne, potem według miejsca w kolejce; zadań odłożonych i zadań poza liniami, które
    nie są podejmowane, w nim nie ma. Nad nimi stoi **W kolejności w kolejce** i „Agent nie musi brać ich dokładnie
    w tej kolejności.” Wiersz to numer i tekst zadania z etykietą **jako następne** i rodzajem zadania; z miejscami
    w kolejce wiersze są numerowane „2.”, „3.”. Pod nimi „i jeszcze N zadań w kolejce” z **Przegląd badania ›**
    (rozwija **Kolejkę**) albo „Kolejka może mieć więcej zadań.” Rozwiniętą listę zwija **Ukryj kolejne**. Liczba
    w **Tylko 5 zadań** nie zmienia listy; każde otwarcie okna zaczyna się zwinięte, a bez kolejnych zadań przycisku
    nie ma;
  - gdy badanie to zgłasza, długość sesji i bramka („Sesja najwyżej 3 godz. · bramka subskrypcji: …”);
  - **Anuluj** i **Otwórz terminal** (oznaczenie AI i terminal) ze zdaniem **Uruchomienie potwierdza terminal badania.
    Pracę zatrzymuje Ctrl-C w jego oknie lub „Dokończ i zakończ” w sekcji Teraz.**
- **Obsługa:** aplikacja: **Praca nad kolejką…** po prawej w nagłówku rozwiniętej **Kolejki** w **Przeglądzie
  badania**; menu **Badanie → Praca nad kolejką…** ([S4.5.2](#S4.5.2)). Terminal: `strom run --tasks N`,
  `strom run --loop` ([R7.1](R7-when-the-agent-works.md#R7.1)).
- **Obowiązuje od:** aplikacja 3.28.0 (badanie 1.32.0); w sekcji **Teraz** i **Kolejne (n)** od aplikacji 3.29.0
- **Od aplikacji 3.30.0:** po **Otwórz terminal** w **Teraz** stoi **Uruchamianie pracy nad kolejką…** z „Agent
  uruchomi się w terminalu badania.”, a oba przyciski **Praca nad kolejką…** mówią, że praca się uruchamia, i niczego
  nie otwierają ponownie. Wiersz znika, gdy tylko badanie potwierdzi link ([S4.5.4](#S4.5.4)) albo zacznie się sesja
  lub przebieg; wtedy zastępuje go wiersz sesji. Bez potwierdzenia w ciągu 30 s **Teraz** pyta **Praca nad kolejką
  się nie rozpoczęła?** („Terminal nie odezwał się w ciągu 30 s.”) ze **Spróbować ponownie** i radą, a przyciski są
  znów wolne.
- **Od aplikacji 3.31.0 z badaniem 1.36.0:** gdy linie mają własne przebiegi
  ([R7.10](R7-when-the-agent-works.md#R7.10)):
  - **Praca nad kolejką…** jest zajęta (**● Trwa praca ›**) tylko podczas przebiegu całej kolejki, nie podczas
    przebiegów linii;
  - przy pełnej liczbie przebiegów ([S4.4.12](#S4.4.12)) przycisk jest niedostępny z „Pracują 3 agenci, ustawienia nie
    pozwalają na więcej.” i **Ustawienia ›**; w menu **Badanie** pozycja jest szara z tym samym wyjaśnieniem;
  - okno pokazuje kolejkę bez zadań linii z własnym przebiegiem, a pod zadaniem z **Jako pierwsze** „Pominie linię
    Przodkowie Jana Horáka (pracuje nad nią własny agent).”; gdy jakiś przebieg już pracuje, także „Pracuje już
    1 agent. Zużycie subskrypcji się sumuje.”

<!-- zdroj: app:9cf43b22, 34accb13 (8a10387e) src/ui/queue-work-dialog.ts queueWorkOffer (live, ne phone/sheet, ne noAgent, linkAvailable work, work.link; busy sessions|runs → 'busy'), queueWorkHead (queue-work-busy → showOverviewNowFinish), queueWorkCounted (run.tasks), queueWorkFirst (own next, pos 1), queueWorkSessionLine, WORK_TASKS_DEFAULT 5, noGate (work.gate === null) · src/research-link.ts WORK_TASKS_MIN/MAX, WORK_LINK_FEATURE, RUN_TASKS_FEATURE · src/ui/research-ui.ts queueHeadAction (jen rozbalená Fronta) · src/ui/research-overview-ui.ts showOverviewNowFinish · strings.ts live.queueWork*, queueWorkingLink · spec 052 K6.1, K6.2, K6.4, K6.6 · ZADANI_DEV_fronta-hledani §5; D6 (řádek sezení i bez brány) · 3.29.0: app:a0a66d45 Teď nabízí Pracovat na frontě… (bez práce agenta a běhu; okno přehledu; fokus zpět) · 3c8f4128 src/ui/queue-work-dialog.ts Další (n) (pořadí: ruční další, místo ve frontě; bez odložených a mimo linie, které se neberou; queue.page; zbytek, Přehled výzkumu ›; sbalené při otevření) · strings.ts live.queueWorkMore, queueWorkLess, queueWorkByQueue, queueWorkByQueueHint, queueWorkRest, queueWorkRestUnknown, queueWorkOverview, queueTagNext · 3.30.0: app:574e7ef9 src/ui/queue-start.ts (QUEUE_START_MS 30 s, důkaz handoff nebo sezení/běh, silent → queueNotStarted, proven bez sezení zmizí potichu) · src/ui/research-overview-ui.ts (live-now-starting, terminalSilent) · strings.ts busy.queueStarting, queueStartingSub, queueNotStarted, terminalSilent -->

<a id="S4.2.4"></a>
### S4.2.4 Kolejka według rodzaju zadania

Przy badaniu, które przy zadaniach podaje rodzaj pracy, **Kolejka** w Przeglądzie badania ma pod chipami linii rząd
**Rodzaj zadania**: chip dla każdego rodzaju, który ma zadanie w kolejce, z liczbą („Weryfikacja 12”). Rodzaj ustala
badanie ([R2.2](R2-lines-and-queue.md#R2.2)).

- **Rodzaje** w tej kolejności: **Weryfikacja**, **Metryki**, **Spis ludności**, **Materiał**, **Miejsca**, **Źródła
  poza metrykami**, **Zapytania**, **Opowieści**, **Historia**, **Inne**.
- **Granice:**
  - wybrany chip zawęża kolejkę do zadań tego rodzaju i pokazuje ×; drugie kliknięcie wybór anuluje („Pokaż wszystkie
    rodzaje zadań”). Wybrany rodzaj zostaje w rzędzie także z zerem, gdy zniknie jego ostatnie zadanie;
  - filtr łączy się z linią lub gałęzią i z wyszukiwaniem w kolejce ([S4.2.1](#S4.2.1)): „Znaleziono 12 zadań · rodzaj
    Weryfikacja”; bez wyniku „Wśród zadań rodzaju Weryfikacja nic nie znaleziono.” z **Szukaj we wszystkich rodzajach
    zadań**;
  - wybór obowiązuje dla badania, przy którym powstał, dopóki nie zostanie anulowany albo śledzenie się nie skończy;
  - przy starszym badaniu rząd się nie pokazuje, a kolejka jest jak dotąd;
  - **Spis ludności** jest tylko przy badaniu, które oferuje spisy ludności ([R9.12](R9-archives.md#R9.12)); zadania
    spisu nie są wtedy pod **Inne**. Odłożonych zadań spisu ([R9.12.4](R9-archives.md#R9.12.4)) w kolejce nie ma.
- **Z sekcji Weryfikacja:** wiersz „Czeka na weryfikację” w Co wie badanie › **Weryfikacja**
  ([S7.5](S7-reliability-and-verification.md#S7.5)) ma **Pokaż w kolejce**. Otwiera **Kolejkę** w Przeglądzie badania
  zawężoną do **Weryfikacja**. Zostaje w aplikacji i nie ma oznaczenia.
- **Obsługa:** aplikacja: **Przegląd badania** → **Kolejka** → rząd **Rodzaj zadania**; Co wie badanie ›
  **Weryfikacja** → **Pokaż w kolejce**. Terminal: `strom task list --kind verify` ([R2.2](R2-lines-and-queue.md#R2.2)).
- **Obowiązuje od:** aplikacja 3.31.0, badanie 1.36.0

<!-- zdroj: dirigent:spec/065-spolehlivost-a-znovu-overeni K7.4 · app:53ef9cbe src/ui/queue-kind-ui.ts (queueKindChips: jen druhy s úkolem v pevném pořadí, vybraný i s 0; queueKindRow aria-pressed, ×, taskKindClear; volba pro bridge.base) · src/research-link.ts QUEUE_KIND_FEATURE queue.kind, QUEUE_TASK_KINDS · src/research-queue-pages.ts (kind= s linií, větví a q) · src/ui/research-ui.ts queueSearchInKind, queueSearchNoneKind, queueSearchAllKinds · src/ui/verify-person-ui.ts verifyRowsHtml (pendingQueue, bez značky), showOverviewQueueKind('verify') · strings.ts live.taskKinds, taskKindLabel, taskKindClear, queueSearchFound, verify.pendingQueue · research:7116bb60 src/core/taskkind.ts, GET /queue?kind=, queueCounts.kind · CHANGELOG.cs.md 3.31.0 · sčítání: app:6edc7dc7 src/research-link.ts QUEUE_TASK_KINDS (census za records), CENSUS_FEATURE · src/research-queue-pages.ts queuePageQuery (kind=census jen s funkcí census, other + known=census) · strings.ts live.taskKinds.census · research:c7b117cd src/core/taskkind.ts (census, KINDS_065, kindMatches known) -->

<a id="S4.3"></a>
## S4.3 Linie w aplikacji

Przegląd pokazuje linie badania ([R2.1](R2-lines-and-queue.md#R2.1)): co na którą czeka i dokąd doszła. W aplikacji
3.21.2 linie tylko się czyta; każdą zmianę potwierdza się w terminalu badania.

- **Granice:**
  - Sekcja **Linie · aktywne: N** jest tylko przy dwóch i więcej liniach albo przy jednej linii, gdy działa też
    praca poza nią (wiersz **Poza liniami**). Wstrzymane i zakończone linie są zwinięte pod **Wstrzymane
    i zakończone · N**.
  - Wiersz linii: rodzaj (↑ przodkowie, ↓ potomkowie, ⌕ pytanie), nazwa, osoba, liczba zadań i co czeka na załatwienie.
    Linia bez pracy ma **Nic nie czeka, można ją zakończyć.**
  - Szczegóły linii: znani przodkowie według pokoleń, kiedy ostatnio nad nią pracowano, **Pracuj nad tą linią**
    (rozmowa z agentem, nie w Archiwum Strom) i **Pokaż w drzewie**.
  - Menu **Akcje linii**: **Wstrzymaj**, **Zakończ**, **Uruchom ponownie**. Każde otwiera terminal, który mówi, co
    się stanie, i pyta o powód ([R2.1.2](R2-lines-and-queue.md#R2.1.2)).
  - Na telefonie menu brakuje: **Nic nie czeka · zakończyć można w badaniu na komputerze**.
  - Przy dwóch i więcej liniach panel dzieli pracę według linii i można wybrać jedną linię; według niej filtruje się
    kolejka.
- **Obsługa:** aplikacja: **Przegląd badania → Linie**, przy linii **⋯**.
- **Obowiązuje od:** aplikacja 3.5.0 (badanie 1.8.0). Podział panelu według linii od 3.13.1.
- **Od aplikacji 3.22.0:** z badaniem 1.26.0 linie zmienia się bezpośrednio w aplikacji ([S4.3.1](#S4.3.1)). Wiersz
  linii pokazuje, nad czym teraz trwa praca (**Teraz: …**), i granice (**do N pokoleń**, **przed …** (rok); przy
  linii wstrzymanej nie). Szczegóły linii mówią, co linia znalazła w ostatnich dniach (**Ostatnie N dni:** sesje,
  osoby, źródła); osoby pokazują w drzewie. Zakończone linie są zwinięte na końcu (**Zakończone · N**). W wąskim
  oknie i na telefonie przegląd jest panelem wysuwanym: zamiast uchwytu kolejności strzałki ▲▼.
- **Od aplikacji 3.31.0 z badaniem 1.36.0:** każda linia może dostać własnego agenta, **Uruchom agenta na tej linii**
  ([S4.3.3](#S4.3.3)). Wiersz linii z własnym przebiegiem mówi „Agent pracuje: Claude” z odnośnikiem **W Teraz ›**,
  który rozwinie **Teraz** i podświetli blok przebiegu ([S4.1.8](#S4.1.8)). Rozmowa **Pracuj nad tą linią** ma
  podpowiedź „Rozmowa z agentem o linii w terminalu”.

<!-- zdroj: app:v3.21.2 src/ui/research-directions-ui.ts:156 linesMulti, :350-353 appendOverviewDirections, :385 canDo, :528 dirWork · strings.ts live.dirTitle, live.dirOutside, live.dirInactive, live.dirWork · research:v1.25.2 assets/lang/cs.json ui.link.what.direction.pause/done/resume · 3.22.0: research-directions-ui.ts:703 dirEnded, :852 dirNow, :878 dirFoundIn, :720 sheet; strings.ts live.dirLimitGen, dirLimitBefore, dirFound* -->

<a id="S4.3.1"></a>
### S4.3.1 Zarządzanie liniami z aplikacji

Z badaniem, które to potrafi, aplikacja zapisuje zmiany linii bezpośrednio przez most. Terminal się nie otwiera i za
nic się nie płaci.

- **Granice:**
  - **+ Nowa linia** (formularz **Nowa linia**: **Rodzaj** Przodkowie / Potomkowie / Pytanie, **Osoba**,
    **Pytanie**, **Nazwa**, **Ogranicz…**). Założenie nic nie kosztuje, a agent zaczyna pracę nad linią przy
    następnym uruchomieniu. Nowa linia idzie na koniec kolejności.
  - **Edytuj**: rodzaju i osoby zmienić nie można (inna osoba = nowa linia). Edycja obowiązuje od następnego wyboru
    zadania.
  - Kolejność linii: przeciąganiem, strzałkami lub **Przenieś na początek**. Pod listą jest napisane, jak badanie
    traktuje kolejność: **Badanie poświęca najwięcej czasu liniom na górze, pozostałe nie stoją.** albo **Badanie
    bierze linie po kolei.**
  - **Wstrzymaj** i **Uruchom ponownie** można cofnąć (**Cofnij**). **Zakończ…** pyta i przyjmuje nieobowiązkowy
    powód.
  - Gdy taka sama linia już jest, formularz to mówi (**Linia … już działa.**) i proponuje **Pokaż ją** albo
    **Załóż mimo to**.
  - **Szukaj przodków** i **Szukaj potomków** przy osobie otwierają ten formularz.
  - Tylko do odczytu: w Archiwum Strom (**Archiwum: linie tylko do odczytu.**), na telefonie (**Linie można zmieniać
    w Stromie na komputerze, na którym działa badanie.**) i gdy badanie nie działa (**Badanie nie działa. Linie
    będzie można zmienić, gdy zacznie działać.**).
  - Badanie starsze niż 1.26.0: działania zostają w terminalu (**Badanie zarządza liniami z aplikacji od wersji
    1.26.0.**).
  - Gdy badanie odrzuci zapis (na przykład jest zajęte), aplikacja nic nie zmienia i proponuje **Spróbuj ponownie**.
- **Obsługa:** aplikacja: **Przegląd badania → Linie**, **+ Nowa linia**, przy linii **⋯**; menu osoby
  **Badanie ›**.
- **Obowiązuje od:** aplikacja 3.22.0 (badanie 1.26.0)
- **Od aplikacji 3.31.0 z badaniem 1.36.0:** nowa linia wewnątrz szerszej linii
  ([R2.1.5](R2-lines-and-queue.md#R2.1.5)): formularz **Nowa linia** mówi „Nowa linia leży wewnątrz linii Przodkowie
  Jana Horáka. Osoby z niej pozostają też w szerszej linii.” i proponuje zaznaczone „Przenieść tu 7 otwartych zadań
  z linii Przodkowie Jana Horáka (o osobach tej linii)” (przy kilku szerszych liniach „z szerszych linii”). Po
  założeniu z przeniesieniem zostaje 10 s powiadomienie „Założono linię. Przeniesiono 7 zadań.” z **Cofnij
  przeniesienie** i **Pracuj nad tą linią**. **Cofnij przeniesienie** (**Cofanie…**) cofa tylko przeniesienie, linia
  zostaje: „Przeniesienie cofnięte · 7 zadań z powrotem w szerszej linii”; gdy zadania się w międzyczasie zmieniły,
  **Nie ma czego cofnąć.** Bez przeniesienia (pole niezaznaczone, nie ma czego przenosić, starsze badanie)
  powiadomienie jest jak dotąd; na telefonie bez **Pracuj nad tą linią**.

<!-- zdroj: app:HEAD src/ui/research-directions-ui.ts:372 DIRECTIONS_WRITE_SINCE, :628 · src/research-directions-write.ts createDirection, editDirection, setDirectionState, writeDirectionOrder · src/ui/research-actions-ui.ts:1015-1024, :1067 openDirectionForm · strings.ts live.dirNew, dirFormNew, dirFree, dirEditFree, dirLocked, dirOrderWeight, dirOrderStrict, dirArchive, dirPhoneOnly, dirBridgeDown, dirOldResearch, dirBusy, dirRetry, dirDupActive, dirShowIt, dirAnyway · research:src/core/live.ts /directions -->

<a id="S4.3.2"></a>
### S4.3.2 Praca poza liniami według gałęzi

Przy dwóch i więcej liniach przegląd pokazuje pracę poza liniami według gałęzi. Opcje
z [R2.3](R2-lines-and-queue.md#R2.3) i [R2.3.1](R2-lines-and-queue.md#R2.3.1) można ustawić bezpośrednio z aplikacji.

- **Granice:**
  - Dla całego badania: **Jak jest podejmowana praca poza liniami**: **Od czasu do czasu**, **Na końcu**,
    **Normalnie**, **Nigdy**.
  - Wiersz gałęzi: osoba gałęzi, związek z linią (**przy linii …**), liczba zadań, **rośnie**, **własny wybór**.
  - Kliknięcie gałęzi pokazuje jej pierwsze zadania z miejscem w kolejce (**W kolejce · pierwsze K z N**,
    **I. w kolejce**) i odnośnik **Wszystkie N zadań w kolejce ›**. Gdy zadania gałęzi stoją za wczytaną częścią
    kolejki: **Zadania gałęzi stoją dalej w kolejce (N).**
  - Dla gałęzi: **Podejmowana:** **Od czasu do czasu** / **Na końcu** / **Normalnie** (wybór badania ma
    **(domyślne)**), **Dodaj do linii …** (najbliższa linia pierwsza), **Załóż linię z tej gałęzi**, **Nie badaj**
    (zadania opuszczają kolejkę, nic nie jest usuwane), **Przywróć domyślne**. Gałęzie niebadane są razem
    (**Nie jest badana · N gałęzi**).
  - Pytania o rosnące gałęzie ([R2.3.2](R2-lines-and-queue.md#R2.3.2)) są w **Czeka na załatwienie**: dodać do linii
    (przy linii wstrzymanej **Dodaj do linii … (wstrzymana)**), założyć linię, **Zostaw bez zmian**, nie badać. Bez
    odpowiedzi gałąź jest podejmowana dalej jak dotąd.
  - Okno **Badanie dla tego drzewa…**, grupa **Praca poza liniami**: wybór dla całego badania (**Od czasu do czasu**:
    „Około 1 zadanie poza liniami na K zadań linii.”), **Proponuj linie dla rosnących gałęzi**, **Gałęzie
    z własnym wyborem** i zadania z ręczną kolejnością. Od aplikacji 3.27.0 wstęp grupy mówi, co pomaga linii
    i zawsze idzie z nią: „pytanie linii, dołączenie osób do kogoś z linii lub do jego partnera, powód podany przez
    agenta” ([R2.3](R2-lines-and-queue.md#R2.3)).
  - Wybór badania obok nagłówka **Poza liniami** (np. „na końcu”) otwiera **Badanie dla tego drzewa…** na grupie
    **Praca poza liniami** z wybraną kartą, także bez śledzenia i z osobnego okna przeglądu (okno dialogowe otwiera się
    w oknie głównym). Przy Archiwum Strom i przy badaniu, które czeka na agenta, tej grupy nie ma i wybór jest tylko
    tekstem. Etykieta gałęzi nie jest odnośnikiem: rozwija gałąź jak cały jej nagłówek.
- **Obsługa:** aplikacja: **Przegląd badania**, sekcja pracy poza liniami, przy gałęzi **⋯** (**Opcje gałęzi**);
  **Badanie dla tego drzewa…**.
- **Obowiązuje od:** aplikacja 3.22.0 (badanie 1.26.0); wybór przy **Poza liniami** bez śledzenia i z okna przeglądu
  od aplikacji 3.29.0

<!-- zdroj: app:HEAD src/ui/research-offline-ui.ts:3, :104 (caps.offLineBranches, ≥2 linie) · src/research-directions-write.ts setBranchMode, setOffLineTree, answerBranchWaiting · strings.ts live.offModeLink, live.offModeCap, live.branchAddPick, live.branchCreate, live.branchNever, live.branchReset · research-offline-ui.ts:202-228 growingBranchLine, :542 branch choices, :680 branchQueueBeyond, :740 pick · strings.ts live.dirNear, branchGrows, branchOwnChoice, branchQueueHead, branchQueuePos, branchAllTasks, branchTaken, branchDefaultTag, branchAdd(Paused), branchNeverGroup, waitBranchLeave, waitBranchHint, setOutTitle, setOutOcc, setSuggest, setOwnChoice, setManualTasks, menu treeSettings · spec 038 K7 · 3.27.0: strings.ts live.setOutIntro (app 4e4f6d8c, spec 036 K1.8) · 3.29.0: app:70d50162 research-offline-ui.ts openOffLineSettings bez sledování (prohlížený strom), overview-window offline-settings → hlavní okno · 0a00fb2b research-tree-settings-ui.ts offLineSettingsOffered (archiv, čeká na agenta: text, ne odkaz) -->

<a id="S4.3.3"></a>
### S4.3.3 Uruchom agenta na tej linii

Przy każdej aktywnej linii można poprosić o własny przebieg: agenta, który bierze tylko zadania tej linii
([R7.10](R7-when-the-agent-works.md#R7.10)). Aplikacja niczego nie uruchamia: otwiera terminal badania w nowym oknie,
a ten uruchamia przebieg ([R7.10.4](R7-when-the-agent-works.md#R7.10.4)). Praca agenta zużywa subskrypcję AI.

- **Gdzie:** szczegóły linii, przycisk **Uruchom agenta na tej linii** (oznaczenie AI i terminal) ze zdaniem „Agent
  sam bierze zadania tej linii (7 w kolejce), w nowym oknie terminala.”; menu **⋯** przy linii, pozycja przed
  **Pracuj nad tą linią** (podpowiedź „Agent sam bierze zadania linii”).
- **Linia z przebiegiem:** w szczegółach zamiast przycisku „● Agent pracuje · Claude · od 10:42” i **W Teraz ›**;
  w menu pozycji nie ma. Drugi przebieg tej samej linii nie jest możliwy.
- **Gdy się nie da:** przycisk i pozycja zostają, niedostępne, z powodem:
  - „Linia jest wstrzymana.” (obok zostaje **Uruchom ponownie**);
  - „W kolejce linii nic nie ma.”;
  - „Pracują 3 agenci, ustawienia nie pozwalają na więcej.” z **Ustawienia ›** ([S4.4.12](#S4.4.12));
  - „Na tym komputerze nie jest zainstalowany agent, którego badanie może uruchomić.”;
  - „Nad drzewem pracuje agent uruchomiony starszą wersją badania; obok niego agent linii się nie uruchomi. Będzie
    można, gdy on skończy.”;
  - w innym wypadku „Teraz nie da się uruchomić agenta na tej linii.”
  Przy zakończonej linii akcji nie ma.
- **Okno Uruchom agenta na linii:** w nagłówku znak, nazwa i numer linii.
  - **Agent** (tylko gdy badanie zna dwóch i więcej agentów): wybór agenta, domyślny z „(domyślny)”, pod nim „Wybór
    zostaje zapamiętany dla tej linii.” Wstępnie wybrany jest agent, z którym linia pracowała ostatnio, inaczej
    domyślny agent badania;
  - **Automatycznie** („Agent bierze zadanie za zadaniem tej linii, dopóki pozwala limit subskrypcji.”) albo **Tylko
    5 zadań**, **Jako pierwsze** i **Kolejne (n)** jak w [S4.2.3](#S4.2.3), tylko z kolejki linii; pod nimi
    „i jeszcze 12 zadań linii w kolejce”;
  - gdy jakiś przebieg już pracuje: „Pracuje już 1 agent. Zużycie subskrypcji się sumuje.” Niczego to nie blokuje;
  - **Anuluj** i **Uruchom** (oznaczenie AI i terminal) ze zdaniem „Agent zacznie w nowym oknie terminala. Pracę
    zatrzymuje Ctrl-C w jego oknie lub „Dokończ i zakończ” w sekcji Teraz.” Gdy linia w międzyczasie zostanie
    zablokowana, **Uruchom** jest niedostępne z powodem.
- **Po Uruchom:** **Teraz** od razu pokazuje „Uruchamianie… · Przodkowie Jana Horáka (G0002)” z „Agent uruchomi się
  w nowym oknie terminala badania.”; bez odpowiedzi w ciągu 30 s „Przebieg linii się nie uruchomił? · Przodkowie Jana Horáka” ze
  **Spróbować ponownie** jak w [S4.2.3](#S4.2.3).
- **Granice:** tylko przy badaniu, które potrafi przebiegi linii, z mostem, który odpowiada, i z agentem; nie
  w Archiwum Strom, nie w badaniu czekającym na agenta i nie na telefonie (tam przebiegi tylko widać,
  [S4.1.8](#S4.1.8)).
- **Obsługa:** aplikacja: **Przegląd badania → Linie**, szczegóły linii albo **⋯**. Terminal: `strom run
  --research G…`, menu **Pozwól agentowi pracować samodzielnie** ([R7.10](R7-when-the-agent-works.md#R7.10)).
- **Obowiązuje od:** aplikacja 3.31.0 (badanie 1.36.0)

<!-- zdroj: app:4de0835a src/ui/research-directions-ui.ts (managedDirectionDetail blok běhu, openManagedDirectionMenu položka před dirWork, managedDirectionMeta lineRunWorkingMeta + lineRunInNow, lineRunWhy) · src/research-runs.ts lineRunBlock (ended, running, canStart/why z mostu, paused > empty > limit), atRunLimit · src/ui/queue-work-dialog.ts showLineRunDialog, syncLineRunDialog (lineRunKicker, lineRunAgent, lineRunAgentDefault, lineRunAgentKept, lineRunAutoHint, lineRunRest, runsAddUp, lineRunStart, lineRunConfirm) · beginRunWork (work?research=G&agent=), lineRunStarting, lineRunStartingSub, lineRunNotStarted · strings.ts live.lineRun*, runsLimitReached, runsSettingsLink, dirWorkHint · app:docs/ZADANI_DEV_beh-po-liniich.md §1, §2, Kolo 2 B · dirigent:spec/126 K2.1, K2.2, K2.4, K2.7, K2.8 · research: researches[].run/canStart/why/agent, agents[] -->

<a id="S4.4"></a>
## S4.4 Czeka na załatwienie w aplikacji

Panel i przegląd pokazują tę samą listę co badanie ([R6.1](R6-awaiting-action.md#R6.1)). Co można załatwić
w aplikacji, a co tylko w badaniu, mówi [R6.5](R6-awaiting-action.md#R6.5).

- **Granice:** pod listą jest napisane, gdzie się odpowiada: **Odpowiada się w badaniu. Drzewo zaktualizuje się samo
  po odpowiedzi.**, przy pytaniach o miejsca **Na pytania o miejsca odpowiada się tutaj.**, przy obu **Na pytania
  o miejsca odpowiada się tutaj, na pozostałe w badaniu.** Pozycji tylko dla terminala aplikacja nie dostaje
  ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
- **Z drzewa:** karta osoby, na którą coś czeka, ma znacznik **!** (podpowiedź: **Kliknięcie: odpowiedz**).
  Kliknięcie w niego i pozycja **Odpowiedz · N czeka** w menu osoby robią to samo:
  - gdy na osobę czeka jedna pozycja, otworzy się jej odpowiedź tak samo jak przyciskiem w jej wierszu w panelu;
  - gdy czeka ich więcej, otworzy się panel w sekcji **Czeka na załatwienie** z pozycjami osoby na górze, wyróżnionymi.
    Na telefonie, przy zwiniętej lub ukrytej sekcji i przy otwartym przeglądzie zostaną wyróżnione w **Przeglądzie
    badania**;
  - gdy na żadną pozycję osoby (nawet na jedyną) nie można tu odpowiedzieć, panel otworzy się tak samo, a pod każdą
    pozycją stoi **Tutaj nie można odpowiedzieć: odpowiada się w badaniu, na komputerze, na którym jest
    zainstalowane.** Kliknięcie nigdy nie zostaje bez reakcji;
  - nowa wersja opowieści otworzy porównanie;
  - na urządzeniu dotykowym menu osoby ma zamiast **Odpowiedz · N czeka** pozycję **Czeka na załatwienie · N ›**:
    wyróżni pozycje osoby, a odpowiada się z ich wierszy.
  - gdy karta ma dwa lub trzy oznaczenia, kliknięcie zaproponuje, co otworzyć ([S4.4.1](#S4.4.1)).
- **Hipotezy:** z badaniem, które umie je rozstrzygać w aplikacji, hipotezy do rozstrzygnięcia są w grupie
  **Hipotezy do rozstrzygnięcia** (chip **Decyzje**), także z przyjęciem propozycji agenta naraz ([S3.5.2](S3-what-the-research-knows.md#S3.5.2)).
- **Obsługa:** aplikacja: panel, sekcja **Czeka na załatwienie**; menu **Badanie → Czeka na załatwienie**; znacznik **!** na
  karcie i **Odpowiedz · N czeka** w menu osoby.
- **Obowiązuje od:** aplikacja 3.4.0. Pytania o miejsca od badania 1.25.0. Znacznik **!** i **Odpowiedz · N czeka**
  działają tak od aplikacji 3.26.0. Hipotezy od aplikacji 3.27.0 z badaniem 1.31.0. Kilka oznaczeń na karcie od
  aplikacji 3.27.0 ([S4.4.1](#S4.4.1)).
- **Od aplikacji 3.28.0:** w **Przeglądzie badania** sekcja ma od 10 pozycji pole wyszukiwania ([S4.4.2](#S4.4.2)).
- **Od aplikacji 3.30.0:** w **Przeglądzie badania** sekcję można posortować od najnowszych albo najstarszych pozycji
  ([S4.4.3](#S4.4.3)).
- **Od aplikacji 3.30.0 z badaniem 1.35.0:** pozycje można pogrupować według księgi, z kolejnością **Najwięcej zadań**
  i podsekcją **Szybciej dzięki pobraniu** ([S4.4.4](#S4.4.4), [S4.4.5](#S4.4.5)); ustawienia ksiąg w oknie **Badanie
  dla drzewa** ([S4.4.6](#S4.4.6)).
- **Od aplikacji 3.30.0:** grupy i otwarta pozycja (także przy badaniu bez ksiąg):
  - każda grupa (miejsce, archiwum, urząd, księga) stoi we własnym pasku z pełną nazwą, pod nim dane i działania
    grupy (przy archiwum te z **Strona archiwum ↗**, **Czat**, **Wysłano** i **Treść wszystkich zapytań**, które
    badanie oferuje). Nazwa zawija się najwyżej na 3 wiersze (na telefonie, w małym panelu i w wąskiej kolumnie okna
    Przeglądu na 4); dłuższa kończy się „…” i odnośnikiem **więcej**, który rozwija nazwę i nie zwija grupy
    (**mniej** znów ją skraca). Pozycje grupy wiszą pod paskiem na pionowej linii. Lista bez grup i śródtytuł **Bez
    księgi** linii nie mają;
  - otwarta pozycja pokazuje swój tekst cały i tylko raz, w swoim wierszu. Treść zaczyna się blokiem **Czeka na**
    z pełnym zleceniem ręcznego kroku, tak jak napisało je badanie (adresy w tekście są odnośnikami). Tekst dłuższy
    niż 10 wierszy (na telefonie w poziomie 3) kończy się „…” i **więcej** / **mniej**. Drugi wiersz bloku,
    **Adresat**, mówi, do kogo idzie prośba. Pozycja, która czeka tylko na człowieka, bloku nie ma. Pod blokiem stan
    skanów, osoba · kierunek i działania;
  - tekst „czeka na” ma do 1500 znaków (wcześniej aplikacja przycinała go do 120). Mały panel pokazuje go w wierszu
    na 2 wiersze, cały po najechaniu;
  - pozycja rodzaju **Internet** ma w otwartej treści **Otwórz stronę ↗** i obok adres strony (nie na telefonie);
  - pozycja czekająca na skany zaczyna się blokiem **Dostarczyć** z krokami ([S4.4.7](#S4.4.7)).
- **Od aplikacji 3.30.0 z badaniem 1.35.0:** zadanie, którego czekanie na skany nie jest zapisane tak, jak potrzebuje
  tego strom, ma oznaczenie, a w otwartej pozycji poprawkę w jednym kroku ([S4.4.8](#S4.4.8), [S4.4.9](#S4.4.9)).
- **Od aplikacji 3.32.0 z badaniem 1.37.0:** pozycja, którą można zwrócić agentowi, ma wiersz **Teraz** i przycisk
  **Spróbuj ponownie przez agenta**, pasek archiwum **Spróbuj ponownie wszystkie przez agenta**
  ([S4.4.14](#S4.4.14)).

<!-- zdroj: app:7d7c0783 src/ui/research-overview-ui.ts overviewWaitingGroupHead, overviewWaitingBookHead (pás .research-overview__waiting-grouphead, akce skupiny v pásu, ul.is-grouped; bez skupin a Bez knihy bez linky), src/ui/waiting-order-ui.ts groupTitleMoreEl (strop GROUP_TITLE_LINES 3, telefon, panel a úzký sloupec 4; víc/méně stav title:<skupina>, stopPropagation), src/ui/research-ui.ts (panel: pás, víc, is-grouped), appendWaitingWebHost, strings.ts live.titleMore, titleLess, waitingWebHostAria · app:1176f465 overviewWaitingRow (text celý v řádku, detail ho neopakuje), overviewWaitingOnBox (waitsOnUser → bez bloku; appendLinkedText; waitingOnMoreEl 10 / na šířku 3 řádky; waitingToLabel Adresát), strings.ts live.waitingOnLabel, waitingToLabel · app:96b35bbd src/research-link.ts sanitizeWaiting MAX_WAITING_ON 1500, panel .live-waiting-on 2 řádky + title · CHANGELOG.cs.md 3.30.0 · dirigent:prace/1117-app-knihy-zahlavi, 1117-app-cekana-cely-text · app:docs/ZADANI_DEV_knihy-zahlavi.md §1–§3 -->

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts renderLivePanel (waiting) · strings.ts research.answerWhere, research.answerHere, research.answerMixed · app:7cf409bd src/ui/card-signals-ui.ts answerPersonWaiting (vyprávění → porovnání; 1 položka → waitingAnswerAction; jinak showPersonWaiting, why jen když žádná nejde), personSignalsMenuHtml (dotyk: menuWaiting → signal-waiting-list) · src/ui/research-ui.ts showPersonWaiting (telefon, sbalený/skrytý oddíl, otevřený přehled → přehled), waitingWhyEl · src/research-waiting.ts personWaiting, panelWaiting (focus první) · src/ui/waiting-task-ui.ts waitingAnswerAction · src/card-signals.ts ACTION_GLYPH waiting '!' · strings.ts card.menuAnswer, card.menuWaiting, card.tipClickAnswer, live.waitingNoAnswerHere · e2e/card-waiting-answer.spec.ts · hypotézy: app:src/ui/hypothesis-waiting-ui.ts (commit 8d7f1597), research:src/core/waiting.ts hypothesesApp -->

<a id="S4.4.1"></a>
### S4.4.1 Kilka oznaczeń na karcie osoby

Karta osoby ma w rogu portretu (zdjęcia lub inicjałów) najwyżej jedno oznaczenie badania każdego rodzaju: **!** (coś
czeka, [S4.4](#S4.4)), **≠** (sprzeczność źródeł, [R5](R5-conflicts.md)) i **?** (otwarte pytanie). Z jednym
oznaczeniem karta zachowuje się jak wcześniej. Dwa lub trzy oznaczenia stoją jedno za drugim jako jeden przycisk.

- **Granice:**
  - kolejność oznaczeń: czeka › sprzeczność › pytanie; z przodu, gdzie stoi pojedyncze oznaczenie, jest najpilniejsze,
    tylne są bez znaku. Pokazują się tylko rodzaje włączone w **Ustawienia → Karta osoby → Na karcie pokazuj**
    (**Czeka na załatwienie**, **Sprzeczności w źródłach**, **Otwarte pytania**);
  - podpowiedź po najechaniu ma wiersz na każde oznaczenie (co czeka z tekstem pierwszego zadania, sprzeczności
    i hipotezy, pytanie), a pod nimi „Kliknięcie: wybór, co otworzyć”. Czytnik ekranu słyszy, co czeka („Czeka 3,
    2 sprzeczności, 1 hipoteza, 1 pytanie”);
  - kliknięcie otwiera przy oznaczeniach małe okno z imieniem i latami osoby (czytnik ekranu: „{imię}: co czeka”)
    i wyborami: **Odpowiedz · N czeka** z tekstem pierwszego zadania (na urządzeniu dotykowym **Czeka na załatwienie
    · N ›**), **Porównaj** (nowa wersja opowieści), **Co wie badanie · … ›** (sprzeczności, hipotezy i pytanie jako
    jeden wybór), **Śledź badanie ›** (agent pracuje nad osobą). Wybory zostają w aplikacji, żaden nie ma oznaczenia
    badania ([S4.5.1](#S4.5.1));
  - tylko sprzeczność i pytanie dają jeden wybór: kliknięcie od razu otwiera **Co wie badanie** („Kliknięcie: co wie
    badanie”);
  - okno stoi pod oznaczeniami, przy prawej lub dolnej krawędzi okna odwrotnie, a gdzie nie mieści się nigdzie, na
    górze i przewija się. Zamyka je kliknięcie obok (nic więcej nie robi), drugie kliknięcie w oznaczenia, Esc, wybór,
    przesunięcie lub przybliżenie drzewa, zmiana rozmiaru okna i przerysowanie drzewa. Na telefonie (do 640 px) to
    panel wysuwany od dołu z wierszami 48 px, zamyka go stuknięcie obok lub przeciągnięcie w dół; na tablecie
    i telefonie w poziomie okno z wierszami 44 px;
  - klawiatura: Enter, spacja lub strzałka w dół na oznaczeniach otwiera okno na pierwszym wyborze, strzałki chodzą
    w kółko, Home i End, Enter wybiera, Esc wraca na oznaczenia, Tab idzie dalej;
  - karta bez portretu (**Szczegóły kart → Kompaktowe**) ma zamiast oznaczeń dwie kropki. Przy oddaleniu drzewa
    poniżej 0,55 każda karta, w każdych **Szczegółach kart**, ma zamiast oznaczeń jedną kropkę. Wydruk drzewa nie ma
    oznaczeń.
- **Obsługa:** aplikacja: kliknięcie w oznaczenia w rogu portretu; **Ustawienia → Karta osoby → Na karcie pokazuj**.
- **Obowiązuje od:** aplikacja 3.27.0
- **Od aplikacji 3.30.0:** agent przy osobie i oznaczenia są widoczne razem:
  - obracający się łuk wokół portretu osoby, nad którą pracuje agent, jest widoczny także obok jednego lub kilku
    oznaczeń; oznaczenia zostają w rogu. Karta bez portretu ma zamiast łuku pierścień wokół kropki oznaczenia;
  - czytnik ekranu słyszy jedno i drugie, co czeka, i „badanie tej osoby w toku”;
  - menu osoby z oznaczeniem oferuje także **Śledź badanie ›**;
  - znak ✓ po zakończonej pracy agenta pokazuje się tylko na karcie bez oznaczenia;
  - podgląd karty w **Ustawienia → Karta osoby** pokazuje łuk i oznaczenie razem.

<!-- zdroj: app:16461aca, 85c1f704, abf7620f src/card-signals.ts ACTION_ORDER (waiting, conflict, question), presentActions (zapnuté v Na kartě ukázat), stackChoices (waiting, story, knows, agent), ACTION_GLYPH · src/card-signal-marks.ts cardActionMarksHtml (stoh n2/n3, tečky), stackAriaLabel, stackTipHtml (tipClickChoose / tipClickKnows), stackMenuItemsHtml (menuAnswer / dotyk menuWaiting, story.compare, menuKnows, menuAgent; bez značky výzkumu), placeStackMenu · index.html .card-signal-stack, #tree-canvas.zoom-far (src/zoom.ts ZOOM_FAR = 0.55; index.html:13732-13741 jedna tečka u všech Detailů karet, e2e/card-signals.spec.ts:353), body.view-mode-print bez značek, compact dvě tečky · strings.ts card.stackLabel, stackWaiting, stackMenuLabel, tipClickChoose, cardDensity.cardWaiting, cardConflict, cardQuestion, compact · CHANGELOG.cs.md 3.27.0 „Více značek na kartě“ · dirigent:prace/1111-app-karta-vice-znacek · 3.30.0: app:16cba085 src/card-signals.ts showAgent i se značkou, doneSince jen bez značky · src/renderer.ts (oblouk vedle značky, kompaktní kroužek kolem tečky, aria-label obojí) · src/ui/card-fields-ui.ts náhled · src/ui/card-signals-ui.ts signal-agent (card.menuAgent) · strings.ts card.ariaAgent, card.menuAgent · CHANGELOG.cs.md 3.30.0 „Agent při práci i vedle odznaku“ · spec 109 -->

<a id="S4.4.2"></a>
### S4.4.2 Wyszukiwanie w Czeka na załatwienie

Sekcja **Czeka na załatwienie** w **Przeglądzie badania** ma pole **Szukaj osoby, miejsca, archiwum, zadania…**.
Aplikacja szuka sama w pozycjach, które już ma, i nic nie wysyła do badania. Filtruje od razu przy pisaniu, także bez
śledzenia, gdy badanie nie działa (pozycje, które badanie podało ostatnio, [S4.1.5](#S4.1.5)), i w oknie Przeglądu
([S4.1.6](#S4.1.6)).

- **Kiedy pole jest:** w rozwiniętej sekcji z 10 i więcej pozycjami, pod nagłówkiem sekcji i nad chipami rodzaju.
  Z wpisanym tekstem pole zostaje, nawet gdy pozycji ubędzie.
- **Co się znajdzie:** pozycje, które mają każde wpisane słowo (w dowolnej kolejności; słowa dzieli spacja, przecinek
  albo średnik) w tym, co pokazuje ich wiersz, szczegół albo nagłówek grupy:
  - tekst pozycji i na co czeka;
  - imiona i nazwiska oraz numery osób (`P47` i `P0047`);
  - numer zadania (`T0815`, `t815`) i hipotezy (`H22`); sama liczba (`815`) znajdzie zadanie z tym numerem,
    w przeciwnym razie hipotezę, w przeciwnym razie tekst (na przykład rok);
  - nazwa grupy (miejsce, archiwum, urząd), adres archiwum przy zezwoleniu i do kogo idzie list.
- **Zgodność tekstu:** bez względu na wielkość liter i znaki diakrytyczne; ß, ł, đ, ø, æ i œ znajdą się też jako ss,
  l, d, o, ae i oe (`grosshof` znajdzie „Großhof”). Słowo z 5 i więcej znakami znajdzie też słowa, które zaczynają
  się jak ono bez ostatniego znaku (`bialy` znajdzie „Białe”).
- **Granice:**
  - chipy rodzaju (**Decyzje**, **Obrazy**, **Archiwa i urzędy**…) pokazują liczbę znalezionych; rodzaj bez
    zgodności jest przerywany i można go dalej wybrać. Szuka się w wybranym rodzaju;
  - nad listą „Znaleziono 12 z 40” (z pozycji wybranego rodzaju). Bez wyniku **Nic nie znaleziono.**, w wybranym
    rodzaju „W rodzaju Obrazy nic nie znaleziono.” z **Szukaj we wszystkich rodzajach**, oraz **Wyczyść
    wyszukiwanie**;
  - fazy (**Do załatwienia**, **Czeka na odpowiedź**) i grupy ze zgodnością się rozwijają, bez zgodności się nie
    pokazują. To, co zwinie się podczas wyszukiwania, obowiązuje tylko dla tego wyszukiwania; po wyczyszczeniu pola
    wraca ręczne rozwinięcie;
  - zgodność numeru osoby, zadania lub hipotezy ma przy wierszu bursztynową etykietę („P0108 Jan Horák”); zgodność
    tekstu nie jest wyróżniana;
  - hipotezy w grupie **Hipotezy do rozstrzygnięcia**: głowa wyboru **Wybierz znalezione z propozycją (n)** wybiera
    tylko znalezione. Wybrane poza wyszukiwaniem zostają wybrane, a stopka to mówi („Wybrano 5, w tym 2 poza
    wyszukiwaniem.”) z **Odznacz poza wyszukiwaniem**. **Przyjmij propozycje (n)** liczy wszystkie wybrane
    ([S3.5.2](S3-what-the-research-knows.md#S3.5.2));
  - zwinięta sekcja z wpisanym wyszukiwaniem ma w nagłówku zamiast podsumowania lupę i szukany tekst;
  - starsze badanie bez rodzajów i grup: szuka się w wierszach, jak idą po sobie;
  - × albo Escape czyści pole (Escape w pustym polu zamyka Przegląd), ↓ przechodzi do pierwszego wiersza, czytnik
    ekranu powie liczbę po krótkiej przerwie. Tekst obowiązuje do zamknięcia Przeglądu i nigdzie się nie zapisuje;
  - telefon: pole ma 44 px wysokości; po stuknięciu w pole sekcja przesuwa się pod nagłówek Przeglądu, a Przegląd
    kończy się nad klawiaturą, więc znalezione jest między polem a klawiaturą.
- **Obsługa:** aplikacja: **Przegląd badania → Czeka na załatwienie**, pole wyszukiwania.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:8cbada1c src/section-search-match.ts foldSearch2 (ß ł đ ø æ œ), tokenize (mezera, čárka, středník; p/t/h + číslo, samotné číslo), matchDoc (každé slovo; n: úkol, hypotéza, text), textMatches (≥ 5 znaků bez posledního na začátku slova), fieldVisible (≥ 10 nebo text) · src/ui/section-search.ts (×, Escape: nejdřív hledání, prázdné pole zavře Přehled; ↓; searchOpen se vymaže s textem; zavření Přehledu text zahodí) · app:9ebf7f2c src/section-search-filter.ts searchSection, chipCount, sectionPartOpen, toggleSectionPart, sheetOverKeyboard · src/ui/section-search-view.ts mountSectionSearch, paintSearchChip (čárkovaný), appendSearchOutcome (sectionSearchFound, queueSearchNone, sectionSearchNoneKind + sectionSearchAllKinds, queueSearchCancel), searchHitTag, searchSummaryEl (lupa a text), bindSheetSearch, keepSheetOverKeyboard · src/ui/research-overview-ui.ts appendOverviewWaiting (pole jen v rozbaleném oddílu, starší výzkum bez skupin), waitingSearchDoc (what, on, osoby, person, partner, task, hypo, group.name / otázky k místům, host, to), overviewWaitingRow (hit t, p) · app:cd0030b0 src/ui/hypothesis-waiting-ui.ts hypothesisAcceptHeadEl (bulkSelectFound), hypothesisAcceptFootEl (bulkSelectedHidden, bulkDeselectHidden), hwr-id hit h · strings.ts live.waitingSearchPlaceholder, waitingSearchAria, sectionSearchFound, sectionSearchNoneKind, sectionSearchAllKinds, bulkSelectFound, bulkSelectedHidden, bulkDeselectHidden, sectionSearchQuoted, waitingPhaseTodo, waitingPhaseSent, waitingChips · e2e/overview-waiting-search.spec.ts · CHANGELOG.cs.md 3.28.0 (e540e4b5) · spec 083 K1.1–K1.3 · prace/1113-app-hledani-v-prehledu (pole 44 px na telefonu) -->

<a id="S4.4.3"></a>
### S4.4.3 Kolejność w Czeka na załatwienie

Sekcję **Czeka na załatwienie** w **Przeglądzie badania** można posortować także według tego, od kiedy pozycja czeka.
Nowo dodana pozycja jest wtedy na górze i nie gubi się między miejscami i grupami.

- **Kolejność:**
  - **Zalecana** (domyślna): kolejność badania według faz, miejsc i linii jak dotąd;
  - **Najnowsze na górze** i **Najstarsze na górze**: według czasu, od kiedy pozycja czeka, tak jak go wysłało
    badanie. Sortuje się w każdej fazie (**Do załatwienia** i **Czeka na odpowiedź**). Ten sam czas zachowuje
    kolejność badania, pozycje bez czasu są w obu kierunkach na końcu.
- **Grupy** (przełącznik obok kolejności, tylko przy kolejności według czasu i przy badaniu z grupami według
  miejsc):
  - włączone: sortuje się wewnątrz grup, a każde miejsce stoi tam, gdzie jego najnowsza (albo najstarsza) pozycja;
    także **Pozostałe** i **Miejsca**, które przy kolejności **Zalecana** stoją na końcu. Nagłówek miejsca pokazuje
    czas swojej pierwszej pozycji;
  - wyłączone: każda faza jest jedną listą, a każdy wiersz ma etykietę swojego miejsca (cała nazwa w tekście po
    najechaniu).
- **Czas przy wierszu** (tylko przy kolejności według czasu): do godziny względnie („25 min temu”), dziś godzina
  („08:30”), „wczoraj”, w tym roku dzień („4.11”), wcześniej dzień i rok („6.10.2025”). Czas sam się odświeża.
- **Etykieta „nowe”** (przy każdej kolejności): pozycje do załatwienia, których na tym urządzeniu jeszcze nie było
  widać w rozwiniętej sekcji **Czeka na załatwienie** (ten sam zapis co **N nowych**, [S4.1.2](#S4.1.2)). Etykieta
  zostaje do zamknięcia Przeglądu; zwinięte miejsce powie „nowe: 2”. Drzewo, na które na tym urządzeniu jeszcze nikt
  nie patrzył, nie ma nic nowego.
- **Granice:**
  - wybór kolejności jest od dwóch pozycji w sekcji;
  - kolejność i przełącznik **Grupy** zapamiętują się na tym urządzeniu dla wszystkich drzew (za pierwszym razem
    **Zalecana**, **Grupy** włączone); inne okno tego samego urządzenia, także okno Przeglądu ([S4.1.6](#S4.1.6)),
    się dostosuje;
  - kolejność obowiązuje także z wyszukiwaniem ([S4.4.2](#S4.4.2)) i chipami rodzaju. Głowa i stopka wyboru hipotez
    przy wyłączonych grupach dotyczą hipotez całej fazy;
  - obowiązuje w Przeglądzie (jako panel boczny i nad drzewem), w oknie Przeglądu i na telefonie. Mały panel jest bez
    zmian (poza badaniem z księgami, [S4.4.4](#S4.4.4)).
- **Z badaniem, które zna księgi** (badanie 1.35.0): przełącznik **Grupy** jest wyborem **Archiwum** | **Księga** |
  **Bez grup**, a kolejność ma czwartą możliwość **Najwięcej zadań** ([S4.4.4](#S4.4.4)).
- **Od aplikacji 3.32.0 z badaniem 1.37.0:** kolejność **Najbardziej pomocne**: według tego, ile załatwienie
  pozycji da badaniu. Do każdej pozycji, za którą stoją zadania, badanie wysyła wynik i powód
  ([R6.4.1](R6-awaiting-action.md#R6.4.1)):
  - najwyższy wynik na górze; równy wynik zachowuje kolejność badania, pozycje bez wyniku (opowieści, sprzeczności,
    miejsca…) są na końcu;
  - grupy jak przy kolejności według czasu: każde miejsce stoi tam, gdzie jego pozycja, która najbardziej pomoże;
    wyłączone grupy dają jedną listę;
  - powód badania stoi cicho pod wierszem, tylko w tej kolejności („nowe pokolenie: rodzice osoby Jan Horák · linia
    prosta · odblokuje 3 zadania”); w Przeglądzie, w oknie Przeglądu, na telefonie i w małym panelu z księgami.
    Długie słowo bez spacji łamie się w wierszu;
  - wybór jest zapamiętywany jak inne kolejności. Starsze badanie wyniku nie wysyła i wyboru nie ma; zapamiętane
    **Najbardziej pomocne** pokazuje się tam jako **Zalecana**, a wybór pozostaje zapamiętany.
- **Obsługa:** aplikacja: **Przegląd badania → Czeka na załatwienie**, przycisk „⇅ Zalecana ▾” za chipami rodzaju
  (w oknie Przeglądu w przyklejonej głowie sekcji) z menu **Zalecana** · **Najnowsze na górze** · **Najstarsze na
  górze**, na telefonie panel wysuwany **Kolejność**; przełącznik **Grupy**.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:f3bb5631 src/research-waiting.ts WaitingOrder, WAITING_ORDERS, waitingSince (at), sortWaitingByTime (stejný čas v pořadí výzkumu, bez času na konci), phaseRows (recommended = groupWaiting; skupiny podle první položky, Ostatní a Místa také; bez skupin FLAT_GROUP), waitingPhases (todo i sent) · src/live-time.ts formatWaitingSince (do hodiny relativně, dnes čas, včera, den, den s rokem) · src/ui/waiting-order-ui.ts WAITING_ORDER_KEY strom-live-overview-waiting-order, WAITING_GROUPS_KEY, storedWaitingOrder, watchWaitingOrderStorage (storage event), noteWaitingNew (todoWaiting, waitingSeen; strom bez záznamu nic nového), waitingSideEl, waitingGroupTagEl, ORDER_ICON · src/ui/research-overview-ui.ts overviewWaitingOrderEl (total >= 2; přepínač role switch jen v časovém pořadí a se skupinami; list na telefonu isPhoneBar / sheet) · src/ui/overview-columns-ui.ts (lepkavá hlava v okně) · src/ui/hypothesis-waiting-ui.ts (hlava a pata za fázi) · src/ui/live-section-prefs.ts waitingSeen, noteWaitingSeen · strings.ts live.waitingOrder, waitingOrderRec, waitingOrderNew, waitingOrderOld, waitingGroups, waitingNewTag, waitingNewCount, waitingSinceYesterday, waitingOtherGroup, places.waiting.group · e2e/overview-waiting-order.spec.ts · CHANGELOG.cs.md 3.30.0 „Pořadí v Čeká na vyřízení“ · spec 083 K5.1–K5.4, rozhodnutí H1–H5 · dirigent:test/vysledek-1116-app-103-odkazy-083-razeni.md · 3.32.0: app:5979d5c4 src/research-waiting.ts (gain: nejvyšší skóre, stejné v pořadí výzkumu, bez gain na konci; skupiny jako časové pořadí), src/research-link.ts (waiting[].gain jen s waiting.gain), src/ui/waiting-order-ui.ts, src/ui/research-overview-ui.ts (důvod pod řádkem jen v pořadí gain), f4050b1c (zalomení dlouhého slova) · strings.ts live.waitingOrderGain · research:44d3f750 src/core/waitgain.ts · dirigent:spec/105 K4.1 -->

<a id="S4.4.4"></a>
### S4.4.4 Czeka na załatwienie według księgi

Z badaniem, które zna księgi ([R6.8](R6-awaiting-action.md#R6.8)), pozycje **Czeka na załatwienie** można pogrupować
według księgi, której potrzebują. Przy księdze widać, ile zadań na nią czeka, co z niej można pobrać i gdzie zapisać
skany.

- **Grupy** (wybór obok kolejności):
  - **Archiwum**: grupy jak dotąd (miejsca, archiwa, **Pozostałe**, [S4.4.3](#S4.4.3));
  - **Księga**: w każdej fazie najpierw grupy ksiąg, potem pozostałe pozycje w grupach archiwów pod śródtytułem
    **Bez księgi** (tylko gdy jakaś księga jest). Księga pozycji to księga, na którą pozycja czeka, w przeciwnym razie
    jedyna księga, w której zadanie pracuje;
  - **Bez grup**: jedna lista (tylko przy kolejności według czasu, jak wyłączone **Grupy**).

  W kolejności **Zalecana** jest wybór **Archiwum** | **Księga**; grupy ksiąg stoją według swojej pierwszej pozycji,
  w kolejności według czasu według czasu pierwszej pozycji.
- **Kolejność Najwięcej zadań:** grupy są zawsze księgami (wybór grup znika).
  - na górze księgi do pobrania (brakuje im skanów albo liczba skanów nie jest znana), pod nimi księgi całe na
    dysku. W każdej części księgi idą od tej, której potrzebuje najwięcej zadań, przy równości więcej czekających,
    potem numer księgi. Tak samo jest posortowane **Szybciej dzięki pobraniu** ([S4.4.5](#S4.4.5));
  - gdy faza ma obie części, nad nimi stoją śródtytuły „Do pobrania · 2 księgi” i „Całe na dysku · 1 księga” (liczby
    w fazie). Przy jednej części śródtytułu nie ma;
  - pod kolejnością stoi zdanie „Na górze księgi, którym brakuje skanów: ich pobranie załatwia najwięcej zadań naraz.
    Księgi całe na dysku są niżej.” W menu kolejności **Najwięcej zadań** ma drugi wiersz „księgi do pobrania na
    górze”;
  - wewnątrz księgi pozycje są w kolejności **Zalecana**. Pozycje bez księgi są na końcu w grupach archiwów.
- **Pasek księgi** (jak pasek każdej grupy, [S4.4](#S4.4)):
  - tytuł księgi (z latami) cały, zawinięty, najwyżej na 3 wiersze (4 na telefonie) i **więcej**. Po prawej
    etykieta **Księga**, **nowe: N** przy zwiniętej księdze i liczba pozycji. Po najechaniu tytuł, archiwum i ile
    zadań potrzebuje księgi (w tym odłożone);
  - drugi wiersz: archiwum, całe;
  - trzeci wiersz: „12 zadań” (ile zadań potrzebuje księgi) · „3 czekają” · „+M w kolejce” (zadania księgi, które
    nie czekają) · „2 odłożone” · skany („240 skanów · na dysku 12 · brak 228”, księga cała na dysku „240 skanów ·
    cała na dysku”) · „N plików do przejęcia” (pliki, które leżą w folderze księgi i jeszcze nie zostały przejęte)
    · „strona archiwum wymaga logowania”. „W kolejce” i „odłożone” tylko powyżej zera. W kolejności **Najwięcej
    zadań** pogrubione są liczba zadań i „brak N”;
  - działania pod danymi: co można pobrać według warunków archiwum ([R6.8.1](R6-awaiting-action.md#R6.8.1)) – „Do
    pobrania cała księga · N skanów”, „Do pobrania skany 31–36 · 6 skanów” albo „Do pobrania wybrane skany …”;
    **Strona archiwum ↗**; **Otwórz folder księgi** (folder księgi w folderze współdzielonym, badanie otwiera go bez
    terminala i w razie potrzeby tworzy, [R6.8.2](R6-awaiting-action.md#R6.8.2)); **Czat** (nie na telefonie).
    Kliknięcie w działanie nie zwija księgi;
  - księga, której badanie nie wysłało w przeglądzie ksiąg: tylko tytuł (albo numer księgi), etykieta i liczba.
- **Wyszukiwanie** ([S4.4.2](#S4.4.2)) znajduje pozycje także według tytułu i archiwum ich księgi.
- **Mały panel:** przycisk kolejności i „Grupy: Księga ▾” z menu; pasek księgi tylko z tytułem (najwyżej 4 wiersze
  i **więcej**) i „N czeka”, pozycje na linii, śródtytuł **Bez księgi**; działania ksiąg są tylko w **Przeglądzie
  badania**. Liczby pozycji są takie same jak dotąd.
- **Granice:**
  - wybór **Księga** i kolejność **Najwięcej zadań** są tylko z badaniem, które wysyła księgi, i nie w Archiwum Strom
    ani w badaniu, które czeka na agenta. W przeciwnym razie wszystko wygląda jak wcześniej, a zapisany wybór
    **Księga** lub **Najwięcej zadań** pokazuje się jako **Archiwum** i **Zalecana**, bez nadpisania;
  - wybór grup zapamiętuje się na tym urządzeniu razem z kolejnością ([S4.4.3](#S4.4.3)).
- **Obsługa:** aplikacja: **Przegląd badania → Czeka na załatwienie**, obok przycisku kolejności przełącznik **Grupy**
  (**Archiwum** | **Księga** | **Bez grup**); na telefonie (także w poziomie) i w małym panelu przycisk
  „Grupy: Księga ▾” z menu (na telefonie panel wysuwany). Kolejność „⇅ … ▾” › **Najwięcej zadań**.
- **Księgę pozycji** określa badanie: czekające zadanie należy do księgi, którą trzeba przeszukać
  ([R6.8.4](R6-awaiting-action.md#R6.8.4)).
- **Obowiązuje od:** badanie 1.35.0, aplikacja 3.30.0

<!-- zdroj: app:7d7c0783 src/research-books.ts bookMetaParts (tasks · waiting · inQueue >0 · parked >0 · obrázky · pending · login), bookHeadImagesPieces (missing 0 → wholeOnDisk), research-overview-ui.ts overviewWaitingBookHead (archiv na vlastním řádku, akce v pásu, books.folderBook), research-ui.ts appendPanelWaitingBooks (název 4 řádky + víc, is-grouped) · app:1176f465 src/research-books.ts sortBooksMost (bookWholeOnDisk napřed false, pak tasks ↓, waiting ↓, číslo), research-waiting.ts phaseRows (part download / disk jen při obou částech, počty ve fázi), research-overview-ui.ts :1200 order-note books.mostNote, :1236 books.toDownload / onDiskAll, is-key (tasks, missing), table-headmenu.ts sub books.orderMostSub · strings.ts live.books.tasks, parked, wholeOnDisk, folderBook, toDownload, onDiskAll, mostNote, orderMostSub · research:8d19d4f6 src/core/books.ts bookOfTask (waitTarget) · ZADANI_DEV_knihy-zahlavi.md §1, §2, §4 -->
<!-- zdroj: app:224a1358, 7c39e663 src/ui/waiting-order-ui.ts shownWaitingGroups (most → book; book bez knih → archive; none v doporučeném → archive), waitingGroupModesFor, storedWaitingGroupMode (klíč přepínače Skupiny) · src/research-waiting.ts phaseRows (by book, afterBooks, most: sortBooksMost, uvnitř doporučené) · src/research-books.ts booksOn, bookOfItem, bookMetaParts, bookImagesText, bookOfferText (whole/range/selected), bookHeadTitle, bookWebUrl, sortBooksMost · src/ui/research-overview-ui.ts overviewWaitingBookHead (štítek Kniha, nové, počet, meta, is-key u most), overviewWaitingBookActions (nabídka, Web archivu, Otevřít složku book?do=folder, Chat), waitingGroupsChoiceEl (segment, compact/sheet) · src/ui/research-ui.ts appendPanelWaitingBooks (malý panel: název, N čeká, Bez knihy, akce jen v přehledu) · research:b1749433 src/core/live.ts /status books (feature books; ne archiv ani čekání na agenta), bookOfTask · strings.ts live.books · dirigent:spec/105-co-nejvic-pomuze U5, K5.1 · app:docs/ZADANI_DEV_knihy-ukolu.md §1–§2 -->

<a id="S4.4.5"></a>
### S4.4.5 Szybciej dzięki pobraniu

Księgi, których potrzebuje dość zadań i na które nic nie czeka, aplikacja proponuje do pobrania osobno. Skany
zapisane w folderze księgi agent czyta z dysku, szybciej i taniej. Nic na nie nie czeka, dlatego nie liczą się do
pozycji.

- **Co tam jest:** księgi, które badanie proponuje ([R6.8](R6-awaiting-action.md#R6.8): co najmniej `books.minTasks`
  zadań, coś można pobrać) i na które nie czeka żadne zadanie. Księga, na którą coś czeka, jest na liście jako grupa
  ([S4.4.4](#S4.4.4)). Kolejność jak **Najwięcej zadań**.
- **Podsekcja** **Szybciej dzięki pobraniu · N ksiąg** stoi na dole pod **Czeka na odpowiedź**, za pierwszym razem
  zwinięta:
  - zdanie „Skany zapisane w folderze księgi agent czyta z dysku – szybciej i taniej. Nic na nie nie czeka.”
    i odnośnik **Ustawienia…** (otwiera **Badanie dla drzewa** na grupie **Księgi**, [S4.4.6](#S4.4.6));
  - wiersz księgi: tytuł; archiwum · „N zadań w kolejce” · skany · „N plików do przejęcia” · logowanie; co można
    pobrać · **Strona archiwum ↗** · **Otwórz folder**. Kliknięcie w tytuł rozwija szczegóły: **Zadania** (w tym
    odłożone), **Folder**, **Dostęp**;
  - księgi ponad listę tylko liczbą: „i N kolejnych ksiąg jest w badaniu” (cała lista w terminalu,
    `strom task books`).
- **Granice:**
  - tylko z chipem rodzaju **Wszystko** i **Obrazy**; z wyszukiwaniem tylko księgi, których tytuł lub archiwum się
    zgadza;
  - pusta podsekcja się nie pokazuje. Pokazuje się także wtedy, gdy nic nie czeka (pod pustą sekcją);
  - nie liczy się do liczby sekcji, podsumowania, „Czeka N” ani małego panelu.
- **Mały panel:** pod listą wiersz „Szybciej dzięki pobraniu · N ksiąg ⤢”, który otwiera **Przegląd badania**
  z rozwiniętą podsekcją.
- **Obsługa:** aplikacja: **Przegląd badania → Czeka na załatwienie → Szybciej dzięki pobraniu**. Terminal:
  `strom task books` ([R6.8](R6-awaiting-action.md#R6.8)).
- **Obowiązuje od:** badanie 1.35.0, aplikacja 3.30.0

<!-- zdroj: app:bc8fc5fd src/research-books.ts urgentBooks (offer && waiting === 0, sortBooksMost), urgentBooksShown (filtr all/images, hledání název a archiv) · src/ui/research-overview-ui.ts appendOverviewBooksOffer (sectionPartOpen urgent, výchozí zavřený; urgentText, Nastavení… → openBooksSettings; more), overviewUrgentBookRow (detail Úkoly, Složka, Přístup) · src/ui/research-ui.ts renderLivePanel panelUrgent (showOverviewBooksOffer) · strings.ts live.books.urgent* · research:b1749433 src/core/live.ts booksStatus (offer, more) · ZADANI_DEV_knihy-ukolu.md §3, §5 -->

<a id="S4.4.6"></a>
### S4.4.6 Badanie dla drzewa › Księgi

Ustawienia ksiąg badania ([R6.8.3](R6-awaiting-action.md#R6.8.3)) można zmienić także w aplikacji. Zapisują się
przez most do badania, więc obowiązują tak samo jak w terminalu.

- **Grupa Księgi** (za **Czytaniem dokumentów**, w stanie zwiniętym podsumowanie „od 5 zadań · bez pierwszeństwa”):
  - **Księga proponowana od tylu zadań**: liczba całkowita od 1 do 999. Zapisuje się po opuszczeniu pola albo
    Enterze. Inna wartość pokazuje „Liczba całkowita od 1 do 999.” i nic się nie wysyła; puste pole przywraca
    zapisaną wartość. Wartość domyślna ma „(domyślnie)”, odnośnik **Przywróć domyślne (5)** ją przywraca;
  - **Pierwszeństwo pobranej księgi** (przełącznik): po zadaniu księgi, która jest na dysku, kolejka bierze następne
    zadanie tej samej księgi, najwyżej 5 sesji z rzędu ([R2.2.4](R2-lines-and-queue.md#R2.2.4)).
- **Zapis:** od razu po zmianie „Zapisywanie w badaniu…”, potem „Badanie potwierdziło. Dotyczy też zmian
  w terminalu.” Zajęte badanie: „Badanie jest teraz zajęte, nic się nie zmieniło.” i **Spróbuj ponownie**. Bez mostu
  grupa jest wyciszona. Zmiana z terminala przerysowuje okno, ale nie pole, w które właśnie się pisze.
- **Granice:** tylko z badaniem, które wysyła księgi; nie w Archiwum Strom ani w badaniu, które czeka na agenta. Gdy
  badanie w międzyczasie przełączy się na Archiwum Strom, grupa znika.
- **Obsługa:** aplikacja: **Badanie → Więcej → Badanie dla tego drzewa… → Księgi**, albo **Ustawienia…**
  w **Szybciej dzięki pobraniu** ([S4.4.5](#S4.4.5)). Terminal: [R6.8.3](R6-awaiting-action.md#R6.8.3).
- **Obowiązuje od:** badanie 1.35.0, aplikacja 3.30.0

<!-- zdroj: app:224a1358 src/ui/books-setting-view.ts (pole, (výchozí), Vrátit výchozí, přepínač) · src/ui/research-tree-settings-ui.ts showResearchTreeSettings group books, booksBody, překreslení mimo fokus · src/research-link.ts booksSettings, POST books (400 books.body, 409 directions.archive → skupina zmizí, 503 research.busy) · strings.ts researchTree.booksGroup, booksSum, minTasks*, sameBook*, resetDefault, booksOk, booksBusyErr, booksRetry · research:b1749433 src/core/live.ts POST /books · ZADANI_DEV_knihy-ukolu.md §4 -->

<a id="S4.4.7"></a>
### S4.4.7 Pozycja czekająca na skany

Otwarta pozycja, która czeka na skany, najpierw mówi, co dostarczyć i dokąd, a potem pokazuje kroki w kolejności,
w jakiej się je wykonuje. Wynikiem są pliki w folderze, a nie odpowiedź.

- **Których pozycji dotyczy:** zadanie czekające na skany (rodzaj **Obrazy**) i zadanie czekające na internet,
  któremu badanie dało folder księgi ([R6.8.4](R6-awaiting-action.md#R6.8.4)); tylko gdy skany można dodać przez
  most. Pozostałe pozycje są bez zmian.
- **Blok Dostarczyć** (na początku treści, przed **Czeka na**, [S4.4](#S4.4)): zdanie, które skany jako pliki i do
  którego folderu, na przykład „Skany 112–113 jako pliki (JPG lub PNG) do folderu księgi …” z tytułem księgi:
  - numery są te, których jeszcze brakuje; bez znanych numerów zdanie numerów nie ma („Skany jako pliki (JPG lub
    PNG) do folderu księgi …”);
  - folder księgi, gdy badanie ma go na liście ksiąg z folderem, a odnośnik do badania umie go otworzyć;
    w przeciwnym razie „… do folderu zadania”. Zdanie wymienia zawsze ten folder, który otwiera krok ②.
- **Kroki** (komputer i tablet), między nimi strzałki:
  1. **Strona archiwum ↗**: strona pozycji, w przeciwnym razie strona księgi albo jej archiwum;
  2. **Otwórz folder księgi** (badanie otwiera go bez terminala, [R6.8.2](R6-awaiting-action.md#R6.8.2)),
     w przeciwnym razie **Otwórz folder** zadania (otwiera badanie w terminalu, z oznaczeniem terminala);
  3. **Dodaj skany**: jedyne główne działanie, otwiera miejsce do przesłania skanów.

  Kroku, którego stąd nie da się wykonać, nie ma, a następny bierze jego numer. Strzałka nigdy nie przechodzi do
  innego wiersza niż krok, do którego prowadzi. Poniżej 380 px szerokości kroki są jeden pod drugim, bez strzałek.
  Przy dodawaniu skanów i pisaniu odpowiedzi kroki się chowają.
- **Pod blokiem:** stan skanów, miejsce do przeciągnięcia, osoba · kierunek i odnośnik **Skanów nie da się
  uzyskać…**. Otwiera on pole **Dlaczego skanów nie da się uzyskać** z podpowiedzią „Tu należy wpisać, dlaczego
  skanów nie da się dostarczyć lub czego brakuje w archiwum. Odczyt wpisu tu nie należy: badanie samo odczyta
  skany.” Wysłanie przywraca zadanie do kolejki jak każda odpowiedź ([R6.7](R6-awaiting-action.md#R6.7)). Pozostałe
  działania (**Omów z agentem** i inne, które badanie oferuje) są pod **⋯**.
- **Telefon:** tylko blok **Dostarczyć** ze zdaniem i „Skany zapisuje się na komputerze.”, bez kroków. **Skanów nie
  da się uzyskać…** otwiera panel wysuwany odpowiedzi z tym samym nagłówkiem i podpowiedzią.
- **Mały panel:** okno **Dodaj skany** zaczyna się tym samym blokiem z krokami jeden pod drugim; miejsce do
  przesłania pod nim jest ostatnim krokiem.
- **Obsługa:** aplikacja: **Przegląd badania → Czeka na załatwienie**, kliknięcie w pozycję ze skanami; w małym
  panelu **Dodaj skany**.
- **Obowiązuje od:** aplikacja 3.30.0
- **Od aplikacji 3.32.0 z badaniem 1.37.0:** przy zadaniu, które można zwrócić agentowi, pod blokiem stoją wiersz
  **Teraz** i **Spróbuj ponownie przez agenta**; jako główne działanie sprawia, że krok **Dodaj skany** jest
  obrysowany ([S4.4.14](#S4.4.14)).

<!-- zdroj: app:449e6962, 429839f0 src/ui/waiting-task-ui.ts waitingTakesImages (waitingActions images přes most), waitingAnswerTexts (answerImagesLabel, answerImagesHint), waitingDeliverEl (věta deliverSentence, phone → deliverPhone bez kroků, kroky deliverSteps web → folder → images, krok ② books.folderBook přes odkaz book jen s book.folder, jinak openFolder task?do=folder se značkou, ③ haveImages waiting-action--primary → openWaitingImages, deliver-pair šipka s krokem, is-column), panel dialog (column, upload: true, title haveImages) · src/research-waiting.ts waitingForImages (images, web s inbox), waitingDeliver (chybějící čísla jen u detail full; kniha jen ze seznamu se složkou), deliverSentence, deliverWebUrl (w.url, jinak bookWebUrl), deliverSteps · src/ui/research-overview-ui.ts appendWaitingTaskActions deliver (answer → link-button cannotGet, ostatní pod ⋯, na telefonu nic pod ⋯) · strings.ts live.waitingTask.deliverLabel, deliverBook, deliverTask, deliverBookAny, deliverTaskAny, deliverPhone, stepAria, cannotGet, answerImagesLabel, answerImagesHint · e2e/waiting-images.spec.ts, overview-waiting-books.spec.ts · ZADANI_DEV_knihy-zahlavi.md §5 · dirigent:prace/1117-app-knihy-zahlavi (D12, D13) -->

<a id="S4.4.8"></a>
### S4.4.8 Zadanie, które nie jest zapisane tak, jak trzeba

Badanie sprawdza przy czekających zadaniach, czy czekanie na skany jest zapisane tak, jak potrzebuje tego strom:
skany jednej księgi badania, jedna księga na zadanie ([R6.9](R6-awaiting-action.md#R6.9)). Gdy nie jest, zapisane
skany nie przywrócą zadania do kolejki. Aplikacja przy takiej pozycji pokazuje ustalenie i proponuje poprawkę
w jednym kroku. Pozycja czeka dalej, liczby się nie zmieniają.

- **Oznaczenie:** wiersz pozycji ma przed nazwą trójkąt ostrzegawczy z wykrzyknikiem (dymek i czytnik ekranu
  **Zadanie nie jest zapisane tak, jak trzeba**). W małym panelu jest tylko oznaczenie (**Zadanie nie jest zapisane
  tak, jak trzeba – otwiera się w przeglądzie**).
- **Blok w otwartej pozycji** (**Przegląd badania**, także w jego osobnym oknie): pod tekstem czekania i stanem
  skanów, nad działaniami pozycji, nagłówek **Zadanie nie jest zapisane tak, jak trzeba** i zdanie, co jest źle:

  | Ustalenie badania | Zdanie |
  |---|---|
  | skany tylko w tekście | **Skany zapisane tylko tekstem, bez księgi – zapisane skany nie wznowią zadania.** |
  | kilka ksiąg w jednym czekaniu | **Czeka na skany z kilku ksiąg**, z nieznaną księgą **; jednej z nich badanie nie zna.** |
  | księga, której badanie nie zna | **Badanie nie zna księgi – zadanie nie ma folderu na skany.** |
  | brakuje folderu | **Brakuje folderu na skany – poprawka go utworzy.** |

  Gdy badanie nie proponuje poprawki, a ma agenta, zdanie kończy się **Agent dodaje księgę do badania.** Ustalenie,
  którego aplikacja nie zna, ma tylko nagłówek.
- **Działania bloku:**
  - **Poprawić**, tylko gdy badanie proponuje poprawkę całą lub częściową: pokazuje podgląd poprawki
    ([S4.4.9](#S4.4.9));
  - **Omów z agentem** (oznaczenie AI i terminal, [S4.5.1](#S4.5.1)) otwiera rozmowę o zadaniu: agent dostaje
    ustalenie i proponuje poprawkę. Tylko przy badaniu z agentem, nie na telefonie. Przy pozycji z ustaleniem tego
    działania nie ma pod **⋯**;
  - **Pozostawić bez zmian** zapisuje od razu, bez podglądu, że czekanie jest właściwe tak, jak jest. Ustalenie znika,
    a powiadomienie **Ustalenie nie jest już proponowane** ma przez 8 s **Cofnij**. Badanie zaproponuje ustalenie
    ponownie, gdy czekanie zadania się zmieni.
- **Granice:**
  - badanie niedostępne (śledzenie się skończyło lub most nie odpowiada): **Poprawić** i **Pozostawić bez zmian** nie
    działają, a pod nimi stoi **Badanie jest niedostępne – poprawki nie można teraz zapisać.**;
  - ustalenie, które w międzyczasie zniknęło: powiadomienie **Ustalenie jest już nieaktualne – zadanie jest zapisane
    poprawnie.**;
  - kliknięcie tuż po przesunięciu wierszy (inne ustalenie zostało poprawione lub zniknęło) nic nie robi, żeby nie
    trafić w inną pozycję;
  - badanie bez tej kontroli: pozycje są jak dotąd, bez oznaczenia i bloku.
- **Obsługa:** aplikacja: **Przegląd badania → Czeka na załatwienie**, kliknięcie w pozycję z oznaczeniem. Terminal:
  `strom task audit` ([R6.9](R6-awaiting-action.md#R6.9)).
- **Obowiązuje od:** aplikacja 3.30.0, badanie 1.35.0

<!-- zdroj: app:929d7813, ed7f7a04, 287ebc72, 01a1e760 src/research-audit.ts TASKS_AUDIT_FEATURE tasks.audit, auditExplain (text; books + BooksUnknown; unknown; folder; agentAdds jen fix none s agentem; neznámý druh jen nadpis) · src/ui/waiting-task-ui.ts waitingAuditShown, waitingAuditMarkEl (trojúhelník, title), waitingAuditEl (auditFix jen fix ≠ none, discuss s researchLinkMark task chat jen s agentem a ne sheet, auditKeep), keepWaitingAudit (toast auditKept 8000 ms, Vrátit → unkeep), waitingAuditGone (auditGone), auditResearchUnavailable (ended, lostSince), shiftHeld · src/ui/research-overview-ui.ts:1899 značka v hlavičce, :2088 blok v detailu, :2192 a :2462 chat ne pod ⋯ · src/ui/research-ui.ts panel auditMarkPanel · strings.ts live.waitingAudit.* · CHANGELOG.cs.md 3.30.0 „Kontrola úkolu“ · ZADANI_DEV_kontrola-ukolu.md · dirigent:spec/109 K1.4–K1.6, prace/1117-app-109-kontrola (D1 složka, D2 neznámý kód) · app:cf12b70d auditKindBooks „z více knih“ -->

<a id="S4.4.9"></a>
### S4.4.9 Podgląd poprawki i Cofnij

**Poprawić** niczego od razu nie zapisuje. Najpierw pokazuje, co poprawka zmieni, a zapisuje dopiero drugim
**Poprawić** pod podglądem.

- **Podgląd** (w miejscu działań bloku; **Wczytywanie podglądu…**, dopóki badanie go nie przyśle):
  - **Co się zmieni**: **To zadanie** „będzie czekać na skany 112–113 z księgi …”, „będzie czekać na skany z księgi …;
    numery skanów nie są znane” lub „zostanie utworzony folder …”; **Nowe zadanie** dla każdej kolejnej księgi („dla
    skanów … z księgi …”, „dla księgi …”; przy księdze, której nie ma w badaniu, „księgi nie ma w badaniu, nowe
    zadanie dalej czeka jako tekst”);
  - **Co zostaje**: czego poprawka nie zrobi, na przykład „Księgi … brakuje w badaniu – agent ją uzupełni.” Przy
    pierwszej takiej księdze jest **Omów z agentem**;
  - pod podglądem „Poprawka zmienia tylko to, na co czeka zadanie, i można ją cofnąć.” i **Anuluj** · **Poprawić**.
    **Anuluj** lub Esc zamyka podgląd i zwraca fokus na **Poprawić** w bloku. Otwarty jest zawsze tylko jeden
    podgląd.
- **Po zapisaniu** (**Poprawianie…**): powiadomienie **Poprawiono** z **Cofnij** na 8 s. Gdy skany już leżą
  w folderze i zadanie ma je wszystkie, **Poprawiono – skany są już zapisane, zadanie jest kontynuowane.** **Cofnij**
  wycofuje poprawkę bez podglądu (**Cofnięto – zadanie czeka jak wcześniej.**). Gdy zadanie w międzyczasie się
  zmieniło, **Cofnięcie nie jest już możliwe – zadanie w międzyczasie się zmieniło.** Po zniknięciu powiadomienia
  poprawkę można cofnąć tylko w terminalu (`strom task audit T… --unfix`, [R6.9.1](R6-awaiting-action.md#R6.9.1)).
- **Granice:**
  - podgląd dotyczy zadania takiego, jakie było, gdy się pokazał. Gdy zadanie w międzyczasie się zmieniło:
    **Zadanie w międzyczasie się zmieniło.** **Podgląd nie odpowiada aktualnemu stanowi.** z **Wczytać ponownie**.
    Inne odmowy stoją pod podglądem: **Badanie właśnie zapisuje – ponowna próba będzie możliwa za chwilę.**,
    **Badanie jest zablokowane – poprawki nie można teraz zapisać.**, **Brak miejsca na dysku badania – poprawka nie
    została zapisana.**;
  - na telefonie (do 640 px) podgląd jest panelem wysuwanym od dołu z **Anuluj** · **Poprawić** na dole, bez **Omów
    z agentem**;
  - w osobnym oknie **Przeglądu badania** powiadomienie pokazuje okno główne.
- **Obsługa:** aplikacja: **Poprawić** w bloku **Zadanie nie jest zapisane tak, jak trzeba**; **Cofnij**
  w powiadomieniu.
- **Obowiązuje od:** aplikacja 3.30.0, badanie 1.35.0

<!-- zdroj: app:929d7813, ed7f7a04, 287ebc72, 01a1e760 src/ui/waiting-task-ui.ts openWaitingAuditFix (GET waiting/<T>/fix, auditLoading, jeden náhled), náhled (auditChanges, auditThisTask, auditNewTask, auditRemains, chat u první knihy, ne sheet; auditFixNote), confirmWaitingAuditFix (auditBusy, expect = stamp), writeWaitingAuditFix (toast auditFixed / auditFixedWoke 8000 ms, Vrátit = waitingWrite.undo), undoWaitingAuditFix (unfix, auditUndone, auditUndoFailed), cancelWaitingAuditFix (Esc, fokus na audit-fix), auditErrorText (409 auditErr409 + auditReload, 503, locked, disk), AUDIT_SHEET_ID (telefon) · src/research-audit.ts auditChangeLines (wait-images, wait-book, folder, split), auditLeftLines · src/research-link.ts postWaitingAudit (do fix/unfix/keep/unkeep, expect) · strings.ts live.waitingAudit.* · ZADANI_DEV_kontrola-ukolu.md §2 · dirigent:prace/1117-app-109-kontrola (D3 texty náhledu z op/images/title, D5 Vrátit jen v toastu) -->

<a id="S4.4.10"></a>
### S4.4.10 Badanie dla drzewa › Spisy ludności

Spisy ludności jako źródło badania ([R9.12](R9-archives.md#R9.12)) można włączać i wyłączać także w aplikacji. Zapis
idzie przez most od razu po kliknięciu, w obu kierunkach, i jest decyzją człowieka w aplikacji: okno systemu się nie
pokazuje.

- **Grupa Źródła** z przełącznikiem **Spisy ludności** i zdaniem „Badanie może używać spisów ludności jako źródła:
  gospodarstwo domowe w jednym roku pokazuje, kto mieszkał razem i skąd kto pochodził. Większość archiwów spisy tylko
  wyświetla, dlatego arkusze dostarcza się zwykle ręcznie jako zrzuty ekranu.”
- **Granice:**
  - tylko przy badaniu, które oferuje spisy ludności; przy starszym badaniu grupy nie ma. Nie w Archiwum Strom ani
    w badaniu, które czeka na agenta; gdy badanie w międzyczasie przełączy się na Archiwum Strom, grupa znika;
  - po kliknięciu nowy stan pokazuje się od razu, przerywany i zablokowany, dopóki badanie nie potwierdzi zapisu;
  - wyłączone z odłożonymi zadaniami ([R9.12.4](R9-archives.md#R9.12.4)): pod wierszem „Odłożone: 3 zadania spisu.
    Wrócą po włączeniu.”;
  - bez mostu przełącznik jest nieaktywny: „Badanie nie działa. Zmienić to będzie można, gdy zacznie działać.”;
  - odmowa podaje powód pod wierszem, a przełącznik zostaje, jak był (np. „Badanie jest teraz zajęte. Za chwilę będzie
    można spróbować ponownie.”, zablokowane badanie, pełny dysk).
- **Obsługa:** aplikacja: **Badanie → Więcej → Badanie dla tego drzewa… → Źródła → Spisy ludności**. Terminal:
  [R9.12](R9-archives.md#R9.12).
- **Obowiązuje od:** badanie 1.36.0, aplikacja 3.31.0

<!-- zdroj: app:6edc7dc7 src/research-link.ts CENSUS_FEATURE census, LiveCensus {on, held}, sanitizeCensus · src/history-bridge.ts postBridgeCensus, censusReply (held, invalid, archive 409 census.archive, busy, locked, full) · app:80d6358c src/ui/research-tree-settings-ui.ts renderResearchCensusRow (jen s funkcí census, ne archiv ani výzkum bez agenta, gone po 409; pend přerušovaně a zamčeno; censusHeld jen vypnuto a held > 0; bez mostu storiesBridgeDown), setResearchCensus · strings.ts history.censusSection, censusTitle, censusDesc, censusHeld, storiesBridgeDown, errBusy · e2e/research-census.spec.ts · research:c7b117cd src/core/live.ts POST /census (config set census --for-tree v prostředí aplikace, bez okna) · CHANGELOG.cs.md 3.31.0 „Sčítání lidu z výzkumu“ · dirigent:spec/106 K1.1, K1.4 -->

<a id="S4.4.11"></a>
### S4.4.11 Badanie dla drzewa › Materiały: pliki agent przejrzy sam

To, czy pliki wysłane do badania agent przejrzy sam ([R11.6](R11-material-from-the-user.md#R11.6)), można włączać
i wyłączać także w aplikacji. Zapis idzie przez most od razu po kliknięciu, w obu kierunkach, i jest decyzją
człowieka w aplikacji.

- **Grupa Materiały** z przełącznikiem **Pliki wysłane do badania agent przejrzy sam** i zdaniem „Pliki wysłane do
  badania (paczki, pojedyncze pliki, skany źródeł) dostają zadania dla agenta: przypisuje je do osób, nazywa je
  i zakłada źródła. Zużywa subskrypcję lub kredyt. Wyłączone: pliki czekają w Materiałach i są sortowane tylko na
  żądanie.” Domyślnie jest wyłączony.
- **Granice:**
  - tylko przy badaniu, które oferuje to ustawienie; przy starszym badaniu grupy nie ma i obowiązują dotychczasowe
    teksty. Nie w Archiwum Strom ani w badaniu, które czeka na agenta; gdy badanie w międzyczasie przełączy się na
    Archiwum Strom, grupa znika;
  - po kliknięciu nowy stan pokazuje się od razu, przerywany i zablokowany, dopóki badanie nie potwierdzi zapisu;
  - bez mostu przełącznik jest nieaktywny: „Badanie nie działa. Zmienić to będzie można, gdy zacznie działać.”;
  - odmowa podaje powód pod wierszem, a przełącznik zostaje taki, jak ma go badanie (zajęte lub zablokowane badanie,
    zapis trzyma ktoś inny, pełny dysk);
  - przełącznik dotyczy tego drzewa; to samo ustawienie dotyczy także zdjęć z telefonu ([S5.4](S5-phone.md#S5.4)).
- **Obsługa:** aplikacja: **Badanie → Więcej → Badanie dla tego drzewa… → Materiały → Pliki wysłane do badania agent
  przejrzy sam**. Terminal: [R11.6](R11-material-from-the-user.md#R11.6).
- **Obowiązuje od:** badanie 1.36.0, aplikacja 3.31.0

<!-- zdroj: app:74d06317 src/ui/research-tree-settings-ui.ts renderResearchIntakeRow (features intake.auto, /status.intake, researchAgentlessFor, storiesBridgeDown, pend), setResearchIntake (POST /intake, archive → gone, busy, held, locked, full) · src/research-link.ts postBridgeIntake · strings.ts history.intakeSection, intakeTitle, intakeDesc · research:src/core/live.ts POST /intake (intake.body, intake.archive), /status intake · dirigent:spec/130 K2.1 -->

<a id="S4.4.12"></a>
### S4.4.12 Badanie dla drzewa › Najwyżej agentów naraz

W oknie **Badanie dla tego drzewa…** pod wyborem agenta jest wiersz **Najwyżej agentów naraz**: ile przebiegów może
naraz pracować nad drzewem, przebieg całej kolejki i przebiegi linii razem
([R7.10.1](R7-when-the-agent-works.md#R7.10.1)).

- **Granice:**
  - pole z **−** i **+**, od 1 do pułapu, który podaje badanie (10); pod nim „Domyślnie 3. Liczy się też praca nad
    całą kolejką.”;
  - zmniejszenie aplikacja zapisuje od razu przez most. Zmniejszenie poniżej liczby trwających przebiegów żadnego nie
    zatrzyma; nowe się nie uruchomią;
  - zwiększenie z aplikacji nie jest możliwe: wartość wraca, a wiersz mówi „Zwiększyć można tylko w terminalu
    badania.” z poleceniem `strom config set run.parallel 4` do skopiowania;
  - przy pełnej liczbie są niedostępne **Uruchom agenta na tej linii** ([S4.3.3](#S4.3.3)) i **Praca nad kolejką…**
    ([S4.2.3](#S4.2.3)), a odnośnik **Ustawienia ›** otwiera to okno przy tym wierszu. Trwające przebiegi się nie
    zmieniają;
  - wiersza nie ma przy starszym badaniu (obowiązuje 3), w Archiwum Strom i przy badaniu czekającym na agenta.
- **Obsługa:** aplikacja: **Badanie → Więcej → Badanie dla tego drzewa… → Najwyżej agentów naraz**. Terminal:
  `strom config set run.parallel <n>`.
- **Obowiązuje od:** aplikacja 3.31.0 (badanie 1.36.0)

<!-- zdroj: app:4de0835a src/ui/research-tree-settings-ui.ts renderResearchRunsRow (pod dl.research-tree-agent; bez run.limit, v archivu a bez agenta se nekreslí; RUN_LIMIT_MIN 1, cap z výzkumu), setResearchRunsMax (POST settings/runs, 403 runs.raise → runsMaxRaise + příkaz) · src/research-runs.ts atRunLimit · strings.ts research.runsMax, runsMaxHint, runsMaxRaise, live.runsLimitReached, runsSettingsLink · research:src/core/live.ts runsLimitWrite, src/core/liveruns.ts runLimits (cap 10) · app:docs/ZADANI_DEV_beh-po-liniich.md §5 · dirigent:spec/126 K2.3 -->

<a id="S4.4.13"></a>
### S4.4.13 Badanie dla drzewa › Materiały: porządkowanie agentem bez pytania

W grupie **Materiały** okna **Badanie dla tego drzewa…** jest przełącznik **Porządkowanie agentem bez pytania**
([R11.5.3](R11-material-from-the-user.md#R11.5.3)). Wyłączyć go można w aplikacji od razu, włączyć w aplikacji po
potwierdzeniu albo w terminalu badania.

- **Przełącznik:** „Uporządkuj agentem… nie podaje kosztu przed każdym porządkowaniem; nadal startuje tylko po
  kliknięciu. Każde porządkowanie zużywa subskrypcję lub kredyt. Dotyczy tego drzewa.” Domyślnie jest wyłączony;
  pokazuje to, co mówi badanie.
- **Granice:**
  - wyłączenie aplikacja zapisuje przez most od razu, bez pytania;
  - włączenie najpierw pyta: **Porządkować agentem bez pytania?** „Porządkowanie nie prosi wtedy za każdym razem
    o potwierdzenie kosztu i zużywa subskrypcję lub kredyt agenta AI bez dodatkowego pytania. Dotyczy tego drzewa.”
    z **Włącz**. **Anuluj** nic nie zapisuje i przełącznik zostaje wyłączony. Po **Włącz** badanie zapisuje
    `sort.confirm no` dla tego badania, a do dziennika mostu jedną linię, że pytanie wyłączyła aplikacja Strom na tym
    komputerze;
  - włączyć z aplikacji można tylko w aplikacji na komputerze z badaniem i przy badaniu, które to oferuje. Inaczej
    badanie włączenie odrzuca: przełącznik zostaje wyłączony, a pod nim stoi „Nie włączono. Polecenie dla terminalu
    badania:” z poleceniem `strom config set sort.confirm no --for-tree` do skopiowania. Zdanie znika, gdy tylko
    badanie powie, że jest włączone. Badanie, które włączenia z aplikacji nie oferuje, ma w opisie przełącznika także
    zdanie „Włączyć można tylko w terminalu badania.”, a aplikacja wtedy wcześniej nie pyta;
  - włączony: okno **Uporządkuj agentem…** nie podaje kosztu; porządkowanie nadal startuje tylko jego przyciskiem,
    a etykieta AI i liczba plików zostają ([A3.5.8](A3-evidence-in-the-app.md#A3.5.8));
  - tylko z badaniem, które oferuje to ustawienie; nie w Archiwum Strom ani przy badaniu, które czeka na agenta. Bez
    mostu przełącznik jest nieaktywny jak przy **Pliki wysłane do badania agent przejrzy sam** ([S4.4.11](#S4.4.11)).
- **Obsługa:** aplikacja: **Badanie → Więcej → Badanie dla tego drzewa… → Materiały → Porządkowanie agentem bez
  pytania**. Terminal: `strom config set sort.confirm no|ask --for-tree`.
- **Obowiązuje od:** aplikacja 3.32.0 (badanie 1.37.0)

<!-- zdroj: app:7674ee44 src/ui/research-tree-settings-ui.ts sortConfirm, showSort (SORT_CONFIRM_FEATURE, /status.sort, ne bez agenta), setResearchSortConfirm (POST /settings/sort ask hned; 403 sort.raise → příkaz, přepínač vypnutý, dokud status neřekne no; bez mostu storiesBridgeDown) · src/research-link.ts postBridgeSortConfirm · src/ui/material-sort-ui.ts (no: bez ceny, jen tlačítkem, štítek AI a počet) · strings.ts history.sortConfirmTitle, sortConfirmDesc, sortConfirmRaise · research:5520e0ac src/core/live.ts POST /settings/sort (403 sort.raise {command}, 409 sort.archive), /status sort · dirigent:spec/102 U8 · zapnutí z aplikace: app:e02c706d switchResearchConfirm (s SORT_CONFIRM_APP_FEATURE showConfirm sortConfirmAskText/Title, confirmSwitchOn; Zrušit nic), raiseNote (403 sort.raise → sortConfirmRaise + příkaz), bez sort.confirm.app sortConfirmTerminalOnly a bez dialogu · strings.ts history.sortConfirmAskTitle, sortConfirmAskText, confirmSwitchOn · research:ce89202a src/core/live.ts sortConfirmWrite (lowersFrom: jen fetch prohlížeče na tomto počítači, jinak 403 sort.raise {command}), noteLive ui.live.unasked.sort · BRIDGE_FEATURES sort.confirm.app · dirigent:spec/123 P2 K2.1–K2.6 -->

<a id="S4.4.14"></a>
### S4.4.14 Spróbuj ponownie przez agenta

Pozycja, którą badanie pozwala zwrócić agentowi ([R6.7.3](R6-awaiting-action.md#R6.7.3)), mówi, dlaczego czeka teraz,
i ma przycisk **Spróbuj ponownie przez agenta**. Grupa archiwum z kilkoma takimi pozycjami zwraca je naraz.

- **Wiersz Teraz** (otwarta pozycja, zamiast uwagi o przeglądarce): **Teraz:** i powód według badania:
  - „Przeglądarka agenta wstrzymała pobieranie z … Po zezwoleniu na automatyczne pobieranie w profilu przeglądarki
    agenta agent zapisze je sam.” (bez znanej strony „… ze strony archiwum …”);
  - „Zapisywanie skanów zatrzymało się; sesja agenta zakończyła się w połowie.”;
  - „Przeglądarka agenta jest teraz gotowa; agent sam zapisze skany.”;
  - „Strona jest w przeglądarce archiwum, z której nie da się zapisać skanów: agent tylko odczyta je z ekranu,
    żaden skan nie zostanie zapisany.”;
  - rozszerzenie niepodłączone: „Z rozszerzeniem Claude in Chrome agent zapisałby skany sam. Po podłączeniu
    rozszerzenia zadanie można zwrócić agentowi.” i na komputerze odnośnik do rozszerzenia; agent bez przeglądarki:
    „Z Claude Code i rozszerzeniem Claude in Chrome agent zapisałby skany sam.”;
  - pozycja już zwrócona, która znów czeka, kończy się „– ponowiono 18:40, znów wstrzymane” (albo „znów czeka”);
    czas dziś, „wczoraj 18:40”, w przeciwnym razie z dniem i miesiącem.
- **Przycisk pozycji:** **Spróbuj ponownie przez agenta** z liczbą skanów, których zadaniu brakuje („· 2 skany”), przy
  stronie tylko do odczytu z ekranu „· tylko odczyt”; bez znanej liczby bez liczby.
  - Jest głównym działaniem, gdy agent może kontynuować od razu (wstrzymane pobieranie, zatrzymane zapisywanie,
    gotowa przeglądarka, odczyt z ekranu); krok **Dodaj skany** bloku **Dostarczyć** ([S4.4.7](#S4.4.7)) jest wtedy
    tylko obrysowany. Przy niepodłączonym rozszerzeniu albo agencie bez przeglądarki jest obrysowany obok głównego
    działania.
  - Przy bloku **Dostarczyć** stoi pod wierszem **Teraz**, w przeciwnym razie wśród działań pozycji.
  - Kliknięcie zwraca zadanie od razu, bez potwierdzenia: pozycja znika, a powiadomienie mówi „Zwrócono agentowi –
    zajmie się nim jako następnym.” (badanie właśnie pracuje), w przeciwnym razie „Zwrócono agentowi – pierwsze
    w kolejce; agent zajmie się nim przy następnym uruchomieniu.”
  - Odmowa stoi w wierszu pozycji: „Zadanie czeka teraz na coś innego; nie zwrócono.”, „Zadania nie można już
    zwrócić.”, „Badanie teraz nie odpowiada; nic nie zwrócono.”
- **Limit:** pozycja zwrócona 3× w ciągu 24 godzin ma zamiast przycisku „Można zwrócić agentowi ponownie jutro 9:12
  – 3 próby w ciągu 24 godzin.”
- **Grupa archiwum:** w pasku archiwum ([S4.4](#S4.4)) z co najmniej dwiema pozycjami, które można zwrócić teraz,
  stoi **Spróbuj ponownie wszystkie przez agenta (N zadań, M skanów)**, także przy zwiniętej grupie:
  - liczby dotyczą całej grupy, nie tylko pozycji, które pokazuje wyszukiwanie. Gdy któraś pozycja nie podaje liczby
    skanów, stoi „co najmniej M skanów”; gdy wszystkie są tylko do odczytu z ekranu, „tylko odczyt”; bez znanych
    skanów tylko „(N zadań)”. Pozycje przy limicie są za przyciskiem: „· 1 dopiero jutro 9:12”;
  - kliknięcie otwiera na miejscu pytanie „Zwrócić agentowi 2 zadania (5 skanów)? Trafią od razu na początek
    kolejki.” z **Zwróć** i **Anuluj** (także Esc). **Zwróć** zwraca naraz wszystkie pozycje grupy, które można
    zwrócić, albo żadnej; powiadomienie „Zwrócono agentowi: 2 zadania, od razu w kolejce.”, przy odmowie „Nic nie
    zwrócono: …”, a przycisk zostaje;
  - gdy dwie lub więcej pozycji grupy czeka z tego samego powodu, wiersz **Teraz** stoi raz w pasku, a pozycje go nie
    mają.
  - W grupach według księgi i przy pytaniach o miejsca przycisku grupy nie ma.
- **Telefon:** tylko wiersz **Teraz** i zdanie „Zwrot agentowi jest możliwy w aplikacji na komputerze.” (przy limicie
  zdanie limitu), bez przycisków; każda pozycja ma własny wiersz **Teraz**.
- **Granice:** tylko w **Przeglądzie badania** i jego osobnym oknie ([S4.1.6](#S4.1.6)), nie w małym panelu; tylko
  z badaniem, które umie zwrot. Ze starszym badaniem pozycja nie ma ani wiersza **Teraz**, ani przycisku. Agent
  przycisku nie uruchamia: zwraca tylko człowiek ([R6.6](R6-awaiting-action.md#R6.6)).
- **Obsługa:** aplikacja: **Przegląd badania → Czeka na załatwienie**, otwarta pozycja, **Spróbuj ponownie przez
  agenta**; w pasku archiwum **Spróbuj ponownie wszystkie przez agenta** · terminal: **Co czeka** → **Zwrócić
  agentowi** ([R6.7.3](R6-awaiting-action.md#R6.7.3)).
- **Obowiązuje od:** aplikacja 3.32.0 (badanie 1.37.0)

<!-- zdroj: app:c574752a, 3c6a554d, 75b71f5a src/research-waiting.ts waitingRetryReason (held/heldNoHost, stopped, ready, screen, no-extension waitNoExt + afterExt + extLink, agent-without-browser waitAgent, again → againHeld/againWaits), retryWhenText (dnes, včera, zítra, den a měsíc), waitingRetryCount, waitingRetryLimitText, waitingRetryMain (ne no-extension/agent-without-browser), waitingActions ctx.retry (jen přehled, ne telefon, w.retry.can), waitingGroupRetry (n, atLeast, readOnly, later), groupRetry*Text, waitingGroupRetryReason (≥ 2, stejné why+host) · src/ui/research-overview-ui.ts waitingRetryEl (Teď, limit, telefon R.phone, tlačítko primary/secondary), waitingRetryOffered (ne sheet, can, writes.retry), waitingGroupRetryOffer (ne sheet, ne kniha, ne místa, offer.n < 2 → nic, celá skupina s.waiting), waitingGroupRetryNow (ne telefon), browserNote jen bez w.retry · src/ui/waiting-task-ui.ts waitingDeliverEl retryMain (③ obrysová) · src/ui/research-waiting-write-ui.ts retryWaitingItem (doneRunning/doneIdle podle běhu, limit → can false, waitingRetryRefusedText) · src/ui/overview-window-ui.ts waiting-agent-retry, waiting-group-agent-retry · src/research-link.ts WAITING_RETRY_FEATURE · strings.ts live.waitingRetry, research.browser.waitNoExt, waitAgent · e2e/waiting-retry.spec.ts, waiting-retry-group.spec.ts · dirigent:prace/1124-app-089-zkusit-znovu (Výsledek, odchylky sub1–sub3), spec/089 K1.1–K3.1 -->

<a id="S4.4.15"></a>
### S4.4.15 Badanie dla drzewa › Uruchamianie agenta: start agenta bez potwierdzenia

W grupie **Uruchamianie agenta** okna **Badanie dla tego drzewa…** jest przełącznik **Start agenta bez
potwierdzenia**: ustawienie tego komputera `run.confirm` ([S4.5.5](#S4.5.5)) z aplikacji. Wyłączyć go można od
razu, włączyć po potwierdzeniu.

- **Przełącznik:** „Akcje aplikacji, które uruchamiają agenta, startują w terminalu badania bez potwierdzenia. Każde
  uruchomienie zużywa subskrypcję lub kredyt. Dotyczy wszystkich badań na tym komputerze.” Domyślnie jest wyłączony;
  pokazuje to, co mówi badanie.
- **Granice:**
  - dotyczy wszystkich badań na tym komputerze, nie tylko tego drzewa;
  - wyłączenie aplikacja zapisuje przez most od razu, bez pytania (`strom config unset run.confirm`);
  - włączenie najpierw pyta: **Uruchamiać agenta bez potwierdzenia?** „Akcje aplikacji, które uruchamiają agenta AI,
    startują wtedy w terminalu badania bez pytania i zużywają subskrypcję lub kredyt AI. Dotyczy wszystkich badań na
    tym komputerze.” z **Włącz**. **Anuluj** nic nie zapisuje i przełącznik zostaje wyłączony. Po **Włącz** badanie
    zapisuje `run.confirm no`, a do dziennika mostu jedną linię, że pytanie wyłączyła aplikacja Strom na tym
    komputerze;
  - włączyć można tylko w aplikacji na komputerze z badaniem. Inaczej badanie włączenie odrzuca: przełącznik zostaje
    wyłączony, a pod nim stoi „Nie włączono. Polecenie dla terminalu badania:” z poleceniem
    `strom config set run.confirm no` do skopiowania;
  - co potem uruchamia się bez pytania, a co nadal pyta, decyduje badanie ([S4.5.5](#S4.5.5)); pytanie z ceną
    w pieniądzach zostaje;
  - tylko z badaniem, które oferuje to ustawienie; nie w Archiwum Strom ani przy badaniu, które czeka na agenta. Bez
    mostu przełącznik jest nieaktywny jak przy **Pliki wysłane do badania agent przejrzy sam** ([S4.4.11](#S4.4.11)).
- **Obsługa:** aplikacja: **Badanie → Więcej → Badanie dla tego drzewa… → Uruchamianie agenta → Start agenta bez
  potwierdzenia**. Terminal: [S4.5.5](#S4.5.5).
- **Obowiązuje od:** aplikacja 3.32.0 (badanie 1.37.0)

<!-- zdroj: app:e02c706d src/ui/research-tree-settings-ui.ts runConfirm (RUN_CONFIRM_FEATURE, /status.work.confirm, ne bez agenta), renderResearchIntakeRow (fieldset runConfirmSection), switchResearchConfirm (vypnout hned; zapnout showConfirm runConfirmAskText/Title, confirmSwitchOn; Zrušit nic), setResearchRunConfirm (raise → raiseNote sortConfirmRaise + příkaz; archive → řádek pryč; bez mostu storiesBridgeDown) · src/history-bridge.ts postBridgeRunConfirm · strings.ts history.runConfirmSection, runConfirmTitle, runConfirmDesc, runConfirmAskTitle, runConfirmAskText, confirmSwitchOn, sortConfirmRaise · research:ce89202a src/core/live.ts POST /settings/run (ask: config unset run.confirm; no: jen fetch prohlížeče na tomto počítači, jinak 403 run.raise {command: strom config set run.confirm no}; 409 run.archive), noteLive ui.live.unasked.run · BRIDGE_FEATURES run.confirm · dirigent:spec/123 P2 K2.1–K2.6 -->

<a id="S4.5"></a>
## S4.5 Działania, które otwierają badanie

Większość działań badania w aplikacji to link `strom-research://`. Link otwiera terminal badania na tym samym
komputerze. Terminal mówi, o co prosi aplikacja, i pyta. Bez potwierdzenia w terminalu nic się nie zapisze ani nie
zapłaci. Wyjątkiem jest tylko praca agenta w ramach subskrypcji lub kredytu AI, gdy ten komputer jest tak ustawiony
([S4.5.5](#S4.5.5)).

- **Granice:**
  - Działanie jest widoczne tylko na komputerze (nie na urządzeniu dotykowym), tylko gdy badanie zgłosiło link i tylko
    gdy włączone jest **Strom Research na tym komputerze**.
  - Link niesie tylko numery rekordów i stałe wartości, żadnych imion ani nazwisk ani dowolnego tekstu.
  - Terminal zaczyna od **Prośba z aplikacji Strom: … / Badanie: …** i pyta **Kontynuować?** Przy pracy
    agenta dopisuje **Agent pracuje w ramach subskrypcji lub kredytu AI swojego konta.**, przy zlecaniu zadań
    **Badanie zapisze zadania dla agenta – teraz niczego się nie szuka i za nic się nie płaci.** Przy
    **Uruchamianie agenta z aplikacji Strom: bez potwierdzenia** praca agenta uruchamia się bez pytania
    ([S4.5.5](#S4.5.5)).
  - Archiwum Strom i badanie, które czeka na agenta, odrzucają pracę agenta (rozmowa, sprawdzenie, szukanie,
    miejsca, dzieje).
  - Gdy taka sama aktywna linia już jest, **Szukaj przodków** tylko mówi **Taka linia badania już jest: „…” –
    agent ją kontynuuje.**
  - Element, którym otwarto link, mówi **Otwieranie badania…** (przy pracy agenta **Otwieranie agenta…**, przy linku
    bez terminala **Wczytywanie…**), dopóki badanie nie potwierdzi, że link przejęło ([S4.5.4](#S4.5.4)), najwyżej
    10 s (praca nad kolejką 30 s, [S4.2.3](#S4.2.3)). Drugie kliknięcie w tym czasie niczego ponownie nie otwiera.
    Bez potwierdzenia element się zwalnia, a pod nim stoi **Terminal się nie otworzył?** ze **Spróbować ponownie**
    i radą **Jeśli nic się nie otworzyło, trzeba uruchomić Strom Research.** Przy linku bez terminala stoi **Jeśli
    nic się nie stanie, Strom Research jeszcze nie działa.** Badanie starsze niż 1.35.0 nie umie potwierdzić
    przejęcia: bez nowej sesji agenta element po 10 s zwalnia się po cichu, bez zdania.
  - Systemowego okna przeglądarki, które pyta przed otwarciem linku, aplikacja nie widzi. Potwierdzone późno samo
    usuwa zdanie po limicie ([S4.5.4](#S4.5.4)).
- **Obsługa:** aplikacja: **Ustawienia → Dane i prywatność → Strom Research na tym komputerze**.
- **Obowiązuje od:** aplikacja 3.4.0 (badanie 1.6.0). Odrzucenie w Archiwum Strom od badania 1.14.0, przy czekaniu
  na agenta od 1.15.0. Czekanie na otwarcie od aplikacji 3.30.0; do 3.29.0 aplikacja nie wiedziała, czy terminal się
  otworzył, i pokazywała tylko powiadomienie **Otwieranie badania…** z radą.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts researchLinkAvailable, launchResearchLink, :841 onComputer · strings.ts research.linksSetting, research.openingQuietHint · index.html linksSetting · research:v1.25.2 src/commands/links.ts:128 refusedHere, :153 inTerminal, :351 ui.research.exists · src/core/links.ts (hlavička) · assets/lang/cs.json ui.link.asks, ui.link.go, ui.link.cost, ui.link.tasks, ui.archive.refuse, ui.waiting.refuse · 3.30.0: app:574e7ef9, f63cc742 src/ui/research-ui.ts launchResearchLink → src/ui/research-open-busy.ts openResearchBusy (openingResearch / openingAgent / generic podle značky, BUSY_TIMEOUTS.terminal 10 s, queueWork 30 s, notOpened + notOpenedHint, bez terminálu research.openingQuietHint, retry) · strings.ts busy.* · CHANGELOG.cs.md 3.30.0 „Tlačítka, která čekají“ · ZADANI_DEV_tlacitka-cekani.md §3.1 · app:c3e09951 (79a05311) research-open-busy.ts unprovable → tichý konec u výzkumu bez handoffs (n1 N2) -->

<a id="S4.5.1"></a>
### S4.5.1 Oznaczenia działań

Każde działanie badania ma jedno z trzech oznaczeń według tego, co otwiera.

| Oznaczenie | Co się stanie | Działania |
|---|---|---|
| bez oznaczenia | nic nie otwiera terminala | **Śledź na żywo**, wycinek i oryginał w przeglądarce, wczytanie drzewa |
| terminal | terminal pokazuje lub pyta; kliknięciem nic się nie płaci | **Otwórz badanie**, wysłanie zmian, **Sprawdź ponownie…**, **Szukaj przodków**, **Odłóż**, **Porzuć**, akcje linii, **Dokończ i zakończ**, **Cofnij ostatnie wysłanie**, ustawienia, **Kontrola badania** |
| AI i terminal | praca agenta, płaci za nią subskrypcja AI | **Kontynuuj z agentem**, **Zapytaj agenta**, **Pracuj nad tą linią**, rozmowa o zadaniu lub sprzeczności, badanie miejsc, dzieje miejsca |

- **Granice:** przy pracy agenta element przy otwieraniu mówi **Otwieranie agenta…** ([S4.5](#S4.5)). Rozmowa może
  zamiast terminala otworzyć aplikację agenta, gdy badanie jest tak ustawione.
- **Obowiązuje od:** aplikacja 3.21.0. Do 3.29.0 aplikacja przy otwieraniu pracy agenta pokazywała powiadomienie
  **Otwieranie agenta…** z **Pytania zadaje się agentowi. Praca agenta zużywa subskrypcję AI.**
- **Od aplikacji 3.28.0:** **Praca nad kolejką…** i w jej oknie **Otwórz terminal** mają oznaczenie AI i terminal
  ([S4.2.3](#S4.2.3)). Wyszukiwanie w kolejce, **Zrób jako następne** i **Cofnij** są bez oznaczenia: idą przez most
  i nic nie otwierają ([S4.2.1](#S4.2.1), [S4.2.2](#S4.2.2)).

<!-- zdroj: app:v3.21.2 src/research-link.ts:66 RESEARCH_LINK_MARKS, researchLinkMark (task do=chat, conflict do=agent, experiment do=off, fixes paid) · strings.ts research.openingAgent, research.openingAgentHint · research:v1.25.2 src/commands/links.ts:373 whereToTalk · 3.28.0: app 9cf43b22 researchLinkMark('work') u queue-work-btn, research-item-queue-work, Otevřít terminál; ZADANI_DEV_fronta-hledani „Značení akcí“ · 3.30.0: app:574e7ef9 research-open-busy.ts busy.openingAgent na prvku; research.openingAgentHint se už nepoužívá -->

<a id="S4.5.2"></a>
### S4.5.2 Gdzie są działania

- **Menu Badanie** (tylko na komputerze, nie przy zablokowanym drzewie): na górze najwyżej 6 pozycji: **Czeka na
  załatwienie**, **Kontynuuj z agentem**, **Przegląd badania** lub **Śledź na żywo**, **Otwórz badanie**, wysłanie
  zmian. Pod tym **Wczytaj nową wersję**, **Narzędzia badania**, **Cofnij ostatnie wysłanie** (najwyżej sprzed 7 dni)
  i ustawienia badania. Na dole jest **kontynuacja w badaniu na tym komputerze. Nic nie zostanie zapisane ani
  opłacone bez potwierdzenia w nim.**
- **Narzędzia badania**: grupy **Przegląd**, **Zlecenie pracy**, **Uruchomienie agenta**. W 3.21.2 jest w nich tylko
  **Kontrola badania**.
- Menu osoby **Badanie ›** (tylko przy osobie, którą badanie zna): **Sprawdź ponownie…** (okno z zakresem: tylko
  osoba, z rodziną, z przodkami; **Kontynuacja w terminalu badania, gdzie zadania są widoczne i zatwierdzane. Za
  darmo.**), **Szukaj przodków**, **Szukaj potomków**, **Zapytaj agenta**.
- **Przegląd badania → Teraz**: przy pracującym agencie **Dokończ i zakończ**
  ([R7.3](R7-when-the-agent-works.md#R7.3)).
- W Archiwum Strom brakuje wszystkiego, co potrzebuje agenta, także **Śledź na żywo**.
- **Obowiązuje od:** aplikacja 3.4.0; górnych 6 pozycji od 3.14.0, **Narzędzia badania** od 3.19.0, **Dokończ
  i zakończ** od 3.5.0
- **Od aplikacji 3.28.0:**
  - w menu **Badanie** pod **Kontynuuj z agentem** jest pozycja **Praca nad kolejką…** ([S4.2.3](#S4.2.3)), gdy jest
    oferowana. Gdy na górze jest więcej niż 6 pozycji, do **Więcej działań** przenosi się jako pierwsze **Otwórz
    badanie**;
  - w **Teraz** działania stoją pod tekstem każdej sesji, w jednym wierszu: **Pokaż w drzewie** · **Dokończ
    i zakończ**. Na telefonie jest tylko **Pokaż w drzewie**.

<!-- zdroj: app:v3.21.2 src/ui/research-actions-ui.ts:152 UNDO_MAX_AGE_MS, :158 FIRST_LEVEL_MAX, :300 researchMenuShown, :435 tools, :1000 personResearchActions · src/research-link.ts:115 RESEARCH_TOOL_GROUPS, :132 RESEARCH_TOOL_ACTIONS · research-overview-ui.ts:811, :870 finishSession · strings.ts research.footerFull, research.tools.*, research.reviewWhere, research.continueAgent · 3.28.0: app 9cf43b22 src/ui/research-actions-ui.ts research-item-queue-work za research-item-chat (queueWorkMenuOffered), FIRST_LEVEL_MAX 6: research-item-open do more · 623d9c77 src/ui/research-overview-ui.ts overviewNowActions (now-actions pod textem: showInTree · finishSession, finish ne v sheet), overviewNowLine (každé sezení svůj řádek) · ZADANI_DEV_fronta-hledani §6 (varianta A) -->

<a id="S4.5.3"></a>
### S4.5.3 Otwarcie zadania w kolejce

**Otwórz zadanie T…** otwiera zadanie w kolejce w terminalu badania. Terminal pokazuje zadanie i pyta, co z nim teraz.

- **Granice:**
  - terminal pokazuje **Zadanie T… jest w kolejce: agent weźmie je, gdy przyjdzie jego kolej.**, **Dlaczego: …**
    i **Gotowe, gdy: …** i pyta **Co teraz?**:
    - **Przejść je z agentem (…) teraz, w rozmowie**: najpierw pyta i mówi, ile kosztowały tu podobne sesje, albo że
      tego jeszcze nie wiadomo;
    - **Przesunąć je w kolejce do przodu (najwyższy priorytet)**: priorytet 5; jeśli zadanie już go ma, nic się nie
      dzieje;
    - **Zostawić je w kolejce bez zmian**;
  - Enter lub 0 niczego nie zapisuje. Z zadaniem, nad którym agent właśnie pracuje, nic się nie dzieje;
  - zadanie, które czeka na człowieka, otwiera swoje dotychczasowe pytanie.
- **Obsługa:** aplikacja: **Otwórz zadanie T…** (oznaczenie terminal) po utworzeniu zadania z nowego odczytu i w wierszu
  przy źródle ([R8.8.3](R8-reading-scans.md#R8.8.3)). Terminal: `strom chat --task T…` bierze zadanie z kolejki od razu
  do rozmowy.
- **Obowiązuje od:** badanie 1.29.0, aplikacja 3.25.0
- **Od badania 1.36.0:** przy **Uruchamianie agenta z aplikacji Strom: bez potwierdzenia** rozmowa zaczyna się bez
  pytania tylko wtedy, gdy cena podobnych sesji nie jest jeszcze znana. Ze znaną ceną pyta dalej ([S4.5.5](#S4.5.5)).

<!-- zdroj: research:c2a690ea src/cli/menu-links.ts (odkaz task bez do, úkol open) · assets/lang/cs.json ui.link.open.title/why/done/pick/chat/ahead/keep/already/kept/busy/estimate/estimate.none, ui.chat.task.open.say · strom help chat (--task: „a task in the queue (open): gone through now, taken up in the conversation“) · commit 9bd14e84 · test/cli/link-open-task.test.ts · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 7; klik v aplikaci neověřen) · app:6bd8609e strings.ts read.openTaskN, src/__tests__/read-source-state-view.test.ts:75 (researchLinkMark task) -->

<a id="S4.5.4"></a>
### S4.5.4 Badanie potwierdza przejęty link

Badanie mówi aplikacji, że przejęło link: terminal się uruchomił albo działanie, które terminala nie potrzebuje, jest
wykonane. Aplikacja przestaje więc od razu czekać i odzywa się tylko wtedy, gdy nic się nie otworzyło
([S4.5](#S4.5)).

- **Pilnuje kod:**
  - aplikacja daje każdemu linkowi badania nowy numer przekazania (`&handoff=<uuid>`). Badanie przyjmuje tylko numer
    w postaci UUID; inną wartość po cichu pomija i wykonuje link jak bez niej. Z numeru nigdy niczego się nie
    uruchamia;
  - `strom link open` zapisuje numer do `.strom/handoffs/` w każdej kopii badania tego drzewa na komputerze. Przy
    linku, który otwiera terminal, od razu, gdy terminal się uruchomi, przed pierwszym pytaniem. Przy linku bez
    terminala (wycinek, skany, księga, śledzenie i inne) dopiero po wykonanym działaniu;
  - numer nie zostaje zapisany, gdy terminala nie udało się otworzyć, przy odrzuconym linku (nieznane badanie,
    archiwum, okno z komunikatem) ani przy linku do nowego badania z drzewa aplikacji (`new?app=…`): ten nie ma
    jeszcze badania ani mostu. Systemowe okno przeglądarki zamknięte bez otwarcia w ogóle nie uruchamia strom;
  - most badania podaje w `GET /status` (`handoffs`, także z `parts=1`) numery linków przejętych w ostatniej minucie,
    najnowsze pierwsze, najwyżej 64; starsze numery i ich pliki znikają. Czyta je przy każdym zapytaniu, nie dopiero
    gdy zmieni się stan badania. Dotyczy to także Archiwum Strom i badania, które czeka na agenta;
  - aplikacja po przekazaniu linku pyta most co sekundę aż do limitu. Potwierdzenie, które przyjdzie w ciągu minuty
    po limicie (okno przeglądarki potwierdzone późno), usuwa zdanie **Terminal się nie otworzył?**;
  - most, który na zapytanie sprzed niecałych 30 s nie odpowiedział, uchodzi za niedostępny: zdanie pokazuje się od
    razu, bez czekania;
  - ten sam link otwarty ponownie w ciągu 400 ms nic nie robi.
- **Granice:**
  - badanie bez potwierdzenia (starsze niż 1.35.0): za potwierdzenie uchodzi nowa sesja agenta. W przeciwnym razie
    element po limicie zwalnia się po cichu, bez zdania **Terminal się nie otworzył?**: aplikacja nie rozpozna, czy
    terminal się uruchomił. Most, który nie odpowiada, mówi to zdanie także tutaj. Praca nad kolejką ma własny dowód
    i zdanie ([S4.2.3](#S4.2.3));
  - link do nowego badania (`new?app=…`) kończy się po limicie po cichu; dalej aplikacja czeka, aż badanie przejmie
    drzewo;
  - bez działającego mostu nic się nie zgłasza, a zapisany plik sam wygasa.
- **Obsługa:** aplikacja: każde działanie z oznaczeniem terminal lub AI i terminal ([S4.5.1](#S4.5.1)). Terminal:
  `strom link open '<link>'`.
- **Obowiązuje od:** aplikacja 3.30.0, badanie 1.35.0

<!-- zdroj: research:fbae81fc src/core/handoffs.ts (HANDOFF tvar UUID, HANDOFF_MS 60 s, HANDOFF_MAX 64, handoffsNow úklid, noteHandoff) · src/core/links.ts parseLink (handoff malými písmeny, jiná hodnota vynechána), linkText · src/commands/links.ts link open noteTaken (tty hned; bez terminálu done: true; researchesWithId) · src/core/live.ts withHandoffs (/status i parts=1, mimo stav), BRIDGE_FEATURES handoffs · test/cli/link-handoffs.test.ts · CHANGELOG.cs.md 1.35.0 (odkaz aplikace Strom … výzkum aplikaci potvrdí) · app:574e7ef9, f63cc742 src/ui/research-open-busy.ts (handoffProven: handoffs s feature handoffs, jinak nové sezení; OPEN_ASK_MS 1000, OPEN_LATE_ASK_MS 2000, OPEN_LATE_WATCH_MS 60 s, OPEN_REPEAT_MS 400, bridgeDown 30 s, quietLimit new?app=) · src/research-link.ts HANDOFFS_FEATURE · app:docs/ZADANI_VYZKUM_tlacitka-cekani.md „Odpověď výzkumu“ · app:c3e09951 (79a05311) src/ui/research-open-busy.ts unprovable (poslední status bez feature handoffs → quietEnd: po limitu bez věty a bez pozdního hlídání; most dole → věta hned; opts.proof fronty beze změny) · dirigent:prace/1118-app-tlacitka-n1 (N2, Milan 18. 11.) -->

<a id="S4.5.5"></a>
### S4.5.5 Uruchamianie agenta z aplikacji bez potwierdzenia

Ustawienie tego komputera **Uruchamianie agenta z aplikacji Strom** decyduje, czy terminal przed pracą agenta, o którą
poprosiła aplikacja, zapyta **Kontynuować?** Domyślnie jest **z potwierdzeniem**: terminal mówi, o co prosi
aplikacja, że agent pracuje w ramach subskrypcji lub kredytu AI, i czeka na tak ([S4.5](#S4.5)). **Bez potwierdzenia**
praca agenta uruchamia się od razu, a terminal mówi o tym jedną linią: **▶ Uruchamianie bez potwierdzenia
(badanie …): …** i gdzie pytanie włącza się z powrotem.

- **Pilnuje kod:**
  - bez pytania uruchamiają się tylko działania, które uruchamiają agenta w ramach subskrypcji lub kredytu AI:
    rozmowa z agentem (także o osobie lub linii), rozmowa o zadaniu w kolejce ([S4.5.3](#S4.5.3)) lub w **Czeka na
    załatwienie**, sprzeczność pozostawiona agentowi ([R5.6](R5-conflicts.md#R5.6)), praca nad kolejką
    ([R7.1.2](R7-when-the-agent-works.md#R7.1.2)) i ustalanie miejsc;
  - nadal pytane są:
    - pytanie, które podaje cenę w pieniądzach: szacunek przy zadaniu w kolejce, ustalanie miejsc ze zmierzoną ceną
      sesji;
    - każdy link, który otwiera agent lub skrypt bez terminala człowieka;
    - wysłanie prośby, zgody archiwów i hostów (`strom allow`), usuwanie, zlecanie zadań agentowi i dzieje miejsca;
    - warunek samodzielnej pracy (`run.gate`): praca nad kolejką pyta go jak dotąd
      ([R7.4](R7-when-the-agent-works.md#R7.4), [R7.4.1](R7-when-the-agent-works.md#R7.4.1));
  - gdy w badaniu działa już inna sesja lub przebieg, nic więcej się nie uruchomi, także bez potwierdzenia;
  - ustawienie dotyczy wszystkich badań na tym komputerze, nie jednego drzewa. W Archiwum Strom menu go nie oferuje;
  - **bez potwierdzenia** włącza tylko człowiek: terminal mówi, co jest nadal pytane, i chce drugiego tak (Enter =
    nie). Gdy ustawienie zmienia agent lub polecenie bez terminala, człowieka pyta okno systemu; bez okna strom
    ustawienie odrzuca. Powrót do **z potwierdzeniem** może zrobić każdy, bez pytania;
  - aplikacja Strom pokazuje je i zmienia w oknie **Badanie dla tego drzewa…** przełącznikiem **Start agenta bez
    potwierdzenia** ([S4.4.15](#S4.4.15)); włączenie wymaga tam potwierdzenia w oknie aplikacji i działa tylko na
    komputerze z badaniem. Wartość pokazuje `strom config` i raport `strom error`
    ([R13](R13-reporting-a-problem.md#R13)).
- **Obsługa:** terminal: menu **Ustawienia** → **Język, agent, model, co agent może sam, opowieści… (kreator
  ustawień)** → **Uruchamianie agenta z aplikacji Strom: …** → **Pytać przed uruchomieniem (domyślnie)** lub
  **Uruchamiać bez potwierdzenia**; `strom config set run.confirm no`, z powrotem `strom config unset run.confirm`.
  Obowiązującą wartość pokazuje `strom config where`. Aplikacja: [S4.4.15](#S4.4.15).
- **Obowiązuje od:** badanie 1.36.0; 1.37.0 (aplikacja 3.32.0): włączyć i wyłączyć można także z aplikacji Strom na
  tym komputerze

<!-- zdroj: research:8aa0f374 src/core/config.ts run.confirm (ask|no, tree: false, env žádná), Settings.runConfirm · src/cli/menu-links.ts asksToStart (priced || runConfirm !== no || !ctx.interactive || isAgent → asks; jinak ui.link.noconfirm) u openTask (priced = taskEstimate), waitingDo chat, placesRun (priced = est.session.usd || fronta), workRun, workOn · src/commands/links.ts conflict do=agent, chat (direction/person) · placeSearch dál asks (placeCost), review/research ui.link.tasks dál asks · src/commands/setup.ts setUserSetting run.confirm no → requireHumanYes (ui.consent.run.confirm), FALLBACKS run.confirm ask · src/cli/context.ts requireHuman (terminál → humanYes, jinak okno systému, jinak odmítnutí) · src/cli/menu-settings.ts runConfirmStep (ui.runconfirm.*, ui.runconfirm.about; jen !archive), unset pro ask · src/core/report.ts CONFIG_PLAIN runConfirm · cs.json ui.settings.runconfirm, ui.runconfirm.*, ui.link.noconfirm · strom help link · CHANGELOG.cs.md 1.36.0 „Agent z aplikace Strom bez potvrzení“ · test/cli/run-confirm.test.ts, test/cli/gates.test.ts · spec 123 K1.1–K1.5 (K1.4 bez zápisu do logu výzkumu: rozhodnutí dirigenta 20. 11.) -->

<a id="S4.6"></a>
## S4.6 Co jest tylko w terminalu

Aplikacja pokazuje i prosi, terminal rozstrzyga. Co wymaga zgody człowieka lub kosztuje pieniądze, potwierdza się
zawsze w terminalu badania, nawet gdy zaczyna się kliknięciem w aplikacji.

- **Granice:**
  - Tylko w terminalu: uruchomienie samodzielnej pracy agenta i jej granice ([R7.1](R7-when-the-agent-works.md#R7.1)),
    warunek, wybór agenta, ustawienia kolejki i pozycje **Tylko tutaj w terminalu**
    ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
  - Potwierdza się w terminalu: wszystko z oznaczeniem terminal lub AI ([S4.5.1](#S4.5.1)), w 3.21.2 także akcje
    linii i kolejki. Od badania 1.36.0 pracę agenta bez ceny w pieniądzach można uruchamiać bez potwierdzenia
    ([S4.5.5](#S4.5.5)); włącza to tylko człowiek: w terminalu albo od aplikacji 3.32.0 z badaniem 1.37.0 po
    potwierdzeniu w aplikacji na komputerze z badaniem ([S4.4.15](#S4.4.15)).
  - Na telefonie linków nie ma; odpowiada się w badaniu na komputerze ([S5](S5-phone.md)).
- **Obowiązuje od:** aplikacja 3.4.0 (badanie 1.6.0)
- **Od aplikacji 3.22.0:** z badaniem 1.26.0 bez terminala działają linie ([S4.3.1](#S4.3.1)), praca poza liniami
  według gałęzi ([S4.3.2](#S4.3.2)) i miejsce zadania w kolejce ([S4.2](#S4.2)).
- **Od aplikacji 3.28.0:** z badaniem 1.32.0 o samodzielną pracę agenta nad kolejką można poprosić z aplikacji
  ([S4.2.3](#S4.2.3)). Uruchamia ją terminal badania dopiero po potwierdzeniu
  ([R7.1.2](R7-when-the-agent-works.md#R7.1.2)); warunek i jego ustawienie zostają w terminalu.

<!-- zdroj: research:v1.25.2 src/core/links.ts (hlavička: nic se nezapíše bez slova člověka v terminálu) · src/core/live.ts (hlavička mostu) · app:v3.21.2 src/research-link.ts:66 · HEAD src/research-directions-write.ts · 3.28.0: app 9cf43b22 src/ui/queue-work-dialog.ts (aplikace nic nespouští, odkaz work) · spec 052 K6.2 (cesta terminál) -->
