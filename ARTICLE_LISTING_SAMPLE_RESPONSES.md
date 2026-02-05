# Article Listing APIs - Sample Responses

## 1. Super Admin / Desk Editor API

**Request:**
```bash
GET /api/v1/articles/list/superadmin?tenantId=cmk7e7tg401ezlp22wkz5rxky&priority=1&date=2026-02-06&page=1&limit=10
Authorization: Bearer {token}
```

**Response (200 OK):**
```json
{
  "articles": [
    {
      "id": "cm1article123xyz",
      "title": "హైదరాబాద్‌లో రోడ్డు ప్రమాదం - ముగ్గురు గాయపడ్డారు",
      "content": "హైదరాబాద్ సెకండరాబాద్ మండలంలో ఈ రోజు ఉదయం రోడ్డు ప్రమాదం జరిగింది. రెండు కార్లు ఢీకొట్టడంతో ముగ్గురు వ్యక్తులు గాయపడ్డారు. పోలీసులు వెంటనే సంఘటన స్థలానికి చేరుకుని గాయపడిన వారిని ఆసుపత్రికి తరలించారు. మరిన్ని వివరాలు తెలుస్తున్నాయి...",
      "createdAt": "2026-02-06T06:30:00.000Z",
      "updatedAt": "2026-02-06T06:30:00.000Z",
      "status": "PUBLISHED",
      "type": "reporter",
      "priority": 1,
      "viewCount": 45,
      "isBreakingNews": true,
      "isTrending": false,
      "tags": ["road-accident", "hyderabad", "breaking"],
      "images": [
        "https://kaburlu-news.b-cdn.net/articles/accident-photo-1.webp"
      ],
      "characterCount": 243,
      "author": {
        "id": "user123",
        "mobileNumber": "9876543210",
        "email": "reporter1@kaburlumedia.com",
        "reporterProfile": {
          "id": "reporter123",
          "level": "MANDAL",
          "state": {
            "id": "state_telangana",
            "name": "Telangana"
          },
          "district": {
            "id": "dist_hyderabad",
            "name": "Hyderabad"
          },
          "mandal": {
            "id": "mandal_secunderabad",
            "name": "Secunderabad"
          },
          "designation": {
            "name": "Mandal Reporter",
            "nativeName": "మండల రిపోర్టర్"
          }
        }
      },
      "tenant": {
        "id": "cmk7e7tg401ezlp22wkz5rxky",
        "name": "Kaburlu News",
        "slug": "kaburlu-news"
      },
      "language": {
        "id": "lang_telugu",
        "name": "Telugu",
        "code": "te"
      }
    },
    {
      "id": "cm1article456abc",
      "title": "రాష్ట్ర ప్రభుత్వం కొత్త పథకం ప్రకటన",
      "content": "తెలంగాణ రాష్ట్ర ప్రభుత్వం ఈ రోజు రైతులకు కొత్త సబ్సిడీ పథకాన్ని ప్రకటించింది. ఈ పథకం కింద రైతులకు ఎకరాకు రూ.10,000 ఆర్థిక సహాయం అందజేస్తారు. ముఖ్యమంత్రి ఈ సందర్భంగా మాట్లాడుతూ...",
      "createdAt": "2026-02-06T05:15:00.000Z",
      "updatedAt": "2026-02-06T05:15:00.000Z",
      "status": "PUBLISHED",
      "type": "reporter",
      "priority": 1,
      "viewCount": 128,
      "isBreakingNews": true,
      "isTrending": true,
      "tags": ["government", "farmers", "subsidy"],
      "images": [
        "https://kaburlu-news.b-cdn.net/articles/cm-announcement.webp"
      ],
      "characterCount": 187,
      "author": {
        "id": "user456",
        "mobileNumber": "9876543211",
        "email": "statereporter@kaburlumedia.com",
        "reporterProfile": {
          "id": "reporter456",
          "level": "STATE",
          "state": {
            "id": "state_telangana",
            "name": "Telangana"
          },
          "district": null,
          "mandal": null,
          "designation": {
            "name": "State Bureau Chief",
            "nativeName": "రాష్ట్ర బ్యూరో చీఫ్"
          }
        }
      },
      "tenant": {
        "id": "cmk7e7tg401ezlp22wkz5rxky",
        "name": "Kaburlu News",
        "slug": "kaburlu-news"
      },
      "language": {
        "id": "lang_telugu",
        "name": "Telugu",
        "code": "te"
      }
    }
  ],
  "total": 23,
  "page": 1,
  "limit": 10,
  "totalPages": 3,
  "filters": {
    "tenantId": "cmk7e7tg401ezlp22wkz5rxky",
    "stateId": null,
    "districtId": null,
    "mandalId": null,
    "reporterId": null,
    "priority": 1,
    "date": "2026-02-06",
    "minChars": null,
    "maxChars": null
  }
}
```

