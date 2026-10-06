#!/bin/sh
# Strom research — installer for macOS and Linux:
#   curl -fsSL <this file's address> | sh
# strom is JavaScript on Node. This takes the official Node from nodejs.org
# (checked against nodejs.org's SHASUMS256.txt) and strom's code from the
# project's release (checked against the release's SHASUMS256.txt), puts both
# into ~/.local/share/strom, the command `strom` into ~/.local/bin (added to
# PATH for new terminals) and starts strom — its setup wizard takes over.
# No admin rights; nothing downloaded is a program of ours: strom's code is
# plain JavaScript anyone can read.
# STROM_FROM='1|<mark>|<browser>|<file>|<app>|<name>': a family tree of the Strom app (the line the app shows
# carries it) — strom set up, that tree becomes a research of its own. Every field but the mark may be empty: the
# browser the app runs in (chrome, edge, firefox, safari…) — strom opens the app there; the 8 characters of the file
# the app saved the tree in (strom-prenos-<…>.json: Safari, which the app cannot reach strom from) — it moves to a
# browser that can, on the person's word; another copy of the app (beta, or its address) — strom keeps it
# (strom.app.url); the tree's name in the app — the research's suggested name.
# The line of an older app, read the same when STROM_FROM is not set: STROM_FROM_APP, STROM_FROM_BROWSER,
# STROM_FROM_FILE, STROM_APP_URL, STROM_FROM_APP_NAME;
# STROM_DOWNLOAD_BASE, STROM_NODE_BASE: other places to download from;
# STROM_INSTALL_DIR: another folder for the command; STROM_PROGRAM_DIR: another
# folder for Node and strom.
# STROM_ISOLATED=1: a second strom beside the person's own, to try a version — with
# STROM_INSTALL_DIR and STROM_CONFIG_DIR of its own (Node and strom go into
# STROM_INSTALL_DIR too), nothing outside them: no PATH line, nothing of another
# strom touched; strom then registers no links and teaches the agents nothing.
# What the installation was installed with (STROM_CONFIG_DIR, and when isolated
# HOME, STROM_ISOLATED) is kept in install.json: every start of it takes it.
set -eu

BASE="${STROM_DOWNLOAD_BASE:-https://github.com/ACiDekCZ/strom-research/releases/latest/download}"
NODE_BASE="${STROM_NODE_BASE:-https://nodejs.org/dist}"
DEST="${STROM_INSTALL_DIR:-$HOME/.local/bin}"
ROOT="${STROM_PROGRAM_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/strom}"
ISOLATED=
if [ "${STROM_ISOLATED:-}" = 1 ]; then ISOLATED=1; ROOT="${STROM_PROGRAM_DIR:-$DEST}"; fi

# the language strom is told (STROM_LANG, as strom itself reads it), else the system's
case "${STROM_LANG:-${LC_ALL:-${LANG:-}}}" in
  cs*) T_OTHER="Pozor: příkaz strom spouští jiný, starší strom"; T_NPM_ASK="Je nainstalovaný přes npm. Odebrat ho? (a/n) [a]"; T_NPM_HOW="Odebrat příkazem: npm uninstall -g strom-research"; T_OTHER_HOW="Smazat ho, nebo dát v PATH před jeho složku tuto"; T_DL="Stahuji Strom výzkum"; T_DL2=""; T_NODE="Stahuji Node.js z nodejs.org"; T_BAD="Stažený soubor je poškozený (kontrolní součet nesedí) – zkusit to znovu."; T_OS="Tento instalátor je pro macOS a Linux; na Windows slouží install.ps1."; T_CPU="Nepodporovaný procesor"; T_OK="Nainstalováno"; T_START="Příště se spouští příkazem: strom"; T_NEW="Otevřít nový terminál, aby příkaz strom fungoval všude."; T_RUN="V tomto terminálu se zatím spouští takto"; T_ISO_NEED="STROM_ISOLATED potřebuje vlastní složky: STROM_INSTALL_DIR a STROM_CONFIG_DIR."; T_ISO="Izolovaná instalace: nic mimo tyto složky (žádný PATH, odkazy ani učení agentů). Spouští se takto" ;;
  de*) T_OTHER="Achtung: der Befehl strom startet ein anderes, älteres strom"; T_NPM_ASK="Es kam mit npm. Entfernen? (j/n) [j]"; T_NPM_HOW="Entfernen mit: npm uninstall -g strom-research"; T_OTHER_HOW="Löschen oder im PATH vor seinen Ordner diesen setzen"; T_DL="Strom Ahnenforschung"; T_DL2=" wird heruntergeladen"; T_NODE="Node.js wird von nodejs.org heruntergeladen"; T_BAD="Die Datei ist beschädigt (Prüfsumme stimmt nicht) – erneut versuchen."; T_OS="Dieses Installationsprogramm ist für macOS und Linux; unter Windows dient install.ps1."; T_CPU="Nicht unterstützter Prozessor"; T_OK="Installiert"; T_START="Nächstes Mal startet es mit: strom"; T_NEW="Ein neues Terminal öffnen, damit der Befehl strom überall funktioniert."; T_RUN="In diesem Terminal startet es vorerst so"; T_ISO_NEED="STROM_ISOLATED braucht eigene Ordner: STROM_INSTALL_DIR und STROM_CONFIG_DIR."; T_ISO="Isolierte Installation: nichts außerhalb dieser Ordner (kein PATH, keine Links, den Agenten nichts beigebracht). Start so" ;;
  *) T_OTHER="Note: the command strom starts another, older strom"; T_NPM_ASK="It came with npm. Remove it? (y/n) [y]"; T_NPM_HOW="Remove it with: npm uninstall -g strom-research"; T_OTHER_HOW="Delete it, or put before its folder in PATH this one"; T_DL="Downloading Strom research"; T_DL2=""; T_NODE="Downloading Node.js from nodejs.org"; T_BAD="The download is damaged (checksum mismatch) — try again."; T_OS="This installer is for macOS and Linux; on Windows use install.ps1."; T_CPU="Unsupported processor"; T_OK="Installed"; T_START="Next time start it with: strom"; T_NEW="Open a new terminal so that the strom command works everywhere."; T_RUN="In this terminal, run it as"; T_ISO_NEED="STROM_ISOLATED needs folders of its own: STROM_INSTALL_DIR and STROM_CONFIG_DIR."; T_ISO="Isolated installation: nothing outside these folders (no PATH, no links, nothing taught to the agents). Start it as" ;;
