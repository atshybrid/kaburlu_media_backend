/**
 * ePaper Smart Design — OpenAPI / Swagger (canonical).
 * Use tag: "ePaper Smart Design"
 * Base path: /epaper/smart-design
 */

/**
 * @swagger
 * components:
 *   parameters:
 *     EpaperTenantIdHeader:
 *       in: header
 *       name: X-Tenant-Id
 *       required: true
 *       schema: { type: string, example: "cltenant_abc123" }
 *       description: Tenant scope (required for SUPER_ADMIN; tenant admins use mapped tenant)
 *     EpaperTenantSlugHeader:
 *       in: header
 *       name: X-Tenant-Slug
 *       schema: { type: string, example: "telugu-daily" }
 *     EpaperTenantDomainHeader:
 *       in: header
 *       name: X-Tenant-Domain
 *       schema: { type: string, example: "epaper.telugudaily.com" }
 *   schemas:
 *     EpaperHeaderStyleItem:
 *       type: object
 *       properties:
 *         number: { type: integer, example: 2 }
 *         type: { type: string, enum: [MAIN, SUB], example: MAIN }
 *         key: { type: string, example: "main_style2" }
 *         slug: { type: string, example: "prabha_3_col_meta_strip" }
 *         name: { type: string, example: "Prabha 3-Col + Meta Strip" }
 *         nameTe: { type: string, example: "ప్రభ 3-కాలమ్ + మెటా స్ట్రిప్" }
 *         supportsCenterLogo: { type: boolean, example: true }
 *         supportsLeftImage: { type: boolean, example: true }
 *         supportsRightImage: { type: boolean, example: true }
 *         supportsPaperNameImage: { type: boolean, example: true }
 *         supportsSubHeaderCenterImage: { type: boolean, example: false }
 *     EpaperHeaderStylesCatalogResponse:
 *       type: object
 *       properties:
 *         source: { type: string, enum: [database, catalog], example: database }
 *         mainHeaders:
 *           type: array
 *           items: { $ref: '#/components/schemas/EpaperHeaderStyleItem' }
 *         subHeaders:
 *           type: array
 *           items: { $ref: '#/components/schemas/EpaperHeaderStyleItem' }
 *     EpaperSmartDesignToday:
 *       type: object
 *       properties:
 *         issueDate: { type: string, format: date, example: "2026-05-28" }
 *         dayNameTelugu: { type: string, example: "బుధవారం" }
 *         currentVolume: { type: integer, example: 3 }
 *         currentIssue: { type: integer, example: 148 }
 *         maxIssuePerYear: { type: integer, example: 365 }
 *         newsWindow:
 *           type: object
 *           properties:
 *             fromDate: { type: string, example: "2026-05-28T00:00:00+05:30" }
 *             toDate: { type: string, example: "2026-05-28T23:00:00+05:30" }
 *     EpaperSmartDesignAllowedFields:
 *       type: object
 *       properties:
 *         headerLogoUrl: { type: boolean, example: true }
 *         headerLeftImageUrl: { type: boolean, example: true }
 *         headerRightImageUrl: { type: boolean, example: true }
 *         paperNameImageUrl: { type: boolean, example: true }
 *         subHeaderLogoUrl: { type: boolean, example: true }
 *     EpaperSmartDesignStyleCapabilities:
 *       type: object
 *       properties:
 *         mainHeader: { $ref: '#/components/schemas/EpaperHeaderStyleItem' }
 *         subHeader: { $ref: '#/components/schemas/EpaperHeaderStyleItem' }
 *         allowedFields: { $ref: '#/components/schemas/EpaperSmartDesignAllowedFields' }
 *     EpaperSmartDesignEditionRef:
 *       type: object
 *       properties:
 *         id: { type: string, example: "ed_telangana" }
 *         name: { type: string, example: "Telangana Edition" }
 *         slug: { type: string, example: "telangana" }
 *     EpaperSmartDesignSubEditionRef:
 *       type: object
 *       nullable: true
 *       properties:
 *         id: { type: string, example: "sub_hyd" }
 *         name: { type: string, example: "Hyderabad" }
 *         slug: { type: string, example: "hyderabad" }
 *     EpaperSmartDesign:
 *       type: object
 *       properties:
 *         id: { type: string, example: "clsd_xyz789" }
 *         tenantId: { type: string, example: "cltenant_abc123" }
 *         publicationEditionId: { type: string, example: "ed_telangana" }
 *         subEditionId: { type: string, nullable: true, example: null }
 *         subEditionScopeKey: { type: string, example: "" }
 *         paperType: { type: string, enum: [TABLOID, BROADSHEET, BERLINER, MAGAZINE], example: TABLOID }
 *         totalPages: { type: integer, example: 12 }
 *         perPageCostMonthly: { type: number, nullable: true, example: 2500 }
 *         paperSellCost: { type: number, nullable: true, example: 6 }
 *         headerStyleNumber: { type: integer, minimum: 1, maximum: 10, example: 2 }
 *         subHeaderStyleNumber: { type: integer, minimum: 1, maximum: 10, example: 1 }
 *         headerStyleKey: { type: string, example: "main_style2" }
 *         subHeaderStyleKey: { type: string, example: "sub_header_style1" }
 *         headerData: { type: string, nullable: true, example: "తెలుగుప్రభ" }
 *         headerLogoUrl: { type: string, nullable: true, example: "https://cdn.example.com/epaper/logo.png" }
 *         subHeaderLogoUrl: { type: string, nullable: true, example: "https://cdn.example.com/epaper/sub-logo.png" }
 *         paperNameImageUrl: { type: string, nullable: true }
 *         headerLeftImageUrl: { type: string, nullable: true, example: "https://cdn.example.com/epaper/ad-left.png" }
 *         headerRightImageUrl: { type: string, nullable: true, example: "https://cdn.example.com/epaper/ad-right.png" }
 *         publishedAreaText: { type: string, nullable: true, example: "Hyderabad • Warangal • Nizamabad" }
 *         tagline: { type: string, nullable: true, example: "Truth First" }
 *         websiteUrl: { type: string, nullable: true, example: "https://epaper.telugudaily.com" }
 *         runningCommentText: { type: string, nullable: true }
 *         runningCommentAuthor: { type: string, nullable: true, example: "Editor" }
 *         rightArticleTitle: { type: string, nullable: true }
 *         rightArticlePoints: { type: string, nullable: true }
 *         lastPageFooterText: { type: string, nullable: true, example: "Printed at Hyderabad. RNI TELENG/2024/12345" }
 *         volumeStartNumber: { type: integer, example: 1 }
 *         volumeStartYear: { type: integer, example: 2024 }
 *         issueStartNumber: { type: integer, example: 1 }
 *         issueStartDate: { type: string, format: date-time }
 *         issueCounterMode: { type: string, enum: [SEQUENTIAL, DAY_OF_YEAR], example: SEQUENTIAL }
 *         newsCloseTime: { type: string, example: "23:00" }
 *         languageCode: { type: string, example: "te" }
 *         isActive: { type: boolean, example: true }
 *         styleCapabilities: { $ref: '#/components/schemas/EpaperSmartDesignStyleCapabilities' }
 *         publicationEdition: { $ref: '#/components/schemas/EpaperSmartDesignEditionRef' }
 *         subEdition: { $ref: '#/components/schemas/EpaperSmartDesignSubEditionRef' }
 *         today: { $ref: '#/components/schemas/EpaperSmartDesignToday' }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     EpaperSmartDesignCreateInput:
 *       type: object
 *       required: [publicationEditionId, issueStartDate]
 *       properties:
 *         publicationEditionId: { type: string, example: "ed_telangana" }
 *         subEditionId: { type: string, nullable: true, description: "Omit for edition-level; set for district sub-edition", example: null }
 *         paperType: { type: string, enum: [TABLOID, BROADSHEET], example: TABLOID }
 *         totalPages: { type: integer, example: 12 }
 *         perPageCostMonthly: { type: number, description: "Monthly cost for designing all pages", example: 2500 }
 *         paperSellCost: { type: number, description: "Retail sell price per complete paper", example: 6 }
 *         headerStyleNumber: { type: integer, example: 2 }
 *         subHeaderStyleNumber: { type: integer, example: 1 }
 *         headerStyleKey: { type: string, example: "main_style2" }
 *         subHeaderStyleKey: { type: string, example: "sub_header_style1" }
 *         headerData: { type: string, example: "తెలుగుప్రభ" }
 *         headerLogoUrl: { type: string }
 *         subHeaderLogoUrl: { type: string }
 *         paperNameImageUrl: { type: string }
 *         headerLeftImageUrl: { type: string }
 *         headerRightImageUrl: { type: string }
 *         publishedAreaText: { type: string, example: "Hyderabad • Guntur" }
 *         tagline: { type: string }
 *         websiteUrl: { type: string }
 *         runningCommentText: { type: string }
 *         runningCommentAuthor: { type: string }
 *         rightArticleTitle: { type: string }
 *         rightArticlePoints: { type: string }
 *         lastPageFooterText: { type: string }
 *         volumeStartNumber: { type: integer, example: 1 }
 *         volumeStartYear: { type: integer, example: 2024 }
 *         issueStartNumber: { type: integer, minimum: 1, maximum: 365, example: 1 }
 *         issueStartDate: { type: string, format: date, example: "2024-01-01" }
 *         issueCounterMode: { type: string, enum: [SEQUENTIAL, DAY_OF_YEAR], example: SEQUENTIAL }
 *         newsCloseTime: { type: string, example: "23:00" }
 *         languageCode: { type: string, example: "te" }
 *     EpaperSmartDesignContextResponse:
 *       type: object
 *       properties:
 *         tenantId: { type: string }
 *         tenantName: { type: string, example: "Telugu Daily" }
 *         tenantSlug: { type: string, example: "telugu-daily" }
 *         prgiNumber: { type: string, example: "TELENG/2024/12345" }
 *         prgiStatus: { type: string, example: VERIFIED }
 *         epaperDomain: { type: string, nullable: true, example: "epaper.telugudaily.com" }
 *         epaperDomainId: { type: string, nullable: true }
 *         totalDesigns: { type: integer, example: 2 }
 *         editions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id: { type: string }
 *               name: { type: string }
 *               slug: { type: string }
 *               state: { type: object, nullable: true }
 *               subEditions: { type: array, items: { type: object } }
 *               hasDesign: { type: boolean }
 *               designIds: { type: array, items: { type: string } }
 *     EpaperSmartDesignListResponse:
 *       type: object
 *       properties:
 *         tenantId: { type: string }
 *         total: { type: integer, example: 2 }
 *         items:
 *           type: array
 *           items: { $ref: '#/components/schemas/EpaperSmartDesign' }
 *     EpaperSmartDesignGetResponse:
 *       type: object
 *       properties:
 *         design: { $ref: '#/components/schemas/EpaperSmartDesign' }
 *         prgiNumber: { type: string, example: "TELENG/2024/12345" }
 *         epaperDomain: { type: string, nullable: true, example: "epaper.telugudaily.com" }
 *     EpaperSmartDesignCreateResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         design: { $ref: '#/components/schemas/EpaperSmartDesign' }
 *         prgiNumber: { type: string }
 *         epaperDomain: { type: string, nullable: true }
 *     EpaperSmartDesignError:
 *       type: object
 *       properties:
 *         error: { type: string }
 *         details: { type: string }
 *         existingId: { type: string, description: "Present on 409 when design already exists" }
 */

