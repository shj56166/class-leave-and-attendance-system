param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [string]$TargetDatabase = '',
    [string]$ProjectRoot = $(
        if ($PSScriptRoot) {
            (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
        } else {
            (Resolve-Path '.').Path
        }
    )
)

$ErrorActionPreference = 'Stop'

function Get-EnvMap {
    param([string]$EnvPath)

    $envMap = @{}
    $content = [System.IO.File]::ReadAllText($EnvPath)
    $pattern = '(?m)^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$'
    foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($content, $pattern)) {
        $envMap[$match.Groups[1].Value] = $match.Groups[2].Value
    }

    return $envMap
}

function Find-MySqlBinary {
    param([string]$BinaryName)

    $fromPath = Get-Command $BinaryName -ErrorAction SilentlyContinue
    if ($fromPath) {
        return $fromPath.Source
    }

    $candidates = @(
        "C:\Program Files\MySQL\MySQL Server 8.4\bin\$BinaryName",
        "C:\Program Files\MySQL\MySQL Server 8.0\bin\$BinaryName",
        "C:\Program Files\MySQL\MySQL Workbench 8.0\$BinaryName"
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    throw "Unable to find $BinaryName. Install MySQL 8.0 or add it to PATH."
}

$resolvedBackupFile = Resolve-Path $BackupFile -ErrorAction Stop
$envPath = Join-Path $ProjectRoot 'server/.env'
if (-not (Test-Path $envPath)) {
    throw "Missing env file: $envPath"
}

$envMap = Get-EnvMap -EnvPath $envPath
$requiredKeys = @('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD')
foreach ($key in $requiredKeys) {
    if (-not $envMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envMap[$key])) {
        throw "Missing required key in server/.env: $key"
    }
}

$mysql = Find-MySqlBinary -BinaryName 'mysql.exe'
$importErrorFile = Join-Path $ProjectRoot 'backups\last-import.stderr.log'
$databaseName = if ([string]::IsNullOrWhiteSpace($TargetDatabase)) { $envMap['DB_NAME'] } else { $TargetDatabase }

& $mysql `
    "--host=$($envMap['DB_HOST'])" `
    "--port=$($envMap['DB_PORT'])" `
    "--user=$($envMap['DB_USER'])" `
    "--password=$($envMap['DB_PASSWORD'])" `
    --default-character-set=utf8mb4 `
    -e "DROP DATABASE IF EXISTS ``$databaseName``; CREATE DATABASE ``$databaseName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if ($LASTEXITCODE -ne 0) {
    throw "Failed to recreate database $databaseName"
}

try {
    $importProcess = Start-Process `
        -FilePath $mysql `
        -ArgumentList @(
            "--host=$($envMap['DB_HOST'])",
            "--port=$($envMap['DB_PORT'])",
            "--user=$($envMap['DB_USER'])",
            "--password=$($envMap['DB_PASSWORD'])",
            '--default-character-set=utf8mb4',
            "--database=$databaseName"
        ) `
        -RedirectStandardInput $resolvedBackupFile.Path `
        -RedirectStandardError $importErrorFile `
        -WindowStyle Hidden `
        -Wait `
        -PassThru

    if ($importProcess.ExitCode -ne 0) {
        $stderr = if (Test-Path $importErrorFile) {
            [System.IO.File]::ReadAllText($importErrorFile)
        } else {
            ''
        }

        throw "Failed to import backup file $resolvedBackupFile. $stderr".Trim()
    }
} finally {
    if (Test-Path $importErrorFile) {
        Remove-Item $importErrorFile -Force -ErrorAction SilentlyContinue
    }
}

Write-Output "Import completed: $resolvedBackupFile"
