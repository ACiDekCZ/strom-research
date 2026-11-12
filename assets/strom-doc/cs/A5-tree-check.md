<a id="A5"></a>
# A5 Kontrola stromu

Co aplikace ve stromu hlídá, s jakými prahy a co s nálezem jde udělat: opravit, označit jako **Není chyba**, nebo
nechat posoudit výzkumem. Popisuje aplikaci Strom 3.21.2 (a výzkum 1.25.2).
Výzkum má vlastní kontrolu `strom check` ([R5](R5-conflicts.md)). Ta tu popsaná není, kromě míst, kde se obě shodují.

<a id="A5.1"></a>
## A5.1 Kontrola a její nálezy

Aplikace kontroluje celý strom pokaždé, když se kontrola otevře. Nic se neukládá a strom se nemění.
Každý nález má závažnost:

| Závažnost | Oddíl v dialogu | Význam |
|---|---|---|
| chyba | **K ověření** | data si odporují nebo jsou porušená ([A5.2](#A5.2), [A5.3](#A5.3), [A5.4](#A5.4)) |
| k ověření | **K ověření** | neobvyklá hodnota, nepravděpodobná, ale možná; stojí za ověření |
| info | **Stopy** | „Nejsou to chyby. Stopy, které mohou pomoct při pátrání.“ ([A5.5](#A5.5), [A5.6](#A5.6)) |

- **Hranice:**
  - Nálezy stejného druhu tvoří skupinu, řazenou podle závažnosti, velikosti a názvu. Otevřená je jen skupina s
    chybou.
    Nad 50 nálezů se další ukazují po 20. Na telefonu (do 640 px) jsou **Stopy** sbalené, je-li i oddíl **K ověření**.
  - Zástupné osoby se nehlásí. Nález označený **Není chyba** ([A5.7](#A5.7)) se nepočítá ani neukazuje.
  - Strom jen ke čtení nálezy jen ukazuje. U jiného než otevřeného stromu oprava nebo značka nejdřív strom otevře.
  - **Od aplikace 3.27.0:** závažnost, která se dřív jmenovala „varování“, se jmenuje **k ověření**, i v souhrnech
    a počtech („2 chyby, 1 k ověření, 3 stopy.“). Pohled Tabulka ukazuje nálezy přímo v buňkách a nález označený
    **Není chyba** jako **neobvyklé** ([A6.7.5](A6-views.md#A6.7.5)).
  - **Od aplikace 3.27.0:** oddíl chyb a nálezů k ověření se jmenuje **K ověření** (dřív **Problémy**). Strom bez
    nich má „Nic k ověření“, se stopami „Nic k ověření. 3 stopy.“
- **Ovládání:** dialog **Validace stromu**: **Přehled stromu → Kvalita dat → Rychlé akce → Detaily validace**,
  řádek „n stop ›“ v **Konzistence** (otevře rovnou **Stopy**), karta s chybami v **Na co se zaměřit**.
  Od aplikace 3.27.0 i **Kvalita dat ›** v bublině nálezu v pohledu Tabulka: otevře dialog na skupině toho nálezu
  (u nálezu označeného **Není chyba** na seznamu označených).
  Po importu GEDCOM se aplikace zeptá („Kontrola dat“), jen když najde chyby nebo nálezy k ověření
  ([A2](A2-loading-a-family-tree.md)).
  Totéž po sloučení s jiným stromem, pro nové nálezy. Vlastní položku v menu kontrola nemá.
- **Platí od:** aplikace 1.0.0; oddíly **Problémy** a **Stopy** aplikace 3.17.0; název **k ověření** a odkaz z pohledu
  Tabulka aplikace 3.27.0; oddíl **K ověření** a „Nic k ověření“ aplikace 3.27.0

<!-- zdroj: app:src/validation.ts:83 validateTreeData, :1370 groupValidationIssues · src/ui/tree-stats.ts:101 LONG_GROUP, :148 showTreeValidationDialog · src/ui/import-export.ts:1341 offerPostImportValidation · src/ui/merge/ui.ts:1515 · strings.ts treeManager.validationTitle, valProblems, valLeads, leadsIntro, valReadOnly, valShowMore, postImportCheck · 3.27.0: app:59a8eed0 strings.ts treeManager.validationWarnings „k ověření“, summaryErrors, summaryNoErrors, treeOverview.countWarnings · src/ui/table-view/table-bubble.ts (Kvalita dat ›) → src/ui/tree-stats.ts showTreeValidationDialog focus · table.sev.* · commit e530019b · „K ověření“: strings.ts treeManager.valProblems, commit 79764eba; „Nic k ověření“: validationPassed, summaryLeadsOnly, commit b1cbe546 (T54 G15) -->

<a id="A5.1.1"></a>
### A5.1.1 Oprava jedním klikem

Některé nálezy mají tlačítko **Opravit**; souhrn nad nálezy má **Opravit vše (n)** pro všechny opravitelné nálezy.
Oprava je jeden krok zpět („oprava z validace“) a zapíše se do historie změn.

- Pod **Opravit vše (n)** stojí, co se opraví, s počty, jen u druhů, které strom má: „Opraví se: poškozené vazby mezi
  osobami a svazky (2); svazek osoby se sebou samou – smaže se (1); duplicitní svazek – sloučí se s prvním, děti
  zůstanou (1); místo zapsané víckrát jinak – sjednotí se na nejčastější zápis (3). Ostatní nálezy zůstanou beze
  změny.“ Ve stromu jen ke čtení tlačítko ani řádek nejsou.

| Nález | Co oprava udělá |
|---|---|
| Odkaz na neexistující záznam, účastník bez osoby | odstraní odkaz |
| Rodič nemá odkaz na dítě, dítě na rodiče, osoba na partnerství | doplní chybějící odkaz (rodiče jen dítěti s méně než 2 rodiči) |
| Partnerství sama se sebou | odstraní ho |
| Duplicitní partnerství | ponechá první, děti převede na něj |
| Jedno místo zapsané víckrát jinak | přepíše všechny zápisy na nejčastější |

- **Platí od:** aplikace 1.1.0; oprava míst 1.10.0; řádek pod **Opravit vše (n)** aplikace 3.27.0

<!-- zdroj: app:src/data.ts:4071 FIXABLE_TYPES, :4097 repairValidationIssue · strings.ts treeManager.valFix, valFixAll · řádek: src/ui/tree-stats.ts fixAllNoteText (orphaned*/missing* → links, selfPartnership, duplicatePartnership, placeSpelling), strings.ts treeManager.valFixAllNote, jen bez ro, commit 79764eba (T54 G15) -->

<a id="A5.2"></a>
## A5.2 Vazby v rodině

Kontrola hledá vazby, které nemohou platit. Všechny jsou chyby, kromě duplicitního partnerství (k ověření).

| Nález v aplikaci | Kdy |
|---|---|
| **Zjištěn cyklus předků** | osoba je svým vlastním předkem; hlásí se jen první cyklus |
| **Partnerství sama se sebou** / **Duplicitní partnerství** | partner je táž osoba / dvě partnerství téže dvojice |
| **Rodič nemá odkaz na dítě**, **Dítě nemá odkaz na rodiče**, **Neshoda dítěte v partnerství** | vazba je zapsaná jen z jedné strany |
| **Odkaz na neexistující záznam** | rodič, dítě, partner nebo partnerství chybí |
| **Účastník události odkazuje na osobu, která už neexistuje** | kmotr nebo svědek (i svědek sňatku) je smazaná osoba |
| **Více než 2 rodiče** | |
| **Osoba ve více generacích** | počítání generací narazí na rozpor; partner je ve stejné generaci |
| **Partner je také rodič / dítě**, **Sourozenec je také rodič / dítě** | |

- **Platí od:** aplikace 1.0.0; účastník události 1.16.0

<!-- zdroj: app:src/validation.ts:142 checkCycles, :200, :223, :255, :293, :346-464 orphaned*, :471 tooManyParents, :554 generationConflict, :621 · strings.ts treeManager.val* -->

<a id="A5.3"></a>
## A5.3 Data a věk

Kontrola hlásí jen to, co jistě neplatí. Neúplné nebo přibližné datum počítá v celém možném rozsahu:
bez měsíce leden až prosinec, „asi“ ± 2 roky, „před“ až 20 let dřív, „po“ až 20 let později, rozsah do svého konce.
Teprve když porušení platí v celém rozsahu, je to nález. Výjimkou jsou mírnější meze k ověření z aplikace 3.27.0
(níže): tam stačí, když mez překročí jeden konec možného věku.

| Nález v aplikaci | Závažnost | Kdy |
|---|---|---|
| **Datum úmrtí je před narozením** | chyba | |
| **Nepravděpodobně dlouhý život** | k ověření | víc než 115 let |
| **Rodič mladší než dítě** | chyba | podle data narození |
| **Rodič velmi mladý / velmi starý při narození** | k ověření | méně než 12 / víc než 80 let; jen data narození |
| **Matka při narození dítěte mladší 16 let** / **… starší 45 let** | k ověření | od aplikace 3.27.0, viz níže |
| **Otec při narození dítěte mladší 18 let** / **… starší 60 let** | k ověření | od aplikace 3.27.0, viz níže |
| **Událost datovaná před narozením** | k ověření | |
| **Událost datovaná po úmrtí** | k ověření | kromě: Pohřeb, Kremace, Závěť, Pozůstalostní řízení |
| **Dítě narozené po smrti matky** | chyba | víc než 1 měsíc po smrti; jen vlastní rodiče |
| **Dítě narozené dlouho po smrti otce** (… **rodiče**, pohlaví neznámé) | k ověření | víc než 10 měsíců |
| **Svatba datovaná před narozením partnera** | chyba | |
| **Svatba datovaná po úmrtí partnera** | k ověření | |
| **Sňatek v dětském věku** | k ověření | méně než 14 let |
| **Sňatek ve věku pod 16 let** | k ověření | od aplikace 3.27.0, viz níže |
| **Zapsaný věk se liší o víc než 2 roky** | k ověření | od aplikace 3.27.0, viz níže |
| **Extrémní věkový rozdíl partnerů** | info (**Stopy**) | 40 let a víc |
| **Narození/úmrtí zadané jako životní událost** | chyba | narození nebo úmrtí v seznamu událostí |
| **Vlastní událost nemá název** / **Událost má neplatné datum** | k ověření | |

- **Hranice:** stejné výjimky po úmrtí má `strom check` výzkumu. Rodič bez typu vztahu se počítá jako vlastní.
- **Od aplikace 3.27.0:** mírnější meze k ověření:
  - **matka** mladší 16 nebo starší 45 let a **otec** mladší 18 nebo starší 60 let při narození dítěte. Jen
    vlastní rodič se známým pohlavím, věk z obou dat narození;
  - **sňatek** ve věku pod 16 let;
  - stačí, když mez překročí jeden konec možného věku (věk „15–16“ je pod 16). Datum s **cca** se počítá jako
    odhad věku; datum s **před** nebo **po** se neporovnává;
  - hlásí se jen přísnější nález: kde už platí **Rodič mladší než dítě**, **Rodič velmi mladý / velmi starý** nebo
    **Sňatek v dětském věku**, mírnější nález není;
  - **zapsaný věk** (u sňatku věk každého z dvojice, u úmrtí, u narození) se porovná s věkem z data narození a data
    události. Nález je, když je mimo možný rozsah o víc než 2 roky. Věk zapsaný slovem nebo s cca, před, po se
    neporovnává, ani když je některé z dat jen odhad;
  - řádek nálezu ukazuje data a věk („* 1850 → * 1866: 15–16“, „⚭ 1872: 30 ≠ 26–27“).
- **Platí od:** aplikace 1.0.0 (věk rodičů); 1.4.0 (události); 1.7.0 (data a úmrtí); dítě po smrti rodiče
  neznámého pohlaví 3.10.0; čtyři výjimky po úmrtí 3.17.0 (dřív jen pohřeb); mírnější meze věku rodičů a sňatku
  a zapsaný věk 3.27.0

<!-- zdroj: app:src/validation.ts:493 checkAgePlausibility MIN_PARENT_AGE MAX_PARENT_AGE, :863 checkDateConsistency MAX_LIFESPAN_YEARS CHILD_MARRIAGE_YEARS PARTNER_AGE_GAP_YEARS POSTHUMOUS_FATHER_MONTHS AFTER_DEATH_EVENT_TYPES, :120 checkLifeEvents · monthRange, certainlyBefore · research:src/core/afterdeath.ts AFTER_BY_NATURE · strings.ts treeManager.val* · 3.27.0: app:59a8eed0 src/validation.ts MOTHER_MIN_AGE 16, MOTHER_MAX_AGE 45, FATHER_MIN_AGE 18, FATHER_MAX_AGE 60, checkParentAgeLimits (gender female/male, parentRelTypes biological, jen když není parentYoungerThanChild/parentTooYoung/parentTooOld), ageSpan (< > → null; ~ approxAgeBetween), spanText, MARRIAGE_MIN_YEARS 16 (else za childMarriage), checkRecordedAges SLACK_YEARS 2 (Partnership.ages, deathAge, birthAge), src/dates.ts recordedAgeGap, ageRangeBetween · strings.ts treeManager.valMotherTooYoung16, valMotherTooOld45, valFatherTooYoung18, valFatherTooOld60, valMarriageUnder16, valRecordedAgeMismatch, validationWarnings, countWarnings, summaryErrors · spec 073 §7.6 · CHANGELOG.cs.md 3.27.0 -->

<a id="A5.4"></a>
## A5.4 Prameny, přílohy a sloučení při importu

| Nález v aplikaci | Závažnost | Kdy |
|---|---|---|
| **Citace odkazuje na neexistující pramen** | k ověření | citace u osoby, události, partnerství nebo přílohy |
| **Příloha nemá použitelná data** | k ověření | data nejsou obrázek ani PDF (příloha jen s originálem se nehlásí) |
| **Fotka není podporovaný obrázek** | k ověření | jiný formát než JPEG, PNG, WebP, GIF |
| Nejspíš dvě osoby sloučené do jedné při importu souboru GEDCOM (Strom 3.8.1 a starší) … | chyba | viz níže |

Starší verze mohly při importu dát dvěma osobám stejné ID. Kontrola to hlásí při jasném znaku (víc než 2 rodiče,
osoba sama svým rodičem, dítětem nebo partnerem), nebo když je dítě narozené dřív než 12 let po rodiči a k tomu
rodiče nebo partner stejného pohlaví. Rodiče stejného pohlaví sami nález nedají. Řešení je v textu nálezu:
původní soubor importovat znovu jako nový strom.

- **Platí od:** aplikace 1.7.0 (prameny a přílohy); 3.0.0 (fotky); 3.9.0 (sloučení při importu)

<!-- zdroj: app:src/validation.ts:982 checkSourceIntegrity, checkPhotoData, :1199 checkImportMerges · strings.ts treeManager.valCitationMissingSource, valAttachmentNoData, valPhotoUnsafeData, valImportMerge -->

<a id="A5.5"></a>
## A5.5 Stopy: kmotři a zápisy míst

**Stopy** nejsou chyby. Ukazují, kde může být příbuzenství nebo nejednotný zápis.

- **Kmotr, který se opakuje — bývá to příbuzný:** tentýž kmotr nebo svědek je u událostí aspoň 2 osob, které spolu
  nejsou příbuzné, a ty osoby patří aspoň do 2 sourozeneckých skupin. Řádek ukazuje, u kolika událostí a osob.
  Příklad: Marie Vlková je kmotrou dětí Horákových i dětí jejich sousedů.
- **Jedno místo zapsané víckrát jinak:** zápisy, které se liší jen velikostí písmen, diakritikou nebo tečkou či
  čárkou, např. „Brno“ a „brno.“. Řádek ukazuje každý zápis s počtem; oprava je v [A5.1.1](#A5.1.1).
- **Hranice:** příbuzní jsou osoby nejvýš 3 kroky přes rodiče, děti a partnery. Počítají se účastníci událostí
  osoby, svědci sňatku a účastníci společných událostí páru. Ve **Stopy** je i věkový rozdíl partnerů ([A5.3](#A5.3)).
- **Platí od:** aplikace 1.10.0 (místa); 1.16.0 (kmotři); sourozenecké skupiny a úřední osoby 3.17.0

<!-- zdroj: app:src/godparents.ts:42 RECURRING_THRESHOLD, :188 recurringParticipants, :270 siblingGroupCount, :300 godparentLeads · src/validation.ts:1034 checkPlaceSpellings, checkRecurringGodparents · strings.ts treeManager.valRecurringGodparent, valRecurringGodparentDetail, valPlaceSpelling, leadsSkipped -->

<a id="A5.5.1"></a>
### A5.5.1 Jak se pozná tentýž kmotr

- Osoba propojená se stromem se pozná podle záznamu. Jen zapsané jméno se porovnává jako text, řádek pak má „shoda
  podle jména“.
- Ze zápisu se bere jméno do první čárky, malého písmene nebo číslice. Tituly a oslovení (kmotr, pan, Mgr. …) se
  vynechají, částice (von, de …) zůstanou, text v závorce je poznámka. Porovnává se bez diakritiky a velikosti písmen.
- Jméno musí mít aspoň 2 slova. Samotné křestní jméno se nikdy neshoduje.
- Nehlásí se ten, kdo je u události z úřadu: oddávající, porodní bába a duchovní (farář, kaplan, Pfarrer, parochus …).
  Duchovní zapsaný jako kmotr se hlásí.

<!-- zdroj: app:src/godparents.ts:48 NAME_PARTICLES, :54 NAME_PREFIXES, :80 participantName, :117 CLERGY_WORDS, :121 MIDWIFE_WORDS, :134 attendsByOffice · strings.ts treeManager.valRecurringGodparentByName -->

<a id="A5.6"></a>
## A5.6 Možná duplicitní osoba

Dvě osoby jsou možná táž, když mají stejné příjmení a stejné křestní jméno a narodily se ve stejných letech.
Porovnává se bez velikosti písmen a diakritiky. Nález je ve **Stopy** ve skupině **Možná duplicitní osoba**.

- **Hranice:**
  - Rok narození: datum narození; bez něj křest (rok křtu nebo rok před ním); bez něj úmrtí nebo pohřeb
    s věkem při úmrtí. Jsou-li oba roky z narození, musí se překrývat. Jinak smějí být od sebe 2 roky.
  - Chybí-li křestní jméno u jedné osoby, stačí příjmení a roky.
  - Osoby bez data se párují jen při úplně stejném jménu. Osoba s datem se s osobou bez data nepáruje.
  - Nehlásí se: zástupné a nepojmenované osoby, neslučitelné pohlaví, rodič a dítě, a dvojice, kde jedna osoba
    jistě zemřela před narozením (nebo křtem) druhé.
- **Ovládání:** **Jsou to dvě osoby** ([A5.7](#A5.7)); u verdiktu výzkumu **Sloučit…** ([A5.6.1](#A5.6.1)).
- **Platí od:** aplikace 1.9.9; roky z křtu a úmrtí 3.17.0

<!-- zdroj: app:src/validation.ts:1084 birthYears, :1127 checkPossibleDuplicates STAND_IN_YEARS_SLACK · strings.ts treeManager.valGroupPossibleDuplicate, twoPeople -->

<a id="A5.6.1"></a>
### A5.6.1 Verdikt výzkumu

U stromu z výzkumu se aplikace při otevření dialogu zeptá výzkumu na všechny dvojice. Dialog na odpověď nečeká.
Výzkum posoudí jen osoby, které mají jeho číslo (P…). Rozhoduje první pravidlo, které platí:

| Pořadí | Výzkum zjistil | Verdikt v aplikaci |
|---|---|---|
| 1 | osobu nezná | žádný |
| 2 | osoby už sloučil | **Ve výzkumu sloučeno** |
| 3–9 | dvě osoby označené člověkem; jiné pohlaví; rodič a dítě; narození nebo křest víc než 3 roky od sebe; jeden zemřel dřív, než se druhý narodil; sourozenci (druhé dítě dostalo jméno zemřelého); jiní rodiče | **Dvě osoby** |
| 10 | jména se ve výzkumu liší | **Nejisté** |
| 11–12 | stejní rodiče a známé roky; tentýž zápis v prameni u obou | **Pravděpodobně táž osoba** |
| 13–14 | blízké roky a nic dalšího; u jedné osoby žádné datum | **Nejisté** |

- **Hranice:**
  - Dvojice s verdiktem **Pravděpodobně táž osoba** a **Ve výzkumu sloučeno** jdou nahoru, pak **Nejisté**, pak bez
    verdiktu.
  - Dvojice **Dvě osoby** jdou stranou do řádku **Výzkum je rozlišil: n** a nepočítají se.
  - Verdikt, který přijde do otevřené skupiny, jen přidá štítek. Přeřadí se až při dalším otevření.
  - Pod skupinou je **Výzkum posuzuje…** nebo **Posouzeno výzkumem**. Neběží-li výzkum, který posuzoval při
    posledním spojení: „Bez posouzení výzkumu – výzkum neběží.“ Výzkum, který posuzovat neumí, se nezmiňuje.
- **Ovládání:** u verdiktu **Sloučit…** (sloučení osob) nebo **Načíst novou verzi** · terminál:
  `strom person compare P… P…`, pro mnoho dvojic `--pairs-from`. Spojení s výzkumem:
  [S1](S1-connecting-app-and-research.md).
- **Platí od:** aplikace 3.17.0 (výzkum 1.22.0)

<!-- zdroj: app:src/duplicate-verdicts.ts:18 MAX_JUDGE_PAIRS, :54 issueResearchPair, :142 verdictRank, :154 verdictsMode, :192 verdictReasonText · src/quality-bridge.ts:172 postDuplicates · strings.ts treeManager.verdict*, reason* · research:src/core/duplicates.ts judge YEARS_CLOSE · src/core/live.ts:168-192 · src/commands/quality.ts person compare -->

<a id="A5.6.2"></a>
### A5.6.2 Upozornění při zadávání osoby

Při zadávání nové osoby ukáže aplikace nejvýš 3 podobné osoby („Podobné osoby už existují:“). Porovnává jinak než
[A5.6](#A5.6): skórem podobnosti jako při slučování, nikdy s neslučitelným pohlavím.
- **Ovládání:** **Přejít na osobu**, **Použít existující** · vypnutí **Nastavení → Upozornění → Našeptávání
  duplicit**.
- **Platí od:** aplikace 1.4.0

<!-- zdroj: app:src/ui/duplicate-suggest.ts:22 MAX_SUGGESTIONS, :75 runDuplicateCheck · findSimilarPersons SIMILAR_PERSON_THRESHOLD · strings.ts duplicateSuggest.settingLabel, useExisting -->

<a id="A5.7"></a>
## A5.7 Není chyba

Nález, který chybou není, se označí. Pak se už nehlásí, ani když se strom zkontroluje znovu.
Značka je změna stromu: má krok zpět a zápis v historii změn. U možné duplicity se tlačítko jmenuje **Jsou to dvě
osoby**.

- **Hranice:**
  - Tentýž nález pozná aplikace podle druhu, osob a předmětu. Předmět je rok u události či svatby po úmrtí,
    jméno u kmotra a nejčastější zápis u místa. Změní-li se něco z toho, nález se ukáže znovu.
  - U stromu z výzkumu se značka pošle výzkumu, když mají všechny osoby nálezu číslo výzkumu (nejvýš 20 osob).
    Soubor GEDCOM z výzkumu značky nenese; při načtení nové verze se převezmou ze staré verze stromu.
  - Výzkum značky u události a svatby po úmrtí respektuje: `strom check` je nehlásí a agent je nevyšetřuje.
  - Stav značky: **Odesláno výzkumu**, **Čeká na výzkum** (výzkum neběží, pošle se při dalším spojení),
    **Jen v aplikaci** (výzkum ji nevzal nebo osoby nemají číslo; znovu se neposílá), **Označeno ve výzkumu**.
  - Značka u místa nemá osoby, proto se výzkumu neposílá. Při oddělení části stromu zůstanou jen značky,
    jejichž osoby všechny zůstanou.
  - Značku zapsanou ve výzkumu zná aplikace jen u otevřeného stromu z výzkumu, když výzkum běží.
  - **Od aplikace 3.27.0:** předmět u **Sňatek ve věku pod 16 let** je rok sňatku, u **Zapsaný věk se liší o víc
    než 2 roky** údaj (narození, sňatek, úmrtí) a u sňatku jeho rok. Označený nález ukazuje pohled Tabulka jako
    **neobvyklé** a odtud jde označit i vrátit ([A6.7.5](A6-views.md#A6.7.5)).
- **Ovládání:** v řádku nálezu **Není chyba** / **Jsou to dvě osoby**, 6 s nabídka **Vrátit**. Seznam
  **Označeno jako není chyba: n** pod nálezy, u každé značky datum nebo **Označeno ve výzkumu**, tlačítko **Vrátit**
  · terminál: `strom quality list`, `strom quality dismiss possibleDuplicate P… P…`,
  `strom quality dismiss eventAfterDeath P… --subject 1861`, `strom quality undo …`. Značku zapisuje jen člověk, nikdy
  agent.
- **Platí od:** aplikace 3.17.0 (výzkum 1.22.0)

<!-- zdroj: app:src/validation.ts:1415 qualityFinding (3.27.0: marriageUnder16 rok, recordedAgeMismatch field + rok) · src/ui/table-view/table-bubble.ts · src/quality-dismiss.ts:47 sanitizeQualityDismissed, :152 dismissalFor, :186 dismissBody, mergeResearchMarks, carryOverTreeDecisions, dismissalsWithin · src/quality-bridge.ts:74 dismissReply · src/ui/quality-ui.ts:155 flushQuality, :257 readQualityMarks · src/data.ts:1674 dismissQualityFinding · src/ui/tree-stats.ts:104 DISMISS_TOAST_MS · strings.ts treeManager.notAnError, twoPeople, dismissedRow, sentToResearch, waitingForResearch, appOnly, markedInResearch · research:src/commands/quality.ts PERSON · src/core/afterdeath.ts -->

<a id="A5.8"></a>
## A5.8 Přehled stromu → Kvalita dat

Oddíl shrnuje kontrolu a úplnost stromu. Počítá stejně jako dialog, bez označených nálezů a bez dvojic, které výzkum
rozlišil.

| Blok | Co ukazuje |
|---|---|
| **Konzistence** | souhrn („2 chyby, 1 k ověření, 3 stopy.“), 5 nejzávažnějších chyb a nálezů k ověření, „a dalších n…“, řádek „n stop ›“ |
| **Úplnost dat** | podíl osob s **Datum narození**, **Datum úmrtí (u zemřelých)**, **Místo narození**, **Fotografie**; pod 50 % zvýrazněno; „Obsah stromu:“ (fotky, události, prameny, přílohy) |
| **Jistota údajů z výzkumu**, **Kde chybí doklady** | doložení, viz [R3.8](R3-verification-and-citation.md#R3.8) a [A3](A3-evidence-in-the-app.md) |
| **Struktura** | počet svazků; nespojené části, nebo „Všechny osoby jsou propojeny do jedné rodiny.“ |
| **Rychlé akce** | **Detaily validace**, **Vyčistit osiřelá místa (n)**, **Rozdělit na rodiny** |

- **Hranice:**
  - Nad 10 MB fotek a příloh přibude upozornění („Média mají přes 10 MB. Soubor stromu se pomaleji ukládá a sdílí.“). Osiřelé místo je místo, na které nic neodkazuje.
  - Nespojená část nemá cestu k hlavní rodině; jde ji oddělit (**Oddělit nespojené části**).
  - Karta v **Na co se zaměřit** ukazuje počet chyb a nejčastější druh. Má tlačítko **Opravit** (otevřený strom)
    nebo **Detaily validace**; obě otevřou dialog.
- **Ovládání:** **Přehled stromu → Kvalita dat**; v nabídce stromu i přímo **Kvalita dat**.
  Akce, které mění data, jdou jen v otevřeném stromu.
- **Platí od:** aplikace 3.13.0; stopy a značky 3.17.0; „k ověření“ místo „varování“ 3.27.0

<!-- zdroj: app:src/ui/tree-overview.ts:101 TOP_ISSUES, :108 LOW_SHARE, :1882 treeOverviewQualityHtml, :925 selectFocusCards · src/ui/tree-actions.ts:191 overview-quality · strings.ts treeOverview.consistencyTitle, completenessTitle, field*, contentLabel, mediaWarning, structureTitle, allConnected, quickActions, actValidation, actCleanPlaces, actSplitFamilies, cardValidation -->
