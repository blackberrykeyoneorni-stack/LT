import React, { useEffect } from 'react';
import { useSecurity } from '../contexts/SecurityContext';
import { useAuth } from '../contexts/AuthContext';
import LockScreen from './LockScreen';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

// Ein steriles, unauffälliges System-Theme für den Camouflage-Vorraum
const camouflageTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#607D8B' }, // Neutrales Blau-Grau
    background: { default: '#F3F4F6', paper: '#FFFFFF' },
    text: { primary: '#333333', secondary: '#666666' }
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  }
});

export default function SecurityLock({ children }) {
  const { isLocked, isBiometricActive, lockNow } = useSecurity();
  const { currentUser } = useAuth();

  // TASK-SWITCHER-SICHERHEIT (Privacy Screen)
  // Überwacht, ob die App in den Hintergrund geschoben wird
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && currentUser && isBiometricActive) {
        lockNow(); // App sofort und unwiderruflich sperren
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser, isBiometricActive, lockNow]);

  // Logik: Zeige LockScreen nur, wenn User eingeloggt UND Sicherheits-Feature aktiv UND Status gesperrt
  const showLock = currentUser && isBiometricActive && isLocked;

  if (showLock) {
    // Entkopplung vom Haupt-Theme durch das Camouflage-Theme
    return (
      <ThemeProvider theme={camouflageTheme}>
        <CssBaseline />
        <LockScreen />
      </ThemeProvider>
    );
  }

  // Wenn nicht gesperrt, zeige die App in ihrer vollen, feminisierten Pracht
  return <>{children}</>;
}