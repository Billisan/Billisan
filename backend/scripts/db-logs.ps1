[CmdletBinding()]
param(
    [ValidateRange(1, 10000)]
    [int]$Tail = 200,

    [switch]$Follow
)

$ErrorActionPreference = 'Stop'
$projectDirectory = Resolve-Path (Join-Path $PSScriptRoot '..')

Push-Location $projectDirectory
try {
    if ($Follow) {
        docker compose -f docker-compose.yml logs --tail $Tail --follow db
    }
    else {
        docker compose -f docker-compose.yml logs --tail $Tail db
    }
}
finally {
    Pop-Location
}
