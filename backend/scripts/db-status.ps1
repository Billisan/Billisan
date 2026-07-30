[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectDirectory = Resolve-Path (Join-Path $PSScriptRoot '..')

Push-Location $projectDirectory
try {
    docker compose -f docker-compose.yml ps db
}
finally {
    Pop-Location
}
