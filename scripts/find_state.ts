import prisma from '../src/lib/prisma';

function parseArg(name: string): string {
  const prefix = `--${name}=`;
  const hit = process.argv.find(a => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}

async function main() {
  const name = parseArg('name');
  if (!name) throw new Error('Missing --name=<state name>');

  const rows = await prisma.state.findMany({
    where: { name: { contains: name, mode: 'insensitive' } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
