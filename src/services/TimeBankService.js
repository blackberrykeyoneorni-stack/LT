// src/services/TimeBankService.js
import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, increment, serverTimestamp, collection, query, where, getDocs, deleteField } from 'firebase/firestore';
import { parseSafeNumber } from '../utils/formatters';

// KONFIGURATION DER SCHULDENFALLE
const DEBT_CONFIG = {
    MAX_DEBT_MINUTES: 2880, // 48 Stunden (Das harte Limit)
    MAX_CREDIT_MINUTES: 4320, // 72 Stunden (Das harte Guthaben-Limit)
    OVERDRAFT_PENALTY: 1.5, // 50% Aufschlag bei Kreditaufnahme
    DAILY_INTEREST_RATE: 0.10, // 10% Zinsen pro Tag
    INFLATION_RATE: 0.10 // 10% Inflation pro Woche für positive Bestände (Legacy-Referenz)
};

/**
 * Lädt das aktuelle Guthaben.
 */
export const getTimeBankBalance = async (userId) => {
    try {
        const docRef = doc(db, `users/${userId}/status/timeBank`);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                ...data,
                nc: parseSafeNumber(data.nc, 0),
                lc: parseSafeNumber(data.lc, 0)
            };
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
 * Zieht Credits ab (Spending).
 * KORREKTUR: Strikte Trennung. Nutzt nur noch den requestedType ('nylon', 'lingerie', 'both').
 * Kombinierte Währungspflicht bei 'both'. Entfernung der doppelten discountMinutes.
 * NEU: Just-In-Time Interest Tracking (Transaktionsgebundene Vorab-Verzinsung)
 */
export const spendCredits = async (userId, amountMinutes, requestedType) => {
    if (amountMinutes <= 0) return true;
    
    const docRef = doc(db, `users/${userId}/status/timeBank`);
    const balanceSnap = await getDoc(docRef);
    const data = balanceSnap.exists() ? balanceSnap.data() : { nc: 0, lc: 0 };

    // SCHRITT 1: Einfrieren & Vorab-Verzinsung der Vergangenheit
    const interestPayload = await _applyPendingInterest(userId, data);
    
    let currentNc = parseSafeNumber(interestPayload.nc !== undefined ? interestPayload.nc : data.nc, 0);
    let currentLc = parseSafeNumber(interestPayload.lc !== undefined ? interestPayload.lc : data.lc, 0);

    let chargeNc = requestedType === 'nylon' || requestedType === 'both';
    let chargeLc = requestedType === 'lingerie' || requestedType === 'both';

    let finalCost = amountMinutes;
    // Wir übernehmen das Payload der Zinsabrechnung als Basis für unser Update
    const updates = { ...interestPayload }; 

    // Helper: Berechnet Aufschlag bei Dispo-Nutzung exakt für den negativen Anteil
    const calcCost = (balance) => {
        if (balance < 0) {
            return Math.round(amountMinutes * DEBT_CONFIG.OVERDRAFT_PENALTY);
        } else if ((balance - amountMinutes) < 0) {
            const covered = balance;
            const remainder = amountMinutes - covered;
            return covered + Math.round(remainder * DEBT_CONFIG.OVERDRAFT_PENALTY);
        }
        return amountMinutes;
    };

    if (chargeNc) {
        const costNc = calcCost(currentNc);
        if ((currentNc - costNc) < -DEBT_CONFIG.MAX_DEBT_MINUTES) throw new Error("INSOLVENCY_LIMIT_REACHED");
        updates.nc = currentNc - Math.abs(costNc); // Hard Set statt increment wegen Zins-Sync
    }
    if (chargeLc) {
        const costLc = calcCost(currentLc);
        if ((currentLc - costLc) < -DEBT_CONFIG.MAX_DEBT_MINUTES) throw new Error("INSOLVENCY_LIMIT_REACHED");
        updates.lc = currentLc - Math.abs(costLc); // Hard Set statt increment wegen Zins-Sync
    }

    updates.lastTransaction = serverTimestamp();
    // Der Zins-Timer wird bei JEDER Transaktion auf JETZT genullt.
    updates.lastInterestDate = serverTimestamp(); 

    // Atomares Update der TimeBank
    await updateDoc(docRef, updates);
    
    return finalCost; 
};

/**
 * ZWANGSLIQUIDATION (Debt Conversion Protocol)
 * Bucht Strafen gnadenlos bis zur absoluten Insolvenzgrenze ab. 
 * Gibt zurück, was nicht mehr bezahlt werden konnte (Restschuld).
 */
export const liquidateAssets = async (userId, targetNcDeduction, targetLcDeduction) => {
    const docRef = doc(db, `users/${userId}/status/timeBank`);
    const docSnap = await getDoc(docRef);
    const data = docSnap.exists() ? docSnap.data() : { nc: 0, lc: 0 };

    const interestPayload = await _applyPendingInterest(userId, data);
    let currentNc = parseSafeNumber(interestPayload.nc !== undefined ? interestPayload.nc : data.nc, 0);
    let currentLc = parseSafeNumber(interestPayload.lc !== undefined ? interestPayload.lc : data.lc, 0);

    const floor = -DEBT_CONFIG.MAX_DEBT_MINUTES; // Die absolute Betonwand (-2880)

    let remainingDebtNc = targetNcDeduction;
    let remainingDebtLc = targetLcDeduction;
    let liquidatedNc = 0;
    let liquidatedLc = 0;

    // NC Liquidation
    if (targetNcDeduction > 0) {
        const available = currentNc - floor; 
        if (available > 0) {
            const drain = Math.min(available, remainingDebtNc);
            currentNc -= drain;
            liquidatedNc = drain;
            remainingDebtNc -= drain;
        }
    }

    // LC Liquidation
    if (targetLcDeduction > 0) {
        const available = currentLc - floor;
        if (available > 0) {
            const drain = Math.min(available, remainingDebtLc);
            currentLc -= drain;
            liquidatedLc = drain;
            remainingDebtLc -= drain;
        }
    }

    const updates = { ...interestPayload };
    updates.nc = currentNc;
    updates.lc = currentLc;
    updates.lastTransaction = serverTimestamp();
    updates.lastInterestDate = serverTimestamp();

    await updateDoc(docRef, updates);

    return {
        liquidatedNc,
        liquidatedLc,
        remainingDebtNc,
        remainingDebtLc,
        totalRemainingDebt: remainingDebtNc + remainingDebtLc
    };
};

/**
 * Berechnet Credits basierend auf Dauer und Typ.
 * STRAFEN (Punishment, TZD Evasion) geben 0 Credits.
 * NEU: Bezieht Stealth-Reisen mit ein (massive Reduzierung & Nullrunden) 
 * UND regelt die reguläre Overtime-Vergütung (migriert aus SessionService).
 */
export const calculateEarnedCredits = async (userId, session) => {
    if (!session || !session.startTime || !session.endTime) return { rawMinutes: 0, isStealth: false, exactCredits: 0 };

    // 1. HARTE SPERRE: Prüfen auf Straf-Indikatoren
    if (
        session.type === 'punishment' ||       
        session.type === 'tzd' ||
        session.isPunitive === true ||         
        session.evasionPenaltyTriggered === true || 
        session.source === 'gamble_loss' ||
        session.tzdExecuted === true // NEU: TZD darf ebenfalls keine Credits generieren
    ) {
        console.log("TimeBank: PUNITIVE/TZD SESSION DETECTED. 0 Credits awarded.");
        return { rawMinutes: 0, isStealth: false, exactCredits: 0 };
    }

    const start = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
    const end = session.endTime.toDate ? session.endTime.toDate() : new Date(session.endTime);
    const durationMinutes = (end - start) / 60000;

    if (durationMinutes < 10) return { rawMinutes: 0, isStealth: false, exactCredits: 0 }; // Zu kurz zählt nicht

    // --- KONZEPT 1: PRIORITÄT DES INKASSOS (SYSTEM-BYPASS) ---
    // Um Deadlocks während Operation Infiltration zu vermeiden, wird die Tragezeit 
    // in Zwangssitzungen zur Schuldentilgung ohne Stealth-Abzüge gewertet.
    if (session.isDebtSession) {
        return { rawMinutes: Math.floor(durationMinutes), isStealth: false, exactCredits: 0 };
    }

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
    if (session.type === 'voluntary') {
        eligibleMinutes = durationMinutes; // Komplette Zeit als Bonus
    } else if (session.type === 'instruction') {
        // Nur Overtime (Übererfüllung) bringt Credits!
        const target = Number(session.targetDurationMinutes) || 0;
        if (target > 0 && durationMinutes > target) {
            eligibleMinutes = durationMinutes - target;
            
            // THERMAL YIELD BONUS
            if (session.thermalYieldActive && session.thermalYieldMultiplier) {
                eligibleMinutes = eligibleMinutes * session.thermalYieldMultiplier;
                console.log(`TimeBank: Thermal Yield applied. Overtime multiplied by ${session.thermalYieldMultiplier}`);
            }
        }
    }

    return { rawMinutes: Math.floor(eligibleMinutes), isStealth: false, exactCredits: 0 };
};

/**
 * Fügt Credits hinzu (Earning / Tilgung).
 * Akzeptiert das standardisierte Payload aus calculateEarnedCredits.
 * NEU: Just-In-Time Interest Tracking (Transaktionsgebundene Vorab-Verzinsung) + Smart Booking
 */
export const addCredits = async (userId, payload, type) => {
    const field = type === 'nylon' ? 'nc' : 'lc';
    const docRef = doc(db, `users/${userId}/status/timeBank`);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return;
    
    const data = docSnap.data();

    // SCHRITT 1: Einfrieren & Vorab-Verzinsung der Vergangenheit
    const interestPayload = await _applyPendingInterest(userId, data);
    const currentBalance = parseSafeNumber(interestPayload[field] !== undefined ? interestPayload[field] : data[field], 0);

    let earnedCredits = 0;

    // Typ-Weiche für Payload Standardisierung (Fallback für Legacy-Calls)
    let p = payload;
    if (typeof payload === 'number') {
        p = { rawMinutes: payload, isStealth: false, exactCredits: 0 };
    } else if (!payload) {
        p = { rawMinutes: 0, isStealth: false, exactCredits: 0 };
    }

    if (p.rawMinutes <= 0 && p.exactCredits <= 0) return;

    if (currentBalance < 0) {
        // TILGUNG: 1:1 (Szenario A: Egal ob Stealth oder nicht, jede Minute zählt)
        earnedCredits = p.rawMinutes;
    } else {
        // VERDIENST
        if (p.isStealth) {
            // Szenario B: Vorversteuerte Stealth-Credits direkt nehmen
            earnedCredits = p.exactCredits;
        } else {
            // Szenario C: Reguläre 1:3 Luxus-Steuer
            if (p.rawMinutes >= 3) {
                earnedCredits = Math.floor(p.rawMinutes / 3);
            }
        }
    }

    if (earnedCredits <= 0) return;

    // Wir übernehmen das Payload der Zinsabrechnung als Basis für unser Update
    const updates = { ...interestPayload };
    // Hard Set statt increment wegen Zins-Sync. Und gnadenlose Begrenzung (Hard Cap)
    updates[field] = Math.min(currentBalance + earnedCredits, DEBT_CONFIG.MAX_CREDIT_MINUTES); 
    updates.lastTransaction = serverTimestamp();
    // Der Zins-Timer wird bei JEDER Transaktion auf JETZT genullt.
    updates.lastInterestDate = serverTimestamp(); 

    await updateDoc(docRef, updates);

    console.log(`TimeBank: Added ${earnedCredits} ${type.toUpperCase()} credits (after settling past interest). Cap enforced.`);
    return earnedCredits;
};

/**
 * INTERNER HELFER: Just-In-Time Zinsberechnung
 * Prüft den alten Kontostand und berechnet die Zinsen für die Zeit der Inaktivität.
 * Schreibt NICHT selbst in die Datenbank, sondern liefert das Payload für die laufende Transaktion.
 */
const _applyPendingInterest = async (userId, currentData) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const lastInterest = currentData.lastInterestDate ? currentData.lastInterestDate.toDate() : new Date();
    lastInterest.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(now - lastInterest);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    const payload = {};

    if (diffDays < 1) return payload; // Noch kein Tag vergangen, keine Alt-Zinsen fällig

    // RÜCKWIRKENDE ZINSESZINS BERECHNUNG (Compound) auf den ALTEN Kontostand
    let oldNc = parseSafeNumber(currentData.nc, 0);
    if (oldNc < 0) {
        const result = Math.floor(oldNc * Math.pow(1 + DEBT_CONFIG.DAILY_INTEREST_RATE, diffDays));
        if (isFinite(result)) {
            payload.nc = result;
            console.log(`TimeBank: Calculated ${diffDays} days of retroactive interest on old NC debt (${oldNc} -> ${payload.nc}).`);
        }
    }

    let oldLc = parseSafeNumber(currentData.lc, 0);
    if (oldLc < 0) {
        const result = Math.floor(oldLc * Math.pow(1 + DEBT_CONFIG.DAILY_INTEREST_RATE, diffDays));
        if (isFinite(result)) {
            payload.lc = result;
            console.log(`TimeBank: Calculated ${diffDays} days of retroactive interest on old LC debt (${oldLc} -> ${payload.lc}).`);
        }
    }

    return payload;
};

