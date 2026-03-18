import { createTheme } from '@mui/material/styles';
import { m3Tokens } from './obsidianDesign';

// ARCHITEKTUR-FIX: Expliziter Import des Assets für die Vite Build-Pipeline
import bgLeg from '../assets/bg-leg.jpg';

export const materialTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: m3Tokens.primary, contrastText: m3Tokens.onPrimary },
    secondary: { main: m3Tokens.secondary, contrastText: m3Tokens.onSecondary },
    tertiary: { main: m3Tokens.tertiary, contrastText: m3Tokens.onTertiary },
    error: { main: m3Tokens.error, contrastText: m3Tokens.onError },
    background: {
      default: m3Tokens.background,
      paper: 'transparent',
    },
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255, 255, 255, 0.7)', 
    },
    m3: m3Tokens
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontSize: '32px', lineHeight: '40px', fontWeight: 700 }, 
    h5: { fontSize: '28px', lineHeight: '36px', fontWeight: 700 },
    h6: { fontSize: '24px', lineHeight: '32px', fontWeight: 700 },
    subtitle1: { fontSize: '16px', lineHeight: '24px', fontWeight: 500, letterSpacing: '0.15px' },
    subtitle2: { fontSize: '14px', lineHeight: '20px', fontWeight: 500, letterSpacing: '0.1px' },
    body1: { fontSize: '16px', lineHeight: '24px', letterSpacing: '0.5px' },
    body2: { fontSize: '14px', lineHeight: '20px', letterSpacing: '0.25px' },
    button: { textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }, 
  },
  shape: {
    borderRadius: 16, 
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#050505',
          // KORRIGIERTE LAYER-REIHENFOLGE: 1. Noise (Top), 2. Gradient (Middle), 3. Bild (Bottom)
          backgroundImage: `
            url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.08'/%3E%3C/svg%3E"),
            linear-gradient(rgba(5, 5, 5, 0.75), rgba(5, 5, 5, 0.92)),
            url(${bgLeg})
          `,
          backgroundAttachment: 'fixed',
          // Sizing und Positionierung müssen exakt den Ebenen oben entsprechen
          backgroundSize: '3px 3px, cover, cover',
          backgroundPosition: 'top left, center, right center',
          backgroundRepeat: 'repeat, no-repeat, no-repeat',
          color: '#FFFFFF',
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '9999px', 
          padding: '10px 24px',
          fontSize: '14px',
          textTransform: 'uppercase',
          fontWeight: 'bold',
          letterSpacing: '1px',
          transition: 'all 0.2s ease-in-out',
        },
        contained: {
          background: `linear-gradient(135deg, ${m3Tokens.primary} 0%, #99004D 40%, #E60073 60%, ${m3Tokens.primary} 100%)`,
          color: m3Tokens.onPrimary,
          boxShadow: `inset 0px 2px 4px rgba(255, 255, 255, 0.3), 0 4px 14px rgba(255, 0, 127, 0.5)`, 
          '&:hover': { 
              background: `linear-gradient(135deg, #E60073 0%, #800040 40%, #CC0066 60%, #E60073 100%)`,
              boxShadow: `inset 0px 4px 8px rgba(0, 0, 0, 0.4), 0 6px 20px rgba(255, 0, 127, 0.6)`,
          }
        },
        outlined: {
          borderColor: 'rgba(255, 0, 127, 0.4)',
          borderStyle: 'dashed', 
          color: m3Tokens.primary,
          '&:hover': {
              backgroundColor: 'rgba(255, 0, 127, 0.05)',
              borderColor: m3Tokens.primary,
          }
        },
        text: {
            padding: '10px 16px', 
        }
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(16px)', 
          borderRadius: '16px', 
          backgroundImage: 'none',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
          border: `1px solid rgba(255, 0, 127, 0.1)`, 
          borderTop: `1px dashed rgba(255, 0, 127, 0.25)`,
        },
      },
    },
    MuiDialogPaper: {
        styleOverrides: {
            root: {
                borderRadius: '28px', 
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(20px)', 
                backgroundImage: 'none',
                border: `1px solid rgba(255, 0, 127, 0.2)`,
                borderTop: `2px dashed rgba(255, 0, 127, 0.4)`,
                boxShadow: `0 20px 50px rgba(0, 0, 0, 0.8), inset 0 2px 0 rgba(255, 255, 255, 0.05)`,
            }
        }
    },
    MuiDrawer: {
        styleOverrides: {
            paper: {
                backgroundColor: 'rgba(5, 5, 5, 0.75)',
                backdropFilter: 'blur(20px)',
                borderTopLeftRadius: '28px',
                borderTopRightRadius: '28px',
                borderTop: `1px dashed rgba(255, 0, 127, 0.4)`,
                boxShadow: `0 -10px 30px rgba(0, 0, 0, 0.8), inset 0 2px 0 rgba(255, 0, 127, 0.2)`,
            }
        }
    },
    MuiOutlinedInput: {
        styleOverrides: {
            root: {
                borderRadius: '8px', 
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                '& fieldset': { border: `1px solid rgba(255, 0, 127, 0.15)` }, 
                '&.Mui-focused fieldset': { border: `2px solid ${m3Tokens.primary}` },
            },
            input: { padding: '16px' }
        }
    },
    MuiListItem: {
        styleOverrides: {
            root: {
                paddingTop: 8,
                paddingBottom: 8,
            }
        }
    },
    MuiChip: {
        styleOverrides: {
            root: {
                borderRadius: '8px', 
                height: '32px',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: `1px dashed rgba(255, 0, 127, 0.2)`,
                color: '#FFFFFF',
                fontWeight: 700,
            },
            filled: {
                border: 'none'
            }
        }
    }
  },
});

export const theme = materialTheme;