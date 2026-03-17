import { db } from '../firebase';
import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    setDoc,
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    increment,
    arrayUnion
} from 'firebase/firestore';
import { safeDate } from '../utils/dateUtils';

const COLLECTION_NAME = 'items';

// --- RECOVERY LOGIK ---

export const calculateItemRecoveryStatus = (item, sessions) => {
    if (!item) return null;
    if (item.mainCategory !== 'Nylons') return null;

    let lastWornDate = safeDate(item.lastWorn);
    let latestSession = null;

    if (sessions && Array.isArray(sessions) && sessions.length > 0) {
        // Robustes Ermitteln der absolut letzten beendeten Session (unabhängig von der Array-Sortierung)
        latestSession = sessions.reduce((latest, current) => {
            if (!current.endTime) return latest;
            const currentEnd = safeDate(current.endTime);
            if (!currentEnd) return latest;
            
            if (!latest) return current;
            const latestEnd = safeDate(latest.endTime);
            return currentEnd > latestEnd ? current : latest;
        }, null);

        if (latestSession) {
            const sessionEnd = safeDate(latestSession.endTime);
            if (sessionEnd && (!lastWornDate || sessionEnd > lastWornDate)) {
                lastWornDate = sessionEnd;
            }
        }
    }

    if (!lastWornDate) return null;
    
    // --- NEU: Dynamische Recovery-Zeit Berechnung inkl. 10% Sicherheitspuffer ---
    let requiredRestingHours = 26.4; // Fallback (24h + 10%), falls Session-Dauer unklar
    
    if (latestSession && latestSession.startTime && latestSession.endTime) {
        const start = safeDate(latestSession.startTime);
        const end = safeDate(latestSession.endTime);
        if (start && end) {
            const wornHours = (end - start) / (1000 * 60 * 60);
            
            if (wornHours <= 2) {
                requiredRestingHours = 6 * 1.1; // 6.6 Stunden
            } else if (wornHours <= 6) {
                requiredRestingHours = 12 * 1.1; // 13.2 Stunden
            } else if (wornHours <= 12) {
                requiredRestingHours = 24 * 1.1; // 26.4 Stunden
            } else {
                requiredRestingHours = 48 * 1.1; // 52.8 Stunden
            }
        }
    }

    const now = new Date();
    const diffMs = now - lastWornDate;
    const hoursSince = diffMs / (1000 * 60 * 60);
    
    if (hoursSince < requiredRestingHours) {
        return {
            isResting: true,
            remainingHours: requiredRestingHours - hoursSince,
            progress: (hoursSince / requiredRestingHours) * 100
        };
    }

    return null;
};

// --- CRUD & STATS LOGIK ---

/**
 * Abonniert alle Items eines Users (Realtime).
 */
export const subscribeToItems = (userId, callback) => {
    const q = query(
        collection(db, `users/${userId}/${COLLECTION_NAME}`),
        orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(items);
    });
};

/**
 * Fügt ein neues Item hinzu.
 */
export const addItem = async (userId, itemData, customId = null) => {
    const payload = {
        ...itemData,
        createdAt: serverTimestamp(),
        wearCount: 0,
        totalMinutes: 0,
        status: 'active', // active, washing, archived, worn
        historyLog: []
    };

    if (customId) {
        const itemRef = doc(db, `users/${userId}/${COLLECTION_NAME}`, customId);
        await setDoc(itemRef, payload);
        return itemRef;
    } else {
        return await addDoc(collection(db, `users/${userId}/${COLLECTION_NAME}`), payload);
    }
};

/**
 * Aktualisiert ein bestehendes Item.
 */
export const updateItem = async (userId, itemId, data) => {
    const itemRef = doc(db, `users/${userId}/${COLLECTION_NAME}`, itemId);
    await updateDoc(itemRef, {
        ...data,
        updatedAt: serverTimestamp()
    });
};

/**
 * Löscht ein Item.
 */
export const deleteItem = async (userId, itemId) => {
    const itemRef = doc(db, `users/${userId}/${COLLECTION_NAME}`, itemId);
    await deleteDoc(itemRef);
};

/**
 * Aktualisiert die Trage-Statistiken eines Items nach einer Session.
 * WICHTIG: Wird vom SessionService aufgerufen.
 */
export const updateWearStats = async (userId, itemId, durationMinutes) => {
    if (!userId || !itemId) return;
    
    const itemRef = doc(db, `users/${userId}/${COLLECTION_NAME}`, itemId);
    
    await updateDoc(itemRef, {
        wearCount: increment(1),
        totalMinutes: increment(durationMinutes),
        lastWorn: serverTimestamp()
    });
};

/**
 * Setzt den Status eines Items (z.B. auf 'washing').
 */
export const setItemStatus = async (userId, itemId, status) => {
    const itemRef = doc(db, `users/${userId}/${COLLECTION_NAME}`, itemId);
    await updateDoc(itemRef, { status });
};

/**
 * Fügt einen Eintrag zur Item-Historie hinzu.
 */
export const addItemHistoryEntry = async (userId, itemId, entry) => {
    if (!userId || !itemId) return;
    const itemRef = doc(db, `users/${userId}/${COLLECTION_NAME}`, itemId);
    await updateDoc(itemRef, {
        historyLog: arrayUnion({
            ...entry,
            timestamp: new Date().toISOString()
        })
    });
};