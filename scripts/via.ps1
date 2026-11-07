param(
    [Parameter(Position = 0)]
    [ValidateSet('install', 'definitions', 'dev', 'build', 'preview', 'lint', 'test')]
    [string]$Task = 'dev',
    [ValidateSet('public', 'licensed')]
    [string]$ResourceMode
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$bunDirectory = Join-Path $projectRoot '.tools\bun\bun-windows-x64'
$bunExecutable = Join-Path $bunDirectory 'bun.exe'
$requiredBunVersion = (Get-Content -LiteralPath (Join-Path $projectRoot '.bun-version') -Raw).Trim()

if (-not (Test-Path -LiteralPath $bunExecutable)) {
    $installedBun = Get-Command bun -CommandType Application -ErrorAction SilentlyContinue
    if (-not $installedBun) { throw 'Install the version in .bun-version. See BUILDING.md.' }
    $bunExecutable = $installedBun.Source
    $bunDirectory = Split-Path -Parent $bunExecutable
}
$actualBunVersion = & $bunExecutable --version
if ($LASTEXITCODE -ne 0 -or $actualBunVersion.Trim() -ne $requiredBunVersion) {
    throw "Expected Bun $requiredBunVersion, received $actualBunVersion."
}

$previousPath = $env:Path
$previousCache = $env:BUN_INSTALL_CACHE_DIR
$previousBrowser = $env:BROWSER
$previousResourceMode = $env:MORGRIE_RESOURCE_MODE
Push-Location $projectRoot
try {
    $env:Path = $bunDirectory + [IO.Path]::PathSeparator + $env:Path
    $env:BUN_INSTALL_CACHE_DIR = Join-Path $projectRoot '.local\bun-cache'
    $env:BROWSER = 'none'
    if ($ResourceMode -and $Task -in @('build', 'dev')) { $env:MORGRIE_RESOURCE_MODE = $ResourceMode }

    node (Join-Path $PSScriptRoot 'check-build-environment.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'RC build toolchain mismatch.' }

    switch ($Task) {
        'install' { & $bunExecutable install --frozen-lockfile }
        'definitions' { & $bunExecutable run build:kbs }
        'dev' { & $bunExecutable run dev --host 127.0.0.1 --port 5173 --strictPort }
        'build' { & $bunExecutable run build }
        'preview' { & $bunExecutable run preview --host 127.0.0.1 --port 4173 --strictPort }
        'lint' { & $bunExecutable run lint }
        'test' { & $bunExecutable run test }
    }
    if ($LASTEXITCODE -ne 0) { throw "VIA task '$Task' failed with exit code $LASTEXITCODE." }
    if ($Task -eq 'definitions') {
        node scripts/verify-definitions.cjs public/definitions
        if ($LASTEXITCODE -ne 0) { throw 'Generated keyboard definitions are incomplete.' }
    }
}
finally {
    $env:Path = $previousPath
    $env:BUN_INSTALL_CACHE_DIR = $previousCache
    $env:BROWSER = $previousBrowser
    $env:MORGRIE_RESOURCE_MODE = $previousResourceMode
    Pop-Location
}
