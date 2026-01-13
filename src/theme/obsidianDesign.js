// src/theme/obsidianDesign.js
import { materialTheme } from './materialTheme';

// Zugriff auf die M3 Tokens
const t = materialTheme.palette.m3;

/**
 * ADAPTER: OBSIDIAN -> MATERIAL 3
 * Übersetzt alte Design-Tokens in strikte Material Design 3 Werte.
 * Verhindert "bunte" Ausreißer.
 */

export const PALETTE = {
  background: {
    default: t.background,
    paper: t.surfaceContainer,
    glass: t.surfaceContainer, // Kein Glas mehr -> Solid Surface
    glassBorder: 'transparent', // M3 nutzt keine Borders für Tiefe
    lightGlass: t.surfaceContainerHigh, 
  },
  primary: {
    main: t.primary,
    dark: t.onPrimary,
    contrastText: t.onPrimary,
  },
  secondary: {
    main: t.secondary,
    contrastText: t.onSecondary,
  },
  text: {
    primary: t.onSurface,
    secondary: t.onSurfaceVariant,
    muted: t.outline,
  },
  // Mapping der alten "Bunten Farben" auf das M3 Schema
  // Das erzwingt Konsistenz.
  accents: {
    purple: t.tertiary,      // Wird zum tertiären Akzent
    blue: t.secondary,       // Wird zum sekundären Akzent
    green: t.primary,        // Erfolgs-Indikatoren folgen Primary oder Custom Success
    red: t.error,            // Fehler bleiben rot (M3 Error)
    gold: t.tertiaryContainer, // Warnungen nutzen Tertiary Container
    pink: t.tertiary,        
    grey: t.outlineVariant,
    crimson: t.errorContainer
  },
  gradients: {
    // Löschen aller Verläufe. M3 ist Flat/Tonal.
    primary: t.primary, 
    secondary: t.secondary,
    dark: t.background,
    glass: t.surfaceContainer, 
  }
};

// M3 Card Style Definition für Wiederverwendung
const M3_CARD_STYLE = {
    backgroundColor: t.surfaceContainer,
    borderRadius: '16px', // M3 Standard
    border: 'none',
    boxShadow: 'none',
    color: t.onSurface,
    transition: 'background-color 0.2s',
    '&:hover': {
        backgroundColor: t.surfaceContainerHigh, // Hover State Layer
    }
};

export const DESIGN_TOKENS = {
  bottomNavSpacer: {
    pb: '80px', 
    minHeight: '100vh',
    background: t.background,
  },
  container: { maxWidth: 'md', disableGutters: false, sx: { px: 2, pt: 2 } },

  // Text Gradient entfernt -> Plain Text
  textGradient: {
    color: t.onSurface,
    fontWeight: 400,
    background: 'none',
    WebkitBackgroundClip: 'unset',
    WebkitTextFillColor: 'unset',
  },
  
  sectionHeader: {
    fontSize: '14px', // Label Large
    fontWeight: 500,
    letterSpacing: '0.1px',
    textTransform: 'none', // Sentence Case
    color: t.primary,
    mb: 2, mt: 4, 
    display: 'flex', alignItems: 'center', gap: 2,
    '&::after': { 
        content: '""', flex: 1, height: '1px', 
        background: t.outlineVariant 
    }
  },
  
  glassCard: M3_CARD_STYLE,
  
  // Button Gradient entfernt -> Filled Button (Pill)
  buttonGradient: {
    background: t.primary, 
    color: t.onPrimary,
    fontWeight: 500,
    borderRadius: '9999px', // Pill Shape erzwungen
    textTransform: 'none',
    boxShadow: 'none',
    '&:hover': {
      backgroundColor: t.primary, // State Layer wird durch MUI gehandhabt
      boxShadow: 'none',
    },
    '&:disabled': {
        background: t.onSurface + '1F', 
        color: t.onSurface + '61', 
    }
  },

  buttonSecondary: {
    border: `1px solid ${t.outline}`,
    color: t.primary,
    borderRadius: '9999px', // Pill Shape erzwungen
    textTransform: 'none',
    background: 'transparent',
    '&:hover': {
        background: t.primary + '14', 
        borderColor: t.primary
    }
  },

  inputField: {
    '& .MuiOutlinedInput-root': {
        borderRadius: '4px', 
        bgcolor: t.surfaceContainerHighest,
        '& fieldset': { border: 'none' }, 
        '&:hover fieldset': { border: 'none' },
        '&.Mui-focused fieldset': { border: `2px solid ${t.primary}` },
        '& input': { color: t.onSurface }
    },
    '& .MuiInputLabel-root': { color: t.onSurfaceVariant },
    '& .MuiInputLabel-root.Mui-focused': { color: t.primary },
  },

  dialog: {
      paper: {
          sx: {
            borderRadius: '28px', // Extra Large
            bgcolor: t.surfaceContainerHigh,
            backgroundImage: 'none',
            boxShadow: 'none',
          }
      },
      title: { sx: { pb: 2, fontSize: '24px', fontWeight: 400, color: t.onSurface, textAlign: 'center' } },
      content: { sx: { py: 2 }, dividers: false },
      actions: { sx: { p: 3, justifyContent: 'flex-end', gap: 1 } }
  },

  bottomSheet: { sx: { background: t.surfaceContainer, borderRadius: '28px 28px 0 0' } },

  // Accordion -> Expansion Panels (Flat)
  accordion: {
    root: {
      bgcolor: t.surfaceContainerLow,
      backgroundImage: 'none',
      boxShadow: 'none',
      borderRadius: '16px !important',
      marginBottom: 8,
      '&:before': { display: 'none' },
      '&.Mui-expanded': { 
          bgcolor: t.surfaceContainer,
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
        border: 'none',
        fontWeight: 500
    }
  },

  calendar: {
    '.react-calendar': { width: '100%', backgroundColor: 'transparent', border: 'none', fontFamily: 'inherit' },
    '.react-calendar__navigation button': { color: t.onSurface, fontSize: '1rem', fontWeight: 500 },
    '.react-calendar__month-view__weekdays': { textTransform: 'uppercase', fontSize: '0.75rem', color: t.onSurfaceVariant, fontWeight: 500 },
    '.react-calendar__tile': { padding: '10px 0', color: t.onSurface, fontSize: '0.9rem' },
    '.react-calendar__tile:enabled:hover': { backgroundColor: t.surfaceContainerHighest, borderRadius: '20px' }, 
    '.react-calendar__tile--now': { background: 'transparent', border: `1px solid ${t.primary}`, borderRadius: '20px', color: t.primary },
    '.react-calendar__tile--active': { background: `${t.primary} !important`, color: `${t.onPrimary} !important`, borderRadius: '20px' },
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
        container: { background: t.surfaceContainerHighest, color: t.onSurface, borderRadius: '12px', border: 'none' }
    },
    colors: [t.primary, t.secondary, t.tertiary, t.error, t.outline]
};

export const getCategoryColor = () => ({ border: 'transparent', bg: t.surfaceContainerHigh });

export const MOTION = {
    page: { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.3, ease: [0.2, 0.0, 0, 1.0] } },
    listContainer: { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } },
    listItem: { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } },
    tap: { scale: 0.98 },
    pop: { initial: { scale: 0.9, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { type: "spring", stiffness: 300, damping: 25 } }
};