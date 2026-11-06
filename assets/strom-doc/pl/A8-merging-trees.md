<a id="A8"></a>
# A8 Scalanie drzew

Jak aplikacja Strom scala dwa drzewa genealogiczne: plik GEDCOM z drzewem, dwa drzewa albo widok z drzewem. Opisuje
aplikację 3.21.2. Scalenie zduplikowanej osoby wewnątrz jednego drzewa to inna sprawa
([A5.6](A5-tree-check.md#A5.6)).

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

<!-- zdroj: app:src/merge/matching.ts:318 findMatches, :781 (85 high, 55 medium), :790 calculateMatchScore, :618 UNKNOWN_NAME_MATCH_SCORE · strings.ts merge.highConfidence, merge.mediumConfidence, merge.lowConfidence, merge.matchReasons -->

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

<!-- zdroj: app:src/merge/executor.ts:78 AUTO_CONFIRM_SCORE, :110 detectPartnershipConflicts, :302 toAdd (updateOnly, skip, reject), :792 mergePersonData · src/merge/ui.ts:1408 pendingGate · strings.ts merge.confirm, merge.reject, merge.skip, merge.manualMatch, merge.updateOnlyLabel, merge.keepExisting, merge.useImport, merge.suggestedPrecise, merge.partnershipFields, merge.closeSave, merge.pendingMerges · git v3.0.0 (2218cea), v1.19.0 (cf43bde) -->

<a id="A8.4"></a>
## A8.4 Co przechodzi z drzewem

Poza osobami i relacjami scala się też listy, które należą do całego drzewa.

- **Źródła:** to samo źródło (ta sama sygnatura, w przeciwnym razie ten sam opis) się nie podwaja; cytaty przechodzą
  na zachowane źródło, a brakująca transkrypcja i data zostają uzupełnione.
- **Miejsca:** współrzędne, rekordy miejsc i inne nazwy miejsc się ujednolica; gdzie oba drzewa znają to samo
  miejsce, obowiązuje drzewo docelowe.
- **Formy nazwiska** ([A4.5](A4-surnames-and-families.md#A4.5)) się ujednolica; grupy, które się nakładają, się łączy.
- Nowe drzewo zaczyna bez domyślnej osoby i widoku ([A6.1.1](A6-views.md#A6.1.1)).
- Aplikacja przed scaleniem mówi, ile problemów kontroli mają oba drzewa, a po scaleniu proponuje kontrolę, gdy
  scalenie przyniosło nowe ([A5](A5-tree-check.md)).
- **Granice:** ponowny import pliku badania do drzewa badania omawia [S1](S1-connecting-app-and-research.md).
- **Obowiązuje od:** aplikacja 1.0.0; zgłaszanie problemów kontroli aplikacja 1.19.0

<!-- zdroj: app:src/merge/executor.ts:211 executeMerge (mergeSourceCatalogs, places, mergePlaceRecords, mergePlaceAliases, addSurnameGroup, delete defaultPersonId/defaultView) · src/merge/ui.ts countNewMergeIssues · strings.ts merge.preValidationWarning, merge.newIssues · git v1.19.0 (00e5d38) -->
