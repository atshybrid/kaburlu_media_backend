/**
 * Complete Response Example - Public ShortNews API with Enhanced Author Section
 * 
 * This shows the full response structure from GET /shortnews/public and GET /shortnews/public/:id
 */

// ============================================================================
// COMPLETE RESPONSE EXAMPLE
// ============================================================================

const completeShortNewsResponse = {
  "success": true,
  "data": {
    // ========== BASIC NEWS INFORMATION ==========
    "id": "cm9abc123def456",
    "slug": "guntur-heavy-rains-traffic-disruption",
    "title": "గుంటూరులో భారీ వర్షాలు - ట్రాఫిక్ ఆగిపోయింది",
    "content": "నిన్న రాత్రి గుంటూరు జిల్లాలో భారీ వర్షాలు కురిశాయి. నగరంలోని అనేక ప్రాంతాలలో నీటి మునకలు ఏర్పడ్డాయి. ప్రధాన రహదారులపై ట్రాఫిక్ పూర్తిగా స్తంభించింది. పోలీసులు ట్రాఫిక్ నియంత్రణ చర్యలు తీసుకుంటున్నారు.",
    "status": "DESK_APPROVED",
    "createdAt": "2026-02-14T10:30:00.000Z",
    "updatedAt": "2026-02-14T10:35:00.000Z",
    "publishDate": "2026-02-14T10:35:00.000Z",
    
    // ========== MEDIA & VISUAL CONTENT ==========
    "mediaUrls": [
      "https://cdn.kaburlumedia.com/shortnews/2026/02/14/rain-guntur-1.webp",
      "https://cdn.kaburlumedia.com/shortnews/2026/02/14/rain-guntur-2.webp",
      "https://cdn.kaburlumedia.com/shortnews/2026/02/14/traffic-video.webm"
    ],
    "primaryImageUrl": "https://cdn.kaburlumedia.com/shortnews/2026/02/14/rain-guntur-1.webp",
    "primaryVideoUrl": "https://cdn.kaburlumedia.com/shortnews/2026/02/14/traffic-video.webm",
    "featuredImage": "https://cdn.kaburlumedia.com/shortnews/2026/02/14/rain-guntur-1.webp",
    "imageAlt": "గుంటూరులో భారీ వర్షాలు - ట్రాఫిక్ ఆగిపోయింది - వాతావరణం",
    
    // ========== LANGUAGE & LOCALIZATION ==========
    "languageId": "lang_telugu_123",
    "languageName": "Telugu",
    "languageCode": "te",
    
    // ========== CATEGORY ==========
    "categoryId": "cat_weather_456",
    "categorySlug": "weather",
    "categoryName": "వాతావరణం",
    
    // ========== 🆕 ENHANCED AUTHOR SECTION ==========
    "authorName": "రాజేష్ కుమార్",
    "author": {
      // Basic Info
      "id": "usr_reporter_789",
      "fullName": "రాజేష్ కుమార్",
      "email": "rajesh.kumar@daxintimes.com",
      "mobileNumber": "+919876543210",
      "roleName": "REPORTER",
      "reporterType": "REPORTER",
      
      // 🆕 Profile Photo (Reporter's dedicated photo takes precedence)
      "profilePhotoUrl": "https://cdn.kaburlumedia.com/reporters/rajesh-kumar-profile.jpg",
      
      // 🆕 Reporter Status Flag
      "isReporter": true,
      
      // 🆕 DESIGNATION (in native language)
      "designation": {
        "name": "District Reporter",
        "nativeName": "జిల్లా రిపోర్టర్"
      },
      
      // 🆕 WORK PLACE - Complete Location Hierarchy
      "workPlace": {
        // Reporter's assigned level
        "level": "DISTRICT",
        
        // Readable location string
        "location": "Guntur, Andhra Pradesh",
        
        // State details
        "state": {
          "id": "state_ap_001",
          "name": "Andhra Pradesh"
        },
        
        // District details
        "district": {
          "id": "dist_guntur_002",
          "name": "Guntur"
        },
        
        // Mandal details (null if not assigned to mandal level)
        "mandal": null,
        
        // Assembly constituency (null if not assigned)
        "assembly": null
      },
      
      // 🆕 Reporter Level in hierarchy
      "reporterLevel": "DISTRICT",
      
      // 🆕 Active status
      "active": true
    },
    
    // ========== 🆕 TENANT/BRAND INFORMATION ==========
    "tenant": {
      "id": "tenant_daxin_001",
      "name": "DAXIN TIMES",
      "slug": "daxin-times",
      "domain": "daxintimes.com",
      "language": "te",
      
      // 🆕 Brand Logo (for display in header/card)
      "logoUrl": "https://cdn.kaburlumedia.com/tenants/daxin-times/logo.png",
      
      // 🆕 Favicon
      "faviconUrl": "https://cdn.kaburlumedia.com/tenants/daxin-times/favicon.ico",
      
      // 🆕 Native Name (Telugu/Hindi name of organization)
      "nativeName": "డాక్సిన్ టైమ్స్"
    },
    
    // ========== LOCATION & GEO DATA ==========
    "latitude": 16.3067,
    "longitude": 80.4365,
    "accuracyMeters": 15.5,
    "placeName": "Guntur",
    "address": "Guntur, Guntur District, Andhra Pradesh",
    "placeId": "ChIJgUbEiTf3yzsRkI8n_HoY-gE",
    "timestampUtc": "2026-02-14T10:25:00.000Z",
    "provider": "fused",
    "source": "foreground",
    
    // ========== URLs & SHARING ==========
    "canonicalUrl": "https://daxintimes.com/te/short/guntur-heavy-rains-traffic-disruption",
    "webUrl": "https://daxintimes.com/weather/guntur-heavy-rains-traffic-disruption",
    "shareLink": "https://daxintimes.com/weather/guntur-heavy-rains-traffic-disruption",
    "shortUrl": "https://daxintimes.com/s/3def456",
    "appDeepLink": "kaburlu://shortnews/cm9abc123def456",
    
    // ========== SEO & METADATA ==========
    "seo": {
      "title": "గుంటూరులో భారీ వర్షాలు - ట్రాఫిక్ ఆగిపోయింది | DAXIN TIMES",
      "description": "నిన్న రాత్రి గుంటూరు జిల్లాలో భారీ వర్షాలు కురిశాయి. నగరంలోని అనేక ప్రాంతాలలో నీటి మునకలు ఏర్పడ్డాయి...",
      "keywords": ["వర్షాలు", "గుంటూరు", "వాతావరణం", "ట్రాఫిక్"],
      "ogTitle": "గుంటూరులో భారీ వర్షాలు - ట్రాఫిక్ ఆగిపోయింది",
      "ogDescription": "నిన్న రాత్రి గుంటూరు జిల్లాలో భారీ వర్షాలు కురిశాయి...",
      "ogImage": "https://cdn.kaburlumedia.com/shortnews/2026/02/14/rain-guntur-1.webp"
    },
    
    // ========== JSON-LD Structured Data ==========
    "jsonLd": {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": "గుంటూరులో భారీ వర్షాలు - ట్రాఫిక్ ఆగిపోయింది",
      "image": [
        "https://cdn.kaburlumedia.com/shortnews/2026/02/14/rain-guntur-1.webp",
        "https://cdn.kaburlumedia.com/shortnews/2026/02/14/rain-guntur-2.webp"
      ],
      "datePublished": "2026-02-14T10:35:00.000Z",
      "dateModified": "2026-02-14T10:35:00.000Z",
      "author": {
        "@type": "Person",
        "name": "రాజేష్ కుమార్"
      }
    },
    
    // ========== FLAGS & STATUS ==========
    "isBreaking": false,
    "isOwner": false,
    "isRead": false,
    "allowComments": true,
    "pushNotificationSent": true,
    "pushNotificationSentAt": "2026-02-14T10:36:00.000Z",
    
    // ========== TAGS & TEMPLATE ==========
    "tags": ["వర్షాలు", "గుంటూరు", "వాతావరణం", "ట్రాఫిక్"],
    "templateId": "simple-01",
    
    // ========== HEADINGS (Optional styling) ==========
    "headings": {
      "h2": {
        "tag": "h2",
        "text": "నీటి మునకలు ఏర్పడ్డాయి",
        "color": "#1f2937",
        "bgColor": "transparent",
        "size": 20
      },
      "h3": {
        "tag": "h3",
        "text": "పోలీసుల చర్యలు",
        "color": "#374151",
        "bgColor": "transparent",
        "size": 18
      }
    }
  }
};

