// src/theme/obsidianDesign.js

// --- 1. ATOMIC COLORS & PALETTE ---
export const PALETTE = {
  background: {
    default: '#000000', // Deep Black
    paper: '#121212',   // Obsidian Base
    glass: 'rgba(20, 20, 20, 0.6)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    lightGlass: 'rgba(255, 255, 255, 0.05)',
  },
  primary: {
    main: '#00e5ff',    // Cyan/Electric Blue
    dark: '#00b2cc',
    contrastText: '#000',
  },
  secondary: {
    main: '#ff0055',    // Neon Pink/Red
    contrastText: '#fff',
  },
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.7)',
    muted: 'rgba(255, 255, 255, 0.5)',
  },
  accents: {
    purple: '#bf5af2',
    blue: '#0a84ff',
    green: '#30d158',
    red: '#ff453a',
    gold: '#ffd60a',
    pink: '#ff375f',
    grey: '#8e8e93',
    crimson: '#d32f2f'
  },
  gradients: {
    primary: 'linear-gradient(135deg, #00e5ff 0%, #2979ff 100%)',
    secondary: 'linear-gradient(135deg, #ff0055 0%, #ff375f 100%)',
    dark: 'linear-gradient(180deg, rgba(20,20,20,0.95) 0%, rgba(0,0,0,0.98) 100%)',
    glass: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
  }
};

// --- 2. CORE SHAPES & EFFECTS ---
const EFFECTS = {
  glass: {
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    backgroundColor: PALETTE.background.glass,
    border: `1px solid ${PALETTE.background.glassBorder}`,
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
  },
  glassCard: {
    background: 'rgba(25, 25, 25, 0.6)', 
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: `1px solid rgba(255, 255, 255, 0.05)`,
    borderRadius: '16px',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
  },
  glow: (color) => ({
    boxShadow: `0 0 10px ${color}40, 0 0 20px ${color}20`,
  }),
};

