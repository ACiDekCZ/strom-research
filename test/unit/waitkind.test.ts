// What a waiting task waits for, where it is dealt with and how far it got (core/waitkind.ts), and the one detector of a
// text that addresses the person (core/impersonal.ts) — any script, any accent, decomposed input; a kind only where the
// words say one clearly, never a wrong one.

import { test } from "node:test";
import assert from "node:assert/strict";
import { officeIn, waitGroupOf, waitKindOf, waitPhaseOf } from "../../src/core/waitkind.ts";
import { addressesPerson } from "../../src/core/impersonal.ts";
import { humanTask } from "../../src/cli/human.ts";
import type { AnyRecord, Person, RecordSet, Repository, Task } from "../../src/core/model.ts";
import type { Tree } from "../../src/core/tree.ts";

const NOW = "2026-10-01T10:00:00.000Z";
const task = (t: Partial<Task>): Task => ({
  id: "T0001", type: "task", created: NOW, updated: NOW, level: "request", priority: 3, what: "Úkol", where: ["archiv"], why: "a", doneWhen: "b",
  subject: [], state: "waiting", origin: "user", notes: [], ...t,
});
const repo = (id: string, name: string, url?: string): Repository => ({ id, type: "repository", created: NOW, updated: NOW, name, automation: "allowed", notes: [], ...(url ? { url } : {}) });
const book = (id: string, title: string, repository?: string, url?: string): RecordSet =>
  ({ id, type: "recordset", created: NOW, updated: NOW, title, ...(repository ? { repository } : {}), ...(url ? { url } : {}) }) as RecordSet;

/** As much of a tree as the derivation reads: its records and its language. */
function fakeTree(records: AnyRecord[], lang = "cs"): Tree {
  return {
    lang,
    list: (type: string) => records.filter((r) => r.type === type),
    get: (id: string) => records.find((r) => r.id === id),
  } as unknown as Tree;
}

test("the kind: the agent's first, then what strom knows of the wait, then the words — only when they say one kind", () => {
  assert.equal(waitKindOf(task({ wait: { kind: "family" }, waitingOn: "Odpověď matriky" })), "family", "the agent's word wins");
  assert.equal(waitKindOf(task({ awaits: { recordset: "B0001", images: "40-45", folder: "x" }, waitingOn: "e-mail" })), "images");
  assert.equal(waitKindOf(task({ awaitsCheck: { url: "https://archive.example.org/b/1", ask: "a" } })), "check");
  assert.equal(waitKindOf(task({ awaitsPermission: { hosts: ["archive.example.org"], since: NOW } })), "permission");
  // Czech, with its accents and decomposed (NFD)
  for (const f of [(s: string) => s, (s: string) => s.normalize("NFD")]) {
    assert.equal(waitKindOf(task({ waitingOn: f("Odpověď matriky MěÚ Tábor na žádost z 21. 9.") })), "letter");
    assert.equal(waitKindOf(task({ waitingOn: f("Fotografie od příbuzných ze Žďáru") })), "family");
    assert.equal(waitKindOf(task({ waitingOn: f("Co zadavatel ví o pradědovi") })), "family");
    assert.equal(waitKindOf(task({ waitingOn: f("Ověří v badatelně SOA, zda je kniha digitalizována") })), "web", "looked up there; a bare archive's name is no letter");
    assert.equal(waitKindOf(task({ waitingOn: f("Ověří v katalogu, zda je kniha vidět") })), "web");
    assert.equal(waitKindOf(task({ waitingOn: f("Dotaz do archivu v Třeboni") })), "letter", "a request to an archive");
    assert.equal(waitKindOf(task({ waitingOn: f("Dotaz na pana faráře") })), "other", "a request, but to nobody it names");
  }
  // German and English
  assert.equal(waitKindOf(task({ waitingOn: "Antwort des Standesamts Wien auf die Anfrage vom 3. Mai" })), "letter");
  assert.equal(waitKindOf(task({ waitingOn: "Fotos der Verwandten aus Graz" })), "family");
  assert.equal(waitKindOf(task({ waitingOn: "Reply of the registry office of Lhota to the letter of 21 Sep" })), "letter");
  assert.equal(waitKindOf(task({ waitingOn: "What the family remembers of the farm" })), "family");
  assert.equal(waitKindOf(task({ waitingOn: "Whether the book is online at https://archive.example.org/b/5359" })), "web");
  // an e-mail to the family is a question to the family (a letter goes to an office); both at once: other, never a wrong kind
  assert.equal(waitKindOf(task({ waitingOn: "E-mail rodině Novákových" })), "family");
  assert.equal(waitKindOf(task({ waitingOn: "Dotaz rodiny na MěÚ Lhota" })), "other");
  // nothing said: the task's what; its waitingOn first when it says one
  assert.equal(waitKindOf(task({ what: "Vzpomínky rodiny na mlýn", waitingOn: "Odpověď" })), "family");
  assert.equal(waitKindOf(task({ what: "Křest Jana a jeho rodina", waitingOn: "Odpověď z matriky" })), "letter");
  // another script: no false match
  assert.equal(waitKindOf(task({ what: "Метрическая книга", waitingOn: "Ответ архива в Житомире о семье Шевчуков" })), "other");
  assert.equal(waitKindOf(task({ waitingOn: "Sestra Ludmila" })), "other", "no keyword inside a word (Ludmila: no 'mil', a 'rodina' needs its start)");
});

