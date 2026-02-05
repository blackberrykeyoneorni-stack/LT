import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp, setDoc, getDoc, increment, query, collection, where, getDocs } from 'firebase/firestore';
import { safeDate } from '../utils/dateUtils';
import { registerPunishment } from './PunishmentService';
// Importiere setImmunity und isImmunityActive (Achtung: Zirkuläre Abhängigkeit vermeiden. 
// Wir implementieren die Checks hier direkt oder lagern aus. Um es einfach zu halten, kopieren wir den Check bzw. importieren OfferService nur wo nötig.)
import { setImmunity, isImmunityActive } from './OfferService'; 

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
 * Neu: Akzeptiert overrideDurationMinutes für Straf-Szenarien oder Gamble-Verlust.
 */
export const startTZD = async (userId, targetItems, durationMatrix, overrideDurationMinutes = null) => {
    let targetDuration;

    if (overrideDurationMinutes) {
        // Explizite Dauer (z.B. Strafaufschlag oder Gamble-Verlust)
        targetDuration = overrideDurationMinutes;
    } else {
        // Zufallsgenerator
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
            img: i.imageUrl || (i.images && i.images[0]) || null
        })),
        itemId: itemsArray[0]?.id, 
        itemName: itemsArray[0]?.name,
        
        accumulatedMinutes: 0,
        lastCheckIn: serverTimestamp(),
        stage: 'briefing',
        isFailed: false,
        isPenalty: !!overrideDurationMinutes // Flag für UI
    };

    await setDoc(doc(db, `users/${userId}/status/tzd`), tzdData);
    return tzdData;
};

/**
 * Bestrafung für Fluchtversuch (Blockade umgangen).
 * IGNORIERT Immunität.
 */
export const triggerEvasionPenalty = async (userId, instructionItems) => {
    try {
        let maxWallHours = 12; 
        const settingsSnap = await getDoc(doc(db, `users/${userId}/settings/protocol`));
        
        if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            if (data.tzd && Array.isArray(data.tzd.durationMatrix)) {
                const maxInMatrix = Math.max(...data.tzd.durationMatrix.map(z => z.max || z.maxHours || 0));
                if (maxInMatrix > 0) maxWallHours = maxInMatrix;
            }
        }

        const penaltyMinutes = Math.round((maxWallHours * 1.5) * 60);
        console.log(`Evasion Detected. Triggering TZD Penalty: ${penaltyMinutes} minutes.`);

        await startTZD(userId, instructionItems, null, penaltyMinutes);
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
 * Regulärer TZD Trigger (Das "Spiel").
 * PRÜFT auf Immunität (Cooldown).
 */
export const checkForTZDTrigger = async (userId, activeSessions, items) => {
    // 0. Immunitäts-Check
    const immune = await isImmunityActive(userId);
    if (immune) return false;

    // 1. Zeitfenster Prüfung (Sonntag 23:30 - Donnerstag 12:30)
    const now = new Date();
    const day = now.getDay(); 
    const hour = now.getHours();
    const min = now.getMinutes();

    let inWindow = false;
    if (day === 0) { // Sonntag ab 23:30
        if (hour === 23 && min >= 30) inWindow = true;
    } else if (day >= 1 && day <= 3) { // Mo, Di, Mi
        inWindow = true;
    } else if (day === 4) { // Donnerstag bis 12:30
        if (hour < 12 || (hour === 12 && min <= 30)) inWindow = true;
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
        return { ...statusData, accumulatedMinutes: elapsedMinutes, isActive: true };
    }
};

export const penalizeTZDAppOpen = async (userId) => {
    try {
        const status = await getTZDStatus(userId);
        if (status && status.isActive && status.stage === 'running') {
            const penaltyMinutes = 15;
            await updateDoc(doc(db, `users/${userId}/status/tzd`), {
                targetDurationMinutes: increment(penaltyMinutes),
                penaltyCount: increment(1),
                lastPenaltyAt: serverTimestamp()
            });
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
        // NEU: COOLDOWN LOGIK
        // Wenn TZD >= 24h (1440 Min) war und erfolgreich beendet wurde, gibt es 24h Immunität.
        if (status && status.targetDurationMinutes >= 1440) {
            await setImmunity(userId, 24);
            console.log("24h TZD überstanden. Cooldown (Immunität) aktiviert.");
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

    if (success && status && status.itemId) {
        await updateDoc(doc(db, `users/${userId}/items`, status.itemId), { 
            wearCount: increment(1),
            totalMinutes: increment(status.accumulatedMinutes || 0),
            lastWorn: endTime
        });
    }
};

export const emergencyBailout = async (userId) => {
    await registerPunishment(userId, "NOT-ABBRUCH: Zeitloses Diktat verweigert", 90);
    await terminateTZD(userId, false);
};