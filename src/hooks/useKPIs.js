import { useState, useEffect, useMemo } from 'react';
import { doc, getDocs, getDoc, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

// --- KONFIGURATION ---
const HISTORY_START_DATE = new Date('2025-12-15T00:00:00');

// --- HELPER FUNKTIONEN ---
const fmtPct = (val) => (typeof val === 'number' && !isNaN(val) ? val.toFixed(1) : '0.0');
const fmtMoney = (val) => (typeof val === 'number' && !isNaN(val) ? val.toFixed(2) : '0.00');

const fmtDuration = (minutes) => {
    if (typeof minutes !== 'number' || isNaN(minutes) || minutes <= 0) return '0m';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
};

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


export default function useKPIs(items = [], activeSessionsInput, historySessionsInput) {
    const { currentUser } = useAuth();
    
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [loading, setLoading] = useState(true);
    const [rawSessions, setRawSessions] = useState([]);
    const [releaseStats, setReleaseStats] = useState({ totalReleases: 0, cleanReleases: 0, keptOn: 0 });

    // 1. DATA FETCHING ONLY (No Math here)
    useEffect(() => {
        if (!currentUser) return;
        
        const fetchData = async () => {
            setLoading(true);
            try {
                if (!historySessionsInput) {
                    const q = query(
                        collection(db, `users/${currentUser.uid}/sessions`),
                        where('startTime', '>=', HISTORY_START_DATE),
                        orderBy('startTime', 'desc')
                    );
                    const snapshot = await getDocs(q);
                    const fetchedSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setRawSessions(fetchedSessions);
                }

                try {
                    const statsRef = doc(db, `users/${currentUser.uid}/stats/releaseStats`);
                    const statsSnap = await getDoc(statsRef);
                    if (statsSnap.exists()) {
                        const data = statsSnap.data();
                        setReleaseStats({
                            totalReleases: Number(data.totalReleases) || 0,
                            cleanReleases: Number(data.cleanReleases) || 0,
                            keptOn: Number(data.keptOn) || 0
                        });
                    }
                } catch (e) {
                    console.warn("Release stats konnten nicht geladen werden", e);
                }
            } catch (err) {
                console.error("Error fetching KPIs:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser, refreshTrigger, historySessionsInput]);

    // 2. MEMO: Session Aggregation
    const allSessions = useMemo(() => {
        if (historySessionsInput) {
            return [...historySessionsInput, ...(activeSessionsInput || [])];
        }
        return [...rawSessions, ...(activeSessionsInput || [])];
    }, [historySessionsInput, rawSessions, activeSessionsInput]);

    const historySessions = useMemo(() => {
        return allSessions.filter(s => {
            const d = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
            return d >= HISTORY_START_DATE;
        });
    }, [allSessions]);

    // 3. MEMO: Basic Items Math
    const itemStats = useMemo(() => {
        const activeItems = items.filter(i => i.status === 'active');
        const washingItems = items.filter(i => i.status === 'washing');
        const archivedItems = items.filter(i => i.status === 'archived');
        const orphanCount = activeItems.filter(i => (!i.wearCount || i.wearCount === 0)).length;

        let totalCost = 0; 
        let totalWears = 0;
        items.forEach(i => { 
            totalCost += (parseFloat(i.cost) || 0); 
            totalWears += (parseInt(i.wearCount) || 0); 
        });
        const avgCPWVal = totalWears > 0 ? (totalCost / totalWears) : 0;

        return { activeItems, washingItems, archivedItems, orphanCount, avgCPWVal };
    }, [items]);

    // 4. MEMO: Nylon Usage Math
    const nylonStats = useMemo(() => {
        const tightsItems = items.filter(i => 
            i.status !== 'archived' && (
                (i.mainCategory && i.mainCategory === 'Nylons') ||
                (i.subCategory && i.subCategory.toLowerCase().includes('strumpfhose'))
            )
        );

        let totalLifetimeMinutes = 0;
        const uniqueNylonItemsWorn = new Set(); 

        historySessions.forEach(s => {
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
                const start = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
                const end = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date();
                if (end > start) {
                    totalLifetimeMinutes += (end - start) / 60000;
                }
            }
        });

        const nylonIndexVal = uniqueNylonItemsWorn.size > 0 
            ? (totalLifetimeMinutes / uniqueNylonItemsWorn.size) / 60 
            : 0;
        
        const lifetimeTightsMinutes = tightsItems.reduce((acc, curr) => acc + (Number(curr.totalMinutes) || 0), 0);
        const totalNylonCost = tightsItems.reduce((acc, i) => acc + (Number(i.cost) || 0), 0);
        const totalNylonHoursLifetime = lifetimeTightsMinutes / 60;
        const cpnhVal = totalNylonHoursLifetime > 0 ? (totalNylonCost / totalNylonHoursLifetime) : 0;

        return { nylonIndexVal, cpnhVal };
    }, [items, historySessions]);

    // 5. MEMO: Core Metrics
    const coreMetrics = useMemo(() => {
        const now = new Date();
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
        let totalNylonMinutesHistory = 0; 
        
        const gapLoopDate = new Date(HISTORY_START_DATE);
        while (gapLoopDate <= now) {
            gapDaysCount++;
            const wornMinutes = calculateDailyNylonMinutes(gapLoopDate, allSessions, items);
            totalNylonMinutesHistory += wornMinutes;
            totalGapHours += ((1440 - wornMinutes) / 60);
            gapLoopDate.setDate(gapLoopDate.getDate() + 1);
        }
        const avgGapVal = gapDaysCount > 0 ? (totalGapHours / gapDaysCount) : 24;
        const avgNylonMinutesPerDay = gapDaysCount > 0 ? (totalNylonMinutesHistory / gapDaysCount) : 0;
        const nylonEnclosureVal = (avgNylonMinutesPerDay / 1440) * 100; 

        let totalDurationMs = 0;
        let voluntaryDurationMs = 0;
        let totalLagMinutes = 0;
        let lagCount = 0;

        const fortyDaysAgo = new Date();
        fortyDaysAgo.setDate(now.getDate() - 40);

        const recent40DaysSessions = historySessions.filter(s => {
            const d = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
            return d >= fortyDaysAgo;
        });

        recent40DaysSessions.forEach(s => {
            const start = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
            const end = s.endTime ? (s.endTime.toDate ? s.endTime.toDate() : new Date(s.endTime)) : new Date();
            const duration = Math.max(0, end.getTime() - start.getTime());
            totalDurationMs += duration;
            if (s.type === 'voluntary') voluntaryDurationMs += duration;

            const rawLag = s.complianceLagMinutes;
            const lagNum = Number(rawLag);
            
            if (!isNaN(lagNum) && lagNum >= 0) {
                totalLagMinutes += lagNum;
                lagCount++;
            }
        });
        
        const voluntarismVal = totalDurationMs > 0 ? (voluntaryDurationMs / totalDurationMs) * 100 : 0;
        const resistanceVal = recent40DaysSessions.length > 0 ? (recent40DaysSessions.filter(s => s.type === 'punishment').length / recent40DaysSessions.length) * 100 : 0;
        const avgLagVal = lagCount > 0 ? (totalLagMinutes / lagCount) : 0;

        const relevantEnduranceSessions = historySessions.filter(s => s.startTime);
        const sortedEnduranceSessions = [...relevantEnduranceSessions].sort((a, b) => {
            const startA = a.startTime?.toDate ? a.startTime.toDate() : new Date(a.startTime);
            const startB = b.startTime?.toDate ? b.startTime.toDate() : new Date(b.startTime);
            return startA - startB;
        });

        const mergedEnduranceSessions = [];
        if (sortedEnduranceSessions.length > 0) {
            let current = { ...sortedEnduranceSessions[0] };
            current.parsedStart = current.startTime?.toDate ? current.startTime.toDate() : new Date(current.startTime);
            current.parsedEnd = current.endTime ? (current.endTime.toDate ? current.endTime.toDate() : new Date(current.endTime)) : new Date();
            current.mergedItemIds = new Set(current.itemIds || (current.itemId ? [current.itemId] : []));

            for (let i = 1; i < sortedEnduranceSessions.length; i++) {
                const next = { ...sortedEnduranceSessions[i] };
                next.parsedStart = next.startTime?.toDate ? next.startTime.toDate() : new Date(next.startTime);
                next.parsedEnd = next.endTime ? (next.endTime.toDate ? next.endTime.toDate() : new Date(next.endTime)) : new Date();
                
                if ((next.parsedStart - current.parsedEnd) <= 15 * 60000) { 
                    current.parsedEnd = new Date(Math.max(current.parsedEnd, next.parsedEnd));
                    const nextIds = next.itemIds || (next.itemId ? [next.itemId] : []);
                    nextIds.forEach(id => current.mergedItemIds.add(id));
                } else {
                    mergedEnduranceSessions.push(current);
                    current = next;
                    current.parsedStart = next.parsedStart;
                    current.parsedEnd = next.parsedEnd;
                    current.mergedItemIds = new Set(current.itemIds || (current.itemId ? [current.itemId] : []));
                }
            }
            mergedEnduranceSessions.push(current);
        }

        let globalDuration = 0; let globalCount = 0;
        let nylonDuration = 0; let nylonCount = 0;
        let dessousDuration = 0; let dessousCount = 0;

        mergedEnduranceSessions.forEach(s => {
            const durationHours = Math.max(0, (s.parsedEnd - s.parsedStart) / 3600000);
            
            const sessionItemIds = Array.from(s.mergedItemIds);
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

        return { coverageVal, nocturnalVal, avgGapVal, nylonEnclosureVal, voluntarismVal, resistanceVal, avgLagVal, enduranceVal, enduranceNylonVal, enduranceDessousVal };
    }, [items, allSessions, historySessions]);

    // 6. MEMO: Chart Data
    const chartData = useMemo(() => {
        const now = new Date();
        const data = [];
        const startDate = new Date(now);
        startDate.setDate(now.getDate() - 59);
        startDate.setHours(0,0,0,0);

        const preStartDate = new Date(startDate);
        preStartDate.setDate(preStartDate.getDate() - 4);
        
        const dailyMinutes = [];
        const loopDate = new Date(preStartDate);
        while (loopDate <= now) {
            const mins = calculateDailyNylonMinutes(loopDate, allSessions, items);
            dailyMinutes.push({
                date: new Date(loopDate),
                mins: mins
            });
            loopDate.setDate(loopDate.getDate() + 1);
        }

        for (let i = 4; i < dailyMinutes.length; i++) {
            const currentMins = dailyMinutes[i].mins;
            let sum = 0;
            for (let j = 0; j < 5; j++) {
                sum += dailyMinutes[i - j].mins;
            }
            const ma = sum / 5;
            
            data.push({
                dateStr: dailyMinutes[i].date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
                Stunden: Number((currentMins / 60).toFixed(2)),
                Trend: Number((ma / 60).toFixed(2)) 
            });
        }
        return data;
    }, [items, allSessions]);

    // 7. MEMO: Fem Index Math
    const femIndexData = useMemo(() => {
        const { enduranceVal, nylonEnclosureVal, avgLagVal, voluntarismVal, resistanceVal, nocturnalVal, coverageVal } = coreMetrics;
        
        const scoreEndurance = Math.min(100, (enduranceVal / 12) * 100);
        const scorePhysis = (scoreEndurance * 0.4) + (nylonEnclosureVal * 0.6);

        const scoreCompliance = Math.max(0, 100 - (avgLagVal * 1.6));
        const scorePsyche = Math.max(0, ((voluntarismVal * 0.35) + (scoreCompliance * 0.65)) - (resistanceVal * 2));

        const scoreInfiltration = (nocturnalVal * 0.5) + (coverageVal * 0.5);

        const femScore = Math.round(
            (scorePhysis * 0.30) + 
            (scorePsyche * 0.30) + 
            (scoreInfiltration * 0.40)
        );

        return { score: isNaN(femScore) ? 0 : Math.min(100, femScore), scorePhysis, scorePsyche, scoreInfiltration };
    }, [coreMetrics]);

    // 8. FINAL MEMO: Format Output
    const finalKpis = useMemo(() => {
        const spermaRateVal = releaseStats.totalReleases > 0 
            ? (releaseStats.cleanReleases / releaseStats.totalReleases) * 100 : 0;

        const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
        const sessionsToday = allSessions.filter(s => {
            if(!s.startTime) return false;
            const d = s.startTime?.toDate ? s.startTime.toDate() : new Date(s.startTime);
            return d >= startOfToday;
        });
        const uniqueItemsToday = new Set();
        sessionsToday.forEach(s => {
            if (s.itemId) uniqueItemsToday.add(s.itemId);
            if (s.itemIds) s.itemIds.forEach(id => uniqueItemsToday.add(id));
        });

        return {
            health: { orphanCount: itemStats.orphanCount },
            financials: { avgCPW: fmtMoney(itemStats.avgCPWVal) }, 
            usage: { nylonIndex: fmtPct(nylonStats.nylonIndexVal), nylonChartData: chartData }, 
            spermaScore: { 
                rate: fmtPct(spermaRateVal), 
                total: releaseStats.totalReleases, 
                count: releaseStats.cleanReleases 
            },
            coreMetrics: {
                nylonEnclosure: fmtPct(coreMetrics.nylonEnclosureVal),
                nocturnal: fmtPct(coreMetrics.nocturnalVal),
                nylonGap: fmtHoursToDuration(coreMetrics.avgGapVal), 
                cpnh: fmtMoney(nylonStats.cpnhVal),
                complianceLag: fmtDuration(coreMetrics.avgLagVal), 
                coverage: fmtPct(coreMetrics.coverageVal),
                resistance: fmtPct(coreMetrics.resistanceVal),
                voluntarism: fmtPct(coreMetrics.voluntarismVal) + '%', 
                endurance: fmtHoursToDuration(coreMetrics.enduranceVal), 
                enduranceNylon: fmtHoursToDuration(coreMetrics.enduranceNylonVal), 
                enduranceDessous: fmtHoursToDuration(coreMetrics.enduranceDessousVal), 
                submission: '85.0',
                denial: '12.0',
                chastity: fmtPct(coreMetrics.nylonEnclosureVal)
            },
            femIndex: { 
                score: femIndexData.score, 
                trend: 'stable',
                subScores: {
                    physis: Math.round(femIndexData.scorePhysis),
                    psyche: Math.round(femIndexData.scorePsyche),
                    infiltration: Math.round(femIndexData.scoreInfiltration)
                }
            },
            basics: {
                activeItems: itemStats.activeItems.length,
                washing: itemStats.washingItems.length,
                wornToday: uniqueItemsToday.size,
                archived: itemStats.archivedItems.length
            }
        };
    }, [itemStats, nylonStats, coreMetrics, chartData, femIndexData, releaseStats, allSessions]);

    const refreshKPIs = () => setRefreshTrigger(prev => prev + 1);

    return { ...finalKpis, loading, refreshKPIs };
}