<a id="A11"></a>
# A11 Seznamy osob

Seznam osob drží vybrané osoby stromu pod jedním jménem, aby se s nimi dalo pracovat opakovaně: v Tabulce jako její
rozsah ([A6.7.19](A6-views.md#A6.7.19)), v exportu a jako pracovní seznam s odškrtáváním. Seznam vznikne podle
pravidla (rod, předci, potomci, linie výzkumu, filtr Tabulky, kdy osoby přibyly, vlastní pravidlo z podmínek),
z výsledků hledání nebo ručně. Kapitola popisuje aplikaci Strom 3.32.0.

<!-- zdroj: dirigent:spec/084-seznamy-osob (K1.1–K8.4, rozhodnutí 14. a 16. 11.) · app:714a8ab2..60265541 (dirigent:prace/1116-app-084-seznamy) · app:docs/ZADANI_DEV_seznamy-osob.md §1–§13, §15, §16 · app:src/person-lists.ts, src/person-lists-data.ts · app:CHANGELOG.cs.md 3.30.0 „Pojmenované seznamy osob“ · 3.32.0 vlastní pravidla: dirigent:spec/136-pravidla-seznamu (fáze 1, K1.1–K1.10) · app:a07c78b2..efc14cff (merge 78807628) · app:CHANGELOG.cs.md 3.32.0 „Vlastní pravidla seznamů“ -->

<a id="A11.1"></a>
## A11.1 Pevný, automatický a pracovní seznam

Seznam je **pevný**, nebo **automatický**. Pevný seznam drží své osoby a mění se jen ručně. Automatický seznam je
uložené pravidlo: jeho osoby se počítají vždy znovu.

| Druh | Co drží | Ručně přidat a odebrat | Ruční pořadí |
|---|---|---|---|
| **pevný** | osoby v ručním pořadí; pravidlo, ze kterého vznikl (**Vznikl z**), když nějaké má | ano | ano |
| **automatický** | jen pravidlo (**Podle**) | ne: „Obsah určuje pravidlo – ručně se nepřidává ani neodebírá.“ | ne |
| **pracovní** | pevný seznam se zapnutým **Odškrtávat hotové** ([A11.8](#A11.8)) | ano | ano |

- Druh je vidět u seznamu v přehledu (ikona a slovo **pevný**, **automatický**, **pracovní**), v detailu (štítek
  **Pevný seznam**, **Automatický seznam**, **Pracovní seznam**) a v **Rozsah** Tabulky (ikona).
- Seznam má jméno. Jméno je ve stromu jedinečné; porovnává se bez diakritiky, velikosti písmen a nadbytečných mezer.
  Obsazené jméno se neuloží: „Seznam s tímto jménem už je. Navrženo: „{jméno} (2)“.“ (další volné číslo).
- Zástupné osoby v seznamu nejsou nikdy.
- **Hranice:** seznamy se mění jen ve stromu, který jde měnit. Ve stromu jen ke čtení (exportovaná stránka HTML,
  sledovaný strom, strom uložený novější verzí aplikace, zamčený strom) jdou seznamy prohlížet a otevřít v Tabulce,
  úpravy chybí; správa má štítek **Jen ke čtení**. Zamčená osoba do seznamu přidat jde.
- Od aplikace 3.32.0 může pevný i automatický seznam stát na vlastním pravidle z podmínek ([A11.2.4](#A11.2.4)) a
  pevný seznam s pravidlem jde znovu udělat automatickým (**Udržovat podle pravidla**, [A11.2.2](#A11.2.2)).
- **Ovládání:** **Akce → Seznamy osob…** ([A11.3](#A11.3)).
- **Platí od:** aplikace 3.30.0; 3.32.0: vlastní pravidlo, **Udržovat podle pravidla**

<!-- zdroj: app:src/person-lists.ts listKind (dynamic → auto, checklist → work), listPersonIds (bez zástupných osob) · src/person-lists-data.ts foldListName, isListNameTaken, suggestListName · src/data.ts:2130 listsReadOnly (isReadOnly || isTreeLocked; isTreeLocked: sledovaný strom liveTreeId, isNewerData, isLocked) · src/ui/person-list-add.ts personListMenuRows (zamčená osoba ano, app:60265541) · strings.ts lists.kind.*, badge.*, rule.key, rule.origin, autoInfo, save.dup, readOnly · ZADANI_DEV §1, §16c, Q1 -->

<a id="A11.2"></a>
## A11.2 Pravidlo seznamu

Pravidlo říká, které osoby do seznamu patří. Pevný seznam ho použije jednou při vzniku, automatický pokaždé.

| Pravidlo | Koho najde | Jméno nového seznamu | Výchozí řazení |
|---|---|---|---|
| **Prázdný** | nikoho, osoby se přidají ručně | – | **Ručně** |
| **Rod** | pokrevní členy rodu ([A4](A4-surnames-and-families.md)) | **Rod** jméno rodu | **Od nejstaršího** |
| **Předci osoby** | předky vybrané osoby, **všechny generace** nebo **do N generací** | „Předci – {osoba}“ | **Po generacích** |
| **Potomci osoby** | potomky vybrané osoby, všechny generace nebo do N generací | „Potomci – {osoba}“ | **Po generacích** |
| **Linie výzkumu** | osoby linie výzkumu, stejně jako čip linie v Tabulce ([A6.7.14](A6-views.md#A6.7.14)) | název linie | **Od nejstaršího** |
| **Přidáno za období** | osoby přidané do stromu za posledních 7, 30, 90 nebo jiný počet dní ([A11.7](#A11.7)) | „Přidáno za posledních {n} dní“ | **Podle přidání** |
| filtr Tabulky | řádky Tabulky po filtru a řazení ([A11.6](#A11.6)) | název pohledu | **Ručně** (pořadí Tabulky) |
| **Vlastní pravidlo** (od aplikace 3.32.0) | osoby, které splní podmínky složené do skupin ([A11.2.4](#A11.2.4)) | píše se; ze šablony její jméno ([A11.2.10](#A11.2.10)); s jedinou podmínkou **Rodina osoby** „Rodina – {osoba}“ | **Od nejstaršího** |

- **Partneři:** rod, předci a potomci berou jen pokrevní osoby. Partner, který do rodiny přišel sňatkem, v seznamu
  není, dokud se nepřidá ručně.
- Generace jdou vybrat od 1 do 10, nebo **všechny generace**. Počet dní je 1 až 3650. Den, kdy seznam počítá, je
  první den období („za posledních 30 dní“ = dnes a 29 dní před tím).
- Jméno se mění s volbou pravidla, dokud se pole **Jméno** nepřepíše.
- Každá volba ukazuje počet osob, které by seznam dostal. Linie výzkumu je jen ve stromu s liniemi.
- **Udržovat aktuální** (výchozí vypnuto) udělá automatický seznam; jinak vznikne pevný: „Pevný seznam: osoby se
  vyberou teď a dál se mění jen ručně. Pravidlo si pamatuje pro „Doplnit podle pravidla“.“
- Od aplikace 3.32.0 je poslední volbou **Vlastní pravidlo** („složit z podmínek“): místo voleb se ukáže sestavení
  pravidla ([A11.2.4](#A11.2.4)). **Vlastní pravidlo ▾** vrátí jinou volbu; pravidlo s jedinou podmínkou, kterou
  volba zná, převezme i s nastavením. Pravidlo, které zná některá volba (jedna podmínka bez „kromě“), se uloží jako
  pravidlo té volby. **Upravit pravidlo…** seznamu s vlastním pravidlem otevře rovnou sestavení.
- Od aplikace 3.32.0 mají **Předci osoby** a **Potomci osoby** odkaz **Víc možností: rodina osoby…**: vlastní
  pravidlo s jednou podmínkou **Rodina osoby** ([A11.2.6](#A11.2.6)).
- **Ovládání:** **Seznamy osob → Nový seznam…** → **Podle**, **Udržovat aktuální**, **Vytvořit**; u seznamu
  **Upravit pravidlo…**. Pak se otevře správa s novým seznamem a oznámení „Seznam „{jméno}“ uložen.“ Od aplikace
  3.32.0 je vpravo na řádku **Podle** i **Začít ze šablony ▾** ([A11.2.10](#A11.2.10)).
- **Platí od:** aplikace 3.30.0; 3.32.0: **Vlastní pravidlo**, **Víc možností: rodina osoby…**

<!-- zdroj: app:src/person-lists.ts rulePersonIds (rods/ancestors/descendants přes selection().memberIds – jen pokrevní, Q2; line přes personLineRole jako čip linie; tableFilter filterRows + sortRows; added: startOfDay − (days − 1) dní), ruleLabel · src/ui/person-list-new-ui.ts PERIODS 7/30/90, MAX_GENERATIONS 10, MAX_DAYS 3650, jméno podle pravidla do přepsání, počet u volby · ZADANI_DEV §3 (výchozí řazení podle pravidla), Q2 · app:e09dcacb · strings.ts lists.new.*, keep, keepOn, keepOff, create, toast.saved, rule.* · 3.32.0: src/ui/person-list-new-ui.ts (volba custom jako poslední, customToRule při uložení, moreFamily, Upravit pravidlo… vlastního pravidla rovnou do sestavení, newPersonListTemplateHtml), src/data.ts createCustomPersonList (řazení old), strings.ts lists.new.customRule, customRuleSub, fromTemplate, moreFamily, nameFamily (app:3a7e8595) -->

<a id="A11.2.1"></a>
### A11.2.1 Doplnit podle pravidla

Pevný seznam, který vznikl z pravidla, ho může použít znovu: **Doplnit podle pravidla** přidá osoby, které pravidlo
dnes najde a v seznamu nejsou.

- Osoba ze seznamu ručně odebraná se doplněním nevrátí. Vrátí se jen ručním přidáním.
- Nové osoby přijdou na konec ručního pořadí, seřazené podle řazení seznamu (u ručního řazení **Od nejstaršího**).
- Oznámení: „Přidáno N osob podle pravidla.“ s **Zpět**; když nic nepřibude, „Seznam je úplný.“
- Pevný seznam bez pravidla (vznikl prázdný nebo z výsledků hledání) tuto volbu nemá.
- **Ovládání:** detail seznamu, řádek **Vznikl z** → **Doplnit podle pravidla**.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/person-lists.ts withRuleFilled (bez personIds a removed, na konec, ruční → old), withPersonsRemoved (removed jen s pravidlem), withPersonsAdded (ruční přidání vyjme z removed) · strings.ts lists.fill, toast.filled, toast.full · ZADANI_DEV §3c -->

<a id="A11.2.2"></a>
### A11.2.2 Zmrazit automatický seznam

**Zmrazit** udělá z automatického seznamu pevný se současnými osobami v současném pořadí („Stane se pevným se
současnými osobami“). Pravidlo zůstane jako **Vznikl z**, od aplikace 3.32.0 i vlastní pravidlo.

- Oznámení „Seznam zmrazen – teď je pevný.“ s **Zpět**.
- Do aplikace 3.31.0 z pevného seznamu automatický udělat nejde. Od aplikace 3.32.0 to umí **Udržovat podle
  pravidla** („Počítá se znovu podle pravidla“) u pevného seznamu s pravidlem: seznam se zase počítá podle pravidla,
  ručně přidané a odebrané osoby, odškrtnutí a ruční pořadí se zahodí (**Ručně** se změní na **Od nejstaršího**).
  - Když je co zahodit, nejdřív se zeptá: „Udržovat podle pravidla?“ – „Seznam se bude počítat podle pravidla.
    Ručně přidané ({a}) a odebrané ({r}) osoby a ruční pořadí se zahodí.“ (ruční pořadí, jen když ho seznam má).
  - Oznámení „Seznam se počítá podle pravidla.“
  - Pracovní seznam to nejde: „Nejdřív vypnout Odškrtávat hotové“.
- **Ovládání:** **⋯** automatického seznamu → **Zmrazit**; od aplikace 3.32.0 **⋯** pevného seznamu s pravidlem →
  **Udržovat podle pravidla**.
- **Platí od:** aplikace 3.30.0; 3.32.0: vlastní pravidlo, **Udržovat podle pravidla**

<!-- zdroj: app:src/person-lists.ts withFrozen (dynamic false, personIds = listPersonIds, rule zůstává) · strings.ts lists.menu.freeze, freezeSub, toast.frozen · app:3dc8e709 · 3.32.0: src/person-lists.ts withFrozen (custom.auto false), keptByRuleLoss (added, removed, manual; null u pracovního), withKeptByRule (removed, done, checklist ven, manual → old) · src/ui/person-list-hooks.ts freezeAndChecklistRows, keepByRule (ptá se jen při ztrátě) · src/data.ts keepPersonListByRule · strings.ts lists.menu.keepByRule, keepByRuleSub, keepByRule.*, toast.keptByRule · app:5959ed63 -->

<a id="A11.2.3"></a>
### A11.2.3 Pravidlo, které už nic nenajde

Když zmizí to, na čem pravidlo stojí, seznam zůstane, jen prázdný, a řekne proč:

- „Pravidlo už nic nenajde: osoba {jméno} byla smazána.“ (předci nebo potomci smazané osoby; jméno si pravidlo
  pamatuje z doby vzniku);
- „Pravidlo už nic nenajde: rod zanikl.“;
- „Pravidlo už nic nenajde: linie byla odebrána.“
- Pod větou jsou **Upravit pravidlo…** a **Smazat seznam**.
- Od aplikace 3.32.0: vlastní pravidlo místo toho ukáže, co chybí, a podmínku s chybějícím odkazem počítá jako
  prázdnou ([A11.2.11](#A11.2.11)).
- **Platí od:** aplikace 3.30.0; 3.32.0: vlastní pravidlo

<!-- zdroj: app:src/person-lists.ts ruleBroken (person podle rule.personName, rod, line) · strings.ts lists.ruleGone, ruleGoneRod, ruleGoneLine, deleteList · ZADANI_DEV §7d -->

<a id="A11.2.4"></a>
### A11.2.4 Vlastní pravidlo: podmínky a skupiny

**Vlastní pravidlo** skládá podmínky ([A11.2.5](#A11.2.5)) do skupin. Skupina řekne, jak se její podmínky spojí:
**Platí všechny** (osoba musí splnit každou), nebo **Platí kterákoli** (stačí jedna).

- Podmínky po první začínají slovy „a zároveň“ (**Platí všechny**), nebo „nebo“ (**Platí kterákoli**).
- **kromě** u podmínky nebo skupiny ubere osoby, které ji splní. Položky s „kromě“ stojí na konci své skupiny a ubere
  se každá osoba, která splní kteroukoli z nich. První položka skupiny „kromě“ být nemůže; skupina jen z „kromě“
  nenajde nikoho.
- Skupina je položka jako podmínka: má vlastní **Platí všechny** / **Platí kterákoli** a může mít „kromě“. Pravidlo
  má nejvýš tři úrovně (celé pravidlo je první); ve třetí úrovni **+ Přidat skupinu** není.
- **Do skupiny s…** udělá z podmínky a podmínky pod ní skupinu **Platí všechny**. Dvě podmínky s „kromě“ se spojí
  do jedné skupiny „kromě“ s **Platí kterákoli** (ubere tytéž osoby).
- Řádek podmínky: spojovací slovo, jméno podmínky s nastavením, vlastní počet osob ([A11.2.9](#A11.2.9)) a **⋯**:
  **kromě** / **Zahrnout**, **Posunout výš** / **Posunout níž**, **Do skupiny s…**, **Duplikovat**, **Odebrat**.
  **⋯** skupiny: **kromě**, **Rozpustit skupinu**, **Posunout výš** / **Posunout níž**, **Odebrat skupinu**.
- Odebrání ohlásí „Podmínka odebrána.“ se **Zpět**. Ctrl+Z (⌘Z) vrátí poslední krok sestavování; změny stromu
  nevrací.
- Nová podmínka dostane výchozí nastavení ([A11.2.5](#A11.2.5)); osobou je ústřední osoba pohledu.
- **Vytvořit** (u úpravy **Uložit**) čeká na pravidlo, které jde uložit. Patička řekne proč: „Zatím žádná podmínka“,
  „Podmínka {i} není úplná“, „Skupina potřebuje podmínku bez „kromě““, nebo „Pravidlo takhle nejde uložit“ (prázdná
  skupina, víc než tři úrovně, kruh přes seznamy, [A11.2.8](#A11.2.8)).
- Zavření dialogu s rozdělaným pravidlem, ve kterém je víc než jedna upravená podmínka, se zeptá: „Zahodit rozdělané
  pravidlo?“ (**Pokračovat v úpravě** / **Zahodit**).
- **Udržovat aktuální** platí i tady: zapnuté udělá automatický seznam, vypnuté pevný s osobami, které pravidlo
  najde teď.
- **Přidat podmínku…** u seznamu s pravidlem otevře dialog pravidla s dosavadním pravidlem a s výběrem nové podmínky;
  pravidlo z volby (např. **Předci osoby**) se stane první podmínkou. Pevný seznam si nechá své osoby, změní se jen
  pravidlo **Vznikl z** (pak **Doplnit podle pravidla**, [A11.2.1](#A11.2.1)).
- **Hranice:** nejvýš tři úrovně skupin; krok zpět sestavování nejvýš 50 kroků. Meze nastavení jsou v
  [A11.2.5](#A11.2.5), výkon počítání v [A11.2.9](#A11.2.9).
- **Ovládání:** **Nový seznam…** → **Podle** → **Vlastní pravidlo**; **+ Přidat podmínku** otevře katalog podmínek
  s polem **Hledat podmínku**, **+ Přidat skupinu** skupinu s jednou podmínkou z katalogu. **⋯** pravidla: **Uložit
  jako šablonu…** ([A11.2.10](#A11.2.10)), **Vyprázdnit pravidlo**. Posun řádku: tažení za úchyt (jen myš),
  Alt+↑ / Alt+↓ nebo **⋯**. **⋯** seznamu nebo odkaz v detailu → **Přidat podmínku…** ([A11.3](#A11.3)). Na
  telefonu stojí spojovací slovo před jménem podmínky a nabídky jsou panely zdola.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:src/person-list-rules.ts (RULE_MAX_DEPTH 3; skupina all = průnik kladných, any = sjednocení, minus sjednocení kromě; ruleIssues: incomplete, depth, empty, exceptFirst, exceptOnly, cycle), src/person-list-rule-edit.ts (canExcept: ne první položka; toggleExcept na konec skupiny; canAddGroup; groupWithNext: dvě kromě → skupina any s kromě), src/ui/person-list-rule-ui.ts (UNDO_MAX 50, UNDO_MS 6000, řádek a ⋯, Ctrl+Z, ruleBuilderStartAdd, důvod v patičce), src/ui/person-list-new-ui.ts (startWith addCondition, ruleToCustom, discard u víc než jedné upravené podmínky, primární Vytvořit / Uložit), src/data.ts setPersonListCustomRule (pevný si nechá personIds) · strings.ts lists.rules.all, any, and, or, except, include, addCondition, addGroup, intoGroup, dissolve, removeGroup, remove, removed, clear, noConditions, incomplete, needPlus, cantSave, discard.*, firstOfGroup, catalog.search, lists.addCondition, lists.up, down, menu.dup · app:3a7e8595, ffc7ff32, 5959ed63, 0bd2e438 · spec 136 K1.1, K1.2, K1.5 -->

<a id="A11.2.5"></a>
### A11.2.5 Podmínky vlastního pravidla

Katalog podmínek má skupiny **Rodina a linie**, **Život v čase**, **Místa**, **Osoba**, **Údaje** a **Ze stromu a
z Tabulky**, v pořadí tabulky.

| Podmínka | Koho najde | Výchozí nastavení a meze |
|---|---|---|
| **Rodina osoby** | osobu a její příbuzné po krocích nahoru, dolů, do šířky a přes sňatky ([A11.2.6](#A11.2.6)) | ústřední osoba; 2 nahoru, 2 dolů, jen přímá linie, jen pokrevní |
| **Předci osoby** | předky osoby jako volba **Předci osoby** ([A11.2](#A11.2)) | ústřední osoba; všechny generace nebo 1–10 |
| **Potomci osoby** | potomky osoby jako volba **Potomci osoby** | ústřední osoba; všechny generace nebo 1–10 |
| **Rod** | pokrevní členy rodu | první rod stromu |
| **Linie výzkumu** | osoby linie výzkumu | první linie |
| **Jiný seznam** | osoby jiného seznamu ([A11.2.8](#A11.2.8)) | seznam se vybere |
| **Narození v období** | rok narození, bez data narození rok křtu, v rozmezí | roky 1–2999, od, do, nebo od–do |
| **Úmrtí v období** | rok úmrtí, bez data úmrtí rok pohřbu, v rozmezí | jako u narození |
| **Sňatek v období** | rok začátku některého svazku osoby v rozmezí | jako u narození |
| **Žil v období** | osoby, které v některém roce rozmezí jistě žily; jde vybrat i století | 19. století (1801–1900) |
| **Věk při úmrtí** | věk při úmrtí jako sloupec Tabulky | do 5 let; 0–130 |
| **Žijící / zemřelý** | žijící, nebo zemřelé osoby jako čip Tabulky | žijící |
| **Místo a okolí** | narození, úmrtí, sňatek nebo bydliště v místě a jeho okolí ([A11.2.7](#A11.2.7)) | všechny čtyři události, **jen místo** |
| **Pohlaví** | ženy, muži, nebo pohlaví neznámé | ženy |
| **Povolání** | osoby s některým z vybraných povolání | povolání se vyberou (i víc) |
| **Má údaj** | osoby, které údaj mají (**má**), nebo nemají (**nemá**) | nemá doklad nebo pramen |
| **Počet** | aspoň, nebo nejvýš N dětí, sňatků, nebo pramenů | aspoň 5 dětí; 0–999 |
| **Text ve vyprávění nebo poznámce** | text ve vyprávění, v poznámce, nebo v obojím | obojí; nejvýš 200 znaků |
| **Přidáno za období** | osoby přidané do stromu za 24 hodin, 7 dní, 30 dní, nebo od data ([A11.7](#A11.7)) | 7 dní |
| **Změněno za období** | osoby, jejichž údaje se v aplikaci změnily, za stejná období | 7 dní |
| **Uložený filtr Tabulky** | řádky uloženého pohledu Tabulky (Osoby nebo Svazky) podle kopie jeho filtru | první uložený pohled |

- Katalog nabízí jen podmínky, pro které strom má data: **Rod** jen ve stromu s rody, **Linie výzkumu** jen
  s liniemi výzkumu, **Jiný seznam** jen s víc než jedním seznamem, **Povolání** jen s povoláním, **Uložený filtr
  Tabulky** jen s uloženým pohledem Tabulky.
- **Období:** podmínka platí, jen když celé rozpětí data leží v období („kolem 1820“ je 1818–1822; „před 1850“ nemá
  začátek). Osoba bez data podmínku nesplní.
- **Žil v období:** osoba žila od konce rozpětí narození do začátku rozpětí úmrtí; bez data úmrtí „bez data úmrtí se
  počítá 90 let od narození“ (nejdéle do dneška), jen s datem úmrtí rok úmrtí, bez obou dat podmínku nesplní.
- **Má údaj:** datum narození, místo narození, datum úmrtí, místo úmrtí; doklad nebo pramen, fotku, materiál; rodiče,
  partnera, děti; vyprávění, poznámku; ve stromu z výzkumu i rozpor (nerozhodnutý rozpor výzkumu) a otevřený úkol
  výzkumu.
- **Počet:** děti jsou vlastní děti; sňatky a prameny se počítají jako ve sloupcích Tabulky.
- **Text:** „bez ohledu na velikost písmen a diakritiku“.
- **Změněno za období:** čas změny se zapíše u osoby, když se v aplikaci změní její údaje, události, citace nebo
  rodiče, a u obou partnerů, když se změní jejich svazek; nová osoba ho nemá (má údaj „přidáno“). U podmínky stojí
  „údaj o změně se zapisuje od verze 3.32 – starší úpravy se nepočítají“.
- **Uložený filtr Tabulky:** podmínka drží kopii filtru („kopie filtru: {pohled}“); pozdější změna pohledu Tabulky
  ji nezmění.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:src/types.ts RuleCondName (21 podmínek) · src/person-list-rules.ts (spanInside celé rozpětí, ABOUT_YEARS 2, LIFE_YEARS_WITHOUT_DEATH 90, livedSpan, born birthOrBaptism, died deathOrBurial, married startDate svazku, count children / uCount / srcCount, has: čipy a buňky Tabulky, conflict nerozhodnutý, openTask, text fold bez diakritiky, added/changed hours 24 / days / since, gender unknown) · src/ui/person-list-rule-editors.ts ruleCatalog (skupina, pořadí, available) · src/ui/person-list-rule-cond-editors.ts (výchozí: deathAge to 5, has nemá source, count děti aspoň 5, rod první rod, line první linie, tableFilter první pohled; HAS_GROUPS, výzkum jen ve stromu z výzkumu; CHANGED_FROM 3.32) · src/person-lists-data.ts stampChangedAt · strings.ts lists.rules.cond.*, catalog.head.*, has.*, livedHint, textHint, changedFrom, filterCopy, countWhat, cmp · app:ffc7ff32, 6f3847ec, 4bc39c94 · spec 136 K1.1 -->

<a id="A11.2.6"></a>
### A11.2.6 Rodina osoby

**Rodina osoby** vezme osobu a její příbuzné po krocích ve čtyřech směrech. Osoba sama je ve výsledku vždy.

| Směr | Volby |
|---|---|
| **Nahoru** | 0–10 generací nebo **všechny**; **přes oba rodiče**, **přes otce**, **přes matku** |
| **Dolů** | 0–10 generací nebo **všechny** |
| **Do šířky** | **jen přímá linie**, **+ sourozenci**, **+ bratranci** do 1.–5. stupně nebo **všech stupňů** |
| **Manželé** | **jen pokrevní**, **+ manželé**, **+ rodiny manželů** |

- **přes otce** a **přes matku** platí v každém kroku nahoru. U dvou rodičů stejného pohlaví je otcovou stranou první
  z nich.
- **+ sourozenci** jsou sourozenci osoby i každého předka v dosahu **Nahoru**. **+ bratranci** do N. stupně jsou
  všichni potomci předků do N + 1 generací nahoru (1. stupeň jsou bratranci a sestřenice), nejvýš do dosahu
  **Nahoru**.
- **+ manželé** přidá partnery všech osob výsledku, **+ rodiny manželů** i rodiče a sourozence těchto partnerů.
- Krok vede jen přes vlastní rodiče a děti; vazba nevlastního a pěstounského rodiče se nepočítá. Zástupnou osobou krok
  projde, ve výsledku zástupná osoba není.
- **Rychlá volba** nastaví směry najednou; volba je zapnutá, jen když směry přesně odpovídají:

| Rychlá volba | Nahoru | Dolů | Do šířky | Manželé |
|---|---|---|---|---|
| **Nejbližší rodina** | 1 | 1 | + sourozenci | + manželé |
| **Předci** | všechny | 0 | jen přímá linie | jen pokrevní |
| **Potomci** | 0 | všechny | jen přímá linie | jen pokrevní |
| **Pokrevní příbuzní** | všechny | všechny | + bratranci všech stupňů | jen pokrevní |
| **Celá rodina se sňatky** | všechny | všechny | + bratranci všech stupňů | + rodiny manželů |
| **Po meči** | všechny přes otce | 0 | jen přímá linie | jen pokrevní |
| **Po přeslici** | všechny přes matku | 0 | jen přímá linie | jen pokrevní |

- Pod nastavením je podmínka slovy, např. „Rodina: {osoba}, 2 generace nahoru, 2 generace dolů“ nebo u rychlé volby
  „Nejbližší rodina: {osoba}“.
- Jediná podmínka **Rodina osoby** jen nahoru, nebo jen dolů (přes oba rodiče, jen přímá linie, jen pokrevní) se
  uloží jako pravidlo **Předci osoby** / **Potomci osoby**.
- **Ovládání:** podmínka **Rodina osoby** v katalogu; **Víc možností: rodina osoby…** u **Předci osoby** a
  **Potomci osoby** ([A11.2](#A11.2)); **Nabídka osoby → Přidat do seznamu › → Seznam z rodiny této osoby…**
  (rychlá volba **Nejbližší rodina**, [A11.5](#A11.5)).
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:src/lineage.ts familySet (seenUp, via v každém kroku, parentInRole, siblings osoby a předků v dosahu, cousins: potomci předků do degree + 1 v dosahu up, spouses / families: rodiče a sourozenci partnerů, zástupné ven, descentParents bez nevlastních a pěstounských), FAMILY_PRESETS, familyPresetOf · src/ui/person-list-rule-family.ts (FAMILY_GEN_MAX 10, FAMILY_COUSIN_MAX 5, pořadí rychlých voleb, nápověda slovy) · src/person-list-rules.ts customToRule (family → ancestors / descendants) · src/ui/person-list-add.ts LIST_FROM_FAMILY_ACTION (FAMILY_PRESETS.closest) · strings.ts lists.rules.family.*, preset.*, say.family, say.preset, contextMenu.listFromFamily · app:ffc7ff32, 007581af · spec 136 K1.1 -->

<a id="A11.2.7"></a>
### A11.2.7 Místo a okolí

**Místo a okolí** najde osoby, které mají vybranou událost v místě nebo v jeho okolí.

- **Události:** narození (i křest), úmrtí (i pohřeb), sňatek (místo začátku svazku), bydliště; výchozí všechny čtyři.
- Místo se vybírá z míst stromu (míst narození, úmrtí, sňatku a bydliště), nejdřív ta s nejvíc osobami.
- K místu patří i jeho domy (místo s číslem domu nebo ulicí téže obce); **včetně míst pod ním** (jen když záznam
  místa ve výzkumu má místa pod sebou) přidá i ta.
- **Okolí:** **jen místo**, **5 km**, **10 km**, **25 km**, **50 km**, nebo **jiné…** (výchozí 100 km, 1–500 km).
  Okolí bere každé místo stromu, jehož poloha na Mapě je do zvolené vzdálenosti od polohy místa (vzdušnou čarou).
- Nad místy je souhrn („V okolí {km} km: N míst · M míst stromu bez polohy“) a **Ukázat místa ›**: prvních 6 míst,
  pak „… a N dalších“; místa bez polohy jsou pod „Bez polohy (nezapočítána)“ s **Doplnit polohy na Mapě ›**.
- Místo bez polohy počítá jen podle názvu („Místo nemá polohu na mapě – jen podle názvu.“); vzdálenost pak nejde
  vybrat a výběr takového místa ji vrátí na **jen místo**. Strom bez poloh míst: „Strom nemá polohy míst – okolí jde
  použít po doplnění poloh na Mapě.“
- **Hranice:** okolí nejvýš 500 km. Místo bez polohy na Mapě se do okolí nepočítá.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:src/person-list-rules.ts NEAR_MAX_KM 500, placeIndexOf (birthPlace, baptism a birth; residence; startPlace svazku; deathPlace, burial a death), nearKeys (townKey: dům téže obce, below keysBelow, km > 0 haversineKm od geoOfKey), rulePlaceChoices (nejvíc osob první) · src/ui/person-list-rule-near.ts (KM_PRESETS 0/5/10/25/50, KM_OTHER 100, 6 míst a more, unplaced, noCoords, noneInTree) · strings.ts lists.rules.near.*, say.events · app:ffc7ff32, cbcb7673 · spec 136 K1.1 -->

<a id="A11.2.8"></a>
### A11.2.8 Jiný seznam

**Jiný seznam** vezme osoby jiného seznamu: u pevného jeho osoby, u automatického ty, které jeho pravidlo najde teď.

- Seznam, přes který by pravidlo vedlo zpět do upravovaného seznamu (i přes další seznamy), je ve výběru nedostupný
  s cestou kruhu: „vedlo by do kruhu: {A → B → A}“. Pravidlo s kruhem nejde uložit.
- Výběr má od 9 seznamů pole **Hledat**.
- Smazání seznamu, který jiný seznam používá, se nejdřív zeptá ([A11.3](#A11.3)); podmínka se pak ukáže jako
  „chybí“ ([A11.2.11](#A11.2.11)).
- **Hranice:** podmínka je v katalogu, jen když strom má víc než jeden seznam.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:src/person-list-rules.ts listCycle („A → B → A“), ruleIssues cycle, condSet list (listMembers, visiting), listUsedBy · src/ui/person-list-rule-cond-editors.ts list (available: víc než jeden seznam, hledání od 9) · strings.ts lists.rules.cycle, cond.list · spec 136 K1.7 -->

<a id="A11.2.9"></a>
### A11.2.9 Počty a Ukázat ve stromu

Sestavení pravidla ukazuje počty: každá podmínka a skupina vlastní počet osob v celém stromu, patička počet celého
pravidla („Vyhovuje: N osob“, nebo „Nevyhovuje nikdo“).

- Neúplná podmínka se do počtu celého pravidla nepočítá.
- Když pravidlo s **Platí všechny** nenajde nikoho, má položka, po které výsledek klesl na nulu, značku „tady 0“.
- Počty se přepočítají 120 ms po poslední změně. Když předchozí počítání trvalo déle než 200 ms, patička nejdřív ukáže
  „Počítá se…“ s předchozím počtem („dosud N osob“).
- **Ukázat ve stromu** (vedle počtu, jen když někdo vyhovuje a pravidlo jde uložit): dialog se skryje, nezavře; ukáže
  se pohled **Rodina** (z jiného pohledu se na něj přepne) se zvýrazněnými osobami pravidla a nadpisem „Náhled
  pravidla · N osob“. **Zpět k pravidlu**, × a Esc zvýraznění ukončí, vrátí předchozí pohled a ukážou dialog, jak byl.
- **Ovládání:** na telefonu **⋯** pravidla → **Ukázat ve stromu**.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:src/person-list-rules.ts evalRuleCounts (vlastní počet každé položky nad celým stromem, neúplné mimo celek, zeroAt jen u celku 0 a op all) · src/ui/person-list-rule-ui.ts RULE_COUNT_DEBOUNCE_MS 120, RULE_COUNT_SLOW_MS 200, ruleBuilderCountsBusy · src/ui/person-list-new-ui.ts newPersonListFootExtraHtml, newPersonListMoreRows (telefon), showNewPersonListInTree (skryté overlaye, setViewMode family, highlightGroup rulePreview), backToNewPersonList · strings.ts lists.rules.match, nobody, zeroHere, computing, previous, showInTree, preview, backToRule · app:ffc7ff32 · spec 136 K1.3, K1.4 -->

<a id="A11.2.10"></a>
### A11.2.10 Šablony seznamů

Šablona je připravené vlastní pravidlo. Nabízí se při zakládání nového seznamu: **Začít ze šablony ▾** vpravo na
řádku **Podle** (na telefonu **⋯** vlastního pravidla → **Začít ze šablony…**).

| Skupina | Šablona | Pravidlo |
|---|---|---|
| **Co ve výzkumu chybí** | **Předci bez pramene** | předci osoby a zároveň bez dokladu nebo pramene |
| | **Konce linií** | předci osoby a zároveň bez rodičů |
| | **Bez data nebo místa narození** | bez data narození nebo bez místa narození |
| | **Osoby s rozporem** | má rozpor (jen strom z výzkumu) |
| | **Rozpracované** | má otevřený úkol výzkumu (jen strom z výzkumu) |
| **Rodina a linie** | **Přímá linie po meči** | **Rodina osoby**, rychlá volba **Po meči** |
| | **Potomci do N generací** | potomci osoby, 3 generace |
| | **Z místa a okolí** | narození, úmrtí, sňatek nebo bydliště do 10 km od místa |
| | **Zemřelí v dětství** | věk při úmrtí do 5 let |
| **Vyprávění a sdílení** | **Předci bez fotky** | předci osoby a zároveň bez fotky |
| | **Žijící osoby** | žijící |
| | **Nově přidaní** | přidaní za posledních 7 dní |

- Nabídka **Šablony** má nahoře vlastní šablony (**Vlastní**), pak vestavěné po skupinách, bez počtů. Šablona, která
  potřebuje osobu nebo místo, má „vyžaduje osobu“ / „vyžaduje místo“. Šablona s podmínkou, kterou strom nenabízí
  ([A11.2.5](#A11.2.5)), v nabídce není.
- Volba šablony otevře vlastní pravidlo s jejími podmínkami a rovnou výběr první chybějící osoby nebo místa. Jméno
  seznamu je jméno šablony, po doplnění osoby nebo místa „{šablona} – {osoba}“, dokud se nepřepíše.
- Nad pravidlem stojí „Ze šablony: {šablona}“ a **Zrušit šablonu**: pravidlo se vyprázdní a jméno se zase řídí
  pravidlem.
- Pravidlo ze šablony jde upravit jako každé jiné. Seznam si pamatuje, ze které šablony vznikl ([A11.3](#A11.3));
  jméno vestavěné šablony je v jazyce aplikace.
- **Uložit jako šablonu…** (**⋯** vlastního pravidla) otevře dialog **Uložit jako šablonu** s polem **Jméno šablony**
  (výchozí jméno seznamu) a poznámkou „Osoby, místa a seznamy se v šabloně neukládají – doplní se při použití. Šablona
  se uloží v tomto zařízení a jde použít i v jiném stromu.“ Rody a linie výzkumu se také neukládají.
  - Obsazené jméno se orámuje: „Šablona s tímto jménem už je. Navrženo: „{jméno} (2)“.“; **Uložit** vezme navržené.
  - **⋯** vlastní šablony v nabídce: **Přejmenovat…** (dialog **Přejmenovat šablonu**), **Smazat** (oznámení
    „Šablona „{jméno}“ smazána.“ se **Zpět**).
- **Hranice:** šablony jen při zakládání nového seznamu, ne při úpravě pravidla ani u **Uložit jako seznam osob…**.
  Vlastní šablony patří zařízení (nastavení aplikace v tomto prohlížeči), ne stromu.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:src/person-list-templates.ts LIST_TEMPLATES (12, skupiny missing / family / story, research jen ve stromu z výzkumu), templateRoot, listTemplateName (vestavěná podle jazyka, app:29c57b0e) · src/person-list-rules.ts stripTemplateParams (osoby, místa, seznamy, rody, linie), makeListTemplate, ruleNeeds · src/ui/person-list-new-ui.ts offeredTemplates (ruleOffered), openNewPersonListTemplates, applyNewPersonListTemplate (origin template, otevře první chybějící), dropNewPersonListTemplate, openNewPersonListTemplateActions, openListTemplateNameDialog (freeTemplateName), newPersonListMoreRows · src/types.ts ListTemplate (nastavení listTemplates, ne strom) · strings.ts lists.templates.*, lists.new.fromTemplate · app:58ad425d, 7f13e899 · spec 136 K1.9 -->

<a id="A11.2.11"></a>
### A11.2.11 Chybějící osoba, místo nebo seznam v pravidle

Když ze stromu zmizí osoba, místo, seznam, rod nebo linie výzkumu, na které vlastní pravidlo odkazuje, pravidlo
zůstane a odkaz se ukáže jako „chybí“.

- Podmínka s chybějícím odkazem se počítá jako prázdná: nenajde nikoho, s „kromě“ neubere nikoho.
- V sestavení má podmínka „{jméno} – chybí“ a její **⋯** nabídne nejdřív **Vybrat jinou osobu…** (**Vybrat jiné
  místo…**, **Vybrat jiný seznam…**, **Vybrat jiný rod…**, **Vybrat jinou linii…**).
- Automatický seznam to řekne v přehledu („automatický · Pravidlo odkazuje na chybějící osobu“, …) a v detailu
  („Pravidlo odkazuje na chybějící osobu: {jméno} – podmínka se počítá jako prázdná.“) s **Upravit pravidlo…**.
- Sloučení osob: odkaz na odebranou osobu převezme ponechaná.
- Smazání seznamu, který jiný seznam používá, se nejdřív zeptá ([A11.3](#A11.3)); **Zpět** vrátí seznam i odkazy.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:src/person-list-rules.ts condMissing (person, place, list, rod, line), customMissing, chybějící odkaz = prázdná množina · src/ui/person-list-rule-ui.ts (gone, pickOther první v ⋯) · src/ui/person-lists-ui.ts listMissing (jen automatický), rowMeta is-warn, pl-note--warn s edit-rule · src/person-lists-data.ts onPersonsMerged (customWithPersonMerged) · strings.ts lists.rules.missing, gone, pickOther.*, missingRef.*, missingNote · app:c76a8954 · spec 136 K1.7 -->

<a id="A11.3"></a>
## A11.3 Správa seznamů: Seznamy osob

Všechny seznamy stromu jsou na jednom místě, v dialogu **Seznamy osob**: vlevo přehled, vpravo vybraný seznam.

- **Přehled:** každý seznam s ikonou druhu, jménem, počtem osob a řádkem pod jménem (**pevný · změněno …**,
  **automatický ·** pravidlo, **pracovní · zbývá a z b**). Řazení **Podle jména** nebo **Podle změny**. Od 9 seznamů
  je nad nimi pole **Hledat v seznamech** (bez ohledu na diakritiku).
- **Detail:** jméno (přejmenuje se na místě: klik, ✎ nebo F2; Enter uloží, Esc vrátí), štítek druhu, řádek pravidla
  (**Podle** / **Vznikl z**), souhrn ([A11.3.1](#A11.3.1)) a **Osoby v seznamu · N** s řazením ([A11.4](#A11.4)).
  U pevného seznamu × u osoby (**Odebrat ze seznamu**) a **Přidat osobu…** ([A11.5](#A11.5)). U osoby je podle
  řazení generace, datum přidání, nebo místo narození.
- Od aplikace 3.32.0 řekne řádek pravidla pravidlo slovy na nejvýš dva řádky (na telefonu čtyři), celé v popisku;
  na telefonu **Celé pravidlo ›** otevře dialog pravidla (ve stromu jen ke čtení rozbalí celý text). Vlastní pravidlo
  slovy: podmínky za sebou oddělené „ · “, každá po první se slovy „a zároveň“ nebo „nebo“, podmínky s „kromě“ na
  konci („kromě A nebo B“), skupiny v závorkách; např. „Předci: {osoba}, všechny generace · a zároveň bez dokladu
  nebo pramene“.
  - Pod pravidlem je, odkud seznam vznikl: „Ze šablony „{šablona}“ · {datum}“; u seznamu založeného ručně nic.
  - U seznamu s pravidlem je vedle **Upravit pravidlo…** / **Doplnit podle pravidla** i **Přidat podmínku…**
    ([A11.2.4](#A11.2.4)).
- **⋯ seznamu** (u řádku v přehledu i v detailu): **Otevřít v Tabulce**, **Na mapě** (od aplikace 3.31.0),
  **Přejmenovat**, **Duplikovat**,
  **Odškrtávat hotové** (pevný, [A11.8](#A11.8)) nebo **Zmrazit** (automatický, [A11.2.2](#A11.2.2)), **Exportovat ›**
  ([A11.9](#A11.9)), **Smazat**. Od aplikace 3.32.0 má seznam s pravidlem před nimi **Přidat podmínku…**
  ([A11.2.4](#A11.2.4)) a pevný seznam s pravidlem za **Odškrtávat hotové** i **Udržovat podle pravidla**
  ([A11.2.2](#A11.2.2)).
  - **Otevřít v Tabulce** zavře dialog a otevře Tabulku v rozsahu seznamu ([A6.7.19](A6-views.md#A6.7.19)).
  - **Na mapě** (i tlačítko vedle **Otevřít v Tabulce** v detailu) zavře dialog, nastaví seznam jako výběr okna
    ([A6.6](A6-views.md#A6.6)) a otevře Mapu s rozsahem **Výběr** ([A6.5.7](A6-views.md#A6.5.7)). V dalším okně to
    provede hlavní okno; bez něj je **Na mapě** nedostupné („Hlavní okno není otevřené.“).
  - **Duplikovat** udělá kopii stejného druhu se stejným pravidlem, pořadím, ručně odebranými i odškrtnutými, jménem
    „{jméno} (2)“.
  - **Smazat** se neptá: oznámení „Seznam „{jméno}“ smazán.“ s **Zpět**. Od aplikace 3.32.0 se zeptá, když seznam
    používá jiný seznam v podmínce **Jiný seznam**: „Smazat seznam „{jméno}“?“ s „Seznam má N osob; osoby ve stromu
    zůstanou.“ a „Používá ho: {seznamy}. Podmínka „Jiný seznam“ se v nich ukáže jako „chybí“.“ (nejvýš tři jména,
    pak „a další N“) a poznámkou „Smazání jde vrátit – vrátí seznam i odkazy na něj.“
- **Hranice:**
  - detail ukáže nejvýš 200 osob: „Ukázáno prvních 200 z N osob.“ s odkazem do Tabulky, kde jsou všechny;
  - každá změna seznamu je jeden krok **Zpět**; vznik (i duplikát), přejmenování, zmrazení a smazání mají zápis
    v historii změn;
  - v dalším okně aplikace ([A6.8](A6-views.md#A6.8)) se změna seznamu uloží přes hlavní okno.
- **Ovládání:** **Akce → Seznamy osob…**; na telefonu **Více → Seznamy osob**; v Tabulce **Rozsah ▾ → Spravovat
  seznamy…**. Klávesy v přehledu: ↑ ↓ výběr, Enter přejmenovat, Delete smazat, Esc zavře dialog. Na telefonu se
  přehled a seznam střídají na celé obrazovce (‹ **Zpět na seznamy**), **⋯** je panel zdola.
- **Platí od:** aplikace 3.30.0; 3.32.0: pravidlo slovy, původ seznamu, **Přidat podmínku…**, otázka před smazáním
  seznamu, který používá jiný seznam

<!-- zdroj: app:src/ui/person-lists-ui.ts (OVERLAY_ID person-lists-modal, SEARCH_FROM 9, LIST_DETAIL_ROWS 200, NARROW_QUERY, přejmenování klik/✎/F2, klávesy ↑↓ Enter Delete) · src/ui/person-list-hooks.ts listMenu (freezeAndChecklistRows, exportRows) · src/data.ts duplicatePersonList (structuredClone, suggestPersonListName), deletePersonList (Vrátit), storePersonList audit (personList.save, :2224 přejmenování, :2254 personList.delete, :2330 zmrazení) · index.html #actions-lists-row · src/ui/bottom-sheet.ts řádek Seznamy osob v listu Více · strings.ts menu.lists, lists.title, search, byName, byChange, changed, left, people, remove, addPerson, openTable, menu.*, large, back, toast.deleted, undo.*, audit.* · app:4acf7a09, 3dc8e709 · ZADANI_DEV §2, §16 (okna 079: WindowEditSink) · 3.31.0 Na mapě: src/ui/person-lists-ui.ts (tlačítko pl-onmap v detailu, ⋯ řádek map za open), src/ui/person-list-hooks.ts showOnMap, src/windows/window-show-on-map.ts, strings.ts lists.onMap, onMapTitle, table.onMapNoMain (app:2a578474, 39020cf1, ZADANI_DEV_vyber-osob §6) · 3.32.0: src/ui/person-lists-ui.ts (pl-rule-t s title, pl-rule-whole: edit-rule nebo whole-rule ve stromu jen ke čtení, listOriginText, add-condition, deletePersonList s listUsedBy: 3 jména a more, showConfirm danger s note), src/person-list-rules.ts customLabel (·, a zároveň / nebo, kromě na konci), src/person-lists.ts listRuleLabel, src/ui/person-list-hooks.ts freezeAndChecklistRows · strings.ts lists.wholeRule, origin.*, addCondition, deleteTitle, deletePeople, deleteUsedBy, deleteUsedNote · app:c76a8954, 5959ed63 · spec 136 K1.4, K1.7 -->

<a id="A11.3.1"></a>
### A11.3.1 Souhrn seznamu

Detail seznamu shrne jeho osoby v dlaždicích: **osob** · **narození** (nejstarší a nejmladší rok narození, bez roků
„–“) · **s fotkou** · **s dokladem** · **s vyprávěním**; pracovní seznam navíc nejdřív **zbývá**.

- **S dokladem** je osoba s aspoň jednou citací pramene u osoby, jejích údajů, událostí nebo svazků.
- Pod dlaždicemi je odkaz „N bez dokladu ›“: otevře Tabulku v rozsahu seznamu s čipem **Bez pramene**.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/person-lists.ts listSummary (birthMin/Max, photo, personEvidence sources > 0, story.text, noCite, left jen u pracovního) · src/ui/person-list-hooks.ts openInTable (noSource) · strings.ts lists.sum.* · app:211323e8 (Otevřít v Tabulce s čipem Bez pramene) · spec 084 K8.2 -->

<a id="A11.4"></a>
## A11.4 Řazení seznamu

Seznam má jedno z pěti řazení. Pořadí seznamu použije Tabulka (sloupec **#**) i export.

| Řazení | Pořadí |
|---|---|
| **Od nejstaršího** | podle data narození; bez data na konci |
| **Po generacích** | u seznamu z předků nebo potomků generace od osoby pravidla, jinak generace jako sloupec Tabulky; v generaci od nejstaršího |
| **Abecedně** | příjmení, pak jméno, podle jazyka aplikace |
| **Podle přidání** | od posledně přidaných; osoby bez údaje „přidáno“ na konci |
| **Ručně** | pořadí, které drží pevný seznam |

- **Ručně** má jen pevný seznam. U automatického je volba nedostupná: „Ruční pořadí má jen pevný seznam – Zmrazit“.
- Přepnutí na jiné řazení ruční pořadí nemaže; po návratu na **Ručně** platí, jak bylo. Nově přidaná osoba přijde
  na konec ručního pořadí.
- Každý přesun je jeden krok **Zpět**; čtečka obrazovky ho ohlásí („Přesun: … je na pozici 3 z 12.“).
- **Ovládání:** **Řazení: … ▾** nad osobami seznamu. Ruční pořadí: tažení řádku za úchyt (myš i prst), Esc tažení
  zruší; Alt+↑ / Alt+↓ na řádku; **⋯** osoby → **Posunout výš** / **Posunout níž**. Na telefonu úchyt není, jen **⋯**.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/person-lists.ts sortListIds (old birthKey, gen ruleGenerations / assignGenerations, name Intl.Collator, added sestupně bez data na konec, manual), withSort (automatický bez manual), withPersonMoved, withManualOrder, withPersonsAdded (na konec) · src/ui/person-lists-ui.ts úchyt, Alt+↑/↓, Esc · strings.ts lists.sortBy, sort.*, manualOff, handle, up, down, moved · app:3dc8e709 · ZADANI_DEV §5 -->

<a id="A11.5"></a>
## A11.5 Přidat do seznamu a odebrat

Osoba jde do pevného seznamu přidat z nabídky osoby, z Tabulky, z výsledků hledání a z detailu seznamu.
Automatický seznam se ručně nemění, nabídky ho proto nenabízejí („Automatické seznamy se plní samy podle
pravidla.“).

- **Nabídka osoby → Přidat do seznamu ›:** pevné seznamy podle poslední změny, nejvýš 8, pak **Další seznamy…**;
  seznam, ve kterém osoba je, má ✓ a klik ji z něj odebere. Pod nimi **Nový seznam s touto osobou…**: dialog
  nového seznamu ([A11.2](#A11.2)), volba **Prázdný** s touto osobou; pro **Předci osoby** a **Potomci osoby** je
  předvybraná tato osoba. Na telefonu druhá stránka panelu osoby. Od aplikace 3.32.0 je pod ním i **Seznam z rodiny
  této osoby…**: dialog nového seznamu s vlastním pravidlem **Rodina osoby** této osoby v rychlé volbě **Nejbližší
  rodina** ([A11.2.6](#A11.2.6)).
- **Tabulka:** nabídka řádku → **Přidat do seznamu ›** (osoba řádku; u svazku oba partneři, u události její osoby).
  Výběr přes více řádků: **Přidat N osob do seznamu ›** a **Nový seznam s těmito osobami…**. V rozsahu pevného
  seznamu je v nabídce řádku i **Odebrat ze seznamu** ([A6.7.19](A6-views.md#A6.7.19)).
- **Výsledky hledání → Výsledky do seznamu ›:** přidá všechny výsledky, ne jen ukázané, nebo založí **Nový seznam
  z výsledků (N)…** (pevný, jméno „Hledání: {dotaz}“).
- **Detail seznamu → Přidat osobu…:** výběr osob podle jména, více najednou; osoby už v seznamu jsou šedé
  („už v seznamu“).
- Osoba už v seznamu se nezdvojí („Všechny už v seznamu „{seznam}“ jsou.“). Odebraná osoba přestane být odškrtnutá.
- Odebrání má **Zpět** v oznámení.
- **Hranice:** ve stromu jen ke čtení tyto nabídky nejsou ([A11.1](#A11.1)).
- **Platí od:** aplikace 3.30.0; 3.32.0: **Seznam z rodiny této osoby…**

<!-- zdroj: app:src/ui/person-list-add.ts MENU_LISTS 8, addTargets (pevné podle updated), personListMenuRows (✓, Další seznamy…, Nový seznam s touto osobou…, poznámka), listMenuEntries (víc osob, bez zdvojení), showAddPersonsToList (PICK_ROWS 200, inList) · src/ui/context-menu.ts getPersonMenuActions (za Hledat v archivech) · src/ui/person-list-new-ui.ts:215 (personIds → volba Prázdný s osobami; jedna osoba = osoba pravidla předků a potomků) · src/ui/table-view/table-ui.ts showTableRowMenu (toListN, tableAreaRowKeys, svazek oba partneři) · src/ui/search.ts (Výsledky do seznamu, všechny výsledky) · src/person-lists.ts withPersonsRemoved (done ven) · strings.ts contextMenu.toList, newListWith, newListWithMany, autoListsNote, moreLists, table.act.toListN, search.toList, newFromResults, lists.save.searchName, inList, addN, toast.added, removed, addedN, allIn · app:68363dbe · ZADANI_DEV §4 · 3.32.0: src/ui/person-list-add.ts LIST_FROM_FAMILY_ACTION (FAMILY_PRESETS.closest), strings.ts contextMenu.listFromFamily (app:007581af, spec 136 §12) -->

<a id="A11.6"></a>
## A11.6 Uložit pohled jako seznam

Některé pohledy jdou uložit jako seznam: jen tam, kde výběr osob dává smysl.

| Odkud | Volba | Výchozí |
|---|---|---|
| Tabulka › Osoby | **⋯** Tabulky nebo nabídka **Pohled** → **Uložit jako seznam osob…** | pevný: osoby v pořadí řádků Tabulky |
| Tabulka › Svazky | **⋯** Tabulky → **Uložit jako seznam osob…** | pevný: oba partneři každého svazku, každá osoba jednou |
| výsledky hledání | **Výsledky do seznamu ›** ([A11.5](#A11.5)) | jen pevný |
| výběr okna | **Výběr ▾**, patička **Uložit výběr jako seznam…** (rod, předci, potomci, linie výzkumu; [A6.6.1](A6-views.md#A6.6.1)); do aplikace 3.30.0 jen rod: **Uložit rod {rod} jako seznam…** | automatický |
| linie výzkumu | **⋯** linie → **Uložit jako seznam…** | automatický |

- Z Tabulky se uloží osoby po filtru a řazení; dočasně ukázané řádky ne. Ukotvený řádek mimo filtr se neuloží
  („Ukotvený řádek mimo filtr (…) se neuloží.“).
- **Udržovat podle filtru** udělá automatický seznam s kopií dnešního filtru a řazení Tabulky. Pozdější změna
  pohledu Tabulky ho nezmění. **Upravit pravidlo…** takového seznamu otevře Tabulku s jeho filtrem a v **⋯** Tabulky
  nabídne **Uložit do seznamu {jméno}**.
- **Hranice:** Události, Prameny a pohledy Rodina, Potomci, Vějíř, Časová osa a Mapa se jako seznam neukládají.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/ui/person-list-new-ui.ts (SAVE_ID person-list-save; zdroje table/unions/search/rod/line, pinOut, keepFilter) · src/ui/table-view/table-ui.ts saveTableAsList, saveTableRule (lists.saveRule), canSaveAsList · src/ui/rod-view.ts (rodView.saveList) · src/ui/research-directions-ui.ts:1127 directionSaveListItem · src/person-lists.ts rulePersonIds tableFilter (unions: p1, p2) · strings.ts lists.saveAs, save.*, saveRule, rodView.saveList, research.dirSaveList · app:e09dcacb, 68363dbe, 211323e8 · ZADANI_DEV §6 · spec 084 K1.4, K6.3 a · 3.31.0: src/ui/selection-picker-ui.ts saveListOptions (rod, line, selection = předci/potomci), person-list-new-ui.ts dynamic pro rod/line/selection, strings.ts selection.saveList (app:61873988, ZADANI_DEV_vyber-osob §2) -->

<a id="A11.7"></a>
## A11.7 Kdy osoba přibyla: Přidáno za posledních 30 dní

Od aplikace 3.30.0 si strom u každé osoby pamatuje, kdy do něj přibyla. Údaj se ručně neupravuje a v kartě osoby se
neukazuje; používá ho pravidlo **Přidáno za období**, řazení **Podle přidání**, sloupec **Přidáno** v Tabulce
([A6.7.2](A6-views.md#A6.7.2)) a seskupení v Tabulce ([A6.7.20](A6-views.md#A6.7.20)).

- **Kdy se zapíše:**
  - nová osoba v aplikaci: čas vzniku (zástupná osoba, až když z ní je skutečná osoba);
  - načtení souboru GEDCOM: den načtení;
  - sloučení stromů: čas sloučení u osob, které do stromu přišly; sloučená osoba si nechá dřívější údaj;
  - nová osoba z výzkumu: datum, které k ní uvádí výzkum, jinak čas načtení.
- Osoby z doby před 3.30.0 údaj nemají (v detailu seznamu, ve sloupci **Přidáno** a ve skupinách Tabulky „dříve“); nic
  se nedopočítává.
- **Přidáno za posledních 30 dní** je připravený automatický seznam každého stromu, i nového a načteného. Období jde
  změnit (**Upravit pravidlo…**); jméno se pak mění s obdobím, dokud se nepřejmenuje. Smazaný se už nevrátí.
  Prázdný říká „Zatím nic – údaj o přidání se zapisuje od verze 3.30.“
- **Hranice:** GEDCOM údaj nenese. Export s ochranou žijících ho u žijících vynechá ([A7.2](A7-book-pages-and-export.md#A7.2)).
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/data.ts:2636 createPerson (addedAt, ne zástupná), :2847 zástupná osoba při první úpravě, :5435 mergePersons earlierAddedAt · src/ged-parser.ts:6594 stampAddedAt(origin.at) · src/merge/executor.ts:573 (mergedAt), :1962 · src/person-lists-data.ts builtinAdded30, personListsOf (i nový strom a import, personListsDropped), keepPersonListData, stampResearchTree (research.added nebo now) · src/person-lists.ts listDisplayName (jméno podle období do přejmenování) · src/ui/person-lists-ui.ts:41 ADDED_SINCE '3.30', :534 lists.earlier · src/ui/table-view/table-group.ts:238 · src/privacy.ts:373 (stripDetails žijících: delete addedAt) · strings.ts lists.builtin.added30, addedNone, earlier · ZADANI_DEV §8, Q3 · app:714a8ab2 · sloupec Přidáno app:0971647c (table.earlier) -->

<a id="A11.8"></a>
## A11.8 Pracovní seznam: Odškrtávat hotové

Pevný seznam jde použít jako pracovní: u každé osoby je zaškrtávátko a hotové osoby se odškrtnou.

- Hotová osoba je v detailu přeškrtnutá. Nad osobami je **Vše** / **Zbývá N** / **Hotovo N**, v přehledu „zbývá a
  z b“ a v souhrnu dlaždice **zbývá**.
- Odškrtnutí patří seznamu, ne osobě: duplikát seznamu ho převezme, jiný seznam ne. Odebraná osoba přestane být
  odškrtnutá.
- Vypnutí **Odškrtávat hotové** odškrtnutí nemaže; po dalším zapnutí jsou zpět.
- Odškrtnutí je krok **Zpět**, bez oznámení.
- V Tabulce v rozsahu pracovního seznamu je sloupec **Hotovo** a čipy **Zbývá** a **Hotovo** ([A6.7.19](A6-views.md#A6.7.19)).
- **Hranice:** automatický seznam odškrtávat nejde. Ve stromu jen ke čtení jsou hotové osoby vidět bez zaškrtávátek.
- **Ovládání:** **⋯** pevného seznamu → **Odškrtávat hotové** (✓); zaškrtávátko klikem nebo mezerníkem.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/person-lists.ts withChecklist (vypnutí drží done), withDoneToggled, withPersonsRemoved (done ven), listSummary left · src/data.ts duplicatePersonList (done převezme) · src/ui/person-lists-ui.ts zaškrtávátka, segment · strings.ts lists.menu.work, filter.*, left, sum.left, table.col.done, table.chip.left, chip.done · app:3dc8e709, 211323e8 · ZADANI_DEV §13 · spec 084 K8.4 -->

<a id="A11.9"></a>
## A11.9 Export seznamu

Seznam jde vyvézt dvěma cestami: jako část stromu (GEDCOM, záloha JSON), nebo jako tabulku (CSV).

- **Dialog Export → Co exportovat → Seznam osob:** volba **Seznam** nabízí seznamy otevřeného stromu, které mají
  osoby. **Export GEDCOM** pak nese osoby seznamu a rodiny mezi nimi, **záloha JSON** data stromu zúžená na osoby
  seznamu. Ochrana žijících a obsah souboru platí jako u celého stromu ([A7.2](A7-book-pages-and-export.md#A7.2),
  [A7.3](A7-book-pages-and-export.md#A7.3)). Ostatní formáty jsou nedostupné: „Tento formát exportuje celý strom“.
  Volba se pamatuje; seznam, který zmizel, vrátí volbu na **Celý strom**.
- **⋯ seznamu → Exportovat ›:**
  - **GEDCOM…** otevře dialog Export na tomto seznamu;
  - **CSV (pořadí seznamu)** stáhne hned tabulku osob seznamu v jeho pořadí: sloupce, jak je má Tabulka › Osoby, před
    nimi **#** (a **Hotovo** u pracovního seznamu). Soubor `{strom}_{seznam}_{RRRR-MM-DD}.csv`.
- **Seznamy v exportu:** záloha JSON celého stromu nese seznamy celé. Export části stromu (seznam, **Jen aktuální
  pohled**) nechá v pevných seznamech jen osoby té části; seznam, ve kterém nikdo nezbyl, vypustí. Automatické
  seznamy zůstanou celé, jejich pravidlo počítá s tím, co část má.
- Jména seznamů zůstávají v exportu i s ochranou žijících.
- **Hranice:** GEDCOM seznamy nenese, ani u celého stromu. Exportovaná stránka HTML seznamy jen ukazuje a otevře
  v Tabulce.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:src/ui/import-export.ts exportableLists (jen s osobami, podle jména), scope 'list' (neplatný seznam → tree), exportScopeList, exportPersonListJSON (exportFocusedJSON), GEDCOM podstrom (:389), option.disabled scopeWholeOnly · src/subtree.ts:153 subsetForSubtree · src/person-lists-data.ts subsetForSubtree (pevný zúžit, prázdný ven, automatický celý) · src/ui/table-view/table-ui.ts:3215 exportPersonListCsv (leadColumnsOf: # a Hotovo, shownColumns persons, tableCsvFileName) · src/ui/person-list-hooks.ts exportRows (jen seznam s osobami) · strings.ts exportMenu.scopeLabel, scopeList, listPick, backupListDesc, gedcomListDesc, scopeWholeOnly, scopeView, lists.menu.export, export.ged, export.csv · app:33fa6cd4 · dirigent:MILAN.md 35 (4) jména seznamů v exportu zůstávají -->

<a id="A11.10"></a>
## A11.10 Seznamy v datech stromu

Seznamy jsou součástí stromu (verze dat 22): jdou se stromem do zálohy a přenosu a každá jejich změna má krok
**Zpět**.

- **Smazaná osoba** zmizí ze všech seznamů, pořadí ostatních zůstane. Oznámení smazání to řekne („Osoba … smazána,
  odebrána i z 2 seznamů.“); **Zpět** ji vrátí i do seznamů.
- **Sloučené osoby:** místo odebrané osoby převezme ponechaná; jsou-li v seznamu obě, zůstane jednou na dřívější
  pozici. Je hotová, když byla hotová kterákoli; ručně odebraná, jen když byly odebrané obě. Od aplikace 3.32.0
  převezme ponechaná osoba i odkazy vlastních pravidel.
- **Strom z výzkumu** si seznamy a údaje „přidáno“ při načtení nové verze z výzkumu ponechá, od aplikace 3.32.0 i
  vlastní pravidla, původ seznamů a čas změny osob.
- Od aplikace 3.32.0 (verze dat 26) nese seznam i vlastní pravidlo a svůj původ (šablona) a osoba čas poslední změny
  (pro **Změněno za období**).
  - Seznam s vlastním pravidlem má uložené i osoby, které pravidlo našlo při posledním uložení; aplikace, která
    vlastní pravidlo nezná, ho proto ukáže jako pevný seznam s těmito osobami.
  - Vlastní pravidlo, které aplikace celé nepřečte (z novější verze), si nechá beze změny a seznam drží jako pevný
    s uloženými osobami; aplikace, která pravidlo přečte, ho zase použije.
  - Vlastní šablony ve stromu nejsou ([A11.2.10](#A11.2.10)).
- **Hranice:** starší aplikace (od 3.19.0) otevře strom se seznamy jen ke čtení a neuloží ho, aby seznamy nezahodila
  ([A6.7.7](A6-views.md#A6.7.7)). Strom uložený aplikací 3.32.0 (verze dat 26) otevře starší aplikace jen ke čtení.
- **Platí od:** aplikace 3.30.0; 3.32.0: vlastní pravidlo, původ seznamu a čas změny osoby v datech (verze dat 26)

<!-- zdroj: app:src/types.ts STROM_DATA_VERSION 22 (seznamy, addedAt; app:714a8ab2) · src/data.ts:436 sanitizePersonLists při načtení · src/person-lists-data.ts onPersonDeleted, onPersonsMerged, keepPersonListData · src/research-link.ts:1903 keepPersonListData · strings.ts lists.toast.personDeleted · src/tree-manager.ts isTreeNewer, src/data.ts isNewerData · app:714a8ab2 · ZADANI_DEV „Data a rozhraní“, §16a, §16b · 3.32.0: src/version.ts v26 (PersonList.custom, origin, customUnknown, Person.changedAt aditivně; vlastní pravidlo dynamic false s personIds), src/person-lists-data.ts sanitizeCustomRule (celé, nebo customUnknown), withCustomSnapshot, onPersonsMerged, keepPersonListData (custom, origin, changedAt), src/types.ts ListTemplate v nastavení · app:5b16c6fc, efc14cff · spec 136 K1.8 -->
