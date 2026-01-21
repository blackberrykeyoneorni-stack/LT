import { useState, useEffect, useMemo } from 'react';
import { differenceInDays, startOfWeek, endOfWeek, isWithinInterval, subWeeks } from 'date-fns';

export function useKPIs(items, activeSessions) {
    const [kpis, setKpis] = useState({
        coreMetrics: {
            submission: 0,
            denial: 0,
            chastity: 0,
            nocturnal: 0
        },
        femIndex: {
            score: 0,
            trend: 'neutral'
        },
        basics: {
            activeItems: 0,
            washing: 0,
            wornToday: 0
        },
        nylonIndex: {
            value: 0,
            unit: 'h/Item'
        }
    });

    // Helper: Berechnet Nächte (für Nocturnal Score)
    const calculateNocturnalScore = (sessions) => {
        if (!sessions || sessions.length === 0) return 0;
        
        // Suche nach Instructions, die 'night' im Period-String haben
        // und erfolgreich beendet wurden (oder laufen)
        // HINWEIS: Hier könnte man später die nightSuccess-Logik aus dem SessionService integrieren.
        // Für jetzt zählen wir reine Night-Sessions.
        const nightSessions = sessions.filter(s => 
            s.type === 'instruction' && 
            s.period && 
            s.period.includes('night')
        );

        if (nightSessions.length === 0) return 0;
        
        // Einfache Quote: Anzahl Nächte (hier als Platzhalter Logik)
        // In einem echten Szenario müsste man "Mögliche Nächte vs. Erfüllte Nächte" rechnen.
        // Wir nehmen hier vereinfacht an: Wenn Sessions da sind, ist der Score hoch.
        return Math.min(100, nightSessions.length * 10); 
    };

    useEffect(() => {
        if (!items) return;

        // 1. BASICS
        const activeItemsCount = items.filter(i => i.status === 'active').length;
        const washingCount = items.filter(i => i.status === 'washing').length;
        
        // Getragene Items heute (aus Sessions)
        const startOfToday = new Date();
        startOfToday.setHours(0,0,0,0);
        
        const sessionsToday = activeSessions.filter(s => {
            const d = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
            return d >= startOfToday;
        });

        // Eindeutige Items heute
        const uniqueItemsToday = new Set();
        sessionsToday.forEach(s => {
            if (s.itemId) uniqueItemsToday.add(s.itemId);
            if (s.itemIds) s.itemIds.forEach(id => uniqueItemsToday.add(id));
        });

        // 2. CORE METRICS (Dummy-Logik / Platzhalter für echte Algorithmen)
        // Hier würden echte Berechnungen stehen basierend auf Punishment-Historie etc.
        const submissionScore = 85; // Mock
        const denialScore = 12; // Mock
        
        // Chastity Score: Anteil der Zeit "im Käfig" (hier: Items getragen vs. nicht getragen)
        const wearingCount = items.filter(i => i.status === 'wearing').length;
        const totalWearable = items.filter(i => i.status !== 'archived').length;
        const chastityScore = totalWearable > 0 ? Math.round((wearingCount / totalWearable) * 100) : 0;

        const nocturnalScore = calculateNocturnalScore(activeSessions); // Mock

        // 3. NYLON INDEX (NEU DEFINIERT)
        // Filter: Alles was nicht archiviert ist UND Subkategorie "Strumpfhose" ist.
        const tightsItems = items.filter(i => 
            i.status !== 'archived' && 
            i.subCategory && 
            i.subCategory.toLowerCase().includes('strumpfhose')
        );

        const totalTightsMinutes = tightsItems.reduce((acc, curr) => acc + (curr.totalMinutes || 0), 0);
        
        // Berechnung: Durchschnittliche Stunden pro Strumpfhose
        const nylonIndexVal = tightsItems.length > 0 
            ? (totalTightsMinutes / tightsItems.length / 60) 
            : 0;

        // 4. FEM INDEX AGGREGATION
        // Einfache Gewichtung der Sub-Scores
        const compositeScore = Math.round(
            (submissionScore * 0.3) + 
            (chastityScore * 0.2) + 
            (nocturnalScore * 0.3) +
            (Math.min(100, nylonIndexVal * 2) * 0.2) // Nylon Index fließt auch ein
        );

        setKpis({
            coreMetrics: {
                submission: submissionScore,
                denial: denialScore,
                chastity: chastityScore,
                nocturnal: nocturnalScore
            },
            femIndex: {
                score: compositeScore,
                trend: compositeScore > 80 ? 'rising' : 'stable'
            },
            basics: {
                activeItems: activeItemsCount,
                washing: washingCount,
                wornToday: uniqueItemsToday.size
            },
            nylonIndex: {
                value: parseFloat(nylonIndexVal.toFixed(1)),
                unit: 'h/Item' // Durchschnittliche Tragezeit pro Strumpfhose
            }
        });

    }, [items, activeSessions]);

    return kpis;
}