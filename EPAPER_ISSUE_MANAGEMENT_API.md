# ePaper Issue Management APIs

## Overview
Comprehensive APIs for managing ePaper PDF issues with duplicate prevention, date-wise filtering, and deletion capabilities for SUPER_ADMIN and DESK_EDITOR roles.

---

## New APIs

### 1. **Get All Issues by Date**
`GET /epaper/issues/all-by-date`

**Access**: SUPER_ADMIN & DESK_EDITOR

**Description**: Get all ePaper issues with optional date filtering and pagination.

**Query Parameters**:
- `issueDate` (optional): Filter by specific date (YYYY-MM-DD)
- `includePages` (optional, default: false): Include page image URLs
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 50, max: 100): Items per page
- `tenantId` (optional, SUPER_ADMIN only): Filter by tenant

**Response Example**:
```json
{
  "success": true,
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 127,
    "totalPages": 3
  },
  "issues": [
    {
      "id": "iss_1",
      "issueDate": "2026-01-18T00:00:00.000Z",
      "tenant": {
        "id": "t_abc",
        "slug": "kaburlu",
        "name": "Kaburlu News"
      },
      "edition": {
        "id": "ed_1",
        "name": "Telangana Edition",
        "slug": "telangana"
      },
      "subEdition": null,
      "pdfUrl": "https://cdn.example.com/epaper/pdfs/2026/01/18/telangana.pdf",
      "coverImageUrl": "https://cdn.example.com/epaper/pages/2026/01/18/telangana/p1.png",
      "pageCount": 12,
      "uploadedBy": {
        "id": "u_123",
        "name": "Admin User",
        "email": "admin@example.com"
      },
      "createdAt": "2026-01-18T06:00:00.000Z",
      "updatedAt": "2026-01-18T06:00:00.000Z"
    }
  ]
}
```

**Role Differences**:
- **SUPER_ADMIN**: Sees all tenants' issues
- **DESK_EDITOR**: Sees only their tenant's issues

---

### 2. **Get Tenant ePaper Issues**
`GET /epaper/issues/tenant`

**Access**: SUPER_ADMIN & DESK_EDITOR

**Description**: Get all issues for a specific tenant with date range and edition filtering. Results grouped by date.

**Query Parameters**:
- `tenantId` (optional, SUPER_ADMIN only): Specify tenant
- `startDate` (optional): Start date (YYYY-MM-DD), inclusive
- `endDate` (optional): End date (YYYY-MM-DD), inclusive
- `editionId` (optional): Filter by edition
- `subEditionId` (optional): Filter by sub-edition
- `includePages` (optional, default: false): Include page URLs

**Response Example**:
```json
{
  "success": true,
  "tenant": {
    "id": "t_abc",
    "slug": "kaburlu",
    "name": "Kaburlu News"
  },
  "totalIssues": 45,
  "issuesByDate": {
    "2026-01-18": [
      {
        "id": "iss_1",
        "edition": {
          "id": "ed_1",
          "name": "Telangana Edition",
          "slug": "telangana"
        },
        "subEdition": null,
        "pdfUrl": "https://cdn.example.com/epaper/pdfs/2026/01/18/telangana.pdf",
        "coverImageUrl": "https://cdn.example.com/epaper/pages/2026/01/18/telangana/p1.png",
        "pageCount": 12,
        "uploadedBy": {
          "id": "u_123",
          "name": "Admin User",
          "email": "admin@example.com"
        },
        "createdAt": "2026-01-18T06:00:00.000Z",
        "updatedAt": "2026-01-18T06:00:00.000Z"
      },
      {
        "id": "iss_2",
        "edition": {
          "id": "ed_2",
          "name": "Andhra Pradesh Edition",
          "slug": "andhra"
        },
        "subEdition": null,
        "pdfUrl": "https://cdn.example.com/epaper/pdfs/2026/01/18/andhra.pdf",
        "coverImageUrl": "https://cdn.example.com/epaper/pages/2026/01/18/andhra/p1.png",
        "pageCount": 10,
        "uploadedBy": {
          "id": "u_123",
          "name": "Admin User",
          "email": "admin@example.com"
        },
        "createdAt": "2026-01-18T06:15:00.000Z",
        "updatedAt": "2026-01-18T06:15:00.000Z"
      }
    ],
    "2026-01-17": [
      {
        "id": "iss_3",
        "edition": {
          "id": "ed_1",
          "name": "Telangana Edition",
          "slug": "telangana"
        },
        "subEdition": null,
        "pdfUrl": "https://cdn.example.com/epaper/pdfs/2026/01/17/telangana.pdf",
        "coverImageUrl": "https://cdn.example.com/epaper/pages/2026/01/17/telangana/p1.png",
        "pageCount": 14,
        "uploadedBy": {
          "id": "u_456",
          "name": "Desk Editor",
          "email": "desk@example.com"
        },
        "createdAt": "2026-01-17T06:00:00.000Z",
        "updatedAt": "2026-01-17T06:00:00.000Z"
      }
    ]
  }
}
```

