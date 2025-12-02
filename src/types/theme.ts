export interface ThemePalette {
  mode: 'light' | 'dark';
  primary: string;
  secondary: string;
  accent?: string;
  success?: string;
  warning?: string;
  danger?: string;
  background?: string;
  surface?: string;
  border?: string;
  mutedText?: string;
}

export interface ThemeTypographyScale {
  fontFamilyBase: string;
  fontFamilyHeading?: string;
  baseFontSizeRem: number; // e.g. 1.0 = 16px
  lineHeightBase: number; // e.g. 1.5
  weights: {
    regular: number;
    medium: number;
    semibold?: number;
    bold: number;
  };
  sizes: {
    xs: string; // e.g. 0.75rem
    sm: string;
    base: string;
    md: string;
    lg: string;
    xl: string;
    display: string;
  };
}

export interface ThemeSpacingScale {
  unitRem: number; // base spacing unit
  scale: {
    xs: number; // multiplier * unit
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
}

export interface ThemeBreakpoints {
  mobile: number;
  tablet: number;
  desktop: number;
  wide?: number;
}

export interface ThemeComponentVariants {
  button: {
    radius: number;
    paddingYRem: number;
    paddingXRem: number;
    variants: {
      solid: { background: string; color: string };
      outline: { borderColor: string; color: string };
      subtle?: { background: string; color: string };
    };
  };
  card: {
    radius: number;
    shadow: string;
    headerFontSize?: string;
    hoverLift?: boolean;
  };
  tag?: {
    radius: number;
    fontSize: string;
    paddingXRem: number;
    paddingYRem: number;
  };
}

export interface Style1ThemeConfig {
  palette: ThemePalette;
  typography: ThemeTypographyScale;
  spacing: ThemeSpacingScale;
  breakpoints: ThemeBreakpoints;
  components: ThemeComponentVariants;
  article: {
    heroLayout: 'standard' | 'wide-image' | 'split';
    showAuthorAvatar: boolean;
    showCategoryPill: boolean;
    readingProgressBar: boolean;
  };
  listing: {
    cardVariant: 'compact' | 'standard' | 'highlight-first';
    showExcerpt: boolean;
    imageAspectRatio: string; // e.g. '16:9'
  };
}

export interface EffectiveSettings {
  branding?: any;
  theme?: any;
  navigation?: any;
  seo?: any;
  style1?: Style1ThemeConfig; // new namespaced theme config
}
