import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp, setDoc, getDoc, increment, query, collection, where, getDocs } from 'firebase/firestore';
import { safeDate } from '../utils/dateUtils';
import { registerPunishment } from './PunishmentService';

// --- FALLBACK KONSTANTEN (Falls keine Settings geladen werden können) ---
const FALLBACK_TRIGGER_CHANCE = 0.12; 

// Fallback Matrix mit Weights (passend zur Logik der Settings)
const FALLBACK_MATRIX = [
    { label: 'The Bait', min: 2, max: 4, weight: 0.20 },
    { label: 'The Standard', min: 4, max: 8, weight: 0.70 }, // Im Fallback leicht abweichend strukturiert, aber funktional
    { label: 'The Wall', min: 8, max: 12, weight: 0.10 }
];

// --- HELPER ---
/**
 * Berechnet die Dauer basierend auf der übergebenen Matrix (aus Settings oder Fallback).
 * Die Matrix aus den Settings nutzt 'weight' (z.B. 0.2), nicht 'cumulative'.
 */
const determineSecretDuration = (matrix) => {
    const durationMatrix = (matrix && matrix.length > 0) ? matrix : FALLBACK_MATRIX;
    const rand = Math.random();
    
    let cumulative = 0;
    
    for (const zone of durationMatrix) {
        // Sicherstellen, dass wir mit Weights arbeiten
        const weight = zone.weight || 0;
        cumulative += weight;
        
        if (rand < cumulative) {
            // Nutze minHours/maxHours aus Settings (dort heißen sie meist so) oder min/max als Fallback
            const min = zone.minHours !== undefined ? zone.minHours : zone.min;
            const max = zone.maxHours !== undefined ? zone.maxHours : zone.max;
            
            const range = max - min;
            // Zufällige Minuten innerhalb der Range
            const randomOffsetMinutes = Math.floor(Math.random() * (range * 60 + 1));
            
            return (min * 60) + randomOffsetMinutes; // Gesamtdauer in Minuten
        }
    }
    
    return 12 * 60; // Fallback, falls Mathe versagt
};

// --- ELIGIBILITY CHECK ---
export const isItemEligibleForTZD = (item) => {
    if (!item) return false;
    const cat = (item.mainCategory || '').toLowerCase();
    const sub = (item.subCategory || '').toLowerCase();
    const name = (item.name || '').toLowerCase();

    // Änderung: Nur noch Strumpfhosen lösen das Diktat aus.
    if (cat.includes('strumpfhose') || sub.includes('strumpfhose') || name.includes('strumpfhose') || 
        cat.includes('tights') || sub.includes('tights')) {
        return true;
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

    if (!inWindow) return false;

    // 2. Session Prüfung: Läuft eine INSTRUCTION Session?
    // FIX: Wir filtern Sessions heraus, die bereits ein TZD hatten (s.tzdExecuted)
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

    // 4. Wahrscheinlichkeit & Settings laden
    // HIER IST DIE ÄNDERUNG: Wir laden die echten User-Settings
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
    
    // Debug Log für dich (kann später raus)
    console.log(`TZD Check: Roll ${roll.toFixed(3)} vs Chance ${currentChance}`);

    if (roll < currentChance) {
        // Wir übergeben die geladene Matrix an startTZD
        await startTZD(userId, relevantItems, currentMatrix);
        return true;
    }

    return false;
};

/**
 * Startet das Protokoll
 */
export const startTZD = async (userId, targetItems, durationMatrix) => {
    // Nutze die übergebene Matrix (aus Settings) oder Fallback
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

    // B) Vermerk in der LAUFENDEN Instruction-Session
    // Dieser "Stempel" (tzdExecuted) verhindert den Neustart in der Trigger-Logik.
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