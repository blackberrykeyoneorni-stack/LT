import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

// KONFIGURATION
// Hier könnten später Schwellenwerte für die Zufalls-Entladung (Random Ambush) definiert werden
const MIN_COOLDOWN_MINUTES = 10; 

/**
 * Speichert eine erfolgreiche Entladung in der Datenbank.
 * Dient als "Siegel" für das Nacht-Protokoll oder als Erfüllung einer Random-Forderung.
 * * @param {string} userId - Die ID des Nutzers
 * @param {string} type - Der Typ der Anforderung ('night' oder 'random')
 * @param {boolean} swallowed - Ob die Ingestion (Schlucken) bestätigt wurde
 */
export const registerReleaseSuccess = async (userId, type, swallowed = false) => {
    const statusRef = doc(db, `users/${userId}/status/releaseProtocol`);
    
    // Wir holen uns das aktuelle Datum für den "Night Check" (YYYY-MM-DD)
    // Damit wissen wir, dass für "heute Nacht" die Pflicht erfüllt wurde.
    const now = new Date();
    // Zeitzonen-Korrektur (simpel), damit der Tag auch nach Mitternacht noch stimmt, 
    // falls man spät dran ist, zählt es zur logischen "Nacht"
    const offset = now.getTimezoneOffset() * 60000;
    const localDateStr = new Date(now.getTime() - offset).toISOString().split('T')[0];

    const updateData = {
        lastReleaseTime: serverTimestamp(),
        lastType: type,
        swallowed: swallowed,
        // Wir löschen eventuelle ausstehende Forderungen
        pendingDemand: false, 
        demandType: null
    };

    // Wenn es die Nacht-Pflicht war und geschluckt wurde, stempeln wir das Datum ab.
    if (type === 'night' && swallowed) {
        updateData.lastNightReleaseDate = localDateStr;
    }

    // `setDoc` mit { merge: true } erstellt das Dokument, falls es noch nicht existiert
    await setDoc(statusRef, updateData, { merge: true });
};

/**
 * Prüft, ob eine zufällige Entladung gefordert werden soll (Vorbereitung für später).
 * Aktuell noch passiv, da wir uns auf den Nacht-Zwang konzentrieren.
 */
export const checkRandomReleaseDemand = async (userId) => {
    const statusRef = doc(db, `users/${userId}/status/releaseProtocol`);
    const snap = await getDoc(statusRef);
    
    // Wenn noch kein Status existiert, keine Forderung
    if (!snap.exists()) return { active: false };

    const data = snap.data();
    
    // Wenn bereits eine Forderung offen ist
    if (data.pendingDemand) {
        return { active: true, type: data.demandType || 'random', reason: 'Ausstehende Forderung' };
    }

    return { active: false };
};

/**
 * Registriert eine Verweigerung (Fail).
 * Wird aufgerufen, wenn der Nutzer im Dialog "Ich kann nicht" wählt.
 * Das Dashboard triggert daraufhin die Strafe.
 */
export const registerReleaseFail = async (userId) => {
    const statusRef = doc(db, `users/${userId}/status/releaseProtocol`);
    
    await updateDoc(statusRef, {
        pendingDemand: false,
        demandType: null,
        lastFailTime: serverTimestamp()
    });
};
