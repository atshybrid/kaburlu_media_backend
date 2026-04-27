# Journalist Union — Member (Nenu) APIs

> **Base URL:** `https://api.kaburlu.com/api/v1`  
> **Auth:** `Authorization: Bearer <my_jwt_token>` (login tho vasina token)  
> **Total Endpoints:** 13

---

## Quick Index

| # | Method | Endpoint | Auth | Purpose |
|---|--------|----------|------|---------|
| 1 | POST | `/journalist/public/apply` | ❌ No Auth | New account tho apply |
| 2 | POST | `/journalist/apply` | ✅ JWT | Existing login tho apply |
| 3 | GET | `/journalist/profile` | ✅ JWT | Naa profile chudadam |
| 4 | PUT | `/journalist/profile` | ✅ JWT | Profile update (approval mundu) |
| 5 | POST | `/journalist/kyc/upload` | ✅ JWT | Photo / Aadhaar upload |
| 6 | PUT | `/journalist/kyc/details` | ✅ JWT | Work details update |
| 7 | GET | `/journalist/my-card` | ✅ JWT | Naa press card details |
| 8 | GET | `/journalist/my-card/pdf` | ✅ JWT | Press card PDF download |
| 9 | POST | `/journalist/my-card/request-renewal` | ✅ JWT | Renewal request |
| 10 | POST | `/journalist/complaint` | ✅ JWT | Complaint file cheyyadam |
| 11 | GET | `/journalist/my-complaints` | ✅ JWT | Naa complaints list |
| 12 | GET | `/journalist/reporter-link` | ✅ JWT | Reporter account link check |
| 13 | GET | `/journalist/my-posts` | ✅ JWT | Naa union posts |
| 14 | GET | `/journalist/my-insurance` | ✅ JWT | Naa insurance policies |

---

## 1. Apply — New Account (Public, No Login)

**`POST /journalist/public/apply`**

New user aina — account + application oka sarige create avutundi.

```json
// Request Body
{
  "mobileNumber": "9876543210",
  "mpin": "1234",
  "designation": "Senior Reporter",
  "district": "Hyderabad",
  "organization": "Sakshi TV",
  "unionName": "Telangana Working Journalists Federation",
  "state": "Telangana",
  "mandal": "Secunderabad"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `mobileNumber` | ✅ | 10 digit mobile |
| `mpin` | ✅ new users only | 4 digit PIN |
| `designation` | ✅ | Reporter, Editor etc |
| `district` | ✅ | |
| `organization` | ✅ | Newspaper / channel |
| `unionName` | Optional | Union slug |
| `state` | Optional | |
| `mandal` | Optional | |

```json
// Response 201 — New Account Created
{
  "message": "New account created and application submitted. Login with your mobile number and MPIN.",
  "isNewAccount": true,
  "reporterLinked": false,
  "reporterTenant": null,
  "profile": {
    "id": "jp_001",
    "userId": "cl_001",
    "designation": "Senior Reporter",
    "district": "Hyderabad",
    "organization": "Sakshi TV",
    "unionName": "Telangana Working Journalists Federation",
    "state": "Telangana",
    "mandal": "Secunderabad",
    "approved": false,
    "pressId": null,
    "kycVerified": false,
    "photoUrl": null,
    "aadhaarUrl": null,
    "createdAt": "2026-04-28T10:00:00Z"
  }
}

// Response 201 — Existing Account Linked
{
  "message": "Application submitted and linked to your existing account.",
  "isNewAccount": false,
  "reporterLinked": true,
  "reporterTenant": "Sakshi TV",
  "profile": { /* same as above */ }
}
```

```json
// Error 400 — Already applied
{
  "error": "This mobile number already has a journalist union application",
  "profile": { /* existing profile */ }
}

// Error 400 — MPIN missing for new account
{ "error": "mpin is required when registering a new account" }