// --- 3. COMPONENT PRESETS (The "Classes") ---
export const DESIGN_TOKENS = {
  // Layout
  bottomNavSpacer: {
    pb: '80px', 
    minHeight: '100vh',
    background: 'radial-gradient(circle at 50% -20%, #1a1a1a 0%, #000000 100%)',
  },
  container: {
    maxWidth: 'md',
    disableGutters: false,
    sx: { px: 2, pt: 2 }
  },

  // Typography
  textGradient: {
    background: `linear-gradient(45deg, ${PALETTE.text.primary} 30%, ${PALETTE.primary.main} 90%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontWeight: 800,
    letterSpacing: '-0.5px',
  },
  sectionHeader: {
    fontSize: '1.1rem',
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: PALETTE.text.muted,
    mb: 2,
    mt: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    '&::after': {
      content: '""',
      flex: 1,
      height: '1px',
      background: `linear-gradient(90deg, ${PALETTE.background.glassBorder}, transparent)`,
    }
  },
  
  // Cards
  glassCard: {
    ...EFFECTS.glassCard,
    overflow: 'hidden',
    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s',
    '&:hover': {
      transform: 'translateY(-2px)',
      borderColor: 'rgba(255, 255, 255, 0.15)',
    }
  },
  
  // Buttons
  buttonGradient: {
    background: PALETTE.gradients.primary,
    color: '#000',
    fontWeight: 'bold',
    borderRadius: '12px',
    textTransform: 'none',
    boxShadow: '0 4px 15px rgba(0, 229, 255, 0.3)',
    transition: 'all 0.2s',
    '&:hover': {
      boxShadow: '0 6px 20px rgba(0, 229, 255, 0.4)',
      transform: 'scale(1.02)',
    },
    '&:disabled': {
        background: 'rgba(255,255,255,0.1)',
        color: 'rgba(255,255,255,0.3)',
        boxShadow: 'none'
    }
  },
  buttonSecondary: {
    border: `1px solid ${PALETTE.background.glassBorder}`,
    color: PALETTE.text.primary,
    borderRadius: '12px',
    textTransform: 'none',
    '&:hover': {
        background: 'rgba(255,255,255,0.05)',
        borderColor: PALETTE.text.secondary
    }
  },

  // Inputs & Forms (wiederhergestellt)
  inputField: {
    '& .MuiOutlinedInput-root': {
        borderRadius: '12px',
        bgcolor: 'rgba(255,255,255,0.02)',
        '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
        '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
        '&.Mui-focused fieldset': { borderColor: PALETTE.primary.main },
    },
    '& .MuiInputLabel-root': { color: PALETTE.text.secondary },
    '& .MuiInputLabel-root.Mui-focused': { color: PALETTE.primary.main },
  },

  // Dialogs (Zentralisiert)
  dialog: {
      paper: {
          sx: {
            ...EFFECTS.glass,
            borderRadius: '24px',
            bgcolor: 'rgba(18, 18, 18, 0.95)',
            border: `1px solid ${PALETTE.background.glassBorder}`,
            backgroundImage: 'none',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          }
      },
      title: {
          sx: {
              borderBottom: `1px solid ${PALETTE.background.glassBorder}`,
              pb: 2,
              display: 'flex', 
              alignItems: 'center', 
              gap: 1.5,
              fontSize: '1.2rem',
              fontWeight: 600
          }
      },
      content: {
          sx: { py: 3 },
          dividers: true
      },
      actions: {
          sx: {
              borderTop: `1px solid ${PALETTE.background.glassBorder}`,
              p: 2,
              gap: 1
          }
      }
  },

  // Sheets
  bottomSheet: {
    sx: {
        ...EFFECTS.glass,
        background: '#121212', 
        borderTop: `1px solid ${PALETTE.primary.main}`,
        borderRadius: '24px 24px 0 0',
        maxHeight: '90vh',
    }
  },

  // Accordion
  accordion: {
    root: {
      bgcolor: 'transparent',
      backgroundImage: 'none',
      boxShadow: 'none',
      border: `1px solid ${PALETTE.background.glassBorder}`,
      borderRadius: '12px !important',
      marginBottom: 2,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
      '&:before': { display: 'none' },
      '&.Mui-expanded': {
        margin: '0 0 16px 0',
        borderColor: PALETTE.primary.main, 
        backgroundColor: 'rgba(0, 229, 255, 0.03)', 
      },
    },
    details: {
       borderTop: `1px solid ${PALETTE.background.glassBorder}`,
       padding: 2,
    }
  },

  // Chips
  chip: {
    default: {
        bgcolor: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: PALETTE.text.primary,
    },
    active: {
        bgcolor: `${PALETTE.primary.main}22`,
        border: `1px solid ${PALETTE.primary.main}`,
        color: PALETTE.primary.main,
    }
  },

  // Calendar Styles (NEU)
  calendar: {
    '.react-calendar': { 
        width: '100%', backgroundColor: 'transparent', border: 'none', fontFamily: 'inherit' 
    },
    '.react-calendar__navigation': { 
        height: 'auto', marginBottom: '1rem', display: 'flex', alignItems: 'center' 
    },
    '.react-calendar__navigation button': { 
        color: PALETTE.primary.main, minWidth: '44px', background: 'none', fontSize: '1.2rem', fontWeight: 800, textTransform: 'capitalize' 
    },
    '.react-calendar__navigation button:disabled': { backgroundColor: 'transparent', color: PALETTE.text.muted },
    '.react-calendar__navigation button:enabled:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: 8 },
    '.react-calendar__month-view__weekdays': { 
        textAlign: 'center', textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.75rem', color: PALETTE.text.muted, marginBottom: '0.5rem', textDecoration: 'none' 
    },
    '.react-calendar__month-view__weekdays__weekday': { padding: '0.5rem', abbr: { textDecoration: 'none' } },
    '.react-calendar__tile': { 
        padding: '1rem 0.5rem', background: 'none', textAlign: 'center', lineHeight: '16px', color: '#fff', fontSize: '0.9rem', position: 'relative', overflow: 'visible', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', height: '80px' 
    },
    '.react-calendar__tile:enabled:hover': { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px' },
    '.react-calendar__tile--now': { 
        background: 'transparent', border: `1px solid ${PALETTE.accents.gold}`, borderRadius: '12px', color: PALETTE.accents.gold 
    },
    '.react-calendar__tile--active': { 
        background: `${PALETTE.primary.main} !important`, color: '#000 !important', borderRadius: '12px', fontWeight: 'bold' 
    },
  }
};

// --- 4. UTILITY FUNCTIONS & THEMES ---
export const CHART_THEME = {
    background: 'transparent',
    textColor: PALETTE.text.secondary,
    grid: {
        line: { stroke: PALETTE.background.glassBorder, strokeWidth: 1 }
    },
    axis: {
        domain: { line: { stroke: 'transparent' } },
        ticks: { text: { fill: PALETTE.text.muted, fontSize: 10 } }
    },
    tooltip: {
        container: {
            background: '#121212',
            color: '#fff',
            fontSize: '12px',
            borderRadius: '8px',
            border: `1px solid ${PALETTE.background.glassBorder}`,
            boxShadow: '0 8px 16px rgba(0,0,0,0.5)'
        }
    },
    colors: [PALETTE.primary.main, PALETTE.accents.purple, PALETTE.accents.pink, PALETTE.accents.green, PALETTE.accents.gold]
};

export const getCategoryColor = (category) => {
    const map = {
        'Halsband': { border: PALETTE.accents.gold, bg: `${PALETTE.accents.gold}15` },
        'Cuffs': { border: PALETTE.accents.grey, bg: `${PALETTE.accents.grey}15` },
        'Keuschheit': { border: PALETTE.accents.pink, bg: `${PALETTE.accents.pink}15` },
        'Toys': { border: PALETTE.accents.purple, bg: `${PALETTE.accents.purple}15` },
        'Nylons': { border: PALETTE.primary.main, bg: `${PALETTE.primary.main}15` },
        'Accessoires': { border: PALETTE.accents.green, bg: `${PALETTE.accents.green}15` },
    };
    return map[category] || { border: 'rgba(255,255,255,0.1)', bg: 'rgba(255,255,255,0.02)' };
};

export const MOTION = {
    page: {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
        transition: { duration: 0.3 }
    },
    listContainer: {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.08 }
        }
    },
    listItem: {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    },
    tap: { scale: 0.98 },
    pop: {
        initial: { scale: 0 },
        animate: { scale: 1 },
        exit: { scale: 0 },
        transition: { type: "spring", stiffness: 300, damping: 20 }
    }
};