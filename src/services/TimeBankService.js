import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, increment, serverTimestamp } from 'firebase/firestore';

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
 * Zieht Credits ab (Spending).
 * Im "Debt Mode" wird hier der Strafaufschlag berechnet.
 */
export const spendCredits = async (userId, amountMinutes, type) => {
    if (amountMinutes <= 0) return true;
    
    const field = type === 'nylon' ? 'nc' : 'lc';
    const docRef = doc(db, `users/${userId}/status/timeBank`);
    const balanceSnap = await getDoc(docRef);
    const currentBalance = balanceSnap.exists() ? balanceSnap.data()[field] : 0;

    let finalCost = amountMinutes;

    // DEBT LOGIK: Wenn wir bereits im Minus sind ODER durch die Buchung ins Minus rutschen
    if (currentBalance < 0 || (currentBalance - amountMinutes) < 0) {
        // Wir berechnen den Aufschlag auf den TEIL, der Kredit ist.
        // Vereinfachung: Sobald man den Dispo nutzt, kostet ALLES 50% mehr.
        // Das ist die Strafe für schlechtes Haushalten.
        finalCost = Math.round(amountMinutes * DEBT_CONFIG.OVERDRAFT_PENALTY);
        console.log(`TimeBank: Debt Penalty applied. Base: ${amountMinutes}, Cost: ${finalCost}`);
    }
    
    // Check Limit vor Buchung (doppelte Sicherheit)
    if ((currentBalance - finalCost) < -DEBT_CONFIG.MAX_DEBT_MINUTES) {
        throw new Error("INSOLVENCY_LIMIT_REACHED");
    }

    // Atomares Update
    await updateDoc(docRef, {
        [field]: increment(-Math.abs(finalCost)),
        lastTransaction: serverTimestamp()
    });
    
    return finalCost; // Gibt die tatsächlichen Kosten zurück (für UI Anzeige)
};

/**
 * Berechnet Credits basierend auf Dauer und Typ.
 * STRAFEN (Punishment, TZD Evasion) geben 0 Credits.
 * DIES IST DIE NEUE SICHERHEITSFUNKTION.
 */
export const calculateEarnedCredits = (session) => {
    if (!session || !session.startTime || !session.endTime) return 0;

    // 1. HARTE SPERRE: Prüfen auf Straf-Indikatoren
    // Wenn es eine Bestrafung ist, ein Straf-TZD oder eine erzwungene Evasion -> 0 Credits.
    if (
        session.type === 'punishment' ||       // Expliziter Straf-Typ
        session.isPunitive === true ||         // Generelles Straf-Flag
        session.evasionPenaltyTriggered === true || // Flucht-Versuch Flag
        session.source === 'gamble_loss'       // Glücksspiel-Verlust
    ) {
        console.log("TimeBank: PUNITIVE SESSION DETECTED. 0 Credits awarded.");
        return 0;
    }

    // 2. Berechnung der Dauer in Minuten
    const start = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
    const end = session.endTime.toDate ? session.endTime.toDate() : new Date(session.endTime);
    const durationMinutes = (end - start) / 60000;

    if (durationMinutes < 10) return 0; // Zu kurz zählt nicht

    return Math.floor(durationMinutes);
};

/**
 * Fügt Credits hinzu (Earning / Tilgung).
 * Kurs: 3 Minuten "Overtime" = 1 Credit.
 * ABER: Im Debt-Mode (Minus) zählt jede Minute 1:1 zur Tilgung? 
 * NEIN: Wir bleiben beim harten 1:3 Kurs. Schuldenabbau ist harte Arbeit.
 * User muss 3 Min tragen um 1 Min Schuld zu tilgen? Das wäre extrem brutal.
 * * KORREKTUR: Um "56 Stunden am Stück" zu tragen, muss der Kurs 1:1 sein bei Tilgung.
 * Wenn der Kurs 1:3 wäre, müsstest du für 48h Schulden -> 144 Stunden tragen.
 * * Entscheidung: 
 * - Im Plus: Earning Ratio 1:3 (Luxus erarbeiten ist schwer).
 * - Im Minus (Tilgung): Ratio 1:1 (Schulden sind Nomimalwert).
 * Der "Strafaufschlag" passierte ja schon beim Leihen (x1.5).
 */