**Use Cases**:
- Dashboard showing all issues for a tenant
- Date range reports
- Edition-specific issue lists
- Monthly/weekly issue management

---

### 3. **Check Issue Exists (Duplicate Prevention)**
`GET /epaper/issues/check-exists`

**Access**: All admins

**Description**: Check if an issue already exists before uploading to prevent duplicates.

**Query Parameters** (required):
- `issueDate` (required): Date to check (YYYY-MM-DD)
- `editionId` OR `subEditionId` (required): Exactly one must be provided
- `tenantId` (optional, SUPER_ADMIN only)

**Response When EXISTS**:
```json
{
  "exists": true,
  "message": "Issue already exists for this date and edition/sub-edition",
  "issue": {
    "id": "iss_1",
    "issueDate": "2026-01-18T00:00:00.000Z",
    "edition": {
      "id": "ed_1",
      "name": "Telangana Edition",
      "slug": "telangana"
    },
    "subEdition": null,
    "pdfUrl": "https://cdn.example.com/epaper/pdfs/2026/01/18/telangana.pdf",
    "coverImageUrl": "https://cdn.example.com/epaper/pages/2026/01/18/telangana/p1.png",
    "pageCount": 12,
    "uploadedBy": {
      "id": "u_123",
      "name": "Admin User",
      "email": "admin@example.com"
    },
    "createdAt": "2026-01-18T06:00:00.000Z",
    "updatedAt": "2026-01-18T06:00:00.000Z"
  },
  "action": {
    "canReplace": true,
    "canDelete": true,
    "suggestion": "Delete existing issue first or use replace/update endpoint"
  }
}
```

**Response When NOT EXISTS**:
```json
{
  "exists": false,
  "message": "No existing issue found. Safe to upload.",
  "canUpload": true
}
```

---

### 4. **Delete Issue**
`DELETE /epaper/issues/:id`

**Access**: SUPER_ADMIN & DESK_EDITOR (own tenant only)

**Description**: Permanently delete an ePaper issue including all files.

**URL Parameters**:
- `id` (required): Issue ID to delete

**What Gets Deleted**:
1. Issue database record
2. All page records (cascade)
3. PDF file from object storage
4. All page PNG images from object storage

**Response**:
```json
{
  "success": true,
  "message": "Issue deleted successfully",
  "deleted": {
    "issueId": "iss_1",
    "issueDate": "2026-01-18T00:00:00.000Z",
    "edition": "Telangana Edition",
    "subEdition": null,
    "pdfUrl": "https://cdn.example.com/epaper/pdfs/2026/01/18/telangana.pdf",
    "pageCount": 12,
    "deletedAt": "2026-01-18T10:30:00.000Z"
  }
}
```

**Access Control**:
- **SUPER_ADMIN**: Can delete any issue from any tenant
- **DESK_EDITOR**: Can delete only issues from their own tenant

---

## Duplicate Prevention Workflow

### Problem
Previously, users could upload the same date/edition multiple times, wasting:
- Processing time (PDF to PNG conversion)
- Storage space (duplicate files)
- Database records (duplicate entries)

### Solution
Implemented at multiple levels:

#### 1. **Pre-Upload Check** (Recommended)
```javascript
// Step 1: Check if issue exists
const checkResponse = await fetch('/epaper/issues/check-exists?' + new URLSearchParams({
  issueDate: '2026-01-18',
  editionId: 'ed_1'
}));

const checkData = await checkResponse.json();

if (checkData.exists) {
  // Issue exists - show options to user:
  console.log('Issue already exists:', checkData.issue);
  
  // Option 1: Delete first
  await fetch(`/epaper/issues/${checkData.issue.id}`, { method: 'DELETE' });
  
  // Option 2: Upload to replace (automatic in upload endpoint)
  // Upload will replace existing issue
}

// Step 2: Proceed with upload (safe)
const formData = new FormData();
formData.append('pdf', pdfFile);
formData.append('issueDate', '2026-01-18');
formData.append('editionId', 'ed_1');

await fetch('/epaper/pdf-issues/upload', {
  method: 'POST',
  body: formData
});
```

