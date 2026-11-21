# Gera o executável Windows de ALICE em dist\ALICE-win32-x64\ALICE.exe
# Faz o mesmo que o electron-packager, mas usa o descompactador do próprio Windows
# (o do packager trava em versões novas do Node.js).
# Uso: powershell -ExecutionPolicy Bypass -File tools\build-exe.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$version = (Get-Content node_modules\electron\package.json -Raw | ConvertFrom-Json).version
$zip = Get-ChildItem "$env:LOCALAPPDATA\electron\Cache" -Recurse -Filter "electron-v$version-win32-x64.zip" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $zip) {
  $zipPath = Join-Path $env:TEMP "electron-v$version-win32-x64.zip"
  Write-Host "Baixando Electron $version..."
  Invoke-WebRequest "https://github.com/electron/electron/releases/download/v$version/electron-v$version-win32-x64.zip" -OutFile $zipPath -UseBasicParsing
  $zip = Get-Item $zipPath
}

$out = Join-Path $root 'dist\ALICE-win32-x64'
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force $out | Out-Null
Write-Host "Extraindo $($zip.Name)..."
Expand-Archive -Path $zip.FullName -DestinationPath $out -Force

# app do jogo dentro de resources\app
$app = Join-Path $out 'resources\app'
Remove-Item (Join-Path $out 'resources\default_app.asar') -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $app, (Join-Path $app 'build') | Out-Null
Copy-Item index.html, style.css, electron-main.js -Destination $app
Copy-Item lib, src -Destination $app -Recurse
Copy-Item build\icon.ico -Destination (Join-Path $app 'build')
# package.json enxuto (sem dependências de desenvolvimento)
$pkg = Get-Content package.json -Raw | ConvertFrom-Json
[ordered]@{ name = $pkg.name; productName = $pkg.productName; version = $pkg.version; main = $pkg.main } | ConvertTo-Json | Set-Content (Join-Path $app 'package.json') -Encoding UTF8

# executável com nome, ícone e informações do jogo
$exe = Join-Path $out 'ALICE.exe'
Rename-Item (Join-Path $out 'electron.exe') 'ALICE.exe'
node tools\set-exe-info.mjs $exe build\icon.ico $pkg.version
if ($LASTEXITCODE -ne 0) { Write-Warning 'Não foi possível aplicar o ícone; o executável funciona com o ícone padrão.' }

# zip pronto para distribuir
$dist = Join-Path $root 'dist\ALICE-1.0.0-windows.zip'
if (Test-Path $dist) { Remove-Item $dist -Force }
Compress-Archive -Path $out -DestinationPath $dist -CompressionLevel Optimal
Write-Host "Pronto: $exe"
Write-Host "Zip:    $dist"
