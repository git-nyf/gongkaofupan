$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $projectRoot 'local-tools\.venv\Scripts\python.exe'
$sourceRoot = Join-Path $projectRoot 'local-tools\huasheng-mcp\src'

if (-not (Test-Path -LiteralPath $python)) {
  throw 'Local Python environment is missing. Run the project setup first.'
}

$env:PYTHONPATH = $sourceRoot
if (-not $env:MCP_HOST) { $env:MCP_HOST = '127.0.0.1' }
if (-not $env:MCP_PORT) { $env:MCP_PORT = '8000' }

Write-Host "Starting local Huasheng MCP at $($env:MCP_HOST):$($env:MCP_PORT)/sse"
& $python -m uvicorn mcp_server.server:app --host $env:MCP_HOST --port ([int]$env:MCP_PORT)
