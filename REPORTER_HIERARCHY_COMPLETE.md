# Reporter Hierarchy Complete Reference

## Overview
The reporter system now supports **6 levels** with flexible location ID handling and comprehensive designation hierarchy.

## Designation Hierarchy

### STATE Level (levelOrder: 0-1)
Editorial and administrative roles at the state level:

| Designation ID (DB cuid, varies) | Code | Name | Native Name | Level Order |
|---|---|---|---|---|
| (varies) | PUBLISHER | Publisher | ప్రచురణకర్త | 0 |
| (varies) | CHIEF_EDITOR | Chief Editor | ప్రధాన సంపాదకుడు | 0 |
| (varies) | EDITOR | Editor | సంపాదకుడు | 0 |
| (varies) | TENANT_ADMIN | Tenant Admin | టెనెంట్ అడ్మిన్ | 0 |
| (varies) | STATE_BUREAU_CHIEF | State Bureau Chief | రాష్ట్ర బ్యూరో చీఫ్ | 1 |

### DISTRICT Level (levelOrder: 1)
| Designation ID | Code | Name | Native Name |
|---------------|------|------|-------------|
| (varies) | STAFF_REPORTER | Staff Reporter | స్టాఫ్ రిపోర్టర్ |

### DIVISION Level (levelOrder: 2)
| Designation ID | Code | Name | Native Name |
|---------------|------|------|-------------|
| `cmkwcj8j50005jytf89cizzuu` | RC_INCHARGE | RC Incharge | ఆర్సీ ఇన్‌చార్జ్ |

### CONSTITUENCY Level (levelOrder: 3)
| Designation ID | Code | Name | Native Name |
|---------------|------|------|-------------|
| (varies) | CONSTITUENCY_REPORTER | Constituency Reporter | నియోజకవర్గ రిపోర్టర్ |

### ASSEMBLY Level (levelOrder: 4)
Various assembly-specific designations

### MANDAL Level (levelOrder: 5)
Various mandal-specific designations

## Location ID Flexibility

Each level accepts multiple location ID types for easier frontend integration:

### STATE
**Required:** `stateId` only

### DISTRICT
**Required:** `districtId` only

### DIVISION
**Accepts:** `districtId` OR `mandalId`
- Frontend can pass either district or mandal ID
- System stores as `divisionId`

### CONSTITUENCY
**Accepts:** `districtId` OR `mandalId` OR `assemblyConstituencyId`
- Frontend can pass any of these three IDs
- System stores as `constituencyId`

### ASSEMBLY
**Accepts:** `assemblyConstituencyId` OR `mandalId` OR `districtId`
- **Auto-Resolution Logic:**
  - If `mandalId` provided → Finds mandal's district → Uses first assembly in that district
  - If `districtId` provided → Uses first assembly in that district
  - If `assemblyConstituencyId` provided → Uses directly
- System logs resolution: `[ASSEMBLY Resolver] Mandal X → Assembly Y`

### MANDAL
**Required:** `mandalId` only

## Complete API Payloads

### 1. Publisher (STATE Level - Editorial)
```json
POST /api/v1/tenants/{tenantId}/reporters
{
  "designationId": "<publisherDesignationId>",
  "level": "STATE",
  "stateId": "cmit7pjf30001ugaov86j0ed5",
  "subscriptionActive": false,
  "manualLoginEnabled": true,
  "manualLoginDays": 365,
  "autoPublish": true,
  "monthlySubscriptionAmount": 0,
  "idCardCharge": 0,
  "fullName": "Publisher Name",
  "mobileNumber": "9502444444"
}
```

### 2. Chief Editor (STATE Level - Editorial)
```json
POST /api/v1/tenants/{tenantId}/reporters
{
  "designationId": "<chiefEditorDesignationId>",
  "level": "STATE",
  "stateId": "cmit7pjf30001ugaov86j0ed5",
  "subscriptionActive": false,
  "manualLoginEnabled": true,
  "manualLoginDays": 365,
  "autoPublish": true,
  "fullName": "Chief Editor Name",
  "mobileNumber": "9502555555"
}
```

