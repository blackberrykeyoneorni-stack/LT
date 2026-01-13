import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';

// Helper: Berechnet ob Item ruhen muss (STRIKT NUR NYLONS)
const isItemInRecovery = (item, restingHours = 24) => {
    // 1. Kategorien Check: Nur wenn Hauptkategorie exakt 'Nylons' ist
    if (!item.mainCategory || item.mainCategory !== 'Nylons') return false;

    // 2. Zeit Check
    if (!item.lastWorn) return false;
    const lastWornDate = item.lastWorn.toDate ? item.lastWorn.toDate() : new Date(item.lastWorn);
    if (isNaN(lastWornDate.getTime())) return false; 

    const hoursSince = (new Date() - lastWornDate) / (1000 * 60 * 60);
    return hoursSince < restingHours;
};

// Zukünftige Pläne für Pre-Locking laden
const getFutureBlockedItemIds = async (uid, restingHours) => {
    try {
        const now = new Date();
        const futureLimit = new Date();
        futureLimit.setDate(now.getDate() + 2);

        const q = query(
            collection(db, `users/${uid}/planning`),
            where('date', '>', now),
            where('date', '<=', futureLimit)
        );

        const snap = await getDocs(q);
        let blockedIds = [];
        snap.forEach(doc => {
            const data = doc.data();
            if (data.itemIds && Array.isArray(data.itemIds)) {
                blockedIds = [...blockedIds, ...data.itemIds];
            }
        });
        return blockedIds;
    } catch (e) {
        console.warn("Konnte zukünftige Pläne nicht laden (ignoriere):", e);
        return [];
    }
};

// NEU: Prüft, ob es für HEUTE einen expliziten Plan gibt
const checkTodayPlan = async (uid, allItems) => {
    try {
        // Wir nutzen das Datum im Format YYYY-MM-DD als ID (wie im CalendarService)
        const today = new Date();
        const offset = today.getTimezoneOffset() * 60000;
        const localDateStr = new Date(today.getTime() - offset).toISOString().split('T')[0];

        const planRef = doc(db, `users/${uid}/planning`, localDateStr);
        const planSnap = await getDoc(planRef);

        if (planSnap.exists()) {
            const data = planSnap.data();
            if (data.itemIds && data.itemIds.length > 0) {
                console.log(`InstructionService: Plan für heute (${localDateStr}) gefunden!`, data.itemIds);
                // Wir filtern die echten Item-Objekte heraus
                const plannedItems = allItems.filter(i => data.itemIds.includes(i.id));
                return plannedItems;
            }
        }
        return null;
    } catch (e) {
        console.error("Fehler beim Prüfen des Tagesplans:", e);
        return null;
    }
};

