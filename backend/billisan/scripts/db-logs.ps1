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
        docker compose -f compose.yaml logs --tail $Tail --follow mysql
    }
    else {
        docker compose -f compose.yaml logs --tail $Tail mysql
    }
}
finally {
    Pop-Location
}
