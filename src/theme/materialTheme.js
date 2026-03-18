import { createTheme } from '@mui/material/styles';
import { m3Tokens, DESIGN_TOKENS } from './obsidianDesign';

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
          backgroundColor: m3Tokens.absoluteBg,
          ...DESIGN_TOKENS.bodyBackground,
          color: m3Tokens.onSurface,
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
          background: DESIGN_TOKENS.buttonGradient.background,
          color: DESIGN_TOKENS.buttonGradient.color,
          boxShadow: DESIGN_TOKENS.buttonGradient.boxShadow,
          '&:hover': DESIGN_TOKENS.buttonGradient['&:hover'],
        },
        outlined: {
          borderColor: m3Tokens.outline,
          borderStyle: 'dashed', 
          color: m3Tokens.primary,
          '&:hover': DESIGN_TOKENS.buttonSecondary['&:hover'],
        },
        text: {
            padding: '10px 16px', 
        }
      },
    },
    MuiCard: {
      styleOverrides: {
        root: DESIGN_TOKENS.glassCard,
      },
    },
    MuiDialogPaper: {
        styleOverrides: {
            root: DESIGN_TOKENS.dialog.paper.sx
        }
    },
    MuiDrawer: {
        styleOverrides: {
            paper: DESIGN_TOKENS.bottomSheet.sx
        }
    },
    MuiOutlinedInput: {
        styleOverrides: {
            root: {
                borderRadius: DESIGN_TOKENS.inputField['& .MuiOutlinedInput-root'].borderRadius,
                backgroundColor: DESIGN_TOKENS.inputField['& .MuiOutlinedInput-root'].bgcolor,
                '& fieldset': DESIGN_TOKENS.inputField['& .MuiOutlinedInput-root']['& fieldset'],
                '&.Mui-focused fieldset': DESIGN_TOKENS.inputField['& .MuiOutlinedInput-root']['&.Mui-focused fieldset'],
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
                borderRadius: DESIGN_TOKENS.chip.default.borderRadius,
                height: DESIGN_TOKENS.chip.default.height,
                backgroundColor: DESIGN_TOKENS.chip.default.bgcolor,
                border: DESIGN_TOKENS.chip.default.border,
                color: DESIGN_TOKENS.chip.default.color,
                fontWeight: DESIGN_TOKENS.chip.default.fontWeight,
            },
            filled: {
                border: 'none'
            }
        }
    }
  },
});

export const theme = materialTheme;