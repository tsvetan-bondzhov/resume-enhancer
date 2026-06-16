# sonar-check.ps1
# Runs sonar-scanner with quality gate enforcement and prints enriched failure details.
# Usage: .\scripts\sonar-check.ps1
# Requires SONAR_TOKEN env var if your SonarQube instance requires authentication.

param(
    [string]$SonarToken = $env:SONAR_TOKEN
)

$ReportTaskFile = ".scannerwork\report-task.txt"

# --- Run the scan (sonar-project.properties sets qualitygate.wait=true) ---
Write-Host "Running sonar-scanner..."
sonar-scanner
$ScanExitCode = $LASTEXITCODE

if ($ScanExitCode -eq 0) {
    Write-Host "`nQuality Gate PASSED"
    exit 0
}

Write-Host "`nQuality Gate FAILED. Fetching details...`n"

# --- Parse report-task.txt ---
if (-not (Test-Path $ReportTaskFile)) {
    Write-Error "Could not find $ReportTaskFile - scanner may not have completed."
    exit 1
}

$props = @{}
Get-Content $ReportTaskFile | ForEach-Object {
    if ($_ -match "^([^=]+)=(.+)$") { $props[$matches[1]] = $matches[2] }
}

$ServerUrl = $props["serverUrl"]
$CeTaskId  = $props["ceTaskId"]
$ProjectKey = $props["projectKey"]

if (-not $ServerUrl -or -not $CeTaskId) {
    Write-Error "Could not read serverUrl or ceTaskId from $ReportTaskFile"
    exit 1
}

# --- Build auth header (blank password for token-based auth) ---
$Headers = @{}
if ($SonarToken) {
    $EncodedCreds = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${SonarToken}:"))
    $Headers["Authorization"] = "Basic $EncodedCreds"
}

# --- Wait for CE task to finish (qualitygate.wait should cover this, but be safe) ---
$AnalysisId = $null
for ($i = 0; $i -lt 30; $i++) {
    try {
        $Task = Invoke-RestMethod "$ServerUrl/api/ce/task?id=$CeTaskId" -Headers $Headers
    } catch {
        Write-Error "Failed to query CE task: $_"
        exit 1
    }
    if ($Task.task.status -notin @("IN_QUEUE", "PENDING")) {
        $AnalysisId = $Task.task.analysisId
        break
    }
    Start-Sleep -Seconds 3
}

if (-not $AnalysisId) {
    Write-Error "Timed out waiting for analysis task to complete."
    exit 1
}

# --- Quality Gate conditions ---
try {
    $QGStatus = Invoke-RestMethod "$ServerUrl/api/qualitygates/project_status?analysisId=$AnalysisId" -Headers $Headers
} catch {
    Write-Error "Failed to query quality gate status: $_"
    exit 1
}

$FailedConditions = $QGStatus.projectStatus.conditions | Where-Object { $_.status -eq "ERROR" }

Write-Host "=== Failing Quality Gate Conditions ==="
foreach ($c in $FailedConditions) {
    Write-Host "  [FAIL] $($c.metricKey)"
    Write-Host "         Actual: $($c.actualValue)  |  Threshold: $($c.errorThreshold)"
}

# --- Fetch open issues ---
try {
    $Issues = Invoke-RestMethod "$ServerUrl/api/issues/search?projectKeys=$ProjectKey&resolved=false&ps=20" -Headers $Headers
} catch {
    Write-Error "Failed to query issues: $_"
    exit 1
}

if ($Issues.issues.Count -gt 0) {
    Write-Host "`n=== Open Issues (up to 20) ==="
    foreach ($issue in $Issues.issues) {
        $Component = $issue.component -replace "^${ProjectKey}:", ""
        $Line = if ($issue.line) { "line $($issue.line)" } else { "no line" }
        Write-Host "  [$($issue.severity)] $($issue.rule)"
        Write-Host "         $Component ($Line)"
        Write-Host "         $($issue.message)"
    }
}

Write-Host "`nPush BLOCKED: fix the issues above and try again."
exit 1
