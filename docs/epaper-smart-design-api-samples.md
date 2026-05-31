# ePaper Smart Design — All API Sample Responses

Base: `https://api.kaburlumedia.com/api/v1`

Headers (all except header-styles catalog):

```http
Authorization: Bearer <JWT>
X-Tenant-Id: cltenant_abc123
```

---

## 1. GET `/epaper/smart-design/header-styles`

### Request

```http
GET /api/v1/epaper/smart-design/header-styles
Authorization: Bearer <JWT>
```

### Response `200 OK`

```json
{
  "source": "database",
  "mainHeaders": [
    {
      "id": 1,
      "number": 1,
      "type": "MAIN",
      "key": "main_style1",
      "slug": "classic_3_col_info_bar",
      "name": "Classic 3-Col + Info Bar",
      "nameTe": "క్లాసిక్ 3-కాలమ్ + ఇన్ఫో బార్",
      "supportsCenterLogo": true,
      "supportsLeftImage": true,
      "supportsRightImage": true,
      "supportsPaperNameImage": true,
      "supportsSubHeaderCenterImage": false
    },
    {
      "id": 2,
      "number": 2,
      "type": "MAIN",
      "key": "main_style2",
      "slug": "prabha_3_col_meta_strip",
      "name": "Prabha 3-Col + Meta Strip",
      "nameTe": "ప్రభ 3-కాలమ్ + మెటా స్ట్రిప్",
      "supportsCenterLogo": true,
      "supportsLeftImage": true,
      "supportsRightImage": true,
      "supportsPaperNameImage": true,
      "supportsSubHeaderCenterImage": false
    }
  ],
  "subHeaders": [
    {
      "id": 11,
      "number": 1,
      "type": "SUB",
      "key": "sub_header_style1",
      "slug": "page_logo_date",
      "name": "Page · Logo · Date",
      "nameTe": "పేజీ · లోగో · తేదీ",
      "supportsCenterLogo": false,
      "supportsLeftImage": false,
      "supportsRightImage": false,
      "supportsPaperNameImage": false,
      "supportsSubHeaderCenterImage": true
    },
    {
      "id": 12,
      "number": 2,
      "type": "SUB",
      "key": "sub_header_style2",
      "slug": "full_color_bar",
      "name": "Full Color Bar",
      "nameTe": "పూర్తి రంగు బార్",
      "supportsCenterLogo": false,
      "supportsLeftImage": false,
      "supportsRightImage": false,
      "supportsPaperNameImage": false,
      "supportsSubHeaderCenterImage": true
    }
  ],
  "all": []
}
```

### Response `500`

```json
{
  "error": "Failed to load header styles"
}
```

---

## 2. GET `/admin/epaper/header-styles`

### Request

```http
GET /api/v1/admin/epaper/header-styles
Authorization: Bearer <SUPER_ADMIN_JWT>
```

### Response `200 OK`

Same body as **§1** (`source`, `mainHeaders`, `subHeaders`, `all`).

### Response `403 Forbidden`

```json
{
  "error": "Superadmin only"
}
```

---

## 3. GET `/epaper/smart-design/context`

### Request

```http
GET /api/v1/epaper/smart-design/context
Authorization: Bearer <JWT>
X-Tenant-Id: cltenant_abc123
```

### Response `200 OK`

