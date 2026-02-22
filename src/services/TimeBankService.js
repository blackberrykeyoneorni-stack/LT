import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, increment, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';

// KONFIGURATION DER SCHULDENFALLE
const DEBT_CONFIG = {
    MAX_DEBT_MINUTES: 2880, // 48 Stunden (Das harte Limit)
    OVERDRAFT_PENALTY: 1.5, // 50% Aufschlag bei Kreditaufnahme
    DAILY_INTEREST_RATE: 0.10, // 10% Zinsen pro Tag
    INFLATION_RATE: 0.05 // 5% Inflation pro Woche für positive Bestände
};

/**
 * Lädt das aktuelle Guthaben.
 */
export const getTimeBankBalance = async (userId) => {
    try {
        const docRef = doc(db, `users/${userId}/status/timeBank`);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            const initialData = { nc: 0, lc: 0, updatedAt: serverTimestamp() };
            await setDoc(docRef, initialData);
            return initialData;
        }
    } catch (e) {
        console.error("Error loading TimeBank:", e);
        return { nc: 0, lc: 0 };
    }
};

/**
 * Prüft, ob der User "insolvent" ist (Limit erreicht).
 * Gibt zurück: { isBlocked: boolean, currentDebt: number }
 */
export const checkInsolvency = async (userId, type) => {
    const balance = await getTimeBankBalance(userId);
    const currentVal = type === 'nylon' ? balance.nc : balance.lc;
    
    // Wir prüfen gegen das negative Limit
    // z.B. -3000 < -2880 -> True (Blocked)
    const limit = -DEBT_CONFIG.MAX_DEBT_MINUTES;
    
    return {
        isBlocked: currentVal <= limit,
        currentDebt: Math.abs(currentVal),
        remainingCredit: Math.max(0, currentVal - limit)
    };
};

/**
 * Zieht Credits ab (Spending) und registriert den Discount für den Balken.
 * HYBRID-LOGIK: Prüft die aktuelle Tagesanweisung und zieht ggf. beide Konten ab.
 */
export const spendCredits = async (userId, amountMinutes, requestedType) => {
    if (amountMinutes <= 0) return true;
    
    const docRef = doc(db, `users/${userId}/status/timeBank`);
    const balanceSnap = await getDoc(docRef);
    const data = balanceSnap.exists() ? balanceSnap.data() : { nc: 0, lc: 0 };

    // 1. Kontext-Prüfung: Welche Items werden heute getragen?
    const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
    const instrSnap = await getDoc(instrRef);
    
    let chargeNc = false;
    let chargeLc = false;

    if (instrSnap.exists() && instrSnap.data().items) {
        const items = instrSnap.data().items;
        items.forEach(i => {
            const cat = (i.mainCategory || '').toLowerCase();
            const sub = (i.subCategory || '').toLowerCase();
            const name = (i.name || '').toLowerCase();
            if (cat.includes('nylon') || sub.includes('strumpf') || name.includes('strumpf')) chargeNc = true;
            if (cat.includes('dessous') || sub.includes('höschen') || cat.includes('lingerie') || cat.includes('wäsche') || name.includes('höschen')) chargeLc = true;
        });
    }

    // Fallback, falls keine Items da sind (dann nutzen wir den Button-Typ aus der UI)
    if (!chargeNc && !chargeLc) {
        if (requestedType === 'nylon') chargeNc = true;
        else chargeLc = true;
    }

    let finalCost = amountMinutes;
    const updates = {};

    // Helper: Berechnet Aufschlag bei Dispo-Nutzung
    const calcCost = (balance) => {
        if (balance < 0 || (balance - amountMinutes) < 0) {
            return Math.round(amountMinutes * DEBT_CONFIG.OVERDRAFT_PENALTY);
        }
        return amountMinutes;
    };

    if (chargeNc) {
        const costNc = calcCost(data.nc);
        if ((data.nc - costNc) < -DEBT_CONFIG.MAX_DEBT_MINUTES) throw new Error("INSOLVENCY_LIMIT_REACHED");
        updates.nc = increment(-Math.abs(costNc));
    }
    if (chargeLc) {
        const costLc = calcCost(data.lc);
        if ((data.lc - costLc) < -DEBT_CONFIG.MAX_DEBT_MINUTES) throw new Error("INSOLVENCY_LIMIT_REACHED");
        updates.lc = increment(-Math.abs(costLc));
    }

    updates.lastTransaction = serverTimestamp();

    // 2. Atomares Update der TimeBank
    await updateDoc(docRef, updates);

    // 3. Discount an den Fortschrittsbalken melden (dailyInstruction)
    if (instrSnap.exists()) {
        await updateDoc(instrRef, {
            discountMinutes: increment(amountMinutes)
        });
    }
    
    return finalCost; 
};

