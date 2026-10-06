# Strom research — installer for Windows (PowerShell):
#   irm <this file's address> | iex
# strom is JavaScript on Node. This takes the official Node from nodejs.org
# (signed by its makers, checked against nodejs.org's SHASUMS256.txt) and
# strom's code from the project's release (checked against the release's
# SHASUMS256.txt), puts both into %LOCALAPPDATA%\Programs\Strom with the
# commands `strom` (strom.cmd; and `strom` for Git Bash), adds that folder to
# the user's PATH and starts strom — its setup wizard takes over.
# No admin rights; nothing downloaded is a program of ours: strom's code is
# plain JavaScript anyone can read.
# STROM_FROM: a family tree of the Strom app (the line the app shows sets it; one variable, as Win+R takes 259
# characters) — strom set up, that tree becomes a research of its own:
#   powershell -ExecutionPolicy Bypass -c "si env:STROM_FROM '1|<mark>|<browser>|<file>|<app>|<name>'; irm <this file's address> | iex"
# (si = Set-Item, with no $: the same line works from Win+R, cmd and pasted into an open PowerShell, which would
# expand a "$env:…" of its own to nothing before the inner one ever sees it). Every field but the mark may be empty:
# the browser the app runs in (chrome, edge, firefox, safari, mobile…) — strom opens the app there; the 8 characters
# of the file the app saved the tree in (strom-prenos-<…>.json: a browser the app cannot reach strom from) — it moves
# to one that can, on the person's word; another copy of the app (beta, or its address) — strom keeps it
# (strom.app.url); the tree's name in the app — the research's suggested name (a ' doubled: '').
# The line of an older app, read the same when STROM_FROM is not set: STROM_FROM_APP, STROM_FROM_BROWSER,
# STROM_FROM_FILE, STROM_APP_URL, STROM_FROM_APP_NAME.
# STROM_DOWNLOAD_BASE, STROM_NODE_BASE: other places to download from;
# STROM_INSTALL_DIR: another folder.
# STROM_ISOLATED=1: a second strom beside the person's own, to try a version — with STROM_INSTALL_DIR and
# STROM_CONFIG_DIR of its own, nothing outside them: the user's PATH untouched, nothing of another strom
# touched; strom then registers no links and teaches the agents nothing. What the installation was installed
# with (STROM_CONFIG_DIR, HOME; STROM_ISOLATED) is kept in install.json: every start of it takes it.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$base = if ($env:STROM_DOWNLOAD_BASE) { $env:STROM_DOWNLOAD_BASE } else { 'https://github.com/ACiDekCZ/strom-research/releases/latest/download' }
$nodeBase = if ($env:STROM_NODE_BASE) { $env:STROM_NODE_BASE } else { 'https://nodejs.org/dist' }
$dest = if ($env:STROM_INSTALL_DIR) { $env:STROM_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\Strom' }

# the language strom is told (STROM_LANG, as strom itself reads it), else the system's
$lang = if ($env:STROM_LANG) { ($env:STROM_LANG -split '[-_.]')[0].ToLower() } else { (Get-Culture).TwoLetterISOLanguageName }
# Windows PowerShell 5.1 may read this script in another code page — `irm` of a file served with no charset as
# ISO-8859-1, a file with no BOM in the system's ANSI code page — so "výzkum" would come out as "vÃ½zkum". The probe
# (two letters: "…" tells ISO-8859-1 from Windows-1252) says how it was read; T puts each text back: only what reads
# as UTF-8 bytes in that code page (a path the system gave, correct as it is, stays).
$probe = 'ý…'
$misread = $null
if ($probe.Length -ne 2) {
  foreach ($cp in @(28591, 1252, [Text.Encoding]::Default.CodePage)) {
    try { $e = [Text.Encoding]::GetEncoding($cp) } catch { continue }
    if ([Text.Encoding]::UTF8.GetString($e.GetBytes($probe)) -eq ([string][char]0xFD + [char]0x2026)) { $misread = $e; break }
  }
}
$utf8Strict = New-Object Text.UTF8Encoding($false, $true)
function Undo-Misread($s) {
  if (-not $misread -or -not $s) { return $s }
  $out = New-Object Text.StringBuilder
  $run = New-Object Collections.Generic.List[byte]
  $raw = ''
  foreach ($c in (([string]$s).ToCharArray() + [char]0)) {
    # (assigned straight: an if around it would unroll the byte[] into a scalar)
    $b = $null
    if ($c -ne [char]0) { $b = $misread.GetBytes([string]$c) }
    if ($null -ne $b -and $b.Length -eq 1 -and $b[0] -ge 0x80 -and $misread.GetString($b) -eq [string]$c) { $run.Add($b[0]); $raw += $c; continue }
    if ($run.Count) {
      try { [void]$out.Append($utf8Strict.GetString($run.ToArray())) } catch { [void]$out.Append($raw) }
      $run.Clear(); $raw = ''
    }
    if ($c -ne [char]0) { [void]$out.Append($c) }
  }
  $out.ToString()
}
function T($en, $czech, $german) { Undo-Misread $(if ($lang -eq 'cs') { $czech } elseif ($lang -eq 'de') { $german } else { $en }) }

$isolated = $env:STROM_ISOLATED -eq '1'
if ($isolated -and (-not $env:STROM_INSTALL_DIR -or -not $env:STROM_CONFIG_DIR)) {
  throw (T 'STROM_ISOLATED needs folders of its own: STROM_INSTALL_DIR and STROM_CONFIG_DIR.' 'STROM_ISOLATED potřebuje vlastní složky: STROM_INSTALL_DIR a STROM_CONFIG_DIR.' 'STROM_ISOLATED braucht eigene Ordner: STROM_INSTALL_DIR und STROM_CONFIG_DIR.')
}

if (-not [Environment]::Is64BitOperatingSystem) { throw (T 'Strom research needs 64-bit Windows.' 'Strom výzkum potřebuje 64bitová Windows.' 'Strom Ahnenforschung braucht 64-Bit-Windows.') }
$cpu = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'x64' }
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

