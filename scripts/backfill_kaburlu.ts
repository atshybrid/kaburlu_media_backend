/**
 * Backfill script for kaburlutoday.com domain
 * Run: npx ts-node scripts/backfill_kaburlu.ts
 */

import prisma from '../src/lib/prisma';
import { bootstrapTenantContent } from '../src/lib/tenantBootstrap';

async function backfillKaburluDomain() {
  try {
    console.log('🔍 Searching for kaburlutoday.com domain...\n');
    
    // Find NEWS domain (not ePaper)
    const domain = await (prisma as any).domain.findFirst({
      where: { 
        AND: [
          {
            OR: [
              { domain: { equals: 'kaburlutoday.com' } },
              { domain: { contains: 'kaburlutoday', mode: 'insensitive' } }
            ]
          },
          { kind: 'NEWS' } // Only NEWS domains, not EPAPER
        ]
      },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' } // Get the primary domain first
    });
    
    if (!domain) {
      console.log('❌ Domain not found. Listing available domains...\n');
      const allDomains = await (prisma as any).domain.findMany({
        include: { tenant: true },
        take: 10,
        orderBy: { createdAt: 'desc' }
      });
      
      console.log('Available domains:');
      allDomains.forEach((d: any, i: number) => {
        console.log(`${i + 1}. ${d.domain} (${d.status}) - Tenant: ${d.tenant.name} [ID: ${d.id}]`);
      });
      
      console.log('\n💡 To backfill a specific domain, update the script with the correct domain name.');
      return;
    }
    
    console.log('✅ Found domain:');
    console.log('   Domain:', domain.domain);
    console.log('   Domain ID:', domain.id);
    console.log('   Status:', domain.status);
    console.log('   Tenant:', domain.tenant.name);
    console.log('   Tenant ID:', domain.tenantId);
    console.log('   Current Sample Status:', domain.sampleDataStatus || 'null');
    console.log('   Current Sample Message:', domain.sampleDataMessage || 'null');
    
    // Check if domain is verified
    if (domain.status !== 'ACTIVE') {
      console.log(`\n⚠️  Domain status is ${domain.status}, not ACTIVE. Please verify domain first.`);
      return;
    }
    
    // Check existing articles
    const existingCount = await (prisma as any).article.count({
      where: { 
        tenantId: domain.tenantId, 
        tags: { hasSome: ['sample', 'bootstrap'] } 
      }
    });
    
    console.log('   Existing Bootstrap Articles:', existingCount);
    
    if (existingCount > 0) {
      console.log('\n⚠️  Sample articles already exist!');
      console.log('   To regenerate, set force=true in the code or delete existing articles first.');
      console.log('\n   Proceeding with force=true to regenerate...\n');
      
      // Delete existing
      const deleted = await (prisma as any).article.deleteMany({
        where: { 
          tenantId: domain.tenantId, 
          tags: { hasSome: ['sample', 'bootstrap'] } 
        }
      });
      console.log(`   🗑️  Deleted ${deleted.count} existing bootstrap articles\n`);
    }
    
    console.log('🚀 Starting bootstrap process...\n');
    console.log('   Settings:');
    console.log('   - Articles per category: 15');
    console.log('   - NewsData.io: ✅ Enabled (real news)');
    console.log('   - AI Rewrite: ✅ Enabled (publication style)');
    console.log('   - R2 Upload: ✅ Enabled (permanent storage)');
    console.log('   - Images: ✅ Placeholder (category colors)');
    console.log('\n   ⏳ This will take 30-60 seconds...\n');
    
    // Trigger bootstrap
    const result = await bootstrapTenantContent(domain.tenantId, domain.id, {
      articlesPerCategory: 15,
      useNewsAPI: true,
      aiRewriteNews: true,
      uploadImagesToR2: true,
      addImages: true,
      imageSource: 'placeholder'
    });
    
    console.log('\n✅ Bootstrap complete!');
    console.log('   Success:', result.success);
    console.log('   Articles created:', result.created.articles);
    console.log('   ePaper created:', result.created.epaper);
    
    // Check final status
    const updatedDomain = await (prisma as any).domain.findUnique({
      where: { id: domain.id }
    });
    
    console.log('\n📊 Final Status:');
    console.log('   Sample Data Status:', updatedDomain.sampleDataStatus);
    console.log('   Sample Data Message:', updatedDomain.sampleDataMessage);
    console.log('   Generated At:', updatedDomain.sampleDataGeneratedAt);
    
    // Verify articles
    const finalCount = await (prisma as any).article.count({
      where: { 
        tenantId: domain.tenantId, 
        tags: { hasSome: ['sample', 'bootstrap'] } 
      }
    });
    
    console.log('   Total Bootstrap Articles:', finalCount);
    
    console.log('\n🎉 Done! Check your dashboard to see the articles.');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await (prisma as any).$disconnect();
  }
}

backfillKaburluDomain();
