<a id="R9"></a>
# R9 Archivy: co smí agent a co udělá člověk

Co se stane s úkolem, který potřebuje snímky nebo stránky konkrétního archivu: podle čeho strom archiv posoudí, co
smí agent sám (stahovač, stažení webu, prohlížeč), kdy úkol čeká na člověka a jak se vrátí do fronty. Platí stejně
pro automatické sezení (`strom run`, sezení spuštěné z aplikace Strom, noční běh) i pro chat s agentem; rozdíly jsou
v [R9.7](#R9.7). Popisuje výzkum 1.27.0 a aplikaci Strom 3.23.0. U pravidel je rozlišeno, co **hlídá kód** (příkaz
`strom` nebo hook agenta to odmítne) a co je jen **pravidlo metodiky** (pokyn agentovi, který kód nekontroluje).

Postup v kostce:

1. **Archiv:** strom zná podmínky archivů ze seznamu dodaného s výzkumem a z dalších zdrojů. Rozhoduje nejpřísnější
   z nich ([R9.1](#R9.1)).
2. **Svolení:** archiv s omezením otevře jen svolení člověka: pomalu, přes prohlížeč, nebo jen ručně
   ([R9.2](#R9.2)).
3. **Agent sám:** stahovač archivu (snímky, [R8.2](R8-reading-scans.md#R8.2)), stažení stránek webu
   ([R9.3](#R9.3)) a prohlížeč agenta v Chrome ([R9.4](#R9.4), [R9.5](#R9.5)) se řídí stejnými pravidly.
4. **Čekání:** kam agent nesmí, tam snímky uloží člověk. Úkol čeká na snímky a vrátí se sám, až jsou ve výzkumu
   všechny ([R9.6](#R9.6)).
5. **Rozhodnutí:** tabulka a průběh úkolu jsou v [R9.8](#R9.8), kroky člověka v [R9.9](#R9.9) a příklady v
   [R9.10](#R9.10).

> **Poznámka: kde přesně platí prohlížeč agenta.** Prohlížeč agenta hlídá strom u **Claude Code** s rozšířením
> **Claude in Chrome**, ve vestavěném prohlížeči aplikace Claude ([R12.2](R12-where-the-agent-works.md#R12.2))
> a v prohlížeči Codexu podle adres v jeho kódu, když člověk potvrdil hook stromu
> ([R12.5](R12-where-the-agent-works.md#R12.5)). Prohlížeč jiného agenta (Antigravity a další) a ovládání počítače
> žádného agenta strom hlídat neumí: agent s nimi do archivu, kam smí jen prohlížeč člověka, sám nejde a snímky
> uloží člověk. Vestavěné prohlížeče a ovládání
> počítače desktopových aplikací agentů strom nedoporučuje; agent je použije jen na výslovnou žádost člověka
> ([R9.4.2](#R9.4.2)). Kde se s agentem mluví a co strom kde hlídá, shrnuje [R12](R12-where-the-agent-works.md).

<!-- zdroj: research:CHANGELOG.cs.md 1.27.0, 1.29.0 · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS, ON_REQUEST · src/core/chromehook.ts:1-25 · src/core/codexhook.ts · app:CHANGELOG.cs.md 3.23.0 -->

<a id="R9.1"></a>
## R9.1 Druhy archivů

Každý web, ze kterého výzkum bere záznamy, má **úroveň** podmínek a může mít další meze. Úroveň říká, co smí strom
dělat automaticky; podrobná tabulka úrovní je v [R8.2](R8-reading-scans.md#R8.2).

| Údaj v seznamu archivů | Co znamená |
|---|---|
| úroveň **dovoleno** | katalog, stránky i snímky automaticky, v tempu služby |
| úroveň **omezeno** | katalog a stránky; snímky jen se svolením člověka ([R9.2](#R9.2)) |
| úroveň **neznámé** | jako omezeno |
| úroveň **jen ručně** | snímky jen ručně; svolení to neotevře |
| úroveň **zakázáno** | žádný automatický přístup |
| **jen přes prohlížeč člověka** | žádné stažení webu, katalog ani snímky přes stahovač; nejvýš prohlížeč agenta se svolením „přes prohlížeč“ ([R9.4](#R9.4)) |
| **tempo** | nejkratší odstup a nejvýš požadavků za hodinu; strom nikdy nejde rychleji |
| **zakázané cesty** | části webu, kam nesmí nic automatického, ani prohlížeč agenta |
| **obrazový server** | jiný web, ze kterého prohlížeč snímků archivu bere obrázky |
| **podmínky, citace, datum kontroly** | odkud úroveň je (stránka podmínek nebo robots.txt) a kdy se ověřila |

- **Hlídá kód:** úroveň archivu je nejpřísnější z: čtení podmínek stahovačem, záznamu archivu ve výzkumu, seznamu
  archivů dodaného s výzkumem (`assets/archives.json`), nejpřísnější úrovně, kterou strom u serveru kdy viděl, a
  souboru robots.txt. Server, jehož robots.txt zavírá celý web všem robotům (`Disallow: /`), platí za web jen přes
  prohlížeč člověka s úrovní nejméně omezeno: prohlížeč agenta tam smí jen se svolením „přes prohlížeč“, po jedné
  stránce a tempem člověka ([R9.4](#R9.4)). Výjimka: podmínky webu automatické použití výslovně dovolují a robots.txt
  nejmenuje agenty AI. Server, který klienta stromu odmítl, platí za zakázaný.
- **Jen ručně** (snímky uloží vždy člověk, svolení to neotevře) zůstává, co tak vede seznam archivů:
  - cesta k záznamům, kterou robots.txt zavírá všem robotům (zakázaná cesta v seznamu);
  - úroveň **jen ručně**: podmínky, které nic jiného nedovolují, nebo jmenovitý zákaz agentů AI tam, kde ho seznam
    vede jako jen ručně (např. eBadatelna SOA Praha, [R9.10.3](#R9.10.3)). Jmenovitý zákaz AI v robots.txt sám o
    sobě jen ručně neznamená: archiv s ním může být i jen přes prohlížeč člověka;
  - prohlížeč snímků, který bere obrázky z obrazového serveru zavřeného celého všem robotům. Takový archiv má v
    seznamu úroveň **jen ručně** (např. badatelny ZA Opava a SOA Litoměřice, [R9.10.2](#R9.10.2)).
- **Hranice:**
  - archiv jen přes prohlížeč s úrovní **jen ručně** nebo se svolením **jen ručně** nedovolí nic, ani prohlížeč
    agenta, ani katalog;
  - zakázaná cesta `/` (celý obrazový server) zavře i prohlížeč agenta: snímky jen ručně;
  - weby jednoho archivu (např. digitální archiv a badatelna jednoho zemského archivu) mají každý svůj záznam;
    v Co čeká se ale ukazují pod jedním jménem archivu ([R9.6](#R9.6)).
- **Proč:** metodika chce dodržet podmínky každého archivu. Kam robots.txt pustí jen prohlížeč, jde nejvýš prohlížeč
  se svolením člověka a jeho tempem; co seznam archivů nechává na ruce člověka, ukládá člověk.
- **Ovládání:** terminál: `strom net web --check <adresa>` (co by strom udělal s adresou), menu archivů, `strom
  allow archive` (jen člověk). Aplikace: Čeká na vyřízení.
- **Platí od:** výzkum 1.14.0. Další archivy Česka, Německa a Polska a obrazový server od 1.27.0.

<!-- zdroj: research:src/core/terms.ts:566-680 archiveLevel (robots "Disallow: /" → browserOnly, restricted; robotsYield: openByTerms + robotsNamesAi false), :789-803 allows (browserOnly + manual → nothing) · assets/archives.json (level, browserOnly, pace, disallow, imagesFrom, quote, quoteFrom, checked; metrikai.lt, lagis, gov, online-ofb restricted + browserOnly; ebadatelna.soapraha.cz manual) · src/core/knownterms.ts imagesFrom · test/unit/known-terms.test.ts (imagesFrom closed whole ⇒ manual) · src/core/browserhelp.ts browserHelps (disallow "/") · CHANGELOG.cs.md 1.26.0, 1.27.0 (c3ee4422) -->

<a id="R9.1.1"></a>
### R9.1.1 Web, který výzkum nezná

- Web, který není v seznamu archivů ani nemá stahovač, posoudí strom podle záznamu archivu ve výzkumu, nejpřísnější
  viděné úrovně a robots.txt, jak ho strom přečetl. Bez dalšího údaje má úroveň **neznámé**, tedy jako omezeno.
- Stránky takového webu agent stáhnout smí, v mezích [R9.3](#R9.3). Snímky ne: snímky archivu, který není
  dovolený, nikdy nejdou přes stažení webu.
- **Ovládání:** terminál: `strom net web --check <adresa>`.
- **Platí od:** výzkum 1.14.0

<!-- zdroj: research:src/core/terms.ts:566-680 archiveLevel (unknown → restricted) · src/core/webgate.ts webGate (images of a non-allowed archive) -->

<a id="R9.2"></a>
## R9.2 Svolení člověka

Archiv s úrovní omezeno nebo neznámé otevře pro snímky jen svolení člověka. Svolení má tři způsoby a dává ho jen
člověk.

| Způsob (terminál) | Text volby | Co agent smí |
|---|---|---|
| `--way slow` | Pomalu, lidským tempem | snímky přes stahovač, nejvýš jeden za 10 s a 120 za hodinu |
| `--way browser` | Přes prohlížeč na tomto počítači | stahovač s cestou přes prohlížeč, nebo prohlížeč agenta po jednom snímku ([R9.5](#R9.5)) |
| `--way manual` | Jen ručně – snímky se uloží do připravené složky | nic; snímky uloží člověk ([R9.6](#R9.6)) |

- **Hlídá kód:**
  - svolení dá jen člověk: ve svém terminálu, nebo v systémovém okně, které se ukáže, když příkaz spustí agent nebo
    aplikace. Agent okno nevidí a nemůže na něj kliknout. V automatickém sezení bez okna příkaz selže a agent si
    zapíše úkol pro člověka;
  - svolení platí pro archiv ve všech výzkumech na počítači a je uložené v nastavení uživatele. Odvolá se volbou
    **Zapomenout rozhodnutí** (`--revoke`): při další potřebě se strom zeptá znovu;
  - archiv jen přes prohlížeč nikdy nedostane **pomalu** (snímky nikdy přes stahovač). Archiv jen přes prohlížeč,
    ke kterému nevede žádný stahovač, dostane jen **přes prohlížeč**, **jen ručně**, nebo odvolání;
  - úroveň **jen ručně** a **zakázáno** svolení neotevře: `strom allow archive … --way browser` (i `slow`) se
    odmítne a aplikace odkaz **Svolení…** nenabídne;
  - tempo člověka (10 s, 120 za hodinu) jde změnit v nastavení `archive.pace` nebo `strom allow host --pace
    --per-hour`. Tempo ze seznamu archivů je spodní mez: strom jde vždy pomaleji z obou.
- **Hranice:** po rozhodnutí se vrátí do fronty úkoly čekající na tento archiv ve všech výzkumech na počítači. Při
  volbě **Jen ručně** čekají dál úkoly na ručně uložené snímky. Úkol, jehož snímky už leží ve složce, se nevrátí: snímky
  se převezmou ([R9.6](#R9.6)). Úkol **ověřit web** se neprobudí nikdy ([R6.2.2](R6-awaiting-action.md#R6.2.2)).
- **Proč:** zmírnit archiv nebo ho otevřít smí jen člověk; agent smí archiv jen zpřísnit.
- **Ovládání:** terminál: `strom allow archive <web|stahovač> --way slow|browser|manual`, `--revoke`, menu archivů.
  Aplikace: odkaz **Svolení…** v poznámce u položky, která čeká na snímky archivu jen přes prohlížeč, a v řádku
  **Prohlížeč** ([R9.4.3](#R9.4.3)). Otevře otázku ve výzkumu v terminálu, i když k archivu nevede žádný stahovač.
- **Platí od:** výzkum 1.14.0. Svolení archivu jen přes prohlížeč bez stahovače a **Svolení…** k němu od 1.27.0.

<!-- zdroj: research:src/commands/archives.ts:575-738 allow archive (requireHuman :687, browserOnly + slow refused, bareArchive) · src/cli/context.ts:253 requireHuman · src/core/archivewait.ts:188 wakeForArchive (manual + images kept, saved in inbox) · src/core/terms.ts:1018 humanPace · src/core/net.ts:45 HUMAN_PACE · assets/lang/cs.json ui.archive.way.* · commit 74dcd58b -->

<a id="R9.3"></a>
## R9.3 Stažení webu agentem

Stránky webu (katalog, výsledky hledání, popis knihy) stahuje agent svým nástrojem pro web. Strom ho kontroluje
hookem před každým stažením a počítá požadavky na každý web.

- **Hlídá kód (hook agenta a `strom net web --check`):**
  - archiv zakázaný nebo web, který klienta stromu odmítl: jen stránka podmínek, nejvýš 3krát za den, a robots.txt;
  - archiv jen přes prohlížeč člověka: žádné stažení webu. Agent dostane radu: svolení „přes prohlížeč“, nebo
    čekání na snímky (`strom task wait T… --images B…:<čísla>`);
  - archiv jen ručně, svolení jen ručně a zakázaná cesta ze seznamu archivů: jen ručně, ani prohlížeč agenta;
  - cesta, kterou zakazuje robots.txt: odmítnuto;
  - snímky archivu, který není dovolený: nikdy přes stažení webu.
- **Hranice:**
  - po 12 požadavcích na jeden web v sezení jde na celý web nejvýš jeden požadavek za 6 s a strom radí stahovač;
  - po 30 požadavcích na jeden web v sezení (nastavení `web.perHost`): v automatickém sezení odmítnuto, v chatu se
    strom jednou za sezení a web zeptá člověka;
  - na volné místo strom čeká nejvýš 30 s; odmítnuto je i tehdy, když web strom nechává být, má vyčerpaný limit nebo
    hodinový strop.
- **Jen metodika:** u odmítnutého webu nejdřív jiná cesta. Hledání se zapíše s výsledkem neprůkazné (`strom search
  add … --result inconclusive`). Teprve když je pramen dál nutný, úkol čeká na člověka, aby web ověřil
  (`strom task wait --check`, [R6.2.2](R6-awaiting-action.md#R6.2.2)).
- **Proč:** stažení webu i prohlížeč agenta se počítají a zpomalují spolu, aby žádná cesta nešla rychleji než jiná.
- **Ovládání:** terminál (agent): `strom net web --check <adresa>`.
- **Platí od:** výzkum 1.14.0

<!-- zdroj: research:src/core/webgate.ts webGate (TERMS_PER_DAY, browserOnly advice, otherWay) · src/core/web.ts WEB_SOFT 12, WEB_SOFT_GAP_MS, WEB_PER_HOST 30, WEB_WAIT_MAX_MS · src/core/config.ts web.perHost · assets/method/locate.md -->

<a id="R9.4"></a>
## R9.4 Prohlížeč agenta

Prohlížeč agenta je Chrome s rozšířením **Claude in Chrome**, který ovládá **Claude Code**. Strom před každým
otevřením stránky rozhodne stejně jako u stažení webu ([R9.3](#R9.3)), jen na cestě prohlížeče člověka. Stejně
hlídá i vestavěný prohlížeč aplikace Claude ([R12.2](R12-where-the-agent-works.md#R12.2)).

- **Hlídá kód (hook před otevřením stránky):**
  - archiv jen přes prohlížeč člověka a snímky archivu s omezením se otevřou jen se svolením **přes prohlížeč**,
    po jedné stránce, tempem člověka. Zakázané cesty ze seznamu archivů zůstanou zavřené;
  - archiv zakázaný, web, který klienta stromu odmítl, cesta zakázaná v robots.txt, snímky jen ručně a most do
    aplikace Strom: odmítnuto;
  - každé otevření stránky se zapíše, počítá a zpomaluje spolu se staženími téhož webu (stejné meze jako
    [R9.3](#R9.3));
  - nástroje na stránce (klikání, čtení stránky, skript) se kontrolují podle webu posledního otevření v kartě. Web,
    který strom nyní nechává být, je odmítnut; ostatní se nepočítá;
  - nahrát soubor, nahrát obrázek, zkratky, záznam GIF a dávka akcí jsou agentovi zakázané.
- **Hranice:** hook nevidí kliknutí ani adresu napsanou do stránky, ani požadavky, které stránka dělá sama. Proto
  pravidlo: ze stránky na stránku archivu jen otevřením adresy, nikdy proklikáním řady stránek.
- **Jen metodika:** kontrolu, zda je u počítače člověk (Altcha, CAPTCHA, botová kontrola), agent nikdy neprochází ani
  neobchází.
- **Proč:** jen u Claude Code může strom spustit hook před otevřením stránky; u ostatních agentů žádný takový hook
  není (ověřeno 4. 11. 2026).
- **Ovládání:** terminál: `strom doctor` (řádek **prohlížeč (Claude in Chrome)**), `strom agents use claude`.
- **Platí od:** výzkum 1.27.0

<!-- zdroj: research:src/core/chromehook.ts:1-25 (navigate, page tools, what the hook cannot see) · src/core/webgate.ts browserGate · src/core/browser.ts CHROME_DENY · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS · assets/lang/cs.json ui.doc.browser · CHANGELOG.cs.md 1.27.0 -->

<a id="R9.4.1"></a>
### R9.4.1 Kdy sezení dostane Chrome

- Nastavení `agent.browser` platí pro sezení Claude Code, která spouští strom:
  - **archives** (výchozí): Chrome jen ve výzkumu, jehož stahovač stahuje přes prohlížeč, nebo s archivem jen přes
    prohlížeč se svolením **přes prohlížeč**, pro jejich weby;
  - **always**: Chrome v každém sezení, pro weby archivů výzkumu; na jiné weby se chat zeptá. Zapne ho jen člověk.
- Automatické sezení zapne Chrome podle úkolu: ne pro vyprávění a dotazy, ano pro knihu ze stahovače přes
  prohlížeč, pro archiv jen přes prohlížeč se svolením a pro web, který výzkum nezná. Chat dostane Chrome podle
  nastavení výše.
- V automatickém sezení agent nemůže přepnout na jiný prohlížeč ani se ptát člověka.
- **Ovládání:** terminál: `strom config set agent.browser archives|always`.
- **Platí od:** výzkum 1.14.0. Archiv jen přes prohlížeč se svolením od 1.27.0.

<!-- zdroj: research:src/core/connector.ts agentBrowser, sessionBrowser · src/commands/start.ts:244 chrome · src/runners/claude.ts RUN_DISALLOWED (AskUserQuestion, switch_browser) · src/core/config.ts agent.browser -->

<a id="R9.4.2"></a>
### R9.4.2 Vestavěné prohlížeče a ovládání počítače: nedoporučené

- Ve výzkumu se z desktopových aplikací agentů nic nevypíná. Vestavěný prohlížeč aplikace Claude (i její náhled)
  strom hlídá jako Claude in Chrome ([R12.2](R12-where-the-agent-works.md#R12.2)), prohlížeč aplikace ChatGPT
  (Codex) podle adres v jeho kódu, až člověk potvrdí hook stromu ([R12.5](R12-where-the-agent-works.md#R12.5)).
  Ovládání počítače aplikace Claude ani aplikace ChatGPT strom nehlídá
  ([R12.10](R12-where-the-agent-works.md#R12.10)). Žádné z nich strom nedoporučuje.
- **Jen metodika:** agent je sám od sebe nepoužije: do archivu, kam smí jen prohlížeč člověka, s nimi nejde a snímky
  uloží člověk ([R9.6](#R9.6)). Když o ně člověk výslovně požádá, je to volba člověka: agent jednou větou řekne, zda
  strom tuto cestu hlídá, a co říkají podmínky archivu. Podmínky nikdy neobchází a kontrolu, zda je u počítače
  člověk, nikdy neprochází.
- Agent nikdy nepracuje v kopii výzkumu, kterou desktopová aplikace agenta otevře ve vlastním worktree.
- **Proč:** před nehlídanými strom nemá žádný hook, takže stránky, které otevřou, nekontroluje. Stahovač archivu,
  stažení stránek webu a prohlížeč agenta v Chrome se pravidly archivů řídí vždy ([R9.3](#R9.3), [R9.4](#R9.4)).
- **Ovládání:** terminál: `strom doctor`, řádek **prohlížeč desktopových aplikací**.
- **Platí od:** výzkum 1.27.0; 1.29.0: vestavěný prohlížeč aplikace Claude a prohlížeč Codexu hlídané

<!-- zdroj: research:src/core/browserhelp.ts ON_REQUEST, browserKept · src/core/browser.ts CODEX_BROWSER_SERVERS, Claude_Browser matcher · src/brief/brief.ts · src/commands/guide.ts · src/commands/setup.ts:527 desktop · assets/lang/cs.json ui.doc.desktop.unwatched · CHANGELOG.cs.md 1.27.0, 1.29.0 · commit 6968ab72 (agent řekne, zda strom cestu hlídá) -->

<a id="R9.4.3"></a>
### R9.4.3 Stav prohlížeče ve strom doctor a v aplikaci

Řádek **prohlížeč (Claude in Chrome)** ve `strom doctor` u archivů jen přes prohlížeč, se kterými výzkum pracuje:

| Stav | Co řádek říká |
|---|---|
| jiný agent než Claude Code | jen přes prohlížeč člověka; s Claude Code a rozšířením by snímky uložil agent sám, s tímto agentem se ukládají ručně (rada `strom agents use claude`) |
| chybí rozšíření | jen přes prohlížeč člověka; s rozšířením Claude in Chrome by snímky uložil agent sám, do té doby ručně (s odkazem na rozšíření) |
| chybí svolení | se svolením „přes prohlížeč“ pro archiv uloží snímky agent sám |
| vše připravené | snímky ukládá agent sám přes prohlížeč |

- Stejnou radu dá jednou brief agenta a Co čeká ([R9.6](#R9.6)).
- Aplikace ukazuje řádek **Prohlížeč** pod řádkem **Agent** v dialogu **Výzkum u stromu** a **Výzkum je připravený**:
  **Claude in Chrome připojen.**, s archivy jen přes prohlížeč **… agent stahuje i z archivů jen přes prohlížeč**
  (bez svolení u některých: **Bez svolení:** první tři archivy, každý s odkazem **Svolení…**), **Rozšíření Claude in
  Chrome chybí – snímky z archivů jen přes prohlížeč ukládá člověk.**, nebo u jiného agenta **prohlížeč agenta strom
  nehlídá**. U položky, která čeká na snímky takového archivu, stojí stejná rada jako poznámka. Výzkum, který slouží
  jako archiv, řádek nemá.
- **Ovládání:** terminál: `strom doctor`. Aplikace: dialog **Výzkum u stromu**, Čeká na vyřízení.
- **Platí od:** výzkum 1.27.0

<!-- zdroj: research:src/commands/setup.ts:490-516 · src/core/browserhelp.ts browserState, agentBrowserAdvice, personBrowserNote · assets/lang/cs.json ui.doc.browser.archives.* · app:src/research-browser.ts:75-98 browserRow, :170-201 browserNote · src/ui/research-browser-ui.ts:96-144 · src/strings.ts research.browser -->

<a id="R9.5"></a>
## R9.5 Snímek přes prohlížeč agenta

Kde člověk archivu jen přes prohlížeč dal svolení **přes prohlížeč**, agent uloží snímky sám, po jednom: otevře
snímek v Chrome a uloží to, co ukazuje prohlížeč snímků archivu.

- **Hlídá kód:**
  - jen Claude Code s rozšířením Claude in Chrome a se svolením **přes prohlížeč**; jinak příkaz odmítne a řekne, co
    zbývá;
  - adresa snímku projde kontrolou prohlížeče agenta ([R9.4](#R9.4));
  - uloží se jen snímek, který karta ukazuje na své vlastní adrese. Prohlížeč posunutý na jiný snímek se odmítne a
    nic se neuloží. Nikdy víc, než prohlížeč archivu dává, nikdy větší než originál;
  - příkaz nastaví úkol na čekání na ten snímek. Soubor se uloží do složky stažených souborů (`strom-T…-<číslo>.jpg`)
    a `strom media add --inbox --waiting` ho přesune do složky úkolu pod číslem snímku ([R9.6](#R9.6)).
- **Hranice:** Chrome uloží z jedné stránky jen jeden soubor. Další stažení z téže stránky musí dovolit člověk v
  adresním řádku Chrome; agent nastavení Chrome nikdy nemění. Snímek, jehož soubor ani 5 s po pokynu k uložení
  ve složce stažených souborů není, počítá `strom media add --inbox --waiting` za zadržený: řekne to agentovi a čekání úkolu napíše člověku, kterému webu
  povolit stahování více souborů („prohlížeč snímek {n} zadržel: povolit webu {web} stahování více souborů, jednou
  (ikona vpravo v adresním řádku prohlížeče)“).
- **Jen metodika:** stahovač archivu, jehož prohlížeč ukazuje snímky po dlaždicích, ukládá přes prohlížeč také, i
  část snímku; stránku knihy otevře jednou a nikdy ji neobnovuje.
- **Proč:** svolení „přes prohlížeč“ dovoluje to, co by udělal člověk ve svém prohlížeči, jeho tempem.
- **Ovládání:** terminál (agent): `strom media save T… --image <číslo> --at <adresa> [--recordset B…]`, potom
  `strom media add --inbox --waiting`.
- **Platí od:** výzkum 1.27.0. Zadržený snímek se ohlásí od výzkumu 1.30.0.

<!-- zdroj: research:a4a2f6c0 src/core/browser.ts SaveRecord, HELD_AFTER_MS 5000 · src/commands/media.ts heldSaves, heldLine (media add --inbox --waiting) · assets/lang/cs.json browser.wait.held · research:src/commands/media.ts:1206-1294 media save (browserGate, guarded browser, permission browser, Downloads strom-T…-n.jpg) · commit dadd91e7 (viewer paged on) · src/core/browserhelp.ts agentBrowserAdvice · src/agents/files.ts:80-95 · CHANGELOG.cs.md 1.27.0 -->

<a id="R9.6"></a>
## R9.6 Čekání na snímky a návrat úkolu

Kde agent snímky nezíská, úkol čeká na člověka. Výzkum řekne knihu a čísla snímků a připraví pro ně složku. Úkol se
vrátí do fronty sám, až jsou ve výzkumu všechny jeho snímky.

- **Hlídá kód:**
  - `strom task wait T… --images B…:<čísla>` připraví složku `inbox/<B… název knihy>` ve sdílené složce (název
    nejvýš 80 znaků);
  - soubor nese číslo snímku (`40.jpg`, `9a.jpg`). Jinak pojmenované soubory se očíslují podle pořadí, když jich je
    tolik, kolik snímků chybí;
  - soubor se převezme, až se 3 s nemění (velký sken se nikdy nepřevezme napůl);
  - převzetí: hned, když běží most do aplikace Strom (dívá se do složek čekajících úkolů, znovu každých 30 s); jinak
    při startu dalšího sezení; nebo hned příkazem `strom media add --inbox --waiting`;
  - úkol se vrátí, až jsou tam všechny snímky, s poznámkou, co přišlo. U části čeká dál a Co čeká ukazuje, kolik je
    uloženo z kolika a které chybí;
  - snímky z aplikace jdou rovnou k úkolu: očíslované podle snímku, který aplikace uvede, jinak podle jména souboru,
    jinak podle pořadí chybějících; PDF stránku po stránce. Snímek s číslem, které výzkum už má, se odmítne, pokud ho
    nemá nahradit; nahrazený se nikdy nesmaže. Soubor shodný s jiným už převzatým snímkem (jiné číslo nebo kniha) se
    odmítne a nic se nepřevezme. Stejný soubor poslaný znovu pod týmž číslem nic nezmění a hlásí se jako uložený;
  - odpověď napsaná v aplikaci vrátí úkol stejně jako odpověď v terminálu a uloží se s poznámkou, že přišla z
    aplikace. Úkol, který mezitím čeká na něco jiného, zůstane beze změny.
- **Hranice (kdy snímky vrátí úkol):**
  - úkol čekající na snímky vrátí jen jeho kniha, a až jsou všechny;
  - úkol čekající na web (`--kind web`) vrátí kniha, kterou jmenuje, nebo jediná kniha, ve které pracuje;
  - dopis a dotaz na rodinu vrátí jen kniha, kterou jmenují;
  - úkol čekající na ověření webu člověkem nevrátí nikdy (odpovídá jen člověk).
- **Jen metodika (metodika, `strom guide` i brief agenta stejně):** agent u ručních snímků řekne knihu, čísla snímků,
  formát (JPEG), jméno souboru a složku. Sám nic neotevře a nestáhne, ani prohlížečem. Jediná výjimka: u archivu jen
  přes prohlížeč člověka, kterému člověk dal svolení **přes prohlížeč** a ke kterému nevede stahovač, uloží Claude
  in Chrome snímky po jednom příkazem `strom media save` ([R9.5](#R9.5)). Nic jiného tam agent neotevře ani nestáhne;
  kontrolu, zda je u počítače člověk, prochází jen člověk.
- **Proč:** snímky jsou to, na co úkol čekal; část snímků úkol nedokončí.
- **Ovládání:** terminál: `strom task wait T… --images B…:40-45`, `strom media add --inbox --waiting`, v Co čeká
  **Otevřít složku (uloženo M/N)**. Aplikace: Čeká na vyřízení, u položky v tomto pořadí **Mám snímky**,
  **Otevřít web ↗**, **Odpovědět**, **Probrat s agentem**, **Otevřít složku** (poslední dvě otevřou výzkum v terminálu).
  Stav snímků ukazuje „1 ze 2 snímků“ a u knihy čipy **uložen** / **chybí**. Weby jednoho archivu čekají v jedné
  skupině **Archiv** pod jménem archivu, s odkazem **Web archivu ↗** a počtem chybějících snímků.
- **Hranice (skupina archivu):** skupina je archiv výzkumu, ke kterému úkol patří: podle knihy úkolu, adresy archivu,
  adresy jeho knihy, jiného webu téhož archivu podle seznamu archivů nebo jména archivu. Jen když výzkum takový archiv
  nemá, je skupinou archiv ze seznamu archivů; jinak web sám.
- **Hranice (aplikace):** odpověď nejvýš 4000 znaků; úkol čekající na ověření webu se odpovídá jen v terminálu. Na
  telefonu se snímky nepřidávají ani se neotevírá terminál.
- **Platí od:** výzkum 1.0.0 (složka ve schránce), probuzení po uložení od 1.15.0. Převzetí bez příkazu, části snímků,
  odpověď a snímky z aplikace a archiv pod jedním jménem od výzkumu 1.27.0 a aplikace 3.23.0.

<!-- zdroj: research:src/commands/tasks.ts:1041 task wait (--images, folder) · src/core/media.ts:117 inboxFolderFor · src/core/inboxwait.ts:25 SETTLE_MS · src/core/inboxwatch.ts:1-8 (30 s) · src/commands/media.ts:141-180 wakeWaiting · src/core/live.ts waiting/<T> answer, PUT /media (X-Strom-Task, X-Strom-Image, 409 waiting.image-same) · src/commands/media.ts:403-478 (same sha under its number → 200 same: true, added []; another number/book → 409 waiting.image-same) · src/core/waiting.ts actionsOf, archiveGroup · src/core/waitkind.ts waitGroupOf (repo: before archive:, host:) · assets/method/waiting.md "Images saved by hand" (the one exception, 7bd55fa1) · assets/method/reading.md · src/commands/guide.ts rule 7 · src/agents/files.ts:80-95 · CHANGELOG.cs.md 1.27.0 · app:CHANGELOG.cs.md 3.23.0 · src/research-waiting.ts:216-272 (actions, order), :448-488 assignImages · src/research-waiting-write.ts:532 WAITING_ANSWER_MAX · src/ui/research-overview-ui.ts:698-812 group head · src/strings.ts live.waitingTask -->

<a id="R9.7"></a>
## R9.7 Automatické sezení a chat

Pravidla archivů jsou v obou stejná. Liší se v tom, kdo je u toho a co se stane na mezi.

| | Automatické sezení (`strom run`, aplikace, noční běh) | Chat s agentem |
|---|---|---|
| Chrome | podle úkolu ([R9.4.1](#R9.4.1)) | podle nastavení `agent.browser` |
| dotaz agenta na člověka | není (AskUserQuestion vypnuté) | ano |
| přepnutí prohlížeče | vypnuté | dovolené |
| víc než 30 požadavků na web | odmítnuto | strom se jednou za sezení a web zeptá |
| svolení archivu | nikdo není u toho: příkaz selže, agent zapíše úkol pro člověka a jde jinou cestou | systémové okno pro člověka, jen kde ho systém ukáže |
| snímky, které agent nezíská | úkol čeká na snímky, sezení pokračuje jiným úkolem | totéž; člověk může snímky uložit hned a agent je převezme příkazem |

- **Hranice:** agent nikdy nepíše za člověka: svolení, odpověď na ověření webu ani odpověď na čekání. V chatu
  zůstávají stejně jen člověka.
- **Ovládání:** viz [R7](R7-when-the-agent-works.md) (kdy a jak dlouho sezení běží).
- **Platí od:** výzkum 1.14.0. Prohlížeč agenta od 1.27.0.

<!-- zdroj: research:src/runners/claude.ts RUN_DISALLOWED · src/core/web.ts WEB_PER_HOST (STROM_NONINTERACTIVE) · src/cli/context.ts:253 requireHuman (run: task for the person) · src/core/connector.ts sessionBrowser, agentBrowser · src/commands/start.ts:244 -->

<a id="R9.8"></a>
## R9.8 Co se stane s úkolem: tabulka

Úkol potřebuje snímky knihy z určitého archivu. Řádek se vybere podle archivu a svolení. Kde tabulka říká
„Claude + Chrome“, jde o Claude Code s rozšířením Claude in Chrome a s Chrome spuštěným.

| Archiv | Svolení | Agent | Co agent udělá | Jak úkol skončí |
|---|---|---|---|---|
| dovoleno | není třeba | jakýkoli | stahovač: katalog i snímky v tempu služby; bez stahovače ho agent postaví | snímky ve výzkumu, čtení ([R8](R8-reading-scans.md)) |
| omezeno nebo neznámé | žádné | jakýkoli | katalog a stránky; snímky ne; stahovač položí otázku archivu | čeká na svolení ([R6.3.1](R6-awaiting-action.md#R6.3.1)) |
| omezeno nebo neznámé | pomalu | jakýkoli | snímky přes stahovač tempem člověka | snímky ve výzkumu |
| omezeno nebo neznámé | přes prohlížeč | Claude + Chrome | stahovač cestou přes prohlížeč | snímky ve výzkumu |
| jen přes prohlížeč | přes prohlížeč | Claude + Chrome | `strom media save`, snímek po snímku | snímky ve výzkumu, úkol se vrátí |
| jen přes prohlížeč | žádné | Claude + Chrome | nic v archivu; `task wait --images` | čeká na snímky; Co čeká nabídne svolení |
| jen přes prohlížeč | jakékoli | jiný agent nebo bez rozšíření | nic v archivu; `task wait --images` | čeká na snímky, uloží člověk |
| jen přes prohlížeč | jen ručně | jakýkoli | nic; `task wait --images` | čeká na snímky, uloží člověk |
| jen ručně, zakázaná cesta `/`, obrazový server zavřený celý | svolení neotevře | jakýkoli | nic; `task wait --images` | čeká na snímky, uloží člověk |
| zakázáno, odmítl klienta | svolení neotevře | jakýkoli | jen stránka podmínek a robots.txt; jiná cesta | hledání neprůkazné; je-li pramen nutný, ověřit web ([R6.2.2](R6-awaiting-action.md#R6.2.2)) |

- **Hranice:** stažení stránek webu (katalog, popis knihy) se řídí [R9.3](#R9.3) nezávisle na snímcích.
- **Platí od:** výzkum 1.27.0

<!-- zdroj: research:src/core/terms.ts:789-803 allows · src/core/webgate.ts webGate, browserGate · src/core/browserhelp.ts agentBrowserAdvice, browserHelps · src/commands/media.ts:1206 media save · src/commands/tasks.ts:1041 task wait -->

<a id="R9.8.1"></a>
### R9.8.1 Průběh úkolu, který čeká na snímky

1. **Otevřený úkol** potřebuje snímky knihy B….
2. Smí-li je stáhnout stahovač ([R9.8](#R9.8)), stáhnou se a úkol pokračuje čtením. Konec.
3. Jinak agent nastaví `strom task wait T… --images B…:40-45`. Úkol je ve stavu **čeká**, v Co čeká pod jménem archivu,
   se složkou ve schránce.
4. Se svolením **přes prohlížeč** a s Claude + Chrome uloží agent snímky sám ([R9.5](#R9.5)) a převezme je.
5. Jinak snímky uloží člověk do složky nebo je pošle z aplikace (**Mám snímky**) ([R9.9](#R9.9)).
6. Převzetí: most hned, jinak start dalšího sezení, nebo příkaz `strom media add --inbox --waiting`.
7. Jsou-li tam všechny snímky, úkol je zase **otevřený** ve frontě, s poznámkou, co přišlo. Chybí-li některé, čeká
   dál a Co čeká ukazuje, které chybí (zpět na krok 5).
8. Kdykoli mezi tím: odpověď člověka (v aplikaci nebo `strom task wake T… --answer`) vrátí úkol s odpovědí. Svolení
   **pomalu** nebo **přes prohlížeč** vrátí úkoly čekající na archiv, které ve složce ještě nic nemají.

- **Platí od:** výzkum 1.27.0, aplikace Strom 3.23.0

<!-- zdroj: research:src/commands/media.ts:141 wakeWaiting · src/core/archivewait.ts:188 wakeForArchive · src/core/inboxwatch.ts · src/commands/session.ts takeWaiting · src/core/live.ts waiting answer -->

<a id="R9.9"></a>
## R9.9 Co udělá člověk

Kroky u úkolu, který čeká na snímky archivu, kam agent nesmí:

1. **Najít:** aplikace: **Čeká na vyřízení** (skupina podle archivu). Terminál: menu **Co čeká (n)** nebo stavový řádek
   **Čeká: N**. Položka říká knihu, čísla snímků a co k tomu chybí.
2. **Rozhodnout cestu:**
   - s Claude Code a rozšířením Claude in Chrome jde dát archivu svolení **přes prohlížeč** (aplikace: odkaz
     **Svolení…** v poznámce u položky, terminál `strom allow archive <web> --way browser`). Úkol se vrátí a agent snímky uloží sám ([R9.5](#R9.5));
   - jinak, nebo u archivu jen ručně, uložit snímky ručně (další kroky).
3. **Otevřít knihu** v prohlížeči na webu archivu, s přihlášením a kontrolou člověka, kde je archiv chce.
4. **Uložit snímky** s čísly, která položka říká, jako JPEG, jménem podle čísla snímku (`40.jpg`, `41.jpg`), do
   složky úkolu (**Otevřít složku** v aplikaci i v terminálu). Nebo je v aplikaci na počítači přidat přes **Mám
   snímky** (i přetažením na položku); číslo snímku aplikace vezme ze jména souboru, jinak je dá po řadě.
5. **Hotovo:** s mostem do aplikace se snímky převezmou samy; jinak při dalším sezení, nebo hned
   `strom media add --inbox --waiting`. Chybí-li některé, Co čeká to řekne.
6. **Nejde to:** odpověď slovy (aplikace **Odpovědět**, terminál `strom task wake T… --answer "<co>"`) vrátí úkol
   s odpovědí, např. že kniha online není.

- **Hranice:** svolení, odpověď a uložení snímků jsou jen člověka; agent je za člověka neudělá ([R6.6](R6-awaiting-action.md#R6.6)).
- **Ovládání:** aplikace: Čeká na vyřízení. Terminál: Co čeká, `strom allow archive`, `strom media add --inbox --waiting`.
- **Platí od:** výzkum 1.27.0, aplikace Strom 3.23.0

<!-- zdroj: research:assets/method/waiting.md "Images saved by hand" · src/core/waiting.ts actionsOf · src/core/browserhelp.ts personBrowserNote · app:CHANGELOG.cs.md 3.23.0 -->

<a id="R9.10"></a>
## R9.10 Příklady

Úrovně a meze jsou ze seznamu archivů výzkumu 1.27.0, DigiArchiv SOA Třeboň z výzkumu 1.28.0. Rodina Horákových je
vymyšlená.

<a id="R9.10.1"></a>
### R9.10.1 Moravský zemský archiv (Acta Publica)

- Archiv: omezeno, jen přes prohlížeč člověka, tempo nejméně 4 s. Sčítací operáty (`/scitacioperaty/`) jsou podle
  archivu jen k prohlížení: zakázaná cesta, ani prohlížeč agenta; snímek uloží člověk.
- Úkol: křest Marie Horákové v matrice v Acta Publica. Stahovač ani stažení webu se do archivu nedostanou.
- S Claude Code, rozšířením a svolením **přes prohlížeč**: agent otevře snímek a uloží ho `strom media save`, tempem
  člověka (10 s; tempo archivu 4 s je spodní mez). Úkol se vrátí, až má všechny snímky.
- Bez svolení nebo s jiným agentem: úkol čeká na snímky; Co čeká řekne, s čím by je agent uložil sám.
- Stahovač, vytvořený pro tento archiv dřív, strom odmítne před jakýmkoli požadavkem, i jeho zkoušku. Svolení
  „pomalu“ z dřívějška zůstává uložené, ale snímky přes stahovač už nejdou.
- **Platí od:** výzkum 1.27.0

<!-- zdroj: research:assets/archives.json mza.cz (restricted, browserOnly, pace 4000, disallow /scitacioperaty/) · CHANGELOG.cs.md 1.27.0 (Acta Publica) -->

<a id="R9.10.2"></a>
### R9.10.2 Zemský archiv v Opavě (digi.archives.cz)

- Archiv: jen ručně, jen přes prohlížeč člověka. Robots.txt zavírá celý web všem robotům a stránky chrání kontrola,
  zda je u počítače člověk. Prohlížeč snímků bere obrázky z obrazového serveru images.archives.cz, který robots.txt
  zavírá celý také. Stahovač k archivu nevede. Stejně je na tom digitální badatelna SOA Litoměřice
  (digi.soalitomerice.cz, obrázky z images.soalitomerice.cz).
- Svolení **přes prohlížeč** tu nejde dát: `strom allow archive digi.archives.cz --way browser` se odmítne, aplikace
  odkaz **Svolení…** nenabídne a `strom media save` snímek neuloží. Prohlížeč agenta by si o každý obrázek řekl
  zavřenému obrazovému serveru.
- Úkol: oddání Marie Vlkové. Agent nastaví `strom task wait T… --images B…:12-13`.
- Jediná cesta je čekání na snímky: Co čeká v aplikaci ukazuje úkol pod jménem archivu se složkou. Člověk otevře
  knihu ve svém prohlížeči, uloží snímky 12 a 13 (`12.jpg`, `13.jpg`) přes **Otevřít složku**, nebo je přidá přes
  **Mám snímky**. Úkol se vrátí.
- **Platí od:** výzkum 1.27.0

<!-- zdroj: research:assets/archives.json digi.archives.cz, digi2.archives.cz, digi.soalitomerice.cz (manual, browserOnly, quoteFrom robots, imagesFrom images.archives.cz / images.soalitomerice.cz; commit 69902466) · src/core/terms.ts allows (browserOnly + manual) · src/commands/archives.ts:676-680 (manual/forbidden: no permission) · src/core/browserhelp.ts browserHelps, treeBrowserArchives (never by hand only) · test/cli/media-save.test.ts (digi.archives.cz) · CHANGELOG.cs.md 1.27.0 -->

<a id="R9.10.3"></a>
### R9.10.3 eBadatelna SOA Praha

- Archiv: jen ručně, jen přes prohlížeč člověka; robots.txt jmenovitě brání nástrojům AI.
- Úkol vždy čeká na snímky, které uloží člověk. Svolení to neotevře, prohlížeč agenta ani stažení webu tam nesmí.
- **Platí od:** výzkum 1.27.0

<!-- zdroj: research:assets/archives.json ebadatelna.soapraha.cz (manual, browserOnly, disallow /d/ /a/) · src/core/terms.ts allows (browserOnly + manual) -->

<a id="R9.10.4"></a>
### R9.10.4 Matricula

- Archiv: dovoleno (podmínky CC BY-NC-ND), obrazový server také. Seznam archivů zakazuje některé cesty (hledání,
  listování stránek), ty zůstanou zavřené.
- Úkol: pohřeb Marie Horákové v bavorské farnosti. Stahovač stáhne jen potřebné snímky v tempu služby, bez svolení a
  bez čekání. Bez stahovače ho agent postaví ([R8.2](R8-reading-scans.md#R8.2)).
- **Platí od:** výzkum 1.14.0

<!-- zdroj: research:assets/archives.json data.matricula-online.eu (allowed, disallow /*?pg=, /*/suchen), hosted-images.matricula-online.eu (allowed) -->

<a id="R9.10.5"></a>
### R9.10.5 Szukaj w Archiwach

- Archiv: omezeno, jen přes prohlížeč člověka; web chrání služba proti robotům.
- Bez svolení úkol čeká na snímky. Se svolením **přes prohlížeč** a s Claude + Chrome je agent uloží sám jako v
  [R9.10.1](#R9.10.1).
- **Platí od:** výzkum 1.27.0

<!-- zdroj: research:assets/archives.json szukajwarchiwach.gov.pl (restricted, browserOnly) -->

<a id="R9.10.6"></a>
### R9.10.6 DigiArchiv SOA Třeboň

- Archiv: jen ručně, jen přes prohlížeč člověka. Podmínky na úvodní stránce DigiArchivu (`/Uvod`): „Snímky jsou
  poskytnuty pouze za účelem on-line prohlížení v DigiArchivu SOA v Třeboni, jejich kopírování, distribuování,
  prodávání, využití v jiných projektech a na jiných stránkách je zakázáno.“ Server požadavky stromu odmítá (403),
  podle archivu záměrně.
- Archiv potvrdil: člověk smí ručně uložit jen vybrané snímky, nikdy celou knihu ani její podstatnou část. Nástroje ke
  stahování nejsou dovolené, ani prohlížeč agenta.
- Úkol: zápis Marie Horákové v matrice v DigiArchivu. Úkol vždy čeká na snímky, které vybere a uloží člověk. Svolení
  to neotevře; stahovač, stažení webu ani prohlížeč agenta tam nesmí.
- Citace: trvalý odkaz na snímek je adresa jeho stránky `https://digi.ceskearchivy.cz/<kniha>/<snímek>`, nebo
  **Odkaz na snímek** v panelu **POPIS**.
- **Platí od:** výzkum 1.28.0

<!-- zdroj: research:assets/archives.json digi.ceskearchivy.cz (manual, browserOnly, terms https://digi.ceskearchivy.cz/Uvod, quote, robots 403, scope, checked 2026-11-05), www.ceskearchivy.cz (stejné terms/quote) · src/core/terms.ts allows (browserOnly + manual) · CHANGELOG.cs.md 1.28.0 · znalosti/archivy-cz.md „SOA v Třeboni (DigiArchiv)“ (odpověď archivu 5. 11. 2026) · commit 805b871d -->
