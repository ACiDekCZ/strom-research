<a id="R11"></a>
# R11 Materiały od użytkownika

Co badanie robi z plikami, tekstami i drzewami genealogicznymi, które daje mu użytkownik: w terminalu albo z aplikacji
Strom. Jak materiał wysyła się z aplikacji, opisuje [A3.5](A3-evidence-in-the-app.md#A3.5); odpowiedź plikiem na
czekające zadanie [R6.7.1](R6-awaiting-action.md#R6.7.1). Opisuje badanie 1.27.0; zmiany z nowszej wersji mają
przy sobie jej numer. Przy zasadach rozróżnia się, czego
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
- **Obsługa:** terminal: `strom intake <pliki lub foldery>`, `strom intake --text "…"` (to, co powie użytkownik),
  `strom input list`, `strom input show I…`. Aplikacja: **Wyślij materiał…**, **Dodaj materiały…**
  ([A3.5](A3-evidence-in-the-app.md#A3.5)).
- **Obowiązuje od:** badanie 1.0.0
- **Od badania 1.36.0:** zadanie materiały plik dostaje tylko przy włączonym `intake.auto` albo z `--sort`; inaczej
  czeka w Materiałach nieuporządkowany ([R11.6](#R11.6)). Tekst (`--text`) dostaje zadanie zawsze.

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
    nazwane w języku badania (z pliku GEDCOM od badania 1.34.0, wcześniej według TYPE pliku w języku, w którym działała aplikacja), z odniesieniem do chrztu lub ślubu ([A10.5.1](A10-shared-events.md#A10.5.1)),
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
- **Od badania 1.36.0:** w pliku dla aplikacji Strom każdy cytat drzewa bez własnej lokalizacji ma jako stronę
  (`PAGE`) swój wiersz z drzewa, więc aplikacja pokazuje przy każdym cytacie jego wiersz. Wskaźnik, który zapisał
  import lub synchronizacja („I1 BIRT”, „BIRT DATE PLAC”, „family”), ani cytat bez wiersza `PAGE` nie dostają. Wiersz
  zostaje też w `DATA` › `TEXT`. Drzewo zwrócone z aplikacji bez zmian nie jest zmianą użytkownika i nic nie jest
  cytowane dwa razy; wiersz zmieniony w aplikacji jest zmianą użytkownika jak przy każdym źródle.

<!-- zdroj: research:src/core/import.ts hlavička ("as LEADS", oursByRefn), source kind family-tree form authored :113-117, status lead :294 · research:src/commands/intake.ts --no-import · research:assets/method/intake.md krok 5 · research:94d75934 src/core/import.ts (soubor aplikace Strom → origin user + tree), src/core/model.ts ValueOrigin.tree · 1.32.0: research:ac489205 src/core/import.ts importStromJson (godparent/weddingWitness → EVEN v jazyce výzkumu s roleAt, participants, partnerships[].participants, shareId/shareRole), src/core/roles.ts, src/gedcom/export.ts (porodní bába RELA Present + poznámka), celá poznámka události · research:f8eb2032 Note.whole, makeNote 500, factDetails, partnersAges, childRelation · research:01125661 appNobody, appMarriedName, appUnionFacts, appLooseFamilies · research:CHANGELOG 1.32.0 „Events shared in the Strom app“ · src/core/live.ts BRIDGE_FEATURES event.share · dirigent:prace/1113-vyzkum-085-json, 1113-vyzkum-json-intake-uplny, 1113-vyzkum-json-intake-drobnosti Výsledek · 1.34.0: research:aa0d53d5 src/core/import.ts gedRoleEventLabel (B6) · 1.36.0: research:519951b3 src/gedcom/export.ts stromPage (family-tree: PAGE = locator citace, ne treePointer), citation where (DATA TEXT i vedle PAGE), src/core/sourcefields.ts treePointer · test/cli/origin-ids.test.ts · CHANGELOG.cs.md 1.36.0 -->

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
- **Od badania 1.36.0:** zadania porządkowania powstają tylko przy włączonym `intake.auto` albo gdy człowiek poprosi
  o uporządkowanie partii; inaczej partia zamyka się bez zadań, a pliki czekają w Materiałach nieuporządkowane
  ([R11.6](#R11.6)).

<!-- zdroj: research:src/core/batches.ts hlavička, BATCH_TASK_FILES=25 (od v1.12.0), BATCH_IDLE_MS, PHONE_BATCH_IDLE_MS (od v1.18.0) · research:src/commands/intake.ts input batch done (--idle), input sort (unrelated --reason) · research:assets/method/intake.md "A batch from the Strom app" -->

<a id="R11.5"></a>
## R11.5 Materiał badania i pliki drzewa z aplikacji

Każdy plik, który badanie trzyma, to rekord materiału (`I…`): plik wysłany przy osobie, plik partii, plik
z terminala i plik drzewa z aplikacji Strom. Rekord ma tytuł, rodzaj i datę, osoby, do których należy, a przy pliku
drzewa także swoje miejsca w drzewie aplikacji.

- Rodzaj to `photo`, `document`, `record` lub `other` (w aplikacji **Zdjęcie**, **Dokument**, **Akt**, **Inne**).
  Badanie pamięta, kto nadał tytuł: człowiek (aplikacja, terminal) czy badanie.
- Ukryty plik (`unrelated`, `duplicate`, bez powodu) zostaje w badaniu razem z oryginałem i można go znowu pokazać.
- **Pilnuje kod:**
  - ukrycie, usunięcie z drzewa ani cofnięcie zapisu nie kasuje pliku: oryginał i rekord zostają. Usuwa tylko
    `strom input delete` za zgodą człowieka ([R11.5.6](#R11.5.6));
  - zmianę tytułu, rodzaju i daty pliku spoza drzewa badanie zapisuje od razu. Przy pliku drzewa zmiana pojawi się
    w aplikacji z kolejnym wczytaniem drzewa;
  - badanie odrzuca całą zmianę, gdy nie zna jednego z plików lub nie może odczytać wartości ([R11.5.2](#R11.5.2)).
- **Granice:** rekordy z miejscami w drzewie są w schemacie drzewa 3 (od badania 1.35.0). Przejście nic nie
  nadpisuje; starszy `strom` drzewa w schemacie 3 nie otworzy. Materiał w aplikacji opisuje
  [A3.5](A3-evidence-in-the-app.md#A3.5).
- **Obsługa:** terminal: `strom input list`, `strom input show I…` (gdzie plik jest i co z niego powstało), `strom
  input edit`, `strom input assign`, `strom input hide`, `strom input unskip`, `strom input delete`, `strom
  material`. Aplikacja: okno **Materiały**.
- **Obowiązuje od:** badanie 1.35.0

<!-- zdroj: research:0cc2cfca src/commands/intake.ts input delete · research:2aeeb228 src/core/model.ts SCHEMA_VERSION 3, Input (origin, working, orient, titled, materialKind, families, links), MEDIA_ORIGINS, LINK_TYPES, MATERIAL_KINDS, LINK_RETRACTIONS, HIDE_REASONS · src/core/material.ts hideMaterial, unhideMaterial, editMaterial, MATERIAL_MOST_EDIT, MATERIAL_TITLE_MAX · research:c9a4b614 CHANGELOG.cs.md 1.35.0 · help input, material -->

<a id="R11.5.1"></a>
### R11.5.1 Pliki drzewa z aplikacji

Badanie 1.35.0 trzyma też portrety, zdjęcia par i załączniki drzewa z aplikacji Strom. Każdy plik zapisuje raz,
według zawartości, i zapamiętuje jego miejsca w drzewie: załącznik lub portret osoby, załącznik lub zdjęcie pary,
plik wydarzenia, dowód źródła.

- Plik, którego oryginał przyszedł wcześniej (`PUT /media`), badanie rozpoznaje po odcisku oryginału; w przeciwnym
  razie po odcisku wysłanych bajtów. Pomniejszoną kopię, którą pokazuje aplikacja, zapisuje bez zmian obok oryginału.
- Nowy portret zastępuje stary: stary zostaje jako starsza wersja (miejsce wycofane z powodem `replaced`).
- Rekord jest **w drzewie**, dopóki ma co najmniej jedno miejsce, które nie jest wycofane.
- **Pilnuje kod:**
  - usunięcie w aplikacji badanie zapisuje tylko wtedy, gdy zapis niesie wszystkie pliki drzewa (`media=app`),
    i tylko wobec tego, co aplikacja dostała z jej plikami. Tego, co dodało inne okno, nie usuwa;
  - usunięty plik zostaje w materiale, ukryty z powodem **Usunięto z drzewa**. Pokazany znowu dostaje z powrotem
    miejsca, które zabrał mu ostatni zapis;
  - `strom sync undo I…` przywraca też miejsca, które zapis usunął;
  - do aplikacji plik wraca według odcisku (`GET /tree.ged?images=ref&media=app`), tylko pliki z miejscem w drzewie.
    Kadr portretu w pierwotnym zdjęciu nie wraca, portret tak ([S8.3](S8-where-the-data-are.md#S8.3)).
- **Granice:** badanie, które plików drzewa nie trzyma (do 1.34), nic z tego nie robi; aplikacja liczy wtedy zdjęcia
  i załączniki jako tylko w przeglądarce ([S8.4](S8-where-the-data-are.md#S8.4)).
- **Obsługa:** aplikacja: zapis drzewa ([S2](S2-edits-from-the-app.md)), **Usuń z drzewa…** i **Przywróć** w oknie
  **Materiały**; terminal: `strom sync undo I…`, `strom input unskip I…`.
- **Obowiązuje od:** badanie 1.35.0

<!-- zdroj: research:2aeeb228 · src/core/appmedia.ts (hlavička: soubor jednou podle otisku, keepBytes, MediaReader) · src/core/treemedia.ts (návrat GET /tree.ged?images=ref&media=app, POST /images, GET /image/<sha>) · research:91ab6230 (odebrání jen se všemi soubory, proti základu media=app, sync undo, restoreTakenOff) · research:d5e99375, 815bc90d, 7d7628eb · src/core/material.ts unhideMaterial (spec 102 M3) · dirigent:spec/108-kde-se-co-uklada K2.3 (photoSource se nevrací) -->

<a id="R11.5.2"></a>
### R11.5.2 Tytuł, rodzaj, data i osoby z terminala

Tytuł, rodzaj i datę pliku ustawia `strom input edit`, osoby `strom input assign`. Oba dotyczą materiału badania
i plików drzewa z aplikacji; aplikacja dostanie je z kolejnym plikiem drzewa.

- `strom input edit I… --title … --kind photo|document|record|other --date …`: najwyżej 500 plików, tytuł najwyżej
  200 znaków, data jak w GEDCOM (`1932`, `ABT 1930`, `12 MAY 1932`); `""` usuwa wartość. Odpowiedź podaje, co każdy
  plik miał wcześniej (`was`): ta sama zmiana z tymi wartościami ją cofa. Więcej plików przez `--files-from`.
- `strom input assign` dodaje (`--add P…`) lub usuwa (`--remove P…`) osoby plików lub całych partii (`--batch`).
  Przy pliku drzewa dodana osoba to nowe miejsce: w aplikacji załącznik osoby.
- `strom input hide I… --why unrelated|duplicate` ukrywa plik; `strom input unskip I…` pokazuje go znowu.
- **Pilnuje kod:** wszystko albo nic: nieznany plik, za długi tytuł, nieczytelny rodzaj lub data i nic się nie
  zapisze. `--dry-run` tylko pokazuje, co by się zmieniło.
- **Obsługa:** terminal, zob. wyżej. To samo robi okno **Materiały** w aplikacji przez most.
- **Obowiązuje od:** badanie 1.20.0 (`strom input assign`, `hide`, `unskip`); 1.35.0: `strom input edit`, miejsca
  plików drzewa

<!-- zdroj: research:a7df632d src/commands/intake.ts input edit, assign, hide, unskip · src/core/material.ts checkEdit, editMaterial, MATERIAL_MOST_EDIT=500, MATERIAL_TITLE_MAX=200, assignMaterial (místo u souboru stromu, spec 102 M4) · research:cc709045 příklady v helpu · help input edit, input assign, input hide -->

<a id="R11.5.3"></a>
### R11.5.3 Porządkowanie materiału: `strom material sort`

`strom material sort` daje pliki materiału do przeczytania czytelnikom badania. Dla każdego pliku proponują tytuł,
datę, rodzaj i połączenia z osobami, parami, ich wydarzeniami i źródłami drzewa, z uzasadnieniem i pewnością. Do
badania nic się nie zapisuje.

- Propozycja jest zapisana obok badania (`strom material show <id>`). To, co człowiek z niej przyjmie, zapisuje się
  jako jego: w aplikacji albo przez `strom input edit`.
- `--text` to to, co człowiek wie o plikach; czytelnicy kierują się nim tam, gdzie pliki nie mówią inaczej.
- `--queue` tylko zapisuje porządkowanie do kolejki; `strom material cancel <id>` je zatrzymuje.
- **Pilnuje kod:**
  - najwyżej 50 plików i 2000 znaków tekstu; z PDF pierwsze 10 stron. Plik, którego żaden czytelnik nie otworzy,
    ocenia według nazwy, ścieżki i notatek;
  - nigdy nie proponuje tytułu, rodzaju ani daty nadanych przez człowieka, połączenia, które człowiek nadał lub
    usunął, ani ID, którego badanie nie ma. Nie proponuje portretu ani zdjęcia pary;
  - płatne czytania zaczną się dopiero po zgodzie człowieka: we własnym terminalu (Enter to nie) lub w oknie
    systemu. Gdy nie ma kogo zapytać, polecenie kończy się kodem 4. Agent nigdy nie odpowiada za człowieka;
  - porządkowanie z aplikacji most uruchomi tylko z własnym podpisem, a ten jest ważny raz. Rekord, który tylko
    podaje się za porządkowanie z aplikacji, nigdy się nie uruchomi;
  - w kolejce czekają najwyżej 3 porządkowania.
- **Od badania 1.35.0:**
  - plik tekstowy (.txt, .md, .markdown, .text albo typ text/plain lub markdown) czytelnik czyta jako tekst i ocenia
    według tego, co mówi: najwyżej pierwsze 20 000 znaków. Przy dłuższym czytelnik wie, że dostał tylko początek i jak
    duży jest plik. Czyta się jako UTF-8, ze znacznikiem kodowania UTF-16 jako UTF-16, a to, co nie jest UTF-8, jako windows-1252;
  - w trakcie porządkowania `strom material show` mówi, ile plików czytelnicy już ocenili („N of M files done”);
    aplikacja pokazuje z tego „k z n”;
  - przy ukończonym porządkowaniu każdy plik bez propozycji ma powód: czytelnik nic o nim nie powiedział, plik ma już
    wszystko, co zaproponowano, propozycji nie dało się użyć, agent pominął plik albo pliku nie dało się odczytać
    (z wynikiem czytelnika). Co czytelnik napisał o pliku, stoi przy powodzie.
  - plik, który wyraźnie nie dotyczy rodziny (zrzut ekranu, paragon, plik wysłany przez pomyłkę), czytelnik oznacza
    `unrelated: yes`, z uzasadnieniem i pewnością. Polecenie dla czytelnika: tylko plik wyraźnie spoza rodziny, nigdy
    plik, którego tylko nie umie przypisać. Badanie nie zaproponuje dla takiego pliku tytułu, daty, rodzaju ani
    połączenia (co czytelnik mimo to napisał, odrzuci). `strom material show` pisze przy nim „unrelated (not of the
    family)”. Badanie nigdy samo pliku nie ukryje ani nie usunie; ukrywa go tylko człowiek: w aplikacji
    ([A3.5.9](A3-evidence-in-the-app.md#A3.5.9)), w terminalu `strom input hide I… --why unrelated`;
  - czytelnik może też powiedzieć, który z wysłanych plików jest rewersem innego zdjęcia lub strony (połączenie
    `back` na `I…` pliku, który dostał ten sam czytelnik: jeden rewers do jednego awersu, nigdy rewers rewersu ani
    plik tekstowy) i który obraz jest portretem osoby (połączenie `portrait` na jedną `P…`; tylko obraz, nie portret,
    który człowiek usunął, i nie plik, który już jest portretem);
  - więcej niż 50 plików daje do uporządkowania tylko aplikacja, jako przebieg partiami ([R11.5.5](#R11.5.5)).
- **Granice:** tylko badanie z agentem: Archiwum Strom i badanie, które czeka na agenta, materiału nie porządkują.
- **Obsługa:** terminal: `strom material sort I… [--text …] [--queue]`, `strom material show`, `strom material
  cancel`; aplikacja: **Uporządkuj agentem…** ([A3.5.8](A3-evidence-in-the-app.md#A3.5.8)).
- **Obowiązuje od:** badanie 1.35.0

<!-- zdroj: research:acb5d1ce src/core/sort.ts SORT_MOST_FILES=50, SORT_TEXT_MAX=2000, SORT_QUEUE_MAX=3, SORT_PDF_PAGES=10, SORT_FILES_PER_READING=10, typy vazeb person/family/event/source · research:0cc2cfca src/core/sort.ts SORT_LINK_TYPES back, portrait · research:d667304d (souhlas člověka, exit 4) · research:2978645b, 19e525e5, 5b76fb43 (podpis mostu APP_SORT_FROM, platí jednou) · src/commands/material.ts · help material sort · research:ae866bb7 src/core/sort.ts SORT_TEXT_FILE_MAX=20_000, SORT_TEXT_TYPES, isTextFile, textOfFile (UTF-8 / UTF-16 BOM, jinak windows-1252; cut), řádek „read as text (only its first … characters: the file is … KB)“, unproposedOf (nothing-said, nothing-new, dropped, left-out, reader-failed + outcome; said) · src/commands/material.ts filesDone (+ group.length po čtenáři), show „N of M files done“, „no proposal: why (outcome)“ · research:f36b3941 (ve vydání 1.35.0) src/core/sort.ts pokyn čtenáři „unrelated: yes“ (jen soubor zjevně mimo rodinu, nikdy jen nezařazený), YES, keptProposals (unrelated: jen why a sure, ostatní dropped „unrelated“) · src/commands/material.ts show „· unrelated (not of the family)“ · src/core/live.ts GET /material/sort/<id> unrelated?: true („the person hides it, never strom“) · CHANGELOG.md 1.35.0 -->

<a id="R11.5.4"></a>
### R11.5.4 Materiał przez most

Okno **Materiały** w aplikacji czyta i zmienia materiał przez most badania. Każda zmiana to to samo polecenie co
w terminalu, z tymi samymi granicami.

| Most | Co robi | Polecenie |
|---|---|---|
| `GET /material` | pliki z tytułem, rodzajem, datą, osobami, przy plikach drzewa miejsca, a przy każdym użycie; plik źródła (`uses.of`), czego agent nie przypisał (`left`), ta sama treść (`sameAs`) | |
| `GET /material/<I…>/uses` | wycinki, źródła i zadania, które używają pliku | |
| `POST /material/assign` | osoby plików | `strom input assign` |
| `POST /material/hide` | ukryć i pokazać znowu (przy usuniętym pliku drzewa z miejscami) | `strom input hide`, `unskip` |
| `POST /material/edit` | tytuł, rodzaj i data, 1–500 plików | `strom input edit` |
| `POST /material/sort` | porządkowanie 1–50 plików; postęp `GET /material/sort/<id>`, anulowanie `…/cancel` | `strom material sort` |
| `POST /material/sort` (51–1 500) | przebieg partiami ([R11.5.5](#R11.5.5)); postęp `GET /material/sort/<run-…>`, anulowanie `…/<run-…>/cancel` | |
| `POST /material/delete` | usunąć trwale 1–500 plików: najpierw `dryRun` (wykaz i potwierdzenie), potem z potwierdzeniem | `strom input delete` |

- Badanie ogłasza, co umie, w `/status.features`: `media.app`, `material.links`, `material.edit`, `material.uses`
  i `material.sort` (tylko tam, gdzie jest agent). Bez nich aplikacja zachowuje się jak ze starszym badaniem.
- **Od badania 1.35.0:** też `material.sourceOf`, `material.left`, `material.sameAs`, `material.sortRun`
  i `material.delete`. Usuwanie odrzuci zmieniony wykaz (`material.delete-changed` z nowym wykazem), brakujące lub
  stare potwierdzenie (`material.body`) i zapis, który nie przyszedł z aplikacji.
- **Pilnuje kod:** zmiana jest cała albo żadna; zajęte badanie odpowie, że nic nie zmieniło. Porządkowanie odrzuci
  bez agenta, z wyczerpanym limitem czytania, z pełną kolejką i gdy agent teraz nie może pracować.
- **Obsługa:** aplikacja: okno **Materiały**, z działającym mostem ([S1.1](S1-connecting-app-and-research.md#S1.1)).
- **Obowiązuje od:** badanie 1.35.0

<!-- zdroj: research:0cc2cfca src/core/live.ts (GET /material uses.of, left {at, sort, why, said}, sameAs; POST /material/sort run 51–1500, GET/POST /material/sort/<run-…>[/cancel]; POST /material/delete dryRun → impacts + confirm, chyby material.delete-changed, material.body, material.file, material.readonly, material.busy, app.only; BRIDGE_FEATURES material.sourceOf, left, sameAs, sortRun, delete) · research:src/core/live.ts:134-160 (GET /material, /material/<I…>/uses, POST /material/assign|hide|edit|sort, chyby material.body|date|file|readonly|busy) · src/core/live-sort.ts (sort.none, sort.limit, sort.queue, sort.not-ready) · research:a7df632d, 87376d11, 7754968e -->

<a id="R11.5.5"></a>
### R11.5.5 Przebieg porządkowania z aplikacji

Aplikacja może dać do uporządkowania 51 do 1 500 plików jako jeden przebieg (`run-…`). Badanie dzieli go na partie
po 50 i porządkuje je jedną po drugiej, dopóki działa most. Propozycja każdej gotowej partii jest dostępna od razu.

- Każda partia to osobne porządkowanie z własną propozycją; niesie, do którego przebiegu należy i która jest.
- W kolejce (najwyżej 3 porządkowania) przebieg liczy się jako jedno.
- **Odczyty aplikacji:** pierwsza partia liczy się, gdy badanie przyjmie przebieg; kolejne, gdy ruszają. Gdy limit
  odczytów aplikacji partii nie puści, przebieg czeka i sam próbuje ponownie (`material.sort-waiting`).
- Partia, która się nie powiedzie, nie zatrzymuje kolejnych. `strom material show run-…` mówi stan przebiegu, ile
  plików jest gotowych i jego partie. `strom material cancel run-…` zatrzymuje partię w pracy, anuluje czekające
  i zostawia gotowe z ich propozycjami.
- **Pilnuje kod:** przebieg uruchamia tylko aplikacja przez most; agent nigdy przebiegu nie uruchomi, a `strom
  material sort` z terminalu bierze najwyżej 50 plików ([R11.5.3](#R11.5.3)).
- **Granice:** tylko badanie z agentem i z `material.sortRun` ([R11.5.4](#R11.5.4)); starsze badanie bierze od
  aplikacji jedną partię.
- **Obsługa:** aplikacja: **Uporządkuj agentem…** ([A3.5.12](A3-evidence-in-the-app.md#A3.5.12)); terminal:
  `strom material show run-…`, `strom material cancel run-…`.
- **Obowiązuje od:** badanie 1.35.0

<!-- zdroj: research:0cc2cfca src/core/sort.ts SORT_RUN_MOST_FILES=1500, SORT_QUEUE_MAX=3 (běh jako jedna položka), run/part/parts, první dávka započtená při přijetí, další při startu podle read.app, jinak čeká a zkusí znovu; selhaná dávka nezastaví další · src/core/live-sort.ts, src/core/live.ts POST /material/sort (51–1500 → 202 {state queued, run}), GET /material/sort/<run-…>, POST …/<run-…>/cancel · src/commands/material.ts show run-… („N of M files done“, dávky), cancel run-…, material.sort-waiting · CHANGELOG.md 1.35.0 -->

<a id="R11.5.6"></a>
### R11.5.6 Usuń trwale: `strom input delete`

`strom input delete I…` usuwa pliki materiału trwale. Może to zrobić tylko człowiek: w terminalu za swoją zgodą
albo w aplikacji przez **Usuń trwale…** ([A3.5.16](A3-evidence-in-the-app.md#A3.5.16)).

- Przy każdym pliku cofa się jego rekord razem z jego miejscami w drzewie aplikacji. Źródło z niego zrobione
  zachowuje tekst i cytaty, tylko bez powiązania z plikiem. Zadanie, które trzyma plik, go puszcza; zadanie bez
  innych plików zostaje porzucone.
- Treść pliku (oryginał, kopia robocza, podglądy) znika tylko wtedy, gdy tej samej treści nie ma inny plik badania
  ani inne badanie na tym komputerze. Wtedy znikają też obrazy źródeł z tą samą treścią i ich wycinki; źródło traci
  obraz, nigdy swój tekst.
- `--dry-run` mówi wszystko, plik po pliku (`--json`: `impacts`). Wiele plików: `--files-from <plik>` (jedno ID na
  wiersz, `-` to standardowe wejście).
- `strom input show I…` mówi przy usuniętym pliku, że człowiek usunął go trwale; `strom input list` go nie pokaże.
  Ta sama treść przyniesiona ponownie to nowy materiał.
- **Pilnuje kod:**
  - wszystko albo nic: plik, którego badanie nie ma, i nie usunie się nic; najwyżej 500 plików;
  - bez `--dry-run` człowiek mówi tak we własnym terminalu (Enter to nie), inaczej w oknie systemu; gdy nie ma kogo
    zapytać, polecenie kończy się kodem 4;
  - agent go nigdy nie uruchomi ani nie zaproponuje; z potwierdzeniem aplikacji zostanie odrzucony
    (`material.agent`);
  - potwierdzenie aplikacji obowiązuje tylko dla wykazu, który człowiek widział w aplikacji, i najwyżej 15 minut.
    Zmieniony wykaz (`material.delete-changed`) ani stare potwierdzenie nic nie usuną;
  - gdy innego badania na tym komputerze nie da się odczytać (nowszego `strom`), treść zostaje zapisana.
- **Granice:** w aplikacji Strom nie da się tego cofnąć; plik zostaje tylko w kopii zapasowej (`strom backup`) albo
  paczce zrobionej wcześniej. Historia badania zachowuje rekord.
- **Od badania 1.36.0:** plik drzewa genealogicznego (zaimportowany GEDCOM, plik JSON aplikacji) usuwa się tak
  samo. Gdy powstało z niego źródło i ono nadal obowiązuje, polecenie się kończy (`material.source-live`): plik da
  się usunąć tylko razem z tym źródłem, `--retract-sources S…`. Najpierw usuwa się źródło, jak przy `strom source
  retract` ([R3.10](R3-verification-and-citation.md#R3.10)); na oba wystarczy jedno tak i wszystko zapisuje się
  jednym commitem. Źródło można potem przywrócić, ale już bez pliku.
- **Obsługa:** terminal: `strom input delete I… [--dry-run] [--files-from …] [--retract-sources S…]`; aplikacja:
  **Usuń trwale…** przez most (`POST /material/delete`, [R11.5.4](#R11.5.4)).
- **Obowiązuje od:** badanie 1.35.0

<!-- zdroj: research:0cc2cfca src/commands/intake.ts input delete (popis, --files-from, skrytý --confirm, isAgent → material.agent, checkDeleteConfirm → material.delete-changed, material.body, souhlas člověka, exit 4) · src/core/materialdelete.ts (hlavička: historie drží záznam, bajty jen v záloze nebo balíčku; DELETE_MOST_FILES=MATERIAL_MOST_EDIT=500, DELETE_CONFIRM_MS 15 min; nečitelný jiný výzkum → nic se nesmaže) · input show („deleted for good“), input list bez smazaných · CHANGELOG.md 1.35.0 · 1.36.0: e6bbfb40 src/commands/intake.ts input delete (--retract-sources, material.source-live, jeden commit), ui.input.delete.retracted · src/core/live.ts POST /material/delete {files, confirm, sources} -->

<a id="R11.6"></a>
## R11.6 Wysłane pliki agent przejrzy dopiero po włączeniu

Plik wysłany do badania sam nie uruchamia pracy agenta. Zostaje zapisany i czeka w Materiałach nieuporządkowany, dopóki
człowiek nie poprosi o uporządkowanie albo dopóki w ustawieniach badania nie włączy, że wysłane pliki agent przejrzy
sam (`intake.auto`).

- **Pilnuje kod:**
  - `intake.auto` jest domyślnie wyłączone, także w badaniach założonych wcześniej; nic się nie przekształca i o nic
    się nie pyta;
  - wyłączone: zamknięta partia (aplikacja, telefon, zamknięcie dzień po ostatnim pliku) nie zakłada zadań
    porządkowania. Zadanie nie powstaje też przy pojedynczym pliku z aplikacji (materiał osoby, skan źródła, oryginał
    portretu lub zdjęcia związku z zapisu drzewa, [S8.3](S8-where-the-data-are.md#S8.3)), przy pliku wysłanym
    ponownie z kolejną osobą lub notatką, przy pliku ponownie wyświetlonym, przy uzupełnionym materiale ani przy
    plikach `strom intake`;
  - włączone: jak dotąd. Partia daje zadania porządkowania po mniej więcej 25 plików, które idą w kolejce na przodzie
    ([R11.4](#R11.4)), plik swoje zadanie materiały ([R11.1](#R11.1)), skan źródła zadanie odczytu;
  - zadanie powstaje zawsze z wyraźnego działania człowieka: **Uporządkuj agentem…** ([R11.5.3](#R11.5.3)),
    `--sort`, plik jako odpowiedź na czekające zadanie ([R6.7.1](R6-awaiting-action.md#R6.7.1)), **Odczytaj
    dokument…**, a także tekst (`strom intake --text`), który mówi człowiek;
  - włączyć może tylko człowiek: w terminalu, w menu albo w aplikacji Strom. Agentowi włączenie zostaje odrzucone.
    Wyłączyć może każdy. Zadania porządkowania, które już powstały, po wyłączeniu zostają;
  - ustawienie obowiązuje dla jednego badania (`--for-tree`) albo dla wszystkich badań na komputerze.
- **Dlaczego:** porządkowanie korzysta z subskrypcji AI i zmienia drzewo (przypisuje pliki do osób, nazywa je,
  zakłada źródła). Samo wgranie pliku nie może uruchomić pracy AI; dokumenty rodziny wymagają zgody człowieka.
- **W aplikacji:** przełącznik w ustawieniach badania ([S4.4.11](S4-research-from-the-app.md#S4.4.11)), koniec
  wysyłania partii i **Wyślij materiał…** ([A3.5](A3-evidence-in-the-app.md#A3.5)).
- **Obsługa:** terminal: `strom config set intake.auto on|off --for-tree`; menu **Ustawienia** → „Pliki wysłane do
  badania agent przegląda sam: wyłączone”; `strom intake <pliki> --sort` (pliki agent przejrzy od razu); menu
  **Dodaj materiały** pyta „Zlecić przejrzenie agentowi (zadania dla agenta, korzysta z subskrypcji AI)?” (domyślnie
  nie); `strom input batch done <partia> --sort` (uporządkować partię zamkniętą bez zadań). Most: `POST /intake
  {auto}`, `POST /batch/<id>/done` z `sort`.
- **Obowiązuje od:** badanie 1.36.0

<!-- zdroj: research:da86bbe7, 90f33705 src/core/config.ts:400 intake.auto (tree: true, off|on, výchozí off), :962 intakeAuto · src/commands/setup.ts:1311, :1655-1673 intakeDecision (requireHuman, STROM_FOR_APP bez agenta, off kdokoli) · src/commands/intake.ts:202-225 (--sort, --text vždy úkol), :829-848 input batch done --sort/--no-sort · src/cli/menu-research.ts:110-125 (ui.intake.sort.ask, výchozí ne; ui.intake.done.waits) · src/cli/menu-settings.ts:98, :247-250 · src/core/live.ts:6693 POST /intake, BRIDGE_FEATURES intake.auto · cs.json ui.settings.intake(.about, .on, .off), ui.intake.sort.ask, ui.intake.done.waits · CHANGELOG.cs.md 1.36.0 · dirigent:spec/130 K1.1–K1.3, K2.1, K3.1, K4.1, rozhodnutí 21. 11. · app:docs/ZADANI_VYZKUM_trideni-davek.md (Most, Doplněk K1.3) · app:strings.ts read.menu (položka menu s „…“, titulek read.title bez) · dirigent:prace/1122-app-nalezy-330 -->