/**
 * @swagger
 * /epaper/smart-design/header-styles:
 *   get:
 *     summary: Header & sub-header style catalog
 *     description: |
 *       Returns 10 main header styles and 10 sub-header styles with `number`, `key`, `slug`, `name`, `nameTe`,
 *       and capability flags (which image upload fields are allowed).
 *       Prefer `headerStyleKey` / `subHeaderStyleKey` when saving smart design.
 *     tags: [ePaper Smart Design]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Style catalog
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/EpaperHeaderStylesCatalogResponse' }
 *             example:
 *               source: database
 *               mainHeaders:
 *                 - number: 1
 *                   type: MAIN
 *                   key: main_style1
 *                   slug: classic_3_col_info_bar
 *                   name: Classic 3-Col + Info Bar
 *                   nameTe: క్లాసిక్ 3-కాలమ్ + ఇన్ఫో బార్
 *                   supportsCenterLogo: true
 *                   supportsLeftImage: true
 *                   supportsRightImage: true
 *                   supportsPaperNameImage: true
 *                   supportsSubHeaderCenterImage: false
 *                 - number: 2
 *                   type: MAIN
 *                   key: main_style2
 *                   slug: prabha_3_col_meta_strip
 *                   name: Prabha 3-Col + Meta Strip
 *                   supportsCenterLogo: true
 *                   supportsLeftImage: true
 *                   supportsRightImage: true
 *                   supportsPaperNameImage: true
 *               subHeaders:
 *                 - number: 1
 *                   type: SUB
 *                   key: sub_header_style1
 *                   slug: page_logo_date
 *                   name: Page · Logo · Date
 *                   supportsSubHeaderCenterImage: true
 *       403:
 *         description: Admin access required
 */

