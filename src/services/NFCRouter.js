import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Prüft, was der gescannte Tag in deiner Datenbank bedeutet.
 */
export const resolveTagAction = async (userId, tagId) => {
    // 1. LAGERORT CHECK (Ist es eine Box?)
    try {
        const locRef = doc(db, `users/${userId}/settings/locationIndex`);
        const locSnap = await getDoc(locRef);
        
        if (locSnap.exists()) {
            const map = locSnap.data();
            if (map[tagId]) {
                return { 
                    type: 'FILTER_INVENTORY', 
                    target: '/inventory', 
                    payload: { location: map[tagId] },
                    message: `Lagerort: ${map[tagId]}`
                };
            }
        }
    } catch (e) {
        console.error("Fehler beim Lagerort-Check", e);
    }

    // 2. ITEM CHECK (Ist es ein Kleidungsstück?)
    try {
        let itemSnap = await getDoc(doc(db, `users/${userId}/items`, tagId));
        
        // Wenn nicht direkt als ID gefunden, suche in den Feldern nfcTagId oder customId
        if (!itemSnap.exists()) {
            const q1 = query(collection(db, `users/${userId}/items`), where('nfcTagId', '==', tagId));
            const s1 = await getDocs(q1);
            if (!s1.empty) itemSnap = s1.docs[0];
            
            if (!itemSnap.exists()) {
                const q2 = query(collection(db, `users/${userId}/items`), where('customId', '==', tagId));
                const s2 = await getDocs(q2);
                if (!s2.empty) itemSnap = s2.docs[0];
            }
        }

        if (itemSnap && itemSnap.exists()) {
            const data = itemSnap.data();
            return { 
                type: 'NAVIGATE_ITEM', 
                target: `/item/${itemSnap.id}`, 
                payload: { id: itemSnap.id, ...data }, // Wir geben das Item zurück
                message: `Item erkannt: ${data.name || data.brand}`
            };
        }

    } catch (e) {
        console.error("Fehler beim Item-Check", e);
    }

    // 3. Unbekannt
    return { type: 'UNKNOWN', tagId, message: 'Tag unbekannt oder leer.' };
};