/**
 * Berechnet Credits basierend auf Dauer und Typ.
 * STRAFEN (Punishment, TZD Evasion) geben 0 Credits.
 * NEU: Bezieht Stealth-Reisen mit ein (massive Reduzierung & Nullrunden) 
 * UND regelt die reguläre Overtime-Vergütung (migriert aus SessionService).
 */
export const calculateEarnedCredits = async (userId, session) => {
    if (!session || !session.startTime || !session.endTime) return 0;

    // 1. HARTE SPERRE: Prüfen auf Straf-Indikatoren
    if (
        session.type === 'punishment' ||       
        session.isPunitive === true ||         
        session.evasionPenaltyTriggered === true || 
        session.source === 'gamble_loss' ||
        session.tzdExecuted === true // NEU: TZD darf ebenfalls keine Credits generieren
    ) {
        console.log("TimeBank: PUNITIVE SESSION DETECTED. 0 Credits awarded.");
        return 0;
    }

    const start = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
    const end = session.endTime.toDate ? session.endTime.toDate() : new Date(session.endTime);
    const durationMinutes = (end - start) / 60000;

    if (durationMinutes < 10) return 0; // Zu kurz zählt nicht

    // --- STEALTH LOGIK ---
    const instrRef = doc(db, `users/${userId}/status/dailyInstruction`);
    const instrSnap = await getDoc(instrRef);
    const isStealth = instrSnap.exists() && instrSnap.data().stealthModeActive === true;

    if (isStealth) {
        const isNight = session.periodId && session.periodId.includes('night');
        
        if (isNight) {
            console.log("TimeBank: Stealth Night Session. 0 Credits.");
            return { isStealth: true, exactCredits: 0, rawMinutes: Math.floor(durationMinutes) };
        } else {
            const pSnap = await getDoc(doc(db, `users/${userId}/settings/preferences`));
            const targetHours = pSnap.exists() ? (pSnap.data().dailyTargetHours || 4) : 4;
            const targetMinutes = targetHours * 60;

            const overtime = durationMinutes - targetMinutes;
            if (overtime <= 0) {
                console.log("TimeBank: Stealth Day Session unter Target. 0 Credits.");
                return { isStealth: true, exactCredits: 0, rawMinutes: Math.floor(durationMinutes) };
            }
            
            // Alles über dem Target wird durch 10 geteilt (10% Tribut-Auszahlung)
            const stealthCredits = Math.floor(overtime / 10);
            console.log(`TimeBank: Stealth Day Session Overtime ${overtime}m. Tribut berechnet: ${stealthCredits} Credits.`);
            
            return { isStealth: true, exactCredits: stealthCredits, rawMinutes: Math.floor(durationMinutes) };
        }
    }

    // --- REGULÄRE LOGIK (Restauriert aus SessionService) ---
    let eligibleMinutes = 0;
    if (session.isDebtSession) {
        eligibleMinutes = durationMinutes; // Komplette Zeit zur Schuldentilgung
    } else if (session.type === 'voluntary') {
        eligibleMinutes = durationMinutes; // Komplette Zeit als Bonus
    } else if (session.type === 'instruction') {
        // Nur Overtime (Übererfüllung) bringt Credits!
        const target = Number(session.targetDurationMinutes) || 0;
        if (target > 0 && durationMinutes > target) {
            eligibleMinutes = durationMinutes - target;
        }
    }

    return Math.floor(eligibleMinutes);
};

/**
 * Fügt Credits hinzu (Earning / Tilgung).
 * Akzeptiert Integer oder das Stealth-Objekt aus calculateEarnedCredits.
 */
