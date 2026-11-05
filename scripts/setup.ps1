param([switch]$SkipBrowser)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)

function Test-NodeVersion {
    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { return $false }
    & node.exe -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
    return $LASTEXITCODE -eq 0
}

try {
    Write-Host '=== Web-to-MCP Studio: environment setup ===' -ForegroundColor Cyan
    if (-not (Test-NodeVersion)) {
        if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
            throw 'Node.js 22+ is required. Install Node.js LTS from https://nodejs.org, then reopen setup.bat. Automatic installation requires Windows App Installer (winget).'
        }
        Write-Host 'Installing Node.js LTS with winget. Windows may request administrator permission.'
        & winget.exe install --id OpenJS.NodeJS.LTS --exact --source winget --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) { throw 'Node.js installation failed. Install Node.js 22+ from https://nodejs.org and reopen setup.bat.' }
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
        if (-not (Test-NodeVersion)) { throw 'Reopen setup.bat in a new window to use the newly installed Node.js. Node.js 22+ must be first on PATH.' }
    }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm is missing. Repair the Node.js installation, including npm.' }
    $manifest = Get-Content -Raw -LiteralPath 'package.json' | ConvertFrom-Json
    $manager = $manifest.packageManager
    $expected = $manager -replace '^pnpm@', ''
    $script:UseInstalledPnpm = $false
    if (Get-Command pnpm.cmd -ErrorAction SilentlyContinue) {
        $installed = & pnpm.cmd --version
        $script:UseInstalledPnpm = $LASTEXITCODE -eq 0 -and "$installed".Trim() -eq $expected
    }
    function Invoke-Pnpm {
        if ($script:UseInstalledPnpm) { & pnpm.cmd @args }
        else { & npx.cmd --yes $manager @args }
        if ($LASTEXITCODE -ne 0) { throw "pnpm step failed (exit $LASTEXITCODE): $($args -join ' '). Check the network / registry settings and run setup.bat again." }
    }
    Write-Host "[1/4] Installing dependencies with $manager..."
    Invoke-Pnpm install --frozen-lockfile
    Write-Host '[2/4] Checking browser...'
    $existingBrowser = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
    ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($SkipBrowser) { Write-Host 'Skipped. Use --channel chrome or --channel msedge when capturing.' }
    elseif ($existingBrowser) { Write-Host "Using installed browser: $existingBrowser. No Chromium download needed." }
    else { Invoke-Pnpm exec playwright install chromium }
    Write-Host '[3/4] Checking TypeScript...'
    Invoke-Pnpm check
    Write-Host '[4/4] Building project...'
    Invoke-Pnpm build
    & node.exe scripts/client-config.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Không tạo được cấu hình MCP Studio.' }
    Write-Host 'Setup complete. Open run.bat to start.' -ForegroundColor Green
    exit 0
} catch {
    Write-Host "SETUP FAILED: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
