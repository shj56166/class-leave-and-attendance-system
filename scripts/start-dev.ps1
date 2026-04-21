[CmdletBinding()]
param(
    [string]$MySqlDataDir = '',
    [string]$MySqlExe,
    [switch]$InstallMissingDeps,
    [switch]$SkipMySql
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $projectRoot '.logs'
$serverEnvPath = Join-Path $projectRoot 'server\.env'
$studentIosProxyScript = Join-Path $projectRoot '.codex-runtime\student-ios-https-proxy.mjs'
$studentIosCertPath = Join-Path $projectRoot 'ssl\student-local.pem'
$studentIosKeyPath = Join-Path $projectRoot 'ssl\student-local-key.pem'
$studentDistDir = Join-Path $projectRoot 'student-app\dist'

function Write-Step {
    param([string]$Message)
    Write-Host ''
    Write-Host $Message -ForegroundColor Cyan
}

function Test-PortListening {
    param([int]$Port)
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Wait-ForPort {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 20
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortListening -Port $Port) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    }

    return $false
}

function Test-PrivateIpv4 {
    param([string]$Address)

    return $Address -match '^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$'
}

function Get-PreferredLanIp {
    try {
        $configs = Get-NetIPConfiguration | Where-Object { $_.IPv4Address }
        $candidates = foreach ($config in $configs) {
            foreach ($entry in $config.IPv4Address) {
                if (-not (Test-PrivateIpv4 -Address $entry.IPAddress)) {
                    continue
                }

                [PSCustomObject]@{
                    IPAddress       = $entry.IPAddress
                    HasGateway      = [bool]$config.IPv4DefaultGateway
                    InterfaceMetric = if ($null -ne $config.InterfaceMetric) { [int]$config.InterfaceMetric } else { 9999 }
                }
            }
        }

        return $candidates |
            Sort-Object `
                @{ Expression = { if ($_.HasGateway) { 0 } else { 1 } } }, `
                @{ Expression = { $_.InterfaceMetric } } |
            Select-Object -First 1 -ExpandProperty IPAddress
    }
    catch {
        return $null
    }
}

function Get-MySqlService {
    return Get-Service -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match 'mysql|mariadb' -or $_.DisplayName -match 'MySQL|MariaDB' } |
        Select-Object -First 1
}