// Error 400 — Invalid MPIN
{ "error": "mpin must be exactly 4 digits" }
```

---

## 2. Apply — With JWT (Already Logged In)

**`POST /journalist/apply`**

Already login chesina user apply chesukuntadu.

```json
// Request Body
{
  "designation": "Reporter",
  "district": "Karimnagar",
  "organization": "TV9",
  "unionName": "Telangana Working Journalists Federation",
  "state": "Telangana",
  "mandal": "Karimnagar Urban"
}
```

```json
// Response 201
{
  "message": "Application submitted successfully",
  "profile": {
    "id": "jp_002",
    "userId": "cl_002",
    "designation": "Reporter",
    "district": "Karimnagar",
    "organization": "TV9",
    "unionName": "Telangana Working Journalists Federation",
    "state": "Telangana",
    "mandal": "Karimnagar Urban",
    "approved": false,
    "pressId": null,
    "kycVerified": false,
    "createdAt": "2026-04-28T10:00:00Z"
  }
}

// Error 400 — Already applied
{
  "error": "You have already applied",
  "profile": { /* existing */ }
}
```

---

## 3. Get My Profile

**`GET /journalist/profile`**

```
GET /journalist/profile
Authorization: Bearer <token>
```

No body needed.

```json
// Response 200
{
  "id": "jp_001",
  "userId": "cl_001",
  "designation": "Senior Reporter",
  "district": "Hyderabad",
  "organization": "Sakshi TV",
  "unionName": "Telangana Working Journalists Federation",
  "state": "Telangana",
  "mandal": "Secunderabad",
  "pressId": "TWJF-2026-001",
  "approved": true,
  "approvedAt": "2026-04-15T10:00:00Z",
  "kycVerified": true,
  "kycVerifiedAt": "2026-04-16T10:00:00Z",
  "kycNote": "Verified",
  "photoUrl": "https://r2.kaburlu.com/journalist-union/kyc/jp_001/photo.webp",
  "aadhaarUrl": "https://r2.kaburlu.com/journalist-union/kyc/jp_001/aadhaar.png",
  "aadhaarBackUrl": null,
  "aadhaarNumber": "4521",
  "currentNewspaper": "Sakshi TV",
  "currentDesignation": "Senior Reporter",
  "joiningDate": "2019-06-01T00:00:00Z",
  "totalExperienceYears": 7,
  "linkedTenantName": "Sakshi TV",
  "createdAt": "2026-04-01T10:00:00Z",
  "user": {
    "mobileNumber": "9876543210",
    "email": null,
    "profile": { "fullName": "Ravi Kumar" }
  },
  "card": {
    "id": "jc_001",
    "cardNumber": "JU-1745833200000",
    "status": "ACTIVE",
    "expiryDate": "2027-04-28T00:00:00Z",
    "renewalCount": 0,
    "pendingRenewal": false,
    "pdfUrl": "https://r2.kaburlu.com/journalist-union/press-cards/jp_001.pdf"
  },
  "insurances": [
    {
      "id": "ins_001",
      "type": "ACCIDENTAL",
      "policyNumber": "LIC/ACC/2026/00421",
      "insurer": "LIC of India",
      "coverAmount": 500000,
      "validFrom": "2026-04-01T00:00:00Z",
      "validTo": "2027-03-31T00:00:00Z",
      "notes": "Group policy"
    }
  ]
}

// Error 404
{ "error": "Journalist profile not found. Please apply first." }
```

---

## 4. Update My Profile (Approval Mundu Matrame)

**`PUT /journalist/profile`**

> Approval tarvata profile edit cheyyalem — 403 vasthundi.

```json
// Request Body (any combination)
{
  "designation": "Senior Reporter",
  "district": "Rangareddy",
  "organization": "ETV Bharat",
  "unionName": "Telangana Working Journalists Federation",
  "state": "Telangana",
  "mandal": "Kukatpally"
}
```

```json
// Response 200
{
  "id": "jp_001",
  "designation": "Senior Reporter",
  "district": "Rangareddy",
  "organization": "ETV Bharat",
  "unionName": "Telangana Working Journalists Federation",
  "state": "Telangana",
  "mandal": "Kukatpally",
  "approved": false
}

// Error 403 — Already approved
{ "error": "Profile is already approved and cannot be edited." }

