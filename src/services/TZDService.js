import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp, addDoc, collection, getDoc, setDoc, increment } from 'firebase/firestore';

// --- HELPER: CRASH PREVENTION ---
const safeDate = (val) => {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate(); 
    if (val instanceof Date) return val;
    return new Date(val); 
};

// --- KONSTANTEN ---
const TZD_LIVE_DATE = new Date('2026-01-02T00:00:00');

// UPDATE: 10% Chance (war 0.00)
const TRIGGER_CHANCE = 0.10; 

const TIME_MATRIX = [
    { label: 'The Bait', min: 6, max: 12, cumulative: 0.20 },
    { label: 'The Standard', min: 12, max: 24, cumulative: 0.70 },
    { label: 'The Wall', min: 24, max: 36, cumulative: 1.00 }
];

// --- FILTER-LOGIK ---
export const isItemEligibleForTZD = (item) => {
    if (!item) return false;

    const cat = (item.mainCategory || '').toLowerCase();
    const sub = (item.subCategory || '').toLowerCase();
    const brand = (item.brand || '').toLowerCase();
    const name = (item.name || '').toLowerCase();

    // 1. STRUMPFHOSE
    if (cat.includes('strumpfhose') || sub.includes('strumpfhose') || name.includes('strumpfhose') ||
        cat.includes('tights') || sub.includes('tights')) {
        return true;
    }

    // 2. INTIMISSIMI HÖSCHEN
    if (brand.includes('intimissimi')) {
        if (sub.includes('slip') || sub.includes('panty') || sub.includes('string') || 
            sub.includes('thong') || sub.includes('höschen') || sub.includes('brief') ||
            name.includes('slip') || name.includes('panty') || name.includes('höschen')) {
            return true;
        }
    }

    return false;
};

/**
 * SCHRITT 1: Der Trigger-Check (Aktiviert)
 * Bedingung: Sonntag 23:30 bis Donnerstag 12:00 Uhr
 */
export const shouldTriggerProtocol = (settings) => {
    const now = new Date();
    
    // Safety: Erst ab Live-Datum (oder wenn Testmodus an ist, was hier aber nicht geprüft wird)
    if (now < TZD_LIVE_DATE && !settings?.tzdTestMode) return false;

    const day = now.getDay(); // 0=So, 1=Mo, ..., 6=Sa
    const hour = now.getHours();
    const min = now.getMinutes();

    let inWindow = false;

    // ZEITFENSTER PRÜFUNG
    if (day === 0) { // Sonntag
        // Erst ab 23:30
        if (hour === 23 && min >= 30) inWindow = true;
    } else if (day >= 1 && day <= 3) { // Montag (1), Dienstag (2), Mittwoch (3)
        // Ganztägig erlaubt
        inWindow = true;
    } else if (day === 4) { // Donnerstag
        // Nur bis 12:00 Uhr
        if (hour < 12) inWindow = true;
    }
    // Freitag (5) und Samstag (6) bleiben false

    if (!inWindow) return false;

    // ZUFALLS-TRIGGER
    return Math.random() < TRIGGER_CHANCE;
};

/**
 * SCHRITT 2: Die Dauer-Berechnung
 */
const determineSecretDuration = () => {
    const rand = Math.random();
    for (const zone of TIME_MATRIX) {
        if (rand < zone.cumulative) {
            const range = zone.max - zone.min;
            const randomOffset = Math.floor(Math.random() * (range + 1));
            return (zone.min + randomOffset) * 60;
        }
    }
    return 12 * 60;
};

/**
 * Startet TZD 
 */
export const startTZD = async (userId, item, isTestMode = false) => {
    if (!isItemEligibleForTZD(item)) {
        throw new Error("TZD VERWEIGERT: Item ist nicht für das Protokoll zugelassen.");
    }

    const checkInWindowStart = new Date();
    const checkInWindowEnd = new Date();

    if (isTestMode) {
        checkInWindowStart.setHours(0, 0, 0, 0);
        checkInWindowEnd.setHours(23, 59, 59, 999);
    } else {
        checkInWindowStart.setHours(18, 0, 0, 0); 
        checkInWindowEnd.setHours(22, 0, 0, 0);
    }

    const targetDuration = determineSecretDuration();

    // 1. ECHTE SESSION STARTEN
    const sessionRef = await addDoc(collection(db, `users/${userId}/sessions`), {
        itemId: item.id,
        itemIds: [item.id],
        type: 'tzd',
        startTime: serverTimestamp(),
        endTime: null,
        isShadowSession: true 
    });

    await updateDoc(doc(db, `users/${userId}/items`, item.id), { status: 'wearing' });

    // 2. TZD STATUS SETZEN
    const tzdData = {
        isActive: true,
        startTime: serverTimestamp(),
        targetDurationMinutes: targetDuration,
        itemId: item.id,
        itemName: item.name,
        accumulatedMinutes: 0,
        phase: 'diurnal',
        lastCheckIn: serverTimestamp(),
        checkInWindowStart: checkInWindowStart,
        checkInWindowEnd: checkInWindowEnd,
        stage: 'briefing',
        isFailed: false,
        linkedSessionId: sessionRef.id
    };

    await setDoc(doc(db, `users/${userId}/status/tzd`), tzdData);
    return tzdData;
};

