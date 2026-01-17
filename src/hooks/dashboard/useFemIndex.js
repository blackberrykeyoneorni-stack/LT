import { useState, useEffect } from 'react';

/**
 * Berechnet den Fem-Index (0-100) basierend auf 4 Säulen:
 * 1. Enclosure (Material): Anteil Nylon/Latex/Spandex im Besitz/Einsatz.
 * 2. Nocturnal (Nacht): EXTERN BERECHNETE Single Source of Truth.
 * 3. Compliance (Agilität): Reaktionszeit und Annahmequote.
 * 4. Gap (Disziplin): Zeit ohne Item (Lücken).
 */
export default function useFemIndex(currentUser, items = [], activeSessions = [], externalNocturnalScore = 0) {
    const [score, setScore] = useState(0);
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);

    // Hilfsfunktion: Gap-Score berechnen
    const calculateGapScore = (items, currentSessions) => {
        if (currentSessions && currentSessions.length > 0) return 100;
        if (!items || items.length === 0) return 0;

        const lastWornDates = items
            .map(i => i.lastWorn ? (i.lastWorn.toDate ? i.lastWorn.toDate() : new Date(i.lastWorn)) : null)
            .filter(d => d !== null);

        if (lastWornDates.length === 0) return 0;

        const mostRecent = new Date(Math.max(...lastWornDates));
        const now = new Date();
        const hoursDiff = (now - mostRecent) / (1000 * 60 * 60);

        if (hoursDiff <= 12) return 100;
        if (hoursDiff >= 48) return 0;
        
        const remaining = 48 - hoursDiff;
        return (remaining / 36) * 100;
    };

    const calculateMetrics = async () => {
        if (!items || items.length === 0) {
            setScore(0);
            setLoading(false);
            return;
        }

        // --- A. ENCLOSURE (Material-Quote) ---
        const fetishItems = items.filter(i => {
            const cat = (i.mainCategory || '').toLowerCase();
            const sub = (i.subCategory || '').toLowerCase();
            return cat.includes('nylon') || cat.includes('latex') || cat.includes('pvc') || 
                   sub.includes('strumpfhose') || sub.includes('corsage');
        });
        const enclosureScore = (fetishItems.length / items.length) * 100;

        // --- B. GAP (Disziplin) ---
        const gapScore = calculateGapScore(items, activeSessions);

        // --- C. NOCTURNAL (Single Source of Truth) ---
        // Wir nehmen den Wert 1:1 von außen.
        const nocturnalScore = externalNocturnalScore; 

        // --- D. COMPLIANCE (Vereinfacht für Dashboard Visualisierung) ---
        const complianceBase = 70;
        const complianceScore = activeSessions.length > 0 ? 100 : complianceBase;

        // --- TOTAL SCORE CALCULATION ---
        const total = (
            (enclosureScore * 0.20) + 
            (gapScore * 0.40) + 
            (nocturnalScore * 0.20) + 
            (complianceScore * 0.20)
        );

        setScore(Math.round(total));
        setDetails({
            score: Math.round(total),
            subScores: {
                enclosure: enclosureScore,
                gap: gapScore,
                nocturnal: nocturnalScore,
                compliance: complianceScore
            }
        });
        setLoading(false);
    };

    // Berechnung bei Änderungen
    useEffect(() => {
        calculateMetrics();
    }, [items, activeSessions, externalNocturnalScore]);

    // Live-Update (Gap-Score Decay)
    useEffect(() => {
        const timer = setInterval(() => {
            calculateMetrics();
        }, 60000);
        return () => clearInterval(timer);
    }, [items, activeSessions, externalNocturnalScore]);

    return { femIndex: score, indexDetails: details, loading };
}