// Error 404 — No profile
{ "error": "Profile not found. Apply first." }
```

---

## 5. Upload KYC Documents / Photo

**`POST /journalist/kyc/upload`**  
**Content-Type:** `multipart/form-data`

| Form Field | Value |
|------------|-------|
| `file` | Image file |
| `field` | `photo` \| `aadhaar` \| `aadhaarBack` |

```
// photo → saved as WebP (high quality)
// aadhaar, aadhaarBack → saved as PNG (text clarity)
```

```
// Example curl — Photo upload
curl -X POST https://api.kaburlu.com/api/v1/journalist/kyc/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/photo.jpg" \
  -F "field=photo"

// Example curl — Aadhaar upload
curl -X POST https://api.kaburlu.com/api/v1/journalist/kyc/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/aadhaar.jpg" \
  -F "field=aadhaar"
```

```json
// Response 200 — Photo uploaded
{
  "field": "photo",
  "url": "https://r2.kaburlu.com/journalist-union/kyc/jp_001/photo.webp",
  "profile": {
    "id": "jp_001",
    "photoUrl": "https://r2.kaburlu.com/journalist-union/kyc/jp_001/photo.webp",
    "aadhaarUrl": null,
    "aadhaarBackUrl": null
  }
}

// Response 200 — Aadhaar uploaded
{
  "field": "aadhaar",
  "url": "https://r2.kaburlu.com/journalist-union/kyc/jp_001/aadhaar.png",
  "profile": {
    "id": "jp_001",
    "photoUrl": "https://r2.kaburlu.com/.../photo.webp",
    "aadhaarUrl": "https://r2.kaburlu.com/.../aadhaar.png"
  }
}

// Error 400 — Invalid field
{ "error": "field must be one of: photo, aadhaar, aadhaarBack" }

// Error 400 — No file sent
{ "error": "file is required (multipart/form-data)" }

// Error 404 — No profile
{ "error": "Journalist profile not found. Apply first." }
```

---

## 6. Update KYC Work Details

**`PUT /journalist/kyc/details`**

```json
// Request Body (any combination)
{
  "aadhaarNumber": "4521",
  "currentNewspaper": "Sakshi TV",
  "currentDesignation": "Senior Reporter",
  "joiningDate": "2019-06-01",
  "totalExperienceYears": 7,
  "additionalInfo": "Covered state assembly elections 2023",
  "autoLinkReporter": true
}
```

| Field | Notes |
|-------|-------|
| `aadhaarNumber` | Last 4 digits only (full number never stored) |
| `aadhaarNumber` | `"452134567890"` ivvina — automatically last 4 (`4890`) save avutundi |
| `autoLinkReporter` | `true` iiste reporter account auto detect chesి `linkedTenantName` fill avutundi |

```json
// Response 200
{
  "message": "Profile updated",
  "profile": {
    "id": "jp_001",
    "aadhaarNumber": "4521",
    "currentNewspaper": "Sakshi TV",
    "currentDesignation": "Senior Reporter",
    "joiningDate": "2019-06-01T00:00:00Z",
    "totalExperienceYears": 7,
    "additionalInfo": "Covered state assembly elections 2023",
    "linkedTenantId": "tenant_001",
    "linkedTenantName": "Sakshi TV"
  }
}

// Error 400 — Invalid Aadhaar digits
{ "error": "aadhaarNumber: provide last 4 digits only" }

// Error 404 — No profile
{ "error": "Journalist profile not found" }
```

---

## 7. Get My Press Card

**`GET /journalist/my-card`**

```
GET /journalist/my-card
Authorization: Bearer <token>
```

No body needed.

```json
// Response 200
{
  "id": "jc_001",
  "profileId": "jp_001",
  "cardNumber": "JU-1745833200000",
  "status": "ACTIVE",
  "expiryDate": "2027-04-28T00:00:00Z",
  "pdfUrl": "https://r2.kaburlu.com/journalist-union/press-cards/jp_001.pdf",
  "qrCode": null,
  "renewalCount": 0,
  "pendingRenewal": false,
  "pendingRenewalAt": null,
  "renewedAt": null,
  "createdAt": "2026-04-28T10:00:00Z"
}
```

`status` values: `ACTIVE` | `EXPIRED`

```json
// Error 404 — No profile
{ "error": "No journalist profile found." }

