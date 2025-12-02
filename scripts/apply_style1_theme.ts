import prisma from '../src/lib/prisma';

// Style1 theme config object aligned with swagger example
const style1Theme = {
  palette: {
    mode: 'light',
    primary: '#0D47A1',
    secondary: '#FFC107',
    accent: '#FF5722',
    background: '#FFFFFF',
    surface: '#F7F9FC',
    mutedText: '#5A6B85'
  },
  typography: {
    fontFamilyBase: 'Inter, system-ui, sans-serif',
    baseFontSizeRem: 1,
    lineHeightBase: 1.5,
    weights: { regular: 400, medium: 500, bold: 700 },
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      md: '1.125rem',
      lg: '1.25rem',
      xl: '1.5rem',
      display: '2.25rem'
    }
  },
  spacing: { unitRem: 0.5, scale: { xs: 0.5, sm: 1, md: 2, lg: 3, xl: 4 } },
  breakpoints: { mobile: 480, tablet: 768, desktop: 1024, wide: 1440 },
  components: {
    button: {
      radius: 6,
      paddingYRem: 0.5,
      paddingXRem: 1,
      variants: {
        solid: { background: '#0D47A1', color: '#FFFFFF' },
        outline: { borderColor: '#0D47A1', color: '#0D47A1' }
      }
    },
    card: { radius: 8, shadow: '0 2px 6px rgba(0,0,0,0.08)', headerFontSize: '1.125rem', hoverLift: true }
  },
  article: { heroLayout: 'standard', showAuthorAvatar: true, showCategoryPill: true, readingProgressBar: true },
  listing: { cardVariant: 'highlight-first', showExcerpt: true, imageAspectRatio: '16:9' }
};

async function main() {
  const domainName = process.argv[2] || 'localhost';
  const domain = await prisma.domain.findUnique({ where: { domain: domainName } });
  if (!domain) {
    console.error('Domain not found:', domainName);
    process.exit(1);
  }
  const base = await prisma.domainSettings.findUnique({ where: { domainId: domain.id } });
  const previous = base?.data as any;
  const baseObj = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous : {};
  const data: any = { ...baseObj, style1: style1Theme };
  await prisma.domainSettings.upsert({
    where: { domainId: domain.id },
    update: { data },
    create: { domainId: domain.id, tenantId: domain.tenantId, data }
  });
  console.log('Applied style1 theme to domain:', domainName, 'tenant:', domain.tenantId);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(()=>process.exit());
