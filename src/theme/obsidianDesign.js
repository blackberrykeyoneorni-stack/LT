// src/theme/obsidianDesign.js
import { materialTheme } from './materialTheme';

// Zugriff auf die M3 Tokens
const t = materialTheme.palette.m3;

/**
 * ADAPTER: OBSIDIAN -> MATERIAL 3 (SYNTHETIC SISSY EDITION)
 * Übersetzt Design-Tokens in die "Sheer Nylon" Ästhetik.
 * Nutzt Glassmorphismus und harte Neon-Kontraste.
 */

export const PALETTE = {
  background: {
    default: t.background,
    paper: 'rgba(17, 13, 16, 0.70)', // Sheer Nylon Background
    glass: 'rgba(17, 13, 16, 0.65)', // Glassmorphism Base
    glassBorder: 'rgba(255, 0, 127, 0.20)', // Sheer pink seam
    lightGlass: 'rgba(17, 13, 16, 0.85)', // Tighter Nylon weave
  },
  primary: {
    main: t.primary,
    dark: t.onPrimary,
    contrastText: t.onPrimary,
    glow: 'rgba(255, 0, 127, 0.4)' // Matte Neon Pink Glow
  },
  secondary: {
    main: t.secondary,
    contrastText: t.onSecondary,
  },
  text: {
    primary: t.onSurface,
    secondary: t.onSurfaceVariant, // Soft Sissy Pink
    muted: 'rgba(255, 182, 193, 0.5)',
  },
  accents: {
    purple: t.primary,       // Hot Pink für intense Highlights
    blue: t.secondary,       // Synthetic Cyan
    green: t.tertiary,       // Submissive Lavender
    red: t.error,            // Vulgar Red
    gold: t.secondary,       // Mapped to Synthetic Cyan
    pink: t.primary,         // Bimbo Pink
    grey: t.outlineVariant,
    crimson: t.errorContainer
  },
  gradients: {
    primary: t.primary, 
    secondary: t.secondary,
    dark: t.background,
    glass: 'rgba(17, 13, 16, 0.70)', 
  }
};

// Sissy Card Style: Glassmorphismus, Blur und Neon-Naht
const M3_CARD_STYLE = {
    backgroundColor: 'rgba(17, 13, 16, 0.65)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)', // iOS Support
    border: '1px solid rgba(255, 0, 127, 0.20)', // Sheer pink seam
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(255, 0, 127, 0.1)', // Diffuse pink glow
    color: t.onSurface,
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

  // Text Gradient: Bimbo Pink zu Synthetic Cyan
  textGradient: {
    background: `linear-gradient(90deg, ${t.primary} 0%, ${t.secondary} 100%)`, 
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
    textTransform: 'uppercase', // Sissy Ästhetik verlangt etwas mehr Dominanz im Text
    color: t.primary,
    mb: 2, mt: 4, 
    display: 'flex', alignItems: 'center', gap: 2,
    '&::after': { 
        content: '""', flex: 1, height: '1px', 
        background: `linear-gradient(90deg, ${t.primary}40 0%, transparent 100%)` 
    }
  },
  
  glassCard: M3_CARD_STYLE,
  
  buttonGradient: {
    background: t.primary, 
    color: t.onPrimary,
    fontWeight: 700,
    borderRadius: '9999px', 
    textTransform: 'uppercase',
    letterSpacing: '1px',
    boxShadow: `0 4px 14px rgba(255, 0, 127, 0.4)`, // Neon Glow
    '&:hover': {
      backgroundColor: t.primary, 
      boxShadow: `0 6px 20px rgba(255, 0, 127, 0.6)`,
    },
    '&:disabled': {
        background: t.onSurface + '1F', 
        color: t.onSurface + '61', 
        boxShadow: 'none'
    }
  },

  buttonSecondary: {
    border: `1px solid ${t.outline}`,
    color: t.primary,
    borderRadius: '9999px', 
    textTransform: 'uppercase',
    letterSpacing: '1px',
    background: 'transparent',
    '&:hover': {
        background: t.primary + '14', 
        borderColor: t.primary,
        boxShadow: `0 0 10px rgba(255, 0, 127, 0.2)`
    }
  },

  inputField: {
    '& .MuiOutlinedInput-root': {
        borderRadius: '8px', 
        bgcolor: t.surfaceContainerHighest,
        '& fieldset': { border: `1px solid ${t.outlineVariant}` }, 
        '&:hover fieldset': { borderColor: t.outline },
        '&.Mui-focused fieldset': { border: `2px solid ${t.primary}` },
        '& input': { color: t.onSurface }
    },
    '& .MuiInputLabel-root': { color: t.onSurfaceVariant },
    '& .MuiInputLabel-root.Mui-focused': { color: t.primary },
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
      title: { sx: { pb: 2, fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: t.primary, textAlign: 'center', letterSpacing: '1px', borderBottom: `1px solid rgba(255, 0, 127, 0.1)` } },
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
    details: { padding: 16, color: t.onSurfaceVariant }
  },

  chip: {
    default: { 
        bgcolor: t.surfaceContainerHighest, 
        color: t.onSurfaceVariant,
        borderRadius: '8px',
        border: '1px solid ' + t.outlineVariant,
        fontWeight: 500
    },
    active: { 
        bgcolor: t.secondaryContainer, 
        color: t.onSecondaryContainer,
        borderRadius: '8px',
        border: `1px solid ${t.secondary}`,
        fontWeight: 700,
        boxShadow: `0 0 10px rgba(0, 229, 255, 0.3)`
    }
  },

  calendar: {
    '.react-calendar': { width: '100%', backgroundColor: 'transparent', border: 'none', fontFamily: 'inherit' },
    '.react-calendar__navigation button': { color: t.onSurface, fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase' },
    '.react-calendar__month-view__weekdays': { textTransform: 'uppercase', fontSize: '0.75rem', color: t.primary, fontWeight: 700 },
    '.react-calendar__tile': { padding: '10px 0', color: t.onSurface, fontSize: '0.9rem' },
    '.react-calendar__tile:enabled:hover': { backgroundColor: t.surfaceContainerHighest, borderRadius: '20px' }, 
    '.react-calendar__tile--now': { background: 'transparent', border: `1px dashed ${t.primary}`, borderRadius: '20px', color: t.primary },
    '.react-calendar__tile--active': { background: `${t.primary} !important`, color: `${t.onPrimary} !important`, borderRadius: '20px', boxShadow: `0 0 15px ${t.primary}80` },
  }
};

export const CHART_THEME = {
    background: 'transparent',
    textColor: t.onSurfaceVariant,
    grid: { line: { stroke: t.outlineVariant, strokeWidth: 1, strokeDasharray: '4 4' } },
    axis: { 
        domain: { line: { stroke: 'transparent' } }, 
        ticks: { text: { fill: t.onSurfaceVariant, fontSize: 11 } } 
    },
    tooltip: {
        container: { background: 'rgba(17, 13, 16, 0.9)', backdropFilter: 'blur(8px)', color: t.onSurface, borderRadius: '12px', border: `1px solid ${t.primary}40` }
    },
    colors: [t.primary, t.secondary, t.tertiary, t.error, t.outline]
};

export const getCategoryColor = () => ({ border: 'transparent', bg: 'rgba(255, 0, 127, 0.1)' });

export const MOTION = {
    page: { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.3, ease: [0.2, 0.0, 0, 1.0] } },
    listContainer: { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } },
    listItem: { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } },
    tap: { scale: 0.98 },
    pop: { initial: { scale: 0.9, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { type: "spring", stiffness: 300, damping: 25 } }
};