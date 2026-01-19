// src/services/ProtocolService.js
import { db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { DEFAULT_PROTOCOL_RULES } from '../config/defaultRules';

class ProtocolService {
    constructor() {
        // Deep Copy der Defaults als Startwert
        this.rules = JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_RULES));
        this.unsubscribe = null;
    }

    init(userId) {
        if (!userId) return;

        const rulesRef = doc(db, `users/${userId}/settings/protocol`);

        this.unsubscribe = onSnapshot(rulesRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                
                // Deep Merge für Robustheit (falls Felder in DB fehlen)
                this.rules = {
                    time: { ...DEFAULT_PROTOCOL_RULES.time, ...(data.time || {}) },
                    tzd: { 
                        ...DEFAULT_PROTOCOL_RULES.tzd, 
                        ...(data.tzd || {}),
                        // Array explizit überschreiben falls vorhanden
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
                };
                console.log("Protocol Rules updated:", this.rules);
            } else {
                console.log("Creating default protocol rules.");
                setDoc(rulesRef, DEFAULT_PROTOCOL_RULES, { merge: true });
                this.rules = JSON.parse(JSON.stringify(DEFAULT_PROTOCOL_RULES));
            }
        }, (error) => {
            console.error("Error listening to protocol rules:", error);
        });
    }

    getRules() { return this.rules; }
    
    // Helfer für TZD Matrix Berechnung (baut Cumulative Array für den Algorithmus)
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