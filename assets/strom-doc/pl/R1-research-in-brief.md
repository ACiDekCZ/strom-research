<a id="R1"></a>
# R1 Badanie w skrócie

Jak badanie działa jako całość, na jednej stronie. Każda sekcja prowadzi do rozdziału z dokładnymi zasadami. Opisuje
badanie 1.25.2 i aplikację Strom 3.21.2.

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

<!-- zdroj: research:src/commands/run.ts · assets/method/core.md „The time is strom's to say“ -->

<a id="R1.4"></a>
## R1.4 Jak badanie waży dowody

Agent pracuje według **Genealogical Proof Standard** (GPS): rzetelne wyszukiwanie, cytowanie każdej danej, analiza
i porównanie dowodów, rozwiązywanie sprzeczności i spisany wniosek, który zrozumie kolejny badacz.

- Każda dana ma stopień pewności: **Wskazówka**, **Możliwe**, **Prawdopodobne**, **Udokumentowane**. Drzewo
  genealogiczne i pamięć rodzinna są zawsze tylko wskazówką, indeks służy do odnalezienia wpisu. Szczegółowo:
  [R3](R3-verification-and-citation.md).
- Imiennik nie jest szukaną osobą. Osobę wyznacza rok, miejsce, dom, zawód, mąż lub żona i rodzice. Dwa akty
  z tym samym imieniem i innymi rodzicami to dwie osoby. Identyfikacja osób, ich imiona i nazwiska oraz konkurujące
  hipotezy: [R10](R10-people-and-hypotheses.md).
- Nieudane wyszukiwanie to wynik. Zapisuje się, co dokładnie przeszukano, aby tej samej księgi nie przeszukiwać
  dwa razy.
- Gdy akty się różnią, agent nie wybiera po cichu: zapisuje **sprzeczność**. Szczegółowo: [R5](R5-conflicts.md).
- Miejsce dostaje położenie na mapie tylko wtedy, gdy jest pewne, które to miejsce. Szczegółowo: [R4](R4-places.md).

<!-- zdroj: research:assets/method/core.md (úvod, „Certainty is explicit“, „A namesake is not your person“, „Negative results are results“) -->

<a id="R1.5"></a>
## R1.5 Co rozstrzyga człowiek

Niektóre decyzje należą tylko do człowieka. Badanie pyta o nie w **Czeka na decyzję**, a agent nie odpowiada za
człowieka.

- Co czeka na człowieka (listy, skany do pobrania, pytania o miejsca, sprzeczności, opowieści do zatwierdzenia)
  i gdzie się to załatwia: [R6](R6-awaiting-action.md).
- Decyzja człowieka obowiązuje. Agent zmienia ją tylko na podstawie nowego źródła: [R5.4](R5-conflicts.md#R5.4).
- Położenie miejsca wprowadzone przez człowieka się nie zmienia: [R4.3](R4-places.md#R4.3).
- Ustawienia, które zmieniają, co wolno agentowi, potwierdza człowiek (na przykład warunek samodzielnej pracy,
  [R7](R7-when-the-agent-works.md)).

<!-- zdroj: research:assets/method/waiting.md · src/core/conflicts.ts againAllowed · src/core/placeid.ts personsHand · src/core/config.ts run.gate -->

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
