# Category Management Best Practices

## Problem Overview
Categories are showing for ALL tenants when they should be scoped/filtered properly:
- State-specific categories (e.g., `state-news-telangana`, `state-news-andhra-pradesh`) appearing for all tenants
- Generic "State News" category with all state subcategories showing everywhere
- Lots of categories being generated without proper tenant/domain scoping

## Current Architecture

### Schema Structure
```
Category (global)
├── id, name, slug, iconUrl, parentId
├── translations[] (CategoryTranslation)
└── domainCategories[] (DomainCategory) - Junction table

DomainCategory (junction)
├── domainId → Domain → Tenant
├── categoryId → Category
└── UNIQUE(domainId, categoryId)

Domain
├── belongs to Tenant
└── has many DomainCategory
```

### Key Principle
**Categories are GLOBAL but access is controlled via DomainCategory mappings**

## Best Practices

### 1. **Category Allocation Strategy**

#### Core/Default Categories (for all tenants)
```javascript
const CORE_CATEGORIES = [
  'politics', 'sports', 'entertainment', 'business', 
  'technology', 'health', 'education', 'crime', 'international'
];
```
- These should be allocated to ALL domains during creation
- See: `src/lib/bootstrap.ts` for core category seeding

#### State-Specific Categories (tenant-scoped)
```javascript
// ONLY allocate the state category that matches the tenant's state
// Example: If tenant.stateId = "Telangana"
const stateSpecificCategory = 'state-news-telangana';

// DO NOT allocate other state categories like:
// ❌ 'state-news-andhra-pradesh' (if tenant is not in AP)
// ❌ 'state-news-karnataka' (if tenant is not in KA)
```

**Implementation:**
```typescript
// When creating a domain
const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
  include: { state: true }
});

const tenantStateName = tenant.state?.name;
const stateSlug = `state-news-${slugify(tenantStateName)}`;

// Only allocate THIS state's category
const stateCategory = await prisma.category.findUnique({
  where: { slug: stateSlug }
});

if (stateCategory) {
  await prisma.domainCategory.create({
    data: {
      domainId: domain.id,
      categoryId: stateCategory.id
    }
  });
}
```

### 2. **Public API Filtering (Critical)**

When serving categories to the public/frontend, **ALWAYS** filter by DomainCategory:

```typescript
// ✅ CORRECT - Only show domain-allocated categories
router.get('/public/categories', async (req, res) => {
  const domain = res.locals.domain;
  
  const domainCategories = await prisma.domainCategory.findMany({
    where: { domainId: domain.id },
    include: { category: true }
  });
  
  // Only return categories that are allocated to this domain
  const categories = domainCategories
    .map(dc => dc.category)
    .filter(c => !c.isDeleted);
    
  res.json(categories);
});
```

```typescript
// ❌ WRONG - Shows all global categories
router.get('/public/categories', async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { isDeleted: false }
  });
  res.json(categories);
});
```

### 3. **Article Filtering by Category**

```typescript
// ✅ CORRECT - Validate category belongs to domain
router.get('/public/articles', async (req, res) => {
  const { categorySlug } = req.query;
  const domain = res.locals.domain;
  const tenant = res.locals.tenant;
  
  // Get domain-allowed categories
  const domainCategories = await prisma.domainCategory.findMany({
    where: { domainId: domain.id },
    include: { category: true }
  });
  
  const allowedCategoryIds = new Set(
    domainCategories.map(dc => dc.categoryId)
  );
  
  const category = domainCategories
    .find(dc => dc.category.slug === categorySlug)
    ?.category;
    
  if (!category) {
    return res.status(404).json({ error: 'Category not found for this domain' });
  }
  
  const articles = await prisma.tenantWebArticle.findMany({
    where: {
      tenantId: tenant.id,
      categoryId: category.id,
      status: 'PUBLISHED'
    }
  });
  
  res.json(articles);
});
```

### 4. **State News Parent-Child Strategy**

#### Option A: Flat Structure (Recommended for simplicity)
```
state-news (generic parent - allocated to all)
state-news-telangana (allocated ONLY to Telangana tenants)
state-news-andhra-pradesh (allocated ONLY to AP tenants)
state-news-karnataka (allocated ONLY to Karnataka tenants)
```

**Frontend Display:**
```typescript
// Show "State News" category
// When clicked, only show articles from the tenant's specific state category
```

#### Option B: Hierarchical (Current but needs cleanup)
```
state-news (parent)
├── state-news-telangana (child)
├── state-news-andhra-pradesh (child)
└── state-news-karnataka (child)
```

**Problem:** If you include children in category listing, ALL state subcategories show for ALL tenants

**Solution:**
```typescript
// Public API - DO NOT include children for state-news category
router.get('/public/categories', async (req, res) => {
  const domainCategories = await prisma.domainCategory.findMany({
    where: { domainId: domain.id },
    include: {
      category: {
        include: {
          children: false // ❌ Don't auto-include children
        }
      }
    }
  });
  
  // Filter categories: only return if explicitly allocated
  const categories = domainCategories
    .map(dc => dc.category)
    .filter(c => !c.isDeleted);
    
  res.json(categories);
});
```

### 5. **Cleanup Script for Existing Issues**

Run this to remove incorrectly allocated state categories:

```bash
# Check current allocations
node -r dotenv/config scripts/inspect_domain_categories.js <domainId>

# Cleanup - removes all state categories except tenant's own
node -r dotenv/config scripts/cleanup_domain_state_categories.ts <domainId>
```