test("the kind by intent, not by bare nouns: the first clause decides, a fallback after it does not — NFD too", () => {
  for (const f of [(s: string) => s, (s: string) => s.normalize("NFD")]) {
    const k = (waitingOn: string) => waitKindOf(task({ waitingOn: f(waitingOn) }));
    // the family's answer first, a letter to an office only as a fallback later
    assert.equal(k("odpověď rodiny na dotaz notes/T0001-hroby.md (fotky hrobů v Lhotě, nebo že je nemají); záložně dotaz na OÚ Lhota v téže poznámce – posílá zadavatel"), "family");
    // a site's user looks something up: a digital reading room, a DigiArchiv, a catalogue — register books and archives named
    assert.equal(k("Uživatel v Digitální badatelně NA (badatelna.example.cz) ověří, zda Sbírka kronik (NAD 100) má svazek z roku 1890 – postup v notes/T0002.md"), "web");
    assert.equal(k("Prosím o vyhledání v DigiArchivu SOA Lhota (https://digi.example.cz, fara Ves): která matriční kniha obsahuje oddané z Vsi z let 1780–1784? Stačí mi poslat název a odkaz knihy."), "web");
    assert.equal(k("Uživatel v Digitální badatelně Národního archivu (example.org – po ověření, že nejste robot) vyhledá fond „Knihy purkrechtní“ a řekne, zda mají naskenované knihy; když ne, rozhodne, zda psát do archivu dotaz, nebo jet do badatelny"), "web");
    assert.equal(k("Prosím, přihlaste se na portál (zdarma) a v Katalogu (https://catalog.example.org/search) hledejte místo Ves; zda katalog uvádí nějaké evangelické matriky"), "web");
    // letters stay letters: a request and the office it goes to
    assert.equal(k("odpověď MěÚ Lhota na žádost o opis úmrtního zápisu (e-mail z 3. 10.)"), "letter");
    assert.equal(k("odpověď SOkA Lhota na dotaz notes/T0003-dotaz.md"), "letter");
    assert.equal(k("Napsat na matriční úřad ve Vsi o opis"), "letter");
    // a reading room is the archive's site, unless the person is to go there
    assert.equal(k("V badatelně archivu najít knihu oddaných pro Ves"), "web");
    assert.equal(k("Jet do badatelny archivu v Lhotě a opsat zápis"), "other");
    // a bare register book or archive: no letter
    assert.equal(k("Která matriční kniha obsahuje křty z Vsi"), "other");
    assert.equal(k("Matriky SOA Lhota"), "other");
    // none in the first clause: the whole text decides
    assert.equal(k("Snímky 12–14. Zda je kniha vidět na https://archive.example.org/b/1"), "web");
    // several in the first clause: other
    assert.equal(k("Dotaz rodiny na MěÚ Lhota; pak katalog"), "other");
  }
  // German and English
  assert.equal(waitKindOf(task({ waitingOn: "Standesamt Neustadt: Antwort auf die Anfrage vom 3. Mai" })), "letter");
  assert.equal(waitKindOf(task({ waitingOn: "Im Online-Katalog des Landesarchivs suchen, ob das Kirchenbuch digitalisiert ist; sonst eine Anfrage an das Landesarchiv" })), "web");
  assert.equal(waitKindOf(task({ waitingOn: "Antwort der Familie auf die Frage nach Fotos; sonst Brief an das Pfarramt" })), "family");
  assert.equal(waitKindOf(task({ waitingOn: "Search the catalog of the county archive for the parish books; if none, write to the archive" })), "web");
  assert.equal(waitKindOf(task({ waitingOn: "Reply from the registry office to the request of 3 May" })), "letter");
  assert.equal(waitKindOf(task({ waitingOn: "The parish registers of the county archive" })), "other", "a bare archive is no letter");
  // another script: other
  assert.equal(waitKindOf(task({ waitingOn: "Ответ архива на запрос; метрические книги онлайн?" })), "other");
});

