<a id="R10"></a>
# R10 Osoby: ztotožnění, jména a hypotézy

Jak výzkum pozná, že zápis patří hledané osobě, co udělá se dvěma záznamy jedné osoby, jak vede soupeřící
vysvětlení (hypotézy) a jak zapisuje jména a lidi, které zápis jmenuje. Popisuje výzkum 1.27.0 a aplikaci Strom
3.23.0. U pravidel je rozlišeno, co **hlídá kód** a co je jen **pravidlo metodiky**.

<a id="R10.1"></a>
## R10.1 Jmenovec není hledaná osoba

Zápis patří hledané osobě, jen když ji určí víc než jméno. Dva lidé stejného jména v jedné vsi jsou běžní.

- **Jen metodika:**
  - osobu určuje rok, místo, číslo domu, povolání, manžel nebo manželka a rodiče. Většinu případů rozhodne rodné
    příjmení matky;
  - dva zápisy, které stejnému jménu dávají jiné rodiče (jinou matku), jsou **dvě osoby**, i ve stejném domě
    a se stejným jménem otce. Rozdíl se nevysvětluje chybou písaře a nerozhoduje se většinou
    ([R5.1.1](R5-conflicts.md#R5.1.1));
  - hledaná osoba je ta, kterou jmenuje zápis o její vlastní rodině. Ostatní jsou samostatné osoby;
    „tatáž žena?“ je hypotéza ([R10.3](#R10.3)) s tím, co by ji rozhodlo;
  - pramen mimo matriky (noviny, adresář, web): stačí, když souhlasí jméno, místo a doba **a ještě jeden údaj**
    (dům, povolání, manžel nebo manželka, věk, příbuzný). Jinak hypotéza.
- **Proč:** dva lidé stejného jména v jedné vsi jsou běžní; rodné příjmení matky rozhodne většinu případů (metodika).
- **Ovládání:** terminál (agent). Aplikace ukazuje hypotézy u osoby v **Co ví výzkum → Hypotézy**
  ([S3.5](S3-what-the-research-knows.md#S3.5)).
- **Platí od:** výzkum 1.0.0; pramen mimo matriky 1.10.0

<!-- zdroj: research:assets/method/core.md "A namesake is not your person" · research:assets/method/link.md krok 4 "Identify" · research:assets/method/enrich.md "Your person, not a namesake" (od v1.10.0) -->

<a id="R10.2"></a>
## R10.2 Dva záznamy jedné osoby: sloučení

Když se ukáže, že dva záznamy ve výzkumu jsou jedna osoba, sloučí se. Druhý záznam nezmizí: zůstane odvolaný
s poznámkou, do koho byl sloučen.

- **Hlídá kód** (`strom person merge <zůstává> <druhý> --reason "…"`):
  - sloučení potřebuje důvod;
  - jména, údaje, poznámky, rodiny a všechny odkazy (úkoly, hypotézy, kmotři…) přejdou na osobu, která zůstává;
  - údaje se neslučují: dvě narození po sloučení jsou dvě. strom upozorní, které údaje jsou teď dvakrát;
    lepší se ponechá citací, druhý se odvolá s důvodem;
  - odmítne sloučit osoby různého pohlaví (když ani jedna nemá pohlaví neznámé), partnery jedné rodiny, předka
    s potomkem a osoby s **jinými rodiči**. Jsou-li to tíž rodiče ve dvou záznamech, sloučí se nejdřív rodiny
    (`strom family merge`).
- **Jen metodika:** osoba z převzatého rodokmenu, která už je ve výzkumu zkoumaná, se slučuje **do** zkoumané
  osoby; ta si drží své doklady ([R11.3](R11-material-from-the-user.md#R11.3)).
- **Ovládání:** terminál: `strom person merge`, `strom family merge`. Možné duplicity ve stromu hlásí aplikace v
  Kontrole stromu ([A5.6](A5-tree-check.md#A5.6)).
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:src/commands/people.ts person merge (description, SINGLE_KINDS) · research:src/core (mergePersons: merge.needs-reason, sex, partners, ancestor, different birth parents) · research:assets/method/intake.md krok 5 -->

<a id="R10.3"></a>
## R10.3 Hypotéza: soupeřící vysvětlení

Když záznamy připouštějí víc vysvětlení (čí je to dítě, jsou to dva zápisy jedné osoby, je to manželský pár), výzkum
nevybírá potichu. Zapíše hypotézu: otázku a její verze A, B, C… s tím, co pro každou mluví a co proti.

- **Hlídá kód:**
  - hypotéza má aspoň dvě verze a týká se aspoň jedné osoby nebo záznamu (`--about`);
  - písmeno verze patří jednomu tvrzení navždy. Nové tvrzení dostane další volné písmeno, použité písmeno se znovu
    nepoužije. Verzi jde přidat jen k otevřené hypotéze;
  - verze může říct, co by spojila: dítě rodiny nebo rodičů, dva záznamy jedné osoby, pár, sourozence. Ve stromu
    se tím nic nespojí; spojení se zapíše až po rozhodnutí hypotézy.
- **Jen metodika:** co by hypotézu rozhodlo, je úkol (`strom task add … --about H…`), ne odbočka v jiném úkolu.
  Spojení verze se zapíše jen tehdy, když ho tvrzení říká bez pochyb; jmenovec zůstane mimo.
- **Ovládání:** terminál: `strom hypothesis add "<otázka>" --about P… --variant "…" --variant "…"`,
  `hypothesis argue`, `hypothesis variant`, `hypothesis link`, `hypothesis show`, `hypothesis list`. Aplikace verze
  ukáže a dovolí je nakreslit do stromu jen pro pohled ([S3.5](S3-what-the-research-knows.md#S3.5),
  [S3.5.1](S3-what-the-research-knows.md#S3.5.1)).
- **Platí od:** výzkum 1.0.0; spojení verzí a nová verze k otevřené hypotéze 1.14.0

<!-- zdroj: research:src/commands/analysis.ts hypothesis add ("at least two --variant", "--about is required"), variant (VARIANT_LABEL, nextLabel, "a letter is never used twice"), link (description) · research:assets/method/core.md "Say what a hypothesis would connect" -->

<a id="R10.3.1"></a>
### R10.3.1 Rozhodnutí hypotézy

Hypotéza se rozhodne pro jednu verzi, nebo se zruší, když žádnou rozhodnout nejde. Rozhoduje se ve výzkumu; aplikace
hypotézu rozhodnout nedá.

- **Hlídá kód:**
  - rozhodnutí potřebuje text rozhodnutí (`--decision`); zrušení je `--abandon`;
  - rozhodnout znovu jde jen s důvodem (`--reason`). Předchozí rozhodnutí zůstane v poznámce hypotézy;
  - po rozhodnutí strom vypíše prameny, které hypotéza jmenuje a které žádný údaj jejích osob necituje: co
    říkají, se má zapsat k osobám.
- **Jen metodika:** hypotéza, jejíž verze nesou spojení, se rozhoduje s volbou verze (`--variant B`). Rozhodnutou
  hypotézu, kterou nový záznam vyvrátí, agent rozhodne znovu s důvodem. Co agent zadržel, dokud byla osoba jen
  hypotéza, zapíše k osobě po rozhodnutí.
- **Ovládání:** terminál: `strom hypothesis decide H… --variant B --decision "…"` (znovu s `--reason "…"`).
- **Platí od:** výzkum 1.0.0; výpis nezapsaných pramenů 1.12.0

<!-- zdroj: research:src/commands/analysis.ts hypothesis decide (earlier decision in a note, "deciding again needs --reason", sourcesNotOnPeople od v1.12.0) · research:assets/method/core.md "Write as you go", "Say what a hypothesis would connect" · research:assets/method/recording.md "A decided hypothesis that a new record overturns" -->

<a id="R10.4"></a>
## R10.4 Rodina mimo strom čeká na doloženou vazbu

Rodina nalezená v záznamech, kterou se stromem nespojuje žádná doložená vazba, se dál nezkoumá: ani její rodiče, ani
děti. Nejdřív se musí doložit, že do stromu patří.

- **Jen metodika:** agent zapíše hypotézu, která by rodinu připojila k osobě stromu (`--about` osoba stromu), a úkol,
  který ji ověří a jmenuje (`--about H…`). Rodinu mimo strom zkoumá dál jen na žádost uživatele.
- **Hlídá kód:** fronta zadrží ostatní úkoly o lidech mimo strom. Vrátí se samy, až se vazba zapíše
  ([R2.2.3](R2-lines-and-queue.md#R2.2.3)).
- **Proč:** práce na rodině, která do stromu nepatří, je ztracená práce; rozhoduje vazba, ne jméno (metodika
  „The tree first, then above it“).
- **Ovládání:** terminál: `strom task list --off-tree`. Aplikace ukáže rodinu mimo strom u osoby v **Nad osobou**
  ([S3.3](S3-what-the-research-knows.md#S3.3)).
- **Platí od:** výzkum 1.9.0

<!-- zdroj: research:assets/method/core.md "The tree first, then above it" · research:src/commands/tasks.ts --off-tree (od v1.9.0) -->

<a id="R10.5"></a>
## R10.5 Jména osoby

Osoba může mít víc jmen: rodné, po sňatku, řeholní, jiné. Každé jméno má svůj záznam. Jména se zapisují tak, jak
stojí v záznamu; sjednocují se jen data.

- **Hlídá kód:**
  - druhy jména: rodné (`birth`), po sňatku (`married`), řeholní (`religious`), jiné jméno (`alias`), bez druhu;
  - jméno bez příjmení („Marie“) doplní celé jméno ze záznamu a osoba se pak ukazuje jím. Stejné jméno znovu jen
    přidá citaci;
  - žena se ukazuje rodným jménem; jméno po sňatku zůstává vedle;
  - titul psaný se jménem („Ing.“, „MUDr.“, „ml.“) jde do předpony nebo přípony jména (`--prefix`, `--suffix`),
    ne do křestního jména ani příjmení;
  - **jméno, kterým se osoba ukazuje** (rozvedená žena zpět u rodného příjmení), je volba uživatele, ne údaj ze
    záznamu: `strom name primary`. Totožnost osoby (oprava jména, párování) zůstává u rodného jména.
- **Jen metodika:**
  - hodnost nebo úřad, který zápis uvádí, je údaj (`TITL`, `OCCU`), ne část jména;
  - dítě, které zápis nejmenuje (mrtvě narozené, zemřelé nepokřtěné), nemá křestní jméno; místo jména se nepíše
    popis;
  - osoba, kterou slabší záznam jmenoval jinak, si to jméno nechá jako variantu; správné jméno se označí jako
    hlavní. Nic se nemaže;
  - jméno přečtené jen zčásti: [R8.6](R8-reading-scans.md#R8.6).
- **Ovládání:** terminál: `strom name add P… "Marie /Vlková/" --kind birth --cite S…`, `strom name primary P…
  "…"` (`--clear` vrátí rodné jméno). Tvary příjmení v aplikaci: [A4.5](A4-surnames-and-families.md#A4.5),
  [A4.6](A4-surnames-and-families.md#A4.6).
- **Platí od:** výzkum 1.0.0; předpona a přípona 1.13.0; jméno, kterým se osoba ukazuje, 1.27.0; nepojmenované
  dítě 1.27.0

<!-- zdroj: research:src/core/model.ts NAME_KINDS · research:src/commands/people.ts name add (description), name primary (od v1.27.0), TITLE_OPTIONS (od v1.13.0) · research:assets/method/recording.md "The names a record gives", "A child the record does not name" (od v1.27.0), "People named wrongly by the weaker record" · research:assets/method/intake.md krok 4 -->

<a id="R10.5.1"></a>
### R10.5.1 Chybné jméno a poznámka se odvolají

Jméno nebo poznámka, které se ukážou jako chybné, se nemažou. Odvolají se s důvodem a zůstanou jen v historii.

- **Hlídá kód:**
  - odvolané jméno zmizí ze všeho, co jména ukazuje, čte nebo páruje: `strom person show`, podklady agenta,
    GEDCOM (aplikace ho po načtení stromu neukáže), hledání a párování;
  - jméno, kterým se osoba ukazuje, jde odvolat jen tehdy, když má osoba ještě jiné jméno. Překlep v něm se opraví
    `strom person edit --name`;
  - odvolané jméno znovu přidat nejde; vrátí se `strom name restore` s důvodem;
  - poznámka se opraví (`strom note edit`) nebo odvolá (`strom note retract`) s důvodem; vrátí se `strom note
    restore`.
- **Ovládání:** terminál: `strom name retract P… "Josef /Horák/" --reason "…"`, `strom person show P… --history`.
- **Platí od:** výzkum 1.18.0

<!-- zdroj: research:src/commands/people.ts name retract (description), name restore, name add ("name.retracted"), note edit/retract/restore (od v1.18.0) · GitHub issue strom-research #3 -->

<a id="R10.6"></a>
## R10.6 Lidé, které zápis jmenuje

Zápis jmenuje víc lidí než hlavní osobu: kmotry, svědky, porodní bábu, oddávajícího, oznamovatele, rodiče a prarodiče.
Všechno, co o nich zápis říká, se zapíše hned při prvním čtení.

- **Jen metodika:**
  - každý v roli jde k události jako role a jméno, co o něm zápis říká, v závorce: „kmotr: Jan Horák (sedlák,
    Lhota č. 12)“. Kněz je oddávající nebo křtící;
  - s osobou stromu se člověk v roli spojí jen tehdy, když to zápis řekne. Stejné jméno nestačí;
  - co zápis říká o každé jmenované osobě (povolání, bydliště, číslo domu), se stane jejím údajem s datem zápisu,
    i u prarodičů. Zápis, který jmenuje rodiče (křest vnuka), je pro ně sekundární informace
    ([R3.2.1](R3-verification-and-citation.md#R3.2.1));
  - místo je jen obec; číslo domu jde do vlastního pole.
- **Proč:** kmotři a svědci bývají příbuzní a dokládají další vazbu; podle povolání a domu se osoba hledá dál.
  Otevřít stejnou stránku znovu stojí víc než zapsat to hned (metodika).
- **Ovládání:** terminál: `strom event add … --with "godparent:…" --house 13`. Aplikace: opakující se kmotr ve
  Stopách Kontroly stromu ([A5.5](A5-tree-check.md#A5.5)).
- **Platí od:** výzkum 1.0.0

<!-- zdroj: research:assets/method/recording.md "Everyone the entry names in a role", "What the entry says about each person", "A place is the municipality only" · research:assets/method/core.md "Extract everything the first time" · research:assets/method/link.md krok 6 -->
