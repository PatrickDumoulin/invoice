$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location $PSScriptRoot

& "C:\Program Files\nodejs\npm.cmd" run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build echoue - rien n'a ete deploye" -ForegroundColor Red
    exit 1
}

& "C:\Program Files\nodejs\npx.cmd" wrangler deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "Deploiement echoue - invoice.sonoria.ca n'est PAS a jour" -ForegroundColor Red
    exit 1
}

Write-Host "Build et deploiement termines - invoice.sonoria.ca est a jour" -ForegroundColor Green
