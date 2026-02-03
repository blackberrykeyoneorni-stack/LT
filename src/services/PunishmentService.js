import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { DEFAULT_PROTOCOL_RULES } from '../config/defaultRules';

// Konstanten für das Straf-Item
const PUNISHMENT_ITEM_CATEGORY = 'Accessoires';
const PUNISHMENT_ITEM_SUBCATEGORY = 'Buttplug';

// Zeitfenster aus der Config (SSOT)
// Wir greifen direkt auf die Config zu, statt lokale Konstanten zu pflegen.
const { time, punishment } = DEFAULT_PROTOCOL_RULES;

// Konstanten für Bailout
const BAILOUT_PROBABILITY = 0.25; // 25% Risiko bei Abbruch

// Konstanten für Strafmaß (Limits)
const MIN_PUNISHMENT_MINUTES = 15;
const MAX_PUNISHMENT_MINUTES = 180; // Angehoben, da Config höhere Werte erlauben könnte
const BAILOUT_PENALTY_FACTOR = 0.5; // Verhältnis: 1h verpasste Tragezeit = 30min Strafe

// Prüft, ob wir uns im erlaubten nächtlichen Zeitfenster für den Vollzug befinden
export const isPunishmentWindowOpen = () => {
    const d = new Date();
    const h = d.getHours();
    // Fenster definiert in defaultRules.js
    // Wir ignorieren hier Minuten für die Grob-Prüfung, wie im Original
    const start = time.nightStartHour;
    const end = time.dayStartHour;
    
    // Logik für Zeitfenster über Mitternacht (z.B. 23 bis 7)
    if (start > end) {
        return (h >= start || h < end);
    } else {
        // Fallback für Fenster am gleichen Tag (z.B. 01 bis 06)
        return (h >= start && h < end);
    }
};

// Lädt den aktuellen Straf-Status (umbenannt zu getActivePunishment für Kompatibilität)
export const getActivePunishment = async (userId) => {
    const statusRef = doc(db, `users/${userId}/status/punishment`);
    const statusSnap = await getDoc(statusRef);
    
    if (!statusSnap.exists()) {
        return null; // Keine Daten -> Keine Strafe
    }

    let data = statusSnap.data();

    // Automatische Aktivierung von aufgeschobenen Strafen im Zeitfenster
    if (data.deferred && isPunishmentWindowOpen()) {
        try {
            await updateDoc(statusRef, {
                active: true,
                deferred: false,
                activatedAt: serverTimestamp()
            });
            data.active = true;
            data.deferred = false;
        } catch (e) {
            console.error("Fehler beim Aktivieren der aufgeschobenen Strafe:", e);
        }
    }

    // WICHTIG: Wenn Strafe nicht aktiv ist, geben wir null zurück,
    // damit das Dashboard den Dialog NICHT öffnet.
    if (!data.active) {
        return null;
    }

    return data;
};

// Alias für Abwärtskompatibilität
export const getPunishmentStatus = getActivePunishment;

/**
 * Registriert eine Strafe mit definierter Dauer.
 * @param {string} userId 
 * @param {string} reason 
 * @param {number} durationMinutes - Die errechnete Dauer der Strafe
 */
export const registerPunishment = async (userId, reason, durationMinutes = null) => {
    const statusRef = doc(db, `users/${userId}/status/punishment`);
    
    // Fallback auf Config-Standard, falls keine Dauer übergeben
    const duration = durationMinutes || punishment.defaultDurationMinutes;

    // Limits anwenden
    const finalDuration = Math.min(Math.max(duration, MIN_PUNISHMENT_MINUTES), MAX_PUNISHMENT_MINUTES);
    
    const active = isPunishmentWindowOpen();
    
    await setDoc(statusRef, {
        active: active, // Sofort aktiv, wenn Nachtfenster offen
        deferred: !active, // Aufgeschoben, wenn Tag
        reason: reason,
        durationMinutes: finalDuration, 
        registeredAt: serverTimestamp(),
    }, { merge: true });
    
    return active;
};

// Sucht das spezifische Straf-Item in der Item-Liste
export const findPunishmentItem = (allItems) => {
    if (!allItems || !Array.isArray(allItems)) return null;
    return allItems.find(item => 
        item.mainCategory === PUNISHMENT_ITEM_CATEGORY && 
        item.subCategory === PUNISHMENT_ITEM_SUBCATEGORY &&
        item.status === 'active'
    );
};

// Schließt die Straf-Session ab
export const clearPunishment = async (userId) => {
    const statusRef = doc(db, `users/${userId}/status/punishment`);
    await updateDoc(statusRef, {
        active: false,
        deferred: false,
        reason: null,
        durationMinutes: 0,
        clearedAt: serverTimestamp(),
    });
};

// Prüft auf Bailout und berechnet die Strafdauer dynamisch
export const checkAndRegisterBailout = async (userId, session) => {
    if (!session || !session.startTime || !session.endTime) return false;

    // 1. Wahrscheinlichkeits-Check (Roulette)
    if (Math.random() > BAILOUT_PROBABILITY) {
        return false; 
    }
    
    // 2. Tagesziel laden
    const pSnap = await getDoc(doc(db, `users/${userId}/settings/preferences`));
    const dailyTargetHours = pSnap.exists() ? (pSnap.data().dailyTargetHours || 3) : 3;
    const targetMinutes = dailyTargetHours * 60;
    
    // Session muss vom Typ 'instruction' sein
    if (session.type !== 'instruction') return false;

    const start = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
    const end = session.endTime.toDate ? session.endTime.toDate() : new Date(session.endTime);
    const durationMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
    
    // 3. Prüfen auf Unterfüllung
    const threshold = targetMinutes * 0.8; 

    if (durationMinutes < threshold) {
        // BERECHNUNG DER STRAFDAUER
        const missingMinutes = targetMinutes - durationMinutes;
        const penaltyDuration = Math.ceil(missingMinutes * BAILOUT_PENALTY_FACTOR);

        const reason = `Bailout (${durationMinutes}m von ${targetMinutes}m). Fehlzeit: ${missingMinutes}m.`;
        
        await registerPunishment(userId, reason, penaltyDuration);
        return true; 
    }

    return false; 
};

// Hilfsfunktion für den Oath-Decline im Dashboard
export const registerOathRefusal = async (userId) => {
    // SSOT: Berechnung basierend auf Config
    // Formel: Standard-Dauer * Multiplikator
    const penaltyMinutes = Math.round(punishment.defaultDurationMinutes * punishment.refusalMultiplier);
    await registerPunishment(userId, "Blind Oath verweigert.", penaltyMinutes);
};