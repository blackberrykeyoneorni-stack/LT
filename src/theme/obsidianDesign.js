import { createTheme } from '@mui/material';

// --- 1. CORE PALETTE ---
export const PALETTE = {
  background: {
    default: '#050505', 
    paper: '#121212',   
    glass: 'rgba(255, 255, 255, 0.03)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
  },
  primary: {
    main: '#E6C2BF', // Champagne Gold
    light: '#F3E5E4',
    dark: '#B3908D',
    contrastText: '#000000',
  },
  secondary: {
    main: '#546E7A', // Slate Grey
    light: '#819CA9',
    dark: '#29434E',
  },
  // NEU: Text-Definition hier zentral, damit andere Dateien darauf zugreifen können
  text: {
    primary: '#E0E0E0',
    secondary: 'rgba(255, 255, 255, 0.6)',
    disabled: 'rgba(255, 255, 255, 0.3)'
  },
  accents: {
    gold: '#ffb74d',  
    pink: '#f48fb1',  
    purple: '#ce93d8', 
    red: '#e57373',   
    crimson: '#d32f2f', 
    blue: '#90caf9',  
    green: '#a5d6a7', 
    successDark: '#388e3c'
  }
};

// --- 2. DESIGN TOKENS (Styles) ---
export const DESIGN_TOKENS = {
  textGradient: {
    background: `linear-gradient(45deg, ${PALETTE.accents.pink} 30%, ${PALETTE.accents.purple} 90%)`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontWeight: 'bold',
  },
  buttonGradient: {
    background: `linear-gradient(45deg, ${PALETTE.primary.main} 30%, #D8A4A4 90%)`,
    color: '#000',
  },
  glassCard: {
    backgroundImage: 'none',
    backgroundColor: PALETTE.background.glass,
    backdropFilter: 'blur(10px)',
    border: `1px solid ${PALETTE.background.glassBorder}`,
    borderRadius: '10px', 
  },
  bottomNavSpacer: {
    pb: 10,
  },
  chartColors: [
    PALETTE.accents.pink, 
    PALETTE.accents.purple, 
    PALETTE.accents.blue, 
    PALETTE.accents.green, 
    PALETTE.accents.gold, 
    PALETTE.accents.red
  ]
};

// --- 3. ANIMATIONS ---
export const ANIMATIONS = {
    pageTransition: {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
        transition: { duration: 0.3 }
    },
    staggerContainer: {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    },
    listItem: {
        hidden: { opacity: 0, x: -20 },
        show: { opacity: 1, x: 0 }
    },
    pop: {
        initial: { scale: 0 },
        animate: { scale: 1 },
        exit: { scale: 0 },
        transition: { type: "spring", stiffness: 300, damping: 20 }
    }
};

// --- 4. HELPER FUNCTIONS ---
export const getCategoryColor = (categoryName) => {
    const c = (categoryName || '').toLowerCase();
    if(c.match(/nylon|strumpf/)) return { bg: `${PALETTE.accents.gold}1A`, border: PALETTE.accents.gold }; 
    if(c.match(/bh|slip|dessous/)) return { bg: `${PALETTE.accents.pink}1A`, border: PALETTE.accents.pink };
    return { bg: PALETTE.background.glass, border: 'rgba(255,255,255,0.1)' };
};

export const getScoreColor = (score) => {
    if (score >= 80) return PALETTE.accents.crimson; 
    if (score >= 50) return '#f57c00'; 
    if (score >= 20) return '#fbc02d'; 
    return PALETTE.accents.successDark; 
};

// --- 5. MUI THEME ---
export const getObsidianTheme = () => createTheme({
  palette: {
    mode: 'dark',
    primary: PALETTE.primary,
    secondary: PALETTE.secondary,
    // WICHTIG: Accents ins Theme injizieren für Zugriff via useTheme
    accents: PALETTE.accents,
    error: { main: '#990000', light: '#D32F2F' },
    success: { main: '#80CBC4' },
    background: {
      default: PALETTE.background.default,
      paper: PALETTE.background.paper,
      glass: PALETTE.background.glass
    },
    // Hier nutzen wir nun die zentrale PALETTE Definition
    text: PALETTE.text,
  },
  typography: {
    fontFamily: '"Montserrat", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: '"Playfair Display", serif', fontWeight: 600 },
    h2: { fontFamily: '"Playfair Display", serif', fontWeight: 600 },
    h3: { fontFamily: '"Playfair Display", serif', fontWeight: 600 },
    h4: { fontFamily: '"Playfair Display", serif', fontWeight: 600, letterSpacing: '0.03em' },
    h5: { fontFamily: '"Playfair Display", serif', fontWeight: 500 },
    h6: { fontFamily: '"Playfair Display", serif', fontWeight: 500 },
    subtitle1: { letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.75rem' },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.02em' },
  },
  shape: { borderRadius: 10 }, 
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, 
          padding: '10px 20px',
          boxShadow: 'none',
          '&:hover': { boxShadow: `0 4px 12px ${PALETTE.primary.main}33` },
        },
        containedPrimary: { background: DESIGN_TOKENS.buttonGradient.background },
      },
    },
    MuiPaper: { styleOverrides: { root: { ...DESIGN_TOKENS.glassCard } } },
    MuiAppBar: { styleOverrides: { root: { backgroundColor: 'rgba(5, 5, 5, 0.8)', backdropFilter: 'blur(12px)', boxShadow: 'none', borderBottom: `1px solid ${PALETTE.background.glassBorder}` } } },
    MuiChip: {
      styleOverrides: {
        root: { border: '1px solid rgba(255, 255, 255, 0.2)', backgroundColor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(6px)', color: '#FFFFFF', fontWeight: 600 },
        colorPrimary: { color: '#FFFFFF', backgroundColor: `${PALETTE.primary.main}33`, border: `1px solid ${PALETTE.primary.main}4D` },
        colorInfo: { color: '#FFFFFF', backgroundColor: `${PALETTE.accents.blue}33`, border: `1px solid ${PALETTE.accents.blue}4D` },
        colorWarning: { color: '#FFFFFF', backgroundColor: `${PALETTE.accents.gold}33`, border: `1px solid ${PALETTE.accents.gold}4D` },
        colorError: { color: '#FFFFFF', backgroundColor: `${PALETTE.accents.red}33`, border: `1px solid ${PALETTE.accents.red}4D` },
        colorSuccess: { color: '#FFFFFF', backgroundColor: `${PALETTE.accents.green}33`, border: `1px solid ${PALETTE.accents.green}4D` }
      },
    },
    MuiBottomNavigation: { styleOverrides: { root: { backgroundColor: 'rgba(18, 18, 18, 0.9)', backdropFilter: 'blur(10px)', borderTop: `1px solid ${PALETTE.background.glassBorder}` } } },
    MuiDialogPaper: { styleOverrides: { root: { backgroundColor: '#0A0A0A', border: `1px solid ${PALETTE.primary.main}33`, borderRadius: 12 } } }
  },
});