```json
{
  "tenantId": "cltenant_abc123",
  "tenantName": "Telugu Daily",
  "tenantSlug": "telugu-daily",
  "prgiNumber": "TELENG/2024/12345",
  "prgiStatus": "VERIFIED",
  "epaperDomain": "epaper.telugudaily.com",
  "epaperDomainId": "cldom_epaper1",
  "totalDesigns": 2,
  "editions": [
    {
      "id": "ed_telangana",
      "name": "Telangana Edition",
      "slug": "telangana",
      "state": {
        "id": "st_tg",
        "name": "Telangana"
      },
      "subEditions": [
        {
          "id": "sub_hyd",
          "name": "Hyderabad",
          "slug": "hyderabad",
          "districtId": "dist_hyd"
        },
        {
          "id": "sub_wgl",
          "name": "Warangal",
          "slug": "warangal",
          "districtId": "dist_wgl"
        }
      ],
      "hasDesign": true,
      "designIds": ["clsd_main_tg", "clsd_hyd"]
    },
    {
      "id": "ed_andhra",
      "name": "Andhra Edition",
      "slug": "andhra",
      "state": {
        "id": "st_ap",
        "name": "Andhra Pradesh"
      },
      "subEditions": [],
      "hasDesign": false,
      "designIds": []
    }
  ],
  "headerStyles": {
    "mainHeaders": [
      {
        "number": 1,
        "key": "main_style1",
        "slug": "classic_3_col_info_bar",
        "name": "Classic 3-Col + Info Bar",
        "nameTe": "క్లాసిక్ 3-కాలమ్ + ఇన్ఫో బార్",
        "type": "MAIN",
        "supportsCenterLogo": true,
        "supportsLeftImage": true,
        "supportsRightImage": true,
        "supportsPaperNameImage": true,
        "supportsSubHeaderCenterImage": false
      }
    ],
    "subHeaders": [
      {
        "number": 1,
        "key": "sub_header_style1",
        "slug": "page_logo_date",
        "name": "Page · Logo · Date",
        "nameTe": "పేజీ · లోగో · తేదీ",
        "type": "SUB",
        "supportsCenterLogo": false,
        "supportsLeftImage": false,
        "supportsRightImage": false,
        "supportsPaperNameImage": false,
        "supportsSubHeaderCenterImage": true
      }
    ],
    "all": []
  }
}
```

### Response `400 Bad Request`

```json
{
  "error": "Tenant context required (X-Tenant-Id)"
}
```

### Response `403 Forbidden`

```json
{
  "error": "Admin access required"
}
```

### Response `404 Not Found`

```json
{
  "error": "Tenant not found"
}
```

---

## 4. GET `/epaper/smart-design`

### Request (all designs)

```http
GET /api/v1/epaper/smart-design
Authorization: Bearer <JWT>
X-Tenant-Id: cltenant_abc123
```

### Request (filter by edition)

```http
GET /api/v1/epaper/smart-design?publicationEditionId=ed_telangana
Authorization: Bearer <JWT>
X-Tenant-Id: cltenant_abc123
```

### Response `200 OK`

