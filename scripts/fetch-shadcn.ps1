# Download shadcn/ui registry items straight from ui.shadcn.com and write the files to disk.
# The `shadcn` CLI fetch occasionally times out on this network, so we retry each request.
$ErrorActionPreference = 'Continue'
$style = 'radix-nova'
$base = "https://ui.shadcn.com/r/styles/$style"
$outDir = Join-Path $PSScriptRoot '..\src\components\ui'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$components = @(
  'button','card','badge','input','label','textarea','select','checkbox','radio-group',
  'separator','tabs','dialog','sheet','dropdown-menu','avatar','accordion','alert',
  'alert-dialog','sonner','skeleton','table','pagination','scroll-area','tooltip',
  'progress','switch','popover','command','form','carousel','collapsible'
)

function Get-Json($url) {
  for ($i = 1; $i -le 6; $i++) {
    try {
      $r = Invoke-WebRequest -Uri $url -TimeoutSec 45 -UseBasicParsing
      return ($r.Content | ConvertFrom-Json)
    } catch {
      Write-Output ("  retry {0} for {1}: {2}" -f $i, (Split-Path $url -Leaf), $_.Exception.Message)
      Start-Sleep -Seconds 2
    }
  }
  return $null
}

$deps = @{}
$devDeps = @{}

foreach ($c in $components) {
  Write-Output "-> $c"
  $json = Get-Json "$base/$c.json"
  if ($null -eq $json) { Write-Output "  FAILED $c"; continue }
  if ($json.dependencies) { $deps[$c] = $json.dependencies }
  if ($json.devDependencies) { $devDeps[$c] = $json.devDependencies }
  foreach ($f in $json.files) {
    $name = [System.IO.Path]::GetFileName($f.path)
    $target = Join-Path $outDir $name
    $content = $f.content
    # registry returns \n escaped newlines already decoded by ConvertFrom-Json
    Set-Content -LiteralPath $target -Value $content -Encoding UTF8
    Write-Output "   wrote $name"
  }
}

# aggregate dependencies
$all = @()
foreach ($k in $deps.Keys) { $all += $deps[$k] }
$allDeps = $all | Sort-Object -Unique
Set-Content -LiteralPath (Join-Path $PSScriptRoot '..\.shadcn-deps.json') -Value ($allDeps | ConvertTo-Json) -Encoding UTF8
Write-Output "DEPS:"
$allDeps -join ' '