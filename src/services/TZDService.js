import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp, setDoc, getDoc, increment, query, collection, where, getDocs } from 'firebase/firestore';
import { safeDate } from '../utils/dateUtils';
import { registerPunishment } from './PunishmentService';

// --- KONSTANTEN ---
const TRIGGER_CHANCE = 0.08; // 8% Wahrscheinlichkeit

const TIME_MATRIX = [
    { label: 'The Bait', min: 6, max: 12, cumulative: 0.20 },
    { label: 'The Standard', min: 12, max: 24, cumulative: 0.70 },
    { label: 'The Wall', min: 24, max: 36, cumulative: 1.00 }
];

// --- HELPER ---
const determineSecretDuration = () => {
    const rand = Math.random();
    for (const zone of TIME_MATRIX) {
        if (rand < zone.cumulative) {
            const range = zone.max - zone.min;
            const randomOffset = Math.floor(Math.random() * (range + 1));
            return (zone.min + randomOffset) * 60; // Minuten
        }
    }
    return 12 * 60; // Fallback
};

// --- ELIGIBILITY CHECK ---
export const isItemEligibleForTZD = (item) => {
    if (!item) return false;
    const cat = (item.mainCategory || '').toLowerCase();
    const sub = (item.subCategory || '').toLowerCase();
    const brand = (item.brand || '').toLowerCase();
    const name = (item.name || '').toLowerCase();

    // 1. Strumpfhosen
    if (cat.includes('strumpfhose') || sub.includes('strumpfhose') || name.includes('strumpfhose') || 
        cat.includes('tights') || sub.includes('tights')) {
        return true;
    }

    // 2. Intimissimi Unterteile
    if (brand.includes('intimissimi')) {
        if (sub.includes('slip') || sub.includes('panty') || sub.includes('string') || 
            sub.includes('thong') || sub.includes('höschen') || sub.includes('brief') ||
            name.includes('slip') || name.includes('panty') || name.includes('höschen')) {
            return true;
        }
    }
    return false;
};

// --- TRIGGER LOGIK (Für Dashboard) ---
export const checkForTZDTrigger = async (userId, activeSessions, items) => {
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

    // Freitag (5) und Samstag (6) bleiben false

    if (!inWindow) return false;

    // 2. Session Prüfung: Läuft eine INSTRUCTION Session?
    const instructionSessions = activeSessions.filter(s => s.type === 'instruction');
    if (instructionSessions.length === 0) return false;

    // 3. Item Prüfung
    const activeItemIds = new Set();
    instructionSessions.forEach(s => {
        if (s.itemId) activeItemIds.add(s.itemId);
        if (s.itemIds) s.itemIds.forEach(id => activeItemIds.add(id));
    });

    const relevantItems = items.filter(i => activeItemIds.has(i.id) && isItemEligibleForTZD(i));
    
    if (relevantItems.length === 0) return false;

    // 4. Wahrscheinlichkeit
    const roll = Math.random();
    
    if (roll < TRIGGER_CHANCE) {
        await startTZD(userId, relevantItems);
        return true;
    }

    return false;
};

/**
 * Startet das Protokoll
 */
export const startTZD = async (userId, targetItems) => {
    const targetDuration = determineSecretDuration();
    const itemsArray = Array.isArray(targetItems) ? targetItems : [targetItems];

    const tzdData = {
        isActive: true,
        startTime: serverTimestamp(),
        targetDurationMinutes: targetDuration,
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
    
    // A) TZD Status deaktivieren
    await updateDoc(doc(db, `users/${userId}/status/tzd`), { 
        isActive: false, 
        endTime: endTime, 
        result: success ? 'completed' : 'failed' 
    });

    // B) NEU: Vermerk in der LAUFENDEN Instruction-Session
    // Wir suchen die aktive Instruction-Session und schreiben den TZD-Erfolg hinein.
    if (success) {
        try {
            const q = query(
                collection(db, `users/${userId}/sessions`),
                where('type', '==', 'instruction'),
                where('endTime', '==', null) // Nur aktive Sessions
            );
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                // Wir nehmen an, es gibt nur eine aktive Instruction
                const activeSessionDoc = querySnapshot.docs[0];
                await updateDoc(activeSessionDoc.ref, {
                    tzdExecuted: true,
                    tzdDurationMinutes: status.accumulatedMinutes || status.targetDurationMinutes || 0
                });
                console.log("TZD Erfolg in Session vermerkt:", activeSessionDoc.id);
            }
        } catch (e) {
            console.error("Fehler beim Vermerken des TZD in der Session:", e);
        }
    }

    // C) Item Stats Update
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