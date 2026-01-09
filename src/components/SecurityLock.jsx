import React from 'react';
import { useSecurity } from '../contexts/SecurityContext';
import { useAuth } from '../contexts/AuthContext';
import LockScreen from './LockScreen';

export default function SecurityLock({ children }) {
  const { isLocked, isBiometricActive } = useSecurity();
  const { currentUser } = useAuth();

  // Zeige den LockScreen nur, wenn:
  // 1. Ein User eingeloggt ist
  // 2. Biometrie in den Settings aktiviert ist
  // 3. Der Status aktuell "gesperrt" ist
  const showLock = currentUser && isBiometricActive && isLocked;

  // SICHERHEITS-FIX: Rendere children NUR, wenn nicht gesperrt.
  if (showLock) {
    return <LockScreen />;
  }

  return <>{children}</>;
}
