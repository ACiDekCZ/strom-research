# Connectors — interface 1

A connector downloads from one archive portal: it finds the books (registers)
that cover a place, describes a book, and fetches its images. strom runs it.
The connector never reaches the network, other programs or files outside its
work folder by itself: it asks strom, which paces every request, keeps to the
connector's hosts, writes the files and checks that an image is an image.

This page is the whole contract. It is **version 1 and it does not change**:
a connector written for it keeps working. It only grows — optional fields,
new capabilities, new routes:
- an older strom leaves out what it does not know yet (`strom connector show`
  says so) and runs the rest;
- a different contract would get a new number, and strom would still run
  version 1. A connector written for a newer version than strom runs asks for
  `strom update`.

## The folder

    connectors/<name>/        the folder's name is the connector's name:
                              lowercase letters a–z, digits and dashes
      connector.json          the manifest (below)
      connector.ts            the program (any language; TypeScript is the usual one)
      sdk.ts                  the SDK for TypeScript (strom connector new copies it in)
      README.md               how the portal is mapped, for whoever keeps it working

**Install** = copy the folder here. **Remove** = delete it. `strom connector new
<name> --url <portal>` starts one with everything in place. Folders whose name
starts with `.` or `_` are ignored (`_old-version/`).

## connector.json

    {
      "interface": 1,
      "title": "Example State Archive — digital reading room",
      "run": ["node", "connector.ts"],
      "hosts": ["digi.example.org", "iiif.example.org"],
      "can": ["find", "list", "fetch", "part", "locate"],
      "routes": ["direct", "browser"],
      "policy": {
        "automation": "allowed",
        "terms": "https://digi.example.org/terms",
        "termsSummary": "Images may be downloaded for private research …",
        "robots": "Crawl-delay: 5",
        "officialExport": "IIIF manifests for every book",
        "pace": { "minIntervalMs": 5000 }
      },
      "login": {
        "about": "An account of the portal: its members see the scans at full size",
        "url": "https://digi.example.org/register",
        "fields": { "user": "User name or e-mail", "password": "Password" }
      }
    }

- `interface`: `1`.
- `title`: the archive or portal, as people call it.
- `run`: the program and its arguments, started in the connector's folder.
  `"node"` is the Node that runs strom (it runs TypeScript as it is).
- `hosts`: every host it contacts. `"example.org"` includes its subdomains.
  strom refuses requests anywhere else, and each host needs the user's consent.
- `can`: what it does: any of `find`, `list`, `fetch`, `part`, `locate`.
- `routes` (optional): how its images may come, the usual one first:
  - `direct`: strom fetches them (`fetch`, `part`). The default: `["direct"]`.
  - `browser`: the user's own browser fetches them (section 5). It needs
    `locate` in `can`. `["browser"]` alone: only through the browser — for a
    portal that lets in only a browser, such as a login with a second factor.

  The user chooses which one is used (`strom connector use <name> --via
  browser`), and can switch back.
- `browser` (optional):
  - `open`: the page a tab opens first when the browser fetches — where the
    user logs in to the portal. It must be on the images' site. Without it,
    the tab opens a light page of that site.
  - `pages`: `true` for a portal that answers a real browser only (a bot check
    such as Imperva or Cloudflare): every request of the connector goes through
    the user's browser (section 5). It needs `"routes": ["browser"]` alone and
    no `login`: the user logs in in their own browser.
- `policy`: what the portal allows, found out before the connector was written.
  - `automation`: one of
    - `allowed`: the terms allow it or say nothing against it;
    - `manual`: the terms forbid automated download. strom fetches no images
      through it, but it may still find books and give their links;
    - `unknown`.
  - `terms` (a URL), `termsSummary`, `robots` and `officialExport`: shown to
    the user when they decide.
  - `pace` (optional): the service's own pace, where it states one — its
    terms, robots.txt (a crawl-delay), the documentation of its API or
    image server. Nothing made up: without it strom keeps its default.
    - `minIntervalMs`: time between two requests to a host. The default is
      2000; less only with `source`, and never below 250.
    - `perHour`: requests to a host in an hour, where the service has such a
      cap. The default is none.
    - `source`: where the service says so (a URL, or a sentence).

    The user may set their own pace for a host
    (`strom allow host <host> --pace <seconds> --per-hour <n>`); it comes
    first.
