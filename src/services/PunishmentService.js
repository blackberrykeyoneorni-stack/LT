import { db } from '../firebase';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, collection, query, where, getDocs, writeBatch, increment, addDoc, orderBy } from 'firebase/firestore';
import { PUNISHMENT_CONFIG } from '../utils/constants';

// --- BASIS LOGIK & ZUSTAND ---

// Prüft, ob wir uns im erlaubten nächtlichen Zeitfenster für den Vollzug befinden
export const isPunishmentWindowOpen = () => {
    const d = new Date();
    const h = d.getHours();
    return (h >= PUNISHMENT_CONFIG.START_HOUR || h <= PUNISHMENT_CONFIG.END_HOUR);
};

// Lädt den aktuell laufenden (scharfen) Straf-Status
export const getActivePunishment = async (userId) => {
    const statusRef = doc(db, `users/${userId}/status/punishment`);
    const statusSnap = await getDoc(statusRef);
    
    if (!statusSnap.exists()) {
        return null;
    }

    let data = statusSnap.data();

    if (!data.active) {
        return null;
    }

    return data;
};

// Alias für Abwärtskompatibilität
export const getPunishmentStatus = getActivePunishment;

// Lädt alle noch nicht vollstreckten Straf-Tickets aus dem Ledger
export const getPendingPunishments = async (userId) => {
    const q = query(
        collection(db, `users/${userId}/punishmentLedger`), 
        where('status', '==', 'pending'),
        orderBy('createdAt', 'asc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};


// --- DAS AKKUMULATIONS-LEDGER (Das neue Herzstück) ---

/**
 * Ersetzt das alte System. Erstellt ein neues Straf-Ticket im Ledger.
 * Die übergebene durationMinutes wird ignoriert, stattdessen wird die 
 * Basiszeit (30-90) vom System blind generiert.
 */
export const registerPunishment = async (userId, reason, _deprecatedDuration = 30, bypassStealth = false) => {
    try {
        // Zufällige Basiszeit (30 bis 90 Minuten)
        const min = PUNISHMENT_CONFIG.MIN_BASE_MINUTES || 30;
        const max = PUNISHMENT_CONFIG.MAX_BASE_MINUTES || 90;
        const baseMinutes = Math.floor(Math.random() * (max - min + 1)) + min;

        // Stealth-Mode Prüfung
        let isStealth = false;
        if (!bypassStealth) {
            const suspQ = query(collection(db, `users/${userId}/suspensions`), where('status', '==', 'active'), where('type', '==', 'stealth_travel'));
            const suspSnap = await getDocs(suspQ);
            if (!suspSnap.empty) {
                isStealth = true;
                console.log("Stealth Mode: Straf-Ticket wird akkumuliert und verzinst.");
            }
        }

        const ticketData = {
            reason: reason,
            baseMinutes: baseMinutes,
            currentMinutes: baseMinutes, // Wächst durch Zinsen im Stealth-Mode
            status: 'pending',
            isStealthAkkumulation: isStealth,
            createdAt: serverTimestamp(),
            lastAudited: serverTimestamp()
        };

        const ledgerRef = collection(db, `users/${userId}/punishmentLedger`);
        await addDoc(ledgerRef, ticketData);
        
        return true;
    } catch (e) {
        console.error("Fehler beim Ausstellen des Straf-Tickets:", e);
        return false;
    }
};

/**
 * Zinsberechnung für das Ledger (Stealth-Mode).
 * Berechnet einmal täglich 3% Zins auf den akkumulierten Wert.
 */
export const auditPunishmentQueue = async (userId) => {
    try {
        const q = query(
            collection(db, `users/${userId}/punishmentLedger`), 
            where('status', '==', 'pending'),
            where('isStealthAkkumulation', '==', true)
        );
        const snap = await getDocs(q);
        
        if (snap.empty) return;

        const now = new Date();
        now.setHours(0,0,0,0);
        
        const batch = writeBatch(db);
        let interestApplied = 0;

        snap.forEach(ticketDoc => {
            const data = ticketDoc.data();
            const lastAudited = data.lastAudited ? data.lastAudited.toDate() : new Date();
            lastAudited.setHours(0,0,0,0);
            
            const diffDays = Math.floor((now - lastAudited) / (1000 * 60 * 60 * 24));
            
            if (diffDays >= 1) {
                // 3% Zins pro Tag
                const addedInterest = data.currentMinutes * 0.03 * diffDays;
                const newMinutes = Math.round(data.currentMinutes + addedInterest);
                
                batch.update(ticketDoc.ref, { 
                    currentMinutes: newMinutes, 
                    lastAudited: serverTimestamp() 
                });
                interestApplied++;
            }
        });

        if (interestApplied > 0) {
            await batch.commit();
            console.log(`Punishment Ledger: Zinsen auf ${interestApplied} Stealth-Ticket(s) angewendet.`);
        }
    } catch (e) {
        console.error("Fehler beim Auditing des Ledgers:", e);
    }
};

// Veraltete Funktion, wird leer mitgeführt, damit alte Importe nicht crashen
export const activateQueuedPunishment = async (userId, queueItemId) => {
    return;
};


// --- DER VOLLZUG (Tribunal) ---

/**
 * Wird nach dem NFC Scan aufgerufen. 
 * Berechnet die finale Zeit, schaltet das globale Dashboard auf "Strafe aktiv" 
 * und startet die unsichtbare Session.
 */
export const executePunishmentTicket = async (userId, ticketId, instrumentType, instrumentItemId) => {
    try {
        const ticketRef = doc(db, `users/${userId}/punishmentLedger`, ticketId);
        const ticketSnap = await getDoc(ticketRef);
        
        if (!ticketSnap.exists()) throw new Error("Ticket nicht gefunden.");
        
        const data = ticketSnap.data();
        if (data.status !== 'pending') throw new Error("Ticket bereits vollstreckt.");

        // Instrumenten-Faktor anwenden
        const multiplier = instrumentType === 'dildo' ? PUNISHMENT_CONFIG.DILDO_MULTIPLIER : PUNISHMENT_CONFIG.PLUG_MULTIPLIER;
        const finalDurationMinutes = Math.ceil(data.currentMinutes * multiplier);

        const batch = writeBatch(db);

        // 1. Ticket schließen
        batch.update(ticketRef, {
            status: 'executed',
            executedAt: serverTimestamp(),
            instrumentUsed: instrumentType,
            finalDurationMinutes: finalDurationMinutes
        });

        // 2. Globalen Straf-Status aktivieren (für ActionButtons Dashboard)
        const statusRef = doc(db, `users/${userId}/status/punishment`);
        batch.set(statusRef, {
            active: true,
            deferred: false,
            reason: data.reason,
            durationMinutes: finalDurationMinutes,
            registeredAt: serverTimestamp()
        }, { merge: true });

        // 3. Straf-Session anlegen (läuft parallel zur Instruction)
        const sessionRef = doc(collection(db, `users/${userId}/sessions`));
        batch.set(sessionRef, {
            itemId: instrumentItemId,
            itemIds: [instrumentItemId],
            type: 'punishment',
            startTime: serverTimestamp(),
            endTime: null,
            durationMinutes: 0,
            minDuration: finalDurationMinutes, // Die versteckte Zeit
            ticketReason: data.reason
        });

        await batch.commit();
        return { success: true, duration: finalDurationMinutes };
    } catch (e) {
        console.error("Fehler beim Vollzug des Tickets:", e);
        return { success: false, error: e.message };
    }
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

// Schließt die Straf-Session global ab
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

/**
 * Verlängert eine laufende Strafe atomar.
 * Genutzt für die Ungedulds-Steuer und Gatekeeper-Tippfehler.
 */
export const addPenaltyToActivePunishment = async (userId, sessionId, extraMinutes) => {
    if (!userId || !sessionId || !extraMinutes) return;
    try {
        const batch = writeBatch(db);
        
        // Session verlängern
        const sessionRef = doc(db, `users/${userId}/sessions`, sessionId);
        batch.update(sessionRef, { minDuration: increment(extraMinutes) });

        // Globalen Straf-Status synchron halten
        const statusRef = doc(db, `users/${userId}/status/punishment`);
        batch.update(statusRef, { durationMinutes: increment(extraMinutes) });

        await batch.commit();
        console.log(`Zusatzstrafe von ${extraMinutes} Minuten erfolgreich appliziert.`);
    } catch (e) {
        console.error("Fehler beim Hinzufügen der Zusatzstrafe:", e);
    }
};


// --- TRIGGER LOGIK ---

// Prüft auf Bailout (Unterfüllung)
export const checkAndRegisterBailout = async (userId, session) => {
    if (!session || !session.startTime || !session.endTime) return false;
    
    // Tagesziel laden
    const pSnap = await getDoc(doc(db, `users/${userId}/settings/preferences`));
    const dailyTargetHours = pSnap.exists() ? (pSnap.data().dailyTargetHours || 3) : 3;
    const targetMinutes = dailyTargetHours * 60;
    
    // Session muss vom Typ 'instruction' sein
    if (session.type !== 'instruction') return false;

    const start = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime);
    const end = session.endTime.toDate ? session.endTime.toDate() : new Date(session.endTime);
    const durationMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
    
    // Prüfen auf Unterfüllung (< 80% des Ziels)
    const threshold = targetMinutes * 0.8; 

    if (durationMinutes < threshold) {
        const missingMinutes = targetMinutes - durationMinutes;
        const reason = `Tagesziel verfehlt (${durationMinutes}m von ${targetMinutes}m). Fehlzeit: ${missingMinutes}m.`;
        
        // Strafe generieren (Nutzt neues Ledger)
        await registerPunishment(userId, reason);
        return true; 
    }

    return false; 
};

// Hilfsfunktion für den Oath-Decline im Dashboard
export const registerOathRefusal = async (userId) => {
    await registerPunishment(userId, "Blind Oath verweigert.");
};