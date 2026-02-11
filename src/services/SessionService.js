import { db } from '../firebase';
import { 
    collection, doc, writeBatch, serverTimestamp, getDoc, addDoc, updateDoc, increment 
} from 'firebase/firestore';
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

    // Items vorbereiten
    let itemsToProcess = [];
    if (items && Array.isArray(items) && items.length > 0) {
        itemsToProcess = items;
    } else if (itemId) {
        itemsToProcess = [{ id: itemId }];
    }

    if (itemsToProcess.length === 0) return;
    const allItemIds = itemsToProcess.map(i => i.id);
    const mainItem = itemsToProcess[0]; 

    // --- DEBT PROTOCOL CHECK ---
    const timeBank = await getTimeBankBalance(userId);
    let debtType = null; 
    let debtAmount = 0;

    // Wir prüfen, ob ein Konto im Minus ist
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
        // WÄHRUNGSTRENNUNG: Item muss zur Schuld passen
        const sub = (mainItem.subCategory || '').toLowerCase();
        const cat = (mainItem.mainCategory || '').toLowerCase();
        
        const isNylonItem = sub.includes('strumpfhose') || sub.includes('tights') || 
                            sub.includes('halterlose') || sub.includes('stockings') || 
                            cat.includes('nylons');
        
        if (debtType === 'nylon' && !isNylonItem) {
            throw new Error("BLOCKIERT: Nylon-Schulden müssen mit Nylons getilgt werden.");
        }

        if (debtType === 'lingerie' && isNylonItem) {
             throw new Error("BLOCKIERT: Dessous-Schulden erfordern Lingerie.");
        }

        // Wenn passend: Session wird zur Zwangstilgung
        isDebtSession = true;
        enforcedMinDuration = debtAmount;
        console.log(`DEBT PROTOCOL: Session enforced for ${debtAmount} mins (${debtType}).`);
    }

    // Compliance Lag berechnen
    let lagMinutes = 0;
    if (type === 'instruction' && acceptedAt) {
        const acceptDate = new Date(acceptedAt);
        if (!isNaN(acceptDate.getTime())) {
            const diffMs = Date.now() - acceptDate.getTime();
            lagMinutes = Math.max(0, Math.floor(diffMs / 60000));
        }
    }

    // Session Dokument erstellen
    const sessionData = {
        userId,
        itemId: allItemIds[0], 
        itemIds: allItemIds,   
        type,
        startTime: serverTimestamp(),
        endTime: null,
        isActive: true,
        note,
        targetDurationMinutes: instructionDurationMinutes ? Number(instructionDurationMinutes) : null,
        complianceLagMinutes: lagMinutes,
        
        // DEBT DATA: Das macht die Session zur Falle
        isDebtSession: isDebtSession,
        minDuration: enforcedMinDuration 
    };

    if (type === 'instruction') {
        sessionData.periodId = periodId;
    }
    if (verifiedViaNfc) {
        sessionData.verifiedViaNfc = true;
    }

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

    // Night Compliance
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

    // 2. Item Updates (Status & Stats im Batch)
    const itemIds = sessionData.itemIds || (sessionData.itemId ? [sessionData.itemId] : []);
    const itemDetails = [];

    for (const id of itemIds) {
        const itemRef = doc(db, `users/${userId}/items`, id);
        batch.update(itemRef, { 
            status: 'active', 
            lastWorn: serverTimestamp(),
            wearCount: increment(1),
            totalMinutes: increment(durationMinutes)
        });

        // Vorab laden für Credit-Typ Check
        try {
            const iSnap = await getDoc(itemRef);
            if (iSnap.exists()) itemDetails.push(iSnap.data());
        } catch (e) { console.error(e); }
    }

    // 3. TIME BANK: Earning & Tilgung
    let creditCalculated = false;
    if (sessionData.type !== 'punishment' && !sessionData.tzdExecuted) {
        let eligibleMinutes = 0;

        if (sessionData.isDebtSession) {
            eligibleMinutes = durationMinutes;
        } else if (sessionData.type === 'voluntary') {
            eligibleMinutes = durationMinutes;
        } else if (sessionData.type === 'instruction') {
            const target = Number(sessionData.targetDurationMinutes) || 0;
            if (target > 0 && durationMinutes > target) {
                eligibleMinutes = durationMinutes - target;
            }
        }

        if (eligibleMinutes > 0) {
            const hasNylon = itemDetails.some(item => {
                const sub = (item.subCategory || '').toLowerCase();
                const cat = (item.mainCategory || '').toLowerCase();
                return sub.includes('strumpfhose') || sub.includes('tights') || 
                       sub.includes('halterlose') || sub.includes('stockings') || 
                       cat.includes('nylons');
            });

            const creditType = hasNylon ? 'nylon' : 'lingerie';
            await addCredits(userId, eligibleMinutes, creditType);
            creditCalculated = true;
        }
    }

    await batch.commit(); 

    return { id: sessionId, ...sessionData, endTime, durationMinutes, creditCalculated };
};