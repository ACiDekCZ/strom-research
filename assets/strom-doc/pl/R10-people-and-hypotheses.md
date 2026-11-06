<a id="R10"></a>
# R10 Osoby: identyfikacja, imiona i hipotezy

Jak badanie rozpoznaje, że wpis należy do poszukiwanej osoby, co robi z dwoma wpisami jednej osoby, jak prowadzi
konkurujące wyjaśnienia (hipotezy) i jak zapisuje imiona i nazwiska oraz osoby, które wpis wymienia. Opisuje badanie
1.27.0 i aplikację Strom 3.23.0; zmiany z nowszej wersji mają przy sobie jej numer. Przy zasadach rozróżnia się, czego **pilnuje kod**, a co jest tylko **zasadą
metodyki**.

<a id="R10.1"></a>
## R10.1 Imiennik to nie poszukiwana osoba

Wpis należy do poszukiwanej osoby tylko wtedy, gdy wskazuje ją coś więcej niż imię i nazwisko. Dwie osoby o tym samym
imieniu i nazwisku w jednej wsi to rzecz zwyczajna.

- **Tylko metodyka:**
  - osobę wyznacza rok, miejsce, numer domu, zawód, mąż lub żona i rodzice. Większość przypadków rozstrzyga nazwisko
    rodowe matki;
  - dwa wpisy, które temu samemu imieniu i nazwisku dają innych rodziców (inną matkę), to **dwie osoby**, także w tym
    samym domu i z tym samym imieniem ojca. Różnicy nie tłumaczy się błędem pisarza i nie rozstrzyga się jej większością
    ([R5.1.1](R5-conflicts.md#R5.1.1));
  - poszukiwana osoba to ta, którą wymienia wpis o jej własnej rodzinie. Pozostałe to osobne osoby;
    „ta sama kobieta?” to hipoteza ([R10.3](#R10.3)) z tym, co by ją rozstrzygnęło;
  - źródło spoza ksiąg metrykalnych (gazeta, księga adresowa, internet): wystarczy, gdy zgadza się imię i nazwisko,
    miejsce i czas **oraz jeszcze jedna dana** (dom, zawód, mąż lub żona, wiek, krewny). W przeciwnym razie hipoteza.
- **Dlaczego:** dwie osoby o tym samym imieniu i nazwisku w jednej wsi to rzecz zwyczajna; nazwisko rodowe matki
  rozstrzyga większość przypadków (metodyka).
- **Obsługa:** terminal (agent). Aplikacja pokazuje hipotezy przy osobie w **Co wie badanie → Hipotezy**
  ([S3.5](S3-what-the-research-knows.md#S3.5)).
- **Obowiązuje od:** badanie 1.0.0; źródło spoza ksiąg metrykalnych 1.10.0

<!-- zdroj: research:assets/method/core.md "A namesake is not your person" · research:assets/method/link.md krok 4 "Identify" · research:assets/method/enrich.md "Your person, not a namesake" (od v1.10.0) -->

<a id="R10.2"></a>
## R10.2 Dwa wpisy jednej osoby: scalenie

Gdy okaże się, że dwa wpisy w badaniu to jedna osoba, scala się je. Drugi wpis nie znika: zostaje wycofany z notatką,
z którą osobą go scalono.

- **Pilnuje kod** (`strom person merge <zůstává> <druhý> --reason "…"`):
  - scalenie wymaga powodu;
  - imiona i nazwiska, dane, notatki, rodziny i wszystkie odwołania (zadania, hipotezy, chrzestni…) przechodzą na
    osobę, która zostaje;
  - dane się nie scalają: dwa urodzenia po scaleniu to nadal dwa urodzenia. strom zwraca uwagę, które dane są teraz
    podwójnie; lepszą zachowuje się z cytatem, drugą wycofuje się z powodem;
  - odmawia scalenia osób różnej płci (gdy żadna nie ma płci nieznanej), partnerów jednej rodziny, przodka
    z potomkiem i osób z **innymi rodzicami**. Gdy to ci sami rodzice w dwóch wpisach, najpierw scala się rodziny
    (`strom family merge`).
- **Tylko metodyka:** osobę z przejętego drzewa genealogicznego, która jest już w badaniu badana, scala się **do**
  badanej osoby; ta zachowuje swoje dowody ([R11.3](R11-material-from-the-user.md#R11.3)).
- **Dlaczego:** strom nigdy nie wybiera po cichu między dwiema danymi: która obowiązuje, rozstrzyga dowód. Drugą
  wycofuje się z powodem, więc zostaje widoczne, co gdzie stało.
- **Obsługa:** terminal: `strom person merge`, `strom family merge`. Możliwe duplikaty w drzewie zgłasza aplikacja
  w Kontroli drzewa ([A5.6](A5-tree-check.md#A5.6)).
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:src/commands/people.ts person merge (description, SINGLE_KINDS) · research:src/core (mergePersons: merge.needs-reason, sex, partners, ancestor, different birth parents) · research:assets/method/intake.md krok 5 -->

<a id="R10.3"></a>
## R10.3 Hipoteza: konkurujące wyjaśnienia

Gdy akty dopuszczają więcej wyjaśnień (czyje to dziecko, czy to dwa wpisy jednej osoby, czy to małżeństwo), badanie
nie wybiera po cichu. Zapisuje hipotezę: pytanie i jego wersje A, B, C… z tym, co przemawia za każdą, a co przeciw.

- **Pilnuje kod:**
  - hipoteza ma co najmniej dwie wersje i dotyczy co najmniej jednej osoby lub wpisu (`--about`);
  - litera wersji należy do jednego twierdzenia na zawsze. Nowe twierdzenie dostaje kolejną wolną literę, użytej
    litery nie używa się ponownie. Wersję można dodać tylko do otwartej hipotezy;
  - wersja może powiedzieć, co by połączyła: dziecko z rodziną lub rodzicami, dwa wpisy jednej osoby, parę,
    rodzeństwo. W drzewie nic się przez to nie łączy; połączenie zapisuje się dopiero po rozstrzygnięciu hipotezy.
- **Tylko metodyka:** to, co by hipotezę rozstrzygnęło, jest zadaniem (`strom task add … --about H…`), a nie dygresją
  w innym zadaniu. Połączenie wersji zapisuje się tylko wtedy, gdy twierdzenie mówi o nim bez wątpliwości; imiennik
  zostaje poza nim.
- **Obsługa:** terminal: `strom hypothesis add "<otázka>" --about P… --variant "…" --variant "…"`,
  `hypothesis argue`, `hypothesis variant`, `hypothesis link`, `hypothesis show`, `hypothesis list`. Aplikacja pokazuje
  wersje i pozwala je narysować w drzewie tylko w widoku ([S3.5](S3-what-the-research-knows.md#S3.5),
  [S3.5.1](S3-what-the-research-knows.md#S3.5.1)).
- **Obowiązuje od:** badanie 1.0.0; połączenia wersji i nowa wersja otwartej hipotezy 1.14.0

<!-- zdroj: research:src/commands/analysis.ts hypothesis add ("at least two --variant", "--about is required"), variant (VARIANT_LABEL, nextLabel, "a letter is never used twice"), link (description) · research:assets/method/core.md "Say what a hypothesis would connect" -->

<a id="R10.3.1"></a>
### R10.3.1 Rozstrzygnięcie hipotezy

Hipotezę rozstrzyga się na rzecz jednej wersji albo porzuca, gdy żadnej nie da się rozstrzygnąć. Kto ją rozstrzyga,
określa wybór badania ([R10.3.2](#R10.3.2)): domyślnie **Rozstrzyga człowiek** (agent tylko proponuje
rozstrzygnięcie) albo **Rozstrzyga AI** (agent rozstrzyga sam, tylko na podstawie cytowanego aktu). Aplikacja nie
pozwala rozstrzygnąć hipotezy, odsyła do badania.

- **Pilnuje kod:**
  - przy **Rozstrzyga człowiek** rozstrzygnięcie to krok człowieka. Gdy `strom hypothesis decide` uruchomi agent
    (także wewnątrz `strom batch`), strom je odrzuca;
  - agent proponuje rozstrzygnięcie: wersję i tekst rozstrzygnięcia (`strom hypothesis propose`) albo porzucenie
    (`--abandon`). Nowa propozycja zastępuje poprzednią. Na odpowiedź się nie czeka, praca idzie dalej;
  - propozycja czeka w **Co czeka** w grupie **Hipotezy do rozstrzygnięcia** ([R6.3.4](R6-awaiting-action.md#R6.3.4)):
    człowiek rozstrzyga zgodnie z propozycją, inaczej (inna wersja albo żadna, z powodem) albo zostawia hipotezę bez
    zmian. Nieprzyjęta propozycja zostaje w notatce hipotezy;
  - przy **Rozstrzyga człowiek** w tej samej grupie czeka też otwarta hipoteza bez propozycji: człowiek rozstrzyga ją
    sam (wersja albo żadna, z tekstem rozstrzygnięcia) albo zostawia ją otwartą. Hipoteza zostawiona otwarta pojawi
    się w Co czeka znowu, gdy agent zaproponuje, jak ją rozstrzygnąć;
  - rozstrzygnięcie i propozycja wymagają tekstu rozstrzygnięcia (`--decision`); porzucenie to `--abandon`;
  - hipotezę, której wersje mówią, co by połączyły, rozstrzyga się i proponuje tylko z podaną wersją (`--variant B`).
    Bez niej strom odrzuca i niczego nie zapisuje;
  - rozstrzygnąć ponownie (także ponownie zaproponować) można tylko z powodem (`--reason`). Poprzednie rozstrzygnięcie
    zostaje w notatce hipotezy, także z tym, że rozstrzygnął je agent. Rozstrzygnięta i porzucona hipoteza oferuje
    w menu **Zmienić rozstrzygnięcie**;
  - to, co łączy rozstrzygnięcie człowieka, oraz źródła, które hipoteza wymienia, a których nie cytuje żadna dana jej
    osób, agent dostaje na początku następnej pracy jako pierwsze zadanie do zapisania w drzewie.
- **Tylko metodyka:** agent proponuje rozstrzygnięcie, gdy akty wskazują na jedną wersję, i mówi to człowiekowi
  jednym zdaniem. Rozstrzygniętą hipotezę, którą obali nowy akt, agent proponuje ponownie z powodem. To, co agent
  wstrzymał, dopóki osoba była tylko hipotezą, zapisuje przy osobie, gdy hipoteza jest rozstrzygnięta.
- **Dlaczego:** nowe rozstrzygnięcie wymaga powodu, bo rozstrzygnięcia zmieniają się jawnie: poprzednie zostaje
  czytelne, a nowe mówi, co je zmieniło (zwykle nowy akt).
- **Obsługa:** terminal: menu `strom` → **Co czeka** → **Hipotezy do rozstrzygnięcia** → **Rozstrzygnąć zgodnie
  z propozycją**, **Rozstrzygnąć inaczej**, **Zostawić bez zmian (propozycja nieprzyjęta)**; przy otwartej hipotezie
  bez propozycji **Rozstrzygnąć**, **Zostawić otwartą**; przy rozstrzygniętej albo porzuconej **Zmienić
  rozstrzygnięcie** (tekst i powód obowiązkowe). Ten sam ekran jest w przeglądzie osoby: **Rozszerz badanie** →
  **Przegląd osoby** → **Hipotezy o osobie (n)**. Poleceniem `strom hypothesis decide H… --proposed`, `--keep-open`
  albo `--variant B --decision "…"` (ponownie z `--reason "…"`). Agent: `strom hypothesis propose H… --variant B
  --decision "…"`. Aplikacja: **Co wie badanie** → hipoteza → **Rozstrzygnij w badaniu**, przy rozstrzygniętej
  **Zmień w badaniu** ([S3.5](S3-what-the-research-knows.md#S3.5)).
- **Obowiązuje od:** badanie 1.0.0; wypis niezapisanych źródeł 1.12.0
- **Od badania 1.28.0:** rozstrzyga tylko człowiek, agent proponuje; podanej wersji pilnuje kod (wcześniej tylko
  metodyka). Hipotezy, które wcześniej rozstrzygnął agent, zostają takie, jakie były.
- **Od badania 1.29.0:** kto rozstrzyga, jest wyborem badania ([R10.3.2](#R10.3.2)). Co czeka oferuje też otwarte
  hipotezy bez propozycji (**Rozstrzygnąć**, **Zostawić otwartą**) i menu **Zmienić rozstrzygnięcie**. Do 1.28.0
  otwartej hipotezy bez propozycji w Co czeka nie było i rozstrzygało się ją tylko poleceniem `strom hypothesis
  decide`.
- **Od aplikacji 3.25.0:** **Rozstrzygnij w badaniu** i **Zmień w badaniu** w **Co wie badanie**, gdzie oferuje je
  badanie na tym komputerze.

<!-- zdroj: research:src/commands/analysis.ts hypothesis propose, hypothesis decide (person: …, agentMay, --proposed, --keep-open bez návrhu → leftOpen, againNeedsReason, decidedVariant, "earlier … by the agent") · src/cli/main.ts:288 def.person && isAgent && !def.agentMay · src/commands/batch.ts (def.agentMay) · src/core/waiting.ts (hypotheses, hypothesesOpen, TERMINAL_ONLY) · src/cli/menu-waiting.ts decideHypothesis (proposed / open / decided: ui.wait.hypothesis.change) · src/cli/menu-research.ts:532 ui.review.hypotheses · src/core/hypolinks.ts decidedToRecord, sourcesNotOnPeople · src/brief/brief.ts "Decided by the user — record it on the tree first" · assets/lang/cs.json wait.group.hypotheses, ui.wait.hypothesis.*, ui.review.hypotheses · research:assets/method/core.md "The user decides a hypothesis" · assets/method/recording.md "is proposed again" · CHANGELOG.cs.md 1.28.0, 1.29.0 · research 1.28.0 = commit 94a593db · app:src/strings.ts research.decideInResearch, research.hypoChange · CHANGELOG.cs.md 3.25.0 -->

<a id="R10.3.2"></a>
### R10.3.2 Kto rozstrzyga hipotezy: człowiek czy AI

Wybór badania **Kto rozstrzyga hipotezy** określa, kto rozstrzyga hipotezę. **Rozstrzyga człowiek** jest domyślne:
agent tylko proponuje, a rozstrzygnięcie czeka w **Co czeka**. **Rozstrzyga AI**: agent rozstrzyga sam, gdy tylko
cytowany akt wskazuje na jedną wersję; jego rozstrzygnięcie jest oznaczone, a człowiek może je w każdej chwili
zmienić.

- **Pilnuje kod:**
  - domyślne jest **Rozstrzyga człowiek**, także przy badaniu bez tego wyboru (założonym wcześniej). Przełączenie nie
    zmienia już rozstrzygniętych hipotez;
  - **Rozstrzyga AI** włącza tylko człowiek w terminalu: pytanie wyjaśnia, co to znaczy, i wymaga drugiego tak.
    Agentowi strom włączenia odmawia. Powrót do **Rozstrzyga człowiek** jest możliwy w każdej chwili, bez
    potwierdzenia;
  - wybór obowiązuje dla badań na tym komputerze. Badanie może mieć własny (`--for-tree`); wybór z aplikacji zapisuje
    się tylko temu badaniu;
  - agent rozstrzyga tylko wersję, którą wspiera cytowane źródło badania (S…). Bez niego strom odrzuca i oferuje
    propozycję (`strom hypothesis propose`);
  - wersję, która dołączyłaby do drzewa gałąź 10 i więcej osób spoza drzewa, agent rozstrzyga tylko z dwoma
    cytowanymi źródłami i bez zastrzeżenia przeciw niej; inaczej tylko ją proponuje;
  - rozstrzygnięcia człowieka agent nigdy nie zmienia; gdy obali je nowy akt, proponuje je ponownie
    ([R10.3.1](#R10.3.1));
  - hipotezę, której nie da się rozstrzygnąć, agent porzuca z tekstem rozstrzygnięcia;
  - rozstrzygnięcie agenta niesie oznaczenie i dzień. Terminal: przy hipotezie **Rozstrzygnął agent (dzień).**,
    w przeglądzie zmian „H… rozstrzygnął agent: …” i „H… odłożył agent: …”. Aplikacja: **Co wie badanie** →
    **rozstrzygnął agent** z dniem i uzasadnieniem;
  - to, co łączy rozstrzygnięcie agenta, agent zapisuje w drzewie od razu;
  - gdy rozstrzygnięcie agenta zmieni człowiek, oznaczenie znika, a poprzednie rozstrzygnięcie zostaje w notatce
    hipotezy;
  - w Archiwum Strom tego wyboru nie ma.
- **Tylko metodyka:** agent mówi człowiekowi jednym zdaniem, co rozstrzygnął.
- **Obsługa:** terminal: ustawienia początkowe `strom setup`, krok **Kto rozstrzyga hipotezy – niepewne powiązania
  osób?** (tylko gdy ustawienia robi człowiek w terminalu; bez terminalu pytania nie ma i obowiązuje **Rozstrzyga
  człowiek**); menu **Ustawienia** → **Język, agent, model, co agent może sam, opowieści… (kreator ustawień)** →
  **Kto rozstrzyga hipotezy: …**; `strom config set hypotheses.decide person|agent [--for-tree]`, obowiązującą
  wartość pokazuje `strom config where`. Aplikacja: **Badanie** → **Więcej** → **Badanie dla tego drzewa…** → **Kto
  rozstrzyga hipotezy**: **Rozstrzyga człowiek** zapisuje się do badania od razu, **Rozstrzyga AI** potwierdza badanie
  w terminalu (**Potwierdź w badaniu**). Wiersz pojawia się tylko z badaniem, które zna ten wybór.
- **Obowiązuje od:** badanie 1.29.0, aplikacja 3.25.0

<!-- zdroj: research:src/core/config.ts:301 hypotheses.decide (choices person|agent, tree: true), hypothesesDecide · src/commands/setup.ts:1203 requireHuman (ui.consent.hypotheses.agent), :1686 help config set · src/cli/wizard.ts 5c (ctx.interactive && !isAgent) · src/cli/menu-settings.ts:87 hypothesesStep · src/commands/analysis.ts agentMayDecide (hypothesis.user, hypothesis.evidence, hypothesis.branch), citedInSupport · src/core/kin.ts BIG_BRANCH=10, branchJoined · src/core/model.ts:730 decidedByAgent, decidedAt · src/core/changelog.ts:360 · src/core/live.ts:2039 /status.hypotheses, :4647 POST /hypotheses (person hned, agent 403 hypotheses.link) · src/core/links.ts:112 · assets/lang/cs.json ui.setup.hypotheses, ui.hypotheses.decide.*, ui.settings.hypotheses, ui.consent.hypotheses.agent, ui.wait.hypothesis.byAgent, log.hypothesis.decide.agent, log.hypothesis.abandon.agent · CHANGELOG.cs.md 1.29.0 · app:src/strings.ts research.hypoDecideTitle/Person/Agent, hypoDecideConfirm(Link), hypoByAgent, hypoReason, research.treeSettings · src/ui/research-tree-settings-ui.ts · CHANGELOG.cs.md 3.25.0 · spec 060 K1.1–K1.5, K2.1 -->

<a id="R10.4"></a>
## R10.4 Rodzina poza drzewem czeka na udokumentowane powiązanie

Rodziny znalezionej w aktach, której z drzewem nie łączy żadne udokumentowane powiązanie, nie bada się dalej: ani jej
rodziców, ani dzieci. Najpierw trzeba udokumentować, że należy do drzewa.

- **Tylko metodyka:** agent zapisuje hipotezę, która przyłączyłaby rodzinę do osoby drzewa (`--about` osoba drzewa),
  i zadanie, które ją zweryfikuje i wymienia ją (`--about H…`). Rodzinę poza drzewem bada dalej tylko na prośbę
  użytkownika.
- **Pilnuje kod:** kolejka wstrzymuje pozostałe zadania o ludziach poza drzewem. Wracają same, gdy powiązanie zostanie
  zapisane ([R2.2.3](R2-lines-and-queue.md#R2.2.3)).
- **Dlaczego:** praca nad rodziną, która do drzewa nie należy, to praca stracona; rozstrzyga powiązanie, nie imię
  i nazwisko (metodyka „The tree first, then above it”).
- **Obsługa:** terminal: `strom task list --off-tree`. Aplikacja pokazuje rodzinę poza drzewem przy osobie w **Nad
  osobą** ([S3.3](S3-what-the-research-knows.md#S3.3)).
- **Obowiązuje od:** badanie 1.9.0

<!-- zdroj: research:assets/method/core.md "The tree first, then above it" · research:src/commands/tasks.ts --off-tree (od v1.9.0) -->

<a id="R10.5"></a>
## R10.5 Imiona i nazwiska osoby

Osoba może mieć więcej imion i nazwisk: z urodzenia, po ślubie, zakonne, inne. Każde ma swój wpis. Imiona i nazwiska
zapisuje się tak, jak stoją w akcie; ujednolica się tylko daty.

- **Pilnuje kod:**
  - rodzaje imienia i nazwiska: z urodzenia (`birth`), po ślubie (`married`), zakonne (`religious`), inne (`alias`),
    bez rodzaju;
  - pełne imię i nazwisko z aktu uzupełnia imię bez nazwiska („Marie”) i osoba pokazuje się potem pod nim. To samo
    imię i nazwisko podane ponownie tylko dodaje cytat;
  - kobieta pokazuje się pod nazwiskiem rodowym; nazwisko po ślubie zostaje obok;
  - tytuł pisany razem z imieniem i nazwiskiem („inż.”, „dr”, „mł.”) trafia do przedrostka lub przyrostka
    (`--prefix`, `--suffix`), nie do imienia ani nazwiska;
  - **imię i nazwisko, pod którym osoba się pokazuje** (rozwiedziona kobieta z powrotem przy nazwisku rodowym), to
    wybór użytkownika, nie dana z aktu: `strom name primary`. Tożsamość osoby (poprawa imienia i nazwiska, parowanie)
    zostaje przy imieniu i nazwisku z urodzenia.
- **Tylko metodyka:**
  - stopień lub urząd, który podaje wpis, jest daną (`TITL`, `OCCU`), nie częścią imienia i nazwiska;
  - dziecko, którego wpis nie nazywa (martwo urodzone, zmarłe nieochrzczone), nie ma imienia; zamiast imienia nie pisze
    się opisu;
  - osoba, którą słabszy akt nazwał inaczej, zachowuje to imię i nazwisko jako wariant; właściwe oznacza się jako
    główne. Nic się nie usuwa;
  - imię i nazwisko odczytane tylko częściowo: [R8.6](R8-reading-scans.md#R8.6).
- **Dlaczego:** opis zamiast imienia („martwo urodzony syn”) aplikacja i GEDCOM pokazywałyby i wyszukiwały jako
  imię, a parowanie imion brałoby go za imię. To, że dziecko zmarło bez imienia, jest daną (zgon, notatka).
- **Obsługa:** terminal: `strom name add P… "Marie /Vlková/" --kind birth --cite S…`, `strom name primary P…
  "…"` (`--clear` przywraca imię i nazwisko z urodzenia). Formy nazwiska w aplikacji:
  [A4.5](A4-surnames-and-families.md#A4.5), [A4.6](A4-surnames-and-families.md#A4.6).
- **Obowiązuje od:** badanie 1.0.0; przedrostek i przyrostek 1.13.0; imię i nazwisko, pod którym osoba się pokazuje,
  1.27.0; nienazwane dziecko 1.27.0

<!-- zdroj: research:src/core/model.ts NAME_KINDS · research:src/commands/people.ts name add (description), name primary (od v1.27.0), TITLE_OPTIONS (od v1.13.0) · research:assets/method/recording.md "The names a record gives", "A child the record does not name" (od v1.27.0), "People named wrongly by the weaker record" · research:assets/method/intake.md krok 4 -->

<a id="R10.5.1"></a>
### R10.5.1 Błędne imię i notatka zostają wycofane

Imienia i nazwiska ani notatki, które okażą się błędne, się nie usuwa. Wycofuje się je z powodem i zostają tylko
w historii.

- **Pilnuje kod:**
  - wycofane imię i nazwisko znika ze wszystkiego, co imiona pokazuje, czyta lub paruje: `strom person show`, dane dla
    agenta, GEDCOM (aplikacja nie pokaże go po wczytaniu drzewa), wyszukiwanie i parowanie;
  - imię i nazwisko, pod którym osoba się pokazuje, można wycofać tylko wtedy, gdy osoba ma jeszcze inne. Literówkę
    w nim poprawia się poleceniem `strom person edit --name`;
  - wycofanego imienia i nazwiska nie można dodać ponownie; przywraca je `strom name restore` z powodem;
  - notatkę poprawia się (`strom note edit`) lub wycofuje (`strom note retract`) z powodem; przywraca ją `strom note
    restore`.
- **Obsługa:** terminal: `strom name retract P… "Josef /Horák/" --reason "…"`, `strom person show P… --history`.
- **Obowiązuje od:** badanie 1.18.0

<!-- zdroj: research:src/commands/people.ts name retract (description), name restore, name add ("name.retracted"), note edit/retract/restore (od v1.18.0) · GitHub issue strom-research #3 -->

<a id="R10.6"></a>
## R10.6 Osoby wymienione we wpisie

Wpis wymienia więcej osób niż osobę główną: chrzestnych, świadków, akuszerkę, udzielającego ślubu, zgłaszającego,
rodziców i dziadków. Wszystko, co wpis o nich mówi, zapisuje się od razu przy pierwszym odczycie.

- **Tylko metodyka:**
  - każdy w roli trafia do zdarzenia jako rola i imię i nazwisko, a to, co wpis o nim mówi, w nawiasie: „chrzestny: Jan
    Horák (gospodarz, Lhota nr 12)”. Ksiądz to udzielający ślubu lub chrzczący;
  - z osobą drzewa osobę w roli łączy się tylko wtedy, gdy mówi to wpis. To samo imię i nazwisko nie wystarcza;
  - to, co wpis mówi o każdej wymienionej osobie (zawód, miejsce zamieszkania, numer domu), staje się jej daną z datą
    wpisu, także u dziadków. Wpis, który wymienia rodziców (chrzest wnuka), jest dla nich informacją wtórną
    ([R3.2.1](R3-verification-and-citation.md#R3.2.1));
  - miejsce to tylko miejscowość; numer domu trafia do własnego pola.
- **Dlaczego:** chrzestni i świadkowie bywają krewnymi i dokumentują kolejne powiązanie; według zawodu i domu szuka się
  osoby dalej. Ponowne otwarcie tej samej strony kosztuje więcej niż zapisanie wszystkiego od razu (metodyka).
- **Obsługa:** terminal: `strom event add … --with "godparent:…" --house 13`. Aplikacja: powtarzający się chrzestny
  we Wskazówkach Kontroli drzewa ([A5.5](A5-tree-check.md#A5.5)).
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:assets/method/recording.md "Everyone the entry names in a role", "What the entry says about each person", "A place is the municipality only" · research:assets/method/core.md "Extract everything the first time" · research:assets/method/link.md krok 6 -->
