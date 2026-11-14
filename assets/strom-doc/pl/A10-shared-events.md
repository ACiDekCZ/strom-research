<a id="A10"></a>
# A10 Jedno wydarzenie wielu osób

Spis ludności, miejsce zamieszkania lub emigrację całego gospodarstwa domowego zapisuje się raz i dotyczą wszystkich,
którzy przy nich byli. Chrzestny, świadek lub celebrans zapisany przy wydarzeniu innej osoby pokazuje się też w życiu
chrzestnego, gdy jest połączony z osobą w drzewie. Rozdział opisuje aplikację Strom 3.28.0 i badanie 1.32.0. Jak
wspólne wydarzenie czyta się i zapisuje w GEDCOM, mówią [A2.1](A2-loading-a-family-tree.md#A2.1)
i [A2.7](A2-loading-a-family-tree.md#A2.7).

<!-- zdroj: dirigent:spec/085-sdilena-udalost U9, K1.1–K1.6, K2.1–K2.2 · app:1c4b7d19..e832e6e2 (dirigent:prace/1113-app-sdilena-udalost), app:f1d56989..80c2ffb9 (dirigent:prace/1113-app-085-nalezy) · app:CHANGELOG 3.28.0 -->

<a id="A10.1"></a>
## A10.1 Wspólne wydarzenie: Razem z

Wydarzenie, które przeżyło kilka osób naraz, zapisuje się raz. Każda osoba ma swoją kopię, wspólne dane są we
wszystkich kopiach takie same, a zmiana dowolnej kopii dotyczy wszystkich.

- **Które wydarzenia:** **Spis ludności**, **Miejsce zamieszkania**, **Emigracja**, **Imigracja**, **Służba
  wojskowa**, **Naturalizacja** i **Własne** (z wypełnioną nazwą). Urodzenie, chrzest, ślub, zgon i inne wydarzenia
  należą zawsze do jednej osoby; przy nich pozostałych zapisuje się jako chrzestnych i świadków ([A10.5](#A10.5)).
- **Wspólne dane:** typ, nazwa własnego wydarzenia, data, miejsce, dom, notatka, źródła i jakość cytatu.
  **Każda osoba swoje:** wiek według zapisu, rola przy wydarzeniu, stan badań i weryfikacja.
- **Granice:**
  - zmiana wspólnej danej zapisuje się we wszystkich kopiach jako jeden krok **Cofnij** („{wydarzenie}: zapisano
    u N osób.”). Jeśli któraś z osób jest zablokowana, nie zapisuje się nic („Nic nie zapisano: jedna z osób jest
    zablokowana albo ten typ wydarzenia należy tylko do jednej osoby.”);
  - dopóki wydarzenie współdzielą inne osoby, nie można go zmienić na typ tylko dla jednej osoby: w wyborze typu jest
    grupa **Tylko dla jednej osoby** z wyjaśnieniem „Tych typów nie można współdzielić. Najpierw usuń lub odłącz
    pozostałe osoby z „Razem z” (N).”;
  - rola jest przy każdej osobie: domyślnie **członek gospodarstwa** albo **Inna rola…** z własnym słowem (lokator,
    służba…);
  - przy 7 i więcej innych osobach lista pokazuje pierwsze 5 i **Pokaż N więcej** (z powrotem **Pokaż mniej**);
  - usunięcie osoby usuwa tylko jej kopię; potwierdzenie wymienia „Wspólne wydarzenia zostaną u pozostałych:”
    (najwyżej 5 wierszy, potem „…”). Kopia, która zostanie jedyna, jest zwykłym wydarzeniem swojej osoby;
  - osoba żyjąca chroniona ochroną osób żyjących ([A7](A7-book-pages-and-export.md)) przy wspólnym wydarzeniu
    w księdze, na stronach i w eksporcie nie jest wymieniana ani liczona.
- **Obsługa:** edycja wydarzenia osoby, sekcja **Razem z** z kolumnami **Osoba**, **Rola** i **Wiek** oraz podpowiedzią
  „Data, miejsce, dom, notatka i źródła dotyczą wszystkich. Wiek każdy ma własny.” Przy wydarzeniu kilku osób nad
  formularzem jest pasek „Wspólne wydarzenie N osób – zmiany dotyczą wszystkich”.
  - menu wiersza osoby: **Otwórz osobę**, **Odłącz (zachowaj własną kopię)** („Kopia zostaje, dalsze zmiany jej nie
    dotyczą.”), **Usuń z wydarzenia** („Wydarzenie zniknie u tej osoby, u pozostałych zostanie.”). Usunięcie
    i odłączenie zapisują się z pozostałymi zmianami jako jeden krok **Cofnij**;
  - usuwanie w stopce: **Usuń tylko u tej osoby** („U pozostałych N zostanie.”), **Odłącz tę osobę**, **Usuń
    u wszystkich N osób…** (potwierdzenie wymienia osoby, u których wydarzenie zniknie). Jedno i drugie można cofnąć
    przez **Cofnij**.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:80c2ffb9 src/events.ts SHAREABLE_EVENT_TYPES (census, residence, emigration, immigration, military, naturalization, custom), SHARED_EVENT_COMMON_FIELDS (type, customLabel, date, place, address, note, sourceIds, citationQuay) · src/types.ts LifeEvent.shareId, shareRole · src/shared-events.ts, src/shared-event-editor.ts · src/ui/shared-event-ui.ts LARGE_HOUSEHOLD 7, SHOWN 5, openSharedRowMenu, openSharedDeleteMenu, sharedTakeOut, sharedDeleteAll · strings.ts events.sharedWith, sharedWithHint, sharedBanner, sharedCol*, sharedRoleDefault, sharedRoleOther, sharedRolePlaceholder, sharedShowMore, sharedShowLess, sharedOpenPerson, sharedSeparate(Hint), sharedRemove(Hint), sharedSeparateSelf, sharedDeleteSelf(Hint), sharedDeleteAll(Title, Lead), undoHint, sharedTypeLocked(Hint), sharedSaved, sharedSaveRefused, personDelete deleteShared · spec 085 K1.1–K1.3 · dirigent:prace/1113-app-sdilena-udalost Výsledek -->

<a id="A10.1.1"></a>
### A10.1.1 Dodaj osobę

**Dodaj osobę** w sekcji **Razem z** otwiera wybór osób. Nic w nim nie jest z góry zaznaczone.

- **Rodzina:** bez szukanego tekstu proponuje grupę „Rodzina · żyjący w dniu {data}”: partnerów, dzieci, rodziców
  i rodzeństwo osoby, bez osób zastępczych. Kto w roku wydarzenia nie żył, nie ma go w niej, a wybór to mówi („Bez
  N osób, które nie żyły w dniu wydarzenia: …”, najwyżej 3 imiona i nazwiska z rokiem zgonu).
- **Wyszukiwanie:** szuka w całym drzewie, najwyżej 50 wyników. Kto już jest w **Razem z**, ma „już w „Razem z””.
  Bez wyniku proponuje **Utwórz nową osobę „…”** i przypomina „Kto nie powinien być w drzewie (lokator, służba),
  trafia tylko do notatki wydarzenia.” **Utwórz i dodaj** osobę tworzy i dodaje.
- **Osoba, która to samo wydarzenie już ma:** wiersz pokazuje „ma już {wydarzenie} – zostanie dołączone”. Po zapisaniu
  jej własny zapis dołącza do wspólnego wydarzenia i nowa kopia nie powstaje; wiek i własne dane osoby zostają. Jeśli
  jej wspólne dane się różnią, proponuje się **Ujednolić** ([A10.3](#A10.3)).
- **To samo wydarzenie** oznacza:
  - ten sam typ (przy własnym wydarzeniu także tę samą nazwę);
  - pełną datę: dzień, miesiąc i rok, bez „około”, przedziału ani okresu;
  - to samo miejsce (bez względu na spacje na brzegach i wielkość liter);
  - ten sam dom albo dom zapisany tylko w jednym zapisie (połączone wydarzenie go przejmuje). Dwa różne domy nigdy
    nie są tym samym wydarzeniem.
- **Obsługa:** **Dodaj (n)** dodaje wybrane osoby; zapisują się razem z wydarzeniem.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:80c2ffb9 src/ui/shared-event-ui.ts showSharedPicker, familyCandidates (partneři, děti, rodiče, sourozenci, bez zástupných, živí k roku), hledání max 50 · src/shared-events.ts sameEventKey, isSameEvent (SHAREABLE, vlastní s názvem, úplné datum bez kvalifikátoru, místo trim + bez velikosti, dům shodný nebo jen u jednoho) · strings.ts personPicker.family, familyAlive, familyHidden, alreadyShared, joinsOwnRecord, createNamed, noteHint, addN, createAdd · spec 085 K1.6 a · dirigent:prace/1113-app-085-nalezy -->

<a id="A10.2"></a>
## A10.2 Gdzie widać wspólne wydarzenie

Wspólne wydarzenie jest w życiu każdej osoby, która je ma. Gdzie w jednym miejscu jest kilka osób tego wydarzenia,
pokazuje się raz.

- **Lista wydarzeń osoby:** pod wydarzeniem wiersz „razem: …”: do 3 osób z imienia i nazwiska, więcej jako pierwsze
  2 i „i N innych”. **Otwórz wspólne wydarzenie** otwiera edycję wydarzenia.
- **Strona osoby, sekcja Oś czasu życia:** jak pozostałe wydarzenia osoby, z wierszem „razem: …”.
- **Mapa:** w dymku miejsca wspólne wydarzenie jest jednym wierszem ze wszystkimi osobami.
- **Oś czasu rodziny:** raz.
- **Księga i strony rodziny:** blok **Rodzina razem**, gdy wszystkie osoby wydarzenia są w tej rodzinie (para i ich
  dzieci), jeden wiersz z wiekami i źródłem. Osie czasu partnerów pomijają wtedy to samo wydarzenie.
  Spis ludności jest w księdze przy szczegółowości **Wszystko**, przy domyślnej **Standardowo** nie.
- **Tabela:** jeden wiersz ([A6.7.10](A6-views.md#A6.7.10)).
- **Granice:** osoby zastępcze i osoby żyjące chronione ochroną osób żyjących nie są w wierszu wymieniane ani liczone.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:80c2ffb9 src/shared-with-line.ts SHARED_LINE_MAX, sharedWithLine, sharedWithLineHtml, familyTogetherEvents (všechny kopie v rodině, bez zástupných a skrytých), familyTogetherLineHtml · src/book-blocks.ts familyTogetherHtml (skip pro časové osy partnerů) · strings.ts events.sharedLine, sharedLineMore, sharedLineOpen, book.familyTogether · spec 085 K1.4, §2h · dirigent:prace/1113-app-sdilena-udalost Výsledek (mapa, osa rodiny, kniha Běžná/Vše) -->

<a id="A10.3"></a>
## A10.3 Kopie się różnią: Ujednolić

Gdy wspólne dane kopii jednego wydarzenia się różnią (na przykład po imporcie lub scaleniu), aplikacja to mówi
i proponuje je ujednolicić. Sama nic nie zmienia.

- **Gdzie:**
  - **Jakość danych**, sekcja **Do sprawdzenia**, grupa **Wspólne wydarzenia**: „{wydarzenie} · {osoba}: {pole} się
    różni (…, u pozostałych …).”, przy kilku kopiach „{wydarzenie} · N kopii się różni: …”
    ([A5.1](A5-tree-check.md#A5.1));
  - dymek wyniku w widoku Tabela;
  - edycja wydarzenia: pasek „Kopia się różni: … (…).” z **Porównaj**.
- **Okno Ujednolić kopie · {wydarzenie}:** pokazuje tylko pola, które się różnią (typ, nazwa, data, miejsce, dom,
  notatka, źródła, jakość cytatu). Wstępnie wybrana jest wartość większości; przy równej liczbie wartość osoby, z której
  okno otwarto. Od 3 pól jest też **Weź wszystko od:** i osoba. Wiersz „Zgodne: … Wiek, stan badań i weryfikację
  każda osoba ma własne – nie są ujednolicane.”
- **Granice:** ujednolicenie to jeden krok **Cofnij**. **Odłącz różniącą się kopię** (przy kilku **Odłącz różniące
  się kopie (n)**) robi z różniącej się kopii samodzielne wydarzenie jej osoby.
- **Obsługa:** **Ujednolić…** → **Ujednolić u N osób**; **Otwórz** otwiera wydarzenie.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:80c2ffb9 src/shared-divergence.ts · src/validation.ts (groupShared, závažnost warning) · src/ui/tree-stats.ts · src/ui/shared-event-ui.ts (pruh sharedDiffers, sharedCompare) · strings.ts validation.groupShared, sharedDiffersOne, sharedDiffersMany, unify, separateCopy, separateCopies, openEvent, unifyTitle, unifyLead, unifyTakeAll, unifySame, unifyGo, unified, sharedFields · spec 085 §4 · dirigent:prace/1113-app-085-nalezy -->

<a id="A10.4"></a>
## A10.4 To samo wydarzenie zapisane osobno: Połącz w jedno wydarzenie

Ten sam spis lub to samo miejsce zamieszkania zapisane osobno u kilku osób (na przykład ze starszego drzewa lub
z innego programu) znajduje Jakość danych i proponuje je połączyć. Nic nie łączy się samo, także przy aktualizacji
danych.

- **Gdzie:** **Jakość danych**, sekcja **Wskazówki**:
  - jedna grupa: „{wydarzenie} {data}, {miejsce}, {dom} – zapisano osobno u N osób.” (dom tylko, gdy jest zapisany) z **Połącz w jedno wydarzenie**;
  - kilka grup: „N wydarzeń zapisano osobno u kilku osób.” z **Przejrzyj po kolei**. Okno **Wydarzenia zapisane
    osobno u kilku osób · N** proponuje grupy po kolei: **Połącz w jedno wydarzenie**, **Później** (grupa do
    zamknięcia okna się nie pokazuje), **Wstecz** (z powrotem do kontroli).
- **Granice:**
  - to samo wydarzenie rozpoznaje się jak przy **Dodaj osobę** ([A10.1.1](#A10.1.1)). Różne domy dzielą grupy; zapis
    bez domu nie dołącza wtedy do żadnej;
  - po połączeniu to jedno wspólne wydarzenie; wiek i własne dane każdej osoby zostają. Jeśli wspólne dane się różnią,
    proponuje się **Ujednolić kopie** ([A10.3](#A10.3));
  - grupa, w której jest już wspólne wydarzenie, do niego dołącza („Dołączy do wspólnego wydarzenia N osób.”);
  - połączenie to jeden krok **Cofnij** („{wydarzenie}: połączono w jedno wydarzenie u N osób.”).
- **Obsługa:** **Przegląd drzewa → Jakość danych → Szybkie działania → Szczegóły walidacji**, sekcja **Wskazówki**.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:80c2ffb9 src/ui/same-event-join-ui.ts · src/shared-events.ts sameEventKey (domy dělí skupiny) · src/validation.ts (stopa info) · strings.ts validation.sameJoinLead, sameJoinSummary, sameJoinReview, sameJoin, sameJoinTitle, sameJoinHint, sameJoinToShare, sameJoinDone, later, nameLinkBack · spec 085 K1.6 b · dirigent:prace/1113-app-085-nalezy Výsledek -->

<a id="A10.5"></a>
## A10.5 Chrzestni, świadkowie i inni uczestnicy w życiu osoby

Chrzestnego, świadka, celebransa i innego uczestnika zapisuje się przy wydarzeniu, w którym uczestniczyli: przy
chrzcie, ślubie, zgonie. Gdy uczestnik jest połączony z osobą w drzewie, to wydarzenie pokazuje się też w jej życiu.

- **Role:** **Chrzestny / chrzestna**, **Świadek**, **Celebrans**, **Obecny**; z plików także **Akuszerka**
  i **Zgłaszający**. Uczestnik jest zapisany z imienia i nazwiska, jak w źródle, oraz z bliższym określeniem
  (rzemiosło, „sąsiad”…).
- **W życiu połączonej osoby:** wiersz pochodny, na przykład „Chrzestny · chrzest: …”, „Chrzestna · chrzest: …”,
  „Świadek · ślub: …”, „Udzielający ślubu · ślub: …”, „Akuszerka · chrzest: …”, „Zgłaszający · zgon: …”. Jest na
  liście wydarzeń osoby i na stronie osoby w sekcji **Oś czasu życia**; podsumowanie strony osoby ma „Chrzestny
  i świadek u” (u kobiety „Chrzestna i świadek u”).
- **Granice:**
  - wiersz pochodny nie jest własnym wydarzeniem osoby: nie trafia do GEDCOM, Tabeli, mapy, księgi, osi czasu rodziny
    ani osi czasu w oknie osoby;
  - wiersz znika, gdy tylko osoba ma własne wydarzenie ([A10.5.1](#A10.5.1)), które wskazuje na to samo wydarzenie;
  - uczestnik zapisany tylko z imienia i nazwiska nie pokazuje się w niczyim życiu; połączenie proponuje
    [A10.5.2](#A10.5.2).
- **Obsługa:** edycja wydarzenia, sekcja **Chrzestni i świadkowie**: **+ Dodaj**, **Połącz z osobą w drzewie**;
  połączony uczestnik ma znacznik **w drzewie**. Menu wiersza pochodnego: **Otwórz osobę**, **Zapisz też jako własne
  wydarzenie**, **Usuń powiązanie**.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:80c2ffb9 strings.ts events.roles, extraRoles, participants, addParticipant, participantName, participantNote, participantLink, participantInTree, derived*, derivedMenu, recordOwn, unlink · personPage godparentWitness · src/ui/shared-event-ui.ts (odvozené řádky jen v seznamu událostí a Život) · spec 085 K2.1 · dirigent:prace/1113-app-sdilena-udalost Výsledek -->

<a id="A10.5.1"></a>
### A10.5.1 Zapisz też jako własne wydarzenie

Bycie chrzestnym lub świadkiem można zapisać też jako własne wydarzenie osoby, na przykład aby miało własną notatkę
lub źródło.

- **Typy:** **Chrzestny** (pole **Do chrztu**), **Świadek ślubu** (pole **Do ślubu**); przy innym wydarzeniu pole
  **Do wydarzenia**. Własne wydarzenie wskazuje na chrzest lub ślub, do którego należy.
- **Granice:**
  - data, miejsce i źródło wypełniają się według chrztu („Wypełnione na podstawie chrztu. Późniejsze zmiany chrztu
    nie zostaną przeniesione.”), przy ślubie analogicznie;
  - nigdy nie jest to kopia chrztu ani ślubu; chrzest i ślub należą nadal do swojej osoby i pary;
  - wiersz pochodny ([A10.5](#A10.5)) się wtedy nie pokazuje.
- **Obsługa:** menu wiersza pochodnego → **Zapisz też jako własne wydarzenie** („Tworzy wydarzenie „Chrzestny”
  z odniesieniem do chrztu i z tym samym źródłem.”). Po zapisaniu „{typ}: zapisano u osoby {imię i nazwisko}.” Typy
  są też w wyborze typu wydarzenia.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:80c2ffb9 src/events.ts godparent, weddingWitness (roleAt) · strings.ts events.types.godparent „Kmotrovství“, weddingWitness „Svědek při sňatku“, recordOwnHintGodparent, recordOwnHintWitness, recordOwnPrefilled(Marriage, Event), refBaptism, refMarriage, refEvent, recordedOwn · src/ged-exporter.ts (1 EVEN, 2 TYPE, 2 _STROM_ROLE, 3 _STROM_AT, 4 TYPE BAPM|MARR) · spec 085 K2.2 -->

<a id="A10.5.2"></a>
### A10.5.2 Połączenie chrzestnego i świadka zapisanego z nazwiska

Chrzestny lub świadek zapisany tylko z imienia i nazwiska, któremu odpowiada osoba w drzewie, dostaje propozycję
połączenia. Nic nie łączy się samo, a zapisane imię i nazwisko zostaje w wydarzeniu.

- **Kogo się proponuje:** tylko chrzestnych i świadków, nie tych, którzy są przy wydarzeniu z urzędu. Osoba w drzewie
  o tym samym imieniu i nazwisku (bez względu na wielkość liter i znaki diakrytyczne; liczy się też nazwisko po
  ślubie), która w dniu wydarzenia żyła i miała co najmniej 12 lat. Data z „około” dopuszcza odchylenie o 2 lata;
  wiek liczy się z daty urodzenia, w przeciwnym razie chrztu. Bez daty wydarzenia nikogo się nie wyklucza.
- **Kogo nigdy:** osoby, do której wydarzenie należy, kogoś już połączonego i kogoś odrzuconego.
- **Granice:**
  - rok urodzenia i dom (adres urodzenia albo miejsce zamieszkania lub spis najbliższy dacie) przy propozycji tylko
    się pokazują, nie rozstrzygają;
  - odrzucenie drzewo pamięta i nie proponuje go ponownie; w GEDCOM wraca ([A2.7](A2-loading-a-family-tree.md#A2.7));
  - przy wspólnym wydarzeniu łączy się we wszystkich kopiach.
- **Obsługa:**
  - edycja wydarzenia: szary pasek „W drzewie jest {imię i nazwisko} ({dane}) – połączyć?”, przy kilku osobach
    „W drzewie są N osoby o imieniu … – połączyć?”, przyciski **Połącz**, **To nie ta osoba**, **To żadna z nich**.
    Obowiązuje dopiero po **Zapisz**;
  - **Jakość danych**, sekcja **Wskazówki**: „N chrzestnych i świadków zapisanych z nazwiska odpowiada osobie
    w drzewie.” z **Przejrzyj po kolei**; okno **Chrzestni i świadkowie z nazwiska, którzy prawdopodobnie są
    w drzewie · N** zapisuje od razu, każde połączenie lub odrzucenie to jeden krok **Cofnij**. Pod listą
    „Odrzucone nie są proponowane ponownie (n).”
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:80c2ffb9 src/participant-match.ts MIN_PARTICIPANT_AGE 12, cca ±2, attendsByOffice, příjmení po sňatku, linkRejected · src/ui/name-link-ui.ts · src/ui/shared-event-ui.ts (nabídka v editoru) · strings.ts events.linkOffer, linkOfferMany, link, notThisPerson, noneOfThem, linked · validation.nameLinkLead, nameLinkReview, nameLinkTitle, nameLinkHint, rejectedCount · spec 085 §6, 6g · dirigent:prace/1113-app-085-nalezy -->

<a id="A10.6"></a>
## A10.6 Scalanie osób i drzew

Scalanie nie podwaja wspólnego wydarzenia.

- **Scalenie dwóch osób** ([A5.6](A5-tree-check.md#A5.6)): okno **Wspólne wydarzenia po scaleniu** pokazuje wspólne
  wydarzenia obu osób. Wydarzenie, które mają obie, zostaje raz („Raz – obie osoby w nim są.”); jeśli wiek się różni,
  wybiera się go. Własna kopia, która zgadza się ze wspólnym wydarzeniem drugiej osoby, do niego dołącza (zaznaczone
  „Dołącz do wspólnego wydarzenia (N osób) – własna kopia jest zgodna”).
- **Scalanie drzew** ([A8](A8-merging-trees.md)): wspólne wydarzenia przychodzącego drzewa parują się z wydarzeniami
  docelowego (ten sam identyfikator, w przeciwnym razie ten sam zapis) i przejmują jego wspólne wydarzenie. Osoba
  z dwiema takimi samymi kopiami zachowuje jedną. Wspólne wydarzenie, któremu została jedna kopia, jest zwykłym
  wydarzeniem. Podsumowanie: „Wspólne wydarzenia: n połączono”.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:80c2ffb9 src/merge/* (párování shareId, sjednocení kopií) · src/ui/person-merge (sharedTitle) · strings.ts personMerge.sharedTitle, merge.sharedOnce, sharedAttach, sharedJoined · spec 085 K1.5 · dirigent:prace/1113-app-sdilena-udalost Výsledek -->

<a id="A10.7"></a>
## A10.7 Drzewa zapisane wcześniej

Drzewo zapisane starszą wersją aplikacji przy pierwszym otwarciu dostosowuje się do nowej wersji. Przedtem raz zapisuje
się kopia zapasowa (**Przed dostosowaniem danych do nowej wersji**). Dostosowanie nic nie łączy; połączenie proponuje
Jakość danych ([A10.4](#A10.4)).

- **Własne wydarzenie „Spis ludności”:** własne wydarzenie osoby o nazwie dokładnie „Census”, „Sčítání lidu”,
  „Volkszählung” lub „Spis ludności” (bez względu na wielkość liter i spacje na brzegach) staje się wydarzeniem
  **Spis ludności**. Zostaje data, miejsce, wiek, dom, notatka, źródła i uczestnicy. Własne wydarzenia o innej nazwie
  i wydarzenia pary zostają bez zmian. Scalanie traktuje wtedy własne „Census” i spis ludności jako to samo
  wydarzenie, więc ten sam plik wczytany ponownie nie dodaje żadnego wydarzenia.
- **Nieprawidłowe współdzielenie** się odrzuca: nieprawidłowe oznaczenie, współdzielenie przy typie tylko dla jednej
  osoby i współdzielenie z jedyną kopią.
- **Obsługa:** brak, odbywa się samo. Kopia zapasowa jest w menu drzewa → **Kopie zapasowe** → **Historia kopii
  zapasowych** ([S6.5](S6-tree-from-another-program.md#S6.5)).
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:80c2ffb9 src/tree-manager.ts (verze dat 20, migrace), src/snapshots.ts 'pre-migration' · src/shared-events.ts (zahození neplatných shareId) · strings.ts snapshots.pre-migration „Před úpravou dat pro novou verzi“ · test gedcom-census-legacy.test.ts · dirigent:prace/1113-app-085-nalezy Výsledek (Census → census, záloha, NFC, trim, bez roleAt) -->
