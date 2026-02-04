# ID Card Workplace Display Logic

## Overview
The ID card generation now displays workplace/location information based on the reporter's **level** and **designation**, ensuring the most relevant location context is shown on the physical ID card.

## Display Rules by Level

### 1. STATE Level
**Who:** Publisher, Chief Editor, Editor, Tenant Admin, State Bureau Chief

**Display Format:**
```
<State Name>
```

**Examples:**
- Publisher → `Andhra Pradesh`
- Chief Editor → `Telangana`

### 2. DISTRICT Level
**Who:** Staff Reporter

**Display Format:**
```
<District Name>, <State Name>
```

**Examples:**
- Staff Reporter → `Guntur, Andhra Pradesh`
- Staff Reporter → `Karimnagar, Telangana`

### 3. DIVISION Level
**Who:** RC Incharge

**Display Format:**
```
<District/Mandal Name> Division, <State Name>
```

**Logic:**
- If `districtId` provided → Shows district name
- If `mandalId` provided → Shows mandal name
- Appends "Division" label for clarity

**Examples:**
- RC Incharge (districtId) → `Guntur Division, Andhra Pradesh`
- RC Incharge (mandalId) → `Tenali Division, Andhra Pradesh`

### 4. CONSTITUENCY Level
**Who:** Constituency Reporter

**Display Format:**
```
<Location Name> Constituency, <State Name>
```

**Logic:**
- Priority: assemblyConstituency → district → mandal
- Appends "Constituency" label for clarity

**Examples:**
- Constituency Reporter → `Tenali Constituency, Andhra Pradesh`
- Constituency Reporter → `Guntur Constituency, Andhra Pradesh`

### 5. ASSEMBLY Level
**Who:** Assembly-specific reporters

**Display Format:**
```
<Assembly Name>, <District Name>, <State Name>
```

**Logic:**
- Shows assembly constituency name (auto-resolved from mandal/district if needed)
- Includes parent district for context
- Complete hierarchical location

**Examples:**
- Assembly Reporter → `Tenali, Guntur, Andhra Pradesh`
- Assembly Reporter → `Kukatpally, Medchal-Malkajgiri, Telangana`

### 6. MANDAL Level
**Who:** Mandal-specific reporters

**Display Format:**
```
<Mandal Name>, <District Name>, <State Name>
```

**Examples:**
- Mandal Reporter → `Tenali, Guntur, Andhra Pradesh`
- Mandal Reporter → `Ponnur, Guntur, Andhra Pradesh`

## ID Card Layout

### Front Side
```
┌─────────────────────────────┐
│       [TENANT LOGO]         │
│     Publication Name        │
│                             │
│      [PHOTO]                │
│                             │
│      Reporter Name          │
│   Designation (Telugu)      │
│      Card Number            │
│                             │
│    Workplace Location       │ ← Smart display based on level
│                             │
└─────────────────────────────┘
```

### Back Side
```
┌─────────────────────────────┐
│        PRESS CARD           │
│                             │
│ Name: Full Name             │
│ Mobile: 9502XXXXXX          │
│ ID: PRASHNA-00001           │
│ Valid Till: 04/02/2027      │
│                             │
│ [Custom Content]            │
│                             │
│ Issued on: 04/02/2026       │
└─────────────────────────────┘
```

## Implementation Details

### Database Query
```typescript
const reporter = await prisma.reporter.findUnique({
  where: { id: reporterId },
  include: {
    designation: true,
    state: true,
    district: true,
    mandal: true,
    assemblyConstituency: true, // NEW
  }
});
```

