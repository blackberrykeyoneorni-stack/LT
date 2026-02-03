import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { safeDate } from '../utils/dateUtils';

// Globale Pfade
const VIBE_TAGS_PATH = 'settings/vibeTags';

// Standard-Tags, falls keine in der DB sind
const defaultVibeTagsList = [
    "Glatt", "Samtig", "Kratzig", "Kühl", "Warm", 
    "Eng anliegend", "Locker", "Sicher", "Verboten", 
    "Verführerisch", "Diskret", "Kraftvoll", "Verspielt",
    "Büro", "Draußen", "Sportlich"
];

// Funktion zum Laden der Tags
export const loadVibeTags = async (userId) => {
    try {
        const tagRef = doc(db, `users/${userId}/${VIBE_TAGS_PATH}`);
        const tagSnap = await getDoc(tagRef);
        
        if (tagSnap.exists()) {
            const data = tagSnap.data();
            if (Array.isArray(data.list)) {
                return data.list;
            }
        }
        
        await setDoc(tagRef, { list: defaultVibeTagsList });
        return defaultVibeTagsList;

    } catch (error) {
        console.error("Fehler beim Laden der Vibe Tags:", error);
        return defaultVibeTagsList;
    }
};

/**
 * Berechnet den Elasthan-Recovery Status eines Items.
 * Zentralisierte Business-Logik (SSOT).
 * * @param {Object} item - Das Item-Objekt
 * @param {Array} sessions - Liste der Sessions für dieses Item
 * @param {number} restingHoursSetting - Die erforderliche Ruhezeit in Stunden
 * @returns {Object|null} - Recovery Info Objekt oder null
 */
export const calculateItemRecoveryStatus = (item, sessions, restingHoursSetting = 24) => {
    if (!item) return null;
    if (item.mainCategory !== 'Nylons') return null;

    let lastWornDate = safeDate(item.lastWorn);

    // Prüfen, ob wir einen neueren Zeitstempel aus den Sessions haben
    // (Falls item.lastWorn nicht korrekt aktualisiert wurde)
    if (sessions && Array.isArray(sessions) && sessions.length > 0) {
        const lastSession = sessions.find(s => s.endTime);
        if (lastSession) {
            const sessionEnd = safeDate(lastSession.endTime);
            if (sessionEnd && (!lastWornDate || sessionEnd > lastWornDate)) {
                lastWornDate = sessionEnd;
            }
        }
    }

    if (!lastWornDate) return null;
    
    const now = new Date();
    const diffMs = now - lastWornDate;
    const hoursSince = diffMs / (1000 * 60 * 60);
    
    if (hoursSince < restingHoursSetting) {
        return {
            isResting: true,
            remainingHours: Math.ceil(restingHoursSetting - hoursSince),
            progress: (hoursSince / restingHoursSetting) * 100
        };
    }

    return null;
};