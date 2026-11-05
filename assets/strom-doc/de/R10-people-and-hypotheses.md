<a id="R10"></a>
# R10 Personen: Identifizierung, Namen und Hypothesen

Wie die Forschung erkennt, dass ein Eintrag der gesuchten Person gehört, was sie mit zwei Datensätzen einer Person
tut, wie sie konkurrierende Erklärungen (Hypothesen) führt und wie sie Namen und die Personen erfasst, die ein Eintrag
nennt. Beschrieben werden die Forschung 1.27.0 und die Strom-App 3.23.0. Bei den Regeln wird unterschieden, was
**der Code prüft** und was nur eine **Regel der Methodik** ist.

<a id="R10.1"></a>
## R10.1 Ein Namensvetter ist nicht die gesuchte Person

Ein Eintrag gehört der gesuchten Person nur, wenn mehr als der Name sie bestimmt. Zwei Menschen gleichen Namens in
einem Dorf sind häufig.

- **Nur Methodik:**
  - eine Person bestimmen Jahr, Ort, Hausnummer, Beruf, Ehemann oder Ehefrau und die Eltern. Die meisten Fälle
    entscheidet der Geburtsname der Mutter;
  - zwei Einträge, die demselben Namen andere Eltern geben (eine andere Mutter), sind **zwei Personen**, auch im
    selben Haus und beim selben Namen des Vaters. Der Unterschied wird nicht mit einem Fehler des Schreibers erklärt
    und nicht nach der Mehrheit entschieden ([R5.1.1](R5-conflicts.md#R5.1.1));
  - die gesuchte Person ist die, die der Eintrag über ihre eigene Familie nennt. Die übrigen sind eigene Personen;
    „dieselbe Frau?“ ist eine Hypothese ([R10.3](#R10.3)) mit dem, was sie entscheiden würde;
  - eine Quelle außerhalb der Kirchenbücher (Zeitung, Adressbuch, Web): es genügt, wenn Name, Ort und Zeit
    übereinstimmen **und noch eine Angabe** (Haus, Beruf, Ehemann oder Ehefrau, Alter, ein Verwandter). Sonst eine
    Hypothese.
- **Warum:** zwei Menschen gleichen Namens in einem Dorf sind häufig; der Geburtsname der Mutter entscheidet die
  meisten Fälle (Methodik).
- **Bedienung:** Terminal (Agent). Die App zeigt Hypothesen bei der Person in **Was die Forschung weiß → Hypothesen**
  ([S3.5](S3-what-the-research-knows.md#S3.5)).
- **Gilt seit:** Forschung 1.0.0; Quelle außerhalb der Kirchenbücher 1.10.0

<!-- zdroj: research:assets/method/core.md "A namesake is not your person" · research:assets/method/link.md krok 4 "Identify" · research:assets/method/enrich.md "Your person, not a namesake" (od v1.10.0) -->

<a id="R10.2"></a>
## R10.2 Zwei Einträge einer Person: Zusammenführen

Stellt sich heraus, dass zwei Datensätze in der Forschung eine Person sind, werden sie zusammengeführt. Der zweite
Datensatz verschwindet nicht: er bleibt zurückgezogen, mit einer Notiz, in wen er zusammengeführt wurde.

- **Prüft der Code** (`strom person merge <zůstává> <druhý> --reason "…"`):
  - das Zusammenführen braucht einen Grund;
  - Namen, Angaben, Notizen, Familien und alle Verweise (Aufgaben, Hypothesen, Paten…) gehen auf die Person über,
    die bleibt;
  - Angaben werden nicht zusammengeführt: zwei Geburten sind nach dem Zusammenführen zwei. strom weist darauf hin,
    welche Angaben jetzt doppelt sind; die bessere bleibt mit ihren Zitationen, die andere wird mit Grund
    zurückgezogen;
  - es lehnt ab, Personen verschiedenen Geschlechts zusammenzuführen (wenn keine ein unbekanntes Geschlecht hat),
    ebenso die Partner einer Familie, einen Vorfahren mit einem Nachkommen und Personen mit **anderen Eltern**. Sind
    es dieselben Eltern in zwei Datensätzen, werden zuerst die Familien zusammengeführt (`strom family merge`).
- **Nur Methodik:** eine Person aus einem übernommenen Stammbaum, die in der Forschung schon erforscht ist, wird **in**
  die erforschte Person zusammengeführt; diese behält ihre Belege ([R11.3](R11-material-from-the-user.md#R11.3)).
- **Bedienung:** Terminal: `strom person merge`, `strom family merge`. Mögliche doppelte Personen im Stammbaum meldet
  die App in der Prüfung des Stammbaums ([A5.6](A5-tree-check.md#A5.6)).
- **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:src/commands/people.ts person merge (description, SINGLE_KINDS) · research:src/core (mergePersons: merge.needs-reason, sex, partners, ancestor, different birth parents) · research:assets/method/intake.md krok 5 -->

<a id="R10.3"></a>
## R10.3 Eine Hypothese: konkurrierende Erklärungen

Lassen die Einträge mehr als eine Erklärung zu (wessen Kind es ist, ob zwei Einträge eine Person sind, ob es ein
Ehepaar ist), wählt die Forschung nicht stillschweigend. Sie erfasst eine Hypothese: die Frage und ihre Versionen
A, B, C… mit dem, was für jede spricht und was dagegen.

- **Prüft der Code:**
  - eine Hypothese hat mindestens zwei Versionen und betrifft mindestens eine Person oder einen Datensatz
    (`--about`);
  - der Buchstabe einer Version gehört für immer einer Behauptung. Eine neue Behauptung bekommt den nächsten freien
    Buchstaben, ein verwendeter Buchstabe wird nicht wieder verwendet. Eine Version lässt sich nur zu einer offenen
    Hypothese hinzufügen;
  - eine Version kann sagen, was sie verbinden würde: ein Kind einer Familie oder von Eltern, zwei Datensätze einer
    Person, ein Paar, Geschwister. Im Stammbaum wird dadurch nichts verbunden; die Verbindung wird erst nach der
    Entscheidung der Hypothese erfasst.
- **Nur Methodik:** was die Hypothese entscheiden würde, ist eine Aufgabe (`strom task add … --about H…`), kein Umweg
  in einer anderen Aufgabe. Die Verbindung einer Version wird nur erfasst, wenn die Behauptung sie ohne Zweifel
  nennt; ein Namensvetter bleibt außen vor.
- **Bedienung:** Terminal: `strom hypothesis add "<otázka>" --about P… --variant "…" --variant "…"`,
  `hypothesis argue`, `hypothesis variant`, `hypothesis link`, `hypothesis show`, `hypothesis list`. Die App zeigt die
  Versionen und lässt sie nur für die Ansicht in den Stammbaum zeichnen ([S3.5](S3-what-the-research-knows.md#S3.5),
  [S3.5.1](S3-what-the-research-knows.md#S3.5.1)).
- **Gilt seit:** Forschung 1.0.0; Verbindungen von Versionen und eine neue Version zu einer offenen Hypothese 1.14.0

<!-- zdroj: research:src/commands/analysis.ts hypothesis add ("at least two --variant", "--about is required"), variant (VARIANT_LABEL, nextLabel, "a letter is never used twice"), link (description) · research:assets/method/core.md "Say what a hypothesis would connect" -->

<a id="R10.3.1"></a>
### R10.3.1 Entscheidung einer Hypothese

Eine Hypothese wird für eine Version entschieden oder verworfen, wenn sich keine entscheiden lässt. Entschieden wird in
der Forschung; die App lässt eine Hypothese nicht entscheiden.

- **Prüft der Code:**
  - die Entscheidung braucht den Text der Entscheidung (`--decision`); das Verwerfen ist `--abandon`;
  - erneut entscheiden lässt sich nur mit Grund (`--reason`). Die vorige Entscheidung bleibt in einer Notiz der
    Hypothese;
  - nach der Entscheidung gibt strom die Quellen aus, die die Hypothese nennt und die keine Angabe ihrer Personen
    zitiert: was sie sagen, soll bei den Personen erfasst werden.
- **Nur Methodik:** eine Hypothese, deren Versionen Verbindungen tragen, wird mit der Wahl einer Version entschieden
  (`--variant B`). Eine entschiedene Hypothese, die ein neuer Eintrag umstößt, entscheidet der Agent mit Grund erneut.
  Was der Agent zurückgehalten hat, solange die Person nur eine Hypothese war, erfasst er nach der Entscheidung bei
  der Person.
- **Bedienung:** Terminal: `strom hypothesis decide H… --variant B --decision "…"` (erneut mit `--reason "…"`).
- **Gilt seit:** Forschung 1.0.0; Ausgabe nicht erfasster Quellen 1.12.0

<!-- zdroj: research:src/commands/analysis.ts hypothesis decide (earlier decision in a note, "deciding again needs --reason", sourcesNotOnPeople od v1.12.0) · research:assets/method/core.md "Write as you go", "Say what a hypothesis would connect" · research:assets/method/recording.md "A decided hypothesis that a new record overturns" -->

<a id="R10.4"></a>
## R10.4 Eine Familie außerhalb des Stammbaums wartet auf eine belegte Verbindung

Eine in den Einträgen gefundene Familie, die keine belegte Verbindung mit dem Stammbaum verbindet, wird nicht weiter
erforscht: weder ihre Eltern noch ihre Kinder. Zuerst muss belegt sein, dass sie in den Stammbaum gehört.

- **Nur Methodik:** der Agent erfasst eine Hypothese, die die Familie an eine Person des Stammbaums anschließen würde
  (`--about` die Person des Stammbaums), und eine Aufgabe, die sie prüft und nennt (`--about H…`). Eine Familie
  außerhalb des Stammbaums erforscht er weiter nur auf Wunsch des Benutzers.
- **Prüft der Code:** die Warteschlange hält die übrigen Aufgaben über Personen außerhalb des Stammbaums zurück. Sie
  kehren von selbst zurück, sobald die Verbindung erfasst ist ([R2.2.3](R2-lines-and-queue.md#R2.2.3)).
- **Warum:** Arbeit an einer Familie, die nicht in den Stammbaum gehört, ist verlorene Arbeit; es entscheidet die
  Verbindung, nicht der Name (Methodik „The tree first, then above it“).
- **Bedienung:** Terminal: `strom task list --off-tree`. Die App zeigt eine Familie außerhalb des Stammbaums bei der
  Person in **Über der Person** ([S3.3](S3-what-the-research-knows.md#S3.3)).
- **Gilt seit:** Forschung 1.9.0

<!-- zdroj: research:assets/method/core.md "The tree first, then above it" · research:src/commands/tasks.ts --off-tree (od v1.9.0) -->

<a id="R10.5"></a>
## R10.5 Die Namen einer Person

Eine Person kann mehrere Namen haben: den Geburtsnamen, den Ehenamen, einen Ordensnamen, einen anderen. Jeder Name
hat seinen eigenen Datensatz. Namen werden so erfasst, wie sie im Eintrag stehen; vereinheitlicht werden nur Daten.

- **Prüft der Code:**
  - Arten des Namens: Geburtsname (`birth`), nach der Heirat (`married`), Ordensname (`religious`), anderer Name
    (`alias`), ohne Art;
  - ein Name ohne Familiennamen („Marie“) wird um den vollen Namen aus dem Eintrag ergänzt, und die Person wird dann
    mit ihm gezeigt. Derselbe Name noch einmal fügt nur eine Zitation hinzu;
  - eine Frau wird mit ihrem Geburtsnamen gezeigt; der Ehename bleibt daneben;
  - ein mit dem Namen geschriebener Titel („Ing.“, „MUDr.“, „ml.“) kommt in das Präfix oder Suffix des Namens
    (`--prefix`, `--suffix`), nicht in den Vornamen oder den Familiennamen;
  - **der Name, mit dem eine Person gezeigt wird** (eine geschiedene Frau wieder mit ihrem Geburtsnamen), ist eine
    Wahl des Benutzers, keine Angabe aus einem Eintrag: `strom name primary`. Die Identität der Person (Berichtigung
    des Namens, Abgleich) bleibt beim Geburtsnamen.
- **Nur Methodik:**
  - ein Rang oder Amt, das der Eintrag nennt, ist eine Angabe (`TITL`, `OCCU`), kein Teil des Namens;
  - ein Kind, das der Eintrag nicht nennt (totgeboren, ungetauft verstorben), hat keinen Vornamen; an Stelle des
    Namens wird keine Beschreibung geschrieben;
  - eine Person, die ein schwächerer Eintrag anders genannt hat, behält diesen Namen als Variante; der richtige Name
    wird als Hauptname markiert. Nichts wird gelöscht;
  - ein nur teilweise gelesener Name: [R8.6](R8-reading-scans.md#R8.6).
- **Bedienung:** Terminal: `strom name add P… "Marie /Vlková/" --kind birth --cite S…`, `strom name primary P…
  "…"` (`--clear` stellt den Geburtsnamen wieder her). Formen des Nachnamens in der App:
  [A4.5](A4-surnames-and-families.md#A4.5), [A4.6](A4-surnames-and-families.md#A4.6).
- **Gilt seit:** Forschung 1.0.0; Präfix und Suffix 1.13.0; der Name, mit dem eine Person gezeigt wird, 1.27.0; ein
  nicht benanntes Kind 1.27.0

<!-- zdroj: research:src/core/model.ts NAME_KINDS · research:src/commands/people.ts name add (description), name primary (od v1.27.0), TITLE_OPTIONS (od v1.13.0) · research:assets/method/recording.md "The names a record gives", "A child the record does not name" (od v1.27.0), "People named wrongly by the weaker record" · research:assets/method/intake.md krok 4 -->

<a id="R10.5.1"></a>
### R10.5.1 Ein falscher Name und eine Notiz werden zurückgezogen

Ein Name oder eine Notiz, die sich als falsch erweisen, werden nicht gelöscht. Sie werden mit Grund zurückgezogen und
bleiben nur in der Historie.

- **Prüft der Code:**
  - ein zurückgezogener Name verschwindet aus allem, was Namen zeigt, liest oder abgleicht: `strom person show`, das
    Briefing des Agenten, GEDCOM (die App zeigt ihn nach dem Laden des Stammbaums nicht), Suche und Abgleich;
  - der Name, mit dem eine Person gezeigt wird, lässt sich nur zurückziehen, wenn die Person noch einen anderen Namen
    hat. Ein Tippfehler darin wird mit `strom person edit --name` berichtigt;
  - ein zurückgezogener Name lässt sich nicht erneut hinzufügen; zurück kommt er mit `strom name restore` und einem
    Grund;
  - eine Notiz wird mit Grund berichtigt (`strom note edit`) oder zurückgezogen (`strom note retract`); zurück kommt
    sie mit `strom note restore`.
- **Bedienung:** Terminal: `strom name retract P… "Josef /Horák/" --reason "…"`, `strom person show P… --history`.
- **Gilt seit:** Forschung 1.18.0

<!-- zdroj: research:src/commands/people.ts name retract (description), name restore, name add ("name.retracted"), note edit/retract/restore (od v1.18.0) · GitHub issue strom-research #3 -->

<a id="R10.6"></a>
## R10.6 Personen, die ein Eintrag nennt

Ein Eintrag nennt mehr Personen als die Hauptperson: Paten, Zeugen, die Hebamme, den trauenden Geistlichen, den
Anzeigenden, Eltern und Großeltern. Alles, was der Eintrag über sie sagt, wird gleich beim ersten Lesen erfasst.

- **Nur Methodik:**
  - jeder in einer Rolle kommt zum Ereignis als Rolle und Name, mit dem, was der Eintrag über ihn sagt, in Klammern:
    „Pate: Jan Horák (Bauer, Lhota Nr. 12)“. Der Geistliche ist der Trauende oder der Taufende;
  - mit einer Person des Stammbaums wird jemand in einer Rolle nur verbunden, wenn der Eintrag es sagt. Derselbe Name
    genügt nicht;
  - was der Eintrag über jede genannte Person sagt (Beruf, Wohnort, Hausnummer), wird ihre Angabe mit dem Datum des
    Eintrags, auch bei den Großeltern. Ein Eintrag, der die Eltern nennt (die Taufe eines Enkels), ist für sie
    Sekundärinformation ([R3.2.1](R3-verification-and-citation.md#R3.2.1));
  - der Ort ist nur die Gemeinde; die Hausnummer kommt in ein eigenes Feld.
- **Warum:** Paten und Zeugen sind oft Verwandte und belegen eine weitere Verbindung; nach Beruf und Haus wird die
  Person weiter gesucht. Dieselbe Seite erneut zu öffnen kostet mehr, als es gleich zu erfassen (Methodik).
- **Bedienung:** Terminal: `strom event add … --with "godparent:…" --house 13`. App: ein wiederkehrender Pate in den
  Hinweisen der Prüfung des Stammbaums ([A5.5](A5-tree-check.md#A5.5)).
- **Gilt seit:** Forschung 1.0.0

<!-- zdroj: research:assets/method/recording.md "Everyone the entry names in a role", "What the entry says about each person", "A place is the municipality only" · research:assets/method/core.md "Extract everything the first time" · research:assets/method/link.md krok 6 -->
