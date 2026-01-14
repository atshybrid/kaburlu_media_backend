# Location AI Populate API - Test Script (PowerShell)

# NOTE: Replace YOUR_JWT_TOKEN with actual admin JWT token
$JWT_TOKEN = "YOUR_JWT_TOKEN"
$BASE_URL = "http://localhost:3001"

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "TEST 1: Start Processing Telangana State (Complete)" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

$body1 = @{
    stateName = "Telangana"
    languages = @("te", "hi", "kn")
} | ConvertTo-Json

try {
    $response1 = Invoke-RestMethod -Uri "$BASE_URL/location/ai/populate/state" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $JWT_TOKEN"
            "Content-Type" = "application/json"
        } `
        -Body $body1

    Write-Host "Response:" -ForegroundColor Green
    $response1 | ConvertTo-Json -Depth 5
    
    $jobId = $response1.jobId
    Write-Host ""
    Write-Host "Job ID: $jobId" -ForegroundColor Yellow
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Waiting 5 seconds before checking status..." -ForegroundColor Gray
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "TEST 2: Check Job Status" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

if ($jobId) {
    try {
        $response2 = Invoke-RestMethod -Uri "$BASE_URL/location/ai/populate/status/$jobId" `
            -Method Get `
            -Headers @{
                "Authorization" = "Bearer $JWT_TOKEN"
            }

        Write-Host "Job Status:" -ForegroundColor Green
        $response2 | ConvertTo-Json -Depth 5
        
    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "TEST 3: List All Jobs" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

try {
    $response3 = Invoke-RestMethod -Uri "$BASE_URL/location/ai/populate/jobs" `
        -Method Get `
        -Headers @{
            "Authorization" = "Bearer $JWT_TOKEN"
        }

    Write-Host "All Jobs:" -ForegroundColor Green
    $response3 | ConvertTo-Json -Depth 5
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "TEST 4: Poll Job Status Until Complete" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

if ($jobId) {
    $maxAttempts = 60  # Poll for max 5 minutes (60 * 5 seconds)
    $attempt = 0
    $completed = $false

    while (-not $completed -and $attempt -lt $maxAttempts) {
        $attempt++
        
        try {
            $status = Invoke-RestMethod -Uri "$BASE_URL/location/ai/populate/status/$jobId" `
                -Method Get `
                -Headers @{
                    "Authorization" = "Bearer $JWT_TOKEN"
                }

            $statusText = $status.status
            $currentStep = $status.progress.currentStep
            $districtsProcessed = $status.progress.districtsProcessed
            $totalDistricts = $status.progress.totalDistricts
            $mandalsProcessed = $status.progress.mandalsProcessed
            $villagesProcessed = $status.progress.villagesProcessed

            Write-Host "[$attempt] Status: $statusText | $currentStep" -ForegroundColor Cyan
            Write-Host "    Districts: $districtsProcessed/$totalDistricts | Mandals: $mandalsProcessed | Villages: $villagesProcessed" -ForegroundColor Gray

            if ($statusText -eq "completed") {
                Write-Host ""
                Write-Host "✓ Job completed successfully!" -ForegroundColor Green
                $completed = $true
            } elseif ($statusText -eq "failed") {
                Write-Host ""
                Write-Host "✗ Job failed: $($status.error)" -ForegroundColor Red
                $completed = $true
            } else {
                Start-Sleep -Seconds 5
            }
            
        } catch {
            Write-Host "Error checking status: $_" -ForegroundColor Red
            break
        }
    }

    if (-not $completed) {
        Write-Host ""
        Write-Host "Timeout: Job still processing after 5 minutes" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "TEST 5: Database Verification Queries" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run these SQL queries in your database client to verify data:" -ForegroundColor Yellow
Write-Host ""
Write-Host "-- Check State" -ForegroundColor White
Write-Host 'SELECT * FROM "State" WHERE name = ''Telangana'';' -ForegroundColor Gray
Write-Host ""
Write-Host "-- Check State Translation" -ForegroundColor White
Write-Host 'SELECT * FROM "StateTranslation" WHERE language = ''te'';' -ForegroundColor Gray
Write-Host ""
Write-Host "-- Check Districts with Telugu names" -ForegroundColor White
Write-Host 'SELECT d.*, dt.name as telugu_name FROM "District" d' -ForegroundColor Gray
Write-Host 'LEFT JOIN "DistrictTranslation" dt ON d.id = dt."districtId" AND dt.language = ''te''' -ForegroundColor Gray
Write-Host 'WHERE d."stateId" = (SELECT id FROM "State" WHERE name = ''Telangana'');' -ForegroundColor Gray
Write-Host ""
Write-Host "-- Check Mandals with Telugu names" -ForegroundColor White
Write-Host 'SELECT m.*, mt.name as telugu_name FROM "Mandal" m' -ForegroundColor Gray
Write-Host 'LEFT JOIN "MandalTranslation" mt ON m.id = mt."mandalId" AND mt.language = ''te''' -ForegroundColor Gray
Write-Host 'LIMIT 20;' -ForegroundColor Gray
Write-Host ""

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "TEST 6: Test with Karnataka (Complete)" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

$body6 = @{
    stateName = "Karnataka"
    languages = @("kn", "te", "hi")
} | ConvertTo-Json

try {
    $response6 = Invoke-RestMethod -Uri "$BASE_URL/location/ai/populate/state" `
        -Method Post `
        -Headers @{
            "Authorization" = "Bearer $JWT_TOKEN"
            "Content-Type" = "application/json"
        } `
        -Body $body6

    Write-Host "Karnataka Job Response:" -ForegroundColor Green
    $response6 | ConvertTo-Json -Depth 5
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "All tests complete!" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
