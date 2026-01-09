// BiometricService.js - Repariert für Android 16 / Pixel 9 Pro

const LOC_KEY = 'biometric_enabled';
const CRED_ID_KEY = 'biometric_cred_id'; 

// Helper: ArrayBuffer to Base64
const bufToStr = (buf) => {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
};

// Helper: Base64 to Uint8Array
const strToBuf = (str) => {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
};

export const isBiometricSupported = async () => {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) {
    return false;
  }
  try {
    const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch (e) {
    console.warn("Biometric Check Error:", e);
    return false;
  }
};

export const isBiometricEnabled = () => {
  return localStorage.getItem(LOC_KEY) === 'true';
};

export const enableBiometrics = async (userId = 'user') => {
  if (!window.PublicKeyCredential) return false;

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    // FIX FÜR PIXEL 9 PRO / ANDROID 16:
    // Nutzen des TextEncoder für korrekte Buffer-Konvertierung
    const userIdBuffer = new TextEncoder().encode(userId);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "LaceTracker PWA",
          id: window.location.hostname 
        },
        user: {
          id: userIdBuffer, // Buffer statt String
          name: userId,
          displayName: userId
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, 
          { type: "public-key", alg: -257 } 
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        timeout: 60000,
        attestation: "none"
      }
    });

    if (credential) {
      localStorage.setItem(CRED_ID_KEY, bufToStr(credential.rawId));
      localStorage.setItem(LOC_KEY, 'true');
      return true;
    }
  } catch (error) {
    console.error("Biometric registration failed:", error);
    return false;
  }
  
  return false;
};

export const disableBiometrics = () => {
  localStorage.removeItem(LOC_KEY);
  localStorage.removeItem(CRED_ID_KEY);
  return true;
};

export const verifyBiometrics = async () => {
  if (!isBiometricEnabled()) return true;

  try {
    const savedCredId = localStorage.getItem(CRED_ID_KEY);
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const publicKeyOptions = {
      challenge,
      rpId: window.location.hostname,
      userVerification: "required",
    };

    if (savedCredId) {
      publicKeyOptions.allowCredentials = [{
        id: strToBuf(savedCredId),
        type: 'public-key',
        transports: ['internal']
      }];
    }

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyOptions
    });

    return !!assertion;
  } catch (error) {
    console.error("Biometric verification failed:", error);
    return false;
  }
};
