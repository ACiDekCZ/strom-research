<a id="A9"></a>
# A9 Ovládání aplikace

Kde co v aplikaci Strom je, jak se prvky jmenují a co zůstává člověku. Platí stejně pro člověka, pro čtečku
obrazovky i pro agenta, který stránku čte nástroji prohlížeče. Popisuje aplikaci Strom 3.25.0 a výzkum 1.29.0.

<!-- zdroj: dirigent:spec/063-computer-use-usnadnit K1.1, K1.3, K1.4, K1.5 · test/vysledek-063-pruzkum.md kolo 2 (A1–A7) · app:CHANGELOG.cs.md 3.25.0 -->

<a id="A9.1"></a>
## A9.1 Kde co je

Aplikace ukazuje okolí jedné osoby ([A1.3](A1-the-app-in-brief.md#A1.3)). Co se týká osoby, je v nabídce osoby;
co se týká celého stromu, je v liště a v menu **Akce**.

| Úkol | Kde v aplikaci | Pravidlo |
|---|---|---|
| najít osobu | pole **Hledat osobu...** v liště | [A4.8](A4-surnames-and-families.md#A4.8) |
| nabídka osoby | klik na kartu osoby, nebo Enter na kartě; na dotykovém zařízení dlouhý stisk karty otevře spodní panel se stejnými akcemi | [A6.1](A6-views.md#A6.1) |
| Co ví výzkum o osobě | nabídka osoby → **Výzkum → Co ví výzkum** | [S3.2](S3-what-the-research-knows.md#S3.2) |
| prameny osoby | nabídka osoby → **Prameny** | [A3.6](A3-evidence-in-the-app.md#A3.6) |
| prameny stromu | **Akce → Prameny** | [A3.1](A3-evidence-in-the-app.md#A3.1) |
| upravit osobu | nabídka osoby → **Upravit** | [S2](S2-edits-from-the-app.md), při sledování [A9.3](#A9.3) |
| pohled Mapa a další pohledy | přepínač pohledů v liště; na telefonu, tabletu a v okně do 1024 px dolní lišta a **Více → Pohled** | [A6](A6-views.md), [A9.5](#A9.5) |
| celý strom v řádcích, export CSV a XLSX | **Tabulka** v přepínači pohledů; na telefonu, tabletu a v okně do 1024 px **Tabulka** na dolní liště | [A6.7](A6-views.md#A6.7) |
| seznamy osob (pevné, automatické, pracovní) | **Akce → Seznamy osob…**; na telefonu **Více → Seznamy osob** | [A11](A11-lists-of-people.md) |
| výřez portrétu, fotka svazku | úprava osoby → **Vybrat fotku**, **Upravit výřez**; úprava osoby → **Spravovat vztahy** → řádek **Fotka** | [A12](A12-portrait-and-couple-photo.md) |
| sbalit minimapu nebo legendu stromu | ouško nad minimapou; **◯** v legendě | [A9.6](#A9.6) |
| celá obrazovka (telefon a tablet) | **Více → Celá obrazovka**; na iPhonu v Safari **Více → Celá obrazovka…** | [A9.5](#A9.5) |
| pohled nebo Přehled výzkumu v samostatném okně (na počítači) | ⧉ **Otevřít v novém okně** vedle přepínače pohledů; Ctrl+klik (macOS ⌘+klik) na záložku pohledu; ⧉ v liště Tabulky a v hlavičce Přehledu | [A6.8](A6-views.md#A6.8), [S4.1.6](S4-research-from-the-app.md#S4.1.6) |
| podklad mapy | **Zobrazit mapu** u upozornění, že se podklad načítá z openstreetmap.org | [A9.4](#A9.4) |
| místa mimo mapu | stavový pruh mapy → **Ve výzkumu**; ve výzkumu oddíl **Čeká na vyřízení** | [A6.5.2](A6-views.md#A6.5.2), [R4.5](R4-places.md#R4.5) |
| práce výzkumu | panel výzkumu, **⤢ Otevřít přehled**; menu **Výzkum → Přehled výzkumu** | [S4.1](S4-research-from-the-app.md#S4.1) |
| co čeká na člověka | panel, oddíl **Čeká na vyřízení**; menu **Výzkum → Čeká na vyřízení** | [S4.4](S4-research-from-the-app.md#S4.4) |
| sledování výzkumu | **Sledovat živě**; konec **Ukončit sledování** | [S1.4](S1-connecting-app-and-research.md#S1.4), [A9.3](#A9.3) |
| posílání úprav do výzkumu | **Výzkum → Další → Výzkum u tohoto stromu… → Posílat úpravy** | [S2.2](S2-edits-from-the-app.md#S2.2) |
| pravidla a pojmy | **Akce → Jak Strom funguje** | [A1.7](A1-the-app-in-brief.md#A1.7) |
| zpět na výchozí osobu stromu | ⌂ na začátku **Zaměřeno na**; klávesa H | [A6.1.6](A6-views.md#A6.1.6), [A9.8](#A9.8) |
| akce, která chvíli trvá | stav na tlačítku (kolečko a co se děje); dlouhá akce v oznámení s průběhem | [A9.7](#A9.7) |

- **Hranice:**
  - položky výzkumu jsou jen u stromu z výzkumu; tlačítka, která výzkum otevírají, jen na počítači, kde výzkum
    běží ([S3.2](S3-what-the-research-knows.md#S3.2));
  - aplikace se s výzkumem spojí odkazem z terminálu, `strom app` ([S1.2](S1-connecting-app-and-research.md#S1.2)).
- **Ovládání:** jak v tabulce.
- **Platí od:** aplikace 3.25.0 (souhrn; každé místo platí od verze ve svém pravidle)

<!-- zdroj: app:index.html search input (search.placeholder) · src/renderer.ts card.onclick → UI.showContextMenu, klávesy Enter/Space · src/ui/bottom-sheet.ts (dlouhý stisk, menu.sectionView) · SPEC.md Long-press → bottom sheet · strings.ts search.placeholder, mobileMenu.more, menu.sectionView, map.tilesNotice, map.tilesNoticeOk, research.stop · cesty z pravidel A3.1, A3.6, A6, A6.5.2, A11 (od 3.30.0, index.html #actions-lists-row, bottom-sheet.ts sheet-lists), A12 (od 3.30.0, app:88859da2 person-modal.ts, 9a47896e relationships-panel.ts; tlačítka otočení fotky přesunuta do editoru), S1.4, S2.2, S3.2, S4.1, S4.4, A1.7 · okna: A6.8, S4.1.6 (app:4b1373a7 src/windows/window-controls.ts) · dolní lišta a Celá obrazovka: A9.5 (app:4b1373a7, commit bb5e4d12) · akce, která trvá: A9.7 (app:2d01dffd src/ui/busy.ts) -->

<a id="A9.2"></a>
## A9.2 Prvky mají čitelný název

Každý ovládací prvek má název, který přečte čtečka obrazovky i nástroj prohlížeče, který čte stránku. Vzhled se tím
nemění.

- **Hranice:**
  - tlačítka jen s ikonou mají název: zvětšení, filtry, zpět a vpřed, otočení fotky (od aplikace 3.30.0 v editoru
    výřezu portrétu, [A12.1](A12-portrait-and-couple-photo.md#A12.1)), náhled, seznam u hledání osoby
    (**Zobrazit seznam**), propojený soubor, odkaz na zdroj místa (**Otevřít zdroj**) a další;
  - zavřené dialogy a menu se nečtou: nejsou ve stromu přístupnosti ani v tom, co nástroj prohlížeče na stránce
    najde;
  - spodní panel během vysouvání nebere klik ani ťuknutí, aby se netrefila jiná položka;
  - s omezeným pohybem (nastavení systému) se menu, oznámení a spodní panel ukážou bez animace;
  - zašedlá položka se přečte i se svým důvodem, ale nic nespustí ([A9.3](#A9.3)).
- **Ovládání:** nic: platí samo. Omezený pohyb: nastavení systému.
- **Platí od:** aplikace 3.25.0

<!-- zdroj: app:commity c641f7b8 (aria-label ikonových prvků, e2e a11y-names), 76f08f6a + 322b08c3 (zavřené dialogy a menu mimo strom přístupnosti, spodní panel inert při vysouvání, prefers-reduced-motion), 4a8b4fed · strings.ts personPicker.showList, places…dSourceOpen · CHANGELOG.cs.md 3.25.0 „Čtečky obrazovky“ · dirigent:test/vysledek-063-pruzkum.md A1–A3 -->

<a id="A9.3"></a>
## A9.3 Úpravy během sledování výzkumu

Strom, který se sleduje živě, je jen pro čtení ([S1.4](S1-connecting-app-and-research.md#S1.4)). Aplikace ukáže,
proč úprava nejde a jak sledování ukončit.

- **Hranice:**
  - během sledování ukáže nabídka osoby zašedlé **Upravit** s důvodem **Během sledování výzkumu jen ke čtení.**
    a hned pod ním **Ukončit sledování**. Platí na počítači i na telefonu;
  - **Ukončit sledování** v nabídce osoby ukončí sledování stejně jako tlačítko v panelu výzkumu;
  - po ukončení sledování se aplikace hned jednou zeptá **Jak posílat úpravy do výzkumu?**, když se u stromu ještě
    neptala a výzkum běží a úpravy přijímá ([S2.2](S2-edits-from-the-app.md#S2.2)).
- **Ovládání:** aplikace: nabídka osoby → **Ukončit sledování**; panel výzkumu → **Ukončit sledování**.
- **Platí od:** aplikace 3.25.0

<!-- zdroj: app:src/ui/context-menu.ts (edit-following disabled + note, live-stop link), src/ui/bottom-sheet.ts (aria-disabled), src/ui/research-sync-ui.ts researchAskSendModeAfterFollow · strings.ts contextMenu.editFollowing, research.stop, treeSettings.askTitle · commity ffed0d42, cc26c35a, cf0352cd · CHANGELOG.cs.md 3.25.0 „Úpravy během sledování výzkumu“ · dirigent:spec/063-computer-use-usnadnit K1.4 -->

<a id="A9.4"></a>
## A9.4 Agent v aplikaci

Agent, který aplikaci Strom ovládá, ji ovládá nástroji stránky v prohlížeči, stejně jako ji čte čtečka obrazovky.
Akce výzkumu jdou spolehlivěji příkazem `strom`. Strom nikde nedoporučuje ovládání počítače zapnout
([R12.10](R12-where-the-agent-works.md#R12.10)).

- **Hranice:**
  - nástroje stránky mají vestavěný prohlížeč aplikace Claude a Claude in Chrome. Ovládání počítače v aplikaci Claude
    prohlížeč jen čte (snímek obrazovky): klikat a psát v něm nejde ([R12.10](R12-where-the-agent-works.md#R12.10));
  - most do aplikace Strom agentovi zůstává zavřený: agent pracuje se stránkou, ne s mostem
    ([R12.2](R12-where-the-agent-works.md#R12.2));
  - souhlas s podkladem mapy (**Zobrazit mapu**), otázka **Jak posílat úpravy do výzkumu?** a další volby
    a nastavení člověka zůstávají člověku.
- **Jen metodika:** agent klikne na prvek podle odkazu, který mu dal nástroj hledání na stránce, ne podle souřadnic,
  a počká, až spodní panel dojede, než klikne znovu. Akce výzkumu dělá příkazem `strom` ve své příkazové řádce;
  v aplikaci jen to, co příkaz nemá. Na volbu člověka nekliká: řekne, co na člověka čeká.
- **Ovládání:** nic: platí pokyny ve složce výzkumu (`AGENTS.md`).
- **Platí od:** výzkum 1.29.0; aplikace 3.25.0

<!-- zdroj: research:src/agents/files.ts AGENTS.md „## When you have computer use“ (page tools, click by the reference find gives, never by coordinates, wait until a sliding panel has stopped; Claude's computer use only looks at browsers; research through strom; consent or setting left to the person: map's OpenStreetMap, how edits are sent) · CHANGELOG.cs.md 1.29.0 · src/core/browser.ts + src/core/bridgeguard.ts (most odmítnut) · dirigent:test/vysledek-063-pruzkum.md kolo 1 (úrovně), kolo 2 (klik přes ref z find spolehlivý, klik podle souřadnic během vysouvání trefil jinou položku; souhlas Zobrazit mapu nekliknut; místo mimo mapu v Čeká na vyřízení) · spec/063-computer-use-usnadnit K1.2, K1.3, K1.5 -->

<a id="A9.5"></a>
## A9.5 Dolní lišta na telefonu a tabletu

Na telefonu, tabletu a v okně do 1024 px má aplikace místo přepínače pohledů dolní lištu. Ostatní pohledy a akce
jsou v listu **Více**.

- **Dolní lišta:** **Rodina** | **Potomci** | **＋** (přidat osobu; jen ve stromu, který jde upravit) | **Tabulka** |
  **Více**. Otevřená Rodina, Potomci nebo Tabulka se zvýrazní na liště; otevřený Vějíř, Mapa nebo Časová osa
  zvýrazní **Více**.
- **Více → Pohled:** **Vějíř** | **Mapa** | **Časová osa**. Na telefonu je pod nimi volba rodu
  ([A6.6](A6-views.md#A6.6)), když ji strom nabízí; v Časové ose, Mapě a Tabulce ne.
- **Celá obrazovka:** v listu **Více** je **Celá obrazovka**, při celé obrazovce **Ukončit celou obrazovku**.
  Lišty prohlížeče pak nezabírají místo.
  - Nabízí se jen tam, kde prohlížeč celou obrazovku stránce dovolí, a jen v režimu dolní lišty. Telefon otočený
    na šířku ji má jako čtvrtou dlaždici v řádku **Pohled**.
  - Na iPhonu nebo iPadu, kde prohlížeč celou obrazovku stránce nedovolí (Safari na iPhonu), je místo ní
    **Celá obrazovka…** s nápovědou: Strom přidaný na plochu (**Sdílet → Přidat na plochu**) se otevírá bez lišt
    prohlížeče, ale má vlastní oddělené úložiště; strom se do něj dostane exportem a importem. Aplikace spuštěná
    z plochy řádek nemá.
  - Když prohlížeč celou obrazovku odmítne, okno zůstane, jak je.
- **Ovládání:** dolní lišta; **Více → Pohled**; **Více → Celá obrazovka**.
- **Platí od:** aplikace 3.28.0 (do 3.27.0 měla dolní lišta místo **Tabulky** **Časovou osu** a Tabulka byla
  ve **Více → Pohled**)

<!-- zdroj: app:4b1373a7 index.html #bottom-bar (bb-view-family, bb-view-descendants, bottom-bar-fab edit-only, bb-view-table, bb-view-more) · src/ui/misc.ts:530–533 (active: table na liště; fan, map, timeline → Více) · src/breakpoints.ts isTabletOrMobile (≤ 1024 px), isPhoneBar, MQ_PHONE_LANDSCAPE · src/ui/bottom-sheet.ts blok 5 (Pohled: fan, map, timeline; rodRow jen isPhoneBar, ne timeline/map/table; fullscreenRow jen isTabletOrMobile, na šířku čtvrtá dlaždice) · src/ui/fullscreen.ts fullscreenOffer (fullscreenEnabled → enter/exit; iOS a ne standalone → ios-hint; jinak nic), toggleFullscreen (odmítnutí: okno beze změny) · src/file-copy.ts isIosDevice · src/pwa.ts isStandaloneDisplay · strings.ts mobileMenu.fullscreen, fullscreenExit, fullscreenIos, fullscreenIosText, menu.sectionView, viewModeSwitch.* · commit bb5e4d12 (dřív bb-view-timeline a v Pohledu Tabulka) · dirigent:spec/082-tester-3.28 K1.1, K1.3 · prace/1112-app-tester-328-telefon -->

<a id="A9.6"></a>
## A9.6 Minimapa a legenda stromu jdou sbalit

Minimapu a legendu stromu jde sbalit, aby nezakrývaly strom. Zařízení si volbu pamatuje pro všechny stromy.
Sbalení není vypnutí: zda se prvek ukazuje vůbec, dál rozhodují nastavení **Minimapa** a **Legenda stromu**.

- **Minimapa** (počítač a tablet, pohledy Rodina a Potomci, když je strom větší než okno):
  - na horní hraně bloku s minimapou je ouško: ⌄ sbalí minimapu (**Sbalit minimapu**), sbalená má ouško se značkou
    minimapy (**Rozbalit minimapu**). S myší je ouško vidět jen při najetí na blok nebo při zaměření klávesnicí,
    na dotyku vždy;
  - sbalená minimapa se skryje a nekreslí; tlačítka přiblížení zůstanou na svém místě;
  - výchozí je rozbaleno. Telefon minimapu nemá.
- **Legenda stromu:**
  - **◯** legendu sbalí do čipu „◯ Legenda“ a čip ji zase rozbalí. Tlačítkem je první část pilulky (při najetí se
    změní na ⌄, **Sbalit legendu**) a v panelu se značkami kartiček celá hlavička „◯ Legenda ⌄“;
  - výchozí je rozbaleno. Tah myší po legendě mimo tlačítko dál posouvá strom;
  - sbalený čip má tečku, když pohled ukazuje druh značky kartičky, který legenda na tomto zařízení ještě rozbalená
    neukázala; čtečka obrazovky čte „Legenda, nová značka“. Po rozbalení tečka zmizí;
  - **telefon** (na výšku i na šířku): legenda je vždy čip. Klepnutí ji otevře jako list zespodu (na šířku jako
    panel vpravo) s nadpisem „◯ Legenda“ a **Hotovo**. Zavře ho **Hotovo**, klepnutí vedle, tažení dolů (na šířku
    doprava) a Esc. Po obnovení stránky se sám neotevře a volbu zařízení telefon nečte ani nepíše;
  - od aplikace 3.30.0 ukazuje legenda vedle prstenců pohlaví i **Značení linií** ve zvoleném tvaru
    ([A6.1.5](A6-views.md#A6.1.5)).
- **Hranice:** bez úložiště prohlížeče (soukromé okno) platí volba do zavření stránky.
- **Ovládání:** ouško nad minimapou; **◯** v legendě, čip „◯ Legenda“. Vypnutí: nastavení **Minimapa**, **Legenda
  stromu**.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:f5d56ed3 src/ui/minimap.ts readMinimapOpen (strom-minimap-open, výchozí otevřeno), setMinimapFold (ouško jen když je minimapa nabízená), updateMinimap (isMinimapEnabled, mobil a telefon na šířku bez minimapy, STANDALONE_VIEWS, sbaleno: display none, nic se nekreslí) · src/ui/tree-legend.ts readTreeLegendOpen (strom-tree-legend-open, výchozí otevřeno), readTreeLegendSeen / noteTreeLegendSeen (strom-tree-legend-seen), syncTreeLegendFold (tečka, aria-label title + newMark, telefon vždy čip), openTreeLegendSheet (Hotovo = tour.done, klepnutí vedle, tažení 80 px dolů / doprava na šířku, nečte ani nepíše volbu), paměť bez úložiště · src/ui/misc.ts updateLegendMarks (data-marks: story-own, story-other, action, cross) · src/storage-keys.ts TREE_UI_STORAGE_KEYS · index.html .minimap-toggle (hover / pointer coarse), #tree-legend .tree-legend-toggle, pointer-events · strings.ts minimap.title, collapse, expand, settingLabel; legend.title, collapse, expand, newMark; settings legendLabel · app d78ba58b · dirigent:prace/1113-app-drobnosti-1112 · ZADANI_DEV_drobnosti-1112 §2 -->

<a id="A9.7"></a>
## A9.7 Akce, která chvíli trvá

Tlačítko nebo odkaz, jehož akce chvíli trvá, ukazuje, že pracuje, a skončí jednou zprávou: povedlo se, nebo proč ne.
Druhé kliknutí mezitím nic znovu nespustí.

- **Hranice:**
  - prvek se zamkne hned po kliknutí. Druhé kliknutí, Enter ani mezerník nic znovu nespustí. Prvek nezešedne,
    drží si barvu i fokus klávesnice a nemění šířku;
  - stav se ukáže až po 120 ms, aby krátké akce neblikaly, a zůstane vidět aspoň 300 ms: kolečko a slova, co se
    děje. Sloveso se změní na „… se…“ (**Poslat** → **Posílá se…**), jinak stojí **Načítá se…**; odkaz do terminálu
    říká **Otevírá se výzkum…** ([S4.5](S4-research-from-the-app.md#S4.5)). Při omezeném pohybu (nastavení
    systému) místo kolečka stojí tři tečky;
  - odkaz v textu a položka nabídky si text nechají a kolečko stojí za ním. Tlačítko jen s ikonou (⋯, ✕) má kolečko
    místo ikony ve stejné velikosti. Akce z nabídky, která se po kliknutí zavře, nechá stav na řádku, ke kterému
    patří (úkol, linie, materiál); bez takového řádku ho nese oznámení;
  - seznam nebo prvek, který se během práce překreslí (dotaz na most každou sekundu), stav drží bez přerušení: nový
    prvek ho má hned, takže mezitím nejde kliknout znovu;
  - úspěch tam, kde výsledek jinak vidět není, ukáže na prvku na 2 s fajfku se slovem (**Zapsáno**, **Uloženo**);
  - neúspěch je věta hned pod prvkem s **Zkusit znovu**. Když prvek mezitím zmizel (zavřené menu nebo dialog),
    řekne totéž oznámení; oznámení o chybě se samo nezavře a má ✕. Okno prohlížeče s hláškou se nepoužívá.
    „Nic se nenašlo“ chyba není: stojí neutrální věta a **Hledat jinak** ([A9.7.4](#A9.7.4));
  - každá akce má časový limit podle toho, na co čeká: dotaz na výzkum 15 s, zápis do výzkumu 30 s, načtení nebo
    poslání stromu 120 s, otevření terminálu 10 s, práce na frontě 30 s, služba na internetu 10 s na dotaz; další
    limity jsou v [A9.7.4](#A9.7.4). Výpočet v prohlížeči limit nemá;
  - na telefonu a tabletu platí totéž. List s nabídkou akcí se po volbě zavře hned a stav nese řádek.
- **Ovládání:** nic: platí samo.
- **Platí od:** aplikace 3.30.0, v celé aplikaci: odkazy do terminálu, **Poslat**, předání stromu výzkumu, načtení
  verze z výzkumu, přepnutí stromu, **Pracovat na frontě…**, **Text všech dotazů**, tlačítka v oznámeních, položky
  nabídek, odkazy a ikony, zápisy do výzkumu ([A9.7.2](#A9.7.2)), výpočty a soubory ([A9.7.3](#A9.7.3)). Do 3.29.0
  měla některá místa vlastní kolečko, jiná nic, a prvek, který pracoval, se ztlumil.

<!-- zdroj: app:2d01dffd, 7b69dba9, 574e7ef9, 6ee5a7f7, f63cc742, 3f841191, 1473151c, d2bdabac, c02df469, 6093a386, 58539c82 src/ui/busy.ts (runBusy: zámek 0 ms aria-disabled, BUSY_SHOW_MS 120, BUSY_MIN_MS 300, BUSY_DONE_MS 2000, šířka v jedné buňce .bl, bez ztlumení, konec věta .busy-msg + retry, prvek pryč → toast, BUSY_TIMEOUTS bridge 15 s, write 30 s, tree 120 s, terminal 10 s, queueWork 30 s, network 10 s, local bez limitu; reducedMotion tři tečky) · strings.ts busy.generic, sending, openingResearch, done.written, done.saved, retry · CHANGELOG.cs.md 3.30.0 „Tlačítka, která čekají“ · app:docs/ZADANI_DEV_tlacitka-cekani.md §1, §10, §13.1 (fáze 0–1) · dirigent:prace/1118-app-tlacitka-a · fáze 2–4: app:79a05311 (00fd19b6..2e1ec36f, 727f2fa7) src/ui/busy.ts trailsSpinner (a, .link, menuitem: kolečko za textem), iconOnly (kolečko místo ikony), rowOf (§4: stav na řádku), toastWhenGone, MutationObserver přenos stavu na překreslený prvek (727f2fa7, dřív kontrola co 400 ms); 00852929 jediné .busy-spin, ztlumení pracujících pryč; ZADANI_DEV §4, §5, §10.1, §11.1 · BUSY_TIMEOUTS.satellite 10 s a busy.mainWindowSilent v kódu jsou, ale žádné místo je nepoužívá: nepopsáno (nález) · dirigent:prace/1118-app-tlacitka-b, 1118-app-tlacitka-n1 -->

<a id="A9.7.1"></a>
### A9.7.1 Dlouhá akce: průběh v oznámení

Akce, která trvá déle, ukazuje svůj průběh v oznámení: co se právě děje a jak dlouho to trvá.

- **Hranice:**
  - oznámení s průběhem se ukáže, když akce běží déle než 3 s, nebo když prvek, který ji spustil, zmizel. Má
    název, krok („2 z 5“), od 10 s čas („· 12 s“) a po dvojnásobku obvyklé doby, nejdřív po 20 s, **Trvá déle
    než obvykle.** Úspěch ukáže souhrn s fajfkou na 4 s;
  - **Zrušit** má jen akce, kterou jde opravdu zrušit. Zápis do výzkumu zrušit nejde. Zavření dialogu akci
    nezruší;
  - předání stromu výzkumu ukazuje kroky (**Ukládá se záloha**, **Vytváří se GEDCOM**, **Výzkum přebírá strom**,
    načítání) a dialog jde nechat běžet s **Pokračovat na pozadí**;
  - přepnutí stromu napřed pošle do výzkumu neodeslané úpravy otevřeného stromu (**Před přepnutím se posílají úpravy
    do výzkumu…**), nejdéle 15 s. Když se do té doby neposlaly, strom se nepřepne: **Přepnutí se nepodařilo: úpravy se
    do 15 s neposlaly. Strom zůstal otevřený.** se **Zkusit znovu**;
  - během načtení verze z výzkumu, předání a přepnutí stromu úpravy stromu počkají: pokus o úpravu nic nezmění
    a oznámení řekne proč (**Strom se teď načítá z výzkumu – úpravy půjdou po načtení.**, **Strom se teď přepíná –
    úpravy půjdou po přepnutí.**). Prohlížení a hledání jdou dál;
  - práce po částech ukazuje, kde je: kniha rodu v novém okně **Připravuje se kniha…** s „kapitola 3 z 12“ a v hlavním
    okně oznámení s průběhem; „Vytvořit 3 stromy“ při rozdělení „Vytváří se strom 2 z 3: …“; šifrování všech stromů
    „Šifruje se strom 2 z 5…“; načtení velkého souboru počet osob, které už přečetlo;
  - průběhy dávky, nahrávání snímků, čtení dokumentu, obrazů pramenů a dohledání míst na mapě vypadají stejně: jeden
    pruh, vpravo „k z n“, akce vpravo dole;
  - odchod ze stránky, zatímco se posílá do výzkumu nebo načítá strom, prohlížeč napřed potvrdí. Když se stránka
    zavřela během zápisu, po dalším otevření řekne **Před zavřením se posílalo do výzkumu – výsledek není známý.**
    se **Zjistit**.
- **Ovládání:** aplikace: **Zrušit**, **Pokračovat na pozadí**, **Zjistit**, **Zkusit znovu** v oznámení.
- **Platí od:** aplikace 3.30.0

<!-- zdroj: app:2d01dffd, 3f841191, 1473151c, d2bdabac src/ui/toast.ts showProgressToast (ELAPSED_FROM_MS 10 s, TAKING_LONG_MIN_MS 20 s a 2× usualMs, SUMMARY_MS 4000, cancel jen kde jde) · src/ui/busy.ts BUSY_LONG_TOAST_MS 3000 · src/ui/adopt-progress.ts, research-adopt-ui.ts (kroky adoptBackup, adoptGedcom, adoptTaking, loadingTree; adoptBackground) · src/ui/tree-edit-lock.ts (load, adopt, switch; editsWaitLoad, editsWaitAdopt, editsWaitSwitch) · src/ui/busy-leave.ts (beforeunload při send, adopt, load; strom.busy.pending → unknownAfterLeave + findOut) · strings.ts busy.* · app:docs/ZADANI_DEV_tlacitka-cekani.md §2 · fáze 2–4: app:79a05311 src/ui/tree-switch-busy.ts (TREE_SWITCH_SEND_MS 15 s, beforeSwitchSend, switchNotSent, retry) · src/ui/book-ui.ts (nové okno book-window.ts preparingBook, chapterK, showProgressToast) · src/ui/split-ui.ts, split-families-ui.ts creatingTreeK · src/ui/encryption-ui.ts encryptingK · db6f48cd src/ui/in-parts.ts, import-export.ts (GED po částech, počet osob) · de144a3e jeden pruh .bar + .prog „k z n“ (dávka, snímky k úkolu, čtení dokumentu, obrazy pramenů, dohledání míst) · ZADANI_DEV §2.3, §2.6, §2.8, §3.4, §8 -->

<a id="A9.7.2"></a>
### A9.7.2 Zápis do výzkumu, který se ukáže hned

Řádek, přepínač nebo volba, které zapisují do výzkumu, ukážou změnu hned. Dokud ji výzkum nepotvrdí, je u nich vidět,
že se ukládá; odmítnutí změnu vrátí a řekne proč.

- **Hranice:**
  - přesun nebo změna řádku (položka v **Čeká na vyřízení** → **Odesláno** a zpět, přesunutá linie v pořadí) je hned
    na novém místě. Do potvrzení stojí na konci řádku kolečko a „ukládá se“, řádek se neztlumí. Po potvrzení
    značka zmizí, bez fajfky;
  - odmítnutí vrátí řádek na původní místo, podbarví ho na 10 s a v řádku stojí věta s důvodem a **Zkusit znovu**.
    Fokus, který byl v řádku, přejde na větu. Řádek, který mezitím není vidět (zavřený přehled, sbalená sekce),
    řekne odmítnutí oznámením;
  - přepínač, který zapisuje (druhy a hledání dějin, nastavení výzkumu u stromu, **Výzkum zapnutý**), ukáže nový
    stav hned, čárkovaně orámovaný a zamčený. Po 120 ms pod ním stojí **Ukládá se…** (**Zapíná se…**,
    **Vypíná se…**), po 5 s **Čeká na výzkum**. Odmítnutí vrátí přepínač a u něj stojí věta „Nezměněno: <důvod>“
    se **Zkusit znovu**, bez oznámení;
  - **Výzkum zapnutý** čeká na most nejdéle 30 s. Pak se přepínač vrátí a stojí **Výzkum se do 30 s neozval. Je
    potřeba spustit Strom Research.** s příkazem do terminálu a **Zkusit znovu**
    ([S1.9](S1-connecting-app-and-research.md#S1.9));
  - filtr fronty se přepne hned a seznam pod ním říká **Načítají se úkoly…**, dokud nepřijde odpověď;
  - **Vrátit** v oznámení: oznámení nezmizí, ukáže **Vrací se…** a pak „Vráceno.“, nebo „Nevráceno:
    <důvod>“ se **Zkusit znovu**. Druhé kliknutí mezitím nic nespustí.
- **Ovládání:** nic: platí samo. **Zkusit znovu** u věty.
- **Platí od:** aplikace 3.30.0. Do 3.29.0 řekla odmítnutí jen oznámení a přepínač další kliky tiše zahodil.

<!-- zdroj: app:79a05311 src/ui/research-waiting-write-ui.ts (startWaitingRows announce savingRow, endWaitingRows: vrácení, podbarvení 10 s, věta v řádku, sayWaitingRowRefused fokus na větu, řádek mimo → showWaitingRefused toast) · src/ui/research-directions-ui.ts, research-overview-ui.ts savingRow · src/ui/switch-pend.ts (data-pend, aria-busy, aria-disabled, BUSY_SHOW_MS 120, PEND_WAIT_MS 5000 waitingResearch, odmítnutí: přepínač zpět + věta role=alert + retry, bez toastu; uživatelé history-kinds-ui, history-manage-ui, history-ui, person-research-ui, research-live-ui, research-offline-ui, research-tree-settings-ui) · src/ui/research-live-ui.ts START_CONFIRM_MS 30 s, researchLiveTimedOut liveSilent + COMMAND_START + retry · src/ui/research-ui.ts queueLoadingStatus (live.queueLoading) · src/ui/toast.ts (reverting, undone, notUndone, SUMMARY_MS 4000, a901c925 akce oddělené) · strings.ts busy.savingRow, saving, turningOn, turningOff, waitingResearch, notChanged, liveSilent, reverting, undone, notUndone · ZADANI_DEV_tlacitka-cekani §4, §6, §7 · dirigent:prace/1118-app-tlacitka-b (díl 1–2b) -->

<a id="A9.7.3"></a>
### A9.7.3 Výpočet a soubory v aplikaci

Co počítá jen prohlížeč (rozvržení stromu, mapa, kontrola, kniha, export) a co čte nebo ukládá soubor, ukazuje stav
stejně jako akce, která čeká na výzkum. Stav se vykreslí dřív, než výpočet začne, takže okno nevypadá zamrzle.

- **Hranice:**
  - rozvržení stromu (**Ukázat ve stromu**, **Další osoba ›**, volba, která strom překreslí) a mapa celého stromu
    zakryjí plochu překryvem se slovy **Počítá se rozvržení…** nebo **Počítá se mapa…**. Překryv se ukáže po 120 ms
    a zůstane aspoň 300 ms; rychlé přepočty neblikají. **Přehled stromu** má stejné časy;
  - tlačítko, které spustí delší výpočet (kontrola stromu, párování při slučování, export tabulky, plakát), říká, co
    dělá („Kontroluje se 2 400 osob…“, „Analyzuje se…“). U velkého stromu se stav ukáže hned, bez 120 ms;
  - během systémového okna pro výběr souboru (import, záloha, **Přidat soubor**) žádný stav není; prvek je jen
    zamčený proti druhému otevření okna. Zrušený výběr prvek hned uvolní;
  - po výběru stav nese název souboru („Načítá se rodina-horakova.ged…“) a pak počet osob. Soubor, který nejde
    přečíst, končí větou u prvku **Soubor nejde přečíst: není to GEDCOM ani záloha Stromu.** s **Vybrat jiný
    soubor**;
  - uložení do souboru se napřed zeptá systémovým oknem, kam uložit, a stav ukáže až po něm (**Ukládá se záloha…**
    nebo **Ukládá se soubor…** s počtem osob a fotek). Šifrování a odemčení stromu mají vlastní stav (**Šifruje
    se…**, **Odemyká se…**).
- **Ovládání:** nic: platí samo.
- **Platí od:** aplikace 3.30.0. Do 3.29.0 ukazovala stav výpočtu jen některá místa a nečitelný soubor ohlásilo okno
  prohlížeče.

<!-- zdroj: app:79a05311 src/ui/canvas-busy.ts (překryv .canvas-busy, nextPaint, BUSY_SHOW_MS 120, BUSY_MIN_MS 300, layout, mapCalc) · c8f8203e, 0c16ef20 Přehled stromu 120/300 ms, volby vzhledu pod překryvem · src/ui/busy.ts runHeavy (heavy, atOnce 'now') · 71fedb93 Kontrola stromu checkingPeople, fcb108b0 párování merge.analyzing, 095a3499 export tabulky, 24149806 plakát, cea9e4ec odhad knihy · src/ui/file-pick.ts (bez stavu během systémového dialogu, zámek proti dvojímu otevření, zrušení → hned zpět, loadingFile, FileUnreadableError → fileUnreadable + pickOther, bez alertu) · src/ui/encryption-ui.ts exportSaveStep (savingBackup / savingFile + filePeople, filePhotos), encryptingK, unlocking · strings.ts busy.layout, mapCalc, checking, analyzing, loadingFile, fileUnreadable, pickOther, savingBackup, savingFile, encrypting, unlocking · ZADANI_DEV_tlacitka-cekani §8, §9 · dirigent:prace/1118-app-tlacitka-b (díl 4–6b) -->

<a id="A9.7.4"></a>
### A9.7.4 Když výzkum nebo služba mlčí

Místa, která dřív čekala bez konce nebo mlčela, mají limit. Po něm řeknou, co se stalo, a nabídnou **Zkusit znovu**.

- **Hranice:**
  - seznam chybějících snímků, posudek možných duplicit, načtení a zápis dějin a podklady mapy čekají nejdéle 15 s.
    Posudek pak řekne pod hlavičkou skupiny **Výzkum neodpověděl – posudek se nenačetl.**, dějiny „Výzkum
    neodpověděl do 15 s.“, mapa v rohu **Mapové podklady se nenačetly.**, vše se **Zkusit znovu**;
  - hledání místa na internetu čeká 10 s na dotaz a rozliší, proč odpověď nepřišla: **Služba není dostupná (chyba
    sítě).**, „Služba neodpověděla do 10 s.“, nebo **Služba teď odmítá další dotazy (limit dotazů). Další pokus půjde
    později.** Dohledání míst na mapě se pak zastaví s větou a **Zkusit znovu**; zbylá místa nejsou označená jako
    nenalezená;
  - prázdný výsledek hledání není chyba: stojí neutrálně a s **Hledat jinak**;
  - výzkum, který neběží: **Výzkum neběží. Je potřeba spustit Strom Research.**; výzkum, který právě zapisuje jiný
    úkol: **Výzkum teď zapisuje jiný úkol. Další pokus půjde za chvíli.**
- **Ovládání:** aplikace: **Zkusit znovu**, **Hledat jinak**.
- **Platí od:** aplikace 3.30.0. Do 3.29.0 seznam chybějících snímků čekal bez limitu, posudek duplicit bez mostu
  mlčel a hledání místa bez odpovědi řeklo „nenalezeno“.

<!-- zdroj: app:79a05311 src/research-images.ts MISSING_LIST_TIMEOUT_MS 15 s (c69425d0, i pro export) · src/quality-bridge.ts, src/ui/duplicate-verdicts-ui.ts (ea76fa71: 15 s, treeManager.verdictsSilent pod hlavičkou skupiny + retry) · src/history-bridge.ts HISTORY_READ_TIMEOUT_MS 15 s, HISTORY_WRITE_TIMEOUT_MS · src/ui/history-manage-ui.ts, history-ui.ts, history-kinds-ui.ts errTimeout · src/ui/map-tiles.ts TILE_TIMEOUT_MS 15 s, tilesFailed · src/geocode.ts GEOCODE_TIMEOUT_MS 10 s, GeocodeFailure network|timeout|limit · src/ui/busy.ts serviceFailText (errNetwork, serviceTimeout, serviceLimit) · src/ui/places-find-ui.ts (věta ve výsledcích, searchOther), src/ui/map-ui.ts (70d3368b: běh se zastaví, zbylá místa ne „nenalezena“) · strings.ts busy.errOffline, errBusy, errTimeout, errNetwork, serviceTimeout, serviceLimit, searchOther, tilesFailed · ZADANI_DEV_tlacitka-cekani §10.2, §10.3 · dirigent:prace/1118-app-tlacitka-b (díl 7) -->

<a id="A9.8"></a>
## A9.8 Klávesové zkratky

Klávesy hlavního okna aplikace na počítači. Na Macu platí ⌘ místo Ctrl.

| Klávesa | Co udělá | Kde a kdy | Pravidlo |
|---|---|---|---|
| Esc | zavře dialog nebo nabídku navrchu | všude | – |
| Alt+← / Alt+→ | předchozí / další ústřední osoba | mimo Tabulku; v Tabulce skoky přes jména | [A6.7.16](A6-views.md#A6.7.16) |
| Ctrl+F, / | kurzor do **Hledat osobu...** | / jen mimo textové pole | [A4.8](A4-surnames-and-families.md#A4.8) |
| Ctrl+S | **Uložit do souboru** | ne u zamčeného stromu a v kopii jen ke čtení | [S8](S8-where-the-data-are.md) |
| Ctrl+Z; Ctrl+Shift+Z nebo Ctrl+Y | **Vrátit**; **Znovu** | mimo textové pole | – |
| Delete, Backspace | smazat ústřední osobu (po potvrzení) | Rodina a Potomci, mimo textové pole; ne u zamčené osoby a ve stromu jen ke čtení | – |
| + nebo =; −; 0 | přiblížit; oddálit; výchozí přiblížení | mimo textové pole | – |
| H | zaměřit výchozí osobu | Rodina, Potomci, Vějíř; mimo textové pole a otevřenou nabídku | [A6.1.6](A6-views.md#A6.1.6) |
| ⌘1 (Mac), Ctrl+1 (Windows, Linux) | totéž co H, i z textového pole | jen když ji prohlížeč aplikaci předá | [A6.1.6](A6-views.md#A6.1.6) |

- **Hranice:**
  - s otevřeným dialogem platí jen Esc a klávesy dialogu;
  - ⌘1 / Ctrl+1 bere v kartě prohlížeče obvykle prohlížeč (první karta);
  - Tabulka, okna a dialogy mají ještě vlastní klávesy, u svých pravidel (například [A6.7.15](A6-views.md#A6.7.15),
    [A11](A11-lists-of-people.md)).
- **Ovládání:** klávesnice; aplikace přehled kláves nemá, zkratku ⌂ uvádí jeho bublina.
- **Platí od:** aplikace 3.30.0 (přehled; každá zkratka platí od verze ve svém pravidle, H a ⌘1 / Ctrl+1 od 3.30.0)

<!-- zdroj: app:401eaca4 src/ui/misc.ts keydown (Esc a dialogStack; dialog otevřený → return; Alt+←/→ goBack/goForward, v Tabulce ne; Ctrl/⌘+F a „/“ toolbarSearchPicker.focusInput; ⌘S / Ctrl+S saveTreeCopy, ne isViewMode/isLocked; defaultFocusKey H a mod1 + defaultFocusKeyHeld; typing → return; Ctrl/⌘+Z, Shift+Z, Y; Delete/Backspace confirmDelete jen family/descendants, ne isReadOnly, ne isPersonLocked; + = − 0 ZoomPan) · app:b6df0770 spec 111 §6, §8 (přehled v aplikaci ne) -->