```json
{
  "tenantId": "cltenant_abc123",
  "total": 2,
  "items": [
    {
      "id": "clsd_main_tg",
      "tenantId": "cltenant_abc123",
      "publicationEditionId": "ed_telangana",
      "subEditionId": null,
      "subEditionScopeKey": "",
      "paperType": "TABLOID",
      "totalPages": 12,
      "perPageCostMonthly": 2500,
      "paperSellCost": 6,
      "headerStyleNumber": 2,
      "subHeaderStyleNumber": 1,
      "headerStyleKey": "main_style2",
      "subHeaderStyleKey": "sub_header_style1",
      "headerData": "తెలుగుప్రభ",
      "headerLogoUrl": "https://cdn.example.com/epaper/logo.png",
      "subHeaderLogoUrl": "https://cdn.example.com/epaper/sub-logo.png",
      "paperNameImageUrl": null,
      "headerLeftImageUrl": "https://cdn.example.com/epaper/ad-left.png",
      "headerRightImageUrl": "https://cdn.example.com/epaper/ad-right.png",
      "publishedAreaText": "Hyderabad • Warangal • Nizamabad",
      "tagline": "Truth First",
      "websiteUrl": "https://epaper.telugudaily.com",
      "runningCommentText": null,
      "runningCommentAuthor": "Editor",
      "rightArticleTitle": null,
      "rightArticlePoints": null,
      "lastPageFooterText": "Printed at Hyderabad. RNI TELENG/2024/12345",
      "volumeStartNumber": 1,
      "volumeStartYear": 2024,
      "issueStartNumber": 1,
      "issueStartDate": "2024-01-01T00:00:00.000Z",
      "issueCounterMode": "SEQUENTIAL",
      "newsCloseTime": "23:00",
      "languageCode": "te",
      "isActive": true,
      "styleCapabilities": {
        "mainHeader": {
          "number": 2,
          "key": "main_style2",
          "slug": "prabha_3_col_meta_strip",
          "name": "Prabha 3-Col + Meta Strip",
          "nameTe": "ప్రభ 3-కాలమ్ + మెటా స్ట్రిప్",
          "type": "MAIN",
          "supportsCenterLogo": true,
          "supportsLeftImage": true,
          "supportsRightImage": true,
          "supportsPaperNameImage": true,
          "supportsSubHeaderCenterImage": false
        },
        "subHeader": {
          "number": 1,
          "key": "sub_header_style1",
          "slug": "page_logo_date",
          "name": "Page · Logo · Date",
          "nameTe": "పేజీ · లోగో · తేదీ",
          "type": "SUB",
          "supportsCenterLogo": false,
          "supportsLeftImage": false,
          "supportsRightImage": false,
          "supportsPaperNameImage": false,
          "supportsSubHeaderCenterImage": true
        },
        "allowedFields": {
          "headerLogoUrl": true,
          "headerLeftImageUrl": true,
          "headerRightImageUrl": true,
          "paperNameImageUrl": true,
          "subHeaderLogoUrl": true
        }
      },
      "publicationEdition": {
        "id": "ed_telangana",
        "name": "Telangana Edition",
        "slug": "telangana"
      },
      "subEdition": null,
      "today": {
        "issueDate": "2026-05-28",
        "dayNameTelugu": "బుధవారం",
        "currentVolume": 3,
        "currentIssue": 148,
        "maxIssuePerYear": 365,
        "newsWindow": {
          "fromDate": "2026-05-28T00:00:00+05:30",
          "toDate": "2026-05-28T23:00:00+05:30"
        }
      },
      "createdAt": "2026-05-20T10:00:00.000Z",
      "updatedAt": "2026-05-28T08:30:00.000Z"
    },
    {
      "id": "clsd_hyd",
      "tenantId": "cltenant_abc123",
      "publicationEditionId": "ed_telangana",
      "subEditionId": "sub_hyd",
      "subEditionScopeKey": "sub_hyd",
      "paperType": "TABLOID",
      "totalPages": 8,
      "perPageCostMonthly": 1800,
      "paperSellCost": 5,
      "headerStyleNumber": 5,
      "subHeaderStyleNumber": 4,
      "headerStyleKey": "main_style5",
      "subHeaderStyleKey": "sub_header_style4",
      "headerData": "తెలుగుప్రభ - హైదరాబాద్",
      "headerLogoUrl": null,
      "subHeaderLogoUrl": null,
      "paperNameImageUrl": null,
      "headerLeftImageUrl": null,
      "headerRightImageUrl": null,
      "publishedAreaText": "Hyderabad",
      "tagline": null,
      "websiteUrl": null,
      "runningCommentText": null,
      "runningCommentAuthor": null,
      "rightArticleTitle": null,
      "rightArticlePoints": null,
      "lastPageFooterText": null,
      "volumeStartNumber": 1,
      "volumeStartYear": 2024,
      "issueStartNumber": 1,
      "issueStartDate": "2024-01-01T00:00:00.000Z",
      "issueCounterMode": "SEQUENTIAL",
      "newsCloseTime": "23:00",
      "languageCode": "te",
      "isActive": true,
      "styleCapabilities": {
        "mainHeader": {
          "number": 5,
          "key": "main_style5",
          "slug": "split_name_ad_panel",
          "name": "Split — Name + Ad Panel",
          "type": "MAIN",
          "supportsCenterLogo": true,
          "supportsLeftImage": true,
          "supportsRightImage": true,
          "supportsPaperNameImage": true,
          "supportsSubHeaderCenterImage": false
        },
        "subHeader": {
          "number": 4,
          "key": "sub_header_style4",
          "slug": "edition_name_strip",
          "name": "Edition Name Strip",
          "type": "SUB",
          "supportsSubHeaderCenterImage": true
        },
        "allowedFields": {
          "headerLogoUrl": true,
          "headerLeftImageUrl": true,
          "headerRightImageUrl": true,
          "paperNameImageUrl": true,
          "subHeaderLogoUrl": true
        }
      },
      "publicationEdition": {
        "id": "ed_telangana",
        "name": "Telangana Edition",
        "slug": "telangana"
      },
      "subEdition": {
        "id": "sub_hyd",
        "name": "Hyderabad",
        "slug": "hyderabad"
      },
      "today": {
        "issueDate": "2026-05-28",
        "dayNameTelugu": "బుధవారం",
        "currentVolume": 3,
        "currentIssue": 148,
        "maxIssuePerYear": 365,
        "newsWindow": {
          "fromDate": "2026-05-28T00:00:00+05:30",
          "toDate": "2026-05-28T23:00:00+05:30"
        }
      },
      "createdAt": "2026-05-21T11:00:00.000Z",
      "updatedAt": "2026-05-27T09:00:00.000Z"
    }
  ]
}
```

