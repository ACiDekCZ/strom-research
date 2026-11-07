<a id="R10"></a>
# R10 Personen: Identifizierung, Namen und Hypothesen

Wie die Forschung erkennt, dass ein Eintrag der gesuchten Person gehört, was sie mit zwei Datensätzen einer Person
tut, wie sie konkurrierende Erklärungen (Hypothesen) führt und wie sie Namen und die Personen erfasst, die ein Eintrag
nennt. Beschrieben werden die Forschung 1.27.0 und die Strom-App 3.23.0. Änderungen aus einer neueren Version tragen
deren Nummer. Bei den Regeln wird unterschieden, was **der Code prüft** und was nur eine **Regel der Methodik** ist.

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
- **Warum:** strom wählt zwischen zwei Angaben nie stillschweigend: welche gilt, entscheidet der Beleg. Die andere
  wird mit Grund zurückgezogen, so bleibt sichtbar, was wo stand.
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

Eine Hypothese wird für eine Version entschieden oder verworfen, wenn sich keine entscheiden lässt. Wer sie
entscheidet, ist eine Wahl der Forschung ([R10.3.2](#R10.3.2)): **Die KI entscheidet** (der Agent entscheidet selbst,
nur anhand eines zitierten Eintrags; Standard, wenn keine Wahl gespeichert ist) oder **Der Mensch entscheidet** (der
Agent schlägt die Entscheidung nur vor). Die App lässt eine Hypothese nicht entscheiden, sie verweist auf die
Forschung.

- **Prüft der Code:**
  - bei **Der Mensch entscheidet** ist die Entscheidung ein Schritt des Menschen. Startet der Agent `strom hypothesis
    decide` (auch innerhalb von `strom batch`), lehnt strom den Befehl ab;
  - der Agent schlägt die Entscheidung vor: die Version und den Text der Entscheidung (`strom hypothesis propose`)
    oder das Verwerfen (`--abandon`). Ein neuer Vorschlag ersetzt den vorigen. Auf die Antwort wird nicht gewartet,
    die Arbeit geht weiter;
  - der Vorschlag wartet in **Was wartet** in der Gruppe **Hypothesen zu entscheiden**
    ([R6.3.4](R6-awaiting-action.md#R6.3.4)): der Mensch entscheidet wie vorgeschlagen, anders (eine andere Version
    oder keine, mit Grund) oder lässt die Hypothese, wie sie ist. Ein nicht übernommener Vorschlag bleibt in einer
    Notiz der Hypothese;
  - bei **Der Mensch entscheidet** wartet in derselben Gruppe auch eine offene Hypothese ohne Vorschlag: der Mensch
    entscheidet sie selbst (eine Version oder keine, mit dem Text der Entscheidung) oder lässt sie offen. Eine offen
    gelassene Hypothese erscheint in Was wartet wieder, sobald der Agent vorschlägt, wie sie zu entscheiden ist;
  - sowohl die Entscheidung als auch der Vorschlag brauchen den Text der Entscheidung (`--decision`); das Verwerfen
    ist `--abandon`;
  - eine Hypothese, deren Versionen sagen, was sie verbinden würden, wird nur mit angegebener Version entschieden und
    vorgeschlagen (`--variant B`). Ohne sie lehnt strom ab und erfasst nichts;
  - erneut entscheiden (und erneut vorschlagen) lässt sich nur mit Grund (`--reason`). Die vorige Entscheidung bleibt
    in einer Notiz der Hypothese, auch damit, dass der Agent sie entschieden hat. Eine entschiedene oder verworfene
    Hypothese bietet im Menü **Entscheidung ändern**;
  - was die Entscheidung des Menschen verbindet, und die Quellen, die die Hypothese nennt und die keine Angabe ihrer
    Personen zitiert, bekommt der Agent zu Beginn der nächsten Arbeit als erste Aufgabe zum Erfassen im Stammbaum.
- **Nur Methodik:** der Agent schlägt eine Entscheidung vor, wenn die Einträge auf eine Version zeigen, und sagt es dem
  Menschen in einem Satz. Eine entschiedene Hypothese, die ein neuer Eintrag umstößt, schlägt der Agent mit Grund
  erneut vor. Was der Agent zurückgehalten hat, solange die Person nur eine Hypothese war, erfasst er bei der Person,
  sobald die Hypothese entschieden ist.
- **Warum:** eine neue Entscheidung braucht einen Grund, weil sich Entscheidungen offen ändern: die vorige bleibt
  lesbar, und die neue sagt, was sie geändert hat (meist ein neuer Eintrag).
- **Bedienung:** Terminal: Menü `strom` → **Was wartet** → **Hypothesen zu entscheiden** → **Wie vorgeschlagen
  entscheiden**, **Anders entscheiden**, **So lassen (Vorschlag nicht übernommen)**; bei einer offenen Hypothese ohne
  Vorschlag **Entscheiden**, **Offen lassen**; bei einer entschiedenen oder verworfenen **Entscheidung ändern** (Text
  und Grund nötig). Dieselbe Ansicht gibt es in der Durchsicht einer Person: **Die Forschung erweitern** → **Eine Person
  durchsehen** → **Hypothesen zur Person (n)**. Per Befehl `strom hypothesis decide H… --proposed`, `--keep-open` oder
  `--variant B --decision "…"` (erneut mit `--reason "…"`). Agent: `strom hypothesis propose H… --variant B
  --decision "…"`. App: **Was die Forschung weiß** → Hypothese → **In der Forschung entscheiden**, bei einer
  entschiedenen **In der Forschung ändern** ([S3.5](S3-what-the-research-knows.md#S3.5)).
- **Gilt seit:** Forschung 1.0.0; Ausgabe nicht erfasster Quellen 1.12.0
- **Ab Forschung 1.28.0:** entscheidet nur der Mensch, der Agent schlägt vor; die angegebene Version prüft der Code
  (früher nur Methodik). Hypothesen, die früher der Agent entschieden hat, bleiben, wie sie waren.
- **Ab Forschung 1.29.0:** wer entscheidet, ist eine Wahl der Forschung ([R10.3.2](#R10.3.2)); ohne gespeicherte Wahl
  entscheidet die KI, auch in einer früher eingerichteten Forschung. Was wartet bietet auch
  offene Hypothesen ohne Vorschlag (**Entscheiden**, **Offen lassen**) und das Menü **Entscheidung ändern**. Bis 1.28.0
  stand eine offene Hypothese ohne Vorschlag nicht in Was wartet und wurde nur mit dem Befehl `strom hypothesis
  decide` entschieden.
- **Ab App 3.25.0:** **In der Forschung entscheiden** und **In der Forschung ändern** in **Was die Forschung weiß**,
  wo die Forschung auf diesem Computer sie anbietet.

<!-- zdroj: research:src/commands/analysis.ts hypothesis propose, hypothesis decide (person: …, agentMay, --proposed, --keep-open bez návrhu → leftOpen, againNeedsReason, decidedVariant, "earlier … by the agent") · src/cli/main.ts:288 def.person && isAgent && !def.agentMay · src/commands/batch.ts (def.agentMay) · src/core/waiting.ts (hypotheses, hypothesesOpen, TERMINAL_ONLY) · src/cli/menu-waiting.ts decideHypothesis (proposed / open / decided: ui.wait.hypothesis.change) · src/cli/menu-research.ts:532 ui.review.hypotheses · src/core/hypolinks.ts decidedToRecord, sourcesNotOnPeople · src/brief/brief.ts "Decided by the user — record it on the tree first" · assets/lang/cs.json wait.group.hypotheses, ui.wait.hypothesis.*, ui.review.hypotheses · research:assets/method/core.md "The user decides a hypothesis" · assets/method/recording.md "is proposed again" · CHANGELOG.cs.md 1.28.0, 1.29.0 · research 1.28.0 = commit 94a593db · app:src/strings.ts research.decideInResearch, research.hypoChange · CHANGELOG.cs.md 3.25.0 -->

<a id="R10.3.2"></a>
### R10.3.2 Wer die Hypothesen entscheidet: der Mensch oder die KI

Die Wahl der Forschung **Wer die Hypothesen entscheidet** legt fest, wer eine Hypothese entscheidet. **Die KI
entscheidet** ist der Standard: der Agent entscheidet selbst, sobald ein zitierter Eintrag auf eine Version zeigt;
seine Entscheidung ist gekennzeichnet, und der Mensch kann sie jederzeit ändern. **Der Mensch entscheidet**: der Agent
schlägt nur vor, und die Entscheidung wartet in **Was wartet**. Zurück zur Entscheidung durch den Menschen:
`strom config set hypotheses.decide person`.

- **Prüft der Code:**
  - ohne gespeicherte Wahl entscheidet die KI: in einer neuen Forschung, in einer früher eingerichteten Forschung (bis
    Version 1.28.0 gab es die Wahl nicht), bei einer Einrichtung ohne Terminal und wenn ein Agent die Einrichtung
    startet. Eine gespeicherte Wahl (**Der Mensch entscheidet** wie **Die KI entscheidet**) bleibt. Das Umschalten
    ändert bereits entschiedene Hypothesen nicht;
  - die Einrichtung (`strom setup`) bietet **Die KI entscheidet (empfohlen)** zuerst an, mit dem Satz „Empfohlen: Die
    KI entscheidet – die Forschung geht weiter, ohne dass Hypothesen warten; jede ihrer Entscheidungen ist
    gekennzeichnet und lässt sich ändern.“ Enter nimmt sie ohne weitere Bestätigung. Gewähltes **Der Mensch
    entscheidet** wird gespeichert, und das nächste `strom setup` bietet es als aktuelle Wahl an;
  - wo **Der Mensch entscheidet** gespeichert ist, schaltet **Die KI entscheidet** nur der Mensch im Terminal wieder
    ein: die Frage erklärt, was das bedeutet, und verlangt ein zweites Ja. Dasselbe gilt für das Entfernen der
    gespeicherten Wahl (`strom config unset hypotheses.decide`), weil ohne sie die KI entscheidet. Dem Agenten lehnt
    strom beides ab. Zurück zu **Der Mensch entscheidet** geht jederzeit, ohne Bestätigung;
  - bei gespeichertem **Der Mensch entscheidet** und 10 oder mehr offenen Hypothesen im Stammbaum bietet die App in
    **Was die Forschung weiß**, Abschnitt **Hypothesen**, in einem Satz das Umstellen an: „N offene Hypothesen warten
    auf die Entscheidung eines Menschen; mit „Die KI entscheidet“ entscheidet der Agent sie selbst, jede mit
    Begründung.“ **Auf „Die KI entscheidet“ umstellen** öffnet die Forschung im Terminal, wo die Wahl mit einem
    zweiten Ja bestätigt wird; in der App wird die KI nicht eingeschaltet. **Ausblenden** blendet das Angebot für
    diese Forschung dauerhaft aus (in diesem Browser). Das Angebot gibt es nur bei einer Forschung auf diesem Computer,
    die die Wahl kennt und den Link in die Forschung anbietet ([S3.5](S3-what-the-research-knows.md#S3.5));
  - die Wahl gilt für die Forschungen auf diesem Computer. Eine Forschung kann eine eigene haben (`--for-tree`); die
    Wahl aus der App wird nur dieser Forschung geschrieben;
  - der Agent entscheidet nur eine Version, die eine zitierte Quelle der Forschung (S…) stützt. Ohne sie lehnt strom
    ab und bietet einen Vorschlag an (`strom hypothesis propose`);
  - eine Version, die einen Zweig von 10 und mehr Personen außerhalb des Stammbaums an ihn anschließen würde,
    entscheidet der Agent nur mit zwei zitierten Quellen und ohne Einwand dagegen; sonst schlägt er sie nur vor;
  - die Entscheidung des Menschen ändert der Agent nie; stößt ein neuer Eintrag sie um, schlägt er sie erneut vor
    ([R10.3.1](#R10.3.1));
  - eine Hypothese, die sich nicht entscheiden lässt, verwirft der Agent mit dem Text der Entscheidung;
  - die Entscheidung des Agenten trägt eine Marke und den Tag. Terminal: bei der Hypothese **Vom Agenten entschieden
    (Tag).**, in der Liste der Änderungen „H… vom Agenten entschieden: …“ und „H… vom Agenten verworfen: …“. App:
    **Was die Forschung weiß** → **vom Agenten entschieden** mit Tag und Begründung;
  - was die Entscheidung des Agenten verbindet, erfasst der Agent sofort im Stammbaum;
  - ändert der Mensch eine Entscheidung des Agenten, verschwindet die Marke, und die vorige Entscheidung bleibt in
    einer Notiz der Hypothese;
  - im Strom-Archiv gibt es die Wahl nicht.
- **Nur Methodik:** der Agent sagt dem Menschen in einem Satz, was er entschieden hat.
- **Bedienung:** Terminal: die Einrichtung `strom setup`, Schritt **Wer entscheidet die Hypothesen – die unsicheren
  Verbindungen zwischen Personen?** (nur wenn ein Mensch die Einrichtung im Terminal macht; ohne Terminal fragt sie
  nicht, und es gilt die gespeicherte Wahl, ohne sie **Die KI entscheidet**; die Empfehlung gibt es nur hier, das Menü
  Einstellungen bietet die aktuelle Wahl an); Menü **Einstellungen** → **Sprache, Agent, Modell, was der Agent
  allein darf, Geschichten… (die Einrichtung)** → **Wer die Hypothesen entscheidet: …**; `strom config set
  hypotheses.decide person|agent [--for-tree]`, den geltenden Wert zeigt `strom config where`. Zurück zur
  Entscheidung durch den Menschen: `strom config set hypotheses.decide person`. App: **Forschung** →
  **Weitere Aktionen** → **Forschung für diesen Stammbaum…** → **Wer über Hypothesen entscheidet**: **Der Mensch
  entscheidet** wird sofort in die Forschung geschrieben, **Die KI entscheidet** bestätigt die Forschung im Terminal
  (**In der Forschung bestätigen**). Die Zeile erscheint nur mit einer Forschung, die die Wahl kennt. Das Angebot in **Was die Forschung weiß** →
  **Hypothesen**: **Auf „Die KI entscheidet“ umstellen**, **Ausblenden**.
- **Gilt seit:** Forschung 1.29.0, App 3.25.0

<!-- zdroj: research:src/core/config.ts:301 hypotheses.decide (choices person|agent, tree: true), hypothesesDecide · src/commands/setup.ts:1203 requireHuman (ui.consent.hypotheses.agent), :1686 help config set · src/cli/wizard.ts 5c (ctx.interactive && !isAgent) · src/cli/menu-settings.ts:87 hypothesesStep · src/commands/analysis.ts agentMayDecide (hypothesis.user, hypothesis.evidence, hypothesis.branch), citedInSupport · src/core/kin.ts BIG_BRANCH=10, branchJoined · src/core/model.ts:730 decidedByAgent, decidedAt · src/core/changelog.ts:360 · src/core/live.ts:2039 /status.hypotheses, :4647 POST /hypotheses (person hned, agent 403 hypotheses.link) · src/core/links.ts:112 · assets/lang/cs.json ui.setup.hypotheses, ui.hypotheses.decide.*, ui.settings.hypotheses, ui.consent.hypotheses.agent, ui.wait.hypothesis.byAgent, log.hypothesis.decide.agent, log.hypothesis.abandon.agent · CHANGELOG.cs.md 1.29.0 · app:src/strings.ts research.hypoDecideTitle/Person/Agent, hypoDecideConfirm(Link), hypoByAgent, hypoReason, research.treeSettings · src/ui/research-tree-settings-ui.ts · CHANGELOG.cs.md 3.25.0 · spec 060 K1.1–K1.5, K2.1 · výchozí AI (výzkum 1.29.0): research:src/core/config.ts hypothesesDecide (=== person ? person : agent), getDefault hypotheses.decide agent · src/commands/setup.ts syncDecisions/layerChange (agent nebo unset tam, kde je person → requireHuman) · src/cli/wizard.ts 5c (was = stored === person ? 0 : 1; druhé ano jen při uloženém person; person uloženo; ui.setup.model.recommended, ui.setup.hypotheses.recommended) · src/cli/menu-settings.ts hypothesesStep (bez doporučení) · CHANGELOG.cs.md 1.29.0 „Kde nic zvoleno není, rozhoduje AI“ · spec 060 K1.9 · nabídka: app:src/ui/person-research-ui.ts HYPOTHESES_OFFER_MIN = 10, researchHypothesesOffer (HYPOTHESES_DECIDE_FEATURE, hypothesesDecide === person, isOpenHypothesis celého stromu, activeResearchLink hypotheses decide=agent), hideHypothesesOffer (localStorage na výzkum) · strings.ts research.hypoOfferAgent, hypoOfferSwitch, hypoOfferHide · spec 060 K1.6–K1.8 -->

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
- **Warum:** eine Beschreibung an Stelle des Namens („totgeborener Sohn“) würden die App und GEDCOM als Vornamen
  zeigen und suchen, und der Abgleich der Namen hielte sie für einen Namen. Dass das Kind ohne Namen starb, ist eine
  Angabe (Tod, Notiz).
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
