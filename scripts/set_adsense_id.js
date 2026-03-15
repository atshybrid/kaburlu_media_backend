// One-off script: push ca-pub-5191460803448280 into DomainSettings for all active domains
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

const ADSENSE_CLIENT_ID = 'ca-pub-5191460803448280';

(async () => {
  try {
    const domains = await p.domain.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, domain: true, tenantId: true, kind: true },
    });
    console.log(`Found ${domains.length} active domain(s)`);

    for (const domain of domains) {
      const existing = await p.domainSettings.findUnique({ where: { domainId: domain.id } });

      const existingData = (existing?.data && typeof existing.data === 'object') ? existing.data : {};
      const existingInteg = (existingData.integrations && typeof existingData.integrations === 'object') ? existingData.integrations : {};
      const existingAds = (existingInteg.ads && typeof existingInteg.ads === 'object') ? existingInteg.ads : {};

      const newData = {
        ...existingData,
        integrations: {
          ...existingInteg,
          ads: {
            ...existingAds,
            adsenseClientId: ADSENSE_CLIENT_ID,
          },
        },
      };

      await p.domainSettings.upsert({
        where: { domainId: domain.id },
        update: { data: newData },
        create: {
          domainId: domain.id,
          tenantId: domain.tenantId,
          data: newData,
        },
      });

      console.log(`✓ ${domain.domain} (${domain.kind}) → adsenseClientId = ${ADSENSE_CLIENT_ID}`);
    }

    console.log('\nDone.');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
