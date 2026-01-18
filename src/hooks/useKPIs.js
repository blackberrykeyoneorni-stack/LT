import { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

// Helper für sicheres Date Parsing
const safeDate = (val) => {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();
    if (val instanceof Date) return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};

// Hilfsfunktion für den Gap-Score (lokal)
const calculateGapScore = (items, currentSessions) => {
    if (currentSessions && currentSessions.length > 0) return 100;
    if (!items || items.length === 0) return 0;

    const lastWornDates = items
        .map(i => safeDate(i.lastWorn))
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

// Hilfsfunktion: Berechnet die effektiven Trage-Minuten (Nylons) für einen spezifischen Tag (Union der Zeitintervalle)
const calculateDailyNylonWearMinutes = (targetDate, sessions, items) => {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // 1. Relevante Sessions filtern (Überlappung mit Tag + Nylon Inhalt)
    const relevantSessions = sessions.filter(s => {
        const sStart = safeDate(s.startTime);
        const sEnd = safeDate(s.endTime); // null/undefined bedeutet aktiv
        
        if (!sStart) return false;
        if (sStart > endOfDay) return false;
        if (sEnd && sEnd < startOfDay) return false;
        
        // Item Check
        const sItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
        return sItemIds.some(id => {
            const item = items.find(i => i.id === id);
            if (!item) return false;
            const cat = (item.mainCategory || '').toLowerCase();
            const sub = (item.subCategory || '').toLowerCase();
            return cat.includes('nylon') || sub.includes('strumpfhose') || sub.includes('stockings');
        });
    });

    // 2. Intervalle bilden & auf Tagesgrenzen beschneiden
    const intervals = relevantSessions.map(s => {
        const sStart = safeDate(s.startTime);
        const sEnd = safeDate(s.endTime) || new Date(); // Wenn aktiv, bis "jetzt" (wird durch min(endOfDay) gecappt)
        
        const start = Math.max(sStart.getTime(), startOfDay.getTime());
        const end = Math.min(sEnd.getTime(), endOfDay.getTime());
        
        return { start, end };
    }).filter(i => i.end > i.start);

    if (intervals.length === 0) return 0;

    // 3. Intervalle verschmelzen (Union)
    intervals.sort((a, b) => a.start - b.start);
    const merged = [];
    let current = intervals[0];

    for (let i = 1; i < intervals.length; i++) {
        if (intervals[i].start < current.end) {
            current.end = Math.max(current.end, intervals[i].end);
        } else {
            merged.push(current);
            current = intervals[i];
        }
    }
    merged.push(current);

    // 4. Summe berechnen
    const totalMs = merged.reduce((acc, i) => acc + (i.end - i.start), 0);
    return Math.floor(totalMs / 60000);
};

export const useKPIs = (items = [], activeSessions = [], historySessions = []) => {
    const { currentUser } = useAuth();
    const [releaseStats, setReleaseStats] = useState({ totalReleases: 0, keptOn: 0 });
    const [nowTrigger, setNowTrigger] = useState(Date.now());
    const [internalHistory, setInternalHistory] = useState([]); // Eigener Speicher für Historie

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

    // Lade Historie selbstständig, wenn sie nicht von außen (z.B. Dashboard) kommt
    useEffect(() => {
        if (!currentUser) return;
        if (!historySessions || historySessions.length === 0) {
            const loadHistory = async () => {
                try {
                    const q = query(collection(db, `users/${currentUser.uid}/sessions`), orderBy('startTime', 'desc'));
                    const snap = await getDocs(q);
                    const loaded = snap.docs.map(d => ({ 
                        id: d.id, ...d.data(),
                        startTime: safeDate(d.data().startTime),
                        endTime: safeDate(d.data().endTime)
                    }));
                    setInternalHistory(loaded);
                } catch(e) { console.error("KPI History Load Error", e); }
            };
            loadHistory();
        }
    }, [currentUser, historySessions]);

    // Heartbeat
    useEffect(() => {
        const timer = setInterval(() => setNowTrigger(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    return useMemo(() => {
        const safeItems = Array.isArray(items) ? items : [];
        const safeHistory = (historySessions && historySessions.length > 0) ? historySessions : internalHistory;

        // --- 1. BASIS DATEN ---
        const activeItems = safeItems.filter(i => i.status === 'active');
        const washingItems = safeItems.filter(i => i.status === 'washing');
        const archivedItems = safeItems.filter(i => i.status === 'archived');
        
        // --- 2. CORE METRICS ---
        
        // Financials
        const totalValue = activeItems.reduce((acc, i) => acc + (parseFloat(i.cost) || 0), 0);
        const totalCostAll = safeItems.reduce((acc, i) => acc + (parseFloat(i.cost) || 0), 0);
        
        const totalWears = safeItems.reduce((acc, i) => acc + (i.wearCount || 0), 0);
        const avgCPWVal = totalWears > 0 ? (totalCostAll / totalWears) : 0;

        // Health
        const orphanCountVal = activeItems.filter(i => !i.wearCount || i.wearCount === 0).length;

        // A. Enclosure
        const nylons = activeItems.filter(i => (i.mainCategory || '').toLowerCase().includes('nylon'));
        const enclosureVal = activeItems.length > 0 ? Math.round((nylons.length / activeItems.length) * 100) : 0;

        // B. Nocturnal (Single Source of Truth: 15.12.2025, 03:00 Uhr Check)
        const startDateMetric = new Date(2025, 11, 15, 3, 0, 0); 
        const now = new Date();
        let totalNights = 0;
        let wornNights = 0;

        if (now > startDateMetric) {
             let checkDate = new Date(startDateMetric);
             while (checkDate <= now) {
                 totalNights++;
                 const checkTime = checkDate.getTime();
                 
                 const isWearingNylon = safeHistory.some(s => {
                     const start = safeDate(s.startTime);
                     const end = safeDate(s.endTime);
                     if (!start) return false;
                     // Zeit-Check: Überlappt 03:00 Uhr?
                     if (checkTime >= start.getTime() && (!end || checkTime <= end.getTime())) {
                         const sItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
                         return sItemIds.some(id => {
                             const item = safeItems.find(i => i.id === id);
                             if (!item) return false;
                             const cat = (item.mainCategory || '').toLowerCase();
                             const sub = (item.subCategory || '').toLowerCase();
                             return cat.includes('nylon') || sub.includes('strumpfhose') || sub.includes('stockings');
                         });
                     }
                     return false;
                 });

                 if (isWearingNylon) wornNights++;
                 checkDate.setDate(checkDate.getDate() + 1);
             }
        }
        const nocturnalVal = totalNights > 0 ? Math.round((wornNights / totalNights) * 100) : 0;

        // C. Nylon Gap (NEU)
        // Durchschnittliche tägliche Zeit OHNE Nylons seit 15.12.2025 (ohne heute)
        const gapStartDate = new Date(2025, 11, 15); // 15. Dez 2025
        let totalGapMinutesSum = 0;
        let gapDaysCount = 0;
        
        // Wir iterieren bis GESTERN (heute exklusive)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(23, 59, 59, 999);

        if (yesterday >= gapStartDate) {
            let loopDate = new Date(gapStartDate);
            while (loopDate <= yesterday) {
                const wornMins = calculateDailyNylonWearMinutes(loopDate, safeHistory, safeItems);
                const gapMins = 1440 - wornMins; // 24h * 60m = 1440
                totalGapMinutesSum += Math.max(0, gapMins);
                gapDaysCount++;
                loopDate.setDate(loopDate.getDate() + 1);
            }
        }

        let nylonGapFormatted = "0h 0m";
        if (gapDaysCount > 0) {
            const avgGapMins = totalGapMinutesSum / gapDaysCount;
            const h = Math.floor(avgGapMins / 60);
            const m = Math.round(avgGapMins % 60);
            nylonGapFormatted = `${h}h ${m}m`;
        }


        // D. CPNH
        const totalMinutes = safeItems.reduce((acc, i) => acc + (i.totalMinutes || 0), 0);
        const totalHours = totalMinutes / 60;
        const cpnhVal = totalHours > 0 ? (totalCostAll / totalHours).toFixed(2) : "0.00";

        // E. Compliance Lag
        const instructionSessions = safeHistory.filter(s => s.type === 'instruction');
        const sessionsWithLag = instructionSessions.filter(s => typeof s.complianceLagMinutes === 'number');
        const totalLag = sessionsWithLag.reduce((acc, s) => acc + s.complianceLagMinutes, 0);
        const complianceLagVal = sessionsWithLag.length > 0 ? Math.round(totalLag / sessionsWithLag.length) : 0;

        // F. Exposure
        let exposureVal = 0;
        if (safeHistory.length > 0) {
            const sortedStart = [...safeHistory].sort((a,b) => {
                 const dA = safeDate(a.startTime) || new Date(0);
                 const dB = safeDate(b.startTime) || new Date(0);
                 return dA - dB;
            });
            const start = safeDate(sortedStart[0]?.startTime) || new Date();
            
            let totalSessionDuration = 0;
            safeHistory.forEach(s => {
                const sStart = safeDate(s.startTime);
                const sEnd = safeDate(s.endTime);
                if(sStart && sEnd) {
                    totalSessionDuration += (sEnd - sStart);
                }
            });
            const totalTimeSinceStart = Date.now() - start.getTime();
            exposureVal = totalTimeSinceStart > 0 ? Math.round((totalSessionDuration / totalTimeSinceStart) * 100) : 0;
        }

        // G. Resistance
        const punishmentCount = safeHistory.filter(s => s.type === 'punishment').length;
        const resistanceVal = safeHistory.length > 0 ? Math.round((punishmentCount / safeHistory.length) * 100) : 0;

        // H. Vibe
        const tags = {};
        safeItems.forEach(i => {
            if(Array.isArray(i.vibeTags)) i.vibeTags.forEach(t => tags[t] = (tags[t] || 0) + 1);
        });
        const vibeVal = Object.keys(tags).sort((a,b) => tags[b] - tags[a])[0] || "Neutral";

        // I. Voluntarismus
        const volSessions = safeHistory.filter(s => s.type === 'voluntary').length;
        const instrSessions = safeHistory.filter(s => s.type === 'instruction').length;
        const voluntarismVal = instrSessions === 0 ? (volSessions > 0 ? volSessions.toFixed(2) : "0.00") : (volSessions / instrSessions).toFixed(2);

        // J. Endurance
        let totalEnduranceMs = 0;
        let enduranceCount = 0;
        safeHistory.forEach(s => {
             const sStart = safeDate(s.startTime);
             if (sStart) {
                const sEnd = safeDate(s.endTime) || new Date(); 
                const diff = (sEnd - sStart);
                if (diff > 0) {
                    totalEnduranceMs += diff;
                    enduranceCount++;
                }
            }
        });
        const enduranceVal = enduranceCount > 0 ? (totalEnduranceMs / enduranceCount / 1000 / 3600).toFixed(1) : "0.0";

        // --- 3. FEM-INDEX ---
        const gapScore = calculateGapScore(safeItems, activeSessions);
        const nylonIndexVal = nylons.length > 0 
            ? (nylons.reduce((acc, i) => acc + (i.totalMinutes || 0), 0) / nylons.length) / 60 
            : 0;
        
        const nocturnalScore = nocturnalVal; 

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

        return {
            health: { orphanCount: orphanCountVal },
            financials: { totalValue, avgCPW: avgCPWVal, amortizationRate: 0 },
            usage: { nylonIndex: nylonIndexVal },
            spermaScore: { rate: spermaScoreRate, total: totalReleases, kept: keptReleases },
            basics: { total: safeItems.length, active: activeItems.length, washing: washingItems.length, archived: archivedItems.length },
            
            coreMetrics: {
                enclosure: enclosureVal,
                nocturnal: nocturnalVal,
                nylonGap: nylonGapFormatted, // NEU
                cpnh: cpnhVal,
                complianceLag: complianceLagVal,
                exposure: exposureVal,
                resistance: resistanceVal,
                vibe: vibeVal,
                sessionCount: safeHistory.length,
                voluntarism: voluntarismVal,
                endurance: enduranceVal
            },

            femIndex: {
                score: femIndexTotal,
                details: {
                    score: femIndexTotal,
                    subScores: { enclosure: enclosureVal, gap: gapScore, nocturnal: nocturnalScore, compliance: complianceScore }
                }
            }
        };
    }, [items, releaseStats, activeSessions, historySessions, internalHistory, nowTrigger]); 
};