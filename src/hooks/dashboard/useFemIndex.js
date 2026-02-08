import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Hook zur Berechnung des FEM-INDEX (früher Erosion Metric).
 * Unterstützt jetzt Hybrid-Export (Named + Default) für Kompatibilität mit Dashboard.jsx.
 */
export const useFemIndex = () => {
    const { currentUser } = useAuth();
    const [femIndex, setFemIndex] = useState(0);
    const [details, setDetails] = useState({
        baseScore: 0,
        denialDeduction: 0,
        chastityBonus: 0,
        taskMultiplier: 1,
        components: [] // Für detaillierte Listenanzeige
    });

    useEffect(() => {
        if (!currentUser) return;

        // Wir hören auf das User-Dokument oder Status-Dokument, wo die Metriken liegen
        const unsub = onSnapshot(doc(db, `users/${currentUser.uid}/status/metrics`), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // --- BERECHNUNGS-LOGIK ---
                
                // 1. Basiswert (z.B. durch Items im Besitz)
                const base = data.baseScore || 50; 
                
                // 2. Denial Abzug (wenn man nicht brav war)
                const denial = data.denialLevel ? data.denialLevel * 5 : 0; 
                
                // 3. Keuschheits-Bonus (Nächte im Käfig)
                const chastity = data.chastityDays ? data.chastityDays * 2 : 0;
                
                // 4. Aufgaben-Multiplikator
                const tasksDone = data.tasksCompleted || 0;
                const multiplier = 1 + (tasksDone * 0.05);

                // Berechnung
                let calculated = (base - denial + chastity) * multiplier;
                
                // Cap auf 0-100
                calculated = Math.max(0, Math.min(100, calculated));

                setFemIndex(Math.round(calculated));
                
                // Details für das Overlay speichern
                setDetails({
                    baseScore: base,
                    denialDeduction: denial,
                    chastityBonus: chastity,
                    taskMultiplier: multiplier,
                    components: [
                        { label: 'Basiswert (Inventar)', value: base, type: 'neutral' },
                        { label: 'Denial Strafe', value: -denial, type: 'negative' },
                        { label: 'Keuschheits-Bonus', value: +chastity, type: 'positive' },
                        { label: `Aufgaben Faktor (x${multiplier.toFixed(2)})`, value: null, type: 'neutral' }
                    ]
                });
            } else {
                // Fallback / Startwerte
                setFemIndex(50);
                setDetails({
                    baseScore: 50,
                    denialDeduction: 0,
                    chastityBonus: 0,
                    taskMultiplier: 1,
                    components: [{ label: 'Basiswert (Standard)', value: 50, type: 'neutral' }]
                });
            }
        });

        return () => unsub();
    }, [currentUser]);

    return { femIndex, details };
};

// Default Export hinzufügen für Kompatibilität mit Dashboard.jsx
export default useFemIndex;