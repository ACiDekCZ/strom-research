# Building the connector for __TITLE__

You (the agent) build a connector for __URL__ together with the user. Work in
this folder only. The contract (interface 1) is `../README.md`: read it first.
strom runs the connector; you never run it yourself, you test it with
`strom connector test`. Talk to the user in their language.

## 1. What does the portal allow? (before any code)

- **Terms of use** (Nutzungsbedingungen, podmínky užití, regulamin, conditions
  d'utilisation, a reading-room rule …): find them, quote the sentences about
  automated or bulk download, copying and reuse, and note the URL.
- **robots.txt** of each host: what is disallowed, and any crawl-delay.
- **Official ways to get the images**: a download of a whole volume (ZIP or
  PDF), IIIF manifests, an API, a published list of books. Prefer them: they
  are what the archive wants people to use.
- Write what you found into `connector.json` → `policy`:
  - `terms` (the URL), `termsSummary` (one to three sentences, quoted where it
    matters), `robots`, `officialExport`.
  - `automation`, one of:
    - `"allowed"`: the terms allow it or say nothing against it, and nothing
      is got round.
    - `"manual"`: the terms forbid automated or bulk download. The connector
      only finds books and gives their links (`"can": ["find", "list"]`), and
      the user downloads by hand into the inbox.
    - `"unknown"`: you could not find out. Say so; the user decides.
  - `pace`: the service's own, when it states one — slower when the terms
    or robots.txt ask for it (`{"minIntervalMs": 5000}` for a crawl-delay of
    5), faster when its documentation allows it (an API, an image server:
    `{"minIntervalMs": 500, "source": "<where it says so>"}`), its hourly cap
    when it has one (`"perHour"`). Never make one up: without it strom keeps
    its own pause and follows what the server answers.
- **Never get round a technical measure**: logins you do not have, captchas,
  or tokens meant to stop scripts. Tiles are how many viewers show big images;
  they are a measure against downloading only when the terms or the portal
  say so — then stop and tell the user.
- **A bot check** (strom's probe says so: Imperva, Cloudflare — a page that
  only runs a script): the portal answers a real browser only. Then the whole
  connector goes through the user's browser: `"routes": ["browser"]` and
  `"browser": {"pages": true}` (the contract, section 5), then
  `strom connector use __NAME__ --via browser`. Browser tools come with your
  next session; probes then go through the browser too. The user passes the
  check in their own browser — never you. In the browser, look at the portal
  as a person does, a page at a time; what you would script (a list of
  addresses, a search to repeat) goes through `strom connector probe`, which
  strom paces — not through fetch() in the tab.
- Tell the user what you found **before** you write code.

Read the portal with your web tools (pages, not images). Never download images
yourself. Once the hosts are in `connector.json`, read the portal through strom
as well: see step 2.

## 2. Map the portal

- **Finding books** → `find`: how to find the books of a place (a catalogue
  search, a parish tree, an API). A search form is fine: send it with `post()`.
- **One book** → `list` and `fetch`:
  - how a book is identified (usually an ID in its URL);
  - how many images it has;
  - what the address of one image looks like.
- **The best address of an image**, in this order:
  1. the portal's own link to the full image, or a whole-volume download;
  2. a IIIF image: one request per image. Compare `info.json` (the original
     size) with what `full/max` gives: some servers cap it.
     Then the largest one request can give is the right choice. Do not ask
     for hundreds of tiles.
  3. tiles (DeepZoom, Zoomify, IIIF tiles), only when nothing else exists and
     the terms allow it. Save the tiles and give them to strom with
     `imageFromTiles()`: strom puts them together. For `fetch` take the level
     nearest 2000 px on the longer side (what a viewer shows of a page); for
     `part` the tiles of that region at full size. Say in `README.md` how many
     requests one image and one part cost.
  Whatever the address, check what it gives: strom answers each saved image
  with its `width` and `height`. A thumbnail or a stand-in (a tiny picture in
  place of an image the portal will not give) is not a scan — some portals
  answer so for some images only: find where the full image is then (another
  address, tiles, a whole-volume download).
- **A part of an image, sharper** → `part`: when the whole image comes smaller
  than the original, find whether one request can give a part of it at more
  detail (IIIF: a region of the original, `x,y,w,h` or `pct:x,y,w,h`; a
  viewer's zoomed-in link). Then add `"part"` to `can`: a reader asks for the
  entry it cannot read, one request, instead of the whole image in tiles.
- **An account**: when the portal gives more to users who log in (full-size
  images, a subscription), the connector may use the user's own account.
  Never ask the user for it and never type it in: declare `login` in
  `connector.json` (see the contract), and the user saves it in their own
  terminal (`strom login __NAME__`). Map the login form without logging in.
- **The user's own browser** → `routes` and `locate`: when the portal gives
  its images only to a browser (a login with a second factor, a session a
  script cannot start), or the user wants them through theirs. Add
  `"browser"` to `routes` (alone, when direct cannot work) and `"locate"` to
  `can`, and answer `locate` with the addresses `fetch` would ask for,
  downloading nothing. `browser.open`: the page where the user logs in, on the
  images' site. You never log in in the browser: the user does.
- **Pages built by JavaScript** (a catalogue or a viewer that is an
  application) show your web tools almost nothing. Read them through strom:
  `strom connector probe __NAME__ <url>` makes one request, paced and within
  `hosts`, and saves the answer into `.test/probe/`. Fetch the page, find the
  script it loads (`<script src=…>`), probe that too, and search it for the
  addresses the application calls (`/api/`, `.json`, image or file addresses):
  `strom connector grep __NAME__ <text>` shows each hit with the text round it
  (`--regex` for a pattern). Pages and scripts are often too big to read whole.
  Then probe those addresses to see what they answer. A POST works too:
  `--method POST --body '…' --header "Content-Type: application/json"`.
  Probes keep the cookies servers set, like one visit in a browser: probe the
  page that starts a session, then the search or the viewer (`--fresh` starts
  a new visit). Each probe is one request: keep them few, a dozen or two for
  a whole portal.
- **What the portal needs from a client**: a session (strom keeps its
  cookies), a `Referer`, an `X-Requested-With` for its own scripts. Send
  exactly what its pages send, nothing more.
- Write the mapping into `README.md`, with URLs and placeholders. Whoever
  keeps the connector working later starts there.

## 3. Write the connector

- Write `connector.ts` with the SDK (`sdk.ts`; do not change it):
  - `get(url)` for pages and `post(url, {field: value})` for forms;
  - `get(url, { save: "s0040.jpg", headers: { Referer: … } })` for images,
    then `image(n, file, url)`;
  - `book({...})` for what `find` and `list` found;
  - for `part`: one `image(n, file, url)` for the part of image `n`;
  - tiles only: `imageFromTiles(n, file, tiles, { width, height }, url)`;
  - for `locate`: `located(n, src, url)` for each image — `src` the image's
    own address, nothing fetched;
  - with a login: `post(url, { name: login("user"), pass: login("password") })`,
    only when `req.login` is true — strom puts the values in;
  - `log()`, and `done()` at the end.
- **Never** use `fetch()`, http or net modules, child_process or curl. strom
  checks the code and warns the user that it cannot pace or stop such
  requests.
- Put in `hosts` of `connector.json` only the hosts the connector needs.
- Name the files by image number (`s0040.jpg`), fetch only the images asked
  for, in order.

## 4. Test with a few requests

    strom connector test __NAME__ --find "<place>" --years 1780-1850
    strom connector test __NAME__ --list <book>
    strom connector test __NAME__ --fetch <book> --images 1-2
    strom connector test __NAME__ --fetch <book> --images 2 --crop 0.5,0,0.5,0.5   (with part)
    strom connector test __NAME__ --locate <book> --images 1-2                     (with locate)

- Run each `strom` command on its own, not in a pipe or after `;`: your
  permissions allow `strom …` and nothing around it.
- A test makes at most 10 requests (`--max 50` at most, for an image in
  tiles). Its files go to `.test/` in this folder.
- strom shows each image's size (width × height). It should be the right page
  and full size, not a thumbnail. Check that the number of images of a book
  matches the portal.
- If strom answers with exit code 4 (consent required), stop and tell the
  user: they give it in their own terminal after reading the warning
  (`strom allow connector __NAME__`). You never do that.

## 5. Hand over

Show the user:
- what the terms say (the policy);
- what the connector can do;
- the test results, with how many requests one image costs.

They decide whether to use it. From then on, `strom fetch __NAME__ …`
downloads through strom's limiter and registers what it fetched.
