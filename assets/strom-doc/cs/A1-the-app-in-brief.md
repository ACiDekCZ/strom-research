<a id="A1"></a>
# A1 Aplikace v kostce

Jak aplikace Strom pracuje jako celek, na jedné stránce. Každý oddíl vede na kapitolu s přesnými pravidly. Popisuje
aplikaci Strom 3.21.2 a výzkum 1.25.2; změny z novější verze mají u sebe její číslo.

<a id="A1.1"></a>
## A1.1 Rodokmen v prohlížeči, data na zařízení

Aplikace Strom je rodokmen v prohlížeči (stromapp.info) nebo v jednom souboru HTML. Stromy se ukládají do úložiště
prohlížeče na tomto zařízení. Účet ani server s daty není.

- **Hranice:** úložiště prohlížeče patří jednomu prohlížeči na jednom zařízení. Na jiné zařízení se strom přenese
  souborem (záloha JSON, GEDCOM, samostatný HTML, [A7](A7-book-pages-and-export.md)).
- **Platí od:** aplikace 1.0.0

<!-- zdroj: app:strings.ts about.description, embeddedMode.infoText1, embeddedMode.infoText2 -->

<a id="A1.2"></a>
## A1.2 Osoby, vztahy a rody

Strom tvoří osoby a vztahy mezi nimi: rodiče a děti, partneři a jejich svazky. Ze stromu skládá aplikace **rody**:
rod je linie po meči od nejstaršího známého nositele jména, s členy a s těmi, kdo se do rodu přivdali nebo
přiženili. Příjmení zná v ženském i mužském tvaru (Horák a Horáková, Jaworski a Jaworska).

- Podrobně: [A4](A4-surnames-and-families.md).

<a id="A1.3"></a>
## A1.3 Pohledy: okolí jedné osoby

Aplikace ukazuje vždy okolí jedné **ústřední osoby**, ne celý strom najednou. Pohledy **Rodina**, **Potomci**,
**Časová osa**, **Vějíř** a **Mapa** čtou totéž okolí různě. Pohled může zvýraznit jeden rod.

- Podrobně: [A6](A6-views.md).

<a id="A1.4"></a>
## A1.4 Načtení a výstupy

Rodokmen z jiného programu se načte ze souboru GEDCOM. Aplikace řekne, co převzala a co přeskočila. Ven dává
zálohu, GEDCOM, knihu rodu, stránky rodu a stromu, stránku osoby, plakát a samostatný soubor HTML. Žijící osoby
přitom ve výchozím stavu chrání.

- Načtení: [A2](A2-loading-a-family-tree.md). Sloučení stromů: [A8](A8-merging-trees.md). Výstupy a ochrana
  žijících: [A7](A7-book-pages-and-export.md).

<a id="A1.5"></a>
## A1.5 Prameny, doložení a kontrola

K údajům se zapisují prameny, citace, výřezy zápisů a přílohy. Aplikace ukazuje, kde chybí doklady, a kontrola
stromu hledá chyby a nesrovnalosti v datech.

- Doložení: [A3](A3-evidence-in-the-app.md), stupně jistoty [R3.8](R3-verification-and-citation.md#R3.8).
  Kontrola stromu: [A5](A5-tree-check.md).

<a id="A1.6"></a>
## A1.6 Aplikace a výzkum

Aplikace funguje i bez výzkumu. S výzkumem Strom Research na stejném počítači ukazuje strom výzkumu, jeho práci
a to, co výzkum o osobách ví, a úpravy posílá zpět do výzkumu ([R1.6](R1-research-in-brief.md#R1.6)).

- Propojení: [S1](S1-connecting-app-and-research.md). Úpravy z aplikace: [S2](S2-edits-from-the-app.md).
  Co ví výzkum: [S3](S3-what-the-research-knows.md). Výzkum řízený z aplikace:
  [S4](S4-research-from-the-app.md). Telefon: [S5](S5-phone.md).

<a id="A1.7"></a>
## A1.7 Jak Strom funguje v aplikaci

Tato dokumentace je přibalená v aplikaci a čte se i bez internetu. Okno **Jak Strom funguje** má obsah částí A, R
a S, **Rejstřík pojmů** a hledání podle slova nebo čísla pravidla.

- **Hranice:**
  - otevření okna nic neposílá a nic nenačítá ze sítě;
  - číslo pravidla a Enter skočí přímo na pravidlo (`R4.3`); neznámé číslo ukáže obsah;
  - odkazy mezi pravidly mají **Zpět**; **Na webu** otevře stejné pravidlo na stromapp.info;
  - pravidlo novější než připojený výzkum to řekne („Výzkum připojený k tomuto stromu má verzi …, tohle platí od …“).
- **Ovládání:** aplikace: **Akce → Jak Strom funguje**, na telefonu **Další → Jak Strom funguje**, nebo **O aplikaci
  → Jak Strom funguje**. Kroužek **?** v záhlaví otevře nápovědu přímo u pravidla: v Přehledu výzkumu a malém panelu
  u oddílů **Fronta** ([R2.4](R2-lines-and-queue.md#R2.4)), **Čeká na vyřízení** ([R6.4](R6-awaiting-action.md#R6.4))
  a **Teď** ([R7](R7-when-the-agent-works.md), při pozastavení [R7.6](R7-when-the-agent-works.md#R7.6)), v okně **Místa** ([R4.5](R4-places.md#R4.5)), ve správci míst
  ([R4.4](R4-places.md#R4.4)), v panelu rozporů ([R5.3](R5-conflicts.md#R5.3)) a v **Co ví výzkum → Rozpory**
  ([R5.6](R5-conflicts.md#R5.6)). Ve výzkumu: `strom doc`
  ([R1.8](R1-research-in-brief.md#R1.8)).
- **Platí od:** aplikace 3.24.0

<!-- zdroj: app:src/help/help-data.ts, src/help/topics.ts HELP_TOPICS · src/ui/help-mark.ts · strings.ts help.title, index, search, searchPh, web, back, unknown, verRes, topics · vendor/strom-doc/PIN · prace/1105-app-napoveda-impl (§1–§11, e2e help.spec: otevření okna bez síťového požadavku) -->
