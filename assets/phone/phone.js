// The phone's page (strom phone): the trees of the research on the computer, photos taken or picked sent into one of
// them as a batch (the same as "Add materials" in the Strom app), with a note and a person. No library and no secure
// context (http:// of the computer's address): ids by crypto.getRandomValues, each photo's SHA-256 in a worker in plain
// JavaScript. The photos wait in this phone (IndexedDB) until the computer has them — nothing of them is thrown away
// unless the person says so, not even when the phone is no longer paired.
(() => {
  "use strict";
  const T = JSON.parse(document.getElementById("texts").textContent);
  const LANG = document.documentElement.lang || "en";
  const $ = (id) => document.getElementById(id);
  const plurals = (() => {
    try {
      return new Intl.PluralRules(LANG);
    } catch {
      return new Intl.PluralRules("en");
    }
  })();

  // ── texts: {name} and {n, plural, one {# …} few {…} other {…}} ───────────────────────────────────────────────────
  const closing = (s, from) => {
    let depth = 0;
    for (let i = from; i < s.length; i++) {
      if (s[i] === "{") depth++;
      else if (s[i] === "}" && --depth === 0) return i;
    }
    return -1;
  };
  const fill = (tpl, v, hash) => {
    let out = "";
    for (let i = 0; i < tpl.length; i++) {
      const c = tpl[i];
      if (c === "#" && hash !== undefined) {
        out += hash;
        continue;
      }
      if (c !== "{") {
        out += c;
        continue;
      }
      const end = closing(tpl, i);
      if (end < 0) {
        out += tpl.slice(i);
        break;
      }
      const inner = tpl.slice(i + 1, end);
      const m = /^\s*([\p{L}\p{N}_]+)\s*,\s*plural\s*,([\s\S]*)$/u.exec(inner);
      if (m && m[1] in v) {
        const n = Number(v[m[1]]);
        const branches = {};
        const body = m[2];
        for (let j = 0; j < body.length; ) {
          const sel = /^\s*(=?[\p{L}\p{N}_]+)\s*\{/u.exec(body.slice(j));
          if (!sel) break;
          const open = j + sel[0].length - 1;
          const close = closing(body, open);
          if (close < 0) break;
          branches[sel[1]] = body.slice(open + 1, close);
          j = close + 1;
        }
        const pick = branches["=" + n] ?? branches[plurals.select(n)] ?? branches.other ?? "";
        out += fill(pick, v, new Intl.NumberFormat(LANG).format(n));
      } else if (/^[\p{L}\p{N}_]+$/u.test(inner) && inner in v) out += String(v[inner]);
      else out += tpl.slice(i, end + 1);
      i = end;
    }
    return out;
  };
  const t = (key, v = {}) => fill(T[key] ?? key, v);
  // a small photo is never "0.0 MB"
  const mb = (bytes) => new Intl.NumberFormat(LANG, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bytes > 0 ? Math.max(0.1, bytes / 1024 / 1024) : 0);
  // a 12-hour clock without a leading zero ("2:05 PM"), a 24-hour one with it ("09:07")
  const HOUR = /^h1[12]$/u.test(new Intl.DateTimeFormat(LANG, { hour: "numeric" }).resolvedOptions().hourCycle ?? "") ? "numeric" : "2-digit";
  const hhmm = (ms) => new Intl.DateTimeFormat(LANG, { hour: HOUR, minute: "2-digit" }).format(new Date(ms));
  const fold = (s) => String(s).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("").replace(/^(.{8})(.{4})(.{4})(.{4})/, "$1-$2-$3-$4-");
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const query = new URLSearchParams(location.search);
  const LANG_ASKED = /^[a-z]{2,3}$/.test(query.get("lang") || "") ? query.get("lang") : "";
  const HOME = /^[A-Za-z0-9_-]{22}$/.test(query.get("home") || "") ? query.get("home") : "";
  const store = {
    get: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        if (v === null) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
      } catch {
        // a private window: kept while the page is open
      }
    },
  };

  // ── the queue in this phone (IndexedDB strom-phone: queue, batches) ──────────────────────────────────────────────
  const db = (() => {
    let opened;
    const open = () =>
      (opened ??= new Promise((resolve) => {
        try {
          const r = indexedDB.open("strom-phone", 1);
          r.onupgradeneeded = () => {
            r.result.createObjectStore("queue", { keyPath: "id" });
            r.result.createObjectStore("batches", { keyPath: "tree" });
          };
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => resolve(null);
          r.onblocked = () => resolve(null);
        } catch {
          resolve(null);
        }
      }));
    const run = async (name, mode, fn) => {
      const d = await open();
      if (!d) return undefined;
      return new Promise((resolve) => {
        try {
          const tx = d.transaction(name, mode);
          const r = fn(tx.objectStore(name));
          tx.oncomplete = () => resolve(r && "result" in r ? r.result : undefined);
          tx.onerror = () => resolve(undefined);
          tx.onabort = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      });
    };
    return {
      all: async (name) => (await run(name, "readonly", (s) => s.getAll())) ?? [],
      put: (name, v) => run(name, "readwrite", (s) => s.put(v)),
      del: (name, k) => run(name, "readwrite", (s) => s.delete(k)),
    };
  })();

  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  const S = {
    view: "",
    trees: [],
    treesKnown: false,
    heic: true,
    max: 500,
    tree: store.get("strom.phone.tree") || "",
    gone: null, // {name, first}: the tree shown before is gone
    lastOk: 0,
    asking: 0,
    fails: 0,
    down: false,
    queue: [],
    batches: {},
    resumed: 0,
    sheet: false,
    typing: "",
    sending: null, // {id, xhr}
    speed: 0,
    moving: false,
    asked: "", // a "discard?" asked where
    shown: null, // what the tree shown does: now, lastWorked, waiting, day, latest
    logTree: "", // the tree and its newest change the progress shows
    logLatest: "",
    waitLoaded: null, // more of what waits, asked for on a tap: {tree, of (what the overview gave then), n, items}
    waitBusy: false,
    newCount: 0, // changes added above while scrolled down
    returning: false, // the page looked at again: the first answer after it awaited
  };
  const PENDING = new Set(["queued", "preparing", "sending", "offline"]);
  const FINAL = (i) => i.state === "error" && !i.retry;
  const treeById = (id) => S.trees.find((x) => x.id === id);
  const batchOf = (tree) => {
    let b = S.batches[tree];
    if (!b) {
      b = S.batches[tree] = { tree, id: rid(), note: "", person: null, commit: false };
      void db.put("batches", b);
    }
    return b;
  };
  const saveBatch = (b) => void db.put("batches", { ...b });
  const saveItem = (i) => {
    const { url: _u, ...rest } = i;
    return db.put("queue", rest);
  };
  const ofBatch = (b) => S.queue.filter((i) => i.tree === b.tree && i.batch === b.id);
  const goneItems = () => (S.treesKnown ? S.queue.filter((i) => !treeById(i.tree) && i.blob) : []);
  const unsent = () => S.queue.filter((i) => i.blob);

  // ── the server ───────────────────────────────────────────────────────────────────────────────────────────────────
  const ask = async (path, opts = {}, ms = 5000) => {
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), ms) : 0;
    try {
      const r = await fetch(path, { cache: "no-store", credentials: "same-origin", ...opts, ...(ctl ? { signal: ctl.signal } : {}) });
      let body = {};
      try {
        body = await r.json();
      } catch {
        // no JSON
      }
      return { status: r.status, body };
    } catch {
      return { status: 0, body: {} };
    } finally {
      clearTimeout(timer);
    }
  };
  const unpaired = () => {
    if (S.sending) S.sending.xhr.abort();
    // what was on its way goes again, whole, once paired again
    for (const i of S.queue)
      if (i.state === "preparing" || i.state === "sending") {
        i.state = "queued";
        void saveItem(i);
      }
    show("unpaired");
  };

  // the trees and what this computer takes; every 10 s, at once when the page is looked at again
  let refreshing = null;
  const refresh = () =>
    (refreshing ??= (async () => {
      S.asking = Date.now();
      const asked = S.tree;
      let r = await ask(`/phone/state?tree=${encodeURIComponent(asked)}`);
      // the tree shown is gone from the computer: the trees there are (the page says so and opens the first)
      if (r.status === 404 && asked) r = await ask("/phone/state");
      S.asking = 0;
      refreshing = null;
      if (r.status === 401) return unpaired();
      if (r.status !== 200) {
        S.fails++;
        if (S.fails >= 2) S.down = true;
        return render();
      }
      const wasDown = S.down || S.view !== "main";
      S.fails = 0;
      S.down = false;
      S.returning = false;
      S.lastOk = Date.now();
      S.trees = Array.isArray(r.body.trees) ? r.body.trees : [];
      S.treesKnown = true;
      S.heic = r.body.heic !== false;
      S.max = Number(r.body.max) || 500;
      if (!treeById(S.tree)) {
        const before = S.tree && S.queue.find((i) => i.tree === S.tree)?.treeName;
        const first = S.trees[0];
        if (S.tree && first) S.gone = { name: before || S.tree, first: first.name };
        S.tree = first ? first.id : "";
        store.set("strom.phone.tree", S.tree || null);
      }
      for (const i of S.queue)
        if (i.state === "offline") {
          i.state = "queued";
          void saveItem(i);
        }
      // what the tree shown does (another tree shown since it was asked: asked again for that one at once)
      if (asked === S.tree) {
        S.shown = r.body.shown || null;
        if (S.shown && S.shown.latest && (S.logTree !== S.tree || S.logLatest !== S.shown.latest)) void loadLog(S.tree, S.shown.latest);
        keepWait();
      } else {
        S.shown = null;
        setTimeout(() => void refresh(), 0);
      }
      // photos sent to a tree that is gone: nothing of them is here any more (the computer had them)
      for (const i of S.queue.filter((x) => !treeById(x.tree) && !x.blob)) forget(i);
      if (S.view !== "main") show("main");
      render();
      if (wasDown || !S.sending) pump();
    })());

  // the last changes of the tree shown, asked when its newest one is another
  let logging = null;
  const loadLog = (tree, latest) =>
    (logging ??= (async () => {
      const r = await ask(`/phone/log?tree=${encodeURIComponent(tree)}&limit=20`);
      logging = null;
      if (r.status !== 200 || !Array.isArray(r.body.changes)) return;
      if (tree === S.tree) {
        const first = S.logTree !== tree;
        S.logTree = tree;
        S.logLatest = latest;
        drawLog(r.body.changes, !!r.body.more, !first);
      }
      // another tree picked meanwhile, or a newer change: asked again for it
      if (S.shown && S.shown.latest && (S.logTree !== S.tree || S.logLatest !== S.shown.latest)) void loadLog(S.tree, S.shown.latest);
    })());

  // more of what waits than the overview gives, the first ones of the same list again with them
  const WAIT_PAGE = 50;
  const WAIT_MAX = 200;
  let waitAsking = null;
  const loadWait = (count, quiet = false) =>
    (waitAsking ??= (async () => {
      const tree = S.tree;
      const of = JSON.stringify(S.shown && S.shown.waiting);
      // asked on a tap: the button says so (asked again after an answer: nothing changes till it comes)
      if (!quiet) {
        S.waitBusy = true;
        drawWait();
      }
      const r = await ask(`/phone/waiting?tree=${encodeURIComponent(tree)}&from=0&limit=${Math.min(WAIT_MAX, count)}`);
      waitAsking = null;
      S.waitBusy = false;
      if (tree === S.tree && r.status === 200 && Array.isArray(r.body.items)) S.waitLoaded = { tree, of, n: Number(r.body.n) || 0, items: r.body.items };
      drawWait();
    })());
  // more of what waits asked for, kept over each answer: what waits another, asked again as many (all of it in the
  // overview: none)
  const keepWait = () => {
    const w = S.shown && S.shown.waiting;
    if (!S.waitLoaded || JSON.stringify(w) === S.waitLoaded.of) return;
    if (!w || !Array.isArray(w.items) || w.n <= w.items.length) S.waitLoaded = null;
    else void loadWait(S.waitLoaded.items.length, true);
  };

  // ── each photo: its SHA-256, in the research already?, sent ──────────────────────────────────────────────────────
  let worker = null;
  const waiting = new Map();
  const hashOf = (item) =>
    new Promise((resolve, reject) => {
      if (!worker) {
        worker = new Worker("/phone/sha256.js");
        worker.onmessage = (e) => {
          const w = waiting.get(e.data.id);
          if (!w) return;
          if (e.data.progress !== undefined) return;
          waiting.delete(e.data.id);
          if (e.data.sha) w.resolve(e.data.sha);
          else w.reject(new Error(e.data.error || "no hash"));
        };
        worker.onerror = () => {
          for (const w of waiting.values()) w.reject(new Error("worker"));
          waiting.clear();
          worker = null;
        };
      }
      waiting.set(item.id, { resolve, reject });
      worker.postMessage({ id: item.id, blob: item.blob });
    });

  const put = (item) =>
    new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      S.sending = { id: item.id, xhr };
      let last = Date.now();
      const started = Date.now();
      // nothing moves for 45 s (the Wi-Fi gone without an error): given up, sent again whole later
      const watch = setInterval(() => {
        if (Date.now() - last > 45_000) xhr.abort();
      }, 5000);
      const done = (status, body) => {
        clearInterval(watch);
        S.sending = null;
        resolve({ status, body });
      };
      xhr.open("PUT", `/phone/media/${item.sha}?tree=${encodeURIComponent(item.tree)}&batch=${encodeURIComponent(item.batch)}`);
      xhr.setRequestHeader("X-Strom-Name", encodeURIComponent(item.name));
      xhr.setRequestHeader("Content-Type", item.type || "application/octet-stream");
      xhr.upload.onprogress = (e) => {
        last = Date.now();
        if (e.lengthComputable) {
          item.progress = e.loaded / e.total;
          S.speed = e.loaded / Math.max(1, (Date.now() - started) / 1000);
          renderSoon();
        }
      };
      xhr.onload = () => {
        let body = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          // no JSON
        }
        done(xhr.status, body);
      };
      xhr.onerror = () => done(0, {});
      xhr.onabort = () => done(-1, {});
      xhr.send(item.blob);
    });

  const settle = (item, state, extra = {}) => {
    Object.assign(item, { state, progress: state === "sent" || state === "already" ? 1 : item.progress, error: null, retry: false }, extra);
    if (state === "sent" || state === "already") {
      if (item.url) URL.revokeObjectURL(item.url);
      item.url = null;
      item.blob = null;
    }
    void saveItem(item);
    render();
  };

  let pumping = false;
  const pump = async () => {
    if (pumping || S.view !== "main") return;
    pumping = true;
    try {
      for (;;) {
        if (S.view !== "main") break;
        const item = S.queue.find((i) => i.state === "queued" && treeById(i.tree));
        if (!item) break;
        if (!item.sha) {
          item.state = "preparing";
          render();
          try {
            item.sha = await hashOf(item);
          } catch {
            settle(item, "error", { error: "err.failed", retry: true });
            continue;
          }
          // the same photo twice in the queue: once
          if (S.queue.some((x) => x !== item && x.sha === item.sha && x.tree === item.tree && !FINAL(x))) {
            forget(item);
            render();
            continue;
          }
          void saveItem(item);
        }
        const known = await ask(`/phone/media/${item.sha}?tree=${encodeURIComponent(item.tree)}`);
        if (known.status === 401) return unpaired();
        if (known.status === 404) {
          item.state = "queued";
          await refresh();
          continue;
        }
        if (known.status !== 200) {
          settle(item, "offline");
          break;
        }
        if (known.body.known) {
          settle(item, "already");
          continue;
        }
        item.state = "sending";
        item.progress = 0;
        render();
        const r = await put(item);
        const code = r.body.code || "";
        if (r.status === 200) settle(item, r.body.known ? "already" : "sent");
        else if (r.status === 401) return unpaired();
        else if (r.status === 404 && code === "phone.tree-gone") {
          item.state = "queued";
          await refresh();
        } else if (r.status === 409 && code === "batch.closed") {
          // closed while this one went: the server goes on in the batch that takes over from it
          item.closedTries = (item.closedTries || 0) + 1;
          if (item.closedTries < 3) item.state = "queued";
          else settle(item, "error", { error: "err.failed", retry: true, closedTries: 0 });
        }
        else if (r.status === 413 && /^batch\.full/.test(code)) {
          // the rest of the photos in a batch of their own
          const b = batchOf(item.tree);
          const old = b.id;
          b.id = rid();
          saveBatch(b);
          for (const x of S.queue.filter((x) => x.tree === item.tree && x.batch === old && PENDING.has(x.state))) {
            x.batch = b.id;
            x.state = "queued";
            void saveItem(x);
          }
          showBatchError(t("err.batch_too_large"));
        } else if (r.status === 413) settle(item, "error", { error: "err.too_large", retry: false });
        else if (r.status === 415 || code === "media.type") settle(item, "error", { error: "err.type", retry: false });
        else if (r.status === 507) settle(item, "error", { error: "err.disk_full", retry: true });
        else if (r.status === 503) {
          // the research busy: again in a while, quietly
          settle(item, "offline");
          setTimeout(() => {
            if (item.state === "offline") settle(item, "queued");
            pump();
          }, 5000);
          break;
        } else if (r.status <= 0) {
          if (r.status === -1 && !S.queue.includes(item)) continue; // taken away while it went
          settle(item, "offline");
          break;
        } else settle(item, "error", { error: "err.failed", retry: true });
      }
    } finally {
      pumping = false;
      render();
      void handOver();
    }
  };

  const forget = (item) => {
    if (S.sending && S.sending.id === item.id) S.sending.xhr.abort();
    if (item.url) URL.revokeObjectURL(item.url);
    S.queue = S.queue.filter((x) => x !== item);
    void db.del("queue", item.id);
  };

  // ── handing a batch over ─────────────────────────────────────────────────────────────────────────────────────────
  let handing = false;
  const handOver = async () => {
    if (handing || S.view !== "main") return;
    const b = S.batches[S.tree];
    if (!b || !b.commit || !treeById(b.tree)) return;
    const items = ofBatch(b);
    if (items.some((i) => PENDING.has(i.state))) return;
    handing = true;
    try {
      const r = await ask(`/phone/batch/${encodeURIComponent(b.id)}/done?tree=${encodeURIComponent(b.tree)}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({ note: b.note, person: b.person ? b.person.id : "" }),
      }, 60_000);
      if (r.status === 401) return unpaired();
      if (r.status === 200) {
        const n = items.filter((i) => i.state === "sent" || i.state === "already").length;
        for (const i of items.filter((i) => !FINAL(i))) forget(i);
        // photos the research cannot take stay listed in the next batch until taken away
        const next = { tree: b.tree, id: rid(), note: "", person: null, commit: false, done: n };
        for (const i of items.filter(FINAL)) {
          i.batch = next.id;
          void saveItem(i);
        }
        S.batches[b.tree] = next;
        saveBatch(next);
        $("person").value = "";
        $("note").value = "";
      } else if (r.status === 503 || r.status === 0) setTimeout(() => void handOver(), 5000);
      else if (r.status === 404) await refresh();
      render();
    } finally {
      handing = false;
    }
  };

  // ── adding photos ────────────────────────────────────────────────────────────────────────────────────────────────
  const add = (files, fromCamera) => {
    const tree = treeById(S.tree);
    if (!tree || !files.length) return;
    const b = batchOf(tree.id);
    if (b.done !== undefined) {
      delete b.done;
      saveBatch(b);
    }
    for (const f of files) {
      const item = {
        id: rid(),
        tree: tree.id,
        treeName: tree.name,
        batch: b.id,
        name: f.name || `photo-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`,
        size: f.size,
        type: f.type,
        blob: f,
        capture: !!fromCamera,
        sha: null,
        state: "queued",
        progress: 0,
        added: Date.now(),
      };
      S.queue.push(item);
      void saveItem(item);
    }
    openSheet();
    pump();
  };

  // save each photo into the phone (its own name), one after another
  const saveAll = (items) => {
    items.forEach((i, k) =>
      setTimeout(() => {
        const a = el("a");
        const url = URL.createObjectURL(i.blob);
        a.href = url;
        a.download = i.name;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }, k * 600),
    );
  };
  // "Save to phone" and a quiet "Discard" (asked first: they are nowhere else)
  const keepBox = (box, where, items) => {
    box.replaceChildren();
    const save = el("button", "btn outline", t("keep.save"));
    save.type = "button";
    save.onclick = () => saveAll(items());
    const drop = el("button", "btn link", t("keep.drop"));
    drop.type = "button";
    drop.onclick = () => {
      S.asked = where;
      render();
    };
    box.append(save, drop);
    if (S.asked === where) {
      const q = el("p", "ask strong", t("keep.dropAsk", { n: items().length }));
      const yes = el("button", "btn outline", t("keep.drop"));
      yes.type = "button";
      yes.onclick = () => {
        for (const i of items()) forget(i);
        S.asked = "";
        render();
      };
      const no = el("button", "btn link", t("keep.keep"));
      no.type = "button";
      no.onclick = () => {
        S.asked = "";
        render();
      };
      box.append(q, yes, no);
    }
  };

  // ── views ────────────────────────────────────────────────────────────────────────────────────────────────────────
  const show = (view) => {
    S.view = view;
    for (const v of ["plain", "unpaired", "main"]) $(v).hidden = v !== view;
    if (view !== "main") {
      $("sheet").hidden = true;
      $("switcher").hidden = true;
      S.sheet = false;
    }
    render();
  };
  const plain = (state) => {
    $("plainTitle").textContent = { pairing: t("pairing"), expired: t("expired.title"), unreachable: t("unreachable.title") }[state];
    $("plainText").textContent = { pairing: "", expired: t("expired"), unreachable: t("unreachable") }[state];
    $("plainText").hidden = state === "pairing";
    $("plainRetry").hidden = state !== "unreachable";
    show("plain");
  };

  let soon = 0;
  const renderSoon = () => {
    if (!soon) soon = requestAnimationFrame(() => ((soon = 0), render()));
  };

  const render = () => {
    if (S.view === "unpaired") return renderUnpaired();
    if (S.view !== "main") return;
    renderHeader();
    const tree = treeById(S.tree);
    $("noTrees").hidden = !S.treesKnown || S.trees.length > 0;
    $("archiveCard").hidden = !tree || !tree.archive;
    $("pairedCard").hidden = !tree || tree.archive || !!S.shown;
    // the icon on the home screen: offered in the browser, not in the icon itself
    $("homeBtn").hidden = standalone || !$("homeCard").hidden || !tree;
    renderOverview();
    $("content").classList.toggle("stale", S.down);
    $("down").hidden = !S.down;
    if (S.down) $("downBody").textContent = t("down.body", { time: S.lastOk ? hhmm(S.lastOk) : "–" });
    $("goneBanner").hidden = !S.gone;
    if (S.gone) $("goneText").textContent = t("gone", { name: S.gone.name, first: S.gone.first });
    $("photoBtn").disabled = $("galleryBtn").disabled = !tree;
    for (const i of ["photoInput", "galleryInput"]) $(i).accept = S.heic ? "image/*" : "image/jpeg";
    renderStrip();
    if (S.sheet) renderSheet();
  };

  const renderHeader = () => {
    const tree = treeById(S.tree);
    $("treeName").textContent = tree ? tree.name : t("title");
    $("treeBtn").disabled = S.trees.length < 2 && !!tree;
    const dot = $("dot");
    const slow = S.asking && (S.returning || Date.now() - S.asking > 3000);
    dot.className = "dot" + (S.down ? " idle" : slow ? " slow" : "");
    const ago = Math.round((Date.now() - S.lastOk) / 1000);
    $("statusText").textContent = S.down ? (S.lastOk ? t("last", { time: hhmm(S.lastOk) }) : "") : slow ? t("refreshing") : S.lastOk && ago < 60 ? t("ago.s", { n: Math.max(0, ago) }) : "";
  };

  // ── what the research does (to look at alone: nothing here answers, starts or decides anything) ──────────────────
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  // a time of today, else its day too
  const atTime = (iso) => {
    const d = new Date(iso);
    return sameDay(d, new Date()) ? hhmm(d) : new Intl.DateTimeFormat(LANG, { day: "numeric", month: "numeric", hour: HOUR, minute: "2-digit" }).format(d);
  };
  // a change's time: of today the time alone, else its day before it (the year when not this one), broken only
  // between the two
  const logTime = (ms, now = new Date()) => {
    const d = new Date(ms);
    if (sameDay(d, now)) return hhmm(d);
    const day = new Intl.DateTimeFormat(LANG, { day: "numeric", month: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) }).format(d);
    const whole = (text) => text.replace(/\s/gu, "\u00a0");
    return `${whole(day)} ${whole(hhmm(d))}`;
  };
  const whenOf = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    if (sameDay(d, now)) return t("when.today", { time: hhmm(d) });
    if (sameDay(d, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return t("when.yesterday", { time: hhmm(d) });
    return t("when.date", { date: new Intl.DateTimeFormat(LANG, { day: "numeric", month: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) }).format(d) });
  };
  const count = (n) => new Intl.NumberFormat(LANG).format(n);
  // each part drawn again only when what it shows changed
  const drawn = {};
  const changed = (key, value) => {
    const j = JSON.stringify(value);
    if (drawn[key] === j) return false;
    drawn[key] = j;
    return true;
  };
  const renderOverview = () => {
    const tree = treeById(S.tree);
    const o = S.shown;
    $("overview").hidden = !tree || !o;
    if (!tree || !o) return;
    const archive = !!tree.archive;
    $("nowCard").hidden = $("waitCard").hidden = archive;
    const lines = Array.isArray(o.now) ? o.now : [];
    if (!archive && changed("now", [lines, o.lastWorked, new Date().toDateString()])) {
      $("nowTitle").textContent = lines.length > 1 ? t("now.lines", { n: lines.length }) : t("now");
      $("nowLines").replaceChildren(
        ...lines.map((l) => {
          const li = el("li");
          const glyph = el("span", "glyph" + (l.way === "up" || l.way === "down" ? "" : " find"), l.way === "up" ? "↑" : l.way === "down" ? "↓" : "⌕");
          glyph.setAttribute("aria-hidden", "true");
          const box = el("div");
          box.append(el("div", "name", l.name));
          if (l.task) box.append(el("div", "task", l.task));
          const since = el("div", "since" + (l.paused ? " pause" : ""));
          since.append(el("span", l.paused ? "sq" : "dot"), el("span", "", l.paused ? t("now.pause", { time: atTime(l.paused.until) }) : t("now.since", { time: atTime(l.since) })));
          box.append(since);
          li.append(glyph, box);
          return li;
        }),
      );
      $("nowLines").hidden = !lines.length;
      $("nowIdle").hidden = lines.length > 0;
      $("nowIdleLast").hidden = !o.lastWorked;
      if (o.lastWorked) $("nowIdleLast").textContent = t("now.idleLast", { when: whenOf(o.lastWorked) });
    }
    if (!archive) drawWait();
    $("dayCard").hidden = !o.day;
    if (o.day && changed("day", o.day)) {
      const plus = (n) => (n > 0 ? "+" : "") + count(n);
      $("dayPeople").textContent = plus(o.day.persons);
      $("dayPeopleL").textContent = t("day.people", { n: o.day.persons });
      $("daySources").textContent = plus(o.day.sources);
      $("daySourcesL").textContent = t("day.sources", { n: o.day.sources });
      $("daySaves").textContent = count(o.day.saves);
      $("daySavesL").textContent = t("day.saves", { n: o.day.saves });
    }
    $("logCard").hidden = S.logTree !== S.tree;
  };

  // what waits, each text whole: the overview's first ones, or more of them asked for (kept till what waits is another)
  const drawWait = () => {
    const tree = treeById(S.tree);
    const o = S.shown;
    if (!tree || !o || tree.archive) return;
    const first = o.waiting && Array.isArray(o.waiting.items) ? o.waiting : { n: 0, items: [] };
    const more = S.waitLoaded && S.waitLoaded.tree === S.tree && S.waitLoaded.items.length > first.items.length ? S.waitLoaded : null;
    const w = more ? { n: more.n, items: more.items } : first;
    if (!changed("wait", [w, S.waitBusy])) return;
    $("waitCard").classList.toggle("none", !w.n);
    $("waitTitle").textContent = w.n ? t("waiting", { n: w.n }) : t("waiting.title");
    $("waitNone").hidden = w.n > 0;
    $("waitList").replaceChildren(
      ...w.items.map((x) => {
        const li = el("li");
        const box = el("div");
        box.append(el("div", "what", x.what));
        if (x.on) box.append(el("div", "on", x.on));
        li.append(el("span", "wdot"), box);
        return li;
      }),
    );
    $("waitList").hidden = !w.n;
    const left = Math.max(0, w.n - w.items.length);
    const can = left > 0 && w.items.length < WAIT_MAX;
    $("waitMore").hidden = !can;
    $("waitMore").disabled = S.waitBusy;
    if (can) $("waitMore").textContent = S.waitBusy ? t("waiting.loading") : t("waiting.more", { n: left });
    $("waitRest").hidden = !left || can;
    if (left && !can) $("waitRest").textContent = t("waiting.rest", { n: left });
    $("waitWhere").hidden = !w.n;
  };

  // the progress: the changes drawn kept by their id, a new one put on top (lit for 6 s); scrolled down, what is under
  // the finger stays where it is and a pill says how many came above
  const logItems = new Map();
  const drawChange = (c) => {
    const li = el("li");
    const time = el("time", "", logTime(Date.parse(c.at)));
    time.dateTime = c.at;
    const box = el("div");
    for (const line of c.lines || []) box.append(el("p", "", line));
    // its other lines unfolded on a tap (the change drawn is kept: a new answer folds nothing)
    const rest = Array.isArray(c.rest) ? c.rest : [];
    if (c.more && rest.length) {
      const hid = el("div", "rest");
      hid.hidden = true;
      hid.id = `rest-${c.id}`;
      for (const line of rest) hid.append(el("p", "", line));
      if (c.more > rest.length) hid.append(el("p", "more", t("log.lines", { n: c.more - rest.length })));
      const unfold = el("button", "unfold", t("log.lines", { n: c.more }));
      unfold.type = "button";
      unfold.setAttribute("aria-expanded", "false");
      unfold.setAttribute("aria-controls", hid.id);
      unfold.onclick = () => {
        const open = hid.hidden;
        hid.hidden = !open;
        unfold.setAttribute("aria-expanded", String(open));
        unfold.textContent = open ? t("log.fold") : t("log.lines", { n: c.more });
      };
      box.append(hid, unfold);
    } else if (c.more) box.append(el("p", "more", t("log.lines", { n: c.more })));
    li.append(time, box);
    return li;
  };
  const drawLog = (changes, more, light) => {
    const ul = $("logList");
    if (!light) {
      for (const li of logItems.values()) li.remove();
      logItems.clear();
      S.newCount = 0;
    }
    const keep = new Set(changes.map((c) => c.id));
    for (const [id, li] of logItems)
      if (!keep.has(id)) {
        li.remove();
        logItems.delete(id);
      }
    const y = window.scrollY;
    const before = document.documentElement.scrollHeight;
    let added = 0;
    const items = changes.map((c) => {
      let li = logItems.get(c.id);
      if (!li) {
        li = drawChange(c);
        logItems.set(c.id, li);
        if (light) {
          added++;
          li.classList.add("fresh");
          const lit = li;
          setTimeout(() => lit.classList.remove("fresh"), 6000);
        }
      }
      return li;
    });
    ul.append(...items);
    $("logNone").hidden = changes.length > 0;
    $("logMore").hidden = !more;
    render();
    if (added && y > 0) {
      window.scrollTo(0, y + document.documentElement.scrollHeight - before);
      S.newCount += added;
    }
    renderPill();
  };
  // past midnight the changes of the day before get their day (asked every second, drawn again once a day)
  let logDay = "";
  const restampLog = (now = new Date()) => {
    const day = now.toDateString();
    if (day === logDay) return;
    logDay = day;
    for (const li of logItems.values()) {
      const time = li.children[0];
      time.textContent = logTime(Date.parse(time.dateTime), now);
    }
  };
  const renderPill = () => {
    if (window.scrollY <= 4) S.newCount = 0;
    $("newPill").hidden = !S.newCount || S.view !== "main";
    if (S.newCount) $("newPill").textContent = t("log.new", { n: S.newCount });
  };

  const renderStrip = () => {
    const b = S.batches[S.tree];
    const items = b ? ofBatch(b) : [];
    const gone = goneItems();
    const strip = $("strip");
    strip.hidden = S.sheet || (!items.length && !gone.length);
    if (strip.hidden) return;
    const done = items.filter((i) => i.state === "sent" || i.state === "already").length;
    const pending = items.filter((i) => PENDING.has(i.state));
    const offline = items.some((i) => i.state === "offline");
    let text;
    if (gone.length && !items.length) text = t("strip.gone", { n: gone.length });
    else if (offline) text = t("strip.offline", { n: items.length });
    else if (pending.length) text = t("strip.sending", { n: items.length, a: Math.min(items.length, done + 1), b: items.length });
    else text = t("strip.sent", { n: items.length });
    $("stripText").textContent = text;
    strip.classList.toggle("warn", offline || (!!gone.length && !items.length));
    const total = items.reduce((s, i) => s + i.size, 0);
    const sent = items.reduce((s, i) => s + (i.state === "sent" || i.state === "already" ? i.size : i.state === "sending" ? i.size * (i.progress || 0) : 0), 0);
    $("stripFill").style.width = `${total ? Math.round((100 * sent) / total) : 0}%`;
  };

  const rows = new Map();
  const renderSheet = () => {
    const tree = treeById(S.tree);
    const b = tree ? batchOf(tree.id) : null;
    const items = b ? ofBatch(b) : [];
    $("sheetTo").textContent = tree ? t("sheet.to", { tree: tree.name }) : "";
    // photos left from before
    const left = S.resumed ? unsent().filter((i) => treeById(i.tree)).length : 0;
    if (!left) S.resumed = 0;
    $("resume").hidden = !left;
    if (left) $("resumeText").textContent = t("resume", { n: left });
    // photos of a tree that is gone
    const gone = goneItems();
    $("goneCard").hidden = !gone.length;
    if (gone.length) {
      $("gonePhotos").textContent = t("gone.photos", { n: gone.length });
      $("goneSend").textContent = t("gone.sendTo", { tree: tree ? tree.name : "" }) + " ▾";
      $("goneSend").disabled = !tree;
      keepBox($("goneCard").querySelector(".keep"), "gone", goneItems);
    }
    // the note and the person
    if (b && document.activeElement !== $("note")) $("note").value = b.note || "";
    $("personChip").hidden = !b || !b.person;
    $("person").hidden = !!(b && b.person);
    if (b && b.person) {
      $("personName").textContent = b.person.name;
      $("people").hidden = true;
    }
    // how far
    const done = items.filter((i) => i.state === "sent" || i.state === "already");
    const total = items.reduce((s, i) => s + i.size, 0);
    const sent = items.reduce((s, i) => s + (i.state === "sent" || i.state === "already" ? i.size : i.state === "sending" ? i.size * (i.progress || 0) : 0), 0);
    $("total").hidden = !items.length;
    $("totalText").textContent = t("total", { a: done.length, b: items.length, x: mb(sent), y: mb(total) });
    $("totalFill").style.width = `${total ? Math.round((100 * sent) / total) : 0}%`;
    const pending = items.filter((i) => PENDING.has(i.state));
    const leftBytes = total - sent;
    $("lockNote").hidden = !(pending.length > 3 || (S.speed > 0 && leftBytes / S.speed > 20));
    $("offlineNote").hidden = !items.some((i) => i.state === "offline");
    // each photo
    const list = $("list");
    const keep = new Set(items.map((i) => i.id));
    for (const [id, li] of rows)
      if (!keep.has(id)) {
        li.remove();
        rows.delete(id);
      }
    items.forEach((i, k) => {
      let li = rows.get(i.id);
      if (!li) {
        li = el("li");
        const img = el(i.blob ? "img" : "span", "thumb");
        if (i.blob) {
          i.url ??= URL.createObjectURL(i.blob);
          img.src = i.url;
          img.alt = "";
        }
        const what = el("div", "what");
        what.append(el("div", "name", i.name), el("div", "state"), el("p", "err"));
        const x = el("button", "x", "×");
        x.type = "button";
        x.setAttribute("aria-label", t("remove"));
        x.onclick = () => {
          forget(i);
          render();
          pump();
        };
        li.append(img, what, x);
        rows.set(i.id, li);
      }
      if (list.children[k] !== li) list.insertBefore(li, list.children[k] ?? null);
      const state = li.querySelector(".state");
      const st = i.state === "sending" ? t("st.sending", { p: Math.round((i.progress || 0) * 100) }) : i.state === "error" ? "" : t(`st.${i.state}`);
      state.textContent = `${mb(i.size)} MB${st ? ` · ${st}` : ""}`;
      state.className = `state ${i.state}`;
      const err = li.querySelector(".err");
      err.hidden = i.state !== "error";
      if (i.state === "error") {
        err.textContent = t(i.error || "err.failed", { max: S.max });
        if (i.retry) {
          const again = el("button", "retry", t("retry"));
          again.type = "button";
          again.onclick = () => {
            settle(i, "queued");
            pump();
          };
          err.append(again);
        }
      }
      li.querySelector(".x").hidden = i.state === "sent" || i.state === "already";
    });
    // handed over
    const handed = b && b.done !== undefined && !items.length;
    $("doneBox").hidden = !handed;
    if (handed) $("doneText").textContent = t("commit.done", { n: b.done });
    // the foot: the camera's photos only here, handing over
    $("captureNote").hidden = !items.some((i) => i.capture && i.blob);
    $("photoRow").hidden = !!S.typing;
    $("typingRow").hidden = !S.typing;
    $("noPersonBtn").hidden = S.typing !== "person";
    const committing = !!(b && b.commit);
    $("commitBtn").hidden = !items.length;
    $("commitBtn").disabled = committing || !items.some((i) => !FINAL(i));
    $("commitBtn").textContent = committing ? t("commit.wait") : t("commit");
    $("commitCancel").hidden = !committing;
    $("commitLater").hidden = !items.length || committing;
  };

  const renderUnpaired = () => {
    const left = unsent();
    $("unpairedQueue").hidden = !left.length;
    if (left.length) {
      $("unpairedCount").textContent = t("unpaired.queue", { n: left.length });
      keepBox($("unpairedQueue").querySelector(".keep"), "unpaired", unsent);
    }
  };

  let batchErrorTimer = 0;
  const showBatchError = (text) => {
    $("batchError").textContent = text;
    $("batchError").hidden = false;
    clearTimeout(batchErrorTimer);
    batchErrorTimer = setTimeout(() => ($("batchError").hidden = true), 15_000);
  };

  // ── the sheet, the trees, the person ─────────────────────────────────────────────────────────────────────────────
  const openSheet = () => {
    S.sheet = true;
    $("sheet").hidden = false;
    render();
  };
  const closeSheet = () => {
    S.sheet = false;
    S.typing = "";
    $("sheet").hidden = true;
    const b = S.batches[S.tree];
    if (b && b.done !== undefined && !ofBatch(b).length) {
      delete b.done;
      saveBatch(b);
    }
    render();
  };

  const openTrees = (moving) => {
    S.moving = !!moving;
    const ul = $("trees");
    ul.replaceChildren();
    for (const tr of S.trees) {
      const li = el("li");
      li.setAttribute("role", "button");
      li.tabIndex = 0;
      li.append(el("span", "check", tr.id === S.tree ? "✓" : ""), el("span", "label", tr.name));
      const marks = el("span", "marks");
      if (tr.archive) marks.append(el("span", "pill", t("mark.archive")));
      else {
        if (tr.working) marks.append(el("span", "dot"), el("span", "", t("mark.working")));
        if (tr.waiting) marks.append(el("span", "pill wait", t("mark.waiting", { n: tr.waiting })));
        if (!tr.working && !tr.waiting) marks.append(el("span", "ring"), el("span", "", t("mark.idle")));
      }
      li.append(marks);
      li.onclick = () => pickTree(tr.id);
      li.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") pickTree(tr.id);
      };
      ul.append(li);
    }
    $("switcher").hidden = false;
  };
  const closeTrees = () => {
    $("switcher").hidden = true;
    S.moving = false;
  };
  const pickTree = (id) => {
    const moving = S.moving;
    closeTrees();
    if (S.tree !== id) {
      S.shown = null;
      S.waitLoaded = null;
      S.logTree = "";
      for (const li of logItems.values()) li.remove();
      logItems.clear();
      S.newCount = 0;
      for (const k of Object.keys(drawn)) delete drawn[k];
      S.tree = id;
      void refresh();
    }
    S.tree = id;
    S.gone = null;
    store.set("strom.phone.tree", id);
    if (moving) {
      // the photos of a tree that is gone: a new batch of this one, their note kept, no person
      const items = goneItems();
      const note = items.map((i) => S.batches[i.tree]?.note).find(Boolean) || "";
      const b = batchOf(id);
      if (!ofBatch(b).length && !b.note) b.note = note;
      saveBatch(b);
      const tree = treeById(id);
      for (const i of items) {
        delete S.batches[i.tree];
        void db.del("batches", i.tree);
        Object.assign(i, { tree: id, treeName: tree.name, batch: b.id, state: "queued", sha: i.sha });
        void saveItem(i);
      }
      pump();
    }
    rows.clear();
    $("list").replaceChildren();
    render();
  };

  let lookFor = 0;
  let asked = "";
  const findPeople = () => {
    clearTimeout(lookFor);
    const q = $("person").value;
    const ul = $("people");
    if (fold(q).replace(/[^\p{L}\p{M}\p{N}]/gu, "").length < 2) {
      ul.hidden = true;
      return;
    }
    lookFor = setTimeout(async () => {
      asked = q;
      const r = await ask(`/phone/people?tree=${encodeURIComponent(S.tree)}&q=${encodeURIComponent(q)}`);
      if (asked !== $("person").value) return;
      if (r.status === 401) return unpaired();
      const people = r.status === 200 && Array.isArray(r.body.people) ? r.body.people : [];
      ul.replaceChildren();
      const words = fold(q).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
      for (const p of people) {
        const li = el("li");
        const name = el("div");
        // the words that match, bold
        for (const [k, part] of String(p.name).split(/(\s+)/).entries()) {
          if (k % 2) name.append(part);
          else if (words.some((w) => fold(part).startsWith(w))) name.append(el("b", "", part));
          else name.append(part);
        }
        const years = p.birth || p.death ? `${p.birth || ""}–${p.death || ""}` : "";
        li.append(name);
        if (years || p.place) li.append(el("span", "", [years, p.place].filter(Boolean).join(" · ")));
        li.onclick = () => {
          const b = batchOf(S.tree);
          b.person = { id: p.id, name: p.name };
          saveBatch(b);
          $("person").value = "";
          ul.hidden = true;
          $("person").blur();
          render();
        };
        ul.append(li);
      }
      ul.hidden = !people.length;
    }, 250);
  };

  // ── wiring ───────────────────────────────────────────────────────────────────────────────────────────────────────
  document.title = t("title");
  const texts = {
    plainRetry: "retry", unpairedTitle: "unpaired.title", unpairedWhy: "unpaired.why", unpairedHow: "unpaired.how", unpairedBody: "unpaired.queueBody",
    downTitle: "down.title", downC1: "down.c1", downC2: "down.c2", downC3: "down.c3", noTrees: "none", archiveText: "archive", archivePhotos: "archive.photos",
    photoBtn: "btn.photo", galleryBtn: "btn.gallery", morePhotoBtn: "btn.photoMore", moreGalleryBtn: "btn.gallery", sheetTitle: "sheet.title",
    resumeForget: "forget", noteLabel: "field.note", personLabel: "field.person", lockNote: "lock", offlineNote: "offline.queue",
    doneNext: "commit.next", captureNote: "captureOnly", noPersonBtn: "field.noPerson", typingDone: "field.done", commitCancel: "commit.cancel",
    commitLater: "commit.later", switcherTitle: "switcher.title", pairedTitle: "paired.title", pairedText: "paired",
    homeBtn: "home.button", homeTitle: "home.title", homeIos: "home.ios", homeAndroid: "home.android", homeNote: "home.note", homeClose: "close",
    nowIdleText: "now.idle", waitNone: "waiting.none", waitWhere: "waiting.where", dayTitle: "day", logTitle: "log", logNone: "log.none", logMore: "log.more",
  };
  for (const [id, key] of Object.entries(texts)) $(id).textContent = t(key);
  // the icon on the home screen scans no QR code: the browser pairs again, and the icon is added from there
  if (standalone) $("unpairedHow").textContent = t("unpaired.howHome");
  $("person").placeholder = t("field.personPh");
  $("sheetClose").setAttribute("aria-label", t("collapse"));
  $("goneClose").setAttribute("aria-label", t("close"));
  $("personClear").setAttribute("aria-label", t("remove"));

  $("plainRetry").onclick = () => start("");
  $("waitMore").onclick = () => {
    const w = S.waitLoaded && S.waitLoaded.tree === S.tree ? S.waitLoaded : S.shown && S.shown.waiting;
    if (w && Array.isArray(w.items)) void loadWait(w.items.length + WAIT_PAGE);
  };
  $("photoBtn").onclick = $("morePhotoBtn").onclick = () => $("photoInput").click();
  $("galleryBtn").onclick = $("moreGalleryBtn").onclick = () => $("galleryInput").click();
  $("photoInput").onchange = (e) => {
    add([...e.target.files], true);
    e.target.value = "";
  };
  $("galleryInput").onchange = (e) => {
    add([...e.target.files], false);
    e.target.value = "";
  };
  $("strip").onclick = openSheet;
  $("sheetClose").onclick = closeSheet;
  $("treeBtn").onclick = () => openTrees(false);
  $("goneSend").onclick = () => openTrees(true);
  $("goneClose").onclick = () => {
    S.gone = null;
    render();
  };
  $("switcher").onclick = (e) => {
    if (e.target === $("switcher")) closeTrees();
  };
  // pulled down: closed
  let pullFrom = null;
  $("switcher").addEventListener("touchstart", (e) => (pullFrom = e.touches[0].clientY), { passive: true });
  $("switcher").addEventListener("touchmove", (e) => {
    if (pullFrom !== null && e.touches[0].clientY - pullFrom > 80 && $("switcher").querySelector(".pick").scrollTop <= 0) {
      pullFrom = null;
      closeTrees();
    }
  }, { passive: true });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("switcher").hidden) closeTrees();
    else if (S.sheet) closeSheet();
  });
  $("note").oninput = () => {
    const b = batchOf(S.tree);
    b.note = $("note").value;
    saveBatch(b);
  };
  $("person").oninput = findPeople;
  $("personClear").onclick = () => {
    const b = batchOf(S.tree);
    b.person = null;
    saveBatch(b);
    render();
  };
  for (const id of ["note", "person"]) {
    $(id).addEventListener("focus", () => {
      S.typing = id;
      render();
    });
    $(id).addEventListener("blur", () =>
      setTimeout(() => {
        if (document.activeElement !== $("note") && document.activeElement !== $("person")) {
          S.typing = "";
          render();
        }
      }, 150),
    );
    $(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") $(id).blur();
    });
  }
  $("typingDone").onclick = () => document.activeElement && document.activeElement.blur();
  $("noPersonBtn").onclick = () => {
    const b = batchOf(S.tree);
    b.person = null;
    saveBatch(b);
    $("person").value = "";
    $("people").hidden = true;
    $("person").blur();
  };
  $("commitBtn").onclick = () => {
    const b = batchOf(S.tree);
    b.commit = true;
    saveBatch(b);
    render();
    void handOver();
  };
  $("commitCancel").onclick = () => {
    const b = batchOf(S.tree);
    b.commit = false;
    saveBatch(b);
    render();
  };
  $("doneNext").onclick = closeSheet;

  // ── the icon on the home screen ──────────────────────────────────────────────────────────────────────────────────
  // An iPhone opens it as a web app of its own that does not see this browser's cookie: while the help is shown, the
  // address carries a code for it (one, for ten minutes, taken once); the icon opened unpaired gives it back for a key of
  // its own. Android's icon opens the browser, paired already. The code leaves the address as the help closes, or at its
  // time.
  const homeAddress = (code) => "/" + (LANG_ASKED ? `?lang=${encodeURIComponent(LANG_ASKED)}` : "") + (code ? `${LANG_ASKED ? "&" : "?"}home=${code}` : "");
  let homeTimer = 0;
  const homeOff = () => {
    clearTimeout(homeTimer);
    history.replaceState(null, "", homeAddress(""));
    $("homeCard").hidden = true;
    render();
  };
  $("homeBtn").onclick = async () => {
    $("homeCard").hidden = false;
    render();
    $("homeCard").scrollIntoView({ block: "nearest", behavior: "smooth" });
    const r = await ask(`/phone/home?tree=${encodeURIComponent(S.tree)}`, { method: "POST" });
    if (r.status !== 200 || typeof r.body.code !== "string" || $("homeCard").hidden) return;
    history.replaceState(null, "", homeAddress(r.body.code));
    clearTimeout(homeTimer);
    homeTimer = setTimeout(homeOff, Math.max(0, Date.parse(r.body.expiresAt) - Date.now()));
  };
  $("homeClose").onclick = homeOff;
  $("newPill").onclick = () => {
    S.newCount = 0;
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderPill();
  };
  window.addEventListener("scroll", () => S.newCount && window.scrollY <= 4 && renderPill(), { passive: true });
  // the keyboard: the sheet as high as what is seen of the page, its foot above the keyboard
  const vv = window.visualViewport;
  if (vv) {
    const fit = () => document.documentElement.style.setProperty("--vvh", `${vv.height}px`);
    vv.addEventListener("resize", fit);
    fit();
  }

  // looked at again: asked at once; every 10 s while open
  let ticks = 0;
  setInterval(() => {
    ticks++;
    if (S.view === "main") {
      renderHeader();
      restampLog();
      if (ticks % 10 === 0 && document.visibilityState !== "hidden") void refresh();
    } else if (S.view === "unpaired" && ticks % 10 === 0) void whoami().then((w) => w === "paired" && void refresh());
  }, 1000);
  const again = () => {
    if (document.visibilityState === "hidden") return;
    if (S.view === "main") {
      S.returning = true;
      renderHeader();
      void refresh();
    }
    else if (S.view === "unpaired") void whoami().then((w) => w === "paired" && void refresh());
  };
  document.addEventListener("visibilitychange", again);
  window.addEventListener("pageshow", again);
  window.addEventListener("focus", again);
  window.addEventListener("online", again);

  // ── the start: pairing by the code after #, else whoever this phone is ───────────────────────────────────────────
  const whoami = async () => {
    const r = await ask("/whoami");
    return r.status === 200 ? "paired" : r.status === 401 ? "unpaired" : "unreachable";
  };
  const load = async () => {
    S.queue = (await db.all("queue")).map((i) => ({ ...i, state: i.state === "preparing" || i.state === "sending" || i.state === "offline" ? "queued" : i.state }));
    for (const b of await db.all("batches")) S.batches[b.tree] = b;
    S.resumed = unsent().length;
  };
  const enter = async (who) => {
    if (who === "paired") return refresh();
    if (who === "unpaired") return show("unpaired");
    plain("unreachable");
  };
  const start = async (code) => {
    if (!code) {
      const who = await whoami();
      // the icon on the home screen opened for the first time: its code for a key of its own
      if (who === "unpaired" && HOME) {
        const r = await ask("/home", { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify({ code: HOME }) });
        if (r.status === 200) {
          // the tree shown as the icon was added
          if (typeof r.body.tree === "string" && r.body.tree) {
            S.tree = r.body.tree;
            store.set("strom.phone.tree", S.tree);
          }
          return refresh();
        }
      }
      return enter(who);
    }
    plain("pairing");
    const lang = LANG_ASKED;
    const r = await ask("/pair", { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify({ code, lang }) });
    if (r.status === 200) {
      // the tree whose QR code it was (the Strom app's, or strom phone in its folder)
      if (typeof r.body.tree === "string" && r.body.tree) {
        S.tree = r.body.tree;
        store.set("strom.phone.tree", S.tree);
      }
      return refresh();
    }
    // the code used already, maybe by this phone (the page opened twice)
    const now = await whoami();
    if (now === "paired") return refresh();
    if (now === "unreachable") return plain("unreachable");
    plain("expired");
  };

  // the code is in the address after # alone (never sent to the server by the browser); taken out of the address at
  // once, so that neither the history nor a bookmark keeps it
  const code = location.pathname === "/pair" ? decodeURIComponent(location.hash.slice(1)) : "";
  if (location.pathname === "/pair" || location.hash || HOME) history.replaceState(null, "", homeAddress(""));
  void load().then(() => start(/^[A-Za-z0-9_-]{22}$/.test(code) ? code : ""));
})();
