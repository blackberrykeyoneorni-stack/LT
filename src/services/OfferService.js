import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { startTZD } from './TZDService';

// --- KONFIGURATION ---
const GAMBLE_CHANCE = 0.20; // 20% Trigger Wahrscheinlichkeit
const WIN_CHANCE = 0.40;    // 40% Chance auf Immunität (60% Verlust)

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
        reason: 'gamble_win' 
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
            
            // Abgelaufen -> Clean up
            await updateDoc(doc(db, `users/${userId}/status/immunity`), { active: false });
            return false;
        }
        return false;
    } catch (e) {
        return false;
    }
};

/**
 * Prüft, ob ein Gamble ausgelöst werden soll.
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
 * Ermittelt den Einsatz.
 */
export const determineGambleStake = (items) => {
    if (!items || items.length === 0) return [];

    const activeItems = items.filter(i => i.status === 'active');
    
    const tights = activeItems.filter(i => {
        const sub = (i.subCategory || '').toLowerCase();
        return sub.includes('strumpfhose');
    });
    
    const panties = activeItems.filter(i => {
        const sub = (i.subCategory || '').toLowerCase();
        return sub.includes('höschen');
    });

    if (tights.length === 0) return [];

    const selectedTights = tights[Math.floor(Math.random() * tights.length)];
    
    const selectedPanties = panties.length > 0 
        ? panties[Math.floor(Math.random() * panties.length)] 
        : null;

    const stake = [selectedTights];
    
    if (selectedPanties && selectedPanties.id !== selectedTights.id) {
        stake.push(selectedPanties);
    }

    return stake;
};

/**
 * Führt den Münzwurf aus.
 * FIX: Gibt immer penaltyDuration (number oder null) zurück.
 */
export const rollTheDice = async (userId, stakeItems) => {
    const roll = Math.random();
    const win = roll < WIN_CHANCE;

    if (win) {
        // GEWINN
        await setImmunity(userId, 24);
        return { 
            win: true, 
            type: 'immunity',
            penaltyDuration: null // <--- DAS HAT GEFEHLT
        };
    } else {
        // VERLUST
        const duration = 1440;
        await startTZD(userId, stakeItems, null, duration); 
        return { 
            win: false, 
            type: 'tzd_lock',
            penaltyDuration: duration 
        };
    }
};