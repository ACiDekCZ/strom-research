<a id="R12"></a>
# R12 Gdzie agent pracuje i czego strom pilnuje

Z agentem (Claude Code, Codex, Antigravity, Grok Build, OpenCode) rozmawia się w terminalu albo w aplikacji
desktopowej agenta, gdy strom ją otwiera; praca samodzielna biegnie bez rozmowy. Od tego
zależy, gdzie toczy się rozmowa, jakiej przeglądarki agent użyje, czego strom pilnuje, co robi człowiek i co nie
działa bez agenta w terminalu. Zasady archiwów są wszędzie te same ([R9](R9-archives.md)); różni się tylko to, przed
czym strom stoi. Opisuje badanie 1.29.0. Przy zasadach rozróżnia się, czego **pilnuje kod** (polecenie `strom` albo
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
| Codex w terminalu | terminal: Codex w folderze badania (`strom chat --where terminal`) | przeglądarka, Chrome i sterowanie komputerem Codexu, jeśli ma je jego konfiguracja ([R12.5](#R12.5)) | tylko poleceń `strom` według zasad drzewa dla Codexu; nie przeglądarki, sterowania komputerem ani sieci Codexu ([R12.5](#R12.5)) | zaufać folderowi badania (dopiero wtedy obowiązują zasady drzewa); zgoda na archiwum | – (Codex jest w terminalu) |
| aplikacja ChatGPT (Codex) | aplikacja ChatGPT (`strom chat`) | jak przy Codexie w terminalu: ta sama konfiguracja ([R12.5](#R12.5)) | jak przy Codexie w terminalu ([R12.5](#R12.5)) | według `strom chat` potwierdzić folder i wysłać przygotowaną wiadomość (nie sprawdzono, [R12.6](#R12.6)); zgoda na archiwum | praca samodzielna, czytanie skanów przez czytelników i praca z aplikacji Strom ([R12.5](#R12.5)) |
| Antigravity w terminalu | terminal: Antigravity (`agy`) w folderze badania (`strom chat`); aplikacji Antigravity strom nie otwiera ([R12.7](#R12.7)) | przeglądarka Antigravity, jeśli agent ją ma; strom jej nie pilnuje ([R12.7](#R12.7)) | tylko tego, co odrzuci sam `strom`: poleceń, które należą tylko do człowieka; Antigravity nie ma hooka ani zasad w folderze badania ([R12.7](#R12.7)) | zgoda na archiwum | – (Antigravity jest w terminalu) |
| Grok Build w terminalu | terminal: Grok (`grok`) w folderze badania (`strom chat`); żadnej aplikacji Groka strom nie otwiera ([R12.8](#R12.8)) | żadna, której strom by pilnował ([R12.8](#R12.8)) | pobierania stron ([R9.3](R9-archives.md#R9.3)) i poleceń w wierszu poleceń agenta: hooki i zasady stroma w `.grok/` ([R12.8](#R12.8)) | nic więcej: `strom chat` uruchamia Groka z folderem badania jako zaufanym; zgoda na archiwum | – (Grok jest w terminalu) |
| OpenCode w terminalu | terminal: OpenCode w folderze badania (`strom chat --where terminal`) | żadna, której strom by pilnował ([R12.9](#R12.9)) | poleceń i plików według zasad drzewa w `opencode.json`; nie pobierania stron ani przeglądarki ([R12.9](#R12.9)) | zatwierdzić polecenia inne niż `strom`, o które OpenCode zapyta (poza poziomem `full`); zgoda na archiwum | – (OpenCode jest w terminalu) |
| aplikacja OpenCode | aplikacja OpenCode (`strom chat`) | jak przy OpenCode w terminalu | jak przy OpenCode w terminalu (nie sprawdzono, [R12.6](#R12.6)) | według `strom chat` potwierdzić folder i wysłać przygotowaną wiadomość (nie sprawdzono, [R12.6](#R12.6)); zgoda na archiwum | praca samodzielna, czytanie skanów przez czytelników i praca z aplikacji Strom ([R12.9](#R12.9)) |
| samodzielny bieg `strom run` | nigdzie: agent pracuje sam; przebieg pokazuje terminal i aplikacja Strom ([S1.4](S1-connecting-app-and-research.md#S1.4)) | Claude Code: Chrome według zadania ([R9.4.1](R9-archives.md#R9.4.1)); Codex: przeglądarka i sterowanie komputerem wyłączone ([R12.5](#R12.5)); Grok: bez serwerów MCP Claude Code i Cursora ([R12.8](#R12.8)); Antigravity i OpenCode: strom nic nie zmienia | Claude Code i Grok: jak w terminalu; Codex: poleceń `strom`; Antigravity i OpenCode: czego zasady nie dopuszczają, jest odrzucane, nikt nie jest pytany ([R12.7](#R12.7), [R12.9](#R12.9)) | uruchomić bieg; zgoda na archiwum wcześniej, podczas biegu nikogo nie ma ([R9.7](R9-archives.md#R9.7)) | cały bieg: kończy się, zanim padnie pytanie albo szacunek kosztu ([R12.4](#R12.4)) |

- **Pilnuje kod:**
  - hooki stroma w `.claude/settings.json` badania uruchamia Claude Code w terminalu i aplikacja Claude (karta Code);
    Codex czyta zasady drzewa w `.codex/rules/strom.rules`, Grok Build w `.grok/config.toml` (i hooki stroma
    w `.grok/hooks/strom.json`), OpenCode w `opencode.json`; Antigravity czyta tylko instrukcje w `AGENTS.md`;
  - polecenia, które należą tylko do człowieka (logowanie, pieczęć, zgoda na archiwum i inne), `strom` sam odrzuca
    każdemu agentowi, którego rozpozna, u wszystkich pięciu agentów;
  - z aplikacji agentów nic się nie wyłącza. Jedynym wyjątkiem jest samodzielny bieg z Codexem bez osobistych
    dodatków agenta ([R12.5](#R12.5)).
- **Granice:** sterowania komputerem (computer use) strom nie pilnuje u żadnego agenta: agent steruje nim komputerem
  jak człowiek.
- **Tylko metodyka:** w każdym sposobie pracy agent uruchamia `strom` w swoim wierszu poleceń i sam z siebie nie używa
  przeglądarki, której strom nie poleca ([R9.4.2](R9-archives.md#R9.4.2)).
- **Obsługa:** terminal: `strom chat` (gdzie, mówi ustawienie `agent.where`: `app` aplikacja agenta, `terminal`
  terminal; bez ustawienia aplikacja, gdy jest zainstalowana), `strom chat --where app|terminal` raz inaczej,
  `strom agents use claude|codex|antigravity|grok|opencode`, `strom doctor` (wiersze **gdzie toczy się rozmowa z agentem**, **agent
  w terminalu**, **przeglądarka (Claude in Chrome)**, **przeglądarka aplikacji desktopowych**).
- **Obowiązuje od:** badanie 1.29.0

<!-- zdroj: research:src/core/apps.ts DESKTOP_APPS (claude://code/new, codex://new; mac Claude.app, Codex.app, ChatGPT.app) · src/commands/start.ts:156-217 strom chat (where app|terminal, ui.chat.app.open) · src/core/config.ts:311 agent.where, :316 agent.addons · src/agents/files.ts codexRules · src/core/agentcli.ts · src/cli/main.ts:290 (def.person && isAgent) · src/core/which.ts detectAgent · assets/lang/pl.json ui.doc.where, ui.doc.cli, ui.doc.browser, ui.doc.desktop · test/vysledek-desktop-chrome.md (Trust workspace, odkaz jen předvyplní zprávu) -->

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
terminal i aplikacja.

- **Pilnuje kod:**
  - polecenia `strom` według zasad drzewa dla Codexu (`.codex/rules/strom.rules`): `strom` jest dozwolony; logowanie,
    pieczęć, instalacja i usunięcie konektora oraz git są zabronione. Codex czyta te zasady, gdy człowiek zaufa
    folderowi badania;
  - przeglądarki, Chrome i sterowania komputerem Codexu ani jego narzędzi do sieci strom nie pilnuje: nie ma przed
    nimi hooka;
  - samodzielny bieg (`strom run`) z Codexem bez osobistych dodatków agenta (`agent.addons off`, domyślnie) wyłącza
    jego wtyczki, przeglądarkę i sterowanie komputerem. Z `agent.addons on` i w rozmowie zostają takie, jakie ma je
    człowiek.
- **Granice:**
  - bez Codexu w terminalu (tylko aplikacja ChatGPT) strom nie uruchomi pracy samodzielnej, czytania skanów przez
    czytelników ani pracy z aplikacji Strom; kończy się tym samym kodem `agent.cli-missing` co przy Claude
    ([R12.4](#R12.4));
  - sterowania komputerem Codexu strom nie pilnuje: agent steruje nim komputerem jak człowiek.
- **Tylko metodyka:** przeglądarki Codexu agent sam z siebie nie używa: nie wchodzi z nią do archiwum, do którego
  wolno tylko przeglądarce człowieka, a skany zapisuje człowiek ([R9.4.2](R9-archives.md#R9.4.2),
  [R9.6](R9-archives.md#R9.6)).
- **Dlaczego:** przeglądarką Codexu steruje się kodem w JavaScripcie, nie adresem strony, więc strom nie ma jak go
  wiarygodnie ocenić.
- **Obsługa:** terminal: `strom config set agent.addons on|off`, `strom doctor` (wiersz **przeglądarka aplikacji
  desktopowych**). Codex: zaufanie do folderu badania.
- **Obowiązuje od:** badanie 1.27.0 (przeglądarka i sterowanie komputerem wyłączone w samodzielnym biegu);
  `agent.addons` od 1.14.0; brak Codexu w terminalu od 1.29.0

<!-- zdroj: research:src/agents/files.ts codexRules · src/runners/codex.ts CODEX_CLEAN, codexBrowserOff · src/core/browser.ts CODEX_BROWSER_SERVERS · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS = claude · src/core/web.ts · src/core/agentcli.ts cliMissing · src/core/apps.ts codex · test/vysledek-desktop-chrome.md Codex · prace/1106-vyzkum-062-desktop/pruzkum.md A1, A2 · CHANGELOG.pl.md 1.27.0 -->

<a id="R12.6"></a>
## R12.6 Czego nie sprawdzono

Tabela [R12.1](#R12.1) opisuje kod badania i to, co sprawdzono na Macu w aplikacji Claude (karta Code). Na żywo nie
sprawdzono jeszcze:

- aplikacji Claude z odłączonym rozszerzeniem w Chrome albo z wbudowaną przeglądarką jako preferowaną: której
  przeglądarki agent wtedy użyje (wynika to tylko z instrukcji aplikacji dla agenta);
- wiersza poleceń agenta w aplikacji Claude i pobierania stron w nim (hooki są te same co w terminalu);
- pilnowania w aplikacji Claude, gdy Claude Code nie ma w terminalu (aplikacja uruchamia hooki własną kopią Claude
  Code);
- Codexu na żywo: ani w terminalu, ani w aplikacji ChatGPT (zasady drzewa, otwarcie rozmowy odnośnikiem, kroki
  człowieka), ani tego, że aplikacja ChatGPT zachowuje się jak starsza aplikacja Codex;
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
  - przeglądarki ani sterowania komputerem Groka strom nie pilnuje: pilnuje tylko Claude in Chrome i wbudowanej
    przeglądarki aplikacji Claude ([R12.2](#R12.2)).
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