---

## 2. Tenant Admin API

**Request:**
```bash
GET /api/v1/articles/list/tenant?districtId=dist_hyderabad&priority=2&date=2026-02-06
Authorization: Bearer {tenant_admin_token}
```

**Response (200 OK):**
```json
{
  "articles": [
    {
      "id": "cm1article789def",
      "title": "హైదరాబాద్ జిల్లాలో కొత్త పార్క్ ప్రారంభం",
      "content": "హైదరాబాద్ జిల్లా కుకట్పల్లి మండలంలో నేడు కొత్త పార్క్ ప్రారంభించారు. ఈ పార్క్‌లో ఆధునిక సౌకర్యాలు, పిల్లల ఆట స్థలం, వాకింగ్ ట్రాక్ వంటివి ఉన్నాయి. స్థానిక ప్రజలు దీన్ని స్వాగతించారు. కార్పొరేటర్ మాట్లాడుతూ...",
      "createdAt": "2026-02-06T08:20:00.000Z",
      "updatedAt": "2026-02-06T08:20:00.000Z",
      "status": "PUBLISHED",
      "type": "reporter",
      "priority": 2,
      "viewCount": 34,
      "isBreakingNews": false,
      "isTrending": false,
      "tags": ["park", "kukatpally", "development"],
      "images": [
        "https://kaburlu-news.b-cdn.net/articles/new-park.webp"
      ],
      "characterCount": 215,
      "author": {
        "id": "user789",
        "mobileNumber": "9876543212",
        "email": "kukatpallyreporter@kaburlumedia.com",
        "reporterProfile": {
          "id": "reporter789",
          "level": "MANDAL",
          "state": {
            "id": "state_telangana",
            "name": "Telangana"
          },
          "district": {
            "id": "dist_hyderabad",
            "name": "Hyderabad"
          },
          "mandal": {
            "id": "mandal_kukatpally",
            "name": "Kukatpally"
          },
          "designation": {
            "name": "Mandal Reporter",
            "nativeName": "మండల రిపోర్టర్"
          }
        }
      },
      "language": {
        "id": "lang_telugu",
        "name": "Telugu",
        "code": "te"
      }
    },
    {
      "id": "cm1article012ghi",
      "title": "మదాపూర్ లో ట్రాఫిక్ సిగ్నల్ మార్పులు",
      "content": "హైదరాబాద్ మదాపూర్ మండలంలో ట్రాఫిక్ నియంత్రణ కోసం నూతన సిగ్నల్స్ ఏర్పాటు చేశారు. రవాణా శాఖ అధికారులు ఈ సిగ్నల్స్ ద్వారా ట్రాఫిక్ సమస్యలు తగ్గుతాయని తెలిపారు. స్థానిక ప్రజలు ఈ చర్యను అభినందించారు...",
      "createdAt": "2026-02-06T07:45:00.000Z",
      "updatedAt": "2026-02-06T07:45:00.000Z",
      "status": "PUBLISHED",
      "type": "reporter",
      "priority": 2,
      "viewCount": 21,
      "isBreakingNews": false,
      "isTrending": false,
      "tags": ["traffic", "madhapur", "signals"],
      "images": [],
      "characterCount": 198,
      "author": {
        "id": "user101",
        "mobileNumber": "9876543213",
        "email": "madhapurreporter@kaburlumedia.com",
        "reporterProfile": {
          "id": "reporter101",
          "level": "MANDAL",
          "state": {
            "id": "state_telangana",
            "name": "Telangana"
          },
          "district": {
            "id": "dist_hyderabad",
            "name": "Hyderabad"
          },
          "mandal": {
            "id": "mandal_madhapur",
            "name": "Madhapur"
          },
          "designation": {
            "name": "Mandal Reporter",
            "nativeName": "మండల రిపోర్టర్"
          }
        }
      },
      "language": {
        "id": "lang_telugu",
        "name": "Telugu",
        "code": "te"
      }
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 50,
  "totalPages": 1,
  "filters": {
    "tenantId": "cmk7e7tg401ezlp22wkz5rxky",
    "stateId": null,
    "districtId": "dist_hyderabad",
    "mandalId": null,
    "reporterId": null,
    "priority": 2,
    "date": "2026-02-06",
    "minChars": null,
    "maxChars": null
  }
}
```

