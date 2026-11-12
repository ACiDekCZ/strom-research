<a id="R8"></a>
# R8 Wyszukiwanie i odczyt wpisów w skanach

Jak badanie znajduje księgę, pozyskuje jej skany, kto skany czyta i jak zapisuje się to, co odczytano. Opisuje badanie
1.25.2 i 1.26.0 (odczyt skanów się między nimi nie zmienia). Przy zasadach rozróżnia się, czego **pilnuje kod**
(polecenie `strom` to robi albo zapis odrzuca), a co jest tylko **zasadą metodyki** (wskazówką dla agenta, której kod
nie sprawdza). **Dlaczego** podaje powód tak, jak podaje go metodyka lub kod badania.

Przebieg w skrócie:

1. **Księga:** według miejsca i czasu agent ustala przynależność administracyjną (parafia, urząd stanu cywilnego),
   archiwum i konkretną księgę ([R8.1](#R8.1)).
2. **Skany:** pobiera się je tylko przez program pobierający archiwum, w tempie i na warunkach archiwum, i tylko te
   potrzebne. Gdzie archiwum nie pozwala na automatyczne pobieranie, zapisuje je człowiek ([R8.2](#R8.2)).
3. **Przeglądanie:** księgę lub zakres skanów czytają **czytelnicy** (`strom read`): samodzielni agenci z czystym
   kontekstem, każdy z partią skanów i całym pytaniem ([R8.3](#R8.3)). Przebieg odczytu strom dostraja sam
   ([R8.4](#R8.4)).
4. **Własne spojrzenie:** każdy wpis, który będzie cytowany, główny agent czyta sam, z wycinka w pełnej rozdzielczości
   ([R8.5](#R8.5)).
5. **Zapis:** źródło z wycinkiem i transkrypcją, dane tylko z tego, co odczytano pewnie, i wyszukiwanie także bez
   znaleziska ([R8.6](#R8.6)).
6. **Pewność:** stopień pewności według tego, kto i jak wpis czytał; trudne miejsce wymaga drugiego, ślepego odczytu
   ([R8.7](#R8.7)).

Kto co czyta, w skrócie i na przykładzie jednego wpisu, mówi [R8.9](#R8.9).

> **Uwaga: odczyt modelem nie jest stuprocentowy.** Stare pismo czyta model AI, a dokładność odczytu zależy od modelu.
> Metodyka chce do starego pisma najsilniejszego modelu, nigdy szybkiego ani taniego odczytu. Czytelnicy czytają
> modelem do pisma (`model.vision`, w przeciwnym razie `strom read --model`), a rozmiar widoków zależy od modelu
> ([R8.3.2](#R8.3.2)). Rozmiar widoków można skalibrować (`strom media calibrate`, potwierdza człowiek), a strom
> dostraja odczyt osobno dla każdego agenta i modelu ([R8.4](#R8.4)). Mimo to model się myli: w imionach i nazwiskach, numerach domów, datach i miejscach. Dlatego
> czytelnik przy każdym imieniu i nazwisku podaje pewność w procentach, „nieczytelne” ma pierwszeństwo przed domysłem,
> trudne miejsce dostaje ślepy drugi odczyt, różne odczyty to sprzeczność, a Udokumentowane metodyka dopuszcza dopiero
> po własnym odczycie wpisu przez głównego agenta ([R8.7](#R8.7)).
> **Zasada projektu:** ważne dane powinien najlepiej sprawdzić jeszcze człowiek. Aplikacja Strom pokazuje przy źródle wycinek
> zapisu obok transkrypcji ([A3.3](A3-evidence-in-the-app.md#A3.3)). Transkrypcję sprawdzoną przez człowieka można
> oznaczyć jako **Transkrypcja zweryfikowana** ([A3.1.1](A3-evidence-in-the-app.md#A3.1.1), jak uwzględnia ją badanie:
> [R3.5.1](R3-verification-and-citation.md#R3.5.1)). Błędną daną można poprawić w aplikacji; zmiana danej potwierdzonej
> aktem staje się sprzecznością ([S2](S2-edits-from-the-app.md)).
> Odczyt przez model jest tylko propozycją: transkrypcji, którą człowiek napisał lub potwierdził, nie zmieni nikt
> poza człowiekiem, także nowy odczyt ([R3.4.1](R3-verification-and-citation.md#R3.4.1)).

<!-- zdroj: research:assets/method/reading.md:3-8 · src/agents/profiles.ts:5 vision, :147 · src/commands/read.ts:214 --model · src/core/reader.ts:226 certainty · assets/method/verify.md · Milan 4. 11. 2026 (zásada ověření člověkem) -->

<a id="R8.1"></a>
## R8.1 Najpierw księga

Zanim cokolwiek da się udokumentować, musi być jasne, gdzie są akty. Agent ustala przynależność administracyjną
miejsca w danym czasie, archiwum i konkretną księgę (zbiór aktów) z dostępem: adresem lub sygnaturą.

- **Tylko metodyka,** w tej kolejności:
  1. miejsce i czas wyznaczają przynależność (`strom place jurisdiction L… --kind parish|civil|manor|district --from
     --to`). Miejsce odczytane tylko niepewnie nie daje parafii ani księgi, dopóki nie jest pewne ([R8.5.2](#R8.5.2));
  2. archiwum (`strom repo add`, z warunkami korzystania) i księga (`strom recordset add … --places --years --kinds
     --access --url`). Program pobierający archiwum sam znajduje księgi: `strom fetch <stahovač> --find "<místo>"
     --years 1780-1850`;
  3. z katalogu korzysta się jak człowiek: wyszukiwanie albo strona jednej księgi, nigdy przechodzenie kolejnych
     numerów rekordów;
  4. gdzie szukano, zapisuje się także bez wyniku (`strom search add … --method web|catalog`).
- Indeksy, katalogi i drzewa online to tylko wskazówka, gdzie szukać ([R3.3](R3-verification-and-citation.md#R3.3)).
- Gotowe, gdy księga z dostępem istnieje, a zadanie udokumentowania na nią wskazuje (`--where B…`).
- **Dlaczego:** granice, parafie i nazwy się zmieniały; wieś mogła w różnych stuleciach należeć do różnych parafii.
  Przechodzenie kolejnych numerów rekordów archiwa blokują. Zapisane daremne wyszukiwanie sprawia, że kolejna sesja nie
  przeszukuje tych samych katalogów ponownie.
- **Obsługa:** terminal (agent).
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:assets/method/locate.md:1-34 -->

<a id="R8.1.1"></a>
### R8.1.1 Indeks przed przeglądaniem

- **Pilnuje kod:** gdy księgę ma się przeglądać skan po skanie (`strom read`, `strom fetch`), a dla parafii, lat
  i rodzaju aktów księgi znany jest indeks, którego nikt jeszcze w tym celu nie przeszukał, strom wymienia go, zanim
  cokolwiek uruchomi, razem z poleceniem, które go odczyta.
- **Granice:** od 30 skanów; inną granicę (albo nigdy) wyznacza odpowiedź człowieka na pytanie `index.first`
  (`strom media calibrate --questions`). W rozmowie strom tylko o tym mówi, w sesji `strom run` odczyt odrzuca, dopóki
  agent nie poda `--no-index`.
- **Dlaczego:** według komentarza w kodzie od mniej więcej 20–40 skanów indeks opłaca się bardziej niż przeglądanie.
  Przypadek z rzeczywistego badania: czytelnicy odczytali 61 skanów księgi ślubów, podczas gdy indeks parafii leżał już
  pobrany.
- **Obowiązuje od:** badanie 1.14.0

<!-- zdroj: research:src/core/indexfirst.ts:1-28 INDEX_FIRST_DEFAULT · src/commands/read.ts:217 --no-index, :265 guardIndexFirst -->

<a id="R8.1.2"></a>
### R8.1.2 Wniosek o księdze

Osobliwość księgi, archiwum lub miejsca zapisuje się przy nim jako wniosek. Kto następnym razem pracuje z księgą,
zobaczy go.

- **Pilnuje kod:**
  - wniosek to jedno zdanie, najwyżej 200 znaków; z dłuższego tekstu początek tworzy wniosek, a reszta trafia do
    szczegółów (najwyżej 2000 znaków);
  - wniosek należy do księgi, archiwum lub miejsca, które istnieją w badaniu (`--on B…|R…|L…`);
  - zadanie pokazuje wnioski ksiąg, w których szuka (`strom task show`).
- **Tylko metodyka:** należy tu kalibracja księgi, dwa lata na stronę, ręka, która pisze 7 jak 1. Notatka w zadaniu
  lub w dzienniku tym nie jest: tej przy księdze nikt nie zobaczy.
- **Dlaczego:** osobliwość księgi powinien zobaczyć każdy, kto otworzy ją następnym razem (metodyka „Lessons belong
  where they apply”).
- **Obsługa:** terminal: `strom lesson add "<poučení>" --on B…`, `strom lesson list`, `strom lesson edit`.
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:src/commands/analysis.ts lesson add (LESSON_MAX, --on repository|recordset|place) · research:src/core/model.ts:732 LESSON_MAX=200, LESSON_DETAIL_MAX=2000 · research:src/commands/tasks.ts:354 taskDetail lessons · research:assets/method/core.md "Lessons belong where they apply" -->

<a id="R8.2"></a>
## R8.2 Skany tylko przez program pobierający

Skany z archiwum pobiera tylko strom, przez program pobierający (konektor) danego archiwum i w jego tempie. Agent
nigdy nie pobiera sam: ani poleceniem, ani skryptem, ani swoją przeglądarką.

- **Pilnuje kod:** każda droga do archiwum kieruje się najsurowszym znanym poziomem jego warunków:

| Poziom | Co strom robi sam |
|---|---|
| dozwolone | katalog i skany, w tempie usługi |
| ograniczone | katalog; skany tylko za zgodą człowieka dla archiwum: powoli albo przez jego przeglądarkę, w przeciwnym razie ręcznie |
| tylko ręcznie | katalog; skany tylko ręcznie |
| zakazane | żaden automatyczny dostęp |
| nieznane | jak ograniczone |

- **Granice (pilnuje kod):**
  - poziom to najsurowszy z: odczytu warunków przez program pobierający, zapisu archiwum w badaniu, warunków
    dostarczonych razem ze strom, najsurowszego poziomu, jaki strom kiedykolwiek widział przy serwerze, pliku
    robots.txt i odmowy serwera;
  - złagodzić archiwum, dać zgodę i przyjąć łagodniejszy odczyt programu pobierającego może tylko człowiek; agent może
    archiwum tylko zaostrzyć;
  - tempo: bez danych usługi co najmniej 2 s między dwoma zapytaniami do serwera. Ze zgodą „powoli” najwyżej jeden
    skan na 10 s i najwyżej 120 na godzinę (tempo człowieka), o ile człowiek nie ustawił dla serwera własnego; strom
    nigdy go nie przyspiesza.
- **Tylko metodyka:** pobrać tylko skany, które zadanie czyta, nigdy całej księgi „na wszelki wypadek”. Księgę pobiera
  sesja, która ją czyta. Archiwum bez programu pobierającego: agent go buduje (`strom connector new`) według warunków
  portalu i robots.txt.
- **Od badania 1.30.0:** `strom connector test --fetch` ostrzega, gdy jeden skan kosztuje więcej niż 10 zapytań
  (najpewniej kafelki), mówi, jak długo w tempie archiwum potrwa skan i księga, i kieruje agenta najpierw do szukania
  odnośnika portalu do całego skanu, pobrania całej księgi albo całego skanu przez IIIF; kafelki dopiero na końcu.
- **Od badania 1.31.0:** to samo raz na przebieg mówi też `strom fetch`, także z pobieraczem zbudowanym wcześniej:
  według własnego liczenia pobierania (archiwum nie jest o nic więcej pytane) podaje, ile zapytań kosztuje jeden
  skan, jak długo w tempie archiwum potrwa skan i księga (jej liczba skanów, inaczej księga z 200 skanami), że
  pobieranie idzie dalej w tym tempie, przy pobieraniu w tle jak je zatrzymać (`strom fetch --stop B…`) i czego
  szukać najpierw. Komunikat pokazuje też wynik `--json`, `strom fetch --status` i brief.
- Skany, których archiwum nie pozwala pobrać automatycznie, człowiek zapisuje do przygotowanego folderu
  ([R6.2.1](R6-awaiting-action.md#R6.2.1)); zgoda archiwum: [R6.3.1](R6-awaiting-action.md#R6.3.1).
  Archiwa tylko przez przeglądarkę, przeglądarka agenta i cały przebieg: [R9](R9-archives.md).
- **Dlaczego:** metodyka chce przestrzegać warunków każdego archiwum; portalu, którego warunki tego zabraniają, nie
  przegląda się automatycznie. Godzinowy limit archiwum zatrzymuje resztę pracy, dlatego najpierw całe skany, a części
  tylko tam, gdzie wymaga ich wpis.
- **Obsługa:** terminal: `strom fetch <stahovač> … --images 40-69 --recordset B…`, `strom allow archive` (tylko
  człowiek). Aplikacja: Czeka na załatwienie.
- **Obowiązuje od:** badanie 1.0.0 (pobieranie tylko przez strom); poziomy warunków i tempo człowieka 1.14.0; skan
  z kafelków zgłasza `strom connector test` od 1.30.0, `strom fetch` od 1.31.0

<!-- zdroj: research:src/core/terms.ts:1-30 (úrovně), :52-59 LEVELS, WAYS · src/core/net.ts:39 DEFAULT_PACE, :45 HUMAN_PACE · assets/method/reading.md:44-49, :89-104 · assets/method/locate.md:15-21 · cs.json ui.archive.level.* · CHANGELOG.cs.md 1.14.0, 1.15.0 · research:773c475a src/commands/connectors.ts HEAVY_IMAGE = 10 · research:a7a9e196 src/commands/connectors.ts heavyFetch (jednou za běh, od 2. snímku, „this fetch goes on at that pace“, --stop B… na pozadí), src/core/fetching.ts HEAVY_IMAGE, BOOK_GUESS = 200, heavySaid (--status, brief), data heavy v --json · CHANGELOG.cs.md 1.31.0 -->

<a id="R8.3"></a>
## R8.3 Czytelnicy: kto czyta skany

Księgę lub zakres skanów przeglądają **czytelnicy**, nie główny agent. Czytelnik to osobne uruchomienie agenta (tego
samego programu, z którym pracuje badanie) z czystym kontekstem. Dostaje partię widoków i całe pytanie i pisze tylko
swój raport.

- **Pilnuje kod:**
  - czytelnik pracuje w jednym pustym folderze poza badaniem, nie w folderze badania;
  - widzi tylko swoje widoki i pisze tylko swój raport do `notes/readings/`; do badania nigdy nie zapisuje i nie
    uruchamia poleceń;
  - czyta modelem do pisma: `--model`, w przeciwnym razie ustawienie `model.vision` (przy Claude Code domyślnie
    `opus`);
  - bez osobistych dodatków agenta (skille, wtyczki, serwery MCP), dopóki człowiek nie włączy `agent.addons`;
  - w Archiwum Strom (bez AI) czytelnicy się nie uruchamiają.
- **Tylko metodyka:** przeglądanie księgi to praca czytelników, nie własnych subagentów agenta. Subagent
  (`strom-scan-reader`) czyta tylko wycinki znalezionych wpisów. Znalezisko i wyszukiwanie zapisuje główny agent sam,
  wyszukiwanie z `--by reader`.
- **Dlaczego:** obraz zostaje w kontekście tego, kto go otworzył; główny agent dostaje więc krótki raport zamiast
  kontekstu pełnego obrazów. Folder poza badaniem: czytelnik nie może przejąć instrukcji badania (pliki CLAUDE.md,
  AGENTS.md). Model do pisma nigdy nie jest słabszy niż główny: źle odczytane nazwisko wysyła badanie do złej wsi.
- **Obsługa:** terminal: `strom read B… --images 40-69 --question "…"`. Uruchomić na pierwszym planie i pozwolić mu
  dobiec do końca (często dziesięć minut i dłużej).
- **Obowiązuje od:** badanie 1.0.0; pusty folder poza badaniem i `agent.addons` 1.14.0

<!-- zdroj: research:src/core/reader.ts:1-9 · src/commands/read.ts:1-4, :183-200, :226, :304-309, :514-523 · src/commands/readers.ts:73-81 readerDesk, :128 refuseReadersInArchive · src/core/reader.ts:307-313 readerSettings · src/agents/profiles.ts:5, :147 · src/core/config.ts:314 agent.addons · assets/method/reading.md:51-68 -->

<a id="R8.3.1"></a>
### R8.3.1 Partie, czytelnicy naraz i zakres

- **Partia:** 10 widoków na czytelnika (`--batch`, najwyżej 12). Rozkładówka czytana w połówkach to dwa widoki.
  Partie są możliwie równe (11 skanów: 6 i 5, nigdy 10 i 1).
- **Czytelnicy naraz:** 5 czytelników jednocześnie (`--parallel`, od 1 do 10; na stałe
  `strom config set read.parallel <n>`).
- **Zakres:** najwyżej 200 skanów w jednym odczycie; listę (`--images 5-19,21-39`) czyta się dokładnie tak, jak ją
  podano.
- Skany odczytane już wcześniej strom wymienia na początku; odczytu nie odrzuca.
- **Dlaczego:** koszt czytelnika rośnie z kwadratem jego partii (za obraz płaci się w każdym kolejnym kroku); dziesięć
  skanów na czytelnika kosztuje na skan jedną trzecią tego, co pięćdziesiąt. Czytelnicy naraz dają tych samych
  czytelników i te same zapytania, tylko wcześniej; mniej naraz, gdy subskrypcja agenta wyczerpuje się zbyt szybko.
  Setki skanów w jednym odczycie to według kodu błąd, nie zamiar.
- **Obowiązuje od:** badanie 1.0.0 (partia 10, najwyżej 12); czytelnicy naraz 1.15.0; zakres 200 skanów 1.14.0; lista
  z lukami 1.15.0

<!-- zdroj: research:src/core/reader.ts:5-15 BATCH, BATCH_MAX, :137-171 batches · src/core/config.ts:229-230, :277 read.parallel · src/core/media.ts:126 IMAGE_RANGE_MAX · src/commands/read.ts:113-120, :407-409 · CHANGELOG.cs.md 1.15.0 -->

<a id="R8.3.2"></a>
### R8.3.2 Rozmiar widoków i rozkładówka w połówkach

- **Rozmiar (pilnuje kod):** widok jest tak duży, jak model czytelników przyjmuje go w całości: 2000 px po dłuższym
  boku przy nowszych modelach (Claude Opus 4.7 i nowsze, Sonnet 5 i nowsze, Fable; Codex i OpenCode), w przeciwnym
  razie 1568 px. Inaczej tylko wtedy, gdy człowiek rozmiar skalibrował (`strom media calibrate`) albo strom go
  zwiększył przy księdze ([R8.4](#R8.4)).
- **Rozkładówka w połówkach:** przy ślepym odczycie, w zadaniu weryfikacji i przy skanie, który czytelnik wcześniej
  zgłosił jako niejasny, czytelnik dostaje rozkładówkę jako dwie połówki, które przy grzbiecie zachodzą na siebie
  (4 % szerokości na każdą stronę). Tylko wtedy, gdy połówka jest co najmniej 1,25× ostrzejsza niż cały skan w jednym
  widoku. W przeciwnym razie rozkładówkę czyta się w całości; `--half both` wymusza połówki, `--whole` ich zabrania,
  `--half left|right` bierze tylko jedną stronę.
- **Wycinek (`--crop`):** tylko ta część każdego skanu, w pełnej rozdzielczości. Wycinek większy niż jeden widok
  czytelnik dostaje w zachodzących na siebie częściach. Gdy z archiwum przyszła ostrzejsza część skanu, czyta się
  z niej.
- **Dlaczego:** większy obraz agent sam zmniejsza, zanim model go zobaczy, a za odrzucone piksele płaci wolniejszym
  odczytem. Połówka pokazuje każdą stronę ostrzej; przy prawie kwadratowej rozkładówce drugi widok kosztowałby więcej,
  niż przynosi.
- **Obowiązuje od:** badanie 1.14.0; odczyt z ostrzejszej części skanu 1.19.0

<!-- zdroj: research:src/agents/images.ts:1-54 IMAGE_MAX, IMAGE_MAX_LARGE, imageMax · src/core/views.ts:113-140 SPREAD_OVERLAP, SPREAD_GAIN, halves, readInHalves, :97 tiles · src/commands/read.ts:192-194, :332-339, :356-390, :59-85 sharperForReader · CHANGELOG.cs.md 1.19.0 „Ostřejší část snímku se opravdu čte“ -->

<a id="R8.3.3"></a>
### R8.3.3 Co pisze czytelnik

Czytelnik pisze raport na bieżąco, po każdym skanie, nie na końcu. Na każdy skan jeden blok z polami:

| Pole | Co zawiera |
|---|---|
| `result` | `found` (znalezisko), `nothing` (nic), `unclear` (możliwe dopasowanie, którego nie da się potwierdzić) |
| `entries` | każdy wpis, który odpowiada na pytanie, słowo w słowo w oryginalnym języku i pisowni, gdzie stoi i w której kolumnie |
| `illegible` | czego nie dało się odczytać i gdzie |
| `hand` | pismo: atrament, rodzaj pisma, język, skróty |
| `certainty` | przy każdym imieniu i nazwisku we wpisie, na ile czytelnik jest pewny (%) |
| `pages` | numery stron zapisane na skanie |
| `gaps` | brakujące strony przed skanem (numeracja przeskakuje) |
| `section` | na skanie zaczyna się inna część księgi (miejsce, rok, rodzaj aktów) |

- **Zasady czytelnika** (strom umieszcza je w zadaniu czytelnika):
  - przepisać tylko to, o co pyta pytanie (tylko numery stron, tylko wpisy jednego nazwiska, jeden wpis w całości);
  - „nic” to ważny i cenny wynik: czytelnik mówi, co sprawdził;
  - „nieczytelne” ma pierwszeństwo przed domysłem;
  - możliwe dopasowanie (nieczytelne imię lub nazwisko, gdy reszta się zgadza: wiek, dom, data, rodzice) to `unclear`
    i wpis, nigdy schowane w bloku `nothing`;
  - to, co wie badanie (`--context`), służy tylko do rozpoznania rodziny, nigdy do uzupełnienia nieodczytanego;
  - przy ślepym odczycie (`--blind`) dokładna transkrypcja bez oczekiwań
    ([R3.5](R3-verification-and-citation.md#R3.5)).
- **Pilnuje kod:** niejasne miejsce z tego raportu blokuje zapis daremnego wyszukiwania w zakresie, dopóki nikt nie
  obejrzy go z bliska ([R3.6](R3-verification-and-citation.md#R3.6)).
- **Dlaczego:** przy niejasnym miejscu agent musi przyjrzeć się z bliska, zanim zakres uzna się za daremnie
  przeszukany; możliwe dopasowanie często kryje się właśnie w nieczytelnym. Raport pisany na bieżąco przetrwa awarię:
  wznowiony czytelnik kontynuuje od skanów, których w raporcie jeszcze nie ma.
- **Obowiązuje od:** badanie 1.0.0; pola `pages`, `gaps`, `section`, `unclear` jako wpis i „tylko to, o co pyta
  pytanie” 1.14.0

<!-- zdroj: research:src/core/reader.ts:188-240 readerPrompt, :266-300 parseReport · assets/method/reading.md:51-57, :76-77 · src/commands/readings.ts openUnclear, refuseNegativeOverUnclear -->

<a id="R8.3.4"></a>
### R8.3.4 Limit czasu czytelnika i awaria usługi

- **Pilnuje kod:** czytelnik ma 5 minut i 1 minutę na każdy widok, co najmniej 6 i najwyżej 15 minut. Gdy czytelnicy
  tego samego agenta i modelu potrzebowali więcej, strom limit wydłuża: według ostatnich 10 czytelników, którzy
  dobiegli do końca lub trafili na limit (×1,5 po ukończonym, ×2 po zatrzymanym), nigdy ponad 15 minut. `--minutes`
  ustawia limit ręcznie.
- **Awaria usługi:** czytelnik, który po ponownej próbie usługi modelu milczy 150 s, zostaje raz wznowiony tam, gdzie
  skończył, z pozostałym czasem. Gdy milczy dalej, od razu kończy; jego skany zostaną odczytane ponownie później. Taka
  awaria nie zmniejsza partii.
- Czytelnik zatrzymany przez limit nie dał odpowiedzi do swoich skanów: strom mówi, żeby agent obejrzał je sam albo
  odczytał je ponownie z dłuższym limitem.
- **Dlaczego:** przypadki z rzeczywistych badań: czytelnik jednego wycinka stał 15 minut, a agent na niego czekał;
  czytelnik jednego wycinka skończył w limicie 6 minut bez wyniku, ten sam odczyt z limitem 12 minut był gotowy w 4.
  Milcząca usługa prowadziła wcześniej aż do limitu, a czytelnicy bez wyniku zmniejszali partie.
- **Obowiązuje od:** badanie 1.14.0; wznowienie po awarii usługi 1.22.0

<!-- zdroj: research:src/core/reader.ts:17-91 readerMinutes, learnedReaderMinutes, READER_STALL_MS · src/commands/read.ts:493-496, :674-680 · src/core/readstats.ts readerLimit · CHANGELOG.cs.md 1.22.0 -->

<a id="R8.3.5"></a>
### R8.3.5 Czytanie do znalezienia

- **Pilnuje kod:** z `--until-found` nie zaczyna już żaden kolejny czytelnik, gdy tylko jeden zgłosi znalezisko;
  czytelnicy w trakcie pracy kończą czytanie. strom wypisuje dokładnie, których skanów nikt nie przeczytał.
- **Granice:** przeszukane są tylko odczytane skany; wyszukiwanie zapisuje się jako `--result partial`, nigdy jako
  daremne dla całego zakresu.
- **Tylko metodyka:** tylko dla **jednego** konkretnego wpisu (chrzest, ślub lub pochówek jednej osoby, o której
  wiadomo dość). Nigdy dla wszystkich wpisów miejsca lub nazwiska ani tam, gdzie po znalezisku może przyjść imiennik.
  Gdy znalezisko nie jest właściwe, odczytuje się resztę.
- **Dlaczego:** nieodczytany skan nie jest przeszukany. Imiennik nie jest szukaną osobą
  ([R1.4](R1-research-in-brief.md#R1.4)).
- **Obowiązuje od:** badanie 1.15.0

<!-- zdroj: research:src/commands/read.ts:197-199, :216, :468-489, :596-631 · assets/method/reading.md:70-75 · CHANGELOG.cs.md 1.15.0 -->

<a id="R8.3.6"></a>
### R8.3.6 Czytanie księgi w trakcie pobierania

- **Pilnuje kod:** księgę, którą właśnie pobiera `strom fetch`, można czytać od razu. Czytelnicy zaczynają od
  zarejestrowanych skanów (partiami po 10), na resztę się czeka. Skany, których pobieranie nie przyniosło, strom
  wypisuje dokładnie; nie są czytane i nie liczą się jako daremne.
- **Dlaczego:** szybszy odczyt; archiwum dostaje te same zapytania w tym samym tempie.
- **Obowiązuje od:** badanie 1.15.0

<!-- zdroj: research:src/commands/read.ts:195-196, :238-253, :411-456, :599-633 · CHANGELOG.cs.md 1.15.0 „Rychlejší čtení“ -->

<a id="R8.3.7"></a>
### R8.3.7 Co wraca do agenta

- **Pilnuje kod:** po odczycie agent dostaje zwięzłe podsumowanie: na których skanach jest znalezisko, na których
  niejasne miejsce, czego nie dało się odczytać tam, gdzie nic nie było, i luki w księdze. Do tego gotowe polecenie
  `strom search add … --by reader` z wynikiem `found`, `partial`, `inconclusive` lub `negative` i z lukami w `--note`.
  Raporty zapisują się w badaniu.
- Skany, których nikt nie zgłosił, i czytelnicy, którzy zawiedli, są wypisani osobno.
- **Tylko metodyka:** raportów nie czyta się w całości, tylko przez `strom readings` (`--match <příjmení>`, `--list`,
  jeden skan: `strom readings B… --image 57`). Każdy raport zapisuje się od razu, zanim zaczną kolejni czytelnicy.
  Skany odczytane wcześniej: inne pytanie albo ślepa kontrola jest w porządku, to samo pytanie nie.
- **Dlaczego:** główny agent trzyma w kontekście tylko to, co znaleźli czytelnicy, nie obrazy ani całe raporty.
- **Obsługa:** terminal: `strom readings`.
- **Obowiązuje od:** badanie 1.0.0; `strom readings` 1.14.0

<!-- zdroj: research:src/commands/read.ts:641-689 · src/commands/readings.ts:467-478 · assets/method/reading.md:57-67 · src/core/reader.ts:1-3 -->

<a id="R8.4"></a>
## R8.4 Samodostrajanie odczytu

strom mierzy, jak przebiega odczyt skanów, i według tego sam zmienia sposób odczytu. Tylko w kierunku dokładności albo
mniejszej liczby zapytań do archiwum.

- **Pilnuje kod,** co strom może zmienić sam:
  - księga czytana gorzej niż pozostałe albo pokazywana w powiększeniu: cały skan w rozmiarze do odczytu, rozkładówka
    w połówkach, ze skanów, które już są na komputerze;
  - czytelnicy, którzy tracą kontekst, ponownie otwierają widoki lub nie dają wyniku: mniejsze partie i mniej widoków
    na wywołanie, nigdy poniżej połowy wartości domyślnej;
  - archiwum, które trafiło na swój limit: najpierw całe skany, połówki i części tylko przy kandydatach;
  - księga, z której portal nie dał ostrzejszej części: kolejnych części się nie proponuje;
  - skany pobrane i nigdy nieodczytane: pobiera się tylko to, co zadanie czyta;
  - każda zmiana wraca do wartości domyślnej po 60 dniach bez swojego sygnału i z nowymi odczytami.
- **Granice (pilnuje kod):** nigdy mniejszy widok, tańszy model, odczyt, który mógłby przeoczyć wpis, ani więcej
  zapytań do archiwum: o tym decyduje człowiek (`strom media calibrate --questions`). Decyduje się po sesji, nigdy
  w jej trakcie: sesja idzie według wartości ze swojego początku. Obowiązuje osobno dla każdego agenta i modelu. Każda
  zmiana jest zapisana z powodem.
- **Obsługa:** terminal: `strom media calibrate --report` (jak przebiegał odczyt, bezpłatnie), `--questions` (o czym
  decyduje człowiek), `--reset` (powrót do wartości domyślnych); `strom config set tune.auto off` wyłącza
  samodostrajanie. Kalibracja rozmiaru widoków (`strom media calibrate`) to płatny odczyt własnych udokumentowanych
  aktów badania i potwierdza ją tylko człowiek.
  `strom doctor`, wiersz **po samodostrojeniu**: zmiana, po której czyta się gorzej (zaleca ją cofnąć), albo zmiana,
  po której odczyt jest droższy i ani trochę pewniejszy (zaleca ją zostawić).
- **Dlaczego:** według kodu tylko tak, żeby niczego to nie pogorszyło: zmiana może dodać dokładności albo zaoszczędzić
  zapytań do archiwum; to, co mogłoby ująć dokładności lub obciążyć archiwum, jest pytaniem dla człowieka. Droższą zmianę `strom doctor` zaleca zostawić, bo szła ku dokładności, a pewność mierzy
  się tylko niepewnymi miejscami: bliższy widok może czytać dokładniej, nawet gdy niepewnych miejsc nie ubywa.
- **Obowiązuje od:** badanie 1.14.0
- **Od badania 1.29.0:** `strom doctor` przy droższej zmianie mówi, dlaczego zaleca ją zostawić.

<!-- zdroj: research:src/core/tune.ts:1-21 (A1–A7) · src/core/readstats.ts:88-99 TUNING smallest, backAfterDays · src/core/config.ts:337 tune.auto · src/commands/calibrate.ts:394-420 · assets/lang/cs.json ui.doc.tuneworse, ui.doc.tuneworse.a, ui.doc.tuneworse.b (důvod od commitu 9bd14e84, 1.29.0) -->

<a id="R8.5"></a>
## R8.5 Własny odczyt głównego agenta

Wpis, który będzie cytowany, główny agent ogląda sam w pełnej rozdzielczości. Starym pismem zajmuje się najsilniejszy
model, nigdy szybki ani tani odczyt.

- **Pilnuje kod:** skany otwiera się tylko jako widoki `strom media view` (plik w `.strom/views/`). Cały skan ma
  najwyżej 1400 px po dłuższym boku: do odnalezienia wpisu, nie do czytania. Połówka, wycinek i części mają rozmiar,
  jaki model przyjmuje w całości (1568 lub 2000 px). Najwyżej 12 skanów i 24 widoki na jedno wywołanie.
- **Tylko metodyka,** przebieg:
  1. znaleźć: cały skan z `--grid` (siatka co jedną dziesiątą), odczytać, gdzie jest wpis;
  2. wyciąć: `--crop x,y,w,h` (ułamki skanu) lub `--half left|right`; przepisuje się tylko z wycinka lub
     połówki w pełnej rozdzielczości. Wyblakły atrament `--contrast`, strona bokiem `--rotate 90`, strona w częściach
     `--split 2x2`; cały widok niejasny: `--half both`, zanim padnie „nie znaleziono”;
  3. po mniej więcej 30 widokach zapisać, co się znalazło, zanim otworzy się kolejne; widoku, który wypadł
     z kontekstu, nie otwiera się ponownie, obowiązują notatki;
  4. wycinek mówi „powiększono”: skan nie ma więcej szczegółów. Ostrzejszą część można pobrać tylko przez program
     pobierający, który to potrafi.
- Strona ↔ skan: `strom recordset calibrate B… --point 57=112` (zmierzone na skanie, nigdy oszacowane); potem
  `strom media view B… --page 112`.
- **Dlaczego:** zmniejszony cały skan wystarczy do odnalezienia wpisu za połowę tokenów, ale nie do czytania. Każdy
  widok zostaje w kontekście, który go otworzył. Patrzeć na tak mało pikseli, ile potrzebuje pytanie.
- **Obsługa:** terminal: `strom media view B…:57 --grid`, `strom media view B…:57 --crop 0.05,0.40,0.45,0.18`.
- **Obowiązuje od:** badanie 1.0.0 (widoki, `--grid`, `--crop`, `--contrast`, `--rotate`); rozmiary 1400/1568/2000 px,
  `--split`, limity na wywołanie i mniej więcej 30 widoków 1.14.0

<!-- zdroj: research:assets/method/reading.md:3-8, :18-50, :86-88 · src/commands/media.ts:239-241 VIEW_MAX_IMAGES, VIEW_MAX_VIEWS, :934-967 · src/agents/images.ts:14-18 OVERVIEW_MAX · src/agents/profiles.ts:43 DEFAULT_READING_NUMBERS viewsStop · src/commands/sources.ts:612-618 recordset calibrate -->

<a id="R8.5.1"></a>
### R8.5.1 Imię i miejsce do dalszego szukania

- **Tylko metodyka:** imię, nazwisko lub miejsce, od którego zależy dalsze szukanie (nazwisko, miejsce urodzenia,
  parafia), przed zapisem odczytuje się ponownie na wycinku w pełnej rozdzielczości. Co zostaje niepewne, zapisuje się
  jako niepewne i mówi się o tym.
- **Dlaczego:** źle odczytane nazwisko wysyła badanie do złej wsi.
- **Obowiązuje od:** badanie 1.4.1

<!-- zdroj: research:assets/method/reading.md:3-8 -->

<a id="R8.5.2"></a>
### R8.5.2 Niepewnie odczytane miejsce to wskazówka

- **Tylko metodyka:** miejsce odczytane niepewnie (czytelnicy się różnią, `[?]`, nic innego go nie potwierdza) to
  wskazówka, nie miejsce. Nie wynika z niego żadna parafia, księga ani zadanie, dopóki nie jest pewne: własne
  spojrzenie na wycinek, indeks księgi, słownik geograficzny lub kataster (parafia wsi z nich, nigdy z dzisiejszej
  gminy). Gdy zostaje niepewne: hipoteza z odczytami jako wariantami (`strom hypothesis add`) i zadanie, które ją
  sprawdzi (`--about H…`).
- **Dlaczego:** zadanie, które brałoby niepewne miejsce za pewne, szukałoby w księdze innej parafii.
- **Obowiązuje od:** badanie 1.14.0

<!-- zdroj: research:assets/method/reading.md:10-15 · assets/method/locate.md:8-9 -->

<a id="R8.6"></a>
## R8.6 Zapis znaleziska

Znaleziony wpis zapisuje się za jednym razem: źródło z wycinkiem, transkrypcją i miejscem w księdze, dane z niego
i wyszukiwanie, które go znalazło.

- **Pilnuje kod:** `strom batch --file notes/<soubor>` zapisuje wszystkie wiersze albo żaden; błędne wiersze podaje
  wszystkie naraz.
- **Tylko metodyka:**
  - źródło ze skanu dostaje `--clip` (wycinek, w którym wpis czytano), `--transcript` (słowa wpisu wiersz po
    wierszu, nieodczytane `[?]`) i `--locator` (folio, strona, numer wpisu); szczegółowo
    [R3.4](R3-verification-and-citation.md#R3.4);
  - wpis w innym języku lub piśmie niż język badania dostaje obok dosłownej transkrypcji także tłumaczenie na język
    badania (`--translation`), od badania 1.28.0;
  - do pól (`--date`, `--house`, `--age`, imię) tylko to, co odczytano pewnie. Niepewne trafia do transkrypcji z `[?]`
    i do notatki danej („dom 21 lub 27”). Co czytelnik zgłosił jako nieczytelne, zostaje nieczytelne, dopóki agent nie
    odczyta tego sam. Pusta kolumna jest pusta; niczego nie uzupełnia się według tego, co zwykle;
  - imię lub nazwisko odczytane tylko częściowo zachowuje pewne litery (`Anna /Kr[?]ková/`), data z niepewnym dniem
    zachowuje miesiąc;
  - wyszukiwanie zapisuje się także bez znaleziska, z dokładnym zakresem stron; brakujące strony księgi nie są
    przeszukane ([R3.6](R3-verification-and-citation.md#R3.6)).
- **Pilnuje kod:** daremne wyszukiwanie nad miejscem, które czytelnik zgłosił jako niejasne, strom odrzuca
  ([R3.6](R3-verification-and-citation.md#R3.6)). O brakującym wycinku lub transkrypcji przypomina.
- **Dlaczego:** aplikacja Strom pokazuje wpis wycięty ze skanu obok jego słów. Osobę szuka się dalej według pewnych
  pól; nazwisko z pewnymi literami da się dalej odnaleźć. Najdroższy błąd to przeszukać tę samą księgę dwa razy.
- **Obsługa:** terminal (agent). Aplikacja: strona źródła pokazuje wycinek i transkrypcję
  ([A3.3](A3-evidence-in-the-app.md#A3.3)).
- **Obowiązuje od:** badanie 1.0.0; wycinek 1.1.0

<!-- zdroj: research:assets/method/recording.md:1-27, :55-65 · assets/method/reading.md:76-84 · assets/method/core.md „Negative results are results“ · překlad: recording.md "--translation", link.md krok 7 (od v1.28.0) -->

<a id="R8.7"></a>
## R8.7 Pewność i weryfikacja odczytu

Stopień pewności danej ze skanu zależy od tego, kto i jak wpis czytał.

- **Tylko metodyka:** Udokumentowane tylko wtedy, gdy główny agent przeczytał wpis sam, a wpis podaje daną wprost.
  Wniosek, który opiera się na jednej trudnej komórce (numer domu, wiek, imię lub nazwisko), wymaga przed
  Udokumentowane drugiego, ślepego odczytu; różne odczyty to sprzeczność, nie wybór
  ([R3.5](R3-verification-and-citation.md#R3.5)).
- **Pilnuje kod:** Udokumentowane wymaga cytatu ze źródła, które nie jest słabe, z informacją pierwotną
  ([R3.2](R3-verification-and-citation.md#R3.2)). Kod **nie sprawdza**, czy wpis czytał sam główny agent, ani ślepego
  odczytu.
- Dokument odczytany przez czytelników badania: jeden czytelnik → Możliwe; dwóch ślepych czytelników zgodnie →
  Prawdopodobne ([R3.5.1](R3-verification-and-citation.md#R3.5.1)). Stopnie pewności:
  [R3.1](R3-verification-and-citation.md#R3.1).
- **Dlaczego:** drugi czytelnik nie może znać oczekiwanej wartości, inaczej by ją „odczytał”. Powyżej Prawdopodobne
  dana idzie tylko wtedy, gdy dwa niezależne odczyty się zgadzają.
- **Obowiązuje od:** badanie 1.0.0; odczyt dokumentu przez czytelników badania 1.18.0

<!-- zdroj: research:assets/method/verify.md:1-18 · assets/method/core.md:8-12 · src/core/evidence.ts:55-68 checkStatus · src/core/readsync.ts readingGrade -->

<a id="R8.8"></a>
## R8.8 Odczytanie dokumentu z aplikacji

Zdjęcie, skan albo PDF dokumentu można z aplikacji dać do odczytania agentowi badania: transkrypcja, tłumaczenie
i objaśnienie. Czytać może jeden czytelnik albo dwóch niezależnych; dwóch się porównuje, a wynik pokazuje miejsca,
w których się różnią. Do drzewa z odczytanego nic się nie zapisuje bez potwierdzenia.

- **Pilnuje kod:**
  - wejście: zdjęcie, skan albo PDF; kilka plików to strony jednego dokumentu; najwyżej 10 stron i 50 MB na plik.
    Strona, której krótszy bok ma mniej niż 800 px, jest za mała i czytelnicy jej nie dostają;
  - **1 czytelnik** (szybciej, taniej) albo **2 niezależnych czytelników** (bardziej wiarygodnie, do zapisu
    w drzewie); wybór jest zapamiętywany;
  - każdy czytelnik zaczyna z czystym kontekstem i zwraca: transkrypcję dosłowną, tłumaczenie na język badania,
    objaśnienie (pojęcia, skróty, zawody, kontekst) oraz wymienione osoby, zdarzenia i relacje;
  - drugi czytelnik czyta na ślepo, pierwszego odczytu nie widzi. Porównuje się transkrypcje słowo po słowie, osoby
    według roli i kolejności, zdarzenia według rodzaju i kolejności. Gdzie się różnią, są warianty;
  - imię, które podaje czytelnik, musi stać w jego transkrypcji. Które osoby i miejsca drzewa pasują, ustala strom,
    nie czytelnik;
  - najwyżej 20 odczytów na godzinę i 60 na dzień (podnieść je może tylko człowiek); przy jednym drzewie czyta się
    jeden dokument naraz, a 3 kolejne czekają. W Archiwum Strom odczytu nie ma.
- **Wynik:**
  - oznaczenie zgodności: **2 czytelników, zgodność**, **2 czytelników, K miejsc się różni** albo **1 czytelnik**. Na
    podglądzie strony zielona ramka oznacza wybrany wpis, a bursztynowa miejsca, w których czytelnicy się różnią
    („czytelnicy się różnią: pierwszy czyta „a”, drugi „b””). W transkrypcji `[?]` oznacza niepewny odczyt, a `[...]`
    miejsce nieczytelne albo pominięte;
  - sekcje **Transkrypcja**, **Tłumaczenie**, **Objaśnienie**, **O dokumencie**, **Wspomniani**; **Kopiuj
    transkrypcję**;
  - dokument, którego nie da się odczytać, dostaje powód (rozmazany, odblask na tekście, zdjęcie pod kątem, brak
    części strony, za ciemny, za mały, na obrazie nie ma pisanego tekstu) i radę, jak zrobić lepsze zdjęcie;
  - wynik zostaje w historii odczytów (**Odczytane dokumenty**). Do drzewa trafia przez **Zaproponuj do drzewa…**.
- **Granice:**
  - bez wyboru czytają agent i model badania do skanów ([R8.3](#R8.3)); przy każdym czytelniku można wybrać agenta,
    model i dokładność ([R8.8.1](#R8.8.1)). Odczyt wlicza się do kosztu badania, także przerwany: to,
    co agent już odczytał, się wlicza;
  - okno można zamknąć, odczyt będzie trwał dalej, a wynik zostanie ogłoszony. Szacunek w oknie liczy około minuty na
    czytelnika, z Grokiem 4 minuty;
  - odczyt działa tylko z badaniem, które działa na tym komputerze i ma ustawionego agenta; inaczej okno mówi dlaczego
    (**Teraz niemożliwe: …**).
- **Obsługa:** aplikacja: **Badanie → Odczytaj dokument…**, w menu osoby **Odczytaj dokument dotyczący tej osoby…**;
  pliki przeciągnąć do okna albo **Wybierz pliki…**; opcjonalnie **Dokument dotyczy** (osoba) i **Notatka**;
  **Czytelnicy**; **Odczytaj**. Plik przeciągnięty do aplikacji oferuje **Odczytaj teraz** albo **Dodaj do
  materiałów** ([R11](R11-material-from-the-user.md)). Historia: **Badanie dla tego drzewa… → Odczytane dokumenty
  (N) ›**. Źródło, które ma już transkrypcję, można przeczytać ponownie z oryginału ([R8.8.2](#R8.8.2)).
- **Obowiązuje od:** aplikacja 3.14.0, badanie 1.18.0


- **Od aplikacji 3.25.0 i badania 1.29.0:** wybór czytelników (**Dostosuj odczyt**, [R8.8.1](#R8.8.1)), kto czytał,
  **Przeczytaj ponownie…** przy źródle ([R8.8.2](#R8.8.2)) i ustawienie **Zadanie z nowego odczytu**
  ([R8.8.3](#R8.8.3)).
- **Od aplikacji 3.27.0:** w oknie **Propozycja do drzewa** osoba, której dopasowanie do osoby drzewa opiera się
  tylko na imieniu lub nazwisku odczytanym niepewnie (oznaczonym „?”), jest wstępnie ustawiona na **Nie**; **Połącz**
  zostaje do wyboru. Dopasowanie, które niesie też data, rodzice, partner lub dziecko, oraz osoba zapisana wcześniej
  z tego samego wpisu zostają na **Połącz**.

<!-- zdroj: app:src/ui/read-document-ui.ts · strings.ts read.* (menu, menuPerson, r1/r1Sub, r2/r2Sub, agree, differ, oneReader, variantNote, scanHint, whyText, advice, cancelled, closeNote, limit, propose, historyRow) · research:src/core/document.ts DOC_PAGES=10, SMALL_PX=800 · src/core/live-read.ts READ_MAX_BYTES=50 MB, READ_QUEUE_MAX=3, read.app (20/h, 60/den) · src/commands/document.ts:463 · config model.vision · spec 059 K1.1 · 3.25.0/1.29.0: spec 059 K2.1, K3.1, K6, K7; app:6bd8609e strings.ts read.refine, read.sourceAgain · research:c2a690ea CHANGELOG.cs.md 1.29.0 · 3.27.0: app:2f3cc0c4 src/read-propose.ts matchRestsOnUncertain (reasons jen name, uncertain given/surname, ne fromEntry), initialPropose (skip) · strings.ts read.proposeTitle, choiceLink, choiceSkip · CHANGELOG.cs.md 3.27.0 · dirigent:prace/_drobnosti/app.md ř. 73 -->

<a id="R8.8.1"></a>
### R8.8.1 Czytelnicy: program, model i dokładność

Każdy czytelnik dokumentu może czytać innym agentem, modelem i z inną dokładnością. Bez wyboru czyta się według
ustawień badania. Wynik przy każdym odczycie mówi, kto czytał.

- **Pilnuje kod:**
  - **1 czytelnik** (szybciej) albo **2 czytelników** (pewniej, do drzewa). Dwóch czytelników czyta osobno; tam, gdzie
    ich teksty się różnią, może być błąd, i to miejsce jest pokazane do sprawdzenia;
  - w **Dostosuj odczyt** **Czytelnik 1** i **Czytelnik 2** mają każdy swój **Program** (agenta), **Model**
    i **Dokładność** (**szybka**, **zwykła**, **wyższa**, **najwyższa**), tylko z tego, co badanie oferuje na tym
    komputerze. Domyślnie jest **według ustawień agenta**; zmiana zostaje zapamiętana dla kolejnych odczytów
    (**Domyślne** przywraca ustawienia badania);
  - bez wyboru czyta model badania do skanów (`model.vision`), nigdy tańszy model;
  - drugi czytelnik czyta na ślepo i nie widzi pierwszego odczytu ([R3.5](R3-verification-and-citation.md#R3.5));
  - agent, który teraz nie może czytać (logowanie wygasło, limit wyczerpany), jest oferowany z powodem, a czytelnika
    z nim nie można uruchomić. Model, którego zainstalowany Codex nie zna, kończy odczyt jako niepowodzenie czytelnika
    z tym powodem.
- **Wynik:** **Czytał** przy każdym odczycie: agent · model · dokładność każdego czytelnika, w terminalu, w pliku
  odczytu i w aplikacji. Tekst jest według czytelnika 1; czytelnik 2 czytał niezależnie, dla kontroli, a jego cały
  tekst można pokazać (**Transkrypcja czytelnika**: **Czytelnik 1** / **Czytelnik 2**). Gdy obaj czytali tym samym
  programem, wynik to mówi.
- **Dlaczego:** dwóch czytelników tego samego modelu to słabszy dowód niż dwa różne modele: tam, gdzie się zgadzają,
  mogą się mylić tak samo. Tak mówi też zadanie z nowego odczytu ([R8.8.3](#R8.8.3)).
- **Obsługa:** aplikacja: **Odczytaj dokument…** i **Przeczytaj ponownie…** → **Czytelnicy** → **Dostosuj odczyt**.
  Terminal: `strom document read … --agent --model --effort` (pierwszy czytelnik) i `--blind-agent --blind-model
  --blind-effort` (czytelnik na ślepo), `--readers 2`.
- **Obowiązuje od:** badanie 1.29.0, aplikacja 3.25.0

<!-- zdroj: app:6bd8609e src/strings.ts read.c1/c1Sub/c2/c2Sub/readersWhy, refine, readerN, colProgram, colModel, colThorough, thorough.*, bySettings, changed, reset, agentWhyAuth/agentWhyLimit, downRow, readBy, readerView, whoLine, whoSame · research:c2a690ea strom help document read (--agent/--model/--effort, --blind-agent/--blind-model/--blind-effort: „default model.vision — never weaker for handwriting“) · assets/lang/cs.json read.source.same · CHANGELOG.cs.md 1.29.0 · spec 059 K1.2, K2.1, K2.2, K6.6 -->

<a id="R8.8.2"></a>
### R8.8.2 Ponowny odczyt źródła z oryginału

Źródło, które ma transkrypcję, można dać do ponownego odczytu z oryginału (skanu lub wycinka w badaniu), nie
z transkrypcji. Nowy odczyt porównuje się z transkrypcją miejsce po miejscu. Transkrypcja się przez to nie zmienia:
nowy odczyt zostaje zapisany przy źródle obok niej.

- **Pilnuje kod:**
  - tylko przy źródle, którego oryginał badanie ma na tym komputerze i które ma transkrypcję; inaczej aplikacja mówi
    dlaczego (**Badanie nie ma oryginału źródła na tym komputerze.**, **Źródło nie ma transkrypcji, z którą można
    porównać nowe czytanie.**). Na telefonie tylko zdanie, że ponowne czytanie działa w aplikacji na komputerze
    z badaniem;
  - czytelnicy nie widzą transkrypcji ani nazwisk. Dostają to, co badanie wie o akcie: rodzaj, język, datę i gdzie
    wpis stoi;
  - z transkrypcją porównuje się tylko wpis źródła, nie sąsiednie wpisy z brzegu wycinka. Za różnicę nie liczą się
    podpisy kolumn bez odpowiednika, nagłówki i uwagi badania oraz czytelnika w nawiasach, długie ſ wobec s, nieczytelne
    miejsce wobec niczego i słowa poza tym, co przeczytali obaj;
  - każde miejsce, w którym nowy odczyt różni się od transkrypcji, ma rodzaj:
    - **zmiana merytoryczna**: imię lub nazwisko, liczba, data, osoba albo słowo tam, gdzie transkrypcja ma
      `[...]`;
    - **drobiazg**: pisownia, skrót, interpunkcja, podpis, wielkie litery;
  - zmiana merytoryczna jest **pewna** tylko wtedy, gdy obaj czytelnicy przeczytali ją wobec transkrypcji tak samo,
    a nowy odczyt nie ma tam `[...]` ani `[?]`. Miejsce, w którym czytelnicy się różnią, jest niepewnością, nie zmianą
    transkrypcji. Przy jednym czytelniku niepewne miejsca to te, w których czytelnik nie był pewien (nowy odczyt ma tam
    `[...]` albo `[?]`), nie różnica dwóch czytelników;
  - miejsca, które już oceniło zadanie albo które człowiek zostawił lub odrzucił, nie ocenia się ponownie.
- **Wynik** (okno **Źródło przeczytane ponownie**): „Względem dotychczasowej transkrypcji N zmiany merytoryczne i K
  drobiazgów.” albo **Zgadza się z dotychczasową transkrypcją.**; **Czytelnicy są zgodni.** albo „Czytelnicy różnią się
  w N miejscach.”; w **Do sprawdzenia** grupy **Zmiany merytoryczne do sprawdzenia** (przy transkrypcji potwierdzonej
  przez człowieka **Zmiany merytoryczne do oceny**), **Niepewne – czytelnicy się różnią** (przy jednym czytelniku
  **Niepewne – czytelnik nie był pewien**), **Już ocenione w zadaniu T…**, **Już rozstrzygnięte: zostawione**
  i **Drobiazgi**. Do zadania trafiają same tylko pewne zmiany merytoryczne; niepewne miejsca tylko na prośbę
  człowieka ([R8.8.3](#R8.8.3)).
- **Granice:** potwierdzenie transkrypcji przez człowieka pozostaje. Nowy odczyt nigdy sam nie nadpisze transkrypcji
  ([R3.4.1](R3-verification-and-citation.md#R3.4.1)).
- **Obsługa:** aplikacja: podgląd źródła → **Przeczytaj ponownie…** (oznaczenie AI), z wyborem czytelników
  ([R8.8.1](#R8.8.1)); przy źródle potem wiersz nowego odczytu z **Wynik ›**. Terminal:
  `strom document read --source S… [--clip …]`, `strom source show S…`.
- **Dlaczego:** po czasie transkrypcję można sprawdzić innym czytelnikiem, z oryginału. Zgodność wspiera dotychczasową
  transkrypcję; różnica jest podpowiedzią do sprawdzenia, nie nową transkrypcją.
- **Obowiązuje od:** badanie 1.29.0, aplikacja 3.25.0

<!-- zdroj: research:c2a690ea src/core/sourceread.ts (porovnání, druhy míst, sure, judged) · strom help document read --source · CHANGELOG.cs.md 1.29.0 · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 1, Tabulka scénářů) · app:6bd8609e src/ui/read-source-ui.ts (nabídka jen s originálem, AI) · strings.ts read.sourceAgain, sourceAgainTitle, againPhone, srcWhy.*, resultSource, vSrc, vSrcSame, vDis, check, gMajor, gMajorPerson, gUnsure, gJudged, gKept, gMinor, vk.*, againResultLink, keepConfirm · spec 059 K3.1–K3.3, K6.2, K6.3 · dirigent:test ověření aplikace 6bd8609e · jeden čtenář: research:4895d0f0 src/core/sourceread.ts surely (jeden čtenář: nejisté jen `[...]`, `[?]`) · app:7327b758 strings.ts read.gUnsure1, vk.number („číslo“) · dirigent:test/vysledek-1107-nejista-mista.md -->

<a id="R8.8.3"></a>
### R8.8.3 Zadanie z nowego odczytu

Zadanie ze źródła przeczytanego ponownie powstaje samo tylko z pewnej zmiany merytorycznej, której nikt jeszcze nie
ocenił. Drobiazgi nigdy nie tworzą zadania, a niepewne miejsca nie tworzą go same: agentowi można je przekazać tylko na
prośbę człowieka. Czy zadanie z pewnej zmiany merytorycznej powstanie od razu, czy zdecyduje człowiek, wyznacza
ustawienie **Zadanie z nowego odczytu**.

- **Ustawienie** (`read.sourceTask`, dla każdego drzewa):
  - **Pytaj** (`ask`, domyślnie): zadanie nie powstaje samo. Odczyt zostaje przy źródle jako niesprawdzony, dopóki
    człowiek nie zdecyduje;
  - **Zawsze twórz** (`always`): zadanie powstaje od razu; przy transkrypcji potwierdzonej przez człowieka propozycja
    brzmienia dla człowieka;
  - **Nie twórz** (`never`): zadanie nie powstaje samo; odczyt czeka przy źródle, a człowiek może zdecydować tak samo
    jak przy **Pytaj**.
- **Wybory** (stopka okna **Źródło przeczytane ponownie**, przy źródle **Zdecyduj ▸**):
  - transkrypcja, której człowiek nie potwierdził: **Zadanie dla agenta** → **Sprawdź teraz z agentem** (zadanie
    i od razu rozmowa z agentem w terminalu) albo **Dodaj do kolejki agenta** (zadanie na początku kolejki,
    priorytet 3); **Bez zadania** → **Tylko zapisz** (zadanie nie powstaje, źródło już nie pyta, a te same miejsca nie
    są oferowane ponownie; przy źródle można potem jeszcze wybrać **Przekaż agentowi…**);
  - transkrypcja potwierdzona przez człowieka: **Zadanie dla człowieka** → **Odłóż do oceny** (propozycja brzmienia dla
    człowieka; agent nad nią nie pracuje, [R3.4.1](R3-verification-and-citation.md#R3.4.1)) albo **Tylko zapisz**.
    Zadanie dla agenta nigdy tu nie powstaje;
  - źródło z niezakończonym zadaniem: **Dopisz do T… i sprawdź teraz**, **Dopisz do zadania T…**. Jedno źródło ma
    naraz jedno zadanie swoich odczytów: nowe miejsca dopisują się do niego, żadne dwa razy.
- **Niepewne miejsca na prośbę:**
  - oferowane tylko przy odczycie, który nie ma żadnej pewnej zmiany merytorycznej do rozstrzygnięcia, ale ma niepewne
    miejsca, które nie są drobiazgiem i których nie oceniło jeszcze żadne zadanie. W stopce okna **Źródło przeczytane
    ponownie** wybór stoi obok **Zamknij** (to zostaje głównym przyciskiem), przy źródle w wierszu nowego odczytu
    (**Przekaż agentowi… ▸**, przy potwierdzonej transkrypcji **Odłóż do oceny… ▸**). Jest oferowany przy każdym
    ustawieniu, także przy **Nie twórz**; na telefonie nie. Tylko drobiazgi albo miejsca już ocenione → wybór nie jest
    oferowany;
  - transkrypcja, której człowiek nie potwierdził: **Przekaż agentowi do oceny** (oznaczenie AI) → zadanie dla agenta
    w kolejce (priorytet 3) albo miejsca dopisują się do niezakończonego zadania źródła. Czytelnicy czytali na ślepo,
    bez transkrypcji i nazwisk ([R8.8.2](#R8.8.2)); miejsca ocenia dopiero agent, na skanie ze wszystkim, co badanie
    wie o osobach, miejscach i datach aktu. Gdzie skan pokazuje to pewnie, poprawia transkrypcję i podaje powód;
    gdzie indziej transkrypcję zostawia i przy źródle zapisuje notatkę, co obejrzał i dlaczego miejsce pozostaje
    niepewne. Człowieka o nic nie pyta;
  - transkrypcja potwierdzona przez człowieka: **Odłóż do oceny** → zadanie dla człowieka z propozycją brzmienia tylko
    z niepewnych miejsc, które nowy odczyt odczytał (nie `[...]`, `[?]`); agent nie zmienia transkrypcji
    ([R3.4.1](R3-verification-and-citation.md#R3.4.1)). Gdy nowy odczyt odczytał tylko nieczytelne miejsca, wybór nie
    jest oferowany;
  - zadanie z niepewnych miejsc powstaje tylko po kliknięciu, nigdy samo, nawet przy **Zawsze twórz**. Miejsc, które
    potem trzyma zadanie, nie oferuje się ponownie przy kolejnych odczytach.
- **Pilnuje kod:**
  - decyduje tylko człowiek: w aplikacji albo przy swoim terminalu. `strom document read --source` przy terminalu
    człowieka pyta od razu (**Przejrzeć to teraz z agentem**, **Dodać to do kolejki jako zadanie**, **Tylko zachować
    odczyt**, przy potwierdzonej transkrypcji **Odłożyć do oceny**); bez wyboru niczego nie rozstrzyga, a później
    rozstrzyga `strom source reading S…`. Agent nie może decydować: mówi człowiekowi, co czeka;
  - niepewne miejsca przekazuje tylko człowiek: `strom source reading S… --take queue --unsure` (przy potwierdzonej
    transkrypcji `--take review --unsure`); inaczej `--unsure` nie działa. Odczyt, który ma pewną zmianę merytoryczną
    do rozstrzygnięcia, zostaje z `--unsure` odrzucony: rozstrzyga się go bez tej opcji, a niepewne miejsca idą razem
    z nią. `strom source show S…` mówi, kiedy miejsca można przekazać;
  - zadanie podaje, kto czytał (agent · model · dokładność każdego czytelnika), że dwóch czytelników tego samego modelu
    to słabszy dowód i że nowy odczyt jest tylko podpowiedzią ([R3.4.1](R3-verification-and-citation.md#R3.4.1)).
    Zmiany merytoryczne są w powodzie zadania pierwsze;
  - aplikacja starsza niż 3.25.0 nie ma wyboru: przy niepotwierdzonej transkrypcji od razu powstaje zadanie dla agenta,
    przy potwierdzonej propozycja brzmienia dla człowieka.
- **Stan przy źródle** (podgląd źródła): **Nowszy odczyt z … się różni (N zmiany merytoryczne), niesprawdzony.**,
  **… zapisany, zadanie nie powstało.**, **…: zadanie T… dla agenta (w kolejce).**, **…: zadanie do oceny T….**,
  **…: różnią się tylko drobiazgi.**, **…: czytelnicy różnią się w …, transkrypcja się nie zmienia.** (przy jednym
  czytelniku **…: czytelnik nie był pewien w …, transkrypcja się nie zmienia.**) Po utworzeniu zadania **Otwórz
  zadanie T…** ([S4.5.3](S4-research-from-the-app.md#S4.5.3)).
- **Obsługa:** aplikacja: **Badanie → Więcej → Badanie dla tego drzewa… → Czytanie dokumentów → Zadanie z nowego
  odczytu** (zapisuje się do badania i dotyczy też odczytów uruchomionych w terminalu). Terminal:
  `strom config set read.sourceTask ask|always|never --for-tree`, jednorazowo `strom document read --source S…
  --source-task …`, `strom source reading S… [--take now|queue|keep|review] [--unsure]`, `strom source show S…`.
- **Dlaczego:** zadanie kosztuje pracę agenta, która zużywa subskrypcję; drobiazg ani niepewność nie zmieniają
  transkrypcji, a tego, co już ocenione, nie należy oceniać ponownie. Niepewne miejsca można mimo to ocenić:
  czytelnicy ich nie rozstrzygną, bo czytają na ślepo, ale agent może je ocenić z kontekstem badania, gdy człowiek
  o to poprosi.
- **Obowiązuje od:** badanie 1.29.0, aplikacja 3.25.0

<!-- zdroj: research:c2a690ea src/core/config.ts:310 read.sourceTask (ask|always|never, tree) · src/core/sourceread.ts:293-302, :438, :600-617 · src/commands/source-reading.ts · strom help source reading (--take now|queue|keep|review, priorita 3) · strom help document read --source-task · assets/lang/cs.json ui.reading.*, read.source.why/same · src/core/live.ts:124-138 taskChoice, POST sourceTask · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 2–4, Tabulka scénářů) · app:6bd8609e strings.ts treeResearch.readGroup/readTask/readTaskAsk/readTaskAlways/readTaskNever/rtOk, read.tAgent, tNow, tQueue, tNone, tSave, tPerson, tReview, tAppendNow, tAppendQueue, sUnchecked, sSaved, sTaskQueued, sTaskPerson, sMinor, sUnsure, sDecide, sGiveAgent, openTaskN · src/ui/read-task-setting-view.ts · dirigent:test ověření aplikace 6bd8609e · spec 059 K3.2, spec 065 K2.3 · nejistá místa na žádost: spec 059 P8 K8.1–K8.5 · research:4895d0f0 src/core/sourceread.ts unsureOffered, wordingOf, decideReading (unsure, read.decide.sure/nothing/noproposal), handOver priorita 3 · src/commands/source-reading.ts --unsure · assets/lang/cs.json read.source.unsure.* · CHANGELOG.cs.md 1.29.0 · app:docs/ZADANI_VYZKUM_cteni-vysledek.md „Odpověď výzkumu: nejistá místa na žádost“ · app:7327b758 src/ui/read-task-view.ts readTaskUnsureShown (B, D, jen počítač), unsureChoiceHtml · src/ui/read-source-state-view.ts · strings.ts read.close, tUnsureQueue, tUnsureQueueSub, tReview, tUnsureReviewSub, sGiveAgent, sReviewGive, sUnsure · dirigent:test/vysledek-1107-nejista-mista.md (i doověření N1) -->

<a id="R8.9"></a>
## R8.9 Kto czyta: przegląd i przykład jednego wpisu

Wpis w skanie czyta kilku czytelników, każdy z innym zadaniem i innym widokiem. Żaden czytelnik nie zapisuje niczego
do drzewa: to, co przeczyta, jest materiałem dla głównego agenta i dla człowieka.

| Kto czyta | Co widzi | Co zwraca | Zasada |
|---|---|---|---|
| czytelnicy księgi (`strom read`) | partię widoków i całe pytanie; nic więcej z badania | krótki raport: wpisy do pytania, przy imionach i nazwiskach pewność w procentach | [R8.3](#R8.3) |
| główny agent | wycinek wpisu w pełnej rozdzielczości i wszystko, co wie badanie | źródło z transkrypcją i dane z tego, co odczytano pewnie | [R8.5](#R8.5), [R8.6](#R8.6) |
| ślepy drugi czytelnik (`strom read --blind --crop`) | tylko wycinek jednej komórki; nie oczekiwaną wartość, imię, miejsce ani dlaczego to ważne | swój odczyt tej komórki | [R3.5](R3-verification-and-citation.md#R3.5) |
| czytelnicy dokumentu z aplikacji (**1 czytelnik** albo **2 czytelników**) | strony dokumentu; drugi czytelnik nie widzi odczytu pierwszego | transkrypcję, tłumaczenie, objaśnienie i wymienione osoby | [R8.8](#R8.8), [R8.8.1](#R8.8.1) |
| czytelnicy **Przeczytaj ponownie…** (1 albo 2) | oryginał wpisu i to, co badanie wie o akcie (rodzaj, język, datę, gdzie wpis stoi); nie transkrypcję ani nazwiska | nowy odczyt, porównany z transkrypcją miejsce po miejscu | [R8.8.2](#R8.8.2) |

- **Pilnuje kod:**
  - **ślepy** oznacza: czytelnik nie dostaje tego, czego się od niego oczekuje. Ślepy drugi czytelnik dostaje tylko
    wycinek, drugi czytelnik dokumentu nie widzi pierwszego odczytu, a czytelnicy **Przeczytaj ponownie…** nie widzą
    transkrypcji ani nazwisk;
  - czytelnicy czytają modelem badania do pisma (`model.vision`), nigdy słabszym. Przy odczycie dokumentu i przy
    **Przeczytaj ponownie…** każdy czytelnik ma swój program, model i dokładność, a wynik przy odczycie mówi, kto
    czytał ([R8.8.1](#R8.8.1));
  - gdzie dwaj czytelnicy się nie zgadzają, miejsce jest niepewne, a nie jest poprawką transkrypcji
    ([R8.8.2](#R8.8.2)).
- **Tylko metodyka:** wpis, który będzie cytowany, główny agent czyta sam, z wycinka ([R8.5](#R8.5)); trudna komórka
  dostaje ślepy drugi odczyt ([R3.5](R3-verification-and-citation.md#R3.5)).
- **Dlaczego:** kto zna oczekiwaną wartość, ma skłonność ją „przeczytać”. Dwaj niezależni czytelnicy, najlepiej dwóch
  różnych modeli, pokazują miejsca, w których pismo da się odczytać na dwa sposoby.
- **Obowiązuje od:** badanie 1.0.0 (czytelnicy księgi, ślepy drugi odczyt); odczyt dokumentu badanie 1.18.0; wybór
  czytelników i **Przeczytaj ponownie…** badanie 1.29.0, aplikacja 3.25.0

**Przykład jednego wpisu (wymyślony).** Źródło to wpis chrztu z roku 1843. Dotychczasową transkrypcję napisało
badanie, a człowiek jej nie potwierdził: „Dne 3. března 1843 pokřtěn Jan; otec Václav Horák, chalupník v Javorné
č. 12; matka Marie roz. Vlková.” Datę chrztu Jana Horáka wpisał do drzewa człowiek w aplikacji.

1. **Przeczytaj ponownie…** przy źródle, **2 czytelników**: Czytelnik 1 Claude Code, Czytelnik 2 Codex, każdy ze
   swoim modelem i dokładnością. Obaj dostają tylko oryginał wpisu i to, co badanie wie o akcie (rodzaj, język, datę,
   gdzie wpis stoi); transkrypcji ani nazwisk nie widzą.
2. Czytelnicy odczytują:
   - Czytelnik 1: „… 5. března 1843 … v Javorné č. 17; matka Marie rozená Vlková.”
   - Czytelnik 2: „… 5. března 1843 … v Javorné č. 12; matka Marie rozená Vlková.”
3. Porównanie z transkrypcją:
   - dzień **5.** zamiast **3.**: obaj czytelnicy czytają tak samo i pewnie → pewna zmiana merytoryczna;
   - numer domu: Czytelnik 1 czyta **17**, Czytelnik 2 **12** → czytelnicy się nie zgodzili; miejsce jest niepewne,
     a nie jest zmianą transkrypcji;
   - „roz.” wobec „rozená”: skrót → drobiazg.
4. W **Do sprawdzenia** stoją: **Zmiany merytoryczne do sprawdzenia** (dzień chrztu), **Niepewne – czytelnicy się
   różnią** (numer domu) i **Drobiazgi** („roz.”). Transkrypcja się nie zmieniła; nowy odczyt został przy źródle.
5. Przy ustawieniu **Pytaj** decyduje człowiek: **Zadanie dla agenta** → **Dodaj do kolejki agenta**. Do zadania trafia
   pewna zmiana merytoryczna, a z nią także niepewne miejsce; drobiazg sam zadania nie tworzy ([R8.8.3](#R8.8.3)).
6. Agent w zadaniu ogląda wpis na skanie ze wszystkim, co badanie wie o ludziach i miejscach:
   - dzień jest na skanie na pewno **5.**: poprawia transkrypcję i pisze powód;
   - numer domu na skanie pewny nie jest: transkrypcję zostawia i przy źródle pisze notatkę, co obejrzał i dlaczego
     miejsce pozostaje niepewne;
   - datę chrztu w drzewie wpisał człowiek: agent jej nie zmieni, tylko zaproponuje 5 marca 1843. Aplikacja przy
     danej pokaże **Badania proponują zmienić dane wpisane przez człowieka** i **Sprzeczność ›**; decyduje człowiek
     ([S6.3](S6-tree-from-another-program.md#S6.3)).

Daną z drzewa innego programu agent mógłby zmienić według cytowanego aktu; wartość z drzewa zostałaby przy danej do
przywrócenia ([S6.3](S6-tree-from-another-program.md#S6.3)).

<!-- zdroj: research:v1.30.0 src/core/sourceread.ts placesOf (fresh, ordered: jistá věcná změna první, s ní ostatní neposouzená místa), decideReading, review · assets/lang/cs.json read.source.why, read.source.unsure.why · src/commands/read.ts --blind --crop · assets/method/verify.md · app:1c9b2392 strings.ts read.check „Co ověřit“, gMajor, gUnsure, gMinor, tAgent, tQueue, origin.proposeUser, origin.conflictOpen · spec 059 ukoly U6 (nové 8. 11.: oddíl se čtenáři a příkladem, jen text) -->