function Resolve-MySqlExe {
    param([string]$PreferredExe)

    if ($PreferredExe -and (Test-Path $PreferredExe)) {
        return $PreferredExe
    }

    $candidates = @(
        'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe',
        'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe'
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    $found = Get-ChildItem 'C:\Program Files\MySQL' -Recurse -Filter 'mysqld.exe' -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName

    return $found
}

function Ensure-Dependencies {
    param(
        [string]$Name,
        [string]$Directory
    )

    $nodeModulesPath = Join-Path $Directory 'node_modules'
    if ((-not $InstallMissingDeps) -or (Test-Path $nodeModulesPath)) {
        return
    }

    Write-Host "Installing missing dependencies: $Name"
    Push-Location $Directory
    try {
        & npm.cmd install | Out-Host
    }
    finally {
        Pop-Location
    }
}

function Get-EnvFileValue {
    param(
        [string]$Path,
        [string]$Name
    )

    if (-not (Test-Path $Path)) {
        return ''
    }

    $pattern = "^\s*$([Regex]::Escape($Name))\s*=\s*(.*)$"
    foreach ($line in Get-Content -Path $Path -ErrorAction SilentlyContinue) {
        if ($line -match $pattern) {
            return $matches[1].Trim()
        }
    }

    return ''
}

function Test-ServerJPushConfig {
    $appKey = if ($env:JPUSH_APP_KEY) { $env:JPUSH_APP_KEY.Trim() } else { Get-EnvFileValue -Path $serverEnvPath -Name 'JPUSH_APP_KEY' }
    $masterSecret = if ($env:JPUSH_MASTER_SECRET) { $env:JPUSH_MASTER_SECRET.Trim() } else { Get-EnvFileValue -Path $serverEnvPath -Name 'JPUSH_MASTER_SECRET' }

    if ($appKey -and $masterSecret) {
        Write-Host 'Detected server-side JPush credentials for backend dev startup'
        return
    }

    Write-Warning 'Server-side JPush credentials are missing. Background remote push will be skipped.'
    if (Test-Path $serverEnvPath) {
        Write-Warning "Check $serverEnvPath or set JPUSH_APP_KEY / JPUSH_MASTER_SECRET in the current shell before running this script."
        return
    }

    Write-Warning "Create $serverEnvPath or set JPUSH_APP_KEY / JPUSH_MASTER_SECRET in the current shell before running this script."
}

function Start-DevService {
    param(
        [string]$Name,
        [string]$Directory,
        [int]$Port,
        [string]$LogPrefix
    )

    if (Test-PortListening -Port $Port) {
        Write-Host "$Name is already running on port $Port"
        return
    }

    Ensure-Dependencies -Name $Name -Directory $Directory

    $stdoutLog = Join-Path $logDir "$LogPrefix.out.log"
    $stderrLog = Join-Path $logDir "$LogPrefix.err.log"

    $process = Start-Process -FilePath 'npm.cmd' `
        -ArgumentList 'run', 'dev' `
        -WorkingDirectory $Directory `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -PassThru

    if (-not (Wait-ForPort -Port $Port -TimeoutSeconds 25)) {
        throw "$Name failed to start. Port $Port did not begin listening in time. See log: $stderrLog"
    }

    Write-Host "$Name started. PID: $($process.Id), Port: $Port"
}

function Start-StudentIosProxy {
    param([int]$Port = 8443)

    if (Test-PortListening -Port $Port) {
        Write-Host "Student iOS HTTPS is already running on port $Port"
        return
    }

    $missingPaths = @(
        @{ Label = 'Proxy script'; Path = $studentIosProxyScript }
        @{ Label = 'HTTPS certificate'; Path = $studentIosCertPath }
        @{ Label = 'HTTPS private key'; Path = $studentIosKeyPath }
        @{ Label = 'student-app dist'; Path = $studentDistDir }
    ) | Where-Object { -not (Test-Path $_.Path) }

    if ($missingPaths) {
        Write-Host 'Skipped student iOS HTTPS startup because required files are missing:' -ForegroundColor Yellow
        foreach ($item in $missingPaths) {
            Write-Host "  - $($item.Label): $($item.Path)" -ForegroundColor Yellow
        }
        Write-Host 'Build student-app and generate the local certificate before using the iOS PWA entry.' -ForegroundColor Yellow
        return
    }

    $stdoutLog = Join-Path $logDir 'student-ios-https-proxy.out.log'
    $stderrLog = Join-Path $logDir 'student-ios-https-proxy.err.log'
    $nodeCommand = Get-Command node.exe -ErrorAction Stop

    $process = Start-Process -FilePath $nodeCommand.Source `
        -ArgumentList $studentIosProxyScript `
        -WorkingDirectory $projectRoot `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -PassThru

    if (-not (Wait-ForPort -Port $Port -TimeoutSeconds 20)) {
        throw "Student iOS HTTPS failed to start. Port $Port did not begin listening in time. See log: $stderrLog"
    }

    Write-Host "Student iOS HTTPS started. PID: $($process.Id), Port: $Port"
}

function Ensure-MySql {
    if ($SkipMySql) {
        Write-Host 'Skipped MySQL startup check'
        return
    }

    if (Test-PortListening -Port 3306) {
        Write-Host 'MySQL is already listening on port 3306'
        return
    }

    $service = Get-MySqlService
    if ($service) {
        Write-Host "Trying to start MySQL service: $($service.Name)"
        try {
            Start-Service -Name $service.Name -ErrorAction Stop
        }
        catch {
            Write-Host "Failed to start MySQL service. Falling back to mysqld: $($_.Exception.Message)" -ForegroundColor Yellow
        }

        if (Wait-ForPort -Port 3306 -TimeoutSeconds 20) {
            Write-Host 'MySQL service started on port 3306'
            return
        }
    }

    $resolvedMySqlExe = Resolve-MySqlExe -PreferredExe $MySqlExe
    if (-not $resolvedMySqlExe) {
        throw 'mysqld.exe was not found. Install MySQL 8.x or pass -MySqlExe explicitly.'
    }

    if ([string]::IsNullOrWhiteSpace($MySqlDataDir)) {
        throw 'MySQL is not available as a Windows service and no -MySqlDataDir was provided. Start MySQL first or pass -MySqlDataDir explicitly.'
    }

    if (-not (Test-Path $MySqlDataDir)) {
        throw "MySQL data directory does not exist: $MySqlDataDir. Start a local MySQL service first or pass -MySqlDataDir."
    }

    $stdoutLog = Join-Path $logDir 'mysqld.out.log'
    $stderrLog = Join-Path $logDir 'mysqld.err.log'

    Write-Host "Trying to launch mysqld directly with data dir: $MySqlDataDir"
    Start-Process -FilePath $resolvedMySqlExe `
        -ArgumentList "--datadir=$MySqlDataDir", '--port=3306', '--mysqlx-port=33060', '--bind-address=127.0.0.1' `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog | Out-Null

    if (-not (Wait-ForPort -Port 3306 -TimeoutSeconds 20)) {
        throw "MySQL failed to start. See log: $stderrLog"
    }

    Write-Host 'MySQL started on port 3306'
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Write-Host '=== Qingjia Windows Dev Startup ===' -ForegroundColor Green

Write-Step '1. Check database'
Ensure-MySql

Write-Step '2. Start backend'
Test-ServerJPushConfig
Start-DevService -Name 'Backend' -Directory (Join-Path $projectRoot 'server') -Port 3000 -LogPrefix 'server-dev'

Write-Step '3. Start student app'
Start-DevService -Name 'Student app' -Directory (Join-Path $projectRoot 'student-app') -Port 5175 -LogPrefix 'student-dev'

Write-Step '4. Start teacher app'
Start-DevService -Name 'Teacher app' -Directory (Join-Path $projectRoot 'teacher-app') -Port 5174 -LogPrefix 'teacher-dev'

Write-Step '5. Start student iOS HTTPS'
Start-StudentIosProxy -Port 8443

Write-Step '6. URLs'
$lanIp = Get-PreferredLanIp
Write-Host 'Backend health: http://localhost:3000/health'
Write-Host 'Student app: http://localhost:5175'
Write-Host 'Teacher app: http://localhost:5174'
if ($lanIp) {
    Write-Host "Student iOS PWA: https://${lanIp}:8443"
} else {
    Write-Host 'Student iOS PWA: https://<LAN_IP>:8443'
}
Write-Host ''
Write-Host "Log directory: $logDir"
