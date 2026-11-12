<a id="A6"></a>
# A6 Pohledy a výběr osob

Jak aplikace Strom vybírá, které osoby ukáže, a jak je ukazují jednotlivé pohledy. Popisuje aplikaci 3.21.2; změny z novější verze mají u sebe její číslo.

Pohled je jiné čtení **téhož výběru osob**. Výběr určuje ústřední osoba (ta, na kterou se klikne) a hloubka
**Předci** a **Potomci**. Rodina, Potomci, Časová osa a Mapa ukazují stejné okolí ústřední osoby. Vějíř si
předky a potomky počítá sám podle počtu generací ([A6.4](#A6.4)). Tabulka ukazuje celý strom ([A6.7](#A6.7)).

Pohledy: **Rodina**, **Potomci**, **Časová osa**, **Vějíř**, **Mapa**, **Tabulka**.

<!-- zdroj: app:src/types.ts:1237 ViewMode · strings.ts viewModeSwitch.* · Tabulka od aplikace 3.27.0 (viewModeSwitch.table) -->

<a id="A6.1"></a>
## A6.1 Okolí ústřední osoby v pohledu Rodina

Pohled Rodina ukazuje ústřední osobu v její rodině, ne celý strom.

- Do výběru patří:
  1. ústřední osoba a všichni její partneři;
  2. její potomci do hloubky **Potomci**, s partnery;
  3. přímí předci přes oba rodiče do hloubky **Předci**;
  4. sourozenci, i nevlastní (jejich druhý rodič se nepřidává), s partnery a potomky do hloubky Potomci;
  5. tety a strýcové (sourozenci rodičů) s partnery;
  6. bratranci a sestřenice, tedy děti tet a strýců zapsané v jejich svazku, s potomky do hloubky Potomci.
- **Hranice:** předci partnera ústřední osoby se do výběru nepřidávají nikdy. Kdo do okolí nepatří, ve stromu
  zůstává, jen ho pohled neukazuje; ukáže ho nová ústřední osoba.
- **Hloubka:** po výběru nové ústřední osoby je Předci i Potomci nastavená na největší hloubku, kterou strom u té
  osoby má. Nabídka dává 1 až tuto největší hloubku. Děti partnera z jiného svazku přidávají jednu generaci dolů.
- **Ovládání:** klik na kartu osoby; volby **Předci** a **Potomci** v liště pohledu.
- **Platí od:** aplikace 1.0.0

<!-- zdroj: app:src/layout/pipeline/1-select-subgraph.ts selectSubgraph · src/layout/pipeline/index.ts:962 includeSpouseAncestors: false · src/renderer.ts:719 computeTreeLayout, setFocus (maxGenerations) · src/focus-depth.ts maxAncestorDepth, maxDescendantDepth · strings.ts focus.ancestorsLabel, focus.descendantsLabel -->

<a id="A6.1.1"></a>
### A6.1.1 Výchozí osoba a pohled

S čím se strom otevře, určuje nastavení stromu **Výchozí osoba a pohled**.

| Volba | Možnosti |
|---|---|
| osoba | **Naposledy zobrazená** · **Konkrétní osoba:** (vybraná) |
| pohled | **Rodina** · **Naposledy použitý** (na tomto zařízení) |

- **Hranice:** bez nastavení se strom otevře na první osobě stromu. Obnovení stránky drží strom, pohled
  i ústřední osobu.
- **Ovládání:** správa stromů, u stromu **Výchozí osoba a pohled**.
- **Platí od:** výchozí osoba aplikace 1.0.0; volba pohledu a obnovení stránky aplikace 3.21.0

<!-- zdroj: app:src/renderer.ts:1178 findDefaultFocusPerson, getStartupFocus · strings.ts treeManager.defaultPersonViewTitle, focus.defaultPersonLastFocused, focus.defaultPersonSpecific, focus.defaultViewFamily, focus.defaultViewLast · CHANGELOG.cs.md 3.21.0 -->

<a id="A6.1.2"></a>
### A6.1.2 Rozestupy: Normální a Husté

Volba **Rozestupy** určuje mezery mezi kartami a mezi generacemi v pohledech Rodina a Potomci. **Husté** je zmenší,
takže se na obrazovku vejde víc osob. **Normální** je výchozí, i na telefonu.

| Mezera | Normální | Husté |
|---|---|---|
| mezi kartami vedle sebe | 31 px | 20 px |
| mezi generacemi | 80 px | 48 px |
| mezi partnery | 18 px | 14 px |

- Po přepnutí se strom hned překreslí a zůstane na stejné osobě: na kartě ústřední osoby, když je celá vidět, jinak
  na kartě nejblíž středu. Stejně se strom chová po změně **Detail karet**.
- **Pořadí sňatku:** v Husté je místo pilulky „1. ∞ 1866“ jen krátké „∞ 1“ na okraji karty, tedy pořadí tohoto
  sňatku. Celé pořadí ukáže bublina (myší, klávesnicí i klepnutím). Pilulka, pro kterou u karty není místo, se
  nekreslí.
- **Export:** export plakátu má vlastní volbu **Rozestupy** (za formátem papíru a orientací). Když se liší od
  obrazovky, obrázek, plakát i PDF po listech se rozloží znovu s vybranými rozestupy, se stejným výběrem osob a
  stejnými kartami; obrazovka se nemění. Pod každou volbou je počet listů („26 listů A4“), když se počty liší. Tisk
  (Ctrl+P) bere rozestupy obrazovky.
- **Hranice:** volba patří zařízení, se stromem se neukládá. Časová osa, Vějíř, Mapa a Tabulka mají vlastní
  rozložení a volba se jich netýká; export plakátu z Vějíře a Časové osy řádek **Rozestupy** nemá.
- **Ovládání:** **Nastavení** → **Karta osoby** → **Rozestupy** (za **Detail karet**): **Normální** · **Husté**. Na malé
  obrazovce bez kompaktní karty stojí pod volbou „Na malé obrazovce pomůže i Kompaktní karta.“ Export: **Export
  plakátu** → **Rozestupy**.
- **Platí od:** aplikace 3.27.0

<!-- zdroj: app:src/types.ts TreeSpacing, DEFAULT_LAYOUT_CONFIG (31/80/18), DENSE_LAYOUT_CONFIG (20/48/14), layoutConfigFor · src/settings.ts getTreeSpacing/setTreeSpacing (treeSpacing), getPosterSpacing/setPosterSpacing (posterSpacing), výchozí normal · src/renderer.ts:804 STANDALONE_VIEWS (timeline, fan, map, table), getPosterLayout({spacing}), kotva překreslení (ústřední karta celá v obraze, jinak nejbližší středu; i při změně typu karty) · src/marriage-order.ts (husté: „∞ N“ na okraji karty, bez místa se nekreslí) · src/ui/export-image-ui.ts (řádek za formátem a orientací, skrytý u vějíře a časové osy, sheetsCount) · strings.ts spacing.label, normal, dense, desc, scope, scopeExport, smallHint, marriageOrder.short, poster.menu, poster.sheetsCount, settings.groupCard, cardDensity.settingLabel · commity 68b9dde4, 03918007, 928db183, e2891a8a · spec 069 K1.1, K3.1 -->

<a id="A6.2"></a>
## A6.2 Pohled Potomci

Pohled Potomci ukazuje jen ústřední osobu a její potomky do hloubky Potomci: bez předků, tet, strýců
a bratranců.

- **Jen pokrevní** (výchozí): pokrevní potomci ústřední osoby.
- **Úplné rodiny**: navíc další svazky partnerů a jejich nevlastní děti, znevýrazněně.
- **Ovládání:** přepínač v liště pohledu; výchozí volbu drží nastavení **Pohled Potomci**.
- **Platí od:** pohled aplikace 1.4.0; Úplné rodiny aplikace 1.9.2

<!-- zdroj: app:src/layout/pipeline/index.ts includeAuntsUncles: !descendantsOnly, expandLineageOnly: descendantsOnly && !isDescendantsFullFamilies() · strings.ts viewModeSwitch.bloodOnly, viewModeSwitch.fullFamilies, viewModeSwitch.settingLabel · settings descendantsFullFamilies (výchozí false) -->

<a id="A6.3"></a>
## A6.3 Časová osa

Časová osa ukazuje osoby pohledu jako pruhy života na ose let.

- Řádek dostane jen osoba s rokem narození. Ostatní pohled spočítá a napíše „N osoby bez roku narození nejsou
  zobrazeny“. Zástupné osoby (prázdné místo pro neznámého rodiče) se vynechávají.
- Pořadí řádků: rok narození, pak jméno bez titulů.
- Pruh žijící osoby sahá do dneška. Zemřelá osoba bez data úmrtí má pruh do poslední známé události a otevřený
  konec.
- Rok sňatku se bere z data začátku svazku. Osa je zaokrouhlená na desetiletí.
- Pod osou let běží řádek dějin ústřední osoby (události doby a míst jejího života, symboly druhů). Bez výzkumu
  nebo bez takových událostí řádek není.
- **Platí od:** časová osa aplikace 1.5.0; řádek dějin aplikace 3.19.0

<!-- zdroj: app:src/timeline.ts computeTimelineModel, :59 TimelineHistory · strings.ts timeline.omitted · CHANGELOG.cs.md 3.19.0 -->

<a id="A6.4"></a>
## A6.4 Vějíř

Vějíř ukazuje předky ústřední osoby v kruhových výsečích, generaci po generaci.

- **Tvar:** **Půlkruh** · **Celý kruh** · **Oboustranný** (předci i potomci).
- **Generace** předků 3–10, výchozí 5. V tvaru Oboustranný **Potomci** 1–5, výchozí 3.
- Číslování předků: 1 je ústřední osoba, otec osoby n má číslo 2n, matka 2n+1. Otcova linie je vlevo.
  Čísla u výsečí zapíná nastavení **Vějíř** „Zobrazit Kekulého (ahnentafel) čísla předků“ (výchozí vypnuto).
- Rodiče jsou první dva zapsaní rodiče osoby. Vztah, který není biologický (adopce, nevlastní, pěstoun), je
  u výseče označený.
- Předek, který se ve vějíři objeví podruhé, se nakreslí znovu, ale dál se nerozvíjí; legenda **↻ opakuje se
  (implex)**. Volba **Ukázat první výskyt** skočí na jeho první místo.
- Potomci (tvar Oboustranný): svazky v pořadí sňatků (datum sňatku, pak pořadí v datech), děti podle narození.
  Neznámý partner sbírá děti bez druhého rodiče. Svazek bez dětí je vidět jen u ústřední osoby.
- **Barvy:** **Pohlaví** · **Linie** (čtyři linie prarodičů: otcův otec, otcova matka, matčin otec, matčina matka) ·
  **Rody** ([A4](A4-surnames-and-families.md)).
- **Původní osoba** vrátí vějíř na osobu, ze které se vyšlo.
- **Platí od:** vějíř aplikace 1.8.0; nový vějíř s tvary, barvami a implexem aplikace 3.20.0
- **Od aplikace 3.27.0:** svazek bez data sňatku se řadí podle nejpozdějšího možného data sňatku: dřívějšího z konce
  svazku (rozvodu) a narození prvního dítěte svazku. Sňatek „před 1982“ jde před sňatek v roce 1982. Svazek bez
  těchto dat jde za ostatní. Stejné pořadí mají partneři vedle osoby a značky pořadí manželství („1. ∞“) na kartách.

<!-- zdroj: app:src/fan-chart.ts FAN_MIN_GENERATIONS, FAN_MAX_GENERATIONS, FAN_DEFAULT_GENERATIONS, parentSlots, repeatOf · strings.ts fan.shapeHalf, fan.shapeFull, fan.shapeTwo, fan.colorGender, fan.colorLine, fan.colorRod, fan.legendRepeats, fan.originPerson, fan.showFirst, fanChart.kekuleHint · settings fanKekule (výchozí false) · spec 029 · CHANGELOG.cs.md 3.20.0 · 3.27.0: app:ad1ca16c src/marriage-order.ts marriageKey (BOUND 0.5, qualifier „<“; bez sňatku min(endDate, narození dětí)), marriageDates, compareMarriages, marriagesInOrder (partneři vedle osoby, značka „1. ∞“) · src/fan-chart.ts familiesOf · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1109-app-tester-vlna1 (T50, T13) -->

<a id="A6.5"></a>
## A6.5 Mapa

Mapa ukazuje místa událostí osob.

- **Rozsah:** **Tento pohled** (výchozí, osoby pohledu) · **Celý strom**.
- **Druhy:** **Narození** · **Úmrtí** · **Sňatky** · **Ostatní události**. Výchozí jsou zapnuté všechny; volba
  se pamatuje na zařízení.
  - Křest se počítá k narození, pohřeb a kremace k úmrtí.
  - Zasnoubení, ohlášky, povolení ke sňatku a svatební smlouvy se počítají ke sňatku. Ostatní události páru jsou
    Ostatní události.
- Místo sňatku se ukáže, když je v pohledu aspoň jeden z partnerů.
- Místo se píše v nejčastějším zápisu. Obec je jeden bod i s čísly domů; místo s vlastními přesnými souřadnicemi
  zůstává samostatným bodem.
- **Platí od:** mapa aplikace 1.10.0; druhy událostí a body obcí aplikace 3.21.0

<!-- zdroj: app:src/places.ts collectPlaces, groupTownPoints · src/ui/map-ui.ts (localStorage strom.map.kinds) · strings.ts map.scopeView, map.scopeTree, map.kinds · CHANGELOG.cs.md 3.21.0 -->

<a id="A6.5.1"></a>
### A6.5.1 Odkud mapa bere polohu místa

Ve vlastním stromu (bez výzkumu) dohledá polohu míst aplikace sama, ve službě OpenStreetMap (Nominatim). Pošle jen
název místa, jak je zapsaný ve stromu, a jen se souhlasem. Ve stromu z výzkumu ztotožňuje místa výzkum
([R4](R4-places.md)).

- **Hranice:**
  - před prvním dohledáním se aplikace zeptá (**Dohledat souřadnice online?**). Odejdou jen názvy míst, žádná jména,
    data ani vztahy. Nejvýš jeden dotaz zhruba za sekundu;
  - souřadnice se uloží do stromu: každé místo se dohledá jednou a mapa pak funguje i bez připojení;
  - automatické dohledání vezme **první výsledek** služby pro zapsaný název. Do aplikace 3.23.0 při tom stejnojmenné
    obce nerozlišilo: místo tak mohlo padnout do obce stejného jména jinde. Polohu, která do stromu nesedí, označí
    **Ověřit** ([R4.4.1](R4-places.md#R4.4.1));
  - jen místo s číslem domu, které služba nenašla, se dohledá podle obce. Z obcí toho jména se vybere ta nejblíž
    ostatním místům stromu („Obec toho jména je víckrát; vybrána ta nejblíž ostatním místům stromu.“); u místa stojí
    **Poloha podle obce**;
  - **od aplikace 3.24.0** se nejbližší obec vybírá u každého místa: když se dvě a víc obcí jmenují přesně jako
    zapsané místo (bez ohledu na velikost písmen a diakritiku), vezme se ta nejbližší středu stromu, ne první
    výsledek. Střed je medián poloh zadaných ručně nebo potvrzených **Ponechat**, když jsou aspoň 3; jinak medián
    všech poloh stromu a míst, která dohledání našlo bez pochyb. Místo s dalším určením („Lhota u Kolína“,
    „Lhota 16“), jediná obec nebo strom bez poloh dostane první výsledek jako dřív. Pořád jde o jeden dotaz na místo;
  - kontrola místa řekne, kolik obcí toho jména mapa našla („Mapa našla 3 obce toho jména a vzala tu nejbližší
    ostatním místům stromu.“); od aplikace 3.24.0, dřív vždy „dvě“;
  - poloha, která už ve stromu je, se nepřesune: dohledání hledá jen místa bez polohy. Ani sloučení s jiným stromem
    nebo souborem GEDCOM nepřepíše polohu zadanou ručně nebo potvrzenou **Ponechat**, jen doplní chybějící. Špatnou
    starší polohu jde přesunout jen ručně;
  - co se nenajde, zůstane bez polohy. Aplikace nic nehádá: „pomůže opravit zápis nebo doplnit zemi“.
- **Ovládání:** aplikace: **Nastavení → Dohledávat místa online**; v okně míst **Špatné místo? Opravit**, **Najít toto
  místo pod jiným názvem** (připojí se jen poloha, zápis ve stromu se nemění), **Použít i pro další čísla domů v …**,
  **Vyčistit osiřelá místa (n)**.
- **Proč:** dohledání míst je jediná část aplikace, která něco posílá ven; proto jen se souhlasem, jen názvy a každé
  místo jednou (komentář v kódu). Limit jednoho dotazu za sekundu je podmínka služby.
- **Platí od:** aplikace 1.10.0; **Špatné místo? Opravit** 1.10.1; **Vyčistit osiřelá místa** 2.1.0; poloha podle obce
  3.21.0; nejbližší stejnojmenná obec u každého místa a počet obcí v kontrole 3.24.0

<!-- zdroj: app:src/geocode.ts hlavička, REQUEST_INTERVAL_MS=1100, geocodePlace (limit 1, parseGeocodeResponse první výsledek), geocodeTown/pickTownHit nearestTo (od v3.21.0), geocodePlaces townFallback · app:src/strings.ts map.consentTitle, consentBody, settingLabel, wrongSpot (v1.10.1), searchLabel, attachOnly, useForOthers, cleanOrphans (v2.1.0), nearestTown, byTown, doneWithMisses · FB podnět 2026-11-04 (stejnojmenná obec) · od 3.24.0: geocode.ts treeCenter (medián, PERSONS_CENTER_MIN=3), sameNamedTowns, pickPlaceHit (townChoices), buildGeocodeUrl limit · place-check.ts multi count · strings.ts checkMulti(n) · merge-executor test (ruční poloha zůstane) · commit 046967d -->

<a id="A6.5.2"></a>
### A6.5.2 Místa mimo mapu dohledat ve výzkumu

U stromu s výzkumem nabízí stavový pruh mapy místa bez polohy k dohledání ve výzkumu ([R4.4](R4-places.md#R4.4)).
Tlačítko otevře okno **Místa** s náhledem; do fronty výzkumu jdou místa až po **Zařadit**.

- **Hranice:**
  - před dohledáním mapou stojí v pruhu vedle dohledání mapou **Ve výzkumu**. Po dohledání, když mapa některá místa
    nenašla, pruh ukáže „N míst na mapě · K mapa nenašla“ a **Dohledat ve výzkumu (K)**, případně „N k potvrzení ›“
    (otevře **Čeká** v panelu výzkumu);
  - tlačítko je jen u stromu s výzkumem a jen když je co dohledat: místo bez polohy nebo neztotožněné, které ještě
    není ve frontě, nepracuje se na něm a nečeká na odpověď;
  - okno **Místa** ukáže náhled „Dohledat ve výzkumu N míst mimo mapu“. Před **Zařadit N míst** se nic nezařadí
    a žádné místo se nezařadí dvakrát;
  - když výzkum běží na jiném počítači, nebo jde o telefon, aplikace místo okna řekne, kde dohledání jde: „Dohledat
    a prověřit jde ve výzkumu na počítači, kde běží. Stav míst se sem přenáší se stromem.“, na telefonu „Dohledat
    a prověřit jde na počítači s výzkumem. Na otázky k místům jde odpovědět i odsud, v Čeká.“ Starší výzkum: „Tato
    verze výzkumu místa ještě nedohledává.“;
  - při sledování výzkumu na mapě ([S4.1.3](S4-research-from-the-app.md#S4.1.3)) řádek „… – bez polohy na
    mapě“ nabízí **Dohledat ve výzkumu**: zařadí to jedno místo hned, bez náhledu; zařazení jde vrátit
    v oznámení.
- **Ovládání:** aplikace: mapa → stavový pruh → **Ve výzkumu**, po dohledání mapou **Dohledat ve výzkumu (K)** →
  okno **Místa** → **Zařadit N míst**.
- **Platí od:** aplikace 3.25.0

<!-- zdroj: app:src/ui/map-ui.ts (stavový pruh, lookResearch, lookable), src/ui/place-actions.ts, src/ui/places-research-ui.ts (bulkLook, bulkLookHead, bulkLookGo, nic dvakrát), src/ui/map-follow-ui.ts (noCoords + places.research.look, Undo) · strings.ts map.onMap.notFound, lookResearch, lookResearchShort, lookResearchTitle, confirm; places.dialog.elsewhere, phoneLine, oldResearch · CHANGELOG.cs.md 3.25.0 · commit 2246ca28 · spec 058 -->

<a id="A6.6"></a>
## A6.6 Rod v pohledu

Pohled může zvýraznit jeden rod ([A4](A4-surnames-and-families.md)): jeho členy plně, manželky a manžele, kteří
do rodu přišli sňatkem, slaběji, ostatní potlačeně. Platí v pohledech Rodina, Potomci a Vějíř.

- Volba se pamatuje pro každý strom na zařízení. Rod, který už ve stromu není, se tiše zruší.
- Když v pohledu není nakreslený žádný člen rodu:
  - Rodina a Vějíř přesunou ústřední osobu na nejbližšího člena rodu (přes rodiče, děti a partnery; při shodě
    na staršího), a když s ním osoba není spojená, na zakladatele rodu;
  - Potomci přesunou ústřední osobu vždy na zakladatele;
  - lišta nabídne **↩ Zpět**.
- **Hranice:** obnovení volby z paměti ústřední osobu nepřesouvá.
- **Ovládání:** **Rody** v liště; v nabídce osoby **Jen rod …** (rodný rod osoby je první); konec přes × u štítku
  nebo **Ukázat celý strom**.
- **Platí od:** aplikace 3.21.0

<!-- zdroj: app:src/ui/rod-view.ts · src/rod-focus.ts (BFS přes rodiče, děti, partnery) · strings.ts rodView.only, rodView.whole, rodView.moved · spec 039 · CHANGELOG.cs.md 3.21.0 -->

<a id="A6.7"></a>
## A6.7 Tabulka

Tabulka ukazuje celý strom po řádcích: každou osobu, každý svazek, každou událost nebo každý pramen, s údaji ve
sloupcích. Slouží k hledání mezer, rozporů a nálezů kontroly napříč stromem. Nezávisí na hloubce **Předci** a **Potomci**.
Pohled Tabulka vychází z tabulky od Ondřeje Chrpy.

- **Řádky:** přepínač **Řádky**: **Osoby** · **Svazky** · **Události** · **Prameny**. Každý typ řádků má vlastní sloupce,
  filtr a řazení.
  - **Osoby:** jeden řádek na osobu stromu; zástupné osoby (prázdné místo pro neznámého rodiče) se vynechávají.
  - **Svazky:** jeden řádek na svazek, který má aspoň jednoho skutečného partnera. **Partner 1** je ten z dvojice,
    kdo je pokrevní příbuzný hlavní osoby; jinak první partner svazku.
  - **Události:** jeden řádek na událost stromu ([A6.7.10](#A6.7.10)).
  - **Prameny:** jeden řádek na pramen stromu ([A6.7.11](#A6.7.11)).
- **Hlavní osoba** je ústřední osoba stromu ([A6.1](#A6.1)). Podle ní se počítá sloupec **Vztah k hlavní osobě**
  a čip **Pokrevní příbuzní**: předci hlavní osoby (i ona sama) a všichni jejich potomci. Partneři, kteří do rodiny
  přišli sňatkem, mezi ně nepatří.
- **Generace** 1 je nejstarší generace stromu; partner má generaci svého partnera.
- **Žijící** (sloupec, hodnota „žijící“) počítá jako ochrana žijících ([A7.1](A7-book-pages-and-export.md#A7.1)).
- Nad tabulkou je počet („42 z 120 osob“) a řazení („Řazení: …“). Pole **Hledat osobu...** v liště v tabulce
  řádek osoby vybere a posune na něj; ústřední osoba se nemění.
- **Ústřední osoba mezi pohledy:** po přepnutí do Tabulky je aktivní řádek ústřední osoby a tabulka se na něj posune
  (vybraný řádek, který se jí týká, zůstane; když osobu vynechá filtr nebo hledání, aktivní řádek není). Po přepnutí
  z Tabulky je ústřední osobou osoba aktivního řádku: u svazku partner, který už ústřední osobou je, jinak
  **Partner 1**; u události ústřední osoba, je-li mezi jejími osobami, jinak první osoba; řádek pramene ústřední osobu
  nemění.
- **Hranice:**
  - zvýraznění rodu ([A6.6](#A6.6)) se v tabulce nepoužije; rod jde vybrat čipem **Rod** ([A6.7.6](#A6.7.6));
  - sloupce, čipy a pohledy výzkumu jsou jen ve stromu z výzkumu ([A6.7.14](#A6.7.14));
  - strom jen ke čtení (sledovaný strom, strom uložený novější verzí aplikace, zamčený strom) tabulka jen
    ukazuje: „Jen ke čtení: úpravy a „Není chyba“ tu nejsou.“ Prohlížení, filtr, řazení a export CSV a XLSX
    fungují; pohled uložit, přejmenovat ani smazat nejde;
  - šipky **↩ ↪** vlevo dole (předchozí a další ústřední osoba) a Alt+← / Alt+→ v Tabulce nejsou: tabulka ústřední
    osobu neukazuje ani během práce nemění.
- **Ovládání:** v liště pohledů **Tabulka** (za **Mapa**); v úzkém okně a na telefonu **Více → Pohled → Tabulka**.
  Pohled se pamatuje jako ostatní ([A6.1.1](#A6.1.1)).
- **Platí od:** aplikace 3.27.0

<!-- zdroj: app:src/ui/table-view/table-model.ts ROW_TYPES, buildTableModel (isPlaceholder ven, svazek aspoň s jedním skutečným partnerem), bloodOf (předci hlavní osoby a všichni jejich potomci), makeContext (homeId, isLivingPerson) · table-columns.ts unionPartners (pokrevní partner jako Partner 1), gen (assignGenerations + 1), kin (findRelationship, kinSelf) · src/ui/table-view/table-ui.ts tableReadOnly (isReadOnly: viewMode, isLocked, isNewerData) · src/data.ts:655 isReadOnly · src/ui/bottom-sheet.ts:443 (Více → Pohled: Vějíř, Mapa, Tabulka) · table-bar.ts countText, sortText · perf-budget test 5 000 osob · strings.ts viewModeSwitch.table, table.rows, rowType, rowTypeNote, countOf, sortedBy, readOnly, readOnlyShort · commity c34c47ff, 1b72e6d8 · spec 073 U2 · Události a Prameny (spec 073 U3 P2, K5.1–K5.4): commity 8de751c2, 63ed9def, 1a3a49f1, 3cf69ffa, strings.ts table.rows.events, rows.sources, perf-budget 5 000 osob (Události) a 2 000 pramenů · poděkování: Milan 10. 11. (dirigent:prace/1110-doc-tabulka, bod 4) · CHANGELOG.cs.md 3.27.0 · dirigent:prace/1110-app-tabulka-p1 · Žijící: strings.ts table.col.living, table.living (commit 7e648e24) · ústřední osoba mezi pohledy: commit 75de3a9b (T54 F1) · ↩ ↪ a Alt+šipky v Tabulce skryté: commity 79764eba, b1cbe546 (T54 G14) -->

<a id="A6.7.1"></a>
### A6.7.1 Svazky v tabulce osob

Osoba se dvěma a více svazky má v tabulce osob vlastní řádek a pod ním podřádek pro každý svazek („Svazek 2 z 3“).
Řádek osoby má ve sloupci **Partner** počet („3 svazky“) a ostatní sloupce svazku prázdné.

- Svazky jdou v pořadí sňatků jako ve stromu ([A6.4](#A6.4)): **Svazek 1** je ten, který má na kartě značku „1. ∞“.
  Svazek bez data sňatku se řadí podle nejpozdějšího možného data sňatku (dřívější z rozvodu a narození prvního
  dítěte); svazek bez těchto dat jde za ostatní. Při shodě rozhoduje pořadí svazků u osoby v datech. Prázdná
  zástupná rodina („?“) jde na konec v pořadí zápisu.
- **Sbaleno:** řádek osoby ukáže první svazek a počet ostatních. Výchozí je rozbaleno; vestavěný pohled **Mezery**
  má svazky sbalené.
- **Filtr ve sloupci svazku** se posuzuje u každého svazku zvlášť. Osoba zůstane, když vyhoví aspoň jeden svazek;
  ostatní se schovají pod řádek „2 svazky mimo filtr · ukázat“. Ukázané jsou znevýrazněné do další změny filtru.
- **Řazení podle sloupce svazku** bere první svazek, který vyhoví filtru.
- Osoba s jedním svazkem má jeho údaje přímo ve svém řádku.
- Podřádek svazku nese jen nálezy svého svazku. Nálezy osoby (třeba věk matky při narození) a pruhy sbalených skupin
  zůstávají v řádku osoby.
- **Ovládání:** **Rozbalit svazky** / **Sbalit svazky** (na telefonu v nabídce **⋯**); klávesy → a ← ve sloupci
  **Celé jméno**, * pro všechny osoby; nabídka řádku. Stav se ukládá s pohledem ([A6.7.7](#A6.7.7)).

<!-- zdroj: app:src/ui/table-view/table-subrows.ts defaultUnionCollapse (collapsed: false), isExpanded, setAllExpanded, passingUnions, personPassesUnions, sortUnionOf, buildLines · table-model.ts unionsInMarriageOrder (marriagesInOrder z src/marriage-order.ts: Svazek 1 = „1. ∞“; bez data sňatku podle rozvodu nebo prvního dítěte; shoda podle seznamu partnerships osoby; zástupné rodiny „?“ za nimi v pořadí dat; commit 2e0346f9, T13) · table-views.ts BUILTIN_VIEWS gaps (unions collapsed) · strings.ts table.unionsN, unionKofN, hiddenUnions, expandAll, collapseAll · commity 8833da14, 8192621d · nálezy podřádku: commit 75de3a9b (T54 F6) -->

<a id="A6.7.2"></a>
### A6.7.2 Sloupce

Sloupce jsou ve skupinách. Které jsou vidět a v jakém pořadí, je část pohledu ([A6.7.7](#A6.7.7)).

| Řádky | Skupiny sloupců |
|---|---|
| **Osoby** | **Osoba** · **Narození a křest** · **Rodiče** · **Svazky** · **Rozvod** · **Úmrtí a pohřeb** · **Události** · **Prameny** · **Spolehlivost a výzkum** · **Kontroly** |
| **Svazky** | **Pár** · **Sňatek** · **Rozvod** · **Děti a prameny** |

- **Celé jméno** (u svazků **Partner 1**) je ukotvené vlevo a řadí se podle příjmení, pak křestního jména.
  Skládá se z částí jména, proto je zvlášť sloupec **Křestní jméno** (ve výchozím stavu skrytý), který jde upravit
  v buňce ([A6.7.15](#A6.7.15)). **Příjmení** je příjmení po sňatku, jinak rodné; **Rodné příjmení** je zapsané příjmení.
- **ID výzkumu** ukazuje jen číslo osoby z výzkumu (P…). **Ref. číslo** je referenční číslo osoby (REFN), jak ho
  přinesl soubor GEDCOM (a jak do něj zase jde); řadí a filtruje se jako text.
- **Otevřená otázka**, **⇄ V jiném stromu** (stromy na tomto zařízení, ve kterých osoba je) a **Stav osoby** (značka
  doložení a spolehlivosti z karty, slovy; řadí se od nejsilnější; od aplikace 3.27.0 podle spolehlivosti citací,
  [S7.2](S7-reliability-and-verification.md#S7.2)) jsou v každém stromu. Skupina **Výzkum** je jen ve
  stromu z výzkumu ([A6.7.14](#A6.7.14)).
- **Události** (**Povolání**, **Bydliště**, **Vyznání**, **Vojsko**, **Vystěhování**, **Vzdělání**) ukazují
  každou hodnotu jednou, nejnovější první.
- Sloupce **Spolehlivost …** a **Jistota z výzkumu** mají hodnotu jen ve stromu z výzkumu
  ([S7](S7-reliability-and-verification.md)).
- Sloupce **Křestní jméno**, **Ref. číslo**, **Otevřená otázka**, **⇄ V jiném stromu** a **Stav osoby** jsou ve výchozím stavu skryté.
- **Hranice:** sbalená skupina je úzký pruh; ukazuje nejvyšší úroveň nálezu ve svých buňkách. Na telefonu je
  ukotvené jméno užší a hlavičku jde jen číst, ne měnit.
- **Ovládání:**
  - panel **Sloupce** („12 z 58“): **Hledat sloupec**, skupiny se zaškrtávátkem **vše**, přetažení pořadí,
    **Řádek pokrytí**, **Obnovit výchozí**, **Hotovo**;
  - nabídka v hlavičce sloupce: **Řadit vzestupně**, **Řadit sestupně**, **Přidat k řazení** (Shift + klik),
    **Filtr…**, **Ukotvit vlevo** / **Uvolnit**, **Posunout vlevo** / **Posunout vpravo**, **Skrýt sloupec**,
    **Sbalit skupinu …** / **Rozbalit skupinu …**; u dopočteného sloupce „Vypočteno z: …“;
  - šířka sloupce tažením okraje hlavičky.

<!-- zdroj: app:src/ui/table-view/table-columns.ts PERSON_GROUPS, UNION_GROUPS, katalog sloupců (surname marriedSurname || lastName, birthSurname lastName, researchId /^P\d{1,7}$/, eventValues nejnovější první, sortKey jména), pinnedWidth 156 na telefonu · table-state.ts MIN_COLUMN_WIDTH, BAND_WIDTH, lockedColumn · table-checks.ts bandSeverity · table-colpanel.ts panelGroups · table-headmenu.ts headMenuItems · strings.ts table.group.*, col.*, columns, columnsCount, searchColumn, all, pinnedLabel, resetColumns, done, coverageRow, sortAsc, sortDesc, sortAdd, sortAddHint, filterColumn, pin, unpin, moveLeft, moveRight, hide, collapseGroup, expandGroup, computedFrom · commity 89602f35, 49b96d92, e4a35406 · refn (skupina person, textCell p.refn; commit 7e648e24, T54 F3), question, crossTree (crossTreeCell), personStatus (personStatusCell, cardStatus, CARD_STATUS_CLASSES), strings.ts table.col.refn, question, crossTree, personStatus · „Celé jméno“ (id `name`) a sloupec firstName, záhlaví „Ref. číslo“ bez „(REFN)“: commity 79764eba, 8fdf52ca (T54 G10, G3) -->

<a id="A6.7.3"></a>
### A6.7.3 Dopočtené a náhradní hodnoty

Co ve stromu zapsané není, ale jde z dat spočítat, tabulka dopočte. Nic přitom do stromu nezapisuje.

| Hodnota | Jak se počítá |
|---|---|
| věk (při narození dítěte, sňatku, úmrtí) | z dat s dnem přesně („67“); z roku, měsíce nebo rozsahu jako rozsah („28–29“); z data s cca, před nebo po jako odhad („≈ 67“) |
| náhradní datum a místo | bez narození křest („křt. 3. 5. 1850“), bez úmrtí pohřeb („pohř. …“); věk z nich je odhad (≈) |
| **Rozdíl zapsaného věku** | o kolik let je zapsaný věk mimo rozsah věku z dat („+3“, „−2“); slovní věk a věk s cca, před, po se neporovnává |
| **Délka svazku** | od sňatku do rozvodu, jinak do první smrti z dvojice |
| **Pořadí mezi sourozenci**, **Počet sourozenců**, **Počet dětí**, **Počet svazků**, **Počet pramenů** | z vazeb a pramenů stromu |

- Data mají slovo přesnosti před sebou (**cca**, **před**, **po**). Nejisté datum je podtržené tečkami; nález to
  není. Datum se řadí podle svého začátku.
- **Hranice:** věk se nepočítá, když konec předchází začátek. Sloupce úmrtí mají u žijící osoby **Nevztahuje se**
  (u **Úplnost úmrtí** „žije“). **Věk otce/matky při narození** bez zapsaného rodiče je **Nevztahuje se**.
- **Ovládání:** nápověda u buňky („Křest, narození neznámé“, „Pohřeb, úmrtí neznámé“); u dopočteného sloupce
  v nabídce hlavičky „Vypočteno z: …“; legenda **Značky** ([A6.7.13](#A6.7.13)).

<!-- zdroj: app:src/ui/table-view/table-columns.ts ageCell (přesně / rozsah ageRangeBetween / ≈ approxAgeBetween; nic, když konec před začátkem), dateCell, qualifierWord, birthOrBaptism, deathOrBurial (náhrada, ≈), gapCell (recordedAgeGap), unionLength, naCell, parentsOf · src/dates.ts:448 ageRangeBetween, recordedAgeGap · table-model.ts dateNumber (začátek rozsahu) · strings.ts table.na, living, subst.*, qual.*, computedFrom, from.* · commit 8833da14 -->

<a id="A6.7.4"></a>
### A6.7.4 Úplnost a řádek pokrytí

Sloupce **Úplnost …** říkají, kolik sledovaných polí je vyplněno, v procentech.

| Sloupec | Počítá se z |
|---|---|
| **Úplnost narození** | datum, místo, otec, matka, pramen |
| **Úplnost svazku** | datum, místo, partner, pramen sňatku; u svazku bez sňatku (**Partneři**, **Odloučení**) jen partner |
| **Úplnost úmrtí** | datum, místo, pramen (ne u žijící osoby) |
| **Úplnost celkem** | narození, každý svazek a úmrtí, váženo počtem polí |

- Náhradní hodnota (křest, pohřeb) pole nevyplní. Nápověda u buňky vypíše, co chybí („chybí: místo narození,
  pramen narození“).
- **Řádek pokrytí** pod hlavičkou ukazuje u každého sloupce, kolik procent řádků má hodnotu („vyplněno 64 %“,
  nápověda „77 z 120“). U sloupců **Úplnost …** ukazuje průměrnou úplnost řádků (nápověda „průměr z 120“).
  Počítá jen řádky, které jsou právě vidět (po filtru a hledání). Buňky **Nevztahuje se**
  se nepočítají; u sloupců svazku se počítají svazky, které vyhoví filtru. Pod 50 % je číslo tučně; bez buňky,
  které by se týkal, je „–“.
- **Svazek bez sňatku** (typ **Partneři** nebo **Odloučení**): prázdné buňky sňatku (datum, místo, věk a zapsaný věk
  obou, rozdíl zapsaného věku, svědci, **Spolehlivost sňatku**) mají „–“ s nápovědou „Nevztahuje se: svazek bez
  sňatku“ a do řádku pokrytí ani úplnosti se nepočítají. Hodnota, která tam přesto je (začátek vztahu z formuláře
  svazku), se ukáže jako dřív.
- **Ovládání:** **Řádek pokrytí** v panelu **Sloupce** (na telefonu v **⋯**); ukládá se s pohledem.

<!-- zdroj: app:src/ui/table-view/table-columns.ts compCell, unionComp (pole a váhy, náhrada nevyplní) · table-coverage.ts cellFilled, columnCoverage, coverageCell, coverageLabel (LOW pod 50 %) · table-subrows.ts coverageUnionsOf · strings.ts table.compList.*, compField.*, missing, missingNone, compCounts, coverage, coverageOf · rozhodnutí Milan 10. 11. (spec 073, bod 5) · commit 8833da14 · průměr u sloupců úplnosti (kind percent): table-coverage.ts columnCoverage average, strings.ts table.coverageAverage, i XLSX, commit 56f3418c (T54 G12) · svazek bez sňatku: table-columns.ts unionWithoutWedding (partners, separated), weddingCell, oneUnionFields (jen partner), strings.ts table.naNoWedding, compList.unionNoWedding, commit 8fdf52ca (T54 G5, MILAN.md rozhodnutí 21) -->

<a id="A6.7.5"></a>
### A6.7.5 Nálezy kontroly v buňkách

Tabulka ukazuje nálezy Kvality dat ([A5](A5-tree-check.md)) přímo u údaje, kterého se týkají: buňka je
podbarvená a má značku úrovně. Kontrola běží nad celým stromem na pozadí, když je aplikace volná.

| Úroveň | Značka v legendě |
|---|---|
| **chyba** | „Údaje si odporují.“ |
| **k ověření** | „Neobvyklá hodnota, stojí za ověření.“ |
| **stopa** | „Stopa pro pátrání, není to chyba.“ |
| **neobvyklé** (☆) | „Nález označený „Není chyba“.“ |

- Nález jde do buňky údaje: věk rodiče při narození do **Věk otce/matky při narození** u dítěte, nález ke sňatku
  do věku a data sňatku, zapsaný věk do zapsaného věku a jeho rozdílu, úmrtí před narozením do obou dat a věku,
  událost do sloupce události, rozdíl věku partnerů do partnera, možná duplicita do jména, zápis místa do buněk
  s tím místem. Nález bez vlastní buňky je jen ve sloupcích kontrol.
- Sloupce skupiny **Kontroly**: **Nálezy** (počet; „…“, dokud kontrola běží), **Nejvyšší úroveň**, **Neobvyklé,
  ověřené** (počet nálezů označených **Není chyba**).
- Nález označený **Není chyba** ([A5.7](A5-tree-check.md#A5.7)) v buňce zůstane jako **neobvyklé** („Neobvyklé,
  ale ověřeno“) a nepočítá se do nálezů.
- **Hranice:** strom jen ke čtení nález označit nedovolí („Strom je jen ke čtení: nález nejde označit.“).
- **Ovládání:** klik na značku otevře bublinu (na telefonu panel zdola): úroveň, text nálezu, „Nález 1 z 2“ a
  - **Není chyba** (oznámení „Označeno: není chyba“ s **Vrátit**); u neobvyklého **Hlásit znovu**;
  - **Kvalita dat ›** otevře dialog Kvality dat na skupině tohoto nálezu; u neobvyklého na seznamu označených.

  Buňky **Nálezy** a **Nejvyšší úroveň** otevřou seznam všech nálezů osoby (klik, Enter, klepnutí; na telefonu panel
  zdola): u každého úroveň, text a koho nebo čeho se týká; hlášené podle úrovně, označené **Není chyba** na konci.

  Legenda **Značky** („Značky v buňkách“) vysvětluje i nejisté datum, spolehlivost, náhradní hodnotu, dopočet
  a **Nevztahuje se**. Jak která značka vypadá: [A6.7.13](#A6.7.13).

<!-- zdroj: app:src/ui/table-view/table-checks.ts severityRank, parentAgeColumn, issueTargets (mapování nálezů na buňky), buildCheckIndex, CHECK_COLUMNS, applyChecks · table-ui.ts whenIdle (validateTreeData jednou), cellFindings · table-bubble.ts bubbleHeading, bubbleHtml, legendHtml, openBubblePanel, sheetElement · src/ui/tree-stats.ts showTreeValidationDialog (focus: skupina otevřená a posunutá; označené → seznam) · strings.ts table.sev.*, unusualChecked, notError, reReport, toQuality, dismissedToast, roNote, checksRunning, findingOf, legend, legendTitle, legendKind.*, legendText.* · commity 19cf28ea, e530019b, 59a8eed0 · seznam nálezů osoby z buněk Nálezy a Nejvyšší úroveň: commit 75de3a9b (T54 F5) -->

<a id="A6.7.6"></a>
### A6.7.6 Filtr, hledání a řazení

Filtr vybere řádky, hledání je zúží dál, řazení určí pořadí.

- **Čipy** tabulky osob (svazky čipy nemají, události a prameny mají vlastní, [A6.7.10](#A6.7.10), [A6.7.11](#A6.7.11)): **Žijící**, **Zemřelí** (vylučují se), **Pokrevní příbuzní**, **Rod** (výběr rodů),
  **Generace** (rozsah), **Víc svazků**, **Bez data narození**, **Nejisté datum** (narození nebo úmrtí),
  **Bez pramene**, **S nálezem** (chyba nebo k ověření; stopa ne), **Neobvyklé**, **Nepotvrzené z výzkumu**
  (jen strom z výzkumu). Čipy nálezů čekají na kontrolu („Až doběhnou kontroly“). Co se nevejde, je v **Další (n)**.
- **Filtr ve sloupci** (**Filtr…** v hlavičce) podle druhu sloupce:
  - hodnoty ze seznamu (pohlaví, stav svazku, úroveň nálezu, rod …);
  - rozsah **od**–**do** (u data **Rok**, u věku, počtu a procent číslo);
  - text: **obsahuje** · **začíná** · **je** · **není** (bez ohledu na velikost písmen a diakritiku; čip „Sloupec =
    hodnota ×“ nebo „Sloupec ≠ hodnota ×“; rychle z nabídky buňky, [A6.7.15](#A6.7.15));
  - u každého **Jen prázdné** · **Jen vyplněné**.
- Platí všechny filtry zároveň. Počet filtrů je na **Filtry (n)**, vše ruší **Zrušit filtry**. Bez řádku:
  „Nic nevyhovuje filtru“.
- **Hledat v tabulce:** od 2 znaků, bez ohledu na velikost písmen a diakritiku, ve viditelných sloupcích i
  v podřádcích svazků; shody jsou zvýrazněné, nad tabulkou je jejich počet.
- **Řazení:** klik na hlavičku řadí vzestupně, další klik sestupně, třetí řazení zruší; řadí se jen podle toho
  sloupce. Shift + klik přidá sloupec jako další klíč (další klik ho otočí, třetí odebere). Šipka ↑ ↓ u hlavičky
  má číslo pořadí klíče. Prázdné hodnoty jsou vždy na konci, v obou směrech. Čísla v textu se řadí jako čísla.
- **Hranice:** hledání se do pohledu neukládá ([A6.7.7](#A6.7.7)).

<!-- zdroj: app:src/ui/table-view/table-filter.ts CHIP_ORDER, setChip (Žijící × Zemřelí), personPassesChip (finding: chyba nebo k ověření; unusual; unconfirmed jen researchTree, relN/relB/relD), CHECK_CHIPS, rodChoices, generationSpan, filterKindOf, cellPasses, foldText · table-filterbar.ts SEARCH_DELAY_MS, columnFilterForm, chipChoiceForm · table-state.ts řazení (vzestupně → sestupně → vypnuto; Shift přidá, otočí, odebere; prázdné na konci; Intl.Collator numeric) · strings.ts table.chip.*, chipRod, chipGen, moreN, filters, clearFilters, search, matches, noMatch, checksWait, matchContains, matchStarts, rangeFrom, rangeTo, rangeYears, onlyEmpty, onlyFilled · commity dd1d74bc, e64b8b06, fc746037 · je / není: strings.ts table.matchEquals, matchNotEquals (commit 05d9a9ab, T54 F4) -->

<a id="A6.7.7"></a>
### A6.7.7 Pohledy tabulky

Pohled je uložené nastavení tabulky pod jménem. Vestavěné pohledy jsou hotová čtení stromu; vlastní pohled si
uloží člověk.

| Vestavěný pohled | Řádky | Co ukazuje |
|---|---|---|
| **Přehled** (výchozí pro osoby) | osoby | jméno, datum a místo narození, datum úmrtí, věk při úmrtí, partner, datum sňatku a věk při něm, nálezy, úplnost celkem; řazeno podle data narození |
| **Narození a rodiče** | osoby | narození a křest, rodiče, jejich věk při narození, úplnost narození; řazeno podle data narození |
| **Sňatky** (výchozí pro svazky) | svazky | pár, datum a místo sňatku, věk a zapsaný věk obou, stav, svědci, rozvod, děti, délka, prameny, úplnost; řazeno podle data sňatku |
| **Úmrtí** | osoby | úmrtí, příčina, pohřeb, věk a zapsaný věk při úmrtí, úplnost úmrtí; čip **Zemřelí**; řazeno podle data úmrtí |
| **Prameny a citace** | osoby | počet pramenů, doložení, spolehlivost narození a úmrtí; od nejméně pramenů |
| **Mezery** | osoby | úplnost celkem i po částech, narození, rodiče, prameny; od nejméně úplných; svazky sbalené |
| **Kontroly** | osoby | úroveň a počet nálezů, data, věk rodičů, sňatek; čip **S nálezem**; od nejvyšší úrovně, pak počtu nálezů |
| **Všechny události** (výchozí pro události) | události | typ, osoba nebo pár, datum, místo, věk při události, kmotři, svědci, oddávající, pramen; řazeno podle data |
| **Všechny prameny** (výchozí pro prameny) | prameny | titul, archiv, kniha a signatura, online, osob, údajů, přečteno výzkumem, přepis; řazeno podle titulu |

- **Pohled ukládá:** typ řádků, sloupce (pořadí, šířky, ukotvení, sbalené skupiny), řádek pokrytí, filtr, řazení
  a rozbalení svazků. Neukládá hledání, výběr řádku ani posun.
- Změněný pohled má štítek **změněno** a volby **Uložit**, **Uložit jako nový**, **Zahodit změny**. Vestavěný
  pohled se nemění ani nejde přejmenovat či smazat; jeho změny jdou jen **Uložit jako nový**. Vlastní pohled:
  **Přejmenovat…**, **Smazat** (s potvrzením). Vlastní pohledy jsou seřazené podle jména.
- Rozpracovaný stav tabulky si aplikace pamatuje pro každý strom na tomto zařízení; po obnovení stránky nebo
  aktualizaci aplikace je tabulka, jak zůstala. Patří k němu neuložené změny každého pohledu, i toho, ze kterého se
  přepnulo: po návratu má pohled dál štítek **změněno**. **Uložit**, **Uložit jako nový** a **Zahodit změny** je
  vyřídí. Poškozená část rozpracovaného stavu se vynechá.
- **Uložené pohledy jsou součástí stromu** (verze dat 17): uložení, přejmenování i smazání má krok zpět a zápis
  v historii změn. Jdou se stromem do zálohy (JSON) a při oddělení části stromu i do nového stromu.
  GEDCOM je nenese; strom z výzkumu si je při načtení nové verze ponechá. Poškozený pohled se při načtení vynechá.
- **Hranice:** starší aplikace (od 3.19.0) otevře strom uložený aplikací 3.27.0 jen ke čtení a nikdy ho
  neuloží; po aktualizaci aplikace jde strom zase měnit.
- **Ovládání:** nabídka **Pohled** v liště tabulky (**Vestavěné**, **Vlastní**, **Uložit jako nový…**,
  **Přejmenovat…**, **Smazat**).

<!-- zdroj: app:src/ui/table-view/table-views.ts BUILTIN_VIEWS (9: overview, births, marriages, deaths, sources, gaps, checks, events, allSources), defaultViewId (události → Všechny události, prameny → Všechny prameny), defaultViewId, viewFromState, viewChanged, uniqueViewName, customViews (podle jména), workStorageKey strom.table.{treeId}, readTableWork, writeTableWork · table-columns.ts výchozí sloupce pohledů (:683 Sňatky, DEFAULT_VIEWS.events, .sources) · src/table-views-data.ts sanitizeTableView, keepTableViews (verze z výzkumu ponechá pohledy) · src/data.ts:298 sanitizeTableViews při načtení, :1720 saveTableView, deleteTableView (krok zpět, historie změn) · src/subtree.ts:148 · src/types.ts STROM_DATA_VERSION 17, StromData.tableViews · src/tree-manager.ts:630 isTreeNewer, src/data.ts:649 isNewerData (jen ke čtení, od aplikace 3.19.0) · src/ui/research-ui.ts, conflict-decide-ui.ts keepTableViews · strings.ts table.view, views.*, viewName.* (events, allSources), changed, save, saveAs, discard, builtinNote, saveAsMenu, renameMenu, deleteMenu, builtinLocked, viewWhat, deleteConfirm · commity d19a5942, c2d48747, 8ca649ff · neuložené změny všech pohledů v pracovním stavu (localStorage) se sanitizací: commit b1cbe546 (T54 G9, varianta c) -->

<a id="A6.7.8"></a>
### A6.7.8 Akce u řádku a úpravy

Klik vybere řádek (i podřádek svazku); šipky, Page Up/Down a Ctrl+Home/End výběr posouvají, Esc ho zruší.

| Akce | Co udělá |
|---|---|
| **Ukázat ve stromu** | přepne na pohled Rodina s osobou jako ústřední osobou, vystředěnou a zvýrazněnou |
| **Otevřít osobu** (Enter) | otevře stránku osoby |
| **Upravit…** (dvojklik) | otevře úpravu osoby; u podřádku svazku a v tabulce svazků vztahy osoby na tom svazku |

- V tabulce svazků se akce týkají osoby **Partner 1**.
- V tabulce událostí se týkají první osoby řádku a **Upravit…** otevře úpravu té události ([A6.7.10](#A6.7.10)); v tabulce
  pramenů je **Otevřít pramen** ([A6.7.11](#A6.7.11)).
- Po úpravě oznámení „Uloženo: …“, řádek krátce blikne a řádky zůstanou v pořadí. Řádek, který už filtru
  nevyhovuje, zůstane se štítkem „nevyhovuje filtru“ do další změny řazení, filtru nebo pohledu. Změnu z výzkumu
  ohlásí „Výzkum změnil 3 údaje: …“.
- Jeden údaj jde upravit i přímo v buňce ([A6.7.15](#A6.7.15)).
- **Hranice:** ve stromu jen ke čtení **Upravit…** není.
- **Ovládání:** tlačítka u vybraného řádku, nabídka řádku (pravé tlačítko; i rozbalení svazků). Na telefonu
  klepnutí na řádek otevře panel s akcemi a se svazky („Svazek 1: … · Upravit ›“).

<!-- zdroj: app:src/ui/table-view/table-ui.ts tableMethods (tableRowAction: tree → Rodina, focus, highlight; open; edit → dialog osoby / panel vztahů na svazku), personOfRow (Partner 1), keepWork · table-refresh.ts keepOrder, watchEdit, changedKeys, bridgeChanges, namesList · table-grid.ts FLASH_MS · strings.ts table.act.*, dblClickHint, actionsOf, unionWith, editMore, staleRow, savedToast, bridgeToast · commity da6b9786, de46ae30, e4a35406 -->

<a id="A6.7.9"></a>
### A6.7.9 Export CSV a XLSX

Export uloží tabulku, jak je vidět, do souboru pro tabulkové programy: **CSV** nebo **XLSX** (sešit Excelu).

- **Co jde ven:** viditelné sloupce v pořadí tabulky (sloupce sbalené skupiny celé) a řádky po filtru, hledání a
  řazení. Hodnoty jsou, jak je tabulka píše: data v zápisu aplikace, „cca …“, „≈ 67“, „křt. …“, „–“.
- **Řádky:** bez filtru a hledání jdou ven všechny řádky („Vše zobrazené · 120 osob“). S filtrem nebo hledáním je
  na výběr:
  - **Zobrazené** (výchozí): jen řádky, které tabulka ukazuje, s počtem a připomínkou filtru („Zobrazené · 28 z 866
    osob (platí filtr: …)“);
  - **Všechny … bez filtru** („Všechny osoby bez filtru · 866“): všechny řádky toho typu v pořadí podle řazení, bez
    filtru i hledání.

  Řádek se štítkem „nevyhovuje filtru“ ([A6.7.8](#A6.7.8)) do zobrazených nepatří.
- Osoba se dvěma a více svazky: první svazek, který vyhoví filtru, je v jejím řádku, každý další v pokračovacím
  řádku s prázdnými údaji osoby. Za jménem je sloupec **Svazek** („1 z 3“).
- **CSV:** text, UTF-8 se značkou BOM, oddělovač středník, konce řádků CRLF; buňka, která by se v tabulkovém programu
  spustila jako vzorec, se zneškodní. Značky nálezů a barvy se nevyvážejí.
- **XLSX:** jeden list pojmenovaný podle pohledu.
  - Řádek 1 jsou skupiny sloupců (sloučené buňky), řádek 2 záhlaví, řádek 3 řádek pokrytí ([A6.7.4](#A6.7.4)).
    Ukotvené sloupce tabulky a tyto tři řádky jsou v listu ukotvené.
  - Každá skupina sloupců je osnova: jde sbalit, její první sloupec zůstane. Pokračovací řádky svazků jsou o úroveň
    níž pod řádkem osoby (úroveň 2 osnovy řádků).
  - Buňka s nálezem **chyba** nebo **k ověření** je podbarvená a nálezy má v komentáři. Stopa a neobvyklé barvu
    ani komentář nemají.
  - Počty, věky v celých letech a úplnost jsou čísla (úplnost a pokrytí jako procento); ostatní je text, jak ho píše
    tabulka (i „≈ 67“, „28–29“, data). Text se nikdy nestane vzorcem. Odkaz pramene je v buňce jako odkaz.
- **Soubor:** `{strom}_{pohled}_{RRRR-MM-DD}.csv` nebo `.xlsx`, bez diakritiky.
- **Ovládání:** **Export ▾** v liště tabulky (na telefonu v **⋯**): **Formát** „CSV · pro Excel a Tabulky Google“ nebo
  „XLSX · skupiny, ukotvení, barvy kontrol“, **Řádky**, **Stáhnout CSV** / **Stáhnout XLSX**; oznámení „Staženo: …“
  s počtem osob, řádků a sloupců.
- **Hranice:** export z menu stromu (**Tabulka osob (CSV)**, [A7](A7-book-pages-and-export.md)) je jiný soubor
  s pevnými sloupci.
- **Platí od:** aplikace 3.27.0

<!-- zdroj: app:src/ui/table-view/table-export.ts tableCsvField (neutralizace vzorců), buildExportTable, buildTableCsv (BOM, ;, CRLF, pokračovací řádky, sloupec Svazek), fileNamePart, tableCsvFileName (csv | xlsx) · table-xlsx.ts buildTableXlsx (řádky 1–3, merges, outline sloupců za ukotvenou částí, pokračovací řádky outline 1, freeze, errorFill/warningFill + findingsComment jen chyba a k ověření, href), xlsxNumber (COUNT_COLUMNS, věk ^\d+$, procento) · src/xlsx.ts (ignoredErrors numberStoredAsText, styl @ pro text) · table-viewbar.ts exportForm (Formát, Řádky: Zobrazené / Všechny bez filtru jen s filtrem nebo hledáním) · table-ui.ts tableExportNow (unfiltered: všechny řádky typu v řazení, stale ven) · strings.ts table.export, exportFormat, exportRows, exportCsv, exportXlsx, exportAll, exportShown, exportFilterNote, exportUnfiltered.*, exportWhat.*, exportWhatAll.*, exportFile, exportDownload, exportDownloadXlsx, csvUnionCol, csvUnionOf, exportedToast · commity 2368683b, 5a67797b, 4308633b, e0ce4ec2, ebc1542f, e5b97725 · dirigent:prace/1110-app-tabulka-p2, 1110-app-tabulka-opravy -->

<a id="A6.7.10"></a>
### A6.7.10 Události v řádcích

Tabulka událostí má řádek na každou událost stromu: kdo, kdy, kde, v jakém věku a kdo byl u toho.

- **Co je řádek:**
  - každá událost osoby (křest, povolání, bydliště, vojsko …) a každá událost páru;
  - narození a úmrtí z údajů osoby, když je u nich něco zapsané (datum, místo, adresa, pramen; u úmrtí i příčina
    nebo věk);
  - sňatek svazku: u manželství vždy, u jiného vztahu („Začátek vztahu“) jen se zapsaným údajem; rozvod („Konec
    vztahu“), když je svazek rozvedený nebo je zapsaný jeho konec.
- **Sdílená událost** (bydliště, vojsko, vystěhování, přistěhování, naturalizace, vlastní událost) zapsaná u více osob
  stejně je jeden řádek se všemi osobami. Stejně znamená stejný typ, datum, místo, adresu, poznámku a prameny; datum
  musí být zapsané a k němu místo nebo pramen. Křest, povolání nebo titul je vždy jen jedné osoby.
- **Sloupce** ve skupinách **Událost** · **Účastníci** · **Pramen**:
  - **Typ**, **Osoba nebo pár** (u páru nejdřív pokrevní příbuzný hlavní osoby), **Datum**, **Místo**;
  - **Věk při události** jako jinde ([A6.7.3](#A6.7.3)); do jednoho roku z přesných dat ve dnech („12 d.“); u více
    osob věk každé v pořadí jmen („–“ neznámý); u narození **Nevztahuje se**;
  - **Údaj**: hodnota události (povolání, titul), jinak příčina; u úmrtí příčina úmrtí;
  - **Kmotři**, **Svědci**, **Oddávající, křtitel**, **Jiní přítomní**: účastníci podle role; osoba stromu je odkaz;
  - **Pramen**: citované prameny „titul, signatura“, více oddělených středníkem; **Spolehlivost** údaje.
- **Čipy:** **Narození a křty** (i narození z údajů osoby), **Sňatky** (i zasnoubení, ohlášky, povolení, smlouva),
  **Úmrtí a pohřby** (i kremace), **Ostatní události**, **Bez pramene**.
- **Filtr podle účastníka:** klik na jméno účastníka nabídne „Filtr: kmotr …“ (u osoby stromu i **Otevřít osobu**).
  Filtr je čip „Kmotr: … ×“ (Svědek, Oddávající, křtitel, Přítomen) a nahradí předchozí filtr účastníka. Osobu stromu
  hledá podle osoby, zapsané jméno podle písmen bez ohledu na velikost, diakritiku a mezery.
- **Kmotr, který se opakuje** ([A5.5](A5-tree-check.md#A5.5)) je v buňce účastníka jako **stopa**.
- **Ovládání:** vestavěný pohled **Všechny události**; akce u řádku ([A6.7.8](#A6.7.8)) se týkají první osoby řádku.
  **Upravit…** otevře u události osoby úpravu osoby na té události (u sdílené na první kopii), u narození a úmrtí
  úpravu osoby, u události páru její dialog, u sňatku a rozvodu vztahy osoby na tom svazku.
- **Hranice:** zástupné osoby řádky nemají; narození a úmrtí bez zapsaného údaje řádek nemají.
- **Platí od:** aplikace 3.27.0

<!-- zdroj: app:src/ui/table-view/table-events.ts buildEventRows (narození/úmrtí jen se zapsaným údajem, weddingRow: manželství vždy kromě marriageUnrecorded, partnersStart jen se zápisem; divorceRow), SHARED_TYPES, shareKey (typ, vlastní název, datum, místo, adresa, poznámka, prameny; datum a místo nebo pramen), mergeParticipants, eventEditTarget, MARRIAGE_COUPLE_TYPES · table-columns.ts EVENT_COLUMNS, eventPersons (pokrevní první), eventAgeCell, eventAge (dny < 366), eventValueCell, eventSourceCell, eventPill, DEFAULT_VIEWS.events · table-filter.ts EVENT_CHIP_ORDER, EVENT_KIND_CHIPS, lifeCategory, participantChip, eventHasParticipant (foldName), setParticipantFilter · table-ui.ts tableNameAction, tableRowAction (event → editTableEvent) · table-checks.ts PARTICIPANT_ROLE, recurring (recurringGodparent v buňkách účastníků) · strings.ts table.rows.events, group.event, participants, source, col.ev*, godparents, witnesses, officiants, others, chip.ev*, chipParticipant.*, filterParticipant.*, evKind.*, ageDays, viewName.events · commity 8de751c2, 63ed9def · spec 073 §14.1 · dirigent:prace/1110-app-tabulka-p2 -->

<a id="A6.7.11"></a>
### A6.7.11 Prameny v řádcích

Tabulka pramenů má řádek na každý pramen stromu (**Akce → Prameny**, [A3.1](A3-evidence-in-the-app.md#A3.1)) a říká,
kolik toho pramen ve stromu dokládá.

- **Sloupce** ve skupinách **Pramen** · **Použití**:
  - **Titul**, **Archiv**, **Signatura**, **Folium/strana**, **Snímek**, **Další umístění** ([A3.9](A3-evidence-in-the-app.md#A3.9)),
    **Online** (adresa pramene, jinak stránka jeho prvního výpisu,
    bez `https://`; webová adresa je odkaz ↗ do nového okna, jen http a https, zapsaná bez schématu („www.…“) se
    otevře přes https; klik na odkaz výběr řádku nezmění);
  - **Osob**: kolik osob má údaj, který pramen cituje; údaj svazku dokládá oba partnery;
  - **Údajů**: kolik údajů pramen cituje. Údaj je jeden seznam citací: citace osoby, narození, úmrtí, každá událost
    osoby, sňatek, rozvod a každá událost páru;
  - **Přečteno výzkumem**: kolik čtenářů přepis četlo („1 čtenář“, „2 čtenáři“: člověk v aplikaci a výzkum), jinak „ne“;
  - **Přepis**: ano / ne; v katalogu sloupců je i **Datum záznamu**.
- Výchozí sloupce: **Titul**, **Archiv**, **Signatura**, **Folium/strana**, **Snímek**, **Další umístění**, **Online**,
  **Osob**, **Údajů**. **Přečteno výzkumem** a **Přepis** jsou jen v panelu **Sloupce**.
- Starší pramen má celé umístění v **Další umístění** a nové buňky prázdné. **Signatura**, **Folium/strana** a
  **Snímek** se řadí přirozeně (9 před 10, 57–58 za 34), prázdné na konci v obou směrech; filtrují se jako text.
- Nad tabulkou může stát nabídka **Rozdělit podle návrhu…** ([A3.9.1](A3-evidence-in-the-app.md#A3.9.1)).
- Citace zástupných osob a pramenů příběhu se nepočítají.
- **Čipy:** **Bez osoby** (žádná osoba ho necituje), **Nepřečteno**, **S přepisem**, **Online** (stejně jako sloupec
  **Online**, i s adresou bez `https://`).
- **Ovládání:** vestavěný pohled **Všechny prameny**. U řádku **Otevřít pramen** a **Upravit…**: obojí otevře správce
  pramenů na tom pramenu; **Ukázat ve stromu** tu není.
- **Hranice:** v zamčeném stromu se pramen jen ukáže, bez úprav.
- **Platí od:** aplikace 3.27.0; **Signatura**, **Folium/strana**, **Snímek** a **Další umístění** (dřív **Kniha,
  signatura, folio**) také 3.27.0

<!-- zdroj: app:a97de984 table-columns.ts:898-901 srcSig/srcFolio/srcImageNo, :1026 DEFAULT_VIEWS.sources, přirozené řazení · 8dd21adf table-bar.ts nabídka rozdělení · app:src/ui/table-view/table-sources.ts sourceUsage (PERSON_CITATION_FIELDS, události, PARTNERSHIP_CITATION_FIELDS pro oba partnery, bez zástupných, ne příběh), buildSourceRows (katalog data.sources), sourceReaders (readBy user/research/both) · table-columns.ts SOURCE_COLUMNS, urlCell, shortUrl, readersCell, DEFAULT_VIEWS.sources · table-filter.ts SOURCE_CHIP_ORDER (srcNoPerson persons 0, srcUnread, srcTranscript, srcOnline safeHttpUrl) · table-grid.ts rowTail (source: open + edit) · table-ui.ts tableRowAction (source → openTableSource), openTableSourceId (zamčený strom → showSourceViewer readOnly) · strings.ts table.rows.sources, group.source, group.use, col.src*, chip.src*, readers, act.openSource, viewName.allSources, sources.readBy.* · commity 1a3a49f1, 3cf69ffa · spec 073 §14.2 · dirigent:prace/1110-app-tabulka-p2 · odkaz a čip Online: safeWebUrl (http/https, www. → https, rel noopener noreferrer), commit 7e648e24 (T54 F10, F11) -->

<a id="A6.7.12"></a>
### A6.7.12 Citace a kmotři v tabulce osob

Tabulka osob má sloupce, které ukážou, z jakého pramene je narození, sňatek a úmrtí, a kdo byl kmotrem.

- **Citace** (skupina **Prameny**): **Narození: archiv**, **Narození: signatura**, **Narození: folium/strana**,
  **Narození: snímek**, **Narození: další umístění**, **Narození: URL** a totéž pro **Sňatek** a **Úmrtí**, v tomto
  pořadí; výchozí nejsou. Buňka ukáže hodnotu prvního citovaného pramene; další prameny jsou v tlačítku „+N“. Starší
  pramen má celé umístění v **… další umístění**. Bublina **Další citace**, list řádku pramene na telefonu a sloupec
  pramene v tabulce událostí uvádějí i signaturu, folium a snímek. Webová adresa ve sloupci **… URL** je odkaz do nového okna, jako ve sloupci **Online**
  ([A6.7.11](#A6.7.11)).
  - Narození bere citace narození, pak událostí narození a křtu; úmrtí citace úmrtí, pak událostí úmrtí, pohřbu a
    kremace; sňatek citace svazku (u podřádku svazku toho svazku). Každý pramen jednou.
  - Prameny z původu údaje ve výzkumu se nepočítají, jen citace v datech.
  - U žijící osoby mají sloupce úmrtí **Nevztahuje se**.
  - Řadí a filtruje se podle prvního pramene.
- **Od aplikace 3.27.0:** sloupce signatury, folia/strany, snímku a dalšího umístění (**… signatura** dřív ukazovala
  celé umístění).
- **Kmotři** (skupina **Narození a křest**): kmotři událostí narození a křtu, každý jednou; osoba stromu je odkaz.
  Kmotr, který se opakuje ([A5.5](A5-tree-check.md#A5.5)), má v buňce značku **stopa**.
- **Ovládání:** sloupce se zapínají po jednom v panelu **Sloupce** ([A6.7.2](#A6.7.2)). Klik na „+N“ otevře bublinu
  **Další citace** (na telefonu panel zdola); klik na pramen ho otevře ve správci pramenů.
- **Platí od:** aplikace 3.27.0

<!-- zdroj: app:src/ui/table-view/table-sources.ts factCitations (narození: birthSourceIds + birth/baptism; úmrtí: deathSourceIds + death/burial/cremation; sňatek: sourceIds svazku; neznámé id ven, každý jednou) · table-columns.ts citeCell (první pramen, moreSources), bArch…dUrl (group sources, unionScoped, deathOnly → naCell), godparentsCell (group birth), personGodparents · table-checks.ts personRecurring (sloupec godparents) · table-grid.ts moreCitesHtml · table-ui.ts showTableCites, openTableSourceId · strings.ts table.col.bArch…dUrl (bUrl „Narození: URL“, commit 7e648e24, T54 F10); 3.27.0: a97de984 bSig/bFolio/bImage/bRef…dRef, table-bubble.ts, table-events source text, godparents, moreCites, citesTitle · commity 208d8b92, 21a132c1 · spec 073 §14.3, §14.5 · dirigent:prace/1110-app-tabulka-p2 (citace: jen citace v datech, ne FactReliability.sourceIds) -->

<a id="A6.7.13"></a>
### A6.7.13 Značky v buňkách

Přehled všeho, čím tabulka označí buňku nebo řádek. Legenda **Značky ⓘ** vpravo nad tabulkou (bublina „Značky
v buňkách“, na telefonu panel zdola) ukazuje první dvě tabulky: čtyři úrovně nálezu a pět druhů hodnoty; ve stromu
z výzkumu i třetí, značky výzkumu.

**Nálezy kontroly** ([A6.7.5](#A6.7.5)). Značka stojí na konci buňky za hodnotou; klik na buňku s nálezem otevře
bublinu nálezu.

| Značka | Jak vypadá | Co znamená (legenda) | Kde se objeví |
|---|---|---|---|
| **chyba** | plné červené kolečko s bílým „!“; buňka podbarvená do červena | „Údaje si odporují.“ | buňka údaje, kterého se nález týká; **Nálezy**, **Nejvyšší úroveň**; sbalená skupina |
| **k ověření** | plný jantarový čtvereček se zaoblenými rohy a „?“; buňka podbarvená do jantarova | „Neobvyklá hodnota, stojí za ověření.“ | jako chyba |
| **stopa** | malý prázdný šedý kroužek; buňka bez podbarvení | „Stopa pro pátrání, není to chyba.“ | jako chyba; kmotr, který se opakuje ([A6.7.10](#A6.7.10), [A6.7.12](#A6.7.12)) |
| **neobvyklé** | šedá prázdná hvězdička „☆“; buňka bez podbarvení | „Nález označený „Není chyba“.“ | buňka údaje; **Neobvyklé, ověřené**; **Nejvyšší úroveň**, když jsou všechny nálezy osoby označené |

- Kolečko a čtverec se liší tvarem i znakem, nejen barvou. Čtečka obrazovky značku přečte jako úroveň a text nálezu.
- **Nálezy** má značku nejvyšší úrovně za počtem; **Nejvyšší úroveň** ji má před slovem. Osoba bez nálezu má ve
  sloupci **Nálezy** bledou „0“.
- Sbalená skupina sloupců (úzký pruh) ukazuje nejvyšší značku ze svých buněk.

**Druhy hodnoty.** Žádná z nich není nález.

| Značka | Jak vypadá | Co znamená (legenda) | Kde se objeví |
|---|---|---|---|
| **nejisté datum** | datum podtržené tečkami; slovo **cca**, **před** nebo **po** menším šedým písmem před datem | „Cca, před, po nebo rozsah; není to nález.“ | sloupce dat ([A6.7.3](#A6.7.3)) |
| **spolehlivost** | šedý název stupně (v legendě **Potvrzeno**): **Potvrzeno**, **Doloženo**, **Pravděpodobné**, **Možné**, **Z rodokmenu**, **Vodítko**, **Bez pramene** | „Ve sloupcích Spolehlivost a výzkum; u svazků ve skupině Sňatek, u událostí ve skupině Pramen.“ | **Spolehlivost jména**, **narození**, **úmrtí**, **sňatku** (osoby, svazky), **Spolehlivost** (události); stupně: [S7.1](S7-reliability-and-verification.md#S7.1) |
| **náhradní hodnota** | zkratka **křt.** nebo **pohř.** v malém rámečku před hodnotou, hodnota kurzívou; nápověda „Křest, narození neznámé“, „Pohřeb, úmrtí neznámé“ | „Křest místo narození, pohřeb místo úmrtí.“ | datum a místo narození a úmrtí ([A6.7.3](#A6.7.3)) |
| **dopočteno** | šedé písmo; „≈ 67“ odhad, „28–29“ rozsah | „Rozsah z nepřesného data, ≈ z odhadu.“ | věky, rozdíl zapsaného věku, délka svazku, počty, generace, úplnost; u hlavičky „Vypočteno z: …“ |
| **nevztahuje se** | „–“ šedou kurzívou, v legendě stejně; nápověda „Nevztahuje se“ | „Údaj se osoby netýká.“ | úmrtí u žijící osoby (u **Úplnost úmrtí** „žije“), věk otce nebo matky bez zapsaného rodiče, sloupce svazku u osoby bez svazku, buňky sňatku u svazku bez sňatku (nápověda „Nevztahuje se: svazek bez sňatku“, [A6.7.4](#A6.7.4)), **Věk při události** u narození |

- Ve sloupcích **Spolehlivost …** se řadí od **Potvrzeno** po **Bez pramene** v pořadí z tabulky.

**Značky výzkumu** ([A6.7.14](#A6.7.14)), jen ve stromu z výzkumu. Kolečko výzkumu má kolem sebe lem, takže se i bez
barvy liší od kolečka chyby (bez lemu) a čtverečku k ověření. Legenda dodá: „Kruh s lemem znamená výzkum. ! a ?
výzkumu jsou jen ve sloupcích Výzkum, na údaji smí být jen ≠.“

| Značka | Jak vypadá | Co znamená (legenda) | Kde se objeví |
|---|---|---|---|
| **čeká** | plné jantarové kolečko s lemem a „!“ | „Výzkum čeká na rozhodnutí.“ | **Výzkum**, **Čeká na rozhodnutí** |
| **čeká zvenku** | prázdný jantarový kroužek s „!“ | „Čeká se na odpověď zvenku (dopis, archiv), rozhodovat není co.“ | **Výzkum**, **Čeká na rozhodnutí** |
| **rozpor** | plné jantarové kolečko s lemem a „≠“ | „Prameny se neshodují. Není to chyba v datech: rozhoduje se, kterému prameni věřit.“ | před hodnotou v buňce údaje (bez podbarvení, klik otevře rozpory); **Výzkum**, **Rozpory** |
| **otázka** | plné jantarové kolečko s lemem a „?“ | „Otevřená otázka nebo hypotéza.“ | **Výzkum**, **Hypotézy** |
| **agent** | otáčející se oblouk (při omezeném pohybu stojí) | „Agent u osoby právě pracuje (jen při sledování).“ | **Výzkum**, **Agent**; u jména osoby svislý pruh 3 px |
| **hotovo** | „✓“ | „Agent práci dokončil (na 4 s).“ | za jménem, **Agent** |

- Ve sloupci **Výzkum** je u osoby ve frontě agenta šedá tečka „·“ s „ve frontě“; „+2“ za značkou jsou další druhy
  signálu. Nové od výzkumu má ve svém sloupci tečku „•“.
- Sloupec, který má hodnotu jen při sledování výzkumu, má bez sledování „–“ se štítkem „živě“ (nápověda „Jen při
  sledování výzkumu“). Od aplikace 3.27.0 jen tehdy, když neodpovídá ani most výzkumu ([A6.7.14](#A6.7.14)).

**Další značky** (legenda je neukazuje):

| Značka | Jak vypadá | Co znamená | Kde se objeví |
|---|---|---|---|
| „…“ | bledé tři tečky; nápověda „Kontroly se počítají…“ | kontrola stromu ještě běží | **Nálezy**, **Nejvyšší úroveň**, **Neobvyklé, ověřené** |
| „◌ Kontroly se počítají…“ | prázdný kroužek a text vpravo nad tabulkou | totéž pro celou tabulku; čipy nálezů zatím čekají | nad tabulkou, vedle **Značky ⓘ** |
| procento s proužkem | číslo a krátký proužek, jehož vyplněná část je hodnota | úplnost ([A6.7.4](#A6.7.4)) | sloupce **Úplnost …** |
| tučné číslo, „–“ | v řádku pokrytí | pokrytí pod 50 % (u sloupců úplnosti průměr pod 50 %); „–“ sloupec bez buňky, které by se týkal | **Řádek pokrytí** ([A6.7.4](#A6.7.4)) |
| „+2“ | číslo v oválném rámečku za první citací | další citované prameny; klik otevře **Další citace** | citace narození, sňatku, úmrtí ([A6.7.12](#A6.7.12)) |
| „↗“ | za podtrženou webovou adresou | odkaz do nového okna | **Online**, citace „… URL“ ([A6.7.11](#A6.7.11), [A6.7.12](#A6.7.12)) |
| obrys buňky | tenký obrys 1 px | aktivní buňka ([A6.7.15](#A6.7.15)) | buňka vybraného řádku |
| textový kurzor | při najetí myší | buňka jde upravit na místě ([A6.7.15](#A6.7.15)) | upravitelné buňky |
| ●○, ●● | jedna nebo dvě plné tečky před „1 čtenář“, „2 čtenáři“; nápověda, kdo přepis četl | kolik čtenářů přepis četlo | **Přečteno výzkumem** ([A6.7.11](#A6.7.11)) |
| „12 d.“ | číslo s „d.“ | věk do jednoho roku ve dnech | **Věk při události** ([A6.7.10](#A6.7.10)) |
| ▾, ▸ | trojúhelník před jménem | svazky osoby rozbalené, sbalené ([A6.7.1](#A6.7.1)) | **Celé jméno** osoby se dvěma a více svazky |
| „3 svazky“ | u sbalené osoby v oválném rámečku za jménem; u rozbalené ve sloupci **Partner** šedou kurzívou | počet svazků osoby | řádek osoby |
| „└ Svazek 2 z 3“ | odsazený podřádek | jeden svazek osoby | podřádek svazku |
| „2 svazky mimo filtr · ukázat“ | tlačítko v odsazeném řádku | svazky, které nevyhoví filtru; ukázané jsou znevýrazněné | pod podřádky svazků |
| „nevyhovuje filtru“ | celý řádek bledý, text kurzívou na konci | řádek po úpravě už filtru nevyhovuje ([A6.7.8](#A6.7.8)) | do další změny řazení, filtru nebo pohledu |
| zvýraznění | podbarvené písmo shody | shoda hledání ([A6.7.6](#A6.7.6)) | viditelné sloupce |
| ↑, ↓ (↑1, ↓2) | šipka v hlavičce, s číslem při více klíčích | směr a pořadí klíče řazení ([A6.7.6](#A6.7.6)) | hlavička sloupce |
| −, + | znak u názvu skupiny | sbalit, rozbalit skupinu sloupců ([A6.7.2](#A6.7.2)) | řádek skupin nad hlavičkou |

- **Hranice:** export CSV značky ani barvy nenese; XLSX nese jen podbarvení a komentář u chyby a k ověření ([A6.7.9](#A6.7.9)).
- **Ovládání:** **Značky ⓘ** vpravo nad tabulkou.
- **Platí od:** aplikace 3.27.0

<!-- zdroj: app:src/ui/table-view/table-grid.ts MARK_GLYPH (error „!“, warning „?“, info prázdný, unusual „☆“), markHtml (role img, aria-label úroveň: text), cellClasses (aggregate, na, computed, uncertain, subst, ghost, issue), cellText („–“), cellInner (značka za hodnotou; u čísla vpravo za, jinak před slovem), moreCitesHtml „+N“, cellValueCore (tv-comp proužek 30 px, tv-subst, tv-qual), linkHtml „ ↗“, readersHtml (fs-dots), nameCell (▾/▸, tv-unions-pill unionsN, └ unionKofN, hiddenUnions), sort mark ↑/↓ s číslem, tv-group-toggle −/+ · table-bubble.ts legendHtml (4 značky + uncertain „1890–1892“, reliability ✓, subst křt., computed „≈ 67“, na „–“) · table-bar.ts createStatus (◌ checksRunning, legenda „Značky ⓘ“) · table-columns.ts checksPendingCell („…“ ghost), findingsCell („0“ ghost), topSeverityCell, unusualCell (☆), pillCell + reliabilityText + RELIABILITY_RANK (human, proven, probable, possible, import, lead, none), readersCell (dots [true, n > 1]), naCell (relD, fAge, mAge, unionScoped bez svazku, evAge narození), eventAge (ageDays) · table-subrows.ts aggregate „n svazků“ · table-checks.ts bandSeverity · table-coverage.ts LOW pod 50 % · index.html CSS .tv-mark--error (kolečko 16 px, --danger), --warning (čtverec radius 3px, --warning), --info (kroužek 10 px, okraj --text-faint), --unusual, .tv-cell--error/--warning (danger-soft, warning-soft), --uncertain (dotted), --na (kurzíva), --computed, .tv-subst, .tv-cites-more, .tv-row.is-stale, .tv-stale-note, mark.tv-hit · strings.ts table.legend, legendTitle, legendKind.*, legendText.*, sev.*, subst.*, qual.*, na, living, checksRunning, moreCites, citesTitle, readers, ageDays, unionsN, unionKofN, hiddenUnions, staleRow, col.relN/relB/relD/relW/evRel, reliability.human/proven/import/none, factStatus.probable/possible/lead · app f34d41e1 · Milan 10. 11. (dirigent:prace/1110-doc-tabulka-znacky bod 1) · pořadí stupňů podle RELIABILITY_RANK (Z rodokmenu před Vodítko), dirigent:prace/_drobnosti/doc.md · značky výzkumu: table-grid.ts RESEARCH_GLYPH (wait „!“, ext „!“, conf „≠“, q „?“, agent oblouk, done „✓“, queue „·“, new „•“), researchMarkHtml, conflictMarkHtml (≠ před hodnotou) · index.html .tv-rmark--wait/conf/q (kolečko 16 px, --signal-warn, lem box-shadow), --ext (prázdný kroužek), --agent (agSpin, prefers-reduced-motion), --done, .tv-agent-bar (3 px) · strings.ts table.res.legendName, legendText, legendNote, liveTag, liveOnly · aktivní buňka a kurzor: commity 05d9a9ab, be9ca8cd · spec 073 §16.3, U7 -->

<a id="A6.7.14"></a>
### A6.7.14 Výzkum v tabulce

Ve stromu z výzkumu ([S1](S1-connecting-app-and-research.md)) tabulka ukáže i to, co o osobách ví výzkum: co čeká na
rozhodnutí, rozpory pramenů, hypotézy, práci agenta, linie a výměnu se stromem. Do stromu nic nezapisuje.

- **Sloupce osob** (skupina **Výzkum**, ve výchozím stavu skrytá; zaškrtávátko **vše** zapne **Výzkum**, **Čeká na
  rozhodnutí**, **Rozpory**, **Hypotézy** a **Agent**):

  | Sloupec | Co ukazuje |
  |---|---|
  | **Výzkum** | nejnaléhavější signál osoby v pořadí čeká › rozpor › otázka nebo hypotéza › agent › ve frontě; „+n“ další druhy |
  | **Čeká na rozhodnutí** | počet a první položka; u čekání na jiné „zvenku: …“ (dopis odeslán, dotaz na rodinu …) |
  | **Rozpory** | počet otevřených rozporů a údaje („· narození, …“); „· lze rozhodnout v aplikaci“, kde to jde ([S2](S2-edits-from-the-app.md)) |
  | **Hypotézy** | počet otevřených hypotéz; „rozhodl agent“ |
  | **Úkoly výzkumu** | úkoly osoby ve frontě („2 · nejbližší 3. ve frontě“, „1 · právě běží“) |
  | **Agent** | „pracuje: {úkol}“, „ve frontě“, „hotovo“ |
  | **Linie** | místo osoby mezi liniemi (níže) |
  | **Materiály**, **Strom tu končí**, **Hledáno bez výsledku**, **Výměna s výzkumem**, **Původně v rodokmenu**, **Příběh**, **Kde se vyřizuje**, **Nové od výzkumu**, **Dostupnost pramenů**, **Farnost (výzkum)**, **Odhad narození** | co výzkum ví o materiálech osoby, o kraji stromu, o výměně se stromem, o pramenech a místech |

- **Svazky:** **ID výzkumu** (F…), **Linie** (podle partnera z linie), **Agent** („pracuje na páru: …“) a **Rozpory**
  (rozpory ke sňatku a rozvodu u obou partnerů). **Prameny:** **ID výzkumu** (S…) a **Obraz**: „v počítači výzkumu“,
  „sken chybí v počítači výzkumu“ (zvýrazněné), „online (archiv)“.
- **Linie:** v linii (partner osoby z linie „· partner“; vedlejší větev přidaná k linii patří do té linie),
  „vedlejší větev: {jméno}“, „ostrov“, „mimo linie“. **Mimo linie** jsou vedlejší větve nepřidané k linii, ostrovy a
  ostatní ([R2.3](R2-lines-and-queue.md#R2.3)). Linie bere tabulka živě z výzkumu, jinak ze souboru výzkumu; řadí se
  v pořadí linií výzkumu, pak větve, ostrovy a mimo linie, uvnitř podle generace. Sloupec i čipy linií jsou jen
  u výzkumu s liniemi.
- **Rozpor na údaji:** buňka údaje s otevřeným rozporem pramenů má před hodnotou „≠“, bez podbarvení. Klik na „≠“
  otevře bublinu s rozpory; čtečka obrazovky přečte „{hodnota}, rozpor pramenů: {údaj}“. Značky „!“ a „?“ výzkumu
  jsou jen ve sloupcích výzkumu ([A6.7.13](#A6.7.13)).
- **Čip Výzkum ▾:** jeden čip s nabídkou v oddílech **Signály**, **Linie**, **Výměna, prameny a místa**, **Další čipy
  výzkumu** a **Nové od výzkumu**; „Výběrem se blok Výzkum v řadě rozbalí.“ Čipy: **Čeká na rozhodnutí**, **S
  rozporem**, **S otázkou**, **Agent pracuje / ve frontě**, jeden na každou linii a **Mimo linie** (s počty),
  **Neodesláno**, **Změněno výzkumem**, **Rozhodnout tady**, **Čeká zvenku**, **Nové od výzkumu** (za 24 h, za 7 dní,
  od posledního otevření), **Jen v badatelně**, **Místo neurčeno**, **Rozhodl agent**, **Pozastaveno / odloženo**,
  **Strom tu končí**. Na telefonu je oddíl **Výzkum** v panelu **Filtry**, méně časté čipy pod **Další výzkum (n)**.
- **Vestavěné pohledy** (oddíl **Výzkum** v nabídce **Pohled**; jako ostatní vestavěné se nemění, [A6.7.7](#A6.7.7)):

  | Pohled | Co ukazuje |
  |---|---|
  | **Výzkum** | osoby se signálem: jméno, Výzkum, Čeká na rozhodnutí, Rozpory, Hypotézy, Agent, Úkoly výzkumu, narození, úmrtí; řazeno od nejnaléhavějšího, pak podle jména |
  | **Linie: {linie}** (pro každou linii) a **Mimo linie** | jméno, Linie, generace, Výzkum, narození, úmrtí, Rozpory, Agent; čip linie; řazeno podle linie |
  | **Výměna s výzkumem** | osoby s výměnou: jméno, Výměna s výzkumem, Původně v rodokmenu, Nové od výzkumu, Rozpory, narození |

  Svazky jsou v nich sbalené a řádek pokrytí zapnutý. Prázdný pohled řekne „Výzkum teď nic nepotřebuje“ nebo „Strom a
  výzkum jsou srovnané“.
- **Bublina výzkumu:** klik na buňku výzkumu otevře bublinu (na telefonu panel zdola) s oddíly podle toho, co osoba
  má: **Čeká na rozhodnutí · n** (**Porovnat verze ›**, **Čeká na vyřízení ›**), **Čeká zvenku**, **Rozpory pramenů · n**
  (**Rozhodnout ›**), **Hypotézy** nebo **Otevřená otázka** (**Co ví výzkum ›**, [S3.5](S3-what-the-research-knows.md#S3.5)),
  **Agent pracuje** (**Sledovat výzkum ›**), **Úkoly výzkumu ve frontě** (**Otevřít úkol ve výzkumu**), **Materiály ›**,
  **Linie** nebo **Mimo linie** (**Ukázat linii ve stromu**, **Změnit ve výzkumu**), **Původně v rodokmenu** (**Vrátit
  hodnotu z rodokmenu**, jen s výzkumem na tomto počítači) a **Dostupnost pramenů**. Akce, která se potvrzuje ve
  výzkumu, má značku jako jinde ([S4.5.1](S4-research-from-the-app.md#S4.5.1)).
- **Naživo:** při sledování výzkumu se mění jen buňky, kterých se změna týká, pořadí řádků zůstane. U jména osoby,
  na které agent pracuje, běží svislý pruh. Nad tabulkou stojí „● Výzkum sledován naživo“, jinak „Výzkum: stav z
  {kdy}“.
- **Export:** CSV a XLSX nesou texty a počty („čeká; rozpor (1)“, „1: narození“, bez rozporu „0“), bez značek.
  Bez sledování (od aplikace 3.27.0 jen bez odpovědi mostu) jsou **Agent** a **Úkoly výzkumu** prázdné a oznámení řekne „Agent a Úkoly výzkumu jsou prázdné:
  výzkum se nesleduje.“ Řádek pokrytí má u sloupců výzkumu „–“.
- **Hranice:**
  - bez agenta (Archiv Stromu) a ve stromu jen ke čtení nejsou **Čeká na rozhodnutí**, **Úkoly výzkumu** a **Agent**
    ani čipy **Neodesláno** a **Rozhodnout tady**; pohled **Výměna s výzkumem** je jen ve výzkumu s agentem, který
    jde měnit;
  - **Agent** a **Úkoly výzkumu** mají hodnotu jen při sledování výzkumu, jinak „–“ se štítkem „živě“; čip **Agent
    pracuje / ve frontě** bez sledování nefiltruje. Od aplikace 3.27.0 platí obojí jen bez odpovědi mostu (níž);
  - ve stromu jen ke čtení bublina nemá akce: „Jen ke čtení: rozpory tu nejde rozhodnout.“
- **Bez sledování s mostem:** když most výzkumu na tomto počítači odpovídá, berou **Agent** a **Úkoly výzkumu** (i pruh
  u jména, čip **Agent** a export) práci agenta a frontu z pravidelného dotazu na most a vypadají jako při
  sledování. Prázdná fronta mostu nechá buňky prázdné. Tabulka se překreslí, když se odpověď mostu změní. Telefon se
  mostu neptá. Stejně funguje Přehled výzkumu bez sledování ([S4.1.5](S4-research-from-the-app.md#S4.1.5)).
- **Ovládání:** panel **Sloupce** → skupina **Výzkum**; čip **Výzkum ▾**; **Pohled** → oddíl **Výzkum**; **Značky ⓘ**.
- **Platí od:** aplikace 3.27.0 s výzkumem 1.31.0

<!-- zdroj: app:src/ui/table-view/table-research.ts RESEARCH_COLUMNS, RESEARCH_DEFAULT_COLUMNS (rSum, rWait, rConf, rHyp, rAgent), LIVE_ONLY (rTasks, rAgent), NEEDS_AGENT (rWait, rTasks, rAgent), rSum pořadí (čeká 5 › rozpor 4 › otázka 3 › agent 2 › fronta 1), researchLinesOf (živě /directions/people, jinak soubor _STROM_DIRECTION), personLineRole, isOffLine, researchChips, RESEARCH_SIGNAL_CHIPS, RESEARCH_MORE_CHIPS, researchChipOffer (xUnsent, xDecideHere jen research a ne jen ke čtení), researchChipActive (live), unionLineRole, unionResearchCell (UNION_FACTS), sourceImageCell, unionResearchIdCell, sourceResearchIdCell · table-views.ts pohledy Výzkum, Linie, Mimo linie, Výměna s výzkumem · table-research-bubble.ts, table-research-ui.ts · table-grid.ts conflictMarkHtml · table-export.ts (exportNotLive) · strings.ts table.res.*, table.col.r*, uResearchId, srcResearchId, srcImage · commity 53137620, 99b60acb, a2e1dc73, 02e88e9a, 32958eb4, fd9c220f, cf9e63d8, 4635c16e, 5857be6b, 970e6b88, 6b66e037, 9e51ff66 · research: GET /directions/people, funkce directions.places, brána APP_SHOWS_RESEARCH_TABLE (src/core/stromapp.ts), CHANGELOG.cs.md 1.31.0 „Výzkum v tabulce aplikace Strom“ · spec 073 §16, K7.1–K7.8 · bez sledování s mostem: app 8d564b35 src/ui/research-ui.ts unfollowedAgentNow (onComputer, researchStatusNow, status.working a queue), src/ui/table-view/table-ui.ts tableResearchAgentChanged · spec 057 K1.12 -->

<a id="A6.7.15"></a>
### A6.7.15 Aktivní buňka, nabídka buňky a úprava na místě

Klik na buňku vybere řádek a udělá z buňky aktivní buňku (tenký obrys); šipky ji posouvají. Aktivní buňku jde
zkopírovat, podle její hodnoty filtrovat a údaj v ní upravit přímo v tabulce.

- **Kopírovat:** Ctrl/Cmd+C bez vybraného textu zkopíruje text, který aktivní buňka ukazuje, bez značek, ikon a
  pilulek. Ručně vybraný text se kopíruje jako obvykle.
- **Nabídka buňky:** nabídka řádku (pravé tlačítko, Shift+F10) a na telefonu panel řádku (klepnutí na buňku) začínají
  volbami buňky **Kopírovat**, **Jen „{hodnota}“** a **Bez „{hodnota}“** (hodnota zkrácená asi na 24 znaků s „…“); pod
  nimi jsou akce řádku ([A6.7.8](#A6.7.8)). Nabídka se otevře u buňky, i když byl vybraný jiný řádek.
  - **Jen** a **Bez** nastaví filtr sloupce **je** / **není** ([A6.7.6](#A6.7.6)), čip „{Sloupec} = {hodnota} ×“ nebo
    „{Sloupec} ≠ {hodnota} ×“; porovnává se bez ohledu na velikost písmen a diakritiku. Buňka se jménem osoby porovnává
    osobu: **Jen „{otec}“** ve sloupci **Otec** ukáže sourozence, ne děti jmenovce.
  - Prázdná buňka nabídne **Jen prázdné** a **Jen vyplněné**, buňka s výčtem nastaví filtr hodnot. Buňka bez jedné
    hodnoty k porovnání (značka výzkumu, více jmen, úplnost, počet svazků) nabídne jen **Kopírovat**; vlastní jméno
    nebo titul řádku má jen akce řádku.
  - Filtr se uloží s pohledem ([A6.7.7](#A6.7.7)).
- **Úprava na místě:** upravit jde buňku, která stojí za jedním údajem stromu:
  - **Křestní jméno**, **Příjmení** (ukazuje-li příjmení po sňatku, upraví ho), **Rodné příjmení**, **Příjmení po
    sňatku**;
  - **Pohlaví** výběrem (**Muž**, **Žena**, **Neznámé**) a **Ref. číslo**;
  - datum a místo narození, křtu, úmrtí a pohřbu, **Příčina úmrtí** a **Zapsaný věk při úmrtí**;
  - **Povolání**, dokud má osoba nejvýš jedno;
  - údaje svazku (tabulka svazků, podřádek svazku, řádek osoby s jedním svazkem): **Stav svazku** výběrem
    (**Manželství**, **Partneři**, **Rozvedení**, **Odloučení**, jako ve formuláři svazku), datum a místo sňatku,
    zapsaný věk každého z partnerů při sňatku (**Zapsaný věk při sňatku**, **Zapsaný věk partnera**, **Zapsaný věk
    1** a **2**), **Datum rozvodu** a **Místo rozvodu**. Prázdná buňka údaj svazku založí, jako ho založí formulář
    svazku. U svazku bez sňatku ([A6.7.4](#A6.7.4)) se buňky sňatku neupravují.

  **Celé jméno** se v buňce neupravuje (skládá se z více částí), stejně jako dopočtené buňky, kontroly, výzkum, citace,
  počty a vztahy; dvojklik na ně otevře **Upravit…**.
- **Pole** zakryje buňku. **Enter** uloží, **Esc** zruší, **Tab** a **Shift+Tab** uloží a přejdou na další nebo
  předchozí upravitelnou buňku řádku, klik jinam uloží. Ve výběru uloží hodnotu klik myší hned; po výběru šipkami
  ji uloží Enter, Tab nebo klik jinam. Datum se čte jako ve formuláři osoby; nečitelné zůstane
  v poli s chybou „Datum nejde přečíst (např. 15.5.1880, 1880, kolem 1880)“. Místo nabízí místa stromu. Bez jména
  i příjmení se neuloží nic: „Jméno nebo příjmení musí zůstat“.
- **Uložení** jde stejnou cestou jako formulář osoby (údaje svazku jako formulář svazku) a je to jeden krok zpět
  (Ctrl/Cmd+Z), i když prázdná buňka údaj založila. Křest a pohřeb upraví první
  takovou událost (její další údaje a citace zůstanou), nebo ji přidá; prázdné pole smaže jen ten údaj. Pak řádek
  blikne, zůstane na místě a oznámení řekne „Uloženo: {jméno}“.
- **Hranice:** na místě nejde upravovat ve stromu jen ke čtení nebo zamčeném, v Archivu Stromu, na telefonu a
  u zamčené osoby. Na telefonu se údaj upraví přes panel řádku → **Upravit…**.
- **Ovládání:** dvojklik, **F2**, **Enter** na aktivní buňce (u buňky s nálezem otevře Enter nejdřív bublinu nálezu),
  v nabídce řádku **Upravit buňku** (F2). Upravitelná buňka má při najetí myší textový kurzor.
- **Platí od:** aplikace 3.27.0

<!-- zdroj: app:src/ui/table-view/table-grid.ts copyKey (Ctrl/Cmd+C, copyPlainText), F2, Enter (has-issue → onIssue, has-finds → onFindings, jinak startEditAt, jinak open), Escape, Tab · table-ui.ts showTableRowMenu (cellPart, cell-edit „Upravit buňku“ s F2), tableCellChoices, tableCellSheetBlocks, :1663 úprava na místě ne v jen ke čtení, archivu, na telefonu (isPhoneBar) · table-edit.ts editTargetOf, PERSON_FIELDS (surname: marriedSurname || lastName, birthSurname, marriedSurname, bDate…burPlace, occ), UNION_FIELDS (wDate, wPlace), editChangeOf (normalizeDateInput, první křest a pohřeb, prázdné pole smaže jen údaj, beze jména neuloží) · strings.ts table.cell.copy, only, without, edit, badDate, nameNeeded, editLabel, onlyEmpty, onlyFilled, matchEquals, matchNotEquals, savedToast · commity 05d9a9ab, be9ca8cd, 28aabdc8 · spec 073 U9 (T54 F4, F8, F9) · T54 2. kolo: table-edit.ts PERSON_FIELDS (firstName, gender, refn, dCause, dAgeRec), UNION_FIELDS (wAgeRec, pAgeRec, rec1, rec2, divDate, divPlace, uStatus), WEDDING_FIELDS (ne u unionWithoutWedding), editOptionsOf (GENDERS, UNION_STATUSES v pořadí formuláře svazku), table-grid.ts select (klik myší uloží hned), commity 8fdf52ca, 79764eba (T54 G3, G10) · nabídka u buňky jiného řádku: commit 400ccda8 (T54 G7) -->
