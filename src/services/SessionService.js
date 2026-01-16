import { db } from '../firebase';
import { collection, doc, writeBatch, serverTimestamp, getDoc } from 'firebase/firestore';

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

/**
 * Beendet eine Session und setzt den Item-Status zurück.
 * Wird vom Dashboard und anderen Komponenten verwendet.
 */
export const stopSession = async (userId, sessionId, feedback = {}) => {
    if (!userId || !sessionId) throw new Error("Parameter fehlen.");

    // Wir müssen zuerst die Session lesen, um die Item-IDs zu bekommen
    const sessionRef = doc(db, `users/${userId}/sessions`, sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
        console.error("Session nicht gefunden:", sessionId);
        return;
    }

    const sessionData = sessionSnap.data();
    const batch = writeBatch(db);

    // 1. Session beenden
    batch.update(sessionRef, {
        endTime: serverTimestamp(),
        feelings: feedback.feelings || [],
        finalNote: feedback.note || ''
    });

    // 2. Item Status zurücksetzen (auf 'active')
    // Prüfen ob es eine Gruppen-Session war (z.B. Instruction)
    if (sessionData.itemIds && Array.isArray(sessionData.itemIds) && sessionData.itemIds.length > 0) {
        sessionData.itemIds.forEach(id => {
            const itemRef = doc(db, `users/${userId}/items`, id);
            // Status zurück auf 'active' setzen
            batch.update(itemRef, { status: 'active' });
        });
    } else if (sessionData.itemId) {
        // Einzel-Session
        const itemRef = doc(db, `users/${userId}/items`, sessionData.itemId);
        batch.update(itemRef, { status: 'active' });
    }

    await batch.commit();
};