import { db } from '../firebase';
import { collection, doc, writeBatch, serverTimestamp, getDoc, setDoc, increment, query, where, getDocs } from 'firebase/firestore';
import { updateWearStats, addItemHistoryEntry, setItemStatus } from './ItemService';
import { addCredits, getTimeBankBalance, calculateEarnedCredits } from './TimeBankService';
import { registerPunishment } from './PunishmentService';

export const startSession = async (userId, sessionData) => {
    if (!userId || !sessionData) throw new Error("Parameter fehlen.");

    try {
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

        // --- NEU: ZWEI-STUFEN-START FÜR INSTRUCTION SESSIONS ---
        // 1. Lade Daily Instruction, um die "Ziel-Liste" der Items zu kennen
        let requiredItemIds = [];
        if (sessionData.type === 'instruction') {
            const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
            const instrSnap = await getDoc(instrRef);
            if (instrSnap.exists() && instrSnap.data().items) {
                requiredItemIds = instrSnap.data().items.map(i => i.id);
            }
        }

        // 2. Prüfe, ob bereits eine Instruction-Session läuft (Warteschleife)
        let existingSessionRef = null;
        let existingSessionData = null;

        if (sessionData.type === 'instruction') {
            const q = query(collection(db, `users/${userId}/sessions`), where('isActive', '==', true), where('type', '==', 'instruction'));
            const snap = await getDocs(q);
            if (!snap.empty) {
                existingSessionRef = snap.docs[0].ref;
                existingSessionData = snap.docs[0].data();
            }
        }

        const batch = writeBatch(db);

        if (existingSessionRef) {
            // --- MERGE LOGIK (Zweites Item zu laufender Instruction hinzufügen) ---
            const mergedItemIds = [...new Set([...(existingSessionData.itemIds || []), ...itemIds])];

            // Forensik-Timer (Ledger) für das NEUE Item genau jetzt starten
            const newItemLedger = { ...existingSessionData.itemLedger };
            itemIds.forEach(id => {
                if (!newItemLedger[id]) {
                    newItemLedger[id] = { joinedAt: serverTimestamp(), leftAt: null };
                }
            });

            const existingItemDetailsIds = (existingSessionData.itemsDetails || []).map(i => i.id);
            const newItemDetails = [...(existingSessionData.itemsDetails || [])];
            items.forEach(i => {
                if (!existingItemDetailsIds.includes(i.id)) {
                    newItemDetails.push({
                        id: i.id,
                        name: i.name || i.subCategory || 'Unbekannt',
                        brand: i.brand || 'Unbekannt',
                        category: i.category || i.mainCategory || 'Nylons',
                        customId: i.customId || null,
                        imageUrl: i.imageUrl || (i.images && i.images.length > 0 ? i.images[0] : null)
                    });
                }
            });

            // 3. Gatekeeper Check: Sind jetzt ALLE geforderten Items gescannt?
            const allRequiredPresent = requiredItemIds.length > 0 && requiredItemIds.every(reqId => mergedItemIds.includes(reqId));
            let instructionReadyTime = existingSessionData.instructionReadyTime || null;
            let newStartTime = existingSessionData.startTime;

            if (allRequiredPresent && !instructionReadyTime) {
                // START DES HAUPT-TIMERS (Die Pflichtzeit beginnt genau jetzt)
                const now = serverTimestamp();
                instructionReadyTime = now;
                newStartTime = now; // Setzt den UI Timer im Dashboard auf 0 zurück
            }

            batch.update(existingSessionRef, {
                itemIds: mergedItemIds,
                itemLedger: newItemLedger,
                itemsDetails: newItemDetails,
                instructionReadyTime: instructionReadyTime,
                startTime: newStartTime
            });

            for (const itemId of itemIds) {
                const itemRef = doc(db, `users/${userId}/items`, itemId);
                batch.set(itemRef, { status: 'worn' }, { merge: true });
            }

            await batch.commit();
            return existingSessionRef.id;

        } else {
            // --- NEUE SESSION ERSTELLEN (Erstes Item) ---
            let isDebtSession = false;
            let minDuration = 0;
            if (tbBalance && tbBalance.debtLocked) {
                 isDebtSession = true;
                 minDuration = 60;
            }

            const itemLedger = {};
            itemIds.forEach(id => {
                itemLedger[id] = { joinedAt: serverTimestamp(), leftAt: null };
            });

            // Check für Fallback, falls die Instruction nur 1 Item fordert
            const allRequiredPresent = requiredItemIds.length > 0 && requiredItemIds.every(reqId => itemIds.includes(reqId));
            let instructionReadyTime = null;
            if (sessionData.type === 'instruction' && allRequiredPresent) {
                instructionReadyTime = serverTimestamp();
            }

            const payload = {
                itemIds,
                itemLedger,
                itemsDetails: items.map(i => ({
                    id: i.id,
                    name: i.name || i.subCategory || 'Unbekannt',
                    brand: i.brand || 'Unbekannt',
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
                targetDurationMinutes: sessionData.instructionDurationMinutes || sessionData.targetDurationMinutes || 0,
                startTime: serverTimestamp(),
                instructionReadyTime: instructionReadyTime, // Das Herzstück für die Compliance!
                endTime: null,
                durationMinutes: 0,
                isActive: true,
                isPornActive: false
            };

            const newSessionRef = doc(collection(db, `users/${userId}/sessions`));
            batch.set(newSessionRef, payload);

            for (const itemId of itemIds) {
                const itemRef = doc(db, `users/${userId}/items`, itemId);
                batch.set(itemRef, { status: 'worn' }, { merge: true });
            }

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
        }

    } catch (e) {
        console.error("Start Session Fehler:", e);
        throw e;
    }
};

export const startTransitProtocol = async (userId, itemId) => {
    if (!userId || !itemId) throw new Error("Parameter fehlen.");
    const batch = writeBatch(db);
    
    const newSessionRef = doc(collection(db, `users/${userId}/sessions`));
    const payload = {
        itemIds: [itemId],
        itemLedger: { [itemId]: { joinedAt: serverTimestamp(), leftAt: null } },
        itemsDetails: [{ id: itemId, name: 'Transit Protocol Item' }],
        type: 'instruction',
        transitProtocolActive: true, 
        transitItemId: itemId,
        startTime: serverTimestamp(),
        instructionReadyTime: serverTimestamp(),
        endTime: null,
        durationMinutes: 0,
        isActive: true
    };
    batch.set(newSessionRef, payload);

    const itemRef = doc(db, `users/${userId}/items`, itemId);
    batch.set(itemRef, { status: 'worn' }, { merge: true });

    const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
    batch.set(instrRef, {
        transitProtocol: { active: true, sessionId: newSessionRef.id, startTime: serverTimestamp() },
        forcedRelease: { required: true, executed: false },
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
    
    // --- NEU: BERECHNUNG DER ECHTEN PFLICHT-DAUER ---
    let complianceStartTime = startTime;
    if (sessionData.type === 'instruction') {
        if (sessionData.instructionReadyTime) {
            complianceStartTime = sessionData.instructionReadyTime?.toDate ? sessionData.instructionReadyTime.toDate() : new Date(sessionData.instructionReadyTime);
        } else {
            // Instruction wurde nie komplett angezogen! -> Dauer für das Tagesziel ist 0 Minuten.
            complianceStartTime = endTime; 
        }
    }
    const durationMinutes = Math.round((endTime - complianceStartTime) / 60000);

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

    let pendingPunishment = null;
    if (sessionData.forcedReleaseAt) {
        const releaseTime = sessionData.forcedReleaseAt?.toDate ? sessionData.forcedReleaseAt.toDate() : new Date(sessionData.forcedReleaseAt);
        const retentionMinutes = Math.floor((endTime - releaseTime) / 60000);
        const MIN_RETENTION_MINUTES = 60; 

        if (retentionMinutes < MIN_RETENTION_MINUTES) {
            pendingPunishment = {
                msg: `Schwäche nach Entladung: Items nach ${retentionMinutes}m abgelegt (gefordert: ${MIN_RETENTION_MINUTES}m)`,
                dur: 120
            };
        }
    }

    const currentItemIds = sessionData.itemIds || (sessionData.itemId ? [sessionData.itemId] : []);
    const allSessionItemIds = sessionData.itemLedger ? Object.keys(sessionData.itemLedger) : currentItemIds;
    const itemDetails = [];

    for (const id of allSessionItemIds) {
        const itemRef = doc(db, `users/${userId}/items`, id);
        try {
            const iSnap = await getDoc(itemRef);
            if (iSnap.exists()) itemDetails.push(iSnap.data());
        } catch (e) { console.error(e); }
    }

    for (const id of allSessionItemIds) {
        const itemRef = doc(db, `users/${userId}/items`, id);
        const isTransitItem = sessionData.transitProtocolActive && id === sessionData.transitItemId;
        
        let itemDurationMinutes = durationMinutes; 
        
        // --- FORENSIK: Individuelle Item-Tragezeit aus dem Ledger ---
        if (sessionData.itemLedger && sessionData.itemLedger[id]) {
            const ledgerEntry = sessionData.itemLedger[id];
            const joined = ledgerEntry.joinedAt?.toDate ? ledgerEntry.joinedAt.toDate() : startTime;
            const left = ledgerEntry.leftAt ? (ledgerEntry.leftAt.toDate ? ledgerEntry.leftAt.toDate() : new Date(ledgerEntry.leftAt)) : endTime;
            itemDurationMinutes = Math.max(0, Math.round((left - joined) / 60000));
        }

        const isCurrentlyActive = currentItemIds.includes(id);
        
        const updatePayload = {
            wearCount: increment(1),
            totalMinutes: increment(itemDurationMinutes)
        };
        
        if (isCurrentlyActive) {
            updatePayload.status = isTransitItem ? 'washing' : 'active';
            updatePayload.lastWorn = serverTimestamp();
        }
        
        batch.set(itemRef, updatePayload, { merge: true });
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

    await batch.commit();

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