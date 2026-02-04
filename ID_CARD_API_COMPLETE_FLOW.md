# ID Card API - Complete Flow Reference

## 🎯 Available Endpoints Summary

### 1️⃣ Tenant Admin Endpoints (Admin manages reporters)
Base Path: `/api/v1/tenants/{tenantId}/reporters/{reporterId}/id-card`

```
✅ POST   /tenants/{tenantId}/reporters/{reporterId}/id-card          - Generate new ID card
✅ GET    /tenants/{tenantId}/reporters/{reporterId}/id-card          - Get existing ID card details
✅ POST   /tenants/{tenantId}/reporters/{reporterId}/id-card/resend   - Resend ID card via WhatsApp
❌ REGENERATE NOT AVAILABLE IN THIS PATH
```

### 2️⃣ Reporter Self-Service Endpoints (Reporter manages own card)
Base Path: `/api/v1/reporters/me/id-card`

```
✅ POST   /reporters/me/id-card              - Generate own ID card
✅ POST   /reporters/me/id-card/resend       - Resend own ID card
✅ POST   /reporters/me/id-card/regenerate   - Regenerate own ID card
```

### 3️⃣ Alternative Admin Path (Using reportersRoutes)
Base Path: `/api/v1/reporters/tenants/{tenantId}/reporters/{reporterId}/id-card`

```
⚠️  POST   /reporters/tenants/{tenantId}/reporters/{reporterId}/id-card             - Generate
⚠️  POST   /reporters/tenants/{tenantId}/reporters/{reporterId}/id-card/regenerate  - Regenerate (EXISTS HERE!)
⚠️  POST   /reporters/tenants/{tenantId}/reporters/{reporterId}/id-card/resend      - Resend
```

---

## 📱 React Native - Correct API Calls

### ❌ WRONG (404 Error)
```typescript
// This path doesn't have regenerate endpoint!
POST /api/v1/tenants/{tenantId}/reporters/{reporterId}/id-card/regenerate
```

### ✅ CORRECT Options

**Option A: Use RESEND instead (Auto-regenerates if PDF missing)**
```typescript
POST https://api.kaburlumedia.com/api/v1/tenants/cmkh94g0s01eykb21toi1oucu/reporters/cml54silw009bbzyjen9g7qf8/id-card/resend

Headers:
  Authorization: Bearer {JWT_TOKEN}
  Content-Type: application/json

Body: {} (empty or no body)

Response 200:
{
  "ok": true,
  "messageId": "wamid_...",
  "message": "ID card sent via WhatsApp"
}
```

**Option B: Use alternative path with /reporters prefix**
```typescript
POST https://api.kaburlumedia.com/api/v1/reporters/tenants/cmkh94g0s01eykb21toi1oucu/reporters/cml54silw009bbzyjen9g7qf8/id-card/regenerate

Headers:
  Authorization: Bearer {JWT_TOKEN}
  Content-Type: application/json

Body (optional):
{
  "keepCardNumber": true,  // Keep PA0001
  "reason": "User requested resend"
}

Response 201:
{
  "id": "...",
  "cardNumber": "PA0001",
  "issuedAt": "...",
  "expiresAt": "...",
  "pdfUrl": null,
  "previousCardNumber": "PA0001",
  "regeneratedBy": "userId",
  "regenerationReason": "User requested resend",
  "pdfGenerating": true,
  "whatsappSent": true,
  "message": "ID card regenerated, PDF uploading to CDN and will be sent via WhatsApp"
}
```

---

## 🔐 Complete Flow Documentation

### A. TENANT ADMIN Flow