// Lädt die letzte generierte Instruction (FEHLTE VORHER)
export const getLastInstruction = async (uid) => {
    try {
        const docRef = doc(db, `users/${uid}/status/dailyInstruction`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    } catch (e) {
        console.error("Error fetching last instruction:", e);
        return null;
    }
};

export const generateAndSaveInstruction = async (uid, items, activeSessions, periodId) => {
    try {
        // 1. Hole Präferenzen
        const prefsSnap = await getDoc(doc(db, `users/${uid}/settings/preferences`));
        const prefs = prefsSnap.exists() ? prefsSnap.data() : {};
        
        const maxItems = prefs.maxInstructionItems || 1;
        const restingHours = prefs.nylonRestingHours || 24;
        const weights = prefs.categoryWeights || {}; 

        // 2. CHECK: GIBT ES EINEN PLAN FÜR HEUTE?
        // Wenn ja, überspringen wir die Zufallslogik komplett.
        const plannedItems = await checkTodayPlan(uid, items);
        
        if (plannedItems && plannedItems.length > 0) {
            console.log("InstructionService: Führe geplanten Plan aus.");
            
            // Sofortige Rückgabe des Plans als Anweisung
            const instructionData = {
                periodId,
                generatedAt: serverTimestamp(),
                isAccepted: false,
                isPlanned: true, // Markierung für UI (optional)
                items: plannedItems.map(i => ({
                    id: i.id,
                    name: i.name || 'Unbenanntes Item',
                    brand: i.brand || '',
                    img: i.imageUrl || (i.images && i.images[0]) || null,
                    subCategory: i.subCategory || ''
                }))
            };
            await setDoc(doc(db, `users/${uid}/status/dailyInstruction`), instructionData);
            return instructionData;
        }

        // --- AB HIER: FALLBACK AUF ZUFALL (wenn kein Plan existiert) ---

        // 3. Filter für verfügbare Items
        // FIX: activeSessions auf Array prüfen
        const safeActiveSessions = Array.isArray(activeSessions) ? activeSessions : [];
        // Erweiterter Check: Falls activeSessions komplexere Struktur hat (itemIds Array)
        const allActiveIds = new Set();
        safeActiveSessions.forEach(s => {
            if (s.itemId) allActiveIds.add(s.itemId);
            if (s.itemIds && Array.isArray(s.itemIds)) s.itemIds.forEach(id => allActiveIds.add(id));
        });

        const futureBlockedIds = await getFutureBlockedItemIds(uid, restingHours);
        
        // ANPASSUNG: Perioden-Check (Tag/Nacht)
        const isNightInstruction = periodId && periodId.includes('night');

        const availableItems = items.filter(i => {
            if (i.status !== 'active') return false; 
            if (allActiveIds.has(i.id)) return false; 
            if (isItemInRecovery(i, restingHours)) return false; 
            
            if (i.mainCategory === 'Accessoires' && i.subCategory === 'Buttplug') return false;
            
            // Ausschluss reservierter Items für ZUKÜNFTIGE Tage
            if (futureBlockedIds.includes(i.id)) return false;

            // NEU: Tragezeitraum-Check (Tagestrageanweisung vs Nachttrageanweisung)
            const itemPeriod = i.suitablePeriod || 'Beide'; // Fallback auf 'Beide', falls nicht gesetzt
            
            if (isNightInstruction) {
                // Es ist Nacht: Schließe Items aus, die NUR für den Tag sind
                if (itemPeriod === 'Tag') return false;
            } else {
                // Es ist Tag: Schließe Items aus, die NUR für die Nacht sind
                if (itemPeriod === 'Nacht') return false;
            }

            return true;
        });
        
        if (availableItems.length === 0) return null;

        // 4. GEWICHTETE AUSWAHL
        let weightedPool = [];
        availableItems.forEach(item => {
            const sub = item.subCategory || 'Sonstiges';
            const main = item.mainCategory || 'Uncategorized';
            const weight = parseInt(weights[sub] || weights[main] || 1);
            for (let i = 0; i < weight; i++) {
                weightedPool.push(item);
            }
        });

        const selectedItems = [];
        let candidatesPool = [...weightedPool];

        for (let k = 0; k < maxItems; k++) {
            if (candidatesPool.length === 0) break;
            const randomIndex = Math.floor(Math.random() * candidatesPool.length);
            const selectedItem = candidatesPool[randomIndex];
            selectedItems.push(selectedItem);
            candidatesPool = candidatesPool.filter(candidate => {
                if (candidate.id === selectedItem.id) return false;
                if (selectedItem.subCategory && candidate.subCategory && candidate.subCategory === selectedItem.subCategory) return false;
                return true;
            });
        }

        if (selectedItems.length === 0) return null;

        const instructionData = {
            periodId,
            generatedAt: serverTimestamp(),
            isAccepted: false,
            items: selectedItems.map(i => ({
                id: i.id,
                name: i.name || 'Unbenanntes Item',
                brand: i.brand || '',
                img: i.imageUrl || (i.images && i.images[0]) || null,
                subCategory: i.subCategory || ''
            }))
        };
        
        await setDoc(doc(db, `users/${uid}/status/dailyInstruction`), instructionData);
        return instructionData;

    } catch (e) {
        console.error("FATAL ERROR in generateAndSaveInstruction:", e);
        return null; 
    }
};

// ALIAS für Abwärtskompatibilität mit Dashboard.jsx
export const generateDailyInstruction = generateAndSaveInstruction;