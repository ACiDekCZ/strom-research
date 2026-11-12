<a id="R13"></a>
# R13 Zgłosić problem: `strom error`

Gdy w badaniu, przy pobieraniu, w aplikacji Strom albo przy instalacji coś się zepsuje, `strom error` pakuje do
jednego pliku ZIP to, co jest potrzebne, by poznać, co się stało. Nic o ludziach z drzewa do niego nie trafia, a strom
niczego nie wysyła: plik wysyła sam człowiek. Rozdział opisuje badanie 1.30.0.

<!-- zdroj: dirigent:spec/070-hlaseni-chyby/spec.md · research:6c6e7c3b CHANGELOG.cs.md 1.30.0 (Problém nahlášený v jednom souboru) · strom help error · src/commands/error.ts · src/core/report.ts -->

<a id="R13.1"></a>
## R13.1 Jedno polecenie, jeden plik

`strom error` wypisuje, co raport będzie zawierał, pyta **Utworzyć raport?** i zapisuje plik ZIP. Mówi, gdzie plik
jest, jak jest duży i dokąd go wysłać.

- **Pilnuje kod:**
  - plik trafia do folderu Pobrane, w przeciwnym razie do bieżącego folderu; w badaniu bez folderu Pobrane do folderu
    domowego, nigdy do badania;
  - raport ma najwyżej 2 MB: dłuższe dzienniki się skraca;
  - polecenie badanie tylko czyta, niczego w nim nie zapisuje;
  - strom niczego nie wysyła: „Do wysłania e-mailem na {adres}, z kilkoma słowami o tym, co się stało. Strom sam
    niczego nie wysyła; plik można wcześniej otworzyć i przejrzeć (README.txt mówi, co gdzie jest).”
- **Obsługa:** terminal: `strom error`; w menu `strom`: **Ustawienia → Konserwacja → Zgłosić problem: jeden plik ZIP
  do wysłania (nic o ludziach z drzewa)**.
- **Obowiązuje od:** badanie 1.30.0

<!-- zdroj: research:6c6e7c3b src/commands/error.ts (ctx.readOnly, cíl ZIPu) · src/core/report.ts REPORT_MAX_BYTES · cs.json ui.report.summary, ui.report.create, ui.report.done, ui.report.send, ui.maintenance.title, ui.maintenance.report -->

<a id="R13.2"></a>
## R13.2 Co zawiera raport, a czego nie

| Obszar | Co w nim jest |
|---|---|
| ten komputer | wersja i kanał stromu, Node, git, system, język, wolne miejsce |
| ustawienia stromu | bez ścieżek i logowań |
| `strom doctor` | wszystkie kontrole |
| agenci | którzy są zainstalowani, ich wersje, domyślny model, hooki stromu |
| konektory | lista, wersje, dozwolone serwery, ostatni test (bez logowań) |
| most do aplikacji Strom | działanie, wersja aplikacji, ostatnia synchronizacja |
| badanie w liczbach | liczby, `strom check`, git, pobierania, sesje (bez nazwisk) |
| techniczne dzienniki | dzienniki stromu z ostatnich 7 dni (most, porządki, pobierania) |
| polecenia | polecenia zakończone błędem, także polecenia z rozmowy z agentem |

- **Pilnuje kod:**
  - imiona i nazwiska, miejsca, notatki, transkrypcje, skany i e-maile do raportu nie trafiają albo zastępuje się je
    stałymi kodami (na przykład ‹a1b2c›): to samo słowo ma w całym raporcie ten sam kod, więc widać, że chodzi o to
    samo, ale nie, co to jest;
  - ścieżki z nazwą użytkownika się maskuje; logowania, klucze i tokeny nie trafiają do raportu nigdy;
  - badania nazywa się w raporcie tylko R1, R2…, nigdy ich ścieżką;
  - obszar, którego nie da się odczytać, ma w wypisie ✗ i błąd („nie udało się odczytać (…)”); raport powstaje
    z pozostałych;
  - w pliku ZIP jest README.txt (co gdzie jest) i report.json.
- **Obowiązuje od:** badanie 1.30.0

<!-- zdroj: research:6c6e7c3b cs.json ui.report.area.* (system, config, doctor, agents, connectors, bridge, research, logs, commands), ui.report.area.failed, ui.report.readme.intro · src/core/redact.ts (stálé kódy) · src/core/cmdlog.ts (výzkumy jen R1, R2…, 6c6e7c3b) · src/commands/error.ts:85-97, :408 -->

<a id="R13.3"></a>
## R13.3 Jaki problem, jakie polecenie

`--about` dodaje szczegóły jednego obszaru. Można go podać kilka razy.

| Problem | Polecenie |
|---|---|
| pobieranie się zatrzymuje, zawodzi albo długo czeka | `strom error --about fetch` |
| aplikacja Strom: synchronizacja, most, drzewo się nie pokazuje | `strom error --about sync` |
| agent: rozmowa albo `strom run` się zepsuły | `strom error --about agent` |
| instalacja albo aktualizacja stromu | `strom error --about install` |
| cokolwiek w systemie Windows | `strom error --about windows` |
| coś innego | `strom error` |

- **Co dodaje obszar:** pobierania szczegółowo (każde, jego konektor, oczekiwania i błędy); most szczegółowo
  (synchronizacje, bramki aplikacji); sesje agenta szczegółowo (kroki i kody wyjścia); instalacja szczegółowo (PATH,
  aktualizacje, kopie zapasowe instalacji); Windows (zasady wykonywania PowerShella, długie ścieżki, OneDrive).
