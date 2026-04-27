// src/theme/obsidianDesign.js

import bgLeg from '../assets/bg-leg.jpg';

/**
 * 1. CORE TOKENS - SYNTHETIC SISSY (SHEER NYLON)
 * (Diese liegen hier, um zirkuläre Importe mit materialTheme.js zu verhindern!)
 */
export const m3Tokens = {
  primary: '#FF007F',          
  onPrimary: '#000000',        
  primaryContainer: 'rgba(255, 0, 127, 0.2)', 
  onPrimaryContainer: '#FFB6C1', 
  secondary: '#00E5FF',        
  onSecondary: '#000000',
  secondaryContainer: 'rgba(0, 229, 255, 0.2)',
  onSecondaryContainer: '#CCFFFF',
  tertiary: '#DDA0DD',         
  onTertiary: '#000000',
  tertiaryContainer: 'rgba(221, 160, 221, 0.2)',
  onTertiaryContainer: '#F8E0F8',
  error: '#FF0040',            
  onError: '#FFFFFF',
  errorContainer: 'rgba(255, 0, 64, 0.2)',
  onErrorContainer: '#FFB3C6',
  
  // Base Backgrounds
  background: '#110D10',       
  absoluteBg: '#050505',
  coreGold: '#EBE7E1',
  coreCrimson: '#93000A',
  onBackground: '#FFFFFF',
  surface: '#110D10',
  onSurface: '#FFFFFF',
  onSurfaceVariant: 'rgba(255, 182, 193, 0.8)', 
  
  // Surfaces & Transparencies (SSOT Extension)
  surfaceContainerLow: 'rgba(17, 13, 16, 0.4)',   
  surfaceContainer: 'rgba(17, 13, 16, 0.7)',      
  surfaceContainerHigh: 'rgba(17, 13, 16, 0.85)',  
  surfaceContainerHighest: 'rgba(255, 0, 127, 0.05)', 
  glassSurface: 'rgba(0, 0, 0, 0.4)',
  glassSurfaceHover: 'rgba(5, 5, 5, 0.5)',
  glassSurfaceHeavy: 'rgba(0, 0, 0, 0.6)',
  glassSurfaceBottomSheet: 'rgba(5, 5, 5, 0.75)',
  inputSurface: 'rgba(0, 0, 0, 0.3)',
  
  // Borders (SSOT Extension)
  outline: 'rgba(255, 0, 127, 0.3)', 
  outlineVariant: 'rgba(255, 0, 127, 0.15)',
  glassBorderLight: 'rgba(255, 0, 127, 0.1)',
  glassBorderMedium: 'rgba(255, 0, 127, 0.2)',
  glassBorderStrong: 'rgba(255, 0, 127, 0.25)',
  glassBorderDashed: 'rgba(255, 0, 127, 0.4)',
};

/**
 * 2. PALETTE EXPORT (Nutzt die m3Tokens direkt)
 */
export const PALETTE = {
  background: {
    default: m3Tokens.background,
    paper: m3Tokens.surfaceContainer, 
    glass: m3Tokens.surfaceContainer, 
    glassBorder: m3Tokens.outlineVariant, 
    lightGlass: m3Tokens.surfaceContainerHigh, 
  },
  primary: {
    main: m3Tokens.primary,
    dark: '#CC0066',
    contrastText: m3Tokens.onPrimary,
    glow: 'rgba(255, 0, 127, 0.4)' 
  },
  secondary: {
    main: m3Tokens.secondary,
    contrastText: m3Tokens.onSecondary,
  },
  text: {
    primary: m3Tokens.onSurface,
    secondary: m3Tokens.onSurfaceVariant, 
    muted: 'rgba(255, 182, 193, 0.5)',
  },
  accents: {
    purple: m3Tokens.primary,       
    blue: m3Tokens.secondary,       
    green: m3Tokens.tertiary,       
    red: m3Tokens.error,            
    gold: m3Tokens.coreGold,       
    pink: m3Tokens.primary,         
    grey: m3Tokens.outlineVariant,
    crimson: m3Tokens.coreCrimson
  },
  gradients: {
    primary: m3Tokens.primary, 
    secondary: m3Tokens.secondary,
    dark: m3Tokens.background,
    glass: m3Tokens.surfaceContainer, 
  }
};

/**
 * 3. COMPONENT STYLES & DESIGN TOKENS
 */
const M3_CARD_STYLE = {
    backgroundColor: m3Tokens.glassSurface,
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: `1px solid ${m3Tokens.glassBorderLight}`,
    borderTop: `1px dashed ${m3Tokens.glassBorderStrong}`, 
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)', 
    color: m3Tokens.onSurface,
    transition: 'all 0.3s ease',
    '&:hover': {
        backgroundColor: m3Tokens.glassSurfaceHover,
        borderColor: m3Tokens.outline,
    }
};

