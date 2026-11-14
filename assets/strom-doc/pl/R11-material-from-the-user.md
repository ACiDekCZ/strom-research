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
- **Dlaczego:**
  - 20 obrazów: skany księgi metrykalnej nie należą do historii drzewa jako setki zadań materiały. Dokumenty rodzinne
    jednego folderu to zwykle od kilku do kilkudziesięciu plików; więcej niż 20 obrazów to zwykle skany księgi
    i zapisuje się je jako księgę;
  - 20 MB: historii drzewa nigdy się nie przepisuje i idzie ona z drzewem przy kopii zapasowej i przeniesieniu. Duże
    pliki (wideo, nieskompresowane skany) powiększyłyby ją na trwałe, dlatego leżą we wspólnym magazynie mediów.
- **Obsługa:** terminal: `strom intake <soubory nebo složky>`, `strom intake --text "…"` (to, co powie użytkownik),
  `strom input list`, `strom input show I…`. Aplikacja: **Wyślij materiał…**, **Dodaj materiały…**
  ([A3.5](A3-evidence-in-the-app.md#A3.5)).
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:src/commands/intake.ts intake (description, BOOK_OF_SCANS=20, sha256 known, intakeTask) · research:src/core/media.ts MAX_IN_TREE=20 MB · research 1.0.0 = commit 48698860 · research:assets/method/intake.md kroky 1, 4, 6, 7 -->

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
- **Od badania 1.30.0:**
  - każda dana ma pochodzenie (z drzewa, od człowieka, z badania). Daną z drzewa agent zmieni tylko z cytowanym
    aktem, w przeciwnym razie zaproponuje zmianę; daną człowieka tylko zaproponuje. Wartość z drzewa zostaje
    zachowana i przywrócić ją może tylko człowiek (`strom event revert`, `strom person revert`)
    ([S6.3](S6-tree-from-another-program.md#S6.3)). Wartość z pliku aplikacji Strom, której od przejęcia nikt nie
    zmienił, pochodzi z własnego drzewa człowieka: jest chroniona jak dana człowieka, ale nie uchodzi za potwierdzoną
    przez człowieka;
  - identyfikatory programu (`_UID`, `EXID`, `_FSFTID` …) się zachowuje: to samo drzewo przejęte ponownie nikogo nie
    dodaje dwa razy; osoby tylko być może tej samej się nie łączy, a wynik ją wymienia (`candidates`); co nie zostało
    przejęte, wynik liczy (`notTaken`) ([S6.8](S6-tree-from-another-program.md#S6.8));
  - plik w Windows-1250 lub Windows-1252 („ANSI”) czyta się z właściwymi literami;
  - źródło drzewa nie ma strony (`PAGE`): każda dana podaje swój wiersz z drzewa;
  - badanie założone wcześniej po aktualizacji raz się oznacza (`strom fixes undo origins` to cofa).
- **Od badania 1.32.0:**
  - drzewo z aplikacji Strom daje z pliku JSON i GEDCOM to samo. Przejmuje się też wspólne wydarzenie kilku osób
    z rolą każdej osoby ([A10.1](A10-shared-events.md#A10.1)), własne wydarzenia **Chrzestny** i **Świadek ślubu**
    nazwane w języku badania, z odniesieniem do chrztu lub ślubu ([A10.5.1](A10-shared-events.md#A10.5.1)),
    chrzestni, świadkowie, celebrans i akuszerka przy wydarzeniach osoby (powiązanie z osobą lub tylko z nazwiska),
    świadkowie ślubu i inne wydarzenia pary z uczestnikami i notatką. Badanie trzyma je przy każdej danej i zwraca je
    aplikacji tak, jak przyszły;
  - z pliku JSON przejmuje się też przyczyna i wiek zgonu, adres urodzenia i zgonu, adres i wiek przy ślubie,
    stosunek dziecka do każdego z rodziców, rozwód i rozstanie z datą, notatka pary, wiek osoby przy wspólnym spisie,
    rodzina tylko jednego rodzica i nazwisko po ślubie. Osoby zastępcze („?”) się pomija;
  - notatkę wydarzenia przejmuje się w całości. Notatki osoby i rodziny z drzewa użytkownika nie skraca się do 500
    znaków; limit 500 znaków dotyczy notatek, które pisze badanie i agent;
  - `ROLE` uczestnika według GEDCOM 7 czyta się także w pliku innego programu;
  - akuszerka trafia do aplikacji jako **Obecny** z notatką „akuszerka”.

<!-- zdroj: research:src/core/import.ts hlavička ("as LEADS", oursByRefn), source kind family-tree form authored :113-117, status lead :294 · research:src/commands/intake.ts --no-import · research:assets/method/intake.md krok 5 · research:94d75934 src/core/import.ts (soubor aplikace Strom → origin user + tree), src/core/model.ts ValueOrigin.tree · 1.32.0: research:ac489205 src/core/import.ts importStromJson (godparent/weddingWitness → EVEN v jazyce výzkumu s roleAt, participants, partnerships[].participants, shareId/shareRole), src/core/roles.ts, src/gedcom/export.ts (porodní bába RELA Present + poznámka), celá poznámka události · research:f8eb2032 Note.whole, makeNote 500, factDetails, partnersAges, childRelation · research:01125661 appNobody, appMarriedName, appUnionFacts, appLooseFamilies · research:CHANGELOG 1.32.0 „Events shared in the Strom app“ · src/core/live.ts BRIDGE_FEATURES event.share · dirigent:prace/1113-vyzkum-085-json, 1113-vyzkum-json-intake-uplny, 1113-vyzkum-json-intake-drobnosti Výsledek -->

<a id="R11.4"></a>
## R11.4 Partia z aplikacji

Folder, ZIP albo pudło dokumentów wysłane z aplikacji badanie przyjmuje jako jedną partię. Agent rozdziela ją potem
na zadania.

- **Pilnuje kod:**
  - partia zamyka się, gdy aplikacja zgłosi, że jest kompletna, albo dzień po ostatnim pliku (partia
    z telefonu godzinę po ostatnim zdjęciu, [S5.4](S5-phone.md#S5.4));
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
- **Dlaczego:**
  - dzień po ostatnim pliku: aplikacja wysyła pliki pojedynczo. Partia, o której nikt nie powiedział, że jest
    kompletna, zamyka się z tym, co przyszło, żeby nic nie czekało dłużej; dzień bez kolejnego pliku oznacza, że
    wysyłanie się skończyło. Stronę w telefonie łatwo zamknąć bez przekazania partii, dlatego tam wystarczy godzina;
  - 25 plików: jedno zadanie materiały czyta jedna sesja agenta i mieści się w niej mniej więcej 25 plików;
  - ścieżka pliku w partii wiele mówi (`Babička/Dopisy/1946.jpg`); to, co do rodziny nie należy, nie powinno trafić
    do drzewa (metodyka).
- **Obsługa:** terminal: `strom input batch` (partie i ile z nich posortowano), `strom input sort I… --as
  source|document|photo|unrelated --person P…`. Aplikacja: **Dodaj materiały…** w menu badania.
- **Obowiązuje od:** badanie 1.12.0; partia z telefonu 1.18.0

<!-- zdroj: research:src/core/batches.ts hlavička, BATCH_TASK_FILES=25 (od v1.12.0), BATCH_IDLE_MS, PHONE_BATCH_IDLE_MS (od v1.18.0) · research:src/commands/intake.ts input batch done (--idle), input sort (unrelated --reason) · research:assets/method/intake.md "A batch from the Strom app" -->