/**
 * @swagger
 * /admin/epaper/header-styles:
 *   get:
 *     summary: Header style catalog (SUPER_ADMIN)
 *     description: Same payload as GET /epaper/smart-design/header-styles. SUPER_ADMIN only.
 *     tags: [ePaper Smart Design, Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Style catalog
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/EpaperHeaderStylesCatalogResponse' }
 *       403:
 *         description: Superadmin only
 */

/**
 * @swagger
 * /epaper/smart-design/context:
 *   get:
 *     summary: Smart Design setup context (tenant + PRGI + editions)
 *     description: |
 *       Load this first on the Super Admin ePaper Design screen.
 *       Returns tenant PRGI number, active EPAPER domain, publication editions with sub-editions,
 *       and whether each edition already has a smart design row.
 *     tags: [ePaper Smart Design]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/EpaperTenantIdHeader'
 *     responses:
 *       200:
 *         description: Context for React setup wizard
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/EpaperSmartDesignContextResponse' }
 *             example:
 *               tenantId: cltenant_abc123
 *               tenantName: Telugu Daily
 *               tenantSlug: telugu-daily
 *               prgiNumber: TELENG/2024/12345
 *               prgiStatus: VERIFIED
 *               epaperDomain: epaper.telugudaily.com
 *               epaperDomainId: cldom_epaper1
 *               totalEditions: 2
 *               totalDesigns: 1
 *               editions:
 *                 - id: ed_telangana
 *                   name: Telangana Edition
 *                   slug: telangana
 *                   state: { id: st_tg, name: Telangana }
 *                   subEditions:
 *                     - id: sub_hyd
 *                       name: Hyderabad
 *                       slug: hyderabad
 *                   hasDesign: true
 *                   designIds: [clsd_xyz789]
 *                   linkedHeaderStyles:
 *                     - designId: clsd_xyz789
 *                       scope: EDITION
 *                       subEditionId: null
 *                       headerStyleNumber: 2
 *                       headerStyleKey: main_style2
 *                       subHeaderStyleNumber: 1
 *                       subHeaderStyleKey: sub_header_style1
 *                 - id: ed_andhra
 *                   name: Andhra Edition
 *                   slug: andhra
 *                   hasDesign: false
 *                   designIds: []
 *                   linkedHeaderStyles: []
 *               headerStyleSummary:
 *                 availableMainHeaders: 10
 *                 availableSubHeaders: 10
 *                 linkedMainHeaderNumbers: [2]
 *                 linkedSubHeaderNumbers: [1]
 *                 catalogEndpoint: /epaper/smart-design/header-styles
 *       400:
 *         description: Tenant context required
 *         content:
 *           application/json:
 *             example: { error: "Tenant context required (X-Tenant-Id)" }
 */

