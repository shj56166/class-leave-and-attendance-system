[CmdletBinding()]
param(
    [Parameter()]
    [string]$IpAddress
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$httpsPort = 8443
$studentHttpPort = 8090
$teacherHttpPort = 8091
$repoRoot = Split-Path -Parent $PSScriptRoot
$sslDir = Join-Path $repoRoot 'ssl'
$certPath = Join-Path $sslDir 'student-local.pem'
$keyPath = Join-Path $sslDir 'student-local-key.pem'

function Test-PrivateIpv4 {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Address
    )

    return $Address -match '^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})$'
}

function Get-PreferredLanIp {
    $candidates = @()

    try {
        $configs = Get-NetIPConfiguration | Where-Object { $_.IPv4Address }

        foreach ($config in $configs) {
            foreach ($entry in $config.IPv4Address) {
                $candidateIp = $entry.IPAddress

                if (-not (Test-PrivateIpv4 -Address $candidateIp)) {
                    continue
                }

                $candidates += [PSCustomObject]@{
                    IPAddress       = $candidateIp
                    HasGateway      = [bool]$config.IPv4DefaultGateway
                    InterfaceMetric = if ($null -ne $config.InterfaceMetric) { [int]$config.InterfaceMetric } else { 9999 }
                }
            }
        }
    } catch {
    }

    if (-not $candidates) {
        throw "No private LAN IPv4 address was detected automatically. Re-run the script with -IpAddress, for example: powershell -ExecutionPolicy Bypass -File .\scripts\generate-local-ios-cert.ps1 -IpAddress 192.168.1.100"
    }

    $selected = $candidates |
        Sort-Object -Property `
            @{ Expression = { if ($_.HasGateway) { 0 } else { 1 } } }, `
            @{ Expression = { $_.InterfaceMetric } } |
        Select-Object -First 1

    return $selected.IPAddress
}

if (-not $IpAddress) {
    $IpAddress = Get-PreferredLanIp
}

if (-not (Test-PrivateIpv4 -Address $IpAddress)) {
    throw "The detected IP '$IpAddress' is not a supported private LAN IPv4 address. Use a 10.x, 172.16-31.x, or 192.168.x.x address instead."
}

$mkcert = Get-Command mkcert -ErrorAction SilentlyContinue

if (-not $mkcert) {
    throw "mkcert was not found in PATH. Install mkcert first, then run this script again."
}

New-Item -ItemType Directory -Path $sslDir -Force | Out-Null

Write-Host "Using LAN IP: $IpAddress"
Write-Host "Installing or validating the local mkcert root CA..."
& $mkcert.Source -install

Write-Host "Generating the student HTTPS certificate..."
& $mkcert.Source -cert-file $certPath -key-file $keyPath $IpAddress

$caroot = (& $mkcert.Source -CAROOT).Trim()
$rootCaPath = Join-Path $caroot 'rootCA.pem'
$httpsOrigin = "https://${IpAddress}:$httpsPort"
$allowedOrigins = "http://${IpAddress}:$studentHttpPort,http://${IpAddress}:$teacherHttpPort,$httpsOrigin"

Write-Host ""
Write-Host "Student iOS local HTTPS certificate generated successfully."
Write-Host "HTTPS URL: $httpsOrigin"
Write-Host "Certificate file: $certPath"
Write-Host "Private key file: $keyPath"
Write-Host "mkcert root CA: $rootCaPath"
Write-Host ""
Write-Host "Send the mkcert root CA to the iPhone, then enable trust in Settings > General > About > Certificate Trust Settings."
Write-Host ""
Write-Host "Update ALLOWED_ORIGINS in .env / server/.env:"
Write-Host "ALLOWED_ORIGINS=$allowedOrigins"
