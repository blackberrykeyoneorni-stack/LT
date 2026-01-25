import { db } from '../firebase';
import { collection, serverTimestamp, query, where, getDocs, doc, setDoc, getDoc, orderBy } from 'firebase/firestore';
import { DEFAULT_PROTOCOL_RULES } from '../config/defaultRules';

// --- HELPER FUNKTIONEN ---

/**
 * Helper: Berechnet ob Item ruhen muss (STRIKT NUR NYLONS)
 * Berücksichtigt die Ruhezeit (restingHours) seit dem letzten Tragen.
 */
const isItemInRecovery = (item, restingHours = 24) => {
    // 1. Kategorien Check: Nur wenn Hauptkategorie exakt 'Nylons' ist
    if (!item.mainCategory || item.mainCategory !== 'Nylons') {
        return false;
    }

    // 2. Zeit Check
    if (!item.lastWorn) {
        return false;
    }

    const lastWornDate = item.lastWorn.toDate ? item.lastWorn.toDate() : new Date(item.lastWorn);
    
    // Sicherheitscheck für ungültige Daten
    if (isNaN(lastWornDate.getTime())) {
        return false; 
    }

    const hoursSince = (new Date() - lastWornDate) / (1000 * 60 * 60);
    return hoursSince < restingHours;
};

/**
 * Zukünftige Pläne für Pre-Locking laden.
 * Verhindert, dass Items ausgewählt werden, die in den nächsten 48h fest eingeplant sind.
 */
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

/**
 * Prüft, ob es für HEUTE einen expliziten Plan im Kalender gibt.
 * Falls ja, werden diese Items priorisiert behandelt.
 */
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

/**
 * Lädt die letzte generierte Instruction aus der Datenbank.
 */
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

/**
 * Hilfsfunktion: Lädt Protokoll-Settings für Forced Release.
 * Kombiniert Default-Werte mit User-Einstellungen.
 */
const getProtocolSettings = async (userId) => {
    try {
        const settingsRef = doc(db, `users/${userId}/settings/protocol`);
        const settingsSnap = await getDoc(settingsRef);
        
        if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            return {
                ...DEFAULT_PROTOCOL_RULES,
                ...data,
                instruction: {
                    ...DEFAULT_PROTOCOL_RULES.instruction,
                    ...(data.instruction || {}),
                    forcedReleaseMethods: {
                        ...DEFAULT_PROTOCOL_RULES.instruction.forcedReleaseMethods,
                        ...(data.instruction?.forcedReleaseMethods || {})
                    }
                }
            };
        }
    } catch (e) {
        console.error("Error loading protocol settings:", e);
    }
    return DEFAULT_PROTOCOL_RULES;
};

// --- CORE FUNKTIONEN ---

/**
 * Überprüft die Einhaltung der Nacht-Regeln (Checkpoints).
 * Prüft um 01:30, 03:00, 04:30 und 06:00 Uhr.
 */