// ============================================================================
// LIST RESPONSE (Multiple Items)
// ============================================================================

const listResponse = {
  "success": true,
  "pageInfo": {
    "limit": 10,
    "nextCursor": "eyJpZCI6ImNtOWFiYzEyMyIsImRhdGUiOiIyMDI2LTAyLTE0VDEwOjM1OjAwLjAwMFoifQ==",
    "hasMore": true
  },
  "data": [
    completeShortNewsResponse.data,
    // ... more items with same structure
  ]
};

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('📋 COMPLETE SHORTNEWS PUBLIC API RESPONSE');
console.log('='.repeat(80) + '\n');

console.log('🔹 Basic Info:');
console.log(`   Title: ${completeShortNewsResponse.data.title}`);
console.log(`   Category: ${completeShortNewsResponse.data.categoryName}`);
console.log(`   Language: ${completeShortNewsResponse.data.languageCode}\n`);

console.log('🔹 Author (Enhanced):');
console.log(`   Name: ${completeShortNewsResponse.data.author.fullName}`);
console.log(`   Photo: ${completeShortNewsResponse.data.author.profilePhotoUrl}`);
console.log(`   Is Reporter: ${completeShortNewsResponse.data.author.isReporter}`);
console.log(`   Designation: ${completeShortNewsResponse.data.author.designation?.nativeName}\n`);

