<a id="S7"></a>
# S7 Wiarygodność danych i weryfikacja według oryginałów

Przy każdej danej aplikacja pokazuje, jak jest wiarygodna, a karta w drzewie ma jeden znacznik za całą osobę. Badanie
potrafi zweryfikować daną według oryginału aktu: w tle, przy jednej danej, przy osobie albo w dużej części drzewa.
Pewność powstaje jednak dopiero wtedy, gdy **człowiek** sam porówna daną ze skanem aktu i ją potwierdzi (**Potwierdź
według skanu**, [S7.8](#S7.8)). Weryfikacja przez agenta daje najwyżej **Udokumentowane**; potwierdzenie przez człowieka
jest silniejsze i agent nigdy go nie zmienia. Rozdział opisuje aplikację Strom 3.26.0 i badanie 1.30.0; zmiany
z nowszej wersji mają przy sobie jej numer. Co działa tylko z mostem badania, a co także bez niego, podsumowuje
[S7.9](#S7.9). Imię i nazwisko osoby jako daną opisuje [S7.10](#S7.10).

<!-- zdroj: dirigent:spec/065-spolehlivost-a-znovu-overeni/spec.md · app:7b0471f8 CHANGELOG.cs.md 3.26.0 (Ověřit údaje, Jedna značka na kartičce) · research:6c6e7c3b CHANGELOG.cs.md 1.30.0 (ověření podle originálů) -->

<a id="S7.1"></a>
## S7.1 Znacznik przy danej w karcie osoby

W karcie osoby każda dana ma znacznik: kto ją potwierdził lub udokumentował, jak pewne jest badanie albo że przyszła
z drzewa innego programu i nikt jej nie sprawdził. Stopnie różnią się znakiem ✓, kropkami i ramką, nigdy tylko
kolorem.

| Znacznik | Znaczenie (opis po najechaniu) |
|---|---|
| **Potwierdzone** (✓) | **Potwierdzone przez człowieka**: daną potwierdził ze skanem, wpisał lub przywrócił człowiek albo przyjął propozycję badania |
| **Udokumentowane** (●●) | **Udokumentowane przez AI: dwóch czytelników zapisu zgodnie** |
| **Udokumentowane** (●○) | **Udokumentowane przez AI: jeden czytelnik zapisu** |
| Prawdopodobne, Możliwe, Wskazówka | stopień pewności badania ([R3.1](R3-verification-and-citation.md#R3.1)) |
| **Z drzewa** (○○) | przejęte z drzewa innego programu albo z drzewa z aplikacji Strom, które przejęło badanie; niezweryfikowane ([S6.2](S6-tree-from-another-program.md#S6.2)) |

- **Podpowiedź przy znaczniku** (po kliknięciu): źródła danej; przy dwóch czytelnikach **dwóch czytających
  zgodnie**; przy danej, która po weryfikacji została prawdopodobna lub możliwa, wiersz „Pozostaje {stopień} · badanie
  sprawdziło {data}” i powód, dlaczego nie dało się jej udokumentować; przy potwierdzonej „✓ Potwierdzone
  według skanu {data}”; przy danej z drzewa, którą drzewo cytuje, **cytowane w drzewie, w Strom
  niezweryfikowane**. W podpowiedzi są też akcje **Zweryfikuj** ([S7.3](#S7.3)), **Potwierdź według skanu** i **Cofnij**
  ([S7.8](#S7.8)), gdzie mają zastosowanie.
  Od aplikacji 3.27.0 każde źródło w dymku ma wiarygodność cytatu przy tej danej (**Oryginał**, **Odpis /
  indeks**, **Niepewne**), nie domyślną wiarygodność źródła ([A2.6.1](A2-loading-a-family-tree.md#A2.6.1)).
- **Pilnuje kod:**
  - dwie kropki dostaje tylko dana, przy której podczas weryfikacji przez badanie zgodzili się dwaj czytelnicy aktu
    ([R8.8.1](R8-reading-scans.md#R8.8.1)); udokumentowana inaczej ma jedną;
  - ✓ daje tylko człowiek: potwierdzeniem według skanu albo tym, że sam wartość zapisał, zmienił, przywrócił albo
    przyjął propozycję badania. Dana, którą badanie przejęło z drzewa z aplikacji Strom i której od tej pory nikt nie
    zmienił, ma znacznik według stopnia pewności, bez stopnia **Z drzewa** (○○); ✓ nigdy
    ([S6.3](S6-tree-from-another-program.md#S6.3));
  - znaczniki drzewa badania są takie same z mostem i bez niego, także zaraz po wczytaniu strony: aplikacja bierze je
    z zapisanego drzewa, nie z działającego mostu;
  - potwierdzenie przez człowieka obowiązuje tylko dopóty, dopóki dana ma potwierdzoną wartość ([S7.8](#S7.8)).
- **Granice:** znacznika **Bez źródła** przy danej aplikacja jeszcze nie pokazuje: dana bez źródła jest bez znacznika.
  Osobę bez źródła pokazuje znacznik na karcie ([S7.2](#S7.2)).
- **Obsługa:** karta osoby → znacznik przy danej; pomoc **Co oznaczają znaczniki**. **Ustawienia → Karta osoby →
  Wiarygodność przy danych w karcie osoby** (domyślnie włączone).
- **Obowiązuje od:** aplikacja 3.26.0, badanie 1.30.0

<!-- zdroj: app:7b0471f8 src/reliability.ts (RELIABILITY_ORDER, reliabilityStep: readers ≥ 2 → dvě tečky; noSource se z aplikace nekrmí, verifyLocalEvidence dává jen confirmedByHuman) · src/verify.ts factVerifyReaders (_STROM_CHECKED proven, readers) · src/ui/fact-status.ts titleProven2/titleProven1 · src/ui/status-tip.ts readersAgree · 3.27.0: app:dde0151a src/ui/status-tip.ts factSourcesModel, sourceSub(quality citace) · src/settings.ts display.reliabilityCard (ON) · index.html settings-group-card · strings.ts reliability.*, verify.reasonHead, verify.confirmedAt · app:669c08f0 src/reliability.ts userTreeOrigin (_STROM_ORIGIN tree → import, nikdy human), treeOriginWords, reliabilityOptionsOf (původ z dat stromu, ne z mostu) · research:94d75934 src/core/model.ts ValueOrigin.tree, src/core/import.ts (soubor aplikace Strom → user + tree) -->

<a id="S7.2"></a>
## S7.2 Jeden znacznik na karcie w drzewie

Karta osoby w drzewie ma w prawym dolnym rogu jeden znacznik: jak udokumentowana jest osoba i kto stoi za jej danymi.
Bierze najsłabszą z trzech danych karty: imię, urodzenie i zgon.

| Znacznik | Kiedy |
|---|---|
| ✓ | daną potwierdził człowiek |
| ●● | udokumentowane, bez względu na liczbę czytelników |
| ●○ | prawdopodobne lub możliwe z cytatem oryginału albo odpisu z informacją pierwotną (jakość 2 lub 3) |
| ○ | tylko ślad: wskazówka albo prawdopodobne lub możliwe bez takiego cytatu |
| ○○ (linią przerywaną) | z drzewa (innego programu albo z aplikacji Strom, przejętego przez badanie), niezweryfikowane |
| kropkowana ramka | bez źródła |

- **Pilnuje kod:**
  - liczą się tylko dane, które mają stopień; gdy nie ma go ani imię, ani urodzenie, ani zgon, rozstrzygają pozostałe
    dane osoby i jej rodzin (miejsce zamieszkania, zawód, ślub): wystarczy jedna dana potwierdzona lub udokumentowana
    albo cytat jakości 2 lub 3, a znacznik to ●○ (osoba jest znana z aktu, na przykład jako ojciec w chrzcie
    dziecka);
  - od aplikacji 3.27.0 jakość cytatu to jego własna wiarygodność, w przeciwnym razie domyślna wiarygodność źródła
    ([A2.6.1](A2-loading-a-family-tree.md#A2.6.1)): to samo źródło może być przy zawodzie cytatem jakości 3, a przy
    urodzeniu jakości 2. Zapis zmiany od badania, który nie jest cytowany przy danej, liczy się według swojego źródła;
  - drzewo badania, którego zapisane dane niosą pochodzenie danych od badania, ma znacznik według stopni zaraz po
    wczytaniu strony, taki sam z mostem i bez niego; dotyczy to też drzew zapisanych wcześniej;
  - drzewo, które nie zna pochodzenia danych (bez badania i bez importu z innego programu), pokazuje znacznik według
    cytatów osoby: ●● udokumentowane, ●○ częściowo udokumentowane, kropkowana ramka bez źródła. Drzewo bez źródeł
    i bez pochodzenia znacznika nie ma;
  - osoba zastępcza („?”) znacznika nie ma.
- **Podpowiedź przy znaczniku:** „Najsłabsza dana karty: …” i słowami, co znacznik oznacza.
  - **Od aplikacji 3.31.0:** przy znaczniku **Z drzewa** nagłówek „Cytowane w drzewie, w Strom niezweryfikowane”
    stoi tylko nad źródłami cytowanymi wyłącznie przy danych z drzewa (np. przy imieniu i nazwisku). Źródło cytowane
    przy udokumentowanym urodzeniu lub zgonie (księga metrykalna, nawet gdy cytuje ją zarazem imię i nazwisko) stoi
    pod własnym nagłówkiem **Źródła (N)**. Wcześniej pod nagłówkiem z drzewa stało każde źródło karty. Gdy
    o znaczniku decyduje imię i nazwisko, podpowiedź prowadzi linkiem **Imię w karcie osoby ›** do znacznika imienia
    i nazwiska w karcie osoby ([S7.10](#S7.10)).
- **Obsługa:** **Ustawienia → Karta osoby → Na karcie pokazuj → Udokumentowanie i wiarygodność** (domyślnie
  włączone).
- **Obowiązuje od:** aplikacja 3.26.0
- **Od aplikacji 3.28.0:** przy oddaleniu drzewa poniżej 0,55 znacznik jest większy (ok. 10 px na ekranie), poniżej
  0,3 nie jest rysowany. Wiersz karty (imię i nazwisko, daty) kończy się „…” przed powiększonym znacznikiem tylko tam,
  dokąd znacznik przy danym powiększeniu sięga; wiersze nad nim zostają całe, a poniżej 0,3 całe są wszystkie. Imiona
  i nazwiska układają się jak przy 100 %, więc po ponownym przybliżeniu nie zostają zwężone.

<!-- zdroj: app:7b0471f8 src/reliability.ts CARD_STATUS_FACTS, CardStatusClass, cardStatusClassOfFact, otherFactsClass, card status bez původu (full/partial/none) · src/ui/card-signals-ui.ts (signál status, CARD_SIGNAL_DEFAULTS vše zapnuto) · 3.27.0: app:dde0151a src/reliability.ts citesSourceRead (FactCitationRef, citationQuality; holé id = záznam změny výzkumu podle pramene), cardFactCitations, withChangeRecord · strings.ts cardDensity.cardShow, cardStatus, cardStatusSub, cardShowHint, reliability.cardFacts, cardMark.* · CHANGELOG.cs.md 3.26.0 (Jedna značka na kartičce) · app:669c08f0 src/reliability.ts reliabilityOptionsOf, treeOriginWords (strom výzkumu s původem v datech: stejně s mostem i bez) · 3.28.0: app c0bc007f src/zoom.ts ZOOM_FAR 0.55, ZOOM_TINY 0.3 · index.html #tree-canvas.zoom-far .card-status-mark (scale 0.85 / zoom), .zoom-tiny skrytá, --mark-gap, --far-step (okraj jen u řádků, kam značka dosáhne), text-overflow ellipsis · src/renderer.ts fitCardNames (jako při 100 %), markGapRows · dirigent:prace/1113-app-drobnosti-1112 §5 -->

<a id="S7.3"></a>
## S7.3 Zweryfikuj przy danej

Przy urodzeniu, chrzcie, ślubie, zgonie i pogrzebie, które nie są udokumentowane ani potwierdzone, podpowiedź
znacznika oferuje **Zweryfikuj**. Badanie weryfikuje wtedy daną według oryginału aktu: w tle, poza pracą nad liniami.

- **Podgląd przed uruchomieniem** (**Zweryfikuj {dana}**):
  - **Co** się weryfikuje;
  - **Jak**: „AI odczyta zapis {zapis}” (akt jest znany, tanio · jeden znany zapis) albo „AI szuka zapisu według
    cytatu w drzewie ({cytat}) i go odczyta”, ewentualnie „AI szuka zapisu w księgach i go odczyta” (drożej · zapis
    trzeba dopiero znaleźć);
  - **Szacunek**: mniej więcej ile sesji agenta to zajmie;
  - „Działa w tle badania. Wynik pojawi się przy danej.” Przy wyszukiwaniu ponadto „Jeśli zapis się nie znajdzie,
    dana pozostanie z drzewa, a podpowiedź powie dlaczego.”
- **Po uruchomieniu** (**Rozpocznij weryfikację**) dana ma znacznik z zegarem „Czeka na weryfikację · {pozycja}.
  w kolejce badania” i **Zweryfikuj** nie jest przy niej ponownie oferowane.
- **Zweryfikuj w pierwszej kolejności:** dana, którą badanie samo dodało do kolejki weryfikacji ([S7.6](#S7.6)) i która
  nie jest następna w kolejce, ma w podpowiedzi **Zweryfikuj w pierwszej kolejności**. Następuje ten sam podgląd
  z szacunkiem co przy **Zweryfikuj**; po **Rozpocznij weryfikację** badanie przesunie zadanie z tą daną na początek
  kolejki, a podpowiedź pokaże pozycję, którą badanie odpowie („1. w kolejce badania”).
  - **Od badania 1.31.0:** zadanie, które człowiek tak przesunął, jest w pliku dla aplikacji, w stanie mostu
    (`/status`) i w liczbach `strom verify status` prowadzone jako zlecone przez człowieka (`asked`), dopóki nie
    skończy się sesja nad nim. Aplikacja nie oferuje wtedy przy danej **Zweryfikuj w pierwszej kolejności** ponownie
    po odświeżeniu; wcześniej oferowała. Dotyczy to także całej osoby ([S7.4](#S7.4)).
- **Pilnuje kod:**
  - weryfikacja, o którą poprosił człowiek, idzie w kolejce badania pierwsza ([R2](R2-lines-and-queue.md));
  - **Zweryfikuj** jest oferowane tylko przy drzewie powiązanym z badaniem, gdy most działa, a badanie potrafi
    weryfikować ([S7.9](#S7.9));
  - imienia, płci, rozwodu i pozostałych zdarzeń się nie weryfikuje. **Od aplikacji 3.31.0 z badaniem 1.36.0**
    weryfikuje się także imię i nazwisko ([S7.10](#S7.10));
  - **Zweryfikuj w pierwszej kolejności** nie jest oferowane przy danej, o której weryfikację człowiek już poprosił
    (jest w kolejce pierwsza), przy danej czekającej na skany lub na zgodę archiwum, przy następnej w kolejce i gdy
    badanie nie podaje pozycji danej. Zadania, nad którym agent właśnie pracuje, badanie nie przesuwa.
- **Granice:** drzewo bez badania ma w podpowiedzi zamiast akcji wiersz „Z badaniem przodków agent AI sam zweryfikuje
  daną w księgach.” Gdy badanie nie odpowiada: „Nie udało się rozpocząć weryfikacji; badanie nie odpowiada.”; gdy nie
  ma czego weryfikować: „Badanie nie ma tu teraz nic do zweryfikowania.” Gdy badanie odrzuci weryfikację, podpowiedź
  mówi dlaczego, na przykład że badanie jest archiwum, że już nie ma tej danej albo że jest teraz zajęte.
- **Obsługa:** aplikacja: karta osoby → znacznik danej → **Zweryfikuj** (albo **Zweryfikuj w pierwszej
  kolejności**) → **Rozpocznij weryfikację**. Terminal: `strom verify facts P…|F…|E… [--fact …] [--dry-run]`.
- **Obowiązuje od:** badanie 1.30.0, aplikacja 3.26.0
- **Od aplikacji 3.31.0:** podgląd zamiast „Działa w tle badania. Wynik pojawi się przy danej.” mówi „Weryfikacja
  nastąpi podczas pracy badania. Wynik pojawi się przy danej.” Weryfikacja nie czeka w tle, bierze ją sesja badania.

<!-- zdroj: app:f19d34cb strings.ts verify.previewNote (065 K7.3) · app:7cf409bd src/verify-offer.ts verifyOffer (prioritize: pending wait, position > 1, step, researchVerifies) · src/verify-ui-model.ts factOffer (čekání spuštěné tady: position null) · src/ui/verify-ui.ts (tlačítko prioritize → verifyOpenPreview; verifyStart: pozice z odpovědi) · strings.ts verify.prioritize, verify.pending · research:a4a2f6c0 src/core/verify.ts verifyAsk (držený úkol → queueAt next; doing nebo už next beze změny), verifyWait (wait / asked / images / permission, position) · app:7b0471f8 src/verify-offer.ts verifyOffer (Verify jen u nedoložených, s feature verify, ne archiv, ne čekající; cost low/high) · src/verify-ui-model.ts verifyFactKind (BIRT, BAPM, MARR, DEAT, BURI) · strings.ts verify.btn, previewHead, what, how, estimate1, howRead, howSearch, costLow, costHigh, sessions, previewNote, previewNoteSearch, start, pending, failed, nothing, noResearch · app:669c08f0 strings.ts verify.busy, locked, whyArchive, whyRetracted, whyGone, whyMerged, whyOld, whyRefused (odmítnutí podle kódu) · research:6c6e7c3b strom help verify facts (první ve frontě; bez přečteného originálu se záznam hledá) · research:4ac323ef src/core/verify.ts askedFor (úkol přeřazený člověkem, queueAt next, do konce sezení na něm → asked v souboru, /status, verify status) · app:src/verify-offer.ts (asked: Verify first se nenabízí) · CHANGELOG.cs.md 1.31.0 -->

<a id="S7.4"></a>
## S7.4 Zweryfikuj dane przy osobie

Wszystkie niezweryfikowane dane jednej osoby można wysłać do weryfikacji naraz: przyciskiem **Zweryfikuj dane (N)**
w karcie osoby i w podpowiedzi znacznika na karcie w drzewie albo pozycją **Zweryfikuj dane · N** w menu osoby.

- **Gdzie:**
  - karta osoby: przycisk **Zweryfikuj dane (N)** nad sekcją **Zdarzenia**. Gdy osoba nie ma nic do zaoferowania
    do weryfikacji, ale jej dane czekają na weryfikację, zamiast przycisku jest tam „N danych czeka na weryfikację”;
    w przeciwnym razie nie ma tam nic;
  - podpowiedź znacznika na karcie w drzewie ([S7.2](#S7.2)): **Zweryfikuj dane (N)**, tak jak w karcie osoby;
  - menu osoby: **Zweryfikuj dane · N**, w trakcie weryfikacji **Weryfikacja · N**.
- **Okno Zweryfikuj dane osoby:** „{imię} · N niezweryfikowanych danych”, lista danych do zaznaczenia, przy każdej
  **tanio** albo **drożej**, „Szacunek: {n} tanio, {n} drożej” („Tanio = odczytać znany zapis. Drożej = zapis trzeba
  znaleźć.”) i przycisk **Zweryfikuj (N)** według zaznaczonych. Po uruchomieniu „N danych czeka w kolejce do
  weryfikacji.”, a pozycja w menu pokazuje **Weryfikacja · N**.
- **Zweryfikuj w pierwszej kolejności dla całej osoby:** gdy osoba nie ma nic do zaoferowania do weryfikacji, a któraś
  z jej danych czeka dalej w kolejce tak, jak ją badanie samo dodało, menu osoby ma pod **Weryfikacja · N** pozycję
  **Zweryfikuj w pierwszej kolejności**, a podpowiedź znacznika na karcie w drzewie pod „N danych czeka na
  weryfikację” przycisk **Zweryfikuj w pierwszej kolejności**. Otwiera podgląd osoby z tym tytułem; po uruchomieniu
  badanie przesunie zadania z czekającymi danymi osoby na początek kolejki ([S7.3](#S7.3)). Karta osoby ma nadal tylko
  wiersz „N danych czeka na weryfikację”.
- **Pilnuje kod:** N to dokładnie to, co weźmie badanie: dane osoby i jej rodzin, które badanie zna (także dane już
  udokumentowane przez innego czytelnika), poza potwierdzonymi przez człowieka, czekającymi na weryfikację, imieniem
  i płcią. Liczba w menu, w oknie i w komunikacie po uruchomieniu jest taka sama.
  - **Od aplikacji 3.31.0 z badaniem 1.36.0:** N liczy także imię i nazwisko ([S7.10](#S7.10)).
  - **Od aplikacji 3.30.0:** tylko urodzenie, chrzest, ślub, zgon i pochówek. Miejsce zamieszkania, zawód i inne dane
    weryfikuje się przez **Zweryfikuj** przy danej. Gdyby badanie dla całej osoby wzięło także inne dane, aplikacja
    wysyła do weryfikacji każdą zaznaczoną daną z osobna. Do 3.29.0 także miejsce zamieszkania i zawód.
- **Granice:** przycisk i pozycja pokazują się tylko przy działającym moście badania ([S7.9](#S7.9)) i tylko wtedy,
  gdy co najmniej jedna dana osoby oferuje **Zweryfikuj**.
- **Obsługa:** aplikacja: karta osoby → **Zweryfikuj dane (N)** nad **Zdarzeniami**; podpowiedź znacznika na karcie
  w drzewie → **Zweryfikuj dane (N)** albo **Zweryfikuj w pierwszej kolejności**; menu osoby → **Zweryfikuj dane ·
  N** albo **Zweryfikuj w pierwszej kolejności** pod **Weryfikacja · N**; potem w oknie **Zweryfikuj (N)**. Terminal:
  `strom verify facts P…`.
- **Obowiązuje od:** badanie 1.30.0, aplikacja 3.26.0
- **Od aplikacji 3.31.0:** pod szacunkiem w oknie stoi „Tanio = odczytać znany zapis. Drożej = zapis trzeba znaleźć.
  Weryfikacja nastąpi podczas pracy badania; wyniki pojawią się przy danych.” (wcześniej „Działa w tle badania”).

<!-- zdroj: app:f19d34cb strings.ts verify.estimateNote (065 K7.3) · app:7cf409bd src/ui/verify-person-ui.ts personVerifyMenu (pending + prioritize), verifyCardTipActions (st-verify-first), renderPersonVerifyRow (jen pending řádek), showVerifyPersonDialog prioritize (titulek verify.prioritize) · src/ui/card-signals-ui.ts signal-verify-first · src/ui/context-menu.ts · research:a4a2f6c0 src/core/verify.ts verifyAsk (osoba: držené úkoly na začátek) · app:7b0471f8 src/verify-ui-model.ts personVerifyAskCount · strings.ts verify.menu, menuPending, personTitle, estimate, startN, bulkStarted · app:7eb903a3 src/ui/verify-person-ui.ts renderPersonVerifyRow, personVerifyMenu (karta osoby nad #events-section; jinak personPending), verifyCardTipActions · strings.ts verify.personBtn, personPending, events.title · dirigent:prace/1109-app-jeden-rodic/karta.md Výsledek (6f58068a: menu = náhled = toast; i bydliště, i doložené) · app:0fbda127 src/verify-ui-model.ts PERSON_VERIFY_KINDS, personVerifyAskCount, src/ui/verify-person-ui.ts others (start po údajích) -->

<a id="S7.5"></a>
## S7.5 Zweryfikuj dane w drzewie

Weryfikację według oryginałów można uruchomić dla całej linii, rodu albo całego drzewa. Okno **Zweryfikuj dane
w drzewie** pokazuje z góry zakres, kolejność i szacunek kosztu i weryfikuje tylko niezweryfikowane dane
(prawdopodobne, możliwe, wskazówka, z drzewa).

- **Gdzie:** **Zweryfikuj dane w drzewie…** w sekcji **Weryfikacja** w Co wie badanie
  ([S3](S3-what-the-research-knows.md)), w menu badania i na karcie **Co dalej** po imporcie jako **Sprawdź dane
  w źródłach** ([S6.4](S6-tree-from-another-program.md#S6.4)).
- **Opcje:**
  - **Zakres**: **Linia: {imię}**, **Ród {nazwisko}**, **Całe drzewo**;
  - **Kolejność**: **Najbliżsi przodkowie najpierw**, **Najpierw najsłabiej udokumentowane**, **Najpierw najdłużej
    niesprawdzane**;
  - **Najpierw wypróbuj na 5 osobach**: „Po 5 osobach weryfikacja się zatrzyma i pokaże wynik.” Przycisk to wtedy
    **Wypróbuj na 5**, w przeciwnym razie **Zweryfikuj (N)**.
- **Pilnuje kod:**
  - bierze urodzenie, chrzest, ślub, zgon i pogrzeb z cytatem oryginału, których człowiek nie potwierdził; także
    udokumentowane (odczyta je kolejny czytelnik), poza tymi, które już zweryfikował obecny model; oraz wskazówki
    z drzewa innego programu i z drzewa z aplikacji Strom, których nikt nie zmienił (akt się wyszukuje);
  - nigdy osób żyjących (urodzonych mniej niż 100 lat temu bez wpisanego zgonu);
  - jedno zadanie na osobę (ślub na rodzinę), z niskim priorytetem, po pracy nad liniami;
  - uruchomić może tylko człowiek: w aplikacji albo przy swoim terminalu. Agent może tylko `--dry-run` (ile i za
    ile).
- **Zatrzymanie:** sekcja **Weryfikacja** pokazuje „Czeka na weryfikację: N danych · weryfikowane po kolei, najbliżsi
  przodkowie najpierw” i **Zatrzymaj** („Weryfikacja zatrzymana.”). Zatrzymanie odrzuca zadania, których nikt
  jeszcze nie zaczął; zaczęte zostaną dokończone. Odrzucone dane nie wracają do kolejki same, tylko z nowym cytatem
  oryginału albo na nową prośbę.
- **Obsługa:** aplikacja: zob. wyżej. Terminal: `strom verify bulk --scope line|lineage|tree [--of G…|P…]
  [--order ancestors|weakest|oldest] [--try N] [--budget …] [--dry-run]`, `strom verify status`,
  `strom verify stop [--bulk]`.
- **Obowiązuje od:** badanie 1.30.0, aplikacja 3.26.0
- **Od aplikacji 3.31.0 z badaniem 1.36.0:** próba trafia na początek kolejki, a komunikat po uruchomieniu proponuje
  **Przetwórz teraz** ([S7.5.1](#S7.5.1)). Pod szacunkiem okno mówi „Weryfikacja nastąpi podczas pracy badania; postęp
  i zatrzymanie w „Co wie badanie › Weryfikacja”.” Wiersz „Czeka na weryfikację” ma **Pokaż w kolejce**
  ([S4.2.4](S4-research-from-the-app.md#S4.2.4)).

<!-- zdroj: app:f19d34cb, 53ef9cbe (065 K7.1–K7.4) · app:7b0471f8 src/ui/verify-person-ui.ts verifyRowsHtml, treeVerifyBlock, showVerifyBulkDialog · src/ui/research-actions-ui.ts:371 (nabídka výzkumu) · src/import-next.ts IMPORT_NEXT_VERIFY_FEATURES ['verify.bulk'] · src/verify-ui-model.ts VERIFY_TRY_PEOPLE 5 · strings.ts verify.bulkRow, bulkRowSub, bulkTitle, bulkSub, scope, order, scopeLine, scopeSurname, scopeTree, orderAncestors, orderWeakest, orderOldest, tryFirst, tryFirstSub, tryN, startN, bulkNote, section, pendingRow, pendingRowSub, stop, stopped · research:6c6e7c3b strom help verify bulk, verify stop, verify status · src/core/verify.ts (žijící) · research:94d75934 src/core/verify.ts verifyBulk (origin import nebo tree → search) -->

<a id="S7.5.1"></a>
### S7.5.1 Próba na początku kolejki i Przetwórz teraz

Próba **Najpierw wypróbuj na 5 osobach** trafia na początek kolejki badania, jak **Zweryfikuj** przy osobie. Gdy
badanie akurat nie pracuje, aplikacja proponuje przetworzyć ją od razu.

- **W oknie:** pod opcją próby stoi „Zadania trafiają na początek kolejki badania. Po 5 osobach weryfikacja się
  zatrzyma i pokaże wynik.” a pod szacunkiem „Weryfikacja nastąpi podczas pracy badania; postęp i zatrzymanie w „Co wie
  badanie › Weryfikacja”.”
- **Po uruchomieniu** komunikat mówi, kiedy próba zostanie przetworzona:
  - badanie pracuje: „12 danych do weryfikacji jest następnych w kolejce badania.”;
  - badanie nie pracuje: „12 danych do weryfikacji czeka na początku kolejki. Badanie teraz nie pracuje.” z **Przetwórz
    teraz** (oznaczenia AI i terminala, [S4.5.1](S4-research-from-the-app.md#S4.5.1)); komunikat stoi 15 s i można go
    zamknąć;
  - w przeciwnym razie (badanie nie umie pracy nad wybranymi zadaniami, nie ma ustawionego agenta albo nie powiedziało,
    czy pracuje): „12 danych do weryfikacji czeka na początku kolejki; weryfikacja nastąpi przy następnej pracy
    badania.”
- **Przetwórz teraz** otwiera terminal badania jak **Praca nad kolejką…** ([S4.2.3](S4-research-from-the-app.md#S4.2.3)):
  „Te zadania, w tej kolejności:”, potem „Jedna sesja na zadanie (N sesji), potem koniec; co nie zostanie skończone,
  wraca do kolejki.” Uruchamia się dopiero po „tak” ([R7.1.2](R7-when-the-agent-works.md#R7.1.2)).
- **Pilnuje kod:**
  - zadania próby dostają w kolejce miejsce jak ręczne **od razu** ([R2.3.1](R2-lines-and-queue.md#R2.3.1)); weźmie je
    następna sesja. Reszta zakresu bez próby idzie dalej dopiero po pracy nad liniami ([S7.5](#S7.5));
  - dwie próby po sobie idą w kolejności zlecenia, starsza pierwsza;
  - terminal bierze tylko zadania, które jeszcze czekają i nad którymi nikt nie pracuje; pozostałe pomija („Zadania
    z odnośnika, które już nie czekają (zrobione, cofnięte lub zajęte przez innego), pominięte: N.”). Gdy nie czeka
    żadne, nic się nie uruchamia.
- **Gdzie widać postęp:** Co wie badanie › **Weryfikacja** („Czeka na weryfikację: N danych”, **Zatrzymaj**, **Pokaż
  w kolejce**), w **Kolejce** rodzaj **Weryfikacja** ([S4.2.4](S4-research-from-the-app.md#S4.2.4)); terminal
  `strom verify status`.
- **Granice:** przy starszym badaniu próba idzie po pracy nad liniami jak inne zadania weryfikacji, a komunikat mówi
  „N danych czeka w kolejce do weryfikacji.”
- **Obsługa:** aplikacja: **Zweryfikuj dane w drzewie…** → **Najpierw wypróbuj na 5 osobach** → **Wypróbuj na 5** →
  komunikat → **Przetwórz teraz**. Terminal: `strom verify bulk --scope … --try N` („próba, na początku kolejki:
  weźmie ją następna sesja”).
- **Obowiązuje od:** aplikacja 3.31.0, badanie 1.36.0

<!-- zdroj: dirigent:spec/065-spolehlivost-a-znovu-overeni K7.1–K7.3 · prace/1119-app-065-p7, 1119-research-065-p7-drobnosti · app:f19d34cb src/ui/verify-person-ui.ts (tryHead: verify.tryFirst → tryFirstSubHead; bulkNote(knowsTitle › section); showVerifyBulkStarted: BULK_PROCESS_MS 15 s, closable, activeResearchNoAgent, work do=tasks workTasks, researchLinkFlags) · src/research-verify.ts verifyBulkStartedKind (plain / next / head / process: working false, work.tasks, workTaskIds) · src/verify-ui-model.ts VERIFY_TRY_PEOPLE 5 · strings.ts verify.tryFirstSubHead, bulkNote, bulkStartedIdle, bulkStartedNext, bulkStartedHead, processNow, bulkStarted · research:7116bb60 src/core/verify.ts verifyBulk (try → priority 3, queueAt next, first), src/commands/verify.ts (working), src/cli/menu-links.ts workOn (jen open a nedržené, asks výchozí ne, run --task), src/core/links.ts (task= jen s do=tasks, 1–100) · cs.json ui.verify.bulk.first, ui.link.work.picked.head, ui.link.work.picked, ui.link.work.picked.gone, ui.link.work.picked.none · CHANGELOG.cs.md 1.36.0 (dvě zkoušky v pořadí zadání) -->

<a id="S7.6"></a>
## S7.6 Weryfikacja sama w kolejce badania

Dana, która cytuje oryginał aktu i została prawdopodobna lub możliwa, jest według niego weryfikowana sama: badanie
wpisuje ją do kolejki, choć nikt o to nie prosił.

- **Pilnuje kod:**
  - kolejka uzupełnia się po zaplanowaniu każdej sesji i po `strom sync`;
  - bierze urodzenie, chrzest, ślub, zgon i pogrzeb osób połączonych z drzewem, poza bocznymi gałęziami, bez osób
    żyjących; w Archiwum Strom nigdy;
  - jedno zadanie na osobę (ślub na rodzinę), po pracy nad liniami; po każdych 5 sesjach jedno zadanie weryfikacji
    idzie wcześniej (najbliższy przodek pierwszy);
  - dana zweryfikowana, pozostawiona z powodem, potwierdzona lub obniżona nie wraca do kolejki, tylko z nowym cytatem
    oryginału albo na prośbę człowieka;
  - zadanie, które czeka na skany albo na zgodę archiwum, czeka jak każde inne
    ([R6.2.1](R6-awaiting-action.md#R6.2.1), [R6.3.1](R6-awaiting-action.md#R6.3.1)).
- **Gdzie widać liczbę:** `strom check` („uwaga: N danych z cytowanym oryginałem czeka na sprawdzenie z nim → strom
  verify status”), wiersz `strom doctor` **sprawdzenie z oryginałami** („N danych z cytowanym oryginałem czeka na
  sprawdzenie, stopniowo”), `strom stats`, `strom verify status` (**Sprawdzanie z oryginałami**: czeka, w tym na
  prośbę, w tym czeka na pobranie skanów, w tym czeka na zgodę archiwum; sprawdzone i pozostawione z powodem;
  potwierdzone według skanu; oraz dlaczego która dana wypadła z wyboru) i w aplikacji sekcja **Weryfikacja**
  ([S7.5](#S7.5)).
- **Obowiązuje od:** badanie 1.30.0

<!-- zdroj: research:6c6e7c3b src/core/verify.ts (záhlaví: sweep po plánování, po strom sync, VERIFY_EVERY 5, jen napojené, mimo vedlejší větve, ne žijící, ne archiv, bez znovuzařazení) · cs.json ui.check.verify, ui.doc.verify, ui.stats.verify, ui.verify.status.* -->

<a id="S7.6.1"></a>
### S7.6.1 Jednorazowa poprawka starszych badań

Badanie założone przed wersją 1.30.0 ma dane z cytatem oryginału, których nikt według oryginału nie zweryfikował.
Poprawka **Dane do sprawdzenia z oryginałami** raz wpisuje je do kolejki weryfikacji.

- **Pilnuje kod:**
  - poprawka wykonuje się sama raz, przy pierwszym uruchomieniu nowej wersji po kopii zapasowej badania; potem
    podobne dane wpisują się do kolejki na bieżąco ([S7.6](#S7.6));
  - tylko zadania: w danych nic się nie zmienia. „Nic nie zostaje udokumentowane bez wglądu w oryginał; żadna wartość
    nie jest nadpisywana.”;
  - `strom fixes undo verify-originals` odrzuca zadania, których nikt nie zaczął; zaczęte lub gotowe zostają;
  - w Archiwum Strom odnotowuje się tylko, że się wykonała.
- **W aplikacji:** po aktualizacji badania raz komunikat „N danych z oryginałem czeka na weryfikację, po kolei.”
- **Obsługa:** terminal: `strom fixes` (lista poprawek i co zrobiły), `strom fixes undo verify-originals`.
- **Obowiązuje od:** badanie 1.30.0, aplikacja 3.26.0

<!-- zdroj: research:6c6e7c3b src/commands/fixchecks.ts VERIFY_ORIGINALS (Applied by itself once, at the first start of this strom after its backup; agentWork) · src/commands/fixes.ts "verify-originals" (undo: nobody started) · cs.json ui.fixes.verify-originals.name, .does, .not · app:7b0471f8 strings.ts verify.queuedToast -->

<a id="S7.7"></a>
## S7.7 Wynik weryfikacji

Sesja, która weryfikuje daną, otwiera skan aktu i go odczytuje. Wynik jest jeden z dwóch: dana jest według skanu
udokumentowana albo została taka, jaka była, z powodem.

- **Pilnuje kod:**
  - udokumentować można tylko z odczytanym skanem; bez wglądu w oryginał nic nie zostaje udokumentowane;
  - pozostawiona dana ma powód, który aplikacja pokazuje w podpowiedzi („Pozostaje {stopień} · badanie sprawdziło
    {data}”);
  - weryfikacja nie nadpisuje żadnej wartości. Gdy akt mówi coś innego, powstaje propozycja albo sprzeczność do
    rozstrzygnięcia przez człowieka ([S6.3](S6-tree-from-another-program.md#S6.3), [R5](R5-conflicts.md)); danej
    wpisanej lub potwierdzonej przez człowieka agent nigdy nie zmienia;
  - wynik zapisuje tylko sesja, która wykonuje zadanie weryfikacji (`strom verify done`).
- **Dlaczego:** agent dokumentuje, człowiek potwierdza. Także zgodność dwóch czytelników to odczyt AI; pewność daje
  dopiero człowiek ze skanem ([S7.8](#S7.8)).
- **Obowiązuje od:** badanie 1.30.0, aplikacja 3.26.0

<!-- zdroj: research:6c6e7c3b strom help verify done (--proven --image | --kept --reason, jen uvnitř sezení) · cs.json ui.fixes.verify-originals.not · app:7b0471f8 strings.ts verify.reasonHead -->

<a id="S7.8"></a>
## S7.8 Potwierdź według skanu: potwierdzenie przez człowieka

Najsilniejszy znacznik daje człowiek: patrzy na skan aktu, porównuje go z daną i w podpowiedzi znacznika klika
**Potwierdź według skanu**. Dana ma wtedy **Potwierdzone** (✓), a podpowiedź zamiast akcji pokazuje stan
„✓ Potwierdzone według skanu {data}” i **Cofnij**.

- **Pilnuje kod:**
  - **Potwierdź według skanu** jest oferowane tylko przy danej ze źródłem: z cytatem albo z aktem, z którego badanie
    odczytało wartość. Dana bez źródła go nie ma: nie ma według czego potwierdzić;
  - potwierdza się wartość, którą człowiek widzi. Gdy badanie ją w międzyczasie zmieniło, nic się nie potwierdza:
    podpowiedź się zamyka, aplikacja mówi „Dana w międzyczasie się zmieniła; nic nie potwierdzono. Potwierdzić można
    tylko aktualną wartość z badania.” i wczytuje aktualną wersję badania (drzewo ze zmianami, których badanie jeszcze
    nie ma, najpierw pyta: **Wczytać wersję badania?**). Wartość zmieniona w aplikacji i jeszcze niewysłana nie jest
    wysyłana do potwierdzenia; podpowiedź mówi to samo;
  - **Cofnij** anuluje potwierdzenie („Potwierdzenie cofnięte”); dana ma wtedy znowu stopień, który miała;
  - potwierdzenie obowiązuje tylko dla potwierdzonej wartości: zmiana danej je kończy, a gdy wartość wróci, obowiązuje
    znowu;
  - potwierdzonej danej agent nigdy nie zmienia, tylko proponuje ([S6.3](S6-tree-from-another-program.md#S6.3));
  - drzewo bez badania: potwierdzenie przechowuje sama aplikacja, przy danej, która cytuje źródło, gdy drzewo można
    edytować. Potwierdzenie i jego cofnięcie przechodzą z drzewem do badania, także przez plik GEDCOM;
  - potwierdzenie przechowywane przez aplikację to zmiana drzewa: ma krok wstecz („potwierdzenie danej osoby {imię}
    według skanu”, „cofnięcie potwierdzenia osoby {imię}”) i wpis w historii zmian („Dana osoby {imię} potwierdzona
    według skanu”, „Cofnięto potwierdzenie według skanu: {imię}”);
  - drzewo powiązane z badaniem: potwierdzenie zapisuje badanie przez most, tylko gdy most działa, a badanie to
    potrafi; imienia i płci się tu nie potwierdza. **Od aplikacji 3.31.0 z badaniem 1.36.0** potwierdza się także
    imię i nazwisko ([S7.10](#S7.10));
  - **od aplikacji 3.31.0:** potwierdzona dana, która nadal ma wartość z drzewa innego programu, ma pod
    potwierdzeniem wiersz „Przejęte z drzewa {program}, plik {data}”: skąd wartość przyszła, zostaje widoczne;
  - w terminalu potwierdza tylko człowiek przy swoim terminalu: `strom verify confirm E… [--undo]`. Agentowi `strom`
    potwierdzenie odrzuca.
- **Granice:** drzewo powiązane z badaniem, którego most nie działa: od aplikacji 3.30.0 oferuje **Potwierdź według
  skanu** i **Cofnij** przy danej, którą badanie zna pod swoim numerem. Potwierdzenie i jego cofnięcie przechowuje
  aplikacja, a do badania docierają z najbliższym przekazaniem drzewa. Przy danej bez numeru badania bez mostu można
  tylko cofnąć potwierdzenie, które przechowuje aplikacja. Do 3.29.0 bez mostu ani jedno, ani drugie. Gdy badanie
  odrzuci potwierdzenie,
  podpowiedź mówi dlaczego, na przykład że badanie jest archiwum albo że trzyma je inna sesja; „Bez zmian; badanie
  nie odpowiada.” tylko wtedy, gdy nie odpowiada.
- **Dlaczego:** pewność o danej powstaje wtedy, gdy człowiek sam widzi akt. Weryfikacja przez agenta to odczyt AI; ✓
  mówi, że akt widział człowiek. Potwierdzona transkrypcja ([A3.1.1](A3-evidence-in-the-app.md#A3.1.1),
  [R3.4.1](R3-verification-and-citation.md#R3.4.1)) potwierdza tekst aktu, **Potwierdź według skanu** daną osoby.
- **Obsługa:** aplikacja: karta osoby → znacznik danej → **Potwierdź według skanu** / **Cofnij**. Terminal:
  `strom verify confirm E…`, `strom verify confirm E… --undo`.
- **Obowiązuje od:** badanie 1.30.0, aplikacja 3.26.0

<!-- zdroj: app:7b0471f8 src/verify-offer.ts (human → Vzít zpět; bez výzkumu scan u citovaného; ve stromu výzkumu scan jen s researchConfirms) · src/verify.ts factConfirmation/researchConfirmation (platí jen s nezměněnou hodnotou) · src/verify-ui-model.ts (jméno, pohlaví bez scan ve stromu výzkumu) · strings.ts verify.scan, undo, undone, confirmedAt · app:7eb903a3 src/ui/verify-ui.ts (✓ jen u stavu, akce bez ✓; verifyConfirm: bez mostu DataManager.confirmFact) · src/data.ts confirmFact/unconfirmFact (undo.confirmFact, unconfirmFact, auditLog.confirmedFact, unconfirmedFact) · strings.ts verify.scan, confirmedAt · CHANGELOG.cs.md 3.26.0 · dirigent:test/vysledek-1109-zaver-c-potvrzeni.md (N2: bez mostu ✓ ani Vzít zpět ve stromu výzkumu) · prace/1109-app-potvrzeni-zmena · research:6c6e7c3b strom help verify confirm (jen uživatel, most; mimo něj requireHuman) · app:669c08f0 src/verify-offer.ts verifyOffer (scan jen se source: citace nebo záznam, ze kterého výzkum četl), src/verify.ts factConfirmMark (3 _TXT; changed), src/ui/verify-ui.ts verifyConfirm (409 confirm.changed → zavřít bublinu, toast, researchLoadNewer; změněno tady → jen důvod), strings.ts verify.confirmChanged, confirmLocked, confirmBusy, confirmFailed, sync.loadTitle · research:94d75934 POST /facts/confirm {txt} → 409 confirm.changed, feature facts.confirm.value · app:0fbda127 src/verify-offer.ts researchConfirms (offline), verifyOffer (offline bez eid: scan ne, undo jen confirmedBy app; scanViaBridge/undoViaBridge ne offline), src/verify-ui-model.ts PERSON_VERIFY_KINDS (BIRT, CHR, BAPM, MARR, DEAT, BURI), personVerifyAskCount, src/ui/verify-person-ui.ts others (start po údajích), CHANGELOG.cs.md 3.30.0 „Spolehlivost údajů“ -->

<a id="S7.9"></a>
## S7.9 Co działa z mostem, a co bez niego

| | Drzewo powiązane z badaniem, most działa | Drzewo powiązane z badaniem, most nie działa | Drzewo bez badania |
|---|---|---|---|
| Znaczniki przy danych i na karcie | tak | tak, takie same jak z mostem (według ostatniego stanu z pliku) | tak, z importu i z cytatów |
| **Zweryfikuj**, **Zweryfikuj w pierwszej kolejności**, **Zweryfikuj dane · N**, **Zweryfikuj dane w drzewie…** | tak | nie | nie (wiersz o badaniu przodków) |
| **Potwierdź według skanu**, **Cofnij** | tak, zapisuje badanie | od aplikacji 3.30.0 tak przy danej z numerem badania, przechowuje aplikacja do przekazania drzewa ([S7.8](#S7.8)) | tak, przechowuje aplikacja |
| **Zatrzymaj** weryfikację | tak | nie; `strom verify stop` w terminalu | – |
| Weryfikacja w kolejce badania | działa | działa (badanie nie czeka na aplikację) | – |

- **Pilnuje kod:** badanie weryfikuje także bez aplikacji: w terminalu działają `strom verify facts`,
  `strom verify bulk`, `strom verify status`, `strom verify stop` i (tylko człowiek) `strom verify confirm`. Most
  badania: [S1.1](S1-connecting-app-and-research.md#S1.1).
- **Obowiązuje od:** badanie 1.30.0, aplikacja 3.26.0

<!-- zdroj: app:7b0471f8 src/verify-offer.ts (feature verify a facts.confirm jen ze stavu výzkumu přes most) · dirigent:test/vysledek-1109-zaver-c-potvrzeni.md (N2) · research:6c6e7c3b strom help verify · app:0fbda127 researchConfirms offline -->

<a id="S7.10"></a>
## S7.10 Imię i nazwisko jako dana

Imię i nazwisko osoby ma znacznik jak urodzenie czy zgon: na ile jest pewne według aktów, które je dokumentują, i czy
potwierdził je człowiek. Można je zweryfikować i potwierdzić według skanu. Stopień imienia i nazwiska określa badanie
([R10.5.2](R10-people-and-hypotheses.md#R10.5.2)).

- **Gdzie:**
  - karta osoby: znacznik przy **Imię** i **Nazwisko** (imię i nazwisko z drzewa zmienione tylko częściowo ma
    znacznik tylko przy części, która jest z drzewa); podpowiedź znacznika jak przy danej ([S7.1](#S7.1));
  - karta w drzewie: imię i nazwisko jest jedną z trzech danych, z których powstaje jeden znacznik ([S7.2](#S7.2)).
    Po potwierdzeniu lub jego cofnięciu przez most znacznik karty zmienia się od razu;
  - nazwisko po ślubie ma cichy znacznik przy **Nazwisko po ślubie**: bez podpowiedzi i bez akcji, i nie wchodzi do
    znacznika karty.
- **Akcje przy imieniu i nazwisku** (drzewo powiązane z badaniem, które obsługuje imię i nazwisko):
  - **Zweryfikuj** z podglądem jak przy danej ([S7.3](#S7.3)). Gdy badanie weryfikuje imię i nazwisko razem z aktem
    urodzenia lub chrztu, podgląd to mówi: „Zostanie zweryfikowane razem z urodzeniem.”, „Zostanie zweryfikowane
    razem z chrztem.”, przy urodzeniu lub chrzcie „Imię zostanie zweryfikowane razem z nim.”;
  - **Potwierdź według skanu** i **Cofnij** jak przy danej ([S7.8](#S7.8)); imienia i nazwiska zmienionego od
    wczytania drzewa się nie potwierdza;
  - **Zweryfikuj dane (N)** przy osobie liczy imię i nazwisko ([S7.4](#S7.4));
  - gdy o znaczniku karty decyduje imię i nazwisko, podpowiedź znacznika oferuje link **Imię w karcie osoby ›**:
    otwiera kartę osoby z podpowiedzią imienia i nazwiska.
- **Pilnuje kod:**
  - stopień imienia i nazwiska aplikacja bierze tylko z pliku badania; sama niczego nie dolicza ani nie przelicza
    ([R10.5.3](R10-people-and-hypotheses.md#R10.5.3));
  - do znacznika karty liczy się tylko imię i nazwisko tożsamości osoby
    ([R10.5.2](R10-people-and-hypotheses.md#R10.5.2));
  - drzewo powiązane z badaniem, którego most nie działa: imię i nazwisko z numerem badania można potwierdzić według
    skanu; potwierdzenie przechowuje aplikacja, a do badania dociera ono z najbliższym przekazaniem drzewa
    ([S7.8](#S7.8));
  - drzewo bez badania: imię i nazwisko ze źródłem potwierdza sama aplikacja, jak pozostałe dane;
  - nazwisko po ślubie zapisane w aplikacji inaczej albo usunięte traci swój stopień;
  - gdy żadna dana osoby nie jest już tylko z drzewa (każda jest udokumentowana lub potwierdzona), wiersz
    o pochodzeniu w karcie osoby mówi „Dane osoby pochodzą z {program} (plik {data}, wczytano {data}); żadna nie
    jest już tylko z drzewa.” ([S6.2](S6-tree-from-another-program.md#S6.2)).
- **Granice:** przy starszym badaniu, które nie obsługuje imienia i nazwiska, nic się nie zmienia: imię i nazwisko
  w drzewie badania nie ma **Zweryfikuj** ani **Potwierdź według skanu**, a znacznik imienia i nazwiska zostaje
  według pochodzenia (np. **Z drzewa**). Płci nadal się nie weryfikuje ani nie potwierdza.
- **Obsługa:** aplikacja: karta osoby → znacznik przy **Imię** lub **Nazwisko** → **Zweryfikuj** / **Potwierdź
  według skanu** / **Cofnij**; podpowiedź znacznika na karcie → **Imię w karcie osoby ›**. Terminal: `strom verify
  facts --fact P….N`, `strom verify confirm P….N [--undo]`.
- **Obowiązuje od:** aplikacja 3.31.0, badanie 1.36.0

<!-- zdroj: app:58e76958 src/ged-parser.ts (_STROM_STATUS, _STROM_EID P….N, _STROM_CONFIRMED pod NAME), src/reliability.ts factStatusOf (name → nameStatus), src/ui/person-reliability-ui.ts:126-145 (marriedNameStatus inert, fact name:married; jméno u input-firstname a lastname-label, fromParts GIVN/SURN), src/ui/fact-status.ts:200-203 personMarksLayout originHistory · app:bb1c6f0a src/verify-ui-model.ts verifyFactKind NAME, factOffer (nameOk: features name-status, nebo offline s eid; jinak ve stromu výzkumu nic), PERSON_VERIFY_KINDS NAME, verifyTogetherKind (NAME ↔ BIRT/BAPM/CHR), src/verify.ts NAME_STATUS_FEATURE, researchNameRef · strings.ts verify.kinds.NAME, verify.together · app:837ca7a4 src/ui/verify-person-ui.ts:293-310 verifyCardTipActions nameAtPerson, src/renderer.ts refreshCardStatus, src/data.ts (married name přepsaný → bez stavu) · CHANGELOG.cs.md 3.31.0 „Stav jména“ · research:8b92b3ae features name-status, POST /facts/confirm a /verify s P….N · research:0bbd1d22 src/core/stromapp.ts APP_READS_NAME_STATUS · dirigent:spec/066 K6.3, K6.5 · app:docs/ZADANI_VYZKUM_stav-jmena.md Odpověď aplikace -->
