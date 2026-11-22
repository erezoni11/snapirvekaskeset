param([int]$Port = 3000)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
  $nodeExecutable = $nodeCommand.Source
} else {
  $toolsDirectory = Join-Path $env:LOCALAPPDATA 'snapir-tools'
  $portableNode = Get-ChildItem -LiteralPath $toolsDirectory -Directory -ErrorAction SilentlyContinue |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'node.exe') } |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $portableNode) { throw 'Install Node.js 24 LTS, run npm ci, then try again.' }
  $nodeExecutable = Join-Path $portableNode.FullName 'node.exe'
}
$env:PATH = (Split-Path -Parent $nodeExecutable) + ';' + $env:PATH
$env:NEXT_TELEMETRY_DISABLED = '1'
$nextExecutable = Join-Path $projectRoot 'node_modules/next/dist/bin/next'
if (-not (Test-Path -LiteralPath $nextExecutable)) { throw 'Dependencies are missing. Run npm ci first.' }
& $nodeExecutable $nextExecutable dev --hostname 127.0.0.1 --port $Port
exit $LASTEXITCODE
