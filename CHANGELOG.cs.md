# Co je nového ve Strom výzkumu

[English](CHANGELOG.md) · Čeština · [Deutsch](CHANGELOG.de.md)

Změny každé verze ve zkratce. Úplné poznámky a instalační řádky jsou na
[GitHub Releases](https://github.com/ACiDekCZ/strom-research/releases) (anglicky).

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