function Get-File($url, $out) {
  if ($url -like 'file://*') { Copy-Item -LiteralPath ([Uri]$url).LocalPath -Destination $out }
  else { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $out }
}
function Test-Sum($file, $sums, $name) {
  $line = Get-Content $sums | Where-Object { $_ -like "*  $name" } | Select-Object -First 1
  $want = if ($line) { $line.Split(' ')[0].ToLower() } else { '' }
  # SHA-256 by .NET, never Get-FileHash: in Windows PowerShell 5.1 that one comes from a script module (.psm1), which
  # the execution policy Restricted (Windows' own) keeps from loading — the line needs no -ExecutionPolicy Bypass then
  $sha = [Security.Cryptography.SHA256]::Create()
  $in = [IO.File]::OpenRead($file)
  try { $got = -join ($sha.ComputeHash($in) | ForEach-Object { $_.ToString('x2') }) } finally { $in.Dispose(); $sha.Dispose() }
  if (-not $want -or $want -ne $got) { throw (T 'The download is damaged (checksum mismatch) - try again.' 'Stažený soubor je poškozený (kontrolní součet nesedí) – zkusit to znovu.' 'Die Datei ist beschädigt (Prüfsumme stimmt nicht) – erneut versuchen.') }
}
# Text files as UTF-8 without a BOM (Windows PowerShell 5.1 would add one).
function Write-Text($path, $text) { [IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding $false)) }

