import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp, setDoc, getDoc, increment, query, collection, where, getDocs, addDoc, writeBatch } from 'firebase/firestore';
import { safeDate } from '../utils/dateUtils';
import { registerPunishment } from './PunishmentService';
import { setImmunity, isImmunityActive } from './OfferService'; 
import { addItemHistoryEntry } from './ItemService';
import { stopSession, startSession } from './SessionService';
import { liquidateAssets } from './TimeBankService';

// --- KONFIGURATION ---
const TZD_CONFIG = {
    DEFAULT_MULTIPLIER: 1.5,
    PENALTY_MINUTES: 15,
    MAX_HOURS_HARD_CAP: 24,
    ABORT_PUNISHMENT_DURATION: 360 // 6 Stunden Plug
};

// --- FALLBACK KONSTANTEN ---
const FALLBACK_TRIGGER_CHANCE = 0.08; 
const FALLBACK_MATRIX = [
    { label: 'The Bait', min: 2, max: 4, weight: 0.20 },
    { label: 'The Standard', min: 4, max: 8, weight: 0.70 }, 
    { label: 'The Wall', min: 8, max: 12, weight: 0.10 }
];

// --- HELPER ---
const determineSecretDuration = (matrix) => {
    const durationMatrix = (matrix && matrix.length > 0) ? matrix : FALLBACK_MATRIX;
    const rand = Math.random();
    let cumulative = 0;
    
    for (const zone of durationMatrix) {
        const weight = zone.weight || 0;
        cumulative += weight;
        
        if (rand < cumulative) {
            const min = zone.minHours !== undefined ? zone.minHours : zone.min;
            const max = zone.maxHours !== undefined ? zone.maxHours : zone.max;
            const range = max - min;
            return (min * 60) + Math.floor(Math.random() * (range * 60 + 1));
        }
    }
    return 12 * 60; 
};

// --- CORE ---

/**
 * Zieht die TZD Einstellungen zentral aus der Datenbank.
 */
export const getTZDSettings = async (userId) => {
    let maxHours = 36;
    let currentChance = FALLBACK_TRIGGER_CHANCE;
    let weights = [0.20, 0.50, 0.30];

    try {
        const settingsSnap = await getDoc(doc(db, `users/${userId}/settings/protocol`));
        if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            if (data.tzd) {
                if (typeof data.tzd.tzdMaxHours === 'number') {
                    maxHours = data.tzd.tzdMaxHours;
                }
                if (typeof data.tzd.triggerChance === 'number') {
                    currentChance = data.tzd.triggerChance;
                }
                if (data.tzd.zoneWeights && Array.isArray(data.tzd.zoneWeights)) {
                    weights = data.tzd.zoneWeights;
                }
            }
        }
    } catch (e) {
        console.error("Fehler beim Laden der TZD Settings, nutze Fallback", e);
    }
    
    return { maxHours, currentChance, weights };
};

/**
 * Startet das einheitliche Protokoll (Absolute Ungewissheit). 
 */
