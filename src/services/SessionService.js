import { db } from '../firebase';
import { 
    collection, doc, writeBatch, serverTimestamp, getDoc, addDoc, updateDoc 
} from 'firebase/firestore';
import { updateWearStats } from './ItemService';
import { addCredits } from './TimeBankService';

/**
 * Zentraler Service zum Starten von Sessions.
 * Aggregiert mehrere Items in eine Session für korrekte Time-Bank-Abrechnung.
 */
export const startSession = async (userId, params) => {
    const { 
        items,      
        itemId,     
        type = 'voluntary', 
        periodId, 
        acceptedAt, 
        note = '', 
        verifiedViaNfc = false,
        instructionDurationMinutes = null // Zielzeit für Time Bank Kalkulation
    } = params;

    if (!userId) throw new Error("User ID fehlt.");

    // 1. Items vorbereiten
    let itemsToProcess = [];
    if (items && Array.isArray(items) && items.length > 0) {
        itemsToProcess = items;
    } else if (itemId) {
        itemsToProcess = [{ id: itemId }];
    }

    if (itemsToProcess.length === 0) return;
    const allItemIds = itemsToProcess.map(i => i.id);

    // 2. Compliance Lag berechnen
    let lagMinutes = 0;
    if (type === 'instruction' && acceptedAt) {
        const acceptDate = new Date(acceptedAt);
        if (!isNaN(acceptDate.getTime())) {
            const diffMs = Date.now() - acceptDate.getTime();
            lagMinutes = Math.max(0, Math.floor(diffMs / 60000));
        }
    }

    // 3. Session Dokument erstellen (Aggregiert)
    const sessionData = {
        userId,
        itemId: allItemIds[0], // Haupt-Item für Referenz
        itemIds: allItemIds,   // Alle Items
        type,
        startTime: serverTimestamp(),
        endTime: null,
        isActive: true,
        note,
        targetDurationMinutes: instructionDurationMinutes || null, // Wichtig für Time Bank
        complianceLagMinutes: lagMinutes
    };

    if (type === 'instruction') {
        sessionData.periodId = periodId;
    }

    if (verifiedViaNfc) {
        sessionData.verifiedViaNfc = true;
    }

    // Wir nutzen addDoc für die Session, aber batch für die Item-Updates
    const sessionRef = await addDoc(collection(db, `users/${userId}/sessions`), sessionData);
    const batch = writeBatch(db);

    // Update Item Status auf 'wearing' für ALLE Items
    allItemIds.forEach(id => {
        batch.update(doc(db, `users/${userId}/items`, id), { status: 'wearing' });
    });

    await batch.commit();

    return { id: sessionRef.id, ...sessionData };
};

/**
 * Beendet eine Session, aktualisiert Stats und berechnet Time Bank Credits.
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
    const endTime = new Date();
    // Falls startTime noch ein ServerTimestamp Placeholder ist, nutzen wir lokale Zeit als Fallback (selten)
    const startTime = sessionData.startTime?.toDate ? sessionData.startTime.toDate() : new Date(); 
    const durationMinutes = Math.round((endTime - startTime) / 60000);

    // --- NACHT-COMPLIANCE CHECK (Preserved Logic) ---
    let nightSuccess = null;
    const isInstruction = sessionData.type === 'instruction';
    const isNight = sessionData.periodId && sessionData.periodId.toLowerCase().includes('night'); // periodId angepasst

    if (isInstruction && !isNight) {
        nightSuccess = false; 
        const offset = endTime.getTimezoneOffset() * 60000;
        const dateKey = new Date(endTime.getTime() - offset).toISOString().split('T')[0];

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

    // 1. Session schließen
    const updateData = {
        endTime: serverTimestamp(),
        isActive: false,
        durationMinutes,
        feelings: feedback.feelings || [],
        finalNote: feedback.note || ''
    };
    if (nightSuccess !== null) {
        updateData.nightSuccess = nightSuccess;
    }
    batch.update(sessionRef, updateData);

    // 2. Item Status zurücksetzen & Stats aktualisieren
    const itemIds = sessionData.itemIds || (sessionData.itemId ? [sessionData.itemId] : []);
    
    // Batch Update für Status
    itemIds.forEach(id => {
        const itemRef = doc(db, `users/${userId}/items`, id);
        batch.update(itemRef, { 
            status: 'active',
            lastWorn: serverTimestamp() 
        });
    });

    await batch.commit(); // Batch erst committen

    // 3. ASYNC STATS UPDATES (Nicht im Batch)
    // wearCount und totalMinutes hochzählen
    for (const id of itemIds) {
        await updateWearStats(userId, id, durationMinutes);
    }

    // 4. TIME BANK LOGIK (EARNING)
    // Credits nur für Voluntary oder Instruction-Overtime
    if (sessionData.type !== 'punishment' && !sessionData.tzdExecuted) {
        let eligibleMinutes = 0;

        if (sessionData.type === 'voluntary') {
            // Voluntary: Volle Zeit zählt (Kurs wird im Service berechnet)
            eligibleMinutes = durationMinutes;
        } else if (sessionData.type === 'instruction') {
            // Instruction: Nur Zeit ÜBER dem Ziel zählt
            const target = sessionData.targetDurationMinutes || 0;
            if (durationMinutes > target && target > 0) {
                eligibleMinutes = durationMinutes - target;
            }
        }

        if (eligibleMinutes > 0) {
            // Typ bestimmen (Nylon vs Lingerie) anhand des ersten Items
            let creditType = 'lingerie';
            try {
                // Wir holen das Item um die Kategorie zu prüfen
                const firstItemId = itemIds[0];
                const itemSnap = await getDoc(doc(db, `users/${userId}/items`, firstItemId));
                if (itemSnap.exists()) {
                    const item = itemSnap.data();
                    const sub = (item.subCategory || '').toLowerCase();
                    const cat = (item.mainCategory || '').toLowerCase();
                    
                    if (sub.includes('strumpfhose') || sub.includes('tights') || 
                        sub.includes('halterlose') || sub.includes('stockings') || 
                        cat.includes('nylons')) {
                        creditType = 'nylon';
                    }
                }
                // Credits gutschreiben
                await addCredits(userId, eligibleMinutes, creditType);
            } catch(e) { console.error("Error calculating credits", e); }
        }
    }

    return { ...sessionData, endTime, durationMinutes };
};