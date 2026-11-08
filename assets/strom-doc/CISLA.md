# Rejstřík čísel

Každé číslo kapitoly a pravidla „Jak Strom funguje“: kde je, od které verze platí, v jakém je stavu a jak se jmenuje
v každém jazyce. Číslo se nikdy nepřečísluje ani znovu nepoužije (viz [MAINTAINING.md](MAINTAINING.md)).
Kontrola: `node scripts/check-numbers.mjs`.

Stav rejstříku: **platí** od 4. 11. 2026 (části R, A a S schválené). Čísla R, A a S jsou trvalá. Řádky ve stavu `plán` nebo
`koncept` se ještě mohou změnit, dokud text není schválený.

Stav: `platí` (od verze ve sloupci Platí od) · `koncept` (napsáno, čeká na schválení) · `plán` (ještě
nenapsáno) · `neplatí od <verze>`.

| Číslo | Soubor | Platí od | Stav | cs | en | de | pl |
|---|---|---|---|---|---|---|---|
| R1 | R1-research-in-brief.md | výzkum 1.0.0 | platí | Výzkum v kostce | The research in brief | Die Forschung im Überblick | Badanie w skrócie |
| R1.1 | R1-research-in-brief.md | výzkum 1.0.0 | platí | Výzkum je záznam, ne rozhovor | The research is a record, not a conversation | Die Forschung ist eine Aufzeichnung, kein Gespräch | Badanie to zapis, nie rozmowa |
| R1.2 | R1-research-in-brief.md | výzkum 1.0.0 | platí | Na čem agent pracuje | What the agent works on | Woran der Agent arbeitet | Nad czym agent pracuje |
| R1.3 | R1-research-in-brief.md | výzkum 1.0.0 | platí | Jak agent pracuje: sezení | How the agent works: sessions | Wie der Agent arbeitet: Sitzungen | Jak agent pracuje: sesje |
| R1.4 | R1-research-in-brief.md | výzkum 1.0.0 | platí | Jak výzkum váží důkazy | How the research weighs evidence | Wie die Forschung Beweise gewichtet | Jak badanie waży dowody |
| R1.5 | R1-research-in-brief.md | výzkum 1.0.0 | platí | Co rozhoduje člověk | What a person decides | Was der Mensch entscheidet | Co rozstrzyga człowiek |
| R1.6 | R1-research-in-brief.md | výzkum 1.0.0 | platí | Výzkum a aplikace Strom | The research and the Strom app | Die Forschung und die Strom-App | Badanie i aplikacja Strom |
| R1.7 | R1-research-in-brief.md | výzkum 1.0.0 | platí | Jak výzkum čte skeny | How the research reads scans | Wie die Forschung Scans liest | Jak badanie czyta skany |
| R1.8 | R1-research-in-brief.md | výzkum 1.28.0 | platí | Jak Strom funguje: `strom doc` | How Strom works: `strom doc` | So funktioniert Strom: `strom doc` | Jak działa Strom: `strom doc` |
| R2 | R2-lines-and-queue.md | výzkum 1.0.0 | platí | Linie a fronta | Lines and the queue | Linien und Warteschlange | Linie i kolejka |
| R2.1 | R2-lines-and-queue.md | výzkum 1.0.0 | platí | Linie určuje, co výzkum zkoumá | A line sets what the research investigates | Die Linie bestimmt, was die Forschung untersucht | Linia wyznacza, co badanie bada |
| R2.1.1 | R2-lines-and-queue.md | výzkum 1.0.0 | platí | Druhy linií a meze | Kinds of lines and their limits | Arten von Linien und Grenzen | Rodzaje linii i ograniczenia |
| R2.1.2 | R2-lines-and-queue.md | výzkum 1.8.0 | platí | Pozastavená a ukončená linie | A paused and an ended line | Pausierte und beendete Linie | Linia wstrzymana i zakończona |
| R2.1.3 | R2-lines-and-queue.md | výzkum 1.0.0 | platí | Kdo do linie patří | Who belongs to a line | Wer zu einer Linie gehört | Kto należy do linii |
| R2.1.4 | R2-lines-and-queue.md | výzkum 1.26.0 | platí | Pořadí linií je pořadí práce | The order of the lines is the order of work | Die Reihenfolge der Linien ist die Reihenfolge der Arbeit | Kolejność linii to kolejność pracy |
| R2.2 | R2-lines-and-queue.md | výzkum 1.0.0 | platí | Fronta určuje, který úkol přijde na řadu | The queue sets which task comes next | Die Warteschlange bestimmt, welche Aufgabe an die Reihe kommt | Kolejka wyznacza, które zadanie przychodzi na kolej |
| R2.2.1 | R2-lines-and-queue.md | výzkum 1.0.0 | platí | Strategie fronty | The queue strategy | Strategie der Warteschlange | Strategia kolejki |
| R2.2.2 | R2-lines-and-queue.md | výzkum 1.1.0 | platí | Vyprávění na řadě | A story is due | Erzählung an der Reihe | Opowieść na kolei |
| R2.2.3 | R2-lines-and-queue.md | výzkum 1.9.0 | platí | Úkoly, které čekají mimo frontu | Tasks that wait outside the queue | Aufgaben, die außerhalb der Warteschlange warten | Zadania, które czekają poza kolejką |
| R2.3 | R2-lines-and-queue.md | výzkum 1.25.0 | platí | Práce mimo linie | Work off the lines | Arbeit außerhalb der Linien | Praca poza liniami |
| R2.3.1 | R2-lines-and-queue.md | výzkum 1.26.0 | platí | Volba pro jednu větev a jeden úkol | A choice for one branch and one task | Wahl für einen Zweig und eine Aufgabe | Wybór dla jednej gałęzi i jednego zadania |
| R2.3.2 | R2-lines-and-queue.md | výzkum 1.26.0 | platí | Rostoucí větev dostane návrh linie | A growing branch gets a line proposed | Ein wachsender Zweig bekommt einen Vorschlag für eine Linie | Rosnąca gałąź dostaje propozycję linii |
| R2.4 | R2-lines-and-queue.md | výzkum 1.26.0 | platí | Proč úkol stojí, kde stojí | Why a task stands where it stands | Warum eine Aufgabe steht, wo sie steht | Dlaczego zadanie stoi tam, gdzie stoi |
| R3 | R3-verification-and-citation.md | výzkum 1.0.0 | platí | Ověřování a citace | Verification and citation | Prüfung und Zitation | Weryfikacja i cytowanie |
| R3.1 | R3-verification-and-citation.md | výzkum 1.0.0 | platí | Stupně jistoty údaje | Degrees of certainty of a fact | Grade der Sicherheit einer Angabe | Stopnie pewności danej |
| R3.1.1 | R3-verification-and-citation.md | výzkum 1.0.0 | platí | Výchozí stupeň a citace, která ho zvedne | The default degree and the citation that raises it | Standardgrad und die Zitation, die ihn hebt | Stopień domyślny i cytat, który go podnosi |
| R3.2 | R3-verification-and-citation.md | výzkum 1.0.0 | platí | Co kód pustí jako Pravděpodobné a Doložené | What the code lets through as Probable and Proven | Was der Code als Wahrscheinlich und Belegt durchlässt | Co kod przepuszcza jako Prawdopodobne i Udokumentowane |
| R3.2.1 | R3-verification-and-citation.md | výzkum 1.0.0 | platí | Pramen: forma a informace | A source: form and information | Quelle: Form und Information | Źródło: forma i informacja |
| R3.3 | R3-verification-and-citation.md | výzkum 1.0.0 | platí | Pramen, nebo vodítko | A source, or a lead | Quelle oder Hinweis | Źródło czy wskazówka |
| R3.4 | R3-verification-and-citation.md | výzkum 1.1.0 | platí | Citace: výřez a přepis | A citation: clip and transcription | Zitation: Ausschnitt und Abschrift | Cytat: wycinek i transkrypcja |
| R3.4.1 | R3-verification-and-citation.md | výzkum 1.29.0, aplikace 3.25.0 | platí | Přepis člověka mění jen člověk | Only a person changes a person's transcription | Die Abschrift eines Menschen ändert nur der Mensch | Transkrypcję człowieka zmienia tylko człowiek |
| R3.4.2 | R3-verification-and-citation.md | výzkum 1.29.0 | platí | Překrývající se výřezy jsou jeden | Overlapping clips are one | Überlappende Ausschnitte sind einer | Nakładające się wycinki są jednym |
| R3.5 | R3-verification-and-citation.md | výzkum 1.0.0 | platí | Slepé druhé čtení | A blind second reading | Blinde zweite Lesung | Ślepy drugi odczyt |
| R3.5.1 | R3-verification-and-citation.md | výzkum 1.12.0, aplikace 3.9.0 | platí | Přepisy a čtení z aplikace | Transcriptions and readings from the app | Abschriften und Lesungen aus der App | Transkrypcje i odczyty z aplikacji |
| R3.6 | R3-verification-and-citation.md | výzkum 1.0.0 | platí | Negativní hledání | A negative search | Negative Suche | Negatywne wyszukiwanie |
| R3.7 | R3-verification-and-citation.md | výzkum 1.0.0 | platí | Kdy se agent ptá člověka | When the agent asks a person | Wann der Agent den Menschen fragt | Kiedy agent pyta człowieka |
| R3.8 | R3-verification-and-citation.md | aplikace 3.5.0 | platí | Jak doložení ukazuje aplikace | How the app shows evidence | Wie die App Belege zeigt | Jak udokumentowanie pokazuje aplikacja |
| R3.8.1 | R3-verification-and-citation.md | aplikace 3.5.0 | platí | Úroveň doložení osoby | The documentation level of a person | Belegstufe einer Person | Poziom udokumentowania osoby |
| R3.9 | R3-verification-and-citation.md | výzkum 1.26.0 | platí | Vyprávění drží své prameny | A story keeps its sources | Eine Erzählung behält ihre Quellen | Opowieść zachowuje swoje źródła |
| R3.9.1 | R3-verification-and-citation.md | výzkum 1.0.0 | platí | Co vyprávění tvrdí | What a story claims | Was eine Erzählung behauptet | Co twierdzi opowieść |
| R4 | R4-places.md | výzkum 1.22.0 | platí | Místa | Places | Orte | Miejsca |
| R4.1 | R4-places.md | výzkum 1.25.0 | platí | Místo dostane polohu, jen když je jisté | A place gets a position only when it is certain | Ein Ort bekommt eine Lage nur, wenn er sicher ist | Miejsce dostaje położenie, tylko gdy jest pewne |
| R4.1.1 | R4-places.md | výzkum 1.25.2 | platí | Stejné jméno, jiné místo | The same name, a different place | Gleicher Name, anderer Ort | Ta sama nazwa, inne miejsce |
| R4.1.2 | R4-places.md | výzkum 1.25.0 | platí | Nedohledané místo se vrátí samo | A place not located comes back by itself | Ein nicht gefundener Ort kommt von selbst zurück | Nieodnalezione miejsce wraca samo |
| R4.2 | R4-places.md | výzkum 1.25.0 | platí | Názvy a příslušnost místa | The names and jurisdiction of a place | Namen und Zugehörigkeit eines Ortes | Nazwy i przynależność miejsca |
| R4.2.1 | R4-places.md | výzkum 1.25.0 | platí | Jak údaje zapisují místo | How facts write a place | Wie Angaben einen Ort schreiben | Jak dane zapisują miejsce |
| R4.3 | R4-places.md | výzkum 1.25.0 | platí | Polohu zadanou člověkem výzkum nemění | The research does not change a position set by a person | Eine vom Menschen eingetragene Lage ändert die Forschung nicht | Położenia wprowadzonego przez człowieka badanie nie zmienia |
| R4.4 | R4-places.md | výzkum 1.25.0 | platí | Fronta míst | The places queue | Warteschlange der Orte | Kolejka miejsc |
| R4.4.1 | R4-places.md | aplikace 3.21.0 | platí | Kdy aplikace hlásí Ověřit | When the app reports Check | Wann die App Prüfen meldet | Kiedy aplikacja zgłasza Do sprawdzenia |
| R4.5 | R4-places.md | výzkum 1.25.0 | platí | Otázky k místům v Čeká na vyřízení | Questions about places in Awaiting action | Fragen zu Orten in Wartet auf Bearbeitung | Pytania o miejsca w Czeka na decyzję |
| R4.5.1 | R4-places.md | výzkum 1.25.2 | platí | Vrácení kroku | Undoing a step | Rücknahme eines Schritts | Cofnięcie kroku |
| R4.6 | R4-places.md | výzkum 1.24.0 | platí | Místa z jiných výzkumů na tomto počítači | Places from other researches on this computer | Orte aus anderen Forschungen auf diesem Computer | Miejsca z innych badań na tym komputerze |
| R4.7 | R4-places.md | výzkum 1.22.0 | platí | Dějiny míst | Local history | Geschichte der Orte | Historia miejsc |
| R5 | R5-conflicts.md | výzkum 1.0.0 | platí | Rozpory | Conflicts | Widersprüche | Sprzeczności |
| R5.1 | R5-conflicts.md | výzkum 1.0.0 | platí | Rozpor zapisuje, že se prameny neshodují | A conflict records that the sources disagree | Ein Widerspruch hält fest, dass die Quellen nicht übereinstimmen | Sprzeczność zapisuje, że źródła się nie zgadzają |
| R5.1.1 | R5-conflicts.md | výzkum 1.0.0 | platí | Jiní rodiče znamenají dvě osoby, ne rozpor | Other parents mean two persons, not a conflict | Andere Eltern bedeuten zwei Personen, keinen Widerspruch | Inni rodzice oznaczają dwie osoby, nie sprzeczność |
| R5.2 | R5-conflicts.md | výzkum 1.5.0 | platí | Úprava z aplikace u údaje doloženého záznamem se stane rozporem | An edit from the app to a fact a record documents becomes a conflict | Eine Änderung aus der App an einer durch einen Eintrag belegten Angabe wird zum Widerspruch | Zmiana z aplikacji przy danej udokumentowanej aktem staje się sprzecznością |
| R5.2.1 | R5-conflicts.md | výzkum 1.5.0 | platí | Když platí úprava z aplikace | When the edit from the app wins | Wenn die Änderung aus der App gilt | Kiedy obowiązuje zmiana z aplikacji |
| R5.3 | R5-conflicts.md | výzkum 1.0.0 | platí | Kdo rozpor rozhoduje | Who decides a conflict | Wer einen Widerspruch entscheidet | Kto rozstrzyga sprzeczność |
| R5.3.1 | R5-conflicts.md | výzkum 1.12.0 | platí | Rozpor z úpravy se rozhoduje stranou | A conflict from an edit is decided by a side | Ein Widerspruch aus einer Änderung wird durch eine Seite entschieden | Sprzeczność ze zmiany rozstrzyga się stroną |
| R5.4 | R5-conflicts.md | výzkum 1.14.0 | platí | Rozhodnutí člověka platí | A person's decision holds | Die Entscheidung des Menschen gilt | Decyzja człowieka obowiązuje |
| R5.5 | R5-conflicts.md | výzkum 1.10.0 | platí | Co agent nepřepíše | What the agent does not overwrite | Was der Agent nicht überschreibt | Czego agent nie nadpisze |
| R5.6 | R5-conflicts.md | aplikace 3.4.0 | platí | Kde jsou rozpory vidět a kde se rozhodují | Where conflicts are seen and where they are decided | Wo Widersprüche zu sehen sind und wo sie entschieden werden | Gdzie widać sprzeczności i gdzie się je rozstrzyga |
| R5.6.1 | R5-conflicts.md | aplikace 3.11.0 s výzkumem 1.14.0 | platí | Co jde rozhodnout stranou z aplikace | What can be decided by a side from the app | Was sich aus der App durch eine Seite entscheiden lässt | Co można rozstrzygnąć stroną z aplikacji |
| R6 | R6-awaiting-action.md | výzkum 1.3.0 | platí | Čeká na vyřízení | Awaiting action | Wartet auf Bearbeitung | Czeka na decyzję |
| R6.1 | R6-awaiting-action.md | výzkum 1.3.0 | platí | Co čeká je jeden seznam | What waits is one list | Was wartet, ist eine einzige Liste | Co czeka to jedna lista |
| R6.1.1 | R6-awaiting-action.md | výzkum 1.21.0 | platí | Počet a co je jen v terminálu | The count and what is only in the terminal | Die Zahl und was nur im Terminal ist | Liczba i co jest tylko w terminalu |
| R6.2 | R6-awaiting-action.md | výzkum 1.0.0 | platí | Úkol čeká na člověka | A task waits for a person | Eine Aufgabe wartet auf den Menschen | Zadanie czeka na człowieka |
| R6.2.1 | R6-awaiting-action.md | výzkum 1.0.0 | platí | Snímky uložené ručně | Images saved by hand | Von Hand gespeicherte Bilder | Skany zapisane ręcznie |
| R6.2.2 | R6-awaiting-action.md | výzkum 1.14.0 | platí | Ověřit web | A site to check | Seite prüfen | Witryna do sprawdzenia |
| R6.3 | R6-awaiting-action.md | výzkum 1.14.0 | platí | Rozhodnutí | Decisions | Entscheidungen | Decyzje |
| R6.3.1 | R6-awaiting-action.md | výzkum 1.14.0 | platí | Svolení archivu | An archive's permission | Erlaubnis eines Archivs | Zgoda archiwum |
| R6.3.2 | R6-awaiting-action.md | výzkum 1.14.0 | platí | Vyprávění ke schválení | A story to approve | Erzählung zur Freigabe | Opowieść do zatwierdzenia |
| R6.3.3 | R6-awaiting-action.md | výzkum 1.26.0 | platí | Větve mimo linie | Branches off the lines | Zweige außerhalb der Linien | Gałęzie poza liniami |
| R6.3.4 | R6-awaiting-action.md | výzkum 1.28.0 | platí | Hypotézy k rozhodnutí | Hypotheses to decide | Hypothesen zu entscheiden | Hipotezy do rozstrzygnięcia |
| R6.4 | R6-awaiting-action.md | výzkum 1.14.0 | platí | Skupiny a pořadí | Groups and order | Gruppen und Reihenfolge | Grupy i kolejność |
| R6.5 | R6-awaiting-action.md | výzkum 1.14.0 | platí | Co jde vyřídit kde | What can be dealt with where | Was sich wo erledigen lässt | Co można załatwić gdzie |
| R6.6 | R6-awaiting-action.md | výzkum 1.14.0 | platí | Co smí jen člověk | What only a person may do | Was nur der Mensch darf | Co może tylko człowiek |
| R6.7 | R6-awaiting-action.md | výzkum 1.14.0 | platí | Odesláno, odpověď a návrat do fronty | Sent, the answer and the return to the queue | Gesendet, Antwort und Rückkehr in die Warteschlange | Wysłano, odpowiedź i powrót do kolejki |
| R6.7.1 | R6-awaiting-action.md | výzkum 1.3.0 | platí | Odpověď souborem nebo slovy | An answer as a file or in words | Antwort als Datei oder in Worten | Odpowiedź plikiem lub słowami |
| R6.7.2 | R6-awaiting-action.md | výzkum 1.0.0 | platí | Kdy se úkol vrátí sám a odložení | When a task returns by itself, and parking | Wann eine Aufgabe von selbst zurückkehrt, und das Zurückstellen | Kiedy zadanie wraca samo i odłożenie |
| R7 | R7-when-the-agent-works.md | výzkum 1.0.0 | platí | Kdy a jak dlouho agent pracuje | When and how long the agent works | Wann und wie lange der Agent arbeitet | Kiedy i jak długo agent pracuje |
| R7.1 | R7-when-the-agent-works.md | výzkum 1.0.0 | platí | Samostatná práce běží po sezeních | Working alone runs in sessions | Die Arbeit allein läuft in Sitzungen | Samodzielna praca przebiega sesjami |
| R7.1.1 | R7-when-the-agent-works.md | výzkum 1.0.0 | platí | Proč běh skončí | Why a run ends | Warum ein Lauf endet | Dlaczego przebieg się kończy |
| R7.2 | R7-when-the-agent-works.md | výzkum 1.0.0 | platí | Každé sezení má časový limit | Each session has a time limit | Jede Sitzung hat ein Zeitlimit | Każda sesja ma limit czasu |
| R7.3 | R7-when-the-agent-works.md | výzkum 1.8.0 | platí | Sezení jde požádat o dokončení | A session can be asked to finish | Eine Sitzung lässt sich um Abschluss bitten | Sesję można poprosić o dokończenie |
| R7.4 | R7-when-the-agent-works.md | výzkum 1.2.0 | platí | Podmínka rozhoduje, zda začne další sezení | A condition decides whether the next session starts | Die Bedingung entscheidet, ob die nächste Sitzung beginnt | Warunek rozstrzyga, czy zacznie się kolejna sesja |
| R7.4.1 | R7-when-the-agent-works.md | výzkum 1.2.0 | platí | Ručně spuštěné úkoly: „Spustit přesto?“ | Tasks started by hand: “Start anyway?” | Von Hand gestartete Aufgaben: „Trotzdem starten?“ | Zadania uruchomione ręcznie: „Uruchomić mimo to?” |
| R7.4.2 | R7-when-the-agent-works.md | výzkum 1.14.0 | platí | Strop: pevná hranice | The cap: a hard limit | Obergrenze: eine feste Grenze | Pułap: sztywna granica |
| R7.4.3 | R7-when-the-agent-works.md | výzkum 1.14.0 | platí | Záznam odpovědí podmínky | The record of the condition's answers | Aufzeichnung der Antworten der Bedingung | Zapis odpowiedzi warunku |
| R7.5 | R7-when-the-agent-works.md | výzkum 1.2.0 | platí | Podmínka claude-usage drží tempo týdne | The claude-usage condition keeps the week's pace | Die Bedingung claude-usage hält das Tempo der Woche | Warunek claude-usage trzyma tempo tygodnia |
| R7.5.1 | R7-when-the-agent-works.md | výzkum 1.15.0 | platí | Začátek týdne | The start of the week | Anfang der Woche | Początek tygodnia |
| R7.5.2 | R7-when-the-agent-works.md | výzkum 1.22.0 | platí | Přídavek po čekání | The extra after waiting | Zuschlag nach dem Warten | Dodatek po czekaniu |
| R7.5.3 | R7-when-the-agent-works.md | výzkum 1.2.0 | platí | Jak dlouho čeká | How long it waits | Wie lange sie wartet | Jak długo czeka |
| R7.5.4 | R7-when-the-agent-works.md | výzkum 1.14.0 | platí | Strop týdne | The week's cap | Obergrenze der Woche | Pułap tygodnia |
| R7.6 | R7-when-the-agent-works.md | výzkum 1.0.0 | platí | Limit předplatného zastaví běh | The subscription limit stops the run | Das Limit des Abonnements hält den Lauf an | Limit subskrypcji zatrzymuje przebieg |
| R7.7 | R7-when-the-agent-works.md | výzkum 1.25.2 | platí | Nepřihlášený agent | An agent not logged in | Ein nicht angemeldeter Agent | Niezalogowany agent |
| R7.8 | R7-when-the-agent-works.md | výzkum 1.12.0 | platí | Archiv Stromu: výzkum, na kterém agent nepracuje | Strom archive: a research the agent does not work on | Strom-Archiv: eine Forschung, an der kein Agent arbeitet | Archiwum Strom: badanie, nad którym agent nie pracuje |
| R7.8.1 | R7-when-the-agent-works.md | výzkum 1.15.0 | platí | Výzkum čeká na agenta | A research waiting for an agent | Eine Forschung wartet auf einen Agenten | Badanie czeka na agenta |
| R8 | R8-reading-scans.md | výzkum 1.0.0 | platí | Hledání a čtení záznamů ve skenech | Finding and reading entries in scans | Einträge in Scans finden und lesen | Wyszukiwanie i odczyt wpisów w skanach |
| R8.1 | R8-reading-scans.md | výzkum 1.0.0 | platí | Nejdřív kniha | The book first | Zuerst das Buch | Najpierw księga |
| R8.1.1 | R8-reading-scans.md | výzkum 1.14.0 | platí | Rejstřík před listováním | An index before browsing | Ein Register vor dem Durchblättern | Indeks przed przeglądaniem |
| R8.1.2 | R8-reading-scans.md | výzkum 1.0.0 | platí | Poučení ke knize | A lesson about a book | Eine Lehre zu einem Buch | Wniosek o księdze |
| R8.2 | R8-reading-scans.md | výzkum 1.0.0 | platí | Snímky jen přes stahovač | Images only through a downloader | Bilder nur über einen Downloader | Skany tylko przez program pobierający |
| R8.3 | R8-reading-scans.md | výzkum 1.0.0 | platí | Čtenáři: kdo snímky čte | Readers: who reads the images | Leser: wer die Bilder liest | Czytelnicy: kto czyta skany |
| R8.3.1 | R8-reading-scans.md | výzkum 1.0.0 | platí | Dávky, souběh a rozsah | Batches, readers at once and range | Stapel, gleichzeitige Leser und Umfang | Partie, czytelnicy naraz i zakres |
| R8.3.2 | R8-reading-scans.md | výzkum 1.14.0 | platí | Velikost pohledů a dvoustrana v půlkách | View size and a double page in halves | Größe der Ansichten und eine Doppelseite in Hälften | Rozmiar widoków i rozkładówka w połówkach |
| R8.3.3 | R8-reading-scans.md | výzkum 1.0.0 | platí | Co čtenář píše | What a reader writes | Was ein Leser schreibt | Co pisze czytelnik |
| R8.3.4 | R8-reading-scans.md | výzkum 1.14.0 | platí | Časový limit čtenáře a výpadek služby | A reader's time limit and a service outage | Zeitlimit eines Lesers und Ausfall des Dienstes | Limit czasu czytelnika i awaria usługi |
| R8.3.5 | R8-reading-scans.md | výzkum 1.15.0 | platí | Čtení do nálezu | Reading until found | Lesen bis zum Fund | Czytanie do znalezienia |
| R8.3.6 | R8-reading-scans.md | výzkum 1.15.0 | platí | Čtení knihy, která se stahuje | Reading a book that is being downloaded | Lesen eines Buches, das gerade geladen wird | Czytanie księgi w trakcie pobierania |
| R8.3.7 | R8-reading-scans.md | výzkum 1.0.0 | platí | Co se vrátí agentovi | What comes back to the agent | Was der Agent zurückbekommt | Co wraca do agenta |
| R8.4 | R8-reading-scans.md | výzkum 1.14.0 | platí | Samoladění čtení | Self-tuning of reading | Selbstabstimmung des Lesens | Samodostrajanie odczytu |
| R8.5 | R8-reading-scans.md | výzkum 1.0.0 | platí | Vlastní čtení hlavního agenta | The main agent's own reading | Eigenes Lesen des Hauptagenten | Własny odczyt głównego agenta |
| R8.5.1 | R8-reading-scans.md | výzkum 1.4.1 | platí | Jméno a místo pro další hledání | A name and place for the next search | Name und Ort für die weitere Suche | Imię i miejsce do dalszego szukania |
| R8.5.2 | R8-reading-scans.md | výzkum 1.14.0 | platí | Nejistě přečtené místo je vodítko | An uncertainly read place is a lead | Ein unsicher gelesener Ort ist ein Hinweis | Niepewnie odczytane miejsce to wskazówka |
| R8.6 | R8-reading-scans.md | výzkum 1.0.0 | platí | Zápis nálezu | Recording a find | Erfassen eines Fundes | Zapis znaleziska |
| R8.7 | R8-reading-scans.md | výzkum 1.0.0 | platí | Jistota a ověření přečteného | Certainty and verification of what was read | Sicherheit und Prüfung des Gelesenen | Pewność i weryfikacja odczytu |
| R8.8 | R8-reading-scans.md | aplikace 3.14.0, výzkum 1.18.0 | platí | Přečíst dokument z aplikace | Reading a document from the app | Ein Dokument aus der App lesen | Odczytanie dokumentu z aplikacji |
| R8.8.1 | R8-reading-scans.md | výzkum 1.29.0, aplikace 3.25.0 | platí | Čtenáři: program, model a důkladnost | Readers: program, model and thoroughness | Leser: Programm, Modell und Gründlichkeit | Czytelnicy: program, model i dokładność |
| R8.8.2 | R8-reading-scans.md | výzkum 1.29.0, aplikace 3.25.0 | platí | Přečíst znovu pramen z originálu | Reading a source again from its original | Eine Quelle erneut aus dem Original lesen | Ponowny odczyt źródła z oryginału |
| R8.8.3 | R8-reading-scans.md | výzkum 1.29.0, aplikace 3.25.0 | platí | Úkol z nového čtení | Task from a new reading | Aufgabe aus einer neuen Lesung | Zadanie z nowego odczytu |
| R9 | R9-archives.md | výzkum 1.14.0 | koncept | Archivy: co smí agent a co udělá člověk | Archives: what the agent may do and what a person does | Archive: was der Agent darf und was der Mensch tut | Archiwa: co wolno agentowi, a co robi człowiek |
| R9.1 | R9-archives.md | výzkum 1.14.0 | koncept | Druhy archivů | Kinds of archives | Arten von Archiven | Rodzaje archiwów |
| R9.1.1 | R9-archives.md | výzkum 1.14.0 | koncept | Web, který výzkum nezná | A site the research does not know | Eine Website, die die Forschung nicht kennt | Strona, której badanie nie zna |
| R9.2 | R9-archives.md | výzkum 1.14.0 | koncept | Svolení člověka | A person's permission | Die Erlaubnis des Menschen | Zgoda człowieka |
| R9.3 | R9-archives.md | výzkum 1.14.0 | koncept | Stažení webu agentem | The agent's web fetch | Webabruf durch den Agenten | Pobieranie stron przez agenta |
| R9.4 | R9-archives.md | výzkum 1.27.0 | koncept | Prohlížeč agenta | The agent's browser | Der Browser des Agenten | Przeglądarka agenta |
| R9.4.1 | R9-archives.md | výzkum 1.14.0 | koncept | Kdy sezení dostane Chrome | When a session gets Chrome | Wann eine Sitzung Chrome bekommt | Kiedy sesja dostaje Chrome |
| R9.4.2 | R9-archives.md | výzkum 1.27.0 | koncept | Vestavěné prohlížeče a ovládání počítače: nedoporučené | Built-in browsers and computer use: not recommended | Eingebaute Browser und Computersteuerung: nicht empfohlen | Wbudowane przeglądarki i sterowanie komputerem: niepolecane |
| R9.4.3 | R9-archives.md | výzkum 1.27.0 | koncept | Stav prohlížeče ve strom doctor a v aplikaci | The browser's state in strom doctor and the app | Zustand des Browsers in strom doctor und in der App | Stan przeglądarki w strom doctor i w aplikacji |
| R9.5 | R9-archives.md | výzkum 1.27.0 | koncept | Snímek přes prohlížeč agenta | An image through the agent's browser | Ein Bild über den Browser des Agenten | Skan przez przeglądarkę agenta |
| R9.6 | R9-archives.md | výzkum 1.0.0 | koncept | Čekání na snímky a návrat úkolu | Waiting for images and the task's return | Warten auf Bilder und Rückkehr der Aufgabe | Oczekiwanie na skany i powrót zadania |
| R9.7 | R9-archives.md | výzkum 1.14.0 | koncept | Automatické sezení a chat | An automatic session and a chat | Automatische Sitzung und Chat | Sesja automatyczna i czat |
| R9.8 | R9-archives.md | výzkum 1.27.0 | koncept | Co se stane s úkolem: tabulka | What happens to a task: a table | Was mit einer Aufgabe geschieht: eine Tabelle | Co dzieje się z zadaniem: tabela |
| R9.8.1 | R9-archives.md | výzkum 1.27.0 | koncept | Průběh úkolu, který čeká na snímky | The course of a task waiting for images | Ablauf einer Aufgabe, die auf Bilder wartet | Przebieg zadania czekającego na skany |
| R9.9 | R9-archives.md | výzkum 1.27.0 | koncept | Co udělá člověk | What a person does | Was der Mensch tut | Co robi człowiek |
| R9.10 | R9-archives.md | výzkum 1.27.0 | koncept | Příklady | Examples | Beispiele | Przykłady |
| R9.10.1 | R9-archives.md | výzkum 1.27.0 | koncept | Moravský zemský archiv (Acta Publica) | Moravský zemský archiv (Acta Publica) | Moravský zemský archiv (Acta Publica) | Moravský zemský archiv (Acta Publica) |
| R9.10.2 | R9-archives.md | výzkum 1.27.0 | koncept | Zemský archiv v Opavě (digi.archives.cz) | Zemský archiv v Opavě (digi.archives.cz) | Zemský archiv v Opavě (digi.archives.cz) | Zemský archiv v Opavě (digi.archives.cz) |
| R9.10.3 | R9-archives.md | výzkum 1.27.0 | koncept | eBadatelna SOA Praha | eBadatelna SOA Praha | eBadatelna SOA Praha | eBadatelna SOA Praha |
| R9.10.4 | R9-archives.md | výzkum 1.14.0 | koncept | Matricula | Matricula | Matricula | Matricula |
| R9.10.5 | R9-archives.md | výzkum 1.27.0 | koncept | Szukaj w Archiwach | Szukaj w Archiwach | Szukaj w Archiwach | Szukaj w Archiwach |
| R9.10.6 | R9-archives.md | výzkum 1.28.0 | koncept | DigiArchiv SOA Třeboň | DigiArchiv SOA Třeboň | DigiArchiv SOA Třeboň | DigiArchiv SOA Třeboň |
| R10 | R10-people-and-hypotheses.md | výzkum 1.0.0 | platí | Osoby: ztotožnění, jména a hypotézy | People: identification, names and hypotheses | Personen: Identifizierung, Namen und Hypothesen | Osoby: identyfikacja, imiona i hipotezy |
| R10.1 | R10-people-and-hypotheses.md | výzkum 1.0.0 | platí | Jmenovec není hledaná osoba | A namesake is not the person sought | Ein Namensvetter ist nicht die gesuchte Person | Imiennik to nie poszukiwana osoba |
| R10.2 | R10-people-and-hypotheses.md | výzkum 1.0.0 | platí | Dva záznamy jedné osoby: sloučení | Two records of one person: merging | Zwei Einträge einer Person: Zusammenführen | Dwa wpisy jednej osoby: scalenie |
| R10.3 | R10-people-and-hypotheses.md | výzkum 1.0.0 | platí | Hypotéza: soupeřící vysvětlení | A hypothesis: competing explanations | Eine Hypothese: konkurrierende Erklärungen | Hipoteza: konkurujące wyjaśnienia |
| R10.3.1 | R10-people-and-hypotheses.md | výzkum 1.0.0 | platí | Rozhodnutí hypotézy | Deciding a hypothesis | Entscheidung einer Hypothese | Rozstrzygnięcie hipotezy |
| R10.3.2 | R10-people-and-hypotheses.md | výzkum 1.29.0, aplikace 3.25.0 | platí | Kdo rozhoduje hypotézy: člověk, nebo AI | Who decides the hypotheses: the user or the AI | Wer die Hypothesen entscheidet: der Mensch oder die KI | Kto rozstrzyga hipotezy: człowiek czy AI |
| R10.4 | R10-people-and-hypotheses.md | výzkum 1.9.0 | platí | Rodina mimo strom čeká na doloženou vazbu | A family outside the tree waits for a proven link | Eine Familie außerhalb des Stammbaums wartet auf eine belegte Verbindung | Rodzina poza drzewem czeka na udokumentowane powiązanie |
| R10.5 | R10-people-and-hypotheses.md | výzkum 1.0.0 | platí | Jména osoby | A person's names | Die Namen einer Person | Imiona i nazwiska osoby |
| R10.5.1 | R10-people-and-hypotheses.md | výzkum 1.18.0 | platí | Chybné jméno a poznámka se odvolají | A wrong name and a note are retracted | Ein falscher Name und eine Notiz werden zurückgezogen | Błędne imię i notatka zostają wycofane |
| R10.6 | R10-people-and-hypotheses.md | výzkum 1.0.0 | platí | Lidé, které zápis jmenuje | People a record names | Personen, die ein Eintrag nennt | Osoby wymienione we wpisie |
| R11 | R11-material-from-the-user.md | výzkum 1.0.0 | platí | Podklady od uživatele | Material from the user | Unterlagen vom Benutzer | Materiały od użytkownika |
| R11.1 | R11-material-from-the-user.md | výzkum 1.0.0 | platí | Každý soubor je podklad s úkolem | Every file is material with a task | Jede Datei ist eine Unterlage mit einer Aufgabe | Każdy plik to materiał z zadaniem |
| R11.2 | R11-material-from-the-user.md | výzkum 1.0.0 | platí | Doklad je pramen, ostatní je vodítko | A document is a source, the rest is a lead | Eine Urkunde ist eine Quelle, der Rest ist ein Hinweis | Dokument jest źródłem, reszta jest wskazówką |
| R11.3 | R11-material-from-the-user.md | výzkum 1.0.0 | platí | Převzatý rodokmen | An imported family tree | Ein übernommener Stammbaum | Przejęte drzewo genealogiczne |
| R11.4 | R11-material-from-the-user.md | výzkum 1.12.0 | platí | Dávka z aplikace | A batch from the app | Ein Stapel aus der App | Partia z aplikacji |
| R12 | R12-where-the-agent-works.md | výzkum 1.29.0 | koncept | Kde agent pracuje a co strom hlídá | Where the agent works and what strom watches | Wo der Agent arbeitet und was strom überwacht | Gdzie agent pracuje i czego strom pilnuje |
| R12.1 | R12-where-the-agent-works.md | výzkum 1.29.0 | koncept | Způsoby práce: tabulka | Ways of working: a table | Arten zu arbeiten: eine Tabelle | Sposoby pracy: tabela |
| R12.2 | R12-where-the-agent-works.md | výzkum 1.29.0 | koncept | Prohlížeč v aplikaci Claude | The browser in the Claude app | Der Browser in der App Claude | Przeglądarka w aplikacji Claude |
| R12.3 | R12-where-the-agent-works.md | výzkum 1.29.0 | koncept | Terminál aplikace Claude | The Claude app's terminal | Das Terminal der App Claude | Terminal aplikacji Claude |
| R12.4 | R12-where-the-agent-works.md | výzkum 1.29.0 | koncept | Aplikace Claude bez Claude Code v terminálu | The Claude app without Claude Code in the terminal | Die App Claude ohne Claude Code im Terminal | Aplikacja Claude bez Claude Code w terminalu |
| R12.5 | R12-where-the-agent-works.md | výzkum 1.27.0 | koncept | Codex: v terminálu a v aplikaci ChatGPT | Codex: in the terminal and in the ChatGPT app | Codex: im Terminal und in der App ChatGPT | Codex: w terminalu i w aplikacji ChatGPT |
| R12.6 | R12-where-the-agent-works.md | výzkum 1.29.0 | koncept | Co ověřené není | What is not verified | Was nicht geprüft ist | Czego nie sprawdzono |
| R12.7 | R12-where-the-agent-works.md | výzkum 1.0.0 | koncept | Antigravity | Antigravity | Antigravity | Antigravity |
| R12.8 | R12-where-the-agent-works.md | výzkum 1.4.0 | koncept | Grok Build | Grok Build | Grok Build | Grok Build |
| R12.9 | R12-where-the-agent-works.md | výzkum 1.0.0 | koncept | OpenCode | OpenCode | OpenCode | OpenCode |
| R12.10 | R12-where-the-agent-works.md | výzkum 1.29.0 | koncept | Ovládání počítače (computer use) | Computer use | Computersteuerung (Computer Use) | Sterowanie komputerem (computer use) |
| A1 | A1-the-app-in-brief.md | aplikace 1.0.0 | platí | Aplikace v kostce | The app in brief | Die App im Überblick | Aplikacja w skrócie |
| A1.1 | A1-the-app-in-brief.md | aplikace 1.0.0 | platí | Rodokmen v prohlížeči, data na zařízení | A family tree in the browser, data on the device | Stammbaum im Browser, Daten auf dem Gerät | Drzewo genealogiczne w przeglądarce, dane na urządzeniu |
| A1.2 | A1-the-app-in-brief.md | aplikace 1.0.0 | platí | Osoby, vztahy a rody | People, relationships and family lines | Personen, Beziehungen und Stammlinien | Osoby, relacje i rody |
| A1.3 | A1-the-app-in-brief.md | aplikace 1.0.0 | platí | Pohledy: okolí jedné osoby | Views: the surroundings of one person | Ansichten: das Umfeld einer Person | Widoki: otoczenie jednej osoby |
| A1.4 | A1-the-app-in-brief.md | aplikace 1.0.0 | platí | Načtení a výstupy | Loading and outputs | Einlesen und Ausgaben | Wczytanie i wyniki |
| A1.5 | A1-the-app-in-brief.md | aplikace 1.0.0 | platí | Prameny, doložení a kontrola | Sources, evidence and checks | Quellen, Belege und Prüfung | Źródła, udokumentowanie i kontrola |
| A1.6 | A1-the-app-in-brief.md | aplikace 1.0.0 | platí | Aplikace a výzkum | The app and the research | App und Forschung | Aplikacja i badanie |
| A1.7 | A1-the-app-in-brief.md | aplikace 3.24.0 | platí | Jak Strom funguje v aplikaci | How Strom works in the app | So funktioniert Strom in der App | Jak działa Strom w aplikacji |
| A2 | A2-loading-a-family-tree.md | aplikace 1.9.0 | platí | Načtení rodokmenu (GEDCOM) | Loading a family tree (GEDCOM) | Einlesen eines Stammbaums (GEDCOM) | Wczytanie drzewa genealogicznego (GEDCOM) |
| A2.1 | A2-loading-a-family-tree.md | aplikace 1.9.0 | platí | Co se načte a co ne | What is loaded and what is not | Was eingelesen wird und was nicht | Co się wczytuje, a co nie |
| A2.1.1 | A2-loading-a-family-tree.md | aplikace 1.9.0 | platí | Souhrn importu | Import summary | Zusammenfassung des Imports | Podsumowanie importu |
| A2.2 | A2-loading-a-family-tree.md | aplikace 1.16.0 | platí | Kódování a verze GEDCOM | Encoding and GEDCOM version | Kodierung und Version von GEDCOM | Kodowanie i wersja GEDCOM |
| A2.3 | A2-loading-a-family-tree.md | aplikace 3.10.0 | platí | Jména a příjmení | Given names and surnames | Vornamen und Nachnamen | Imiona i nazwiska |
| A2.4 | A2-loading-a-family-tree.md | aplikace 3.0.0 | platí | Data a jejich tvary | Dates and their forms | Daten und ihre Formen | Daty i ich formy |
| A2.5 | A2-loading-a-family-tree.md | aplikace 3.0.0 | platí | Vztahy a stav páru | Relationships and the status of a couple | Beziehungen und Stand des Paares | Relacje i stan pary |
| A2.6 | A2-loading-a-family-tree.md | aplikace 1.9.4 | platí | Prameny, citace a QUAY | Sources, citations and QUAY | Quellen, Zitationen und QUAY | Źródła, cytaty i QUAY |
| A2.7 | A2-loading-a-family-tree.md | aplikace 3.9.0 | platí | Vlastní značky Stromu a co se vrací | Strom's own tags and what comes back | Eigene Tags von Strom und was zurückkommt | Własne znaczniki Stromu i co wraca |
| A2.8 | A2-loading-a-family-tree.md | aplikace 1.0.0 | platí | Opakovaný import a sloučení | Repeated import and merging | Wiederholter Import und Zusammenführen | Ponowny import i scalanie |
| A3 | A3-evidence-in-the-app.md | aplikace 1.4.0 | platí | Doložení v aplikaci | Evidence in the app | Belege in der App | Udokumentowanie w aplikacji |
| A3.1 | A3-evidence-in-the-app.md | aplikace 1.4.0 | platí | Pramen je jeden zápis | A source is one entry | Eine Quelle ist ein Eintrag | Źródło to jeden zapis |
| A3.1.1 | A3-evidence-in-the-app.md | aplikace 3.9.0 | platí | Přepis a Přepis ověřen | Transcript and Transcription verified | Transkription und Abschrift geprüft | Transkrypcja i Transkrypcja zweryfikowana |
| A3.2 | A3-evidence-in-the-app.md | aplikace 1.4.0 | platí | Citace: co pramen dokládá | Citation: what a source supports | Zitation: was eine Quelle belegt | Cytat: co źródło dokumentuje |
| A3.2.1 | A3-evidence-in-the-app.md | aplikace 3.1.0 | platí | Výběr pramene | Source picker | Auswahl der Quelle | Wybór źródła |
| A3.3 | A3-evidence-in-the-app.md | aplikace 3.1.0 | platí | Výřez zápisu | Excerpt of the entry | Ausschnitt des Eintrags | Wycinek zapisu |
| A3.4 | A3-evidence-in-the-app.md | aplikace 1.4.0 | platí | Přílohy | Attachments | Anhänge | Załączniki |
| A3.4.1 | A3-evidence-in-the-app.md | aplikace 3.9.0 | platí | Originály pro výzkum | Originals for the research | Originale für die Forschung | Oryginały dla badania |
| A3.5 | A3-evidence-in-the-app.md | aplikace 3.9.0 | platí | Materiály | Materials | Materialien | Materiały |
| A3.6 | A3-evidence-in-the-app.md | aplikace 3.3.0 | platí | Prameny osoby | Sources of a person | Quellen einer Person | Źródła osoby |
| A3.7 | A3-evidence-in-the-app.md | aplikace 3.4.0 | platí | Kde chybí doklady | Where evidence is missing | Wo Belege fehlen | Gdzie brakuje dowodów |
| A3.8 | A3-evidence-in-the-app.md | aplikace 3.14.0 | platí | Obraz jen ve výzkumu | Image only in the research | Bild nur in der Forschung | Obraz tylko w badaniu |
| A4 | A4-surnames-and-families.md | aplikace 1.15.0 | platí | Rody a příjmení | Family lines and surnames | Stammlinien und Nachnamen | Rody i nazwiska |
| A4.1 | A4-surnames-and-families.md | aplikace 3.19.0 | platí | Rod a jeho zakladatel | A family line and its founder | Die Stammlinie und ihr Stammvater | Ród i jego założyciel |
| A4.1.1 | A4-surnames-and-families.md | aplikace 3.19.0 | platí | Ruční úprava rodu | Editing a family line by hand | Stammlinie von Hand bearbeiten | Ręczna edycja rodu |
| A4.2 | A4-surnames-and-families.md | aplikace 3.19.0 | platí | Rodný rod, přivdaní a přiženění | Family line by birth, and those who married in | Herkunftslinie und Eingeheiratete | Ród z urodzenia i osoby wżenione |
| A4.3 | A4-surnames-and-families.md | aplikace 3.19.0 | platí | Malé rody a Další rodiny | Small family lines and Other families | Kleine Stammlinien und Weitere Familien | Małe rody i Inne rodziny |
| A4.4 | A4-surnames-and-families.md | aplikace 3.19.0 | platí | Pořadí a názvy rodů | Order and names of family lines | Reihenfolge und Namen der Stammlinien | Kolejność i nazwy rodów |
| A4.5 | A4-surnames-and-families.md | aplikace 1.16.0 | platí | Ženské a mužské tvary příjmení | Feminine and masculine forms of a surname | Weibliche und männliche Formen des Nachnamens | Żeńskie i męskie formy nazwiska |
| A4.6 | A4-surnames-and-families.md | aplikace 3.13.0 | platí | Příjmení po sňatku a používané příjmení | Married surname and the surname in use | Ehename und geführter Nachname | Nazwisko po ślubie i używane nazwisko |
| A4.7 | A4-surnames-and-families.md | aplikace 1.15.0 | platí | Tvary příjmení stromu a návrhy z výzkumu | Surname spellings of the tree and suggestions from the research | Namensschreibweisen des Stammbaums und Vorschläge aus der Forschung | Formy nazwiska drzewa i propozycje z badania |
| A4.8 | A4-surnames-and-families.md | aplikace 3.0.0 | platí | Hledání a řazení jmen | Searching and sorting names | Suche und Sortierung von Namen | Wyszukiwanie i sortowanie imion i nazwisk |
| A5 | A5-tree-check.md | aplikace 1.0.0 | platí | Kontrola stromu | Tree check | Prüfung des Stammbaums | Kontrola drzewa |
| A5.1 | A5-tree-check.md | aplikace 3.17.0 | platí | Kontrola a její nálezy | The check and its findings | Die Prüfung und ihre Befunde | Kontrola i jej wyniki |
| A5.1.1 | A5-tree-check.md | aplikace 1.10.0 | platí | Oprava jedním klikem | One-click fix | Behebung mit einem Klick | Naprawa jednym kliknięciem |
| A5.2 | A5-tree-check.md | aplikace 1.16.0 | platí | Vazby v rodině | Family links | Verbindungen in der Familie | Relacje w rodzinie |
| A5.3 | A5-tree-check.md | aplikace 3.17.0 | platí | Data a věk | Dates and age | Daten und Alter | Daty i wiek |
| A5.4 | A5-tree-check.md | aplikace 3.9.0 | platí | Prameny, přílohy a sloučení při importu | Sources, attachments and merges on import | Quellen, Anhänge und Verschmelzung beim Import | Źródła, załączniki i scalenie przy imporcie |
| A5.5 | A5-tree-check.md | aplikace 3.17.0 | platí | Stopy: kmotři a zápisy míst | Leads: godparents and spellings of places | Hinweise: Paten und Schreibungen von Orten | Wskazówki: chrzestni i zapisy miejsc |
| A5.5.1 | A5-tree-check.md | aplikace 3.17.0 | platí | Jak se pozná tentýž kmotr | How the same godparent is recognised | Wie derselbe Pate erkannt wird | Jak rozpoznaje się tego samego chrzestnego |
| A5.6 | A5-tree-check.md | aplikace 3.17.0 | platí | Možná duplicitní osoba | Possible duplicate person | Mögliche doppelte Person | Możliwy duplikat osoby |
| A5.6.1 | A5-tree-check.md | aplikace 3.17.0 (výzkum 1.22.0) | platí | Verdikt výzkumu | The research's verdict | Urteil der Forschung | Werdykt badania |
| A5.6.2 | A5-tree-check.md | aplikace 1.4.0 | platí | Upozornění při zadávání osoby | Warning when entering a person | Hinweis beim Erfassen einer Person | Podpowiedź przy wpisywaniu osoby |
| A5.7 | A5-tree-check.md | aplikace 3.17.0 (výzkum 1.22.0) | platí | Není chyba | Not an error | Kein Fehler | To nie błąd |
| A5.8 | A5-tree-check.md | aplikace 3.17.0 | platí | Přehled stromu → Kvalita dat | Tree overview → Data quality | Stammbaum-Überblick → Datenqualität | Przegląd drzewa → Jakość danych |
| A6 | A6-views.md | aplikace 1.0.0 | platí | Pohledy a výběr osob | Views and the choice of people | Ansichten und Auswahl der Personen | Widoki i wybór osób |
| A6.1 | A6-views.md | aplikace 1.0.0 | platí | Okolí ústřední osoby v pohledu Rodina | The surroundings of the central person in the Family view | Umfeld der zentralen Person in der Ansicht Familie | Otoczenie osoby w centrum w widoku Rodzina |
| A6.1.1 | A6-views.md | aplikace 1.0.0 | platí | Výchozí osoba a pohled | Default person and view | Standardperson und -ansicht | Domyślna osoba i widok |
| A6.2 | A6-views.md | aplikace 1.4.0 | platí | Pohled Potomci | The Descendants view | Ansicht Nachkommen | Widok Potomkowie |
| A6.3 | A6-views.md | aplikace 1.5.0 | platí | Časová osa | Timeline | Zeitleiste | Oś czasu |
| A6.4 | A6-views.md | aplikace 1.8.0 | platí | Vějíř | Fan | Fächer | Wachlarz |
| A6.5 | A6-views.md | aplikace 1.10.0 | platí | Mapa | Map | Karte | Mapa |
| A6.5.1 | A6-views.md | aplikace 1.10.0 | platí | Odkud mapa bere polohu místa | Where the map gets a place's location | Woher die Karte die Lage eines Ortes nimmt | Skąd mapa bierze położenie miejsca |
| A6.5.2 | A6-views.md | aplikace 3.25.0 | platí | Místa mimo mapu dohledat ve výzkumu | Looking up places off the map in the research | Orte ohne Karte in der Forschung suchen | Odszukanie miejsc poza mapą w badaniu |
| A6.6 | A6-views.md | aplikace 3.21.0 | platí | Rod v pohledu | A family line in the view | Stammlinie in der Ansicht | Ród w widoku |
| A7 | A7-book-pages-and-export.md | aplikace 1.0.0 | platí | Kniha, stránky a export | Book, pages and export | Buch, Seiten und Export | Księga, strony i eksport |
| A7.1 | A7-book-pages-and-export.md | aplikace 1.2.0 | platí | Kdo je žijící osoba | Who is a living person | Wer eine lebende Person ist | Kto jest osobą żyjącą |
| A7.2 | A7-book-pages-and-export.md | aplikace 1.2.0 | platí | Ochrana žijících | Privacy of living people | Schutz lebender Personen | Ochrona osób żyjących |
| A7.2.1 | A7-book-pages-and-export.md | aplikace 1.2.0 | platí | Výchozí ochrana podle výstupu | Default privacy by output | Standardschutz je nach Ausgabe | Domyślna ochrona według wyniku |
| A7.3 | A7-book-pages-and-export.md | aplikace 2.4.0 | platí | Obsah souboru | Content of the file | Inhalt der Datei | Zawartość pliku |
| A7.4 | A7-book-pages-and-export.md | aplikace 3.19.0 | platí | Kniha rodu | Family book | Familienbuch | Księga rodu |
| A7.4.1 | A7-book-pages-and-export.md | aplikace 3.19.0 | platí | Výběr osob do knihy a stránek | Choice of people for the book and the pages | Auswahl der Personen für Buch und Seiten | Wybór osób do księgi i stron |
| A7.5 | A7-book-pages-and-export.md | aplikace 3.20.0 | platí | Stránky rodu a stránky stromu | Family pages and tree pages | Familienseiten und Seiten des Stammbaums | Strony rodu i strony drzewa |
| A7.6 | A7-book-pages-and-export.md | aplikace 3.18.0 | platí | Stránka osoby | Person page | Personenseite | Strona osoby |
| A7.7 | A7-book-pages-and-export.md | aplikace 1.0.0 | platí | Uložené HTML (samostatný soubor) | Saved HTML (a standalone file) | Gespeichertes HTML (eigenständige Datei) | Zapisany HTML (samodzielny plik) |
| A7.8 | A7-book-pages-and-export.md | aplikace 2.8.0 | platí | Vyprávění | Stories | Erzählungen | Opowieść |
| A8 | A8-merging-trees.md | aplikace 1.0.0 | platí | Sloučení stromů | Merging trees | Zusammenführen von Stammbäumen | Scalanie drzew |
| A8.1 | A8-merging-trees.md | aplikace 1.0.0 | platí | Sloučení vždy založí nový strom | A merge always creates a new tree | Zusammenführen legt immer einen neuen Stammbaum an | Scalenie zawsze zakłada nowe drzewo |
| A8.2 | A8-merging-trees.md | aplikace 1.0.0 | platí | Párování osob | Pairing people | Abgleich der Personen | Łączenie osób w pary |
| A8.3 | A8-merging-trees.md | aplikace 1.0.0 | platí | Co rozhoduje člověk | What a person decides | Was der Mensch entscheidet | Co rozstrzyga człowiek |
| A8.4 | A8-merging-trees.md | aplikace 1.0.0 | platí | Co se přenese se stromem | What comes along with the tree | Was mit dem Stammbaum übernommen wird | Co przechodzi z drzewem |
| A9 | A9-using-the-app.md | aplikace 3.25.0 | koncept | Ovládání aplikace | Using the app | Bedienung der App | Obsługa aplikacji |
| A9.1 | A9-using-the-app.md | aplikace 3.25.0 | koncept | Kde co je | Where things are | Wo was ist | Gdzie co jest |
| A9.2 | A9-using-the-app.md | aplikace 3.25.0 | koncept | Prvky mají čitelný název | Controls have a readable name | Bedienelemente haben einen lesbaren Namen | Elementy mają czytelną nazwę |
| A9.3 | A9-using-the-app.md | aplikace 3.25.0 | koncept | Úpravy během sledování výzkumu | Editing while following the research | Bearbeiten beim Verfolgen der Forschung | Edycja podczas śledzenia badania |
| A9.4 | A9-using-the-app.md | výzkum 1.29.0, aplikace 3.25.0 | koncept | Agent v aplikaci | The agent in the app | Der Agent in der App | Agent w aplikacji |
| S1 | S1-connecting-app-and-research.md | aplikace 3.0.0, výzkum 1.0.0 | platí | Propojení aplikace a výzkumu | Connecting the app and the research | Verbindung von App und Forschung | Połączenie aplikacji i badania |
| S1.1 | S1-connecting-app-and-research.md | výzkum 1.0.0 | platí | Most výzkumu běží jen na tomto počítači | The research's bridge runs only on this computer | Die Brücke der Forschung läuft nur auf diesem Computer | Most badania działa tylko na tym komputerze |
| S1.2 | S1-connecting-app-and-research.md | aplikace 3.0.0, výzkum 1.0.0 | platí | Výzkum se otevře v aplikaci odkazem z terminálu | The research opens in the app through a link from the terminal | Die Forschung öffnet sich in der App über einen Link aus dem Terminal | Badanie otwiera się w aplikacji linkiem z terminala |
| S1.2.1 | S1-connecting-app-and-research.md | aplikace 3.0.0 | platí | Odkazy, které aplikace přijme | Links the app accepts | Links, die die App annimmt | Linki, które aplikacja przyjmuje |
| S1.3 | S1-connecting-app-and-research.md | aplikace 3.12.0 | platí | Druhy stromů v aplikaci | Kinds of trees in the app | Arten von Stammbäumen in der App | Rodzaje drzew w aplikacji |
| S1.4 | S1-connecting-app-and-research.md | aplikace 3.0.0 | platí | Sledování živě | Following live | Live verfolgen | Śledzenie na żywo |
| S1.5 | S1-connecting-app-and-research.md | aplikace 3.9.0 | platí | Když výzkum neběží nebo spojení nejde | When the research is not running or the connection fails | Wenn die Forschung nicht läuft oder die Verbindung nicht geht | Gdy badanie nie działa albo połączenie się nie udaje |
| S1.6 | S1-connecting-app-and-research.md | aplikace 3.9.0, výzkum 1.12.0 | platí | Starší a novější verze | Older and newer versions | Ältere und neuere Versionen | Starsze i nowsze wersje |
| S1.7 | S1-connecting-app-and-research.md | aplikace 3.13.1 | platí | Více výzkumů na jednom počítači | Several researches on one computer | Mehrere Forschungen auf einem Computer | Kilka badań na jednym komputerze |
| S1.8 | S1-connecting-app-and-research.md | aplikace 3.0.0 | platí | Data zůstávají na počítači | Data stay on the computer | Die Daten bleiben auf dem Computer | Dane zostają na komputerze |
| S1.9 | S1-connecting-app-and-research.md | aplikace 3.25.0, výzkum 1.29.0 | platí | Výzkum zapnutý: přepínač mostu u stromu | Research on: the bridge's switch at a tree | Forschung an: der Schalter der Brücke am Stammbaum | Badanie włączone: przełącznik mostu przy drzewie |
| S2 | S2-edits-from-the-app.md | aplikace 3.0.0, výzkum 1.0.0 | platí | Úpravy z aplikace ve výzkumu | Edits from the app in the research | Änderungen aus der App in der Forschung | Zmiany z aplikacji w badaniu |
| S2.1 | S2-edits-from-the-app.md | výzkum 1.0.0 | platí | Hlavní je strom v aplikaci | The tree in the app is the main one | Maßgeblich ist der Stammbaum in der App | Główne jest drzewo w aplikacji |
| S2.2 | S2-edits-from-the-app.md | aplikace 3.9.0, výzkum 1.12.0 | platí | Kdy se úpravy posílají | When edits are sent | Wann Änderungen gesendet werden | Kiedy zmiany są wysyłane |
| S2.2.1 | S2-edits-from-the-app.md | aplikace 3.14.0 | platí | Co se pošle | What will be sent | Was gesendet wird | Co zostanie wysłane |
| S2.3 | S2-edits-from-the-app.md | výzkum 1.5.0 | platí | Co výzkum s poslanými úpravami udělá | What the research does with sent edits | Was die Forschung mit gesendeten Änderungen tut | Co badanie zrobi z wysłanymi zmianami |
| S2.4 | S2-edits-from-the-app.md | výzkum 1.12.0 | platí | Archiv Stromu a výzkum bez agenta | A Strom archive and a research without an agent | Strom-Archiv und Forschung ohne Agent | Archiwum Strom i badanie bez agenta |
| S2.5 | S2-edits-from-the-app.md | aplikace 3.11.0, výzkum 1.12.0 | platí | Co výzkum nepřijme | What the research does not accept | Was die Forschung nicht annimmt | Czego badanie nie przyjmie |
| S2.6 | S2-edits-from-the-app.md | výzkum 1.0.0 | platí | Osoba odebraná v aplikaci | A person removed in the app | In der App entfernte Person | Osoba usunięta w aplikacji |
| S2.7 | S2-edits-from-the-app.md | aplikace 3.4.0, výzkum 1.0.0 | platí | Vrácení poslání | Undoing a send | Senden zurücknehmen | Cofnięcie wysłania |
| S3 | S3-what-the-research-knows.md | aplikace 3.4.0 | platí | Co ví výzkum | What the research knows | Was die Forschung weiß | Co wie badanie |
| S3.1 | S3-what-the-research-knows.md | aplikace 3.4.0 | platí | Co ví výzkum jen čte to, co výzkum poslal | What the research knows only reads what the research sent | Was die Forschung weiß liest nur, was die Forschung gesendet hat | Co wie badanie tylko czyta to, co badanie wysłało |
| S3.1.1 | S3-what-the-research-knows.md | aplikace 3.4.0 | platí | Kdy výzkum bloky posílá | When the research sends the blocks | Wann die Forschung die Blöcke sendet | Kiedy badanie wysyła bloki |
| S3.2 | S3-what-the-research-knows.md | aplikace 3.4.0 | platí | Kde se Co ví výzkum otevře | Where What the research knows opens | Wo sich Was die Forschung weiß öffnet | Gdzie otwiera się Co wie badanie |
| S3.3 | S3-what-the-research-knows.md | aplikace 3.6.0 | platí | Nad osobou ukazuje, kde strom končí a co dál | Above the person shows where the tree ends and what comes next | Über der Person zeigt, wo der Stammbaum endet und was weiter geschieht | Nad osobą pokazuje, gdzie kończy się drzewo i co dalej |
| S3.3.1 | S3-what-the-research-knows.md | aplikace 3.6.0 | platí | Akce u Nad osobou | Actions at Above the person | Aktionen bei Über der Person | Działania przy Nad osobą |
| S3.4 | S3-what-the-research-knows.md | aplikace 3.4.0 | platí | Rozpory | Conflicts | Widersprüche | Sprzeczności |
| S3.5 | S3-what-the-research-knows.md | aplikace 3.4.0 | platí | Hypotézy | Hypotheses | Hypothesen | Hipotezy |
| S3.5.1 | S3-what-the-research-knows.md | aplikace 3.11.0 | platí | Ukázat: připojeno jen v zobrazení | Show: linked in the view only | Zeigen: nur in der Ansicht verbunden | Pokaż: połączone tylko w widoku |
| S3.6 | S3-what-the-research-knows.md | aplikace 3.4.0 | platí | Prohledáno | Searched | Durchsucht | Przeszukano |
| S3.7 | S3-what-the-research-knows.md | aplikace 3.5.0 | platí | Oddíl Co ví výzkum v panelu výzkumu | The section What the research knows in the research panel | Abschnitt Was die Forschung weiß im Panel der Forschung | Sekcja Co wie badanie w panelu badania |
| S4 | S4-research-from-the-app.md | aplikace 3.4.0 | platí | Výzkum řízený z aplikace | Research run from the app | Forschung aus der App gesteuert | Badanie sterowane z aplikacji |
| S4.1 | S4-research-from-the-app.md | aplikace 3.5.0 | platí | Panel a Přehled výzkumu ukazují běžící práci | The panel and the Research overview show running work | Panel und Forschungsübersicht zeigen die laufende Arbeit | Panel i Przegląd badania pokazują bieżącą pracę |
| S4.1.1 | S4-research-from-the-app.md | aplikace 3.5.0 | platí | Sledovat agenta ve stromu | Follow the agent in the tree | Agenten im Stammbaum folgen | Śledź agenta w drzewie |
| S4.1.2 | S4-research-from-the-app.md | aplikace 3.22.0 | platí | Přizpůsobení panelu | Customizing the panel | Panel anpassen | Dostosowanie panelu |
| S4.1.3 | S4-research-from-the-app.md | aplikace 3.24.0 | platí | Sledovat ve vějíři a na mapě | Following in the fan and on the map | Folgen im Fächer und auf der Karte | Śledzenie w wachlarzu i na mapie |
| S4.1.4 | S4-research-from-the-app.md | aplikace 3.24.0 | platí | Změny z výzkumu bez blikání | Changes from the research without flicker | Änderungen aus der Forschung ohne Flackern | Zmiany z badania bez migania |
| S4.2 | S4-research-from-the-app.md | aplikace 3.5.0 | platí | Fronta v aplikaci | The queue in the app | Warteschlange in der App | Kolejka w aplikacji |
| S4.3 | S4-research-from-the-app.md | aplikace 3.5.0 | platí | Linie v aplikaci | Directions in the app | Linien in der App | Linie w aplikacji |
| S4.3.1 | S4-research-from-the-app.md | aplikace 3.22.0 | platí | Správa linií z aplikace | Managing directions from the app | Verwaltung der Linien aus der App | Zarządzanie liniami z aplikacji |
| S4.3.2 | S4-research-from-the-app.md | aplikace 3.22.0 | platí | Práce mimo linie po větvích | Work outside the directions by branches | Arbeit außerhalb der Linien nach Zweigen | Praca poza liniami według gałęzi |
| S4.4 | S4-research-from-the-app.md | aplikace 3.4.0 | platí | Čeká na vyřízení v aplikaci | Awaiting action in the app | Wartet auf Bearbeitung in der App | Czeka na decyzję w aplikacji |
| S4.5 | S4-research-from-the-app.md | aplikace 3.4.0 | platí | Akce, které otevřou výzkum | Actions that open the research | Aktionen, die die Forschung öffnen | Działania, które otwierają badanie |
| S4.5.1 | S4-research-from-the-app.md | aplikace 3.21.0 | platí | Značky akcí | Action marks | Marken der Aktionen | Oznaczenia działań |
| S4.5.2 | S4-research-from-the-app.md | aplikace 3.4.0 | platí | Kde akce jsou | Where the actions are | Wo die Aktionen sind | Gdzie są działania |
| S4.5.3 | S4-research-from-the-app.md | výzkum 1.29.0, aplikace 3.25.0 | platí | Otevřít úkol ve frontě | Opening a task in the queue | Eine Aufgabe in der Warteschlange öffnen | Otwarcie zadania w kolejce |
| S4.6 | S4-research-from-the-app.md | aplikace 3.4.0 | platí | Co je jen v terminálu | What is only in the terminal | Was nur im Terminal geht | Co jest tylko w terminalu |
| S5 | S5-phone.md | výzkum 1.18.0, aplikace 3.14.0 | platí | Telefon | Phone | Telefon | Telefon |
| S5.1 | S5-phone.md | výzkum 1.18.0, aplikace 3.14.0 | platí | Propojení s telefonem patří počítači a zapíná ho jen člověk | The phone connection belongs to the computer and only a person turns it on | Die Verbindung mit dem Telefon gehört dem Computer und nur ein Mensch schaltet sie ein | Połączenie z telefonem należy do komputera i włącza je tylko człowiek |
| S5.2 | S5-phone.md | výzkum 1.18.0, aplikace 3.14.0 | platí | Telefon se spáruje QR kódem z počítače | The phone is paired with a QR code from the computer | Das Telefon wird mit einem QR-Code vom Computer gekoppelt | Telefon paruje się kodem QR z komputera |
| S5.3 | S5-phone.md | výzkum 1.18.0 | platí | Stránka telefonu ukazuje výzkum jen ke čtení | The phone page shows the research read-only | Die Seite des Telefons zeigt die Forschung nur zum Lesen | Strona telefonu pokazuje badanie tylko do odczytu |
| S5.3.1 | S5-phone.md | výzkum 1.26.0 | platí | Linie z telefonu | Lines from the phone | Linien vom Telefon | Linie z telefonu |
| S5.4 | S5-phone.md | výzkum 1.18.0 | platí | Fotky z telefonu jdou do výzkumu po dávkách | Photos from the phone go to the research in batches | Fotos vom Telefon gehen in Stapeln in die Forschung | Zdjęcia z telefonu idą do badania partiami |
| S5.5 | S5-phone.md | výzkum 1.18.0, aplikace 3.14.0 | platí | Kdy se telefon nespojí | When the phone does not connect | Wann sich das Telefon nicht verbindet | Kiedy telefon się nie połączy |
| S5.6 | S5-phone.md | výzkum 1.18.0, aplikace 3.14.0 | platí | Odpojený telefon už nic neuvidí | An unpaired phone sees nothing any more | Ein getrenntes Telefon sieht nichts mehr | Odłączony telefon już nic nie zobaczy |
| S5.7 | S5-phone.md | aplikace 3.9.0 | platí | Aplikace Strom v telefonu výzkum neřídí | The Strom app on a phone does not run the research | Die Strom-App auf dem Telefon steuert die Forschung nicht | Aplikacja Strom w telefonie nie steruje badaniem |
