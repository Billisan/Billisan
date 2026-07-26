[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectDirectory = Resolve-Path (Join-Path $PSScriptRoot '..')

Push-Location $projectDirectory
try {
    docker compose -f compose.yaml up -d --wait mysql
}
finally {
    Pop-Location
}