export const startTZD = async (userId, targetItems) => {
    
    const { maxHours, weights } = await getTZDSettings(userId);
    
    const dynamicMatrix = [
        { label: 'The Bait', minHours: maxHours / 6, maxHours: maxHours / 3, weight: weights[0] || 0.20 },
        { label: 'The Standard', minHours: maxHours / 3, maxHours: (maxHours * 2) / 3, weight: weights[1] || 0.50 },
        { label: 'The Wall', minHours: (maxHours * 2) / 3, maxHours: maxHours, weight: weights[2] || 0.30 }
    ];

    const targetDuration = determineSecretDuration(dynamicMatrix);
    const itemsArray = Array.isArray(targetItems) ? targetItems : [targetItems];

    const tzdData = {
        isActive: true,
        startTime: serverTimestamp(),
        targetDurationMinutes: Math.round(targetDuration),
        lockedItems: itemsArray.map(i => ({
            id: i.id,
            name: i.name,
            customId: i.customId || 'N/A',
            brand: i.brand,
            img: i.imageUrl || (i.images && i.images[0]) || null,
            subCategory: i.subCategory || '', 
            mainCategory: i.mainCategory || ''
        })),
        itemId: itemsArray[0]?.id, 
        itemName: itemsArray[0]?.name,
        
        accumulatedMinutes: 0,
        lastCheckIn: serverTimestamp(),
        stage: 'briefing',
        isFailed: false,
        isPenalty: false, // Keine Unterscheidung mehr. TZD ist TZD.
        protocolType: 'regular',
        escalationData: null
    };

    await setDoc(doc(db, `users/${userId}/status/tzd`), tzdData);

    // --- Session-Schnitt zur Eliminierung des Double-Countings (inkl. Backup) ---
    let interruptedInstruction = null;
    try {
        const activeSessionsQuery = query(collection(db, `users/${userId}/sessions`), where('isActive', '==', true), where('type', '==', 'instruction'));
        const activeSessionsSnap = await getDocs(activeSessionsQuery);
        let periodIdToCarryOver = 'day';
        
        const dailySnap = await getDoc(doc(db, `users/${userId}/status/dailyInstruction`));
        let baseDuration = 0;
        if (dailySnap.exists()) {
            baseDuration = dailySnap.data().durationMinutes || 0;
        }
        
        for (const sessionDoc of activeSessionsSnap.docs) {
            const sData = sessionDoc.data();
            periodIdToCarryOver = sData.periodId || periodIdToCarryOver;
            
            let remainingMinutes = baseDuration;
            if (sData.startTime) {
                const start = sData.startTime.toDate ? sData.startTime.toDate() : new Date(sData.startTime);
                const elapsed = Math.round((new Date() - start) / 60000);
                remainingMinutes = Math.max(1, baseDuration - elapsed);
            }

            interruptedInstruction = {
                items: sData.itemsDetails || [],
                periodId: periodIdToCarryOver,
                remainingDuration: remainingMinutes
            };

            await stopSession(userId, sessionDoc.id, { note: 'Beendet für TZD-Start (Schnitt)' });
        }

        if (interruptedInstruction) {
            await updateDoc(doc(db, `users/${userId}/status/tzd`), { interruptedInstruction });
        }

        // TZD als völlig isolierten Typen 'tzd' starten
        await startSession(userId, {
            items: itemsArray,
            type: 'tzd',
            periodId: periodIdToCarryOver,
            note: 'TZD-Session',
            instructionDurationMinutes: targetDuration
        });
    } catch (e) {
        console.error("Fehler beim Session-Schnitt für TZD:", e);
    }

    // Historie für alle betroffenen Items vermerken
    for (const item of itemsArray) {
        await addItemHistoryEntry(userId, item.id, {
            type: 'tzd_briefing',
            message: `Zeitloses Diktat gestartet (Dauer: ${Math.round(targetDuration)} Min).`,
            isPenalty: false
        });
    }

    return tzdData;
};

/**
 * Bestrafung für Fluchtversuch.
 */
export const triggerEvasionPenalty = async (userId, instructionItems) => {
    try {
        const currentStatus = await getTZDStatus(userId);
        if (currentStatus && currentStatus.isActive) {
            console.log("Evasion Penalty unterdrückt: TZD bereits aktiv.");
            return false;
        }

        console.log(`Evasion Detected. Triggering unified TZD.`);

        // Löst das völlig unberechenbare TZD aus (Option A)
        await startTZD(userId, instructionItems);
        
        await updateDoc(doc(db, `users/${userId}/status/dailyInstruction`), {
            evasionPenaltyTriggered: true,
            tzdTriggered: true
        });
        
        await registerPunishment(userId, "Fluchtversuch vor Anweisung (Blockade umgangen)", 0); 

        return true;
    } catch (e) {
        console.error("Critical Error in triggerEvasionPenalty:", e);
        return false;
    }
};

