import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';

const AUDIT_INTERVAL_DAYS = 30;
const ITEMS_TO_AUDIT = 5;

// Hilfsfunktion: Prüft, ob ein Audit fällig ist
export const isAuditDue = async (userId) => {
    const statusRef = doc(db, `users/${userId}/status/auditStatus`);
    const statusSnap = await getDoc(statusRef);
    
    if (!statusSnap.exists()) return true; // Audit immer fällig, wenn kein Status existiert

    const lastAuditDate = statusSnap.data().lastAuditDate?.toDate();
    if (!lastAuditDate) return true;

    const daysElapsed = (Date.now() - lastAuditDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysElapsed >= AUDIT_INTERVAL_DAYS;
};

// Startet den Audit-Prozess und speichert die 5 zufälligen Items
export const initializeAudit = async (userId, allItems) => {
    // Audit Status laden
    const statusRef = doc(db, `users/${userId}/status/auditStatus`);
    const statusSnap = await getDoc(statusRef);
    const existingAuditData = statusSnap.exists() ? statusSnap.data() : {};
    
    // Wenn Audit bereits aktiv ist, die existierenden Items zurückgeben
    if (existingAuditData.active && existingAuditData.pendingItems?.length > 0) {
        return existingAuditData.pendingItems;
    }

    // Filter Items: Nur aktive, die nicht "lost" sind
    const availableItems = allItems.filter(i => i.status === 'active');

    // 1. ITEMS_TO_AUDIT zufällige Items auswählen (mit Präferenz für wenig getragene)
    // Einfache Zufallsauswahl (kann später durch gewichteten Zufall ersetzt werden)
    let selectedItems = [];
    let pool = [...availableItems];

    for (let i = 0; i < ITEMS_TO_AUDIT && pool.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        selectedItems.push(pool[randomIndex]);
        pool.splice(randomIndex, 1);
    }
    
    // Nur die IDs, Namen und Locations speichern
    const pendingItems = selectedItems.map(item => ({
        id: item.id,
        name: item.name || `${item.brand} ${item.model}`,
        location: item.storageLocation || 'N/A',
        initialCondition: item.condition || 5
    }));

    // 2. Audit Status in Firestore speichern
    await setDoc(statusRef, {
        active: true,
        pendingItems: pendingItems,
        startedAt: serverTimestamp(),
    }, { merge: true });

    return pendingItems;
};

// Schließt das Audit ab und setzt das Datum
export const completeAudit = async (userId) => {
    const statusRef = doc(db, `users/${userId}/status/auditStatus`);
    await updateDoc(statusRef, {
        active: false,
        pendingItems: [],
        lastAuditDate: serverTimestamp(),
    });
};

// Aktualisiert den Zustand des Items und des Audit-Status nach der Prüfung
export const confirmAuditItem = async (userId, itemId, newCondition) => {
    // 1. Item-Zustand aktualisieren (Condition)
    const itemRef = doc(db, `users/${userId}/items`, itemId);
    if (newCondition) {
        await updateDoc(itemRef, { condition: newCondition });
    }

    // 2. Item aus der Liste der pendingItems entfernen
    const statusRef = doc(db, `users/${userId}/status/auditStatus`);
    const statusSnap = await getDoc(statusRef);
    
    if (statusSnap.exists() && statusSnap.data().active) {
        let pendingItems = statusSnap.data().pendingItems || [];
        pendingItems = pendingItems.filter(item => item.id !== itemId);
        
        await updateDoc(statusRef, { pendingItems: pendingItems });
        
        // Wenn keine Items mehr zu prüfen sind, Audit abschließen
        if (pendingItems.length === 0) {
            await completeAudit(userId);
            return { auditComplete: true };
        }
    }
    return { auditComplete: false };
};
