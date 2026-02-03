import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp, setDoc, getDoc, increment, query, collection, where, getDocs } from 'firebase/firestore';
import { safeDate } from '../utils/dateUtils';
import { registerPunishment } from './PunishmentService';
import { DEFAULT_PROTOCOL_RULES } from '../config/defaultRules';

// --- CORE LOGIK: Matrix Berechnung ---
/**
 * Leitet die drei Zonen mathematisch aus der Maximaldauer ab.
 * Bait:     1/6 bis 1/3 von Max
 * Standard: 1/3 bis 2/3 von Max
 * Wall:     2/3 bis 1/1 von Max
 */
export const generateTZDMatrix = (maxHours) => {
    // Fallback auf Default, falls ungültig
    const safeMax = (typeof maxHours === 'number' && maxHours >= 6) ? maxHours : DEFAULT_PROTOCOL_RULES.tzd.tzdMaxHours;
    const weights = DEFAULT_PROTOCOL_RULES.tzd.zoneWeights;

    return [
        { 
            label: 'The Bait', 
            min: safeMax / 6, 
            max: safeMax / 3, 
            weight: weights[0] 
        },
        { 
            label: 'The Standard', 
            min: safeMax / 3, 
            max: (safeMax * 2) / 3, 
            weight: weights[1] 
        },
        { 
            label: 'The Wall', 
            min: (safeMax * 2) / 3, 
            max: safeMax, 
            weight: weights[2] 
        }
    ];
};

// --- HELPER ---
const determineSecretDuration = (matrix) => {
    // Sicherheitsnetz
    if (!matrix || matrix.length === 0) return 12 * 60;

    const rand = Math.random();
    let cumulative = 0;
    
    for (const zone of matrix) {
        const weight = zone.weight || 0;
        cumulative += weight;
        
        if (rand < cumulative) {
            // Min/Max sind in Stunden -> Umrechnung in Minuten
            const minMin = zone.min * 60;
            const maxMin = zone.max * 60;
            const range = maxMin - minMin;
            
            const randomOffsetMinutes = Math.floor(Math.random() * (range + 1));
            return minMin + randomOffsetMinutes;
        }
    }
    
    return matrix[0].max * 60; // Fallback
};

// --- ELIGIBILITY CHECK ---
export const isItemEligibleForTZD = (item) => {
    if (!item) return false;
    const cat = (item.mainCategory || '').toLowerCase();
    const sub = (item.subCategory || '').toLowerCase();
    const name = (item.name || '').toLowerCase();

    // Nur Strumpfhosen/Tights
    if (cat.includes('strumpfhose') || sub.includes('strumpfhose') || name.includes('strumpfhose') || 
        cat.includes('tights') || sub.includes('tights')) {
        return true;
    }

    return false;
};

// --- TRIGGER LOGIK ---
export const checkForTZDTrigger = async (userId, activeSessions, items) => {
    // 1. Zeitfenster Prüfung (So 23:30 - Do 12:30)
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

    // 2. Session Prüfung
    const instructionSessions = activeSessions.filter(s => 
        s.type === 'instruction' && !s.tzdExecuted
    );
    if (instructionSessions.length === 0) return false;

    // 3. Item Prüfung
    const activeItemIds = new Set();
    instructionSessions.forEach(s => {
        if (s.itemId) activeItemIds.add(s.itemId);
        if (s.itemIds) s.itemIds.forEach(id => activeItemIds.add(id));
    });

    const relevantItems = items.filter(i => activeItemIds.has(i.id) && isItemEligibleForTZD(i));
    if (relevantItems.length === 0) return false;

    // 4. Wahrscheinlichkeit & MaxHours laden
    let currentChance = DEFAULT_PROTOCOL_RULES.tzd.triggerChance;
    let currentMaxHours = DEFAULT_PROTOCOL_RULES.tzd.tzdMaxHours;

    try {
        const settingsSnap = await getDoc(doc(db, `users/${userId}/settings/protocol`));
        if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            if (data.tzd) {
                if (typeof data.tzd.triggerChance === 'number') {
                    currentChance = data.tzd.triggerChance;
                }
                if (typeof data.tzd.tzdMaxHours === 'number') {
                    currentMaxHours = data.tzd.tzdMaxHours;
                }
            }
        }
    } catch (e) {
        console.error("Fehler beim Laden der TZD Settings, nutze Defaults", e);
    }

    const roll = Math.random();
    // console.log(`TZD Check: Roll ${roll.toFixed(3)} vs Chance ${currentChance}`);

    if (roll < currentChance) {
        // HIER: Dynamische Generierung der Matrix basierend auf MaxHours
        const dynamicMatrix = generateTZDMatrix(currentMaxHours);
        await startTZD(userId, relevantItems, dynamicMatrix);
        return true;
    }

    return false;
};

/**
 * Startet das Protokoll
 */
export const startTZD = async (userId, targetItems, durationMatrix) => {
    const targetDuration = determineSecretDuration(durationMatrix);
    const itemsArray = Array.isArray(targetItems) ? targetItems : [targetItems];

    const tzdData = {
        isActive: true,
        startTime: serverTimestamp(),
        targetDurationMinutes: Math.round(targetDuration),
        lockedItems: itemsArray.map(i => ({
            id: i.id,
            name: i.name,
            customId: i.customId || 'N/A',
            brand: i.brand
        })),
        itemId: itemsArray[0]?.id, 
        itemName: itemsArray[0]?.name,
        accumulatedMinutes: 0,
        lastCheckIn: serverTimestamp(),
        stage: 'briefing',
        isFailed: false
    };

    await setDoc(doc(db, `users/${userId}/status/tzd`), tzdData);
    return tzdData;
};

// --- STATUS & CHECK-IN ---

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

/**
 * Bestraft das Öffnen der App während eines laufenden TZD.
 */
export const penalizeTZDAppOpen = async (userId) => {
    try {
        const tzdRef = doc(db, `users/${userId}/status/tzd`);
        const tzdSnap = await getDoc(tzdRef);

        if (!tzdSnap.exists()) return false;

        const data = tzdSnap.data();

        if (data.isActive && data.stage === 'running') {
            await updateDoc(tzdRef, {
                targetDurationMinutes: increment(15)
            });
            console.log("TZD Penalty: +15 Minuten wegen App-Öffnung.");
            return true;
        }

        return false;
    } catch (e) {
        console.error("Fehler bei TZD Penalty:", e);
        return false;
    }
};

// --- EREIGNIS-HANDLER ---

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