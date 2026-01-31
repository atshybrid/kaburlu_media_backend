/**
 * Test Unified Article API
 * Usage: node scripts/test_unified_article.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testUnifiedArticle() {
  console.log('🚀 Testing Unified Article API...\n');

  try {
    // 1. Get a reporter first (then use its tenant)
    const reporter = await prisma.reporter.findFirst({
      where: { userId: { not: null } },
      include: { user: true, tenant: true }
    });

    if (!reporter) {
      console.error('❌ No reporter found');
      return;
    }
    console.log('✅ Reporter:', reporter.user?.id);
    
    const tenant = reporter.tenant;
    if (!tenant) {
      console.error('❌ Reporter has no tenant');
      return;
    }
    console.log('✅ Tenant:', tenant.name, '(', tenant.id, ')');

    // 2. Get a valid category
    const category = await prisma.category.findFirst({
      select: { id: true, name: true, slug: true }
    });
    
    if (!category) {
      console.error('❌ No category found');
      return;
    }
    console.log('✅ Category:', category.name, '(', category.id, ')');

    // 3. Get valid state/district/mandal
    const state = await prisma.state.findFirst({
      where: { name: { contains: 'Telangana', mode: 'insensitive' } },
      select: { id: true, name: true }
    });
    
    const district = state ? await prisma.district.findFirst({
      where: { stateId: state.id },
      select: { id: true, name: true }
    }) : null;
    
    const mandal = district ? await prisma.mandal.findFirst({
      where: { districtId: district.id },
      select: { id: true, name: true }
    }) : null;

    console.log('✅ State:', state?.name, '(', state?.id, ')');
    console.log('✅ District:', district?.name, '(', district?.id, ')');
    console.log('✅ Mandal:', mandal?.name, '(', mandal?.id, ')');

    // 5. Build the payload
    const payload = {
      tenantId: tenant.id,
      domainId: null,
      baseArticle: {
        languageCode: "te",
        newsType: "News",
        category: {
          categoryId: category.id,
          categoryName: category.name
        }
      },
      location: {
        inputText: district?.name || "హైదరాబాద్",
        resolved: {
          state: state ? { id: state.id, name: state.name } : null,
          district: district ? { id: district.id, name: district.name } : null,
          mandal: mandal ? { id: mandal.id, name: mandal.name } : null,
          village: null
        },
        dateline: {
          placeName: district?.name || "హైదరాబాద్",
          date: new Date().toISOString().split('T')[0],
          formatted: (district?.name || "హైదరాబాద్") + ", జనవరి 31"
        }
      },
      printArticle: {
        headline: "TEST: ముఖ్యమంత్రి కొత్త పథకం ప్రకటన",
        subtitle: "రైతులకు రూ.5000 సహాయం",
        body: [
          "ముఖ్యమంత్రి రేవంత్ రెడ్డి ఈ రోజు రైతులకు కొత్త పథకాన్ని ప్రకటించారు.",
          "ఈ పథకం కింద ప్రతి రైతుకు రూ.5000 నేరుగా బ్యాంక్ ఖాతాలో జమ అవుతుంది."
        ],
        highlights: ["రైతులకు రూ.5000 సహాయం", "నేరుగా బ్యాంక్ ఖాతాలో జమ"],
        responses: null
      },
      webArticle: {
        headline: "TEST: ముఖ్యమంత్రి రేవంత్ రెడ్డి రైతులకు కొత్త పథకం",
        lead: "తెలంగాణ ముఖ్యమంత్రి రేవంత్ రెడ్డి ఈ రోజు రైతులకు ప్రత్యేక ఆర్థిక సహాయ పథకాన్ని ప్రకటించారు.",
        sections: [
          { subhead: null, paragraphs: ["ముఖ్యమంత్రి రేవంత్ రెడ్డి ఈ రోజు రైతులకు కొత్త పథకాన్ని ప్రకటించారు."] },
          { subhead: "పథకం వివరాలు", paragraphs: ["ఈ పథకం కింద ప్రతి రైతుకు రూ.5000 నేరుగా బ్యాంక్ ఖాతాలో జమ అవుతుంది."] }
        ],
        seo: {
          slug: "test-cm-revanth-reddy-new-scheme-" + Date.now(),
          metaTitle: "TEST: ముఖ్యమంత్రి రైతులకు కొత్త పథకం | Kaburlu",
          metaDescription: "తెలంగాణ ముఖ్యమంత్రి రేవంత్ రెడ్డి రైతులకు రూ.5000 ఆర్థిక సహాయ పథకం.",
          keywords: ["రేవంత్ రెడ్డి", "రైతు పథకం", "తెలంగాణ"]
        }
      },
      shortNews: {
        h1: "TEST: CM కొత్త పథకం",
        h2: "రైతులకు రూ.5000",
        content: "ముఖ్యమంత్రి రేవంత్ రెడ్డి రైతులకు రూ.5000 సహాయ పథకం ప్రకటించారు."
      },
      media: {
        images: []
      },
      publishControl: {
        publishReady: true,
        reason: ""
      }
    };

    console.log('\n📦 Payload for Swagger test:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(payload, null, 2));
    console.log('='.repeat(60));

    // 6. Make the API call directly (simulating internal call)
    console.log('\n🔄 Testing via direct database transaction...');
    
    const result = await prisma.$transaction(async (tx) => {
      const authorId = reporter.userId;
      const languageCode = payload.baseArticle.languageCode;
      
      // Get language ID
      const lang = await tx.language.findFirst({
        where: { code: languageCode },
        select: { id: true }
      });
      
      // Create base Article
      const baseArticle = await tx.article.create({
        data: {
          tenantId: tenant.id,
          authorId,
          title: payload.printArticle.headline,
          type: 'UNIFIED',
          content: payload.printArticle.body.join('\n\n'),
          languageId: lang?.id || null,
          status: 'PENDING',
          isBreakingNews: false,
          tags: payload.webArticle.seo.keywords,
          images: [],
          contentJson: {
            raw: {
              title: payload.printArticle.headline,
              content: payload.printArticle.body.join('\n\n'),
            }
          }
        }
      });

      // Create NewspaperArticle
      const newspaperArticle = await tx.newspaperArticle.create({
        data: {
          tenantId: tenant.id,
          authorId,
          baseArticleId: baseArticle.id,
          title: payload.printArticle.headline,
          heading: payload.printArticle.headline,
          subTitle: payload.printArticle.subtitle,
          lead: payload.printArticle.body[0] || null,
          dateline: payload.location.dateline.formatted,
          languageId: lang?.id || null,
          categoryId: category.id,
          stateId: state?.id || null,
          districtId: district?.id || null,
          mandalId: mandal?.id || null,
          placeName: payload.location.dateline.placeName,
          status: 'PENDING',
          isBreaking: false,
          content: payload.printArticle.body.join('\n\n'),
          points: payload.printArticle.highlights,
          wordCount: payload.printArticle.body.join(' ').split(/\s+/).length,
          charCount: payload.printArticle.body.join(' ').length
        }
      });

      // Create ShortNews
      const shortNewsRecord = await tx.shortNews.create({
        data: {
          authorId,
          title: payload.shortNews.h1,
          content: payload.shortNews.content,
          summary: payload.shortNews.content,
          language: languageCode,
          categoryId: category.id,
          placeName: payload.location.dateline.placeName,
          tags: payload.webArticle.seo.keywords.slice(0, 5),
          status: 'PENDING',
          isBreaking: false,
          slug: payload.webArticle.seo.slug
        }
      });

      return { baseArticle, newspaperArticle, shortNewsRecord };
    });

    console.log('\n✅ SUCCESS! Articles created:');
    console.log('   Base Article ID:', result.baseArticle.id);
    console.log('   Newspaper Article ID:', result.newspaperArticle.id);
    console.log('   ShortNews ID:', result.shortNewsRecord.id);

    // Cleanup - delete test articles
    console.log('\n🗑️ Cleaning up test articles...');
    await prisma.shortNews.delete({ where: { id: result.shortNewsRecord.id } });
    await prisma.newspaperArticle.delete({ where: { id: result.newspaperArticle.id } });
    await prisma.article.delete({ where: { id: result.baseArticle.id } });
    console.log('✅ Test articles deleted');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) console.error('   Code:', error.code);
    if (error.meta) console.error('   Meta:', JSON.stringify(error.meta));
  } finally {
    await prisma.$disconnect();
  }
}

testUnifiedArticle();