export const isItemEligibleForTZD = (item) => {
    if (!item) return false;
    const cat = (item.mainCategory || '').toLowerCase();
    const sub = (item.subCategory || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    if (cat.includes('strumpfhose') || sub.includes('strumpfhose') || name.includes('strumpfhose') || 
        cat.includes('tights') || sub.includes('tights')) {
        return true;
    }
    return false;
};

/**
 * Regulärer TZD Trigger.
 */
export const checkForTZDTrigger = async (userId, activeSessions, items) => {
    try {
        const tbSnap = await getDoc(doc(db, `users/${userId}/status/timeBank`));
        if (tbSnap.exists()) {
            const tbData = tbSnap.data();
            if (tbData.tzdAmnestyUntil) {
                const amnestyDate = tbData.tzdAmnestyUntil.toDate ? tbData.tzdAmnestyUntil.toDate() : new Date(tbData.tzdAmnestyUntil);
                if (amnestyDate > new Date()) {
                    console.log("TZD Wächter: 24h Amnestie aktiv. Kein Zufalls-TZD möglich.");
                    return false;
                }
            }
        }
    } catch (e) {
        console.error("Fehler beim Prüfen der TZD Amnestie:", e);
    }

    const currentStatus = await getTZDStatus(userId);
    if (currentStatus && currentStatus.isActive) {
        const immune = await isImmunityActive(userId);
        if (immune) {
             console.log("TZD Wächter: Immunität aktiv. Keine Strafe.");
             return false;
        }
        
        const dailyRef = doc(db, `users/${userId}/status/dailyInstruction`);
        const dailySnap = await getDoc(dailyRef);
        if (dailySnap.exists() && dailySnap.data().activeSuspension) {
             console.log("TZD Wächter: Suspension aktiv. Keine Strafe.");
             return false;
        }
        
        return true; 
    }

    const immune = await isImmunityActive(userId);
    if (immune) return false;

    const now = new Date();
    const day = now.getDay(); 
    const hour = now.getHours();
    const min = now.getMinutes();

    let inWindow = false;
    if (day === 0) { 
        if (hour === 23 && min >= 0) inWindow = true;
    } else if (day >= 1 && day <= 3) { 
        inWindow = true;
    } else if (day === 4) { 
        if (hour < 12) inWindow = true;
    }

    if (!inWindow) return false;

    const instructionSessions = activeSessions.filter(s => 
        s.type === 'instruction' && !s.tzdExecuted
    );
    
    if (instructionSessions.length === 0) return false;

    const activeItemIds = new Set();
    instructionSessions.forEach(s => {
        if (s.itemId) activeItemIds.add(s.itemId);
        if (s.itemIds) s.itemIds.forEach(id => activeItemIds.add(id));
    });

    const activeItems = items.filter(i => activeItemIds.has(i.id));
    
    const hasEligibleItem = activeItems.some(i => isItemEligibleForTZD(i));
    if (!hasEligibleItem) return false;

    const { currentChance } = await getTZDSettings(userId);

    const roll = Math.random();
    if (roll < currentChance) {
        await startTZD(userId, activeItems);
        return true;
    }
    return false;
};

export const getTZDStatus = async (userId) => {
    try {
        const docSnap = await getDoc(doc(db, `users/${userId}/status/tzd`));
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                ...data,
                startTime: safeDate(data.startTime),
                lastCheckIn: safeDate(data.lastCheckIn)
            };
        }
        return { isActive: false };
    } catch (e) { return { isActive: false }; }
};

export const performCheckIn = async (userId, statusData) => {
    if (!statusData || !statusData.isActive) return null;

    const now = new Date();
    const start = safeDate(statusData.startTime) || now;
    
    const elapsedMinutes = Math.floor((now - start) / 60000);
    const isCompleted = elapsedMinutes >= statusData.targetDurationMinutes;

    if (isCompleted) {
        await terminateTZD(userId, true);
        return { isActive: false, completed: true };
    } else {
        await updateDoc(doc(db, `users/${userId}/status/tzd`), {
            accumulatedMinutes: elapsedMinutes,
            lastCheckIn: serverTimestamp()
        });

        if (statusData.lockedItems) {
            for (const item of statusData.lockedItems) {
                await addItemHistoryEntry(userId, item.id, {
                    type: 'tzd_checkin',
                    message: `TZD aktiv: ${elapsedMinutes} von ${statusData.targetDurationMinutes} Minuten absolviert.`
                });
            }
        }

        return { ...statusData, accumulatedMinutes: elapsedMinutes, isActive: true };
    }
};