/**
 * @swagger
 * /epaper/smart-design/editions:
 *   get:
 *     summary: All editions for a tenant with their designs (one call)
 *     description: |
 *       **Get-all-by-tenant** loader. Pass the tenant via `X-Tenant-Id` (or use a SUPER_ADMIN token).
 *       Returns every publication edition, each sub-edition, and the attached smart design (or null)
 *       with the computed `today` volume/issue values. Use this to render the whole ePaper Design
 *       dashboard in a single request and to know where to show **Create** vs **Edit**.
 *     tags: [ePaper Smart Design]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/EpaperTenantIdHeader'
 *     responses:
 *       200:
 *         description: Editions + sub-editions with designs
 *         content:
 *           application/json:
 *             example:
 *               tenantId: cltenant_abc123
 *               tenantName: Telugu Daily
 *               tenantSlug: telugu-daily
 *               prgiNumber: TELENG/2024/12345
 *               prgiStatus: VERIFIED
 *               epaperDomain: epaper.telugudaily.com
 *               epaperDomainId: cldom_epaper1
 *               totalEditions: 2
 *               totalDesigns: 2
 *               editions:
 *                 - id: ed_telangana
 *                   name: Telangana Edition
 *                   slug: telangana
 *                   state: { id: st_tg, name: Telangana }
 *                   hasEditionDesign: true
 *                   designCount: 2
 *                   editionDesign:
 *                     id: clsd_xyz789
 *                     publicationEditionId: ed_telangana
 *                     subEditionId: null
 *                     totalPages: 12
 *                     headerStyleNumber: 2
 *                     today: { currentVolume: 3, currentIssue: 148, maxIssuePerYear: 365 }
 *                   subEditions:
 *                     - id: sub_hyd
 *                       name: Hyderabad
 *                       slug: hyderabad
 *                       hasDesign: true
 *                       design:
 *                         id: clsd_hyd001
 *                         subEditionId: sub_hyd
 *                         totalPages: 8
 *                 - id: ed_andhra
 *                   name: Andhra Edition
 *                   slug: andhra
 *                   hasEditionDesign: false
 *                   designCount: 0
 *                   editionDesign: null
 *                   subEditions: []
 *       400:
 *         description: Tenant context required
 *         content:
 *           application/json:
 *             example: { error: "Tenant context required (X-Tenant-Id)" }
 */

