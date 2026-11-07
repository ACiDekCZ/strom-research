<a id="R9"></a>
# R9 Archive: was der Agent darf und was der Mensch tut

Was mit einer Aufgabe geschieht, die Bilder oder Seiten eines bestimmten Archivs braucht: wonach strom das Archiv
beurteilt, was der Agent selbst darf (Downloader, Webabruf, Browser), wann die Aufgabe auf den Menschen wartet und wie
sie in die Warteschlange zurückkehrt. Es gilt gleich für eine automatische Sitzung (`strom run`, eine aus der
Strom-App gestartete Sitzung, der nächtliche Lauf) und für einen Chat mit dem Agenten; die Unterschiede stehen in
[R9.7](#R9.7). Beschreibt die Forschung 1.27.0 und die Strom-App 3.23.0. Bei den Regeln wird unterschieden, was
**der Code prüft** (der Befehl `strom` oder der Hook des Agenten lehnt es ab) und was nur eine **Regel der
Methodik** ist (eine Anweisung an den Agenten, die der Code nicht kontrolliert).

Der Ablauf in Kürze:

1. **Archiv:** strom kennt die Bedingungen der Archive aus der mit der Forschung gelieferten Liste und aus weiteren
   Quellen. Es entscheidet die strengste von ihnen ([R9.1](#R9.1)).
2. **Erlaubnis:** ein Archiv mit Einschränkung öffnet nur die Erlaubnis des Menschen: langsam, über den Browser oder
   nur von Hand ([R9.2](#R9.2)).
3. **Der Agent selbst:** der Downloader des Archivs (Bilder, [R8.2](R8-reading-scans.md#R8.2)), der Webabruf von
   Seiten ([R9.3](#R9.3)) und der Browser des Agenten in Chrome ([R9.4](#R9.4), [R9.5](#R9.5)) folgen denselben
   Regeln.
4. **Warten:** wohin der Agent nicht darf, dort speichert der Mensch die Bilder. Die Aufgabe wartet auf die Bilder
   und kehrt von selbst zurück, sobald alle in der Forschung sind ([R9.6](#R9.6)).
5. **Entscheidung:** die Tabelle und der Ablauf einer Aufgabe stehen in [R9.8](#R9.8), die Schritte des Menschen in
   [R9.9](#R9.9) und Beispiele in [R9.10](#R9.10).

> **Hinweis: wo genau der Browser des Agenten gilt.** Den Browser des Agenten überwacht strom bei **Claude Code**
> mit der Erweiterung **Claude in Chrome**, im eingebauten Browser der App Claude
> ([R12.2](R12-where-the-agent-works.md#R12.2)) und im Browser von Codex nach den Adressen in seinem Code, wenn der
> Mensch den Hook von strom bestätigt hat ([R12.5](R12-where-the-agent-works.md#R12.5)). Den Browser eines anderen
> Agenten (Antigravity und andere) und die Computersteuerung keines Agenten kann strom überwachen: der Agent geht damit
> nicht von sich aus in ein Archiv, das nur der Browser eines Menschen betreten darf, und die Bilder speichert der
> Mensch. Eingebaute Browser und Computersteuerung der Desktop-Apps der Agenten empfiehlt strom nicht; der Agent nutzt sie nur auf ausdrückliche
> Bitte eines Menschen ([R9.4.2](#R9.4.2)). Wo mit dem Agenten gesprochen wird und was strom wo überwacht, fasst
> [R12](R12-where-the-agent-works.md) zusammen.

<!-- zdroj: research:CHANGELOG.cs.md 1.27.0, 1.29.0 · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS, ON_REQUEST · src/core/chromehook.ts:1-25 · src/core/codexhook.ts · app:CHANGELOG.cs.md 3.23.0 -->

<a id="R9.1"></a>
## R9.1 Arten von Archiven

Jede Website, aus der die Forschung Einträge nimmt, hat eine **Stufe** der Bedingungen und kann weitere Grenzen haben.
Die Stufe sagt, was strom automatisch tun darf; die ausführliche Tabelle der Stufen steht in
[R8.2](R8-reading-scans.md#R8.2).

| Angabe in der Liste der Archive | Was sie bedeutet |
|---|---|
| Stufe **erlaubt** | Katalog, Seiten und Bilder automatisch, im Tempo des Dienstes |
| Stufe **eingeschränkt** | Katalog und Seiten; Bilder nur mit Erlaubnis des Menschen ([R9.2](#R9.2)) |
| Stufe **unbekannt** | wie eingeschränkt |
| Stufe **nur von Hand** | Bilder nur von Hand; eine Erlaubnis öffnet das nicht |
| Stufe **verboten** | kein automatischer Zugriff |
| **nur über den Browser eines Menschen** | kein Webabruf, weder Katalog noch Bilder über einen Downloader; höchstens der Browser des Agenten mit der Erlaubnis „über den Browser“ ([R9.4](#R9.4)) |
| **Tempo** | der kürzeste Abstand und höchstens so viele Anfragen pro Stunde; strom geht nie schneller |
| **verbotene Pfade** | Teile der Website, wohin nichts Automatisches darf, auch nicht der Browser des Agenten |
| **Bildserver** | eine andere Website, von der der Bildbetrachter des Archivs seine Bilder nimmt |
| **Bedingungen, Zitat, Datum der Prüfung** | woher die Stufe stammt (Seite der Bedingungen oder robots.txt) und wann sie geprüft wurde |

- **Prüft der Code:** die Stufe des Archivs ist die strengste aus: dem Lesen der Bedingungen durch den Downloader,
  dem Eintrag des Archivs in der Forschung, der mit der Forschung gelieferten Liste der Archive
  (`assets/archives.json`), der strengsten Stufe, die strom beim Server je gesehen hat, und der Datei robots.txt. Ein
  Server, dessen robots.txt die ganze Website allen Robotern schließt (`Disallow: /`), gilt als Website nur über den
  Browser eines Menschen, mit mindestens der Stufe eingeschränkt: der Browser des Agenten darf dorthin nur mit der
  Erlaubnis „über den Browser“, eine Seite nach der anderen und im Tempo eines Menschen ([R9.4](#R9.4)). Ausnahme:
  die Bedingungen der Website erlauben die automatische Nutzung ausdrücklich, und ihre robots.txt nennt keine
  KI-Agenten. Ein Server, der den Client von strom abgelehnt hat, gilt als verboten.
- **Nur von Hand** (die Bilder speichert immer der Mensch, eine Erlaubnis öffnet das nicht) bleibt, was die Liste
  der Archive so führt:
  - ein Pfad zu den Einträgen, den robots.txt allen Robotern schließt (ein verbotener Pfad in der Liste);
  - die Stufe **nur von Hand**: Bedingungen, die nichts anderes erlauben, oder ein namentliches Verbot für KI-Agenten
    dort, wo die Liste es als nur von Hand führt (z. B. eBadatelna SOA Praha, [R9.10.3](#R9.10.3)). Ein namentliches
    Verbot für KI in robots.txt bedeutet für sich allein nicht nur von Hand: ein Archiv damit kann auch nur über den
    Browser eines Menschen gehen;
  - ein Bildbetrachter, der seine Bilder von einem Bildserver nimmt, der ganz allen Robotern geschlossen ist. Ein
    solches Archiv hat in der Liste die Stufe **nur von Hand** (z. B. die Lesesäle des ZA Opava und des SOA
    Litoměřice, [R9.10.2](#R9.10.2)).
- **Grenzen:**
  - ein Archiv nur über den Browser mit der Stufe **nur von Hand** oder mit der Erlaubnis **nur von Hand** erlaubt
    nichts, weder den Browser des Agenten noch den Katalog;
  - der verbotene Pfad `/` (der ganze Bildserver) schließt auch den Browser des Agenten: Bilder nur von Hand;
  - die Websites eines Archivs (z. B. das digitale Archiv und der Lesesaal eines Landesarchivs) haben jede ihren
    eigenen Eintrag; in Was wartet erscheinen sie aber unter einem Namen des Archivs ([R9.6](#R9.6)).
- **Warum:** die Methodik will die Bedingungen jedes Archivs einhalten. Wohin robots.txt nur einen Browser lässt,
  geht höchstens ein Browser, mit Erlaubnis des Menschen und in seinem Tempo; was die Liste der Archive der Hand des
  Menschen überlässt, speichert der Mensch.
- **Bedienung:** Terminal: `strom net web --check <adresa>` (was strom mit einer Adresse tun würde), Menü der Archive,
  `strom allow archive` (nur der Mensch). App: Wartet auf Bearbeitung.
- **Gilt seit:** Forschung 1.14.0. Weitere Archive Tschechiens, Deutschlands und Polens und der Bildserver seit
  1.27.0.

<!-- zdroj: research:src/core/terms.ts:566-680 archiveLevel (robots "Disallow: /" → browserOnly, restricted; robotsYield: openByTerms + robotsNamesAi false), :789-803 allows (browserOnly + manual → nothing) · assets/archives.json (level, browserOnly, pace, disallow, imagesFrom, quote, quoteFrom, checked; metrikai.lt, lagis, gov, online-ofb restricted + browserOnly; ebadatelna.soapraha.cz manual) · src/core/knownterms.ts imagesFrom · test/unit/known-terms.test.ts (imagesFrom closed whole ⇒ manual) · src/core/browserhelp.ts browserHelps (disallow "/") · CHANGELOG.cs.md 1.26.0, 1.27.0 (c3ee4422) -->

<a id="R9.1.1"></a>
### R9.1.1 Eine Website, die die Forschung nicht kennt

- Eine Website, die nicht in der Liste der Archive steht und keinen Downloader hat, beurteilt strom nach dem Eintrag
  des Archivs in der Forschung, der strengsten gesehenen Stufe und der robots.txt, wie strom sie gelesen hat. Ohne
  weitere Angabe hat sie die Stufe **unbekannt**, also wie eingeschränkt.
- Die Seiten einer solchen Website darf der Agent abrufen, in den Grenzen von [R9.3](#R9.3). Bilder nicht: Bilder
  eines Archivs, das nicht erlaubt ist, gehen nie über einen Webabruf.
- **Bedienung:** Terminal: `strom net web --check <adresa>`.
- **Gilt seit:** Forschung 1.14.0

<!-- zdroj: research:src/core/terms.ts:566-680 archiveLevel (unknown → restricted) · src/core/webgate.ts webGate (images of a non-allowed archive) -->

<a id="R9.2"></a>
## R9.2 Die Erlaubnis des Menschen

Ein Archiv mit der Stufe eingeschränkt oder unbekannt öffnet für Bilder nur die Erlaubnis des Menschen. Die Erlaubnis
hat drei Arten, und nur der Mensch gibt sie.

| Art (Terminal) | Text der Wahl | Was der Agent darf |
|---|---|---|
| `--way slow` | Langsam, im Tempo eines Menschen | Bilder über den Downloader, höchstens eines in 10 s und 120 pro Stunde |
| `--way browser` | Über den Browser auf diesem Computer | den Downloader mit dem Weg über den Browser oder den Browser des Agenten, ein Bild nach dem anderen ([R9.5](#R9.5)) |
| `--way manual` | Nur von Hand – die Bilder werden in einen vorbereiteten Ordner gespeichert | nichts; die Bilder speichert der Mensch ([R9.6](#R9.6)) |

- **Prüft der Code:**
  - die Erlaubnis gibt nur der Mensch: in seinem Terminal oder in einem Systemfenster, das erscheint, wenn der Agent
    oder die App den Befehl startet. Der Agent sieht das Fenster nicht und kann nicht darauf klicken. In einer
    automatischen Sitzung ohne Fenster schlägt der Befehl fehl, und der Agent erfasst eine Aufgabe für den Menschen;
  - die Erlaubnis gilt für das Archiv in allen Forschungen auf dem Computer und ist in den Einstellungen des Benutzers
    gespeichert. Sie wird mit der Wahl **Die Entscheidung vergessen** (`--revoke`) widerrufen: beim nächsten Bedarf
    fragt strom erneut;
  - ein Archiv nur über den Browser bekommt nie **langsam** (Bilder nie über einen Downloader). Ein Archiv nur über
    den Browser, zu dem kein Downloader führt, bekommt nur **über den Browser**, **nur von Hand** oder den Widerruf;
  - die Stufen **nur von Hand** und **verboten** öffnet keine Erlaubnis: `strom allow archive … --way browser` (auch
    `slow`) wird abgelehnt, und die App bietet den Link **Erlaubnis…** nicht an;
  - das Tempo eines Menschen (10 s, 120 pro Stunde) lässt sich in der Einstellung `archive.pace` oder mit `strom
    allow host --pace --per-hour` ändern. Das Tempo aus der Liste der Archive ist die untere Grenze: strom geht immer
    langsamer von beiden.
- **Grenzen:** nach der Entscheidung kehren die Aufgaben, die auf dieses Archiv warten, in allen Forschungen auf dem
  Computer in die Warteschlange zurück. Bei der Wahl **Nur von Hand** warten die Aufgaben weiter auf von Hand
  gespeicherte Bilder. Eine Aufgabe, deren Bilder schon im Ordner liegen, kehrt nicht zurück: die Bilder werden
  übernommen ([R9.6](#R9.6)). Eine Aufgabe **Seite prüfen** wird nie geweckt
  ([R6.2.2](R6-awaiting-action.md#R6.2.2)).
- **Warum:** ein Archiv lockern oder öffnen darf nur der Mensch; der Agent darf ein Archiv nur verschärfen.
- **Bedienung:** Terminal: `strom allow archive <web|stahovač> --way slow|browser|manual`, `--revoke`, Menü der
  Archive. App: der Link **Erlaubnis…** im Hinweis bei einem Eintrag, der auf Bilder eines Archivs nur über den
  Browser wartet, und in der Zeile **Browser** ([R9.4.3](#R9.4.3)). Er öffnet die Frage in der Forschung im Terminal,
  auch wenn zum Archiv kein Downloader führt.
- **Gilt seit:** Forschung 1.14.0. Erlaubnis für ein Archiv nur über den Browser ohne Downloader und **Erlaubnis…**
  dafür seit 1.27.0.

<!-- zdroj: research:src/commands/archives.ts:575-738 allow archive (requireHuman :687, browserOnly + slow refused, bareArchive) · src/cli/context.ts:253 requireHuman · src/core/archivewait.ts:188 wakeForArchive (manual + images kept, saved in inbox) · src/core/terms.ts:1018 humanPace · src/core/net.ts:45 HUMAN_PACE · assets/lang/cs.json ui.archive.way.* · commit 74dcd58b -->

<a id="R9.3"></a>
## R9.3 Webabruf durch den Agenten

Seiten einer Website (Katalog, Suchergebnisse, Beschreibung eines Buches) ruft der Agent mit seinem Werkzeug für das
Web ab. strom prüft ihn mit einem Hook vor jedem Abruf und zählt die Anfragen an jede Website.

- **Prüft der Code (Hook des Agenten und `strom net web --check`):**
  - ein verbotenes Archiv oder eine Website, die den Client von strom abgelehnt hat: nur die Seite der Bedingungen,
    höchstens 3-mal am Tag, und robots.txt;
  - ein Archiv nur über den Browser eines Menschen: kein Webabruf. Der Agent bekommt einen Rat: die Erlaubnis „über
    den Browser“ oder das Warten auf Bilder (`strom task wait T… --images B…:<čísla>`);
  - ein Archiv nur von Hand, die Erlaubnis nur von Hand und ein verbotener Pfad aus der Liste der Archive: nur von
    Hand, auch nicht der Browser des Agenten;
  - ein Pfad, den robots.txt verbietet: abgelehnt;
  - Bilder eines Archivs, das nicht erlaubt ist: nie über einen Webabruf.
- **Grenzen:**
  - nach 12 Anfragen an eine Website in einer Sitzung geht an die ganze Website höchstens eine Anfrage alle 6 s, und
    strom rät zu einem Downloader;
  - nach 30 Anfragen an eine Website in einer Sitzung (Einstellung `web.perHost`): in einer automatischen Sitzung
    abgelehnt, im Chat fragt strom den Menschen einmal pro Sitzung und Website;
  - auf einen freien Platz wartet strom höchstens 30 s; abgelehnt wird auch, wenn strom die Website in Ruhe lässt,
    ihr Limit erschöpft ist oder die stündliche Obergrenze erreicht ist.
- **Nur Methodik:** bei einer abgelehnten Website zuerst ein anderer Weg. Die Suche wird mit dem Ergebnis unklar
  erfasst (`strom search add … --result inconclusive`). Erst wenn die Quelle weiter nötig ist, wartet die
  Aufgabe darauf, dass der Mensch die Website prüft (`strom task wait --check`,
  [R6.2.2](R6-awaiting-action.md#R6.2.2)).
- **Warum:** Webabrufe und der Browser des Agenten werden zusammen gezählt und gebremst, damit kein Weg schneller geht
  als ein anderer.
- **Bedienung:** Terminal (Agent): `strom net web --check <adresa>`.
- **Gilt seit:** Forschung 1.14.0

<!-- zdroj: research:src/core/webgate.ts webGate (TERMS_PER_DAY, browserOnly advice, otherWay) · src/core/web.ts WEB_SOFT 12, WEB_SOFT_GAP_MS, WEB_PER_HOST 30, WEB_WAIT_MAX_MS · src/core/config.ts web.perHost · assets/method/locate.md -->

<a id="R9.4"></a>
## R9.4 Der Browser des Agenten

Der Browser des Agenten ist Chrome mit der Erweiterung **Claude in Chrome**, gesteuert von **Claude Code**. Vor jedem
Öffnen einer Seite entscheidet strom genauso wie beim Webabruf ([R9.3](#R9.3)), nur auf dem Weg des Browsers eines
Menschen. Genauso überwacht es den eingebauten Browser der App Claude
([R12.2](R12-where-the-agent-works.md#R12.2)).

- **Prüft der Code (Hook vor dem Öffnen einer Seite):**
  - ein Archiv nur über den Browser eines Menschen und Bilder eines Archivs mit Einschränkung öffnen sich nur mit der
    Erlaubnis **über den Browser**, eine Seite nach der anderen, im Tempo eines Menschen. Verbotene Pfade aus der Liste
    der Archive bleiben geschlossen;
  - ein verbotenes Archiv, eine Website, die den Client von strom abgelehnt hat, ein in robots.txt verbotener Pfad,
    Bilder nur von Hand und die Brücke zur Strom-App: abgelehnt;
  - jedes Öffnen einer Seite wird festgehalten, gezählt und zusammen mit den Abrufen derselben Website gebremst
    (dieselben Grenzen wie [R9.3](#R9.3));
  - die Werkzeuge auf einer Seite (Klicken, Lesen der Seite, Skript) werden nach der Website geprüft, die zuletzt im
    Tab geöffnet wurde. Eine Website, die strom gerade in Ruhe lässt, wird abgelehnt; anderes wird nicht gezählt;
  - eine Datei hochladen, ein Bild hochladen, Tastenkürzel, GIF-Aufnahme und ein Stapel von Aktionen sind dem Agenten
    verboten.
- **Grenzen:** der Hook sieht weder einen Klick noch eine in die Seite geschriebene Adresse, noch Anfragen, die die
  Seite selbst stellt. Daher die Regel: von Seite zu Seite eines Archivs nur durch Öffnen der Adresse, nie durch
  Durchklicken einer Reihe von Seiten.
- **Nur Methodik:** eine Prüfung, ob ein Mensch am Computer ist (Altcha, CAPTCHA, Bot-Prüfung), durchläuft oder
  umgeht der Agent nie.
- **Warum:** nur bei Claude Code kann strom einen Hook vor dem Öffnen einer Seite starten; bei den anderen Agenten gibt
  es keinen solchen Hook (geprüft am 4. 11. 2026).
- **Bedienung:** Terminal: `strom doctor` (Zeile **Browser (Claude in Chrome)**), `strom agents use claude`.
- **Gilt seit:** Forschung 1.27.0

<!-- zdroj: research:src/core/chromehook.ts:1-25 (navigate, page tools, what the hook cannot see) · src/core/webgate.ts browserGate · src/core/browser.ts CHROME_DENY · src/core/browserhelp.ts GUARDED_BROWSER_AGENTS · assets/lang/cs.json ui.doc.browser · CHANGELOG.cs.md 1.27.0 -->

<a id="R9.4.1"></a>
### R9.4.1 Wann eine Sitzung Chrome bekommt

- Die Einstellung `agent.browser` gilt für die Sitzungen von Claude Code, die strom startet:
  - **archives** (Standard): Chrome nur in einer Forschung, deren Downloader über den Browser lädt, oder mit einem
    Archiv nur über den Browser mit der Erlaubnis **über den Browser**, für deren Websites;
  - **always**: Chrome in jeder Sitzung, für die Websites der Archive der Forschung; bei anderen Websites fragt der
    Chat. Einschalten darf es nur der Mensch.
- Eine automatische Sitzung schaltet Chrome nach der Aufgabe ein: nicht für Erzählungen und Anfragen; ja für ein Buch
  aus einem Downloader über den Browser, für ein Archiv nur über den Browser mit Erlaubnis und für eine Website, die
  die Forschung nicht kennt. Ein Chat bekommt Chrome nach der Einstellung oben.
- In einer automatischen Sitzung kann der Agent weder auf einen anderen Browser umschalten noch den Menschen fragen.
- **Bedienung:** Terminal: `strom config set agent.browser archives|always`.
- **Gilt seit:** Forschung 1.14.0. Archiv nur über den Browser mit Erlaubnis seit 1.27.0.

<!-- zdroj: research:src/core/connector.ts agentBrowser, sessionBrowser · src/commands/start.ts:244 chrome · src/runners/claude.ts RUN_DISALLOWED (AskUserQuestion, switch_browser) · src/core/config.ts agent.browser -->

<a id="R9.4.2"></a>
### R9.4.2 Eingebaute Browser und Computersteuerung: nicht empfohlen

- In der Forschung wird an den Desktop-Apps der Agenten nichts abgeschaltet. Den eingebauten Browser der App Claude
  (auch ihre Vorschau) überwacht strom wie Claude in Chrome ([R12.2](R12-where-the-agent-works.md#R12.2)), den
  Browser der App ChatGPT (Codex) nach den Adressen in seinem Code, sobald der Mensch den Hook von strom bestätigt
  ([R12.5](R12-where-the-agent-works.md#R12.5)). Die Computersteuerung der App Claude und der App ChatGPT überwacht
  strom nicht ([R12.10](R12-where-the-agent-works.md#R12.10)). Keinen davon empfiehlt strom.
- **Nur Methodik:** der Agent nutzt sie nicht von sich aus: in ein Archiv, das nur der Browser eines Menschen betreten
  darf, geht er damit nicht, und die Bilder speichert der Mensch ([R9.6](#R9.6)). Bittet ein Mensch ausdrücklich
  darum, ist es die Wahl des Menschen: der Agent sagt in einem Satz, ob strom diesen Weg überwacht, und was die
  Bedingungen des Archivs sagen. Die Bedingungen umgeht er nie, und die Prüfung, ob ein Mensch am Computer ist,
  durchläuft er nie.
- Der Agent arbeitet nie in einer Kopie der Forschung, die die Desktop-App des Agenten in einem eigenen Worktree
  öffnet.
- **Warum:** vor den nicht überwachten hat strom keinen Hook, also prüft es die Seiten nicht, die sie öffnen. Der
  Downloader des Archivs, der Webabruf von Seiten und der Browser des Agenten in Chrome halten sich immer an die
  Regeln der Archive ([R9.3](#R9.3), [R9.4](#R9.4)).
- **Bedienung:** Terminal: `strom doctor`, Zeile **Browser der Desktop-Apps**.
- **Gilt seit:** Forschung 1.27.0; 1.29.0: eingebauter Browser der App Claude und Browser von Codex überwacht
<!-- zdroj: research:src/core/browserhelp.ts ON_REQUEST, browserKept · src/core/browser.ts CODEX_BROWSER_SERVERS, Claude_Browser matcher · src/brief/brief.ts · src/commands/guide.ts · src/commands/setup.ts:527 desktop · assets/lang/cs.json ui.doc.desktop.unwatched · CHANGELOG.cs.md 1.27.0, 1.29.0 · commit 6968ab72 (agent řekne, zda strom cestu hlídá) -->

<a id="R9.4.3"></a>
### R9.4.3 Zustand des Browsers in strom doctor und in der App

Die Zeile **Browser (Claude in Chrome)** in `strom doctor` bei Archiven nur über den Browser, mit denen die Forschung
arbeitet:

| Zustand | Was die Zeile sagt |
|---|---|
| ein anderer Agent als Claude Code | nur über den Browser eines Menschen; mit Claude Code und der Erweiterung würde der Agent die Bilder selbst speichern, mit diesem Agenten werden sie von Hand gespeichert (Rat `strom agents use claude`) |
| die Erweiterung fehlt | nur über den Browser eines Menschen; mit der Erweiterung Claude in Chrome würde der Agent die Bilder selbst speichern, bis dahin von Hand (mit einem Link zur Erweiterung) |
| die Erlaubnis fehlt | mit der Erlaubnis „über den Browser“ für das Archiv speichert der Agent die Bilder selbst |
| alles bereit | der Agent speichert die Bilder selbst über den Browser |

- Denselben Rat geben einmal der Auftrag des Agenten und Was wartet ([R9.6](#R9.6)).
- Die App zeigt die Zeile **Browser** unter der Zeile **Agent** in den Dialogen **Forschung für diesen Stammbaum** und
  **Die Forschung ist bereit**: **Claude in Chrome verbunden.**, mit Archiven, die nur im Browser zugänglich sind,
  **… der Agent lädt auch aus Archiven, die nur im Browser zugänglich sind** (ohne Erlaubnis bei einigen: **Ohne
  Erlaubnis:** die ersten drei Archive, jedes mit dem Link **Erlaubnis…**), **Die Erweiterung Claude in Chrome fehlt
  – Bilder aus Archiven, die nur im Browser zugänglich sind, speichert ein Mensch.** oder bei einem anderen Agenten
  **den Browser dieses Agenten überwacht Strom nicht**. Bei einem Eintrag, der auf Bilder eines solchen Archivs
  wartet, steht derselbe Rat als Hinweis. Eine Forschung, die als Archiv dient, hat die Zeile nicht.
- **Bedienung:** Terminal: `strom doctor`. App: Dialog **Forschung für diesen Stammbaum**, Wartet auf Bearbeitung.
- **Gilt seit:** Forschung 1.27.0

<!-- zdroj: research:src/commands/setup.ts:490-516 · src/core/browserhelp.ts browserState, agentBrowserAdvice, personBrowserNote · assets/lang/cs.json ui.doc.browser.archives.* · app:src/research-browser.ts:75-98 browserRow, :170-201 browserNote · src/ui/research-browser-ui.ts:96-144 · src/strings.ts research.browser -->

<a id="R9.5"></a>
## R9.5 Ein Bild über den Browser des Agenten

Wo der Mensch einem Archiv nur über den Browser die Erlaubnis **über den Browser** gegeben hat, speichert der Agent
die Bilder selbst, eines nach dem anderen: er öffnet das Bild in Chrome und speichert, was der Bildbetrachter des
Archivs zeigt.

- **Prüft der Code:**
  - nur Claude Code mit der Erweiterung Claude in Chrome und mit der Erlaubnis **über den Browser**; sonst lehnt der
    Befehl ab und sagt, was noch fehlt;
  - die Adresse des Bildes durchläuft die Prüfung des Browsers des Agenten ([R9.4](#R9.4));
  - gespeichert wird nur ein Bild, das der Tab unter seiner eigenen Adresse zeigt. Ein auf ein anderes Bild
    weitergeschalteter Betrachter wird abgelehnt, und nichts wird gespeichert. Nie mehr, als der Betrachter des
    Archivs gibt, nie größer als das Original;
  - der Befehl setzt die Aufgabe auf Warten auf dieses Bild. Die Datei wird in den Ordner der Downloads gespeichert
    (`strom-T…-<číslo>.jpg`), und `strom media add --inbox --waiting` verschiebt sie unter der Nummer des Bildes in
    den Ordner der Aufgabe ([R9.6](#R9.6)).
- **Grenzen:** Chrome speichert von einer Seite nur eine Datei. Weitere Downloads von derselben Seite muss der Mensch
  in der Adressleiste von Chrome erlauben; der Agent ändert die Einstellungen von Chrome nie.
- **Nur Methodik:** ein Downloader für ein Archiv, dessen Betrachter Bilder in Kacheln zeigt, speichert ebenfalls über
  den Browser, auch einen Teil eines Bildes; die Seite des Buches öffnet er einmal und lädt sie nie neu.
- **Warum:** die Erlaubnis „über den Browser“ erlaubt, was ein Mensch in seinem Browser tun würde, in seinem Tempo.
- **Bedienung:** Terminal (Agent): `strom media save T… --image <číslo> --at <adresa> [--recordset B…]`, danach
  `strom media add --inbox --waiting`.
- **Gilt seit:** Forschung 1.27.0

<!-- zdroj: research:src/commands/media.ts:1206-1294 media save (browserGate, guarded browser, permission browser, Downloads strom-T…-n.jpg) · commit dadd91e7 (viewer paged on) · src/core/browserhelp.ts agentBrowserAdvice · src/agents/files.ts:80-95 · CHANGELOG.cs.md 1.27.0 -->

<a id="R9.6"></a>
## R9.6 Warten auf Bilder und Rückkehr der Aufgabe

Wo der Agent die Bilder nicht bekommt, wartet die Aufgabe auf den Menschen. Die Forschung nennt das Buch und die
Nummern der Bilder und bereitet für sie einen Ordner vor. Die Aufgabe kehrt von selbst in die Warteschlange zurück,
sobald alle ihre Bilder in der Forschung sind.

- **Prüft der Code:**
  - `strom task wait T… --images B…:<čísla>` bereitet den Ordner `inbox/<B… název knihy>` im gemeinsamen Ordner vor
    (der Name höchstens 80 Zeichen);
  - eine Datei trägt die Nummer des Bildes (`40.jpg`, `9a.jpg`). Anders benannte Dateien werden der Reihe nach
    nummeriert, wenn es so viele sind, wie Bilder fehlen;
  - eine Datei wird übernommen, sobald sie sich 3 s nicht ändert (ein großer Scan wird nie halb übernommen);
  - Übernahme: sofort, wenn die Brücke zur Strom-App läuft (sie schaut in die Ordner der wartenden Aufgaben, erneut
    alle 30 s); sonst beim Start der nächsten Sitzung; oder sofort mit dem Befehl `strom media add --inbox --waiting`;
  - die Aufgabe kehrt zurück, sobald alle Bilder da sind, mit einer Notiz, was gekommen ist. Bei einem Teil wartet sie
    weiter, und Was wartet zeigt, wie viele von wie vielen gespeichert sind und welche fehlen;
  - Bilder aus der App gehen direkt zur Aufgabe: nummeriert nach dem Bild, das die App angibt, sonst nach dem
    Dateinamen, sonst in der Reihenfolge der fehlenden; ein PDF Seite für Seite. Ein Bild mit einer Nummer, die die
    Forschung schon hat, wird abgelehnt, wenn es sie nicht ersetzen soll; ein ersetztes wird nie gelöscht. Eine Datei,
    die mit einem schon übernommenen Bild identisch ist (andere Nummer oder anderes Buch), wird abgelehnt, und nichts
    wird übernommen. Dieselbe Datei, erneut unter derselben Nummer gesendet, ändert nichts und wird als gespeichert
    gemeldet;
  - eine in der App geschriebene Antwort bringt die Aufgabe genauso zurück wie eine Antwort im Terminal und wird mit
    der Notiz gespeichert, dass sie aus der App kam. Eine Aufgabe, die inzwischen auf etwas anderes wartet, bleibt
    unverändert.
- **Grenzen (wann Bilder eine Aufgabe zurückbringen):**
  - eine Aufgabe, die auf Bilder wartet, bringt nur ihr Buch zurück, und erst wenn alle da sind;
  - eine Aufgabe, die auf eine Website wartet (`--kind web`), bringt das Buch zurück, das sie nennt, oder das einzige
    Buch, in dem sie arbeitet;
  - einen Brief und eine Anfrage an die Familie bringt nur das Buch zurück, das sie nennen;
  - eine Aufgabe, die auf das Prüfen einer Seite durch den Menschen wartet, bringen sie nie zurück (es antwortet nur
    der Mensch).
- **Nur Methodik (Methodik, `strom guide` und Briefing des Agenten gleich):** bei Bildern von Hand nennt der Agent
  das Buch, die Nummern der Bilder, das Format (JPEG), den Dateinamen und den Ordner. Selbst öffnet und lädt er
  nichts, auch nicht mit einem Browser. Die einzige Ausnahme: bei einem Archiv nur über den Browser eines Menschen,
  dem der Mensch die Erlaubnis **über den Browser** gegeben hat und zu dem kein Downloader führt, speichert Claude in
  Chrome die Bilder einzeln mit `strom media save` ([R9.5](#R9.5)). Sonst öffnet und lädt der Agent dort nichts;
  die Prüfung, ob ein Mensch am Computer ist, durchläuft nur der Mensch.
- **Warum:** die Bilder sind das, worauf die Aufgabe gewartet hat; ein Teil der Bilder schließt die Aufgabe nicht ab.
- **Bedienung:** Terminal: `strom task wait T… --images B…:40-45`, `strom media add --inbox --waiting`, in Was wartet
  **Den Ordner öffnen (M/N gespeichert)**. App: Wartet auf Bearbeitung, beim Eintrag in dieser Reihenfolge
  **Bilder hinzufügen**, **Website öffnen ↗**, **Antworten**, **Mit Agent besprechen**, **Ordner öffnen** (die
  letzten beiden öffnen die Forschung im Terminal). Den Zustand der Bilder zeigt „1 von 2 Bildern“ und beim Buch die
  Chips **gespeichert** / **fehlt**. Die Websites eines Archivs warten in einer Gruppe **Archiv** unter dem Namen des
  Archivs, mit dem Link **Archiv-Website ↗** und der Zahl der fehlenden Bilder.
- **Grenzen (Gruppe des Archivs):** die Gruppe ist das Archiv der Forschung, zu dem die Aufgabe gehört: nach dem Buch
  der Aufgabe, der Adresse des Archivs, der Adresse seines Buchs, einer anderen Website desselben Archivs laut Liste
  der Archive oder dem Namen des Archivs. Nur wenn die Forschung kein solches Archiv hat, ist die Gruppe ein Archiv
  aus der Liste der Archive; sonst die Website selbst.
- **Grenzen (App):** eine Antwort höchstens 4000 Zeichen; auf eine Aufgabe, die auf das Prüfen einer Seite wartet,
  wird nur im Terminal geantwortet. Auf dem Telefon werden keine Bilder hinzugefügt, und das Terminal öffnet sich
  nicht.
- **Gilt seit:** Forschung 1.0.0 (Ordner in `inbox/`), Wecken nach dem Speichern seit 1.15.0. Übernahme ohne Befehl,
  Teile der Bilder, Antwort und Bilder aus der App und ein Archiv unter einem Namen seit Forschung 1.27.0 und App
  3.23.0.

<!-- zdroj: research:src/commands/tasks.ts:1041 task wait (--images, folder) · src/core/media.ts:117 inboxFolderFor · src/core/inboxwait.ts:25 SETTLE_MS · src/core/inboxwatch.ts:1-8 (30 s) · src/commands/media.ts:141-180 wakeWaiting · src/core/live.ts waiting/<T> answer, PUT /media (X-Strom-Task, X-Strom-Image, 409 waiting.image-same) · src/commands/media.ts:403-478 (same sha under its number → 200 same: true, added []; another number/book → 409 waiting.image-same) · src/core/waiting.ts actionsOf, archiveGroup · src/core/waitkind.ts waitGroupOf (repo: before archive:, host:) · assets/method/waiting.md "Images saved by hand" (the one exception, 7bd55fa1) · assets/method/reading.md · src/commands/guide.ts rule 7 · src/agents/files.ts:80-95 · CHANGELOG.cs.md 1.27.0 · app:CHANGELOG.cs.md 3.23.0 · src/research-waiting.ts:216-272 (actions, order), :448-488 assignImages · src/research-waiting-write.ts:532 WAITING_ANSWER_MAX · src/ui/research-overview-ui.ts:698-812 group head · src/strings.ts live.waitingTask -->

<a id="R9.7"></a>
## R9.7 Automatische Sitzung und Chat

Die Regeln der Archive sind in beiden gleich. Sie unterscheiden sich darin, wer dabei ist und was an einer Grenze
geschieht.

| | Automatische Sitzung (`strom run`, App, nächtlicher Lauf) | Chat mit dem Agenten |
|---|---|---|
| Chrome | nach der Aufgabe ([R9.4.1](#R9.4.1)) | nach der Einstellung `agent.browser` |
| Frage des Agenten an den Menschen | keine (AskUserQuestion aus) | ja |
| Umschalten des Browsers | aus | erlaubt |
| mehr als 30 Anfragen an eine Website | abgelehnt | strom fragt einmal pro Sitzung und Website |
| Erlaubnis eines Archivs | niemand ist dabei: der Befehl schlägt fehl, der Agent erfasst eine Aufgabe für den Menschen und geht einen anderen Weg | Systemfenster für den Menschen, nur wo das System es zeigt |
| Bilder, die der Agent nicht bekommt | die Aufgabe wartet auf Bilder, die Sitzung macht mit einer anderen Aufgabe weiter | dasselbe; der Mensch kann die Bilder sofort speichern, und der Agent übernimmt sie mit dem Befehl |

- **Grenzen:** der Agent schreibt nie an Stelle des Menschen: weder die Erlaubnis noch die Antwort auf das Prüfen
  einer Seite noch die Antwort auf ein Warten. Im Chat bleiben sie genauso dem Menschen vorbehalten.
- **Bedienung:** siehe [R7](R7-when-the-agent-works.md) (wann und wie lange eine Sitzung läuft).
- **Gilt seit:** Forschung 1.14.0. Der Browser des Agenten seit 1.27.0.

<!-- zdroj: research:src/runners/claude.ts RUN_DISALLOWED · src/core/web.ts WEB_PER_HOST (STROM_NONINTERACTIVE) · src/cli/context.ts:253 requireHuman (run: task for the person) · src/core/connector.ts sessionBrowser, agentBrowser · src/commands/start.ts:244 -->

<a id="R9.8"></a>
## R9.8 Was mit einer Aufgabe geschieht: eine Tabelle

Eine Aufgabe braucht Bilder eines Buches aus einem bestimmten Archiv. Die Zeile wird nach Archiv und Erlaubnis
gewählt. Wo die Tabelle „Claude + Chrome“ sagt, ist Claude Code mit der Erweiterung Claude in Chrome und mit
laufendem Chrome gemeint.

| Archiv | Erlaubnis | Agent | Was der Agent tut | Wie die Aufgabe endet |
|---|---|---|---|---|
| erlaubt | nicht nötig | beliebig | Downloader: Katalog und Bilder im Tempo des Dienstes; ohne Downloader baut der Agent einen | Bilder in der Forschung, Lesen ([R8](R8-reading-scans.md)) |
| eingeschränkt oder unbekannt | keine | beliebig | Katalog und Seiten; keine Bilder; der Downloader stellt die Frage des Archivs | wartet auf die Erlaubnis ([R6.3.1](R6-awaiting-action.md#R6.3.1)) |
| eingeschränkt oder unbekannt | langsam | beliebig | Bilder über den Downloader im Tempo eines Menschen | Bilder in der Forschung |
| eingeschränkt oder unbekannt | über den Browser | Claude + Chrome | Downloader auf dem Weg über den Browser | Bilder in der Forschung |
| nur über den Browser | über den Browser | Claude + Chrome | `strom media save`, Bild für Bild | Bilder in der Forschung, die Aufgabe kehrt zurück |
| nur über den Browser | keine | Claude + Chrome | nichts im Archiv; `task wait --images` | wartet auf Bilder; Was wartet bietet die Erlaubnis an |
| nur über den Browser | beliebig | ein anderer Agent oder ohne Erweiterung | nichts im Archiv; `task wait --images` | wartet auf Bilder, der Mensch speichert sie |
| nur über den Browser | nur von Hand | beliebig | nichts; `task wait --images` | wartet auf Bilder, der Mensch speichert sie |
| nur von Hand, verbotener Pfad `/`, Bildserver ganz geschlossen | keine Erlaubnis öffnet es | beliebig | nichts; `task wait --images` | wartet auf Bilder, der Mensch speichert sie |
| verboten, hat den Client abgelehnt | keine Erlaubnis öffnet es | beliebig | nur die Seite der Bedingungen und robots.txt; ein anderer Weg | Suche unklar; ist die Quelle nötig, Seite prüfen ([R6.2.2](R6-awaiting-action.md#R6.2.2)) |

- **Grenzen:** der Abruf von Seiten einer Website (Katalog, Beschreibung eines Buches) richtet sich nach
  [R9.3](#R9.3), unabhängig von den Bildern.
- **Gilt seit:** Forschung 1.27.0

<!-- zdroj: research:src/core/terms.ts:789-803 allows · src/core/webgate.ts webGate, browserGate · src/core/browserhelp.ts agentBrowserAdvice, browserHelps · src/commands/media.ts:1206 media save · src/commands/tasks.ts:1041 task wait -->

<a id="R9.8.1"></a>
### R9.8.1 Ablauf einer Aufgabe, die auf Bilder wartet

1. Eine **offene** Aufgabe braucht Bilder des Buches B….
2. Darf der Downloader sie laden ([R9.8](#R9.8)), werden sie geladen, und die Aufgabe geht mit dem Lesen weiter. Ende.
3. Sonst setzt der Agent `strom task wait T… --images B…:40-45`. Die Aufgabe ist im Zustand **wartet**, in Was
   wartet unter dem Namen des Archivs, mit einem Ordner in `inbox/`.
4. Mit der Erlaubnis **über den Browser** und mit Claude + Chrome speichert der Agent die Bilder selbst
   ([R9.5](#R9.5)) und übernimmt sie.
5. Sonst speichert der Mensch die Bilder in den Ordner oder sendet sie aus der App (**Bilder hinzufügen**)
   ([R9.9](#R9.9)).
6. Übernahme: die Brücke sofort, sonst der Start der nächsten Sitzung oder der Befehl
   `strom media add --inbox --waiting`.
7. Sind alle Bilder da, ist die Aufgabe wieder **offen** in der Warteschlange, mit einer Notiz, was gekommen ist.
   Fehlen einige, wartet sie weiter, und Was wartet zeigt, welche fehlen (zurück zu Schritt 5).
8. Jederzeit dazwischen: eine Antwort des Menschen (in der App oder `strom task wake T… --answer`) bringt die Aufgabe
   mit der Antwort zurück. Die Erlaubnis **langsam** oder **über den Browser** bringt die Aufgaben zurück, die auf das
   Archiv warten und im Ordner noch nichts haben.

- **Gilt seit:** Forschung 1.27.0, Strom-App 3.23.0

<!-- zdroj: research:src/commands/media.ts:141 wakeWaiting · src/core/archivewait.ts:188 wakeForArchive · src/core/inboxwatch.ts · src/commands/session.ts takeWaiting · src/core/live.ts waiting answer -->

<a id="R9.9"></a>
## R9.9 Was der Mensch tut

Schritte bei einer Aufgabe, die auf Bilder eines Archivs wartet, wohin der Agent nicht darf:

1. **Finden:** App: **Wartet auf Bearbeitung** (Gruppe nach Archiv). Terminal: Menü **Was wartet (n)** oder
   Statuszeile **Wartet: N**. Der Eintrag nennt das Buch, die Nummern der Bilder und was dafür fehlt.
2. **Den Weg entscheiden:**
   - mit Claude Code und der Erweiterung Claude in Chrome lässt sich dem Archiv die Erlaubnis **über den Browser**
     geben (App: der Link **Erlaubnis…** im Hinweis beim Eintrag, Terminal `strom allow archive <web> --way
     browser`). Die Aufgabe kehrt zurück, und der Agent speichert die Bilder selbst ([R9.5](#R9.5));
   - sonst, oder bei einem Archiv nur von Hand, die Bilder von Hand speichern (die nächsten Schritte).
3. **Das Buch öffnen** im Browser auf der Website des Archivs, mit Anmeldung und der Prüfung auf einen Menschen, wo
   das Archiv sie verlangt.
4. **Die Bilder speichern** mit den Nummern, die der Eintrag nennt, als JPEG, benannt nach der Nummer des Bildes
   (`40.jpg`, `41.jpg`), in den Ordner der Aufgabe (**Ordner öffnen** in der App, **Den Ordner öffnen** im Terminal).
   Oder sie in der App am Computer über **Bilder hinzufügen** hinzufügen (auch durch Ziehen auf den Eintrag); die
   Nummer des Bildes nimmt die App aus dem Dateinamen, sonst vergibt sie sie der Reihe nach.
5. **Fertig:** mit der Brücke zur App werden die Bilder von selbst übernommen; sonst bei der nächsten Sitzung oder
   sofort mit `strom media add --inbox --waiting`. Fehlen einige, sagt es Was wartet.
6. **Es geht nicht:** eine Antwort in Worten (App **Antworten**, Terminal `strom task wake T… --answer "<co>"`) bringt
   die Aufgabe mit der Antwort zurück, z. B. dass das Buch nicht online ist.

- **Grenzen:** Erlaubnis, Antwort und das Speichern der Bilder gehören nur dem Menschen; der Agent tut sie nicht an
  seiner Stelle ([R6.6](R6-awaiting-action.md#R6.6)).
- **Bedienung:** App: Wartet auf Bearbeitung. Terminal: Was wartet, `strom allow archive`,
  `strom media add --inbox --waiting`.
- **Gilt seit:** Forschung 1.27.0, Strom-App 3.23.0

<!-- zdroj: research:assets/method/waiting.md "Images saved by hand" · src/core/waiting.ts actionsOf · src/core/browserhelp.ts personBrowserNote · app:CHANGELOG.cs.md 3.23.0 -->

<a id="R9.10"></a>
## R9.10 Beispiele

Stufen und Grenzen stammen aus der Liste der Archive der Forschung 1.27.0, DigiArchiv SOA Třeboň aus der Forschung
1.28.0. Die Familie Horák ist erfunden.

<a id="R9.10.1"></a>
### R9.10.1 Moravský zemský archiv (Acta Publica)

- Archiv: eingeschränkt, nur über den Browser eines Menschen, Tempo mindestens 4 s. Die Volkszählungsbögen
  (`/scitacioperaty/`) sind nach dem Archiv nur zum Ansehen: ein verbotener Pfad, auch nicht der Browser des Agenten;
  das Bild speichert der Mensch.
- Aufgabe: die Taufe von Marie Horáková in einer Matrik in Acta Publica. Weder der Downloader noch ein Webabruf kommt in
  das Archiv.
- Mit Claude Code, der Erweiterung und der Erlaubnis **über den Browser**: der Agent öffnet das Bild und speichert es
  mit `strom media save`, im Tempo eines Menschen (10 s; das Tempo des Archivs von 4 s ist die untere Grenze). Die
  Aufgabe kehrt zurück, sobald sie alle Bilder hat.
- Ohne Erlaubnis oder mit einem anderen Agenten: die Aufgabe wartet auf Bilder; Was wartet sagt, womit der Agent sie
  selbst speichern würde.
- Einen früher für dieses Archiv gebauten Downloader lehnt strom vor jeder Anfrage ab, auch seinen Test. Eine frühere
  Erlaubnis „langsam“ bleibt gespeichert, aber Bilder gehen nicht mehr über den Downloader.
- **Gilt seit:** Forschung 1.27.0

<!-- zdroj: research:assets/archives.json mza.cz (restricted, browserOnly, pace 4000, disallow /scitacioperaty/) · CHANGELOG.cs.md 1.27.0 (Acta Publica) -->

<a id="R9.10.2"></a>
### R9.10.2 Zemský archiv v Opavě (digi.archives.cz)

- Archiv: nur von Hand, nur über den Browser eines Menschen. robots.txt schließt die ganze Website allen Robotern,
  und die Seiten schützt eine Prüfung, ob ein Mensch am Computer ist. Der Bildbetrachter nimmt seine Bilder vom
  Bildserver images.archives.cz, den robots.txt ebenfalls ganz schließt. Kein Downloader führt zum Archiv. Genauso
  steht es um den digitalen Lesesaal des SOA Litoměřice (digi.soalitomerice.cz, Bilder von images.soalitomerice.cz).
- Die Erlaubnis **über den Browser** lässt sich hier nicht geben: `strom allow archive digi.archives.cz --way
  browser` wird abgelehnt, die App bietet den Link **Erlaubnis…** nicht an, und `strom media save` speichert das
  Bild nicht. Der Browser des Agenten würde den geschlossenen Bildserver um jedes Bild bitten.
- Aufgabe: die Trauung von Marie Vlková. Der Agent setzt `strom task wait T… --images B…:12-13`.
- Der einzige Weg ist das Warten auf Bilder: Was wartet in der App zeigt die Aufgabe unter dem Namen des Archivs mit
  einem Ordner. Der Mensch öffnet das Buch in seinem Browser, speichert die Bilder 12 und 13 (`12.jpg`, `13.jpg`)
  über **Ordner öffnen** oder fügt sie über **Bilder hinzufügen** hinzu. Die Aufgabe kehrt zurück.
- **Gilt seit:** Forschung 1.27.0

<!-- zdroj: research:assets/archives.json digi.archives.cz, digi2.archives.cz, digi.soalitomerice.cz (manual, browserOnly, quoteFrom robots, imagesFrom images.archives.cz / images.soalitomerice.cz; commit 69902466) · src/core/terms.ts allows (browserOnly + manual) · src/commands/archives.ts:676-680 (manual/forbidden: no permission) · src/core/browserhelp.ts browserHelps, treeBrowserArchives (never by hand only) · test/cli/media-save.test.ts (digi.archives.cz) · CHANGELOG.cs.md 1.27.0 -->

<a id="R9.10.3"></a>
### R9.10.3 eBadatelna SOA Praha

- Archiv: nur von Hand, nur über den Browser eines Menschen; robots.txt sperrt KI-Werkzeuge namentlich.
- Die Aufgabe wartet immer auf Bilder, die der Mensch speichert. Eine Erlaubnis öffnet das nicht; weder der Browser
  des Agenten noch ein Webabruf darf dorthin.
- **Gilt seit:** Forschung 1.27.0

<!-- zdroj: research:assets/archives.json ebadatelna.soapraha.cz (manual, browserOnly, disallow /d/ /a/) · src/core/terms.ts allows (browserOnly + manual) -->

<a id="R9.10.4"></a>
### R9.10.4 Matricula

- Archiv: erlaubt (Bedingungen CC BY-NC-ND), der Bildserver ebenso. Die Liste der Archive verbietet einige Pfade
  (Suche, Blättern durch Seiten); sie bleiben geschlossen.
- Aufgabe: das Begräbnis von Marie Horáková in einer bayerischen Pfarrei. Der Downloader lädt nur die nötigen Bilder im
  Tempo des Dienstes, ohne Erlaubnis und ohne Warten. Ohne Downloader baut der Agent einen
  ([R8.2](R8-reading-scans.md#R8.2)).
- **Gilt seit:** Forschung 1.14.0

<!-- zdroj: research:assets/archives.json data.matricula-online.eu (allowed, disallow /*?pg=, /*/suchen), hosted-images.matricula-online.eu (allowed) -->

<a id="R9.10.5"></a>
### R9.10.5 Szukaj w Archiwach

- Archiv: eingeschränkt, nur über den Browser eines Menschen; die Website schützt ein Dienst gegen Roboter.
- Ohne Erlaubnis wartet die Aufgabe auf Bilder. Mit der Erlaubnis **über den Browser** und mit Claude + Chrome
  speichert der Agent sie selbst wie in [R9.10.1](#R9.10.1).
- **Gilt seit:** Forschung 1.27.0

<!-- zdroj: research:assets/archives.json szukajwarchiwach.gov.pl (restricted, browserOnly) -->

<a id="R9.10.6"></a>
### R9.10.6 DigiArchiv SOA Třeboň

- Archiv: nur von Hand, nur über den Browser eines Menschen. Bedingungen auf der Startseite des DigiArchivs (`/Uvod`):
  „Snímky jsou poskytnuty pouze za účelem on-line prohlížení v DigiArchivu SOA v Třeboni, jejich kopírování,
  distribuování, prodávání, využití v jiných projektech a na jiných stránkách je zakázáno.“ (Die Bilder werden nur
  zum Online-Ansehen im DigiArchiv des SOA in Třeboň bereitgestellt; ihr Kopieren, Verbreiten, Verkaufen und ihre
  Nutzung in anderen Projekten und auf anderen Seiten ist verboten.) Der Server lehnt die Anfragen von strom ab
  (403), nach dem Archiv absichtlich.
- Das Archiv hat bestätigt: der Mensch darf von Hand nur ausgewählte Bilder speichern, nie das ganze Buch oder einen
  wesentlichen Teil davon. Werkzeuge zum Herunterladen sind nicht erlaubt, auch nicht der Browser des Agenten.
- Aufgabe: der Eintrag von Marie Horáková in einer Matrik im DigiArchiv. Die Aufgabe wartet immer auf Bilder, die der
  Mensch auswählt und speichert. Eine Erlaubnis öffnet das nicht; weder der Downloader noch ein Webabruf noch der
  Browser des Agenten darf dorthin.
- Zitation: der dauerhafte Link auf ein Bild ist die Adresse seiner Seite `https://digi.ceskearchivy.cz/<kniha>/<snímek>`
  oder **Odkaz na snimek** (Link auf das Bild) im Panel **POPIS**.
- **Gilt seit:** Forschung 1.28.0

<!-- zdroj: research:assets/archives.json digi.ceskearchivy.cz (manual, browserOnly, terms https://digi.ceskearchivy.cz/Uvod, quote, robots 403, scope, checked 2026-11-05), www.ceskearchivy.cz (stejné terms/quote) · src/core/terms.ts allows (browserOnly + manual) · CHANGELOG.cs.md 1.28.0 · znalosti/archivy-cz.md „SOA v Třeboni (DigiArchiv)“ (odpověď archivu 5. 11. 2026) · commit 805b871d -->