export const addCredits = async (userId, rawMinutes, type) => {
    const field = type === 'nylon' ? 'nc' : 'lc';
    const docRef = doc(db, `users/${userId}/status/timeBank`);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return;
    
    const currentBalance = docSnap.data()[field];
    let earnedCredits = 0;

    if (currentBalance < 0) {
        // TILGUNG: 1:1 (Jede Minute zählt, um aus dem Loch zu kommen)
        // Aber Achtung: Wenn wir die Nulllinie kreuzen, wechselt der Kurs.
        // Vereinfachung: Alles wird 1:1 gutgeschrieben, wenn Startsaldo negativ.
        earnedCredits = rawMinutes;
    } else {
        // VERDIENST: 1:3 (Luxus ist teuer)
        if (rawMinutes < 3) return;
        earnedCredits = Math.floor(rawMinutes / 3);
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
 * WIRD VOM SYSTEM EINMAL TÄGLICH AUFGERUFEN (z.B. beim ersten App-Öffnen am Tag)
 * Berechnet Zinsen auf negative Salden.
 */
export const applyDailyInterest = async (userId) => {
    const docRef = doc(db, `users/${userId}/status/timeBank`);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return;
    
    const data = docSnap.data();
    const updates = {};
    let interestApplied = false;

    // Datum prüfen, um doppelte Zinsen am selben Tag zu verhindern
    const lastInterestDate = data.lastInterestDate ? data.lastInterestDate.toDate().toDateString() : null;
    const today = new Date().toDateString();

    if (lastInterestDate === today) return; // Schon gelaufen heute

    // Nylon Zinsen
    if (data.nc < 0) {
        const interest = Math.round(data.nc * DEBT_CONFIG.DAILY_INTEREST_RATE); // Zins ist negativ (erhöht Schuld)
        // Bsp: -100 * 0.1 = -10. Neu: -110.
        updates.nc = increment(interest); // interest ist negativ, also addieren wir negativen Wert
        interestApplied = true;
    }

    // Lingerie Zinsen
    if (data.lc < 0) {
        const interest = Math.round(data.lc * DEBT_CONFIG.DAILY_INTEREST_RATE);
        updates.lc = increment(interest);
        interestApplied = true;
    }

    if (interestApplied || lastInterestDate !== today) {
        updates.lastInterestDate = serverTimestamp();
        await updateDoc(docRef, updates);
        if (interestApplied) console.log("TimeBank: Daily Interest applied.");
    }
};

/**
 * Wöchentliche Inflation für positive Bestände (Sonntags 23:00).
 * Reduziert Guthaben um 5%, um Horten zu verhindern.
 */
export const applyWeeklyInflation = async (userId) => {
    try {
        const docRef = doc(db, `users/${userId}/status/timeBank`);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) return;
        
        const data = docSnap.data();
        const updates = {};
        let inflationApplied = false;

        // Inflation nur auf POSITIVE Bestände anwenden (nc = Nylon, lc = Lingerie/Dessous)
        if (data.nc > 0) {
            const loss = Math.ceil(data.nc * DEBT_CONFIG.INFLATION_RATE);
            updates.nc = increment(-loss);
            inflationApplied = true;
        }

        if (data.lc > 0) {
            const loss = Math.ceil(data.lc * DEBT_CONFIG.INFLATION_RATE);
            updates.lc = increment(-loss);
            inflationApplied = true;
        }

        if (inflationApplied) {
            updates.lastInflationAt = serverTimestamp();
            await updateDoc(docRef, updates);
            console.log("TimeBank: Weekly 5% Inflation applied to positive balances.");
        }
    } catch (e) {
        console.error("Fehler bei der Credit-Inflation:", e);
    }
};