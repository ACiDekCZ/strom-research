<a id="R14"></a>
# R14 Pečeť a celistvost výzkumu

Každou změnu výzkumu zapisuje strom jako operaci do logů historie (`data/ops`) a zapečetí ji klíčem tohoto počítače
spolu s commitem v historii výzkumu (git). `strom verify` porovná každý záznam a commit s jeho pečetí a řekne, co se
změnilo mimo strom. Kapitola popisuje, jaké cesty dál strom nabízí, a podrobně přijetí výzkumu tak, jak je
(`strom seal accept`). Popisuje výzkum 1.30.1.

<!-- zdroj: research:39c56a89 strom help verify („seal check of every record and commit“), strom help repair, strom help seal adopt, strom help seal accept · src/core/accept.ts (záhlaví) · src/core/tree.ts commit (commitSeal klíčem tohoto počítače), requireKey · CHANGELOG.cs.md 1.30.1 · dirigent:spec/072-prijmout-stav/spec.md -->

<a id="R14.1"></a>
## R14.1 Co nesedí s pečetí a cesty dál

Co `strom verify` najde, určuje, kterou cestou se jde dál. Každou z nich spouští člověk ve svém terminálu.

| Co se stalo | Cesta | Co udělá |
|---|---|---|
| záznam změněný nebo vytvořený mimo strom, historie (git) je čitelná | `strom repair` | vrátí poslední zapečetěný stav: změněné záznamy obnoví, záznamy vytvořené mimo strom odebere; kopie všeho nahrazeného nechá v `.strom/quarantine/` |
| výzkum zapečetěný na jiném počítači | `strom seal adopt` | zkontroluje řetěz operací a otisk každého záznamu a vytvoří pro výzkum klíč tohoto počítače |
| ztracená historie: chybí nejstarší logy `data/ops` a historie (git) nejde přečíst nebo žádná není; záznamy jsou, jak je strom zapsal | `strom seal accept` | nic nevrací ani nepřebírá: výzkum tak, jak je teď, zapečetí jako nový základ ([R14.2](#R14.2)) |

- **Hlídá kód:**
  - s čitelnou historií (git) strom `strom seal accept` neradí: ztracené logy z ní vrátí `strom repair`;
  - s poškozenou nebo chybějící historií `strom verify` i `strom check` hlásí nález `git-damaged` (historie nejde
    přečíst, chybí její objekty, nebo výzkum historii nemá) a u každého souboru, který nesedí s pečetí,
    radí: „historie (git) je poškozená, strom repair ji nevrátí – po prohlédnutí záznamů ve vlastním terminálu: strom
    seal accept“;
  - zápis do výzkumu s poškozenou historií strom odmítne větou „historie (git) výzkumu je poškozená: nic se nezapsalo“
    (kód `tree.git-damaged`) se stejnou radou, místo chyby gitu. Dřív se na ní zastavil každý zápis i `strom check`.
- **Ovládání:** terminál: `strom verify`, `strom check`, `strom repair`, `strom seal adopt`, `strom seal accept`.
- **Platí od:** výzkum 1.30.1

<!-- zdroj: research:39c56a89 src/core/accept.ts ACCEPT_HINT, acceptWay (jen bez .git nebo s git.damaged; čitelná historie → nic, strom repair vrátí logy), GIT_DAMAGED, guardOrDamaged · src/commands/checks.ts check a verify (acceptWay nad verifyFull) · src/core/integrity.ts assertIntact, gitDamagedError (tree.git-damaged) · cs.json ui.check.accept.hint, ui.error.tree.git-damaged(.hint) · strom help repair, strom help seal adopt · CHANGELOG.cs.md 1.30.1 -->

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
