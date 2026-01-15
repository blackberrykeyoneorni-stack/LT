import { createTheme } from '@mui/material/styles';

/**
 * ANDROID 16 / MATERIAL DESIGN 3 - DEEP DARK THEME
 * Basierend auf der Google Material 3 Spezifikation.
 * Seed Color: #00E5FF (Cyan) -> Generierte Tonal Palette für Dark Mode.
 */

const m3Tokens = {
  // PRIMARY: Prominenteste Aktionen (FAB, Filled Buttons)
  // M3 nutzt in Dark Mode Pastelltöne (Tone 80), keine Neonfarben.
  primary: '#FFB683',          // Ein technisches, modernes Mint/Cyan
  onPrimary: '#522302',        // Dunkler Text auf Primary
  primaryContainer: '#321200', // Container Hintergrund
  onPrimaryContainer: '#FFF8F4', // Text/Icon im Container

  // SECONDARY: Weniger dominante Elemente (Filter Chips, Toggles)
  secondary: '#B3CCBE',
  onSecondary: '#1F352B',
  secondaryContainer: '#354B41',
  onSecondaryContainer: '#CFE9D9',

  // TERTIARY: Akzente (hier: für den Fetisch-Kontext / Warnungen)
  tertiary: '#FFB2BC',         // Kühles Pink/Rot
  onTertiary: '#660023',
  tertiaryContainer: '#900035',
  onTertiaryContainer: '#FFD9DF',

  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',

  // SURFACES: Die Hierarchie der Tiefe (Neutral)
  // Android 16 Deep Dark: Fast Schwarz, aber leicht getönt.
  background: '#0F1211',       
  onBackground: '#DEE4E0',
  surface: '#0F1211',
  onSurface: '#DEE4E0',
  
  // SURFACE CONTAINER (Ersetzt die alte "Elevation" Logik)
  surfaceContainerLow: '#171D1A',   // Hintergrund für Listen
  surfaceContainer: '#1B211E',      // Standard Cards
  surfaceContainerHigh: '#252B28',  // Dialoge, Navigation
  surfaceContainerHighest: '#303633', // Input Fields

  outline: '#89938D',
  outlineVariant: '#404944',
};

export const materialTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: m3Tokens.primary, contrastText: m3Tokens.onPrimary },
    secondary: { main: m3Tokens.secondary, contrastText: m3Tokens.onSecondary },
    error: { main: m3Tokens.error, contrastText: m3Tokens.onError },
    background: {
      default: m3Tokens.background,
      paper: m3Tokens.surfaceContainer,
    },
    text: {
      primary: m3Tokens.onSurface,
      secondary: m3Tokens.onSecondaryContainer, // M3 nutzt oft farbigen Text für Secondary
    },
    // Custom Token Zugriff
    m3: m3Tokens
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    // M3 Typography Scale
    h4: { fontSize: '32px', lineHeight: '40px', fontWeight: 400 },
    h5: { fontSize: '28px', lineHeight: '36px', fontWeight: 400 },
    h6: { fontSize: '24px', lineHeight: '32px', fontWeight: 400 },
    subtitle1: { fontSize: '16px', lineHeight: '24px', fontWeight: 500, letterSpacing: '0.15px' },
    subtitle2: { fontSize: '14px', lineHeight: '20px', fontWeight: 500, letterSpacing: '0.1px' },
    body1: { fontSize: '16px', lineHeight: '24px', letterSpacing: '0.5px' },
    body2: { fontSize: '14px', lineHeight: '20px', letterSpacing: '0.25px' },
    button: { textTransform: 'none', fontWeight: 500, letterSpacing: '0.1px' },
  },
  shape: {
    borderRadius: 16, // Globaler Basis-Radius
  },
  components: {
    // --- BUTTONS: PILL SHAPE (M3 Pflicht) ---
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '9999px', // Erzwingt Pill-Shape (Kapsel)
          padding: '10px 24px',
          boxShadow: 'none', // Keine Schatten in M3
          fontSize: '14px',
          '&:hover': { boxShadow: 'none' }, // Auch im Hover kein Schatten
        },
        contained: {
          backgroundColor: m3Tokens.primary,
          color: m3Tokens.onPrimary,
          '&:hover': { 
              backgroundColor: m3Tokens.primary,
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.08), rgba(255,255,255,0.08))' // State Layer
          }
        },
        outlined: {
          borderColor: m3Tokens.outline,
          color: m3Tokens.primary,
        },
        text: {
            padding: '10px 16px', // Mehr Padding für Touch Targets
        }
      },
    },
    // --- CARDS: MEDIUM SHAPE ---
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: m3Tokens.surfaceContainer,
          borderRadius: '16px', // M3 Card Radius (etwas runder)
          backgroundImage: 'none',
          boxShadow: 'none',
          border: 'none', 
        },
      },
    },
    // --- DIALOGS: EXTRA LARGE SHAPE ---
    MuiDialogPaper: {
        styleOverrides: {
            root: {
                borderRadius: '28px', // Android 16 Standard für Dialoge
                backgroundColor: m3Tokens.surfaceContainerHigh,
                backgroundImage: 'none',
            }
        }
    },
    // --- BOTTOM SHEET / DRAWER ---
    MuiDrawer: {
        styleOverrides: {
            paper: {
                backgroundColor: m3Tokens.surfaceContainer,
                borderTopLeftRadius: '28px',
                borderTopRightRadius: '28px',
            }
        }
    },
    // --- INPUTS ---
    MuiOutlinedInput: {
        styleOverrides: {
            root: {
                borderRadius: '4px', // Inputs bleiben bei M3 eckiger (oder Pill für Search)
                backgroundColor: m3Tokens.surfaceContainerHighest,
                '& fieldset': { border: 'none' }, // Filled Style Simulation
                '&.Mui-focused fieldset': { border: `2px solid ${m3Tokens.primary}` },
            },
            input: { padding: '16px' }
        }
    },
    // --- LISTS ---
    MuiListItem: {
        styleOverrides: {
            root: {
                // Keine Borders, sondern Abstände
                paddingTop: 8,
                paddingBottom: 8,
            }
        }
    },
    // --- CHIPS ---
    MuiChip: {
        styleOverrides: {
            root: {
                borderRadius: '8px', // M3 Assist Chips (eckiger als Buttons)
                height: '32px',
                backgroundColor: m3Tokens.surfaceContainerHighest,
                border: `1px solid ${m3Tokens.outlineVariant}`,
            },
            filled: {
                border: 'none'
            }
        }
    }
  },
});