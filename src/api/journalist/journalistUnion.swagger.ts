/**
 * Journalist Union — canonical Swagger (OpenAPI) definitions.
 * Legacy @swagger blocks in route files are hidden via tag filter in src/lib/swagger.ts
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     UnionDocumentStatus:
 *       type: object
 *       properties:
 *         url: { type: string, nullable: true, example: "https://cdn.example.com/journalist/kyc/clx/photo.webp" }
 *         status: { type: string, enum: [NOT_UPLOADED, PENDING, APPROVED, REJECTED], example: PENDING }
 *         approvedAt: { type: string, format: date-time, nullable: true }
 *         uploaded: { type: boolean, example: true }
 *     UnionMemberDocuments:
 *       type: object
 *       properties:
 *         photo: { $ref: '#/components/schemas/UnionDocumentStatus' }
 *         aadhaar: { $ref: '#/components/schemas/UnionDocumentStatus' }
 *         pan: { $ref: '#/components/schemas/UnionDocumentStatus' }
 *         workingIdCard: { $ref: '#/components/schemas/UnionDocumentStatus' }
 *     UnionMemberApprovalItem:
 *       type: object
 *       properties:
 *         id: { type: string, example: "clprof_abc123" }
 *         memberType: { type: string, enum: [TENANT_REPORTER, NON_TENANT_REPORTER] }
 *         membershipStatus: { type: string, enum: [PENDING, APPROVED] }
 *         fullName: { type: string, example: "Ramesh Kumar" }
 *         fatherName: { type: string, example: "Venkata Reddy" }
 *         mobileNumber: { type: string, example: "9876543210" }
 *         publisherMobileNumber: { type: string, example: "9123456780" }
 *         documents: { $ref: '#/components/schemas/UnionMemberDocuments' }
 *         pendingActions:
 *           type: array
 *           items: { type: string }
 *           example: ["MEMBERSHIP", "photo", "aadhaar", "pan", "workingIdCard"]
 *     UnionMemberLoginBlock:
 *       type: object
 *       properties:
 *         profileId: { type: string }
 *         memberType: { type: string }
 *         membershipStatus: { type: string, enum: [PENDING, APPROVED] }
 *         documents: { $ref: '#/components/schemas/UnionMemberDocuments' }
 *         canDownloadIdCard: { type: boolean }
 *         unionPressCard:
 *           type: object
 *           nullable: true
 *           properties:
 *             cardNumber: { type: string }
 *             pdfUrl: { type: string, nullable: true }
 *             status: { type: string }
 */

/**
 * @swagger
 * /journalist/admin/members/pending:
 *   get:
 *     summary: List pending members (membership + document approvals)
 *     description: Super Admin approval queue. Each item includes profile photo, Aadhaar, PAN, working ID card URLs and union press card PDF.
 *     tags: [Journalist Union — Super Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all_pending, pending_membership, pending_documents]
 *           default: all_pending
 *       - in: query
 *         name: unionName
 *         schema: { type: string, example: "Democratic Journalist Federation (Working)" }
 *       - in: query
 *         name: memberType
 *         schema: { type: string, enum: [TENANT_REPORTER, NON_TENANT_REPORTER] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated pending list
 *         content:
 *           application/json:
 *             example:
 *               statusFilter: all_pending
 *               total: 2
 *               page: 1
 *               limit: 20
 *               items:
 *                 - id: clprof_abc
 *                   memberType: NON_TENANT_REPORTER
 *                   membershipStatus: PENDING
 *                   fullName: Ramesh Kumar
 *                   mobileNumber: "9876543210"
 *                   documents:
 *                     photo: { url: "https://cdn.../photo.webp", status: PENDING, uploaded: true }
 *                     aadhaar: { url: "https://cdn.../aadhaar.webp", status: PENDING, uploaded: true }
 *                     pan: { url: "https://cdn.../pan.webp", status: PENDING, uploaded: true }
 *                     workingIdCard: { url: "https://cdn.../work-id.webp", status: PENDING, uploaded: true }
 *                   pendingActions: [MEMBERSHIP, photo, aadhaar, pan, workingIdCard]
 */

/**
 * @swagger
 * /journalist/admin/members/{profileId}:
 *   get:
 *     summary: Single member detail for approval screen
 *     tags: [Journalist Union — Super Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UnionMemberApprovalItem' }
 */

