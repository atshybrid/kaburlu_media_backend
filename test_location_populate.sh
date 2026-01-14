# Location AI Populate API - Test Script

# NOTE: Replace YOUR_JWT_TOKEN with actual admin JWT token

# =============================================================================
# TEST 1: Start Location Population Job for Telangana (Telugu)
# =============================================================================
echo "Test 1: Starting population job for Telangana..."

curl -X POST http://localhost:3001/location/ai/populate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stateName": "Telangana",
    "languageCode": "te"
  }'

# Expected Response:
# {
#   "success": true,
#   "jobId": "loc_1737691234567_abc123xyz",
#   "message": "Location population job queued..."
# }

# Copy the jobId from response and use it below

echo ""
echo "========================================="
echo ""

# =============================================================================
# TEST 2: Check Job Status (replace JOB_ID with actual job ID from Test 1)
# =============================================================================
echo "Test 2: Checking job status..."

JOB_ID="loc_1737691234567_abc123xyz"  # Replace with actual job ID

curl http://localhost:3001/location/ai/populate/status/$JOB_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected Response (while processing):
# {
#   "jobId": "loc_1737691234567_abc123xyz",
#   "stateName": "Telangana",
#   "languageCode": "te",
#   "status": "processing",
#   "progress": {
#     "currentStep": "Processing district: Adilabad",
#     "districtsProcessed": 5,
#     "totalDistricts": 33,
#     "mandalsProcessed": 87,
#     "villagesProcessed": 0
#   },
#   "startedAt": "2026-01-14T10:30:00.000Z",
#   "completedAt": null
# }

echo ""
echo "========================================="
echo ""

# =============================================================================
# TEST 3: List All Jobs
# =============================================================================
echo "Test 3: Listing all jobs..."

curl http://localhost:3001/location/ai/populate/jobs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected Response:
# {
#   "count": 1,
#   "jobs": [
#     {
#       "jobId": "loc_1737691234567_abc123xyz",
#       "stateName": "Telangana",
#       "languageCode": "te",
#       "status": "completed",
#       "progress": { ... },
#       "startedAt": "2026-01-14T10:30:00.000Z",
#       "completedAt": "2026-01-14T10:45:00.000Z"
#     }
#   ]
# }

echo ""
echo "========================================="
echo ""

# =============================================================================
# TEST 4: Verify Database Has New Data
# =============================================================================
echo "Test 4: Verify data in database..."
echo "Run these SQL queries in your database client:"
echo ""
echo "-- Check State"
echo "SELECT * FROM \"State\" WHERE name = 'Telangana';"
echo ""
echo "-- Check State Translation"
echo "SELECT * FROM \"StateTranslation\" WHERE language = 'te';"
echo ""
echo "-- Check Districts"
echo "SELECT d.*, dt.name as telugu_name FROM \"District\" d"
echo "LEFT JOIN \"DistrictTranslation\" dt ON d.id = dt.\"districtId\" AND dt.language = 'te'"
echo "WHERE d.\"stateId\" = (SELECT id FROM \"State\" WHERE name = 'Telangana');"
echo ""
echo "-- Check Mandals"
echo "SELECT m.*, mt.name as telugu_name FROM \"Mandal\" m"
echo "LEFT JOIN \"MandalTranslation\" mt ON m.id = mt.\"mandalId\" AND mt.language = 'te'"
echo "LIMIT 20;"
echo ""
echo "========================================="

# =============================================================================
# TEST 5: Test with Different State (Karnataka - Kannada)
# =============================================================================
echo ""
echo "Test 5: Testing with Karnataka (Kannada)..."

curl -X POST http://localhost:3001/location/ai/populate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stateName": "Karnataka",
    "languageCode": "kn"
  }'

echo ""
echo "========================================="
echo "Tests complete!"
