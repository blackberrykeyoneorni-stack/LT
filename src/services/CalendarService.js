import { db } from '../firebase';
import { 
    collection, query, where, getDocs, doc, setDoc, deleteDoc, 
    serverTimestamp, orderBy 
} from 'firebase/firestore';
import { format, addDays, startOfMonth, endOfMonth, isSameDay, differenceInHours } from 'date-fns';

// --- KONSTANTEN ---
const COLLECTION_PLANNING = 'planning';

// Helper: Formatiert Date zu YYYY-MM-DD (Dokument-ID)
export const getDayId = (dateObj) => format(dateObj, 'yyyy-MM-dd');

/**
 * 1. SENTINEL CHECK (Der Wächter)
 * Prüft, ob ein Item an einem bestimmten Datum getragen werden kann.
 */
export const checkItemAvailability = (item, targetDateStr, allSessions, futurePlans, restingHours = 24) => {
    // Ziel-Datum als Date Objekt (Zeit auf 00:00 setzen für Vergleich)
    const targetDate = new Date(targetDateStr);
    targetDate.setHours(0,0,0,0);
    
    const today = new Date();
    today.setHours(0,0,0,0);

    const result = { available: true, reason: null, type: 'available' };

    // A. STATUS CHECK (Physisch)
    if (item.status === 'archived') {
        return { available: false, reason: 'Archiviert', type: 'archived' };
    }
    if (item.status === 'washing') {
        if (isSameDay(targetDate, today)) {
            return { available: false, reason: 'In der Wäsche', type: 'washing_block' };
        } else {
            return { available: true, reason: 'Muss gewaschen werden!', type: 'washing_warn' };
        }
    }

    // B. RECOVERY CHECK (Vergangenheit)
    if (item.mainCategory === 'Nylons' && item.lastWorn) {
        const lastWorn = item.lastWorn.toDate ? item.lastWorn.toDate() : new Date(item.lastWorn);
        // Differenz in Stunden
        const diffHours = differenceInHours(targetDate, lastWorn);
        
        if (diffHours < restingHours && diffHours >= 0) {
            return { available: false, reason: `Elasthan Recovery (${Math.ceil(restingHours - diffHours)}h)`, type: 'recovery' };
        }
    }

    // C. KONFLIKT CHECK (Zukunft / Pre-Locking)
    const nextDay = addDays(targetDate, 1);
    const nextDayId = format(nextDay, 'yyyy-MM-dd');
    const planForNextDay = futurePlans.find(p => p.id === nextDayId);
    
    if (planForNextDay && planForNextDay.itemIds && planForNextDay.itemIds.includes(item.id)) {
        return { available: false, reason: 'Reserviert für Folgetag', type: 'conflict' };
    }

    return result;
};

/**
 * 2. DATA FETCHING
 * Lädt alle Daten für die Monatsansicht (Sessions, Pläne).
 */
export const getCalendarMonthData = async (userId, monthStart) => {
    // Buffer: Start des Monats - 7 Tage, Ende + 7 Tage
    const start = addDays(startOfMonth(monthStart), -7);
    const end = addDays(endOfMonth(monthStart), 7);

    try {
        // A. Sessions laden
        const qSess = query(
            collection(db, `users/${userId}/sessions`),
            where('startTime', '>=', start),
            where('startTime', '<=', end),
            orderBy('startTime', 'asc')
        );
        const sessSnap = await getDocs(qSess);
        const sessions = sessSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // B. Pläne laden
        const qPlan = query(
            collection(db, `users/${userId}/${COLLECTION_PLANNING}`),
            where('date', '>=', start),
            where('date', '<=', end)
        );
        const planSnap = await getDocs(qPlan);
        const plans = planSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        return { sessions, plans };
    } catch (e) {
        console.error("Calendar Data Fetch Error:", e);
        return { sessions: [], plans: [] };
    }
};

/**
 * 3. KARMA CALCULATOR
 */
export const calculateDayStatus = (dayStr, sessions, plan) => {
    const daySessions = sessions.filter(s => {
        const d = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
        return format(d, 'yyyy-MM-dd') === dayStr;
    });

    const targetDate = new Date(dayStr);
    const today = new Date();
    today.setHours(0,0,0,0);

    // ZUKUNFT
    if (targetDate > today) {
        if (plan && plan.itemIds && plan.itemIds.length > 0) return 'planned';
        return 'empty';
    }

    // VERGANGENHEIT / HEUTE
    if (daySessions.length === 0) return 'neutral';

    const hasPunishment = daySessions.some(s => s.type === 'punishment');
    const hasFail = daySessions.some(s => s.status === 'compromised');

    if (hasPunishment || hasFail) return 'fail';

    const totalMinutes = daySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    const hasInstruction = daySessions.some(s => s.type === 'instruction');

    if (hasInstruction && !hasFail) return 'success';
    if (totalMinutes > 240) return 'gold';

    return 'neutral';
};

/**
 * 4. SAVE PLAN
 */
export const saveDayPlan = async (userId, dateObj, itemIds, note) => {
    const dateId = getDayId(dateObj);
    const docRef = doc(db, `users/${userId}/${COLLECTION_PLANNING}`, dateId);
    
    if (itemIds.length === 0 && !note) {
        await deleteDoc(docRef);
    } else {
        await setDoc(docRef, {
            date: dateObj, // Firestore speichert JS Date korrekt als Timestamp
            itemIds,
            note,
            updatedAt: serverTimestamp()
        }, { merge: true });
    }
};
