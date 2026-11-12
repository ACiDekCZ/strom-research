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
| pohled Mapa a další pohledy | přepínač pohledů v liště; v úzkém okně a na telefonu **Více → Pohled** | [A6](A6-views.md) |
| celý strom v řádcích, export CSV a XLSX | **Tabulka** v přepínači pohledů; v úzkém okně a na telefonu **Více → Pohled → Tabulka** | [A6.7](A6-views.md#A6.7) |
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

<!-- zdroj: app:index.html search input (search.placeholder) · src/renderer.ts card.onclick → UI.showContextMenu, klávesy Enter/Space · src/ui/bottom-sheet.ts (dlouhý stisk, menu.sectionView) · SPEC.md Long-press → bottom sheet · strings.ts search.placeholder, mobileMenu.more, menu.sectionView, map.tilesNotice, map.tilesNoticeOk, research.stop · cesty z pravidel A3.1, A3.6, A6, A6.5.2, S1.4, S2.2, S3.2, S4.1, S4.4, A1.7 -->

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
