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
# STROM_DOWNLOAD_BASE, STROM_NODE_BASE: other places to download from;
# STROM_INSTALL_DIR: another folder.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$base = if ($env:STROM_DOWNLOAD_BASE) { $env:STROM_DOWNLOAD_BASE } else { 'https://github.com/ACiDekCZ/strom-research/releases/latest/download' }
$nodeBase = if ($env:STROM_NODE_BASE) { $env:STROM_NODE_BASE } else { 'https://nodejs.org/dist' }
$dest = if ($env:STROM_INSTALL_DIR) { $env:STROM_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\Strom' }

$lang = (Get-Culture).TwoLetterISOLanguageName
function T($en, $czech, $german) { if ($lang -eq 'cs') { $czech } elseif ($lang -eq 'de') { $german } else { $en } }

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
  $got = (Get-FileHash $file -Algorithm SHA256).Hash.ToLower()
  if (-not $want -or $want -ne $got) { throw (T 'The download is damaged (checksum mismatch) - please try again.' 'Stažený soubor je poškozený (kontrolní součet nesedí) – zkuste to znovu.' 'Die Datei ist beschädigt (Prüfsumme stimmt nicht) – bitte versuchen Sie es erneut.') }
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
  Write-Text (Join-Path $dest 'install.json') (($info | ConvertTo-Json) + "`n")
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

# PATH for the user, once (new windows see it; this one gets it now).
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not (($userPath -split ';') -contains $dest)) {
  [Environment]::SetEnvironmentVariable('Path', ((@($userPath, $dest) | Where-Object { $_ }) -join ';'), 'User')
}
if (-not (($env:Path -split ';') -contains $dest)) { $env:Path = "$env:Path;$dest" }
Write-Host ((T 'Installed' 'Nainstalováno' 'Installiert') + ": $(Join-Path $dest 'strom.cmd')")

# Start strom: its setup wizard.
if (-not $env:STROM_INSTALL_ONLY) { & (Join-Path $dest 'strom.cmd') } else { Write-Host (T 'Next time start it with: strom' 'Příště spustíte příkazem: strom' 'Nächstes Mal starten Sie es mit: strom') }