$tmp = Join-Path ([IO.Path]::GetTempPath()) ('strom-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  Get-File "$base/NODE_VERSION" (Join-Path $tmp 'NODE_VERSION')
  Get-File "$base/VERSION" (Join-Path $tmp 'VERSION')
  $want = (Get-Content (Join-Path $tmp 'NODE_VERSION') -Raw).Trim()
  $version = (Get-Content (Join-Path $tmp 'VERSION') -Raw).Trim()
  New-Item -ItemType Directory -Force -Path (Join-Path $dest 'node') | Out-Null

  # Node — the official build: the newest release of the line the release names
  # ("24": security fixes included), or an exact version; only when it is not there yet.
  $ndir = if ($want -match '\.') { "$nodeBase/v$want" } else { "$nodeBase/latest-v$want.x" }
  Get-File "$ndir/SHASUMS256.txt" (Join-Path $tmp 'node-sums.txt')
  $found = Select-String -Path (Join-Path $tmp 'node-sums.txt') -Pattern "node-v(\d+\.\d+\.\d+)-win-$cpu\.zip" | Select-Object -First 1
  if (-not $found) { throw (T "nodejs.org has no Node $want for this computer." "Na nodejs.org není Node $want pro tento počítač." "Auf nodejs.org gibt es kein Node $want für diesen Computer.") }
  $name = $found.Matches[0].Value
  $nv = $found.Matches[0].Groups[1].Value
  $node = Join-Path $dest 'node\node.exe'
  $have = if (Test-Path $node) { (& $node --version) 2>$null } else { '' }
  if ($have -ne "v$nv") {
    Write-Host (T "Downloading Node.js from nodejs.org ($nv, $cpu)…" "Stahuji Node.js z nodejs.org ($nv, $cpu)…" "Node.js wird von nodejs.org heruntergeladen ($nv, $cpu)…")
    Get-File "$ndir/$name" (Join-Path $tmp $name)
    Test-Sum (Join-Path $tmp $name) (Join-Path $tmp 'node-sums.txt') $name
    & tar.exe -xf (Join-Path $tmp $name) -C $tmp
    if ($LASTEXITCODE -ne 0) { throw (T 'The download could not be unpacked.' 'Stažený soubor se nepodařilo rozbalit.' 'Die Datei ließ sich nicht entpacken.') }
    $unpacked = Join-Path $tmp "node-v$nv-win-$cpu"
    # A running node.exe cannot be overwritten, but it can be moved aside.
    $old = Join-Path $dest 'node\node.old.exe'
    Remove-Item -Force $old -ErrorAction SilentlyContinue
    if (Test-Path $node) { Move-Item -Force $node $old }
    Copy-Item -Force (Join-Path $unpacked 'node.exe') $node
    Copy-Item -Force (Join-Path $unpacked 'LICENSE') (Join-Path $dest 'node\LICENSE') -ErrorAction SilentlyContinue
    Remove-Item -Force $old -ErrorAction SilentlyContinue
  }

  # strom's code (tar is part of Windows 10 and later).
  Write-Host (T "Downloading Strom research $($version)…" "Stahuji Strom výzkum $($version)…" "Strom Ahnenforschung $($version) wird heruntergeladen…")
  Get-File "$base/strom-app.tar.gz" (Join-Path $tmp 'strom-app.tar.gz')
  Get-File "$base/SHASUMS256.txt" (Join-Path $tmp 'SHASUMS256.txt')
  Test-Sum (Join-Path $tmp 'strom-app.tar.gz') (Join-Path $tmp 'SHASUMS256.txt') 'strom-app.tar.gz'
  & tar.exe -xzf (Join-Path $tmp 'strom-app.tar.gz') -C $tmp
  if ($LASTEXITCODE -ne 0) { throw (T 'The download could not be unpacked.' 'Stažený soubor se nepodařilo rozbalit.' 'Die Datei ließ sich nicht entpacken.') }
  $app = Join-Path $dest 'app'
  Remove-Item -Recurse -Force (Join-Path $dest 'app.old') -ErrorAction SilentlyContinue
  if (Test-Path $app) { Move-Item -Force $app (Join-Path $dest 'app.old') }
  Move-Item -Force (Join-Path $tmp 'app') $app
  Remove-Item -Recurse -Force (Join-Path $dest 'app.old') -ErrorAction SilentlyContinue

  # The commands: strom.cmd for PowerShell and cmd, strom for Git Bash (what agents often use).
  Write-Text (Join-Path $dest 'strom.cmd') "@echo off`r`n`"%~dp0node\node.exe`" `"%~dp0app\dist\cli.js`" %*`r`n"
  Write-Text (Join-Path $dest 'strom') "#!/bin/sh`nd=`$(cd `"`$(dirname `"`$0`")`" && pwd)`nexec `"`$d/node/node.exe`" `"`$d/app/dist/cli.js`" `"`$@`"`n"
  # An older strom (a single strom.exe) goes.
  Remove-Item -Force (Join-Path $dest 'strom.exe') -ErrorAction SilentlyContinue
  $info = [ordered]@{ launchers = @((Join-Path $dest 'strom.cmd'), (Join-Path $dest 'strom')); node = $nv; version = $version }
  # what it was installed with, for every start of it (a link, the shortcut): only what was set
  $own = [ordered]@{}
  if ($env:STROM_CONFIG_DIR) { $own.STROM_CONFIG_DIR = $env:STROM_CONFIG_DIR }
  if ($env:HOME) { $own.HOME = $env:HOME }
  if ($isolated) { $own.STROM_ISOLATED = '1' }
  if ($own.Count) { $info.env = $own }
  Write-Text (Join-Path $dest 'install.json') (($info | ConvertTo-Json) + "`n")
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

