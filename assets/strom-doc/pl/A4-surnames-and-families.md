<a id="A4"></a>
# A4 Rody i nazwiska

Rozdział opisuje, jak aplikacja składa z drzewa rody i jak postępuje z nazwiskami. Należy tu nazwisko rodowe,
nazwisko po ślubie, formy żeńskie i połączone formy jednego nazwiska.
Opisuje aplikację Strom 3.21.2. Zmiany z nowszej wersji mają przy sobie jej numer.
Jak imiona i nazwiska trafiają do drzewa z GEDCOM, opisuje [A2](A2-loading-a-family-tree.md).

<a id="A4.1"></a>
## A4.1 Ród i jego założyciel

Ród to linia po mieczu od najstarszego znanego nosiciela nazwiska. Aplikacja liczy go tylko z danych drzewa i zapisuje
wyłącznie ręczne poprawki, więc to samo drzewo daje zawsze te same rody.
Ród wyznacza założyciel, nie nazwisko. Jedno nazwisko może więc mieć kilka niepołączonych rodów, a jeden ród może mieć
kilka zapisów nazwiska.

Każda osoba ma jeden ród z urodzenia. Aplikacja znajduje go według „rodzica w linii”:

| Sytuacja | Rodzic w linii |
|---|---|
| Ojciec jest zapisany | ojciec, nawet gdy nazwisko dziecka jest zapisane inaczej |
| Dziecko nosi nazwisko matki, a nie ojca | matka (dziecko należy do jej rodu z urodzenia) |
| Ojca brak, a dziecko nie nosi nazwiska matki | nikt, dziecko zakłada własny ród |
| Osoba bez użytecznego nazwiska | ojciec, w przeciwnym razie matka |