- `login` (optional): the portal gives more to users who log in, and the
  connector can use the user's own account.
  - `about`: what an account gives, in a sentence the user reads.
  - `url` (optional): where to get an account.
  - `fields`: what the user types in, each with its question. A field named
    `user` or `email` is typed in the open; every other one (a password, a
    key) is hidden, and kept out of the answers the connector reads.
  - `required` (optional): `true` when it cannot work without one.

  The user saves their login in their own terminal (`strom login <name>`),
  never an agent. It stays on their computer. See section 4.
- `version` (optional): the connector's own version.

## The conversation

strom starts the program and talks to it in JSON lines: one JSON object per
line, on its standard input and output (UTF-8). Standard error is the
program's own; its last lines are shown when it fails.

### 1. What strom asks: the first line on stdin

    {"interface":1,"cmd":"find","place":"Dolní Lhota","years":"1780-1850"}
    {"interface":1,"cmd":"list","book":"4711"}
    {"interface":1,"cmd":"fetch","book":"4711","images":[40,41,42]}
    {"interface":1,"cmd":"part","book":"4711","image":40,"region":{"x":0.5,"y":0.25,"w":0.5,"h":0.4}}
    {"interface":1,"cmd":"locate","book":"4711","images":[40,41]}

- `find`: the books that cover a place. `years` ("from-to") is optional.
- `list`: one book: its title and how many images it has.
- `fetch`: these images of the book, in this order. Images are numbered as
  the portal counts them, from 1.
- `part`: a part of one image, as sharp as the portal gives it — asked for
  when the whole image is too small to read an entry. `region` is where the
  part is in the whole image, in fractions of it (0–1) from its top left
  corner. Answer with one `image` line.
- `locate`: where these images are, for the user's browser to fetch them
  (section 5). Download nothing: answer with a `located` line for each. With
  `region`, where that part of the one image is.
- `book` is the connector's own ID of a book: whatever it gave as `id` in
  `find`.
- `login`: `true` when the user saved a login for this connector. The values
  are not in it: see section 4.

### 2. What the connector says: lines on stdout

    {"id":1,"http":{"url":"https://digi.example.org/book/4711"}}
    {"book":{"id":"4711","title":"Dolní Lhota N 1784–1820","callNumber":"17","years":"1784-1820","kinds":["baptism"],"places":["Dolní Lhota"],"url":"https://digi.example.org/book/4711","images":109}}
    {"image":{"n":40,"file":"s0040.jpg","url":"https://digi.example.org/book/4711/40","page":"fol. 19v"}}
    {"located":{"n":40,"src":"https://iiif.example.org/4711/40/full/max/0/default.jpg","url":"https://digi.example.org/book/4711/40"}}
    {"log":"reading the catalogue"}
    {"error":"book 4711 has no images online"}
    {"done":true}

- `http`: a request (section 3).
- `book`: one for every book found (`find`), or the book described (`list`).
  Only `title` is required; give everything else the portal says. `kinds`
  holds baptism, marriage, burial, index and so on.
