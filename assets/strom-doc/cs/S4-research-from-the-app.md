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
- **Od aplikace 3.28.0:** na počítači jde Přehled otevřít i v samostatném okně ([S4.1.6](#S4.1.6)). Od aplikace
  3.30.0 má malý panel vedle tohoto okna jen hlavičku a **Pracuje se**.
- **Od aplikace 3.28.0:** malý panel si na tomto zařízení pamatuje, zda je sbalený: jedna volba pro všechny
  výzkumy, výchozí rozbaleno. Převezme ji obnovení stránky, nové sledování i panel jiného výzkumu; zapíše ji jen
  šipka panelu. Otevřený Přehled už panel za sebou nerozbalí. Telefon volbu nečte ani nepíše (pruh otevírá Přehled
  jako dřív). Bez úložiště prohlížeče (soukromé okno) platí do zavření stránky.
- **Od aplikace 3.31.0:** na telefonu drženém na šířku se rozbalený panel sledovaného výzkumu sbalí do proužku, když
  se objeví ukazatel načítání fotek **Fotky k / n**
  ([S1.4.1](S1-connecting-app-and-research.md#S1.4.1)) nebo oznámení (ne pilulka **Zpět** ani potvrzení zaměření).
  Sám se znovu nerozbalí, ani když ukazatel nebo oznámení zmizí; rozbalí ho ťuknutí na hlavičku. Sbalení se
  nepamatuje jako volba zařízení. Na počítači, tabletu a telefonu na výšku se nic nemění.
- **Od aplikace 3.31.0 s výzkumem 1.36.0:** **Pracuje se** a **Teď** ukazují i agenta, který pracuje přímo ve
  výzkumu („Claude Code – práce přímo“). U práce, která drží úkol ([R7.9](R7-when-the-agent-works.md#R7.9)), stojí
  „naposledy 14:31; uvolní se nejpozději v 15:01“ (naposledy jen, když se liší od začátku; u procesu na tomto
  počítači bez času uvolnění). Běh, který čeká na omezený archiv ([R9.13](R9-archives.md#R9.13)), má stav
  „Pozastaveno · čeká na archiv … (nejdéle do 14:40)“. Se starším výzkumem je všechno jako dřív.
- **Od aplikace 3.31.0 s výzkumem 1.36.0:** při více bězích má **Teď** blok pro každý běh, každý se sleduje
  a zastavuje zvlášť ([S4.1.8](#S4.1.8)).

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:223 PANEL_CHANGES, (3.28.0: app 8da3f11e MINI_OPEN_KEY strom-research-mini-open, miniPanelFolded, rememberMiniPanelFolded, ne na telefonu; otevřený Přehled panel nerozbalí), :227 AUTO_FOLD, :3326 appendQueueSection(…, 3), renderLivePanel, renderIdleResearchPanel · src/ui/research-overview-ui.ts:5 (≥1280), :51 FOLDED_BY_DEFAULT, :53 GROUP_MS, :59 MAX_STEPS, :74, :309-311 · strings.ts live.overviewTitle, research.panelLabel, research.stop, research.atWork, research.queue · 3.27.0 Teď: app 4e4f6d8c src/research-link.ts WORKING_HELPS_FEATURE (working.helps), sanitizeWorking (helps jen s linií, branch) · src/ui/research-offline-ui.ts workingWhyText (helps → qWhyHelps + qWhyHow / qWhyHowBranch; větev mimo linie → qWhyOutBranch, ve skupině qWhyHowBranch) · src/ui/research-overview-ui.ts (Teď: důvod místo názvu linie) · strings.ts live.qWhyHelps, qWhyHow.*, qWhyHowBranch, qWhyOutBranch · spec 036 K1.8 · malý panel: app 2c018779 src/ui/research-ui.ts, research-directions-ui.ts (pod nadpisem linie jen jak) · 3.27.0 spec 057: app f05fff8e src/ui/research-actions-ui.ts overviewRows (research-item-overview první; stop při sledování, jinak followLive, ne bez agenta), src/ui/tree-actions.ts researchOverview · 8d564b35 src/ui/tree-overview.ts treeOverviewResearchLinkHtml (live.researchLink v záhlaví focus) · 28bbebeb src/ui/live-section-prefs.ts TOP_DEFAULTS (month.price false), research-overview-ui.ts appendOverviewSummary, strings.ts live.spendSessions, spendAmount · 87a6ea88 live.dirWorkedOn · strings.ts live.openOverview · 3.31.0: app 7be40d24 src/ui/landscape-panel-fold.ts (MQ_PHONE_LANDSCAPE, jen rozbalený panel, images nebo toast message, nerozbalí se sám, nepamatuje se) · SPEC.md 1120-app-108-diry · spec 116 · 3.31.0 spec 127: app:f89b5166, 040e42e6 src/research-holds.ts workingHoldText, waitsText, src/ui/research-ui.ts pausedText (statePaused · waitsArchive), workingHoldEl, src/ui/research-overview-ui.ts:921, src/research-link.ts features task.holds, archive.holds · strings.ts live.holdLast, holdFreeBy, waitsArchive · research cs.json who.agent -->

<a id="S4.1.1"></a>
### S4.1.1 Sledovat agenta ve stromu

Strom může sám přecházet na osobu, na které agent právě pracuje (první nepozastavená práce v oddílu **Teď**).

- **Hranice:** nejvýš jeden přechod za 8 s. Když je strom oddálený víc než na 0,55, přiblíží se na 0,8. Posun stromu,
  výběr jiné osoby nebo jiný pohled sledování přeruší (**Zpět k agentovi**); po 20 s bez dotyku se vrátí samo. Volba
  se pamatuje pro zařízení.
- **Ovládání:** aplikace: **Přehled výzkumu → Sledovat agenta ve stromu** / **Přestat sledovat**.
- **Platí od:** aplikace 3.5.0
- **Od aplikace 3.24.0:** sledovat jde i ve vějíři a na mapě ([S4.1.3](#S4.1.3)); posun mapy ji pozastaví stejně.
- **Od aplikace 3.30.0:** ◎ **Přestat sledovat** zastaví skoky jen v okně, kde se klikne; další okna sledují dál,
  každé ve svém pohledu ([S4.1.7](#S4.1.7)).
- **Od aplikace 3.30.0:** oblouk kolem portrétu osoby, na které agent pracuje, je vidět i vedle značek výzkumu na
  kartičce ([S4.4.1](#S4.4.1)).

<!-- zdroj: app:src/ui/live-follow-ui.ts:7, :26 ZOOM_FAR, :27 ZOOM_READABLE, :32 gap 8000 / idle 20_000 · strings.ts live.followOn, live.followOff · 3.30.0: spec 097 O1, O3, ZADANI_DEV §6 (◎ v hlavním okně další okna nevypne) · oblouk vedle značek: app:16cba085 src/card-signals.ts showAgent -->

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
- **Od aplikace 3.30.0:** **Sledovat agenta v** platí jen pro hlavní okno; další okna sledují v pohledu, který
  ukazují ([S4.1.7](#S4.1.7)). Na počítači s myší (okno širší než 640 px) to říká nápověda v Nastavení: „Platí pro
  hlavní okno při zapnutí sledování a při Zpět k agentovi. Další okna sledují ve svém pohledu.“

<!-- zdroj: app:src/ui/live-follow-ui.ts (hlavička, followIn) · src/live-follow-prefs.ts · src/live-follow-targets.ts TRAIL_MAX=8, TRAIL_MAX_AGE_MS=60 min, fanCenter, sessionNumbers, sessionTone · src/live-follow-map.ts · src/fan-follow-anchor.ts MAX_UP=12 · src/ui/fan-follow-ui.ts · src/ui/map-follow-ui.ts PAN_MARGIN=64, PAN_MS=400, telefon bez čáry · strings.ts settings.groupResearchFollow, researchFollowNote, followView(Help), followFanCenter*, followTrail(Help); live.followIn, mapPaused, legendTitle, legendTrail, legendRecord, legendPerson, legendOut; fan.pin, unpin, centerLabel, workOutside; map workRecord, workPerson, outScope, noCoords, noPlace, locate · CHANGELOG.cs.md 3.24.0, 3.25.0 · spec 043 · 3.30.0: app:e7e79873 src/ui/live-section-edit-ui.ts (isMouseWide → settings.followViewHelpWindows) · src/breakpoints.ts MQ_MOUSE_WIDE · spec 097 O5, ZADANI_DEV §8 -->

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
- **Od aplikace 3.28.0:** když most odpovídá, mění **⋯** u úkolu ve **Frontě** jeho místo jako při sledování:
  **Udělat jako další** s **Vrátit** ([S4.2.2](#S4.2.2)), a kde je výzkum nabízí, **Na konec** a **Vrátit výchozí**
  ([S4.2](#S4.2)). Totéž ve výsledcích hledání ([S4.2.1](#S4.2.1)) a v okně Přehledu ([S4.1.6](#S4.1.6)), kde to
  provede hlavní okno. Zapíše to most výzkumu; sledování nezačne, strom se nepřepne a dá se dál upravovat. Fronta se
  hned potom načte z výzkumu, nečeká na pravidelný dotaz. Bez mostu (Přehled ze stromu, telefon) se nic nemění.
  Stejně se Přehled bez sledování zeptá mostu na stav hned po každém zápisu přes most: v **Čeká na vyřízení**
  odpověď, **Přidat soubor**, **Odesláno** a **Vrátit mezi k vyřízení**, odpověď k otázkám k místům a k rostoucí větvi;
  v **Linie** založení, úprava, přesun, pozastavení, ukončení a obnovení linie; rozhodnutí rozporu, vrácení hodnoty
  a ověření nebo potvrzení údaje přes most. Okno Přehledu ([S4.1.6](#S4.1.6)) dostane nový stav od hlavního okna,
  které zápis provede.
- **Od aplikace 3.28.0:** Přehled bez sledování zavře ⤡ i ×; panel výzkumu, který byl vidět vedle něj, se po
  zavření Přehledu ukáže znovu. **Ukončit sledování** v otevřeném Přehledu jen ukončí sledování a Přehled zůstane
  otevřený bez sledování; konec, který udělá aplikace sama (například přepnutí do archivu), ho zavře. Přepnutí na
  jiný pohled zavře Přehled bez sledování jako ⤡; Přehled sledovaného výzkumu zůstane.

<!-- zdroj: app:f05fff8e, 48573de6 src/ui/research-overview-ui.ts renderResearchOverview (source live | bridge | tree; fromTree vynechá working, changes, queue), appendOverviewStateOff (notRunning, turnOn / researchLiveStartHow; telefon phoneTreeOnly, phoneWhy), overviewFollowStrip (activeResearchAgentless → bez pruhu; agentStarted, followNote), appendOverviewWaitingAsOf (asOf), appendOverviewSkeletonLines, appendOverviewFoot (missingLink) · src/research-overview-source.ts BRIDGE_ONLY_SECTIONS, afterTurnOnKeys, skeletonLines (_STROM_DIRECTION, místa osob) · src/research-device.ts WAITING_MAX_AGE_MS = 7 dní · src/ui/research-ui.ts OverviewViewing (refreshedAt, agentStarted, waitingAt) · src/ui/tree-actions.ts researchOverview · 8d564b35 src/ui/tree-overview.ts treeOverviewResearchLinkHtml (sekce focus, bez osob v záhlaví) · strings.ts live.followNote, agentStarted, notRunning, turnOn, afterTurnOn, refreshedAgo, asOf, phoneTreeOnly, phoneWhy, researchLink, missingLink, treeOverview focus · CHANGELOG.cs.md 3.27.0 · spec 057 K1.8–K1.12 · 3.28.0: app:bb6c0d07 src/ui/research-ui.ts researchSession (sledovaný, jinak prohlížený přes most), openLiveTaskMenu, researchStatusAfterWrite / statusAfterWriteWay (bez sledování hned askResearchBridge, jen počítač), src/ui/research-offline-ui.ts taskMenuOrders (queue.next; queue.own last, default), changeTaskOrder, writeTaskOrder · CHANGELOG.cs.md 3.28.0 (c04a7199) · spec 052 K5.1, K5.6; spec 057 §7 · prace/1113-app-jako-dalsi-bez-sledovani · app:3c751bea src/ui/research-ui.ts researchStatusAfterWrite (Čeká: sent, unsent, odpověď, soubor; linie; větev), researchViewedStatusAfterWrite, viewedWriteSession (jen prohlížený přes most, ne sledovaný, ne ze stromu) · research-waiting-write-ui.ts, research-directions-ui.ts, direction-form-ui.ts, research-offline-ui.ts, research-sync-ui.ts, verify-ui.ts, waiting-places-ui.ts · e2e/overview-write-unfollowed.spec.ts (do 3 s, okno bez dotazu na most) · strings.ts live.waitingWrite.sent, unsent, file · spec 083 · prace/1113-app-hledani-v-prehledu bod 2 · od 3.28.0 zavření a Ukončit sledování: app commit 3f2e19f8 (panel výzkumu skrytý pod Přehledem bez sledování, Ukončit sledování nechá Přehled otevřený, jiný pohled ho zavře) -->

<a id="S4.1.6"></a>
### S4.1.6 Přehled výzkumu v samostatném okně

Na počítači jde **Přehled výzkumu** otevřít v samostatném okně, třeba na druhém monitoru. Okno jen ukazuje: stav
výzkumu mu posílá hlavní okno a co se v okně udělá, provede hlavní okno. S mostem výzkumu okno nemluví.

- **Kde to jde:** u stromu z výzkumu, se sledováním i bez něj ([S4.1.5](#S4.1.5)), za stejných podmínek jako pohled
  v okně ([A6.8](A6-views.md#A6.8)): počítač, okno širší než 640 px.
- **Rozvržení:** souhrn přes celou šířku, pod ním oddíly ve sloupcích podle šířky okna:
  - pod 1100 px jeden sloupec jako Přehled v hlavním okně, od 1100 px dva, od 1600 px tři. Na méně sloupců se okno
    vrátí až 24 px pod hranicí, aby tažení okraje neblikalo;
  - sloupec je nejvýš 660 px široký, sloupce stojí uprostřed a každý se posouvá sám;
  - oddíly jdou v pořadí Přehledu (**Upravit panel**, [S4.1.2](#S4.1.2)) a dělí se do sloupců za sebou tak, aby
    nejvyšší sloupec byl co nejnižší. Tři sloupce, z nichž by jeden měl méně než pětinu výšky, jsou dva;
  - rozdělení se mění při změně počtu sloupců, při sbalení, rozbalení, skrytí nebo přesunu oddílu a po **Načíst
    další** ve **Frontě**; nová data z výzkumu ani psaní ho nemění;
  - dlouhý oddíl (s polem hledání nebo s víc než 8 řádky) má ve sloupci lepkavou hlavu: nadpis, pole hledání, čipy
    a počet nalezených zůstanou nahoře, řádky se posouvají pod nimi;
  - při změně šířky přes hranici zůstane rozepsané hledání, kurzor i oddíl, který byl na očích;
  - volby oddílů ([S4.1.2](#S4.1.2)) platí i v okně.
- **Hlavička okna:** „{strom} · Přehled výzkumu“, pod tím jméno výzkumu, vpravo podle stavu **Sledovat živě** nebo
  ukončení sledování a ⋯. Bez ⤡, × a **Sledovat v**.
- **Akce:** ukázání osoby ve stromu, odpověď v **Čeká na vyřízení**, správa linií, místo úkolu ve frontě, hledání ve
  **Frontě** ([S4.2.1](#S4.2.1)), **Sledovat živě** a jeho ukončení, **Zapnout** a v oddílu **Ověřování** **Zastavit**
  a **Ověřit údaje ve stromu…** ([S7.5](S7-reliability-and-verification.md#S7.5)) provede hlavní okno. Hledání
  i stránky fronty čte hlavní okno ze svého mostu a výsledek pošle oknu. Po akci, jejíž výsledek je vidět v hlavním
  okně (třeba ukázání ve stromu nebo dialog **Ověřit údaje ve stromu**, který se otevře v hlavním okně), okno požádá
  o přenesení hlavního okna do popředí; po **Zastavit** ne. Hledání v **Čeká na vyřízení** a **Co ví výzkum**
  ([S4.4.2](#S4.4.2), [S3.7.1](S3-what-the-research-knows.md#S3.7.1)) filtruje okno samo.
- **Zvýraznění:** co strom v hlavním okně právě zvýrazňuje, ukáže okno rozsvícením tlačítka té skupiny:
  **Ukázat ve stromu** u linie v **Teď** a v **Linie**, počet nalezených osob linie a **Ukázat změněné ve stromu**
  v **Průběhu**. Po ukončení zvýraznění nebo zavření hlavního okna nesvítí nic. Když filtr **Průběhu** změněné osoby
  zvýrazní znovu, hlavní okno se do popředí nepřenáší; filtr bez osob zvýraznění v hlavním okně ukončí.
- **Stavy okna:**

| Stav | Co okno ukáže |
|---|---|
| sleduje se živě | totéž co Přehled při sledování |
| nesleduje se, most odpovídá | totéž co Přehled bez sledování ([S4.1.5](#S4.1.5)) s pruhem **Sledovat živě** |
| výzkum neběží | „Výzkum neběží · ukazuje se, co je ve stromu“ s **Zapnout**; **Čeká na vyřízení** z paměti se „stav k …“ |
| hlavní okno přepnulo na strom bez výzkumu | „Strom nemá výzkum“, „Hlavní okno přepnulo na strom {strom}, který výzkum nemá.“ a **Zavřít okno**; po návratu na strom s výzkumem se okno obnoví samo |
| hlavní okno je zavřené | pruh „Hlavní okno je zavřené · stav k {čas}, jen ke čtení“, poslední stav, akce zašedlé; **Otevřít Strom** ([A6.8.2](A6-views.md#A6.8.2)) |
| strom smazaný nebo zamčený | jako pohled v okně ([A6.8.2](A6-views.md#A6.8.2)) |

- **Hranice:** dokud je okno Přehledu otevřené, hlavní okno svůj Přehled nekreslí; otevřený se po otevření okna
  zavře. Malý panel výzkumu zůstává. **⤢ Otevřít přehled**, **Výzkum → Přehled výzkumu** i položka v nabídce ⧉ pak
  jen přenesou okno Přehledu do popředí („Přehled výzkumu je v samostatném okně · klik ho přenese do popředí“). Po
  zavření okna je vše jako dřív.
- **Od aplikace 3.30.0:** dokud je okno Přehledu otevřené, malý panel v hlavním okně na počítači (okno širší než
  1024 px) ukazuje jen hlavičku a **Pracuje se**. **Čeká na vyřízení**, **Poslední změny** a **Na řadě** jsou v okně
  Přehledu.
  - **Pracuje se** je vždy rozbalené, i když je v **Upravit panel** ([S4.1.2](#S4.1.2)) sbalené nebo skryté; volba
    se drží a platí zase po zavření okna. Když agent nepracuje, stojí tam „Teď se nepracuje“;
  - štítek **Čeká N** v hlavičce, štítky čekajících položek a nových změn ve shrnutí sbaleného panelu a „Všechny
    sekce jsou skryté.“ tehdy nejsou. Pruhy pod hlavičkou (třeba **Sledovat v**) a počet sezení pod panelem
    zůstávají;
  - panel se sám nesbaluje; když se **Pracuje se** nevejde, posouvá se;
  - po zavření okna Přehledu je panel celý a oddíly sbalené a rozbalené jako předtím. Při zúžení okna na 1024 px
    a méně je panel celý, po rozšíření zase jen **Pracuje se**;
  - **⤢** v panelu přenese okno Přehledu do popředí;
  - telefon, tablet, ukončené sledování a panel bez sledování jsou beze změny.
- **Ovládání:** aplikace: ⧉ v hlavičce Přehledu (mezi ⋯ a ⤡); ⧉ **Otevřít v novém okně** vedle přepínače pohledů →
  **Přehled výzkumu**.
- **Platí od:** aplikace 3.28.0; 3.30.0: malý panel vedle okna jen s **Pracuje se**

<!-- zdroj: app:4b1373a7 src/windows/overview-window.ts (research-state bez adresy a tokenu mostu, OVERVIEW_ACTION_IDS, OVERVIEW_ACTIONS_TO_MAIN, 6g) · src/windows/overview-main.ts · src/ui/research-overview-ui.ts OVERVIEW_WINDOW_COLS_MIN 1100, WINDOW_LEFT (working, waiting, directions), overviewMode 'window', overviewWindowButton (jen canOpenWindows, ne sheet), canOpenResearchOverview · index.html html.window-overview (bez ⤡, ×, ⧉, Follow in) · src/windows/window-controls.ts renderMenu (overview: focusOverviewWindow / openInNewWindow) · strings.ts win.overviewHead, overviewOffNote, noResearch, noResearchNote, overviewInWindow, mainClosed · CHANGELOG.cs.md 3.28.0 · spec 079 P3 (K3), ZADANI_DEV §6 · prace/1113-app-okna-prehled (8a7575f0..4387a662) · app:3c2fde77 src/ui/overview-window-view.ts readQueuePage přes akci queue-list do hlavního okna (okno most nevolá) · app:3f9a5ca4 overview-window-view.ts treeVerifyNow (extras.verify), verifyStop → verify-stop, showVerifyBulkDialog → verify-bulk; evidenceHighlightNow (extras.highlight), endEvidenceHighlight → highlight-end, startPersonHighlight quiet · src/ui/research-ui.ts lightsGroup, markOverviewLit (is-lit, aria-current; nic při zavřeném hlavním okně) · research-overview-ui.ts lightsGroup direction (show-in-tree v Teď), changed (showChanged) · research-directions-ui.ts lightsGroup direction (dirShow), direction-found (dirFoundPersons) · strings.ts verify.section, bulkRow, stop, live.showInTree, dirShow, showChanged · spec 079 K3 · prace/1113-app-dorovnani-052-okna (2876d570..27f0bafb) · app:7f307c74 src/overview-columns.ts OVERVIEW_WINDOW_COLS_2 1100, OVERVIEW_WINDOW_COLS_3 1600, OVERVIEW_COLS_HYSTERESIS 24, OVERVIEW_SMALL_COLUMN 0.2, OVERVIEW_COLUMN_MAX 660, partitionContiguous, planOverviewColumns · src/ui/overview-columns-ui.ts (souhrn a pruhy nad sloupci, každý sloupec se posouvá sám, nové rozdělení jen při změně sloupců, sbalení, skrytí, přesunu, Načíst další; lepkavá hlava: pole nebo > 8 řádků; fokus, výběr v poli a oddíl na očích při změně šířky) · e2e/windows-overview-columns.spec.ts · CHANGELOG.cs.md 3.28.0 (e540e4b5) · spec 083 U3 · prace/1113-app-hledani-v-prehledu · 3.30.0: app:965e83f8 src/ui/live-panel-working-only.ts livePanelWorkingOnly (okno Přehledu, isDesktop > 1024 px, ne ukončené), livePanelDrawnSections (jen working), livePanelNothingAtWork · src/ui/research-ui.ts (třída working-only, bez štítků waiting a nových změn, bez samoskládání; overviewWindowOpenChanged, placeLivePanel při přechodu 1024 px; openResearchOverview → focusOverviewWindow) · strings.ts live.nothingAtWork · e2e/windows-overview-panel.spec.ts · CHANGELOG.cs.md 3.30.0 „Panel výzkumu vedle okna Přehledu“ · spec 079 U9 (rozhodnutí 27, 16. 11.) · dirigent:test/vysledek-1116-app-079-panel.md -->

<a id="S4.1.7"></a>
### S4.1.7 Sledovat agenta v dalších oknech

Při sledování výzkumu ([S1.4](S1-connecting-app-and-research.md#S1.4)) sleduje agenta i každé další okno stromu
([A6.8](A6-views.md#A6.8)), každé ve svém pohledu. Jedno okno jde odpojit a mezitím v něm prohlížet něco jiného;
ostatní okna sledují dál. Všechna okna jsou při tom jen ke čtení.

- **Kdy:** když hlavní okno sleduje výzkum živě. Připojí se každé další okno, i otevřené před zapnutím sledování (bez
  obnovení) nebo až během něj. Další okno se s mostem výzkumu nespojuje: stav agenta mu posílá hlavní okno, bez
  adresy mostu.
- **Pohled:** okno sleduje v pohledu, který právě ukazuje. **Sledovat agenta v** ([S4.1.3](#S4.1.3)) platí jen pro
  hlavní okno a **Zpět k agentovi** pohled dalšího okna nepřepne.
  - **Rodina**, **Vějíř**, **Mapa:** skok za agentem, značky, stopa a legenda jako v hlavním okně
    ([S4.1.1](#S4.1.1), [S4.1.3](#S4.1.3));
  - **Tabulka:** řádek agenta ([A6.7.18](A6-views.md#A6.7.18));
  - **Potomci**, **Časová osa:** bez skoků, pruh to říká. Posun v nich sledování nepozastaví. Po přepnutí na Rodinu,
    Vějíř nebo Mapu okno hned skočí na agenta.
- **Pruh pod hlavičkou okna** říká, jak okno sleduje (ikonou a textem). Poslední je vždy **Přejít do hlavního okna**.

| Stav okna | Pruh | Tlačítka |
|---|---|---|
| připojené | „Sleduje se agent · jen ke čtení“; v Potomcích a Časové ose „Sleduje se agent · v tomto pohledu bez skoků · jen ke čtení“ | **Odpojit toto okno** |
| připojené, agent nepracuje na nikom z tohoto stromu | „Agent teď nepracuje · jen ke čtení“ | **Odpojit toto okno** |
| pozastavené | „Sledování pozastaveno · jen ke čtení“ | **Zpět k agentovi**, **Odpojit toto okno** |
| odpojené | „Okno nesleduje agenta · jen ke čtení“ | **Sledovat agenta** |
| spojení s mostem přerušené | „Spojení s výzkumem je přerušené · zkouší se znovu“ (jantarově) | **Odpojit toto okno**, v odpojeném okně **Sledovat agenta** |

- **Pozastavení:** ruční posun, přiblížení nebo výběr osoby v okně (v Tabulce posun nebo klik do řádků) pozastaví
  sledování jen v tomto okně. Vrátí ho **Zpět k agentovi**, nebo samo po 20 s bez dotyku. Pauzu říká pruh; plovoucí
  štítek pauzy ani „Posun mapy pozastaven“ další okno nemá. Pauza v hlavním okně další okna neovlivní a pauza
  v dalším okně neovlivní hlavní ani jiná okna. Obnovení okna (F5) pauzu zruší.
- **Odpojení:** **Odpojit toto okno** zastaví skoky za agentem v tomto okně; okno jde volně procházet a zůstane jen
  ke čtení. Značky agenta (karta osoby, na které se pracuje, řádek agenta v Tabulce, značky a stopa ve Vějíři a na
  Mapě) v něm zůstanou. **Sledovat agenta** okno znovu připojí a hned skočí na agenta. Odpojení vydrží obnovení okna
  (F5) a zapomene se s koncem sledování.
- **Výběr z jiného okna:** připojené okno, které není pozastavené, osobu vybranou v jiném okně jen vyznačí, i když má
  **Vybraná osoba** → **Toto okno**: **přepnout** ([A6.8.1](A6-views.md#A6.8.1)); střed zůstane u agenta. Tabulka řádek té osoby
  vybere, ale neposune se k němu. Skok za agentem se ostatním oknům jako výběr osoby neposílá. Pozastavené a odpojené
  okno se řídí volbou **Toto okno** jako mimo sledování. Výběr poslaný do hlavního okna s volbou **zaměřit** hlavní okno
  při sledování agenta jen vyznačí ([A6.8.4](A6-views.md#A6.8.4)).
- **Konec:**
  - ◎ **Přestat sledovat** v hlavním okně zastaví skoky jen v hlavním okně; další okna sledují dál;
  - **Ukončit sledování** (panel výzkumu, nabídka **Výzkum**, nabídka osoby) i konec sezení ukončí sledování ve
    všech oknech: pruh zmizí, strom jde zase upravovat, odpojení se zapomene a každé další okno to ohlásí
    („Sledování výzkumu skončilo · strom jde upravovat“).
- **Zavření hlavního okna během sledování:** hlavním oknem se samo stane jedno z dalších oken a sledování pokračuje
  v něm.
  - Zavření se pozná podle 3 s bez zprávy od hlavního okna ([A6.8.2](A6-views.md#A6.8.2)). Obnovení hlavního okna
    (F5) nic z toho nespustí;
  - pořadí: nejdřív okna, která agenta sledují (připojená i pozastavená), pak odpojená; v každé skupině od
    nejstaršího okna. Okno Přehledu výzkumu ([S4.1.6](#S4.1.6)) hlavním nebude. Každé okno v pořadí čeká o 400 ms
    déle než předchozí a hlavním se stane jen jedno;
  - to okno ukáže „Hlavní okno se zavřelo · sledování pokračuje v tomto okně…“, načte se znovu jako hlavní se
    stejným pohledem a ◎ zapnutým, pokud byl zapnutý v zavřeném hlavním okně. Ostatní okna ohlásí „Sledování
    převzalo jiné okno“ a zůstanou, jak byla (odpojené zůstane odpojené);
  - když tento prohlížeč nemá uloženou adresu mostu výzkumu, hlavním se žádné okno nestane a okna ukážou
    „Sledování nejde obnovit · hlavní okno se zavřelo“ s **Udělat hlavním** a **Otevřít Strom**
    ([A6.8.2](A6-views.md#A6.8.2));
  - bez sledování platí [A6.8.2](A6-views.md#A6.8.2) beze změny.
- **Hranice:** další okna jsou jen na počítači ([A6.8](A6-views.md#A6.8)); telefon a tablet jsou beze změny. Hlavní
  okno neukazuje, kolik oken sleduje.
- **Ovládání:** aplikace: v pruhu dalšího okna **Odpojit toto okno**, **Sledovat agenta**, **Zpět k agentovi**,
  **Přejít do hlavního okna**; v hlavním okně ◎ **Přestat sledovat** a **Ukončit sledování**.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:9cec9c30 (od 3714c539) src/windows/agent-follow-state.ts AgentFollow attached/paused/detached, agentFollowKey (sessionStorage jen detached), setLive (konec sezení zapomene odpojení), detach, attach, setPaused · src/windows/agent-state.ts, agent-mirror.ts, src/ui/agent-window-ui.ts (stav agenta z hlavního okna bez adresy a tokenu mostu, K1.3) · src/windows/sat-states.ts SatStrip, liveStrip (lost › paused › detached › idle › attachedNoJump › attached), STRIP_ICON, AMBER, writeStrip (tlačítka, goToMain poslední) · src/main.ts noJump (descendants, timeline) · src/ui/live-follow-ui.ts (další okno: pohled okna, Zpět pohled nepřepne, bez štítku pauzy ani mapPaused, pauza jen v okně, návrat po 20 s) · src/windows/window-selection.ts (připojené okno výběr jen vyznačí; skok agenta se nerozesílá) · src/windows/takeover.ts TAKEOVER_STEP_MS 400, takeoverOrder (sledující, pak odpojená; okno bez vlastního sledování ne), hasBridge (storedResearchBridge) · src/windows/become-main.ts, window-start.ts (◎ jako v zavřeném hlavním okně) · strings.ts win.agentAttached, agentAttachedNoJump, agentIdle, agentPaused, agentDetached, detach, attach, bridgeLost, followEnded, takingOver, takenOver, takeoverFailed, goToMain; live.followOff, followBack; research.stop · CHANGELOG.cs.md 3.30.0 „Sledování agenta ve všech oknech“ · spec 097 K1.1–K1.4, K2.1–K2.6, Rozhodnutí 16. 11. O1–O5, dotazy 3–5, 8 · app:docs/ZADANI_DEV_sledovani-ve-vsech-oknech.md §1–§4, §6, §7; ZADANI_UIX dotazy 10, 12 · prace/1116-app-097-sledovani-okna -->

<a id="S4.1.8"></a>
### S4.1.8 Teď s více běhy

S výzkumem, který běhy linií umí ([R7.10](R7-when-the-agent-works.md#R7.10)), ukazuje oddíl **Teď** v **Přehledu
výzkumu** jeden blok na každý běh: běh celé fronty i běh každé linie zvlášť. Každý běh jde sledovat a zastavit zvlášť.

- **Blok běhu:**
  - záhlaví: znak linie, její název a číslo (G…), u běhu celé fronty **Celá fronta**; vpravo stav: **pracuje**,
    **spouští se…**, **čeká na limit předplatného do 14:00**, **čeká na archiv do 14:40**, **čeká na prohlížeč
    archivu** („Prohlížeč archivu má teď jiný běh; tento počká, až se uvolní.“), **čeká na stahování**, **čeká do …**,
    **končí – agent dopisuje nalezené**, **skončil v 11:52**;
  - pod záhlavím agent, od kdy a jak dlouho, a poslední krok (osoba – úkol) jako dřív ([S4.1](#S4.1));
  - běh celé fronty, vedle kterého mají vlastní běh linie: „Přeskakuje: Předci Jana Horáka, Potomci Marie Vlkové“.
    Když dokončuje úkol linie, která mezitím dostala vlastní běh: „Dokončí T0103 linie …, pak ji přeskočí.“;
  - skončený běh zůstane v **Teď** 60 s se stavem **skončil v …**. Pod ním jen u konce limitem **Došel limit
    předplatného.** a u chyby **Agent skončil chybou; podrobnosti jsou v terminálu výzkumu.**; u běhu linie ještě
    **Linii zase bere celá fronta.** Pak blok zmizí. Nové otevření aplikace skončené bloky neukazuje.
- **Pořadí bloků:** běh celé fronty první, pak běhy linií v pořadí linií ([R2.1.4](R2-lines-and-queue.md#R2.1.4)).
  Nadpis oddílu je „Teď · 3 agenti“; souhrn **Stav** při dvou a více bězích „Pracují 3 agenti“ a případně „1 čeká na
  limit do 14:00“.
- **Akce bloku:**
  - **Ukázat ve stromu**: lidé linie, u běhu celé fronty osoba, na které agent pracuje;
  - **Sledovat tento běh** / **● Sleduje se**: jen při dvou a více bězích a zapnutém sledování;
  - **Zastavit** („Dokončí rozdělaný úkol a další nezačne“): přímo přes most, bez terminálu, u pracujícího nebo
    čekajícího běhu; během zápisu **Zastavuje se…**, při odmítnutí **Agenta se nepodařilo zastavit.** Význam jako
    `strom run stop` ([R7.10.2](R7-when-the-agent-works.md#R7.10.2));
  - **Dokončit a skončit**: otevře terminál výzkumu a požádá ten běh o dokončení a konec
    ([R7.3](R7-when-the-agent-works.md#R7.3)); u pracujícího běhu a běhu, který čeká na prohlížeč archivu nebo
    stahování. Běh, který čeká na limit nebo archiv, ho nemá;
  - končící běh má jen **Ukázat ve stromu**. Zastavení jednoho běhu ostatní nemění; zastavit všechny najednou nejde.
- **Sledování:** sleduje se jeden běh. Výchozí je první nepozastavený běh v pořadí **Teď**; nový běh sledování
  nepřepne. Když sledovaný skončí, sleduje se zase výchozí.
  - ve stromu je při dvou a více bězích pilulka **Sleduje se: Předci Jana Horáka ▾** s nabídkou **Sledovat běh**
    (číslo bloku a název, pod tím agent a osoba; čekající běh šedě se stavem; na konci **Přestat sledovat**);
  - lidé všech běhů jsou označení jako dřív ([S4.1.1](#S4.1.1)); sledovaný běh má první barvu sledování, ostatní
    druhou. Místo čísla sezení nesou štítek běhu: znak linie a číslo bloku v **Teď** („↑ 2“), běh celé fronty jen
    číslo;
  - další okna stromu ([S4.1.7](#S4.1.7)) sledují tentýž běh jako hlavní okno.
- **Telefon:** bloky a stavy stejné, bez **Zastavit**, **Dokončit a skončit** a volby sledovaného běhu; pilulka jen
  říká, který běh se sleduje, a označení jsou jen u lidí sledovaného běhu.
- **Hranice:** se starším výzkumem nebo s jediným během celé fronty je **Teď** jako dřív.
- **Ovládání:** aplikace: **Přehled výzkumu → Teď**; pilulka **Sleduje se:** ve stromu. Terminál:
  `strom run stop <run-…> [--finish]`.
- **Platí od:** aplikace 3.31.0 (výzkum 1.36.0)

<!-- zdroj: app:4de0835a src/research-runs.ts (run.lines, RUN_ENDED_MS 60 s, orderRuns obecný první a linie v pořadí, runCount, noteEndedRuns jen v paměti) · src/ui/research-overview-ui.ts vykreslení bloku (runStateWorking/Starting/Limit/Archive/Waiting/WaitingUntil/Browser/Download/Finishing/Ended, runBrowserNote, runSkips, runFinishesThen, runEndedText jen limit|error, runAfterStop), overviewRunActions (Ukázat ve stromu; Sledovat tento běh jen ≥ 2 běhy a sledování, ne telefon; Zastavit s run.stop u working|waiting, ne telefon; Dokončit a skončit finish?run= u working a čekání na prohlížeč nebo stahování) · src/ui/live-follow-ui.ts pilulka followRunPill, followRunMenu, followOff · strings.ts live.nowAgents, stateAgents, stateAgentsWaiting, runWhole, run*, followRun* · app:docs/ZADANI_DEV_beh-po-liniich.md §3, §4, §7, Kolo 2 C2 · dirigent:spec/126 K2.1, K2.2, K2.5, prace/1121-app-126-linie, 1122-app-126-kolo2 · research: /status runs[], runsEnded[] (POST runs/stop) -->

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
- **Od aplikace 3.28.0:** s výzkumem 1.32.0 jde ve **Frontě** hledat ([S4.2.1](#S4.2.1)), úkol dát jako další
  a vrátit ([S4.2.2](#S4.2.2)) a požádat o práci agenta na frontě ([S4.2.3](#S4.2.3)). Rozbalená **Fronta** má pak
  počet úkolů v nadpisu („Fronta · 1 240“) místo vpravo. Se starším výzkumem je Fronta jako dřív.
- **Od aplikace 3.31.0 s výzkumem 1.36.0:** úkol ve frontě, který drží jiné sezení, má poznámku „Úkol drží Claude
  Code (sezení N0040) od 14:05, naposledy 14:31; uvolní se nejpozději v 15:01.“ Úkol, jehož omezený archiv teď
  používá jiné sezení, má „Archiv … teď používá jiný výzkum (od 14:05, naposledy 14:31); uvolní se nejpozději
  v 15:01.“; místo „jiný výzkum“ může stát „sezení N0040“, „jiné sezení“ nebo „hromadné stahování“. Když na archiv
  déle čeká jiná práce: „Na archiv … déle čeká jiná práce; na řadě nejpozději v 15:01.“ Spustit úkol, který drží
  jiné sezení, výzkum odmítne ([R7.9](R7-when-the-agent-works.md#R7.9), [R9.13](R9-archives.md#R9.13)). Se starším
  výzkumem bez poznámek.
- **Od aplikace 3.31.0 s výzkumem 1.36.0:** úkoly linie s vlastním během ([R7.10](R7-when-the-agent-works.md#R7.10)),
  i úkoly, které jí pomáhají, nejsou bez filtru v číslované řadě. Místo nich stojí nad řadou jeden řádek na linii:
  znak, název linie, počet úkolů, „dělá je vlastní agent linie (Claude)“ a **Ukázat ›** (filtr linie). Počet ve
  **Frontě** a v čipu **Všechny linie** a pořadová čísla jsou jen úkoly pro běh celé fronty. Ve filtru takové linie
  jsou její úkoly očíslované v jejím pořadí a nad nimi „Na této linii pracuje vlastní agent (Claude, od 10:42). Celá
  fronta ji přeskakuje.“ Práce mimo linie, větve a dějiny zůstávají běhu celé fronty.
  Na telefonu je **Fronta** stejná.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts:308 queueNoteText, :3373 appendQueueSection · research-overview-ui.ts:311 (20) · strings.ts research.queue, research.park/drop/wake, research.queueMore, research.queueOffLast, research.queueOffNever, research.queueHelps · HEAD src/research-queue-pages.ts:19 QUEUE_PAGE, :28 QUEUE_ROWS_CAP · src/ui/research-ui.ts:3884 taskDoNext/taskDoLast · strings.ts live.taskDoing, live.queueLoadMore, live.queueCapNote, live.branchQueueChip, live.branchQueueChipClear · 3.27.0: app 2ee3718d (queue[].kind ze /status i ze stránek fronty, jiná hodnota zahozena) strings.ts live.queueKind · research 5f48cdaf src/core/queue.ts RUN_TURNS, runOrder (most /status queue[], GET /queue, menu před strom run), kind story|history · 3.28.0: app 4ad34832 src/ui/research-ui.ts appendQueueSection (counted: queueTitleCount místo summary, když je pole nebo akce záhlaví) · spec 052 · 3.31.0 spec 127: app:f89b5166 src/research-holds.ts heldByText, archiveHeldText, queueHoldText (linie vynechána), src/ui/research-ui.ts queueHoldNote · strings.ts live.heldByTask, archiveHeld, archiveHolderOther, archiveHolderFetch, archiveHolderOwn, archiveHolderSession, archiveHeldWaiting · app:docs/ZADANI_VYZKUM_rezervace.md Odpověď aplikace -->

<a id="S4.2.1"></a>
### S4.2.1 Hledání ve frontě

Ve **Frontě** v **Přehledu výzkumu** (i v jeho samostatném okně, [S4.1.6](#S4.1.6)) je pole **Hledat úkol, osobu,
archiv…**. Hledá výzkum v celé frontě, i za
načtenými stránkami; aplikace mu pošle jen hledaný text ([R2.2](R2-lines-and-queue.md#R2.2)).

- **Kdy pole je:** v rozbalené **Frontě**, s výzkumem, jehož most hledání umí a odpovídá, a jen když je ve frontě
  aspoň jeden úkol (i odložený). Se starším výzkumem pole není a Fronta je jako dřív.
- **Co se najde:**
  - číslo úkolu (`T0815`, `t815`, `815`): ten úkol jako první, pak úkoly, v jejichž textu to číslo je;
  - číslo osoby (`P12`): úkoly k té osobě;
  - jiný text: úkoly, které mají každé slovo v textu úkolu, ve jménech jeho osob, v knize, signatuře, archivu nebo
    místě, nebo v čísle úkolu či osoby; bez ohledu na velká písmena a diakritiku. Výsledky jsou v pořadí fronty.
- **Hranice:**
  - hledá se 300 ms po posledním napsaném znaku, posílá se nejvýš 100 znaků; prázdné pole vrátí frontu;
  - štítky linie a větve ([S4.2](#S4.2)) se s hledáním kombinují: výsledek jsou úkoly štítku, které odpovídají textu.
    Počty ve štítcích zůstávají počty fronty;
  - řádek výsledku je řádek fronty (místo ve frontě, text, **⋯**) se šedým číslem úkolu. Zvýrazněná je jen shoda čísla
    úkolu nebo osoby („P0108 Jan Horák“), shoda textu ne. Odložené úkoly jsou na konci s místem „–“ a štítkem
    **odloženo**;
  - nad výsledky stojí jejich počet („Nalezeno 12 úkolů“). Bez výsledku **Nic nenalezeno.** a **Zrušit hledání**,
    se štítkem linie i **Hledat ve všech liniích**;
  - číslo úkolu, který už ve frontě není: „T0815 už ve frontě není (hotovo)“, stav **hotovo**, **čeká na vyřízení**,
    **odloženo** nebo **vzdáno**;
  - víc než 50 výsledků: **Načíst další** po 50, nejvýš 300 řádků jako ve frontě;
  - most neodpovídá nebo je zaneprázdněný: **Hledání se nepovedlo, výzkum neodpovídá.** nebo **Výzkum je
    zaneprázdněný, hledat teď nejde.** a **Zkusit znovu**; text v poli zůstane;
  - když se fronta během hledání změní, výsledek se obnoví sám; text i kurzor v poli zůstanou;
  - hledání platí, dokud se nezruší (×, Escape v poli, **Zrušit hledání**) nebo dokud se nezavře Přehled. Hledaný text
    se nikam neukládá.
- **Ovládání:** aplikace: **Přehled výzkumu → Fronta**, pole hledání; v malém panelu pod **Na řadě** odkaz
  **Hledat ve frontě…**: otevře Přehled, rozbalí **Frontu** jen do jeho zavření (uložená volba oddílu se nemění) a dá
  kurzor do pole. Na telefonu, kde je z panelu pruh, odkaz není.
- **Platí od:** aplikace 3.28.0 (výzkum 1.32.0)

<!-- zdroj: app:4ad34832 (8a10387e) src/ui/queue-search-ui.ts QUEUE_SEARCH_PAUSE_MS 300, queueSearchOffered (queue.search, queuePaged, queue/queueMore/queueCounts next+parked), resetQueueSearch (zavření Přehledu), Escape · src/research-queue-pages.ts QUEUE_QUERY_MAX 100, QUEUE_PAGE 50, QUEUE_ROWS_CAP 300, QUEUE_ELSEWHERE_STATES · src/ui/research-ui.ts appendQueueSection (searchable jen v Přehledu, ne při sbalení), appendQueueSearchResult (štítek + q, queueSearchBusy/Err, dirRetry), řádek výsledku (live-queue-num „–“, research-queue__match id/person, queueTagDeferred), live-queue-search-link (canExpandLivePanel) · src/ui/research-overview-ui.ts openQueueSearch (unfoldOverviewSection queue do zavření) · strings.ts live.queueSearch*, queueState, queueTagDeferred, queueTitleCount, dirRetry · research 1.32.0 src/core/live.ts searchQueue (TASK_NUMBER, PERSON_NUMBER, každé slovo v jednom poli, pořadí fronty, elsewhere) · spec 052 K1.1–K1.7 · ZADANI_DEV_fronta-hledani §1, §2; D1 (bez řádku pole) · app:08268b9f strings.ts live.queueSearchInDir, queueSearchNoneDir, queueSearchAllDirs (linie) · app:3c2fde77 okno Přehledu (queue-list) · spec 052 K1.1 -->

<a id="S4.2.2"></a>
### S4.2.2 Udělat jako další a Vrátit

Úkol jde z aplikace poslat na řadu jako další, bez terminálu. Rozdělanou práci agent nepřeruší: úkol přijde na řadu
po ní ([R2.3.1](R2-lines-and-queue.md#R2.3.1)).

- **Hranice:**
  - **Udělat jako další** („Přijde na řadu po rozdělaném úkolu“) je první položka v **⋯** u úkolu ve **Frontě**, ve
    výsledcích hledání ([S4.2.1](#S4.2.1)) i v **Na řadě** malého panelu, bez značky. Stojí na místě **Udělat hned**;
    **Na konec** a **Vrátit výchozí** zůstávají u výzkumu, který je nabízí ([S4.2](#S4.2));
  - nenabízí se u úkolu, který už je první, na kterém agent pracuje, nebo který je odložený;
  - jde to se sledováním i bez něj: v **Přehledu výzkumu** otevřeném bez sledování ([S4.1.5](#S4.1.5)), když most
    výzkumu odpovídá; sledování nezačne a strom zůstane upravitelný. Fronta se po změně hned načte z výzkumu;
  - úkol se přesune na první místo, jeho řádek se krátce zvýrazní a u textu má štítek **jako další**, dokud nepřijde
    na řadu. Z více úkolů jako další je první naposledy označený; štítek mají všechny. Hledání zůstane;
  - bublina s číslem úkolu („T0103 jako další“) a **Vrátit** stojí 6 s. **Vrátit** dá úkol přesně na původní místo
    i s jeho původní volbou; řádek je na tom místě hned po odpovědi výzkumu, i v okně Přehledu ([S4.1.6](#S4.1.6));
  - když agent úkol mezitím vzal: **Na úkolu agent právě pracuje, jeho místo teď nejde změnit.** a fronta se
    obnoví. Když most neodpovídá: **Výzkum neodpovídá, pořadí se nezměnilo.** a **Zkusit znovu**;
  - nic se nepotvrzuje: nic se nespouští ani neplatí;
  - na telefonu je nabídka spodním listem jako ostatní listy aplikace (úchyt, ztmavené okno pod ním) s číslem
    a textem úkolu nahoře; klepnutí na ztmavené okno nebo Escape ho zavře.
- **Ovládání:** aplikace: u úkolu **⋯ → Udělat jako další**, v bublině **Vrátit**. Terminál: `strom task order T…
  --next`, `--restore` ([R2.3.1](R2-lines-and-queue.md#R2.3.1)).
- **Platí od:** aplikace 3.28.0 (výzkum 1.32.0)

<!-- zdroj: app:623d9c77 (8a10387e) src/ui/research-offline-ui.ts queueNextOffered (queue.next, most odpovídá), queueNextFor (state next, ne pozice 1, ne práce agenta), doTaskNext (toast queueMoved 6000 ms, queueUndo → restoreTaskPlace {do: restore, was}), taskOrderRefusedToast (taken → taskDoing, bridge → queueBridgeErr + dirRetry), QUEUE_FLASH_MS 1600 · src/ui/research-ui.ts openLiveTaskMenu (nextOn: queueNext místo taskDoNext; taskOrderOffered: last, default; list na telefonu ≤ 640 px s titulem), markQueueNextRow (queueTagNext) · strings.ts live.queueNext, queueNextHint, queueTagNext, queueMoved, queueUndo, queueBridgeErr, taskDoing · research 1.32.0 rankTasks (naposledy zvolený první) · spec 052 K5.1, K5.3, K5.4, K5.6 · ZADANI_DEV_fronta-hledani §4 · app:2876d570 placeQueueItemInLists (odpověď restore: pos, own, why), strings.ts live.queueMoved(id) · app:7dc924ee list ⋯ = bottom-sheet (úchyt, ztmavení, Escape) · app:3f9a5ca4 Vrátit v okně Přehledu · spec 052 K5.4 · app:bb6c0d07 bez sledování přes most (researchSession, taskMenuOrders, researchStatusAfterWrite) · spec 057 §7 -->

<a id="S4.2.3"></a>
### S4.2.3 Pracovat na frontě…

Z aplikace jde požádat o samostatnou práci agenta na frontě. Aplikace nic nespouští: otevře terminál výzkumu, ten
ukáže, co se pustí, a spustí to až na **ano** ([R7.1.2](R7-when-the-agent-works.md#R7.1.2)). Práce agenta čerpá
předplatné AI.

- **Kdy se nabízí:** s mostem, který odpovídá, u výzkumu, který odkaz na práci ohlásil, s agentem (ne v Archivu
  Stromu ani ve výzkumu, který čeká na agenta), jen tam, kde aplikace otevírá odkazy výzkumu ([S4.5](#S4.5)); ne na
  telefonu. Když agent pracuje nebo běží běh, akce není; v záhlaví **Fronty** je místo ní **● Pracuje se ›**, které
  rozbalí **Teď** a přejde na **Dokončit a skončit**.
- **V oddílu Teď:** když agent nepracuje a neběží žádný běh, nabízí **Pracovat na frontě…** se stejnou značkou,
  dialogem a podmínkami i oddíl **Teď** v **Přehledu výzkumu**, také v jeho samostatném okně. Když agent pracuje,
  zůstává v **Teď** jen **Dokončit a skončit**. Zavření dialogu vrátí fokus na tlačítko v **Teď**.
- **Dialog Pracovat na frontě:**
  - **Automaticky** (výchozí): „Agent bere úkol za úkolem, dokud to dovolí limit předplatného.“ Když výzkum hlásí,
    že brána předplatného (podmínka, [R7.4](R7-when-the-agent-works.md#R7.4)) není nastavená, stojí pod tím **Automatická práce
    potřebuje nastavenou bránu předplatného; terminál nabídne nastavení.** Volba zůstává;
  - **Jen 5 úkolů**: počet 1–100, výchozí 5. Práce skončí po tolika vyřízených úkolech; počítá se i úkol, který
    skončí čekáním, odložením nebo vzdáním. Jen s výzkumem, který to umí; jinak je jen **Automaticky**;
  - **Jako první přijde**: úkol označený jako další ([S4.2.2](#S4.2.2)), jinak první úkol fronty;
  - **Další (n)** pod úkolem **Jako první přijde** rozbalí další úkoly fronty v pořadí výzkumu: nejdřív úkol
    označený jako další, pak podle místa ve frontě; odložené úkoly a úkoly mimo linie, které se neberou, v něm
    nejsou. Nad nimi stojí **Podle pořadí ve frontě** a „Agent je nemusí vzít přesně v tomto pořadí.“ Řádek je
    číslo a text úkolu se štítkem **jako další** a druhem úkolu; s místy ve frontě jsou řádky číslované „2.“, „3.“.
    Pod nimi „a ještě N úkolů ve frontě“ s **Přehled výzkumu ›** (rozbalí **Frontu**), nebo „Fronta může mít další
    úkoly.“ Rozbalený seznam sbalí **Skrýt další**. Počet v **Jen 5 úkolů** seznam nemění; každé otevření dialogu
    začíná sbalené a bez dalších úkolů tlačítko není;
  - když to výzkum hlásí, délka sezení a brána („Sezení nejvýš 3 h · brána předplatného: …“);
  - **Zrušit** a **Otevřít terminál** (značka AI a terminál) s větou **Spuštění potvrdí terminál výzkumu. Práci
    zastaví Ctrl-C v jeho okně nebo Dokončit a skončit v oddílu Teď.**
- **Ovládání:** aplikace: **Pracovat na frontě…** vpravo v záhlaví rozbalené **Fronty** v **Přehledu výzkumu**;
  nabídka **Výzkum → Pracovat na frontě…** ([S4.5.2](#S4.5.2)). Terminál: `strom run --tasks N`, `strom run --loop`
  ([R7.1](R7-when-the-agent-works.md#R7.1)).
- **Platí od:** aplikace 3.28.0 (výzkum 1.32.0); v oddílu **Teď** a **Další (n)** od aplikace 3.29.0
- **Od aplikace 3.30.0:** po **Otevřít terminál** stojí v **Teď** **Spouští se práce na frontě…** s „Agent naběhne
  v terminálu výzkumu.“ a obě tlačítka **Pracovat na frontě…** říkají, že se spouští, a nic znovu neotevřou. Řádek
  zmizí, jakmile výzkum potvrdí odkaz ([S4.5.4](#S4.5.4)) nebo začne sezení či běh; pak ho nahradí řádek sezení.
  Bez potvrzení do 30 s se **Teď** zeptá **Práce na frontě se nespustila?** („Terminál se do 30 s neozval.“) se
  **Zkusit znovu** a radou a tlačítka jsou zase volná.
- **Od aplikace 3.31.0 s výzkumem 1.36.0:** když mají linie vlastní běhy ([R7.10](R7-when-the-agent-works.md#R7.10)):
  - **Pracovat na frontě…** je obsazené (**● Pracuje se ›**) jen při běhu celé fronty, ne při bězích linií;
  - při plném počtu běhů ([S4.4.12](#S4.4.12)) je tlačítko nepřístupné s „Pracují 3 agenti, víc nastavení
    nedovolí.“ a **Nastavení ›**; v nabídce **Výzkum** je položka šedá s tímtéž vysvětlením;
  - dialog ukazuje frontu bez úkolů linií s vlastním během a pod úkolem **Jako první přijde** „Přeskočí linii
    Předci Jana Horáka (pracuje na ní vlastní agent).“; když už nějaký běh pracuje, i „Teď už pracuje 1 agent.
    Čerpání předplatného se sčítá.“

<!-- zdroj: app:9cf43b22, 34accb13 (8a10387e) src/ui/queue-work-dialog.ts queueWorkOffer (live, ne phone/sheet, ne noAgent, linkAvailable work, work.link; busy sessions|runs → 'busy'), queueWorkHead (queue-work-busy → showOverviewNowFinish), queueWorkCounted (run.tasks), queueWorkFirst (own next, pos 1), queueWorkSessionLine, WORK_TASKS_DEFAULT 5, noGate (work.gate === null) · src/research-link.ts WORK_TASKS_MIN/MAX, WORK_LINK_FEATURE, RUN_TASKS_FEATURE · src/ui/research-ui.ts queueHeadAction (jen rozbalená Fronta) · src/ui/research-overview-ui.ts showOverviewNowFinish · strings.ts live.queueWork*, queueWorkingLink · spec 052 K6.1, K6.2, K6.4, K6.6 · ZADANI_DEV_fronta-hledani §5; D6 (řádek sezení i bez brány) · 3.29.0: app:a0a66d45 Teď nabízí Pracovat na frontě… (bez práce agenta a běhu; okno přehledu; fokus zpět) · 3c8f4128 src/ui/queue-work-dialog.ts Další (n) (pořadí: ruční další, místo ve frontě; bez odložených a mimo linie, které se neberou; queue.page; zbytek, Přehled výzkumu ›; sbalené při otevření) · strings.ts live.queueWorkMore, queueWorkLess, queueWorkByQueue, queueWorkByQueueHint, queueWorkRest, queueWorkRestUnknown, queueWorkOverview, queueTagNext · 3.30.0: app:574e7ef9 src/ui/queue-start.ts (QUEUE_START_MS 30 s, důkaz handoff nebo sezení/běh, silent → queueNotStarted, proven bez sezení zmizí potichu) · src/ui/research-overview-ui.ts (live-now-starting, terminalSilent) · strings.ts busy.queueStarting, queueStartingSub, queueNotStarted, terminalSilent -->

<a id="S4.2.4"></a>
### S4.2.4 Fronta podle druhu úkolu

S výzkumem, který u úkolů uvádí druh práce, má **Fronta** v Přehledu výzkumu pod čipy linií řadu **Druh úkolu**:
čip pro každý druh, který má ve frontě úkol, s počtem („Ověřování 12“). Druh určuje výzkum
([R2.2](R2-lines-and-queue.md#R2.2)).

- **Druhy** v tomto pořadí: **Ověřování**, **Matriky**, **Sčítání lidu**, **Materiál**, **Místa**, **Zdroje mimo
  matriky**, **Dotazy**, **Vyprávění**, **Dějiny**, **Ostatní**.
- **Hranice:**
  - vybraný čip zúží frontu na úkoly toho druhu a ukáže ×; druhé kliknutí výběr zruší („Ukázat všechny druhy
    úkolů“). Vybraný druh zůstane v řadě i s nulou, když jeho poslední úkol zmizí;
  - filtr se skládá s linií nebo větví a s hledáním ve frontě ([S4.2.1](#S4.2.1)): „Nalezeno 12 úkolů · druh
    Ověřování“; bez výsledku „Mezi úkoly druhu Ověřování nic nenalezeno.“ s **Hledat ve všech druzích úkolů**;
  - volba platí pro výzkum, u kterého vznikla, dokud ji člověk nezruší nebo neskončí sledování;
  - se starším výzkumem se řada neukazuje a fronta je jako dřív;
  - **Sčítání lidu** je jen s výzkumem, který sčítání nabízí ([R9.12](R9-archives.md#R9.12)); úkoly sčítání pak
    nejsou pod **Ostatní**. Odložené úkoly sčítání ([R9.12.4](R9-archives.md#R9.12.4)) ve frontě nejsou.
- **Z oddílu Ověřování:** řádek „Čeká na ověření“ v Co ví výzkum › **Ověřování**
  ([S7.5](S7-reliability-and-verification.md#S7.5)) má **Ukázat ve frontě**. Otevře **Frontu** v Přehledu výzkumu
  zúženou na **Ověřování**. Zůstává v aplikaci a nemá značku.
- **Ovládání:** aplikace: **Přehled výzkumu** → **Fronta** → řada **Druh úkolu**; Co ví výzkum › **Ověřování** →
  **Ukázat ve frontě**. Terminál: `strom task list --kind verify` ([R2.2](R2-lines-and-queue.md#R2.2)).
- **Platí od:** aplikace 3.31.0, výzkum 1.36.0

<!-- zdroj: dirigent:spec/065-spolehlivost-a-znovu-overeni K7.4 · app:53ef9cbe src/ui/queue-kind-ui.ts (queueKindChips: jen druhy s úkolem v pevném pořadí, vybraný i s 0; queueKindRow aria-pressed, ×, taskKindClear; volba pro bridge.base) · src/research-link.ts QUEUE_KIND_FEATURE queue.kind, QUEUE_TASK_KINDS · src/research-queue-pages.ts (kind= s linií, větví a q) · src/ui/research-ui.ts queueSearchInKind, queueSearchNoneKind, queueSearchAllKinds · src/ui/verify-person-ui.ts verifyRowsHtml (pendingQueue, bez značky), showOverviewQueueKind('verify') · strings.ts live.taskKinds, taskKindLabel, taskKindClear, queueSearchFound, verify.pendingQueue · research:7116bb60 src/core/taskkind.ts, GET /queue?kind=, queueCounts.kind · CHANGELOG.cs.md 3.31.0 · sčítání: app:6edc7dc7 src/research-link.ts QUEUE_TASK_KINDS (census za records), CENSUS_FEATURE · src/research-queue-pages.ts queuePageQuery (kind=census jen s funkcí census, other + known=census) · strings.ts live.taskKinds.census · research:c7b117cd src/core/taskkind.ts (census, KINDS_065, kindMatches known) -->

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
- **Od aplikace 3.31.0 s výzkumem 1.36.0:** každá linie jde dát vlastnímu agentovi, **Pustit agenta na tuto linii**
  ([S4.3.3](#S4.3.3)). Řádek linie s vlastním během říká „Agent pracuje: Claude“ s odkazem **V Teď ›**, který
  rozbalí **Teď** a zvýrazní blok běhu ([S4.1.8](#S4.1.8)). Rozhovor **Pracovat na této linii** má nápovědu „Rozhovor
  s agentem o linii v terminálu“.

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
- **Od aplikace 3.31.0 s výzkumem 1.36.0:** nová linie uvnitř širší linie ([R2.1.5](R2-lines-and-queue.md#R2.1.5)):
  formulář **Nová linie** řekne „Nová linie je uvnitř linie Předci Jana Horáka. Lidé v ní zůstávají i v širší linii.“
  a nabídne předem zaškrtnuté „Převést sem 7 otevřených úkolů z linie Předci Jana Horáka (o lidech této linie)“ (z více
  širších linií „ze širších linií“). Po založení s převodem stojí 10 s bublina „Linie založena. Převedeno 7 úkolů.“
  s **Vrátit převod** a **Pracovat na této linii**. **Vrátit převod** (**Vrací se…**) vrátí jen převod, linie
  zůstane: „Převod vrácen · 7 úkolů zpět v širší linii“; když se úkoly mezitím změnily, **Není co vrátit.** Bez
  převodu (pole odškrtnuté, nic k převodu, starší výzkum) je bublina jako dřív; na telefonu bez **Pracovat na této
  linii**.

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
  - Volba výzkumu vedle nadpisu **Mimo linie** (např. „na konci“) otevře **Výzkum u tohoto stromu…** na skupině
    **Práce mimo linie** s vybranou kartou, i bez sledování a ze samostatného okna přehledu (dialog se otevře
    v hlavním okně). U Archivu Stromu a u výzkumu, který čeká na agenta, tahle skupina není a volba je jen text.
    Štítek větve odkazem není: rozbalí větev jako celá její hlavička.
- **Ovládání:** aplikace: **Přehled výzkumu**, oddíl práce mimo linie, u větve **⋯** (**Možnosti větve**);
  **Výzkum u tohoto stromu…**.
- **Platí od:** aplikace 3.22.0 (výzkum 1.26.0); volba u nadpisu **Mimo linie** bez sledování a z okna přehledu od
  aplikace 3.29.0

<!-- zdroj: app:HEAD src/ui/research-offline-ui.ts:3, :104 (caps.offLineBranches, ≥2 linie) · src/research-directions-write.ts setBranchMode, setOffLineTree, answerBranchWaiting · strings.ts live.offModeLink, live.offModeCap, live.branchAddPick, live.branchCreate, live.branchNever, live.branchReset · research-offline-ui.ts:202-228 growingBranchLine, :542 branch choices, :680 branchQueueBeyond, :740 pick · strings.ts live.dirNear, branchGrows, branchOwnChoice, branchQueueHead, branchQueuePos, branchAllTasks, branchTaken, branchDefaultTag, branchAdd(Paused), branchNeverGroup, waitBranchLeave, waitBranchHint, setOutTitle, setOutOcc, setSuggest, setOwnChoice, setManualTasks, menu treeSettings · spec 038 K7 · 3.27.0: strings.ts live.setOutIntro (app 4e4f6d8c, spec 036 K1.8) · 3.29.0: app:70d50162 research-offline-ui.ts openOffLineSettings bez sledování (prohlížený strom), overview-window offline-settings → hlavní okno · 0a00fb2b research-tree-settings-ui.ts offLineSettingsOffered (archiv, čeká na agenta: text, ne odkaz) -->

<a id="S4.3.3"></a>
### S4.3.3 Pustit agenta na tuto linii

U každé aktivní linie jde požádat o vlastní běh agenta, který bere jen úkoly té linie
([R7.10](R7-when-the-agent-works.md#R7.10)). Aplikace nic nespouští: otevře terminál výzkumu v novém okně a ten běh
spustí ([R7.10.4](R7-when-the-agent-works.md#R7.10.4)). Práce agenta čerpá předplatné AI.

- **Kde:** detail linie, tlačítko **Pustit agenta na tuto linii** (značka AI a terminál) s větou „Agent sám bere úkoly
  této linie (7 ve frontě), v novém okně terminálu.“; nabídka **⋯** u linie, položka před **Pracovat na této linii**
  (nápověda „Agent sám bere úkoly linie“).
- **Linie s během:** v detailu místo tlačítka „● Agent pracuje · Claude · od 10:42“ a **V Teď ›**; v nabídce položka
  není. Druhý běh téže linie nejde.
- **Když to nejde:** tlačítko i položka zůstanou, nepřístupné, s důvodem:
  - „Linie je pozastavená.“ (vedle zůstává **Znovu spustit**);
  - „Ve frontě linie nic není.“;
  - „Pracují 3 agenti, víc nastavení nedovolí.“ s **Nastavení ›** ([S4.4.12](#S4.4.12));
  - „Na tomto počítači není nainstalovaný agent, kterého výzkum umí pustit.“;
  - „Na stromu pracuje agent spuštěný starší verzí výzkumu; vedle něj se agent linie nespustí. Půjde to, až skončí.“;
  - jinak „Agenta na tuto linii teď pustit nejde.“
  U ukončené linie akce není.
- **Dialog Pustit agenta na linii:** v nadpisu znak, název a číslo linie.
  - **Agent** (jen když výzkum zná dva a více agentů): volba agenta, výchozí s „(výchozí)“, pod tím „Volba se pamatuje
    u této linie.“ Předvybraný je agent, se kterým linie běžela naposledy, jinak výchozí agent výzkumu;
  - **Automaticky** („Agent bere úkol za úkolem této linie, dokud to dovolí limit předplatného.“) nebo **Jen 5 úkolů**,
    **Jako první přijde** a **Další (n)** jako v [S4.2.3](#S4.2.3), jen z fronty linie; pod nimi „a další 12 úkolů
    linie ve frontě“;
  - když už nějaký běh pracuje: „Teď už pracuje 1 agent. Čerpání předplatného se sčítá.“ Nic se tím neblokuje;
  - **Zrušit** a **Spustit** (značka AI a terminál) s větou „Agent začne v novém okně terminálu. Práci zastaví Ctrl-C
    v jeho okně nebo Dokončit a skončit v oddílu Teď.“ Když se mezitím linie zablokuje, **Spustit** je nepřístupné
    s důvodem.
- **Po Spustit:** v **Teď** hned „Spouští se… · Předci Jana Horáka (G0002)“ s „Agent naběhne v novém okně terminálu
  výzkumu.“; bez ozvy do 30 s „Běh linie se nespustil? · Předci Jana Horáka“ se **Zkusit znovu** jako u [S4.2.3](#S4.2.3).
- **Hranice:** jen s výzkumem, který běhy linií umí, s mostem, který odpovídá, a s agentem; ne v Archivu Stromu, ne ve
  výzkumu, který čeká na agenta, a ne na telefonu (tam se běhy jen ukazují, [S4.1.8](#S4.1.8)).
- **Ovládání:** aplikace: **Přehled výzkumu → Linie**, detail linie nebo **⋯**. Terminál: `strom run --research G…`,
  menu **Nechat agenta pracovat samotného** ([R7.10](R7-when-the-agent-works.md#R7.10)).
- **Platí od:** aplikace 3.31.0 (výzkum 1.36.0)

<!-- zdroj: app:4de0835a src/ui/research-directions-ui.ts (managedDirectionDetail blok běhu, openManagedDirectionMenu položka před dirWork, managedDirectionMeta lineRunWorkingMeta + lineRunInNow, lineRunWhy) · src/research-runs.ts lineRunBlock (ended, running, canStart/why z mostu, paused > empty > limit), atRunLimit · src/ui/queue-work-dialog.ts showLineRunDialog, syncLineRunDialog (lineRunKicker, lineRunAgent, lineRunAgentDefault, lineRunAgentKept, lineRunAutoHint, lineRunRest, runsAddUp, lineRunStart, lineRunConfirm) · beginRunWork (work?research=G&agent=), lineRunStarting, lineRunStartingSub, lineRunNotStarted · strings.ts live.lineRun*, runsLimitReached, runsSettingsLink, dirWorkHint · app:docs/ZADANI_DEV_beh-po-liniich.md §1, §2, Kolo 2 B · dirigent:spec/126 K2.1, K2.2, K2.4, K2.7, K2.8 · research: researches[].run/canStart/why/agent, agents[] -->

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
- **Od aplikace 3.28.0:** v **Přehledu výzkumu** má oddíl od 10 položek pole hledání ([S4.4.2](#S4.4.2)).
- **Od aplikace 3.30.0:** v **Přehledu výzkumu** jde oddíl seřadit od nejnovějších nebo nejstarších položek
  ([S4.4.3](#S4.4.3)).
- **Od aplikace 3.30.0 s výzkumem 1.35.0:** položky jdou seskupit podle knihy, s pořadím **Nejvíc úkolů**
  a pododdílem **Urychlit stažením** ([S4.4.4](#S4.4.4), [S4.4.5](#S4.4.5)); nastavení knih v **Výzkumu u stromu**
  ([S4.4.6](#S4.4.6)).
- **Od aplikace 3.30.0:** skupiny a otevřená položka (i u výzkumu bez knih):
  - každá skupina (místo, archiv, úřad, kniha) stojí ve vlastním pásu s celým názvem, pod ním údaje a akce skupiny
    (u archivu ty z **Web archivu ↗**, **Chat**, **Odesláno** a **Text všech dotazů**, které výzkum nabízí). Název
    se zalomí nejvýš na 3 řádky (na telefonu, v malém panelu a v úzkém sloupci okna Přehledu na 4); delší končí „…“
    a odkazem **víc**, který název rozvine a skupinu nesbalí (**méně** ho zase zkrátí). Položky skupiny visí pod
    pásem na svislé lince. Seznam bez skupin a mezititulek **Bez knihy** linku nemají;
  - otevřená položka ukáže svůj text celý a jen jednou, ve svém řádku. Tělo začíná blokem **Čeká na** s celým
    zadáním ručního kroku, jak ho napsal výzkum (adresy v textu jsou odkazy). Text delší než 10 řádků (na telefonu
    na šířku 3) končí „…“ a **víc** / **méně**. Druhý řádek bloku **Adresát** říká, komu žádost jde. Položka, která
    čeká jen na člověka, blok nemá. Pod blokem stav snímků, osoba · směr a akce;
  - text „čeká na“ má až 1500 znaků (dřív ho aplikace ořízla na 120). Malý panel ho v řádku ukáže na 2 řádky, celý
    při najetí;
  - položka webu má v otevřeném těle **Otevřít web ↗** a vedle adresu webu (ne na telefonu);
  - položka čekající na snímky začíná blokem **Dodat** s kroky ([S4.4.7](#S4.4.7)).
- **Od aplikace 3.30.0 s výzkumem 1.35.0:** úkol, jehož čekání na snímky není zapsané, jak ho strom potřebuje, má
  značku a v otevřené položce opravu v jednom kroku ([S4.4.8](#S4.4.8), [S4.4.9](#S4.4.9)).

<!-- zdroj: app:7d7c0783 src/ui/research-overview-ui.ts overviewWaitingGroupHead, overviewWaitingBookHead (pás .research-overview__waiting-grouphead, akce skupiny v pásu, ul.is-grouped; bez skupin a Bez knihy bez linky), src/ui/waiting-order-ui.ts groupTitleMoreEl (strop GROUP_TITLE_LINES 3, telefon, panel a úzký sloupec 4; víc/méně stav title:<skupina>, stopPropagation), src/ui/research-ui.ts (panel: pás, víc, is-grouped), appendWaitingWebHost, strings.ts live.titleMore, titleLess, waitingWebHostAria · app:1176f465 overviewWaitingRow (text celý v řádku, detail ho neopakuje), overviewWaitingOnBox (waitsOnUser → bez bloku; appendLinkedText; waitingOnMoreEl 10 / na šířku 3 řádky; waitingToLabel Adresát), strings.ts live.waitingOnLabel, waitingToLabel · app:96b35bbd src/research-link.ts sanitizeWaiting MAX_WAITING_ON 1500, panel .live-waiting-on 2 řádky + title · CHANGELOG.cs.md 3.30.0 · dirigent:prace/1117-app-knihy-zahlavi, 1117-app-cekana-cely-text · app:docs/ZADANI_DEV_knihy-zahlavi.md §1–§3 -->

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
- **Od aplikace 3.30.0:** agent u osoby a značky jsou vidět spolu:
  - otáčející se oblouk kolem portrétu osoby, na které agent pracuje, je vidět i vedle jedné nebo více značek;
    značky zůstávají v rohu. Kartička bez portrétu má místo oblouku kroužek kolem tečky značky;
  - čtečka obrazovky slyší obojí, co čeká, i „výzkum na osobě pracuje“;
  - nabídka osoby se značkou nabízí i **Sledovat výzkum ›**;
  - fajfka po skončené práci agenta se ukáže jen na kartičce bez značky;
  - náhled kartičky v **Nastavení → Karta osoby** ukazuje oblouk a značku spolu.

<!-- zdroj: app:16461aca, 85c1f704, abf7620f src/card-signals.ts ACTION_ORDER (waiting, conflict, question), presentActions (zapnuté v Na kartě ukázat), stackChoices (waiting, story, knows, agent), ACTION_GLYPH · src/card-signal-marks.ts cardActionMarksHtml (stoh n2/n3, tečky), stackAriaLabel, stackTipHtml (tipClickChoose / tipClickKnows), stackMenuItemsHtml (menuAnswer / dotyk menuWaiting, story.compare, menuKnows, menuAgent; bez značky výzkumu), placeStackMenu · index.html .card-signal-stack, #tree-canvas.zoom-far (src/zoom.ts ZOOM_FAR = 0.55; index.html:13732-13741 jedna tečka u všech Detailů karet, e2e/card-signals.spec.ts:353), body.view-mode-print bez značek, compact dvě tečky · strings.ts card.stackLabel, stackWaiting, stackMenuLabel, tipClickChoose, cardDensity.cardWaiting, cardConflict, cardQuestion, compact · CHANGELOG.cs.md 3.27.0 „Více značek na kartě“ · dirigent:prace/1111-app-karta-vice-znacek · 3.30.0: app:16cba085 src/card-signals.ts showAgent i se značkou, doneSince jen bez značky · src/renderer.ts (oblouk vedle značky, kompaktní kroužek kolem tečky, aria-label obojí) · src/ui/card-fields-ui.ts náhled · src/ui/card-signals-ui.ts signal-agent (card.menuAgent) · strings.ts card.ariaAgent, card.menuAgent · CHANGELOG.cs.md 3.30.0 „Agent při práci i vedle odznaku“ · spec 109 -->

<a id="S4.4.2"></a>
### S4.4.2 Hledání v Čeká na vyřízení

V oddílu **Čeká na vyřízení** v **Přehledu výzkumu** je pole **Hledat osobu, místo, archiv, úkol…**. Hledá
aplikace sama v položkách, které už má, a nic neposílá do výzkumu. Filtruje hned při psaní, i bez sledování, když
výzkum neběží (položky, které výzkum naposled řekl, [S4.1.5](#S4.1.5)), i v okně Přehledu ([S4.1.6](#S4.1.6)).

- **Kdy pole je:** v rozbaleném oddílu s 10 a více položkami, pod nadpisem oddílu a nad čipy druhu. S napsaným
  textem pole zůstane, i když položek ubude.
- **Co se najde:** položky, které mají každé napsané slovo (v libovolném pořadí; slova dělí mezera, čárka nebo
  středník) v tom, co ukazuje jejich řádek, detail nebo nadpis skupiny:
  - text položky a na co čeká;
  - jména a čísla osob (`P47` i `P0047`);
  - číslo úkolu (`T0815`, `t815`) a hypotézy (`H22`); samotné číslo (`815`) najde úkol s tím číslem, jinak
    hypotézu, jinak text (třeba rok);
  - název skupiny (místo, archiv, úřad), adresu archivu u povolení a komu jde dopis.
- **Shoda textu:** bez ohledu na velká písmena a diakritiku; ß, ł, đ, ø, æ a œ se najdou i jako ss, l, d, o, ae
  a oe (`grosshof` najde „Großhof“). Slovo s 5 a více znaky najde i slova, která začínají jako ono bez posledního
  znaku (`bialy` najde „Białe“).
- **Hranice:**
  - čipy druhu (**Rozhodnutí**, **Snímky**, **Archivy a úřady**…) ukazují počet nalezených; druh bez shody je
    čárkovaný a jde dál zvolit. Hledá se ve zvoleném druhu;
  - nad seznamem „Nalezeno 12 z 40“ (z položek zvoleného druhu). Bez výsledku **Nic nenalezeno.**, ve zvoleném
    druhu „V druhu Snímky nic nenalezeno.“ s **Hledat ve všech druzích**, a **Zrušit hledání**;
  - fáze (**K vyřízení**, **Čeká na odpověď**) a skupiny se shodou se rozbalí, bez shody se neukážou. Co se během
    hledání sbalí, platí jen pro toto hledání; po vymazání pole se vrátí ruční rozbalení;
  - shoda čísla osoby, úkolu nebo hypotézy má u řádku jantarový štítek („P0108 Jan Horák“); shoda textu se
    nezvýrazňuje;
  - hypotézy ve skupině **Hypotézy k rozhodnutí**: hlava výběru **Vybrat nalezené s návrhem (n)** vybere jen
    nalezené. Vybrané mimo hledání zůstanou vybrané a pata to řekne („Vybráno 5, z toho 2 mimo hledání.“)
    s **Odznačit mimo hledání**. **Přijmout návrhy (n)** počítá všechny vybrané
    ([S3.5.2](S3-what-the-research-knows.md#S3.5.2));
  - sbalený oddíl s napsaným hledáním má v nadpisu místo souhrnu lupu a hledaný text;
  - starší výzkum bez druhů a skupin: hledá se v řádcích, jak jdou za sebou;
  - × nebo Escape pole vymaže (Escape v prázdném poli zavře Přehled), ↓ přejde na první řádek, čtečka obrazovky
    řekne počet po krátké pauze. Text platí do zavření Přehledu a nikam se neukládá;
  - telefon: pole je vysoké 44 px; po klepnutí do pole se oddíl posune pod hlavičku Přehledu a Přehled končí nad
    klávesnicí, takže nalezené je mezi polem a klávesnicí.
- **Ovládání:** aplikace: **Přehled výzkumu → Čeká na vyřízení**, pole hledání.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:8cbada1c src/section-search-match.ts foldSearch2 (ß ł đ ø æ œ), tokenize (mezera, čárka, středník; p/t/h + číslo, samotné číslo), matchDoc (každé slovo; n: úkol, hypotéza, text), textMatches (≥ 5 znaků bez posledního na začátku slova), fieldVisible (≥ 10 nebo text) · src/ui/section-search.ts (×, Escape: nejdřív hledání, prázdné pole zavře Přehled; ↓; searchOpen se vymaže s textem; zavření Přehledu text zahodí) · app:9ebf7f2c src/section-search-filter.ts searchSection, chipCount, sectionPartOpen, toggleSectionPart, sheetOverKeyboard · src/ui/section-search-view.ts mountSectionSearch, paintSearchChip (čárkovaný), appendSearchOutcome (sectionSearchFound, queueSearchNone, sectionSearchNoneKind + sectionSearchAllKinds, queueSearchCancel), searchHitTag, searchSummaryEl (lupa a text), bindSheetSearch, keepSheetOverKeyboard · src/ui/research-overview-ui.ts appendOverviewWaiting (pole jen v rozbaleném oddílu, starší výzkum bez skupin), waitingSearchDoc (what, on, osoby, person, partner, task, hypo, group.name / otázky k místům, host, to), overviewWaitingRow (hit t, p) · app:cd0030b0 src/ui/hypothesis-waiting-ui.ts hypothesisAcceptHeadEl (bulkSelectFound), hypothesisAcceptFootEl (bulkSelectedHidden, bulkDeselectHidden), hwr-id hit h · strings.ts live.waitingSearchPlaceholder, waitingSearchAria, sectionSearchFound, sectionSearchNoneKind, sectionSearchAllKinds, bulkSelectFound, bulkSelectedHidden, bulkDeselectHidden, sectionSearchQuoted, waitingPhaseTodo, waitingPhaseSent, waitingChips · e2e/overview-waiting-search.spec.ts · CHANGELOG.cs.md 3.28.0 (e540e4b5) · spec 083 K1.1–K1.3 · prace/1113-app-hledani-v-prehledu (pole 44 px na telefonu) -->

<a id="S4.4.3"></a>
### S4.4.3 Pořadí v Čeká na vyřízení

Oddíl **Čeká na vyřízení** v **Přehledu výzkumu** jde seřadit i podle toho, odkdy položka čeká. Nově přibylá položka
je pak nahoře a neztratí se mezi místy a skupinami.

- **Pořadí:**
  - **Doporučené** (výchozí): pořadí výzkumu podle fází, míst a linií jako dosud;
  - **Nejnovější nahoře** a **Nejstarší nahoře**: podle času, odkdy položka čeká, jak ho poslal výzkum. Řadí se
    v každé fázi (**K vyřízení** i **Čeká na odpověď**). Stejný čas drží pořadí výzkumu, položky bez času jsou
    v obou směrech na konci.
- **Skupiny** (přepínač vedle pořadí, jen u časového pořadí a u výzkumu se skupinami podle míst):
  - zapnuté: řadí se uvnitř skupin a každé místo stojí tam, kde jeho nejnovější (nebo nejstarší) položka; také
    **Ostatní** a **Místa**, které v **Doporučeném** stojí na konci. Nadpis místa ukazuje čas své první položky;
  - vypnuté: každá fáze je jeden seznam a každý řádek má štítek svého místa (celý název při najetí).
- **Čas u řádku** (jen v časovém pořadí): do hodiny relativně („před 25 min“), dnes hodina („08:30“), „včera“,
  letos den („4. 11.“), dřív den i rok („6. 10. 2025“). Čas se sám obnovuje.
- **Štítek „nové“** (v každém pořadí): položky k vyřízení, které na tomto zařízení ještě nebyly vidět v rozbaleném
  oddílu **Čeká na vyřízení** (stejný záznam jako **N nových**, [S4.1.2](#S4.1.2)). Štítek zůstane do zavření
  Přehledu; sbalené místo řekne „nové: 2“. Strom, na který se na tomto zařízení ještě nikdo nedíval, nic nového
  nemá.
- **Hranice:**
  - volba pořadí je od dvou položek v oddílu;
  - pořadí i přepínač **Skupiny** se pamatují na tomto zařízení pro všechny stromy (poprvé **Doporučené**,
    **Skupiny** zapnuté); jiné okno téhož zařízení, i okno Přehledu ([S4.1.6](#S4.1.6)), se přizpůsobí;
  - pořadí platí i s hledáním ([S4.4.2](#S4.4.2)) a čipy druhu. Hlava a pata výběru hypotéz se při vypnutých
    skupinách týkají hypotéz celé fáze;
  - platí v Přehledu (bočním i přes strom), v okně Přehledu a na telefonu. Malý panel je beze změny (kromě výzkumu
    s knihami, [S4.4.4](#S4.4.4)).
- **S výzkumem, který zná knihy** (výzkum 1.35.0): přepínač **Skupiny** je volba **Archiv** | **Kniha** |
  **Bez skupin** a pořadí má čtvrtou možnost **Nejvíc úkolů** ([S4.4.4](#S4.4.4)).
- **Ovládání:** aplikace: **Přehled výzkumu → Čeká na vyřízení**, tlačítko „⇅ Doporučené ▾“ za čipy druhu
  (v okně Přehledu v lepkavé hlavě oddílu) s nabídkou **Doporučené** ·
  **Nejnovější nahoře** · **Nejstarší nahoře**, na telefonu list **Pořadí**; přepínač **Skupiny**.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:f3bb5631 src/research-waiting.ts WaitingOrder, WAITING_ORDERS, waitingSince (at), sortWaitingByTime (stejný čas v pořadí výzkumu, bez času na konci), phaseRows (recommended = groupWaiting; skupiny podle první položky, Ostatní a Místa také; bez skupin FLAT_GROUP), waitingPhases (todo i sent) · src/live-time.ts formatWaitingSince (do hodiny relativně, dnes čas, včera, den, den s rokem) · src/ui/waiting-order-ui.ts WAITING_ORDER_KEY strom-live-overview-waiting-order, WAITING_GROUPS_KEY, storedWaitingOrder, watchWaitingOrderStorage (storage event), noteWaitingNew (todoWaiting, waitingSeen; strom bez záznamu nic nového), waitingSideEl, waitingGroupTagEl, ORDER_ICON · src/ui/research-overview-ui.ts overviewWaitingOrderEl (total >= 2; přepínač role switch jen v časovém pořadí a se skupinami; list na telefonu isPhoneBar / sheet) · src/ui/overview-columns-ui.ts (lepkavá hlava v okně) · src/ui/hypothesis-waiting-ui.ts (hlava a pata za fázi) · src/ui/live-section-prefs.ts waitingSeen, noteWaitingSeen · strings.ts live.waitingOrder, waitingOrderRec, waitingOrderNew, waitingOrderOld, waitingGroups, waitingNewTag, waitingNewCount, waitingSinceYesterday, waitingOtherGroup, places.waiting.group · e2e/overview-waiting-order.spec.ts · CHANGELOG.cs.md 3.30.0 „Pořadí v Čeká na vyřízení“ · spec 083 K5.1–K5.4, rozhodnutí H1–H5 · dirigent:test/vysledek-1116-app-103-odkazy-083-razeni.md -->

<a id="S4.4.4"></a>
### S4.4.4 Čeká na vyřízení podle knihy

S výzkumem, který zná knihy ([R6.8](R6-awaiting-action.md#R6.8)), jdou položky **Čeká na vyřízení** seskupit podle
knihy, kterou potřebují. U knihy je vidět, kolik úkolů na ni čeká, co z ní jde stáhnout a kam snímky uložit.

- **Skupiny** (volba vedle pořadí):
  - **Archiv**: skupiny jako dosud (místa, archivy, **Ostatní**, [S4.4.3](#S4.4.3));
  - **Kniha**: v každé fázi napřed skupiny knih, pak ostatní položky ve skupinách archivů pod mezititulkem
    **Bez knihy** (jen když nějaká kniha je). Kniha položky je kniha, na kterou položka čeká, jinak jediná kniha,
    ve které úkol pracuje;
  - **Bez skupin**: jeden seznam (jen u časového pořadí, jako vypnuté **Skupiny**).

  V **Doporučeném** pořadí je volba **Archiv** | **Kniha**; skupiny knih stojí podle své první položky, v časovém
  pořadí podle času první položky.
- **Pořadí Nejvíc úkolů:** skupiny jsou vždy knihy (volba skupin zmizí).
  - nahoře knihy ke stažení (chybí jim snímky, nebo počet snímků není známý), pod nimi knihy celé na disku. V každé
    části jdou knihy od té, kterou potřebuje nejvíc úkolů, při shodě víc čekajících, pak číslo knihy. Stejně je
    seřazené **Urychlit stažením** ([S4.4.5](#S4.4.5));
  - má-li fáze obě části, stojí nad nimi mezititulky „Ke stažení · 2 knihy“ a „Celé na disku · 1 kniha“ (počty ve
    fázi). S jedinou částí mezititulek není;
  - pod řazením stojí věta „Nahoře knihy, kterým chybí snímky: jejich stažením se vyřeší nejvíc úkolů najednou.
    Knihy celé na disku jsou pod nimi.“ V nabídce řazení má **Nejvíc úkolů** druhý řádek „knihy ke stažení nahoře“;
  - uvnitř knihy jsou položky v **Doporučeném** pořadí. Položky bez knihy jsou na konci ve skupinách archivů.
- **Pás knihy** (jako pás každé skupiny, [S4.4](#S4.4)):
  - název knihy (s roky) celý, zalomený, nejvýš na 3 řádky (4 na telefonu) a **víc**. Vpravo štítek **Kniha**,
    **nové: N** u sbalené knihy a počet položek. Při najetí název, archiv a kolik úkolů knihu potřebuje (z toho
    odloženo);
  - druhý řádek: archiv, celý;
  - třetí řádek: „12 úkolů“ (kolik úkolů knihu potřebuje) · „3 čekají“ · „+M ve frontě“ (úkoly knihy, které
    nečekají) · „2 odložené“ · snímky („240 snímků · na disku 12 · chybí 228“, kniha celá na disku „240 snímků · celá
    na disku“) · „převezme se N souborů“ (soubory, které leží ve složce knihy a ještě se nepřevzaly) · „web archivu
    vyžaduje přihlášení“. „Ve frontě“ a „odložené“ jen nad nulou. V pořadí **Nejvíc úkolů** je tučně počet úkolů
    a „chybí N“;
  - akce pod údaji: co jde stáhnout podle podmínek archivu ([R6.8.1](R6-awaiting-action.md#R6.8.1)) – „Ke stažení
    celá kniha · N snímků“, „Ke stažení snímky 31–36 · 6 snímků“ nebo „Ke stažení vybrané snímky …“; **Web archivu
    ↗**; **Otevřít složku knihy** (složka knihy ve sdílené schránce, výzkum ji otevře bez terminálu a případně
    vytvoří, [R6.8.2](R6-awaiting-action.md#R6.8.2)); **Chat** (ne na telefonu). Klik na akci knihu nesbalí;
  - kniha, kterou výzkum v přehledu knih neposlal: jen název (nebo číslo knihy), štítek a počet.
- **Hledání** ([S4.4.2](#S4.4.2)) najde položky i podle názvu a archivu jejich knihy.
- **Malý panel:** tlačítko pořadí a „Skupiny: Kniha ▾“ s nabídkou; pás knihy jen s názvem (nejvýš 4 řádky a **víc**)
  a „N čeká“, položky na lince, mezititulek **Bez knihy**; akce knih jsou jen v **Přehledu výzkumu**. Počty položek jsou stejné jako dosud.
- **Hranice:**
  - volba **Kniha** a pořadí **Nejvíc úkolů** jsou jen s výzkumem, který knihy posílá, a ne u Archivu Stromu ani
    u výzkumu, který čeká na agenta. Jinak vše vypadá jako dřív a uložená volba **Kniha** nebo **Nejvíc úkolů** se
    ukáže jako **Archiv** a **Doporučené**, aniž by se přepsala;
  - volba skupin se pamatuje na tomto zařízení s pořadím ([S4.4.3](#S4.4.3)).
- **Ovládání:** aplikace: **Přehled výzkumu → Čeká na vyřízení**, vedle tlačítka pořadí přepínač **Skupiny**
  (**Archiv** | **Kniha** | **Bez skupin**); na telefonu (i na šířku) a v malém panelu tlačítko „Skupiny: Kniha ▾“
  s nabídkou (na telefonu list). Pořadí „⇅ … ▾“ › **Nejvíc úkolů**.
- **Kniha položky** určuje výzkum: čekající úkol patří pod knihu, kterou je třeba prohledat
  ([R6.8.4](R6-awaiting-action.md#R6.8.4)).
- **Platí od:** výzkum 1.35.0, aplikace 3.30.0

<!-- zdroj: app:7d7c0783 src/research-books.ts bookMetaParts (tasks · waiting · inQueue >0 · parked >0 · obrázky · pending · login), bookHeadImagesPieces (missing 0 → wholeOnDisk), research-overview-ui.ts overviewWaitingBookHead (archiv na vlastním řádku, akce v pásu, books.folderBook), research-ui.ts appendPanelWaitingBooks (název 4 řádky + víc, is-grouped) · app:1176f465 src/research-books.ts sortBooksMost (bookWholeOnDisk napřed false, pak tasks ↓, waiting ↓, číslo), research-waiting.ts phaseRows (part download / disk jen při obou částech, počty ve fázi), research-overview-ui.ts :1200 order-note books.mostNote, :1236 books.toDownload / onDiskAll, is-key (tasks, missing), table-headmenu.ts sub books.orderMostSub · strings.ts live.books.tasks, parked, wholeOnDisk, folderBook, toDownload, onDiskAll, mostNote, orderMostSub · research:8d19d4f6 src/core/books.ts bookOfTask (waitTarget) · ZADANI_DEV_knihy-zahlavi.md §1, §2, §4 -->
<!-- zdroj: app:224a1358, 7c39e663 src/ui/waiting-order-ui.ts shownWaitingGroups (most → book; book bez knih → archive; none v doporučeném → archive), waitingGroupModesFor, storedWaitingGroupMode (klíč přepínače Skupiny) · src/research-waiting.ts phaseRows (by book, afterBooks, most: sortBooksMost, uvnitř doporučené) · src/research-books.ts booksOn, bookOfItem, bookMetaParts, bookImagesText, bookOfferText (whole/range/selected), bookHeadTitle, bookWebUrl, sortBooksMost · src/ui/research-overview-ui.ts overviewWaitingBookHead (štítek Kniha, nové, počet, meta, is-key u most), overviewWaitingBookActions (nabídka, Web archivu, Otevřít složku book?do=folder, Chat), waitingGroupsChoiceEl (segment, compact/sheet) · src/ui/research-ui.ts appendPanelWaitingBooks (malý panel: název, N čeká, Bez knihy, akce jen v přehledu) · research:b1749433 src/core/live.ts /status books (feature books; ne archiv ani čekání na agenta), bookOfTask · strings.ts live.books · dirigent:spec/105-co-nejvic-pomuze U5, K5.1 · app:docs/ZADANI_DEV_knihy-ukolu.md §1–§2 -->

<a id="S4.4.5"></a>
### S4.4.5 Urychlit stažením

Knihy, které potřebuje dost úkolů a na které nic nečeká, aplikace nabídne ke stažení zvlášť. Snímky uložené do
složky knihy čte agent z disku, rychleji a levněji. Nic na ně nečeká, a proto se nepočítají mezi položky.

- **Co tam je:** knihy, které výzkum nabízí ([R6.8](R6-awaiting-action.md#R6.8): aspoň `books.minTasks` úkolů,
  něco jde stáhnout) a na které nečeká žádný úkol. Kniha, na kterou něco čeká, je v seznamu jako skupina
  ([S4.4.4](#S4.4.4)). Pořadí jako **Nejvíc úkolů**.
- **Pododdíl** **Urychlit stažením · N knih** stojí dole pod **Čeká na odpověď**, poprvé sbalený:
  - věta „Snímky uložené do složky knihy čte agent z disku – rychleji a levněji. Nic na ně nečeká.“ a odkaz
    **Nastavení…** (otevře **Výzkum u stromu** na skupině **Knihy**, [S4.4.6](#S4.4.6));
  - řádek knihy: název; archiv · „N úkolů ve frontě“ · snímky · „převezme se N souborů“ · přihlášení; co jde
    stáhnout · **Web archivu ↗** · **Otevřít složku**. Klik na název rozbalí podrobnosti: **Úkoly** (z toho
    odloženo), **Složka**, **Přístup**;
  - knihy nad rámec seznamu jen počtem: „a dalších N knih je ve výzkumu“ (celý seznam v terminálu,
    `strom task books`).
- **Hranice:**
  - jen s čipem druhu **Vše** a **Snímky**; s hledáním jen knihy, jejichž název nebo archiv odpovídá;
  - prázdný pododdíl se neukáže. Ukáže se i tehdy, když nic nečeká (pod prázdným oddílem);
  - nepočítá se do počtu oddílu, souhrnu, „Čeká N“ ani malého panelu.
- **Malý panel:** pod seznamem řádek „Urychlit stažením · N knih ⤢“, který otevře **Přehled výzkumu** s rozbaleným
  pododdílem.
- **Ovládání:** aplikace: **Přehled výzkumu → Čeká na vyřízení → Urychlit stažením**. Terminál:
  `strom task books` ([R6.8](R6-awaiting-action.md#R6.8)).
- **Platí od:** výzkum 1.35.0, aplikace 3.30.0

<!-- zdroj: app:bc8fc5fd src/research-books.ts urgentBooks (offer && waiting === 0, sortBooksMost), urgentBooksShown (filtr all/images, hledání název a archiv) · src/ui/research-overview-ui.ts appendOverviewBooksOffer (sectionPartOpen urgent, výchozí zavřený; urgentText, Nastavení… → openBooksSettings; more), overviewUrgentBookRow (detail Úkoly, Složka, Přístup) · src/ui/research-ui.ts renderLivePanel panelUrgent (showOverviewBooksOffer) · strings.ts live.books.urgent* · research:b1749433 src/core/live.ts booksStatus (offer, more) · ZADANI_DEV_knihy-ukolu.md §3, §5 -->

<a id="S4.4.6"></a>
### S4.4.6 Výzkum u stromu › Knihy

Nastavení knih výzkumu ([R6.8.3](R6-awaiting-action.md#R6.8.3)) jde změnit i v aplikaci. Zapisuje se přes most
do výzkumu, takže platí stejně jako v terminálu.

- **Skupina Knihy** (za **Čtením dokumentů**, ve sbaleném stavu souhrn „od 5 úkolů · bez přednosti“):
  - **Od kolika úkolů nabízet knihu**: celé číslo od 1 do 999. Ukládá se po opuštění pole nebo Enteru. Jiná hodnota
    ukáže „Celé číslo od 1 do 999.“ a nic se neodešle; prázdné pole vrátí uloženou hodnotu. Výchozí hodnota má
    „(výchozí)“, odkaz **Vrátit výchozí (5)** ji vrátí;
  - **Přednost stažené knize** (přepínač): po úkolu knihy, která je na disku, vezme fronta další úkol téže knihy,
    nejvýš 5 sezení po sobě ([R2.2.4](R2-lines-and-queue.md#R2.2.4)).
- **Zápis:** hned po změně „Ukládá se do výzkumu…“, pak „Výzkum potvrdil. Platí i pro změny v terminálu.“
  Zaneprázdněný výzkum: „Výzkum je teď zaneprázdněný, nic se nezměnilo.“ a **Zkusit znovu**. Bez mostu je skupina
  ztlumená. Změna z terminálu dialog překreslí, ale ne pole, do kterého se právě píše.
- **Hranice:** jen s výzkumem, který knihy posílá; ne u Archivu Stromu ani u výzkumu, který čeká na agenta. Když se
  výzkum mezitím přepne na Archiv Stromu, skupina zmizí.
- **Ovládání:** aplikace: **Výzkum → Další → Výzkum u tohoto stromu… → Knihy**, nebo **Nastavení…**
  v **Urychlit stažením** ([S4.4.5](#S4.4.5)). Terminál: [R6.8.3](R6-awaiting-action.md#R6.8.3).
- **Platí od:** výzkum 1.35.0, aplikace 3.30.0

<!-- zdroj: app:224a1358 src/ui/books-setting-view.ts (pole, (výchozí), Vrátit výchozí, přepínač) · src/ui/research-tree-settings-ui.ts showResearchTreeSettings group books, booksBody, překreslení mimo fokus · src/research-link.ts booksSettings, POST books (400 books.body, 409 directions.archive → skupina zmizí, 503 research.busy) · strings.ts researchTree.booksGroup, booksSum, minTasks*, sameBook*, resetDefault, booksOk, booksBusyErr, booksRetry · research:b1749433 src/core/live.ts POST /books · ZADANI_DEV_knihy-ukolu.md §4 -->

<a id="S4.4.7"></a>
### S4.4.7 Položka čekající na snímky

Otevřená položka, která čeká na snímky, napřed řekne, co dodat a kam, a pak ukáže kroky v pořadí, ve kterém se
dělají. Výsledkem jsou soubory ve složce, ne odpověď.

- **Kterých položek se týká:** úkol čekající na snímky (druh **Snímky**) a úkol čekající na web, kterému výzkum dal
  složku knihy ([R6.8.4](R6-awaiting-action.md#R6.8.4)); jen když jde snímky přidat přes most. Ostatní položky jsou
  beze změny.
- **Blok Dodat** (na začátku těla, před **Čeká na**, [S4.4](#S4.4)): věta, které snímky jako soubory a do které
  složky, například „Snímky 112–113 jako soubory (JPG nebo PNG) do složky knihy …“ s názvem knihy:
  - čísla jsou ta, která ještě chybí; bez známých čísel věta čísla nemá („Snímky jako soubory (JPG nebo PNG) do
    složky knihy …“);
  - složka knihy, když ji výzkum má v seznamu knih se složkou a odkaz do výzkumu ji umí otevřít; jinak „… do složky
    úkolu“. Věta jmenuje vždy tu složku, kterou otevře krok ②.
- **Kroky** (počítač a tablet), mezi nimi šipky:
  1. **Web archivu ↗**: web položky, jinak web knihy nebo jejího archivu;
  2. **Otevřít složku knihy** (výzkum ji otevře bez terminálu, [R6.8.2](R6-awaiting-action.md#R6.8.2)), jinak
     **Otevřít složku** úkolu (otevře výzkum v terminálu, se značkou terminálu);
  3. **Mám snímky**: jediná hlavní akce, otevře místo pro nahrání snímků.

  Krok, který odtud nejde, chybí a další vezme jeho číslo. Šipka se nikdy nezalomí od kroku, ke kterému vede. Pod
  380 px šířky jsou kroky pod sebou bez šipek. Při přidávání snímků a psaní odpovědi se kroky schovají.
- **Pod blokem:** stav snímků, místo pro přetažení, osoba · směr a odkaz **Snímky nejde získat…**. Ten otevře pole
  **Proč snímky nejde získat** s nápovědou „Sem patří, proč snímky dodat nejde nebo co v archivu chybí. Čtení zápisu
  sem nepatří: snímky přečte výzkum.“ Odeslání vrátí úkol do fronty jako každá odpověď
  ([R6.7](R6-awaiting-action.md#R6.7)). Ostatní akce (**Probrat s agentem** a další, které výzkum nabízí) jsou pod **⋯**.
- **Telefon:** jen blok **Dodat** s větou a „Snímky se ukládají na počítači.“, bez kroků. **Snímky nejde získat…**
  otevře list odpovědi s týmž nadpisem a nápovědou.
- **Malý panel:** okno **Mám snímky** začíná týmž blokem s kroky pod sebou; místo pro nahrání pod ním je poslední
  krok.
- **Ovládání:** aplikace: **Přehled výzkumu → Čeká na vyřízení**, klik na položku se snímky; v malém panelu **Mám
  snímky**.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:449e6962, 429839f0 src/ui/waiting-task-ui.ts waitingTakesImages (waitingActions images přes most), waitingAnswerTexts (answerImagesLabel, answerImagesHint), waitingDeliverEl (věta deliverSentence, phone → deliverPhone bez kroků, kroky deliverSteps web → folder → images, krok ② books.folderBook přes odkaz book jen s book.folder, jinak openFolder task?do=folder se značkou, ③ haveImages waiting-action--primary → openWaitingImages, deliver-pair šipka s krokem, is-column), panel dialog (column, upload: true, title haveImages) · src/research-waiting.ts waitingForImages (images, web s inbox), waitingDeliver (chybějící čísla jen u detail full; kniha jen ze seznamu se složkou), deliverSentence, deliverWebUrl (w.url, jinak bookWebUrl), deliverSteps · src/ui/research-overview-ui.ts appendWaitingTaskActions deliver (answer → link-button cannotGet, ostatní pod ⋯, na telefonu nic pod ⋯) · strings.ts live.waitingTask.deliverLabel, deliverBook, deliverTask, deliverBookAny, deliverTaskAny, deliverPhone, stepAria, cannotGet, answerImagesLabel, answerImagesHint · e2e/waiting-images.spec.ts, overview-waiting-books.spec.ts · ZADANI_DEV_knihy-zahlavi.md §5 · dirigent:prace/1117-app-knihy-zahlavi (D12, D13) -->

<a id="S4.4.8"></a>
### S4.4.8 Úkol, který není zapsaný, jak má

Výzkum u čekajících úkolů kontroluje, jestli je čekání na snímky zapsané tak, jak ho strom potřebuje: snímky jedné
knihy výzkumu, jedna kniha na úkol ([R6.9](R6-awaiting-action.md#R6.9)). Když není, uložené snímky úkol nevrátí do
fronty. Aplikace u takové položky ukáže nález a nabídne opravu v jednom kroku. Položka čeká dál, počty se nemění.

- **Značka:** řádek položky má před názvem výstražný trojúhelník s vykřičníkem (bublina a čtečka obrazovky **Úkol není
  zapsaný, jak má**). V malém panelu je jen značka (**Úkol není zapsaný, jak má – otevře se v přehledu**).
- **Blok v otevřené položce** (**Přehled výzkumu**, i v jeho samostatném okně): pod textem čekání a stavem snímků,
  nad akcemi položky, nadpis **Úkol není zapsaný, jak má** a věta, co je špatně:

  | Nález výzkumu | Věta |
  |---|---|
  | snímky jsou jen v textu | **Snímky jsou zapsané jen textem, bez knihy – uložené snímky úkol neprobudí.** |
  | víc knih v jednom čekání | **Čeká na snímky z více knih**, s neznámou knihou **; jednu z nich výzkum nezná.** |
  | kniha, kterou výzkum nezná | **Knihu výzkum nezná – úkol nemá složku pro snímky.** |
  | chybí složka | **Složka pro snímky chybí – oprava ji založí.** |

  Když výzkum opravu nenabízí a výzkum má agenta, věta končí **Knihu do výzkumu přidá agent.** Nález, který
  aplikace nezná, má jen nadpis.
- **Akce bloku:**
  - **Opravit**, jen když výzkum nabízí opravu celou nebo zčásti: ukáže náhled opravy ([S4.4.9](#S4.4.9));
  - **Probrat s agentem** (značka AI a terminál, [S4.5.1](#S4.5.1)) otevře rozhovor k úkolu: agent dostane nález
    a navrhne opravu. Jen u výzkumu s agentem, ne na telefonu. U položky s nálezem tahle akce není pod **⋯**;
  - **Nechat, jak je** zapíše hned, bez náhledu, že čekání je tak správně. Nález zmizí a oznámení **Nález se už
    nenabízí** má 8 s **Vrátit**. Výzkum nález znovu nabídne, až se čekání úkolu změní.
- **Hranice:**
  - výzkum nedostupný (sledování skončilo nebo most neodpovídá): **Opravit** a **Nechat, jak je** nejdou a pod nimi
    stojí **Výzkum není dostupný – opravu teď nejde zapsat.**;
  - nález, který mezitím zmizel: oznámení **Nález už neplatí – úkol je zapsaný správně.**;
  - klik těsně po posunu řádků (jiný nález se opravil nebo zmizel) nic neudělá, aby se netrefila jiná položka;
  - výzkum, který kontrolu nemá: položky jsou jako dřív, bez značky a bloku.
- **Ovládání:** aplikace: **Přehled výzkumu → Čeká na vyřízení**, klik na položku se značkou. Terminál:
  `strom task audit` ([R6.9](R6-awaiting-action.md#R6.9)).
- **Platí od:** aplikace 3.30.0, výzkum 1.35.0

<!-- zdroj: app:929d7813, ed7f7a04, 287ebc72, 01a1e760 src/research-audit.ts TASKS_AUDIT_FEATURE tasks.audit, auditExplain (text; books + BooksUnknown; unknown; folder; agentAdds jen fix none s agentem; neznámý druh jen nadpis) · src/ui/waiting-task-ui.ts waitingAuditShown, waitingAuditMarkEl (trojúhelník, title), waitingAuditEl (auditFix jen fix ≠ none, discuss s researchLinkMark task chat jen s agentem a ne sheet, auditKeep), keepWaitingAudit (toast auditKept 8000 ms, Vrátit → unkeep), waitingAuditGone (auditGone), auditResearchUnavailable (ended, lostSince), shiftHeld · src/ui/research-overview-ui.ts:1899 značka v hlavičce, :2088 blok v detailu, :2192 a :2462 chat ne pod ⋯ · src/ui/research-ui.ts panel auditMarkPanel · strings.ts live.waitingAudit.* · CHANGELOG.cs.md 3.30.0 „Kontrola úkolu“ · ZADANI_DEV_kontrola-ukolu.md · dirigent:spec/109 K1.4–K1.6, prace/1117-app-109-kontrola (D1 složka, D2 neznámý kód) · app:cf12b70d auditKindBooks „z více knih“ -->

<a id="S4.4.9"></a>
### S4.4.9 Náhled opravy a Vrátit

**Opravit** nic nezapíše hned. Napřed ukáže, co oprava změní, a zapíše až druhé **Opravit** pod náhledem.

- **Náhled** (na místě akcí bloku; **Načítá se náhled…**, dokud ho výzkum nepošle):
  - **Co se změní**: **Tento úkol** „bude čekat na snímky 112–113 knihy …“, „bude čekat na snímky knihy …, čísla
    snímků nejsou známá“ nebo „založí se složka …“; **Nový úkol** pro každou další knihu („pro snímky … knihy …“,
    „pro knihu …“; u knihy, která ve výzkumu není, „kniha ve výzkumu není, nový úkol čeká dál textem“);
  - **Co zůstane**: co oprava neudělá, například „Kniha … ve výzkumu chybí – doplní ji agent.“ U první takové
    knihy je **Probrat s agentem**;
  - pod náhledem „Oprava mění jen to, na co úkol čeká, a jde vrátit.“ a **Zrušit** · **Opravit**. **Zrušit** nebo
    Esc náhled zavře a fokus vrátí na **Opravit** v bloku. Otevřený je vždy jen jeden náhled.
- **Po zápisu** (**Opravuje se…**): oznámení **Opraveno** s **Vrátit** na 8 s. Když už snímky ve složce leží a úkol
  je má všechny, **Opraveno – snímky už jsou uložené, úkol pokračuje.** **Vrátit** vezme opravu zpět bez náhledu
  (**Vráceno – úkol čeká jako dřív.**). Když se úkol mezitím změnil, **Vrátit už nejde – úkol se mezitím
  změnil.** Po zmizení oznámení jde oprava vrátit jen v terminálu (`strom task audit T… --unfix`,
  [R6.9.1](R6-awaiting-action.md#R6.9.1)).
- **Hranice:**
  - náhled platí pro úkol, jak byl, když se ukázal. Když se úkol mezitím změnil: **Úkol se mezitím změnil.**
    **Náhled neodpovídá aktuálnímu stavu.** s **Načíst znovu**. Další odmítnutí stojí pod náhledem: **Výzkum
    právě zapisuje – další pokus půjde za chvíli.**, **Výzkum je zamčený – oprava teď nejde zapsat.**, **Na disku
    výzkumu není místo – oprava se nezapsala.**;
  - na telefonu (do 640 px) je náhled list zespodu s **Zrušit** · **Opravit** dole, bez **Probrat s agentem**;
  - v samostatném okně **Přehledu výzkumu** ukáže oznámení hlavní okno.
- **Ovládání:** aplikace: **Opravit** v bloku **Úkol není zapsaný, jak má**; **Vrátit** v oznámení.
- **Platí od:** aplikace 3.30.0, výzkum 1.35.0

<!-- zdroj: app:929d7813, ed7f7a04, 287ebc72, 01a1e760 src/ui/waiting-task-ui.ts openWaitingAuditFix (GET waiting/<T>/fix, auditLoading, jeden náhled), náhled (auditChanges, auditThisTask, auditNewTask, auditRemains, chat u první knihy, ne sheet; auditFixNote), confirmWaitingAuditFix (auditBusy, expect = stamp), writeWaitingAuditFix (toast auditFixed / auditFixedWoke 8000 ms, Vrátit = waitingWrite.undo), undoWaitingAuditFix (unfix, auditUndone, auditUndoFailed), cancelWaitingAuditFix (Esc, fokus na audit-fix), auditErrorText (409 auditErr409 + auditReload, 503, locked, disk), AUDIT_SHEET_ID (telefon) · src/research-audit.ts auditChangeLines (wait-images, wait-book, folder, split), auditLeftLines · src/research-link.ts postWaitingAudit (do fix/unfix/keep/unkeep, expect) · strings.ts live.waitingAudit.* · ZADANI_DEV_kontrola-ukolu.md §2 · dirigent:prace/1117-app-109-kontrola (D3 texty náhledu z op/images/title, D5 Vrátit jen v toastu) -->

<a id="S4.4.10"></a>
### S4.4.10 Výzkum u stromu › Sčítání lidu

Sčítání lidu jako pramen výzkumu ([R9.12](R9-archives.md#R9.12)) jde zapnout a vypnout i v aplikaci. Zapisuje se přes
most hned po kliknutí, oběma směry, a je to rozhodnutí člověka v aplikaci: okno systému se neukazuje.

- **Skupina Prameny** s přepínačem **Sčítání lidu** a větou „Výzkum smí jako pramen použít sčítání lidu: domácnost
  v jednom roce ukáže, kdo s kým bydlel a odkud kdo přišel. Většina archivů sčítání jen zobrazuje, archy se proto
  většinou dodávají ručně snímkem obrazovky.“
- **Hranice:**
  - jen s výzkumem, který sčítání nabízí; se starším výzkumem skupina není. Ne u Archivu Stromu ani u výzkumu, který
    čeká na agenta; když se výzkum mezitím přepne na Archiv Stromu, skupina zmizí;
  - po kliknutí se nový stav ukáže hned, přerušovaně a zamčený, dokud výzkum zápis nepotvrdí;
  - vypnuto s odloženými úkoly ([R9.12.4](R9-archives.md#R9.12.4)): pod řádkem „Odloženo: 3 úkoly sčítání. Po
    zapnutí se vrátí.“;
  - bez mostu je přepínač neaktivní: „Výzkum neběží. Změnit to půjde, až poběží.“;
  - odmítnutí řekne důvod pod řádkem a přepínač zůstane, jak byl (např. „Výzkum je teď zaneprázdněný. Za chvíli to
    půjde znovu.“, zamčený výzkum, plný disk).
- **Ovládání:** aplikace: **Výzkum → Další → Výzkum u tohoto stromu… → Prameny → Sčítání lidu**. Terminál:
  [R9.12](R9-archives.md#R9.12).
- **Platí od:** výzkum 1.36.0, aplikace 3.31.0

<!-- zdroj: app:6edc7dc7 src/research-link.ts CENSUS_FEATURE census, LiveCensus {on, held}, sanitizeCensus · src/history-bridge.ts postBridgeCensus, censusReply (held, invalid, archive 409 census.archive, busy, locked, full) · app:80d6358c src/ui/research-tree-settings-ui.ts renderResearchCensusRow (jen s funkcí census, ne archiv ani výzkum bez agenta, gone po 409; pend přerušovaně a zamčeno; censusHeld jen vypnuto a held > 0; bez mostu storiesBridgeDown), setResearchCensus · strings.ts history.censusSection, censusTitle, censusDesc, censusHeld, storiesBridgeDown, errBusy · e2e/research-census.spec.ts · research:c7b117cd src/core/live.ts POST /census (config set census --for-tree v prostředí aplikace, bez okna) · CHANGELOG.cs.md 3.31.0 „Sčítání lidu z výzkumu“ · dirigent:spec/106 K1.1, K1.4 -->

<a id="S4.4.11"></a>
### S4.4.11 Výzkum u stromu › Materiály: soubory projde agent sám

Jestli soubory poslané do výzkumu projde agent sám ([R11.6](R11-material-from-the-user.md#R11.6)), jde zapnout a
vypnout i v aplikaci. Zapisuje se přes most hned po kliknutí, oběma směry, a je to rozhodnutí člověka v aplikaci.

- **Skupina Materiály** s přepínačem **Soubory poslané do výzkumu projde agent sám** a větou „Soubory poslané do
  výzkumu (dávky, jednotlivé soubory, skeny pramenů) dostanou úkoly pro agenta: připojí je k osobám, pojmenuje je
  a založí prameny. Čerpá předplatné nebo kredit. Vypnuto: soubory čekají v Materiálech a roztřídí se jen na
  požádání.“ Ve výchozím stavu je vypnutý.
- **Hranice:**
  - jen s výzkumem, který nastavení nabízí; se starším výzkumem skupina není a platí dosavadní texty. Ne u Archivu
    Stromu ani u výzkumu, který čeká na agenta; když se výzkum mezitím přepne na Archiv Stromu, skupina zmizí;
  - po kliknutí se nový stav ukáže hned, přerušovaně a zamčený, dokud výzkum zápis nepotvrdí;
  - bez mostu je přepínač neaktivní: „Výzkum neběží. Změnit to půjde, až poběží.“;
  - odmítnutí řekne důvod pod řádkem a přepínač zůstane, jak ho má výzkum (zaneprázdněný nebo zamčený výzkum,
    zápis drží jiný, plný disk);
  - přepínač platí pro tento strom; stejné nastavení platí i pro fotky z telefonu ([S5.4](S5-phone.md#S5.4)).
- **Ovládání:** aplikace: **Výzkum → Další → Výzkum u tohoto stromu… → Materiály → Soubory poslané do výzkumu
  projde agent sám**. Terminál: [R11.6](R11-material-from-the-user.md#R11.6).
- **Platí od:** výzkum 1.36.0, aplikace 3.31.0

<!-- zdroj: app:74d06317 src/ui/research-tree-settings-ui.ts renderResearchIntakeRow (features intake.auto, /status.intake, researchAgentlessFor, storiesBridgeDown, pend), setResearchIntake (POST /intake, archive → gone, busy, held, locked, full) · src/research-link.ts postBridgeIntake · strings.ts history.intakeSection, intakeTitle, intakeDesc · research:src/core/live.ts POST /intake (intake.body, intake.archive), /status intake · dirigent:spec/130 K2.1 -->

<a id="S4.4.12"></a>
### S4.4.12 Výzkum u stromu › Nejvýš agentů najednou

V okně **Výzkum u tohoto stromu…** je pod volbou agenta řádek **Nejvýš agentů najednou**: kolik běhů smí na stromu
pracovat najednou, běh celé fronty i běhy linií dohromady ([R7.10.1](R7-when-the-agent-works.md#R7.10.1)).

- **Hranice:**
  - pole s **−** a **+**, od 1 do stropu, který řekne výzkum (10); pod ním „Výchozí 3. Do počtu se počítá i práce na
    celé frontě.“;
  - snížení zapíše aplikace přes most hned. Snížení pod počet běžících běhů žádný nezastaví, nové se nespustí;
  - zvýšit z aplikace nejde: hodnota se vrátí a řádek řekne „Zvýšit jde jen v terminálu výzkumu.“ s příkazem
    `strom config set run.parallel 4` ke zkopírování;
  - při plném počtu je **Pustit agenta na tuto linii** ([S4.3.3](#S4.3.3)) i **Pracovat na frontě…**
    ([S4.2.3](#S4.2.3)) nepřístupné a odkaz **Nastavení ›** otevře toto okno na tomto řádku. Běžící běhy se nemění;
  - řádek není se starším výzkumem (platí 3), v Archivu Stromu a u výzkumu, který čeká na agenta.
- **Ovládání:** aplikace: **Výzkum → Další → Výzkum u tohoto stromu… → Nejvýš agentů najednou**. Terminál:
  `strom config set run.parallel <n>`.
- **Platí od:** aplikace 3.31.0 (výzkum 1.36.0)

<!-- zdroj: app:4de0835a src/ui/research-tree-settings-ui.ts renderResearchRunsRow (pod dl.research-tree-agent; bez run.limit, v archivu a bez agenta se nekreslí; RUN_LIMIT_MIN 1, cap z výzkumu), setResearchRunsMax (POST settings/runs, 403 runs.raise → runsMaxRaise + příkaz) · src/research-runs.ts atRunLimit · strings.ts research.runsMax, runsMaxHint, runsMaxRaise, live.runsLimitReached, runsSettingsLink · research:src/core/live.ts runsLimitWrite, src/core/liveruns.ts runLimits (cap 10) · app:docs/ZADANI_DEV_beh-po-liniich.md §5 · dirigent:spec/126 K2.3 -->

<a id="S4.5"></a>
## S4.5 Akce, které otevřou výzkum

Většina akcí výzkumu v aplikaci je odkaz `strom-research://`. Odkaz otevře terminál výzkumu na tomtéž počítači.
Terminál řekne, co aplikace žádá, a zeptá se. Bez potvrzení v terminálu se nic nezapíše ani nezaplatí. Výjimkou je
jen práce agenta na předplatné nebo kredit AI, když je tak nastavený tento počítač ([S4.5.5](#S4.5.5)).

- **Hranice:**
  - Akce je vidět jen na počítači (ne na dotykovém zařízení), jen když výzkum odkaz ohlásil a jen když je zapnuté
    **Strom Research na tomto počítači**.
  - Odkaz nese jen čísla záznamů a pevné hodnoty, žádná jména ani volný text.
  - Terminál začne **Aplikace Strom žádá: … / Výzkum: …** a zeptá se **Pokračovat?** U práce agenta
    připíše **Agent pracuje na předplatné nebo kredit AI.**, u zadání úkolů **Výzkum zapíše úkoly pro agenta – teď
    se nic nehledá a nic se neplatí.** Při **Spouštění agenta z aplikace Strom: bez potvrzení** se práce agenta
    spustí bez dotazu ([S4.5.5](#S4.5.5)).
  - Archiv Stromu a výzkum, který čeká na agenta, práci agenta odmítnou (rozhovor, prověření, hledání, místa, dějiny).
  - Když stejná aktivní linie už je, **Hledat předky** jen řekne **Taková linie výzkumu už je: „…“ – agent v ní
    pokračuje.**
  - Prvek, kterým se odkaz otevřel, říká **Otevírá se výzkum…** (u práce agenta **Otevírá se agent…**, u odkazu bez
    terminálu **Načítá se…**), dokud výzkum nepotvrdí, že odkaz převzal ([S4.5.4](#S4.5.4)), nejdéle 10 s (práce na
    frontě 30 s, [S4.2.3](#S4.2.3)). Druhý klik mezitím nic znovu neotevře. Bez potvrzení se prvek uvolní a pod ním
    stojí **Terminál se neotevřel?** se **Zkusit znovu** a radou **Když se nic neotevřelo, je potřeba spustit Strom
    Research.** U odkazu bez terminálu stojí **Když se nic nestane, Strom Research ještě neběží.** Výzkum starší než
    1.35.0 převzetí potvrdit neumí: bez nového sezení agenta se prvek po 10 s uvolní tiše, bez věty.
  - Systémový dialog prohlížeče, který se před otevřením odkazu ptá, aplikace nevidí. Potvrzený pozdě větu po
    limitu sám smaže ([S4.5.4](#S4.5.4)).
- **Ovládání:** aplikace: **Nastavení → Data a soukromí → Strom Research na tomto počítači**.
- **Platí od:** aplikace 3.4.0 (výzkum 1.6.0). Odmítnutí v Archivu Stromu od výzkumu 1.14.0, při čekání na agenta od
  1.15.0. Čekání na otevření od aplikace 3.30.0; do 3.29.0 aplikace nepoznala, jestli se terminál otevřel, a ukázala
  jen oznámení **Otevírám výzkum…** s radou.

<!-- zdroj: app:v3.21.2 src/ui/research-ui.ts researchLinkAvailable, launchResearchLink, :841 onComputer · strings.ts research.linksSetting, research.openingQuietHint · index.html linksSetting · research:v1.25.2 src/commands/links.ts:128 refusedHere, :153 inTerminal, :351 ui.research.exists · src/core/links.ts (hlavička) · assets/lang/cs.json ui.link.asks, ui.link.go, ui.link.cost, ui.link.tasks, ui.archive.refuse, ui.waiting.refuse · 3.30.0: app:574e7ef9, f63cc742 src/ui/research-ui.ts launchResearchLink → src/ui/research-open-busy.ts openResearchBusy (openingResearch / openingAgent / generic podle značky, BUSY_TIMEOUTS.terminal 10 s, queueWork 30 s, notOpened + notOpenedHint, bez terminálu research.openingQuietHint, retry) · strings.ts busy.* · CHANGELOG.cs.md 3.30.0 „Tlačítka, která čekají“ · ZADANI_DEV_tlacitka-cekani.md §3.1 · app:c3e09951 (79a05311) research-open-busy.ts unprovable → tichý konec u výzkumu bez handoffs (n1 N2) -->

<a id="S4.5.1"></a>
### S4.5.1 Značky akcí

Každá akce výzkumu má jednu ze tří značek podle toho, co otevře.

| Značka | Co se stane | Akce |
|---|---|---|
| bez značky | nic neotevře terminál | **Sledovat živě**, výřez a originál v prohlížeči, načtení stromu |
| terminál | terminál ukáže nebo se zeptá; kliknutím se nic neplatí | **Otevřít výzkum**, poslání úprav, **Prověřit znovu…**, **Hledat předky**, **Odložit**, **Vzdát**, akce linie, **Dokončit a skončit**, **Vrátit poslední poslání**, nastavení, **Kontrola výzkumu** |
| AI a terminál | práce agenta, platí ji předplatné AI | **Pokračovat s agentem**, **Zeptat se agenta**, **Pracovat na této linii**, rozhovor k úkolu nebo rozporu, výzkum míst, dějiny místa |

- **Hranice:** u práce agenta říká prvek při otevírání **Otevírá se agent…** ([S4.5](#S4.5)). Rozhovor může místo
  terminálu otevřít aplikaci agenta, když je tak výzkum nastavený.
- **Platí od:** aplikace 3.21.0. Do 3.29.0 aplikace při otevírání práce agenta ukázala oznámení **Otevírám agenta…**
  s **Dotazy se zadávají agentovi. Práce agenta čerpá předplatné AI.**
- **Od aplikace 3.28.0:** **Pracovat na frontě…** a v jeho dialogu **Otevřít terminál** mají značku AI a terminál
  ([S4.2.3](#S4.2.3)). Hledání ve frontě, **Udělat jako další** a **Vrátit** jsou bez značky: jdou přes most a nic
  neotevřou ([S4.2.1](#S4.2.1), [S4.2.2](#S4.2.2)).

<!-- zdroj: app:v3.21.2 src/research-link.ts:66 RESEARCH_LINK_MARKS, researchLinkMark (task do=chat, conflict do=agent, experiment do=off, fixes paid) · strings.ts research.openingAgent, research.openingAgentHint · research:v1.25.2 src/commands/links.ts:373 whereToTalk · 3.28.0: app 9cf43b22 researchLinkMark('work') u queue-work-btn, research-item-queue-work, Otevřít terminál; ZADANI_DEV_fronta-hledani „Značení akcí“ · 3.30.0: app:574e7ef9 research-open-busy.ts busy.openingAgent na prvku; research.openingAgentHint se už nepoužívá -->

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
- **Od aplikace 3.28.0:**
  - v menu **Výzkum** je pod **Pokračovat s agentem** položka **Pracovat na frontě…** ([S4.2.3](#S4.2.3)), když se
    nabízí. Když je nahoře víc než 6 položek, přesune se do **Další akce** jako první **Otevřít výzkum**;
  - v **Teď** stojí akce pod textem každého sezení, v jednom řádku: **Ukázat ve stromu** · **Dokončit a skončit**.
    Na telefonu je jen **Ukázat ve stromu**.

<!-- zdroj: app:v3.21.2 src/ui/research-actions-ui.ts:152 UNDO_MAX_AGE_MS, :158 FIRST_LEVEL_MAX, :300 researchMenuShown, :435 tools, :1000 personResearchActions · src/research-link.ts:115 RESEARCH_TOOL_GROUPS, :132 RESEARCH_TOOL_ACTIONS · research-overview-ui.ts:811, :870 finishSession · strings.ts research.footerFull, research.tools.*, research.reviewWhere, research.continueAgent · 3.28.0: app 9cf43b22 src/ui/research-actions-ui.ts research-item-queue-work za research-item-chat (queueWorkMenuOffered), FIRST_LEVEL_MAX 6: research-item-open do more · 623d9c77 src/ui/research-overview-ui.ts overviewNowActions (now-actions pod textem: showInTree · finishSession, finish ne v sheet), overviewNowLine (každé sezení svůj řádek) · ZADANI_DEV_fronta-hledani §6 (varianta A) -->

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
- **Od výzkumu 1.36.0:** při **Spouštění agenta z aplikace Strom: bez potvrzení** začne rozhovor bez dotazu, jen když
  cena podobných sezení zatím není známá. Se známou cenou se ptá dál ([S4.5.5](#S4.5.5)).

<!-- zdroj: research:c2a690ea src/cli/menu-links.ts (odkaz task bez do, úkol open) · assets/lang/cs.json ui.link.open.title/why/done/pick/chat/ahead/keep/already/kept/busy/estimate/estimate.none, ui.chat.task.open.say · strom help chat (--task: „a task in the queue (open): gone through now, taken up in the conversation“) · commit 9bd14e84 · test/cli/link-open-task.test.ts · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 7; klik v aplikaci neověřen) · app:6bd8609e strings.ts read.openTaskN, src/__tests__/read-source-state-view.test.ts:75 (researchLinkMark task) -->

<a id="S4.5.4"></a>
### S4.5.4 Výzkum potvrdí převzatý odkaz

Výzkum aplikaci řekne, že odkaz převzal: terminál naběhl, nebo je hotová akce, která terminál nepotřebuje. Aplikace
tak přestane čekat hned a ozve se, jen když se nic neotevřelo ([S4.5](#S4.5)).

- **Hlídá kód:**
  - aplikace dá každému odkazu výzkumu nové číslo předání (`&handoff=<uuid>`). Výzkum vezme jen číslo tvaru UUID;
    jinou hodnotu tiše vynechá a odkaz provede jako bez ní. Z čísla se nikdy nic nespouští;
  - `strom link open` číslo zapíše do `.strom/handoffs/` v každé kopii výzkumu toho stromu na počítači. U odkazu,
    který otevírá terminál, hned, jak terminál naběhne, před první otázkou. U odkazu bez terminálu (výřez, snímky,
    kniha, sledování a další) až po hotové akci;
  - číslo se nezapíše, když se terminál otevřít nepodařilo, u odmítnutého odkazu (neznámý výzkum, archiv, okno
    s hláškou) ani u odkazu na nový výzkum ze stromu aplikace (`new?app=…`): ten ještě nemá výzkum ani most.
    Systémový dialog prohlížeče zavřený bez otevření strom vůbec nespustí;
  - most výzkumu říká v `GET /status` (`handoffs`, i s `parts=1`) čísla odkazů převzatých za poslední minutu,
    nejnovější první, nejvýš 64; starší čísla i jejich soubory zmizí. Čte je při každém dotazu, ne až se změní stav
    výzkumu. Platí i v Archivu Stromu a ve výzkumu, který čeká na agenta;
  - aplikace se po předání odkazu ptá mostu každou sekundu až do limitu. Potvrzení, které přijde do minuty po
    limitu (dialog prohlížeče potvrzený pozdě), větu **Terminál se neotevřel?** smaže;
  - most, který na dotaz před méně než 30 s neodpověděl, platí za nedostupný: věta se ukáže hned, bez čekání;
  - tentýž odkaz otevřený znovu do 400 ms nic neudělá.
- **Hranice:**
  - výzkum, který potvrzení nemá (starší než 1.35.0): za potvrzení platí nové sezení agenta. Jinak se prvek po limitu
    uvolní tiše, bez věty **Terminál se neotevřel?**: aplikace nepozná, jestli terminál naběhl. Most, který
    neodpovídá, větu řekne i tady. Práce na frontě má vlastní důkaz a větu ([S4.2.3](#S4.2.3));
  - odkaz na nový výzkum (`new?app=…`) končí po limitu potichu; dál aplikace čeká, až si výzkum strom vezme;
  - bez běžícího mostu se nic nehlásí a zapsaný soubor sám zanikne.
- **Ovládání:** aplikace: každá akce se značkou terminál nebo AI a terminál ([S4.5.1](#S4.5.1)). Terminál:
  `strom link open '<odkaz>'`.
- **Platí od:** aplikace 3.30.0, výzkum 1.35.0

<!-- zdroj: research:fbae81fc src/core/handoffs.ts (HANDOFF tvar UUID, HANDOFF_MS 60 s, HANDOFF_MAX 64, handoffsNow úklid, noteHandoff) · src/core/links.ts parseLink (handoff malými písmeny, jiná hodnota vynechána), linkText · src/commands/links.ts link open noteTaken (tty hned; bez terminálu done: true; researchesWithId) · src/core/live.ts withHandoffs (/status i parts=1, mimo stav), BRIDGE_FEATURES handoffs · test/cli/link-handoffs.test.ts · CHANGELOG.cs.md 1.35.0 (odkaz aplikace Strom … výzkum aplikaci potvrdí) · app:574e7ef9, f63cc742 src/ui/research-open-busy.ts (handoffProven: handoffs s feature handoffs, jinak nové sezení; OPEN_ASK_MS 1000, OPEN_LATE_ASK_MS 2000, OPEN_LATE_WATCH_MS 60 s, OPEN_REPEAT_MS 400, bridgeDown 30 s, quietLimit new?app=) · src/research-link.ts HANDOFFS_FEATURE · app:docs/ZADANI_VYZKUM_tlacitka-cekani.md „Odpověď výzkumu“ · app:c3e09951 (79a05311) src/ui/research-open-busy.ts unprovable (poslední status bez feature handoffs → quietEnd: po limitu bez věty a bez pozdního hlídání; most dole → věta hned; opts.proof fronty beze změny) · dirigent:prace/1118-app-tlacitka-n1 (N2, Milan 18. 11.) -->

<a id="S4.5.5"></a>
### S4.5.5 Spouštění agenta z aplikace bez potvrzení

Nastavení tohoto počítače **Spouštění agenta z aplikace Strom** určuje, jestli se terminál před prací agenta, o kterou požádala
aplikace, zeptá **Pokračovat?** Výchozí je **s potvrzením**: terminál řekne, co aplikace žádá, že agent pracuje na
předplatné nebo kredit AI, a čeká na ano ([S4.5](#S4.5)). **Bez potvrzení** se práce agenta spustí hned a terminál to
řekne jednou řádkou: **▶ Spouští se bez potvrzení (výzkum …): …** a kde se dotaz znovu zapíná.

- **Hlídá kód:**
  - bez dotazu se spustí jen akce, které pouští agenta na předplatné nebo kredit AI: rozhovor s agentem (i o osobě
    nebo linii), rozhovor o úkolu ve frontě ([S4.5.3](#S4.5.3)) nebo v **Čeká na vyřízení**, rozpor ponechaný agentovi
    ([R5.6](R5-conflicts.md#R5.6)), práce na frontě ([R7.1.2](R7-when-the-agent-works.md#R7.1.2)) a určení míst;
  - dál se ptá:
    - dotaz, který řekne cenu v penězích: odhad u úkolu ve frontě, určení míst se změřenou cenou sezení;
    - každý odkaz, který otevře agent nebo skript bez terminálu člověka;
    - odeslání žádosti, souhlasy archivů a hostů (`strom allow`), mazání, zadání úkolů pro agenta a dějiny místa;
    - podmínka samostatné práce (`run.gate`): práce na frontě se jí ptá jako dosud
      ([R7.4](R7-when-the-agent-works.md#R7.4), [R7.4.1](R7-when-the-agent-works.md#R7.4.1));
  - když na výzkumu už běží jiné sezení nebo běh, nic dalšího se nespustí ani bez potvrzení;
  - volba platí pro všechny výzkumy na tomto počítači, ne pro jeden strom. V Archivu Stromu ji menu nenabízí;
  - **bez potvrzení** zapne jen člověk: terminál řekne, co se dál ptá, a chce druhé ano (Enter = ne). Když nastavení
    spouští agent nebo příkaz bez terminálu, ptá se člověka okno systému; bez okna strom nastavení odmítne.
    Zpět na **s potvrzením** smí kdokoli, bez dotazu;
  - aplikace Strom volbu nemá ani nemění. Hodnotu ukazuje `strom config` a zpráva `strom error`
    ([R13](R13-reporting-a-problem.md#R13)).
- **Ovládání:** terminál: menu **Nastavení** → **Jazyk, agent, model, co smí agent sám, příběhy… (průvodce
  nastavením)** → **Spouštění agenta z aplikace Strom: …** → **Ptát se před spuštěním (výchozí)** nebo **Spouštět bez
  potvrzení**; `strom config set run.confirm no`, zpět `strom config unset run.confirm`. Platnou hodnotu ukáže
  `strom config where`.
- **Platí od:** výzkum 1.36.0

<!-- zdroj: research:8aa0f374 src/core/config.ts run.confirm (ask|no, tree: false, env žádná), Settings.runConfirm · src/cli/menu-links.ts asksToStart (priced || runConfirm !== no || !ctx.interactive || isAgent → asks; jinak ui.link.noconfirm) u openTask (priced = taskEstimate), waitingDo chat, placesRun (priced = est.session.usd || fronta), workRun, workOn · src/commands/links.ts conflict do=agent, chat (direction/person) · placeSearch dál asks (placeCost), review/research ui.link.tasks dál asks · src/commands/setup.ts setUserSetting run.confirm no → requireHumanYes (ui.consent.run.confirm), FALLBACKS run.confirm ask · src/cli/context.ts requireHuman (terminál → humanYes, jinak okno systému, jinak odmítnutí) · src/cli/menu-settings.ts runConfirmStep (ui.runconfirm.*, ui.runconfirm.about; jen !archive), unset pro ask · src/core/report.ts CONFIG_PLAIN runConfirm · cs.json ui.settings.runconfirm, ui.runconfirm.*, ui.link.noconfirm · strom help link · CHANGELOG.cs.md 1.36.0 „Agent z aplikace Strom bez potvrzení“ · test/cli/run-confirm.test.ts, test/cli/gates.test.ts · spec 123 K1.1–K1.5 (K1.4 bez zápisu do logu výzkumu: rozhodnutí dirigenta 20. 11.) -->

<a id="S4.6"></a>
## S4.6 Co je jen v terminálu

Aplikace ukazuje a žádá, rozhoduje terminál. Co potřebuje souhlas člověka nebo stojí peníze, se vždy potvrzuje
v terminálu výzkumu, i když to začne kliknutím v aplikaci.

- **Hranice:**
  - Jen v terminálu: spuštění samostatné práce agenta a její meze ([R7.1](R7-when-the-agent-works.md#R7.1)),
    podmínka, volba agenta, nastavení fronty a položky **Jen tady v terminálu**
    ([R6.1.1](R6-awaiting-action.md#R6.1.1)).
  - Potvrzují se v terminálu: vše se značkou terminál nebo AI ([S4.5.1](#S4.5.1)), v 3.21.2 i akce linií a fronty.
    Práci agenta bez ceny v penězích jde od výzkumu 1.36.0 spouštět bez potvrzení ([S4.5.5](#S4.5.5)); tuto volbu
    zapíná jen člověk v terminálu.
  - Na telefonu odkazy nejsou; odpovídá se ve výzkumu na počítači ([S5](S5-phone.md)).
- **Platí od:** aplikace 3.4.0 (výzkum 1.6.0)
- **Od aplikace 3.22.0:** s výzkumem 1.26.0 jdou bez terminálu linie ([S4.3.1](#S4.3.1)), práce mimo linie po
  větvích
  ([S4.3.2](#S4.3.2)) a místo úkolu ve frontě ([S4.2](#S4.2)).
- **Od aplikace 3.28.0:** s výzkumem 1.32.0 jde o samostatnou práci agenta na frontě požádat z aplikace
  ([S4.2.3](#S4.2.3)). Spustí ji terminál výzkumu až po potvrzení ([R7.1.2](R7-when-the-agent-works.md#R7.1.2));
  podmínka a její nastavení zůstávají v terminálu.

<!-- zdroj: research:v1.25.2 src/core/links.ts (hlavička: nic se nezapíše bez slova člověka v terminálu) · src/core/live.ts (hlavička mostu) · app:v3.21.2 src/research-link.ts:66 · HEAD src/research-directions-write.ts · 3.28.0: app 9cf43b22 src/ui/queue-work-dialog.ts (aplikace nic nespouští, odkaz work) · spec 052 K6.2 (cesta terminál) -->
