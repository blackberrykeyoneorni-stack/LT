import { createTheme } from '@mui/material/styles';

/**
 * ANDROID 16 / MATERIAL DESIGN 3 - SYNTHETIC SISSY (SHEER NYLON)
 * Integriert die Sissy/Bimbo Farbpalette exakt in die M3-Token-Struktur.
 */

const m3Tokens = {
  // PRIMARY: Bimbo Pink / Hot Pink
  primary: '#FF007F',          
  onPrimary: '#000000',        // Maximaler Kontrast (Schwarz auf Pink)
  primaryContainer: 'rgba(255, 0, 127, 0.2)', 
  onPrimaryContainer: '#FFB6C1', 

  // SECONDARY: Synthetic Cyan
  secondary: '#00E5FF',        
  onSecondary: '#000000',
  secondaryContainer: 'rgba(0, 229, 255, 0.2)',
  onSecondaryContainer: '#CCFFFF',

  // TERTIARY: Submissive Lavender
  tertiary: '#DDA0DD',         
  onTertiary: '#000000',
  tertiaryContainer: 'rgba(221, 160, 221, 0.2)',
  onTertiaryContainer: '#F8E0F8',

  // ERROR: Vulgar Red
  error: '#FF0040',            
  onError: '#FFFFFF',
  errorContainer: 'rgba(255, 0, 64, 0.2)',
  onErrorContainer: '#FFB3C6',

  // SURFACES: Denier Black (Nylon-Optik)
  background: '#110D10',       // Tiefes, fast schwarzes Nylon
  onBackground: '#FFFFFF',
  surface: '#110D10',
  onSurface: '#FFFFFF',
  onSurfaceVariant: 'rgba(255, 182, 193, 0.8)', // Sissy Pink für Sekundärtexte
  
  // SURFACE CONTAINER (Für Glassmorphismus vorbereitet)
  surfaceContainerLow: 'rgba(17, 13, 16, 0.4)',   
  surfaceContainer: 'rgba(17, 13, 16, 0.7)',      
  surfaceContainerHigh: 'rgba(17, 13, 16, 0.85)',  
  surfaceContainerHighest: 'rgba(255, 0, 127, 0.05)', // Zart rosa eingefärbt für Inputs

  outline: 'rgba(255, 0, 127, 0.3)', // Pinkish seam
  outlineVariant: 'rgba(255, 0, 127, 0.15)',
};

export const materialTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: m3Tokens.primary, contrastText: m3Tokens.onPrimary },
    secondary: { main: m3Tokens.secondary, contrastText: m3Tokens.onSecondary },
    tertiary: { main: m3Tokens.tertiary, contrastText: m3Tokens.onTertiary },
    error: { main: m3Tokens.error, contrastText: m3Tokens.onError },
    background: {
      default: m3Tokens.background,
      paper: m3Tokens.surfaceContainer,
    },
    text: {
      primary: m3Tokens.onSurface,
      secondary: m3Tokens.onSurfaceVariant, 
    },
    m3: m3Tokens
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontSize: '32px', lineHeight: '40px', fontWeight: 700 }, // Etwas dominanter im Sissy-Theme
    h5: { fontSize: '28px', lineHeight: '36px', fontWeight: 700 },
    h6: { fontSize: '24px', lineHeight: '32px', fontWeight: 700 },
    subtitle1: { fontSize: '16px', lineHeight: '24px', fontWeight: 500, letterSpacing: '0.15px' },
    subtitle2: { fontSize: '14px', lineHeight: '20px', fontWeight: 500, letterSpacing: '0.1px' },
    body1: { fontSize: '16px', lineHeight: '24px', letterSpacing: '0.5px' },
    body2: { fontSize: '14px', lineHeight: '20px', letterSpacing: '0.25px' },
    button: { textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }, // Buttons lauter
  },
  shape: {
    borderRadius: 16, 
  },
  components: {
    // --- GLOBAL: NYLON MESH (Maschenmuster) ---
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: m3Tokens.background,
          // Der "Sheer Nylon" Maschen-Effekt via CSS Gradients
          backgroundImage: `
            linear-gradient(rgba(255, 0, 127, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 0, 127, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '3px 3px',
          color: m3Tokens.onSurface,
        }
      }
    },
    // --- BUTTONS: PILL SHAPE & NEON GLOW ---
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '9999px', 
          padding: '10px 24px',
          fontSize: '14px',
          textTransform: 'uppercase',
          fontWeight: 'bold',
          letterSpacing: '1px',
        },
        contained: {
          backgroundColor: m3Tokens.primary,
          color: m3Tokens.onPrimary,
          boxShadow: `0 4px 14px rgba(255, 0, 127, 0.4)`, // Matte Neon Pink Glow
          '&:hover': { 
              backgroundColor: m3Tokens.primary,
              boxShadow: `0 6px 20px rgba(255, 0, 127, 0.6)`,
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.1), rgba(255,255,255,0.1))' 
          }
        },
        outlined: {
          borderColor: m3Tokens.outline,
          color: m3Tokens.primary,
        },
        text: {
            padding: '10px 16px', 
        }
      },
    },
    // --- CARDS: GLASSMORPHISM ---
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: m3Tokens.surfaceContainer,
          backdropFilter: 'blur(12px)', // Sheer Nylon Effekt
          borderRadius: '16px', 
          backgroundImage: 'none',
          boxShadow: '0 8px 32px rgba(255, 0, 127, 0.1)',
          border: `1px solid ${m3Tokens.outlineVariant}`, 
        },
      },
    },
    // --- DIALOGS: EXTRA LARGE SHAPE ---
    MuiDialogPaper: {
        styleOverrides: {
            root: {
                borderRadius: '28px', 
                backgroundColor: m3Tokens.surfaceContainerHigh,
                backdropFilter: 'blur(16px)', // Intensiver Blur für Dialoge
                backgroundImage: 'none',
                border: `1px solid ${m3Tokens.outline}`,
                boxShadow: `0 0 40px rgba(255, 0, 127, 0.15)`,
            }
        }
    },
    // --- BOTTOM SHEET / DRAWER ---
    MuiDrawer: {
        styleOverrides: {
            paper: {
                backgroundColor: 'rgba(17, 13, 16, 0.90)',
                backdropFilter: 'blur(16px)',
                borderTopLeftRadius: '28px',
                borderTopRightRadius: '28px',
                borderTop: `1px solid ${m3Tokens.outline}`,
            }
        }
    },
    // --- INPUTS ---
    MuiOutlinedInput: {
        styleOverrides: {
            root: {
                borderRadius: '8px', 
                backgroundColor: m3Tokens.surfaceContainerHighest,
                '& fieldset': { border: `1px solid ${m3Tokens.outlineVariant}` }, 
                '&.Mui-focused fieldset': { border: `2px solid ${m3Tokens.primary}` },
            },
            input: { padding: '16px' }
        }
    },
    // --- LISTS ---
    MuiListItem: {
        styleOverrides: {
            root: {
                paddingTop: 8,
                paddingBottom: 8,
            }
        }
    },
    // --- CHIPS ---
    MuiChip: {
        styleOverrides: {
            root: {
                borderRadius: '8px', 
                height: '32px',
                backgroundColor: m3Tokens.surfaceContainerHighest,
                border: `1px solid ${m3Tokens.outlineVariant}`,
                fontWeight: 700,
            },
            filled: {
                border: 'none'
            }
        }
    }
  },
});