/**
 * @swagger
 * /journalist/admin/members/{profileId}/documents:
 *   patch:
 *     summary: Approve or reject uploaded documents (photo, Aadhaar, PAN, working ID)
 *     tags: [Journalist Union — Super Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             photo: approve
 *             aadhaar: approve
 *             pan: approve
 *             workingIdCard: approve
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               message: Documents updated
 *               canDownloadIdCard: false
 *               documents:
 *                 photo: { status: APPROVED, url: "https://cdn.../photo.webp" }
 */

/**
 * @swagger
 * /journalist/admin/members/{profileId}/approve-membership:
 *   patch:
 *     summary: Approve or reject membership and optionally generate union press ID
 *     tags: [Journalist Union — Super Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           example:
 *             approved: true
 *             pressId: DJWF-2026-0101
 *             generateIdCard: true
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               message: Membership approved
 *               membershipStatus: APPROVED
 *               canDownloadIdCard: true
 */

/**
 * @swagger
 * /journalist/admin/members/create:
 *   post:
 *     summary: Create union member (admin)
 *     description: |
 *       **Endpoint:** `POST /api/v1/journalist/admin/members/create`
 *       **Content-Type:** `multipart/form-data`
 *       **Auth:** Bearer JWT — `SUPER_ADMIN` or `TENANT_ADMIN`
 *
 *       ---
 *       ## Who can call
 *       | Role | TENANT_REPORTER | NON_TENANT_REPORTER |
 *       |------|-----------------|---------------------|
 *       | SUPER_ADMIN | Yes | Yes |
 *       | TENANT_ADMIN | Yes (own tenant reporters only) | No (403) |
 *
 *       ---
 *       ## Case A — TENANT_REPORTER (newspaper reporter already in platform)
 *       Reporter must already exist with role `REPORTER` under a tenant. Admin only passes mobile + union;
 *       name, photo, district, designation, tenant link are **auto-filled** from reporter profile.
 *
 *       **Required fields:** `memberType=TENANT_REPORTER`, `mobileNumber`, `unionName`
 *
 *       **Optional:** `autoApproveMembership` (default true), `autoApproveDocuments` (default false),
 *       `photo`, `aadhaar`, `pan`, `workingIdCard` (override/add KYC files)
 *
 *       **On success (201):** `code=TENANT_REPORTER_CREATED`, union profile linked to tenant reporter.
 *       If `autoApproveMembership=true` and photo exists → press ID card PDF may be generated + WhatsApp sent.
 *
 *       ---
 *       ## Case B — NON_TENANT_REPORTER (Super Admin only)
 *       Independent journalist not tied to a tenant newspaper. Creates user with role `NON_TENANT_REPORTER`
 *       and MPIN login (default = last 4 digits of mobile).
 *
 *       **Required fields:** `memberType=NON_TENANT_REPORTER`, `mobileNumber`, `unionName`, `fullName`,
 *       `currentNewspaper`, `workingArea`, `designation` (or `currentJournalistRole`), `publisherMobileNumber`
 *
 *       **Optional:** `fatherName`, `state`, `mandal`, `totalExperienceYears`, `aadhaarNumber` (last 4 stored),
 *       `mpin` (4 digits), `autoApproveMembership`, `autoApproveDocuments`, `skipRequiredUploads` (default true)
 *
 *       **Documents:** If `skipRequiredUploads=false`, must upload `photo`, `aadhaar`, `pan`, `workingIdCard`.
 *
 *       **On success (201):** `code=NON_TENANT_REPORTER_CREATED`, `login` block with `unionMember` for app.
 *
 *       ---
 *       ## Error codes (all responses include `success: false` except 201)
 *       | HTTP | code | When |
 *       |------|------|------|
 *       | 400 | MISSING_REQUIRED_FIELDS | `mobileNumber` or `unionName` missing |
 *       | 400 | INVALID_MEMBER_TYPE | `memberType` not TENANT_REPORTER / NON_TENANT_REPORTER |
 *       | 400 | TENANT_REPORTER_NOT_FOUND | TENANT_REPORTER but mobile has no reporter profile |
 *       | 400 | MISSING_NON_TENANT_FIELDS | NON_TENANT missing fullName, newspaper, area, designation |
 *       | 400 | MISSING_PUBLISHER_MOBILE | NON_TENANT missing publisherMobileNumber |
 *       | 400 | MISSING_DOCUMENT_UPLOADS | NON_TENANT, skipRequiredUploads=false, files missing |
 *       | 400 | INVALID_MPIN | NON_TENANT mpin is not 4 digits |
 *       | 401 | — | Missing or invalid JWT |
 *       | 403 | TENANT_ADMIN_SCOPE_DENIED | Tenant Admin tried NON_TENANT_REPORTER |
 *       | 403 | TENANT_MISMATCH | Tenant Admin + reporter from another tenant |
 *       | 403 | — | Not SUPER_ADMIN / TENANT_ADMIN |
 *       | 409 | UNION_MEMBER_ALREADY_EXISTS | Mobile already has journalistProfile |
 *       | 500 | NO_LANGUAGE_CONFIGURED | No default language in DB |
 *       | 500 | CREATE_FAILED | Unexpected server error |
 *     tags:
 *       - Journalist Union — Super Admin
 *       - Journalist Union — Tenant Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [memberType, mobileNumber, unionName]
 *             properties:
 *               memberType:
 *                 type: string
 *                 enum: [TENANT_REPORTER, NON_TENANT_REPORTER]
 *               mobileNumber:
 *                 type: string
 *                 example: "9876543210"
 *               unionName:
 *                 type: string
 *                 example: "Democratic Journalist Federation (Working)"
 *               mpin:
 *                 type: string
 *                 description: NON_TENANT only; 4 digits (default last 4 of mobile)
 *                 example: "3210"
 *               fullName:
 *                 type: string
 *                 description: NON_TENANT required
 *               fatherName:
 *                 type: string
 *               currentNewspaper:
 *                 type: string
 *                 description: NON_TENANT required (alias currentWorkingPaper)
 *               workingArea:
 *                 type: string
 *                 description: NON_TENANT required
 *               designation:
 *                 type: string
 *                 description: NON_TENANT required (alias currentJournalistRole)
 *               publisherMobileNumber:
 *                 type: string
 *                 description: NON_TENANT required
 *               totalExperienceYears:
 *                 type: integer
 *               state:
 *                 type: string
 *               mandal:
 *                 type: string
 *               aadhaarNumber:
 *                 type: string
 *                 description: Only last 4 digits stored
 *               autoApproveMembership:
 *                 type: boolean
 *                 default: true
 *               autoApproveDocuments:
 *                 type: boolean
 *                 default: false
 *               skipRequiredUploads:
 *                 type: boolean
 *                 default: true
 *                 description: NON_TENANT — if false, all four document files required
 *               photo:
 *                 type: string
 *                 format: binary
 *               aadhaar:
 *                 type: string
 *                 format: binary
 *               pan:
 *                 type: string
 *                 format: binary
 *               workingIdCard:
 *                 type: string
 *                 format: binary
 *           examples:
 *             tenantReporterMinimal:
 *               summary: Case A — Tenant Admin / Super Admin (minimal)
 *               value:
 *                 memberType: TENANT_REPORTER
 *                 mobileNumber: "9876543210"
 *                 unionName: Democratic Journalist Federation (Working)
 *                 autoApproveMembership: true
 *             nonTenantFull:
 *               summary: Case B — Super Admin (full form)
 *               value:
 *                 memberType: NON_TENANT_REPORTER
 *                 mobileNumber: "9988776655"
 *                 unionName: Democratic Journalist Federation (Working)
 *                 fullName: Ramesh Kumar
 *                 fatherName: Venkata Reddy
 *                 currentNewspaper: Local Daily News
 *                 workingArea: Secunderabad
 *                 designation: Senior Reporter
 *                 publisherMobileNumber: "9123456780"
 *                 autoApproveMembership: false
 *                 skipRequiredUploads: true
 *     responses:
 *       201:
 *         description: Member created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 code:
 *                   type: string
 *                   enum: [TENANT_REPORTER_CREATED, NON_TENANT_REPORTER_CREATED]
 *                 message: { type: string }
 *                 memberType: { type: string }
 *                 member: { type: object }
 *                 documents: { $ref: '#/components/schemas/UnionMemberDocuments' }
 *                 login:
 *                   type: object
 *                   properties:
 *                     mobileNumber: { type: string }
 *                     role: { type: string }
 *                     unionMember: { $ref: '#/components/schemas/UnionMemberLoginBlock' }
 *                 idCard:
 *                   type: object
 *                   description: TENANT_REPORTER only — card generation result
 *                 mpinHint:
 *                   type: string
 *                   description: NON_TENANT_REPORTER only
 *             examples:
 *               tenantReporterCreated:
 *                 summary: 201 — TENANT_REPORTER_CREATED
 *                 value:
 *                   success: true
 *                   code: TENANT_REPORTER_CREATED
 *                   message: Tenant reporter union member created
 *                   memberType: TENANT_REPORTER
 *                   documents:
 *                     photo: { url: "https://cdn.../photo.webp", status: APPROVED, uploaded: true }
 *                     aadhaar: { status: NOT_UPLOADED, uploaded: false }
 *                   login:
 *                     mobileNumber: "9876543210"
 *                     role: REPORTER
 *                     unionMember:
 *                       membershipStatus: APPROVED
 *                       canDownloadIdCard: true
 *               nonTenantCreated:
 *                 summary: 201 — NON_TENANT_REPORTER_CREATED
 *                 value:
 *                   success: true
 *                   code: NON_TENANT_REPORTER_CREATED
 *                   message: Non-tenant reporter union member created
 *                   memberType: NON_TENANT_REPORTER
 *                   role: NON_TENANT_REPORTER
 *                   mpinHint: Login with mobileNumber and mpin (default last 4 digits of mobile)
 *                   login:
 *                     mobileNumber: "9988776655"
 *                     role: NON_TENANT_REPORTER
 *                     unionMember:
 *                       membershipStatus: PENDING
 *                       canDownloadIdCard: false
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             examples:
 *               missingFields:
 *                 value:
 *                   success: false
 *                   code: MISSING_REQUIRED_FIELDS
 *                   error: mobileNumber and unionName are required
 *               invalidMemberType:
 *                 value:
 *                   success: false
 *                   code: INVALID_MEMBER_TYPE
 *                   error: memberType must be TENANT_REPORTER or NON_TENANT_REPORTER
 *               tenantReporterNotFound:
 *                 value:
 *                   success: false
 *                   code: TENANT_REPORTER_NOT_FOUND
 *                   error: No tenant reporter found for this mobile number
 *                   hint: User must exist as REPORTER under your newspaper before union create
 *               missingNonTenantFields:
 *                 value:
 *                   success: false
 *                   code: MISSING_NON_TENANT_FIELDS
 *                   error: fullName, currentNewspaper, workingArea, and designation (currentJournalistRole) are required
 *               missingDocuments:
 *                 value:
 *                   success: false
 *                   code: MISSING_DOCUMENT_UPLOADS
 *                   error: photo, aadhaar, pan, and workingIdCard uploads are required unless skipRequiredUploads=true
 *                   missing: [photo, pan]
 *               invalidMpin:
 *                 value:
 *                   success: false
 *                   code: INVALID_MPIN
 *                   error: mpin must be 4 digits
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             examples:
 *               tenantAdminNonTenant:
 *                 value:
 *                   success: false
 *                   code: TENANT_ADMIN_SCOPE_DENIED
 *                   error: Tenant Admin can only create TENANT_REPORTER members for their newspaper
 *               tenantMismatch:
 *                 value:
 *                   success: false
 *                   code: TENANT_MISMATCH
 *                   error: Reporter belongs to a different tenant
 *       409:
 *         description: Already a union member
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               code: UNION_MEMBER_ALREADY_EXISTS
 *               error: Mobile already registered as union member
 *               profileId: clprof_existing123
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             examples:
 *               noLanguage:
 *                 value:
 *                   success: false
 *                   code: NO_LANGUAGE_CONFIGURED
 *                   error: No language configured
 *               createFailed:
 *                 value:
 *                   success: false
 *                   code: CREATE_FAILED
 *                   error: Create failed
 */

