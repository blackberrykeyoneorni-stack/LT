import { useState, useEffect } from 'react';

export function useKPIs(items, activeSessionsInput, historySessionsInput = []) {
    const [kpis, setKpis] = useState({
        // Struktur für InfoTiles.jsx
        health: { orphanCount: 0 },
        financials: { avgCPW: 0 },
        usage: { nylonIndex: 0 }, // InfoTiles erwartet hier eine Zahl
        spermaScore: { rate: 0, total: 0, kept: 0 },

        // Struktur für Stats.jsx
        coreMetrics: {
            enclosure: 0,
            nocturnal: 0,
            nylonGap: 0,
            cpnh: 0,
            complianceLag: 0,
            exposure: 0,
            resistance: 0,
            voluntarism: 0,
            endurance: 0,
            submission: 0, // Legacy support
            denial: 0,
            chastity: 0
        },
        femIndex: {
            score: 0,
            trend: 'neutral'
        },
        basics: {
            activeItems: 0,
            washing: 0,
            wornToday: 0,
            archived: 0
        }
    });

    useEffect(() => {
        if (!Array.isArray(items)) return;

        // 1. Session-Daten konsolidieren
        // Dashboard übergibt nur arg2 (activeSessions)
        // Stats übergibt arg2=[] und arg3 (historySessions)
        const sessionsToAnalyze = (historySessionsInput && historySessionsInput.length > 0) 
            ? historySessionsInput 
            : (activeSessionsInput || []);

        // --- BERECHNUNGEN ---

        // A. ITEM BASICS & ORPHANS
        const activeItems = items.filter(i => i.status === 'active');
        const washingItems = items.filter(i => i.status === 'washing');
        const archivedItems = items.filter(i => i.status === 'archived');
        
        // Orphan: Active Item mit 0 Wears
        const orphanCount = items.filter(i => i.status === 'active' && (!i.wearCount || i.wearCount === 0)).length;

        // B. FINANCIALS (CPW)
        // Ø Cost per Wear aller Items, die mindestens 1x getragen wurden
        const wornItems = items.filter(i => i.wearCount > 0 && i.cost > 0);
        let totalCPW = 0;
        wornItems.forEach(i => {
            totalCPW += (i.cost / i.wearCount);
        });
        const avgCPW = wornItems.length > 0 ? (totalCPW / wornItems.length) : 0;

        // C. NYLON INDEX & GAP
        const tightsItems = items.filter(i => 
            i.status !== 'archived' && 
            i.subCategory && 
            typeof i.subCategory === 'string' &&
            (i.subCategory.toLowerCase().includes('strumpfhose') || i.mainCategory?.toLowerCase().includes('nylon'))
        );

        const totalTightsMinutes = tightsItems.reduce((acc, curr) => acc + (Number(curr.totalMinutes) || 0), 0);
        const nylonIndexVal = tightsItems.length > 0 ? (totalTightsMinutes / tightsItems.length / 60) : 0;

        // Nylon Gap (Dummy calculation für Stats, falls keine echten Daten)
        // Hier könnte man die durchschnittliche Lücke zwischen Sessions berechnen
        const nylonGap = Math.max(0, 24 - nylonIndexVal); 

        // D. CORE METRICS
        // Enclosure: Anteil Nylon Items am Gesamtbestand (active)
        const totalActive = activeItems.length + washingItems.length + items.filter(i=>i.status==='wearing').length;
        const nylonCount = tightsItems.length;
        const enclosure = totalActive > 0 ? Math.round((nylonCount / totalActive) * 100) : 0;

        // Nocturnal: Nacht-Sessions Quote
        const nightSessions = sessionsToAnalyze.filter(s => s.period && s.period.includes('night'));
        const nocturnal = sessionsToAnalyze.length > 0 
            ? Math.round((nightSessions.length / sessionsToAnalyze.length) * 100) 
            : 0;
            
        // Exposure (Tragezeit Ratio - Mock)
        const exposure = 45; // Platzhalter, müsste Zeit/24h rechnen

        // Resistance (Punishment Quote)
        const punishments = sessionsToAnalyze.filter(s => s.type === 'punishment');
        const resistance = sessionsToAnalyze.length > 0 
            ? Math.round((punishments.length / sessionsToAnalyze.length) * 100) 
            : 0;

        // CPNH (Cost Per Nylon Hour)
        // Summe Kosten aller Nylons / Summe Stunden aller Nylons
        const totalNylonCost = tightsItems.reduce((acc, i) => acc + (Number(i.cost) || 0), 0);
        const totalNylonHours = totalTightsMinutes / 60;
        const cpnh = totalNylonHours > 0 ? parseFloat((totalNylonCost / totalNylonHours).toFixed(2)) : 0;

        // Voluntarism & Compliance
        const voluntary = sessionsToAnalyze.filter(s => s.type === 'voluntary').length;
        const voluntarism = sessionsToAnalyze.length > 0 ? Math.round((voluntary / sessionsToAnalyze.length) * 100) : 0;
        const complianceLag = 12; // Mock in Minuten

        // Endurance (Ø Session Dauer in Stunden)
        // Nur abgeschlossene Sessions zählen
        const closedSessions = sessionsToAnalyze.filter(s => s.endTime && s.startTime);
        let totalDurationHours = 0;
        closedSessions.forEach(s => {
            const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
            const end = s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime);
            totalDurationHours += (end - start) / 3600000;
        });
        const endurance = closedSessions.length > 0 ? parseFloat((totalDurationHours / closedSessions.length).toFixed(1)) : 0;

        // E. SPERMA SCORE (Mock/Placeholder wenn keine Daten)
        const spermaScore = { rate: 100, total: 5, kept: 5 }; 

        // F. FEM INDEX (Composite)
        const femScore = Math.round(
            (enclosure * 0.3) + (nocturnal * 0.2) + (nylonIndexVal * 2) // Einfache Gewichtung
        );

        // G. BASICS WORN TODAY
        const startOfToday = new Date();
        startOfToday.setHours(0,0,0,0);
        const sessionsToday = sessionsToAnalyze.filter(s => {
            if(!s.startTime) return false;
            const d = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
            return d >= startOfToday;
        });
        const uniqueItemsToday = new Set();
        sessionsToday.forEach(s => {
            if (s.itemId) uniqueItemsToday.add(s.itemId);
            if (s.itemIds) s.itemIds.forEach(id => uniqueItemsToday.add(id));
        });

        setKpis({
            health: { 
                orphanCount 
            },
            financials: { 
                avgCPW 
            },
            usage: { 
                nylonIndex: parseFloat(nylonIndexVal.toFixed(1)) // Zahl!
            },
            spermaScore,
            coreMetrics: {
                enclosure,
                nocturnal,
                nylonGap: parseFloat(nylonGap.toFixed(1)),
                cpnh,
                complianceLag,
                exposure,
                resistance,
                voluntarism,
                endurance,
                // Legacy / Fallback
                submission: 85,
                denial: 12,
                chastity: enclosure // Mapping
            },
            femIndex: {
                score: Math.min(100, femScore),
                trend: 'stable'
            },
            basics: {
                activeItems: activeItems.length,
                washing: washingItems.length,
                wornToday: uniqueItemsToday.size,
                archived: archivedItems.length
            }
        });

    }, [items, activeSessionsInput, historySessionsInput]);

    return kpis;
}