/**
 * INTERNER HELFER: Berechnet die progressive Inflationssteuer auf Guthaben.
 * Die Bank gewinnt immer.
 */
const _calculateProgressiveTax = (balance) => {
    const val = parseSafeNumber(balance, 0);
    if (val <= 0) return 0;
    
    let tax = 0;
    let remainder = val;
    
    if (remainder > 2000) {
        tax += (remainder - 2000) * 0.20; // 20% ab 2001
        remainder = 2000;
    }
    if (remainder > 1000) {
        tax += (remainder - 1000) * 0.15; // 15% von 1001 bis 2000
        remainder = 1000;
    }
    if (remainder > 0) {
        tax += remainder * 0.10; // 10% bis 1000
    }
    
    return Math.ceil(tax); 
};

/**
 * Wöchentliche Inflation für positive Bestände zum fixen Anker (Sonntag 23:00 Uhr).
 */
export const applyWeeklyInflation = async (userId) => {
    try {
        const docRef = doc(db, `users/${userId}/status/timeBank`);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) return;
        
        const data = docSnap.data();
        const now = new Date();
        
        // Berechne den letzten Sonntag um 23:00 Uhr als Ankerpunkt
        let lastSunday23 = new Date(now);
        lastSunday23.setDate(now.getDate() - now.getDay()); 
        lastSunday23.setHours(23, 0, 0, 0);

        // Wenn es heute Sonntag ist, wir aber noch VOR 23:00 Uhr sind, 
        // gilt der Sonntag der Vorwoche als letzter Anker.
        if (now.getTime() < lastSunday23.getTime()) {
            lastSunday23.setDate(lastSunday23.getDate() - 7);
        }

        let lastInflation = data.lastInflationAt ? data.lastInflationAt.toDate() : null;

        if (!lastInflation) {
            // Initialisierung beim ersten Aufruf auf den aktuellen Stichtag,
            // damit die 7-Tage Zählung sauber in der Zukunft beginnt.
            await updateDoc(docRef, { lastInflationAt: lastSunday23 });
            return;
        }

        const timeDiff = lastSunday23.getTime() - lastInflation.getTime();
        const weeksPassed = Math.floor(timeDiff / (1000 * 60 * 60 * 24 * 7));

        if (weeksPassed < 1) return; 

        const updates = {};
        let inflationApplied = false;
        let totalDeductedNc = 0;
        let totalDeductedLc = 0;

        // Inflation auf POSITIVE Bestände
        let newNc = parseSafeNumber(data.nc, 0);
        if (newNc > 0) {
            let originalNc = newNc;
            if (newNc > DEBT_CONFIG.MAX_CREDIT_MINUTES) newNc = DEBT_CONFIG.MAX_CREDIT_MINUTES; // Stilles Cap für Legacy-Daten
            
            for (let i = 0; i < weeksPassed; i++) {
                if (newNc > 0) newNc -= _calculateProgressiveTax(newNc);
            }
            
            totalDeductedNc = originalNc - newNc;
            updates.nc = newNc;
            if (totalDeductedNc > 0) inflationApplied = true;
        }

        let newLc = parseSafeNumber(data.lc, 0);
        if (newLc > 0) {
            let originalLc = newLc;
            if (newLc > DEBT_CONFIG.MAX_CREDIT_MINUTES) newLc = DEBT_CONFIG.MAX_CREDIT_MINUTES; // Stilles Cap für Legacy-Daten
            
            for (let i = 0; i < weeksPassed; i++) {
                if (newLc > 0) newLc -= _calculateProgressiveTax(newLc);
            }
            
            totalDeductedLc = originalLc - newLc;
            updates.lc = newLc;
            if (totalDeductedLc > 0) inflationApplied = true;
        }

        // Zeitstempel strikt auf den berechneten Anker setzen
        updates.lastInflationAt = lastSunday23;

        // Tribute Notice generieren, falls etwas abgezogen wurde
        if (inflationApplied) {
            updates.pendingInflationNotice = {
                deductedNc: totalDeductedNc,
                deductedLc: totalDeductedLc,
                weeks: weeksPassed,
                timestamp: new Date().toISOString()
            };
        }

        await updateDoc(docRef, updates);

        if (inflationApplied) console.log(`TimeBank: Applied ${weeksPassed} weeks of progressive inflation at anchor.`);
    } catch (e) {
        console.error("Fehler bei der Credit-Inflation:", e);
    }
};