test("the phase: sent once the request went out, else to do", () => {
  assert.equal(waitPhaseOf(task({})), "todo");
  assert.equal(waitPhaseOf(task({ sent: { at: NOW, by: "user" } })), "sent");
});

test("the group: the addressee, the family, the archive of its books or of its site, an office it names, a site, other", () => {
  const records: AnyRecord[] = [
    repo("R0001", "SOA Třeboň", "https://www.digi.example.cz/"),
    repo("R0002", "Archiv bez webu"),
    book("B0001", "Lhota 1", "R0001"),
    book("B0002", "Ves 2", "R0002", "https://katalog.example.org/kniha/2"),
    book("B0003", "Kniha bez archivu"),
  ];
  const tree = fakeTree(records);
  const g = (t: Partial<Task>) => waitGroupOf(tree, task(t), "cs");
  // the addressee: an office, or an archive of the research by its name
  assert.deepEqual(g({ wait: { kind: "letter", to: "Matrika Lhota" } }), { key: "to:matrika lhota", name: "Matrika Lhota", kind: "office" });
  assert.deepEqual(g({ wait: { to: "SOA Třeboň".normalize("NFD") } }), { key: "repo:R0001", name: "SOA Třeboň", kind: "archive" });
  // the family, in the research language
  assert.deepEqual(g({ waitingOn: "Vzpomínky rodiny" }), { key: "family", name: "Rodina", kind: "family" });
  assert.equal(waitGroupOf(tree, task({ wait: { kind: "family" } }), "de").name, "Familie");
  assert.equal(waitGroupOf(tree, task({ wait: { kind: "family" } }), "en").name, "Family");
  // the archive of the task's books: the images it waits for, else a book of its where
  assert.equal(g({ awaits: { recordset: "B0001", images: "1", folder: "x" } }).key, "repo:R0001");
  assert.equal(g({ where: ["B0002"], waitingOn: "Co v knize je" }).key, "repo:R0002");
  // the archive of its site: the repository's address (www. aside), a book's address
  assert.equal(g({ awaitsCheck: { url: "https://digi.example.cz/kniha/1", ask: "a" } }).key, "repo:R0001");
  assert.equal(g({ wait: { url: "https://katalog.example.org/jina" } }).key, "repo:R0002");
  assert.equal(g({ waitingOn: "Zda je kniha na https://www.digi.example.cz/x vidět" }).key, "repo:R0001");
  // a letter names its office before the books the task searched
  assert.deepEqual(g({ where: ["B0001"], waitingOn: "Odpověď MěÚ Kamenice nad Lipou na žádost" }), { key: "to:meu kamenice", name: "MěÚ Kamenice", kind: "office" });
  // a site no archive of the research has
  assert.deepEqual(g({ waitingOn: "Zda je kniha na https://jinde.example.net/a" }), { key: "host:jinde.example.net", name: "jinde.example.net", kind: "web" });
  assert.deepEqual(g({ awaitsPermission: { hosts: ["portal.example.net"], since: NOW, title: "Portál" } }), { key: "host:portal.example.net", name: "Portál", kind: "web" });
  // nothing: other, in the research language; a book without its archive is no archive
  assert.deepEqual(g({ where: ["B0003"], waitingOn: "Něco jiného" }), { key: "other", name: "Ostatní", kind: "other" });
  assert.equal(waitGroupOf(tree, task({}), "de").name, "Sonstiges");
});