#### 2. **Automatic Replace on Upload**
The existing upload endpoints already support upsert:
- `POST /epaper/pdf-issues/upload`
- `POST /epaper/pdf-issues/upload-by-url`

If an issue exists for the same date/edition:
- Old PDF and pages are deleted
- New PDF and pages replace them
- Console log shows: `⚠️  Replacing existing issue: iss_1 for date 2026-01-18`

If no issue exists:
- New issue is created
- Console log shows: `✓ Creating new issue for date 2026-01-18`

---

## Best Practices

### 1. **Always Check Before Upload**
```javascript
// ✅ GOOD: Check first
const check = await checkIssueExists(date, editionId);
if (check.exists) {
  showUserConfirmation("Issue exists. Replace?");
}

// ❌ BAD: Upload blindly (wastes resources if replacing)
uploadIssue(pdf, date, editionId);
```

### 2. **Use Date-wise Listing for Management**
```javascript
// Get all issues for a specific date
const issues = await fetch('/epaper/issues/all-by-date?issueDate=2026-01-18');

// Show user which editions already have issues
issues.data.issues.forEach(issue => {
  console.log(`${issue.edition.name}: Already uploaded`);
});
```

### 3. **Delete Before Re-upload (Clean Approach)**
```javascript
// If you want a clean slate
if (check.exists) {
  await deleteIssue(check.issue.id);
  await uploadIssue(pdf, date, editionId);
}
```

### 4. **Use Tenant Issues for Reporting**
```javascript
// Monthly report
const issues = await fetch('/epaper/issues/tenant?' + new URLSearchParams({
  startDate: '2026-01-01',
  endDate: '2026-01-31'
}));

// Count by date
Object.keys(issues.issuesByDate).forEach(date => {
  console.log(`${date}: ${issues.issuesByDate[date].length} editions`);
});
```

---

## Error Handling

### Common Errors

**403 Forbidden**:
```json
{
  "error": "Only SUPER_ADMIN and DESK_EDITOR can access this endpoint"
}
```
→ User role insufficient

**400 Bad Request**:
```json
{
  "error": "Provide exactly one: editionId or subEditionId"
}
```
→ Must specify either edition OR sub-edition, not both

**404 Not Found**:
```json
{
  "error": "Issue not found"
}
```
→ Issue ID doesn't exist

**400 Invalid Date**:
```json
{
  "error": "Invalid date format. Must be YYYY-MM-DD",
  "code": "INVALID_DATE_FORMAT"
}
```
→ Date must be ISO format

---

## Role Permissions Matrix

| Endpoint | SUPER_ADMIN | DESK_EDITOR | TENANT_ADMIN | Others |
|----------|-------------|-------------|--------------|--------|
| `GET /issues/all-by-date` | ✅ All tenants | ✅ Own tenant | ❌ | ❌ |
| `GET /issues/tenant` | ✅ Any tenant | ✅ Own tenant | ❌ | ❌ |
| `GET /issues/check-exists` | ✅ | ✅ | ✅ | ❌ |
| `DELETE /issues/:id` | ✅ Any tenant | ✅ Own tenant | ❌ | ❌ |

---

## Testing Examples

### Test 1: Check for duplicates
```bash
curl -X GET "http://localhost:3000/epaper/issues/check-exists?issueDate=2026-01-18&editionId=ed_abc123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test 2: Get all issues for today
```bash
curl -X GET "http://localhost:3000/epaper/issues/all-by-date?issueDate=2026-01-18&page=1&limit=50" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test 3: Get tenant issues for January
```bash
curl -X GET "http://localhost:3000/epaper/issues/tenant?startDate=2026-01-01&endDate=2026-01-31&includePages=false" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test 4: Delete an issue
```bash
curl -X DELETE "http://localhost:3000/epaper/issues/iss_abc123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Related Files
- [issueManagement.controller.ts](src/api/epaper/issueManagement.controller.ts) - New controller implementation
- [epaper.routes.ts](src/api/epaper/epaper.routes.ts) - Routes with Swagger docs
- [pdfIssues.controller.ts](src/api/epaper/pdfIssues.controller.ts) - Enhanced with duplicate logging

---

## Swagger Documentation
All APIs are fully documented in Swagger UI at:
- Dev: `http://localhost:3000/api/docs`
- Production: `https://your-domain.com/api/docs`

Search for "EPF ePaper - Admin" tag to see all ePaper admin endpoints.
