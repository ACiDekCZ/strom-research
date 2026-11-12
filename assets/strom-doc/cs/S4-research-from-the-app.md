<a id="S4"></a>
# S4 Výzkum řízený z aplikace

Co z výzkumu aplikace ukazuje a co z ní jde ve výzkumu spustit: běžící práce, fronta, linie a akce, které otevřou
výzkum. Popisuje aplikaci Strom 3.21.2 (a výzkum 1.25.2). Změny z novější verze mají u sebe její číslo.

<a id="S4.1"></a>
## S4.1 Panel a Přehled výzkumu ukazují běžící práci

Při sledování výzkumu ([S1](S1-connecting-app-and-research.md)) ukazuje aplikace malý panel **Živý výzkum ze Strom
Research** a z něj větší **Přehled výzkumu**. Oba jen čtou. Co ukazují, posílá výzkum přes most.

- **Hranice:**
  - Panel: **Pracuje se**, **Čeká na vyřízení**, **Poslední změny** (5 nejnovějších, odkaz **Všechny změny v přehledu
    ›**),
    **Na řadě** (3 úkoly) a pod tím počet sezení agenta za tento měsíc.
  - Když je panel vyšší než okno, sbalí se sám nejdřív **Na řadě**, pak změny, pak **Pracuje se**. **Čeká na
    vyřízení**
    se sám nesbalí nikdy. Oddíl, který sbalil nebo rozbalil člověk, zůstane, jak je.
  - Přehled, oddíly v tomto pořadí: souhrn (**Stav**, posledních 24 h, **Tento měsíc** s počtem sezení), **Teď**,
    **Čeká na vyřízení** (jen když něco čeká), **Linie** ([S4.3](#S4.3)), **Průběh**, **Fronta** ([S4.2](#S4.2)),
    **Co ví výzkum** ([S3](S3-what-the-research-knows.md)). **Fronta** a **Co ví výzkum** jsou na začátku sbalené.
  - **Průběh** slučuje kroky po 15 minutách, ukáže nejvýš 20 kroků.
  - Přehled je na širokém okně (od 1280 px) bočním panelem vedle stromu, na tabletu vrstvou přes strom, na telefonu
    celou obrazovkou. Na telefonu je z panelu pruh a klepnutí otevře přehled.
  - Bez sledování panel ukáže poslední známé **Čeká na vyřízení** s větou **Stav k …. Výzkum teď neběží.**
- **Ovládání:** aplikace: panel, tlačítka **⤢ Otevřít přehled** a **Ukončit sledování**; menu **Výzkum → Přehled
  výzkumu**.
- **Platí od:** aplikace 3.5.0
- **Od aplikace 3.22.0:** každý oddíl jde rozbalit, sbalit nebo skrýt a volba platí pro panel i Přehled
  ([S4.1.2](#S4.1.2)). **Čeká na vyřízení** se sám nerozbalí ani při nové položce.
- **Od aplikace 3.27.0:** s výzkumem 1.31.0 řádek v **Teď** ukáže u úkolu, který nepatří žádné linii, proč se na
  něm pracuje: u úkolu, který linii jen pomáhá, kterou linii a jak („pomáhá linii Předci: Jan Horák · připojuje lidi
  ke stromu“; dál „otázka linie“, „jak uvádí agent“, „manžel nebo manželka předka“, „větev …“), u úkolu mimo linie
  jeho větev („mimo linie · větev Josef Horák“, pod nadpisem **Mimo linie** jen „větev Josef Horák“). Co linii
  pomáhá, říká [R2.3](R2-lines-and-queue.md#R2.3). Řádky **Pracuje se** v malém panelu to říkají stejně; pod
  nadpisem linie jen jak, bez jejího jména.
- **Od aplikace 3.27.0:** **Přehled výzkumu** se otevře i bez sledování ([S4.1.5](#S4.1.5)): v nabídce **Výzkum** je
  vždy první, druhé je **Sledovat živě**, při sledování na jeho místě **Ukončit sledování**; v Archivu Stromu
  **Sledovat živě** není. Z **Přehledu stromu** ho otevře **Výzkum ›** v záhlaví **Na co se zaměřit**. Tlačítko
  **⤢ Otevřít přehled** v malém panelu je jen při sledování.
  - Souhrn ukazuje jen zapnuté části ([S4.1.2](#S4.1.2)): **Posledních 24 h** osoby a prameny, **Tento měsíc**
    počet sezení. Cenu (částku a čtenáře skenů) ukáže až po zapnutí, jinak ani v textu při najetí. Pod malým
    panelem stojí „Agent tento měsíc: 4 sezení“, částka, obojí, nebo nic.
  - V řádku linie v oddílu **Linie** stojí u práce jen „pracuje se“, když je oddíl **Teď** vidět (rozbalený i
    sbalený); celé „Teď: …“ je v textu při najetí. Při skrytém **Teď** řádek říká „Teď: …“ celé.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:223 PANEL_CHANGES, :227 AUTO_FOLD, :3326 appendQueueSection(…, 3), renderLivePanel, renderIdleResearchPanel · src/ui/research-overview-ui.ts:5 (≥1280), :51 FOLDED_BY_DEFAULT, :53 GROUP_MS, :59 MAX_STEPS, :74, :309-311 · strings.ts live.overviewTitle, research.panelLabel, research.stop, research.atWork, research.queue · 3.27.0 Teď: app 4e4f6d8c src/research-link.ts WORKING_HELPS_FEATURE (working.helps), sanitizeWorking (helps jen s linií, branch) · src/ui/research-offline-ui.ts workingWhyText (helps → qWhyHelps + qWhyHow / qWhyHowBranch; větev mimo linie → qWhyOutBranch, ve skupině qWhyHowBranch) · src/ui/research-overview-ui.ts (Teď: důvod místo názvu linie) · strings.ts live.qWhyHelps, qWhyHow.*, qWhyHowBranch, qWhyOutBranch · spec 036 K1.8 · malý panel: app 2c018779 src/ui/research-ui.ts, research-directions-ui.ts (pod nadpisem linie jen jak) · 3.27.0 spec 057: app f05fff8e src/ui/research-actions-ui.ts overviewRows (research-item-overview první; stop při sledování, jinak followLive, ne bez agenta), src/ui/tree-actions.ts researchOverview · 8d564b35 src/ui/tree-overview.ts treeOverviewResearchLinkHtml (live.researchLink v záhlaví focus) · 28bbebeb src/ui/live-section-prefs.ts TOP_DEFAULTS (month.price false), research-overview-ui.ts appendOverviewSummary, strings.ts live.spendSessions, spendAmount · 87a6ea88 live.dirWorkedOn · strings.ts live.openOverview -->

<a id="S4.1.1"></a>
### S4.1.1 Sledovat agenta ve stromu

Strom může sám přecházet na osobu, na které agent právě pracuje (první nepozastavená práce v oddílu **Teď**).

- **Hranice:** nejvýš jeden přechod za 8 s. Když je strom oddálený víc než na 0,55, přiblíží se na 0,8. Posun stromu,
  výběr jiné osoby nebo jiný pohled sledování přeruší (**Zpět k agentovi**); po 20 s bez dotyku se vrátí samo. Volba
  se pamatuje pro zařízení.
- **Ovládání:** aplikace: **Přehled výzkumu → Sledovat agenta ve stromu** / **Přestat sledovat**.
- **Platí od:** aplikace 3.5.0
- **Od aplikace 3.24.0:** sledovat jde i ve vějíři a na mapě ([S4.1.3](#S4.1.3)); posun mapy ji pozastaví stejně.

<!-- zdroj: app:src/ui/live-follow-ui.ts:7, :26 ZOOM_FAR, :27 ZOOM_READABLE, :32 gap 8000 / idle 20_000 · strings.ts live.followOn, live.followOff -->

<a id="S4.1.2"></a>
### S4.1.2 Přizpůsobení panelu

Každý oddíl sledování výzkumu má jednu volbu: **Rozbalená**, **Sbalená** nebo **Skrytá**. Volba platí pro panel
i Přehled.

- **Hranice:**
  - oddíly: **Pracuje se** (v Přehledu **Teď**), **Čeká na vyřízení**, **Poslední změny** (v Přehledu **Průběh**),
    **Na řadě** (v Přehledu **Fronta**) a jen v Přehledu **Linie** a **Co ví výzkum**;
  - oddíl bez volby (**výchozí**) se ukáže jako dřív: panel sbalí, co se nevejde (**sbaleno, nevejde se**), Přehled
    má sbalenou **Frontu** a **Co ví výzkum**. Oddíl s volbou panel sám nesbalí;
  - klik na nadpis oddílu je trvalá volba (rozbalit / sbalit);
  - volba se drží na tomto zařízení pro všechny stromy, nic se nesynchronizuje. Dřívější ruční sbalení oddílů se
    převezme jednou;
  - **Vrátit výchozí** zruší všechny volby. Vrácení výchozího i skrytí oddílu z jeho menu jde chvíli vzít zpět
    (**Vrátit**). Když jsou skryté všechny oddíly, panel řekne **Všechny sekce jsou skryté.**
- **Čeká na vyřízení sbalené nebo skryté:**
  - nová položka oddíl nerozbalí. Nadpis ukáže počet a **N nových**; zvýrazněně, když je mezi nimi rozhodnutí
    nebo povolení (**mezi nimi rozhodnutí nebo povolení**);
  - skryté nechá štítek **Čeká N** v hlavičce panelu, ve shrnutí sbaleného panelu, v pruhu na telefonu
    a v Přehledu. Klik ukáže oddíl v Přehledu, dokud se Přehled nezavře (**Skrytá sekce, ukázaná do zavření
    Přehledu.**).
- **Ovládání:** aplikace: **⋯ → Upravit panel…** v hlavičce panelu i Přehledu; pravé tlačítko nebo dlouhý stisk na
  nadpisu oddílu (i klávesa Menu nebo Shift+F10); **Nastavení → Sledování výzkumu**. Na telefonu jako list zdola.
- **Platí od:** aplikace 3.22.0
- **Od aplikace 3.27.0:** **Upravit panel** má dvě karty, stejné v okně, v listu na telefonu (zavírá ho **Hotovo**)
  i v **Nastavení → Sledování výzkumu**:
  - **Sekce a pořadí:** všech šest oddílů v jednom seznamu a v jednom pořadí pro panel i Přehled (panel vynechá
    **Linie** a **Co ví výzkum**). Každý řádek má volbu **Rozbalená** / **Sbalená** / **Skrytá** (skrytý řádek
    „skrytá“). Řádek se posouvá šipkami ↑ ↓ (na krajích nejdou), Alt+↑ / Alt+↓, tažením za ⠿ (Esc tažení zruší;
    na telefonu úchyt není) nebo v menu oddílu **Posunout nahoru** / **Posunout dolů**. Čtečka obrazovky řekne nové
    místo („… přesunuto na 2. místo z 6.“). Výchozí pořadí: **Pracuje se** (**Teď**), **Čeká na vyřízení**,
    **Linie**, **Poslední změny** (**Průběh**), **Na řadě** (**Fronta**), **Co ví výzkum**. Když se panel nevejde,
    sbaluje oddíly odspodu tohoto pořadí;
  - **Nahoře:** **Stav** je vždy vidět („vždy vidět“). **Posledních 24 h** (části **osoby**, **prameny**) a **Tento
    měsíc** (části **sezení**, **cena**) mají každý vypínač a své části; dlaždice s oběma vypnutými částmi zmizí.
    **Cena** je výchozí vypnutá („Cena se ukazuje jen po zapnutí.“). Na telefonu je **Tento měsíc** šedý („Na
    telefonu se neukazuje.“). **Sledovat v** jde skrýt („Jen při živém sledování.“), sledování pak běží v pohledu
    zvoleném dřív;
  - patička: **Vrátit výchozí** vrátí stavy oddílů, pořadí i **Nahoře** (cena znovu skrytá), bez otázky, s
    oznámením „Výchozí obnoveno“ a **Zpět** na 8 s; **Všechna nastavení sledování ›** otevře Nastavení. Skrytí
    oddílu přímo v okně **Upravit panel** se neoznamuje, skrytí z menu oddílu ano („Sekce je skrytá“, **Vrátit**);
  - volby platí na tomto zařízení pro všechny stromy, pro panel i Přehled výzkumu, se sledováním i bez něj.
    Dřívější uložené volby zůstanou.

<!-- zdroj: app:src/ui/live-section-prefs.ts SECTION_PREFS_KEY, PREF_KEYS, OVERVIEW_KEYS, OLD_PANEL_KEY · src/ui/live-section-edit.ts · src/ui/live-section-edit-ui.ts · src/ui/research-ui.ts:282 waitingHeadInfo, :312 waitingChip, :3180 toggle, :3215 resetLiveSections, :3225 hideLiveSection · src/ui/research-overview-ui.ts:376 shownOnce · strings.ts live.editPanel(Menu), sectionExpanded/Collapsed/Hidden/Default, resetDefaults, autoFoldedNote, allHidden, waitingShort, importantHint, shownOnce, settings groupResearchFollow · commity c4b1dcc, a56232a · spec 044 K1–K5 · 3.27.0: app 28bbebeb src/ui/live-section-prefs.ts DEFAULT_ORDER, TOP_KEYS, TOP_DEFAULTS (záznam v2: pořadí, nahoře; v1 se čte beze změny) · 0b090a80 src/ui/live-section-edit-ui.ts (Sekce a pořadí / Nahoře, ⠿ ne v listu, Alt+↑↓, Escape tažení, Hotovo) · src/ui/research-ui.ts resetLiveSections (RESTORED_TOAST_MS 8000, live.undo), hideLiveSection (hiddenToast, undo.undo) · strings.ts live.groupSections, groupTop, alwaysShown, topDay, partPersons, partSources, topMonth, partSessions, partPrice, priceHelp, monthPhoneNote, topFollowIn, followInHelp, moveUp, moveDown, movedSr, allFollowSettings, settingsNote, restoredToast, hiddenToast, done · spec 057 K1.1–K1.7, K2.1 -->

<a id="S4.1.3"></a>
### S4.1.3 Sledovat ve vějíři a na mapě

Sledování agenta ([S4.1.1](#S4.1.1)) běží v Rodině, ve vějíři i na mapě. Přepínač **Sledovat v** mění pohled a
sledování zůstane zapnuté. Vějíř se při tom nehýbe, jen označí, kde se pracuje; mapa ukáže místo práce kruhem.

- **Vějíř:**
  - střed vějíře je **Osoba v zaměření** před zapnutím sledování (výchozí), **Výchozí osoba**, nebo **Vybraná osoba**
    (pro jeden strom). Nikdy to není osoba, na které agent pracuje. **Zafixovat jako střed** podrží osobu jako střed,
    **Uvolnit střed** ho pustí; nový střed se prolne za 150 ms;
  - osoba, na které se pracuje, má obrys v barvě sezení a dvakrát blikne, když se práce přesune a když sledování
    přejde do vějíře. Úzká výseč dostane značku vně vějíře;
  - osoba mimo vějíř dostane štítek **Pracuje se mimo vějíř:** u nejbližší osoby vějíře, v tomto pořadí: manžel nebo
    manželka, sourozenec, předek za okraji vějíře, u potomka střed, jinak první předek až 12 generací zpět.
- **Mapa:**
  - místo práce má kruh v barvě sezení: plný kruh je **místo záznamu** (místo pramene, na kterém agent pracuje, když
    ho výzkum posílá), přerušovaný **místo osoby** (první místo s polohou z narození, bydliště, sňatku, úmrtí).
    Sídlo archivu to nikdy není;
  - kruh jednou pulzne, když sledování přejde na mapu. Mapa se posune jen tehdy, když je místo prvního sezení mimo
    výhled a mapa není pozastavená. Ruční posun mapy ji pozastaví (**Posun mapy pozastaven**) do **Zpět k agentovi**;
  - místo bez polohy ukáže nahoře řádek „… – bez polohy na mapě“ s **Dohledat polohu** (u stromu s výzkumem
    **Dohledat ve výzkumu**, [A6.5.2](A6-views.md#A6.5.2)); osoba bez místa „… – bez místa“;
  - legenda **Co značí zvýraznění** vysvětlí kruhy, stopu a dutou značku.
- **Stopa sezení:** v Rodině, vějíři i na mapě slábnou osoby a místa, na kterých se pracovalo, podle stáří: nejvýš
  posledních 8 změn, žádná starší než 60 minut. Na mapě jsou to prázdné kruhy, místa jednoho sezení spojuje tečkovaná
  čára (ne na telefonu). Stopa jde vypnout.
- **Hranice:**
  - běží-li víc sezení, každé má číslo (ukáže se od dvou) a barvu: první hlavní, další doplňkovou;
  - práce na sňatku se sleduje u páru: v zaměření je manžel, jinak manželka;
  - volby platí na tomto zařízení pro všechny stromy, vybraná osoba jen pro svůj strom. Na telefonu je zobrazení
    zjednodušené.
- **Ovládání:** aplikace: při sledování **Sledovat v** (Rodina, Vějíř, Mapa); **Nastavení → Sledování výzkumu** →
  **Sledovat agenta v** (použije se při zapnutí sledování a při **Zpět k agentovi**), **Střed vějíře při sledování**
  (**Vybrat osobu**, **Změnit**), **Stopa sezení v Rodině, vějíři a na mapě**; ve vějíři **Zafixovat jako střed** /
  **Uvolnit střed**.
- **Platí od:** aplikace 3.24.0
- **Od aplikace 3.25.0:** legenda mapy říká „Dutá značka: místo bez osoby v zobrazených místech“ a místo práce bez
  osoby na mapě „zatím bez osoby na mapě“ (dřív „mimo rozsah mapy“).

<!-- zdroj: app:src/ui/live-follow-ui.ts (hlavička, followIn) · src/live-follow-prefs.ts · src/live-follow-targets.ts TRAIL_MAX=8, TRAIL_MAX_AGE_MS=60 min, fanCenter, sessionNumbers, sessionTone · src/live-follow-map.ts · src/fan-follow-anchor.ts MAX_UP=12 · src/ui/fan-follow-ui.ts · src/ui/map-follow-ui.ts PAN_MARGIN=64, PAN_MS=400, telefon bez čáry · strings.ts settings.groupResearchFollow, researchFollowNote, followView(Help), followFanCenter*, followTrail(Help); live.followIn, mapPaused, legendTitle, legendTrail, legendRecord, legendPerson, legendOut; fan.pin, unpin, centerLabel, workOutside; map workRecord, workPerson, outScope, noCoords, noPlace, locate · CHANGELOG.cs.md 3.24.0, 3.25.0 · spec 043 -->

<a id="S4.1.4"></a>
### S4.1.4 Změny z výzkumu bez blikání

Změna z výzkumu se do stromu promítne hned a bez překreslení celé obrazovky. Karty, které zůstávají, drží své místo;
co přibylo, ubylo nebo se změnilo, se krátce ukáže pohybem.

- **Hranice:**
  - zůstávající karty se přesunou plynule (320 ms). Nová osoba vyroste ze své linky a linkou proběhne světlo;
    odebraná se stáhne zpět do své linky; sloučená osoba splyne s tou, která zůstává (podle stejného příjmení,
    narození ±1 rok, společného rodiče nebo partnera); změněná karta má obrys v barvě sezení;
  - pohybem se ukáže nejvýš 12 nových karet; při víc než 60 změněných osobách se pohyb vynechá a změny se ukážou
    hned. Na telefonu a tabletu jsou časy kratší (×0,875);
  - nová osoba mimo výhled dostane značku u okraje („Přibyla mimo obraz: …“, 4 s). Přiblížení ani osoba v zaměření
    se nezmění. Čtečka obrazovky změny oznámí;
  - vypnutý **Pohyb při načtení změn** i omezený pohyb v systému ukážou změny hned, jen zvýrazněné („Systém má
    zapnutý omezený pohyb, změny se proto ukážou bez pohybu.“).
- **Ovládání:** aplikace: **Nastavení → Sledování výzkumu → Pohyb při načtení změn** (výchozí zapnuto).
- **Platí od:** aplikace 3.24.0

<!-- zdroj: app:src/live-transition.ts LIVE (move 320 ms, maxAnimatedNew=12, maxChangedForScene=60, ×0.875 touch), src/live-diff.ts (merge guess: surname, birth ±1, parent/partner) · strings.ts settings.liveMotion, liveMotionHelp, liveMotionReduced, edgeAdded · CHANGELOG.cs.md 3.24.0 · spec 055 -->

<a id="S4.1.5"></a>
### S4.1.5 Přehled výzkumu bez sledování

**Přehled výzkumu** jde otevřít u každého stromu z výzkumu i bez sledování. Strom se přitom nepřepne na verzi
výzkumu, nezamkne se a dá se dál upravovat. Co Přehled ukáže, záleží na tom, jestli most výzkumu odpovídá.

- **Most odpovídá** (výzkum na tomto počítači běží): Přehled ukáže totéž co při sledování (dlaždice i všechny
  oddíly) z pravidelného dotazu na most; pod **Stav** „obnoveno …“. **Čeká na vyřízení** a správa linií fungují
  přes most. Pod záhlavím stojí „Strom se přepne na verzi výzkumu a nejde upravovat.“ s tlačítkem **Sledovat
  živě**. Když agent mezitím začne pracovat, nad tím stojí „Agent začal“ a tlačítko je výraznější; samo se nic
  nepřepne. V Archivu Stromu tento pruh není.
- **Most neodpovídá:**
  - **Stav** „Výzkum neběží“ s **Zapnout** (kde výzkum z aplikace zapnout nejde, stojí tam, jak ho spustit);
  - **Čeká na vyřízení** tak, jak ho výzkum naposled řekl na tomto zařízení, se „stav k …“; starší než 7 dní se
    neukáže;
  - **Linie** ze souboru stromu: název a počet osob, nic o práci na nich; **Co ví výzkum** a v patičce **Kde
    chybí doklady: N osob ›**;
  - **Teď**, **Průběh** a **Fronta** nejsou; jeden řádek je jmenuje, např. „Teď, Průběh a Fronta: po zapnutí
    výzkumu.“ (skryté oddíly vynechá; když jsou skryté všechny tři, řádek není). Jakmile most odpoví, Přehled se
    překreslí sám.
- **Telefon** se mostu neptá: **Stav** „Jen ze stromu“ a „Práce agenta je vidět na počítači s výzkumem.“ Na šířku
  zůstane stav nahoře a oddíly se posouvají pod ním.
- **Jinde v aplikaci:** bez sledování ukáže práci agenta a frontu, když most odpovídá, i pohled Tabulka
  ([A6.7.14](A6-views.md#A6.7.14)).
- **Ovládání:** aplikace: **Výzkum → Přehled výzkumu**; **Přehled stromu → Na co se zaměřit → Výzkum ›** (u stromu
  bez osob v záhlaví dialogu); na telefonu a tabletu v akcích stromu, skupina **Výzkum**; v Přehledu **Sledovat
  živě**.
- **Platí od:** aplikace 3.27.0

<!-- zdroj: app:f05fff8e, 48573de6 src/ui/research-overview-ui.ts renderResearchOverview (source live | bridge | tree; fromTree vynechá working, changes, queue), appendOverviewStateOff (notRunning, turnOn / researchLiveStartHow; telefon phoneTreeOnly, phoneWhy), overviewFollowStrip (activeResearchAgentless → bez pruhu; agentStarted, followNote), appendOverviewWaitingAsOf (asOf), appendOverviewSkeletonLines, appendOverviewFoot (missingLink) · src/research-overview-source.ts BRIDGE_ONLY_SECTIONS, afterTurnOnKeys, skeletonLines (_STROM_DIRECTION, místa osob) · src/research-device.ts WAITING_MAX_AGE_MS = 7 dní · src/ui/research-ui.ts OverviewViewing (refreshedAt, agentStarted, waitingAt) · src/ui/tree-actions.ts researchOverview · 8d564b35 src/ui/tree-overview.ts treeOverviewResearchLinkHtml (sekce focus, bez osob v záhlaví) · strings.ts live.followNote, agentStarted, notRunning, turnOn, afterTurnOn, refreshedAgo, asOf, phoneTreeOnly, phoneWhy, researchLink, missingLink, treeOverview focus · CHANGELOG.cs.md 3.27.0 · spec 057 K1.8–K1.12 -->

<a id="S4.2"></a>
## S4.2 Fronta v aplikaci

Aplikace ukazuje začátek fronty výzkumu v pořadí, v jakém je agent bere ([R2.2](R2-lines-and-queue.md#R2.2)). Celá
fronta zůstává ve výzkumu.

- **Hranice:**
  - Panel ukáže 3 úkoly (**Na řadě**), přehled 20 (**Fronta**). Zbytek ukazuje řádek **a dalších N ve výzkumu**,
    který otevře výzkum.
  - Se dvěma a více běžícími liniemi jdou úkoly filtrovat podle linie (**Fronta podle linie**).
  - Úkol mimo linie má poznámku: **Čeká až po liniích · nepomáhá žádné linii**, **Nebere se · práce mimo linie je
    vypnutá**, nebo proč linii pomáhá (**Pomáhá linii: otázka linie**, **Pomáhá linii: připojuje lidi ke stromu**,
    **Pomáhá linii, jak uvádí agent**). Pravidla jsou v [R2.3](R2-lines-and-queue.md#R2.3).
  - Menu úkolu **Možnosti úkolu**: **Odložit** a **Vzdát**; u odloženého úkolu **Vrátit**. Každá z nich otevře
    terminál výzkumu a tam se potvrzuje ([S4.5](#S4.5)).
- **Ovládání:** aplikace: panel, oddíl **Na řadě**; **Přehled výzkumu**, oddíl **Fronta**; u úkolu **⋯**.
- **Platí od:** aplikace 3.5.0. Poznámky u úkolů mimo linie od 3.21.0 (výzkum 1.25.0).
- **Od aplikace 3.22.0:** s výzkumem 1.26.0 má každý úkol řádek, proč stojí, kde stojí
  ([R2.4](R2-lines-and-queue.md#R2.4)).
  **Udělat hned** a **Na konec** (a **Vrátit výchozí**) mění místo úkolu přímo z aplikace, bez terminálu
  ([R2.3.1](R2-lines-and-queue.md#R2.3.1)); u úkolu, na kterém agent pracuje, to nejde. Fronta se čte po stránkách:
  **Načíst další** přidá 50 úkolů, seznam drží nejvýš 300, zbytek zúží filtr linie nebo větve.
  Štítek větve (**Větev … K**) zúží celou frontu na úkoly větve; **Ukázat celou frontu** ho zruší.
- **Od aplikace 3.27.0:** s výzkumem 1.31.0 je fronta v aplikaci ve stejném pořadí, v jakém úkoly bere `strom run`
  a jak je ukáže menu výzkumu před ním ([R2.2](R2-lines-and-queue.md#R2.2)): při tahu vyprávění je nahoře jedno
  vyprávění a ve frontě jsou i úkoly dějin. Úkol za textem nese tichý štítek **příběh** nebo **dějiny** (v **Na
  řadě**, ve **Frontě**, u odložených úkolů a v úkolech větve); úkol bez něj vypadá jako dřív. Bez sledování ukáže
  frontu Přehled ([S4.1.5](#S4.1.5)) i Tabulka, když most odpovídá.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:308 queueNoteText, :3373 appendQueueSection · research-overview-ui.ts:311 (20) · strings.ts research.queue, research.park/drop/wake, research.queueMore, research.queueOffLast, research.queueOffNever, research.queueHelps · HEAD src/research-queue-pages.ts:19 QUEUE_PAGE, :28 QUEUE_ROWS_CAP · src/ui/research-ui.ts:3884 taskDoNext/taskDoLast · strings.ts live.taskDoing, live.queueLoadMore, live.queueCapNote, live.branchQueueChip, live.branchQueueChipClear · 3.27.0: app 2ee3718d (queue[].kind ze /status i ze stránek fronty, jiná hodnota zahozena) strings.ts live.queueKind · research 5f48cdaf src/core/queue.ts RUN_TURNS, runOrder (most /status queue[], GET /queue, menu před strom run), kind story|history -->

<a id="S4.3"></a>
## S4.3 Linie v aplikaci

Přehled ukazuje linie výzkumu ([R2.1](R2-lines-and-queue.md#R2.1)): co na které čeká a kam došla. V aplikaci 3.21.2
se linie jen čtou; každá změna se potvrzuje v terminálu výzkumu.

- **Hranice:**
  - Oddíl **Linie · N aktivní** je jen při dvou a více liniích, nebo při jedné linii, když běží i práce mimo ni
    (řádek **Mimo linie**). Pozastavené a ukončené linie jsou sbalené pod **Pozastavené a ukončené · N**.
  - Řádek linie: druh (↑ předci, ↓ potomci, ⌕ otázka), název, osoba, počet úkolů a co čeká na vyřízení. Linie bez
    práce má **Nic nečeká, lze ji ukončit.**
  - Detail linie: známí předci po generacích, kdy se na ní naposledy pracovalo, **Pracovat na této linii**
    (rozhovor s agentem, ne v Archivu Stromu) a **Ukázat ve stromu**.
  - Menu **Akce linie**: **Pozastavit**, **Ukončit**, **Znovu spustit**. Každá otevře terminál, ten řekne, co se
    stane,
    a zeptá se na důvod ([R2.1.2](R2-lines-and-queue.md#R2.1.2)).
  - Na telefonu menu chybí: **Nic nečeká · ukončit jde ve výzkumu na počítači**.
  - Se dvěma a více liniemi panel dělí práci po liniích a jednu linii jde vybrat; podle ní se filtruje fronta.
- **Ovládání:** aplikace: **Přehled výzkumu → Linie**, u linie **⋯**.
- **Platí od:** aplikace 3.5.0 (výzkum 1.8.0). Dělení panelu po liniích od 3.13.1.
- **Od aplikace 3.22.0:** s výzkumem 1.26.0 se linie mění přímo v aplikaci ([S4.3.1](#S4.3.1)). Řádek linie
  ukáže, na čem se teď pracuje (**Teď: …**), a meze (**do N generací**, **před …** (rok); u pozastavené linie ne).
  Detail linie řekne, co linie našla za poslední dny (**Za N dní:** sezení, osoby, prameny); osoby ukáže ve
  stromu. Ukončené linie jsou sbalené na konci (**Ukončené · N**). V úzkém okně a na telefonu je přehled listem:
  místo úchytu pořadí šipky ▲▼.

<!-- zdroj: app:v3.21.2 src/ui/research-directions-ui.ts:156 linesMulti, :350-353 appendOverviewDirections, :385 canDo, :528 dirWork · strings.ts live.dirTitle, live.dirOutside, live.dirInactive, live.dirWork · research:v1.25.2 assets/lang/cs.json ui.link.what.direction.pause/done/resume · 3.22.0: research-directions-ui.ts:703 dirEnded, :852 dirNow, :878 dirFoundIn, :720 sheet; strings.ts live.dirLimitGen, dirLimitBefore, dirFound* -->

<a id="S4.3.1"></a>
### S4.3.1 Správa linií z aplikace

S výzkumem, který to umí, zapisuje aplikace změny linií přímo přes most. Terminál se neotevírá a nic se neplatí.

- **Hranice:**
  - **+ Nová linie** (formulář **Nová linie**: **Druh** Předci / Potomci / Otázka, **Osoba**, **Otázka**, **Název**,
    **Omezit…**). Založení nic nestojí a agent na linii začne při dalším běhu. Nová linie jde na konec pořadí.
  - **Upravit**: druh a osobu změnit nejde (jiná osoba = nová linie). Úprava platí od dalšího výběru úkolu.
  - Pořadí linií: tažením, šipkami nebo **Přesunout na začátek**. Pod seznamem stojí, jak výzkum pořadí bere:
    **Výzkum se věnuje nejvíc liniím nahoře, ostatní nestojí.** nebo **Výzkum bere linie popořadě.**
  - **Pozastavit** a **Znovu spustit** se dají vzít zpět (**Zpět**). **Ukončit…** se zeptá a vezme nepovinný důvod.
  - Když už stejná linie je, formulář to řekne (**Linie … už běží.**) a nabídne **Ukázat ji** nebo **Založit
    přesto**.
  - **Hledat předky** a **Hledat potomky** u osoby otevřou tento formulář.
  - Jen ke čtení: v Archivu Stromu (**Archiv: linie jen ke čtení.**), na telefonu (**Linie jde měnit ve Stromu na
    počítači, kde běží výzkum.**), a když výzkum neběží (**Výzkum neběží. Linie půjde změnit, až poběží.**).
  - Výzkum starší než 1.26.0: akce zůstávají v terminálu (**Řízení linií v aplikaci umí výzkum od verze 1.26.0.**).
  - Když výzkum zápis odmítne (například je zaneprázdněný), aplikace nic nezmění a nabídne **Zkusit znovu**.
- **Ovládání:** aplikace: **Přehled výzkumu → Linie**, **+ Nová linie**, u linie **⋯**; menu osoby **Výzkum ›**.
- **Platí od:** aplikace 3.22.0 (výzkum 1.26.0)

<!-- zdroj: app:HEAD src/ui/research-directions-ui.ts:372 DIRECTIONS_WRITE_SINCE, :628 · src/research-directions-write.ts createDirection, editDirection, setDirectionState, writeDirectionOrder · src/ui/research-actions-ui.ts:1015-1024, :1067 openDirectionForm · strings.ts live.dirNew, dirFormNew, dirFree, dirEditFree, dirLocked, dirOrderWeight, dirOrderStrict, dirArchive, dirPhoneOnly, dirBridgeDown, dirOldResearch, dirBusy, dirRetry, dirDupActive, dirShowIt, dirAnyway · research:src/core/live.ts /directions -->

<a id="S4.3.2"></a>
### S4.3.2 Práce mimo linie po větvích

Při dvou a více liniích ukazuje přehled práci mimo linie po větvích. Volby z [R2.3](R2-lines-and-queue.md#R2.3) a
[R2.3.1](R2-lines-and-queue.md#R2.3.1) jdou nastavit přímo z aplikace.

- **Hranice:**
  - Pro celý výzkum: **Jak se bere práce mimo linie**: **Občas**, **Na konci**, **Normálně**, **Nikdy**.
  - Řádek větve: osoba větve, vztah k linii (**u linie …**), počet úkolů, **roste**, **vlastní volba**.
  - Klik na větev ukáže její první úkoly s místem ve frontě (**Ve frontě · první K z N**, **I. ve frontě**)
    a odkaz **Všechny N úkolů ve Frontě ›**. Když úkoly větve stojí za načtenou částí fronty: **Úkoly větve
    stojí ve frontě dál (N).**
  - Pro větev: **Bere se:** **Občas** / **Na konci** / **Normálně** (volba výzkumu má **(výchozí)**), **Přidat
    k linii …** (nejbližší linie první), **Založit linii z této větve**, **Nezkoumat** (úkoly odejdou z fronty,
    nic se nesmaže), **Vrátit výchozí**. Nezkoumané větve jsou pohromadě (**Nezkoumá se · N větví**).
  - Otázky k rostoucím větvím ([R2.3.2](R2-lines-and-queue.md#R2.3.2)) jsou v **Čeká na vyřízení**: přidat k linii
    (u pozastavené linie **Přidat k linii … (pozastavená)**), založit linii, **Nechat, jak je**, nezkoumat. Bez
    odpovědi se větev bere dál jako dosud.
  - Okno **Výzkum u tohoto stromu…**, skupina **Práce mimo linie**: volba pro celý výzkum (**Občas**: „Zhruba 1 úkol
    mimo linie na K úkolů linií.“), **Navrhovat linie u rostoucích větví**, **Větve s vlastní volbou**
    a úkoly s ručním pořadím. Od aplikace 3.27.0 úvod skupiny řekne, co linii pomáhá a jde s ní vždy: „otázka
    linie, připojení lidí k člověku linie nebo k jeho partnerovi, důvod uvedený agentem“
    ([R2.3](R2-lines-and-queue.md#R2.3)).
- **Ovládání:** aplikace: **Přehled výzkumu**, oddíl práce mimo linie, u větve **⋯** (**Možnosti větve**);
  **Výzkum u tohoto stromu…**.
- **Platí od:** aplikace 3.22.0 (výzkum 1.26.0)

<!-- zdroj: app:HEAD src/ui/research-offline-ui.ts:3, :104 (caps.offLineBranches, ≥2 linie) · src/research-directions-write.ts setBranchMode, setOffLineTree, answerBranchWaiting · strings.ts live.offModeLink, live.offModeCap, live.branchAddPick, live.branchCreate, live.branchNever, live.branchReset · research-offline-ui.ts:202-228 growingBranchLine, :542 branch choices, :680 branchQueueBeyond, :740 pick · strings.ts live.dirNear, branchGrows, branchOwnChoice, branchQueueHead, branchQueuePos, branchAllTasks, branchTaken, branchDefaultTag, branchAdd(Paused), branchNeverGroup, waitBranchLeave, waitBranchHint, setOutTitle, setOutOcc, setSuggest, setOwnChoice, setManualTasks, menu treeSettings · spec 038 K7 · 3.27.0: strings.ts live.setOutIntro (app 4e4f6d8c, spec 036 K1.8) -->

<a id="S4.4"></a>
## S4.4 Čeká na vyřízení v aplikaci

Panel i přehled ukazují stejný seznam jako výzkum ([R6.1](R6-awaiting-action.md#R6.1)). Co jde vyřídit v aplikaci
a co jen ve výzkumu, říká [R6.5](R6-awaiting-action.md#R6.5).

- **Hranice:** pod seznamem stojí, kde se odpovídá: **Odpovídá se ve výzkumu. Strom se po odpovědi aktualizuje sám.**,
  u otázek k místům **Na otázky k místům se odpovídá tady.**, při obojím **Na otázky k místům se odpovídá tady, na
  ostatní ve výzkumu.** Položky jen pro terminál aplikace nedostane ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
- **Ze stromu:** kartička osoby, na kterou něco čeká, má značku **!** (bublina: **Klik: odpovědět**). Klik na ni
  a položka **Odpovědět · N čeká** v nabídce osoby udělají totéž:
  - čeká-li na osobu jedna položka, otevře se její odpověď stejně jako tlačítkem v jejím řádku v panelu;
  - čeká-li jich víc, otevře se panel na oddílu **Čeká na vyřízení** s položkami osoby nahoře, zvýrazněnými. Na
    telefonu, se sbaleným nebo skrytým oddílem a při otevřeném přehledu se zvýrazní v **Přehledu výzkumu**;
  - když na žádnou položku osoby (ani na jedinou) tady odpovědět nejde, otevře se panel stejně a pod každou položkou
    stojí **Tady odpovědět nejde: odpovídá se ve výzkumu, na počítači, kde je nainstalovaný.** Klik nikdy nezůstane
    bez odezvy;
  - nová verze vyprávění otevře porovnání;
  - na dotykovém zařízení je v nabídce osoby místo **Odpovědět · N čeká** položka **Čeká na vyřízení · N ›**: zvýrazní
    položky osoby a odpovídá se z jejich řádků.
  - má-li kartička dvě nebo tři značky, klik nabídne, co otevřít ([S4.4.1](#S4.4.1)).
- **Hypotézy:** s výzkumem, který je umí rozhodnout v aplikaci, jsou hypotézy k rozhodnutí ve skupině **Hypotézy k rozhodnutí** (čip **Rozhodnutí**),
  i s přijetím návrhů agenta najednou ([S3.5.2](S3-what-the-research-knows.md#S3.5.2)).
- **Ovládání:** aplikace: panel, oddíl **Čeká na vyřízení**; menu **Výzkum → Čeká na vyřízení**; značka **!** na
  kartičce a **Odpovědět · N čeká** v nabídce osoby.
- **Platí od:** aplikace 3.4.0. Otázky k místům od výzkumu 1.25.0. Značka **!** a **Odpovědět · N čeká** takto od
  aplikace 3.26.0. Hypotézy od aplikace 3.27.0 s výzkumem 1.31.0. Více značek na kartičce od aplikace 3.27.0
  ([S4.4.1](#S4.4.1)).

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts renderLivePanel (waiting) · strings.ts research.answerWhere, research.answerHere, research.answerMixed · app:7cf409bd src/ui/card-signals-ui.ts answerPersonWaiting (vyprávění → porovnání; 1 položka → waitingAnswerAction; jinak showPersonWaiting, why jen když žádná nejde), personSignalsMenuHtml (dotyk: menuWaiting → signal-waiting-list) · src/ui/research-ui.ts showPersonWaiting (telefon, sbalený/skrytý oddíl, otevřený přehled → přehled), waitingWhyEl · src/research-waiting.ts personWaiting, panelWaiting (focus první) · src/ui/waiting-task-ui.ts waitingAnswerAction · src/card-signals.ts ACTION_GLYPH waiting '!' · strings.ts card.menuAnswer, card.menuWaiting, card.tipClickAnswer, live.waitingNoAnswerHere · e2e/card-waiting-answer.spec.ts · hypotézy: app:src/ui/hypothesis-waiting-ui.ts (commit 8d7f1597), research:src/core/waiting.ts hypothesesApp -->

<a id="S4.4.1"></a>
### S4.4.1 Více značek na kartě osoby

Kartička osoby má v rohu portrétu (fotky nebo iniciál) nejvýš jednu značku výzkumu na každý druh: **!** (něco čeká, [S4.4](#S4.4)), **≠** (rozpor
pramenů, [R5](R5-conflicts.md)) a **?** (otevřená otázka). S jednou značkou se karta chová jako dřív. Dvě nebo tři
značky stojí v zákrytu jako jedno tlačítko.

- **Hranice:**
  - pořadí značek: čeká › rozpor › otázka; vpředu, kde stojí jediná značka, je nejnaléhavější, zadní jsou bez znaku.
    Ukážou se jen druhy zapnuté v **Nastavení → Karta osoby → Na kartě ukázat** (**Čeká na vyřízení**, **Rozpory
    v pramenech**, **Otevřené otázky**);
  - bublina při najetí má řádek na každou značku (co čeká s textem prvního úkolu, rozpory a hypotézy, otázka) a pod
    nimi „Klik: vybrat, co otevřít“. Čtečka obrazovky slyší, co čeká („Čeká 3, 2 rozpory, 1 hypotéza, 1 otázka“);
  - klik otevře u značek malé okno se jménem a roky osoby (čtečka obrazovky: „{jméno}: co čeká“) a volbami:
    **Odpovědět · N čeká** s textem prvního úkolu (na dotykovém zařízení **Čeká na vyřízení · N ›**), **Porovnat** (nová verze vyprávění),
    **Co ví výzkum · … ›** (rozpory, hypotézy a otázka jako jedna volba), **Sledovat výzkum ›** (agent na osobě
    pracuje). Volby zůstávají v aplikaci, žádná nemá značku výzkumu ([S4.5.1](#S4.5.1));
  - jen rozpor a otázka dávají jedinou volbu: klik rovnou otevře **Co ví výzkum** („Klik: co ví výzkum“);
  - okno stojí pod značkami, u pravého nebo dolního okraje okna obráceně, kde se nevejde nikam, nahoře a posouvá
    se. Zavře ho klik vedle (nic dalšího neudělá), druhý klik na značky, Esc, volba, posun nebo přiblížení stromu,
    změna velikosti okna a překreslení stromu. Na telefonu (do 640 px) je to list zdola s řádky 48 px, zavře ho
    klepnutí vedle nebo tažení dolů; na tabletu a telefonu na šířku okno s řádky 44 px;
  - klávesnice: Enter, mezerník nebo šipka dolů na značkách okno otevře na první volbě, šipky jdou dokola, Home
    a End, Enter vybere, Esc vrátí na značky, Tab jde dál;
  - kartička bez portrétu (**Detail karet → Kompaktní**) má místo značek dvě tečky. Při oddálení stromu pod 0,55 má
    každá kartička, v každém **Detailu karet**, místo značek jednu tečku. Tisk stromu značky nemá.
- **Ovládání:** aplikace: klik na značky v rohu portrétu; **Nastavení → Karta osoby → Na kartě ukázat**.
- **Platí od:** aplikace 3.27.0

<!-- zdroj: app:16461aca, 85c1f704, abf7620f src/card-signals.ts ACTION_ORDER (waiting, conflict, question), presentActions (zapnuté v Na kartě ukázat), stackChoices (waiting, story, knows, agent), ACTION_GLYPH · src/card-signal-marks.ts cardActionMarksHtml (stoh n2/n3, tečky), stackAriaLabel, stackTipHtml (tipClickChoose / tipClickKnows), stackMenuItemsHtml (menuAnswer / dotyk menuWaiting, story.compare, menuKnows, menuAgent; bez značky výzkumu), placeStackMenu · index.html .card-signal-stack, #tree-canvas.zoom-far (src/zoom.ts ZOOM_FAR = 0.55; index.html:13732-13741 jedna tečka u všech Detailů karet, e2e/card-signals.spec.ts:353), body.view-mode-print bez značek, compact dvě tečky · strings.ts card.stackLabel, stackWaiting, stackMenuLabel, tipClickChoose, cardDensity.cardWaiting, cardConflict, cardQuestion, compact · CHANGELOG.cs.md 3.27.0 „Více značek na kartě“ · dirigent:prace/1111-app-karta-vice-znacek -->

<a id="S4.5"></a>
## S4.5 Akce, které otevřou výzkum

Většina akcí výzkumu v aplikaci je odkaz `strom-research://`. Odkaz otevře terminál výzkumu na tomtéž počítači.
Terminál řekne, co aplikace žádá, a zeptá se. Bez potvrzení v terminálu se nic nezapíše ani nezaplatí.

- **Hranice:**
  - Akce je vidět jen na počítači (ne na dotykovém zařízení), jen když výzkum odkaz ohlásil a jen když je zapnuté
    **Strom Research na tomto počítači**.
  - Odkaz nese jen čísla záznamů a pevné hodnoty, žádná jména ani volný text.
  - Terminál začne **Aplikace Strom žádá: … / Výzkum: …** a zeptá se **Pokračovat?** U práce agenta
    připíše **Agent pracuje na předplatné nebo kredit AI.**, u zadání úkolů **Výzkum zapíše úkoly pro agenta – teď
    se nic nehledá a nic se neplatí.**
  - Archiv Stromu a výzkum, který čeká na agenta, práci agenta odmítnou (rozhovor, prověření, hledání, místa, dějiny).
  - Když stejná aktivní linie už je, **Hledat předky** jen řekne **Taková linie výzkumu už je: „…“ – agent v ní
    pokračuje.**
  - Aplikace nepozná, jestli se terminál otevřel. Ukáže **Otevírám výzkum…** a radu **Když se nic neotevře, je potřeba
    spustit Strom Research a zkusit to znovu.**
- **Ovládání:** aplikace: **Nastavení → Data a soukromí → Strom Research na tomto počítači**.
- **Platí od:** aplikace 3.4.0 (výzkum 1.6.0). Odmítnutí v Archivu Stromu od výzkumu 1.14.0, při čekání na agenta od
  1.15.0.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts researchLinkAvailable, launchResearchLink, :841 onComputer · strings.ts research.linksSetting, research.openingQuietHint · index.html linksSetting · research:v1.25.2 src/commands/links.ts:128 refusedHere, :153 inTerminal, :351 ui.research.exists · src/core/links.ts (hlavička) · assets/lang/cs.json ui.link.asks, ui.link.go, ui.link.cost, ui.link.tasks, ui.archive.refuse, ui.waiting.refuse -->

<a id="S4.5.1"></a>
### S4.5.1 Značky akcí

Každá akce výzkumu má jednu ze tří značek podle toho, co otevře.

| Značka | Co se stane | Akce |
|---|---|---|
| bez značky | nic neotevře terminál | **Sledovat živě**, výřez a originál v prohlížeči, načtení stromu |
| terminál | terminál ukáže nebo se zeptá; kliknutím se nic neplatí | **Otevřít výzkum**, poslání úprav, **Prověřit znovu…**, **Hledat předky**, **Odložit**, **Vzdát**, akce linie, **Dokončit a skončit**, **Vrátit poslední poslání**, nastavení, **Kontrola výzkumu** |
| AI a terminál | práce agenta, platí ji předplatné AI | **Pokračovat s agentem**, **Zeptat se agenta**, **Pracovat na této linii**, rozhovor k úkolu nebo rozporu, výzkum míst, dějiny místa |

- **Hranice:** u práce agenta aplikace při otevírání ukáže **Otevírám agenta…** a **Dotazy se zadávají agentovi.
  Práce agenta čerpá předplatné AI.** Rozhovor může místo terminálu otevřít aplikaci agenta, když je tak výzkum
  nastavený.
- **Platí od:** aplikace 3.21.0

<!-- zdroj: app:v3.21.2 src/research-link.ts:66 RESEARCH_LINK_MARKS, researchLinkMark (task do=chat, conflict do=agent, experiment do=off, fixes paid) · strings.ts research.openingAgent, research.openingAgentHint · research:v1.25.2 src/commands/links.ts:373 whereToTalk -->

<a id="S4.5.2"></a>
### S4.5.2 Kde akce jsou

- **Menu Výzkum** (jen na počítači, ne u zamčeného stromu): nahoře nejvýš 6 položek: **Čeká na vyřízení**,
  **Pokračovat s agentem**, **Přehled výzkumu** nebo **Sledovat živě**, **Otevřít výzkum**, poslání úprav. Pod tím
  **Načíst novou verzi**, **Nástroje výzkumu**, **Vrátit poslední poslání** (nejvýš 7 dní staré) a nastavení
  výzkumu. Dole stojí **pokračuje ve výzkumu na tomto počítači. Nic se nezapíše ani nezaplatí bez potvrzení tam.**
- **Nástroje výzkumu**: skupiny **Podívat se**, **Zadat práci**, **Spustit agenta**. V 3.21.2 je v nich jen
  **Kontrola výzkumu**.
- Menu osoby **Výzkum ›** (jen u osoby, kterou výzkum zná): **Prověřit znovu…** (okno s rozsahem: jen osoba, s
  rodinou,
  s předky; **Pokračuje v terminálu výzkumu, kde jsou úkoly vidět a potvrzují se. Zdarma.**), **Hledat předky**,
  **Hledat potomky**, **Zeptat se agenta**.
- **Přehled výzkumu → Teď**: u pracujícího agenta **Dokončit a skončit** ([R7.3](R7-when-the-agent-works.md#R7.3)).
- V Archivu Stromu chybí vše, co potřebuje agenta, i **Sledovat živě**.
- **Platí od:** aplikace 3.4.0; horních 6 položek od 3.14.0, **Nástroje výzkumu** od 3.19.0, **Dokončit a skončit** od
  3.5.0

<!-- zdroj: app:v3.21.2 src/ui/research-actions-ui.ts:152 UNDO_MAX_AGE_MS, :158 FIRST_LEVEL_MAX, :300 researchMenuShown, :435 tools, :1000 personResearchActions · src/research-link.ts:115 RESEARCH_TOOL_GROUPS, :132 RESEARCH_TOOL_ACTIONS · research-overview-ui.ts:811, :870 finishSession · strings.ts research.footerFull, research.tools.*, research.reviewWhere, research.continueAgent -->

<a id="S4.5.3"></a>
### S4.5.3 Otevřít úkol ve frontě

**Otevřít úkol T…** otevře úkol ve frontě v terminálu výzkumu. Terminál úkol ukáže a zeptá se, co s ním teď.

- **Hranice:**
  - terminál ukáže **Úkol T… je ve frontě: agent ho vezme, až na něj přijde řada.**, **Proč: …** a **Hotovo, když:
    …** a zeptá se **Co teď?**:
    - **Projít ho s agentem (…) teď, v rozhovoru**: nejdřív se zeptá a řekne, co podobná sezení tady stála, nebo že
      to zatím není známo;
    - **Dát ho ve frontě dopředu (nejvyšší priorita)**: priorita 5; má-li ji úkol už, nic se nestane;
    - **Nechat ho ve frontě, jak je**;
  - Enter nebo 0 nic nezapíše. Na úkolu, na kterém právě pracuje agent, se nic nestane;
  - úkol, který čeká na člověka, otevře svou dosavadní otázku.
- **Ovládání:** aplikace: **Otevřít úkol T…** (značka terminál) po založení úkolu z nového čtení a v řádku u pramene
  ([R8.8.3](R8-reading-scans.md#R8.8.3)). Terminál: `strom chat --task T…` vezme úkol z fronty rovnou do rozhovoru.
- **Platí od:** výzkum 1.29.0, aplikace 3.25.0

<!-- zdroj: research:c2a690ea src/cli/menu-links.ts (odkaz task bez do, úkol open) · assets/lang/cs.json ui.link.open.title/why/done/pick/chat/ahead/keep/already/kept/busy/estimate/estimate.none, ui.chat.task.open.say · strom help chat (--task: „a task in the queue (open): gone through now, taken up in the conversation“) · commit 9bd14e84 · test/cli/link-open-task.test.ts · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 7; klik v aplikaci neověřen) · app:6bd8609e strings.ts read.openTaskN, src/__tests__/read-source-state-view.test.ts:75 (researchLinkMark task) -->

<a id="S4.6"></a>
## S4.6 Co je jen v terminálu

Aplikace ukazuje a žádá, rozhoduje terminál. Co potřebuje souhlas člověka nebo stojí peníze, se vždy potvrzuje
v terminálu výzkumu, i když to začne kliknutím v aplikaci.

- **Hranice:**
  - Jen v terminálu: spuštění samostatné práce agenta a její meze ([R7.1](R7-when-the-agent-works.md#R7.1)),
    podmínka, volba agenta, nastavení fronty a položky **Jen tady v terminálu**
    ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
  - Potvrzují se v terminálu: vše se značkou terminál nebo AI ([S4.5.1](#S4.5.1)), v 3.21.2 i akce linií a fronty.
  - Na telefonu odkazy nejsou; odpovídá se ve výzkumu na počítači ([S5](S5-phone.md)).
- **Platí od:** aplikace 3.4.0 (výzkum 1.6.0)
- **Od aplikace 3.22.0:** s výzkumem 1.26.0 jdou bez terminálu linie ([S4.3.1](#S4.3.1)), práce mimo linie po
  větvích
  ([S4.3.2](#S4.3.2)) a místo úkolu ve frontě ([S4.2](#S4.2)).

<!-- zdroj: research:v1.25.2 src/core/links.ts (hlavička: nic se nezapíše bez slova člověka v terminálu) · src/core/live.ts (hlavička mostu) · app:v3.21.2 src/research-link.ts:66 · HEAD src/research-directions-write.ts -->
