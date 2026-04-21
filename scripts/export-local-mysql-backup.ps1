param(
    [string]$ProjectRoot = $(
        if ($PSScriptRoot) {
            (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
        } else {
            (Resolve-Path '.').Path
        }
    ),
    [string]$BackupDir = 'backups',
    [string]$TargetDatabase = ''
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

$mysqldump = Find-MySqlBinary -BinaryName 'mysqldump.exe'
$mysql = Find-MySqlBinary -BinaryName 'mysql.exe'
$databaseName = if ([string]::IsNullOrWhiteSpace($TargetDatabase)) { $envMap['DB_NAME'] } else { $TargetDatabase }

$resolvedBackupDir = if ([System.IO.Path]::IsPathRooted($BackupDir)) {
    $BackupDir
} else {
    Join-Path $ProjectRoot $BackupDir
}
New-Item -ItemType Directory -Force -Path $resolvedBackupDir | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$safeDatabaseName = ($databaseName -replace '[^A-Za-z0-9_-]', '_')
$backupFile = Join-Path $resolvedBackupDir "${safeDatabaseName}_$timestamp.sql"
$manifestFile = Join-Path $resolvedBackupDir "${safeDatabaseName}_$timestamp.manifest.json"
$dumpErrorFile = Join-Path $resolvedBackupDir "${safeDatabaseName}_$timestamp.dump.stderr.log"

try {
    $dumpProcess = Start-Process `
        -FilePath $mysqldump `
        -ArgumentList @(
            "--host=$($envMap['DB_HOST'])",
            "--port=$($envMap['DB_PORT'])",
            "--user=$($envMap['DB_USER'])",
            "--password=$($envMap['DB_PASSWORD'])",
            '--default-character-set=utf8mb4',
            '--single-transaction',
            '--routines',
            '--triggers',
            $databaseName
        ) `
        -RedirectStandardOutput $backupFile `
        -RedirectStandardError $dumpErrorFile `
        -WindowStyle Hidden `
        -Wait `
        -PassThru

    if ($dumpProcess.ExitCode -ne 0) {
        $stderr = if (Test-Path $dumpErrorFile) {
            [System.IO.File]::ReadAllText($dumpErrorFile)
        } else {
            ''
        }

        throw "mysqldump failed with exit code $($dumpProcess.ExitCode). $stderr".Trim()
    }
} finally {
    if (Test-Path $dumpErrorFile) {
        Remove-Item $dumpErrorFile -Force -ErrorAction SilentlyContinue
    }
}

$tableNames = @(
    'classes',
    'students',
    'teachers',
    'schedules',
    'schedule_periods',
    'class_special_dates',
    'leave_requests',
    'leave_records',
    'leave_history_archives',
    'audit_logs',
    'student_login_logs',
    'dormitories',
    'SequelizeMeta'
)

$existingTablesRaw = & $mysql `
    "--host=$($envMap['DB_HOST'])" `
    "--port=$($envMap['DB_PORT'])" `
    "--user=$($envMap['DB_USER'])" `
    "--password=$($envMap['DB_PASSWORD'])" `
    "--database=$databaseName" `
    -N `
    -e 'SHOW TABLES;'

if ($LASTEXITCODE -ne 0) {
    throw "mysql table discovery failed with exit code $LASTEXITCODE"
}

$existingTableSet = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
foreach ($line in $existingTablesRaw) {
    if (-not [string]::IsNullOrWhiteSpace($line)) {
        [void]$existingTableSet.Add($line.Trim())
    }
}

$countQueryParts = foreach ($table in $tableNames) {
    if ($existingTableSet.Contains($table)) {
        "SELECT '$table' AS table_name, COUNT(*) AS row_count FROM ``$table``"
    }
}

$countsRaw = @()
if ($countQueryParts.Count -gt 0) {
    $countQuery = ($countQueryParts -join ' UNION ALL ') + ';'
    $countsRaw = & $mysql `
        "--host=$($envMap['DB_HOST'])" `
        "--port=$($envMap['DB_PORT'])" `
        "--user=$($envMap['DB_USER'])" `
        "--password=$($envMap['DB_PASSWORD'])" `
        "--database=$databaseName" `
        -N `
        -e $countQuery

    if ($LASTEXITCODE -ne 0) {
        throw "mysql count check failed with exit code $LASTEXITCODE"
    }
}

$migrationRaw = @()
if ($existingTableSet.Contains('SequelizeMeta')) {
    $migrationRaw = & $mysql `
        "--host=$($envMap['DB_HOST'])" `
        "--port=$($envMap['DB_PORT'])" `
        "--user=$($envMap['DB_USER'])" `
        "--password=$($envMap['DB_PASSWORD'])" `
        "--database=$databaseName" `
        -N `
        -e 'SELECT name FROM `SequelizeMeta` ORDER BY name;'

    if ($LASTEXITCODE -ne 0) {
        throw "mysql migration check failed with exit code $LASTEXITCODE"
    }
}

$countLookup = @{}
foreach ($line in $countsRaw) {
    if ([string]::IsNullOrWhiteSpace($line)) {
        continue
    }

    $parts = $line -split '\s+', 2
    $countLookup[$parts[0]] = [int64]$parts[1]
}

$counts = foreach ($table in $tableNames) {
    [pscustomobject]@{
        table = $table
        rowCount = if ($countLookup.ContainsKey($table)) { $countLookup[$table] } else { 0 }
    }
}

$hash = Get-FileHash -Algorithm SHA256 -Path $backupFile
$manifest = [pscustomobject]@{
    createdAt = (Get-Date).ToString('s')
    projectRoot = $ProjectRoot
    database = [pscustomobject]@{
        host = $envMap['DB_HOST']
        port = [int]$envMap['DB_PORT']
        name = $databaseName
        user = $envMap['DB_USER']
    }
    backup = [pscustomobject]@{
        file = $backupFile
        sizeBytes = (Get-Item $backupFile).Length
        sha256 = $hash.Hash
    }
    tableCounts = $counts
    migrations = @($migrationRaw | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

$manifestJson = $manifest | ConvertTo-Json -Depth 6
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($manifestFile, $manifestJson, $utf8NoBom)

Write-Output "Backup created: $backupFile"
Write-Output "Manifest created: $manifestFile"
