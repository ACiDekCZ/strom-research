<a id="A12"></a>
# A12 Portrét a fotka svazku

Portrét osoby je čtverec vyříznutý z fotky. Výřez se volí v editoru nad celou fotkou a jde kdykoli upravit, protože
celá fotka zůstane u osoby jako příloha. Pár může mít vlastní **fotku svazku** (svatební nebo společnou) a z ní
portréty obou partnerů. Kapitola popisuje aplikaci Strom 3.30.0; změny z novější verze mají u sebe její číslo.

<!-- zdroj: dirigent:spec/107-vyrez-portretu (K1.1–K2.3) · app:59b9dde9..6a00396f (dirigent:prace/1116-app-107-vyrez) · app:docs/ZADANI_DEV_vyrez-portretu.md §1–§10, rozhodnutí D1–D12 · app:src/photo.ts, src/portrait-editor-model.ts, src/ui/portrait-editor.ts · app:CHANGELOG.cs.md 3.30.0 -->

<a id="A12.1"></a>
## A12.1 Editor výřezu portrétu

Fotka vybraná v úpravě osoby se otevře v editoru **Výřez portrétu**. Rámeček ve tvaru fotky na kartě stojí na místě
a fotka se pod ním posouvá, přibližuje a otáčí.

- **V editoru:**
  - **posun** tažením fotky; do aplikace 3.31.0 se posun zastaví, než by v rámečku zůstalo prázdné
    místo (od 3.32.0 jde přes kraj, viz níž);
  - **Přiblížení** od 100 % (rámeček pokryje kratší stranu fotky) nejvýš do 800 %; výřez má vždy aspoň 128 px
    původní fotky, takže malá fotka se přiblíží méně (nejvýš na dvojnásobek skutečného rozlišení); **Výchozí** vrátí
    úvodní výřez: největší čtverec ze středu;
  - **Otočení** po 90° doleva a doprava;
  - **Narovnání** o nejvýš 45° na obě strany po 0,5°, s mřížkou přes rámeček při tažení; fotka se přitom přiblíží, aby
    v rámečku nezůstal prázdný roh;
  - **Zrcadlit**;
  - **Náhled**: karta osoby s tvarem a velikostí fotky z Nastavení ([A6.1.4](A6-views.md#A6.1.4)), čtverec
    s popiskem **Stránka osoby** a výřez 4 : 5 s popiskem **Rodinné stránky**. Věta pod náhledem: „Na kartě kruh, uloží se celý čtverec.“
    (u zaobleného čtverce „Na kartě zaoblený čtverec, uloží se celý čtverec.“).
- **Hotovo** vrátí portrét do úpravy osoby; uloží se až s jejím **Uložit**. **Zrušit** (i Escape) nechá úpravu osoby,
  jak byla, a soubor se nepoužije. Úprava osoby zavřená bez uložení nenechá nic, ani portrét, ani originál.
- Uložený portrét je čtverec 256 × 256 px ve formátu JPEG. Průhledná místa (PNG) dostanou bílý podklad, z GIF se
  vezme první snímek. Kruh nebo zaoblený čtverec je jen tvar na kartě: uloží se celý čtverec.
- Portrét z nového souboru, u kterého se v editoru nic nezměnilo, je bajtově stejný jako portrét před aplikací
  3.30.0. Originál se uloží i tak ([A12.2](#A12.2)).
- Když výřez pokrývá méně než 256 px původní fotky, editor jednou řekne „Fotka je malá, portrét může být neostrý.“
- **Hranice:**
  - ve stromu jen ke čtení (exportovaná stránka HTML, sledovaný strom, strom uložený novější verzí aplikace,
    náhled verze) a u zamčené osoby se portrét nemění: **Upravit výřez**, **Upravit výřez portrétu**, **Jako
    portrét…** a **Použít jako portrét…** chybí nebo nic neotevřou; portrét se jen ukazuje;
  - osoba smazaná během úpravy (v jiném okně, při načtení z výzkumu) nedostane nic: „Osoba už ve stromu není, nic se
    neuložilo.“;
  - soubor, který není obrázek nebo nejde přečíst, editor neotevře; aplikace to řekne jako dřív.
- **Ovládání:** úprava osoby, **Vybrat fotku** u fotky. Na telefonu (do 640 px) je editor přes celou obrazovku:
  náhled karty, přepínač **Přiblížení** | **Narovnání** s jedním posuvníkem a pod ním ↺ ↻ a **Zrcadlit**.
- **Platí od:** aplikace 3.30.0; tlačítka otočení fotky v úpravě osoby jsou od 3.30.0 v editoru.
- **Od aplikace 3.31.0:** **Vybrat fotku** u osoby, která má fotky k nabídnutí, otevře nejdřív výběr **Portrét
  z fotky** ([A12.2](#A12.2)); soubor z počítače v něm dá **Z počítače…** (na dotyku **Ze zařízení…**). Nová osoba
  a osoba bez takových fotek dostane výběr souboru jako dřív.
- **Od aplikace 3.32.0:** fotku jde pod rámečkem posunout i přes její kraj (myší, prstem i šipkami) a tam ji
  přiblížit, takže obličej u kraje fotky může být uprostřed portrétu. Střed rámečku vždy zůstane na fotce. Část
  portrétu mimo fotku má neutrální světlou barvu, stejně na kartě (i v tmavém režimu), ve vějíři, v knize, v exportu
  obrázku, v uložených stránkách, v tisku i v GEDCOM. Dřív vyříznuté portréty vypadají jako dosud.

<!-- zdroj: app:327d9734 src/ui/portrait-editor.ts (rámeček, posun, kolečko, dva prsty, ↺ ↻, narovnání s mřížkou, Zrcadlit, náhled karty / Stránka osoby / Rodinné stránky, telefon), src/photo.ts PHOTO_SIZE 256, PORTRAIT_MIN_SOURCE_PX 128, PORTRAIT_MAX_ANGLE 45, PORTRAIT_ANGLE_STEP 0.5, minZoomForAngle, cropToJpeg (bílý podklad) · src/portrait-editor-model.ts isIdentityPortrait (Hotovo beze změny z nového souboru = compressPhoto), isSmallPortrait · app:88859da2 src/ui/person-modal.ts handlePhotoInput → editor, Zrušit/Escape nechá dialog, dialog zavřený bez Uložit nic nenechá, #photo-rotate-left/right odstraněny · app:a2af453a jen ke čtení / zamčená osoba, personGone · app:ef688950 dlouhá jména, telefon na šířku · strings.ts portrait.title, preview, personPage, familyPages, savedCircle, savedRounded, rotate, straighten, zoom, reset, mirror, small, personGone · ZADANI_DEV §1, §9, §10 · 3.31.0: app:c6fbb3ff src/ui/person-modal.ts choosePersonPhoto (#photo-choose-btn; bez currentId → #input-photo), src/ui/portrait-picker-ui.ts openPortraitPicker (prázdný model → portraitPickFile), portraitPickerHtml (fromComputer / fromDevice) · strings.ts labels.photoChoose, portrait.pickTitle, fromComputer, fromDevice · dirigent:prace/1122-app-portret-dev · app:docs/ZADANI_DEV_portret-z-materialu.md §1.2, §1.3 · 3.32.0: app:5ec53843, 950904bd, 6a3f1550 (1123-app-vyrez-pripojit) isPortraitRegionShape (strana ≤ 1, střed na fotce), plocha mimo fotku #f0e9da pečená do Person.photo, GED bez CROP · CHANGELOG.cs.md 3.32.0 (Portrét přes kraj fotky) · dirigent:test/vysledek-1123-app-vyrez-pripojit.md A -->

<a id="A12.1.1"></a>
### A12.1.1 Klávesnice, myš a dotyk v editoru

| Vstup | Co udělá |
|---|---|
| tažení fotky (myš, jeden prst) | posun |
| kolečko | přiblížení kolem ukazatele (× 1,15 za krok) |
| dva prsty | přiblížení kolem středu prstů; otáčení dvěma prsty není |
| dvojklik nebo dvojí klepnutí na fotku, klávesa `0`, **Výchozí** | úvodní výřez kroku |
| dvojklik na posuvník **Narovnání** | 0° |
| ← → ↑ ↓ (fokus na rámečku) | posun o 1 % strany výřezu, se Shift o 10 % |
| `+` `=` `−` | přiblížení a oddálení o 10 % |
| `[` `]` | otočení o 90° doleva a doprava |
| posuvník **Narovnání** ← → | ± 0,5°, se Shift ± 5°, Home a End ± 45° |
| Enter | **Hotovo**; v prvním ze dvou kroků **Další** ([A12.5](#A12.5)) |
| Escape | **Zrušit**: zavře jen editor, úprava osoby pod ním zůstane otevřená |

- Rámeček dostane fokus po otevření. Čtečka obrazovky ohlásí přiblížení a narovnání („Přiblížení 290 %“,
  „Narovnání −2,5°“) 300 ms po poslední změně. Tab prochází editorem a neopustí ho.
- **Hranice:** na počítači je v patičce nápověda kláves, na telefonu a tabletu ne. Úvodní výřez je u jednoho portrétu
  střed fotky, u portrétu z fotky svazku polovina partnera ([A12.5](#A12.5)).
- **Ovládání:** jak v tabulce.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:327d9734 src/ui/portrait-editor.ts ZOOM_STEP 1.1, WHEEL_STEP 1.15, šipky 1 % / Shift 10 %, [ ], Enter, Escape ve fázi capture, live hlášení po 300 ms, past fokusu · app:4cea7fbd Výchozí / 0 / dvojklik = úvodní výřez kroku · strings.ts portrait.keys, frameAria, liveZoom, liveAngle, straightenHint · ZADANI_DEV §3 -->

<a id="A12.2"></a>
## A12.2 Originál a štítek Portrét

Portrét si pamatuje, ze které fotky a jak byl vyříznutý. Celá fotka zůstane u osoby jako příloha se štítkem
**Portrét**, a výřez jde proto kdykoli změnit bez ztráty ostrosti.

- **Originál z nového souboru:** po **Hotovo** a **Uložit** přibude osobě příloha s celou fotkou (JPEG, delší strana
  nejvýš 1600 px, bez otočení a zrcadlení, jméno podle souboru). Počítá se do součtu příloh osoby
  ([A3.4](A3-evidence-in-the-app.md#A3.4)).
- **Štítek Portrét** je u přílohy, ze které je portrét, v úpravě osoby, v materiálech osoby a v panelu prohlížeče
  (popisek „Z této fotky je portrét osoby.“). V úpravě osoby se štítek mění hned s portrétem, ještě před **Uložit**.
- **Portrét z fotky, která už u osoby je:** **Jako portrét…** v řádku obrázkové přílohy (před košem), **Použít jako
  portrét…** v nabídce ⋯ materiálů osoby a v panelu prohlížeče (před **Odstranit ze stromu…**). Editor se
  otevře nad tou přílohou; nová příloha nevznikne. Z úpravy osoby se výsledek uloží s **Uložit**, odjinud hned:
  „Portrét osoby {jméno} nahrazen.“ s **Vrátit**. Výzkum k tomu nemusí běžet.
- **Osoba už portrét má:** editor ukáže „Osoba už portrét má. Hotovo ho nahradí, jde to vrátit.“ a náhledy **Dnešní**
  → **Nový**.
- **Smazání přílohy, ze které je portrét:** potvrzení říká „Je to zdroj portrétu. Portrét zůstane, jeho výřez půjde
  dál měnit jen uvnitř hotového čtverce.“ Portrét zůstane bez propojení.
- **Odebrat** u portrétu v úpravě osoby smaže portrét i jeho propojení; příloha zůstane bez štítku.
- **Hranice:** nabídka **Jako portrét…** je jen u obrázkové přílohy s náhledem (ne u PDF ani u souboru, který drží
  jen výzkum, [A3.4](A3-evidence-in-the-app.md#A3.4)) a jen u přílohy, která zdrojem portrétu ještě není. U zamčené
  osoby a ve stromu jen ke čtení chybí. Portréty dvou osob z jedné fotky dělá fotka svazku ([A12.5](#A12.5)).
- **Ovládání:** úprava osoby, sekce fotky a **Přílohy**; stránka osoby, materiály a prohlížeč přílohy.
- **Platí od:** aplikace 3.30.0
- **Od aplikace 3.31.0:**
  - **Použít jako portrét…** je i u obrázku JPEG nebo PNG z výzkumu, který osobu jmenuje (⋯ v materiálech osoby,
    prohlížeč souboru). Editor se otevře nad pracovní kopií z výzkumu. Souborem stromu u osoby se obrázek stane až
    po **Hotovo** (v úpravě osoby po **Uložit**), v jednom kroku **Vrátit**. Z fotky víc lidí dostane každá osoba
    vlastní výřez; soubor je ve stromu jednou, u každé osoby jako další místo. Když výzkum neběží, je akce u souboru
    jen ve výzkumu nedostupná; výzkum, který soubory osobám nepřiřazuje, ji nenabízí.
  - **Výběr Portrét z fotky** nabízí fotky osoby, ze kterých jde portrét vyříznout: obrázky stromu u osoby a obrázky
    JPEG a PNG z výzkumu, které osobu jmenují, od nejnovějších (bez data na konci). PDF, soubor jen s originálem
    ve výzkumu, skryté soubory a soubory rodokmenu v něm nejsou. Fotka dnešního portrétu v něm je také (nový výřez
    téže fotky), se štítkem **Portrét**. Fotka, která jmenuje i jiné osoby, má pod názvem „a 2 další“ a jejich jména
    v popisku („Na fotce také: …“); osoby jen z dávky, se kterou soubor přišel, se nepočítají. Volba fotky otevře
    editor ([A12.1](#A12.1)); z úpravy osoby se portrét uloží s **Uložit**, ze stránky osoby hned s **Vrátit**.
    Poslední řádek je **Z počítače…** (na dotyku **Ze zařízení…**).
  - **Vzhled výběru:** na počítači s myší v okně širším než 1024 px okénko u tlačítka; na dotyku a v okně do 1024 px
    list zespodu se jménem osoby, na telefonu na šířku panel vpravo. Zavře ho Escape, klik vedle a volba fotky.
  - **Stavy výběru:** když výzkum neběží, fotky jen ve výzkumu chybí a výběr řekne „Fotky z výzkumu (3) jsou
    dostupné, když výzkum běží.“, na počítači s **Spustit výzkum**. Se starším výzkumem, bez výzkumu a na dotyku
    nabízí jen fotky stromu, bez věty. Soubor stromu, který po otevření stromu ještě nepřišel
    ([S1.4.1](S1-connecting-app-and-research.md#S1.4.1)), se načítá a nejde zvolit; soubor, který nepřišel, ve
    výběru není. Zvolená fotka z výzkumu se načítá ve výběru („Načítá se fotka z výzkumu…“); když se nenačte, výběr
    zůstane otevřený s „Fotku se nepodařilo načíst.“ a **Zkusit znovu**.
  - **Portrét z fotky…:** osoba bez portrétu, kterou jde měnit a která má fotku k nabídnutí, má v záhlaví úpravy
    osoby pod jménem odkaz **Portrét z fotky…**. Totéž otevře kolečko v záhlaví a prázdné kolečko v sekci fotky.
    Stránka osoby má odkaz **Portrét z fotky…** pod iniciálami; uložená stránka (**Uložit jako HTML**), tisk a strom
    jen ke čtení ho nemají. Jen fotky z výzkumu, který neběží, odkaz nedají.

<!-- zdroj: app:59b9dde9 src/types.ts PortraitCrop, PortraitSource (attachmentId | partnershipId), Person.photoSource · app:88859da2 originál = cropToJpeg celé fotky, ATTACHMENT_MAX_SIDE 1600, ATTACHMENT_QUALITY 0.8, jen z nového souboru · app:e6f0595d src/ui/attachments-ui.ts štítek Portrét, Jako portrét… (isImage && !originalOnly && !locked, ne u zdroje), materials-ui.ts / material-viewer-ui.ts Použít jako portrét… (před Odstranit ze stromu…; app 3.30.0 material-viewer-ui.ts m.removeFromTree), danger.portraitSourceNote, unlinkPortraitFromAttachment, toast portraitReplaced s Vrátit · app:a2af453a Odebrat portrét → zdroj se smaže, příloha zůstane · D5 (bez běžícího výzkumu) · strings.ts attachments.asPortrait, portraitTag, portraitTagTitle, materials.useAsPortrait, portrait.replaceNote, current, newOne, replaced · ZADANI_DEV §4, §10 · 3.31.0: app:43d87c60 src/ui/portrait-actions-ui.ts materialPortraitOffer (vlastní obrázek stromu, nebo JPEG/PNG výzkumu se jménem osoby; bridge jen s caps.assign), useMaterialAsPortrait, linkPortraitFile; src/materials.ts isMaterialPortraitCandidate, PORTRAIT_MIMES · dirigent:prace/1121-app-portret-z-materialu · app:c6fbb3ff src/portrait-candidates.ts portraitCandidates (offer, bridge && !bridgeUp → researchOnly, waits failed vynechané, nejnovější první, isSource), photoPeopleOthers (directPersons bez dávky, místa přílohy), src/ui/portrait-picker-ui.ts (popover !isCoarsePointer && !isTabletOrMobile, jinak presentPortraitSheet; Escape, klik vedle; pickPortraitCandidate: busy, failed, Zkusit znovu = materials.retry; start jen na počítači s researchStartUrl) · app:3f6c9dfd src/ui/person-modal.ts updatePortraitOffer (#pm-portrait-link, #pm-avatar, #photo-preview is-pick), src/person-page.ts portraitPick (jen mode app, links app, ne readOnly), src/ui/person-page-ui.ts personPagePortraitPick · strings.ts portrait.pickTitle, fromComputer, fromDevice, fromPhoto, others, alsoIn, researchDown, pickLoading, pickFailed, materials.retry, sync.startResearch · dirigent:prace/1122-app-portret-dev · app:docs/ZADANI_DEV_portret-z-materialu.md §1–§4 -->

<a id="A12.3"></a>
## A12.3 Upravit výřez později

Portrét s originálem jde kdykoli vyříznout znovu z celé fotky. Portrét bez originálu jde měnit jen uvnitř svého
čtverce.

- **S originálem:** editor se otevře nad přílohou nebo fotkou svazku, ze které portrét je, s dnešním výřezem.
- **Bez originálu** (portrét z doby před aplikací 3.30.0, z importu GEDCOM, ze sloučení bez zdroje, po smazání
  zdrojové přílohy): editor pracuje s hotovým čtvercem 256 px. Výřez jde jen zmenšit,
  posunout uvnitř (od aplikace 3.32.0 i přes kraj), otočit, narovnat a zrcadlit. Editor to řekne („Celá fotka není uložená, výřez jde jen zmenšit.“) a nabídne **Vybrat fotku
  znovu…**: otevře výběr souboru a pak jako nová fotka ([A12.1](#A12.1)). Každá další úprava bez originálu portrét
  zjemňuje; nový výběr fotky to napraví.
- **Portrét | Celá fotka:** zvětšení portrétu na stránce osoby má dole přepínač **Portrét** | **Celá fotka**, když
  portrét má originál ve stromu. Uložená stránka osoby (**Uložit jako HTML**) má ve zvětšení portrétu odkaz **Celá
  fotka**, jen když soubor tu fotku nese (přílohy nebo fotka svazku ve skupinách obsahu,
  [A7.6](A7-book-pages-and-export.md#A7.6)). Portrét bez originálu a jiné obrázky přepínač nemají.
- **Hranice:** výsledek z úpravy osoby se uloží až s **Uložit**; ze stránky osoby se zapíše hned jako jeden krok
  („Portrét upraven.“ s **Vrátit**) a stránka se překreslí. Ve stromu jen ke čtení a u zamčené osoby úprava není
  ([A12.1](#A12.1)).
- **Ovládání:** úprava osoby, **Upravit výřez** mezi **Vybrat fotku** a **Odebrat** (jen s fotkou); stránka osoby,
  ⋯ **Další akce** → **Upravit výřez portrétu** (jen u osoby s portrétem, kterou jde měnit).
- **Platí od:** aplikace 3.30.0
- **Od aplikace 3.31.0:** ⋯ **Další akce** na stránce osoby má před **Upravit výřez portrétu** položku **Změnit
  portrét…**: otevře pod ⋯ výběr **Portrét z fotky** ([A12.2](#A12.2)) a nový portrét se zapíše hned s **Vrátit**.
  Položka je jen u osoby s portrétem, kterou jde měnit a která má fotku k nabídnutí (počítají se i fotky z výzkumu,
  který neběží). Klik na portrét dál otevře zvětšení.
- **Od aplikace 3.32.0:** i portrét bez originálu jde posunout přes kraj svého čtverce; plocha mimo něj má
  neutrální světlou barvu a střed rámečku zůstane na portrétu ([A12.1](#A12.1)).

<!-- zdroj: app:1feae064 src/ui/person-modal.ts #photo-recrop-btn (labels.photoRecrop), editor nad zdrojem s photoSource, jinak squareOnly + chooseAgain → #input-photo · src/ui/person-page-ui.ts item('crop', editCrop) jen canEdit && person.photo, Hotovo = jedna transakce, toast portraitUpdated s Vrátit · app:dab74024 src/ui/image-viewer.ts přepínač Portrét | Celá fotka (jen s existujícím zdrojem), src/person-page.ts portraitLightbox odkaz Celá fotka jen když soubor fotku nese · strings.ts labels.photoRecrop, personPage.moreActions, editCrop, portrait, wholePhoto, portrait.noOriginal, chooseAgain, updated · ZADANI_DEV §2, §10 · 3.31.0: app:3f6c9dfd src/ui/person-page-ui.ts togglePersonPageMenu item('portrait') před crop, personPageCanChangePortrait (shown + researchOnly > 0), runPersonPageMenu → openPortraitPicker pod .pp-more · strings.ts personPage.changePortrait · dirigent:prace/1122-app-portret-dev · app:docs/ZADANI_DEV_portret-z-materialu.md §1.3 · 3.32.0: dirigent:prace/_drobnosti/doc.md (1123-app-vyrez-pripojit: platí i pro čtvercový portrét bez originálu) -->

<a id="A12.4"></a>
## A12.4 Fotka svazku

Svazek může mít jednu fotku páru: svatební nebo společnou. Patří svazku, ne jednomu z partnerů.

- **Řádek Fotka** u každého svazku ve vztazích osoby:
  - bez fotky **Vybrat fotku** a nápověda „Svatební nebo společná fotka páru“;
  - s fotkou náhled, **Vybrat fotku** (vymění ji), **Udělat portréty…** ([A12.5](#A12.5)), **Odebrat** a velikost
    v kB. Klik na náhled otevře prohlížeč s popiskem „{A} a {B} · fotka svazku“ (partneři v pořadí jako na kartě),
    **Stáhnout** a **Udělat portréty…**.
- Fotka se zmenší jako příloha: JPEG s delší stranou nejvýš 1600 px.
- Změny fotky ve vztazích se uloží s **Uložit** panelu a **Zrušit** je zahodí; oznámení je bez **Vrátit**. Mimo panel
  (prohlížeč z Tabulky, [A12.6](#A12.6)) se zapíše hned jako jeden krok s **Vrátit**.
- **Odebrat** se zeptá („Odebrat fotku svazku?“, „Portréty, které z ní vznikly, zůstanou.“). Portréty zůstanou bez
  propojení a dál se upravují jen uvnitř svého čtverce ([A12.3](#A12.3)).
- **Smazání svazku s fotkou** se nejdřív zeptá: „S ním zmizí i fotka svazku. Portréty z ní zůstanou.“ Svazek bez
  fotky se smaže jako dřív.
- **Hranice:** jedna fotka na svazek; další fotky páru jen jako přílohy osob. Je-li některý z partnerů zamčený nebo
  strom jen ke čtení, řádek ukáže jen náhled a velikost.
- **Ovládání:** úprava osoby, sekce **Vztahy** → **Spravovat vztahy** (panel **Vztahy: {jméno}**), u svazku řádek
  **Fotka**; v Tabulce svazků **Upravit…** u řádku ([A6.7.8](A6-views.md#A6.7.8)). Na telefonu je panel přes celou
  obrazovku a tlačítka řádku se zalomí.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:59b9dde9 src/types.ts Partnership.photo, photoOriginalName, photoDate (verze dat 23), unlinkPortraitsFromUnion · app:9a47896e src/ui/relationships-panel.ts partnershipPhotoRowHtml (Vybrat fotku, unionPhotoHint, náhled → prohlížeč s popiskem, Udělat portréty…, Odebrat s danger.unionPhotoPortraitsStay, kB, zamčený partner jen náhled a velikost), Uložit / Zrušit panelu (D7) · src/attachments.ts ATTACHMENT_MAX_SIDE 1600 · app:68c232ad potvrzení smazání svazku s fotkou deleteUnionPhotoNote (D1) · strings.ts relationships.unionPhoto, unionPhotoHint, makePortraits, unionPhotoCaption, danger.removeUnionPhotoTitle, removeUnionPhoto, unionPhotoPortraitsStay, deleteUnionTitle, deleteUnionPhotoNote, buttons.manageRelationships (index.html #link-relationships), relationships.title · ZADANI_DEV §6, D1, D7, D9 -->

<a id="A12.5"></a>
## A12.5 Portréty z fotky svazku

**Udělat portréty…** vyřízne z fotky svazku portrét každého partnera v jednom editoru, krok po kroku.

- Editor **Portréty z fotky svazku** má krok pro každého partnera v pořadí jako na kartě. Úvodní výřez je největší
  čtverec v levé, resp. pravé polovině fotky; u fotky na výšku v horní a dolní polovině. Rámeček druhého partnera je
  vidět čárkovaně se jménem.
- Kroky jdou přepínat v záhlaví; nastavení kroku se drží. Patička: **Zrušit** · **Přeskočit** · **Další**, v posledním
  kroku **Hotovo**. Přeskočený krok portrét nezmění.
- **Partner, který portrét má:** „{jméno} už portrét má“ a volba **Ponechat dnešní portrét** (výchozí; „Krok se
  přeskočí.“) nebo **Nahradit novým výřezem** („Dnešní portrét jde vrátit.“).
- **Svazek s jedním známým partnerem** má jeden krok: „Druhý partner není známý, portrét se udělá jen jedné osobě.“
- **Hotovo** uloží všechny nové portréty najednou, každý s propojením na fotku svazku; do příloh se kopie fotky
  nedává. Oznámení: „Uloženy 2 portréty z fotky svazku.“ (s přeskočenými „…, 1 přeskočen.“). **Vrátit** vrátí oba
  portréty jedním krokem; ve vztazích platí **Uložit** a **Zrušit** panelu ([A12.4](#A12.4)).
- Portrét z fotky svazku se později upravuje nad fotkou svazku ([A12.3](#A12.3)).
- **Hranice:** zamčený partner krok nedostane; ve stromu jen ke čtení **Udělat portréty…** není.
- **Ovládání:** **Udělat portréty…** v řádku **Fotka** ve vztazích a v prohlížeči fotky svazku (i z Tabulky,
  [A12.6](#A12.6)). Klávesy jako v [A12.1.1](#A12.1.1).
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:9a47896e src/ui/portrait-editor.ts dva kroky (pořadí partnerů jako na kartě, levá / pravá polovina, u fotky na výšku horní / dolní), Přeskočit, Ponechat / Nahradit, Hotovo = jedna transakce, photoSource.partnershipId bez kopie do příloh, toast fromUnion s Vrátit · app:4cea7fbd Výchozí = polovina partnera · app:327d9734 čárkovaný rámeček druhého partnera · D9 zamčený partner · strings.ts portrait.twoTitle, next, skip, skipped, done, hasPortrait, keep, keepSub, replace, replaceSub, keepStage, single, fromUnion · ZADANI_DEV §7 -->

<a id="A12.6"></a>
## A12.6 Kde se portrét a fotka svazku ukážou

Výřez platí všude, kde se ukazuje fotka osoby. Fotka svazku je jen tam, kde se mluví o páru: ve vztazích, v Tabulce
svazků, na stránkách osob a v knize rodu.

| Místo | Portrét (výřez) | Fotka svazku |
|---|---|---|
| karta ve stromu, náhled při najetí, úprava osoby | ano | ne |
| stránka osoby (v aplikaci i uložená) | ano | první v galerii **Obrázky a dokumenty** obou partnerů, popisek „{A} a {B} · fotka svazku“, počítá se k obrázkům |
| rodinné stránky (stránky rodu a stromu) | ano, ořezaný na 4 : 5 | jako na stránce osoby |
| Kniha rodu | ano | v kapitole rodiny nad událostmi páru |
| plakát, export obrázku, tisk stromu, průlet | ano | ne |
| Tabulka › Svazky | – | sloupec **Fotka** |
| vztahy osoby | – | řádek **Fotka** ([A12.4](#A12.4)) |

- **Tabulka › Svazky, sloupec Fotka:** ve skupině **Děti a prameny**, na začátku skrytý. Buňka ukáže malý náhled; klik
  nebo klepnutí otevře prohlížeč s **Udělat portréty…**, které se zapíšou hned s **Vrátit**. Kopie, CSV a XLSX mají
  „ano“, nebo nic. Řazení dá svazky s fotkou před svazky bez ní. Filtr hodnot **s fotkou** / **bez fotky**; **Jen**
  a **Bez** v buňce filtrují stejně ([A6.7.6](A6-views.md#A6.7.6)). Na telefonu má řádek náhled, jen když je sloupec
  zapnutý.
- **Kniha rodu:** fotka přes šířku sloupce, nejvýš 110 mm vysoká, s popiskem druhu svazku a data („Sňatek,
  18. 6. 1924“, u nesezdaného páru „Partneři“). Je jen s částí **Výřezy zápisů a fotky**
  ([A7.4](A7-book-pages-and-export.md#A7.4)); strom, jehož jediné obrázky jsou fotky svazků, tu část nabídne.
- **Stránky:** fotka svazku chybí bez skupiny obrázků a ve stránce, která chrání žijící, když je žijící aspoň jeden
  z partnerů ([A12.7](#A12.7)).
- **Hranice:** strom (Rodina, Potomci, karty, spojnice), plakát, tisk a průlet fotku svazku neukazují. Tabulka,
  Vějíř, Časová osa, Mapa a statistiky portrét neukazují (beze změny). **Přehled stromu** počítá fotky svazků
  mezi fotky a originály portrétů mezi přílohy.
- **Ovládání:** Tabulka › Svazky, výběr sloupců; stránka osoby; export **Kniha rodu**.
- **Platí od:** aplikace 3.30.0
- **Od aplikace 3.31.0:** Vějíř ukazuje portréty se zapnutými **Portréty** ([A6.4.2](A6-views.md#A6.4.2)); od 3.32.0
  v každém prstenci, kde je dost místa, a na plakátu a v tisku od 7 mm ([A6.4.3](A6-views.md#A6.4.3)). Fotku svazku
  vějíř neukazuje.

<!-- zdroj: app:45f7ca2a src/ui/table-view/table-columns.ts:732 uPhoto (group uextra, skrytý, kind thumb), thumbCell (strings.table.yes, sortKey), table-filter.ts presence (withPhoto / withoutPhoto), prohlížeč s Udělat portréty… a Vrátit, telefon (D10) · app:fd1f0c3c src/person-page.ts couplePhotoItems (první v galerii, popisek, počet obrázků, bez skupiny obrázků / žijící partner pod ochranou), rodinné stránky totéž, src/book-blocks.ts couplePhotoHtml (jen parts.media, popisek fields.marriageRow / book.partners + datum), src/book-css.ts .book-photo--couple max-height 110mm · app:50e49518 src/ui/tree-overview.ts a src/attachments.ts: fotka svazku mezi fotkami, originál portrétu je příloha · ZADANI_DEV §5, §8, D10, D12 · strings.ts tableCols.uPhoto, tableFilter.withPhoto, withoutPhoto, table.groups.uextra, personPage.sec.materials, relationships.unionPhotoCaption, book.parts.media -->

<a id="A12.7"></a>
## A12.7 Export, ochrana žijících a GEDCOM

Originál portrétu a fotka svazku jsou fotky: jdou do exportu s fotkami a vypadnou s nimi.

- **Obsah exportu** ([A7.3](A7-book-pages-and-export.md#A7.3)):
  - bez **Fotky** (i **Malý soubor k odeslání** a **Jen kostra**) zmizí portréty, jejich originály (i když se
    přílohy exportují) a fotky svazků; výřez zápisu z takového originálu zůstane bez propojení;
  - bez **Přílohy, dokumenty a výřezy pramenů**, ale s fotkami, zůstanou portréty a fotky svazků; portréty
    z příloh ztratí propojení na originál.
- **Ochrana žijících** ([A7.2](A7-book-pages-and-export.md#A7.2)): žijící osoba ztratí portrét, originál i přílohy;
  svazek, jehož aspoň jeden partner je žijící, ztratí fotku. Stejně na stránkách a v knize rodu.
- **Export GEDCOM** zapíše fotku svazku jako obyčejný obrázek rodiny (`1 OBJE` u `FAM`), bez vlastní značky Stromu.
  Výřez a propojení portrétu s originálem se nezapíšou; originál jde jako obyčejná příloha osoby. Export **Zpět do
  {program}** fotky nemá ([S6.6](S6-tree-from-another-program.md#S6.6)).
- **Import GEDCOM:** první obrázek rodiny (přednost má obrázek označený `_PRIM`, `_PRIMARY` nebo `_PERSONALPHOTO`
  `Y`; zapsaný přímo u rodiny i odkazem na záznam média `@O1@`) se stane fotkou svazku, když je obsažený přímo
  v souboru. Ostatní obrázky rodiny se uchovají pro **Zpět do {program}** jako dřív; obrázek, který se stal fotkou
  svazku, se tam znovu nezapíše. Fotka rodiny, kterou soubor jen odkazuje cestou, se nabídne k napojení
  ([A2.1.1](A2-loading-a-family-tree.md#A2.1.1)).
- **Hranice:** portrét po importu GEDCOM (ze Stromu i odjinud) nemá propojení s originálem a upravuje se uvnitř
  čtverce ([A12.3](#A12.3)). Napojený soubor fotky rodiny nahradí řádky uchované pro **Zpět do {program}**; tam se
  pak nevrací.
- **Ovládání:** **Export** → **Obsah**, **Soukromí žijících osob**; **Import → Import GEDCOM**, souhrn importu.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:50e49518 src/photo.ts stripPhotos (portrét, photoSource, zdrojová příloha i při exportu příloh, Partnership.photo*, výřez zápisu bez fromAttachmentId), src/attachments.ts stripAttachments + dropDanglingPortraitSources, src/privacy.ts (žijící: photoSource, přílohy; svazek se žijícím partnerem bez fotky), CONTENT_PRESETS (small, skeleton bez fotek; back bez médií) · app:68c232ad src/ged-exporter.ts:2089 Partnership.photo → 1 OBJE u FAM bez _STROM_KIND, photoSource se nezapisuje · src/ged-parser.ts první obrázek rodiny (_PRIM/_PRIMARY/_PERSONALPHOTO Y první, na místě i @O1@) → Partnership.photo jen jako bezpečná data URL, ostatní v extras pro Zpět do, vložený se nezapíše dvakrát · src/ged-media-attach.ts attachGedcomMediaFile (partnershipId: jen obrázek, jen svazek bez fotky, dropMediaLink) · strings.ts privacy.contentPhotos, contentAttachments, presetSmall, presetSkeleton · ZADANI_DEV „Data a rozhraní“, §6 -->

<a id="A12.8"></a>
## A12.8 Fotky v datech stromu

Originál portrétu, výřez a fotka svazku jsou součástí stromu (verze dat 24: každý soubor stromu je jeden
materiál s místy, [A3.5](A3-evidence-in-the-app.md#A3.5)). Jdou se stromem do zálohy JSON a do
souboru **Aplikace i s daty**. Kde všude jsou uložené, popisuje [S8](S8-where-the-data-are.md).

- **Starší aplikace** (od 3.19.0) otevře strom verze 24 jen ke čtení a neuloží ho, aby portréty, originály, fotky
  svazků a místa souborů nezahodila ([A6.7.7](A6-views.md#A6.7.7)).
- **Vrátit:** každé **Hotovo** mimo úpravu osoby je jeden krok; v úpravě osoby se vše uloží a vrací s jejím
  **Uložit**; dva portréty z fotky svazku jsou jeden krok.
- **Sloučení osob:** propojení s originálem jde s portrétem, který zůstane. U svazků zůstane fotka ponechaného
  svazku, a když ji nemá, fotka druhého.
- **Sloučení stromů** ([A8](A8-merging-trees.md)): fotka svazku ze slučovaného souboru přibude, kde ji svazek ve
  stromu nemá; portrét si drží originál toho portrétu, který zvítězil.
- **Strom z výzkumu nebo Archivu Stromu:** výzkum a archiv od 1.35.0 portréty, originály portrétů, fotky svazků
  a přílohy drží: zápis stromu je předá a načtení stromu je vrátí podle otisku
  ([S8.3](S8-where-the-data-are.md#S8.3)). Výzkum nedrží jen výřez, tedy kde v celé fotce portrét je; strom
  v aplikaci si ho ponechá. Výzkum do 1.34 nic z toho nedrží: načtení nové verze je ve stromu ponechá; když
  výzkum u osoby nebo páru vlastní fotku má, platí jeho, jinak zůstane fotka ze stromu. Portrét, příloha nebo
  fotka svazku odebraná v aplikaci se s další aktualizací nevrátí.
- **Hranice:** bez výzkumu 1.35.0 jsou portréty, originály a fotky svazků jen ve stromu v aplikaci a v jeho
  zálohách. Propojení s originálem, které nesedí (originál chybí, výřez mimo fotku, úhel nad 45°), se při
  načtení zahodí; portrét zůstane.
- **Platí od:** aplikace 3.30.0; fotky ve výzkumu s výzkumem 1.35.0

<!-- zdroj: app:src/types.ts:1862 STROM_DATA_VERSION 24 (app:2b66d7cf; verze 23 app:59b9dde9, obě v 3.30.0) · src/photo.ts dropDanglingPortraitSources, sanitize při načtení · src/tree-manager.ts:659 isTreeNewer (jen ke čtení), strings.ts newerDataTitle · src/merge/executor.ts photoSource s vítězným portrétem, fotka svazku vítězného jinak druhého (app:59b9dde9, 50e49518) · app:50e49518 sloučení souboru: fotka svazku tam, kde chybí, originál podle bajtů · app:3f0312fb, 50e49518 src/research-link.ts carryOverMedia (fotka svazku a photoSource přenesené, vlastní fotka výzkumu vyhrává, odebrané se nevrací) · dirigent:spec/107 rozhodnutí: výzkum a archiv fotky nedrží (ZADANI_VYZKUM V2, V6, V7), platí pro výzkum do 1.34 · spec 108: dirigent:spec/108-kde-se-co-uklada U8, K2.3 (výřez se nevrací) · app:3419afff, 7263f1f6, src/research-link.ts carryOverMedia base · research:c9a4b614 CHANGELOG.cs.md 1.35.0 -->
