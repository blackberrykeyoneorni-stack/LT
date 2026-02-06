import { useState, useEffect } from 'react';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

// --- KONFIGURATION ---
const HISTORY_START_DATE = new Date('2025-12-15T00:00:00');

// --- HELPER FUNKTIONEN ---

const fmtPct = (val) => (typeof val === 'number' ? val.toFixed(1) : '0.0');
const fmtMoney = (val) => (typeof val === 'number' ? val.toFixed(2) : '0.00');

// Neue Formatierung: Stunden & Minuten (z.B. "5h 12m" oder "45m")
const fmtDuration = (minutes) => {
    if (!minutes || minutes <= 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

// Hilfsfunktion für dezimale Stunden -> Formatierung
const fmtHoursToDuration = (hours) => {
    return fmtDuration(hours * 60);
};

const calculateCoverage = (sessions) => {
    const now = new Date();
    const startOfPeriod = new Date(now);
    startOfPeriod.setDate(now.getDate() - 7); 

    const relevantSessions = sessions.filter(s => {
        const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
        const end = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date();
        return end > startOfPeriod && start < now;
    });

    const intervals = relevantSessions.map(s => {
        const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
        const end = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date();
        return {
            start: Math.max(start.getTime(), startOfPeriod.getTime()),
            end: Math.min(end.getTime(), now.getTime())
        };
    }).filter(i => i.end > i.start);

    if (intervals.length === 0) return 0;

    intervals.sort((a,b) => a.start - b.start);
    const merged = [];
    let curr = intervals[0];

    for(let i=1; i < intervals.length; i++) {
        if(intervals[i].start < curr.end) {
            curr.end = Math.max(curr.end, intervals[i].end);
        } else {
            merged.push(curr);
            curr = intervals[i];
        }
    }
    merged.push(curr);

    const activeMs = merged.reduce((acc, i) => acc + (i.end - i.start), 0);
    const totalMs = 7 * 24 * 60 * 60 * 1000; 

    return Math.min(100, (activeMs / totalMs) * 100);
};

const isNocturnalComplaint = (targetTime, sessions, items) => {
    return sessions.some(s => {
        const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
        const end = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date(); 
        
        if (targetTime >= start && targetTime <= end) {
            const sessionItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
            return sessionItemIds.some(id => {
                const item = items.find(i => i.id === id);
                if (!item) return false;
                const sub = (item.subCategory || '').toLowerCase();
                return sub.includes('strumpfhose');
            });
        }
        return false;
    });
};

const calculateDailyNylonMinutes = (dateObj, sessions, items) => {
    const startOfDay = new Date(dateObj); startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(dateObj); endOfDay.setHours(23,59,59,999);

    const relevantSessions = sessions.filter(s => {
        const sStart = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
        const sEnd = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date();
        
        if (sStart > endOfDay || sEnd < startOfDay) return false;
        
        const ids = s.itemIds || (s.itemId ? [s.itemId] : []);
        return ids.some(id => {
            const item = items.find(i => i.id === id);
            if (!item) return false;
            const cat = (item.mainCategory || '').toLowerCase();
            const sub = (item.subCategory || '').toLowerCase();
            return cat.includes('nylon') || sub.includes('strumpfhose') || sub.includes('stockings');
        });
    });

    const intervals = relevantSessions.map(s => {
        const sStart = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
        const sEnd = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date();
        return {
            start: Math.max(sStart.getTime(), startOfDay.getTime()),
            end: Math.min(sEnd.getTime(), endOfDay.getTime())
        };
    }).filter(i => i.end > i.start);

    if (intervals.length === 0) return 0;

    intervals.sort((a,b) => a.start - b.start);
    const merged = [];
    let curr = intervals[0];
    for(let i=1; i < intervals.length; i++) {
        if(intervals[i].start < curr.end) {
            curr.end = Math.max(curr.end, intervals[i].end);
        } else {
            merged.push(curr);
            curr = intervals[i];
        }
    }
    merged.push(curr);

    const totalMs = merged.reduce((acc, i) => acc + (i.end - i.start), 0);
    return Math.floor(totalMs / 60000);
};

export function useKPIs(items, activeSessionsInput, historySessionsInput) {
    const { currentUser } = useAuth();
    
    const [releaseStats, setReleaseStats] = useState({ 
        totalReleases: 0, 
        cleanReleases: 0,
        keptOn: 0 
    });

    const [internalHistory, setInternalHistory] = useState([]);

    const [kpis, setKpis] = useState({
        health: { orphanCount: 0 },
        financials: { avgCPW: '0.00' },
        usage: { nylonIndex: '0.0' },
        spermaScore: { rate: '0.0', total: 0, count: 0 },
        coreMetrics: {
            nylonEnclosure: '0.0', 
            nocturnal: '0.0', 
            nylonGap: '0m', // Jetzt String
            cpnh: '0.00',
            complianceLag: '0m', // Jetzt String
            coverage: '0.0',
            resistance: '0.0',
            voluntarism: '0.0%',
            endurance: '0m', // Jetzt String
            enduranceNylon: '0m', 
            enduranceDessous: '0m',
            submission: '85.0',
            denial: '12.0', 
            chastity: '0.0'
        },
        femIndex: { score: 0, trend: 'neutral' },
        basics: { activeItems: 0, washing: 0, wornToday: 0, archived: 0 }
    });

    useEffect(() => {
        if (!currentUser) return;
        if (historySessionsInput === undefined) {
            const q = query(
                collection(db, `users/${currentUser.uid}/sessions`),
                where('startTime', '>=', HISTORY_START_DATE),
                orderBy('startTime', 'desc')
            );
            const unsub = onSnapshot(q, (snapshot) => {
                const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setInternalHistory(sessions);
            });
            return () => unsub();
        }
    }, [currentUser, historySessionsInput]); 

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

    useEffect(() => {
        if (!Array.isArray(items)) return;

        let allSessions = [];
        if (historySessionsInput !== undefined) {
            allSessions = historySessionsInput;
        } else if (internalHistory.length > 0) {
            allSessions = internalHistory;
        } else {
            allSessions = activeSessionsInput || [];
        }

        const historySessions = allSessions.filter(s => {
            const d = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
            return d >= HISTORY_START_DATE;
        });

        // A. ITEMS & ORPHANS
        const activeItems = items.filter(i => i.status === 'active');
        const washingItems = items.filter(i => i.status === 'washing');
        const archivedItems = items.filter(i => i.status === 'archived');
        const orphanCount = items.filter(i => i.status === 'active' && (!i.wearCount || i.wearCount === 0)).length;

        // B. FINANCIALS
        let totalCost = 0; 
        let totalWears = 0;
        items.forEach(i => { 
            totalCost += (parseFloat(i.cost) || 0); 
            totalWears += (parseInt(i.wearCount) || 0); 
        });
        const avgCPWVal = totalWears > 0 ? (totalCost / totalWears) : 0;

        // C. NYLON INDEX
        const tightsItems = items.filter(i => 
            i.status !== 'archived' && (
                (i.mainCategory && i.mainCategory === 'Nylons') ||
                (i.subCategory && i.subCategory.toLowerCase().includes('strumpfhose'))
            )
        );

        const now = new Date();
        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - 30);

        const recentSessions = allSessions.filter(s => {
            const end = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date();
            return end >= cutoffDate;
        });

        let totalRollingMinutes = 0;
        const uniqueNylonItemsWorn = new Set(); 

        recentSessions.forEach(s => {
            const sItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
            let sessionHasNylon = false;
            sItemIds.forEach(id => {
                const item = items.find(i => i.id === id);
                if (!item) return;
                const main = item.mainCategory || '';
                const sub = (item.subCategory || '').toLowerCase();
                if (main === 'Nylons' || sub.includes('strumpfhose') || sub.includes('stockings')) {
                    sessionHasNylon = true;
                    uniqueNylonItemsWorn.add(id); 
                }
            });

            if (sessionHasNylon) {
                const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
                const end = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date();
                const effectiveStart = start < cutoffDate ? cutoffDate : start;
                const effectiveEnd = end; 
                if (effectiveEnd > effectiveStart) {
                    totalRollingMinutes += (effectiveEnd - effectiveStart) / 60000;
                }
            }
        });

        const nylonIndexVal = uniqueNylonItemsWorn.size > 0 
            ? (totalRollingMinutes / uniqueNylonItemsWorn.size) / 60 
            : 0;
        
        const lifetimeTightsMinutes = tightsItems.reduce((acc, curr) => acc + (Number(curr.totalMinutes) || 0), 0);
        const totalNylonCost = tightsItems.reduce((acc, i) => acc + (Number(i.cost) || 0), 0);
        const totalNylonHoursLifetime = lifetimeTightsMinutes / 60;
        const cpnhVal = totalNylonHoursLifetime > 0 ? (totalNylonCost / totalNylonHoursLifetime) : 0;

        // D. CORE METRICS
        const coverageVal = calculateCoverage(allSessions);

        let daysCount = 0;
        let nocturnalSuccessCount = 0;
        const loopDate = new Date(HISTORY_START_DATE);
        while (loopDate <= now) {
            daysCount++;
            const checkTime = new Date(loopDate);
            checkTime.setHours(2, 0, 0, 0);
            if (checkTime <= now && isNocturnalComplaint(checkTime, allSessions, items)) { 
                nocturnalSuccessCount++;
            }
            loopDate.setDate(loopDate.getDate() + 1);
        }
        const nocturnalVal = daysCount > 0 ? (nocturnalSuccessCount / daysCount) * 100 : 0;

        let totalGapHours = 0;
        let gapDaysCount = 0;
        const gapLoopDate = new Date(HISTORY_START_DATE);
        while (gapLoopDate <= now) {
            gapDaysCount++;
            const wornMinutes = calculateDailyNylonMinutes(gapLoopDate, allSessions, items);
            totalGapHours += ((1440 - wornMinutes) / 60);
            gapLoopDate.setDate(gapLoopDate.getDate() + 1);
        }
        const avgGapVal = gapDaysCount > 0 ? (totalGapHours / gapDaysCount) : 24;

        // Voluntarism & Compliance Lag
        let totalDurationMs = 0;
        let voluntaryDurationMs = 0;
        let totalLagMinutes = 0;
        let lagCount = 0;

        historySessions.forEach(s => {
            const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
            const end = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date();
            const duration = Math.max(0, end.getTime() - start.getTime());
            totalDurationMs += duration;
            if (s.type === 'voluntary') voluntaryDurationMs += duration;

            // Compliance Lag berechnen
            if (typeof s.complianceLagMinutes === 'number') {
                totalLagMinutes += s.complianceLagMinutes;
                lagCount++;
            }
        });
        const voluntarismVal = totalDurationMs > 0 ? (voluntaryDurationMs / totalDurationMs) * 100 : 0;
        const resistanceVal = historySessions.length > 0 ? (historySessions.filter(s => s.type === 'punishment').length / historySessions.length) * 100 : 0;
        
        const avgLagVal = lagCount > 0 ? (totalLagMinutes / lagCount) : 0;

        // ENDURANCE (Strict: Only Nylon/Lingerie)
        const relevantEnduranceSessions = historySessions.filter(s => s.startTime);
        let globalDuration = 0; let globalCount = 0;
        let nylonDuration = 0; let nylonCount = 0;
        let dessousDuration = 0; let dessousCount = 0;

        relevantEnduranceSessions.forEach(s => {
            const start = s.startTime.toDate ? s.startTime.toDate() : new Date(s.startTime);
            const end = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date();
            const durationHours = Math.max(0, (end - start) / 3600000);
            
            const sessionItemIds = s.itemIds || (s.itemId ? [s.itemId] : []);
            const sessionItems = sessionItemIds.map(id => items.find(i => i.id === id)).filter(i => i);
            if (sessionItems.length === 0) return;

            const hasNylon = sessionItems.some(i => {
                const sub = (i.subCategory || '').toLowerCase();
                const cat = (i.mainCategory || '').toLowerCase();
                return cat.includes('nylon') || sub.includes('strumpfhose') || sub.includes('stockings');
            });
            const hasDessous = sessionItems.some(i => {
                const sub = (i.subCategory || '').toLowerCase();
                const cat = (i.mainCategory || '').toLowerCase();
                return cat.includes('dessous') || cat.includes('wäsche') || sub.includes('body') || sub.includes('slip') || sub.includes('bh') || cat.includes('corsage');
            });

            // LOGIK ÄNDERUNG: Zähle global nur, wenn Nylon oder Dessous dabei ist.
            if (hasNylon || hasDessous) { 
                globalDuration += durationHours; 
                globalCount++; 
            }
            if (hasNylon) { nylonDuration += durationHours; nylonCount++; }
            if (hasDessous) { dessousDuration += durationHours; dessousCount++; }
        });

        const enduranceVal = globalCount > 0 ? (globalDuration / globalCount) : 0;
        const enduranceNylonVal = nylonCount > 0 ? (nylonDuration / nylonCount) : 0;
        const enduranceDessousVal = dessousCount > 0 ? (dessousDuration / dessousCount) : 0;
        
        const nylonEnclosureVal = globalDuration > 0 ? (nylonDuration / globalDuration) * 100 : 0;

        // E. SCORES
        const spermaRateVal = releaseStats.totalReleases > 0 
            ? (releaseStats.cleanReleases / releaseStats.totalReleases) * 100 : 0;
        const femScore = Math.round((nylonEnclosureVal * 0.3) + (nocturnalVal * 0.2) + (nylonIndexVal * 2));

        // G. BASICS TODAY
        const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
        const sessionsToday = allSessions.filter(s => {
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
            financials: { avgCPW: fmtMoney(avgCPWVal) }, 
            usage: { nylonIndex: fmtPct(nylonIndexVal) }, 
            spermaScore: { 
                rate: fmtPct(spermaRateVal), 
                total: releaseStats.totalReleases, 
                count: releaseStats.cleanReleases 
            },
            coreMetrics: {
                nylonEnclosure: fmtPct(nylonEnclosureVal),
                nocturnal: fmtPct(nocturnalVal),
                nylonGap: fmtHoursToDuration(avgGapVal), // FORMATIERT: Xh Ym
                cpnh: fmtMoney(cpnhVal),
                complianceLag: fmtDuration(avgLagVal), // FORMATIERT: Xh Ym
                coverage: fmtPct(coverageVal),
                resistance: fmtPct(resistanceVal),
                voluntarism: fmtPct(voluntarismVal) + '%', 
                endurance: fmtHoursToDuration(enduranceVal), // FORMATIERT: Xh Ym
                enduranceNylon: fmtHoursToDuration(enduranceNylonVal), // FORMATIERT
                enduranceDessous: fmtHoursToDuration(enduranceDessousVal), // FORMATIERT
                submission: '85.0',
                denial: '12.0',
                chastity: fmtPct(nylonEnclosureVal)
            },
            femIndex: { score: Math.min(100, femScore), trend: 'stable' },
            basics: {
                activeItems: activeItems.length,
                washing: washingItems.length,
                wornToday: uniqueItemsToday.size,
                archived: archivedItems.length
            }
        });

    }, [items, activeSessionsInput, historySessionsInput, internalHistory, releaseStats]);

    return kpis;
}