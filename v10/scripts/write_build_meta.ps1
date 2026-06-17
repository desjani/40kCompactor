# write_build_meta.ps1
# Generates build_meta.json in the repo root with current git commit and timestamp.
# Usage: pwsh ./scripts/write_build_meta.ps1

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
Push-Location $repoRoot
try {
    # Try to collect git metadata
    $short = (& git rev-parse --short HEAD) 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($short)) { $short = 'unknown' }

    $full = (& git rev-parse --verify HEAD) 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($full)) { $full = $short }

    $ts = (& git show -s --format=%cI HEAD) 2>$null
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($ts)) { $ts = (Get-Date).ToString('o') }
} catch {
    $short = 'unknown'
    $full = 'unknown'
    $ts = (Get-Date).ToString('o')
} finally {
    Pop-Location
}

$meta = @{ commitShort = $short.Trim(); commitFull = $full.Trim(); timestamp = $ts.Trim() }
$outPath = Join-Path $repoRoot 'build_meta.json'
$meta | ConvertTo-Json -Depth 3 | Set-Content -Encoding UTF8 -LiteralPath $outPath
Write-Output "Wrote $outPath"
Get-Content -LiteralPath $outPath
