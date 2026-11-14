<a id="A10"></a>
# A10 Jedna událost u více osob

Sčítání lidu, bydliště nebo vystěhování celé domácnosti se zapíše jednou a platí pro všechny, kdo u něj byli. Kmotr,
svědek nebo oddávající zapsaný u události jiné osoby se ukáže i v životě kmotra, když je propojený s osobou ve
stromu. Kapitola popisuje aplikaci Strom 3.28.0 a výzkum 1.32.0. Jak se sdílená událost čte a píše v GEDCOM, říká
[A2.1](A2-loading-a-family-tree.md#A2.1) a [A2.7](A2-loading-a-family-tree.md#A2.7).

<!-- zdroj: dirigent:spec/085-sdilena-udalost U9, K1.1–K1.6, K2.1–K2.2 · app:1c4b7d19..e832e6e2 (dirigent:prace/1113-app-sdilena-udalost), app:f1d56989..80c2ffb9 (dirigent:prace/1113-app-085-nalezy) · app:CHANGELOG 3.28.0 -->

<a id="A10.1"></a>
## A10.1 Společná událost: Spolu s

Událost, kterou zažilo víc osob najednou, se zapíše jednou. Každá osoba má svou kopii, společné údaje jsou u všech
kopií stejné a úprava kterékoli kopie platí pro všechny.

- **Které události:** **Sčítání lidu**, **Bydliště**, **Emigrace**, **Imigrace**, **Vojenská služba**,
  **Naturalizace** a **Vlastní** (s vyplněným názvem). Narození, křest, sňatek, úmrtí a další události patří vždy
  jedné osobě; u nich se ostatní zapisují jako kmotři a svědci ([A10.5](#A10.5)).
- **Společné údaje:** typ, název vlastní události, datum, místo, dům, poznámka, prameny a kvalita citace.
  **Každá osoba svůj:** věk podle zápisu, role u události, stav výzkumu a ověření.
- **Hranice:**
  - úprava společného údaje se uloží u všech kopií jako jeden krok **Zpět** („{událost}: uloženo u N osob.“). Je-li
    některá z osob zamčená, neuloží se nic („Nic se neuložilo: některá z osob je zamčená, nebo tento typ události
    patří jen jedné osobě.“);
  - dokud událost sdílejí další osoby, nejde změnit na typ jen pro jednu osobu: ve výběru typu je skupina **Jen pro
    jednu osobu** s vysvětlením „Tyto typy nejdou sdílet. Nejdřív ze Spolu s odebrat nebo oddělit ostatní (N).“;
  - role je u každé osoby: výchozí **člen domácnosti**, nebo **Jiná role…** s vlastním slovem (podnájemník,
    čeleď…);
  - u 7 a více dalších osob ukazuje seznam prvních 5 a **Zobrazit další N** (zpět **Zobrazit méně**);
  - smazání osoby smaže jen její kopii; potvrzení vyjmenuje „Společné události zůstanou ostatním:“ (nejvýš 5 řádků,
    pak „…“). Kopie, která zůstane jediná, je obyčejná událost své osoby;
  - žijící osoba chráněná ochranou žijících ([A7](A7-book-pages-and-export.md)) se u společné události v knize,
    na stránkách a v exportu nejmenuje ani nepočítá.
- **Ovládání:** úprava události osoby, oddíl **Spolu s** se sloupci **Osoba**, **Role** a **Věk** a nápovědou
  „Datum, místo, dům, poznámka a prameny platí pro všechny. Věk má každý svůj.“ U události více osob je nad
  formulářem pruh „Společná událost N osob – úprava platí pro všechny“.
  - nabídka řádku osoby: **Otevřít osobu**, **Oddělit (ponechat vlastní kopii)** („Kopie zůstane, další úpravy se
    jí netýkají.“), **Odebrat z události** („Událost u této osoby zmizí, ostatním zůstane.“). Odebrání i oddělení
    se uloží s ostatními úpravami jako jeden krok **Zpět**;
  - mazání v patičce: **Smazat jen u této osoby** („U ostatních N zůstane.“), **Oddělit tuto osobu**, **Smazat
    u všech N osob…** (potvrzení vyjmenuje osoby, u kterých událost zmizí). Obojí jde vrátit přes **Zpět**.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:80c2ffb9 src/events.ts SHAREABLE_EVENT_TYPES (census, residence, emigration, immigration, military, naturalization, custom), SHARED_EVENT_COMMON_FIELDS (type, customLabel, date, place, address, note, sourceIds, citationQuay) · src/types.ts LifeEvent.shareId, shareRole · src/shared-events.ts, src/shared-event-editor.ts · src/ui/shared-event-ui.ts LARGE_HOUSEHOLD 7, SHOWN 5, openSharedRowMenu, openSharedDeleteMenu, sharedTakeOut, sharedDeleteAll · strings.ts events.sharedWith, sharedWithHint, sharedBanner, sharedCol*, sharedRoleDefault, sharedRoleOther, sharedRolePlaceholder, sharedShowMore, sharedShowLess, sharedOpenPerson, sharedSeparate(Hint), sharedRemove(Hint), sharedSeparateSelf, sharedDeleteSelf(Hint), sharedDeleteAll(Title, Lead), undoHint, sharedTypeLocked(Hint), sharedSaved, sharedSaveRefused, personDelete deleteShared · spec 085 K1.1–K1.3 · dirigent:prace/1113-app-sdilena-udalost Výsledek -->

<a id="A10.1.1"></a>
### A10.1.1 Přidat osobu

**Přidat osobu** v oddílu **Spolu s** otevře výběr osob. Nic v něm není předem zaškrtnuté.

- **Rodina:** bez hledaného textu nabídne skupinu „Rodina · kdo k {datum} žil“: partnery, děti, rodiče a sourozence
  osoby, bez zástupných osob. Kdo k roku události nežil, v ní není a výběr to řekne („Bez N osob, které k datu
  události nežily: …“, nejvýš 3 jména s rokem úmrtí).
- **Hledání:** hledá v celém stromu, nejvýš 50 výsledků. Kdo už je ve **Spolu s**, má „už je ve Spolu s“.
  Bez výsledku nabídne **Založit novou osobu „…“** a připomene „Kdo ve stromu být nemá (podnájemník, čeleď), patří
  jen do poznámky události.“ **Založit a přidat** osobu založí a přidá.
- **Osoba, která už stejnou událost má:** řádek ukáže „už má {událost} – připojí se“. Po uložení se její vlastní
  zápis připojí ke společné události a nová kopie nevznikne; věk a vlastní údaje osoby zůstanou. Liší-li se její
  společné údaje, nabídne se **Sjednotit** ([A10.3](#A10.3)).
- **Stejná událost** znamená:
  - stejný typ (u vlastní události i stejný název);
  - celé datum: den, měsíc a rok, bez „asi“, rozmezí nebo období;
  - stejné místo (bez ohledu na mezery na krajích a velikost písmen);
  - stejný dům, nebo dům zapsaný jen u jednoho zápisu (spojená událost ho převezme). Dva různé domy nejsou nikdy
    stejná událost.
- **Ovládání:** **Přidat (n)** přidá vybrané osoby; uloží se s událostí.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:80c2ffb9 src/ui/shared-event-ui.ts showSharedPicker, familyCandidates (partneři, děti, rodiče, sourozenci, bez zástupných, živí k roku), hledání max 50 · src/shared-events.ts sameEventKey, isSameEvent (SHAREABLE, vlastní s názvem, úplné datum bez kvalifikátoru, místo trim + bez velikosti, dům shodný nebo jen u jednoho) · strings.ts personPicker.family, familyAlive, familyHidden, alreadyShared, joinsOwnRecord, createNamed, noteHint, addN, createAdd · spec 085 K1.6 a · dirigent:prace/1113-app-085-nalezy -->

<a id="A10.2"></a>
## A10.2 Kde se společná událost ukáže

Společná událost je v životě každé osoby, která ji má. Kde jsou na jednom místě víc osob té události, ukáže se
jednou.

- **Seznam událostí osoby:** pod událostí řádek „spolu: …“: do 3 osob jménem, víc jako první 2 a „a další N“.
  **Otevřít společnou událost** otevře úpravu události.
- **Stránka osoby, oddíl Časová osa života:** jako ostatní události osoby, s řádkem „spolu: …“.
- **Mapa:** v bublině místa je společná událost jedním řádkem se všemi osobami.
- **Časová osa rodiny:** jednou.
- **Kniha a stránky rodiny:** blok **Rodina spolu**, když jsou všechny osoby události v této rodině (pár a jejich
  děti), jeden řádek s věky a pramenem. Časové osy partnerů pak tutéž událost vynechají. Sčítání lidu je v knize při
  podrobnosti **Vše**, při výchozí **Běžně** ne.
- **Tabulka:** jeden řádek ([A6.7.10](A6-views.md#A6.7.10)).
- **Hranice:** zástupné osoby a žijící chránění ochranou žijících se v řádku nejmenují ani nepočítají.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:80c2ffb9 src/shared-with-line.ts SHARED_LINE_MAX, sharedWithLine, sharedWithLineHtml, familyTogetherEvents (všechny kopie v rodině, bez zástupných a skrytých), familyTogetherLineHtml · src/book-blocks.ts familyTogetherHtml (skip pro časové osy partnerů) · strings.ts events.sharedLine, sharedLineMore, sharedLineOpen, book.familyTogether · spec 085 K1.4, §2h · dirigent:prace/1113-app-sdilena-udalost Výsledek (mapa, osa rodiny, kniha Běžně/Vše) · strings.ts book detail.normal, personPage sec.timeline -->

<a id="A10.3"></a>
## A10.3 Kopie se liší: Sjednotit

Když se společné údaje kopií jedné události liší (například po importu nebo sloučení), aplikace to řekne a nabídne
je sjednotit. Sama nic nezmění.

- **Kde:**
  - **Kvalita dat**, oddíl **K ověření**, skupina **Společné události**: „{událost} · {osoba}: {pole} se liší (…,
    u ostatních …).“, u více kopií „{událost} · N kopií se liší: …“ ([A5.1](A5-tree-check.md#A5.1));
  - bublina nálezu v pohledu Tabulka;
  - úprava události: pruh „Kopie se liší: … (…)“ s **Porovnat**.
- **Dialog Sjednotit kopie · {událost}:** ukáže jen pole, která se liší (typ, název, datum, místo, dům, poznámka,
  prameny, kvalita citace). Předvybraná je hodnota většiny; při shodě počtů hodnota osoby, odkud se dialog otevřel.
  Od 3 polí je i **Vzít vše podle:** a osoba. Řádek „Shodné: … Věk, stav výzkumu a ověření má každá osoba svůj
  a nesjednocují se.“
- **Hranice:** sjednocení je jeden krok **Zpět**. **Oddělit rozdílnou kopii** (u více **Oddělit rozdílné kopie (n)**)
  udělá z rozdílné kopie samostatnou událost její osoby.
- **Ovládání:** **Sjednotit…** → **Sjednotit u N osob**; **Otevřít** otevře událost.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:80c2ffb9 src/shared-divergence.ts · src/validation.ts (groupShared, závažnost warning) · src/ui/tree-stats.ts · src/ui/shared-event-ui.ts (pruh sharedDiffers, sharedCompare) · strings.ts validation.groupShared, sharedDiffersOne, sharedDiffersMany, unify, separateCopy, separateCopies, openEvent, unifyTitle, unifyLead, unifyTakeAll, unifySame, unifyGo, unified, sharedFields · spec 085 §4 · dirigent:prace/1113-app-085-nalezy -->

<a id="A10.4"></a>
## A10.4 Stejná událost zapsaná zvlášť: Spojit do jedné události

Stejné sčítání nebo bydliště zapsané zvlášť u několika osob (například ze staršího stromu nebo z jiného programu)
najde Kvalita dat a nabídne ho spojit. Nic se nespojí samo, ani při aktualizaci dat.

- **Kde:** **Kvalita dat**, oddíl **Stopy**:
  - jedna skupina: „{událost} {datum}, {místo}, {dům} – zapsáno zvlášť u N osob.“ (dům, jen je-li zapsaný) s **Spojit do jedné události**;
  - víc skupin: „N událostí je zapsaných zvlášť u více osob.“ s **Projít po jedné**. Dialog **Události zapsané
    zvlášť u více osob · N** nabídne skupiny po jedné: **Spojit do jedné události**, **Později** (skupina se do zavření dialogu
    neukáže), **Zpět** (zpět na kontrolu).
- **Hranice:**
  - stejná událost se pozná jako u **Přidat osobu** ([A10.1.1](#A10.1.1)). Různé domy dělí skupiny; zápis bez domu
    se pak nepřipojí k žádné;
  - po spojení je to jedna společná událost; věk a vlastní údaje každé osoby zůstanou. Liší-li se společné údaje,
    nabídne se **Sjednotit kopie** ([A10.3](#A10.3));
  - skupina, ve které už společná událost je, se k ní připojí („Připojí se ke společné události N osob.“);
  - spojení je jeden krok **Zpět** („{událost}: spojeno do jedné události u N osob.“).
- **Ovládání:** **Přehled stromu → Kvalita dat → Rychlé akce → Detaily validace**, oddíl **Stopy**.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:80c2ffb9 src/ui/same-event-join-ui.ts · src/shared-events.ts sameEventKey (domy dělí skupiny) · src/validation.ts (stopa info) · strings.ts validation.sameJoinLead, sameJoinSummary, sameJoinReview, sameJoin, sameJoinTitle, sameJoinHint, sameJoinToShare, sameJoinDone, later, nameLinkBack · spec 085 K1.6 b · dirigent:prace/1113-app-085-nalezy Výsledek -->

<a id="A10.5"></a>
## A10.5 Kmotři, svědci a další účastníci v životě osoby

Kmotr, svědek, oddávající a další účastník se zapisují u události, které se účastnili: u křtu, sňatku, úmrtí. Když je
účastník propojený s osobou stromu, ukáže se ta událost i v jejím životě.

- **Role:** **Kmotr / kmotra**, **Svědek**, **Oddávající / křtící**, **Přítomen**; ze souborů i **Porodní bába**
  a **Oznamovatel**. Účastník je zapsaný jménem, jak je v prameni, a s bližším určením (řemeslo, „soused“…).
- **V životě propojené osoby:** odvozený řádek, například „Kmotr · křest: …“, „Kmotra · křest: …“, „Svědek · sňatek:
  …“, „Svědkyně · sňatek: …“, „Oddávající · sňatek: …“, „Porodní bába · křest: …“, „Oznamovatel · úmrtí: …“. Je
  v seznamu událostí osoby a na stránce osoby v oddílu **Časová osa života**; shrnutí stránky osoby má „Kmotr a svědek u“ (u ženy
  „Kmotra a svědkyně u“).
- **Hranice:**
  - odvozený řádek není vlastní událost osoby: nejde do GEDCOM, Tabulky, mapy, knihy, časové osy rodiny ani časové
    osy v dialogu osoby;
  - řádek zmizí, jakmile má osoba vlastní událost ([A10.5.1](#A10.5.1)), která na tutéž událost odkazuje;
  - účastník zapsaný jen jménem se v životě nikoho neukáže; propojení nabízí [A10.5.2](#A10.5.2).
- **Ovládání:** úprava události, oddíl **Kmotři a svědci**: **+ Přidat**, **Propojit s osobou ve stromu**; propojený
  účastník má značku **ve stromu**. Nabídka odvozeného řádku: **Otevřít osobu**, **Zapsat i jako vlastní událost**,
  **Zrušit propojení**.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:80c2ffb9 strings.ts events.roles, extraRoles, participants, addParticipant, participantName, participantNote, participantLink, participantInTree, derived*, derivedMenu, recordOwn, unlink · personPage godparentWitness · src/ui/shared-event-ui.ts (odvozené řádky jen v seznamu událostí a v Časové ose života) · spec 085 K2.1 · dirigent:prace/1113-app-sdilena-udalost Výsledek -->

<a id="A10.5.1"></a>
### A10.5.1 Zapsat i jako vlastní událost

Kmotrovství nebo svědectví jde zapsat i jako vlastní událost osoby, například aby mělo vlastní poznámku nebo pramen.

- **Typy:** **Kmotrovství** (pole **Ke křtu**), **Svědek při sňatku** (pole **Ke sňatku**); u jiné události pole
  **K události**. Vlastní událost odkazuje na křest nebo sňatek, ke kterému patří.
- **Hranice:**
  - datum, místo a pramen se předvyplní podle křtu („Předvyplněno podle křtu. Pozdější změny křtu se sem
    nepropíšou.“), u sňatku obdobně;
  - nikdy to není kopie křtu nebo sňatku; křest i sňatek patří dál své osobě a páru;
  - odvozený řádek ([A10.5](#A10.5)) se pak neukazuje.
- **Ovládání:** nabídka odvozeného řádku → **Zapsat i jako vlastní událost** („Založí kmotrovství s odkazem na křest
  a se stejným pramenem.“). Po uložení „{typ}: uloženo u osoby {jméno}.“ Typy jsou i ve výběru typu události.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:80c2ffb9 src/events.ts godparent, weddingWitness (roleAt) · strings.ts events.types.godparent „Kmotrovství“, weddingWitness „Svědek při sňatku“, recordOwnHintGodparent, recordOwnHintWitness, recordOwnPrefilled(Marriage, Event), refBaptism, refMarriage, refEvent, recordedOwn · src/ged-exporter.ts (1 EVEN, 2 TYPE, 2 _STROM_ROLE, 3 _STROM_AT, 4 TYPE BAPM|MARR) · spec 085 K2.2 -->

<a id="A10.5.2"></a>
### A10.5.2 Propojit kmotra a svědka zapsaného jménem

Kmotr nebo svědek zapsaný jen jménem, kterému odpovídá osoba stromu, dostane nabídku propojení. Nic se nepropojí
samo a zapsané jméno v události zůstane.

- **Kdo se nabízí:** jen kmotři a svědci, ne ti, kdo jsou u události z úřadu. Osoba stromu se stejným křestním
  jménem a příjmením (bez ohledu na velikost písmen a diakritiku; počítá se i příjmení po sňatku), která k datu
  události žila a byla aspoň 12 let stará. Datum s „asi“ dovolí odchylku 2 roky; věk se počítá z data narození,
  jinak křtu. Bez data události se nikdo nevyloučí.
- **Kdo nikdy:** osoba, jíž událost patří, kdo už je propojený, a kdo byl odmítnutý.
- **Hranice:**
  - rok narození a dům (adresa narození, nebo bydliště či sčítání nejbližší datu) se u nabídky jen ukážou, nerozhodují;
  - odmítnutí si strom pamatuje a znovu ho nenabídne; v GEDCOM se vrací ([A2.7](A2-loading-a-family-tree.md#A2.7));
  - u společné události se propojí u všech kopií.
- **Ovládání:**
  - úprava události: šedý pruh „Ve stromu je {jméno} ({údaje}) – propojit?“, u více osob „Ve stromu jsou N osoby se
    jménem … – propojit?“, tlačítka **Propojit**, **Není to tato osoba**, **Není to nikdo z nich**. Platí až po
    **Uložit**;
  - **Kvalita dat**, oddíl **Stopy**: „N kmotrů a svědků zapsaných jménem odpovídá osobě ve stromu.“ s **Projít
    po jednom**; dialog **Kmotři a svědci jménem, kteří jsou nejspíš ve stromu · N** se uloží hned, každé propojení
    nebo odmítnutí je jeden krok **Zpět**. Pod seznamem „Odmítnuté se znovu nenabízejí (n).“
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:80c2ffb9 src/participant-match.ts MIN_PARTICIPANT_AGE 12, cca ±2, attendsByOffice, příjmení po sňatku, linkRejected · src/ui/name-link-ui.ts · src/ui/shared-event-ui.ts (nabídka v editoru) · strings.ts events.linkOffer, linkOfferMany, link, notThisPerson, noneOfThem, linked · validation.nameLinkLead, nameLinkReview, nameLinkTitle, nameLinkHint, rejectedCount · spec 085 §6, 6g · dirigent:prace/1113-app-085-nalezy -->

<a id="A10.6"></a>
## A10.6 Sloučení osob a stromů

Sloučení nezdvojí společnou událost.

- **Sloučení dvou osob** ([A5.6](A5-tree-check.md#A5.6)): dialog **Sdílené události po sloučení** ukáže společné
  události obou osob. Událost, kterou mají obě, zůstane jednou („Jednou – je u obou.“); liší-li se věk, vybere se.
  Vlastní kopie, která se shoduje se společnou událostí druhé osoby, se k ní připojí (zaškrtnuté „Připojit ke
  společné události (N osob) – vlastní kopie se shoduje“).
- **Sloučení stromů** ([A8](A8-merging-trees.md)): společné události přicházejícího stromu se spárují s událostmi
  cílového (stejné ID, jinak stejný zápis) a převezmou jeho společnou událost. Osoba se dvěma stejnými kopiemi si
  nechá jednu. Společná událost, které zůstala jedna kopie, je obyčejná událost. Souhrn: „Sdílené události: n
  spojeno“.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:80c2ffb9 src/merge/* (párování shareId, sjednocení kopií) · src/ui/person-merge (sharedTitle) · strings.ts personMerge.sharedTitle, merge.sharedOnce, sharedAttach, sharedJoined · spec 085 K1.5 · dirigent:prace/1113-app-sdilena-udalost Výsledek -->

<a id="A10.7"></a>
## A10.7 Stromy uložené dřív

Strom uložený starší verzí aplikace se při prvním otevření upraví pro novou verzi. Předtím se jednou zálohuje
(**Před úpravou dat pro novou verzi**). Úprava nic nespojí; spojení nabízí Kvalita dat ([A10.4](#A10.4)).

- **Vlastní událost „Sčítání lidu“:** vlastní událost osoby se jménem přesně „Census“, „Sčítání lidu“,
  „Volkszählung“ nebo „Spis ludności“ (bez ohledu na velikost písmen a mezery na krajích) se stane událostí
  **Sčítání lidu**. Zůstane datum, místo, věk, dům, poznámka, prameny a účastníci. Vlastní události s jiným jménem
  a události páru zůstanou, jak jsou. Sloučení pak bere vlastní „Census“ a sčítání lidu jako tutéž událost, takže
  týž soubor načtený znovu žádnou událost nepřidá.
- **Neplatné sdílení** se zahodí: neplatné označení, sdílení u typu jen pro jednu osobu a sdílení s jedinou kopií.
- **Ovládání:** nic, proběhne samo. Záloha je v nabídce stromu → **Zálohy** → **Historie záloh**
  ([S6.5](S6-tree-from-another-program.md#S6.5)).
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:80c2ffb9 src/tree-manager.ts (verze dat 20, migrace), src/snapshots.ts 'pre-migration' · src/shared-events.ts (zahození neplatných shareId) · strings.ts snapshots.pre-migration „Před úpravou dat pro novou verzi“ · test gedcom-census-legacy.test.ts · dirigent:prace/1113-app-085-nalezy Výsledek (Census → census, záloha, NFC, trim, bez roleAt) -->
