<a id="A8"></a>
# A8 Scalanie drzew

Jak aplikacja Strom scala dwa drzewa genealogiczne: plik GEDCOM z drzewem, dwa drzewa albo widok z drzewem. Opisuje
aplikację 3.21.2; zmiany z nowszej wersji mają przy sobie jej numer. Scalenie zduplikowanej osoby wewnątrz jednego
drzewa to inna sprawa ([A5.6](A5-tree-check.md#A5.6)).

<a id="A8.1"></a>
## A8.1 Scalenie zawsze zakłada nowe drzewo

Wynik scalenia zapisuje się jako **nowe drzewo**. Oba pierwotne drzewa i plik zostają bez zmian.

| Skąd | Obsługa |
|---|---|
| plik GEDCOM | **Import → Import GEDCOM → Scal z istniejącym** |
| inne drzewo | zarządzanie drzewami, przy drzewie **Scal drzewo** → **Wybierz drzewo docelowe** → **Rozpocznij scalanie** |
| osoby właśnie wyświetlone w widoku | **Scal ten widok z…** i wybór innego drzewa |

- Przed zapisem aplikacja pyta o **Nazwa scalonego drzewa:** (domyślnie „cel + źródło”). Po scaleniu pokazuje liczbę
  scalonych i dodanych osób i proponuje przełączenie na nowe drzewo.
- **Granice:** pustego widoku nie da się scalić; widok scala się tylko z innym drzewem.
- **Obowiązuje od:** aplikacja 1.0.0; Scal ten widok z… aplikacja 1.19.0

<!-- zdroj: app:src/merge/ui.ts:1421 newTreeNamePrompt, :1447 TreeManager.createTree · src/ui/merge-ui.ts:595 mergeViewInto · strings.ts merge.newTreeNamePrompt, merge.switchToNewTree, merge.mergeViewInto, merge.mergeViewEmpty, merge.mergeViewNoTarget, treeManager.mergeSourceTree, treeManager.selectTargetTree, treeManager.startMerge, importDialog.mergeExisting · git v1.19.0 (cf43bde) -->

<a id="A8.2"></a>
## A8.2 Łączenie osób w pary

Aplikacja dla każdej osoby ze scalanego źródła szuka osoby w drzewie docelowym i parze nadaje wynik dopasowania.

- Wynik liczy się z podobieństwa imienia i nazwiska, daty i miejsca urodzenia, daty zgonu oraz ze zgodności rodziców
  i partnerów. Płeć nie może być sprzeczna.
- **Wysoka** to dopasowanie 85 i więcej, **Średnia** 55 i więcej, w przeciwnym razie **Niska**. Osoba bez
  dopasowania jest **Nowa**.
- Kreator podaje przy dopasowaniu powód (na przykład „Imię i nazwisko oraz rok urodzenia”, „Dziecko dopasowanej
  osoby”).
- **Granice:** osób zastępczych (puste miejsce dla nieznanego rodzica) nie łączy się w pary. Osoba bez imienia
  połączona w parę przez krewnego idzie zawsze do sprawdzenia.
- **Obowiązuje od:** aplikacja 1.0.0
- **Od aplikacji 3.26.0:** osoby paruje się także według identyfikatora programu (`_UID` = `UID`, `_FSFTID` = `EXID`
  z adresem familysearch.org), z powodem **Ten sam identyfikator w pliku**. Takie dopasowanie jest pewne tylko przy
  podobnym imieniu i nazwisku, płci nie mężczyzna wobec kobiety, latach urodzenia najwyżej 3 od siebie i bez różnego
  globalnego identyfikatora; w przeciwnym razie to propozycja z wynikiem najwyżej 79. Oznaczenie rekordu i `RIN` dodają
  do zgodności imion i nazwisk 25 punktów tylko przy plikach tego samego programu. Rodzin według identyfikatora się nie
  paruje ([S6.7](S6-tree-from-another-program.md#S6.7)).
- **Od aplikacji 3.27.0:** identyfikator programu (`_UID`, `UID`, `_FSFTID`, `AFN`, `EXID`), który w drzewie
  ma więcej niż jedna osoba, nie mówi, która to jest: sam dopasowania nie tworzy, tylko je proponuje.

<!-- zdroj: app:src/merge/matching.ts:318 findMatches, :781 (85 high, 55 medium), :790 calculateMatchScore, :618 UNKNOWN_NAME_MATCH_SCORE · strings.ts merge.highConfidence, merge.mediumConfidence, merge.lowConfidence, merge.matchReasons · 3.27.0: app:b5595ca1 src/merge/matching.ts idNamesSeveral (víc osob stromu se stejným silným ID → jen idCandidate), findDirectMatches · src/merge/id-match.ts STRONG_TAGS · CHANGELOG.cs.md 3.27.0 · spec 066 K3.2 -->

<a id="A8.3"></a>
## A8.3 Co rozstrzyga człowiek

Kreator **Scalanie danych** pokazuje dopasowania, konflikty i nowe osoby. Każde dopasowanie można rozstrzygnąć.

| Opcja | Co dzieje się z osobą ze źródła |
|---|---|
| **Potwierdź** | scala się z osobą drzewa |
| **Odrzuć** | zostaje dodana jako nowa osoba |
| **Pomiń** | nie zostaje przeniesiona wcale |
| **Przypisz do istniejącej** | scala się z ręcznie wybraną osobą |

- Nierozstrzygnięte dopasowanie z wynikiem 50 i więcej przy scaleniu potwierdza się samo; nierozstrzygnięte poniżej
  50 zostaje dodane jako nowa osoba. Jeśli zostają nierozstrzygnięte niepewne dopasowania, aplikacja pyta przed
  scaleniem.
- **Tylko uzupełnianie istniejących osób (bez dodawania nowych)** uzupełnia osoby połączone w pary i nie dodaje żadnej
  nowej osoby.
- Dana, którą obie strony mają inaczej, to konflikt: **Zachowaj istniejące** lub **Użyj z importu**; dokładniejsza
  data lub pełniejsza wartość jest **proponowana**. Przy parze rozstrzyga się tak stan relacji, datę i miejsce ślubu
  i datę końca. Dana tylko po jednej stronie zostaje uzupełniona.
- Rozpoczęte scalanie można przy zamknięciu **Zapisz na później**; wraca jako **Niedokończone scalania**.
- **Obowiązuje od:** aplikacja 1.0.0; konflikty pary aplikacja 3.0.0; Pomiń i Tylko uzupełnianie istniejących osób
  aplikacja 1.19.0
- **Od aplikacji 3.26.0:** nierozstrzygnięte dopasowanie potwierdza się samo dopiero od wyniku 80 (w kreatorze
  z góry potwierdzone, ✓). Dopasowanie 50–79 jest tylko proponowane (?) i bez decyzji człowieka zostaje dodane jako
  nowa osoba: zdublowaną osobę można scalić później, błędnego scalenia cofnąć się nie da.

<!-- zdroj: app:src/merge/executor.ts:78 AUTO_CONFIRM_SCORE, :110 detectPartnershipConflicts, :302 toAdd (updateOnly, skip, reject), :792 mergePersonData · src/merge/ui.ts:1408 pendingGate · strings.ts merge.confirm, merge.reject, merge.skip, merge.manualMatch, merge.updateOnlyLabel, merge.keepExisting, merge.useImport, merge.suggestedPrecise, merge.partnershipFields, merge.closeSave, merge.pendingMerges · git v3.0.0 (2218cea), v1.19.0 (cf43bde) -->

<a id="A8.4"></a>
## A8.4 Co przechodzi z drzewem

Poza osobami i relacjami scala się też listy, które należą do całego drzewa.

- **Źródła:** to samo źródło (ta sama sygnatura, w przeciwnym razie ten sam opis) się nie podwaja; cytaty przechodzą
  na zachowane źródło, a brakująca transkrypcja i data zostają uzupełnione.
- **Od aplikacji 3.27.0:** źródło, które od zachowanego różni się tylko domyślną wiarygodnością, jest tym samym
  źródłem i się nie podwaja; przeniesione cytaty zachowują swoją wiarygodność
  ([A2.6.1](A2-loading-a-family-tree.md#A2.6.1)). Inna data zapisu albo inne wiersze cytatu nadal dają osobne źródło.
- **Miejsca:** współrzędne, rekordy miejsc i inne nazwy miejsc się ujednolica; gdzie oba drzewa znają to samo
  miejsce, obowiązuje drzewo docelowe.
- **Formy nazwiska** ([A4.5](A4-surnames-and-families.md#A4.5)) się ujednolica; grupy, które się nakładają, się łączy.
- Nowe drzewo zaczyna bez domyślnej osoby i widoku ([A6.1.1](A6-views.md#A6.1.1)).
- Aplikacja przed scaleniem mówi, ile problemów kontroli mają oba drzewa, a po scaleniu proponuje kontrolę, gdy
  scalenie przyniosło nowe ([A5](A5-tree-check.md)).
- **Granice:** ponowny import pliku badania do drzewa badania omawia [S1](S1-connecting-app-and-research.md).
- **Obowiązuje od:** aplikacja 1.0.0; zgłaszanie problemów kontroli aplikacja 1.19.0
- **Od aplikacji 3.26.0:** notatki osoby, relacji i źródła przy scaleniu się nie podwajają. Przed scaleniem zapisuje
  się kopia zapasowa drzewa ([S6.5](S6-tree-from-another-program.md#S6.5)). Po scaleniu pliku innego programu aplikacja
  pokazuje kartę **Co dalej** ([S6.4](S6-tree-from-another-program.md#S6.4)). Ręczne scalenie dwóch osób
  ([A5.6](A5-tree-check.md#A5.6)) notatek nie łączy.
- **Od aplikacji 3.28.0:** wspólne wydarzenia ([A10.1](A10-shared-events.md#A10.1)) się nie podwajają: parują się
  z wydarzeniami drzewa docelowego i przejmują jego wspólne wydarzenie; własne wydarzenie „Census” paruje się ze
  spisem ludności. Podsumowanie „Wspólne wydarzenia: n połączono” ([A10.6](A10-shared-events.md#A10.6)).

<!-- zdroj: app:src/merge/executor.ts:211 executeMerge (mergeSourceCatalogs, places, mergePlaceRecords, mergePlaceAliases, addSurnameGroup, delete defaultPersonId/defaultView) · src/merge/ui.ts countNewMergeIssues · strings.ts merge.preValidationWarning, merge.newIssues · git v1.19.0 (00e5d38) · 3.27.0: app:dde0151a src/merge/executor.ts sourceKey bez quality, takeCitationQuality, remapCitations; app:5721b016 unionCitations · 3.28.0: app:80c2ffb9 src/merge/* (shareId, Census ↔ census), strings.ts merge.sharedJoined -->
