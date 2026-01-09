import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Globale Pfade
const VIBE_TAGS_PATH = 'settings/vibeTags';

// Standard-Tags, falls keine in der DB sind
const defaultVibeTagsList = [
    "Glatt", "Samtig", "Kratzig", "Kühl", "Warm", 
    "Eng anliegend", "Locker", "Sicher", "Verboten", 
    "Verführerisch", "Diskret", "Kraftvoll", "Verspielt",
    "Büro", "Draußen", "Sportlich"
];

// Funktion zum Laden der Tags (Wird von ItemDetail benötigt!)
export const loadVibeTags = async (userId) => {
    try {
        const tagRef = doc(db, `users/${userId}/${VIBE_TAGS_PATH}`);
        const tagSnap = await getDoc(tagRef);
        
        if (tagSnap.exists()) {
            const data = tagSnap.data();
            // Prüfen ob es ein Array ist und Array zurückgeben
            if (Array.isArray(data.list)) {
                return data.list;
            }
        }
        
        // Falls leer oder falsch formatiert, initialisieren wir es
        await setDoc(tagRef, { list: defaultVibeTagsList });
        return defaultVibeTagsList;

    } catch (error) {
        console.error("Fehler beim Laden der Vibe Tags:", error);
        return defaultVibeTagsList;
    }
};
