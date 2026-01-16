import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

// Hilfsfunktion für den Gap-Score (lokal)
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

// SIGNATUR: items, activeSessions, historySessions (optional)
export const useKPIs = (items = [], activeSessions = [], historySessions = []) => {
    const { currentUser } = useAuth();
    const [releaseStats, setReleaseStats] = useState({ totalReleases: 0, keptOn: 0 });
    const [nowTrigger, setNowTrigger] = useState(Date.now());

    // Live-Listener für Release Stats
    useEffect(() => {
        if (!currentUser) return;
        const statsRef = doc(db, `users/${currentUser.uid}/stats/releaseStats`);
        const unsubscribe = onSnapshot(statsRef, (docSnap) => {
            if (docSnap.exists()) setReleaseStats(docSnap.data());
            else setReleaseStats({ totalReleases: 0, keptOn: 0 });
        }, (error) => console.log("KPI Stats Error:", error));
        return () => unsubscribe();
    }, [currentUser]);

    // Heartbeat
    useEffect(() => {
        const timer = setInterval(() => setNowTrigger(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    return useMemo(() => {
        const safeItems = Array.isArray(items) ? items : [];
        const safeHistory = Array.isArray(historySessions) ? historySessions : [];

        // --- 1. BASIS DATEN ---
        const activeItems = safeItems.filter(i => i.status === 'active');
        const washingItems = safeItems.filter(i => i.status === 'washing');
        const archivedItems = safeItems.filter(i => i.status === 'archived');
        
        // --- 2. CORE METRICS (Single Source of Truth) ---
        
        // Financials
        const totalValue = activeItems.reduce((acc, i) => acc + (parseFloat(i.cost) || 0), 0);
        const totalCostAll = safeItems.reduce((acc, i) => acc + (parseFloat(i.cost) || 0), 0);
        
        // CPW Berechnung (Cost per Wear)
        const totalWears = safeItems.reduce((acc, i) => acc + (i.wearCount || 0), 0);
        const avgCPWVal = totalWears > 0 ? (totalCostAll / totalWears) : 0;

        // Health / Orphans (Aktive Items ohne Tragevorgang oder sehr lange nicht getragen)
        // Definition Orphan: Aktiv, aber wearCount == 0
        const orphanCountVal = activeItems.filter(i => !i.wearCount || i.wearCount === 0).length;

        // A. Enclosure (Nylons vs Gesamt)
        const nylons = activeItems.filter(i => (i.mainCategory || '').toLowerCase().includes('nylon'));
        const enclosureVal = activeItems.length > 0 ? Math.round((nylons.length / activeItems.length) * 100) : 0;

        // B. Nocturnal (Nacht-Quote aus Historie)
        const instructionSessions = safeHistory.filter(s => s.type === 'instruction');
        const nightSessions = instructionSessions.filter(s => s.period && s.period.includes('night'));
        const nocturnalVal = instructionSessions.length > 0 ? Math.round((nightSessions.length / instructionSessions.length) * 100) : 0;

        // C. CPNH (Cost Per Nylon Hour)
        const totalMinutes = safeItems.reduce((acc, i) => acc + (i.totalMinutes || 0), 0);
        const totalHours = totalMinutes / 60;
        const cpnhVal = totalHours > 0 ? (totalCostAll / totalHours).toFixed(2) : "0.00";

        // D. Compliance Lag (Ø Verzögerung)
        const sessionsWithLag = instructionSessions.filter(s => typeof s.complianceLagMinutes === 'number');
        const totalLag = sessionsWithLag.reduce((acc, s) => acc + s.complianceLagMinutes, 0);
        const complianceLagVal = sessionsWithLag.length > 0 ? Math.round(totalLag / sessionsWithLag.length) : 0;

        // E. Exposure (Tragezeit Verhältnis)
        let exposureVal = 0;
        if (safeHistory.length > 0) {
            const sortedStart = [...safeHistory].sort((a,b) => a.startTime - b.startTime);
            const start = sortedStart.length > 0 ? sortedStart[0].startTime : new Date();
            
            let totalSessionDuration = 0;
            safeHistory.forEach(s => {
                if(s.endTime && s.startTime) {
                    totalSessionDuration += (s.endTime - s.startTime);
                }
            });
            const totalTimeSinceStart = Date.now() - start.getTime();
            exposureVal = totalTimeSinceStart > 0 ? Math.round((totalSessionDuration / totalTimeSinceStart) * 100) : 0;
        }

        // F. Resistance (Straf-Quote)
        const punishmentCount = safeHistory.filter(s => s.type === 'punishment').length;
        const resistanceVal = safeHistory.length > 0 ? Math.round((punishmentCount / safeHistory.length) * 100) : 0;

        // G. Vibe
        const tags = {};
        safeItems.forEach(i => {
            if(Array.isArray(i.vibeTags)) i.vibeTags.forEach(t => tags[t] = (tags[t] || 0) + 1);
        });
        const vibeVal = Object.keys(tags).sort((a,b) => tags[b] - tags[a])[0] || "Neutral";

        // --- 3. FEM-INDEX & INFOTILES DATEN ---
        const gapScore = calculateGapScore(safeItems, activeSessions);
        
        // Nylon Index (Durchschnittliche Tragezeit von Nylons in Stunden)
        const nylonIndexVal = nylons.length > 0 
            ? (nylons.reduce((acc, i) => acc + (i.totalMinutes || 0), 0) / nylons.length) / 60 
            : 0;
        
        // Score Komponenten
        const nocturnalScore = Math.min(nylonIndexVal * 10, 100); 

        const totalReleases = releaseStats.totalReleases || 0;
        const keptReleases = releaseStats.keptOn || 0;
        const spermaScoreRate = totalReleases > 0 ? Math.round((keptReleases / totalReleases) * 100) : 0;
        
        const totalActiveAndWashing = activeItems.length + washingItems.length;
        const freshRate = totalActiveAndWashing > 0 ? (activeItems.length / totalActiveAndWashing) * 100 : 0;
        const complianceScore = (spermaScoreRate + freshRate) / 2;

        const femIndexTotal = Math.round(
            (enclosureVal * 0.20) + 
            (gapScore * 0.40) + 
            (nocturnalScore * 0.20) + 
            (complianceScore * 0.20)
        );

        // --- RETURN OBJECT (Strukturiert für InfoTiles & Stats) ---
        return {
            // Für InfoTiles.jsx
            health: { orphanCount: orphanCountVal },
            financials: { totalValue, avgCPW: avgCPWVal, amortizationRate: 0 },
            usage: { nylonIndex: nylonIndexVal },
            spermaScore: { rate: spermaScoreRate, total: totalReleases, kept: keptReleases },

            // Rohdaten Basics
            basics: { total: safeItems.length, active: activeItems.length, washing: washingItems.length, archived: archivedItems.length },
            
            // Standardisierte Metriken für Stats.jsx
            coreMetrics: {
                enclosure: enclosureVal,
                nocturnal: nocturnalVal,
                cpnh: cpnhVal,
                complianceLag: complianceLagVal,
                exposure: exposureVal,
                resistance: resistanceVal,
                vibe: vibeVal,
                sessionCount: safeHistory.length
            },

            // Gamification Score
            femIndex: {
                score: femIndexTotal,
                details: {
                    score: femIndexTotal,
                    subScores: { enclosure: enclosureVal, gap: gapScore, nocturnal: nocturnalScore, compliance: complianceScore }
                }
            }
        };
    }, [items, releaseStats, activeSessions, historySessions, nowTrigger]); 
};