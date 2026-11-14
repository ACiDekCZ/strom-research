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

- **Hranice:**
  - položky výzkumu jsou jen u stromu z výzkumu; tlačítka, která výzkum otevírají, jen na počítači, kde výzkum
    běží ([S3.2](S3-what-the-research-knows.md#S3.2));
  - aplikace se s výzkumem spojí odkazem z terminálu, `strom app` ([S1.2](S1-connecting-app-and-research.md#S1.2)).
- **Ovládání:** jak v tabulce.
- **Platí od:** aplikace 3.25.0 (souhrn; každé místo platí od verze ve svém pravidle)

<!-- zdroj: app:index.html search input (search.placeholder) · src/renderer.ts card.onclick → UI.showContextMenu, klávesy Enter/Space · src/ui/bottom-sheet.ts (dlouhý stisk, menu.sectionView) · SPEC.md Long-press → bottom sheet · strings.ts search.placeholder, mobileMenu.more, menu.sectionView, map.tilesNotice, map.tilesNoticeOk, research.stop · cesty z pravidel A3.1, A3.6, A6, A6.5.2, S1.4, S2.2, S3.2, S4.1, S4.4, A1.7 · okna: A6.8, S4.1.6 (app:4b1373a7 src/windows/window-controls.ts) · dolní lišta a Celá obrazovka: A9.5 (app:4b1373a7, commit bb5e4d12) -->

<a id="A9.2"></a>
## A9.2 Prvky mají čitelný název

Každý ovládací prvek má název, který přečte čtečka obrazovky i nástroj prohlížeče, který čte stránku. Vzhled se tím
nemění.

- **Hranice:**
  - tlačítka jen s ikonou mají název: zvětšení, filtry, zpět a vpřed, otočení fotky, náhled, seznam u hledání osoby
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
    doprava) a Esc. Po obnovení stránky se sám neotevře a volbu zařízení telefon nečte ani nepíše.
- **Hranice:** bez úložiště prohlížeče (soukromé okno) platí volba do zavření stránky.
- **Ovládání:** ouško nad minimapou; **◯** v legendě, čip „◯ Legenda“. Vypnutí: nastavení **Minimapa**, **Legenda
  stromu**.
- **Platí od:** aplikace 3.28.0

<!-- zdroj: app:f5d56ed3 src/ui/minimap.ts readMinimapOpen (strom-minimap-open, výchozí otevřeno), setMinimapFold (ouško jen když je minimapa nabízená), updateMinimap (isMinimapEnabled, mobil a telefon na šířku bez minimapy, STANDALONE_VIEWS, sbaleno: display none, nic se nekreslí) · src/ui/tree-legend.ts readTreeLegendOpen (strom-tree-legend-open, výchozí otevřeno), readTreeLegendSeen / noteTreeLegendSeen (strom-tree-legend-seen), syncTreeLegendFold (tečka, aria-label title + newMark, telefon vždy čip), openTreeLegendSheet (Hotovo = tour.done, klepnutí vedle, tažení 80 px dolů / doprava na šířku, nečte ani nepíše volbu), paměť bez úložiště · src/ui/misc.ts updateLegendMarks (data-marks: story-own, story-other, action, cross) · src/storage-keys.ts TREE_UI_STORAGE_KEYS · index.html .minimap-toggle (hover / pointer coarse), #tree-legend .tree-legend-toggle, pointer-events · strings.ts minimap.title, collapse, expand, settingLabel; legend.title, collapse, expand, newMark; settings legendLabel · app d78ba58b · dirigent:prace/1113-app-drobnosti-1112 · ZADANI_DEV_drobnosti-1112 §2 -->
