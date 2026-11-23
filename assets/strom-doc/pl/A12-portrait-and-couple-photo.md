<a id="A12"></a>
# A12 Portret i zdjęcie pary

Portret osoby to kwadrat wykadrowany ze zdjęcia. Kadr wybiera się w edytorze nad całym zdjęciem i można go
w dowolnej chwili zmienić, bo całe zdjęcie zostaje przy osobie jako załącznik. Para może mieć własne **zdjęcie pary**
(ślubne lub wspólne), a z niego portrety obojga partnerów. Rozdział opisuje aplikację Strom 3.30.0; zmiany
z nowszej wersji mają przy sobie jej numer.

<!-- zdroj: dirigent:spec/107-vyrez-portretu (K1.1–K2.3) · app:59b9dde9..6a00396f (dirigent:prace/1116-app-107-vyrez) · app:docs/ZADANI_DEV_vyrez-portretu.md §1–§10, rozhodnutí D1–D12 · app:src/photo.ts, src/portrait-editor-model.ts, src/ui/portrait-editor.ts · app:CHANGELOG.cs.md 3.30.0 -->

<a id="A12.1"></a>
## A12.1 Edytor kadrowania portretu

Zdjęcie wybrane w edycji osoby otwiera się w edytorze **Kadrowanie portretu**. Ramka w kształcie zdjęcia na karcie
stoi w miejscu, a zdjęcie pod nią się przesuwa, powiększa i obraca.

