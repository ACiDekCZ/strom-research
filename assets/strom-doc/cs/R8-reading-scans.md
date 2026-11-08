<a id="R8"></a>
# R8 Hledání a čtení záznamů ve skenech

Jak výzkum najde knihu, získá její snímky, kdo snímky čte a jak se přečtené zapíše. Popisuje výzkum 1.25.2 a 1.26.0
(čtení skenů se mezi nimi nemění). U pravidel je rozlišeno, co **hlídá kód** (příkaz `strom` to dělá nebo zápis
odmítne) a co je jen **pravidlo metodiky** (pokyn agentovi, který kód nekontroluje). **Proč** uvádí důvod tak, jak ho
říká metodika nebo kód výzkumu.

Postup v kostce:

1. **Kniha:** podle místa a doby agent určí příslušnost (farnost, matriční úřad), archiv a konkrétní knihu
   ([R8.1](#R8.1)).
2. **Snímky:** stahují se jen přes stahovač archivu, v tempu a za podmínek archivu, a jen ty potřebné. Kde archiv
   automatické stahování nedovolí, uloží je člověk ([R8.2](#R8.2)).
3. **Listování:** knihu nebo rozsah snímků čtou **čtenáři** (`strom read`): samostatní agenti s čistým kontextem,
   každý s dávkou snímků a celou otázkou ([R8.3](#R8.3)). Jak čtení běží, strom ladí sám ([R8.4](#R8.4)).
4. **Vlastní pohled:** každý zápis, který se bude citovat, si hlavní agent přečte sám, z výřezu v plném rozlišení
   ([R8.5](#R8.5)).
5. **Zápis:** pramen s výřezem a přepisem, údaje jen z jistě přečteného a hledání i bez nálezu ([R8.6](#R8.6)).
6. **Jistota:** stupeň jistoty podle toho, kdo a jak zápis četl; těžké místo potřebuje druhé, slepé čtení
   ([R8.7](#R8.7)).

> **Poznámka: čtení modelem není stoprocentní.** Staré písmo čte model AI a přesnost čtení závisí na modelu.
> Metodika chce na staré písmo nejsilnější model, nikdy rychlé nebo levné čtení. Čtenáři čtou modelem pro písmo
> (`model.vision`, jinak `strom read --model`) a velikost pohledů se řídí modelem ([R8.3.2](#R8.3.2)).
> Velikost pohledů jde zkalibrovat (`strom media calibrate`, potvrzuje člověk) a strom ladí čtení zvlášť pro každého
> agenta a model ([R8.4](#R8.4)).
> I tak se model plete: ve jménech, číslech domů, datech a místech. Proto čtenář u každého jména píše jistotu
> v procentech, „nečitelné“ má přednost před odhadem, těžké místo dostane slepé druhé čtení, rozdílná čtení jsou
> rozpor a Doložené chce metodika jen po vlastním čtení zápisu hlavním agentem ([R8.7](#R8.7)).
> **Zásada projektu:** důležité údaje má ideálně ještě ověřit člověk. Aplikace Strom ukazuje u pramene výřez zápisu
> vedle přepisu ([A3.3](A3-evidence-in-the-app.md#A3.3)). Přepis zkontrolovaný člověkem jde označit **Přepis ověřen**
> ([A3.1.1](A3-evidence-in-the-app.md#A3.1.1), jak s ním výzkum počítá: [R3.5.1](R3-verification-and-citation.md#R3.5.1)).
> Chybný údaj jde opravit v aplikaci; úprava údaje doloženého záznamem se stane rozporem ([S2](S2-edits-from-the-app.md)).
> Čtení modelem je jen návrh: přepis, který člověk napsal nebo potvrdil, nezmění nikdo jiný než člověk, ani nové čtení
> ([R3.4.1](R3-verification-and-citation.md#R3.4.1)).

<!-- zdroj: research:assets/method/reading.md:3-8 · src/agents/profiles.ts:5 vision, :147 · src/commands/read.ts:214 --model · src/core/reader.ts:226 certainty · assets/method/verify.md · Milan 4. 11. 2026 (zásada ověření člověkem) -->

<a id="R8.1"></a>
## R8.1 Nejdřív kniha

Než jde cokoli doložit, musí být jasné, kde záznamy jsou. Agent určí příslušnost místa v dané době, archiv a konkrétní
knihu (soubor záznamů) s přístupem: adresou nebo signaturou.

- **Jen metodika,** v tomto pořadí:
  1. místo a doba určují příslušnost (`strom place jurisdiction L… --kind parish|civil|manor|district --from --to`).
     Místo přečtené jen nejistě nedává farnost ani knihu, dokud není jisté ([R8.5.2](#R8.5.2));
  2. archiv (`strom repo add`, s podmínkami použití) a kniha (`strom recordset add … --places --years --kinds
     --access --url`). Stahovač archivu najde knihy sám: `strom fetch <stahovač> --find "<místo>" --years 1780-1850`;
  3. katalog se používá jako člověk: hledání nebo stránka jedné knihy, nikdy procházení čísel záznamů za sebou;
  4. kde se hledalo, i bez výsledku, se zapíše (`strom search add … --method web|catalog`).
- Rejstříky, katalogy a online stromy jsou jen vodítko, kde hledat ([R3.3](R3-verification-and-citation.md#R3.3)).
- Hotovo, když kniha s přístupem existuje a úkol doložení na ni ukazuje (`--where B…`).
- **Proč:** hranice, farnosti a názvy se měnily; vesnice mohla v různých stoletích patřit k různým farnostem.
  Procházení čísel záznamů archivy blokují. Zapsané marné hledání brání tomu, aby další sezení prohledávalo stejné
  katalogy znovu.
- **Ovládání:** terminál (agent).
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:assets/method/locate.md:1-34 -->

<a id="R8.1.1"></a>
### R8.1.1 Rejstřík před listováním

- **Hlídá kód:** když se má listovat knihou po snímcích (`strom read`, `strom fetch`) a pro farnost, roky a druh
  záznamu knihy je známý rejstřík, který k tomu zatím nikdo neprohledal, strom ho jmenuje dřív, než cokoli spustí,
  i s příkazem, který ho přečte.
- **Hranice:** od 30 snímků; jinou hranici (nebo nikdy) určí odpověď člověka na otázku `index.first`
  (`strom media calibrate --questions`). V rozhovoru jen řekne, v sezení `strom run` čtení odmítne, dokud agent
  nedá `--no-index`.
- **Proč:** podle komentáře v kódu se od zhruba 20–40 snímků vyplatí rejstřík víc než listování. Případ ze skutečného
  výzkumu: čtenáři přečetli 61 snímků knihy oddaných, zatímco rejstřík farnosti ležel stažený.
- **Platí od:** výzkum 1.14.0

<!-- zdroj: research:src/core/indexfirst.ts:1-28 INDEX_FIRST_DEFAULT · src/commands/read.ts:217 --no-index, :265 guardIndexFirst -->

<a id="R8.1.2"></a>
### R8.1.2 Poučení ke knize

Zvláštnost knihy, archivu nebo místa se zapíše k němu jako poučení. Kdo s knihou pracuje příště, ho uvidí.

- **Hlídá kód:**
  - poučení je jedna věta, nejvýš 200 znaků; delší text začátkem tvoří poučení a zbytek jde do podrobností (nejvýš
    2000 znaků);
  - poučení patří ke knize, archivu nebo místu, které ve výzkumu existují (`--on B…|R…|L…`);
  - úkol ukáže poučení knih, ve kterých hledá (`strom task show`).
- **Jen metodika:** sem patří kalibrace knihy, dva roky na stranu, ruka, která píše 7 jako 1. Poznámka v úkolu
  nebo deníku to není: tu u knihy nikdo neuvidí.
- **Proč:** zvláštnost knihy má vidět každý, kdo ji otevře příště (metodika „Lessons belong where they apply“).
- **Ovládání:** terminál: `strom lesson add "<poučení>" --on B…`, `strom lesson list`, `strom lesson edit`.
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:src/commands/analysis.ts lesson add (LESSON_MAX, --on repository|recordset|place) · research:src/core/model.ts:732 LESSON_MAX=200, LESSON_DETAIL_MAX=2000 · research:src/commands/tasks.ts:354 taskDetail lessons · research:assets/method/core.md "Lessons belong where they apply" -->

<a id="R8.2"></a>
## R8.2 Snímky jen přes stahovač

Snímky z archivu stahuje jen strom, přes stahovač (konektor) daného archivu a v jeho tempu. Agent sám nikdy
nestahuje: ani příkazem, skriptem, ani svým prohlížečem.

- **Hlídá kód:** každá cesta k archivu se řídí nejpřísnější známou úrovní jeho podmínek:

| Úroveň | Co strom dělá sám |
|---|---|
| dovoleno | katalog i snímky, v tempu služby |
| omezeno | katalog; snímky jen se svolením člověka pro archiv: pomalu, nebo přes jeho prohlížeč, jinak ručně |
| jen ručně | katalog; snímky jen ručně |
| zakázáno | žádný automatický přístup |
| neznámé | jako omezeno |

- **Hranice (hlídá kód):**
  - úroveň je nejpřísnější z: čtení podmínek stahovačem, záznamu archivu ve výzkumu, podmínek dodaných se stromem,
    nejpřísnější úrovně, jakou strom u serveru kdy viděl, souboru robots.txt a odmítnutí serverem;
  - zmírnit archiv, dát svolení a přijmout mírnější čtení stahovače smí jen člověk; agent smí archiv jen zpřísnit;
  - tempo: bez údaje služby nejméně 2 s mezi dvěma žádostmi na server. Se svolením „pomalu“ nejvýš jeden snímek za
    10 s a nejvýš 120 za hodinu (tempo člověka), pokud člověk pro server nenastavil vlastní; strom ho nikdy nezrychlí.
- **Jen metodika:** stáhnout jen snímky, které úkol čte, nikdy celou knihu „pro jistotu“. Knihu stahuje sezení, které
  ji čte. Archiv bez stahovače: agent stahovač postaví (`strom connector new`) podle podmínek portálu a robots.txt.
- Snímky, které archiv nedovolí stáhnout automaticky, uloží člověk do připravené složky
  ([R6.2.1](R6-awaiting-action.md#R6.2.1)); svolení archivu: [R6.3.1](R6-awaiting-action.md#R6.3.1).
  Archivy jen přes prohlížeč, prohlížeč agenta a celý průběh: [R9](R9-archives.md).
- **Proč:** metodika chce dodržet podmínky každého archivu; portál, jehož podmínky to zakazují, se automaticky
  neprochází. Hodinový limit archivu zastaví zbytek práce, proto nejdřív celé snímky a části jen tam, kde je zápis
  potřebuje.
- **Ovládání:** terminál: `strom fetch <stahovač> … --images 40-69 --recordset B…`, `strom allow archive` (jen
  člověk). Aplikace: Čeká na vyřízení.
- **Platí od:** výzkum 1.0.0 (stahování jen přes strom); úrovně podmínek a tempo člověka 1.14.0

<!-- zdroj: research:src/core/terms.ts:1-30 (úrovně), :52-59 LEVELS, WAYS · src/core/net.ts:39 DEFAULT_PACE, :45 HUMAN_PACE · assets/method/reading.md:44-49, :89-104 · assets/method/locate.md:15-21 · cs.json ui.archive.level.* · CHANGELOG.cs.md 1.14.0, 1.15.0 -->

<a id="R8.3"></a>
## R8.3 Čtenáři: kdo snímky čte

Knihu nebo rozsah snímků procházejí **čtenáři**, ne hlavní agent. Čtenář je samostatný běh agenta (stejného programu,
se kterým pracuje výzkum) s čistým kontextem. Dostane dávku pohledů a celou otázku a píše jen svou zprávu.

- **Hlídá kód:**
  - čtenář pracuje v jedné prázdné složce mimo výzkum, ne ve složce výzkumu;
  - vidí jen své pohledy a píše jen svou zprávu do `notes/readings/`; do výzkumu nikdy nezapisuje a nespouští příkazy;
  - čte modelem pro písmo: `--model`, jinak nastavení `model.vision` (u Claude Code výchozí `opus`);
  - bez osobních doplňků agenta (skilly, pluginy, servery MCP), dokud člověk nezapne `agent.addons`;
  - v archivu Stromu (bez AI) se čtenáři nespustí.
- **Jen metodika:** listování knihou je práce čtenářů, ne vlastních subagentů agenta. Subagent (`strom-scan-reader`)
  čte jen výřezy nalezených zápisů. Nález i hledání zapisuje hlavní agent sám, hledání s `--by reader`.
- **Proč:** obrázek zůstane v kontextu toho, kdo ho otevřel; hlavní agent tak dostane krátkou zprávu místo kontextu
  plného obrázků. Složka mimo výzkum: čtenář nesmí převzít pokyny výzkumu (soubory CLAUDE.md, AGENTS.md). Model pro
  písmo nikdy slabší než hlavní: špatně přečtené jméno pošle výzkum do špatné vesnice.
- **Ovládání:** terminál: `strom read B… --images 40-69 --question "…"`. Pustit v popředí a nechat doběhnout (často
  deset minut i víc).
- **Platí od:** výzkum 1.0.0; prázdná složka mimo výzkum a `agent.addons` 1.14.0

<!-- zdroj: research:src/core/reader.ts:1-9 · src/commands/read.ts:1-4, :183-200, :226, :304-309, :514-523 · src/commands/readers.ts:73-81 readerDesk, :128 refuseReadersInArchive · src/core/reader.ts:307-313 readerSettings · src/agents/profiles.ts:5, :147 · src/core/config.ts:314 agent.addons · assets/method/reading.md:51-68 -->

<a id="R8.3.1"></a>
### R8.3.1 Dávky, souběh a rozsah

- **Dávka:** 10 pohledů na čtenáře (`--batch`, nejvýš 12). Dvoustrana čtená v půlkách jsou dva pohledy. Dávky jsou co
  nejrovnoměrnější (11 snímků: 6 a 5, nikdy 10 a 1).
- **Souběh:** 5 čtenářů najednou (`--parallel`, 1 až 10; trvale `strom config set read.parallel <n>`).
- **Rozsah:** nejvýš 200 snímků v jednom čtení; seznam (`--images 5-19,21-39`) se čte přesně, jak je zadaný.
- Snímky přečtené už dřív strom řekne na začátku; čtení neodmítne.
- **Proč:** cena čtenáře roste s druhou mocninou jeho dávky (obrázek se platí v každém dalším kroku); deset snímků na
  čtenáře stojí na snímek třetinu proti padesáti. Souběh dává stejné čtenáře a žádosti, jen dřív; menší, když se
  předplatné agenta vyčerpává příliš rychle. Stovky snímků v jednom čtení jsou podle kódu chyba, ne záměr.
- **Platí od:** výzkum 1.0.0 (dávka 10, nejvýš 12); souběh 1.15.0; rozsah 200 snímků 1.14.0; seznam s mezerami 1.15.0

<!-- zdroj: research:src/core/reader.ts:5-15 BATCH, BATCH_MAX, :137-171 batches · src/core/config.ts:229-230, :277 read.parallel · src/core/media.ts:126 IMAGE_RANGE_MAX · src/commands/read.ts:113-120, :407-409 · CHANGELOG.cs.md 1.15.0 -->

<a id="R8.3.2"></a>
### R8.3.2 Velikost pohledů a dvoustrana v půlkách

- **Velikost (hlídá kód):** pohled je velký, jak ho model čtenářů vezme celý: 2000 px po delší straně u novějších
  modelů (Claude Opus 4.7 a novější, Sonnet 5 a novější, Fable; Codex a OpenCode), jinak 1568 px. Jinak jen tehdy,
  když člověk velikost zkalibroval (`strom media calibrate`) nebo ji strom zvětšil u knihy ([R8.4](#R8.4)).
- **Dvoustrana v půlkách:** při slepém čtení, v úkolu ověření a u snímku, který čtenář dřív nahlásil jako nejasný,
  dostane čtenář dvoustranu jako dvě půlky, které se u hřbetu překrývají (4 % šířky na každou stranu). Jen když je
  půlka aspoň 1,25× ostřejší než celý snímek v jednom pohledu. Jinak se dvoustrana čte celá; `--half both` půlky
  vynutí, `--whole` je zakáže, `--half left|right` vezme jen jednu stranu.
- **Výřez (`--crop`):** jen ta část každého snímku, v plném rozlišení. Výřez větší než jeden pohled dostane čtenář
  v překrývajících se dílech. Když z archivu přišla ostřejší část snímku, čte se z ní.
- **Proč:** větší obrázek agent sám zmenší, než ho model uvidí, a za zahozené pixely zaplatí pomalejším čtením. Půlka
  ukazuje každou stranu ostřeji; u téměř čtvercové dvoustrany by druhý pohled stál víc, než přinese.
- **Platí od:** výzkum 1.14.0; čtení z ostřejší části snímku 1.19.0

<!-- zdroj: research:src/agents/images.ts:1-54 IMAGE_MAX, IMAGE_MAX_LARGE, imageMax · src/core/views.ts:113-140 SPREAD_OVERLAP, SPREAD_GAIN, halves, readInHalves, :97 tiles · src/commands/read.ts:192-194, :332-339, :356-390, :59-85 sharperForReader · CHANGELOG.cs.md 1.19.0 „Ostřejší část snímku se opravdu čte“ -->

<a id="R8.3.3"></a>
### R8.3.3 Co čtenář píše

Čtenář píše zprávu průběžně, po každém snímku, ne na konci. Za každý snímek jeden blok s poli:

| Pole | Co v něm je |
|---|---|
| `result` | `found` (nález), `nothing` (nic), `unclear` (možná shoda, kterou nejde potvrdit) |
| `entries` | každý zápis, který odpovídá na otázku, slovo od slova v původním jazyce a pravopise, kde stojí a ve kterém sloupci |
| `illegible` | co nešlo přečíst a kde |
| `hand` | písmo: inkoust, typ písma, jazyk, zkratky |
| `certainty` | u každého jména v zápisu, jak si je čtenář jistý (%) |
| `pages` | čísla stran napsaná na snímku |
| `gaps` | chybějící strany před snímkem (číslování skočí) |
| `section` | na snímku začíná jiná část knihy (místo, rok, druh záznamu) |

- **Pravidla čtenáře** (strom je dává do zadání čtenáře):
  - přepsat jen to, na co se otázka ptá (jen čísla stran, jen zápisy jednoho příjmení, jeden zápis celý);
  - „nic“ je platný a cenný výsledek: čtenář řekne, co prověřil;
  - „nečitelné“ má přednost před odhadem;
  - možná shoda (nečitelné jméno, když ostatní sedí: věk, dům, datum, rodiče) je `unclear` a zápis, nikdy schovaná
    v bloku `nothing`;
  - co výzkum ví (`--context`), slouží jen k poznání rodiny, nikdy k doplnění nepřečteného;
  - při slepém čtení (`--blind`) přesný přepis bez očekávání ([R3.5](R3-verification-and-citation.md#R3.5)).
- **Hlídá kód:** nejasné místo z této zprávy brání zápisu marného hledání v rozsahu, dokud se na ně nikdo nepodívá
  zblízka ([R3.6](R3-verification-and-citation.md#R3.6)).
- **Proč:** u nejasného místa se agent musí podívat zblízka, než rozsah platí za marně prohledaný; možná shoda se často
  skrývá právě v nečitelném. Průběžná zpráva přežije výpadek: obnovený čtenář pokračuje u snímků, které ve zprávě
  ještě nejsou.
- **Platí od:** výzkum 1.0.0; pole `pages`, `gaps`, `section`, `unclear` jako zápis a „jen to, na co se otázka ptá“
  1.14.0

<!-- zdroj: research:src/core/reader.ts:188-240 readerPrompt, :266-300 parseReport · assets/method/reading.md:51-57, :76-77 · src/commands/readings.ts openUnclear, refuseNegativeOverUnclear -->

<a id="R8.3.4"></a>
### R8.3.4 Časový limit čtenáře a výpadek služby

- **Hlídá kód:** čtenář má 5 minut a 1 minutu na každý pohled, nejméně 6 a nejvýš 15 minut. Když čtenáři stejného
  agenta a modelu potřebovali víc, strom limit prodlouží: podle posledních 10 čtenářů, kteří doběhli nebo narazili na
  limit (×1,5 po doběhnutém, ×2 po zastaveném), nikdy nad 15 minut. `--minutes` nastaví limit ručně.
- **Výpadek služby:** čtenář, který po opakovaném pokusu služby modelu 150 s mlčí, se jednou obnoví tam, kde skončil,
  se zbylým časem. Když mlčí dál, hned skončí; jeho snímky se přečtou znovu později. Takový výpadek nezmenšuje dávky.
- Čtenář zastavený limitem nedal ke svým snímkům odpověď: strom řekne, ať se na ně agent podívá sám, nebo je přečte
  znovu s delším limitem.
- **Proč:** případy ze skutečných výzkumů: čtenář jednoho výřezu stál 15 minut a agent na něj čekal; čtenář jednoho
  výřezu skončil v limitu 6 minut bez výsledku, stejné čtení s limitem 12 minut bylo hotové za 4. Umlklá služba
  dřív vedla až k limitu a čtenáři bez výsledku zmenšovali dávky.
- **Platí od:** výzkum 1.14.0; obnovení po výpadku služby 1.22.0

<!-- zdroj: research:src/core/reader.ts:17-91 readerMinutes, learnedReaderMinutes, READER_STALL_MS · src/commands/read.ts:493-496, :674-680 · src/core/readstats.ts readerLimit · CHANGELOG.cs.md 1.22.0 -->

<a id="R8.3.5"></a>
### R8.3.5 Čtení do nálezu

- **Hlídá kód:** s `--until-found` už nezačne žádný další čtenář, jakmile jeden nahlásí nález; čtenáři v práci
  dočtou. strom vypíše přesně, které snímky nikdo nečetl.
- **Hranice:** prohledané jsou jen přečtené snímky; hledání se zapíše jako `--result partial`, nikdy jako marné pro
  celý rozsah.
- **Jen metodika:** jen pro **jeden** konkrétní zápis (křest, sňatek nebo pohřeb jedné osoby, o které je známo dost).
  Nikdy pro všechny zápisy místa nebo příjmení, ani kde může po nálezu přijít jmenovec. Když nález není ten pravý,
  přečte se zbytek.
- **Proč:** nepřečtený snímek není prohledaný. Jmenovec není hledaná osoba ([R1.4](R1-research-in-brief.md#R1.4)).
- **Platí od:** výzkum 1.15.0

<!-- zdroj: research:src/commands/read.ts:197-199, :216, :468-489, :596-631 · assets/method/reading.md:70-75 · CHANGELOG.cs.md 1.15.0 -->

<a id="R8.3.6"></a>
### R8.3.6 Čtení knihy, která se stahuje

- **Hlídá kód:** knihu, kterou právě stahuje `strom fetch`, jde číst hned. Čtenáři začnou na zaregistrovaných
  snímcích (dávka po 10) a na zbytek se čeká. Snímky, které stahování nepřineslo, strom vypíše přesně; nečtou se
  a nepočítají se jako marné.
- **Proč:** rychlejší čtení; archiv dostane stejné žádosti ve stejném tempu.
- **Platí od:** výzkum 1.15.0

<!-- zdroj: research:src/commands/read.ts:195-196, :238-253, :411-456, :599-633 · CHANGELOG.cs.md 1.15.0 „Rychlejší čtení“ -->

<a id="R8.3.7"></a>
### R8.3.7 Co se vrátí agentovi

- **Hlídá kód:** po čtení dostane agent stručný souhrn: na kterých snímcích je nález, na kterých nejasné místo, co
  nešlo přečíst tam, kde nic nebylo, a mezery v knize. K tomu hotový příkaz `strom search add … --by reader` s
  výsledkem `found`, `partial`, `inconclusive` nebo `negative` a s mezerami v `--note`. Zprávy se ukládají do výzkumu.
- Snímky, které nikdo nenahlásil, a čtenáři, kteří selhali, jsou vypsané zvlášť.
- **Jen metodika:** zprávy se nečtou celé, jen přes `strom readings` (`--match <příjmení>`, `--list`, jeden snímek:
  `strom readings B… --image 57`). Každá zpráva se zapíše hned, než začnou další čtenáři. Snímky čtené dřív: jiná
  otázka nebo slepá kontrola je v pořádku, stejná otázka ne.
- **Proč:** hlavní agent drží v kontextu jen to, co čtenáři našli, ne obrázky ani celé zprávy.
- **Ovládání:** terminál: `strom readings`.
- **Platí od:** výzkum 1.0.0; `strom readings` 1.14.0

<!-- zdroj: research:src/commands/read.ts:641-689 · src/commands/readings.ts:467-478 · assets/method/reading.md:57-67 · src/core/reader.ts:1-3 -->

<a id="R8.4"></a>
## R8.4 Samoladění čtení

strom měří, jak čtení skenů probíhá, a podle toho sám mění, jak se čte. Jen směrem k přesnosti nebo k menšímu počtu
žádostí do archivu.

- **Hlídá kód,** co strom smí změnit sám:
  - kniha čtená hůř než ostatní, nebo ukazovaná zvětšená: celý snímek ve velikosti pro čtení, dvoustrana v půlkách,
    ze snímků, které už jsou na počítači;
  - čtenáři, kteří ztrácejí kontext, znovu otevírají pohledy nebo nedají výsledek: menší dávky a méně pohledů na
    volání, nikdy pod polovinu výchozí hodnoty;
  - archiv, který narazil na svůj limit: nejdřív celé snímky, půlky a části jen u kandidátů;
  - kniha, ze které portál ostřejší část nedal: další části se nenabízejí;
  - snímky stažené a nikdy nepřečtené: stahuje se jen to, co úkol čte;
  - každá změna se po 60 dnech bez svého signálu a s novými čteními vrátí na výchozí hodnotu.
- **Hranice (hlídá kód):** nikdy menší pohled, levnější model, čtení, které by mohlo minout zápis, ani víc žádostí do
  archivu: to rozhoduje člověk (`strom media calibrate --questions`). Rozhoduje se po sezení, nikdy během něj: sezení
  jde podle hodnot ze svého začátku. Platí zvlášť pro každého agenta a model. Každá změna je zapsaná s důvodem.
- **Ovládání:** terminál: `strom media calibrate --report` (jak čtení probíhalo, zdarma), `--questions` (co rozhoduje
  člověk), `--reset` (zpět na výchozí); `strom config set tune.auto off` vypne samoladění. Kalibrace velikosti
  pohledů (`strom media calibrate`) je placené čtení vlastních doložených záznamů výzkumu a potvrzuje ji jen člověk.
  `strom doctor`, řádek **po samoladění**: změna, od které se čte hůř (doporučí ji vrátit), nebo změna, od které je
  čtení dražší a o nic jistější (doporučí ji ponechat).
- **Proč:** podle kódu jen tak, aby se tím nic nezhoršilo: změna smí přidat přesnost nebo ušetřit žádosti do archivu;
  co by mohlo ubrat přesnost nebo zatížit archiv, je otázka pro člověka. Dražší změnu `strom doctor` doporučí
  ponechat, protože šla k přesnosti a jistota se měří jen podle nejistých míst: bližší pohled může číst přesněji,
  i když nejistých míst neubude.
- **Platí od:** výzkum 1.14.0
- **Od výzkumu 1.29.0:** `strom doctor` u dražší změny říká, proč ji doporučí ponechat.

<!-- zdroj: research:src/core/tune.ts:1-21 (A1–A7) · src/core/readstats.ts:88-99 TUNING smallest, backAfterDays · src/core/config.ts:337 tune.auto · src/commands/calibrate.ts:394-420 · assets/lang/cs.json ui.doc.tuneworse, ui.doc.tuneworse.a, ui.doc.tuneworse.b (důvod od commitu 9bd14e84, 1.29.0) -->

<a id="R8.5"></a>
## R8.5 Vlastní čtení hlavního agenta

Zápis, který se bude citovat, si hlavní agent prohlédne sám v plném rozlišení. Starým písmem se zabývá nejsilnější
model, nikdy rychlé nebo levné čtení.

- **Hlídá kód:** snímky se otevírají jen jako pohledy `strom media view` (soubor v `.strom/views/`). Celý snímek má
  nejvýš 1400 px po delší straně: na nalezení zápisu, ne na čtení. Půlka, výřez a díly mají velikost, jakou model
  vezme celou (1568 nebo 2000 px). Nejvýš 12 snímků a 24 pohledů na jedno volání.
- **Jen metodika,** postup:
  1. najít: celý snímek s `--grid` (mřížka po desetinách), odečíst, kde zápis je;
  2. vyříznout: `--crop x,y,šířka,výška` (zlomky snímku) nebo `--half left|right`; přepisuje se jen z výřezu nebo
     půlky v plném rozlišení. Vybledlý inkoust `--contrast`, strana bokem `--rotate 90`, strana po dílech
     `--split 2x2`; celý pohled nejasný: `--half both`, než se řekne „nenalezeno“;
  3. po zhruba 30 pohledech zapsat, co se našlo, než se otevřou další; pohled, který vypadl z kontextu, se znovu
     neotevírá, platí poznámky;
  4. výřez řekne „zvětšeno“: sken víc detailu nemá. Ostřejší část jde stáhnout jen přes stahovač, který to umí.
- Strana ↔ snímek: `strom recordset calibrate B… --point 57=112` (změřené na snímku, nikdy odhadnuté); pak
  `strom media view B… --page 112`.
- **Proč:** zmenšený celý snímek stačí k nalezení zápisu za polovinu tokenů, ale ne ke čtení. Každý pohled zůstane
  v kontextu, který ho otevřel. Dívat se na tak málo pixelů, kolik otázka potřebuje.
- **Ovládání:** terminál: `strom media view B…:57 --grid`, `strom media view B…:57 --crop 0.05,0.40,0.45,0.18`.
- **Platí od:** výzkum 1.0.0 (pohledy, `--grid`, `--crop`, `--contrast`, `--rotate`); velikosti 1400/1568/2000 px,
  `--split`, limity na volání a zhruba 30 pohledů 1.14.0

<!-- zdroj: research:assets/method/reading.md:3-8, :18-50, :86-88 · src/commands/media.ts:239-241 VIEW_MAX_IMAGES, VIEW_MAX_VIEWS, :934-967 · src/agents/images.ts:14-18 OVERVIEW_MAX · src/agents/profiles.ts:43 DEFAULT_READING_NUMBERS viewsStop · src/commands/sources.ts:612-618 recordset calibrate -->

<a id="R8.5.1"></a>
### R8.5.1 Jméno a místo pro další hledání

- **Jen metodika:** jméno nebo místo, na kterém závisí další hledání (příjmení, místo narození, farnost), se před
  zápisem přečte znovu na výřezu v plném rozlišení. Co zůstane nejisté, se zapíše jako nejisté a řekne se to.
- **Proč:** špatně přečtené jméno pošle výzkum do špatné vesnice.
- **Platí od:** výzkum 1.4.1

<!-- zdroj: research:assets/method/reading.md:3-8 -->

<a id="R8.5.2"></a>
### R8.5.2 Nejistě přečtené místo je vodítko

- **Jen metodika:** místo přečtené nejistě (čtenáři se liší, `[?]`, nic jiného ho nepotvrzuje) je vodítko, ne místo.
  Nevede z něj žádná farnost, kniha ani úkol, dokud není jisté: vlastní pohled na výřez, rejstřík knihy, místopis
  nebo katastr (farnost vesnice z nich, nikdy z dnešní obce). Když zůstane nejisté: hypotéza se čteními jako
  variantami (`strom hypothesis add`) a úkol, který ji prověří (`--about H…`).
- **Proč:** úkol, který by nejisté místo bral jako jisté, by hledal v knize jiné farnosti.
- **Platí od:** výzkum 1.14.0

<!-- zdroj: research:assets/method/reading.md:10-15 · assets/method/locate.md:8-9 -->

<a id="R8.6"></a>
## R8.6 Zápis nálezu

Nalezený zápis se zapíše najednou: pramen s výřezem, přepisem a místem v knize, údaje z něj a hledání, které ho našlo.

- **Hlídá kód:** `strom batch --file notes/<soubor>` zapíše všechny řádky, nebo žádný; chybné řádky řekne všechny
  najednou.
- **Jen metodika:**
  - pramen ze skenu dostane `--clip` (výřez, ve kterém se zápis četl), `--transcript` (slova zápisu po řádcích,
    nepřečtené `[?]`) a `--locator` (folio, strana, pořadí zápisu); podrobně
    [R3.4](R3-verification-and-citation.md#R3.4);
  - zápis v jiném jazyce nebo písmu, než je jazyk výzkumu, dostane vedle doslovného přepisu i překlad do jazyka
    výzkumu (`--translation`), od výzkumu 1.28.0;
  - do polí (`--date`, `--house`, `--age`, jméno) jen jistě přečtené. Nejisté jde do přepisu s `[?]` a do poznámky
    údaje („dům 21 nebo 27“). Co čtenář nahlásil jako nečitelné, zůstane nečitelné, dokud to agent nepřečte sám.
    Prázdný sloupec je prázdný; nic se nedoplňuje podle obvyklého;
  - jméno přečtené jen zčásti si nechá jistá písmena (`Anna /Kr[?]ková/`), datum s nejistým dnem si nechá měsíc;
  - hledání se zapíše i bez nálezu, s přesným rozsahem stran; chybějící strany knihy nejsou prohledané
    ([R3.6](R3-verification-and-citation.md#R3.6)).
- **Hlídá kód:** marné hledání nad místem, které čtenář nahlásil jako nejasné, strom odmítne
  ([R3.6](R3-verification-and-citation.md#R3.6)). Chybějící výřez nebo přepis připomene.
- **Proč:** aplikace Strom ukazuje zápis vyříznutý ze skenu vedle jeho slov. Podle jistých polí se osoba hledá dál;
  jméno s jistými písmeny jde dál najít. Nejdražší chyba je prohledat stejnou knihu dvakrát.
- **Ovládání:** terminál (agent). Aplikace: stránka pramene ukazuje výřez a přepis ([A3.3](A3-evidence-in-the-app.md#A3.3)).
- **Platí od:** výzkum 1.0.0; výřez 1.1.0

<!-- zdroj: research:assets/method/recording.md:1-27, :55-65 · assets/method/reading.md:76-84 · assets/method/core.md „Negative results are results“ · překlad: recording.md "--translation", link.md krok 7 (od v1.28.0) -->

<a id="R8.7"></a>
## R8.7 Jistota a ověření přečteného

Stupeň jistoty údaje ze skenu záleží na tom, kdo a jak zápis četl.

- **Jen metodika:** Doložené jen tehdy, když hlavní agent zápis přečetl sám a zápis údaj uvádí přímo. Závěr, který
  stojí na jedné těžké buňce (číslo domu, věk, jméno), potřebuje před Doloženým druhé, slepé čtení; rozdílná čtení
  jsou rozpor, ne volba ([R3.5](R3-verification-and-citation.md#R3.5)).
- **Hlídá kód:** Doložené potřebuje citaci z pramene, který není slabý, s primární informací
  ([R3.2](R3-verification-and-citation.md#R3.2)). Kód **nekontroluje**, že zápis četl hlavní agent sám, ani slepé
  čtení.
- Dokument přečtený čtenáři výzkumu: jeden čtenář → Možné; dva slepí čtenáři shodně → Pravděpodobné
  ([R3.5.1](R3-verification-and-citation.md#R3.5.1)). Stupně jistoty: [R3.1](R3-verification-and-citation.md#R3.1).
- **Proč:** druhý čtenář nesmí znát očekávanou hodnotu, jinak by ji „přečetl“. Nad Pravděpodobné jde údaj jen
  tehdy, když se dvě nezávislá čtení shodnou.
- **Platí od:** výzkum 1.0.0; čtení dokumentu čtenáři výzkumu 1.18.0

<!-- zdroj: research:assets/method/verify.md:1-18 · assets/method/core.md:8-12 · src/core/evidence.ts:55-68 checkStatus · src/core/readsync.ts readingGrade -->

<a id="R8.8"></a>
## R8.8 Přečíst dokument z aplikace

Fotku, sken nebo PDF dokumentu jde z aplikace dát přečíst agentovi výzkumu: přepis, překlad a výklad. Číst může
jeden čtenář, nebo dva nezávislí; dva se porovnají a místa, kde se liší, výsledek ukáže. Do stromu se z přečteného
nic nezapíše bez potvrzení.

- **Hlídá kód:**
  - vstup: fotka, sken nebo PDF, víc souborů jsou strany jednoho dokumentu; nejvýš 10 stran a 50 MB na soubor.
    Strana, jejíž kratší strana má méně než 800 px, je příliš malá a čtenáři ji nedostanou;
  - **1 čtenář** (rychlejší, levnější), nebo **2 nezávislí čtenáři** (spolehlivější, pro zápis do stromu); volba se
    pamatuje;
  - každý čtenář začíná s čistým kontextem a vrátí: přepis doslova, překlad do jazyka výzkumu, výklad (pojmy,
    zkratky, povolání, souvislosti) a jmenované osoby, události a vztahy;
  - druhý čtenář čte naslepo, prvního čtení nevidí. Porovnají se přepisy slovo po slovu, osoby podle role a pořadí,
    události podle druhu a pořadí. Kde se liší, jsou verze;
  - jméno, které čtenář uvede, musí stát v jeho přepisu. Které osoby a místa stromu odpovídají, určí strom, ne
    čtenář;
  - nejvýš 20 čtení za hodinu a 60 za den (zvýšit je může jen člověk); u jednoho stromu se čte jeden dokument
    naráz a další 3 čekají. V Archivu Stromu čtení není.
- **Výsledek:**
  - značka shody: **2 čtenáři, shoda**, **2 čtenáři, K míst se liší**, nebo **1 čtenář**. Na náhledu strany je
    zelený rámeček vybraného zápisu a jantarový u míst, kde se čtenáři liší („čtenáři se liší: první čte „a“, druhý
    „b““). V přepisu `[?]` značí nejisté čtení a `[...]` nečitelné nebo vynechané místo;
  - oddíly **Přepis**, **Překlad**, **Výklad**, **O dokumentu**, **Zmínění**; **Kopírovat přepis**;
  - dokument, který přečíst nejde, dostane důvod (rozmazané, odlesk přes text, vyfoceno šikmo, část stránky chybí,
    příliš tmavé, příliš malé, na obrázku není psaný text) a radu, jak ho vyfotit lépe;
  - výsledek zůstane v historii čtení (**Přečtené dokumenty**). Do stromu jde přes **Navrhnout do stromu…**.
- **Hranice:**
  - bez volby čtou agent a model výzkumu pro skeny ([R8.3](#R8.3)); u každého čtenáře jde zvolit agenta, model
    a důkladnost ([R8.8.1](#R8.8.1)). Čtení se počítá do ceny výzkumu, i zrušené: co už agent přečetl, se započítá;
  - okno jde zavřít, čtení poběží dál a výsledek se ohlásí. Odhad v okně počítá asi minutu na čtenáře, s Grokem 4 minuty;
  - čtení jde jen s výzkumem, který běží na tomto počítači a má nastaveného agenta; jinak dialog řekne proč (**Teď
    nejde: …**).
- **Ovládání:** aplikace: **Výzkum → Přečíst dokument…**, v nabídce osoby **Přečíst dokument k této osobě…**; soubory
  přetáhnout do okna nebo **Vybrat soubory…**; nepovinně **Dokument se týká** (osoba) a **Poznámka**; **Čtenáři**;
  **Přečíst**. Soubor přetažený do aplikace nabídne **Přečíst hned**, nebo **Přidat do materiálů**
  ([R11](R11-material-from-the-user.md)). Historie: **Výzkum u tohoto stromu… → Přečtené dokumenty (N) ›**.
  Pramen, který už přepis má, jde přečíst znovu z originálu ([R8.8.2](#R8.8.2)).
- **Platí od:** aplikace 3.14.0, výzkum 1.18.0
- **Od aplikace 3.25.0 a výzkumu 1.29.0:** volba čtenářů (**Upřesnit čtení**, [R8.8.1](#R8.8.1)), kdo četl,
  **Přečíst znovu…** u pramene ([R8.8.2](#R8.8.2)) a nastavení **Úkol z nového čtení** ([R8.8.3](#R8.8.3)).

<!-- zdroj: app:src/ui/read-document-ui.ts · strings.ts read.* (menu, menuPerson, r1/r1Sub, r2/r2Sub, agree, differ, oneReader, variantNote, scanHint, whyText, advice, cancelled, closeNote, limit, propose, historyRow) · research:src/core/document.ts DOC_PAGES=10, SMALL_PX=800 · src/core/live-read.ts READ_MAX_BYTES=50 MB, READ_QUEUE_MAX=3, read.app (20/h, 60/den) · src/commands/document.ts:463 · config model.vision · spec 059 K1.1 · 3.25.0/1.29.0: spec 059 K2.1, K3.1, K6, K7; app:6bd8609e strings.ts read.refine, read.sourceAgain · research:c2a690ea CHANGELOG.cs.md 1.29.0 -->

<a id="R8.8.1"></a>
### R8.8.1 Čtenáři: program, model a důkladnost

Každý čtenář dokumentu může číst jiným agentem, modelem a důkladností. Bez volby se čte podle nastavení výzkumu.
Výsledek u každého čtení říká, kdo četl.

- **Hlídá kód:**
  - **1 čtenář** (rychlejší), nebo **2 čtenáři** (spolehlivější, pro zápis do stromu). Dva čtenáři čtou každý zvlášť;
    kde se jejich texty neshodnou, může být chyba a takové místo se ukáže k ověření;
  - v **Upřesnit čtení** má **Čtenář 1** i **Čtenář 2** svůj **Program** (agent), **Model** a **Důkladnost**
    (**rychlá**, **běžná**, **vyšší**, **nejvyšší**), jen z toho, co výzkum na tomto počítači nabízí. Výchozí je
    **podle nastavení agenta**; změna se zapamatuje pro další čtení (**Výchozí** vrátí nastavení výzkumu);
  - bez volby čte model výzkumu pro skeny (`model.vision`), nikdy levnějším modelem;
  - druhý čtenář čte naslepo, prvního čtení nevidí ([R3.5](R3-verification-and-citation.md#R3.5));
  - agent, který teď číst nemůže (přihlášení vypršelo, vyčerpaný limit), se nabídne s důvodem a čtenáře s ním nejde
    spustit. Model, který nainstalovaný Codex nezná, ukončí čtení jako selhání čtenáře s tímto důvodem.
- **Výsledek:** **Četl** u každého čtení: agent · model · důkladnost každého čtenáře, v terminálu, v souboru čtení
  i v aplikaci. Text je podle čtenáře 1; čtenář 2 četl nezávisle, pro kontrolu, a jeho celý text jde zobrazit
  (**Přepis čtenáře**: **Čtenář 1** / **Čtenář 2**). Když oba četli stejným programem, výsledek to řekne.
- **Proč:** dva čtenáři téhož modelu jsou slabší doklad než dva různé modely: kde se shodnou, mohou se mýlit stejně.
  Tak to říká i úkol z nového čtení ([R8.8.3](#R8.8.3)).
- **Ovládání:** aplikace: **Přečíst dokument…** a **Přečíst znovu…** → **Čtenáři** → **Upřesnit čtení**. Terminál:
  `strom document read … --agent --model --effort` (první čtenář) a `--blind-agent --blind-model --blind-effort`
  (slepý čtenář), `--readers 2`.
- **Platí od:** výzkum 1.29.0, aplikace 3.25.0

<!-- zdroj: app:6bd8609e src/strings.ts read.c1/c1Sub/c2/c2Sub/readersWhy, refine, readerN, colProgram, colModel, colThorough, thorough.*, bySettings, changed, reset, agentWhyAuth/agentWhyLimit, downRow, readBy, readerView, whoLine, whoSame · research:c2a690ea strom help document read (--agent/--model/--effort, --blind-agent/--blind-model/--blind-effort: „default model.vision — never weaker for handwriting“) · assets/lang/cs.json read.source.same · CHANGELOG.cs.md 1.29.0 · spec 059 K1.2, K2.1, K2.2, K6.6 -->

<a id="R8.8.2"></a>
### R8.8.2 Přečíst znovu pramen z originálu

Pramen, který má přepis, jde dát přečíst znovu z originálu (skenu nebo výřezu ve výzkumu), ne z přepisu. Nové čtení
se porovná s přepisem místo po místu. Přepis se tím nezmění: nové čtení zůstane uložené u pramene vedle něj.

- **Hlídá kód:**
  - jen u pramene, jehož originál má výzkum na tomto počítači a který má přepis; jinak aplikace řekne proč
    (**Originál pramene výzkum na tomto počítači nemá.**, **Pramen nemá přepis, se kterým by se nové čtení
    porovnalo.**). Na telefonu jen věta, že znovu přečíst jde v aplikaci na počítači s výzkumem;
  - čtenáři přepis ani jména nevidí. Dostanou, co výzkum o záznamu ví: druh, jazyk, datum a kde zápis stojí;
  - s přepisem se porovná jen zápis pramene, ne sousední zápisy z okraje výřezu. Za rozdíl se nepočítají popisky
    sloupců bez protějšku, záhlaví a poznámky výzkumu i čtenáře v závorkách, dlouhé ſ proti s, nečitelné místo proti
    ničemu a slova mimo to, co přečetli oba;
  - každé místo, kde se nové čtení liší od přepisu, má druh:
    - **věcná změna**: jméno, číslo, datum, osoba, nebo slovo tam, kde přepis má `[...]`;
    - **drobnost**: pravopis, zkratka, interpunkce, popisek, velká písmena;
  - věcná změna je **jistá** jen tehdy, když ji oba čtenáři přečetli proti přepisu stejně a nové čtení tam nemá
    `[...]` ani `[?]`. Místo, na kterém se čtenáři neshodnou, je nejistota, ne změna přepisu. U jednoho čtenáře jsou
    nejistá místa ta, kde si čtenář nebyl jistý (nové čtení tam má `[...]` nebo `[?]`), ne neshoda dvou čtenářů;
  - místo, které už posoudil úkol, nebo které člověk ponechal či zamítl, se znovu neposuzuje.
- **Výsledek** (okno **Pramen přečten znovu**): „Proti dosavadnímu přepisu N věcné změny a K drobností.“, nebo
  **Shoduje se s dosavadním přepisem.**; **Čtenáři se shodli.**, nebo „Čtenáři se neshodli na N místech.“; v **Co
  ověřit** skupiny **Věcné změny k ověření**
  (u přepisu potvrzeného člověkem **Věcné změny k posouzení**), **Nejisté – čtenáři se neshodli** (u jednoho čtenáře
  **Nejisté – čtenář si nebyl jistý**), **Už posouzeno v úkolu T…**, **Už rozhodnuto: ponecháno** a **Drobnosti**.
  Do úkolu jdou samy jen jisté věcné změny; nejistá místa jen na žádost člověka ([R8.8.3](#R8.8.3)).
- **Hranice:** potvrzení přepisu člověkem zůstává. Nové čtení přepis nikdy samo nepřepíše
  ([R3.4.1](R3-verification-and-citation.md#R3.4.1)).
- **Ovládání:** aplikace: prohlížeč pramene → **Přečíst znovu…** (značka AI), s volbou čtenářů
  ([R8.8.1](#R8.8.1)); u pramene pak řádek nového čtení s **Výsledek ›**. Terminál:
  `strom document read --source S… [--clip …]`, `strom source show S…`.
- **Proč:** po čase jde přepis ověřit jiným čtenářem, z originálu. Shoda podpírá dosavadní přepis, rozdíl je vodítko
  k ověření, ne nový přepis.
- **Platí od:** výzkum 1.29.0, aplikace 3.25.0

<!-- zdroj: research:c2a690ea src/core/sourceread.ts (porovnání, druhy míst, sure, judged) · strom help document read --source · CHANGELOG.cs.md 1.29.0 · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 1, Tabulka scénářů) · app:6bd8609e src/ui/read-source-ui.ts (nabídka jen s originálem, AI) · strings.ts read.sourceAgain, sourceAgainTitle, againPhone, srcWhy.*, resultSource, vSrc, vSrcSame, vDis, check, gMajor, gMajorPerson, gUnsure, gJudged, gKept, gMinor, vk.*, againResultLink, keepConfirm · spec 059 K3.1–K3.3, K6.2, K6.3 · dirigent:test ověření aplikace 6bd8609e · jeden čtenář: research:4895d0f0 src/core/sourceread.ts surely (jeden čtenář: nejisté jen `[...]`, `[?]`) · app:7327b758 strings.ts read.gUnsure1, vk.number („číslo“) · dirigent:test/vysledek-1107-nejista-mista.md -->

<a id="R8.8.3"></a>
### R8.8.3 Úkol z nového čtení

Úkol z pramene přečteného znovu vzniká sám jen z jisté věcné změny, kterou ještě nikdo neposoudil. Drobnosti úkol
nikdy nezaloží a nejistá místa ho samy nezaloží: agentovi je jde dát jen na žádost člověka. Jestli úkol z jisté věcné
změny vznikne hned, nebo rozhodne člověk, určuje nastavení **Úkol z nového čtení**.

- **Nastavení** (`read.sourceTask`, pro každý strom):
  - **Zeptat se** (`ask`, výchozí): úkol nevznikne sám. Čtení zůstane u pramene jako neověřené, dokud člověk
    nerozhodne;
  - **Zakládat vždy** (`always`): úkol vznikne hned; u přepisu potvrzeného člověkem návrh znění pro člověka;
  - **Nezakládat** (`never`): úkol nevznikne sám, čtení čeká u pramene a člověk může rozhodnout stejně jako u
    **Zeptat se**.
- **Volby** (patička okna **Pramen přečten znovu**, u pramene **Rozhodnout ▸**):
  - přepis, který člověk nepotvrdil: **Úkol pro agenta** → **Ověřit s agentem teď** (úkol a hned rozhovor s agentem
    v terminálu) nebo **Dát agentovi do fronty** (úkol ve frontě přednostně, priorita 3); **Bez úkolu** → **Jen
    uložit** (úkol nevznikne, pramen se už neptá a tatáž místa se znovu nenabídnou; u pramene jde pak ještě zvolit
    **Dát agentovi…**);
  - přepis potvrzený člověkem: **Úkol pro člověka** → **Dát k posouzení** (návrh znění člověku, agent na něm
    nepracuje, [R3.4.1](R3-verification-and-citation.md#R3.4.1)), nebo **Jen uložit**. Úkol pro agenta tu nikdy
    nevznikne;
  - pramen s neukončeným úkolem: **Připsat k T… a ověřit teď**, **Připsat k úkolu T…**. Jeden pramen má najednou
    jeden úkol svých čtení: nová místa se připíšou k němu, žádné dvakrát.
- **Nejistá místa na žádost:**
  - nabízí se jen u čtení, které nemá žádnou jistou věcnou změnu k rozhodnutí, ale má nejistá místa, která nejsou
    drobnost a která ještě neposoudil žádný úkol. V patičce okna **Pramen přečten znovu** stojí volba vedle
    **Zavřít** (to zůstává hlavní tlačítko), u pramene v řádku nového čtení (**Dát agentovi… ▸**, u potvrzeného
    přepisu **Dát k posouzení… ▸**). Nabízí se při každém nastavení, i při **Nezakládat**; na telefonu ne. Jen
    drobnosti nebo už posouzená místa → volba se nenabízí;
  - přepis, který člověk nepotvrdil: **Dát agentovi k posouzení** (značka AI) → úkol pro agenta ve frontě (priorita
    3), nebo se místa připíšou k neukončenému úkolu pramene. Čtenáři četli naslepo, bez přepisu a jmen
    ([R8.8.2](#R8.8.2)); místa posoudí až agent, na snímku se vším, co výzkum ví o lidech, místech a datech záznamu.
    Kde to snímek ukazuje jistě, přepis opraví a napíše důvod; jinde přepis nechá a k prameni napíše poznámku, co
    prohlédl a proč místo zůstává nejisté. Na nic se člověka neptá;
  - přepis potvrzený člověkem: **Dát k posouzení** → úkol pro člověka s návrhem znění jen z nejistých míst, která nové
    čtení přečetlo (ne `[...]`, `[?]`); agent přepis nemění ([R3.4.1](R3-verification-and-citation.md#R3.4.1)).
    Když nové čtení přečetlo jen nečitelná místa, volba se nenabízí;
  - úkol z nejistých míst vznikne jen na kliknutí, nikdy sám, ani při **Zakládat vždy**. Místa, která pak úkol drží,
    se u dalších čtení znovu nenabízejí.
- **Hlídá kód:**
  - rozhoduje jen člověk: v aplikaci, nebo u svého terminálu. `strom document read --source` u terminálu člověka se
    zeptá hned (**Projít to s agentem teď**, **Dát to do fronty jako úkol**, **Jen uložit čtení**, u potvrzeného
    přepisu **Dát k posouzení**); bez volby nic nerozhodne a později jde rozhodnout `strom source reading S…`.
    Agent rozhodnout nesmí: řekne člověku, co čeká;
  - nejistá místa předá jen člověk: `strom source reading S… --take queue --unsure` (u potvrzeného přepisu
    `--take review --unsure`), jindy `--unsure` nejde. Čtení, které má jistou věcnou změnu k rozhodnutí, se s
    `--unsure` odmítne: rozhoduje se bez něj a nejistá místa jdou s ní. `strom source show S…` u nabídky řekne, že
    místa jde předat;
  - úkol uvádí, kdo četl (agent · model · důkladnost každého čtenáře), že dva čtenáři téhož modelu jsou slabší doklad
    a že nové čtení je jen vodítko ([R3.4.1](R3-verification-and-citation.md#R3.4.1)). Věcné změny jsou v důvodu
    úkolu první;
  - aplikace starší než 3.25.0 volbu nemá: u nepotvrzeného přepisu vznikne úkol pro agenta hned, u potvrzeného návrh
    znění pro člověka.
- **Stav u pramene** (prohlížeč pramene): **Novější čtení … se liší (N věcné změny), neověřeno.**, **… uloženo, úkol
  nevznikl.**, **… úkol T… pro agenta (ve frontě).**, **… úkol T… k posouzení.**, **… liší se jen drobnosti.**,
  **… čtenáři se neshodli …, přepis se nemění.** (u jednoho čtenáře **… čtenář si nebyl jistý …, přepis se nemění.**)
  Po založení úkolu **Otevřít úkol T…**
  ([S4.5.3](S4-research-from-the-app.md#S4.5.3)).
- **Ovládání:** aplikace: **Výzkum → Další → Výzkum u tohoto stromu… → Čtení dokumentů → Úkol z nového čtení**
  (zapíše se do výzkumu a platí i pro čtení spuštěná v terminálu). Terminál:
  `strom config set read.sourceTask ask|always|never --for-tree`, jednou `strom document read --source S…
  --source-task …`, `strom source reading S… [--take now|queue|keep|review] [--unsure]`, `strom source show S…`.
- **Proč:** úkol stojí práci agenta, která čerpá předplatné; drobnost ani nejistota přepis nemění, a co už bylo
  posouzené, se nemá posuzovat znovu. Nejistá místa jde přesto posoudit: čtenáři je nerozhodnou, protože čtou
  naslepo, ale agent je může posoudit se souvislostmi výzkumu, když o to člověk požádá.
- **Platí od:** výzkum 1.29.0, aplikace 3.25.0

<!-- zdroj: research:c2a690ea src/core/config.ts:310 read.sourceTask (ask|always|never, tree) · src/core/sourceread.ts:293-302, :438, :600-617 · src/commands/source-reading.ts · strom help source reading (--take now|queue|keep|review, priorita 3) · strom help document read --source-task · assets/lang/cs.json ui.reading.*, read.source.why/same · src/core/live.ts:124-138 taskChoice, POST sourceTask · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 2–4, Tabulka scénářů) · app:6bd8609e strings.ts treeResearch.readGroup/readTask/readTaskAsk/readTaskAlways/readTaskNever/rtOk, read.tAgent, tNow, tQueue, tNone, tSave, tPerson, tReview, tAppendNow, tAppendQueue, sUnchecked, sSaved, sTaskQueued, sTaskPerson, sMinor, sUnsure, sDecide, sGiveAgent, openTaskN · src/ui/read-task-setting-view.ts · dirigent:test ověření aplikace 6bd8609e · spec 059 K3.2, spec 065 K2.3 · nejistá místa na žádost: spec 059 P8 K8.1–K8.5 · research:4895d0f0 src/core/sourceread.ts unsureOffered, wordingOf, decideReading (unsure, read.decide.sure/nothing/noproposal), handOver priorita 3 · src/commands/source-reading.ts --unsure · assets/lang/cs.json read.source.unsure.* · CHANGELOG.cs.md 1.29.0 · app:docs/ZADANI_VYZKUM_cteni-vysledek.md „Odpověď výzkumu: nejistá místa na žádost“ · app:7327b758 src/ui/read-task-view.ts readTaskUnsureShown (B, D, jen počítač), unsureChoiceHtml · src/ui/read-source-state-view.ts · strings.ts read.close, tUnsureQueue, tUnsureQueueSub, tReview, tUnsureReviewSub, sGiveAgent, sReviewGive, sUnsure · dirigent:test/vysledek-1107-nejista-mista.md (i doověření N1) -->