---

## 3. Reporter API

**Request:**
```bash
GET /api/v1/articles/list/reporter?date=2026-02-06&priority=3
Authorization: Bearer {reporter_token}
```

**Response (200 OK):**
```json
{
  "articles": [
    {
      "id": "cm1article345jkl",
      "title": "స్థానిక ఆలయంలో వార్షికోత్సవం",
      "content": "సెకండరాబాద్ మండలంలోని శ్రీ రామ మందిరంలో ఈ వారం వార్షికోత్సవం జరుగుతోంది. భక్తులు పెద్ద సంఖ్యలో దర్శనానికి వస్తున్నారు. ఆలయ నిర్వాహకులు ప్రత్యేక ఏర్పాట్లు చేశారు. ఉదయం 6 గంటల నుండి రాత్రి 9 గంటల వరకు దర్శనం అందుబాటులో ఉంటుంది...",
      "createdAt": "2026-02-06T09:30:00.000Z",
      "updatedAt": "2026-02-06T09:30:00.000Z",
      "status": "DRAFT",
      "type": "reporter",
      "priority": 3,
      "viewCount": 0,
      "isBreakingNews": false,
      "isTrending": false,
      "tags": ["temple", "festival", "local"],
      "images": [
        "https://kaburlu-news.b-cdn.net/articles/temple-fest.webp"
      ],
      "characterCount": 223,
      "tenant": {
        "id": "cmk7e7tg401ezlp22wkz5rxky",
        "name": "Kaburlu News",
        "slug": "kaburlu-news"
      },
      "language": {
        "id": "lang_telugu",
        "name": "Telugu",
        "code": "te"
      }
    },
    {
      "id": "cm1article678mno",
      "title": "పాఠశాలలో క్రీడా కార్యక్రమం",
      "content": "స్థానిక ప్రభుత్వ పాఠశాలలో ఈ రోజు వార్షిక క్రీడా కార్యక్రమం నిర్వహించారు. విద్యార్థులు వివిధ క్రీడలలో పాల్గొన్నారు. హెడ్ మాస్టర్ విజేతలకు బహుమతులు ప్రదానం చేశారు. తల్లిదండ్రులు కూడా పెద్ద సంఖ్యలో హాజరయ్యారు...",
      "createdAt": "2026-02-06T08:00:00.000Z",
      "updatedAt": "2026-02-06T08:00:00.000Z",
      "status": "DRAFT",
      "type": "reporter",
      "priority": 3,
      "viewCount": 0,
      "isBreakingNews": false,
      "isTrending": false,
      "tags": ["school", "sports", "education"],
      "images": [],
      "characterCount": 201,
      "tenant": {
        "id": "cmk7e7tg401ezlp22wkz5rxky",
        "name": "Kaburlu News",
        "slug": "kaburlu-news"
      },
      "language": {
        "id": "lang_telugu",
        "name": "Telugu",
        "code": "te"
      }
    },
    {
      "id": "cm1article910pqr",
      "title": "వాణిజ్య ప్రాంతంలో శానిటేషన్ సమస్యలు",
      "content": "సెకండరాబాద్ వాణిజ్య ప్రాంతంలో శానిటేషన్ సమస్యలు తలెత్తుతున్నాయి. వ్యాపారులు మున్సిపల్ అధికారులను కలిసి పరిష్కారం కోరారు. అధికారులు త్వరలో చర్యలు తీసుకుంటామని హామీ ఇచ్చారు. వ్యాపారులు త్వరిత చర్య కోరుతున్నారు...",
      "createdAt": "2026-02-06T07:15:00.000Z",
      "updatedAt": "2026-02-06T07:15:00.000Z",
      "status": "PUBLISHED",
      "type": "reporter",
      "priority": 3,
      "viewCount": 12,
      "isBreakingNews": false,
      "isTrending": false,
      "tags": ["sanitation", "business", "complaint"],
      "images": [],
      "characterCount": 189,
      "tenant": {
        "id": "cmk7e7tg401ezlp22wkz5rxky",
        "name": "Kaburlu News",
        "slug": "kaburlu-news"
      },
      "language": {
        "id": "lang_telugu",
        "name": "Telugu",
        "code": "te"
      }
    }
  ],
  "total": 8,
  "page": 1,
  "limit": 50,
  "totalPages": 1,
  "filters": {
    "priority": 3,
    "date": "2026-02-06",
    "minChars": null,
    "maxChars": null
  }
}
```

