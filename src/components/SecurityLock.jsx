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

  // VANILLA JS PRIVACY SHIELD UM REACT ZU UMGEHEN
  useEffect(() => {
    if (!currentUser || !isBiometricActive) return;

    // Erstelle ein pures DOM-Element außerhalb des React-Lifecycles
    const shield = document.createElement('div');
    shield.id = 'lt-vanilla-privacy-shield';
    shield.style.position = 'fixed';
    shield.style.top = '0';
    shield.style.left = '0';
    shield.style.width = '100vw';
    shield.style.height = '100vh';
    shield.style.backgroundColor = '#F3F4F6'; // Camouflage Grau
    shield.style.zIndex = '9999999'; // Absolutes Maximum, überdeckt alles
    shield.style.display = 'none'; // Initial versteckt
    shield.style.justifyContent = 'center';
    shield.style.alignItems = 'center';
    shield.style.color = '#607D8B';
    shield.style.fontFamily = 'Roboto, Arial, sans-serif';
    shield.style.fontSize = '1.2rem';
    shield.style.fontWeight = '500';
    shield.innerText = 'LT System Data';

    document.body.appendChild(shield);

    // Synchrone Ausführung stoppt den Android-Screenshot
    const protect = () => {
      shield.style.display = 'flex';
      lockNow(); // Trigger für React, um den echten LockScreen im Hintergrund zu laden
    };

    const unprotect = () => {
      shield.style.display = 'none';
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') protect();
    };

    // 'blur' feuert sofort beim Start der Task-Switcher-Geste
    window.addEventListener('blur', protect);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', unprotect);

    // Cleanup bei Unmount
    return () => {
      window.removeEventListener('blur', protect);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', unprotect);
      if (document.body.contains(shield)) {
        document.body.removeChild(shield);
      }
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

  // Wenn nicht gesperrt, zeige die App
  return <>{children}</>;
}