- `image`: one image fetched.
  - `n`: its number in the book.
  - `file`: the name it was saved under (the `save` of its request).
  - `url`: where it is on the portal: the page a person would open, or the
    image's own address.
  - `page` (optional): a folio or page label.
  - `region` (`part` only, optional): the part it got, when the portal cut it
    differently from the part asked for.
  - `tiles`, `width`, `height` (optional): the portal gives the image in tiles
    only (Zoomify, DeepZoom, IIIF tiles). Save each tile with `save` and list
    them: `"tiles":[{"file":"t40-0-0.jpg","x":0,"y":0},…]`, where `x`, `y` is
    the tile's top left corner in pixels of the image, and `width` × `height`
    its size. strom puts them together into `file` (a JPEG) and removes the
    tiles. Tiles may overlap; a gap — a tile left out — ends the run. For a
    part, the tiles make the part, and `region` says where it is.

      {"image":{"n":40,"file":"s0040.jpg","tiles":[{"file":"t40-0-0.jpg","x":0,"y":0},{"file":"t40-1-0.jpg","x":540,"y":0}],"width":1080,"height":540,"url":"https://digi.example.org/book/4711/40"}}

  strom checks that the file is an image and not cut short, and that it is not
  a stand-in: an image smaller than 400 px on its longer side (a part: 64 px) is
  a placeholder or a thumbnail, and so is the same file as another image of the
  run. If it is one of these, the run ends.
- `located` (`locate` only): where one image is.
  - `n`: its number in the book.
  - `src`: the image's own address, on one of `hosts` — the one request that
    gives the image, as `fetch` would ask for it.
  - `url`: the page a person would open (kept with the image).
  - `page`, `region`: as in `image`.
- `log`: a line for the user.
- `error`: the connector cannot go on. The run ends.
- `done`: finished. strom closes the connector's stdin once every request is
  answered, and the program then exits.

A line that is not JSON counts as a log line.

### 3. Requests: the only way to the network

    {"id":1,"http":{"url":"https://digi.example.org/book/4711"}}
    {"id":2,"http":{"url":"https://iiif.example.org/4711/40/full/max/0/default.jpg","save":"s0040.jpg","headers":{"Referer":"https://digi.example.org/"}}}
    {"id":3,"http":{"url":"https://digi.example.org/search","method":"POST","body":"place=Doln%C3%AD+Lhota","headers":{"Content-Type":"application/x-www-form-urlencoded"}}}
    {"id":4,"http":{"url":"https://digi.example.org/search","form":{"place":"Dolní Lhota"}}}

- `id`: a number the connector chooses. The answer carries it back.
- `url`: http or https, on one of `hosts`.
- `method`: `GET` (the default), `POST` or `HEAD`.
- `body`: a string, sent with a POST.
- `form` (instead of `body`): the fields of a form, as an object. strom
  sends them with POST, as `application/x-www-form-urlencoded`.
- `headers`: request headers such as Referer, Accept, Content-Type,
  X-Requested-With or a Cookie of its own. strom sets `User-Agent` itself:
  who is asking is not the connector's to change.
- `save`: a file name. strom writes the answer's body into the work folder
  under this name; use it for images and anything big. Without `save`, the
  body comes back as text (at most 5 MB).

strom follows redirects itself, and each target must be on `hosts`. It keeps
the cookies that servers set during a run and sends them back, as a browser
does: a session, or the result of a form. Every run starts without cookies.

The answer is one line on stdin:

    {"id":1,"status":200,"type":"text/html; charset=utf-8","headers":{"content-type":"text/html; charset=utf-8"},"url":"https://digi.example.org/book/4711","text":"<html>…"}
    {"id":2,"status":200,"type":"image/jpeg","headers":{"content-type":"image/jpeg"},"url":"https://iiif.example.org/4711/40/full/max/0/default.jpg","file":"/…/s0040.jpg","bytes":1843221,"width":4200,"height":3100}
    {"id":3,"error":"refused","message":"digi.example.org answered 403 — …"}

- `status`: the HTTP status. A 404 is an answer, not an error.
- `url`: the final address, after redirects.
- `headers`: the answer's headers, in lowercase.
- `width`, `height`: of an image saved with `save` (JPEG or PNG), read from
  its header. A thumbnail or a placeholder shows here before the connector
  gives it as the image: it can ask elsewhere instead.
