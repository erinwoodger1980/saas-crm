/**
 * WEALDEN JOINERY DESIGN SYSTEM
 * 
 * Premium architectural joinery brand
 * Benchmark: timberwindows.com (but calmer, more editorial)
 * 
 * Core principles:
 * - Calm over excitement
 * - Editorial over sales
 * - Architectural over decorative
 * - Confident understatement
 */

export const designSystem = {
  // Typography scale
  typography: {
    hero: "text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.1] text-slate-900",
    h1: "text-3xl md:text-4xl lg:text-5xl font-light tracking-tight leading-tight text-slate-900",
    h2: "text-2xl md:text-3xl lg:text-4xl font-light tracking-tight leading-tight text-slate-900",
    h3: "text-xl md:text-2xl lg:text-3xl font-normal tracking-tight leading-snug text-slate-900",
    h4: "text-lg md:text-xl lg:text-2xl font-normal leading-snug text-slate-900",
    body: "text-base md:text-lg leading-relaxed text-slate-600",
    bodySmall: "text-sm md:text-base leading-relaxed text-slate-600",
    caption: "text-xs md:text-sm font-medium uppercase tracking-[0.2em] text-slate-500",
    label: "text-sm font-medium text-slate-700",
  },

  // Spacing system (consistent multiples of 4)
  spacing: {
    section: "py-16 md:py-24 lg:py-32",
    sectionCompact: "py-12 md:py-16 lg:py-20",
    sectionLarge: "py-20 md:py-32 lg:py-48",
    containerPadding: "px-6 md:px-8 lg:px-12",
    cardGap: "gap-6 md:gap-8 lg:gap-12",
    contentGap: "gap-4 md:gap-6",
    tightGap: "gap-2 md:gap-3",
  },

  // Layout containers
  layout: {
    maxWidth: "max-w-7xl mx-auto",
    maxWidthNarrow: "max-w-5xl mx-auto",
    maxWidthWide: "max-w-[1600px] mx-auto",
    prose: "max-w-3xl mx-auto",
  },

  // Grid systems
  grid: {
    two: "grid grid-cols-1 md:grid-cols-2",
    three: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    four: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
    asymmetric: "grid grid-cols-1 lg:grid-cols-3",
  },

  // Button styles
  buttons: {
    primary: "inline-flex items-center justify-center px-8 py-4 text-base font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors rounded-full",
    secondary: "inline-flex items-center justify-center px-8 py-4 text-base font-medium text-slate-900 bg-white border-2 border-slate-900 hover:bg-slate-50 transition-colors rounded-full",
    tertiary: "inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors",
  },

  // Card styles
  cards: {
    base: "bg-white rounded-2xl overflow-hidden",
    elevated: "bg-white rounded-2xl overflow-hidden shadow-[0_2px_24px_-4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_32px_-4px_rgba(0,0,0,0.1)] transition-shadow duration-300",
    bordered: "bg-white rounded-2xl overflow-hidden border border-slate-200",
    subtle: "bg-slate-50 rounded-2xl overflow-hidden",
  },

  // Colors (minimal palette)
  colors: {
    primary: "slate-900",
    accent: "slate-600",
    muted: "slate-400",
    background: "white",
    surface: "slate-50",
    border: "slate-200",
  },

  // Image aspect ratios
  images: {
    hero: "aspect-[16/9]",
    landscape: "aspect-[4/3]",
    portrait: "aspect-[3/4]",
    square: "aspect-square",
    wide: "aspect-[21/9]",
  },
};

// Reusable component classes
export const components = {
  section: `${designSystem.spacing.section} ${designSystem.layout.maxWidth} ${designSystem.spacing.containerPadding}`,
  sectionNarrow: `${designSystem.spacing.section} ${designSystem.layout.maxWidthNarrow} ${designSystem.spacing.containerPadding}`,
  sectionWide: `${designSystem.spacing.section} ${designSystem.layout.maxWidthWide} ${designSystem.spacing.containerPadding}`,
  
  heroSection: `${designSystem.spacing.sectionLarge} ${designSystem.layout.maxWidth} ${designSystem.spacing.containerPadding}`,
  
  contentSection: `${designSystem.spacing.sectionCompact} ${designSystem.layout.maxWidth} ${designSystem.spacing.containerPadding}`,
};
