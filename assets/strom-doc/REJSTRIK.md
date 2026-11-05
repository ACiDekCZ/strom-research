# Rejstřík pojmů

Pojmy výzkumu a aplikace Strom. U každého pojmu je termín v každém jazyce přesně tak, jak ho říká rozhraní, krátká
definice, genealogický protějšek a čísla pravidel, která ho vysvětlují.

Pojmy části R (výzkum) v abecedním pořadí, pak pojmy částí A a S (aplikace a její spojení s výzkumem) v oddílu na
konci. Všechny mají definice ve všech čtyřech jazycích.

<a id="what-the-research-knows"></a>
### Co ví výzkum

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Co ví výzkum | Dialog osoby a oddíl panelu výzkumu v aplikaci: rozpory, hypotézy a prohledané prameny, které výzkum o osobě vede. |
| en | What the research knows | The person's dialog and a section of the research panel in the app: the conflicts, hypotheses and searched sources the research keeps about the person. |
| de | Was die Forschung weiß | Dialog einer Person und Abschnitt des Forschungsbereichs in der App: Widersprüche, Hypothesen und durchsuchte Quellen, die die Forschung zu der Person führt. |
| pl | Co wie badanie | Okno dialogowe osoby i sekcja panelu badania w aplikacji: sprzeczności, hipotezy i przeszukane źródła, które badanie prowadzi o osobie. |

