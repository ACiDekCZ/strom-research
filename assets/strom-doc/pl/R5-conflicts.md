<a id="R5"></a>
# R5 Sprzeczności

Jak w badaniu powstaje sprzeczność, kto ją rozstrzyga, czego agent nie może nadpisać oraz gdzie sprzeczność się
pokazuje i gdzie się ją rozstrzyga. Opisuje badanie 1.25.2 i aplikację Strom 3.21.2.

<a id="R5.1"></a>
## R5.1 Sprzeczność zapisuje, że źródła się nie zgadzają

Gdy akty o jednej osobie się różnią (imię, data, wiek), agent nie wybiera po cichu jednego z nich. Zapisuje
sprzeczność: oba twierdzenia ze źródłami i pytanie, które trzeba rozstrzygnąć. Sprzeczność pozostaje otwarta, dopóki
ktoś jej nie rozstrzygnie z uzasadnieniem ([R5.3](#R5.3)).

- **Granice:**
  - sprzeczność ma co najmniej 2 twierdzenia i dotyczy co najmniej jednej osoby lub innego zapisu;
  - danę, której dotyczy, zapisuje się znacznikiem GEDCOM (BIRT, DEAT, NAME, SEX…). Aplikacja pokazuje wtedy
    sprzeczność przy tej danej;
  - sprzeczność powstaje także wtedy, gdy dwa niezależne odczyty tej samej komórki się różnią (zob.
    [R3](R3-verification-and-citation.md));
  - co by rozstrzygnęło sprzeczność, zapisuje się jako zadanie do sprzeczności;
  - otwartą sprzeczność przy osobie z udokumentowanymi danymi kontrola drzewa zgłasza jako ostrzeżenie.
- **Obsługa:** terminal: `strom conflict add "<otázka>" --about P… --fact BIRT --claim "S…: …" --claim "S…: …"`,
  `strom conflict list [--about P…] [--all]`, `strom conflict show X…`, zadanie do sprzeczności
  `strom task add … --about X…`, kontrola `strom check`.
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:assets/method/recording.md:69-85 · assets/method/core.md:38-41 „Nothing is deleted“ · assets/method/verify.md:11-12 · src/commands/analysis.ts:470-512 conflict add, :601 list, :626 show · src/core/check.ts:98 open-conflict -->

<a id="R5.1.1"></a>
### R5.1.1 Inni rodzice oznaczają dwie osoby, nie sprzeczność

Dwa akty, które przy tym samym imieniu podają innych rodziców (inną matkę), opisują **dwie osoby**. Dotyczy to także
tego samego domu i tego samego imienia ojca. Różnicy nie tłumaczy się błędem pisarza i nie rozstrzyga się jej
większością aktów.

- **Granice:** „Czy to ta sama kobieta?” to hipoteza, nie sprzeczność. Jedną osobą ze sprzecznością jest to dopiero
  wtedy, gdy udokumentuje to inny akt. Zmyślony przykład: dwa chrzty Marie Vlkovej w tej samej miejscowości, raz
  z matką Horákovą, raz z inną matką. To dwie Marie i hipoteza, czy chodzi o jedną.
- **Obsługa:** terminal: `strom hypothesis add`.
- **Obowiązuje od:** badanie 1.0.0

<!-- zdroj: research:assets/method/core.md:15-22 „A namesake is not your person“ · assets/method/recording.md:74-76 -->

<a id="R5.2"></a>
## R5.2 Zmiana z aplikacji przy danej udokumentowanej aktem staje się sprzecznością

Zmiany wysłane z aplikacji Strom badanie zapisuje tak, aby nic, na czym się opiera, nie zniknęło. Zmiana danej, którą
udokumentował akt, nie nadpisuje więc danej. Powstaje sprzeczność między wartością z aplikacji a wartością badania.

- **Granice:** co dzieje się ze zmianą z aplikacji:
  1. nowa dana lub osoba: zapisuje się jako **Wskazówka** ze źródłem „Zmiany w aplikacji Strom ({dzień})”;
  2. zmiana danej, której akt nie dokumentuje: dana zostaje poprawiona (z powodem);
  3. uściślenie danej udokumentowanej aktem (miejsce tam, gdzie go nie było, dzień do roku, dokładniejsze miejsce):
     zostaje dopisane do danej, bez sprzeczności;
  4. inna zmiana danej udokumentowanej aktem: **sprzeczność**. Tak samo przy imieniu, tytule przed nazwiskiem i po
     nazwisku oraz płci;
  5. dziecko przypisane do innych rodziców niż ci, przy których badanie prowadzi je jako urodzone: zawsze sprzeczność
     „rodzice”;
  6. osoba usunięta w jednej kopii aplikacji i w międzyczasie zmieniona gdzie indziej (w innej kopii lub w badaniu):
     sprzeczność, czy zostanie w drzewie.
- Dana udokumentowana aktem to dana w stanie **Udokumentowane** lub **Prawdopodobne**, która cytuje źródło inne niż
  drzewo genealogiczne, pamięć rodzinna lub własny tekst autora.
- Do rozstrzygnięcia w aplikacji zostaje wartość z aplikacji, badanie ma w tym miejscu swoją.
- Ta sama zmiana wysłana ponownie nie zakłada nowej sprzeczności. Zmiana zmieniona inaczej tylko nadpisuje stronę
  aplikacji w otwartej sprzeczności.
- **Obsługa:** aplikacja: po wysłaniu **Zapisano, {n} sprzeczności do rozstrzygnięcia** i **Pokaż**. Terminal: wydruk
  `strom sync` przy każdej zmianie podaje **sprzeczność do rozstrzygnięcia (badanie ma to z aktu)** albo
  **sprzeczność do rozstrzygnięcia (badanie podaje innych rodziców)**. Wysłanie można cofnąć: `strom sync undo I…`.
- **Obowiązuje od:** badanie 1.5.0. Uściślenie bez sprzeczności i sprzeczność rodziców od 1.12.0, sprzeczność osoby
  usuniętej od 1.20.0.

<!-- zdroj: research:src/core/sync.ts:1-19, recordBacked :2238, výběr akce :2406-2520 (refine :2511, addsTo :3475), parentsConflict :2848, openConflict :3486, conflictOfEdit :4888 · src/core/conflicts.ts:19 isEditConflict · cs.json ui.sync.do.conflict, ui.sync.do.parents, ui.sync.do.refine, ui.sync.source.app.day · app:strings.ts sync.flyConflict, sync.showConflicts, sync.writtenConflictsSub · CHANGELOG.cs.md 1.20.0 -->

<a id="R5.2.1"></a>
### R5.2.1 Kiedy obowiązuje zmiana z aplikacji

Opcja drzewa wyznacza, co dzieje się ze zmianą danej udokumentowanej aktem:

- **sprzeczność do rozstrzygnięcia** (domyślnie): badanie trzyma wartość z aktu i zakłada sprzeczność;
- **obowiązuje zmiana z aplikacji:** dana z aktu zostaje wycofana z powodem i obowiązuje zmiana. Nic się nie usuwa,
  w historii zostaje.
- **Granice:** Archiwum Strom i badanie, które czeka na swojego agenta, przyjmują zmiany z aplikacji zawsze jako
  obowiązujące. Sprzeczność rodziców i sprzeczność osoby usuniętej powstają także tam.
- **Obsługa:** terminal: `strom config set sync.edits conflict|user`. Opcja obowiązuje dla jednego drzewa. Włączyć
  **obowiązuje zmiana z aplikacji** może tylko człowiek: strom pyta „Czy zmiany w aplikacji Strom mają mieć
  pierwszeństwo przed tym, co mówi zapis?”.
- **Obowiązuje od:** badanie 1.5.0; Archiwum Strom i pytanie do człowieka od 1.12.0.

<!-- zdroj: research:v1.25.2 src/core/config.ts:283 sync.edits · src/commands/setup.ts:1163-1167 syncDecisions requireHuman · src/core/sync.ts:2283-2285 mirror · src/core/state.ts:44 actsAsArchive · cs.json ui.sync.mode.conflict, ui.sync.mode.user, ui.sync.edits.archive, ui.consent.edits.user -->

<a id="R5.3"></a>
## R5.3 Kto rozstrzyga sprzeczność

Sprzeczność między źródłami rozstrzyga agent, gdy źródła pozwalają na wniosek. Sprzeczność ze zmiany w aplikacji
czeka na człowieka. W Archiwum Strom i w badaniu, które czeka na swojego agenta, wszystkie sprzeczności rozstrzyga
człowiek. Każde rozstrzygnięcie ma wniosek i uzasadnienie: który dowód przeważył nad którym.

- **Granice:**
  - rozstrzygnięcie bez wniosku lub bez uzasadnienia się nie zapisuje;
  - przy rozstrzygnięciu zapisuje się, kto rozstrzygnął: użytkownik (terminal bez agenta, odnośnik z aplikacji) lub
    agent (jego sesja). Z menu i z odnośnika uzasadnienie kończy się słowami „(decyzja użytkownika)”;
  - człowiek może rozstrzygnąć także sprzeczność między źródłami: wybiera twierdzenie, które obowiązuje, albo pisze
    własny wniosek;
  - rozstrzygniętą sprzeczność można rozstrzygnąć ponownie tylko z powodem. Wcześniejsze rozstrzygnięcie zostaje
    w notatce sprzeczności („wcześniej rozstrzygnął użytkownik…”, „wcześniej rozstrzygnięto w badaniu…”).
- **Obsługa:** terminal: `strom conflict resolve X… --resolution "…" --reasoning "…"`, ponownie z `--reason "…"`.
  Gdzie się rozstrzyga w menu i w aplikacji: [R5.6](#R5.6).
- **Obowiązuje od:** badanie 1.0.0. Drugie rozstrzygnięcie tylko z powodem od 1.6.0, zapis, kto rozstrzygnął,
  od 1.14.0.
- **Od badania 1.26.0:**
  - sprzeczność ze zmiany rozstrzyga tylko człowiek. Agentowi badanie rozstrzygnięcie odrzuca, dopóki człowiek mu go
    nie zostawi (`strom conflict leave X…`, w aplikacji **Zostaw agentowi**); `strom conflict leave` jest tylko dla
    człowieka;
  - sprzeczności ze zmian, które agent rozstrzygnął wcześniej, otwiera ponownie poprawka `strom fixes show|run|undo
    edit-decisions`. Rozstrzygnięcie agenta zostaje w notatce sprzeczności, dane się nie zmieniają. Poprawkę uruchamia
    tylko człowiek w terminalu, w Archiwum Strom jej nie ma. Dopóki nie zostanie wykonana, `strom check` zwraca uwagę
    na takie sprzeczności.

<!-- zdroj: research:assets/method/recording.md:76-78 · src/commands/analysis.ts:515-598 conflict resolve (by :561, poznámka „earlier decided“ :572-573, zápis :581) · src/core/conflicts.ts:105-113 againAllowed conflict.decided · src/core/conflicts.ts:27 conflictsToDecide · src/cli/context.ts:577 actor · cs.json ui.link.conflict.by, ui.conflict.earlier.* · 1.26.0: src/commands/analysis.ts:525, :572 conflict.users, :625 conflict leave (commit 1189532f) · src/commands/fixes.ts edit-decisions, strom check agent-decided-edit (commit 740e1893) -->

<a id="R5.3.1"></a>
### R5.3.1 Sprzeczność ze zmiany rozstrzyga się stroną

Sprzeczność ze zmiany w aplikacji ma dwie strony: wartość z aplikacji i wartość badania. Rozstrzyga się ją wyborem
strony.

- **Wartość z aplikacji:** zapisuje się do danej. Dana z aktu zostaje wycofana z powodem i pozostaje w historii.
  Wartość z aplikacji stoi obok jako **Możliwe**. Wskazówkę poprawia się bezpośrednio.
- **Wartość badania:** dana w badaniu zostaje bez zmian. Aplikacja dostaje wartość badania po wczytaniu jego wersji
  (wcześniej zapisuje się kopia zapasowa).
- **Granice:** wniosek, który dokładnie zgadza się z wartością jednej strony, obowiązuje jako wybór tej strony.
  Wniosek, który nie odpowiada żadnej stronie, zamyka sprzeczność, ale danej nie zmienia; wydruk podaje, jak przyjąć
  wartość z aplikacji. Sprzeczność rodziców: wartość z aplikacji przenosi dziecko do rodziców z aplikacji.
- **Obsługa:** terminal: `strom conflict resolve X… --take user|research --reasoning "…"`.
- **Obowiązuje od:** badanie 1.12.0

<!-- zdroj: research:src/core/sync.ts:4771-4800 takeSide · src/commands/analysis.ts:543-550 (strana podle závěru), :596 ui.conflict.left · cs.json ui.conflict.left · app:strings.ts conflict.keepNote, conflict.takeNote -->

<a id="R5.4"></a>
## R5.4 Decyzja człowieka obowiązuje

Co rozstrzygnął człowiek (w aplikacji, odnośnikiem z niej lub w terminalu), obowiązuje. Agent rozstrzyga to ponownie
tylko na podstawie źródła, którego rozstrzygnięcie jeszcze nie ważyło, i z powodem. Nowy odczyt tego samego aktu
niczego nie zmienia.

- **Granice:**
  - zważone źródła to źródła wszystkich twierdzeń sprzeczności, a przy sprzeczności ze zmiany także źródła zmienionej
    danej;
  - ta sama zasada obowiązuje dla nowej sprzeczności o tej samej danej tej samej osoby: agent zakłada ją tylko
    z nowym źródłem i powodem;
  - raz przyjętej strony nie można przyjąć ponownie, daną zmienia się wtedy poleceniami dla danych. Wyjątek: czy
    osoba zostanie w drzewie, można rozstrzygnąć ponownie w obu kierunkach;
  - rozstrzygnięcie agenta agent może rozstrzygnąć ponownie z powodem, bez nowego źródła.
- **Obsługa:** terminal: `strom conflict resolve X… --resolution "…" --reasoning "…" --source S… --reason "<co
  nový záznam ukazuje>"`. Bez nowego źródła strom odmawia i proponuje zapytać człowieka.
- **Obowiązuje od:** badanie 1.14.0

<!-- zdroj: research:src/core/conflicts.ts:89-98 weighedSources, :100-132 againAllowed (conflict.taken, conflict.user-decided) · src/commands/analysis.ts:495-509 conflict add · assets/method/recording.md:78-82 -->

<a id="R5.5"></a>
## R5.5 Czego agent nie nadpisze

Niektóre sprawy są słowem człowieka. Agent ich nie nadpisuje, nawet gdy znajdzie coś innego. Różnicę zapisuje obok
albo pyta.

- **Transkrypcja użytkownika:** transkrypcję aktu z aplikacji agent sam czyta na ślepo. Zgodność: notatka przy
  źródle, że przeczytało je także badanie. Różnica: sprzeczność z oboma odczytami. Transkrypcji użytkownika się nie
  nadpisuje i nie traktuje jako udokumentowanej. To zasada metodyki agenta.
- **Zatwierdzona opowieść:** po zatwierdzeniu przez człowieka jest zablokowana. Nową wersję agent zapisuje obok,
  a ta czeka na człowieka: zatwierdzić zamiast starej albo zostawić starą.
- **Ręczne położenie miejsca:** położenie umieszczone ręcznie się nie zmienia. Gdy akty mówią inaczej, w **Czeka na
  decyzję** pojawia się pytanie **Sprzeczne położenie** ([R4.3](R4-places.md#R4.3)).
- **Decyzja człowieka w sprzeczności:** [R5.4](#R5.4).
- **Obsługa:** terminal: `strom story approve P…`, `strom story discard P…`; menu **Co czeka**.
- **Obowiązuje od:** transkrypcja użytkownika badanie 1.12.0, zatwierdzona opowieść 1.10.0, ręczne położenie 1.25.0.
- **Od badania 1.26.0:** `strom story approve|discard` uruchamia tylko człowiek. Agentowi badanie odrzuca też zapis
  opowieści od razu jako zatwierdzonej (`strom story set --final`).

<!-- zdroj: research:assets/method/verify.md:19-24 · src/commands/story.ts:94-96, :103 story approve, :121 story discard (1.26.0 person only, story.final) · src/core/placeid.ts:714 personsHand, :805-808 place.manual, :924 · app:strings.ts places.dialog.whoHand, places.waiting.kind.conflict -->

<a id="R5.6"></a>
## R5.6 Gdzie widać sprzeczności i gdzie się je rozstrzyga

W aplikacji sprzeczności widać przy osobie i przy jej danych. Rozstrzygnięcie zapisuje się jednak zawsze w badaniu,
na komputerze, na którym działa badanie. Aplikacja otwiera badanie w terminalu, a ten pyta o potwierdzenie i o powód.

- **Aplikacja – gdzie widać sprzeczność:**
  - menu osoby **Co wie badanie** z liczbą sprzeczności, w oknie dialogowym sekcja **Sprzeczności** (otwarte
    i rozstrzygnięte);
  - panel badania, sekcja **Co wie badanie**: wiersz dla każdej otwartej sprzeczności;
  - w edycji osoby przy polu znacznik **sprzeczność ›**;
  - na karcie osoby znacznik sprzeczności (włącza się w **Na karcie pokazuj → Sprzeczności w źródłach**).
- **Aplikacja – sprzeczność ze zmiany:** karta ze stronami **Z aplikacji** i **W badaniu** oraz opcjami **Zachowaj
  wartość z aplikacji** i **Przyjmij wartość z badania**. Opcja otwiera badanie. Poza komputerem z badaniem karta
  podaje **Rozstrzyga się w terminalu na komputerze z badaniem: strom → Co czeka.**
- **Aplikacja – sprzeczność między źródłami:** „Tutaj różnią się źródła; rozstrzyga się to w badaniu.” Opcje
  **Rozstrzygnij w badaniu** (terminal: **Co jest prawdą?**, twierdzenie lub **Coś innego (własny tekst)**, potem
  **Dlaczego? (co rozstrzyga)**) i **Zostaw agentowi** (rozmowa z agentem; strom uprzedza, że agent pracuje w ramach
  subskrypcji lub kredytu AI). W Archiwum Strom opcji **Zostaw agentowi** nie ma.
- **Terminal:** menu **Co czeka**, grupa **Do rozstrzygnięcia – sprzeczności**, najstarsze najpierw. Opcje
  **Obowiązuje wartość z aplikacji Strom**, **Obowiązuje wartość z badania** (w archiwum **Obowiązuje wartość
  z Archiwum Strom**), **Pozostaw otwartą**. Sprzeczność między źródłami proponuje twierdzenia jak w odnośniku.
- **Granice:** w badaniu z agentem **Co czeka** pokazuje tylko sprzeczności ze zmian w aplikacji. Sprzeczności między
  źródłami są tam tylko w Archiwum Strom i w badaniu, które czeka na agenta. W przeciwnym razie terminal pokazuje je
  tylko w `strom conflict list`. W **Czeka na decyzję** aplikacji sprzeczności nie ma.
- **Obsługa:** zob. wyżej; terminal ponadto `strom conflict show X…`.
- **Obowiązuje od:** aplikacja 3.4.0 (**Co wie badanie**, **sprzeczność ›**, **Rozstrzygnij w badaniu**, **Zostaw
  agentowi**), sekcja w panelu badania i znacznik na karcie od aplikacji 3.5.0. Wybór strony od aplikacji 3.11.0
  z badaniem 1.14.0. Sprzeczności w **Co czeka** od badania 1.20.0.
- **Od badania 1.26.0:**
  - **Zostaw agentowi** aplikacja proponuje także przy sprzeczności ze zmiany; odnośnik najpierw zostawia sprzeczność
    agentowi (`strom conflict leave`);
  - strona wybrana w aplikacji tylko się w terminalu potwierdza, powód jest nieobowiązkowy (**Dlaczego? (co
    rozstrzyga; Enter: bez powodu, 0: bez rozstrzygnięcia)**). Bez powodu zapisuje się „wybrane w aplikacji Strom”;
  - **Co czeka** proponuje opcje słowami aplikacji: **Zachowanie wartości z aplikacji**, **Przyjęcie wartości
    z badania** (w archiwum **Przyjęcie wartości z Archiwum Strom**), **Pozostaw otwartą**.

<!-- zdroj: research:src/core/waiting.ts:127 TERMINAL_ONLY, :443-449 · src/cli/menu-waiting.ts:486-513 decideConflictHere · src/cli/menu-links.ts:510-561 decideConflict, pickClaim · src/commands/links.ts:235-246 · src/core/live.ts:2063 decide.link · src/core/stromapp.ts APP_DECIDES_CONFLICTS="3.11.0" · app:v3.21.2 strings.ts research.knows, research.conflicts, research.conflictTag, research.decide, research.leaveToAgent, conflict.*, cardDensity.cardConflict · ui/person-research-ui.ts:139-150, :178-210 · ui/conflict-decide-ui.ts · research-decide.ts:55 canDecideInApp · 1.26.0: research:cs.json ui.wait.conflict.take.*, ui.link.conflict.whyMaybe, ui.link.conflict.inApp (commit 1189532f) · app:src/research-conflict-card.ts conflictCardView (agent u rozporu z úpravy) -->

<a id="R5.6.1"></a>
### R5.6.1 Co można rozstrzygnąć stroną z aplikacji

Wybór strony aplikacja proponuje tylko przy otwartej sprzeczności ze zmiany, która ma obie strony i dotyczy osoby
badania.

- **Granice:**
  - chodzi o wartość wydarzenia (data, miejsce, wartość) osoby lub pary, imię, tytuł przed nazwiskiem i po
    nazwisku, płeć;
  - co najmniej jedna strona ma wartość; pusta strona pokazuje się jako **(puste)**;
  - sprzeczności rodziców nie można rozstrzygnąć stroną z aplikacji. Aplikacja pokazuje przy niej tylko
    **Rozstrzygnij w badaniu** albo rozstrzyga się ją w terminalu w **Co czeka**;
  - osoba usunięta lub zmieniona w innym oknie: aplikacja pyta **Przywróć do drzewa** / **Zostaw usuniętą** albo
    **Usuń z drzewa** / **Zostaw w drzewie**. Opcja także otwiera badanie w terminalu.
- **Obowiązuje od:** aplikacja 3.11.0 z badaniem 1.14.0

<!-- zdroj: research:src/core/conflicts.ts:48-62 BY_SIDE, sidesOf · app:v3.21.2 research-decide.ts:28-66 DECIDE_FACTS, canDecideInApp · ui/research-removed-ui.ts:97-125 · strings.ts conflict.person.* -->
