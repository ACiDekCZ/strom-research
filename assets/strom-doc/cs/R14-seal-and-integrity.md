<a id="R14"></a>
# R14 Pečeť a celistvost výzkumu

Každou změnu výzkumu zapisuje strom jako operaci do logů historie (`data/ops`) a zapečetí ji klíčem tohoto počítače
spolu s commitem v historii výzkumu (git). `strom verify` porovná každý záznam a commit s jeho pečetí a řekne, co se
změnilo mimo strom. Kapitola popisuje, jaké cesty dál strom nabízí, a podrobně přijetí výzkumu tak, jak je
(`strom seal accept`), historii starší než výzkum a vrácení opravy (`strom repair undo`). Popisuje výzkum 1.30.1; změny
z novější verze mají u sebe její číslo.

<!-- zdroj: research:39c56a89 strom help verify („seal check of every record and commit“), strom help repair, strom help seal adopt, strom help seal accept · src/core/accept.ts (záhlaví) · src/core/tree.ts commit (commitSeal klíčem tohoto počítače), requireKey · CHANGELOG.cs.md 1.30.1 · dirigent:spec/072-prijmout-stav/spec.md -->

<a id="R14.1"></a>
## R14.1 Co nesedí s pečetí a cesty dál

Co `strom verify` najde, určuje, kterou cestou se jde dál. Každou z nich spouští člověk ve svém terminálu.

