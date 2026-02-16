import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp, increment } from 'firebase/firestore';
import { startTZD } from './TZDService';

// --- KONFIGURATION ---
const GAMBLE_CHANCE = 0.03; // 3% Micro-Chance alle 5 Minuten
const WIN_CHANCE = 0.50;    // 50% eiskalter Münzwurf
const COOLDOWN_HOURS = 12;  // Hard Cooldown nach jedem Angebot
const FORCED_GAMBLE_THRESHOLD = 5; // Nach 5 Ablehnungen greift der Zwang

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
 * Prüft, ob ein Gamble ausgelöst werden soll (inkl. Cooldown & Zwang).
 */
export const checkGambleTrigger = async (userId, isTzdActive, isInstructionActive, activePunishmentItem) => {
    // 1. SCHUTZRAUM: Keine Gambles bei Pflichtaufgaben
    if (isTzdActive || isInstructionActive) return { trigger: false };

    // 2. AUSNAHME: Buttplug-Strafen erlauben Gambles
    if (activePunishmentItem) {
        const name = (activePunishmentItem.name || "").toLowerCase();
        const sub = (activePunishmentItem.subCategory || "").toLowerCase();
        const cat = (activePunishmentItem.mainCategory || "").toLowerCase();
        const isPlug = name.includes("plug") || sub.includes("plug") || cat.includes("anal") || name.includes("butt") || sub.includes("butt");
        
        if (!isPlug) {
            return { trigger: false }; // Normale Strafe blockiert weiterhin
        }
    }

    // 3. IMMUNITÄT PRÜFEN
    const immunityActive = await isImmunityActive(userId);
    if (immunityActive) return { trigger: false };

    // 4. STATS & COOLDOWN PRÜFEN
    const statsRef = doc(db, `users/${userId}/status/gambleStats`);
    const statsSnap = await getDoc(statsRef);
    let consecutiveDeclines = 0;
    
    if (statsSnap.exists()) {
        const data = statsSnap.data();
        consecutiveDeclines = data.consecutiveDeclines || 0;
        
        if (data.lastGambleOfferedAt) {
            const lastOffered = data.lastGambleOfferedAt.toDate();
            const now = new Date();
            const hoursSince = (now - lastOffered) / (1000 * 60 * 60);
            if (hoursSince < COOLDOWN_HOURS) {
                return { trigger: false };
            }
        }
    }

    // 5. WÜRFELN (Die 3% Micro-Chance)
    if (Math.random() < GAMBLE_CHANCE) {
        // Trigger erfolgreich! Cooldown sofort setzen (Exploit-Schutz)
        await setDoc(statsRef, {
            lastGambleOfferedAt: serverTimestamp()
        }, { merge: true });

        return { 
            trigger: true, 
            isForced: consecutiveDeclines >= FORCED_GAMBLE_THRESHOLD 
        };
    }

    return { trigger: false };
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
 * Registriert die Entscheidung des Nutzers persistent.
 */
export const recordGambleAction = async (userId, action) => {
    const statsRef = doc(db, `users/${userId}/status/gambleStats`);
    if (action === 'accept') {
        await setDoc(statsRef, { consecutiveDeclines: 0 }, { merge: true });
    } else if (action === 'decline') {
        await setDoc(statsRef, { consecutiveDeclines: increment(1) }, { merge: true });
    }
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
            penaltyDuration: null 
        };
    } else {
        // VERLUST
        const duration = 1440; // Exakt 24 Stunden
        await startTZD(userId, stakeItems, null, duration, 'spiel_tzd'); 
        return { 
            win: false, 
            type: 'tzd_lock',
            penaltyDuration: duration 
        };
    }
};