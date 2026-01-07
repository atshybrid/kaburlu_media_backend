import prisma from '../src/lib/prisma';

const roles = [
  { name: 'SUPER_ADMIN', permissions: { all: true } },
  { name: 'SUPERADMIN', permissions: { all: true } },
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
    name: 'TENANT_EDITOR',
    permissions: {
      articles: ['edit', 'approve'],
      shortNews: ['edit', 'approve'],
      webArticles: ['edit', 'approve'],
    },
  },
  {
    name: 'CHIEF_EDITOR',
    permissions: {
      articles: ['edit', 'approve'],
      shortNews: ['edit', 'approve'],
      webArticles: ['edit', 'approve'],
    },
  },
  {
    name: 'DESK_EDITOR',
    permissions: {
      articles: ['edit', 'approve'],
      shortNews: ['edit', 'approve'],
      webArticles: ['edit', 'approve'],
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
  {
    name: 'NEWS_DESK_ADMIN',
    permissions: {
      articles: ['edit', 'approve'],
      shortNews: ['edit', 'approve'],
      webArticles: ['edit', 'approve'],
      prompts: ['manage'],
    },
  },
  { name: 'LANGUAGE_ADMIN', permissions: { languages: ['manage'], prompts: ['manage'] } },
  { name: 'NEWS_MODERATOR', permissions: { moderation: ['ai_review', 'manual_review'] } },
  { name: 'ADMIN_EDITOR', permissions: { articles: ['edit', 'approve'], shortNews: ['edit', 'approve'], webArticles: ['edit', 'approve'] } },
  { name: 'PARENT_REPORTER', permissions: { reporters: ['create_child', 'review'] } },
  {
    name: 'REPORTER',
    permissions: {
      articles: ['create', 'edit_own'],
      webArticles: ['create', 'edit_own'],
    },
  },
  { name: 'GUEST', permissions: { guest: true } },
  { name: 'GUEST_REPORTER', permissions: { shortNews: ['create_limited'] } },
  {
    name: 'CITIZEN_REPORTER',
    permissions: {
      shortNews: ['create', 'edit_own'],
    },
  },
  { name: 'PUBLIC_FIGURE', permissions: { shortNews: ['create', 'edit_own'] } },
];

async function main() {
  const roleNames = roles.map(r => r.name);
  const existing = await prisma.role.findMany({ where: { name: { in: roleNames } }, select: { name: true } });
  const existingNames = new Set(existing.map(r => r.name));
  const missing = roles.filter(r => !existingNames.has(r.name));

  if (missing.length) {
    await prisma.role.createMany({
      data: missing.map(r => ({ name: r.name, permissions: r.permissions })),
      skipDuplicates: true,
    });
  }

  console.log('Roles already existed:', existing.length);
  console.log('Roles created:', missing.length);
  console.log('Role seeding complete');
}

main().catch((e) => { console.error(e); process.exit(1); });