export const penalizeTZDAppOpen = async (userId) => {
    try {
        const status = await getTZDStatus(userId);
        if (status && status.isActive && status.stage === 'running') {
            
            if (status.lastPenaltyAt) {
                const lastPenaltyTime = status.lastPenaltyAt.toDate ? status.lastPenaltyAt.toDate() : new Date(status.lastPenaltyAt);
                const hoursSince = (new Date() - lastPenaltyTime) / (1000 * 60 * 60);
                if (hoursSince < 1) {
                    console.log("TZD Penalty Cooldown: Letzte Strafe war vor weniger als 1 Stunde.");
                    return false;
                }
            }

            const penaltyMinutes = TZD_CONFIG.PENALTY_MINUTES;
            await updateDoc(doc(db, `users/${userId}/status/tzd`), {
                targetDurationMinutes: increment(penaltyMinutes),
                penaltyCount: increment(1),
                lastPenaltyAt: serverTimestamp()
            });

            if (status.lockedItems) {
                for (const item of status.lockedItems) {
                    await addItemHistoryEntry(userId, item.id, {
                        type: 'tzd_penalty',
                        message: `App-Nutzung während TZD: +${penaltyMinutes} Minuten Strafe.`
                    });
                }
            }
            return true; 
        }
        return false; 
    } catch (e) {
        return false;
    }
};

export const confirmTZDBriefing = async (userId) => {
    await updateDoc(doc(db, `users/${userId}/status/tzd`), { 
        stage: 'running',
        startTime: serverTimestamp() 
    });

    const status = await getTZDStatus(userId);
    if (status && status.lockedItems) {
        for (const item of status.lockedItems) {
            await addItemHistoryEntry(userId, item.id, {
                type: 'tzd_running',
                message: "Briefing bestätigt. Zeitloses Diktat läuft jetzt."
            });
        }
    }
};

export const terminateTZD = async (userId, success = true, customResult = null) => {
    const endTime = serverTimestamp();
    const status = await getTZDStatus(userId);
    
    const finalResult = customResult ? customResult : (success ? 'completed' : 'failed');

    await updateDoc(doc(db, `users/${userId}/status/tzd`), { 
        isActive: false, 
        endTime: endTime, 
        result: finalResult 
    });

    try {
        const q = query(
            collection(db, `users/${userId}/sessions`),
            where('type', '==', 'tzd'), 
            where('endTime', '==', null)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const activeSessionDoc = querySnapshot.docs[0];
            await updateDoc(activeSessionDoc.ref, {
                tzdExecuted: true,
                tzdDurationMinutes: status?.accumulatedMinutes || status?.targetDurationMinutes || 0
            });
        }
    } catch (e) { console.error("Fehler beim Setzen von tzdExecuted:", e); }

    if (success) {
        if (status && status.targetDurationMinutes >= 1440) {
            await setImmunity(userId, 24);
        }
    }

    if (status && status.lockedItems) {
        for (const item of status.lockedItems) {
            const finalMinutes = status.accumulatedMinutes || 0;
            await addItemHistoryEntry(userId, item.id, {
                type: success ? 'tzd_completed' : 'tzd_failed',
                message: success 
                    ? `Zeitloses Diktat erfolgreich beendet (${finalMinutes} Min).`
                    : `Zeitloses Diktat abgebrochen (${finalResult}).`
            });
        }
    }
};

