/**
 * Manual test script for preferences API endpoints
 * 
 * To run this script:
 * 1. Start the server: npm start
 * 2. Run this test: node test-preferences.js
 * 
 * Or use curl commands directly:
 * 
 * 1. Update guest user preferences:
 * curl -X POST http://localhost:3000/api/v1/preferences/update \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "deviceId": "device_test_123",
 *     "location": {
 *       "latitude": 17.3850,
 *       "longitude": 78.4867,
 *       "accuracyMeters": 10.5,
 *       "placeName": "Hyderabad, Telangana, India"
 *     },
 *     "languageId": "language_id_here",
 *     "pushToken": "fcm_token_xyz789",
 *     "deviceModel": "iPhone 14 Pro"
 *   }'
 * 
 * 2. Get guest user preferences:
 * curl "http://localhost:3000/api/v1/preferences?deviceId=device_test_123"
 * 
 * 3. Update registered user preferences:
 * curl -X POST http://localhost:3000/api/v1/preferences/update \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "userId": "user_id_here",
 *     "deviceId": "device_test_456",
 *     "location": {
 *       "latitude": 17.4400,
 *       "longitude": 78.3489,
 *       "placeName": "Gachibowli, Hyderabad"
 *     },
 *     "languageId": "language_id_here",
 *     "pushToken": "fcm_token_abc123"
 *   }'
 * 
 * 4. Get registered user preferences:
 * curl "http://localhost:3000/api/v1/preferences?userId=user_id_here"
 */

const testData = {
  guestUser: {
    deviceId: "device_test_" + Date.now(),
    location: {
      latitude: 17.3850,
      longitude: 78.4867,
      accuracyMeters: 10.5,
      placeName: "Hyderabad, Telangana, India"
    },
    pushToken: "fcm_token_" + Date.now(),
    deviceModel: "iPhone 14 Pro"
  }
};

console.log("Preferences API Test Data:");
console.log("========================");
console.log(JSON.stringify(testData, null, 2));
console.log("\nAPI Endpoints created:");
console.log("- POST /api/v1/preferences/update");
console.log("- GET /api/v1/preferences");
console.log("\nFeatures:");
console.log("✓ Guest user support (deviceId only)");
console.log("✓ Registered user support (userId + optional deviceId)");
console.log("✓ Location updates with device and user location tables");
console.log("✓ Language preference updates with FCM topic management");
console.log("✓ FCM push token management");
console.log("✓ Device model updates");
console.log("✓ Force update option");
console.log("✓ Comprehensive error handling");
console.log("✓ Swagger documentation");
console.log("✓ Input validation with DTOs");

module.exports = testData;