console.log('🔹 Work Place:');
console.log(`   Level: ${completeShortNewsResponse.data.author.workPlace?.level}`);
console.log(`   Location: ${completeShortNewsResponse.data.author.workPlace?.location}`);
console.log(`   State: ${completeShortNewsResponse.data.author.workPlace?.state?.name}`);
console.log(`   District: ${completeShortNewsResponse.data.author.workPlace?.district?.name}\n`);

console.log('🔹 Tenant/Brand:');
console.log(`   Name: ${completeShortNewsResponse.data.tenant?.name}`);
console.log(`   Native: ${completeShortNewsResponse.data.tenant?.nativeName}`);
console.log(`   Logo: ${completeShortNewsResponse.data.tenant?.logoUrl}`);
console.log(`   Domain: ${completeShortNewsResponse.data.tenant?.domain}\n`);

console.log('🔹 Media:');
console.log(`   Primary Image: ${completeShortNewsResponse.data.primaryImageUrl}`);
console.log(`   Primary Video: ${completeShortNewsResponse.data.primaryVideoUrl}`);
console.log(`   Total Media: ${completeShortNewsResponse.data.mediaUrls.length}\n`);

console.log('🔹 URLs for Sharing:');
console.log(`   Web URL: ${completeShortNewsResponse.data.webUrl}`);
console.log(`   Short URL: ${completeShortNewsResponse.data.shortUrl}`);
console.log(`   App Deep Link: ${completeShortNewsResponse.data.appDeepLink}\n`);

console.log('='.repeat(80) + '\n');

// ============================================================================
// FRONTEND DISPLAY EXAMPLE (React/React Native)
// ============================================================================

console.log('📱 FRONTEND CARD COMPONENT EXAMPLE:\n');
console.log('```jsx');
console.log(`const ShortNewsCard = ({ news }) => {
  return (
    <div className="news-card">
      {/* Tenant Brand Header */}
      <div className="brand-header">
        <img src={news.tenant.logoUrl} alt={news.tenant.name} />
        <span className="brand-name">
          {news.tenant.nativeName || news.tenant.name}
        </span>
      </div>

      {/* Featured Image */}
      <img 
        src={news.primaryImageUrl} 
        alt={news.imageAlt}
        className="featured-image" 
      />

      {/* News Content */}
      <div className="content">
        <h2>{news.title}</h2>
        <p>{news.content}</p>
      </div>

      {/* Author Section - ENHANCED */}
      <div className="author-section">
        <img 
          src={news.author.profilePhotoUrl} 
          alt={news.author.fullName}
          className="author-photo"
        />
        <div className="author-info">
          <div className="author-name">{news.author.fullName}</div>
          
          {/* Reporter Designation */}
          {news.author.designation && (
            <div className="designation">
              {news.author.designation.nativeName || 
               news.author.designation.name}
            </div>
          )}
          
          {/* Work Location */}
          {news.author.workPlace && (
            <div className="work-location">
              📍 {news.author.workPlace.location}
            </div>
          )}
        </div>
      </div>

      {/* Category & Timestamp */}
      <div className="footer">
        <span className="category">{news.categoryName}</span>
        <span className="time">{formatTime(news.createdAt)}</span>
      </div>
    </div>
  );
};`);
console.log('```\n');

console.log('='.repeat(80) + '\n');

// Export for TypeScript/JavaScript usage
export { completeShortNewsResponse, listResponse };
