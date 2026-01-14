import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { isBiometricEnabled, verifyBiometrics, isBiometricSupported } from '../services/BiometricService';

const SecurityContext = createContext();

export function useSecurity() {
  return useContext(SecurityContext);
}

export function SecurityProvider({ children }) {
  const { currentUser } = useAuth();

  // 1. INITIALISIERUNG: Prüfen, ob der User das Feature aktiviert hat
  // WICHTIG: Wir holen den Wert direkt beim Start, damit kein "Flackern" entsteht
  const [isBiometricActive, setIsBiometricActive] = useState(() => isBiometricEnabled());
  
  // 2. SPERR-ZUSTAND: Wenn aktiv, dann starten wir GESPERRT (true)
  const [isLocked, setIsLocked] = useState(() => isBiometricEnabled());

  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Hardware-Check beim Start
  useEffect(() => {
    const checkSupport = async () => {
        const supported = await isBiometricSupported();
        setBiometricsAvailable(supported);
    };
    checkSupport();
  }, []);

  // Wird aus den Settings aufgerufen, wenn der Switch betätigt wird
  const updateStatus = () => {
      const enabled = isBiometricEnabled();
      setIsBiometricActive(enabled);
      if (!enabled) setIsLocked(false); // Sofort entsperren, wenn deaktiviert
  };

  // Die Hauptfunktion zum Entsperren
  const unlock = async () => {
    setAuthError(null);
    try {
        // Dies triggert den Android-System-Dialog (Face/Finger + PIN Backup)
        const success = await verifyBiometrics();
        
        if (success) {
            setIsLocked(false);
        } else {
            // Fehlermeldung, aber wir bleiben im Lockscreen
            setAuthError("Verifizierung fehlgeschlagen. Bitte erneut versuchen.");
        }
    } catch (e) {
        console.error("Unlock Error", e);
        setAuthError("Geräte-Sicherheit nicht verfügbar.");
    }
  };

  // Notfall-Unlock (z.B. nach erfolgreichem Firebase Re-Login)
  const forceUnlock = () => {
    setIsLocked(false);
    setAuthError(null);
  };

  // Manuelles Sperren (z.B. Timeout oder Button)
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