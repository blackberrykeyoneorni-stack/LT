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

// Lädt die letzte generierte Instruction
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
        const plannedItems = await checkTodayPlan(uid, items);
        
        if (plannedItems && plannedItems.length > 0) {
            console.log("InstructionService: Führe geplanten Plan aus.");
            
            const titleNames = plannedItems.map(i => i.subCategory || i.name || 'Item').join(' & ');

            const instructionData = {
                periodId,
                generatedAt: serverTimestamp(),
                isAccepted: false,
                isPlanned: true, 
                itemName: titleNames,
                // Bei geplanten Items greift die Zufalls-Falle nicht (kann optional geändert werden)
                forcedRelease: { required: false, executed: false, method: null },
                items: plannedItems.map(i => ({
                    id: i.id,
                    name: i.subCategory || i.name || 'Unbenanntes Item', 
                    brand: i.brand || '',
                    img: i.imageUrl || (i.images && i.images[0]) || null,
                    subCategory: i.subCategory || ''
                }))
            };
            await setDoc(doc(db, `users/${uid}/status/dailyInstruction`), instructionData);
            return instructionData;
        }

        // --- AB HIER: FALLBACK AUF ZUFALL ---

        const safeActiveSessions = Array.isArray(activeSessions) ? activeSessions : [];
        const allActiveIds = new Set();
        safeActiveSessions.forEach(s => {
            if (s.itemId) allActiveIds.add(s.itemId);
            if (s.itemIds && Array.isArray(s.itemIds)) s.itemIds.forEach(id => allActiveIds.add(id));
        });

        const futureBlockedIds = await getFutureBlockedItemIds(uid, restingHours);
        
        const isNightInstruction = periodId && periodId.includes('night');

        const availableItems = items.filter(i => {
            if (i.status !== 'active') return false; 
            if (allActiveIds.has(i.id)) return false; 
            if (isItemInRecovery(i, restingHours)) return false; 
            
            if (i.mainCategory === 'Accessoires' && i.subCategory === 'Buttplug') return false;
            
            if (futureBlockedIds.includes(i.id)) return false;

            const itemPeriod = i.suitablePeriod || 'Beide'; 
            
            if (isNightInstruction) {
                if (itemPeriod === 'Tag') return false;
            } else {
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

        // --- NEU: FORCED RELEASE LOGIK (DIE FALLE) ---
        let forcedRelease = { required: false, executed: false, method: null };
        
        if (isNightInstruction) {
            // 15% Wahrscheinlichkeit
            if (Math.random() < 0.15) {
                const rMethod = Math.random();
                let method = 'hand'; // 34%
                if (rMethod >= 0.34 && rMethod < 0.67) method = 'toy_vaginal'; // 33%
                else if (rMethod >= 0.67) method = 'toy_anal'; // 33%

                forcedRelease = {
                    required: true,
                    executed: false,
                    method: method
                };
                console.log("InstructionService: Forced Release Triggered!", method);
            }
        }

        const titleNames = selectedItems.map(i => i.subCategory || i.name || 'Item').join(' & ');

        const instructionData = {
            periodId,
            generatedAt: serverTimestamp(),
            isAccepted: false,
            itemName: titleNames,
            forcedRelease, // Speichern der Falle
            items: selectedItems.map(i => ({
                id: i.id,
                name: i.subCategory || i.name || 'Unbenanntes Item',
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

export const generateDailyInstruction = generateAndSaveInstruction;