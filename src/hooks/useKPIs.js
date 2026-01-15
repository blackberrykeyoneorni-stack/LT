import { useState, useEffect, useMemo } from 'react';
import { differenceInDays } from 'date-fns';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

// Hilfsfunktion für den Gap-Score (lokal)
const calculateGapScore = (items, currentSessions) => {
    // 1. Wenn aktuell Session läuft -> 100%
    if (currentSessions && currentSessions.length > 0) return 100;
    if (!items || items.length === 0) return 0;

    // 2. Suche das aktuellste 'lastWorn'
    const lastWornDates = items
        .map(i => i.lastWorn ? (i.lastWorn.toDate ? i.lastWorn.toDate() : new Date(i.lastWorn)) : null)
        .filter(d => d !== null);

    if (lastWornDates.length === 0) return 0;

    const mostRecent = new Date(Math.max(...lastWornDates));
    const now = new Date();
    const hoursDiff = (now - mostRecent) / (1000 * 60 * 60);

    // < 12h = 100%, danach linearer Abfall bis 48h (Grace Period)
    if (hoursDiff <= 12) return 100;
    if (hoursDiff >= 48) return 0;
    const remaining = 48 - hoursDiff;
    return (remaining / 36) * 100;
};

export const useKPIs = (items = [], activeSessions = []) => {
    const { currentUser } = useAuth();
    const [releaseStats, setReleaseStats] = useState({ totalReleases: 0, keptOn: 0 });
    
    // Timer State für Live-Updates (FemIndex Decay)
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

    // Interner Heartbeat (jede Minute)
    useEffect(() => {
        const timer = setInterval(() => setNowTrigger(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    return useMemo(() => {
        // Sicherstellen, dass items ein Array ist
        const safeItems = Array.isArray(items) ? items : [];

        // --- 1. SPERMA SCORE CALC (Unabhängig von Items) ---
        const totalReleases = releaseStats.totalReleases || 0;
        const keptReleases = releaseStats.keptOn || 0;
        const spermaScoreRate = totalReleases > 0 
            ? Math.round((keptReleases / totalReleases) * 100) 
            : 0;

        // --- 2. STANDARD KPIs ---
        const activeItems = safeItems.filter(i => i.status === 'active');
        const washingItems = safeItems.filter(i => i.status === 'washing');
        const archivedItems = safeItems.filter(i => i.status === 'archived');
        const wornOutItems = activeItems.filter(i => i.condition <= 2);
        const itemsWithWears = safeItems.filter(i => (i.wearCount || 0) > 0);
        
        // Financials
        const totalValue = activeItems.reduce((acc, i) => acc + (parseFloat(i.cost) || 0), 0);
        const avgCPW = itemsWithWears.length > 0 
            ? itemsWithWears.reduce((acc, i) => acc + ((parseFloat(i.cost) || 0) / i.wearCount), 0) / itemsWithWears.length 
            : 0;
        const amortizedItems = itemsWithWears.filter(i => ((parseFloat(i.cost) || 0) / i.wearCount) < 1.00);
        const amortizationRate = itemsWithWears.length > 0 ? (amortizedItems.length / itemsWithWears.length) * 100 : 0;

        // Usage
        const nylonItems = safeItems.filter(i => (i.mainCategory || '').toLowerCase().includes('nylon'));
        const nylonIndex = nylonItems.length > 0 
            ? (nylonItems.reduce((acc, i) => acc + (i.totalMinutes || 0), 0) / nylonItems.length) / 60 
            : 0;

        // Health / Gap Analysis
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sixtyDaysAgo = new Date(); sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const wornRecently = activeItems.filter(i => {
            if (!i.lastWorn) return false;
            const d = i.lastWorn.toDate ? i.lastWorn.toDate() : new Date(i.lastWorn);
            return d >= thirtyDaysAgo;
        });
        const rotationScore = activeItems.length > 0 ? (wornRecently.length / activeItems.length) * 100 : 0;

        const orphans = activeItems.filter(i => {
            if (!i.lastWorn) return true; 
            const d = i.lastWorn.toDate ? i.lastWorn.toDate() : new Date(i.lastWorn);
            return d < sixtyDaysAgo;
        });
        
        const totalActiveAndWashing = activeItems.length + washingItems.length;
        const freshRate = totalActiveAndWashing > 0 ? (activeItems.length / totalActiveAndWashing) * 100 : 0;

        // Wardrobe Score
        const conditionScore = activeItems.length > 0
            ? (activeItems.reduce((acc, i) => acc + (i.condition || 5), 0) / activeItems.length) * 20 
            : 0;
        const wardrobeScore = (rotationScore * 0.4) + (conditionScore * 0.3) + (freshRate * 0.3);

        // --- 3. FEM-INDEX BERECHNUNG ---
        
        // A. Enclosure (Besitz-Quote)
        const fetishItems = safeItems.filter(i => {
            const cat = (i.mainCategory || '').toLowerCase();
            const sub = (i.subCategory || '').toLowerCase();
            return cat.includes('nylon') || cat.includes('late') || cat.includes('pvc') || 
                   sub.includes('strumpfhose') || sub.includes('corsage') || sub.includes('body');
        });
        const enclosureScore = safeItems.length > 0 ? (fetishItems.length / safeItems.length) * 100 : 0;

        // B. Gap (Live Disziplin)
        const gapScore = calculateGapScore(safeItems, activeSessions);

        // C. Nocturnal (Nacht-Quote -> Nutzungs-Intensität)
        const nocturnalScore = Math.min(nylonIndex * 10, 100);

        // D. Compliance
        const complianceScore = (spermaScoreRate + freshRate) / 2;

        const femIndexTotal = Math.round(
            (enclosureScore * 0.20) + 
            (gapScore * 0.40) + 
            (nocturnalScore * 0.20) + 
            (complianceScore * 0.20)
        );

        return {
            basics: { total: safeItems.length, active: activeItems.length, washing: washingItems.length, archived: archivedItems.length },
            financials: { totalValue, avgCPW, amortizationRate },
            usage: { nylonIndex, totalMinutes: safeItems.reduce((acc, i) => acc + (i.totalMinutes || 0), 0) },
            health: { rotationScore, orphanCount: orphans.length, freshRate, wornOutCount: wornOutItems.length, orphans },
            meta: { wardrobeScore },
            spermaScore: { rate: spermaScoreRate, total: totalReleases, kept: keptReleases },
            femIndex: {
                score: femIndexTotal,
                details: {
                    score: femIndexTotal,
                    subScores: { enclosure: enclosureScore, gap: gapScore, nocturnal: nocturnalScore, compliance: complianceScore }
                }
            }
        };
    }, [items, releaseStats, activeSessions, nowTrigger]); 
};