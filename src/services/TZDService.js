import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp, setDoc, getDoc, increment, query, collection, where, getDocs, addDoc } from 'firebase/firestore';
import { safeDate } from '../utils/dateUtils';
import { registerPunishment } from './PunishmentService';
import { setImmunity, isImmunityActive } from './OfferService'; 
import { addItemHistoryEntry } from './ItemService';

// --- KONFIGURATION (NEU) ---
const TZD_CONFIG = {
    DEFAULT_MULTIPLIER: 1.5,
    PENALTY_MINUTES: 15,
    MAX_HOURS_HARD_CAP: 24,
    ABORT_PUNISHMENT_DURATION: 360 // 6 Stunden Plug
};

// --- FALLBACK KONSTANTEN ---
const FALLBACK_TRIGGER_CHANCE = 0.12; 
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
 * Startet das Protokoll. 
 */
export const startTZD = async (userId, targetItems, durationMatrix, overrideDurationMinutes = null) => {
    let targetDuration;

    if (overrideDurationMinutes) {
        targetDuration = overrideDurationMinutes;
    } else {
        targetDuration = determineSecretDuration(durationMatrix);
    }

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
        isPenalty: !!overrideDurationMinutes 
    };

    await setDoc(doc(db, `users/${userId}/status/tzd`), tzdData);

    // Historie für alle betroffenen Items vermerken
    for (const item of itemsArray) {
        const messageText = overrideDurationMinutes 
            ? `Straf-TZD wegen Fluchtversuch gestartet (Dauer: ${Math.round(targetDuration)} Min).`
            : `Zeitloses Diktat gestartet (Dauer: ${Math.round(targetDuration)} Min).`;
            
        await addItemHistoryEntry(userId, item.id, {
            type: 'tzd_briefing',
            message: messageText,
            isPenalty: !!overrideDurationMinutes
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

        let baseDurationMinutes = 120; // Fallback
        const dailySnap = await getDoc(doc(db, `users/${userId}/status/dailyInstruction`));
        
        if (dailySnap.exists()) {
            const data = dailySnap.data();
            if (data.originalDurationMinutes) {
                baseDurationMinutes = data.originalDurationMinutes;
            } else if (data.durationMinutes) {
                baseDurationMinutes = data.durationMinutes;
            }
        }

        const penaltyMinutes = Math.round(baseDurationMinutes * TZD_CONFIG.DEFAULT_MULTIPLIER);
        console.log(`Evasion Detected. Triggering TZD Penalty: ${penaltyMinutes} minutes.`);

        await startTZD(userId, instructionItems, null, penaltyMinutes);
        
        await updateDoc(doc(db, `users/${userId}/status/dailyInstruction`), {
            evasionPenaltyTriggered: true,
            tzdDurationMinutes: penaltyMinutes
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
        
        await penalizeTZDAppOpen(userId);
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

    const relevantItems = items.filter(i => activeItemIds.has(i.id) && isItemEligibleForTZD(i));
    
    if (relevantItems.length === 0) return false;

    let currentChance = FALLBACK_TRIGGER_CHANCE;
    let currentMatrix = FALLBACK_MATRIX;

    try {
        const settingsSnap = await getDoc(doc(db, `users/${userId}/settings/protocol`));
        if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            if (data.tzd) {
                if (typeof data.tzd.triggerChance === 'number') {
                    currentChance = data.tzd.triggerChance;
                }
                if (data.tzd.durationMatrix && Array.isArray(data.tzd.durationMatrix)) {
                    currentMatrix = data.tzd.durationMatrix;
                }
            }
        }
    } catch (e) {
        console.error("Fehler beim Laden der TZD Settings, nutze Fallback", e);
    }

    const roll = Math.random();
    if (roll < currentChance) {
        await startTZD(userId, relevantItems, currentMatrix);
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

export const terminateTZD = async (userId, success = true) => {
    const endTime = serverTimestamp();
    const status = await getTZDStatus(userId);
    
    await updateDoc(doc(db, `users/${userId}/status/tzd`), { 
        isActive: false, 
        endTime: endTime, 
        result: success ? 'completed' : 'failed' 
    });

    if (success) {
        await updateDoc(doc(db, `users/${userId}/status/dailyInstruction`), {
            evasionPenaltyTriggered: false
        });

        if (status && status.targetDurationMinutes >= 1440) {
            await setImmunity(userId, 24);
        }

        try {
            const q = query(
                collection(db, `users/${userId}/sessions`),
                where('type', '==', 'instruction'),
                where('endTime', '==', null)
            );
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const activeSessionDoc = querySnapshot.docs[0];
                await updateDoc(activeSessionDoc.ref, {
                    tzdExecuted: true,
                    tzdDurationMinutes: status.accumulatedMinutes || status.targetDurationMinutes || 0
                });
            }
        } catch (e) { console.error(e); }
    }

    if (status && status.lockedItems) {
        for (const item of status.lockedItems) {
            const finalMinutes = status.accumulatedMinutes || 0;
            await updateDoc(doc(db, `users/${userId}/items`, item.id), { 
                wearCount: increment(success ? 1 : 0),
                totalMinutes: increment(success ? finalMinutes : 0),
                lastWorn: endTime
            });

            await addItemHistoryEntry(userId, item.id, {
                type: success ? 'tzd_completed' : 'tzd_failed',
                message: success 
                    ? `Zeitloses Diktat erfolgreich beendet (${finalMinutes} Min getragen).`
                    : "Zeitloses Diktat abgebrochen oder gescheitert."
            });
        }
    }
};

export const emergencyBailout = async (userId) => {
    await registerPunishment(userId, "NOT-ABBRUCH: Zeitloses Diktat verweigert", 90);
    await terminateTZD(userId, false);
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
            evasionPenaltyTriggered: false,
            tzdDurationMinutes: 0,
            tzdStartTime: null
        });
        
        await updateDoc(doc(db, `users/${userId}/status/tzd`), {
            isActive: false,
            result: 'aborted_punished'
        });

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

        await updateDoc(doc(db, `users/${userId}/items`, oldItemId), {
            status: 'archived',
            archiveReason: archiveData.reason,
            defectLocation: archiveData.defectLocation || '',
            defectCause: archiveData.defectCause || '',
            archivedAt: serverTimestamp()
        });

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

        const updates = { lockedItems: newLockedItems };
        if (tzdData.itemId === oldItemId) {
            updates.itemId = replacement.id;
            updates.itemName = replacement.name;
        }

        await updateDoc(statusDocRef, updates);

        await addDoc(collection(db, `users/${userId}/history`), {
            type: 'tzd_swap',
            oldItemName: oldItemFull ? oldItemFull.name : 'Unknown',
            newItemName: replacement.name,
            reason: archiveData.reason,
            timestamp: serverTimestamp()
        });

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