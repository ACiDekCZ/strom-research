# Co je nového ve Strom výzkumu

[English](CHANGELOG.md) · Čeština · [Deutsch](CHANGELOG.de.md)

Změny každé verze ve zkratce. Úplné poznámky a instalační řádky jsou na
[GitHub Releases](https://github.com/ACiDekCZ/strom-research/releases) (anglicky).

## 1.22.0

*Připravuje se: bety do 1.22.0-beta.5. Oddíl bude úplný s vydáním.*

- **Jméno jednou v tom, co čeká.** Úkol k materiálu poslanému z aplikace Strom jmenoval ve widgetu a na stránce
  telefonu každého člověka dvakrát (podruhé v hranatých závorkách) a jeho text bez jmen nechal prázdné závorky; menu,
  `strom plan`, aplikace Strom i soubor GEDCOM ukazovaly jméno s jeho ID zopakované. Každé teď jméno řekne jednou.
- **Widget otevře správný výzkum.** Při několika stromech stejného jména v aplikaci Strom mohl widget na ploše Macu
  otevřít jiný z nich; teď otevře strom svého výzkumu.
- **Mnohem menší logy sezení.** Logy sezení a čtenářů už neuchovávají obrázky, na které se agent díval (jen jejich
  velikost a cestu k náhledu), takže jsou o 95–99 % menší.
- **Úklid, který stačí.** `strom tidy` zvládne logy jakékoli velikosti. Náhledy skenů, přerušená stahování a další,
  co strom umí vyrobit znovu, se uklízejí i bez souhlasu; logy se pak jen zmenší, nikdy nesmažou. Po odmítnutí přijde
  otázka ještě jednou, když `.strom` výrazně přeroste samotný výzkum.
- **Archiv, který neodpovídá, zastaví smyčku agenta.** `strom fetch` řekne, kdy to zkusit znovu a co dělat mezitím;
  stejný dotaz ve stejném sezení skončí hned (exit 8) a nic neodešle. Úkol, jehož archiv má pauzu, počká mimo frontu
  (plán ho ukáže odložený do té doby) a `strom run --loop` do té doby počká, místo aby pouštěl sezení bez práce.
- **Čtenáři nečekají na umlklou službu.** Čtenář, jehož agent po opakovaném pokusu služby zmlkne, se jednou obnoví
  tam, kde skončil; když mlčí dál, hned skončí. Takový výpadek už nezmenšuje dávky čtení.
- **Brána týdne předplatného pustí víc sezení za sebou.** Když jednou čeká na náskok, pustí znovu až se dvěma body navíc
  (při 15: 17), místo jednoho sezení po každém čekání.
- **Co předek zažil.** Události v místech stromu – dějiny kraje ze stránek, které strom sám stáhl a ověřil, místní
  události z přečtených záznamů – ukáže aplikace Strom; úvodní nastavení ho nabízí zapnuté, instalace nastavená dřív
  zůstává, jak je, samo se nic nezapne. Zapnout ho může jen člověk; dokud je vypnuté, nic se nehledá. Po zapnutí se místa zmapují hned v dalším sezení a regiony se
  prohledávají průběžně mezi sezeními rodinného výzkumu: zhruba každé 5. sezení (výchozí), každé 10., nebo jen když
  není co jiného (`strom config set experiments.historyPace`, úvodní nastavení, Nastavení); kdy, řekne `strom plan`.
  Nejdřív regiony s nejvíc osobami, země před státem nad ní.

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