/**
 * @swagger
 * /epaper/smart-design/by-edition:
 *   get:
 *     summary: Resolve the single design for a tenant + edition (+ sub-edition) filter
 *     description: |
 *       Filter API. Returns the one design that matches `(tenant + publicationEditionId + subEditionId)`,
 *       or `null` if none exists yet. `nextAction` tells the UI whether to **CREATE** (POST, allowed once)
 *       or **UPDATE** (PUT/PATCH). Omit `subEditionId` for the edition-level daily paper.
 *     tags: [ePaper Smart Design]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/EpaperTenantIdHeader'
 *       - in: query
 *         name: publicationEditionId
 *         required: true
 *         schema: { type: string }
 *         description: Publication edition id
 *       - in: query
 *         name: subEditionId
 *         schema: { type: string }
 *         description: Optional sub-edition id (omit for edition-level)
 *     responses:
 *       200:
 *         description: Matched design or null
 *         content:
 *           application/json:
 *             examples:
 *               existing:
 *                 summary: Design already exists (show Edit)
 *                 value:
 *                   tenantId: cltenant_abc123
 *                   publicationEditionId: ed_telangana
 *                   subEditionId: null
 *                   scope: EDITION
 *                   exists: true
 *                   nextAction: UPDATE
 *                   design:
 *                     id: clsd_xyz789
 *                     totalPages: 12
 *                     today: { currentVolume: 3, currentIssue: 148 }
 *               empty:
 *                 summary: No design yet (show Create)
 *                 value:
 *                   tenantId: cltenant_abc123
 *                   publicationEditionId: ed_andhra
 *                   subEditionId: null
 *                   scope: EDITION
 *                   exists: false
 *                   nextAction: CREATE
 *                   design: null
 *       400:
 *         description: publicationEditionId missing
 *         content:
 *           application/json:
 *             example: { error: "publicationEditionId query param is required" }
 *       404:
 *         description: Edition not found for tenant
 *         content:
 *           application/json:
 *             example: { error: "Edition not found for this tenant" }
 */

