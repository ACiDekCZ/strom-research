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
# STROM_DOWNLOAD_BASE, STROM_NODE_BASE: other places to download from;
# STROM_INSTALL_DIR: another folder for the command; STROM_PROGRAM_DIR: another
# folder for Node and strom.
set -eu

BASE="${STROM_DOWNLOAD_BASE:-https://github.com/ACiDekCZ/strom-research/releases/latest/download}"
NODE_BASE="${STROM_NODE_BASE:-https://nodejs.org/dist}"
DEST="${STROM_INSTALL_DIR:-$HOME/.local/bin}"
ROOT="${STROM_PROGRAM_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/strom}"

case "${LC_ALL:-${LANG:-}}" in
  cs*) T_DL="Stahuji Strom výzkum"; T_DL2=""; T_NODE="Stahuji Node.js z nodejs.org"; T_BAD="Stažený soubor je poškozený (kontrolní součet nesedí) – zkuste to znovu."; T_OS="Tento instalátor je pro macOS a Linux; na Windows použijte install.ps1."; T_CPU="Nepodporovaný procesor"; T_OK="Nainstalováno"; T_START="Příště spustíte příkazem: strom"; T_NEW="Otevřete nový terminál, aby příkaz strom fungoval všude."; T_RUN="V tomto terminálu ho zatím spustíte takto" ;;
  de*) T_DL="Strom Ahnenforschung"; T_DL2=" wird heruntergeladen"; T_NODE="Node.js wird von nodejs.org heruntergeladen"; T_BAD="Die Datei ist beschädigt (Prüfsumme stimmt nicht) – bitte versuchen Sie es erneut."; T_OS="Dieses Installationsprogramm ist für macOS und Linux; unter Windows nehmen Sie install.ps1."; T_CPU="Nicht unterstützter Prozessor"; T_OK="Installiert"; T_START="Nächstes Mal starten Sie es mit: strom"; T_NEW="Öffnen Sie ein neues Terminal, damit der Befehl strom überall funktioniert."; T_RUN="In diesem Terminal starten Sie es vorerst so" ;;
  *) T_DL="Downloading Strom research"; T_DL2=""; T_NODE="Downloading Node.js from nodejs.org"; T_BAD="The download is damaged (checksum mismatch) — please try again."; T_OS="This installer is for macOS and Linux; on Windows use install.ps1."; T_CPU="Unsupported processor"; T_OK="Installed"; T_START="Next time start it with: strom"; T_NEW="Open a new terminal so that the strom command works everywhere."; T_RUN="In this terminal, run it as" ;;
esac

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
printf '{\n  "launchers": ["%s"],\n  "node": "%s",\n  "version": "%s"\n}\n' "$DEST/strom" "$nv" "$version" >"$ROOT/install.json"
echo "$T_OK: $DEST/strom"

# PATH for new terminals, once.
onpath=1
case ":$PATH:" in
  *":$DEST:"*) ;;
  *)
    onpath=
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
    ;;
esac
# Start strom: its setup wizard (the terminal, even when this script came through a pipe).
# Run by an AI agent (no terminal): it is told the full path — its shell does not see the new PATH.
if [ -t 1 ] && [ -r /dev/tty ] && [ -z "${STROM_INSTALL_ONLY:-}" ]; then
  "$DEST/strom" </dev/tty
elif [ -z "$onpath" ]; then
  echo "$T_RUN: $DEST/strom"
else
  echo "$T_START"
fi
