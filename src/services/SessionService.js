// src/services/SessionService.js
import { db } from '../firebase';
import { collection, doc, writeBatch, serverTimestamp, getDoc, setDoc, increment, query, where, getDocs } from 'firebase/firestore';
import { updateWearStats, addItemHistoryEntry, setItemStatus } from './ItemService';
import { addCredits, getTimeBankBalance, calculateEarnedCredits, applyThermalBonus } from './TimeBankService';
import { registerPunishment } from './PunishmentService';

export const startSession = async (userId, sessionData) => {
    if (!userId || !sessionData) throw new Error("Parameter fehlen.");

    try {
        // --- THE HANDOVER PROTOCOL (Semantische Isolation) ---
        if (sessionData.type === 'instruction' || sessionData.type === 'preparation') {
            const qTransit = query(collection(db, `users/${userId}/sessions`), where('isActive', '==', true), where('type', '==', 'transit'));
            const transitSnap = await getDocs(qTransit);
            if (!transitSnap.empty) {
                await stopSession(userId, transitSnap.docs[0].id, { note: 'Beendet durch Handover-Protokoll' });
            }
        }
        // -----------------------------------------------------

        // --- POST-COMPLIANCE SHIFT (Semantische Umwandlung) ---
        if (sessionData.type === 'instruction' || sessionData.type === 'preparation') {
            const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
            const instrSnap = await getDoc(instrRef);
            if (instrSnap.exists() && instrSnap.data().isCompleted) {
                sessionData.type = 'voluntary';
            }
        }
        // -----------------------------------------------------

        const tbBalance = await getTimeBankBalance(userId);
        const isBankrupt = tbBalance.nc < 0 || tbBalance.lc < 0;
        if (isBankrupt && !sessionData.type.includes('debt') && !sessionData.type.includes('punishment') && !sessionData.type.includes('instruction')) {
            throw new Error("TIME BANKRUPTCY. Sissy-Sessions systemseitig gesperrt.");
        }

        if (sessionData.type === 'voluntary') {
            const uniRef = doc(db, `users/${userId}/status/uniformity`);
            const uniSnap = await getDoc(uniRef);
            if (uniSnap.exists() && uniSnap.data().active) {
                const expiresAt = uniSnap.data().expiresAt?.toDate ? uniSnap.data().expiresAt.toDate() : new Date(uniSnap.data().expiresAt);
                if (expiresAt > new Date()) {
                    throw new Error("ERZWUNGENE MONOTONIE. Sissy-Sessions sind gesperrt.");
                }
            }
        }

        const items = sessionData.items || [];
        const itemIds = items.map(i => i.id);

        if (itemIds.length === 0 && sessionData.itemId) {
            itemIds.push(sessionData.itemId);
            items.push({ id: sessionData.itemId }); 
        }

        if (itemIds.length === 0) throw new Error("Keine Items ausgewählt.");

        let requiredItemIds = [];
        let instructionItems = [];
        if (sessionData.type === 'instruction' || sessionData.type === 'preparation') {
            const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
            const instrSnap = await getDoc(instrRef);
            if (instrSnap.exists() && instrSnap.data().items) {
                instructionItems = instrSnap.data().items;
                requiredItemIds = instructionItems.map(i => i.id);

                const qActive = query(collection(db, `users/${userId}/sessions`), where('isActive', '==', true), where('type', '==', 'instruction'));
                const activeSnap = await getDocs(qActive);
                const alreadyWornIds = !activeSnap.empty ? (activeSnap.docs[0].data().itemIds || []) : [];

                for (const newItemId of itemIds) {
                    const targetItem = instructionItems.find(i => i.id === newItemId);
                    if (targetItem && targetItem.orderIndex > 1) {
                        const missingPredecessors = instructionItems.filter(i => 
                            i.orderIndex < targetItem.orderIndex && 
                            !alreadyWornIds.includes(i.id) && 
                            !itemIds.includes(i.id) 
                        );

                        if (missingPredecessors.length > 0) {
                            const nextDue = missingPredecessors.sort((a, b) => a.orderIndex - b.orderIndex)[0];
                            throw new Error(`REIHENFOLGE VERLETZT. Ziehe zuerst ${nextDue.name} (Schritt ${nextDue.orderIndex}) an.`);
                        }
                    }
                }
            }
        }

        let existingSessionRef = null;
        let existingSessionData = null;

        if (sessionData.type === 'instruction' || sessionData.type === 'preparation') {
            const q = query(collection(db, `users/${userId}/sessions`), where('isActive', '==', true), where('type', '==', 'instruction'));
            const snap = await getDocs(q);
            if (!snap.empty) {
                existingSessionRef = snap.docs[0].ref;
                existingSessionData = snap.docs[0].data();
            }
        }

        const batch = writeBatch(db);

        if (existingSessionRef) {
            const mergedItemIds = [...new Set([...(existingSessionData.itemIds || []), ...itemIds])];

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

            const allRequiredPresent = requiredItemIds.length > 0 && requiredItemIds.every(reqId => mergedItemIds.includes(reqId));
            let instructionReadyTime = existingSessionData.instructionReadyTime || null;

            if (allRequiredPresent && !instructionReadyTime) {
                instructionReadyTime = serverTimestamp();
            }

            const updatePayload = {
                itemIds: mergedItemIds,
                itemLedger: newItemLedger,
                itemsDetails: newItemDetails,
                instructionReadyTime: instructionReadyTime,
                type: allRequiredPresent ? 'instruction' : existingSessionData.type 
            };

            if (existingSessionData.complianceLagMinutes == null && sessionData.acceptedAt) {
                const acceptedData = sessionData.acceptedAt;
                const acceptedTime = typeof acceptedData.toDate === 'function' ? acceptedData.toDate() : new Date(acceptedData);
                if (!isNaN(acceptedTime.getTime())) {
                    updatePayload.complianceLagMinutes = Math.max(0, Math.ceil((Date.now() - acceptedTime.getTime()) / 60000));
                }
            }

            batch.update(existingSessionRef, updatePayload);

            for (const itemId of itemIds) {
                const itemRef = doc(db, `users/${userId}/items`, itemId);
                batch.set(itemRef, { status: 'worn' }, { merge: true });
            }

            await batch.commit();
            return existingSessionRef.id;

        } else {
            let isDebtSession = false;
            let minDuration = 0;
            if (sessionData.type === 'debt' || sessionData.isDebtSession) {
                 isDebtSession = true;
                 minDuration = sessionData.minDuration || 60;
            }

            const itemLedger = {};
            itemIds.forEach(id => {
                itemLedger[id] = { joinedAt: serverTimestamp(), leftAt: null };
            });

            const allRequiredPresent = requiredItemIds.length > 0 && requiredItemIds.every(reqId => itemIds.includes(reqId));
            let instructionReadyTime = null;
            let finalType = sessionData.type || 'voluntary';

            if ((sessionData.type === 'instruction' || sessionData.type === 'preparation') && allRequiredPresent) {
                instructionReadyTime = serverTimestamp();
                finalType = 'instruction';
            } else if (sessionData.type === 'preparation') {
                finalType = 'instruction'; 
            }

            let complianceLagMinutes = null;
            if ((finalType === 'instruction' || sessionData.type === 'preparation') && sessionData.acceptedAt) {
                const acceptedData = sessionData.acceptedAt;
                const acceptedTime = typeof acceptedData.toDate === 'function' ? acceptedData.toDate() : new Date(acceptedData);
                if (!isNaN(acceptedTime.getTime())) {
                    complianceLagMinutes = Math.max(0, Math.ceil((Date.now() - acceptedTime.getTime()) / 60000));
                }
            }

            let thermalYieldPayload = {};
            if (finalType === 'instruction' || finalType === 'voluntary' || sessionData.type === 'debt') {
                try {
                    const thermalRef = doc(db, `users/${userId}/status/thermal`);
                    const thermalSnap = await getDoc(thermalRef);
                    if (thermalSnap.exists()) {
                        const tData = thermalSnap.data();
                        if (tData.isHot && tData.lastSessionEndTime) {
                            const endTime = tData.lastSessionEndTime.toDate ? tData.lastSessionEndTime.toDate() : new Date(tData.lastSessionEndTime);
                            const gapMinutes = Math.floor((Date.now() - endTime.getTime()) / 60000);
                            let triggerChance = gapMinutes <= 15 ? 1.0 : (gapMinutes <= 45 ? 0.40 : 0);
                            if (Math.random() < triggerChance) {
                                const roll = Math.random();
                                let bonusData = roll < 0.40 ? { type: 'dividend', multiplier: 1.5 } : (roll < 0.70 ? { type: 'dividend', amount: Math.floor(Math.random() * 200) + 50 } : (roll < 0.90 ? { type: 'amnesty' } : { type: 'debt_relief' }));
                                if (bonusData) thermalYieldPayload.pendingThermalBonus = bonusData;
                            }
                            batch.set(thermalRef, { isHot: false }, { merge: true });
                        }
                    }
                } catch (e) { console.error(e); }
            }

            const payload = {
                itemIds,
                itemLedger,
                ...thermalYieldPayload,
                itemsDetails: items.map(i => ({
                    id: i.id,
                    name: i.name || i.subCategory || 'Unbekannt',
                    brand: i.brand || 'Unbekannt',
                    category: i.category || i.mainCategory || 'Nylons',
                    customId: i.customId || null,
                    imageUrl: i.imageUrl || (i.images && i.images.length > 0 ? i.images[0] : null)
                })),
                type: finalType,
                periodId: sessionData.periodId || null,
                acceptedAt: sessionData.acceptedAt || null,
                complianceLagMinutes, 
                verifiedViaNfc: sessionData.verifiedViaNfc || false,
                isDebtSession,
                minDuration,
                targetDurationMinutes: sessionData.instructionDurationMinutes || sessionData.targetDurationMinutes || 0,
                startTime: serverTimestamp(),
                instructionReadyTime: instructionReadyTime,
                endTime: null,
                durationMinutes: 0,
                isActive: true,
                isPornActive: false,
                isNSD: sessionData.isNSD || false
            };

            const newSessionRef = doc(collection(db, `users/${userId}/sessions`));
            batch.set(newSessionRef, payload);

            for (const itemId of itemIds) {
                const itemRef = doc(db, `users/${userId}/items`, itemId);
                batch.set(itemRef, { status: 'worn' }, { merge: true });
            }

            if (finalType === 'instruction' || sessionData.type === 'preparation') {
                 const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
                 batch.set(instrRef, { isActive: true, activeSessionId: newSessionRef.id }, { merge: true });
            }

            if (finalType === 'punishment') {
                 const punRef = doc(db, `users/${userId}/status/punishment`);
                 batch.set(punRef, { activeSessionId: newSessionRef.id }, { merge: true });
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
    
    const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
    const instrSnap = await getDoc(instrRef);
    let complianceLagMinutes = null;
    
    const acceptedData = instrSnap.exists() ? instrSnap.data()?.acceptedAt : null;
    
    if (acceptedData) {
        const acceptedTime = typeof acceptedData.toDate === 'function' ? acceptedData.toDate() : new Date(acceptedData);
        if (!isNaN(acceptedTime.getTime())) {
            complianceLagMinutes = Math.max(0, Math.ceil((Date.now() - acceptedTime.getTime()) / 60000));
        }
    }

    const newSessionRef = doc(collection(db, `users/${userId}/sessions`));
    const payload = {
        itemIds: [itemId],
        itemLedger: { [itemId]: { joinedAt: serverTimestamp(), leftAt: null } },
        itemsDetails: [{ id: itemId, name: 'Transit Protocol Item' }],
        type: 'instruction',
        transitProtocolActive: true, 
        transitItemId: itemId,
        complianceLagMinutes, 
        startTime: serverTimestamp(),
        instructionReadyTime: serverTimestamp(),
        endTime: null,
        durationMinutes: 0,
        isActive: true
    };
    batch.set(newSessionRef, payload);

    const itemRef = doc(db, `users/${userId}/items`, itemId);
    batch.set(itemRef, { status: 'worn' }, { merge: true });

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
    const isNSD = sessionData.isNSD || false;

    if (isNSD && feedback.isTransit) {
        const transitStartTime = sessionData.transitStartedAt?.toDate ? sessionData.transitStartedAt.toDate() : new Date();
        const transitDuration = (new Date() - transitStartTime) / 1000;
        
        if (transitDuration > 300) {
            console.log("SISSY-FEIERTAG: Transit-Zeit überschritten.");
        }
    }
    
    let sessionDiscountMinutes = 0;
    if (sessionData.type === 'instruction') {
        try {
            const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
            const instrSnap = await getDoc(instrRef);
            if (instrSnap.exists() && instrSnap.data().discountMinutes) {
                sessionDiscountMinutes = instrSnap.data().discountMinutes;
            }
        } catch (e) { console.error("Fehler beim Auslesen der discountMinutes:", e); }
    }

    let complianceStartTime = startTime;
    if (sessionData.type === 'instruction' && sessionData.instructionReadyTime) {
        complianceStartTime = sessionData.instructionReadyTime?.toDate ? sessionData.instructionReadyTime.toDate() : new Date(sessionData.instructionReadyTime);
    }
    
    const durationMinutes = Math.round((endTime - complianceStartTime) / 60000);

    // --- COMPLETION LOCK PRÜFUNG ---
    let isInstructionCompleted = false;
    if (sessionData.type === 'instruction') {
        const target = sessionData.targetDurationMinutes || 0;
        let totalAccumulatedMinutes = durationMinutes + sessionDiscountMinutes;
        
        if (sessionData.periodId) {
            try {
                const qPast = query(
                    collection(db, `users/${userId}/sessions`), 
                    where('periodId', '==', sessionData.periodId), 
                    where('type', '==', 'instruction'), 
                    where('isActive', '==', false)
                );
                const pastSnap = await getDocs(qPast);
                pastSnap.forEach(docSnap => {
                    totalAccumulatedMinutes += (docSnap.data().durationMinutes || 0);
                });
            } catch (e) { console.error("Fehler bei der Akkumulation:", e); }
        }

        if (target > 0 && totalAccumulatedMinutes >= target) {
            isInstructionCompleted = true;
        }
    }
    // --------------------------------

    if (durationMinutes >= 240 && (sessionData.type === 'instruction' || sessionData.type === 'voluntary' || sessionData.isDebtSession)) {
        const thermalRef = doc(db, `users/${userId}/status/thermal`);
        batch.set(thermalRef, { lastSessionEndTime: serverTimestamp(), lastSessionDuration: durationMinutes, isHot: true }, { merge: true });
    }

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
        discountMinutes: sessionDiscountMinutes, 
        feelings: feedback.feelings || [],
        finalNote: feedback.note || ''
    };

    if (nightSuccess !== null) {
        updateData.nightSuccess = nightSuccess;
    }

    let pendingPunishment = null;
    if (sessionData.forcedReleaseAt) {
        const releaseTime = sessionData.forcedReleaseAt?.toDate ? sessionData.forcedReleaseAt.toDate() : new Date(sessionData.forcedReleaseAt);
        const retentionMinutes = Math.floor((endTime - releaseTime) / 60000);
        const MIN_RETENTION_MINUTES = 60; 

        if (retentionMinutes < MIN_RETENTION_MINUTES) {
            pendingPunishment = {
                msg: `Schwäche: Plastik nach ${retentionMinutes}m abgelegt (gefordert: ${MIN_RETENTION_MINUTES}m)`,
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

    if (feedback.emergencyBailout) {
        const tbBalance = await getTimeBankBalance(userId);
        
        let newNc = tbBalance.nc;
        let newLc = tbBalance.lc;
        let bailoutMessage = '';
        let noteSuffix = '';

        if (sessionData.type === 'voluntary') {
            bailoutMessage = `Abbruch einer freiwilligen Session. Keine Zeit angerechnet.`;
            noteSuffix = 'ABBRUCH (Freiwillig)';
        } else {
            if (tbBalance.nc < 0 || tbBalance.lc < 0) {
                const penaltyNc = tbBalance.nc < 0 ? Math.floor(Math.abs(tbBalance.nc) * 0.5) : 0;
                const penaltyLc = tbBalance.lc < 0 ? Math.floor(Math.abs(tbBalance.lc) * 0.5) : 0;
                newNc -= penaltyNc;
                newLc -= penaltyLc;
                bailoutMessage = `Not-Abbruch! 50% Strafaufschlag auf bestehende Sissy-Schulden.`;
                noteSuffix = 'NOT-ABBRUCH (50% Strafe)';
            } else {
                newNc -= 240;
                newLc -= 240;
                bailoutMessage = `Pauschalstrafe angewendet. 240 Minuten Guthaben vernichtet.`;
                noteSuffix = 'NOT-ABBRUCH (-240 Min)';
            }
        }

        const tbRef = doc(db, `users/${userId}/status/timeBank`);
        batch.set(tbRef, {
            nc: newNc,
            lc: newLc,
            lastTransaction: serverTimestamp()
        }, { merge: true });

        updateData.durationMinutes = 0; 
        updateData.finalNote = noteSuffix;

        for (const id of allSessionItemIds) {
            await addItemHistoryEntry(userId, id, {
                type: 'debt_bailout',
                message: bailoutMessage
            });
        }

        if (sessionData.type !== 'voluntary' && Math.random() < 0.50) {
            const expiresAt = new Date(Date.now() + 96 * 60 * 60 * 1000); 
            const uniformityRef = doc(db, `users/${userId}/status/uniformity`);
            const snapshotIds = currentItemIds.length > 0 ? currentItemIds : allSessionItemIds;
            
            batch.set(uniformityRef, {
                active: true,
                itemIds: snapshotIds, 
                triggeredAt: serverTimestamp(),
                expiresAt: expiresAt
            }, { merge: true });

            updateData.finalNote = `${noteSuffix} + ERZWUNGENE MONOTONIE 96h`;

            for (const id of snapshotIds) {
                await addItemHistoryEntry(userId, id, {
                    type: 'uniformity_triggered',
                    message: `Erzwungene Monotonie durch Not-Abbruch getriggert! Item ist für 96 Stunden als Sissy-Uniform verriegelt.`
                });
            }
        }

    } else {
        if (sessionData.pendingThermalBonus) {
            let bonusQualifies = false;
            if (sessionData.type === 'voluntary') {
                if (durationMinutes >= 180) bonusQualifies = true;
            } else {
                const target = Number(sessionData.targetDurationMinutes) || 0;
                const minDur = Number(sessionData.minDuration) || 0;
                const requiredDuration = Math.max(target, minDur);
                if (durationMinutes >= 180 || (requiredDuration > 0 && durationMinutes >= requiredDuration)) {
                    bonusQualifies = true; 
                }
            }

            if (bonusQualifies) {
                await applyThermalBonus(userId, sessionData.pendingThermalBonus);
                const bonusMsg = `Wärmepolster-Bonus gesichert (${sessionData.pendingThermalBonus.type})`;
                updateData.finalNote = updateData.finalNote ? `${updateData.finalNote} | ${bonusMsg}` : bonusMsg;
            } else {
                const failMsg = `Wärmepolster-Bonus verfallen (Tragezeit nicht erfüllt)`;
                updateData.finalNote = updateData.finalNote ? `${updateData.finalNote} | ${failMsg}` : failMsg;
            }
        }

        const sessionForCredit = { ...sessionData, startTime, endTime };
        const earnedPayload = await calculateEarnedCredits(userId, sessionForCredit);

        const isEligible = earnedPayload && (earnedPayload.rawMinutes > 0 || earnedPayload.exactCredits > 0);

        if (isEligible) {
            try {
                let earnNylon = false;
                let earnLingerie = false;

                for (const item of itemDetails) {
                    const mainCat = (item.mainCategory || '').toLowerCase();
                    if (mainCat === 'nylons' || mainCat === 'nylon') earnNylon = true;
                    if (mainCat === 'dessous' || mainCat === 'lingerie') earnLingerie = true;
                }

                if (earnNylon) {
                    await addCredits(userId, earnedPayload, 'nylon');
                }
                if (earnLingerie) {
                    await addCredits(userId, earnedPayload, 'lingerie');
                }
                creditCalculated = true;
            } catch (e) {
                console.error("Credit Buchung fehlgeschlagen:", e);
            }
        }
    }

    batch.set(sessionRef, updateData, { merge: true });

    if (sessionData.type === 'instruction') {
        const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
        const instrUpdates = { isActive: false, activeSessionId: null, discountMinutes: 0 };
        
        if (isInstructionCompleted) {
            instrUpdates.isCompleted = true;
        }

        batch.set(instrRef, instrUpdates, { merge: true });
        
        if (sessionData.transitProtocolActive) {
            batch.set(instrRef, {
                 transitProtocol: { active: false, sessionId: null, startTime: null }
            }, { merge: true });
        }
    } else if (sessionData.type === 'transit') {
        const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
        batch.set(instrRef, {
             transitProtocol: { active: false, sessionId: null, startTime: null },
             activeSessionId: null
        }, { merge: true });
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

/**
 * NSD-SISSY-TRANSIT: Das Pendel-Ritual mit Set-Validierung
 */
export const executeNSDTransit = async (userId, newBaseId, newLayer2Id) => {
    const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
    const instrSnap = await getDoc(instrRef);
    const instrData = instrSnap.data();

    if (!instrData.nsdItems.includes(newBaseId) || !instrData.nsdItems.includes(newLayer2Id)) {
        throw new Error("SISSY-FEIERTAG: Unerlaubtes Item. Du darfst nur das zugewiesene Plastik tragen.");
    }

    if (instrData.nsdTransitCount >= 6) {
        throw new Error("SISSY-FEIERTAG: Maximale Wechsel (6) erschöpft. Du bleibst jetzt so verpackt.");
    }

    const prevLayer2Id = instrData.items.find(i => i.orderIndex === 2)?.id;
    const prevLayer2Snap = await getDoc(doc(db, `users/${userId}/items`, prevLayer2Id));
    const prevCat = (prevLayer2Snap.data()?.subCategory || '').toLowerCase();

    const newLayer2Snap = await getDoc(doc(db, `users/${userId}/items`, newLayer2Id));
    const newCat = (newLayer2Snap.data()?.subCategory || '').toLowerCase();

    if (prevCat.includes('straps') && !newCat.includes('knie')) {
        throw new Error("SISSY-FEIERTAG: Pendel-Gesetz verletzt! Du musst Kniestrümpfe über das Plastik ziehen.");
    }
    if (prevCat.includes('knie') && !newCat.includes('straps')) {
        throw new Error("SISSY-FEIERTAG: Pendel-Gesetz verletzt! Du musst Strapsstrümpfe über das Plastik ziehen.");
    }

    const batch = writeBatch(db);
    batch.update(instrRef, {
        nsdTransitCount: increment(1),
        items: [
            { id: newBaseId, orderIndex: 1, category: 'Strumpfhose' },
            { id: newLayer2Id, orderIndex: 2, category: newCat.includes('straps') ? 'Strapsstrümpfe' : 'Kniestrümpfe' }
        ]
    });
    
    const q = query(collection(db, `users/${userId}/sessions`), where('isActive', '==', true), where('isNSD', '==', true));
    const snap = await getDocs(q);
    if (!snap.empty) {
        batch.update(snap.docs[0].ref, {
            itemIds: [newBaseId, newLayer2Id],
            transitStartedAt: serverTimestamp()
        });
    }

    await batch.commit();
};

/**
 * SISSY-FEIERTAG: MELDUNG EINES DEFEKTS
 * Ersetzt ein Item im Set durch ein neues aus derselben Subkategorie.
 */
export const reportNSDBreakage = async (userId, brokenItemId) => {
    const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
    const instrSnap = await getDoc(instrRef);
    if (!instrSnap.exists() || !instrSnap.data().isNSD) throw new Error("Kein Sissy-Feiertag aktiv.");
    
    const instrData = instrSnap.data();
    const brokenItemSnap = await getDoc(doc(db, `users/${userId}/items`, brokenItemId));
    const subCat = brokenItemSnap.data()?.subCategory;

    const qItems = query(collection(db, `users/${userId}/items`), where('status', '==', 'active'), where('subCategory', '==', subCat));
    const itemsSnap = await getDocs(qItems);
    const pool = itemsSnap.docs.filter(d => !instrData.nsdItems.includes(d.id));

    if (pool.length === 0) throw new Error("SISSY-FEIERTAG: Kein Ersatz verfügbar. Du musst das kaputte Plastik weitertragen.");

    const replacement = pool[Math.floor(Math.random() * pool.length)];
    const newNsdItems = instrData.nsdItems.map(id => id === brokenItemId ? replacement.id : id);

    const batch = writeBatch(db);
    batch.update(doc(db, `users/${userId}/items`, brokenItemId), { 
        status: 'archived', 
        archiveReason: 'Defekt am Sissy-Feiertag' 
    });
    batch.update(instrRef, { nsdItems: newNsdItems });
    
    const qSess = query(collection(db, `users/${userId}/sessions`), where('isActive', '==', true), where('isNSD', '==', true));
    const sessSnap = await getDocs(qSess);
    if (!sessSnap.empty) {
        const sData = sessSnap.docs[0].data();
        const newItemIds = sData.itemIds.map(id => id === brokenItemId ? replacement.id : id);
        batch.update(sessSnap.docs[0].ref, { itemIds: newItemIds });
    }

    await batch.commit();
    return replacement.data()?.name;
};

export const updateSessionPornStatus = async (userId, sessionId, isPornActive) => {
    if (!userId || !sessionId) return;
    try {
        const sessionRef = doc(db, `users/${userId}/sessions`, sessionId);
        await setDoc(sessionRef, { isPornActive }, { merge: true });
    } catch (e) { console.error(e); }
};

export const registerInstructionRelease = async (userId) => {
    try {
        const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
        await setDoc(instrRef, { forcedRelease: { executed: true } }, { merge: true });
    } catch (e) { console.error(e); }
};