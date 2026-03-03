import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp, increment, writeBatch, query, collection, where, getDocs } from 'firebase/firestore';
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
    // GEÄNDERT: isInstructionActive entfernt, damit hybride Eskalation bei laufenden Sessions greifen kann
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
 * NEU: Autoritäre TZD-Eskalation. Sammelt aktuell getragene Items und füllt 
 * auf exakt 3 Items auf (strikt begrenzt auf Nylons und Dessous mit Gewichtung).
 */
const buildAuthoritarianTZDItems = async (userId) => {
    const TARGET_ITEM_COUNT = 3; 
    
    // 1. Hole aktive Sessions
    const sessionsSnap = await getDocs(query(collection(db, `users/${userId}/sessions`), where('endTime', '==', null)));
    const activeSessions = [];
    const inheritedItemIds = new Set();
    
    sessionsSnap.forEach(docSnap => {
        const data = docSnap.data();
        activeSessions.push({ id: docSnap.id, ...data });
        if (data.itemId) inheritedItemIds.add(data.itemId);
        if (data.itemIds && Array.isArray(data.itemIds)) {
            data.itemIds.forEach(id => inheritedItemIds.add(id));
        }
    });

    // 2. Hole alle Items
    const itemsSnap = await getDocs(collection(db, `users/${userId}/items`));
    const allItems = [];
    itemsSnap.forEach(docSnap => allItems.push({ id: docSnap.id, ...docSnap.data() }));

    // 3. Hole Preferences für Gewichte
    let userWeights = {};
    const prefSnap = await getDoc(doc(db, `users/${userId}/settings/preferences`));
    if (prefSnap.exists() && prefSnap.data().categoryWeights) {
        userWeights = prefSnap.data().categoryWeights;
    }

    // 4. Vererbung (Lock-In der aktuell getragenen Items)
    const lockedItems = allItems.filter(i => inheritedItemIds.has(i.id));
    const itemsNeeded = Math.max(0, TARGET_ITEM_COUNT - lockedItems.length);

    const finalItems = [...lockedItems];

    // 5. Fehlende Items auffüllen (Autoritärer Filter: nur Nylons & Dessous)
    if (itemsNeeded > 0) {
        let availableItems = allItems.filter(i => {
            if (i.status !== 'active') return false;
            if (inheritedItemIds.has(i.id)) return false; // Bereits vererbt
            
            const cat = (i.mainCategory || '').toLowerCase();
            if (cat.includes('nylon') || cat.includes('lingerie') || cat.includes('dessous')) {
                return true;
            }
            return false;
        });

        const groups = {};
        availableItems.forEach(item => {
            const key = item.subCategory || item.mainCategory || 'Sonstiges';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        let availableGroupKeys = Object.keys(groups);

        for (let k = 0; k < itemsNeeded; k++) {
            if (availableGroupKeys.length === 0) break;

            let totalWeight = 0;
            const weightedGroups = availableGroupKeys.map(key => {
                const count = groups[key].length;
                const rootScore = Math.sqrt(count);
                const manualWeight = parseInt(userWeights[key] || 1);
                const finalScore = rootScore * manualWeight;
                totalWeight += finalScore;
                return { key, score: finalScore };
            });

            let randomValue = Math.random() * totalWeight;
            let chosenCategoryKey = null;

            for (const group of weightedGroups) {
                randomValue -= group.score;
                if (randomValue <= 0) {
                    chosenCategoryKey = group.key;
                    break;
                }
            }
            if (!chosenCategoryKey && weightedGroups.length > 0) {
                chosenCategoryKey = weightedGroups[weightedGroups.length - 1].key;
            }

            const itemsInGroup = groups[chosenCategoryKey];
            const randomItemIndex = Math.floor(Math.random() * itemsInGroup.length);
            const selected = itemsInGroup[randomItemIndex];
            
            finalItems.push(selected);

            // Update Arrays um Dopplungen der gleichen Subkategorie zu vermeiden
            availableGroupKeys = availableGroupKeys.filter(key => key !== chosenCategoryKey);
        }
    }

    // 6. Laufende Sessions hart beenden (Vom TZD überschrieben)
    if (activeSessions.length > 0) {
        const batch = writeBatch(db);
        activeSessions.forEach(session => {
            const sessionRef = doc(db, `users/${userId}/sessions`, session.id);
            batch.update(sessionRef, {
                endTime: serverTimestamp(),
                tzdExecuted: true,
                finalNote: 'Hart beendet: Vom Spiel-TZD überschrieben (Autoritäre Eskalation).'
            });
        });
        await batch.commit();
    }

    return {
        finalItems,
        inheritedItemIds: Array.from(inheritedItemIds),
        isColdStart: lockedItems.length === 0,
        addedItemsCount: finalItems.length - lockedItems.length
    };
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
        // VERLUST - Autoritäre TZD-Eskalation
        const escalationResult = await buildAuthoritarianTZDItems(userId);
        
        const duration = 1440; // Exakt 24 Stunden
        
        // Nutze finalItems anstatt der Wetteinsätze. Fallback falls das Inventar komplett leer ist.
        const penaltyItems = escalationResult.finalItems.length > 0 ? escalationResult.finalItems : stakeItems;
        
        await startTZD(userId, penaltyItems, null, duration, 'spiel_tzd', escalationResult); 
        return { 
            win: false, 
            type: 'tzd_lock',
            penaltyDuration: duration 
        };
    }
};