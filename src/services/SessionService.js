import { db } from '../firebase';
import { 
    collection, doc, writeBatch, serverTimestamp, getDoc, addDoc, updateDoc 
} from 'firebase/firestore';
import { updateWearStats } from './ItemService';
import { addCredits, getTimeBankBalance } from './TimeBankService';

/**
 * Zentraler Service zum Starten von Sessions.
 * Beinhaltet jetzt die DEBT PROTOCOL Logik (Währungstrennung + TZD-Zwang).
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
        instructionDurationMinutes = null 
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
    const mainItem = itemsToProcess[0]; // Referenz für Kategorie-Check

    // --- DEBT PROTOCOL CHECK ---
    const timeBank = await getTimeBankBalance(userId);
    let debtType = null; // 'nylon', 'lingerie', oder null
    let debtAmount = 0;

    // Priorität: Wo sind die Schulden am höchsten? (Oder einfach NC zuerst prüfen)
    if (timeBank.nc < 0) {
        debtType = 'nylon';
        debtAmount = Math.abs(timeBank.nc);
    } else if (timeBank.lc < 0) {
        debtType = 'lingerie';
        debtAmount = Math.abs(timeBank.lc);
    }

    let isDebtSession = false;
    let enforcedMinDuration = 0;

    if (debtType) {
        // WÄHRUNGSTRENNUNG PRÜFEN
        // Ist das Item passend zur Schuld?
        const sub = (mainItem.subCategory || '').toLowerCase();
        const cat = (mainItem.mainCategory || '').toLowerCase();
        
        const isNylonItem = sub.includes('strumpfhose') || sub.includes('tights') || 
                            sub.includes('halterlose') || sub.includes('stockings') || 
                            cat.includes('nylons');
        
        if (debtType === 'nylon' && !isNylonItem) {
            // FEHLER: Du hast Nylon Schulden, versuchst aber was anderes zu starten.
            // Wir werfen einen Fehler, der im UI als Toast angezeigt werden sollte.
            throw new Error("BLOCKIERT: Nylon-Schulden müssen mit Nylons getilgt werden.");
        }

        if (debtType === 'lingerie' && isNylonItem) {
             // Optional: Lingerie Schulden, aber Nylon Item. 
             // Wenn man streng ist: Verboten. Wenn man locker ist: Nylons zählen nicht als Dessous-Tilgung.
             // Laut Prompt: "Währungstrennung". Also strikt.
             throw new Error("BLOCKIERT: Dessous-Schulden erfordern Lingerie.");
        }

        // Wenn wir hier sind, passt das Item zur Schuld.
        // Session wird zur TILGUNGS-SESSION
        isDebtSession = true;
        enforcedMinDuration = debtAmount;
        console.log(`DEBT PROTOCOL: Session enforced for ${debtAmount} mins (${debtType}).`);
    }


    // 2. Compliance Lag berechnen
    let lagMinutes = 0;
    if (type === 'instruction' && acceptedAt) {
        const acceptDate = new Date(acceptedAt);
        if (!isNaN(acceptDate.getTime())) {
            const diffMs = Date.now() - acceptDate.getTime();
            lagMinutes = Math.max(0, Math.floor(diffMs / 60000));
        }
    }

    // 3. Session Dokument erstellen
    const sessionData = {
        userId,
        itemId: allItemIds[0], 
        itemIds: allItemIds,   
        type,
        startTime: serverTimestamp(),
        endTime: null,
        isActive: true,
        note,
        targetDurationMinutes: instructionDurationMinutes || null,
        complianceLagMinutes: lagMinutes,
        
        // NEU: Debt Data
        isDebtSession: isDebtSession,
        minDuration: enforcedMinDuration // Das ActiveSessionsList UI sperrt den Button hiermit
    };

    if (type === 'instruction') {
        sessionData.periodId = periodId;
    }
    if (verifiedViaNfc) {
        sessionData.verifiedViaNfc = true;
    }

    // DB Operations
    const sessionRef = await addDoc(collection(db, `users/${userId}/sessions`), sessionData);
    const batch = writeBatch(db);

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
    const startTime = sessionData.startTime?.toDate ? sessionData.startTime.toDate() : new Date(); 
    const durationMinutes = Math.round((endTime - startTime) / 60000);

    // --- NACHT-COMPLIANCE CHECK ---
    let nightSuccess = null;
    const isInstruction = sessionData.type === 'instruction';
    const isNight = sessionData.periodId && sessionData.periodId.toLowerCase().includes('night');

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

    // 2. Item Status zurücksetzen
    const itemIds = sessionData.itemIds || (sessionData.itemId ? [sessionData.itemId] : []);
    
    itemIds.forEach(id => {
        const itemRef = doc(db, `users/${userId}/items`, id);
        batch.update(itemRef, { 
            status: 'active',
            lastWorn: serverTimestamp() 
        });
    });

    await batch.commit(); 

    // 3. ASYNC STATS UPDATES
    for (const id of itemIds) {
        await updateWearStats(userId, id, durationMinutes);
    }

    // 4. TIME BANK LOGIK (EARNING & TILGUNG)
    // Wenn es eine Debt-Session war, zählt JEDE Minute zur Tilgung (Verhältnis 1:1 bei Tilgung)
    // Wenn es normal war, zählt nur Overtime.
    // TimeBankService.addCredits unterscheidet intern ob Saldo < 0 ist.
    
    if (sessionData.type !== 'punishment' && !sessionData.tzdExecuted) {
        let eligibleMinutes = 0;

        if (sessionData.isDebtSession) {
            // Bei Schulden zählt alles, um das Loch zu füllen
            eligibleMinutes = durationMinutes;
        } else if (sessionData.type === 'voluntary') {
            eligibleMinutes = durationMinutes;
        } else if (sessionData.type === 'instruction') {
            const target = sessionData.targetDurationMinutes || 0;
            if (durationMinutes > target && target > 0) {
                eligibleMinutes = durationMinutes - target;
            }
        }

        if (eligibleMinutes > 0) {
            let creditType = 'lingerie';
            try {
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
                // HIER: addCredits ruft intern die Logik auf.
                await addCredits(userId, eligibleMinutes, creditType);
            } catch(e) { console.error("Error calculating credits", e); }
        }
    }

    return { ...sessionData, endTime, durationMinutes };
};