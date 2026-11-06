<a id="R12"></a>
# R12 Kde agent pracuje a co strom hlídá

S agentem (Claude Code, Codex, Antigravity, Grok Build, OpenCode) se mluví v terminálu, nebo v desktopové aplikaci
agenta, když ji strom otevírá; samostatná práce běží bez rozhovoru. Podle toho
se liší, kde se mluví, jaký prohlížeč agent použije, co strom hlídá, co udělá člověk a co bez agenta v terminálu
nejde. Pravidla archivů jsou všude stejná ([R9](R9-archives.md)); liší se jen to, před čím strom stojí. Popisuje
výzkum 1.29.0. U pravidel je rozlišeno, co **hlídá kód** (příkaz `strom` nebo hook agenta to odmítne) a co je jen
**pravidlo metodiky**. Co na Macu živě ověřené není, říká [R12.6](#R12.6).

<!-- zdroj: dirigent:spec/062-hlidani-desktop-a-codex/spec.md K5.1, K5.2 · test/vysledek-desktop-chrome.md · test/vysledek-062-u4-desktop.md · test/vysledek-1106-vyzkum-062-desktop.md · research:CHANGELOG.cs.md 1.29.0 · src/core/which.ts AGENTS -->

<a id="R12.1"></a>
## R12.1 Způsoby práce: tabulka

| Způsob práce | Kde se mluví | Prohlížeč agenta | Co strom hlídá | Krok člověka | Bez agenta v terminálu |
|---|---|---|---|---|---|
| Claude Code v terminálu | terminál: Claude Code ve složce výzkumu (`strom chat --where terminal`) | Chrome s rozšířením Claude in Chrome ([R9.4.1](R9-archives.md#R9.4.1)) | prohlížeč v Chromu ([R9.4](R9-archives.md#R9.4)), stažení webu ([R9.3](R9-archives.md#R9.3)), příkazy v příkazové řádce agenta | svolení archivu ([R9.2](R9-archives.md#R9.2)) | – (Claude Code v terminálu je) |
| aplikace Claude (záložka Code) a Claude Code v terminálu | aplikace Claude, záložka Code (`strom chat`) | Chrome s Claude in Chrome, nebo vestavěný prohlížeč aplikace ([R12.2](#R12.2)) | prohlížeč v Chromu i vestavěný prohlížeč aplikace, stažení webu, příkazy v příkazové řádce agenta i v terminálu aplikace ([R12.3](#R12.3)) | potvrdit složku (Trust workspace) a odeslat připravenou zprávu; svolení archivu | nic nechybí: samostatná práce a čtení skenů běží přes Claude Code v terminálu |
| aplikace Claude bez Claude Code v terminálu | aplikace Claude, záložka Code (`strom chat`) | jako v řádku výš | jako v řádku výš | jako v řádku výš; instalace Claude Code, kterou strom nabídne a jde odmítnout ([R12.4](#R12.4)) | samostatná práce (`strom run`), čtení skenů čtenáři (`strom read`) a práce z aplikace Strom ([R12.4](#R12.4)) |
| Codex v terminálu | terminál: Codex ve složce výzkumu (`strom chat --where terminal`) | prohlížeč, Chrome a ovládání počítače Codexu, pokud je má jeho nastavení ([R12.5](#R12.5)) | jen příkazy `strom` podle pravidel stromu pro Codex; prohlížeč, ovládání počítače ani web Codexu ne ([R12.5](#R12.5)) | důvěřovat složce výzkumu (až pak platí pravidla stromu); svolení archivu | – (Codex v terminálu je) |
| aplikace ChatGPT (Codex) | aplikace ChatGPT (`strom chat`) | jako u Codexu v terminálu: stejné nastavení ([R12.5](#R12.5)) | jako u Codexu v terminálu ([R12.5](#R12.5)) | podle `strom chat` potvrdit složku a odeslat připravenou zprávu (není ověřeno, [R12.6](#R12.6)); svolení archivu | samostatná práce, čtení skenů čtenáři a práce z aplikace Strom ([R12.5](#R12.5)) |
| Antigravity v terminálu | terminál: Antigravity (`agy`) ve složce výzkumu (`strom chat`); aplikaci Antigravity strom neotevírá ([R12.7](#R12.7)) | prohlížeč Antigravity, pokud ho agent má; strom ho nehlídá ([R12.7](#R12.7)) | jen to, co odmítne `strom` sám: příkazy, které patří jen člověku; hook ani pravidla ve složce výzkumu Antigravity nemá ([R12.7](#R12.7)) | svolení archivu | – (Antigravity v terminálu je) |
| Grok Build v terminálu | terminál: Grok (`grok`) ve složce výzkumu (`strom chat`); aplikaci Groku strom neotevírá ([R12.8](#R12.8)) | žádný, který by strom hlídal ([R12.8](#R12.8)) | stažení webu ([R9.3](R9-archives.md#R9.3)) a příkazy v příkazové řádce agenta: hooky a pravidla stromu v `.grok/` ([R12.8](#R12.8)) | nic navíc: `strom chat` spustí Grok se složkou výzkumu jako důvěryhodnou; svolení archivu | – (Grok v terminálu je) |
| OpenCode v terminálu | terminál: OpenCode ve složce výzkumu (`strom chat --where terminal`) | žádný, který by strom hlídal ([R12.9](#R12.9)) | příkazy a soubory podle pravidel stromu v `opencode.json`; stažení webu ani prohlížeč ne ([R12.9](#R12.9)) | schválit příkazy mimo `strom`, na které se OpenCode zeptá (mimo úroveň `full`); svolení archivu | – (OpenCode v terminálu je) |
| aplikace OpenCode | aplikace OpenCode (`strom chat`) | jako u OpenCode v terminálu | jako u OpenCode v terminálu (není ověřeno, [R12.6](#R12.6)) | podle `strom chat` potvrdit složku a odeslat připravenou zprávu (není ověřeno, [R12.6](#R12.6)); svolení archivu | samostatná práce, čtení skenů čtenáři a práce z aplikace Strom ([R12.9](#R12.9)) |
| samostatný běh `strom run` | nikde: agent pracuje sám; průběh ukazuje terminál a aplikace Strom ([S1.4](S1-connecting-app-and-research.md#S1.4)) | Claude Code: Chrome podle úkolu ([R9.4.1](R9-archives.md#R9.4.1)); Codex: prohlížeč a ovládání počítače vypnuté ([R12.5](#R12.5)); Grok: bez MCP serverů Claude Code a Cursoru ([R12.8](#R12.8)); Antigravity a OpenCode: strom nic nemění | Claude Code a Grok: jako v terminálu; Codex: příkazy `strom`; Antigravity a OpenCode: co pravidla nedovolí, je odmítnuto, nikdo se neptá ([R12.7](#R12.7), [R12.9](#R12.9)) | spustit běh; svolení archivu předem, při běhu nikdo není u toho ([R9.7](R9-archives.md#R9.7)) | celý běh: skončí dřív, než padne otázka nebo odhad ceny ([R12.4](#R12.4)) |

- **Hlídá kód:**
  - hooky stromu v `.claude/settings.json` výzkumu spouští Claude Code v terminálu i aplikace Claude (záložka Code);
    Codex čte pravidla stromu v `.codex/rules/strom.rules`, Grok Build v `.grok/config.toml` (a hooky stromu
    v `.grok/hooks/strom.json`), OpenCode v `opencode.json`; Antigravity čte jen pokyny `AGENTS.md`;
  - příkazy, které patří jen člověku (přihlášení, pečeť, svolení archivu a další), odmítne `strom` sám každému
    agentovi, kterého pozná, u všech pěti agentů;
  - z aplikací agentů se nic nevypíná. Jediná výjimka je samostatný běh s Codexem bez osobních doplňků agenta
    ([R12.5](#R12.5)).
- **Hranice:** ovládání počítače (computer use) strom nehlídá u žádného agenta: agent jím ovládá počítač jako
  člověk.
- **Jen metodika:** agent ve všech způsobech práce spouští `strom` ve své příkazové řádce a z vlastní vůle nepoužije
  prohlížeč, který strom nedoporučuje ([R9.4.2](R9-archives.md#R9.4.2)).
- **Ovládání:** terminál: `strom chat` (kde, říká nastavení `agent.where`: `app` aplikace agenta, `terminal`
  terminál; bez nastavení aplikace, když je nainstalovaná), `strom chat --where app|terminal` jednou jinak,
  `strom agents use claude|codex|antigravity|grok|opencode`, `strom doctor` (řádky **kde se mluví s agentem**, **agent v terminálu**,
  **prohlížeč (Claude in Chrome)**, **prohlížeč desktopových aplikací**).
- **Platí od:** výzkum 1.29.0

<!-- zdroj: research:src/core/apps.ts DESKTOP_APPS (claude://code/new, codex://new; mac Claude.app, Codex.app, ChatGPT.app) · src/commands/start.ts:156-217 strom chat (where app|terminal, ui.chat.app.open) · src/core/config.ts:311 agent.where, :316 agent.addons · src/agents/files.ts codexRules · src/core/agentcli.ts · src/cli/main.ts:290 (def.person && isAgent) · src/core/which.ts detectAgent · assets/lang/cs.json ui.doc.where, ui.doc.cli, ui.doc.browser, ui.doc.desktop · test/vysledek-desktop-chrome.md (Trust workspace, odkaz jen předvyplní zprávu) -->

<a id="R12.2"></a>
## R12.2 Prohlížeč v aplikaci Claude

Aplikace Claude má dva prohlížeče: Chrome s rozšířením Claude in Chrome a vlastní vestavěný prohlížeč. Strom oba
hlídá stejně.

- **Hlídá kód (hook před otevřením stránky):**
  - vestavěný prohlížeč dostane stejná pravidla jako prohlížeč v Chromu ([R9.4](R9-archives.md#R9.4)): archiv, který
    pouští jen prohlížeč člověka, je bez svolení **přes prohlížeč** odmítnut se stejnou radou; povolený se zapíše
    a drží své tempo spolu s Chromem a stažením webu;
  - nástroje na stránce (čtení stránky, hledání, skript) se kontrolují podle webu, který byl v té záložce otevřen
    naposledy. Záložky vestavěného prohlížeče a Chromu se nepletou;
  - místní stránky (localhost, soubor na počítači) nic neomezuje. Most do aplikace Strom je vždy odmítnut.
- **Hranice:** který prohlížeč agent použije, řídí aplikace Claude: její nastavení **Preferred browser** a to, zda
  je rozšíření v Chromu připojené. S Chromem jako preferovaným jdou weby přes Chrome. Ovládání počítače aplikace
  Claude strom nehlídá: agent jím ovládá počítač jako člověk.
- **Jen metodika:** strom vestavěný prohlížeč nedoporučuje: agent ho z vlastní vůle nepoužije
  ([R9.4.2](R9-archives.md#R9.4.2)).
- **Proč:** aplikace Claude spouští hooky výzkumu i před svým vestavěným prohlížečem, takže strom může každou adresu
  posoudit jako u Chromu.
- **Ovládání:** aplikace Claude: nastavení **Preferred browser**. Terminál: `strom doctor`, řádek **prohlížeč
  desktopových aplikací** a u prohlížeče v Chromu **v rozhovoru v aplikaci Claude ano; samostatná práce (strom run
  --chrome) jen s Claude Code v terminálu**.
- **Platí od:** výzkum 1.29.0

<!-- zdroj: research:src/core/browser.ts (matcher mcp__(remote-devices__)?Claude_Browser__*) · src/core/chromehook.ts · src/core/webgate.ts browserGate · assets/lang/cs.json ui.doc.desktop.unwatched, ui.doc.browser.apponly · CHANGELOG.cs.md 1.29.0 · test/vysledek-062-u4-desktop.md kroky 1–3 (preview_start, navigate: deny; example.com allow) · test/vysledek-1106-vyzkum-062-desktop.md bod 3 (localhost, most, záložky app:) · test/vysledek-desktop-chrome.md bod 4 (Preferred browser), bod 6 -->

<a id="R12.3"></a>
## R12.3 Terminál aplikace Claude

Aplikace Claude má i vlastní terminál. Příkazy v něm platí stejně jako v příkazové řádce agenta.

- **Hlídá kód (hook před příkazem v terminálu aplikace):**
  - co dělá jen člověk, je agentovi odmítnuto: přihlášení (`strom login`), pečeť (`strom seal`), instalace
    a odebrání konektoru, svolení archivu (`strom allow`), schválení vyprávění, rozhodnutí hypotézy, odpověď na
    místo a další příkazy člověka, i s plnou cestou ke `strom` nebo s proměnnou před ním;
  - git, který výzkum agentovi zakazuje, je odmítnut;
  - most do aplikace Strom je odmítnut (jeho adresa i soubor, ve kterém je).
- **Hranice:** strom terminál aplikace mezi dovolené příkazy nepřidává: každý příkaz v něm schvaluje člověk, jako
  dosud. Terminál aplikace je přihlašovací shell uživatele s jeho cestou k programům.
- **Jen metodika:** agent spouští `strom` ve své příkazové řádce, ne v terminálu aplikace.
- **Proč:** pravidla stromu pro příkazovou řádku agenta na terminál aplikace samy nedosáhnou; hook stromu je
  přenese.
- **Ovládání:** nic: platí samo ve výzkumu.
- **Platí od:** výzkum 1.29.0

<!-- zdroj: research:src/core/desktopterminal.ts desktopTerminalRefusal · src/core/bridgeguard.ts · src/agents/files.ts (CLAUDE.md: use Bash for strom commands … never its terminal) · test/vysledek-1106-vyzkum-062-desktop.md bod 4 · test/vysledek-062-u4-desktop.md krok 4 (fish, PATH uživatele), kroky 5–6 · CHANGELOG.cs.md 1.29.0 -->

<a id="R12.4"></a>
## R12.4 Aplikace Claude bez Claude Code v terminálu

Aplikace Claude stačí na rozhovor. Co strom spouští sám, spouští Claude Code v terminálu.

- **Hlídá kód:**
  - samostatná práce (`strom run`), čtení skenů čtenáři (`strom read`), opravy a práce z aplikace Strom bez
    Claude Code v terminálu skončí kódem `agent.cli-missing`, dřív než padne otázka nebo odhad ceny. Hláška nabídne
    pokračovat v rozhovoru v aplikaci (`strom chat`) a instalaci Claude Code;
  - most aplikaci Strom řekne, že čtení není připravené, se stejným kódem;
  - `strom setup` ukáže řádek **Claude – aplikace (samostatná práce a čtení skenů potřebují Claude Code)**
    a nabídne instalaci Claude Code. Jde ji odmítnout; bez člověka se jen vypíše instalační řádek;
  - `strom doctor` varuje (není to chyba) v řádku **agent v terminálu**: **samostatná práce, čtení skenů a práce
    z aplikace Strom potřebují Claude Code v terminálu**; `strom doctor --fix` nabídne instalaci;
  - v rozhovoru bez Claude Code v terminálu čte skeny čtenář skenů stromu přímo v rozhovoru (místo `strom read`).
- **Hranice:** kopii Claude Code, kterou má aplikace Claude v sobě, strom nikdy nepoužije: spouští jen Claude Code
  nainstalovaný v terminálu.
- **Proč:** rozhovor vede aplikace, ale samostatnou práci a čtenáře spouští strom příkazem Claude Code. Říct to
  předem šetří souhlas i odhad ceny, které by k ničemu nevedly.
- **Ovládání:** terminál: `strom doctor`, `strom doctor --fix`, `strom setup`, `strom chat`.
- **Platí od:** výzkum 1.29.0

<!-- zdroj: research:src/core/agentcli.ts CLI_MISSING, appWithoutCli, claudeInstallLine, „The Claude Code a desktop app carries inside it is never used“ · src/commands/setup.ts:471 ui.doc.cli.missing · assets/lang/cs.json ui.setup.cli.apponly, ui.error.agent.cli-missing.app.hint · test/vysledek-1106-vyzkum-062-desktop.md bod 5 (doctor warn, run/read rc 1 ×4 jazyky, setup, most /status a 503, brief strom-scan-reader) · prace/1106-vyzkum-062-desktop/pruzkum.md B (přibalený Claude Code) · CHANGELOG.cs.md 1.29.0 -->

<a id="R12.5"></a>
## R12.5 Codex: v terminálu a v aplikaci ChatGPT

Codex se spouští v terminálu, nebo v aplikaci ChatGPT (starší samostatná aplikace Codex ji předchází). Prohlížeč,
Chrome a ovládání počítače jsou jeho zásuvné moduly v jednom nastavení Codexu (`~/.codex/config.toml`), které
sdílí terminál i aplikace.

- **Hlídá kód:**
  - příkazy `strom` podle pravidel stromu pro Codex (`.codex/rules/strom.rules`): `strom` je dovolený, přihlášení,
    pečeť, instalace a odebrání konektoru a git jsou zakázané. Codex tato pravidla čte, až člověk složce výzkumu
    důvěřuje;
  - prohlížeč, Chrome a ovládání počítače Codexu ani jeho nástroje pro web strom nehlídá: hook před nimi nemá;
  - samostatný běh (`strom run`) s Codexem bez osobních doplňků agenta (`agent.addons off`, výchozí) vypne jeho
    zásuvné moduly, prohlížeč a ovládání počítače. S `agent.addons on` a v rozhovoru zůstanou, jak je člověk má.
- **Hranice:**
  - bez Codexu v terminálu (jen aplikace ChatGPT) strom samostatnou práci, čtení skenů čtenáři ani práci
    z aplikace Strom nespustí; skončí stejným kódem `agent.cli-missing` jako u Claude ([R12.4](#R12.4));
  - ovládání počítače Codexu strom nehlídá: agent jím ovládá počítač jako člověk.
- **Jen metodika:** agent prohlížeč Codexu z vlastní vůle nepoužije: do archivu, kam smí jen prohlížeč člověka, s ním
  nejde a snímky uloží člověk ([R9.4.2](R9-archives.md#R9.4.2), [R9.6](R9-archives.md#R9.6)).
- **Proč:** prohlížeč Codexu se ovládá kódem v JavaScriptu, ne adresou stránky, takže ji strom nemá jak spolehlivě
  posoudit.
- **Ovládání:** terminál: `strom config set agent.addons on|off`, `strom doctor` (řádek **prohlížeč desktopových
  aplikací**). Codex: důvěra složce výzkumu.
- **Platí od:** výzkum 1.27.0 (vypnutí prohlížeče a ovládání počítače v samostatném běhu); `agent.addons` od 1.14.0;
  chybějící Codex v terminálu od 1.29.0

<!-- zdroj: research:src/agents/files.ts codexRules (allow strom; forbidden login, seal, connector add/remove, git; „read once the folder is trusted“) · src/runners/codex.ts CODEX_CLEAN, codexBrowserOff · src/core/browser.ts CODEX_BROWSER_SERVERS · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS = claude · src/core/web.ts (hooky webu jen Claude Code a Grok) · src/core/agentcli.ts cliMissing (každý agent s CLI) · src/core/apps.ts codex (Codex.app, ChatGPT.app) · test/vysledek-desktop-chrome.md Codex · prace/1106-vyzkum-062-desktop/pruzkum.md A1, A2 · CHANGELOG.cs.md 1.27.0 -->

<a id="R12.6"></a>
## R12.6 Co ověřené není

Tabulka [R12.1](#R12.1) popisuje kód výzkumu a to, co bylo ověřené na Macu v aplikaci Claude (záložka Code).
Živě ověřené zatím není:

- aplikace Claude s odpojeným rozšířením v Chromu, nebo s vestavěným prohlížečem jako preferovaným: který prohlížeč
  agent pak zvolí (plyne jen z pokynů aplikace agentovi);
- příkazová řádka agenta v aplikaci Claude a stažení webu v ní (hooky jsou tytéž jako v terminálu);
- hlídání v aplikaci Claude, když Claude Code v terminálu není (aplikace spouští hooky vlastní kopií Claude Code);
- Codex živě: v terminálu ani v aplikaci ChatGPT (pravidla stromu, otevření rozhovoru odkazem, kroky člověka), ani
  že se aplikace ChatGPT chová stejně jako starší aplikace Codex;
- Antigravity, Grok Build a OpenCode živě v žádném způsobu práce: pravidla a hooky stromu, kroky člověka, odmítnutí
  příkazů člověka;
- aplikace OpenCode: otevření rozhovoru odkazem a to, že čte pravidla `opencode.json` výzkumu;
- Grok otevřený ve složce výzkumu jinak než přes `strom chat` (ve složce, které nedůvěřuje): co z pravidel a hooků
  stromu pak platí;
- zda prohlížeč nebo ovládání počítače mají Antigravity, Grok Build a OpenCode a jak je agent použije (strom je
  nehlídá);
- aplikace Claude, ChatGPT a OpenCode na Windows.

- **Platí od:** výzkum 1.29.0

<!-- zdroj: test/vysledek-desktop-chrome.md Neověřeno · test/vysledek-062-u4-desktop.md Neověřeno · test/vysledek-1106-vyzkum-062-desktop.md Neověřeno · dirigent 6. 11. (ChatGPT.app × Codex.app) · spec 062 K5.1 (06. 11.: Antigravity, Grok, OpenCode jen z kódu) · spec 062 Mimo rozsah (Windows) -->

<a id="R12.7"></a>
## R12.7 Antigravity

Antigravity se spouští v terminálu příkazem `agy`. Antigravity má i aplikaci, ale strom v ní rozhovor neotevírá
(odkaz, který by rozhovor otevřel, strom nezná): `strom chat` s Antigravity je vždy v terminálu.

- **Hlídá kód:**
  - `strom setup` (a `strom agents install`) zapíše do nastavení Antigravity pravidlo, že `strom` smí bez ptaní
    (`command(strom)`);
  - příkazy, které patří jen člověku, odmítne `strom` sám ([R12.1](#R12.1));
  - samostatný běh (`strom run`): co nastavení Antigravity nedovoluje, je odmítnuto, nikdo se neptá. Když Antigravity
    u odmítnutého příkazu skončí, strom mu ve stejném rozhovoru řekne, ať pokračuje jen přes `strom`, nejvýš dvakrát.
    Na úrovni `full` se oprávnění přeskočí;
  - stažení webu a hledání Antigravity se v samostatném běhu zapíše do záznamu výzkumu až potom, co proběhlo.
- **Hranice:**
  - hook před stažením webu, prohlížečem ani příkazem Antigravity nemá: hranice webu ([R9.3](R9-archives.md#R9.3)),
    prohlížeč ani ovládání počítače Antigravity strom předem nekontroluje;
  - pravidla souborů a gitu pro Antigravity strom ve složce výzkumu nezapisuje;
  - most do aplikace Strom chrání jen jeho vlastní kontroly.
- **Jen metodika:** pokyny `AGENTS.md`: agent pracuje jen přes `strom`, web si předem ověří (`strom net web --check`),
  prohlížeč Antigravity z vlastní vůle nepoužije a do archivu jen přes prohlížeč člověka s ním nejde
  ([R9.4.2](R9-archives.md#R9.4.2)).
- **Ovládání:** terminál: `strom agents use antigravity`, `strom chat`, `strom setup`.
- **Platí od:** výzkum 1.0.0; pokračování po odmítnutém příkazu od 1.14.0

<!-- zdroj: research:src/core/apps.ts (Antigravity: no known link, strom talks to it in the terminal) · src/core/apps.ts whereToTalk · src/agents/global.ts allowRules command(strom) · src/commands/setup.ts installGlobal · src/agents/launch.ts antigravity (--mode accept-edits, --dangerously-skip-permissions) · src/runners/antigravity.ts (headless: what would ask is refused; AGY_GO_ON = 2; ANTIGRAVITY_WEB) · src/core/metrics.ts webOpt (from: stream) · src/core/bridgeguard.ts (agent without hooks: Codex, OpenCode, Antigravity) · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS · src/agents/files.ts AGENTS.md body 10, syncAgentFiles (žádný soubor Antigravity) · git tagy v1.0.0, v1.14.0 -->

<a id="R12.8"></a>
## R12.8 Grok Build

Grok Build se spouští v terminálu příkazem `grok`. Žádnou aplikaci Groku strom neotevírá: `strom chat` s Grokem je
vždy v terminálu.

- **Hlídá kód:**
  - pravidla stromu v `.grok/config.toml`: `strom` dovolený; přihlášení, pečeť, instalace a odebrání konektoru,
    git, důkazy výzkumu a nastavení člověka zakázané. Grok je čte jen ve složce, které důvěřuje: `strom chat`
    i `strom run` ho spouští se složkou výzkumu jako důvěryhodnou (zapíše se jednou za výzkum);
  - hooky stromu v `.grok/hooks/strom.json`: před stažením webu a hledáním stejná pravidla jako u Claude Code
    ([R9.3](R9-archives.md#R9.3)); před příkazem v příkazové řádce agenta odmítnutí mostu do aplikace Strom;
  - samostatný běh bez osobních doplňků (`agent.addons off`, výchozí): Grok nepřevezme dovednosti, MCP servery
    a hooky Claude Code a Cursoru a vypne svou paměť; hooky stromu v `.grok/hooks` platí dál. Co pravidla
    nedovolí, je odmítnuto, nikdo se neptá; na úrovni `full` platí jen zákazy.
- **Hranice:**
  - vlastní dovednosti, zásuvné moduly a MCP servery Groku zůstanou i v samostatném běhu: přepínač pro jeden běh
    Grok nemá;
  - neškodné příkazy pouští Grok i podle vlastního úsudku: drží zákazy, ne seznam dovoleného;
  - prohlížeč ani ovládání počítače Groku strom nehlídá: hlídá jen Claude in Chrome a vestavěný prohlížeč aplikace
    Claude ([R12.2](#R12.2)).
- **Jen metodika:** pokyny `AGENTS.md` a `.grok/rules/strom.md`: skeny čte Grok sám, způsob delegování z `CLAUDE.md`
  mu nepatří.
- **Ovládání:** terminál: `strom agents use grok`, `strom chat`, `strom config set agent.addons on|off`.
- **Platí od:** výzkum 1.4.0; hooky webu a samostatný běh bez osobních doplňků od 1.14.0; hook před příkazem
  od 1.27.0

<!-- zdroj: research:src/agents/files.ts treeRules(grok), grokConfig, GROK_RULES, grokHooks, GROK_HOOKS · src/core/web.ts grokWebHooks (web_fetch|web_search) · src/core/bridgeguard.ts grokShellHook (run_terminal_command|bash|shell) · src/runners/grok.ts grokTrust (--trust), GROK_CLEAN, dontAsk, --always-approve · src/agents/launch.ts grok · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS · git tagy v1.4.0, v1.14.0, v1.27.0 -->

<a id="R12.9"></a>
## R12.9 OpenCode

OpenCode se spouští v terminálu, nebo v aplikaci OpenCode: `strom chat` ji otevře odkazem se složkou výzkumu
a připravenou zprávou. Model vezme aplikace z `opencode.json` výzkumu.

- **Hlídá kód:**
  - pravidla stromu v `opencode.json` ve složce výzkumu: `strom` dovolený; přihlášení, pečeť, instalace a odebrání
    konektoru a git zakázané; důkazy výzkumu a historie (`.git`) se nečtou ani nemění; bez ptaní se zapisuje jen do
    poznámek (`notes/`) a do konektorů, které agent staví; vlastní pravidla a pokyny (`opencode.json`, `AGENTS.md`, `CLAUDE.md`) agent
    nemění. Na ostatní příkazy a zápisy se OpenCode zeptá; na úrovni `full` udělá bez ptaní vše, co pravidla
    nezakazují;
  - samostatný běh: agent OpenCode `strom-run` se stejnými pravidly; co by se ptalo, je odmítnuto (OpenCode by jinak
    celý běh ukončil u první otázky);
  - bez OpenCode v terminálu (jen aplikace) skončí samostatná práce, čtení skenů čtenáři a práce z aplikace Strom
    kódem `agent.cli-missing`, jako u Claude ([R12.4](#R12.4));
  - stažení webu a hledání OpenCode se v samostatném běhu zapíše do záznamu výzkumu až potom, co proběhlo.
- **Hranice:**
  - hook OpenCode nemá: stažení webu a hledání pravidla dovolují a strom je předem nekontroluje
    ([R9.3](R9-archives.md#R9.3)); prohlížeč ani ovládání počítače, pokud je OpenCode má, strom nehlídá;
  - osobní doplňky OpenCode zůstanou i v samostatném běhu: přepínač pro ně strom nemá.
- **Jen metodika:** pokyny `AGENTS.md`: agent pracuje jen přes `strom`, web si předem ověří (`strom net web --check`)
  a do archivu jen přes prohlížeč člověka nejde ([R9.4.2](R9-archives.md#R9.4.2)).
- **Ovládání:** terminál: `strom agents use opencode`, `strom chat`, `strom chat --where app|terminal`.
- **Platí od:** výzkum 1.0.0; agent `strom-run` od 1.4.0

<!-- zdroj: research:src/agents/files.ts opencodeConfig (bash strom * allow, login/seal/connector add|remove deny, git deny; read data/.git deny; edit notes allow; webfetch/websearch allow), OPENCODE_RUN_AGENT, refused (ask → deny) · src/core/apps.ts opencode (OpenCode.app, opencode://new?cwd=…&q=…) · src/commands/start.ts strom chat (model z opencode.json) · src/agents/launch.ts opencode (--auto) · src/core/agentcli.ts agentCliMissing · src/runners/opencode.ts OPENCODE_WEB · src/runners/runner.ts clean (jen Claude Code, Codex; Grok GROK_CLEAN) · git tagy v1.0.0, v1.4.0 -->
