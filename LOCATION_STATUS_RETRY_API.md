# Location Status & Retry APIs

## 📊 Check Status API

**GET** `/location/status/:stateName`

Get complete status of location data for a state.

### Example Request:
```bash
GET https://your-api.com/location/status/Telangana
```

### Response:
```json
{
  "state": "Telangana",
  "totalDistricts": 33,
  "totalMandals": 612,
  "totalVillages": 12345,
  "districtsWithMandals": 33,
  "districtsWithoutMandals": [],
  "mandalsWithoutVillages": [
    {
      "mandalId": "abc123",
      "mandalName": "Adilabad",
      "districtName": "Adilabad",
      "villageCount": 0
    }
  ]
}
```

---

## 🔄 Retry District Mandals API

**POST** `/location/retry/district/:districtId/mandals`

Retry populating mandals for a specific district that has 0 mandals.

### Headers:
```
Authorization: Bearer <JWT_TOKEN>
```

### Example Request:
```bash
POST https://your-api.com/location/retry/district/abc123/mandals
```

### Response:
```json
{
  "success": true,
  "district": "Adilabad",
  "mandalsCreated": 18,
  "mandals": [
    { "id": "m1", "name": "Adilabad Urban" },
    { "id": "m2", "name": "Bela" }
  ]
}
```

---

## 🔄 Retry Mandal Villages API

**POST** `/location/retry/mandal/:mandalId/villages`

Retry populating villages for a specific mandal that has 0 villages.

### Headers:
```
Authorization: Bearer <JWT_TOKEN>
```

### Example Request:
```bash
POST https://your-api.com/location/retry/mandal/m123/villages
```

### Response:
```json
{
  "success": true,
  "mandal": "Adilabad Urban",
  "district": "Adilabad",
  "villagesCreated": 45,
  "villages": [
    { "id": "v1", "name": "Village 1" },
    { "id": "v2", "name": "Village 2" }
  ]
}
```

---

## 🎯 Usage Flow

1. **Check Status**: `GET /location/status/Telangana`
   - See which districts are missing mandals
   - See which mandals are missing villages

2. **Retry Missing Data**:
   - For each district without mandals: `POST /location/retry/district/{id}/mandals`
   - For each mandal without villages: `POST /location/retry/mandal/{id}/villages`

3. **Re-check Status** to confirm completion

---

## 📝 Notes

- All retry APIs require authentication (Super Admin or Tenant Admin)
- APIs will return error if data already exists
- Uses ChatGPT with production-grade prompts
- Auto-translates to Telugu, Hindi, Kannada, Tamil, Marathi