### 3. Editor (STATE Level - Editorial)
```json
POST /api/v1/tenants/{tenantId}/reporters
{
  "designationId": "<editorDesignationId>",
  "level": "STATE",
  "stateId": "cmit7pjf30001ugaov86j0ed5",
  "subscriptionActive": false,
  "manualLoginEnabled": true,
  "manualLoginDays": 365,
  "autoPublish": true,
  "fullName": "Editor Name",
  "mobileNumber": "9502666666"
}
```

### 4. Tenant Admin (STATE Level)
```json
POST /api/v1/tenants/{tenantId}/reporters
{
  "designationId": "tenant-admin-global",
  "level": "STATE",
  "stateId": "cmit7pjf30001ugaov86j0ed5",
  "subscriptionActive": false,
  "manualLoginEnabled": true,
  "manualLoginDays": 365,
  "autoPublish": true,
  "fullName": "Admin Name",
  "mobileNumber": "9502123456"
}
```

### 5. State Bureau Chief (STATE Level)
```json
POST /api/v1/tenants/{tenantId}/reporters
{
  "designationId": "cmit7cpar0001ugkojh66y6ww",
  "level": "STATE",
  "stateId": "cmit7pjf30001ugaov86j0ed5",
  "subscriptionActive": false,
  "manualLoginEnabled": true,
  "manualLoginDays": 30,
  "autoPublish": true,
  "fullName": "Bureau Chief Name",
  "mobileNumber": "9502337778"
}
```

### 6. Staff Reporter (DISTRICT Level)
```json
POST /api/v1/tenants/{tenantId}/reporters
{
  "designationId": "cmit7cpar0001ugkojh66y6ww",
  "level": "DISTRICT",
  "districtId": "cmit7pjf30001ugaov86j0abc",
  "subscriptionActive": true,
  "monthlySubscriptionAmount": 19900,
  "idCardCharge": 0,
  "autoPublish": true,
  "fullName": "District Reporter Name",
  "mobileNumber": "9502000000"
}
```

### 7. RC Incharge (DIVISION Level) - Option A: With districtId
```json
POST /api/v1/tenants/{tenantId}/reporters
{
  "designationId": "cmkwcj8j50005jytf89cizzuu",
  "level": "DIVISION",
  "districtId": "cmit7pjf30001ugaov86j0abc",
  "subscriptionActive": false,
  "manualLoginEnabled": true,
  "manualLoginDays": 90,
  "autoPublish": true,
  "fullName": "RC Incharge Name",
  "mobileNumber": "9502111111"
}
```

### 8. RC Incharge (DIVISION Level) - Option B: With mandalId
```json
POST /api/v1/tenants/{tenantId}/reporters
{
  "designationId": "cmkwcj8j50005jytf89cizzuu",
  "level": "DIVISION",
  "mandalId": "cmkkud63k005vugvkwpo5o611",
  "subscriptionActive": true,
  "monthlySubscriptionAmount": 15000,
  "autoPublish": true,
  "fullName": "RC Incharge Name",
  "mobileNumber": "9502111112"
}
```

### 9. Constituency Reporter (CONSTITUENCY Level)
```json
POST /api/v1/tenants/{tenantId}/reporters
{
  "designationId": "<constituencyReporterDesignationId>",
  "level": "CONSTITUENCY",
  "districtId": "cmit7pjf30001ugaov86j0abc",
  "subscriptionActive": false,
  "manualLoginEnabled": true,
  "manualLoginDays": 60,
  "autoPublish": false,
  "fullName": "Constituency Reporter Name",
  "mobileNumber": "9502222222"
}
```

### 10. Assembly Reporter (ASSEMBLY Level) - Option A: With mandalId (auto-resolves)
```json
POST /api/v1/tenants/{tenantId}/reporters
{
  "designationId": "cmit7cpar0001ugkojh66y6ww",
  "level": "ASSEMBLY",
  "mandalId": "cmkkud63k005vugvkwpo5o611",
  "subscriptionActive": false,
  "manualLoginEnabled": true,
  "manualLoginDays": 365,
  "autoPublish": true,
  "fullName": "Assembly Reporter",
  "mobileNumber": "9502333333"
}
```

### 11. Assembly Reporter (ASSEMBLY Level) - Option B: With districtId (auto-resolves)
```json
POST /api/v1/tenants/{tenantId}/reporters
{
  "designationId": "cmit7cpar0001ugkojh66y6ww",
  "level": "ASSEMBLY",
  "districtId": "cmit7pjf30001ugaov86j0abc",
  "subscriptionActive": true,
  "monthlySubscriptionAmount": 10000,
  "autoPublish": true,
  "fullName": "Assembly Reporter",
  "mobileNumber": "9502333334"
}
```

