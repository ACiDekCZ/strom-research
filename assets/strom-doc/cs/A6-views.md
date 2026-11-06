<a id="A6"></a>
# A6 Pohledy a výběr osob

Jak aplikace Strom vybírá, které osoby ukáže, a jak je ukazují jednotlivé pohledy. Popisuje aplikaci 3.21.2; změny z novější verze mají u sebe její číslo.

Pohled je jiné čtení **téhož výběru osob**. Výběr určuje ústřední osoba (ta, na kterou se klikne) a hloubka
**Předci** a **Potomci**. Rodina, Potomci, Časová osa a Mapa ukazují stejné okolí ústřední osoby. Vějíř si
předky a potomky počítá sám podle počtu generací ([A6.4](#A6.4)).

| Pohled (cs) | en | de | pl |
|---|---|---|---|
| **Rodina** | Family | Familie | Rodzina |
| **Potomci** | Descendants | Nachkommen | Potomkowie |
| **Časová osa** | Timeline | Zeitleiste | Oś czasu |
| **Vějíř** | Fan | Fächer | Wachlarz |
| **Mapa** | Map | Karte | Mapa |

<!-- zdroj: app:src/types.ts:1237 ViewMode · strings.ts viewModeSwitch.* -->

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

<!-- zdroj: app:src/fan-chart.ts FAN_MIN_GENERATIONS, FAN_MAX_GENERATIONS, FAN_DEFAULT_GENERATIONS, parentSlots, repeatOf · strings.ts fan.shapeHalf, fan.shapeFull, fan.shapeTwo, fan.colorGender, fan.colorLine, fan.colorRod, fan.legendRepeats, fan.originPerson, fan.showFirst, fanChart.kekuleHint · settings fanKekule (výchozí false) · spec 029 · CHANGELOG.cs.md 3.20.0 -->

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
