<a id="R3"></a>
# R3 Ověřování a citace

Jak výzkum určuje, jak jistý je každý údaj, co musí platit, aby byl doložený, a jak to ukazuje aplikace. Popisuje
výzkum 1.25.2 a aplikaci Strom 3.21.2; změny z novější verze mají u sebe její číslo.
U pravidel je rozlišeno, co **hlídá kód** (příkaz `strom` zápis jinak odmítne) a co je jen **pravidlo metodiky**
(pokyn agentovi, který kód nekontroluje).

<a id="R3.1"></a>
## R3.1 Stupně jistoty údaje

Každý údaj (narození, křest, sňatek, povolání…) má jeden ze čtyř stupňů jistoty. Stupeň říká, jak jistý je závěr
ze všech pramenů údaje, ne jak dobrý je jeden pramen ([R3.2.1](#R3.2.1)).

| Aplikace | Terminál | Význam podle metodiky |
|---|---|---|
| **Doložené** | doloženo | agent přečetl původní záznam sám a záznam údaj uvádí přímo |
| **Pravděpodobné** | pravděpodobné | dobrý doklad, ale nepřímý, nebo jediné čtení těžkého písma |
| **Možné** | možné | slabý doklad |
| **Vodítko** | jen stopa | rodinný příběh, rodokmen, rejstřík nebo odhad: co ověřit, ne údaj |

- **Hranice:** údaj může být i vyvrácený (`--status disproven`) nebo odvolaný (`strom event retract E… --reason "…"`).
  Nic se nemaže. Odvolaný údaj se nikde neukazuje a nejde ho citovat ani upravit. `strom person show` ukazuje
  české názvy jen člověku; agent tam čte `proven`, `probable`, `possible`, `lead`.
- **Ovládání:** aplikace: štítek u údaje (události osoby, sňatek a rozvod, společné události páru), jen ke čtení ·
  terminál: `strom person show`, `strom person card`, `strom stats` (řádek „Údaje: doložené … · jen stopy …“);
  zápis `strom event add … --status`, `strom cite E… S… --status`, `strom event edit E… --status … --reason "…"`.
- **Platí od:** výzkum 1.0.0; české názvy v terminálu 1.1.0 (u `strom person show` 1.12.0); štítek v aplikaci 3.9.0
- **Od výzkumu 1.26.0:** terminál říká stupně slovy aplikace: **doložené**, **pravděpodobné**, **možné**,
  **vodítko**, **vyvrácené**. Souhrn `strom stats` píše dál „jen stopy“.
- **Od výzkumu 1.30.0:** `strom event show` a `strom event edit` vypisují údaj člověku v jazyce výzkumu
  (například „[vodítko]“); agent dostává výpis dál anglicky.
- **Od výzkumu 1.36.0:** stupeň má i jméno osoby, kromě **Vyvrácené** (`strom cite P… S… --status`,
  [R10.5.2](R10-people-and-hypotheses.md#R10.5.2)).

<!-- zdroj: research:src/core/model.ts:36 STATUSES · assets/method/core.md:8-12 · src/cli/human.ts:138 statusName · assets/lang/cs.json ui.st.*, ui.stats.facts · src/commands/people.ts:115 wordsFor · src/core/actions.ts:629 notRetracted · app:src/ui/fact-status.ts · strings.ts factStatus · 1.26.0: src/cli/human.ts:139 STATUS, cs.json ui.st.* (commit fe59fb40) -->

<a id="R3.1.1"></a>
### R3.1.1 Výchozí stupeň a citace, která ho zvedne

- Údaj zapsaný bez `--status`: bez citace **Vodítko**; s citací aspoň jednoho pramene, který není slabý
  ([R3.3](#R3.3)), **Pravděpodobné**; jinak Vodítko. Od výzkumu 1.28.0 je slabý i rejstřík.
- `strom cite` bez `--status` zvedne Vodítko na Pravděpodobné, když nový pramen není slabý. Jiný stupeň nemění.
- Změna stupně přes `strom event edit --status` potřebuje `--reason`; citace se stupněm (`strom cite … --status`) ne.
- Hlídá kód. **Platí od:** výzkum 1.0.0

<!-- zdroj: research:src/core/evidence.ts:49 defaultStatus · src/core/actions.ts:636-650 citeEvent, :903-913 event.needs-reason -->

<a id="R3.2"></a>
## R3.2 Co kód pustí jako Pravděpodobné a Doložené

Stupeň nesmí tvrdit víc, než dávají citace údaje. Kód to kontroluje při každém zápisu stupně: `event add`, `cite`,
`event edit` i u údajů, které přijdou z aplikace.

- **Hranice (hlídá kód),** v tomto pořadí:
  1. Pravděpodobné i Doložené potřebuje aspoň jednu citaci.
  2. Aspoň jedna citace musí být z pramene, který není slabý. Slabý je rodokmen (`--kind family-tree`), vzpomínka
     (`--kind family-memory`), autorské dílo (`--form authored`) a od výzkumu 1.28.0 rejstřík (`--kind index`).
  3. Doložené navíc potřebuje citaci samotného původního záznamu (od výzkumu 1.29.0, viz níže).
  4. Mezi citacemi původního záznamu musí být aspoň jedna s primární informací (`--information primary`): záznam
     psaný v době události někým, kdo to věděl. Informace u citace má přednost před informací u pramene.
- **Jen metodika:** kód nekontroluje, že agent záznam přečetl sám, že záznam údaj uvádí přímo, ani slepé druhé
  čtení ([R3.5](#R3.5)).
- **Ovládání:** terminál: `strom event add P… BIRT --date "…" --cite S… --information primary --status proven`.
  Odmítnutí řekne důvod a co místo toho (nechat Vodítko, `--status possible`, nebo `--status probable`).
- **Platí od:** výzkum 1.0.0
- **Od výzkumu 1.29.0:** původní záznam je pramen formy originál (`--form original`), který je záznamem (ne slabý
  pramen, tedy ani rejstřík) a není odvolaný. Pramen, který přišel z aplikace Strom, se počítá, jen když vznikl
  ze čtení dokumentu čtenáři výzkumu, které uživatel v aplikaci poslal do stromu (**Navrhnout do stromu…**,
  [R8.8](R8-reading-scans.md#R8.8));
  sama spolehlivost **Originál** z aplikace ([R3.2.1](#R3.2.1)) původní záznam nedělá. Opis, rejstřík, cizí přepis
  ani slovo aplikace o prameni dají nejvýš Pravděpodobné; odmítnutí má kód `status.original`. Do výzkumu 1.28.0
  prošlo Doložené u kteréhokoli ne-slabého pramene s primární informací, i u opisu; takové údaje starších výzkumů
  jednou srovná oprava [R3.2.2](#R3.2.2).

<!-- zdroj: research:src/core/evidence.ts:27 isWeak, :32 informationOf, :55-68 checkStatus · src/core/actions.ts:196-209 makeEvent, :648, :906 · src/commands/people.ts:745 · od v1.28.0 evidence.ts isWeak (kind index), checkStatus "… or an index cannot make a fact" · 1.29.0: research:v1.35.0 src/core/evidence.ts isOriginalHere, provesIt, checkStatus (code status.original) · src/core/model.ts Source.reading · CHANGELOG.cs.md 1.29.0 -->

<a id="R3.2.1"></a>
### R3.2.1 Pramen: forma a informace

- `strom source add --form original` (výchozí) · `derivative` (opis, rejstřík; výchozí pro `--kind index` a v knize,
  která je jen rejstřík) · `authored` (sestavené dílo).
- `--information primary|secondary|unknown` (výchozí `unknown`) platí u pramene; u citace (`event add`, `cite`) jen
  pro ten údaj. Záznam, který jmenuje rodiče (křest vnuka), je pro ně sekundární informace (metodika).
- Do GEDCOM jde kvalita citace jako QUAY: 3 originál s primární informací · 2 originál jinak, nebo opis s primární
  informací · 1 opis jinak, nebo autorské dílo · 0 rodokmen a vzpomínka.
- Změna formy, informace, druhu nebo přepisu pramene (`strom source edit`) potřebuje `--reason`, doplnění ne.
- Aplikace: **Spolehlivost** pramene přijde do výzkumu jako **Originál** = originál s primární informací,
  **Opis / index** = originál se sekundární informací, **Nejisté** = opis s neznámou informací.
- **Platí od:** výzkum 1.0.0; Spolehlivost z aplikace výzkum 1.12.0
- **Od aplikace 3.27.0:** aplikace drží spolehlivost i u jednotlivé citace a do souboru pro výzkum ji píše jako `QUAY`
  té citace ([A2.6.1](A2-loading-a-family-tree.md#A2.6.1)). Výzkum z ní bere jen formu a informaci nového pramene
  (výchozí spolehlivost pramene, jinak `QUAY` jeho první citace); `QUAY` citace, kterou zapsal výzkum sám, se cestou
  přes aplikaci nemění.

<!-- zdroj: research:src/commands/sources.ts:197-198, :221, :837 · src/core/evidence.ts:40 quay · src/core/sync.ts:4660 QUAY_EVIDENCE · assets/method/recording.md:38-46 · app:strings.ts sources.quality1-3, src/ui/sources.ts:76 · 3.27.0: research:ff760309 src/core/sync.ts:1095 (zdroj aplikace a.quality), :963 citedDetails (s.quay z první citace), :4361 QUAY_EVIDENCE · app:5721b016 export QUAY citace · dirigent:test/vysledek-1111-app-spolehlivost-citace.md (round trip QUAY 2/3, sync --dry-run nic nového) -->

<a id="R3.2.2"></a>
### R3.2.2 Doložené bez původního záznamu ve starších výzkumech

Výzkum založený před verzí 1.29.0 může mít Doložené údaje bez citace původního záznamu ([R3.2](#R3.2)). Jednou je
srovná oprava podle pravidel; nic neplatí a jde vzít zpět.

- **Hlídá kód:**
  - oprava proběhne sama jednou, při prvním spuštění nové verze po záloze výzkumu;
  - údaj bez citace původního záznamu, který jako Doložený zapsal agent, nebo hromadný zápis (import, převod starého
    výzkumu, dávka), dostane Pravděpodobné; Možné, když ho nedrží žádný pramen, který není slabý. Důvod stojí
    v historii údaje;
  - údaj, který jako Doložený zapsal člověk, zůstane, jak je, a čeká na jeho posouzení: v Co čeká jako jedna položka
    s počtem ve skupině **Jistota k prověření** („N údajů doložených uživatelem bez originálu záznamu: ponechat
    doložené, nebo převést na pravděpodobné?“). Údaj, který člověk po posouzení ponechal, se znovu nenabízí;
  - rozhoduje jen člověk ve svém terminálu, nikdy agent;
  - údaj s citací původního záznamu zůstane.
- **Ovládání:** terminál: Co čeká → **Ponechat doložené** / **Převést na pravděpodobné**;
  `strom fixes review proven-originals keep|lower [E…]` (bez čísel údajů všechny čekající), `strom fixes show
  proven-originals`, `strom fixes undo proven-originals`.
- **Platí od:** výzkum 1.29.0

<!-- zdroj: research:v1.35.0 src/core/provenfix.ts (PROVEN_SINCE 1.29.0, PROVEN_SETTLED, PROVEN_FIX_FILE quality/proven.json, provenFixes: by user a ne bulkWrites → left, jinak probable/possible podle isWeak) · src/commands/fixchecks.ts PROVEN_ORIGINALS (paid false, "Applied by itself once, at the first start of this strom after its backup") · src/commands/fixes.ts review proven-originals keep|lower · assets/lang/cs.json wait.group.proven, ui.waiting.proven, ui.wait.proven.keep/lower, ui.fixes.proven-originals.* · CHANGELOG.cs.md 1.29.0 -->

<a id="R3.3"></a>
## R3.3 Pramen, nebo vodítko

Rodokmen, vzpomínka, rejstřík, katalog a online strom říkají, kde hledat. Nejsou dokladem údaje. Údaj z nich zůstává
Vodítko, dokud ho nedoloží záznam.

- **Hlídá kód:** rodokmen, vzpomínka, autorské dílo a rejstřík (`--kind index`) jsou slabé prameny: údaj jen
  z nich nikdy není Pravděpodobné ani Doložené ([R3.2](#R3.2)). Údaj, který cituje jen rejstřík, zůstane Vodítko,
  dokud se nepřečte a necituje samotný zápis; s citací zápisu je údaj zápisu. Převzatý rodokmen:
  [R11.3](R11-material-from-the-user.md#R11.3).
- **Hranice:** u úprav z aplikace se rejstřík počítá jako záznam: úprava údaje doloženého rejstříkem se stane
  rozporem ([R5.2](R5-conflicts.md#R5.2)), nic se tiše nepřepíše.
- **Jen metodika:** rejstřík slouží jen k nalezení stránky; zápis se čte v matrice. I chybějící zápis v rejstříku
  je jen vodítko: podobný tvar příjmení je kandidát.
- Materiál od uživatele (doklad, fotka, dopis, co řekne): [R11.2](R11-material-from-the-user.md#R11.2).
- **Platí od:** výzkum 1.0.0
- **Od výzkumu 1.28.0:** rejstřík hlídá kód jako slabý pramen (dřív jen metodika: s jeho citací dostal údaj
  Pravděpodobné a s `--information primary` prošlo i Doložené).

<!-- zdroj: research:assets/method/core.md:8-12 · locate.md:22-24 · link.md:6-12 · intake.md:9-16 · src/core/evidence.ts isWeak (kind index od v1.28.0), isCompiled (sync) · src/core/sync.ts isCompiled · src/core/import.ts:1-7, :113-117 · src/commands/sources.ts:221 · test/cli/index-weak.test.ts · commit 9685fcbe -->

<a id="R3.4"></a>
## R3.4 Citace: výřez a přepis

Citace říká, kde přesně v prameni údaj stojí. Pramen je jeden zápis; víc zápisů jedné stránky jsou víc pramenů.

- **Jen metodika:** každý zápis ze skenu dostane `--clip` (výřez, ve kterém ho agent četl) a `--transcript` (slova
  zápisu, jak stojí, po řádcích, nepřečtené písmeno `[?]`), k tomu `--locator` (folio, strana, číslo zápisu)
  a u údaje `--quote`. Do pole (`--date`, `--house`, `--age`, jméno) jde jen to, co je přečtené jistě; nejisté jde
  do přepisu s `[?]` a do poznámky údaje.
- **Jen metodika, od výzkumu 1.28.0:** zápis v jiném jazyce nebo písmu, než je jazyk výzkumu (latina, kurent,
  polština, azbuka…), dostane vedle doslovného přepisu i překlad do jazyka výzkumu (`--translation`). Přepis zůstává
  v jazyce zápisu. Aplikace překlad ukazuje sbalený pod přepisem
  ([A3.1.1](A3-evidence-in-the-app.md#A3.1.1)).
- **Hlídá kód:** nejvýš 3 výřezy na pramen (zápis a jeho pokračování přes zlom stránky). Chybějící výřez nebo přepis
  kód neodmítne, jen připomene u pramene na skenu: po `strom source add`, po `strom source edit` se snímkem nebo
  výřezem a při `strom task done` u pramenů, které úkol zapsal.
- Starší prameny: výřez doplní `strom clips`, přepis `strom transcripts` (čtenáři, druhý pohled je zkontroluje).
- **Ovládání:** terminál: `strom source add "…" --clip B…:57@x,y,w,h --transcript @notes/zapis.txt --translation
  @notes/preklad.txt --locator "…"`; doplnění `strom source edit S… --translation "…"`.
  Aplikace ukazuje výřez zápisu vedle přepisu.
- **Platí od:** výzkum 1.1.0 (výřez, `strom clips`, `strom transcripts`); přepis 1.0.0
- **Od výzkumu 1.26.0:** nápověda volby `--clip` říká „další na každý zlom stránky, nejvýš 3“ (v 1.25.2 „druhý“).
  Pravidlo se nemění.
- **Od výzkumu 1.31.0:** místo zápisu v knize se píše po polích `--folio`, `--image`, `--call-number`; `--locator` drží
  zbytek ([R3.4.3](#R3.4.3)).

<!-- zdroj: research:assets/method/recording.md:19-27, :55-62 · src/core/media.ts:285 MAX_CLIPS, :481 transcriptNote, :492 clipNote · src/commands/sources.ts:183, :214, :250, :893 · src/commands/tasks.ts:366-369 finishTask · src/commands/clips.ts · src/commands/transcripts.ts · HEAD commit 6bc7430b · překlad: assets/method/recording.md "--translation", link.md krok 7, src/brief/brief.ts (Research language), src/commands/sources.ts:196 translation, src/gedcom/export.ts:557 (oddíl poznámky pramene „Překlad:“), commit a1ccd24e -->

<a id="R3.4.1"></a>
### R3.4.1 Přepis člověka mění jen člověk

Přepis, který člověk napsal nebo potvrdil, nezmění nikdo jiný než člověk. Jiné znění od agenta se člověku jen
navrhne. Čtení modelem AI je návrh; jistotu dává ověření člověkem.

- **Hlídá kód:**
  - přepis člověka je přepis napsaný ručně v jeho terminálu, nebo z aplikace se zaškrtnutým **Přepis ověřen** či
    s nastavením **Moje přepisy pramenů → Doloženo** ([R3.5.1](#R3.5.1)). Co pod účtem člověka zapsaly importy,
    převody a dávky, přepis člověka není;
  - takový přepis nezmění žádný příkaz agenta: úprava, dávka, synchronizace, oprava, vrácení, import ani převod.
    Jako člověk smí zapisovat jen jeho terminál a most aplikace Strom;
  - jiné znění od agenta (`strom source edit S… --transcript …`) se místo toho navrhne: poznámka u pramene a jeden
    úkol pro člověka na pramen. Čeká v **Co čeká**, skupina **K rozhodnutí – přepisy**. Žádná fronta ho nenabídne,
    agent ho nevezme, neuzavře, neodloží ani nespustí;
  - rozhoduje jen člověk:
    - **Přijmout návrh**: přepisem je navržené znění a potvrzení člověka přejde na ně;
    - **Ponechat dosavadní**: přepis zůstane, navržené znění je zamítnuté a znovu se nenavrhne, ani jeho místa;
    - **Vrátit** (po obojím): přepis i potvrzení jako předtím a návrh čeká znovu. Vrácení se odmítne, když se přepis
      mezitím změnil nebo čeká jiný návrh.
- **Přepis, který člověk nepotvrdil:** agent ho mění jen v úkolu a jen tam, kde to ukazuje sám záznam na skenu,
  s důvodem. Nové čtení ([R8.8.2](R8-reading-scans.md#R8.8.2)) je jen vodítko: kde se se skenem nedá rozhodnout,
  zapíše agent poznámku u pramene a přepis zůstane.
- **Jen metodika:** úkol z nového čtení agent uzavře tak, že záznam na skenu prohlédne sám vedle obou čtení.
- **Ovládání:** aplikace: prohlížeč pramene, blok **Návrh agenta k přepisu** (**Celé znění vedle sebe**,
  **Přijmout návrh**, **Ponechat dosavadní**, **Vrátit**); u přepisu potvrzeného člověkem po novém čtení **Dát
  k posouzení** ([R8.8.3](R8-reading-scans.md#R8.8.3)). Terminál: **Co čeká** → **Navržené znění** / **Přepis, jak
  je**; `strom source proposal S… --take proposal|keep|undo`.
- **Proč:** přepis člověka je jeho vlastní čtení záznamu. Zásada projektu: nic potvrzeného člověkem se nepřepíše;
  nový výsledek, který se liší, je úkol nebo návrh k rozhodnutí.
- **Platí od:** výzkum 1.29.0, aplikace 3.25.0

<!-- zdroj: research:c2a690ea strom help source proposal (--take proposal|keep|undo, --task, --proposed) · src/core/waiting.ts:375-390 (kind transcript, group transcripts, choices proposal/keep, ne TERMINAL_ONLY) · src/core/sync.ts:3862 (app read = evidence || verified) · assets/lang/cs.json proposal.*, ui.proposal.*, wait.group.transcripts, read.source.why, read.source.done · CHANGELOG.cs.md 1.29.0 („Přepis, který uživatel přečetl nebo potvrdil, je uživatelův“) · commity 284605bf, 8803cd70 · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 4, 5) · app:6bd8609e strings.ts read.pTitle, pWhole, pAccept, pKeep, pUndo, pAccepted2, pKept2, pNote, tReview · src/ui/read-source-state-view.ts proposalHtml · spec 065 K2.3, spec 059 K3.2 -->

<a id="R3.4.2"></a>
### R3.4.2 Překrývající se výřezy jsou jeden

Dva výřezy téhož obrázku, které se hodně překrývají, jsou jeden zápis vystřižený dvakrát. Výzkum je spojí v jeden.

- **Hlídá kód:**
  - dva výřezy téhož obrázku, které se překrývají aspoň o 30 % menšího z nich, se spojí do obdélníku přes oba,
    na místě prvního. Opakovaně: tři výřezy v řadě jsou jeden;
  - výřez, který leží aspoň z 90 % uvnitř většího (detail jména nebo data, zápis vedle celé strany), zůstane. Dva
    skoro stejné obdélníky (každý aspoň z 90 % v druhém) se spojí;
  - výřezy oddělené, jen se dotýkající nebo na jiných obrázcích zůstanou;
  - spojuje se jen to, co zapsal výzkum (agent, sezení, dávka agenta, `strom clips`); agentovi se řekne, co se spojilo.
    Výřez od člověka (terminál, aplikace) se nikdy nemění;
  - starší výzkum se spojí jednou, při prvním startu nové verze nebo startu mostu: jen výřezy, které podle historie
    zapsal agent nebo sezení, jedna zapsaná operace na pramen. Přepis a potvrzení člověka zůstanou.
- **Proč:** čtenář výřezem jednou utne spodní řádky, podruhé pravou část, a aplikace pak ukazuje dva skoro stejné
  výřezy téhož zápisu.
- **Ovládání:** nic: spojuje se samo při zápisu výřezu (`strom source add|edit --clip` agentem, `strom clips`).
- **Platí od:** výzkum 1.29.0

<!-- zdroj: research:c2a690ea src/core/clipmerge.ts (hlavička, CLIP_OVERLAP = 0.3, CLIP_NESTED = 0.9, cutTwice, mergeOverlappingClips, handClipped, agentClipped, settleClips, CLIPS_SETTLED) · commity 599f9681, 326bae02 · CHANGELOG.cs.md 1.29.0 · dirigent:prace/1107-vyzkum-drobnosti-ukoly/karta.md Výsledek (Popis chování 6) -->

<a id="R3.4.3"></a>
### R3.4.3 Kde zápis stojí: folio, snímek, signatura

Kde zápis v knize stojí, si výzkum drží po polích, aby zápis našel znovu i tehdy, když se odkaz na snímek přestane
otevírat.

- **Pole pramene:** `--folio` (strana nebo folio, jak knihu čísluje, i se slovem: „pag. 112“, „fol. 12v“), `--image`
  (číslo snímku na portálu archivu), `--call-number` (signatura knihy u zápisu mimo evidované knihy výzkumu) a vedle
  nich `--locator` pro zbytek (číslo zápisu, sloupec).
- **Jen metodika:** agent pole vyplňuje při zápisu. Folium vždy, snímek jen u zápisu bez evidovaného skenu (ten číslo
  snímku dává výřez), signaturu jen mimo evidovanou knihu. Odkaz, který už zápis neotevře, agent dohledá podle
  archivu, signatury, folia a snímku z `strom source show` (číslo snímku se může o pár posunout, folio ne), jen přes
  strom, a opraví ho `strom source edit S… --url … [--image …] --reason "…"`.
- **Hlídá kód:**
  - `strom source show` má řádek `find` s archivem, signaturou, foliem a snímkem pohromadě (snímek i z evidovaných
    skenů). U staršího pramene, jehož umístění jmenuje folio nebo snímek, navrhne „from its locator: --folio …
    --image … --locator …“; sám nic nezapíše;
  - doplnění prázdného pole důvod nepotřebuje, změna vyplněného pole ano (`--reason`). `--locator ""` (s důvodem)
    umístění vyprázdní, když v něm nic jiného než folio a snímek z polí nezbylo; `source show` to tehdy navrhne;
  - GEDCOM: jedna čitelná `PAGE` složená z polí („pag. 112, č. 3, snímek 57“, v jazyce výzkumu) pro aplikaci Strom
    i jiné programy, signatura jako `CALN`. Samotná pole (`_STROM_FOLIO`, `_STROM_IMAGE`, `_STROM_LOCATOR`) dostane jen
    aplikace Strom, která je čte. Pramen bez těchto polí se exportuje přesně jako dřív;
  - `PAGE` nikdy neřekne dvě čísla snímku ani folia. Jmenuje-li umístění jiné číslo než pole, platí v `PAGE` pole,
    umístění samo zůstane a `source add|edit|show` upozorní a navrhne zbytek umístění (`--locator "<zbytek>"`).
- **Hranice:** rozpoznání folia a snímku je kód stromu, bez agenta, stejné jako v aplikaci
  ([A3.9](A3-evidence-in-the-app.md#A3.9)). Dvě folia nebo dva snímky v jednom umístění se nerozpoznají. Stávající
  prameny zůstávají, jak jsou, dokud je člověk nerozdělí ([R3.4.4](#R3.4.4)). Úpravy polí z aplikace a jejich smazání:
  [S2.2.2](S2-edits-from-the-app.md#S2.2.2).
- **Ovládání:** terminál: `strom source add "…" --folio "pag. 112" --image 57 --locator "č. 3"`, `strom source edit S…
  --folio … --image … --call-number … [--reason "…"]`, `strom source show S…`; `strom source list <text>` hledá
  i ve foliu a snímku.
- **Platí od:** výzkum 1.31.0
- **Od výzkumu 1.36.0:** číslo snímku, které dávají jen evidované skeny, má v souboru pro aplikaci Strom pod
  `_STROM_IMAGE` značku `2 _STROM_DERIVED Y`. Aplikace ho pak k umístění přidá a nevystřihne z něj číslo jiného
  snímku ([A2.6](A2-loading-a-family-tree.md#A2.6)).

<!-- zdroj: research:4de28f00 src/core/model.ts Source.folio/image/callNumber, src/core/sourcefields.ts recognizeLocation, composedPage, sourceImage, sourceCallNumber, locatorOverlap · src/commands/sources.ts:117-145 (--reason jen při přepsání), :210 --call-number, :287 filtr list, :330-336 řádky find a „from its locator“, :374 locatorArg · src/gedcom/export.ts:239, :374-379, :723-728 PAGE/CALN/_STROM_* · a0751973 (N1: PAGE bez dvou čísel) · 320a7738 (--locator "") · assets/method/recording.md:25-31, reading.md:85-89 · CHANGELOG.cs.md 1.31.0 „Zápis se najde znovu“ · spec 075 P2 · 1.36.0: research:519951b3 src/gedcom/export.ts (image.derived → 2 _STROM_DERIVED Y), src/core/sourcefields.ts sourceImage derived, src/gedcom/validate.ts · app:2e68d373 src/source-location.ts composePage · CHANGELOG.cs.md 1.36.0 -->

<a id="R3.4.4"></a>
### R3.4.4 Rozdělení starých umístění: náhled, zapíše člověk

Starší prameny mají umístění jedním textem („fol. 12, snímek 3“). Příkaz `strom source split` je rozdělí do polí
najednou: kód, bez agenta a zdarma.

- **Hlídá kód:**
  - bez přepínače je to jen **náhled**: kolik pramenů by se rozdělilo, prvních 10 „před → po“ (`--all` všechny),
    kolik se nerozpoznalo, s až třemi příklady, jak jsou zapsané. Nic se nezapíše. Náhled smí spustit i agent;
  - `--apply` zapíše rozdělení jedním krokem a vypíše `undo: strom source split --undo <id>`; `--undo <id>` vrátí
    všechny prameny, jak byly. Obojí jen člověk ve svém terminálu, agentovi to strom odmítne;
  - vyplněné folio nebo snímek zůstane. Snímek, který dávají evidované skeny, se nebere. Část, kterou pole říká
    jinak, zůstane v umístění. Umístění, ve kterém se nic nerozpozná, zůstane, jak je. Pramen, který už má folio nebo
    snímek, se mezi nerozpoznané nepočítá: zbytek jeho umístění není co rozdělit;
  - vrátit jde posledních 5 rozdělení, každé svým id. Pramen změněný po rozdělení vrácení odmítne celé.
- **Jen metodika:** agent rozdělení člověku nabídne, nikdy ho sám nepotvrdí.
- **Z aplikace Strom:** výzkum nabízí stejné rozdělení i aplikaci, když běží: náhled s počtem, rozdělení na kliknutí
  člověka jedním krokem podle toho náhledu, vrácení celé ([A3.9.1](A3-evidence-in-the-app.md#A3.9.1)). Prameny změněné
  mezitím náhled odmítne a ukáže znovu. V Archivu Stromu rozdělení není.
- **Ovládání:** terminál: `strom source split`, `strom source split --all`, `strom source split --apply`, `strom source
  split --undo <id>` (náhled vypisuje id k vrácení).
- **Platí od:** výzkum 1.31.0

<!-- zdroj: research:c6260e50 src/commands/sourcesplit.ts (SHOWN 10, PERSON, agentMay jen bez --apply a --undo), src/core/sourcesplit.ts splitOf, UNDO_KEPT 5, SOURCE_SPLIT_FILE quality/source-split.json, undoSplit (po změně odmítne celé) · c4fe4fac most GET/POST <token>/sources/split, /sources/split/undo, feature sources.split, 409 plan/changed/archive, 503 busy · assets/method/recording.md:30-31 · CHANGELOG.cs.md 1.31.0 · spec 075 K4.1, K4.3 · příklady nerozpoznaných a nic u zbytku vedle pole: research:ff760309 src/core/sourcesplit.ts splitPlan (unrecognizedExamples, EXAMPLES 3, nothing), src/commands/sourcesplit.ts:67 -->

<a id="R3.4.5"></a>
### R3.4.5 Pořadí citací údaje a hlavní citace

Citace údaje výzkum řadí stejně jako aplikace ([A3.2.2](A3-evidence-in-the-app.md#A3.2.2)): první je hlavní citace,
kterou zvolil uživatel, pak primární záznam události, pak ostatní podle spolehlivosti. Uložené pořadí se nemění;
pořadí platí v každém souboru GEDCOM (pro aplikaci Strom, `/tree.ged`, soubor pro jiné programy), v briefu agenta
a ve výpisech `strom … show`.

- **Hlídá kód:**
  - pořadí: 1. hlavní citace; 2. primární záznam události: zápis tohoto druhu události (křest nebo narození
    u narození a křtu, úmrtí nebo pohřeb u úmrtí, pohřbu a kremace, sňatek u sňatku, ohlášek a zasnoubení, sčítání
    u sčítání), originál s prvotní informací (`QUAY` 3) nebo originál, jehož informaci nikdo neposoudil (`QUAY` 2 jen
    pro chybějící slovo, [R3.2.1](#R3.2.1)), zapsaný nejvýš 12 měsíců od údaje; dřív zapsaný první, bez data
    zápisu za zapsanými s datem; chybějící nebo nečitelné datum nerozhoduje; 3. ostatní `QUAY` 3; 4. ostatní podle
    `QUAY` sestupně; 5. číselná část čísla pramene (bez čísla za číslovanými), pak pořadí přidání;
  - citace zápisu jiné události, která nemá vlastní informaci, má v pořadí a v exportu `QUAY` druhotné informace
    (pohřební zápis u narození). Stupeň jistoty údaje se tím nemění;
  - jména a citace osoby a rodiny (`1 SOUR`) se řadí bez kroku 2;
  - jaké události pramen zapisuje, píše export jako `1 DATA` › `2 EVEN` u pramene: vždy v souboru pro jiné programy,
    aplikaci Strom jen té, která to čte;
  - `strom event main <E> <S>` označí citaci pramene S jako hlavní, `--locator "<kde>"` vybere jednu z víc citací
    téhož pramene, `--clear` hlavní citaci zruší (platí pořadí výzkumu). Výpis: „hlavní záznam údaje zvolen: …“,
    „údaj bez hlavního záznamu (pořadí výzkumu): …“, „není co měnit: …“;
  - hlavní citaci volí jen člověk, v aplikaci Strom ([S2.3.1](S2-edits-from-the-app.md#S2.3.1)) nebo ve svém
    terminálu. Agentovi `strom event main` odmítne (`main.person`) s radou, ať to řekne uživateli. Agentova
    nová citace se řadí za hlavní, nikdy ji nenahradí;
  - `strom person show`, `strom family show` a `strom event show` vypíšou citace v tomto pořadí, hlavní s „(hlavní,
    volba uživatele)“; `--json` má `citationOrder`.
- **Hranice:** obecné vrácení hlavní citace z terminálu není: zruší se `--clear`, nebo se znovu nastaví předchozí.
- **Ovládání:** terminál: `strom event main E0001 S0001`, `strom event main E0001 S0001 --locator "fol. 12"`,
  `strom event main E0001 --clear`, `strom event show E0001`.
- **Platí od:** výzkum 1.34.0

<!-- zdroj: research:355df0a5 src/core/citeorder.ts (pořadí K1.1, SOURCE_EVENTS, FACT_RECORDS, monthsApart, quayAt, mainCitation), src/gedcom/export.ts (1 DATA / 2 EVEN, _STROM_MAIN) · ce8dc753 src/commands/people.ts ["event","main"] (personWrites, code main.person, a source or --clear, which source?, --locator not with --clear), core chooseMainCitation · src/core/actions.ts citeEvent (main nikdy) · assets/lang/cs.json ui.event.main, ui.event.main.off, ui.event.main.same, ui.show.main · ZADANI_VYZKUM_hlavni-citace.md Odpověď V1–V3 · dirigent:prace/1115-vyzkum-095-cli-drobnosti (U6: undo není) · spec 095 K1.1, K2.3 -->

<a id="R3.4.6"></a>
### R3.4.6 Citace odebraná uživatelem

Citaci, kterou uživatel od údaje odebral ([A3.2.3](A3-evidence-in-the-app.md#A3.2.3), [S2.3.1](S2-edits-from-the-app.md#S2.3.1)),
si výzkum u údaje pamatuje: pramen, místo v něm a kdy. Agent ji tam sám nevrátí.

- **Hlídá kód:**
  - `strom cite` agentovi takový pramen u téhož údaje odmítne (`cite.removedByUser`: „the user removed S… from E…
    (datum): it is not cited there again on its own“) s radou citovat jen s novým důvodem, proč zápis k údaji patří:
    `strom cite E… S… --reason "<proč>"`. S důvodem se citace zapíše a odebrání se uzavře;
  - člověk ve svém terminálu citovat smí vždy; tím odebrání uzavře. Totéž udělá aplikace Strom, která citaci znovu
    přidá;
  - podle místa: odebrání bez místa brání každému místu pramene; odebrání jednoho místa brání tomu místu a citaci
    bez místa. Jiné místo téhož pramene jde citovat (jedna kniha mívá křest i pohřeb téže osoby);
  - `strom … show` vypíše u údaje „(odebráno uživatelem: S…)“, brief agenta totéž.
- **Hranice:** pokyny metodiky o odebraných citacích nic neříkají; hlídá je jen kód.
- **Ovládání:** terminál: `strom cite E0001 S0001 --reason "…"`, `strom event show E0001`.
- **Platí od:** výzkum 1.34.0

<!-- zdroj: research:355df0a5 src/core/citeorder.ts removedByUser (locator), refuseRemoved (cite.removedByUser), clearRemoved · src/core/actions.ts:690 citeEvent (personWrites, --reason) · src/core/model.ts Event.uncited · src/core/sync.ts:5268 (aplikace cituje znovu) · src/brief/brief.ts:169 · assets/lang/cs.json ui.show.uncited · 4cd81f14 (vrácení: značka odebrání patří svému poslání) · spec 095 K3.2, K3.3 -->

<a id="R3.5"></a>
## R3.5 Slepé druhé čtení

Závěr, který stojí na jedné těžko čitelné buňce (číslo domu, věk, křestní nebo rodné jméno), potřebuje druhé,
nezávislé čtení. Nad Pravděpodobné jde údaj jen tehdy, když se dvě nezávislá čtení shodnou.

- **Jen metodika:** druhý čtenář neví očekávanou hodnotu, jméno, místo ani proč na tom záleží. Jedna buňka, jeden
  čtenář. Nejdřív `strom readings B… --image N`: dvě čtení už možná jsou. Čtení se liší: agent se znovu podívá;
  skutečný rozdíl je rozpor s oběma čteními (viz [R5](R5-conflicts.md)), ne volba.
- **Hlídá kód:** `strom read --blind` řekne čtenáři, že čte slepě (přepsat přesně, nic nedoplňovat). Dvoustranu dá
  ve dvou ostřejších půlkách; zpráva čtenáře má v hlavičce „Blind: yes“. Kód **nekontroluje**, že Doložený údaj
  slepé čtení má ([R3.2](#R3.2)).
- **Kdy ho metodika chce:** před Doložené u údaje na jedné těžké buňce; v úkolu ověření z revize osoby (údaje
  Pravděpodobné, které citují pramen se snímkem: shoda → Doložené, rozdíl → rozpor); u přepisu uživatele
  ([R3.5.1](#R3.5.1)).
- **Ovládání:** terminál: `strom read M… --blind --crop x,y,w,h --question "…"`; revize osoby: menu **Revize osoby:
  prověřit a doplnit, co o ní víme**, `strom review`.
- **Platí od:** výzkum 1.0.0; úkol ověření z revize osoby 1.1.0

<!-- zdroj: research:assets/method/verify.md:3-18 · recording.md:62-65 · src/commands/read.ts:192, :206, :334, :506 · src/core/reader.ts:194 readerPrompt · src/core/review.ts:205 singleReadings, :269 · src/core/phrases.ts review.verify.* · cs.json ui.menu.review -->

<a id="R3.5.1"></a>
### R3.5.1 Přepisy a čtení z aplikace

Přepis, který uživatel napíše v aplikaci, výzkum nikdy nebere za Doložené a nepřepíše ho. Jak s ním počítá, určuje
nastavení stromu v aplikaci.

- **Moje přepisy pramenů → Vodítko** (výchozí): nový údaj z přepisu je Vodítko. Výzkum navrhne úkol ověření.
- **Moje přepisy pramenů → Doloženo**, nebo u pramene zaškrtnuté **Přepis ověřen**: přepis platí jako první čtení.
  Údaje na něm jsou Pravděpodobné, ne Doložené. Volba platí pro prameny nové nebo změněné od dalšího poslání.
- Dokument přečtený čtenáři výzkumu: jeden čtenář → Možné; dva slepí čtenáři shodně → Pravděpodobné; přepis
  upravený v aplikaci, rozdílná čtení, nejistý čtenář nebo údaj, který čtení neuvádí → Vodítko.
- **Hlídá kód:** tyto stupně. Z aplikace nikdy nevznikne Doložené.
- **Jen metodika:** v úkolu ověření agent dohledá záznam, zaregistruje snímek a přečte ho slepě sám. Shoda →
  poznámka u pramene; rozdíl → rozpor s oběma čteními.
- **Platí od:** výzkum 1.12.0, aplikace 3.9.0; čtení dokumentu čtenáři výzkumu 1.18.0

<!-- zdroj: research:assets/method/verify.md:19-24 · src/core/sync.ts:220, :824, :3367 readsFor, :3870 reading, :3992 · src/core/readsync.ts:190 readingGrade · cs.json sync.verify.*, read.note.* · app:strings.ts treeSettings.transcripts/guide/evidence/evidenceDesc/notRetroactive, sources.verified -->

<a id="R3.5.2"></a>
### R3.5.2 Kdy pramen přečetl uživatel

U pramene výzkum drží, kdo ho přečetl: výzkum (model sezení, čtenáři dokumentu), uživatel, nebo oba. Uživatel je
čtenářem jen ze skutečného čtení. Pramen, který uživatel přečetl, výzkum nenabízí ke čtení znovu.

- **Hlídá kód:** čtením uživatele je jen:
  - přepis, který uživatel napsal v aplikaci nebo u něj zaškrtl **Přepis ověřen** ([R3.5.1](#R3.5.1));
  - čtení dokumentu, které uživatel v aplikaci poslal do stromu ([R8.8](R8-reading-scans.md#R8.8));
  - přepis výzkumu, který uživatel v aplikaci potvrdil (**Potvrdit přepis**,
    [A3.1.3](A3-evidence-in-the-app.md#A3.1.3));
  - přepis, který člověk napsal ručně ve svém terminálu.
- **Hranice:**
  - import, převod starého výzkumu, dávka, skript ani agent, kterého strom nepozná, čtenářem uživatele neudělá,
    i když zapisují jménem uživatele. GEDCOM z jiného programu (`strom import`) dá údaje jako Vodítko;
  - potvrzení platí pro znění přepisu, které uživatel viděl. Když výzkum přepis potom změní, potvrzení se nepočítá
    (zůstane v historii) a potvrdit jde nové znění;
  - potvrzení samo stupeň žádného údaje nemění. Je-li pramen původní záznam s primární informací, může na něm údaj
    být Doložený ([R3.2](#R3.2)); jinak nejvýš Pravděpodobný;
  - potvrdit a vzít zpět jde jen z aplikace, člověkem; agent to nesmí. Potvrdit nejde v Archivu Stromu, u pramene
    sloučeného nebo odvolaného, bez přepisu ani u přepisu, který výzkum nečetl nebo který uživatel už přečetl.
- **Oprava starších výzkumů:** do výzkumu 1.28.0 se za čtení uživatele počítal každý zápis jménem uživatele. Jednou
  při prvním spuštění nové verze po záloze: pramen, který zapsal jen hromadný běh (import, převod, dávka), čtení
  uživatele ztratí; pramen, který člověk zapsal ručně, ho podrží. Nic neplatí; `strom fixes undo readers` čtení
  vrátí.
- **Ovládání:** aplikace: **Potvrdit přepis** / **Zrušit potvrzení** pod přepisem pramene ([A3.1.3](A3-evidence-in-the-app.md#A3.1.3));
  terminál: `strom fixes show readers`, `strom fixes undo readers`.
- **Platí od:** výzkum 1.29.0, aplikace 3.25.0

<!-- zdroj: research:v1.35.0 src/core/readers.ts (komentář: čtení uživatele jen app.read, Source.reading, POST /sources/confirm, read.user z terminálu; userReading jen pro aktuální transcriptMark) · src/core/readerfix.ts (READERS_SINCE 1.29.0, bulkWrites, how "earlier", undo) · src/commands/fixchecks.ts READERS (paid false) · src/core/confirm.ts confirmCheck (confirm.archive/none/merged/retracted/reader/changed), shrnutí „original … primary may make a fact proven; of anything else at most probable“ · src/commands/sources.ts source confirm (STROM_FOR_APP, ne agent: confirm.app) · src/core/import.ts (status lead) · CHANGELOG.cs.md 1.29.0 · app:v3.30.0 src/source-confirm.ts · CHANGELOG 3.25.0 -->

<a id="R3.6"></a>
## R3.6 Negativní hledání

Marné hledání je výsledek. Každé hledání se zapíše, i bez nálezu, s tím, co přesně pokrylo. Nejdražší chyba je
prohledat stejnou knihu dvakrát.

- **Hranice (hlídá kód):**
  - `--result found|negative|partial|inconclusive`; `found` potřebuje `--found S…`: pramen se zapíše první
    (`strom source add`). Bez `--found` kód hledání odmítne a řekne toto pořadí s přesným dalším příkazem (od výzkumu
    1.33.0);
  - pramen připojený k hledání omylem odebere `strom search edit Q… --drop-found S… --reason "…"` (i víc pramenů),
    `--no-found` odebere všechny. Hledání `found`, kterému nezbude žádný pramen, musí říct, čím je teď
    (`--result negative|partial|inconclusive`), jinak se úprava odmítne (od výzkumu 1.33.0);
  - `negative` kód odmítne, dokud v prohledaném rozsahu zůstává místo, které čtenář nahlásil jako nejasné, a nikdo
    se na ně od té doby nepodíval v plné velikosti, na správné straně dvoustrany. Počítají se čtení od prvního
    sezení úkolu (jinak posledních 24 hodin). Pak zbývá `--result inconclusive` s místem v `--note`, nebo
    `--result partial` s jasně přečtenými stranami v `--pages`;
  - marné hledání v rejstříku (`--method index`) se vypisuje jako „negative in the index only“;
  - `strom task done` u úkolu kde jsou záznamy, doložení vazby, ověření a obohacení osoby připomene, když úkol
    nezapsal žádné hledání.
- **Jen metodika:** negativ až po pohledu na strany v plné velikosti. Chybějící strany knihy nejsou prohledané
  (`--pages 40-52,55-69`). Po `--until-found` jen přečtené snímky, jako `--result partial`.
- **Ovládání:** terminál: `strom search add "…" --recordset B… --years … --surname … --pages … --method
  index|page-by-page|full-text|catalog|web|request|other --result negative --by main|reader|user --note "…"`
  (`--by agent` je totéž co `main`); oprava `strom search edit Q… --drop-found S…|--no-found --reason "…"`.
- **Platí od:** výzkum 1.0.0; odmítnutí nad nejasným místem a „jen v rejstříku“ 1.14.0; pořadí s pramenem,
  `search edit --drop-found|--no-found` a `--by agent` 1.33.0

<!-- zdroj: research:assets/method/core.md:22-25 · reading.md:22-30, :70-84 · src/commands/analysis.ts:208-268 · src/core/model.ts:484-485 · src/commands/readings.ts:347-380 openUnclear, :414 refuseNegativeOverUnclear · src/core/evidence.ts:21 searchedAs · src/commands/tasks.ts:348-351 · 1.33.0: research:7bdba196 search add (search.found.first), search edit --drop-found/--no-found (search.found.none|empty|not|which), strom help search edit · c50f80f5 --by agent (= main) · CHANGELOG.cs.md 1.33.0 -->

<a id="R3.7"></a>
## R3.7 Kdy se agent ptá člověka

Čtení a stupně jistoty určuje agent sám. Člověka se ptá jen tam, kde bez něj nejde dál. Otázka jde do **Čeká na
vyřízení** (viz [R6](R6-awaiting-action.md)) jako neosobní věta.

- **Jen metodika,** agent se ptá (`strom task wait T… --on "…"`): podobný tvar příjmení ve správném domě nebo letech
  (požádá o stránku, než ho vyloučí); katalog, který agent neotevře (`--kind web --url`); snímky, které archiv
  nedovolí stahovat automaticky (`--images B…:40-69`); stránka, která automatizaci brání (`--check <url>`), jen když
  jiná cesta nevedla a pramen zůstává nutný.
- **Hlídá kód,** jen člověk: odpověď na čekající úkol (`strom task wake T… --answer`) a na kontrolu stránky
  (`--check`) potvrdí člověk ve svém terminálu nebo v okně; „není chyba“ u nálezu kontroly (`strom quality dismiss`).
- **Jen metodika:** rozpor, který rozhodl uživatel, platí; agent ho otevře znovu jen kvůli prameni, který
  rozhodnutí nevážilo (viz [R5](R5-conflicts.md)). Přepis uživatele agent nepřepíše ([R3.5.1](#R3.5.1)).
- **Platí od:** výzkum 1.0.0; odpověď jen člověkem nejpozději 1.14.0; „není chyba“ 1.22.0

<!-- zdroj: research:assets/method/link.md:6-12 · locate.md:17-27 · reading.md:105-121 · waiting.md:14-17 · core.md:124-130 · recording.md:77-81 · src/commands/tasks.ts:928-946 task.check-person, task.answer · src/commands/quality.ts PERSON · src/cli/main.ts:287-290 requireHuman -->

<a id="R3.8"></a>
## R3.8 Jak doložení ukazuje aplikace

Aplikace používá slovo „doloženo“ ve více významech. Stupeň jistoty určuje výzkum; úroveň doložení osoby počítá
aplikace sama, jen z citací.

| Kde v aplikaci | Co ukazuje | Podle čeho |
|---|---|---|
| štítek u údaje, např. **Doložené** | stupeň jistoty údaje | výzkum ([R3.1](#R3.1)) |
| **Přehled stromu → Kvalita dat → Jistota údajů z výzkumu** | narození, úmrtí a sňatky podle stupně | výzkum |
| stránka osoby, **Pro badatele → Jistota údajů** | stupeň každého údaje osoby | výzkum |
| **Doloženo** / **Částečně doloženo** / **Nedoloženo** | úroveň doložení osoby | citace ([R3.8.1](#R3.8.1)) |
| **Pro badatele**, „Doloženo prameny: N z M údajů“ | údaje osoby s pramenem | citace |
| **Přehled stromu → Předci**, sloupec **doloženo** | předci s doloženým narozením | s výzkumem jen Doložené, jinak citace |
| **Kde chybí doklady → Narození neověřená výzkumem** | narození předků, která nejsou Doložené | výzkum |
| kniha, **Údaje pro badatele**: doloženo · rozpor · nedoloženo | stav doložení údaje | Doložené, **nebo** jakákoli citace |
| **Moje přepisy pramenů → Doloženo** | jak výzkum bere přepisy uživatele | první čtení, Pravděpodobné ([R3.5.1](#R3.5.1)) |

- **Hranice:** stupně jistoty aplikace jen ukazuje, změnit je nejde. Rozpor u údaje v knize přebije „doloženo“ i „nedoloženo“.
- **Platí od:** aplikace 3.5.0 (úroveň osoby), 3.9.0 (štítek, Moje přepisy pramenů), 3.13.0 (Jistota údajů
  z výzkumu), 3.13.1 (sloupec doloženo), 3.18.0 (Pro badatele), 3.19.0 (kniha)

<!-- zdroj: app:src/ui/fact-status.ts · src/tree-overview.ts:224-233 birthDocumented · src/ui/tree-overview.ts:1037, :1960, :1650-1680 · src/person-page.ts:1014-1019 · src/book-blocks.ts:468-484 evidenceMark · strings.ts treeOverview.*, personPage.research.*, book.evidence.*, book.dlg.research(Hint), treeSettings.evidence -->

<a id="R3.8.1"></a>
### R3.8.1 Úroveň doložení osoby

- **Nedoloženo**: osoba, její události ani její svazky necitují žádný pramen.
- **Doloženo**: citované narození (nebo křest) a, když má osoba úmrtí (datum, místo, událost úmrtí nebo
  pohřbu), i citované úmrtí (nebo pohřeb, kremace).
- **Částečně doloženo**: všechno mezi tím, i pramen přiložený jen k osobě (ke jménu, k bydlišti).
- Stupeň jistoty se nepočítá: narození citující i převzatý rodokmen (Vodítko) dává **Doloženo**. Aplikace to říká u **Jistota
  údajů z výzkumu**: „Nezaměňovat s doložením pramenem.“
- Když ve stromu necituje pramen nikdo, karta úroveň neukazuje. Zástupná osoba úroveň nemá.
- **Ovládání:** aplikace: značka na kartičce ve stromu, který původ údajů nezná ([S7.2](S7-reliability-and-verification.md#S7.2));
  režim **Doložení** ve stromu ([A3.7](A3-evidence-in-the-app.md#A3.7)); **Přehled stromu → Kvalita dat → Kde chybí
  doklady**.
- **Platí od:** aplikace 3.5.0; 3.26.0: úroveň ukazuje jedna značka na kartičce ([S7.2](S7-reliability-and-verification.md#S7.2))

<!-- zdroj: app:src/evidence-level.ts personEvidence, treeHasAnySource · strings.ts treeHealth.evidenceMode/evFull/evPartial/evNone, cardDensity.cardShowHint, treeOverview.certaintyDesc · app:7eb903a3 src/reliability.ts cardStatus (bez původu: full ●●, partial ●○, none) · src/ui/fact-status.ts card.evTitle · strings.ts cardDensity.cardStatus (3.26.0 nahradila cardEvidence) -->

<a id="R3.9"></a>
## R3.9 Vyprávění drží své prameny

Vyprávění říká, o které prameny se opírá. Nová verze vyprávění nic z předchozí verze neztratí bez důvodu.

- **Hranice:**
  - prameny vyprávění jsou prameny, které citují jeho údaje, prameny pozadí místa a doby a prameny, které text
    jmenuje jen identifikátorem;
  - nová verze musí ponechat každý údaj, pramen a odkaz předchozí verze, nebo ho vynechat s důvodem. Jinak ji
    výzkum odmítne a vypíše, co by chybělo. Co verze vynechala a proč, zůstane u vyprávění;
  - vyprávění podle vodítka jmenuje v textu název pramene a to, že záznam zatím nikdo nečetl. Když text pramen
    nejmenuje, výzkum na to upozorní;
  - schválení vyprávění zůstává na člověku ([R5.5](R5-conflicts.md#R5.5)).
- **Ovládání:** terminál: `strom story show P…` (každý údaj s prameny, pak pozadí), `strom story set P… --fact E…
  --source S… --drop "E… <proč>"`. Soubor Stromu: prameny vyprávění jako `2 SOUR` pod `_STORY`.
- **Platí od:** výzkum 1.26.0

<!-- zdroj: research:src/core/storykeep.ts StoryVersion, StoryDrop, StorySource, storySources · src/commands/story.ts:104 --drop, :151 told from a lead, :231 story show · assets/method/narrate.md · CHANGELOG.cs.md 1.26.0 -->

<a id="R3.9.1"></a>
### R3.9.1 Co vyprávění tvrdí

Vyprávění se píše z údajů pro rodinu. Co se nedoložilo, se nedomýšlí.

- **Jen metodika:**
  - každé tvrzení stojí na zapsaném údaji; co je odvozené, je označené jako odvození; co se neví, se řekne;
  - pozadí místa a doby (válka, epidemie, požár, čím vesnice žila) jen z pramene zapsaného ve výzkumu a jen jako
    pozadí, nikdy jako příčina toho, co osoba udělala, pokud to neříká záznam;
  - vyprávění páru vypráví společný život: sňatek, domácnost, domovy, děti, ovdovění. Život každého před ním a po něm
    patří jeho vlastnímu vyprávění a zmíní se jednou větou;
  - staré povolání a pojem, kterému čtenář nerozumí, se vysvětlí; píše se v jazyce výzkumu;
  - formát textu: jen odstavce, podnadpisy, odrážky, tučné písmo a kurzíva. Ostatní (odkazy, tabulky, citace,
    číslované seznamy) aplikace podle metodiky ukáže jako prostý text.
- **Proč:**
  - nic se nedomýšlí: vyprávění je pro rodinu a stojí na dokladech. Co by znělo pravděpodobně, ale doložené není,
    by se v rodině začalo brát jako fakt;
  - pozadí: je doložené pro místo, ne pro člověka; jako příčina toho, co osoba udělala, by bylo domněnkou vydávanou
    za fakt. Pramen pozadí vyprávění jmenuje (`--source`), aby šel ověřit;
  - vyprávění páru: společný život se vypráví jednou, u páru, aby se tentýž život nevyprávěl dvakrát a verze se
    nerozcházely;
  - formát: aplikace Strom ukáže jen odstavce, podnadpisy, odrážky, tučné písmo a kurzívu; ostatní by čtenář viděl
    jako prostý text se značkami.
- Schválení a nová verze schváleného vyprávění: [R6.3.2](R6-awaiting-action.md#R6.3.2).
- **Ovládání:** terminál: `strom story set P… --text @notes/… --fact E… --source S… --note "co je odvozené"`
  (vyprávění páru na rodině F…).
- **Platí od:** výzkum 1.0.0; pozadí místa a doby 1.10.0; formát textu 1.8.0; vyprávění páru 1.23.0

<!-- zdroj: research:assets/method/narrate.md (celé; formát od v1.8.0, pozadí od v1.10.0, pár od v1.23.0) · research:src/commands/story.ts --note -->

<a id="R3.10"></a>
## R3.10 Smazaný pramen se odvolá

Pramen, který člověk smaže, výzkum neodstraní, ale odvolá (důvod „deleted“): zmizí z rodokmenu, který dostává
aplikace, a `strom source restore` ho vrátí i s citacemi.

- **Co odvolání udělá:**
  - citace pramene se odeberou z údajů, jmen a rodin a uchovají se v prameni. Hodnoty údajů zůstanou;
  - údaj, jehož stav zbylé citace neunesou jako jistý, se sníží. Hlavní citace pramene zmizí a jiná se místo ní
    nevybere;
  - úkol, který pracuje jen s tímto pramenem, se vzdá; úkol s dalšími místy pokračuje bez něj;
  - rozpor, který na prameni stojí, dostane značku přezkoumání a jeho stav zůstane. Značku sundá
    `strom conflict keep` (rozhodnutí platí) nebo nové rozhodnutí rozporu;
  - text vyprávění se nikdy nemění; pramen jen vypadne z jeho seznamu pramenů.
- **Obnovení** (`strom source restore`): pramen dostane zpět stejné ID a každá citace se vrátí k údaji, u kterého
  byla (u osoby sloučené mezitím k té, do které šla), pokud údaj ještě je a pramen už necituje. Hlavní citace se
  vrátí jen tam, kde se mezitím hlavní nestala jiná; snížený stav se vrátí jen tam, kde ho mezitím nikdo nezměnil;
  úkoly jen tam, kde se nezměnily. Značky přezkoumání zmizí.
- **Co výzkum řekne:**
  - `strom source show S…` u smazaného pramene řekne, kdy ho člověk smazal a kde (v terminálu, nebo v aplikaci
    Strom), kolik citací je v něm uloženo a jak ho vrátit;
  - `strom source list --retracted` vypíše jen odvolané prameny: smazané (s počtem uložených citací a řádkem, jak
    pramen vrátit), sloučené a vzaté zpět.
- **Hlídá kód:**
  - všechno, nebo nic: pramen, který výzkum nemá nebo už je odvolaný, a nezapíše se nic; nejvýš 50 pramenů
    najednou; celé smazání je jedna operace historie;
  - `--dry-run` (co by smazání vzalo, s počty) smí spustit kdokoli, i agent;
  - bez `--dry-run` řekne ano člověk ve vlastním terminálu (Enter je ne), jinak v okně systému; když se nemá koho
    zeptat, příkaz skončí s kódem 4. Agent pramen nikdy nesmaže, ani s potvrzením aplikace; smí smazání jen
    navrhnout s počty z `--dry-run`;
  - `strom source restore` odmítne pramen, který odvolaný není (`source.notRetracted`), i pramen odvolaný jinak:
    sloučený, nebo vzatý zpět při synchronizaci (`source.notRestorable`);
  - `strom conflict keep` odmítne otevřený rozpor i rozpor bez značky (`conflict.notMarked`). Agent smí člověku
    značku jen oznámit, nikdy ji nesundá;
  - smazaný pramen ani to, co na něj odkazuje, se už nevrátí s pozdějším souborem z aplikace ani importem.
- **Hranice:**
  - zálohou je historie výzkumu a citace uložené v prameni; plná záloha výzkumu se před smazáním nedělá;
  - citace, kterou obnovit nejde (údaj zmizel, nebo pramen už cituje), se vypíše a zbytek se obnoví.
- Smazání v aplikaci: [A3.1.2](A3-evidence-in-the-app.md#A3.1.2), smazání při úpravách a synchronizace:
  [S2.6.1](S2-edits-from-the-app.md#S2.6.1), soubor rodokmenu spolu s pramenem:
  [R11.5.6](R11-material-from-the-user.md#R11.5.6).
- **Ovládání:** terminál: `strom source retract S… [--dry-run] [--reason "…"] [--sources-from <soubor>]`,
  `strom source restore S…`, `strom source list --retracted`, `strom conflict keep X…`; aplikace: **Smazat
  pramen…** přes most ([A3.1.2](A3-evidence-in-the-app.md#A3.1.2)).
- **Platí od:** výzkum 1.36.0

<!-- zdroj: research:e6bbfb40 src/core/sourceretract.ts (hlavička; DELETED, RETRACT_MOST 50, RETRACT_CONFIRM_MS 15 min, REVIEW_RETRACTED, ACTIVE open/doing/parked/waiting) · src/commands/sourceretract.ts source retract (description, agentMay --dry-run, source.agent, source.retract-changed, requireHumanYes), source restore (description, source.notRetracted, source.notRestorable), ui.source.restore.skipped · src/commands/analysis.ts conflict keep (conflict.notMarked, agent jen říká) · src/commands/sources.ts source list --retracted, source show RETRACTED … the person puts it back · src/core/sync.ts withholdDeleted (spec 117 J6) · assets/lang/cs.json ui.consent.retract, ui.source.retract.would · CHANGELOG.cs.md 1.36.0 · spec 117 K1.1–K1.7, J3 (záloha = historie + citace v prameni) -->
