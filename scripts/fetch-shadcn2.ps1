$ErrorActionPreference = 'Continue'
$style = 'radix-nova'
$outDir = 'D:\Lumen Books\src\components\ui'

function Get-Json($url) {
  for ($i = 1; $i -le 6; $i++) {
    try { return (Invoke-WebRequest -Uri $url -TimeoutSec 45 -UseBasicParsing).Content | ConvertFrom-Json }
    catch { Write-Output ("  retry {0}: {1}" -f $i, $_.Exception.Message); Start-Sleep -Seconds 2 }
  }
  return $null
}

$names = @('input-group','drawer','sidebar','empty','alert-demo')
foreach ($n in $names) {
  Write-Output "-> $n"
  $json = Get-Json "https://ui.shadcn.com/r/styles/$style/$n.json"
  if ($null -eq $json) { Write-Output "  FAILED $n"; continue }
  if (-not $json.files) { Write-Output "  no files"; continue }
  foreach ($f in $json.files) {
    $name = [System.IO.Path]::GetFileName($f.path)
    $content = $f.content
    $content = $content.Replace('from "cn"', 'from "@/lib/utils"')
    $content = $content.Replace('"@/registry/radix-nova/ui/', '"@/components/ui/')
    $content = $content.Replace('from "@/app/(create)/components/icon-placeholder"', 'from "@/components/ui/icon-placeholder"')
    Set-Content -LiteralPath (Join-Path $outDir $name) -Value $content -Encoding UTF8
    Write-Output "   wrote $name"
  }
  if ($json.dependencies) { Write-Output ("   deps: " + ($json.dependencies -join ' ')) }
}