function Test-Here($p) { $p -and ($p.TrimEnd('\') -ieq $dest.TrimEnd('\')) }
$cmd = Join-Path $dest 'strom.cmd'
if ($isolated) {
  # nothing outside its folders: started by its full path
  Write-Host (T "Isolated installation: nothing outside these folders (no PATH, no links, nothing taught to the agents). Start it as: & `"$cmd`"" "Izolovaná instalace: nic mimo tyto složky (žádný PATH, odkazy ani učení agentů). Spouští se takto: & `"$cmd`"" "Isolierte Installation: nichts außerhalb dieser Ordner (kein PATH, keine Links, den Agenten nichts beigebracht). Start so: & `"$cmd`"")
} else {
  # PATH for the user: this folder first (new windows see it; this one gets it now). An older strom further on it
  # (from npm: %APPDATA%\npm, which npm puts on the user's PATH too) would else be the one `strom` starts.
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $parts = @(($userPath -split ';') | Where-Object { $_ })
  if (-not ($parts.Count -and (Test-Here $parts[0]))) {
    [Environment]::SetEnvironmentVariable('Path', ((@($dest) + @($parts | Where-Object { -not (Test-Here $_) })) -join ';'), 'User')
  }
  $env:Path = (@($dest) + @(($env:Path -split ';') | Where-Object { $_ -and -not (Test-Here $_) })) -join ';'
  Write-Host ((T 'Installed' 'Nainstalováno' 'Installiert') + ": $(Join-Path $dest 'strom.cmd')")

  # Another strom still first (the system's PATH comes before the user's): said; the one from npm taken away on a yes.
  $first = Get-Command strom -All -ErrorAction SilentlyContinue | Where-Object { $_.Source } | Select-Object -First 1
  if ($first -and -not (Test-Here (Split-Path -Parent $first.Source))) {
    Write-Host (T "Note: the command strom starts another, older strom: $($first.Source)" "Pozor: příkaz strom spouští jiný, starší strom: $($first.Source)" "Achtung: der Befehl strom startet ein anderes, älteres strom: $($first.Source)")
    # npm.cmd, never npm.ps1 (a script the execution policy may block); its errors are not ours to stop on
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue | Select-Object -First 1
    $fromNpm = $false
    if ($npm) {
      $was = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
      try { $fromNpm = [bool]((& $npm.Source ls -g strom-research 2>&1 | Out-String) -match 'strom-research@') } catch { $fromNpm = $false }
      $ErrorActionPreference = $was
    }
    if ($fromNpm) {
      $ask = -not $env:STROM_INSTALL_ONLY -and -not [Console]::IsInputRedirected
      $a = if ($ask) { Read-Host (T 'It came with npm. Remove it? (y/n) [y]' 'Je nainstalovaný přes npm. Odebrat ho? (a/n) [a]' 'Es kam mit npm. Entfernen? (j/n) [j]') } else { 'n' }
      if ($a -match '^\s*(n|ne|no|nein)\s*$') { Write-Host (T 'Remove it with: npm uninstall -g strom-research' 'Odebrat příkazem: npm uninstall -g strom-research' 'Entfernen mit: npm uninstall -g strom-research') }
      else {
        $was = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        & $npm.Source uninstall -g strom-research
        $ErrorActionPreference = $was
      }
    } else { Write-Host (T "Delete it, or put $dest before its folder in PATH." "Smazat ho, nebo dát $dest v PATH před jeho složku." "Löschen oder $dest im PATH vor seinen Ordner setzen.") }
  }
}

# Start strom: its setup wizard.
# (STROM_INSTALLER: strom looks over what the setup put here when settings were kept from before)
if (-not $env:STROM_INSTALL_ONLY) { $env:STROM_INSTALLER = '1'; & $cmd; Remove-Item Env:STROM_INSTALLER -ErrorAction SilentlyContinue } elseif (-not $isolated) { Write-Host (T 'Next time start it with: strom' 'Příště se spouští příkazem: strom' 'Nächstes Mal startet es mit: strom') }
