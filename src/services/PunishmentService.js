import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { PUNISHMENT_CONFIG } from '../utils/constants';

// Prüft, ob wir uns im erlaubten nächtlichen Zeitfenster für den Vollzug befinden
export const isPunishmentWindowOpen = () => {
    const d = new Date();
    const h = d.getHours();
    // Nutzt zentral konfigurierte Zeiten
    return (h >= PUNISHMENT_CONFIG.START_HOUR || h <= PUNISHMENT_CONFIG.END_HOUR);
};

// Lädt den aktuellen Straf-Status
export const getActivePunishment = async (userId) => {
    const statusRef = doc(db, `users/${userId}/status/punishment`);
    const statusSnap = await getDoc(statusRef);
    
    if (!statusSnap.exists()) {
        return null; // Keine Daten -> Keine Strafe
    }

    let data = statusSnap.data();

    // Automatische Aktivierung von aufgeschobenen Strafen im Zeitfenster
    if (data.deferred && isPunishmentWindowOpen()) {
        try {
            await updateDoc(statusRef, {
                active: true,
                deferred: false,
                activatedAt: serverTimestamp()
            });
            data.active = true;
            data.deferred = false;
        } catch (e) {
            console.error("Fehler beim Aktivieren der aufgeschobenen Strafe:", e);
        }
    }

    if (!data.active) {
        return null;
    }

    return data;
};

// Alias für Abwärtskompatibilität
export const getPunishmentStatus = getActivePunishment;

/**
 * Registriert eine Strafe mit definierter Dauer.
 * NEU: Schiebt Strafen während einer Stealth-Reise in eine Warteschlange, anstatt sie sofort aktiv zu schalten.
 */
export const registerPunishment = async (userId, reason, durationMinutes = 30, bypassStealth = false) => {
    const statusRef = doc(db, `users/${userId}/status/punishment`);
    
    // Limits anwenden (aus Config)
    const finalDuration = Math.min(
        Math.max(durationMinutes, PUNISHMENT_CONFIG.MIN_DURATION), 
        PUNISHMENT_CONFIG.MAX_DURATION
    );

    // --- NEU: STEALTH WARTESCHLANGEN LOGIK ---
    if (!bypassStealth) {
        const suspQ = query(collection(db, `users/${userId}/suspensions`), where('status', '==', 'active'), where('type', '==', 'stealth_travel'));
        const suspSnap = await getDocs(suspQ);
        
        if (!suspSnap.empty) {
            // Stealth Mode aktiv! Strafe wandert ins Schuldenbuch (Queue).
            const queueRef = doc(db, `users/${userId}/status/punishmentQueue`);
            const qSnap = await getDoc(queueRef);
            const queue = qSnap.exists() ? (qSnap.data().items || []) : [];
            
            queue.push({
                id: Date.now().toString(),
                reason: reason,
                originalMinutes: finalDuration,
                currentMinutes: finalDuration,
                createdAt: new Date().toISOString()
            });
            
            await setDoc(queueRef, { items: queue, lastAudited: serverTimestamp() }, { merge: true });
            console.log("Stealth Mode: Strafe wurde in die Queue verschoben.");
            return false; // Strafe ist (noch) nicht aktiv
        }
    }
    
    const active = isPunishmentWindowOpen();
    
    await setDoc(statusRef, {
        active: active, // Sofort aktiv, wenn Nachtfenster offen
        deferred: !active, // Aufgeschoben, wenn Tag
        reason: reason,
        durationMinutes: finalDuration,
        registeredAt: serverTimestamp(),
    }, { merge: true });
    
    return active;
};

/**
 * NEU: Zinsberechnung für die Straf-Warteschlange.
 * Berechnet einmal täglich 3% einfachen Zins vom Original-Strafwert.
 */
