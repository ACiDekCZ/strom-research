<a id="R13"></a>
# R13 Nahlásit problém: `strom error`

Když se ve výzkumu, při stahování, v aplikaci Strom nebo při instalaci něco pokazí, `strom error` zabalí do jednoho
souboru ZIP to, co je potřeba k poznání, co se stalo. Nic o lidech z rodokmenu do něj nejde a strom nic neodesílá:
soubor pošle člověk sám. Kapitola popisuje výzkum 1.30.0.

<!-- zdroj: dirigent:spec/070-hlaseni-chyby/spec.md · research:6c6e7c3b CHANGELOG.cs.md 1.30.0 (Problém nahlášený v jednom souboru) · strom help error · src/commands/error.ts · src/core/report.ts -->

<a id="R13.1"></a>
## R13.1 Jeden příkaz, jeden soubor

`strom error` vypíše, co zpráva bude obsahovat, zeptá se **Vytvořit zprávu?** a soubor ZIP uloží. Řekne, kde soubor
je, jak je velký a kam ho poslat.

- **Hlídá kód:**
  - soubor jde do složky Stažené soubory, jinak do aktuální složky; ve výzkumu bez složky Stažené soubory do domovské
    složky, nikdy do výzkumu;
  - zpráva má nejvýš 2 MB: delší logy se zkracují;
  - příkaz výzkum jen čte, nic v něm nezapíše;
  - strom nic neodesílá: „Poslat e-mailem na {adresa} s pár slovy, co se stalo. Strom sám nic neodesílá; soubor jde
    předem otevřít a prohlédnout (README.txt říká, co kde je).“
- **Ovládání:** terminál: `strom error`; v nabídce `strom`: **Nastavení → Údržba → Nahlásit problém: jeden soubor ZIP
  k odeslání (nic o lidech z rodokmenu)**.
- **Platí od:** výzkum 1.30.0

<!-- zdroj: research:6c6e7c3b src/commands/error.ts (ctx.readOnly, cíl ZIPu) · src/core/report.ts REPORT_MAX_BYTES · cs.json ui.report.summary, ui.report.create, ui.report.done, ui.report.send, ui.maintenance.title, ui.maintenance.report -->

<a id="R13.2"></a>
## R13.2 Co zpráva obsahuje a co ne

| Oblast | Co v ní je |
|---|---|
| tento počítač | verze a kanál stromu, Node, git, systém, jazyk, volné místo |
| nastavení stromu | bez cest a přihlášení |
| `strom doctor` | všechny kontroly |
| agenti | kteří jsou nainstalovaní, jejich verze, výchozí model, hooky stromu |
| konektory | seznam, verze, povolené servery, poslední test (bez přihlášení) |
| most do aplikace Strom | běh, verze aplikace, poslední synchronizace |
| výzkum v číslech | počty, `strom check`, git, stahování, sezení (bez jmen) |
| technické záznamy | logy stromu za posledních 7 dní (most, úklid, stahování) |
| příkazy | příkazy skončené chybou, včetně příkazů z rozhovoru s agentem |

- **Hlídá kód:**
  - jména, místa, poznámky, přepisy, snímky a e-maily do zprávy nejdou, nebo se nahradí stálými kódy (například
    ‹a1b2c›): stejné slovo má v celé zprávě stejný kód, takže je vidět, že jde o totéž, a ne co to je;
  - cesty se jménem uživatele se maskují; přihlášení, klíče a tokeny nejdou nikdy;
  - výzkumy se ve zprávě jmenují jen R1, R2…, nikdy svou cestou;
  - oblast, kterou přečíst nejde, má ve výpisu ✗ a chybu („nešlo přečíst (…)“); zpráva se udělá z ostatních;
  - v ZIPu je README.txt (co kde je) a report.json.
- **Platí od:** výzkum 1.30.0

<!-- zdroj: research:6c6e7c3b cs.json ui.report.area.* (system, config, doctor, agents, connectors, bridge, research, logs, commands), ui.report.area.failed, ui.report.readme.intro · src/core/redact.ts (stálé kódy) · src/core/cmdlog.ts (výzkumy jen R1, R2…, 6c6e7c3b) · src/commands/error.ts:85-97, :408 -->

<a id="R13.3"></a>
## R13.3 Který problém, jaký příkaz

`--about` přidá podrobnosti jedné oblasti. Jde zadat víckrát.

| Problém | Příkaz |
|---|---|
| stahování se zastaví, selže nebo dlouho čeká | `strom error --about fetch` |
| aplikace Strom: synchronizace, most, strom se neukáže | `strom error --about sync` |
| agent: rozhovor nebo `strom run` se pokazil | `strom error --about agent` |
| instalace nebo aktualizace stromu | `strom error --about install` |
| cokoli na Windows | `strom error --about windows` |
| něco jiného | `strom error` |