/**
 * @swagger
 * /epaper/smart-design:
 *   get:
 *     summary: List edition-wise smart designs
 *     tags: [ePaper Smart Design]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/EpaperTenantIdHeader'
 *       - in: query
 *         name: publicationEditionId
 *         schema: { type: string }
 *         description: Filter by publication edition id
 *       - in: query
 *         name: subEditionId
 *         schema: { type: string }
 *         description: Filter by sub-edition id
 *       - in: query
 *         name: scope
 *         schema: { type: string, enum: [edition, sub] }
 *         description: "edition = only edition-level designs; sub = only sub-edition designs"
 *     responses:
 *       200:
 *         description: List of designs with computed today volume/issue
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/EpaperSmartDesignListResponse' }
 *             example:
 *               tenantId: cltenant_abc123
 *               total: 1
 *               items:
 *                 - id: clsd_xyz789
 *                   publicationEditionId: ed_telangana
 *                   subEditionId: null
 *                   paperType: TABLOID
 *                   totalPages: 12
 *                   paperSellCost: 6
 *                   headerStyleNumber: 2
 *                   subHeaderStyleNumber: 1
 *                   headerStyleKey: main_style2
 *                   subHeaderStyleKey: sub_header_style1
 *                   headerData: తెలుగుప్రభ
 *                   today:
 *                     issueDate: "2026-05-28"
 *                     dayNameTelugu: బుధవారం
 *                     currentVolume: 3
 *                     currentIssue: 148
 *                     maxIssuePerYear: 365
 *   post:
 *     summary: Create smart design (one per edition/sub-edition)
 *     description: |
 *       **One POST allowed** per `(tenantId + publicationEditionId + subEditionId)`.
 *       - Edition-level daily paper: omit `subEditionId`
 *       - District sub-edition: set `subEditionId`
 *
 *       Supports JSON URLs or multipart image uploads:
 *       `headerLeftImage`, `headerRightImage`, `headerLogo`, `subHeaderLogo`, `paperNameImage`
 *
 *       Volume increases each calendar year from `volumeStartYear`.
 *       Issue increments daily when `issueCounterMode` = SEQUENTIAL (max 365/year).
 *     tags: [ePaper Smart Design]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/EpaperTenantIdHeader'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/EpaperSmartDesignCreateInput' }
 *           example:
 *             publicationEditionId: ed_telangana
 *             subEditionId: null
 *             paperType: TABLOID
 *             totalPages: 12
 *             perPageCostMonthly: 2500
 *             paperSellCost: 6
 *             headerStyleNumber: 2
 *             subHeaderStyleNumber: 1
 *             headerStyleKey: main_style2
 *             subHeaderStyleKey: sub_header_style1
 *             headerData: తెలుగుప్రభ
 *             headerLogoUrl: https://cdn.example.com/logo.png
 *             headerLeftImageUrl: https://cdn.example.com/ad-left.png
 *             headerRightImageUrl: https://cdn.example.com/ad-right.png
 *             publishedAreaText: Hyderabad • Warangal
 *             lastPageFooterText: Printed at Hyderabad
 *             volumeStartNumber: 1
 *             volumeStartYear: 2024
 *             issueStartNumber: 1
 *             issueStartDate: "2024-01-01"
 *             issueCounterMode: SEQUENTIAL
 *             newsCloseTime: "23:00"
 *             languageCode: te
 *         multipart/form-data:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/EpaperSmartDesignCreateInput'
 *               - type: object
 *                 properties:
 *                   headerLeftImage: { type: string, format: binary }
 *                   headerRightImage: { type: string, format: binary }
 *                   headerLogo: { type: string, format: binary }
 *                   subHeaderLogo: { type: string, format: binary }
 *                   paperNameImage: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/EpaperSmartDesignCreateResponse' }
 *             example:
 *               success: true
 *               prgiNumber: TELENG/2024/12345
 *               epaperDomain: epaper.telugudaily.com
 *               design:
 *                 id: clsd_xyz789
 *                 publicationEditionId: ed_telangana
 *                 headerStyleKey: main_style2
 *                 today:
 *                   currentVolume: 3
 *                   currentIssue: 148
 *       409:
 *         description: Design already exists — use PUT/PATCH
 *         content:
 *           application/json:
 *             example:
 *               error: Design already exists for this edition/sub-edition. Use PUT or PATCH to update.
 *               existingId: clsd_xyz789
 *       400:
 *         content:
 *           application/json:
 *             example: { error: "issueStartDate is required (YYYY-MM-DD)" }
 */