#### 1. Generate ID Card (First Time)
```http
POST /api/v1/tenants/{tenantId}/reporters/{reporterId}/id-card
Authorization: Bearer {ADMIN_JWT_TOKEN}

Requirements:
✅ User must be Tenant Admin or Super Admin
✅ Reporter must have profile photo (Reporter.profilePhotoUrl OR UserProfile.profilePhotoUrl)
✅ Tenant must have ID card settings configured
⚠️  If idCardCharge > 0: Onboarding payment must be PAID
⚠️  If subscriptionActive: Current month subscription must be PAID

Response 201:
{
  "id": "cardId",
  "cardNumber": "PA0001",
  "issuedAt": "2026-02-02T12:14:50.353Z",
  "expiresAt": "2026-12-31T00:00:00.000Z",
  "pdfUrl": null,  // Will be updated after PDF generation
  "reporterId": "reporterId",
  "pdfGenerating": true,
  "whatsappSent": true
}

Errors:
403: "Profile photo is required to generate ID card"
403: "Payment required" (if charges apply)
404: "Tenant ID card settings not configured"
```

#### 2. Get ID Card Details
```http
GET /api/v1/tenants/{tenantId}/reporters/{reporterId}/id-card

Response 200:
{
  "id": "cardId",
  "cardNumber": "PA0001",
  "issuedAt": "2026-02-02T12:14:50.353Z",
  "expiresAt": "2026-12-31T00:00:00.000Z",
  "pdfUrl": "https://kaburlu-news.b-cdn.net/id-cards/PA0001.pdf",
  "reporterId": "reporterId"
}

Errors:
404: "Reporter not found"
404: "ID card not found"
```

#### 3. Resend ID Card via WhatsApp
```http
POST /api/v1/tenants/{tenantId}/reporters/{reporterId}/id-card/resend
Authorization: Bearer {ADMIN_JWT_TOKEN}

✨ NEW FEATURE: Auto-regenerates PDF if missing!

Flow:
1. Check if reporter.idCard.pdfUrl exists
2. If missing → Call generateReporterIdCardPdf() automatically
3. Use pdfUrl to send WhatsApp message
4. Only fails if regeneration itself fails

Response 200:
{
  "ok": true,
  "messageId": "wamid_...",
  "message": "ID card sent via WhatsApp"
}

Errors:
404: "Reporter not found"
404: "ID card not found - Please generate first"
400: "Mobile number not found"
500: "PDF regeneration failed" (if auto-regeneration fails)
```

#### 4. Download PDF Directly
```http
GET /api/v1/id-cards/pdf?reporterId={reporterId}

Response: PDF file stream
Content-Type: application/pdf
Content-Disposition: attachment; filename="PA0001.pdf"

Alternative query params:
- mobile={mobileNumber}
- fullName={reporterFullName}
```

---

### B. REPORTER SELF-SERVICE Flow

#### 1. Generate Own ID Card
```http
POST /api/v1/reporters/me/id-card
Authorization: Bearer {REPORTER_JWT_TOKEN}

Requirements:
✅ User role must be REPORTER
✅ Must have profile photo
⚠️  If idCardCharge > 0: Onboarding payment must be PAID
⚠️  If subscriptionActive: Subscription must be ACTIVE

Response 201: (Same as admin generate)

Errors:
403: "Only reporters can use this endpoint"
403: "Profile photo is required"
403: "Payment required for ID card generation"
403: "Active subscription required"
404: "Reporter profile not found"
```

#### 2. Resend Own ID Card
```http
POST /api/v1/reporters/me/id-card/resend
Authorization: Bearer {REPORTER_JWT_TOKEN}

Requirements:
✅ User role must be REPORTER
✅ ID card must already exist
⚠️  If subscriptionActive: Subscription must be ACTIVE

Response 200:
{
  "ok": true,
  "messageId": "wamid_...",
  "message": "ID card sent to your WhatsApp"
}

Errors:
403: "Only reporters can use this endpoint"
403: "Active subscription required to resend ID card"
404: "ID card not found. Please generate it first."
400: "Mobile number not found"
```

