$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$localToolsRoot = Join-Path $projectRoot 'local-tools'
$skillsRoot = Join-Path $localToolsRoot 'skills'
$mcpRoot = Join-Path $localToolsRoot 'huasheng-mcp'
$venvRoot = Join-Path $localToolsRoot '.venv'
$venvPython = Join-Path $projectRoot 'local-tools\.venv\Scripts\python.exe'

function Assert-NativeCommandSucceeded {
  param([Parameter(Mandatory = $true)][string]$Action)

  if ($LASTEXITCODE -ne 0) {
    throw "$Action failed with exit code $LASTEXITCODE."
  }
}

function Sync-GitRepository {
  param(
    [Parameter(Mandatory = $true)][string]$RepositoryUrl,
    [Parameter(Mandatory = $true)][string]$Branch,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  $gitDirectory = Join-Path $Destination '.git'
  if (Test-Path -LiteralPath $gitDirectory) {
    git -C $Destination pull --ff-only origin $Branch
    Assert-NativeCommandSucceeded "Updating $Destination"
    return
  }

  if (Test-Path -LiteralPath $Destination) {
    throw "$Destination already exists but is not a Git repository."
  }

  git clone --depth 1 --branch $Branch $RepositoryUrl $Destination
  Assert-NativeCommandSucceeded "Cloning $RepositoryUrl"
}

function Update-HuashengRouteAdapter {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot)

  $adapterPath = Join-Path $RepositoryRoot 'src\mcp_server\runtime_adapter.py'
  $content = [IO.File]::ReadAllText($adapterPath).Replace("`r`n", "`n")
  $oldRoute = @'
    def route_xingce_question(self, question: str):
        return self.raw.tool_route_xingce_question(question_text=question)
'@
  $compatibleRoute = @'
    def route_xingce_question(
        self,
        question_text: str,
        options: dict = None,
        module_hint: str = None,
        section_context: str = None,
        image_present: bool = False,
        strict_mode: bool = True,
    ):
        return self.raw.tool_route_xingce_question(
            question_text=question_text,
            options=options,
            module_hint=module_hint,
            section_context=section_context,
            image_present=image_present,
            strict_mode=strict_mode,
        )
'@

  if ($content.Contains($compatibleRoute)) {
    Write-Host 'Huasheng route adapter compatibility patch is already applied.'
    return
  }

  if (-not $content.Contains($oldRoute)) {
    throw 'Unable to locate the expected Huasheng route adapter implementation.'
  }

  $patchedContent = $content.Replace($oldRoute, $compatibleRoute)
  [IO.File]::WriteAllText($adapterPath, $patchedContent, [Text.UTF8Encoding]::new($false))
  Write-Host 'Applied the Huasheng question_text compatibility patch.'
}

New-Item -ItemType Directory -Force -Path $skillsRoot | Out-Null

Sync-GitRepository `
  -RepositoryUrl 'https://github.com/WangJunqing-coder/huasheng13-skill.git' `
  -Branch 'master' `
  -Destination (Join-Path $localToolsRoot 'skills\huasheng13')

Sync-GitRepository `
  -RepositoryUrl 'https://github.com/heihei999/huasheng-mcp.git' `
  -Branch 'main' `
  -Destination (Join-Path $localToolsRoot 'huasheng-mcp')

Update-HuashengRouteAdapter -RepositoryRoot $mcpRoot

if (-not (Test-Path -LiteralPath $venvPython)) {
  py -m venv $venvRoot
  Assert-NativeCommandSucceeded 'Creating the local Python environment'
}

& $venvPython -m pip install --editable "$mcpRoot[sse]"
Assert-NativeCommandSucceeded 'Installing the local Huasheng MCP'

Write-Host 'Local coach tools are ready.'
