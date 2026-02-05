import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { startTZD } from './TZDService';

// --- KONFIGURATION ---
const GAMBLE_CHANCE = 0.20; // 20% Trigger Wahrscheinlichkeit
const WIN_CHANCE = 0.40;    // 40% Chance auf Immunität (60% Verlust)

/**
 * Prüft, ob ein Gamble ausgelöst werden soll.
 * Gatekeeper: Nur wenn kein TZD, keine Instruction und keine Immunität aktiv ist.
 */
export const checkGambleTrigger = async (userId, isTzdActive, isInstructionActive) => {
    if (isTzdActive || isInstructionActive) return false;

    // 1. Prüfe Immunität
    const immunityActive = await isImmunityActive(userId);
    if (immunityActive) return false;

    // 2. Würfle Trigger (20%)
    return Math.random() < GAMBLE_CHANCE;
};

/**
 * Ermittelt den Einsatz: 1x Strumpfhose + 1x Höschen.
 * Fallback auf zufällige Items, wenn Kategorien fehlen.
 */
export const determineGambleStake = (items) => {
    if (!items || items.length === 0) return [];

    const activeItems = items.filter(i => i.status === 'active');
    
    // Suche Strumpfhose
    let tights = activeItems.filter(i => {
        const sub = (i.subCategory || '').toLowerCase();
        return sub.includes('strumpfhose') || sub.includes('tights') || (i.mainCategory === 'Nylons');
    });
    
    // Suche Höschen
    let panties = activeItems.filter(i => {
        const sub = (i.subCategory || '').toLowerCase();
        return sub.includes('slip') || sub.includes('höschen') || sub.includes('panties') || sub.includes('thong') || sub.includes('string');
    });

    // Fallbacks falls leer
    if (tights.length === 0) tights = activeItems;
    if (panties.length === 0) panties = activeItems;

    const selectedTights = tights[Math.floor(Math.random() * tights.length)];
    const selectedPanties = panties[Math.floor(Math.random() * panties.length)];

    // Sicherstellen, dass wir 2 verschiedene Items haben (falls möglich)
    const stake = [selectedTights];
    if (selectedPanties && selectedPanties.id !== selectedTights?.id) {
        stake.push(selectedPanties);
    } else if (activeItems.length > 1) {
        // Zwanghaft ein zweites Item suchen
        const others = activeItems.filter(i => i.id !== selectedTights?.id);
        if(others.length > 0) stake.push(others[Math.floor(Math.random() * others.length)]);
    }

    return stake;
};

/**
 * Führt den Münzwurf aus.
 * @returns {Object} { win: boolean, type: 'immunity' | 'tzd_lock' }
 */
export const rollTheDice = async (userId, stakeItems) => {
    const roll = Math.random();
    const win = roll < WIN_CHANCE;

    if (win) {
        // GEWINN: 24h Immunität setzen
        await setImmunity(userId, 24);
        return { win: true, type: 'immunity' };
    } else {
        // VERLUST: 24h TZD starten (fix 1440 Minuten)
        // Wir nutzen startTZD mit overrideDurationMinutes = 1440
        await startTZD(userId, stakeItems, null, 1440); 
        return { win: false, type: 'tzd_lock' };
    }
};

/**
 * Setzt den Immunitäts-Status für X Stunden.
 */
export const setImmunity = async (userId, hours) => {
    const until = new Date();
    until.setHours(until.getHours() + hours);
    
    await setDoc(doc(db, `users/${userId}/status/immunity`), {
        active: true,
        validUntil: Timestamp.fromDate(until),
        grantedAt: serverTimestamp(),
        reason: 'gamble_win' // oder 'tzd_cooldown'
    });
};

/**
 * Prüft, ob Immunität aktiv ist.
 */
export const isImmunityActive = async (userId) => {
    try {
        const snap = await getDoc(doc(db, `users/${userId}/status/immunity`));
        if (snap.exists()) {
            const data = snap.data();
            if (!data.active) return false;
            
            const now = new Date();
            const validUntil = data.validUntil.toDate();
            
            if (now < validUntil) return true;
            
            // Abgelaufen -> Clean up (optional, lazy cleanup)
            await updateDoc(doc(db, `users/${userId}/status/immunity`), { active: false });
            return false;
        }
        return false;
    } catch (e) {
        return false;
    }
};