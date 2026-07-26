[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectDirectory = Resolve-Path (Join-Path $PSScriptRoot '..')

Push-Location $projectDirectory
try {
    docker compose -f compose.yaml stop mysql
}
finally {
    Pop-Location
}
