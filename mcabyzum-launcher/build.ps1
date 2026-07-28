$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

python -m pip install -r requirements.txt
python -m PyInstaller --noconfirm MCABYZUM.spec

$outExe = Join-Path $PSScriptRoot 'dist\MCABYZUM.exe'
if (-not (Test-Path $outExe)) {
  throw "No se generó dist\MCABYZUM.exe"
}

$assetsDir = Join-Path $PSScriptRoot '..\backend\src\assets\launcher\MCABYZUM-win'
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null
Copy-Item -Force $outExe (Join-Path $assetsDir 'MCABYZUM.exe')

Write-Host ""
Write-Host "Listo: backend\src\assets\launcher\MCABYZUM-win\MCABYZUM.exe (onefile)"
