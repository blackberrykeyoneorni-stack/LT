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
    if (isTzdActive) return { trigger: false };

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
 * Ermittelt den Einsatz (Exakt 3 Items, 1 Strumpfhose zwingend, 1 Mystery Item).
 */
export const determineGambleStake = (items) => {
    if (!items || items.length === 0) return [];

    const activeItems = items.filter(i => i.status === 'active');
    
    // 1. Zwingend: Exakt 1 Strumpfhose (Darf nie Mystery sein)
    const tights = activeItems.filter(i => (i.subCategory || '').toLowerCase().includes('strumpfhose'));
    if (tights.length === 0) return []; 

    const selectedTights = tights[Math.floor(Math.random() * tights.length)];

    // 2. Andere Items filtern (Keine weitere Strumpfhose, keine Plugs)
    const otherItems = activeItems.filter(i => {
        if (i.id === selectedTights.id) return false;
        
        const sub = (i.subCategory || '').toLowerCase();
        const main = (i.mainCategory || '').toLowerCase();
        const name = (i.name || '').toLowerCase();

        // Keine zweite Strumpfhose
        if (sub.includes('strumpfhose')) return false;

        // Absolute Sperre für Buttplugs/Anal-Toys im Gamble/TZD
        if (sub.includes('plug') || main.includes('anal') || name.includes('plug') || name.includes('butt') || sub.includes('butt')) return false;

        // Erlaubt sind Dessous, Lingerie, Nylons, Accessoires
        if (main.includes('dessous') || main.includes('lingerie') || main.includes('wäsche') ||
            main.includes('nylon') || main.includes('accessoire') || main.includes('zubehör')) {
            return true;
        }
        return false;
    });

    // 3. Zwei weitere Items mit UNTERSCHIEDLICHEN Subkategorien auswählen
    const selectedOthers = [];
    const usedSubCats = new Set();
    
    // Mischen für Zufälligkeit
    const shuffledOthers = otherItems.sort(() => 0.5 - Math.random());

    for (const item of shuffledOthers) {
        const sub = (item.subCategory || 'sonstiges').toLowerCase();
        if (!usedSubCats.has(sub)) {
            selectedOthers.push(item);
            usedSubCats.add(sub);
        }
        if (selectedOthers.length === 2) break; // Wir brauchen genau 2 weitere
    }

    const finalStake = [selectedTights, ...selectedOthers];

    // 4. Das letzte Item (Index 2) als "Mystery Item" maskieren, falls vorhanden
    if (finalStake.length === 3) {
        finalStake[2] = { ...finalStake[2], isMystery: true };
    } else if (finalStake.length === 2) {
        finalStake[1] = { ...finalStake[1], isMystery: true };
    }

    return finalStake;
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
 * Führt den Münzwurf aus und setzt exakt die Gamble-Items (inklusive Mystery) als Strafe ein.
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
        // VERLUST - Das Gamble *ist* das TZD. 
        const duration = 1440; // Exakt 24 Stunden
        
        // Mystery-Flag für die Speicherung in der Datenbank (TZD-Historie) entfernen
        const penaltyItems = stakeItems.map(item => {
            const cleanItem = { ...item };
            delete cleanItem.isMystery;
            return cleanItem;
        });
        
        await startTZD(userId, penaltyItems, null, duration, 'spiel_tzd'); 
        
        return { 
            win: false, 
            type: 'tzd_lock',
            penaltyDuration: duration 
        };
    }
};