<a id="S8"></a>
# S8 Gdzie są dane

Aplikacja trzyma drzewa w pamięci przeglądarki na tym urządzeniu. Badanie i Archiwum Strom trzymają swoje drzewo
w folderze na dysku tego komputera, ze źródłami, materiałem i historią. Od badania 1.35.0 badanie trzyma też
portrety, zdjęcia par i załączniki drzewa z aplikacji. Rozdział opisuje aplikację Strom 3.30.0 i badanie 1.35.0;
zmiany z nowszej wersji mają przy sobie jej numer. Jak aplikacja trzyma obrazy w pamięci, opisuje [S8.7](#S8.7). Jak
most między nimi przenosi drzewo, opisują [S1](S1-connecting-app-and-research.md) i [S2](S2-edits-from-the-app.md).

| Co | Gdzie jest | Trwała kopia | Obsługa |
|---|---|---|---|
| drzewo w aplikacji, kopie zapasowe w aplikacji | pamięć przeglądarki | plik JSON (**Zapisz do pliku**, **Eksportuj**) | aplikacja: **Gdzie są dane** |
| oryginały oczekujące na badanie | pamięć przeglądarki, najwyżej 2 GB | żadna, dopóki badanie ich nie przyjmie ([A3.4.1](A3-evidence-in-the-app.md#A3.4.1)) | aplikacja: **Ustawienia → Dane i prywatność** |
| drzewo badania, źródła, materiał, historia | folder badania (domyślnie `Strom` w Dokumentach) | paczka `strom pack` | terminal |
| skany z archiwów, oryginały, pliki drzewa z aplikacji | wspólny folder badania (`shared`) | paczka `strom pack` | terminal |
| portrety, zdjęcia par, załączniki | w drzewie w aplikacji; od badania 1.35.0 także w badaniu | plik JSON z obrazami albo badanie 1.35.0 | aplikacja i terminal |

<!-- zdroj: dirigent:spec/108-kde-se-co-uklada · app:src/storage.ts strom-db, strom-originals · strings.ts fileCopy.title „Kde jsou data“, fileCopy.intro, backupsNote · research:src/core/paths.ts:148 (Dokumenty/Strom), src/core/config.ts:276 shared · research:c9a4b614 CHANGELOG.cs.md 1.35.0 -->

<a id="S8.1"></a>
## S8.1 Co jest tylko w przeglądarce

Drzewo w aplikacji jest tylko w pamięci tej przeglądarki, dopóki nie zapisze się go do pliku. Przeglądarka może
pamięć skasować; kopie zapasowe w aplikacji leżą w tej samej pamięci i znikną razem z nią.

- Okno **Gdzie są dane** mówi, czy przeglądarka trzyma pamięć trwale, kiedy drzewo ostatnio zapisano do pliku i jak
  pamięć utrzymać (instalacja jako aplikacja, trwała pamięć w Firefoksie, Dock lub ekran początkowy w Safari).
- **Zapisz do pliku** zapisuje całe drzewo ze wszystkimi danymi i obrazami do pliku JSON, który można znowu otworzyć
  w Stromie. Zaszyfrowane drzewo można zapisać zaszyfrowane.
- Prywatne okno przeglądarki po zamknięciu kasuje drzewa.
- **Granice:**
  - każda przeglądarka i każde urządzenie ma własną pamięć: drzewa otwartego w Chrome nie ma ani w Edge, ani
    w telefonie;
  - oryginałów oczekujących na badanie nie ma w drzewie, w kopiach zapasowych ani w eksporcie
    ([A3.4.1](A3-evidence-in-the-app.md#A3.4.1));
  - przy drzewie bez badania portrety, zdjęcia par i załączniki są tylko w drzewie w przeglądarce i w jego plikach:
    „Pliki są tylko w tej przeglądarce. Kopia: Eksportuj wszystko.”
- **Obsługa:** aplikacja: wskaźnik **Tylko w przeglądarce** na pasku, **Gdzie są dane?**; **Ustawienia →
  Przypomnienie o zapisie do pliku**.
- **Obowiązuje od:** aplikacja 3.0.0

<!-- zdroj: app:src/storage.ts strom-db · src/ui/file-copy-ui.ts · strings.ts fileCopy.title, intro, statePersistent, stateNotPersistent, statePrivate, backupsNote, save, quickHint, saveEncryptedBtn, details, settingLabel · materials.whereApp · S1.8 -->

<a id="S8.2"></a>
## S8.2 Co jest w badaniu i w Archiwum Strom

Badanie i Archiwum Strom trzymają drzewo we własnym folderze na dysku. Mają w nim drzewo z historią, źródła, materiał
i zadania; skany z archiwów, oryginały i pliki drzewa z aplikacji są we wspólnym folderze, każdy plik raz.

- Drzewo w aplikacji i drzewo w badaniu to dwie kopie. To, co aplikacja wyśle, badanie zapisuje według
  [S2](S2-edits-from-the-app.md).
- Pliki badania, których nie ma w drzewie, aplikacja pokazuje w oknie **Materiały** jako **tylko w archiwum**
  ([A3.5](A3-evidence-in-the-app.md#A3.5)).
- **Granice:**
  - zaszyfrowane drzewo w aplikacji nie oznacza zaszyfrowanego badania: „Drzewo jest zaszyfrowane, badanie na dysku
    nie.”;
  - materiał badania jest widoczny tylko w aplikacji na komputerze.
- **Obsługa:** terminal: `strom pack` (paczka jako kopia zapasowa lub do przekazania), `strom unpack`, `strom trees
  remove` ([S8.6](#S8.6)); aplikacja: ⓘ **Gdzie są pliki** w oknie **Materiały**.
- **Obowiązuje od:** badanie 1.0.0; pliki drzewa z aplikacji w badaniu 1.35.0

<!-- zdroj: research:src/core/paths.ts, src/core/config.ts (home, shared), src/core/media.ts sharedMediaPath (media/<sha[0:2]>/<sha[2:4]>/<sha><ext>) · app:strings.ts materials.whereTitle, whereArchiveResearch, whereEncryptedResearch, desktopOnlyResearch -->

<a id="S8.3"></a>
## S8.3 Zdjęcia i załączniki drzewa w badaniu

Badanie 1.35.0 i Archiwum Strom 1.35.0 trzymają portrety, zdjęcia par i załączniki drzewa z aplikacji Strom. Zapis
drzewa przekazuje je wszystkie; badanie zapisuje każdy plik raz, według zawartości, z jego miejscami w drzewie
([R11.5.1](R11-material-from-the-user.md#R11.5.1)).

- Oryginał portretu idzie do badania jako oryginał załącznika z etykietą **Portret**, oryginał zdjęcia pary jako
  materiał obojga partnerów. Oryginał tworzy zadanie materiały; w Archiwum Strom czeka odłożony.
  - **Od badania 1.36.0:** zadanie materiały powstaje tylko z włączonym ustawieniem **Pliki wysłane do badania agent
    przejrzy sam**; w przeciwnym razie oryginał czeka w Materiałach nieuporządkowany
    ([R11.6](R11-material-from-the-user.md#R11.6)).
- Wczytanie drzewa z badania zwraca pliki według odcisku: aplikacja dostaje portrety, zdjęcia par i załączniki na ich
  miejsca. Plik usunięty w aplikacji badanie ukrywa, nie kasuje go ([A3.5.6](A3-evidence-in-the-app.md#A3.5.6)).
- **Granice:**
  - badanie nie trzyma tego, gdzie w całym zdjęciu jest kadr portretu. Drzewo w aplikacji zachowuje go przy wczytaniu
    nowej wersji; drzewo wczytane z badania po raz pierwszy ma portret i całe zdjęcie, ale **Edytuj kadr** działa
    tylko wewnątrz kwadratu portretu ([A12.3](A12-portrait-and-couple-photo.md#A12.3));
  - badanie do 1.34 plików drzewa nie trzyma: portrety, zdjęcia par i załączniki są tylko w aplikacji, a wczytanie
    z badania zostawia je w drzewie ([A12.8](A12-portrait-and-couple-photo.md#A12.8));
  - tylko na komputerze i tylko z mostem badania.
- **Obsługa:** aplikacja: zapis drzewa (**Wyślij**, [S2](S2-edits-from-the-app.md)); **Badanie dla drzewa →
  Wysyłanie oryginałów plików**.
- **Obowiązuje od:** aplikacja 3.30.0, badanie 1.35.0
- **Od aplikacji 3.32.0 (badanie 1.37.0):** obrazy, które badanie już ma (portret, zdjęcie pary, załącznik, wycinek
  źródła, który badanie umie wyciąć ponownie), idą do badania odnośnikiem, swoim odciskiem, zamiast całych danych;
  wysłanie drzewa ze zdjęciami jest więc wielokrotnie mniejsze. Wysyłkę, która wymienia plik, którego badanie nie
  znajdzie, badanie odrzuci w całości, zanim cokolwiek zapisze, a aplikacja wyśle ją ponownie razem z danymi. Ze
  starszym badaniem wszystko idzie z danymi jak dotąd.

<!-- zdroj: dirigent:spec/108-kde-se-co-uklada (U8, K2.3, K2.6, K2.7) · app:3419afff POST /sync?media=app, 7263f1f6 GET /tree.ged?images=ref&media=app, 402b7d9b, e3e415f6 (X-Strom-Person, originál se štítkem Portrét), 59ff465e · src/research-link.ts carryOverMedia (photoSource ponechaný, base K2.3) · research:0834987b (X-Strom-Family), 3925b84a (_PRIM Y), 815bc90d, 91ab6230, 771d8af0 · research:src/core/treemedia.ts (hlavička) · research:c9a4b614 CHANGELOG.cs.md 1.35.0 · 3.32.0: app:debf50cc src/research-media-ref.ts (sync.mediaRef, media/known, sync.media-ref-unknown → znovu s daty) · CHANGELOG.cs.md 3.32.0 (Menší odesílání do výzkumu) · research:cf8352e2 (1.37.0) CHANGELOG.cs.md 1.37.0 (Odeslání z aplikace lehčí a rychlejší) -->

<a id="S8.4"></a>
## S8.4 Wskaźnik Tylko w przeglądarce

Wskaźnik **Tylko w przeglądarce** świeci, gdy drzewo ma zmiany, których nie trzyma żaden plik. Przy drzewie
z badaniem na komputerze nie świeci, gdy badanie trzyma wszystkie jego zmiany.

- Zmiany wysłane do badania albo świeże, wysłane w ciągu 10 minut, liczą się jako trzymane. Zmiana niewysłana dłużej
  (most nie działa, badanie ją odrzuciło, wysyła się ręcznie) zapala wskaźnik.
- Portretów, zdjęć par i załączników badanie do 1.34 nie trzyma: dopóki nie ma ich plik, wskaźnik świeci także przy
  drzewie, którego zmiany badanie trzyma.
- Przy badaniu 1.35.0 zdjęcia i załączniki liczą się jako trzymane po pierwszym zapisie drzewa, który je przekazał.
  Obraz dodany potem czeka jak każda niewysłana zmiana.
- **Granice:** eksport bez zdjęć nie liczy się jako kopia zdjęć. Drzewo badania nieotwarte od aktualizacji aplikacji
  liczy się jak dotąd, dopóki się go nie otworzy.
- **Obsługa:** aplikacja: wskaźnik na pasku otwiera **Gdzie są dane**; **Zapisz do pliku**.
- **Obowiązuje od:** aplikacja 3.0.0; 3.30.0: zdjęcia i załączniki we wskaźniku
- **Od aplikacji 3.31.0:** gdy badanie trzyma drzewo poza portretami, zdjęciami par i załącznikami, wskaźnik mówi
  **Zdjęcia tylko w przeglądarce**, tekst po najechaniu „Badanie przechowuje drzewo, ale nie jego portrety, zdjęcia
  par i załączniki: są tylko w przeglądarce, jeszcze nie w pliku – przeglądarka może je usunąć”. To samo mówi
  wiersz w **Więcej** („Więcej – zdjęcia nie są zapisane”), powiadomienie („Dobrze jest na bieżąco zapisywać drzewo
  do pliku.”) i okno **Gdzie są dane** („Badanie przechowuje drzewo, ale portrety, zdjęcia par i załączniki dodane od
  tamtej pory są tylko w przeglądarce.”). Obowiązuje to tylko wtedy, gdy takie są wszystkie drzewa, które wskaźnik
  liczy. Gdy niewysłana zostanie też zmiana dłużej niż 10 minut, wskaźnik mówi znowu **Tylko w przeglądarce**.

<!-- zdroj: app:e434e730, a678b253 src/browser-media.ts browserMediaFingerprint, browserMediaSafe, archiveHoldsAppMedia · src/ui/research-sync-ui.ts researchHoldsTree, RESEARCH_HOLD_MS=10 min, researchArchiveHoldsMedia · src/tree-manager.ts noteFileCopy (export bez fotek), learnMediaFingerprints · src/ui/file-copy-ui.ts unsavedOutsideResearch · strings.ts fileCopy.indicatorShort, indicatorTitle · dirigent:spec/108-kde-se-co-uklada K1b.1, K2.6 · 3.31.0: app 110f4109 src/ui/research-sync-ui.ts researchHoldsTree → photos, src/file-copy.ts unsavedKind (všechny stromy photos), strings.ts fileCopy.photosShort, photosTitle, photosMoreHint, noticePhotos, copyPhotosSince, copyPhotosNever · SPEC.md 1120-app-108-diry -->

<a id="S8.5"></a>
## S8.5 Nie udało się wczytać zdjęć z badania

Gdy drzewo wczytuje się z badania, które pliki drzewa trzyma, ale jego zdjęć nie da się wczytać według odcisku,
aplikacja wczyta drzewo bez nich i nie usunie niczego, co badanie ma.

- Do przyjścia zdjęć zapisy drzewa tylko dodają: pliku, którego drzewo w aplikacji teraz nie ma, badanie nie usunie.
- Aplikacja spróbuje ponownie sama po 5 i po 30 sekundach. Gdy się nie uda, ogłosi „Nie udało się wczytać zdjęć
  z badania.” ze **Spróbuj ponownie**.
- **Granice:** **Spróbuj ponownie** wczytuje wersję z badania jak każde wczytanie: gdy drzewo w międzyczasie się
  zmieniło, zapyta.
- **Obsługa:** aplikacja: komunikat → **Spróbuj ponownie**.
- **Obowiązuje od:** aplikacja 3.30.0, badanie 1.35.0
- **Od aplikacji 3.31.0:** przy otwarciu przez **Śledź na żywo** zdjęcia przychodzą po drzewie
  ([S1.4.1](S1-connecting-app-and-research.md#S1.4.1)). Zdjęcia, które nie przyszły, zgłasza tam „Niektóre zdjęcia
  nie zostały wczytane (N).” ze **Spróbować ponownie**; samo nie powtarza się po 5 s
  i 30 s. Do ich przyjścia zapisy drzewa nadal
  tylko dodają.

<!-- zdroj: app:src/ui/research-ui.ts startLiveFollow onDone (failed → noteResearchMediaMissed, bez researchMediaMissed a MEDIA_RETRY_MS), src/ui/image-load-chip.ts showFailed · spec 116 · app:6bbc2f82 src/ui/research-ui.ts noteResearchMediaMissed (zápisy jen přidávají), 61ef1bdd MEDIA_RETRY_MS=[5000, 30000], researchMediaMissed, tellResearchMediaMissed, researchRetryMedia · strings.ts sync.mediaMissed, sync.retry -->

<a id="S8.6"></a>
## S8.6 Paczka i usunięcie drzewa: skany i rodzinne zdjęcia

`strom pack` i `strom trees remove` rozróżniają **skany z archiwów** oraz **rodzinne zdjęcia i oryginały**. Skany
można z archiwum pobrać ponownie, rodzinnych zdjęć i oryginałów nie.

- Skan to obraz z archiwum (księga lub pobrany obraz). Plik, który jest jednym i drugim, liczy się jako rodzinny.
- `strom pack` wypisuje oba osobno. Ze skanów dołącza te z aktami i te, których nikt nie pobierze ponownie (albo
  wszystkie); rodzinne zdjęcia i oryginały zawsze wszystkie, także z pomniejszonymi kopiami plików drzewa. Paczka
  niesie też partie z aplikacji.
- Partie z aplikacji idą w paczce także z nazwą, osobami i notatką; `strom unpack` przywraca je razem z plikami
  partii ([R11.4](R11-material-from-the-user.md#R11.4)).
- `strom trees remove` najpierw oferuje kopię zapasową paczką ze wszystkimi skanami z archiwów, rodzinnymi zdjęciami
  i oryginałami (przywraca ją `strom unpack`), potem pyta osobno o skany i osobno o rodzinne zdjęcia
  i oryginały, których nie używa żadne inne drzewo genealogiczne; przy rodzinnych zdjęciach domyślna odpowiedź to
  nie. Usunięcie potwierdza wpisana nazwa drzewa. Pliki idą do kosza jako jeden folder „<nazwa> – pliki”.
- **Granice:**
  - paczkę powyżej 4 GB lub powyżej 65 535 plików badanie odrzuci, zanim cokolwiek zapisze: badanie przeniesie wtedy
    skopiowany cały folder (na dysk USB, do folderu w chmurze). `strom trees remove` powie to przy kopii zapasowej
    i będzie kontynuować bez niej;
  - drzewo genealogiczne usuwa tylko człowiek przy komputerze, nie agent.
- **Obsługa:** terminal: `strom pack [--all-images]`, `strom unpack "<plik>"`, `strom trees remove`.
- **Obowiązuje od:** badanie 1.35.0

<!-- zdroj: research:31def74a src/commands/pack.ts (ui.pack.images, ui.pack.family, ui.pack.batches, pack.too-large), src/core/pack.ts (bez ZIP64), src/core/zip.ts ZIP_MAX_FILES=0xffff · src/commands/trees.ts:271-287 (záloha výchozí ano, skeny ano jen se zálohou, rodinné ne, název), ui.remove.images.folder · research:771d8af0 (zmenšené kopie v balíku) · assets/lang/cs.json ui.pack.*, ui.remove.*, ui.error.pack.too-large · ui.pack.batches, ui.unpack.batches (v1.35.0) · trees remove: strom pack --all-images · e6bbfb40 ui.pack.which, ui.remove.backup (1.36.0 jen texty) -->

<a id="S8.7"></a>
## S8.7 Obrazy poza pamięcią drzewa

Otwarte drzewo trzyma w pamięci strony zamiast obrazów tylko odnośniki. Obraz wczytuje się z pamięci przeglądarki
dopiero wtedy, gdy jest widoczny. Duże drzewo z wieloma zdjęciami zmieści się tak w pamięci, którą przeglądarka daje
jednej stronie.

- Pamięć strony ma górną granicę, którą dzielą wszystkie okna aplikacji. Niektóre przeglądarki ją podają; gdzie
  indziej aplikacja liczy z 2 GB, na urządzeniu dotykowym z 1 GB. Za granicą strona przestaje działać.
- W pomiarze na zmyślonym drzewie z 20 000 osób i 4 000 obrazów otwarte drzewo zajęło około 55 MB pamięci strony,
  mniej więcej tyle co to samo drzewo bez obrazów (przed aplikacją 3.32.0 około 518 MB). Rozmiar, który się zmieści,
  określają dziś głównie osoby i ich dane.
- Cofnij i Ponów, zapis drzewa ani kopie zapasowe nie kopiują obrazów. Eksport do pliku (JSON, aplikacja z danymi,
  GEDCOM) zapisuje obrazy po kilka naraz.
- **Pamięci może nie wystarczyć:**
  - gdy otwarte drzewo zbliża się do granicy, aplikacja mówi to w głównym oknie trwałym powiadomieniem z radą:
    zamknąć inne okna aplikacji i usunąć niepotrzebne obrazy; przy każdym drzewie raz, dopóki przeglądarka się nie
    zamknie;
  - przed wynikiem z obrazami, który mógłby granicę przekroczyć (plik drzewa, plik wszystkich drzew, księga, plakat
    z portretami), i przed wczytaniem dużego pliku aplikacja zapyta: **Kontynuuj** albo anuluj; gdzie to możliwe,
    zaproponuje **Pominąć obrazy w pliku**;
  - szacunek wychodzi z rozmiaru drzewa, obrazów i liczby otwartych okien, nie z pomiaru przeglądarki; to
    ostrzeżenie, nie zakaz.
- **Obrazy wspólne dla kopii:** każdy obraz jest w pamięci przeglądarki raz, według zawartości, i dzielą go wszystkie
  drzewa, kopie zapasowe i kopie, które go mają. **Kopia całego drzewa** ([A14.3](A14-trees-and-structure.md#A14.3))
  daje pełną, samodzielną kopię drzewa z obrazami, które nie zajmują miejsca drugi raz. Usunięcie kopii lub kopii zapasowej nie usunie obrazu,
  którego używa inne drzewo. Obraz, którego nie używa już żadne drzewo, kopia zapasowa ani otwarte okno, usuwa się
  przy porządkowaniu po tygodniu.
- Ten sam obraz w dwóch drzewach jest przy scalaniu tym samym obrazem, nie różnicą ([A8](A8-merging-trees.md)).
- **Granice:**
  - księga, strony rodzinne, plakat, paczka zmian i plik chroniony hasłem trzymają obrazy w pamięci w całości,
    dlatego pytają wcześniej niż eksport obraz po obrazie;
  - granica dotyczy pamięci strony, nie miejsca na dysku: miejsca w pamięci przeglądarki pilnują kopie zapasowe
    i okno **Gdzie są dane** ([S8.1](#S8.1)).
- **Obsługa:** powiadomienie „Drzewo „…” zbliża się do granicy pamięci, którą ta przeglądarka daje aplikacji…”;
  pytanie **Pamięci może nie wystarczyć**; **Zmień strukturę…** → **Kopia całego drzewa**. Zarządzanie drzewami ma
  przy rozmiarze takiego drzewa „· obrazy wspólne” ([A14.1](A14-trees-and-structure.md#A14.1)).
- **Obowiązuje od:** aplikacja 3.32.0; obrazy raz według zawartości od aplikacji 3.1.0

<!-- zdroj: dirigent:spec/135-obrazky-mimo-pamet-stromu (K1.1–K1.4, P2, P3) · app:c5931983 (strom v paměti drží odkazy), 6b425e41 (úklid poolu dvoufázově po 7 dnech, kořen memory), e6ce052c (proudové výstupy JSON/uložená aplikace), fcc7c21b (GED po obrázcích), e6a0a8c2 (upozornění), 6e55a1dc (sloučení nad odkazy, rovnost obrázků podle obsahu) · src/memory-limit.ts (DEFAULT_LIMIT 2048 MB, TOUCH_LIMIT 1024 MB, odhad z JSON stromu bez obrázků + 25 MB za další okno, OUTPUT_IMAGE_FACTOR / WHOLE_OUTPUT_IMAGE_FACTOR) · src/ui/memory-limit-ui.ts checkMemoryNotice (jednou za relaci a strom, toast hold), outputNearLimit, canLeaveOut · src/media-pool.ts POOL_UNUSED_GRACE_MS (7 dní) · app:2ba2408a (pool obrázků, v3.1.0) · strings.ts memoryLimit.title, notice, output, outputAll, book, poster, leaveOut, import, continue, treeManager.duplicate · dirigent:prace/1122-app-135/karta.md (měření D9a: 20k × 4000 obr. 518 → 55 MB, bez obrázků 53 MB) · dirigent:test/vysledek-1123-scenare-app.md (Duplikovat: samostatná kopie se sdílenými obrázky, smazání kopie nesmaže obrázky jiných) · CHANGELOG.cs.md 3.32.0 (Velké stromy s fotkami) · app:e9f50b62 (Duplikovat nahrazeno Kopií celého stromu ve Změnit strukturu) · 7b967fd8 treeManager.imagesShared -->
