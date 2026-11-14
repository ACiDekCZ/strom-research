<a id="R1"></a>
# R1 Badanie w skrócie

Jak badanie działa jako całość, na jednej stronie. Każda sekcja prowadzi do rozdziału z dokładnymi zasadami. Opisuje
badanie 1.25.2 i aplikację Strom 3.21.2; zmiany z nowszej wersji mają przy sobie jej numer.

<a id="R1.1"></a>
## R1.1 Badanie to zapis, nie rozmowa

Badanie to folder na komputerze. Agent AI (na przykład Claude Code lub Codex) zapisuje do niego tylko poleceniem
`strom`: osoby, wydarzenia, źródła, przeprowadzone wyszukiwania, hipotezy i sprzeczności. Co nie jest zapisane
w badaniu, przepada wraz z końcem sesji, dlatego agent zapisuje na bieżąco.

- **Granice:** nic nie jest usuwane. Błędną daną wycofuje się z podaniem powodu, zmienioną daną poprawia się z podaniem
  powodu, a w historii zostaje także pierwotna postać.
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:assets/method/core.md „Nothing is deleted“, „Write as you go“ -->

<a id="R1.2"></a>
## R1.2 Nad czym agent pracuje

Co badanie bada, wyznaczają **linie**: przodkowie osoby, potomkowie osoby albo jedno pytanie. Z linii powstają
zadania, a otwarte zadania tworzą jedną **kolejkę**. Agent zawsze bierze pierwsze zadanie z kolejki. Praca nad ludźmi,
do których nie sięga żadna linia, przychodzi dopiero po pracy nad liniami.

- Zadania mają rodzaje w kolejności, w jakiej idą przy poza tym równym miejscu w kolejce: materiały od użytkownika,
  gdzie są akty, potwierdzenie powiązania, weryfikacja, wzbogacenie osoby, wniosek do archiwum, opowieść.
