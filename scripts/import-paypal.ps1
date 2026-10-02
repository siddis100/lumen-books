#Requires -Version 5.1
<#
  Importe les cles PayPal Sandbox dans Netlify + .env.local

  Les valeurs ne sont jamais ecrites dans la sortie ni dans l'historique :
  elles sont saisies au clavier, poussees a Netlify, puis ecrites dans
  .env.local. Ce script est sur dans le depot, il ne contient aucun secret.

  Usage :  powershell -ExecutionPolicy Bypass -File scripts\import-paypal.ps1
#>

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$netlify = Join-Path $env:APPDATA "npm\netlify.cmd"
$envFile = Join-Path $root ".env.local"

if (-not (Test-Path $netlify)) {
    throw "netlify-cli introuvable. Lance : npm install -g netlify-cli"
}
if (-not (Test-Path $envFile)) {
    throw ".env.local introuvable a la racine du projet."
}

function Ask-Secret([string]$label, [string]$hint) {
    Write-Host ""
    Write-Host "  $label" -ForegroundColor Cyan
    Write-Host "  $hint" -ForegroundColor DarkGray
    $secure = Read-Host "  > " -AsSecureString
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $plain = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    $plain = $plain.Trim()
    if ([string]::IsNullOrWhiteSpace($plain)) {
        throw "Valeur vide pour $label."
    }
    if ($plain.Length -lt 10) {
        throw "Valeur trop courte pour $label (min 10 caracteres)."
    }
    return $plain
}

function Test-Placeholder([string]$value, [string]$name) {
    if ($value -match '(?i)^(x+|your|placeholder|changeme|changeme-to|8UQ|AYx|EXx|re_x)') {
        throw "$name ressemble encore a un placeholder : $value"
    }
}

Write-Host ""
Write-Host "  Import des cles PayPal Sandbox" -ForegroundColor Green
Write-Host "  Source : https://developer.paypal.com/dashboard/applications/sandbox" -ForegroundColor DarkGray
Write-Host "  Onglet Sandbox -> REST apps -> ton app -> Client ID / Secret" -ForegroundColor DarkGray
Write-Host "  Onglet Webhooks -> Add webhook -> Webhook ID" -ForegroundColor DarkGray

$clientId     = Ask-Secret "PAYPAL_CLIENT_ID" "ex. AY1Ab2Cd3Ef4Gh5Ij6"
$clientSecret = Ask-Secret "PAYPAL_CLIENT_SECRET" "ex. EX1Ab2Cd3Ef4Gh5Ij6"
$webhookId    = Ask-Secret "PAYPAL_WEBHOOK_ID" "ex. 8UQ1234567890"

Test-Placeholder $clientId     "PAYPAL_CLIENT_ID"
Test-Placeholder $clientSecret "PAYPAL_CLIENT_SECRET"
Test-Placeholder $webhookId    "PAYPAL_WEBHOOK_ID"

$publicId = $clientId
$values = [ordered]@{
    PAYPAL_CLIENT_ID           = $clientId
    PAYPAL_CLIENT_SECRET       = $clientSecret
    NEXT_PUBLIC_PAYPAL_CLIENT_ID = $publicId
    PAYPAL_WEBHOOK_ID          = $webhookId
    PAYPAL_ENV                 = "sandbox"
    NEXT_PUBLIC_PAYPAL_ENV     = "sandbox"
}

# ---------------------------------------------------------------- Netlify
Write-Host ""
Write-Host "  Poussage vers Netlify..." -ForegroundColor Cyan
$env:NODE_OPTIONS = $env:NODE_OPTIONS
foreach ($key in $values.Keys) {
    $isPublic = $key.StartsWith("NEXT_PUBLIC_")
    & $netlify env:set $key $values[$key] --force --context production 2>&1 |
        Where-Object { $_ -notmatch [regex]::Escape($values[$key]) } |
        ForEach-Object { "    $_" }
    if ($LASTEXITCODE -ne 0) {
        throw "echec de netlify env:set $key"
    }
    if ($isPublic) {
        & $netlify env:set $key $values[$key] --force 2>&1 |
            Where-Object { $_ -notmatch [regex]::Escape($values[$key]) } |
            ForEach-Object { "    $_" }
    }
    Write-Host ("    {0,-28} ok ({1} car.)" -f $key, $values[$key].Length) -ForegroundColor DarkGray
}

# ---------------------------------------------------------------- .env.local
Write-Host ""
Write-Host "  Mise a jour de .env.local..." -ForegroundColor Cyan
$lines = [System.Collections.Generic.List[string]](Get-Content $envFile)
foreach ($key in $values.Keys) {
    $replaced = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match ("^\s*" + [regex]::Escape($key) + "\s*=")) {
            $lines[$i] = "$key=$($values[$key])"
            $replaced = $true
            break
        }
    }
    if (-not $replaced) {
        $lines.Add("$key=$($values[$key])")
    }
    Write-Host ("    {0,-28} ok" -f $key) -ForegroundColor DarkGray
}
[System.IO.File]::WriteAllLines($envFile, $lines)

# ---------------------------------------------------------------- verification
Write-Host ""
Write-Host "  Coherence des cles..." -ForegroundColor Cyan
if ($values.NEXT_PUBLIC_PAYPAL_CLIENT_ID -ne $values.PAYPAL_CLIENT_ID) {
    throw "NEXT_PUBLIC_PAYPAL_CLIENT_ID doit etre identique a PAYPAL_CLIENT_ID"
}
$ok = $true
foreach ($key in $values.Keys) {
    $line = (Get-Content $envFile | Where-Object { $_ -match ("^\s*" + [regex]::Escape($key) + "\s*=") } | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($line)) { $ok = $false }
}

[System.GC]::Collect()
Write-Host ""
if ($ok) {
    Write-Host "  OK - 6 variables posees sur Netlify et .env.local" -ForegroundColor Green
    Write-Host "  Aucune valeur affichee." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  Etape suivante : redemarrer le site" -ForegroundColor Cyan
    Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\redeploy.ps1" -ForegroundColor DarkGray
} else {
    Write-Host "  ECHEC - verification de .env.local" -ForegroundColor Red
    exit 1
}