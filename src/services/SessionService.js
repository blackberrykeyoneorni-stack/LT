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
    
    // 1. Berechne Compliance Lag
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
        itemsToProcess = [{ id: itemId }];
    }

    if (itemsToProcess.length === 0) return;

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

        if (type === 'instruction') {
            sessionData.itemIds = allItemIds;
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
 * FIX: Aktualisiert jetzt auch 'lastWorn', damit der Recovery-Timer startet.
 */
export const stopSession = async (userId, sessionId, feedback = {}) => {
    if (!userId || !sessionId) throw new Error("Parameter fehlen.");

    const sessionRef = doc(db, `users/${userId}/sessions`, sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
        console.error("Session nicht gefunden:", sessionId);
        return;
    }

    const sessionData = sessionSnap.data();
    const batch = writeBatch(db);

    // --- NACHT-COMPLIANCE CHECK ---
    let nightSuccess = null;
    const isInstruction = sessionData.type === 'instruction';
    const isNight = sessionData.period && sessionData.period.toLowerCase().includes('night');

    if (isInstruction && !isNight) {
        nightSuccess = false; 
        
        // FIX: Wir nutzen hier 'new Date()' (Endzeitpunkt), statt 'startTime'.
        // Damit wird die Compliance dem Tag zugeordnet, an dem die Session ENDET.
        // Das löst das Problem bei Sessions über Mitternacht.
        const sessionDate = new Date();

        const offset = sessionDate.getTimezoneOffset() * 60000;
        const dateKey = new Date(sessionDate.getTime() - offset).toISOString().split('T')[0];

        try {
            const complianceRef = doc(db, `users/${userId}/status/nightCompliance`);
            const complianceSnap = await getDoc(complianceRef);
            if (complianceSnap.exists()) {
                const compData = complianceSnap.data();
                if (compData.date === dateKey) {
                    nightSuccess = compData.success;
                }
            }
        } catch (e) { console.error(e); }
    }

    // 1. Session beenden
    const updateData = {
        endTime: serverTimestamp(),
        feelings: feedback.feelings || [],
        finalNote: feedback.note || ''
    };
    if (nightSuccess !== null) {
        updateData.nightSuccess = nightSuccess;
    }
    batch.update(sessionRef, updateData);

    // 2. Item Status zurücksetzen & LAST WORN AKTUALISIEREN
    // Das fehlte vorher, weshalb der Timer nicht startete.
    const updatePayload = { 
        status: 'active',
        lastWorn: serverTimestamp() // FIX: Wichtig für Elasthan Recovery
    };

    if (sessionData.itemIds && Array.isArray(sessionData.itemIds) && sessionData.itemIds.length > 0) {
        sessionData.itemIds.forEach(id => {
            const itemRef = doc(db, `users/${userId}/items`, id);
            batch.update(itemRef, updatePayload);
        });
    } else if (sessionData.itemId) {
        const itemRef = doc(db, `users/${userId}/items`, sessionData.itemId);
        batch.update(itemRef, updatePayload);
    }

    await batch.commit();
};