// ... Rest der Datei (performCheckIn, terminateTZD etc.) bleibt identisch ...
export const performCheckIn = async (userId) => {
    const status = await getTZDStatus(userId);
    if (!status || !status.isActive) throw new Error("Kein aktives TZD.");
    
    const prefSnap = await getDoc(doc(db, `users/${userId}/settings/preferences`));
    const prefs = prefSnap.exists() ? prefSnap.data() : {};
    const isTestMode = prefs.tzdTestMode === true;

    const now = new Date();
    const startDate = safeDate(status.startDate) || new Date();
    const elapsedRealSeconds = (now - startDate) / 1000;
    
    const multiplier = isTestMode ? 3600 : 1; 
    const virtualSeconds = elapsedRealSeconds * multiplier;
    const accumulatedMinutes = Math.floor(virtualSeconds / 60);

    const targetMinutes = status.targetDurationMinutes || (12 * 60);
    const isCompleted = accumulatedMinutes >= targetMinutes;

    await updateDoc(doc(db, `users/${userId}/status/tzd`), {
        lastCheckIn: serverTimestamp(),
        accumulatedMinutes: accumulatedMinutes
    });

    return { completed: isCompleted, elapsedSeconds: virtualSeconds, isTestMode: isTestMode };
};

export const validateSessionCompliance = (sessionData) => {
    const now = new Date();
    const hour = now.getHours();
    const isNight = hour >= 22 || hour < 6;
    if (isNight) {
        if (!sessionData.ingestionConfirmed) {
            return { compliant: false, violation: 'NIGHT_PROTOCOL_BREACH', message: 'Verstoß: Ingestion bei Nacht-Session fehlgeschlagen.' };
        }
    }
    return { compliant: true, message: 'Konform' };
};

export const logProtocolViolation = async (userId, violationData) => {
    try {
        await addDoc(collection(db, `users/${userId}/protocol_incidents`), { ...violationData, timestamp: serverTimestamp(), severity: 'CRITICAL', date: new Date() });
    } catch (e) { console.error(e); }
};

export const getProtocolStatus = (settings) => {
    return { isActive: false, mode: 'OFF', message: 'Protokoll deaktiviert', daysRemaining: 0 };
};

export const getTZDStatus = async (userId) => {
    try {
        const docRef = doc(db, `users/${userId}/status/tzd`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                ...data,
                startDate: safeDate(data.startDate),
                checkInWindowStart: safeDate(data.checkInWindowStart),
                checkInWindowEnd: safeDate(data.checkInWindowEnd),
                lastCheckIn: safeDate(data.lastCheckIn),
                endTime: safeDate(data.endTime)
            };
        }
        return null;
    } catch (e) { return null; }
};

export const confirmTZDBriefing = async (userId) => {
    await updateDoc(doc(db, `users/${userId}/status/tzd`), { stage: 'running', startDate: serverTimestamp() });
};

export const toggleSleepMode = async (userId, isGoingToSleep) => {
    await updateDoc(doc(db, `users/${userId}/status/tzd`), { phase: isGoingToSleep ? 'nocturnal' : 'diurnal', lastPhaseChange: serverTimestamp() });
};

export const terminateTZD = async (userId) => {
    const status = await getTZDStatus(userId);
    const endTime = serverTimestamp();
    await updateDoc(doc(db, `users/${userId}/status/tzd`), { isActive: false, endTime: endTime, stage: 'terminated' });
    if (status && status.itemId) {
        await updateDoc(doc(db, `users/${userId}/items`, status.itemId), { status: 'active', wearCount: increment(1), totalMinutes: increment(status.accumulatedMinutes || 0), lastWorn: endTime });
        if (status.linkedSessionId) {
            await updateDoc(doc(db, `users/${userId}/sessions`, status.linkedSessionId), { endTime: endTime, durationMinutes: status.accumulatedMinutes || 0, status: 'completed_tzd' });
        }
    }
};