export const verifyNightCompliance = async (userId, referenceDate = new Date()) => {
    // referenceDate ist standardmäßig "Jetzt" (der aktuelle Tag).
    
    try {
        const year = referenceDate.getFullYear();
        const month = referenceDate.getMonth();
        const day = referenceDate.getDate();

        // Checkpoints definieren (lokale Zeit)
        const checkpoints = [
            new Date(year, month, day, 1, 30, 0), // 01:30 Uhr
            new Date(year, month, day, 3, 0, 0),  // 03:00 Uhr
            new Date(year, month, day, 4, 30, 0), // 04:30 Uhr
            new Date(year, month, day, 6, 0, 0)   // 06:00 Uhr
        ];

        // Suchfenster für Sessions: Von Gestern 20:00 bis Heute 08:00
        const searchStart = new Date(year, month, day - 1, 20, 0, 0);
        
        const q = query(
            collection(db, `users/${userId}/sessions`),
            where('type', '==', 'instruction'),
            where('startTime', '>=', searchStart),
            orderBy('startTime', 'asc')
        );

        const sessionsSnap = await getDocs(q);
        const sessions = [];
        const now = new Date();

        sessionsSnap.forEach(doc => {
            const data = doc.data();
            sessions.push({
                start: data.startTime.toDate(),
                // Wenn kein endTime (läuft noch), nehmen wir "jetzt"
                end: data.endTime ? data.endTime.toDate() : now,
                ...data
            });
        });

        let allCheckpointsCovered = true;
        const missedCheckpoints = [];

        // Jeden Checkpoint prüfen
        checkpoints.forEach(cp => {
            // Eine Session ist gültig, wenn sie VOR/AM Checkpoint startete und NACH/AM Checkpoint endete
            const isCovered = sessions.some(s => s.start <= cp && s.end >= cp);
            
            if (!isCovered) {
                allCheckpointsCovered = false;
                missedCheckpoints.push(cp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
            }
        });

        // Ergebnis persistieren (für ProgressBar & Tag-Validierung)
        const dateKey = referenceDate.toISOString().split('T')[0]; // YYYY-MM-DD
        await setDoc(doc(db, `users/${userId}/status/nightCompliance`), {
            date: dateKey,
            success: allCheckpointsCovered,
            missedCheckpoints,
            lastChecked: serverTimestamp()
        }, { merge: true });

        console.log(`Night Compliance Check für ${dateKey}: ${allCheckpointsCovered ? 'ERFOLG' : 'FEHLSCHLAG'}`, missedCheckpoints);

        return allCheckpointsCovered;

    } catch (e) {
        console.error("Fehler bei verifyNightCompliance:", e);
        return false;
    }
};

/**
 * Hauptfunktion zur Generierung der täglichen Anweisung.
 * Berücksichtigt: Plan, Einstellungen, Wahrscheinlichkeiten, Recovery.
 */
export const generateAndSaveInstruction = async (uid, items, activeSessions, periodId) => {
    try {
        // 1. Hole Präferenzen
        const prefsSnap = await getDoc(doc(db, `users/${uid}/settings/preferences`));
        const prefs = prefsSnap.exists() ? prefsSnap.data() : {};
        
        // NEU: Hole Protokoll-Einstellungen für Forced Release
        const protocolSettings = await getProtocolSettings(uid);
        
        // SICHERHEIT: Parse als Integer, um String-Vergleiche zu vermeiden
        // Dies verhindert Fehler bei der Wahrscheinlichkeitsberechnung unten
        const maxItems = parseInt(prefs.maxInstructionItems || 1, 10);
        const restingHours = prefs.nylonRestingHours || 24;
        const userWeights = prefs.categoryWeights || {}; // Manuelle Gewichtungen aus Settings

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

        // --- AB HIER: SMART HYBRID SELECTION (WURZEL-DÄMPFUNG) ---

        const safeActiveSessions = Array.isArray(activeSessions) ? activeSessions : [];
        const allActiveIds = new Set();
        safeActiveSessions.forEach(s => {
            if (s.itemId) allActiveIds.add(s.itemId);
            if (s.itemIds && Array.isArray(s.itemIds)) s.itemIds.forEach(id => allActiveIds.add(id));
        });

        const futureBlockedIds = await getFutureBlockedItemIds(uid, restingHours);
        
        const isNightInstruction = periodId && periodId.includes('night');

        // 3. Filterung der verfügbaren Items
        const availableItems = items.filter(i => {
            // Nur aktive Items
            if (i.status !== 'active') return false; 
            
            // Nicht, wenn bereits getragen
            if (allActiveIds.has(i.id)) return false; 
            
            // Nicht, wenn in Recovery (Elasthan-Ruhe)
            if (isItemInRecovery(i, restingHours)) return false; 
            
            // Bestehender Filter für Accessoires/Buttplugs wie gewünscht beibehalten
            if (i.mainCategory === 'Accessoires' && i.subCategory === 'Buttplug') return false;
            
            // Nicht, wenn für die Zukunft geplant
            if (futureBlockedIds.includes(i.id)) return false;

            // Zeit-Check (Tag/Nacht Eignung)
            const itemPeriod = i.suitablePeriod || 'Beide'; 
            
            if (isNightInstruction) {
                if (itemPeriod === 'Tag') return false;
            } else {
                if (itemPeriod === 'Nacht') return false;
            }

            return true;
        });
        
        if (availableItems.length === 0) return null;

        // 4. SMART HYBRID SELECTOR
        // Schritt A: Gruppieren nach Subkategorie (oder Mainkategorie als Fallback)
        const groups = {};
        availableItems.forEach(item => {
            const key = item.subCategory || item.mainCategory || 'Sonstiges';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        let availableGroupKeys = Object.keys(groups);
        const selectedItems = [];

        // --- NEU: Wahrscheinlichkeits-Logik für Item-Anzahl ---
        // Berechnet tatsächliche Anzahl basierend auf maxItems & Zufall
        
        let targetItemCount = 1;
        const rndCount = Math.random();

        if (maxItems === 1) {
            targetItemCount = 1;
        } else if (maxItems === 2) {
            // 75% Chance für 2 Items, sonst 1
            if (rndCount < 0.75) {
                targetItemCount = 2;
            } else {
                targetItemCount = 1;
            }
        } else if (maxItems >= 3) { // Auch für > 3 gilt die Logik von 3
            // 55% Chance für 3 Items
            // 40% Chance für 2 Items (Summe 95%)
            // 5% Chance für 1 Item
            if (rndCount < 0.55) {
                targetItemCount = 3;
            } else if (rndCount < 0.95) { // 0.55 + 0.40
                targetItemCount = 2;
            } else {
                targetItemCount = 1;
            }
        } 

        console.log(`InstructionService: MaxItems=${maxItems}, Random=${rndCount.toFixed(2)} -> TargetCount=${targetItemCount}`);

        // Schleife zum Ziehen der Items
        for (let k = 0; k < targetItemCount; k++) {
            if (availableGroupKeys.length === 0) break;

            // Schritt B: Gewichtung berechnen (Wurzel-Dämpfung + User Settings)
            let totalWeight = 0;
            const weightedGroups = availableGroupKeys.map(key => {
                const count = groups[key].length;
                // Wurzel-Dämpfung: Große Sammlungen zählen mehr, aber nicht linear
                const rootScore = Math.sqrt(count); 
                // Manuelle Gewichtung aus Einstellungen (Multiplikator)
                const manualWeight = parseInt(userWeights[key] || 1);
                
                const finalScore = rootScore * manualWeight;
                totalWeight += finalScore;
                
                return { key, score: finalScore };
            });

            // Schritt C: Roulette-Wheel Selection der Kategorie
            let randomValue = Math.random() * totalWeight;
            let chosenCategoryKey = null;
            
            for (const group of weightedGroups) {
                randomValue -= group.score;
                if (randomValue <= 0) {
                    chosenCategoryKey = group.key;
                    break;
                }
            }
            // Fallback bei Rundungsfehlern
            if (!chosenCategoryKey && weightedGroups.length > 0) {
                chosenCategoryKey = weightedGroups[weightedGroups.length - 1].key;
            }

            // Schritt D: Zufälliges Item aus der gewählten Kategorie
            const itemsInGroup = groups[chosenCategoryKey];
            const randomItemIndex = Math.floor(Math.random() * itemsInGroup.length);
            const selectedItem = itemsInGroup[randomItemIndex];

            selectedItems.push(selectedItem);

            // Kategorie entfernen, um Vielfalt zu erzwingen (wie bisherige Logik)
            availableGroupKeys = availableGroupKeys.filter(key => key !== chosenCategoryKey);
        }

        if (selectedItems.length === 0) return null;

        // --- FORCED RELEASE LOGIK (DYNAMISCH) ---
        // Verwendet jetzt die Werte aus ProtocolSettings
        let forcedRelease = { required: false, executed: false, method: null };
        
        if (isNightInstruction) {
            // Chance aus den Settings (Fallback 0.15)
            const triggerChance = protocolSettings.instruction?.forcedReleaseTriggerChance ?? 0.15;
            
            if (Math.random() < triggerChance) {
                forcedRelease.required = true;
                
                // Methoden-Wahrscheinlichkeiten aus Settings
                const methods = protocolSettings.instruction?.forcedReleaseMethods ?? { 
                    hand: 0.34, toy_vaginal: 0.33, toy_anal: 0.33 
                };

                // Gewichtete Zufallsauswahl
                const rnd = Math.random();
                const handProb = methods.hand || 0;
                const vagProb = methods.toy_vaginal || 0;
                
                // Hier wird die "Rest-Logik" der Slider angewendet
                if (rnd < handProb) {
                    forcedRelease.method = 'hand';
                } else if (rnd < (handProb + vagProb)) {
                    forcedRelease.method = 'toy_vaginal';
                } else {
                    forcedRelease.method = 'toy_anal';
                }
                
                console.log("InstructionService: Forced Release Triggered via Settings!", forcedRelease.method);
            }
        }

        const titleNames = selectedItems.map(i => i.subCategory || i.name || 'Item').join(' & ');

        const instructionData = {
            periodId,
            generatedAt: serverTimestamp(),
            isAccepted: false,
            itemName: titleNames,
            forcedRelease, 
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