- **Obsługa:** `--since 2d|1w|12h|RRRR-MM-DD` określa, jak daleko wstecz sięgają dzienniki (domyślnie 7 dni).
- **Obowiązuje od:** badanie 1.30.0

<!-- zdroj: research:6c6e7c3b strom help error (tabulka), REPORT_ABOUT · cs.json ui.report.area.fetch, sync, agent, install, windows -->

<a id="R13.4"></a>
## R13.4 Gdzie wystąpił problem i co się stało

Raport mówi, gdzie wystąpił problem, i może zawierać opis słowami człowieka.

- **Pilnuje kod:**
  - człowiek przy terminalu dostaje pytanie **Gdzie wystąpił problem?**: **w rozmowie z agentem**, **w terminalu,
    strom bez agenta**, **w aplikacji Strom**, **nie wiadomo**; z `--where chat|terminal|app|unknown` strom nie pyta;
  - uruchomione przez agenta bez `--where`: miejsce zostaje „nie wiadomo”, a strom mówi agentowi, żeby zapytał
    człowieka i uruchomił polecenie ponownie;
  - `--note "…"` to opis problemu słowami człowieka, najwyżej 2000 znaków; nazwiska z badania są w nim maskowane.
  - **Od badania 1.31.0:** maskowane są też odmienione formy nazwisk i miejsc znanych badaniu, w których zmieniają się
    ostatnia jedna lub dwie litery („z Brna” od Brno, „v Praze” od Praha). Rdzeń ma co najmniej 3 litery, a końcówka
    jest tym krótsza, im krótszy jest rdzeń; zwykłe słowo, które tylko podobnie się zaczyna, zostaje czytelne. Tak
    samo maskowany jest cały raport.
- **Obsługa:** `strom error --where app --about sync`, `strom error --since 2d --note "pobieranie zatrzymało się
  w połowie"`.
- **Obowiązuje od:** badanie 1.30.0

<!-- zdroj: research:6c6e7c3b src/commands/error.ts (otázka jen interaktivně; pod agentem where unknown) · cs.json ui.report.where.q, .chat, .terminal, .app, .unknown · strom help error --note (≤2000 characters, masked) · research:c5ee74ab src/core/redact.ts formOf (změněné poslední 1–2 písmeno, kmen ≥ 3, koncovka podle kmene; slovo ze 3 písmen jen o písmeno delší), byPrefix 3 písmena · CHANGELOG.cs.md 1.31.0 -->

<a id="R13.5"></a>
## R13.5 Dane osób tylko za zgodą

Gdy problem dotyczy konkretnej osoby, rodziny albo księgi, można dodać jej dane. Tylko na wyraźne życzenie.

- **Pilnuje kod:**
  - `--with-data` z `--person P…`, `--family F…` albo `--book B…` dodaje plik data.json: imiona i nazwiska, dane,
    miejsca, cytaty i to, jak pewna jest każda dana. Skanów, notatek i transkrypcji nie;
  - człowiek przy terminalu dostaje pytanie **Dodać je do raportu?**;
  - agent musi dodać `--yes-data`, i to tylko po wyraźnym „tak” człowieka w rozmowie; bez niego polecenie kończy się
    informacją, że brakuje zgody.
- **Obsługa:** `strom error --about fetch --with-data --book B0001`.
- **Obowiązuje od:** badanie 1.30.0

<!-- zdroj: research:6c6e7c3b strom help error --with-data, --person, --family, --book, --yes-data · src/core/reportdata.ts · cs.json ui.report.data.q, ui.report.data.add -->

<a id="R13.6"></a>
## R13.6 Uszkodzone badanie, Archiwum Strom i poza badaniem

- **Pilnuje kod:**
  - uszkodzone badanie się tylko czyta; to, czego nie da się odczytać, ma w wypisie ✗, a reszta raportu powstaje;
  - w Archiwum Strom raport nie ma agentów, sesji ani `--about agent`; pytanie **Gdzie wystąpił problem?** nie ma
    „w rozmowie z agentem”, a zamiast „w terminalu, strom bez agenta” oferuje **w terminalu**;
  - uruchomione poza badaniem: raport ma każde znane badanie, tylko w liczbach i z zamaskowaną nazwą; polecenia
    zakończone błędem ze wszystkich.
- **Obowiązuje od:** badanie 1.30.0

<!-- zdroj: research:6c6e7c3b CHANGELOG.cs.md 1.30.0 („Výzkum se jen čte, i rozbitý.“) · src/commands/error.ts (archiv: bez agentů a gate.log; mimo výzkum jen otisky známých výzkumů) · cs.json ui.report.where.terminal.archive, ui.report.area.research.archive -->

<a id="R13.7"></a>
## R13.7 Agent i zgłaszanie problemu

Agent zna to polecenie. Gdy człowiek powie, że ma problem ze strom, albo chce „wysłać błąd”, agent pyta, gdzie problem
wystąpił (w tej rozmowie, w terminalu bez agenta albo w aplikacji Strom), nigdy tego nie zgaduje, i uruchamia
`strom error --where …` z pasującym `--about` oraz z `--note` słowami człowieka. Potem podaje ścieżkę do pliku i adres,
który strom wypisał.

- **Pilnuje kod:** dane osób agent dodaje tylko z `--yes-data`, które może podać tylko po wyraźnej zgodzie człowieka
  ([R13.5](#R13.5)).
- **Tylko metodyka:** agent nigdy nie wysyła pliku, nie otwiera go ani nie przepisuje jego zawartości do rozmowy.
- **Obowiązuje od:** badanie 1.30.0

<!-- zdroj: research:6c6e7c3b src/commands/guide.ts:371-378 (A PROBLEM WITH STROM) · CHANGELOG.cs.md 1.30.0 -->