// Error 404 — No card issued yet
{ "error": "No press card issued yet. Please contact your union admin." }
```

---

## 8. Download My Press Card PDF

**`GET /journalist/my-card/pdf`**

```
GET /journalist/my-card/pdf
Authorization: Bearer <token>
```

Returns **PDF binary** (`application/pdf`) — browser lo direct open / download avutundi.

```
// Next.js — iframe lo show cheyyadam
<iframe 
  src={`${BASE}/api/v1/journalist/my-card/pdf`}
  headers are handled via token — use link instead
/>

// Safe way — anchor tag
<a 
  href={`${BASE}/api/v1/journalist/my-card/pdf`}
  // Token needed — use fetch + blob
/>
```

```typescript
// Next.js download function
const downloadCard = async () => {
  const res = await fetch(`${BASE}/api/v1/journalist/my-card/pdf`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Press_Card.pdf';
  a.click();
};
```

```json
// Error 404 — No card
{ "error": "No press card issued yet." }

// Error 500 — PDF generation failed
{ "error": "Failed to generate press card PDF" }
```

---

## 9. Request Card Renewal

**`POST /journalist/my-card/request-renewal`**

> Card expire ayyindi or 60 days lo expire avutundi anappudu request cheyyadam.

```
POST /journalist/my-card/request-renewal
Authorization: Bearer <token>
```

No body needed.

```json
// Response 200 — Success
{
  "message": "Renewal request submitted. Your admin will process it shortly.",
  "card": {
    "id": "jc_001",
    "cardNumber": "JU-1745833200000",
    "pendingRenewal": true,
    "pendingRenewalAt": "2026-04-28T10:00:00Z",
    "expiryDate": "2026-05-15T00:00:00Z"
  }
}

// Error 400 — Too early (more than 60 days remaining)
{
  "error": "Card renewal can only be requested within 60 days of expiry. Your card expires on 28/04/2027 (365 days remaining)."
}

// Error 400 — Already requested
{ "error": "Renewal request already submitted. Please wait for admin approval." }

// Error 404 — No card
{ "error": "No press card found" }
```

---

## 10. File a Complaint

**`POST /journalist/complaint`**

> Only **approved** journalists complaint file cheyyadam.

```json
// Request Body
{
  "title": "Police Harassment",
  "description": "Police stopped our reporting at the protest venue in Hyderabad. They confiscated our camera without any reason.",
  "location": "Hyderabad"
}
```

| Field | Required |
|-------|----------|
| `title` | ✅ |
| `description` | ✅ |
| `location` | Optional |

```json
// Response 201
{
  "message": "Complaint filed successfully",
  "complaint": {
    "id": "comp_001",
    "userId": "cl_001",
    "title": "Police Harassment",
    "description": "Police stopped our reporting at the protest venue in Hyderabad...",
    "location": "Hyderabad",
    "status": "OPEN",
    "adminNote": null,
    "createdAt": "2026-04-28T10:00:00Z"
  }
}

// Error 403 — Not approved
{ "error": "Only approved journalist union members can file complaints." }

// Error 400 — Missing fields
{ "error": "title and description are required" }
```

---

## 11. My Complaints List

**`GET /journalist/my-complaints`**

```
GET /journalist/my-complaints
Authorization: Bearer <token>
```

No body / params needed.

```json
// Response 200
[
  {
    "id": "comp_001",
    "title": "Police Harassment",
    "description": "Police stopped our reporting...",
    "location": "Hyderabad",
    "status": "IN_PROGRESS",
    "adminNote": "Forwarded to Press Council of India on 28-Apr-2026",
    "createdAt": "2026-04-28T10:00:00Z"
  },
  {
    "id": "comp_002",
    "title": "Threat from local politician",
    "description": "...",
    "location": "Karimnagar",
    "status": "OPEN",
    "adminNote": null,
    "createdAt": "2026-03-15T10:00:00Z"
  }
]
```

`status` values: `OPEN` → `IN_PROGRESS` → `CLOSED`

---

## 12. Reporter Link Check

**`GET /journalist/reporter-link`**

Journalist profile + Reporter account rendu oka user ki link ayyindo ledu check cheyyadam.

```
GET /journalist/reporter-link
Authorization: Bearer <token>
```

```json
// Response 200 — Both profiles exist and linked
{
  "hasJournalistProfile": true,
  "hasReporterProfile": true,
  "linked": true,
  "journalistProfile": {
    "id": "jp_001",
    "designation": "Senior Reporter",
    "district": "Hyderabad",
    "approved": true,
    "pressId": "TWJF-2026-001"
  },
  "reporter": {
    "id": "rep_001",
    "tenantId": "tenant_001",
    "active": true,
    "tenant": { "name": "Sakshi TV" }
  }
}

// Response 200 — Only journalist profile
{
  "hasJournalistProfile": true,
  "hasReporterProfile": false,
  "linked": false,
  "journalistProfile": { /* ... */ },
  "reporter": null
}

// Response 200 — No profiles
{
  "hasJournalistProfile": false,
  "hasReporterProfile": false,
  "linked": false,
  "journalistProfile": null,
  "reporter": null
}
```

---

## 13. My Union Posts

**`GET /journalist/my-posts`**

Admin appointed chesina posts chudadam.

```
GET /journalist/my-posts
Authorization: Bearer <token>
```

```json
// Response 200
{
  "posts": [
    {
      "id": "ph_001",
      "postId": "pd_001",
      "unionName": "Telangana Working Journalists Federation",
      "termStartDate": "2026-01-01T00:00:00Z",
      "termEndDate": "2028-12-31T00:00:00Z",
      "isActive": true,
      "notes": "Elected at AGM 2026",
      "post": {
        "title": "State President",
        "nativeTitle": "రాష్ట్ర అధ్యక్షుడు",
        "level": "STATE",
        "type": "ELECTED",
        "sortOrder": 1
      }
    },
    {
      "id": "ph_002",
      "postId": "pd_009",
      "unionName": "Telangana Working Journalists Federation",
      "termStartDate": "2026-01-01T00:00:00Z",
      "termEndDate": null,
      "isActive": true,
      "post": {
        "title": "Executive Member",
        "nativeTitle": "కార్యనిర్వాహక సభ్యుడు",
        "level": "STATE",
        "type": "APPOINTED",
        "sortOrder": 9
      }
    }
  ]
}

// Response 200 — No posts
{ "posts": [] }

// Error 404 — No profile
{ "error": "No journalist profile found" }
```

---

## 14. My Insurance Policies

**`GET /journalist/my-insurance`**

```
GET /journalist/my-insurance
Authorization: Bearer <token>
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
      "validFrom": "2026-04-01T00:00:00Z",
      "validTo": "2027-03-31T00:00:00Z",
      "isActive": true,
      "notes": "Group policy via TWJF annual scheme"
    },
    {
      "id": "ins_002",
      "type": "HEALTH",
      "policyNumber": "STAR/HLTH/2026/00210",
      "insurer": "Star Health Insurance",
      "coverAmount": 200000,
      "validFrom": "2026-04-01T00:00:00Z",
      "validTo": "2027-03-31T00:00:00Z",
      "isActive": true,
      "notes": null
    }
  ]
}