### 12. Mandal Reporter (MANDAL Level)
```json
POST /api/v1/tenants/{tenantId}/reporters
{
  "designationId": "cmit7cpar0001ugkojh66y6ww",
  "level": "MANDAL",
  "mandalId": "cmkkud63k005vugvkwpo5o611",
  "subscriptionActive": false,
  "manualLoginEnabled": true,
  "manualLoginDays": 7,
  "autoPublish": false,
  "fullName": "Mandal Reporter Name",
  "mobileNumber": "9502777777"
}
```

### 13. Scheduled Subscription Activation
```json
POST /api/v1/tenants/{tenantId}/reporters
{
  "designationId": "cmit7cpar0001ugkojh66y6ww",
  "level": "DISTRICT",
  "districtId": "cmit7pjf30001ugaov86j0abc",
  "subscriptionActive": false,
  "subscriptionActivationDate": "2026-03-01T00:00:00.000Z",
  "monthlySubscriptionAmount": 5000,
  "idCardCharge": 1000,
  "fullName": "Scheduled Reporter",
  "mobileNumber": "9502000002"
}
```

## Field Explanations

### Required Fields
- `designationId`: Unique designation identifier (see table above)
- `level`: One of: STATE, DISTRICT, DIVISION, CONSTITUENCY, ASSEMBLY, MANDAL
- `fullName`: Reporter's full name
- `mobileNumber`: 10-digit mobile number (with country code if needed)

### Location Fields (conditional based on level)
- `stateId`: Required for STATE level
- `districtId`: Required for DISTRICT; Optional for DIVISION, CONSTITUENCY, ASSEMBLY
- `divisionId`: Optional (system-generated based on input)
- `constituencyId`: Optional (system-generated based on input)
- `mandalId`: Required for MANDAL; Optional for DIVISION, CONSTITUENCY, ASSEMBLY
- `assemblyConstituencyId`: Optional for CONSTITUENCY, ASSEMBLY

### Subscription Fields
- `subscriptionActive`: Boolean - whether reporter has active paid subscription
- `subscriptionActivationDate`: ISO 8601 date - schedule future activation
- `monthlySubscriptionAmount`: Integer in smallest currency unit (e.g., 19900 = ₹199.00)
- `idCardCharge`: Integer in smallest currency unit

### Manual Login Fields (only when subscriptionActive=false)
- `manualLoginEnabled`: Boolean - tenant-admin managed time-based login
- `manualLoginDays`: Integer - number of days for manual access (e.g., 7, 30, 365)

### Editorial Settings
- `autoPublish`: Boolean - whether reporter's articles auto-publish without approval

## Frontend Dropdown Examples

### Level Dropdown
```typescript
const levels = [
  { value: 'STATE', label: 'State' },
  { value: 'DISTRICT', label: 'District' },
  { value: 'DIVISION', label: 'Division' },
  { value: 'CONSTITUENCY', label: 'Constituency' },
  { value: 'ASSEMBLY', label: 'Assembly' },
  { value: 'MANDAL', label: 'Mandal' }
];
```

### Designation Dropdown (filtered by level)
```typescript
const designations = {
  STATE: [
    { id: '<publisherDesignationId>', name: 'Publisher', nativeName: 'ప్రచురణకర్త' },
    { id: '<chiefEditorDesignationId>', name: 'Chief Editor', nativeName: 'ప్రధాన సంపాదకుడు' },
    { id: '<editorDesignationId>', name: 'Editor', nativeName: 'సంపాదకుడు' },
    { id: '<tenantAdminDesignationId>', name: 'Tenant Admin', nativeName: 'టెనెంట్ అడ్మిన్' },
    // ... other STATE designations
  ],
  DISTRICT: [
    // ... DISTRICT designations
  ],
  DIVISION: [
    { id: 'cmkwcj8j50005jytf89cizzuu', name: 'RC Incharge', nativeName: 'ఆర్సీ ఇన్‌చార్జ్' }
  ],
  CONSTITUENCY: [
    { id: '<constituencyReporterDesignationId>', name: 'Constituency Reporter', nativeName: 'నియోజకవర్గ రిపోర్టర్' }
  ],
  // ... other levels
};
```

