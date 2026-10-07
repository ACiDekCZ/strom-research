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
# STROM_CHANNEL: the versions to take (the newest of every release, prereleases too, by semver from GitHub's list
# of releases — STROM_RELEASES_API: another address or a file; STROM_RELEASE_DOWNLOAD: where the releases' folders
# are), kept in install.json for strom update;
# STROM_INSTALL_DIR: another folder.
# STROM_ISOLATED=1: a second strom beside the person's own, to try a version — with STROM_INSTALL_DIR and
# STROM_CONFIG_DIR of its own, nothing outside them: the user's PATH untouched, nothing of another strom
# touched; strom then registers no links and teaches the agents nothing. What the installation was installed
# with (STROM_CONFIG_DIR, HOME; STROM_ISOLATED, STROM_COMMAND) is kept in install.json: every start of it takes it.
# STROM_COMMAND=strom-<letters, digits>: an isolated installation's own command beside the person's strom
# (strom-next): strom-next.cmd and strom-next (Git Bash) in its folder's bin, which goes on the user's PATH — never
# when a command of that name is there already from elsewhere; its research folder <Documents>\Strom <suffix>, its own
# links (strom-research-<suffix>://) on the person's yes. strom uninstall of it takes them and the PATH entry.
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
# a second installation's own command (strom-next), in a folder of its own on the user's PATH
$command = if ($env:STROM_COMMAND) { $env:STROM_COMMAND } else { $null }
$bin = Join-Path $dest 'bin'
$channel = if ($env:STROM_CHANNEL -and $env:STROM_CHANNEL.Trim() -eq 'beta') { 'beta' } else { $null }
if ($isolated -and (-not $env:STROM_INSTALL_DIR -or -not $env:STROM_CONFIG_DIR)) {
  throw (T 'STROM_ISOLATED needs folders of its own: STROM_INSTALL_DIR and STROM_CONFIG_DIR.' 'STROM_ISOLATED potřebuje vlastní složky: STROM_INSTALL_DIR a STROM_CONFIG_DIR.' 'STROM_ISOLATED braucht eigene Ordner: STROM_INSTALL_DIR und STROM_CONFIG_DIR.')
}
if ($command) {
  if (-not $isolated) { throw (T 'STROM_COMMAND is for an isolated installation only: STROM_ISOLATED=1 with its own STROM_INSTALL_DIR and STROM_CONFIG_DIR.' 'STROM_COMMAND je jen pro izolovanou instalaci: STROM_ISOLATED=1 s vlastními STROM_INSTALL_DIR a STROM_CONFIG_DIR.' 'STROM_COMMAND gibt es nur für eine isolierte Installation: STROM_ISOLATED=1 mit eigenem STROM_INSTALL_DIR und STROM_CONFIG_DIR.') }
  # (\z, never $: .NET's $ lets a line break through at the end)
  if ($command -cnotmatch '^strom-[a-z0-9]{1,20}\z') { throw ((T 'STROM_COMMAND is strom-<lowercase letters and digits, at most 20>, e.g. strom-next' 'STROM_COMMAND má tvar strom-<malá písmena a číslice, nejvýš 20>, např. strom-next' 'STROM_COMMAND hat die Form strom-<Kleinbuchstaben und Ziffern, höchstens 20>, z. B. strom-next') + ": $command") }
  # a command of that name from elsewhere (another installation's, the person's own): never shadowed or overwritten
  $there = Get-Command $command -All -ErrorAction SilentlyContinue | Where-Object { $_.Source -and ((Split-Path -Parent $_.Source).TrimEnd('\') -ine $bin.TrimEnd('\')) } | Select-Object -First 1
  if ($there) { throw ((T 'The command is there already, written by another installation - nothing is overwritten. Another name, or remove first' 'Příkaz už existuje a zapsala ho jiná instalace – nic se nepřepisuje. Zvolit jiný název, nebo nejdřív odebrat' 'Der Befehl existiert schon, von einer anderen Installation geschrieben – nichts wird überschrieben. Einen anderen Namen wählen oder zuerst entfernen') + ": $($there.Source)") }
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
# Semver precedence of two tags (v1.3.0-beta.10 > v1.3.0-beta.2, v1.3.0-rc.1 > v1.3.0-beta.9, v1.3.0 > v1.3.0-rc.1).
function Compare-Version($a, $b) {
  $x = $a.TrimStart('v') -split '-', 2
  $y = $b.TrimStart('v') -split '-', 2
  $xm = $x[0].Split('.'); $ym = $y[0].Split('.')
  for ($i = 0; $i -lt 3; $i++) { $p = [long]$xm[$i]; $q = [long]$ym[$i]; if ($p -ne $q) { return [Math]::Sign($p - $q) } }
  $xp = if ($x.Count -gt 1) { $x[1] } else { '' }
  $yp = if ($y.Count -gt 1) { $y[1] } else { '' }
  if (-not $xp -or -not $yp) { if ($xp -eq $yp) { return 0 }; if (-not $xp) { return 1 }; return -1 }
  $xs = $xp.Split('.'); $ys = $yp.Split('.')
  for ($i = 0; $i -lt [Math]::Min($xs.Count, $ys.Count); $i++) {
    $p = $xs[$i]; $q = $ys[$i]
    if ($p -ceq $q) { continue }
    $pn = $p -match '^\d+$'; $qn = $q -match '^\d+$'
    if ($pn -and $qn) { return [Math]::Sign([long]$p - [long]$q) }
    if ($pn -ne $qn) { if ($pn) { return -1 }; return 1 }
    if ([string]::CompareOrdinal($p, $q) -gt 0) { return 1 }; return -1
  }
  [Math]::Sign($xs.Count - $ys.Count)
}
# The newest of every release by semver (prereleases too; drafts never), from GitHub's list of releases.
function Get-NewestTag($releases) {
  $best = $null
  foreach ($r in @($releases)) {
    if (-not $r -or $r.draft -eq $true) { continue }
    $tag = [string]$r.tag_name
    if ($tag -cnotmatch '^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$') { continue }
    if (-not $best -or (Compare-Version $tag $best) -gt 0) { $best = $tag }
  }
  $best
}
# Text files as UTF-8 without a BOM (Windows PowerShell 5.1 would add one).
function Write-Text($path, $text) { [IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding $false)) }

$tmp = Join-Path ([IO.Path]::GetTempPath()) ('strom-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  if ($channel -eq 'beta' -and -not $env:STROM_DOWNLOAD_BASE) {
    $api = if ($env:STROM_RELEASES_API) { $env:STROM_RELEASES_API } else { 'https://api.github.com/repos/ACiDekCZ/strom-research/releases?per_page=30' }
    # (GitHub answers no request without a User-Agent)
    $releases = if ($api -like '*://*' -and $api -notlike 'file://*') { Invoke-RestMethod -UseBasicParsing -Uri $api -Headers @{ 'User-Agent' = 'strom-research-installer'; 'Accept' = 'application/vnd.github+json' } }
      else { [IO.File]::ReadAllText($(if ($api -like 'file://*') { ([Uri]$api).LocalPath } else { $api })) | ConvertFrom-Json }
    $tag = Get-NewestTag $releases
    if (-not $tag) { throw (T 'No release could be found - try again later.' 'Nepodařilo se najít žádné vydání – zkusit to později.' 'Es ließ sich keine Version finden – später erneut versuchen.') }
    $dl = if ($env:STROM_RELEASE_DOWNLOAD) { $env:STROM_RELEASE_DOWNLOAD } else { 'https://github.com/ACiDekCZ/strom-research/releases/download' }
    $base = "$dl/$tag"
  }
  Get-File "$base/NODE_VERSION" (Join-Path $tmp 'NODE_VERSION')
  Get-File "$base/VERSION" (Join-Path $tmp 'VERSION')
  $want = (Get-Content (Join-Path $tmp 'NODE_VERSION') -Raw).Trim()
  $version = (Get-Content (Join-Path $tmp 'VERSION') -Raw).Trim()
  New-Item -ItemType Directory -Force -Path (Join-Path $dest 'node') | Out-Null

  # tar: the system's own (bsdtar, Windows 10 and later) — with Git's usr\bin first on PATH (started from Git Bash)
  # tar.exe would be GNU tar, which reads C:\… as a remote host and fails; PATH's only where the system has none
  $tar = if ($env:SystemRoot) { Join-Path $env:SystemRoot 'System32\tar.exe' } else { '' }
  if (-not $tar -or -not (Test-Path $tar)) { $tar = 'tar.exe' }

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
    & $tar -xf (Join-Path $tmp $name) -C $tmp
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
  & $tar -xzf (Join-Path $tmp 'strom-app.tar.gz') -C $tmp
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
  # a second installation's own command: the same two, one folder down (bin, on the user's PATH)
  if ($command) {
    New-Item -ItemType Directory -Force -Path $bin | Out-Null
    Write-Text (Join-Path $bin "$command.cmd") "@echo off`r`n`"%~dp0..\node\node.exe`" `"%~dp0..\app\dist\cli.js`" %*`r`n"
    Write-Text (Join-Path $bin $command) "#!/bin/sh`nd=`$(cd `"`$(dirname `"`$0`")/..`" && pwd)`nexec `"`$d/node/node.exe`" `"`$d/app/dist/cli.js`" `"`$@`"`n"
    $info.launchers = @($info.launchers) + @((Join-Path $bin "$command.cmd"), (Join-Path $bin $command))
  }
  if ($channel) { $info.channel = $channel }
  if ($command) { $info.command = $command }
  # what it was installed with, for every start of it (a link, the shortcut): only what was set
  $own = [ordered]@{}
  if ($env:STROM_CONFIG_DIR) { $own.STROM_CONFIG_DIR = $env:STROM_CONFIG_DIR }
  if ($env:HOME) { $own.HOME = $env:HOME }
  if ($isolated) { $own.STROM_ISOLATED = '1' }
  if ($command) { $own.STROM_COMMAND = $command }
  if ($own.Count) { $info.env = $own }
  Write-Text (Join-Path $dest 'install.json') (($info | ConvertTo-Json) + "`n")
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

function Test-Here($p) { $p -and ($p.TrimEnd('\') -ieq $dest.TrimEnd('\')) }
$cmd = Join-Path $dest 'strom.cmd'
if ($command) {
  # its own folder of commands on the user's PATH (after the person's own: strom stays theirs)
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $parts = @(($userPath -split ';') | Where-Object { $_ })
  if (-not ($parts | Where-Object { $_.TrimEnd('\') -ieq $bin.TrimEnd('\') })) { [Environment]::SetEnvironmentVariable('Path', ((@($parts) + @($bin)) -join ';'), 'User') }
  if (-not (($env:Path -split ';') | Where-Object { $_ -and $_.TrimEnd('\') -ieq $bin.TrimEnd('\') })) { $env:Path = "$env:Path;$bin" }
  Write-Host ((T 'A second installation beside the regular strom: its own folders and settings. Start it with the command' 'Druhá instalace vedle běžného stromu: vlastní složky a nastavení. Spouští se příkazem' 'Zweite Installation neben dem regulären strom: eigene Ordner und Einstellungen. Start mit dem Befehl') + ": $command")
} elseif ($isolated) {
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
