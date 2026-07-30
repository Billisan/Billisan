[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectDirectory = Resolve-Path (Join-Path $PSScriptRoot '..')

Push-Location $projectDirectory
try {
    docker compose -f compose.yaml up -d --wait mysql
    if ($LASTEXITCODE -ne 0) {
        throw 'MySQL container startup failed.'
    }

    $taskDatabase = (
        docker compose -f compose.yaml exec -T mysql `
            sh -c 'printf "%s" "$MYSQL_DATABASE"'
    ).Trim()
    $taskUsername = (
        docker compose -f compose.yaml exec -T mysql `
            sh -c 'printf "%s" "$MYSQL_USER"'
    ).Trim()
    if (
        $taskDatabase -notmatch '^[A-Za-z0-9_]+$' -or
        $taskUsername -notmatch '^[A-Za-z0-9_.-]+$'
    ) {
        throw 'Unsafe MySQL database or username in Compose environment.'
    }

    @"
CREATE DATABASE IF NOT EXISTS ``$taskDatabase``
    CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT ALL PRIVILEGES ON ``$taskDatabase``.* TO '$taskUsername'@'%';
"@ |
        docker compose -f compose.yaml exec -T mysql `
            sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD"'
    if ($LASTEXITCODE -ne 0) {
        throw 'MySQL application database initialization failed.'
    }
}
finally {
    Pop-Location
}
