import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { isBiometricEnabled, verifyBiometrics, isBiometricSupported } from '../services/BiometricService';

const SecurityContext = createContext();

export function useSecurity() {
  return useContext(SecurityContext);
}

export function SecurityProvider({ children }) {
  const { currentUser } = useAuth();

  const [isBiometricActive, setIsBiometricActive] = useState(() => isBiometricEnabled());
  const [isLocked, setIsLocked] = useState(() => isBiometricEnabled());

  // NEU: Bypass Flag für System-Dialoge (Kamera / Filepicker)
  const [suspendAutoLock, setSuspendAutoLock] = useState(false);

  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const checkSupport = async () => {
        const supported = await isBiometricSupported();
        setBiometricsAvailable(supported);
    };
    checkSupport();
  }, []);

  const updateStatus = () => {
      const enabled = isBiometricEnabled();
      setIsBiometricActive(enabled);
      if (!enabled) setIsLocked(false); 
  };

  const unlock = async () => {
    setAuthError(null);
    try {
        const success = await verifyBiometrics();
        if (success) {
            setIsLocked(false);
        } else {
            setAuthError("Verifizierung fehlgeschlagen. Bitte erneut versuchen.");
        }
    } catch (e) {
        console.error("Unlock Error", e);
        setAuthError("Geräte-Sicherheit nicht verfügbar.");
    }
  };

  const forceUnlock = () => {
    setIsLocked(false);
    setAuthError(null);
  };

  // NEU: Signalisiert der Security, dass die App gleich legal in den Hintergrund geht
  const prepareSystemDialog = () => {
      setSuspendAutoLock(true);
      // Fallback: Bypass nach 30 Sekunden aufheben, falls der User abbricht
      setTimeout(() => {
          setSuspendAutoLock(false);
      }, 30000);
  };

  const lockNow = () => {
    if (isBiometricActive) {
        // NEU: Greift der Bypass, wird die Sperre umgangen und sofort resettet
        if (suspendAutoLock) {
            setSuspendAutoLock(false); 
            return;
        }
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
    updateStatus,
    prepareSystemDialog // Exportiert für ItemGallery
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
}