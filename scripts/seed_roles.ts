import prisma from '../src/lib/prisma';

const roles = [
  { name: 'SUPER_ADMIN', permissions: { all: true } },
  {
    name: 'TENANT_ADMIN',
    permissions: {
      tenants: ['manage'],
      domains: ['manage'],
      reporters: ['manage'],
      articles: ['approve'],
      shortNews: ['approve'],
      webArticles: ['approve'],
    },
  },
  {
    name: 'NEWS_DESK',
    permissions: {
      articles: ['edit', 'approve'],
      shortNews: ['edit', 'approve'],
      webArticles: ['edit', 'approve'],
    },
  },
  { name: 'NEWS_MODERATOR', permissions: { moderation: ['ai_review', 'manual_review'] } },
  { name: 'PARENT_REPORTER', permissions: { reporters: ['create_child', 'review'] } },
  {
    name: 'REPORTER',
    permissions: {
      articles: ['create', 'edit_own'],
      webArticles: ['create', 'edit_own'],
    },
  },
  { name: 'GUEST_REPORTER', permissions: { shortNews: ['create_limited'] } },
  {
    name: 'CITIZEN_REPORTER',
    permissions: {
      shortNews: ['create', 'edit_own'],
    },
  },
];

async function main() {
  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { permissions: r.permissions },
      create: { name: r.name, permissions: r.permissions },
    });
    console.log('Upserted role:', r.name);
  }
  console.log('Role seeding complete');
}

main().catch((e) => { console.error(e); process.exit(1); });