export const auditPunishmentQueue = async (userId) => {
    try {
        const queueRef = doc(db, `users/${userId}/status/punishmentQueue`);
        const qSnap = await getDoc(queueRef);
        if (!qSnap.exists()) return;
        
        const data = qSnap.data();
        const items = data.items || [];
        if (items.length === 0) return;

        const now = new Date();
        now.setHours(0,0,0,0);
        
        const lastAudited = data.lastAudited ? data.lastAudited.toDate() : new Date();
        lastAudited.setHours(0,0,0,0);
        
        const diffDays = Math.floor((now - lastAudited) / (1000 * 60 * 60 * 24));
        if (diffDays < 1) return;

        // Einfacher Zins: 3% vom Ursprungswert pro vergangenen Tag
        const updatedItems = items.map(item => {
            const addedInterest = item.originalMinutes * 0.03 * diffDays;
            return {
                ...item,
                currentMinutes: Math.round(item.currentMinutes + addedInterest)
            };
        });

        await updateDoc(queueRef, { items: updatedItems, lastAudited: serverTimestamp() });
        console.log(`Punishment Queue: ${diffDays} Tag(e) Zinsen (3%) auf ${items.length} Altlast(en) angewendet.`);
    } catch (e) {
        console.error("Fehler beim Auditing der Punishment Queue:", e);
    }
};

/**
 * NEU: Schiebt die älteste Strafe aus der Queue in die scharfe Bestrafung.
 */
export const activateQueuedPunishment = async (userId, queueItemId) => {
    const queueRef = doc(db, `users/${userId}/status/punishmentQueue`);
    const qSnap = await getDoc(queueRef);
    if (!qSnap.exists()) return;
    
    const items = qSnap.data().items || [];
    const itemToActivate = items.find(i => i.id === queueItemId);
    if (!itemToActivate) return;

    // Item aus der Queue entfernen
    const newItems = items.filter(i => i.id !== queueItemId);
    await updateDoc(queueRef, { items: newItems });

    // Strafe scharf schalten (bypassStealth = true)
    await registerPunishment(userId, `Altlast (Stealth): ${itemToActivate.reason}`, itemToActivate.currentMinutes, true);
};

// Sucht das spezifische Straf-Item in der Item-Liste
export const findPunishmentItem = (allItems) => {
    if (!allItems || !Array.isArray(allItems)) return null;
    return allItems.find(item => 
        item.mainCategory === PUNISHMENT_CONFIG.ITEM_CATEGORY && 
        item.subCategory === PUNISHMENT_CONFIG.ITEM_SUBCATEGORY &&
        item.status === 'active'
    );
};

// Schließt die Straf-Session ab
export const clearPunishment = async (userId) => {
    const statusRef = doc(db, `users/${userId}/status/punishment`);
    await updateDoc(statusRef, {
        active: false,
        deferred: false,
        reason: null,
        durationMinutes: 0,
        clearedAt: serverTimestamp(),
    });
};

// Prüft auf Bailout und berechnet die Strafdauer dynamisch
export const checkAndRegisterBailout = async (userId, session) => {
    if (!session || !session.startTime || !session.endTime) return false;

    // 1. Wahrscheinlichkeits-Check
    if (Math.random() > PUNISHMENT_CONFIG.BAILOUT_PROBABILITY) {
        return false; 
    }
    
    // 2. Tagesziel laden
    const pSnap = await getDoc(doc(db, `users/${userId}/settings/preferences`));
    const dailyTargetHours = pSnap.exists() ? (pSnap.data().dailyTargetHours || 3) : 3;
    const targetMinutes = dailyTargetHours * 60;
    
    // Session muss vom Typ 'instruction' sein
    if (session.type !== 'instruction') return false;

    const start = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
    const end = session.endTime.toDate ? session.endTime.toDate() : new Date(session.endTime);
    const durationMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
    
    // 3. Prüfen auf Unterfüllung (< 80% des Ziels)
    const threshold = targetMinutes * 0.8; 

    if (durationMinutes < threshold) {
        // BERECHNUNG DER STRAFDAUER
        const missingMinutes = targetMinutes - durationMinutes;
        const penaltyDuration = Math.ceil(missingMinutes * PUNISHMENT_CONFIG.BAILOUT_PENALTY_FACTOR);

        const reason = `Bailout (${durationMinutes}m von ${targetMinutes}m). Fehlzeit: ${missingMinutes}m.`;
        
        // 4. Strafe registrieren
        await registerPunishment(userId, reason, penaltyDuration);
        return true; 
    }

    return false; 
};

// Hilfsfunktion für den Oath-Decline im Dashboard
export const registerOathRefusal = async (userId) => {
    await registerPunishment(userId, "Blind Oath verweigert.", PUNISHMENT_CONFIG.OATH_REFUSAL_PENALTY);
};