test("an office named in a text: its word and one to three capitalized words, as found — NFD too, never inside a word", () => {
  assert.equal(officeIn("Odpověď MěÚ Tábor na dotaz"), "MěÚ Tábor");
  assert.equal(officeIn("Odpověď MěÚ Tábor na dotaz".normalize("NFD")), "MěÚ Tábor");
  assert.equal(officeIn("Antwort vom Standesamt Wien Innere Stadt Nord Süd"), "Standesamt Wien Innere Stadt");
  assert.equal(officeIn("Matriční úřad Žďár"), "Matriční úřad Žďár");
  assert.equal(officeIn("odpověď ze SOA v Třeboni"), undefined, "a lowercase word after it: no name");
  assert.equal(officeIn("KOSOA Praha"), undefined);
});

test("an office that is an archive of the research joins its group: SOA and SOkA written out, the institution and the place by its stem — exactly one, NFD too", () => {
  const tree = fakeTree([
    repo("R0001", "Státní oblastní archiv v Třeboni (DigiArchiv)", "https://digi.example.cz/"),
    repo("R0002", "Státní okresní archiv Kolín (SOA Praha)"),
    repo("R0003", "Státní okresní archiv Most"),
    repo("R0004", "Státní okresní archiv Mostek"),
  ]);
  const g = (t: Partial<Task>) => waitGroupOf(tree, task(t), "cs");
  for (const f of [(s: string) => s, (s: string) => s.normalize("NFD")]) {
    assert.deepEqual(g({ waitingOn: f("Odpověď SOA Třeboň na žádost o opis") }), { key: "repo:R0001", name: "Státní oblastní archiv v Třeboni (DigiArchiv)", kind: "archive" });
    assert.equal(g({ wait: { kind: "letter", to: f("SOkA Kolín") } }).key, "repo:R0002");
    assert.equal(g({ waitingOn: f("Odpověď ze Státní okresní archiv Kolín na dotaz") }).key, "repo:R0002", "the full form as written");
    assert.equal(g({ wait: { kind: "letter", to: f("Státní oblastní archiv v Třeboni") } }).key, "repo:R0001");
  }
  // the institution differs (a regional archive, not the district one in its parenthesis): the office stays
  assert.deepEqual(g({ wait: { kind: "letter", to: "SOA Litoměřice" } }), { key: "to:soa litomerice", name: "SOA Litoměřice", kind: "office" });
  // two archives of one stem: none of them, the office stays
  assert.equal(g({ wait: { kind: "letter", to: "SOkA Most" } }).key, "to:soka most");
  // another office of the same place is no archive
  assert.equal(g({ wait: { kind: "letter", to: "MěÚ Třeboň" } }).key, "to:meu trebon");
});

