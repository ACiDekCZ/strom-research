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
6. **Sčítání lidu:** volitelný pramen, který zapíná jen člověk; od výzkumu 1.36.0 ([R9.12](#R9.12)).

> **Poznámka: kde přesně platí prohlížeč agenta.** Prohlížeč agenta hlídá strom u **Claude Code** s rozšířením
> **Claude in Chrome**, ve vestavěném prohlížeči aplikace Claude ([R12.2](R12-where-the-agent-works.md#R12.2))
> a v prohlížeči Codexu v terminálu podle adres v jeho kódu, když člověk potvrdil hook stromu
> ([R12.5](R12-where-the-agent-works.md#R12.5)). Prohlížeč aplikace ChatGPT (Codex) běží přes cloud ChatGPT a strom
> ho nehlídá ([R12.5.1](R12-where-the-agent-works.md#R12.5.1)). Prohlížeč jiného agenta (Antigravity a další) a ovládání počítače
> žádného agenta strom hlídat neumí: agent s nimi do archivu, kam smí jen prohlížeč člověka, sám nejde a snímky
> uloží člověk. Vestavěné prohlížeče a ovládání
> počítače desktopových aplikací agentů strom nedoporučuje; agent je použije jen na výslovnou žádost člověka
> ([R9.4.2](#R9.4.2)). Kde se s agentem mluví a co strom kde hlídá, shrnuje [R12](R12-where-the-agent-works.md).

<!-- zdroj: research:CHANGELOG.cs.md 1.27.0, 1.29.0, 1.30.0 · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS, ON_REQUEST, codexInChatgptApp (v1.30.0, 33ac2e38) · src/core/chromehook.ts:1-25 · src/core/codexhook.ts · app:CHANGELOG.cs.md 3.23.0 -->

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
- **Od výzkumu 1.37.0:** kniha zapsaná ve výzkumu pod archivem, jejíž adresa je na portálu ze seznamu archivů
  (např. Porta fontium, Acta Publica), už portál nedělá tak přísným jako ten archiv: portál se řídí svými podmínkami
  a ostatními zdroji. Vlastní portál archivu pod jinou adresou, u kterého seznam uvádí podmínky na webu archivu (např.
  eBadatelna SOA Praha), archiv drží dál. Úroveň, kterou strom drží z dřívějška, zůstane, dokud nerozhodne člověk
  v Co čeká. Kde záznam archivu web drží přes knihu, `strom doctor`, otázka v Co čeká a `strom allow archive`
  jmenují archiv, knihu i web: „záznam archivu ve výzkumu R… (…) přes jeho knihu … na … (strom recordset show …)“.
- **Proč:** metodika chce dodržet podmínky každého archivu. Kam robots.txt pustí jen prohlížeč, jde nejvýš prohlížeč
  se svolením člověka a jeho tempem; co seznam archivů nechává na ruce člověka, ukládá člověk.
- **Ovládání:** terminál: `strom net web --check <adresa>` (co by strom udělal s adresou), menu archivů, `strom
  allow archive` (jen člověk). Aplikace: Čeká na vyřízení.
- **Platí od:** výzkum 1.14.0. Další archivy Česka, Německa a Polska a obrazový server od 1.27.0. Portál ze seznamu
  podle svých podmínek, ne podle knihy jiného archivu, od 1.37.0.

<!-- zdroj: 1.37.0: research:91631d2e, 66a521fa src/core/terms.ts listStates, treeLevel (kniha jen tam, kde seznam podmínky webu neuvádí; vlastní portál archivu s podmínkami na webu archivu drží), src/core/floor.ts FloorHold tree recordset, holdText, floorWhat · cs.json ui.archive.floor.hold.treeSet · CHANGELOG.cs.md 1.37.0 -->
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
- **Od výzkumu 1.37.0 (vyčerpaný limit):**
  - po `web.perHost` stránkách agent slyší, kdy web zase dá stránky: v tomto sezení už žádné, nebo od určité doby
    (limit tohoto počítače, stránky všech sezení za dobu jednoho sezení). Úkol zůstane otevřený, nikdy hotový ani
    vzdaný kvůli limitu; do té doby jiná práce, jinak konec sezení. Stránka webu se dřív znovu nezkouší a na limit se
    nečeká; po třetím odmítnutí stejného webu v sezení agent slyší, že má sezení ukončit;
  - `strom run` úkol, jehož práce vede na takový web (ukládání snímku prohlížečem agenta, nebo kniha jen na tom webu
    bez stahovače), zatím vynechá a vezme jiný: „· T… zatím vynechán: stránky … jsou pro tento počítač vyčerpané
    do …“. Sezení na takovém webu začne, až je volná nejméně třetina limitu (10 z výchozích 30);
  - když jiný úkol není: běh s `--loop` nebo `--until` počká (bez agenta, nic se neodešle; „⏸ čekání do … – zbylé
    úkoly potřebují stránky …“), jiný běh skončí a řekne kdy („do … není co dělat – …“). Pro aplikaci Strom je to
    hotový běh, ne chyba;
  - úkol čekající na snímek, který prohlížeč agenta nikdy neuložil (stránka odmítnutá), se s koncem sezení vrátí do
    fronty; nikdy se o něm neřekne, že ho prohlížeč zadržel.
- **Jen metodika:** u odmítnutého webu nejdřív jiná cesta. Hledání se zapíše s výsledkem neprůkazné (`strom search
  add … --result inconclusive`). Teprve když je pramen dál nutný, úkol čeká na člověka, aby web ověřil
  (`strom task wait --check`, [R6.2.2](R6-awaiting-action.md#R6.2.2)).
- **Proč:** stažení webu i prohlížeč agenta se počítají a zpomalují spolu, aby žádná cesta nešla rychleji než jiná.
- **Ovládání:** terminál (agent): `strom net web --check <adresa>`; `strom run`.
- **Platí od:** výzkum 1.14.0; vyčerpaný limit od 1.37.0

<!-- zdroj: 1.37.0: research:ce89202a src/core/web.ts ManyWhen, whenText, WEB_REFUSED_LOOP 3, manyText · src/core/webfull.ts (runWebFree perHost/3, WebFull) · src/core/machine.ts siteFreeAt · src/commands/session.ts:1311-1390 webOut, gateHolds (--loop, --until), stopCode web · cs.json ui.run.skip.web, ui.run.web.wait, ui.run.stop.web · CHANGELOG.cs.md 1.37.0 „Vyčerpaný limit webu“ -->
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
  strom hlídá jako Claude in Chrome ([R12.2](R12-where-the-agent-works.md#R12.2)). Prohlížeč aplikace ChatGPT
  (Codex) běží přes cloud ChatGPT a strom ho nehlídá, ať je hook stromu v Codexu potvrzený, nebo ne; o webech
  rozhoduje dialog ChatGPT ([R12.5.1](R12-where-the-agent-works.md#R12.5.1)). Prohlížeč Codexu v terminálu strom
  hlídá podle adres v jeho kódu, až člověk potvrdí hook stromu ([R12.5](R12-where-the-agent-works.md#R12.5)).
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
- **Platí od:** výzkum 1.27.0; 1.29.0: vestavěný prohlížeč aplikace Claude a prohlížeč Codexu hlídané; 1.30.0:
  prohlížeč aplikace ChatGPT strom nehlídá

<!-- zdroj: research:src/core/browserhelp.ts ON_REQUEST, browserKept · src/core/browser.ts CODEX_BROWSER_SERVERS, Claude_Browser matcher · src/brief/brief.ts · src/commands/guide.ts · src/commands/setup.ts:527 desktop · assets/lang/cs.json ui.doc.desktop.unwatched · CHANGELOG.cs.md 1.27.0, 1.29.0 · research:v1.30.0 (33ac2e38) src/core/browserhelp.ts codexInChatgptApp, browserKept; assets/lang/cs.json ui.doc.desktop.codex; CHANGELOG.cs.md 1.30.0 · dirigent:test/vysledek-062-u4-codex.md · 1.29.0 (53dba68d; dev 6968ab72): agent řekne, zda strom cestu hlídá -->

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
  - ukládání čeká, až prohlížeč archivu ukáže celý snímek, nejvýš 30 s (prohlížeč, který kreslí kartu pomalu: [R9.5.2](#R9.5.2)). Od výzkumu 1.31.0 se počítá jen čas, kdy
    prohlížeč kartu kreslí (nekreslí kartu za jinou kartou ani v zakrytém či minimalizovaném okně). Karta nekreslená
    30 s se ohlásí jako taková („the browser did not draw the tab with the viewer for 30 s …“: karta dopředu, okno
    odkryté, pak skript znovu); prohlížeč archivu, který mezitím přestránkuje na jiný snímek, neuloží nic;
  - příkaz nastaví úkol na čekání na ten snímek. Soubor se uloží do složky stažených souborů jako
    `strom-<značka výzkumu>-T…-<číslo>.jpg` (např. `strom-3f2a9c1b-T0007-0040.jpg`, číslo snímku na čtyři místa) a
    `strom media add --inbox --waiting` ho přesune do složky úkolu pod číslem snímku ([R9.6](#R9.6));
  - značka výzkumu je prvních 8 šestnáctkových znaků id výzkumu. Složku stažených souborů sdílejí všechny výzkumy
    počítače: soubor jiného výzkumu se nikdy nevezme. Soubor uložený před výzkumem 1.33.0 (`strom-T…-<číslo>.jpg`,
    bez značky) převezme jen výzkum, jehož záznam uložení to jméno uvádí;
  - kopii, kterou prohlížeč uloží pozdě nebo dvakrát („… (1).jpg“), `strom media add --inbox --waiting` ze složky
    stažených souborů odebere, až je snímek ve výzkumu (záznam uložení drží 14 dní). Soubor, který strom
    nepojmenoval, nikdy;
  - bez `--recordset` se kniha vezme z toho, na co úkol čeká, jinak z knih úkolu v archivu adresy `--at`. Víc takových
    knih strom vyjmenuje a nic neuloží;
  - prohlížeč snímků, který na stránce je, ale strom k němu nedosáhne, se ohlásí: nic se neuloží a hláška řekne, co
    udělá člověk (snímek uloží ve svém prohlížeči do složky úkolu).
- **Hranice:** Chrome uloží z jedné stránky jen jeden soubor. Další stažení z téže stránky musí dovolit člověk v
  adresním řádku Chrome; agent nastavení Chrome nikdy nemění. Snímek, jehož soubor ani 5 s po pokynu k uložení
  ve složce stažených souborů není, počítá `strom media add --inbox --waiting` za zadržený: řekne to agentovi a čekání úkolu napíše člověku, kterému webu
  povolit stahování více souborů („prohlížeč snímek {n} zadržel: povolit webu {web} stahování více souborů, jednou
  (ikona vpravo v adresním řádku prohlížeče)“). Stahování, které se ještě zapisuje (`.crdownload`, `.part` a
  podobně), příkaz krátce počká; když ani pak nedoběhne, řekne to a za zadržené ho nepočítá.
- **Jen metodika:** stahovač archivu, jehož prohlížeč ukazuje snímky po dlaždicích, ukládá přes prohlížeč také, i
  část snímku; stránku knihy otevře jednou a nikdy ji neobnovuje.
- **Proč:** svolení „přes prohlížeč“ dovoluje to, co by udělal člověk ve svém prohlížeči, jeho tempem.
- **Ovládání:** terminál (agent): `strom media save T… --image <číslo> --at <adresa> [--recordset B…]`, potom
  `strom media add --inbox --waiting`.
- **Platí od:** výzkum 1.27.0. Zadržený snímek se ohlásí od výzkumu 1.30.0, nekreslená karta od 1.31.0. Značka
  výzkumu ve jménu souboru, kniha bez `--recordset`, úklid pozdních kopií, čekání na zapisované stahování a
  nedosažitelný prohlížeč snímků od 1.33.0.
- **Od výzkumu 1.37.0 (víc snímků najednou):**
  - `--image 40,41,45` nebo `--image 40-45` (nejvýš 10 snímků) s jedním `--at` ke každému v jejich pořadí, nebo
    jednou adresou s `{n}` na místě čísla, dá jeden kratší skript pro všechny. Skript pozná snímek podle adresy karty
    a jinou stránku odmítne;
  - každý snímek je dál na vlastní stránce, kterou agent otevře lidským tempem pod hlídáním stromu; žádný rozsah.
    Jedno `strom media add --inbox --waiting` po posledním převezme všechny;
  - snímek ze seznamu, jehož stránka ještě nebyla otevřená, se nikdy nepočítá za zadržený prohlížečem;
  - Claude Code s víc než třemi snímky je předá pomocníkovi stromu `strom-image-saver`: malý kontext, jen nástroje,
    které uložení potřebuje, nejvýš 10 snímků na volání, model `model.cheap` osoby, jinak model agenta, který ho
    spustil. Jeho stránky se počítají se stránkami agenta a platí pro ně stejné hlídání.
- **Od výzkumu 1.37.0 (čekání):** dokud sezení agenta snímky ukládá, úkol nečeká na člověka a aplikace Strom ho
  ukazuje jako práci agenta ([R6.1](R6-awaiting-action.md#R6.1)). Na člověka čeká: snímek zadržený prohlížečem
  (řečeno hned na začátku čekání), ukládání zastavené koncem sezení (pokračuje příští sezení, nebo snímky uloží
  člověk; [R6.2.1](R6-awaiting-action.md#R6.2.1)) a čekání, které agent pro tentýž úkol zapíše sám
  (`strom task wait --images` po `strom media save`): nedokončená uložení se zahodí a úkol je hned v **Co čeká**
  s jeho slovy. Úkol čekající na snímek, jehož stránku hlídání odmítlo (vyčerpaný limit webu), se s koncem sezení
  vrátí do fronty s poznámkou, které snímky zbývají.

<!-- zdroj: research:a4a2f6c0 src/core/browser.ts SaveRecord, HELD_AFTER_MS 5000 · src/commands/media.ts heldSaves, heldLine (media add --inbox --waiting) · assets/lang/cs.json browser.wait.held · research:src/commands/media.ts:1206-1294 media save (browserGate, guarded browser, permission browser) · commit dadd91e7 (viewer paged on) · src/core/browserhelp.ts agentBrowserAdvice · src/agents/files.ts:80-95 · CHANGELOG.cs.md 1.27.0 · research:c6b6444d, dee0bb03 src/core/browser.ts VIEWER_HIDDEN_MS = 30_000, CAPTURE_JS (čekání jen na snímky kreslené karty, NOT_SHOWN, „the viewer's tiles did not all come in 30 s“, „the viewer was paged to another image … nothing saved“) · CHANGELOG.cs.md 1.31.0 · 1.33.0: research:7306f2a7 src/core/browser.ts researchMark (8 hex z id), waitFileBase (strom-<značka>-T…-NNNN), staré jméno jen podle SaveRecord.file · f6de01b7 src/commands/media.ts saveBookOf (kniha bez --recordset), tidyDownloads, TAKEN_KEEP_MS 14 dní · 903ce928 media add --inbox --waiting (zapisované stahování, STROM_DOWNLOAD_WAIT_MS, heldSaves dl.unfinished) · f5339b36 findViewer (OpenSeadragon v kódu stránky), hláška „strom cannot reach it … nothing saved“ · strom help media save · CHANGELOG.cs.md 1.33.0 · 1.37.0: research:66ef4451 src/commands/media.ts media save (--image seznam nebo rozsah, nejvýš 10, --at ke každému nebo {n}; skript pozná snímek podle adresy karty; neotevřená stránka není zadržená), agent strom-image-saver (model.cheap, delegate hook) · 81de7cdb, aae8f1aa src/core/waiting.ts savedByAgentNow, waitOnNow · 1c8a4380 (task wait --images po media save: uložení zahozena, čekání hned člověka) · src/core/ownsave.ts unsavedOwnWait, saveNeverOpened (návrat do fronty s koncem sezení) · CHANGELOG.cs.md 1.37.0 -->

<a id="R9.5.1"></a>
### R9.5.1 Ostřejší kopie snímku

Snímek, který už je ve výzkumu a na čtení je slabý, uloží agent přes prohlížeč ještě jednou: s prohlížečem archivu
přiblíženým, nebo v plném rozlišení.

- **Hlídá kód:**
  - `strom media save … --again` uloží registrovaný snímek jako novou kopii vedle staré; nic se neodebere;
  - obrazem snímku je celá kopie s nejvíce pixely (šířka × výška). Pohled, čtení a výřezy přes `B…:<číslo>` berou
    ji; citace, která už ukazuje na konkrétní kopii (`M…`), na ní zůstane;
  - dokud nová kopie nepřijde, úkol na snímek čeká dál. Přijde-li tentýž sken, nic se neregistruje dvakrát a úkol se
    vrátí do fronty;
  - bez `--again` se uložení registrovaného snímku odmítne a hláška `--again` nabídne. Brief u slabých skenů archivu,
    kam chodí prohlížeč agenta, nabídne `--again` místo žádosti na člověka.
- **Hranice:** jen celý snímek, ne jeho výřez.
- **Ovládání:** terminál (agent): `strom media save T… --image <číslo> --recordset B… --at <adresa> --again`.
- **Platí od:** výzkum 1.33.0
- **Od výzkumu 1.37.0:** `strom media add --inbox --waiting` kopii uloženou s `--again` převezme hned: tentýž sken
  ostřejší jde vedle jako kopie (obrazem je ta s nejvíce pixely), jiný sken snímku se stane obrazem a dosavadní se
  stáhne a zůstane zachovaný (ten, který cituje pramen, zůstane vedle). Nic se neodkládá ani nepotvrzuje, žádné
  `strom media aside --take` u každého snímku.
- **Od výzkumu 1.37.0 (snímek obrazovky):** řádně uložená kopie má přednost před snímkem obrazovky, i když má méně
  pixelů. Kopie se bere za snímek obrazovky, když její původní jméno je jméno snímku obrazovky (nebo je to PNG vedle
  JPEG) a její poměr stran se od jiné kopie snímku liší o víc než 15 %. Kopie stažená stahovačem nebo uložená
  prohlížečem agenta (jméno `strom-…-T…-NNNN.jpg`) snímkem obrazovky není nikdy. Jinak platí pořadí podle pixelů.
  Počítá se pokaždé ze záznamů, takže stejně čte i starší výzkum.
- **Od výzkumu 1.37.0 (citace na jinou kopii):** `strom media cites M…` vypíše prameny, které kopii citují, a jiné
  kopie téhož snímku; s `--move-to M…` je převede na jinou kopii celého snímku (každý pramen jednou úpravou; stará
  kopie zůstane a nestáhne se). Výřez místa jde s nimi, jen když strom pozná oba soubory jako tentýž sken stejně
  otočený a nejde o snímek obrazovky vedle skenu; jinak zůstane na staré kopii a výpis řekne příkazy k jeho novému
  označení. Výřez celého snímku jde vždy. Nic se nepřevede samo; `--dry-run` řekne, co by se stalo.

<!-- zdroj: research:6651b60b src/commands/media.ts media save --again, againPending, settleAgain · src/core/media.ts findImage (nejvíc pixelů, ne část) · src/core/browser.ts SaveRecord.again · strom help media save (--again) · dirigent:prace/1114-vyzkum-z-hlidani-2/vysledek-sub1.md (A2, otevřené: výřez ne; citace na M… zůstávají) · CHANGELOG.cs.md 1.33.0 · 1.37.0: research:66ef4451 (--again převzato hned, bez media aside --take) · a2fe388d src/core/media.ts rankCopies (jméno snímku obrazovky, poměr stran > 15 %), src/commands/media.ts media cites --move-to (výřez jen u téhož skenu, jinak příkazy) · d93be067 (PNG vedle JPEG; savedProperly: stahovač nebo jméno strom-…) · 0c7ed4d3 · strom help media cites · CHANGELOG.cs.md 1.37.0 -->

<a id="R9.5.2"></a>
### R9.5.2 Prohlížeč, který kreslí kartu pomalu

Prohlížeč snímků archivu, který skládá snímek z dlaždic (OpenSeadragon, např. ACTA PUBLICA), si řekne zhruba o jednu
dlaždici za každé nakreslení karty. Kde prohlížeč kreslí kartu jen asi jednou za sekundu, trvají dlaždice jednoho
snímku minuty a ukládání po 30 s skončí hláškou „the viewer's tiles did not all come in 30 s …“.

- **Nejdřív prohlížeč:** pomalu kreslí karta bez grafické akcelerace, na vzdálené ploše nebo ve virtuálním počítači.
  V Chrome: `chrome://settings/system` zapnout grafickou akceleraci a Chrome restartovat; `chrome://gpu` ukáže, zda
  Canvas a Compositing nejsou „Software only“ (pak pomůže novější ovladač grafiky). Údaj „last frame … s ago“ v hlášce
  říká, jak dávno prohlížeč kartu naposledy nakreslil.
- **Hlídá kód:**
  - nastavení `browser.tileWait` je skryté: `strom config where` ani `strom help config` ho neukazují, dokud není
    nastavené. Bere celé sekundy od 60 do 600 (doporučeno 180), jinou hodnotu odmítne s nápovědou. Je uložené
    v nastavení uživatele a platí pro všechny výzkumy na počítači;
  - nenastavené: dlaždice se čekají 30 s jako dosud; hláška „tiles did not all come in 30 s“ navíc agentovi řekne, že
    pomůže `strom config set browser.tileWait 180` a pak tentýž příkaz strom znovu (nový skript);
  - nastavené: když dlaždice ještě přicházejí (některá za posledních 10 s), skript čeká dál, dokud chodí. Skončí po
    30 s bez nové dlaždice, nejpozději po nastavené době;
  - jedno volání skriptu po 35 s odpoví „strom-wait …“: agent pustí tentýž skript znovu ve stejné kartě a ten čeká
    dál, kde byl. Platí až poslední odpověď „strom-result …“; odpověď „strom-wait“ `strom fetch … --take` nic
    nepřevezme;
  - platí pro `strom media save` ([R9.5](#R9.5)) i pro stahovač, který přes prohlížeč ukládá z prohlížeče snímků
    archivu (`strom fetch`, [R8.2](R8-reading-scans.md#R8.2)).
- **Hranice:** karta kreslená rychle se uloží stejně s nastavením i bez něj. Bez nastavení se nemění nic.
- **Proč:** dlaždice přicházejí jen tak rychle, jak prohlížeč kartu kreslí; 30 s zůstává pro všechny ostatní.
- **Ovládání:** terminál: `strom config set browser.tileWait 180`, zpět na 30 s `strom config unset browser.tileWait`.
- **Platí od:** výzkum 1.32.0

<!-- zdroj: research:75245c94 src/core/browser.ts TILE_WAIT_MIN_S 60, TILE_WAIT_MAX_S 600, TILE_WAIT_SUGGESTED_S 180, TILE_RECENT_MS 10_000, TILE_QUIET_MS 30_000, WAIT_CALL_MS 35_000, CAPTURE_JS ("the viewer's tiles did not all come in 30 s" + věta strom config set browser.tileWait 180; "last frame … s ago"), "strom-wait" · src/core/config.ts browser.tileWait (hidden, tree false, rozsah, hint config unset) · src/commands/media.ts:1686 media save · src/commands/connectors.ts:3152 viewerScript, takeOver (strom-wait nic nepřevezme) · test/cli/connector-mza.test.ts:303 (skryté do nastavení: config where, help config) · CHANGELOG.cs.md 1.32.0 · dirigent:prace/1112-vyzkum-dlazdice-pokrok/karta.md (OSD ~1 dlaždice na snímek; závěr 2: grafická akcelerace, chrome://gpu, neověřeno u reportéra) -->

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
  - `strom media view B…:<číslo>` snímku, na který úkol čeká, řekne, kdo na něj čeká (prohlížeč agenta, plán
    stahovače v prohlížeči, nebo člověk) a přesný další krok (od výzkumu 1.33.0);
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
  - úkol čekající na web (`--kind web`) vrátí kniha, kterou jmenuje, nebo jediná kniha, ve které pracuje; od výzkumu
    1.35.0 místo ní kniha, pod kterou čeká ([R6.8.4](R6-awaiting-action.md#R6.8.4));
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
  **Otevřít web ↗**, **Odpovědět**, **Probrat s agentem**, **Otevřít složku** (poslední dvě otevřou výzkum v terminálu);
  od aplikace 3.30.0 blok **Dodat** s kroky a odkaz **Snímky nejde získat…** ([S4.4.7](S4-research-from-the-app.md#S4.4.7)).
  Stav snímků ukazuje „1 ze 2 snímků“ a u knihy čipy **uložen** / **chybí**. Weby jednoho archivu čekají v jedné
  skupině **Archiv** pod jménem archivu, s odkazem **Web archivu ↗** a počtem chybějících snímků.
- **Hranice (skupina archivu):** skupina je archiv výzkumu, ke kterému úkol patří: podle knihy úkolu, adresy archivu,
  adresy jeho knihy, jiného webu téhož archivu podle seznamu archivů nebo jména archivu. Jen když výzkum takový archiv
  nemá, je skupinou archiv ze seznamu archivů; jinak web sám.
- **Hranice (aplikace):** odpověď nejvýš 4000 znaků; úkol čekající na ověření webu se odpovídá jen v terminálu. Na
  telefonu se snímky nepřidávají ani se neotevírá terminál.
- **Platí od:** výzkum 1.0.0 (složka ve schránce), probuzení po uložení od 1.15.0. Převzetí bez příkazu, části snímků,
  odpověď a snímky z aplikace a archiv pod jedním jménem od výzkumu 1.27.0 a aplikace 3.23.0.
- **Od výzkumu 1.35.0:** strom bere i složky knih, které úkoly potřebují a na které nic nečeká, jen podle čísla
  v názvu souboru ([R6.8.2](R6-awaiting-action.md#R6.8.2)).
- **Od výzkumu 1.35.0:** sám se úkol vrátí, jen když je čekání zapsané podle čísel snímků nebo knihy výzkumu; čekání
  zapsané jinak najde `strom task audit` ([R6.9](R6-awaiting-action.md#R6.9)).
- **Od výzkumu 1.35.0 (soubory ve složce):**
  - kopie, kterou vedle souboru udělal správce souborů nebo prohlížeč, nese číslo původního souboru: „33 2.jpg“,
    „33 kopie.jpg“, „33 copy.jpg“, „33 - Copy (2).jpg“ i „33 (1).jpg“ jsou snímek 33, „33a 2.jpg“ snímek 33a. Holé
    „ 2“ až „ 9“ za názvem se jako přípona kopie bere jen za názvem, který je samé číslo (s případným písmenem);
  - podle pořadí se nečísluje, když některý soubor má název ze samého čísla (`1.jpg` je snímek 1, ne chybějící 33):
    číslo, které dal člověk, pořadí nepřebije; název z portálu nebo datum a čas snímku obrazovky ano;
  - soubor, který je tentýž sken jako snímek už převzatý pod jiným číslem nebo v jiné knize, se nepřevezme ani
    nesmaže: odloží se vedle jako `<soubor>.same-as-M…` (pod tímto názvem se už nikdy nepřevezme) a výpis
    `strom media add --inbox`, záznam mostu i výstup JSON řeknou, pro který snímek byl, který snímek to je a že jedno
    z obou čísel je špatně. Když přejmenování nejde, soubor zůstane ležet a řekne se totéž;
  - soubory `.jp2` z portálu Moravského zemského archivu se přepočtou zpět ([R6.8.2](R6-awaiting-action.md#R6.8.2))
    i ve složce čekajícího úkolu.
- **Od výzkumu 1.37.0 (ručně uložené skeny):**
  - číslo snímku může být kdekoli v názvu (`__0236.jpg`, `Lhota_11__125.jpg`, `fond12_kniha3_236.jpg`): z několika
    čísel to, které patří k chtěným snímkům, to, které se mezi soubory složky mění, jinak poslední před příponou.
    Datum a čas snímku obrazovky se za číslo nikdy nebere, ani rok za číslem (`33 1784.jpg`), když není známo, které
    snímky; jméno se dvěma chtěnými čísly se nehádá, ale ohlásí;
  - soubor, ze kterého číslo snímku nejde poznat (`000.jpg`), ostatní nezdrží: zůstane ležet a ohlásí se jednou, bez
    rady k přejmenování;
  - soubory pojmenované podle aktů na nich (`001-004.jpg`) nebo vlastními čísly portálu se převezmou v pořadí složky
    jako další snímky knihy, když se 20 minut nic dalšího neuloží. Akty zůstanou zapsané u snímku a úkol se vrátí se
    seznamem, který soubor je který snímek;
  - další list pod stejným číslem (`7a.jpg`) se pozná podle obsahu: kopie, přiblížená část snímku, nebo samostatný
    sken uložený pod svým jménem; nikdy se neschová jako kopie jen podle jména. Platí ve stejné i pozdější dávce,
    po návratu úkolu i při `strom media add --inbox <složka>`;
  - úkol, ke kterému přišla jen část snímků, se po 20 minutách ticha vrátí s tím, co přišlo a co chybí; nikdy dřív.
    Sken na hranici dvou ročníků se počítá jednou;
  - soubory pojmenované číslem snímku se berou jako dřív; nic se nepřečísluje. Stav, menu a záznam mostu řeknou, kdy
    se složka převezme a co zůstalo ležet (čas místní).

<!-- zdroj: research:src/commands/tasks.ts:1041 task wait (--images, folder) · src/core/media.ts:117 inboxFolderFor · src/core/inboxwait.ts:25 SETTLE_MS · src/core/inboxwatch.ts:1-8 (30 s) · src/commands/media.ts:141-180 wakeWaiting · src/core/live.ts waiting/<T> answer, PUT /media (X-Strom-Task, X-Strom-Image, 409 waiting.image-same) · src/commands/media.ts:403-478 (same sha under its number → 200 same: true, added []; another number/book → 409 waiting.image-same) · src/core/waiting.ts actionsOf, archiveGroup · src/core/waitkind.ts waitGroupOf (repo: before archive:, host:) · assets/method/waiting.md "Images saved by hand" (the one exception, 7bd55fa1) · assets/method/reading.md · src/commands/guide.ts rule 7 · src/agents/files.ts:80-95 · CHANGELOG.cs.md 1.27.0 · app:CHANGELOG.cs.md 3.23.0 · src/research-waiting.ts:216-272 (actions, order), :448-488 assignImages · src/research-waiting-write.ts:532 WAITING_ANSWER_MAX · src/ui/research-overview-ui.ts:698-812 group head · src/strings.ts live.waitingTask · 1.33.0: research:bfa01a34 src/commands/media.ts media view (snímek, na který úkol čeká: kdo a další krok) · research:dddeb8a6 src/core/media.ts copyless (COPY_WORD copy/kopie/kopia/…, COPY_PAREN, COPY_BARE jen za číslem), namedByNumber · src/core/inboxwait.ts numberFiles (pořadí jen bez souboru pojmenovaného samým číslem; times .jp2 i u čekajících), bookTimes · src/commands/media.ts registerImages clashed, takeFiles (kolize → rename `${f}.same-as-${same}`, jinak leží; SetAside), asideLine (live.log, výpis ⚠, aside v JSON) · research:18fd10ec COPY_BARE \p{Nd}+\p{L}? („33a 2.jpg“) · CHANGELOG.cs.md 1.35.0 (research:e263eacb) · 1.37.0: research:62e335eb src/core/inboxwait.ts (000.jpg leží, akty jako záznamy, cizí jména v pořadí složky po STROM_INBOX_QUIET_MS 20 min, část snímků po tichu), 7a2a04cc src/core/media.ts findPart, 6fee0f71 (7a podle obsahu v každém převzetí i media add --inbox <složka>; soubor ležící schválně řečen jednou; místní čas) · src/core/media.ts (číslo kdekoli v názvu) · assets/method/waiting.md (sken na hranici jednou) · CHANGELOG.cs.md 1.37.0 · dirigent:spec/141 K1.1–K1.6, K2.2 -->

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
4. Se svolením **přes prohlížeč** a s Claude + Chrome uloží agent snímky sám ([R9.5](#R9.5)) a převezme je. Od
   výzkumu 1.37.0 úkol mezitím nečeká na člověka ani není v Co čeká; na člověka přejde jen snímek zadržený
   prohlížečem nebo ukládání zastavené koncem sezení.
5. Jinak snímky uloží člověk do složky nebo je pošle z aplikace (**Mám snímky**) ([R9.9](#R9.9)).
6. Převzetí: most hned, jinak start dalšího sezení, nebo příkaz `strom media add --inbox --waiting`.
7. Jsou-li tam všechny snímky, úkol je zase **otevřený** ve frontě, s poznámkou, co přišlo. Chybí-li některé, čeká
   dál a Co čeká ukazuje, které chybí (zpět na krok 5).
8. Kdykoli mezi tím: odpověď člověka (v aplikaci nebo `strom task wake T… --answer`) vrátí úkol s odpovědí. Svolení
   **pomalu** nebo **přes prohlížeč** vrátí úkoly čekající na archiv, které ve složce ještě nic nemají.

- **Platí od:** výzkum 1.27.0, aplikace Strom 3.23.0
- **Od výzkumu 1.37.0:** úkol, který přešel na člověka kvůli prohlížeči agenta (zadržené stahování, zastavené
  ukládání), nebo čeká na snímky knihy, kam prohlížeč agenta smí, vrátí člověk agentovi, když překážka pominula
  ([R6.7.3](R6-awaiting-action.md#R6.7.3)); úkol jde hned na řadu a zpět na krok 4.

<!-- zdroj: research:src/commands/media.ts:141 wakeWaiting · src/core/archivewait.ts:188 wakeForArchive · src/core/inboxwatch.ts · src/commands/session.ts takeWaiting · src/core/live.ts waiting answer · 1.37.0: research:81de7cdb src/core/waiting.ts savedByAgentNow -->

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

Úrovně a meze jsou ze seznamu archivů výzkumu 1.27.0, DigiArchiv SOA Třeboň z výzkumu 1.28.0, BLHA z výzkumu
1.35.0. Rodina Horákových je vymyšlená.

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

<a id="R9.10.7"></a>
### R9.10.7 Brandenburgisches Landeshauptarchiv (BLHA)

- Archiv: omezeno, jen přes prohlížeč člověka. Týká se duplikátů matrik (Rep. 5KB) v online přístupu archivu
  (blha-recherche.brandenburg.de); snímky jdou z obrazového serveru blha-digi.brandenburg.de. Robots.txt zavírá celý
  web, takže požadavky stromu samého ani stahovač tam nevedou.
- Archiv odpověděl 18. 11. 2026 (doslovná citace je v seznamu): člověk smí ve svém prohlížeči ukládat jednotlivé
  snímky lidským tempem a nechat je číst AI asistenta na svém počítači, snímky jsou pod licencí CC-0. Nejvýš dva
  požadavky najednou. Nikdy prohledávání databáze archivu ani celá kniha.
- Úkol: křest Anny Vlkové v duplikátu matriky. S Claude Code, rozšířením a svolením **přes prohlížeč** agent otevře
  prohlížeč knihy, přejde na snímek a uloží ten zobrazený `strom media save`, tempem člověka (10 s). Adresa prohlížeče
  snímek nejmenuje.
- Bez svolení nebo s jiným agentem: úkol čeká na snímky; Co čeká řekne, s čím by je agent uložil sám.
- Kniha: seznam u archivu údaj o celé knize nemá, takže se nabízejí jen potřebné snímky
  ([R6.8.1](R6-awaiting-action.md#R6.8.1)).
- Citace: „BLHA, Rep. 5KB Nr. <n>“, kde n je číslo knihy ze signatury „5KB <n>“, s číslem snímku v knize.
- **Platí od:** výzkum 1.35.0

<!-- zdroj: research:465c54ea assets/archives.json blha-recherche.brandenburg.de (restricted, browserOnly, terms robots.txt, quoteFrom reply, replied 2026-11-18, robots Disallow / zrušeno odpovědí pro jednotlivé snímky, nejvýš 2 požadavky, imagesFrom blha-digi.brandenburg.de, scope: nikdy prohledávání databáze ani celá kniha, adresa prohlížeče snímek nejmenuje, citace „BLHA, Rep. 5KB Nr. <n>“; bez wholeBook), blha-digi.brandenburg.de (restricted, IIIF, po jednom), blha.brandenburg.de (unknown, pace 10 s) · src/core/net.ts HUMAN_PACE 10 s · src/commands/archives.ts paceFor · src/core/terms.ts allows (browserOnly + restricted) · src/core/books.ts downloadOf (bez údaje range) · CHANGELOG.cs.md 1.35.0 (BLHA podle odpovědi z 18. 11. 2026) · commit d013df1c -->

<a id="R9.12"></a>
## R9.12 Sčítání lidu jako pramen

Sčítání lidu zapisuje jednu domácnost v jednom roce: kdo bydlel v domě, jaký vztah měl k přednostovi, věk nebo rok
narození, často rodiště, domovskou obec a povolání. Výzkum sčítání použije, jen když ho člověk pro výzkum zapne.

- **Hlídá kód:**
  - volba `census` (**Sčítání lidu v tomto výzkumu**) je ve výchozím stavu vypnutá. Nenastavená volba znamená
    vypnuto, i u výzkumů založených dřív;
  - volba platí pro všechny výzkumy na tomto počítači, nebo s `--for-tree` jen pro jeden. Hodnota výzkumu má přednost
    oběma směry (zapnuto i vypnuto). Menu terminálu i aplikace Strom zapisují hodnotu výzkumu. Proměnná prostředí ani
    přepínač příkazu volbu nemění;
  - zapne ji jen člověk: v menu, ve svém terminálu, nebo přepínačem v aplikaci Strom ([S4.4.10](S4-research-from-the-app.md#S4.4.10)).
    Když zapnutí spouští agent v rozhovoru, ptá se člověka okno systému. Bez okna (samostatná práce agenta) strom
    zapnutí odmítne a řekne agentovi, ať sčítání navrhne ([R9.12.1](#R9.12.1)). Vypnout smí kdokoli, bez dotazu;
  - zapnuto: jdou založit úkoly sčítání (`strom task add … --census <rok>[:<dům>]`) a agent u nich dostane stránku
    metodiky o sčítání a seznam sčítání, která strom zná ([R9.12.2](#R9.12.2));
  - vypnuto: úkol sčítání nejde založit (odmítnutí řekne, jak sčítání navrhnout), stránku `strom guide census` strom
    nedá a úkoly sčítání jsou odložené ([R9.12.4](#R9.12.4)). Zapsané události sčítání zůstávají;
  - Archiv Stromu volbu v menu nemá. Most ji v Archivu Stromu i ve výzkumu, který čeká na agenta, odmítne.
- **Proč:** matriky zachycují jednotlivé události. Sčítání ukáže celou domácnost v jednom roce, kam se rodina
  stěhovala a odkud kdo přišel, což matriky často neřeknou. Většina archivů sčítání jen zobrazuje, archy proto
  většinou dodá člověk snímkem obrazovky.
- **Ovládání:** terminál: menu **Nastavení** → **Jazyk, agent, model, co smí agent sám, příběhy… (průvodce
  nastavením)** → **Sčítání lidu v tomto výzkumu: …**. Nejdřív věta, co sčítání dává, pak otázka **Zapnout sčítání
  lidu v tomto výzkumu?** nebo **Vypnout sčítání lidu v tomto výzkumu? Jeho úkoly se odloží a po zapnutí se vrátí.**
  (Enter = nic se nemění). Příkaz `strom config set census on|off [--for-tree]`, platnou hodnotu ukáže
  `strom config where`. Aplikace: [S4.4.10](S4-research-from-the-app.md#S4.4.10).
- **Platí od:** výzkum 1.36.0, aplikace 3.31.0

<!-- zdroj: research:c7b117cd src/core/config.ts SETTINGS census (env "", tree: true, off|on), censusSwitch (strom.json oběma směry, jinak config uživatele; nenastaveno = off) · src/commands/setup.ts censusDecision (requireHuman: terminál člověka; agent → okno systému, bez okna NeedsConsentError s návodem census propose; STROM_FOR_APP bez okna; vypnutí bez dotazu), effective census off · src/commands/tasks.ts censusOrigin (--census <rok>[:<dům>], census.off s návodem) · src/commands/meta.ts guide census (census.off) · src/brief/brief.ts (podmínka census / census-off) · src/core/live.ts POST /census (409 census.archive) · research:5a73905e src/cli/menu-settings.ts censusLabel, censusStep (ui.settings.census.about, .on, .off; --for-tree; jen mimo archiv) · cs.json ui.settings.census* · assets/method/census.md (úvod) · test/cli/census.test.ts · CHANGELOG.cs.md 1.36.0 „Sčítání lidu“ · dirigent:spec/106-vyzkum-scitani-lidu Proč, K1.1–K1.4, rozhodnutí 19. 11. a 20. 11. M2 -->

<a id="R9.12.1"></a>
### R9.12.1 Návrh zapnout sčítání

Při vypnutém sčítání smí agent sčítání člověku navrhnout, jednou za výzkum.

- **Hlídá kód:**
  - `strom census propose --why "…" [--person P…]` založí jednu položku Co čeká ([R6.2](R6-awaiting-action.md#R6.2))
    v jazyce výzkumu: „Sčítání lidu by mohlo výzkumu pomoci: … Zapnout jde v nastavení tohoto výzkumu.“ (s osobou
    „… by mohlo pomoci u osoby …“). Čeká na rozhodnutí: zapnout sčítání, nebo ne;
  - druhý návrh strom odmítne, ať první skončil jakkoli (vyřízený, zrušený, odmítnutý). Při zapnutém sčítání
    odmítne každý návrh;
  - `--why` je jedna nebo dvě věty v jazyce výzkumu, nejvýš 600 znaků, a nesmí člověka oslovovat;
  - zapnutí sčítání návrh uzavře („Sčítání lidu zapnuto“). Při zapnutém sčítání se otevřený návrh nikde neukazuje;
  - souhrn sezení, ve kterém návrh vznikl, ho řekne větou „Navrženo zapnout sčítání lidu (T…).“;
  - návrh je úkol druhu **Ostatní**, ne úkol sčítání.
- **Jen metodika:** návrh jen na slepém místě, kde by sčítání pomohlo: původ osoby neznámý, mezera mezi událostmi
  z matrik. Po návrhu agent pokračuje bez sčítání a znovu se neptá.
- **Ovládání:** aplikace: **Čeká na vyřízení**. Terminál: menu Co čeká, zapnutí v [R9.12](#R9.12).
- **Platí od:** výzkum 1.36.0

<!-- zdroj: research:5a73905e src/commands/census.ts census propose (census.on, census.proposed, census.addresses, --why max 600, state waiting, wait kind other, origin census:propose) · src/core/census.ts censusProposal, censusHidden · src/commands/setup.ts closeCensusProposal (census.propose.done) · src/commands/session.ts censusSummary (census.propose.session) · src/core/taskkind.ts (census:propose → other) · assets/method/core.md „Census records are off“ · cs.json census.propose.* · dirigent:spec/106 rozhodnutí 20. 11. M1 -->

<a id="R9.12.2"></a>
### R9.12.2 Kdy a kde agent sčítání hledá

Úkol sčítání je jedna domácnost v jednom roce a domě. Kde sčítání hledat, říká agentovi seznam archivů dodaný
s výzkumem.

- **Hlídá kód:**
  - brief úkolu sčítání (jen při zapnutém sčítání) vyjmenuje sčítání ze seznamu archivů: roky, území, rejstřík jmen,
    jak se domácnost hledá a cesta pro strom. Úroveň a podmínky archivu platí jako u každého záznamu
    ([R9.1](#R9.1)) a cesta nikdy není mírnější než úroveň archivu;
  - sčítání v seznamu archivů (výzkum 1.36.0):

| Archiv | Roky | Území | Hledání | Cesta |
|---|---|---|---|---|
| Moravský zemský archiv (Acta Publica) | 1857, 1869, 1880, 1890, 1900, 1910, 1921 | jižní Morava a Vysočina | obec, ulice; bez rejstříku jmen | ručně: arch uloží člověk ([R9.10.1](#R9.10.1)) |
| SOA v Třeboni (DigiArchiv) | jako MZA | jižní Čechy | obec | ručně |
| Východočeské archivy (ARON) | jako MZA | východní Čechy | obec; bez rejstříku jmen | agent sám |
| FamilySearch | jako MZA | vybraná místa | obec | jen odkaz a úkol pro člověka |
| Archiv hlavního města Prahy | 1869, 1880, 1890 | Praha | – | ručně |
| MyHeritage | 1900, 1910, 1921 | Česko | jméno (rejstřík jmen) | ručně |
| Archiv města Brna | 1850, 1857, 1870, 1880, 1890, 1900, 1921 | Brno | jméno, dům (rejstřík jmen) | pomalu, po jednom záznamu |
| Archiv města Ostravy | neuvedeny | Ostrava | – | pomalu, po jednom záznamu |

- **Jen metodika:**
  - **kdy:** původ osoby neznámý (křest nenalezen tam, kde žila), mezera mezi událostmi z matrik (stěhování, děti
    zemřelé jinde, druhý sňatek), nebo dům známý z křtu, sňatku či pohřbu v roce blízkém roku sčítání;
  - jen lidé, ke kterým strom vede (nic mimo strom), nikdy žijící. Jeden úkol na domácnost, rok a dům, nikdy na
    osobu;
  - **kde:** sčítání obce a roku v katalogu archivu jedním hledáním, nikdy procházením čísel. V něm dům podle čísla;
    kde je rejstřík jmen, hledat jménem a číslo domu ověřit. Nikdy neprocházet čísla domů ani nehledat lidi, které
    strom nepotřebuje;
  - archiv, který sčítání jen zobrazuje: úkol čeká na člověka, s adresou sčítání obce a tím, co uložit („obec, rok,
    číslo domu: celý arch, obě strany“), nebo na snímky knihy ([R9.6](#R9.6)). Arch větší než jedna obrazovka přijde
    po částech;
  - nenalezeno (sčítání obce ztracené, dům chybí, rodina jinde): negativní hledání s tím, co přesně se prošlo, a
    agent se k tomu nevrací.
- **Ovládání:** terminál: `strom task add … --census <rok>:<dům>`, `strom task wait T… --kind web --url <adresa>
  --on "…"` nebo `--images B…:<čísla>`, `strom search add … --result negative`.
- **Platí od:** výzkum 1.36.0

<!-- zdroj: research:5a73905e assets/archives.json census (years, area, nameIndex, search, how, says, checked 2026-11-04 až 2026-11-20: mza.cz by-hand, digi.ceskearchivy.cz by-hand, aron.vychodoceskearchivy.cz agent, familysearch.org link, digi.ahmp.cz by-hand, myheritage.com by-hand, digiarchiv.brno.cz slow, badatelna.ostrava.cz slow bez let), censusDays · src/core/census.ts censusHoldings · src/brief/brief.ts (oddíl census jen pro úkol sčítání při zapnutí) · src/core/assets.ts methodFor (census.md) · test/unit/known-terms.test.ts (how nikdy mírnější než úroveň) · assets/method/census.md „When“, „Where“ · dirigent:spec/106 K2.1–K2.4 -->

<a id="R9.12.3"></a>
### R9.12.3 Domácnost: jedna společná událost

`strom census add` zapíše jeden arch (jeden dům, jednu domácnost) najednou. V aplikaci Strom je domácnost jedna
společná událost **Sčítání lidu** ([A10.1](A10-shared-events.md#A10.1)).

- **Hlídá kód:**
  - každý člen domácnosti, který je osobou stromu, dostane událost sčítání se svým vztahem k přednostovi a věkem
    podle archu. Datum, místo, dům, poznámka a citace archu jsou u všech kopií stejné. Jediný člen ze stromu dostane
    obyčejné sčítání osoby a jeho vztah je v poznámce;
  - lidé z archu, kteří nejsou ve stromu (čeleď, podruzi, nájemníci), jsou jen v poznámce domácnosti; osoba z nich
    nevznikne. Nic dalšího se nezapíše: rok a místo narození z archu nejsou narození;
  - **datum:** rok sám znamená rozhodný den sčítání toho roku, když ho strom zná: v Česku 31. 10. 1857, 31. 12. 1869,
    1880, 1890, 1900 a 1910 a 15. 2. 1921. Jinak zůstane rok. Celé datum má přednost;
  - **místo** je obec nebo záznam místa, nikdy ulice ani číslo domu. Dům se píše, jak ho uvádí arch („14“, „Dlouhá 12“);
  - **vztah:** pevná slova (hlava domácnosti, manželka, manžel, syn, dcera, otec, matka, tchán, tchyně, zeť, snacha,
    vnuk, vnučka, bratr, sestra, nevlastní syn, nevlastní dcera, schovanec, příbuzný, sluha, služka, čeledín,
    děvečka, nájemník, podruh, výměnkář, učeň, tovaryš) se poznají v češtině, angličtině, němčině i polštině a zapíší
    se slovem jazyka výzkumu. Jiný vztah zůstane, jak je napsaný;
  - vztah, jak ho píší formuláře a čtení archu: „přednosta [domácnosti]“, „hlava rodiny“, „Haushaltungsvorstand“,
    „głowa rodziny“ a „head of the household“ jsou hlava domácnosti. Dovětek, který říká jen ke komu vztah je
    („manželka přednosty“, „son of the head“, „Tochter des Haushaltungsvorstandes“, „v domácnosti“), se odřízne.
    Z výčtu přes čárku platí hlava domácnosti, je-li v něm; jinak zůstane celý;
  - **odmítne se:** člen, který není osobou stromu (nebo je sloučený či odvolaný), osoba uvedená dvakrát, člen bez
    vztahu, osoba, která nejspíš žije, dvě hlavy domácnosti a domácnost už zapsaná (týž rok, obec a dům);
  - **upozorní:** v témže domě a roce jsou další osoby stromu (jiná domácnost domu, nebo tatáž zapsaná dvakrát);
    sčítání téhož roku jinde (stěhování, nebo dvě osoby vzaté za jednu);
  - kopie zůstávají jednou událostí: společný údaj opravený u jedné kopie (`strom event edit`, `strom cite`,
    `strom note edit|retract|restore`, `strom event main`) a návrh opravy přijatý u jedné kopie platí pro všechny.
    Věk, vztah, ověření a potvrzení člověkem má každá kopie svůj; stav výzkumu jde na všechny kopie jen výslovně
    (`--status`). Do společné poznámky nejde nic, co patří jedné kopii;
  - zapsat domácnost jde i při vypnutém sčítání: příkaz zapisuje dodaný arch, nic nehledá.
- **Jen metodika:**
  - arch číst jako zápis matriky, celou domácnost i hlavu domu; zapsat jednou. Každý rok je vlastní domácnost,
    nikdy se neslučuje;
  - **vodítko, ne doklad:** rok nebo místo narození, domovská obec a povolání ze sčítání nikdy nenahradí narození ani
    křest. Vedou do matriky: úkol najít faru rodiště. Kde se sčítání a matrika rozcházejí, vznikne poznámka nebo
    hypotéza; údaj z matriky se kvůli sčítání nemění;
  - **přečíslované domy:** dům poznat i podle sousedů a jmen, ne jen podle čísla; nejistotu říct v poznámce.
- **Ovládání:** terminál: `strom census add --source S… --date <rok|den> --place <obec|L…> --house <č.>`
  `--member P…:<vztah>:<věk> … [--others "…"] [--note "…"] [--locator "…"] [--transcript "…"]`. Aplikace: domácnost
  u každé osoby a na **Časové ose** ([A10.2](A10-shared-events.md#A10.2), [A6.3](A6-views.md#A6.3)). Příklad
  (smyšlený): `strom census add --source S0004 --date 1890 --place L0007 --house 14`
  `--member P0002:"přednosta domácnosti":41 --member P0003:"manželka přednosty":36 --others "čeledín, 19 let"`
  zapíše Janu Horákovi hlavu domácnosti (41) a Marii Horákové manželku (36), obojí k 31. 12. 1890.
- **Platí od:** výzkum 1.36.0, aplikace 3.31.0
- **Od výzkumu 1.37.0:**
  - sčítání osoby zapsané jako vlastní událost se jménem sčítání („Sčítání lidu“, „Census“, „Volkszählung“…) jde do
    aplikace Strom jako sčítání (`1 CENS`); záznam ve výzkumu zůstává, jak byl zapsán. Událost páru a jméno s něčím
    navíc zůstanou, jak jsou. Aplikace 3.32.0 už takové sčítání při načtení verze výzkumu neukazuje přeškrtnuté
    ([S2.7.1](S2-edits-from-the-app.md#S2.7.1));
  - `strom check` upozorní na dvě sčítání jedné osoby se stejným datem (`two-censuses`) a poradí ponechat to, které
    říká víc (domácnost, citace), a druhé stáhnout `strom event retract`;
  - stejná slova záznamu citovaného dvakrát jdou do poznámky údaje, jména nebo rodiny jen jednou.

<!-- zdroj: research:8dba2e52 src/commands/household.ts census add (--source, --date, --place, --house, --member, --others, --note, --locator, --transcript/--quote, --information, --status, --country; sameHouse, elsewhere) · src/core/household.ts addHousehold (census.member.none, record.none, merged/retracted, census.member.twice, census.living, relace chybí, census.head.twice, domácnost už zapsaná; jeden člen bez share id, vztah do poznámky; others jen v poznámce), parseMember, alignCopies · src/gedcom/export.ts (2 NOTE bez řádků kopie) · src/commands/people.ts alignCopies u note edit/retract/restore, cite, event edit, event main · research:ece404b9 src/core/origin.ts (přijatý návrh na všechny kopie), censusDay jedna tabulka · research:5a73905e assets/archives.json censusDays CZ · research:d2bef48e src/core/household.ts householdRoleOf, src/core/phrases.ts HOUSEHOLD_ROLES, HOUSEHOLD_ROLES_ALSO, HOUSEHOLD_OF_HEAD · test/cli/census-household.test.ts, census-reader.test.ts · assets/method/census.md „Reading and recording“ · CHANGELOG.cs.md 1.36.0 · dirigent:spec/106 K3.1–K3.3 · dirigent:prace/1120-vyzkum-106-scitani Výsledek (census add i při vypnutí, stav jen výslovně) · 1.37.0: research:6aa96d31 src/gedcom/export.ts (vlastní událost sčítání jako 1 CENS), src/core/labelkind.ts kindOfLabel, strom check two-censuses, poznámka bez zdvojených slov · CHANGELOG.cs.md 1.37.0 · dirigent:K052 -->

<a id="R9.12.4"></a>
### R9.12.4 Vypnuté sčítání: odložené úkoly

Vypnutí sčítání úkoly sčítání odloží, nesmaže. Po zapnutí se vrátí samy.

- **Hlídá kód:**
  - při vypnutém sčítání jsou úkoly sčítání otevřené nebo čekající (i na snímky) mimo frontu, její počty, Co čeká
    a stav pro aplikaci. Nic se nezapíše ani nesmaže: odložení se počítá z volby;
  - úkol, na kterém sezení právě pracuje, se neodloží: sezení ho dokončí. Zůstane-li nedokončený, je zase otevřený
    a od té chvíle odložený. Agent to při zavření sezení slyší;
  - úkol, který člověk odložil na později, zůstává odložený jako dosud. Vyřízené a zrušené úkoly se nemění;
  - `strom task list` řekne, kolik úkolů sčítání je odloženo; `strom task list --kind census` je ukáže se značkou
    „held: census off“. U odloženého úkolu spuštěného podle čísla (`strom session start T…`) agent slyší, že úkol
    je odložený, ať sezení zavře a vezme jiný úkol;
  - menu nastavení ukáže u volby např. „vypnuto, odloženy 3 úkoly sčítání“ a po vypnutí větu „Odloženo: 3 úkoly
    sčítání. Po zapnutí se vrátí.“
- **Ovládání:** terminál: volba v [R9.12](#R9.12), `strom task list --kind census`. Aplikace: přepínač
  [S4.4.10](S4-research-from-the-app.md#S4.4.10) s větou o odložených úkolech.
- **Platí od:** výzkum 1.36.0

<!-- zdroj: research:c7b117cd src/core/census.ts censusHeld (open, parked do uplynulého dne, waiting; nikdy doing ani parked člověkem), censusHidden, censusHeldCount · src/core/queue.ts rankTasks censusHide · src/core/waiting.ts (Co čeká) · src/core/live.ts censusStatus (/status.census {on, held}) · src/commands/tasks.ts task list (censusHeldNow, „held: census off“, --kind census) · src/commands/session.ts censusLine, censusCloseLine · research:5a73905e src/cli/menu-settings.ts censusLabel (ui.settings.census.held), censusStep (ui.settings.census.back) · test/cli/census.test.ts (M3) · dirigent:spec/106 K1.3, rozhodnutí 20. 11. M3 -->

<a id="R9.13"></a>
## R9.13 Omezený archiv: jedno sezení najednou

Archiv, který omezuje automatický přístup, používá najednou jen jedno sezení ze všech výzkumů se společnou složkou
na počítači. Archiv tak nezablokuje přístup a jeden pracující jede plnou povolenou rychlostí, místo aby se víc
pracujících dělilo o tempo.

- **Omezený archiv:** podmínky archivu chtějí lidské tempo nebo jen prohlížeč, člověk dal svolení „pomalu“ nebo „přes
  prohlížeč“ ([R9.2](#R9.2)), nebo stahovač archivu má hodinový strop. Odmítnutí archivu (401, 403, 429) omezený
  archiv nedělá: archiv se nechá chvíli být jako dosud. Archiv se pozná podle domény webu.
- **Hlídá kód:**
  - úkol, jehož knihy leží jen na omezeném archivu, vezme se zabráním úkolu i archiv. Archiv drží sezení; agent,
    který na archiv teprve zabloudí, ho zabere prvním požadavkem;
  - držení archivu skončí se sezením, s propadnutím sezení ([R7.9](R7-when-the-agent-works.md#R7.9)), nebo po
    `archive.hold` (výchozí 30 min) bez požadavku na archiv, i když sezení dál běží. Kdo jen čte stažené skeny,
    archiv tak uvolní;
  - úkol na archivu, který drží jiné sezení, se zatím vynechá a vezme se jiná práce („vynechán: archiv … omezuje
    automatický přístup a teď ho používá jiné sezení“). Požadavek agenta na takový archiv se odmítne;
  - samostatná práce, které zbyly jen takové úkoly, počká nejvýš `archive.wait` (výchozí 30 min). Archivu se během
    čekání nic neposílá. Pak běh skončí s důvodem „nic dalšího k práci – zbylé úkoly potřebují archiv …, který celou
    dobu čekání používalo jiné sezení“;
  - `strom session start T…` na úkolu obsazeného archivu se odmítne jednou větou: „Archiv … teď používá jiný výzkum
    (od 9:10, naposledy 9:40); uvolní se nejpozději v 10:10.“ Ve stejném výzkumu stojí místo „jiný výzkum“ číslo
    sezení;
  - kdo na archiv čeká, stojí ve frontě; po uvolnění má přednost ten, kdo čeká nejdéle. Sezení, které archiv pustilo,
    ho hned znovu nezabere, když na něj někdo čeká.
- **Hromadné stahování:** na počítači běží najednou jen jedno hromadné stahování snímků z omezeného archivu
  (`strom fetch`). Další se zařadí do fronty („queued behind …“) a počká samo nejvýš `archive.wait`; pak skončí
  s časem, kdy to zkusit znovu. Stahování drží i archiv, takže ho agenti ostatních výzkumů přeskakují. Neomezené archivy
  se nemění: jejich tempo dál hlídá jen omezovač požadavků.
- **Hranice:** držení neříká, jak rychle se stahuje, jen kdo; tempo archivu se nemění. Starší strom vedle tohoto
  archivy nedrží a drží se jen tempa.
- **V aplikaci:** kdo archiv používá a na který archiv práce čeká, ukazuje Přehled výzkumu
  ([S4.1](S4-research-from-the-app.md#S4.1), [S4.2](S4-research-from-the-app.md#S4.2)).
- **Ovládání:** terminál: `strom config set archive.hold <minuty>`, `strom config set archive.wait <minuty>` (např.
  `45m`, `2h`; 5 min až 24 h, platí pro tento počítač); menu ukazuje „Samostatná práce čeká na archiv … (nejdéle do
  …).“
- **Platí od:** výzkum 1.36.0

<!-- zdroj: research:10894288, 9408c7ea, 41dcd8eb src/core/archiveholds.ts (hlavička; restrictedLevel: browserOnly, permission slow|browser, allows(…).human; ne forbidden/refused; cappedConnector policy.pace.perHour; siteOf webDomain; siteLife: proces, sezení, archive.hold; PRIORITY_MS 2 min; joinQueue, releaseSite; BULK) · src/commands/connectors.ts:1443-1448 (help fetch), :3085-3190 holdArchive (fetch obrázků čeká ve frontě ≤ archive.wait, ostatní exit 7 data.held) · src/commands/session.ts:985-997, :1355-1389 (stop archive) · src/core/errors.ts:142 archive.held(.own) · src/core/config.ts:336-337 archive.hold, archive.wait · cs.json ui.run.skip.archive, ui.run.archive.wait, ui.run.stop.archive, ui.error.archive.held(.own), ui.menu.working.archive · CHANGELOG.cs.md 1.36.0 · dirigent:spec/127 K2.1–K2.5, K5.1, rozhodnutí 21. 11. (1)–(3), navrh-rezervace.md kap. 5 -->
