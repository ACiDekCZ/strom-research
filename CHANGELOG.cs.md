# Co je nového ve Strom výzkumu

[English](CHANGELOG.md) · Čeština · [Deutsch](CHANGELOG.de.md)

Změny každé verze ve zkratce. Úplné poznámky a instalační řádky jsou na
[GitHub Releases](https://github.com/ACiDekCZ/strom-research/releases) (anglicky).

## 1.18.0

*Připravuje se: bety do 1.18.0-beta.6. Oddíl bude úplný s vydáním.*

- **Fotky z telefonu nastojato.** Fotka otočená podle údaje EXIF se čte tak, jak se má dívat, nastojato; místa na ní
  vyznačená (výřezy, poloviny dvoustrany, uložená část) jsou místa obrázku, jak se ukazuje. Fotka sama zůstává, jak
  byla.
- **Fotky HEIC a dokumenty PDF jdou přečíst.** Fotky HEIC z telefonu a stránky PDF se pro čtení převádějí na JPEG —
  na macOS, Windows i Linuxu — a originál zůstává, jak přišel. Fotka HEIC jde do aplikace Strom jako výřez JPEG.
  Kde obrázek na počítači nic nepřevede, řekne to jedna věta i s tím, co by pomohlo; `strom tidy` převedené obrázky
  po 30 dnech nebo nad 500 MB uklidí.
- **Jeden dokument přečtený naráz.** `strom document read` přečte fotku, sken nebo PDF jednoho dokumentu — zápis
  z matriky, dopis, listinu, náhrobek, rub fotky: přepis slovo od slova, překlad, význam starých slov a zkratek
  a osoby, které jmenuje, i s tím, kdo ze stromu to může být. Nic se nedomýšlí: jméno, které v dokumentu není,
  vypadne — i příjmení, nikdy se nebere od otce ani z jiné rodiny —, co nejde přečíst, je označené; druhý čtenář
  může číst naslepo. Do stromu se z toho nic nezapíše samo. Dokument už přečtený to o sobě řekne, takže se omylem
  nečte podruhé. Dokument čtený znovu se ukazuje pod názvem svého souboru, nikdy pod kódem.
- **Fotky z telefonu.** `strom phone on`, které zapíná jen člověk, pustí k počítači telefon v domácí síti (Wi-Fi
  nebo kabel — nikdy mobilní síť ani VPN). Telefon se jednou spáruje přes QR kód; jeho stránka pak fotí nebo vybírá
  z galerie a posílá fotky celé do stromu výzkumu, s poznámkou a osobou, kterou ukazují — stejně jako „Přidat
  materiály“ v aplikaci Strom. Fotka zůstává v telefonu, dokud ji počítač nemá, takže přerušené spojení nic neztratí.
- **Výzkum sledovaný z telefonu.** Stránka telefonu ukazuje, co výzkum dělá — na čem se teď pracuje, co čeká na
  rozhodnutí, posledních 24 hodin a poslední změny, obnovené každých 10 sekund, dokud je stránka na očích — jen
  k podívání: v telefonu se nic neodpovídá, nespouští ani nerozhoduje. Nedostupný počítač stránka řekne i s posledními
  údaji a jejich časem. Otevře strom, jehož QR kód ji spároval, a jde přidat na plochu jako ikona, která ji otevře
  bez nového párování.
- **Souhlas v jednom jazyce.** Souhlas, který dává jen člověk (rozbalení výzkumu, odebrání stromu, odmítnuté okno),
  zazní celý v jazyce výzkumu, nic z něj nezůstane anglicky.
- **Odmítnutá aktualizace.** Když se `strom update` odmítne, řekne, že se nic nenainstalovalo a která verze zůstává,
  a skončí chybovým kódem; nepovedená instalace se řekne také v jazyce výzkumu.
- **Otázka i v terminálu.** Co otevírá počítač ven, stojí peníze nebo spouští cizí program – Remote Control,
  stahovače bez ptaní, podmínka práce agenta o samotě, hook, vlastní tempo archivu, propojení s telefonem, ladění
  čtení – se v terminálu ptá ano/ne; Enter znamená ne a `--yes` za člověka neodpoví.

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