- **Čísla:** [R5.6](cs/R5-conflicts.md#R5.6), S3, S3.1, S3.2, S3.4, S3.7

<a id="session-time-limit"></a>
### Čas na jeden úkol

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Čas na jeden úkol (terminal, `run.minutes`) | Nejdelší doba jednoho sezení samostatné práce, výchozí 60 minut. Pak strom agenta zastaví a úkol vrátí do fronty. |
| en | Time for one task (ui.alone.minutes) | The longest time of one session of working alone, 60 minutes by default. Then strom stops the agent and returns the task to the queue. |
| de | Zeit für eine Aufgabe | Die längste Dauer einer Sitzung, wenn der Agent allein arbeitet, Standard 60 Minuten. Danach hält strom den Agenten an und bringt die Aufgabe in die Warteschlange zurück. |
| pl | Czas na jedno zadanie | Najdłuższy czas jednej sesji samodzielnej pracy, domyślnie 60 minut. Potem strom zatrzymuje agenta i przywraca zadanie do kolejki. |

- **Čísla:** [R7.2](cs/R7-when-the-agent-works.md#R7.2)

<a id="awaiting-reply"></a>
### Čeká na odpověď

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Čeká na odpověď (`ui.wait.sent.title`, app `waitingPhaseSent`) | Dopis, dotaz na rodinu nebo jiný dotaz označený jako odeslaný. Úkol čeká, až přijde odpověď; do čísla aplikace se nepočítá. |
| en | Waiting for a reply (terminal) · Awaiting a reply (app) | A letter, a request to the family or another request marked as sent. The task waits until the answer comes; it is not counted in the app's number. |
| de | Wartet auf Antwort | Ein Brief, eine Anfrage an die Familie oder eine andere Anfrage, als gesendet markiert. Die Aufgabe wartet, bis eine Antwort kommt; in die Zahl der App zählt sie nicht. |
| pl | Czeka na odpowiedź | List, zapytanie do rodziny lub inne zapytanie oznaczone jako wysłane. Zadanie czeka, aż przyjdzie odpowiedź; do liczby w aplikacji się nie liczy. |

- **Genealogicky:** záznam v korespondenčním deníku výzkumu (correspondence log).
- **Čísla:** [R6.7](cs/R6-awaiting-action.md#R6.7), R6.1.1, R6.4, R6.7.1

<a id="awaiting-action"></a>
### Čeká na vyřízení

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Čeká na vyřízení (app, `research.waiting`) · Co čeká (terminal, `ui.menu.waitlist`) | Jeden seřazený seznam všeho, na co výzkum čeká od člověka: čekající úkoly, otázky archivů, nové verze vyprávění, otázky k místům a v terminálu i rozhodnutí, která jdou jen tam. |
| en | Awaiting action (app) · What waits (terminal) | One ordered list of everything the research waits for from a person: waiting tasks, questions of archives, new versions of stories, questions about places, and in the terminal also the decisions made only there. |
| de | Wartet auf Bearbeitung (app) · Was wartet (terminal) | Eine einzige geordnete Liste von allem, worauf die Forschung vom Menschen wartet: wartende Aufgaben, Fragen der Archive, neue Fassungen von Erzählungen, Fragen zu Orten und im Terminal auch Entscheidungen, die nur dort gehen. |
| pl | Czeka na decyzję (app) · Co czeka (terminal) | Jedna uporządkowana lista wszystkiego, na co badanie czeka od człowieka: czekające zadania, pytania archiwów, nowe wersje opowieści, pytania o miejsca, a w terminalu także decyzje, które załatwia się tylko tam. |

- **Čísla:** [R6.1](cs/R6-awaiting-action.md#R6.1), R6.1.1, R6.4, R6.5, S2.3

<a id="reader"></a>
### Čtenář

| Jazyk | Termín | Definice |
|---|---|---|
| cs | čtenář, čtenáři (terminal, `strom read`) | Samostatný běh agenta s čistým kontextem, který přečte dávku pohledů na snímky a napíše jen svou zprávu. Do výzkumu nezapisuje. |
| en | reader, readers (terminal, `strom read`) | A separate run of the agent with a clean context that reads a batch of views of images and writes only its report. It never writes to the research. |
| de | Leser (terminal, `strom read`) | Ein eigener Lauf des Agenten mit leerem Kontext, der einen Stapel Ansichten von Bildern liest und nur seinen Bericht schreibt. In die Forschung schreibt er nie. |
| pl | czytelnik, czytelnicy (terminal, `strom read`) | Osobne uruchomienie agenta z czystym kontekstem, które odczytuje partię widoków skanów i pisze tylko swój raport. Do badania nie zapisuje. |

- **Čísla:** [R8.3](cs/R8-reading-scans.md#R8.3), R8.3.1, R8.3.3, R8.3.7, R1.7

<a id="reading-until-found"></a>
### Čtení do nálezu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | `strom read --until-found` | Čtení, ve kterém po prvním nahlášeném nálezu nezačne žádný další čtenář. Prohledané jsou jen přečtené snímky; hledání se zapíše jako částečné. |
| en | `strom read --until-found` | A reading in which no further reader starts after the first reported find. Only the images read count as searched; the search is recorded as partial. |
| de | `strom read --until-found` | Eine Lesung, in der nach dem ersten gemeldeten Fund kein weiterer Leser beginnt. Nur gelesene Bilder gelten als durchsucht; die Suche wird als teilweise erfasst. |
| pl | `strom read --until-found` | Odczyt, w którym po pierwszym zgłoszonym znalezisku nie zaczyna żaden kolejny czytelnik. Przeszukane są tylko odczytane skany; wyszukiwanie zapisuje się jako częściowe. |

- **Čísla:** [R8.3.5](cs/R8-reading-scans.md#R8.3.5)

<a id="batch"></a>
### Dávka

| Jazyk | Termín | Definice |
|---|---|---|
| cs | dávka, dávky (terminal, `strom read --batch`) | Pohledy, které čte jeden čtenář: výchozí 10, nejvýš 12. Dvoustrana čtená v půlkách jsou dva pohledy. |
| en | batch (terminal, `strom read --batch`) | The views one reader reads: 10 by default, at most 12. A double page read in halves is two views. |
| de | Stapel (terminal, `strom read --batch`) | Die Ansichten, die ein Leser liest: standardmäßig 10, höchstens 12. Eine in Hälften gelesene Doppelseite sind zwei Ansichten. |
| pl | partia (terminal, `strom read --batch`) | Widoki, które czyta jeden czytelnik: domyślnie 10, najwyżej 12. Rozkładówka czytana w połówkach to dwa widoki. |

- **Čísla:** [R8.3.1](cs/R8-reading-scans.md#R8.3.1), R8.4

<a id="place-history"></a>
### Dějiny místa

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Dějiny místa (app) · Dějiny míst (app, správa) | Doložené události v místě a okolí zhruba do 10 km. Hledají se, jen když je člověk zapne nebo o místo požádá. |
| en | Local history (app) · History of places (app, management) | Documented events in the place and its surroundings up to roughly 10 km. They are looked for only when a person switches them on or asks for the place. |
| de | Ortsgeschichte (app) · Geschichte der Orte (app, Verwaltung) | Belegte Ereignisse am Ort und in der Umgebung bis etwa 10 km. Sie werden nur gesucht, wenn der Mensch sie einschaltet oder um den Ort bittet. |
| pl | Historia miejsca (app) · Historia miejsc (app, zarządzanie) | Udokumentowane wydarzenia w miejscu i okolicy mniej więcej do 10 km. Szuka się ich tylko wtedy, gdy człowiek je włączy lub poprosi o miejsce. |

- **Genealogicky:** místní dějiny (local history) jako kontext.
- **Čísla:** [R4.7](cs/R4-places.md#R4.7), R4.6

<a id="todays-name"></a>
### Dnešní název a starý název

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Dnes · starý název · jiný zápis | První název místa je dnešní úřední název v jazyce země, kde místo dnes leží. Staré názvy a jiné zápisy jsou vedle něj s jazykem a roky. |
| en | Today · old name · other spelling | The first name of a place is today's official name in the language of the country where the place lies today. Old names and other spellings stand beside it with language and years. |
| de | Heute · alter Name · andere Schreibung | Der erste Name eines Ortes ist der heutige amtliche Name in der Sprache des Landes, in dem der Ort heute liegt. Alte Namen und andere Schreibungen stehen neben ihm, mit Sprache und Jahren. |
| pl | Dziś · dawna nazwa · inny zapis | Pierwsza nazwa miejsca to dzisiejsza urzędowa nazwa w języku kraju, w którym miejsce dziś leży. Dawne nazwy i inne zapisy są obok niej z językiem i latami. |

- **Genealogicky:** historické názvy lokality, exonyma.
- **Čísla:** [R4.2](cs/R4-places.md#R4.2)

<a id="finish-session"></a>
### Dokončit a skončit

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Dokončit a skončit (app) · `strom session finish` (terminal) | Žádost, aby agent zapsal, co našel, a sezení zavřel. Další sezení běhu nezačne. |
| en | Finish and stop (app, live.finishSession) | A request that the agent writes what it found and closes the session. No further session of the run starts. |
| de | Abschließen und beenden (app) | Die Bitte, dass der Agent erfasst, was er gefunden hat, und die Sitzung schließt. Eine weitere Sitzung des Laufs beginnt nicht. |
| pl | Dokończ i zakończ (app) | Prośba, aby agent zapisał, co znalazł, i zamknął sesję. Kolejna sesja przebiegu się nie zaczyna. |

- **Čísla:** [R7.3](cs/R7-when-the-agent-works.md#R7.3)

<a id="proven"></a>
### Doložené

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Doložené (app; terminal od výzkumu 1.26.0) · doloženo (terminal 1.25.2) | Nejvyšší stupeň: kód chce citaci z pramene, který není slabý, s primární informací; metodika navíc vlastní čtení původního záznamu, který údaj uvádí přímo. |
| en | Proven (app) · proven (terminal) | The highest degree: the code requires a citation from a source that is not weak, with primary information; the method also requires reading the original record that states the fact directly. |
| de | Belegt (app) · belegt (terminal) | Der höchste Grad: der Code verlangt eine Zitation aus einer Quelle, die nicht schwach ist, mit Primärinformation; die Methodik zusätzlich eine eigene Lesung des ursprünglichen Eintrags, der die Angabe direkt nennt. |
| pl | Udokumentowane (app) · udokumentowane (terminal) | Najwyższy stopień: kod wymaga cytatu ze źródła, które nie jest słabe, z informacją pierwotną; metodyka ponadto własnego odczytu aktu oryginalnego, który podaje daną wprost. |

- **Genealogicky:** prokázaný závěr z přímého důkazu v původním prameni s primární informací.
- **Čísla:** [R3.2](cs/R3-verification-and-citation.md#R3.2), R3.1, R3.5

<a id="queue"></a>
### Fronta

| Jazyk | Termín | Definice |
|---|---|---|
| cs | fronta | Otevřené úkoly všech běžících linií v pořadí, v jakém je agent bere. |
| en | queue | The open tasks of all running lines, in the order the agent takes them. |
| de | Warteschlange | Die offenen Aufgaben aller laufenden Linien in der Reihenfolge, in der der Agent sie nimmt. |
| pl | kolejka | Otwarte zadania wszystkich trwających linii w kolejności, w jakiej bierze je agent. |

- **Čísla:** [R2.2](cs/R2-lines-and-queue.md#R2.2), R2.2.1, R2.2.2, R2.2.3, R2.4

<a id="browser-only-archive"></a>
### Jen přes prohlížeč člověka

| Jazyk | Termín | Definice |
|---|---|---|
| cs | jen přes prohlížeč člověka (terminal, `strom doctor`) · archiv jen přes prohlížeč (app, řádek **Prohlížeč**) | Archiv, kam smí jen prohlížeč člověka: podle podmínek archivu nebo podle robots.txt, který zakazuje celý web. Žádné stažení webu ani stahovač; nejvýš prohlížeč agenta se svolením „přes prohlížeč“, jinak snímky uloží člověk. |
| en | only through a person's browser (terminal) · browser-only archive (app, row **Browser**) | An archive only a person's browser may enter: by the archive's terms or by a robots.txt that closes the whole site. No web fetch and no downloader; at most the agent's browser with the permission "through the browser", otherwise a person saves the images. |
| de | nur über den Browser eines Menschen (terminal) · Archiv, das nur im Browser zugänglich ist (app, Zeile **Browser**) | Ein Archiv, das nur der Browser eines Menschen betreten darf: nach den Bedingungen des Archivs oder nach einer robots.txt, die die ganze Website sperrt. Kein Webabruf und kein Downloader; höchstens der Browser des Agenten mit der Erlaubnis „über den Browser“, sonst speichert ein Mensch die Bilder. |
| pl | tylko przez przeglądarkę człowieka (terminal) · archiwum dostępne tylko przez przeglądarkę (app, wiersz **Przeglądarka**) | Archiwum, do którego wolno wejść tylko przeglądarce człowieka: według warunków archiwum albo według robots.txt, który zamyka całą witrynę. Bez pobierania stron i bez programu pobierającego; najwyżej przeglądarka agenta za zgodą „przez przeglądarkę”, w przeciwnym razie skany zapisuje człowiek. |

- **Čísla:** [R9.1](cs/R9-archives.md#R9.1), R9.2, R9.4, R9.8, R9.10

<a id="terminal-only"></a>
### Jen tady v terminálu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Jen tady v terminálu (v aplikaci Strom nejsou) (`ui.wait.only.head`) | Položky, které aplikace nedostane a které se vyřizují jen v terminálu: stromy z aplikace, čtení snímků, rozpory a mírnější podmínky archivu. |
| en | Only here in the terminal (not in the Strom app) | Items the app does not get and that are dealt with only in the terminal: trees from the app, the reading of scans, conflicts and milder terms of an archive. |
| de | Nur hier im Terminal (nicht in der Strom-App) | Einträge, die die App nicht bekommt und die nur im Terminal erledigt werden: Stammbäume aus der App, das Lesen der Scans, Widersprüche und mildere Bedingungen eines Archivs. |
| pl | Tylko tutaj w terminalu (nie ma ich w aplikacji Strom) | Pozycje, których aplikacja nie dostaje i które załatwia się tylko w terminalu: drzewa z aplikacji, odczyt skanów, sprzeczności i łagodniejsze warunki archiwum. |

- **Čísla:** [R6.1.1](cs/R6-awaiting-action.md#R6.1.1), R6.3, R6.5

<a id="namesake"></a>
### Jmenovec

| Jazyk | Termín | Definice |
|---|---|---|
| cs | jmenovec | Jiná osoba stejného jména. Zápis patří hledané osobě, jen když ji určí víc než jméno: rok, místo, dům, povolání, manžel nebo manželka, rodiče. |
| en | namesake | Another person of the same name. A record belongs to the person sought only when more than the name identifies them: year, place, house, occupation, spouse, parents. |
| de | Namensvetter | Eine andere Person gleichen Namens. Ein Eintrag gehört der gesuchten Person nur, wenn mehr als der Name sie bestimmt: Jahr, Ort, Haus, Beruf, Ehepartner, Eltern. |
| pl | imiennik | Inna osoba o tym samym imieniu i nazwisku. Wpis należy do poszukiwanej osoby tylko wtedy, gdy wskazuje ją coś więcej niż imię: rok, miejsce, dom, zawód, małżonek, rodzice. |

- **Genealogicky:** identifikace osoby (identity), rozlišení jmenovců.
- **Čísla:** [R10.1](cs/R10-people-and-hypotheses.md#R10.1), R10.2, R10.3

<a id="subscription-limit"></a>
### Limit předplatného

| Jazyk | Termín | Definice |
|---|---|---|
| cs | limit předplatného | Hranice plánu agenta, na kterou agent v sezení narazil. Běh skončí a nečeká. |
| en | subscription limit (ui.run.stop.limit) | The limit of the agent's plan that the agent ran into during a session. The run ends and does not wait. |
| de | Limit des Abonnements | Die Grenze des Plans des Agenten, auf die der Agent in einer Sitzung gestoßen ist. Der Lauf endet und wartet nicht. |
| pl | limit subskrypcji | Granica planu agenta, na którą agent natrafił w sesji. Przebieg się kończy i nie czeka. |

- **Čísla:** [R7.6](cs/R7-when-the-agent-works.md#R7.6)

<a id="line"></a>
### Linie výzkumu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | linie výzkumu, linie | Jeden cíl výzkumu: předkové osoby, potomci osoby, nebo jedna otázka. Každý úkol patří k některé linii. |
| en | line (terminal) · direction (app) | One goal of the research: the ancestors of a person, the descendants of a person, or one question. Every task belongs to some line. |
| de | Richtung (app, terminal: `ui.more.research`) · Linie (terminal, Arbeit außerhalb der Linien) | Ein Ziel der Forschung: die Vorfahren einer Person, die Nachkommen einer Person oder eine Frage. Jede Aufgabe gehört zu einer Linie. |
| pl | linia | Jeden cel badania: przodkowie osoby, potomkowie osoby albo jedno pytanie. Każde zadanie należy do którejś linii. |

- **Genealogicky:** cíl výzkumu (research objective) ve smyslu GPS.
- **Čísla:** [R2.1](cs/R2-lines-and-queue.md#R2.1), R2.1.1, R2.1.2, R2.1.3, R2.1.4, S3.3

<a id="source-transcriptions-setting"></a>
### Moje přepisy pramenů

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Moje přepisy pramenů: Vodítko (výchozí) · Doloženo (`treeSettings.transcripts`); Přepis ověřen (`sources.verified`) | Nastavení stromu, jak výzkum bere přepisy z aplikace: jako vodítko, nebo jako první čtení záznamu (údaj pak Pravděpodobné). |
| en | My source transcriptions: Lead · Evidence; Transcription verified | A tree setting for how the research takes transcriptions from the app: as a lead, or as the first reading of the record (the fact is then Probable). |
| de | Meine Quellenabschriften: Hinweis · Beleg; Abschrift geprüft | Einstellung des Stammbaums, wie die Forschung Abschriften aus der App nimmt: als Hinweis oder als erste Lesung des Eintrags (die Angabe ist dann Wahrscheinlich). |
| pl | Moje transkrypcje źródeł: Wskazówka · Udokumentowane; Transkrypcja zweryfikowana | Ustawienie drzewa, jak badanie traktuje transkrypcje z aplikacji: jako wskazówkę albo jako pierwszy odczyt aktu (dana jest wtedy Prawdopodobne). |

- **Čísla:** [R3.5.1](cs/R3-verification-and-citation.md#R3.5.1), R3.8

<a id="in-hand"></a>
### Náskok

| Jazyk | Termín | Definice |
|---|---|---|
| cs | náskok (podmínka Claude usage) | O kolik bodů je využití týdne pod uplynulou částí týdne (uplynulo − využito). |
| en | in hand | By how many points the week's usage is below the part of the week passed (passed − used). |
| de | Vorsprung | Um wie viele Punkte die Nutzung der Woche unter dem vergangenen Teil der Woche liegt (vergangen − genutzt). |
| pl | zapas | O ile punktów wykorzystanie tygodnia jest poniżej upłyniętej części tygodnia (upłynęło − wykorzystano). |

- **Čísla:** [R7.5](cs/R7-when-the-agent-works.md#R7.5), R7.5.1, R7.5.2, R7.5.3

<a id="unlocated-place"></a>
### Nedohledané místo

| Jazyk | Termín | Definice |
|---|---|---|
| cs | nedohledáno (terminal) · Neurčeno (app) | Místo, které výzkum nedokázal jistě určit. Zůstane mimo mapu se zápisem, proč a co by rozhodlo. |
| en | not located (terminal) · Not identified (app) | A place the research could not identify with certainty. It stays off the map with a note of why and what would decide. |
| de | nicht gefunden (terminal) · Nicht bestimmt (app) | Ein Ort, den die Forschung nicht sicher bestimmen konnte. Er bleibt ohne Karte, mit einem Eintrag, warum und was entscheiden würde. |
| pl | nie odnaleziono (terminal) · Nieustalone (app) | Miejsce, którego badanie nie zdołało pewnie ustalić. Zostaje poza mapą z zapisem, dlaczego i co by rozstrzygnęło. |

- **Čísla:** [R4.1](cs/R4-places.md#R4.1), R4.1.2

<a id="negative-search"></a>
### Negativní hledání

| Jazyk | Termín | Definice |
|---|---|---|
| cs | záporné hledání (terminal, `tune.negatives.why`); `--result negative` | Zapsané hledání, které v přesně vymezeném rozsahu nic nenašlo. Je výsledkem a brání hledat totéž znovu. |
| en | negative search (terminal) | A written search that found nothing in an exactly defined range. It is a result and prevents searching the same again. |
| de | negative Suche (terminal) | Eine erfasste Suche, die in einem genau abgegrenzten Umfang nichts gefunden hat. Sie ist ein Ergebnis und verhindert, dasselbe noch einmal zu suchen. |
| pl | negatywne wyszukiwanie (terminal) | Zapisane wyszukiwanie, które w dokładnie określonym zakresie niczego nie znalazło. Jest wynikiem i chroni przed ponownym szukaniem tego samego. |

- **Genealogicky:** negativní nález (negative search); podklad negativního důkazu.
- **Čísla:** [R3.6](cs/R3-verification-and-citation.md#R3.6), S3.6, R8.3.3, R8.3.5, R8.6

<a id="parked-task"></a>
### Odložený úkol

| Jazyk | Termín | Definice |
|---|---|---|
| cs | odložený (`ui.review.state.parked`) · Odložit (app) | Úkol stranou fronty i seznamu Čeká na vyřízení. S datem se vrátí sám v ten den, bez data až po probuzení. |
| en | parked (terminal) · Park (app) | A task set aside from the queue and from the list Awaiting action. With a date it returns by itself on that day, without a date only when woken. |
| de | zurückgestellt (terminal) · Zurückstellen (app) | Eine Aufgabe außerhalb der Warteschlange und der Liste Wartet auf Bearbeitung. Mit einem Datum kehrt sie an diesem Tag von selbst zurück, ohne Datum erst, wenn sie geweckt wird. |
| pl | odłożone (terminal) · Odłóż (app) | Zadanie poza kolejką i poza listą Czeka na decyzję. Z datą wraca samo w tym dniu, bez daty dopiero po obudzeniu. |

- **Čísla:** [R6.7.2](cs/R6-awaiting-action.md#R6.7.2)

<a id="site-to-check"></a>
### Ověřit web

| Jazyk | Termín | Definice |
|---|---|---|
| cs | ověřit web (`ui.wait.kind.check`) | Úkol čeká, až se člověk podívá na stránku, kterou agent sám neotevře, a řekne, zda jde, jde jen prohlížet, nebo nejde. |
| en | a site to check | The task waits until a person looks at a page the agent does not open by itself and says whether it works, can only be viewed, or does not work. |
| de | Seite prüfen | Die Aufgabe wartet, bis sich der Mensch eine Seite ansieht, die der Agent selbst nicht öffnet, und sagt, ob es geht, ob sie nur dort anzusehen ist oder ob es nicht geht. |
| pl | witryna do sprawdzenia | Zadanie czeka, aż człowiek obejrzy stronę, której agent sam nie otworzy, i powie, czy działa, czy można ją tylko przeglądać, czy nie działa. |

- **Čísla:** [R6.2.2](cs/R6-awaiting-action.md#R6.2.2), R6.6

<a id="input"></a>
### Podklad

| Jazyk | Termín | Definice |
|---|---|---|
| cs | podklad, podklady (terminal, `strom intake`, `strom input`) | Soubor nebo text, který výzkumu dal uživatel. Uloží se beze změny a dostane úkol; z dokladu se stane pramen, z ostatního vodítko. |
| en | input, inputs (terminal, `strom intake`, `strom input`) | A file or text the user gave the research. It is kept unchanged and gets a task; a document becomes a source, the rest a lead. |
| de | Unterlage, Unterlagen (terminal, `strom intake`, `strom input`) | Eine Datei oder ein Text, den der Benutzer der Forschung gegeben hat. Sie wird unverändert gespeichert und bekommt eine Aufgabe; aus einer Urkunde wird eine Quelle, aus dem Rest ein Hinweis. |
| pl | materiał, materiały (terminal, `strom intake`, `strom input`) | Plik lub tekst, który użytkownik dał badaniu. Zostaje zapisany bez zmian i dostaje zadanie; dokument staje się źródłem, reszta wskazówką. |

- **Čísla:** [R11](cs/R11-material-from-the-user.md), R11.1, R11.2, R11.3, R11.4

<a id="gate"></a>
### Podmínka

| Jazyk | Termín | Definice |
|---|---|---|
| cs | podmínka (terminal, `run.gate`) | Program, kterého se strom před sezením samostatné práce ptá: pokračovat, počkat, nebo zastavit. Nastavuje ji jen člověk. |
| en | condition (ui.alone.gate) | A program strom asks before a session of working alone: go on, wait, or stop. Only a person sets it. |
| de | Bedingung | Ein Programm, das strom vor einer Sitzung des Agenten allein fragt: weiter, warten oder anhalten. Sie wird nur vom Menschen gesetzt. |
| pl | warunek | Program, który strom pyta przed sesją samodzielnej pracy: kontynuować, czekać czy zatrzymać. Ustawia go tylko człowiek. |

- **Čísla:** [R7.4](cs/R7-when-the-agent-works.md#R7.4), R7.4.1, R7.4.3, R7.5

<a id="view"></a>
### Pohled

| Jazyk | Termín | Definice |
|---|---|---|
| cs | pohled, pohledy (terminal, `strom media view`) | Obrázek ze snímku připravený pro model: celý snímek zmenšený na nalezení zápisu, nebo půlka, výřez či díl ve velikosti, jakou model vezme celou. |
| en | view, views (terminal, `strom media view`) | A picture made from an image for the model: the whole image reduced for finding an entry, or a half, crop or part at the size the model takes whole. |
| de | Ansicht, Ansichten (terminal, `strom media view`) | Ein Bild aus einem Scan, für das Modell vorbereitet: das ganze Bild verkleinert zum Finden eines Eintrags, oder eine Hälfte, ein Ausschnitt oder ein Teil in der Größe, die das Modell ganz nimmt. |
| pl | widok, widoki (terminal, `strom media view`) | Obraz ze skanu przygotowany dla modelu: cały skan zmniejszony do znalezienia wpisu albo połówka, wycinek lub część w rozmiarze, jaki model przyjmuje w całości. |

- **Čísla:** [R8.5](cs/R8-reading-scans.md#R8.5), R8.3.2

<a id="lesson"></a>
### Poučení

| Jazyk | Termín | Definice |
|---|---|---|
| cs | poučení (terminal, `strom lesson`) | Jedna věta o zvláštnosti knihy, archivu nebo místa, zapsaná k němu. Vidí ji každý úkol, který tam hledá. |
| en | lesson (terminal, `strom lesson`) | One sentence about a peculiarity of a book, an archive or a place, recorded on it. Every task that searches there shows it. |
| de | Lehre (terminal, `strom lesson`) | Ein Satz über eine Besonderheit eines Buches, eines Archivs oder eines Ortes, dort vermerkt. Jede Aufgabe, die dort sucht, zeigt ihn. |
| pl | wniosek (terminal, `strom lesson`) | Jedno zdanie o osobliwości księgi, archiwum lub miejsca, zapisane przy nim. Pokazuje je każde zadanie, które tam szuka. |

- **Čísla:** [R8.1.2](cs/R8-reading-scans.md#R8.1.2)

<a id="off-the-lines-work"></a>
### Práce mimo linie

| Jazyk | Termín | Definice |
|---|---|---|
| cs | práce mimo linie | Úkol o lidech, kam žádná linie nesahá, který žádné linii nepomáhá. Jde až po práci na liniích. |
| en | work off the lines (terminal) · outside the directions (app) | A task about people no line reaches that helps no line. It comes only after the work on the lines. |
| de | Arbeit außerhalb der Linien (terminal) · Außerhalb der Richtungen (app) | Eine Aufgabe über Personen, die keine Linie erreicht und die keiner Linie hilft. Sie kommt erst nach der Arbeit an den Linien. |
| pl | praca poza liniami | Zadanie o ludziach, do których nie sięga żadna linia, i które nie pomaga żadnej linii. Idzie dopiero po pracy nad liniami. |

- **Čísla:** [R2.3](cs/R2-lines-and-queue.md#R2.3), R2.3.1, R2.3.2, S4.3.2

<a id="for-researchers"></a>
### Pro badatele

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Pro badatele (stránka osoby); Jistota údajů z výzkumu (Přehled stromu) | Místa, kde aplikace ukazuje stupně jistoty z výzkumu a počet údajů s pramenem. |
| en | For researchers; Certainty of research facts | The places where the app shows the degrees of certainty from the research and the number of facts with a source. |
| de | Für Forschende; Sicherheit der Forschungsangaben | Stellen, an denen die App die Grade der Sicherheit aus der Forschung und die Zahl der Angaben mit Quelle zeigt. |
| pl | Dla badaczy; Pewność danych z badania | Miejsca, w których aplikacja pokazuje stopnie pewności z badania i liczbę danych ze źródłem. |

- **Čísla:** [R3.8](cs/R3-verification-and-citation.md#R3.8)

<a id="agents-browser"></a>
### Prohlížeč agenta

| Jazyk | Termín | Definice |
|---|---|---|
| cs | prohlížeč (Claude in Chrome) (terminal, `strom doctor`) · Prohlížeč (app, dialog **Výzkum u stromu**) | Chrome s rozšířením Claude in Chrome, který ovládá Claude Code. Strom kontroluje každé otevření stránky jako stažení webu a počítá je spolu. Prohlížeč jiného agenta a vestavěné prohlížeče desktopových aplikací strom nehlídá a nedoporučuje: do archivů jen přes prohlížeč s nimi agent sám nejde, použije je jen na výslovnou žádost člověka. |
| en | Browser (Claude in Chrome) (terminal) · Browser (app, dialog **Research for this tree**) | Chrome with the Claude in Chrome extension, driven by Claude Code. strom checks each page it opens like a web fetch and counts them together. strom does not watch and does not recommend another agent's browser or the built-in browsers of desktop apps: the agent does not take them into browser-only archives of its own accord and uses them only when a person explicitly asks. |
| de | Browser (Claude in Chrome) (terminal) · Browser (app, Dialog **Forschung für diesen Stammbaum**) | Chrome mit der Erweiterung Claude in Chrome, gesteuert von Claude Code. strom prüft jedes Öffnen einer Seite wie einen Webabruf und zählt beide zusammen. Den Browser eines anderen Agenten und die eingebauten Browser der Desktop-Apps überwacht strom nicht und empfiehlt sie nicht: in Archive, die nur im Browser zugänglich sind, geht der Agent damit nicht von sich aus, er nutzt sie nur, wenn ein Mensch ausdrücklich darum bittet. |
| pl | przeglądarka (Claude in Chrome) (terminal) · Przeglądarka (app, okno **Badanie dla drzewa**) | Chrome z rozszerzeniem Claude in Chrome, sterowany przez Claude Code. strom sprawdza każde otwarcie strony jak pobranie strony i liczy je razem. Przeglądarki innego agenta ani wbudowanych przeglądarek aplikacji desktopowych strom nie śledzi i nie poleca: do archiwów dostępnych tylko przez przeglądarkę agent nie wchodzi z nimi sam, używa ich tylko na wyraźną prośbę człowieka. |

- **Čísla:** [R9.4](cs/R9-archives.md#R9.4), R9.4.1, R9.4.2, R9.4.3, R9.5

<a id="jurisdiction"></a>
### Příslušnost místa

| Jazyk | Termín | Definice |
|---|---|---|
| cs | příslušnost | Kam místo v daných letech patřilo: fara, civilní správa, diecéze, panství, okres, kraj, stát. Vždy s roky od–do. |
| en | jurisdiction (`--jurisdiction`) | Where a place belonged in given years: parish, civil administration, diocese, manor, district, county, state. Always with years from–to. |
| de | Zugehörigkeit (`places.identify.why`) | Wohin ein Ort in bestimmten Jahren gehörte: Pfarrei, Zivilverwaltung, Diözese, Herrschaft, Bezirk, Kreis, Staat. Immer mit den Jahren von–bis. |
| pl | przynależność administracyjna (`places.identify.why`) | Do czego miejsce należało w danych latach: parafia, administracja cywilna, diecezja, dobra, powiat, województwo, państwo. Zawsze z latami od–do. |

- **Genealogicky:** církevní a správní příslušnost (farnost, panství, okres).
- **Čísla:** [R4.2](cs/R4-places.md#R4.2)

<a id="users-decision"></a>
### Rozhodnutí uživatele

| Jazyk | Termín | Definice |
|---|---|---|
| cs | rozhodnutí uživatele | Rozhodnutí rozporu, které udělal člověk. Agent ho změní jen s novým, dosud nezváženým pramenem a s důvodem. |
| en | the user's decision (`ui.link.conflict.by`) | A decision of a conflict made by a person. The agent changes it only with a new source not yet weighed, and with a reason. |
| de | Entscheidung des Nutzers | Die Entscheidung eines Widerspruchs, die der Mensch getroffen hat. Der Agent ändert sie nur mit einer neuen, noch nicht abgewogenen Quelle und mit Grund. |
| pl | decyzja użytkownika | Rozstrzygnięcie sprzeczności, którego dokonał człowiek. Agent zmienia je tylko z nowym, dotąd nieważonym źródłem i z powodem. |

- **Čísla:** [R5.4](cs/R5-conflicts.md#R5.4), R5.3, R5.5

<a id="conflict"></a>
### Rozpor

| Jazyk | Termín | Definice |
|---|---|---|
| cs | rozpor · Rozpory | Zápis, že se prameny o jednom údaji neshodují: aspoň dvě tvrzení s prameny, otevřený do rozhodnutí se zdůvodněním. |
| en | conflict (`ui.wait.kind.conflict`, `research.conflicts` Conflicts) | A record that the sources about one fact disagree: at least two claims with sources, open until decided with a reasoning. |
| de | Widerspruch (`ui.wait.kind.conflict`, `research.conflicts` Widersprüche) | Ein Eintrag, dass die Quellen zu einer Angabe nicht übereinstimmen: mindestens zwei Aussagen mit Quellen, offen bis zur Entscheidung mit Begründung. |
| pl | sprzeczność (`ui.wait.kind.conflict`, `research.conflicts` Sprzeczności) | Zapis, że źródła o jednej danej się nie zgadzają: co najmniej dwa twierdzenia ze źródłami, otwarty do rozstrzygnięcia z uzasadnieniem. |

- **Genealogicky:** konflikt důkazů (conflicting evidence); jeho vyřešení je součástí GPS.
- **Čísla:** [R5.1](cs/R5-conflicts.md#R5.1), R5.1.1, R5.3, R5.6, S3.4

<a id="location-conflict"></a>
### Rozpor polohy

| Jazyk | Termín | Definice |
|---|---|---|
| cs | poloha na mapě proti záznamům (terminal) · Rozpor polohy (app) | Otázka v Čeká na vyřízení: poloha na mapě nesouhlasí s tím, co říkají záznamy. Rozhodne člověk. |
| en | Location conflict (app) | A question in Awaiting action: the position on the map disagrees with what the records say. A person decides. |
| de | Widerspruch der Lage (app) | Eine Frage in Wartet auf Bearbeitung: die Lage auf der Karte stimmt nicht mit dem überein, was die Einträge sagen. Es entscheidet der Mensch. |
| pl | Sprzeczne położenie (app) | Pytanie w Czeka na decyzję: położenie na mapie nie zgadza się z tym, co mówią akty. Rozstrzyga człowiek. |

- **Čísla:** [R4.3](cs/R4-places.md#R4.3), R4.5

<a id="edit-conflict"></a>
### Rozpor z úpravy v aplikaci

| Jazyk | Termín | Definice |
|---|---|---|
| cs | rozpor k rozhodnutí | Rozpor mezi hodnotou upravenou v aplikaci a hodnotou výzkumu u údaje doloženého záznamem. Rozhoduje ho člověk výběrem strany. |
| en | a conflict to decide (terminal, `ui.sync.mode.conflict`) · conflicts to decide (app, `sync.conflictsN`) | A conflict between the value edited in the app and the value of the research at a fact a record documents. A person decides it by picking a side. |
| de | ein Widerspruch zum Entscheiden (terminal) · Widersprüche zu entscheiden (app) | Ein Widerspruch zwischen dem in der App geänderten Wert und dem Wert der Forschung bei einer durch einen Eintrag belegten Angabe. Ihn entscheidet der Mensch durch die Wahl einer Seite. |
| pl | sprzeczność do rozstrzygnięcia | Sprzeczność między wartością zmienioną w aplikacji a wartością badania przy danej udokumentowanej aktem. Rozstrzyga ją człowiek wyborem strony. |

- **Čísla:** [R5.2](cs/R5-conflicts.md#R5.2), R5.2.1, R5.3.1, R5.6.1, S2.3, S2.4, S2.6

<a id="hand-placed-location"></a>
### Ruční poloha

| Jazyk | Termín | Definice |
|---|---|---|
| cs | zadáno ručně (terminal) · Umístěno ručně (app) | Poloha, kterou určil člověk, včetně každé polohy z aplikace. Výzkum ji nemění, jen se zeptá při rozporu. |
| en | put there by hand (terminal) · Placed by hand (app) | A position set by a person, including every position from the app. The research does not change it; it only asks when there is a conflict. |
| de | von Hand eingetragen (terminal) · Von Hand gesetzt (app) | Eine Lage, die der Mensch bestimmt hat, einschließlich jeder Lage aus der App. Die Forschung ändert sie nicht, sie fragt nur bei einem Widerspruch. |
| pl | wpisane ręcznie (terminal) · Umieszczone ręcznie (app) | Położenie, które ustalił człowiek, w tym każde położenie z aplikacji. Badanie go nie zmienia, tylko pyta przy sprzeczności. |

- **Čísla:** [R4.3](cs/R4-places.md#R4.3), R4.5

<a id="reading-tuning"></a>
### Samoladění čtení

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Čtení snímků (terminal, `strom media calibrate --report`); `tune.auto` | strom měří, jak čtení skenů probíhá, a po sezení sám mění, jak se čte: jen směrem k přesnosti nebo k menšímu počtu žádostí do archivu. |
| en | Reading the scans (terminal, `strom media calibrate --report`); `tune.auto` | strom measures how reading the scans goes and, after a session, changes by itself how it reads: only towards accuracy or fewer requests to the archive. |
| de | Lesen der Scans (terminal, `strom media calibrate --report`); `tune.auto` | strom misst, wie das Lesen der Scans verläuft, und ändert nach einer Sitzung selbst, wie gelesen wird: nur zu mehr Genauigkeit oder zu weniger Anfragen an das Archiv. |
| pl | Odczyt skanów (terminal, `strom media calibrate --report`); `tune.auto` | strom mierzy, jak przebiega odczyt skanów, i po sesji sam zmienia sposób odczytu: tylko w stronę dokładności lub mniejszej liczby zapytań do archiwum. |

- **Čísla:** [R8.4](cs/R8-reading-scans.md#R8.4)

<a id="working-alone"></a>
### Samostatná práce agenta

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Samostatná práce agenta · Nechat agenta pracovat samotného (menu) | Agent bere úkoly z fronty bez člověka, sezení po sezení (`strom run`). |
| en | The agent working alone · Let the agent work on its own (ui.alone.title, ui.menu.run) | The agent takes tasks from the queue without a person, session after session (`strom run`). |
| de | Der Agent allein · Den Agenten allein arbeiten lassen | Der Agent nimmt Aufgaben aus der Warteschlange ohne den Menschen, Sitzung für Sitzung (`strom run`). |
| pl | Samodzielna praca agenta · Pozwól agentowi pracować samodzielnie | Agent bierze zadania z kolejki bez człowieka, sesja po sesji (`strom run`). |

- **Čísla:** [R7.1](cs/R7-when-the-agent-works.md#R7.1), R7.1.1

<a id="blind-reading"></a>
### Slepé čtení

| Jazyk | Termín | Definice |
|---|---|---|
| cs | čtení naslepo (`strom read --blind`, `review.verify.done`) | Druhé, nezávislé čtení zápisu čtenářem, který nezná očekávanou hodnotu. Shoda dvou čtení je podmínka metodiky pro Doložené u těžké buňky. |
| en | read blind (terminal) | A second, independent reading of an entry by a reader who does not know the expected value. The agreement of two readings is the method's condition for Proven at a hard cell. |
| de | blind gelesen (terminal) | Eine zweite, unabhängige Lesung eines Eintrags durch einen Leser, der den erwarteten Wert nicht kennt. Die Übereinstimmung zweier Lesungen ist eine Bedingung der Methodik für Belegt bei einer schwierigen Zelle. |
| pl | ślepy odczyt, odczytany na ślepo (terminal) | Drugi, niezależny odczyt wpisu przez czytelnika, który nie zna oczekiwanej wartości. Zgodność dwóch odczytów to warunek metodyki dla Udokumentowane przy trudnej komórce. |

- **Genealogicky:** nezávislé ověření přepisu (independent transcription).
- **Čísla:** [R3.5](cs/R3-verification-and-citation.md#R3.5), R3.5.1, R8.7, R8.3.2

<a id="images-saved-by-hand"></a>
### Snímky uložené ručně

| Jazyk | Termín | Definice |
|---|---|---|
| cs | snímky (`ui.wait.kind.images`) | Úkol čeká, až člověk uloží snímky knihy do připravené složky; po jejich uložení do výzkumu se probudí sám. |
| en | images | The task waits until a person saves the images of a book into the prepared folder; once they are saved into the research, it wakes by itself. |
| de | Bilder | Die Aufgabe wartet, bis der Mensch die Bilder eines Buches in einen vorbereiteten Ordner speichert; nach dem Speichern in die Forschung wird sie von selbst geweckt. |
| pl | skany | Zadanie czeka, aż człowiek zapisze skany księgi do przygotowanego folderu; po ich zapisaniu do badania budzi się samo. |

- **Čísla:** [R6.2.1](cs/R6-awaiting-action.md#R6.2.1), R6.7.2, R9.6, R9.9

<a id="downloader"></a>
### Stahovač

| Jazyk | Termín | Definice |
|---|---|---|
| cs | stahovač, Stahovače (terminal, Čeká na vyřízení) | Část stromu pro jeden archiv, přes kterou jedině strom stahuje katalog a snímky, podle podmínek archivu a v jeho tempu. |
| en | downloader, Downloaders (terminal, awaiting action) | The part of strom for one archive through which alone strom downloads the catalogue and images, under the archive's terms and at its pace. |
| de | Downloader (terminal, ausstehende Aktionen) | Der Teil von strom für ein Archiv, über den strom allein Katalog und Bilder lädt, nach den Bedingungen des Archivs und in seinem Tempo. |
| pl | program pobierający, Programy pobierające (terminal) | Część stroma dla jednego archiwum, przez którą jedynie strom pobiera katalog i skany, zgodnie z warunkami archiwum i w jego tempie. |

- **Čísla:** [R8.2](cs/R8-reading-scans.md#R8.2), R8.1, R6.3.1

<a id="conflict-sides"></a>
### Strany rozporu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Z aplikace · Ve výzkumu (app) · Platí hodnota z aplikace Strom · Platí hodnota ve výzkumu (terminal 1.25.2) · Ponechat hodnotu z aplikace · Převzít hodnotu výzkumu (terminal od výzkumu 1.26.0) | Dvě hodnoty rozporu z úpravy: hodnota upravená v aplikaci a hodnota, kterou má výzkum. |
| en | From the app · In the research (app) · The value from the Strom app holds · The research's value holds (terminal 1.25.2) · Keep the value from the app · Take the research's value (terminal from research 1.26.0) | The two values of a conflict from an edit: the value edited in the app and the value the research has. |
| de | Aus der App · In der Forschung (app) · Der Wert aus der Strom-App gilt · Der Wert der Forschung gilt (terminal 1.25.2) · Wert aus der App behalten · Wert der Forschung übernehmen (terminal ab Forschung 1.26.0) | Die zwei Werte eines Widerspruchs aus einer Änderung: der in der App geänderte Wert und der Wert, den die Forschung hat. |
| pl | Z aplikacji · W badaniu (app) · Obowiązuje wartość z aplikacji Strom · Obowiązuje wartość z badania (terminal 1.25.2) · Zachowanie wartości z aplikacji · Przyjęcie wartości z badania (terminal od badania 1.26.0) | Dwie wartości sprzeczności ze zmiany: wartość zmieniona w aplikacji i wartość, którą ma badanie. |

- **Čísla:** [R5.3.1](cs/R5-conflicts.md#R5.3.1), R5.6, R5.6.1

<a id="cap"></a>
### Strop

| Jazyk | Termín | Definice |
|---|---|---|
| cs | strop (terminal) | Pevná hranice využití týdne, kterou nastavil člověk: za ní žádné sezení nezačne, ani po „Spustit přesto?“. |
| en | cap (ui.run.gate.cap) | A hard limit of the week's usage set by a person: beyond it no session starts, not even after “Start anyway?”. |
| de | Obergrenze | Eine feste Grenze der Nutzung der Woche, die der Mensch gesetzt hat: darüber beginnt keine Sitzung, auch nicht nach „Trotzdem starten?“. |
| pl | pułap | Sztywna granica wykorzystania tygodnia, którą ustawił człowiek: po jej osiągnięciu żadna sesja się nie zaczyna, nawet po „Uruchomić mimo to?”. |

- **Čísla:** [R7.4.2](cs/R7-when-the-agent-works.md#R7.4.2), R7.5.4

<a id="fact-status"></a>
### Stupeň jistoty údaje

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Vodítko · Možné · Pravděpodobné · Doložené (app, `factStatus`) · jen stopa · možné · pravděpodobné · doloženo (terminal 1.25.2, `ui.st.*`; od výzkumu 1.26.0 slovy aplikace) | Jak jistý je závěr o údaji ze všech jeho pramenů. Určuje ho výzkum, aplikace ho jen ukazuje. |
| en | Lead · Possible · Probable · Proven (app) · only a lead · possible · probable · proven (terminal 1.25.2; from research 1.26.0 lead in the app's words) | How certain the conclusion about a fact is, from all its sources. The research sets it; the app only shows it. |
| de | Hinweis · Möglich · Wahrscheinlich · Belegt (app) · nur ein Hinweis · möglich · wahrscheinlich · belegt (terminal 1.25.2; ab Forschung 1.26.0 in den Worten der App) | Wie sicher die Schlussfolgerung über eine Angabe aus allen ihren Quellen ist. Sie bestimmt die Forschung, die App zeigt sie nur. |
| pl | Wskazówka · Możliwe · Prawdopodobne · Udokumentowane (app) · tylko wskazówka · możliwe · prawdopodobne · udokumentowane (terminal 1.25.2; od badania 1.26.0 słowami aplikacji) | Jak pewny jest wniosek o danej ze wszystkich jej źródeł. Ustala go badanie, aplikacja go tylko pokazuje. |

- **Genealogicky:** míra jistoty závěru (proof standard, GPS); stupně odpovídají „proved / probable / possible“.
- **Čísla:** [R3.1](cs/R3-verification-and-citation.md#R3.1), R3.1.1, R3.2, R3.8

<a id="archive-permission"></a>
### Svolení archivu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | svolení archivu (`ui.wait.kind.permission`) | Otázka, jak smí výzkum z archivu stahovat. Rozhodnutí probudí úkoly čekající na tento archiv ve všech výzkumech na počítači. |
| en | an archive's permission | The question of how the research may download from an archive. The decision wakes the tasks waiting for this archive in all researches on the computer. |
| de | Erlaubnis eines Archivs | Die Frage, wie die Forschung aus einem Archiv herunterladen darf. Die Entscheidung weckt die Aufgaben, die auf dieses Archiv warten, in allen Forschungen auf dem Computer. |
| pl | zgoda archiwum | Pytanie, jak badanie może pobierać z archiwum. Decyzja budzi zadania czekające na to archiwum we wszystkich badaniach na komputerze. |

- **Čísla:** [R6.3.1](cs/R6-awaiting-action.md#R6.3.1), R6.6, R6.7.2, R9.2

<a id="record-backed-fact"></a>
### Údaj doložený záznamem

| Jazyk | Termín | Definice |
|---|---|---|
| cs | údaj doložený záznamem | Údaj ve stavu Doložené nebo Pravděpodobné, který cituje pramen jiný než rodokmen, rodinnou paměť nebo vlastní text. Úprava z aplikace ho nepřepíše. |
| en | fact a record proves (`ui.sync.edits`) | A fact in the state Proven or Probable that cites a source other than a family tree, family memory or the author's own text. An edit from the app does not overwrite it. |
| de | Angabe, die ein Eintrag belegt (`ui.sync.edits`) | Eine Angabe im Zustand Belegt oder Wahrscheinlich, die eine andere Quelle zitiert als einen Stammbaum, die Familienüberlieferung oder einen eigenen Text. Eine Änderung aus der App überschreibt sie nicht. |
| pl | dane potwierdzone aktem (`ui.sync.edits`) | Dana w stanie Udokumentowane lub Prawdopodobne, która cytuje źródło inne niż drzewo genealogiczne, pamięć rodzinna lub własny tekst. Zmiana z aplikacji jej nie nadpisuje. |

- **Genealogicky:** údaj podložený pramenem (původním nebo odvozeným), ne jen cizím rodokmenem nebo vzpomínkou.
- **Čísla:** [R5.2](cs/R5-conflicts.md#R5.2), R5.2.1

<a id="evidence-level"></a>
### Úroveň doložení osoby

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Doloženo · Částečně doloženo · Nedoloženo (`treeHealth.evFull/evPartial/evNone`); zvýraznění Doložení; karta Doložení prameny | Kolik toho o osobě cituje pramen (narození, úmrtí). Počítá aplikace sama jen z citací, bez stupně jistoty. |
| en | Documented · Partly documented · Undocumented; Evidence; Evidence from sources | How much about a person a source cites (birth, death). The app counts it by itself from citations only, without the degree of certainty. |
| de | Belegt · Teilweise belegt · Unbelegt; Belege; Belege aus Quellen | Wie viel über eine Person eine Quelle zitiert (Geburt, Tod). Die App berechnet sie selbst nur aus Zitationen, ohne Grad der Sicherheit. |
| pl | Udokumentowane · Częściowo udokumentowane · Nieudokumentowane; Udokumentowanie; Udokumentowanie w źródłach | Ile o osobie cytuje źródło (urodzenie, zgon). Aplikacja liczy to sama tylko z cytatów, bez stopnia pewności. |

- **Čísla:** [R3.8.1](cs/R3-verification-and-citation.md#R3.8.1), R3.8

<a id="lead"></a>
### Vodítko

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Vodítko (app; terminal od výzkumu 1.26.0) · jen stopa (terminal 1.25.2) | Co ověřit, ne údaj: rodinný příběh, rodokmen, rejstřík nebo odhad. Údaj bez citace nebo jen ze slabého pramene. |
| en | Lead (app; terminal from research 1.26.0) · only a lead (terminal 1.25.2) | Something to verify, not a fact: a family story, a family tree, an index or an estimate. A fact without a citation or only from a weak source. |
| de | Hinweis (app; terminal ab Forschung 1.26.0) · nur ein Hinweis (terminal 1.25.2) | Etwas zu Prüfendes, keine Angabe: eine Familiengeschichte, ein Stammbaum, ein Register oder eine Schätzung. Eine Angabe ohne Zitation oder nur aus einer schwachen Quelle. |
| pl | Wskazówka (app; terminal od badania 1.26.0) · tylko wskazówka (terminal 1.25.2) | Co zweryfikować, nie dana: opowieść rodzinna, drzewo genealogiczne, indeks lub szacunek. Dana bez cytatu lub tylko ze słabego źródła. |

- **Genealogicky:** hypotéza, stopa k ověření (lead); rejstřík a rodokmen jako odvozený nebo autorský pramen.
- **Čísla:** [R3.3](cs/R3-verification-and-citation.md#R3.3), R3.1, R3.1.1, R3.5.1, R11.2, R11.3, S2.3

<a id="conflict-tag"></a>
### Značka rozporu u údaje

| Jazyk | Termín | Definice |
|---|---|---|
| cs | rozpor › | Značka u pole v úpravě osoby: u tohoto údaje je otevřený rozpor. Otevře jeho kartu nebo Co ví výzkum. |
| en | conflict › | A tag at a field in editing a person: there is an open conflict at this fact. It opens its card or What the research knows. |
| de | Widerspruch › | Eine Marke am Feld beim Bearbeiten einer Person: bei dieser Angabe ist ein Widerspruch offen. Sie öffnet seine Karte oder Was die Forschung weiß. |
| pl | sprzeczność › | Znacznik przy polu w edycji osoby: przy tej danej jest otwarta sprzeczność. Otwiera jej kartę lub Co wie badanie. |

- **Čísla:** [R5.6](cs/R5-conflicts.md#R5.6), S3.2

<a id="place-identification"></a>
### Ztotožnění místa

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Místa ke ztotožnění (terminal) · Dohledat ve výzkumu (app) | Výzkum určí z fary, okresu a let záznamů, která obec daného jména to je. Souřadnice dostane jen jisté místo. |
| en | Places to identify (terminal) · Look up in the research (app) | The research works out from the parish, district and years of the records which village of the given name it is. Only a certain place gets coordinates. |
| de | Orte zu bestimmen (terminal) · In der Forschung suchen (app) | Die Forschung bestimmt aus Pfarrei, Bezirk und Jahren der Einträge, welche Gemeinde dieses Namens es ist. Koordinaten bekommt nur ein sicherer Ort. |
| pl | Miejsca do identyfikacji (terminal) · Odszukaj w badaniu (app) | Badanie ustala z parafii, powiatu i lat aktów, która miejscowość o danej nazwie to jest. Współrzędne dostaje tylko miejsce pewne. |

- **Genealogicky:** identifikace lokality (place identification, rozlišení homonym podle farnosti).
- **Čísla:** [R4.1](cs/R4-places.md#R4.1), R4.1.1, R4.4

## Pojmy částí A a S

Pojmy aplikace a jejího spojení s výzkumem, v abecedním pořadí.

<a id="strom-archive"></a>
### Archiv Stromu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Archiv Stromu (v přepínači **Archiv**) | Strom, který výzkum drží s prameny na disku bez agenta. Úpravy z aplikace bere vždy jako platné. |
| en | Strom archive (in the switcher **Archive**) | A tree the research keeps with sources on the disk, without an agent. It always takes edits from the app as valid. |
| de | Strom-Archiv (im Umschalter **Archiv**) | Ein Stammbaum, den die Forschung mit den Quellen auf der Festplatte hält, ohne Agent. Änderungen aus der App nimmt es immer als gültig. |
| pl | Archiwum Strom (w przełączniku **Archiwum**) | Drzewo, które badanie przechowuje ze źródłami na dysku, bez agenta. Zmiany z aplikacji przyjmuje zawsze jako ważne. |

- **Čísla:** [R7.8](cs/R7-when-the-agent-works.md#R7.8), R7.8.1, S1.3, S2.4

<a id="what-will-be-sent"></a>
### Co se pošle

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Co se pošle | Seznam úprav stromu, které výzkum ještě nemá, po oddílech (osoby, prameny, páry, místa, varianty příjmení); ukáže se před ručním posláním. |
| en | What will be sent | The list of tree edits the research does not have yet, by sections (people, sources, couples, places, surname variants); shown before a manual send. |
| de | Was gesendet wird | Die Liste der Änderungen am Stammbaum, die die Forschung noch nicht hat, nach Abschnitten (Personen, Quellen, Paare, Orte, Namensschreibweisen); sie erscheint vor einem manuellen Senden. |
| pl | Co zostanie wysłane | Lista zmian drzewa, których badanie jeszcze nie ma, według działów (osoby, źródła, pary, miejsca, warianty nazwisk); pokazuje się przed ręcznym wysłaniem. |

- **Čísla:** [S2.2](cs/S2-edits-from-the-app.md#S2.2), S2.2.1

<a id="other-families"></a>
### Další rodiny

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Další rodiny | Malé rody s nejvýš 4 skutečnými členy (přivdaní se nepočítají), uvedené souhrnně místo vlastního řádku. |
| en | Other families | Small family lines with at most 4 real members (people married in do not count), listed together instead of a row of their own. |
| de | Weitere Familien | Kleine Stammlinien mit höchstens 4 echten Mitgliedern (Eingeheiratete zählen nicht), zusammen aufgeführt statt in einer eigenen Zeile. |
| pl | Inne rodziny | Małe rody z najwyżej 4 rzeczywistymi członkami (osób wżenionych się nie liczy), podane zbiorczo zamiast własnego wiersza. |

- **Čísla:** [A4.3](cs/A4-surnames-and-families.md#A4.3)

<a id="hypothesis"></a>
### Hypotéza

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Hypotézy | Otázka, kterou výzkum vede o osobě nebo vazbě, s verzemi odpovědi; je otevřená, rozhodnutá pro jednu verzi, nebo zrušená. |
| en | Hypotheses | A question the research keeps about a person or a link, with versions of the answer; it is open, decided for one version, or dropped. |
| de | Hypothesen | Eine Frage, die die Forschung zu einer Person oder Verbindung führt, mit Versionen der Antwort; sie ist offen, für eine Version entschieden oder verworfen. |
| pl | Hipotezy | Pytanie, które badanie prowadzi o osobie lub powiązaniu, z wersjami odpowiedzi; jest otwarte, rozstrzygnięte na rzecz jednej wersji albo anulowane. |

- **Čísla:** [R10.3](cs/R10-people-and-hypotheses.md#R10.3), R10.3.1, S3.5, S3.5.1

<a id="pedigree-collapse"></a>
### Implex

| Jazyk | Termín | Definice |
|---|---|---|
| cs | ↻ opakuje se (implex) | Předek, který se ve vějíři objeví podruhé; nakreslí se znovu, ale dál se nerozvíjí. |
| en | ↻ repeats (pedigree collapse) | An ancestor who appears in the fan a second time; drawn again, but not expanded further. |
| de | ↻ wiederholt (Ahnenschwund) | Ein Vorfahre, der im Fächer ein zweites Mal vorkommt; er wird erneut gezeichnet, aber nicht weiter aufgeklappt. |
| pl | ↻ powtarza się (implex) | Przodek, który pojawia się w wachlarzu po raz drugi; rysuje się go ponownie, ale dalej się nie rozwija. |

- **Čísla:** [A6.4](cs/A6-views.md#A6.4)

<a id="where-evidence-is-missing"></a>
### Kde chybí doklady

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Kde chybí doklady: Osoby bez pramene · Narození bez pramene / Narození neověřená výzkumem · Konce linií (app) | Blok přehledu stromu se skupinami lidí bez pramene nebo bez rodičů; zvýraznění jimi provede a nabídne **Citovat**. |
| en | Where evidence is missing: People without a source · Births without a source / Births not proven in the research · Line ends (app) | A block of the tree overview with groups of people without a source or without parents; the highlighting walks through them and offers **Cite**. |
| de | Wo Belege fehlen: Personen ohne Quelle · Geburten ohne Quelle / Geburten in der Forschung nicht bewiesen · Linienenden (app) | Ein Block des Stammbaum-Überblicks mit Gruppen von Personen ohne Quelle oder ohne Eltern; die Hervorhebung führt durch sie und bietet **Zitieren** an. |
| pl | Gdzie brakuje dowodów: Osoby bez źródła · Urodzenia bez źródła / Urodzenia niesprawdzone w badaniu · Końce linii (app) | Blok przeglądu drzewa z grupami osób bez źródła lub bez rodziców; podświetlanie prowadzi przez nie i proponuje **Cytuj**. |

- **Čísla:** [A3.7](cs/A3-evidence-in-the-app.md#A3.7), [R3.8](cs/R3-verification-and-citation.md#R3.8)

<a id="recurring-godparent"></a>
### Kmotr, který se opakuje

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Kmotr, který se opakuje — bývá to příbuzný | Kmotr nebo svědek u událostí nepříbuzných osob z aspoň dvou sourozeneckých skupin. Často je to příbuzný. |
| en | A godparent who keeps turning up — often a relative | A godparent or witness at the events of unrelated people from at least two groups of siblings. Often a relative. |
| de | Ein Pate, der immer wieder auftaucht — oft ein Verwandter | Ein Pate oder Zeuge bei Ereignissen nicht verwandter Personen aus mindestens zwei Geschwistergruppen. Oft ist es ein Verwandter. |
| pl | Powtarzający się chrzestny – często to krewny | Chrzestny lub świadek przy zdarzeniach niespokrewnionych osób z co najmniej dwóch grup rodzeństwa. Często to krewny. |

- **Čísla:** [A5.5](cs/A5-tree-check.md#A5.5), A5.5.1

<a id="family-book"></a>
### Kniha rodu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Kniha rodu | Výstup aplikace: kniha o vybraných osobách k tisku na A4 nebo k uložení jako HTML. |
| en | Family book | An output of the app: a book about chosen people, to print on A4 or to save as HTML. |
| de | Familienbuch | Eine Ausgabe der App: ein Buch über gewählte Personen, zum Drucken auf A4 oder zum Speichern als HTML. |
| pl | Księga rodu | Wynik aplikacji: księga o wybranych osobach do druku na A4 lub do zapisania jako HTML. |

- **Čísla:** [A7.4](cs/A7-book-pages-and-export.md#A7.4), A7.4.1

<a id="tree-check"></a>
### Kontrola stromu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Validace stromu (dialog) · Kontrola dat (po importu) · Detaily validace (tlačítko) | Kontrola celého stromu v aplikaci: vazby, data, věk, prameny a stopy. Strom nemění; opravu dělá člověk. |
| en | Tree validation (dialog) · Data check (after import) · Validation details (button) | A check of the whole tree in the app: links, dates, age, sources and leads. It does not change the tree; a person makes the fix. |
| de | Stammbaum-Prüfung (Dialog) · Datenprüfung (nach dem Import) · Validierungsdetails (Schaltfläche) | Eine Prüfung des ganzen Stammbaums in der App: Verbindungen, Daten, Alter, Quellen und Hinweise. Sie ändert den Stammbaum nicht; die Korrektur macht ein Mensch. |
| pl | Walidacja drzewa (dialog) · Kontrola danych (po imporcie) · Szczegóły walidacji (przycisk) | Kontrola całego drzewa w aplikacji: powiązania, daty, wiek, źródła i wskazówki. Drzewa nie zmienia; poprawkę robi człowiek. |

- **Čísla:** [A5.1](cs/A5-tree-check.md#A5.1), A5.1.1, A5.8

<a id="gedcom-conversion"></a>
### Konverze GEDCOM

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Konverze GEDCOM | Souhrn po načtení souboru GEDCOM: počty osob, vztahů, zástupných osob a nepřenesených značek a volba, kam data uložit. |
| en | GEDCOM conversion | The summary after loading a GEDCOM file: numbers of people, relationships, placeholder persons and tags not carried over, and the choice of where to save the data. |
| de | GEDCOM-Umwandlung | Die Zusammenfassung nach dem Einlesen einer GEDCOM-Datei: Zahl der Personen, Beziehungen, Platzhalterpersonen und nicht übernommenen Tags und die Wahl, wohin die Daten gespeichert werden. |
| pl | Konwersja GEDCOM | Podsumowanie po wczytaniu pliku GEDCOM: liczba osób, relacji, osób zastępczych i nieprzeniesionych znaczników oraz wybór, gdzie zapisać dane. |

- **Čísla:** [A2.1.1](cs/A2-loading-a-family-tree.md#A2.1.1)

<a id="research-edge"></a>
### Kraj výzkumu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Kraj výzkumu | Volba zobrazení stromu: nad kartami, kde strom končí, ukáže pahýl s tím, co o tom ví výzkum (Vypnuto / K vyřízení / Vše). |
| en | Research edge | A tree view option: above the cards where the tree ends, a stub shows what the research knows about it (Off / To decide / All). |
| de | Forschungsrand | Eine Option der Stammbaumansicht: über den Karten, wo der Stammbaum endet, zeigt ein Stummel, was die Forschung darüber weiß (Aus / Zu entscheiden / Alle). |
| pl | Krawędź badania | Opcja widoku drzewa: nad kartami, gdzie drzewo się kończy, pokazuje odgałęzienie z tym, co wie o tym badanie (Wyłączone / Do załatwienia / Wszystko). |

- **Čísla:** [S3.3](cs/S3-what-the-research-knows.md#S3.3)

<a id="material"></a>
### Materiál

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Poslat materiál… · Materiály (app) | Soubor poslaný výzkumu k osobě nebo k prameni. Do stromu se nepřidá; výzkum z něj udělá úkol pro agenta. |
| en | Send material… · Materials (app) | A file sent to the research for a person or a source. It is not added to the tree; the research makes a task for the agent from it. |
| de | Material senden… · Materialien (app) | Eine Datei, an die Forschung zu einer Person oder Quelle gesendet. Sie kommt nicht in den Stammbaum; die Forschung macht daraus eine Aufgabe für den Agenten. |
| pl | Wyślij materiał… · Materiały (app) | Plik wysłany do badania przy osobie lub źródle. Do drzewa się nie dodaje; badanie robi z niego zadanie dla agenta. |

- **Čísla:** [A3.5](cs/A3-evidence-in-the-app.md#A3.5), R11, R11.4

<a id="research-bridge"></a>
### Most výzkumu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | most | Malý server, který výzkum spustí na tomto počítači (`127.0.0.1`, náhodný port, tajný klíč v adrese); aplikace přes něj s výzkumem mluví. |
| en | bridge | A small server the research starts on this computer (`127.0.0.1`, a random port, a secret key in the address); the app talks with the research through it. |
| de | Brücke | Ein kleiner Server, den die Forschung auf diesem Computer startet (`127.0.0.1`, ein zufälliger Port, ein geheimer Schlüssel in der Adresse); darüber spricht die App mit der Forschung. |
| pl | most | Mały serwer, który badanie uruchamia na tym komputerze (`127.0.0.1`, losowy port, tajny klucz w adresie); aplikacja rozmawia przez niego z badaniem. |

- **Čísla:** [S1.1](cs/S1-connecting-app-and-research.md#S1.1), S1.5, S1.7

<a id="possible-duplicate"></a>
### Možná duplicitní osoba

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Možná duplicitní osoba | Dvě osoby se stejným jménem a roky narození, které mohou být jednou osobou zapsanou dvakrát. |
| en | Possible duplicate person | Two people with the same name and years of birth who may be one person written twice. |
| de | Mögliche doppelte Person | Zwei Personen mit demselben Namen und denselben Geburtsjahren, die eine zweimal eingetragene Person sein können. |
| pl | Możliwy duplikat osoby | Dwie osoby z tym samym imieniem i nazwiskiem oraz latami urodzenia, które mogą być jedną osobą zapisaną dwa razy. |

- **Čísla:** [A5.6](cs/A5-tree-check.md#A5.6), A5.6.2, R10.2

<a id="above-the-person"></a>
### Nad osobou

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Nad osobou | Oddíl Co ví výzkum u osoby, nad kterou strom nepokračuje: proč tu hledání stojí, co se stane dál, knihy, úkoly a práce. |
| en | Above the person | A section of What the research knows for a person above whom the tree does not go on: why the search stops here, what happens next, books, tasks and work. |
| de | Über der Person | Ein Abschnitt von Was die Forschung weiß bei einer Person, über der der Stammbaum nicht weitergeht: warum die Suche hier steht, was als Nächstes geschieht, Bücher, Aufgaben und Arbeit. |
| pl | Nad osobą | Dział Co wie badanie przy osobie, nad którą drzewo nie biegnie dalej: dlaczego poszukiwania tu stoją, co nastąpi dalej, księgi, zadania i praca. |

- **Čísla:** [S3.3](cs/S3-what-the-research-knows.md#S3.3), S3.3.1

<a id="phone-finds"></a>
### Nálezy

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Nálezy | Část stránky telefonu s tím, co agent nově zjistil o rodině: nové osoby a rodiny, nalezené, opravené a nově doložené údaje, nové prameny, vyřešené rozpory a otázky. |
| en | Finds | The part of the phone page with what the agent newly found out about the family: new people and families, facts found, corrected and newly proven, new sources, resolved conflicts and questions. |
| de | Funde | Der Teil der Seite des Telefons mit dem, was der Agent neu über die Familie herausgefunden hat: neue Personen und Familien, gefundene, korrigierte und neu belegte Angaben, neue Quellen, gelöste Widersprüche und Fragen. |
| pl | Ustalenia | Część strony telefonu z tym, co agent nowego ustalił o rodzinie: nowe osoby i rodziny, znalezione, poprawione i nowo udokumentowane dane, nowe źródła, rozstrzygnięte sprzeczności i pytania. |

- **Čísla:** [S5.3](cs/S5-phone.md#S5.3)

<a id="research-tools"></a>
### Nástroje výzkumu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Nástroje výzkumu (`research.tools.title`) | Podmenu menu Výzkum s vlastními akcemi výzkumu ve skupinách Podívat se, Zadat práci a Spustit agenta. Vše se potvrzuje ve výzkumu. |
| en | Research tools (`research.tools.title`) | A submenu of the Research menu with the research's own actions in the groups Look, Assign work and Run the agent. Everything is confirmed in the research. |
| de | Forschungswerkzeuge (`research.tools.title`) | Ein Untermenü des Menüs Forschung mit eigenen Aktionen der Forschung in den Gruppen Ansehen, Arbeit vergeben und Agent starten. Alles wird in der Forschung bestätigt. |
| pl | Narzędzia badania (`research.tools.title`) | Podmenu menu Badanie z własnymi akcjami badania w grupach Przegląd, Zlecenie pracy i Uruchomienie agenta. Wszystko potwierdza się w badaniu. |

- **Čísla:** [S4.5.2](cs/S4-research-from-the-app.md#S4.5.2)

<a id="not-an-error"></a>
### Není chyba

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Není chyba · Jsou to dvě osoby (u možné duplicity) (app) · `strom quality dismiss` (terminal) | Značka člověka u nálezu kontroly. Nález se pak nehlásí, dokud se nezmění jeho osoby nebo předmět. Agent ji nikdy nezapisuje. |
| en | Not an error · Two different people (for a possible duplicate) (app) · `strom quality dismiss` (terminal) | A person's mark on a finding of the check. The finding is then not reported until its people or subject change. The agent never writes it. |
| de | Kein Fehler · Zwei verschiedene Personen (bei einer möglichen doppelten Person) (app) · `strom quality dismiss` (terminal) | Die Marke eines Menschen bei einem Befund der Prüfung. Der Befund wird dann nicht gemeldet, bis sich seine Personen oder sein Gegenstand ändern. Der Agent schreibt sie nie. |
| pl | To nie błąd · To dwie różne osoby (przy możliwym duplikacie) (app) · `strom quality dismiss` (terminal) | Oznaczenie człowieka przy wyniku kontroli. Wynik nie jest potem zgłaszany, dopóki nie zmienią się jego osoby lub przedmiot. Agent nigdy go nie zapisuje. |

- **Čísla:** [A5.7](cs/A5-tree-check.md#A5.7), A5.6

<a id="unsupported-tags"></a>
### Nepodporováno

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Nepodporováno | Počet částí souboru GEDCOM, které aplikace nezná a nepřenesla; jmenovitě je uvádí řádek Přeskočené záznamy. Osoby a vztahy mezi ně nepatří. |
| en | Unsupported | The number of parts of a GEDCOM file the app does not know and did not carry over; the row Skipped records names them. People and relationships are not among them. |
| de | Nicht unterstützt | Die Zahl der Teile einer GEDCOM-Datei, die die App nicht kennt und nicht übernommen hat; namentlich nennt sie die Zeile Übersprungene Einträge. Personen und Beziehungen gehören nicht dazu. |
| pl | Nieobsługiwane | Liczba części pliku GEDCOM, których aplikacja nie zna i nie przeniosła; z nazwy podaje je wiersz Pominięte rekordy. Osoby i relacje do nich nie należą. |

- **Čísla:** [A2.1](cs/A2-loading-a-family-tree.md#A2.1), A2.1.1, A2.2, A2.5

<a id="living-privacy"></a>
### Ochrana žijících

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Soukromí žijících osob (export) · Ochrana žijících (kniha rodu) | Volba výstupu, jak ukázat žijící osoby: Plná data, Iniciály + rok narození, Skrýt jména, Ponechat jen příjmení. Struktura stromu zůstává. |
| en | Privacy of living people (export, family book) | An output option for how to show living people: Full data, Initials + birth year, Hide names, Keep surname only. The structure of the tree stays. |
| de | Privatsphäre lebender Personen (Export) · Schutz lebender Personen (Familienbuch) | Eine Option der Ausgabe, wie lebende Personen gezeigt werden: Vollständige Daten, Initialen + Geburtsjahr, Namen verbergen, Nur Nachname behalten. Die Struktur des Stammbaums bleibt. |
| pl | Prywatność osób żyjących (eksport) · Ochrona osób żyjących (księga rodu) | Opcja wyniku, jak pokazać osoby żyjące: Pełne dane, Inicjały + rok urodzenia, Ukryj imiona i nazwiska, Zostaw tylko nazwisko. Struktura drzewa zostaje. |

- **Čísla:** [A7.2](cs/A7-book-pages-and-export.md#A7.2), A7.1, A7.2.1

<a id="send-mode"></a>
### Posílat úpravy

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Posílat úpravy: Ručně / Automaticky / Jen načítat z výzkumu (nic neposílat) | Způsob, jakým jdou úpravy jednoho stromu do výzkumu: tlačítkem Poslat, samy po chvíli klidu, nebo vůbec. |
| en | Sending changes: Manually / Automatically / Only load from the research (send nothing) | The way edits of one tree go to the research: by the button Send, by themselves after a moment of quiet, or not at all. |
| de | Änderungen senden: Manuell / Automatisch / Nur aus der Forschung laden (nichts senden) | Die Art, wie Änderungen eines Stammbaums in die Forschung gehen: mit der Schaltfläche Senden, von selbst nach einer Weile Ruhe oder gar nicht. |
| pl | Wysyłanie zmian: Ręcznie / Automatycznie / Tylko wczytywanie z badania (bez wysyłania) | Sposób, w jaki zmiany jednego drzewa trafiają do badania: przyciskiem Wyślij, same po chwili spokoju albo wcale. |

- **Čísla:** [S2.2](cs/S2-edits-from-the-app.md#S2.2)

<a id="surname-in-use"></a>
### Používané příjmení

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Používané příjmení | Volba u osoby s příjmením po sňatku, zda se ukazuje rodné, nebo příjmení po sňatku. |
| en | Surname in use | An option for a person with a married surname: whether the birth surname or the married surname is shown. |
| de | Geführter Nachname | Eine Option bei einer Person mit Ehenamen, ob der Geburtsname oder der Ehename gezeigt wird. |
| pl | Używane nazwisko | Opcja przy osobie z nazwiskiem po ślubie: czy pokazuje się nazwisko rodowe, czy nazwisko po ślubie. |

- **Čísla:** [A4.6](cs/A4-surnames-and-families.md#A4.6)

<a id="source-entry"></a>
### Pramen (zápis)

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Prameny (app); Citovat pramen; Dokládá | Jeden konkrétní zápis (křest, sňatek, úmrtí) v seznamu pramenů stromu. Údaje a osoby na něj odkazují citací. |
| en | Sources (app); Cite a source; Supports | One particular entry (baptism, marriage, death) in the tree's list of sources. Facts and people refer to it by a citation. |
| de | Quellen (app); Quelle zitieren; Belegt | Ein bestimmter Eintrag (Taufe, Heirat, Tod) in der Liste der Quellen des Stammbaums. Angaben und Personen verweisen mit einer Zitation darauf. |
| pl | Źródła (app); Cytuj źródło; Dokumentuje | Jeden konkretny zapis (chrzest, ślub, zgon) na liście źródeł drzewa. Dane i osoby odwołują się do niego cytowaniem. |

- **Čísla:** [A3.1](cs/A3-evidence-in-the-app.md#A3.1), A3.2, A3.2.1, A3.6

<a id="problems-and-leads"></a>
### Problémy a stopy

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Problémy · Stopy | Problémy jsou chyby a varování kontroly. Stopy nejsou chyby: kmotr, který se opakuje, různé zápisy místa, možná duplicita, velký věkový rozdíl partnerů. |
| en | Problems · Leads | Problems are the check's errors and warnings. Leads are not errors: a godparent who keeps turning up, different spellings of a place, a possible duplicate, a large age gap between partners. |
| de | Probleme · Hinweise | Probleme sind Fehler und Warnungen der Prüfung. Hinweise sind keine Fehler: ein Pate, der immer wieder auftaucht, verschiedene Schreibweisen eines Ortes, eine mögliche doppelte Person, ein großer Altersunterschied der Partner. |
| pl | Problemy · Wskazówki | Problemy to błędy i ostrzeżenia kontroli. Wskazówki nie są błędami: powtarzający się chrzestny, różne zapisy miejsca, możliwy duplikat, duża różnica wieku partnerów. |

- **Čísla:** [A5.1](cs/A5-tree-check.md#A5.1), A5.5, A5.6, A5.8

<a id="searched"></a>
### Prohledáno

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Prohledáno | Oddíl Co ví výzkum: tabulka hledání výzkumu k osobě (Záznam, Roky, Výsledek nalezeno / nic). |
| en | Searched | A section of What the research knows: the table of the research's searches for the person (Record, Years, Result found / nothing). |
| de | Durchsucht | Ein Abschnitt von Was die Forschung weiß: die Tabelle der Suchen der Forschung zur Person (Eintrag, Jahre, Ergebnis gefunden / nichts). |
| pl | Przeszukano | Dział Co wie badanie: tabela poszukiwań badania przy osobie (Zapis, Lata, Wynik znaleziono / nic). |

- **Čísla:** [S3.6](cs/S3-what-the-research-knows.md#S3.6)

<a id="phone-connection"></a>
### Propojení s telefonem

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Propojení s telefonem | Služba výzkumu na počítači, přes kterou spárované telefony v téže místní síti vidí výzkum a posílají do něj fotky. Je jedna pro celý počítač; zapíná ji jen člověk. |
| en | Phone connection | A service of the research on the computer through which paired phones on the same local network see the research and send photos into it. One for the whole computer; only a person turns it on. |
| de | Verbindung mit dem Telefon (terminal) · Telefonverbindung (app) | Ein Dienst der Forschung auf dem Computer, über den gekoppelte Telefone im selben lokalen Netz die Forschung sehen und Fotos hineinsenden. Es gibt ihn einmal für den ganzen Computer; einschalten darf ihn nur ein Mensch. |
| pl | Połączenie z telefonem | Usługa badania na komputerze, przez którą sparowane telefony w tej samej sieci lokalnej widzą badanie i wysyłają do niego zdjęcia. Jest jedna dla całego komputera; włącza ją tylko człowiek. |

- **Čísla:** [S5.1](cs/S5-phone.md#S5.1), S5.5, S5.6

<a id="hand-over-to-research"></a>
### Předat výzkumu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Předat výzkumu | Tlačítko stránky telefonu, které uzavře dávku fotek; výzkum z ní udělá úkoly k roztřídění. Bez předání se dávka předá sama hodinu po poslední fotce. |
| en | Hand over to research | A button of the phone page that closes a batch of photos; the research makes tasks to sort it out. Without a hand-over the batch is handed over by itself an hour after the last photo. |
| de | An die Forschung übergeben | Eine Schaltfläche der Seite des Telefons, die einen Stapel Fotos abschließt; die Forschung macht daraus Aufgaben zum Sortieren. Ohne Übergabe wird der Stapel eine Stunde nach dem letzten Foto von selbst übergeben. |
| pl | Przekaż do badania | Przycisk strony telefonu, który zamyka partię zdjęć; badanie robi z niej zadania do posortowania. Bez przekazania partia przekazuje się sama godzinę po ostatnim zdjęciu. |

- **Čísla:** [S5.4](cs/S5-phone.md#S5.4)

<a id="research-overview"></a>
### Přehled výzkumu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Přehled výzkumu (`live.overviewTitle`) | Velký pohled aplikace na sledovaný výzkum: co se teď děje, co čeká, linie, průběh, fronta a co výzkum ví. Jen čte. |
| en | Research overview (`live.overviewTitle`) | The app's large view of the followed research: what is happening now, what waits, directions, progress, the queue and what the research knows. It only reads. |
| de | Forschungsübersicht (`live.overviewTitle`) | Die große Ansicht der App auf die verfolgte Forschung: was gerade geschieht, was wartet, Linien, Verlauf, Warteschlange und was die Forschung weiß. Sie liest nur. |
| pl | Przegląd badania (`live.overviewTitle`) | Duży widok aplikacji na śledzone badanie: co się teraz dzieje, co czeka, linie, przebieg, kolejka i co wie badanie. Tylko czyta. |

- **Čísla:** [S4.1](cs/S4-research-from-the-app.md#S4.1), S4.1.2, S4.2, S4.3, S4.5.2

<a id="load-images-on-import"></a>
### Při importu načítat obrázky

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Při importu načítat obrázky | Nastavení, zda import a otevřený výzkum načtou fotky, přílohy a výřezy pramenů. Text pramenů se zachová vždy. |
| en | Load images when importing | A setting whether an import and an opened research load photos, attachments and source excerpts. The text of sources is always kept. |
| de | Bilder beim Import laden | Eine Einstellung, ob ein Import und eine geöffnete Forschung Fotos, Anhänge und Ausschnitte von Quellen laden. Der Text der Quellen bleibt immer erhalten. |
| pl | Wczytywanie obrazów przy imporcie | Ustawienie, czy import i otwarte badanie wczytują zdjęcia, załączniki i wycinki źródeł. Tekst źródeł zachowuje się zawsze. |

- **Čísla:** [A2.1.1](cs/A2-loading-a-family-tree.md#A2.1.1)

<a id="married-surname"></a>
### Příjmení po sňatku

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Příjmení po sňatku | Příjmení získané sňatkem, vedené zvlášť od rodného příjmení. Rod a tvary jména určuje rodné příjmení. |
| en | Married surname | A surname gained by marriage, kept apart from the birth surname. The family line and the forms of the name are set by the birth surname. |
| de | Ehename | Ein durch Heirat erworbener Nachname, getrennt vom Geburtsnamen geführt. Stammlinie und Namensformen bestimmt der Geburtsname. |
| pl | Nazwisko po ślubie | Nazwisko uzyskane przez ślub, prowadzone osobno od nazwiska rodowego. Ród i formy nazwiska wyznacza nazwisko rodowe. |

- **Čísla:** [A4.6](cs/A4-surnames-and-families.md#A4.6), A4.8

<a id="attachment"></a>
### Příloha

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Přílohy (app) | Soubor u osoby ve stromu (JPG, PNG zmenšené; PDF do 2 MB). Sama nic nedokládá. U stromu s výzkumem jde originál v plné kvalitě do výzkumu. |
| en | Attachments (app) | A file at a person in the tree (JPG, PNG reduced; PDF up to 2 MB). By itself it proves nothing. For a tree with a research the original goes to the research in full quality. |
| de | Anhänge (app) | Eine Datei bei einer Person im Stammbaum (JPG, PNG verkleinert; PDF bis 2 MB). Für sich belegt sie nichts. Bei einem Stammbaum mit Forschung geht das Original in voller Qualität in die Forschung. |
| pl | Załączniki (app) | Plik przy osobie w drzewie (JPG, PNG pomniejszone; PDF do 2 MB). Sam niczego nie dokumentuje. W drzewie z badaniem oryginał w pełnej jakości trafia do badania. |

- **Čísla:** [A3.4](cs/A3-evidence-in-the-app.md#A3.4), A3.4.1

<a id="linked-in-the-view-only"></a>
### Připojeno jen v zobrazení

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Připojeno jen v zobrazení · Ukázat | Verze hypotézy nakreslená do stromu přepínačem Ukázat. Data rodokmenu nemění a patří jen tomuto zařízení. |
| en | Linked in the view only · Show | A version of a hypothesis drawn into the tree by the switch Show. It does not change the family tree's data and belongs only to this device. |
| de | Nur in der Ansicht verbunden · Zeigen | Eine Version einer Hypothese, mit dem Schalter Zeigen in den Stammbaum gezeichnet. Sie ändert die Daten des Stammbaums nicht und gehört nur diesem Gerät. |
| pl | Połączone tylko w widoku · Pokaż | Wersja hipotezy narysowana w drzewie przełącznikiem Pokaż. Nie zmienia danych drzewa genealogicznego i należy tylko do tego urządzenia. |

- **Čísla:** [S3.5.1](cs/S3-what-the-research-knows.md#S3.5.1)

<a id="connect-phone"></a>
### Připojit telefon

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Připojit telefon… | Položka menu **Výzkum → Další** a dialog aplikace, kde se propojení zapíná a vypíná, ukazuje QR kód a seznam spárovaných telefonů. |
| en | Connect phone… | An item of the menu **Research → Other actions** and a dialog of the app where the connection is turned on and off, with the QR code and the list of paired phones. |
| de | Telefon verbinden… | Ein Eintrag des Menüs **Forschung → Weitere Aktionen** und ein Dialog der App, in dem die Verbindung ein- und ausgeschaltet wird, mit dem QR-Code und der Liste gekoppelter Telefone. |
| pl | Połącz telefon… | Pozycja menu **Badanie → Więcej** i dialog aplikacji, w którym włącza się i wyłącza połączenie, z kodem QR i listą sparowanych telefonów. |

- **Čísla:** [S5.1](cs/S5-phone.md#S5.1), S5.2, S5.5, S5.6, S5.7

<a id="family-line"></a>
### Rod

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Rod | Linie po meči od nejstaršího známého nositele jména, určená zakladatelem, ne příjmením. Aplikace ji počítá z dat stromu. |
| en | Family line | The male line from the oldest known bearer of the name, set by its founder, not by the surname. The app computes it from the tree's data. |
| de | Stammlinie | Die männliche Linie vom ältesten bekannten Träger des Namens, bestimmt durch den Stammvater, nicht durch den Nachnamen. Die App berechnet sie aus den Daten des Stammbaums. |
| pl | Ród | Linia męska od najstarszego znanego nosiciela nazwiska, wyznaczona przez założyciela, nie przez nazwisko. Aplikacja liczy ją z danych drzewa. |

- **Čísla:** [A4.1](cs/A4-surnames-and-families.md#A4.1), A4.1.1, A4.2, A4.4

<a id="follow-the-agent"></a>
### Sledovat agenta ve stromu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Sledovat agenta ve stromu (`live.followOn`) · Přestat sledovat (`live.followOff`) | Strom sám přechází na osobu, na které agent právě pracuje. Dotyk stromu to přeruší, po chvíli klidu se to vrátí. |
| en | Follow the agent in the tree (`live.followOn`) · Stop following (`live.followOff`) | The tree moves by itself to the person the agent is working on right now. Touching the tree interrupts it; after a moment of quiet it comes back. |
| de | Agenten im Stammbaum folgen (`live.followOn`) · Nicht mehr folgen (`live.followOff`) | Der Stammbaum wechselt von selbst zu der Person, an der der Agent gerade arbeitet. Eine Berührung des Stammbaums unterbricht das, nach einer Weile Ruhe kehrt es zurück. |
| pl | Śledź agenta w drzewie (`live.followOn`) · Przestań śledzić (`live.followOff`) | Drzewo samo przechodzi do osoby, nad którą agent właśnie pracuje. Dotknięcie drzewa to przerywa, po chwili spokoju wraca. |

- **Čísla:** [S4.1.1](cs/S4-research-from-the-app.md#S4.1.1)

<a id="follow-live"></a>
### Sledovat živě

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Sledovat živě | Změny z výzkumu přicházejí do aplikace samy; sledovaný strom je mezitím jen pro čtení. Sleduje se vždy jen jeden strom. |
| en | Follow live | Changes from the research come into the app by themselves; the followed tree is read-only meanwhile. Only one tree is followed at a time. |
| de | Live verfolgen | Änderungen aus der Forschung kommen von selbst in die App; der verfolgte Stammbaum ist so lange nur zum Lesen. Verfolgt wird immer nur ein Stammbaum. |
| pl | Śledź na żywo | Zmiany z badania przychodzą do aplikacji same; śledzone drzewo jest w tym czasie tylko do odczytu. Śledzi się zawsze tylko jedno drzewo. |

- **Čísla:** [S1.2](cs/S1-connecting-app-and-research.md#S1.2), S1.4, S4.1, S4.5.1, S4.5.2

<a id="merge-with-existing"></a>
### Sloučit s existujícím

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Sloučit s existujícím | Import, který osoby ze souboru spáruje s osobami aktuálního stromu a po potvrzení je sloučí místo založení nového stromu. |
| en | Merge with existing | An import that matches people from the file with people of the current tree and after confirmation merges them instead of creating a new tree. |
| de | Mit Vorhandenem zusammenführen | Ein Import, der Personen aus der Datei mit Personen des aktuellen Stammbaums abgleicht und sie nach Bestätigung zusammenführt, statt einen neuen Stammbaum anzulegen. |
| pl | Scal z istniejącym | Import, który paruje osoby z pliku z osobami bieżącego drzewa i po potwierdzeniu scala je zamiast zakładać nowe drzewo. |

- **Čísla:** [A8.1](cs/A8-merging-trees.md#A8.1), A2.1.1, A2.8, A8.2, A8.3

<a id="paired-phones"></a>
### Spárované telefony

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Spárované telefony | Telefony, které načetly QR kód z tohoto počítače a smějí otevřít stránku výzkumu. Spárování platí do odpojení, do změny adresy počítače, nejdéle 400 dní. |
| en | Paired phones | Phones that read the QR code from this computer and may open the research page. Pairing holds until unpairing, until the computer's address changes, at most 400 days. |
| de | Gekoppelte Telefone | Telefone, die den QR-Code von diesem Computer gescannt haben und die Seite der Forschung öffnen dürfen. Die Kopplung gilt bis zum Trennen, bis zur Änderung der Adresse des Computers, höchstens 400 Tage. |
| pl | Sparowane telefony | Telefony, które zeskanowały kod QR z tego komputera i mogą otwierać stronę badania. Sparowanie obowiązuje do odłączenia, do zmiany adresu komputera, najwyżej 400 dni. |

- **Čísla:** [S5.2](cs/S5-phone.md#S5.2), S5.6

<a id="source-reliability"></a>
### Spolehlivost pramene

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Spolehlivost: Originál · Opis / index · Nejisté (app) | Hodnocení jednoho pramene uživatelem (GEDCOM QUAY 3/2/1). Není to stupeň jistoty údaje. |
| en | Reliability: Original · Copy / index · Uncertain (app) | A user's rating of one source (GEDCOM QUAY 3/2/1). It is not the degree of certainty of a fact. |
| de | Verlässlichkeit: Original · Abschrift / Index · Unsicher (app) | Die Bewertung einer Quelle durch den Nutzer (GEDCOM QUAY 3/2/1). Sie ist nicht der Grad der Sicherheit einer Angabe. |
| pl | Wiarygodność: Oryginał · Odpis / indeks · Niepewne (app) | Ocena jednego źródła przez użytkownika (GEDCOM QUAY 3/2/1). Nie jest to stopień pewności danej. |

- **Čísla:** [A3.1](cs/A3-evidence-in-the-app.md#A3.1), [R3.2.1](cs/R3-verification-and-citation.md#R3.2.1)

<a id="research-on-this-computer"></a>
### Strom Research na tomto počítači

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Strom Research na tomto počítači (`research.linksSetting`) | Nastavení, které v aplikaci zapne akce otevírající výzkum na tomtéž počítači (odkazy `strom-research://`). |
| en | Strom Research on this computer (`research.linksSetting`) | A setting that turns on in the app the actions that open the research on the same computer (links `strom-research://`). |
| de | Strom Research auf diesem Computer (`research.linksSetting`) | Eine Einstellung, die in der App die Aktionen einschaltet, die die Forschung auf demselben Computer öffnen (Links `strom-research://`). |
| pl | Strom Research na tym komputerze (`research.linksSetting`) | Ustawienie, które włącza w aplikacji akcje otwierające badanie na tym samym komputerze (odnośniki `strom-research://`). |

- **Čísla:** [S4.5](cs/S4-research-from-the-app.md#S4.5)

<a id="research-tree"></a>
### Strom z výzkumu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Výzkum (v přepínači stromů) | Strom v aplikaci spojený s výzkumem na tomto počítači; nese číslo výzkumu a verzi, ze které vznikl. |
| en | Research (in the tree switcher) | A tree in the app connected with a research on this computer; it carries the research's number and the version it came from. |
| de | Forschung (im Stammbaum-Umschalter) | Ein Stammbaum in der App, verbunden mit einer Forschung auf diesem Computer; er trägt die Nummer der Forschung und die Version, aus der er entstand. |
| pl | Badanie (w przełączniku drzew) | Drzewo w aplikacji połączone z badaniem na tym komputerze; nosi numer badania i wersję, z której powstało. |

- **Čísla:** [S1.3](cs/S1-connecting-app-and-research.md#S1.3), S1.7

<a id="surname-spellings"></a>
### Tvary příjmení

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Tvary příjmení | Skupiny zápisů jednoho jména, které platí pro celý strom; hledání, slučování a rody je berou jako jedno jméno. |
| en | Surname spellings | Groups of spellings of one name that hold for the whole tree; search, merging and family lines take them as one name. |
| de | Namensschreibweisen | Gruppen von Schreibweisen eines Namens, die für den ganzen Stammbaum gelten; Suche, Zusammenführen und Stammlinien nehmen sie als einen Namen. |
| pl | Formy nazwiska | Grupy zapisów jednego nazwiska, które obowiązują w całym drzewie; wyszukiwanie, scalanie i rody traktują je jak jedno nazwisko. |

- **Čísla:** [A4.5](cs/A4-surnames-and-families.md#A4.5), A4.7

<a id="central-person"></a>
### Ústřední osoba

| Jazyk | Termín | Definice |
|---|---|---|
| cs | ústřední osoba | Osoba, kolem které pohled ukazuje okolí; mění se klikem na kartu. Pohled neukazuje celý strom, jen okolí této osoby. |
| en | central person | The person whose surroundings a view shows; it changes with a click on a card. The view does not show the whole tree, only the surroundings of this person. |
| de | zentrale Person | Die Person, um die herum eine Ansicht die Umgebung zeigt; sie wechselt mit einem Klick auf eine Karte. Die Ansicht zeigt nicht den ganzen Stammbaum, nur die Umgebung dieser Person. |
| pl | osoba w centrum | Osoba, wokół której widok pokazuje otoczenie; zmienia się kliknięciem karty. Widok nie pokazuje całego drzewa, tylko otoczenie tej osoby. |

- **Čísla:** [A6.1](cs/A6-views.md#A6.1), A1.3, A6.1.1, A6.6

<a id="duplicate-verdict"></a>
### Verdikt výzkumu u duplicity

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Pravděpodobně táž osoba · Dvě osoby · Nejisté · Ve výzkumu sloučeno (app) · `strom person compare` (terminal) | Jak výzkum posoudil dvojici možné duplicity podle svých dat: rodičů, let, pohlaví a zápisů v pramenech. |
| en | Probably the same person · Two people · Uncertain · Merged in the research (app) · `strom person compare` (terminal) | How the research judged a pair of a possible duplicate by its data: parents, years, sex and entries in the sources. |
| de | Wahrscheinlich dieselbe Person · Zwei Personen · Unsicher · In der Forschung zusammengeführt (app) · `strom person compare` (terminal) | Wie die Forschung ein Paar einer möglichen doppelten Person nach ihren Daten bewertet hat: Eltern, Jahre, Geschlecht und Einträge in den Quellen. |
| pl | Prawdopodobnie ta sama osoba · Dwie osoby · Niepewne · Scalono w badaniu (app) · `strom person compare` (terminal) | Jak badanie oceniło parę możliwego duplikatu według swoich danych: rodziców, lat, płci i zapisów w źródłach. |

- **Čísla:** [A5.6.1](cs/A5-tree-check.md#A5.6.1)

<a id="undo-send"></a>
### Vrátit poslední poslání

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Vrátit poslední poslání | Výzkum vezme zpět změny jednoho poslání; úpravy v aplikaci zůstanou. Z aplikace do 7 dní, potvrzení v terminálu. |
| en | Undo last send | The research takes back the changes of one send; the edits in the app stay. From the app within 7 days, confirmed in the terminal. |
| de | Letztes Senden zurücknehmen | Die Forschung nimmt die Änderungen eines Sendens zurück; die Änderungen in der App bleiben. Aus der App innerhalb von 7 Tagen, bestätigt im Terminal. |
| pl | Cofnij ostatnie wysłanie | Badanie wycofuje zmiany jednego wysłania; zmiany w aplikacji zostają. Z aplikacji w ciągu 7 dni, potwierdzenie w terminalu. |

- **Čísla:** [S2.1](cs/S2-edits-from-the-app.md#S2.1), S2.7

<a id="record-excerpt"></a>
### Výřez zápisu

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Výřez zápisu (app) | Obrázek jen toho zápisu, ne celé strany. V aplikaci nejvýš dva u pramene, JPEG do 1200 px; výzkum zapisuje až tři. |
| en | Excerpt of the entry (app) | An image of only that entry, not the whole page. In the app at most two per source, JPEG up to 1200 px; the research writes up to three. |
| de | Ausschnitt des Eintrags (app) | Ein Bild nur dieses Eintrags, nicht der ganzen Seite. In der App höchstens zwei bei einer Quelle, JPEG bis 1200 px; die Forschung schreibt bis zu drei. |
| pl | Wycinek zapisu (app) | Obraz tylko tego zapisu, nie całej strony. W aplikacji najwyżej dwa przy źródle, JPEG do 1200 px; badanie zapisuje do trzech. |

- **Čísla:** [A3.3](cs/A3-evidence-in-the-app.md#A3.3), [R3.4](cs/R3-verification-and-citation.md#R3.4), R8.6

<a id="research-not-running"></a>
### Výzkum neběží

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Výzkum neběží | Most výzkumu neodpovídá. Strom jde dál upravovat, úpravy počkají a pošlou se po spuštění výzkumu. |
| en | The research isn't running | The research's bridge does not answer. The tree can still be edited; edits wait and are sent after the research starts. |
| de | Die Forschung läuft nicht | Die Brücke der Forschung antwortet nicht. Der Stammbaum lässt sich weiter bearbeiten; die Änderungen warten und werden nach dem Start der Forschung gesendet. |
| pl | Badanie nie działa | Most badania nie odpowiada. Drzewo można dalej edytować, zmiany poczekają i zostaną wysłane po uruchomieniu badania. |

- **Čísla:** [S1.5](cs/S1-connecting-app-and-research.md#S1.5), S2.2

<a id="phone-page"></a>
### Výzkum Strom (stránka telefonu)

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Výzkum Strom | Stránka, kterou výzkum z počítače posílá do prohlížeče spárovaného telefonu: stav výzkumu jen ke čtení a posílání fotek. Není to aplikace Strom. |
| en | Strom research | The page the research on the computer serves to the browser of a paired phone: the research's state read-only and sending photos. It is not the Strom app. |
| de | Strom-Forschung | Die Seite, die die Forschung vom Computer an den Browser eines gekoppelten Telefons sendet: der Stand der Forschung nur zum Lesen und das Senden von Fotos. Sie ist nicht die Strom-App. |
| pl | Badania Strom | Strona, którą badanie z komputera wysyła do przeglądarki sparowanego telefonu: stan badania tylko do odczytu i wysyłanie zdjęć. To nie jest aplikacja Strom. |

- **Čísla:** [S5.3](cs/S5-phone.md#S5.3), S5.3.1, S5.4, S5.5, S5.7

<a id="send-refused"></a>
### Výzkum úpravy nepřijal

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Výzkum úpravy nepřijal | Výzkum poslání odmítl celé (velikost, jiný výzkum, cizí rodokmen, prázdný strom). Úpravy zůstávají v aplikaci. |
| en | The research didn't accept the changes | The research refused a send as a whole (size, another research, a foreign family tree, an empty tree). The edits stay in the app. |
| de | Die Forschung hat die Änderungen nicht angenommen | Die Forschung hat ein Senden als Ganzes abgelehnt (Größe, eine andere Forschung, ein fremder Stammbaum, ein leerer Stammbaum). Die Änderungen bleiben in der App. |
| pl | Badanie nie przyjęło zmian | Badanie odrzuciło wysłanie w całości (rozmiar, inne badanie, cudze drzewo genealogiczne, puste drzewo). Zmiany zostają w aplikacji. |

- **Čísla:** [S2.5](cs/S2-edits-from-the-app.md#S2.5)

<a id="story-basis"></a>
### Z čeho text vychází

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Z čeho text vychází (N) (app) | Sbalený oddíl pod vyprávěním: prameny vyprávění bez duplicit (webová adresa jako odkaz), fakta, ze kterých text vychází, a poznámka autora. N je počet pramenů. |
| en | What the text is based on (N) (app) | A folded section under a story: the story's sources without duplicates (a web address as a link), the facts the text is based on and the author's note. N is the number of sources. |
| de | Grundlage des Textes (N) (app) | Ein eingeklappter Abschnitt unter einer Erzählung: die Quellen der Erzählung ohne Doppelungen (eine Webadresse als Link), die Fakten, auf denen der Text beruht, und die Anmerkung des Autors. N ist die Zahl der Quellen. |
| pl | Na czym opiera się tekst (N) (app) | Zwinięta sekcja pod opowieścią: źródła opowieści bez powtórzeń (adres internetowy jako link), fakty, na których opiera się tekst, i notatka autora. N to liczba źródeł. |

- **Čísla:** [A3.6](cs/A3-evidence-in-the-app.md#A3.6), R3.9

<a id="placeholder-person"></a>
### Zástupná osoba

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Zástupná osoba | Osoba bez jména i příjmení („?“), kterou aplikace doplní za chybějícího rodiče nebo přebere ze souboru. Při sloučení se nepáruje. |
| en | Placeholder person | A person without a first name or a surname ("?") whom the app adds for a missing parent or takes over from the file. Not matched when merging. |
| de | Platzhalterperson | Eine Person ohne Vor- und Nachnamen („?“), die die App für einen fehlenden Elternteil ergänzt oder aus der Datei übernimmt. Beim Zusammenführen wird sie nicht abgeglichen. |
| pl | Osoba zastępcza | Osoba bez imienia i nazwiska („?”), którą aplikacja dodaje za brakującego rodzica albo przejmuje z pliku. Przy scalaniu się jej nie paruje. |

- **Čísla:** [A2.1.1](cs/A2-loading-a-family-tree.md#A2.1.1), A2.3, A2.5, A8.2

<a id="surname-display"></a>
### Zobrazení příjmení

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Zobrazení příjmení | Nastavení, zda karty a jména ukazují rodné příjmení, příjmení po sňatku s rodným, nebo jen příjmení po sňatku. |
| en | Surname display | A setting whether cards and names show the birth surname, the married surname with the birth one, or only the married surname. |
| de | Nachname anzeigen | Eine Einstellung, ob Karten und Namen den Geburtsnamen, den Ehenamen mit dem Geburtsnamen oder nur den Ehenamen zeigen. |
| pl | Wyświetlanie nazwiska | Ustawienie, czy karty i imiona pokazują nazwisko rodowe, nazwisko po ślubie z rodowym, czy tylko nazwisko po ślubie. |

- **Čísla:** [A4.6](cs/A4-surnames-and-families.md#A4.6)

<a id="living-person"></a>
### Žijící osoba

| Jazyk | Termín | Definice |
|---|---|---|
| cs | Žijící osoba | Osoba, kterou aplikace pro ochranu žijících považuje za žijící: bez úmrtí a s nejpozdějším možným narozením před méně než 110 lety, nebo bez roku narození. |
| en | Living person | A person the app treats as living for the privacy of living people: without a death and with the latest possible birth less than 110 years ago, or without a year of birth. |
| de | Lebende Person | Eine Person, die die App für den Schutz lebender Personen als lebend ansieht: ohne Tod und mit der spätestmöglichen Geburt vor weniger als 110 Jahren oder ohne Geburtsjahr. |
| pl | Osoba żyjąca | Osoba, którą aplikacja na potrzeby ochrony osób żyjących uważa za żyjącą: bez zgonu i z najpóźniejszym możliwym urodzeniem mniej niż 110 lat temu albo bez roku urodzenia. |

- **Čísla:** [A7.1](cs/A7-book-pages-and-export.md#A7.1)
