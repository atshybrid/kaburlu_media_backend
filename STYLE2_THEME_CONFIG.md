# Style2 Theme Configuration - Setup Flow

This document shows the complete flow for assigning and configuring Style2 theme settings for a tenant.

## ⭐ Default Extra Sections

All homepage styles now automatically include these extra sections if they are not already configured:

- **Trending News** (20 items) - Most viewed articles across all categories
- **Must Read** (10 items) - Essential articles based on view count  
- **Most Read** (15 items) - Popular articles with compact display

These sections will be automatically added to your homepage regardless of your configuration, ensuring rich content even for minimal setups.

## 🔧 Step-by-Step Setup Flow

### Step 1: Set Domain to Use Style2
First, configure the domain to use Style2 theme in domain settings:

```bash
# Update domain settings to use Style2
PUT /api/v1/domains/{domainId}/settings
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "data": {
    "themeStyle": "style2"
  }
}
```

### Step 2: Apply Default Style2 Configuration
Set up the basic Style2 theme configuration:

```bash
# Apply default Style2 configuration
POST /api/v1/tenant-theme/{tenantId}/style2-config/apply-default
Authorization: Bearer {JWT_TOKEN}
```

**Response:**
```json
{
  "success": true,
  "message": "Default Style2 theme configuration applied successfully",
  "data": {
    "sections": [
      {
        "id": 1,
        "position": 1,
        "section_type": "hero_sidebar",
        "hero_category": "latest",
        "sidebar_category": "trending",
        "bottom_category": "latest"
      },
      {
        "id": 2,
        "position": 2,
        "section_type": "category_boxes_3col",
        "categories": ["politics", "sports", "entertainment"]
      }
      // ... more default sections
    ]
  }
}
```

### Step 3: Customize Configuration (Optional)
Modify the configuration to match your needs:

```bash
# Customize Style2 configuration
PUT /api/v1/tenant-theme/{tenantId}/style2-config
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json

{
  "sections": [
    {
      "id": 1,
      "position": 1,
      "section_type": "hero_sidebar",
      "hero_category": "breaking",
      "sidebar_category": "politics",
      "bottom_category": "sports"
    },
    {
      "id": 2,
      "position": 2,
      "section_type": "magazine_grid",
      "category": "technology",
      "theme_color": "blue"
    },
    {
      "id": 3,
      "position": 3,
      "section_type": "horizontal_scroll",
      "category": "entertainment",
      "theme_color": "rose"
    }
  ]
}
```

### Step 4: Test Frontend
Load the homepage to see your configuration in action:

```bash
# Get homepage data with Style2
GET /api/v1/public/homepage?shape=style2
X-Tenant-Domain: your-domain.com
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sections": [
      {
        "id": 1,
        "position": 1,
        "section_type": "hero_sidebar",
        "hero_category": "breaking",
        "sidebar_category": "politics",
        "bottom_category": "sports",
        "data": {
          "hero": [...],
          "sidebar": [...],
          "bottom": [...]
        }
      },
      {
        "id": 2,
        "position": 2,
        "section_type": "magazine_grid",
        "category": "technology",
        "theme_color": "blue",
        "data": {
          "category": {
            "slug": "technology",
            "name": "Technology",
            "href": "/category/technology"
          },
          "items": [...]
        }
      }
    ]
  }
}
```

## 📋 Configuration Options

### Available Section Types:
- `hero_sidebar` - Hero with sidebar and bottom content
- `category_boxes_3col` - 3-column category boxes  
- `small_cards_3col` - 3-column small cards
- `magazine_grid` - Magazine-style grid
- `horizontal_scroll` - Horizontal scrolling content
- `spotlight` - Spotlight/featured section
- `newspaper_columns` - Newspaper columns
- `horizontal_cards` - Horizontal card layout
- `photo_gallery` - Photo gallery
- `timeline` - Timeline feed
- `featured_banner` - Featured banner
- `compact_lists_2col` - 2-column compact lists

### Available Theme Colors:
`emerald`, `rose`, `amber`, `blue`, `violet`, `cyan`, `indigo`, `red`, `green`, `purple`, `pink`, `yellow`, `teal`, `orange`, `slate`

### Special Categories:
- `latest` - Latest articles across all categories
- `trending`/`popular` - Most viewed articles
- `breaking` - Breaking news articles
- Any category slug (e.g., `politics`, `sports`, `technology`)

## 🛠️ Management APIs

### Get Available Options
```bash
# Get available section types and theme colors
GET /api/v1/tenant-theme/{tenantId}/style2-config/section-types
Authorization: Bearer {JWT_TOKEN}
```

### Get Current Configuration
```bash
# Get current Style2 configuration
GET /api/v1/tenant-theme/{tenantId}/style2-config
Authorization: Bearer {JWT_TOKEN}
```

## 🔐 Authentication Requirements

All configuration APIs require JWT authentication with:
- **SUPER_ADMIN** role (can manage any tenant)
- **TENANT_ADMIN** role (scoped to specific tenant)

The public homepage API requires no authentication but needs proper tenant resolution via domain or `X-Tenant-Domain` header.

## 🎯 Quick Setup Commands

```bash
# Set environment variables
export BASE_URL="https://your-api.com"
export TENANT_ID="your-tenant-id"
export JWT_TOKEN="your-jwt-token"
export DOMAIN_ID="your-domain-id"

# 1. Set domain to Style2
curl -X PUT "$BASE_URL/api/v1/domains/$DOMAIN_ID/settings" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data": {"themeStyle": "style2"}}'

# 2. Apply default Style2 config
curl -X POST "$BASE_URL/api/v1/tenant-theme/$TENANT_ID/style2-config/apply-default" \
  -H "Authorization: Bearer $JWT_TOKEN"

# 3. Test homepage
curl "$BASE_URL/api/v1/public/homepage?shape=style2" \
  -H "X-Tenant-Domain: your-domain.com"
```

Your Style2 theme is now configured and ready to use! 🚀