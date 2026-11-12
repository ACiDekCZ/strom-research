<a id="R14"></a>
# R14 Pieczęć i integralność badania

Każdą zmianę badania strom zapisuje jako operację w dziennikach jego historii (`data/ops`) i pieczętuje ją kluczem
tego komputera, razem z commitem w historii badania (git). `strom verify` porównuje każdy zapis i każdy commit z jego
pieczęcią i mówi, co zmieniono poza strom. Rozdział opisuje, jakie drogi dalej strom oferuje, a szczegółowo przyjęcie
badania takiego, jakie jest (`strom seal accept`), historię starszą niż badanie i cofnięcie naprawy (`strom repair undo`). Opisuje badanie 1.30.1;
zmiany z nowszej wersji mają przy sobie jej numer.

<!-- zdroj: research:39c56a89 strom help verify („seal check of every record and commit“), strom help repair, strom help seal adopt, strom help seal accept · src/core/accept.ts (záhlaví) · src/core/tree.ts commit (commitSeal klíčem tohoto počítače), requireKey · CHANGELOG.cs.md 1.30.1 · dirigent:spec/072-prijmout-stav/spec.md -->

<a id="R14.1"></a>
## R14.1 Co nie zgadza się z pieczęcią i drogi dalej

To, co znajdzie `strom verify`, decyduje, którą drogą iść dalej. Każdą uruchamia człowiek we własnym terminalu.

