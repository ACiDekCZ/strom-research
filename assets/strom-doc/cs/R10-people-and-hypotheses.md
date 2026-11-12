<a id="R10"></a>
# R10 Osoby: ztotožnění, jména a hypotézy

Jak výzkum pozná, že zápis patří hledané osobě, co udělá se dvěma záznamy jedné osoby, jak vede soupeřící
vysvětlení (hypotézy) a jak zapisuje jména a lidi, které zápis jmenuje. Popisuje výzkum 1.27.0 a aplikaci Strom
3.23.0; změny z novější verze mají u sebe její číslo. U pravidel je rozlišeno, co **hlídá kód** a co je jen **pravidlo metodiky**.

<a id="R10.1"></a>
## R10.1 Jmenovec není hledaná osoba

Zápis patří hledané osobě, jen když ji určí víc než jméno. Dva lidé stejného jména v jedné vsi jsou běžní.

- **Jen metodika:**
  - osobu určuje rok, místo, číslo domu, povolání, manžel nebo manželka a rodiče. Většinu případů rozhodne rodné
    příjmení matky;
  - dva zápisy, které stejnému jménu dávají jiné rodiče (jinou matku), jsou **dvě osoby**, i ve stejném domě
    a se stejným jménem otce. Rozdíl se nevysvětluje chybou písaře a nerozhoduje se většinou
    ([R5.1.1](R5-conflicts.md#R5.1.1));
  - hledaná osoba je ta, kterou jmenuje zápis o její vlastní rodině. Ostatní jsou samostatné osoby;
    „tatáž žena?“ je hypotéza ([R10.3](#R10.3)) s tím, co by ji rozhodlo;
  - pramen mimo matriky (noviny, adresář, web): stačí, když souhlasí jméno, místo a doba **a ještě jeden údaj**
    (dům, povolání, manžel nebo manželka, věk, příbuzný). Jinak hypotéza.
- **Proč:** dva lidé stejného jména v jedné vsi jsou běžní; rodné příjmení matky rozhodne většinu případů (metodika).
- **Ovládání:** terminál (agent). Aplikace ukazuje hypotézy u osoby v **Co ví výzkum → Hypotézy**
  ([S3.5](S3-what-the-research-knows.md#S3.5)).
- **Platí od:** výzkum 1.0.0; pramen mimo matriky 1.10.0

<!-- zdroj: research:assets/method/core.md "A namesake is not your person" · research:assets/method/link.md krok 4 "Identify" · research:assets/method/enrich.md "Your person, not a namesake" (od v1.10.0) -->

<a id="R10.2"></a>
## R10.2 Dva záznamy jedné osoby: sloučení

Když se ukáže, že dva záznamy ve výzkumu jsou jedna osoba, sloučí se. Druhý záznam nezmizí: zůstane odvolaný
s poznámkou, do koho byl sloučen.

- **Hlídá kód** (`strom person merge <zůstává> <druhý> --reason "…"`):
  - sloučení potřebuje důvod;
  - jména, údaje, poznámky, rodiny a všechny odkazy (úkoly, hypotézy, kmotři…) přejdou na osobu, která zůstává;
  - údaje se neslučují: dvě narození po sloučení jsou dvě. strom upozorní, které údaje jsou teď dvakrát;
    lepší se ponechá citací, druhý se odvolá s důvodem;
  - odmítne sloučit osoby různého pohlaví (když ani jedna nemá pohlaví neznámé), partnery jedné rodiny, předka
    s potomkem a osoby s **jinými rodiči**. Jsou-li to tíž rodiče ve dvou záznamech, sloučí se nejdřív rodiny
    (`strom family merge`).
- **Jen metodika:** osoba z převzatého rodokmenu, která už je ve výzkumu zkoumaná, se slučuje **do** zkoumané
  osoby; ta si drží své doklady ([R11.3](R11-material-from-the-user.md#R11.3)).
- **Proč:** strom mezi dvěma údaji nevybírá potichu: který platí, rozhodne doklad. Druhý se odvolá s důvodem, takže
  zůstane vidět, co kde stálo.
- **Ovládání:** terminál: `strom person merge`, `strom family merge`. Možné duplicity ve stromu hlásí aplikace v
  Kontrole stromu ([A5.6](A5-tree-check.md#A5.6)).
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:src/commands/people.ts person merge (description, SINGLE_KINDS) · research:src/core (mergePersons: merge.needs-reason, sex, partners, ancestor, different birth parents) · research:assets/method/intake.md krok 5 -->

<a id="R10.3"></a>
## R10.3 Hypotéza: soupeřící vysvětlení

Když záznamy připouštějí víc vysvětlení (čí je to dítě, jsou to dva zápisy jedné osoby, je to manželský pár), výzkum
nevybírá potichu. Zapíše hypotézu: otázku a její verze A, B, C… s tím, co pro každou mluví a co proti.

- **Hlídá kód:**
  - hypotéza má aspoň dvě verze a týká se aspoň jedné osoby nebo záznamu (`--about`);
  - písmeno verze patří jednomu tvrzení navždy. Nové tvrzení dostane další volné písmeno, použité písmeno se znovu
    nepoužije. Verzi jde přidat jen k otevřené hypotéze;
  - verze může říct, co by spojila: dítě rodiny nebo rodičů, dva záznamy jedné osoby, pár, sourozence. Ve stromu
    se tím nic nespojí; spojení se zapíše až po rozhodnutí hypotézy.
- **Jen metodika:** co by hypotézu rozhodlo, je úkol (`strom task add … --about H…`), ne odbočka v jiném úkolu.
  Spojení verze se zapíše jen tehdy, když ho tvrzení říká bez pochyb; jmenovec zůstane mimo.
- **Ovládání:** terminál: `strom hypothesis add "<otázka>" --about P… --variant "…" --variant "…"`,
  `hypothesis argue`, `hypothesis variant`, `hypothesis link`, `hypothesis show`, `hypothesis list`. Aplikace verze
  ukáže a dovolí je nakreslit do stromu jen pro pohled ([S3.5](S3-what-the-research-knows.md#S3.5),
  [S3.5.1](S3-what-the-research-knows.md#S3.5.1)).
- **Platí od:** výzkum 1.0.0; spojení verzí a nová verze k otevřené hypotéze 1.14.0

<!-- zdroj: research:src/commands/analysis.ts hypothesis add ("at least two --variant", "--about is required"), variant (VARIANT_LABEL, nextLabel, "a letter is never used twice"), link (description) · research:assets/method/core.md "Say what a hypothesis would connect" -->

<a id="R10.3.1"></a>
### R10.3.1 Rozhodnutí hypotézy

Hypotéza se rozhodne pro jednu verzi, nebo se zruší, když žádnou rozhodnout nejde. Kdo ji rozhoduje, určuje volba
výzkumu ([R10.3.2](#R10.3.2)): **Rozhoduje AI** (agent rozhodne sám, jen podle citovaného záznamu; výchozí, když
volba není uložená), nebo **Rozhoduje člověk** (agent rozhodnutí jen navrhne). Člověk rozhoduje v terminálu, nebo
v aplikaci Strom volbou verze, kterou potvrdí terminál výzkumu ([R10.3.3](#R10.3.3)).

- **Hlídá kód:**
  - při **Rozhoduje člověk** je rozhodnutí krok člověka. Když `strom hypothesis decide` spustí agent (i uvnitř
    `strom batch`), strom ho odmítne;
  - agent rozhodnutí navrhne: verzi a text rozhodnutí (`strom hypothesis propose`), nebo zrušení (`--abandon`). Nový
    návrh nahradí předchozí. Na odpověď se nečeká, práce jde dál;
  - návrh čeká v **Co čeká** ve skupině **Hypotézy k rozhodnutí** ([R6.3.4](R6-awaiting-action.md#R6.3.4)): člověk
    rozhodne podle návrhu, jinak (jiná verze nebo žádná, s důvodem), nebo hypotézu nechá, jak je. Nepřijatý návrh
    zůstane v poznámce hypotézy;
  - při **Rozhoduje člověk** čeká ve stejné skupině i otevřená hypotéza bez návrhu, v terminálu i v aplikaci Strom,
    která hypotézy rozhoduje ([S3.5.2](S3-what-the-research-knows.md#S3.5.2)): člověk ji rozhodne sám (verzi nebo
    žádnou), nebo ji nechá otevřenou. Ponechaná otevřená hypotéza se v Co čeká znovu objeví, až agent navrhne, jak ji
    rozhodnout;
  - rozhodnutí i návrh potřebují text rozhodnutí (`--decision`); zrušení je `--abandon`;
  - hypotéza, jejíž verze říkají, co by spojily, se rozhoduje i navrhuje jen s uvedenou verzí (`--variant B`). Bez
    ní strom odmítne a nic nezapíše;
  - rozhodnout znovu (i navrhnout znovu) jde jen s důvodem (`--reason`). Předchozí rozhodnutí zůstane v poznámce
    hypotézy, i s tím, že ho rozhodl agent. Rozhodnutá i zrušená hypotéza nabízí v menu **Změnit rozhodnutí**;
  - co rozhodnutí člověka spojuje (dítě rodiny, pár), zapíše strom hned, ve stejném kroku ([R10.3.3](#R10.3.3)). Co
    se zapsat nedalo, a prameny zvolené verze, které žádný údaj jejích osob necituje, dostane agent na začátku příští
    práce jako první úkol.
- **Jen metodika:** agent navrhne rozhodnutí, když záznamy ukazují na jednu verzi, a řekne to člověku jednou větou.
  Rozhodnutou hypotézu, kterou nový záznam vyvrátí, agent navrhne znovu s důvodem. Co agent zadržel, dokud byla
  osoba jen hypotéza, zapíše k osobě, až je hypotéza rozhodnutá.
- **Proč:** nové rozhodnutí potřebuje důvod, protože se rozhodnutí mění otevřeně: předchozí zůstane čitelné a nové
  řekne, co ho změnilo (obvykle nový záznam).
- **Ovládání:** terminál: menu `strom` → **Co čeká** → **Hypotézy k rozhodnutí** → **Rozhodnout podle návrhu**,
  **Rozhodnout jinak**, **Nechat, jak je (návrh nepřijat)**; u otevřené hypotézy bez návrhu **Rozhodnout**, **Nechat
  otevřenou**; u rozhodnuté nebo zrušené **Změnit rozhodnutí** (text a důvod povinné). Tatáž obrazovka je v revizi
  osoby: **Rozšířit výzkum** → **Revize osoby** → **Hypotézy o osobě (n)**. Příkazem `strom hypothesis decide H…
  --proposed`, `--keep-open`, nebo `--variant B --decision "…"` (znovu s `--reason "…"`). Agent: `strom hypothesis
  propose H… --variant B --decision "…"`. Aplikace: **Co ví výzkum** → hypotéza → **Vybrat** u verze
  ([S3.5.2](S3-what-the-research-knows.md#S3.5.2)); se starším výzkumem **Rozhodnout ve výzkumu**, u rozhodnuté
  **Změnit ve výzkumu** ([S3.5](S3-what-the-research-knows.md#S3.5)).
- **Platí od:** výzkum 1.0.0; výpis nezapsaných pramenů 1.12.0
- **Od výzkumu 1.28.0:** rozhoduje jen člověk, agent navrhuje; uvedenou verzi hlídá kód (dřív jen metodika).
  Hypotézy, které dřív rozhodl agent, zůstávají, jak byly.
- **Od výzkumu 1.29.0:** kdo rozhoduje, je volba výzkumu ([R10.3.2](#R10.3.2)); bez uložené volby rozhoduje AI, i ve
  výzkumu založeném dřív. Co čeká nabízí i otevřené
  hypotézy bez návrhu (**Rozhodnout**, **Nechat otevřenou**) a menu **Změnit rozhodnutí**. Do 1.28.0 otevřená
  hypotéza bez návrhu v Co čeká nebyla a rozhodla se jen příkazem `strom hypothesis decide`.
- **Od aplikace 3.25.0:** **Rozhodnout ve výzkumu** a **Změnit ve výzkumu** v **Co ví výzkum**, kde je výzkum na
  tomto počítači nabízí.
- **Od výzkumu 1.31.0:** vazby rozhodnutí člověka zapíše strom hned; dřív je zapsal agent při své příští práci.
  Hypotézu jde rozhodnout i v aplikaci Strom 3.27.0 ([R10.3.3](#R10.3.3)).

<!-- zdroj: research:src/commands/analysis.ts hypothesis propose, hypothesis decide (person: …, agentMay, --proposed, --keep-open bez návrhu → leftOpen, againNeedsReason, decidedVariant, "earlier … by the agent") · src/cli/main.ts:288 def.person && isAgent && !def.agentMay · src/commands/batch.ts (def.agentMay) · src/core/waiting.ts (hypotheses, hypothesesOpen, TERMINAL_ONLY) · src/cli/menu-waiting.ts decideHypothesis (proposed / open / decided: ui.wait.hypothesis.change) · src/cli/menu-research.ts:532 ui.review.hypotheses · src/core/hypolinks.ts decidedToRecord, sourcesNotOnPeople · src/brief/brief.ts "Decided by the user — record it on the tree first" · assets/lang/cs.json wait.group.hypotheses, ui.wait.hypothesis.*, ui.review.hypotheses · research:assets/method/core.md "The user decides a hypothesis" · assets/method/recording.md "is proposed again" · CHANGELOG.cs.md 1.28.0, 1.29.0 · research 1.28.0 = commit 94a593db · app:src/strings.ts research.decideInResearch, research.hypoChange · CHANGELOG.cs.md 3.25.0 · výzkum 1.31.0: src/core/hypolinks.ts writeDecision (vazby child/partners zvolené verze hned), decidedToRecord (zbytek agentovi), sourcesNotOnPeople (jen zvolená verze) · src/core/waiting.ts hypothesesApp (i aplikaci, priority -1 bez návrhu, !leftOpen) · commity 7a8f4b53, 8e27fa5c, 06cca755 · CHANGELOG.cs.md 1.31.0 -->

<a id="R10.3.2"></a>
### R10.3.2 Kdo rozhoduje hypotézy: člověk, nebo AI

Volba výzkumu **Kdo rozhoduje hypotézy** určuje, kdo hypotézu rozhodne. **Rozhoduje AI** je výchozí: agent rozhodne
sám, jakmile citovaný záznam ukazuje na jednu verzi; jeho rozhodnutí je označené a člověk ho kdykoli změní.
**Rozhoduje člověk**: agent jen navrhne a rozhodnutí čeká v **Co čeká**. Zpět na rozhodování člověka:
`strom config set hypotheses.decide person`.

- **Hlídá kód:**
  - bez uložené volby rozhoduje AI: u nového výzkumu, u výzkumu založeného dřív (do verze 1.28.0 volba nebyla), při
    nastavení bez terminálu a když nastavení spustí agent. Uložená volba (**Rozhoduje člověk** i **Rozhoduje AI**)
    zůstává. Přepnutí nemění hypotézy, které už jsou rozhodnuté;
  - úvodní nastavení (`strom setup`) nabídne jako první **Rozhoduje AI (doporučeno)** s větou „Doporučeno: rozhoduje
    AI – výzkum pokračuje, aniž by hypotézy čekaly; každé její rozhodnutí je označené a dá se změnit.“ Enter ji
    vezme bez dalšího potvrzení. Zvolené **Rozhoduje člověk** se uloží a další `strom setup` ho nabídne jako
    současnou volbu;
  - kde je uložené **Rozhoduje člověk**, zapne **Rozhoduje AI** znovu jen člověk v terminálu: otázka vysvětlí, co to
    znamená, a chce druhé ano. Totéž platí pro smazání uložené volby (`strom config unset hypotheses.decide`), protože
    bez ní rozhoduje AI. Agentovi strom obojí odmítne. Zpět na **Rozhoduje člověk** jde kdykoli, bez potvrzení;
  - aplikace při uložené **Rozhoduje člověk** a 10 a více otevřených hypotézách stromu nabídne v **Co ví výzkum**, oddíl
    **Hypotézy**, jednou větou přepnutí: „N otevřených hypotéz čeká na rozhodnutí člověka; při „Rozhoduje AI“ je agent
    rozhodne sám, každou s důvodem.“ **Přepnout na „Rozhoduje AI“** otevře výzkum v terminálu, kde se volba potvrdí
    druhým ano; v aplikaci se AI nezapne. **Skrýt** nabídku u tohoto výzkumu skryje natrvalo (v tomto prohlížeči).
    Nabídka je jen u výzkumu na tomto počítači, který volbu umí a odkaz do výzkumu nabízí ([S3.5](S3-what-the-research-knows.md#S3.5));
  - volba platí pro výzkumy na tomto počítači. Výzkum může mít vlastní (`--for-tree`); volba z aplikace se zapíše
    jen tomu výzkumu;
  - agent rozhodne jen verzi, kterou podporuje citovaný pramen výzkumu (S…). Bez něj strom odmítne a nabídne návrh
    (`strom hypothesis propose`);
  - verzi, která by ke stromu připojila větev 10 a více lidí mimo strom, agent rozhodne jen se dvěma citovanými
    prameny a bez námitky proti ní; jinak ji jen navrhne;
  - rozhodnutí člověka agent nikdy nezmění; když ho nový záznam vyvrátí, navrhne ho znovu ([R10.3.1](#R10.3.1));
  - hypotézu, kterou rozhodnout nejde, agent zruší s textem rozhodnutí;
  - rozhodnutí agenta nese značku a den. Terminál: u hypotézy **Rozhodl agent (den).**, v přehledu změn „H… rozhodl
    agent: …“ a „H… odložil agent: …“. Aplikace: **Co ví výzkum** → **rozhodl agent** se dnem a důvodem;
  - co rozhodnutí agenta spojuje, zapíše agent do stromu hned;
  - když rozhodnutí agenta změní člověk, značka zmizí a předchozí rozhodnutí zůstane v poznámce hypotézy;
  - v Archivu Stromu volba není.
- **Jen metodika:** agent řekne člověku jednou větou, co rozhodl.
- **Ovládání:** terminál: úvodní nastavení `strom setup`, krok **Kdo rozhoduje hypotézy – nejistá spojení lidí?** (jen
  když nastavení dělá člověk v terminálu; bez terminálu se neptá a platí uložená volba, bez ní **Rozhoduje AI**;
  doporučení je jen tady, menu Nastavení nabídne současnou volbu); menu **Nastavení** →
  **Jazyk, agent, model, co smí agent sám, příběhy… (průvodce nastavením)** → **Kdo rozhoduje hypotézy: …**;
  `strom config set hypotheses.decide person|agent [--for-tree]`, platnou hodnotu ukáže `strom config where`.
  Zpět na rozhodování člověka: `strom config set hypotheses.decide person`.
  Aplikace: **Výzkum** → **Další** → **Výzkum u tohoto stromu…** → **Kdo rozhoduje hypotézy**: **Rozhoduje člověk** se
  do výzkumu zapíše hned, **Rozhoduje AI** potvrdí výzkum v terminálu (**Potvrdit ve výzkumu**). Řádek se ukáže jen
  s výzkumem, který volbu umí. Nabídka v **Co ví výzkum** → **Hypotézy**: **Přepnout na „Rozhoduje AI“**, **Skrýt**.
- **Platí od:** výzkum 1.29.0, aplikace 3.25.0

<!-- zdroj: research:src/core/config.ts:301 hypotheses.decide (choices person|agent, tree: true), hypothesesDecide · src/commands/setup.ts:1203 requireHuman (ui.consent.hypotheses.agent), :1686 help config set · src/cli/wizard.ts 5c (ctx.interactive && !isAgent) · src/cli/menu-settings.ts:87 hypothesesStep · src/commands/analysis.ts agentMayDecide (hypothesis.user, hypothesis.evidence, hypothesis.branch), citedInSupport · src/core/kin.ts BIG_BRANCH=10, branchJoined · src/core/model.ts:730 decidedByAgent, decidedAt · src/core/changelog.ts:360 · src/core/live.ts:2039 /status.hypotheses, :4647 POST /hypotheses (person hned, agent 403 hypotheses.link) · src/core/links.ts:112 · assets/lang/cs.json ui.setup.hypotheses, ui.hypotheses.decide.*, ui.settings.hypotheses, ui.consent.hypotheses.agent, ui.wait.hypothesis.byAgent, log.hypothesis.decide.agent, log.hypothesis.abandon.agent · CHANGELOG.cs.md 1.29.0 · app:src/strings.ts research.hypoDecideTitle/Person/Agent, hypoDecideConfirm(Link), hypoByAgent, hypoReason, research.treeSettings · src/ui/research-tree-settings-ui.ts · CHANGELOG.cs.md 3.25.0 · spec 060 K1.1–K1.5, K2.1 · výchozí AI (výzkum 1.29.0): research:src/core/config.ts hypothesesDecide (=== person ? person : agent), getDefault hypotheses.decide agent · src/commands/setup.ts syncDecisions/layerChange (agent nebo unset tam, kde je person → requireHuman) · src/cli/wizard.ts 5c (was = stored === person ? 0 : 1; druhé ano jen při uloženém person; person uloženo; ui.setup.model.recommended, ui.setup.hypotheses.recommended) · src/cli/menu-settings.ts hypothesesStep (bez doporučení) · CHANGELOG.cs.md 1.29.0 „Kde nic zvoleno není, rozhoduje AI“ · spec 060 K1.9 · nabídka: app:src/ui/person-research-ui.ts HYPOTHESES_OFFER_MIN = 10, researchHypothesesOffer (HYPOTHESES_DECIDE_FEATURE, hypothesesDecide === person, isOpenHypothesis celého stromu, activeResearchLink hypotheses decide=agent), hideHypothesesOffer (localStorage na výzkum) · strings.ts research.hypoOfferAgent, hypoOfferSwitch, hypoOfferHide · spec 060 K1.6–K1.8 -->

<a id="R10.3.3"></a>
### R10.3.3 Hypotéza rozhodnutá v aplikaci Strom

Hypotézu, jejíž verze spojují jen dítě s rodinou nebo dva lidi jako pár, nebo nikoho ke stromu nepřipojují (třeba
odkud osoba přišla), jde rozhodnout i v aplikaci Strom ([S3.5.2](S3-what-the-research-knows.md#S3.5.2)). Aplikace
sama nic nezapisuje: volba otevře terminál výzkumu, ten se jednou větou zeptá a rozhodnutí zapíše jako rozhodnutí
člověka. Vazby zvolené verze jsou ve stromu hned.

- **Hlídá kód:**
  - odkaz z aplikace nese jen číslo hypotézy, co se má stát (rozhodnout pro verzi, žádná verze neplatí, nechat
    otevřenou, vrátit na otevřenou, přijmout návrhy) a písmeno verze, žádný text. Terminál se zeptá „Aplikace Strom
    žádá: rozhodnout hypotézu H0001: platí varianta B – …“ a „Pokračovat?“ (Enter = ano), pak na důvod: „Proč?
    (Enter = „rozhodnuto v aplikaci Strom: varianta B“, 0 = nic neměnit)“;
  - rozhodnutí je rozhodnutí člověka s poznámkou „rozhodnuto v aplikaci Strom“ a dnem; agent ho z aplikace udělat
    nemůže. Už rozhodnutou hypotézu terminál pojmenuje („H0001 je rozhodnutá: platí varianta A …“) a zeptá se na
    změnu;
  - vazby zvolené verze zapíše strom ve stejném kroku, s citací prvního pramene, který verzi podporuje: „Ve stromu
    hned: …“. Co strom nepřijme, řekne „Do stromu nezapsáno: …“ s důvodem (už má rodiče narozením v rodině …; stará
    vazba zůstává, stojí na ní další práce; vznikl by kruh v předcích) a „Co se do stromu nezapsalo, zapíše agent při
    své příští práci.“ Totéž platí pro rozhodnutí v terminálu a v Co čeká;
  - verze, která nikoho nepřipojí, zapíše jen rozhodnutí; potvrzení to řekne předem („Strom se nezmění.“). Větu
    terminál vynechá, když by volba ze stromu odebrala vazbu dřívějšího rozhodnutí;
  - **změna** na jinou verzi a **žádná verze neplatí** u rozhodnuté hypotézy odeberou, co zapsalo předchozí
    rozhodnutí; **vrátit na otevřenou** (`--reopen`) zápis odebere a hypotézu otevře („Ze stromu odebráno: …“);
  - **další práce** na vazbě je změna rodiny vazby po zápisu (dítě, údaj, citace, partneři), sloučení rodiny nebo
    osob vazby a nová rodina s osobami vazby; vlastní údaje, jména a citace osob prací nejsou. Rozhodnutí, na jehož
    zápisu stojí další práce, vrátit nejde: „Na tom, co rozhodnutí hypotézy H0001 zapsalo do stromu, už stojí další
    práce (vazby: 2); odkazem ho vrátit nejde. Změní ho volba jiné varianty.“ Při změně taková vazba zůstane a nová
    se nezapíše; terminál to řekne předem („Stará vazba zůstane ve stromu, stojí na ní další práce: …; nová se
    nezapíše: …“) a výchozí odpověď je ne;
  - vrátit nejde ani rozhodnutí, jehož vazby strom vede, ale nezapsalo je toto rozhodnutí (třeba je zapsal agent):
    „Rozhodnutí hypotézy H0001 už je zapsané ve stromu (vazby: 2); odkazem ho vrátit nejde. Změní ho volba jiné
    varianty.“ Aplikace místo **Vrátit na otevřenou** řekne „Vrátit nejde: spojení už je zapsané ve stromu výzkumu
    (2 vazby). Jde Změnit.“;
  - dva záznamy jedné osoby (`same`) a sourozenci bez rodičů (`siblings`) se z aplikace nerozhodují, ani když je
    taková jen jedna verze hypotézy: „H0001 nejde rozhodnout volbou v aplikaci; rozhoduje se tady, na celé
    obrazovce.“;
  - verze, která ke stromu připojí 50 a více osob, řekne v potvrzení počet („Tím se ke stromu připojí 214 osob.“);
  - návrhy agenta jde přijmout najednou, nejvýš 50 hypotéz jedním potvrzením: terminál je vypíše („Návrhy agenta
    k přijetí:“), vynechané jmenuje („Vynechané:“: návrh už není, rozhoduje se tady) a řekne „✓ Rozhodnuto podle
    návrhu: n.“
- **Hranice:** aplikace volbu nabízí jen výzkumu, který ji umí (funkce `hypothesis.decide.link` a
  `hypotheses.accept.link` v `/status` mostu); jinak zůstává **Rozhodnout ve výzkumu**. Kdo hypotézy rozhoduje, určuje
  dál volba výzkumu ([R10.3.2](#R10.3.2)). Vazby rozhodnutí člověka zapíše strom hned i v Archivu Stromu.
- **Ovládání:** aplikace: **Co ví výzkum** → **Hypotézy** a **Čeká na vyřízení** → **Hypotézy k rozhodnutí**
  ([S3.5.2](S3-what-the-research-knows.md#S3.5.2)). Terminál: odkaz `strom-research://hypothesis?…` otevře výzkum
  s otázkou; `strom hypothesis decide H… --reopen --reason "…"` vrátí rozhodnutí na otevřenou.
- **Platí od:** výzkum 1.31.0 s aplikací 3.27.0

<!-- zdroj: research:src/core/links.ts (hypothesis do=decide|abandon|keep-open|reopen, variant; hypotheses do=accept, ids ≤ 50) · assets/lang/cs.json ui.link.asks, ui.link.what.hypothesis.pick/repick, ui.link.hypothesis.why, pick.default, repick.default, isDecided, notInApp, joins, recorded, work, treeSame, ui.hypothesis.tree.now/off/notNow/stays, ui.hypothesis.why.parents/kept/ancestor/merge/siblings, ui.hypothesis.decided.links, ui.link.accept.list/skipped/skip.*/done · src/core/hypolinks.ts writeDecision, undoDecision, workOnLink (rodina vazby po zápisu, sloučení, nová rodina; ne vlastní údaje osob), reopenBlock (tree: vazby zvolené verze ve stromu, které rozhodnutí nezapsalo; work), changeKeeps, pickableInApp (každá vazba každé verze child nebo partners, i verze bez vazby; c769f2eb, spec 074 K1.6) · src/cli/menu-links.ts (treeSame: verze bez vazby a nic z dřívějšího zápisu ve stromu; menu-links.ts:784 recorded) · src/gedcom/export.ts (rozhodnuté a zrušené pickableInApp pro aplikaci s hypothesisPick) · app:strings.ts research.hypoCannotReopenTree · src/commands/analysis.ts hypothesis decide --from-app (rozhodnutí člověka, ne agenta), --reopen, decidedIn app · ui.link.go · src/core/live.ts /status features hypothesis.decide.link, hypotheses.accept.link · src/core/stromapp.ts APP_DECIDES_HYPOTHESES · assets/method/core.md (rozhodnutí člověka je ve stromu hned) · commity 7a8f4b53, 8e27fa5c, 06cca755, d4c6da07 · CHANGELOG.cs.md 1.31.0 „Hypotéza rozhodnutá v aplikaci Strom“ · spec 074 K1.5 -->

<a id="R10.4"></a>
## R10.4 Rodina mimo strom čeká na doloženou vazbu

Rodina nalezená v záznamech, kterou se stromem nespojuje žádná doložená vazba, se dál nezkoumá: ani její rodiče, ani
děti. Nejdřív se musí doložit, že do stromu patří.

- **Jen metodika:** agent zapíše hypotézu, která by rodinu připojila k osobě stromu (`--about` osoba stromu), a úkol,
  který ji ověří a jmenuje (`--about H…`). Rodinu mimo strom zkoumá dál jen na žádost uživatele.
- **Hlídá kód:** fronta zadrží ostatní úkoly o lidech mimo strom. Vrátí se samy, až se vazba zapíše
  ([R2.2.3](R2-lines-and-queue.md#R2.2.3)).
- **Proč:** práce na rodině, která do stromu nepatří, je ztracená práce; rozhoduje vazba, ne jméno (metodika
  „The tree first, then above it“).
- **Ovládání:** terminál: `strom task list --off-tree`. Aplikace ukáže rodinu mimo strom u osoby v **Nad osobou**
  ([S3.3](S3-what-the-research-knows.md#S3.3)).
- **Platí od:** výzkum 1.9.0

<!-- zdroj: research:assets/method/core.md "The tree first, then above it" · research:src/commands/tasks.ts --off-tree (od v1.9.0) -->

<a id="R10.5"></a>
## R10.5 Jména osoby

Osoba může mít víc jmen: rodné, po sňatku, řeholní, jiné. Každé jméno má svůj záznam. Jména se zapisují tak, jak
stojí v záznamu; sjednocují se jen data.

- **Hlídá kód:**
  - druhy jména: rodné (`birth`), po sňatku (`married`), řeholní (`religious`), jiné jméno (`alias`), bez druhu;
  - jméno bez příjmení („Marie“) doplní celé jméno ze záznamu a osoba se pak ukazuje jím. Stejné jméno znovu jen
    přidá citaci;
  - žena se ukazuje rodným jménem; jméno po sňatku zůstává vedle;
  - titul psaný se jménem („Ing.“, „MUDr.“, „ml.“) jde do předpony nebo přípony jména (`--prefix`, `--suffix`),
    ne do křestního jména ani příjmení;
  - **jméno, kterým se osoba ukazuje** (rozvedená žena zpět u rodného příjmení), je volba uživatele, ne údaj ze
    záznamu: `strom name primary`. Totožnost osoby (oprava jména, párování) zůstává u rodného jména.
- **Jen metodika:**
  - hodnost nebo úřad, který zápis uvádí, je údaj (`TITL`, `OCCU`), ne část jména;
  - dítě, které zápis nejmenuje (mrtvě narozené, zemřelé nepokřtěné), nemá křestní jméno; místo jména se nepíše
    popis;
  - osoba, kterou slabší záznam jmenoval jinak, si to jméno nechá jako variantu; správné jméno se označí jako
    hlavní. Nic se nemaže;
  - jméno přečtené jen zčásti: [R8.6](R8-reading-scans.md#R8.6).
- **Proč:** popis místo jména („mrtvě narozený syn“) by aplikace i GEDCOM ukazovaly a hledaly jako křestní jméno
  a párování jmen by ho za jméno bralo. To, že dítě zemřelo bez jména, je údaj (úmrtí, poznámka).
- **Ovládání:** terminál: `strom name add P… "Marie /Vlková/" --kind birth --cite S…`, `strom name primary P…
  "…"` (`--clear` vrátí rodné jméno). Tvary příjmení v aplikaci: [A4.5](A4-surnames-and-families.md#A4.5),
  [A4.6](A4-surnames-and-families.md#A4.6).
- **Platí od:** výzkum 1.0.0; předpona a přípona 1.13.0; jméno, kterým se osoba ukazuje, 1.27.0; nepojmenované
  dítě 1.27.0

<!-- zdroj: research:src/core/model.ts NAME_KINDS · research:src/commands/people.ts name add (description), name primary (od v1.27.0), TITLE_OPTIONS (od v1.13.0) · research:assets/method/recording.md "The names a record gives", "A child the record does not name" (od v1.27.0), "People named wrongly by the weaker record" · research:assets/method/intake.md krok 4 -->

<a id="R10.5.1"></a>
### R10.5.1 Chybné jméno a poznámka se odvolají

Jméno nebo poznámka, které se ukážou jako chybné, se nemažou. Odvolají se s důvodem a zůstanou jen v historii.

- **Hlídá kód:**
  - odvolané jméno zmizí ze všeho, co jména ukazuje, čte nebo páruje: `strom person show`, podklady agenta,
    GEDCOM (aplikace ho po načtení stromu neukáže), hledání a párování;
  - jméno, kterým se osoba ukazuje, jde odvolat jen tehdy, když má osoba ještě jiné jméno. Překlep v něm se opraví
    `strom person edit --name`;
  - odvolané jméno znovu přidat nejde; vrátí se `strom name restore` s důvodem;
  - poznámka se opraví (`strom note edit`) nebo odvolá (`strom note retract`) s důvodem; vrátí se `strom note
    restore`.
- **Ovládání:** terminál: `strom name retract P… "Josef /Horák/" --reason "…"`, `strom person show P… --history`.
- **Platí od:** výzkum 1.18.0

<!-- zdroj: research:src/commands/people.ts name retract (description), name restore, name add ("name.retracted"), note edit/retract/restore (od v1.18.0) · GitHub issue strom-research #3 -->

<a id="R10.6"></a>
## R10.6 Lidé, které zápis jmenuje

Zápis jmenuje víc lidí než hlavní osobu: kmotry, svědky, porodní bábu, oddávajícího, oznamovatele, rodiče a prarodiče.
Všechno, co o nich zápis říká, se zapíše hned při prvním čtení.

- **Jen metodika:**
  - každý v roli jde k události jako role a jméno, co o něm zápis říká, v závorce: „kmotr: Jan Horák (sedlák,
    Lhota č. 12)“. Kněz je oddávající nebo křtící;
  - s osobou stromu se člověk v roli spojí jen tehdy, když to zápis řekne. Stejné jméno nestačí;
  - co zápis říká o každé jmenované osobě (povolání, bydliště, číslo domu), se stane jejím údajem s datem zápisu,
    i u prarodičů. Zápis, který jmenuje rodiče (křest vnuka), je pro ně sekundární informace
    ([R3.2.1](R3-verification-and-citation.md#R3.2.1));
  - místo je jen obec; číslo domu jde do vlastního pole.
- **Proč:** kmotři a svědci bývají příbuzní a dokládají další vazbu; podle povolání a domu se osoba hledá dál.
  Otevřít stejnou stránku znovu stojí víc než zapsat to hned (metodika).
- **Ovládání:** terminál: `strom event add … --with "godparent:…" --house 13`. Aplikace: opakující se kmotr ve
  Stopách Kontroly stromu ([A5.5](A5-tree-check.md#A5.5)).
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:assets/method/recording.md "Everyone the entry names in a role", "What the entry says about each person", "A place is the municipality only" · research:assets/method/core.md "Extract everything the first time" · research:assets/method/link.md krok 6 -->
