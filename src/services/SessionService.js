import { db } from '../firebase';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';

/**
 * Zentraler Service zum Starten von Sessions.
 * Verhindert Redundanz zwischen Dashboard, ItemDetail und NFC-Dialog.
 */
export const startSession = async (userId, params) => {
    const { 
        items,      // Array von Items (bei Multi-Start / Instruction)
        itemId,     // Einzelne Item-ID (bei Single-Start)
        type = 'voluntary', 
        periodId, 
        acceptedAt, // Timestamp/String wann die Instruction akzeptiert wurde (für Lag)
        note = '', 
        verifiedViaNfc = false 
    } = params;

    if (!userId) throw new Error("User ID fehlt.");

    const batch = writeBatch(db);
    
    // 1. Berechne Compliance Lag (Zentralisierte Logik)
    let lagMinutes = 0;
    if (type === 'instruction' && acceptedAt) {
        const acceptDate = new Date(acceptedAt);
        if (!isNaN(acceptDate.getTime())) {
            const diffMs = Date.now() - acceptDate.getTime();
            lagMinutes = Math.max(0, Math.floor(diffMs / 60000));
        }
    }

    // 2. Items vorbereiten
    let itemsToProcess = [];
    if (items && Array.isArray(items) && items.length > 0) {
        itemsToProcess = items;
    } else if (itemId) {
        // Fallback für Einzel-Start, falls kein Item-Objekt übergeben wurde
        itemsToProcess = [{ id: itemId }];
    }

    if (itemsToProcess.length === 0) return;

    // Alle IDs sammeln (für das itemIds Array im Dokument)
    const allItemIds = itemsToProcess.map(i => i.id);

    // 3. Batch Operationen erstellen
    itemsToProcess.forEach(item => {
        const sessionRef = doc(collection(db, `users/${userId}/sessions`));
        
        const sessionData = {
            itemId: item.id,
            type,
            startTime: serverTimestamp(),
            endTime: null,
            note
        };

        // Instruction-spezifische Felder
        if (type === 'instruction') {
            sessionData.itemIds = allItemIds; // Verknüpfung der Gruppe
            sessionData.period = periodId;
            sessionData.complianceLagMinutes = lagMinutes;
        }

        if (verifiedViaNfc) {
            sessionData.verifiedViaNfc = true;
        }

        batch.set(sessionRef, sessionData);

        // Update Item Status auf 'wearing'
        batch.update(doc(db, `users/${userId}/items`, item.id), { status: 'wearing' });
    });

    await batch.commit();
};
