import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export function useKPIs(items, activeSessionsInput, historySessionsInput = []) {
    const { currentUser } = useAuth();
    
    // State für Release-Statistiken
    const [releaseStats, setReleaseStats] = useState({ 
        totalReleases: 0, 
        cleanReleases: 0,
        keptOn: 0 
    });

    const [kpis, setKpis] = useState({
        health: { orphanCount: 0 },
        financials: { avgCPW: 0 },
        usage: { nylonIndex: 0 },
        // Default-Werte, damit InfoTiles nie leer bleibt
        spermaScore: { rate: 0, total: 0, count: 0 },
        coreMetrics: {
            enclosure: 0, nocturnal: 0, nylonGap: 0, cpnh: 0,
            complianceLag: 0, exposure: 0, resistance: 0,
            voluntarism: 0, endurance: 0, submission: 85,
            denial: 12, chastity: 0
        },
        femIndex: { score: 0, trend: 'neutral' },
        basics: { activeItems: 0, washing: 0, wornToday: 0, archived: 0 }
    });

    // 1. LISTENER für Release-Daten (Echtzeit)
    useEffect(() => {
        if (!currentUser) return;
        
        const statsRef = doc(db, `users/${currentUser.uid}/stats/releaseStats`);
        const unsub = onSnapshot(statsRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setReleaseStats({
                    totalReleases: Number(data.totalReleases) || 0,
                    cleanReleases: Number(data.cleanReleases) || 0,
                    keptOn: Number(data.keptOn) || 0
                });
            }
        });

        return () => unsub();
    }, [currentUser]);

    // 2. HAUPT-BERECHNUNG
    useEffect(() => {
        if (!Array.isArray(items)) return;

        const sessionsToAnalyze = (historySessionsInput && historySessionsInput.length > 0) 
            ? historySessionsInput 
            : (activeSessionsInput || []);

        // --- BERECHNUNGEN ---

        // A. ITEMS & ORPHANS
        const activeItems = items.filter(i => i.status === 'active');
        const washingItems = items.filter(i => i.status === 'washing');
        const archivedItems = items.filter(i => i.status === 'archived');
        const orphanCount = items.filter(i => i.status === 'active' && (!i.wearCount || i.wearCount === 0)).length;

        // B. FINANCIALS (CPW - MATCH STATS.JSX)
        // Logik: Gesamtkosten des Inventars / Gesamtanzahl der Nutzungen.
        // Das entspricht exakt der Logik in Stats.jsx ("Global CPW").
        let totalCost = 0; 
        let totalWears = 0;
        
        items.forEach(i => { 
            // Wir summieren ALLES, auch ungetragene Items (Investition)
            totalCost += (parseFloat(i.cost) || 0); 
            totalWears += (parseInt(i.wearCount) || 0); 
        });
        
        const avgCPW = totalWears > 0 ? (totalCost / totalWears) : 0;

        // C. NYLON INDEX
        const tightsItems = items.filter(i => 
            i.status !== 'archived' && i.subCategory && typeof i.subCategory === 'string' &&
            (i.subCategory.toLowerCase().includes('strumpfhose') || i.mainCategory?.toLowerCase().includes('nylon'))
        );
        const totalTightsMinutes = tightsItems.reduce((acc, curr) => acc + (Number(curr.totalMinutes) || 0), 0);
        const nylonIndexVal = tightsItems.length > 0 ? (totalTightsMinutes / tightsItems.length / 60) : 0;
        const nylonGap = Math.max(0, 24 - nylonIndexVal); 

        // D. CORE METRICS
        const totalActive = activeItems.length + washingItems.length + items.filter(i=>i.status==='wearing').length;
        const enclosure = totalActive > 0 ? Math.round((tightsItems.length / totalActive) * 100) : 0;

        const nightSessions = sessionsToAnalyze.filter(s => s.period && s.period.includes('night'));
        const nocturnal = sessionsToAnalyze.length > 0 ? Math.round((nightSessions.length / sessionsToAnalyze.length) * 100) : 0;
        
        const totalNylonCost = tightsItems.reduce((acc, i) => acc + (Number(i.cost) || 0), 0);
        const totalNylonHours = totalTightsMinutes / 60;
        const cpnh = totalNylonHours > 0 ? parseFloat((totalNylonCost / totalNylonHours).toFixed(2)) : 0;

        const voluntary = sessionsToAnalyze.filter(s => s.type === 'voluntary').length;
        const voluntarism = sessionsToAnalyze.length > 0 ? Math.round((voluntary / sessionsToAnalyze.length) * 100) : 0;
        
        const punishments = sessionsToAnalyze.filter(s => s.type === 'punishment');
        const resistance = sessionsToAnalyze.length > 0 ? Math.round((punishments.length / sessionsToAnalyze.length) * 100) : 0;

        const closedSessions = sessionsToAnalyze.filter(s => s.endTime && s.startTime);
        let totalDurationHours = 0;
        closedSessions.forEach(s => {
            const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
            const end = s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime);
            totalDurationHours += (end - start) / 3600000;
        });
        const endurance = closedSessions.length > 0 ? parseFloat((totalDurationHours / closedSessions.length).toFixed(1)) : 0;

        // E. SPERMA SCORE (CLEAN / TOTAL)
        // Rate = (Clean Releases / Total Releases) * 100
        const spermaRate = releaseStats.totalReleases > 0 
            ? Math.round((releaseStats.cleanReleases / releaseStats.totalReleases) * 100) 
            : 0; 

        const spermaScore = { 
            rate: spermaRate, 
            total: releaseStats.totalReleases, 
            count: releaseStats.cleanReleases // Einheitlicher Name: 'count'
        };

        // F. FEM INDEX
        const femScore = Math.round((enclosure * 0.3) + (nocturnal * 0.2) + (nylonIndexVal * 2));

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
            health: { orphanCount },
            financials: { avgCPW },
            usage: { nylonIndex: parseFloat(nylonIndexVal.toFixed(1)) },
            spermaScore,
            coreMetrics: {
                enclosure, nocturnal, nylonGap: parseFloat(nylonGap.toFixed(1)),
                cpnh, complianceLag: 12, exposure: 45, resistance,
                voluntarism, endurance, submission: 85, denial: 12, chastity: enclosure
            },
            femIndex: { score: Math.min(100, femScore), trend: 'stable' },
            basics: {
                activeItems: activeItems.length,
                washing: washingItems.length,
                wornToday: uniqueItemsToday.size,
                archived: archivedItems.length
            }
        });

    }, [items, activeSessionsInput, historySessionsInput, releaseStats]);

    return kpis;
}