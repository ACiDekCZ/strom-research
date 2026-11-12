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

<!-- zdroj: app:src/research-sync.ts:357 researchReadSource, :365 isOlderSource, :377 verifiedOffer, :385 unverifiedOlderSources · src/ui/sources.ts:618 renderSourceReading, :658 sourceVerifiedValue, :296 renderSourcesFilter, :377 renderSourceViewer · strings.ts sources.verified/verifiedHintGuide/verifiedHintOlder/verifiedByTree/readBy/userReadingNote/filterUnverified · překlad (od 3.24.0): src/source-translation.ts SOURCE_TRANSLATION_LABELS, splitSourceTranslation · strings.ts viewerTranslation, translation · commit c2942b0 -->

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

<!-- zdroj: app:src/attachments.ts:12-18 ATTACHMENT_MAX_SIDE, ATTACHMENT_QUALITY, MAX_PDF_BYTES, ATTACHMENT_WARN_BYTES · src/ui/attachments-ui.ts:28-31 ORIGINAL_ONLY_TYPES/needsOriginalOnly, :161 accept, :211 addAttachmentFile · strings.ts attachments.*, media.originalOnlyMeta/originalOnlyNeedsResearch, treeOverview.mediaWarning -->

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

Materiál je soubor poslaný výzkumu k osobě nebo k prameni: dopis, fotografie, kopie z archivu. Do stromu se nic
nepřidá. Výzkum soubory uloží a udělá z nich úkol pro agenta.

- **Poslat materiál…** (u osoby) a **Poslat materiál k prameni…** (prohlížeč a editor pramene): nejvýš 20 souborů
  najednou a **Poznámka pro výzkum**. Celou složku pošle **Přidat materiály…** v menu výzkumu
  ([S4](S4-research-from-the-app.md)).
- **Přidat i jako přílohu do stromu** (jen u osoby): ve stromu vznikne i náhled jako u přílohy.
- Když výzkum neběží, soubory čekají v prohlížeči. Když výzkum osobu ještě nezná, pošlou se po dalším poslání stromu.
- Sekce **Materiály** v úpravě osoby, **Materiály** v menu osoby a okno **Všechny materiály ›** ukazují přílohy
  stromu i soubory výzkumu dohromady. Stejný soubor se ukáže jednou.
- **Hranice:** jen na počítači, u stromu propojeného s výzkumem, který přijímá originály. Výzkum nikdy nepřijme
  programy, klíče, archivy ani soubory rodokmenu (GEDCOM). Přiřazení a skrytí materiálu jde jen se spuštěným výzkumem.
  U Archivu Stromu se materiál uloží do archivu; **Uložit i do stromu** přidá obrázky a PDF do 2 MB i do stromu.
- **Ovládání:** viz výše.
- **Platí od:** aplikace 3.9.0; sekce a okno **Materiály** 3.16.0

<!-- zdroj: app:src/ui/material-ui.ts:30-33 MATERIAL_MAX_FILES, MATERIAL_NOTE_MAX, REFUSED_EXT, :38 materialAccepted, :51 alsoTreeEligible, :71 materialAvailable · src/materials.ts:477 personMaterials, :519-529 gates · src/ui/originals-ui.ts:269 · src/ui/research-actions-ui.ts:357 batch · strings.ts material.*, materials.*, batch.menu -->

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

<!-- zdroj: app:c3278633 src/types.ts Source.callNumber/folio/image (reference = další umístění), src/source-location.ts hasPlaceFields, recognizeLocation, locatorOverlap, composePage, sourcePlaceParts, sourcePlaceLine (short: imageShort), test/fixtures/source-locations.json (38 případů společných s výzkumem) · 9732853b src/ui/sources.ts:1269 (návrh sleduje psaní), :1363-1400 řádek pod poli (taken/conflict/proposal jen při prázdném foliu i snímku), :1429 Vrátit; prázdná pole odebrána · 2f4a9c2f prohlížeč (viewerBook/viewerEntry/viewerLocation/viewerNoUrl), Správa a výběr, bublina čipu, person-page.ts, book-blocks.ts, family-pages-html.ts · strings.ts sources.fieldRepository(Ph)/fieldCallNumber(Ph)/fieldFolio(Ph)/fieldImage(Ph)/fieldImageHelp/imageHelpLabel/fieldReference(Ph)/proposalFrom/proposalRest/proposalTake/proposalTaken/proposalUndo/conflictImage/conflictFolio/conflictFix/conflictFixEmpty/imageShort · spec 075 K1.1, rozhodnutí 1, 2, 5 · dirigent:prace/1111-app-citace-pole -->

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
