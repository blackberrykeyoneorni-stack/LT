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

    // HINWEIS: Die Wochenendsperre für Instructions wird bereits UI-seitig 
    // im Dashboard/InstructionDialog über 'isFreeDay' geregelt.
    // Daher hier keine redundante Prüfung notwendig.

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
 * NEU: Prüft und speichert bei Tages-Instructions die Nacht-Compliance.
 */
export const stopSession = async (userId, sessionId, feedback = {}) => {
    if (!userId || !sessionId) throw new Error("Parameter fehlen.");

    // Wir müssen zuerst die Session lesen, um Typ und Item-IDs zu bekommen
    const sessionRef = doc(db, `users/${userId}/sessions`, sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
        console.error("Session nicht gefunden:", sessionId);
        return;
    }

    const sessionData = sessionSnap.data();
    const batch = writeBatch(db);

    // --- NEU: NACHT-COMPLIANCE CHECK ---
    // Nur relevant für Tag-Instructions (instruction ohne 'night')
    // Wir speichern das Ergebnis direkt in der Session, um die Auswertung zu erleichtern.
    let nightSuccess = null; // null = nicht relevant (z.B. voluntary oder night session)
    
    const isInstruction = sessionData.type === 'instruction';
    const isNight = sessionData.period && sessionData.period.toLowerCase().includes('night');

    if (isInstruction && !isNight) {
        // Default auf false (fail safe), falls Check fehlschlägt
        nightSuccess = false; 
        
        // Wir prüfen den Nacht-Status für das Datum der Session.
        const sessionDate = sessionData.startTime && sessionData.startTime.toDate 
            ? sessionData.startTime.toDate() 
            : new Date();
            
        // Format YYYY-MM-DD
        const offset = sessionDate.getTimezoneOffset() * 60000;
        const dateKey = new Date(sessionDate.getTime() - offset).toISOString().split('T')[0];

        try {
            const complianceRef = doc(db, `users/${userId}/status/nightCompliance`);
            const complianceSnap = await getDoc(complianceRef);
            
            if (complianceSnap.exists()) {
                const compData = complianceSnap.data();
                // Check ob das Datum übereinstimmt (Status muss aktuell sein)
                if (compData.date === dateKey) {
                    nightSuccess = compData.success;
                } else {
                    console.warn(`StopSession: Kein aktueller Nacht-Check für ${dateKey} gefunden (Gefunden: ${compData.date}).`);
                }
            }
        } catch (e) {
            console.error("Fehler beim Abruf der Nacht-Compliance:", e);
        }
    }

    // 1. Session beenden & Ergebnis schreiben
    const updateData = {
        endTime: serverTimestamp(),
        feelings: feedback.feelings || [],
        finalNote: feedback.note || ''
    };

    // Speichern des Nacht-Status, falls relevant
    if (nightSuccess !== null) {
        updateData.nightSuccess = nightSuccess;
    }

    batch.update(sessionRef, updateData);

    // 2. Item Status zurücksetzen (auf 'active')
    if (sessionData.itemIds && Array.isArray(sessionData.itemIds) && sessionData.itemIds.length > 0) {
        sessionData.itemIds.forEach(id => {
            const itemRef = doc(db, `users/${userId}/items`, id);
            batch.update(itemRef, { status: 'active' });
        });
    } else if (sessionData.itemId) {
        // Einzel-Session
        const itemRef = doc(db, `users/${userId}/items`, sessionData.itemId);
        batch.update(itemRef, { status: 'active' });
    }

    await batch.commit();
};