| Co się stało | Droga | Co robi |
|---|---|---|
| zapis zmieniony lub utworzony poza strom, historia (git) jest czytelna | `strom repair` | przywraca ostatni zapieczętowany stan: zmienione zapisy przywraca, zapisy utworzone poza strom usuwa; kopie wszystkiego zastąpionego zostają w `.strom/quarantine/`; od badania 1.31.0 przed usunięciem więcej niż 3 zapisów pyta człowieka ([R14.3](#R14.3)), a kopie przywraca `strom repair undo` ([R14.3.1](#R14.3.1)) |
| badanie zapieczętowane na innym komputerze | `strom seal adopt` | sprawdza łańcuch operacji i skrót każdego zapisu i tworzy dla badania klucz tego komputera |
| utracona historia: brak najstarszych dzienników `data/ops`, a historii (git) nie da się odczytać albo jej nie ma; zapisy są takie, jak zapisał je strom | `strom seal accept` | niczego nie przywraca ani nie przejmuje: pieczętuje badanie takie, jakie jest teraz, jako nową podstawę ([R14.2](#R14.2)) |
| od badania 1.31.0: historię (git) da się odczytać, ale jest starsza niż badanie; `strom repair` usunąłby pracę | nigdy `strom repair`: najpierw kopia zapasowa całego folderu, potem `.git` z kopii zapasowej lub z Time Machine, albo `strom seal accept` | nic nie zostaje usunięte ([R14.1.1](#R14.1.1)) |

- **Pilnuje kod:**
  - przy czytelnej historii (git) strom nie wskazuje `strom seal accept`: utracone dzienniki przywróci z niej
    `strom repair`. Od badania 1.31.0 jeden wyjątek: historia starsza niż badanie ([R14.1.1](#R14.1.1));
  - przy uszkodzonej lub brakującej historii `strom verify` i `strom check` zgłaszają ustalenie `git-damaged` (historii
    nie da się odczytać, brak jej obiektów, albo badanie nie ma historii) i przy każdym pliku niezgodnym z pieczęcią
    radzą: „historia (git) jest uszkodzona, strom repair jej nie przywróci – po przejrzeniu zapisów we własnym
    terminalu: strom seal accept”;
  - zapis do badania z uszkodzoną historią strom odrzuca zdaniem „historia (git) badania jest uszkodzona: nic nie
    zapisano” (kod `tree.git-damaged`) z tą samą radą, zamiast błędu gita. Wcześniej zatrzymywał się na niej każdy
    zapis i `strom check`.
- **Obsługa:** terminal: `strom verify`, `strom check`, `strom repair`, `strom repair undo`, `strom seal adopt`,
  `strom seal accept`.
- **Obowiązuje od:** badanie 1.30.1; 1.31.0: historia starsza niż badanie, pytanie `strom repair`, `strom repair undo`

<!-- zdroj: research:39c56a89 src/core/accept.ts ACCEPT_HINT, acceptWay (jen bez .git nebo s git.damaged; čitelná historie → nic, strom repair vrátí logy), GIT_DAMAGED, guardOrDamaged · src/commands/checks.ts check a verify (acceptWay nad verifyFull) · src/core/integrity.ts assertIntact, gitDamagedError (tree.git-damaged) · pl.json ui.check.accept.hint, ui.error.tree.git-damaged(.hint) · strom help repair, strom help seal adopt · CHANGELOG.pl.md 1.30.1 -->

<a id="R14.1.1"></a>
### R14.1.1 Historia starsza niż badanie: `history-reverted`

Dysk w chmurze może przywrócić do badania starszą kopię historii (git), często z kopiami iCloud wewnątrz `.git` (na
przykład `index 2`, `HEAD 2`). Historię da się odczytać, ale zapisów utworzonych od tej kopii w niej nie ma.
`strom verify` zgłasza je wtedy jako utworzone poza strom, a `strom repair` by je usunął. Dlatego strom najpierw
oblicza, co zrobiłby `strom repair`, a tam, gdzie usunąłby pracę, radzi drogę, która niczego nie traci.

- **Pilnuje kod:**
  - historię uznaje za starszą niż badanie, gdy `strom repair` usunąłby co najmniej jeden zapis, który zapisała
    nienaruszona podpisana operacja z dzienników historii w folderze, na który powołują się inne zapisy albo który ma
    niższy numer niż najwyższy zapis tego samego rodzaju w zapieczętowanym stanie (zaginęła najstarsza historia); albo
    gdy wewnątrz `.git` są kopie iCloud, a naprawa coś by usunęła;
  - `strom verify` i `strom check` zgłaszają wtedy ustalenie `history-reverted` z liczbą: „historia (git) jest starsza
    niż badanie: strom repair usunąłby N zapisów”. Przy nim i przy każdym ustaleniu, przy którym inaczej wskazałyby
    `strom repair`, radzą: „najpierw kopia zapasowa całego folderu badania; potem przywrócić .git z kopii zapasowej lub
    z Time Machine – albo po przejrzeniu zapisów we własnym terminalu: strom seal accept (nigdy strom repair: usunąłby
    tę pracę)”;
  - zapis do takiego badania strom odrzuca zdaniem „historia (git) jest starsza niż badanie – strom repair usunąłby
    N zapisów: nic nie zapisano” (kod `tree.history-reverted`) z tą samą radą i odesłaniem do `strom verify`;
  - przy uszkodzonej lub brakującej historii (`git-damaged`) obowiązuje dalej droga z [R14.1](#R14.1):
    `strom seal accept`.
- **Obsługa:** terminal: `strom verify`, `strom check`; dalej według rady: kopia zapasowa folderu, `.git` z kopii
  zapasowej lub z Time Machine, albo `strom seal accept` ([R14.2](#R14.2)).
- **Obowiązuje od:** badanie 1.31.0
- **Dlaczego:** badanie w iCloud Drive ze starszą kopią `.git` i bez najstarszych dzienników zgłaszało zapisy jako
  niezapieczętowane, a `strom repair` usunąłby zapisy z lat pracy (ustalenie z 9.11.2026).

<!-- zdroj: research:0c6f2205 src/core/repair.ts (záhlaví, nález 2026-11-09), planRepair (sealedWork, referenced, older, cloudCopies), historyLost, HISTORY_REVERTED, LOST_HINT, repairWay (ne při GIT_DAMAGED), lostFinding, historyLostError (tree.history-reverted), lostOnRepair · src/core/integrity.ts assertIntact (lostOnRepair → historyLostError) · src/commands/checks.ts sealWay (check, verify) · pl.json ui.check.lost, ui.check.lost.hint, ui.error.tree.history-reverted(.hint) · CHANGELOG.cs.md 1.31.0 -->

<a id="R14.2"></a>
## R14.2 Przyjąć badanie takie, jakie jest: `strom seal accept`

Dysk w chmurze (na przykład iCloud Drive) może zabrać badaniu najstarsze dzienniki historii (`data/ops`) i obiekty
jego historii (git). Zapisy zostają takie, jak zapisał je strom, ale `strom verify` zgłasza je jako utworzone lub
zmienione poza strom, a `strom repair` nie ma czego przywrócić albo przywróciłby starszy stan. `strom seal accept`
bierze badanie takie, jakie jest teraz, jako nową zapieczętowaną podstawę. Decyduje o tym człowiek, który wcześniej
przejrzał zapisy.

- **Najpierw liczby:** bez potwierdzenia polecenie niczego nie zmienia. Wypisuje, co zrobiłoby przyjęcie:
  - zapisy bez historii;
  - zapisy nowsze niż reszta ich historii;
  - inne pliki badania (historia, jakość, `strom.json`) niezgodne z pieczęcią;
  - ile dzienników historii jest w folderze;
  - stan historii (git): **czytelna** (zmiana zostanie do niej dodana), **ostatniej zmiany nie zrobił strom**
    (zostanie zapieczętowana na nowo), **uszkodzona** (odsunięta w całości, nic nie zostanie usunięte, zostanie
    założona nowa), **brak** (zostanie założona nowa);
  - kopie plików z iCloud, które zostaną odsunięte, i te, które zostaną na miejscu ([R14.2.1](#R14.2.1)).
- **Potwierdzenie:** człowiek we własnym terminalu odpowiada na **Przyjąć badanie takie, jakie jest teraz?**.
  Domyślna odpowiedź to nie.
- **Różnica:** `strom repair` przywraca ostatni zapieczętowany stan, `strom seal adopt` przejmuje badanie
  zapieczętowane na innym komputerze; `strom seal accept` niczego nie przywraca ani nie przejmuje ([R14.1](#R14.1)).
- **Obsługa:** terminal: `strom seal accept --preview` (tylko liczby, może też agent), `strom seal accept`. Działa
  też w Archiwum Strom.
- **Obowiązuje od:** badanie 1.30.1

<!-- zdroj: research:39c56a89 src/commands/checks.ts seal accept (planAccept → acceptSaid; preview nebo neinteraktivně jen počty, exit 4; confirm(ui.accept.ask, false)) · src/core/accept.ts AcceptPlan (unsealed, edited, other, logs, git ok|unsealed|damaged|missing, moveAside, copies) · pl.json ui.accept.title, unsealed, edited, other, logs, git.*, aside, copies, does, ask · src/cli/help.ts ARCHIVE_COMMANDS „seal accept“ · CHANGELOG.pl.md 1.30.1 -->

<a id="R14.2.1"></a>
### R14.2.1 Co robi przyjęcie

Po potwierdzeniu jedna zapieczętowana zmiana zapisuje każdy plik niezgodny z pieczęcią taki, jaki jest teraz: żaden
zapis się nie zmienia, nic nie zostaje usunięte.

- **Pilnuje kod:**
  - jedna podpisana operacja (`seal.accept`) niesie skrót każdego takiego pliku, a strom zachowuje ją
    w zapieczętowanym commicie;
  - uszkodzoną historię (git) odsuwa w całości do folderu `.git-damaged-<kiedy>` obok badania i zakłada nową; folder
    ze starą historią do nowej nie należy. Bez historii zakłada nową, czytelną historię tylko uzupełnia o zmianę;
  - kopie plików z iCloud (na przykład „P0001 2.json”) w folderach `data/`, `history/` i `quality/` oraz kopie blokad
    w `.strom/` przenosi do `.strom/accepted-<kiedy>/`; nigdy nie pieczętuje ich jako zapisów. Kopie w innych
    miejscach badania (obok `strom.json`, w `.strom/`, w `output/`) tylko wypisuje i zostawia na miejscu;
  - na koniec ponownie uruchamia pełną kontrolę: „strom verify: w porządku – każdy zapis zgadza się ze swoją
    pieczęcią” albo ile problemów zostało („strom verify nadal zgłasza problemy: N”);
  - drugie uruchomienie nic nie robi: „nie ma czego przyjmować – każdy zapis zgadza się ze swoją pieczęcią”.
- **Obowiązuje od:** badanie 1.30.1

<!-- zdroj: research:39c56a89 src/core/accept.ts applyAccept (appendOp seal.accept files[path, sha], targets []; tree.commit; .git-damaged-<stamp>, git.initRepo, .git/info/exclude /.git-damaged-*/; .strom/accepted-<stamp>), cloudCopies (SEALED_DIRS data, history, quality; kopie zámků v .strom; kořen, .strom, output jen vypsat), isCloudCopy, nothingToAccept · src/commands/checks.ts (po přijetí verifyFull) · pl.json ui.accept.does, done, gitmoved, copiesmoved, verified, still, nothing -->

<a id="R14.2.2"></a>
### R14.2.2 Czego przyjęcie pilnuje i czego nigdy nie rozwiązuje

- **Pilnuje kod:**
  - badanie przyjmuje tylko człowiek we własnym interaktywnym terminalu, tą samą bramą co `strom seal adopt`;
    `--yes` nigdy go nie przyjmuje („--yes nigdy nie przyjmuje badania: decyduje człowiek we własnym terminalu”). Poza
    interaktywnym terminalem polecenie wypisuje tylko liczby i zdanie „O przyjęciu badania decyduje tylko człowiek we
    własnym terminalu – strom seal accept”;
  - agent może tylko `--preview`; samo przyjęcie strom agentowi odrzuca, a agent podaje człowiekowi polecenie;
  - nic nie zostaje przyjęte, dopóki nad badaniem działa most do aplikacji Strom (`strom live stop`, potem ponownie)
    albo ktoś nad nim pracuje (`strom session finish`, potem ponownie);
  - po potwierdzeniu strom układa plan ponownie pod blokadą badania; gdy badanie zmieniło się od przejrzenia, nic nie
    zostaje przyjęte („badanie zmieniło się od przejrzenia: nic nie przyjęto”);
  - badanie zapieczętowane na innym komputerze najpierw się przejmuje (`strom seal adopt`);
  - innych ustaleń kontroli przyjęcie nigdy nie rozwiązuje: przepisanego dziennika, sfałszowanej operacji, innego
    klucza, plików tylko w chmurze, usuniętego zapisu ani pliku w `data/`, który nie jest zapisem czytelnym dla strom.
    Przy takim ustaleniu nic nie zostaje przyjęte („Nie przyjęto: kontrola znalazła to, czego przyjęcie nigdy nie
    rozwiązuje”), a drogę wskaże `strom verify`.
- **Obowiązuje od:** badanie 1.30.1

<!-- zdroj: research:39c56a89 src/commands/checks.ts seal accept (agentMay jen --preview; ctx.yes → accept.yes; requireHuman jako seal adopt; liveRunning → accept.bridge; liveWorkers/runsAtWork → accept.busy; tree.requireKey) · src/core/accept.ts SETTLED (unsealed, manual-edit, history-edited, quality-edited, config-edited, foreign-commit), planAccept refused (jiné kódy; recordReadable), applyAccept samePlan → accept.changed · src/cli/help.ts HUMAN_COMMANDS · pl.json ui.accept.person, refused, ui.error.accept.* · strom help seal accept -->

<a id="R14.3"></a>
## R14.3 `strom repair` pyta człowieka

`strom repair` przywraca badanie do ostatniego zapieczętowanego stanu ([R14.1](#R14.1)). Najpierw oblicza, co by
zrobił. Gdy usunąłby więcej zapisów albo pracę, decyduje człowiek we własnym terminalu.

- **Granice:**
  - pyta, gdy usunąłby więcej niż 3 zapisy albo jakikolwiek zapis ze znakiem historii starszej niż badanie
    ([R14.1.1](#R14.1.1)); w przeciwnym razie naprawia bez pytania;
  - przed pytaniem podaje, ile zapisów (i plików) by usunął i ile plików przywróciłby według zapieczętowanego stanu
    (commitu), a z tego ile zapisów utworzyły operacje zapieczętowane we własnych dziennikach, na ile powołują się inne
    zapisy, ile jest starszych niż zapieczętowany stan i które kopie iCloud są wewnątrz `.git`;
  - potem: „Najpierw zrobić kopię zapasową całego folderu badania. Kopia wszystkiego, co usunięte, zostaje
    w .strom/quarantine/, strom repair undo ją przywróci.” Ze znakiem historii starszej niż badanie radzi zamiast
    naprawy `.git` z kopii zapasowej lub z Time Machine albo `strom seal accept`;
  - pytanie **Usunąć N zapisów?** ma domyślną odpowiedź nie (Enter).
- **Pilnuje kod:**
  - agent, `--yes` ani uruchomienie bez terminalu nie dostają pytania: tylko liczby i „O usunięciu zapisów decyduje
    tylko człowiek we własnym terminalu – strom repair” (`needs-consent`, kod wyjścia 4); agent mówi to człowiekowi;
  - po zgodzie strom tworzy plan ponownie pod blokadą badania; jeśli badanie zmieniło się od przejrzenia, nic nie
    naprawia („badanie zmieniło się od przejrzenia: nic nie naprawiono”);
  - obok kopii w `.strom/quarantine/<stamp>/` zachowuje listę tego, co usunął i co nadpisał, a po naprawie mówi
    „cofnięcie: strom repair undo <stamp>” ([R14.3.1](#R14.3.1)).
- **Obsługa:** terminal: `strom repair`.
- **Obowiązuje od:** badanie 1.31.0

<!-- zdroj: research:0c6f2205 src/core/repair.ts REPAIR_ASKS_ABOVE = 3, repairAsks, historyLost, applyRepair (MANIFEST repair.json vedle kopií), sameRepair · src/commands/checks.ts repair (planRepair → repairAsks → requireHuman window false → confirm(ui.repair.ask, false); pod zámkem planRepair znovu, repair.changed; ui.repair.undo.how), repairSaid, repairQuestion · src/cli/context.ts requireHuman (NeedsConsentError) · src/core/errors.ts EXIT.needsConsent 4 · pl.json ui.repair.ask.*, ui.repair.ask, ui.repair.person, ui.error.repair.changed · strom help repair · CHANGELOG.cs.md 1.31.0 -->

<a id="R14.3.1"></a>
### R14.3.1 Cofnąć naprawę: `strom repair undo`

To, co `strom repair` usunął lub nadpisał, `strom repair undo` przywraca z jego kopii w `.strom/quarantine/`.

- **Granice:**
  - bez znacznika czasu wypisuje kopie zachowane przez `strom repair`, od najnowszej, przy każdej liczbę plików
    i zapisów; bez kopii: „w .strom/quarantine/ nie ma kopii ze strom repair”. Listę może uruchomić każdy, także agent;
  - ze znacznikiem czasu najpierw podaje, co zrobiłoby przywrócenie: przywrócone pliki (i zapisy wśród nich), pliki
    zmienione od naprawy, które zostaną takie, jakie są teraz, oraz pliki, których strom nie pieczętuje (kopie iCloud,
    nieznane pliki) i które zostaną w kwarantannie. Pytanie **Przywrócić je?** ma domyślną odpowiedź nie;
  - przywraca plik, który naprawa usunęła i którego od tego czasu w folderze nie ma, oraz plik, który naprawa
    nadpisała i który od tego czasu się nie zmienił. Przy kopiach ze `strom repair` badania 1.30 (bez listy tego, co
    naprawa nadpisała) przywraca tylko pliki, których brak w folderze;
  - nie ma czego przywracać: „nie ma czego przywracać – każdy plik jest jak jego kopia albo od tego czasu się zmienił”.
- **Pilnuje kod:**
  - przywrócenie ze znacznikiem czasu jest tylko dla człowieka we własnym terminalu; gdzie indziej strom podaje tylko
    liczby i „O przywróceniu tego, co usunął strom repair, decyduje tylko człowiek we własnym terminalu – strom repair
    undo <stamp>” (kod wyjścia 4);
  - przywraca tylko do badania takiego, jakim strom je zapieczętował: przy zmianach poza strom nic nie przywraca
    („badanie ma zmiany, których strom nie zapieczętował: nic nie przywrócono”, szczegóły podaje `strom verify`);
  - nic nie przywraca, dopóki nad badaniem działa most do aplikacji Strom (`strom live stop`, potem ponownie) albo ktoś
    nad nim pracuje (`strom session finish`, potem ponownie);
  - po zgodzie tworzy plan ponownie pod blokadą badania; jeśli badanie zmieniło się od przejrzenia, nic nie przywraca
    („badanie zmieniło się od przejrzenia: nic nie przywrócono”);
  - jedna podpisana operacja (`repair.undo`) wymienia każdy przywrócony zapis taki, jaki jest, a strom zapisuje ją
    zapieczętowanym commitem; w folderze nic nie zostaje usunięte. Na koniec ponownie uruchamia pełną kontrolę, jak
    `strom verify`.
- **Obsługa:** terminal: `strom repair undo` (lista), `strom repair undo <stamp>`.
- **Obowiązuje od:** badanie 1.31.0; przywraca też kopie ze `strom repair` badania 1.30

<!-- zdroj: research:0c6f2205 src/core/repair.ts REPAIR_ASKS_ABOVE = 3, repairAsks, historyLost, applyRepair (MANIFEST repair.json vedle kopií), sameRepair · src/commands/checks.ts repair (planRepair → repairAsks → requireHuman window false → confirm(ui.repair.ask, false); pod zámkem planRepair znovu, repair.changed; ui.repair.undo.how), repairSaid, repairQuestion · src/cli/context.ts requireHuman (NeedsConsentError) · src/core/errors.ts EXIT.needsConsent 4 · pl.json ui.repair.ask.*, ui.repair.ask, ui.repair.person, ui.error.repair.changed · strom help repair · CHANGELOG.cs.md 1.31.0 -->1
