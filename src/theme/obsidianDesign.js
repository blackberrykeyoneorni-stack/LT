// src/theme/obsidianDesign.js

/**
 * 1. CORE TOKENS - SYNTHETIC SISSY (SHEER NYLON)
 * (Diese liegen nun hier, um zirkuläre Importe mit materialTheme.js zu verhindern!)
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
  background: '#110D10',       
  onBackground: '#FFFFFF',
  surface: '#110D10',
  onSurface: '#FFFFFF',
  onSurfaceVariant: 'rgba(255, 182, 193, 0.8)', 
  surfaceContainerLow: 'rgba(17, 13, 16, 0.4)',   
  surfaceContainer: 'rgba(17, 13, 16, 0.7)',      
  surfaceContainerHigh: 'rgba(17, 13, 16, 0.85)',  
  surfaceContainerHighest: 'rgba(255, 0, 127, 0.05)', 
  outline: 'rgba(255, 0, 127, 0.3)', 
  outlineVariant: 'rgba(255, 0, 127, 0.15)',
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
    gold: m3Tokens.secondary,       
    pink: m3Tokens.primary,         
    grey: m3Tokens.outlineVariant,
    crimson: m3Tokens.errorContainer
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
    backgroundColor: 'rgba(17, 13, 16, 0.65)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 0, 127, 0.20)', 
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(255, 0, 127, 0.1)', 
    color: m3Tokens.onSurface,
    transition: 'all 0.3s ease',
    '&:hover': {
        backgroundColor: 'rgba(17, 13, 16, 0.80)',
        borderColor: 'rgba(255, 0, 127, 0.40)',
    }
};

export const DESIGN_TOKENS = {
  bottomNavSpacer: {
    pb: '80px', 
    minHeight: '100vh',
    background: 'transparent',
  },
  container: { maxWidth: 'md', disableGutters: false, sx: { px: 2, pt: 2 } },

  textGradient: {
    background: `linear-gradient(90deg, ${m3Tokens.primary} 0%, ${m3Tokens.secondary} 100%)`, 
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
    background: m3Tokens.primary, 
    color: m3Tokens.onPrimary,
    fontWeight: 700,
    borderRadius: '9999px', 
    textTransform: 'uppercase',
    letterSpacing: '1px',
    boxShadow: `0 4px 14px rgba(255, 0, 127, 0.4)`, 
    '&:hover': {
      backgroundColor: m3Tokens.primary, 
      boxShadow: `0 6px 20px rgba(255, 0, 127, 0.6)`,
    },
    '&:disabled': {
        background: m3Tokens.onSurface + '1F', 
        color: m3Tokens.onSurface + '61', 
        boxShadow: 'none'
    }
  },

  buttonSecondary: {
    border: `1px solid ${m3Tokens.outline}`,
    color: m3Tokens.primary,
    borderRadius: '9999px', 
    textTransform: 'uppercase',
    letterSpacing: '1px',
    background: 'transparent',
    '&:hover': {
        background: m3Tokens.primary + '14', 
        borderColor: m3Tokens.primary,
        boxShadow: `0 0 10px rgba(255, 0, 127, 0.2)`
    }
  },

  inputField: {
    '& .MuiOutlinedInput-root': {
        borderRadius: '8px', 
        bgcolor: m3Tokens.surfaceContainerHighest,
        '& fieldset': { border: `1px solid ${m3Tokens.outlineVariant}` }, 
        '&:hover fieldset': { borderColor: m3Tokens.outline },
        '&.Mui-focused fieldset': { border: `2px solid ${m3Tokens.primary}` },
        '& input': { color: m3Tokens.onSurface }
    },
    '& .MuiInputLabel-root': { color: m3Tokens.onSurfaceVariant },
    '& .MuiInputLabel-root.Mui-focused': { color: m3Tokens.primary },
  },

  dialog: {
      paper: {
          sx: {
            borderRadius: '28px', 
            background: 'rgba(17, 13, 16, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: `1px solid rgba(255, 0, 127, 0.3)`,
            boxShadow: `0 0 40px rgba(255, 0, 127, 0.15)`,
            backgroundImage: 'none',
          }
      },
      title: { sx: { pb: 2, fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: m3Tokens.primary, textAlign: 'center', letterSpacing: '1px', borderBottom: `1px solid rgba(255, 0, 127, 0.1)` } },
      content: { sx: { py: 3 }, dividers: false },
      actions: { sx: { p: 3, justifyContent: 'space-between', gap: 1, borderTop: `1px solid rgba(255, 0, 127, 0.1)` } }
  },

  bottomSheet: { sx: { background: 'rgba(17, 13, 16, 0.90)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderTop: `1px solid rgba(255, 0, 127, 0.3)`, borderRadius: '28px 28px 0 0' } },

  accordion: {
    root: {
      bgcolor: 'rgba(17, 13, 16, 0.5)',
      backdropFilter: 'blur(8px)',
      border: `1px solid rgba(255, 0, 127, 0.1)`,
      backgroundImage: 'none',
      boxShadow: 'none',
      borderRadius: '16px !important',
      marginBottom: 8,
      '&:before': { display: 'none' },
      '&.Mui-expanded': { 
          bgcolor: 'rgba(17, 13, 16, 0.7)',
          borderColor: `rgba(255, 0, 127, 0.3)`,
          marginBottom: 16 
      },
    },
    details: { padding: 16, color: m3Tokens.onSurfaceVariant }
  },

  chip: {
    default: { 
        bgcolor: m3Tokens.surfaceContainerHighest, 
        color: m3Tokens.onSurfaceVariant,
        borderRadius: '8px',
        border: '1px solid ' + m3Tokens.outlineVariant,
        fontWeight: 500
    },
    active: { 
        bgcolor: m3Tokens.secondaryContainer, 
        color: m3Tokens.onSecondaryContainer,
        borderRadius: '8px',
        border: `1px solid ${m3Tokens.secondary}`,
        fontWeight: 700,
        boxShadow: `0 0 10px rgba(0, 229, 255, 0.3)`
    }
  },

  calendar: {
    '.react-calendar': { width: '100%', backgroundColor: 'transparent', border: 'none', fontFamily: 'inherit' },
    '.react-calendar__navigation button': { color: m3Tokens.onSurface, fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase' },
    '.react-calendar__month-view__weekdays': { textTransform: 'uppercase', fontSize: '0.75rem', color: m3Tokens.primary, fontWeight: 700 },
    '.react-calendar__tile': { padding: '10px 0', color: m3Tokens.onSurface, fontSize: '0.9rem' },
    '.react-calendar__tile:enabled:hover': { backgroundColor: m3Tokens.surfaceContainerHighest, borderRadius: '20px' }, 
    '.react-calendar__tile--now': { background: 'transparent', border: `1px dashed ${m3Tokens.primary}`, borderRadius: '20px', color: m3Tokens.primary },
    '.react-calendar__tile--active': { background: `${m3Tokens.primary} !important`, color: `${m3Tokens.onPrimary} !important`, borderRadius: '20px', boxShadow: `0 0 15px ${m3Tokens.primary}80` },
  }
};

export const CHART_THEME = {
    background: 'transparent',
    textColor: m3Tokens.onSurfaceVariant,
    grid: { line: { stroke: m3Tokens.outlineVariant, strokeWidth: 1, strokeDasharray: '4 4' } },
    axis: { 
        domain: { line: { stroke: 'transparent' } }, 
        ticks: { text: { fill: m3Tokens.onSurfaceVariant, fontSize: 11 } } 
    },
    tooltip: {
        container: { background: 'rgba(17, 13, 16, 0.9)', backdropFilter: 'blur(8px)', color: m3Tokens.onSurface, borderRadius: '12px', border: `1px solid ${m3Tokens.primary}40` }
    },
    colors: [m3Tokens.primary, m3Tokens.secondary, m3Tokens.tertiary, m3Tokens.error, m3Tokens.outline]
};

export const getCategoryColor = () => ({ border: 'transparent', bg: 'rgba(255, 0, 127, 0.1)' });

export const MOTION = {
    page: { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.3, ease: [0.2, 0.0, 0, 1.0] } },
    listContainer: { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } },
    listItem: { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } },
    tap: { scale: 0.98 },
    pop: { initial: { scale: 0.9, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { type: "spring", stiffness: 300, damping: 25 } }
};