[CmdletBinding()]
param(
    [string]$ProjectRoot = $(
        if ($PSScriptRoot) {
            (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
        } else {
            (Resolve-Path '.').Path
        }
    ),
    [string]$BackupDir = ''
)

$ErrorActionPreference = 'Stop'

function Write-Step {
    param([string]$Message)
    Write-Host ''
    Write-Host $Message -ForegroundColor Cyan
}

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

    throw "Unable to find $BinaryName. Install MySQL 8.x or add it to PATH."
}

function Resolve-PreferredBackupDir {
    param(
        [string]$ProjectRootPath,
        [string]$ConfiguredBackupDir
    )

    if (-not [string]::IsNullOrWhiteSpace($ConfiguredBackupDir)) {
        if ([System.IO.Path]::IsPathRooted($ConfiguredBackupDir)) {
            return $ConfiguredBackupDir
        }

        return Join-Path $ProjectRootPath $ConfiguredBackupDir
    }

    return Join-Path $ProjectRootPath 'backups'
}

function Stop-BackendIfRunning {
    $connection = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if (-not $connection) {
        Write-Host 'Backend port 3000 is not currently in use.'
        return
    }

    $process = Get-Process -Id $connection.OwningProcess -ErrorAction Stop
    if ($process.ProcessName -notin @('node', 'nodemon')) {
        throw "Port 3000 is occupied by unsupported process '$($process.ProcessName)' (PID $($process.Id)). Stop it manually before resetting."
    }

    Write-Host "Stopping backend process on port 3000: PID $($process.Id) ($($process.ProcessName))"
    Stop-Process -Id $process.Id -Force

    $deadline = (Get-Date).AddSeconds(15)
    while ((Get-Date) -lt $deadline) {
        $stillListening = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if (-not $stillListening) {
            Write-Host 'Backend process stopped.'
            return
        }

        Start-Sleep -Milliseconds 300
    }

    throw 'Timed out waiting for port 3000 to become free.'
}

function Invoke-MySqlQuery {
    param(
        [string]$MysqlBinary,
        [hashtable]$DbConfig,
        [string]$Query
    )

    & $MysqlBinary `
        "--host=$($DbConfig.DB_HOST)" `
        "--port=$($DbConfig.DB_PORT)" `
        "--user=$($DbConfig.DB_USER)" `
        "--password=$($DbConfig.DB_PASSWORD)" `
        --default-character-set=utf8mb4 `
        -e $Query

    if ($LASTEXITCODE -ne 0) {
        throw "mysql command failed with exit code $LASTEXITCODE"
    }
}

function Reset-LocalBackupState {
    param([string]$ProjectRootPath)

    $backupRoot = Join-Path $ProjectRootPath 'backups'
    $stateFile = Join-Path $backupRoot 'backup-state.json'
    $importsDir = Join-Path $backupRoot 'imports'
    $lastImportError = Join-Path $backupRoot 'last-import.stderr.log'

    if (Test-Path $stateFile) {
        Remove-Item $stateFile -Force -ErrorAction SilentlyContinue
    }

    if (Test-Path $importsDir) {
        Remove-Item $importsDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    if (Test-Path $lastImportError) {
        Remove-Item $lastImportError -Force -ErrorAction SilentlyContinue
    }
}

$resolvedProjectRoot = (Resolve-Path $ProjectRoot).Path
$serverRoot = Join-Path $resolvedProjectRoot 'server'
$envPath = Join-Path $serverRoot '.env'
$backupScriptPath = Join-Path $resolvedProjectRoot 'scripts\export-local-mysql-backup.ps1'
$seedScriptPath = Join-Path $serverRoot 'seed-demo-data.js'
$resolvedBackupDir = Resolve-PreferredBackupDir -ProjectRootPath $resolvedProjectRoot -ConfiguredBackupDir $BackupDir

if (-not (Test-Path $envPath)) {
    throw "Missing env file: $envPath"
}

if (-not (Test-Path $backupScriptPath)) {
    throw "Missing backup script: $backupScriptPath"
}

if (-not (Test-Path $seedScriptPath)) {
    throw "Missing demo seed script: $seedScriptPath"
}

$envMap = Get-EnvMap -EnvPath $envPath
$requiredKeys = @('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD')
foreach ($key in $requiredKeys) {
    if (-not $envMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envMap[$key])) {
        throw "Missing required key in server/.env: $key"
    }
}

$mysql = Find-MySqlBinary -BinaryName 'mysql.exe'

Write-Host '=== Demo Database Reset ===' -ForegroundColor Green
Write-Host "Project root: $resolvedProjectRoot"
Write-Host "Target database: $($envMap['DB_NAME'])"
Write-Host "Backup directory: $resolvedBackupDir"

Write-Step '1. Export private backup'
$backupOutput = & powershell.exe `
    -ExecutionPolicy Bypass `
    -File $backupScriptPath `
    -ProjectRoot $resolvedProjectRoot `
    -BackupDir $resolvedBackupDir `
    -TargetDatabase $envMap['DB_NAME']

if ($LASTEXITCODE -ne 0) {
    throw 'Backup step failed.'
}

$backupFile = ($backupOutput | Where-Object { $_ -like 'Backup created:*' } | Select-Object -Last 1)
$manifestFile = ($backupOutput | Where-Object { $_ -like 'Manifest created:*' } | Select-Object -Last 1)
$backupFilePath = if ($backupFile) { $backupFile.Replace('Backup created:', '').Trim() } else { '' }
$manifestFilePath = if ($manifestFile) { $manifestFile.Replace('Manifest created:', '').Trim() } else { '' }

if (-not $backupFilePath) {
    throw 'Backup completed but no backup file path was returned.'
}

Write-Host "Backup file: $backupFilePath"
if ($manifestFilePath) {
    Write-Host "Backup manifest: $manifestFilePath"
}

Write-Step '2. Stop backend service on port 3000'
Stop-BackendIfRunning

Write-Step '3. Recreate database'
$escapedDatabaseName = $envMap['DB_NAME'].Replace('`', '``')
Invoke-MySqlQuery -MysqlBinary $mysql -DbConfig $envMap -Query "DROP DATABASE IF EXISTS ``$escapedDatabaseName``; CREATE DATABASE ``$escapedDatabaseName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
Write-Host "Database recreated: $($envMap['DB_NAME'])"

Write-Step '4. Run migrations'
Push-Location $serverRoot
try {
    & cmd.exe /c 'npx sequelize-cli db:migrate'
    if ($LASTEXITCODE -ne 0) {
        throw 'Migration step failed.'
    }
} finally {
    Pop-Location
}

Write-Step '5. Seed demo data'
Push-Location $serverRoot
try {
    & node $seedScriptPath
    if ($LASTEXITCODE -ne 0) {
        throw 'Demo seed step failed.'
    }
} finally {
    Pop-Location
}

Write-Step '6. Clear local backup runtime state'
Reset-LocalBackupState -ProjectRootPath $resolvedProjectRoot
Write-Host 'Local backup runtime state cleared.'

Write-Step '7. Completed'
Write-Host 'Database has been reset to the demo baseline.'
Write-Host 'Admin: admin / admin123'
Write-Host 'Teacher: teacher / teacher123'
Write-Host 'Class code: TEST001'
