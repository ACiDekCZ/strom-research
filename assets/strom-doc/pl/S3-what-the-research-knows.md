<a id="S3"></a>
# S3 Co wie badanie

Rozdział opisuje, co aplikacja pokazuje o osobie z badania: okno **Co wie badanie** z sekcjami **Nad osobą**,
**Sprzeczności**, **Hipotezy** i **Przeszukano** oraz sekcję panelu badania o tej samej nazwie. Opisuje aplikację
Strom 3.21.2 (i badanie 1.25.2). Zmiany z nowszej wersji mają przy sobie jej numer.

<a id="S3.1"></a>
## S3.1 Co wie badanie tylko czyta to, co badanie wysłało

Badanie do każdej osoby dodaje do drzewa genealogicznego dla aplikacji osobne bloki: sprzeczności, hipotezy,
przeszukane źródła i krawędź drzewa nad osobą. Aplikacja je tylko pokazuje. Nic z nich nie zmienia się w aplikacji
i aplikacja ich nie odsyła; żyją w badaniu. Nagłówek okna niesie datę badania „stan na …”.

- **Skąd:** z mostu (drzewo genealogiczne, które aplikacja wczytuje z działającego badania, zob.
  [S1](S1-connecting-app-and-research.md)) albo z pliku `output/tree-strom.ged`. Jedno i drugie powstaje tym samym
  eksportem badania.