test("asking the person who ordered the research is the family; the bare word user is not; a special registry is an office", () => {
  for (const f of [(s: string) => s, (s: string) => s.normalize("NFD")]) {
    assert.equal(waitKindOf(task({ waitingOn: f("Zeptat se uživatele, zda zná číslo domu") })), "family");
    assert.equal(waitKindOf(task({ waitingOn: f("Uživatele se zeptat na matriku narození") })), "family", "whatever else the text names");
    assert.equal(waitKindOf(task({ waitingOn: f("Uživatel v Digitální badatelně musí být přihlášen") })), "web", "a site's user");
    assert.equal(waitKindOf(task({ waitingOn: f("Účet uživatele archivu") })), "other");
    assert.equal(officeIn(f("Odpověď Zvláštní matrika Brno na žádost")), "Zvláštní matrika Brno");
  }
  assert.equal(waitKindOf(task({ waitingOn: "Den Nutzer fragen, ob er Fotos hat" })), "family");
  assert.equal(waitKindOf(task({ waitingOn: "Ask the user whether the farm had a name" })), "family");
  assert.equal(waitKindOf(task({ waitingOn: "The user account of the archive" })), "other");
  assert.deepEqual(waitGroupOf(fakeTree([]), task({ waitingOn: "Zeptat se uživatele na fotografie" }), "cs"), { key: "family", name: "Rodina", kind: "family" });
  assert.deepEqual(waitGroupOf(fakeTree([]), task({ waitingOn: "Odpověď Zvláštní matrika Brno" }), "cs"), { key: "to:zvlastni matrika brno", name: "Zvláštní matrika Brno", kind: "office" });
});

test("a task's words as written: a person's ID after their name only bracketed, declined and decomposed too; elsewhere named", () => {
  const person = (id: string, given: string, surname: string): Person => ({ id, type: "person", created: NOW, updated: NOW, names: [{ given, surname }], sex: "M", facts: [], notes: [] }) as unknown as Person;
  const tree = fakeTree([person("P0208", "Václav", "Schaniel"), person("P0226", "Dorota", "Dvořáková"), person("P0300", "Иван", "Петров")]);
  const text = "Svatba Václava Schaniela P0208 a Doroty P0226 v Lhotě";
  assert.equal(humanTask(tree, text, "cs", { asWritten: true }), "Svatba Václava Schaniela [P0208] a Doroty [P0226] v Lhotě");
  assert.equal(humanTask(tree, text.normalize("NFD"), "cs", { asWritten: true }).normalize("NFC"), "Svatba Václava Schaniela [P0208] a Doroty [P0226] v Lhotě");
  assert.equal(humanTask(tree, "Svatba P0208 v Lhotě", "cs", { asWritten: true }), "Svatba Václav Schaniel [P0208] v Lhotě", "no name before it: named");
  assert.equal(humanTask(tree, "Křest Ивана P0300", "cs", { asWritten: true }), "Křest Ивана [P0300]", "another script");
  assert.equal(humanTask(tree, text, "cs"), "Svatba Václava Schaniela Václav Schaniel [P0208] a Doroty Dorota Dvořáková [P0226] v Lhotě", "elsewhere as before");
  // a person's ID in brackets after their name, as strom writes it: as it is in both — never the name twice
  const strom = "Rozebrat 1 soubor – Václav Schaniel [P0208], Dorota Dvořáková [P0226]";
  assert.equal(humanTask(tree, strom, "cs"), strom);
  assert.equal(humanTask(tree, strom, "cs", { asWritten: true }), strom);
  assert.equal(humanTask(tree, strom.normalize("NFD"), "cs").normalize("NFC"), strom, "decomposed");
  assert.equal(humanTask(tree, "Křest Иван Петров [P0300]", "cs"), "Křest Иван Петров [P0300]", "another script");
  assert.equal(humanTask(tree, "Rozebrat soubor [P0208]", "cs", { asWritten: true }), "Rozebrat soubor Václav Schaniel [P0208]", "no name before it: named once");
});