/**
 * @swagger
 * /epaper/smart-design/{id}:
 *   get:
 *     summary: Get one smart design by id
 *     tags: [ePaper Smart Design]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/EpaperTenantIdHeader'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, example: "clsd_xyz789" }
 *     responses:
 *       200:
 *         description: Design + PRGI + domain
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/EpaperSmartDesignGetResponse' }
 *       404:
 *         content:
 *           application/json:
 *             example: { error: "Smart design not found" }
 *   put:
 *     summary: Replace/update smart design (full or partial fields)
 *     tags: [ePaper Smart Design]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/EpaperTenantIdHeader'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/EpaperSmartDesignCreateInput' }
 *           example:
 *             footerText: "Updated footer"
 *             paperSellCost: 7
 *             headerStyleNumber: 5
 *             subHeaderStyleNumber: 2
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               headerLeftImage: { type: string, format: binary }
 *               headerRightImage: { type: string, format: binary }
 *               headerLogo: { type: string, format: binary }
 *               subHeaderLogo: { type: string, format: binary }
 *               paperNameImage: { type: string, format: binary }
 *               paperSellCost: { type: number, example: 7 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               design:
 *                 id: clsd_xyz789
 *                 paperSellCost: 7
 *                 styleCapabilities:
 *                   allowedFields:
 *                     headerLogoUrl: true
 *                     headerLeftImageUrl: true
 *   patch:
 *     summary: Partial update smart design
 *     description: Same as PUT — only send fields to change.
 *     tags: [ePaper Smart Design]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/EpaperTenantIdHeader'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           example:
 *             publishedAreaText: "Hyderabad • Secunderabad"
 *             lastPageFooterText: "New footer text"
 *             totalPages: 16
 *     responses:
 *       200:
 *         description: Updated design
 *   delete:
 *     summary: Delete smart design (soft)
 *     tags: [ePaper Smart Design]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/EpaperTenantIdHeader'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               id: clsd_xyz789
 *               message: Smart design deleted
 *
 * Related edition APIs (tag **EPF ePaper - Admin** in Swagger):
 * - GET/POST `/epaper/publication-editions?includeSubEditions=true`
 * - GET/POST `/epaper/publication-editions/{editionId}/sub-editions`
 */

