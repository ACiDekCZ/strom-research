<a id="S6"></a>
# S6 Drzewo z innego programu

Drzewo genealogiczne z innego programu (MyHeritage, Gramps, FamilySearch, programy dla Windows i inne) trafia do
aplikacji i do badania jako plik GEDCOM. Rozdział prowadzi przez całą drogę: co się wczytuje, a co ginie, jak widać,
skąd pochodzi dana, dlaczego dane z drzewa są tylko wskazówkami, jak wrócić do danej z drzewa, co proponuje karta
**Co dalej**, jak cofnąć się w czasie, jak wysłać drzewo z powrotem i co zrobi drzewo wczytane ponownie. Opisuje
aplikację Strom 3.26.0 i badanie 1.30.0. Szczegóły czytania pliku są w [A2](A2-loading-a-family-tree.md), eksport
w [A7](A7-book-pages-and-export.md), scalanie w [A8](A8-merging-trees.md), a przejęcie drzewa przez badanie
w [R11.3](R11-material-from-the-user.md#R11.3).

Plik, który napisał sam Strom (nagłówek `1 SOUR STROM`), ani plik JSON aplikacji nie jest drzewem z innego programu:
nie ma znacznika pochodzenia, karty **Co dalej** ani ochrony danych z drzewa. Badanie, które taki plik przejmie, ma
jego wartości za drzewo użytkownika ([S6.3](#S6.3)).

<!-- zdroj: dirigent:spec/066-import-ged-a-ai/spec.md (rozhodnutí: GED s 1 SOUR STROM není import) · app:1c9b2392 src/ui/import-next-ui.ts, src/reliability.ts · research:v1.30.0 CHANGELOG.cs.md 1.30.0 -->

<a id="S6.1"></a>
## S6.1 Co wczytuje się z drzewa, a co ginie

Aplikacja przejmuje osoby, rodziny, źródła, notatki, zdarzenia i media, które zna, a ponadto identyfikatory, które
program nadał ludziom i rodzinom. Czego nie przejmie, policzy i pokaże w podsumowaniu importu; nic nie ginie po cichu.

| Program lub plik | Co się wczytuje | Co się nie przenosi lub tylko liczy |
|---|---|---|
| MyHeritage | osoby i rodziny z identyfikatorami programu (`_UID`, `RIN`) i pierwotnym oznaczeniem rekordu (`@I12@`); zdjęcia z samodzielnych rekordów mediów (`0 @O1@ OBJE`) przez odsyłacze do nich; własne znaczniki programu (`_XXX`) bezpośrednio przy osobie, rodzinie i źródle zachowują się do eksportu z powrotem | wycinki zdjęć (`_POSITION`, `_CUTOUT`) są ewidencyjne i się ich nie liczy; głębsze własne znaczniki się liczy; zdjęcie rodziny przez samodzielny rekord mediów tylko się liczy |
| FamilySearch | osoby z identyfikatorem FamilySearch (`_FSFTID` albo `EXID` z adresem familysearch.org) | jak wyżej |
| Gramps | osoby z pierwotnym oznaczeniem rekordu (`@I0001@`) i `RIN`, jeśli plik je ma | identyfikatora, według którego dałoby się osobę rozpoznać na pewno, Gramps nie daje (brak `_UID`): ponownie wczytany plik paruje się głównie według imion, nazwisk i dat ([S6.7](#S6.7)) |
| programy dla Windows | tekst w kodowaniu Windows-1250 (Europa Środkowa) i Windows-1252 (Europa Zachodnia) z właściwymi literami; przy kodowaniu rozpoznanym na podstawie zawartości lub jednobajtowym i tekście ze znakami diakrytycznymi wiersz **Kodowanie tekstu** z przykładowymi nazwiskami i wyborem innego kodowania ([A2.2](A2-loading-a-family-tree.md#A2.2)) | – |
| GEDCOM 7 | `UID`, `EXID` jako identyfikator osoby | pakietu GEDZIP się nie wczytuje |

- **Pilnuje kod:**
  - identyfikatory osoby i rodziny (`_UID`, `UID`, `RIN`, `EXID`, `_FSFTID`, `AFN`) i pierwotne oznaczenie rekordu się
    zachowuje; wracają w eksporcie ([S6.6](#S6.6)) i do badania;
  - podsumowanie importu ma wiersz „Zachowano do eksportu „Z powrotem do {program}”: N znaczników (…)”, gdy plik ma
    własne znaczniki programu.
- **Granice:** zdjęć, które plik tylko wskazuje ścieżką lub adresem, w pliku nie ma: podsumowanie proponuje
  **Podłącz pliki multimediów…** ([A2.1.1](A2-loading-a-family-tree.md#A2.1.1)).
- **Obsługa:** **Import → Import GEDCOM**; podsumowanie importu (okno **Konwersja GEDCOM**).
- **Obowiązuje od:** aplikacja 3.26.0 (identyfikatory, rekordy mediów, własne znaczniki, kodowanie Windows-1250),
  badanie 1.30.0
- **Od aplikacji 3.30.0:** zdjęcie rodziny nie jest już tylko liczone: pierwszy obraz rodziny zawarty w pliku jest
  w drzewie zdjęciem pary, a zdjęcie rodziny wskazane ścieżką aplikacja proponuje podłączyć wśród związków
  ([A12.7](A12-portrait-and-couple-photo.md#A12.7)).

<!-- zdroj: app:1c9b2392 src/ged-parser.ts (původní ID, OBJE přes odkazy, _XXX úrovně 1, výřezy MyHeritage evidenční), docs/GEDCOM-IMPORT.md (kódování) · strings.ts gedcom.keptTags, encodingLabel, encodingSample, attachMedia · dirigent:prace/1108-app-066-u8/karta.md Výsledek (f9735c6a, d2551dbc, 281e19e1; FAM se podle ID nepárují; fotka rodiny přes OBJE jen spočítaná) · prace/1108-app-066-u1u2 · research:v1.30.0 src/core/import.ts candidates, notTaken · 3.30.0: app:68c232ad ged-parser.ts první obrázek rodiny → Partnership.photo, ExternalMediaRef.partnershipId -->

<a id="S6.2"></a>
## S6.2 Znaczniki wiarygodności: skąd pochodzi dana

Przy każdej danej osoby jest znacznik, jak wiarygodna jest: kto ją potwierdził lub udokumentował albo że przyszła
z drzewa innego programu i nikt jej dotąd nie sprawdził. Stopnie różnią się kropkami, znakiem ✓ i ramką, nigdy tylko
kolorem.

| Znacznik | Znaczenie (opis po najechaniu) |
|---|---|
| **Potwierdzone** (✓) | **Potwierdzone przez człowieka**: daną potwierdził, wpisał lub przywrócił człowiek albo przyjął propozycję badania |
| **Udokumentowane** (pełne kropki) | dana jest udokumentowana ([R3.1](R3-verification-and-citation.md#R3.1)); dwie pełne kropki tylko wtedy, gdy dwóch czytelników zapisu czyta zgodnie ([S7.1](S7-reliability-and-verification.md#S7.1)) |
| **Z drzewa** (puste kropki) | „Z drzewa (niezweryfikowane): przejęte z {program}, plik {data}” |

Pozostałe dane pokazują stopień pewności badania ([R3.1](R3-verification-and-citation.md#R3.1)). Wszystkie znaczniki,
znacznik na karcie w drzewie i weryfikację danych według oryginałów opisuje [S7](S7-reliability-and-verification.md).

- **Pilnuje kod:**
  - znacznik **Z drzewa** obowiązuje, dopóki dana ma wartość z pliku. Edycja kończy znacznik; przy danej zmienionej
    częściowo mówi, która część pochodzi z drzewa, a którą zmienił człowiek;
  - przy drzewie powiązanym z badaniem ([S1](S1-connecting-app-and-research.md)) aplikacja bierze pochodzenie danej
    z badania; w przeciwnym razie z zapisu o imporcie w aplikacji;
  - drzewo bez zapisu o imporcie (starszy import, plik Stromu) znacznika **Z drzewa** nie pokazuje: niczego się nie
    zgaduje;
  - w drzewie badania dana, którą badanie przejęło z drzewa z aplikacji Strom i której od tej pory nikt nie zmienił,
    ma znacznik według stopnia pewności, bez stopnia **Z drzewa**; ✓ nigdy
    ([S6.3](S6-tree-from-another-program.md#S6.3));
  - wiersz przy osobie mówi, skąd pochodzą dane: „Wszystkie dane osoby pochodzą z {program} (plik {data}, wczytano
    {data}).” albo „Dane oznaczone „z drzewa” pochodzą z …”.
- **Granice:** że dana nie ma źródła, aplikacja przy danej jeszcze nie pokazuje: znacznika **Bez źródła** przy danej
  nie ma ([S7.1](S7-reliability-and-verification.md#S7.1)).
- **Obsługa:** karta osoby (przy danej znacznik, **Co oznaczają znaczniki**); **Ustawienia → Karta osoby →
  Wiarygodność przy danych w karcie osoby** (domyślnie włączone) i **Na karcie pokazuj → Udokumentowanie
  i wiarygodność** (domyślnie włączone; karta w drzewie pokazuje najsłabszą z danych imię, urodzenie, zgon,
  [S7.2](S7-reliability-and-verification.md#S7.2)).
- **Od aplikacji 3.26.0:** dwie pełne kropki przy **Udokumentowane** dostaje dana, przy której podczas weryfikacji przez
  badanie zgodzili się dwaj czytelnicy aktu; karta w drzewie ma jeden znacznik zamiast dawnych dwóch opcji.
- **Od aplikacji 3.31.0 z badaniem 1.36.0:** imię i nazwisko z drzewa nie zostaje już na zawsze **Z drzewa**:
  badanie nadaje mu stopień według aktów, które je dokumentują, i można je zweryfikować oraz potwierdzić według skanu
  ([S7.10](S7-reliability-and-verification.md#S7.10), [R10.5.2](R10-people-and-hypotheses.md#R10.5.2)). Gdy żadna
  dana osoby nie jest już tylko z drzewa, wiersz przy osobie mówi „Dane osoby pochodzą z {program} (plik {data},
  wczytano {data}); żadna nie jest już tylko z drzewa.”
- **Obowiązuje od:** aplikacja 3.26.0, badanie 1.30.0

<!-- zdroj: app:7b0471f8 src/reliability.ts (pořadí human, proven, probable, possible, import, lead, none; tečky, ✓ a rámeček, ne barva; feature origin; bez záznamu o importu žádné Z rodokmenu; readers z _STROM_CHECKED, noSource nekrmeno) · src/ui/fact-status.ts · src/ui/person-reliability-ui.ts · src/settings.ts display.reliabilityCard (ON) · src/ui/card-signals-ui.ts (signál status, výchozí zapnuto) · index.html settings-group-card · strings.ts reliability.settingCard, cardDensity.cardStatus, settings.groupCard · app:669c08f0 src/reliability.ts userTreeOrigin (_STROM_ORIGIN tree) -->

<a id="S6.3"></a>
## S6.3 Dane z drzewa są wskazówkami: agent proponuje, człowiek decyduje

Drzewo innego programu to wnioski kogoś innego. Badanie traktuje jego dane jako wskazówki: zmienia je tylko według
aktu, który cytuje, w przeciwnym razie zmianę tylko proponuje. Tego, co wpisał lub zmienił człowiek, w aplikacji Strom
lub w badaniu, agent nigdy nie zmienia: tylko proponuje.

- **Pilnuje kod:**
  - każda dana w badaniu ma pochodzenie: z drzewa, od człowieka albo z badania;
  - wartość z drzewa z aplikacji Strom (plik albo drzewo aplikacji, które badanie przejęło), której od przejęcia nikt
    nie zmienił, należy do drzewa użytkownika: agent jej nie zmieni, tylko zaproponuje, jak przy danej człowieka, ale
    nie uchodzi za potwierdzoną przez człowieka. Edycja, przywrócona wartość, przyjęta propozycja i edycja wysłana
    z aplikacji są daną człowieka;
  - daną z drzewa agent zmienia tylko z cytowanym aktem; bez niego, a zawsze wtedy, gdy o hipotezach rozstrzyga
    człowiek ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)), powstaje propozycja jako sprzeczność do
    rozstrzygnięcia przez człowieka;
  - danej człowieka agent nie zmienia nigdy, także plikiem wczytanym przez `strom sync`; zawsze tylko propozycja;
  - propozycja, której proponowana wartość już obowiązuje, zamyka się sama. Propozycja, której wartość zmieniła się od
    jej powstania, jest nieaktualna: przyjąć jej nie można, można ją tylko zamknąć z zachowaną wartością;
  - wartość z drzewa zostaje zachowana obok zmienionej ([S6.3.1](#S6.3.1)).
- **Wynik w aplikacji:** przy danej z propozycją wiersz **Badania proponują zmienić dane z drzewa** (lub **Badania
  proponują zmienić dane wpisane przez człowieka**) i **Sprzeczność ›**. W sprzeczności stoją naprzeciw siebie
  **Teraz · z drzewa** (lub **Teraz · wpisane przez człowieka**) i **Propozycja badań**; opcje **Zachowaj z drzewa**
  i **Przyjmij propozycję**. Po przyjęciu dana jest potwierdzona przez człowieka, a przy danej zostaje **Pierwotnie
  z drzewa: …** z **Przywróć**.
- **Dlaczego:** drzewo wskazuje kierunek poszukiwań, nie jest dowodem. To, co wpisał człowiek, jest jego decyzją;
  agent może ją tylko poprzeć propozycją.
- **Obsługa:** aplikacja: **Sprzeczność ›** przy danej. Terminal: `strom conflict list`, `strom conflict show X…`
  (propozycja agenta i skąd pochodzi obecna wartość), `strom conflict resolve X… --take research|user`.
- **Obowiązuje od:** badanie 1.30.0, aplikacja 3.26.0

<!-- zdroj: research:v1.30.0 CHANGELOG.cs.md 1.30.0 (údaje z převzatého rodokmenu jsou chráněné) · dirigent:prace/1108-vyzkum-066-u3/karta.md, u3-nalezy, u3-nalezy2 Výsledek (původ import/user/research; --cite/--locator; conflict proposal; event edit/retract, person edit, name primary, place rewrite, source edit --transcript, sync; conflict.stale) · strom help conflict resolve (--take user|research) · app:1c9b2392 strings.ts origin.proposeImport, proposeUser, conflictOpen, sideImport, sideUser, sideProposal, keepImport, accept, acceptNote · research:94d75934 src/core/model.ts ValueOrigin.tree, src/core/origin.ts (user i tree: agent jen navrhuje), src/core/import.ts importGedcom/importStromJson (soubor aplikace → user + tree) -->

<a id="S6.3.1"></a>
### S6.3.1 Pierwotnie z drzewa i Przywróć

Dana z drzewa, którą zmieniło badanie lub człowiek, zachowuje pierwotną wartość. Aplikacja pokazuje ją przy danej
jako **Pierwotnie z drzewa:** z tym, według czego się zmieniła, i z przyciskiem **Przywróć**.

- **Pilnuje kod:**
  - **Przywróć** zapisuje wartość z drzewa ponownie (z cytatem drzewa). Przywrócona dana jest wtedy daną człowieka
    i badanie samo jej już nie zmieni; zapis, według którego się zmieniała, zostaje przy źródle;
  - przywrócić może tylko człowiek: w aplikacji albo przy swoim terminalu. Agentowi `strom` przywrócenie odrzuca;
  - przywrócić można datę, miejsce lub wartość zdarzenia (każdą część osobno) oraz imię i nazwisko lub płeć osoby.
- **Granice:**
  - **Przywróć** działa tylko na komputerze, na którym działa badanie (**Przywrócić można, gdy badania działają na tym
    komputerze.**); na telefonie nie;
  - wiersz **Pierwotnie z drzewa** i **Przywróć** ma tylko drzewo powiązane z badaniem; wspólne dane pary (ślub,
    rozwód) go nie mają.
- **Obsługa:** aplikacja: karta osoby → przy danej **Przywróć** → **Przywrócić dane z drzewa?**. Terminal:
  `strom event revert E… [--part date|place|value]`, `strom person revert P… --name N [--part given|surname]`,
  `strom person revert P… --sex`.
- **Obowiązuje od:** badanie 1.30.0, aplikacja 3.26.0

<!-- zdroj: research:v1.30.0 strom help event revert, person revert („Only the user: in the Strom app or at their own terminal“) · most /facts/revert · app:1c9b2392 strings.ts origin.was, by, accepted, revert, confirmTitle, confirmNote, noBridge, phone · src/ui (Původně/Vrátit jen s feature origin; vztahy páru bez řádku) -->

<a id="S6.4"></a>
## S6.4 Karta Co dalej

Po wczytaniu drzewa z innego programu aplikacja pokazuje kartę **Co dalej**: skąd drzewo pochodzi i co można z nim
dalej zrobić. Pokazuje się raz po każdym imporcie, niezależnie od tego, czy drzewo założono jako nowe, wstawiono, czy
scalono.

- **Zawartość:**
  - pochodzenie: „Drzewo z {program} (plik {data}) · N osób” (przy wstawieniu i scaleniu do którego drzewa i ile
    osób);
  - wiersz kontroli danych: „Znalazła N rzeczy do przejrzenia. Nic nie poprawia się samo.” i **Przejrzyj**
    ([A5](A5-tree-check.md)), albo „Kontrola danych nie znalazła nic do poprawy.”;
  - gdy plik zawiera kilka rodzin, których nic nie łączy: **Wydziel niepołączone części…**;
  - badanie: bez badania na tym komputerze **Badanie przodków z tym drzewem** i **Badanie przodków**; z badaniem
    **Rozpocznij badanie z tym drzewem**; drzewo powiązane z badaniem **Badanie z tym drzewem** (miejsca bez położenia
    i osoby z danymi z drzewa), **Odszukaj miejsca** oraz, gdy badanie potrafi zbiorczą weryfikację, **Sprawdź dane
    w źródłach** (otwiera **Zweryfikuj dane w drzewie**, [S7.5](S7-reliability-and-verification.md#S7.5));
  - zdanie „Badania traktują dane z drzewa jako wskazówki: bez dowodu ze źródła ich nie nadpisują, a zmienione można
    przywrócić.”;
  - odnośniki **Z powrotem do {program}: eksport ze źródłami…** ([S6.6](#S6.6)) i pomoc **Drzewo z innego programu**.
- **Granice:** karta jest tylko przy pliku innego programu. Zastępuje dawne pytania po imporcie (kontrola, oddzielenie
  rodzin).
- **Obowiązuje od:** aplikacja 3.26.0
- **Od aplikacji 3.32.0:** karta pokazuje się po imporcie do nowego drzewa i po **Wstaw do drzewa**. Po scaleniu pliku
  z istniejącym drzewem się nie pokazuje: kontrola danych jest w ostatnim kroku kreatora (**Sprawdź drzewo**,
  [A8.11](A8-merging-trees.md#A8.11)).

<!-- zdroj: app:7b0471f8 src/ui/import-next-ui.ts (IMPORT_NEXT_HELP_TOPIC = 'A2', nextCardClosed, :302 verify → showVerifyBulkDialog) · src/import-next.ts IMPORT_NEXT_VERIFY_FEATURES ['verify.bulk'] · strings.ts importNext.* · dirigent:prace/1108-app-066-u5 · 3.32.0: app:debf50cc src/merge/ui.ts finishDone (afterImport jen u w.newTree s importId), step6Env noNextCard · strings.ts mergeWizard.noNextCard -->

<a id="S6.5"></a>
## S6.5 Kopie zapasowe i powrót w czasie

Przed każdym importem do drzewa i przed scaleniem aplikacja zapisuje kopię zapasową drzewa. Do stanu sprzed importu
można więc wrócić.

- **Pilnuje kod:**
  - automatyczne kopie zapasowe drzewa powstają codziennie oraz przed importem lub scaleniem; **Wstaw do drzewa** też
    tworzy kopię zapasową;
  - kopie zapasowe są przechowywane w tej przeglądarce, nie w pliku z drzewem: znikną po wyczyszczeniu danych
    przeglądarki i nie ma ich na innym komputerze. Trwałą kopię daje eksport drzewa do pliku;
  - przy dużych kopiach zapasowych najstarsze są usuwane wcześniej; trzy najnowsze zostają zawsze.
- **Obsługa:** aplikacja: menu drzewa → **Kopie zapasowe** → okno **Historia kopii zapasowych**: **Utwórz kopię
  zapasową teraz**, **Przywróć**, **Pobierz**; przełącznik **Automatyczne kopie zapasowe tego drzewa**.
- **Obowiązuje od:** aplikacja 3.26.0 (kopia zapasowa przed **Wstaw do drzewa**)
- **Od aplikacji 3.27.0:** kopia zapasowa **Przed dostosowaniem danych do nowej wersji** powstaje, zanim aplikacja przy
  otwarciu dostosuje drzewo zapisane starszą wersją; obecnie tylko po to, by połączyć źródła różniące się tylko
  wiarygodnością ([A2.6.1](A2-loading-a-family-tree.md#A2.6.1)).
- **Od aplikacji 3.32.0:**
  - kopie zapasowe **Przed importem** i **Przed scaleniem** powstają zawsze, także przy wyłączonym przełączniku
    **Automatyczne kopie zapasowe tego drzewa** („Codziennie; przed importem i scaleniem zawsze.”); kopię **Przed
    scaleniem** tworzy każde scalenie do drzewa, z dowolnego wejścia;
  - kopia **Przed scaleniem** zostaje, dopóki scalenie można cofnąć: rotacja kopii zapasowych jej nie usuwa. Gdyby
    z jej powodu musiała odejść inna, kreator zapyta ([A8.10](A8-merging-trees.md#A8.10));
  - bez kopii zapasowej scalenie się nie zapisze;
  - cofnięcie scalenia robi własną kopię zapasową **Przed cofnięciem scalenia**, także zawsze; rotacja jej nie usuwa,
    dopóki scalenie można przywrócić;
  - odłączenie kopii od wspólnego badania robi kopię zapasową **Przed dostosowaniem danych do nowej wersji**
    ([S1.10.2](S1-connecting-app-and-research.md#S1.10.2));
  - jedno scalenie można cofnąć także bez przywracania całej kopii zapasowej: **Cofnij scalenie…**
    ([A8.12](A8-merging-trees.md#A8.12)). Kopia zapasowa przywraca całe drzewo, razem ze wszystkim, co stało się od
    scalenia.

<!-- zdroj: app:1c9b2392 src/snapshots.ts SnapshotReason pre-import, pre-merge · src/ui/import-export.ts:818, :940 snapshotNow('pre-import') · src/data.ts:892 · src/ui/merge-ui.ts:769 · src/ui/tree-actions.ts:196 · strings.ts snapshots.menu, title, autoLabel, autoHint, inBrowser, budgetNote, createNow, restore, download · 3.27.0: app:5721b016 src/snapshots.ts SnapshotReason pre-migration, src/tree-manager.ts joinQualityOnlySourcesOf, strings.ts pre-migration · 3.32.0: app:debf50cc src/data.ts:2047 backupBeforeMerge (bez ohledu na automatické zálohy, keepFor), snapshotNow pre-import/pre-merge vždy · src/snapshots.ts planRetention (keepFor se nesmaže), retention · src/merge/write.ts:231 · strings.ts snapshots.autoHint, mergeWizard.backupLine, retentionAsk, backupFailed, vsBackup · spec 134 K0.4 · app:e2a6d712 pre-merge-undo „Před odvoláním sloučení“ (134 N5) · e4e3eeea pre-migration před odpojením kopie -->

<a id="S6.6"></a>
## S6.6 Eksport z powrotem do programu lub do udostępnienia

Eksport GEDCOM najpierw pyta, **Do czego służy plik**: **Z powrotem do {program}** (lub **Z powrotem do innego
programu**) albo **Do udostępnienia innym**. Według tego chroni osoby żyjące i zwraca identyfikatory programu.

- **Z powrotem do {program}:** „Całe drzewo ze źródłami i cytatami, do własnego programu genealogicznego.” Pełne dane
  wszystkich osób, także żyjących; źródła i cytaty. Osoby i rodziny z drzewa tego programu dostają z powrotem swoje
  pierwotne oznaczenie rekordu, gdzie jest to bezpieczne, i wiersze swoich identyfikatorów (`_UID`, `RIN`, `EXID` …);
  oznaczenie, którego nie można użyć, idzie jako `REFN` z `TYPE {program} xref`. Własne znaczniki programu (`_XXX`)
  z importów tego samego programu wracają.
- **Do udostępnienia innym:** „Chroni osoby żyjące, zawartość można dostosować.” (domyślna ochrona GEDCOM,
  [A7.2.1](A7-book-pages-and-export.md#A7.2.1)). Zmarłym źródła pozostają; u osób żyjących cytaty się pomija, a okno
  to mówi („U N żyjących osób zostanie pominiętych K cytatów. Zmarłym źródła pozostaną.”).
- **Pilnuje kod:**
  - eksport GEDCOM zachowuje źródła i cytaty zmarłych w każdej opcji; eksport JSON, HTML i CSV się nie zmienia
    ([A7.2](A7-book-pages-and-export.md#A7.2));
  - zdjęć i załączników plik nie ma: inne programy nie odczytują ich z pliku;
  - przy **Z powrotem do {program}** wiersz podsumowania **Źródła i cytaty (N źródeł, M cytatów)** liczy rekordy
    źródeł, które plik zapisze. Źródła, które import utworzył z jednego rekordu źródła dla każdej cytowanej strony
    ([A2.6](A2-loading-a-family-tree.md#A2.6)), wracają jako ten jeden rekord: dwie księgi metrykalne cytowane przy
    81 danych dają „2 źródła, 81 cytatów”. W drzewie zostaje źródło dla każdej cytowanej strony;
  - **Oznacz dane z badań notatką** (domyślnie włączone, tylko gdy drzewo ma dane z badania): dana, którą uzupełniło
    lub poprawiło badanie, dostaje notatkę „Wywiedzione przez badania Strom (według: …)”;
  - w przeciwnym razie identyfikatory programu zapisują się pod własnymi znacznikami Stromu (`_STROM_IMPORT`), aby
    przy kolejnym wczytaniu do Stromu wróciły.
- **Obsługa:** **Eksport → Eksport GEDCOM → Do czego służy plik**; z karty **Co dalej** odnośnik **Z powrotem do
  {program}: eksport ze źródłami…** (otwiera eksport z opcją z powrotem).
- **Obowiązuje od:** aplikacja 3.26.0
- **Od aplikacji 3.27.0:** zdjęcie rodziny z pliku innego programu wraca w **Z powrotem do {program}** przy
  rodzinie tak, jak zapisał je plik; odsyłacz do rekordu medium wraca jako zdjęcie zapisane bezpośrednio przy rodzinie
  ([A2.2](A2-loading-a-family-tree.md#A2.2)).
- **Od aplikacji 3.30.0:** obraz rodziny, który przy imporcie stał się zdjęciem pary, i zdjęcie rodziny podłączone
  z pliku nie wracają w **Z powrotem do {program}**: ten eksport nie ma zdjęć. Pozostałe obrazy rodziny wracają jak
  w 3.27.0. **Do udostępnienia innym** zapisuje zdjęcie pary przy rodzinie jako `OBJE`, gdy zawartość eksportu ma
  zdjęcia ([A12.7](A12-portrait-and-couple-photo.md#A12.7)).

<!-- zdroj: app:7cf409bd src/ged-exporter.ts backSourceRecordCount (sourceGroups: jeden záznam za skupinu) · src/ui/export-gedcom-ui.ts backSources → exportGed.sumSources · e2e/export-gedcom-back.spec.ts · app:1c9b2392 src/ged-exporter.ts backToXrefs (původní xref, ID řádky úrovně 1, REFN + TYPE {prog} xref, _XXX téhož programu, jinak _STROM_IMPORT / _STROM_XID) · src/ui/import-export.ts:267 keepDeceasedSources: true (jen GEDCOM) · strings.ts exportGed.* -->

<a id="S6.7"></a>
## S6.7 Drzewo wczytane ponownie i scalanie

Drzewo tego samego programu wczytane ponownie i scalone z drzewem znajduje swoich ludzi według identyfikatora
programu. Osoba, która ma ten sam identyfikator, ale poza tym się nie zgadza, jest tylko proponowana.

- **Pilnuje kod:**
  - dopasowanie według identyfikatora obowiązuje jako pewne tylko wtedy, gdy imię i nazwisko są podobne, płeć nie jest
    mężczyzna wobec kobiety, lata urodzenia (w przeciwnym razie chrztu) różnią się najwyżej o 3 i żaden inny globalny
    identyfikator (na przykład FamilySearch) się nie różni. W przeciwnym razie to tylko propozycja dopasowania
    z wynikiem najwyżej 79. Powód dopasowania to **Ten sam identyfikator w pliku**;
  - `_UID` paruje się z `UID`, `_FSFTID` z `EXID` z adresem familysearch.org;
  - oznaczenie rekordu i `RIN` dodają do zgodności imion i nazwisk 25 punktów, tylko przy plikach tego samego
    programu; same dopasowania nie tworzą;
  - nierozstrzygnięte dopasowanie przy scaleniu potwierdza się samo dopiero od wyniku 80; dopasowanie 50–79 jest tylko
    proponowane (?) i bez decyzji człowieka się nie łączy ([A8.3](A8-merging-trees.md#A8.3));
  - notatka osoby, relacji i źródła przy scaleniu się nie podwaja;
  - rodzeństwo znane tylko z nazwiska przy ponownym scaleniu tego samego pliku nie przybywa po raz drugi.
- **Drzewo wczytane starszą wersją aplikacji:** scalenie tego samego pliku daje to samo drzewo i ten sam eksport
  **Z powrotem do {program}** co nowy import: rodziny (ani rodzina z jednym nazwanym rodzicem) się nie podwajają i nie
  przybywa ślub, którego plik nie ma. Osoba tylko z imieniem i bez dat paruje się z osobą drzewa o tym samym imieniu
  przez sparowanego krewnego (powód na przykład **Dziecko dopasowanej osoby**, **Rodzeństwo dopasowanej osoby**,
  **Teść, teściowa, zięć lub synowa dopasowanej osoby**); wynik 50, zawsze tylko do sprawdzenia. Nie paruje się, gdy
  krewny ma dwie osoby o tym samym imieniu, różni się płeć albo daty urodzenia lub zgonu.
- **Granice:**
  - rodzin według identyfikatora się nie paruje;
  - identyfikator, który w drzewie ma więcej niż jedna osoba, sam dopasowania nie tworzy, tylko je proponuje
    ([A8.2](A8-merging-trees.md#A8.2));
  - znaczników **Z drzewa** scalenie drzewa ze starszej wersji nie uzupełnia: jego wartości pozostają danymi
    człowieka. Znaczniki daje nowy import pliku;
  - duplikatów z wcześniejszego scalenia scalenie nie usuwa; usuwa się je ręcznie.
- **Ręczne scalenie dwóch osób** (okno **Scalanie osób**) łączy notatki obu osób i obu połączonych rodzin, każdą
  część raz.
- **Obsługa:** **Import → Import GEDCOM → Scal z istniejącym** ([A8](A8-merging-trees.md)).
- **Obowiązuje od:** aplikacja 3.26.0; 3.27.0: identyfikator kilku osób drzewa tylko proponuje; ręczne scalenie
  osób łączy notatki (wcześniej nie łączyło)
- **Od aplikacji 3.32.0:** **Import → Import GEDCOM** otwiera kreator **Import drzewa** z opcją **Dodaj do drzewa**
  ([A8.6](A8-merging-trees.md#A8.6)). Ten sam plik scalony ponownie kreator rozpozna: doda tylko osoby, które
  poprzednio pominięto, a połączonych osób nie podwoi. Dopasowanie 50–79 bez decyzji człowieka się nie łączy; pozostałe
  pary można naraz dodać jako nowe albo pominąć ([A8.7](A8-merging-trees.md#A8.7)).

<!-- zdroj: app:7b0471f8 CHANGELOG.cs.md 3.26.0 (Slučování) · src/merge matchSameNamedRelatives, standInsOfKnownFamilies (b3c3ce00) · strings.ts merge reasons partner_of_matched, child_of_matched, parent_of_matched, sibling_of_matched, in_law_of_matched · dirigent:prace/1109-app-slouceni-325, 1109-app-gedy-opravy (N6: značky importu se starému stromu nedoplní), 1109-app-jeden-rodic Výsledek · 3.32.0: app:debf50cc src/ui/import-export.ts openGedcomGuide, src/merge/ui.ts repeatLine (otisk souboru) · strings.ts mergeWizard.repeat, restAdd, restSkip · CHANGELOG.cs.md 3.32.0 -->
<!-- zdroj: app:1c9b2392 src/merge/matching.ts ID_MATCH_SCORE 100, ID_CANDIDATE_SCORE 60, ID_MAX_YEAR_GAP 3, WEAK_ID_BONUS 25, offerOnlyCap · src/merge/executor.ts:82 AUTO_CONFIRM_SCORE = 80 · src/merge/notes.ts · strings.ts merge reason id „Stejné ID v souboru“ · dirigent:prace/1108-app-066-u8/karta.md Výsledek (FAM se podle ID nepárují; mergePersons neslučuje poznámky) -->
<!-- zdroj: 3.27.0: app:ffe1da9f src/data.ts mergePersons (notes: mergeNoteText keep+remove; partnership note: mergeNoteText) · app:b5595ca1 src/merge/matching.ts idNamesSeveral, findDirectMatches · app:a5fc9656 src/ged-parser.ts keptMedia, extras OBJE (export zpět jako ostatní _XXX rodiny) · strings.ts personMerge.title „Sloučit osoby“ · CHANGELOG.cs.md 3.27.0 · dirigent:test/vysledek-1109-app-drobnosti-ged.md P1 (dialog poznámku jako konflikt nenabízí: detectFieldConflicts jen jméno, příjmení, narození, úmrtí) -->

<a id="S6.8"></a>
## S6.8 Drzewo w badaniu

Badanie przejmuje drzewo z innego programu poleceniem `strom intake` jako wskazówki
([R11.3](R11-material-from-the-user.md#R11.3)) i zachowuje pochodzenie każdej danej ([S6.3](#S6.3)).

- **Pilnuje kod:**
  - identyfikatory programu się zachowuje: to samo drzewo przejęte po raz drugi (albo drzewo innego programu) znajduje
    według nich ludzi, nikogo nie dodaje dwa razy, a nowe dane przybywają jako wskazówki;
  - osoby tylko być może tej samej (inne imię, inny identyfikator FamilySearch albo tylko identyfikator bez `_UID` jak
    u Gramps) się nie łączy: wynik mówi „Może ta sama osoba co w badaniu według ID programu (nie połączono, do
    rozstrzygnięcia): …” (w `--json` `candidates`);
  - co plik ma, a nie zostaje przejęte (rekordy mediów, odnośniki do mediów, własne znaczniki programu), wynik liczy:
    „Nie przejęto z pliku: …” (w `--json` `notTaken`);
  - plik w kodowaniu Windows-1250 lub Windows-1252 („ANSI”) czyta się z właściwymi literami; znak, którego nie da się
    odczytać, jest zgłaszany, nigdy nie zostaje po cichu zastąpiony;
  - identyfikatory wracają z badaniem do aplikacji Strom;
  - badanie założone wcześniej po aktualizacji raz samo się oznacza (które dane przyszły z drzewa, a które są
    człowieka); żadna wartość się nie zmienia. Gdzie nie jest to pewne, dana uchodzi za daną człowieka. Wartość
    z drzewa z aplikacji Strom rozpoznaje po historii badania: zaraz po przejęciu drzewa była, wcześniej nie, i jest
    taka sama dziś; tylko taka wartość należy do drzewa użytkownika ([S6.3](#S6.3)).
    `strom fixes undo origins` cofa oznaczenia, `strom fixes run origins` nadaje je potem ponownie. Także przed
    oznaczeniem ponownie przejęte drzewo znajduje ludzi według identyfikatorów wcześniejszych importów.
- **Obsługa:** terminal: `strom intake rodokmen.ged`, `strom conflict list`, `strom event revert`,
  `strom person revert`, `strom fixes show origins` (czym jest poprawka i co tu znalazła),
  `strom fixes undo origins`, `strom fixes run origins`.
- **Obowiązuje od:** badanie 1.30.0

<!-- zdroj: research:v1.30.0 CHANGELOG.cs.md 1.30.0 · src/core/import.ts ImportResult.candidates, notTaken · src/commands/intake.ts:300-313 · assets/lang/cs.json ui.intake.candidates, ui.intake.notTaken* · strom help fixes run („readers, proven-originals and origins are set right by themselves once, run again only after strom fixes undo“) · dirigent:prace/1108-vyzkum-066-u3, 1108-vyzkum-066-u8 Výsledek (origins-1, nejisté → user; Gramps bez _UID kandidáti) · research:94d75934 src/core/originfix.ts ORIGINS_TREE_SETTLED origins-tree-1 (podle historie: stejná hodnota hned po převzetí, ne před ním, stejná dnes), settleOrigins · cs.json ui.fixes.origins.example.tree · strom help fixes show -->

<a id="S6.9"></a>
## S6.9 E-mail osoby: kontakt, nie miejsce zamieszkania

Adres e-mail osoby to jej **kontakt**, nie wydarzenie ani miejsce, w którym osoba mieszkała. GEDCOM trzyma go
w adresie pod wydarzeniem: MyHeritage zapisuje e-mail jako miejsce zamieszkania (`1 RESI` / `2 EMAIL`), inne programy
jako `1 EMAIL` bezpośrednio przy osobie. Aplikacja i badanie robią z tego kontakt osoby.

- **Pilnuje kod (aplikacja):**
  - miejsce zamieszkania, które niesie tylko kontakt (e-mail, telefon, strona www, faks, pusty adres albo adres tylko
    z etykietą „Email”; bez daty, miejsca, prawdziwego adresu, notatki, źródła i pliku), wczytuje się jako kontakt
    osoby, nie jako wydarzenie. Miejsce zamieszkania z czymś własnym zostaje miejscem zamieszkania, a jego e-mail
    przechodzi do kontaktu (już nie jako wiersz notatki). `1 EMAIL` przy osobie to także kontakt;
  - w drzewie zapisanym starszą wersją aplikacji wiersze e-maila, które zapisał tam import, przechodzą przy każdym
    wczytaniu do kontaktu. Nic, co napisał człowiek, się nie zmienia; puste miejsce zamieszkania zostaje w danych,
    tylko nie pokazuje się na liście wydarzeń;
  - każdy adres jest w kontakcie raz (bez względu na wielkie i małe litery), najwyżej 254 znaki, bez spacji;
  - eksport GEDCOM zapisuje każdy adres jako `1 RESI` / `2 EMAIL`; **Z powrotem do {program}** zapisuje `1 EMAIL`,
    który plik miał przy osobie, tak samo jak on ([S6.6](#S6.6));
  - ochrona osób żyjących ([A7.2](A7-book-pages-and-export.md#A7.2)): osoba żyjąca kontaktu do eksportu nie przekazuje;
  - strona osoby pokazuje adresy jako odnośnik e-mail tylko w oknie aplikacji; strona zapisana do pliku kontaktu nie
    ma;
  - do badania kontakt idzie tylko z badaniem, które kontakty przechowuje; starszemu badaniu, które odczytałoby go
    jako miejsce zamieszkania bez miejsca, się go nie wysyła, a aplikacja trzyma go sama.
- **Pilnuje kod (badanie):**
  - e-maile z drzewa genealogicznego (miejsce zamieszkania tylko z e-mailem, starsza notatka aplikacji „E-mail: …”)
    stają się kontaktem osoby; `strom person show` i karta osoby pokazują go osobno od danych. Nigdy nie staje się
    wydarzeniem ani miejscem zamieszkania, a agent go nie dostaje;
  - synchronizacja z aplikacją dodaje i usuwa e-maile jak inne zmiany;
  - kontrola `strom fixes contact-residences` („Kontakty zapisane jako miejsca zamieszkania”) znajduje miejsca
    zamieszkania, które z e-maili zrobiło starsze badanie. Naprawa przenosi e-maile do kontaktu (każdy raz), miejsce
    zamieszkania tylko z kontaktem wycofuje z podaniem powodu, a etykietę „Email” usuwa z domu; nic nie usuwa.
    Miejsce zamieszkania z cytowanym aktem, z ludźmi albo z własną notatką zostaje bez zmian. Naprawę uruchamia tylko
    człowiek, jest bezpłatna, a `strom fixes undo contact-residences` ją cofa.
- **Dane:** kontakt drzewo niesie od wersji danych 26; starsze wersje aplikacji otwierają takie drzewo tylko do
  odczytu.
- **Obsługa:** aplikacja: edycja osoby, sekcja **Zdjęcia i notatki**, pole **E-mail** (kilka adresów oddzielonych
  przecinkami); pole jest widoczne przy włączonych **Ustawienia → Karta osoby → Pola zaawansowane** albo gdy osoba
  ma adres. Terminal: `strom person show`, `strom fixes show contact-residences`,
  `strom fixes run contact-residences`, `strom fixes undo contact-residences`.
- **Obowiązuje od:** aplikacja 3.32.0, badanie 1.37.0

<!-- zdroj: app:972e73d7 src/person-contact.ts (hlavička: pravidlo RESI jen s kontaktem, 1 EMAIL; cleanEmail EMAIL_MAX 254, bez mezer; sameEmail bez velikosti písmen; isContactResidence, isEmptyResidence, moveContactsIntoPeople při každém načtení), src/ged-exporter.ts contacts (výchozí ano, do výzkumu jen s person.contact; 1 RESI / 2 EMAIL; Zpět do: 1 EMAIL jak byl), src/privacy.ts (žijící bez emails) · app:0603165b index.html #emails-group v Fotografie a poznámky, src/ui/person-modal.ts applyAdvancedFieldVisibility emails-group, emailsFromInput (čárky, středníky, mezery), src/person-page.ts jen c.app, mailto, src/ui/person-events.ts shownEvents (prázdné bydliště skryté) · src/version.ts STROM_DATA_VERSION 26 · strings.ts labels.emails, placeholders.emails, personModal.sectionPhotoNotes · research:ce89202a src/core/live.ts person.contact (1 RESI / 2 EMAIL, nejvýš tři na RESI), src/commands/fixchecks.ts CONTACT_RESIDENCES, src/commands/fixes.ts contact-residences · cs.json ui.fixes.contact-residences.* · CHANGELOG.cs.md 1.37.0 „E-maily osoby jsou kontakt“, app CHANGELOG.cs.md 3.32.0 Data · dirigent:spec/134 K0.10, U11 -->
