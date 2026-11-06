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
- **Proč:** podle kódu jen tak, aby se tím nic nezhoršilo: změna smí přidat přesnost nebo ušetřit žádosti do archivu;
  co by mohlo ubrat přesnost nebo zatížit archiv, je otázka pro člověka.
- **Platí od:** výzkum 1.14.0

<!-- zdroj: research:src/core/tune.ts:1-21 (A1–A7) · src/core/readstats.ts:88-99 TUNING smallest, backAfterDays · src/core/config.ts:337 tune.auto · src/commands/calibrate.ts:394-420 -->

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