// Response 200 — No insurance
{ "insurances": [] }

// Error 404
{ "error": "No journalist profile found" }
```

`type` values: `ACCIDENTAL` | `HEALTH`

---

## Typical Member Journey (Flow)

```
1. Apply cheyyadam
   POST /public/apply (new user)
   POST /apply (existing login)
         ↓
2. Profile update (approval mundu)
   PUT /profile
         ↓
3. KYC documents upload
   POST /kyc/upload  (field: photo)
   POST /kyc/upload  (field: aadhaar)
   PUT  /kyc/details (work details, aadhaar last 4)
         ↓
4. Admin approve chestadu (wait)
   GET /profile  → approved: true avutundi
         ↓
5. Press card ready
   GET /my-card        → card details
   GET /my-card/pdf    → PDF download
         ↓
6. Renewal (expiry 60 days mundu)
   POST /my-card/request-renewal
         ↓
7. Anytime
   POST /complaint      → complaint file
   GET  /my-complaints  → status check
   GET  /my-posts       → union posts
   GET  /my-insurance   → insurance details
```

---

## Error Reference

| HTTP | Meaning |
|------|---------|
| `400` | Wrong/missing fields |
| `401` | Token missing or expired — login again |
| `403` | Approved member kadu (complaints), or profile edit after approval |
| `404` | Profile / card not found |
| `500` | Server error |
