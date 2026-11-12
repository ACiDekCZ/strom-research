# Co je nového ve Strom výzkumu

[English](CHANGELOG.md) · Čeština · [Deutsch](CHANGELOG.de.md) · [Polski](CHANGELOG.pl.md)

Změny každé verze ve zkratce. Úplné poznámky a instalační řádky jsou na
[GitHub Releases](https://github.com/ACiDekCZ/strom-research/releases) (anglicky).

## 1.31.1

*Připravuje se: bety do 1.31.1-beta.1. Oddíl bude úplný s vydáním.*

- **Nastavení pro prohlížeče archivů, které prohlížeč vykresluje pomalu.** Kde prohlížeč vykreslí kartu jen zhruba
  jednou za sekundu (kreslení bez grafické karty, vzdálená plocha), potřebuje prohlížeč snímků archivu (ACTA PUBLICA)
  na jeden snímek minuty a ukládání vzdalo po 30 s se zprávou, že dlaždice nedorazily všechny. Ta zpráva teď jmenuje,
  co pomůže: `strom config set browser.tileWait 180` (60–600 s) — skript pak čeká, dokud dlaždice ještě přicházejí,
  a agentovi odpovídá „strom-wait“, dokud není hotovo. Bez nastavení se nemění nic.

## 1.31.0

*12. 11. 2026 · patří k aplikaci Strom 3.27.0.*

- **`strom repair` už neodstraní práci, kterou poškozená historie skrývá.** Když se dá historie gitu výzkumu číst, ale
  je starší než jeho záznamy (cloudový disk vrátil starší `.git`, vedle něj kopie iCloudu jako `index 2`), `strom
  verify`, `strom check` i odmítnutý zápis hlásí `history-reverted` s počtem záznamů, které by oprava odstranila, a
  ukážou cestu, která nic neztratí: zálohu celé složky, `.git` ze zálohy nebo z Time Machine, nebo `strom seal accept`
  od uživatele. `strom repair`, který by odstranil víc než tři záznamy nebo jakýkoli takový záznam, řekne které a
  zeptá se uživatele v jeho terminálu; agent ho nikdy nespustí. Co oprava odložila stranou, vrátí `strom repair undo
  <razítko>` (uživatel ve svém terminálu, jedna zapečetěná operace), i po opravě z verze 1.30.

- **Jeden most na výzkum i po aktualizaci.** Most staršího stromu, který zůstal běžet vedle mostu výzkumu, skončí sám:
  když jeho nástupce najde výzkum v držení jiného mostu, při nejbližší kontrole, nebo když aktualizace smazala strom,
  ze kterého běží (dřív každých 16 sekund hlásil chybu). Předání mostu novějšímu stromu je i rychlejší: starý most
  odpovídá, zatímco se nový strom ověřuje.

- **Snímek ukládaný ze zobrazovače archivu počká, když prohlížeč jeho kartu nekreslí.** Prohlížeč nekreslí kartu za
  jinou kartou ani v zakrytém či minimalizovaném okně a zobrazovač snímků archivu pak nikdy neohlásil, že má všechny
  dlaždice: ukládání po 30 s vzdalo s „the viewer's tiles did not all come“ (ACTA PUBLICA). Čekání teď počítá jen čas,
  kdy prohlížeč kartu kreslí, a pokračuje, jakmile ji kreslí znovu; karta nekreslená 30 s se ohlásí jako taková. Když
  se zobrazovač mezitím přestránkuje, pod jménem jiného snímku se nic neuloží.

  **`strom fetch` ohlásí snímek, který stojí mnoho požadavků, stejně jako `strom connector test`.** Konektor postavený
  před verzí 1.30, který skládá každý snímek z dlaždic (sto požadavků na snímek, hodiny na knihu), stahoval bez varování.
  Teď první snímky stahování agentovi jednou řeknou, kolik stojí jeden snímek a jak dlouho tempem archivu potrvá kniha,
  i jak stahování na pozadí zastavit a co hledat nejdřív (jeden požadavek na snímek). Vychází z vlastního počítání
  stahování: archiv se kvůli tomu na nic dalšího neptá. Říká to i `strom fetch --status` a brief.

- **Připojení rodiny k vedlejší větvi je práce mimo linie.** Úkol, který by připojil lidi bez vazby na strom, pomáhal
  linii vždy, když je připojoval ke komukoli ze stromu – i k sourozenci předka, takže šel s linií, ačkoli práce mimo
  linie měla čekat na konci. Teď linii pomáhá jen připojení k člověku linie nebo k jeho partnerovi; připojení k
  vedlejší větvi patří do té větve a přijde na řadu podle její volby. Hypotéza linie a důvod uvedený agentem platí dál.
  `/status` mostu říká, jak úkol, na kterém se právě pracuje, linii pomáhá (funkce `working.helps`), aby aplikace
  mohla ukázat, proč jde s linií.

- **Výzkum v tabulce aplikace Strom.** Pro aplikaci Strom, která to umí ukázat, říká soubor pro aplikaci u každé
  osoby její místo mezi liniemi výzkumu podle stejného pravidla, jakým se řídí fronta: v linii (ve všech, do kterých
  patří), partner osoby z linie, vedlejší větev mimo linie (s linií, ke které byla přidána), nebo ostrov, který se
  stromem nic nespojuje; hlavička jmenuje linie a větve. U každé osoby jsou i úkoly, které čekají zvenku (dopis
  odeslaný nebo k odeslání, dotaz na rodinu, stránka k prohlédnutí), s tím, kde se který vyřizuje, a kdy osobu výzkum
  přidal. `GET /directions/people` mostu říká stejná místa živě, s otiskem, který opakuje `/status` (funkce
  `directions.places`).

- **Hypotéza rozhodnutá v aplikaci Strom.** U hypotézy, jejíž varianty říkají, čí je kdo dítě nebo který je to pár, se
  varianta vybere v aplikaci (nebo „žádná neplatí“, „nechat otevřenou“, „vrátit rozhodnutí“). Terminál výzkumu ukáže
  otázku s variantami a co zapíše, jednou se zeptá – Enter je ano – a proč (Enter ponechá slova aplikace) a zapíše to
  jako rozhodnutí uživatele v aplikaci Strom. Stejně se přijme i víc návrhů agenta najednou. Vybrat v aplikaci jde i hypotézu, jejíž varianty nikoho nespojují: zapíše se jen rozhodnutí, strom zůstane, jak je, a terminál to řekne před potvrzením. Zda jde o stejnou osobu
  nebo o sourozence, se dál rozhoduje v terminálu, na celé obrazovce hypotézy. Rozhodnutí je ve stromu hned: dítě nebo
  pár zvolené varianty se zapíše v témže uložení, s citací zdroje varianty, i v archivu – agent ho už znovu
  nezapisuje; co strom odmítne (dítě už má rodiče narozením), terminál řekne i proč a zapíše to agent. Při změně se
  odebere, co zapsalo předchozí rozhodnutí; při vrácení se odebere, co rozhodnutí zapsalo, pokud na tom mezitím nestojí
  další práce – další dítě, údaj nebo zdroj rodiny, sloučení, nikdy vlastní údaje osob (aplikace to ví předem); změnu,
  po které by stará vazba zůstala a nová se zapsat nedala, terminál řekne před potvrzením a Enter pak ruší, i u víc návrhů najednou; v terminálu to umí i `strom hypothesis decide --reopen` (jen uživatel). Pro aplikaci
  soubor Stromu říká, kdo a kde rozhodl, předchozí rozhodnutí, návrh agenta, co mluví proti každé variantě a kolik
  osob připojí ke stromu; `/status` mostu vypisuje čekající hypotézy (features `hypothesis.decide.link`,
  `hypotheses.accept.link`).

- **Zápis se najde znovu, i když archiv změní odkazy.** Kde zápis v knize stojí, se ukládá po polích: `strom source
  add|edit --folio` (strana nebo folio, jak je kniha čísluje, „fol. 12v“), `--image` (číslo snímku na portálu archivu)
  a `--call-number` (signatura knihy u zápisu mimo evidované knihy), vedle `--locator` pro zbytek (číslo zápisu).
  `strom source show` uvádí archiv, signaturu, folio a snímek pohromadě (snímek i z evidovaných skenů) a navrhne folio
  a snímek, které jmenuje starší umístění – sám je nikdy nezapíše; stávající prameny zůstávají, jak jsou. Soubor pro
  aplikaci Strom i jiné programy má jednu čitelnou PAGE složenou z polí („pag. 112, č. 3, snímek 57“) a signaturu jako
  CALN; samotná pole dostane aplikace Strom od verze, která je čte (feature mostu `sources.fields`), a jejich úpravy
  se vracejí synchronizací jako úpravy strany. Agent pole vyplňuje při zápisu a odkaz, který se už neotevře, podle
  nich dohledá. PAGE nikdy neřekne dvě čísla snímku ani folia: jmenuje-li starší umístění jiné číslo než pole, platí v
  ní pole (umístění samo zůstane), a `strom source edit` i `show` navrhnou zbytek umístění. Starší prameny se do polí
  rozdělí najednou příkazem `strom source split`: náhled, čím by se každý stal (umístění, v němž se nic nerozpozná,
  zůstane, jak je, až tři taková ukáže, jak stojí), rozdělení zapíše uživatel s `--apply` jedním krokem a jedním se i vrátí (`--undo`); agent ho jen
  nabídne. Rozdělit se dá i z aplikace Strom, která to nabízí (funkce mostu `sources.split`): náhled řekne, kolik
  pramenů, rozdělení se zapíše na kliknutí uživatele jedním krokem podle toho náhledu a vrátí se celé. Folio, snímek
  nebo signaturu, které uživatel smaže v aplikaci Strom, jež tato pole uchovává, smaže i výzkum (vrátí se se
  synchronizací); starší aplikace nesmaže nic. Když umístění neříká nic než folio a snímek, které už dávají pole,
  navrhne `strom source show` ho vyprázdnit a `strom source edit --locator ""` to udělá.

- **Drobnosti.** Údaj, jehož ověření uživatel posunul dopředu, je v souboru pro aplikaci Strom označený jako vyžádaný,
  takže aplikace už znovu nenabízí „Ověřit přednostně“. `strom error --note` skryje i skloňované tvary jmen a míst, která
  výzkum zná („z Brna“, „v Praze“). `strom task wait --request` najde soubor i tehdy, když je jeho jméno zadané v jiné
  normalizační formě Unicode (cesta napsaná na Macu, použitá na Windows). Co je na řadě – v menu před `strom run`
  i ve frontě aplikace Strom – je pořadí, v jakém úkoly bere `strom run`: když přijde řada na vyprávění, je první
  jedno vyprávění, ne všechna.

## 1.30.1

*9. 11. 2026 · patří k aplikaci Strom 3.26.0.*

- **Výzkum s historií poškozenou cloudovým diskem jde přijmout tak, jak je.** Když chybí nejstarší logy výzkumu a jeho
  historie (git) nejde přečíst (třeba u výzkumu, který byl v iCloud Drive), `strom verify` to řekne a u každého
  záznamu, který už nenajde zapečetěný, ukáže jedinou cestu: uživatel záznamy projde a ve vlastním terminálu spustí
  `strom seal accept`. Bez potvrzení jen spočítá, co by udělal; po potvrzení zapečetí záznamy tak, jak jsou, jednou
  operací, poškozenou historii odsune stranou (`.git-damaged-<kdy>`, nikdy nesmaže), založí novou a kopie iCloudu
  (`… 2.lock`) dá stranou. Žádný záznam se nezmění, nic se nesmaže; agent ho nikdy nespustí a jiné nálezy kontroly
  nepřijme. Dřív se na poškozené historii zastavil každý zápis i `strom check` a `strom repair` uměl jen vrátit
  starší stav.

## 1.30.0

*9. 11. 2026 · patří k aplikaci Strom 3.26.0.*

- **Údaje ověřené proti originálu.** Narození, křest, sňatek, úmrtí nebo pohřeb, který cituje původní záznam, ale
  zůstává pravděpodobný nebo možný, agent ověří proti tomu originálu: podívá se na sken a údaj buď povýší na doložený,
  nebo zapíše, proč zůstává, jak je. Starší výzkum se po aktualizaci jednou projde (jen osoby napojené na rodokmen,
  nikdo žijící; `strom fixes undo verify-originals` to vrátí), nové údaje průběžně. Ručně pro osobu, rodinu nebo jeden
  údaj, první ve frontě (`strom verify facts <koho>` nebo z aplikace Strom); hromadně pro linii, rod nebo celý strom
  s odhadem ceny – spustit to může jen uživatel (`strom verify bulk`); zastavit jde přes `strom verify stop`. Údaj, který
  uživatel v aplikaci Strom potvrdí podle skenu, agent nikdy nezmění – jen navrhne. Hodnota, kterou zadal uživatel nebo
  která přišla z rodokmenu, se nikdy nepřepíše: co se liší, je návrh k rozhodnutí uživatele. Kolik údajů čeká, řekne
  `strom check`, `strom doctor`, `strom stats` a `strom verify status`.
  Potvrzení v aplikaci Strom platí pro hodnotu, kterou uživatel viděl: údaj od té doby změněný se nepotvrdí.

- **Údaje z převzatého rodokmenu jsou chráněné.** Rodokmen z jiného programu (GEDCOM) dává vodítka: agent takový údaj
  změní jen podle záznamu, který cituje, a hodnota z rodokmenu zůstává uložená vedle („původně z rodokmenu: …“) a jde
  vrátit (`strom event revert`, `strom person revert`). Bez citovaného záznamu – a vždy, když o hypotézách rozhoduje
  uživatel – agent jen navrhuje, jako rozpor k rozhodnutí uživatele. Co uživatel zadal nebo změnil, v aplikaci Strom nebo
  ve stromu, agent nikdy nezmění: jen navrhne – ani souborem, který načte přes `strom sync`. Návrhy agenta jsou v `strom
  conflict list` a `show` poznat a uzavřou se samy, jakmile navržená hodnota platí. Výzkum založený dřív se po
  aktualizaci jednou označí (které údaje přišly z převzatého rodokmenu, které jsou uživatele): žádná hodnota se nemění a
  `strom fixes undo origins` značky vezme zpět; kolik hodnot a v kolika záznamech se označilo, řekne `strom fixes show origins`. Návrh, jehož hodnota se od jeho vzniku změnila (upravil ji uživatel), je
  zastaralý: přijmout ho nelze – přes novější hodnotu se nic nezapíše –, jen uzavřít s ponechanou hodnotou. Co návrh
  neunese (příčina změněná spolu s datem), řekne výsledek synchronizace, nikdy se neztratí.
  Hodnota, která přišla s rodokmenem z aplikace Strom a nikdo ji od té doby nezměnil, je chráněná jako hodnota uživatele.

- **Znovu převzatý rodokmen najde své lidi.** ID, která program dal lidem a rodinám (`_UID`, `EXID`, `_FSFTID`…
  z MyHeritage, Gramps, FamilySearch a dalších), se uchovají: rodokmen téhož programu převzatý znovu (nebo z jiného
  programu do výzkumu) podle nich najde lidi – nikdy dvakrát, nové údaje přibudou jako vodítka; novější soubor
  rodokmenu téhož programu, kde se změnilo jméno, pohlaví nebo datum narození, najde tutéž osobu a co se liší, přidá jako
  vodítko vedle údaje výzkumu a oznámí; osoba jen možná táž (soubor jiného programu, jiné ID FamilySearch) se oznámí,
  nikdy nespojí a nezapojí do rodiny, kde už je ta, kterou možná je, a `strom check` vypíše dvě osoby se stejným ID
  z rodokmenu k porovnání a sloučení. ID se s výzkumem vracejí do aplikace Strom. Co soubor má a
  nepřevezme se (média, vlastní značky programu), se ve výsledku spočítá. Ve výzkumu založeném dřív se ID dřívějších importů čtou z jejich souborů, takže ani znovu
  převzatý rodokmen ještě před označením nepřidá nikoho dvakrát.

- **Problém nahlášený v jednom souboru.** `strom error` zabalí, co je potřeba k poznání, co se stalo, do jednoho ZIPu
  ve složce Stažené soubory (jinak v aktuální složce): verzi, systém, `strom doctor`, agenty, konektory, most do aplikace
  Strom, výzkum jen v číslech, technické logy posledních 7 dní (`--since`) a příkazy, které skončily chybou. Nic
  z rodokmenu do něj nejde – jména, místa, poznámky, přepisy, snímky, cesty se jménem uživatele, přihlášení a tokeny jsou
  vynechané nebo nahrazené stálými kódy – a nic se neodesílá: soubor posílá uživatel sám, na adresu, kterou příkaz
  vypíše. `--about fetch|sync|agent|install|windows` přidá podrobnosti jedné oblasti (tabulka je v `strom error
  --help`), `--where` říká, kde se problém stal, `--note` ho popíše slovy uživatele (jde tak, jak je napsaná – nahradí se jen jména, která výzkum zná); údaje jmenovaných osob, rodin nebo
  knihy jen s `--with-data` a souhlasem uživatele. Agent požádaný o nahlášení problému se zeptá, kde se stal, příkaz
  spustí a řekne cestu – soubor nikdy neposílá, neotvírá ani nepřepisuje do chatu. V nabídce: Údržba → Nahlásit problém.
  Výzkum se jen čte, i rozbitý.

- **Soubor pro aplikaci Strom se zase zapíše i u výzkumu s hypotézou rozhodnutou s odůvodněním:** pro aplikaci od
  3.25.0 (nebo neznámé verze) ho `strom export gedcom` odmítl a `output/tree-strom.ged` po session zůstal starý (výzkum
  otevřený v aplikaci přes `strom app` se to netýkalo). **Sledování velkého výzkumu živě v aplikaci Strom se otevírá
  mnohem rychleji:** strom pro aplikaci se sestaví jednou pro každý stav výzkumu a zůstane uložený i po novém spuštění
  mostu, a během sledování se změna ohlásí, až je její strom připravený. Most už neskončí, když je disk výzkumu na
  chvíli nedostupný, a druhý most téhož výzkumu spuštěný navíc hned skončí a neběží dál bez povšimnutí.
  Aktualizace ve chvíli, kdy strom most spouští, už nenechá běžet dva mosty: zůstane jeden, na adrese, kterou aplikace sleduje.
  Aplikaci, která nejnovější strom už má, se znovu nic neposílá.
  Aplikace, která o to požádá, dostane strom s obrázky označenými podle obsahu a načte jen ty, které ještě nemá.

- **Údaj zobrazený nebo upravený v terminálu** (`strom event show`, `strom event edit`) se vypisuje v jazyce
  výzkumu. V aplikaci Strom už rodokmen převzatý do výzkumu nemá jako odkaz celého rodokmenu první řádek z něj:
  každý údaj uvádí svůj.
  **Rodokmeny z programů pro Windows v kódové stránce 1250 nebo 1252 („ANSI“)** se čtou se správnými písmeny – česky,
  polsky, německy, stejně jako v aplikaci Strom. Znak, který nejde přečíst, se ohlásí, nikdy se tiše nenahradí.

- **Codex v aplikaci ChatGPT, jak skutečně je.** Nastavení v ní už nemluví o hookách Codexu (ta věta patří Codexu
  v terminálu) a `strom doctor` radí potvrdit je jen v terminálu. Prohlížeč aplikace ChatGPT běží přes cloud ChatGPT
  a žádné pravidlo stromu nevolá: strom už netvrdí, že ho hlídá, a agent v ní chodí k archivu s omezením jen přes
  člověka (`strom task wait --images`). `strom doctor` a nastavení to říkají jako varování, s radou k dialogu ChatGPT
  „cloudový prohlížeč“ u takového archivu: *Zamítnout*, přístup ke všem relevantním webům nikdy. Codex v terminálu
  zůstává hlídaný – nově i jeho prohlížeč otevřený přes `createBrowserTab`.

- **Stahování snímků knihy, které konektor přeruší chybou,** řekne, které snímky nestáhl, a příkaz, který je stáhne
  (jen je – co přišlo, se znovu nežádá), skončí chybou (dosud hlásilo úspěch) a co zbývá, řekne i `strom fetch --status`
  a brief; stahování, které archiv cestou odmítne, končí jako dřív, s jeho vlastní radou. **Přepis potvrzený v aplikaci
  Strom krátce po půlnoci** nese nový den podle kalendáře tohoto počítače (dosud den předchozí).
  **Stavba konektoru:** `strom connector test` varuje, když jeden snímek stojí mnoho požadavků (dlaždice), a řekne, co
  hledat nejdřív – odkaz portálu na celý snímek nebo stažení celé knihy – s dobou, jakou by kniha trvala v tempu archivu;
  `strom connector new` cituje, co strom ví o podmínkách archivu.
  **macOS: aplikace Strom otevřená z výzkumu** (sledovat živě, soubor pro aplikaci) už nenechá v Docku mezi nedávnými
  aplikacemi ikonu Google Chrome: adresa jde rovnou do už běžícího prohlížeče, okno aplikace se otevře jako dřív.
  **Snímek, který měl uložit prohlížeč agenta a prohlížeč ho zadržel** (Chrome uloží jeden soubor webu sám, další až
  po povolení stahování více souborů), se ohlásí: Co čeká uvede web, kterému to jednou povolit v adresním řádku prohlížeče.

## 1.29.0

*8. 11. 2026 · patří k aplikaci Strom 3.25.0.*

- **Kdo rozhoduje hypotézy: uživatel, nebo AI.** Nová volba výzkumu (`strom config set hypotheses.decide`, otázka
  v úvodním nastavení spolu s ostatními volbami, Nastavení v menu stromu, nastavení výzkumu v aplikaci Strom):
  *rozhoduje AI* nebo *rozhoduje člověk*. Když rozhoduje AI, agent hypotézu rozhodne sám, jakmile
  citovaný záznam podpoří jednu verzi, vždy s verzí a důvodem; rozhodnutí uživatele nikdy nemění a větev deseti a více
  lidí mimo strom připojí jen na dva prameny bez námitky – jinak navrhne. Každé jeho rozhodnutí je označené jako
  rozhodnutí agenta, objeví se v přehledu změn a dá se kdykoli změnit; přepnutí volby nemění nic už rozhodnutého.
  Kde nic zvoleno není, rozhoduje AI – i v dříve založeném výzkumu; zpět na rozhodování člověka:
  `strom config set hypotheses.decide person`. Úvodní nastavení stromu doporučí rozhodování AI a nabídne ho jako první,
  zvolené *rozhoduje člověk* se uloží; kde rozhoduje člověk, zapne rozhodování AI znovu jen člověk, po druhém ano.

- **Každou hypotézu jde rozhodnout z menu.** Když rozhoduje uživatel, Co čeká nabízí i otevřené hypotézy bez návrhu
  agenta – rozhodnout s verzí a důvodem, nebo nechat otevřenou; když rozhoduje AI (výchozí), nabízí jen návrhy agenta.
  Z revize osoby a z odkazu aplikace Strom jde rozhodnout každou hypotézu, ať rozhoduje kdokoli, a rozhodnutou či
  odloženou hypotézu jde rozhodnout znovu s důvodem, staré rozhodnutí zůstane čitelné. Když rozhoduje uživatel, agent
  navrhne rozhodnutí všude, kde záznamy ukazují na jednu verzi.

- **Výzkum v aplikaci Strom zůstává zapnutý.** Propojení s aplikací Strom (most) se už samo nevypíná po dvou
  hodinách, kdy se ho nikdo neptá: běží, dokud se nevypne nebo dokud se nevypne počítač (`live.idleMinutes` je nově
  0; dříve nastavená hodnota zůstává). Aplikace Strom dostane přepínač u každého výzkumu a volbu v nastavení – do
  vypnutí počítače, nebo po dvou hodinách nečinnosti –, obojí se zapisuje přes most. Vypnutý v aplikaci zůstane most
  vypnutý (nová práce ve výzkumu ho nevrátí) a ponechá si adresu, takže opětovné zapnutí – z aplikace odkazem stromu,
  nebo příkazem `strom live start` – nepotřebuje nové propojení.

- **Aplikace agentů hlídané stejně jako agent v terminálu.** Vestavěný prohlížeč aplikace agenta dodržuje podmínky archivů stejně
  jako prohlížeč agenta v Chromu: archiv, který pouští jen prohlížeč člověka, je bez svolení člověka odmítnut se stejnou
  radou, povolený se zapíše a drží své tempo; místní stránky nic neomezuje. Příkazy stromu v terminálu aplikace platí
  stejně jako v příkazové řádce (co dělá jen člověk, most aplikace Strom); agent dostane pokyn spouštět strom přes svou
  příkazovou řádku. Z aplikace se nic nevypíná. Terminál aplikace pozná strom pod jakýmkoli jménem – jiného kanálu,
  druhé instalace, balíček spuštěný přes spouštěč balíčků, cestu k němu. Prohlížeč Codexu (v aplikaci ChatGPT) drží stejná
  pravidla podle adres v jeho kódu, jakmile jsou hooky stromu v Codexu potvrzené – `strom doctor` a `strom chat` řeknou,
  když čekají; kód bez adresy se nikdy neodmítne, jen zapíše. S potvrzenými hooky pustí archiv, který pouští jen
  prohlížeč člověka, se svolením „přes prohlížeč“ i prohlížeč Codexu, stejně jako prohlížeč agenta v Chrome (`strom net web
  --check --browser`, `strom doctor`, podklady agenta, aplikace Strom); bez potvrzení beze změny. Computer use zůstává
  nehlídané. Co strom u kterého agenta
  a aplikace hlídá: `strom doc R12`; agent s computer use dostane pokyn ovládat aplikaci Strom přes nástroje stránky
  v prohlížeči a výzkum přes strom.

- **Aplikace agenta bez agenta v terminálu.** Strom teď říká, co jde a co ne: rozhovor v aplikaci pokračuje, samostatná práce,
  čtení skenů a práce z aplikace Strom potřebují agenta v terminálu – řečeno dřív, než padne jakákoli otázka nebo
  odhad ceny. Nastavení a `strom doctor --fix` nabídnou jeho instalaci (lze odmítnout); `strom doctor` rozliší
  prohlížeč v rozhovoru a v samostatném běhu. Rozhovor bez něj čte skeny vlastním čtenářem skenů stromu.

- **Zdroj je přečtený uživatelem, jen když ho uživatel přečetl, a údaj doložený jen z originálu záznamu.** Čtenářem je
  uživatel u přepisu napsaného ručně v terminálu nebo potvrzeného v aplikaci Strom; co pod jeho účtem zapsaly importy,
  převody a dávky, už ne. Údaj je doložený jen s citovaným originálem záznamu s primární informací; bez něj se převede
  na pravděpodobný a důvod zůstane v jeho historii, ten, který doložil uživatel, zůstane a čeká v Co čeká na ponechání,
  nebo převedení na pravděpodobný (`strom fixes review proven-originals keep|lower`). Existující výzkumy se samy jednou
  opraví, změny jsou v přehledu změn (`strom fixes undo readers|proven-originals` je vrátí). GEDCOM z jiného programu
  nikdy neudělá uživatele čtenářem ani údaj doloženým. Potvrzení v aplikaci platí pro znění, ke kterému bylo dané, a dá
  se tam vzít zpět; s originálem záznamu s primární informací pak údaj smí být doložený, jinak nejvýš pravděpodobný.
  **Přepis, který uživatel přečetl nebo potvrdil, je uživatelův.** Mění ho jen uživatelův vlastní terminál nebo
  aplikace Strom – ať jde o jakýkoli příkaz (úprava, dávka, synchronizace, oprava, vrácení, import). Jiné znění od
  agenta se místo toho navrhne: poznámka u zdroje a jeden úkol pro uživatele na zdroj, který žádný agent nevezme ani
  neuzavře; rozhoduje se v Co čeká, odkazem z aplikace Strom nebo v aplikaci – navržené znění přijaté jako
  uživatelovo, nebo přepis ponechaný a totéž znění se už znovu nenavrhne; obojí jde vrátit (předchozí přepis i s potvrzením zpět,
  návrh čeká znovu).

- **Každý čtenář dokumentu s vlastním agentem, modelem a hloubkou uvažování a zdroj přečtený znovu z originálu.** `strom
  document read|again --agent/--model/--effort` (a `--blind-…` pro slepého čtenáře) nebo volba v aplikaci Strom; bez
  volby čte podle nastavení výzkumu, nikdy levnějším modelem. Výsledek říká, kdo četl – v terminálu, v souboru čtení i v
  aplikaci Strom. Zdroj se přečte znovu z originálu na tomto počítači (`strom document read --source S… [--clip …]` nebo
  z aplikace Strom), čtenáři přepis nevidí; nové čtení zůstane vedle zdroje, a kde se liší, postaví úkol obě znění vedle
  sebe – přepis, kdo ho četl, i potvrzení uživatele zůstanou, jak byly. Výřezy jednoho snímku, které se překrývají nebo
  dotýkají, se čtou jako jeden pohled a slova přepisu mimo přečtený výřez (záhlaví strany nad ním) se za rozdíl
  nepočítají. `strom fixes` bere čtení dvou čtenářů jako čtení prvního z nich: slepý čtenář s jiným modelem není nikdy
  dřívější model, se kterým číst znovu, a čtení, jehož některý čtenář četl dnešním modelem, se počítá jako přečtené jím.
  Přečíst znovu z originálu čte co nejlépe. Čtenáři dostanou, co výzkum o záznamu ví – druh, jazyk, datum a kde stojí,
  nikdy přepis ani jména –, a čtenář s modelem GPT navíc pokyn přepsat zápis uprostřed výřezu, sousední zápisy z okraje
  vynechat a zachovat původní pravopis písmeno po písmenu. S přepisem se porovná jen zápis zdroje (ten, který čtenář
  označí, jinak ten, který ve výřezu leží nejvíc); popisky sloupců bez protějšku („Dies:“, „Vater:“), záhlaví záznamu,
  které si píše výzkum, poznámky výzkumu i čtenáře v závorkách, dlouhé ſ proti s, nečitelné místo proti ničemu a slova
  mimo to, co přečetli oba, se za rozdíl nepočítají. Aplikace Strom dostane ve výsledku čtení, který zápis je zdroje,
  celý text slepého čtenáře, upozornění, když čtenáři určili jiný druh zápisu (sňatek × křest), a když porovnání nejde
  zapsat do výzkumu – třeba u výzkumu zapečetěného na jiném počítači –, řekne se to místo tichého vynechání. Čtenáři s
  modelem GPT (Codex, OpenCode) vidí malý výřez zvětšený až na zhruba 2000 px (nejvýš třikrát), i když je čtení snímků
  vyladěné na menší velikost (ladění měří celé strany a poloviny, nikdy malý výřez), ostatní jako dosud; zaregistrovaná
  ostřejší část snímku, která ukazuje celé místo – nebo celý výřez a mimo ní zůstane jen jeho okraj –, se použije, a u místa malého na skenu se nabídne ostřejší výřez z
  archivu – sám se nikdy nestáhne. Čtenář Codex běží bez upozorňovacího programu, pluginů, aplikací, hooků a pamětí z
  nastavení Codexu a bez prohlížeče a ovládání počítače jeho aplikace; nastavení Codexu se nemění.
  Model, který nainstalovaná verze Codex CLI nemá, ukončí čtení jako selhání čtenáře s tímto důvodem a s ním se zastaví i
  běh stromu: aktualizovat Codex (`npm install -g @openai/codex@latest`), nebo zvolit jiný model; modely z katalogu, který
  stáhl novější Codex než nainstalovaný, se nabízejí s poznámkou.
  Čtení vyžádané z aplikace Strom se přijme hned, i když jeho zařazení trvá déle (výzkum drží jiný proces): od první
  chvíle je vidět jako zařazené pod svým ID a pod ním se i přečte, a čtení, které pak zařadit nejde, je vidět jako
  selhané, i s důvodem; tentýž zdroj vyžádaný mezitím znovu se odmítne jako právě čtený.
  Volba modelu výzkumu (průvodce nastavením, Nastavení v nabídce stromu)
  u Opusu, Sonnetu i vlastního výchozího modelu agenta jmenuje model, na kterém naposledy běžel, když ho některý
  výzkum na tomto počítači viděl běžet – „Opus (teď Opus 5.5)“; `strom doctor` a nastavení to řeknou u uloženého
  modelu a aplikace Strom to dostane s nabídkou čtenářů. Neznámý se říká jako dřív. Uložený zůstává Opus nebo Sonnet,
  takže novější model své řady se použije sám; pevná verze zadaná ručně (`strom config set model.lead <model>`)
  se nabídne jako zvolená teď a zůstane pevná.
  Čtení, jehož slepý čtenář nepřečetl nic (selhal, nebo skončil bez zápisu), je čtením jen prvního čtenáře, jako čtení
  jedním čtenářem – nikdy se o všech zápisech neřekne, že se liší. Aplikace Strom dostane u každého místa, kde se dvě
  čtení liší, o jaký rozdíl jde – věcný (jméno, číslo, datum, osoba, místo, které nejde přečíst), nebo drobnost
  (pravopis, zkratka, interpunkce, popisek, velikost písmen) –, a kde je každý čtenář: čeká, čte, dočetl za tolik
  sekund, nebo selhal, i to, kterému čtenáři byl odmítnut model.
  **Zdroj přečtený znovu: co dál, volí uživatel.** Úkol vznikne jen z věcného údaje, který oba čtenáři přečtou proti
  přepisu stejně (jméno, číslo, datum, osoba, slovo, které přepis nepřečetl) – nikdy z drobností (pravopis, zkratka,
  interpunkce), z místa, na kterém se čtenáři neshodnou nebo které označí jako nečitelné, ani z místa, které už
  posoudil dřívější úkol. Úkol říká, kdo četl (agent · model · hloubka), že dva čtenáři stejného modelu jsou slabší
  doklad, a že čtení je jen vodítko: přepis se mění jen tam, kde to ukazuje sám snímek. Nová volba `read.sourceTask`
  říká, co dál: *ptát se* (výchozí) – čtení zůstane u zdroje jako neověřené, dokud uživatel nezvolí: projít ho
  s agentem hned, dát ho do fronty, nebo ho jen uložit (v terminálu hned po čtení, později `strom source reading S…`,
  nebo v aplikaci Strom); *vždy* – úkol hned; *nikdy* – bez úkolu. Jeden zdroj má najednou jeden úkol svých čtení.
  Čtení bez věcného údaje k rozhodnutí, jen s místy, kterými si čtenáři nejsou jistí, úkol samo nezaloží – ani při
  *vždy*; jen na slovo uživatele (`strom source reading S… --take queue --unsure` nebo v aplikaci Strom) dostane agent
  úkol projít každé takové místo na snímku: kde to snímek ukazuje jistě, přepis opraví i s důvodem, jinde napíše
  poznámku k prameni. Přepis potvrzený uživatelem agent nikdy nemění: místa, která nové čtení přečetlo, se místo toho
  navrhnou uživateli k posouzení (`--take review --unsure`).

- **Dále:** nápověda uvádí hodnoty každého nastavení s volbami a vysvětluje obě volby toho, kdo rozhoduje hypotézy;
  `strom help --human` uvádí všechny příkazy, které spouští jen člověk. Povolení archivu dané ve výzkumu mimo složku
  výzkumů upraví i pokyny agenta tohoto výzkumu a zadaný web (example.org) pokryje i adresy, které používají knihy
  výzkumu. Podmínky Hlavního archivu starých aktů ve Varšavě podle odpovědi archivu: snímky volně k užití, každý
  citovaný místem originálu – archiv, fond, signatura, strana nebo list. Rozpor zapsaný v dávce se štítkem pramene
  (`--claim "@s: …"`) teď cituje ten pramen; rozpor, který tak zapsala starší verze, ukazuje hodnotu bez syrového
  štítku a tam, kde to jde poznat, cituje svůj pramen v aplikaci Strom i v GEDCOMu. Skončený rozhovor už v aplikaci
  Strom nezůstává „při práci“, ani na vytíženém počítači, ani po změně jména počítače. Místo zapsané ve větě („v Lhotě
  v čp. 12“) si už neponechává předložky: kontrola nabídne obec tak, jak ji výzkum píše jinde, a záznam místa už
  nedostane jméno jako „v Lhotě v“ – taková jména zapsaná dřív se jednou opraví (vrátit: strom place undo).
  **Překrývající se výřezy jednoho obrázku jsou jeden.** Dva výřezy téhož obrázku, které označil výzkum a které se
  překrývají aspoň o 30 % menšího z nich, se spojí v jeden, který pokryje oba (výřez skoro celý uvnitř většího – detail,
  zápis vedle celé strany – zůstane); výřezy označené uživatelem zůstávají.
  Ve výzkumu z dřívějška se překrývající výřezy spojí jednou, každé spojení zapsané v historii; přepis i potvrzení
  uživatele zůstávají.
  **Úkol ve frontě z aplikace Strom.** Odkaz z aplikace na úkol ve frontě ho ukáže (co, proč, kdy hotovo) a nabídne
  projít ho s agentem hned (s tím, kolik podobné úkoly tady trvaly), dát ho ve frontě dopředu, nebo ho nechat.
  `strom doctor` říká, proč se dražší změna ladění ve prospěch přesnosti ponechává, a soubor hooků Codexu, který jen
  chybí nebo je zastaralý, už není varování – zapíše se znovu, až strom příště spustí agenta.

## 1.28.0

*6. 11. 2026 · patří k aplikaci Strom 3.24.0.*

- **Jak Strom funguje je přímo ve stromu: `strom doc`.** Dokumentace aplikace a výzkumu v češtině, angličtině, němčině
  a polštině je součástí stromu a čte se i bez internetu: `strom doc` vypíše kapitoly, `strom doc R10.1` jedno pravidlo
  i s tím, proč tak je, `strom doc <slova>` hledá v nadpisech, rejstříku pojmů a textu (bez ohledu na diakritiku a
  velikost písmen). U každého pravidla je odkaz na stejnou stránku na stromapp.info. Na otázku, jak nebo proč Strom
  něco dělá, odpovídá agent podle ní s číslem pravidla. Nápověda pro člověka (`strom help --human`) na ni odkazuje.

- **Hypotézu rozhoduje jen uživatel.** Agent už mezi soupeřícími vysvětleními nerozhoduje sám: navrhne verzi s důvody
  a hypotéza čeká v menu stromu v Co čeká – rozhodne se podle návrhu, jinak, nebo zůstane otevřená. Co rozhodnutí
  spojí, zapíše agent do stromu v další session. Dříve rozhodnuté hypotézy zůstávají, jak byly. Hypotéza, jejíž verze
  říkají, co by spojily, se rozhoduje jen s uvedenou verzí.

- **Rejstřík je vodítko, nikdy doklad.** Údaj, který cituje jen rejstřík, zůstane vodítkem, dokud se nepřečte a
  necituje samotný zápis – stejně jako u rodokmenu nebo vzpomínky.

- **Překlad vedle přepisu.** Záznam v jiném jazyce nebo písmu, než je jazyk výzkumu – latina, kurent, polština,
  azbuka –, dostane vedle doslovného přepisu i překlad do jazyka výzkumu.

- **Kde agent pracuje, pro mapu aplikace Strom.** Během práce agenta strom aplikaci říká, ke kterému místu patří kniha,
  kterou agent zkoumá – farnost nebo obec jejích zápisů, nikdy archiv –, aby ho aplikace při sledování práce mohla
  ukázat na mapě. Když to výzkum neví, nic neříká a aplikace zůstane u míst osoby. Práce na rodině uvede pár – manžela,
  jinak manželku – i rodinu samotnou, aby se aplikace mohla zaměřit na pár.

- **DigiArchiv SOA v Třeboni:** podmínky, jak je archiv potvrdil – ručně jen vybrané snímky, nikdy celá kniha, žádné
  nástroje ke stahování – a jak citovat trvalý odkaz na snímek.

- **Seznam před během ukazuje, co běh vezme.** V položce Nechat agenta pracovat samotného jsou mezi úkoly v pořadí, v jakém je agent
  vezme, i úkoly dějin míst, když na ně přijde řada – místa údajů k zařazení jdou napřed –, označené jako dějiny.

- **Podmínka běhu na jednom řádku.** Co podmínka (`run.gate`) odpověděla, jak se ptá – před každým sezením, nebo při
  ručním spuštění jednou – a její strop se před prvním sezením řeknou na jednom řádku, ne na třech. Agent, který čte
  webové stránky přes vlastního pomocníka, se už nehlásí jako bez nástroje na čtení webu; nástroj, který opravdu
  chybí, se řekne v jazyce výzkumu.

## 1.27.0

*5. 11. 2026 · patří k aplikaci Strom 3.23.0.*

- **Snímky uložené ručně vrátí svůj úkol samy.** Kde se snímky archivu ukládají ručně – archiv, kam smí jen prohlížeč
  člověka, nebo archiv, jehož podmínky nic jiného nedovolují – výzkum požádá o knihu a čísla snímků a připraví pro ně
  složku ve schránce (inbox). Co se tam uloží, se převezme samo: hned, když běží most do aplikace Strom, jinak při
  startu dalšího sezení; jinak pojmenované soubory podle pořadí, když jich je tolik, kolik snímků chybí. Úkol se vrátí
  do fronty, až jsou tam všechny snímky; u části z nich Co čeká ukazuje, kolik je uloženo z kolika a které chybí. Kniha
  takového archivu už neplatí za volně stažitelnou a výzkum k ní nenabízí stavbu stahovače – i knihy a čekání ze
  starších verzí, bez přepisu čehokoli.

- **Na to, co čeká, jde odpovědět z aplikace Strom a snímky, na které úkol čeká, z ní poslat.** Odpověď napsaná v
  aplikaci vrátí úkol do fronty stejně jako odpověď v terminálu; uloží se celá a s poznámkou, že přišla z aplikace.
  Úkol, který mezitím čeká na něco jiného, zůstane beze změny. Snímky, na které úkol čeká, jdou z aplikace rovnou k
  němu: očíslované podle snímku, který aplikace uvede, jinak podle jména souboru, jinak podle pořadí chybějících; PDF
  stránku po stránce. Snímek s číslem, které výzkum už má, se odmítne, pokud ho nemá nahradit – ten předchozí se stáhne
  a zůstane uložený, nikdy se nesmaže. Snímek shodný s jiným, už převzatým snímkem se odmítne s tím, kterému je shodný,
  a nic se nepřevezme. Převezmou se stejně jako snímky uložené ručně a úkol se vrátí, až jsou tam všechny. Web s jednou
  knihou úkolu ukazuje také svou složku a kolik snímků v ní je. Weby jednoho archivu – třeba digitální archiv a
  badatelna jednoho zemského archivu – čekají na jednom místě pod jménem archivu i s jeho adresou.

- **Agent se mostu nedotkne.** Co aplikace Strom posílá mostem, patří člověku. Hooky agenta odmítnou příkaz nebo
  stažení webu, které čte adresu mostu nebo ho volá, a agent se tajnou adresu nikdy nedozví.

- **Prohlížeč agenta se řídí stejnými pravidly jako jeho stahování webu.** Každá stránka, kterou agent otevře v Chrome,
  se počítá a zpomaluje spolu s jeho ostatními požadavky na týž web; web, jehož podmínky automatizaci zakazují, web,
  který odmítl, cesta, kterou zapovídá jeho robots.txt, i most mu zůstanou zavřené. Archiv, kam smí jen prohlížeč
  člověka, se mu otevře jen se svolením člověka „přes prohlížeč“, po jedné stránce, lidským tempem. Odkaz Svolení… v
  aplikaci Strom u toho, co čeká na snímky takového archivu, otevře tuto otázku, i když k archivu žádný stahovač nevede.
  Prohlížeč nebo ovládání počítače jiného agenta – Codexu, Antigravity – takovou kontrolu nemá: agent s ním do takového
  archivu sám nejde a snímky uloží člověk ručně. `strom doctor`, brief agenta a Co čeká jednou řeknou, s jakým agentem a
  rozšířením prohlížeče by je agent uložil sám, nebo že rozšíření chybí. Nic se nevypíná: prohlížeč a ovládání počítače
  desktopových aplikací agentů výzkum nehlídá a nedoporučuje – hlídá prohlížeč agenta v Chrome a jiný prohlížeč agent
  použije, jen když o to člověk výslovně požádá. `strom doctor` a brief agenta to říkají výslovně a agent ví, že nikdy
  nepracuje v kopii výzkumu, kterou desktopová aplikace agenta otevře ve vlastním worktree. Aplikace Strom se z mostu
  dozví, zda je prohlížeč agenta připravený, chybí rozšíření, nebo agent nemá žádný, který výzkum hlídá.

- **Prohlížeč agenta uloží snímky sám, po jednom.** Kde člověk archivu, kam smí jen prohlížeč člověka, dovolí přístup
  „přes prohlížeč“, agent otevře v Chrome jeden snímek a uloží to, co ukazuje prohlížeč snímků archivu – nikdy víc, než
  prohlížeč dává, nikdy větší než originál, lidským tempem. Uloží jen snímek, který karta ukazuje na jeho vlastní adrese
  – prohlížeč posunutý na jiný snímek se odmítne a nic se neuloží. Výzkum uložený soubor převezme ze složky stažených
  souborů do složky úkolu pod jeho číslem a úkol se vrátí, až jsou tam všechny jeho snímky. Svolení jde nově dát i
  takovému archivu ze seznamu výzkumu, ke kterému nevede žádný stahovač. Stahovač archivu, jehož prohlížeč ukazuje
  snímky po dlaždicích, ukládá přes tento prohlížeč také, i část snímku; stránku knihy otevře jednou a nikdy ji
  neobnovuje. Kontrolu, zda je u počítače člověk, agent nikdy neprochází. Archiv, jehož robots.txt brání všem robotům v
  celém webu, se bere jako archiv, kam smí jen prohlížeč člověka. Co seznam archivů výzkumu nechává na ruce člověka, se
  dál ukládá ručně – cesta k záznamům, kterou robots.txt zavírá všem robotům, jmenovitý zákaz agentů AI (jako u
  eBadatelny SOA Praha), podmínky, které nic jiného nedovolují, nebo prohlížeč snímků, který je bere z obrazového
  serveru zavřeného všem robotům.

- Podmínka samostatné práce agenta, která by nespustila úkoly spuštěné ručně, se řekne jednou, pak už jen „Přesto
  spustit?“. Podmínka týdne předplatného uvádí využití za týden proti tomu, co je zatím dovoleno, a jak se počítá.
  `strom help --human` uvádí pořadí úkolů, práci mimo linie, opravy a ponechání rozporu mezi příkazy člověka. Výzkum s
  OpenCode pokračuje i po sezení, které OpenCode řádně uzavřel, ale ohlásil jako neúspěšné, a po přechodné chybě sítě –
  totéž sezení se po krátkém čekání obnoví, v rámci času sezení. Když sandbox Codexu nepustí strom k výzkumu – i v
  rouře a na Windows i u příkazu zadaného přes PowerShell –, nebo když příkaz stromu odmítnou už pravidla Codexu, než
  se spustí (na Windows strom v rouře nebo za `;`), výzkum se hned zastaví s tím, co zůstává volbou člověka,
  a takové
  sezení úkol nikdy neodloží. Díky za hlášení na GitHubu. Změnu čtení snímků, kterou výzkum udělal sám a po které se
  četlo zřetelně méně jistě, hned vrátí – už ne až po 60 dnech – a `strom recent` to uvede.

- Výzkum zná víc archivů Česka, Německa a Polska s jejich podmínkami – co který dovoluje automatickým nástrojům, jeho
  tempo a kam smí jen prohlížeč člověka. Nově mezi nimi archivy měst Brna a Ostravy, Vojenský ústřední archiv, Arcinsys
  Hesenska, Dolního Saska a Brém a Šlesvicka-Holštýnska, invenio a pamětní kniha Spolkového archivu (jen prohlížeč
  člověka), galerie matrik bývalých východních území v AGAD, LubGens (jen prohlížeč člověka) a rejstříky polských
  genealogických spolků. Dalších pět českých, kam smí jen prohlížeč člověka: Acta Publica Moravského zemského archivu
  (snímky už ne přes stahovač, ani se svolením z dřívějška – to zůstává, jak bylo dané; přes prohlížeč nejméně 4 sekundy
  od sebe), eBadatelna SOA Praha a obrazové servery SOA Litoměřice, ZA Opava a policejních přihlášek Národního archivu
  (jen ručně). Digitální badatelny SOA Litoměřice a ZA Opava berou snímky z těchto serverů, takže i jejich snímky se
  ukládají ručně – svolení „přes prohlížeč“ se u nich nenabízí. U úkolu, který už na takové snímky čeká, se řekne jen,
  že čeká na snímky uložené ručně, bez nové rady k čekání. Stahovač, vytvořený pro takový archiv dřív, se odmítne před
  jakýmkoli požadavkem, i jeho zkouška, a řekne, co zbývá: svolení člověka „přes prohlížeč“, nebo ruční uložení.

- Se vším z 1.26.1: přerušený zápis už výzkum natrvalo nezablokuje.

## 1.26.1

*4. 11. 2026 · patří k aplikaci Strom 3.22.0.*

- **Přerušený zápis už výzkum natrvalo nezablokuje.** Příkaz zastavený mezi `git add` a commitem (ukončený agentem, nebo
  na Windows s indexem gitu drženým jiným programem) mohl nechat své soubory v indexu gitu: každý další zápis pak končil
  „data výzkumu se změnila mimo strom“, ačkoli `strom verify` ani `strom repair` nic nenašly. Nové soubory, které takový
  zápis nechá v indexu (ve složce už nejsou a v historii nikdy nebyly), nejsou ničí změna – další zápis je sám vrátí a
  pokračuje. `strom repair` vrátí vždy celý index k zapečetěnému stavu, i se změnou záznamu, která v něm zůstala. Zámek,
  který nechal git ukončený uprostřed práce (`.git/index.lock`, starší než 10 minut), `strom repair` odstraní a zápis,
  který na něm skončí, to řekne. Záznam opravdu smazaný nebo upravený mimo strom se hlásí jako dřív.

## 1.26.0

*4. 11. 2026 · patří k aplikaci Strom 3.22.0.*

- **Linie výzkumu z aplikace Strom: založit, upravit, pozastavit, seřadit.** Linii jde v aplikaci založit nebo upravit
  (osoba, směr, otázka, meze), pozastavit, ukončit nebo znovu spustit; pořadí linií je pořadí práce a stránka telefonu
  linii posune nahoru nebo dolů a pozastaví. Práce mimo linie – vedlejší větev, kam žádná linie nesahá, třeba sestra
  předka a její rodina – teď přijde občas, jeden úkol z deseti sezení, místo jen na konci. Každá taková větev může mít
  vlastní volbu (občas, na konci, normálně jako práce linií, nikdy, nebo přidat k linii) a u větve, která roste, se v Co
  čeká navrhne linie: přidat k linii, založit pro ni linii, nechat, jak je, nebo nezkoumat. Manžel nebo manželka předka
  patří k linii předka a linie s otázkou má v sobě svou osobu. Kterýkoli úkol jde udělat hned nebo dát na konec a každý
  úkol ve frontě říká, proč stojí tam, kde stojí. V terminálu: Nastavení → Samostatná práce agenta → Práce mimo linie,
  `strom offline`, `strom task order`.

- **Přepsané vyprávění nic neztratí.** Když výzkum vyprávění napíše znovu – víc údajů, lepší čtení, vyprávění převzaté
  ze staršího výzkumu – každý údaj, pramen a odkaz předchozí verze zůstane, nebo odejde jen záměrně s důvodem, který se
  uloží k vyprávění. Prameny, o které se vyprávění opírá, jsou u něj vidět, u každého údaje název a adresa, i když je
  text nejmenuje, i pramen, který text jmenuje jen kódem; aplikace Strom je dostane s vyprávěním. Údaj z vodítka v textu
  říká, odkud je.

- Velký rodokmen převzatý ve Windows (zhruba 1 500 osob a víc) už neskončí chybou gitu o příliš dlouhém příkazu
  (ENAMETOOLONG) bez jediného zapsaného údaje: vše převzaté se zapíše.

- Na velkém výzkumu (stovky úkolů ve frontě, hodně věcí k vyřízení) už aplikace Strom neříká, že výzkum neodpovídá,
  když jeho agent pracuje: spojení s aplikací spočítá stav výzkumu jednou pro každou změnu, stranou, a aplikaci mezitím
  odpovídá hned – i během denního úklidu, hledání oprav strom, čtení historie po každé změně a přípravy přehledu pro
  widget na ploše.

- Vyprávění i poznámka přijdou do aplikace Strom s mezerami, jak jsou napsané: dvě mezery mezi slovy, nezlomitelná
  ani úzká mezera už se nemění na jednu obyčejnou.

- **Co rozhoduje uživatel, zůstává jeho.** Rozpor výzkumu s úpravou z aplikace Strom, schválení vyprávění nebo jeho nové
  verze a odpověď u větve, která roste, rozhoduje jen uživatel – v aplikaci nebo v Co čeká; agenta strom odmítne a ten
  jen řekne, že to čeká. Vzít zpět, co aplikace poslala nebo co se synchronizovalo (`strom sync undo`), a zahodit strom,
  který čeká, je také jen na uživateli. Volba aplikace „Nechat na agentovi“ takový rozpor agentovi předá; strana vybraná
  v aplikaci se v terminálu jen potvrdí, důvod je nepovinný. Ztotožnění míst: „Nevím“ jde i u rozporu polohy a u návrhu
  zápisu názvu a „Vždy první kandidát (A)“ převezme kandidáta i u rozporu – nikdy přes ručně zadané souřadnice. Terminál
  mluví slovy aplikace: vodítko, doložené, vyvrácené, Nevím, Žádný z nich, stejné volby strany. Takový rozpor, který
  dřív rozhodl agent, najde `strom fixes show edit-decisions` a znovu ho otevře pro uživatele; rozhodnutí agenta zůstane
  v poznámce (`strom fixes undo edit-decisions` ho vrátí).

- **Podmínka týdne předplatného bere celá čísla od 0 do 99 a drží strop.** Menu i `strom config set` odmítnou desetinné
  číslo nebo 100 (dřív se uložilo a každý běh pak skončil) a menu nastavený strop zachová; se stropem se rozběhnuté
  sezení požádá o dokončení, když týden dosáhne stropu, ne až při 99 %. Úkol odložený do data se vrátí v ten den, jak
  teď říká i nápověda. Příchozí snímky probudí jen úkoly, které na tu knihu čekají – nikdy kontrolu webu, kterou dělá
  člověk, a dopis jen tehdy, když čeká na tu knihu.
  Úkoly takto dřív probuzené najde `strom fixes show woken-waits` a znovu čekají, jak čekaly.

## 1.25.2

*3. 11. 2026 · patří k aplikaci Strom 3.21.2.*

- **Brána týdne předplatného už neukončí běh kvůli jedné nepřečtené odpovědi.** Zeptá se znovu, pak čtvrt hodiny počká
  a řekne, co dostala. Nepřihlášený agent se ohlásí už před prvním sezením i s postupem přihlášení; výchozí složka
  agenta zadaná v prostředí se vynechá, takže agent zůstane u svého obvyklého přihlášení.
- **Ztotožnění míst: kontrola zapíše, co zjistí, do záznamu místa.** Staré názvy a pravopisy, jiné tvary místa
  v údajích a chybná fara (odebraná i s důvodem) se zapíší do záznamu i tam, kde souřadnice zadala osoba, nikdy jen
  do dějin. Tvar blízko místa, které záznam už má, se odmítne a řekne se, jak ho k tomu záznamu přidat; dva záznamy
  jednoho místa jde sloučit. Na prvním místě je dnešní název (místo dnes v Polsku polsky, německý název jako
  historický). Otázka u místa nikdy nebere osobě její souřadnice. Už ztotožněná místa se jednou samy srovnají (názvy
  zapsané i s jazykem a roky jako text, dnešní název první, souřadnice osoby, staré názvy jen v dějinách) a krok jde
  vrátit. Souhrn sezení o místech začíná tím, co se udělalo – ztotožněno, ověřeno, s otázkou, nedohledáno – a jedno
  sezení vezme víc míst sousedních oblastí. Z „v Lhotě v čp. 12“ už nezůstane místo „v Lhotě v“:
  místem je obec, jak ji výzkum píše jinde, i když ji věta skloňuje. Každý název se do záznamu místa zapíše jen jednou.
- **Fronta míst se po vyřízení míst vyprázdní.** Místo ztotožněné, ověřené, předané k otázce nebo nedohledané odejde z
  fronty se všemi svými tvary, i s tím, který fakta mezitím píší jinak; místa, která sezení už udělalo, se znovu neberou
  a počet čekajících sedí. Co ve frontě nechala dřívější verze, se odebere samo (jen vyřízená místa, krok jde vrátit);
  kontrola vyžádaná u místa, které čeká na ztotožnění, zůstane jako kontrola, a kontrola čekající u tvaru, který fakta
  nově píší jako jiné místo, přejde s nimi k tomu místu. Každý krok nad místy jde vrátit vlastním
  číslem, i když čeká jiný (také odpovědi člověka). Chybné jméno v záznamu místa — překlep ze záznamu, který už žádný
  fakt nepíše, jméno jiného místa — jde odebrat i s důvodem (`strom place names L… --drop`); sezení nad místy vidí další
  jména záznamu s jazykem a roky; kontrola může uvést, o jaký zdroj se opřela; příslušnost jde zadat i k jednomu roku.
- V rozporech úpravy z aplikace už číslo domu, které značku má, nedostane značku podruhé (polsky „nr domu nr domu 12“),
  a pomlčka v titulku je podle jazyka výzkumu.
- Plán toho, co agent udělá dál, už nespadne na čekajícím vyprávění o manželích: jmenuje oba manžele.

## 1.25.1

*3. 11. 2026 · patří k aplikaci Strom 3.21.1.*

- **Podmínky archivů ověřené znovu, přibyly polské zdroje.** Podmínky a robots.txt všech archivů, které strom zná,
  byly 3. listopadu 2026 přečteny znovu. eBadatelna SOA Praha nově nepouští k digitalizátům žádné roboty (její
  robots.txt z 2. listopadu): její snímky jen přes prohlížeč člověka, stejně jako u třeboňského archivu, který
  požadavky stromu nově odmítá. Podmínky Porta fontium jsou ocitované (po jedné stránce, pro vlastní výzkum, s
  uvedením zdroje a adresy). Nově: Skanoteka PTG (minuta mezi požadavky), GenBaza,
  BaSIA, Genealogia w Archiwach, litevské Metrikai a archivy ve Lvově, Žytomyru a Rivném (za ověřením robota nebo
  zavřené AI agentům: jen prohlížeč člověka), Polona a Slezská digitální knihovna (volná díla), Malopolská digitální knihovna (jen pro vlastní potřebu, nikdy hromadně) a pro místa v Polsku
  názvy z PRNG Geoportalu a Słownik geograficzny, s vlastním hledáním.
- **Polské texty opravené, zkopírovaný příkaz funguje.** Polské menu, zprávy, instalátor i tyto poznámky prošly
  revizí: všude stejné pojmy jako v aplikaci Strom 3.21.1 (Księga rodu, krátké pomlčky), opravená gramatika a tvary
  čísel; data se píšou jako v aplikaci, bez úvodních nul (3.11.2026), měsíc v pádu, který chce předložka
  (przed majem 1880). Příkaz `strom unpack "…"`, který se ukáže po
  zabalení výzkumu nebo před jeho odstraněním, má teď ve všech jazycích rovné uvozovky, takže po zkopírování funguje.

## 1.25.0

*3. 11. 2026 · patří k aplikaci Strom 3.21.0.*

- **Polsky.** Výzkum mluví polsky: menu, jeho hlášky, co zapisuje do výzkumu, instalátor i stránka telefonu; poznámky
  a role v souboru pro Strom jsou polsky. Polský systém se pozná sám, jinak `strom config set lang pl`. Nápověda pro
  agenta zůstává anglicky.
- **Widget Strom i na Windows, a otevře osobu.** Výzkum teď zapisuje to, co z něj ukazuje widget Strom (na čem se pracuje,
  nálezy za posledních 24 hodin, co čeká), i na Windows, do `%USERPROFILE%\.config\strom\widget`, se značkou verze
  strom, která je zapsala. Widget, který zrovna čte svůj soubor, most nikdy nezdrží. `strom uninstall` odebere i soubory
  widgetu, také na Macu; výzkum a nastavení zůstávají.
  Řádek nebo nález widgetu Strom o jedné osobě otevře v aplikaci Strom právě tu osobu (její
  stránku, strom kolem ní), to, co čeká, otevře oddíl Čeká výzkumu (aplikace, která je ještě otevřít neumí,
  otevře strom jako dosud).
- **Čísla domů za jménem obce.** Místa zapsaná jako jméno se samotným číslem (`Lhota 16`) teď jde opravit také
  (`strom fixes run street-places`): místem bude obec a číslo jejím domem – jen když člověk za každou obec zvlášť
  potvrdí, že její čísla jsou domy, a předtím vidí, kterých údajů se to týká. Části města s číslem (`Praha 5`) se
  nikdy nenabízejí. Odpověď se pamatuje ve výzkumu a `strom fixes undo street-places` vše vrátí.
- **Návrat v čase.** `strom history back <změna>` vrátí výzkum do stavu po dřívější změně: nejdřív ukáže, co se vrátí
  a co se vyřadí, a pak jen na „ano“ člověka v terminálu. Nic se nemaže: záznamy přidané od té doby se vyřadí a i sám
  návrat jde stejně vrátit. Odkaz `strom-research://back` ho otevře k jedné změně;
  přehled mostu návrat odliší.
- **Ztotožnění míst.** Výzkum ztotožňuje místa svých záznamů (`strom place identify`, `propose`, `unlocated`): místo
  jisté ze záznamů dostane souřadnice, jména a farnost v čase; kde jistota není, zeptá se člověka s nejvýš třemi
  kandidáty, nebo řekne, co by rozhodlo. Otázky čekají v oddílu Čeká, most je nabízí aplikaci Strom a `strom place
  undo` vezme poslední odpověď zpět. Frontu míst, kterou aplikace Strom zadá ztotožnit hned, lze pustit v tolika
  sezeních za sebou, kolik člověk zvolí, každý počet s časem a cenou. U každého jména místa je poznat, zda je to zápis
  ze záznamů, nebo jiné jméno místa (jiný jazyk, starý název), a jméno zadané oběma způsoby je v místě jednou. Soubor
  Strom dává aplikaci Strom 3.21.0 ztotožněná místa s jejich jmény, polohou a farností.
- **Druhy dějin.** `history.kinds` určuje, jaké druhy událostí dějiny míst hledají (války, epidemie…). `strom history
  align` nejdřív řekne, co by skryl, znovu ukázal a hledal, a provede to jen na „ano“ člověka; nic nalezeného se nemaže.
- **Vedlejší větve nakonec.** Ve výzkumu s více liniemi čeká práce, která žádné linii nepomáhá, až linie nebudou mít
  co dělat (`queue.offLine`: nakonec, podle priority, nebo nikdy).
- **Aktualizace bez přerušení práce.** `strom update` instaluje každou verzi do vlastní složky, takže rozběhnutá práce
  nebo rozhovor pokračuje se svou verzí; starší verze odstraní další aktualizace nebo `strom tidy` a `strom doctor`
  je vypíše. Most aplikaci Strom odpovídá i během vlastní obnovy a během sestavování souboru stromu.

## 1.24.0

*31. 10. 2026 · patří k aplikaci Strom 3.19.0.*

- **Místa zmapovaná jednou pro všechny výzkumy na tomto počítači.** Místo, které jiný výzkum tady už přiřadil k regionům
  dějin, se převezme, když jde jistě o totéž místo (stejný název a stejné souřadnice, farnost nebo okres) a všechny
  výzkumy ho přiřazují stejně; přechází jen přiřazení místa, nic z rodiny. Místo stejného jména, které jistě totéž
  není, dostane agent jako návrh; sám přiřazuje jen zbytek. `strom history adopt --dry-run` řekne, co by se převzalo. Otázka na zapnutí nebo vypnutí událostí
  dějin říká, že platí pro všechny výzkumy na tomto počítači, i jak to změnit jen pro jeden výzkum.
- **Opravy výzkumu pro aplikaci Strom.** Most vypíše, co `strom fixes` ve výzkumu nabízí (název, co dělá, kolik
  položek, stav, jestli jde vrátit), zdarma a bez zápisu; odkaz `strom-research://fixes` otevře opravu v terminálu
  výzkumu, kde se oprava i její vrácení vždy nejdřív potvrzuje.
- **Stránka každého skenu v aplikaci Strom.** Soubor pro Strom dává teď každému prameni stránku jeho skenu v online
  archivu: stránku jeho prvního obrázku, jinak vlastní adresu pramene. Aplikace Strom ji nabídne u výřezů, které soubor
  vynechává, a u pramenů bez výřezu. Jen veřejná webová stránka, nikdy adresa fondu; standardní soubor GEDCOM nechává
  adresu v poznámce. Datum verze výzkumu v souboru pro Strom nese i čas, takže aplikace ukáže den, kdy vznikla, i kolem
  půlnoci.
- **Vlastní rod osoby z aplikace Strom.** Když aplikace Strom u osoby označí, že zakládá vlastní rod nebo rod
  rodiny nenese, `strom sync` to uloží do výzkumu a soubor pro Strom to vrací, takže další odeslání i jiné zařízení
  ukážou stejné rody; sloučení dvou osob značku zachová. Standardní soubor GEDCOM o tom nic neříká. Potřebuje aplikaci
  Strom 3.19.0.
- **Číslo domu, věk a období tak, jak byly zapsány.** Slovo pro číslo domu („No.“, „čp.“) se dává jen před samotné číslo;
  ulice s číslem jde do souboru tak, jak je. Věk „05y“ se čte jako 5 let. Obojí se z aplikace Strom vrací stejné,
  není to úprava uživatele. Období, které vede aplikace Strom („1871/1882“, nebo otevřené na jednom konci), přijde do
  výzkumu jako od … do …, nikdy jako datum někde mezi nimi.
- **Slabý nebo odmítnutý model agenta hlásí doctor.** Když výzkum nemá zvolený model a vlastní výchozí model agenta je
  ten, který výzkum shledal pro svou práci slabým nebo odmítnutým, `strom doctor` varuje a dá příkaz k volbě; sám
  nikdy nevolí.
- **strom z npm drží svůj kanál.** strom nainstalovaný přes npm zůstává na kanálu, ze kterého byl nainstalován, i po
  vydání; kanál zvolený přes `strom update --channel` se pro něj také pamatuje.
- **Příkaz, který selže, vrátí jen své.** Příkaz, který cestou uložil a pak selhal, vrátí jen to, co přišlo po jeho
  uložení, takže výzkum nikdy nevypadá změněný mimo strom. Když se zápis odmítne, protože se výzkum změnil mimo strom,
  člověk to čte v jazyce výzkumu i s cestou, která sedí; agent to dál čte anglicky.

## 1.23.0

*30. 10. 2026 · patří k aplikaci Strom 3.18.0.*

- **Osoba ukázaná zvoleným jménem.** Žena narozená pod jedním jménem, provdaná pod druhým a po rozvodu zase u prvního
  se dá ukazovat tímto jménem znovu, aniž by se přidávalo podruhé: `strom name primary <osoba> "<jméno>"` (a
  `--clear`), nebo `strom name add --primary`. Volba patří jen uživateli, nikdy se nečte ze záznamu; opravy, citace
  i synchronizace s aplikací Strom se dál řídí rodným jménem. Soubor pro Strom zvolené jméno označí, standardní soubor
  GEDCOM ho dá na první místo. Aplikace Strom 3.18.0 osobu tímto jménem ukazuje a jméno zvolené v ní se synchronizací
  vrací do výzkumu.
- **Soubor pro aplikaci Strom bez varování.** Export pro aplikaci Strom varoval před nestandardní značkou u každé
  osoby se zvoleným jménem a u několika značek zdrojů; kontrola teď zná všechny vlastní značky Stromu.
- **Commit gitem navrch výzkumu zapečetěného dvěma klíči (Windows).** `strom check` radil zároveň `strom repair` i
  „nikdy `strom repair`“ a `strom repair` vrátil zpět práci zapsanou klíčem terminálu. `strom repair` teď vrací jen
  to, co se udělalo mimo strom, práce obou klíčů zůstává; potom klíče sjednotí `strom seal adopt` ve vlastním
  terminálu – `strom check` říká oba kroky v tomto pořadí. Spuštěný z aplikace agenta balené pro Windows nechá `strom
  repair` takový výzkum beze změny a odkáže na terminál; odmítnutý zápis tam odkáže na terminál také, už ne nejdřív
  na `strom repair`. Po commitu gitem, který nezměnil žádný záznam, `strom repair` řekne, že výzkum znovu zapečetil,
  už ne „nothing to repair“.
- **Pečetní klíč i tam, kde ho hledá starší strom (Windows).** Klíč převzatý z kopie aplikace balené pro Windows se
  teď ukládá i do `%APPDATA%\strom\keys`, kde ho hledá strom 1.22.1 nebo starší v terminálu: po návratu ke starší verzi
  zůstává výzkum na tomto počítači zapečetěný. Klíč, který tam už je, se nikdy nepřepíše.
- **Vyprávění páru schválené z aplikace Strom.** Dotaz v terminálu teď mluví o vyprávění páru, už ne o vyprávění
  osoby.
- **Vyprávění páru navrhuje výzkum sám.** Jakmile záznamy vyprávějí společný život páru (svatbu nebo dítě a další
  dva údaje) a jeden z dvojice už má vlastní vyprávění, výzkum navrhne vyprávění páru stejně jako vyprávění osoby –
  jen společný život (svatba, domácnost, bydliště, děti, ovdovění); vyprávění partnerů odkáže, neopakuje je.
  Vyprávění osoby napsané potom shrne manželství jednou větou; žádné už napsané vyprávění se kvůli tomu nezkracuje.
  `strom config set stories no` vypne i tato.
- **`strom repair` jedním jazykem.** Každý jeho řádek („obnoveno“, „není co opravit“ …) je pro člověka v jazyce
  výzkumu; agent je čte anglicky jako dřív.

## 1.22.2

*30. 10. 2026 · patří k aplikaci Strom 3.17.1.*

- **Strom z desktopové aplikace agenta a z terminálu zase zapisují do jednoho výzkumu (Windows).** Desktopová aplikace
  agenta může být pro Windows zabalená (MSIX) a každý soubor, který strom spuštěný z ní vytvořil v nastavení stromu, skončil
  v soukromé kopii aplikace: strom z aplikace a strom z terminálu měly každý vlastní pečetní klíč a každý bral zápisy
  druhého jako změnu mimo strom. Nastavení je teď mimo AppData (`%USERPROFILE%\.config\strom`) a samo se převezme ze
  staré složky i z kopie aplikace (obě zůstanou, jak byly). Rozdvojený výzkum se opraví sám, kde to jde; jinak
  klíče sjednotí `strom seal adopt` v terminálu (nabídka ho jednou nabídne) – každý záznam zkontrolovaný, nic se
  neztratí, nikdy `strom repair`. `strom update` spuštěný z takové aplikace nic nenainstaluje (viděla by to jen ona)
  a řekne, ať se spustí v terminálu; `strom doctor` najde kopii programu, kterou si aplikace drží pro sebe.
- **`strom repair` po commitu přes git, který nezměnil žádný záznam** (prázdný, jen poznámky), výzkum znovu zapečetí;
  dřív commit zůstal nezapečetěný, každý zápis byl odmítnut a nebylo co opravit.

## 1.22.1

*29. 10. 2026 · patří k aplikaci Strom 3.17.0.*

- **Událost místa se u regionu nezapíše znovu.** Když se dějiny místa hledaly dřív než dějiny regionů, do kterých
  patří, mohly dějiny regionu přidat tutéž událost ještě jednou (stejný druh, stejné roky). Region teď vynechá, co už
  má některé z jeho míst; událost, která se týkala celého regionu, se zapíše dál. To, co agent k místu čte, říká
  i to, které z jeho regionů se ještě neprošly.

## 1.22.0

*29. 10. 2026 · patří k aplikaci Strom 3.17.0.*

- **Jméno jednou v tom, co čeká.** Úkol k materiálu poslanému z aplikace Strom jmenoval ve widgetu a na stránce
  telefonu každého člověka dvakrát (podruhé v hranatých závorkách) a jeho text bez jmen nechal prázdné závorky; menu,
  `strom plan`, aplikace Strom i soubor GEDCOM ukazovaly jméno s jeho ID zopakované. Každé teď jméno řekne jednou.
- **Widget otevře správný výzkum.** Při několika stromech stejného jména v aplikaci Strom mohl widget na ploše Macu
  otevřít jiný z nich; teď otevře strom svého výzkumu.
- **Mnohem menší logy sezení.** Logy sezení a čtenářů už neuchovávají obrázky, na které se agent díval (jen jejich
  velikost a cestu k náhledu), takže jsou o 95–99 % menší.
- **Úklid, který stačí, a start, který nečeká.** `strom tidy` zvládne logy jakékoli velikosti. Náhledy skenů,
  přerušená stahování a další, co strom umí vyrobit znovu, se uklízejí i bez souhlasu; logy se pak jen zmenší, nikdy
  nesmažou. Po odmítnutí přijde otázka ještě jednou, když `.strom` výrazně přeroste samotný výzkum.
  Pomalý start na OneDrive nebo síťovém disku: menu a `strom doctor` už neotevírají každý sken, návrat do menu je
  okamžitý, doctor ukazuje průběh a řekne, když výzkum leží v cloudu nebo na síťovém disku; `strom doctor --timing`
  ukáže, co trvalo dlouho. Na dlouhém výzkumu (stovky lidí, desítky tisíc skenů) ukáže menu hned, co čeká: počet se
  drží vedle výzkumu, dokud se nezmění nic, z čeho vychází, a pak se spočítá znovu za zlomek sekundy.
- **Archiv, který neodpovídá, zastaví smyčku agenta; čtenáři nečekají na umlklou službu.** `strom fetch` řekne, kdy to
  zkusit znovu a co dělat mezitím; stejný dotaz ve stejném sezení skončí hned (exit 8) a nic neodešle. Úkol, jehož
  archiv má pauzu, počká mimo frontu (plán ho ukáže odložený do té doby) a `strom run --loop` do té doby počká, místo
  aby pouštěl sezení bez práce. Čtenář, jehož agent po opakovaném pokusu služby zmlkne, se jednou obnoví tam, kde
  skončil; když mlčí dál, hned skončí. Takový výpadek už nezmenšuje dávky čtení.
- **Brána týdne předplatného pustí víc sezení za sebou.** Když jednou čeká na náskok, pustí znovu až se dvěma body navíc
  (při 15: 17), místo jednoho sezení po každém čekání.
- **Co předek zažil.** Události v místech stromu – dějiny kraje ze stránek, které strom sám stáhl a ověřil, místní
  události z přečtených záznamů – ukáže aplikace Strom; úvodní nastavení ho nabízí zapnuté, instalace nastavená dřív
  se zeptá jednou, v prvním menu po aktualizaci (Enter: teď ne), a samo se nic nezapne. Zapnout ho může jen člověk –
  tehdy, nebo později v menu Nastavení → Samostatná práce agenta → Dějiny, z aplikace Strom, nebo
  `strom config set experiments.history on`; dokud je vypnuté, nic se nehledá. Dějiny regionů a dějiny míst jsou
  dva vypínače, každý i jen pro jeden výzkum (Nastavení → Samostatná práce agenta, `strom config set
  experiments.history|experiments.placeHistory on|off --for-tree`, nebo vypnutí z aplikace Strom) – volba výzkumu
  platí oběma směry; s vypnutými místy se nehledá ani místo, o které se požádá. Co bylo zapnuté, zůstává zapnuté
  obojí, co vypnuté, obojí vypnuté. Po zapnutí se místa zmapují hned v dalším sezení a regiony se
  prohledávají průběžně mezi sezeními rodinného výzkumu: zhruba každé 5. sezení (výchozí), každé 10., nebo jen když
  není co jiného (`strom config set experiments.historyPace`, úvodní nastavení, Nastavení); kdy, řekne `strom plan`,
  a na slovo člověka mohou jít všechny napřed (`strom run --history`, v menu „Hledat dějiny teď“).
  Nejdřív regiony s nejvíc osobami, země před státem nad ní.
  Když jsou události regionu sebrané, roky, kdy v něm lidé stromu žili víc než 15 let po sobě bez jediné události,
  se prohledají ještě jednou; prohledané roky se v žádném výzkumu znovu neotevřou, dokud se o region nepožádá znovu.
  Region se prohledává jen v letech, kdy v jeho místech žili lidé stromu (jejich údaje tam a pět let kolem nich; až
  do dneška, jen když údaje sahají do posledních 30 let) – pár let ve válce v cizině jsou jen ty roky. Když později
  nalezený předek žil v regionu dřív nebo později, nebo region sdílí jiný výzkum, prohledají se jednou jen nové roky.
  Region, v jehož letech nežil nikdo ze stromu (údaje v jeho místech leží všechny před ním nebo po něm), se
  neprohledává vůbec; přehled i aplikace Strom řeknou, že tam v těch letech nikdo ze stromu nežil.
  `strom history status` a `strom plan` ukážou roky každého regionu a co čeká.
  Co se ukazuje, spravuje člověk v aplikaci Strom nebo přes `strom history`: událost skrytá, nebo smazaná – ze všech
  výzkumů na tomto počítači, znovu se nezapíše – a obnovená; region nebo místo vynechané; regiony místa přiřazené ručně.
  `strom history list [--place L…] [--region <id>]` vypíše události v terminálu: roky, druh, text v jazyce výzkumu,
  zdroj, co je skryté nebo smazané.
  Dějiny jednoho místa a okolí – požáry, povodně, bitvy poblíž, panství, farnost, škola – se hledají na slovo
  člověka (z karty osoby v aplikaci Strom), první při nejbližším sezení, a zůstanou pro všechny výzkumy na tomto
  počítači s tímto místem. Každé místo se souřadnicemi se může hledat samo, nejdřív místa s nejvíc osobami: Nastavení
  → Samostatná práce agenta → Dějiny jednotlivých míst automaticky (vypnuté, dokud se nezapne). Událost, o kterou se
  požádá v rozhovoru, přidá agent ze stránky, kterou strom přečetl, s jejím zdrojem.
  Vyprávění ji berou jako pozadí doby: události z let, kdy člověk žil v místech svých údajů, každou s jejím zdrojem,
  nikdy jako to, co dělal (u páru jen z let, kdy žili oba); nic skrytého ani smazaného. Schválené vyprávění zůstane, jak je – dějiny přijdou až s jeho
  další verzí, která čeká na schválení. Vypnout se dá v nastavení nebo v aplikaci Strom
  (`strom config set stories.history no`).
- **Tvary jednoho příjmení.** `strom surname suggest` navrhne, které zapsané tvary příjmení patří jedné rodině: táž
  osoba zapsaná v záznamech různě (s citacemi), nebo táž hláska zapsaná jinak na stejném místě ve stejných letech –
  nikdy rodina manžela a otce téže ženy; značka čtení za jménem (`[?]`, `[!]`, `[…]`) není samostatný tvar. O nich
  rozhoduje jen člověk, v terminálu
  (`strom surname accept|reject|group`); agent jen navrhuje. Tvary jedné rodiny rozšíří hledání záznamů i lidí, kteří
  mohou být jedna osoba. `strom person compare` řekne o dvou lidech, zda jsou jedna osoba, dvě, nebo nejisté, a proč
  (už sloučení, jiné pohlaví, roky daleko od sebe, život skončený dřív, než druhý začal, jiní rodiče, jeden zápis pro
  oba…). Nález označený jako není chyba tak zůstane: `strom quality dismiss|undo|list`, jen rozhodnutí člověka – dva
  lidé takto označení se už nikdy nenavrhnou jako jedna osoba. `strom check` upozorní na událost nebo sňatek datovaný
  jistě po smrti (přibližné datum nikdy) a plán výzkumu založí úkol to prověřit, sám hotový, jakmile se datum opraví
  nebo se nález označí jako není chyba. Účastník události (kmotr, svědek) je jméno a co o něm záznam říká, patří do
  závorky na konci jako poznámka: `--with "godparent:Jan Lhoták (sedlák, Lhota č. 12)"`; jméno delší než čtyři slova
  nebo s číslem se odmítne s tím, co dát do závorky, kněz zapsaný jako svědek se má zapsat jako oddávající nebo křtící
  (`officiant`) a účastník, který může být někdo z rodiny okolo zápisu, se navrhne svým číslem, nikdy se nenapojí sám.
  Takto zapsaná dřívější jména najde `strom check` a rozdělí `strom fixes show|run participant-names` – zdarma, podle
  pravidel, i v archivu, vše jedním krokem, vrátí `strom fixes undo participant-names`; rozhoduje jen člověk.
  Aplikace Strom před 3.17 vrací období jako rozpětí (od–do jako mezi–a) a věk bez nulových jednotek (0y 2m 26d jako
  2m 26d); synchronizace to brala jako úpravu uživatele – rozpor, nebo bydliště přidané jako vodítko vedle téhož. Teď
  se neupravený strom vrátí beze změny; z aplikace, která je zachová (3.17), je rozpětí místo období zase úprava
  uživatele, a věk ze samých nul (0y 0m 0d) je totéž co 0y. Co takto zapsaly dřívější synchronizace, najde `strom fixes show app-shapes`
  a opraví `strom fixes run app-shapes` – zdarma, podle pravidel, i v archivu, vše jedním krokem, vrátí `strom fixes
  undo app-shapes`; rozhoduje jen člověk.
  Ulice není místo: místo zapsané s ulicí nebo číslem domu („Lhota, Lhotákova 12“) se při zápisu odmítne s obcí, kterou
  zapsat, a ulicí a číslem pro `--house`, v kterémkoli jazyce a písmu; dějiny míst se řídí obcí, takže místa lišící
  se jen ulicí jsou jedno. Co se takto zapsalo dřív, najde `strom check` a opraví `strom fixes show|run street-places`
  (ulice k domu, kde je prázdný nebo jmenuje tutéž) – zdarma, i v archivu, vše jedním krokem, vrátí `strom fixes
  undo street-places`; rozhoduje jen člověk.

## 1.21.0

*26. 10. 2026 · patří k aplikaci Strom 3.16.0.*

- **„Čeká“ říká, co aplikace Strom neukazuje.** Řádek v menu a `strom plan` řekne, kolik z čekajícího je jen tady
  v terminálu a kolik čeká na odpověď; zbytek je číslo, které ukazuje aplikace Strom, takže se obě shodují.
- **„Co čeká“ dává vlastní věci terminálu na začátek.** Co ukazuje jen terminál (rozpor vlastní úpravy, odeslání
  z aplikace, otázka ke čtení skenů), je pod „Jen tady v terminálu“, zbytek pod „I v aplikaci Strom“.
- **`strom input assign`, `hide` a `unskip` řeknou, co se změnilo**, v jazyce výzkumu: každý soubor, každý
  uvolněný nebo nový úkol, lidi jménem a jak změnu vrátit. Jejich JSON zůstává stejný.
- **Přehled výzkumu pro widget na ploše macOS.** Dokud běží most (`strom live`), drží se přehled každého stromu
  v souboru pro widget na ploše Macu: co se právě dělá, nálezy za poslední den a co čeká, každý text i bez jmen
  lidí. Mimo macOS se nic nezapisuje.

## 1.20.0

*25. 10. 2026 · patří k aplikaci Strom 3.16.0.*

- **Menu bez nikoho u terminálu to řekne hned.** Spuštěné tam, kde nemá kdo odpovědět (zavřený vstup, okno
  bez terminálu), skončí jednou větou v jazyce výzkumu a tím, co udělat místo toho, už ne chybou programu; otázka,
  jejíž vstup skončí dřív než odpověď, ukončí menu stejně.
- **`strom check` mluví jedním jazykem.** Pro člověka jsou všechny nálezy, součet i poznámky v jazyce výzkumu, pro
  agenta celé anglicky, nikdy směs obou. Řekne i to, co na tomto počítači chybí: soubory sdílené složky, které se
  nepřenesly (kolik, první a vrátit celou složku Strom), a soubory výzkumu v iCloud Drive, které se ještě nestáhly –
  řečeno právě tak, nikdy s odkazem na `strom repair`, a nic se přes ně nezapíše. Plný disk se všude řekne stejně,
  v jazyce výzkumu se složkou, na jejímž disku chybí místo; most aplikaci odpoví kódem `disk.full` (507)
  a `tree.not-downloaded` (409) a `strom live start` řekne, proč se most nespustil.
- **Když sandbox agenta odmítne git, je jmenováno správné místo.** Zpráva uvádí jako odepřenou historii výzkumu
  (jeho složku `.git`), ne program gitu.
- **Archiv Stromu nespustí placené čtení.** `strom read`, `strom clips` a `strom transcripts` archiv (i výzkum,
  který čeká na svého agenta) odmítne stejnou větou jako ostatní odmítnutí; nic se nečte ani nezapisuje.
  Texty archivu nic neslibují: materiál se „ukládá do Archivu Stromu“ a řekne se jen počet; složka s víc než
  20 obrázky nabídne uložení jako rodinné dokumenty; stránka telefonu v archivu říká „Uložit do Archivu Stromu“;
  telefon je v nápovědě archivu. Nápověda archivu i výzkumu, který čeká na svého agenta, nabízí jen to, co v něm
  funguje, bez úkolů a fronty; návod v balíčku archivu (`strom pack`) vede do aplikace Strom. Neohlásí ani nový
  úkol, který pak nevypíše. **V něm se rozhodují i rozpory:**
  otevřený rozpor (tentýž údaj upravený jinak v aplikaci Strom a tady) se řekne v přehledu i v „Co čeká“ a rozhodne
  se tam – hodnota z aplikace, nebo z archivu, a proč – stejně jako odkazem z aplikace; `strom conflict` je
  v nápovědě archivu. `strom person show` osoby odebrané v aplikaci Strom tím začíná, se dnem a s `strom sync undo
  I…`, které ji vrátí; výpisy jejích příbuzných ji označí „(odebráno)“. **Dva prohlížeče nad jedním archivem:**
  osobu odebranou v jednom už starší kopie z druhého nikdy nezapíše jako novou osobu — kde na ní nic nezměnila,
  odebrání platí a aplikace se dozví, které poslání ji odebralo; kde ji upravila, úpravy se uloží k ní a rozpor se
  zeptá, zda se vrátí — druhá kopie, která ji upravila jinak, dostane vlastní rozpor proti první a nikdy ji
  nepřepíše, a po rozhodnutí „nechat odebranou“ se tatáž kopie už neptá. Starší kopie bez osoby, kterou jiné okno
  nebo výzkum mezitím upravil, ji už potichu neodebere: rozpor se zeptá, zda odejde, a řekne, kdo ji upravil (jiná
  kopie aplikace, výzkum, obojí); úprava mezitím vrácená (`strom sync undo`) se nepočítá a po rozhodnutí „nechat“ se
  tatáž kopie dozví jen to. Když se po rozhodnutí „odebrat“ vrátí poslání starší kopie, výpis řekne, že osoba zůstává mimo strom,
  i jak ji vrátit (`strom conflict resolve X… --take research`). Poslání vrácené zpět (`strom sync undo`)
  a z aplikace poslané znovu odebere znovu, co odebralo. Zda osoba ve stromu zůstane, jde rozhodnout znovu: `strom history`
  uvádí každé rozhodnutí s jeho vlastním zdůvodněním a s tím, zda osoba ze stromu odešla, nebo se vrátila, a `strom conflict
  show` vypíše dřívější rozhodnutí v jazyce výzkumu.
- **Záloha před jinou verzí obsahuje i sdílenou složku.** Sdílené obrázky (skeny, originály z aplikace Strom, fotky
  z telefonu) se do ní propojí, kde to disk umí, takže místo nezabírají dvakrát, jinak se zkopírují; vynechají se
  jen tehdy, když na disku na kopii není místo, a záloha to řekne; nedokončená nahrávání z aplikace a náhledy, které
  strom umí udělat znovu, zůstanou venku. **Co zálohovat:** `strom backup` a Nastavení →
  Údržba → „Co zálohovat“ uvedou jedinou složku se všemi výzkumy
  a sdílenými obrázky i s její velikostí, nebo `strom pack` pro jeden rodokmen.
- **`strom doctor` pozná síťový nebo přesměrovaný disk.** Kde git nezjistí složku, ve které pracuje, rodokmeny tam
  nemohou vést historii; doctor to teď řekne stejně jako `strom init`.
- **Rodinný materiál se dá do pořádku v aplikaci Strom.** Osoby, ke kterým fotka nebo dokument patří, se přidávají
  a odebírají u mnoha souborů najednou nebo u celé dávky; soubor, který s rodinou nesouvisí nebo je stejný jako jiný,
  se skryje a kdykoli zase ukáže — nic se nemaže. Aplikace ukazuje název, druh a datum každého souboru
  (`strom input sort --title --date`) a malé náhledy fotek, HEIC a PDF, vytvořené jednou a uložené stranou.
  V terminálu: `strom input assign`, `strom input hide` a `strom input unskip`, které vrátí i přeskočení.
  Materiál přidaný v terminálu nebo v menu do rodokmenu, který má aplikace Strom, řekne, kde v ní je: u osoby
  → Materiály.
- **Rodokmen z jiného počítače nebo ručně přesunutý se ohlásí – nikdy ho nenahradí jiný.** Zapečetěný na jiném
  počítači (nebo s chybějícím nastavením stromu) jde číst a zápis to řekne v jazyce výzkumu s jediným krokem,
  `strom seal adopt`, který nabídne menu, nastavení (vypíše nalezené rodokmeny) i odkaz z aplikace Strom, vždy až na
  ano člověka; most odmítne zápisy aplikace kódem `seal.foreign` (409). Rodokmen, který už není tam, kde byl, se
  jmenuje s původní složkou a s tím, jak přidat novou (`strom trees use <složka>`, od té doby zapamatovanou);
  `strom app`, `strom live start` ani žádný příkaz místo něj neotevře jiný a `strom trees forget` sundá ze seznamu
  ten, který už není potřeba. `strom trees` i `/status` mostu říkají, co který rodokmen je: výzkum, výzkum čekající
  na svého agenta, nebo Archiv Stromu – pro aplikaci (`kind`) je výzkum čekající na agenta archivem, dokud na něm
  agent nezačne. Prázdná aplikace Strom (s vymazanými daty prohlížeče), která žádá nový výzkum, dostane nejdřív
  nabídku rodokmenů, které už tu jsou, a některý z nich otevře v aplikaci.

## 1.19.0

*22. 10. 2026 · patří k aplikaci Strom 3.15.0.*

- **Na archiv, který zmlkl, se čeká, místo opakovaných dotazů.** Když archiv přestane odpovídat, strom ho nechá na
  pokoji hodinu — a když týž den mlčí dál, dvě a pak čtyři hodiny — a agent se dozví, do kdy: mezitím dělá
  jinou práci, nechá stahování na pozadí na archiv počkat (až 30 minut) a pokračovat samo, nebo sezení ukončí a
  naváže později. Archiv se už mezitím neobtěžuje dotazy pořád dokola.
- **První úklid staršího výzkumu se jednou nabídne.** Výzkum, u kterého se nastřádalo hodně dat dřív, než si v tom
  strom začal sám dělat pořádek (záznamy práce, náhledy snímků a podobně), dostane v menu jednu nabídku: co by se
  smazalo, kolik a proč — bez souhlasu nic. Po souhlasu se v tom pak udržuje pořádek samo; po odmítnutí menu a
  nastavení dál říkají, co jde uvolnit. `strom pack`, odebrání rodokmenu i menu uvádějí velikost balíku, zálohy nebo
  snímků jako všude jinde (1,5 MB, u malých 24 kB), nikdy „0.0 MB“.
- **Digitální knihovny napoprvé správně.** U Krameria Národní knihovny ČR a Moravské zemské knihovny a u ANNO
  Rakouské národní knihovny dostane agent jejich vlastní vyhledávací adresy — méně neúspěšných dotazů a hádání.
- **Ostřejší část snímku se opravdu čte.** Když z archivu přišla část snímku v lepším rozlišení, agent i jeho čtenáři
  se na to místo dívají v ní — i když vyznačené místo kousek přesahuje, zbytek se řekne —, ne na celý zmenšený snímek;
  ostřejší část, která místo pokrývá jen zčásti, se uvede i s tím, jak se na ni podívat.
- **Dokument se přečte spolehlivěji.** Čtenář zapisuje čtení do své zprávy průběžně, a čtení dvou čtenářů, kde četl
  jen jeden, to tak řekne — nikdy, že se shodují.
- **Propojení s telefonem čeká na výzkum, neříká se jako chyba.** Než se po spuštění počítače spustí výzkum, `strom
  phone` i nastavení řeknou, že propojení je zapnuté a jeho server se znovu spustí se spuštěním výzkumu. Na iPhonu
  zůstane list fotek při psaní osoby nebo poznámky nad klávesnicí a nabízené osoby na očích; server telefonu se spustí
  jednou, i když ho spouští několik naráz.
- **Opravy vlastních chyb stromu k rozhodnutí.** Když strom zjistí, že některá jeho dřívější verze ve výzkumu něco
  udělala špatně, `strom fixes` a Nastavení → Údržba → Opravy řeknou, o co jde, co se našlo a co by napravení udělalo,
  i jak je náročné; bez souhlasu se nestane nic a odmítnutí platí. První: slepá čtení ze zmenšeného snímku tam, kde
  byla ostřejší část — přečtou se znovu vedle starých, nejdřív na několika, nic se nepřepíše, rozdíl se stane úkolem.
  Čtení se porovnají podle přečteného — jmen, dat a čísel přepisu, ne slov komentáře čtenáře (i v němčině, kde má
  velké písmeno každé podstatné jméno) — a úkol jednou větou řekne, který údaj se liší; kde jméno může jen začínat
  větu, čtení se za shodná nevydávají. Když není co číst znovu, `strom fixes run` to řekne. Druhá: po změně modelu nebo agenta pro čtení dřívější čtení, která stojí za nové přečtení
  — s otevřenými místy, s neshodou čtenářů, s otevřeným rozporem, nepotvrzená u pramene; řečeno jako „četl model X,
  teď se čte modelem Y“, nabídnuto jednou na agenta a model, každé se přečte znovu tak, jak se četlo (snímky jednoho
  čtení spolu, zkouška i část vždy z celých čtení). Počítá se v čteních s jejich místy a náročnost ve voláních
  čtenáře; nabízí se po stupních — jen sporná (rozchod čtenářů, otevřený rozpor, nepotvrzené u pramene), s přímou
  linií, nebo všechna — každý s tím, co stojí, nejužší první; data a svědci jen řadí. Napravit může i jiný připravený
  agent nebo model (`strom fixes run <id> --agent <a> --model <m>`), s tím, kdo četl dřív; ten, kdo tu číst nemůže, se
  odmítne hned i s těmi, kdo mohou. Čas napravení se zaokrouhluje nahoru a po zkoušce se přepočítá podle čtení, jak
  běžela souběžně.
- **Rodokmen, do kterého strom nesmí zapisovat, řekne proč.** strom zapíše do složky výzkumu pravidla pro Codex:
  příkaz strom spuštěný samotný jde mimo sandbox Codexu — i na Windows, kde sandbox držel historii výzkumu zavřenou
  a nic jiného nepustil — a co rozhoduje člověk a samotný git zůstává zakázané. Když zápisu do složky rodokmenu
  sandbox agenta přesto brání, strom to řekne a agentovi poradí, co dělat podle toho, jak běží — spouštět strom
  samotný, spustit Codex ve složce výzkumu, které důvěřuje, nebo nechat příkaz schválit mimo sandbox — místo holého
  „chybí oprávnění“, které agent převyprávěl jako „nemám přístup k rodokmenu“. Kde agent nenechá žádnou svou značku,
  pozná ho strom podle vlastní značky u agentů, které spouští, nebo podle programů, které ho spustily, a jako
  pravděpodobnou příčinu jmenuje jeho sandbox, potom OneDrive nebo řízený přístup ke složkám ve Windows. Odmítnutý
  zápis do historie se už nehlásí jako chybějící oprávnění k samotnému gitu a záloha nebo aktualizace, kterou nešlo
  zapsat, žádá složku, do které lze zapisovat, a už neradí uvolnit místo na disku. `strom doctor` a `strom check`
  zápis do výzkumu zkusí a řeknou, když nejde, i tam, kde složku nejde ani vypsat. Na disku bez pevných odkazů
  (síťové úložiště, disk přesměrovaný přes Vzdálenou plochu) strom zase zapisuje, zámek jde jinou cestou, a zámek,
  který pomalý disk ještě neukáže, už se po chvilce nepřebírá; rodokmen, který tam nejde založit, po sobě nic nenechá
  a řekne to v jazyce výzkumu. Po instalaci přes npm na Windows spustí strom příkaz `strom.cmd` i tam, kde PowerShell
  skripty odmítá.

## 1.18.0

*21. 10. 2026 · patří k aplikaci Strom 3.14.0.*

- **Fotky z telefonu nastojato.** Fotka otočená podle údaje EXIF se čte tak, jak se má dívat, nastojato; místa na ní
  vyznačená (výřezy, poloviny dvoustrany, uložená část) jsou místa obrázku, jak se ukazuje. Fotka sama zůstává, jak
  byla.
- **Fotky HEIC a dokumenty PDF jdou přečíst.** Fotky HEIC z telefonu a stránky PDF se pro čtení převádějí na JPEG —
  na macOS, Windows i Linuxu — a originál zůstává, jak přišel. Fotka HEIC jde do aplikace Strom jako výřez JPEG.
  Kde obrázek na počítači nic nepřevede, řekne to jedna věta i s tím, co by pomohlo; `strom tidy` převedené obrázky
  po 30 dnech nebo nad 500 MB uklidí.
- **Jeden dokument přečtený naráz.** `strom document read` přečte fotku, sken nebo PDF jednoho dokumentu — zápis z
  matriky, dopis, listinu, náhrobek, rub fotky: přepis slovo od slova, překlad, význam starých slov a zkratek a osoby,
  které jmenuje, i s tím, kdo ze stromu to může být. Nic se nedomýšlí: jméno, které v dokumentu není, vypadne — i
  příjmení, nikdy se nebere od otce ani z jiné rodiny —, co nejde přečíst, je označené; druhý čtenář může číst naslepo.
  Dokument na úředním formuláři, jako rodný list, si své osoby ponechá — dítě i oba rodiče s jejich podílem, i jméno a
  příjmení psané proloženě a rodné příjmení po „roz.“ —, a dokument přečtený dřív je po aktualizaci ukáže, aniž by se
  četl znovu. U každé osoby a události je i místo na stránce, kde stojí, takže aplikace Strom ukáže výřez každé z nich.
  Do stromu se z toho nic nezapíše samo. Dokument už přečtený to o sobě řekne, takže se omylem nečte podruhé. Dokument
  čtený znovu se ukazuje pod názvem svého souboru, nikdy pod kódem. Dokument poslaný z aplikace Strom najde agenta
  stejně jako terminál — i nainstalovaného do vlastní složky, přes npm nebo Homebrew — místo hlášení, že agent není
  nastavený. Čte ho každý agent, se kterým výzkum pracuje, s modelem a úsilím nastaveným pro výzkum.
- **Fotky z telefonu.** `strom phone on`, které zapíná jen člověk, pustí k počítači telefon v domácí síti (Wi-Fi
  nebo kabel — nikdy mobilní síť ani VPN). Telefon se jednou spáruje přes QR kód; jeho stránka pak fotí nebo vybírá
  z galerie a posílá fotky celé do stromu výzkumu, s poznámkou a osobou, kterou ukazují — stejně jako „Přidat
  materiály“ v aplikaci Strom. Fotka zůstává v telefonu, dokud ji počítač nemá, takže přerušené spojení nic neztratí.
- **Výzkum sledovaný z telefonu.** Stránka telefonu ukazuje, co výzkum dělá — na čem se teď pracuje, co čeká na
  rozhodnutí, posledních 24 hodin a poslední změny, obnovené každých 10 sekund, dokud je stránka na očích — jen
  k podívání: v telefonu se nic neodpovídá, nespouští ani nerozhoduje. Nedostupný počítač stránka řekne i s posledními
  údaji a jejich časem. Otevře strom, jehož QR kód ji spároval, a jde přidat na plochu jako ikona, která ji otevře
  bez nového párování. Co čeká a změny jdou na telefonu přečíst celé: text toho, co čeká, se neořezává, další položky
  nad prvních 20 se donačtou klepnutím a změna s víc řádky se rozbalí celá; Co čeká je poslední částí stránky. Změna
  starší než dnešek má u času i datum (rok jen u loňských a starších). Nálezy pod Teď ukazují, co výzkum našel od
  posledního pohledu z telefonu (aspoň posledních 24 hodin, starší klepnutím) — nové osoby, prameny, nalezené, opravené
  či nově doložené údaje, vyřešené rozpory — nové zvýrazněné; co přibude při otevřené stránce, ukáže jen počet
  v názvu záložky a malý štítek.
- **Souhlas v jednom jazyce, otázka i v terminálu.** Souhlas, který dává jen člověk (rozbalení výzkumu, odebrání
  stromu, odmítnuté okno), zazní celý v jazyce výzkumu. Co otevírá počítač ven, stojí peníze nebo spouští cizí program
  – Remote Control, stahovače bez ptaní, podmínka práce agenta o samotě, hook, vlastní tempo archivu, propojení s
  telefonem, ladění čtení – se ptá ano/ne i v terminálu; Enter znamená ne a `--yes` za člověka neodpoví. Když se
  `strom update` odmítne, řekne, že se nic nenainstalovalo a která verze zůstává, a skončí chybovým kódem; nepovedená
  instalace se řekne také v jazyce výzkumu.
- **Chybné jméno nebo poznámka odvolané.** `strom name retract` odvolá jméno špatně přečtené nebo přiřazené jinému
  člověku, `strom note retract` poznámku a `strom note edit` ji opraví – u osoby, faktu i úkolu, vždy s důvodem; nic
  se nemaže. Odvolané se už nikde neukazuje – ani agentovi, ani v GEDCOM, ani ve `strom find`, takže ho aplikace Strom
  po načtení stromu neukáže a synchronizace ho nevrátí; `strom person show --history` řekne, co to bylo, kdy a proč, a
  `strom name restore` nebo `strom note restore` ho vrátí.
- **Opravy z hlášení.** Rozloučení nabídky řekne, jak strom spustit znovu i tam, kde okno terminálu příkaz ještě nezná
  (po instalaci jedním řádkem: v novém okně `strom`, v tomto plná cesta; plná cesta i tam, kde se na jméno ozve dřív
  jiný `strom`), a když most pro aplikaci Strom běží dál, řekne to i s tím, jak ho zastavit; výběr rodokmenu v nabídce
  jde vrátit nulou. Most už nedrží složku rodokmenu, takže ji jde na Windows smazat, a sám skončí, když rodokmen zmizí
  (rodokmen smaže `strom trees remove`). Konec stromu, kde křest neuvádí otce, je uzavřený, jakmile na něm nic neběží
  – už nečeká natrvalo na rozhodnutí. Pramen přejmenovaný v aplikaci Strom se přejmenuje i ve výzkumu a signatura nebo
  strana pramene přijde do aplikace k prameni samému („Signatura / strana“), i když ho zatím nic necituje. Emoji nebo
  jiný vzácný znak, který soubor z aplikace Strom cestou poškodil (ukáže se jako ��), není přejmenování ani změna
  poznámky: výzkum si nechá svůj text. Místo nebo jiný údaj delší než řádek souboru GEDCOM (255 bajtů) už nezastaví
  jeho zápis a žádné emoji se nerozdělí tam, kde dlouhý řádek pokračuje. S `excerpts.for all` dostane v aplikaci Strom
  výřez i pramen, který zatím nikdo necituje, pokud se vedle citovaných vejde do limitu – citované se kvůli němu
  nezmenší; co se nevešlo, se řekne. Aplikace Strom se dozví, které obrazy pramene výzkum má, ale soubor je vynechal,
  a na vyžádání si je z výzkumu načte — pramen po prameni, nebo všechny najednou i s tím, kolik jich je a jak asi velké.

## 1.17.0

*19. 10. 2026 · patří k aplikaci Strom 3.13.1.*

- **Nejdřív, co by hypotézy spojovaly.** Úkoly doplnit, co by spojovaly verze otevřené hypotézy, jdou ve frontě
  první — i ve stávajícím výzkumu po aktualizaci —, takže aplikace Strom brzy ukáže tyto vazby.
- **Most aplikace Strom běží, dokud pracuje agent.** Most už neskončí po dvou hodinách klidu, dokud ve stromu
  pracuje agent (i pozastavený běh), takže aplikace Strom vidí výzkum v práci i u stromu, který právě nesleduje.
  Most ukončený pro klid se vrátí na svou adresu, když práce znovu začne; most zastavený `strom live stop` zůstane
  zastavený.
- **Přerušené stahování se ohlásí a uklidí.** Stahování, jehož proces skončil uprostřed, se ohlásí jako přerušené,
  s tím, co se uložilo a co chybí; jeho pracovní složka se uklidí.
- **Nový materiál v jazyce výzkumu.** Co přišlo (zaregistrovaný materiál, co přibylo, pravděpodobné duplicity,
  jména po sňatku, úkoly), se vypíše v jazyce výzkumu.
- **Počty tak, jak je říká jazyk.** Texty počítají v tvarech svého jazyka: 1 úkol, 2 úkoly, 5 úkolů — anglicky
  1 task, 2 tasks, německy 1 Änderung, 2 Änderungen — místo „úkol(ů)“.
- **Víc v jazyce výzkumu.** Osoby bez vlastního záznamu (`strom person list --unproven`, kam odkazuje
  `strom check`), co zapsal `strom export gedcom`, a varování počítadla ve `strom check` jsou v jazyce výzkumu,
  i s počty – velikost a kvalita obrázků tak, jak je píše jazyk výzkumu (0,4 MB · kvalita běžná).
- **Ukládání na Windows počká na antivir.** Soubor, který antivir nebo indexování vyhledávání na chvíli drží, se po
  krátkém čekání uloží – nebo přečte –, místo aby zápis selhal. Soubor držený déle zastaví příkaz celý, nic z něj
  nezůstane uložené napůl a hláška říká, že soubor drží jiný program a příkaz jde prostě spustit znovu.
- **Chyby pro agenta anglicky.** Co čte agent, je anglicky, ať je výzkum v jakémkoli jazyce; člověk u terminálu nebo
  v nabídce to čte v jazyce výzkumu jako dosud.

## 1.16.0

*17. 10. 2026 · patří k aplikaci Strom 3.13.0.*

- **Terminál pro okna výzkumu (macOS).** Co aplikace Strom otevírá v terminálu a rozhovor předaný do nového okna
  se může otevírat v iTerm2 místo v terminálu systému: první položka nastavení, průvodce, když jsou tu oba, nebo
  `strom config set terminal iterm2`. Když zvolený terminál chybí, otevře se terminál systému a okno to řekne;
  `strom doctor` ukáže, který je zvolený. Na Windows terminál určuje systém.
- **Každá osoba na kraji stromu s vlastními variantami.** Když se otevřená hypotéza napojuje na strom u více osob,
  každá nese varianty, které ji jmenují, a rodinu mimo strom, ke které patří; aplikace Strom tak může ukázat všechny,
  ne jen první.
- **Kraj stromu osobu po osobě.** `strom edge --json` vypíše každou osobu, na kterou hypotéza navazuje, s variantami
  a rodinou každé z nich.
- **Příjmení po sňatku oběma směry s aplikací Strom.** Jméno po sňatku, které aplikace Strom pošle zpět, se zapíše
  jako jméno po sňatku, nikdy jako přejmenování ani jako další tvar rodného jména; stejné příjmení je stejné jméno,
  ať s ním jde jakékoli křestní. Když se v aplikaci změní nebo smaže, staré zmizí tam, kde ho daly jen úpravy
  v aplikaci; jméno doložené záznamem zůstává. `strom intake` čte `_MARNM` jiných programů jako jméno po sňatku.
  Výzkum založený dřív z takového rodokmenu (MyHeritage, Legacy, PAF) je doplní ze souboru, který má uložený:
  `strom input names I…` je ukáže, `--apply` přidá jen tato jména s citací importu, `--undo` je vezme zpět.
- **Jeden archiv, jedna otázka.** Když obrazy jednoho archivu přicházejí z více adres (jeho web, album, server
  obrazů), svolení archivu se žádá jednou a platí pro všechny, ne adresu po adrese.
- **Linie výzkumu.** České texty všude říkají „linie výzkumu“, nikde už „směry“.

## 1.15.0

*16. 10. 2026 · patří k aplikaci Strom 3.12.0.*

- **Archiv Stromu podle volby, i s AI agentem.** Průvodce nastavením se ptá, zda nové rodokmeny budou výzkumem
  s agentem, nebo jen Archivem Stromu; v nastavení jde volbu změnit pro jeden rodokmen nebo pro nové.
- **Výzkum čeká na svého agenta.** Rodokmen, jehož AI agent na tomto počítači není, ukládá, co posílá aplikace Strom,
  jako Archiv Stromu. Jakmile je agent nainstalovaný, výzkum pokračuje sám.
- **Jedna kniha archivu se stahuje jednou.** Kniha, která už ve výzkumu je, se pojmenuje místo nového zápisu
  a stahování, takže archiv nikdy nedostane dvakrát žádost o tytéž snímky.
- **Rychlejší čtení.** Snímky čte současně pět čtenářů (nastavení `read.parallel`, 1 až 10) a dlouhé stahování
  ukazuje, kolik už je hotovo („40/109 snímků“). Čtenáři začnou už během stahování knihy: snímky se registrují
  po deseti a co nepřišlo, je řečeno přesně; Ctrl-C ponechá, co už přišlo. Archiv dostane stejné žádosti ve stejném
  tempu. Kniha se může stahovat i na pozadí, zatímco agent pracuje dál (`strom fetch --background`), nikdy z archivu,
  který dovoluje jen tempo člověka. Hledání jednoho zápisu může skončit u nálezu (`strom read --until-found`):
  přečtené snímky jsou řečeny přesně a jen ty se počítají jako prohledané.
- **Rodokmeny z jiných programů.** Soubor GEDCOM uložený se značkou BOM nebo v UTF-16 (tak ho ukládají některé programy
  ve Windows) se čte jako rodokmen; rodokmen jiného výzkumu se převezme jako cizí.
- **Čistě na jednom počítači.** Živé sledování končí čistě na každém systému, i ve Windows, a aplikace Strom se dozví,
  že skončilo. Jiný strom na stejném počítači (z npm nebo sestavený ze zdrojů) nikdy nepřevezme odkazy aplikace Strom
  ani kanál aktualizací.
- **Opravy ze skutečných výzkumů.** Denní příděl práce o samotě pustí nový týden hned, v posledních dvou hodinách
  týdne využije, co zbývá, místo čekání přes obnovení, a říká, kdy se týden obnoví. Věk zapsaný zlomkem (½ roku, 1 1/2
  léta, půl roku) se přečte a seznam snímků (`strom read --images 5-19,21-39`) se čte tak, jak je zadaný. Knihu
  stahuje sezení, které ji čte, nikdy předem pro pozdější; `strom fetch --recordset` najde knihu sám; počty a příkazy
  jsou řečeny tak, jak se píšou.
- **Co je nového.** Po `strom update` a u `strom --version` odkaz na tento přehled v jazyce výzkumu. Aplikace Strom
  ukazuje body nové verze výzkumu ve svém okně „Co je nového“.

## 1.14.0

*11. 10. 2026 · patří k aplikaci Strom 3.11.0.*

- **Podmínky každého archivu.** strom dodržuje, jak daleko každý archiv dovoluje automatický přístup: povoleno,
  omezeně, jen ručně, nebo vůbec. Kde podmínky nejsou jasné, rozhodne jednou člověk. Odmítnutí archiv na den odloží.
- **Co čeká, po místech.** Věci pro člověka jsou seřazené podle druhu a seskupené podle toho, kde se vyřizují: jeden
  archiv, jeden úřad, rodina, jeden web. Dopis nebo dotaz jde označit jako odeslaný.
- **Čtení starého písma.** Snímky ve velikosti, jakou každý pohled potřebuje, čtenář snímků na modelu, který si člověk
  zvolil, a čtení vyladěné na vlastních doložených záznamech výzkumu.
- **S aplikací Strom 3.11.0.** Rozpor mezi úpravou v aplikaci a záznamem se rozhoduje v aplikaci; hypotézy ukazují, co
  by která varianta spojila.
- **Menší podklady pro agenta, které vědí víc**, a míra uvažování je volbou člověka (`model.effort`).
- **`strom grep`** prohledává podklady, poznámky a výstupy výzkumu, i bez ohledu na diakritiku.