### Response `500`

```json
{
  "error": "Failed to list smart designs"
}
```

---

## 5. GET `/epaper/smart-design/{id}`

### Request

```http
GET /api/v1/epaper/smart-design/clsd_main_tg
Authorization: Bearer <JWT>
X-Tenant-Id: cltenant_abc123
```

### Response `200 OK`

```json
{
  "design": {
    "id": "clsd_main_tg",
    "tenantId": "cltenant_abc123",
    "publicationEditionId": "ed_telangana",
    "subEditionId": null,
    "subEditionScopeKey": "",
    "paperType": "TABLOID",
    "totalPages": 12,
    "perPageCostMonthly": 2500,
    "paperSellCost": 6,
    "headerStyleNumber": 2,
    "subHeaderStyleNumber": 1,
    "headerStyleKey": "main_style2",
    "subHeaderStyleKey": "sub_header_style1",
    "headerData": "తెలుగుప్రభ",
    "headerLogoUrl": "https://cdn.example.com/epaper/logo.png",
    "subHeaderLogoUrl": "https://cdn.example.com/epaper/sub-logo.png",
    "paperNameImageUrl": null,
    "headerLeftImageUrl": "https://cdn.example.com/epaper/ad-left.png",
    "headerRightImageUrl": "https://cdn.example.com/epaper/ad-right.png",
    "publishedAreaText": "Hyderabad • Warangal • Nizamabad",
    "tagline": "Truth First",
    "websiteUrl": "https://epaper.telugudaily.com",
    "runningCommentText": null,
    "runningCommentAuthor": "Editor",
    "rightArticleTitle": null,
    "rightArticlePoints": null,
    "lastPageFooterText": "Printed at Hyderabad. RNI TELENG/2024/12345",
    "volumeStartNumber": 1,
    "volumeStartYear": 2024,
    "issueStartNumber": 1,
    "issueStartDate": "2024-01-01T00:00:00.000Z",
    "issueCounterMode": "SEQUENTIAL",
    "newsCloseTime": "23:00",
    "languageCode": "te",
    "isActive": true,
    "styleCapabilities": {
      "mainHeader": {
        "number": 2,
        "key": "main_style2",
        "slug": "prabha_3_col_meta_strip",
        "name": "Prabha 3-Col + Meta Strip",
        "nameTe": "ప్రభ 3-కాలమ్ + మెటా స్ట్రిప్",
        "type": "MAIN",
        "supportsCenterLogo": true,
        "supportsLeftImage": true,
        "supportsRightImage": true,
        "supportsPaperNameImage": true,
        "supportsSubHeaderCenterImage": false
      },
      "subHeader": {
        "number": 1,
        "key": "sub_header_style1",
        "slug": "page_logo_date",
        "name": "Page · Logo · Date",
        "nameTe": "పేజీ · లోగో · తేదీ",
        "type": "SUB",
        "supportsCenterLogo": false,
        "supportsLeftImage": false,
        "supportsRightImage": false,
        "supportsPaperNameImage": false,
        "supportsSubHeaderCenterImage": true
      },
      "allowedFields": {
        "headerLogoUrl": true,
        "headerLeftImageUrl": true,
        "headerRightImageUrl": true,
        "paperNameImageUrl": true,
        "subHeaderLogoUrl": true
      }
    },
    "publicationEdition": {
      "id": "ed_telangana",
      "name": "Telangana Edition",
      "slug": "telangana",
      "stateId": "st_tg"
    },
    "subEdition": null,
    "today": {
      "issueDate": "2026-05-28",
      "dayNameTelugu": "బుధవారం",
      "currentVolume": 3,
      "currentIssue": 148,
      "maxIssuePerYear": 365,
      "newsWindow": {
        "fromDate": "2026-05-28T00:00:00+05:30",
        "toDate": "2026-05-28T23:00:00+05:30"
      }
    },
    "createdAt": "2026-05-20T10:00:00.000Z",
    "updatedAt": "2026-05-28T08:30:00.000Z"
  },
  "prgiNumber": "TELENG/2024/12345",
  "epaperDomain": "epaper.telugudaily.com"
}
```

