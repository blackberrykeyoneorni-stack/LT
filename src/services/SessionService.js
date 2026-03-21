import { db } from '../firebase';
import { collection, doc, writeBatch, serverTimestamp, getDoc, addDoc, setDoc, increment } from 'firebase/firestore';
import { updateWearStats, addItemHistoryEntry, setItemStatus } from './ItemService';
import { addCredits, getTimeBankBalance, calculateEarnedCredits } from './TimeBankService';
import { registerPunishment } from './PunishmentService';

export const startSession = async (userId, sessionData) => {
    if (!userId || !sessionData) throw new Error("Parameter fehlen.");

    try {
        // TIME BANKRUPTCY CHECK
        const tbBalance = await getTimeBankBalance(userId);
        if (tbBalance && tbBalance.isBankrupt && !sessionData.type.includes('debt') && !sessionData.type.includes('punishment')) {
            throw new Error("TIME BANKRUPTCY. Freiwillige Sessions gesperrt.");
        }

        const items = sessionData.items || [];
        const itemIds = items.map(i => i.id);

        if (itemIds.length === 0 && sessionData.itemId) {
            itemIds.push(sessionData.itemId);
            items.push({ id: sessionData.itemId });
        }

        if (itemIds.length === 0) throw new Error("Keine Items ausgewählt.");

        let isDebtSession = false;
        let minDuration = 0;
        if (tbBalance && tbBalance.debtLocked) {
             isDebtSession = true;
             minDuration = 60; // 1 Stunde Pflicht-Tilgung
        }

        const payload = {
            itemIds,
            itemsDetails: items.map(i => ({
                id: i.id,
                name: i.name || i.subCategory || 'Unknown',
                brand: i.brand || 'Unknown',
                category: i.category || i.mainCategory || 'Nylons',
                customId: i.customId || null, 
                imageUrl: i.imageUrl || (i.images && i.images.length > 0 ? i.images[0] : null)
            })),
            type: sessionData.type || 'voluntary',
            periodId: sessionData.periodId || null,
            acceptedAt: sessionData.acceptedAt || null,
            verifiedViaNfc: sessionData.verifiedViaNfc || false,
            isDebtSession,
            minDuration,
            targetDurationMinutes: sessionData.instructionDurationMinutes || sessionData.targetDurationMinutes || 0, // NEU: Fix für Exploits bei Overtime-Credits
            startTime: serverTimestamp(),
            endTime: null,
            durationMinutes: 0,
            isActive: true,
            isPornActive: false // Neu für TZD Porn-Detektion
        };

        const batch = writeBatch(db);

        const newSessionRef = doc(collection(db, `users/${userId}/sessions`));
        batch.set(newSessionRef, payload);

        for (const itemId of itemIds) {
            const itemRef = doc(db, `users/${userId}/items`, itemId);
            // BUGFIX C: Absicherung durch set + merge anstelle von reinem update
            batch.set(itemRef, { status: 'worn' }, { merge: true });
        }

        // Aktualisiere Status Tracker
        if (sessionData.type === 'instruction') {
             const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
             batch.set(instrRef, {
                 isActive: true,
                 activeSessionId: newSessionRef.id
             }, { merge: true });
        }

        if (sessionData.type === 'punishment') {
             const punRef = doc(db, `users/${userId}/status/punishment`);
             batch.set(punRef, {
                 activeSessionId: newSessionRef.id
             }, { merge: true });
        }

        await batch.commit();
        return newSessionRef.id;

    } catch (e) {
        console.error("Start Session Fehler:", e);
        throw e;
    }
};

