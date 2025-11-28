import prisma from '../src/lib/prisma';

// Clears mandal data. By default performs a soft delete (isDeleted=true).
// Set env MANDALS_HARD_DELETE=true to physically delete rows. (May fail if FK constraints exist.)
// Optionally set MANDALS_DISTRICT_NAME to limit to a single district name.
async function run() {
  const hard = String(process.env.MANDALS_HARD_DELETE).toLowerCase() === 'true';
  const districtName = process.env.MANDALS_DISTRICT_NAME?.trim();

  try {
    let targetDistrictIds: string[] | undefined;
    if (districtName) {
      const districts = await prisma.district.findMany({
        where: { name: { equals: districtName, mode: 'insensitive' } },
        select: { id: true }
      });
      if (districts.length === 0) {
        console.log(`[clear_mandals] No district found matching name='${districtName}'. Aborting.`);
        return;
      }
      targetDistrictIds = districts.map(d => d.id);
      console.log(`[clear_mandals] Targeting ${targetDistrictIds.length} district(s) for name='${districtName}'.`);
    }

    if (hard) {
      // Hard delete path
      const whereClause = targetDistrictIds ? { districtId: { in: targetDistrictIds } } : {};
      const deleted = await prisma.mandal.deleteMany({ where: whereClause });
      console.log(`[clear_mandals] HARD DELETE removed ${deleted.count} mandals.`);
    } else {
      // Soft delete path
      const whereClause = targetDistrictIds ? { districtId: { in: targetDistrictIds }, isDeleted: false } : { isDeleted: false };
      const updated = await prisma.mandal.updateMany({
        where: whereClause,
        data: { isDeleted: true }
      });
      console.log(`[clear_mandals] Soft-deleted (isDeleted=true) ${updated.count} mandals.`);
    }

    if (!hard) {
      // Report remaining active mandals
      const remaining = await prisma.mandal.count({ where: { isDeleted: false, ...(targetDistrictIds ? { districtId: { in: targetDistrictIds } } : {}) } });
      console.log(`[clear_mandals] Remaining active mandals after soft delete: ${remaining}`);
    }
  } catch (err: any) {
    console.error('[clear_mandals] Error clearing mandals:', err.message || err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

run();
