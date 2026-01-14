# Run Location Population for Single State
# Process ONE state completely: districts → mandals → villages

param(
    [Parameter(Mandatory=$true)]
    [string]$StateName,
    
    [Parameter(Mandatory=$false)]
    [string]$Languages = "te,hi,kn,ta,mr"
)

Write-Host "╔════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         LOCATION POPULATION - SINGLE STATE                                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "State to process: $StateName" -ForegroundColor Yellow
Write-Host "Languages: $Languages" -ForegroundColor Yellow
Write-Host ""
Write-Host "This will process the state completely:" -ForegroundColor Gray
Write-Host "  1. Create state + translations" -ForegroundColor Gray
Write-Host "  2. Get ALL districts → Store with translations" -ForegroundColor Gray
Write-Host "  3. For EACH district: Get ALL mandals → Store" -ForegroundColor Gray
Write-Host "  4. For first 10 mandals: Get villages → Store" -ForegroundColor Gray
Write-Host ""
Write-Host "⏱️  Estimated time: 5-15 minutes (depending on state)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to cancel, or wait 3 seconds to start..." -ForegroundColor Red
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "🚀 Starting processing for $StateName..." -ForegroundColor Green
Write-Host ""

# Run the worker with state name
npm run jobs:location-populate $StateName $Languages

Write-Host ""
Write-Host "✅ Processing completed!" -ForegroundColor Green
