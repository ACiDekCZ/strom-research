<a id="R11"></a>
# R11 Materiały od użytkownika

Co badanie robi z plikami, tekstami i drzewami genealogicznymi, które daje mu użytkownik: w terminalu albo z aplikacji
Strom. Jak materiał wysyła się z aplikacji, opisuje [A3.5](A3-evidence-in-the-app.md#A3.5); odpowiedź plikiem na
czekające zadanie [R6.7.1](R6-awaiting-action.md#R6.7.1). Opisuje badanie 1.27.0. Przy zasadach rozróżnia się, czego
**pilnuje kod**, a co jest tylko **zasadą metodyki**.

<a id="R11.1"></a>
## R11.1 Każdy plik to materiał z zadaniem

Każdy plik zapisuje się w badaniu bez zmian jako materiał i dostaje zadanie materiały. Agent zapisuje z niego tylko
to, co w nim rzeczywiście stoi.

- **Pilnuje kod:**
  - ten sam plik za drugim razem zostaje pominięty (rozpoznaje się go po zawartości, nie po nazwie);
  - pliki do 20 MB są w drzewie i w jego historii, większe we wspólnym magazynie mediów;
  - folder z więcej niż 20 obrazami traktuje się jako skany księgi, nie jako dokumenty rodzinne (`--documents` mówi
    odwrotnie);
  - drzewo genealogiczne ma własne zadanie; pozostałe pliki jednego folderu mają jedno wspólne zadanie;
  - zadanie materiały nigdy nie czeka poza kolejką ([R2.2.3](R2-lines-and-queue.md#R2.2.3)). W Archiwum Strom zostaje
    odłożone ([R7.8](R7-when-the-agent-works.md#R7.8)).
- **Tylko metodyka:** imiona, nazwiska i miejsca zapisuje się tak, jak są napisane; ujednolica się tylko daty. Zadanie
  zamyka się z tym, co z materiału wynikło, i z kolejnymi zadaniami: gdzie szukać aktów, które udokumentują wskazówki.
- **Obsługa:** terminal: `strom intake <soubory nebo složky>`, `strom intake --text "…"` (to, co powie użytkownik),
  `strom input list`, `strom input show I…`. Aplikacja: **Wyślij materiał…**, **Dodaj materiały…**
  ([A3.5](A3-evidence-in-the-app.md#A3.5)).
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:src/commands/intake.ts intake (description, BOOK_OF_SCANS=20, sha256 known, intakeTask) · research:src/core/media.ts MAX_IN_TREE=20 MB · research:assets/method/intake.md kroky 1, 4, 6, 7 -->

<a id="R11.2"></a>
## R11.2 Dokument jest źródłem, reszta jest wskazówką

Z materiału może powstać źródło, które dokumentuje dane, albo tylko wskazówka, która mówi, gdzie szukać. Rozstrzyga,
jaki to dokument, nie to, kto go wysłał.

- **Tylko metodyka:**
  - dokument urzędowy lub kościelny (akt urodzenia, ślubu, zgonu, wypis z księgi metrykalnej, dokumenty wojskowe)
    jest źródłem (`--form original`; `--information primary`, gdy został spisany w czasie wydarzenia);
  - zdjęcie, list, drzewo genealogiczne i wspomnienie to dzieło autora albo źródło pochodne: to, co z nich pochodzi,
    zostaje **Wskazówką**;
  - to, co powie użytkownik, jest wspomnieniem rodziny (`--kind family-memory --form authored --information secondary`);
  - więcej danych z jednego materiału zapisuje się jednym zapisem zbiorczym (`strom batch`): wszystko albo nic.
- **Pilnuje kod:** dana tylko ze wspomnienia, drzewa genealogicznego lub dzieła autorskiego nigdy nie jest
  Prawdopodobne ani Udokumentowane ([R3.2](R3-verification-and-citation.md#R3.2)).
- **Obsługa:** terminal: `strom source add "…" --input I… --form … --information …`.
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:assets/method/intake.md krok 2 · research:src/core (weak sources: family-tree, family-memory, authored) -->

<a id="R11.3"></a>
## R11.3 Przejęte drzewo genealogiczne

Drzewo genealogiczne (GEDCOM lub plik aplikacji Strom) to wnioski kogoś innego, nie akt. Badanie przejmuje je
w całości, ale tylko jako wskazówki.

- **Pilnuje kod:**
  - drzewo wczytuje się od razu przy przejęciu: każda osoba i każda dana jako **Wskazówka** z cytatem jednego źródła
    rodzaju drzewo genealogiczne (`--kind family-tree`, `--form authored`). Każda osoba pamięta, skąd przyszła;
  - osoby drzewa tego badania, które wracają z pliku aplikacji Strom, paruje się według ich numeru w badaniu i nie
    zakłada się ich po raz drugi. Numerów innego badania nie paruje się nigdy;
  - `--no-import` drzewo tylko zapisuje, nie wczytuje go.
- **Tylko metodyka:**
  - duplikaty i niemożliwe daty się sprawdza, ale nie „poprawia” z pamięci; to wskazówki;
  - osobę z drzewa genealogicznego, która jest już w badaniu badana, scala się **do** badanej osoby, najpierw jej
    rodziców ([R10.2](R10-people-and-hypotheses.md#R10.2)). Badana osoba zachowuje swoje dowody;
  - to, czym drzewo się różni, zostaje wskazówką albo staje się sprzecznością; nigdy daną.
- **Obsługa:** terminal: `strom intake rodokmen.ged`. Wczytanie drzewa genealogicznego do aplikacji opisuje
  [A2](A2-loading-a-family-tree.md).
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:src/core/import.ts hlavička ("as LEADS", oursByRefn), source kind family-tree form authored :113-117, status lead :294 · research:src/commands/intake.ts --no-import · research:assets/method/intake.md krok 5 -->

<a id="R11.4"></a>
## R11.4 Partia z aplikacji

Folder, ZIP albo pudło dokumentów wysłane z aplikacji badanie przyjmuje jako jedną partię. Agent rozdziela ją potem
na zadania.

- **Pilnuje kod:**
  - partia zamyka się, gdy aplikacja zgłosi, że jest kompletna, albo dzień po ostatnim pliku;
  - potem powstają z niej zadania materiały po mniej więcej 25 plików, według folderów, w których pliki przyszły.
    W Archiwum Strom zadania czekają odłożone;
  - pliki partii zapisuje się jako oryginały we wspólnym magazynie mediów, nie w historii drzewa. Czego agent z nich
    nie zapisze, zostaje prywatne;
  - plik oznaczony jako niezwiązany (`--as unrelated`) wymaga powodu. Zostaje pominięty i nic się z niego nie
    zapisuje.
- **Tylko metodyka:**
  - agent najpierw tanio przegląda wszystkie pliki zadania (miniatury w siatce) i każdy od razu klasyfikuje: akt
    (źródło), dokument, zdjęcie, niezwiązany, i do kogo należy. Dokładnie czyta tylko to, co dotyczy ludzi badania;
  - o żyjącej osobie nic się nie zapisuje; plik tylko się klasyfikuje;
  - skanów jednej księgi (wiele numerowanych skanów) nie czyta się plik po pliku: zapisuje się je jako księgę i czyta
    się z niej wpisy jak z każdej księgi ([R8](R8-reading-scans.md));
  - zadanie zamyka się, gdy każdy jego plik jest sklasyfikowany; kolejna część partii to osobne zadanie.
- **Dlaczego:** ścieżka pliku w partii wiele mówi (`Babička/Dopisy/1946.jpg`); to, co do rodziny nie należy, nie
  powinno trafić do drzewa (metodyka).
- **Obsługa:** terminal: `strom input batch` (partie i ile z nich posortowano), `strom input sort I… --as
  source|document|photo|unrelated --person P…`. Aplikacja: **Dodaj materiały…** w menu badania.
- **Obowiązuje od:** badanie 1.12.0

<!-- zdroj: research:src/core/batches.ts hlavička, BATCH_TASK_FILES=25 (od v1.12.0) · research:src/commands/intake.ts input batch done (--idle), input sort (unrelated --reason) · research:assets/method/intake.md "A batch from the Strom app" -->