/**
 * MASTER-AUDITOR: Wird vom Dashboard beim Start aufgerufen.
 */
export const runTimeBankAuditor = async (userId) => {
    try {
        // Der tägliche Auditor wurde restlos entfernt. Zinsen laufen nur noch "Just-In-Time" bei Transaktionen.
        await applyWeeklyInflation(userId);
    } catch (e) {
        console.error("Fehler im TimeBank Auditor:", e);
    }
};

/**
 * Löscht die Tribut-Notiz aus der Datenbank mittels deleteField().
 */
export const clearInflationNotice = async (userId) => {
    try {
        const docRef = doc(db, `users/${userId}/status/timeBank`);
        await updateDoc(docRef, {
            pendingInflationNotice: deleteField()
        });
        console.log("TimeBank: Inflation notice cleared by user.");
    } catch (e) {
        console.error("Fehler beim Löschen der Tribut-Notiz:", e);
        throw e;
    }
};

/**
 * Wendet den Thermal Bleed Bonus an (Injektion, Schuldenerlass, Amnestie)
 */
export const applyThermalBonus = async (userId, bonusDetails) => {
    try {
        const docRef = doc(db, `users/${userId}/status/timeBank`);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;

        const data = docSnap.data();
        
        // 1. Zinsen einfrieren, um Rechnungsfehler zu vermeiden
        const interestPayload = await _applyPendingInterest(userId, data);
        const updates = { ...interestPayload };
        
        let currentNc = parseSafeNumber(interestPayload.nc !== undefined ? interestPayload.nc : data.nc, 0);
        let currentLc = parseSafeNumber(interestPayload.lc !== undefined ? interestPayload.lc : data.lc, 0);

        // 2. Bonus anwenden
        if (bonusDetails.type === 'dividend') {
            const amount = bonusDetails.amount;
            updates.nc = Math.min(currentNc + amount, DEBT_CONFIG.MAX_CREDIT_MINUTES);
            updates.lc = Math.min(currentLc + amount, DEBT_CONFIG.MAX_CREDIT_MINUTES);
        } 
        else if (bonusDetails.type === 'debt_relief') {
            if (currentNc < 0) {
                // Multiplikator 0.85 = 15% Rabatt in Richtung 0
                updates.nc = Math.floor(currentNc * 0.85); 
            }
            if (currentLc < 0) {
                updates.lc = Math.floor(currentLc * 0.85);
            }
        }
        else if (bonusDetails.type === 'amnesty') {
            updates.tzdAmnestyUntil = new Date(Date.now() + 18 * 60 * 60 * 1000); 
        }

        // 3. Atomares Update inkl. Reset des Zins-Ankers
        updates.lastTransaction = serverTimestamp();
        updates.lastInterestDate = serverTimestamp();
        
        await updateDoc(docRef, updates);
        console.log(`TimeBank: Thermal Bonus applied: ${bonusDetails.type}`);
        return true;
    } catch (e) {
        console.error("Fehler beim Anwenden des Thermal Bonus:", e);
        return false;
    }
};