- **W edytorze:**
  - **przesuwanie** przeciąganiem zdjęcia; przesuwanie zatrzymuje się, zanim w ramce zostałoby puste miejsce;
  - **Powiększenie** od 100 % (ramka pokrywa krótszy bok zdjęcia) najwyżej do 800 %; kadr ma zawsze co najmniej
    128 px oryginalnego zdjęcia, więc małe zdjęcie powiększa się mniej (najwyżej do dwukrotności rzeczywistej
    rozdzielczości); **Domyślne** przywraca kadr początkowy: największy kwadrat ze środka;
  - **Obrót** o 90° w lewo i w prawo;
  - **Prostowanie** o najwyżej 45° w obie strony co 0,5°, z siatką na ramce podczas przeciągania; zdjęcie przy tym się
    powiększa, aby w ramce nie został pusty róg;
  - **Odbij lustrzanie**;
  - **Podgląd**: karta osoby z kształtem i rozmiarem zdjęcia z Ustawień ([A6.1.4](A6-views.md#A6.1.4)), kwadrat ze
    **Strona osoby** i kadr 4 : 5 ze **Strony rodzinne**. Zdanie pod podglądem: „Na karcie koło, zapisuje się cały
    kwadrat.” (przy zaokrąglonym kwadracie „Na karcie zaokrąglony kwadrat, zapisuje się cały kwadrat.”).
- **Gotowe** zwraca portret do edycji osoby; zapisuje się dopiero z jej **Zapisz**. **Anuluj** (także Escape)
  zostawia edycję osoby taką, jaka była, a plik nie zostaje użyty. Edycja osoby zamknięta bez zapisania nie zostawia
  nic, ani portretu, ani oryginału.
- Zapisany portret to kwadrat 256 × 256 px w formacie JPEG. Przezroczyste miejsca (PNG) dostają białe tło, z GIF-a
  bierze się pierwsza klatka. Koło lub zaokrąglony kwadrat to tylko kształt na karcie: zapisuje się cały kwadrat.
- Portret z nowego pliku, w którym w edytorze nic się nie zmieniło, jest bajtowo taki sam jak portret przed aplikacją
  3.30.0. Oryginał i tak się zapisuje ([A12.2](#A12.2)).
- Gdy kadr pokrywa mniej niż 256 px oryginalnego zdjęcia, edytor raz powie „Zdjęcie jest małe, portret może być
  nieostry.”
- **Granice:**
  - w drzewie tylko do odczytu (wyeksportowana strona HTML, śledzone drzewo, drzewo zapisane nowszą wersją aplikacji,
    podgląd wersji) i przy zablokowanej osobie portret się nie zmienia: **Edytuj kadr**, **Edytuj kadr portretu**,
    **Jako portret…** i **Użyj jako portretu…** nie ma albo nic nie otwierają; portret jest tylko pokazywany;
  - osoba usunięta w trakcie edycji (w innym oknie, przy wczytaniu z badania) nie dostaje nic: „Osoby nie ma już
    w drzewie, nic nie zapisano.”;
  - pliku, który nie jest obrazem albo nie da się go odczytać, edytor nie otworzy; aplikacja mówi to jak dotąd.
- **Obsługa:** edycja osoby, **Wybierz zdjęcie** przy zdjęciu. Na telefonie (do 640 px) edytor zajmuje cały ekran:
  podgląd karty, przełącznik **Powiększenie** | **Prostowanie** z jednym suwakiem, a pod nim ↺ ↻ i **Odbij
  lustrzanie**.
- **Obowiązuje od:** aplikacja 3.30.0; przyciski obrotu zdjęcia w edycji osoby są od 3.30.0 w edytorze.
- **Od aplikacji 3.31.0:** **Wybierz zdjęcie** przy osobie, która ma zdjęcia do zaoferowania, otwiera najpierw wybór
  **Portret ze zdjęcia** ([A12.2](#A12.2)); plik z komputera daje w nim **Z komputera…** (przy dotyku **Z tego
  urządzenia…**). Nowa osoba i osoba bez takich zdjęć dostają wybór pliku jak dotąd.

<!-- zdroj: app:327d9734 src/ui/portrait-editor.ts (rámeček, posun, kolečko, dva prsty, ↺ ↻, narovnání s mřížkou, Zrcadlit, náhled karty / Stránka osoby / Rodinné stránky, telefon), src/photo.ts PHOTO_SIZE 256, PORTRAIT_MIN_SOURCE_PX 128, PORTRAIT_MAX_ANGLE 45, PORTRAIT_ANGLE_STEP 0.5, minZoomForAngle, cropToJpeg (bílý podklad) · src/portrait-editor-model.ts isIdentityPortrait (Hotovo beze změny z nového souboru = compressPhoto), isSmallPortrait · app:88859da2 src/ui/person-modal.ts handlePhotoInput → editor, Zrušit/Escape nechá dialog, dialog zavřený bez Uložit nic nenechá, #photo-rotate-left/right odstraněny · app:a2af453a jen ke čtení / zamčená osoba, personGone · app:ef688950 dlouhá jména, telefon na šířku · strings.ts portrait.title, preview, personPage, familyPages, savedCircle, savedRounded, rotate, straighten, zoom, reset, mirror, small, personGone · ZADANI_DEV §1, §9, §10 · 3.31.0: app:c6fbb3ff src/ui/person-modal.ts choosePersonPhoto (#photo-choose-btn; bez currentId → #input-photo), src/ui/portrait-picker-ui.ts openPortraitPicker (prázdný model → portraitPickFile), portraitPickerHtml (fromComputer / fromDevice) · strings.ts labels.photoChoose, portrait.pickTitle, fromComputer, fromDevice · dirigent:prace/1122-app-portret-dev · app:docs/ZADANI_DEV_portret-z-materialu.md §1.2, §1.3 -->

<a id="A12.1.1"></a>
### A12.1.1 Klawiatura, mysz i dotyk w edytorze

| Wejście | Co robi |
|---|---|
| przeciąganie zdjęcia (mysz, jeden palec) | przesuwanie |
| kółko | powiększenie wokół wskaźnika (× 1,15 na krok) |
| dwa palce | powiększenie wokół środka palców; obracania dwoma palcami nie ma |
| dwuklik lub podwójne stuknięcie w zdjęcie, klawisz `0`, **Domyślne** | kadr początkowy kroku |
| dwuklik na suwaku **Prostowanie** | 0° |
| ← → ↑ ↓ (fokus na ramce) | przesunięcie o 1 % boku kadru, z Shift o 10 % |
| `+` `=` `−` | powiększenie i pomniejszenie o 10 % |
| `[` `]` | obrót o 90° w lewo i w prawo |
| suwak **Prostowanie** ← → | ± 0,5°, z Shift ± 5°, Home i End ± 45° |
| Enter | **Gotowe**; w pierwszym z dwóch kroków **Dalej** ([A12.5](#A12.5)) |
| Escape | **Anuluj**: zamyka tylko edytor, edycja osoby pod nim zostaje otwarta |

- Ramka dostaje fokus po otwarciu. Czytnik ekranu ogłasza powiększenie i prostowanie („Powiększenie 290 %”,
  „Prostowanie −2,5°”) 300 ms po ostatniej zmianie. Tab przechodzi po edytorze i go nie opuszcza.
- **Granice:** na komputerze w stopce jest podpowiedź klawiszy, na telefonie i tablecie nie. Kadr początkowy to przy
  pojedynczym portrecie środek zdjęcia, przy portrecie ze zdjęcia pary połowa partnera ([A12.5](#A12.5)).
- **Obsługa:** jak w tabeli.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:327d9734 src/ui/portrait-editor.ts ZOOM_STEP 1.1, WHEEL_STEP 1.15, šipky 1 % / Shift 10 %, [ ], Enter, Escape ve fázi capture, live hlášení po 300 ms, past fokusu · app:4cea7fbd Výchozí / 0 / dvojklik = úvodní výřez kroku · strings.ts portrait.keys, frameAria, liveZoom, liveAngle, straightenHint · ZADANI_DEV §3 -->

<a id="A12.2"></a>
## A12.2 Oryginał i etykieta Portret

Portret pamięta, z którego zdjęcia i jak został wykadrowany. Całe zdjęcie zostaje przy osobie jako załącznik
z etykietą **Portret**, dlatego kadr można w dowolnej chwili zmienić bez utraty ostrości.

- **Oryginał z nowego pliku:** po **Gotowe** i **Zapisz** osobie przybywa załącznik z całym zdjęciem (JPEG, dłuższy
  bok najwyżej 1600 px, bez obrotu i odbicia, nazwa według pliku). Liczy się do sumy załączników osoby
  ([A3.4](A3-evidence-in-the-app.md#A3.4)).
- **Etykieta Portret** jest przy załączniku, z którego jest portret, w edycji osoby, w materiałach osoby i w panelu
  podglądu (podpowiedź „Z tego zdjęcia pochodzi portret osoby.”). W edycji osoby etykieta zmienia się od razu
  z portretem, jeszcze przed **Zapisz**.
- **Portret ze zdjęcia, które osoba już ma:** **Jako portret…** w wierszu załącznika graficznego (przed koszem),
  **Użyj jako portretu…** w menu ⋯ materiałów osoby i w panelu podglądu (przed **Usuń z drzewa…**).
  Edytor otwiera się nad tym załącznikiem; nowy załącznik nie powstaje. Z edycji osoby wynik zapisuje się z
  **Zapisz**, z innych miejsc od razu: „Portret osoby {imię} zastąpiony.” z **Cofnij**. Badanie nie musi przy tym
  działać.
- **Osoba ma już portret:** edytor pokaże „Osoba ma już portret. Gotowe go zastąpi, można to cofnąć.” i podglądy
  **Obecny** → **Nowy**.
- **Usunięcie załącznika, z którego jest portret:** potwierdzenie mówi „To źródło portretu. Portret zostaje, jego
  kadr da się potem zmieniać tylko wewnątrz gotowego kwadratu.” Portret zostaje bez powiązania.
- **Usuń** przy portrecie w edycji osoby usuwa portret i jego powiązanie; załącznik zostaje bez etykiety.
- **Granice:** pozycja **Jako portret…** jest tylko przy załączniku graficznym z podglądem (nie przy PDF ani przy
  pliku, który trzyma tylko badanie, [A3.4](A3-evidence-in-the-app.md#A3.4)) i tylko przy załączniku, który nie jest
  jeszcze źródłem portretu. Przy zablokowanej osobie i w drzewie tylko do odczytu jej nie ma. Portrety dwóch osób
  z jednego zdjęcia tworzy zdjęcie pary ([A12.5](#A12.5)).
- **Obsługa:** edycja osoby, sekcja zdjęcia i **Załączniki**; strona osoby, materiały i podgląd załącznika.
- **Obowiązuje od:** aplikacja 3.30.0
- **Od aplikacji 3.31.0:**
  - **Użyj jako portretu…** jest też przy obrazie JPEG lub PNG badania, który wymienia osobę (⋯ w materiałach osoby,
    podgląd pliku). Edytor otwiera się nad kopią roboczą z badania. Plikiem drzewa przy osobie obraz staje się
    dopiero po **Gotowe** (w edycji osoby po **Zapisz**), jednym krokiem **Cofnij**. Ze zdjęcia kilku osób każda osoba
    dostaje własny kadr; plik jest w drzewie raz, przy każdej osobie jako kolejne miejsce. Gdy badanie nie działa,
    akcja przy pliku tylko w badaniu nie jest dostępna; badanie, które nie przypisuje plików osobom, jej nie oferuje.
  - **Wybór Portret ze zdjęcia** oferuje zdjęcia osoby, z których da się wykadrować portret: obrazy drzewa przy
    osobie i obrazy JPEG i PNG badania, które wymieniają osobę, najnowsze najpierw (bez daty na końcu). PDF, plik,
    który jest w badaniu tylko oryginałem, pliki ukryte i pliki drzewa genealogicznego w nim nie ma. Jest w nim też
    zdjęcie dzisiejszego portretu (nowy kadr tego samego zdjęcia), z etykietą **Portret**. Zdjęcie, które wymienia
    też inne osoby, ma pod nazwą „i jeszcze 2” i ich imiona w podpowiedzi („Na zdjęciu także: …”); osoby tylko
    z paczki, z którą plik przyszedł, się nie liczą. Wybór zdjęcia otwiera edytor ([A12.1](#A12.1)); z edycji osoby
    portret zapisuje się przyciskiem **Zapisz**, ze strony osoby od razu z **Cofnij**. Ostatni wiersz to **Z
    komputera…** (przy dotyku **Z tego urządzenia…**).
  - **Wygląd wyboru:** na komputerze z myszą w oknie szerszym niż 1024 px dymek przy przycisku; przy dotyku i w oknie
    do 1024 px panel od dołu z imieniem osoby, na telefonie trzymanym poziomo panel po prawej. Zamyka go Escape,
    kliknięcie obok i wybór zdjęcia.
  - **Stany wyboru:** gdy badanie nie działa, brakuje zdjęć tylko w badaniu, a wybór mówi „Zdjęcia z badania (3) są
    dostępne, gdy badanie działa.”, na komputerze z **Uruchom badanie**. Ze starszym badaniem, bez badania i przy
    dotyku oferuje tylko zdjęcia drzewa, bez tego zdania. Plik drzewa, który po otwarciu drzewa jeszcze nie
    przyszedł ([S1.4.1](S1-connecting-app-and-research.md#S1.4.1)), się wczytuje i nie da się go wybrać; plik, który
    nie przyszedł, w wyborze nie jest. Wybrane zdjęcie z badania wczytuje się w wyborze („Wczytywanie zdjęcia
    z badania…”); gdy się nie wczyta, wybór zostaje otwarty z „Nie udało się wczytać zdjęcia.” i **Spróbuj ponownie**.
  - **Portret ze zdjęcia…:** osoba bez portretu, którą można zmieniać i która ma zdjęcie do zaoferowania, ma
    w nagłówku edycji osoby pod imieniem odnośnik **Portret ze zdjęcia…**. To samo otwiera kółko w nagłówku i puste
    kółko w części ze zdjęciem. Strona osoby ma odnośnik **Portret ze zdjęcia…** pod inicjałami; zapisana strona
    (**Zapisz jako HTML**), druk i drzewo tylko do odczytu go nie mają. Same zdjęcia z badania, które nie działa,
    odnośnika nie dają.

<!-- zdroj: app:59b9dde9 src/types.ts PortraitCrop, PortraitSource (attachmentId | partnershipId), Person.photoSource · app:88859da2 originál = cropToJpeg celé fotky, ATTACHMENT_MAX_SIDE 1600, ATTACHMENT_QUALITY 0.8, jen z nového souboru · app:e6f0595d src/ui/attachments-ui.ts štítek Portrét, Jako portrét… (isImage && !originalOnly && !locked, ne u zdroje), materials-ui.ts / material-viewer-ui.ts Použít jako portrét… (před Odstranit ze stromu…; app 3.30.0 material-viewer-ui.ts m.removeFromTree), danger.portraitSourceNote, unlinkPortraitFromAttachment, toast portraitReplaced s Vrátit · app:a2af453a Odebrat portrét → zdroj se smaže, příloha zůstane · D5 (bez běžícího výzkumu) · strings.ts attachments.asPortrait, portraitTag, portraitTagTitle, materials.useAsPortrait, portrait.replaceNote, current, newOne, replaced · ZADANI_DEV §4, §10 · 3.31.0: app:43d87c60 src/ui/portrait-actions-ui.ts materialPortraitOffer (vlastní obrázek stromu, nebo JPEG/PNG výzkumu se jménem osoby; bridge jen s caps.assign), useMaterialAsPortrait, linkPortraitFile; src/materials.ts isMaterialPortraitCandidate, PORTRAIT_MIMES · dirigent:prace/1121-app-portret-z-materialu · app:c6fbb3ff src/portrait-candidates.ts portraitCandidates (offer, bridge && !bridgeUp → researchOnly, waits failed vynechané, nejnovější první, isSource), photoPeopleOthers (directPersons bez dávky, místa přílohy), src/ui/portrait-picker-ui.ts (popover !isCoarsePointer && !isTabletOrMobile, jinak presentPortraitSheet; Escape, klik vedle; pickPortraitCandidate: busy, failed, Zkusit znovu = materials.retry; start jen na počítači s researchStartUrl) · app:3f6c9dfd src/ui/person-modal.ts updatePortraitOffer (#pm-portrait-link, #pm-avatar, #photo-preview is-pick), src/person-page.ts portraitPick (jen mode app, links app, ne readOnly), src/ui/person-page-ui.ts personPagePortraitPick · strings.ts portrait.pickTitle, fromComputer, fromDevice, fromPhoto, others, alsoIn, researchDown, pickLoading, pickFailed, materials.retry, sync.startResearch · dirigent:prace/1122-app-portret-dev · app:docs/ZADANI_DEV_portret-z-materialu.md §1–§4 -->

<a id="A12.3"></a>
## A12.3 Późniejsza edycja kadru

Portret z oryginałem można w dowolnej chwili wykadrować na nowo z całego zdjęcia. Portret bez oryginału można
zmieniać tylko w obrębie jego kwadratu.

- **Z oryginałem:** edytor otwiera się nad załącznikiem lub zdjęciem pary, z którego jest portret, z obecnym kadrem.
- **Bez oryginału** (portret z czasów przed aplikacją 3.30.0, z importu GEDCOM, ze scalenia bez źródła, po usunięciu
  załącznika źródłowego): edytor pracuje z gotowym kwadratem 256 px. Kadr można tylko zmniejszyć, przesunąć wewnątrz,
  obrócić, wyprostować i odbić lustrzanie. Edytor to mówi („Całe zdjęcie nie jest zapisane, kadr można tylko
  zmniejszyć.”) i oferuje **Wybierz zdjęcie ponownie…**: otwiera wybór pliku, a potem jak nowe zdjęcie
  ([A12.1](#A12.1)). Każda kolejna edycja bez oryginału zmiękcza portret; nowy wybór zdjęcia to naprawia.
- **Portret | Całe zdjęcie:** powiększenie portretu na stronie osoby ma u dołu przełącznik **Portret** | **Całe
  zdjęcie**, gdy portret ma oryginał w drzewie. Zapisana strona osoby (**Zapisz jako HTML**) ma w powiększeniu
  portretu odnośnik **Całe zdjęcie** tylko wtedy, gdy plik to zdjęcie niesie (załączniki lub zdjęcie pary w grupach
  treści, [A7.6](A7-book-pages-and-export.md#A7.6)). Portret bez oryginału i inne obrazy przełącznika nie mają.
- **Granice:** wynik z edycji osoby zapisuje się dopiero z **Zapisz**; ze strony osoby zapisuje się od razu jako jeden
  krok („Portret zaktualizowany.” z **Cofnij**), a strona się przerysowuje. W drzewie tylko do odczytu i przy
  zablokowanej osobie edycji nie ma ([A12.1](#A12.1)).
- **Obsługa:** edycja osoby, **Edytuj kadr** między **Wybierz zdjęcie** a **Usuń** (tylko ze zdjęciem); strona osoby,
  ⋯ **Więcej działań** → **Edytuj kadr portretu** (tylko przy osobie z portretem, którą można zmieniać).
- **Obowiązuje od:** aplikacja 3.30.0
- **Od aplikacji 3.31.0:** ⋯ **Więcej działań** na stronie osoby ma przed **Edytuj kadr portretu** pozycję **Zmień
  portret…**: otwiera pod ⋯ wybór **Portret ze zdjęcia** ([A12.2](#A12.2)), a nowy portret zapisuje się od razu
  z **Cofnij**. Pozycja jest tylko przy osobie z portretem, którą można zmieniać i która ma zdjęcie do zaoferowania
  (liczą się też zdjęcia z badania, które nie działa). Kliknięcie na portret dalej otwiera powiększenie.

<!-- zdroj: app:1feae064 src/ui/person-modal.ts #photo-recrop-btn (labels.photoRecrop), editor nad zdrojem s photoSource, jinak squareOnly + chooseAgain → #input-photo · src/ui/person-page-ui.ts item('crop', editCrop) jen canEdit && person.photo, Hotovo = jedna transakce, toast portraitUpdated s Vrátit · app:dab74024 src/ui/image-viewer.ts přepínač Portrét | Celá fotka (jen s existujícím zdrojem), src/person-page.ts portraitLightbox odkaz Celá fotka jen když soubor fotku nese · strings.ts labels.photoRecrop, personPage.moreActions, editCrop, portrait, wholePhoto, portrait.noOriginal, chooseAgain, updated · ZADANI_DEV §2, §10 · 3.31.0: app:3f6c9dfd src/ui/person-page-ui.ts togglePersonPageMenu item('portrait') před crop, personPageCanChangePortrait (shown + researchOnly > 0), runPersonPageMenu → openPortraitPicker pod .pp-more · strings.ts personPage.changePortrait · dirigent:prace/1122-app-portret-dev · app:docs/ZADANI_DEV_portret-z-materialu.md §1.3 -->

<a id="A12.4"></a>
## A12.4 Zdjęcie pary

Związek może mieć jedno zdjęcie pary: ślubne lub wspólne. Należy do związku, nie do jednego z partnerów.

- **Wiersz Zdjęcie** przy każdym związku w relacjach osoby:
  - bez zdjęcia **Wybierz zdjęcie** i podpowiedź „Zdjęcie ślubne lub wspólne zdjęcie pary”;
  - ze zdjęciem miniatura, **Wybierz zdjęcie** (wymienia je), **Utwórz portrety…** ([A12.5](#A12.5)), **Usuń**
    i rozmiar w kB. Kliknięcie miniatury otwiera podgląd z podpisem „{A} i {B} · zdjęcie pary” (partnerzy
    w kolejności jak na karcie), **Pobierz** i **Utwórz portrety…**.
- Zdjęcie zmniejsza się jak załącznik: JPEG z dłuższym bokiem najwyżej 1600 px.
- Zmiany zdjęcia w relacjach zapisują się z **Zapisz** panelu, a **Anuluj** je odrzuca; powiadomienie jest bez
  **Cofnij**. Poza panelem (podgląd z Tabeli, [A12.6](#A12.6)) zapisuje się od razu jako jeden krok z **Cofnij**.
- **Usuń** pyta („Usunąć zdjęcie pary?”, „Portrety z niego utworzone zostaną.”). Portrety zostają bez powiązania
  i dalej edytuje się je tylko w obrębie ich kwadratu ([A12.3](#A12.3)).
- **Usunięcie związku ze zdjęciem** najpierw pyta: „Razem z nim zniknie zdjęcie pary. Portrety z niego zostaną.”
  Związek bez zdjęcia usuwa się jak dotąd.
- **Granice:** jedno zdjęcie na związek; kolejne zdjęcia pary tylko jako załączniki osób. Gdy któryś z partnerów jest
  zablokowany albo drzewo jest tylko do odczytu, wiersz pokazuje tylko miniaturę i rozmiar.
- **Obsługa:** edycja osoby, sekcja **Relacje** → **Zarządzaj relacjami** (panel **Relacje: {imię}**), przy związku
  wiersz **Zdjęcie**; w tabeli związków **Edytuj…** przy wierszu ([A6.7.8](A6-views.md#A6.7.8)). Na telefonie panel
  zajmuje cały ekran, a przyciski wiersza się zawijają.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:59b9dde9 src/types.ts Partnership.photo, photoOriginalName, photoDate (verze dat 23), unlinkPortraitsFromUnion · app:9a47896e src/ui/relationships-panel.ts partnershipPhotoRowHtml (Vybrat fotku, unionPhotoHint, náhled → prohlížeč s popiskem, Udělat portréty…, Odebrat s danger.unionPhotoPortraitsStay, kB, zamčený partner jen náhled a velikost), Uložit / Zrušit panelu (D7) · src/attachments.ts ATTACHMENT_MAX_SIDE 1600 · app:68c232ad potvrzení smazání svazku s fotkou deleteUnionPhotoNote (D1) · strings.ts relationships.unionPhoto, unionPhotoHint, makePortraits, unionPhotoCaption, danger.removeUnionPhotoTitle, removeUnionPhoto, unionPhotoPortraitsStay, deleteUnionTitle, deleteUnionPhotoNote, buttons.manageRelationships (index.html #link-relationships), relationships.title · ZADANI_DEV §6, D1, D7, D9 -->

<a id="A12.5"></a>
## A12.5 Portrety ze zdjęcia pary

**Utwórz portrety…** kadruje ze zdjęcia pary portret każdego z partnerów w jednym edytorze, krok po kroku.

- Edytor **Portrety ze zdjęcia pary** ma krok dla każdego partnera w kolejności jak na karcie. Kadr początkowy to
  największy kwadrat w lewej lub prawej połowie zdjęcia; przy zdjęciu pionowym w górnej i dolnej połowie. Ramka
  drugiego partnera jest widoczna jako przerywana z imieniem.
- Kroki można przełączać w nagłówku; ustawienia kroku są zachowywane. Stopka: **Anuluj** · **Pomiń** · **Dalej**,
  w ostatnim kroku **Gotowe**. Pominięty krok portretu nie zmienia.
- **Partner, który ma portret:** „{imię} ma już portret” i wybór **Zachowaj obecny portret** (domyślnie; „Krok
  zostanie pominięty.”) albo **Zastąp nowym kadrem** („Obecny portret można przywrócić.”).
- **Związek z jednym znanym partnerem** ma jeden krok: „Drugi partner jest nieznany, portret powstanie tylko dla jednej
  osoby.”
- **Gotowe** zapisuje wszystkie nowe portrety naraz, każdy z powiązaniem ze zdjęciem pary; do załączników kopia
  zdjęcia nie trafia. Powiadomienie: „Zapisano 2 portrety ze zdjęcia pary.” (z pominiętymi „…, 1 pominięto.”).
  **Cofnij** cofa oba portrety jednym krokiem; w relacjach obowiązują **Zapisz** i **Anuluj** panelu
  ([A12.4](#A12.4)).
- Portret ze zdjęcia pary edytuje się później nad zdjęciem pary ([A12.3](#A12.3)).
- **Granice:** zablokowany partner kroku nie dostaje; w drzewie tylko do odczytu **Utwórz portrety…** nie ma.
- **Obsługa:** **Utwórz portrety…** w wierszu **Zdjęcie** w relacjach i w podglądzie zdjęcia pary (także z Tabeli,
  [A12.6](#A12.6)). Klawisze jak w [A12.1.1](#A12.1.1).
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:9a47896e src/ui/portrait-editor.ts dva kroky (pořadí partnerů jako na kartě, levá / pravá polovina, u fotky na výšku horní / dolní), Přeskočit, Ponechat / Nahradit, Hotovo = jedna transakce, photoSource.partnershipId bez kopie do příloh, toast fromUnion s Vrátit · app:4cea7fbd Výchozí = polovina partnera · app:327d9734 čárkovaný rámeček druhého partnera · D9 zamčený partner · strings.ts portrait.twoTitle, next, skip, skipped, done, hasPortrait, keep, keepSub, replace, replaceSub, keepStage, single, fromUnion · ZADANI_DEV §7 -->

<a id="A12.6"></a>
## A12.6 Gdzie widać portret i zdjęcie pary

Kadr obowiązuje wszędzie, gdzie pokazuje się zdjęcie osoby. Zdjęcie pary jest tylko tam, gdzie mowa o parze:
w relacjach, w tabeli związków, na stronach osób i w księdze rodu.

| Miejsce | Portret (kadr) | Zdjęcie pary |
|---|---|---|
| karta w drzewie, podgląd po najechaniu, edycja osoby | tak | nie |
| strona osoby (w aplikacji i zapisana) | tak | pierwsze w galerii **Obrazy i dokumenty** obojga partnerów, podpis „{A} i {B} · zdjęcie pary”, liczy się do obrazów |
| strony rodzinne (strony rodu i drzewa) | tak, przycięty do 4 : 5 | jak na stronie osoby |
| Księga rodu | tak | w rozdziale rodziny nad wydarzeniami pary |
| plakat, eksport obrazu, druk drzewa, przelot przez drzewo | tak | nie |
| Tabela › Związki | – | kolumna **Zdjęcie** |
| relacje osoby | – | wiersz **Zdjęcie** ([A12.4](#A12.4)) |

- **Tabela › Związki, kolumna Zdjęcie:** w grupie **Dzieci i źródła**, na początku ukryta. Komórka pokazuje małą
  miniaturę; kliknięcie lub stuknięcie otwiera podgląd z **Utwórz portrety…**, które zapisują się od razu
  z **Cofnij**. Kopia, CSV i XLSX mają „tak” albo nic. Sortowanie stawia związki ze zdjęciem przed związkami bez niego.
  Filtr wartości **ze zdjęciem** / **bez zdjęcia**; **Tylko** i **Bez** w komórce filtrują tak samo
  ([A6.7.6](A6-views.md#A6.7.6)). Na telefonie wiersz ma miniaturę tylko wtedy, gdy kolumna jest włączona.
- **Księga rodu:** zdjęcie na szerokość kolumny, najwyżej 110 mm wysokie, z podpisem rodzaju związku i daty („Ślub,
  18.6.1924”, przy parze bez ślubu „Partnerzy”). Jest tylko z częścią **Wycinki zapisów i zdjęcia**
  ([A7.4](A7-book-pages-and-export.md#A7.4)); drzewo, którego jedynymi obrazami są zdjęcia par, tę część zaoferuje.
- **Strony:** zdjęcia pary nie ma bez grupy obrazów i na stronie, która chroni osoby żyjące, gdy żyje co najmniej
  jeden z partnerów ([A12.7](#A12.7)).
- **Granice:** drzewo (Rodzina, Potomkowie, karty, linie połączeń), plakat, druk i przelot przez drzewo zdjęcia pary
  nie pokazują. Tabela, Wachlarz, Oś czasu, Mapa i statystyki portretu nie pokazują (bez zmian). **Przegląd drzewa**
  liczy zdjęcia par do zdjęć, a oryginały portretów do załączników.
- **Obsługa:** Tabela › Związki, wybór kolumn; strona osoby; eksport **Księga rodu**.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:45f7ca2a src/ui/table-view/table-columns.ts:732 uPhoto (group uextra, skrytý, kind thumb), thumbCell (strings.table.yes, sortKey), table-filter.ts presence (withPhoto / withoutPhoto), prohlížeč s Udělat portréty… a Vrátit, telefon (D10) · app:fd1f0c3c src/person-page.ts couplePhotoItems (první v galerii, popisek, počet obrázků, bez skupiny obrázků / žijící partner pod ochranou), rodinné stránky totéž, src/book-blocks.ts couplePhotoHtml (jen parts.media, popisek fields.marriageRow / book.partners + datum), src/book-css.ts .book-photo--couple max-height 110mm · app:50e49518 src/ui/tree-overview.ts a src/attachments.ts: fotka svazku mezi fotkami, originál portrétu je příloha · ZADANI_DEV §5, §8, D10, D12 · strings.ts tableCols.uPhoto, tableFilter.withPhoto, withoutPhoto, table.groups.uextra, personPage.sec.materials, relationships.unionPhotoCaption, book.parts.media -->

<a id="A12.7"></a>
## A12.7 Eksport, ochrona osób żyjących i GEDCOM

Oryginał portretu i zdjęcie pary to zdjęcia: idą do eksportu ze zdjęciami i wypadają razem z nimi.

- **Zawartość eksportu** ([A7.3](A7-book-pages-and-export.md#A7.3)):
  - bez **Zdjęcia** (także **Mały plik do wysłania** i **Tylko szkielet**) znikają portrety, ich oryginały (nawet
    gdy załączniki się eksportuje) i zdjęcia par; wycinek zapisu z takiego oryginału zostaje bez powiązania;
  - bez **Załączniki, dokumenty i wycinki źródeł**, ale ze zdjęciami, portrety i zdjęcia par zostają; portrety
    z załączników tracą powiązanie z oryginałem.
- **Ochrona osób żyjących** ([A7.2](A7-book-pages-and-export.md#A7.2)): osoba żyjąca traci portret, oryginał
  i załączniki; związek, w którym żyje co najmniej jeden z partnerów, traci zdjęcie. Tak samo na stronach i w księdze
  rodu.
- **Eksport GEDCOM** zapisuje zdjęcie pary jako zwykły obraz rodziny (`1 OBJE` przy `FAM`), bez własnego znacznika
  Stromu. Kadr i powiązanie portretu z oryginałem się nie zapisują; oryginał idzie jako zwykły załącznik osoby. Eksport
  **Z powrotem do {program}** zdjęć nie ma ([S6.6](S6-tree-from-another-program.md#S6.6)).
- **Import GEDCOM:** pierwszy obraz rodziny (pierwszeństwo ma obraz oznaczony `_PRIM`, `_PRIMARY` lub
  `_PERSONALPHOTO` `Y`; zapisany bezpośrednio przy rodzinie albo odnośnikiem do rekordu multimediów `@O1@`) staje się
  zdjęciem pary, gdy jest zawarty bezpośrednio w pliku. Pozostałe obrazy rodziny są zachowywane dla **Z powrotem do
  {program}** jak dotąd; obraz, który stał się zdjęciem pary, nie zapisuje się tam ponownie. Zdjęcie rodziny, do
  którego plik tylko odsyła ścieżką, zostaje zaoferowane do podłączenia ([A2.1.1](A2-loading-a-family-tree.md#A2.1.1)).
- **Granice:** portret po imporcie GEDCOM (ze Stromu i skądinąd) nie ma powiązania z oryginałem i edytuje się go
  w obrębie kwadratu ([A12.3](#A12.3)). Podłączony plik zdjęcia rodziny zastępuje wiersze zachowane dla **Z powrotem do
  {program}**; tam już potem nie wraca.
- **Obsługa:** **Eksport** → **Zawartość**, **Prywatność osób żyjących**; **Import → Import GEDCOM**, podsumowanie
  importu.
- **Obowiązuje od:** aplikacja 3.30.0

<!-- zdroj: app:50e49518 src/photo.ts stripPhotos (portrét, photoSource, zdrojová příloha i při exportu příloh, Partnership.photo*, výřez zápisu bez fromAttachmentId), src/attachments.ts stripAttachments + dropDanglingPortraitSources, src/privacy.ts (žijící: photoSource, přílohy; svazek se žijícím partnerem bez fotky), CONTENT_PRESETS (small, skeleton bez fotek; back bez médií) · app:68c232ad src/ged-exporter.ts:2089 Partnership.photo → 1 OBJE u FAM bez _STROM_KIND, photoSource se nezapisuje · src/ged-parser.ts první obrázek rodiny (_PRIM/_PRIMARY/_PERSONALPHOTO Y první, na místě i @O1@) → Partnership.photo jen jako bezpečná data URL, ostatní v extras pro Zpět do, vložený se nezapíše dvakrát · src/ged-media-attach.ts attachGedcomMediaFile (partnershipId: jen obrázek, jen svazek bez fotky, dropMediaLink) · strings.ts privacy.contentPhotos, contentAttachments, presetSmall, presetSkeleton · ZADANI_DEV „Data a rozhraní“, §6 -->

<a id="A12.8"></a>
## A12.8 Zdjęcia w danych drzewa

Oryginał portretu, kadr i zdjęcie pary są częścią drzewa (wersja danych 24: każdy plik drzewa to jeden materiał
z jego miejscami, [A3.5](A3-evidence-in-the-app.md#A3.5)). Idą z drzewem do kopii zapasowej JSON i do pliku
**Aplikacja z danymi**. Gdzie wszędzie są zapisane, opisuje [S8](S8-where-the-data-are.md).

- **Starsza aplikacja** (od 3.19.0) otworzy drzewo w wersji 24 tylko do odczytu i go nie zapisze, aby nie odrzuciła
  portretów, oryginałów, zdjęć par i miejsc plików ([A6.7.7](A6-views.md#A6.7.7)).
- **Cofnij:** każde **Gotowe** poza edycją osoby to jeden krok; w edycji osoby wszystko zapisuje się i cofa z jej
  **Zapisz**; dwa portrety ze zdjęcia pary to jeden krok.
- **Scalanie osób:** powiązanie z oryginałem idzie z portretem, który zostaje. Przy związkach zostaje zdjęcie
  zachowanego związku, a gdy go nie ma, zdjęcie drugiego.
- **Scalanie drzew** ([A8](A8-merging-trees.md)): zdjęcie pary ze scalanego pliku przybywa tam, gdzie związek
  w drzewie go nie ma; portret zachowuje oryginał tego portretu, który wygrał.
- **Drzewo z badania lub z Archiwum Strom:** od 1.35.0 badanie i archiwum trzymają portrety, oryginały portretów,
  zdjęcia par i załączniki: zapis drzewa je przekazuje, a wczytanie drzewa je zwraca według odcisku
  ([S8.3](S8-where-the-data-are.md#S8.3)). Badanie nie trzyma tylko kadru, czyli tego, gdzie w całym zdjęciu jest
  portret; drzewo w aplikacji go zachowuje. Badanie do 1.34 nie trzyma nic z tego: wczytanie nowej wersji zostawia je
  w drzewie; gdy badanie ma przy osobie lub parze własne zdjęcie, obowiązuje jego, w przeciwnym razie zostaje
  zdjęcie z drzewa. Portret, załącznik lub zdjęcie pary usunięte w aplikacji z kolejną aktualizacją nie wrócą.
- **Granice:** bez badania 1.35.0 portrety, oryginały i zdjęcia par są tylko w drzewie w aplikacji i w jego kopiach
  zapasowych. Powiązanie z oryginałem, które się nie zgadza (brak oryginału, kadr poza zdjęciem, kąt powyżej 45°),
  zostaje przy wczytaniu odrzucone; portret zostaje.
- **Obowiązuje od:** aplikacja 3.30.0; zdjęcia w badaniu z badaniem 1.35.0

<!-- zdroj: app:src/types.ts:1862 STROM_DATA_VERSION 24 (app:2b66d7cf; verze 23 app:59b9dde9, obě v 3.30.0) · src/photo.ts dropDanglingPortraitSources, sanitize při načtení · src/tree-manager.ts:659 isTreeNewer (jen ke čtení), strings.ts newerDataTitle · src/merge/executor.ts photoSource s vítězným portrétem, fotka svazku vítězného jinak druhého (app:59b9dde9, 50e49518) · app:50e49518 sloučení souboru: fotka svazku tam, kde chybí, originál podle bajtů · app:3f0312fb, 50e49518 src/research-link.ts carryOverMedia (fotka svazku a photoSource přenesené, vlastní fotka výzkumu vyhrává, odebrané se nevrací) · dirigent:spec/107 rozhodnutí: výzkum a archiv fotky nedrží (ZADANI_VYZKUM V2, V6, V7), platí pro výzkum do 1.34 · spec 108: dirigent:spec/108-kde-se-co-uklada U8, K2.3 (výřez se nevrací) · app:3419afff, 7263f1f6, src/research-link.ts carryOverMedia base · research:c9a4b614 CHANGELOG.cs.md 1.35.0 -->
