# Jak działa Strom

[Čeština](../cs/README.md) · [English](../en/README.md) · [Deutsch](../de/README.md) · **Polski**

Na podstawie czego decyduje badanie (agent i polecenie `strom`) oraz aplikacja Strom: zasady, dokładne granice,
kolejność i miejsce, gdzie się czym steruje. Dla genealogów i zaawansowanych badaczy. Każdy rozdział i każda zasada
ma stały numer, do którego można się odwołać (np. R2.3). Pojęcia objaśnia [indeks pojęć](../REJSTRIK.md), wszystkie
numery są w [rejestrze numerów](../CISLA.md).

Części R (badanie), A (aplikacja) i S (aplikacja i badanie razem) są zatwierdzone, a ich numery są stałe.

## R Badanie

- [R1 Badanie w skrócie](R1-research-in-brief.md): jak badanie działa jako całość, na jednej stronie
- [R2 Linie i kolejka](R2-lines-and-queue.md): nad czym agent pracuje i w jakiej kolejności
- [R3 Weryfikacja i cytowanie](R3-verification-and-citation.md): stopnie pewności, co musi być spełnione dla Udokumentowane, źródła i wskazówki
- [R4 Miejsca](R4-places.md): identyfikacja miejsc, nazwy i przynależność, co rozstrzyga człowiek
- [R5 Sprzeczności](R5-conflicts.md): jak powstaje sprzeczność, kto ją rozstrzyga, czego agent nie nadpisze
- [R6 Czeka na załatwienie](R6-awaiting-action.md): czego badanie potrzebuje od człowieka i gdzie się to załatwia
- [R7 Kiedy i jak długo agent pracuje](R7-when-the-agent-works.md): sesje, limit czasu, warunek przebiegu, limit subskrypcji
- [R8 Wyszukiwanie i odczyt wpisów w skanach](R8-reading-scans.md): księga, skany przez program pobierający, czytelnicy, własny odczyt, zapis znaleziska i pewność
- [R9 Archiwa: co wolno agentowi, a co robi człowiek](R9-archives.md): rodzaje archiwów, zgoda, przeglądarka agenta, oczekiwanie na skany, co robi człowiek
- [R10 Osoby: identyfikacja, imiona i hipotezy](R10-people-and-hypotheses.md): imiennicy, scalenie dwóch wpisów, hipotezy, rodzina poza drzewem, imiona i nazwiska osoby
- [R11 Materiały od użytkownika](R11-material-from-the-user.md): pliki i teksty od użytkownika, dokument i wskazówka, przejęte drzewo genealogiczne, partia z aplikacji
- [R12 Gdzie agent pracuje i czego strom pilnuje](R12-where-the-agent-works.md): terminal, aplikacje Claude, ChatGPT (Codex) i OpenCode, Antigravity i Grok Build, samodzielny bieg: czego strom gdzie pilnuje i co robi człowiek
- [R13 Zgłosić problem: `strom error`](R13-reporting-a-problem.md): jeden plik ZIP do wysłania, co w nim jest, a czego nie, jaki problem i jakie polecenie, dane osób tylko za zgodą, agent i zgłaszanie problemu
- [R14 Pieczęć i integralność badania](R14-seal-and-integrity.md): co nie zgadza się z pieczęcią i drogi dalej (`strom repair`, `strom seal adopt`, `strom seal accept`), przyjęcie badania takiego, jakie jest, gdy zaginęła jego historia, historia starsza niż badanie, `strom repair` pyta człowieka i `strom repair undo`

## A Aplikacja Strom

- [A1 Aplikacja w skrócie](A1-the-app-in-brief.md): jak aplikacja działa jako całość, na jednej stronie
- [A2 Wczytanie drzewa genealogicznego (GEDCOM)](A2-loading-a-family-tree.md): co się wczytuje z pliku GEDCOM, co nie, QUAY, znaczniki `_STROM`, ponowny import
- [A3 Udokumentowanie w aplikacji](A3-evidence-in-the-app.md): źródła, cytowania, wycinki, załączniki, materiały i gdzie brakuje dowodów
- [A4 Rody i nazwiska](A4-surnames-and-families.md): ród i założyciel, osoby wżenione, żeńskie formy nazwisk, wyszukiwanie imion
- [A5 Kontrola drzewa](A5-tree-check.md): czego aplikacja pilnuje w drzewie, z jakimi progami, oraz To nie błąd
- [A6 Widoki i wybór osób](A6-views.md): Rodzina, Potomkowie, Oś czasu, Wachlarz, Mapa, ród w widoku, Tabela i widok w osobnym oknie
- [A7 Księga, strony i eksport](A7-book-pages-and-export.md): kto jest żyjący, ochrona żyjących, księga rodu, strony, zapisany HTML
- [A8 Scalanie drzew](A8-merging-trees.md): scalanie pliku, drzewa lub widoku w nowe drzewo, parowanie osób
- [A9 Obsługa aplikacji](A9-using-the-app.md): gdzie co jest, czytelne nazwy elementów, edycja podczas śledzenia badania, agent w aplikacji, dolny pasek na telefonie i tablecie
- [A10 Jedno wydarzenie wielu osób](A10-shared-events.md): wspólne wydarzenie gospodarstwa (Razem z), Ujednolić, Połącz w jedno wydarzenie, chrzestni i świadkowie w życiu osoby, scalanie i starsze drzewa

## S Aplikacja i badanie razem

- [S1 Połączenie aplikacji i badania](S1-connecting-app-and-research.md): most badania, rodzaje drzew, śledzenie na żywo, wersje
- [S2 Zmiany z aplikacji w badaniu](S2-edits-from-the-app.md): kiedy i co się wysyła, co badanie zapisze, a czego nie przyjmie
- [S3 Co wie badanie](S3-what-the-research-knows.md): sprzeczności, hipotezy, przeszukano i Nad osobą w aplikacji
- [S4 Badanie sterowane z aplikacji](S4-research-from-the-app.md): panel i przegląd badania, kolejka, linie, akcje do terminala
- [S5 Telefon](S5-phone.md): strona badania w telefonie, parowanie, zdjęcia partiami
- [S6 Drzewo z innego programu](S6-tree-from-another-program.md): drzewo z MyHeritage, Gramps, FamilySearch i programów dla Windows: co się wczytuje, znaczniki wiarygodności, dane z drzewa jako wskazówki, karta Co dalej, kopie zapasowe, eksport z powrotem, ponowny import
- [S7 Wiarygodność danych i weryfikacja według oryginałów](S7-reliability-and-verification.md): znaczniki przy danych i na karcie, Zweryfikuj przy danej, przy osobie i w drzewie, weryfikacja w kolejce badania, Potwierdź według skanu, co działa z mostem, a co bez niego

Licencja: [CC BY 4.0](../LICENSE). Teksty można udostępniać i przerabiać z podaniem źródła.