| Co se stalo | Cesta | Co udělá |
|---|---|---|
| záznam změněný nebo vytvořený mimo strom, historie (git) je čitelná | `strom repair` | vrátí poslední zapečetěný stav: změněné záznamy obnoví, záznamy vytvořené mimo strom odebere; kopie všeho nahrazeného nechá v `.strom/quarantine/`; od výzkumu 1.31.0 se víc než 3 odebraných záznamů ptá člověka ([R14.3](#R14.3)) a kopie vrátí `strom repair undo` ([R14.3.1](#R14.3.1)) |
| výzkum zapečetěný na jiném počítači | `strom seal adopt` | zkontroluje řetěz operací a otisk každého záznamu a vytvoří pro výzkum klíč tohoto počítače |
| ztracená historie: chybí nejstarší logy `data/ops` a historie (git) nejde přečíst nebo žádná není; záznamy jsou, jak je strom zapsal | `strom seal accept` | nic nevrací ani nepřebírá: výzkum tak, jak je teď, zapečetí jako nový základ ([R14.2](#R14.2)) |
| od výzkumu 1.31.0: historie (git) jde přečíst, ale je starší než výzkum; `strom repair` by odebral práci | nikdy `strom repair`: nejdřív záloha celé složky, pak `.git` ze zálohy nebo z Time Machine, nebo `strom seal accept` | nic se neodebere ([R14.1.1](#R14.1.1)) |

- **Hlídá kód:**
  - s čitelnou historií (git) strom `strom seal accept` neradí: ztracené logy z ní vrátí `strom repair`. Od výzkumu
    1.31.0 výjimka: historie starší než výzkum ([R14.1.1](#R14.1.1));
  - s poškozenou nebo chybějící historií `strom verify` i `strom check` hlásí nález `git-damaged` (historie nejde
    přečíst, chybí její objekty, nebo výzkum historii nemá) a u každého souboru, který nesedí s pečetí,
    radí: „historie (git) je poškozená, strom repair ji nevrátí – po prohlédnutí záznamů ve vlastním terminálu: strom
    seal accept“;
  - zápis do výzkumu s poškozenou historií strom odmítne větou „historie (git) výzkumu je poškozená: nic se nezapsalo“
    (kód `tree.git-damaged`) se stejnou radou, místo chyby gitu. Dřív se na ní zastavil každý zápis i `strom check`.
- **Ovládání:** terminál: `strom verify`, `strom check`, `strom repair`, `strom repair undo`, `strom seal adopt`,
  `strom seal accept`.
- **Platí od:** výzkum 1.30.1; 1.31.0: historie starší než výzkum, otázka `strom repair`, `strom repair undo`

<!-- zdroj: research:39c56a89 src/core/accept.ts ACCEPT_HINT, acceptWay (jen bez .git nebo s git.damaged; čitelná historie → nic, strom repair vrátí logy), GIT_DAMAGED, guardOrDamaged · src/commands/checks.ts check a verify (acceptWay nad verifyFull) · src/core/integrity.ts assertIntact, gitDamagedError (tree.git-damaged) · cs.json ui.check.accept.hint, ui.error.tree.git-damaged(.hint) · strom help repair, strom help seal adopt · CHANGELOG.cs.md 1.30.1 -->

<a id="R14.1.1"></a>
### R14.1.1 Historie starší než výzkum: `history-reverted`

Cloudový disk může do výzkumu vrátit starší kopii historie (git), často s kopiemi iCloudu uvnitř `.git` (například
`index 2`, `HEAD 2`). Historie jde přečíst, ale záznamy zapsané od té kopie v ní nejsou. `strom verify` je pak hlásí
jako vytvořené mimo strom a `strom repair` by je odebral. Proto strom nejdřív spočítá, co by `strom repair` udělal,
a kde by odebral práci, radí cestu, která nic neztratí.

- **Hlídá kód:**
  - historii bere jako starší než výzkum, když by `strom repair` odebral aspoň jeden záznam, který zapsala neporušená
    podepsaná operace z logů historie ve složce, na který odkazují jiné záznamy, nebo který má nižší číslo než
    nejvyšší záznam téhož druhu v zapečetěném stavu (ztratila se nejstarší historie); nebo když jsou uvnitř `.git`
    kopie iCloudu a oprava by něco odebrala;
  - `strom verify` i `strom check` pak hlásí nález `history-reverted` s počtem: „historie (git) je starší než výzkum:
    strom repair by odebral N záznamů“. U něj i u každého nálezu, kde by jinak radily `strom repair`, radí:
    „nejdřív zálohovat celou složku výzkumu; pak vrátit .git ze zálohy nebo z Time Machine – nebo po prohlédnutí
    záznamů ve vlastním terminálu: strom seal accept (nikdy strom repair: tu práci by odebral)“;
  - zápis do takového výzkumu strom odmítne větou „historie (git) je starší než výzkum – strom repair by odebral
    N záznamů: nic se nezapsalo“ (kód `tree.history-reverted`) se stejnou radou a s odkazem na `strom verify`;
  - s poškozenou nebo chybějící historií (`git-damaged`) platí dál cesta z [R14.1](#R14.1): `strom seal accept`.
- **Ovládání:** terminál: `strom verify`, `strom check`; dál podle rady: záloha složky, `.git` ze zálohy nebo z Time
  Machine, nebo `strom seal accept` ([R14.2](#R14.2)).
- **Platí od:** výzkum 1.31.0
- **Proč:** výzkum v iCloud Drive se starší kopií `.git` a bez nejstarších logů hlásil záznamy jako nezapečetěné
  a `strom repair` by odebral záznamy let práce (nález 9. 11. 2026).

<!-- zdroj: research:0c6f2205 src/core/repair.ts (záhlaví, nález 2026-11-09), planRepair (sealedWork, referenced, older, cloudCopies), historyLost, HISTORY_REVERTED, LOST_HINT, repairWay (ne při GIT_DAMAGED), lostFinding, historyLostError (tree.history-reverted), lostOnRepair · src/core/integrity.ts assertIntact (lostOnRepair → historyLostError) · src/commands/checks.ts sealWay (check, verify) · cs.json ui.check.lost, ui.check.lost.hint, ui.error.tree.history-reverted(.hint) · CHANGELOG.cs.md 1.31.0 -->

<a id="R14.2"></a>
## R14.2 Přijmout výzkum tak, jak je: `strom seal accept`

Cloudový disk (například iCloud Drive) může z výzkumu odebrat nejstarší logy historie (`data/ops`) a objekty jeho
historie (git). Záznamy zůstanou, jak je strom zapsal, ale `strom verify` je hlásí jako vytvořené nebo změněné mimo
strom a `strom repair` nemá co vrátit, nebo by vrátil starší stav. `strom seal accept` vezme výzkum tak, jak je teď,
jako nový zapečetěný základ. Rozhoduje o tom člověk, který záznamy předtím prohlédl.

- **Nejdřív počty:** bez potvrzení příkaz nic nezmění. Vypíše, co by přijetí udělalo:
  - záznamy, kterým chybí historie;
  - záznamy novější, než říká zbytek jejich historie;
  - další soubory výzkumu (historie, kvalita, `strom.json`), které nesedí s pečetí;
  - kolik logů historie je ve složce;
  - stav historie (git): **čitelná** (změna se do ní přidá), **poslední změnu neudělal strom** (zapečetí se znovu),
    **poškozená** (odsune se celá, nic se nesmaže, založí se nová), **žádná** (založí se nová);
  - kopie souborů z iCloudu, které se odsunou, a kopie, které zůstanou na místě ([R14.2.1](#R14.2.1)).
- **Potvrzení:** člověk ve vlastním terminálu odpoví na **Přijmout výzkum tak, jak je teď?**. Výchozí odpověď je ne.
- **Rozdíl:** `strom repair` vrací poslední zapečetěný stav, `strom seal adopt` přebírá výzkum zapečetěný na jiném
  počítači; `strom seal accept` nic nevrací ani nepřebírá ([R14.1](#R14.1)).
- **Ovládání:** terminál: `strom seal accept --preview` (jen počty, smí i agent), `strom seal accept`. Jde i
  v Archivu Stromu.
- **Platí od:** výzkum 1.30.1

<!-- zdroj: research:39c56a89 src/commands/checks.ts seal accept (planAccept → acceptSaid; preview nebo neinteraktivně jen počty, exit 4; confirm(ui.accept.ask, false)) · src/core/accept.ts AcceptPlan (unsealed, edited, other, logs, git ok|unsealed|damaged|missing, moveAside, copies) · cs.json ui.accept.title, unsealed, edited, other, logs, git.*, aside, copies, does, ask · src/cli/help.ts ARCHIVE_COMMANDS „seal accept“ · CHANGELOG.cs.md 1.30.1 -->

<a id="R14.2.1"></a>
### R14.2.1 Co přijetí udělá

Po potvrzení jedna zapečetěná změna zapíše každý soubor, který nesedí s pečetí, tak, jak je teď: žádný záznam se
nezmění, nic se nesmaže.

- **Hlídá kód:**
  - jedna podepsaná operace (`seal.accept`) nese otisk každého takového souboru a strom ji uloží zapečetěným commitem;
  - poškozenou historii (git) odsune celou do složky `.git-damaged-<kdy>` vedle výzkumu a založí novou; složka se
    starou historií do nové nepatří. Bez historie založí novou, čitelnou historii jen doplní o změnu;
  - kopie souborů z iCloudu (například „P0001 2.json“) ve složkách `data/`, `history/` a `quality/` a kopie zámků
    v `.strom/` odsune do `.strom/accepted-<kdy>/`; jako záznamy je nikdy nezapečetí. Kopie jinde ve výzkumu (vedle
    `strom.json`, v `.strom/`, v `output/`) jen vypíše a nechá na místě;
  - nakonec znovu spustí úplnou kontrolu: „strom verify: v pořádku – každý záznam sedí se svou pečetí“, nebo kolik
    problémů zbývá („strom verify pořád hlásí problémy: N“);
  - druhé spuštění nic neudělá: „není co přijímat – každý záznam sedí se svou pečetí“.
- **Platí od:** výzkum 1.30.1

<!-- zdroj: research:39c56a89 src/core/accept.ts applyAccept (appendOp seal.accept files[path, sha], targets []; tree.commit; .git-damaged-<stamp>, git.initRepo, .git/info/exclude /.git-damaged-*/; .strom/accepted-<stamp>), cloudCopies (SEALED_DIRS data, history, quality; kopie zámků v .strom; kořen, .strom, output jen vypsat), isCloudCopy, nothingToAccept · src/commands/checks.ts (po přijetí verifyFull) · cs.json ui.accept.does, done, gitmoved, copiesmoved, verified, still, nothing -->

<a id="R14.2.2"></a>
### R14.2.2 Co přijetí hlídá a nikdy neřeší

- **Hlídá kód:**
  - výzkum přijme jen člověk ve vlastním interaktivním terminálu, stejnou branou jako `strom seal adopt`; `--yes` ho
    nikdy nepřijme („--yes výzkum nikdy nepřijme: rozhoduje člověk ve vlastním terminálu“). Mimo interaktivní
    terminál příkaz vypíše jen počty a větu „O přijetí výzkumu rozhoduje jen člověk ve vlastním terminálu – strom seal
    accept“;
  - agent smí jen `--preview`; přijetí samo agentovi strom odmítne a agent člověku řekne příkaz;
  - nic nepřijme, dokud nad výzkumem běží most do aplikace Strom (`strom live stop`, pak znovu) nebo na něm někdo
    pracuje (`strom session finish`, pak znovu);
  - po potvrzení udělá strom plán znovu pod zámkem výzkumu; když se výzkum od prohlédnutí změnil, nepřijme nic
    („výzkum se od prohlédnutí změnil: nic se nepřijalo“);
  - výzkum zapečetěný na jiném počítači se nejdřív převezme (`strom seal adopt`);
  - jiné nálezy kontroly přijetí nikdy neřeší: přepsaný log, podvrženou operaci, jiný klíč, soubory jen v cloudu,
    smazaný záznam ani soubor v `data/`, který není záznamem čitelným pro strom. S takovým nálezem nepřijme nic
    („Nepřijato: kontrola našla, co přijetí nikdy neřeší“) a cestu řekne `strom verify`.
- **Platí od:** výzkum 1.30.1

<!-- zdroj: research:39c56a89 src/commands/checks.ts seal accept (agentMay jen --preview; ctx.yes → accept.yes; requireHuman jako seal adopt; liveRunning → accept.bridge; liveWorkers/runsAtWork → accept.busy; tree.requireKey) · src/core/accept.ts SETTLED (unsealed, manual-edit, history-edited, quality-edited, config-edited, foreign-commit), planAccept refused (jiné kódy; recordReadable), applyAccept samePlan → accept.changed · src/cli/help.ts HUMAN_COMMANDS · cs.json ui.accept.person, refused, ui.error.accept.* · strom help seal accept -->

<a id="R14.3"></a>
## R14.3 `strom repair` se ptá člověka

`strom repair` vrátí výzkum do posledního zapečetěného stavu ([R14.1](#R14.1)). Nejdřív spočítá, co by udělal. Když by
odebral víc záznamů nebo práci, rozhodne člověk ve vlastním terminálu.

- **Hranice:**
  - ptá se, když by odebral víc než 3 záznamy, nebo jakýkoli záznam se znakem historie starší než výzkum
    ([R14.1.1](#R14.1.1)); jinak opraví bez otázky;
  - před otázkou vypíše, kolik záznamů (a souborů) by odebral a kolik souborů by vrátil podle zapečetěného stavu
    (commit), a z toho kolik záznamů zapsaly operace zapečetěné ve vlastních lozích, na kolik odkazují jiné záznamy,
    kolik je starších než zapečetěný stav a které kopie iCloudu jsou uvnitř `.git`;
  - pak: „Nejdřív zálohovat celou složku výzkumu. Kopie všeho odebraného zůstane v .strom/quarantine/, strom repair
    undo ji vrátí.“ Se znakem historie starší než výzkum navíc radí místo opravy `.git` ze zálohy nebo z Time Machine,
    nebo `strom seal accept`;
  - otázka **Odebrat N záznamů?** má výchozí odpověď ne (Enter).
- **Hlídá kód:**
  - agent, `--yes` ani běh bez terminálu otázku nedostanou: jen počty a větu „O odebrání záznamů rozhoduje jen člověk
    ve vlastním terminálu – strom repair“ (`needs-consent`, exit 4); agent to člověku řekne;
  - po souhlasu udělá strom plán znovu pod zámkem výzkumu; když se výzkum od prohlédnutí změnil, neopraví nic
    („výzkum se od prohlédnutí změnil: nic se neopravilo“);
  - vedle kopií v `.strom/quarantine/<stamp>/` uloží seznam toho, co odebral a co přepsal, a po opravě řekne
    „vrátit zpět: strom repair undo <stamp>“ ([R14.3.1](#R14.3.1)).
- **Ovládání:** terminál: `strom repair`.
- **Platí od:** výzkum 1.31.0

<!-- zdroj: research:0c6f2205 src/core/repair.ts REPAIR_ASKS_ABOVE = 3, repairAsks, historyLost, applyRepair (MANIFEST repair.json vedle kopií), sameRepair · src/commands/checks.ts repair (planRepair → repairAsks → requireHuman window false → confirm(ui.repair.ask, false); pod zámkem planRepair znovu, repair.changed; ui.repair.undo.how), repairSaid, repairQuestion · src/cli/context.ts requireHuman (NeedsConsentError) · src/core/errors.ts EXIT.needsConsent 4 · cs.json ui.repair.ask.*, ui.repair.ask, ui.repair.person, ui.error.repair.changed · strom help repair · CHANGELOG.cs.md 1.31.0 -->

<a id="R14.3.1"></a>
### R14.3.1 Vrátit opravu: `strom repair undo`

Co `strom repair` odebral nebo přepsal, vrátí `strom repair undo` z jeho kopií v `.strom/quarantine/`.

- **Hranice:**
  - bez razítka vypíše kopie, které `strom repair` uchoval, od nejnovější, u každé počet souborů a záznamů; bez
    kopií: „v .strom/quarantine/ nejsou žádné kopie ze strom repair“. Výpis smí spustit kdokoli, i agent;
  - s razítkem nejdřív vypíše, co by vrácení udělalo: vrácené soubory (a z nich záznamy), soubory změněné od opravy,
    které zůstanou, jak jsou teď, a soubory, které strom nepečetí (kopie z iCloudu, neznámé soubory) a zůstanou
    v karanténě. Otázka **Vrátit je?** má výchozí odpověď ne;
  - vrátí soubor, který oprava odebrala a od té doby ve složce není, a soubor, který oprava přepsala a od té doby se
    nezměnil. U kopií z `strom repair` výzkumu 1.30 (bez seznamu toho, co oprava přepsala) vrátí jen soubory, které ve
    složce chybějí;
  - nic k vrácení: „není co vracet – každý soubor je jako jeho kopie, nebo se od té doby změnil“.
- **Hlídá kód:**
  - vrácení s razítkem je jen pro člověka ve vlastním terminálu; jinde strom vypíše jen počty a „O vrácení toho, co
    strom repair odebral, rozhoduje jen člověk ve vlastním terminálu – strom repair undo <stamp>“ (exit 4);
  - vrací jen do výzkumu, jak ho strom zapečetil: se změnami mimo strom nevrátí nic („výzkum má změny, které strom
    nezapečetil: nic se nevrátilo“, podrobnosti řekne `strom verify`);
  - nic nevrátí, dokud nad výzkumem běží most do aplikace Strom (`strom live stop`, pak znovu) nebo na něm někdo
    pracuje (`strom session finish`, pak znovu);
  - po potvrzení udělá plán znovu pod zámkem výzkumu; když se výzkum od prohlédnutí změnil, nevrátí nic („výzkum se
    od prohlédnutí změnil: nic se nevrátilo“);
  - jedna podepsaná operace (`repair.undo`) jmenuje každý vrácený záznam, jak je, a strom ji uloží zapečetěným
    commitem; ve složce se nic nesmaže. Nakonec znovu spustí úplnou kontrolu jako `strom verify`.
- **Ovládání:** terminál: `strom repair undo` (výpis), `strom repair undo <stamp>`.
- **Platí od:** výzkum 1.31.0; vrací i kopie z `strom repair` výzkumu 1.30

<!-- zdroj: research:0c6f2205 src/commands/checks.ts repair undo (agentMay bez razítka; !interactive → ui.repair.undo.person, exit 4; liveRunning → repair.undo-bridge; liveWorkers/runsAtWork → repair.undo-busy; requireHuman; confirm(ui.repair.undo.ask, false); po applyUndo verifyFull), undoSaid · src/core/repair.ts quarantines (od nejnovější), puttable, planUndo (back: chybí, nebo přepsaný a beze změny podle repair.json; kept; same; left), applyUndo (repair.undo-changed, repair.undo-unsealed, op repair.undo, tree.commit) · cs.json ui.help.cmd.repair.undo, ui.repair.undo.*, ui.error.repair.undo-* · strom help repair undo · CHANGELOG.cs.md 1.31.0 („i po opravě z verze 1.30“) -->