esac

if [ -n "$ISOLATED" ] && { [ -z "${STROM_INSTALL_DIR:-}" ] || [ -z "${STROM_CONFIG_DIR:-}" ]; }; then echo "$T_ISO_NEED"; exit 1; fi

os=$(uname -s)
arch=$(uname -m)
case "$os" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) echo "$T_OS"; exit 1 ;;
esac
case "$arch" in
  arm64 | aarch64) arch=arm64 ;;
  x86_64 | amd64) arch=x64 ;;
  *) echo "$T_CPU: $arch"; exit 1 ;;
esac

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fetch() {
  if command -v curl >/dev/null 2>&1; then curl -fsSL "$1" -o "$2"; else wget -qO "$2" "$1"; fi
}
sha() {
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | cut -d' ' -f1; else sha256sum "$1" | cut -d' ' -f1; fi
}
# check <file> <SHASUMS256.txt> <name>
check() {
  want=$(grep "  $3\$" "$2" | cut -d' ' -f1)
  if [ -z "$want" ] || [ "$want" != "$(sha "$1")" ]; then echo "$T_BAD"; exit 1; fi
}

fetch "$BASE/NODE_VERSION" "$tmp/NODE_VERSION"
fetch "$BASE/VERSION" "$tmp/VERSION"
want=$(tr -d ' \r\n' <"$tmp/NODE_VERSION")
version=$(tr -d ' \r\n' <"$tmp/VERSION")

# Node — the official build: the newest release of the line the release names
# ("24": security fixes included), or an exact version; only when it is not there yet.
case "$want" in
  *.*) ndir="$NODE_BASE/v$want" ;;
  *) ndir="$NODE_BASE/latest-v$want.x" ;;
esac
fetch "$ndir/SHASUMS256.txt" "$tmp/node-sums.txt"
name=$(grep -o "node-v[0-9][0-9.]*-$os-$arch\.tar\.gz" "$tmp/node-sums.txt" | head -n 1)
if [ -z "$name" ]; then echo "$T_BAD"; exit 1; fi
nv=${name#node-v}
nv=${nv%%-*}
node="$ROOT/node/bin/node"
if [ ! -x "$node" ] || [ "$("$node" --version 2>/dev/null || true)" != "v$nv" ]; then
  echo "$T_NODE ($nv, $os $arch)…"
  fetch "$ndir/$name" "$tmp/$name"
  check "$tmp/$name" "$tmp/node-sums.txt" "$name"
  tar -xzf "$tmp/$name" -C "$tmp"
  mkdir -p "$ROOT/node/bin"
  mv -f "$tmp/node-v$nv-$os-$arch/bin/node" "$node"
  chmod 755 "$node"
  cp "$tmp/node-v$nv-$os-$arch/LICENSE" "$ROOT/node/LICENSE" 2>/dev/null || true
fi

# strom's code.
echo "$T_DL ${version}${T_DL2}…"
fetch "$BASE/strom-app.tar.gz" "$tmp/strom-app.tar.gz"
fetch "$BASE/SHASUMS256.txt" "$tmp/SHASUMS256.txt"
check "$tmp/strom-app.tar.gz" "$tmp/SHASUMS256.txt" "strom-app.tar.gz"
tar -xzf "$tmp/strom-app.tar.gz" -C "$tmp"
rm -rf "$ROOT/app.old"
if [ -d "$ROOT/app" ]; then mv "$ROOT/app" "$ROOT/app.old"; fi
mv "$tmp/app" "$ROOT/app"
rm -rf "$ROOT/app.old"

# The command on PATH (in place of an older strom there), and what strom reads about its installation.
mkdir -p "$DEST"
rm -f "$DEST/strom"
cat >"$DEST/strom" <<EOF
#!/bin/sh
# Strom research: strom's code on its own Node, both in $ROOT
exec "$node" "$ROOT/app/dist/cli.js" "\$@"
EOF
chmod 755 "$DEST/strom"
# a JSON string (a folder may hold a quote or a backslash)
js() { printf '"%s"' "$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"; }
env_json=
add_env() { env_json="${env_json:+$env_json, }$(js "$1"): $(js "$2")"; }
if [ -n "${STROM_CONFIG_DIR:-}" ]; then add_env STROM_CONFIG_DIR "$STROM_CONFIG_DIR"; fi
if [ -n "$ISOLATED" ]; then add_env HOME "$HOME"; add_env STROM_ISOLATED 1; fi
{
  printf '{\n  "launchers": [%s],\n  "node": "%s",\n  "version": "%s"' "$(js "$DEST/strom")" "$nv" "$version"
  if [ -n "$env_json" ]; then printf ',\n  "env": {%s}' "$env_json"; fi
  printf '\n}\n'
} >"$ROOT/install.json"
echo "$T_OK: $DEST/strom"

# PATH for new terminals, once (an isolated installation: none — said how to start it).
onpath=1
case ":$PATH:" in
  *":$DEST:"*) ;;
  *) onpath= ;;
