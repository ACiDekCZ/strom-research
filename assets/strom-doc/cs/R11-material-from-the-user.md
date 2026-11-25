<a id="R11"></a>
# R11 Podklady od uživatele

Co výzkum udělá se soubory, texty a rodokmeny, které mu dá uživatel: v terminálu, nebo z aplikace Strom. Jak se
materiál posílá z aplikace, popisuje [A3.5](A3-evidence-in-the-app.md#A3.5); odpověď souborem na úkol, který čeká,
[R6.7.1](R6-awaiting-action.md#R6.7.1). Popisuje výzkum 1.27.0; změny z novější verze mají u sebe její číslo.
U pravidel je rozlišeno, co **hlídá kód** a co je jen **pravidlo metodiky**.

<a id="R11.1"></a>
## R11.1 Každý soubor je podklad s úkolem

Každý soubor se ve výzkumu uloží beze změny jako podklad a dostane úkol podklady. Agent z něj zapíše jen to, co
v něm skutečně stojí.

- **Hlídá kód:**
  - stejný soubor podruhé se přeskočí (pozná se podle obsahu, ne podle názvu);
  - soubory do 20 MB jsou ve stromu a v jeho historii, větší ve sdíleném úložišti médií;
  - složka s víc než 20 obrázky se bere jako skeny knihy, ne jako rodinné doklady (`--documents` řekne opak);
  - rodokmen má vlastní úkol; ostatní soubory jedné složky mají jeden společný úkol;
  - úkol podklady nikdy nečeká mimo frontu ([R2.2.3](R2-lines-and-queue.md#R2.2.3)). V Archivu Stromu se odloží
    ([R7.8](R7-when-the-agent-works.md#R7.8)).
- **Jen metodika:** jména a místa se zapisují tak, jak jsou napsaná; sjednocují se jen data. Úkol se zavře s tím,
  co z podkladu vzešlo, a s dalšími úkoly: kde hledat záznamy, které vodítka doloží.
- **Proč:**
  - 20 obrázků: skeny matriky nepatří do historie stromu jako stovky úkolů podklady. Rodinné doklady jedné složky
    bývají jednotky až desítky souborů; víc než 20 obrázků už obvykle jsou skeny knihy a zapíšou se jako kniha;
  - 20 MB: historie stromu se nepřepisuje a jde se stromem při záloze a přenosu. Velké soubory (video, nekomprimované
    skeny) by ji natrvalo zvětšily, proto leží ve sdíleném úložišti médií.
- **Ovládání:** terminál: `strom intake <soubory nebo složky>`, `strom intake --text "…"` (co řekne uživatel),
  `strom input list`, `strom input show I…`. Aplikace: **Poslat materiál…**, **Přidat materiály…**
  ([A3.5](A3-evidence-in-the-app.md#A3.5)).
- **Platí od:** výzkum 1.0.0
- **Od výzkumu 1.36.0:** úkol podklady dostane soubor jen se zapnutým `intake.auto` nebo s `--sort`; jinak čeká
  v Materiálech neroztříděný ([R11.6](#R11.6)). Text (`--text`) dostane úkol vždy.

<!-- zdroj: research:src/commands/intake.ts intake (description, BOOK_OF_SCANS=20, sha256 known, intakeTask) · research:src/core/media.ts MAX_IN_TREE=20 MB · research 1.0.0 = commit 48698860 · research:assets/method/intake.md kroky 1, 4, 6, 7 -->

<a id="R11.2"></a>
## R11.2 Doklad je pramen, ostatní je vodítko

Z podkladu může být pramen, který dokládá údaje, nebo jen vodítko, které říká, kde hledat. Rozhoduje, co je to za
dokument, ne kdo ho poslal.

- **Jen metodika:**
  - úřední nebo církevní doklad (rodný, oddací, úmrtní list, výpis z matriky, vojenské papíry) je pramen
    (`--form original`; `--information primary`, když byl psaný v době události);
  - fotka, dopis, rodokmen a vzpomínka jsou dílo autora nebo odvozený pramen: co z nich pochází, zůstane
    **Vodítko**;
  - co řekne uživatel, je vzpomínka rodiny (`--kind family-memory --form authored --information secondary`);
  - víc údajů z jednoho podkladu se zapíše jednou dávkou (`strom batch`): všechno, nebo nic.
- **Hlídá kód:** údaj jen ze vzpomínky, rodokmenu nebo autorského díla nikdy není Pravděpodobné ani Doložené
  ([R3.2](R3-verification-and-citation.md#R3.2)).
- **Ovládání:** terminál: `strom source add "…" --input I… --form … --information …`.
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:assets/method/intake.md krok 2 · research:src/core (weak sources: family-tree, family-memory, authored) -->

<a id="R11.3"></a>
## R11.3 Převzatý rodokmen

Rodokmen (GEDCOM nebo soubor aplikace Strom) jsou závěry někoho jiného, ne záznam. Výzkum ho převezme celý, ale jen
jako vodítka.

- **Hlídá kód:**
  - rodokmen se načte hned při převzetí: každá osoba a každý údaj jako **Vodítko** s citací jednoho pramene druhu
    rodokmen (`--kind family-tree`, `--form authored`). Každá osoba si pamatuje, odkud přišla;
  - osoby stromu tohoto výzkumu, které se vracejí ze souboru aplikace Strom, se spárují podle svého čísla ve
    výzkumu a nezaloží se podruhé. Čísla jiného výzkumu se nepárují nikdy;
  - `--no-import` rodokmen jen uloží a nenačte.
- **Jen metodika:**
  - duplicity a nemožná data se zkontrolují, ale „neopravují“ se zpaměti; jsou to vodítka;
  - osoba rodokmenu, která už je ve výzkumu zkoumaná, se sloučí **do** zkoumané osoby, nejdřív její rodiče
    ([R10.2](R10-people-and-hypotheses.md#R10.2)). Zkoumaná osoba si drží své doklady;
  - v čem se rodokmen liší, zůstane vodítkem, nebo se stane rozporem; nikdy údajem.
- **Ovládání:** terminál: `strom intake rodokmen.ged`. Načtení rodokmenu do aplikace popisuje
  [A2](A2-loading-a-family-tree.md).
- **Platí od:** výzkum 1.0.0
- **Od výzkumu 1.30.0:**
  - každý údaj má původ (z rodokmenu, od člověka, z výzkumu). Údaj z rodokmenu agent změní jen s citovaným záznamem,
    jinak navrhne; údaj člověka jen navrhne. Hodnota z rodokmenu zůstane uložená a vrátit ji smí jen člověk
    (`strom event revert`, `strom person revert`) ([S6.3](S6-tree-from-another-program.md#S6.3)). Hodnota ze souboru
    aplikace Strom, kterou nikdo od převzetí nezměnil, je z rodokmenu uživatele: chráněná jako údaj člověka, ale
    za potvrzenou člověkem neplatí;
  - ID programu (`_UID`, `EXID`, `_FSFTID` …) se uchovají: tentýž rodokmen převzatý znovu nikoho nepřidá dvakrát;
    osoba jen možná tatáž se nespojí a výsledek ji uvede (`candidates`); co se nepřevzalo, výsledek spočítá
    (`notTaken`) ([S6.8](S6-tree-from-another-program.md#S6.8));
  - soubor ve Windows-1250 nebo Windows-1252 („ANSI“) se čte se správnými písmeny;
  - pramen rodokmenu nemá stranu (`PAGE`): každý údaj uvádí svůj řádek z rodokmenu;
  - výzkum založený dřív se po aktualizaci jednou označí (`strom fixes undo origins` vezme zpět).
- **Od výzkumu 1.32.0:**
  - strom z aplikace Strom dává ze souboru JSON i GEDCOM totéž. Převezme se i společná událost více osob s rolí
    každé osoby ([A10.1](A10-shared-events.md#A10.1)), vlastní události **Kmotrovství** a **Svědek při sňatku**
    pojmenované v jazyce výzkumu (ze souboru GEDCOM od výzkumu 1.34.0, dřív podle TYPE souboru v jazyce, ve kterém běžela aplikace), s odkazem na křest nebo sňatek ([A10.5.1](A10-shared-events.md#A10.5.1)), kmotři,
    svědci, oddávající a porodní bába u událostí osoby (propojení s osobou i jen jménem), svědci sňatku a další
    události páru s účastníky a poznámkou. Výzkum je drží u každého údaje a vrací je aplikaci, jak přišly;
  - ze souboru JSON se převezme i příčina a věk úmrtí, adresa narození a úmrtí, adresa a věky u sňatku, poměr dítěte
    ke každému rodiči, rozvod a rozchod s datem, poznámka páru, věk osoby u společného sčítání, rodina jen jednoho
    rodiče a příjmení po sňatku. Zástupné osoby („?“) se vynechají;
  - poznámka události se převezme celá. Poznámka osoby a rodiny ze stromu uživatele se nezkracuje na 500 znaků;
    limit 500 znaků platí pro poznámky, které píše výzkum a agent;
  - `ROLE` účastníka podle GEDCOM 7 se čte i v souboru jiného programu;
  - porodní bába jde do aplikace jako **Přítomen** s poznámkou „porodní bába“.
- **Od výzkumu 1.36.0:** v souboru pro aplikaci Strom má každá citace rodokmenu bez vlastního umístění jako stranu
  (`PAGE`) svůj řádek z rodokmenu, takže aplikace ukazuje u každé citace její řádek. Ukazatel, který zapsal import
  nebo synchronizace („I1 BIRT“, „BIRT DATE PLAC“, „family“), ani citace bez řádku `PAGE` nedostanou. Řádek zůstává
  i v `DATA` › `TEXT`. Rodokmen vrácený z aplikace beze změny není úprava uživatele a nic se necituje dvakrát; řádek
  změněný v aplikaci je úprava uživatele jako u každého pramene.

<!-- zdroj: research:src/core/import.ts hlavička ("as LEADS", oursByRefn), source kind family-tree form authored :113-117, status lead :294 · research:src/commands/intake.ts --no-import · research:assets/method/intake.md krok 5 · research:94d75934 src/core/import.ts (soubor aplikace Strom → origin user + tree), src/core/model.ts ValueOrigin.tree · 1.32.0: research:ac489205 src/core/import.ts importStromJson (godparent/weddingWitness → EVEN v jazyce výzkumu s roleAt, participants, partnerships[].participants, shareId/shareRole), src/core/roles.ts, src/gedcom/export.ts (porodní bába RELA Present + poznámka), celá poznámka události · research:f8eb2032 Note.whole, makeNote 500, factDetails, partnersAges, childRelation · research:01125661 appNobody, appMarriedName, appUnionFacts, appLooseFamilies · research:CHANGELOG 1.32.0 „Events shared in the Strom app“ · src/core/live.ts BRIDGE_FEATURES event.share · dirigent:prace/1113-vyzkum-085-json, 1113-vyzkum-json-intake-uplny, 1113-vyzkum-json-intake-drobnosti Výsledek · 1.34.0: research:aa0d53d5 src/core/import.ts gedRoleEventLabel (B6) · 1.36.0: research:519951b3 src/gedcom/export.ts stromPage (family-tree: PAGE = locator citace, ne treePointer), citation where (DATA TEXT i vedle PAGE), src/core/sourcefields.ts treePointer · test/cli/origin-ids.test.ts · CHANGELOG.cs.md 1.36.0 -->

<a id="R11.4"></a>
## R11.4 Dávka z aplikace

Složku, ZIP nebo krabici dokumentů poslanou z aplikace výzkum přijme jako jednu dávku. Agent ji pak roztřídí po
úkolech.

- **Hlídá kód:**
  - dávka se uzavře, když aplikace ohlásí, že je celá, nebo den po posledním souboru (dávka z telefonu hodinu po
    poslední fotce, [S5.4](S5-phone.md#S5.4));
  - pak se z ní stanou úkoly podklady po zhruba 25 souborech, podle složek, ve kterých soubory přišly. V Archivu
    Stromu úkoly čekají odložené;
  - soubory dávky se ukládají jako originály do sdíleného úložiště médií, ne do historie stromu. Co z nich agent
    nezapíše, zůstane soukromé;
  - soubor označený jako nesouvisející (`--as unrelated`) potřebuje důvod. Přeskočí se a nic z něj se nezapíše.
- **Jen metodika:**
  - agent si nejdřív levně prohlédne všechny soubory úkolu (náhledy v mřížce) a každý hned zařadí: záznam
    (pramen), dokument, fotka, nesouvisející, a čí je. Do hloubky čte jen to, co patří lidem výzkumu;
  - o žijící osobě se do výzkumu 1.36.0 nic nezapsalo, soubor se jen zařadil. Od 1.37.0 se materiál žijícího zařadí
    a zapíše jako u kohokoli jiného; ochrana žijících patří k exportu ([A7.2](A7-book-pages-and-export.md#A7.2));
  - skeny jedné knihy (mnoho číslovaných snímků) se nečtou soubor po souboru: zapíšou se jako kniha a čtou se
    z ní zápisy jako z každé knihy ([R8](R8-reading-scans.md));
  - úkol se zavře, až je každý jeho soubor zařazený; další část dávky je vlastní úkol.
- **Proč:**
  - den po posledním souboru: aplikace posílá soubory po jednom. Dávka, o které nikdo neřekl, že je celá, se uzavře
    s tím, co přišlo, aby nic nečekalo déle; den bez dalšího souboru znamená, že posílání skončilo. Stránka telefonu
    se snadno zavře, aniž dávku předá, proto tam stačí hodina;
  - 25 souborů: jeden úkol podklady přečte jedno sezení agenta a zhruba 25 souborů se do něj vejde;
  - cesta souboru v dávce hodně řekne (`Babička/Dopisy/1946.jpg`); co do rodiny nepatří, nemá se dostat do stromu
    (metodika).
- **Ovládání:** terminál: `strom input batch` (dávky a kolik je roztříděno), `strom input sort I… --as
  source|document|photo|unrelated --person P…`. Aplikace: **Přidat materiály…** v menu výzkumu.
- **Platí od:** výzkum 1.12.0; dávka z telefonu 1.18.0
- **Od výzkumu 1.36.0:** úkoly roztřídění vzniknou jen se zapnutým `intake.auto`, nebo když člověk o roztřídění
  dávky požádá; jinak se dávka uzavře bez úkolů a soubory čekají v Materiálech neroztříděné ([R11.6](#R11.6)).
- **Od výzkumu 1.37.0:** soubor poslaný z aplikace Strom (z dávky i materiál osoby), který ve stromu aplikace ještě
  nemá místo a který `strom input sort` zařadí jako záznam, dokument nebo fotku osob, dostane místo u nich: dva
  partneři jednoho svazku u svazku, jinak u každé osoby. Aplikace ho pak ukáže u osoby, ne jen v okně
  **Materiály**. Místo nedostane soubor, který ve stromu místo má nebo jehož místo bylo v aplikaci odebráno,
  skrytý, nesouvisející, vlastní materiál výzkumu, ani osoba z něj odebraná.

<!-- zdroj: 1.37.0: research:ce89202a src/commands/intake.ts input sort (MediaLink, pořadí za posledním souborem místa; pár u FAM, jinak u INDI; --json placed; bez místa: má místo nebo odebrané, skrytý, unrelated, vlastní, odebraná osoba) · assets/method/intake.md „Someone living: sort and record as anyone.“ · CHANGELOG.cs.md 1.37.0 „Materiál z aplikace zařazený do stromu“ -->
<!-- zdroj: research:src/core/batches.ts hlavička, BATCH_TASK_FILES=25 (od v1.12.0), BATCH_IDLE_MS, PHONE_BATCH_IDLE_MS (od v1.18.0) · research:src/commands/intake.ts input batch done (--idle), input sort (unrelated --reason) · research:assets/method/intake.md "A batch from the Strom app" -->

<a id="R11.5"></a>
## R11.5 Materiál výzkumu a soubory stromu z aplikace

Každý soubor, který výzkum drží, je záznam materiálu (`I…`): soubor poslaný k osobě, soubor dávky, soubor
z terminálu i soubor stromu z aplikace Strom. Záznam má titulek, druh a datum, osoby, ke kterým patří, a u souboru
stromu i svá místa ve stromu aplikace.

- Druh je `photo`, `document`, `record` nebo `other` (v aplikaci **Fotka**, **Dokument**, **Listina**, **Jiné**).
  Výzkum si pamatuje, kdo titulek dal: člověk (aplikace, terminál), nebo výzkum.
- Skrytý soubor (`unrelated`, `duplicate`, bez důvodu) zůstane ve výzkumu i s originálem a jde ukázat znovu.
- **Hlídá kód:**
  - skrytí, odebrání ze stromu ani vrácení zápisu soubor nesmaže: originál i záznam zůstanou. Smaže jen
    `strom input delete` se souhlasem člověka ([R11.5.6](#R11.5.6));
  - úpravu titulku, druhu a data pro soubor mimo strom zapíše výzkum hned. U souboru stromu se změna objeví
    v aplikaci s dalším načtením stromu;
  - výzkum odmítne celou úpravu, když jeden soubor nezná nebo když nejde přečíst hodnota ([R11.5.2](#R11.5.2)).
- **Hranice:** záznamy s místy stromu jsou ve schématu stromu 3 (od výzkumu 1.35.0). Přechod nic nepřepíše; starší
  `strom` strom ve schématu 3 neotevře. Materiál v aplikaci popisuje [A3.5](A3-evidence-in-the-app.md#A3.5).
- **Ovládání:** terminál: `strom input list`, `strom input show I…` (kde soubor je a co z něj vzniklo), `strom input
  edit`, `strom input assign`, `strom input hide`, `strom input unskip`, `strom input delete`, `strom material`.
  Aplikace: okno **Materiály**.
- **Platí od:** výzkum 1.35.0

<!-- zdroj: research:0cc2cfca src/commands/intake.ts input delete · research:2aeeb228 src/core/model.ts SCHEMA_VERSION 3, Input (origin, working, orient, titled, materialKind, families, links), MEDIA_ORIGINS, LINK_TYPES, MATERIAL_KINDS, LINK_RETRACTIONS, HIDE_REASONS · src/core/material.ts hideMaterial, unhideMaterial, editMaterial, MATERIAL_MOST_EDIT, MATERIAL_TITLE_MAX · research:c9a4b614 CHANGELOG.cs.md 1.35.0 · help input, material -->

<a id="R11.5.1"></a>
### R11.5.1 Soubory stromu z aplikace

Výzkum 1.35.0 drží i portréty, fotky svazků a přílohy stromu z aplikace Strom. Každý soubor uloží jednou, podle
obsahu, a zapamatuje si jeho místa ve stromu: příloha nebo portrét osoby, příloha nebo fotka svazku, soubor
události, doklad pramene.

- Soubor, jehož originál přišel dřív (`PUT /media`), výzkum pozná podle otisku originálu; jinak podle otisku
  poslaných bajtů. Zmenšenou kopii, kterou aplikace ukazuje, uloží beze změny vedle originálu.
- Nový portrét nahradí starý: starý zůstane jako starší verze (místo odvolané s důvodem `replaced`).
- Záznam je **ve stromu**, dokud má aspoň jedno místo, které není odvolané.
- **Hlídá kód:**
  - odebrání v aplikaci výzkum zapíše, jen když zápis nese všechny soubory stromu (`media=app`), a jen proti tomu,
    co aplikace s jejími soubory dostala. Co přidalo jiné okno, neodebere;
  - odebraný soubor zůstane v materiálu, skrytý s důvodem **Odstraněno ze stromu**. Ukázaný znovu dostane zpět
    místa, která mu vzal poslední zápis;
  - `strom sync undo I…` vrátí i místa, která zápis odebral;
  - aplikaci se vrací soubor podle otisku (`GET /tree.ged?images=ref&media=app`), jen soubory s místem ve stromu.
    Výřez portrétu v původní fotce se nevrací, portrét ano ([S8.3](S8-where-the-data-are.md#S8.3)).
- **Hranice:** výzkum, který soubory stromu nedrží (do 1.34), nic z toho nedělá; aplikace pak počítá fotky
  a přílohy jako jen v prohlížeči ([S8.4](S8-where-the-data-are.md#S8.4)).
- **Ovládání:** aplikace: zápis stromu ([S2](S2-edits-from-the-app.md)), **Odstranit ze stromu…** a **Vrátit**
  v okně **Materiály**; terminál: `strom sync undo I…`, `strom input unskip I…`.
- **Platí od:** výzkum 1.35.0

<!-- zdroj: research:2aeeb228 · src/core/appmedia.ts (hlavička: soubor jednou podle otisku, keepBytes, MediaReader) · src/core/treemedia.ts (návrat GET /tree.ged?images=ref&media=app, POST /images, GET /image/<sha>) · research:91ab6230 (odebrání jen se všemi soubory, proti základu media=app, sync undo, restoreTakenOff) · research:d5e99375, 815bc90d, 7d7628eb · src/core/material.ts unhideMaterial (spec 102 M3) · dirigent:spec/108-kde-se-co-uklada K2.3 (photoSource se nevrací) -->

<a id="R11.5.2"></a>
### R11.5.2 Titulek, druh, datum a osoby z terminálu

Titulek, druh a datum souboru nastaví `strom input edit`, osoby `strom input assign`. Obojí platí pro materiál
výzkumu i pro soubory stromu z aplikace; aplikace je dostane s dalším souborem stromu.

- `strom input edit I… --title … --kind photo|document|record|other --date …`: nejvýš 500 souborů, titulek nejvýš
  200 znaků, datum jako v GEDCOM (`1932`, `ABT 1930`, `12 MAY 1932`); `""` hodnotu odebere. Odpověď uvede, co měl
  každý soubor předtím (`was`): stejná úprava s těmito hodnotami ji vrátí. Víc souborů `--files-from`.
- `strom input assign` přidá (`--add P…`) nebo odebere (`--remove P…`) osoby souborů nebo celé dávky (`--batch`).
  U souboru stromu je přidaná osoba nové místo: v aplikaci příloha osoby.
- `strom input hide I… --why unrelated|duplicate` soubor skryje; `strom input unskip I…` ho ukáže znovu.
- **Hlídá kód:** všechno, nebo nic: neznámý soubor, příliš dlouhý titulek, nečitelný druh nebo datum a nezapíše se
  nic. `--dry-run` jen ukáže, co by se změnilo.
- **Ovládání:** terminál, viz výše. Totéž dělá okno **Materiály** v aplikaci přes most.
- **Platí od:** výzkum 1.20.0 (`strom input assign`, `hide`, `unskip`); 1.35.0: `strom input edit`, místa souborů
  stromu

<!-- zdroj: research:a7df632d src/commands/intake.ts input edit, assign, hide, unskip · src/core/material.ts checkEdit, editMaterial, MATERIAL_MOST_EDIT=500, MATERIAL_TITLE_MAX=200, assignMaterial (místo u souboru stromu, spec 102 M4) · research:cc709045 příklady v helpu · help input edit, input assign, input hide -->

<a id="R11.5.3"></a>
### R11.5.3 Třídění materiálu: `strom material sort`

`strom material sort` dá soubory materiálu přečíst čtenářům výzkumu. Ke každému souboru navrhnou titulek, datum,
druh a vazby na osoby, svazky, jejich události a prameny stromu, s důvodem a jistotou. Do výzkumu se nic nezapíše.

- Návrh je uložený vedle výzkumu (`strom material show <id>`). Co z něj člověk přijme, se zapíše jako jeho: v
  aplikaci, nebo `strom input edit`.
- `--text` je to, co člověk o souborech ví; čtenáři se jím řídí, kde soubory neříkají jinak.
- `--queue` třídění jen uloží do fronty; `strom material cancel <id>` ho zastaví.
- **Hlídá kód:**
  - nejvýš 50 souborů a 2000 znaků textu; z PDF prvních 10 stran. Soubor, který žádný čtenář neotevře, posoudí
    podle názvu, cesty a poznámek;
  - nikdy nenavrhne titulek, druh ani datum, které dal člověk, vazbu, kterou dal nebo odebral, ani ID, které výzkum
    nemá. Portrét ani fotku svazku nenavrhuje;
  - placená čtení začnou jen po souhlasu člověka: ve vlastním terminálu (Enter je ne) nebo v okně systému. Když
    se nemá koho zeptat, příkaz skončí s kódem 4. Agent za člověka nikdy neodpoví;
  - třídění z aplikace spustí most jen s vlastním podpisem, a ten platí jednou. Záznam, který se za třídění
    z aplikace jen vydává, se nikdy nespustí;
  - ve frontě čekají nejvýš 3 třídění.
- **Od výzkumu 1.35.0:**
  - textový soubor (.txt, .md, .markdown, .text nebo typ text/plain či markdown) čtenář čte jako text a posoudí
    podle toho, co říká: nejvýš prvních 20 000 znaků. U delšího čtenář ví, že dostal jen začátek a jak je soubor
    velký. Čte se jako UTF-8, se značkou kódování UTF-16 jako UTF-16, a co UTF-8 není, jako windows-1252;
  - během třídění `strom material show` řekne, kolik souborů čtenáři už posoudili („N of M files done“); aplikace
    z toho ukazuje „k z n“;
  - u hotového třídění má každý soubor bez návrhu důvod: čtenář k němu nic neřekl, vše navržené už soubor má,
    návrh nešel použít, agent soubor vynechal, nebo soubor nešel přečíst (s výsledkem čtenáře). Co čtenář o souboru
    napsal, stojí u důvodu.
  - soubor, který se rodiny zjevně netýká (snímek obrazovky, účtenka, omylem poslaný soubor), čtenář označí
    `unrelated: yes`, s důvodem a jistotou. Pokyn čtenáři: jen soubor zjevně mimo rodinu, nikdy soubor, který jen
    neumí zařadit. Výzkum k takovému souboru nenavrhne titulek, datum, druh ani vazbu (co čtenář přesto napsal,
    zahodí). `strom material show` u něj píše „unrelated (not of the family)“. Soubor výzkum nikdy sám neskryje ani
    nesmaže; skryje ho jen člověk: v aplikaci ([A3.5.9](A3-evidence-in-the-app.md#A3.5.9)), v terminálu
    `strom input hide I… --why unrelated`;
  - čtenář smí také říct, který z poslaných souborů je rubem jiné fotky nebo strany (vazba `back` na `I…` souboru,
    který dostal tentýž čtenář: jeden rub k jedné přední straně, nikdy rub rubu ani textový soubor) a který obrázek
    je portrétem osoby (vazba `portrait` na jednu `P…`; jen obrázek, ne portrét, který člověk odebral, a ne soubor,
    který už portrétem je);
  - víc než 50 souborů dá roztřídit jen aplikace jako běh po dávkách ([R11.5.5](#R11.5.5)).
- **Hranice:** jen výzkum s agentem: Archiv Stromu a výzkum, který čeká na agenta, materiál netřídí.
- **Ovládání:** terminál: `strom material sort I… [--text …] [--queue]`, `strom material show`, `strom material
  cancel`; aplikace: **Roztřídit agentem…** ([A3.5.8](A3-evidence-in-the-app.md#A3.5.8)).
- **Platí od:** výzkum 1.35.0
- **Od výzkumu 1.37.0 (třídění bez dotazu):** nastavení `sort.confirm`:
  - `ask` (výchozí): souhlas člověka s placenými čteními před každým tříděním jako dosud;
  - `no`: `strom material sort` třídí hned, když o to člověk požádá, a řekne, že se neptalo (ve `--json`
    `confirm: "no"`). Nikdy samo od sebe; běh, který nikdo nesleduje, se ptá dál (a bez člověka skončí s kódem 4);
  - `no` nastaví jen člověk ve vlastním terminálu: `strom config set` se ho zeptá („Třídit soubory materiálu
    čtenáři výzkumu hned, jak se o to požádá, bez dotazu na placená čtení? …“). Agent nebo příkaz bez jeho terminálu
    dostane kód 4 a nic se nezmění. Pro jeden výzkum ho nastaví i aplikace Strom na tomto počítači po potvrzení
    v jejím dialogu; záznam mostu to řekne jednou řádkou. Zpět na `ask` nebo zrušit může kdokoli, i aplikace Strom
    ([S4.4.13](S4-research-from-the-app.md#S4.4.13));
  - s `--for-tree` platí pro tento výzkum, jinak pro tento počítač. Limity třídění se nemění.

<!-- zdroj: research:acb5d1ce src/core/sort.ts SORT_MOST_FILES=50, SORT_TEXT_MAX=2000, SORT_QUEUE_MAX=3, SORT_PDF_PAGES=10, SORT_FILES_PER_READING=10, typy vazeb person/family/event/source · research:0cc2cfca src/core/sort.ts SORT_LINK_TYPES back, portrait · research:d667304d (souhlas člověka, exit 4) · research:2978645b, 19e525e5, 5b76fb43 (podpis mostu APP_SORT_FROM, platí jednou) · src/commands/material.ts · help material sort · research:ae866bb7 src/core/sort.ts SORT_TEXT_FILE_MAX=20_000, SORT_TEXT_TYPES, isTextFile, textOfFile (UTF-8 / UTF-16 BOM, jinak windows-1252; cut), řádek „read as text (only its first … characters: the file is … KB)“, unproposedOf (nothing-said, nothing-new, dropped, left-out, reader-failed + outcome; said) · src/commands/material.ts filesDone (+ group.length po čtenáři), show „N of M files done“, „no proposal: why (outcome)“ · research:f36b3941 (ve vydání 1.35.0) src/core/sort.ts pokyn čtenáři „unrelated: yes“ (jen soubor zjevně mimo rodinu, nikdy jen nezařazený), YES, keptProposals (unrelated: jen why a sure, ostatní dropped „unrelated“) · src/commands/material.ts show „· unrelated (not of the family)“ · src/core/live.ts GET /material/sort/<id> unrelated?: true („the person hides it, never strom“) · CHANGELOG.md 1.35.0 · 1.37.0: research:5520e0ac src/core/config.ts sort.confirm (ask | no, --for-tree), requireHumanYes, assets/lang/cs.json ui.consent.sort.confirm, src/commands/material.ts (no: třídí hned, confirm no v --json; STROM_NONINTERACTIVE se ptá), src/core/live.ts /status sort, POST /settings/sort (403 sort.raise) · CHANGELOG.cs.md 1.37.0 · dirigent:spec/102 U8 -->

<a id="R11.5.4"></a>
### R11.5.4 Materiál přes most

Okno **Materiály** v aplikaci čte a mění materiál přes most výzkumu. Každá změna je stejný příkaz jako
v terminálu, se stejnými mezemi.

| Most | Co dělá | Příkaz |
|---|---|---|
| `GET /material` | soubory s titulkem, druhem, datem, osobami, u souborů stromu místa a u každého použití; zdroj pramene (`uses.of`), co agent nezařadil (`left`), stejný obsah (`sameAs`) | |
| `GET /material/<I…>/uses` | výňatky, prameny a úkoly, které soubor používají | |
| `POST /material/assign` | osoby souborů | `strom input assign` |
| `POST /material/hide` | skrýt a ukázat znovu (u odebraného souboru stromu s místy) | `strom input hide`, `unskip` |
| `POST /material/edit` | titulek, druh a datum, 1–500 souborů | `strom input edit` |
| `POST /material/sort` | třídění 1–50 souborů; průběh `GET /material/sort/<id>`, zrušení `…/cancel` | `strom material sort` |
| `POST /material/sort` (51–1 500) | běh po dávkách ([R11.5.5](#R11.5.5)); průběh `GET /material/sort/<run-…>`, zrušení `…/<run-…>/cancel` | |
| `POST /material/delete` | smazat natrvalo 1–500 souborů: nejdřív `dryRun` (výčet a potvrzení), pak s potvrzením | `strom input delete` |

- Výzkum ohlásí, co umí, v `/status.features`: `media.app`, `material.links`, `material.edit`, `material.uses`
  a `material.sort` (jen kde je agent). Bez nich se aplikace chová jako se starším výzkumem.
- **Od výzkumu 1.35.0:** i `material.sourceOf`, `material.left`, `material.sameAs`, `material.sortRun`
  a `material.delete`. Mazání odmítne změněný výčet (`material.delete-changed` s novým výčtem), chybějící
  nebo staré potvrzení (`material.body`) a zápis, který nepřišel z aplikace.
- **Hlídá kód:** úprava je celá, nebo žádná; zaneprázdněný výzkum odpoví, že nic nezměnil. Třídění odmítne bez
  agenta, s vyčerpaným limitem čtení, s plnou frontou a když agent teď pracovat nemůže.
- **Ovládání:** aplikace: okno **Materiály**, s běžícím mostem ([S1.1](S1-connecting-app-and-research.md#S1.1)).
- **Platí od:** výzkum 1.35.0

<!-- zdroj: research:0cc2cfca src/core/live.ts (GET /material uses.of, left {at, sort, why, said}, sameAs; POST /material/sort run 51–1500, GET/POST /material/sort/<run-…>[/cancel]; POST /material/delete dryRun → impacts + confirm, chyby material.delete-changed, material.body, material.file, material.readonly, material.busy, app.only; BRIDGE_FEATURES material.sourceOf, left, sameAs, sortRun, delete) · research:src/core/live.ts:134-160 (GET /material, /material/<I…>/uses, POST /material/assign|hide|edit|sort, chyby material.body|date|file|readonly|busy) · src/core/live-sort.ts (sort.none, sort.limit, sort.queue, sort.not-ready) · research:a7df632d, 87376d11, 7754968e -->

<a id="R11.5.5"></a>
### R11.5.5 Běh třídění z aplikace

Aplikace může dát roztřídit 51 až 1 500 souborů jako jeden běh (`run-…`). Výzkum ho rozdělí na dávky po 50 a třídí
je jednu za druhou, dokud běží most. Návrh každé hotové dávky je k dispozici hned.

- Každá dávka je samostatné třídění s vlastním návrhem; nese, ke kterému běhu patří a kolikátá je.
- Do fronty (nejvýš 3 třídění) se běh počítá jako jedno.
- **Čtení aplikace:** první dávka se započítá, když výzkum běh přijme; další, až se spouštějí. Když limit čtení
  aplikace dávku nepustí, běh čeká a zkusí to sám znovu (`material.sort-waiting`).
- Dávka, která selže, další dávky nezastaví. `strom material show run-…` řekne stav běhu, kolik souborů je hotových
  a jeho dávky. `strom material cancel run-…` zastaví dávku v práci, zruší čekající a hotové nechá s jejich návrhy.
- **Hlídá kód:** běh spustí jen aplikace přes most; agent běh nikdy nespustí a `strom material sort` z terminálu
  vezme nejvýš 50 souborů ([R11.5.3](#R11.5.3)).
- **Hranice:** jen výzkum s agentem a s `material.sortRun` ([R11.5.4](#R11.5.4)); starší výzkum vezme od aplikace
  jednu dávku.
- **Ovládání:** aplikace: **Roztřídit agentem…** ([A3.5.12](A3-evidence-in-the-app.md#A3.5.12)); terminál:
  `strom material show run-…`, `strom material cancel run-…`.
- **Platí od:** výzkum 1.35.0

<!-- zdroj: research:0cc2cfca src/core/sort.ts SORT_RUN_MOST_FILES=1500, SORT_QUEUE_MAX=3 (běh jako jedna položka), run/part/parts, první dávka započtená při přijetí, další při startu podle read.app, jinak čeká a zkusí znovu; selhaná dávka nezastaví další · src/core/live-sort.ts, src/core/live.ts POST /material/sort (51–1500 → 202 {state queued, run}), GET /material/sort/<run-…>, POST …/<run-…>/cancel · src/commands/material.ts show run-… („N of M files done“, dávky), cancel run-…, material.sort-waiting · CHANGELOG.md 1.35.0 -->

<a id="R11.5.6"></a>
### R11.5.6 Smazat natrvalo: `strom input delete`

`strom input delete I…` smaže soubory materiálu natrvalo. Smí to jen člověk: v terminálu se svým souhlasem, nebo
v aplikaci přes **Smazat natrvalo…** ([A3.5.16](A3-evidence-in-the-app.md#A3.5.16)).

- U každého souboru se odvolá jeho záznam i jeho místa ve stromu aplikace. Pramen z něj udělaný si nechá text
  a citace, jen bez vazby na soubor. Úkol, který soubor drží, ho pustí; úkol bez dalších souborů se vzdá.
- Obsah souboru (originál, pracovní kopie, náhledy) zmizí, jen když stejný obsah nemá jiný soubor výzkumu ani jiný
  výzkum na tomto počítači. Pak zmizí i obrázky pramenů se stejným obsahem a jejich výřezy; pramen přijde o obrázek,
  nikdy o text.
- `--dry-run` řekne vše po souborech (`--json`: `impacts`). Víc souborů `--files-from <soubor>` (jedno ID na řádek,
  `-` je standardní vstup).
- `strom input show I…` u smazaného souboru řekne, že ho člověk smazal natrvalo; `strom input list` ho neukáže.
  Stejný obsah přinesený znovu je nový materiál.
- **Hlídá kód:**
  - všechno, nebo nic: soubor, který výzkum nemá, a nesmaže se nic; nejvýš 500 souborů;
  - bez `--dry-run` řekne ano člověk ve vlastním terminálu (Enter je ne), jinak v okně systému; když se nemá koho
    zeptat, příkaz skončí s kódem 4;
  - agent ho nikdy nespustí ani nenabídne; s potvrzením aplikace ho odmítne (`material.agent`);
  - potvrzení aplikace platí jen pro výčet, který člověk v aplikaci viděl, a nejvýš 15 minut. Změněný výčet
    (`material.delete-changed`) ani staré potvrzení nesmaže nic;
  - když jiný výzkum na tomto počítači nejde přečíst (novějšího `strom`), obsah zůstane uložený.
- **Hranice:** v aplikaci Strom to nejde vrátit; soubor zůstane jen v záloze (`strom backup`) nebo balíčku
  udělaném předtím. Historie výzkumu záznam drží.
- **Od výzkumu 1.36.0:** soubor rodokmenu (importovaný GEDCOM, soubor JSON aplikace) se maže stejně. Když z něj
  vznikl pramen a ten stále platí, příkaz skončí (`material.source-live`): soubor jde smazat jen spolu s tím
  pramenem, `--retract-sources S…`. Pramen se smaže první, jako `strom source retract`
  ([R3.10](R3-verification-and-citation.md#R3.10)); na obojí stačí jedno ano a vše se zapíše jedním commitem.
  Pramen jde pak obnovit, ale už bez souboru.
- **Ovládání:** terminál: `strom input delete I… [--dry-run] [--files-from …] [--retract-sources S…]`; aplikace:
  **Smazat natrvalo…** přes most (`POST /material/delete`, [R11.5.4](#R11.5.4)).
- **Platí od:** výzkum 1.35.0

<!-- zdroj: research:0cc2cfca src/commands/intake.ts input delete (popis, --files-from, skrytý --confirm, isAgent → material.agent, checkDeleteConfirm → material.delete-changed, material.body, souhlas člověka, exit 4) · src/core/materialdelete.ts (hlavička: historie drží záznam, bajty jen v záloze nebo balíčku; DELETE_MOST_FILES=MATERIAL_MOST_EDIT=500, DELETE_CONFIRM_MS 15 min; nečitelný jiný výzkum → nic se nesmaže) · input show („deleted for good“), input list bez smazaných · CHANGELOG.md 1.35.0 · 1.36.0: e6bbfb40 src/commands/intake.ts input delete (--retract-sources, material.source-live, jeden commit), ui.input.delete.retracted · src/core/live.ts POST /material/delete {files, confirm, sources} -->

<a id="R11.6"></a>
## R11.6 Poslané soubory projde agent jen po zapnutí

Soubor poslaný do výzkumu sám nespustí práci agenta. Uloží se a čeká v Materiálech neroztříděný, dokud člověk nepožádá
o roztřídění, nebo dokud v nastavení výzkumu nezapne, že poslané soubory projde agent sám (`intake.auto`).

- **Hlídá kód:**
  - `intake.auto` je ve výchozím stavu vypnuté, i ve výzkumech založených dřív; nic se nepřevádí a nic se neptá;
  - vypnuto: uzavřená dávka (aplikace, telefon, uzavření den po posledním souboru) nezaloží úkoly roztřídění. Úkol
    nevznikne ani u jednotlivého souboru z aplikace (materiál osoby, sken pramene, originál portrétu nebo fotky svazku
    ze zápisu stromu, [S8.3](S8-where-the-data-are.md#S8.3)), u souboru poslaného znovu s další
    osobou nebo poznámkou, u souboru znovu zobrazeného, u doplněného podkladu ani u `strom intake` souborů;
  - zapnuto: jako dřív. Dávka dá úkoly roztřídění po zhruba 25 souborech, které jdou ve frontě napřed
    ([R11.4](#R11.4)), soubor svůj úkol podklady ([R11.1](#R11.1)), sken pramene úkol k přečtení;
  - úkol vznikne vždy z výslovné akce člověka: **Roztřídit agentem…** ([R11.5.3](#R11.5.3)), `--sort`, soubor jako
    odpověď na čekající úkol ([R6.7.1](R6-awaiting-action.md#R6.7.1)), **Přečíst dokument…**, i text
    (`strom intake --text`), který říká člověk;
  - zapnout smí jen člověk: v terminálu, v menu, nebo v aplikaci Strom. Agentovi se zapnutí odmítne. Vypnout smí
    kdokoli. Úkoly roztřídění, které už vznikly, po vypnutí zůstávají;
  - nastavení platí pro jeden výzkum (`--for-tree`), nebo pro všechny výzkumy na počítači.
- **Proč:** roztřídění čerpá předplatné AI a mění strom (soubory připojí k osobám, pojmenuje je, založí prameny).
  Samotné nahrání souboru nesmí spustit práci AI; dokumenty rodiny potřebují svolení člověka.
- **V aplikaci:** přepínač v nastavení výzkumu ([S4.4.11](S4-research-from-the-app.md#S4.4.11)), konec posílání
  dávky a **Poslat materiál…** ([A3.5](A3-evidence-in-the-app.md#A3.5)).
- **Ovládání:** terminál: `strom config set intake.auto on|off --for-tree`; menu **Nastavení** → „Soubory poslané do
  výzkumu projde agent sám: vypnuto“; `strom intake <soubory> --sort` (soubory projde agent hned); menu **Přidat
  podklady** se zeptá „Nechat to projít agentem (úkoly pro agenta, čerpá předplatné AI)?“ (výchozí ne);
  `strom input batch done <dávka> --sort` (roztřídit dávku uzavřenou bez úkolů). Most: `POST /intake {auto}`,
  `POST /batch/<id>/done` s `sort`.
- **Platí od:** výzkum 1.36.0

<!-- zdroj: research:da86bbe7, 90f33705 src/core/config.ts:400 intake.auto (tree: true, off|on, výchozí off), :962 intakeAuto · src/commands/setup.ts:1311, :1655-1673 intakeDecision (requireHuman, STROM_FOR_APP bez agenta, off kdokoli) · src/commands/intake.ts:202-225 (--sort, --text vždy úkol), :829-848 input batch done --sort/--no-sort · src/cli/menu-research.ts:110-125 (ui.intake.sort.ask, výchozí ne; ui.intake.done.waits) · src/cli/menu-settings.ts:98, :247-250 · src/core/live.ts:6693 POST /intake, BRIDGE_FEATURES intake.auto · cs.json ui.settings.intake(.about, .on, .off), ui.intake.sort.ask, ui.intake.done.waits · CHANGELOG.cs.md 1.36.0 · dirigent:spec/130 K1.1–K1.3, K2.1, K3.1, K4.1, rozhodnutí 21. 11. · app:docs/ZADANI_VYZKUM_trideni-davek.md (Most, Doplněk K1.3) · app:strings.ts read.menu (položka menu s „…“, titulek read.title bez) · dirigent:prace/1122-app-nalezy-330 -->

<a id="R11.7"></a>
## R11.7 Materiál k seznamu osob

Aplikace Strom může poslat sken k celému seznamu osob (sčítací arch, stránka matriky), ne k jedné osobě
([A3.5.18](A3-evidence-in-the-app.md#A3.5.18)). Výzkum seznam uloží tak, jak přišel, a agent jména ze skenu páruje
nejdřív s osobami seznamu.

- **Hlídá kód:**
  - aplikace pošle nejdřív seznam (název, druh: pevný, automatický nebo pracovní, pravidlo, výzkumná čísla osob,
    kolik osob výzkum nezná, čas) a každý soubor na něj odkáže. Most seznam drží, dokud ho soubor nepoužije; nové
    poslání téhož seznamu ho nahradí. Soubor, který odkáže na seznam, jenž výzkum nemá, most odmítne a aplikace
    seznam pošle znovu;
  - podklad si seznam ponechá, jak byl poslán: zapíše se do výzkumu (`notes/lists/`, v historii) a už se nemění;
  - seznam do 50 osob: všechny jeho osoby jsou osoby podkladu. Delší seznam je jen pojmenovaný; výčet jeho osob je
    v souboru seznamu a agent si je dohledá sám (`strom person show P…`);
  - úkol podkladu, když vznikne ([R11.6](#R11.6)), se jmenuje podle seznamu. Zadání agenta seznam uvede (název,
    druh, pravidlo, počet osob, kolik jich výzkum ještě nemá, datum poslání) a řekne, že každé přečtené jméno se
    páruje nejdřív s osobami seznamu a v celém stromu se hledá (`strom find "<jméno>"`) jen jméno, které žádné
    z nich neodpovídá;
  - sken pramene poslaný k seznamu zůstane obrazem pramene a seznam si ponechá stejně; úkol k jeho přečtení má mezi
    osobami, kterých se týká, osoby seznamu (do 50);
  - seznam nejvýš 100 000 osob a 2 MB; jinak most seznam odmítne;
  - v Archivu Stromu se seznam jen uloží k materiálu, nic víc.
- **Ovládání:** aplikace: **Poslat materiál…** → **Týká se** → seznam ([A3.5.18](A3-evidence-in-the-app.md#A3.5.18)).
  Terminál: `strom input show I…` ukáže řádek seznamu (název, počet osob, kolik jich výzkum nemá, pravidlo, soubor).
- **Platí od:** výzkum 1.37.0 (sken pramene k seznamu také 1.37.0)

<!-- zdroj: research:de5f709d src/core/lists.ts (LIST_ID, LIST_PEOPLE 50, LIST_MAX 100 000, LIST_BODY_MAX 2 MB, .strom/lists/<id>.json, notes/lists/<hash>.json, takeList), src/core/live.ts PUT <token>/lists/<id> (list.bad-body 400, list.large 413), X-Strom-List-Ref, media.no-list 404, BRIDGE_FEATURES media.list, src/brief/brief.ts listLine, src/commands/intake.ts (řádek list v input show, --list), src/core/model.ts Input.list · 5f429022 (soubor seznamu jako zapsaná operace, i v archivu) · 778846e6 scanLists (media.list.source: sken pramene, osoby seznamu do 50 v about úkolu, „match each name you read on it to them first … strom find“) · CHANGELOG.md 1.37.0 „Material sent to a list of people“ · dirigent:spec/137 K2.2, K2.4, K2.5 · app:docs/ZADANI_VYZKUM_material-seznam.md (Odpověď výzkumu) -->