export const emergencyBailout = async (userId) => {
    const status = await getTZDStatus(userId);
    let chargeNc = false;
    let chargeLc = false;

    if (status && status.isActive && status.lockedItems && status.lockedItems.length > 0) {
        status.lockedItems.forEach(item => {
            const cat = (item.mainCategory || '').toLowerCase();
            const sub = (item.subCategory || '').toLowerCase();
            const name = (item.name || '').toLowerCase();

            if (cat.includes('nylon') || sub.includes('nylon') || name.includes('nylon') || 
                cat.includes('strumpfhose') || sub.includes('strumpfhose') || name.includes('strumpfhose') ||
                cat.includes('tights') || sub.includes('tights') || name.includes('tights')) {
                chargeNc = true;
            }
            if (cat.includes('dessous') || sub.includes('dessous') || name.includes('dessous') ||
                cat.includes('lingerie') || sub.includes('lingerie') || name.includes('lingerie') ||
                cat.includes('höschen') || sub.includes('höschen') || name.includes('höschen') ||
                cat.includes('panty') || sub.includes('panty') || name.includes('panty') ||
                cat.includes('bh') || sub.includes('bh') || name.includes('bh') ||
                cat.includes('bra') || sub.includes('bra') || name.includes('bra')) {
                chargeLc = true;
            }
        });
    }
    
    if (!chargeNc && !chargeLc) {
        chargeNc = true;
        chargeLc = true;
    }

    const tbRef = doc(db, `users/${userId}/status/timeBank`);
    const tbSnap = await getDoc(tbRef);
    let ncBalance = 0;
    let lcBalance = 0;
    if (tbSnap.exists()) {
        ncBalance = tbSnap.data().nc || 0;
        lcBalance = tbSnap.data().lc || 0;
    }

    let targetDeductionNc = 0;
    let targetDeductionLc = 0;
    const MIN_PENALTY = 400;
    const RATE = 0.40;

    if (chargeNc) {
        const positiveNc = Math.max(0, ncBalance);
        targetDeductionNc = Math.max(MIN_PENALTY, Math.floor(positiveNc * RATE));
    }
    if (chargeLc) {
        const positiveLc = Math.max(0, lcBalance);
        targetDeductionLc = Math.max(MIN_PENALTY, Math.floor(positiveLc * RATE));
    }

    const liquidation = await liquidateAssets(userId, targetDeductionNc, targetDeductionLc);

    if (liquidation.totalRemainingDebt > 0) {
        const convertedPunishment = liquidation.totalRemainingDebt * 2; 

        const uniformityRef = doc(db, `users/${userId}/status/uniformity`);
        const expiresAt = new Date(Date.now() + 96 * 60 * 60 * 1000); 
        const lockedItemIds = status && status.lockedItems ? status.lockedItems.map(i => i.id) : [];

        await setDoc(uniformityRef, {
            active: true,
            itemIds: lockedItemIds,
            triggeredAt: serverTimestamp(),
            expiresAt: expiresAt,
            reason: "Insolvenz bei TZD-Abbruch. System-Zwang.",
            showTriggerOverlay: true
        }, { merge: true });

        const punishmentMsg = `Insolvenz-Vollstreckung (TZD Bailout). Konvertierte Restschuld: ${liquidation.totalRemainingDebt}m. Bankrott-Sperre aktiv.`;
        await registerPunishment(userId, punishmentMsg, convertedPunishment);

        if (lockedItemIds.length > 0) {
            for (const itemId of lockedItemIds) {
                await addItemHistoryEntry(userId, itemId, {
                    type: 'uniformity_triggered',
                    message: `TZD-Insolvenz! Item für 96 Stunden als Straf-Uniform verriegelt.`
                });
            }
        }

        await terminateTZD(userId, false, 'aborted_emergency');
        throw new Error(`INSOLVENZ! Limit erreicht. Restschuld (${liquidation.totalRemainingDebt}m) in Strafzeit x2 konvertiert. Erzwungene Monotonie aktiv!`);
    } else {
        const punishmentMsg = `NOT-ABBRUCH TZD: Bailout erkauft. Währung dezimiert (NC: -${liquidation.liquidatedNc}, LC: -${liquidation.liquidatedLc}).`;
        await registerPunishment(userId, punishmentMsg, 90);
        await terminateTZD(userId, false, 'aborted_emergency');
    }
};