esac
if [ -z "$onpath" ] && [ -z "$ISOLATED" ]; then
  case "${SHELL:-}" in
    */fish)
      # fish reads neither .profile nor .bashrc: a file of its own in conf.d.
      rc="${XDG_CONFIG_HOME:-$HOME/.config}/fish/conf.d/strom.fish"
      mkdir -p "$(dirname "$rc")"
      printf '# strom research\nfish_add_path -g "%s"\n' "$DEST" >"$rc"
      ;;
    */zsh) rc="$HOME/.zshrc" ;;
    */bash) if [ "$os" = darwin ]; then rc="$HOME/.bash_profile"; else rc="$HOME/.bashrc"; fi ;;
    *) rc="$HOME/.profile" ;;
  esac
  if ! grep -qs "# strom research" "$rc"; then
    printf '\nexport PATH="%s:$PATH"  # strom research\n' "$DEST" >>"$rc"
  fi
  echo "$T_NEW"
fi
# Another strom first on PATH (an older one, from npm's global folder): `strom` would start that one in new
# terminals. Said; the one from npm taken away on the person's yes. (Not on PATH yet: new terminals put this first.)
if [ -n "$onpath" ] && [ -z "$ISOLATED" ]; then
  first=
  rest=$PATH
  while [ -n "$rest" ]; do
    d=${rest%%:*}
    case "$rest" in *:*) rest=${rest#*:} ;; *) rest= ;; esac
    if [ -n "$d" ] && [ -x "$d/strom" ] && [ ! -d "$d/strom" ]; then first="$d/strom"; break; fi
  done
  if [ -n "$first" ] && [ "$first" != "$DEST/strom" ]; then
    echo "$T_OTHER: $first"
    if command -v npm >/dev/null 2>&1 && npm ls -g strom-research >/dev/null 2>&1; then
      if [ -t 1 ] && [ -r /dev/tty ] && [ -z "${STROM_INSTALL_ONLY:-}" ]; then
        printf '%s ' "$T_NPM_ASK"
        read -r a </dev/tty || a=n
        case "$a" in [nN]*) echo "$T_NPM_HOW" ;; *) npm uninstall -g strom-research ;; esac
      else
        echo "$T_NPM_HOW"
      fi
    else
      echo "$T_OTHER_HOW: $DEST"
    fi
  fi
fi

# Start strom: its setup wizard (the terminal, even when this script came through a pipe).
# Run by an AI agent (no terminal): it is told the full path — its shell does not see the new PATH.
if [ -t 1 ] && [ -r /dev/tty ] && [ -z "${STROM_INSTALL_ONLY:-}" ]; then
  # Its input from the terminal's own device (/dev/ttys004, /dev/pts/3) — the one this script writes to —, never
  # /dev/tty: strom hands it on to the agent of a conversation, and on macOS a program that waits on its input
  # through kqueue never hears /dev/tty (Grok Build stood on a black screen in iTerm2, deaf to Ctrl-C too).
  term=/dev/tty
  { t=$(tty <&3 2>/dev/null || true); } 3>&1
  case "$t" in /dev/tty) ;; /dev/*) if [ -r "$t" ]; then term=$t; fi ;; esac
  # (STROM_INSTALLER: strom looks over what the setup put here when settings were kept from before)
  STROM_INSTALLER=1 "$DEST/strom" <"$term"
elif [ -n "$ISOLATED" ]; then
  echo "$T_ISO: $DEST/strom"
elif [ -z "$onpath" ]; then
  echo "$T_RUN: $DEST/strom"
else
  echo "$T_START"
fi
