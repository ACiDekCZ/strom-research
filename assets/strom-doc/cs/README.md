# Jak Strom funguje

**Čeština** · [English](../en/README.md) · [Deutsch](../de/README.md) · [Polski](../pl/README.md)

Podle čeho rozhoduje výzkum (agent a příkaz `strom`) a aplikace Strom: pravidla, přesné hranice, pořadí a místo,
kde se co ovládá. Pro genealogy a pokročilé výzkumníky. Každá kapitola a každé pravidlo má trvalé číslo, na které
jde odkazovat (např. R2.3). Pojmy vysvětluje [rejstřík pojmů](../REJSTRIK.md), všechna čísla jsou v
[rejstříku čísel](../CISLA.md).

Části R (výzkum), A (aplikace) a S (aplikace a výzkum spolu) jsou schválené a jejich čísla jsou trvalá.

## R Výzkum

- [R1 Výzkum v kostce](R1-research-in-brief.md): jak výzkum pracuje jako celek, na jedné stránce
- [R2 Linie a fronta](R2-lines-and-queue.md): na čem agent pracuje a v jakém pořadí
- [R3 Ověřování a citace](R3-verification-and-citation.md): stupně jistoty, co musí platit pro Doložené, prameny a vodítka
- [R4 Místa](R4-places.md): ztotožnění míst, názvy a příslušnost, co rozhoduje člověk
- [R5 Rozpory](R5-conflicts.md): jak rozpor vzniká, kdo ho rozhoduje, co agent nepřepíše
- [R6 Čeká na vyřízení](R6-awaiting-action.md): co výzkum potřebuje od člověka a kde se to vyřizuje
- [R7 Kdy a jak dlouho agent pracuje](R7-when-the-agent-works.md): sezení, časový limit, podmínka běhu, limit předplatného
- [R8 Hledání a čtení záznamů ve skenech](R8-reading-scans.md): kniha, snímky přes stahovač, čtenáři, vlastní čtení, zápis nálezu a jistota
- [R9 Archivy: co smí agent a co udělá člověk](R9-archives.md): druhy archivů, svolení, prohlížeč agenta, čekání na snímky, co udělá člověk
- [R10 Osoby: ztotožnění, jména a hypotézy](R10-people-and-hypotheses.md): jmenovci, sloučení dvou záznamů, hypotézy, rodina mimo strom, jména osoby
- [R11 Podklady od uživatele](R11-material-from-the-user.md): soubory a texty od uživatele, doklad a vodítko, převzatý rodokmen, dávka z aplikace
- [R12 Kde agent pracuje a co strom hlídá](R12-where-the-agent-works.md): terminál, aplikace Claude, ChatGPT (Codex) a OpenCode, Antigravity a Grok Build, samostatný běh: co strom kde hlídá a co udělá člověk
- [R13 Nahlásit problém: `strom error`](R13-reporting-a-problem.md): jeden soubor ZIP k odeslání, co v něm je a co ne, který problém a jaký příkaz, údaje osob jen se souhlasem, agent a nahlášení problému
- [R14 Pečeť a celistvost výzkumu](R14-seal-and-integrity.md): co nesedí s pečetí a cesty dál (`strom repair`, `strom seal adopt`, `strom seal accept`), přijetí výzkumu tak, jak je, když se ztratila jeho historie, historie starší než výzkum, `strom repair` se ptá člověka a `strom repair undo`

## A Aplikace Strom

- [A1 Aplikace v kostce](A1-the-app-in-brief.md): jak aplikace pracuje jako celek, na jedné stránce
- [A2 Načtení rodokmenu (GEDCOM)](A2-loading-a-family-tree.md): co se ze souboru GEDCOM načte, co ne, QUAY, značky `_STROM`, opakovaný import
- [A3 Doložení v aplikaci](A3-evidence-in-the-app.md): prameny, citace, výřezy, přílohy, materiály a kde chybí doklady
- [A4 Rody a příjmení](A4-surnames-and-families.md): rod a zakladatel, přivdaní, ženské tvary příjmení, hledání jmen
- [A5 Kontrola stromu](A5-tree-check.md): co aplikace ve stromu hlídá, s jakými prahy, a Není chyba
- [A6 Pohledy a výběr osob](A6-views.md): Rodina, Potomci, Časová osa, Vějíř, Mapa, rod v pohledu a Tabulka
- [A7 Kniha, stránky a export](A7-book-pages-and-export.md): kdo je žijící, ochrana žijících, kniha rodu, stránky, uložené HTML
- [A8 Sloučení stromů](A8-merging-trees.md): sloučení souboru, stromu nebo pohledu do nového stromu, párování osob
- [A9 Ovládání aplikace](A9-using-the-app.md): kde co je, čitelné názvy prvků, úpravy při sledování výzkumu, agent v aplikaci

## S Aplikace a výzkum spolu

- [S1 Propojení aplikace a výzkumu](S1-connecting-app-and-research.md): most výzkumu, druhy stromů, sledování živě, verze
- [S2 Úpravy z aplikace ve výzkumu](S2-edits-from-the-app.md): kdy a co se posílá, co výzkum zapíše a co nepřijme
- [S3 Co ví výzkum](S3-what-the-research-knows.md): rozpory, hypotézy, prohledáno a Nad osobou v aplikaci
- [S4 Výzkum řízený z aplikace](S4-research-from-the-app.md): panel a přehled výzkumu, fronta, linie, akce do terminálu
- [S5 Telefon](S5-phone.md): stránka výzkumu v telefonu, párování, fotky po dávkách
- [S6 Strom z jiného programu](S6-tree-from-another-program.md): rodokmen z MyHeritage, Gramps, FamilySearch a programů pro Windows: co se načte, značky spolehlivosti, údaje z rodokmenu jako vodítka, karta Co teď, zálohy, export zpět, opakovaný import
- [S7 Spolehlivost údajů a ověření podle originálů](S7-reliability-and-verification.md): značky u údajů a na kartičce, Ověřit u údaje, u osoby a ve stromu, ověřování ve frontě výzkumu, Potvrdit podle skenu, co jde s mostem a bez něj

Licence: [CC BY 4.0](../LICENSE). Texty je možné sdílet a upravovat s uvedením zdroje.
