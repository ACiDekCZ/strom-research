<a id="R14"></a>
# R14 Pieczęć i integralność badania

Każdą zmianę badania strom zapisuje jako operację w dziennikach jego historii (`data/ops`) i pieczętuje ją kluczem
tego komputera, razem z commitem w historii badania (git). `strom verify` porównuje każdy zapis i każdy commit z jego
pieczęcią i mówi, co zmieniono poza strom. Rozdział opisuje, jakie drogi dalej strom oferuje, a szczegółowo przyjęcie
badania takiego, jakie jest (`strom seal accept`). Opisuje badanie 1.30.1.

<!-- zdroj: research:39c56a89 strom help verify („seal check of every record and commit“), strom help repair, strom help seal adopt, strom help seal accept · src/core/accept.ts (záhlaví) · src/core/tree.ts commit (commitSeal klíčem tohoto počítače), requireKey · CHANGELOG.cs.md 1.30.1 · dirigent:spec/072-prijmout-stav/spec.md -->

<a id="R14.1"></a>
## R14.1 Co nie zgadza się z pieczęcią i drogi dalej

To, co znajdzie `strom verify`, decyduje, którą drogą iść dalej. Każdą uruchamia człowiek we własnym terminalu.

| Co się stało | Droga | Co robi |
|---|---|---|
| zapis zmieniony lub utworzony poza strom, historia (git) jest czytelna | `strom repair` | przywraca ostatni zapieczętowany stan: zmienione zapisy przywraca, zapisy utworzone poza strom usuwa; kopie wszystkiego zastąpionego zostają w `.strom/quarantine/` |
| badanie zapieczętowane na innym komputerze | `strom seal adopt` | sprawdza łańcuch operacji i skrót każdego zapisu i tworzy dla badania klucz tego komputera |
| utracona historia: brak najstarszych dzienników `data/ops`, a historii (git) nie da się odczytać albo jej nie ma; zapisy są takie, jak zapisał je strom | `strom seal accept` | niczego nie przywraca ani nie przejmuje: pieczętuje badanie takie, jakie jest teraz, jako nową podstawę ([R14.2](#R14.2)) |

- **Pilnuje kod:**
  - przy czytelnej historii (git) strom nie wskazuje `strom seal accept`: utracone dzienniki przywróci z niej
    `strom repair`;
  - przy uszkodzonej lub brakującej historii `strom verify` i `strom check` zgłaszają ustalenie `git-damaged` (historii
    nie da się odczytać, brak jej obiektów, albo badanie nie ma historii) i przy każdym pliku niezgodnym z pieczęcią
    radzą: „historia (git) jest uszkodzona, strom repair jej nie przywróci – po przejrzeniu zapisów we własnym
    terminalu: strom seal accept”;
  - zapis do badania z uszkodzoną historią strom odrzuca zdaniem „historia (git) badania jest uszkodzona: nic nie
    zapisano” (kod `tree.git-damaged`) z tą samą radą, zamiast błędu gita. Wcześniej zatrzymywał się na niej każdy
    zapis i `strom check`.
- **Obsługa:** terminal: `strom verify`, `strom check`, `strom repair`, `strom seal adopt`, `strom seal accept`.
- **Obowiązuje od:** badanie 1.30.1

<!-- zdroj: research:39c56a89 src/core/accept.ts ACCEPT_HINT, acceptWay (jen bez .git nebo s git.damaged; čitelná historie → nic, strom repair vrátí logy), GIT_DAMAGED, guardOrDamaged · src/commands/checks.ts check a verify (acceptWay nad verifyFull) · src/core/integrity.ts assertIntact, gitDamagedError (tree.git-damaged) · pl.json ui.check.accept.hint, ui.error.tree.git-damaged(.hint) · strom help repair, strom help seal adopt · CHANGELOG.pl.md 1.30.1 -->

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
