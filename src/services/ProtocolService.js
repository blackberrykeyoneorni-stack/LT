import { db } from '../firebase';
import { doc, setDoc, onSnapshot, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { DEFAULT_PROTOCOL_RULES } from '../config/defaultRules';

// --- ALGORITHMUS FÜR WOCHENZIEL & TZD ---

// Helper: TZD Berechnung (Linear + Wurzeldämpfung)
export const calculateTZDEffectiveHours = (durationMinutes) => {
    const durationHours = durationMinutes / 60;
    
    // 1. Lineare Verteilung (6h=100%, 36h=40%)
    // Formel: Faktor = 1.12 - 0.02 * t
    const factor = 1.12 - (0.02 * durationHours);
    
    // Effektive Stunden nach linearer Gewichtung
    const linearHours = durationHours * factor;
    
    // 2. Wurzeldämpfung (nur auf das TZD Ergebnis, wie gewünscht)
    // Verhindert, dass extrem lange TZD Sessions den Durchschnitt sprengen
    const dampenedHours = Math.sqrt(linearHours);

    return dampenedHours;
};

/**
 * Berechnet das vorgeschlagene Ziel für die nächste Woche (Preview).
 */
export const getProjectedGoal = async (userId) => {
    try {
        // 1. Aktuelles Ziel laden
        const settingsRef = doc(db, `users/${userId}/settings/protocol`);
        const settingsSnap = await getDoc(settingsRef);
        const currentGoal = settingsSnap.exists() ? (settingsSnap.data().currentDailyGoal || 4) : 4;

        // 2. Zeitraum definieren (Seit letztem Montag)
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=So, 1=Mo...
        const diffToMonday = (dayOfWeek + 6) % 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - diffToMonday);
        monday.setHours(0, 0, 0, 0);

        // 3. Sessions laden
        const q = query(
            collection(db, `users/${userId}/sessions`),
            where('type', '==', 'instruction'),
            where('startTime', '>=', monday),
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
            // Wenn nightSuccess explizit false ist, zählt der Tag 0.
            if (data.nightSuccess === false) return;

            // BERECHNUNG
            let effectiveHours = 0;
            
            if (data.tzdExecuted && data.tzdDurationMinutes) {
                // TZD Logik: Linear + Wurzel
                effectiveHours = calculateTZDEffectiveHours(data.tzdDurationMinutes);
            } else {
                // Reguläre Instruction: Volle Zeit
                let durationMinutes = 0;
                if (data.endTime) {
                    durationMinutes = (data.endTime.toDate() - data.startTime.toDate()) / 60000;
                } else {
                    // Falls Session noch läuft (Live-Preview)
                    durationMinutes = (new Date() - data.startTime.toDate()) / 60000;
                }
                effectiveHours = durationMinutes / 60;
            }

            validSessions.push(effectiveHours);
        });

        // 4. Durchschnitt berechnen (Summe / 5)
        const sumHours = validSessions.reduce((a, b) => a + b, 0);
        const average = sumHours / 5;

        // 5. Ratchet Update (Ohne Dämpfung, Ziel steigt sofort auf Durchschnitt)
        let nextGoal = currentGoal;
        if (average > currentGoal) {
            nextGoal = average;
        }

        return {
            currentGoal: parseFloat(currentGoal.toFixed(2)),
            projectedAverage: parseFloat(average.toFixed(2)),
            nextGoal: parseFloat(nextGoal.toFixed(2)),
            validSessionCount: validSessions.length
        };

    } catch (e) {
        console.error("Fehler bei Goal Calculation:", e);
        return null;
    }
};

/**
 * Fixiert das neue Ziel (Montag früh auszuführen)
 */
export const commitNewWeeklyGoal = async (userId) => {
    const projection = await getProjectedGoal(userId);
    if (!projection) return;

    await setDoc(doc(db, `users/${userId}/settings/protocol`), {
        currentDailyGoal: projection.nextGoal,
        lastGoalUpdate: new Date()
    }, { merge: true });

    return projection.nextGoal;
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
                console.log("Protocol Rules loaded via Service:", this.rules);
            } else {
                console.log("No protocol rules found. Creating defaults.");
                // Wenn das Dokument fehlt, erstellen wir es mit den Defaults + 4h Ziel
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