test("a text that addresses the person or speaks as the agent: clear cases in Czech, German, English — names and records never", () => {
  const says = (text: string, lang: string) => addressesPerson(text, lang);
  for (const f of [(s: string) => s, (s: string) => s.normalize("NFD")]) {
    assert.equal(says(f("Prosím o snímky 40–45"), "cs"), "Prosím");
    assert.equal(says(f("Stačí mi poslat odkaz"), "cs"), "mi");
    assert.equal(says(f("Čeká na vás odpověď"), "cs")?.normalize("NFC"), "vás");
    assert.equal(says(f("Přihlaste se na portál a uložte snímky"), "cs")?.normalize("NFC"), "Přihlaste");
    assert.equal(says(f("Musíte zjistit číslo knihy"), "cs")?.normalize("NFC"), "Musíte");
    assert.equal(says(f("Zkontrolujte, zda je kniha online"), "cs"), "Zkontrolujte");
    assert.equal(says(f("Snímky 40–45 křtů uložit z odkazu"), "cs"), undefined);
    assert.equal(says(f("Odpověď matriky na dotaz o křest dítěte hraběte Šternberka"), "cs"), undefined, "a child's, a count's: words of a record");
    assert.equal(says(f("Odpověď SOA na dotaz o Margarete a Grete Müllerové"), "cs"), undefined, "names");
    // the forms of váš listed whole: Vašek is a name, and so is Vaša after a given name inside a sentence
    for (const name of ["Vašek", "Vaška", "Vaškovi", "Vašková", "Vaškem", "VAŠEK", "Vašák", "Vašíček"]) assert.equal(says(f(`Zápis křtu Václava ${name} v Lhotě`), "cs"), undefined, name);
    assert.equal(says(f("Zápis křtu Václava Vaška, otec Vašek Vašák"), "cs"), undefined);
    assert.equal(says(f("Kmotři: Anna, žena rychtáře Matěje Vaši"), "cs"), undefined, "Vaša's genitive");
    assert.equal(says(f("Čeká na vás odpověď"), "cs")?.normalize("NFC"), "vás");
    assert.equal(says(f("Odpověď na váš dotaz"), "cs")?.normalize("NFC"), "váš");
    assert.equal(says(f("Snímky pro vaši žádost"), "cs")?.normalize("NFC"), "vaši");
    assert.equal(says(f("Čeká Vaši odpověď"), "cs")?.normalize("NFC"), "Vaši", "the polite capital: the first word is no name");
    assert.equal(says(f("Doklady z tvojí rodiny"), "cs")?.normalize("NFC"), "tvojí");
  }
  // a command refuses the same as the close of a session (clear) and the catalogs (thorough): names pass all of them
  for (const opts of [{ clear: true }, { thorough: true }]) assert.equal(addressesPerson("Zápis křtu Václava Vaška, Tvoříkova", "cs", opts), undefined);
  assert.equal(says("Taufe des Kindes, Dir. der Schule Josef Sieber", "de"), undefined, "Dir.: a director");
  assert.equal(says("Anfrage an Sieber und Ihrig in Wien", "de"), undefined, "surnames that begin like Sie, Ihr");
  assert.equal(says("Die Antwort schicke ich dir", "de"), "dir");
  assert.equal(says("Antwort an dich", "de"), "dich");
  assert.equal(says("Baptism of Mary Youngs, daughter of Yourke", "en"), undefined);
  assert.equal(says("Bitte die Antwort des Standesamts senden", "de"), "Bitte");
  assert.equal(says("Antwort, wenn Sie sie haben", "de"), "Sie");
  assert.equal(says("Ich bestimme die Bilder dann selbst", "de"), "Ich");
  assert.equal(says("Ihre Taufe im Standesamt Wien", "de"), undefined, "at a sentence's start: her baptism");
  assert.equal(says("Please send the images", "en"), "Please");
  assert.equal(says("The images, once you have them", "en"), "you");
  assert.equal(says("I will then pick the images", "en"), "I will");
  assert.equal(says("Reply of the registry office to the request of 21 Sep", "en"), undefined);
  // English addressing in any research; another language's first person only in its own ("my" is Czech "we")
  assert.equal(says("Odpověď, until you send it", "cs"), "you");
  assert.equal(says("Ответ архива о семье Шевчуков, ты", "ru"), undefined, "no catalog of the language: only English");
  assert.equal(says("Ответ архива в Житомире", "cs"), undefined);
});