- **Co oblast přidá:** stahování podrobně (každé, jeho konektor, čekání a chyby); most podrobně (synchronizace,
  brány aplikace); sezení agenta podrobně (kroky a návratové kódy); instalace podrobně (PATH, aktualizace, zálohy
  instalace); Windows (zásady spouštění PowerShellu, dlouhé cesty, OneDrive).
- **Ovládání:** `--since 2d|1w|12h|RRRR-MM-DD` určí, jak daleko zpět logy jdou (výchozí 7 dní).
- **Platí od:** výzkum 1.30.0

<!-- zdroj: research:6c6e7c3b strom help error (tabulka), REPORT_ABOUT · cs.json ui.report.area.fetch, sync, agent, install, windows -->

<a id="R13.4"></a>
## R13.4 Kde se problém stal a co se stalo

Zpráva říká, kde se problém stal, a může nést popis slovy člověka.

- **Hlídá kód:**
  - člověk u terminálu dostane otázku **Kde se problém stal?**: **v rozhovoru s agentem**, **v terminálu, strom bez
    agenta**, **v aplikaci Strom**, **nevím**; s `--where chat|terminal|app|unknown` se neptá;
  - spuštěno agentem bez `--where`: místo zůstane „nevím“ a strom agentovi řekne, ať se člověka zeptá a příkaz spustí
    znovu;
  - `--note "…"` je popis problému slovy člověka, nejvýš 2000 znaků; jména z výzkumu se v něm maskují.
- **Ovládání:** `strom error --where app --about sync`, `strom error --since 2d --note "stahování se zastavilo
  v půlce"`.
- **Platí od:** výzkum 1.30.0

<!-- zdroj: research:6c6e7c3b src/commands/error.ts (otázka jen interaktivně; pod agentem where unknown) · cs.json ui.report.where.q, .chat, .terminal, .app, .unknown · strom help error --note (≤2000 characters, masked) -->

<a id="R13.5"></a>
## R13.5 Údaje osob jen se souhlasem

Když je problém v konkrétní osobě, rodině nebo knize, jdou její údaje přidat. Jen na výslovné přání.

- **Hlídá kód:**
  - `--with-data` s `--person P…`, `--family F…` nebo `--book B…` přidá soubor data.json: jména, údaje, místa,
    citace a jak jistý je každý údaj. Snímky, poznámky a přepisy ne;
  - člověk u terminálu dostane otázku **Přidat je do zprávy?**;
  - agent musí přidat `--yes-data`, a to jen po výslovném „ano“ člověka v rozhovoru; bez něj příkaz skončí s tím, že
    chybí souhlas.
- **Ovládání:** `strom error --about fetch --with-data --book B0001`.
- **Platí od:** výzkum 1.30.0

<!-- zdroj: research:6c6e7c3b strom help error --with-data, --person, --family, --book, --yes-data · src/core/reportdata.ts · cs.json ui.report.data.q, ui.report.data.add -->

<a id="R13.6"></a>
## R13.6 Rozbitý výzkum, Archiv Stromu a mimo výzkum

- **Hlídá kód:**
  - rozbitý výzkum se jen čte; co přečíst nejde, má ve výpisu ✗ a zbytek zprávy vznikne;
  - v Archivu Stromu zpráva nemá agenty, sezení ani `--about agent`; otázka **Kde se problém stal?** nemá „v rozhovoru
    s agentem“ a místo „v terminálu, strom bez agenta“ nabídne **v terminálu**;
  - spuštěno mimo výzkum: zpráva má každý známý výzkum, jen v číslech a s maskovaným názvem; příkazy skončené chybou
    ze všech.
- **Platí od:** výzkum 1.30.0

<!-- zdroj: research:6c6e7c3b CHANGELOG.cs.md 1.30.0 („Výzkum se jen čte, i rozbitý.“) · src/commands/error.ts (archiv: bez agentů a gate.log; mimo výzkum jen otisky známých výzkumů) · cs.json ui.report.where.terminal.archive, ui.report.area.research.archive -->

<a id="R13.7"></a>
## R13.7 Agent a nahlášení problému

Agent o příkazu ví. Když člověk řekne, že má problém se stromem, nebo chce „poslat chybu“, agent se zeptá, kde se
stal (v tomto rozhovoru, v terminálu bez agenta, nebo v aplikaci Strom), nikdy to neodhaduje, a spustí
`strom error --where …` s `--about`, které sedí, a s `--note` slovy člověka. Pak řekne cestu k souboru a adresu,
kterou strom vypsal.

- **Hlídá kód:** údaje osob přidá agent jen s `--yes-data`, které smí dát jen po výslovném souhlasu člověka
  ([R13.5](#R13.5)).
- **Jen metodika:** agent soubor nikdy neposílá, neotvírá ani nepřepisuje jeho obsah do rozhovoru.
- **Platí od:** výzkum 1.30.0

<!-- zdroj: research:6c6e7c3b src/commands/guide.ts:371-378 (A PROBLEM WITH STROM) · CHANGELOG.cs.md 1.30.0 -->