/**
 * @swagger
 * /journalist/members/join:
 *   post:
 *     summary: Join union (tenant reporter self-service)
 *     description: Requires `REPORTER` JWT. Auto-fills from reporter profile; generates ID card if photo exists.
 *     tags: [Journalist Union — Tenant Reporter]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           example:
 *             unionName: Democratic Journalist Federation (Working)
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             example:
 *               message: Joined journalist union
 *               memberType: TENANT_REPORTER
 *               canDownloadIdCard: true
 *               idCardDownloadAvailable: true
 */

/**
 * @swagger
 * /journalist/public/join-union:
 *   post:
 *     summary: Public registration (non-tenant reporter, pending approval)
 *     description: All documents required at signup. Login with mobile + last 4 digits as MPIN. ID card after Super Admin approval.
 *     tags: [Journalist Union — Non-Tenant Reporter]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [mobileNumber, unionName, fullName, fatherName, currentNewspaper, workingArea, designation, publisherMobileNumber, photo, aadhaar, pan, workingIdCard]
 *             properties:
 *               mobileNumber: { type: string, example: "9988776655" }
 *               unionName: { type: string }
 *               fullName: { type: string }
 *               fatherName: { type: string }
 *               currentNewspaper: { type: string }
 *               workingArea: { type: string }
 *               designation: { type: string }
 *               publisherMobileNumber: { type: string }
 *               photo: { type: string, format: binary }
 *               aadhaar: { type: string, format: binary }
 *               pan: { type: string, format: binary }
 *               workingIdCard: { type: string, format: binary }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             example:
 *               membershipStatus: PENDING
 *               memberType: NON_TENANT_REPORTER
 *               canDownloadIdCard: false
 *               login:
 *                 mobileNumber: "9988776655"
 *                 mpin: Use last 4 digits of mobile number
 *                 role: NON_TENANT_REPORTER
 */

