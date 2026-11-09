<a id="A7"></a>
# A7 Księga, strony i eksport

Co aplikacja Strom daje z drzewa na zewnątrz (księga rodu, strony, pliki dla rodziny i dla innych programów) i jak
przy tym chroni osoby żyjące. Opisuje aplikację 3.21.2.

| Wynik | Co to jest |
|---|---|
| **Księga rodu** | księga do czytania od początku, do druku na A4 lub zapisu jako HTML ([A7.4](#A7.4)) |
| **Strony rodu**, **Strony drzewa** | połączony zestaw stron rodów, rodzin i osób ([A7.5](#A7.5)) |
| **Strona osoby** | całe życie jednej osoby, do przeglądania, druku i zapisu jako HTML ([A7.6](#A7.6)) |
| **Aplikacja z danymi (HTML)** | samodzielny plik z aplikacją i drzewem ([A7.7](#A7.7)) |
| **Wyślij rodzinie** | jeden plik e-mailem do otwarcia, uzupełnienia i odesłania |
| **Plakat** | bieżący widok jako SVG, PNG lub wielostronicowy PDF |
| **Kopia zapasowa danych (JSON)**, **GEDCOM**, **Tabela osób (CSV)** | dane do przywrócenia i dla innych programów ([A2](A2-loading-a-family-tree.md)) |

<!-- zdroj: app:strings.ts importExport.app, importExport.share, importExport.poster, importExport.book, importExport.backup, importExport.gedcom, importExport.csv · src/ui/import-export.ts -->

<a id="A7.1"></a>
## A7.1 Kto jest osobą żyjącą

Ochrona osób żyjących ([A7.2](#A7.2)) dotyczy tylko osób, które aplikacja uważa za żyjące.

1. Osoba oznaczona jako zmarła (**Nie żyje**) jest zmarła; osoba, która ma w danych wyraźnie „żyje”, jest żyjąca.
2. Osoba z datą zgonu jest zmarła.
3. W przeciwnym razie jest żyjąca, gdy od jej najpóźniejszego możliwego roku urodzenia minęło mniej niż 110 lat.
4. Osoba bez roku urodzenia i bez innej wskazówki jest żyjąca (bezpieczny wybór).

- Najpóźniejszy możliwy rok urodzenia bierze się z własnych dat i zdarzeń osoby, ze ślubu (co najmniej 14 lat przed
  nim) i z dzieci (rodzic jest co najmniej 12 lat starszy od dziecka, przez kolejne pokolenia).
- **Granice:** znak † przy osobie w drzewie to inna zasada (domniemana śmierć po 120 latach) i ochroną nie steruje.
  Zgon potomka sam nie oznacza przodka jako zmarłego.
- **Obsługa:** pole wyboru **Nie żyje** w edycji osoby; przy dodawaniu krewnego zaznacza się samo, gdy wypełni się
  datę lub miejsce zgonu.
- **Obowiązuje od:** aplikacja 1.2.0; samoczynne zaznaczenie Nie żyje aplikacja 3.21.2

<!-- zdroj: app:src/privacy.ts:215 ASSUMED_MAX_AGE, :217 MIN_PARENT_AGE, :219 MIN_MARRIAGE_AGE, :229 isLivingPerson, inferBirthUpperBounds · presumedDeceasedSet · strings.ts person.deceased · CHANGELOG.cs.md 3.21.2 -->

<a id="A7.2"></a>
## A7.2 Ochrona osób żyjących

Przed wynikiem z drzewa wybiera się, jak pokazać osoby żyjące. W eksporcie opcja nazywa się **Prywatność osób
żyjących**, w księdze rodu **Ochrona osób żyjących**.

| Opcja | Imię i nazwisko osoby żyjącej |
|---|---|
| **Pełne dane** | bez zmian, nic się nie ukrywa |
| **Inicjały + rok urodzenia** | inicjały imienia i nazwiska, rok urodzenia zostaje; nazwisko po ślubie tylko inicjał |
| **Ukryj imiona i nazwiska** | „Osoba żyjąca”, bez nazwiska |
| **Zostaw tylko nazwisko** | „Osoba żyjąca” i nazwisko |

- Każda opcja poza Pełne dane odbiera osobom żyjącym wszystkie daty i miejsca, notatki, opowieści, zdjęcie,
  zdarzenia, cytaty, załączniki, warianty imienia i nazwiska, tytuły, nazwisko po ślubie, otwarte pytanie, REFN
  i dane badania. Przy Inicjałach zostaje rok urodzenia.
- Dane pary (daty, miejsce, notatka, świadkowie, opowieści, zdarzenia) znikają, gdy żyje co najmniej jedno
  z partnerów. Inicjały zostawiają rok początku związku.
- **Granice:** struktura zostaje zawsze: osoby, relacje i płeć. Zmarłe osoby się nie zmieniają.
- **Źródła:** w eksporcie (Aplikacja z danymi, JSON, GEDCOM) każda opcja poza Pełne dane pomija katalog źródeł,
  cytaty i załączniki **u wszystkich osób, także zmarłych** (aplikacja pisze to przy opcji). Księga rodu, strony
  i strona osoby odbierają źródła tylko osobom żyjącym; źródło cytowane tylko u żyjących wypada.
- **Obowiązuje od:** aplikacja 1.2.0; źródła zmarłych w księdze i na stronach aplikacja 3.18.0
- **Od aplikacji 3.26.0:** eksport GEDCOM zachowuje źródła i cytaty zmarłych w każdej opcji; pomija tylko cytaty osób
  żyjących i mówi to („U N żyjących osób zostanie pominiętych K cytatów. Zmarłym źródła pozostaną.”, opcja **Zachowaj
  źródła**). Eksport Aplikacja z danymi i JSON się nie zmienia. Eksport GEDCOM najpierw pyta, **Do czego służy plik**:
  **Z powrotem do {program}** (pełne dane, źródła i identyfikatory programu) albo **Do udostępnienia innym**
  ([S6.6](S6-tree-from-another-program.md#S6.6)).

<!-- zdroj: app:src/privacy.ts applyPrivacy (keepDeceasedSources) · strings.ts privacy.label, privacy.modeFull, privacy.modeInitials, privacy.modeAnonymous, privacy.modeMinimal, privacy.livingPerson, privacy.dropsSources · book.dlg.privacy · CHANGELOG.cs.md 3.18.0 -->

<a id="A7.2.1"></a>
### A7.2.1 Domyślna ochrona według wyniku

| Wynik | Opcja domyślna |
|---|---|
| Aplikacja z danymi (HTML) | Inicjały + rok urodzenia |
| GEDCOM | Inicjały + rok urodzenia |
| Wyślij rodzinie | Inicjały + rok urodzenia |
| Księga rodu | Inicjały + rok urodzenia |
| Strona osoby | Pełne dane, gdy na stronie nie ma żadnej osoby żyjącej; w przeciwnym razie ostatnio wybrana, inaczej Inicjały |
| Tabela osób (CSV), Eksportuj wszystkie drzewa | Pełne dane |

- **Granice:** Strony rodu i Strony drzewa nie tworzą dla chronionej osoby własnej strony ani odnośnika; w indeksie
  jest pod chronionym imieniem. Gdy wybór zawiera osoby żyjące, a ochrona jest wyłączona, okno ostrzega, że plik
  będzie zawierał ich imiona i nazwiska, daty i miejsca.
- **Obowiązuje od:** aplikacja 1.2.0; strona osoby aplikacja 3.18.0; księga rodu aplikacja 3.19.0
- **Od aplikacji 3.26.0:** GEDCOM z opcją **Do udostępnienia innym** (domyślnie) ma Inicjały + rok urodzenia, z opcją
  **Z powrotem do {program}** Pełne dane ([S6.6](S6-tree-from-another-program.md#S6.6)).

<!-- zdroj: app:src/ui/import-export.ts (výchozí privacy podle formátu) · src/book-options.ts:55 · src/person-page.ts:94, :104 personPageExportPrivacy · src/family-pages.ts:309 · src/ui/share-ui.ts · strings.ts familyPages.privacyWarn -->

<a id="A7.3"></a>
## A7.3 Zawartość pliku

Przy eksporcie obok ochrony wybiera się **Zawartość**: co zapisze się w pliku.

| Ustawienie wstępne | Zdjęcia | Załączniki i wycinki źródeł | Notatki | Źródła i cytaty |
|---|---|---|---|---|
| **Pełne archiwum** | tak | tak | tak | tak |
| **Mały plik do wysłania** | nie | nie | tak | tak |
| **Tylko szkielet** | nie | nie | nie | nie |

- **Granice:** struktura drzewa i imiona z nazwiskami zostają zawsze. Warsztat pracy badania (kolejka, zadania,
  szkice opowieści) nie trafia do eksportu nigdy. Opcja ochrony może pominąć źródła i załączniki także przy Pełnym
  archiwum ([A7.2](#A7.2)).
- **Obowiązuje od:** aplikacja 2.4.0

<!-- zdroj: app:src/privacy.ts CONTENT_PRESETS, stripResearchWork · strings.ts privacy.contentLabel, privacy.presetComplete, privacy.presetSmall, privacy.presetSkeleton, privacy.dropsSourcesContent -->

<a id="A7.4"></a>
## A7.4 Księga rodu

Księga rodu to księga do czytania od początku: drzewo genealogiczne, rodziny według pokoleń, opowieści i źródła.

- **Co w księdze:** **Całe drzewo** · **Rody** (jeden lub więcej) · **Przodkowie osoby** · **Potomkowie osoby**
  (wybór osób [A7.4.1](#A7.4.1)).
- **Części księgi** w tej kolejności: **Spis treści**, **Drzewo rodu**, **Rodziny** (zawsze), **Opowieści**,
  **Wykres i oś czasu życia**, **Epoka (historia)**, **Źródła**, **Wycinki zapisów i zdjęcia**, **Inne rodziny (małe
  rody)**, **Indeks osób**.
- Część bez treści się pomija, a okno mówi dlaczego: Opowieści potrzebują opowieści, wykres innej szczegółowości niż
  zwięzła, Epoka historii, Źródła cytowanych źródeł, Wycinki zdjęcia lub wycinka. Inne rodziny są tylko w księdze
  całego drzewa.
- **Ustawienie wstępne:** **Dla rodziny** (wszystkie części, zwykła szczegółowość, bez notatek i danych dla
  badaczy) · **Dla badaczy** (pełna szczegółowość, notatki, dane dla badaczy: stan udokumentowania i sprzeczności,
  [R3.8](R3-verification-and-citation.md#R3.8)) · **Własne**. Domyślnie jest Całe drzewo, Dla rodziny, Inicjały +
  rok urodzenia i język aplikacji.
- **Tytuł** tworzy się według wyboru (nazwa drzewa, Ród X, Przodkowie: imię, Potomkowie: imię) i można go zmienić.
- **Język księgi** zmienia nagłówki i opisy; danych z drzewa się nie tłumaczy.
- Wybory zapamiętuje się dla każdego drzewa.
- **Obsługa:** eksport **Księga rodu**; okno księgi: druk na A4 i **Zapisz jako HTML**.
- **Obowiązuje od:** aplikacja 3.19.0; ustawienie wstępne Własne aplikacja 3.21.0

<!-- zdroj: app:src/book-options.ts (části, předvolby, výchozí :55) · strings.ts book.dlg.kind, book.dlg.parts, book.dlg.preset, book.dlg.lang, book.parts, book.unavailable · CHANGELOG.cs.md 3.19.0, 3.21.0 -->

<a id="A7.4.1"></a>
### A7.4.1 Wybór osób do księgi i stron

| Wybór | Osoby | Kolejność |
|---|---|---|
| Całe drzewo | wszystkie osoby | według urodzenia |
| Rody | członkowie rodów z rodzinami oraz żony i mężowie członków | rozdział na każdy ród |
| Przodkowie osoby | przodkowie do wybranej liczby pokoleń i związki, z których członkowie pochodzą | pokolenie po pokoleniu, ojciec przed matką |
| Potomkowie osoby | potomkowie do wybranej liczby pokoleń przez synów i córki, z partnerami i wszystkimi związkami | według urodzenia |
| Wybrane osoby (tylko strony) | tylko wybrane osoby; rodzina tylko wtedy, gdy wybrano oboje partnerów | – |

- **Granice:** linię przodków i potomków niosą rodzice biologiczni i przysposabiający. Przybrany rodzic i rodzic
  zastępczy linii nie niosą. Przez ojca rozumie się rodzica mężczyznę, biologicznego przed przysposabiającym.
- **Obowiązuje od:** aplikacja 3.19.0; Wybrane osoby aplikacja 3.21.0

<!-- zdroj: app:src/lineage.ts selection, :279 isDescentLink · strings.ts book.dlg.kind, book.dlg.kindHint -->

<a id="A7.5"></a>
## A7.5 Strony rodu i strony drzewa

Strony to połączony zestaw stron: ród, rodziny i osoby z odnośnikami między sobą i z indeksami osób, rodzin,
nazwisk i miejscowości.

- **Strony rodu:** jeden lub więcej rodów ([A4](A4-surnames-and-families.md)).
- **Strony drzewa:** **Strony całego drzewa** (wszystkie rody i Inne rodziny), **Wybrane osoby**, przodkowie osoby
  z wybraną liczbą pokoleń.
- Ochrona osób żyjących i źródła według [A7.2](#A7.2); domyślnie Inicjały + rok urodzenia.
- **Obowiązuje od:** Strony rodu aplikacja 3.20.0; Strony drzewa aplikacja 3.21.0

<!-- zdroj: app:src/family-pages.ts · strings.ts familyPages.menuItem, familyPages.treePages, familyPages.treePagesAction, familyPages.indexTitle · spec 026 · CHANGELOG.cs.md 3.20.0, 3.21.0 -->

<a id="A7.6"></a>
## A7.6 Strona osoby

**Strona osoby** pokazuje całe życie jednej osoby: daty słowami, rodzinę jako małe drzewo genealogiczne, opowieść,
miejsca życia na mapie, oś życia z historią, wycinki z ksiąg metrykalnych i źródła oraz sekcję **Dla badaczy**.

- **Zapisz jako HTML** tworzy jeden samowystarczalny plik, który otwiera się offline w każdej przeglądarce. Grupy
  treści i ochronę osób żyjących można wybrać ([A7.2.1](#A7.2.1)); wybór jest zapamiętywany.
- **Obsługa:** menu karty osoby, **Strona osoby**; także z wachlarza.
- **Obowiązuje od:** aplikacja 3.18.0

<!-- zdroj: app:src/person-page.ts · strings.ts personPage.save, fan.personPage · CHANGELOG.cs.md 3.18.0 -->

<a id="A7.7"></a>
## A7.7 Zapisany HTML (samodzielny plik)

**Aplikacja z danymi (HTML)** zapisuje aplikację i drzewo w jednym pliku, który otwiera się w każdej przeglądarce bez
instalacji. **Eksportuj jako aplikację** w **Eksportuj wszystkie drzewa** umieszcza wszystkie drzewa w jednym pliku.

- Taki plik ma własną pamięć w przeglądarce. Z aplikacją na stromapp.info **się nie synchronizuje**; zmiany
  zachowuje **Zapisz plik** (pobiera kopię), a do aplikacji internetowej przenosi się je importem (**Z pliku HTML
  Strom**).
- **Granice:** plik domyślnie chroni osoby żyjące (Inicjały, [A7.2.1](#A7.2.1)).
- **Obowiązuje od:** aplikacja 1.0.0

<!-- zdroj: app:strings.ts importExport.app, importExport.appDesc, importExport.exportAllApp, importExport.fromHtml, embeddedMode.* · src/ui/import-export.ts -->

<a id="A7.8"></a>
## A7.8 Opowieść

Opowieść to spójny tekst o osobie albo o małżeństwie, zbudowany na faktach drzewa. Nie jest źródłem: fakty
dokumentują źródła, opowieść je tylko opowiada ([A3.6](A3-evidence-in-the-app.md#A3.6)).

- **Gdzie ją widać:** okno **Opowieść** (z menu karty osoby), strona osoby ([A7.6](#A7.6)) i w Księdze rodu część
  **Opowieści** dopiero po **Rodzinach** ([A7.4](#A7.4)). Opowieść pary, jedna na każde małżeństwo, stoi pod
  opowieścią osoby; w księdze ma własny podrozdział.
- **Format tekstu:** pusty wiersz dzieli akapity; wiersz `## …` to podtytuł; wiersze `- …` to wypunktowanie;
  `**pogrubienie**` i `*kursywa*`. Inne znaki zostają zwykłym tekstem. Ani `* 1831` (urodzenie), ani `1. ledna` na
  początku wiersza nie zaczyna wypunktowania. Początkowe `# …`, które tylko powtarza podtytuł rozdziału, jest
  pomijane. Goły kod źródła w tekście czyta się jako jego tytuł.
- **Granice:**
  - własną opowieść osoby można pisać i zmieniać w edycji osoby, sekcja **Opowieść**: **Podtytuł rozdziału**
    i **Tekst opowieści**. Sekcja jest widoczna, gdy włączone jest **Ustawienia → Karta osoby → Pola zaawansowane**
    albo jakiś tekst już istnieje. Opowieść pary i **Opiera się na** (fakty i zastrzeżenie autora) przychodzą
    z plikiem i są tylko do odczytu;
  - szkic z badania, jeszcze niezatwierdzony, ma etykietę **Szkic** i odnośnik **Zatwierdź w badaniu**. Nowa wersja
    z badania czeka obok zatwierdzonej („Nowa wersja czeka”, **Porównaj**); edycja w aplikacji jej nie usuwa,
    rozstrzyga się w badaniu ([R3.9.1](R3-verification-and-citation.md#R3.9.1));
  - w księdze ani w druku pod tekstem nie ma źródeł; źródła opowieści są ponumerowane w spisie źródeł księgi;
  - w pliku GEDCOM opowieść jest we własnym znaczniku `_STORY`, nie w notatce.
- **Obsługa:** menu karty osoby → **Opowieść**; edycja osoby → sekcja **Opowieść**.
- **Obowiązuje od:** aplikacja 2.8.0; opowieści par i strona osoby 3.18.0; w Księdze rodu 3.19.0

<!-- zdroj: app:src/story-text.ts:1 storyProseHtml (odstavce, ##, -, **, *) · src/ui/person-modal.ts:662 fillStoryFields · index.html pm-story-section · src/book-blocks.ts:594 storyBlock · src/book.ts proseHtml · src/person-page.ts · src/ged-exporter.ts:449 pushStory _STORY · strings.ts story.* · commit 52000825 (aplikace 2.8.0) · CHANGELOG.cs.md 3.18.0, 3.22.0 -->
