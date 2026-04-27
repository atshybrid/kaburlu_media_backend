# SuperAdmin — Journalist Union All API Endpoints

> **Base URL:** `https://api.kaburlu.com/api/v1`  
> **Auth:** `Authorization: Bearer <superadmin_jwt_token>`  
> **Note:** SuperAdmin passes all journalist union admin checks automatically — no union scope restriction.  
> For admin endpoints, SuperAdmin **must pass `unionName`** in body/query (scoped admins don't need it).

---

## Quick Index

| # | Method | Endpoint | Access Level |
|---|--------|----------|-------------|
| 1 | POST | `/journalist/admin/assign-union-admin` | SuperAdmin only |
| 2 | GET | `/journalist/admin/union-admins` | SuperAdmin only |
| 3 | DELETE | `/journalist/admin/union-admins/:id` | SuperAdmin only |
| 4 | POST | `/journalist/admin/posts/seed-defaults` | SuperAdmin only |
| 5 | GET | `/journalist/admin/settings` | Admin + SuperAdmin |
| 6 | PUT | `/journalist/admin/settings` | Admin + SuperAdmin |
| 7 | PUT | `/journalist/admin/settings/state` | Admin + SuperAdmin |
| 8 | POST | `/journalist/admin/settings/upload` | Admin + SuperAdmin |
| 9 | POST | `/journalist/admin/settings/state/upload` | Admin + SuperAdmin |
| 10 | GET | `/journalist/admin/applications` | Admin + SuperAdmin |
| 11 | PATCH | `/journalist/admin/approve/:id` | Admin + SuperAdmin |
| 12 | POST | `/journalist/admin/generate-card` | Admin + SuperAdmin |
| 13 | PATCH | `/journalist/admin/cards/:profileId` | Admin + SuperAdmin |
| 14 | POST | `/journalist/admin/cards/:profileId/generate-pdf` | Admin + SuperAdmin |
| 15 | GET | `/journalist/admin/cards/renewal-due` | Admin + SuperAdmin |
| 16 | PATCH | `/journalist/admin/cards/:profileId/renew` | Admin + SuperAdmin |
| 17 | GET | `/journalist/admin/complaints` | Admin + SuperAdmin |
| 18 | PATCH | `/journalist/admin/complaints/:id` | Admin + SuperAdmin |
| 19 | POST | `/journalist/admin/updates` | Admin + SuperAdmin |
| 20 | DELETE | `/journalist/admin/updates/:id` | Admin + SuperAdmin |
| 21 | PATCH | `/journalist/admin/kyc/verify/:profileId` | Admin + SuperAdmin |
| 22 | POST | `/journalist/admin/insurance` | Admin + SuperAdmin |
| 23 | PATCH | `/journalist/admin/insurance/:id` | Admin + SuperAdmin |
| 24 | GET | `/journalist/admin/insurance/member/:profileId` | Admin + SuperAdmin |
| 25 | POST | `/journalist/admin/posts/appoint` | Admin + SuperAdmin |
| 26 | PATCH | `/journalist/admin/posts/holders/:id` | Admin + SuperAdmin |
| 27 | DELETE | `/journalist/admin/posts/holders/:id` | Admin + SuperAdmin |

---

## 1. Assign Union Admin

**`POST /journalist/admin/assign-union-admin`**

```json
// Request Body
{
  "userId": "clxxx001",
  "unionName": "Telangana Working Journalists Federation",
  "state": "Telangana"
}
```

```json
// Response 201
{
  "message": "Union admin assigned successfully",
  "note": "User can now access journalist union admin endpoints for this union.",
  "unionAdmin": {
    "id": "ua_001",
    "userId": "clxxx001",
    "unionName": "Telangana Working Journalists Federation",
    "state": "Telangana",
    "createdAt": "2026-04-28T10:00:00Z"
  }
}
```

```json
// Error 400 — Already assigned
{ "error": "User is already a union admin for this union" }

// Error 404 — User not found
{ "error": "User not found" }
```

---

## 2. List All Union Admins

**`GET /journalist/admin/union-admins`**

No query params needed.

```json
// Response 200
[
  {
    "id": "ua_001",
    "userId": "clxxx001",
    "unionName": "Telangana Working Journalists Federation",
    "state": "Telangana",
    "user": {
      "mobileNumber": "9876543210",
      "email": "admin@twjf.org",
      "role": { "name": "TENANT_ADMIN" },
      "profile": { "fullName": "Ravi Kumar" }
    }
  },
  {
    "id": "ua_002",
    "userId": "clxxx003",
    "unionName": "AP Journalists Union",
    "state": "Andhra Pradesh",
    "user": {
      "mobileNumber": "9876500001",
      "email": null,
      "role": { "name": "CITIZEN_REPORTER" },
      "profile": { "fullName": "Suresh Babu" }
    }
  }
]
```

---

## 3. Remove a Union Admin

**`DELETE /journalist/admin/union-admins/:id`**

```
DELETE /journalist/admin/union-admins/ua_001
```

```json
// Response 200
{ "message": "Union admin removed" }

// Error 404
{ "error": "Union admin record not found" }
```

---

## 4. Seed Default Post Definitions

**`POST /journalist/admin/posts/seed-defaults`**

Creates all default posts (State → District → Mandal → City → Special Wing) for a union. Safe to re-run.

```json
// Request Body
{
  "unionName": "Telangana Working Journalists Federation"
}
```

```json
// Response 201 — First run
{
  "message": "Default posts seeded",
  "created": 28,
  "total": 28
}

// Response 200 — Already seeded
{
  "message": "All default posts already exist for this union",
  "created": 0
}
```

Posts created per level:

| Level | Count | Examples |
|-------|-------|---------|
| STATE | 12 | State President, General Secretary, Treasurer, VP (×5) |
| DISTRICT | 7 | District President, General Secretary, VP (×2), Treasurer |
| MANDAL | 3 | Mandal President, Secretary, Member |
| CITY | 2 | City President, City Secretary |
| SPECIAL_WING | 4 | Women Wing, Youth Wing, Digital Media, Social Media |

---

## 5. Get Union Settings

**`GET /journalist/admin/settings?unionName=<union>`**

> SuperAdmin **must** pass `?unionName=` query param.

```
GET /journalist/admin/settings?unionName=Telangana Working Journalists Federation
```

```json
// Response 200
{
  "id": "sett_001",
  "unionName": "Telangana Working Journalists Federation",
  "displayName": "TWJF — Telangana Working Journalists Federation",
  "registrationNumber": "REG/TG/2005/001",
  "address": "Press Club Road, Hyderabad - 500001",
  "states": ["Telangana"],
  "primaryState": "Telangana",
  "foundedYear": 2005,
  "email": "contact@twjf.org",
  "phone": "04023001234",
  "websiteUrl": "https://twjf.org",
  "logoUrl": "https://r2.kaburlu.com/journalist-union/twjf/assets/logo.png",
  "idCardLogoUrl": "https://r2.kaburlu.com/journalist-union/twjf/assets/idCardLogo.png",
  "stampUrl": "https://r2.kaburlu.com/journalist-union/twjf/assets/stamp.png",
  "forStampUrl": null,
  "stateConfigs": [
    {
      "id": "sc_001",
      "unionName": "Telangana Working Journalists Federation",
      "state": "Telangana",
      "address": "Hyderabad",
      "email": "telangana@twjf.org",
      "phone": null,
      "presidentSignatureUrl": "https://r2.kaburlu.com/.../presidentSignature.png",
      "stateLogo": null
    }
  ]
}

// If not yet configured:
{ "unionName": "...", "configured": false }
```

---

## 6. Update Union Settings (Text)

**`PUT /journalist/admin/settings`**

```json
// Request Body (pass only fields to update)
{
  "unionName": "Telangana Working Journalists Federation",
  "displayName": "TWJF — Telangana Working Journalists Federation",
  "registrationNumber": "REG/TG/2005/001",
  "address": "Press Club Road, Hyderabad - 500001",
  "states": ["Telangana"],
  "primaryState": "Telangana",
  "foundedYear": 2005,
  "email": "contact@twjf.org",
  "phone": "04023001234",
  "websiteUrl": "https://twjf.org"
}
```

```json
// Response 200
{
  "message": "Settings saved",
  "settings": {
    "id": "sett_001",
    "unionName": "Telangana Working Journalists Federation",
    "displayName": "TWJF — Telangana Working Journalists Federation",
    "registrationNumber": "REG/TG/2005/001",
    "address": "Press Club Road, Hyderabad - 500001",
    "states": ["Telangana"],
    "primaryState": "Telangana",
    "foundedYear": 2005,
    "email": "contact@twjf.org",
    "phone": "04023001234",
    "websiteUrl": "https://twjf.org",
    "logoUrl": null,
    "idCardLogoUrl": null,
    "stampUrl": null,
    "forStampUrl": null,
    "stateConfigs": []
  }
}
```

---

## 7. Update State-Specific Settings

**`PUT /journalist/admin/settings/state`**

```json
// Request Body
{
  "unionName": "Telangana Working Journalists Federation",
  "state": "Telangana",
  "address": "Press Club Road, Hyderabad - 500001",
  "email": "telangana@twjf.org",
  "phone": "9876000001"
}
```

```json
// Response 200
{
  "message": "State settings saved",
  "stateConfig": {
    "id": "sc_001",
    "unionName": "Telangana Working Journalists Federation",
    "state": "Telangana",
    "address": "Press Club Road, Hyderabad - 500001",
    "email": "telangana@twjf.org",
    "phone": "9876000001",
    "presidentSignatureUrl": null,
    "stateLogo": null
  }
}
```

---

## 8. Upload Union Asset (Logo / Stamp)

**`POST /journalist/admin/settings/upload`**  
**Content-Type:** `multipart/form-data`

| Field | Value |
|-------|-------|
| `file` | Image file (any format → converted to PNG) |
| `field` | `logo` \| `idCardLogo` \| `stamp` \| `forStamp` |
| `unionName` | Required for SuperAdmin |

```
// Example curl
curl -X POST https://api.kaburlu.com/api/v1/journalist/admin/settings/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/logo.png" \
  -F "field=logo" \
  -F "unionName=Telangana Working Journalists Federation"
```

```json
// Response 200
{
  "field": "logo",
  "url": "https://r2.kaburlu.com/journalist-union/telangana_working_journalists_federation/assets/logo.png",
  "settings": { /* full settings object */ }
}
```

---

## 9. Upload State Asset (President Signature)

**`POST /journalist/admin/settings/state/upload`**  
**Content-Type:** `multipart/form-data`

| Field | Value |
|-------|-------|
| `file` | Image file → converted to PNG |
| `field` | `presidentSignature` \| `stateLogo` |
| `state` | e.g. `Telangana` |
| `unionName` | Required for SuperAdmin |

```json
// Response 200
{
  "field": "presidentSignature",
  "state": "Telangana",
  "url": "https://r2.kaburlu.com/journalist-union/twjf/states/telangana/presidentSignature.png",
  "stateConfig": {
    "id": "sc_001",
    "state": "Telangana",
    "presidentSignatureUrl": "https://r2.kaburlu.com/.../presidentSignature.png",
    "stateLogo": null
  }
}
```

---

## 10. List Applications

**`GET /journalist/admin/applications`**

| Query Param | Values | Default |
|-------------|--------|---------|
| `approved` | `false` \| `true` \| `all` | `false` |
| `district` | string | — |
| `kycVerified` | `true` \| `false` | — |
| `page` | integer | 1 |
| `limit` | 1–100 | 20 |

```
GET /journalist/admin/applications?approved=false&page=1&limit=20
```

```json
// Response 200
{
  "total": 42,
  "page": 1,
  "limit": 20,
  "data": [
    {
      "id": "jp_001",
      "designation": "Senior Reporter",
      "district": "Hyderabad",
      "organization": "Sakshi TV",
      "unionName": "Telangana Working Journalists Federation",
      "state": "Telangana",
      "mandal": "Secunderabad",
      "approved": false,
      "approvedAt": null,
      "pressId": null,
      "kycVerified": false,
      "photoUrl": null,
      "aadhaarUrl": null,
      "createdAt": "2026-04-01T10:00:00Z",
      "user": {
        "mobileNumber": "9876543210",
        "email": null,
        "profile": { "fullName": "Ravi Kumar" }
      },
      "card": null
    }
  ]
}
```

---

## 11. Approve / Reject Application

**`PATCH /journalist/admin/approve/:id`**

```json
// Approve with Press ID
{
  "approved": true,
  "pressId": "TWJF-2026-001"
}

// Approve without Press ID
{
  "approved": true
}

// Reject
{
  "approved": false
}
```

```json
// Response 200 — Approved
{
  "message": "Application approved",
  "profile": {
    "id": "jp_001",
    "approved": true,
    "approvedAt": "2026-04-28T10:00:00Z",
    "rejectedAt": null,
    "pressId": "TWJF-2026-001"
  }
}

// Response 200 — Rejected
{
  "message": "Application rejected",
  "profile": {
    "id": "jp_001",
    "approved": false,
    "rejectedAt": "2026-04-28T10:00:00Z"
  }
}

// Error 409 — pressId duplicate
{ "error": "pressId already in use" }
```

---

## 12. Generate Press Card

**`POST /journalist/admin/generate-card`**

> Journalist must be **approved** first. PDF generated in background (non-blocking).

```json
// Request Body
{
  "profileId": "jp_001",
  "expiryDate": "2027-04-28"
}
// expiryDate is optional → defaults to 1 year from today
```

```json
// Response 201
{
  "message": "Press card generated",
  "card": {
    "id": "jc_001",
    "profileId": "jp_001",
    "cardNumber": "JU-1745833200000",
    "status": "ACTIVE",
    "expiryDate": "2027-04-28T00:00:00Z",
    "pdfUrl": null,
    "renewalCount": 0,
    "pendingRenewal": false,
    "createdAt": "2026-04-28T10:00:00Z"
  }
}

// Error 400 — Not approved
{ "error": "Journalist is not yet approved" }

// Error 400 — Card exists
{
  "error": "Press card already exists for this journalist",
  "card": { /* existing card */ }
}

// Error 404
{ "error": "Journalist profile not found" }
```

---

## 13. Update Press Card

**`PATCH /journalist/admin/cards/:profileId`**

```json
// Request Body (any combination)
{
  "expiryDate": "2028-12-31",
  "qrCode": "https://api.kaburlu.com/api/v1/journalist/press-card/pdf?cardNumber=JU-1745833200000",
  "pdfUrl": "https://r2.kaburlu.com/journalist-union/press-cards/jp_001.pdf"
}
```

```json
// Response 200
{
  "message": "Card updated",
  "card": {
    "id": "jc_001",
    "profileId": "jp_001",
    "cardNumber": "JU-1745833200000",
    "status": "ACTIVE",
    "expiryDate": "2028-12-31T00:00:00Z",
    "pdfUrl": "https://r2.kaburlu.com/.../jp_001.pdf",
    "renewalCount": 0
  }
}
```

---

## 14. Re-generate Press Card PDF

**`POST /journalist/admin/cards/:profileId/generate-pdf`**

```
POST /journalist/admin/cards/jp_001/generate-pdf
```

No request body needed.

```json
// Response 200
{
  "message": "Press card PDF generated",
  "pdfUrl": "https://r2.kaburlu.com/journalist-union/press-cards/jp_001.pdf",
  "cardNumber": "JU-1745833200000"
}

// Error 404
{ "error": "Card not found" }

// Error 500 — R2 not configured
{ "error": "R2 storage not configured" }
```

---

## 15. Renewal Due List

**`GET /journalist/admin/cards/renewal-due`**

| Query Param | Default | Notes |
|-------------|---------|-------|
| `expiringDays` | 30 | Cards expiring within N days |
| `pendingOnly` | false | Only show member-requested renewals |
| `page` | 1 | |
| `limit` | 20 | Max 100 |

```
GET /journalist/admin/cards/renewal-due?expiringDays=30&pendingOnly=false
```

```json
// Response 200
{
  "total": 5,
  "page": 1,
  "limit": 20,
  "data": [
    {
      "cardId": "jc_001",
      "cardNumber": "JU-1745833200000",
      "profileId": "jp_001",
      "pressId": "TWJF-2026-001",
      "memberName": "Ravi Kumar",
      "designation": "Senior Reporter",
      "district": "Hyderabad",
      "state": "Telangana",
      "unionName": "Telangana Working Journalists Federation",
      "expiryDate": "2026-05-10T00:00:00Z",
      "daysUntilExpiry": 12,
      "pendingRenewal": true,
      "pendingRenewalAt": "2026-04-20T08:00:00Z",
      "renewalCount": 0,
      "status": "ACTIVE"
    }
  ]
}
```

---

## 16. Approve Renewal (+1 Year)

**`PATCH /journalist/admin/cards/:profileId/renew`**

```
PATCH /journalist/admin/cards/jp_001/renew
```

No request body needed.

```json
// Response 200
{
  "message": "Card renewed. New expiry: 28/04/2027",
  "card": {
    "id": "jc_001",
    "expiryDate": "2027-04-28T00:00:00Z",
    "renewedAt": "2026-04-28T10:00:00Z",
    "renewalCount": 1,
    "pendingRenewal": false,
    "pendingRenewalAt": null,
    "status": "ACTIVE"
  }
}

// Error 404
{ "error": "Press card not found" }
```

> PDF is regenerated in R2 background (non-blocking).

---

## 17. List Complaints

**`GET /journalist/admin/complaints`**

| Query Param | Values | Default |
|-------------|--------|---------|
| `status` | `OPEN` \| `IN_PROGRESS` \| `CLOSED` | all |
| `page` | integer | 1 |
| `limit` | 1–100 | 20 |

```
GET /journalist/admin/complaints?status=OPEN&page=1&limit=20
```

```json
// Response 200
{
  "total": 3,
  "page": 1,
  "limit": 20,
  "data": [
    {
      "id": "comp_001",
      "userId": "clxxx002",
      "title": "Police Harassment",
      "description": "Police stopped our reporting at the protest venue in Hyderabad.",
      "location": "Hyderabad",
      "status": "OPEN",
      "adminNote": null,
      "createdAt": "2026-04-15T10:00:00Z",
      "user": {
        "mobileNumber": "9876543210",
        "profile": { "fullName": "Ravi Kumar" }
      }
    }
  ]
}
```

---

## 18. Update Complaint Status

**`PATCH /journalist/admin/complaints/:id`**

```json
// Request Body
{
  "status": "IN_PROGRESS",
  "adminNote": "Forwarded to Press Council of India on 28-Apr-2026"
}
```

```json
// Response 200
{
  "message": "Complaint updated",
  "complaint": {
    "id": "comp_001",
    "status": "IN_PROGRESS",
    "adminNote": "Forwarded to Press Council of India on 28-Apr-2026",
    "title": "Police Harassment"
  }
}

// Error 400 — Invalid status
{ "error": "status must be one of OPEN, IN_PROGRESS, CLOSED" }
```

Status values: `OPEN` → `IN_PROGRESS` → `CLOSED`

---

## 19. Post Union Announcement

**`POST /journalist/admin/updates`**

```json
// Request Body
{
  "title": "Annual General Meeting - 2026",
  "content": "Dear members, our AGM is scheduled for 25th May 2026 at Press Club Hyderabad. All members are requested to attend.",
  "unionName": "Telangana Working Journalists Federation",
  "imageUrl": "https://r2.kaburlu.com/announcements/agm2026.jpg"
}
// imageUrl is optional
// unionName — SuperAdmin must pass this; scoped admins don't need it
```

```json
// Response 201
{
  "message": "Update posted",
  "update": {
    "id": "upd_001",
    "title": "Annual General Meeting - 2026",
    "content": "Dear members, our AGM is scheduled for 25th May 2026...",
    "unionName": "Telangana Working Journalists Federation",
    "imageUrl": null,
    "createdAt": "2026-04-28T10:00:00Z"
  }
}
```

---

## 20. Delete Announcement

**`DELETE /journalist/admin/updates/:id`**

```
DELETE /journalist/admin/updates/upd_001
```

```json
// Response 200
{ "message": "Deleted" }

// Error 404
{ "error": "Update not found" }
```

---

## 21. KYC Verify / Reject

**`PATCH /journalist/admin/kyc/verify/:profileId`**

```json
// Verify
{
  "action": "verify",
  "note": "Aadhaar matches name. Photo is clear. Verified."
}

// Reject
{
  "action": "reject",
  "note": "Photo is blurry. Please re-upload a clear passport-size photo."
}
```

```json
// Response 200 — Verified
{
  "message": "KYC verified",
  "profile": {
    "id": "jp_001",
    "kycVerified": true,
    "kycVerifiedAt": "2026-04-28T10:00:00Z",
    "kycNote": "Aadhaar matches name. Photo is clear. Verified.",
    "photoUrl": "https://r2.kaburlu.com/journalist-union/kyc/jp_001/photo.webp",
    "aadhaarUrl": "https://r2.kaburlu.com/journalist-union/kyc/jp_001/aadhaar.png"
  }
}

// Response 200 — Rejected
{
  "message": "KYC rejected",
  "profile": {
    "id": "jp_001",
    "kycVerified": false,
    "kycVerifiedAt": null,
    "kycNote": "Photo is blurry. Please re-upload a clear passport-size photo."
  }
}

// Error 400 — Invalid action
{ "error": "action must be verify or reject" }
```

---

## 22. Assign Insurance Policy

**`POST /journalist/admin/insurance`**

```json
// Request Body
{
  "profileId": "jp_001",
  "type": "ACCIDENTAL",
  "policyNumber": "LIC/ACC/2026/00421",
  "insurer": "LIC of India",
  "coverAmount": 500000,
  "premium": 1200,
  "validFrom": "2026-04-01",
  "validTo": "2027-03-31",
  "notes": "Group policy via TWJF annual scheme"
}
```

`type` values: `ACCIDENTAL` | `HEALTH`  
`coverAmount` in INR (e.g. 500000 = 5 lakh)  
Previous active policy of same type auto-deactivated.

```json
// Response 201
{
  "message": "Insurance assigned",
  "insurance": {
    "id": "ins_001",
    "profileId": "jp_001",
    "type": "ACCIDENTAL",
    "policyNumber": "LIC/ACC/2026/00421",
    "insurer": "LIC of India",
    "coverAmount": 500000,
    "premium": 1200,
    "validFrom": "2026-04-01T00:00:00Z",
    "validTo": "2027-03-31T00:00:00Z",
    "isActive": true,
    "notes": "Group policy via TWJF annual scheme",
    "createdAt": "2026-04-28T10:00:00Z"
  }
}

// Error 400 — Not approved member
{ "error": "Insurance can only be assigned to approved members" }

// Error 400 — Invalid type
{ "error": "type must be ACCIDENTAL or HEALTH" }
```

---

## 23. Update Insurance Policy

**`PATCH /journalist/admin/insurance/:id`**

```json
// Request Body (any combination)
{
  "validTo": "2028-03-31",
  "coverAmount": 1000000,
  "premium": 1500,
  "policyNumber": "LIC/ACC/2027/00421",
  "insurer": "New India Assurance",
  "isActive": true,
  "notes": "Renewed and coverage doubled to 10 lakh"
}
```

```json
// Response 200
{
  "message": "Insurance updated",
  "insurance": {
    "id": "ins_001",
    "profileId": "jp_001",
    "type": "ACCIDENTAL",
    "policyNumber": "LIC/ACC/2027/00421",
    "insurer": "New India Assurance",
    "coverAmount": 1000000,
    "premium": 1500,
    "validTo": "2028-03-31T00:00:00Z",
    "isActive": true,
    "notes": "Renewed and coverage doubled to 10 lakh"
  }
}
```

---

## 24. Get Member's Insurance History

**`GET /journalist/admin/insurance/member/:profileId`**

```
GET /journalist/admin/insurance/member/jp_001
```

```json
// Response 200
{
  "insurances": [
    {
      "id": "ins_001",
      "type": "ACCIDENTAL",
      "policyNumber": "LIC/ACC/2026/00421",
      "insurer": "LIC of India",
      "coverAmount": 500000,
      "premium": 1200,
      "validFrom": "2026-04-01T00:00:00Z",
      "validTo": "2027-03-31T00:00:00Z",
      "isActive": true,
      "notes": "Group policy via TWJF annual scheme",
      "assignedBy": { "profile": { "fullName": "Super Admin" } }
    },
    {
      "id": "ins_002",
      "type": "HEALTH",
      "policyNumber": "STAR/HLTH/2026/00210",
      "insurer": "Star Health Insurance",
      "coverAmount": 200000,
      "premium": 3500,
      "validFrom": "2026-04-01T00:00:00Z",
      "validTo": "2027-03-31T00:00:00Z",
      "isActive": true,
      "notes": null,
      "assignedBy": { "profile": { "fullName": "Super Admin" } }
    }
  ]
}
```

---

## 25. Appoint Member to Post

**`POST /journalist/admin/posts/appoint`**

```json
// State-level post
{
  "postId": "pd_001",
  "profileId": "jp_001",
  "termStartDate": "2026-01-01",
  "termEndDate": "2028-12-31",
  "notes": "Elected at AGM 2026"
}

// District-level post (pass districtId)
{
  "postId": "pd_013",
  "profileId": "jp_002",
  "termStartDate": "2026-01-01",
  "termEndDate": "2028-12-31",
  "districtId": "dist_hyd_001"
}
```

> Single-seat ELECTED posts: previous holder auto-vacated when new one appointed.  
> Multi-seat posts: 400 error if `maxSeats` limit reached.

```json
// Response 201
{
  "message": "Ravi Kumar appointed as State President",
  "holder": {
    "id": "ph_001",
    "postId": "pd_001",
    "profileId": "jp_001",
    "unionName": "Telangana Working Journalists Federation",
    "termStartDate": "2026-01-01T00:00:00Z",
    "termEndDate": "2028-12-31T00:00:00Z",
    "isActive": true,
    "notes": "Elected at AGM 2026",
    "post": {
      "title": "State President",
      "nativeTitle": "రాష్ట్ర అధ్యక్షుడు",
      "level": "STATE",
      "type": "ELECTED"
    },
    "profile": {
      "pressId": "TWJF-2026-001",
      "user": { "profile": { "fullName": "Ravi Kumar" } }
    }
  }
}

// Error 400 — Seat full (multi-seat)
{
  "error": "Seat limit reached. This post allows maximum 5 active holder(s).",
  "maxSeats": 5,
  "currentCount": 5
}

// Error 400 — Not approved
{ "error": "Only approved journalists can be appointed to posts" }
```

---

## 26. Update Post Holder (Extend Term / Notes)

**`PATCH /journalist/admin/posts/holders/:id`**

```json
// Request Body (any combination)
{
  "termEndDate": "2030-12-31",
  "notes": "Term extended at emergency committee meeting - April 2026"
}
```

```json
// Response 200
{
  "message": "Post holder updated",
  "holder": {
    "id": "ph_001",
    "termEndDate": "2030-12-31T00:00:00Z",
    "notes": "Term extended at emergency committee meeting - April 2026"
  }
}

// Error 404
{ "error": "Post holder record not found" }
```

---

## 27. Remove / Vacate Post Holder

**`DELETE /journalist/admin/posts/holders/:id`**

```
DELETE /journalist/admin/posts/holders/ph_001
```

```json
// Response 200
{ "message": "Post vacated successfully" }

// Error 404
{ "error": "Post holder record not found" }
```

> Sets `isActive = false` and `termEndDate = today` — soft delete, record preserved.

---

## Error Reference

| HTTP Status | Meaning |
|-------------|---------|
| `400` | Missing/invalid fields — read `error` message |
| `401` | No token or expired token |
| `403` | Role insufficient (not SuperAdmin) or union scope mismatch |
| `404` | Record not found |
| `409` | Duplicate record (e.g. pressId already in use) |
| `500` | Server error |

---

## SuperAdmin Differences vs Union Admin

| Behavior | Union Admin | SuperAdmin |
|----------|------------|------------|
| See applications | Only their union | All unions |
| `unionName` in body | Not needed (auto) | **Must pass it** |
| `unionName` in query | Not needed (auto) | **Must pass it** |
| State restriction | Scoped to assigned state | No restriction |
| Assign admins | ❌ Not allowed | ✅ Only SuperAdmin |
| Seed post definitions | ❌ Not allowed | ✅ Only SuperAdmin |
| Delete union admins | ❌ Not allowed | ✅ Only SuperAdmin |