- **Czego okno nie pokazuje:**
  - stopni pewności danych ([R3.1](R3-verification-and-citation.md#R3.1)) i udokumentowania
    ([R3.8](R3-verification-and-citation.md#R3.8));
  - **Czeka na decyzję** ([R6](R6-awaiting-action.md));
  - linii i kolejki jako całości ([S4](S4-research-from-the-app.md)); linie i zadania osoby są tylko w sekcji
    **Nad osobą** ([S3.3](#S3.3)).
- **Granice:**
  - Drzewo genealogiczne z innego programu ani kopia bez bloków badania okna nie mają.
  - Sprzeczności mogą pochodzić z nowszej wersji badania, którą aplikacja przeczytała, ale jeszcze nie wczytała
    ([S2](S2-edits-from-the-app.md)). Sprzeczność rozstrzygnięta z aplikacji znika od razu, jeszcze przed
    wczytaniem nowej wersji. Okno może się więc różnić od wczytanych danych.
- **Obsługa:** aplikacja: nic do ustawienia. Terminal: plik powstaje przy każdym zapisie badania.
- **Obowiązuje od:** aplikacja 3.4.0 z badaniem 1.6.0

<!-- zdroj: app:src/ged-parser.ts:185-335 _STROM_CONFLICT/_STROM_HYPO/_STROM_SEARCHED/_STROM_EDGE, :2351-2375 _STROM_ASOF · src/ged-exporter.ts (bloky nepíše) · src/ui/research-sync-ui.ts:2908-2937 researchConflictsOf, researchConflictsShown, settledConflicts · research:src/gedcom/export.ts:760-805 known() · src/commands/output.ts:94 · src/core/live.ts (hlavička: "The app never sends them back") -->

<a id="S3.1.1"></a>
### S3.1.1 Kiedy badanie wysyła bloki

Badanie dodaje bloki tylko do drzewa genealogicznego dla aplikacji Strom i tylko wtedy, gdy aplikacja potrafi daną
część pokazać. Kieruje się wersją aplikacji, którą zna.

| Część | Aplikacja od | Badanie od |
|---|---|---|
| sprzeczności, przeszukane źródła, „stan na” | 3.4.0 | 1.6.0 |
| **Nad osobą** | 3.6.0 | 1.9.0 |
| hipotezy z wersjami i przełącznikiem **Pokaż** | 3.11.0 | 1.14.0 |

- **Granice:** nieznaną wersję aplikacji i inną kopię aplikacji (własny adres aplikacji) traktuje się jako aktualne.
- **Obowiązuje od:** badanie 1.6.0

<!-- zdroj: research:src/core/stromapp.ts APP_OPENS_LINKS="3.4.0", APP_SHOWS_EDGES="3.6.0", APP_SHOWS_HYPOTHESIS_LINKS="3.11.0" · src/commands/output.ts:94 appOpensLinks, appShowsEdges -->

<a id="S3.2"></a>
## S3.2 Gdzie otwiera się Co wie badanie

Okno otwiera się z menu osoby, podmenu **Badanie → Co wie badanie**. Pozycja jest tam tylko wtedy, gdy badanie coś
o osobie wie: co najmniej jedną sprzeczność, hipotezę, przeszukane źródło albo sekcję **Nad osobą**. Otwarte
sprzeczności niesie jako liczbę, np. „2 sprzeczności”.

- **Inne drogi do okna** (każda otwiera je w swoim miejscu):
  - oznaczenie **sprzeczność ›** przy polu w edycji osoby (przy dacie i miejscu urodzenia i zgonu, imieniu
    i nazwisku, płci, tytule i przydomku): jedna sprzeczność rozstrzygalna stroną otwiera kartę sprzeczności,
    w przeciwnym razie okno;
  - menu osoby, blok sygnałów „n sprzeczności · n hipotez” z linkiem **Co wie badanie ›**;
  - zaczątek krawędzi badania nad kartą otwiera sekcję **Nad osobą** ([S3.3](#S3.3));
  - przy powiązaniu połączonym tylko w widoku **Co wie badanie o powiązaniu** i podpis linii „nieudokumentowane”
    ([S3.5.1](#S3.5.1));
  - karta sprzeczności, **Więcej w „Co wie badanie” ›**;
  - wiersz sekcji w panelu badania ([S3.7](#S3.7)).
- **Granice:**
  - Czytać można wszędzie: na telefonie, w zablokowanym drzewie genealogicznym i w drzewie tylko do odczytu.
  - Przyciski, które otwierają badanie, są tylko na komputerze (urządzenie bez dotykowego wskaźnika), z włączonym
    **Strom Research na tym komputerze** i tylko te, które badanie zgłosiło ([S1](S1-connecting-app-and-research.md)).
  - Sama wyspa (rodzina spoza drzewa) nie dodaje pozycji do menu.
- **Obsługa:** aplikacja: menu osoby → **Badanie → Co wie badanie**.
- **Obowiązuje od:** aplikacja 3.4.0
- **Od aplikacji 3.22.0:** w podmenu **Badanie** na górze są linie, w których jest osoba.

<!-- zdroj: app:src/ui/person-research-ui.ts:140-150 personResearchKnows, markResearchConflicts · src/ui/context-menu.ts personSection · src/ui/card-signals-ui.ts · src/card-signals.ts:171-194 · src/ui/view-links-ui.ts:326 · src/renderer.ts:5479 · src/ui/research-edge-ui.ts:205, :364 · src/ui/conflict-panel-ui.ts:274 · src/ui/research-ui.ts:2119 researchLinkAvailable · HEAD context-menu.ts personInLineItems (spec 038 §5.1) -->

<a id="S3.3"></a>
## S3.3 Nad osobą pokazuje, gdzie kończy się drzewo i co dalej

Sekcja jest przy osobie, nad którą drzewo nie jest kontynuowane: nie ma rodziców, ma tylko jednego albo rodziców
nie dokumentuje żaden akt. Mówi, dlaczego szukanie tu stoi i co stanie się dalej.

- **Dlaczego to się kończy:** np. „Ojciec niewymieniony w akcie”, „Księgi metrykalne się nie zachowały”, „Znane księgi
  metrykalne zaczynają się w 1784 r.”, „Luka w księgach metrykalnych”, „Przeszukano, nie znaleziono”, „Pozostaje
  archiwum”, „Przeszukano częściowo”, „Jeszcze nie szukano”, „Nieznane miejsce urodzenia”, „Rodzice nie są
  udokumentowani aktem”. Granica linii je zastępuje: „Tu kończy się limit linii”, „Linia jest wstrzymana”, „Linia
  jest zakończona”, „Prawdopodobnie osoba żyjąca, nie jest badana” ([R2.1.2](R2-lines-and-queue.md#R2.1.2)).
- **Co dalej:** „Agent właśnie nad tym pracuje”, „Czeka na odpowiedź”, „W kolejce jako nr 3”, „Zadanie zostanie
  dodane przy następnej sesji”, „Czeka poza kolejką (wstrzymana linia)”, „Strom nie ma już nic do zaproponowania.
  Teraz potrzebna jest decyzja.”, „Nic nie jest zaplanowane”. Aplikacja liczy to na żywo z tego, co badanie właśnie
  robi.
- **Oś czasu „Chrzest 1780–1800”:** lata, w których szukany jest chrzest, z legendą *przeszukano, nie znaleziono* /
  *bez metryk* / *nieprzeszukane* i szacunkiem roku urodzenia (▲, np. „szac. 1790 ze ślubu 1815”).
- **Znane księgi urodzeń** z dostępem: *online za darmo*, *online, logowanie*, *czytelnia*, *na wniosek*,
  *niezachowane*.
- **Zadania:** miejsce w kolejce albo dlaczego stoją (*wstrzymana linia*, *zakończona linia*, *rodzina spoza
  drzewa*, *odłożone do …*); zakończone pod **Wypróbowane zadania · n**.
- **Praca:** liczba wyszukiwań, liczba sesji agenta z kosztem, „ostatnio …”. W archiwum sesji ani kosztu nie ma.
- **Hipotezy:** możliwe połączenie z inną osobą, rodzina spoza drzewa („rodzina spoza drzewa, 4 osoby”), ile zadań
  czeka, które zadania testują hipotezę.
- Link „2 otwarte sprzeczności ↓” przewija do sekcji **Sprzeczności**.
- **Granice:** „stan na …” jest w nagłówku sekcji tylko wtedy, gdy badanie jest starsze niż dzisiejszy dzień.
- **Obsługa:** aplikacja: **Ustawienia → Wyświetlanie drzewa → Krawędź badania** (*Wyłączone* / *Do załatwienia* /
  *Wszystko*) steruje tylko zaczątkami nad kartami, nie tą sekcją. Opcja jest tylko przy drzewie genealogicznym
  z badania. *Do załatwienia* brakuje przy kopii, która nie ma kolejki. Terminal: `strom edge`.
- **Obowiązuje od:** aplikacja 3.6.0 z badaniem 1.9.0; kilka rodzin spoza drzewa od aplikacji 3.13.0 z badaniem
  1.16.0

<!-- zdroj: app:src/ui/research-edge-ui.ts researchEdgeSectionHtml, :372-373 stale asOf, :445-448 sessions/cost, edgeOf · :560-600 nastavení · index.html:22496, :22540 · strings.ts researchEdge.* · research:src/core/edge.ts EDGE_MISSING, EDGE_SCOPES, EDGE_ENDS, EDGE_NEXT · CHANGELOG 3.13.0 -->

<a id="S3.3.1"></a>
### S3.3.1 Działania przy Nad osobą

| Przycisk | Kiedy jest | Co otworzy |
|---|---|---|
| **Czat** (**Rozstrzygnij na czacie**, gdy „Teraz potrzebna jest decyzja”) | zawsze | rozmowę z agentem o osobie |
| **Przegląd osoby** | zawsze | przegląd osoby w badaniu |
| **Kontynuuj linię** | linia jest wstrzymana lub zakończona | terminal z wyborem linii |
| **Odpowiedz** | zadanie osoby czeka na odpowiedź | zadanie w badaniu ([R6](R6-awaiting-action.md)) |

- **Granice:** tylko przy osobie z badania, tylko tam, gdzie badanie zgłosiło link ([S3.2](#S3.2)). W archiwum
  i w badaniu, które czeka na agenta, nie ma żadnych, bo każdy prowadzi do agenta.
- **Obsługa:** aplikacja: przyciski pod sekcją.
- **Obowiązuje od:** aplikacja 3.6.0
- **Od aplikacji 3.22.0:** **Kontynuuj linię** wznawia linię bezpośrednio przez most, gdy badanie to potrafi,
  bez terminala.

<!-- zdroj: app:v3.21.2 src/ui/research-edge-ui.ts:489-506, :539-548 · HEAD research-edge-ui.ts managesDirections -->

<a id="S3.4"></a>
## S3.4 Sprzeczności

Sekcja **Sprzeczności** pokazuje sprzeczności osoby i rodzin, w których osoba jest partnerem. Otwarte są pierwsze,
potem rozstrzygnięte z wierszem „rozstrzygnięto: … (…)”. Źródło można otworzyć w przeglądarce źródeł.
Czym jest sprzeczność, gdzie ją widać i jak się ją rozstrzyga, opisuje [R5.6](R5-conflicts.md#R5.6). Rozstrzygnięcie
stroną z aplikacji opisuje [R5.6.1](R5-conflicts.md#R5.6.1).

- **Granice:** **Rozstrzygnij w badaniu** i **Zostaw agentowi** są tylko przy osobie z badania i tylko tam, gdzie
  badanie je zgłosiło.
  **Zostaw agentowi** brakuje w archiwum i w badaniu, które czeka na agenta.
- **Obsługa:** zob. [R5.6](R5-conflicts.md#R5.6).
- **Obowiązuje od:** aplikacja 3.4.0 z badaniem 1.6.0
- **Od aplikacji 3.22.0:** sprzeczność powstała przez zmianę w aplikacji niesie tekst „Zmiana w aplikacji różni
  się tu od badania; rozstrzyga się to w badaniu.” (dotąd zawsze „Tutaj różnią się źródła; rozstrzyga się to
  w badaniu.”).

<!-- zdroj: app:src/ui/person-research-ui.ts showPersonResearchDialog (Rozpory), activeResearchNoAgent · research:src/gedcom/export.ts:760-805 · HEAD person-research-ui.ts conflictFromEdit, strings.ts conflict.editOnly · HEAD research-decide.ts conflictFromEdit -->

<a id="S3.5"></a>
## S3.5 Hipotezy

Sekcja **Hipotezy** pokazuje hipotezy, które dotyczą osoby: jest ich przedmiotem albo wymienia ją któraś wersja.
Każda hipoteza jest rozwijana. Pod nazwą jest numer i stan: *otwarta*, *rozstrzygnięta na rzecz B*, *porzucona*,
liczba wersji i uwaga. Otwarte są rozwinięte.

- **Wiersz wersji:** litera i twierdzenie (długie się rozwija) i co wersja robi z drzewem: „pokazano · + 2 osoby ·
  Znajdź”, „+ 2 osoby”, „Drzewo już tak to zapisuje”, „Tylko tekst, nie można pokazać.”, „bez powiązania z osobami
  drzewa”, przy rozstrzygniętej *wybrana*, „Teraz połączone naprawdę”, „Już nieważne: …”.
- **Które hipotezy badanie wysyła:** otwarte; rozstrzygnięte i porzucone tylko te, których wersje niosą powiązania.
  Odwołane nigdy.
- **Kto rozstrzygnął:** hipoteza, którą rozstrzygnął agent ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)), niesie
  *rozstrzygnął agent* z dniem i **Uzasadnienie** (tekst rozstrzygnięcia w języku badania; długi się rozwija).
- **Granice:** rozstrzygnąć hipotezy z aplikacji nie można; rozstrzyga się ją w badaniu, w terminalu
  ([R10.3.1](R10-people-and-hypotheses.md#R10.3.1)). Kto rozstrzyga, człowiek czy agent, jest wyborem badania
  ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)).
- **Propozycja Rozstrzyga AI:** przy zapisanym **Rozstrzyga człowiek** i 10 lub więcej otwartych hipotezach drzewa
  nad hipotezami stoi zdanie „N otwartych hipotez czeka na rozstrzygnięcie człowieka; przy „Rozstrzyga AI” agent
  rozstrzyga je sam, każdą z uzasadnieniem.” Przełączenie potwierdza się w badaniu, w aplikacji AI się nie włącza
  ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)).
- **Obsługa:** aplikacja: przełącznik **Pokaż** przy wersji ([S3.5.1](#S3.5.1)); **Rozstrzygnij w badaniu**, przy
  rozstrzygniętej **Zmień w badaniu**, otwiera hipotezę w badaniu na tym komputerze; **Przełącz na „Rozstrzyga AI”**
  otwiera badanie w terminalu, **Ukryj** ukrywa propozycję dla tego badania.
- **Obowiązuje od:** aplikacja 3.11.0 z badaniem 1.14.0 (wersje, stan, **Pokaż**); lista hipotez od aplikacji 3.4.0
- **Od aplikacji 3.25.0:** *rozstrzygnął agent* z uzasadnieniem (z badaniem 1.29.0), **Rozstrzygnij w badaniu**,
  **Zmień w badaniu** i propozycja **Rozstrzyga AI**.

<!-- zdroj: app:src/ui/person-research-ui.ts researchHypothesesHtml · strings.ts research.hypo*, hypoByAgent, hypoReason, hypoChange, decideInResearch, viewLinks.*, hypoOfferAgent, hypoOfferSwitch, hypoOfferHide · person-research-ui.ts researchHypothesesOffer (HYPOTHESES_OFFER_MIN = 10) · research:src/gedcom/export.ts:309-325 hypothesisPeople, _BY agent / DECI / _AT (brána APP_SHOWS_HYPOTHESIS_DECIDER) · CHANGELOG 3.11.0, 3.25.0 -->

<a id="S3.5.1"></a>
### S3.5.1 Pokaż: połączone tylko w widoku

Przełącznik **Pokaż** rysuje wersję hipotezy w drzewie jako „Połączone tylko w widoku”. Dane drzewa genealogicznego
się przez to nie zmieniają. Wersje jednej hipotezy się wykluczają; włączona może być najwyżej jedna albo żadna.

- **Granice:**
  - przełącznik jest tylko przy otwartej hipotezie i tylko przy wersji, którą można narysować;
  - rysuje się tylko w widokach Rodzina i Potomkowie ([A6](A6-views.md));
  - wybór należy do urządzenia i drzewa genealogicznego; idzie z kopią zapasową wszystkiego, nie z kopią drzewa
    genealogicznego;
  - z mostem tylko wtedy, gdy badanie wysyła powiązania hipotez.
- **Obsługa:** aplikacja: **Pokaż** w oknie; przy narysowanym powiązaniu menu **Co wie badanie o powiązaniu**.
- **Obowiązuje od:** aplikacja 3.11.0 z badaniem 1.14.0

<!-- zdroj: app:src/view-links.ts strom-view-links:{treeId}, strom-view-links-master:{treeId}, viewLinksAvailable (HYPOTHESIS_LINKS) · src/ui/view-links-ui.ts:326 · strings.ts viewLinks.state -->

<a id="S3.6"></a>
## S3.6 Przeszukano

Sekcja **Przeszukano** to tabela wyszukiwań, które badanie zapisało do osoby: **Zapis**, **Lata**, **Wynik**
(*znaleziono* / *nic*). Sortuje się według pierwszego roku. Należą tu wyszukiwania z zadań, których przedmiotem jest
osoba.

- **Granice:** badanie rozróżnia więcej wyników, niż aplikacja pokazuje. *znaleziono* to tylko znaleziony zapis.
  Wszystko inne, także wyszukiwanie częściowe lub bez wniosku, to *nic*. Czym jest wyszukiwanie bez wyniku, opisuje
  [R3.6](R3-verification-and-citation.md#R3.6).
- **Obsługa:** aplikacja: tylko odczyt. Terminal: wyszukiwania zapisuje agent.
- **Obowiązuje od:** aplikacja 3.4.0 z badaniem 1.6.0

<!-- zdroj: app:src/ui/person-research-ui.ts (Prohledáno) · src/ged-parser.ts _STROM_SEARCHED (TITL, DATE, RESN, _AT) · research:src/gedcom/export.ts:760-805 RESN found|none · strings.ts research.searched*, found, none -->

<a id="S3.7"></a>
## S3.7 Sekcja Co wie badanie w panelu badania

Panel badania ma sekcję **Co wie badanie** z podsumowaniem „3 sprzeczności · 1 hipoteza”. Ma wiersz dla każdej
otwartej sprzeczności („Marie Vlková · urodzenie: 1790 × 1791”), a potem dla każdej otwartej hipotezy („Marie Vlková ·
Hipoteza: Otec z Horákova mlýna”). Kliknięcie otwiera okno osoby przy danej sprzeczności lub hipotezie.

- **Granice:**
  - panel jest widoczny tylko przy śledzeniu na żywo badania, które się nie zakończyło i należy do otwartego drzewa
    genealogicznego ([S4](S4-research-from-the-app.md));
  - bez otwartych sprzeczności i hipotez sekcji nie ma.
- **Obsługa:** aplikacja: panel badania, sekcja **Co wie badanie**.
- **Obowiązuje od:** aplikacja 3.5.0

<!-- zdroj: app:src/ui/research-overview-ui.ts appendOverviewKnows · strings.ts live.knowsTitle, live.hypothesisRow · commit 228ac6a -->
