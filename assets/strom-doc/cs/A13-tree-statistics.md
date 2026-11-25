<a id="A13"></a>
# A13 Statistiky stromu

Okno **Statistiky** spočítá, jak často se ve stromu opakují jména, místa, povolání, věk a narození. Každé téma je
úplná tabulka hodnot s počtem a podílem, za vybraný rozsah osob a období narození. Klik na hodnotu ukáže její osoby
v Tabulce, tabulka jde uložit jako CSV. Kapitola popisuje aplikaci Strom 3.32.0; změny z novější verze mají u sebe
její číslo.

<!-- zdroj: dirigent:spec/138-podrobne-statistiky-stromu · app:d77da992 src/tree-stats.ts · f9722722 src/ui/tree-stats-ui.ts · 6f5412e3 · 417490db · 2723a543, e5723bf2, e1eae544 · 6c3b7e61 · strings.ts treeStats.* · dirigent:prace/1123-app-138-statistiky -->

<a id="A13.1"></a>
## A13.1 Okno Statistiky

Okno **Statistiky: <strom>** má vlevo témata ve skupinách a vpravo tabulku vybraného tématu. Nad tabulkou je
**Rozsah** ([A13.3](#A13.3)) a volby tématu, pod ní součty a poznámky, jak se počítá.

- **Kde se otevře:**
  - **Akce › Strom › Statistiky** (hned pod **Přehled stromu**);
  - ve Správě stromů v nabídce ⋯ u stromu, ve skupině s **Přehled stromu**, **Kvalita dat**, **Zálohy**, **Historie
    sloučení** a **Historie změn** ([A14.1](A14-trees-and-structure.md#A14.1));
  - na telefonu **Více › Pohled › Statistiky**; okno začne na tlačítku **Téma**, téma a rozsah se volí v listu
    zespodu;
  - odkaz **Podrobně** v **Přehled stromu**: u detailu rodu (**Křestní jména** s rozsahem toho rodu), u **Věk při
    úmrtí** (**Věk dožití**), u **Děti na pár podle generací** (**Počet dětí na pár**), u **Narození podle měsíců**
    (**Narození v čase** po měsících) a u **Nejčastější mužská jména** / **Nejčastější ženská jména** (**Křestní
    jména** mužů, žen).
- Nejdřív se spočítá vybrané téma, pak počty ostatních témat v seznamu vlevo; téma, které se ještě počítá, ukáže
  „Počítá se…“. Změna dat otevřeného stromu spočítá tabulky znovu.
- Tabulka má sloupce hodnoty, **Počet** a **Podíl**. Řazení **Podle počtu**, **Abecedně**; u věku, období a
  počtu dětí **Podle věku**, **Podle období**, **Podle počtu dětí** (seskupené hodnoty jsou výchozí podle
  hodnoty). Pole hledání („Hledat jméno…“, „Hledat příjmení…“, „Hledat místo…“) zúží řádky bez ohledu na velikost
  písmen a diakritiku; řádek **Neuvedeno** se při hledání skryje.
- Pod tabulkou součty: „Celkem 312 osob · 48 hodnot“; u věku „… se známým věkem“, u párů „Celkem 120 párů …“, u
  sňatků „Celkem 95 sňatků …“.
- **Hranice:** uložená stránka (export HTML) Statistiky ani odkazy **Podrobně** nemá. Strom, který není otevřený
  (okno ze Správy stromů u jiného stromu), statistiky spočítá, ale osoby v Tabulce neukáže („Strom není otevřený –
  osoby se v Tabulce ukázat nedají.“).
- **Ovládání:** viz **Kde se otevře**; **Zavřít** nebo Esc.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:f9722722 src/ui/tree-stats-ui.ts (skupiny témat, tabulka, řazení, hledání, součty, poznámky) · 417490db (Akce › Strom pod Přehledem, list stromu, Správa stromů, čtvrtá dlaždice Zobrazení v listu Další na telefonu, nic v exportované stránce; telefon začíná na tlačítku Téma) · src/ui/tree-overview.ts treeOverviewStatsLink (rod-show firstNames rodId, deathAge, childrenPerCouple, births months, firstNames sex male/female; '' v režimu prohlížení) · src/tree-stats.ts defaultSort, isValueTopic · src/ui/tree-actions.ts treeActionGroups (overview) · strings.ts treeStats.menu, title, groups, topics, sort, search, none, total, readOnly, overview.more, phone.*; treeOverview.deathAgeTitle, childrenByGen, birthsByMonth, topMaleNames, topFemaleNames -->

<a id="A13.2"></a>
## A13.2 Témata a jak se počítají

Každé téma vypíše všechny hodnoty, které někdo v rozsahu má, ne jen nejčastější. Jednotka bez hodnoty je v řádku
**Neuvedeno**. Podíl je z jednotek s uvedenou hodnotou.

| Skupina | Téma | Počítá | Volby |
|---|---|---|---|
| Jména | **Křestní jména** | osoby | **Pohlaví** (**Muži**, **Ženy**, **Neuvedené**; výchozí muži), **Počítat** (**První jméno** / **Každé jméno**) |
| | **Příjmení** | osoby | **Příjmení** (**Rodné** / **U žen i po sňatku**) |
| Místa | **Místa narození**, **Místa úmrtí** | osoby | **Úroveň** (**Obec**, **Okres**, **Země**) |
| | **Místa sňatku** | sňatky | **Úroveň** |
| Život | **Povolání**, **Vyznání** | osoby | – |
| | **Věk dožití**, **Věk při prvním sňatku**, **Věk při prvním dítěti** | osoby, po pětiletých skupinách | – |
| | **Počet dětí na pár** | páry | – |
| Čas | **Narození v čase** | osoby | **Seskupit** (**Po desetiletích** / **Po měsících**) |

- **Hlídá kód:**
  - počítají se jen skutečné osoby, nikdy zástupné osoby, ani jako partneři nebo děti páru;
  - jednotka se u jedné hodnoty počítá jednou. Osoba s více povoláními se počítá u každého z nich;
  - **Každé jméno**: osoba s více jmény („Jan Karel“) se počítá u každého, součet podílů je přes 100 %;
    jméno se spojovníkem je jedno jméno;
  - **Příjmení**: mužský a ženský tvar jednoho příjmení se počítají spolu, podle pravidel tvarů stromu
    ([A4.5](A4-surnames-and-families.md#A4.5)). **U žen i po sňatku** počítá vdanou ženu u rodného příjmení
    i u příjmení po sňatku; součet je pak víc než počet osob;
  - místa: stejné místo psané různě se počítá jednou (sjednocená místa), hodnota má počet zápisů a bublinu
    „Zapsáno jako: …“. Strom bez hierarchie míst počítá obce („Strom bez hierarchie míst počítá obce: ulice a čísla
    domů patří k obci.“) a volbu **Úroveň** nemá. S místy, která určil výzkum ([R4.2](R4-places.md#R4.2)), jde
    počítat okresy a země; místo bez nich je „bez určeného okresu“, „bez určené země“;
  - věk je v celých letech z data narození a data události, po pětiletých skupinách, nahoře „100 a více“.
    **Neuvedeno** jsou žijící a osoby bez obou dat;
  - **Počet dětí na pár**: pár s aspoň jedním partnerem v rozsahu, děti bez zástupných osob, nahoře „10 a více“.
    **Místa sňatku** stejně: sňatek, kde je v rozsahu aspoň jeden partner;
  - rok narození se bere i z odhadu („asi 1820“ se počítá k 1820).
- **Hranice:** téma, které nikdo nemá, řekne proč („Ve stromu nikdo nemá zapsané povolání.“).
- **Ovládání:** okno **Statistiky** → téma vlevo (na telefonu **Téma**); volby nad tabulkou.
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:d77da992 src/tree-stats.ts (sdílená pravidla: zástupné nikdy, jednotky osoby/páry/sňatky, pár a sňatek v rozsahu s aspoň jedním partnerem, všechny hodnoty bez top N, Neuvedeno, podíl count/known), DEFAULT_STATS_OPTIONS (sex male, names first, surnames birth, level town, births decade), jména: slova, spojovník jedno slovo, příjmení: mužský a ženský tvar pod mužským klíčem, místo: klíč skupiny míst, jinak obec (ulice a čísla domů k obci), nejčastější zápis · src/ui/tree-stats-ui.ts volby jen u firstNames, surnames, místa s hasLevels, births · strings.ts treeStats.topics, desc, opt, ageGroup, ageTop, childrenTop, note.real, share, ages, ageNone, births, occupations, couples, surnames, withMarried, each, places, placesTown, placesLevel, noDistrict, noCountry, formsTip, empty.* -->

<a id="A13.3"></a>
## A13.3 Rozsah a období narození

Statistiky počítají osoby zvoleného **Rozsahu**, volitelně jen narozené v zadaném období.

- **Rozsah:** **Celý strom**, **Rod…**, **Přímá linie osoby…** (předci, potomci a osoba sama, jako
  [A4.8.2](A4-surnames-and-families.md#A4.8.2)), **Seznam osob…** ([A11](A11-lists-of-people.md)). Výběr má pole
  „Hledat rod, osobu, seznam…“.
- **Období narození:** **Narození od** a **do** (rok). Osoby bez roku narození při zvoleném období vypadnou; okno
  řekne kolik („12 osob bez roku narození je mimo období.“). Rok musí být číslo a „od“ nejvýš „do“, jinak „Rok jako
  číslo, „od“ nejvýš „do“.“. **Zrušit období** ho zruší.
- **Hranice:** rozsah a období platí, dokud se okno nezavře, stejně jako téma, volby, řazení a hledání; nic se
  neukládá do stromu ani do nastavení. Další otevření začne celým stromem. Z odkazu
  **Podrobně** u rodu začne okno tím rodem. Rozsah, který mezitím zmizel (smazaný seznam), je prázdný.
- **Ovládání:** okno **Statistiky** → **Rozsah** (na telefonu list **Rozsah**).
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:d77da992 src/tree-stats.ts StatsScope (výběr okna nebo přímá linie), scopePeople (skutečné osoby, s obdobím počet bez roku narození, zmizelý výběr prázdný) · 6c3b7e61 přímá linie přes directLineIds rozsahu hledání · f9722722 src/ui/tree-stats-ui.ts (rozsah a období jen v okně) · strings.ts treeStats.scope.label, tree, treeSub, rodMore, directMore, directSub, listMore, search, from, to, periodSec, periodHint, outOfPeriod, invalid, clearPeriod -->

<a id="A13.4"></a>
## A13.4 Z hodnoty do Tabulky

Klik na řádek tabulky („Ukázat 14 osob v Tabulce“) otevře Tabulku ([A6.7](A6-views.md#A6.7)) s osobami té hodnoty.

- Tabulka ukáže celý strom zúžený jedním štítkem na začátku řady štítků: „Statistiky: křestní jméno Jan · rod
  Horák“. Na telefonu je štítek v samostatném řádku pod lištou a počítá se do **Filtry**.
- U páru a sňatku se ukážou oba partneři.
- **Zpět do Statistik** vrátí okno, jak bylo (téma, volby, rozsah, období).
- × u štítku nebo **Zrušit filtry** štítek zruší. Štítek se nikdy neuloží do pohledu, rozpracované práce ani do
  pravidla seznamu.
- **Uložit jako seznam osob** uloží právě ukázané osoby jako pevný seznam pojmenovaný podle štítku
  ([A11.6](A11-lists-of-people.md#A11.6)).
- **Hranice:** jen u otevřeného stromu ([A13.1](#A13.1)).
- **Ovládání:** řádek tabulky (klik, Enter).
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:6f5412e3 (klik na hodnotu → Tabulka celého stromu se štítkem „Statistiky: … · rozsah“ první v řadě, na telefonu vlastní řádek pod lištou a počítá se do Filtrů, × nebo Zrušit filtry, Zpět do Statistik vrátí okno, štítek se neukládá do pohledu, práce ani pravidla, Uložit jako seznam osob = pevný seznam pojmenovaný podle štítku) · src/tree-stats.ts (pár a sňatek: klik ukáže oba partnery) · strings.ts treeStats.rowTitle, table.chip, table.back, chipWhat.*, readOnly -->

<a id="A13.5"></a>
## A13.5 Export CSV

**Export CSV** v patě okna uloží tabulku tématu, jak ji okno ukazuje: s volbami, rozsahem, obdobím i hledáním.

- Soubor má první řádek s popisem („Statistiky: Křestní jména – muži, první jméno · Rozsah: rod Horák · Strom:
  Horákovi · 24. 11. 2026“, s hledáním i „hledání „Jan““), pak sloupce **Hodnota**, **Počet**, **Podíl %**,
  řádek **Neuvedeno** (ne při hledání) a **Celkem**. Oddělovač je středník, kódování UTF-8.
- Po uložení hláška „Uloženo: <soubor>“. Nic se neposílá ven; soubor zůstane na zařízení.
- **Hranice:** prázdná tabulka nemá co uložit („Není co uložit“); dokud se tabulka počítá, tlačítko čeká („Uloží
  tabulku, až se dopočítá“).
- **Ovládání:** okno **Statistiky** → **Export CSV** (na telefonu ikona v záhlaví).
- **Platí od:** aplikace 3.32.0

<!-- zdroj: app:f9722722 src/ui/tree-stats-ui.ts exportTreeStatsCsv, src/tree-stats.ts statsCsv (BOM, středník, Neuvedeno jen bez hledání, Celkem) · src/ui/tree-stats-ui.ts export (popisný řádek desc, hlavička head, none, total, toast) · strings.ts treeStats.export.btn, what, waiting, nothing, head, none, total, desc, search, toast, phone.exportAria -->