### Response `404 Not Found`

```json
{
  "error": "Smart design not found"
}
```

---

## 6. POST `/epaper/smart-design`

### Request body (JSON)

```json
{
  "publicationEditionId": "ed_telangana",
  "subEditionId": null,
  "paperType": "TABLOID",
  "totalPages": 12,
  "perPageCostMonthly": 2500,
  "paperSellCost": 6,
  "headerStyleNumber": 2,
  "subHeaderStyleNumber": 1,
  "headerStyleKey": "main_style2",
  "subHeaderStyleKey": "sub_header_style1",
  "headerData": "తెలుగుప్రభ",
  "headerLogoUrl": "https://cdn.example.com/epaper/logo.png",
  "headerLeftImageUrl": "https://cdn.example.com/epaper/ad-left.png",
  "headerRightImageUrl": "https://cdn.example.com/epaper/ad-right.png",
  "publishedAreaText": "Hyderabad • Warangal",
  "tagline": "Truth First",
  "websiteUrl": "https://epaper.telugudaily.com",
  "lastPageFooterText": "Printed at Hyderabad.",
  "volumeStartNumber": 1,
  "volumeStartYear": 2024,
  "issueStartNumber": 1,
  "issueStartDate": "2024-01-01",
  "issueCounterMode": "SEQUENTIAL",
  "newsCloseTime": "23:00",
  "languageCode": "te"
}
```

### Response `201 Created`

```json
{
  "success": true,
  "prgiNumber": "TELENG/2024/12345",
  "epaperDomain": "epaper.telugudaily.com",
  "design": {
    "id": "clsd_xyz789",
    "tenantId": "cltenant_abc123",
    "publicationEditionId": "ed_telangana",
    "subEditionId": null,
    "subEditionScopeKey": "",
    "paperType": "TABLOID",
    "totalPages": 12,
    "perPageCostMonthly": 2500,
    "paperSellCost": 6,
    "headerStyleNumber": 2,
    "subHeaderStyleNumber": 1,
    "headerStyleKey": "main_style2",
    "subHeaderStyleKey": "sub_header_style1",
    "headerData": "తెలుగుప్రభ",
    "headerLogoUrl": "https://cdn.example.com/epaper/logo.png",
    "subHeaderLogoUrl": null,
    "paperNameImageUrl": null,
    "headerLeftImageUrl": "https://cdn.example.com/epaper/ad-left.png",
    "headerRightImageUrl": "https://cdn.example.com/epaper/ad-right.png",
    "publishedAreaText": "Hyderabad • Warangal",
    "tagline": "Truth First",
    "websiteUrl": "https://epaper.telugudaily.com",
    "runningCommentText": null,
    "runningCommentAuthor": null,
    "rightArticleTitle": null,
    "rightArticlePoints": null,
    "lastPageFooterText": "Printed at Hyderabad.",
    "volumeStartNumber": 1,
    "volumeStartYear": 2024,
    "issueStartNumber": 1,
    "issueStartDate": "2024-01-01T00:00:00.000Z",
    "issueCounterMode": "SEQUENTIAL",
    "newsCloseTime": "23:00",
    "languageCode": "te",
    "isActive": true,
    "styleCapabilities": {
      "mainHeader": {
        "number": 2,
        "key": "main_style2",
        "slug": "prabha_3_col_meta_strip",
        "name": "Prabha 3-Col + Meta Strip",
        "type": "MAIN",
        "supportsCenterLogo": true,
        "supportsLeftImage": true,
        "supportsRightImage": true,
        "supportsPaperNameImage": true,
        "supportsSubHeaderCenterImage": false
      },
      "subHeader": {
        "number": 1,
        "key": "sub_header_style1",
        "slug": "page_logo_date",
        "name": "Page · Logo · Date",
        "type": "SUB",
        "supportsSubHeaderCenterImage": true
      },
      "allowedFields": {
        "headerLogoUrl": true,
        "headerLeftImageUrl": true,
        "headerRightImageUrl": true,
        "paperNameImageUrl": true,
        "subHeaderLogoUrl": true
      }
    },
    "publicationEdition": {
      "id": "ed_telangana",
      "name": "Telangana Edition",
      "slug": "telangana"
    },
    "subEdition": null,
    "today": {
      "issueDate": "2026-05-28",
      "dayNameTelugu": "బుధవారం",
      "currentVolume": 3,
      "currentIssue": 148,
      "maxIssuePerYear": 365,
      "newsWindow": {
        "fromDate": "2026-05-28T00:00:00+05:30",
        "toDate": "2026-05-28T23:00:00+05:30"
      }
    },
    "createdAt": "2026-05-28T12:00:00.000Z",
    "updatedAt": "2026-05-28T12:00:00.000Z"
  }
}
```