### Location Field Visibility (based on level)
```typescript
const locationFields = {
  STATE: ['stateId'],
  DISTRICT: ['districtId'],
  DIVISION: ['districtId', 'mandalId'], // Either one
  CONSTITUENCY: ['districtId', 'mandalId', 'assemblyConstituencyId'], // Any one
  ASSEMBLY: ['assemblyConstituencyId', 'mandalId', 'districtId'], // Any one (with note about auto-resolve)
  MANDAL: ['mandalId']
};
```

## Validation Rules

1. **Level-specific location ID:**
   - STATE: `stateId` required
   - DISTRICT: `districtId` required
   - DIVISION: `districtId` OR `mandalId` required
   - CONSTITUENCY: `districtId` OR `mandalId` OR `assemblyConstituencyId` required
   - ASSEMBLY: `assemblyConstituencyId` OR `mandalId` OR `districtId` required (auto-resolves)
   - MANDAL: `mandalId` required

2. **Manual Login Rules:**
   - `manualLoginEnabled=true` requires `subscriptionActive=false`
   - When `manualLoginEnabled=true`, `manualLoginDays` must be positive integer

3. **Subscription Rules:**
   - Cannot have both `subscriptionActive=true` and `manualLoginEnabled=true`
   - When `subscriptionActivationDate` is set, subscription activates on that future date

## API Response

Successful creation returns:
```json
{
  "id": "cml7u9y6e01f2jy7h3x68bm44",
  "tenantId": "cmkh94g0s01eykb21toi1oucu",
  "userId": "cml7u9y6d01ezjy7haz1v2f0k",
  "designationId": "<designationId>",
  "level": "CONSTITUENCY",
  "stateId": null,
  "districtId": null,
  "divisionId": null,
  "constituencyId": "cmit7pjf30001ugaov86j0abc",
  "mandalId": null,
  "assemblyConstituencyId": null,
  "subscriptionActive": false,
  "subscriptionActivationDate": null,
  "monthlySubscriptionAmount": 0,
  "idCardCharge": 0,
  "manualLoginEnabled": true,
  "manualLoginDays": 60,
  "kycStatus": "PENDING",
  "active": true,
  "fullName": "Constituency Reporter Name",
  "mobileNumber": "9502222222",
  "autoPublish": false
}
```

## Error Codes

- `400`: Missing required fields or validation error
- `403`: Forbidden (insufficient permissions or scope mismatch)
- `409`: Reporter limit reached for this designation + location
- `500`: Server error

## Notes

1. **Auto-Resolution for ASSEMBLY level:**
   - System automatically finds the correct assembly constituency when you provide mandal or district ID
   - Logs resolution for debugging: `[ASSEMBLY Resolver] Mandal cmkkud... → Assembly cmkmzz...`

2. **Reporter Limits:**
   - Configurable per tenant via `TenantSettings.data.reporterLimits`
   - Default: 1 reporter per (designation + level + location)
   - Can be overridden with specific rules

3. **Subscription vs Manual Login:**
   - Use `subscriptionActive=true` for paid reporters
   - Use `manualLoginEnabled=true` with `manualLoginDays` for temporary/trial access
   - These are mutually exclusive

4. **ID Card Generation:**
   - Automatically generates ID card after reporter creation
   - Card number format: `{prefix}{sequenceNumber}`
   - Uploads to Cloudflare R2
   - Sends via WhatsApp if configured

## Migration Path

If you have old data with only 4 levels (STATE, DISTRICT, ASSEMBLY, MANDAL), the system is backward compatible. The new levels (DIVISION, CONSTITUENCY) are additions and don't break existing data.

## Database Schema

```prisma
model Reporter {
  id                         String                @id @default(cuid())
  tenantId                   String
  level                      ReporterLevel?
  stateId                    String?
  districtId                 String?
  divisionId                 String?               // NEW
  constituencyId             String?               // NEW
  mandalId                   String?
  assemblyConstituencyId     String?
  // ... other fields
}

enum ReporterLevel {
  STATE
  DISTRICT
  DIVISION         // NEW
  CONSTITUENCY     // NEW
  ASSEMBLY
  MANDAL
}
```

## Updated: 2026-02-04
