import React, { useEffect } from 'react';
import { useSecurity } from '../contexts/SecurityContext';
import { useAuth } from '../contexts/AuthContext';
import LockScreen from './LockScreen';

export default function SecurityLock({ children }) {
  const { isLocked, isBiometricActive, lockNow } = useSecurity();
  const { currentUser } = useAuth();

  // Sicherheits-Check: Wenn die App in den Hintergrund geht (optional, für später)
  // oder neu geladen wird, greift der Initial-State aus dem Context.

  // Logik: Zeige LockScreen nur, wenn User eingeloggt UND Sicherheits-Feature aktiv UND Status gesperrt
  const showLock = currentUser && isBiometricActive && isLocked;

  if (showLock) {
    return <LockScreen />;
  }

  // Wenn nicht gesperrt, zeige die App
  return <>{children}</>;
}