### Response `400 Bad Request` (examples)

```json
{
  "error": "publicationEditionId is required"
}
```

```json
{
  "error": "Invalid publicationEditionId"
}
```

```json
{
  "error": "Invalid subEditionId for this edition"
}
```

```json
{
  "error": "issueStartDate is required (YYYY-MM-DD)"
}
```

```json
{
  "error": "issueStartNumber must be between 1 and 365"
}
```

```json
{
  "error": "newsCloseTime must be HH:MM"
}
```

```json
{
  "error": "headerLeftImage must be an image"
}
```

### Response `409 Conflict`

```json
{
  "error": "Design already exists for this edition/sub-edition. Use PUT or PATCH to update.",
  "existingId": "clsd_xyz789"
}
```

### Response `500`

```json
{
  "error": "Failed to create smart design",
  "details": "..."
}
```

---

## 7. PUT `/epaper/smart-design/{id}`

### Request body (partial or full)

```json
{
  "totalPages": 16,
  "paperSellCost": 7,
  "headerStyleNumber": 5,
  "subHeaderStyleNumber": 2,
  "headerStyleKey": "main_style5",
  "subHeaderStyleKey": "sub_header_style2",
  "publishedAreaText": "Hyderabad • Secunderabad • Karimnagar",
  "lastPageFooterText": "Updated press line. RNI TELENG/2024/12345",
  "tagline": "Truth First — Updated"
}
```

### Response `200 OK`

```json
{
  "success": true,
  "design": {
    "id": "clsd_main_tg",
    "tenantId": "cltenant_abc123",
    "publicationEditionId": "ed_telangana",
    "subEditionId": null,
    "subEditionScopeKey": "",
    "paperType": "TABLOID",
    "totalPages": 16,
    "perPageCostMonthly": 2500,
    "paperSellCost": 7,
    "headerStyleNumber": 5,
    "subHeaderStyleNumber": 2,
    "headerStyleKey": "main_style5",
    "subHeaderStyleKey": "sub_header_style2",
    "headerData": "తెలుగుప్రభ",
    "headerLogoUrl": "https://cdn.example.com/epaper/logo.png",
    "subHeaderLogoUrl": "https://cdn.example.com/epaper/sub-logo.png",
    "paperNameImageUrl": null,
    "headerLeftImageUrl": "https://cdn.example.com/epaper/ad-left.png",
    "headerRightImageUrl": "https://cdn.example.com/epaper/ad-right.png",
    "publishedAreaText": "Hyderabad • Secunderabad • Karimnagar",
    "tagline": "Truth First — Updated",
    "websiteUrl": "https://epaper.telugudaily.com",
    "runningCommentText": null,
    "runningCommentAuthor": "Editor",
    "rightArticleTitle": null,
    "rightArticlePoints": null,
    "lastPageFooterText": "Updated press line. RNI TELENG/2024/12345",
    "volumeStartNumber": 1,
    "volumeStartYear": 2024,
    "issueStartNumber": 1,
    "issueStartDate": "2024-01-01T00:00:00.000Z",
    "issueCounterMode": "SEQUENTIAL",
    "newsCloseTime": "23:00",
    "languageCode": "te",
    "isActive": true,
    "styleCapabilities": {
      "mainHeader": {
        "number": 5,
        "key": "main_style5",
        "slug": "split_name_ad_panel",
        "name": "Split — Name + Ad Panel",
        "type": "MAIN",
        "supportsCenterLogo": true,
        "supportsLeftImage": true,
        "supportsRightImage": true,
        "supportsPaperNameImage": true,
        "supportsSubHeaderCenterImage": false
      },
      "subHeader": {
        "number": 2,
        "key": "sub_header_style2",
        "slug": "full_color_bar",
        "name": "Full Color Bar",
        "type": "SUB",
        "supportsSubHeaderCenterImage": true
      },
      "allowedFields": {
        "headerLogoUrl": true,
        "headerLeftImageUrl": true,
        "headerRightImageUrl": true,
        "paperNameImageUrl": true,
        "subHeaderLogoUrl": true
      }
    },
    "publicationEdition": {
      "id": "ed_telangana",
      "name": "Telangana Edition",
      "slug": "telangana"
    },
    "subEdition": null,
    "today": {
      "issueDate": "2026-05-28",
      "dayNameTelugu": "బుధవారం",
      "currentVolume": 3,
      "currentIssue": 148,
      "maxIssuePerYear": 365,
      "newsWindow": {
        "fromDate": "2026-05-28T00:00:00+05:30",
        "toDate": "2026-05-28T23:00:00+05:30"
      }
    },
    "createdAt": "2026-05-20T10:00:00.000Z",
    "updatedAt": "2026-05-28T14:15:00.000Z"
  }
}
```

