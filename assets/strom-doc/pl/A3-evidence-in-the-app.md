<a id="A3"></a>
# A3 Udokumentowanie w aplikacji

Jak w aplikacji zapisuje się źródła, cytuje się je, dołącza wycinki i pliki oraz gdzie aplikacja sama pokazuje, czego
brakuje. Opisuje aplikację Strom 3.21.2 (i badanie 1.25.2); zmiany z nowszej wersji mają przy sobie jej numer. Jak pewna
jest dana i jak liczy się udokumentowanie osoby, opisuje [R3.8](R3-verification-and-citation.md#R3.8); import źródeł
z GEDCOM jest w [A2](A2-loading-a-family-tree.md).

<a id="A3.1"></a>
## A3.1 Źródło to jeden zapis

Źródło to jeden konkretny zapis: chrzest, ślub, zgon. Drzewo ma jedną listę źródeł. Osoby i dane tylko się do nich
odwołują, więc jeden zapis może dokumentować wiele osób i wiele danych.

- Pola: **Tytuł** (obowiązkowe), **Archiwum / instytucja**, **Sygnatura / strona**, **URL**, **Notatka**. Pod
  **Więcej: transkrypcja, data zapisu, wiarygodność** są **Transkrypcja zapisu**, **Data zapisu**
  i **Wiarygodność**. Sekcja jest otwarta, gdy któreś z nich jest wypełnione.
- **Data zapisu** mówi, kiedy zapis sporządzono. Może się różnić od daty zdarzenia, np. chrzest zapisany później.
- **Wiarygodność** ma trzy stopnie: **Oryginał**, **Odpis / indeks**, **Niepewne**. Drugie kliknięcie wybranego
  stopnia go anuluje. Ocenia jedno źródło, nie daną. Jak traktuje ją badanie, opisuje
  [R3.2.1](R3-verification-and-citation.md#R3.2.1).
- **Granice:** bez tytułu źródła nie da się zapisać („Brak tytułu źródła”). Nieprawidłowa **Data zapisu** się nie
  zapisze. Wartość wiarygodności 0 z importu GEDCOM pokazuje się jako **Niepewne** i zostaje, dopóki nie wybierze się
  innego stopnia. Usunięcie źródła usuwa wszystkie jego cytaty; aplikacja najpierw pyta i mówi, w ilu miejscach jest
  cytowane.
- **Obsługa:** **Akcje → Źródła** (lista źródeł drzewa z liczbą cytatów „n×”, wyszukiwanie od 11 źródeł, sortowanie
  według tytułu); **Edycja źródła**, **Dodaj źródło**. Pozycja **Źródła** w menu **Akcje** jest tylko przy drzewie,
  które można edytować, i tylko wtedy, gdy jakieś źródło już istnieje lub włączone jest **Ustawienia → Karta osoby →
  Pola zaawansowane**.
- **Obowiązuje od:** aplikacja 1.4.0; **Wiarygodność** i **Data zapisu** 3.1.0

<!-- zdroj: app:src/types.ts Source · src/ui/sources.ts:214 renderSourcesList, :327 deleteSource, :531 fillSourceEditor, :576 wireSourceEditor, :667 renderQualityControl, :733 saveSourceFromModal · src/ui/tree-management.ts:675 isSourcesMenuOffered · src/settings.ts:320 isAdvancedFields · strings.ts sources.titleHint/fieldTitle/fieldRepository/fieldReference/fieldUrl/fieldNote/more/fieldTranscript/fieldRecordDate/recordDateHint/fieldQuality/quality1-3/titleRequired/citations/deleteConfirm, advanced.settingLabel -->

<a id="A3.1.1"></a>
### A3.1.1 Transkrypcja i Transkrypcja zweryfikowana

**Transkrypcja zapisu** to tekst zapisu tak, jak go odczytał użytkownik. Przy drzewie połączonym z badaniem
ustawienie **Moje transkrypcje źródeł** określa, jak traktuje ją badanie
([R3.5.1](R3-verification-and-citation.md#R3.5.1)). Edytor pokazuje zależnie od tego jedno z trzech:

- pole wyboru **Transkrypcja zweryfikowana**: przy ustawieniu **Wskazówka** zawsze; przy **Udokumentowane** tylko
  przy źródle wysłanym przed przełączeniem i od tego czasu niezmienionym albo przy źródle, które już jest zaznaczone;
- wiersz „Obowiązuje jako pierwszy odczyt (ustawienie drzewa „Udokumentowane”)”: przy **Udokumentowane** i nowym lub
  zmienionym źródle;
- nic: drzewo bez badania, źródło bez transkrypcji albo transkrypcja, którą badanie odczytało samo.
- Przy transkrypcji, którą odczytało badanie, edytor ostrzega: poprawka zapisze się jako odczyt użytkownika, a badanie
  porówna ją ze skanem. W podglądzie źródła pod transkrypcją jest „Transkrypcję odczytał użytkownik / odczytało
  badanie / odczytali użytkownik i badanie”.
- **Granice:** zaznaczenie nie zmienia stopnia pewności w aplikacji, rozstrzyga badanie. Gdy pola wyboru nie widać,
  **Transkrypcja zweryfikowana** zostaje tylko wtedy, gdy transkrypcja się nie zmieniła.
- **Obsługa:** edytor źródła, **Więcej: transkrypcja, data zapisu, wiarygodność**; w **Akcje → Źródła** filtr
  **Transkrypcja niezweryfikowana** (tylko przy drzewie **Udokumentowane** ze starszymi niezweryfikowanymi źródłami).
- **Obowiązuje od:** aplikacja 3.9.0
- **Od aplikacji 3.24.0:** tłumaczenie transkrypcji, które wysłało badanie ([R3.4](R3-verification-and-citation.md#R3.4)),
  jest pod transkrypcją jako zwinięta sekcja **Tłumaczenie transkrypcji**: w podglądzie źródła i na karcie źródła na
  stronie osoby. Notatka źródła się przez to nie zmienia; edytor notatki pokazuje ją całą. Źródło bez tłumaczenia
  wygląda jak wcześniej.

<!-- zdroj: app:src/research-sync.ts:357 researchReadSource, :365 isOlderSource, :377 verifiedOffer, :385 unverifiedOlderSources · src/ui/sources.ts:618 renderSourceReading, :658 sourceVerifiedValue, :296 renderSourcesFilter, :377 renderSourceViewer · strings.ts sources.verified/verifiedHintGuide/verifiedHintOlder/verifiedByTree/readBy/userReadingNote/filterUnverified · překlad (od 3.24.0): src/source-translation.ts SOURCE_TRANSLATION_LABELS, splitSourceTranslation · strings.ts viewerTranslation, translation · commit c2942b0 -->

<a id="A3.2"></a>
## A3.2 Cytat: co źródło dokumentuje

Cytat mówi, którą daną źródło dokumentuje. Cytuje się do osoby, do jej urodzenia i zgonu, do pojedynczego zdarzenia
osoby, do ślubu i do wspólnego zdarzenia pary. Z cytatów aplikacja liczy poziom udokumentowania osoby
([R3.8.1](R3-verification-and-citation.md#R3.8.1)).

- W edycji osoby: sekcja **Źródła** (cytaty do osoby), **+ źródło** pod polem urodzenia i zgonu, cytaty przy każdym
  zdarzeniu; przy związku **Cytuj źródło (księga ślubów…)**. Cytat to etykieta z tytułem źródła; kliknięcie otwiera
  podgląd źródła, × usuwa cytat (**Usuń cytowanie**), źródło zostaje.
- Poza edycją osoby (menu osoby **Źródła**, wyróżnienie [A3.7](#A3.7)) w wyborze źródła pokazuje się **Dokumentuje**:
  **Osobę** / **Urodzenie** / **Zgon**. Zgon tylko przy osobie ze zgonem. Gdy urodzenie nie ma jeszcze źródła, wybór
  zaczyna się na **Urodzenie**.
- **Granice:** cytat nie ma stopnia pewności. Źródło dołączone tylko do osoby dokumentuje osobę, nie urodzenie.
  Drzewo tylko do odczytu, drzewo zablokowane i osoba zablokowana nie pozwalają cytować. Przy osobie sekcje źródeł
  i załączników są widoczne, gdy włączone jest **Pola zaawansowane** albo gdy coś jest już wypełnione.
- **Obsługa:** zob. wyżej; wybór źródła opisuje [A3.2.1](#A3.2.1).
- **Obowiązuje od:** aplikacja 1.4.0; **Dokumentuje** i **+ źródło** 3.5.0

<!-- zdroj: app:src/ui/sources.ts:1220 renderSourceChips, :1288-1306 unciteBirthSource…unciteEventSource, :1331 showSourcePickerForPersonId, :1343 showSourcePickerForFact, :1356 renderSourcePickerFact, :1399 showSourcePickerForPartnership · src/ui/person-sources-ui.ts:114 canCiteOnPerson · src/settings.ts:320 · strings.ts sources.sectionTitle/citeAdd/citePartnership/remove/pickerFactLabel/pickerFactPerson, advanced.settingHint -->

<a id="A3.2.1"></a>
### A3.2.1 Wybór źródła

- **Cytuj źródło** otwiera wybór. Szuka się w tytule, archiwum, sygnaturze i transkrypcji. Źródeł już cytowanych przy
  tej samej danej się nie proponuje.
- **Ostatnio używane**: do 5 źródeł, osobno dla każdego drzewa w tej przeglądarce. Pokazują się tylko wtedy, gdy
  drzewo ma więcej niż 8 źródeł, a wyszukiwanie jest puste.
- **Nowe źródło…** wypełnia tytuł według tego, co się cytuje: „Urodzenie – Marie Vlková, 1865”, „Ślub – Josef Horák
  i Marie Vlková, 1890”. Roku brak, gdy nie jest znany. Nowe źródło zostaje od razu zacytowane.
- **Inna strona** przy źródle w wyborze: nowe źródło z tym samym tytułem, archiwum, odnośnikiem, wiarygodnością
  i notatką; z sygnatury znika strona, z notatki wiersze ze stroną i z datą zapisu. Gdy tytuł księgi wymienia osobę
  z drzewa, proponuje się tytuł według cytowanej danej.
- **Kolejny zapis z tej samej księgi** (podgląd i edytor źródła): nowe źródło z tym samym archiwum i odnośnikiem;
  sygnatura bez numeru i daty zapisu, czyli księga, skan i strona („ks. 12, skan 5, s. 3, wpis 2 (3.04.1801)” →
  „ks. 12, skan 5, s. 3”). Sygnatura, w której aplikacja nie rozpozna części z zapisem, zostaje cała i zaznaczona do
  sprawdzenia. Otwarte z etykiety cytatu zostaje od razu tam zacytowane.
- **Obowiązuje od:** aplikacja 3.1.0 (**Ostatnio używane**, **Kolejny zapis z tej samej księgi**); **Inna strona**
  3.9.0; 3.25.0: **Kolejny zapis z tej samej księgi** bez numeru i daty zapisu

<!-- zdroj: app:src/ui/sources.ts:1427 renderSourcePickerList, :322 sourceMatches, :1475 currentCitationSourceIds, :1505 noteRecentSource, :1526 otherPageFromPicker, :1554 createSourceFromPicker, :1569 suggestedSourceTitle, :1181 startSameBookEntry · src/settings.ts:12 RECENT_SOURCES_MAX · strings.ts sources.pickTitle/searchPlaceholder/recent/all/createNew/newTitleMarriage/otherPage/otherPageTitle/sameBook · 3.25.0: app:7327b758 src/source-page.ts sameBookReference (ENTRY_PART, DATE_PART, whole), src/ui/sources.ts:1217 (nepoznaný tvar označený) · CHANGELOG.cs.md 3.25.0 · dirigent:test/vysledek-1107-nejista-mista.md -->

<a id="A3.3"></a>
## A3.3 Wycinek zapisu

Wycinek zapisu to obraz dokładnie tego zapisu, nie całej strony. Pokazuje się przy źródle, w podglądzie i w księdze.

- Trzy drogi: **Wklej ze schowka** (Ctrl+V, na Macu ⌘V; wycinek bierze się taki, jaki jest), **Wgraj obraz**
  (otwiera kadrowanie **Wycinanie wpisu**) i **Wytnij z załącznika** (obrazowe załączniki osoby, przy ślubie obojga
  partnerów). Obraz można też przeciągnąć na puste pole.
- Wycinek zapisuje się jako JPEG z dłuższym bokiem najwyżej 1200 px. **Podpis (opcjonalnie)** zostaje także po
  **Zastąp**.
- **Zapisz też całą stronę jako załącznik osoby** w kadrowaniu: cała strona zostaje dodana do osoby jako załącznik
  ([A3.4](#A3.4)). **Przytnij** można wtedy ponownie z całej strony.
- Podgląd źródła: wycinki (kliknięcie powiększa), **Otwórz stronę w archiwum ↗** (odnośnik wycinka, w przeciwnym razie
  URL źródła), **Transkrypcja**, **Dokumentuje** (lista cytatów); bez wycinka **Dodaj wycinek**. Przy wycinku, który
  zrobiło badanie, jest **Pełna jakość**: otwiera wycinek z oryginalnego skanu w badaniu.
- **Granice:** w aplikacji można dodać najwyżej dwa wycinki (zapis i ciąg dalszy z następnej strony). Badanie zapisuje
  ich do trzech ([R3.4](R3-verification-and-citation.md#R3.4)); trzeci aplikacja zachowa, kolejnego nie doda. Całą
  stronę można zapisać tylko przy osobie, nie przy ślubie i nie przy zablokowanej osobie. Obrót w kadrowaniu zrywa
  powiązanie wycinka z załącznikiem. Obrazy, których badanie nie wysłało do aplikacji, są w filtrze **Obraz tylko w badaniu
  · N** ([A3.8](#A3.8)).
- **Obsługa:** edytor źródła, blok **Wycinek zapisu**; **+ Dodaj ciąg dalszy z następnej strony**; **Przytnij**,
  **Zastąp**, **Usuń wycinek**. „Wycinki: …” w **Akcje → Źródła** pokazuje rozmiar wszystkich wycinków od 1 MB.
- **Obowiązuje od:** aplikacja 3.1.0; **Pełna jakość** 3.4.0; obrazy z badania 3.14.0 ([A3.8](#A3.8))

<!-- zdroj: app:src/types.ts:257 MAX_EXCERPTS_UI · src/excerpts.ts:12-14 EXCERPT_MAX_SIDE, EXCERPT_QUALITY · src/ui/sources.ts:853 renderExcerptBlock, :932 excerptAdderHtml, :999 addExcerptFromPaste, :1017 addExcerptFromUpload, :1047 recropExcerpt, :1099 addExcerptFromAttachment, :1121 putExcerptDraft, :1158 keepPagePersonId, :1165 excerptContextPages, :377 renderSourceViewer · src/ui/research-ui.ts:2263 excerptResearchUrl · strings.ts sources.excerpt*/viewer*/addExcerpt/excerptsTotal, crop.title/keepPage, research.fullQuality/fullQualityTitle, researchImages.filter -->

<a id="A3.4"></a>
## A3.4 Załączniki

Załącznik to plik przy osobie: skan strony, dokument, zdjęcie aktu. Załącznik sam niczego nie dokumentuje; dowodem
jest cytat źródła ([A3.2](#A3.2)). Z obrazowego załącznika można wyciąć wycinek zapisu ([A3.3](#A3.3)).

- JPG i PNG zmniejsza się do JPEG z dłuższym bokiem najwyżej 1600 px. PDF zostaje bez zmian, do 2 MB. Inne typy
  aplikacja odrzuca („Nieobsługiwany typ pliku. Obsługiwane są JPG, PNG i PDF.”).
- Przy załączniku można napisać **Notatka (opcjonalnie)**. PDF otwiera się w nowej karcie.
- Pod załącznikami jest suma: „Przy tej osobie: zdjęcie …, n załączników …, n wycinków ze źródeł …”.
- **Granice:** przy drzewie połączonym z badaniem, które przyjmuje oryginały, można dodać także TIFF, HEIC i PDF
  powyżej 2 MB. W drzewie jest wtedy tylko wpis bez podglądu („podgląd utworzy badanie”), a plik dostaje tylko
  badanie. Gdy badanie nie działa, aplikacja takiego pliku nie przyjmie. Media powyżej 10 MB spowalniają zapisywanie;
  **Przegląd drzewa** o tym ostrzega.
- **Obsługa:** edycja osoby, sekcja **Załączniki** → **Dodaj załącznik**; sekcja jest widoczna z **Pola
  zaawansowane** albo gdy osoba ma załączniki.
- **Obowiązuje od:** aplikacja 1.4.0; TIFF, HEIC i duże PDF dla badania 3.9.0

<!-- zdroj: app:src/attachments.ts:12-18 ATTACHMENT_MAX_SIDE, ATTACHMENT_QUALITY, MAX_PDF_BYTES, ATTACHMENT_WARN_BYTES · src/ui/attachments-ui.ts:28-31 ORIGINAL_ONLY_TYPES/needsOriginalOnly, :161 accept, :211 addAttachmentFile · strings.ts attachments.*, media.originalOnlyMeta/originalOnlyNeedsResearch, treeOverview.mediaWarning -->

<a id="A3.4.1"></a>
### A3.4.1 Oryginały dla badania

Przy drzewie połączonym z badaniem aplikacja przy każdym obrazie i PDF zapamiętuje odcisk oryginału, zanim plik
zmniejszy. Oryginał w pełnej jakości wysyła do badania; w drzewie zostaje podgląd. Badanie zapisuje go przy osobie,
ewentualnie przy źródle i miejscu wycinka.

- Stan przy załączniku: „Oryginał czeka na wysłanie do badania”, „Oryginał jest w badaniu”, „tylko podgląd”
  z powodem, „Oryginału nie ma już w badaniu”.
- Gdy badanie nie działa, oryginały czekają w tej przeglądarce, najwyżej 2 GB i najwyżej 30 % miejsca przeglądarki.
  Nie ma ich w drzewie, w kopiach zapasowych ani w eksporcie. Aplikacja ostrzega, gdy czekają 3 dni albo gdy miejsce
  jest prawie pełne.
- **Pełna jakość** przy załączniku otwiera oryginał bezpośrednio w aplikacji, gdy badanie działa, a plik to JPEG,
  PNG, WebP lub PDF do 50 MB; w przeciwnym razie w badaniu.
- Usunięcie załącznika z czekającym oryginałem: oryginał można odrzucić albo wysłać; badanie odłączy go wtedy
  z notatką „usunięto w aplikacji”.
- **Granice:** tylko na komputerze i tylko przy badaniu, które przyjmuje oryginały. Zaszyfrowane drzewo nie zostawia
  oryginału czekającego w przeglądarce: wysyła go od razu działającemu badaniu, w przeciwnym razie zostaje tylko
  podgląd. Safari oryginałów nie wysyła.
- **Obsługa:** **Badanie dla drzewa → Wysyłanie oryginałów plików** (po wyłączeniu tylko podglądy); **Ustawienia →
  Dane i prywatność → Oryginały oczekujące na badanie** (tylko gdy coś czeka; odrzucić pojedynczo i wszystkie).
  Wysyłanie szczegółowiej w [S2](S2-edits-from-the-app.md).
- **Obowiązuje od:** aplikacja 3.9.0

<!-- zdroj: app:src/originals.ts:19-21 ORIGINALS_MAX_BYTES, ORIGINALS_QUOTA_SHARE, :60 originalsBudget · src/ui/originals-ui.ts:68 FULL_QUALITY_MAX_BYTES, :231 researchOriginalsLink, :241 prepareOriginal, :261 queueOriginal, :320 researchMediaAccepts, :358 fullQualityMode, :479 originalsQueueWarn · src/ui/research-tree-settings-ui.ts:232, :386 sendMedia · strings.ts media.*, mediaQueue.*, researchTree.originals/originalsDesc, research.fullQualityAppTitle -->

<a id="A3.5"></a>
## A3.5 Materiały

Materiał to plik wysłany do badania przy osobie lub przy źródle: list, zdjęcie, kopia z archiwum. Do drzewa nic się
nie dodaje. Badanie zapisuje pliki i tworzy z nich zadanie dla agenta.

- **Wyślij materiał…** (przy osobie) i **Wyślij materiał do źródła…** (podgląd i edytor źródła): najwyżej 20 plików
  naraz i **Notatka dla badania**. Cały folder wysyła **Dodaj materiały…** w menu badania
  ([S4](S4-research-from-the-app.md)).
- **Również jako załącznik w drzewie** (tylko przy osobie): w drzewie powstaje też podgląd jak przy załączniku.
- Gdy badanie nie działa, pliki czekają w przeglądarce. Gdy badanie jeszcze nie zna osoby, zostaną wysłane po
  kolejnym wysłaniu drzewa.
- Sekcja **Materiały** w edycji osoby, **Materiały** w menu osoby i okno **Wszystkie materiały ›** pokazują załączniki
  drzewa i pliki badania razem. Ten sam plik pokazuje się raz.
- **Granice:** tylko na komputerze, przy drzewie połączonym z badaniem, które przyjmuje oryginały. Badanie nigdy nie
  przyjmie programów, kluczy, archiwów ani plików drzewa genealogicznego (GEDCOM). Przypisanie i ukrycie materiału
  działa tylko z uruchomionym badaniem. Przy Archiwum Strom materiał zapisuje się w archiwum; **Również w drzewie**
  dodaje obrazy i PDF do 2 MB także do drzewa.
- **Obsługa:** zob. wyżej.
- **Obowiązuje od:** aplikacja 3.9.0; sekcja i okno **Materiały** 3.16.0

<!-- zdroj: app:src/ui/material-ui.ts:30-33 MATERIAL_MAX_FILES, MATERIAL_NOTE_MAX, REFUSED_EXT, :38 materialAccepted, :51 alsoTreeEligible, :71 materialAvailable · src/materials.ts:477 personMaterials, :519-529 gates · src/ui/originals-ui.ts:269 · src/ui/research-actions-ui.ts:357 batch · strings.ts material.*, materials.*, batch.menu -->

<a id="A3.6"></a>
## A3.6 Źródła osoby

Menu osoby **Źródła** pokazuje wszystkie źródła osoby w jednym miejscu, bez otwierania edycji: cytowane do osoby,
do urodzenia i zgonu, do zdarzeń, do ślubów i do wspólnych zdarzeń par.

- Jeden wiersz na źródło, pod nim to, co dokumentuje: „Osoba”, „Urodzenie 1865”, „Ślub 1890”… Wiersz pokazuje też
  wiarygodność.
- Kolejność: według najstarszego roku tego, co źródło dokumentuje, w przeciwnym razie według **Data zapisu**; bez
  daty na końcu, potem według tytułu.
- **Cytuj źródło** otwiera wybór z **Dokumentuje** ([A3.2](#A3.2)).
- **Znajdź źródło w badaniu**: tylko przy osobie bez źródła, którą badanie zna, i tylko przy badaniu z agentem.
  Otwiera terminal badania z przeglądem osoby.
- **Granice:** przy drzewie tylko do odczytu lub zablokowanym pozycja jest w menu tylko wtedy, gdy osoba ma jakieś
  źródło. Liczba źródeł jest przy pozycji menu.
- **Obsługa:** menu osoby (kliknięcie karty) → **Źródła**.
- **Od aplikacji 3.22.0:** źródła opowieści są przy samej opowieści. Pod tekstem opowieści jest jedna zwinięta sekcja
  **Na czym opiera się tekst (N)**, gdzie N to liczba źródeł:
  - **Źródła**: każde źródło raz. Najpierw źródła, na które wskazuje sama opowieść, potem źródła, które cytują jej
    dane. Źródło z adresem internetowym to odnośnik, który otwiera się w nowym oknie;
  - **Fakty**: dane, na których opiera się tekst, w czytelnej postaci („Zgon 25.9.1857, Lhota”), bez kodów badania;
  - **Notatka autora**, gdy opowieść ją ma.
- Sekcja jest w oknie **Opowieść**, na stronie osoby, w porównaniu wersji opowieści i (tylko do odczytu) w edycji
  osoby. Kod źródła w tekście (`[S0164]`) pokazuje się jako nazwa źródła w nawiasie, gdy strom ją ma. Strona osoby
  wymienia źródło opowieści także wśród swoich źródeł, z **Opowieść** lub **Opowieść o małżeństwie** jako tym, co
  dokumentuje. Menu **Źródła** źródeł opowieści nie wymienia.
- **Granice:** w druku i w księdze rodu pod tekstem nic nie ma; źródła opowieści są w księdze ponumerowane w liście
  źródeł. Jak badanie zachowuje źródła opowieści: [R3.9](R3-verification-and-citation.md#R3.9).
- **Obowiązuje od:** aplikacja 3.3.0; **Znajdź źródło w badaniu** 3.19.0; **Na czym opiera się tekst** 3.22.0

<!-- zdroj: app:src/person-sources.ts:54 personSourceRows · src/ui/person-sources-ui.ts:114 canCiteOnPerson, :120 showPersonSourcesDialog, :187 find hidden · src/ui/context-menu.ts:191-203 readItems · src/ui/research-actions-ui.ts:1173 personFindSourceUrl · strings.ts personSources.*, research.findSource · src/story-sources.ts storyBasisSourceIds, storyFactText, storyBasisDetailsHtml · src/ui/person-page.ts:1738 storyBasisHtml · strings.ts storyBasis, basisSources, basisFacts, authorNote · CHANGELOG.cs.md 3.22.0 -->

<a id="A3.7"></a>
## A3.7 Gdzie brakuje dowodów

**Przegląd drzewa → Jakość danych → Gdzie brakuje dowodów** wypisuje grupy osób, którym brakuje źródła lub rodziców.
Przycisk **Pokaż w drzewie** wyróżnia je w drzewie i prowadzi przez nie jedną po drugiej. Grupa bez nikogo się nie
wypisuje.

- **Osoby bez źródła**: w całym drzewie („n z N”).
- **Urodzenia bez źródła**: przodkowie wybranej osoby („n z N przodków”). Przy drzewie z badaniem zamiast tego
  **Urodzenia niesprawdzone w badaniu**: urodzenia przodków, które nie są Udokumentowane.
- **Końce linii**: osoby bez rodziców, które są przodkami wybranej osoby albo mają dzieci i nie weszły do rodziny
  przez małżeństwo.
- Gdy niczego nie brakuje: „Wszyscy mają źródło i rodziców.” Wiersz **Udokumentowanie w drzewie (● ◐ ○ na kartach)**
  przełącza karty na znaczniki poziomu udokumentowania ([R3.8.1](R3-verification-and-citation.md#R3.8.1)).
- Przy wyróżnieniu: **Następna osoba ›**, **Cytuj** (przy grupach bez źródła) i × **Zakończ wyróżnianie**. Kolejność
  jest według pokolenia, potem według imienia. Na końcu: „Gotowe, w tym wyborze nie został już nikt.”
- **Granice:** przy urodzeniu, które ocenia badanie, zamiast **Cytuj** jest przycisk **Źródła**. Kolejny cytat danej
  nie udokumentuje; rozstrzyga badanie. **Cytuj** brakuje przy drzewie tylko do odczytu i przy zablokowanej osobie.
  Kontrolę drzewa jako całości opisuje [A5](A5-tree-check.md).
- **Obsługa:** **Przegląd drzewa → Jakość danych → Gdzie brakuje dowodów → Pokaż w drzewie** (z innego drzewa
  **Otwórz drzewo i pokaż**).
- **Obowiązuje od:** aplikacja 3.4.0; **Urodzenia niesprawdzone w badaniu** i **Źródła** zamiast **Cytuj** 3.13.1

<!-- zdroj: app:src/stats.ts:185-240 computeEvidenceGaps · src/ui/evidence-ui.ts:81 walkOrder, :325-358 pill · src/tree-overview.ts:215 birthResearchStatus · src/ui/tree-overview.ts:1946-1975 · strings.ts treeOverview.evidenceTitle/evNoSource/evBirthNoSource/evBirthUnproven/evLineEnds/evOfTotal/evOfAncestors/evAllGood/evLevels, treeHealth.citeAction/sourcesAction/next/highlightDone/highlightEnd -->

<a id="A3.8"></a>
## A3.8 Obraz tylko w badaniu

Obraz tylko w badaniu to skan albo wycinek źródła, który jest zapisany w badaniu na komputerze, a którego aplikacja
jeszcze nie ma. Źródło jest w aplikacji także bez niego; obraz pokaże się po wczytaniu z badania, które działa na tym
komputerze.

- **Dlaczego obrazu nie ma w aplikacji:** przy źródle stoi powód: „Obraz jest w badaniu, ale nie trafił do aplikacji
  (ustawienia badania).”, „… (limit rozmiaru).” albo „Obraz jest przygotowywany w badaniu i przyjdzie z następną
  wersją.” Badanie dodaje obrazy do pliku dla aplikacji według swoich ustawień i limitu rozmiaru.
- **Gdzie go widać:** w **Źródła** filtr **Obraz tylko w badaniu · N** z etykietą *obraz tylko w badaniu* przy źródle
  i wierszem pod filtrem („N obrazów z M źródeł jest zapisanych tylko w badaniu na tym komputerze, w aplikacji pokaże
  się po wczytaniu.”); w menu **Badanie** wiersz **Obrazy tylko w badaniu · N**, który otwiera **Źródła** z filtrem
  i pokazuje postęp wczytywania.
- **Wczytanie:**
  - **Wczytaj obraz z badania** przy źródle wczytuje jego obrazy;
  - **Wczytaj wszystkie z badania…** najpierw pokazuje liczbę źródeł i obrazów, rozmiar („Zostaną zapisane przy
    drzewie w tej przeglądarce.”), ile obrazów badanie dopiero przygotuje, i wolne miejsce w przeglądarce. Potem postęp
    z **Wstrzymaj** i **Zatrzymaj**; okno można zamknąć, a wczytywanie trwa dalej. Niewczytane zostają w filtrze;
  - wczytane obrazy zostają przy drzewie w tej przeglądarce, oddzielnie od danych drzewa.
- **Granice:**
  - wczytać można tylko z badania, które działa na tym komputerze („Zostanie wczytany, gdy badanie będzie działać na
    tym komputerze.”). Na telefonie albo innym urządzeniu: „Obraz jest w badaniu na komputerze. Na tym urządzeniu
    pojawi się, gdy drzewo zostanie przeniesione razem z obrazami z badania.”;
  - **Usuń z aplikacji** usuwa obrazy z przeglądarki z powrotem; zostają w badaniu i można je wczytać ponownie.
    Obrazy, które przyszły w pliku badania, zostają;
  - **Wczytywanie obrazu źródła przy otwarciu** wczytuje tylko otwarte źródło i tylko wtedy, gdy badanie działa na tym
    komputerze; lista źródeł sama niczego nie wczytuje;
  - eksport oferuje **Obrazy źródeł**: **Bez obrazów źródeł**, **Tylko te w aplikacji** albo **Wszystkie z badania**
    (wczytają się przed eksportem, tylko gdy badanie działa na tym komputerze).
- **Obsługa:** aplikacja: **Źródła** → filtr **Obraz tylko w badaniu** → **Wczytaj wszystkie z badania…**; przy źródle
  **Wczytaj obraz z badania**, **Więcej opcji → Usuń z aplikacji**; **Ustawienia → Obrazy źródeł** (**Wczytywanie
  obrazu źródła przy otwarciu**, **Usuń z aplikacji…**, **Wczytaj wszystkie…**); **Badanie → Obrazy tylko w badaniu ·
  N**.
- **Obowiązuje od:** aplikacja 3.14.0 z badaniem 1.18.0
- **Od aplikacji 3.25.0:** filtr i etykieta nazywają się **Obraz tylko w badaniu** (wcześniej **Obraz w badaniu**),
  wiersz pod filtrem mówi, gdzie obrazy są, a **?** otwiera tę regułę.

<!-- zdroj: app:src/strings.ts researchImages.* (held.scope/limit/later, heldTag, filter, bulkLine, bulkLoad, bulkSummary, bulkReady, bulkSpace, bulkCanClose, bulkLeft, menuRow, removeFromApp(Note), heldBridgeOff, heldDevice, settings.section/auto/autoDesc/remove/loadAll/removeKeep, export.legend/none/app/all/allOff) · src/help/topics.ts imagesHeld · CHANGELOG.cs.md 3.14.0, 3.25.0 · commit 68b31a48 -->