#### 3. Regenerate Own ID Card
```http
POST /api/v1/reporters/me/id-card/regenerate
Authorization: Bearer {REPORTER_JWT_TOKEN}

Body (optional):
{
  "keepCardNumber": true,  // Keep same card number
  "reason": "Photo updated"
}

Requirements:
✅ User role must be REPORTER
✅ Must have profile photo
⚠️  If subscriptionActive: Subscription must be ACTIVE

Flow:
1. Delete existing ID card from database
2. Check profile photo exists
3. Generate new card number (or keep old if keepCardNumber=true)
4. Create new ID card record
5. Generate PDF asynchronously
6. Send via WhatsApp asynchronously

Response 201:
{
  "id": "newCardId",
  "cardNumber": "PA0001",  // Same if keepCardNumber=true
  "issuedAt": "2026-02-04T10:30:00.000Z",
  "expiresAt": "2027-02-04T10:30:00.000Z",
  "pdfUrl": null,
  "previousCardNumber": "PA0001",
  "regeneratedBy": "userId",
  "regenerationReason": "Photo updated",
  "pdfGenerating": true,
  "whatsappSent": true
}

Errors:
403: "Only reporters can use this endpoint"
403: "Profile photo is required to generate ID card"
403: "Active subscription required to regenerate ID card"
404: "Reporter profile not found"
```

---

## 🔄 Subscription & Payment Checks

### Payment Requirements Matrix

| Operation | idCardCharge > 0 | subscriptionActive=true |
|-----------|------------------|-------------------------|
| **Generate (First time)** | Onboarding PAID required | Current month PAID required |
| **Resend (Reporter)** | ❌ No check | Subscription ACTIVE required |
| **Resend (Admin)** | ❌ No check | ❌ No check |
| **Regenerate (Reporter)** | ❌ No check | Subscription ACTIVE required |
| **Regenerate (Admin)** | ❌ No check | ❌ No check |

### Subscription Status Check Logic
```javascript
// For Reporter self-service endpoints
if (reporter.subscriptionActive) {
  // Check current month payment
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  
  const currentMonthPayment = await prisma.reporterPayment.findFirst({
    where: {
      reporterId: reporter.id,
      type: 'SUBSCRIPTION',
      status: 'PAID',
      year,
      month
    }
  });
  
  if (!currentMonthPayment) {
    return res.status(403).json({
      error: 'Active subscription required',
      details: 'Please pay current month subscription to continue'
    });
  }
}
```

---

## 📸 Profile Photo Requirements

### Photo Resolution Priority
```javascript
// System checks in this order:
1. Reporter.profilePhotoUrl  (Preferred)
2. UserProfile.profilePhotoUrl  (Fallback)

// If neither exists → 403 error
```

### Upload Photo First
```http
POST /api/v1/profiles/me/photo
Authorization: Bearer {JWT_TOKEN}
Content-Type: multipart/form-data

Body:
file: (binary image file)

Response 200:
{
  "profilePhotoUrl": "https://kaburlu-news.b-cdn.net/profiles/2026/02/02/image.webp",
  "profilePhotoMediaId": "mediaId"
}
```

---

## 🚨 Common Errors & Solutions

### 404 Not Found
**Error:** `POST /api/v1/tenants/{tenantId}/reporters/{reporterId}/id-card/regenerate → 404`

**Reason:** `regenerate` endpoint doesn't exist in `tenantReportersRoutes`

**Solutions:**
1. ✅ Use `/id-card/resend` instead (auto-regenerates if needed)
2. ✅ Use `/reporters/tenants/...` path (has regenerate)
3. ✅ Use reporter self-service: `/reporters/me/id-card/regenerate`

### 403 Profile Photo Required
**Error:** `{"error": "Profile photo is required to generate ID card"}`

**Solution:**
```typescript
// 1. Upload photo first
POST /api/v1/profiles/me/photo
(multipart/form-data with image file)

// 2. Then generate ID card
POST /api/v1/reporters/me/id-card
```

### 403 Subscription Required
**Error:** `{"error": "Active subscription required"}`

**Solution:**
```typescript
// Pay current month subscription
POST /api/v1/reporter-payments
{
  "type": "SUBSCRIPTION",
  "amount": 100,
  "currency": "INR",
  "year": 2026,
  "month": 2
}

// After payment status = PAID, retry ID card operation
```

### 500 PDF Generation Failed
**Error:** `{"error": "Failed to regenerate ID card"}`

**Possible Causes:**
- Bunny CDN configuration missing
- PDF generation timeout
- Network issues

**Fallback:** System uses dynamic PDF URL
```
https://api.kaburlumedia.com/api/v1/id-cards/pdf?reporterId={reporterId}
```