- `error`: strom got no answer, or will not ask. After an error the run ends,
  and strom stops the connector. The errors are:
  - `host`: the host is not on the list;
  - `refused`: the archive said no (401 or 403), or asked twice to slow down
    (429);
  - `blocked`: the archive refused earlier and is left alone for now;
  - `cap`: the hourly cap of the service (or the user's) is reached, or the
    server says its limit is used up for longer than strom waits;
  - `silent`: no answer. The server is down, or it blocks this IP;
  - `http`: the server keeps failing, or the request is not valid;
  - `too-big`: text over 5 MB (ask with `save`);
  - `login`: a request with a login value (section 4) that strom will not send.

strom answers requests one at a time, in order, and paces them:
- at the service's pace for each host (the connector's `pace`), else at
  least 2 s apart; an hourly cap only where the service or the user sets one;
- longer apart while a host answers slowly (the pause is at least as long as
  its answers take, counted from the answer);
- shared by everything on this computer;
- it waits by itself when an archive asks it to (Retry-After), or says its
  limit is used up (RateLimit headers).

### 4. The user's login

A value of a `form` field or of a header may be the user's login instead of
text: `{"login":"<field>"}`, a field of `login.fields` in `connector.json`.

    {"id":5,"http":{"url":"https://digi.example.org/login","form":{"name":{"login":"user"},"pass":{"login":"password"},"token":"a41f"}}}
    {"id":6,"http":{"url":"https://api.example.org/scan/40","save":"s0040.jpg","headers":{"X-Api-Key":{"login":"key"}}}}

- strom puts in what the user saved. The connector never sees it.
- It goes only over https, and only to the hosts the login was saved for.
  It does not follow a redirect to another address.
- The hidden values (every field but `user` and `email`) are taken out of
  every answer the connector reads, written as `[login]`.
- The session a login starts lives in the cookies of the run: every run logs
  in again.
- Without a saved login, such a request is refused (`login`). Use it only when
  the first line says `"login":true`.

A login the user does not have is a technical measure: never get round it.

### 5. Through the user's browser

With the route `browser`, the images come through the user's own browser,
where their login to the portal lives. strom never runs a browser; the user's
agent does, with its browser tools. For `strom fetch`:

1. strom asks the connector to `locate` the images. Its pages still go
   through strom, paced, as in any run.
2. strom's limiter reserves a time for each request of the browser, in the
   state every strom process shares.
3. The agent opens a tab on the images' site (`browser.open`) and runs a
   script strom gives it. The script fetches each `src` at its time and saves
   it into the browser's downloads folder under a name strom chose.
4. `strom fetch <name> --take` takes the files over: checked like any
   download, registered with where they came from. When the archive refused
   the browser, strom leaves it alone as if it had refused strom.

So `src` must be on the same site as the page the tab opens, or allow that
page to fetch it. The browser sends the user's cookies of that site: their
login counts. The connector itself stays as it is: it never sees the browser,
and the browser never runs its code.

**Pages through the browser** (`browser.pages`): a portal behind a bot check
answers strom with the check, never with its pages. Then every request of the
connector — the search, a book's page, what `locate` reads — is made by the
user's browser too:

1. strom runs the connector. A request it has no page for ends the run, and
   strom plans it: a time in the limiter, a script for the tab.
2. The script asks for the page in the tab and saves it into the downloads
   folder. `strom fetch <name> --take` takes it over and runs the same command
   again: the connector gets the pages the browser got, in order, and goes on
   until it needs the next one. The pages are kept a day.
3. The check whether a person is there is passed by the user in their own
   browser — never by strom, the agent or the connector. When the site gives
   its check instead of a page, strom does not take it and says so.

The connector is written as any other: `get()` and `post()`, one after the
other. Only the headers a page's own script may send reach the portal (Accept,
Content-Type, X-Requested-With; a Referer becomes the tab's referrer); the
browser sends its cookies and its own user agent.

## Where it may write

The environment variable `STROM_CONNECTOR_WORKDIR` names the work folder.
- Files saved with `save` are there.
- The connector may write there itself. Tiles are put together by strom
  (`tiles` of `image`).
