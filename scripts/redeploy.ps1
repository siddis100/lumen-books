#Requires -Version 5.1
<#
  Redemarre le site sans passer par un commit.
  Utilise le build hook Netlify, qui declenche un build sur les serveurs
  Netlify (Linux) et bascule le deploiement quand il reussit.
#>

param(
    [int]$WaitSeconds = 420
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$netlify = Join-Path $env:APPDATA "npm\netlify.cmd"
$hook = "https://api.netlify.com/build_hooks/6abf92da9cc359185898718e"
$tmp = Join-Path $env:TEMP "opencode"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

Set-Location $root

Write-Host ""
Write-Host "  Declenchement du build Netlify..." -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest -Uri $hook -Method Post -UseBasicParsing -TimeoutSec 60
    Write-Host "  build hook -> HTTP $($r.StatusCode)" -ForegroundColor DarkGray
} catch {
    throw "build hook refuse : $($_.Exception.Message)"
}

$batch = Join-Path $tmp "redeploy.bat"
$out   = Join-Path $tmp "redeploy.txt"
@"
@echo off
"$netlify" api listSiteBuilds --data "{\"site_id\":\"cd5d6338-892b-4f97-b718-f1d447398fa9\",\"per_page\":1}" 1>"$out" 2>nul
"@ | Set-Content -Path $batch -Encoding ASCII

$deadline = (Get-Date).AddSeconds($WaitSeconds)
$lastState = ""
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 15
    if (Test-Path $out) { Remove-Item $out -Force -ErrorAction SilentlyContinue }
    cmd.exe /c $batch | Out-Null
    if (-not (Test-Path $out)) { continue }
    try { $build = (Get-Content $out -Raw | ConvertFrom-Json)[0] } catch { continue }
    if (-not $build) { continue }
    $state = "$($build.id)|$($build.deploy_state)"
    if ($state -ne $lastState) {
        Write-Host ("    {0,-12} {1}" -f $build.deploy_state, $build.id) -ForegroundColor DarkGray
        $lastState = $state
    }
    if ($build.deploy_state -in @("ready", "error", "failed")) {
        Remove-Item $out -Force -ErrorAction SilentlyContinue
        if ($build.deploy_state -eq "ready") {
            Write-Host "  Deploiement pret : https://lumen-books-852.netlify.app" -ForegroundColor Green
            exit 0
        }
        Write-Host "  ECHEC du build : $($build.error)" -ForegroundColor Red
        exit 1
    }
}

Write-Host "  Delai depasse sans verdict." -ForegroundColor Red
exit 1