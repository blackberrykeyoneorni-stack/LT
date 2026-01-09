import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
// Wir importieren die echten Services, um den Status zu prüfen und die Abfrage zu starten
import { isBiometricEnabled, verifyBiometrics, isBiometricSupported } from '../services/BiometricService';

const SecurityContext = createContext();

export function useSecurity() {
  return useContext(SecurityContext);
}

export function SecurityProvider({ children }) {
  const { currentUser } = useAuth();

  // 1. ECHTER STATUS: Wir lesen beim Start aus, ob Biometrie in den Settings aktiviert wurde
  const [isBiometricActive, setIsBiometricActive] = useState(isBiometricEnabled());
  
  // 2. SPERR-LOGIK: Wenn Biometrie aktiv ist, starten wir "gesperrt" (true), sonst offen (false)
  const [isLocked, setIsLocked] = useState(isBiometricEnabled());

  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Diese Funktion wird von der Settings-Seite aufgerufen, wenn du den Schalter umlegst
  const updateStatus = () => {
      const enabled = isBiometricEnabled();
      setIsBiometricActive(enabled);
      // Wenn wir es gerade ausschalten, entsperren wir auch sofort
      if (!enabled) setIsLocked(false);
  };

  // Prüfen, ob das Gerät überhaupt einen Scanner hat (Pixel 9 Pro hat einen)
  useEffect(() => {
    isBiometricSupported().then(available => {
        setBiometricsAvailable(available);
    });
  }, []);

  // Die Unlock-Funktion: Ruft den Fingerabdruck-Scanner des Browsers auf
  const unlock = async () => {
    setAuthError(null);
    try {
        // Das hier öffnet das System-Popup (Fingerabdruck / FaceID)
        const success = await verifyBiometrics();
        if (success) {
            setIsLocked(false);
        } else {
            setAuthError("Verifizierung fehlgeschlagen");
        }
    } catch (e) {
        console.error("Unlock Error", e);
        setAuthError("Fehler beim Entsperren");
    }
  };

  // Notfall-Unlock (z.B. nach Google Login)
  const forceUnlock = () => {
    setIsLocked(false);
    setAuthError(null);
  };

  // Manuelles Sperren (z.B. Button im Menü)
  const lockNow = () => {
    if (isBiometricActive) {
        setIsLocked(true);
    }
  };

  const value = {
    isLocked,
    isBiometricActive,
    biometricsAvailable,
    authError,
    unlock,
    forceUnlock,
    lockNow,
    updateStatus
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
}
