<a id="R12"></a>
# R12 Gdzie agent pracuje i czego strom pilnuje

Z agentem (Claude Code, Codex, Antigravity, Grok Build, OpenCode) rozmawia się w terminalu albo w aplikacji
desktopowej agenta, gdy strom ją otwiera; praca samodzielna biegnie bez rozmowy. Od tego
zależy, gdzie toczy się rozmowa, jakiej przeglądarki agent użyje, czego strom pilnuje, co robi człowiek i co nie
działa bez agenta w terminalu. Zasady archiwów są wszędzie te same ([R9](R9-archives.md)); różni się tylko to, przed
czym strom stoi. Opisuje badanie 1.30.0. Przy zasadach rozróżnia się, czego **pilnuje kod** (polecenie `strom` albo
hook agenta to odrzuci), a co jest tylko **zasadą metodyki**. Czego nie sprawdzono na żywo na Macu, mówi
[R12.6](#R12.6).

<!-- zdroj: dirigent:spec/062-hlidani-desktop-a-codex/spec.md K5.1, K5.2 · test/vysledek-desktop-chrome.md · test/vysledek-062-u4-desktop.md · test/vysledek-1106-vyzkum-062-desktop.md · research:CHANGELOG.pl.md 1.29.0 · src/core/which.ts AGENTS -->

<a id="R12.1"></a>
## R12.1 Sposoby pracy: tabela

| Sposób pracy | Gdzie toczy się rozmowa | Przeglądarka agenta | Czego strom pilnuje | Krok człowieka | Bez agenta w terminalu |
|---|---|---|---|---|---|
| Claude Code w terminalu | terminal: Claude Code w folderze badania (`strom chat --where terminal`) | Chrome z rozszerzeniem Claude in Chrome ([R9.4.1](R9-archives.md#R9.4.1)) | przeglądarki w Chrome ([R9.4](R9-archives.md#R9.4)), pobierania stron ([R9.3](R9-archives.md#R9.3)), poleceń w wierszu poleceń agenta | zgoda na archiwum ([R9.2](R9-archives.md#R9.2)) | – (Claude Code jest w terminalu) |
| aplikacja Claude (karta Code) i Claude Code w terminalu | aplikacja Claude, karta Code (`strom chat`) | Chrome z Claude in Chrome albo wbudowana przeglądarka aplikacji ([R12.2](#R12.2)) | przeglądarki w Chrome i wbudowanej przeglądarki aplikacji, pobierania stron, poleceń w wierszu poleceń agenta i w terminalu aplikacji ([R12.3](#R12.3)) | potwierdzić folder (Trust workspace) i wysłać przygotowaną wiadomość; zgoda na archiwum | niczego nie brakuje: praca samodzielna i czytanie skanów biegną przez Claude Code w terminalu |
| aplikacja Claude bez Claude Code w terminalu | aplikacja Claude, karta Code (`strom chat`) | jak w wierszu wyżej | jak w wierszu wyżej | jak w wierszu wyżej; instalacja Claude Code, którą strom proponuje i którą można odrzucić ([R12.4](#R12.4)) | praca samodzielna (`strom run`), czytanie skanów przez czytelników (`strom read`) i praca z aplikacji Strom ([R12.4](#R12.4)) |
| Codex w terminalu | terminal: Codex w folderze badania (`strom chat --where terminal`) | przeglądarka, Chrome i sterowanie komputerem Codexu, jeśli ma je jego konfiguracja ([R12.5](#R12.5)) | poleceń `strom` według zasad drzewa dla Codexu; przeglądarki Codexu według adresów w jej kodzie, gdy człowiek potwierdzi hook stroma; nie sterowania komputerem ani wyszukiwania w sieci Codexu ([R12.5](#R12.5)) | zaufać folderowi badania (dopiero wtedy obowiązują zasady drzewa) i potwierdzić hook stroma (**Review hooks**, `/hooks`); zgoda na archiwum | – (Codex jest w terminalu) |
| aplikacja ChatGPT (Codex) | aplikacja ChatGPT (`strom chat`) | przeglądarka aplikacji ChatGPT: działa przez chmurę ChatGPT ([R12.5.1](#R12.5.1)) | nie przeglądarki aplikacji ChatGPT: o stronach decyduje okno dialogowe ChatGPT ([R12.5.1](#R12.5.1)) | według `strom chat` potwierdzić folder i wysłać przygotowaną wiadomość (nie sprawdzono, [R12.6](#R12.6)); w oknie ChatGPT „przeglądarka w chmurze” dla archiwum z ograniczeniami odmówić ([R12.5.1](#R12.5.1)); zgoda na archiwum | praca samodzielna, czytanie skanów przez czytelników i praca z aplikacji Strom ([R12.5](#R12.5)) |
| Antigravity w terminalu | terminal: Antigravity (`agy`) w folderze badania (`strom chat`); aplikacji Antigravity strom nie otwiera ([R12.7](#R12.7)) | przeglądarka Antigravity, jeśli agent ją ma; strom jej nie pilnuje ([R12.7](#R12.7)) | tylko tego, co odrzuci sam `strom`: poleceń, które należą tylko do człowieka; Antigravity nie ma hooka ani zasad w folderze badania ([R12.7](#R12.7)) | zgoda na archiwum | – (Antigravity jest w terminalu) |
| Grok Build w terminalu | terminal: Grok (`grok`) w folderze badania (`strom chat`); żadnej aplikacji Groka strom nie otwiera ([R12.8](#R12.8)) | żadna, której strom by pilnował ([R12.8](#R12.8)) | pobierania stron ([R9.3](R9-archives.md#R9.3)) i poleceń w wierszu poleceń agenta: hooki i zasady stroma w `.grok/` ([R12.8](#R12.8)) | nic więcej: `strom chat` uruchamia Groka z folderem badania jako zaufanym; zgoda na archiwum | – (Grok jest w terminalu) |
| OpenCode w terminalu | terminal: OpenCode w folderze badania (`strom chat --where terminal`) | żadna, której strom by pilnował ([R12.9](#R12.9)) | poleceń i plików według zasad drzewa w `opencode.json`; nie pobierania stron ani przeglądarki ([R12.9](#R12.9)) | zatwierdzić polecenia inne niż `strom`, o które OpenCode zapyta (poza poziomem `full`); zgoda na archiwum | – (OpenCode jest w terminalu) |
| aplikacja OpenCode | aplikacja OpenCode (`strom chat`) | jak przy OpenCode w terminalu | jak przy OpenCode w terminalu (nie sprawdzono, [R12.6](#R12.6)) | według `strom chat` potwierdzić folder i wysłać przygotowaną wiadomość (nie sprawdzono, [R12.6](#R12.6)); zgoda na archiwum | praca samodzielna, czytanie skanów przez czytelników i praca z aplikacji Strom ([R12.9](#R12.9)) |
| samodzielny bieg `strom run` | nigdzie: agent pracuje sam; przebieg pokazuje terminal i aplikacja Strom ([S1.4](S1-connecting-app-and-research.md#S1.4)) | Claude Code: Chrome według zadania ([R9.4.1](R9-archives.md#R9.4.1)); Codex: przeglądarka i sterowanie komputerem wyłączone ([R12.5](#R12.5)); Grok: bez serwerów MCP Claude Code i Cursora ([R12.8](#R12.8)); Antigravity i OpenCode: strom nic nie zmienia | Claude Code i Grok: jak w terminalu; Codex: poleceń `strom`; Antigravity i OpenCode: czego zasady nie dopuszczają, jest odrzucane, nikt nie jest pytany ([R12.7](#R12.7), [R12.9](#R12.9)) | uruchomić bieg; zgoda na archiwum wcześniej, podczas biegu nikogo nie ma ([R9.7](R9-archives.md#R9.7)) | cały bieg: kończy się, zanim padnie pytanie albo szacunek kosztu ([R12.4](#R12.4)) |

- **Pilnuje kod:**
  - hooki stroma w `.claude/settings.json` badania uruchamia Claude Code w terminalu i aplikacja Claude (karta Code);
    Codex w terminalu czyta zasady drzewa w `.codex/rules/strom.rules` i hook stroma w `.codex/hooks.json`, Grok Build
    w `.grok/config.toml` (i hooki stroma w `.grok/hooks/strom.json`), OpenCode w `opencode.json`; Antigravity czyta
    tylko instrukcje w `AGENTS.md`;
  - polecenia, które należą tylko do człowieka (logowanie, pieczęć, zgoda na archiwum i inne), `strom` sam odrzuca
    każdemu agentowi, którego rozpozna, u wszystkich pięciu agentów;
  - z aplikacji agentów nic się nie wyłącza. Jedynym wyjątkiem jest samodzielny bieg z Codexem bez osobistych
    dodatków agenta ([R12.5](#R12.5)).
- **Granice:** sterowania komputerem (computer use) strom nie pilnuje u żadnego agenta: agent steruje nim komputerem
  jak człowiek. Co sterowanie komputerem w aplikacji Strom i w badaniu potrafi, a czego nie, mówi [R12.10](#R12.10).
- **Tylko metodyka:** w każdym sposobie pracy agent uruchamia `strom` w swoim wierszu poleceń i sam z siebie nie używa
  przeglądarki, której strom nie poleca ([R9.4.2](R9-archives.md#R9.4.2)).
- **Obsługa:** terminal: `strom chat` (gdzie, mówi ustawienie `agent.where`: `app` aplikacja agenta, `terminal`
  terminal; bez ustawienia aplikacja, gdy jest zainstalowana), `strom chat --where app|terminal` raz inaczej,
  `strom agents use claude|codex|antigravity|grok|opencode`, `strom doctor` (wiersze **gdzie toczy się rozmowa z agentem**, **agent
  w terminalu**, **przeglądarka (Claude in Chrome)**, **przeglądarka aplikacji desktopowych**, **aplikacja ChatGPT**,
  **hooki Codexa (przeglądarka)**; przy wybranej aplikacji ChatGPT wiersz hooków nazywa się
  **hooki Codexa (Codex w terminalu)**).
- **Obowiązuje od:** badanie 1.29.0
- **Od badania 1.30.0:** wiersz aplikacji ChatGPT: jej przeglądarki strom nie pilnuje ([R12.5.1](#R12.5.1)).

<!-- zdroj: research:src/core/apps.ts DESKTOP_APPS (claude://code/new, codex://new; mac Claude.app, Codex.app, ChatGPT.app) · src/commands/start.ts:156-217 strom chat (where app|terminal, ui.chat.app.open) · src/core/config.ts:311 agent.where, :316 agent.addons · src/agents/files.ts codexRules · src/core/agentcli.ts · src/cli/main.ts:290 (def.person && isAgent) · src/core/which.ts detectAgent · src/commands/setup.ts:556-558 doctor codexhooks (ui.doc.codexhooks; ui.doc.codexhooks.terminal jen při chatgptApp) · assets/lang/pl.json ui.doc.where, ui.doc.cli, ui.doc.browser, ui.doc.desktop · test/vysledek-desktop-chrome.md (Trust workspace, odkaz jen předvyplní zprávu) -->

<a id="R12.2"></a>
## R12.2 Przeglądarka w aplikacji Claude

Aplikacja Claude ma dwie przeglądarki: Chrome z rozszerzeniem Claude in Chrome i własną wbudowaną przeglądarkę.
strom pilnuje obu tak samo.

- **Pilnuje kod (hook przed otwarciem strony):**
  - wbudowana przeglądarka dostaje te same zasady co przeglądarka w Chrome ([R9.4](R9-archives.md#R9.4)): archiwum,
    do którego wolno tylko przeglądarce człowieka, jest bez zgody **przez przeglądarkę** odrzucane z tą samą radą;
    dozwolone zostaje zapisane i trzyma swoje tempo razem z Chrome i pobieraniem stron;
  - narzędzia na stronie (czytanie strony, wyszukiwanie, skrypt) sprawdza się według witryny otwartej ostatnio w tej
    karcie. Karty wbudowanej przeglądarki i Chrome się nie mylą;
  - stron lokalnych (localhost, plik na komputerze) nic nie ogranicza. Most do aplikacji Strom jest zawsze odrzucany.
- **Granice:** której przeglądarki agent użyje, decyduje aplikacja Claude: jej ustawienie **Preferred browser** i to,
  czy rozszerzenie w Chrome jest połączone. Z Chrome jako preferowanym strony idą przez Chrome. Sterowania komputerem
  aplikacji Claude strom nie pilnuje: agent steruje nim komputerem jak człowiek.
- **Tylko metodyka:** strom nie poleca wbudowanej przeglądarki: agent sam z siebie jej nie używa
  ([R9.4.2](R9-archives.md#R9.4.2)).
- **Dlaczego:** aplikacja Claude uruchamia hooki badania także przed swoją wbudowaną przeglądarką, więc strom może
  ocenić każdy adres jak przy Chrome.
- **Obsługa:** aplikacja Claude: ustawienie **Preferred browser**. Terminal: `strom doctor`, wiersz **przeglądarka
  aplikacji desktopowych**, a przy przeglądarce w Chrome **w rozmowie w aplikacji Claude: tak; praca samodzielna
  (strom run --chrome): tylko z Claude Code w terminalu**.
- **Obowiązuje od:** badanie 1.29.0

<!-- zdroj: research:src/core/browser.ts (matcher mcp__(remote-devices__)?Claude_Browser__*) · src/core/chromehook.ts · src/core/webgate.ts browserGate · assets/lang/pl.json ui.doc.desktop.unwatched, ui.doc.browser.apponly · CHANGELOG.pl.md 1.29.0 · test/vysledek-062-u4-desktop.md kroky 1–3 · test/vysledek-1106-vyzkum-062-desktop.md bod 3 · test/vysledek-desktop-chrome.md bod 4, bod 6 -->

<a id="R12.3"></a>
## R12.3 Terminal aplikacji Claude

Aplikacja Claude ma też własny terminal. Polecenia w nim obowiązują tak samo jak w wierszu poleceń agenta.

- **Pilnuje kod (hook przed poleceniem w terminalu aplikacji):**
  - to, co robi tylko człowiek, jest agentowi odrzucane: logowanie (`strom login`), pieczęć (`strom seal`),
    instalacja i usunięcie konektora, zgoda na archiwum (`strom allow`), zatwierdzenie opowieści, rozstrzygnięcie
    hipotezy, odpowiedź na miejsce i inne polecenia człowieka, także z pełną ścieżką do `strom` albo ze zmienną przed
    nim;
  - git, którego badanie agentowi zabrania, jest odrzucany;
  - most do aplikacji Strom jest odrzucany (jego adres i plik, w którym jest).
- **Granice:** strom nie dodaje terminalu aplikacji do dozwolonych poleceń: każde polecenie w nim zatwierdza
  człowiek, jak dotąd. Terminal aplikacji to powłoka logowania użytkownika z jego ścieżką do programów.
- **Tylko metodyka:** agent uruchamia `strom` w swoim wierszu poleceń, nie w terminalu aplikacji.
- **Dlaczego:** zasady stroma dla wiersza poleceń agenta same nie sięgają terminalu aplikacji; hook stroma je
  przenosi.
- **Obsługa:** nic: obowiązuje samo w badaniu.
- **Obowiązuje od:** badanie 1.29.0

<!-- zdroj: research:src/core/desktopterminal.ts desktopTerminalRefusal · src/core/bridgeguard.ts · src/agents/files.ts (CLAUDE.md: use Bash for strom commands … never its terminal) · test/vysledek-1106-vyzkum-062-desktop.md bod 4 · test/vysledek-062-u4-desktop.md krok 4, kroky 5–6 · CHANGELOG.pl.md 1.29.0 -->

<a id="R12.4"></a>
## R12.4 Aplikacja Claude bez Claude Code w terminalu

Do rozmowy wystarczy aplikacja Claude. To, co strom uruchamia sam, wykonuje Claude Code w terminalu.

- **Pilnuje kod:**
  - praca samodzielna (`strom run`), czytanie skanów przez czytelników (`strom read`), poprawki i praca z aplikacji
    Strom bez Claude Code w terminalu kończą się kodem `agent.cli-missing`, zanim padnie pytanie albo szacunek
    kosztu. Komunikat proponuje kontynuować rozmowę w aplikacji (`strom chat`) i instalację Claude Code;
  - most mówi aplikacji Strom tym samym kodem, że czytanie nie jest gotowe;
  - `strom setup` pokazuje wiersz **Claude – aplikacja (praca samodzielna i czytanie skanów wymagają Claude Code)**
    i proponuje instalację Claude Code. Można ją odrzucić; bez człowieka wypisuje się tylko wiersz instalacji;
  - `strom doctor` ostrzega (to nie błąd) w wierszu **agent w terminalu**: **praca samodzielna, czytanie skanów
    i praca z aplikacji Strom wymagają Claude Code w terminalu**; `strom doctor --fix` proponuje instalację;
  - w rozmowie bez Claude Code w terminalu skany czyta czytelnik skanów stroma bezpośrednio w rozmowie (zamiast
    `strom read`).
- **Granice:** kopii Claude Code, którą aplikacja Claude ma w sobie, strom nigdy nie używa: uruchamia tylko Claude
  Code zainstalowany w terminalu.
- **Dlaczego:** rozmowę prowadzi aplikacja, ale pracę samodzielną i czytelników strom uruchamia poleceniem Claude
  Code. Powiedzenie tego z góry oszczędza zgodę i szacunek kosztu, które do niczego by nie prowadziły.
- **Obsługa:** terminal: `strom doctor`, `strom doctor --fix`, `strom setup`, `strom chat`.
- **Obowiązuje od:** badanie 1.29.0

<!-- zdroj: research:src/core/agentcli.ts CLI_MISSING, appWithoutCli, claudeInstallLine · src/commands/setup.ts:471 ui.doc.cli.missing · assets/lang/pl.json ui.setup.cli.apponly · test/vysledek-1106-vyzkum-062-desktop.md bod 5 · prace/1106-vyzkum-062-desktop/pruzkum.md B · CHANGELOG.pl.md 1.29.0 -->

<a id="R12.5"></a>
## R12.5 Codex: w terminalu i w aplikacji ChatGPT

Codex działa w terminalu albo w aplikacji ChatGPT (poprzedzała ją starsza osobna aplikacja Codex). Przeglądarka,
Chrome i sterowanie komputerem to jego wtyczki w jednej konfiguracji Codexu (`~/.codex/config.toml`), którą dzielą
terminal i aplikacja. Przeglądarką Codex steruje kodem w JavaScripcie (narzędzie `js`), nie adresem strony. Hook
stroma przed przeglądarką obowiązuje dla Codexu w terminalu; przeglądarka aplikacji ChatGPT działa przez chmurę ChatGPT
i nie wywołuje żadnego hooka stroma ([R12.5.1](#R12.5.1)).

- **Pilnuje kod:**
  - polecenia `strom` według zasad drzewa dla Codexu (`.codex/rules/strom.rules`): `strom` jest dozwolony; logowanie,
    pieczęć, instalacja i usunięcie konektora oraz git są zabronione. Codex czyta te zasady, gdy człowiek zaufa
    folderowi badania;
  - przed każdym wywołaniem przeglądarki Codexu w terminalu działa hook stroma (`.codex/hooks.json`). Codex uruchamia go, gdy
    człowiek zaufa folderowi badania i potwierdzi hook **strom** w Codexie (Trust). strom niczego nie potwierdza za
    człowieka;
  - adres strony zapisany w kodzie: ta sama decyzja co przy przeglądarce w Chrome ([R9.4](R9-archives.md#R9.4)).
    Archiwum, do którego wolno tylko przeglądarce człowieka, jest bez zgody **przez przeglądarkę** odrzucane z tą
    samą radą; dozwolone zostaje zapisane i trzyma swoje tempo razem z pobieraniem stron tej samej witryny. Dwie
    strony archiwów w jednym wywołaniu są odrzucane: strony idą po jednej. Most do aplikacji Strom jest zawsze
    odrzucany; adresów lokalnych (localhost) hook nie ocenia;
  - kod, który pracuje ze stroną bez adresu (kliknięcie, wstecz): obowiązuje dla niego witryna, którą hook w sesji
    przepuścił ostatnio;
  - kod bez adresu, który strom by widział, i bez takiej witryny: nigdy nie jest odrzucany. Zapisuje się jako
    niepilnowany (`strom net web` go liczy), a agent raz na sesję dostaje radę, by adres każdej strony pisać
    bezpośrednio w wywołaniu;
  - pytania do człowieka Codex z hooka nie przyjmuje: tam, gdzie strom by pytał (więcej zapytań do jednej witryny,
    niż sesji wolno), wywołanie jest odrzucane;
  - samodzielny bieg (`strom run`) z Codexem bez osobistych dodatków agenta (`agent.addons off`, domyślnie) wyłącza
    jego wtyczki, przeglądarkę i sterowanie komputerem. Z `agent.addons on` i w rozmowie zostają takie, jakie ma je
    człowiek;
  - `strom doctor`, `strom setup` i `strom chat` przy Codexie w terminalu mówią, gdy hook stroma czeka na potwierdzenie, zmienił się od
    potwierdzenia, jest w Codexie wyłączony, hooki Codexu są wyłączone, Codex nie ufa folderowi badania albo brakuje
    pliku hooka. Stan odczytują tylko z konfiguracji Codexu. Plik hooka, którego tylko brakuje lub który jest
    nieaktualny, nie jest ostrzeżeniem: zapisze się ponownie sam, gdy strom następnym razem uruchomi agenta
    (`strom chat`, `strom run`), a do tego czasu nic się nie traci.
- **Granice:**
  - dopóki hook nie jest potwierdzony, i znowu po każdej jego zmianie, Codex go pomija: przeglądarki Codexu strom
    wtedy nie pilnuje;
  - sterowanie komputerem Codexu (kod, który steruje innymi aplikacjami) hook zostawia w spokoju: strom go nie
    pilnuje ani nie zapisuje ([R12.10](#R12.10));
  - wyszukiwania w sieci Codexu nie widzi żaden hook;
  - sprawdzenie archiwum (`strom net web --check --browser`) i `strom doctor` liczą z przeglądarką agenta tylko przy
    Claude Code: z Codexem zadanie przy archiwum tylko przez przeglądarkę czeka na skany od człowieka
    ([R9.4.3](R9-archives.md#R9.4.3));
  - bez Codexu w terminalu (tylko aplikacja ChatGPT) strom nie uruchomi pracy samodzielnej, czytania skanów przez
    czytelników ani pracy z aplikacji Strom; kończy się tym samym kodem `agent.cli-missing` co przy Claude
    ([R12.4](#R12.4)).
- **Tylko metodyka:** przeglądarki Codexu agent sam z siebie nie używa: nie wchodzi z nią do archiwum, do którego
  wolno tylko przeglądarce człowieka, a skany zapisuje człowiek ([R9.4.2](R9-archives.md#R9.4.2),
  [R9.6](R9-archives.md#R9.6)). Gdy jej użyje, pisze adres każdej strony bezpośrednio w wywołaniu
  (`tab.goto("https://…")`), po jednej stronie, i nie przeklikuje szeregu stron archiwum.
- **Dlaczego:** przeglądarką Codexu steruje się kodem, nie adresem strony. strom ocenia tylko adres, który w kodzie
  widzi; kodu bez adresu dlatego nie odrzuca, tylko go zapisuje.
- **Obsługa:** Codex w terminalu w folderze badania: **Review hooks** (`/hooks`) → hook **strom** → **Trust**.
  Terminal: `strom doctor` (wiersze **przeglądarka aplikacji desktopowych** i **hooki Codexa (przeglądarka)**; przy
  wybranej aplikacji ChatGPT wiersz hooków nazywa się **hooki Codexa (Codex w terminalu)**),
  `strom agents sync` (zapisuje brakujący plik hooka), `strom net web` (liczba niepilnowanych wywołań),
  `strom config set agent.addons on|off`.
- **Obowiązuje od:** badanie 1.27.0 (przeglądarka i sterowanie komputerem wyłączone w samodzielnym biegu);
  `agent.addons` od 1.14.0; hook przed przeglądarką Codexu i brak Codexu w terminalu od 1.29.0
- **Od badania 1.30.0:** hook pilnuje także przeglądarki, którą Codex otwiera przez `createBrowserTab`; adres w tym
  wywołaniu ocenia się tak samo. Hook się przez to zmienił, więc Codex go pomija, dopóki człowiek nie potwierdzi go
  ponownie (**Trust**). `strom setup` i `strom chat` przy aplikacji ChatGPT o hookach Codexu nie mówią.

<!-- zdroj: research:src/agents/files.ts codexRules (allow strom; forbidden login, seal, connector add/remove, git; „read once the folder is trusted“), CODEX_HOOKS v AGENT_FILES · src/core/codexhook.ts (CODEX_BROWSER_TOOL mcp__node_repl__js, CODEX_HOOK_MATCHER, answerCodexEvent: codeUrls → answerChromeEvent navigate, >1 archiv deny, ask → deny, reachesBridge, loopback, page tool = poslední puštěný host, UNWATCHED + UNWATCHED_HINT jednou za sezení, computerUseOnly sky.* → nic; codexHookState trusted|modified|untrusted|disabled|off|folder|missing jen z config.toml) · src/commands/web.ts (unwatched v strom net web) · src/runners/codex.ts CODEX_CLEAN, codexBrowserOff · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS = claude · src/core/agentcli.ts cliMissing · src/core/apps.ts codex (Codex.app, ChatGPT.app) · assets/lang/cs.json ui.doc.codexhooks.*, ui.doc.codexhooks.missing (bez varování od commitu 9bd14e84), ui.doc.desktop.codex · CHANGELOG.cs.md 1.27.0, 1.29.0 · dirigent:prace/1106-vyzkum-062-codex/karta.md Výsledek · research:v1.30.0 src/core/codexhook.ts CODEX_HOOK_MATCHER ^mcp__[a-z0-9_]+_repl__js$, createBrowserTab; src/core/browserhelp.ts KEPT_WHEN_CONFIRMED, codexInChatgptApp -->

<a id="R12.5.1"></a>
### R12.5.1 Przeglądarka aplikacji ChatGPT

Przeglądarka aplikacji ChatGPT (Codex) działa przez chmurę ChatGPT i nie wywołuje żadnego hooka stroma: strom jej nie
pilnuje, a o stronach decyduje okno dialogowe ChatGPT. W oknie ChatGPT „przeglądarka w chmurze” dla archiwum
z ograniczeniami ([R9.2](R9-archives.md#R9.2)) się odmawia; nigdy nie zezwala się na dostęp do wszystkich
odpowiednich stron.

- **Granice:**
  - przeglądarki aplikacji ChatGPT strom nie pilnuje ani nie zapisuje, niezależnie od tego, czy hook stroma jest
    w Codexie potwierdzony;
  - Codex w terminalu pozostaje pilnowany, gdy tylko hook stroma jest w Codexie potwierdzony ([R12.5](#R12.5)).
- **Dlaczego:** strom ocenia tylko wywołanie, które agent pokaże mu hookiem; przeglądarka w chmurze ChatGPT nie
  wywołuje żadnego hooka. Na Macu 8 listopada 2026 (badanie 1.29.0) hook stroma nie uruchomił się ani razu, gdy
  aplikacja ChatGPT pracowała ze swoją przeglądarką.
- **Obsługa:** terminal: `strom doctor` (wiersz **aplikacja ChatGPT** jako ostrzeżenie: „przeglądarki strom nie
  pilnuje (działa przez chmurę ChatGPT), o stronach decyduje okno dialogowe ChatGPT”, z radą do okna dialogowego),
  `strom setup` (mówi to raz, gdy zostanie wybrana aplikacja ChatGPT).
- **Obowiązuje od:** badanie 1.30.0

<!-- zdroj: research:v1.30.0 (33ac2e38) src/core/browserhelp.ts codexInChatgptApp, browserKept · assets/lang/cs.json ui.doc.chatgptapp, ui.doc.chatgptapp.browser, ui.doc.chatgptapp.advice, ui.setup.chatgpt, ui.doc.desktop.codex · test/cli/browser-advice.test.ts · CHANGELOG.cs.md 1.30.0 · dirigent:spec/062 P6 · dirigent:test/vysledek-062-u4-codex.md (ChatGPT.app 26.1021 a 26.1103: hook-calls.log prázdný) -->

<a id="R12.6"></a>
## R12.6 Czego nie sprawdzono

Tabela [R12.1](#R12.1) opisuje kod badania i to, co sprawdzono na Macu w aplikacji Claude (karta Code). Na żywo nie
sprawdzono jeszcze:

- aplikacji Claude z odłączonym rozszerzeniem w Chrome albo z wbudowaną przeglądarką jako preferowaną: której
  przeglądarki agent wtedy użyje (wynika to tylko z instrukcji aplikacji dla agenta);
- wiersza poleceń agenta w aplikacji Claude i pobierania stron w nim (hooki są te same co w terminalu);
- pilnowania w aplikacji Claude, gdy Claude Code nie ma w terminalu (aplikacja uruchamia hooki własną kopią Claude
  Code);
- Codexu w terminalu na żywo (zasady drzewa, hook przed przeglądarką i jego potwierdzenie, odrzucanie i zapis
  niepilnowanych wywołań, kroki człowieka); hook przed przeglądarką Codexu jest opisany na podstawie kodu;
- aplikacji ChatGPT: otwarcia rozmowy odnośnikiem i kroków człowieka;
- sterowania komputerem Codexu: czy daje aplikacjom poziomy jak aplikacja Claude ([R12.10](#R12.10));
- Antigravity, Grok Build i OpenCode na żywo w żadnym sposobie pracy: zasad i hooków stroma, kroków człowieka,
  odrzucania poleceń człowieka;
- aplikacji OpenCode: otwarcia rozmowy odnośnikiem i tego, że czyta zasady `opencode.json` badania;
- Groka otwartego w folderze badania inaczej niż przez `strom chat` (w folderze, któremu nie ufa): co z zasad
  i hooków stroma wtedy obowiązuje;
- tego, czy Antigravity, Grok Build i OpenCode mają przeglądarkę albo sterowanie komputerem i jak agent ich używa
  (strom ich nie pilnuje);
- aplikacji Claude, ChatGPT i OpenCode w Windows.

- **Obowiązuje od:** badanie 1.29.0

<!-- zdroj: test/vysledek-desktop-chrome.md Neověřeno · test/vysledek-062-u4-desktop.md Neověřeno · test/vysledek-1106-vyzkum-062-desktop.md Neověřeno · dirigent 6. 11. (ChatGPT.app × Codex.app) · spec 062 K5.1 (06. 11.: Antigravity, Grok, OpenCode jen z kódu) · spec 062 Mimo rozsah (Windows) -->

<a id="R12.7"></a>
## R12.7 Antigravity

Antigravity uruchamia się w terminalu poleceniem `agy`. Antigravity ma też aplikację, ale strom nie otwiera w niej
rozmowy (nie zna odnośnika, który by ją otworzył): `strom chat` z Antigravity jest zawsze w terminalu.

- **Pilnuje kod:**
  - `strom setup` (i `strom agents install`) zapisuje w ustawieniach Antigravity zasadę, że `strom` może działać bez
    pytania (`command(strom)`);
  - polecenia, które należą tylko do człowieka, `strom` odrzuca sam ([R12.1](#R12.1));
  - samodzielny bieg (`strom run`): czego ustawienia Antigravity nie dopuszczają, jest odrzucane, nikt nie jest
    pytany. Gdy Antigravity zatrzyma się na odrzuconym poleceniu, strom w tej samej rozmowie każe mu kontynuować
    tylko przez `strom`, najwyżej dwa razy. Na poziomie `full` uprawnienia są pomijane;
  - pobrania stron i wyszukiwania Antigravity w samodzielnym biegu zapisują się w zapisie badania dopiero po tym,
    jak się odbyły.
- **Granice:**
  - Antigravity nie ma hooka przed pobraniem strony, przeglądarką ani poleceniem: granic sieci
    ([R9.3](R9-archives.md#R9.3)), przeglądarki ani sterowania komputerem Antigravity strom wcześniej nie sprawdza;
  - zasad dla plików i gita strom dla Antigravity w folderze badania nie zapisuje;
  - most do aplikacji Strom chronią tylko jego własne kontrole.
- **Tylko metodyka:** instrukcje w `AGENTS.md`: agent pracuje tylko przez `strom`, stronę sprawdza wcześniej
  (`strom net web --check`), sam z siebie nie używa przeglądarki Antigravity i nie idzie z nią do archiwum, do
  którego wolno tylko przeglądarce człowieka ([R9.4.2](R9-archives.md#R9.4.2)).
- **Obsługa:** terminal: `strom agents use antigravity`, `strom chat`, `strom setup`.
- **Obowiązuje od:** badanie 1.0.0; kontynuacja po odrzuconym poleceniu od 1.14.0

<!-- zdroj: research:src/core/apps.ts (Antigravity: no known link, strom talks to it in the terminal) · src/core/apps.ts whereToTalk · src/agents/global.ts allowRules command(strom) · src/commands/setup.ts installGlobal · src/agents/launch.ts antigravity (--mode accept-edits, --dangerously-skip-permissions) · src/runners/antigravity.ts (headless: what would ask is refused; AGY_GO_ON = 2; ANTIGRAVITY_WEB) · src/core/metrics.ts webOpt (from: stream) · src/core/bridgeguard.ts (agent without hooks: Codex, OpenCode, Antigravity) · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS · src/agents/files.ts AGENTS.md body 10, syncAgentFiles (žádný soubor Antigravity) · git tagy v1.0.0, v1.14.0 -->

<a id="R12.8"></a>
## R12.8 Grok Build

Grok Build uruchamia się w terminalu poleceniem `grok`. Żadnej aplikacji Groka strom nie otwiera: `strom chat`
z Grokiem jest zawsze w terminalu.

- **Pilnuje kod:**
  - zasady drzewa w `.grok/config.toml`: `strom` dozwolony; logowanie, pieczęć, instalacja i usunięcie konektora,
    git, dowody badania i ustawienia człowieka zabronione. Grok czyta je tylko w folderze, któremu ufa: `strom chat`
    i `strom run` uruchamiają go z folderem badania jako zaufanym (zapisuje się raz na badanie);
  - hooki stroma w `.grok/hooks/strom.json`: przed pobraniem strony i wyszukiwaniem te same zasady co przy Claude
    Code ([R9.3](R9-archives.md#R9.3)); przed poleceniem w wierszu poleceń agenta odrzucenie mostu do aplikacji
    Strom;
  - samodzielny bieg bez osobistych dodatków (`agent.addons off`, domyślnie): Grok nie przejmuje umiejętności,
    serwerów MCP i hooków Claude Code i Cursora i wyłącza swoją pamięć; hooki stroma w `.grok/hooks` obowiązują
    dalej. Czego zasady nie dopuszczają, jest odrzucane, nikt nie jest pytany; na poziomie `full` obowiązują tylko
    zakazy.
- **Granice:**
  - własne umiejętności, wtyczki i serwery MCP Groka zostają także w samodzielnym biegu: przełącznika na jeden bieg
    Grok nie ma;
  - nieszkodliwe polecenia Grok przepuszcza także według własnego osądu: trzymają zakazy, nie lista dozwolonych;
  - przeglądarki ani sterowania komputerem Groka strom nie pilnuje: pilnuje tylko Claude in Chrome, wbudowanej
    przeglądarki aplikacji Claude ([R12.2](#R12.2)) i przeglądarki Codexu ([R12.5](#R12.5)).
- **Tylko metodyka:** instrukcje w `AGENTS.md` i `.grok/rules/strom.md`: skany Grok czyta sam, sposób delegowania
  z `CLAUDE.md` go nie dotyczy.
- **Obsługa:** terminal: `strom agents use grok`, `strom chat`, `strom config set agent.addons on|off`.
- **Obowiązuje od:** badanie 1.4.0; hooki sieci i samodzielny bieg bez osobistych dodatków od 1.14.0; hook przed
  poleceniem od 1.27.0

<!-- zdroj: research:src/agents/files.ts treeRules(grok), grokConfig, GROK_RULES, grokHooks, GROK_HOOKS · src/core/web.ts grokWebHooks (web_fetch|web_search) · src/core/bridgeguard.ts grokShellHook (run_terminal_command|bash|shell) · src/runners/grok.ts grokTrust (--trust), GROK_CLEAN, dontAsk, --always-approve · src/agents/launch.ts grok · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS · git tagy v1.4.0, v1.14.0, v1.27.0 -->

<a id="R12.9"></a>
## R12.9 OpenCode

OpenCode działa w terminalu albo w aplikacji OpenCode: `strom chat` otwiera ją odnośnikiem z folderem badania
i przygotowaną wiadomością. Model aplikacja bierze z `opencode.json` badania.

- **Pilnuje kod:**
  - zasady drzewa w `opencode.json` w folderze badania: `strom` dozwolony; logowanie, pieczęć, instalacja i usunięcie
    konektora oraz git zabronione; dowodów badania i historii (`.git`) agent nie czyta ani nie zmienia; bez pytania
    zapisuje tylko do notatek (`notes/`) i do konektorów, które buduje; własnych zasad i instrukcji
    (`opencode.json`, `AGENTS.md`, `CLAUDE.md`) agent nie zmienia. O inne polecenia i zapisy OpenCode pyta; na
    poziomie `full` robi bez pytania wszystko, czego zasady nie zabraniają;
  - samodzielny bieg: agent OpenCode `strom-run` z tymi samymi zasadami; to, o co by pytał, jest odrzucane (OpenCode
    inaczej zakończyłby cały bieg przy pierwszym pytaniu);
  - bez OpenCode w terminalu (tylko aplikacja) praca samodzielna, czytanie skanów przez czytelników i praca
    z aplikacji Strom kończą się kodem `agent.cli-missing`, jak przy Claude ([R12.4](#R12.4));
  - pobrania stron i wyszukiwania OpenCode w samodzielnym biegu zapisują się w zapisie badania dopiero po tym, jak
    się odbyły.
- **Granice:**
  - OpenCode nie ma hooka: pobieranie stron i wyszukiwanie zasady dopuszczają, a strom ich wcześniej nie sprawdza
    ([R9.3](R9-archives.md#R9.3)); przeglądarki ani sterowania komputerem, jeśli OpenCode je ma, strom nie pilnuje;
  - osobiste dodatki OpenCode zostają także w samodzielnym biegu: strom nie ma dla nich przełącznika.
- **Tylko metodyka:** instrukcje w `AGENTS.md`: agent pracuje tylko przez `strom`, stronę sprawdza wcześniej
  (`strom net web --check`) i nie idzie do archiwum, do którego wolno tylko przeglądarce człowieka
  ([R9.4.2](R9-archives.md#R9.4.2)).
- **Obsługa:** terminal: `strom agents use opencode`, `strom chat`, `strom chat --where app|terminal`.
- **Obowiązuje od:** badanie 1.0.0; agent `strom-run` od 1.4.0

<!-- zdroj: research:src/agents/files.ts opencodeConfig (bash strom * allow, login/seal/connector add|remove deny, git deny; read data/.git deny; edit notes allow; webfetch/websearch allow), OPENCODE_RUN_AGENT, refused (ask → deny) · src/core/apps.ts opencode (OpenCode.app, opencode://new?cwd=…&q=…) · src/commands/start.ts strom chat (model z opencode.json) · src/agents/launch.ts opencode (--auto) · src/core/agentcli.ts agentCliMissing · src/runners/opencode.ts OPENCODE_WEB · src/runners/runner.ts clean (jen Claude Code, Codex; Grok GROK_CLEAN) · git tagy v1.0.0, v1.4.0 -->

<a id="R12.10"></a>
## R12.10 Sterowanie komputerem (computer use)

Sterowanie komputerem (computer use) obsługuje komputer jak człowiek: zrzuty ekranu, klikanie i pisanie. strom go nie
pilnuje u żadnego agenta i go nie poleca; nic w nim nie wyłącza ani nie włącza.

- **Granice:**
  - aplikacja Claude daje przy sterowaniu komputerem aplikacjom poziomy: przeglądarka tylko do odczytu (zrzut
    ekranu, bez klikania i pisania), terminal tylko do klikania (bez pisania i klawiszy), pozostałe aplikacje
    w pełni. Sterowanie komputerem nie obsłuży więc aplikacji Strom w przeglądarce ani badania w terminalu: aplikacja
    Strom idzie narzędziami strony w przeglądarce (wbudowana przeglądarka aplikacji Claude, Claude in Chrome;
    [A9.4](A9-using-the-app.md#A9.4)), badanie poleceniem `strom` w wierszu poleceń agenta;
  - rozmowa w aplikacji Claude bez folderu badania (karta Chat) ma wiersz poleceń poza komputerem: `strom` nie można
    w niej uruchomić;
  - sterowanie komputerem Codexu hook stroma zostawia w spokoju ([R12.5](#R12.5)). Czy daje aplikacjom poziomy jak
    aplikacja Claude, nie sprawdzono ([R12.6](#R12.6));
  - zasady archiwów obowiązują tak samo także tam, gdzie strom nie pilnuje: tempo, „tylko ręcznie” ([R9](R9-archives.md)).
- **Tylko metodyka:** agent nigdy nie poleca włączyć sterowania komputerem. Gdy je ma: aplikację Strom obsługuje
  narzędziami strony w przeglądarce, nie według punktów ekranu; badanie poleceniem `strom` w swoim wierszu poleceń,
  nigdy przez pisanie w oknie terminalu; zgody i ustawienia człowieka (podkład mapy z OpenStreetMap, sposób
  wysyłania zmian do badania) zostawia człowiekowi i mówi, co na niego czeka.
- **Obsługa:** nic: strom sterowania komputerem nie wyłącza ani nie włącza. Terminal: `strom doctor`, wiersz
  **przeglądarka aplikacji desktopowych**.
- **Obowiązuje od:** badanie 1.29.0

<!-- zdroj: research:src/agents/files.ts AGENTS.md „## When you have computer use“ (Never suggest turning it on; page tools, not pixels; strom in own command line; consents left to the person; archives' rules) · src/core/codexhook.ts computerUseOnly (sky.*) · assets/lang/cs.json ui.doc.desktop.claude, ui.doc.desktop.codex · CHANGELOG.cs.md 1.29.0 · dirigent:test/vysledek-063-pruzkum.md kolo 1 (úrovně aplikací: prohlížeče read, terminály click, ostatní full; Chat bez složky má shell v cloudu) · spec/063-computer-use-usnadnit K1.3 -->