export const startTransitProtocol = async (userId, itemId) => {
    if (!userId || !itemId) throw new Error("Parameter fehlen.");
    const batch = writeBatch(db);
    
    // 1. Session anlegen (spezieller Typ)
    const newSessionRef = doc(collection(db, `users/${userId}/sessions`));
    const payload = {
        itemIds: [itemId],
        itemsDetails: [{ id: itemId, name: 'Transit Protocol Item' }],
        type: 'instruction',
        transitProtocolActive: true, 
        transitItemId: itemId,
        startTime: serverTimestamp(),
        endTime: null,
        durationMinutes: 0,
        isActive: true
    };
    batch.set(newSessionRef, payload);

    // 2. Item auf getragen setzen
    const itemRef = doc(db, `users/${userId}/items`, itemId);
    batch.set(itemRef, { status: 'worn' }, { merge: true });

    // 3. Instruction Status updaten (Transit ist aktiv, Forced Release scharfgestellt)
    // BUGFIX C: Punkt-Notation durch saubere verschachtelte Objekte für merge:true ersetzt
    const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
    batch.set(instrRef, {
        transitProtocol: {
            active: true,
            sessionId: newSessionRef.id,
            startTime: serverTimestamp()
        },
        forcedRelease: {
            required: true,
            executed: false
        },
        isActive: true,
        activeSessionId: newSessionRef.id
    }, { merge: true });

    await batch.commit();
    return newSessionRef.id;
};

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
    batch.set(sessionRef, updateData, { merge: true });

    // --- POST-NUT CLARITY EVALUATION (Retention Tracking) ---
    // BUGFIX A: Evaluierung findet statt, aber Ausführung (Strafe) wird auf NACH dem commit verschoben
    let pendingPunishment = null;
    if (sessionData.forcedReleaseAt) {
        const releaseTime = sessionData.forcedReleaseAt?.toDate ? sessionData.forcedReleaseAt.toDate() : new Date(sessionData.forcedReleaseAt);
        const retentionMinutes = Math.floor((endTime - releaseTime) / 60000);
        const MIN_RETENTION_MINUTES = 60; // 60 Minuten Halte-Schwelle

        if (retentionMinutes < MIN_RETENTION_MINUTES) {
            pendingPunishment = {
                msg: `Schwäche nach Entladung: Items nach ${retentionMinutes}m abgelegt (gefordert: ${MIN_RETENTION_MINUTES}m)`,
                dur: 120
            };
        }
    }

    const itemIds = sessionData.itemIds || (sessionData.itemId ? [sessionData.itemId] : []);
    const itemDetails = [];

    // BUGFIX B: Strikte Trennung. ERST alle Lese-Operationen (Reads) durchführen...
    for (const id of itemIds) {
        const itemRef = doc(db, `users/${userId}/items`, id);
        try {
            const iSnap = await getDoc(itemRef);
            if (iSnap.exists()) itemDetails.push(iSnap.data());
        } catch (e) { console.error(e); }
    }

    // ... DANN alle Schreib-Operationen (Writes) in den Batch legen
    for (const id of itemIds) {
        const itemRef = doc(db, `users/${userId}/items`, id);
        const isTransitItem = sessionData.transitProtocolActive && id === sessionData.transitItemId;
        
        batch.set(itemRef, { 
            status: isTransitItem ? 'washing' : 'active', 
            lastWorn: serverTimestamp(),
            wearCount: increment(1),
            totalMinutes: increment(durationMinutes)
        }, { merge: true });
    }

    let creditCalculated = false;
    const sessionForCredit = { ...sessionData, startTime, endTime };
    const earnedResult = await calculateEarnedCredits(userId, sessionForCredit);

    const isEligible = (typeof earnedResult === 'object' && earnedResult !== null && earnedResult.exactCredits > 0) || 
                       (typeof earnedResult === 'number' && earnedResult > 0);

    if (isEligible) {
        try {
            const resultValue = (typeof earnedResult === 'object') ? earnedResult.exactCredits : earnedResult;
            let cat = 'nylon';
            if (itemDetails.length > 0) {
                const mainCat = (itemDetails[0].category || '').toLowerCase();
                if (mainCat.includes('dessous') || mainCat.includes('lingerie') || mainCat.includes('korsett')) {
                    cat = 'lingerie';
                }
            }
            if (cat === 'nylon') {
                await addCredits(userId, resultValue, 'nylon');
            } else {
                await addCredits(userId, resultValue, 'lingerie');
            }
            creditCalculated = true;
        } catch (e) {
            console.error("Credit Buchung fehlgeschlagen:", e);
        }
    }

    // Cleanup System-Status
    if (sessionData.type === 'instruction') {
        const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
        batch.set(instrRef, { isActive: false, activeSessionId: null }, { merge: true });
        
        if (sessionData.transitProtocolActive) {
            batch.set(instrRef, {
                 transitProtocol: { active: false, sessionId: null, startTime: null }
            }, { merge: true });
        }
    } else if (sessionData.type === 'punishment') {
        const punRef = doc(db, `users/${userId}/status/punishment`);
        batch.set(punRef, { activeSessionId: null }, { merge: true });
    }

    // 1. Sicheres Schließen der Session
    await batch.commit();

    // 2. KORREKTUR A: Ausführung der Strafe erfolgt isoliert NACH dem sicheren Abschluss
    if (pendingPunishment) {
        try {
            await registerPunishment(userId, pendingPunishment.msg, pendingPunishment.dur);
        } catch (e) {
            console.error("Session wurde geschlossen, aber Punishment schlug fehl.", e);
        }
    }

    return { creditCalculated };
};

export const updateSessionPornStatus = async (userId, sessionId, isPornActive) => {
    if (!userId || !sessionId) return;
    try {
        const sessionRef = doc(db, `users/${userId}/sessions`, sessionId);
        await setDoc(sessionRef, { isPornActive }, { merge: true });
    } catch (e) {
        console.error("Fehler beim Update des Porn-Status", e);
    }
};

export const registerInstructionRelease = async (userId) => {
    try {
        const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
        await setDoc(instrRef, {
            forcedRelease: { executed: true }
        }, { merge: true });
    } catch (e) {
        console.error("Fehler beim Registrieren des Instruction Release", e);
    }
};