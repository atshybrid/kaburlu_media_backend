/** Known UI brand colors (not from ECI). */
export const PARTY_BRAND_COLORS: Record<string, { primary: string; secondary: string }> = {
  BJP: { primary: '#FF9933', secondary: '#138808' },
  INC: { primary: '#00AEEF', secondary: '#FFFFFF' },
  AITC: { primary: '#20C997', secondary: '#FFFFFF' },
  BSP: { primary: '#22409A', secondary: '#FFFFFF' },
  CPI: { primary: '#DE0000', secondary: '#FFFF00' },
  CPI_M: { primary: '#DE0000', secondary: '#FFFFFF' },
  NCP: { primary: '#00B0F0', secondary: '#FFFFFF' },
  NPP: { primary: '#1565C0', secondary: '#FFFFFF' },
  AAP: { primary: '#0072B8', secondary: '#FFFFFF' },
  TDP: { primary: '#FFFF00', secondary: '#DE0000' },
  YSRCP: { primary: '#0260B4', secondary: '#FFFFFF' },
  BRS: { primary: '#E91E63', secondary: '#FFFFFF' },
  TRS: { primary: '#E91E63', secondary: '#FFFFFF' },
  AIMIM: { primary: '#006633', secondary: '#FFFFFF' },
  DMK: { primary: '#DE0000', secondary: '#000000' },
  AIADMK: { primary: '#006600', secondary: '#FFFFFF' },
  SP: { primary: '#ED1B24', secondary: '#00A651' },
  RJD: { primary: '#006633', secondary: '#FFFFFF' },
  JDU: { primary: '#008000', secondary: '#FFFFFF' },
  SHIVSENA: { primary: '#FF6600', secondary: '#FFFFFF' },
  JSP: { primary: '#DE0000', secondary: '#FFFFFF' },
};

export function colorsForParty(shortCode: string, recognition: string) {
  const known = PARTY_BRAND_COLORS[shortCode];
  if (known) return { ...known, colorSource: 'MANUAL' as const };
  if (recognition === 'NATIONAL') return { primary: '#1A237E', secondary: '#FFFFFF', colorSource: 'MANUAL' as const };
  if (recognition === 'STATE') return { primary: '#455A64', secondary: '#FFFFFF', colorSource: 'MANUAL' as const };
  return { primary: '#78909C', secondary: '#FFFFFF', colorSource: 'MANUAL' as const };
}
