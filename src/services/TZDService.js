import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp, setDoc, getDoc, increment, query, collection, where, getDocs } from 'firebase/firestore';
import { safeDate } from '../utils/dateUtils';
import { registerPunishment } from './PunishmentService';
import { setImmunity, isImmunityActive } from './OfferService'; 

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
            img: i.imageUrl || (i.images && i.images[0]) || null
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
    return tzdData;
};

/**
 * Bestrafung für Fluchtversuch.
 * Geändert: Bricht ab, wenn bereits ein TZD läuft.
 */
export const triggerEvasionPenalty = async (userId, instructionItems) => {
    try {
        // Prüfung auf laufendes Protokoll
        const currentStatus = await getTZDStatus(userId);
        if (currentStatus && currentStatus.isActive) {
            console.log("Evasion Penalty unterdrückt: TZD bereits aktiv.");
            return false;
        }

        let maxWallHours = 12; 
        const settingsSnap = await getDoc(doc(db, `users/${userId}/settings/protocol`));
        
        if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            if (data.tzd && Array.isArray(data.tzd.durationMatrix)) {
                const maxInMatrix = Math.max(...data.tzd.durationMatrix.map(z => z.max || z.maxHours || 0));
                if (maxInMatrix > 0) maxWallHours = maxInMatrix;
            }
        }

        // Berechnung: 150% der Einstellung (über TZD_CONFIG)
        const penaltyMinutes = Math.round((maxWallHours * TZD_CONFIG.DEFAULT_MULTIPLIER) * 60);
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
 * Regulärer TZD Trigger.
 * Geändert: Prüft auf laufendes TZD.
 */
export const checkForTZDTrigger = async (userId, activeSessions, items) => {
    // 0. Status-Check: Keine Überlappung erlauben
    const currentStatus = await getTZDStatus(userId);
    if (currentStatus && currentStatus.isActive) {
        // --- FIX BEGIN: ZOMBIE SCHUTZ (40h Bug) ---
        // Wenn TZD aktiv ist, prüfen wir, ob wir Strafminuten addieren müssen.
        // ABER NICHT, wenn der User suspendiert/immun ist.
        
        // Schnell-Check auf Immunität
        const immune = await isImmunityActive(userId);
        if (immune) {
             console.log("TZD Wächter: Immunität aktiv. Keine Strafe.");
             return false;
        }
        
        // Schnell-Check auf Suspension (z.B. Medical)
        const dailyRef = doc(db, `users/${userId}/status/dailyInstruction`);
        const dailySnap = await getDoc(dailyRef);
        if (dailySnap.exists() && dailySnap.data().activeSuspension) {
             console.log("TZD Wächter: Suspension aktiv. Keine Strafe.");
             return false;
        }
        
        // Wenn KEINE Ausnahme -> Strafe für App-Nutzung während TZD
        await penalizeTZDAppOpen(userId);
        return true; // Triggered penalty
        // --- FIX END ---
    }

    // 1. Immunitäts-Check
    const immune = await isImmunityActive(userId);
    if (immune) return false;

    // 2. Zeitfenster Prüfung
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
            const penaltyMinutes = TZD_CONFIG.PENALTY_MINUTES;
            await updateDoc(doc(db, `users/${userId}/status/tzd`), {
                targetDurationMinutes: increment(penaltyMinutes),
                penaltyCount: increment(1),
                lastPenaltyAt: serverTimestamp()
            });
            console.log(`TZD Penalty: +${penaltyMinutes} min`);
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
        // Reset auch das Daily Flag bei Erfolg
        await updateDoc(doc(db, `users/${userId}/status/dailyInstruction`), {
            evasionPenaltyTriggered: false
        });

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

/**
 * NEU: Wandelt ein abgebrochenes TZD in eine physische Item-Strafe um.
 * Sucht nach Buttplug/Plug und startet 6h Strafe.
 * Beendet das TZD sofort.
 */
export const convertTZDToPlugPunishment = async (userId, allItems) => {
    try {
        // 1. Finde einen Plug
        const plug = allItems.find(i => {
            const name = (i.name || "").toLowerCase();
            const sub = (i.subCategory || "").toLowerCase();
            const cat = (i.mainCategory || "").toLowerCase();
            return (
                name.includes("plug") || sub.includes("plug") || cat.includes("anal") ||
                name.includes("butt") || sub.includes("butt")
            );
        });

        // Fallback: Irgendein Toy oder das erste Item, wenn kein Plug da ist
        const penaltyItem = plug || allItems.find(i => i.category === 'Toy') || allItems[0];

        if (!penaltyItem) throw new Error("No penalty item found");

        // 2. Registriere die Strafe (6 Stunden / 360 min)
        await registerPunishment(
            userId, 
            "TZD Abbruch / Verweigerung", 
            TZD_CONFIG.ABORT_PUNISHMENT_DURATION, 
            penaltyItem.id
        );

        // 3. TZD BEENDEN (Wichtig!)
        await updateDoc(doc(db, `users/${userId}/status/dailyInstruction`), {
            evasionPenaltyTriggered: false,
            tzdDurationMinutes: 0,
            tzdStartTime: null
        });
        
        // Auch das normale TZD Status Doc resetten
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