### Response `404 Not Found`

```json
{
  "error": "Smart design not found"
}
```

### Response `400 Bad Request`

```json
{
  "error": "issueStartNumber must be between 1 and 365"
}
```

---

## 8. PATCH `/epaper/smart-design/{id}`

Same handler as PUT — send **only changed fields**.

### Request body

```json
{
  "paperSellCost": 8,
  "tagline": "New tagline only"
}
```

### Response `200 OK`

```json
{
  "success": true,
  "design": {
    "id": "clsd_main_tg",
    "tenantId": "cltenant_abc123",
    "publicationEditionId": "ed_telangana",
    "subEditionId": null,
    "paperType": "TABLOID",
    "totalPages": 16,
    "perPageCostMonthly": 2500,
    "paperSellCost": 8,
    "headerStyleNumber": 5,
    "subHeaderStyleNumber": 2,
    "headerStyleKey": "main_style5",
    "subHeaderStyleKey": "sub_header_style2",
    "headerData": "తెలుగుప్రభ",
    "tagline": "New tagline only",
    "publishedAreaText": "Hyderabad • Secunderabad • Karimnagar",
    "lastPageFooterText": "Updated press line. RNI TELENG/2024/12345",
    "volumeStartYear": 2024,
    "issueCounterMode": "SEQUENTIAL",
    "isActive": true,
    "styleCapabilities": {
      "allowedFields": {
        "headerLogoUrl": true,
        "headerLeftImageUrl": true,
        "headerRightImageUrl": true,
        "paperNameImageUrl": true,
        "subHeaderLogoUrl": true
      }
    },
    "publicationEdition": {
      "id": "ed_telangana",
      "name": "Telangana Edition",
      "slug": "telangana"
    },
    "subEdition": null,
    "today": {
      "issueDate": "2026-05-28",
      "dayNameTelugu": "బుధవారం",
      "currentVolume": 3,
      "currentIssue": 148,
      "maxIssuePerYear": 365,
      "newsWindow": {
        "fromDate": "2026-05-28T00:00:00+05:30",
        "toDate": "2026-05-28T23:00:00+05:30"
      }
    },
    "createdAt": "2026-05-20T10:00:00.000Z",
    "updatedAt": "2026-05-28T15:00:00.000Z"
  }
}
```

### Response `404 Not Found`

```json
{
  "error": "Smart design not found"
}
```

---

## 9. DELETE `/epaper/smart-design/{id}`

### Request

```http
DELETE /api/v1/epaper/smart-design/clsd_main_tg
Authorization: Bearer <JWT>
X-Tenant-Id: cltenant_abc123
```

