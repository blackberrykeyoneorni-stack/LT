import { db } from '../firebase';
import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    getDoc,
    setDoc,
    increment 
} from 'firebase/firestore';
import { safeDate } from '../utils/dateUtils';

const COLLECTION_NAME = 'items';
const VIBE_TAGS_PATH = 'settings/vibeTags';

// --- VIBE TAGS LOGIK ---

const defaultVibeTagsList = [
    "Glatt", "Samtig", "Kratzig", "Kühl", "Warm", 
    "Eng anliegend", "Locker", "Sicher", "Verboten", 
    "Verführerisch", "Diskret", "Kraftvoll", "Verspielt",
    "Büro", "Draußen", "Sportlich"
];

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

// --- RECOVERY LOGIK ---

export const calculateItemRecoveryStatus = (item, sessions, restingHoursSetting = 24) => {
    if (!item) return null;
    if (item.mainCategory !== 'Nylons') return null;

    let lastWornDate = safeDate(item.lastWorn);

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

// --- CRUD & STATS LOGIK (Das fehlte) ---

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
export const addItem = async (userId, itemData) => {
    return await addDoc(collection(db, `users/${userId}/${COLLECTION_NAME}`), {
        ...itemData,
        createdAt: serverTimestamp(),
        wearCount: 0,
        totalMinutes: 0,
        status: 'active', // active, washing, archived, worn
        historyLog: []
    });
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