---

## 🎯 Recommended Implementation for React Native

### Use Case 1: Admin Resending ID Card
```typescript
async function adminResendIdCard(tenantId: string, reporterId: string) {
  try {
    const response = await fetch(
      `https://api.kaburlumedia.com/api/v1/tenants/${tenantId}/reporters/${reporterId}/id-card/resend`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to resend ID card');
    }
    
    const result = await response.json();
    console.log('✅ ID card sent via WhatsApp:', result.messageId);
    return result;
  } catch (error) {
    console.error('❌ Resend failed:', error);
    throw error;
  }
}
```

### Use Case 2: Reporter Regenerating Own Card
```typescript
async function reporterRegenerateIdCard(keepSameNumber: boolean = true) {
  try {
    // Step 1: Ensure profile photo exists
    const profile = await getMyProfile();
    if (!profile.profilePhotoUrl) {
      throw new Error('Please upload profile photo first');
    }
    
    // Step 2: Check subscription if required
    const reporter = await getMyReporterProfile();
    if (reporter.subscriptionActive) {
      const subscription = await getCurrentSubscriptionPayment();
      if (subscription.status !== 'PAID') {
        throw new Error('Please pay current month subscription');
      }
    }
    
    // Step 3: Regenerate ID card
    const response = await fetch(
      'https://api.kaburlumedia.com/api/v1/reporters/me/id-card/regenerate',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${reporterToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          keepCardNumber: keepSameNumber,
          reason: 'Updated profile information'
        })
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to regenerate ID card');
    }
    
    const result = await response.json();
    console.log('✅ ID card regenerated:', result.cardNumber);
    console.log('📱 WhatsApp sent:', result.whatsappSent);
    return result;
  } catch (error) {
    console.error('❌ Regenerate failed:', error);
    throw error;
  }
}
```

### Use Case 3: Download PDF
```typescript
async function downloadIdCardPdf(reporterId: string) {
  try {
    const response = await fetch(
      `https://api.kaburlumedia.com/api/v1/id-cards/pdf?reporterId=${reporterId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`  // Optional for public access
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to download PDF');
    }
    
    const blob = await response.blob();
    // Handle PDF blob (save to device, open viewer, etc.)
    return blob;
  } catch (error) {
    console.error('❌ Download failed:', error);
    throw error;
  }
}
```

---

## 📋 Summary Checklist

### Before Generating ID Card
- [ ] Profile photo uploaded (Reporter.profilePhotoUrl OR UserProfile.profilePhotoUrl)
- [ ] Tenant ID card settings configured (Admin responsibility)
- [ ] If idCardCharge > 0: Onboarding payment PAID
- [ ] If subscriptionActive: Current month subscription PAID

### Before Resending (Reporter)
- [ ] ID card already exists in database
- [ ] If subscriptionActive: Current month subscription ACTIVE

### Before Regenerating (Reporter)
- [ ] Profile photo exists
- [ ] If subscriptionActive: Current month subscription ACTIVE
- [ ] Understand that old card will be deleted and new one created

---

## 🔗 Related APIs

- **Profile Photo Upload:** `POST /api/v1/profiles/me/photo`
- **Payment Creation:** `POST /api/v1/reporter-payments`
- **Payment Verification:** `POST /api/v1/reporter-payments/verify`
- **Subscription Status:** `GET /api/v1/reporters/me`
- **ID Card Settings:** `GET /api/v1/tenants/{tenantId}/id-card-settings`

---

## 🎉 Key Features

1. **Auto-Regeneration on Resend** - If PDF file missing, system automatically regenerates it
2. **Dual Provider Support** - Bunny CDN for storage + Dynamic PDF generation fallback
3. **WhatsApp Integration** - Automatic delivery via WhatsApp Business API
4. **Subscription Management** - Smart payment checks for reporter operations
5. **Photo Flexibility** - Checks both Reporter and UserProfile for photo
6. **PDF Download** - Direct PDF access without WhatsApp dependency

---

**Generated:** 4 February 2026  
**Backend Version:** Latest (with auto-regeneration fix)  
**Documentation Status:** ✅ Complete & Tested
