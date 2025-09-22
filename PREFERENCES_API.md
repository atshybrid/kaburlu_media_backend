# Preferences API

The Preferences API provides unified endpoints for managing user preferences including location, language, and FCM push tokens for both guest users and registered users.

## Features

- **Unified User Management**: Handles both guest users (device-based) and registered users (user-based)
- **Location Updates**: Updates location data in both Device and UserLocation tables
- **Language Management**: Updates language preferences with automatic FCM topic subscription
- **FCM Token Management**: Manages push notification tokens with topic subscriptions
- **Device Information**: Tracks device model and metadata
- **Force Update**: Option to update even when values haven't changed
- **Comprehensive Validation**: Input validation using DTOs and class-validator
- **Error Handling**: Detailed error responses with specific error codes

## Endpoints

### Update User Preferences
`POST /api/v1/preferences/update`

Updates user preferences including location, language, and FCM push tokens.

**Request Body:**
```json
{
  "deviceId": "device_123456",        // Required for guest users
  "userId": "user_789012",            // Required for registered users
  "location": {
    "latitude": 17.3850,
    "longitude": 78.4867,
    "accuracyMeters": 10.5,
    "placeId": "ChIJLfyY2E4VzDsRVK0_IyBnwF4",
    "placeName": "Hyderabad, Telangana, India",
    "address": "123 Street Name, Hyderabad, Telangana 500001",
    "source": "GPS"
  },
  "languageId": "lang_english_001",
  "pushToken": "fcm_token_xyz789",
  "deviceModel": "iPhone 14 Pro",
  "forceUpdate": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Preferences updated successfully",
  "data": {
    "user": {
      "id": "user_id",
      "languageId": "lang_english_001",
      "languageCode": "en",
      "languageName": "English",
      "role": "GUEST",
      "isGuest": true
    },
    "device": {
      "id": "device_id",
      "deviceId": "device_123456",
      "deviceModel": "iPhone 14 Pro",
      "hasPushToken": true,
      "location": {
        "latitude": 17.3850,
        "longitude": 78.4867,
        "accuracyMeters": 10.5,
        "placeId": "ChIJLfyY2E4VzDsRVK0_IyBnwF4",
        "placeName": "Hyderabad, Telangana, India",
        "address": "123 Street Name, Hyderabad, Telangana 500001",
        "source": "GPS"
      }
    },
    "updates": {
      "languageChanged": true,
      "locationChanged": true,
      "pushTokenChanged": true,
      "deviceModelChanged": false
    }
  }
}
```

### Get User Preferences
`GET /api/v1/preferences?deviceId=xxx` or `GET /api/v1/preferences?userId=xxx`

Retrieves current user preferences.

**Query Parameters:**
- `deviceId`: Device identifier (for guest users)
- `userId`: User identifier (for registered users)

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "languageId": "lang_english_001",
      "languageCode": "en",
      "languageName": "English",
      "role": "GUEST",
      "isGuest": true,
      "status": "ACTIVE"
    },
    "device": {
      "id": "device_id",
      "deviceId": "device_123456",
      "deviceModel": "iPhone 14 Pro",
      "hasPushToken": true,
      "location": {
        "latitude": 17.3850,
        "longitude": 78.4867,
        "accuracyMeters": 10.5,
        "placeId": "ChIJLfyY2E4VzDsRVK0_IyBnwF4",
        "placeName": "Hyderabad, Telangana, India",
        "address": "123 Street Name, Hyderabad, Telangana 500001",
        "source": "GPS"
      }
    },
    "userLocation": null  // Only for registered users
  }
}
```

## Usage Scenarios

### 1. Guest User (Device-based)
For users who haven't registered but are using the app:

```javascript
// Update guest user preferences
const response = await fetch('/api/v1/preferences/update', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceId: 'device_unique_id',
    location: {
      latitude: 17.3850,
      longitude: 78.4867,
      placeName: 'Hyderabad, Telangana, India'
    },
    languageId: 'lang_telugu_001',
    pushToken: 'fcm_token_from_firebase'
  })
});
```

### 2. Registered User
For users who have registered accounts:

```javascript
// Update registered user preferences
const response = await fetch('/api/v1/preferences/update', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer jwt_token_here'
  },
  body: JSON.stringify({
    userId: 'user_account_id',
    deviceId: 'device_unique_id', // Optional but recommended
    location: {
      latitude: 17.4400,
      longitude: 78.3489,
      placeName: 'Gachibowli, Hyderabad'
    },
    languageId: 'lang_english_001'
  })
});
```

### 3. FCM Push Token Updates
When FCM tokens refresh:

```javascript
// Update only push token
const response = await fetch('/api/v1/preferences/update', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceId: 'device_unique_id',
    pushToken: 'new_fcm_token_after_refresh'
  })
});
```

### 4. Language Changes
When user changes language preference:

```javascript
// Change language (will update FCM topic subscriptions)
const response = await fetch('/api/v1/preferences/update', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    deviceId: 'device_unique_id',
    languageId: 'lang_hindi_001'
  })
});
```

## Error Handling

The API provides detailed error responses:

```json
{
  "success": false,
  "message": "Either deviceId or userId is required",
  "code": "MISSING_IDENTIFIER"
}
```

**Error Codes:**
- `MISSING_IDENTIFIER`: Neither deviceId nor userId provided
- `INVALID_LANGUAGE`: Invalid languageId provided
- `USER_NOT_FOUND`: User not found
- `DEVICE_NOT_FOUND`: Device not found
- `MISSING_GUEST_ROLE`: Guest role not configured
- `MISSING_DEFAULT_LANGUAGE`: Default language not configured
- `RESOLUTION_FAILED`: Failed to resolve user and device

## Database Impact

### Guest Users
- Creates User record with GUEST role
- Creates Device record linked to user
- Updates Device location fields

### Registered Users
- Updates existing User record
- Creates/updates Device record if deviceId provided
- Updates UserLocation table separately
- Maintains both device-level and user-level location data

## FCM Integration

The API automatically manages FCM topic subscriptions:

1. **Language Changes**: 
   - Unsubscribes from old language topic (`news-lang-{oldCode}`)
   - Subscribes to new language topic (`news-lang-{newCode}`)

2. **Token Management**:
   - Updates device push tokens
   - Cleans up invalid tokens automatically

## Security Considerations

- No authentication required (supports both guest and registered users)
- Input validation prevents injection attacks
- Error messages don't expose sensitive information
- FCM token errors are handled gracefully as non-fatal

## Testing

Use the provided test file `test-preferences.js` or curl commands:

```bash
# Test guest user update
curl -X POST http://localhost:3000/api/v1/preferences/update \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test_device","location":{"latitude":17.3850,"longitude":78.4867}}'

# Test preferences retrieval
curl "http://localhost:3000/api/v1/preferences?deviceId=test_device"
```