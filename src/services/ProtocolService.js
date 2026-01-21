import { db } from '../firebase';
import { 
    doc, setDoc, onSnapshot, getDoc, collection, query, where, getDocs, orderBy, Timestamp, serverTimestamp 
} from 'firebase/firestore';
import { DEFAULT_PROTOCOL_RULES } from '../config/defaultRules';

// --- HELPER ---

// Berechnet den Montag der aktuellen Woche (00:00 Uhr)
const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Montag berechnen
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

// TZD Berechnung (Linear + Wurzeldämpfung)
export const calculateTZDEffectiveHours = (durationMinutes) => {
    const durationHours = durationMinutes / 60;
    // 1. Lineare Verteilung (6h=100%, 36h=40%) -> Faktor = 1.12 - 0.02 * t
    const factor = 1.12 - (0.02 * durationHours);
    // Effektive Stunden
    const linearHours = durationHours * factor;
    // 2. Wurzeldämpfung
    const dampenedHours = Math.sqrt(linearHours);
    return dampenedHours;
};

// KERN-ALGORITHMUS: Berechnet Statistiken für einen Zeitraum
const calculateStatsForPeriod = async (userId, startDate, endDate, currentGoal) => {
    const q = query(
        collection(db, `users/${userId}/sessions`),
        where('type', '==', 'instruction'),
        where('startTime', '>=', startDate),
        where('startTime', '<', endDate),
        orderBy('startTime', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const validSessions = [];

    querySnapshot.forEach(doc => {
        const data = doc.data();
        
        // FILTER: Nur Tag-Sessions (kein 'night' im Period-String)
        const isNight = data.period && data.period.toLowerCase().includes('night');
        if (isNight) return;

        // FILTER: Nacht-Compliance Check
        if (data.nightSuccess === false) return;

        // BERECHNUNG
        let effectiveHours = 0;
        
        if (data.tzdExecuted && data.tzdDurationMinutes) {
            effectiveHours = calculateTZDEffectiveHours(data.tzdDurationMinutes);
        } else {
            let durationMinutes = 0;
            if (data.endTime) {
                durationMinutes = (data.endTime.toDate() - data.startTime.toDate()) / 60000;
            } else {
                // Falls Session noch läuft
                durationMinutes = (new Date() - data.startTime.toDate()) / 60000;
            }
            effectiveHours = durationMinutes / 60;
        }

        validSessions.push(effectiveHours);
    });

    // 4. Durchschnitt berechnen (Summe / 5) - Gemäß User-Regel
    const sumHours = validSessions.reduce((a, b) => a + b, 0);
    // Safety Check: Division durch 0 vermeiden
    const average = validSessions.length > 0 ? (sumHours / 5) : 0;

    // 5. Ratchet Logic
    let nextGoal = currentGoal;
    if (average > currentGoal) {
        nextGoal = average;
    }

    // NEU: Absolute Obergrenze (Hard Cap) von 6 Stunden
    if (nextGoal > 6) {
        nextGoal = 6;
    }

    return {
        average: parseFloat(average.toFixed(2)),
        nextGoal: parseFloat(nextGoal.toFixed(2)),
        sessionCount: validSessions.length,
        currentGoal
    };
};

// --- EXPORTIERTE FUNKTIONEN ---

/**
 * Berechnet das vorgeschlagene Ziel für die nächste Woche (Preview).
 * Basiert auf der laufenden Woche (seit Montag).
 */
export const getProjectedGoal = async (userId) => {
    try {
        // 1. Aktuelles Ziel laden
        const settingsRef = doc(db, `users/${userId}/settings/protocol`);
        const settingsSnap = await getDoc(settingsRef);
        const currentGoal = settingsSnap.exists() ? (settingsSnap.data().currentDailyGoal || 4) : 4;

        // 2. Zeitraum: Dieser Montag bis Jetzt
        const now = new Date();
        const thisMonday = getStartOfWeek(now);
        
        // Ende ist "Jetzt" (für Preview)
        const endOfPeriod = new Date();
        endOfPeriod.setDate(endOfPeriod.getDate() + 1); // Sicherheitshalber morgen, um heute komplett einzuschließen

        const stats = await calculateStatsForPeriod(userId, thisMonday, endOfPeriod, currentGoal);

        return {
            currentGoal: stats.currentGoal,
            projectedAverage: stats.average,
            nextGoal: stats.nextGoal,
            validSessionCount: stats.sessionCount
        };

    } catch (e) {
        console.error("Fehler bei Goal Calculation:", e);
        return null;
    }
};

/**
 * PRÜFT UND FÜHRT WOCHEN-UPDATE DURCH (AUTOMATISCH)
 * Wird beim Start der App aufgerufen.
 */
export const checkAndRunWeeklyUpdate = async (userId) => {
    try {
        const settingsRef = doc(db, `users/${userId}/settings/protocol`);
        const settingsSnap = await getDoc(settingsRef);
        
        let currentGoal = 4;
        let lastUpdateDate = null;

        if (settingsSnap.exists()) {
            const data = settingsSnap.data();
            currentGoal = data.currentDailyGoal || 4;
            if (data.lastGoalUpdate) {
                lastUpdateDate = data.lastGoalUpdate.toDate();
            }
        }

        const now = new Date();
        const currentWeekStart = getStartOfWeek(now);

        // Check: Wurde diese Woche schon geupdatet?
        // Wenn lastUpdateDate existiert UND im gleichen Wochen-Intervall liegt wie "jetzt", abbrechen.
        if (lastUpdateDate && getStartOfWeek(lastUpdateDate).getTime() === currentWeekStart.getTime()) {
            // Update für diese Woche schon gelaufen.
            return;
        }

        console.log("Weekly Protocol Update: Triggered.");

        // Wir brauchen die Stats der VORHERIGEN Woche
        const lastWeekStart = new Date(currentWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        
        // Zeitraum: Letzter Montag bis Diesen Montag (exklusive)
        const stats = await calculateStatsForPeriod(userId, lastWeekStart, currentWeekStart, currentGoal);

        // Update durchführen
        await setDoc(settingsRef, {
            currentDailyGoal: stats.nextGoal,
            lastGoalUpdate: serverTimestamp(), // Wichtig: Server-Zeit für Konsistenz
            lastWeekStats: { // Optional: Historie speichern
                average: stats.average,
                previousGoal: currentGoal,
                date: new Date()
            }
        }, { merge: true });

        console.log(`Weekly Goal updated from ${currentGoal}h to ${stats.nextGoal}h based on avg ${stats.average}h`);
        return stats.nextGoal;

    } catch (e) {
        console.error("Fehler beim Wochen-Update:", e);
    }
};

/**
 * Manuelles Fixieren (Legacy/Debug)
 */
export const commitNewWeeklyGoal = async (userId) => {
    return checkAndRunWeeklyUpdate(userId);
};


// --- PROTOCOL SERVICE CLASS ---
class ProtocolService {
    constructor() {
        this.rules = JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_RULES));
        this.unsubscribe = null;
    }

    init(userId) {
        if (!userId) return;

        const rulesRef = doc(db, `users/${userId}/settings/protocol`);

        this.unsubscribe = onSnapshot(rulesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                
                this.rules = {
                    time: { ...DEFAULT_PROTOCOL_RULES.time, ...(data.time || {}) },
                    tzd: { 
                        ...DEFAULT_PROTOCOL_RULES.tzd, 
                        ...(data.tzd || {}),
                        durationMatrix: data.tzd?.durationMatrix || DEFAULT_PROTOCOL_RULES.tzd.durationMatrix
                    },
                    purity: { ...DEFAULT_PROTOCOL_RULES.purity, ...(data.purity || {}) },
                    instruction: { 
                        ...DEFAULT_PROTOCOL_RULES.instruction, 
                        ...(data.instruction || {}),
                        forcedReleaseMethods: {
                            ...DEFAULT_PROTOCOL_RULES.instruction.forcedReleaseMethods,
                            ...(data.instruction?.forcedReleaseMethods || {})
                        }
                    },
                    punishment: { ...DEFAULT_PROTOCOL_RULES.punishment, ...(data.punishment || {}) },
                    
                    // WICHTIG: Hier wird das Ziel geladen
                    currentDailyGoal: data.currentDailyGoal || 4
                };
            } else {
                console.log("No protocol rules found. Creating defaults.");
                const initialData = {
                    ...DEFAULT_PROTOCOL_RULES,
                    currentDailyGoal: 4
                };
                setDoc(rulesRef, initialData, { merge: true });
                this.rules = JSON.parse(JSON.stringify(initialData));
            }
        }, (error) => {
            console.error("Error listening to protocol rules:", error);
        });
    }

    getRules() { return this.rules; }
    
    getTZDCumulativeMatrix() {
        const matrix = this.rules.tzd.durationMatrix || [];
        let cumulative = 0;
        return matrix.map(zone => {
            cumulative += zone.weight;
            return { 
                min: zone.minHours, 
                max: zone.maxHours, 
                cumulative: cumulative 
            };
        });
    }

    detach() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }
}

export const protocolService = new ProtocolService();