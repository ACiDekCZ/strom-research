<a id="S3"></a>
# S3 Co ví výzkum

Kapitola popisuje, co aplikace ukazuje o osobě z výzkumu: dialog **Co ví výzkum** s oddíly **Nad osobou**,
**Rozpory**, **Hypotézy** a **Prohledáno** a stejnojmenný oddíl panelu výzkumu. Popisuje aplikaci Strom 3.21.2
(a výzkum 1.25.2). Změny z novější verze mají u sebe její číslo.

<a id="S3.1"></a>
## S3.1 Co ví výzkum jen čte to, co výzkum poslal

Výzkum ke každé osobě přidá do rodokmenu pro aplikaci zvláštní bloky: rozpory, hypotézy, prohledané prameny
a kraj stromu nad osobou. Aplikace je jen ukazuje. Nic z nich se v aplikaci nezmění a aplikace je zpět
nepošle; žijí ve výzkumu. Hlavička dialogu nese datum výzkumu „stav k …“.

- **Odkud:** z mostu (rodokmen, který aplikace načte z běžícího výzkumu, viz [S1](S1-connecting-app-and-research.md))
  nebo ze souboru `output/tree-strom.ged`. Obojí vzniká stejným exportem výzkumu.
- **Co dialog neukazuje:**
  - stupně jistoty údajů ([R3.1](R3-verification-and-citation.md#R3.1)) a doložení
    ([R3.8](R3-verification-and-citation.md#R3.8));
  - **Čeká na vyřízení** ([R6](R6-awaiting-action.md));
  - linie a frontu jako celek ([S4](S4-research-from-the-app.md)); linie a úkoly osoby jsou jen v oddílu
    **Nad osobou** ([S3.3](#S3.3)).
- **Hranice:**
  - Rodokmen z jiného programu ani kopie bez bloků výzkumu dialog nemají.
  - Rozpory se mohou brát z novější verze výzkumu, kterou aplikace přečetla, ale ještě nenačetla
    ([S2](S2-edits-from-the-app.md)). Rozpor rozhodnutý z aplikace zmizí hned, ještě před načtením nové verze.
    Dialog se tak může lišit od načtených dat.
- **Ovládání:** aplikace: nic k nastavení. Terminál: soubor vzniká při každém zápisu výzkumu.
- **Platí od:** aplikace 3.4.0 s výzkumem 1.6.0

<!-- zdroj: app:src/ged-parser.ts:185-335 _STROM_CONFLICT/_STROM_HYPO/_STROM_SEARCHED/_STROM_EDGE, :2351-2375 _STROM_ASOF · src/ged-exporter.ts (bloky nepíše) · src/ui/research-sync-ui.ts:2908-2937 researchConflictsOf, researchConflictsShown, settledConflicts · research:src/gedcom/export.ts:760-805 known() · src/commands/output.ts:94 · src/core/live.ts (hlavička: "The app never sends them back") -->

<a id="S3.1.1"></a>
### S3.1.1 Kdy výzkum bloky posílá

Výzkum bloky přidá jen do rodokmenu pro aplikaci Strom, a jen když aplikace danou část umí ukázat. Řídí se
verzí aplikace, kterou zná.

| Část | Aplikace od | Výzkum od |
|---|---|---|
| rozpory, prohledané prameny, „stav k“ | 3.4.0 | 1.6.0 |
| **Nad osobou** | 3.6.0 | 1.9.0 |
| hypotézy s verzemi a přepínačem **Ukázat** | 3.11.0 | 1.14.0 |

- **Hranice:** neznámá verze aplikace a jiná kopie aplikace (vlastní adresa aplikace) se berou jako aktuální.
- **Platí od:** výzkum 1.6.0

<!-- zdroj: research:src/core/stromapp.ts APP_OPENS_LINKS="3.4.0", APP_SHOWS_EDGES="3.6.0", APP_SHOWS_HYPOTHESIS_LINKS="3.11.0" · src/commands/output.ts:94 appOpensLinks, appShowsEdges -->

<a id="S3.2"></a>
## S3.2 Kde se Co ví výzkum otevře

Dialog se otevře z nabídky osoby, podmenu **Výzkum → Co ví výzkum**. Položka tam je, jen když výzkum o osobě něco
ví: aspoň jeden rozpor, hypotézu, prohledaný pramen, nebo oddíl **Nad osobou**. Otevřené rozpory nese jako
počet, např. „2 rozpory“.

- **Další cesty do dialogu** (každá ho otevře u svého místa):
  - značka **rozpor ›** u pole v úpravě osoby (u data a místa narození a úmrtí, jména, pohlaví, titulu
    a přídomku): jeden rozpor rozhodnutelný stranou otevře kartu rozporu, jinak dialog;
  - nabídka osoby, blok signálů „n rozporů · n hypotéz“ s odkazem **Co ví výzkum ›**;
  - pahýl kraje výzkumu nad kartou otevře oddíl **Nad osobou** ([S3.3](#S3.3));
  - u vazby připojené jen v zobrazení **Co ví výzkum o vazbě** a popisek čáry „nedoloženo“ ([S3.5.1](#S3.5.1));
  - karta rozporu, **Víc v Co ví výzkum ›**;
  - řádek oddílu v panelu výzkumu ([S3.7](#S3.7)).
- **Hranice:**
  - Číst jde všude: na telefonu, v zamčeném rodokmenu i jen ke čtení.
  - Tlačítka, která otevírají výzkum, jsou jen na počítači (zařízení bez dotykového ukazatele), se zapnutým
    **Strom Research na tomto počítači** a jen ta, která výzkum ohlásil ([S1](S1-connecting-app-and-research.md)).
  - Samotný ostrov (rodina mimo strom) položku v nabídce nepřidá.
- **Ovládání:** aplikace: nabídka osoby → **Výzkum → Co ví výzkum**.
- **Platí od:** aplikace 3.4.0
- **Od aplikace 3.22.0:** v podmenu **Výzkum** jsou nahoře linie, ve kterých osoba je.

<!-- zdroj: app:src/ui/person-research-ui.ts:140-150 personResearchKnows, markResearchConflicts · src/ui/context-menu.ts personSection · src/ui/card-signals-ui.ts · src/card-signals.ts:171-194 · src/ui/view-links-ui.ts:326 · src/renderer.ts:5479 · src/ui/research-edge-ui.ts:205, :364 · src/ui/conflict-panel-ui.ts:274 · src/ui/research-ui.ts:2119 researchLinkAvailable · HEAD context-menu.ts personInLineItems (spec 038 §5.1) -->

<a id="S3.3"></a>
## S3.3 Nad osobou ukazuje, kde strom končí a co dál

Oddíl je u osoby, nad kterou strom nepokračuje: nemá rodiče, má jen jednoho, nebo rodiče nedokládá žádný záznam.
Řekne, proč tu hledání stojí, a co se stane dál.

- **Proč to končí:** např. „Otec v zápisu neuveden“, „Matriky se nedochovaly“, „Známé matriky začínají 1784“,
  „Mezera v matrikách“, „Prohledáno, nenalezeno“, „Zbývá archiv“, „Prohledáno zčásti“, „Zatím nehledáno“,
  „Neznámé místo narození“, „Rodiče nejsou doloženi záznamem“. Mez linie ji nahradí:
  „Tady končí limit linie“, „Linie je pozastavená“, „Linie je ukončená“, „Nejspíš žijící, nezkoumá se“
  ([R2.1.2](R2-lines-and-queue.md#R2.1.2)).
- **Co dál:** „Agent na tom právě pracuje“, „Čeká na odpověď“, „Ve frontě jako 3.“, „Úkol přibude s dalším
  sezením“, „Čeká mimo frontu (pozastavená linie)“, „Strom už nemá co navrhnout. Teď je potřeba rozhodnout.“,
  „Nic není naplánováno“. Aplikace to počítá živě z toho, co výzkum právě dělá.
- **Časová osa „Křest 1780–1800“:** roky, kde se hledá křest, s legendou *prohledáno, nenalezeno* / *bez matrik* /
  *nehledáno* a odhadem roku narození (▲, např. „odhad 1790 ze sňatku 1815“).
- **Známé knihy narození** s přístupem: *online zdarma*, *online, přihlášení*, *badatelna*, *na žádost*,
  *nedochováno*.
- **Úkoly:** pořadí ve frontě, nebo proč stojí (*pozastavená linie*, *ukončená linie*, *rodina mimo strom*,
  *odloženo do …*); hotové pod **Zkoušené úkoly · n**.
- **Práce:** počet hledání, počet sezení agenta s cenou, „naposledy …“. V archivu sezení ani cena nejsou.
- **Hypotézy:** možné napojení na jinou osobu, rodina mimo strom („rodina mimo strom, 4 lidé“), kolik úkolů
  čeká, které úkoly hypotézu testují.
- Odkaz „2 otevřené rozpory ↓“ sjede na oddíl **Rozpory**.
- **Hranice:** „stav k …“ je v hlavičce oddílu, jen když je výzkum starší než dnešek.
- **Ovládání:** aplikace: **Nastavení → Zobrazení stromu → Kraj výzkumu** (*Vypnuto* / *K vyřízení* / *Vše*)
  řídí jen pahýly nad kartami, ne tento oddíl. Volba je jen u rodokmenu z výzkumu. *K vyřízení* chybí
  u kopie, která nemá frontu. Terminál: `strom edge`.
- **Platí od:** aplikace 3.6.0 s výzkumem 1.9.0; více rodin mimo strom od aplikace 3.13.0 s výzkumem 1.16.0

<!-- zdroj: app:src/ui/research-edge-ui.ts researchEdgeSectionHtml, :372-373 stale asOf, :445-448 sessions/cost, edgeOf · :560-600 nastavení · index.html:22496, :22540 · strings.ts researchEdge.* · research:src/core/edge.ts EDGE_MISSING, EDGE_SCOPES, EDGE_ENDS, EDGE_NEXT · CHANGELOG 3.13.0 -->

<a id="S3.3.1"></a>
### S3.3.1 Akce u Nad osobou

| Tlačítko | Kdy je | Co otevře |
|---|---|---|
| **Chat** (**Rozhodnout v chatu**, když „Teď je potřeba rozhodnout“) | vždy | rozhovor s agentem o osobě |
| **Revize osoby** | vždy | revizi osoby ve výzkumu |
| **Pokračovat v linii** | linie je pozastavená nebo ukončená | terminál s volbou linie |
| **Odpovědět** | úkol osoby čeká na odpověď | úkol ve výzkumu ([R6](R6-awaiting-action.md)) |

- **Hranice:** jen u osoby z výzkumu, jen kde výzkum odkaz ohlásil ([S3.2](#S3.2)). V archivu
  a ve výzkumu, který čeká na agenta, nejsou žádné, protože každé vede k agentovi.
- **Ovládání:** aplikace: tlačítka pod oddílem.
- **Platí od:** aplikace 3.6.0
- **Od aplikace 3.22.0:** **Pokračovat v linii** obnoví linii přímo přes most, když ho výzkum umí, bez terminálu.

<!-- zdroj: app:v3.21.2 src/ui/research-edge-ui.ts:489-506, :539-548 · HEAD research-edge-ui.ts managesDirections -->

<a id="S3.4"></a>
## S3.4 Rozpory

Oddíl **Rozpory** ukazuje rozpory osoby a rodin, kde je osoba partnerem. Otevřené jsou první, pak rozhodnuté
s řádkem „rozhodnuto: … (…)“. Pramen jde otevřít v prohlížeči pramenů. Co rozpor je, kde je vidět
a jak se rozhoduje, popisuje [R5.6](R5-conflicts.md#R5.6). Rozhodnutí stranou z aplikace popisuje
[R5.6.1](R5-conflicts.md#R5.6.1).

- **Hranice:** **Rozhodnout ve výzkumu** a **Nechat na agentovi** jsou jen u osoby z výzkumu a jen kde je výzkum
  ohlásil.
  **Nechat na agentovi** chybí v archivu a ve výzkumu, který čeká na agenta.
- **Ovládání:** viz [R5.6](R5-conflicts.md#R5.6).
- **Platí od:** aplikace 3.4.0 s výzkumem 1.6.0
- **Od aplikace 3.22.0:** rozpor vzniklý úpravou v aplikaci nese text „Úprava v aplikaci se tu liší od výzkumu;
  rozhoduje se ve výzkumu.“ (dosud vždy „Tady se rozcházejí prameny; rozhoduje se ve výzkumu.“).

<!-- zdroj: app:src/ui/person-research-ui.ts showPersonResearchDialog (Rozpory), activeResearchNoAgent · research:src/gedcom/export.ts:760-805 · HEAD person-research-ui.ts conflictFromEdit, strings.ts conflict.editOnly · HEAD research-decide.ts conflictFromEdit -->

<a id="S3.5"></a>
## S3.5 Hypotézy

Oddíl **Hypotézy** ukazuje hypotézy, které se osoby týkají: je jejich předmětem, nebo ji jmenuje některá verze.
Každá hypotéza je rozbalovací. Pod názvem je číslo a stav: *otevřená*, *rozhodnutá pro B*, *zrušená*, počet verzí
a poznámka. Otevřené jsou rozbalené.

- **Řádek verze:** písmeno a tvrzení (dlouhé se rozbalí) a co verze dělá se stromem: „ukázáno · + 2 lidí · Najít“,
  „+ 2 lidí“, „Tak to strom už vede“, „Jen text, nedá se ukázat.“, „bez vazby k osobám stromu“,
  u rozhodnuté *zvolená*, „Teď spojeno doopravdy“, „Už neplatí: …“.
- **Které hypotézy výzkum pošle:** otevřené; rozhodnuté a zrušené jen ty, jejichž verze nesou vazby. Odvolané nikdy.
- **Kdo rozhodl:** hypotéza, kterou rozhodl agent ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)), nese
  *rozhodl agent* se dnem a **Důvod** (text rozhodnutí v jazyce výzkumu; dlouhý se rozbalí).
- **Hranice:** rozhodnout hypotézu z aplikace nejde; rozhoduje se ve výzkumu, v terminálu
  ([R10.3.1](R10-people-and-hypotheses.md#R10.3.1)). Kdo rozhoduje, člověk, nebo agent, je volba výzkumu
  ([R10.3.2](R10-people-and-hypotheses.md#R10.3.2)).
- **Ovládání:** aplikace: přepínač **Ukázat** u verze ([S3.5.1](#S3.5.1)); **Rozhodnout ve výzkumu**, u rozhodnuté
  **Změnit ve výzkumu** otevře hypotézu ve výzkumu na tomto počítači.
- **Platí od:** aplikace 3.11.0 s výzkumem 1.14.0 (verze, stav, **Ukázat**); seznam hypotéz od aplikace 3.4.0
- **Od aplikace 3.25.0:** *rozhodl agent* s důvodem (s výzkumem 1.29.0), **Rozhodnout ve výzkumu** a **Změnit ve
  výzkumu**.

<!-- zdroj: app:src/ui/person-research-ui.ts researchHypothesesHtml · strings.ts research.hypo*, hypoByAgent, hypoReason, hypoChange, decideInResearch, viewLinks.* · research:src/gedcom/export.ts:309-325 hypothesisPeople, _BY agent / DECI / _AT (brána APP_SHOWS_HYPOTHESIS_DECIDER) · CHANGELOG 3.11.0, 3.25.0 -->

<a id="S3.5.1"></a>
### S3.5.1 Ukázat: připojeno jen v zobrazení

Přepínač **Ukázat** nakreslí verzi hypotézy do stromu jako „Připojeno jen v zobrazení“. Data rodokmenu se tím
nezmění. Verze jedné hypotézy se vylučují; zapnutá může být nejvýš jedna, nebo žádná.

- **Hranice:**
  - přepínač je jen u otevřené hypotézy a jen u verze, kterou jde nakreslit;
  - kreslí se jen v pohledech Rodina a Potomci ([A6](A6-views.md));
  - volba patří zařízení a rodokmenu; jde se zálohou všeho, ne s kopií rodokmenu;
  - s mostem jen tehdy, když výzkum vazby hypotéz posílá.
- **Ovládání:** aplikace: **Ukázat** v dialogu; u nakreslené vazby nabídka **Co ví výzkum o vazbě**.
- **Platí od:** aplikace 3.11.0 s výzkumem 1.14.0

<!-- zdroj: app:src/view-links.ts strom-view-links:{treeId}, strom-view-links-master:{treeId}, viewLinksAvailable (HYPOTHESIS_LINKS) · src/ui/view-links-ui.ts:326 · strings.ts viewLinks.state -->

<a id="S3.6"></a>
## S3.6 Prohledáno

Oddíl **Prohledáno** je tabulka hledání, která výzkum k osobě zapsal: **Záznam**, **Roky**, **Výsledek**
(*nalezeno* / *nic*). Řadí se podle prvního roku. Patří sem hledání z úkolů, jejichž předmětem osoba je.

- **Hranice:** výzkum rozlišuje víc výsledků, než aplikace ukáže. *nalezeno* je jen nalezený záznam. Všechno
  ostatní, i hledání zčásti nebo bez závěru, je *nic*. Co je hledání bez výsledku, popisuje
  [R3.6](R3-verification-and-citation.md#R3.6).
- **Ovládání:** aplikace: jen čtení. Terminál: hledání zapisuje agent.
- **Platí od:** aplikace 3.4.0 s výzkumem 1.6.0

<!-- zdroj: app:src/ui/person-research-ui.ts (Prohledáno) · src/ged-parser.ts _STROM_SEARCHED (TITL, DATE, RESN, _AT) · research:src/gedcom/export.ts:760-805 RESN found|none · strings.ts research.searched*, found, none -->

<a id="S3.7"></a>
## S3.7 Oddíl Co ví výzkum v panelu výzkumu

Panel výzkumu má oddíl **Co ví výzkum** se souhrnem „3 rozpory · 1 hypotéza“. Má řádek pro každý otevřený rozpor
(„Marie Vlková · narození: 1790 × 1791“) a pak pro každou otevřenou hypotézu („Marie Vlková · Hypotéza:
Otec z Horákova mlýna“). Klik otevře dialog osoby u daného rozporu nebo hypotézy.

- **Hranice:**
  - panel je vidět jen při živém sledování výzkumu, který neskončil a patří k otevřenému rodokmenu
    ([S4](S4-research-from-the-app.md));
  - bez otevřených rozporů a hypotéz oddíl není.
- **Ovládání:** aplikace: panel výzkumu, oddíl **Co ví výzkum**.
- **Platí od:** aplikace 3.5.0

<!-- zdroj: app:src/ui/research-overview-ui.ts appendOverviewKnows · strings.ts live.knowsTitle, live.hypothesisRow · commit 228ac6a -->
