<a id="A3"></a>
# A3 Doložení v aplikaci

Jak se v aplikaci zapisují prameny, cituje se jimi, přikládají se výřezy a soubory a kde aplikace sama ukáže, co
chybí. Popisuje aplikaci Strom 3.21.2 (a výzkum 1.25.2); změny z novější verze mají u sebe její číslo. Jak jistý je údaj
a jak se počítá doložení osoby, popisuje [R3.8](R3-verification-and-citation.md#R3.8); import pramenů z GEDCOM je
v [A2](A2-loading-a-family-tree.md).

<a id="A3.1"></a>
## A3.1 Pramen je jeden zápis

Pramen je jeden konkrétní zápis: křest, sňatek, úmrtí. Strom má jeden seznam pramenů. Osoby a údaje na ně jen
odkazují, takže jeden zápis může dokládat víc lidí i víc údajů.

- Pole: **Název** (povinné), **Archiv**, **Signatura**, **Folium/strana**, **Snímek**, **Další umístění**, **URL**,
  **Poznámka**. Kde zápis v knize stojí, popisuje [A3.9](#A3.9). Pod **Více: přepis, datum zápisu, spolehlivost** jsou
  **Přepis zápisu**, **Datum zápisu** a **Spolehlivost pramene**. Sekce je otevřená, když je některé z nich vyplněné.
- **Datum zápisu** říká, kdy byl zápis pořízen. Může se lišit od data události, např. křest zapsaný dodatečně.
- **Spolehlivost pramene** má tři stupně: **Originál**, **Opis / index**, **Nejisté**. Druhé klepnutí na zvolený stupeň
  ho zruší. Jak ji bere výzkum, popisuje [R3.2.1](R3-verification-and-citation.md#R3.2.1).
- **Hranice:** bez názvu pramen nejde uložit („Chybí název pramene“). Neplatné **Datum zápisu** se neuloží.
  Hodnota spolehlivosti 0 z importu GEDCOM se ukazuje jako **Nejisté** a zůstane, dokud se nevybere jiný stupeň.
  Smazání pramene odebere všechny jeho citace; aplikace se předem zeptá a řekne, na kolika místech je citován.
- **Ovládání:** **Akce → Prameny** (seznam pramenů stromu s počtem citací „n×“, hledání od 11 pramenů, řazení podle
  názvu); **Upravit pramen**, **Přidat pramen**. Položka **Prameny** v menu **Akce** je jen u stromu, který jde
  upravovat, a jen když už nějaký pramen existuje nebo je zapnuté **Nastavení → Karta osoby → Pokročilá pole**.
- **Platí od:** aplikace 1.4.0; **Spolehlivost pramene** a **Datum zápisu** 3.1.0; **Signatura**, **Folium/strana**,
  **Snímek** a **Další umístění** 3.27.0 (dřív **Archiv / instituce** a **Signatura / strana**)
- **Od aplikace 3.27.0:** **Spolehlivost pramene** je výchozí spolehlivost jeho citací. Citace, která má vlastní
  spolehlivost (z importu GEDCOM, [A2.6.1](A2-loading-a-family-tree.md#A2.6.1)), si ji nechá, i když se výchozí
  změní; ostatní citace se změnou řídí. Údaj ukazuje spolehlivost své citace ([A3.6](#A3.6),
  [S7.1](S7-reliability-and-verification.md#S7.1)). Dřív spolehlivost hodnotila jen celý pramen.

<!-- zdroj: app:src/types.ts Source · od 3.27.0: app:9732853b strings.ts sources.fieldRepository/fieldCallNumber/fieldFolio/fieldImage/fieldReference · src/ui/sources.ts:214 renderSourcesList, :327 deleteSource, :531 fillSourceEditor, :576 wireSourceEditor, :667 renderQualityControl, :733 saveSourceFromModal · src/ui/tree-management.ts:675 isSourcesMenuOffered · src/settings.ts:320 isAdvancedFields · strings.ts sources.titleHint/fieldTitle/fieldRepository/fieldReference/fieldUrl/fieldNote/more/fieldTranscript/fieldRecordDate/recordDateHint/reliabilityLabel (index.html source-quality-label)/quality1-3/titleRequired/citations/deleteConfirm, advanced.settingLabel · 3.27.0 výchozí spolehlivost: app:dde0151a src/citation-quality.ts setCitationQuality, citation-quality-shown.test.ts (formulář = výchozí) -->

<a id="A3.1.1"></a>
### A3.1.1 Přepis a Přepis ověřen

**Přepis zápisu** je text zápisu tak, jak ho přečetl uživatel. U stromu propojeného s výzkumem určuje nastavení
**Moje přepisy pramenů**, jak ho výzkum bere ([R3.5.1](R3-verification-and-citation.md#R3.5.1)). Editor podle toho
ukáže jedno ze tří:

- zaškrtávátko **Přepis ověřen**: u nastavení **Vodítko** vždy; u **Doloženo** jen u pramene poslaného před
  přepnutím a od té doby nezměněného, nebo u pramene, který už zaškrtnutý je;
- řádek „Platí jako první čtení (nastavení stromu „Doloženo“)“: u **Doloženo** a nového nebo změněného pramene;
- nic: strom bez výzkumu, pramen bez přepisu, nebo přepis, který četl výzkum sám.
- U přepisu, který četl výzkum, editor upozorní: oprava se uloží jako čtení uživatele a výzkum ji porovná se
  snímkem. V prohlížeči pramene je pod přepisem „Přepis četl uživatel / výzkum / uživatel i výzkum“.
- **Hranice:** zaškrtnutí nic nemění na stupni jistoty v aplikaci, rozhoduje výzkum. Když zaškrtávátko není vidět,
  **Přepis ověřen** zůstane, jen pokud se přepis nezměnil.
- **Ovládání:** editor pramene, **Více: přepis, datum zápisu, spolehlivost**; v **Akce → Prameny** filtr
  **Přepis neověřen** (jen u stromu **Doloženo** se staršími neověřenými prameny).
- **Platí od:** aplikace 3.9.0
- **Od aplikace 3.24.0:** překlad přepisu, který poslal výzkum ([R3.4](R3-verification-and-citation.md#R3.4)), je
  pod přepisem jako sbalený oddíl **Překlad přepisu**: v prohlížeči pramene i na kartě pramene na stránce osoby.
  Poznámka pramene se tím nemění; editor poznámky ji ukazuje celou. Pramen bez překladu vypadá jako dřív.
- **Od aplikace 3.25.0:** přepis, který četl jen výzkum, jde v prohlížeči pramene potvrdit bez změny textu
  ([A3.1.3](#A3.1.3)).

<!-- zdroj: app:src/research-sync.ts:357 researchReadSource, :365 isOlderSource, :377 verifiedOffer, :385 unverifiedOlderSources · src/ui/sources.ts:618 renderSourceReading, :658 sourceVerifiedValue, :296 renderSourcesFilter, :377 renderSourceViewer · strings.ts sources.verified/verifiedHintGuide/verifiedHintOlder/verifiedByTree/readBy/userReadingNote/filterUnverified · překlad (od 3.24.0): src/source-translation.ts SOURCE_TRANSLATION_LABELS, splitSourceTranslation · strings.ts viewerTranslation, translation · commit c2942b0 -->

<a id="A3.1.2"></a>
### A3.1.2 Smazat pramen u sledovaného stromu

U stromu, který aplikace sleduje živě z výzkumu, jde pramen smazat přímo ve výzkumu. Výzkum pramen odvolá
([R3.10](R3-verification-and-citation.md#R3.10)): z údajů a vyprávění zmizí jeho citace, data, místa, jména ani
text vyprávění se nemění a smazání jde vrátit.

- Okno **Prameny** je u sledovaného stromu jen ke čtení: bez úprav a přidávání, v řádku pramene je jen koš. Když
  výzkum neodpovídá, koš je v klidu a při najetí řekne „Smazat pramen jde, když výzkum běží.“ Na dotykovém zařízení
  je v řádku místo koše **⋯** s listem zespodu: **Otevřít pramen** a **Smazat pramen…**.
- Dialog **Smazat pramen?** nejdřív zjistí ve výzkumu, co na pramenu stojí („Zjišťuje se ve výzkumu, co na pramen
  odkazuje…“), a teprve pak dovolí smazat. Pod nadpisem **Co na pramenu stojí** řekne, kolik citací u údajů
  a kolik vyprávění pramen cituje, a po řádcích:
  - **Údaje** a **Bez pramene**: které údaje zůstanou bez pramene („Údaje zůstanou, jen bez citace.“) a které mají
    i jiný pramen;
  - **Méně jisté**: kolik údajů bude méně jistých;
  - **Vyprávění**: „Text vyprávění zůstane; pramen vypadne jen ze seznamu pramenů vyprávění.“ Kód pramene v textu
    zůstane, jen nebude odkazem;
  - **Rozpory**: rozpor zůstane a označí se „pramen odvolán – přezkoumat“ ([S3.4.1](S3-what-the-research-knows.md#S3.4.1));
    u rozhodnutého „rozhodnutí zůstává“. Rozpor se sám neuzavře;
  - **Úkoly** (otevřený, rozpracovaný, odložený, čeká): úkol jen na tomto prameni skončí jako vzdaný, jinému pramen
    vypadne z míst úkolu; řekne i, když na úkolu agent právě pracuje. **Vrátit** úkoly vrátí do dnešního stavu;
  - **Soubory**: soubor zůstane v Materiálech, jen bez vazby na pramen; snímky z archivu zůstanou u pramene. Když
    pramen vznikl ze souboru rodokmenu, dialog to řekne; smazat i soubor jde v Materiálech ([A3.5.17](#A3.5.17)).

  Pramen, který nikdo necituje, má jen „Pramen nikdo necituje.“
- Po **Smazat pramen** řekne oznámení „Pramen … smazán ve výzkumu.“ s **Vrátit**. **Vrátit** vrátí pramen i
  s citacemi; citaci, jejíž údaj se mezitím změnil, vrátit nejde a oznámení řekne kolik. Později jde pramen obnovit
  ve výzkumu (`strom source restore`).
- **Hlídá kód:**
  - smazání platí jen pro výčet, který dialog ukázal, a nejvýš 15 minut. Když se výčet mezitím změnil nebo potvrzení
    vypršelo, dialog ukáže nový výčet a smazání je třeba potvrdit znovu;
  - když výzkum zrovna zapisuje, smazání se za chvíli zkusí znovu. Pramen, který ve výzkumu už není, strom načte
    znovu; už odvolaný pramen dialog ohlásí;
  - výzkum jen ke čtení (zapečetěný na jiném počítači) smazání nenabídne.
- **Hranice:**
  - jen u sledovaného stromu výzkumu, který smazání pramene umí, a jen u pramene z výzkumu; ne u kopie stromu.
    Smazání při úpravách stromu z výzkumu popisuje [S2.6.1](S2-edits-from-the-app.md#S2.6.1);
  - **Vrátit** potřebuje běžící výzkum; jinak oznámení řekne, že pramen jde obnovit ve výzkumu. Pramen sloučený
    nebo odvolaný ve výzkumu jinak obnovit nejde.
- **Ovládání:** aplikace: **Akce → Prameny** → koš (na dotyku **⋯** → **Smazat pramen…**) → **Smazat pramen**;
  oznámení → **Vrátit**. Položka **Prameny** je u sledovaného stromu v menu, jen když jde smazání nabídnout.
- **Platí od:** aplikace 3.31.0 s výzkumem 1.36.0

<!-- zdroj: app:d527ffdd src/source-retract.ts sourceRetractOfferedIn (null bez sledování, jen ke čtení, kopie link.copy, bez brány source.retract; off když most neodpovídá), RETRACT stavy · 9d91f035, 4178ef85 src/ui/sources.ts sourcesReadOnly, openSourceRowSheet, source-retract-ui.ts (dialog, toast Vrátit, /source/restore) · src/ui/tree-management.ts isSourcesMenuOffered (zamčený strom jen se sourceRetractOffered) · strings.ts sources.retract.* (trashOff, rowMenu, menuDelete, menuOpen, title, intro, loading, usesTitle, counts, rows, bare, hasOther, lowered, storyKeep, storyCode, conflictReview, conflictDecided, conflictNever, taskState, taskDropped, taskNarrowed, taskDoing, tasksBack, filesStay, images, fileTree, undoLater, noCites, go, changed, expired, busyWait, gone, already, readonly, toast, undo, restored, restoredPart, restoreDown, notRestorable) · SPEC.md 1120-app-117-smazani · research:e6bbfb40 src/core/sourceretract.ts RETRACT_CONFIRM_MS · spec 117 §1–§3, J3 -->

<a id="A3.1.3"></a>
### A3.1.3 Potvrdit přepis výzkumu

Přepis, který četl jen výzkum, může uživatel potvrdit: přečetl zápis sám a přepis souhlasí. Text se nemění; přepis
pak platí i jako čtení uživatele ([R3.5.2](R3-verification-and-citation.md#R3.5.2)).

- V prohlížeči pramene je na konci řádku „Přepis četl výzkum“ malé tlačítko **Potvrdit přepis** („Přepis souhlasí se
  záznamem. Bude platit i jako čtení uživatele.“). Po potvrzení řádek zní „Přepis četl výzkum, uživatel ho potvrdil
  ‹datum›“ a tlačítko je **Zrušit potvrzení** („Přepis bude znovu platit jen jako čtení výzkumu.“).
- **Hranice:**
  - jen u pramene s přepisem, který výzkum zná a četl jen on; přepis, který uživatel přečetl jinak, potvrdit nejde;
  - jen u stromu propojeného s výzkumem, jehož most potvrzení přijímá; ne v Archivu Stromu, u výzkumu, který čeká na
    agenta, ani u stromu otevřeného jen ke čtení;
  - když výzkum neběží, tlačítko je v klidu s větou „Potvrdit jde, když výzkum běží.“ (u zrušení „Zrušit potvrzení
    jde, když výzkum běží.“);
  - potvrzení zapíše výzkum, ne aplikace. Odpověď je vidět hned; do stromu přijde s další verzí výzkumu;
  - výzkum může odmítnout a aplikace řekne proč: přepis se mezitím změnil („Potvrdit jde nové znění, až dorazí.“),
    pramen je sloučený, odvolaný nebo už ve výzkumu není, nebo výzkum naposledy zapsala novější verze Strom
    Research;
  - potvrzení nemění stupeň jistoty v aplikaci; rozhoduje výzkum.
- **Ovládání:** aplikace: **Akce → Prameny** → pramen → **Potvrdit přepis** / **Zrušit potvrzení**; platí i u stromu,
  který aplikace sleduje živě z výzkumu.
- **Platí od:** aplikace 3.25.0, výzkum 1.29.0

<!-- zdroj: app:v3.30.0 src/source-confirm.ts (SOURCES_CONFIRM_FEATURE sources.confirm, SOURCE_CONFIRM_TIMEOUT_MS, sourceConfirmAction, sourceConfirmOffer: agentless, readOnly, rest) · src/ui/source-confirm-ui.ts (prohlížeč pramene, odpověď hned, strom až s další verzí výzkumu _STROM_READ/_CONF/_TXT) · strings.ts sources.readConfirmed, sources.confirm.action/actionTitle/undo/undoTitle/restConfirm/restUndo/changed/merged/retracted/reader/none/archive/locked · CHANGELOG.cs.md 3.25.0 · research:src/core/confirm.ts -->


<a id="A3.2"></a>
## A3.2 Citace: co pramen dokládá

Citace říká, který údaj pramen dokládá. Cituje se k osobě, k jejímu narození a úmrtí, k jednotlivé události osoby,
ke sňatku a ke společné události páru. Z citací aplikace počítá úroveň doložení osoby
([R3.8.1](R3-verification-and-citation.md#R3.8.1)).

- V úpravě osoby: sekce **Prameny** (citace k osobě), **+ pramen** pod polem narození a úmrtí, citace u každé
  události; u svazku **Citovat pramen (oddací matrika…)**. Citace je štítek s názvem pramene; klepnutí otevře
  prohlížeč pramene, × odebere citaci (**Odebrat citaci**), pramen zůstane.
- Mimo úpravu osoby (menu osoby **Prameny**, zvýraznění [A3.7](#A3.7)) se ve výběru pramene ukáže **Dokládá**:
  **Osobu** / **Narození** / **Úmrtí**. Úmrtí jen u osoby s úmrtím. Když narození ještě nemá pramen, výběr začne
  na **Narození**.
- **Hranice:** citace nemá stupeň jistoty. Pramen přiložený jen k osobě dokládá osobu, ne narození. Strom jen pro
  čtení, uzamčený strom a zamčená osoba citovat nedovolí. U osoby jsou sekce pramenů a příloh vidět, když je
  zapnuté **Pokročilá pole**, nebo když už je něco vyplněné.
- **Ovládání:** viz výše; výběr pramene popisuje [A3.2.1](#A3.2.1).
- **Platí od:** aplikace 1.4.0; **Dokládá** a **+ pramen** 3.5.0

<!-- zdroj: app:src/ui/sources.ts:1220 renderSourceChips, :1288-1306 unciteBirthSource…unciteEventSource, :1331 showSourcePickerForPersonId, :1343 showSourcePickerForFact, :1356 renderSourcePickerFact, :1399 showSourcePickerForPartnership · src/ui/person-sources-ui.ts:114 canCiteOnPerson · src/settings.ts:320 · strings.ts sources.sectionTitle/citeAdd/citePartnership/remove/pickerFactLabel/pickerFactPerson, advanced.settingHint -->

<a id="A3.2.1"></a>
### A3.2.1 Výběr pramene

- **Citovat pramen** otevře výběr. Hledá se v názvu, archivu, signatuře a přepisu. Prameny už citované u téhož
  údaje se nenabízejí.
- **Naposledy použité**: až 5 pramenů, zvlášť pro každý strom v tomto prohlížeči. Ukážou se, jen když má strom
  víc než 8 pramenů a hledání je prázdné.
- **Nový pramen…** předvyplní název podle toho, co se cituje: „Narození – Marie Vlková, 1865“, „Sňatek – Josef
  Horák a Marie Vlková, 1890“. Rok chybí, když není známý. Nový pramen se rovnou ocituje.
- **Jiná stránka** u pramene ve výběru: nový pramen se stejným názvem, archivem, odkazem, spolehlivostí a
  poznámkou; ze signatury zmizí strana, z poznámky řádky se stranou a s datem zápisu. Když název knihy jmenuje
  osobu ze stromu, navrhne se název podle citovaného údaje.
- **Další zápis ze stejné knihy** (prohlížeč a editor pramene): nový pramen se stejným archivem a odkazem; signatura
  bez čísla a data zápisu, tedy kniha, snímek a strana („kn. 12, sn. 5, str. 3, 2. zápis (3. 4. 1801)“ →
  „kn. 12, sn. 5, str. 3“). Signatura, ve které aplikace část se zápisem nepozná, zůstane celá a označená ke
  kontrole. Otevřený ze štítku citace se rovnou ocituje tam.
- **Platí od:** aplikace 3.1.0 (**Naposledy použité**, **Další zápis ze stejné knihy**); **Jiná stránka** 3.9.0;
  3.25.0: **Další zápis ze stejné knihy** bez čísla a data zápisu
- **Od aplikace 3.27.0:** hledá se i v signatuře, foliu a snímku. U pramene s poli ([A3.9](#A3.9)) **Další zápis ze
  stejné knihy** převezme archiv, signaturu a odkaz; **Folium/strana**, **Snímek** a **Další umístění** zůstanou
  prázdné a kurzor stojí ve **Folium/strana**. **Jiná stránka** u pramene s poli převezme i signaturu. Starší pramen
  (umístění jedním textem) se chová jako dřív.

<!-- zdroj: app:src/ui/sources.ts:1427 renderSourcePickerList, :322 sourceMatches, :1475 currentCitationSourceIds, :1505 noteRecentSource, :1526 otherPageFromPicker, :1554 createSourceFromPicker, :1569 suggestedSourceTitle, :1181 startSameBookEntry · src/settings.ts:12 RECENT_SOURCES_MAX · strings.ts sources.pickTitle/searchPlaceholder/recent/all/createNew/newTitleMarriage/otherPage/otherPageTitle/sameBook · 3.25.0: app:7327b758 src/source-page.ts sameBookReference (ENTRY_PART, DATE_PART, whole), src/ui/sources.ts:1217 (nepoznaný tvar označený) · CHANGELOG.cs.md 3.25.0 · dirigent:test/vysledek-1107-nejista-mista.md · 3.27.0: app:9732853b (další zápis s poli, Jiná stránka se signaturou), c3278633 sourcePlaceSearchText -->

<a id="A3.2.2"></a>
### A3.2.2 Pořadí citací a hlavní citace

Údaj s víc citacemi je má všude v jednom pořadí: štítky v úpravě osoby a u sňatku, bublina stavu údaje, **Prameny**
osoby. Kde aplikace bere jen jednu citaci, bere první: výňatek na stránce osoby, sňatek na stránkách rodiny, čísla
pramenů v knize rodu, sloupce citací v **Tabulce** ([A6.7](A6-views.md#A6.7)) a první pramen u **Ověřit**
([S7.3](S7-reliability-and-verification.md#S7.3)). Stejné pořadí má výzkum ([R3.4.5](R3-verification-and-citation.md#R3.4.5)).

- **Pořadí:**
  1. hlavní citace, kterou zvolil uživatel;
  2. primární záznam události: pramen, který zapisuje tento druh události, s citací **Originál** a zapsaný nejvýš
     12 měsíců od údaje. U narození a křtu záznam narození nebo křtu, u úmrtí, pohřbu a kremace záznam úmrtí nebo
     pohřbu, u sňatku, ohlášek a zasnoubení záznam sňatku, u sčítání sčítání. Dřív zapsaný stojí před později
     zapsaným, pramen bez **Datum zápisu** za zapsanými s datem. Chybějící nebo nečitelné datum údaje nerozhoduje;
  3. ostatní citace se spolehlivostí **Originál**;
  4. ostatní podle spolehlivosti: **Opis / index**, **Nejisté**, pak bez spolehlivosti;
  5. podle číselné části čísla pramene (pramen bez čísla za číslovanými), nakonec pořadí, ve kterém byly citace
     přidány.
- Jaké události pramen zapisuje, aplikace ví ze souboru GEDCOM (`1 DATA` › `2 EVEN`, [A2.6](A2-loading-a-family-tree.md#A2.6));
  výzkum to píše u svých pramenů. Pramen bez toho primárním záznamem není.
- **Hlavní citace:** jednu citaci údaje může uživatel označit jako hlavní. Stojí první, štítek má ★ před názvem
  a zvýrazněný okraj, jeho tlačítko říká „hlavní citace“. V bublině stavu je u ní „★ hlavní“, v **Prameny** osoby
  a v **Dokládá** prohlížeče pramene ★ za údajem. Citace, která je první jen podle pořadí, značku nemá.
- **Pruh v prohlížeči pramene:** prohlížeč otevřený z citace údaje (štítek, řádek bubliny stavu, řádek **Prameny**
  osoby) ukáže nahoře, co citace dokládá („Narození · Marie Vlková“) a kde v pořadí stojí: „2. ze 3 citací“; u první
  i proč („stojí první: zápis narození, originál“, „originál“, „nejvyšší spolehlivost“); „Hlavní citace u narození“;
  „Jediná citace u narození“. Pod tím tlačítka **Označit jako hlavní** nebo **Zrušit hlavní** a **Odebrat citaci**
  ([A3.2.3](#A3.2.3)).
- **Hranice:**
  - uložené seznamy citací se nepřeřazují; pořadí se počítá při zobrazení a exportu;
  - **Označit jako hlavní** je jen u údaje se 2 a víc citacemi, a jen u stromu bez výzkumu nebo s výzkumem, který
    hlavní citaci drží (výzkum 1.34.0 a novější). Jen tam se ukazuje i ★;
  - strom výzkumu, který pořadí citací určuje sám, má citace v pořadí ze souboru výzkumu; hlavní citace stojí první;
  - u zamčené osoby a u stromu jen pro čtení tlačítka nejsou;
  - označení, výměna i zrušení je jeden krok **Zpět** („Hlavní citace u narození: …“, „Hlavní citace u narození
    zrušena, pořadí řídí automatika“). Odebrání hlavní citace nebo jejího pramene a úprava události bez ní značku
    zruší v tomtéž kroku; **Zpět** vrátí místo i ★;
  - společná událost ([A10.1](A10-shared-events.md#A10.1)) má hlavní citaci společnou pro všechny kopie; kopie, které
    se v ní liší, jsou kopie, které se liší ([A10.3](A10-shared-events.md#A10.3));
  - pramen sloučený do jiného přenese značku na pramen, do kterého se sloučil. Sloučení stromů
    ([A8](A8-merging-trees.md)) nechá značku té strany, která ji má; když ji mají obě, ponechané strany.
- **Ovládání:** prohlížeč pramene otevřený z citace údaje → **Označit jako hlavní** · **Zrušit hlavní**. Terminál
  výzkumu: `strom event main` ([R3.4.5](R3-verification-and-citation.md#R3.4.5)).
- **Platí od:** aplikace 3.29.0

<!-- zdroj: app:e361220d src/citation-order.ts FACT_RECORDS, recordOfFact, PRIMARY_RECORD_MONTHS 12, orderedCitationSteps (main, primary jen QUAY 3, written, QUAY, number, list), citationMain (jeden krok Zpět, sdílená kopie, remap, merge/executor.ts), data v21 · 9c0ca227 (★ a pořadí: sources.ts chipy, relationships-panel, status-tip „★ hlavní“, person-sources, person-page, family-pages-html, book-blocks, table-sources, verify.ts) · 192d53ec src/citation-bar.ts citeBar, whyFirst, citeMainToast · src/citation-gates.ts citationMainOffered, citationFileOrder, citationMainShown · strings.ts sources.mainMark, citeAt, citePos, citeFirstWhy, whyPrimary, whyOriginal, whyQuality, citeMainAt, citeOnly, setMain, clearMain, mainSetToast, mainClearedToast · spec 095 K1.1, §2 -->

<a id="A3.2.3"></a>
### A3.2.3 Odebrat citaci

**Odebrat citaci** odpojí pramen od jednoho údaje. Pramen zůstane v **Prameny** stromu i se svými výřezy
a přílohami, ostatní údaje ho citují dál.

- **Hlídá kód:**
  - bez potvrzení, i u hlavní citace. Pruh v prohlížeči pak říká „Odpojeno od narození · pramen zůstává v katalogu“
    a tlačítka zmizí;
  - hláška jmenuje údaj a pramen: „Citace odebrána od narození: … · pramen zůstává“, u hlavní citace „…, hlavní
    zrušena: …“, u společné události „… u všech N osob: …“ (odebere se ze všech kopií);
  - jeden krok **Zpět**: **Vrátit** v hlášce vrátí citaci na její místo i s ★. Hláška stojí i nad otevřeným
    prohlížečem, takže **Vrátit** jde použít tam;
  - u stromu výzkumu, který odebrání nepřebírá, je pod tlačítky „Výzkum odebrání zatím nepřevezme.“ a první odebrání
    v okně řekne „Výzkum toto odebrání nepřevezme; po načtení jeho verze se citace vrátí.“, další už jen „výzkum
    nepřevezme“. Co výzkum s odebráním udělá, popisuje [S2.3.1](S2-edits-from-the-app.md#S2.3.1).
- **Hranice:** u zamčené osoby a u stromu jen pro čtení tlačítko není. Celý pramen se maže v **Akce → Prameny**
  ([A3.1](#A3.1)).
- **Ovládání:** prohlížeč pramene otevřený z citace údaje → **Odebrat citaci**; × na štítku citace v úpravě osoby
  ([A3.2](#A3.2)).
- **Platí od:** aplikace 1.4.0 (× na štítku); pruh a hláška 3.29.0

<!-- zdroj: app:192d53ec src/citation-bar.ts citeBar (gone, note = editable && removeNotTaken), unciteToast (unciteWarned jednou na strom v okně), citeBarHtml · src/citation-gates.ts citationRemoveTaken (feature citations.remove) · strings.ts sources.citeGone, uncitedToast, uncitedMainToast, uncitedSharedToast, sourceStays, uncitedNotTaken, uncitedNotTakenShort, unciteNote, undo.uncite · spec 095 §3 -->

<a id="A3.3"></a>
## A3.3 Výřez zápisu

Výřez zápisu je obrázek přesně toho zápisu, ne celé strany. Ukáže se u pramene, v prohlížeči i v knize.

- Tři cesty: **Vložit ze schránky** (Ctrl+V, na Macu ⌘V; výstřižek se vezme, jak je), **Nahrát obrázek** (otevře
  ořez **Vyříznout zápis**) a **Vyříznout z přílohy** (obrázkové přílohy osoby, u sňatku obou partnerů). Obrázek jde
  i přetáhnout na prázdné pole.
- Výřez se uloží jako JPEG s delší stranou nejvýš 1200 px. **Popisek (volitelné)** zůstane i po **Nahradit**.
- **Uložit i celou stranu jako přílohu osoby** v ořezu: celá strana se přidá k osobě jako příloha ([A3.4](#A3.4)).
  **Oříznout** pak jde znovu z celé strany.
- Prohlížeč pramene: výřezy (klepnutím zvětšit), **Otevřít stranu v archivu ↗** (odkaz výřezu, jinak URL pramene),
  **Přepis**, **Dokládá** (seznam citací); bez výřezu **Přidat výřez**. U výřezu, který udělal výzkum, je
  **Plná kvalita**: otevře výřez z originálního skenu ve výzkumu.
- **Hranice:** v aplikaci jdou přidat nejvýš dva výřezy (zápis a pokračování z další strany). Výzkum jich zapisuje
  až tři ([R3.4](R3-verification-and-citation.md#R3.4)); třetí aplikace zachová, další nepřidá. Celou stranu jde
  uložit jen u osoby, ne u sňatku a ne u zamčené osoby. Otočení v ořezu zruší vazbu výřezu na přílohu. Obrazy,
  které výzkum do aplikace neposlal, jsou ve filtru **Obraz jen ve výzkumu · N** ([A3.8](#A3.8)).
- **Ovládání:** editor pramene, blok **Výřez zápisu**; **+ Přidat pokračování z další strany**; **Oříznout**,
  **Nahradit**, **Odebrat výřez**. „Výřezy: …“ v **Akce → Prameny** ukazuje velikost všech výřezů od 1 MB.
- **Platí od:** aplikace 3.1.0; **Plná kvalita** 3.4.0; obrazy z výzkumu 3.14.0 ([A3.8](#A3.8))

<!-- zdroj: app:src/types.ts:257 MAX_EXCERPTS_UI · src/excerpts.ts:12-14 EXCERPT_MAX_SIDE, EXCERPT_QUALITY · src/ui/sources.ts:853 renderExcerptBlock, :932 excerptAdderHtml, :999 addExcerptFromPaste, :1017 addExcerptFromUpload, :1047 recropExcerpt, :1099 addExcerptFromAttachment, :1121 putExcerptDraft, :1158 keepPagePersonId, :1165 excerptContextPages, :377 renderSourceViewer · src/ui/research-ui.ts:2263 excerptResearchUrl · strings.ts sources.excerpt*/viewer*/addExcerpt/excerptsTotal, crop.title/keepPage, research.fullQuality/fullQualityTitle, researchImages.filter -->

<a id="A3.4"></a>
## A3.4 Přílohy

Příloha je soubor u osoby: sken strany, dokument, fotografie listiny. Příloha sama nic nedokládá; doklad je
citace pramene ([A3.2](#A3.2)). Z obrázkové přílohy jde vyříznout výřez zápisu ([A3.3](#A3.3)).

- JPG a PNG se zmenší na JPEG s delší stranou nejvýš 1600 px. PDF zůstane, jak je, do 2 MB. Jiné typy aplikace
  odmítne („Nepodporovaný typ souboru. Podporované jsou JPG, PNG a PDF.“).
- U přílohy jde napsat **Poznámka (nepovinné)**. PDF se otevře v nové kartě.
- Pod přílohami je součet: „U této osoby: fotka …, n příloh …, n výřezů z pramenů …“.
- **Hranice:** u stromu propojeného s výzkumem, který přijímá originály, jde přidat i TIFF, HEIC a PDF nad 2 MB.
  Ve stromu je pak jen záznam bez náhledu („náhled udělá výzkum“) a soubor dostane jen výzkum. Když výzkum neběží,
  aplikace takový soubor nepřijme. Média nad 10 MB zpomalují ukládání; **Přehled stromu** na to upozorní.
- **Ovládání:** úprava osoby, sekce **Přílohy** → **Přidat přílohu**; sekce je vidět s **Pokročilá pole** nebo
  když osoba přílohy má.
- **Platí od:** aplikace 1.4.0; TIFF, HEIC a velké PDF pro výzkum 3.9.0
- **Od aplikace 3.30.0:** celá fotka, ze které je portrét osoby, je příloha se štítkem **Portrét**. Vznikne sama při
  výběru nové fotky portrétu. Jiná obrázková příloha nabízí **Jako portrét…** (v materiálech a prohlížeči **Použít
  jako portrét…**). Smazání přílohy se štítkem portrét nechá ([A12.2](A12-portrait-and-couple-photo.md#A12.2)).
- **Od aplikace 3.30.0:** příloha je materiál stromu ([A3.5](#A3.5)). Stejný soubor u více osob je jeden soubor;
  přidaný podruhé nabídne **Připojit i sem** ([A3.5.4](#A3.5.4)). Koš u přílohy ho odebere jen od této osoby,
  s **Zpět**; poslední místo se ptá jako **Odstranit ze stromu…** ([A3.5.6](#A3.5.6)). Na širší obrazovce jsou akce
  přílohy v menu ⋯.

<!-- zdroj: app:src/attachments.ts:12-18 ATTACHMENT_MAX_SIDE, ATTACHMENT_QUALITY, MAX_PDF_BYTES, ATTACHMENT_WARN_BYTES · src/ui/attachments-ui.ts:28-31 ORIGINAL_ONLY_TYPES/needsOriginalOnly, :161 accept, :211 addAttachmentFile · strings.ts attachments.*, media.originalOnlyMeta/originalOnlyNeedsResearch, treeOverview.mediaWarning · 3.30.0: app:e6f0595d attachments-ui.ts štítek Portrét, asPortrait, danger.portraitSourceNote · 3.30.0 příloha jako materiál: app:2b66d7cf (verze dat 24), a275d977 (Soubor už ve stromu je), 13e4a70c src/ui/attachments-ui.ts removeAttachmentFromPerson, 30b0accd (akce v ⋯) -->

<a id="A3.4.1"></a>
### A3.4.1 Originály pro výzkum

U stromu propojeného s výzkumem si aplikace u každého obrázku a PDF zapamatuje otisk originálu, ještě než soubor
zmenší. Originál v plné kvalitě pošle výzkumu; ve stromu zůstane náhled. Výzkum ho uloží k osobě, případně
k prameni a k místu výřezu.

- Stav u přílohy: „Originál čeká na odeslání do výzkumu“, „Originál je ve výzkumu“, „jen náhled“ s důvodem,
  „Originál už ve výzkumu není“.
- Když výzkum neběží, originály čekají v tomto prohlížeči, nejvýš 2 GB a nejvýš 30 % místa prohlížeče. Nejsou ve
  stromu, v zálohách ani v exportu. Aplikace upozorní, když čekají 3 dny nebo když je místo skoro plné.
- **Plná kvalita** u přílohy otevře originál přímo v aplikaci, když výzkum běží a soubor je JPEG, PNG, WebP nebo
  PDF do 50 MB; jinak ve výzkumu.
- Smazání přílohy s čekajícím originálem: originál jde zahodit, nebo poslat; výzkum ho pak odpojí s poznámkou
  „odebráno v aplikaci“.
- **Hranice:** jen na počítači a jen u výzkumu, který originály přijímá. Šifrovaný strom originál v prohlížeči
  nenechá čekat: pošle ho rovnou běžícímu výzkumu, jinak zůstane jen náhled. Safari originály neposílá.
- **Ovládání:** **Výzkum u stromu → Posílat originály souborů** (vypnutím jen náhledy); **Nastavení → Data a
  soukromí → Originály čekající na výzkum** (jen když něco čeká; zahodit jednotlivě i vše). Odesílání podrobněji v
  [S2](S2-edits-from-the-app.md).
- **Platí od:** aplikace 3.9.0

<!-- zdroj: app:src/originals.ts:19-21 ORIGINALS_MAX_BYTES, ORIGINALS_QUOTA_SHARE, :60 originalsBudget · src/ui/originals-ui.ts:68 FULL_QUALITY_MAX_BYTES, :231 researchOriginalsLink, :241 prepareOriginal, :261 queueOriginal, :320 researchMediaAccepts, :358 fullQualityMode, :479 originalsQueueWarn · src/ui/research-tree-settings-ui.ts:232, :386 sendMedia · strings.ts media.*, mediaQueue.*, researchTree.originals/originalsDesc, research.fullQualityAppTitle -->

<a id="A3.5"></a>
## A3.5 Materiály

Materiál je každý soubor stromu: sken, fotka, dopis, listina. Stejný soubor je ve stromu jednou, i když je u více
osob, a nese svá místa: osoby, údaj nebo událost, svazek, pramen. Okno **Materiály** má každý strom. U stromu
s výzkumem nebo Archivem Stromu ukazuje i soubory výzkumu, které ve stromu nikde nejsou (**jen v archivu**).

- Materiál stromu je příloha osoby ([A3.4](#A3.4)), celá fotka portrétu a fotka svazku
  ([A12](A12-portrait-and-couple-photo.md)), soubor u události nebo svazku i doklad pramene ([A3.5.5](#A3.5.5)).
  Kde je soubor uložený, popisuje [S8](S8-where-the-data-are.md).
- Soubory jde výzkumu poslat i bez přidání do stromu: **Poslat materiál…** u osoby a **Poslat materiál k
  prameni…** (prohlížeč a editor pramene), nejvýš 20 souborů najednou, s **Poznámka pro výzkum**. Výzkum z nich
  udělá úkol pro agenta ([R11.1](R11-material-from-the-user.md#R11.1)). **Přidat i jako přílohu do stromu** dá do
  stromu i náhled. Celou složku pošle **Přidat materiály…** v menu výzkumu
  ([R11.4](R11-material-from-the-user.md#R11.4)) i v záhlaví okna **Materiály** ([A3.5.15](#A3.5.15)). U Archivu
  Stromu je to **Přidat materiál…** a **Uložit i do stromu** (obrázky a PDF do 2 MB).
- Když výzkum neběží, poslané soubory čekají v prohlížeči. Když výzkum osobu ještě nezná, pošlou se po dalším
  poslání stromu.
- **Hranice:**
  - posílat materiál jde jen na počítači, u stromu propojeného s výzkumem, který přijímá originály. Výzkum nikdy
    nepřijme programy, klíče, archivy ani soubory rodokmenu (GEDCOM);
  - soubory výzkumu mimo strom jsou vidět jen v aplikaci na počítači („Materiály z výzkumu jsou vidět v aplikaci na
    počítači.“); na telefonu okno ukazuje soubory stromu;
  - u stromu jen ke čtení jde soubory prohlížet a stáhnout, ne měnit;
  - výzkum starší než 1.35.0 neumí titulky, vazby, použití ani třídění souborů mimo strom; aplikace to u akce řekne
    („… umí novější verze výzkumu“).
- **Ovládání:** strom bez výzkumu: **Akce › Materiály** (s počtem souborů); strom s výzkumem: **Materiály** v menu
  výzkumu. U osoby: **Všechny materiály osoby (N) ›** pod přílohami a **Materiály** v menu osoby (okno s filtrem
  na osobu).
- **Platí od:** aplikace 3.9.0; sekce a okno **Materiály** 3.16.0; 3.30.0: okno u každého stromu, soubor stromu
  jako jeden materiál s místy (verze dat 24)
- **Od aplikace 3.31.0 s výzkumem 1.36.0:** výzkum soubory projde sám jen se zapnutým nastavením **Soubory poslané do
  výzkumu projde agent sám** ([S4.4.11](S4-research-from-the-app.md#S4.4.11),
  [R11.6](R11-material-from-the-user.md#R11.6)). Vypnuto (výchozí):
  - **Poslat materiál…** říká „Do stromu se nic nepřidá. Výzkum soubory uloží k osobě. Čekají v Materiálech, agent
    je projde jen na požádání.“ (u pramene „… k prameni.“). Po poslání hláška „Posláno do výzkumu (Jan Horák):
    1 soubor. Čeká v Materiálech neroztříděný.“ s **Roztřídit agentem…** (na počítači s oknem **Materiály**,
    [A3.5.8](#A3.5.8)) a **Zobrazit**;
  - potvrzení dávky **Přidat materiály…** nemá bloky **Soukromí** a **Odhad ceny**, jen „Soubory se uloží do výzkumu
    mimo git a čekají v Materiálech neroztříděné. Agent je roztřídí jen na požádání; cena se ukáže předem.“;
  - konec dávky říká „Soubory čekají v Materiálech neroztříděné. Agent je roztřídí jen na požádání.“ a nabízí
    **Roztřídit agentem…** pro soubory dávky; když to nejde hned, odkáže na **Roztřídit agentem…** v Materiálech.
    Zapnuto: „Výzkum dávku roztřídí sám. …“ s počtem **Úkoly k roztřídění**;
  - soubor, který agent ještě neprošel, má v Materiálech stav **neroztříděno** (zapnuto: **čeká na zpracování**).

  Se starším výzkumem platí dosavadní texty.

<!-- zdroj: dirigent:spec/102-sprava-materialu-a-pramenu · app:2b66d7cf src/types.ts STROM_DATA_VERSION 24, Attachment.places (MediaPlace), migrace v23→v24 (stejný soubor u více osob jeden záznam) · src/media.ts allMedia, treeMedia · app:1ebf7896 src/ui/materials-ui.ts materialsWindowOn, materialsListOn · src/ui/tree-management.ts (Akce › Materiály) · src/ui/research-actions-ui.ts:373 · src/ui/attachments-ui.ts attachments-all-materials · app:a275d977 menu osoby Materiály · src/ui/material-ui.ts MATERIAL_MAX_FILES, MATERIAL_NOTE_MAX, REFUSED_EXT, materialAvailable · strings.ts material.*, materials.desktopOnlyResearch, treeReadOnly, olderEdit, assignNewer, agentSort.older · app:CHANGELOG.cs.md 3.30.0 -->

<a id="A3.5.1"></a>
### A3.5.1 Okno Materiály

Okno ukazuje každý soubor jednou: soubory stromu se všemi osobami, u kterých jsou, a vedle archivu i soubory
výzkumu.

- **Seskupit:** **Podle data přidání** (s osobami, u kterých se soubor přidal) nebo **Podle osoby**; soubor jen
  u pramene nebo svazku je pod **Bez osoby**. Vedle archivu navíc **Dávky** a **Podle data přijetí**.
- **Pohled** **Mřížka** nebo **Seznam**. Seznam má sloupce **Titulek**, **Druh**, **Datum**, **Osoby**, **Pramen**,
  **Ve stromu** a **Použito**; řadí se klikem na záhlaví. Dlaždice ukazuje, na kolika místech je soubor použitý.
- **Hledat v titulku, názvu a poznámce**; **Filtry** podle osoby, druhu a dávky. Skryté soubory výzkumu ukáže
  **Zobrazit skryté**.
- ⓘ u názvu okna (**Kde soubory jsou**) řekne, kde soubory jsou: „Soubory jsou jen v tomto prohlížeči. Záloha:
  Exportovat vše.“, nebo ve výzkumu či Archivu Stromu na tomto počítači se zmenšenými kopiemi v aplikaci; u
  šifrovaného stromu i to, že výzkum na disku šifrovaný není.
- Osoba bez jména nebo zapsaná jako „?“ je **Neznámá osoba** (s roky, když je má).
- **Hranice:** na telefonu není okno v nabídce **Více**; otevře se od osoby. Když výzkum neběží, okno ukazuje stav
  z doby, kdy běžel, a řekne, co jde upravit: titulky a vazby souborů stromu se zapíšou se stromem, materiál mimo
  strom až s běžícím výzkumem.
- **Řadit ▾** v liště okna řadí Mřížku i Seznam stejně, uvnitř skupin: **Výchozí pořadí**, nebo sloupec (**Titulek**,
  **Druh**, **Datum**, **Osoby**, **Pramen**, u archivu **Ve stromu**, **Použito**) a **Vzestupně** / **Sestupně**.
  Klik na záhlaví Seznamu mění totéž řazení. Řazení se pamatuje na tomto zařízení. Na tabletu a v okně do 1024 px je
  v **Filtry**.
- **Ovládání:** viz [A3.5](#A3.5); výběr souborů: **Vybrat**, Ctrl/Cmd+A vybere, co filtry ukazují.
- **Platí od:** aplikace 3.30.0
- **Od aplikace 3.31.0:** na telefonu se okno otevírá i z **Více → Pro rodinu**: první řádek **Materiály** s počtem
  souborů. Na tabletu zůstává **Materiály** v první úrovni **Více**.

<!-- zdroj: app:c9775287 src/materials-overview.ts chooseSort, sortOverviewGroups (uvnitř skupin), src/ui/materials-window.ts mwSortChipHtml, mwSortMenu, mwSortColumns (intree jen model archive), mwSetSort → writeListPrefs (localStorage), filtry ≤ 1024 · strings.ts materials.sortBy, sortChip, sortDefault, sortAscending, sortDescending · app:1ebf7896 src/ui/materials-ui.ts, src/ui/materials-window.ts (skupiny, Kde soubory jsou) · app:a1127378 sloupce seznamu, Ctrl/Cmd+A · app:b198b1c2 src/media-uses.ts materialPersonLabel (Neznámá osoba) · app:e6e16634 staleEdit · app:prace/1117-app-102-materialy D1 (telefon: bez řádku Materiály ve Více) · strings.ts materials.groupAdded, groupPerson, groupBatch, groupDate, whereTitle, whereApp, whereArchiveResearch, whereEncryptedResearch, search, showHidden, unknownPerson, staleEdit · 3.31.0: app:122a5096 src/ui/bottom-sheet.ts materialsRow (s počtem materialsAppCount) jako první řádek stránky menu.forFamily jen isPhoneBar, jinak v první úrovni · strings.ts materials.menu, menu.forFamily · dirigent:prace/1122-app-mobil-drobnosti -->

<a id="A3.5.2"></a>
### A3.5.2 Titulek, druh a datum

Soubor může mít **titulek**, **druh** (**Fotka**, **Dokument**, **Listina**, **Jiné**) a **datum**. Titulek se
ukáže místo názvu souboru; prázdný titulek znamená název souboru.

- Datum je rok, datum nebo rozmezí („asi 1920“); co nejde přečíst, aplikace neuloží („Datum nejde přečíst.“).
- Stránka osoby, kniha rodu a uložená stránka popisují soubor celým titulkem, druhem a rokem data.
- Úprava souboru stromu je jeden krok **Zpět**; soubor mimo strom se upraví ve výzkumu, s oznámením a **Zpět**.
- GEDCOM nese titulek jako `TITL` (název souboru jako `_STROM_NAME`) a druh jako `TYPE` pod `FORM`
  ([A2](A2-loading-a-family-tree.md)).
- **Hranice:** soubor mimo strom jde upravit jen s běžícím výzkumem 1.35.0 a novějším („Titulek materiálu, který není
  ve stromu, umí novější verze výzkumu.“).
- **Ovládání:** prohlížeč souboru: tužka, **Přidat titulek** nebo F2 (Enter uloží, Esc zruší); dialog **Příloha**
  (**Titulek a údaje…**: titulek, druh, datum, poznámka).
- **Platí od:** aplikace 3.30.0; soubor mimo strom s výzkumem 1.35.0

<!-- zdroj: app:30b0accd src/ui/material-viewer-ui.ts, src/ui/material-details-ui.ts (titulek, druh, datum, F2) · app:6d8fba0e DataManager (titulek vedle názvu) · app:dfb50772 src/ged-exporter.ts TITL, _STROM_NAME, TYPE pod FORM · strings.ts materials.kind, titleHint, datePh, dateInvalid, olderEdit, attachmentDialog, titleAndData, addTitle · research:a7df632d POST /material/edit -->

<a id="A3.5.3"></a>
### A3.5.3 Kde je použit

Každý soubor ukazuje, kde je použit: osoby, portrét, svazek, události, prameny a výňatky, v tomto pořadí. Každý
řádek je odkaz na osobu nebo pramen.

- Doklad pramene řekne i to, kde je pramen citovaný („doklad · citace u Narození“).
- Nad pět míst se ukážou čtyři a „+ N další“.
- × u místa (**Odpojit:**) odebere soubor jen z tohoto místa, s oznámením a **Zpět**. Poslední místo souboru, který
  jinak nic nedrží, se nejdřív zeptá ([A3.5.6](#A3.5.6)).
- Vedle archivu jsou dvě části: **Ve stromu** a **V archivu**, s osobami přiřazenými v archivu a s tím, k čemu
  soubor výzkum použil (výňatky, prameny výzkumu, otevřené úkoly).
- Soubor, který je zdrojem pramene výzkumu, má nahoře **Zdroj pramene**: prameny, jak k nim soubor patří, kdo je
  cituje, a „Soubor je ve výzkumu; ve stromu je přes pramen.“ ([A3.5.14](#A3.5.14)).
- **Hranice:** strom jen ke čtení ukáže místa bez ×. Použití v archivu ukáže jen výzkum 1.35.0 a novější; když
  výzkum neběží, jsou podle stavu, který aplikace naposledy znala.
- **Ovládání:** prohlížeč souboru (panel, na telefonu vytažený list); dialog **Příloha**.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:4bf66048 src/ui/material-uses-ui.ts (prameny první, usesSourceOf, keptViaSource) · app:1ccc666c src/media-uses.ts (pořadí person, portrait, couple, event, source, excerpt) · src/ui/material-uses-ui.ts COLLAPSE_OVER=5, COLLAPSED_ROWS=4 · app:55d66efd sourceCitedAt · strings.ts materials.used, usedInTree, usedInArchive, usedType, docCitedAt, moreN, unlink, usesArchive, usesOlder, usesStale · research:a7df632d GET /material/<I…>/uses -->

<a id="A3.5.4"></a>
### A3.5.4 Připojit k…

**Připojit k…** dá soubor k osobám, k události, ke svazku nebo k prameni, jedním krokem **Zpět**.

- U prameni je soubor jeho doklad; u svazku příloha svazku. Fotka svazku se mění u svazku
  ([A12.4](A12-portrait-and-couple-photo.md#A12.4)).
- Materiál jen v archivu se připojí se svou zmenšenou kopií z výzkumu: pak je i ve stromu, v exportu, v knize a na
  telefonu.
- Stejný soubor přidaný podruhé: **Soubor už ve stromu je** nabídne **Připojit i sem**, **Vložit jako nový soubor**
  nebo zrušit. Vedle archivu se připojí bez ptaní.
- Smazání osoby nebo pramene řekne, které soubory zůstanou a které zmizí.
- **Hranice:** nejvýš 50 osob najednou. Materiál jen v archivu jde připojit, jen když výzkum běží. Osobu, kterou
  výzkum ještě nezná, výzkum dostane s dalším zápisem stromu.
- **Ovládání:** prohlížeč souboru (**Připojit k…** nebo P; šipky mění cíl, Enter připojí); výběr v okně
  **Materiály**.
- **Platí od:** aplikace 3.30.0
- **Od aplikace 3.31.0:** osoba, které už patří všechny zvolené soubory (místem ve stromu nebo přiřazením ve
  výzkumu), stojí nad seznamem jako čip se značkou „už připojeno“, bez ×, a v seznamu je zaškrtnutá a nejde změnit.
  Vedle ní se neukazuje „Zatím nikdo“.

<!-- zdroj: app:a275d977 src/ui/material-attach-ui.ts openAttachDialog, MAX_PEOPLE=50, materialKeptByArchive, dup dialog · strings.ts materials.attach, attachTarget, coupleNote, archiveOnlyResearch, dupTitle, dupAttach, dupNew, dupLinkedToast, assignMax, noRefnTreeResearch · 3.31.0: app:9eee6b2c src/ui/material-attach-ui.ts attachFixedPeople (místo ve stromu nebo REFN ve výzkumu, u všech souborů), src/person-picker.ts fixedChips · strings.ts materials.attachAlready, noneChosen · dirigent:prace/1122-app-portret-dev -->

<a id="A3.5.5"></a>
### A3.5.5 Pramen ze souboru a doklad pramene

Pramen může mít **doklad**: soubor, ze kterého je. Doklad je místo souboru u pramene; soubor se znovu nevkládá.

- **Vytvořit pramen z tohoto souboru…** otevře editor pramene vyplněný ze souboru: název z titulku, datum zápisu
  z data, soubor jako doklad a **Citovat u** s osobou, od které soubor je, a s událostí, jejíž rok sedí. Uložení
  je jeden krok **Zpět**: pramen, doklad i citace.
- Nový pramen u osoby nabídne **Doklad z materiálů osoby**: soubory osoby **Bez pramene** a **U jiného pramene**,
  nad 12 souborů s hledáním (**Hledat v titulku a názvu**).
- Prohlížeč pramene ukáže **Z čeho je**: doklady s × a **Připojit doklad…**. Výňatek odkazuje na soubor, ze kterého
  byl vyříznutý („Výňatek vyříznutý z … ›“).
- GEDCOM nese doklad jako `OBJE` u pramene; soubor na více místech je jeden záznam `OBJE`
  ([A2](A2-loading-a-family-tree.md)).
- **Hranice:** materiál jen v archivu se stane dokladem se svou zmenšenou kopií, jen když výzkum běží. Aplikace
  soubor nikdy neuloží dvakrát.
- **Ovládání:** prohlížeč souboru, ⋯ u přílohy, dialog **Příloha** a v **Připojit k…** u pramene **Nový pramen
  z tohoto souboru…**; editor pramene, pole **Doklad**.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:0c532b5a src/ui/source-docs-ui.ts (hlavička §5–§7: Vytvořit pramen, Doklad z materiálů osoby, Z čeho je), OFFER_SEARCH_OVER=12 · app:55d66efd · strings.ts sources.docLabel, docHint, attachDoc, citeAtLabel, offerTitle, offerNoSource, offerOther, offerSearch, viewerFrom, excerptFrom · materials.makeSource, newSourceFromFile · app:dfb50772 src/ged-exporter.ts objeOf (OBJE u SOUR, _SOUR u osoby), recordOf (soubor na více místech = záznam OBJE @M…@) -->

<a id="A3.5.6"></a>
### A3.5.6 Odstranit ze stromu a Vrátit

**Odstranit ze stromu…** odebere soubor ze všech míst ve stromu. Co se se souborem stane, záleží na tom, jestli
ho drží archiv.

- Dialog nejdřív řekne, co na soubor odkazuje: doklad pramene („Pramen zůstane bez dokladu.“), výňatek („Výňatek
  zůstane.“), portrét („Portrét zůstane, výřez už nepůjde upravit.“).
- **Bez archivu:** **Smazat soubor ze stromu?** soubor smaže. „Soubor jinde uložený není. Vrátí ho jen Zpět nebo
  záloha (Exportovat vše).“
- **S archivem** (soubor je ve výzkumu nebo v Archivu Stromu): soubor zůstane v archivu, skrytý s důvodem
  **Odstraněno ze stromu**; nepovinný důvod je **Netýká se rodiny** nebo **Duplikát**. Ve **Zobrazit skryté** ho
  **Vrátit** vrátí i s vazbami, na místa, která ve stromu pořád jsou.
- Víc souborů z výběru je jeden krok **Zpět**. **Odebrat osobu…** odebere zvolenou osobu od vybraných souborů;
  soubor bez jiného místa se předem ohlásí.
- Koš u přílohy osoby odebere soubor jen od této osoby, s oznámením a **Zpět**; poslední místo se ptá jako
  **Odstranit ze stromu…**.
- **Hranice:** soubor zůstane v archivu, jen když ho archiv má: od výzkumu 1.35.0 každý soubor stromu po zápisu,
  u staršího výzkumu jen poslaný originál. Archiv odebrání převezme se zápisem stromu
  ([R11.5.1](R11-material-from-the-user.md#R11.5.1)).
- **Ovládání:** prohlížeč souboru; výběr v okně **Materiály** → ⋯.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:a275d977, c2ae8441 src/ui/material-attach-ui.ts openRemoveFromTreeDialog (rmRefs, materialKeptByArchive = caps.list && item.file) · src/data.ts removeMedia (keep → removed + places), removeMediaMany, restoreMedia (jen místa, která ve stromu jsou) · app:13e4a70c src/ui/attachments-ui.ts removeAttachmentFromPerson · strings.ts materials.removeFromTree, rmRefDoc, rmKeepDoc, rmKeepExcerpt, rmKeepPortrait, rmArchiveResearch, rmAppTitle, rmApp, reason, restore, selRemovePerson, selRemovePersonLast · research:91ab6230, a7df632d -->

<a id="A3.5.7"></a>
### A3.5.7 Projít a hromadné úpravy

Okno **Materiály** projde mnoho souborů naráz: filtry ukážou, co chybí, a výběr upraví všechny vybrané soubory
najednou.

- Filtry s počty: **Bez titulku**, **Bez pramene**, vedle archivu **Ve stromu** a **Jen v archivu**.
- **Projít (N)** otevře prohlížeč s poli prvního souboru: Enter nebo → uloží a jde na další, ← zpět, **Přeskočit**,
  Esc skončí; P připojí, S vytvoří pramen. Na telefonu se soubory přepínají tažením.
- Výběr: **Projít**, **Připojit k…**, **Titulek…**, **Druh…**, **Datum…**; pod ⋯ **Odstranit ze stromu…**,
  **Odebrat osobu…** a vedle archivu **Přiřadit k osobě…** a **Skrýt…**.
- **Titulek…** umí **Přidat číslo podle pořadí v dávce**, s náhledem. **Druh…** a **Datum…** soubory, které hodnotu
  už mají, vynechají, pokud se nezaškrtne přepsání.
- **Hranice:** soubory stromu se změní jedním krokem **Zpět**. Soubory výzkumu po dávkách po 500, nad 500 s průběhem
  a zrušením; odmítnuté soubory oznámení vyjmenuje.
- **Ovládání:** okno **Materiály** → **Vybrat** nebo filtr.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:a1127378 src/ui/materials-window.ts (filtry, výběr, Projít), src/ui/material-bulk-ui.ts BULK_CHUNK=500 · app:13e4a70c (tažení na telefonu) · strings.ts materials.fNoTitle, fNoSource, fInTree, fOnlyArchive, review, setTitle, setKind, setDate, titleNumber, titleOverwrite, bulkProgress, bulkRejected, reviewSwipe -->

<a id="A3.5.8"></a>
### A3.5.8 Roztřídit agentem

**Roztřídit agentem…** pošle soubory výzkumu agentovi. Agent ke každému navrhne titulek, datum, druh a vazby
(osoby, událost, pramen) s krátkým důvodem. Nic se nezapíše, dokud se návrh nepřijme.

- Dialog ukáže soubory a pole **Co o souborech víme** (nepovinné, vlastní slova jako vodítko). Řekne, že co agent
  otevře, odchází k poskytovateli modelu a že třídění čerpá předplatné nebo kredit. Soubory pošle jen tlačítko
  **Roztřídit agentem** v dialogu, jednou.
- Okno jde zavřít; průběh a hotový návrh jsou v pruhu okna **Materiály**.
  - **Od aplikace 3.30.0:** pruh ukazuje „Čeká se na agenta…“, pak „Agent třídí · k z n“ s ukazatelem, kolik
    souborů agent už posoudil. Výzkum, který počet posouzených neříká, má „Agent třídí · N souborů“ s pruhem bez
    čísla; při omezení pohybu v systému ten pruh stojí. Pod tím „Okno jde zavřít, návrh počká v Materiálech.“
- **Návrh agenta** má **Návrhy**, **Nepřiřazeno** a **Vyřízeno** a u každého souboru **Přijmout**, **Upravit**,
  **Odmítnout**; dál **Přijmout vybrané** a **Přijmout vše**. Jistota návrhu: jistě, asi, nejisté.
  - **Od aplikace 3.30.0:** v **Nepřiřazeno** stojí u souboru bez návrhu tichým řádkem, proč návrh nemá: „Čtenář
    k souboru nic neřekl“, „Vše navržené už soubor má“, „Návrh nešel použít“, „Agent soubor vynechal“ nebo „Soubor
    se nepodařilo přečíst“. Co k souboru čtenář napsal, stojí pod tím na jednom řádku, celé při najetí. Výzkum,
    který důvod neříká, nebo důvod, který aplikace nezná: řádek bez důvodu jako dřív.
  - **Od aplikace 3.30.0:** soubor, o kterém agent řekne, že se rodiny netýká, stojí v **Nepřiřazeno** první, se
    značkou **Netýká se rodiny** ([A3.5.9](#A3.5.9)).
  - Textové soubory (.txt, .md) agent čte podle obsahu, ne jako obrázek ([R11.5.3](R11-material-from-the-user.md#R11.5.3)).
- Titulek, datum a druh od člověka zůstanou; návrh agenta se použije, jen když se zvolí **Použít návrh**.
- Přijaté se zapíše: soubory stromu jedním krokem **Zpět** se stromem, materiál mimo strom do archivu. Pramen
  výzkumu, který strom ještě nemá, přijde do stromu s číslem výzkumu a zápis ho nezdvojí. Přijatý návrh jde u
  řádku **Vrátit**.
- **Co se pošle:** z dávky a ze všech nezařazených jen soubory bez vlastního titulku nebo bez osoby, bez kopií,
  zdrojů pramene, souborů, které agent minule nezařadil, a textových a datových souborů; ručně vybrané soubory jdou
  všechny ([A3.5.11](#A3.5.11)).
- Pruh třídění je jeden nad celým archivem ([A3.5.10](#A3.5.10)); dávka se třídí z jejího ⋯.
- **Hranice:**
  - jen u výzkumu 1.35.0 a novějšího, který má agenta, a jen když výzkum běží; u Archivu Stromu a u výzkumu, který
    čeká na agenta, není nabídka vůbec;
  - nejvýš 30 dávek po 50 souborech jako jeden běh ([A3.5.12](#A3.5.12)), u výzkumu bez běhů 50 souborů; 2000 znaků
    textu;
  - výzkum může třídění odmítnout: vyčerpaný limit čtení, příliš mnoho čekajících třídění, agent teď pracovat
    nemůže. Jak třídí výzkum, popisuje [R11.5.3](R11-material-from-the-user.md#R11.5.3);
  - jen v aplikaci na počítači.
- **Ovládání:** okno **Materiály**: výběr, pruh třídění, ⋯ dávky; konec dávky z aplikace.
- **Platí od:** aplikace 3.30.0, výzkum 1.35.0

<!-- zdroj: app:9752aead (jeden pruh nad archivem, pruhy dávek a nabídka nad vším pryč, dávka z ⋯), 2fbab382 src/material-sort.ts sortNext, 1047b9d6 (běh do 1 500 souborů, bez material.sortRun jedna dávka) · app:1affd46e, d5b6ef8e src/ui/material-sort-ui.ts (odeslání jen klikem v dialogu), src/materials.ts SORT_MAX_FILES=50, SORT_MAX_TEXT=2000 · src/ui/materials-window.ts materialSortGate (sel-sort) · src/ui/batch-ui.ts doneSort · app:2a6dd268 pramen z výzkumu s REFN S… · strings.ts materials.agentSort.* (will, keep, privacy, cost, tooMany, errLimit, errQueue, errNotReady, offRun, phone, write, useProposal, undoRow) · research:87376d11 POST /material/sort, cc709045 material.sort jen s agentem · app:32f1e29f src/ui/material-sort-ui.ts (counted jen s job.filesDone: run k z n, progressbar aria-valuenow; jinak runFiles, is-indeterminate; runNote), strings.ts agentSort.queued, run, runFiles, runNote · app:30688d6b src/materials.ts parseSortUnproposed, material-sort-ui.ts (unassigned && !p → unproposed[why], said na jednom řádku s title), strings.ts agentSort.unproposed.* · research:ae866bb7 filesDone, unproposed, čtení textu · app:8a8131be src/material-sort.ts sortNeedy, sortWholeOffered (narrowed, remembered, jedna dávka se stejným počtem), materials-window.ts sortWholeClosed, strings.ts agentSort.stripWhole, closeWhole · app:a947b426 sortCandidates (dávka, filtr, celé okno: jen bez titulku nebo osoby; výběr vše) -->

<a id="A3.5.9"></a>
### A3.5.9 Netýká se rodiny

Když agent při třídění ([A3.5.8](#A3.5.8)) řekne, že se soubor rodiny zjevně netýká (snímek obrazovky, účtenka,
cizí fotka z dovolené, omylem poslaný soubor), má soubor v **Návrh agenta** v **Nepřiřazeno** značku **Netýká se
rodiny**. Skrýt ho může jen člověk; aplikace ani výzkum ho samy neskryjí ani nesmažou.

- Takový soubor nemá návrh titulku, data, druhu ani vazeb. Řádek ukáže jistotu (jistě, asi, nejisté: jak jisté je,
  že soubor rodině nepatří) a „Proč ne: …“ s tím, co agent na souboru viděl.
- Agent tak označí jen soubor zjevně mimo rodinu; soubor, který jen neumí zařadit, zůstane v **Nepřiřazeno** bez
  značky ([R11.5.3](R11-material-from-the-user.md#R11.5.3)).
- Tyto soubory stojí v **Nepřiřazeno** první. Nad nimi je **Skrýt jako Netýká se rodiny (N)**, u každého **Skrýt…**.
  Obojí otevře dialog **Skrýt soubor?** s předvybraným důvodem **Netýká se rodiny** (jde změnit na **Duplikát** nebo
  **Bez důvodu**); soubor skryje až tlačítko **Skrýt**. Oznámení má **Zpět**. Po dialogu, i zrušeném, se návrh
  agenta vrátí na **Nepřiřazeno**.
- Skrytý soubor má na řádku „Skryto · netýká se rodiny“ a **Vrátit**. Zůstane ve výzkumu i s originálem a je vidět
  v **Zobrazit skryté** ([A3.5.1](#A3.5.1)). **Projít ručně (N)** skryté soubory vynechá.
- **Hranice:**
  - skrýt jde jen soubor výzkumu mimo strom, který ještě skrytý není. Soubor ve stromu má značku bez **Skrýt…**;
    ze stromu ho odebere **Odstranit ze stromu…** ([A3.5.6](#A3.5.6));
  - **Skrýt…** a **Vrátit** fungují jen s běžícím výzkumem; jinak jsou vypnuté;
  - výzkum, který značku neposílá, nechá **Nepřiřazeno** jako dřív.
- **Ovládání:** okno **Materiály** → pruh návrhu → **Návrh agenta** → **Nepřiřazeno**; terminál: `strom material
  show <id>`, skrytí `strom input hide I… --why unrelated` ([R11.5.2](R11-material-from-the-user.md#R11.5.2)).
- **Platí od:** aplikace 3.30.0, výzkum 1.35.0

<!-- zdroj: app:f2bebc4c (v 401eaca4) src/materials.ts SortProposal.unrelated, parseSortProposal · src/material-sort.ts sortRows (unrelated: bez polí a vazeb), sortUnrelatedHideable (origin ≠ tree, file, !hidden, bez places) · src/ui/material-sort-ui.ts (Nepřiřazeno: unrelated první, msp-flag reason.unrelated, conf, unassignedWhy + why; hideUnrelated, hide, restore, hiddenLabel; hideCan: caps.assign, jinak null; bridgeUp && base, jinak vypnuto; reopen na tab unassigned; Projít ručně bez skrytých) · src/ui/material-actions-ui.ts openHideDialog (důvod unrelated předvybraný, ctx.back) · strings.ts materials.agentSort.hideUnrelated, unassignedWhy, reviewByHand, materials.hide, hideTitle, reasonLabel, reason, hideConfirm, hiddenLabel, hiddenToastResearch, restore · research:f36b3941 (ve vydání 1.35.0) src/core/sort.ts unrelated -->

<a id="A3.5.10"></a>
### A3.5.10 Pruh třídění a konec návrhu

Okno **Materiály** má jeden pruh třídění nad celým archivem. Ukazuje stav všech souborů výzkumu, i když filtr
ukazuje jen část; pod dávkami pruhy nejsou.

- **Stavy pruhu:**
  - nezařazené soubory: „N souborů bez titulku nebo osoby“ s **Roztřídit agentem…**, **Projít ručně** a ×;
  - agent třídí: průběh ([A3.5.8](#A3.5.8), [A3.5.12](#A3.5.12)) se **Zrušit**; když už návrhy čekají, i
    **Vyřídit návrh (N)**;
  - návrh čeká: „Návrh agenta: N k vyřízení“ s **Vyřídit návrh (N)** a **Zavřít návrh…**;
  - po návrhu: „Hotovo: vyřízeno a · nepřiřazeno u · zbývá N nezařazených“ s **Roztřídit další (N)…**, **Projít
    ručně** (soubory, které agent nezařadil) a ×;
  - nic nezbývá: „Všechny soubory mají titulek a osobu.“
- × pruh skryje, dokud se jeho stav nezmění. Dávka přidaná při otevřeném okně se v pruhu ohlásí „Přidáno N souborů
  · M bez titulku nebo osoby“ ([A3.5.15](#A3.5.15)).
- **Konec návrhu:** když je vše vyřízené, okno **Návrh agenta** řekne „Hotovo · přijato a · odmítnuto r ·
  nepřiřazeno u“ (u běhu i „Za celý běh: …“) a pod tím:
  - „V archivu zbývá N nezařazených souborů“ s **Roztřídit další (N)…**: návrh se uzavře a otevře se dialog
    **Roztřídit agentem**; jinak „V archivu už nic dalšího k roztřídění není.“;
  - kopie se stejným obsahem, které se neposlaly, se **Skrýt jako Duplikát (N)…**;
  - „N souborů agent nezařadil“: zůstávají bez titulku a osoby, mají štítek **Agent nezařadil** a příště se
    agentovi neposílají ([A3.5.14](#A3.5.14)).
- Návrh, ve kterém nic nečeká, se uzavře zavřením okna. **Zavřít návrh…** se zeptá **Zavřít návrh?**: nevyřízené
  návrhy se nezapíšou a soubory zůstanou nezařazené; přijaté zůstávají přijaté.
- **Hranice:**
  - na telefonu pruh ukáže jen stav; návrh je v aplikaci na počítači. Strom jen ke čtení: jen stav a „Strom je jen
    ke čtení.“;
  - když výzkum neběží, je pruh vypnutý a řekne proč;
  - výzkum bez běhů po dávkách nabídne **Roztřídit dalších 50…** s „Agent vezme naráz nejvýš 50 souborů. Po dávkách
    třídí novější verze výzkumu.“
- **Ovládání:** okno **Materiály** → pruh třídění; ⋯ dávky → **Roztřídit agentem…**; okno **Návrh agenta**.
- **Platí od:** aplikace 3.30.0, výzkum 1.35.0

<!-- zdroj: app:9752aead src/material-sort.ts sortStripState (A–F nad celým archivem i s filtrem; × jen v A a E), src/ui/material-sort-ui.ts materialSortStripView, konec návrhu (endTitle, endRun, restLine, restNote, leftLine, leftNote, nothingLeft, endFoot, closeAsk, closeText), materialSortCloseAsk · src/ui/materials-window.ts mwSortWholeClose (sortClosedState do změny stavu), ⋯ dávky (sort) · app:17585b94 materialsBatchAdded (stripAdded) · app:0b0c9d4f (telefon, strom jen ke čtení, výzkum neběží, starší výzkum bez běhů: olderNext, olderRun) · strings.ts materials.agentSort.stripWhole, reviewHand, handle, pending, doneLine, sortNextN, allSorted, closeProposal, readOnlyNote, phoneShort, hideCopies, copiesLine -->

<a id="A3.5.11"></a>
### A3.5.11 Co roztřídit: dávky a co se nepošle

Dialog **Roztřídit agentem** nejdřív řekne, co se pošle, v kolika dávkách a co se nepošle. Soubory jdou v dávkách
po nejvýš 50.

- **Co roztřídit:** dlaždice s počty. Nahoře to, odkud dialog přišel (**Jen vybrané** nebo **Jen dávka „…“**), pak
  vždy **Všechny nezařazené**; nad 10 dávek i **Jen prvních 50** („1 dávka; zbytek pak „Roztřídit další““).
- **Pořadí:** nejdřív obrázky a PDF, pak ostatní soubory, textové a datové soubory poslední; uvnitř podle dávky
  a složky, soubory jedné složky pohromadě.
- **Co se nepošle** (z dávky a ze všech nezařazených): kopie se stejným obsahem jako starší soubor (jde jen
  starší), soubor, který je zdrojem pramene, soubory, které agent minule nezařadil, a textové a datové soubory
  (.md, .txt, .json, .csv). Dialog to řekne jednou větou s **Podrobnosti**: u kopií **Skrýt jako Duplikát (N)…**,
  u nezařazených **Ukázat v Materiálech**, u textových zaškrtnutí **Poslat i textové a datové soubory (N)**.
- **Jen vybrané** pošle všechny vybrané soubory kromě skrytých; kopie a zdroje pramene dialog vyjmenuje počtem
  a pošle je taky.
- Dialog řekne „Pošle se N souborů v M dávkách po nejvýš 50. …“ a tlačítko je **Roztřídit agentem · M dávek**.
  Nad 10 dávek řekne důrazně, že každá dávka čerpá předplatné nebo kredit a že při vyčerpaném limitu se běh zastaví;
  na vyzkoušení stačí **Jen prvních 50**.
- **Hranice:**
  - nejvýš 30 dávek (1 500 souborů) jako jeden běh ([A3.5.12](#A3.5.12)); co je nad to, pošle až **Roztřídit
    další**;
  - výzkum bez běhů po dávkách vezme jednu dávku (50 souborů);
  - zdroj pramene pozná aplikace jen podle výzkumu. Kopie a soubory, které agent nezařadil, říká výzkum; když to
    neumí, pozná kopie podle obsahu souborů, které zná, a nezařazené podle návrhů, které si pamatuje.
- **Ovládání:** okno **Materiály**: pruh třídění, výběr, ⋯ dávky → dialog **Roztřídit agentem**.
- **Platí od:** aplikace 3.30.0, výzkum 1.35.0

<!-- zdroj: app:1047b9d6 src/ui/material-sort-ui.ts openSortDialog (base: selection | batch | all, 'first' nad SORT_MANY_BATCHES=10, plan, planOne, costBig, overRun, goRun, selWarn, drawLeft s details), src/material-sort.ts SORT_MAX_BATCHES=30, sortRunBatches · app:2fbab382 src/material-sort.ts sortNext (obrázky a PDF první, text poslední jen s withText, dávka a složka, výběr vše bez skrytých; kopie, zdroje, left jen mimo výběr), sortIsText, sortCopyOf (material.sameAs, jinak otisk), sortLeftMap (material.left, jinak paměť aplikace) · strings.ts materials.agentSort.scopeLegend, scopeAll, scopeSel, scopeBatch, scopeFirst, scopeFirstSub, leftCopies, leftText, leftSources, leftLeft, showLeft, details, withText, withTextHint -->

<a id="A3.5.12"></a>
### A3.5.12 Běh po dávkách

Víc než jedna dávka jde jako jeden běh: výzkum třídí dávky jednu za druhou a návrh každé hotové dávky jde vyřídit
hned.

- Pruh a ukazatel jsou jeden pro celý běh: „Agent třídí · dávka b z M · k z n“, na začátku dávky „… začíná“.
  Okno **Návrh agenta** ukáže „Dávka b z M běží · přibudou další návrhy“; nové návrhy přibudou na konec seznamu
  s oznámením a **Ukázat**.
- Běh jde dál i po zavření okna a po novém načtení aplikace. Oznámení o konci přijde jednou, na konci běhu.
- **Zrušit** běh zastaví hned: dávka v práci skončí, čekající se nespustí. Když už jsou hotové návrhy, zeptá se
  **Zahodit hotové návrhy?** a řekne, které dávky se nespustí a kolik souborů zůstane nezařazených; **Ponechat** je
  nechá k vyřízení.
- **Dávka, která neproběhla:** po konci běhu pruh v barvě chyby „Dávka b z M neproběhla:“ s důvodem, co zůstává
  nezařazené, **Vyřídit návrh (N)**, **Zkusit znovu…** a **Zavřít**. Další dávky mezitím běží dál.
- **Běh zastavený jinde:** „Třídění se zastavilo po dávce b z M.“ s **Pokračovat (N dávek)…**. **Zkusit znovu…**
  i **Pokračovat** otevřou dialog s **Co zbylo z běhu**; nové dávky přibudou do návrhu, který je otevřený.
- **Dávka čeká**, když čtení, o která smí aplikace požádat, jsou vyčerpaná: „Dávka b z M čeká“ a „Spustí se sama
  asi za N min.“ (nebo h).
- **Hranice:** nejvýš 30 dávek po 50 souborech; jen výzkum, který umí běh po dávkách
  ([R11.5.5](R11-material-from-the-user.md#R11.5.5)). Každá dávka čerpá předplatné nebo kredit a počítá se do čtení
  aplikace.
- **Ovládání:** dialog **Roztřídit agentem**; pruh okna **Materiály**; okno **Návrh agenta**.
- **Platí od:** aplikace 3.30.0, výzkum 1.35.0

<!-- zdroj: app:acc877d6 src/ui/material-sort-ui.ts (běh výzkumu čtený do konce, jeden pruh a ukazatel, runBatch, runBatchFiles, runStarting, runInWindow, moreArrived, show; po novém načtení sledovaný znovu; toast jednou na konci) · app:687dd41b materialSortCancel (cancelMaterialSortRun, discardAsk, discardRun, discardKeep), batchFailed, runErrorText (errLimit, batchErr), leftAfterError, retry, stopped, stoppedNote, resume, scopeRest, runWaiting, runWaitText (waitApp, waitRetry) · app:0b0c9d4f (bez toastu při otevřeném okně návrhu) · research:0cc2cfca src/core/sort.ts SORT_RUN_MOST_FILES=1500 -->

<a id="A3.5.13"></a>
### A3.5.13 Rub a portrét v návrhu

Agent může v návrhu říct, který z poslaných souborů je rubem jiné fotky nebo strany a který obrázek je portrétem
osoby. Návrh to ukáže jako čip u souboru.

- **Rub:** u přední strany čip „Rub:“ s náhledem a názvem zadní strany. Přijetí zapíše rub spolu s přední stranou:
  rub dostane její datum, druh a vazby a titulek „… (rub)“. Řádek ukáže oba názvy („… + … (rub)“) a „2 strany“.
- **Portrét:** čip „Portrét:“ s osobou. Po přijetí dostane soubor místo u osoby a otevře se editor portrétu
  ([A12](A12-portrait-and-couple-photo.md)).
- × čip z návrhu odebere; zbytek návrhu zůstane.
- **Hranice:**
  - rub jde jen mezi soubory, které dostal tentýž čtenář výzkumu: jeden rub k jedné přední straně, nikdy rub rubu
    ani textový soubor ([R11.5.3](R11-material-from-the-user.md#R11.5.3));
  - portrét se nabídne jen u obrázku a jen u osoby, která portrét nemá a jde upravit.
- **Ovládání:** okno **Návrh agenta** → **Návrhy**.
- **Platí od:** aplikace 3.30.0, výzkum 1.35.0

<!-- zdroj: app:2fbab382 src/ui/material-sort-ui.ts withPortraits (obrázek, osoba bez photo, canEditPortrait), čipy own() s × (dropped), rubFiles, twoSides, accept (sortBackRow s rubSuffix, portrét: místo personId) · strings.ts materials.agentSort.rubChip, portraitChip, rubSuffix, rubFiles, twoSides · research:0cc2cfca src/core/sort.ts SORT_LINK_TYPES back, portrait -->

<a id="A3.5.14"></a>
### A3.5.14 Agent nezařadil, Stejný obsah a Zdroj pramene

Dlaždice a řádky okna **Materiály** nesou před osobami štítek, který říká, proč soubor zůstal nezařazený, nebo že
je zařazený přes pramen.

- **Agent nezařadil:** soubor, ke kterému agent při třídění nic nenavrhl. Prohlížeč souboru u něj ukáže „Proč ne“
  s důvodem. Filtr **Agent nezařadil** (s počtem) stojí za ostatními filtry. Příští třídění takové soubory
  nepošle, pokud se nevyberou ručně.
- **Stejný obsah:** soubor se stejným obsahem jako starší soubor; třídění pošle jen ten starší.
- **Zdroj pramene** (u více pramenů „Zdroj N pramenů“): soubor, ze kterého výzkum udělal pramen. Štítek stojí před
  osobami, které pramen citují, a **Ve stromu** se řídí tím, jestli je pramen ve stromu. V **Seznam** ukáže
  sloupec **Pramen** štítek s titulkem prvního pramene. Takový soubor je zařazený: nepočítá se do **Bez osoby** ani
  **Bez pramene** a štítek **Agent nezařadil** nemá. **Kde je použit** u něj ukáže prameny první
  ([A3.5.3](#A3.5.3)).
- **Hranice:** **Agent nezařadil** a **Stejný obsah** nese jen soubor bez titulku nebo bez osoby, který není skrytý.
  **Zdroj pramene** jen s výzkumem, který zdroje pramenů hlásí ([R11.5.4](R11-material-from-the-user.md#R11.5.4));
  bez něj se soubory ukazují jako dřív.
- **Ovládání:** okno **Materiály** (dlaždice, **Seznam**, **Filtry**); prohlížeč souboru.
- **Platí od:** aplikace 3.30.0, výzkum 1.35.0

<!-- zdroj: app:2fbab382 src/ui/materials-window.ts (agentLeft, copyOf jen u souboru bez titulku nebo osoby, ne skrytý ani zdroj pramene), mwSortTagHtml, filtr left (fLeft), src/ui/material-viewer-ui.ts (unassignedWhy + said nebo unproposed[why]) · app:4bf66048 src/materials-overview.ts, src/ui/materials-window.ts mwSourceOfTag, src/ui/material-uses-ui.ts (zdroj pramene: přiřazený, bez Bez osoby a Bez pramene) · strings.ts materials.agentSort.fLeft, tagLeft, tagCopy, tagSourceOf, sourceOfN, usesSourceOf, viaInput, viaMedia, viaExcerpt, citedBy, keptViaSource · research:0cc2cfca src/core/live.ts GET /material (uses.of, left, sameAs) -->

<a id="A3.5.15"></a>
### A3.5.15 Přidat materiály… v okně

**Přidat materiály…** v záhlaví okna **Materiály** otevře nad oknem průvodce **Přidat materiály do výzkumu**
([R11.4](R11-material-from-the-user.md#R11.4)).

- Soubory a složky přetažené na okno ukážou „Pustit sem: přidat do materiálů“ a otevřou průvodce s nimi. Nic se
  nepošle bez potvrzení v průvodci.
- Dávka přidaná při otevřeném okně se ohlásí v pruhu třídění ([A3.5.10](#A3.5.10)) a seznam se načte znovu.
- **Hranice:** jen u výzkumu, který přijímá dávky, a u stromu, který jde měnit; strom bez výzkumu tlačítko nemá. Na
  telefonu nejde přetahovat; **Přidat materiály…** a **Kde soubory jsou** jsou tam v ⋯ záhlaví.
- **Ovládání:** okno **Materiály** → **Přidat materiály…**; přetažení souborů nebo složek na okno.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:17585b94 src/ui/materials-window.ts mwAddMaterials (showBatchDialog), mwWireDrop (ne na telefonu), mwFillHeadMenu (telefon: add, where), materialsBatchAdded · src/ui/materials-ui.ts materialsAddOffered (windowAddOffered: model archive, batchAvailable, ne jen ke čtení) · strings.ts materials.addMaterials, dropTitleMaterials, dropSubMaterials, agentSort.stripAdded -->

<a id="A3.5.16"></a>
### A3.5.16 Smazat natrvalo

**Smazat natrvalo…** smaže soubory výzkumu z archivu i ze stromu. Jde to jen přes dialog, který nejdřív řekne, co
na soubory odkazuje; v aplikaci to nejde vrátit.

- Dialog **Smazat natrvalo N souborů?** ukáže náhled (u více souborů prvních pět a „a N dalších“), **Co na soubory
  odkazuje** podle výzkumu (řádky **Pramen**, **Výřezy**, **Strom**, **Osoby**, **Úkoly**), že se soubory smažou
  z archivu výzkumu i ze stromu, a zaškrtnutí **Rozumím, smazání nejde v aplikaci vrátit**.
- Tlačítko **Smazat natrvalo** funguje, jen když výzkum výčet potvrdil a pole je zaškrtnuté; fokus má **Zrušit**.
  Soubory mimo strom, které ještě nejsou skryté, nabídnou i **Jen skrýt – jde vrátit**.
- **Co se stane:** pramen zůstane, jen bez zdroje; pramen se stejným obsahem přijde o obrázek, text a citace
  zůstanou; výřezy z těchto souborů se smažou; místa ve stromu odebere další verze stromu z výzkumu; soubor zmizí
  z materiálů osob; úkol bez dalších souborů se vzdá. Obsah, který má i jiný soubor nebo jiný výzkum na tomto
  počítači, zůstane uložený a smaže se jen záznam.
- Když se výčet mezitím změnil, nebo potvrzení vypršelo (platí 15 minut), dialog ukáže nový výčet, zaškrtnutí
  zruší a smazání je třeba potvrdit znovu.
- Po smazání oznámení „Smazáno natrvalo: N souborů.“ bez **Zpět**. Soubory zmizí z okna i z návrhu agenta.
  Zůstanou jen v dřívějších zálohách výzkumu (u Archivu Stromu archivu). Agent ani strom nemažou nikdy sami.
- **Hranice:**
  - jen soubory archivu výzkumu nebo Archivu Stromu; soubor, který je jen ve stromu, odebere **Odstranit ze
    stromu…** ([A3.5.6](#A3.5.6));
  - nejvýš 500 souborů najednou („Najednou jde smazat nejvýš 500 souborů.“);
  - jen s výzkumem, který mazání umí, a s běžícím mostem; nikdy ve stromu jen ke čtení;
  - na úzké obrazovce je dialog list zespodu;
  - soubor rodokmenu a soubor, ze kterého vznikl platný pramen, popisuje [A3.5.17](#A3.5.17).
- **Ovládání:** okno **Materiály** → výběr → ⋯ → **Smazat natrvalo…** (poslední položka); prohlížeč souboru
  (poslední akce). Terminál: `strom input delete` ([R11.5.6](R11-material-from-the-user.md#R11.5.6)).
- **Platí od:** aplikace 3.30.0, výzkum 1.35.0

<!-- zdroj: app:05e13ef7 src/ui/material-delete-ui.ts openDeleteDialog (suchý běh, potvrzení mostu, zaškrtnutí, Zrušit s fokusem, hideInstead, changed, expired, toast bez Zpět, list zespodu), src/material-delete.ts deletableFiles (origin ≠ tree, file), src/materials.ts DELETE_MAX_FILES=500, MATERIAL_DELETE_FEATURE · src/ui/materials-window.ts sel-delete (caps.delete, ne jen ke čtení, bridgeUp), src/ui/material-viewer-ui.ts (inArchive, poslední akce) · app:6949d833, f214eda6 (množné číslo, understandHint) · strings.ts materials.del.* · research:0cc2cfca src/core/materialdelete.ts DELETE_MOST_FILES, DELETE_CONFIRM_MS -->

<a id="A3.5.17"></a>
### A3.5.17 Soubor rodokmenu v Materiálech

Okno **Materiály** ukazuje i soubory rodokmenu, které výzkum má: importovaný GEDCOM nebo soubor JSON aplikace.
Jde je prohlédnout a smazat natrvalo; když z nich vznikl pramen, jen spolu s ním.

- Dlaždice a řádek **Seznam** ukáže druh a velikost („Soubor rodokmenu · 184 kB“) a štítek **Zdroj pramene**,
  když z něj pramen vznikl ([A3.5.14](#A3.5.14)). Soubor rodokmenu není nikdy **Ve stromu**: nemá ten štítek
  a filtr **Ve stromu** ho nepočítá, ani když pramen z něj ve stromu je. Filtr **Druh** má řádek **Soubory
  rodokmenu**, jen když nějaký je.
- Soubory rodokmenu jsou mimo třídění agentem, hromadné akce, **Bez osoby** a počty **Projít**. Titulek, druh,
  datum ani osoby se u nich nemění.
- Nabídka souboru (na úzké obrazovce list zespodu) má jen **Podrobnosti** a **Smazat natrvalo…**. **Podrobnosti**
  jsou bez náhledu a jmenují pramen, který ze souboru vznikl („zdrojem pramene …“).
- **Smazat natrvalo…** u souboru, ze kterého pramen nevznikl: dialog jako [A3.5.16](#A3.5.16), s větou „Soubor
  rodokmenu se smaže z archivu výzkumu. V aplikaci to nejde vrátit.“ a „Na soubor nic neodkazuje: nevznikl z něj
  pramen.“, bez **Jen skrýt – jde vrátit**.
- **Smazat natrvalo…** u souboru, ze kterého vznikl pramen, který stále platí: dvoudílný dialog **Smazat pramen
  i soubor?** („Ze souboru vznikl pramen …. Soubor se smaže až po pramenu, obojí najednou.“):
  - **Nejdřív se smaže pramen**: co na pramenu stojí, jako v dialogu **Smazat pramen?**
    ([A3.1.2](#A3.1.2));
  - **Pak se smaže soubor**: co na soubor odkazuje; pramen „smaže se v prvním kroku“;
  - „Pramen jde později obnovit ve výzkumu, ale už bez souboru.“, jedno zaškrtnutí **Rozumím, soubor nejde
    v aplikaci vrátit** a tlačítko **Smazat pramen i soubor**.

  Obojí se zapíše najednou, jedním zápisem ve výzkumu. Oznámení „Smazán pramen … i soubor ….“ nemá **Zpět**
  a pramen pak ze stromu zmizí.
- **Hlídá kód:** když se výčet mezitím změnil, dialog ukáže nový, zaškrtnutí zruší a smazání je třeba potvrdit
  znovu. Nepovedený zápis nesmaže nic („Zápis ve výzkumu se nepovedl. Nic se nesmazalo.“) a dovolí to zkusit znovu.
- **Hranice:** jen s výzkumem, který soubory rodokmenu v materiálu hlásí; bez něj je okno neukazuje. Mazání jako
  v [A3.5.16](#A3.5.16): jen s běžícím mostem a nikdy ve stromu jen ke čtení.
- **Ovládání:** okno **Materiály** → soubor rodokmenu → ⋯ → **Podrobnosti** / **Smazat natrvalo…**; filtr **Druh →
  Soubory rodokmenu**. Terminál: `strom input delete I… --retract-sources S…`
  ([R11.5.6](R11-material-from-the-user.md#R11.5.6)).
- **Platí od:** aplikace 3.31.0 s výzkumem 1.36.0

<!-- zdroj: app:36601947 src/materials-overview.ts (druh tree za bránou material.trees, trees=1; mimo třídění, hromadné akce, bez osoby, počty Projít; podrobnosti nejdou upravit), src/material-delete.ts treeFileSource, retractSources, blockedBy (409 material.source-live) · 2a406d67 dlaždice a řádek (Soubor rodokmenu · velikost, štítek zdroje), filtr Druh, nabídka Podrobnosti + Smazat natrvalo… (list zespodu), Podrobnosti bez náhledu, dialog bez pramene bez Jen skrýt · b40b22e4 dvoudílný dialog · d9af4b16 (ne Ve stromu, ani štítek, ani filtr) · e2e/material-tree-delete.spec.ts (hlavička) · strings.ts materials.treeFile, kindTrees, treeFileOf, treeDetails, del.textTree, noRefsTree, bothTitle, bothIntro, partSource, partFile, laterNoFile, fileSourceSub, understandFile, bothGo, bothChanged, bothNone, bothToast · SPEC.md 1120-app-117-smazani, 1120-app-108-diry · spec 117 §5–§7 -->

<a id="A3.6"></a>
## A3.6 Prameny osoby

Menu osoby **Prameny** ukáže všechny prameny osoby na jednom místě, bez otevření úpravy: citované k osobě,
k narození a úmrtí, k událostem, ke sňatkům a ke společným událostem párů.

- Jeden řádek na pramen, pod ním co dokládá: „Osoba“, „Narození 1865“, „Sňatek 1890“… Řádek ukazuje i spolehlivost.
  Od aplikace 3.27.0 je to spolehlivost citací: když se citace pramene ve spolehlivosti shodnou, je u řádku jednou;
  když se liší, stojí za každým údajem jeho vlastní („Narození 1865 Opis / index · Povolání Originál“).
- Pořadí: podle nejstaršího roku toho, co pramen dokládá, jinak podle **Datum zápisu**; bez data na konci, pak
  podle názvu.
- **Citovat pramen** otevře výběr s **Dokládá** ([A3.2](#A3.2)).
- **Najít pramen ve výzkumu**: jen u osoby bez pramene, kterou výzkum zná, a jen u výzkumu s agentem. Otevře
  terminál výzkumu s revizí osoby.
- **Hranice:** u stromu jen pro čtení nebo uzamčeného je položka v menu, jen když osoba nějaký pramen má. Počet
  pramenů je u položky menu.
- **Ovládání:** menu osoby (klik na kartu) → **Prameny**.
- **Od aplikace 3.22.0:** prameny vyprávění jsou u vyprávění samotného. Pod textem vyprávění je jeden sbalený oddíl
  **Z čeho text vychází (N)**, kde N je počet pramenů:
  - **Prameny**: každý pramen jednou. Nejdřív prameny, na které ukazuje vyprávění samo, pak prameny, které citují
    jeho údaje. Pramen s webovou adresou je odkaz, který se otevře v novém okně;
  - **Fakta**: údaje, ze kterých text vychází, čitelně („Úmrtí 25. 9. 1857, Lhota“), bez kódů výzkumu;
  - **Poznámka autora**, když ji vyprávění má.
- Oddíl je v okně **Vyprávění**, na stránce osoby, ve srovnání verzí vyprávění a (jen pro čtení) v úpravě osoby.
  Kód pramene v textu (`[S0164]`) se ukáže jako název pramene v závorce, když ho strom má. Stránka osoby uvede
  pramen vyprávění i ve svých pramenech, s **Vyprávění** nebo **Vyprávění manželství** jako tím, co dokládá. Menu
  **Prameny** prameny vyprávění neuvádí.
- **Hranice:** v tisku a v knize rodu pod textem nic není; prameny vyprávění jsou v knize očíslované v seznamu
  pramenů. Jak výzkum prameny vyprávění drží: [R3.9](R3-verification-and-citation.md#R3.9).
- **Platí od:** aplikace 3.3.0; **Najít pramen ve výzkumu** 3.19.0; **Z čeho text vychází** 3.22.0

<!-- zdroj: app:src/person-sources.ts:54 personSourceRows · src/ui/person-sources-ui.ts:114 canCiteOnPerson, :120 showPersonSourcesDialog, :187 find hidden · src/ui/context-menu.ts:191-203 readItems · src/ui/research-actions-ui.ts:1173 personFindSourceUrl · strings.ts personSources.*, research.findSource · src/story-sources.ts storyBasisSourceIds, storyFactText, storyBasisDetailsHtml · src/ui/person-page.ts:1738 storyBasisHtml · strings.ts storyBasis, basisSources, basisFacts, authorNote · CHANGELOG.cs.md 3.22.0 · 3.27.0: app:dde0151a src/person-sources.ts rowQuality, PersonSourceCite.quality, src/ui/person-sources-ui.ts source-quality-tag · app:66fc3f7f (údaj a štítek se nezalomí) -->

<a id="A3.7"></a>
## A3.7 Kde chybí doklady

**Přehled stromu → Kvalita dat → Kde chybí doklady** vypíše skupiny lidí, kterým chybí pramen nebo rodiče. Tlačítko
**Ukázat ve stromu** je zvýrazní ve stromu a provede jimi jedním po druhém. Skupina bez nikoho se nevypíše.

- **Osoby bez pramene**: v celém stromu („n z celkem“).
- **Narození bez pramene**: předci zvolené osoby („n z N předků“). U stromu s výzkumem místo toho
  **Narození neověřená výzkumem**: narození předků, která nejsou Doložená.
- **Konce linií**: lidé bez rodičů, kteří jsou předky zvolené osoby, nebo mají děti a nepřiženili se.
- Když nic nechybí: „Všichni mají pramen i rodiče.“
- Pod skupinami je vždy tlačítko **Doložení ve stromu**. Zapne režim **Doložení**: každá kartička dostane rámeček
  podle úrovně doložení osoby ([R3.8.1](R3-verification-and-citation.md#R3.8.1)), plný u Doloženo, čárkovaný
  u Částečně doloženo a tečkovaný u Nedoloženo. Lišta nahoře ukazuje počty všech tří úrovní; počet zvýrazní jen
  tu skupinu a s ní **Další osoba ›**. Jedna značka na kartičce je jiná věc ([S7.2](S7-reliability-and-verification.md#S7.2)).
- Při zvýraznění: **Další osoba ›**, **Citovat** (u skupin bez pramene) a × **Ukončit zvýraznění**. Pořadí je podle
  generace, pak podle jména. Na konci: „Hotovo, v tomto výběru už nikdo nezbývá.“
- **Hranice:** u narození, které výzkum hodnotí, je místo **Citovat** tlačítko **Prameny**. Další citace údaj
  nedoloží; rozhoduje výzkum. **Citovat** chybí u stromu jen pro čtení a u zamčené osoby. Kontrolu stromu jako
  celek popisuje [A5](A5-tree-check.md).
- **Ovládání:** **Přehled stromu → Kvalita dat → Kde chybí doklady → Ukázat ve stromu** (z jiného stromu
  **Otevřít strom a ukázat**).
- **Platí od:** aplikace 3.4.0; **Narození neověřená výzkumem** a **Prameny** místo **Citovat** 3.13.1

<!-- zdroj: app:src/stats.ts:185-240 computeEvidenceGaps · src/ui/evidence-ui.ts:81 walkOrder, :325-358 pill · src/tree-overview.ts:215 birthResearchStatus · src/ui/tree-overview.ts:1946-1975 · strings.ts treeOverview.evidenceTitle/evNoSource/evBirthNoSource/evBirthUnproven/evLineEnds/evOfTotal/evOfAncestors/evAllGood/evLevels, treeHealth.citeAction/sourcesAction/next/highlightDone/highlightEnd · app:7eb903a3 src/ui/tree-overview.ts:1974 tov-ev-levels, :2293 showEvidenceLevelsFromOverview · src/ui/evidence-ui.ts showEvidenceLevels, renderEvidencePill, toggleEvidenceLevelGroup · index.html .person-card.evl-full/partial/none (solid, dashed, dotted) · strings.ts treeHealth.evidenceMode -->

<a id="A3.8"></a>
## A3.8 Obraz jen ve výzkumu

Obraz jen ve výzkumu je sken nebo výřez pramene, který je uložený ve výzkumu na počítači a aplikace ho zatím nemá.
Pramen v aplikaci je i bez něj; obraz se ukáže po načtení z výzkumu, který na tomto počítači běží.

- **Proč obraz v aplikaci není:** u pramene stojí důvod: „Obraz je ve výzkumu, do aplikace nešel (nastavení
  výzkumu).“, „… (limit velikosti).“, nebo „Obraz se ve výzkumu připravuje, přijde s další verzí.“ Výzkum do souboru
  pro aplikaci dává obrazy podle svého nastavení a limitu velikosti.
- **Kde je vidět:** v **Prameny** filtr **Obraz jen ve výzkumu · N** se štítkem *obraz jen ve výzkumu* u pramene
  a řádkem pod filtrem („N obrazů u M pramenů je uložených jen ve výzkumu na tomto počítači, v aplikaci se ukážou po
  načtení.“); v nabídce **Výzkum** řádek **Obrazy jen ve výzkumu · N**, který otevře **Prameny** s filtrem a ukazuje
  průběh načítání.
- **Načíst:**
  - **Načíst obraz z výzkumu** u pramene načte jeho obrazy;
  - **Načíst všechny z výzkumu…** nejdřív ukáže počet pramenů a obrazů, velikost („Uloží se u stromu v tomto
    prohlížeči.“), kolik obrazů výzkum teprve připraví a volné místo v prohlížeči. Potom průběh s **Pozastavit**
    a **Zastavit**; okno jde zavřít a načítání poběží dál. Nenačtené zůstanou ve filtru;
  - načtené obrazy zůstávají u stromu v tomto prohlížeči, odděleně od dat stromu.
- **Hranice:**
  - načíst jde jen z výzkumu, který běží na tomto počítači („Načte se, až výzkum na tomto počítači poběží.“). Na
    telefonu nebo jiném zařízení: „Obraz je ve výzkumu na počítači. Na tomto zařízení bude, když se strom přenese
    i s obrazy z výzkumu.“;
  - **Odebrat z aplikace** obrazy z prohlížeče zase odebere; zůstanou ve výzkumu a jdou načíst znovu. Obrazy, které
    přišly v souboru výzkumu, zůstanou;
  - **Načítat obraz pramene při otevření** načte jen otevřený pramen a jen když výzkum na tomto počítači běží;
    seznam pramenů sám nic nenačítá;
  - export nabízí **Obrazy pramenů**: **Bez obrazů pramenů**, **Jen v aplikaci**, nebo **Všechny z výzkumu** (načtou
    se před exportem, jen když výzkum na tomto počítači běží).
- **Ovládání:** aplikace: **Prameny** → filtr **Obraz jen ve výzkumu** → **Načíst všechny z výzkumu…**; u pramene
  **Načíst obraz z výzkumu**, **Další volby → Odebrat z aplikace**; **Nastavení → Obrazy pramenů** (**Načítat obraz
  pramene při otevření**, **Odebrat z aplikace…**, **Načíst všechny…**); **Výzkum → Obrazy jen ve výzkumu · N**.
- **Platí od:** aplikace 3.14.0 s výzkumem 1.18.0
- **Od aplikace 3.25.0:** filtr a štítek se jmenují **Obraz jen ve výzkumu** (dřív **Obraz ve výzkumu**), řádek pod
  filtrem říká, kde obrazy jsou, a **?** otevře toto pravidlo.

<!-- zdroj: app:src/strings.ts researchImages.* (held.scope/limit/later, heldTag, filter, bulkLine, bulkLoad, bulkSummary, bulkReady, bulkSpace, bulkCanClose, bulkLeft, menuRow, removeFromApp(Note), heldBridgeOff, heldDevice, settings.section/auto/autoDesc/remove/loadAll/removeKeep, export.legend/none/app/all/allOff) · src/help/topics.ts imagesHeld · CHANGELOG.cs.md 3.14.0, 3.25.0 · commit 68b31a48 -->

<a id="A3.9"></a>
## A3.9 Kde zápis v knize stojí

Kde zápis stojí, se u pramene píše po polích. Podle archivu, signatury, folia a snímku se zápis najde znovu i tehdy,
když archiv změní adresy snímků nebo kniha nemá čísla stran.

- **Pole:**
  - **Archiv**: archiv, fara, knihovna;
  - **Signatura**: signatura knihy, inventární číslo;
  - **Folium/strana**: folium nebo strana, jak knihu čísluje, i se slovem („fol. 12v“, „pag. 112“);
  - **Snímek**: číslo snímku v prohlížeči archivu. **?** vedle pole řekne proč: „Číslo snímku v prohlížeči archivu.
    Podle archivu, signatury, folia a snímku se zápis najde i po změně adresy.“;
  - **Další umístění**: zbytek, např. číslo zápisu, sloupec, svazek.
- **Starší pramen** má, kde zápis stojí, jedním textem v **Další umístění** a nová pole prázdná. Když jsou
  **Folium/strana** i **Snímek** prázdné a text jmenuje folium nebo snímek, editor pod poli navrhne „Z umístění:
  fol. 31 recto · snímek 3 · zbytek „č. 2““. **Převzít** vyplní tři pole („Převzato z umístění „…“. Uloží se
  s Uložit.“), **Vrátit** je vrátí. Nic se neuloží samo: převzatá pole se uloží až s **Uložit**, jedním krokem zpět.
  Rozpoznání je kód aplikace, stejné jako ve výzkumu ([R3.4.3](R3-verification-and-citation.md#R3.4.3)).
- **Rozpor:** když **Další umístění** jmenuje jiný snímek nebo folium než pole, editor to řekne („Umístění jmenuje
  snímek 35, pole Snímek říká 34. Do GED jde pole.“) a nabídne **Upravit umístění na „…“** (nebo **Smazat rozpornou
  část**). Uložit jde i s rozporem; do GEDCOM jde pole.
- **Kde je vidět:**
  - prohlížeč pramene pod výřezy: **Kniha** (archiv · signatura) a **Zápis** (folium · snímek · další umístění),
    u staršího pramene **Umístění** celé; pod nimi odkaz na stranu v archivu, bez odkazu „Odkaz chybí. Zápis se
    najde podle knihy a zápisu.“;
  - **Akce → Prameny** a výběr pramene: archiv · signatura · folium · snímek zkráceně („sn. 34“);
  - štítek citace: bublina má tři řádky (název, kniha, zápis);
  - stránka osoby, kniha rodu a rodinné stránky uvedou i signaturu, folium a snímek;
  - Tabulka: sloupce v [A6.7.11](A6-views.md#A6.7.11) a [A6.7.12](A6-views.md#A6.7.12).
  Pramen bez nových polí vypadá všude jako dřív.
- **Hranice:**
  - vymazané pole se z pramene odebere. U stromu výzkumu se vymazání propíše i do výzkumu
    ([S2.2.2](S2-edits-from-the-app.md#S2.2.2));
  - **Další zápis ze stejné knihy** a **Jiná stránka** s poli popisuje [A3.2.1](#A3.2.1);
  - GEDCOM: kniha jako `REPO` s `CALN`, jedna čitelná `PAGE` a vlastní značky Stromu ([A2.6](A2-loading-a-family-tree.md#A2.6),
    [A2.7](A2-loading-a-family-tree.md#A2.7));
  - pag. a fol. a líc a rub (r/v) se nerozlišují zvlášť: jsou součástí textu **Folium/strana**.
- **Ovládání:** editor pramene (**Upravit pramen**, **Přidat pramen**): **Archiv**, **Signatura**, **Folium/strana**,
  **Snímek**, **Další umístění**, **URL**; návrh **Z umístění:** s **Převzít** a **Vrátit**.
- **Platí od:** aplikace 3.27.0
- **Od aplikace 3.31.0:** u snímku, který výzkum zjistil ze svých evidovaných skenů, GEDCOM jiný snímek z umístění
  nevystřihne: dostane umístění celé a snímek z pole za ním, když ho umístění neříká
  ([A2.6](A2-loading-a-family-tree.md#A2.6)).

<!-- zdroj: app:c3278633 src/types.ts Source.callNumber/folio/image (reference = další umístění), src/source-location.ts hasPlaceFields, recognizeLocation, locatorOverlap, composePage, sourcePlaceParts, sourcePlaceLine (short: imageShort), test/fixtures/source-locations.json (38 případů společných s výzkumem) · 9732853b src/ui/sources.ts:1269 (návrh sleduje psaní), :1363-1400 řádek pod poli (taken/conflict/proposal jen při prázdném foliu i snímku), :1429 Vrátit; prázdná pole odebrána · 2f4a9c2f prohlížeč (viewerBook/viewerEntry/viewerLocation/viewerNoUrl), Správa a výběr, bublina čipu, person-page.ts, book-blocks.ts, family-pages-html.ts · strings.ts sources.fieldRepository(Ph)/fieldCallNumber(Ph)/fieldFolio(Ph)/fieldImage(Ph)/fieldImageHelp/imageHelpLabel/fieldReference(Ph)/proposalFrom/proposalRest/proposalTake/proposalTaken/proposalUndo/conflictImage/conflictFolio/conflictFix/conflictFixEmpty/imageShort · spec 075 K1.1, rozhodnutí 1, 2, 5 · dirigent:prace/1111-app-citace-pole · 3.31.0: app:2e68d373 src/source-location.ts composePage (imageDerived) -->

<a id="A3.9.1"></a>
### A3.9.1 Rozdělit umístění podle návrhu

Starší umístění všech pramenů jde rozdělit do polí najednou: folium/strana a snímek přejdou do vlastních polí,
zbytek zůstane v **Další umístění**. Rozdělí to kód, bez agenta, a jedním krokem se to i vrátí.

- **Nabídka:** v **Akce → Prameny** a nad Tabulkou › Prameny řádek „Umístění 12 pramenů jde rozdělit do polí.“
  s **Rozdělit podle návrhu…**. Okno **Rozdělit umístění do polí** ukáže náhled: **Pramen**, **Umístění dříve**,
  **Folium/strana**, **Snímek**, **Další umístění**; nejdřív 6 pramenů, **Zobrazit všechny (n)** načte další při
  posunu. Kolik umístění se nerozpoznalo („… zůstanou beze změny“), stojí pod náhledem, a pod tím až tři příklady
  („Např. „Kniha N 7, zápis bez čísla“.“), každý jednou a nejvýš 60 znaků („…“).
- **Pravidlo:** „Pole, které už je vyplněné, se nepřepíše. Část, kterou pole říká jinak, v umístění zůstane.“ Hodnota,
  která zůstává, má v náhledu „· beze změny“. Řádek poznámky „Signatura: …“ z dřívějšího importu GEDCOM se přesune
  do prázdného pole **Signatura** (sloupec **Signatura** s „· z poznámky“).
- **Rozdělit (n)** změní všech n pramenů jedním krokem, i ty, které náhled zatím neukázal. Upozornění „Rozděleno n umístění.“ nabízí 8 sekund
  **Zpět**; vrátit jde i Ctrl+Z (na Macu ⌘Z). Dokud je rozdělení posledním krokem, **Prameny** říkají „Umístění
  rozdělena … (n pramenů).“ s **Vrátit…** a okno se otevře s řádkem **Vrátit rozdělení z …**. Když už nic
  k rozdělení není: „Jiná umístění k rozdělení teď nejsou.“
- **Strom výzkumu:** rozděluje výzkum, jen když běží a rozdělení umí ([R3.4.4](R3-verification-and-citation.md#R3.4.4)).
  Náhled je výzkumu; **Rozdělit** ho požádá o rozdělení přesně toho, co náhled ukázal, a průběh zůstane na tlačítku,
  dokud výzkum nezapíše. Aplikace pak novou verzi výzkumu převezme sama, když se liší jen umístění pramenů a nic
  nečeká na poslání. **Zpět** vrací rozdělení přes výzkum.
- **Hranice:**
  - strom výzkumu bez běžícího výzkumu: v **Prameny** jen věta „Rozdělení umístění jde, když výzkum běží.“, v Tabulce
    nic. Archiv Stromu, strom jen pro čtení a zamčený strom rozdělení nenabízejí;
  - prameny změněné mezitím: „Prameny se mezitím změnily. Náhled ukazuje, jak jsou teď.“; výzkum zaneprázdněný jinou
    úlohou: „Výzkum teď pracuje na jiné úloze. Rozdělení jde za chvíli.“ se **Zkusit znovu**;
  - vrácení odmítne celé, když se pramen po rozdělení změnil: řekne kolik a první tři, nevrátí se nic. V aplikaci
    bez výzkumu po pozdější změně stromu „Vrátit už nejde: strom se od rozdělení změnil.“;
  - nerozpoznané umístění zůstane, jak je. Pramen, který už má folium nebo snímek v poli, se mezi nerozpoznané
    nepočítá: zbytek jeho umístění („č. 5“) není co rozdělit. Ve stromu výzkumu dává příklady nerozpoznaných výzkum;
    když je nepošle, náhled ukáže jen počet.
- **Ovládání:** **Akce → Prameny → Rozdělit podle návrhu…**; Tabulka › Prameny, řádek nad tabulkou; **Rozdělit (n)**,
  **Zpět**, **Vrátit…**. Výzkum v terminálu: `strom source split` ([R3.4.4](R3-verification-and-citation.md#R3.4.4)).
- **Platí od:** aplikace 3.27.0; strom výzkumu s výzkumem 1.31.0

<!-- zdroj: app:8dd21adf src/source-split.ts SplitSourceKind (local/bridge/needsResearch/archive/none), localSplitPlan (řádek poznámky „Signatura:“ v každém jazyce importu), splitOffer (needsResearch jen v Prameny) · src/ui/source-split-ui.ts:37 TOAST_MS 8000, sourceSplitKind (read-only/zamčený → none, archiv → archive, most + feature sources.split → bridge) · 5a59f01d src/source-split-bridge.ts (GET/POST sources/split, undo), příklady nerozpoznaných přes most (unrecognizedExamples, výzkum ff760309) a lokální plán jako výzkum (zbytek u pole folia/snímku = nic, NFC, bez duplicit, nejvýš 3, ořez 60 znaků po grafémech): app:34cb5996 src/source-split.ts localSplitPlan, SPLIT_UNRECOGNIZED_EXAMPLES, src/source-split-bridge.ts examplesOf, src/ui/source-split-ui.ts:614, strings.ts sources.split.unrecEx · src/ui/misc.ts:1352 Ctrl/⌘+Z · strings.ts sources.split.* (offer, open, needsResearch, doneLine, undoOpen, title, lead, rule, sigNote, col*, kept, fromNote, all, shown, unrec, go, progress, toast, undo, undoRow, nothingLeft, errPlan, errBusy, retry, errUndoLater, errUndo) · spec 075 K4.2 · research:c4fe4fac -->