export const convertTZDToPlugPunishment = async (userId, allItems) => {
    try {
        const plug = allItems.find(i => {
            const name = (i.name || "").toLowerCase();
            const sub = (i.subCategory || "").toLowerCase();
            const cat = (i.mainCategory || "").toLowerCase();
            return (
                name.includes("plug") || sub.includes("plug") || cat.includes("anal") ||
                name.includes("butt") || sub.includes("butt")
            );
        });

        const penaltyItem = plug || allItems.find(i => i.category === 'Toy') || allItems[0];
        if (!penaltyItem) throw new Error("No penalty item found");

        await registerPunishment(
            userId, 
            "TZD Abbruch / Verweigerung", 
            TZD_CONFIG.ABORT_PUNISHMENT_DURATION, 
            penaltyItem.id
        );

        await updateDoc(doc(db, `users/${userId}/status/dailyInstruction`), {
            tzdDurationMinutes: 0,
            tzdStartTime: null
        });
        
        await terminateTZD(userId, false, 'aborted_punished');

        return { success: true, item: penaltyItem.name };
    } catch (e) {
        console.error("Conversion failed:", e);
        return { success: false };
    }
};

export const swapItemInTZD = async (userId, oldItemId, archiveData, allItems) => {
    try {
        const statusDocRef = doc(db, `users/${userId}/status/tzd`);
        const statusSnap = await getDoc(statusDocRef);
        if (!statusSnap.exists()) throw new Error("Kein TZD aktiv.");
        const tzdData = statusSnap.data();

        const oldItemEntry = tzdData.lockedItems.find(i => i.id === oldItemId);
        if (!oldItemEntry) throw new Error("Item nicht im TZD gefunden.");

        const oldItemFull = allItems.find(i => i.id === oldItemId);
        const subCat = oldItemFull ? (oldItemFull.subCategory || "") : (oldItemEntry.subCategory || "");
        const mainCat = oldItemFull ? (oldItemFull.mainCategory || "") : (oldItemEntry.mainCategory || "");

        let candidates = allItems.filter(i => i.id !== oldItemId && i.status === 'active' && i.subCategory === subCat);
        if (candidates.length === 0) {
            candidates = allItems.filter(i => i.id !== oldItemId && i.status === 'active' && i.mainCategory === mainCat);
        }
        if (candidates.length === 0) {
            candidates = allItems.filter(i => i.id !== oldItemId && i.status === 'active');
        }

        if (candidates.length === 0) throw new Error("Kein Ersatz im Inventar verfügbar.");
        const replacement = candidates[Math.floor(Math.random() * candidates.length)];

        const batch = writeBatch(db);

        const oldItemRef = doc(db, `users/${userId}/items`, oldItemId);
        batch.update(oldItemRef, {
            status: 'archived',
            archiveReason: archiveData.reason,
            defectLocation: archiveData.defectLocation || '',
            defectCause: archiveData.defectCause || '',
            archivedAt: serverTimestamp()
        });

        const newItemRef = doc(db, `users/${userId}/items`, replacement.id);
        batch.update(newItemRef, { status: 'worn' });

        const newLockedItems = tzdData.lockedItems.map(item => {
            if (item.id === oldItemId) {
                return {
                    id: replacement.id,
                    name: replacement.name,
                    customId: replacement.customId || 'N/A',
                    brand: replacement.brand,
                    img: replacement.imageUrl || (replacement.images && replacement.images[0]) || null,
                    subCategory: replacement.subCategory || '',
                    mainCategory: replacement.mainCategory || ''
                };
            }
            return item;
        });

        const tzdUpdates = { lockedItems: newLockedItems };
        if (tzdData.itemId === oldItemId) {
            tzdUpdates.itemId = replacement.id;
            tzdUpdates.itemName = replacement.name;
        }
        batch.update(statusDocRef, tzdUpdates);

        const qTzd = query(collection(db, `users/${userId}/sessions`), where('isActive', '==', true), where('type', '==', 'tzd'));
        const activeTzdSnap = await getDocs(qTzd);
        
        if (!activeTzdSnap.empty) {
            const sessionDoc = activeTzdSnap.docs[0];
            const sessionData = sessionDoc.data();
            
            const newItemIds = sessionData.itemIds ? sessionData.itemIds.map(id => id === oldItemId ? replacement.id : id) : [];
            const newItemsDetails = sessionData.itemsDetails ? sessionData.itemsDetails.map(item => {
                if (item.id === oldItemId) {
                    return {
                        id: replacement.id,
                        name: replacement.name || replacement.subCategory || 'Unknown',
                        brand: replacement.brand || 'Unknown',
                        category: replacement.category || replacement.mainCategory || 'Nylons',
                        customId: replacement.customId || null,
                        imageUrl: replacement.imageUrl || (replacement.images && replacement.images.length > 0 ? replacement.images[0] : null)
                    };
                }
                return item;
            }) : [];

            const sessionUpdates = {
                itemIds: newItemIds,
                itemsDetails: newItemsDetails
            };
            
            if (sessionData.itemLedger) {
                sessionUpdates[`itemLedger.${oldItemId}.leftAt`] = serverTimestamp();
                sessionUpdates[`itemLedger.${replacement.id}`] = { joinedAt: serverTimestamp(), leftAt: null };
            }
            
            batch.update(sessionDoc.ref, sessionUpdates);
        }

        const historyRef = doc(collection(db, `users/${userId}/history`));
        batch.set(historyRef, {
            type: 'tzd_swap',
            oldItemName: oldItemFull ? oldItemFull.name : 'Unknown',
            newItemName: replacement.name,
            reason: archiveData.reason,
            timestamp: serverTimestamp()
        });

        await batch.commit();

        await addItemHistoryEntry(userId, replacement.id, {
            type: 'tzd_entry',
            message: `Ersatz für archiviertes Item (${oldItemFull?.name || 'Unbekannt'}) im laufenden TZD.`
        });

        return { success: true, newItemName: replacement.name };
    } catch (e) {
        console.error("Swap failed:", e);
        return { success: false, error: e.message };
    }
};