/**
 * @swagger
 * /epaper/smart-design/collect-news:
 *   get:
 *     summary: Collect today's news for an edition (page-capacity + fair distribution)
 *     description: |
 *       Collects **PUBLISHED** reporter articles for the issue day window
 *       `00:00 IST → newsCloseTime IST` (from the edition's smart design), sized to the
 *       edition's page capacity, and distributes them **fairly**:
 *
 *       1. **District-wise round-robin** — each district gets a turn.
 *       2. **Reporter-wise round-robin** within each district — equal share per reporter;
 *          a reporter with fewer articles is simply skipped and the slot goes to others.
 *
 *       **Capacity** = `contentPages × perPage`, where `contentPages = totalPages - 1`
 *       (the main/front page is excluded by default). With 8 pages and `perPage=12`
 *       that is `7 × 12 = 84` articles.
 *
 *       **Cross-tenant fallback**: if the tenant has fewer published articles than the
 *       capacity, the remaining slots are filled from **other tenants'** published articles
 *       of the same day and re-attributed to this tenant's reporters (round-robin). Those
 *       items are flagged `source: "BORROWED"` with `borrowedFrom` + `assignedReporter`.
 *       Disable with `allowCrossTenant=false`.
 *     tags: [ePaper Smart Design]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/EpaperTenantIdHeader'
 *       - in: query
 *         name: publicationEditionId
 *         required: true
 *         schema: { type: string }
 *         description: Edition whose smart design defines pages + newsCloseTime
 *       - in: query
 *         name: subEditionId
 *         schema: { type: string }
 *         description: Optional sub-edition (district-scoped collection)
 *       - in: query
 *         name: issueDate
 *         schema: { type: string, example: "2026-05-31" }
 *         description: Issue day (YYYY-MM-DD, IST). Defaults to today.
 *       - in: query
 *         name: perPage
 *         schema: { type: integer, default: 12, minimum: 1, maximum: 50 }
 *         description: Articles per content page (≈10–12 for 300-word news)
 *       - in: query
 *         name: excludeMainPage
 *         schema: { type: boolean, default: true }
 *         description: Exclude the front/main page from the page count
 *       - in: query
 *         name: allowCrossTenant
 *         schema: { type: boolean, default: true }
 *         description: Borrow other tenants' articles to fill remaining capacity
 *     responses:
 *       200:
 *         description: Collected + fairly distributed news
 *         content:
 *           application/json:
 *             example:
 *               tenantId: cltenant_abc123
 *               publicationEditionId: ed_telangana
 *               subEditionId: null
 *               issueDate: "2026-05-31"
 *               newsCloseTime: "23:00"
 *               languageCode: te
 *               districtScopeId: null
 *               window:
 *                 fromUtc: "2026-05-30T18:30:00.000Z"
 *                 toUtc: "2026-05-31T17:30:00.000Z"
 *                 fromIST: "2026-05-31T00:00:00+05:30"
 *                 toIST: "2026-05-31T23:00:00+05:30"
 *               capacity:
 *                 totalPages: 8
 *                 excludeMainPage: true
 *                 contentPages: 7
 *                 perPage: 12
 *                 maxArticles: 84
 *               stats:
 *                 tenantArticlesAvailable: 64
 *                 collectedFromTenant: 64
 *                 borrowedFromOtherTenants: 20
 *                 totalCollected: 84
 *                 shortBy: 0
 *                 distinctReporters: 9
 *                 distinctDistricts: 5
 *               reporterDistribution:
 *                 - authorId: usr_rep1
 *                   name: రమేష్ కుమార్
 *                   districtId: dist_hyd
 *                   count: 8
 *               articles:
 *                 - id: na_001
 *                   title: "స్థానిక వార్త"
 *                   heading: "..."
 *                   wordCount: 295
 *                   districtId: dist_hyd
 *                   districtName: Hyderabad
 *                   author: { id: usr_rep1, name: రమేష్ కుమార్, mobile: "98xxxxxx01" }
 *                   source: TENANT
 *                 - id: na_900
 *                   title: "రాష్ట్ర వార్త"
 *                   source: BORROWED
 *                   borrowedFrom: { tenantId: other_tenant, tenantName: "Andhra Times" }
 *                   assignedReporter: { reporterId: rep_x, userId: usr_y, name: సురేష్ }
 *               pageBuckets:
 *                 - pageNumber: 2
 *                   articles: []
 *       400:
 *         description: publicationEditionId missing / no tenant context
 *         content:
 *           application/json:
 *             example: { error: "publicationEditionId query param is required" }
 *       404:
 *         description: No smart design for this edition
 *         content:
 *           application/json:
 *             example: { error: "No smart design found for this edition/sub-edition. Create the design first." }
 */
