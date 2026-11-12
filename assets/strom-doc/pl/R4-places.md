<a id="R4"></a>
# R4 Miejsca

Jak badanie identyfikuje miejsca z danych, kiedy miejsce dostaje położenie na mapie i co o miejscu rozstrzyga
człowiek. Opisuje badanie 1.25.2 i aplikację Strom 3.21.2. Zmiany z nowszej wersji mają przy sobie jej numer.

<a id="R4.1"></a>
## R4.1 Miejsce dostaje położenie, tylko gdy jest pewne

Badanie ustala, która miejscowość o danej nazwie to jest, z kontekstu aktów: parafia, powiat, lata. Złe miejsce jest
gorsze niż żadne. Dlatego identyfikacja ma trzy stopnie, a współrzędne dostaje tylko miejsce pewne.

- **Pewne:** parafia, powiat i lata aktów zgadzają się z jedną miejscowością. Miejsce dostaje współrzędne, nazwy
  i przynależność.
- **Prawdopodobne:** badanie proponuje od 1 do 3 kandydatów, a rozstrzyga człowiek w Czeka na załatwienie (zob.
  [R4.5](#R4.5)).
- **Nie można ustalić:** miejsce zostaje poza mapą. Badanie zapisuje, dlaczego się nie da i co by rozstrzygnęło.
- **Granice:** najwyżej 3 kandydatów. Powód i „co by rozstrzygnęło” mają każde najwyżej 300 znaków. Badanie szuka od
  tańszego do droższego: najpierw drzewo i jego źródła, potem zasady zapisu, internet na samym końcu. Do wyszukiwania
  trafiają tylko nazwy miejsc, parafii i powiatów, nigdy imiona osób ani daty ich życia.
- **Obsługa:** aplikacja: stan miejsca **Jeszcze nie na mapie**, **W kolejce badania**, **Trwa wyszukiwanie…**,
  **Do potwierdzenia**, **Nieustalone**, **Do sprawdzenia**; pochodzenie położenia **Ustalone przez badanie**;
  w szczegółach **Dlaczego tutaj**, **Co by rozstrzygnęło**, **Źródło** · terminal: `strom place identify`,
  `strom place propose`, `strom place unlocated` (polecenia agenta)
- **Obowiązuje od:** badanie 1.25.0, aplikacja 3.21.0

<!-- zdroj: research:src/commands/placeid.ts:80 identify, :124 unlocated (why/needs ≤300), :144 propose (candidate 1–3) · research:src/brief/places.ts (tři stupně, web až nakonec) · research:assets/lang/cs.json ui.link.places.private · app:src/strings.ts cs places (v3.21.2 :9897) -->

<a id="R4.1.1"></a>
### R4.1.1 Ta sama nazwa, inne miejsce

Miejscowości o tej samej nazwie bywa więcej. Rozróżnia je parafia i powiat z aktów, nie sama nazwa. Zmyślony
przykład: rodzina Horákovi mieszkała „w Lhocie”; z księgi metrykalnej znana jest parafia, a ona pokazuje, która to
Lhota.

- **Granice:** aktu innego miejsca bliżej niż 1,5 km badanie nie może przeoczyć. Albo chodzi o jedno miejsce i łączy
  akty, albo wyraźnie stwierdza, że chodzi o inne miejsce (część miejscowości, sąsiednia). Połączyć można tylko akty
  w odległości do 1,5 km, a położenie wprowadzone przez człowieka ma pierwszeństwo. Aktów położonych dalej od siebie
  badanie nie łączy i pyta człowieka. Nazwę, którą noszą dwa akty, trzeba podać identyfikatorem miejsca (L0012).
- **Obsługa:** terminal: `strom place identify --separate <L…>`, `strom place merge <L…> --into <L…>`
- **Obowiązuje od:** badanie 1.25.2

<!-- zdroj: research:src/core/placeid.ts NEAR_KM=1.5 (:575), mergePlaces, errors place.near / place.far · research:src/commands/placeid.ts:80 --separate, :203 merge · CHANGELOG.cs.md 1.25.2 -->

<a id="R4.1.2"></a>
### R4.1.2 Nieodnalezione miejsce wraca samo

Miejsce, którego nie dało się ustalić, badanie ponownie umieszcza w kolejce, gdy drzewo wie o nim więcej: przybędzie
dana z cytatem, przynależność lub miejsce nadrzędne. Człowiek nie musi o to prosić.

- **Granice:** takie miejsce nie idzie w pierwszej kolejności, bo nie umieścił go w kolejce człowiek (zob.
  [R4.4](#R4.4)).
- **Obowiązuje od:** badanie 1.25.0

<!-- zdroj: research:src/core/placeid.ts contextOf, requeue of unlocated (K2.3) · placesFirst counts only entries queued by the person · CHANGELOG.cs.md 1.25.0 -->

<a id="R4.2"></a>
## R4.2 Nazwy i przynależność miejsca

Pierwsza nazwa miejsca to dzisiejsza urzędowa nazwa w języku kraju, w którym miejsce dziś leży. Dawne nazwy, nazwy
w innych językach i inne zapisy ze źródeł są przy miejscu obok niej, z językiem i latami. Przynależność mówi, do czego
miejsce należało: parafia, gmina, powiat i inne, zawsze z latami od–do.

- **Granice:** inna nazwa ma język i lata; jeden rok oznacza, że nazwa jest w tym roku udokumentowana. Rodzaje
  przynależności: parafia, administracja cywilna, diecezja, dobra (majątek), powiat, województwo, państwo, inne.
  Usunąć można tylko nazwę, która nie jest pierwsza i której nie zapisuje już żadna dana. Błędną przynależność
  badanie usuwa tylko z podaniem powodu.
- **Obsługa:** aplikacja: w szczegółach miejsca **Dziś**, **Wcześniej**, **Inna nazwa**, **Inny zapis**; etykiety
  **forma główna**, **inny zapis**, **dawna nazwa**, **inna nazwa** · terminal: `strom place identify|verify --name --alt
  <název@jazyk:od-do> --form --jurisdiction <druh:název:od-do>`, `strom place names <L…> --drop <název> --why`
- **Obowiązuje od:** badanie 1.25.0; dzisiejsza nazwa jako pierwsza i `strom place names` od badania 1.25.2

<!-- zdroj: research:src/core/placeid.ts todayName, parseJurisdiction, dropPlaceNames · research:src/core/places.ts JURISDICTIONS = parish, civil, diocese, manor, district, county, state, other · research:src/commands/placeid.ts:167 verify, :258 names · research:src/brief/places.ts (today's name rule) · app:src/strings.ts cs places tags/detail -->

<a id="R4.2.1"></a>
### R4.2.1 Jak dane zapisują miejsce

W danej miejscem jest miejscowość. Ulica i numer domu należą do osobnego pola domu. Gdy dane zapisują miejsce
inaczej, badanie zmianę tylko proponuje, a człowiek potwierdza ją pytaniem **Propozycja zapisu**.

- **Granice:** już zapisanego domu się nie nadpisuje. Transkrypcji źródła nie zmienia się w żadnym przypadku.
- **Obsługa:** aplikacja: Czeka na załatwienie, **Propozycja zapisu**, **Tak** / **Nie** · terminal: **Wprowadź dane
  w ten sposób** / **Pozostaw dane bez zmian**; `strom place rewrite --propose`, `--house`
- **Obowiązuje od:** badanie 1.25.0

<!-- zdroj: research:src/commands/placeid.ts:225 rewrite · app:src/strings.ts formExplain · research:src/cli/menu-waiting.ts:523–560 (v1.25.2) -->

<a id="R4.3"></a>
## R4.3 Położenia wprowadzonego przez człowieka badanie nie zmienia

Położenie, które człowiek umieścił ręcznie, należy do człowieka. Badanie go nie przesuwa, nie usuwa ani nie oznacza
jako nieodnalezione. Gdy akty mówią coś innego, pyta w Czeka na załatwienie pytaniem **Sprzeczne położenie**.

- **Granice:** położenie ręczne to każde położenie bez zapisu, kto je ustalił, i każde położenie z aplikacji. Badanie
  może przy nim tylko potwierdzić, że akty się zgadzają, albo zapisać, że nie da się tego rozstrzygnąć. Zapisuje przy
  tym nazwy i przynależność, współrzędne zostawia. Odpowiedź **Zachowaj** obowiązuje, dopóki położenie się nie
  zmieni; o tę samą sprzeczność badanie nie pyta ponownie. Zbiorcze załatwienie nie przyjmuje położenia ręcznego za
  człowieka (zob. [R4.5](#R4.5)).
- **Obsługa:** aplikacja: pochodzenie **Umieszczone ręcznie**, **Umieść ręcznie na mapie**; tekst „Ręcznego położenia
  badanie nie zmienia; pyta tylko w zakładce Czeka, gdy znajdzie sprzeczność.” · terminal: pochodzenie „wpisane
  ręcznie”; `strom place verify --ok|--undecided`, `strom place propose --conflict` (polecenia agenta)
- **Obowiązuje od:** badanie 1.25.0, aplikacja 3.21.0

<!-- zdroj: research:src/core/placeid.ts personsHand (:714), proposePlace kept → place.kept · research:src/commands/sources.ts place edit ~:976 (agent refused on personsHand) · research:src/core/sync.ts:3401 byPerson · research:assets/lang/cs.json ui.wait.place.by.person · app:src/strings.ts whoHand, pvHand -->

<a id="R4.4"></a>
## R4.4 Kolejka miejsc

Miejsca do identyfikacji umieszcza w kolejce człowiek. Samo umieszczenie w kolejce niczego nie zapisuje, a agent przy
nim nie pracuje. Badanie przetwarza kolejkę w sesjach według obszarów, gdzie obszar to archiwum większości źródeł
miejsca.

- **Granice:** najwyżej 15 miejsc na sesję, małe obszary idą razem. Najpierw idą miejsca, przy których aplikacja
  zgłasza **Do sprawdzenia**, potem według czasu umieszczenia w kolejce. Jedno umieszczenie obejmuje najwyżej 5000
  miejsc. Miejsce już na mapie umieszcza się w kolejce tylko do sprawdzenia. Miejsca, nad którym właśnie trwa sesja,
  nie można umieścić w kolejce ani z niej usunąć. Szacunek czasu trwania pokazuje się od razu, szacunek kosztu dopiero
  po 3 zmierzonych sesjach. Zadanie miejsc umieszczonych w kolejce przez człowieka to krótka praca, która idzie
  najpierw (klucz 5 w [R2.2](R2-lines-and-queue.md#R2.2)). Zadanie nie należy do żadnej linii, dlatego nigdy nie
  jest pracą poza liniami.
- **Obsługa:** aplikacja: **Odszukaj w badaniu**, **Sprawdź w badaniu**, **Usuń z kolejki**, **Uruchom teraz**,
  **Odszukaj wszystkie spoza mapy (n)**, **Sprawdź wszystkie przypisania (n)** · terminal: zadanie „Zidentyfikować
  miejsca danych w kolejce (n)”; `strom place queue [--all] [--check]`, `strom place unqueue [--all]`
- **Obowiązuje od:** badanie 1.25.0, aplikacja 3.21.0; sesje według obszarów od badania 1.25.2

<!-- zdroj: research:src/core/placeid.ts BATCH_MAX=15 (:31), REQUEST_MAX=5000, BATCH_MINUTES, MEASURED_MIN=3, PLACE_FLAGS, queueOrder (:225), raisePlacesTask (priority 5, level enrich), placesFirst · research:src/core/queue.ts rankTasks first (v1.25.2 :142–280) · research:src/commands/placeid.ts:283 queue, :320 unqueue · app:src/place-check.ts PLACE_FAR_KM=60 -->

<a id="R4.4.1"></a>
### R4.4.1 Kiedy aplikacja zgłasza Do sprawdzenia

Aplikacja sama, bez badania, oznacza położenie, które nie pasuje do drzewa. Niczego w nim nie zmienia.

- **Granice:** miejsce leży dalej niż 60 km od wszystkich innych miejsc rodziny w przedziale ±20 lat; akt z badania
  wymienia inną parafię lub powiat; znaleziony opis to ulica lub część miejscowości; wyszukiwanie znalazło więcej
  miejscowości o tej nazwie. Położenie z odpowiedzią **Zachowaj** i położenie potwierdzone przez badanie nie są
  zgłaszane, dopóki się nie przesuną.
- **Obowiązuje od:** aplikacja 3.21.0; granica 60 km od aplikacji 3.21.1

<!-- zdroj: app:src/place-check.ts:1–31 PLACE_FAR_KM=60, PLACE_YEARS=20 · app CHANGELOG.cs.md 3.21.1 -->

<a id="R4.5"></a>
## R4.5 Pytania o miejsca w Czeka na załatwienie

Na pytania o miejsca odpowiada tylko człowiek, w aplikacji lub w terminalu. Agent na nie nie odpowiada. Pytania są
trzech rodzajów: **Gdzie jest** (kandydaci), **Sprzeczne położenie** (położenie na mapie wobec aktów) i **Propozycja
zapisu** (jak dane zapisują miejsce).

| Odpowiedź (aplikacja) | Terminal | Co się dzieje |
|---|---|---|
| **To jest A** (B, C) | nazwa kandydata | Miejsce dostaje położenie kandydata jako położenie ręczne. |
| **Żaden z nich** | **Żadne z nich** | Miejsce zostaje poza mapą. |
| **Nie wiem** | **Nie można określić** | Miejsce zostaje poza mapą. |
| **Zachowaj** | **Zachowaj położenie na mapie** | Położenie zostaje, a o tę samą sprzeczność badanie nie pyta ponownie. |
| **Tak** / **Nie** | **Wprowadź dane w ten sposób** / **Pozostaw dane bez zmian** | Dane zostają nadpisane albo pozostają. |

- **Granice:** **Żaden z nich** i **Nie wiem** badanie przyjmuje tylko przy pytaniu **Gdzie jest**. Odpowiedź się nie
  zapisuje, gdy pytanie w międzyczasie się zmieniło; aplikacja odświeża wtedy Czeka. **Przyjmij wszystkie propozycje
  (n)** bierze przy pytaniu **Gdzie jest** kandydata A, przy sprzecznym położeniu zachowuje położenie. **Zachowaj
  wszystkie (n)** zachowuje położenie przy sprzecznościach. Zbiorcze załatwienie pomija położenia ręczne. Jeden krok
  **Cofnij** cofa całe zbiorcze załatwienie. Kolejność pytań wśród innych spraw w Czeka opisuje
  [R6](R6-awaiting-action.md).
- **Obsługa:** aplikacja: okno **Czeka na załatwienie · Miejsca**, grupa **Miejsca**, **Odpowiedz**, **Według obszarów:** ·
  terminal: **Co czeka → Miejsca do identyfikacji**; `strom place answer <L…> --take c1|c2|c3|keep|unknown|none|yes|no|first`
  z `--dry` i `--expect`
- **Obowiązuje od:** badanie 1.25.0, aplikacja 3.21.0
- **Od badania 1.26.0:** mała mapa przy pytaniu pokazuje tylko punkty pytania i odległość od propozycji (aplikacja 3.22.0).
- **Od badania 1.26.0:**
  - terminal mówi słowami aplikacji **Nie wiem** i **Żaden z nich**;
  - **Nie wiem** działa też przy pytaniu **Sprzeczne położenie** (położenie zostaje, pytanie znika, badanie może
    zapytać ponownie) i przy pytaniu **Propozycja zapisu** (dane zostają bez zmian). Aplikacja 3.22.0 proponuje je
    tam tylko z badaniem 1.26.0. **Żaden z nich** zostaje tylko przy pytaniu **Gdzie jest**;
  - **Przyjmij wszystkie propozycje (n)** (`--take first`) bierze kandydata A także przy sprzecznym położeniu.
    Położenia wpisanego ręcznie nie nadpisuje nigdy: taką sprzeczność pomija.

<!-- zdroj: research:src/commands/placeid.ts:345 answer (person only) · research:src/core/placeid.ts PLACE_TAKES, answerOne ~:1195 · research:src/core/waiting.ts:395–420 (v1.25.2) wait.group.places · research:src/cli/menu-waiting.ts:523–560 · app:src/waiting-places.ts placeQuestionChoices :40, bulkAcceptable :140, bulkKeepable, placeAreas · app:src/strings.ts waiting.* · app CHANGELOG.cs.md 3.22.0 · 1.26.0: research:src/core/placeid.ts answerOne (first: locating.by person vynechá; unknown u conflict a form), cs.json ui.wait.place.unknown/none (commit fe59fb40) · app:src/waiting-places.ts PLACES_UNKNOWN_ALL_SINCE, ui/waiting-places-ui.ts:645 take first -->

<a id="R4.5.1"></a>
### R4.5.1 Cofnięcie kroku

Każdy krok przy miejscach można cofnąć: odpowiedź, usuniętą nazwę, porządkowanie kolejki i jednorazową poprawkę
zapisów miejsc. Cofnięcie należy do człowieka.

- **Granice:** ostatnich 20 kroków, każdy osobno według swojego identyfikatora. Kroku nie można cofnąć, gdy miejsce od
  tego czasu się zmieniło.
- **Obsługa:** aplikacja: **Cofnij** · terminal: `strom place undo <krok>`
- **Obowiązuje od:** badanie 1.25.2 (w badaniu 1.25.0 tylko ostatni krok)

<!-- zdroj: research:src/core/placeid.ts UNDO_KEPT=20 (:102), undoPlaces · research:src/commands/placeid.ts:399 undo (person only) · CHANGELOG.cs.md 1.25.0 / 1.25.2 -->

<a id="R4.6"></a>
## R4.6 Miejsca z innych badań na tym komputerze

Badanie nie przejmuje współrzędnych ani danych z innych drzew. Przejmuje tylko przypisanie miejsca do regionu historii
i pokazuje agentowi akty innych badań jako propozycję.

- **Granice:** badanie 1.24.0 przejmuje przypisanie do regionu historii tylko wtedy, gdy mają je wszystkie badania
  jednakowo. To samo miejsce to takie, które leży w odległości do 2 km, ma tę samą parafię albo ten sam powiat lub
  województwo; dalej niż 5 km to inne miejsce. Z rodziny nic się nie przenosi. Badanie 1.25.0 pokazuje przy
  identyfikacji parafię, powiat i współrzędne miejsca z innego badania. Agent używa ich tylko tam, gdzie zgadza się
  parafia lub powiat.
- **Obsługa:** terminal: `strom history adopt --dry-run` (tylko z włączoną historią)
- **Obowiązuje od:** badanie 1.24.0 (regiony), badanie 1.25.0 (propozycja przy identyfikacji)

<!-- zdroj: research:src/core/placeadopt.ts SAME_KM=2, OTHER_KM=5 · research:src/brief/places.ts othersRecords · research:src/core/placeid.ts PLACE_BY (adopted never written) · CHANGELOG.cs.md 1.24.0 (l.114), 1.25.0 (l.77) -->

<a id="R4.7"></a>
## R4.7 Historia miejsc

Historia miejsc to udokumentowane wydarzenia w miejscach, w których mieszkała rodzina. Szuka się jej tylko wtedy, gdy
człowiek ją włączy. Badanie przypisuje w tym celu miejsca do regionów historii.

- **Granice:** zadanie historii przychodzi na kolej tylko czasem: mniej więcej co 5. sesję (domyślnie), rzadko mniej
  więcej co 10., albo tylko wtedy, gdy nie zostaje inna praca (klucz 3 w [R2.2](R2-lines-and-queue.md#R2.2)).
  Przypisanie miejsc do regionów i miejsce, o które poprosił człowiek, idą przed badaniem. Historia miejsca obejmuje
  miejsce i okolice mniej więcej do 10 km. Zadanie historii agent bierze tylko przy `strom run` lub
  `strom task next --history`, w rozmowie sam nie. Miejsce, którego nie da się przypisać, oznacza się jako
  nieodnalezione.
- **Obsługa:** aplikacja: **Historia miejsc**, **Znajdź historię miejsca i okolic…**, **Przypisz region**, stany
  **Historia miejsca: czeka**, **Historia miejsca: trwa wyszukiwanie**, **Badanie nie odnalazło miejsca** · terminal:
  **Ustawienia → Samodzielna praca agenta → Historia**; `strom config set experiments.history on`,
  `strom history place <L…>`, `strom history map --unlocated`
- **Obowiązuje od:** badanie 1.22.0

<!-- zdroj: research:src/core/pastevents.ts PACE_EVERY (:2621), experiments.historyPace · research:src/core/placehistory.ts · research:src/commands/history.ts place, map --unlocated, adopt · research:assets/lang/cs.json ui.alone.title, ui.alone.history · app:src/strings.ts history.* (v3.21.2 :13121–13235) · CHANGELOG.cs.md 1.22.0 (l.229) -->