export const grantTZDAmnesty = async (userId) => {
    const tbRef = doc(db, `users/${userId}/status/timeBank`);
    const tzdRef = doc(db, `users/${userId}/status/tzd`);
    
    try {
        const tbSnap = await getDoc(tbRef);
        if (!tbSnap.exists()) return false;
        
        const data = tbSnap.data();
        if (data.nc >= 500 && data.lc >= 500) {
            const amnestyEnd = new Date(Date.now() + 24 * 60 * 60 * 1000); 
            
            await updateDoc(tbRef, {
                nc: increment(-500),
                lc: increment(-500),
                tzdAmnestyUntil: amnestyEnd
            });
            
            const tzdSnap = await getDoc(tzdRef);
            let interruptedData = null;
            if (tzdSnap.exists()) {
                interruptedData = tzdSnap.data().interruptedInstruction;
                if(tzdSnap.data().lockedItems) {
                    for(const item of tzdSnap.data().lockedItems) {
                        await addItemHistoryEntry(userId, item.id, {
                            type: 'tzd_amnestied',
                            message: 'TZD durch Amnestie-Freikauf (500 NC & 500 LC) abgewendet.'
                        });
                    }
                }
            }

            const qTzd = query(collection(db, `users/${userId}/sessions`), where('isActive', '==', true), where('type', '==', 'tzd'));
            const activeTzdSnap = await getDocs(qTzd);
            for (const activeDoc of activeTzdSnap.docs) {
                await stopSession(userId, activeDoc.id, { note: 'Beendet durch Amnestie-Kauf' });
            }

            await updateDoc(tzdRef, {
                isActive: false,
                result: 'amnestied',
                endTime: serverTimestamp()
            });

            if (interruptedData && interruptedData.items && interruptedData.items.length > 0) {
                await startSession(userId, {
                    items: interruptedData.items,
                    type: 'instruction',
                    periodId: interruptedData.periodId,
                    instructionDurationMinutes: interruptedData.remainingDuration,
                    note: 'Nahtlose Wiederaufnahme nach Amnestie'
                });

                await updateDoc(doc(db, `users/${userId}/status/dailyInstruction`), {
                    durationMinutes: interruptedData.remainingDuration
                });
            }

            return true;
        }
        return false;
    } catch (e) {
        console.error("Amnesty Error:", e);
        return false;
    }
};