- **Granice:**
  - Bez użytecznego nazwiska jest osoba zastępcza, osoba bez nazwiska i kobieta zapisana pod nazwiskiem męża, jeśli
    nie ma zapisanego ojca. Taka osoba rodu nigdy nie podzieli ani nie założy.
  - Przybrany rodzic i rodzic zastępczy rodu nie przekazują. Rodzic przysposabiający przekazuje go, gdy nie jest
    zapisany inny ojciec.
  - Ród powstaje tylko tam, gdzie jest co najmniej jedna rzeczywista osoba z nazwiskiem. Założyciel to osoba na
    szczycie linii, jeśli jest rzeczywista i ma nazwisko. W przeciwnym razie to najstarszy nosiciel nazwiska
    w najwyższym pokoleniu, które jakiegoś ma.
  - Inny zapis nazwiska w linii rodu nie dzieli. Pokazuje się jako niepotwierdzona forma rodu, zob. [A4.7](#A4.7).
  - „Najstarszy znany” nie znaczy udokumentowany. Udokumentowanie osoby określa
    [R3.8](R3-verification-and-citation.md#R3.8), na ród nie ma wpływu.
  - Córka pozostaje członkinią rodu swojego ojca. Żona, która weszła do rodu przez małżeństwo, pokazuje się w rodzie
    obok członków, ale do członków się nie liczy.
- **Obsługa:** **Przegląd drzewa → Rody**. Szczegóły rodu pokazują **Miejscowości**, **Formy nazwiska**
  i **Członkowie według pokoleń**; pokolenia numeruje się rzymsko od założyciela.
- **Obowiązuje od:** aplikacja 3.19.0

<!-- zdroj: app:src/lineage.ts:1 hlavička modulu · :296 fatherOf · :317 surnameLooksMarried · :328 birthSurname · :393 computeLineages (kroky 1–4) · :756 rodGenerations · strings.ts treeOverview.rods.intro -->

<a id="A4.1.1"></a>
### A4.1.1 Ręczna edycja rodu

Wyliczenie można poprawić w oknie **Edytuj ród…** (szczegóły rodu albo menu **Akcje rodu** przy wierszu **Ród**
osoby).

| Edycja | Element | Co się stanie |
|---|---|---|
| Inny założyciel | **Założyciel → Zmień…** | linia nad wybraną osobą nie przekaże rodu |
| Osobna linia | **Załóż ród od osoby…** (przy osobie **Załóż ród od tej osoby…**) | osoba i jej potomkowie tworzą nowy ród |
| Powrót | **Przywróć wybór automatyczny** | ród jest znowu według wyliczenia |
| Forma nazwiska | **+ forma**, **Usuń formę** | zmienia formy nazwiska całego drzewa ([A4.7](#A4.7)) |

- **Granice:**
  - Przed każdą zmianą pokazuje się podgląd **Co się stanie** z liczbą członków i osób wżenionych. Zmiana to jeden
    krok wstecz: „Każdą zmianę można cofnąć (Cofnij, Historia zmian).”
  - Dodana forma może połączyć dwa rody, a usunięta forma może ród podzielić. Rody łączy relacja rodzic–dziecko, nie
    forma nazwiska („Linii nie łączy forma, lecz relacja rodzic–dziecko.”).
  - Drzewo tylko do odczytu i obserwowane drzewo można tylko przeglądać. Zmieniać można tylko otwarte drzewo.
  - Przy drzewie połączonym z badaniem badanie dostaje poprawkę rodu tak samo jak grupy form (wysyłanie zmian zob.
    S2).
- **Obowiązuje od:** aplikacja 3.19.0

<!-- zdroj: app:src/lineage.ts:1036 LineageChange · :1176 applyLineageChange · :1247 previewOverride · src/ui/lineage-edit-ui.ts · src/ged-exporter.ts _STROM_LINE · strings.ts lineage.edit.*, lineage.preview.* -->

<a id="A4.2"></a>
## A4.2 Ród z urodzenia i osoby wżenione

Karta osoby i strona osoby mają wiersz **Ród**. Członek rodu ma przy nim ród z urodzenia i ewentualnie „· wżeniła się
do rodu …” lub „· wżenił się do rodu …”. Kto wszedł do rodu przez małżeństwo, ma „żona w rodzie …” lub „mąż
w rodzie …” i ewentualnie „· ród z urodzenia …”.

- **Granice:**
  - Jako żona lub mąż osoba pokazuje się, gdy nie ma własnego rodu, gdy jej ród to tylko ona sama albo gdy jej ród
    jest mały ([A4.3](#A4.3)), a ślub prowadzi do dużego rodu. W przeciwnym razie pokazuje się jako członek.
  - Ród z urodzenia męża lub żony wymienia się tylko wtedy, gdy ma więcej niż jedną osobę.
  - Osoba zastępcza i osoba bez rodu i bez ślubu wiersza rodu nie mają.
  - Na stronach i w eksporcie z ochroną osób żyjących wiersz przy osobie żyjącej pokazuje się tylko przy opcji
    **Pełne dane** lub **Zostaw tylko nazwisko**.
- **Obsługa:** menu **Akcje rodu** przy wierszu: **Pokaż ród w drzewie**, **Edytuj ród…**, **Załóż ród od tej
  osoby…**, **Księga rodu…**. Ród jako wybór osób w widoku drzewa opisuje [A6.6](A6-views.md#A6.6).
- **Obowiązuje od:** aplikacja 3.19.0

<!-- zdroj: app:src/lineage.ts:793 marriedInto · :857 personRodRow · src/lineage-row.ts:40 personRodRowValue · :70 rodRowShown · strings.ts lineage.row.* -->

<a id="A4.3"></a>
## A4.3 Małe rody i Inne rodziny

Ród z najwyżej 4 rzeczywistymi członkami jest mały. Osób wżenionych nie wlicza się do tych 4. Małe rody stoją pod
**Inne rodziny** (do 4 osób), duże rody mają własny wiersz.

- **Granice:**
  - Do **Innych rodzin** nie należy ród, który tworzy jedna osoba wżeniona do innego rodu. Takiego rodu nie ma
    w liście rodów wcale; osoba jest widoczna przy rodzie, do którego weszła przez małżeństwo.
  - Dwie różne zasady: duży ród odróżnia się od rodów o tej samej nazwie tylko względem innych dużych, mały względem
    wszystkich ([A4.4](#A4.4)).
- **Obsługa:** **Przegląd drzewa → Rody → Inne rodziny**. Na pasku narzędzi **Wybór ▾ → Rody → Inne rodziny**
  ([A6.6.1](A6-views.md#A6.6.1); do aplikacji 3.30.0 **Rody → Inne rodziny**).
- **Obowiązuje od:** aplikacja 3.19.0

<!-- zdroj: app:src/lineage.ts:72 SMALL_ROD_MAX_MEMBERS · :710 isMarriedInOnly · :722 otherFamilyRods · strings.ts treeOverview.rods, familyPages.otherFams -->

<a id="A4.4"></a>
## A4.4 Kolejność i nazwy rodów

Ród nazywa się nazwiskiem założyciela. Ród, który założyła kobieta, nosi formę pierwszego mężczyzny w linii. Jeśli ród
ma tę samą nazwę co inne rody, dostaje w nawiasie rozróżnienie.

| Kolejność rozróżnienia | Przykład |
|---|---|
| najczęstsza miejscowość rodu, gdy nie ma jej inny ród | Horák (Brno) |
| rok założyciela, gdy nie ma go inny ród | Horák (1702) |
| imię założyciela | Horák (Jan) |
| imię i rok | Horák (Jan, 1702) |

- **Granice:**
  - Rody są uporządkowane od największego według liczby rzeczywistych członków, przy remisie według urodzenia
    założyciela.
  - Rok założyciela to rok urodzenia, w przeciwnym razie chrztu, w przeciwnym razie najstarszego zapisu. Rok
    przybliżony czyta się jako „ok.”.
  - Miejscowość założyciela to miejsce urodzenia, w przeciwnym razie chrztu, w przeciwnym razie pierwsze zdarzenie
    z miejscem.
  - Sortowanie w przeglądzie: **wielkość** (członkowie i osoby wżenione), **najstarsze** (początek rodu),
    **alfabetycznie** (według nazwy w języku aplikacji). Wybór zapamiętuje się na urządzeniu, nie w drzewie.
  - Od 20 dużych rodów przegląd ma wyszukiwanie i pokazuje pierwsze 20 rodów, resztę po rozwinięciu. Szuka się
    w nazwie, formach nazwiska, miejscowościach i imionach członków.
  - Oś czasu rodów jest zaokrąglona do 50 lat.
- **Obsługa:** **Przegląd drzewa → Rody**, pole „Szukaj rodu, miejscowości lub osoby…”. Sekcja **Rody** menu
  **Wybór ▾** na pasku narzędzi ma tę samą kolejność i nazwy, z **Inne rodziny** ([A6.6.1](A6-views.md#A6.6.1)).
- **Obowiązuje od:** aplikacja 3.19.0 (lista **Rody** na pasku narzędzi 3.21.0, od 3.31.0 sekcja **Rody** menu
  **Wybór ▾**)

<!-- zdroj: app:src/lineage.ts:393 computeLineages (řazení) · :567 summarise · :672 founderYearOf · :938 rodLabel · src/rods-overview.ts:23 rodSize · :33 sortRods · :46 AXIS_STEP · :79 rodMatches · :98 ROD_SEARCH_FROM · :114 founderPlace · src/ui/tree-overview.ts:160 RODS_SORT_KEY -->

<a id="A4.5"></a>
## A4.5 Żeńskie i męskie formy nazwiska

Aplikacja łączy w parę męską i żeńską formę nazwiska jako jedno nazwisko: Horák i Horáková, Vlk i Vlková, Jaworski
i Jaworska. Łączenie obowiązuje przy wyszukiwaniu, scalaniu osób, rodach i propozycji nazwiska po ślubie.

| Zasada | Kiedy obowiązuje | Przykład |
|---|---|---|
| polskie -ski/-cki/-dzki ↔ -ska/-cka/-dzka | forma męska zawsze | Jaworski → Jaworska |
| czeskie -ský ↔ -ská, -ý ↔ -á | w czeskim drzewie | Lomský ↔ Lomská |
| czeskie + -ová, -a → -ová | w czeskim drzewie | Horák → Horáková, Vlk → Vlková |
| wypadające e przed k, c, l | w czeskim drzewie | Jalůvek → Jalůvková, Krušec → Krušcová |
| nieodmienne -ů, -í, -ých | nigdy się nie zmienia | Macků, Kočí |

- **Granice:**
  - Drzewo jest czeskie, gdy aplikacja działa po czesku albo gdy któreś nazwisko lub grupa form zawiera czeską literę
    (á é í ý č ď ě ň ř š ť ů ž ú ľ ĺ ŕ ä ô). Litera ó nie czyni drzewa czeskim.
  - Poza czeskim drzewem czeskich zasad się nie stosuje. Ivanova nie łączy się więc w parę z Ivan.
  - Forma żeńska -ska/-cka/-dzka poza czeskim drzewem należy do -ski. W czeskim drzewie zostaje pod czeskimi
    zasadami, bo może to być zapis bez znaków diakrytycznych (Liska zamiast Liška). Jaworski łączy się w parę
    z Jaworska i tak, ale wyszukiwanie „Jaworski” nie znajdzie kobiety zapisanej jako Jaworska.
  - Forma polska musi mieć przed końcówką -i/-a co najmniej 4 znaki. Nazwisko krótsze niż 3 znaki formy żeńskiej nie
    dostaje.
  - Z -ová wstecz próbuje się wszystkich możliwych form męskich (Jalůvková → Jalůvk, Jalůvka, Jalůvek). Rdzeń musi
    mieć co najmniej 3 znaki, w przeciwnym razie -ová czyta się jako przymiotnik (Nová → Nový).
  - Formy, które połączy użytkownik ([A4.7](#A4.7)), obowiązują zawsze, także poza czeskim drzewem.
- **Od aplikacji 3.22.0:** Drzewo z przewagą polskich nazwisk jest polskie i nie dostaje czeskich zasad nawet
  przy aplikacji po czesku (Nowak nie dostanie formy Nowaková). Forma żeńska -ska łączy się w parę z -ski w każdym
  drzewie, w którym -ski występuje.
- **Obowiązuje od:** aplikacja 1.16.0 (formy polskie 3.21.2)

<!-- zdroj: app:src/surnames.ts (v3.21.2):29 CZECH_LETTERS · :39 POLISH_ADJECTIVAL · :42 polishPair · :64 genderRulesApply · :69 ruleForms · :89 czechRulesApply · :132 masculineForm · :164 masculineCandidates · :192 feminineForm · :263 sameSurname · HEAD src/surnames.ts treeSignals · CHANGELOG.cs.md 3.21.2, 3.22.0 -->

<a id="A4.6"></a>
## A4.6 Nazwisko po ślubie i używane nazwisko

Osoba ma rodowe **Nazwisko** i osobno **Nazwisko po ślubie**. Nazwisko rodowe wyznacza ród i formy nazwiska.
Nazwisko po ślubie służy do wyświetlania i wyszukiwania.

Gdy u kobiety nazwisko po ślubie jest puste, edytor osoby proponuje „Propozycja: …” z nazwiska męża w formie żeńskiej
według [A4.5](#A4.5). **Użyj** ją wpisuje, **Ukryj propozycję** ją ukrywa i ta sama propozycja już się nie pojawi.

- **Granice:**
  - Mąż to mężczyzna ze związku, który jest lub był małżeństwem (także rozwiedzionym). Spośród ślubów z datą wygrywa
    ten z najpóźniejszą datą, w przeciwnym razie ostatni w kolejności. Związek bez ślubu propozycji nie daje.
  - Zastępczy mąż propozycji nie daje. Propozycja się nie pojawia, gdy jest taka sama jak nazwisko rodowe.
  - Poza zakresem zasad proponuje się nazwisko męża bez zmian (Brenntaler).
  - Pole **Nazwisko po ślubie** jest widoczne, gdy jest wypełnione, u kobiety ze związkiem albo po **+ nazwisko po
    ślubie**.
  - **Używane nazwisko** (**Rodowe** / **Po ślubie**) pokazuje się tylko pod wypełnionym nazwiskiem po ślubie.
    Przydaje się na przykład po rozwodzie.
- **Obsługa:** wyświetlanie wszystkich osób zmienia **Ustawienia → Karta osoby → Wyświetlanie nazwiska**:

| Opcja | Używa nazwiska po ślubie | Używa rodowego |
|---|---|---|
| **Rodowe** | Marie Horáková | Marie Horáková |
| **Po ślubie (z d. rodowe)** (domyślnie) | Marie Vlková (z d. Horáková) | Marie Horáková (dawniej Vlková) |
| **Po ślubie** | Marie Vlková | Marie Horáková (dawniej Vlková) |

  Uwaga „dawniej” jest tylko w szczegółach osoby (menu karty, panel relacji, nagłówek edytora), nie na kartach.
- **Od aplikacji 3.22.0:** u kobiety pole nazwiska rodowego ma podpowiedź „Nazwisko z urodzenia”, a puste
  nazwisko po ślubie mówi, że należy tu nazwisko uzyskane przez ślub.
- **Obowiązuje od:** aplikacja 3.13.0 (używane nazwisko 3.18.0)

<!-- zdroj: app:src/married-suggestion.ts:46 suggestionHusband · :65 wifeSurnameOf · :83 suggestMarriedSurname · src/person-name.ts:46 surnameDisplay · :79 shownNameParts · src/ui/person-modal.ts:1483 refreshMarriedSurname · strings.ts person.*, settings.surnameDisplay, name.* -->

<a id="A4.6.1"></a>
### A4.6.1 Kilka małżeństw: nazwisko z ostatniego małżeństwa

Osoba z kilkoma nazwiskami po ślubie ma jako **Nazwisko po ślubie** to z ostatniego małżeństwa, nie ostatnie zapisane.
Pozostałe nazwiska po ślubie są w **Inne formy imienia i nazwiska**.

Marie Horáková ma dwa małżeństwa: w 1880 roku (mąż Jan Vlk) i w 1900 roku (mąż Josef Jaworski). Badanie zapisało
najpierw „Marie Jaworska”, potem „Marie Vlková”. **Nazwisko po ślubie** to Jaworska, „Marie Vlková” jest w **Inne
formy imienia i nazwiska**.

- **Granice:**
  - Małżeństwo to związek, który jest lub był małżeństwem (także rozwiedzionym); związek bez ślubu (**Partnerzy**,
    **W separacji**) się nie liczy.
  - Wygrywa nazwisko, które należy do partnera z małżeństwa z najpóźniejszą datą ślubu. Małżeństwa bez daty
    przychodzą na kolej dopiero po nich, od ostatniego w kolejności małżeństw ([A6.4](A6-views.md#A6.4)).
  - Nazwisko należy do partnera także w formie żeńskiej (Vlk → Vlková, Jaworski → Jaworska), bez względu na wielkość
    liter i znaki diakrytyczne, także w drzewie, w którym zasady form ([A4.5](#A4.5)) nie dają formy żeńskiej.
  - Nazwisko, które nie należy do żadnego partnera, przychodzi na kolej dopiero po nich; gdy nie należy żadne,
    obowiązuje ostatnie zapisane.
  - Niewybrane nazwiska po ślubie zostają w **Inne formy imienia i nazwiska**, z własnymi imionami. Nic się nie
    usuwa.
  - Obowiązuje przy wczytaniu drzewa z badania i pliku GEDCOM innego programu (`NAME` z `TYPE married` i `_MARNM`).
    Badanie porządkuje nazwiska po ślubie w swoim pliku dla aplikacji według tej samej zasady, obecne na końcu,
    a aplikacja przyjmuje jego kolejność bez zmian. Przy starszym badaniu i pliku innego programu zasadę wylicza
    sama aplikacja. Starsza aplikacja bierze ostatnie zapisane nazwisko, więc od badania też dostaje obecne.
- **Dlaczego:** nazwiska po ślubie przybywają w kolejności, w jakiej badanie je znajduje: nowsze nazwisko na przykład
  z aktu zgonu przed starszym z aktu ślubu. Ostatnie zapisane nie musi więc być tym z ostatniego małżeństwa.
- **Obsługa:** inne nazwisko po ślubie wybiera się ręcznie ([A4.6.2](#A4.6.2)).
- **Obowiązuje od:** aplikacja 3.31.0, badanie 1.36.0 (wcześniej obowiązywało ostatnie zapisane nazwisko po ślubie)

<!-- zdroj: app:bb706ed0 src/married-suggestion.ts marriagePartnersLatestFirst (married|divorced; s datem od nejpozdějšího, pak bez data od posledního v marriagesInOrder), surnameOfSpouse (surnameKey, wifeSurnameOf, feminineForm, masculineFormIn), lastMarriageSurnameIndex (bez shody Infinity, shoda → poslední v pořadí souboru) · src/ged-parser.ts readMarriedSurname (TYPE married, _MARNM), chooseLastMarriageName (nevybrané do nameVariants s křestními), MARRIED_LAST_TAG (se značkou bez přepočtu) · test src/__tests__/married-surname-last-marriage.test.ts · research:5476514e src/core/married.ts marriagesOf (union partners|separated mimo), marriedInOrder, namesInOrder · src/gedcom/export.ts (Strom soubor: jména po sňatku na konci, aktuální poslední; HEAD _STROM_MARRIED_LAST) · spec 010 K4.1, K4.3, K4.4 · dirigent:prace/1120-app-010-posledni-snatek, 1120-vyzkum-010-posledni-snatek -->

<a id="A4.6.2"></a>
### A4.6.2 Ręczna zmiana nazwiska po ślubie

Zmiana **Nazwisko po ślubie** na inne nazwisko (w edytorze osoby albo w tabeli) to wybór użytkownika: wcześniejsze
nazwisko po ślubie zostaje w **Inne formy imienia i nazwiska**, a wybrane z nich znika.

- **Granice:**
  - Poprawka pisowni (to samo nazwisko, różnią się tylko znaki diakrytyczne albo wielkość liter) ani wyczyszczenie
    pola niczego do innych form nie dodaje.
  - Wcześniejsze nazwisko zachowuje własne imiona, jeśli je miało.
  - Badanie przyjmuje wybór jako obecne nazwisko po ślubie i trzyma go wbrew zasadzie [A4.6.1](#A4.6.1), także po
    nowych wpisach i nowym małżeństwie, dopóki w aplikacji nie wybierze się innego. Pozostałe nazwiska po ślubie
    zostają w badaniu.
  - Nazwisko po ślubie, którego badanie jeszcze nie ma, badanie dodaje i od razu przyjmuje jako obecne.
  - Wyborem jest tylko zmiana względem wersji, którą aplikacja dostała od badania. Aplikacja, która nowszej wersji
    jeszcze nie wczytała, niczego nie wybiera.
  - Imię i nazwisko, pod którym osoba pokazuje się w badaniu (`strom name primary`,
    [R10.5](R10-people-and-hypotheses.md#R10.5)), ma pierwszeństwo przed wyborem z aplikacji.
  - Wybór nazwiska, które badanie w międzyczasie usunęło albo wycofało
    ([R10.5.1](R10-people-and-hypotheses.md#R10.5.1)), nie zostaje przyjęty.
  - Przy badaniu starszym niż 1.36.0 wybór przy następnym wczytaniu drzewa wraca do zasady [A4.6.1](#A4.6.1).
- **Dlaczego:** obecne nazwisko nie musi być tym z ostatniego małżeństwa, na przykład nazwisko zachowane po rozwodzie.
- **Obsługa:** wybór ustawia tylko aplikacja (pole **Nazwisko po ślubie**); terminal nie ma do tego polecenia. Przy
  przyjęciu `strom sync` pokazuje wiersz „obecne nazwisko po ślubie – …”, `strom sync undo I…` cofa wybór.
- **Obowiązuje od:** aplikacja 3.31.0, badanie 1.36.0

<!-- zdroj: app:bb706ed0 src/data.ts updatePerson (marriedBefore/marriedNow, surnameKey: oprava pravopisu nic nepřidá, vymazání nic nepřidá, dřívější s marriedFirstName do nameVariants, zvolené z nameVariants pryč) · src/ui/table-view/table-ui.ts updatePerson · research:5476514e src/core/sync.ts name.now (porovnání se základem _STROM_HEAD, off: odebrané od základu nebo retractedNames, shown/primaryName přednost), apply name.now (addName kind married, marriedNow), undo name.now · src/core/married.ts marriedInOrder (primary > marriedNow > pravidlo) · assets/lang/cs.json ui.sync.name.now, ui.sync.do.name.now · strings.ts person.marriedSurname, nameVariants „Další tvary jména“ · spec 010 K4.2, K4.4 · ZADANI_VYZKUM_prijmeni-posledni-snatek.md „Odpověď výzkumu“ (odchylky) · Name.marriedNow a HEAD _STROM_MARRIED_LAST se nepopisují (vnitřní) -->

<a id="A4.7"></a>
## A4.7 Formy nazwiska drzewa i propozycje z badania

Różne zapisy jednego nazwiska (Horák, Horak, Horrák) można połączyć w grupę. Grupa obowiązuje w całym drzewie:
wyszukiwanie, scalanie osób i rody traktują wtedy formy jako jedno nazwisko, także u osób dodanych później.

- **Granice:**
  - Grupa, która nakłada się na inną, łączy się z nią w jedną.
  - Usuniętą formę drzewo pamięta jako odrzuconą parę.
  - Forma jednej osoby (przydomek, nazwisko od gospodarstwa) należy do **Inne formy imienia i nazwiska** przy osobie,
    nie do grup drzewa. Wyszukiwanie ([A4.8](#A4.8)) i scalanie osób porównują także te formy; po scaleniu zostają
    formy obu osób, a dochodzi do nich zapis, który przegrał w sporze o nazwisko.
  - **Zaproponuj z badania** pokazuje propozycje badania na dwóch poziomach: **Udokumentowane** i **Według reguł**,
    każda z powodem i dowodami. Nic się nie połączy bez potwierdzenia (**Przyjmij** / **Odrzuć**, **Cofnij**).
  - Propozycji się nie pokazuje, gdy są odrzucone, już leżą w jednej grupie albo połączyłyby dwie grupy. Pokazuje się
    10 propozycji, kolejne po **Pokaż jeszcze …**.
  - **Przyjmij wszystkie udokumentowane** i **Przyjmij wszystkie różniące się tylko znakami diakrytycznymi**
    pokazują się od 2 propozycji.
  - „Propozycje są dostępne, gdy badanie działa.” Bez badania pokazują się ostatnio wczytane propozycje. Przyjęta
    grupa „trafi do badania razem z wysłaniem zmian” (S2).
- **Obsługa:** **Ustawienia drzewa → Formy nazwiska…** (tylko przy otwartym drzewie), **Połącz**, **Rozłącz**,
  **Zaproponuj z badania**. Forma jednego rodu: **Edytuj ród… → + forma** ([A4.1.1](#A4.1.1)).
- **Obowiązuje od:** aplikacja 1.15.0 (propozycje z badania 3.17.0)

<!-- zdroj: app:src/surnames.ts:291 addSurnameGroup · :329 removeSurnameForm · src/surname-suggest.ts:197 isRejected · :208 suggestionGroup · src/ui/surname-suggest-ui.ts:41 PAGE · src/ui/surnames-ui.ts · src/ui/tree-actions.ts:217 · strings.ts surnames.*, surnameSuggest.* · src/merge/matching.ts:197 writtenSurnames · src/merge/executor.ts:781 addLosingNameVariant, :951 nameVariants -->

<a id="A4.8"></a>
## A4.8 Wyszukiwanie i sortowanie imion i nazwisk

Wyszukiwanie osoby nie rozróżnia wielkich i małych liter, znaków diakrytycznych ani interpunkcji. Osobę znajduje pod
nazwiskiem rodowym, nazwiskiem po ślubie, wszystkimi ich formami ([A4.5](#A4.5), [A4.7](#A4.7)) i pod jej innymi
formami imienia i nazwiska.

| Zgodność zapytania | Kolejność |
|---|---|
| początek imienia | 1. |
| początek nazwiska | 2. |
| początek pełnego imienia i nazwiska | 3. |
| wewnątrz imienia, potem wewnątrz nazwiska (wcześniej w tekście jest wyżej) | 4.–5. |
| inna forma nazwiska lub imienia: początek, potem wewnątrz | 6.–7. |
| kilka słów rozłożonych między imię i inną formę | 8. |
| rok urodzenia | 9. |
| przyczyna zgonu lub dom (tylko wyszukiwanie na pasku narzędzi) | 10. |

- **Granice:**
  - Przy remisie i bez zapytania sortuje się według „nazwisko imię”, alfabetem przeglądarki.
  - Gdy osobę znajdzie tylko nazwisko, którego imię i nazwisko na karcie nie pokazuje, wynik podaje je pod imieniem
    („po ślubie …”, „z d. …”, „dawniej …”).
  - Łacińska i niemiecka postać imienia (Wenceslaus, Wenzel × Václav) łączy się w parę tylko przy porównaniu
    odczytanego dokumentu z drzewem, nie w wyszukiwaniu.
- **Obsługa:** wyszukiwanie na pasku narzędzi, wybór osoby i pole nazwiska w rozszerzonym filtrze.
- **Obowiązuje od:** aplikacja 3.0.0 (nazwisko po ślubie w wyszukiwaniu 3.13.0)

<!-- zdroj: app:src/name-search.ts:26 searchableSurnames · :82 surnameMatchesQuery · src/merge/matching.ts:38 normalizeName · src/person-picker.ts:18 sortByName · :28 calculateMatchScore · :98 hiddenSurnameMatchHtml · src/search-filter.ts:95 · src/given-names.ts -->

<a id="A4.8.1"></a>
### A4.8.1 Te same imiona i nazwiska w wyborze osoby

Gdy w wyniku wyszukiwania powtarza się to samo imię i nazwisko, każdy taki wiersz ma pod nim drugi, szary wiersz
z najkrótszą informacją, która odróżnia go od pozostałych o tym samym imieniu i nazwisku. Wiersz z niepowtarzalnym
imieniem i nazwiskiem wygląda jak dotąd.

- **Kiedy:** takie samo jest to, co wiersz pokazuje: imię i nazwisko z tytułami i uwagą o nazwisku rodowym lub
  dawniejszym oraz rok urodzenia, gdy lista pisze go za imieniem i nazwiskiem. Porównuje się jak przy wyszukiwaniu,
  bez wielkich i małych liter oraz znaków diakrytycznych. Liczy się w całym wyniku, także w wierszach za pierwszymi 50.
- **Kolejność informacji:**
  1. lata: „* 1820 – † 1866”, tylko znane części i tylko rok. Rok urodzenia, który lista pisze za imieniem
     i nazwiskiem, się nie powtarza;
  2. partner: „⚭ imię i nazwisko”; przy kilku małżeństwach pierwszy partner, którego inne wiersze nie mają;
  3. rodzice: „córka: ojciec i matka” (u mężczyzny „syn:”, bez płci „dziecko:”), tylko znani rodzice;
  4. miejsce: „miejsce urodzenia …”, bez niego „zamieszkanie …” (ostatnie zamieszkanie z miejscem).
- **Granice:**
  - informacje bierze się w tej kolejności, aż połączenie nie pasuje do żadnego innego wiersza grupy. Pokazuje się
    z nich tylko to, co znane i czego nie mają takiego samego wszystkie pozostałe wiersze grupy, połączone „ · ”.
    Siostry o tych samych rodzicach rozróżnia więc miejsce urodzenia, nie rodzice; dwie „Radegunda Pokusná”
    urodzone w 1900 mają „⚭ Bohuchval Zkoušek” i „⚭ Sudivoj Pokus”, nie „* 1900 · ⚭ …”. Informacja, którą mają taką
    samą tylko niektóre wiersze, się pokazuje;
  - gdy wiersz odróżnia tylko informacja, która u niego nie jest znana, pokazuje się jego pierwsza znana informacja,
    której nie mają takiej samej wszystkie pozostałe, a gdy takiej nie ma, „brak innych danych”. Wiersz, którego od
    innego nic nie odróżnia, pokazuje wszystkie swoje znane informacje;
  - osoba znaleziona według informacji (nazwisko po ślubie, przyczyna zgonu, dom, [A4.8](#A4.8)) ma jeden wiersz:
    rozróżnienie i za „ · ” znalezisko. Rok, który podaje już znalezisko („† 1866 …”), nie powtarza się
    w rozróżnieniu;
  - wiersz rozróżnienia nie poszerza listy: dłuższy koniec skraca się „…”. Cały tekst jest w dymku wiersza, a czytnik
    ekranu czyta wiersz jako „imię i nazwisko, rozróżnienie”;
  - na telefonie lista ma szerokość ekranu.
- **Gdzie:** każdy wybór osoby z pola: wyszukiwanie na pasku narzędzi, dodanie relacji, ustalenie pokrewieństwa,
  odczyt dokumentu, domyślna osoba drzewa i inne. Wybór osoby dla drogi przodków na mapie
  ([A6.5.4](A6-views.md#A6.5.4)) ma własną listę bez rozróżnienia.
- **Obsługa:** brak: działa samo. Klawisze i wczytywanie po 50 wierszy bez zmian.
- **Obowiązuje od:** aplikacja 3.28.0

<!-- zdroj: app:f5d56ed3 src/picker-distinguish.ts rowKey (shownNameParts + birthNoteText, rok narození jen se showBirthYear, normalizeSearchText), distinguishFeatures (roky * – †, bez roku v řádku a bez části, kterou říká nález; partner první, kterého jiné řádky nemají; rodiče otec, matka, ostatní, bez zástupných; rodiště, jinak poslední bydliště s místem), distinguishLine (nejkratší předpona údajů, kterou nemá nikdo jiný; jinak první známý; jinak distNone), PickerDistinguisher (celý výsledek, i za 50) · src/person-picker.ts renderItem (person-picker-dist, nález na jednom řádku za „ · “, role option, aria-label a title „jméno, rozlišení“) · index.html .person-picker-dist (výpustka, min-width 330 px, telefon 100vw) · všechny new PersonPicker (search.ts, relation-modal.ts, kinship-ui.ts, read-document-ui.ts, tree-management.ts …); PathPersonPicker samostatný · strings.ts personPicker.distNone, distChild, distAnd, distBorn, distLived · app ac34f598 · dirigent:prace/1113-app-drobnosti-1112 · ZADANI_DEV_drobnosti-1112 §1 · app:1c4b7d19 distinguishLine (údaj shodný u všech ostatních řádků skupiny se vynechá; jinak první známý nesdílený; bez rozlišení vše) · dirigent:spec/085 A4.8.1 -->

<a id="A4.8.2"></a>
### A4.8.2 Zakres wyszukiwania: Całe drzewo, Linia prosta, W widoku

Wyniki wyszukiwania osoby można zawęzić do linii prostej jednej osoby albo do osób, które widok właśnie pokazuje.
Przełącznik **Zakres wyszukiwania** jest w nagłówku rozwiniętych wyników: **Całe drzewo**, **Linia prosta**, **W
widoku**.

- **Linia prosta** to sama osoba, wszyscy jej przodkowie i wszyscy jej potomkowie, bez partnerów, rodzeństwa i osób
  zastępczych. Wiersz pod przełącznikiem mówi czyja: „Linia prosta: Jan Horák · z przodkami i potomkami”.
- **W widoku** są osoby, które widok właśnie pokazuje: narysowane drzewo lub wachlarz, wybór na mapie, wiersze tabeli
  po filtrze („W widoku: Tabela po filtrze · 24 osoby”).
- **Czyja linia:**
  - na pasku narzędzi osoba w środku widoku; na mapie i w tabeli główna osoba drzewa („Linia prosta: Jan Horák,
    główna osoba drzewa · z przodkami i potomkami”): osoba z **Domyślna osoba i widok**
    ([A6.1.1](A6-views.md#A6.1.1)), bez niej pierwsza osoba drzewa;
  - w wyborze osoby w oknie dialogowym osoba, z której okno otwarto; w Materiałach osoba materiału, bez niej główna
    osoba drzewa.
- **Granice:**
  - zawężenie nie jest filtrem: liczba aktywnych filtrów się nie zmienia i samo nic nie wyróżnia. Z zapytaniem lub
    filtrem zawęża wyniki, wyróżnienie w drzewie i liczby; stopka panelu filtrów dopisuje „tylko linia prosta” lub
    „tylko w widoku”, na telefonie arkusz filtrów mówi „Wyszukiwanie tylko w linii prostej: Jan Horák.”;
  - zakres, którego wybór nie może zaoferować, się nie pokazuje i szuka się w całym drzewie: **Linia prosta** bez
    osoby, **W widoku** bez widoku za oknem dialogowym (zasłania go inne okno, strona osoby, okno Listy osób lub
    Materiały) i przy widoku, który pokazuje całe drzewo (oś czasu z całym drzewem);
  - gdy w zawężonym zakresie nikogo nie ma, wynik mówi „W linii prostej nikogo. W całym drzewie 3 wyniki.” (lub „W
    widoku nikogo. …”) z odnośnikiem **Szukaj w całym drzewie**; Enter szuka tam;
  - wybór jest jeden dla paska i wszystkich wyborów osoby i obowiązuje do zamknięcia aplikacji. Nie zapisuje się: po
    uruchomieniu jest zawsze **Całe drzewo**.
- **Gdzie:** wyszukiwanie na pasku narzędzi; wybór osoby w oknach dodawania relacji, rodziców dziecka, wspólnego
  wydarzenia, **Ustal pokrewieństwo…**, scalania dwóch osób; przypisanie osoby w Materiałach i w oknie materiału.
- **Obsługa:** kliknięcie zakresu; Alt+←/→ między zakresami (dymek pokazuje „(Alt+←/→)”). Dymek zakresu mówi, co
  zawężenie obejmuje („Tylko Jan Horák wraz z przodkami i potomkami”, „Tylko osoby widoczne teraz w widoku (24)”). Na
  telefonie liczba wyników jest na końcu wiersza pod przełącznikiem.
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:82cfdbd3 src/search-scope.ts SearchScope, SEARCH_SCOPES, getSearchScope/setSearchScope (jen v paměti, po startu 'tree'), directLineIds (selection ancestors + descendants, bez zástupných), effectiveScope, offeredScopes, narrowIds, stepScope · app:7a72bd1e src/person-picker.ts PickerScopeSource, renderScopeHead (skryté nenabízené rozsahy, titulky, altKeys, lineRef/lineRefMain/viewRef, telefon počet na konci řádku), prázdné zúžení emptyLine/emptyView + searchWhole, Enter · src/ui/search-scope-ui.ts toolbarRefPerson (střed, mapa a tabulka hlavní osoba), mainPerson (defaultPersonId, startupPerson), toolbarViewIds (mapScopePersons, timelineScope 'tree' = null, tableShownPersonIds, getVisiblePersonIds), toolbarScopeSource, viewBehindDialog (stránka osoby, Seznamy osob, Materiály, víc dialogů), dialogScopeSource, materialScopeSource, toolbarScopeNote (footLine/footView, sheetLine/sheetView) · src/ui/search.ts applySearchFilter (zúžení není filtr, zvýraznění a počty) · scope: v relation-modal.ts, relationships-panel.ts, person-events.ts, kinship-ui.ts, merge-ui.ts, materials-window.ts, material-attach-ui.ts, search.ts · strings.ts searchScope.* · app:d5b87792 · dirigent:spec/137 K1, prace/1123-app-137-linie-material (Výsledek, dotazy A1–A2: osa s celým stromem bez V pohledu; bez hlavní osoby první osoba stromu) · ZADANI_UIX_hledani-linie-material-seznam „Rozhodnuto 23. 11.“ bod 4 (bez partnerů) -->
