[CmdletBinding()]
param(
  [switch]$Sync,
  [int]$Port = 8787,
  [int]$McpPort = 8000
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

function Test-ListeningPort {
  param([Parameter(Mandatory = $true)][int]$Number)

  return $null -ne (Get-NetTCPConnection -State Listen -LocalPort $Number -ErrorAction SilentlyContinue)
}

function Wait-Http {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        return $response
      }
    } catch {
      # The process may need a few seconds to bind its port.
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for $Url."
}

function Invoke-PowerShellScript {
  param([Parameter(Mandatory = $true)][string]$Path)

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Path
  if ($LASTEXITCODE -ne 0) {
    throw "PowerShell script failed: $Path"
  }
}

$requiredPaths = @(
  (Join-Path $projectRoot 'local-tools\.venv\Scripts\python.exe'),
  (Join-Path $projectRoot 'local-tools\huasheng-mcp\src\mcp_server\server.py'),
  (Join-Path $projectRoot 'local-tools\skills\huasheng13\SKILL.md'),
  (Join-Path $projectRoot 'local-tools\skills\zhang-gong-yanyu\SKILL.md')
)
$missingDependency = @($requiredPaths | Where-Object { -not (Test-Path -LiteralPath $_) }).Count -gt 0

if ($Sync -or $missingDependency) {
  Write-Host 'Preparing local coach dependencies.'
  Invoke-PowerShellScript (Join-Path $projectRoot 'scripts\setup-coach-local.ps1')
}

$mcpUrl = "http://127.0.0.1:$McpPort"
$mcpManifestUrl = "$mcpUrl/.well-known/mcp.json"
if (-not (Test-ListeningPort $McpPort)) {
  $env:MCP_PORT = [string]$McpPort
  $mcpScript = Join-Path $projectRoot 'scripts\start-huasheng-mcp.ps1'
  Start-Process -WindowStyle Hidden -FilePath 'powershell.exe' -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    $mcpScript
  ) | Out-Null
}
Wait-Http $mcpManifestUrl | Out-Null

$distServer = Join-Path $projectRoot 'dist-server\index.js'
$clientEntry = Join-Path $projectRoot 'dist\client\index.html'
if ($Sync -or -not (Test-Path -LiteralPath $distServer) -or -not (Test-Path -LiteralPath $clientEntry)) {
  npm run build
  if ($LASTEXITCODE -ne 0) {
    throw 'The project build failed.'
  }
}

function Get-CoachStatus {
  try {
    return (Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/coach/status" -TimeoutSec 3)
  } catch {
    return $null
  }
}

$existingStatus = if (Test-ListeningPort $Port) { Get-CoachStatus } else { $null }
$needsBackendRestart = $null -ne $existingStatus -and @('deepseek', 'huasheng', 'zhangGong', 'webSearch' | Where-Object { $existingStatus.$_ -ne 'ready' }).Count -gt 0
if ($needsBackendRestart) {
  $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
  if ($listener) {
    Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
  }
}

if (-not (Test-ListeningPort $Port)) {
  $env:PORT = [string]$Port
  $nodePath = (Get-Command node -ErrorAction Stop).Source
  $outputDirectory = Join-Path $projectRoot 'output'
  New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
  Start-Process -WindowStyle Hidden -FilePath $nodePath -ArgumentList @('dist-server/index.js') `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput (Join-Path $outputDirectory 'coach-backend.log') `
    -RedirectStandardError (Join-Path $outputDirectory 'coach-backend.error.log') | Out-Null
}

$statusResponse = Wait-Http "http://127.0.0.1:$Port/api/coach/status" 45
$status = $statusResponse.Content | ConvertFrom-Json
Write-Host "Coach service is ready at http://127.0.0.1:$Port/coach"
foreach ($name in @('deepseek', 'huasheng', 'zhangGong', 'webSearch')) {
  Write-Host "$name=$($status.$name)"
}
if ($status.huasheng -ne 'ready') {
  throw 'Huasheng MCP is not ready. Start the local MCP and retry.'
}
if ($status.zhangGong -ne 'ready') {
  throw 'Zhang Gong Skill is not ready. Check the local Skill directory and retry.'
}