export const addCredits = async (userId, rawMinutesOrObject, type) => {
    const field = type === 'nylon' ? 'nc' : 'lc';
    const docRef = doc(db, `users/${userId}/status/timeBank`);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return;
    
    const currentBalance = docSnap.data()[field];
    let earnedCredits = 0;

    // Typ-Weiche für Stealth-Integration
    if (typeof rawMinutesOrObject === 'object' && rawMinutesOrObject !== null) {
        if (rawMinutesOrObject.exactCredits <= 0) return; // Nichts zu verbuchen
        earnedCredits = rawMinutesOrObject.exactCredits; 
        // WICHTIG: Keine weitere Division durch 3, da Stealth bereits versteuert hat.
    } else {
        const rawMinutes = rawMinutesOrObject;
        if (currentBalance < 0) {
            // TILGUNG: 1:1 (Jede Minute zählt, um aus dem Loch zu kommen)
            earnedCredits = rawMinutes;
        } else {
            // VERDIENST: 1:3 (Luxus ist teuer)
            if (rawMinutes < 3) return;
            earnedCredits = Math.floor(rawMinutes / 3);
        }
    }

    if (earnedCredits <= 0) return;

    await updateDoc(docRef, {
        [field]: increment(earnedCredits),
        lastTransaction: serverTimestamp()
    });

    console.log(`TimeBank: Added ${earnedCredits} ${type.toUpperCase()} credits.`);
    return earnedCredits;
};

/**
 * WIRD VOM FRONTEND AUDITOR AUFGERUFEN.
 * Berechnet rückwirkend Zinseszins auf negative Salden.
 */
export const applyDailyInterest = async (userId) => {
    const docRef = doc(db, `users/${userId}/status/timeBank`);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return;
    
    const data = docSnap.data();
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const lastInterest = data.lastInterestDate ? data.lastInterestDate.toDate() : new Date();
    lastInterest.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(now - lastInterest);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return; // Noch kein Tag vergangen

    const updates = {};
    let interestApplied = false;

    // RÜCKWIRKENDE ZINSESZINS BERECHNUNG (Compound)
    let newNc = data.nc;
    if (newNc < 0) {
        newNc = Math.floor(newNc * Math.pow(1 + DEBT_CONFIG.DAILY_INTEREST_RATE, diffDays));
        updates.nc = newNc;
        interestApplied = true;
    }

    let newLc = data.lc;
    if (newLc < 0) {
        newLc = Math.floor(newLc * Math.pow(1 + DEBT_CONFIG.DAILY_INTEREST_RATE, diffDays));
        updates.lc = newLc;
        interestApplied = true;
    }

    updates.lastInterestDate = serverTimestamp();
    await updateDoc(docRef, updates);

    if (interestApplied) console.log(`TimeBank: Applied ${diffDays} days of retroactive interest.`);
};

/**
 * Wöchentliche Inflation für positive Bestände (Rückwirkend).
 */
export const applyWeeklyInflation = async (userId) => {
    try {
        const docRef = doc(db, `users/${userId}/status/timeBank`);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) return;
        
        const data = docSnap.data();
        const now = new Date();
        const lastInflation = data.lastInflationAt ? data.lastInflationAt.toDate() : new Date();

        const diffTime = Math.abs(now - lastInflation);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
        const weeksPassed = Math.floor(diffDays / 7);

        if (weeksPassed < 1) return; 

        const updates = {};
        let inflationApplied = false;

        // Inflation rückwirkend auf POSITIVE Bestände (Compound Loss)
        let newNc = data.nc;
        if (newNc > 0) {
            newNc = Math.floor(newNc * Math.pow(1 - DEBT_CONFIG.INFLATION_RATE, weeksPassed));
            updates.nc = newNc;
            inflationApplied = true;
        }

        let newLc = data.lc;
        if (newLc > 0) {
            newLc = Math.floor(newLc * Math.pow(1 - DEBT_CONFIG.INFLATION_RATE, weeksPassed));
            updates.lc = newLc;
            inflationApplied = true;
        }

        updates.lastInflationAt = serverTimestamp();
        await updateDoc(docRef, updates);

        if (inflationApplied) console.log(`TimeBank: Applied ${weeksPassed} weeks of retroactive inflation.`);
    } catch (e) {
        console.error("Fehler bei der Credit-Inflation:", e);
    }
};

/**
 * MASTER-AUDITOR: Wird vom Dashboard beim Start aufgerufen.
 */
export const runTimeBankAuditor = async (userId) => {
    try {
        await applyDailyInterest(userId);
        await applyWeeklyInflation(userId);
    } catch (e) {
        console.error("Fehler im TimeBank Auditor:", e);
    }
};