/**
 * @swagger
 * /journalist/members/me/status:
 *   get:
 *     summary: My union membership + document approval status
 *     tags:
 *       - Journalist Union — Tenant Reporter
 *       - Journalist Union — Non-Tenant Reporter
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UnionMemberLoginBlock' }
 *             example:
 *               membershipStatus: PENDING
 *               canDownloadIdCard: false
 *               documents:
 *                 photo: { url: "https://cdn.../photo.webp", status: PENDING }
 *                 aadhaar: { url: "https://cdn.../aadhaar.webp", status: PENDING }
 *                 pan: { url: null, status: NOT_UPLOADED }
 *                 workingIdCard: { url: "https://cdn.../work.webp", status: PENDING }
 */

/**
 * @swagger
 * /journalist/members/id-card/download:
 *   get:
 *     summary: Download union press ID PDF (when membership + documents approved)
 *     tags:
 *       - Journalist Union — Tenant Reporter
 *       - Journalist Union — Non-Tenant Reporter
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PDF file or redirect to CDN URL
 *       403:
 *         content:
 *           application/json:
 *             example:
 *               error: ID card download not available
 *               reason: MEMBERSHIP_PENDING
 *               membershipStatus: PENDING
 */

/**
 * @swagger
 * /journalist/members/upload-document:
 *   post:
 *     summary: Upload KYC document (sets status PENDING until Super Admin approves)
 *     tags: [Journalist Union — Non-Tenant Reporter]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, document]
 *             properties:
 *               file: { type: string, format: binary }
 *               document:
 *                 type: string
 *                 enum: [photo, aadhaar, pan, workingIdCard]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               message: Uploaded — pending admin approval
 *               documents:
 *                 pan: { status: PENDING, url: "https://cdn.../pan.webp" }
 */