- `image.file` names a file in it.

The environment holds nothing else of the user's shell. A Node connector runs
under Node's permission model:
- it may read its own folder and the work folder;
- it may write only into the work folder;
- it may start no other programs.

## Rules

- **Never reach the network yourself.** Do not use `fetch()`, http or net
  modules, `requests`, `urllib`, `socket`, curl or other programs. strom
  checks the code and warns the user. A connector that does this needs the
  user's consent again after every change.
- **Prefer what the archive offers**: a download of a whole book, IIIF, an
  API. Where the portal allows it, make one request per image (a full-size
  IIIF image, the image's own link) rather than hundreds of tiles.
- **Tiles only**: fetch the whole image at the level nearest 2000 px on its
  longer side (what a viewer shows of a page), and for `part` the tiles of
  that region at full size — tens of requests, not hundreds.
- **Never get round a technical measure**: logins you do not have, captchas,
  or tokens meant to stop scripts. A check that a person is there (a captcha,
  a bot check) is passed by the user in their own browser, never by code; after
  it, the requests go at a person's pace through that browser
  (`browser.pages`), only for what the research needs.
- **Fetch only what was asked for**, in order.

## The SDK (TypeScript)

`sdk.ts` does the conversation:

    import { request, get, post, login, book, image, located, log, done, fail } from "./sdk.ts";

    const req = await request();                 // {cmd:"find",place,years?} · {cmd:"list",book} · {cmd:"fetch",book,images} · {cmd:"part",book,image,region} · {cmd:"locate",book,images,region?}
    const page = await get(url);                 // {status, text, type, headers, url}
    const img = await get(url, { save: "s0040.jpg", headers: { Referer: "https://digi.example.org/" } });   // {status, file, bytes, …}
    const hits = await post(url, { place: "Dolní Lhota" });   // a form, sent as application/x-www-form-urlencoded
    if (req.login) await post(loginUrl, { name: login("user"), pass: login("password") });   // strom puts the user's login in
    book({ id: "4711", title: "…", images: 109 });
    image(40, "s0040.jpg", url);                 // for part too: the image it is a part of
    imageFromTiles(40, "s0040.jpg", [{ file: "t40-0-0.jpg", x: 0, y: 0 }, …], { width: 2158, height: 1616 }, url);   // tiles only: strom puts them together
    located(40, src, pageUrl);                   // locate: where image 40 is, nothing downloaded
    log("…");
    done();

When strom refuses a request, the run is over: strom stops the connector.

The newest `sdk.ts` is next to this file. A connector written with an older
one copies it over its own to use what came later (`imageFromTiles`, the
`width` and `height` of a saved image).

## Testing and consent

    strom connector test <name> --find "<place>"
    strom connector test <name> --list <book>
    strom connector test <name> --fetch <book> --images 1-2
    strom connector test <name> --fetch <book> --images 2 --crop 0.5,0,0.5,0.5    (part)
    strom connector test <name> --locate <book> --images 1-2                     (locate)

A test makes at most 10 requests (`--max`: up to 50, for an image in tiles);
its files go to `<name>/.test/`, and strom shows each image's size. While you
map a portal, `strom connector probe <name> <url>` makes one request through
strom and saves the answer in `<name>/.test/probe/`, to read: this is how the
pages and scripts of a JavaScript application are read. Probes keep the cookies
servers set, as one visit in a browser does (`--fresh` starts without them).
`strom connector grep <name> <text>` searches what was saved and shows each hit
with the text round it.

A connector runs as soon as it is in the folder. Two things need the user's
consent, given in their own terminal (`strom allow connector <name>`, or when
they run a test or a fetch themselves, where strom asks right away):
- code that reaches the network itself, past strom: always, and again after
  every change of it;
- every connector and each of its hosts, when the user asked to be asked first
  (`strom config set connectors.consent on`).

When a consent is missing, strom answers with exit code 4 and the command for
the user. An agent never gives it.
