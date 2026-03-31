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
    let totalWornHours = 0;
    let isCurrentlyWorn = false;

    // --- LCRP: Ledger-Centric Recovery Protocol ---
    if (sessions && Array.isArray(sessions) && sessions.length > 0) {
        const now = new Date();
        const microBlocks = [];

        // 1. Extraktion der Micro-Blocks (Item-Zeiten statt Session-Zeiten)
        sessions.forEach(s => {
            const hasItem = (s.itemIds && s.itemIds.includes(item.id)) || s.itemId === item.id || (s.itemLedger && s.itemLedger[item.id]);
            if (!hasItem) return;

            let joinedAt = safeDate(s.startTime);
            let leftAt = safeDate(s.endTime);

            if (s.itemLedger && s.itemLedger[item.id]) {
                const ledger = s.itemLedger[item.id];
                if (ledger.joinedAt) joinedAt = safeDate(ledger.joinedAt);
                if (ledger.leftAt) leftAt = safeDate(ledger.leftAt);
            }

            if (!joinedAt) return; // Ohne Startzeit kein Block

            if (!leftAt) {
                leftAt = now;
                isCurrentlyWorn = true; // Item wird exakt in diesem Moment getragen
            }

            microBlocks.push({ joinedAt, leftAt });
        });

        // 2. Filtern und sortieren nach leftAt absteigend (neueste Blöcke zuerst)
        microBlocks.sort((a, b) => b.leftAt - a.leftAt);

        if (microBlocks.length > 0) {
            const latestBlock = microBlocks[0];
            
            if (!lastWornDate || latestBlock.leftAt > lastWornDate) {
                lastWornDate = isCurrentlyWorn ? now : latestBlock.leftAt;
            }

            // 3. Rückwärts-Traversieren für nahtlose Item-Ketten
            let totalWornMs = Math.max(0, latestBlock.leftAt - latestBlock.joinedAt);
            let currentChainStart = latestBlock.joinedAt;

            for (let i = 1; i < microBlocks.length; i++) {
                const prevBlock = microBlocks[i];
                const gapMs = currentChainStart - prevBlock.leftAt;

                // Toleranz: Maximal 15 Minuten Pause zwischen dem Ablegen und Wiederanziehen
                if (gapMs <= 15 * 60 * 1000) {
                    totalWornMs += Math.max(0, prevBlock.leftAt - prevBlock.joinedAt); // Keine Fehler durch invertierte Zeiten
                    currentChainStart = prevBlock.joinedAt < currentChainStart ? prevBlock.joinedAt : currentChainStart;
                } else {
                    break; // Echte Pause erkannt, Kette bricht ab
                }
            }
            
            totalWornHours = totalWornMs / (1000 * 60 * 60);
        }
    }

    // Wenn das Item jetzt gerade getragen wird, gibt es keine Erholung.
    if (isCurrentlyWorn) return null;

    if (!lastWornDate) return null;
    
    // --- Dynamische Recovery-Zeit Berechnung inkl. 10% Sicherheitspuffer ---
    let requiredRestingHours = 26.4; // Fallback (24h + 10%)
    
    if (totalWornHours > 0) {
        if (totalWornHours <= 2) {
            requiredRestingHours = 6 * 1.1; // 6.6 Stunden
        } else if (totalWornHours <= 6) {
            requiredRestingHours = 12 * 1.1; // 13.2 Stunden
        } else if (totalWornHours <= 12) {
            requiredRestingHours = 24 * 1.1; // 26.4 Stunden
        } else {
            requiredRestingHours = 48 * 1.1; // 52.8 Stunden
        }
    }

    const diffMs = new Date() - lastWornDate;
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
 * Fügt ein neues Item hinzu (inklusive ULP CREATED Event).
 */
