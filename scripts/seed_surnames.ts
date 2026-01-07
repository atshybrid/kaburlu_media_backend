import prisma from '../src/lib/prisma';

function parseArg(name: string): string {
  const eqPrefix = `--${name}=`;
  const hitEq = process.argv.find(a => a.startsWith(eqPrefix));
  if (hitEq) return hitEq.slice(eqPrefix.length);

  const flag = `--${name}`;
  const idx = process.argv.findIndex(a => a === flag);
  if (idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }

  // npm may treat unknown flags as npm config and expose them via env.
  const envKey = `npm_config_${name.toLowerCase()}`;
  const envVal = (process.env as any)[envKey];
  return envVal ? String(envVal) : '';
}

function splitCsv(v: string): string[] {
  return v
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

async function main() {
  const stateId = parseArg('stateId');
  if (!stateId) {
    throw new Error('Missing --stateId=<State.id>');
  }

  const surnamesCsv = parseArg('surnames');
  const surnames = surnamesCsv
    ? splitCsv(surnamesCsv)
    : [
        'Reddy',
        'Naidu',
        'Rao',
        'Sharma',
        'Gupta',
        'Yadav',
        'Patel',
        'Khan',
        'Singh',
      ];

  const state = await prisma.state.findUnique({ where: { id: stateId }, select: { id: true, name: true } });
  if (!state) throw new Error(`State not found: ${stateId}`);

  console.log(`Seeding Surname for state=${state.name} (${state.id})`);

  let created = 0;
  let updated = 0;

  for (const surnameEn of surnames) {
    const existing = await (prisma as any).surname.findFirst({
      where: { stateId, surnameEn: { equals: surnameEn, mode: 'insensitive' } },
      select: { id: true },
    });

    if (existing) {
      updated += 1;
      continue;
    }

    await (prisma as any).surname.create({
      data: { stateId, surnameEn, isVerified: true },
      select: { id: true },
    });
    created += 1;
  }

  console.log(`Done. Created=${created}, AlreadyPresent=${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
