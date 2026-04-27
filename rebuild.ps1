$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location $PSScriptRoot
& "C:\Program Files\nodejs\npm.cmd" run build
Write-Host "Build termine - invoice.sonoria.ca est a jour" -ForegroundColor Green