No body.

### Response `200 OK`

```json
{
  "success": true,
  "id": "clsd_main_tg",
  "message": "Smart design deleted"
}
```

### Response `404 Not Found`

```json
{
  "error": "Smart design not found"
}
```

### Response `500`

```json
{
  "error": "Failed to delete smart design",
  "details": "..."
}
```

---

## Edition APIs (setup) — sample responses

### GET `/epaper/publication-editions?includeSubEditions=true`

**Response `200 OK`**

```json
{
  "items": [
    {
      "id": "ed_telangana",
      "tenantId": "cltenant_abc123",
      "name": "Telangana Edition",
      "slug": "telangana",
      "stateId": "st_tg",
      "coverImageUrl": null,
      "seoTitle": null,
      "seoDescription": null,
      "seoKeywords": null,
      "isActive": true,
      "isDeleted": false,
      "createdAt": "2026-01-10T08:00:00.000Z",
      "updatedAt": "2026-01-10T08:00:00.000Z",
      "state": {
        "id": "st_tg",
        "name": "Telangana"
      },
      "subEditions": [
        {
          "id": "sub_hyd",
          "tenantId": "cltenant_abc123",
          "editionId": "ed_telangana",
          "name": "Hyderabad",
          "slug": "hyderabad",
          "districtId": "dist_hyd",
          "isActive": true,
          "isDeleted": false
        }
      ]
    }
  ]
}
```

### POST `/epaper/publication-editions`

**Request**

```json
{
  "name": "Andhra Edition",
  "slug": "andhra",
  "stateId": "st_ap",
  "isActive": true
}
```

**Response `201 Created`**

```json
{
  "id": "ed_andhra",
  "tenantId": "cltenant_abc123",
  "name": "Andhra Edition",
  "slug": "andhra",
  "stateId": "st_ap",
  "coverImageUrl": null,
  "seoTitle": null,
  "seoDescription": null,
  "seoKeywords": null,
  "isActive": true,
  "isDeleted": false,
  "createdAt": "2026-05-28T16:00:00.000Z",
  "updatedAt": "2026-05-28T16:00:00.000Z",
  "state": {
    "id": "st_ap",
    "name": "Andhra Pradesh"
  }
}
```

### POST `/epaper/publication-editions/{editionId}/sub-editions`

**Request**

```json
{
  "name": "Hyderabad Edition",
  "slug": "hyderabad",
  "districtId": "dist_hyd",
  "isActive": true
}
```

**Response `201 Created`**

```json
{
  "id": "sub_hyd",
  "tenantId": "cltenant_abc123",
  "editionId": "ed_telangana",
  "name": "Hyderabad",
  "slug": "hyderabad",
  "districtId": "dist_hyd",
  "coverImageUrl": null,
  "seoTitle": null,
  "seoDescription": null,
  "seoKeywords": null,
  "isActive": true,
  "isDeleted": false,
  "createdAt": "2026-05-28T16:05:00.000Z",
  "updatedAt": "2026-05-28T16:05:00.000Z",
  "district": {
    "id": "dist_hyd",
    "name": "Hyderabad",
    "stateId": "st_tg"
  }
}
```

---

## Quick matrix

| Method | Path | Success | Common errors |
|--------|------|---------|---------------|
| GET | `/epaper/smart-design/header-styles` | 200 catalog | 500 |
| GET | `/admin/epaper/header-styles` | 200 catalog | 403 |
| GET | `/epaper/smart-design/context` | 200 tenant+editions | 400, 403, 404 |
| GET | `/epaper/smart-design` | 200 `{ total, items[] }` | 400, 403, 500 |
| GET | `/epaper/smart-design/{id}` | 200 `{ design, prgiNumber, epaperDomain }` | 404 |
| POST | `/epaper/smart-design` | 201 `{ success, design, prgiNumber }` | 400, 409, 500 |
| PUT | `/epaper/smart-design/{id}` | 200 `{ success, design }` | 400, 404 |
| PATCH | `/epaper/smart-design/{id}` | 200 `{ success, design }` | 400, 404 |
| DELETE | `/epaper/smart-design/{id}` | 200 `{ success, id, message }` | 404, 500 |