/**
 * @swagger
 * /journalist/my-card/pdf:
 *   get:
 *     summary: Download my union press card PDF (same rules as /members/id-card/download)
 *     tags:
 *       - Journalist Union — Tenant Reporter
 *       - Journalist Union — Non-Tenant Reporter
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: application/pdf
 *       403:
 *         description: Membership or documents not approved
 */

/**
 * @swagger
 * /journalist/public/reporter-lookup:
 *   get:
 *     summary: Look up tenant reporter by mobile (form pre-fill)
 *     tags: [Journalist Union — Public]
 *     parameters:
 *       - in: query
 *         name: mobile
 *         required: true
 *         schema: { type: string, example: "9876543210" }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               found: true
 *               fullName: Ramesh Kumar
 *               designation: Staff Reporter
 *               currentNewspaper: Eenadu
 *               tenantId: tenant_001
 */

/**
 * @swagger
 * /journalist/reporter-link:
 *   get:
 *     summary: Check tenant reporter vs union member linkage
 *     tags: [Journalist Union — Tenant Reporter]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             example:
 *               hasJournalistProfile: true
 *               hasReporterProfile: true
 *               linked: true
 *               reporter: { tenant: { name: Eenadu } }
 */

/**
 * @swagger
 * /journalist/admin/assign-union-admin:
 *   post:
 *     summary: Assign union admin user (also grants Tenant Admin access to union admin APIs)
 *     tags: [Journalist Union — Super Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           example:
 *             userId: usr_tenant_admin_001
 *             unionName: Democratic Journalist Federation (Working)
 *             state: Telangana
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             example:
 *               message: Union admin assigned successfully
 */