test("the office it waits on: the first one its waitingOn names wins over one its what names; a city's magistrate in any case — NFD too", () => {
  const tree = fakeTree([repo("R0001", "SOA Třeboň", "https://digi.example.cz/")]);
  const g = (t: Partial<Task>) => waitGroupOf(tree, task(t), "cs");
  for (const f of [(s: string) => s, (s: string) => s.normalize("NFD")]) {
    assert.equal(officeIn(f("Odpověď matriky Magistrátu Lhota (úmrtní zápis)")), "Magistrátu Lhota");
    assert.equal(officeIn(f("Dotaz na Magistrát města Lhoty")), "Magistrát města Lhoty");
    assert.equal(officeIn(f("odpověď magistrátu statutárního města Lhota")), "magistrátu statutárního města Lhota");
    assert.deepEqual(
      g({ waitingOn: f("Odpověď matriky Magistrátu Lhota (úmrtní zápis z roku 1931)"), what: f("Úmrtí Jana; dříve dotaz na MěÚ Ves") }),
      { key: "to:magistratu lhota", name: "Magistrátu Lhota", kind: "office" },
    );
    // the waitingOn names none: the office of its what
    assert.equal(g({ waitingOn: f("Odpověď na žádost o opis"), what: f("Dotaz na MěÚ Ves") }).key, "to:meu ves");
  }
  assert.equal(waitKindOf(task({ waitingOn: "Odpověď magistrátu na žádost" })), "letter", "a magistrate is an office");
  assert.equal(officeIn("Magistrátní budova"), undefined, "no capitalized place after it");
});

test("a host written without its scheme: a site's address, never a file, an e-mail or a part of a word — a web task's site before its books' archive", () => {
  const records: AnyRecord[] = [
    repo("R0001", "SOA Třeboň", "https://www.digi.example.cz/"),
    repo("R0002", "Národní archiv", "https://badatelna.example.org/"),
    book("B0001", "Lhota 1", "R0001"),
  ];
  const tree = fakeTree(records);
  const g = (t: Partial<Task>) => waitGroupOf(tree, task(t), "cs");
  for (const f of [(s: string) => s, (s: string) => s.normalize("NFD")]) {
    // the repository whose address has that host, without the scheme too
    assert.equal(g({ waitingOn: f("Ověřit v badatelně badatelna.example.org, zda je kniha vidět") }).key, "repo:R0002");
    assert.equal(g({ waitingOn: f("Zda je snímek na www.digi.example.cz/kniha/7 čitelný") }).key, "repo:R0001");
    // a web task: the site it names wins over the archive of its books — another institution's site is its own group
    assert.deepEqual(g({ where: ["B0001"], waitingOn: f("Ověřit v katalogu archiv.katastr.example.cz, zda je mapa vidět") }), { key: "host:archiv.katastr.example.cz", name: "archiv.katastr.example.cz", kind: "web" });
    assert.equal(g({ where: ["B0001"], waitingOn: f("Ověřit v badatelně https://badatelna.example.org/a, zda je kniha vidět") }).key, "repo:R0002");
    // a web task naming no site: its books' archive as before
    assert.equal(g({ where: ["B0001"], waitingOn: f("Ověřit v katalogu, zda je kniha vidět") }).key, "repo:R0001");
  }
  // not a host: a file, an e-mail's host, a part of a word or of a longer address, a date
  assert.equal(g({ waitingOn: "Ověřit v katalogu snímek scan_0042.jpg" }).key, "other");
  assert.equal(g({ waitingOn: "Odpověď na e-mail matrika@obec.example.cz" }).key, "other");
  assert.equal(g({ waitingOn: "Ověřit v katalogu, zda je zápis z 3.10.1880" }).key, "other");
  assert.equal(g({ waitingOn: "Ověřit v katalogu Žďár.cz" }).key, "other", "no host after a letter of a word");
});