### Location Building Logic
```typescript
const locationParts: string[] = [];

if (level === 'STATE') {
  if (reporter.state?.name) locationParts.push(reporter.state.name);
}
else if (level === 'DISTRICT') {
  if (reporter.district?.name) locationParts.push(reporter.district.name);
  if (reporter.state?.name) locationParts.push(reporter.state.name);
}
else if (level === 'DIVISION') {
  if (reporter.district?.name) {
    locationParts.push(`${reporter.district.name} Division`);
  } else if (reporter.mandal?.name) {
    locationParts.push(`${reporter.mandal.name} Division`);
  }
  if (reporter.state?.name) locationParts.push(reporter.state.name);
}
else if (level === 'CONSTITUENCY') {
  if (reporter.assemblyConstituency?.name) {
    locationParts.push(`${reporter.assemblyConstituency.name} Constituency`);
  } else if (reporter.district?.name) {
    locationParts.push(`${reporter.district.name} Constituency`);
  } else if (reporter.mandal?.name) {
    locationParts.push(`${reporter.mandal.name} Constituency`);
  }
  if (reporter.state?.name) locationParts.push(reporter.state.name);
}
else if (level === 'ASSEMBLY') {
  if (reporter.assemblyConstituency?.name) locationParts.push(reporter.assemblyConstituency.name);
  if (reporter.district?.name) locationParts.push(reporter.district.name);
  if (reporter.state?.name) locationParts.push(reporter.state.name);
}
else if (level === 'MANDAL') {
  if (reporter.mandal?.name) locationParts.push(reporter.mandal.name);
  if (reporter.district?.name) locationParts.push(reporter.district.name);
  if (reporter.state?.name) locationParts.push(reporter.state.name);
}

const workplaceLocation = locationParts.join(', ');
```

## Visual Examples

### Example 1: Publisher (STATE)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        PRASHNA AYUDHAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

         [Photo]

      రాజేష్ కుమార్
       ప్రచురణకర్త
      PRASHNA-00001

      Andhra Pradesh
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Example 2: RC Incharge (DIVISION)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        PRASHNA AYUDHAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

         [Photo]

      సుధాకర్ రెడ్డి
      ఆర్సీ ఇన్‌చార్జ్
      PRASHNA-00005

    Guntur Division,
     Andhra Pradesh
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Example 3: Constituency Reporter (CONSTITUENCY)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        PRASHNA AYUDHAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

         [Photo]

       వెంకట రావు
    నియోజకవర్గ రిపోర్టర్
      PRASHNA-00010

  Tenali Constituency,
     Andhra Pradesh
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Example 4: Assembly Reporter (ASSEMBLY)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        PRASHNA AYUDHAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

         [Photo]

      నాగభూషణ్ ఈగా
      స్టాఫ్ రిపోర్టర్
      PRASHNA-00015

  Tenali, Guntur,
    Andhra Pradesh
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Example 5: Mandal Reporter (MANDAL)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        PRASHNA AYUDHAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

         [Photo]

      రామ మోహన్ రావు
      స్టాఫ్ రిపోర్టర్
      PRASHNA-00020

  Ponnur, Guntur,
    Andhra Pradesh
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Designation Display

The ID card now shows:
1. **English Name** (e.g., "Publisher") - if no Telugu name
2. **Telugu/Native Name** (e.g., "ప్రచురణకర్త") - preferred when available

From `ReporterDesignation` table:
- `name` (English)
- `nativeName` (Telugu) ← Displayed on ID card

## Benefits

1. **Context-Appropriate:** Each level shows relevant location hierarchy
2. **Professional:** Clear identification of reporter's jurisdiction
3. **Hierarchical:** Maintains parent-child relationships in display
4. **Multilingual:** Uses native names for designations
5. **Flexible:** Handles multiple location ID inputs gracefully

## Technical Notes

### Auto-Resolution Impact
When ASSEMBLY level reporters are created with `mandalId` or `districtId`:
- System auto-resolves to correct `assemblyConstituencyId`
- ID card displays resolved assembly constituency name
- Example: mandalId → Tenali Assembly Constituency

### Missing Location Data
- Falls back gracefully to available data
- Empty strings filtered out
- Maintains hierarchical order

### PDF Generation
- Uses Puppeteer for high-quality PDF rendering
- Inline base64 assets for self-contained PDF
- Credit card sized (54mm × 85.6mm)
- Two-sided printing support

## Testing

To test ID card generation:
```bash
# Create reporter at different levels
curl -X POST http://localhost:3001/api/v1/tenants/{tenantId}/reporters \
  -H "Authorization: Bearer {token}" \
  -d '{
    "designationId": "publisher-global",
    "level": "STATE",
    "stateId": "...",
    "fullName": "Test Publisher",
    "mobileNumber": "9502000000"
  }'

# Check ID card PDF
# Access: reporter.idCard.pdfUrl
```

## Related Files

- `src/lib/idCardPdf.ts` - ID card generation logic
- `src/api/reporters/tenantReporters.routes.ts` - Reporter creation with auto ID card
- `prisma/schema.prisma` - Reporter model with all location fields
- `REPORTER_HIERARCHY_COMPLETE.md` - Complete designation reference

## Updated: 2026-02-04