---

## Response Fields Explanation

### Common Fields (All Articles)
- **id**: Unique article identifier
- **title**: Article headline
- **content**: Full article text
- **createdAt**: When article was created (ISO 8601 format)
- **updatedAt**: Last update timestamp
- **status**: DRAFT, PUBLISHED, REJECTED, etc.
- **type**: Article type (reporter, editor, ai-generated, etc.)
- **priority**: 1=high, 2=medium, 3=low
- **viewCount**: Number of views
- **isBreakingNews**: Breaking news flag
- **isTrending**: Trending article flag
- **tags**: Array of tag strings
- **images**: Array of image URLs
- **characterCount**: Total characters in content

### Author Details (Super Admin & Tenant Admin only)
- **author.id**: User ID
- **author.mobileNumber**: Reporter's mobile
- **author.email**: Reporter's email
- **author.reporterProfile**: Reporter profile details
  - **level**: STATE, DISTRICT, MANDAL, CONSTITUENCY
  - **state/district/mandal**: Location hierarchy
  - **designation**: Role name (English & native language)

### Tenant Details
- **tenant.id**: Tenant identifier
- **tenant.name**: Tenant display name
- **tenant.slug**: URL-friendly slug

### Language Details
- **language.id**: Language identifier
- **language.name**: Language name
- **language.code**: ISO language code (te, en, hi, etc.)

### Pagination Meta
- **total**: Total matching articles
- **page**: Current page number
- **limit**: Items per page
- **totalPages**: Total number of pages
- **filters**: Applied filters (for reference)

---

## Notes

1. **Reporter API** doesn't include author details (since it's the reporter's own articles)
2. **Tenant Admin** response is scoped to their tenant (tenantId is auto-applied)
3. **Super Admin** can see all tenants and apply tenant filter
4. **characterCount** is always included for quota tracking
5. Empty arrays (`[]`) are shown when no images/tags exist
6. `null` values shown for optional/missing fields (district, mandal, etc.)