export const addItem = async (userId, itemData, customId = null) => {
    const payload = {
        ...itemData,
        createdAt: serverTimestamp(),
        wearCount: 0,
        totalMinutes: 0,
        status: 'active', // active, washing, archived, worn
        historyLog: [{ type: 'CREATED', date: new Date().toISOString(), data: { message: 'Ins Inventar aufgenommen' } }]
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
 * Aktualisiert ein bestehendes Item (inklusive ULP METADATA_UPDATED Event).
 */
export const updateItem = async (userId, itemId, data) => {
    const itemRef = doc(db, `users/${userId}/${COLLECTION_NAME}`, itemId);
    await updateDoc(itemRef, {
        ...data,
        updatedAt: serverTimestamp(),
        historyLog: arrayUnion({ type: 'METADATA_UPDATED', date: new Date().toISOString(), data: { message: 'Eigenschaften modifiziert' } })
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
 */
export const updateWearStats = async (userId, itemId, durationMinutes) => {
    if (!userId || !itemId) return;
    
    const itemRef = doc(db, `users/${userId}/${COLLECTION_NAME}`, itemId);
    
    await updateDoc(itemRef, {
        wearCount: increment(1),
        totalMinutes: increment(durationMinutes),
        lastWorn: serverTimestamp(),
        lastSessionDurationMinutes: durationMinutes 
    });
};

/**
 * Setzt den Status eines Items (Legacy, für einfache Aufrufe).
 */
export const setItemStatus = async (userId, itemId, status) => {
    const itemRef = doc(db, `users/${userId}/${COLLECTION_NAME}`, itemId);
    await updateDoc(itemRef, { status });
};

/**
 * Gatekeeper: Setzt den Item-Status auf 'washing' und loggt WASH_PENDING.
 */
export const markItemAsWashing = async (userId, itemId) => {
    const itemRef = doc(db, `users/${userId}/${COLLECTION_NAME}`, itemId);
    const entry = { type: 'WASH_PENDING', date: new Date().toISOString(), data: { message: 'Zur Reinigung hinzugefügt' } };
    await updateDoc(itemRef, {
        status: 'washing',
        cleanDate: null,
        historyLog: arrayUnion(entry)
    });
    return entry;
};

/**
 * Gatekeeper: Setzt den Item-Status auf 'active' und loggt WASHED.
 */
export const markItemAsWashed = async (userId, itemId) => {
    const itemRef = doc(db, `users/${userId}/${COLLECTION_NAME}`, itemId);
    const entry = { type: 'WASHED', date: new Date().toISOString(), data: { message: 'Gewaschen und verfügbar' } };
    await updateDoc(itemRef, {
        status: 'active',
        cleanDate: serverTimestamp(),
        historyLog: arrayUnion(entry)
    });
    return entry;
};

/**
 * Gatekeeper: Archiviert ein Item und loggt ARCHIVED.
 */
export const archiveItemRecord = async (userId, itemId, archiveData) => {
    const itemRef = doc(db, `users/${userId}/${COLLECTION_NAME}`, itemId);
    const entry = { type: 'ARCHIVED', date: new Date().toISOString(), data: { reason: archiveData.reason, message: 'Aus dem aktiven Bestand entfernt' } };
    await updateDoc(itemRef, {
        status: 'archived',
        archiveReason: archiveData.reason,
        archiveDate: serverTimestamp(),
        runLocation: archiveData.reason === 'run' ? archiveData.runLocation : null,
        runCause: archiveData.reason === 'run' ? archiveData.runCause : null,
        historyLog: arrayUnion(entry)
    });
    return entry;
};

/**
 * Fügt einen manuellen Eintrag zur Item-Historie hinzu.
 */
export const addItemHistoryEntry = async (userId, itemId, entry) => {
    if (!userId || !itemId) return;
    const itemRef = doc(db, `users/${userId}/${COLLECTION_NAME}`, itemId);
    await updateDoc(itemRef, {
        historyLog: arrayUnion({
            ...entry,
            date: new Date().toISOString()
        })
    });
};