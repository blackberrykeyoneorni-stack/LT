import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

/**
 * Berechnet den Fem-Index (0-100) basierend auf 4 Säulen:
 * 1. Enclosure (Material): Anteil Nylon/Latex/Spandex im Besitz/Einsatz.
 * 2. Nocturnal (Nacht): Anteil der Nächte unter Protokoll.
 * 3. Compliance (Agilität): Reaktionszeit und Annahmequote.
 * 4. Gap (Disziplin): Zeit ohne Item (Lücken).
 */
export default function useFemIndex(currentUser, items = [], activeSessions = []) {
    const [score, setScore] = useState(0);
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);

    // Hilfsfunktion: Gap-Score berechnen
    const calculateGapScore = (items, currentSessions) => {
        // 1. Wenn aktuell etwas getragen wird -> Perfekte Disziplin (100%)
        if (currentSessions && currentSessions.length > 0) return 100;

        // 2. Sonst: Wann wurde zuletzt etwas getragen?
        if (!items || items.length === 0) return 0;

        // Suche das aktuellste 'lastWorn' Datum aller Items
        const lastWornDates = items
            .map(i => i.lastWorn ? (i.lastWorn.toDate ? i.lastWorn.toDate() : new Date(i.lastWorn)) : null)
            .filter(d => d !== null);

        if (lastWornDates.length === 0) return 0; // Nie etwas getragen

        const mostRecent = new Date(Math.max(...lastWornDates));
        const now = new Date();
        const hoursDiff = (now - mostRecent) / (1000 * 60 * 60);

        // Formel: < 12h = 100%, danach linearer Abfall bis 48h
        if (hoursDiff <= 12) return 100;
        if (hoursDiff >= 48) return 0;
        
        // Linearer Abfall zwischen 12 und 48 Stunden
        // 36 Stunden Fenster (48-12)
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
        // Wie viel % der Items sind "fetisch-relevant" (Nylon, Spandex, etc.)?
        const fetishItems = items.filter(i => {
            const cat = (i.mainCategory || '').toLowerCase();
            const sub = (i.subCategory || '').toLowerCase();
            return cat.includes('nylon') || cat.includes('latex') || cat.includes('pvc') || 
                   sub.includes('strumpfhose') || sub.includes('corsage');
        });
        const enclosureScore = (fetishItems.length / items.length) * 100;

        // --- B. GAP (Disziplin) ---
        const gapScore = calculateGapScore(items, activeSessions);

        // --- C. NOCTURNAL & COMPLIANCE (Simuliert/Historisch) ---
        // In einer vollen Implementation würden wir hier echte History-Logs laden.
        // Vereinfachung für Stabilität: Wir leiten es aus Item-Statistiken ab.
        
        // Nocturnal: Haben Items "Sleep" im Log oder Tagging? 
        // Wir nehmen an: Wer hohe Gap-Scores hat, schläft oft auch damit.
        // Fallback: Wir koppeln es leicht an den GapScore, aber etwas träger.
        const nocturnalScore = Math.min(gapScore * 1.1, 100); 

        // Compliance: Wie oft gewaschen vs. getragen (Cleanliness als Proxy für Compliance)
        // Oder einfach ein Basiswert, der durch "accepted instructions" steigen würde.
        // Wir nehmen hier einen fixen Wert + Bonus für Active Sessions
        const complianceBase = 70;
        const complianceScore = activeSessions.length > 0 ? 100 : complianceBase;

        // --- TOTAL SCORE CALCULATION ---
        // Gewichtung:
        // Enclosure: 20% (Besitz)
        // Gap: 40% (Aktuelle Disziplin - WICHTIGSTES FEATURE)
        // Nocturnal: 20%
        // Compliance: 20%
        
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

    // 1. Initial Calculation & Updates bei Datenänderung
    useEffect(() => {
        calculateMetrics();
    }, [items, activeSessions]); // Reagiert jetzt auf Sessions!

    // 2. Live-Update (jede Minute), damit der Gap-Score live fällt, wenn man nichts trägt
    useEffect(() => {
        const timer = setInterval(() => {
            calculateMetrics();
        }, 60000); // 60 Sekunden
        return () => clearInterval(timer);
    }, [items, activeSessions]);

    return { femIndex: score, indexDetails: details, loading };
}
