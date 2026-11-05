<a id="R11"></a>
# R11 Podklady od uživatele

Co výzkum udělá se soubory, texty a rodokmeny, které mu dá uživatel: v terminálu, nebo z aplikace Strom. Jak se
materiál posílá z aplikace, popisuje [A3.5](A3-evidence-in-the-app.md#A3.5); odpověď souborem na úkol, který čeká,
[R6.7.1](R6-awaiting-action.md#R6.7.1). Popisuje výzkum 1.27.0. U pravidel je rozlišeno, co **hlídá kód** a co je
jen **pravidlo metodiky**.

<a id="R11.1"></a>
## R11.1 Každý soubor je podklad s úkolem

Každý soubor se ve výzkumu uloží beze změny jako podklad a dostane úkol podklady. Agent z něj zapíše jen to, co
v něm skutečně stojí.

- **Hlídá kód:**
  - stejný soubor podruhé se přeskočí (pozná se podle obsahu, ne podle názvu);
  - soubory do 20 MB jsou ve stromu a v jeho historii, větší ve sdíleném úložišti médií;
  - složka s víc než 20 obrázky se bere jako skeny knihy, ne jako rodinné doklady (`--documents` řekne opak);
  - rodokmen má vlastní úkol; ostatní soubory jedné složky mají jeden společný úkol;
  - úkol podklady nikdy nečeká mimo frontu ([R2.2.3](R2-lines-and-queue.md#R2.2.3)). V Archivu Stromu se odloží
    ([R7.8](R7-when-the-agent-works.md#R7.8)).
- **Jen metodika:** jména a místa se zapisují tak, jak jsou napsaná; sjednocují se jen data. Úkol se zavře s tím,
  co z podkladu vzešlo, a s dalšími úkoly: kde hledat záznamy, které vodítka doloží.
- **Ovládání:** terminál: `strom intake <soubory nebo složky>`, `strom intake --text "…"` (co řekne uživatel),
  `strom input list`, `strom input show I…`. Aplikace: **Poslat materiál…**, **Přidat materiály…**
  ([A3.5](A3-evidence-in-the-app.md#A3.5)).
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:src/commands/intake.ts intake (description, BOOK_OF_SCANS=20, sha256 known, intakeTask) · research:src/core/media.ts MAX_IN_TREE=20 MB · research:assets/method/intake.md kroky 1, 4, 6, 7 -->

<a id="R11.2"></a>
## R11.2 Doklad je pramen, ostatní je vodítko

Z podkladu může být pramen, který dokládá údaje, nebo jen vodítko, které říká, kde hledat. Rozhoduje, co je to za
dokument, ne kdo ho poslal.

- **Jen metodika:**
  - úřední nebo církevní doklad (rodný, oddací, úmrtní list, výpis z matriky, vojenské papíry) je pramen
    (`--form original`; `--information primary`, když byl psaný v době události);
  - fotka, dopis, rodokmen a vzpomínka jsou dílo autora nebo odvozený pramen: co z nich pochází, zůstane
    **Vodítko**;
  - co řekne uživatel, je vzpomínka rodiny (`--kind family-memory --form authored --information secondary`);
  - víc údajů z jednoho podkladu se zapíše jednou dávkou (`strom batch`): všechno, nebo nic.
- **Hlídá kód:** údaj jen ze vzpomínky, rodokmenu nebo autorského díla nikdy není Pravděpodobné ani Doložené
  ([R3.2](R3-verification-and-citation.md#R3.2)).
- **Ovládání:** terminál: `strom source add "…" --input I… --form … --information …`.
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:assets/method/intake.md krok 2 · research:src/core (weak sources: family-tree, family-memory, authored) -->

<a id="R11.3"></a>
## R11.3 Převzatý rodokmen

Rodokmen (GEDCOM nebo soubor aplikace Strom) jsou závěry někoho jiného, ne záznam. Výzkum ho převezme celý, ale jen
jako vodítka.

- **Hlídá kód:**
  - rodokmen se načte hned při převzetí: každá osoba a každý údaj jako **Vodítko** s citací jednoho pramene druhu
    rodokmen (`--kind family-tree`, `--form authored`). Každá osoba si pamatuje, odkud přišla;
  - osoby stromu tohoto výzkumu, které se vracejí ze souboru aplikace Strom, se spárují podle svého čísla ve
    výzkumu a nezaloží se podruhé. Čísla jiného výzkumu se nepárují nikdy;
  - `--no-import` rodokmen jen uloží a nenačte.
- **Jen metodika:**
  - duplicity a nemožná data se zkontrolují, ale „neopravují“ se zpaměti; jsou to vodítka;
  - osoba rodokmenu, která už je ve výzkumu zkoumaná, se sloučí **do** zkoumané osoby, nejdřív její rodiče
    ([R10.2](R10-people-and-hypotheses.md#R10.2)). Zkoumaná osoba si drží své doklady;
  - v čem se rodokmen liší, zůstane vodítkem, nebo se stane rozporem; nikdy údajem.
- **Ovládání:** terminál: `strom intake rodokmen.ged`. Načtení rodokmenu do aplikace popisuje
  [A2](A2-loading-a-family-tree.md).
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:src/core/import.ts hlavička ("as LEADS", oursByRefn), source kind family-tree form authored :113-117, status lead :294 · research:src/commands/intake.ts --no-import · research:assets/method/intake.md krok 5 -->

<a id="R11.4"></a>
## R11.4 Dávka z aplikace

Složku, ZIP nebo krabici dokumentů poslanou z aplikace výzkum přijme jako jednu dávku. Agent ji pak roztřídí po
úkolech.

- **Hlídá kód:**
  - dávka se uzavře, když aplikace ohlásí, že je celá, nebo den po posledním souboru;
  - pak se z ní stanou úkoly podklady po zhruba 25 souborech, podle složek, ve kterých soubory přišly. V Archivu
    Stromu úkoly čekají odložené;
  - soubory dávky se ukládají jako originály do sdíleného úložiště médií, ne do historie stromu. Co z nich agent
    nezapíše, zůstane soukromé;
  - soubor označený jako nesouvisející (`--as unrelated`) potřebuje důvod. Přeskočí se a nic z něj se nezapíše.
- **Jen metodika:**
  - agent si nejdřív levně prohlédne všechny soubory úkolu (náhledy v mřížce) a každý hned zařadí: záznam
    (pramen), dokument, fotka, nesouvisející, a čí je. Do hloubky čte jen to, co patří lidem výzkumu;
  - o žijící osobě se nic nezapíše; soubor se jen zařadí;
  - skeny jedné knihy (mnoho číslovaných snímků) se nečtou soubor po souboru: zapíšou se jako kniha a čtou se
    z ní zápisy jako z každé knihy ([R8](R8-reading-scans.md));
  - úkol se zavře, až je každý jeho soubor zařazený; další část dávky je vlastní úkol.
- **Proč:** cesta souboru v dávce hodně řekne (`Babička/Dopisy/1946.jpg`); co do rodiny nepatří, nemá se dostat do
  stromu (metodika).
- **Ovládání:** terminál: `strom input batch` (dávky a kolik je roztříděno), `strom input sort I… --as
  source|document|photo|unrelated --person P…`. Aplikace: **Přidat materiály…** v menu výzkumu.
- **Platí od:** výzkum 1.12.0

<!-- zdroj: research:src/core/batches.ts hlavička, BATCH_TASK_FILES=25 (od v1.12.0) · research:src/commands/intake.ts input batch done (--idle), input sort (unrelated --reason) · research:assets/method/intake.md "A batch from the Strom app" -->