- **Najpierw drzewo, potem ponad nim:** rodziny znalezionej w aktach, której z drzewem nie łączy żadne udokumentowane
  powiązanie, nie bada się dalej, dopóki powiązanie nie zostanie udokumentowane
  ([R10.4](R10-people-and-hypotheses.md#R10.4)).
- Co badanie robi z materiałami od użytkownika: [R11](R11-material-from-the-user.md).
- Szczegółowo: [R2](R2-lines-and-queue.md).

<!-- zdroj: research:src/core/queue.ts LEVEL_ORDER · assets/method/core.md „The tree first, then above it“ -->

<a id="R1.3"></a>
## R1.3 Jak agent pracuje: sesje

Agent pracuje w **sesjach**. Jedna sesja to jedno zadanie z limitem czasu. Na końcu agent zapisuje, co jest gotowe
i co ma przyjść dalej, i zamyka sesję. Przy samodzielnej pracy idzie sesja za sesją, dopóki jest praca i pozwala
na to warunek ustawiony przez człowieka (na przykład tempo tygodniowego limitu subskrypcji).

- Badanie może być też tylko **Archiwum Strom**, nad którym agent nie pracuje: [R7.8](R7-when-the-agent-works.md#R7.8).
- Szczegółowo: [R7](R7-when-the-agent-works.md).
- Gdzie rozmawia się z agentem (terminal, aplikacja Claude albo ChatGPT) i czego strom gdzie pilnuje: [R12](R12-where-the-agent-works.md).

<!-- zdroj: research:src/commands/run.ts · assets/method/core.md „The time is strom's to say“ -->

<a id="R1.4"></a>
## R1.4 Jak badanie waży dowody

Agent pracuje według **Genealogical Proof Standard** (GPS): rzetelne wyszukiwanie, cytowanie każdej danej, analiza
i porównanie dowodów, rozwiązywanie sprzeczności i spisany wniosek, który zrozumie kolejny badacz.

- Każda dana ma stopień pewności: **Wskazówka**, **Możliwe**, **Prawdopodobne**, **Udokumentowane**. Drzewo
  genealogiczne, pamięć rodzinna i indeks są zawsze tylko wskazówką: indeks prowadzi do wpisu, dokumentuje dopiero
  sam wpis (indeksu pilnuje kod od badania 1.28.0). Szczegółowo: [R3](R3-verification-and-citation.md).
- Imiennik nie jest szukaną osobą. Osobę wyznacza rok, miejsce, dom, zawód, mąż lub żona i rodzice. Dwa akty
  z tym samym imieniem i innymi rodzicami to dwie osoby. Identyfikacja osób, ich imiona i nazwiska oraz konkurujące
  hipotezy: [R10](R10-people-and-hypotheses.md).
- Nieudane wyszukiwanie to wynik. Zapisuje się, co dokładnie przeszukano, aby tej samej księgi nie przeszukiwać
  dwa razy.
- Gdy akty się różnią, agent nie wybiera po cichu: zapisuje **sprzeczność**. Szczegółowo: [R5](R5-conflicts.md).
- Miejsce dostaje położenie na mapie tylko wtedy, gdy jest pewne, które to miejsce. Szczegółowo: [R4](R4-places.md).

<!-- zdroj: research:assets/method/core.md (úvod, „Certainty is explicit“, „A namesake is not your person“, „Negative results are results“) · src/core/evidence.ts isWeak (rejstřík od 1.28.0) -->

<a id="R1.5"></a>
## R1.5 Co rozstrzyga człowiek

Niektóre decyzje należą tylko do człowieka. Badanie pyta o nie w **Czeka na załatwienie**, a agent nie odpowiada za
człowieka.

- Co czeka na człowieka (listy, skany do pobrania, pytania o miejsca, sprzeczności, hipotezy, opowieści do
  zatwierdzenia) i gdzie się to załatwia: [R6](R6-awaiting-action.md).
- Hipotezę rozstrzyga człowiek, a agent proponuje rozstrzygnięcie (od badania 1.28.0):
  [R10.3.1](R10-people-and-hypotheses.md#R10.3.1). Od badania 1.29.0 to wybór badania: bez zapisanego wyboru
  rozstrzyga agent (**Rozstrzyga AI**), **Rozstrzyga człowiek** wybiera człowiek:
  [R10.3.2](R10-people-and-hypotheses.md#R10.3.2).
- Decyzja człowieka obowiązuje. Agent zmienia ją tylko na podstawie nowego źródła: [R5.4](R5-conflicts.md#R5.4).
- Położenie miejsca wprowadzone przez człowieka się nie zmienia: [R4.3](R4-places.md#R4.3).
- Ustawienia, które zmieniają, co wolno agentowi, potwierdza człowiek (na przykład warunek samodzielnej pracy,
  [R7](R7-when-the-agent-works.md)).

<!-- zdroj: research:assets/method/waiting.md · src/core/conflicts.ts againAllowed · src/core/placeid.ts personsHand · src/core/config.ts run.gate · src/commands/analysis.ts hypothesis decide (person, od 1.28.0) -->

<a id="R1.6"></a>
## R1.6 Badanie i aplikacja Strom

Aplikacja Strom pokazuje badanie jako drzewo genealogiczne: osoby, dane z ich stopniem pewności, źródła i sprzeczności,
a gdy agent pracuje, także bieżącą pracę. Zmiany w aplikacji wracają do badania. Zmiana danej, którą udokumentował
akt, nie nadpisuje jej, lecz staje się sprzecznością ([R5](R5-conflicts.md)). Współpracę aplikacji i badania opisze
część S.

<!-- zdroj: research:src/core/sync.ts:1-19 · app:strings.ts research.knows -->

<a id="R1.7"></a>
## R1.7 Jak badanie czyta skany

Większość danych pochodzi ze skanów ksiąg metrykalnych i innych ksiąg. Badanie najpierw ustala księgę, skany pobiera
tylko przez program pobierający archiwum i tylko te potrzebne. Księgę przeglądają **czytelnicy** (`strom read`):
samodzielni agenci, każdy z partią skanów. Wpis, który będzie cytowany, główny agent czyta sam z wycinka w pełnej
rozdzielczości i zapisuje go z wycinkiem i transkrypcją. Odczyt modelem AI nie jest stuprocentowy; ważne dane powinien
najlepiej sprawdzić jeszcze człowiek.

- Szczegółowo, z przebiegiem krok po kroku: [R8](R8-reading-scans.md).
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:assets/method/reading.md · assets/method/locate.md · assets/method/recording.md · src/commands/read.ts:183-200 -->

<a id="R1.8"></a>
## R1.8 Jak działa Strom: `strom doc`

Ta dokumentacja jest dołączona do badania i czyta się ją także bez internetu. `strom doc` wypisuje spis treści,
`strom doc R10.1` jedną zasadę razem z zasadami pod nią, a `strom doc <słowa>` szuka w nagłówkach, słowniczku pojęć
i tekście.

- **Granice:**
  - numer można napisać także małymi literami lub z myślnikiem (`r4.3`, `R4-3`). Nieznany numer kończy się błędem,
    który podaje najbliższe numery;
  - wyszukiwanie nie zwraca uwagi na znaki diakrytyczne ani wielkość liter. Pokazuje najwyżej 10 zasad, najlepsze
    pierwsze, i ile jest dalszych (`--limit` inna liczba);
  - tekst jest w języku badania (`--lang` inny). Język, na który dokumentacja nie jest przetłumaczona, dostaje
    angielski z uwagą;
  - przy zasadzie jest odnośnik do tej samej zasady na stromapp.info;
  - działa także poza badaniem i w Archiwum Strom i niczego nie zapisuje.
- **Tylko metodyka:** na pytanie człowieka, jak lub dlaczego Strom coś robi, agent odpowiada według `strom doc`:
  z numerem zasady i z odnośnikiem, który `strom doc` wypisuje.
- **Obsługa:** terminal: `strom doc`, `strom doc R2.3`, `strom doc hypotéza --lang en`, `--json`. Pomoc dla
  człowieka (`strom help --human`) kończy się odnośnikiem do `strom doc`. Aplikacja ma tę samą dokumentację w **Jak
  działa Strom** ([A1.7](A1-the-app-in-brief.md#A1.7)).
- **Obowiązuje od:** badanie 1.28.0

<!-- zdroj: research:src/commands/doc.ts (SEARCH_ROWS=10, --limit, ui.docs.fallback, docUrl) · src/core/doc.ts · assets/strom-doc/ (PIN) · src/agents/files.ts:188 "answer from `strom doc`" · src/cli/help.ts (help --human, poslední řádek) · CHANGELOG.cs.md 1.28.0 · commity 314ab218, 4acfb170 -->

<a id="R1.9"></a>
## R1.9 Pytania o dane drzewa: `strom query`

Na pytanie o dane drzewa (ilu młynarzy jest w rodzie, kto mieszkał pod numerem 12, kto urodził się w jednym miejscu
w jednym stuleciu) odpowiada jedno wywołanie `strom query`. Wypisuje wiersz dla każdej danej osoby: kto to jest i jak
jest spokrewniony z osobą wyjściową, co dana mówi, gdzie, kiedy, na ile jest pewna i z jakiego źródła. Polecenie tylko
czyta: niczego nie weryfikuje i niczego nie zapisuje.

- **Granice:**
  - dana rodziny (małżeństwo) ma wiersz dla każdego partnera. Wycofane osoby i dane nigdy, obalone dane tylko
    z `--status disproven`;
  - pokrewieństwo z osobą wyjściową (ustawienie `main.person`, w przeciwnym razie `--of P…`) jest słowami w języku
    badania, ze stroną i pokoleniem, na przykład **dziadek, ze strony ojca (G3)**. G1 to osoba wyjściowa, G2 jej
    rodzice. Bez osoby wyjściowej albo gdy jest wycofana, `strom query` odmawia i mówi, jak dalej
    (`strom config set main.person P…` albo `--of P…`);
  - czyje dane (`--kin`): `ancestors` osoba wyjściowa i linia prosta; `blood` (domyślnie) przodkowie i wszyscy ich
    potomkowie, także gałęzie boczne; `family` krewni i ich partnerzy; `all` całe drzewo;
  - filtry obowiązują wszystkie naraz: `--kind` (rodzaj danej: OCCU, RESI, BIRT …; nieznany rodzaj zostaje odrzucony
    z listą prawidłowych), `--occupation`, `--value` (powtórzony: którekolwiek ze słów), `--place`, `--house` (12
    znajdzie też č. 12 i Nr. 12), `--years` (1750-1850 lub jeden rok), `--surname` (także inne formy nazwiska:
    Horáková), `--source` (S… lub słowa tytułu), `--status`;
  - słowo jest szukane na początku słowa w wartości, opisie lub przyczynie danej, nie w notatce, bez względu na znaki
    diakrytyczne. Zawód jest szukany także w formach czeskich, niemieckich, łacińskich i polskich (mlynar znajdzie też
    Müller i molitor) oraz we własnych formach badania ([R1.9.2](#R1.9.2)); nagłówek wypisu wymienia te formy. Zawód,
    którego nie zna żadna lista, jest szukany tylko w zapisanej formie i wypis to mówi. `--exact` szuka tylko samego słowa;
  - `--count` wypisuje tylko liczby osób i danych; `--by generation|kin|place|decade|surname` dzieli je na grupy
    (według pokolenia gałęzie boczne mają własną grupę), bez `--count` wiersze według grup. Wiersze idą stronami
    (`--limit`, najwyżej 100, `--page`); `--json` daje przy osobie także odnośnik, który otwiera ją w aplikacji Strom;
  - osoby, które mają szukane słowo tylko gdzie indziej (imię, notatka), są liczone osobno, z poleceniem `strom find`,
    które je znajdzie. Gdy nic się nie znajdzie, wypis proponuje `strom find` i szerszy krąg `--kin`.
- **Tylko metodyka:** na pytanie o dane agent odpowiada jednym wywołaniem `strom query`, nie szukaniem osoba po osobie.
  Osobę wymienia z imienia i nazwiska z ID w nawiasie (Jan Horák (P0012)), pokrewieństwo całe, tak jak podał je
  `strom query`, nigdy skrócone, a źródło tytułem z S… w nawiasie. Przy każdej danej mówi, na ile jest pewna: jako
  fakt tylko udokumentowaną; prawdopodobna i możliwa dana ani wskazówka nie są udokumentowane. Wiersz `strom query`
  nie wystarczy, by stwierdzić, czyj jest zapis i kto jest kim, ani by zweryfikować lub zapisać daną: to idzie dalej
  ze źródeł i według metodyki ([R3](R3-verification-and-citation.md), [R10](R10-people-and-hypotheses.md)).
- **Obsługa:** terminal: `strom query`, na przykład `strom query --occupation mlynar --count --by generation`;
  `strom app --person P…` otwiera aplikację Strom na osobie (aplikacja przed 3.21 otwiera drzewo). `strom find` nadal
  szuka słowa w dowolnym tekście badania, a jego pomoc odsyła do `strom query`. `strom facts …` niczego nie wykonuje:
  mówi **„strom facts” to teraz „strom query” (te same opcje)** i całe wywołanie ze `strom query`.
- **Obowiązuje od:** badanie 1.32.0

<!-- zdroj: research:src/commands/query.ts (popis, volby, KIN_SETS, FACT_GROUPS, LIST_PAGE_MAX=100, elsewhereOf, tries) · src/core/query.ts (hlavička, kinSet, SHOWN_STATUSES, ASKED_STATUSES) · src/core/occupations.ts · src/commands/analysis.ts help find („the facts recorded of people … strom query“) · src/cli/execute.ts RENAMED, renamedCommand · src/agents/files.ts AGENTS.md „Questions over the data“ · src/commands/start.ts app --person · cs.json ui.query.*, ui.error.command.renamed · test/cli/query.test.ts · CHANGELOG.cs.md 1.32.0 · spec 081 K1–K7 · query bez hlavní osoby / odvolaná: src/commands/query.ts ofPerson (query.no-main, query.retracted), cs.json ui.error.query.*, commit 6cdab11b -->

<a id="R1.9.1"></a>
### R1.9.1 Opowieści: `strom query --story`

- `--story <słowo>` wypisuje osoby i pary, w których opowieści jest to słowo: wiersz na opowieść, ze zdaniem, w którym
  słowo jest, i ze źródłami, na których zdanie się opiera.
- **Granice:**
  - słowo jest szukane jak przy `--value` (bez względu na znaki diakrytyczne, z formami zawodu, `--exact`);
    powtórzone: którekolwiek;
  - długie zdanie jest skrócone wokół słowa. Opowieść czekająca na zatwierdzenie (także nowa wersja zatwierdzonej)
    ma **szkic**;
  - źródła zdania to te, które zdanie wymienia, w przeciwnym razie źródła danych opowieści z lat, o których zdanie
    wspomina. Gdy nie da się ich ustalić, wiersz pokazuje **źródła całej opowieści**;
  - opowieść pary ma wiersz dla każdego partnera. Pozostałe filtry wybierają osoby (te z pasującą daną); `--by` tylko
    `generation`, `kin`, `surname`.
- **Tylko metodyka:** opowieść opowiada dane na nowo. Agent odpowiada z danych i źródeł; opowieść tylko pokazuje, gdzie
  szukać.
- **Obowiązuje od:** badanie 1.32.0

<!-- zdroj: research:src/commands/query.ts (--story, --by place|decade odmítnuto, storyText, storyData) · src/core/query.ts findStories (hlavička: sourcesNamed, storySources, basis sentence|story) · cs.json ui.query.story.* · src/agents/files.ts „A story retells the facts“ · CHANGELOG.cs.md 1.32.0 -->

<a id="R1.9.2"></a>
### R1.9.2 Własne formy zawodów: `strom occupation`

Wbudowaną listę zawodów (83 zawody, każdy w formach czeskich, niemieckich, łacińskich i polskich) można uzupełnić
o własne formy badania: inny język, dawną pisownię lub zawód, którego lista nie zna. `strom query --occupation`
([R1.9](#R1.9)) znajdzie wtedy wszystkie formy jako jeden zawód, także z `--exact`, `--count` i `--story`
([R1.9.1](#R1.9.1)).

- **Granice:**
  - `strom occupation add` przyjmuje co najmniej dwie formy jednego zawodu. Forma, którą lista zna, dołącza do siebie
    pozostałe (kolejna forma młynarza); formy, których lista nie zna, są nowym zawodem. Forma jest w języku badania,
    inny język pisze się kodem przed formą: `de:Ölschläger`. Gdy formy są już jednym zawodem, nic się nie zapisuje;
  - każda grupa zachowuje, kto ją dodał (człowiek ręcznie lub agent podczas badania), dzień i z `--source` źródło,
    w którym forma wystąpiła;
  - człowiek dodaje i usuwa formy we własnym terminalu, bez agenta, i może usunąć każdą własną formę badania. Agent
    usuwa tylko formę dodaną przez agenta; tego, co dodał człowiek, nigdy nie zmienia ani nie usuwa. Wbudowana lista
    zostaje bez zmian;
  - `strom query` powie, gdy szukanego zawodu nie ma na żadnej liście (szukana jest tylko zapisana forma), i poda
    polecenie, które doda jego formy: „{słowo}: zawodu nie ma na liście, szukana jest tylko ta forma; inne formy doda:
    strom occupation add {słowo} <forma> [la:<forma> …]”;
  - własna lista to plik badania `quality/occupations.json` pod pieczęcią ([R14](R14-seal-and-integrity.md)). Gdy nie
    da się go odczytać, `strom query` i `strom occupation list` szukają tylko na wbudowanej liście i mówią to jednym
    wierszem ze `strom repair`; `add` i `remove` nic na nim nie zapiszą.
- **Tylko metodyka:** zawód, którego `strom query` nie znajdzie na żadnej liście, lub formę ze źródła, której lista nie
  ma, agent dodaje przez `strom occupation add … --source S…` razem z pozostałymi formami i mówi o tym użytkownikowi.
- **Obsługa:** terminal: `strom occupation add olejník de:Ölschläger`; `strom occupation list` (grupy badania: kto,
  kiedy, źródła), `strom occupation list mlynar` (formy jednego zawodu, własne z `*`), `strom occupation list --all`
  (wszystkie zawody); `strom occupation remove de:Ölschläger`.
- **Obowiązuje od:** badanie 1.32.0

<!-- zdroj: research:src/commands/occupation.ts (add: aspoň dva tvary, --source ověřený pramen, by human | agent podle tree.personWrites; list: bez slova skupiny s by/at/sources, se slovem tvary s * u vlastních, --all; remove: agent jen své, persons, builtin, unknown) · src/core/occupations.ts (OCCUPATIONS_FILE quality/occupations.json, parseForm kód jazyka, addOccupation: nic se nezapíše, když už jedno povolání; mergeOccupations, ownOrRefuse: nečitelný soubor → UsageError strom repair; writeOwn putFile zapečetěná operace) · src/commands/query.ts:254–265 (ui.query.occupation.unknown, ui.occupation.unreadable) · assets/terms/occupations.json (83 skupin) · src/agents/files.ts AGENTS.md „An occupation strom query says is in no list“ · cs.json ui.occupation.*, ui.query.occupation.unknown · commity 84e7fc0e, 0abe8793 · CHANGELOG.cs.md 1.32.0 -->