**What the cleanup script does:**
```typescript
// Removes: state-news-* categories that don't match tenant's state
// Keeps: state-news (parent) + state-news-<tenant-state>
// Adds: core default categories if missing
```

### 6. **Database Queries - Common Patterns**

#### Get categories for a domain
```typescript
const domainCategories = await prisma.domainCategory.findMany({
  where: { domainId: domain.id },
  include: {
    category: {
      select: {
        id: true,
        slug: true,
        name: true,
        iconUrl: true,
        parentId: true
      }
    }
  }
});
```

#### Check if category is allowed for domain
```typescript
const isAllowed = await prisma.domainCategory.findFirst({
  where: {
    domainId: domain.id,
    category: { slug: categorySlug }
  }
});

if (!isAllowed) {
  return res.status(403).json({ error: 'Category not available for this domain' });
}
```

#### Bulk allocate categories to domain
```typescript
const categoryIds = ['cat_1', 'cat_2', 'cat_3'];

await prisma.domainCategory.createMany({
  data: categoryIds.map(categoryId => ({
    domainId: domain.id,
    categoryId
  })),
  skipDuplicates: true
});
```

### 7. **Admin Panel Category Assignment**

When admins assign categories to a tenant:

```typescript
// PUT /tenants/:tenantId/categories
router.put('/:tenantId/categories', async (req, res) => {
  const { tenantId } = req.params;
  const { categorySlugs } = req.body;
  
  // Get all domains for this tenant
  const domains = await prisma.domain.findMany({
    where: { tenantId }
  });
  
  // Validate categories exist
  const categories = await prisma.category.findMany({
    where: {
      slug: { in: categorySlugs },
      isDeleted: false
    }
  });
  
  // Apply to ALL tenant domains
  const operations = [];
  for (const domain of domains) {
    // Remove old allocations
    operations.push(
      prisma.domainCategory.deleteMany({
        where: { domainId: domain.id }
      })
    );
    
    // Add new allocations
    for (const category of categories) {
      operations.push(
        prisma.domainCategory.create({
          data: {
            domainId: domain.id,
            categoryId: category.id
          }
        })
      );
    }
  }
  
  await prisma.$transaction(operations);
  res.json({ success: true });
});
```

### 8. **Migration Strategy**

If you have existing bad data:

```sql
-- 1. Find domains with wrong state categories
SELECT 
  d.id as domain_id,
  d.host,
  t.name as tenant_name,
  s.name as tenant_state,
  c.slug as allocated_category
FROM "DomainCategory" dc
JOIN "Domain" d ON dc."domainId" = d.id
JOIN "Tenant" t ON d."tenantId" = t.id
LEFT JOIN "State" s ON t."stateId" = s.id
JOIN "Category" c ON dc."categoryId" = c.id
WHERE c.slug LIKE 'state-news-%'
  AND c.slug != 'state-news'
ORDER BY d.id;

-- 2. Remove incorrect state category allocations
-- This should be done via the cleanup script, not raw SQL
-- to ensure proper logging and validation
```

## Implementation Checklist

- [ ] **Domain Creation**: Only allocate core categories + tenant's own state category
- [ ] **Public Category API**: Filter by DomainCategory table
- [ ] **Public Article API**: Validate category is in domain's allowed list
- [ ] **Category Listing**: Don't auto-expand children unless explicitly allocated
- [ ] **Admin Assignment**: Apply changes to all tenant domains
- [ ] **State Categories**: One per tenant (matching tenant.state)
- [ ] **Bootstrap/Seed**: Core categories seeded globally, state categories created but NOT auto-allocated
- [ ] **Cleanup**: Run cleanup script for existing domains with wrong allocations

## API Endpoints Reference

### Public (no auth)
- `GET /public/categories` - Domain-filtered categories
- `GET /public/articles?categorySlug=X` - Domain+category filtered articles

### Admin (auth required)
- `GET /categories/tenant?tenantId=X` - Tenant's allocated categories
- `PUT /tenants/:tenantId/categories` - Bulk assign categories to tenant
- `GET /tenants/:tenantId/categories` - List tenant's allocated categories

## Troubleshooting

### Issue: All state categories showing for all tenants
**Cause:** Categories are being queried globally instead of through DomainCategory filter

**Fix:**
```typescript
// Change from:
const categories = await prisma.category.findMany();

// To:
const domainCategories = await prisma.domainCategory.findMany({
  where: { domainId: domain.id },
  include: { category: true }
});
const categories = domainCategories.map(dc => dc.category);
```

### Issue: Category shows in dropdown but articles fail to load
**Cause:** Category is in global table but not allocated to domain

**Fix:** Run cleanup script or manually allocate:
```typescript
await prisma.domainCategory.create({
  data: {
    domainId: domain.id,
    categoryId: category.id
  }
});
```

### Issue: New category not showing on website
**Cause:** Category exists globally but not allocated to domain

**Fix:** Use admin API to assign category to tenant (applies to all domains)

## Summary

**Key Principle**: Categories are GLOBAL entities, but access is controlled through the DomainCategory junction table. Always filter by domain when serving public APIs.

**State Categories**: Each tenant should ONLY have access to:
- Core/default categories (common to all)
- Their own state category (e.g., `state-news-telangana` for Telangana tenant)
- Generic `state-news` parent (optional)

**Never**: Query `Category` table directly in public APIs without filtering through `DomainCategory` first.