export const DESIGN_TOKENS = {
  // Zentrale SSOT Hintergrund-Logik
  bodyBackground: {
    backgroundImage: `
      url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E"),
      linear-gradient(rgba(5, 5, 5, 0.75), rgba(5, 5, 5, 0.92)),
      url(${bgLeg})
    `,
    backgroundAttachment: 'fixed',
    backgroundSize: '3px 3px, cover, cover',
    backgroundPosition: 'top left, center, right center',
    backgroundRepeat: 'repeat, no-repeat, no-repeat',
  },

  bottomNavSpacer: {
    pb: '80px', 
    minHeight: '100vh',
    background: 'transparent',
  },
  container: { maxWidth: 'md', disableGutters: false, sx: { px: 2, pt: 2 } },

  textGradient: {
    background: `linear-gradient(90deg, #FFFFFF 0%, ${m3Tokens.onPrimaryContainer} 100%)`, 
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    color: 'transparent',
    fontWeight: 700,
  },
  
  sectionHeader: {
    fontSize: '14px', 
    fontWeight: 500,
    letterSpacing: '1px',
    textTransform: 'uppercase', 
    color: m3Tokens.primary,
    mb: 2, mt: 4, 
    display: 'flex', alignItems: 'center', gap: 2,
    '&::after': { 
        content: '""', flex: 1, height: '1px', 
        background: `linear-gradient(90deg, ${m3Tokens.primary}40 0%, transparent 100%)` 
    }
  },
  
  glassCard: M3_CARD_STYLE,
  
  buttonGradient: {
    background: `linear-gradient(135deg, ${m3Tokens.primary} 0%, #99004D 40%, #E60073 60%, ${m3Tokens.primary} 100%)`, 
    color: m3Tokens.onPrimary,
    fontWeight: 700,
    borderRadius: '9999px', 
    textTransform: 'uppercase',
    letterSpacing: '1px',
    boxShadow: `inset 0px 2px 4px rgba(255, 255, 255, 0.3), 0 4px 14px rgba(255, 0, 127, 0.5)`, 
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      background: `linear-gradient(135deg, #E60073 0%, #800040 40%, #CC0066 60%, #E60073 100%)`,
      boxShadow: `inset 0px 4px 8px rgba(0, 0, 0, 0.4), 0 6px 20px rgba(255, 0, 127, 0.6)`, 
    },
    '&:disabled': {
        background: m3Tokens.glassBorderLight, 
        color: 'rgba(255, 255, 255, 0.3)', 
        boxShadow: 'none',
        border: `1px dashed ${m3Tokens.glassBorderMedium}`
    }
  },

  buttonSecondary: {
    border: `1px dashed ${m3Tokens.outline}`, 
    color: m3Tokens.primary,
    borderRadius: '9999px', 
    textTransform: 'uppercase',
    letterSpacing: '1px',
    background: 'transparent',
    '&:hover': {
        background: m3Tokens.surfaceContainerHighest, 
        borderColor: m3Tokens.primary,
        boxShadow: `inset 0 0 10px rgba(255, 0, 127, 0.1)`
    }
  },

  inputField: {
    '& .MuiOutlinedInput-root': {
        borderRadius: '8px', 
        bgcolor: m3Tokens.inputSurface,
        '& fieldset': { border: `1px solid ${m3Tokens.outlineVariant}` }, 
        '&:hover fieldset': { borderColor: m3Tokens.outline },
        '&.Mui-focused fieldset': { border: `2px solid ${m3Tokens.primary}` },
        '& input': { color: '#FFFFFF' }
    },
    '& .MuiInputLabel-root': { color: m3Tokens.onSurfaceVariant },
    '& .MuiInputLabel-root.Mui-focused': { color: m3Tokens.primary },
  },

  dropdownMenu: {
    sx: {
      background: m3Tokens.surfaceContainerHigh,
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: `1px solid ${m3Tokens.outlineVariant}`,
      borderTop: `2px dashed ${m3Tokens.primary}`,
      boxShadow: '0 10px 40px rgba(0,0,0,0.9)',
      color: '#FFFFFF',
      backgroundImage: 'none'
    }
  },

  dialog: {
      paper: {
          sx: {
            borderRadius: '28px', 
            background: m3Tokens.glassSurfaceHeavy, 
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${m3Tokens.glassBorderMedium}`,
            borderTop: `2px dashed ${m3Tokens.glassBorderDashed}`, 
            boxShadow: `0 20px 50px rgba(0, 0, 0, 0.8), inset 0 2px 0 rgba(255, 255, 255, 0.05)`,
            backgroundImage: 'none',
          }
      },
      title: { sx: { pb: 2, fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: m3Tokens.primary, textAlign: 'center', letterSpacing: '1px', borderBottom: `1px dashed ${m3Tokens.outlineVariant}` } },
      content: { sx: { py: 3 }, dividers: false },
      actions: { sx: { p: 3, justifyContent: 'space-between', gap: 1, borderTop: `1px dashed ${m3Tokens.outlineVariant}` } }
  },

  bottomSheet: { 
      sx: { 
          background: m3Tokens.glassSurfaceBottomSheet, 
          backdropFilter: 'blur(20px)', 
          WebkitBackdropFilter: 'blur(20px)', 
          borderTop: `1px dashed ${m3Tokens.glassBorderDashed}`, 
          borderRadius: '28px 28px 0 0',
          boxShadow: `0 -10px 30px rgba(0, 0, 0, 0.8), inset 0 2px 0 rgba(255, 0, 127, 0.2)` 
      } 
  },

  accordion: {
    root: {
      bgcolor: m3Tokens.inputSurface,
      backdropFilter: 'blur(12px)',
      border: `1px solid ${m3Tokens.glassBorderLight}`,
      borderLeft: `2px dashed ${m3Tokens.outline}`,
      backgroundImage: 'none',
      boxShadow: 'none',
      borderRadius: '16px !important',
      marginBottom: 8,
      '&:before': { display: 'none' },
      '&.Mui-expanded': { 
          bgcolor: m3Tokens.glassSurfaceHover,
          borderColor: m3Tokens.glassBorderStrong,
          marginBottom: 16 
      },
    },
    details: { padding: 16, color: '#EBE7E1' }
  },

  chip: {
    default: { 
        bgcolor: m3Tokens.glassSurface, 
        color: '#FFFFFF',
        borderRadius: '8px',
        border: '1px dashed ' + m3Tokens.outlineVariant,
        fontWeight: 700,
        height: '32px'
    },
    active: { 
        bgcolor: `linear-gradient(135deg, ${m3Tokens.secondary}40 0%, transparent 100%)`, 
        color: m3Tokens.secondary,
        borderRadius: '8px',
        border: `1px solid ${m3Tokens.secondary}`,
        fontWeight: 700,
        boxShadow: `0 0 10px rgba(0, 229, 255, 0.2)`
    }
  },

  calendar: {
    '.react-calendar': { width: '100%', backgroundColor: 'transparent', border: 'none', fontFamily: 'inherit' },
    '.react-calendar__navigation button': { color: '#FFFFFF', fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase' },
    '.react-calendar__month-view__weekdays': { textTransform: 'uppercase', fontSize: '0.75rem', color: m3Tokens.primary, fontWeight: 700 },
    '.react-calendar__tile': { padding: '10px 0', color: '#FFFFFF', fontSize: '0.9rem' },
    '.react-calendar__tile:enabled:hover': { backgroundColor: m3Tokens.glassBorderLight, borderRadius: '20px' }, 
    '.react-calendar__tile--now': { background: 'transparent', border: `1px dashed ${m3Tokens.primary}`, borderRadius: '20px', color: m3Tokens.primary },
    '.react-calendar__tile--active': { background: `${m3Tokens.primary} !important`, color: `${m3Tokens.onPrimary} !important`, borderRadius: '20px', boxShadow: `0 0 15px ${m3Tokens.primary}80` },
  }
};

export const CHART_THEME = {
    background: 'transparent',
    textColor: '#FFFFFF',
    grid: { line: { stroke: m3Tokens.outlineVariant, strokeWidth: 1, strokeDasharray: '2 4' } }, 
    axis: { 
        domain: { line: { stroke: 'transparent' } }, 
        ticks: { text: { fill: '#FFFFFF', fontSize: 11 } } 
    },
    tooltip: {
        container: { background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(12px)', color: '#FFFFFF', borderRadius: '12px', border: `1px dashed ${m3Tokens.outlineDashed}` }
    },
    colors: [m3Tokens.primary, m3Tokens.secondary, m3Tokens.tertiary, m3Tokens.error, m3Tokens.outline]
};

export const getCategoryColor = () => ({ border: 'transparent', bg: m3Tokens.glassBorderLight });

export const MOTION = {
    page: { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.3, ease: [0.2, 0.0, 0, 1.0] } },
    listContainer: { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } },
    listItem: { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } },
    tap: { scale: 0.98 },
    pop: { initial: { scale: 0.9, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { type: "spring", stiffness: 300, damping: 25 } }
};