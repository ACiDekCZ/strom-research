<a id="A14"></a>
# A14 Zarządzanie drzewami i zmiana struktury

Drzewami w aplikacji zarządza się w jednym oknie, **Zarządzanie drzewami**. Co ma się stać z drzewem (nowe drzewo
z wyboru, kopia, podział, połączenie z innym drzewem, dodanie z pliku), oferuje jedna pozycja, **Zmień strukturę…**.
Przy każdej opcji napisano, które drzewo się zmieni. Do każdego badania należy tylko jedno drzewo; kopie i nowe drzewa
są bez badania ([S1.10](S1-connecting-app-and-research.md#S1.10)). Rozdział opisuje aplikację Strom 3.32.0; zmiany
z nowszej wersji mają przy sobie jej numer.

<!-- zdroj: dirigent:spec/139-zmenit-strukturu-dialog · app:a9bc0b6b src/structure-options.ts, src/ui/structure-ui.ts · 518c9654, e9f50b62 src/ui/structure-select-ui.ts · 3110125c, fbd97361 src/ui/tree-management.ts, src/tree-row.ts · bcb2a0fa, 023879dd, f3c66503 · strings.ts structure.*, treeManager.* · dirigent:prace/1123-app-139-* -->

<a id="A14.1"></a>
## A14.1 Zarządzanie drzewami

Zarządzanie drzewami pokazuje wszystkie drzewa w aplikacji, każde w takim samym wierszu z tymi samymi danymi. Dane
wiersza pochodzą z rejestru drzew; dane drzewa nie są dla nich wczytywane.

- **Wiersz drzewa:**
  - nazwa i oznaczenia **Otwarte**, **Zablokowane**, **Ukryte**;
  - „N osób · M par · rozmiar · edytowano …”. Drzewo, które część obrazów dzieli z innym drzewem (kopia, scalenie),
    ma przy rozmiarze „· obrazy wspólne”. Podpowiedź po najechaniu: „Część obrazów drzewo dzieli z innym drzewem:
    rozmiar je wlicza, ale miejsce zajmują tylko raz.” ([S8.7](S8-where-the-data-are.md#S8.7));
  - wiersz pochodzenia, pierwszy, który pasuje:

    | Drzewo | Wiersz |
    |---|---|
    | drzewo, które należy do badania | „Badanie {numer}” i przełącznik **Badanie włączone** ([S1.9](S1-connecting-app-and-research.md#S1.9)) |
    | kopia drzewa | „kopia drzewa „{nazwa}” · bez badania” i wyłączony przełącznik ([S1.10](S1-connecting-app-and-research.md#S1.10)) |
    | nowe drzewo z wyboru | „wycinek z drzewa „{nazwa}” · bez badania” |
    | drzewo z pliku | „z GEDCOM {plik} · bez badania”, „z pliku {plik} · bez badania” |
    | pozostałe | „bez badania” |

  - drzewo śledzone na żywo ma „◎ Śledzone na żywo”, a gdy zapis do niego czeka, także „· zapis do drzewa wstrzymany”;
  - drzewo ze scaleniami ma odnośnik **Historia scaleń (N)** ([A8.11](A8-merging-trees.md#A8.11));
  - przyciski **Otwórz** (nie przy otwartym drzewie), **Zmień strukturę…** ([A14.2](#A14.2)), **Eksportuj…** i ⋯
    **Więcej działań**.
- **Niedokończone scalania** stoją pod drzewem, do którego zapiszą: „Niedokończone scalanie: {źródło} → {cel}”, „N do
  decyzji” (ta sama liczba co krok 2 kreatora), ile par jest przejrzanych, „zapisano …”, i odnośniki **Kontynuuj**,
  **Zmień nazwę**, **Odrzuć**. Scalanie, którego drzewo docelowe zostało usunięte, jest w sekcji **Niedokończone
  scalania bez drzewa** z uwagą „drzewo docelowe zostało usunięte”.
- **⋯ Więcej działań** przy drzewie, w grupach oddzielonych linią:
  1. **Przegląd drzewa**, **Statystyki** ([A13](A13-tree-statistics.md#A13)), **Jakość danych**, **Kopie zapasowe**,
     **Historia scaleń** (tylko ze scaleniem), **Historia zmian**;
  2. badanie: **Przegląd badania** (telefon i tablet), **Wyślij zmiany do badania** (tylko drzewo, które należy do
     badania), i jeden wiersz badania: przy kopii **Włącz badanie…**, inaczej ustawienia badania, **Rozpocznij
     badanie** albo instalacja;
  3. **Zmień nazwę…**, **Domyślna osoba i widok** ([A6.1.1](A6-views.md#A6.1.1)), **Otwieranie przy uruchomieniu**,
     domyślne ustawienia osi życia, przy otwartym drzewie **Miejsca** i **Formy nazwiska**;
  4. **Zmień strukturę…**;
  5. **Ukryj drzewo** / **Pokaż drzewo**, **Zablokuj drzewo** / **Odblokuj drzewo**;
  6. **Usuń drzewo…**.
- Stopka okna: **Eksportuj wszystko**, **Nowe drzewo**, **Zamknij**. Od 6 drzew nad listą jest pole **Szukaj
  drzewa…**.
- **Upuszczenie na wiersz:** plik GEDCOM lub drzewo Strom (`.json`) upuszczone na wiersz drzewa otwiera kreator
  scalania z tym drzewem jako celem; wiersz drzewa przeciągnięty myszą na inny wiersz scala je do tego drzewa przez
  kreator. Wiersz pod przeciąganym plikiem ma przerywane obramowanie i mówi „Upuszczenie: dodanie {plik} do drzewa
  {drzewo}” ([A8.5.1](A8-merging-trees.md#A8.5.1)).
- **Granice:**
  - zablokowane drzewo ma w ⋯ tylko odczyt i **Odblokuj**; drzewo zapisane nowszą wersją aplikacji tylko odczyt;
  - **Duplikuj**, **Scal z innym drzewem…**, **Podziel** i **Wydziel niepołączone części** nie ma w ⋯; są
    w **Zmień strukturę…**. Wydzielenie niepołączonych części nadal oferuje też import
    ([S6.4](S6-tree-from-another-program.md#S6.4)) i Przegląd drzewa w **Szybkie działania** ([A5](A5-tree-check.md));
  - kopia drzewa badania nie ma działań badania, tylko **Włącz badanie…**.
- **Obsługa:** **Akcje › Drzewo › Zarządzanie drzewami…**; przełącznik drzew → **Zarządzanie drzewami…**; na
  telefonie arkusz drzew → **Zarządzanie drzewami ›**.
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:3110125c src/ui/tree-management.ts renderTreeManagerList (stats z indexu, badges, canStructure, pendingRow, mergeFacts subPending 134 S-P2, pendingOrphans, targetGone, searchable ≥ 6) · fbd97361 src/tree-row.ts treeOriginLine (research → copy → fromTree → importedFrom → none) · src/ui/tree-actions.ts treeActionGroups (overview, research, settings, structure, manage, delete, trees; manageTrees jen mimo správu) · 7b967fd8 strings.ts treeManager.imagesShared, imagesSharedTip (134 S-P1) · bcb2a0fa (kopie s vypnutým přepínačem, ◎ Sleduje se živě, zápis stojí) · strings.ts structure.research, followed, writeStopped, fromTree, fromGedcom, fromFile, mergeHistory, pendingRow, savedAt, pendingOrphans, targetGone, treeManager.* · app:73ee4625 src/tree-drop.ts, src/ui/tree-management.ts (puštění na řádek) · strings.ts mergeWizard.dropOnTree -->

<a id="A14.2"></a>
## A14.2 Zmień strukturę…

Okno **Zmień strukturę: {drzewo}** oferuje wszystko, co z drzewa robi inne drzewo albo coś do niego dodaje, w trzech
grupach. Przy każdej opcji napisano, które drzewo się zmieni: „Co ma się stać z drzewem. Przy każdej opcji napisano,
które drzewo się zmieni.”

| Grupa | Opcja | Co się stanie |
|---|---|---|
| **Nowe drzewo** | **Z wyboru…** | ród, lista osób, linia albo widok; powstanie nowe drzewo ([A14.3](#A14.3)) |
| | **Kopia całego drzewa** | powstanie kopia bez połączenia z badaniem ([A14.3](#A14.3)) |
| **Podziel** | **Na rodziny…** | według rodów, gałęzi lub z perspektywy osoby powstaną nowe drzewa ([A14.4](#A14.4)) |
| | **Wydziel niepołączone części…** | z części, których nic nie łączy, powstaną nowe drzewa ([A14.4](#A14.4)) |
| **Połącz** | **Wybór lub całe drzewo do innego drzewa…** | przez kreator scalania; zmieni się drzewo docelowe, można cofnąć ([A14.5](#A14.5)) |
| | **Z innego drzewa do tego drzewa…** | inne drzewo aplikacji przez kreator scalania; zmieni się to drzewo, można cofnąć ([A14.5](#A14.5)) |
| | **Dodaj z pliku do tego drzewa…** | GEDCOM lub plik Strom (JSON) przez kreator scalania; zmieni się to drzewo, można cofnąć ([A14.5](#A14.5)) |

Nowe drzewo, kopia i podział nie zmieniają pierwotnego drzewa.

- **Wyszarzona opcja** pokazuje pod sobą powód:
  - **Z wyboru…** i **Dodaj z pliku…** przy drzewie, które nie jest otwarte: „Po otwarciu drzewa.” z odnośnikiem
    **Otwórz drzewo {nazwa}** (otwiera drzewo i ponownie okno);
  - **Wydziel niepołączone części…** przy drzewie, które jest całe połączone: „Całe drzewo jest połączone.” Przy dużym
    drzewie liczy się to w tle, a opcja pozostaje aktywna, dopóki nie jest to pewne;
  - **Wybór lub całe drzewo do innego drzewa…**, gdy nie ma innego drzewa: „Nie ma innego drzewa.” Cel, do którego
    teraz nie można zapisywać, nie wyszarza opcji: dlaczego, powie kreator scalania ([A8.5](A8-merging-trees.md#A8.5));
  - **Dodaj z pliku…** przy drzewie śledzonym na żywo: „Drzewo jest śledzone na żywo; nie można teraz do niego
    zapisywać.” z odnośnikiem **Zakończ śledzenie**;
  - **Z innego drzewa do tego drzewa…**, pierwszy powód, który pasuje: „Nie ma innego drzewa.” → „Po otwarciu
    drzewa.” → „Drzewo jest śledzone na żywo; nie można teraz do niego zapisywać.” z odnośnikiem **Zakończ
    śledzenie**.
- Wszystkie opcje są widoczne bez przewijania na ekranie laptopa 1366 × 657 i 1024 × 768, także z wyszarzonymi
  opcjami i powodami pod nimi. Gdzie pod krawędzią okna jest jeszcze coś, dół okna się rozmywa.
- **Granice:** zablokowane drzewo i drzewo tylko do odczytu nie mają okna (pozycji brak). Przy opcjach okno ma
  **Zamknij**, w dalszych krokach **Wstecz** · **Anuluj** i przycisk kroku; otwarte z Zarządzania drzewami wraca do
  niego.
- **Obsługa:** **Akcje › Drzewo › Zmień strukturę…**; Zarządzanie drzewami, przycisk **Zmień strukturę…** w wierszu
  drzewa i w ⋯; na telefonie z menu **Więcej** przy drzewie. Strzałki w górę i w dół, Home i End przechodzą między
  aktywnymi opcjami.
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:a9bc0b6b src/structure-options.ts (OPTIONS, STRUCTURE_GROUPS, blocked: select notOpen, parts connected, into noOther, file notOpen/followed+stopFollowing; readOnly bez dialogu), src/ui/structure-ui.ts structureOptionRow (důvod pod volbou, Ukončit sledování), structureOpenTree, structureRunOption, arrowKeys · defe53b4 (Zavřít na volbách, Zpět · Zrušit · primární na krocích) · 45d5be44 (telefon) · strings.ts structure.intro, group.*, opt*, why*, openTree, research.stop · app:5e85dfc1 src/structure-options.ts (from: noOther → notOpen → followed + stopFollowing) · fef250eb, f4050b1c (všechny volby bez posouvání do 1366 × 657 a 1024 × 768, rozplynutí spodku okna) · dirigent:spec/139 K3.2, K3.3 -->

<a id="A14.3"></a>
## A14.3 Nowe drzewo z wyboru i kopia całego drzewa

**Z wyboru…** prowadzi przez dwa kroki: **Kogo wziąć** i **Podsumowanie**. **Kopia całego drzewa** przechodzi od razu
do podsumowania. Wynikiem jest nowe drzewo bez badania; pierwotne drzewo się nie zmienia.

- **Kogo wziąć:** siedem źródeł, pod każdym „Wybrano: …” z rzeczywistą liczbą osób:

  | Źródło | Co bierze |
  |---|---|
  | **Bieżący widok** | „Osoby widoczne teraz na ekranie:”; tylko w widoku Rodzina lub Potomkowie, inaczej wyszarzone z „Tylko w widoku Rodzina lub Potomkowie.” |
  | **Ród / nazwisko** | jeden ród; małe rody są w zwiniętym wierszu **Inne rodziny** |
  | **Lista osób** | linie badania, **Listy stałe**, **Listy automatyczne** ([A11](A11-lists-of-people.md#A11)); pole **Szukaj listy…** |
  | **Przodkowie osoby** | osoba i liczba pokoleń 1–10 albo wszystkie |
  | **Potomkowie osoby** | to samo w dół |
  | **Linia prosta osoby** | „Linia prosta: przodkowie i potomkowie osoby, bez rodzeństwa i ich rodzin.”, pokolenia w górę i w dół |
  | **Ręcznie** | osoby wybrane jedna po drugiej |

- **Podsumowanie:** „{Co} – nowe drzewo otrzyma:” (przy kopii „Kopia otrzyma całe drzewo {nazwa}:”) i liczby osób,
  par, źródeł i obrazów według tych samych reguł, według których drzewo powstanie. Z wybranym dzieckiem przechodzi też
  jego drugi rodzic. Obrazy są tylko liczone, nie są wczytywane do pamięci. Duży wybór liczy się partiami („Liczenie…
  N z M osób”), a **Utwórz drzewo** (**Utwórz kopię**) czeka na koniec liczenia.
- **Osobne części:** osoby połączone tylko przez niewybranych ludzi będą w nowym drzewie osobno: „N osób jest
  połączonych tylko przez niewybrane osoby i w nowym drzewie będzie osobno.” **Pokaż nazwiska (N)** wypisuje je razem
  z tym, kto je łączy („łączy {imię}”).
- **Nazwa:** nowe drzewo „{drzewo} — {co}” (np. „Horákovi — ród Vlková”), kopia pierwsza wolna z „{drzewo} (kopia)”,
  „{drzewo} (kopia 2)”, „(kopia 3)”… Nazwę, którą ma już inne drzewo, pole sygnalizuje pod sobą („Drzewo o tej nazwie
  już istnieje.”), a zapisać nadal można. Wolną nazwę bierze też kopia drzewa wstawionego udostępnionym linkiem.
- **Po utworzeniu:** aplikacja przechodzi do nowego drzewa, na jego domyślną osobę pośrodku, i ogłasza „Utworzono
  drzewo „{nazwa}” (N osób).” z działaniem **Wróć do {pierwotne drzewo}**. Kopia wraca do okna, z którego przyszła.
- **Granice:**
  - z wyboru tylko przy otwartym drzewie; kopia także przy zamkniętym;
  - ani nowe drzewo, ani kopia nie są połączone z badaniem: „Pierwotne drzewo się nie zmienia. Nowe drzewo nie jest
    połączone z badaniem.”; przy kopii „…własne badanie można włączyć później w zarządzaniu drzewami.”
    ([S1.10](S1-connecting-app-and-research.md#S1.10));
  - nowe drzewo z wyboru ma w Zarządzaniu drzewami pochodzenie „wycinek z drzewa „{nazwa}””, kopia „kopia drzewa
    „{nazwa}””; kopia kopii nosi nazwę tej kopii.
- **Obsługa:** **Zmień strukturę…** › **Z wyboru…**, **Kopia całego drzewa** (zastępuje dawne **Duplikuj**).
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:518c9654, b79b55ad, 1ff40d37 src/ui/structure-select-ui.ts (WHO_KINDS, CUT_VIEWS family/descendants, paneList selectionLines + pevné/automatické, panePerson generace 1–10/všechny, directNote, summarizeSubsetSteps po dávkách, create disabled do konce) · src/structure-options.ts summarizeSubset, keptWithGlue (druhý rodič vybraného dítěte), islands · e9f50b62 (Duplikovat → souhrn kopie, bez dialogu názvu) · 7b967fd8 src/tree-copy-name.ts freeCopyName, treeNameTaken (134 S-N4) · 21989997 (nový strom na výchozí osobě) · src/tree-manager.ts duplicateTree copyOf · strings.ts structure.kind.*, chosen, summaryLead, copyLead, islands, islandVia, showNames, defaultName, keepNote, copyKeepNote, create, createCopy, counting, imagesNotLoaded, createdToast, backTo, treeManager.duplicateSuffix, duplicateSuffixN, duplicateNameTaken -->

<a id="A14.4"></a>
## A14.4 Podziel

Podział robi z jednego drzewa kilka nowych. Pierwotne drzewo zostaje dokładnie takie, jakie jest; niechciane można
usunąć w Zarządzaniu drzewami.

- **Na rodziny…** otwiera okno **Podział na rodziny**. **Co jest jedną rodziną:**
  - **Rody według nazwisk:** dzieci należą do rodzica, którego nazwisko noszą; osoba wżeniona bez własnej rodziny
    zostaje przy partnerze;
  - **Gałęzie drzewa:** główna linia ze wszystkimi wżenionymi i każda dołączona gałąź osobno;
  - **Z perspektywy osoby:** drzewem podstawowym jest linia wybranej osoby (bezpośredni przodkowie, ich rodzeństwo
    krwi, własne rodzeństwo, wszyscy potomkowie); **Rodziny rodzeństwa zachować do** kuzynów, kuzynów drugiego
    stopnia lub nikogo; kolejne drzewa podstawowe przez **Dodaj osobę…**; **Cięcia przy rodzeństwie** wybierają,
    czyja rodzina będzie drzewem pobocznym.

  To samo drzewo dzieli się zawsze tak samo; pokazana osoba decyduje tylko o tym, która rodzina jest pierwsza. Nowe
  drzewa pozostają połączone przez wspólne osoby. Przycisk **Utwórz N drzew**.
- **Wydziel niepołączone części…** otwiera **Niepołączone części tego drzewa**: rodziny, między którymi nie prowadzi
  żaden rodzic, dziecko ani małżeństwo, z liczbą osób i najstarszą osobą. Wybrane wydziela się do nowych drzew
  (**Wydziel N**), każde nazwane według swojej części. Drzewo, które jest całe połączone, tej opcji nie ma
  ([A14.2](#A14.2)).
- **Granice:** **Na rodziny…** działa też przy drzewie, które nie jest otwarte: propozycje pokazują się od razu,
  uporządkowane od domyślnej osoby drzewa (bez niej od pierwszej osoby); podział nie zależy od osoby.
- **Obsługa:** **Zmień strukturę…** › **Na rodziny…**, **Wydziel niepołączone części…**; po imporcie pliku z kilkoma
  rodzinami **Wydziel niepołączone części…** ([S6.4](S6-tree-from-another-program.md#S6.4)); Przegląd drzewa,
  **Szybkie działania** ([A5](A5-tree-check.md)). Z obu okien prowadzi droga z powrotem do Zmień strukturę.
- **Obowiązuje od:** aplikacja 3.32.0 (w oknie Zmień strukturę); sam podział jest starszy

<!-- zdroj: app:src/ui/split-families-ui.ts (kopie, originál nedotčen), src/split-families.ts · src/ui/split-ui.ts (nespojené části, components.ts) · src/ui/structure-ui.ts structureRunOption families (aktivní: showSplitFamiliesDialog, jinak showSplitFamiliesPickerDialog), parts showSplitDialog · 3e3b6c35 (cesta zpět do Změnit strukturu, oddělená část pojmenuje svůj strom, části spočítané jednou) · strings.ts splitFamilies.*, split.* -->

<a id="A14.5"></a>
## A14.5 Połącz

Połączenie prowadzi zawsze przez kreator scalania ([A8.5](A8-merging-trees.md#A8.5)): dokąd, kto jest kim, co się
zmieni. Zapisuje się dopiero po potwierdzeniu w kreatorze i można je cofnąć ([A8.12](A8-merging-trees.md#A8.12)).

- **Wybór lub całe drzewo do innego drzewa…** otwiera **Połącz z innym drzewem**, krok „co połączyć”:
  - **Całe drzewo {nazwa}:** do drzewa docelowego zostanie dodane, czego w nim brakuje;
  - **Wybór…:** krok **Kogo wziąć** jak przy nowym drzewie ([A14.3](#A14.3)); tylko przy otwartym drzewie. Pod wyborem
    jest napisane, ilu partnerów kreator weźmie dodatkowo: „Razem z nimi przejdą też ich partnerzy (2) – drudzy
    rodzice wybranych dzieci, łącznie 9 osób.” Import nazywa się w kreatorze „{drzewo} — {co}”.

  **Przejdź do kreatora** otwiera kreator, w którym wybiera się drzewo docelowe. To drzewo się nie zmienia.
- **Z innego drzewa do tego drzewa…** otwiera **Dodaj z innego drzewa**, krok „z którego drzewa”: „Które drzewo dodać
  do tego drzewa. Wybiera się całe; zawęzić je można w pierwszym kroku kreatora.” Oferuje wszystkie inne drzewa
  aplikacji alfabetycznie, także ukryte i kopie, każde z „N osób · wiersz pochodzenia · Ukryte” ([A14.1](#A14.1)).
  **Przejdź do kreatora** otwiera kreator scalania z wybranym całym drzewem jako importem i tym drzewem jako celem
  ([A8.5](A8-merging-trees.md#A8.5)). Wybrane drzewo się nie zmienia; to drzewo zmieni się dopiero po potwierdzeniu
  w kreatorze, a scalenie można cofnąć (**Cofnij** w powiadomieniu, **Historia scaleń**). Długa nazwa bez spacji
  łamie się na telefonie w wierszu.
- **Dodaj z pliku do tego drzewa…:** **Plik GEDCOM (.ged)** (z innego programu: MyHeritage, Geni, Ancestry, Gramps…)
  albo **Plik Strom (.json)** (eksport ze Stromu, na przykład od krewnego). Po wybraniu pliku otwiera się kreator
  scalania z tym drzewem jako celem. Do drzewa nic się nie zapisze, dopóki kreator tego nie potwierdzi.
- **Granice:** gdy żadne drzewo nie może teraz przyjąć scalenia, okno Zmień strukturę zostaje, a kreator powie
  dlaczego. Dodanie z pliku i z innego drzewa działa tylko do otwartego drzewa, które nie jest śledzone na żywo. Co
  po scaleniu zostanie wysłane do badania, rozstrzyga [A8.13](A8-merging-trees.md#A8.13).
- **Obsługa:** **Zmień strukturę…** › **Wybór lub całe drzewo do innego drzewa…**, **Z innego drzewa do tego
  drzewa…**, **Dodaj z pliku do tego drzewa…**; plik lub wiersz drzewa upuszczony na wiersz Zarządzania drzewami
  ([A8.5.1](A8-merging-trees.md#A8.5.1))
- **Obowiązuje od:** aplikacja 3.32.0

<!-- zdroj: app:f0c5a3fb src/ui/structure-ui.ts structureJoinWhatStep, structureJoin (whole → showMergeTreesDialog, selection → structureWhoStep mode join → mergeSubsetInto „{strom} — {co}“), structureFileStep (startGedcomImportPlain, startJsonImportIntoTree) · 29d02a8c joinPartners · strings.ts structure.joinTitle, joinWhatIntro, joinWhole, joinWholeDesc, joinSelection, joinSelectionDesc, joinNote, continueGuide, joinPartners, fileTitle, fileGed*, fileJson*, fileNote · app:5e85dfc1 src/ui/structure-ui.ts (from: ostatní stromy podle abecedy, persons · treeOriginText · hiddenBadge; celý strom jako import, otevřený strom cíl) · fef250eb (dlouhý název na telefonu) · strings.ts structure.optFrom, optFromDesc, fromTitle, fromStep, fromIntro, fromNote · dirigent:spec/139 K3.2 -->
